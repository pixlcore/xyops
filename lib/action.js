// xyOps Action Layer
// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the MIT License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const Path = require('path');
const cp = require('child_process');
const os = require('os');
const async = require('async');
const Tools = require('pixl-tools');
const noop = function() {};

class Actions {
	
	logAction(level, msg, data) {
		// log debug msg with pseudo-component
		if (this.debugLevel(level)) {
			this.logger.set( 'component', 'Action' );
			this.logger.print({ category: 'debug', code: level, msg: msg, data: data });
		}
	}
	
	runJobActions(job, conditions, callback) {
		// fire a set of job actions that match a condition id or ids
		var self = this;
		var final_actions = [];
		if (!callback) callback = noop;
		if (typeof(conditions) == 'string') conditions = [conditions];
		
		conditions.forEach( function(condition) {
			self.logAction(8, "Running job actions for condition: " + condition, { job_id: job.id });
			
			var actions = Tools.findObjects( job.actions || [], { condition, enabled: true } );
			if (actions.length) {
				self.logAction(9, "Found " + actions.length + " actions for " + condition, actions);
				final_actions = final_actions.concat(actions);
			}
			
			// fire universal system hooks matching condition (with `job_` prefix)
			// these happen in the background
			var hook_data = self.getJobHookData(job, { condition });
			self.fireSystemHook('job_' + condition, hook_data);
			
			if (condition.match(/^\w+$/)) {
				// only update stats for standard (alphanumeric) conditions, not `tag:` ones
				self.updateDailyStat( 'job_' + condition, 1 );
				if (job.event) self.updateDailyCustomStat( `events.${job.event}.job_${condition}`, 1 );
				if (job.server) self.updateDailyCustomStat( `servers.${job.server}.job_${condition}`, 1 );
				if (job.category) self.updateDailyCustomStat( `categories.${job.category}.job_${condition}`, 1 );
				if (job.plugin) self.updateDailyCustomStat( `plugins.${job.plugin}.job_${condition}`, 1 );
				
				// also give credit to all groups server is in
				if (job.server && self.servers[job.server] && self.servers[job.server].groups) {
					self.servers[job.server].groups.forEach( function(group_id) {
						self.updateDailyCustomStat( `groups.${group_id}.job_${condition}`, 1 );
					} );
				}
			} // std condition
		}); // foreach condition
		
		// dedupe actions
		var temp_state = {};
		final_actions = final_actions.filter( function(action) {
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
				case 'store': key += action.bucket_id; break;
				case 'fetch': key += action.bucket_id; break;
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
		this.logAction(8, "Executing job action", { action, job_id: job.id });
		
		// log action to job meta/activity
		this.appendMetaLog(job, "Executing job " + action.condition + " action: " + action.type);
		
		// track performance per action
		action.date = Tools.timeNow();
		action.elapsed_ms = 0;
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
		
		// if this is a workflow sub-job, update action node state in parent job
		var wf_node_state = null;
		var wf_conn_state = null;
		
		if (action.id && job.workflow && job.workflow.job) {
			var wf_job = this.activeJobs[ job.workflow.job ];
			if (wf_job && wf_job.workflow && wf_job.workflow.state) {
				if (!wf_job.workflow.state[action.id]) wf_job.workflow.state[action.id] = {};
				wf_node_state = wf_job.workflow.state[action.id];
				wf_node_state.active = true;
				
				if (action.conn) {
					if (!wf_job.workflow.state[action.conn]) wf_job.workflow.state[action.conn] = {};
					wf_conn_state = wf_job.workflow.state[action.conn];
				}
				
				this.logWorkflow(wf_job, action.id, `Executing job #${job.id} ${action.condition} action: ${action.type}`);
			}
		} // workflow
		
		// call the action handler
		this[func](job, action, function() {
			action.elapsed_ms = Math.floor( performance.now() - perf_start ); // this is milliseconds
			if (action.code) self.logError( action.type, action.description, { job: job.id } );
			else self.logAction( 8, action.type + ": " + action.description, { job: job.id } );
			
			// cleanup workflow node state
			if (wf_node_state) {
				Tools.mergeHashInto(wf_node_state, action);
				wf_node_state.active = false;
				wf_node_state.completed = Tools.timeNow();
				if (wf_conn_state) wf_conn_state.completed = Tools.timeNow();
			} // workflow
			
			callback();
		});
	}
	
	runJobAction_email(job, action, callback) {
		// send email for job action
		var self = this;
		if (!callback) callback = noop;
		
		var mail_args = this.getJobHookData(job, action);
		mail_args.display.date_time = (new Date()).toString();
		
		// prep email template
		var template_name = '';
		if (action.condition == 'start') template_name = 'job_start';
		else if (!job.completed) template_name = 'job_progress';
		else if (!job.code) template_name = 'job_success';
		else template_name = 'job_fail';
		
		// load users for action
		this.loadMultipleUsers( action.users, function(err, users) {
			// prepare recipient list
			var recips = users.map( function(user) { return user.email; } );
			if (action.email) recips.push( action.email );
			mail_args.email_to = recips.join(', ');
			
			if (!recips.length) {
				action.code = 0;
				action.description = "No recipients for email (skipping)";
				return callback();
			}
			
			self.appendMetaLog(job, "Sending email notification to: " + mail_args.email_to);
			
			// include the job log excerpt
			mail_args.log_excerpt = Tools.stripANSI( self.jobDetails[job.id].output || 'n/a' );
			mail_args.log_excerpt = mail_args.log_excerpt.replace(/(^|\n)\`\`\`/g, ''); // disallow breaking out of fenced code block
			mail_args.log_excerpt = mail_args.log_excerpt.trim() + "\n";
			
			// send mail
			self.sendFancyMail( template_name, mail_args, function(err, body, log) {
				if (err) {
					action.code = 'email';
					action.description = "Failed to send e-mail: " + mail_args.email_to + ": " + err;
				}
				else {
					action.code = 0;
					action.description = "Email sent successfully to: " + mail_args.email_to;
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
			}); // sendFancyMail
		}); // loadMultipleUsers
	}
	
	runJobAction_web_hook(job, action, callback) {
		// fire off web hook for action
		var self = this;
		if (!callback) callback = noop;
		
		var hook_data = this.getJobHookData(job, action);
		this.appendMetaLog(job, "Firing web hook: " + action.web_hook);
		this.logAction(9, "Firing job web hook for " + action.condition + ": " + action.web_hook);
		
		// allow action to customize the text param
		if (action.text) hook_data.text = action.text;
		
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
		this.logAction(6, "Running event for action: " + action.condition + ": " + event.title, new_job);
		
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
		
		// antiflood
		if (channel.max_per_day && (this.getDailyCustomStat(`channels.${channel.id}.invocations`) >= channel.max_per_day)) {
			action.code = 'channel';
			action.description = `Notification Channel has reached maximum daily limit: ${channel.id} (${channel.max_per_day}/day)`;
			return callback();
		}
		
		this.updateDailyCustomStat(`channels.${channel.id}.invocations`, 1);
		this.appendMetaLog(job, "Notifying channel: " + channel.title);
		this.logAction(6, "Notifying channel for action: " + action.condition + ": " + channel.title, channel);
		
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
					var cmd = self.messageSub( channel.shell_exec, hook_data );
					
					// self.appendMetaLog(job, "Running custom shell command: " + cmd);
					self.logAction(9, "Firing system shell hook for " + action.condition + ": " + cmd);
					
					cp.exec( cmd, { cwd: os.tmpdir(), timeout: 60 * 1000 }, function(err, stdout, stderr) {
						if (action.details) action.details += "\n";
						action.details += "### Shell Exec Details:\n\n";
						action.details += "- **Command:** `" + cmd + "`\n";
						action.details += "- **Result:** " + (err || "Success") + "\n";
						
						if (err) {
							self.logAction(9, "Shell Hook Error: " + cmd + ": " + err);
							action.code = 'exec';
							action.description = "" + err;
							action.details += "- **Exit Code:** " + err.code + "\n";
							action.details += "- **Signal:** " + (err.signal || 'n/a') + "\n";
						}
						else self.logAction(9, "Shell Hook Completed", { cmd, stdout, stderr } );
						
						action.details += "\n**STDOUT:**\n\n```\n" + (stdout.trim() || "(Empty)") + "\n```\n";
						action.details += "\n**STDERR:**\n\n```\n" + (stderr.trim() || "(Empty)") + "\n```\n";
						
						callback();
					} );
				},
				function(callback) {
					// send notification to specific users
					if (!channel.users || !channel.users.length) return callback();
					
					var hook_data = self.getJobHookData(job, action);
					var text = hook_data.text.replace(/https?\:\/\/\S+/ig, '').replace(/\:\s*$/, '').replace(/^xyOps\s+/, '');
					
					self.logAction(9, "Sending notification to users for " + action.condition, channel.users);
					
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
	
	runJobAction_store(job, action, callback) {
		// store job data and/or files to bucket
		var self = this;
		if (!callback) callback = noop;
		
		var bucket = Tools.findObject( this.buckets, { id: action.bucket_id } );
		if (!bucket) {
			action.code = 'bucket';
			action.description = "Bucket not found: " + action.bucket_id;
			return callback();
		}
		
		var what = action.bucket_sync.replace(/_/g, ' ');
		this.appendMetaLog(job, `Storing ${what} to bucket: ${bucket.title} (#${bucket.id})`);
		
		var bucket_path = 'buckets/' + bucket.id;
		var bucket_data = null;
		var bucket_files = null;
		var matched_files = null;
		
		action.details = "";
		action.details += "### Store Bucket Details:\n\n";
		action.details += "- **Bucket Title:** `" + bucket.title + "`\n";
		action.details += "- **Bucket ID:** `" + bucket.id + "`\n";
		action.details += "- **Store:** " + what + "\n";
		
		action.details += "\n";
		action.details += "### Action Log:\n\n";
		
		async.series([
			function(callback) {
				// lock bucket
				self.storage.lock( bucket_path, true, callback );
			},
			function(callback) {
				// load bucket files if needed
				if (!action.bucket_sync.match(/files/)) return process.nextTick(callback);
				
				self.storage.get( bucket_path + '/files', function(err, files) {
					if (err) return callback(err);
					bucket_files = files;
					callback();
				} );
			},
			function(callback) {
				// load bucket data if needed
				if (!action.bucket_sync.match(/data/)) return process.nextTick(callback);
				
				self.storage.get( bucket_path + '/data', function(err, data) {
					if (err) return callback(err);
					bucket_data = data;
					callback();
				} );
			},
			function(callback) {
				// shallow-merge data and save, if enabled
				if (!bucket_data) return process.nextTick(callback);
				
				// merge into bucket
				Tools.mergeHashInto( bucket_data, job.data || {} );
				action.details += "- Writing updated data to bucket.\n";
				
				// write data back to storage
				self.storage.put( bucket_path + '/data', bucket_data, callback );
			},
			function(callback) {
				// copy files if needed
				if (!bucket_files) return process.nextTick(callback);
				
				var matcher = Tools.picomatch( action.bucket_glob || '*' );
				var storage_key_prefix = 'files/bucket/' + bucket.id;
				
				action.details += "- Including job files with glob pattern: `" + (action.bucket_glob || '*') + "`\n";
				
				if (!job.files || !job.files.length) {
					action.details += "- No job files found.\n";
					return callback();
				}
				
				// apply glob pattern
				matched_files = job.files.filter( function(file) { return matcher(file.filename); } );
				if (!matched_files.length) {
					action.details += "- No job files matched glob.\n";
					return callback();
				}
				action.details += `- ${Tools.commify(matched_files.length)} job ${Tools.pluralize('file', matched_files.length)} matched glob.\n`;
				
				// file size limit
				var largest_file_size = Math.max.apply( Math, matched_files.map( function(file) { return file.size; } ) );
				if (largest_file_size > self.config.getPath('client.bucket_upload_settings.max_file_size')) {
					return callback( new Error("One or more of the matched files exceed the maximum allowed bucket file size.") );
				}
				action.details += "- All files are within bucket size limit.\n";
				
				// file count limit
				var num_new_files = 0;
				matched_files.forEach( function(file) {
					var storage_key = storage_key_prefix + '/' + Path.basename(file.path);
					if (!Tools.findObject( bucket_files, { path: storage_key } )) num_new_files++;
				} );
				
				if (bucket_files.length + num_new_files > self.config.getPath('client.bucket_upload_settings.max_files_per_bucket')) {
					return callback( new Error("The operation would exceed the maximum number of allowed files per bucket.") );
				}
				action.details += "- Bucket file count is within limit.\n";
				
				async.eachSeries( matched_files,
					function(file, callback) {
						// action.details += "- Storing file in bucket: `" + file.filename + "`\n";
						
						// add or replace to bucket file list
						var storage_key = storage_key_prefix + '/' + Path.basename(file.path);
						var stub = Tools.findObject( bucket_files, { path: storage_key } );
						
						if (stub) {
							// replace existing file
							stub.filename = file.filename; // NOTE: This MAY be different, due to storage key normalization
							stub.date = Tools.timeNow(true);
							stub.size = file.size;
							stub.job = job.id;
							stub.server = job.server;
							delete stub.username;
							
							action.details += "- Replacing file in bucket: **" + file.filename + "**\n";
							self.logDebug(7, "Replacing file in bucket: " + bucket.id, stub);
						}
						else {
							// add new file
							stub = {
								id: Tools.generateShortID('f'),
								date: Tools.timeNow(true),
								filename: file.filename, 
								path: storage_key, 
								size: file.size,
								job: job.id,
								server: job.server
							};
							bucket_files.push(stub);
							
							action.details += "- Adding new file to bucket: **" + file.filename + "**\n";
							self.logDebug(7, "Adding new file to bucket: " + bucket.id, stub);
						}
						
						// perform the copy (from job space to bucket space)
						self.storage.copy( file.path, storage_key, callback );
					},
					callback
				); // eachSeries
			},
			function(callback) {
				// write file list back to storage, if we changed it
				if (!matched_files) return process.nextTick(callback);
				
				action.details += "- Writing updated file list to bucket.\n";
				self.storage.put( bucket_path + '/files', bucket_files, callback );
			}
		],
		function(err) {
			// all done
			self.storage.unlock( bucket_path );
			action.details += "- End of log.\n";
			
			if (err) {
				action.code = 'bucket';
				action.description = "Failed to store in bucket: " + (err.message || err);
			}
			else {
				action.code = 0;
				action.description = "Successfully stored " + what + " in bucket.";
			}
			callback();
		});
	}
	
	runJobAction_fetch(job, action, callback) {
		// fetch job data and/or files from bucket
		var self = this;
		if (!callback) callback = noop;
		
		var bucket = Tools.findObject( this.buckets, { id: action.bucket_id } );
		if (!bucket) {
			action.code = 'bucket';
			action.description = "Bucket not found: " + action.bucket_id;
			return callback();
		}
		
		var what = action.bucket_sync.replace(/_/g, ' ');
		this.appendMetaLog(job, `Fetching ${what} from bucket: ${bucket.title} (#${bucket.id})`);
		
		var bucket_path = 'buckets/' + bucket.id;
		
		action.details = "";
		action.details += "### Fetch Bucket Details:\n\n";
		action.details += "- **Bucket Title:** " + bucket.title + "\n";
		action.details += "- **Bucket ID:** `" + bucket.id + "`\n";
		action.details += "- **Fetch:** " + what + "\n";
		
		action.details += "\n";
		action.details += "### Action Log:\n\n";
		
		// prep job input structure
		if (!job.input) job.input = {};
		if (!job.input.data) job.input.data = {};
		if (!job.input.files) job.input.files = [];
		
		async.series([
			function(callback) {
				// lock bucket in shared mode
				self.storage.shareLock( bucket_path, true, callback );
			},
			function(callback) {
				// load bucket files if needed
				if (!action.bucket_sync.match(/files/)) return process.nextTick(callback);
				
				self.storage.get( bucket_path + '/files', function(err, bucket_files) {
					if (err) return callback(err);
					
					// match files against glob
					var matcher = Tools.picomatch( action.bucket_glob || '*' );
					action.details += "- Including bucket files with glob pattern: `" + (action.bucket_glob || '*') + "`\n";
					
					if (!bucket_files || !bucket_files.length) {
						action.details += "- No bucket files found.\n";
						return callback();
					}
					
					// apply glob pattern to bucket files
					var matched_files = bucket_files.filter( function(file) { return matcher(file.filename); } );
					if (!matched_files.length) {
						action.details += "- No bucket files matched glob.\n";
						return callback();
					}
					action.details += `- ${Tools.commify(matched_files.length)} bucket ${Tools.pluralize('file', matched_files.length)} matched glob.\n`;
					
					matched_files.forEach( function(file) {
						var idx = Tools.findObjectIdx( job.input.files, { path: file.path } );
						if (idx > -1) {
							// replace file ref already in input
							action.details += "- Replacing file already in job: **" + file.filename + "**\n";
							job.input.files[idx] = { ...file, bucket: bucket.id };
						}
						else {
							// add new file to input
							action.details += "- Adding new file to job: **" + file.filename + "**\n";
							job.input.files.push({ ...file, bucket: bucket.id });
						}
					} ); // foreach matched file
					
					callback();
				} );
			},
			function(callback) {
				// load bucket data if needed
				if (!action.bucket_sync.match(/data/)) return process.nextTick(callback);
				
				self.storage.get( bucket_path + '/data', function(err, bucket_data) {
					if (err) return callback(err);
					
					Tools.mergeHashInto(job.input.data, bucket_data);
					action.details += "- Fetched bucket data and merged with job input.\n";
					
					callback();
				} );
			}
		],
		function(err) {
			// all done
			self.storage.shareUnlock( bucket_path );
			action.details += "- End of log.\n";
			
			if (err) {
				action.code = 'bucket';
				action.description = "Failed to fetch from bucket: " + (err.message || err);
			}
			else {
				action.code = 0;
				action.description = "Successfully fetched " + what + " from bucket.";
			}
			callback();
		});
	}
	
	runJobAction_ticket(job, action, callback) {
		// create ticket for job action
		// action: { ticket_type, ticket_assignees, ticket_tags }
		var self = this;
		if (!callback) callback = noop;
		
		this.logAction(6, "Creating ticket for job action: " + action.condition, action);
		
		var ticket = {
			subject: '',
			template: 'job', // generate ticket body from template
			job: job.id,
			type: action.ticket_type,
			status: 'open',
			category: job.category || '',
			assignees: action.ticket_assignees,
			cc: [],
			notify: [],
			events: [],
			tags: action.ticket_tags,
			due: '',
			server: job.server || ''
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
		
		// generate body (and subject)
		this.generateTicketBody_job(ticket, function(err) {
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
				
				self.logAction(6, "Successfully created ticket: " + ticket.id, ticket);
				self.logTransaction('ticket_create', ticket.id, { 
					username: 'system',
					ticket: Tools.copyHashRemoveKeys(ticket, { changes: 1 }), 
					keywords: [ ticket.id ] 
				});
				
				// advance ticket number counter
				self.putState('next_ticket_num', ticket.num + 1);
				
				// scan for user triggers (search alerts)
				if (ticket.status != 'draft') self.processTicketChange(ticket.id, ticket.changes);
				
				// update job with new ticket id
				if (!job.tickets) job.tickets = [];
				job.tickets.push( ticket.id );
				
				callback();
			} ); // unbase.insert
		}); // generateTicketBody_alert
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
		hook_args.xy = 1; // wire protocol version
		hook_args.type = 'action'; // wire action
		hook_args.condition = action.condition;
		hook_args.params = action.params;
		delete hook_args.env; // child process gets this for free
		
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
		
		this.appendMetaLog(job, "Running custom action Plugin: " + plugin.id);
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
	
	getJobHookData(job, action) {
		// return a copy of job object, augmented with all data used in hooks
		var base_app_url = this.config.get('base_app_url');
		
		var hook_data = {
			env: this.cleanEnv(),
			job: job,
			action: action,
			event: Tools.findObject( this.events, { id: job.event } ) || null,
			plugin: Tools.findObject( this.plugins, { id: job.plugin } ) || null,
			category: Tools.findObject(this.categories, { id: job.category }) || null,
			nice_server: this.hostID
		};
		
		if (job.server && this.servers[job.server]) {
			var server = hook_data.server = this.servers[job.server];
			
			hook_data.nice_hostname = server.hostname;
			if (this.config.get('hostname_display_strip')) {
				hook_data.nice_hostname = hook_data.nice_hostname.replace( new RegExp(this.config.get('hostname_display_strip')), '' );
			}
			hook_data.nice_server = hook_data.nice_hostname;
			if (server.title) hook_data.nice_server = server.title + ' (' + hook_data.nice_hostname + ')';
		}
		
		hook_data.links = {
			job_details: base_app_url + '/#Job?id=' + job.id,
			job_log: base_app_url + '/api/app/download_job_log?id=' + job.id + '&t=' + Tools.digestBase64( 'download' + job.id + this.config.get('secret_key'), 'sha256', 16 ),
			job_files: '(None)'
		};
		
		if (job.files && job.files.length) {
			hook_data.links.job_files = job.files.map( function(file) { return `- ${base_app_url}/${file.path}`; } ).join("\n");
		}
		
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
		var text_template = text_templates[ 'job_' + action.condition ];
		if (!text_template && !job.completed) text_template = text_templates.job_progress;
		if (!text_template && job.code) text_template = text_templates.job_error;
		if (!text_template && !job.code) text_template = text_templates.job_success;
		hook_data.text = this.messageSub( text_template, hook_data, 'n/a' );
		
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
			
			// compatibility with slack, discord, pushover, and other web hooks
			if (!data.text && data.description) data.text = data.description;
			data.content = data.message = data.text;
			
			if (hook.url) {
				// allow placeholder subs on url (encoded)
				var url = self.messageSub( hook.url, data, "", encodeURIComponent );
				
				this.logAction(9, "Firing system web hook for " + action + ": " + url);
				
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
					if (err) self.logAction(9, "Web Hook Error: " + url + ": " + err);
					else self.logAction(9, "Web Hook Response: " + url + ": HTTP " + resp.statusCode + " " + resp.statusMessage);
				} );
			} // web hook
			
			if (hook.web_hook) {
				// fire user-defined web hook
				this.logAction(9, "Firing web hook for " + action + ": " + hook.web_hook);
				this.fireWebHook(hook.web_hook, data);
			}
			
			if (hook.shell_exec) {
				// allow placeholder subs on command
				var cmd = this.messageSub( hook.shell_exec, data );
				
				this.logAction(9, "Firing system shell hook for " + action + ": " + cmd);
				cp.exec( cmd, function(err, stdout, stderr) {
					if (err) self.logAction(9, "Shell Hook Error: " + cmd + ": " + err);
					else self.logAction(9, "Shell Hook Completed", { cmd, stdout, stderr } );
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
			if (hook.max_per_day && (this.getDailyCustomStat(`web_hooks.${id}.invocations`) >= hook.max_per_day)) {
				return callback( new Error(`Web Hook has reached maximum daily limit: ${id} (${hook.max_per_day}/day)`) );
			}
			this.updateDailyCustomStat(`web_hooks.${id}.invocations`, 1);
		}
		else if (typeof(id) == 'object') {
			// optionally pass in an object for the hook (test mode)
			hook = id;
		}
		else return callback( new Error("Internal Error: Web Hook is not an ID nor object.") );
		
		// add secrets to hook data if applicable, but only if pre-created
		if (hook.id && Tools.findObject( this.web_hooks, { id: hook.id } )) {
			data.secrets = this.getSecretsForType('web_hooks', hook.id);
		}
		
		// allow placeholder subs on url (encoded)
		var url = this.messageSub( hook.url, data, data._fallback, encodeURIComponent );
		
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
			opts.headers[ header.name ] = self.messageSub(header.value, data, data._fallback);
		} );
		if (!hook.method.match(/^(GET|HEAD)$/) && hook.body.trim().length) {
			opts.data = Buffer.from( self.messageSub(hook.body, data, data._fallback) );
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
	
}; // class Actions

module.exports = Actions;
