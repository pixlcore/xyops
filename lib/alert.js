// xyOps Alert Subsystem
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const async = require("async");
const Tools = require("pixl-tools");

class AlertSystem {
	
	logAlert(level, msg, data) {
		// log debug msg with pseudo-component
		if (this.debugLevel(level)) {
			this.logger.set( 'component', 'Alert' );
			this.logger.print({ category: 'debug', code: level, msg: msg, data: data });
		}
	}
	
	getAlertHookArgs(args) {
		// get hook args suitable for alert action (email, web hook, ticket, etc.)
		var self = this;
		var now = Tools.timeNow(true);
		var { params, server, alert_def, global_alert } = args;
		
		// shorten alert_def for convenience in mail/hook templates
		args.def = alert_def;
		
		// add config to args
		args.config = {
			email_from: this.config.get('email_from'),
			client: this.config.get('client')
		};
		
		// add nice date/time
		switch (args.template) {
			case 'alert_new': args.date_time = (new Date( (global_alert.date || now) * 1000 )).toString(); break;
			case 'alert_cleared': args.date_time = (new Date( (global_alert.modified || now) * 1000 )).toString(); break;
		}
		
		// nice group title
		args.nice_groups = (params.groups || []).map( function(group_id) {
			var group_def = Tools.findObject( self.groups, { id: group_id } );
			return group_def ? group_def.title : `(${group_id})`;
		} ).join(', ') || '(None)';
		
		// nice elapsed time, if present
		if (args.elapsed) {
			args.nice_elapsed = Tools.getTextFromSeconds( args.elapsed, false, true );
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
		if (this.config.get('hostname_display_strip')) {
			args.nice_hostname = args.nice_hostname.replace( new RegExp(this.config.get('hostname_display_strip')), '' );
		}
		args.nice_ip = params.ip;
		if (this.config.get('ip_display_strip')) {
			args.nice_ip = args.nice_ip.replace( new RegExp(this.config.get('ip_display_strip')), '' );
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
		
		// add active job info, if available
		args.nice_active_jobs = '';
		if (args.active_jobs && args.active_jobs.length) {
			args.active_jobs.forEach( function(stub) {
				var event_def = Tools.findObject( self.events, { id: stub.event || '_NOPE_' } ) || { title: 'n/a' };
				var job_url = self.config.get('base_app_url') + '/#Job?id=' + stub.id;
				args.nice_active_jobs += `- [Job #${stub.id}](${job_url}) (${event_def.title})\n`;
			} );
		}
		else if (global_alert.jobs && global_alert.jobs.length) {
			global_alert.jobs.forEach( function(job_id) {
				var job_url = self.config.get('base_app_url') + '/#Job?id=' + job_id;
				args.nice_active_jobs += `- [Job #${job_id}](${job_url})\n`;
			} );
		}
		else args.nice_active_jobs = '(None)';
		
		// construct URLs to views of server
		args.links = {
			server_url: this.config.get('base_app_url') + '/#Server?id=' + server.id,
			alert_url: this.config.get('base_app_url') + '/#Alerts?id=' + global_alert.id
		};
		
		// construct text message using hook_text_templates
		var text_templates = this.config.get('hook_text_templates');
		var text_template = text_templates[ args.template ];
		args.text = args.content = args.message = this.messageSub( text_template, args, "n/a" );
		
		return args;
	}
	
	sendAlertNotification(args) {
		// send email and/or web hooks for alert (new or clear)
		// args: { template, alert_def, params, server, global_alert, elapsed? }
		var self = this;
		var { params, server, alert_def, global_alert, template:condition } = args;
		
		// get hook args (merges into args)
		this.getAlertHookArgs(args);
		
		// include alert as alias to global_alert (used by email templates)
		args.alert = global_alert;
		
		// compile list of actions to perform
		var actions = [];
		(alert_def.actions || []).forEach( function(action) {
			if (!action.enabled || (action.condition != condition)) return;
			actions.push( Tools.copyHash(action, true) );
		} );
		
		// server groups can add alert actions
		(params.groups || []).forEach( function(group_id) {
			var group_def = Tools.findObject( self.groups, { id: group_id } );
			if (!group_def) return; // skip if deleted
			
			(group_def.alert_actions || []).forEach( function(action) {
				if (!action.enabled || (action.condition != condition)) return;
				actions.push( Tools.mergeHashes( Tools.copyHash(action, true), { source: 'group' } ) );
			} );
		} );
		
		// append universal alert actions
		(this.config.get('alert_universal_actions') || []).forEach( function(action) {
			if (!action.enabled || (action.condition != condition)) return;
			actions.push( Tools.mergeHashes( Tools.copyHash(action, true), { source: 'universal' } ) );
		} );
		
		if (!actions.length) {
			// no enabled actions!
			this.logAlert(8, "No actions for alert condition: " + condition, { alert: global_alert.id });
			return;
		}
		
		// dedupe actions
		var temp_state = {};
		actions = actions.filter( function(action) {
			var key = action.type + '-';
			switch (action.type) {
				case 'email': 
					key += action.email; 
					if (action.users) key += action.users.join(',');
				break;
				case 'web_hook': key += action.web_hook; break;
				case 'run_event': key += action.event_id; break;
				case 'channel': key += action.channel_id; break;
				case 'plugin': key += action.plugin_id; break;
			}
			if (key in temp_state) return false; // dupe
			temp_state[key] = 1;
			return true;
		} );
		
		// run actions in parallel
		this.logAlert(8, `Running ${actions.length} alert actions for condition: ${condition}`, { alert: global_alert.id, actions });
		
		async.each( actions,
			function(action, callback) {
				var func = 'runAlertAction_' + action.type;
				action.date = Tools.timeNow();
				action.elapsed_ms = 0;
				var perf_start = performance.now();
				
				if (self[func]) self[func](action, args, function() {
					// back from actiom handler
					action.elapsed_ms = Math.floor( performance.now() - perf_start ); // this is milliseconds
					if (action.code) self.logError( action.type, action.description, { alert: global_alert.id } );
					else self.logAlert( 8, action.type + ": " + action.description, { alert: global_alert.id } );
					
					callback();
				});
				else callback();
			},
			function() {
				// store all actions (w/results) in alert, append if necessary
				self.unbase.update( 'alerts', global_alert.id, function(alert) {
					if (!alert.actions) alert.actions = [];
					alert.actions = alert.actions.concat( actions );
					return { actions: alert.actions };
				},
				function(err) {
					if (err) self.logError('unbase', "Failed to update alert: " + global_alert.id + ": " + err);
					else self.logAlert(6, "Alert notifications complete", { alert: global_alert.id } );
					// all done!
				}); // unbase.update
			}
		); // async.each
	}
	
	runAlertAction_email(action, args, callback) {
		// send email for alert action
		var self = this;
		var { params, server, alert_def, global_alert, template:condition } = args;
		if (!callback) callback = noop;
		
		// load users for action
		this.loadMultipleUsers( action.users, function(err, users) {
			// prepare recipient list
			var recips = users.map( function(user) { return user.email; } );
			if (action.email) recips.push( action.email );
			
			if (!recips.length) {
				action.code = 0;
				action.description = "No recipients for email (skipping)";
				return callback();
			}
			
			var email_to = recips.join(', ');
			self.logAlert(6, "Sending email notification for alert: " + email_to);
			
			// send it
			self.sendFancyMail( args.template, { ...args, email_to }, function(err, raw_email, log) {
				if (err) {
					action.code = 'email';
					action.description = "Failed to send e-mail: " + email_to + ": " + err;
				}
				else {
					action.code = 0;
					action.description = "Email sent successfully to: " + email_to;
				}
				action.details = "";
				
				// include pixl-mail debug capture
				if (log && log.length) {
					action.details += "**Mailer Debug Log:**\n\n```text\n";
					
					log.forEach( function(row) {
						var [ msg, args ] = row;
						if (args.tnx === 'message') return; // skip message body (logged above anyway)
						else if (args.tnx === 'client') {
							action.details += msg.trim().split(/\r?\n/).map( function(line) { return '> ' + line; } ).join("\n") + "\n";
						}
						else if (args.tnx === 'server') {
							action.details += msg.trim().split(/\r?\n/).map( function(line) { return '< ' + line; } ).join("\n") + "\n";
						}
						else {
							action.details += msg.trim() + "\n";
						}
					} );
					
					action.details += "```\n";
				}
				
				callback();
			} ); // sendFancyMail
		} ); // loadMultipleUsers
	}
	
	runAlertAction_web_hook(action, args, callback) {
		// run web hook for alert action
		var self = this;
		var { params, server, alert_def, global_alert, template:condition } = args;
		var alert_web_hook = action.web_hook;
		if (!callback) callback = noop;
		
		this.logAlert(9, "Firing web hook for alert: " + global_alert.id + ": " + alert_web_hook);
		
		// allow action to append to the text param
		if (action.text) {
			args.text += " " + action.text.trim();
			args.content = args.message = args.text;
		}
		
		this.fireWebHook(alert_web_hook, args, function(err, result) {
			// log response
			var { resp, data, perf, url, opts, code, description, details } = result;
			
			action.code = code;
			action.description = description;
			action.details = details;
			
			callback();
		});
	}
	
	runAlertAction_channel(action, args, callback) {
		// activate notification channel for action
		var self = this;
		if (!callback) callback = noop;
		
		var channel = Tools.findObject( this.channels, { id: action.channel_id } );
		if (!channel) {
			action.code = 'channel';
			action.description = "Notification Channel not found: " + action.channel_id;
			return callback();
		}
		if (!channel.enabled) {
			action.code = 'channel';
			action.description = "Notification Channel is disabled: " + action.channel_id;
			return callback();
		}
		
		// antiflood
		if (channel.max_per_day && (this.getDailyCustomStat(`channels.${channel.id}.invocations`) >= channel.max_per_day)) {
			action.code = 'channel';
			action.description = `Notification Channel has reached maximum daily limit: ${channel.id} (${channel.max_per_day}/day)`;
			return callback();
		}
		
		this.updateDailyCustomStat(`channels.${channel.id}.invocations`, 1);
		this.logAlert(6, "Notifying channel for action: " + action.condition + ": " + channel.title, channel);
		
		action.code = 0;
		action.description = "Successfully notified channel: " + action.channel_id;
		action.details = "";
		
		async.parallel(
			[
				function(callback) {
					// email
					if (!channel.users.length && !channel.email) return callback();
					var sub_action = Tools.mergeHashes(action, { type: 'email', users: channel.users, email: channel.email });
					
					self.runAlertAction_email(sub_action, args, function() {
						if (sub_action.code) {
							action.code = sub_action.code;
							action.description = sub_action.description;
						}
						sub_action.details = "**Result:** " + sub_action.description + "\n\n" + (sub_action.details || '');
						if (sub_action.details) {
							if (action.details) action.details += "\n";
							action.details += "### Email Details:\n\n" + sub_action.details.trim() + "\n";
						}
						callback();
					});
				},
				function(callback) {
					// web hook
					if (!channel.web_hook) return callback();
					var sub_action = Tools.mergeHashes(action, { type: 'web_hook', web_hook: channel.web_hook });
					
					self.runAlertAction_web_hook(sub_action, args, function() {
						if (sub_action.code) {
							action.code = sub_action.code;
							action.description = sub_action.description;
						}
						sub_action.details = "**Result:** " + sub_action.description + "\n\n" + (sub_action.details || '');
						if (sub_action.details) {
							if (action.details) action.details += "\n";
							action.details += "### Web Hook Details:\n\n" + sub_action.details.trim() + "\n";
						}
						callback();
					});
				},
				function(callback) {
					// run event
					if (!channel.run_event) return callback();
					var sub_action = Tools.mergeHashes(action, { type: 'run_event', event_id: channel.run_event });
					
					self.runAlertAction_run_event(sub_action, args, function() {
						if (sub_action.code) {
							action.code = sub_action.code;
							action.description = sub_action.description;
						}
						sub_action.details = "**Result:** " + sub_action.description + "\n\n" + (sub_action.details || '');
						if (sub_action.details) {
							if (action.details) action.details += "\n";
							action.details += "### Event Details:\n\n" + sub_action.details.trim() + "\n";
						}
						callback();
					});
				},
				function(callback) {
					// send notification to specific users
					if (!channel.users || !channel.users.length) return callback();
					
					var text = args.text.replace(/https?\:\/\/\S+/ig, '').replace(/\:\s*$/, '').replace(/^xyOps\s+/, '');
					
					self.logAlert(9, "Sending notification to users for " + action.condition, channel.users);
					
					channel.users.forEach( function(username) {
						self.doUserBroadcast(username, 'notify', {
							type: 'channel',
							channel: channel.id,
							message: text,
							sound: channel.sound || null,
							loc: '#Alerts?id=' + global_alert.id
						});
					} ); // foreach user
					
					callback();
				}
			],
			callback
		); // async.parallel
	}
	
	runAlertAction_run_event(action, args, callback) {
		// launch event for alert action
		var self = this;
		var { params, server, alert_def, global_alert, template:condition } = args;
		if (!callback) callback = noop;
		
		var event = Tools.findObject( this.events, { id: action.event_id } );
		if (!event) {
			action.code = 'event';
			action.description = "Event not found: " + action.event_id;
			return callback();
		}
		
		var new_job = Tools.copyHash(event, true);
		new_job.source = 'alert';
		new_job.input = {
			data: {
				condition,
				alert: { ...global_alert, title: alert_def.title }
			},
			files: []
		};
		
		this.logAlert(6, "Running event for alert: " + alert_def.title + ": " + event.title, new_job);
		
		this.launchJob(new_job, function(err, id) {
			if (err) {
				action.code = 'event';
				action.description = "Failed to launch event: " + (err.message || err);
				return callback();
			}
			
			action.code = 0;
			action.description = "Successfully launched job: " + id;
			action.loc = '#Job?id=' + id;
			
			callback();
		});
	}
	
	runAlertAction_snapshot(action, args, callback) {
		// take a snapshot of the server for action
		var self = this;
		var { params, server, alert_def, global_alert, template:condition } = args;
		if (!callback) callback = noop;
		
		this.logAlert(6, "Taking snapshot of server: " + server.id);
		
		this.saveSnapshot( server, { ...params, source: 'alert' }, function(err, id) {
			if (err) {
				action.code = 'snapshot';
				action.description = "Failed to take snapshot: " + err;
			}
			else {
				action.code = 0;
				action.description = "Succesfully took snapshot of server: " + args.server.id;
				action.loc = '#Snapshots?id=' + id;
			}
			callback();
		});
	}
	
	runAlertAction_plugin(action, args, callback) {
		// launch plugin for alert action
		var self = this;
		var { params, server, alert_def, global_alert, template:condition } = args;
		var plugin_dir = Path.join( this.config.get('temp_dir'), 'plugins' );
		if (!callback) callback = noop;
		
		var plugin = Tools.findObject( this.plugins, { id: action.plugin_id, type: 'action' } );
		if (!plugin) {
			action.code = 'plugin';
			action.description = "Plugin not found: " + action.plugin_id;
			return callback();
		}
		if (!plugin.enabled) {
			action.code = 'plugin';
			action.description = "Plugin is disabled: " + action.plugin_id;
			return callback();
		}
		
		var hook_args = { xyops: true, condition, ...args };
		hook_args.params = action.params;
		
		var child_cmd = plugin.command;
		if (plugin.script) child_cmd += ' ' + Path.resolve( Path.join( plugin_dir, plugin.id + '.bin' ) );
		
		// grab secrets needed by plugin
		var sec = this.getSecretsForType('plugins', plugin.id);
		
		var child_opts = {
			cwd: plugin.cwd || os.tmpdir(),
			env: Object.assign( {}, this.cleanEnv(), sec ),
			timeout: (plugin.timeout || 60) * 1000
		};
		
		child_opts.env['XYOPS'] = this.server.__version;
		
		// add plugin params as env vars, expand $INLINE vars
		if (action.params) {
			for (var key in action.params) {
				child_opts.env[ key.toUpperCase() ] = 
					(''+action.params[key]).replace(/\$(\w+)/g, function(m_all, m_g1) {
					return (m_g1 in child_opts.env) ? child_opts.env[m_g1] : '';
				});
			}
		}
		
		if (plugin.uid && (plugin.uid != 0)) {
			var user_info = Tools.getpwnam( plugin.uid, true );
			if (user_info) {
				child_opts.uid = parseInt( user_info.uid );
				child_opts.gid = parseInt( user_info.gid );
				child_opts.env.USER = child_opts.env.USERNAME = user_info.username;
				child_opts.env.HOME = user_info.dir;
				child_opts.env.SHELL = user_info.shell;
			}
			else {
				action.code = 'plugin';
				action.description = "Could not determine user information for: " + plugin.uid;
				return callback();
			}
		}
		if (plugin.gid && (plugin.gid != 0)) {
			var grp_info = Tools.getgrnam( plugin.gid, true );
			if (grp_info) {
				child_opts.gid = grp_info.gid;
			}
			else {
				action.code = 'plugin';
				action.description = "Could not determine group information for: " + plugin.gid;
				return callback();
			}
		}
		
		this.logAction(9, "Firing action Plugin for " + action.condition + ": " + plugin.id + ": " + child_cmd);
		
		var child = cp.exec( child_cmd, child_opts, function(err, stdout, stderr) {
			// parse json if output looks like json
			var json = null;
			if (!err && stdout.trim().match(/^\{.+\}$/)) {
				try { json = JSON.parse(stdout); }
				catch (e) {
					err = new Error("JSON Parse Error: " + (e.message || e));
					err.code = 'json';
				}
			}
			
			action.details = "";
			action.details += "### Plugin Details:\n\n";
			action.details += "- **Plugin ID:** `" + plugin.id + "`\n";
			action.details += "- **Plugin Title:** " + plugin.title + "\n";
			// action.details += "- **Command:** `" + child_cmd + "`\n";
			action.details += "- **Result:** " + (err || "Success") + "\n";
			
			if (err) {
				self.logAction(9, "Action Plugin Error: " + child_cmd + ": " + err);
				action.code = 'plugin';
				action.description = "" + err;
				action.details += "- **Exit Code:** " + (err.code || 'n/a') + "\n";
				action.details += "- **Signal:** " + (err.signal || 'n/a') + "\n";
			}
			else {
				self.logAction(9, "Action Plugin Completed", { child_cmd, stdout, stderr } );
				action.code = 0;
				action.description = "Successfully ran Action Plugin";
			}
			
			if (json && json.xy) {
				if (json.code) action.code = json.code;
				if (json.description) action.description = '' + json.description;
				if (json.details) action.details += "\n" + json.details.toString().trim() + "\n";
			}
			else if (stdout.match(/\S/)) {
				action.details += "\n### Plugin Output:\n\n```text\n" + (stdout.trim() || "(Empty)") + "\n```\n";
			}
			
			if (stderr.match(/\S/)) {
				action.details += "\n### Plugin STDERR:\n\n```text\n" + (stderr.trim() || "(Empty)") + "\n```\n";
			}
			
			callback();
		} ); // cp.exec
		
		// Write hook data to child's stdin
		child.stdin.on('error', noop);
		child.stdin.write( JSON.stringify(hook_args) + "\n" );
		child.stdin.end();
	}
	
	runAlertAction_ticket(action, args, callback) {
		// create ticket for alert action
		// action: { ticket_type, ticket_assignees, ticket_tags }
		var self = this;
		var { params, server, alert_def, global_alert, template:condition } = args;
		if (!callback) callback = noop;
		
		this.logAlert(6, "Creating ticket for alert action: " + condition, action);
		
		var ticket = {
			subject: '',
			template: 'alert', // generate ticket body from template
			alert: global_alert.id,
			type: action.ticket_type,
			status: 'open',
			category: '',
			assignees: action.ticket_assignees,
			cc: [],
			notify: [],
			events: [],
			tags: action.ticket_tags,
			due: '',
			server: global_alert.server || ''
		};
		
		ticket.id = Tools.generateShortID('t');
		ticket.num = this.getState('next_ticket_num') || 1;
		ticket.created = ticket.modified = Tools.timeNow(true);
		ticket.username = 'system';
		
		// create first change
		ticket.changes = [{
			type: 'change',
			username: 'system',
			date: ticket.created,
			key: 'created'
		}];
		
		// pass along active_jobs for macro expansion
		ticket.active_jobs = args.active_jobs;
		
		// generate body (and subject)
		this.generateTicketBody_alert(ticket, function(err) {
			delete ticket.active_jobs;
			
			if (err) {
				action.code = 'ticket';
				action.description = "Could not generate ticket body: " + err;
				return callback();
			}
			
			// insert ticket to db
			self.unbase.insert( { index: 'tickets', id: ticket.id, data: ticket, fast: true }, function(err) {
				// record is partially indexed
				if (err) {
					action.code = 'ticket';
					action.description = "Could not insert ticket: " + err;
					return callback();
				}
				
				action.code = 0;
				action.description = "Successfully created ticket: #" + ticket.num + ' (' + ticket.id + ')';
				action.loc = '#' + ticket.num;
				
				self.logAlert(6, "Successfully created ticket: " + ticket.id, ticket);
				self.logTransaction('ticket_create', ticket.id, { 
					username: 'system',
					ticket: Tools.copyHashRemoveKeys(ticket, { changes: 1 }), 
					keywords: [ ticket.id ] 
				});
				
				// advance ticket number counter
				self.putState('next_ticket_num', ticket.num + 1);
				
				// scan for user triggers (search alerts)
				if (ticket.status != 'draft') self.processTicketChange(ticket.id, ticket.changes);
				
				// update alert db with new ticket id
				self.unbase.update( 'alerts', global_alert.id, function(alert) {
					if (!alert.tickets) alert.tickets = [];
					alert.tickets.push( ticket.id );
					
					self.logDebug(5, "Updating alert tickets: " + alert.id, { tickets: alert.tickets });
					return { tickets: alert.tickets };
				}, 
				function(err, alert) {
					// done with update (and unlocked)
					if (err) {
						// should never happen, just log it
						self.logError('unbase', "Failed to update alert invocation: " + global_alert.id + ": " + err);
					}
					
					callback();
				} ); // unbase.update
			} ); // unbase.insert
		}); // generateTicketBody_alert
	}
	
}; // class AlertSystem

module.exports = AlertSystem;
