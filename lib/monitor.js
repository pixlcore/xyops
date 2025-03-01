// Orchestra Monitoring Layer
// Copyright (c) 2022 - 2024 Joseph Huckaby

const fs = require('fs');
const zlib = require('zlib');
const Path = require('path');
const cp = require('child_process');
const async = require("async");
const Tools = require("pixl-tools");

class Monitoring {
	
	systems = [
		{
			id: "hourly",
			date_format: "[yyyy]/[mm]/[dd]/[hh]",
			epoch_div: 60, // 1 sample per minute
			single_only: true
		},
		{
			id: "daily",
			date_format: "[yyyy]/[mm]/[dd]",
			epoch_div: 120, // 2 min =~ 720 samples per day
		},
		{
			id: "monthly",
			date_format: "[yyyy]/[mm]",
			epoch_div: 3600 // 1 hour =~ 720 samples per month
		},
		{
			id: "yearly",
			date_format: "[yyyy]",
			epoch_div: 43200 // 12 hours =~ 730 pixels per year
		}
	];
	
	setupMonitoring() {
		// setup monitoring system (called when we become master)
		var self = this;
		
		// this.contribCache = {};
		this.quickMonCache = {};
		
		// recover / resume tracking all active alerts
		this.unbase.search( 'alerts', 'active:true', {}, function(err, data) {
			if (err || !data.records || !data.records.length) return;
			
			data.records.forEach( function(alert) {
				var global_id = alert.alert + '-' + alert.server;
				self.logDebug(5, "Resuming tracking active alert: " + global_id, alert);
				self.activeAlerts[ global_id ] = alert;
			} );
		});
		
		this.server.on('minute', function(dargs) {
			// self.summarizeMinuteData(dargs);
			
			// broadcast server update to all clients
			self.doUserBroadcastAll('update', { servers: self.servers });
			
			// check for stale alerts
			self.cleanupGlobalAlerts();
		} );
	}
	
	handleMonitoringData(socket, params) {
		// incoming monitoring data from worker server (i.e. performa)
		var self = this;
		var server = socket.server;
		var time_code = Math.floor( params.date / 60 );
		if (this.shut) return; // sanity
		
		// ignore submission if internal maint jobs running
		if (this.findInternalJobs({ type: 'maint' }).length) {
			this.logDebug(7, "Ignoring monitoring data submission due to admin maint jobs in progress", { id: server.id });
			return;
		}
		
		// ignore dupes in same minute for same server
		if (server.last_time_code && (time_code == server.last_time_code)) {
			this.logDebug(7, "Ignoring dupe monitoring data submission in same minute", { id: server.id });
			return;
		}
		server.last_time_code = time_code;
		
		this.logDebug(9, "Processing monitoring data submission from: " + server.hostname, { id: server.id } );
		
		// augment with current server IP address, for record keeping
		params.ip = socket.ip;
		
		// always use master server time, in case of clock drift
		params.date = Tools.timeNow(true);
		
		// normalize hostname for storage (and sanity)
		params.hostname = this.storage.normalizeKey( server.hostname ).replace(/\//g, '');
		params.groups = [ ...server.groups ];
		
		var monitor_defs = this.monitors;
		var alert_defs = this.alerts;
		var group_def = this.findPrimaryGroup( params.groups );
		
		// groups may have been deleted
		if (!group_def) {
			this.logDebug(7, "Groups not found: (" + params.groups.join(', ') + "), ignoring server monitor submission from: " + server.id);
			return;
		}
		
		// resolve monitor data values
		var data = {};
		var delta_defs = [];
		
		// store computed monitor values in params.data, so alerts can refer to them
		params.data.monitors = {};
		params.data.deltas = {};
		
		monitor_defs.forEach( function(mon_def) {
			if (mon_def.groups && mon_def.groups.length && !Tools.includesAny(mon_def.groups, params.groups)) return;
			
			var exp = Tools.sub( mon_def.source, params.data, false, "0" );
			var value = 0;
			
			// support custom data_match regexp to extract value out of string
			if (mon_def.data_match) {
				var matches = exp.match( mon_def.data_match );
				if (matches && (matches.length >= 2)) {
					// data_match has a group capture, use first group
					value = matches[1];
				}
				else if (matches) {
					// just grab entire match (no group)
					value = matches[0];
				}
				else {
					self.logError('submit', "Custom data regular expression did not match", {
						monitor: mon_def,
						hostname: params.hostname,
						raw_value: value
					});
					value = 0;
				}
			} // data_match
			else {
				// no data match, evaluate expression
				try { value = self.evalExpr( exp ); }
				catch (err) {
					self.logDebug(7, "Monitor expression failed to evaluate: " + err, {
						monitor: mon_def,
						hostname: params.hostname,
						expression: exp
					});
				}
			}
			
			switch (mon_def.data_type) {
				case 'integer': 
				case 'bytes':
				case 'seconds':
				case 'milliseconds':
					value = parseInt(value) || 0; 
				break;
				
				default: 
					value = Tools.shortFloat( parseFloat(value) || 0, 5 ); 
				break;
			} // data_type
			
			// manipulate value (currently unused)
			if (mon_def.multiply) value *= mon_def.multiply;
			else if (mon_def.divide) value /= mon_def.divide;
			
			data[ mon_def.id ] = params.data.monitors[ mon_def.id ] = value;
			
			if (mon_def.delta) {
				// data will temporarily have the absolute counter, 
				// just until delta_defs is processed below
				delta_defs.push( mon_def );
			}
		} ); // foreach monitor
		
		var host_data = null;
		var host_key = 'hosts/' + server.id + '/data';
		params.alerts = {};
		
		// check for alert snooze
		var alerts_snoozed = false;
		if (this.state.alert_snooze && (this.state.alert_snooze > Tools.timeNow())) alerts_snoozed = true;
		
		// track alert changes, so we can broadcast to all users
		var alerts_changed = false;
		
		// db operations to send
		var db_actions = [];
		
		async.series(
			[
				function(callback) {
					// lock hostname-based record
					self.storage.lock( host_key, true, callback );
				},
				function(callback) {
					// load host data or create new
					self.storage.get( host_key, function(err, data) {
						if (!data) data = { data: { monitors: {} }, alerts: {} };
						host_data = data;
						callback();
					});
				},
				function(callback) {
					// adjust any monitors that use deltas
					delta_defs.forEach( function(mon_def) {
						// so the idea here is that `host_data.data.monitors` always contains the absolute counter
						// only the sparse `data` object (for the timeline) will have the delta
						// this way we can compute the delta each time, using the host_data and incoming data
						if (!(mon_def.id in host_data.data.monitors)) {
							// first time for server, set delta to 0
							// host_data will be saved for next time
							data[ mon_def.id ] = 0;
							return;
						}
						
						var old_value = host_data.data.monitors[ mon_def.id ] || 0;
						var delta = data[ mon_def.id ] - old_value;
						if (!old_value) delta = 0;
						
						if (mon_def.divide_by_delta && host_data.date) {
							var elapsed = (params.date - host_data.date) || 1;
							delta /= elapsed;
						}
						if (delta < 0) delta = 0;
						if (mon_def.data_type.match(/^(integer|bytes|seconds|milliseconds)$/)) {
							delta = Math.floor(delta);
						}
						
						// data[ mon_def.id ] = delta;
						params.data.deltas[ mon_def.id ] = delta;
						// Note: params.data.monitors is deliberately NOT overwritten here, 
						// as it needs the absolute value for next time around.
						// But if alerts need to trigger on the delta, they should use [deltas/MONITOR_ID]
					} ); // foreach delta def
					
					// check for alerts
					alert_defs.forEach( function(alert_def) {
						if (alert_def.groups && alert_def.groups.length && !Tools.includesAny(alert_def.groups, params.groups)) return;
						
						var exp = Tools.sub( alert_def.expression, params.data, false, "0" );
						
						self.logDebug(9, "Checking alert expression " + exp, {
							alert: alert_def,
							server: server.id,
							hostname: params.hostname,
							expression: exp
						});
						
						var result = null;
						try { result = self.evalExpr( exp ); }
						catch (err) {
							self.logError('submit', "Alert expression failed to evaluate: " + err, {
								alert: alert_def,
								server: server.id,
								hostname: params.hostname,
								expression: exp
							});
						}
						
						if (result === true) {
							params.alerts[ alert_def.id ] = host_data.alerts[ alert_def.id ] || {
								date: params.date,
								exp: exp,
								message: '',
								count: 0,
								notified: false
							};
							
							// recompute message every time, as it may change
							params.alerts[ alert_def.id ].message = self.alertMessageSub( alert_def.message, params.data );
							
							// increase count, stop at def samples
							params.alerts[ alert_def.id ].count++;
							if (params.alerts[ alert_def.id ].count > alert_def.samples) params.alerts[ alert_def.id ].count = alert_def.samples;
							
						} // alert!
						else if (host_data.alerts[ alert_def.id ]) {
							// if previous alert, decrement count
							params.alerts[ alert_def.id ] = host_data.alerts[ alert_def.id ];
							
							// decrease count, stop at 0
							params.alerts[ alert_def.id ].count--;
							if (params.alerts[ alert_def.id ].count < 0) params.alerts[ alert_def.id ].count = 0;
						}
					} ); // foreach alert def
					
					// check for alert state changes
					Object.keys(params.alerts).forEach( function(key) {
						var alert = params.alerts[key];
						var alert_def = Tools.findObject( alert_defs, { id: key } );
						var global_id = server.id + '-' + alert_def.id;
						
						if ((alert.count == alert_def.samples) && !alert.notified) {
							alert.notified = true;
							
							// send new notification
							self.logTransaction('alert_new', "New alert for: " + params.hostname + ": " + alert_def.title, { 
								def: alert_def, 
								alert: alert,
								server: server.id,
								hostname: params.hostname 
							});
							
							// track stats
							self.updateDailyStat( 'alert_new' );
							self.updateDailyCustomStat( `servers.${server.id}.alert_new`, 1 );
							
							// store new alerts in params so timeline can use it
							if (!params.new_alerts) params.new_alerts = {};
							params.new_alerts[key] = true;
							
							// add alert to master catalogue
							var global_alert = self.activeAlerts[ global_id ] = Tools.mergeHashes( alert, {
								id: Tools.generateShortID('a'),
								active: true,
								alert: alert_def.id,
								server: server.id,
								groups: server.groups,
								modified: params.date
							} );
							alerts_changed = true;
							
							if (!group_def.mute_alerts && alert_def.enabled && !alerts_snoozed) {
								// notifications are enabled for alert and group
								self.sendAlertNotification({
									template: "alert_new",
									alert_def: alert_def,
									params: params,
									server: server,
									alert: alert,
									global_alert: global_alert
								});
							} // notifications enabled
							
							// add active jobs to alert
							var jobs = self.findActiveJobs({ state: 'active', remote: true, server: server.id });
							global_alert.jobs = jobs.map( function(job) { return job.id } );
							
							// insert into db
							// self.unbase.insert( 'alerts', global_alert.id, global_alert );
							db_actions.push({ func: 'insert', args: ['alerts', global_alert.id, global_alert] });
							
							// optionally abort all jobs on server
							if (alert_def.abort_jobs) {
								jobs.forEach( function(job) {
									self.abortJob(job, "Alert Triggered: " + alert_def.title);
								} );
							}
						}
						else if (!alert.count && alert.notified) {
							// send cleared notification
							self.logTransaction('alert_cleared', "Alert cleared: " + params.hostname + ": " + alert_def.title, { 
								def: alert_def, 
								alert: alert,
								server: server.id,
								hostname: params.hostname 
							});
							
							// track stats
							self.updateDailyStat( 'alert_cleared' );
							self.updateDailyCustomStat( `servers.${server.id}.alert_cleared`, 1 );
							
							var global_alert = self.activeAlerts[ global_id ];
							
							if (!group_def.mute_alerts && alert_def.enabled && !alerts_snoozed) {
								self.sendAlertNotification({
									template: "alert_cleared",
									alert_def: alert_def,
									params: params,
									server: server,
									alert: alert,
									global_alert: global_alert,
									elapsed: Tools.timeNow(true) - alert.date
								});
							} // alert enabled
							
							// clear alert in db
							if (global_alert && global_alert.id) {
								// self.unbase.update( 'alerts', global_alert.id, { active: false, modified: params.date } );
								db_actions.push({ func: 'update', args: ['alerts', global_alert.id, { active: false, modified: params.date }] });
							}
						}
						
						// keep global alert fresh, so it doesn't expire
						if (self.activeAlerts[ global_id ]) {
							self.activeAlerts[ global_id ].modified = params.date;
							self.activeAlerts[ global_id ].message = alert.message;
						}
						
						// cleanup dead alerts
						if (!alert.count) {
							delete params.alerts[key];
							delete self.activeAlerts[ global_id ];
							alerts_changed = true;
						}
					}); // foreach alert
					
					process.nextTick(callback);
				},
				function(callback) {
					// send all db calls now
					async.eachSeries( db_actions, function(item, callback) {
						self.unbase[ item.func ].apply( self.unbase, item.args.concat(callback) );
					}, callback );
				},
				function(callback) {
					// add / merge into all timelines
					// Note: This MUST be in series, because hourly is first and it CAN abort, if dupe or out-of-order
					async.eachSeries( self.systems,
						function(sys, callback) {
							self.processSystem({
								sys: sys,
								server: server,
								params: params,
								data: data
							}, callback);
						},
						callback
					);
				},
				function(callback) {
					// broadcast alert changes
					if (alerts_changed) {
						self.doUserBroadcastAll('update', { activeAlerts: self.activeAlerts });
					}
					
					// update server cpu/mem data in RAM
					server.info.cpu = params.data.cpu;
					server.info.memory = params.data.memory;
					server.info.process = params.data.process;
					server.info.monitors = params.data.monitors;
					server.info.deltas = params.data.deltas;
					
					// construct "combo" cpu brand / manufacturer / vendor
					server.info.cpu.combo = ((server.info.cpu.vendor || server.info.cpu.manufacturer || 'Unknown') + ' ' + (server.info.cpu.brand || '')).trim();
					
					// broadcast server update to applicable pages, such as #Server?id=HOST or #Group containing host
					self.doPageBroadcast('Servers?id=' + server.id, 'snapshot', { id: server.id, snapshot: params });
					
					server.groups.forEach( function(group_id) {
						self.doPageBroadcast('Groups?id=' + group_id, 'snapshot', { id: server.id, snapshot: params });
					});
					
					// write host data back to storage
					host_data = params;
					self.storage.put( host_key, host_data, callback );
				}
			],
			function(err) {
				// always unlock
				self.storage.unlock( host_key );
				if (err) {
					self.logError('submit', "Failed to submit data: " + (err.message || err), {});
				}
				else {
					self.logDebug(6, "Data submission complete for: " + params.hostname, { id: server.id });
				}
				
				// see if we need a snapshot
				var take_snap = false;
				
				if (params.new_alerts) {
					take_snap = true;
					params.source = 'alert';
				}
				else if (self.state.watches && self.state.watches.servers && self.state.watches.servers[server.id] && (self.state.watches.servers[server.id] >= params.date)) {
					take_snap = true;
					params.source = 'watch';
				}
				
				if (!take_snap) server.groups.forEach( function(group_id) {
					if (self.state.watches && self.state.watches.groups && self.state.watches.groups[group_id] && (self.state.watches.groups[group_id] >= params.date)) {
						take_snap = true;
						params.source = 'watch';
					}
				} );
				
				if (take_snap) {
					self.saveSnapshot( server, params );
				}
			}
		); // async.series
	}
	
	processSystem(args, callback) {
		// process data submission into a single system (hourly, daily, monthly or yearly)
		var self = this;
		var { sys, server, params, data } = args;
		
		var epoch = params.date;
		var epoch_div = Math.floor( epoch / sys.epoch_div );
		var timeline_key = 'timeline/' + server.id + '/' + sys.id;
		var update_data = null;
		var last_item = null;
		var trans = null;
		
		async.series(
			[
				function(callback) {
					// begin transaction
					self.storage.begin( timeline_key, function(err, transaction) {
						trans = transaction;
						callback();
					} );
				},
				function(callback) {
					// try to create list (will silently return list if already exists)
					trans.listCreate( timeline_key, { epoch_div }, function(err, list) {
						callback();
					} );
				},
				function(callback) {
					// load last list item to see if epoch_div matches
					trans.listGet( timeline_key, -1, 1, function(err, items, list) {
						if (items && items.length && (items[0].epoch_div == epoch_div)) {
							// final record matches epoch, we will merge
							update_data = items[0];
							
							// if system is marked as `single_only` call this an error
							// i.e. this is for when we have two servers with the same id submitting data at the same time
							if (sys.single_only) {
								return callback( new Error("Double submission in same minute for server: " + server.id) );
							}
						}
						else if (items && items.length && (items[0].epoch_div > epoch_div)) {
							// sanity check: this should NEVER happen
							return callback( new Error("Timeline out of order: Cannot submit " + epoch_div + " after " + items[0].epoch_div + " into " + timeline_key) );
						}
						else if (items && items.length) {
							// save item in case we have time gaps to fill
							last_item = items[0];
						}
						callback();
					});
				},
				function(callback) {
					// push or merge
					if (update_data) {
						// merge data into record (same divided timestamp)
						for (var key in data) {
							if (key in update_data.totals) {
								if ((typeof(data[key]) == 'number') && (typeof(update_data.totals[key]) == 'number')) {
									update_data.totals[key] += data[key];
								}
								else update_data.totals[key] = data[key];
							}
							else update_data.totals[key] = data[key];
						}
						update_data.count++;
						
						// merge in new alerts
						if (params.new_alerts) {
							if (!update_data.alerts) update_data.alerts = {};
							Tools.mergeHashInto( update_data.alerts, params.new_alerts );
						}
						
						trans.listSplice( timeline_key, -1, 1, [update_data], callback );
					}
					else {
						// push new, possibly with gaps
						var item = {
							date: epoch_div * sys.epoch_div,
							epoch_div: epoch_div,
							totals: data,
							count: 1
						};
						
						// include alerts if any new ones just fired
						if (params.new_alerts) {
							item.alerts = params.new_alerts;
						}
						
						var items = [];
						
						// fill gaps if needed
						while (last_item && (last_item.epoch_div < epoch_div - 1)) {
							items.push({ epoch_div: ++last_item.epoch_div });
						}
						if (items.length > 1) self.logDebug(5, "Filling gaps in timeline: " + timeline_key, { len: items.length - 1 });
						
						items.push(item);
						trans.listPush( timeline_key, items, callback );
					} // push new
				},
				function(callback) {
					// commit our transaction
					trans.commit(callback);
				}
			],
			function(err) {
				if (err) {
					// abort transaction and bubble error up
					return trans.abort( function() {
						callback(err);
					} );
				} // err
				
				// success!
				callback();
			}
		); // async.series
	}
	
	sendAlertNotification(args) {
		// send email and/or web hooks for alert (new or clear)
		// args: { template, alert_def, params, server, alert, global_alert, elapsed? }
		var self = this;
		var { params, server, alert, alert_def, global_alert } = args;
		
		// shorten alert_def for convenience in mail/hook templates
		args.def = alert_def;
		
		// add config to args
		args.config = this.config.get();
		
		// add nice date/time
		args.date_time = (new Date()).toString();
		
		// upper-case title for emphasis in plain text
		args.title_caps = alert_def.title.toUpperCase();
		
		// nice group title
		var group_def = this.findPrimaryGroup( params.groups );
		args.nice_group = group_def.title;
		
		// nice elapsed time, if present
		if (args.elapsed) {
			args.elapsed_nice = Tools.getTextFromSeconds( args.elapsed, false, true );
		}
		
		// nice server info
		args.nice_load_avg = Tools.shortFloat( params.data.load[0] );
		args.nice_mem_total = Tools.getTextFromBytes( params.data.memory.total );
		args.nice_mem_avail = Tools.getTextFromBytes( params.data.memory.available );
		args.nice_uptime = Tools.getTextFromSeconds( params.data.uptime_sec, false, true );
		args.nice_cpu = server.info.cpu.combo + " (" + server.info.os.arch + ")";
		args.nice_os = params.data.os.distro + " " + params.data.os.release; //  + " (" + params.data.os.arch + ")";
		args.nice_notes = alert_def.notes || '(None)';
		
		args.nice_hostname = params.hostname;
		if (args.config.hostname_display_strip) {
			args.nice_hostname = args.nice_hostname.replace( args.config.hostname_display_strip, '' );
		}
		args.nice_server = args.nice_hostname;
		if (server.title) args.nice_server = server.title + ' (' + args.nice_hostname + ')';
		
		// add virtualization info -- include extra info for AWS instances, like the type and region
		args.nice_virt = '(None)';
		if (server.info && server.info.virt) {
			var virt = server.info.virt;
			args.nice_virt = virt.vendor;
			if (virt.type || virt.location) {
				args.nice_virt += '(';
				var items = [];
				if (virt.type) items.push( virt.type );
				if (virt.location) items.push( virt.location );
				args.nice_virt += items.join(', ') + ')';
			}
		}
		
		// construct URLs to views of server
		args.server_url = this.config.get('base_app_url') + '/#Server?id=' + server.id;
		args.alert_url = this.config.get('base_app_url') + '/#Alerts?id=' + global_alert.id;
		
		// alert or group may override e-mail address
		args.email_to = alert_def.email || group_def.alert_email || this.config.get('alert_email_to');
		if (args.email_to) {
			// args.template: alert_new, alert_cleared
			// alert_def.title
			// alert_def.email
			// alert_def.web_hook
			// params.hostname
			// alert.exp
			// alert.message
			
			// send it
			this.sendEmail( 'conf/emails/' + args.template + '.txt', args, function(err, raw_email) {
				if (err) {
					var err_msg = "Failed to send alert e-mail: " + args.email_to + ": " + err;
					self.logError( 'mail', err_msg, { text: raw_email } );
					self.logTransaction('warning', err_msg);
				}
				else {
					self.logDebug(5, "Email sent successfully", { text: raw_email } );
				}
			} ); // sendEmail
		} // email_to
		
		// construct text message using hook_text_templates
		var text_templates = this.config.get('hook_text_templates');
		var text_template = text_templates[ args.template ];
		args.text = args.content = Tools.sub( text_template, args, false, "n/a" );
		
		// alert-specific web hook
		var alert_web_hook = alert_def.web_hook || group_def.alert_web_hook || '';
		if (alert_web_hook) {
			this.logDebug(9, "Firing web hook for alert: " + alert_def.id + ": " + alert_web_hook);
			
			this.fireWebHook(alert_web_hook, args, function(err, result) {
				// log response
				if (err) self.logDebug(9, "Alert Web Hook Error: " + alert_web_hook + ": " + err);
				else self.logDebug(9, "Alert Web Hook Response: " + alert_web_hook + ": HTTP " + result.resp.statusCode + " " + result.resp.statusMessage);
			});
		}
		
		// global web hook for all alerts
		// (this is more full featured than using config.hooks.alert_new / config.hooks.alert_cleared)
		var uni_web_hook_url = this.config.get('alert_web_hook') || '';
		if (uni_web_hook_url) {
			// construct web hook args (for system hooks)
			var hook_args = {
				action: args.template, // alert_new or alert_cleared
				definition: alert_def,
				alert: alert,
				hostname: params.hostname,
				groups: params.groups,
				alert_url: args.alert_url,
				server_url: args.server_url,
				text: args.text,
				content: args.content
			};
			
			this.logDebug(9, "Firing universal web hook for alert: " + alert_def.id + ": " + uni_web_hook_url);
			this.request.json( uni_web_hook_url, hook_args, function(err, resp, data) {
				// log response
				if (err) self.logDebug(9, "Universal Web Hook Error: " + uni_web_hook_url + ": " + err);
				else self.logDebug(9, "Universal Web Hook Response: " + uni_web_hook_url + ": HTTP " + resp.statusCode + " " + resp.statusMessage);
			} );
		}
		
		// notification channel (new alerts only)
		if (alert_def.channel_id && (args.template == 'alert_new')) {
			var channel = Tools.findObject( this.channels, { id: alert_def.channel_id } );
			if (!channel) self.logDebug(9, "Notification Channel not found for alert: " + alert_def.title + ": " + alert_def.channel_id );
			else if (!channel.enabled) self.logDebug(9, "Notification Channel not enabled for alert: " + alert_def.title + ": " + alert_def.channel_id );
			else {
				this.logDebug(6, "Notifying channel for alert: " + alert.title + ": " + channel.title, channel);
				
				if (channel.email) {
					this.logDebug(9, "Sending email for alert (channel): " + alert_def.title + ": " + channel.email);
					args.email_to = channel.email;
					this.sendEmail( 'conf/emails/' + args.template + '.txt', args, function(err, raw_email) {
						if (err) {
							var err_msg = "Failed to send alert e-mail: " + args.email_to + ": " + err;
							self.logError( 'mail', err_msg, { text: raw_email } );
							self.logTransaction('warning', err_msg);
						}
						else {
							self.logDebug(5, "Email sent successfully", { text: raw_email } );
						}
					} ); // sendEmail
				}
				if (channel.web_hook) {
					this.logDebug(9, "Firing web hook for alert (channel): " + alert_def.title + ": " + channel.web_hook);
					
					this.fireWebHook(channel.web_hook, args, function(err, result) {
						// log response
						if (err) self.logDebug(9, "Alert Web Hook Error: " + channel.web_hook + ": " + err);
						else self.logDebug(9, "Alert Web Hook Response: " + channel.web_hook + ": HTTP " + result.resp.statusCode + " " + result.resp.statusMessage);
					});
				}
				if (channel.run_event) {
					var event = Tools.findObject( this.events, { id: channel.run_event } );
					if (!event) this.logDebug(9, "Event not found for alert/channel: " + channel.run_event);
					else {
						var new_job = Tools.copyHash(event, true);
						new_job.source = 'alert';
						
						this.logDebug(6, "Running event for alert (channel): " + alert_def.title + ": " + event.title, new_job);
						
						this.launchJob(new_job, function(err, id) {
							if (err) self.logError('job', "Failed to launch event for alert (channel): " + alert_def.title + ": " + (err.message || err));
						});
					}
				}
				if (channel.shell_exec) {
					var cmd = Tools.sub( channel.shell_exec, args );
					this.logDebug(9, "Executing shell command for alert (channel): " + alert_def.title + ": " + cmd);
					
					cp.exec( cmd, function(err, stdout, stderr) {
						if (err) self.logDebug(9, "Shell Hook Error: " + cmd + ": " + err);
						else self.logDebug(9, "Shell Hook Completed", { cmd, stdout, stderr } );
					} );
				}
			} // channel go
		} // notify channel
		
		// launch event (new alerts only)
		if (alert_def.run_event && (args.template == 'alert_new')) {
			var event = Tools.findObject( this.events, { id: alert_def.run_event } );
			if (!event) this.logDebug(9, "Event not found for alert: " + alert_def.run_event);
			else {
				var new_job = Tools.copyHash(event, true);
				new_job.source = 'alert';
				
				this.logDebug(6, "Running event for alert: " + alert_def.title + ": " + event.title, new_job);
				
				this.launchJob(new_job, function(err, id) {
					if (err) self.logError('job', "Failed to launch event for alert (channel): " + alert_def.title + ": " + (err.message || err));
				});
			}
		}
	}
	
	createSnapshot(server_id, params, callback) {
		// create snapshot by loading most recent server data, and merging in custom params (e.g. source)
		// called by api_create_snapshot and job actions
		var self = this;
		var host_key = 'hosts/' + server_id + '/data';
		
		// validate server
		var server = this.servers[server_id];
		if (!server) {
			return callback( new Error("Failed to locate server: " + (server_id || 'n/a')) );
		}
		
		this.logDebug(6, "Taking snapshot of server: " + server_id, params);
		
		this.storage.get( host_key, function(err, data) {
			if (err) return callback(err);
			
			// merge in params
			Tools.mergeHashInto(data, params);
			
			self.saveSnapshot(server, data, function(err, id) {
				if (err) return callback(err);
				
				self.logDebug(9, "Server snapshot complete: " + server_id, { id });
				callback(null, id);
			}); // saveSnapshot
		} ); // storage.get
	}
	
	saveSnapshot(server, params, callback) {
		// save snapshot of server data
		var self = this;
		if (!callback) callback = function() {};
		
		var snapshot = Tools.mergeHashes(params, {
			id: Tools.generateShortID('sn'),
			server: server.id,
			groups: server.groups,
			alerts: this.findActiveAlerts({ server: server.id }).map( function(alert) { return alert.id; } ),
			jobs: this.findActiveJobs({ server: server.id }).map( function(job) { return job.id; } ),
			quickmon: this.quickMonCache[server.id] || []
		});
		
		this.logDebug(6, "Saving snapshot of server: " + server.id, { hostname: server.hostname, snapshot_id: snapshot.id });
		
		this.unbase.insert( 'snapshots', snapshot.id, snapshot, function(err) {
			if (err) return callback(err);
			callback(null, snapshot.id);
		} );
	}
	
	alertMessageSub(text, data) {
		// a special alert-specific wrapper around Tools.sub()
		// which allows special [bytes:PATH] and will convert the PATH value
		// to a human-readable bytes representation, e.g. "4.5 GB"
		var handlers = {
			bytes: function(value) { return Tools.getTextFromBytes( parseInt(value) ); },
			commify: function(value) { return Tools.commify( parseInt(value) ); },
			pct: function(value) { return Tools.pct( value, 100 ); },
			integer: function(value) { return parseInt(value); },
			float: function(value) { return Tools.shortFloat(value); }
		};
		text = text.replace(/\[(\w+)\:([^\]]+)\]/g, function(m_all, m_g1, m_g2) {
			return (m_g1 in handlers) ? handlers[m_g1]( Tools.getPath(data, m_g2) ) : m_all;
		});
		return Tools.sub(text, data);
	}
	
	findActiveAlerts(criteria) {
		// find active alerts matching criteria -- return array
		return Tools.findObjects( Object.values(this.activeAlerts), criteria );
	}
	
	cleanupGlobalAlerts() {
		// expire alerts if they get stale (dead servers, changed groups, etc.)
		var now = Tools.timeNow(true);
		var alerts_changed = false;
		
		for (var key in this.activeAlerts) {
			var alert = this.activeAlerts[key];
			if (now - alert.modified > 90) {
				if (alert.id) this.unbase.update( 'alerts', alert.id, { active: false, modified: now } );
				delete this.activeAlerts[key];
				alerts_changed = true;
			}
		}
		
		if (alerts_changed) {
			this.doUserBroadcastAll('update', { activeAlerts: this.activeAlerts });
		}
	}
	
	handleQuickMonData(socket, data) {
		// process quick (every second) data sent from one server
		var self = this;
		var server = socket.server;
		var mon_defs = this.config.get('quick_monitors');
		var list_max = this.config.get('quick_max') || 60;
		var stub = {
			date: Tools.timeNow(true)
		};
		
		mon_defs.forEach( function(def) {
			var value = Tools.getPath( data, def.source ) || 0;
			if (def.type == 'float') value = Tools.shortFloat(value);
			else value = Math.floor(value);
			stub[ def.id ] = value;
		} );
		
		if (!this.quickMonCache[server.id]) this.quickMonCache[server.id] = [];
		var list = this.quickMonCache[server.id];
		
		// due to clock differences, we must insure that 1+ seconds have passed, otherwise skip sample
		if (list.length && (list[list.length - 1].date == stub.date)) {
			stub.date++;
		}
		if (list.length && (list[list.length - 1].date > stub.date)) {
			this.logDebug(9, "Dropping QuickMon sample due to clock conflict", { last: list[list.length - 1].date, current: stub.date });
			return;
		}
		
		// ok to proceed
		list.push( stub );
		if (list.length > list_max) list.shift();
		
		this.doPageBroadcast('Dashboard', 'quickmon', { id: server.id, row: stub });
		this.doPageBroadcast('Servers?id=' + server.id, 'quickmon', { id: server.id, row: stub, data: data });
		
		server.groups.forEach( function(group_id) {
			self.doPageBroadcast('Groups?id=' + group_id, 'quickmon', { id: server.id, row: stub });
		});
	}
	
	evalExpr(exp) {
		// evaluate math/logic expression safely
		if (!exp.match(/^[\s\d\.\+\-\*\/\%\(\)\&\|\!\=\<\>]+$/)) throw new Error("Illegal characters in expression: " + exp);
		var func = new Function(`return (${exp});`);
		return func();
	}
	
	findPrimaryGroup(grps) {
		// locate group with lowest sort order given array of groups
		var self = this;
		var lowest_sort_order = 999999;
		var best_match = null;
		
		// short-circuit if only 1 group to consider -- fast exit
		if (grps.length == 1) return Tools.findObject( this.groups, { id: grps[0] });
		
		// scan all candidates considering sort_order
		grps.forEach( function(id) {
			var group_def = Tools.findObject( self.groups, { id });
			if (group_def.sort_order < lowest_sort_order) {
				lowest_sort_order = group_def.sort_order;
				best_match = group_def;
			}
		} );
		
		return best_match;
	}
	
}; // class Monitoring

module.exports = Monitoring;
