// Orchestra Multi-Master Action Layer
// Copyright (c) 2022 - 2024 Joseph Huckaby

const fs = require('fs');
const Path = require('path');
const cp = require('child_process');
const os = require('os');
const async = require('async');
const WebSocket = require('ws');
const Tools = require('pixl-tools');
const PixlMail = require('pixl-mail');
const noop = function() {};

class Actions {
	
	runJobActions(job, triggers, callback) {
		// fire a set of job actions that match a trigger id or ids
		var self = this;
		var final_actions = [];
		if (!callback) callback = noop;
		if (typeof(triggers) == 'string') triggers = [triggers];
		
		triggers.forEach( function(trigger) {
			self.logDebug(8, "Running job actions for trigger: " + trigger, { job_id: job.id });
			
			var actions = Tools.findObjects( job.actions || [], { trigger, enabled: true } );
			if (actions.length) {
				self.logDebug(9, "Found " + actions.length + " actions for " + trigger, actions);
				final_actions = final_actions.concat(actions);
			}
			
			// fire universal system hooks matching trigger (with `job_` prefix)
			// these happen in the background
			var hook_data = self.getJobHookData(job, { trigger });
			self.fireSystemHook('job_' + trigger, hook_data);
			self.updateDailyStat( 'job_' + trigger, 1 );
			if (job.server) self.updateDailyServerStat( job.server, 'job_' + trigger, 1 );
		}); // foreach trigger
		
		// dedupe actions
		var temp_state = {};
		final_actions = final_actions.filter( function(action) {
			var key = action.type + '-';
			switch (action.type) {
				case 'email': key += action.email; break;
				case 'web_hook': key += action.web_hook; break;
				case 'run_event': key += action.event_id; break;
				case 'channel': key += action.channel_id; break;
				case 'disable': break;
				case 'snapshot': break;
			}
			if (key in temp_state) return false; // dupe
			temp_state[key] = 1;
			return true;
		} );
		
		// run actions in parallel
		async.each( final_actions,
			function(action, callback) {
				self.runJobAction(job, action, callback);
			},
			callback
		); // async.each
	}
	
	runJobAction(job, action, callback) {
		// execute job action
		var self = this;
		if (!callback) callback = noop;
		this.logDebug(8, "Executing job action", { action, job_id: job.id });
		
		// log action to job meta/activity
		this.appendMetaLog(job, "Executing job " + action.trigger + " action: " + action.type);
		
		// track performance per action
		action.date = Tools.timeNow();
		action.elapsed = 0;
		var perf_start = performance.now();
		
		// run it
		var func = 'runJobAction_' + action.type;
		if (!this[func]) {
			// should never happen
			action.code = 'type';
			action.description = "Unknown action type: " + action.type;
			this.logError('action', action.description, { action, job_id: job.id });
			return callback();
		}
		
		this[func](job, action, function() {
			action.elapsed_ms = Math.floor( performance.now() - perf_start ); // this is milliseconds
			if (action.code) self.logError( action.type, action.description, { job: job.id } );
			else self.logDebug( 8, action.type + ": " + action.description, { job: job.id } );
			callback();
		});
	}
	
	runJobAction_email(job, action, callback) {
		// send email for job action
		var self = this;
		if (!callback) callback = noop;
		
		var mail_args = this.getJobHookData(job, action);
		mail_args.config = this.config.get();
		mail_args.display.date_time = (new Date()).toString();
		
		this.appendMetaLog(job, "Sending email notification to: " + action.email);
		
		// prep email template
		var template_file = '';
		if (action.trigger == 'start') template_file = 'conf/emails/job_start.txt';
		else if (!job.code) template_file = 'conf/emails/job_success.txt';
		else template_file = 'conf/emails/job_fail.txt';
		
		// load users for action
		this.loadMultipleUsers( action.users, function(err, users) {
			// prepare recipient list
			var recips = users.map( function(user) { return user.email; } );
			if (action.email) recips.push( action.email );
			mail_args.email_to = recips.join(', ');
			
			// now load the job log excerpt
			self.getJobLogExcerpt( job, function(err, excerpt) {
				mail_args.log_excerpt = excerpt || 'n/a';
				
				// load template file ourselves, so we can use new Tools.sub() with fallback 'n/a` text
				fs.readFile( template_file, '', function(err, template_text) {
					if (err) {
						action.code = 'email';
						action.description = "Failed to load email template: " + template_file + ": " + err;
						return callback();
					}
					
					// substitute macros with `n/a` fallback
					var mail_text = Tools.sub( template_text, mail_args, false, 'n/a', function(value) {
						if ((typeof(value) == 'string') && (value.length == 0)) return 'n/a';
						else return value;
					} );
					action.details = "";
					
					// construct mailer
					var mail = new PixlMail();
					mail.setOptions( self.config.get('mail_settings') || {} );
					mail.attachLogAgent( self.logger );
					
					// send it
					mail.send( mail_text, function(err, body, log) {
						if (err) {
							action.code = 'email';
							action.description = "Failed to send e-mail: " + action.email + ": " + err;
						}
						else {
							action.code = 0;
							action.description = "Email sent successfully to: " + action.email;
						}
						
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
						
						if (action.details) action.details += "\n";
						action.details += "**Message Content:**\n\n```text\n" + mail_text.trim() + "\n```\n";
						
						callback();
					} ); // mail.send
				}); // fs.readFile
			}); // getJobLogExcerpt
		}); // loadMultipleUsers
	}
	
	runJobAction_web_hook(job, action, callback) {
		// fire off web hook for action
		var self = this;
		if (!callback) callback = noop;
		
		var hook_data = this.getJobHookData(job, action);
		this.appendMetaLog(job, "Firing web hook: " + action.web_hook);
		this.logDebug(9, "Firing job web hook for " + action.trigger + ": " + action.web_hook);
		
		this.fireWebHook(action.web_hook, hook_data, function(err, result) {
			var { resp, data, perf, url, opts, code, description, details } = result;
			
			action.code = code;
			action.description = description;
			action.details = details;
			
			callback();
		}); // fireWebHook
	}
	
	runJobAction_run_event(job, action, callback) {
		// run event for action
		var self = this;
		if (!callback) callback = noop;
		
		var event = Tools.findObject( this.events, { id: action.event_id } );
		if (!event) {
			action.code = 'event';
			action.description = "Event not found: " + action.event_id;
			return callback();
		}
		var new_job = Tools.copyHash(event, true);
		
		// set new job source and parent
		new_job.source = 'action';
		new_job.parent = job.id;
		new_job.input = {
			data: job.data || {},
			files: job.files || []
		};
		
		// allow action to specify event param overrides
		if (action.params) {
			if (!new_job.params) new_job.params = {};
			Tools.mergeHashInto(new_job.params, action.params);
		}
		
		this.appendMetaLog(job, "Running custom event: " + event.title);
		this.logDebug(6, "Running event for action: " + action.trigger + ": " + event.title, new_job);
		
		this.launchJob(new_job, function(err, id) {
			if (err) {
				action.code = 'event';
				action.description = "Failed to launch event: " + (err.message || err);
				return callback();
			}
			
			action.code = 0;
			action.description = "Successfully launched job: " + id;
			action.loc = '#Job?id=' + id;
			
			// populate jobs array in current job
			if (!job.jobs) job.jobs = [];
			job.jobs.push({ id, reason: 'action' });
			
			callback();
		});
	}
	
	runJobAction_channel(job, action, callback) {
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
		
		this.appendMetaLog(job, "Notifying channel: " + channel.title);
		this.logDebug(6, "Notifying channel for action: " + action.trigger + ": " + channel.title, channel);
		
		action.code = 0;
		action.description = "Successfully notified channel: " + action.channel_id;
		action.details = "";
		
		async.parallel(
			[
				function(callback) {
					// email
					if (!channel.users.length && !channel.email) return callback();
					var sub_action = Tools.mergeHashes(action, { type: 'email', users: channel.users, email: channel.email });
					
					self.runJobAction_email(job, sub_action, function() {
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
					
					self.runJobAction_web_hook(job, sub_action, function() {
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
					
					self.runJobAction_run_event(job, sub_action, function() {
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
					// shell exec
					if (!channel.shell_exec) return callback();
					
					var hook_data = self.getJobHookData(job, action);
					var cmd = Tools.sub( channel.shell_exec, hook_data );
					
					// self.appendMetaLog(job, "Running custom shell command: " + cmd);
					self.logDebug(9, "Firing system shell hook for " + action.trigger + ": " + cmd);
					
					cp.exec( cmd, { cwd: os.tmpdir(), timeout: 60 * 1000 }, function(err, stdout, stderr) {
						if (action.details) action.details += "\n";
						action.details += "### Shell Exec Details:\n\n";
						action.details += "- **Command:** `" + cmd + "`\n";
						action.details += "- **Result:** " + (err || "Success") + "\n";
						
						if (err) {
							self.logDebug(9, "Shell Hook Error: " + cmd + ": " + err);
							action.code = 'exec';
							action.description = "" + err;
							action.details += "- **Exit Code:** " + err.code + "\n";
							action.details += "- **Signal:** " + (err.signal || 'n/a') + "\n";
						}
						else self.logDebug(9, "Shell Hook Completed", { cmd, stdout, stderr } );
						
						action.details += "\n**STDOUT:**\n\n```\n" + (stdout.trim() || "(Empty)") + "\n```\n";
						action.details += "\n**STDERR:**\n\n```\n" + (stderr.trim() || "(Empty)") + "\n```\n";
						
						callback();
					} );
				},
				function(callback) {
					// send notification to specific users
					if (!channel.users || !channel.users.length) return callback();
					
					var hook_data = self.getJobHookData(job, action);
					var text = hook_data.text.replace(/https?\:\/\/\S+/ig, '').replace(/\:\s*$/, '').replace(/^Orchestra\s+/, '');
					
					self.logDebug(9, "Sending notification to users for " + action.trigger, channel.users);
					
					channel.users.forEach( function(username) {
						self.doUserBroadcast(username, 'notify', {
							type: 'channel',
							channel: channel.id,
							message: text,
							sound: channel.sound || null,
							loc: '#Job?id=' + job.id
						});
					} ); // foreach user
					
					callback();
				}
			],
			callback
		); // async.parallel
	}
	
	runJobAction_disable(job, action, callback) {
		// disable the event for action
		if (!callback) callback = noop;
		
		this.appendMetaLog(job, "Disabling event for action");
		if (!job.update_event) job.update_event = {};
		job.update_event.enabled = false;
		
		action.code = 0;
		action.description = "Successfully disabled event.";
		action.loc = '#Events?id=' + job.event;
		callback();
	}
	
	runJobAction_delete(job, action, callback) {
		// delete the event for action
		if (!callback) callback = noop;
		
		this.appendMetaLog(job, "Deleting event for action");
		if (!job.delete_event) job.delete_event = true;
		
		action.code = 0;
		action.description = "Successfully deleted event.";
		callback();
	}
	
	runJobAction_snapshot(job, action, callback) {
		// take a snapshot of the server for action
		var self = this;
		if (!callback) callback = noop;
		
		if (!job.server) {
			action.code = 'snapshot';
			action.description = "Failed to take snapshot: No server selected for job.";
			return callback();
		}
		
		this.appendMetaLog(job, "Taking snapshot of server: " + job.server);
		
		this.createSnapshot(job.server, { source: 'job' }, function(err, id) {
			if (err) {
				action.code = 'snapshot';
				action.description = "Failed to take snapshot: " + err;
			}
			else {
				action.code = 0;
				action.description = "Succesfully took snapshot of server: " + job.server;
				action.loc = '#Snapshots?id=' + id;
			}
			callback();
		});
	}
	
	runJobAction_plugin(job, action, callback) {
		// run custom plugin for the action
		var self = this;
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
		
		var hook_args = this.getJobHookData(job, action);
		hook_args.orchestra = true;
		hook_args.params = action.params;
		delete hook_args.env; // child process gets this for free
		
		var child_cmd = plugin.command;
		if (plugin.script) child_cmd += ' ' + Path.resolve( Path.join( plugin_dir, plugin.id + '.bin' ) );
		
		var child_opts = {
			cwd: plugin.cwd || os.tmpdir(),
			env: Tools.copyHash( process.env ),
			timeout: (plugin.timeout || 60) * 1000
		};
		
		child_opts.env['ORCHESTRA'] = this.server.__version;
		
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
		
		this.appendMetaLog(job, "Running custom action Plugin: " + plugin.id);
		this.logDebug(9, "Firing action Plugin for " + action.trigger + ": " + plugin.id + ": " + child_cmd);
		
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
				self.logDebug(9, "Action Plugin Error: " + child_cmd + ": " + err);
				action.code = 'plugin';
				action.description = "" + err;
				action.details += "- **Exit Code:** " + (err.code || 'n/a') + "\n";
				action.details += "- **Signal:** " + (err.signal || 'n/a') + "\n";
			}
			else {
				self.logDebug(9, "Action Plugin Completed", { child_cmd, stdout, stderr } );
				action.code = 0;
				action.description = "Successfully ran Action Plugin";
			}
			
			if (json) {
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
	
	getJobHookData(job, action) {
		// return a copy of job object, augmented with all data used in hooks
		var hook_data = {
			env: process.env,
			job: job,
			action: action,
			event: Tools.findObject( this.events, { id: job.event } ) || null,
			plugin: Tools.findObject( this.plugins, { id: job.plugin } ) || null,
			category: Tools.findObject(this.categories, { id: job.category }) || null,
		};
		
		if (job.server && this.servers[job.server]) hook_data.server = this.servers[job.server];
		
		hook_data.links = {
			job_details: this.config.get('base_app_url') + '/#Job?id=' + job.id,
			job_log: this.config.get('base_app_url') + '/api/app/download_job_log?id=' + job.id + '&t=' + Tools.digestBase64( 'download' + job.id + this.config.get('secret_key'), 'sha256', 16 )
		};
		
		hook_data.display = {
			elapsed: Tools.getTextFromSeconds(job.elapsed || 0, false, false),
			log_size: Tools.getTextFromBytes( job.log_file_size || 0 ),
			perf: job.perf || '(No metrics provided)'
		};
		
		// perf may be an object
		if (Tools.isaHash(hook_data.display.perf)) {
			hook_data.display.perf = JSON.stringify(hook_data.display.perf);
		}
		
		// compose nice mem/cpu usage info
		hook_data.display.mem = '(Unknown)';
		if (job.mem && job.mem.count) {
			var mem_avg = Math.floor( job.mem.total / job.mem.count );
			hook_data.display.mem = Tools.getTextFromBytes( mem_avg );
			hook_data.display.mem += ' (Peak: ' + Tools.getTextFromBytes( job.mem.max ) + ')';
		}
		hook_data.display.cpu = '(Unknown)';
		if (job.cpu && job.cpu.count) {
			var cpu_avg = Tools.shortFloat( job.cpu.total / job.cpu.count );
			hook_data.display.cpu = '' + cpu_avg + '%';
			hook_data.display.cpu += ' (Peak: ' + Tools.shortFloat( job.cpu.max ) + '%)';
		}
		
		// generate short description for text property
		var text_templates = this.config.get('hook_text_templates');
		var text_template = text_templates[ 'job_' + action.trigger ];
		if (!text_template && job.code) text_template = text_templates.job_error;
		if (!text_template && !job.code) text_template = text_templates.job_success;
		hook_data.text = hook_data.content = Tools.sub( text_template, hook_data, false, 'n/a' );
		
		return hook_data;
	}
	
	fireSystemHook(action, orig_data) {
		// fire system-level hook for any action, async in background, no callback
		// job actions should be prefixed with job_ (e.g. job_complete)
		// other actions are from API calls (e.g. update_event)
		// logActivity() also calls this
		var self = this;
		var sys_hooks = this.config.get('hooks') || {};
		var hook = sys_hooks[action] || sys_hooks['*'];
		
		if (hook) {
			if ((typeof(hook) == 'string') && hook.match(/^\w+\:\/\/\S+$/)) hook = { url: hook };
			else if ((typeof(hook) == 'string') && hook.match(/^\w+$/)) hook = { web_hook: hook };
			
			var data = Tools.copyHash(orig_data, true);
			data.action = action;
			data.epoch = Tools.timeNow(true);
			
			// compatibility with slack, discord, and other web hooks
			if (!data.text && data.description) data.text = data.description;
			if (!data.content && data.description) data.content = data.description;
			
			if (hook.url) {
				// allow placeholder subs on url (encoded)
				var url = Tools.sub( hook.url, data, false, "", encodeURIComponent );
				
				this.logDebug(9, "Firing system web hook for " + action + ": " + url);
				
				// include web_hook_config_keys if configured
				if (this.config.get('web_hook_config_keys')) {
					var web_hook_config_keys = this.config.get('web_hook_config_keys');
					for (var idy = 0, ley = web_hook_config_keys.length; idy < ley; idy++) {
						var key = web_hook_config_keys[idy];
						data[key] = this.config.get(key);
					}
				}
				
				// include web_hook_custom_data if configured
				if (this.config.get('web_hook_custom_data')) {
					var web_hook_custom_data = this.config.get('web_hook_custom_data');
					for (var key in web_hook_custom_data) data[key] = web_hook_custom_data[key];
				}
				
				// custom http options for web hook
				var hook_opts = this.config.get('web_hook_custom_opts') || {};
				
				this.request.json( url, data, hook_opts, function(err, resp, data) {
					// log response
					if (err) self.logDebug(9, "Web Hook Error: " + url + ": " + err);
					else self.logDebug(9, "Web Hook Response: " + url + ": HTTP " + resp.statusCode + " " + resp.statusMessage);
				} );
			} // web hook
			
			if (hook.web_hook) {
				// fire user-defined web hook
				this.logDebug(9, "Firing web hook for " + action + ": " + hook.web_hook);
				this.fireWebHook(hook.web_hook, data);
			}
			
			if (hook.shell_exec) {
				// allow placeholder subs on command
				var cmd = Tools.sub( hook.shell_exec, data );
				
				this.logDebug(9, "Firing system shell hook for " + action + ": " + cmd);
				cp.exec( cmd, function(err, stdout, stderr) {
					if (err) self.logDebug(9, "Shell Hook Error: " + cmd + ": " + err);
					else self.logDebug(9, "Shell Hook Completed", { cmd, stdout, stderr } );
				} );
			} // command hook
			
			// FUTURE: hook.exec_pipe ?
			
		} // hook
	}
	
	fireWebHook(id, data, callback) {
		// send HTTP request to URL for web hook action
		// callback is passed: (err, {resp, data, perf, url, opts, code, description, details} )
		var self = this;
		var hook = null;
		if (!callback) callback = noop;
		if (!data._fallback) data._fallback = 'N/A';
		
		// locate web_hook object
		if (typeof(id) == 'string') {
			hook = Tools.findObject( this.web_hooks, { id: id } );
			if (!hook) {
				return callback( new Error("Web Hook not found: " + id) );
			}
			if (!hook.enabled) {
				return callback( new Error("Web Hook is disabled: " + id) );
			}
		}
		else if (typeof(id) == 'object') {
			// optionally pass in an object for the hook (test mode)
			hook = id;
		}
		else return callback( new Error("Internal Error: Web Hook is not an ID nor object.") );
		
		// allow placeholder subs on url (encoded)
		var url = Tools.sub( hook.url, data, false, data._fallback, encodeURIComponent );
		
		// custom http options for web hook
		var hook_opts = this.config.get('web_hook_custom_opts') || {};
		
		var opts = Tools.mergeHashes( hook_opts, {
			"method": hook.method,
			"follow": hook.follow ? 32 : false,
			"retries": hook.retries,
			"timeout": hook.timeout * 1000, // TTFB timeout
			"idleTimeout": hook.timeout * 1000, // socket idle timeout
			"headers": {}
		} );
		
		(hook.headers || []).forEach( function(header) {
			opts.headers[ header.name ] = Tools.sub(header.value, data, false, data._fallback);
		} );
		if (!hook.method.match(/^(GET|HEAD)$/) && hook.body.trim().length) {
			opts.data = Buffer.from( Tools.sub(hook.body, data, false, data._fallback) );
		}
		if (hook.ssl_cert_bypass) {
			opts.rejectUnauthorized = false;
		}
		
		this.request.request( url, opts, function(err, resp, data, perf) {
			var code = 0;
			var description = "";
			var details = "";
			
			if (err) {
				code = 'webhook';
				description = "" + err;
			}
			else {
				code = 0;
				description = "Success (HTTP " + resp.statusCode + " " + resp.statusMessage + ")";
			}
			
			details = "";
			details += "- **Method:** " + hook.method + "\n";
			details += "- **URL:** " + url + "\n";
			details += "- **Redirects:** " + (hook.follow ? 'Follow' : 'n/a') + "\n";
			details += "- **Max Retries:** " + (hook.retries || 'None') + "\n";
			details += "- **Timeout:** " + Tools.getTextFromSeconds(hook.timeout, false, false) + "\n";
			
			if (Tools.numKeys(opts.headers)) {
				details += "\n**Request Headers:**\n\n```http\n";
				for (var key in opts.headers) {
					details += key + ": " + opts.headers[key] + "\n";
				}
				details += "```\n";
			}
			
			if (opts.data && opts.data.length) {
				details += "\n**Request Body:**\n\n```\n";
				details += opts.data.toString().trim() + "\n```\n";
			}
			
			if (resp && resp.rawHeaders) {
				details += "\n**Response:** HTTP " + resp.statusCode + " " + resp.statusMessage + "\n";
				details += "\n**Response Headers:**\n\n```http\n";
				
				for (var idx = 0, len = resp.rawHeaders.length; idx < len; idx += 2) {
					details += resp.rawHeaders[idx] + ": " + resp.rawHeaders[idx + 1] + "\n";
				}
				details += "```\n";
				
				if (data && data.length) {
					details += "\n**Response Body:**\n\n```\n";
					details += data.toString().trim() + "\n```\n";
				}
				
				if (perf) details += "\n**Performance Metrics:**\n\n```json\n" + JSON.stringify(perf.metrics(), null, "\t") + "\n```\n";
			}
			
			callback(err, { resp, data, perf, url, opts, code, description, details });
		} );
	}
	
	loadMultipleUsers(usernames, callback) {
		// load multiple users and/or roles for action use
		// DO NOT FAIL if one or more users are nonexistent
		var self = this;
		var records = {};
		
		// create array of paths to user records
		var keys = [];
		for (var idx = 0, len = usernames.length; idx < len; idx++) {
			keys.push( 'users/' + this.usermgr.normalizeUsername(usernames[idx]) );
		}
		
		async.eachLimit(keys, this.storage.concurrency, 
			function(key, callback) {
				// iterator for each key
				self.storage.get(key, function(err, data) {
					if (err) return callback(); // ignore errors
					records[key] = data;
					callback();
				} );
			}, 
			function() {
				// sort records into array of values ordered by keys
				var users = [];
				for (var idx = 0, len = keys.length; idx < len; idx++) {
					users.push( records[keys[idx]] || null );
				}
				
				callback(null, users);
			}
		); // eachLimit
	}
	
}; // class Actions

module.exports = Actions;
