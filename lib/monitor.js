// xyOps Monitoring Layer
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const zlib = require('zlib');
const Path = require('path');
const cp = require('child_process');
const async = require("async");
const Tools = require("pixl-tools");
const jexl = require('jexl');

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
	
	logMonitor(level, msg, data) {
		// log debug msg with pseudo-component
		if (this.debugLevel(level)) {
			this.logger.set( 'component', 'Monitor' );
			this.logger.print({ category: 'debug', code: level, msg: msg, data: data });
		}
	}
	
	setupMonitoring(callback) {
		// setup monitoring system (called when we become master)
		var self = this;
		
		// this.contribCache = {};
		this.quickMonCache = {};
		
		// pre-compile all monitor sources and alert expressions
		this.precompileMonitors();
		
		this.server.on('minute', function(dargs) {
			// self.summarizeMinuteData(dargs);
			
			// broadcast server update to all clients
			self.doUserBroadcastAll('update', { servers: self.servers });
			
			// check for stale alerts
			self.cleanupGlobalAlerts();
		} );
		
		this.server.on('*:30', function(dargs) {
			// run every minute on the :30 sec, check for group watches
			self.checkGroupWatches();
		});
		
		// recover / resume tracking all active alerts
		this.unbase.search( 'alerts', 'active:true', {}, function(err, data) {
			if (err || !data.records || !data.records.length) return callback();
			
			data.records.forEach( function(alert) {
				var global_id = alert.alert + '-' + alert.server;
				self.logMonitor(5, "Resuming tracking active alert: " + global_id, alert);
				self.activeAlerts[ global_id ] = alert;
			} );
			
			callback();
		});
	}
	
	precompileMonitors() {
		// pre-compile all monitor sources and alert expressions
		var self = this;
		var expCache = this.expressionCache = {};
		
		this.monitors.forEach( function(monitor) {
			self.logMonitor(9, "Pre-compiling monitor source expression: " + monitor.id + ": " + monitor.source);
			try { expCache[monitor.id] = jexl.compile( monitor.source ); }
			catch(err) {
				self.logError('monitor', "Failed to pre-compile monitor source: " + monitor.id + ": " + err);
				expCache[monitor.id] = jexl.compile("0"); // default to zero
			}
		} );
		
		this.alerts.forEach( function(alert) {
			self.logMonitor(9, "Pre-compiling alert expression: " + alert.id + ": " + alert.expression);
			try { expCache[alert.id] = jexl.compile( alert.expression ); }
			catch(err) {
				self.logError('alert', "Failed to pre-compile alert expression: " + alert.id + ": " + err);
				expCache[alert.id] = jexl.compile("false"); // default to false
			}
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
			this.logMonitor(7, "Ignoring monitoring data submission due to admin maint jobs in progress", { id: server.id });
			return;
		}
		
		// ignore dupes in same minute for same server
		if (server.last_time_code && (time_code == server.last_time_code)) {
			this.logMonitor(7, "Ignoring dupe monitoring data submission in same minute", { id: server.id });
			return;
		}
		server.last_time_code = time_code;
		
		this.logMonitor(9, "Processing monitoring data submission from: " + server.hostname, { id: server.id } );
		
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
			this.logMonitor(7, "Groups not found: (" + params.groups.join(', ') + "), ignoring server monitor submission from: " + server.id);
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
			
			// evaluate source using params.data as context
			var exp = self.expressionCache[ mon_def.id ];
			var value = 0;
			try { value = exp.evalSync( params.data ); }
			catch (err) {
				self.logMonitor(7, "Monitor expression failed to evaluate: " + mon_def.source + ": " + err, {
					monitor: mon_def,
					hostname: server.hostname,
					server: server.id
				});
				value = 0;
			}
			
			// support custom data_match regexp to extract value out of string
			if (mon_def.data_match) {
				var matches = ('' + value).match( mon_def.data_match );
				if (matches && (matches.length >= 2)) {
					// data_match has a group capture, use first group
					value = matches[1];
				}
				else if (matches) {
					// just grab entire match (no group)
					value = matches[0];
				}
				else {
					self.logMonitor(7, "Custom data regular expression did not match", {
						monitor: mon_def,
						server: server.id,
						hostname: server.hostname,
						raw_value: value
					});
					value = 0;
				}
			} // data_match
			
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
		
		// notifications to send
		var notifications = [];
		
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
							// data[ mon_def.id ] = 0;
							params.data.deltas[ mon_def.id ] = 0;
							return;
						}
						
						var old_value = host_data.data.monitors[ mon_def.id ] || 0;
						var delta = data[ mon_def.id ] - old_value;
						if (!old_value) delta = 0;
						
						if ((mon_def.delta_min_value !== false) && (delta < mon_def.delta_min_value)) {
							delta = mon_def.delta_min_value;
						}
						if (mon_def.divide_by_delta && host_data.date) {
							var elapsed = (params.date - host_data.date) || 1;
							delta /= elapsed;
						}
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
						
						self.logMonitor(9, "Checking alert expression for " + params.hostname + '/' + alert_def.id + ": " + alert_def.expression, {
							alert: alert_def,
							server: server.id,
							hostname: server.hostname,
							expression: alert_def.expression
						});
						
						// evaluate alert expression, default to false
						var exp = self.expressionCache[ alert_def.id ];
						var result = false;
						try { result = exp.evalSync( params.data ); }
						catch (err) {
							self.logMonitor(9, "Alert expression failed to evaluate: " + params.hostname + '/' + alert_def.id + ": " + alert_def.expression, {
								alert: alert_def,
								server: server.id,
								hostname: server.hostname,
								expression: alert_def.expression
							});
							result = false;
						}
						
						if (result) {
							// alert is active (but may need multiple samples before triggering)
							params.alerts[ alert_def.id ] = host_data.alerts[ alert_def.id ] || {
								date: params.date,
								exp: alert_def.expression,
								message: '',
								count: 0,
								notified: false
							};
							
							// recompute message every time, as it may change
							params.alerts[ alert_def.id ].message = self.messageSub( alert_def.message, params.data );
							
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
						if (!alert_def) return; // sanity (alert deleted)
						var global_id = server.id + '-' + alert_def.id;
						
						if ((alert.count == alert_def.samples) && !alert.notified) {
							alert.notified = true;
							
							// track stats
							self.updateDailyStat( 'alert_new' );
							self.updateDailyCustomStat( `servers.${server.id}.alert_new`, 1 );
							
							(server.groups || []).forEach( function(group_id) {
								self.updateDailyCustomStat( `groups.${group_id}.alert_new`, 1 );
							} );
							
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
								var active_jobs = [];
								self.findActiveJobs({ state: 'active', remote: true, server: server.id }).forEach( function(job) {
									active_jobs.push( { id: job.id, event: job.event } );
									
									if (job.workflow && job.workflow.job && !Tools.findObject(active_jobs, { id: job.workflow.job } )) {
										var wf_job = self.activeJobs[job.workflow.job];
										if (wf_job) active_jobs.push( { id: wf_job.id, event: wf_job.event } );
									}
								} );
								
								notifications.push({
									template: "alert_new",
									alert_def: alert_def,
									params: params,
									server: server,
									global_alert: global_alert,
									active_jobs
								});
							} // notifications enabled
							
							// log transaction for alert
							self.logTransaction('alert_new', "New alert for: " + params.hostname + ": " + alert_def.title, { 
								alert: global_alert
							});
							
							// add active jobs to alert
							var jobs = self.findActiveJobs({ state: 'active', remote: true, server: server.id });
							global_alert.jobs = jobs.map( function(job) { return job.id } );
							
							// for workflow sub-jobs, also include the parent workflow jobs in the list
							jobs.forEach( function(job) {
								if (job.workflow && job.workflow.job && !global_alert.jobs.includes(job.workflow.job)) {
									global_alert.jobs.push(job.workflow.job);
								}
							});
							
							// add all ticket ids from relevent jobs into alert
							global_alert.tickets = [];
							global_alert.jobs.forEach( function(job_id) {
								var job = self.activeJobs[job_id];
								if (job && job.tickets && job.tickets.length) global_alert.tickets = global_alert.tickets.concat( job.tickets );
							} );
							
							// insert into db
							// self.unbase.insert( 'alerts', global_alert.id, global_alert );
							db_actions.push({ func: 'insert', args: ['alerts', global_alert.id, global_alert] });
							
							// optionally abort all jobs on server
							if (alert_def.abort_jobs) {
								jobs.forEach( function(job) {
									self.abortJob(job, "Alert Fired: " + alert_def.title);
								} );
							}
						}
						else if (!alert.count && alert.notified) {
							// send cleared notification
							
							// track stats
							self.updateDailyStat( 'alert_cleared' );
							self.updateDailyCustomStat( `servers.${server.id}.alert_cleared`, 1 );
							
							(server.groups || []).forEach( function(group_id) {
								self.updateDailyCustomStat( `groups.${group_id}.alert_cleared`, 1 );
							} );
							
							// Note: global alert may be missing in some cases (i.e. crash recovery)
							var global_alert = self.activeAlerts[ global_id ];
							
							if (global_alert && !group_def.mute_alerts && alert_def.enabled && !alerts_snoozed) {
								notifications.push({
									template: "alert_cleared",
									alert_def: alert_def,
									params: params,
									server: server,
									global_alert: global_alert,
									elapsed: Tools.timeNow(true) - alert.date
								});
							} // alert enabled
							
							self.logTransaction('alert_cleared', "Alert cleared: " + params.hostname + ": " + alert_def.title, { 
								alert: global_alert || alert
							});
							
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
					
					// send all alert notifications after db is updated
					notifications.forEach( function(notification) {
						self.sendAlertNotification(notification);
					} );
					
					// update server cpu/mem data in RAM
					server.info.cpu = params.data.cpu;
					server.info.memory = params.data.memory;
					server.info.process = params.data.process;
					server.info.monitors = params.data.monitors;
					server.info.deltas = params.data.deltas;
					
					// construct "combo" cpu brand / manufacturer / vendor
					server.info.cpu.combo = self.getServerCPUCombo( server.info.cpu );
					
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
					// silence double-submit errors, as they are benign
					if (err.code != 'DOUBLE') self.logError('submit', "Failed to submit data: " + (err.message || err), {});
				}
				else {
					self.logMonitor(6, "Data submission complete for: " + params.hostname, { id: server.id });
				}
				
				// take snapshot if server is being watched
				if (self.state.watches && self.state.watches.servers && self.state.watches.servers[server.id] && (self.state.watches.servers[server.id] >= params.date)) {
					params.source = 'watch';
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
					trans.listCreate( timeline_key, {}, function(err, list) {
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
								self.logMonitor(9, "Double submission in same minute", { server: server.id, epoch, epoch_div, item:update_data });
								
								var err = new Error("Double submission in same minute for server: " + server.id);
								err.code = 'DOUBLE';
								return callback( err );
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
						if (items.length > 1) self.logMonitor(5, "Filling gaps in timeline: " + timeline_key, { len: items.length - 1 });
						
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
		
		this.logMonitor(6, "Taking snapshot of server: " + server_id, params);
		
		this.storage.get( host_key, function(err, data) {
			if (err) return callback(err);
			
			// merge in params
			Tools.mergeHashInto(data, params);
			
			self.saveSnapshot(server, data, function(err, id) {
				if (err) return callback(err);
				
				self.logMonitor(9, "Server snapshot complete: " + server_id, { id });
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
			type: 'server',
			server: server.id,
			groups: server.groups,
			alerts: this.findActiveAlerts({ server: server.id }).map( function(alert) { return alert.id; } ),
			jobs: this.findActiveJobs({ server: server.id }).map( function(job) { return job.id; } ),
			quickmon: this.quickMonCache[server.id] || []
		});
		
		// for workflow sub-jobs, also include the parent workflow job in the list
		snapshot.jobs.forEach( function(id) {
			var job = self.activeJobs[id];
			if (!job) return; // sanity
			
			if (job.workflow && job.workflow.job && !snapshot.jobs.includes(job.workflow.job)) {
				snapshot.jobs.push(job.workflow.job);
			}
		});
		
		this.logMonitor(6, "Saving snapshot of server: " + server.id, { hostname: server.hostname, snapshot_id: snapshot.id });
		
		this.unbase.insert( 'snapshots', snapshot.id, snapshot, function(err) {
			if (err) return callback(err);
			callback(null, snapshot.id);
		} );
	}
	
	createGroupSnapshot(group_id, params, callback) {
		// create group snapshot by loading most recent server data, and merging in custom params (e.g. source)
		// called by api_create_group_snapshot and group watch system
		var self = this;
		var now = Tools.timeNow(true);
		
		var group = Tools.findObject( this.groups, { id: group_id } );
		if (!group) return callback( new Error("Unknown group: " + group_id) );
		
		// gather all active servers for group, and make copies so we can decorate
		var servers = Object.values(this.servers).filter( function(server) {
			// also filter out servers that were JUST added, to avoid possible race condition with getMulti below
			return server.groups.includes(group_id) && ((now - server.modified) > 1);
		} ).map( function(server) {
			return Object.assign( {}, server, { offline: false } );
		} );
		
		// add in recently offline (cached) servers too, also copy and decorate
		servers = servers.concat( Object.values(this.serverCache).filter( function(server) {
			return server.groups.includes(group_id) && !self.servers[server.id] && (server.modified > now - 3600);
		} ).map( function(server) {
			return Object.assign( {}, server, { offline: true } );
		} ) );
		
		// get list of host keys to load quickly
		var host_keys = servers.map( function(server) { return 'hosts/' + server.id + '/data'; } );
		
		this.logMonitor(6, "Taking snapshot of group: " + group_id + " (" + servers.length + " servers)", params);
		
		this.storage.getMulti( host_keys, function(err, values) {
			if (err) return callback(err);
			
			var snapshot = Tools.mergeHashes(params, {
				id: Tools.generateShortID('sn'),
				type: 'group',
				date: now,
				server: '',
				groups: [ group_id ],
				servers: servers,
				snapshots: values,
				group_def: group
			});
			
			// add relevant alerts
			snapshot.alerts = Object.values(self.activeAlerts).filter( function(alert) {
				return alert.groups.includes( group_id );
			} ).map( function(alert) {
				return alert.id;
			} );
			
			// add relevant jobs
			snapshot.jobs = Object.values(self.activeJobs).filter( function(job) {
				return !!Tools.findObject( servers, { id: job.server || '_NOPE_' } );
			} ).map( function(job) {
				return job.id;
			} );
			
			// add quickmon data for all servers
			snapshot.quickmons = servers.map( function(server) {
				return self.quickMonCache[server.id] || [];
			} );
			
			self.logMonitor(7, "Saving snapshot of group: " + group.id, { servers: servers.length, snapshot_id: snapshot.id });
			
			self.unbase.insert( 'snapshots', snapshot.id, snapshot, function(err) {
				if (err) return callback(err);
				callback(null, snapshot.id);
			} );
		} ); // getMulti
	}
	
	checkGroupWatches() {
		// see if any groups need to be watched, runs every minute on the :30 sec
		var self = this;
		var now = Tools.timeNow(true);
		var snap_groups = [];
		
		if (this.state.watches && this.state.watches.groups) {
			for (var group_id in this.state.watches.groups) {
				var expires = this.state.watches.groups[group_id];
				if (now < expires) snap_groups.push(group_id);
			}
		}
		
		if (!snap_groups.length) return;
		
		async.eachSeries( snap_groups,
			function(group_id, callback) {
				self.createGroupSnapshot( group_id, { source: 'watch' }, callback );
			},
			function(err) {
				if (err) self.logError('snapshot', "Failed to watch groups: " + err);
				else self.logMonitor(7, "Group watch snaps complete");
			}
		);
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
			this.logMonitor(9, "Dropping QuickMon sample due to clock conflict", { server: server.id, last: list[list.length - 1].date, current: stub.date });
			return;
		}
		
		// ok to proceed
		list.push( stub );
		if (list.length > list_max) list.shift();
		
		// this.doPageBroadcast('Dashboard', 'quickmon', { id: server.id, row: stub });
		this.doPageBroadcast('Servers?id=' + server.id, 'quickmon', { id: server.id, row: stub, data: data });
		
		server.groups.forEach( function(group_id) {
			self.doPageBroadcast('Groups?id=' + group_id, 'quickmon', { id: server.id, row: stub, data: data });
		});
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
