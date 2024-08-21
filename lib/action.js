// Orchestra Multi-Master Action Layer
// Copyright (c) 2022 - 2024 Joseph Huckaby

const fs = require('fs');
const cp = require('child_process');
const async = require('async');
const WebSocket = require('ws');
const Tools = require('pixl-tools');
const PixlMail = require('pixl-mail');

class Actions {
	
	runJobActions(job, trigger) {
		// fire a set of job actions that match a trigger id
		var self = this;
		this.logDebug(8, "Running job actions for trigger: " + trigger, { job_id: job.id });
		
		Tools.findObjects( job.actions || [], { trigger, enabled: true } ).forEach( function(action) {
			self.runJobAction(job, action);
		} );
		
		// fire universal system hooks matching trigger (with `job_` prefix)
		var hook_data = this.getJobHookData(job, { trigger });
		this.fireSystemHook('job_' + trigger, hook_data);
		this.updateDailyStat( 'job_' + trigger, 1 );
		if (job.server) this.updateDailyServerStat( job.server, 'job_' + trigger, 1 );
	}
	
	runJobAction(job, action) {
		// execute job action
		this.logDebug(8, "Executing job action", { action, job_id: job.id });
		
		// log action to job meta/activity
		this.appendMetaLog(job, "Executing job " + action.trigger + " action: " + action.type);
		
		// run it
		var func = 'runJobAction_' + action.type;
		if (!this[func]) {
			this.logError('action', "Action handler not found for type: " + action.type, { action, job_id: job.id });
			return;
		}
		
		this[func](job, action);
	}
	
	runJobAction_email(job, action) {
		// send email for job action
		var self = this;
		var mail_args = this.getJobHookData(job, action);
		mail_args.config = this.config.get();
		
		this.appendMetaLog(job, "Sending email notification to: " + action.email);
		
		// prep email template
		var template_file = '';
		if (action.trigger == 'start') template_file = 'conf/emails/job_start.txt';
		else if (!job.code) template_file = 'conf/emails/job_success.txt';
		else template_file = 'conf/emails/job_fail.txt';
		
		this.getJobLogExcerpt( job, function(err, excerpt) {
			mail_args.log_excerpt = excerpt || 'n/a';
			
			// load template file ourselves, so we can use new Tools.sub() with fallback 'n/a` text
			fs.readFile( template_file, '', function(err, template_text) {
				if (err) {
					self.logError('mail', "Failed to load email template: " + template_file + ": " + err, err);
					return;
				}
				
				// substitute macros with `n/a` fallback
				var mail_text = Tools.sub( template_text, mail_args, false, 'n/a' );
				
				// construct mailer
				var mail = new PixlMail( self.config.get('smtp_hostname'), self.config.get('smtp_port') || 25 );
				mail.setOptions( self.config.get('mail_options') || {} );
				
// TODO: REMOVE ME!
fs.writeFileSync( 'logs/LAST_MAIL.TXT', mail_text );
				
				// send it
				mail.send( mail_text, function(err) {
					if (err) {
						var err_msg = "Failed to send e-mail for job: " + job.id + ": " + action.email + ": " + err;
						self.logError( 'mail', err_msg, { text: mail_text } );
						self.logActivity( 'error', { description: err_msg } );
					}
					else {
						self.logDebug(5, "Email sent successfully for job: " + job.id );
					}
				} ); // mail.send
			}); // fs.readFile
		}); // getJobLogExcerpt
	}
	
	runJobAction_web_hook(job, action) {
		// fire off web hook for action
		var hook_data = this.getJobHookData(job, action);
		this.appendMetaLog(job, "Firing web hook: " + action.url);
		this.logDebug(9, "Firing job web hook for " + action.trigger + ": " + action.url);
		this.fireWebHook(action.url, hook_data);
	}
	
	runJobAction_run_event(job, action) {
		// run event for action
		var self = this;
		var event = Tools.findObject( this.events, { id: action.event_id } );
		if (!event) {
			this.appendMetaLog(job, "Event not found for run action trigger: " + action.event_id);
			return;
		}
		var new_job = Tools.copyHash(event, true);
		
		// set new job source and parent
		new_job.source = 'action';
		new_job.parent = {
			id: job.id,
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
			if (err) self.appendMetaLog(job, "Failed to launch event for action: " + action.trigger + ": " + (err.message || err));
			else {
				self.appendMetaLog(job, "Launched job for action: " + action.trigger + ": " + id);
				
				// populate jobs array in current job
				// NOTE: No race condition here because launchJob fires the callback in the same thread
				if (!job.jobs) job.jobs = [];
				job.jobs.push({ id, reason: 'action' });
			}
		});
	}
	
	runJobAction_channel(job, action) {
		// activate notification channel for action
		var self = this;
		var channel = Tools.findObject( this.channels, { id: action.channel_id } );
		if (!channel) {
			this.appendMetaLog(job, "Notification Channel not found for action trigger: " + action.channel_id);
			return;
		}
		if (!channel.enabled) {
			this.appendMetaLog(job, "Notification Channel is not enabled: " + channel.title);
			return;
		}
		
		this.appendMetaLog(job, "Notifying channel: " + channel.title);
		this.logDebug(6, "Notifying channel for action: " + action.trigger + ": " + channel.title, channel);
		
		if (channel.email) {
			this.runJobAction_email(job, Tools.mergeHashes(action, { type: 'email', email: channel.email }));
		}
		if (channel.web_hook) {
			this.runJobAction_web_hook(job, Tools.mergeHashes(action, { type: 'web_hook', url: channel.web_hook }));
		}
		if (channel.run_event) {
			this.runJobAction_run_event(job, Tools.mergeHashes(action, { type: 'run_event', event_id: channel.run_event }));
		}
		if (channel.shell_exec) {
			var hook_data = this.getJobHookData(job, action);
			var cmd = Tools.sub( channel.shell_exec, hook_data );
			
			this.appendMetaLog(job, "Running custom shell command: " + cmd);
			this.logDebug(9, "Firing system shell hook for " + action.trigger + ": " + cmd);
			
			cp.exec( cmd, function(err, stdout, stderr) {
				if (err) self.logDebug(9, "Shell Hook Error: " + cmd + ": " + err);
				else self.logDebug(9, "Shell Hook Completed", { cmd, stdout, stderr } );
			} );
		}
	}
	
	runJobAction_disable(job, action) {
		// disable the event for action
		this.appendMetaLog(job, "Disabling event for action");
		if (!job.update_event) job.update_event = {};
		job.update_event.enabled = false;
	}
	
	runJobAction_snapshot(job, action) {
		// take a snapshot of the server for action
		var self = this;
		this.appendMetaLog(job, "Taking snapshot of server");
		
		if (job.state == 'complete') {
			// for job complete actions, set flag so we can take the snapshot BEFORE triggering page reload
			job.create_snapshot = true;
		}
		else {
			// for all other job states, take the snapshot right away
			this.createSnapshot(job.server, { source: 'job' }, function(err, id) {
				if (err) self.logError('snapshot', "Failed to take snapshot: " + err);
			});
		}
	}
	
	getJobHookData(job, action) {
		// return a copy of job object, augmented with all data used in hooks
		var hook_data = {
			job: job,
			action: action,
			event: Tools.findObject( this.events, { id: job.event } ) || null,
			plugin: Tools.findObject( this.plugins, { id: job.plugin } ) || null,
			category: Tools.findObject(this.categories, { id: job.category }) || null,
		};
		
		if (job.workflow) hook_data.workflow = Tools.findObject( this.events, { id: job.workflow } ) || null;
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
		var text_template = text_templates[action.trigger];
		if (!text_template && job.code) text_template = text_templates.error;
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
			
			var data = Tools.copyHash(orig_data, true);
			data.action = action;
			data.epoch = Tools.timeNow(true);
			
			// compatibility with slack and other web hooks
			if (!data.text && data.description) data.text = data.description;
			data.text = this.config.getPath('client/name') + ": " + data.text;
			
			if (hook.url) {
				// allow placeholder subs on url
				var url = Tools.sub( hook.url, data );
				
				this.logDebug(9, "Firing system web hook for " + action + ": " + url);
				this.fireWebHook(url, data);
			} // web hook
			
			if (hook.shell_exec) {
				// allow placeholder subs on command
				var cmd = Tools.sub( hook.shell_exec, data );
				
				this.logDebug(9, "Firing system shell hook for " + action + ": " + cmd);
				cp.exec( cmd, function(err, stdout, stderr) {
					if (err) self.logDebug(9, "Shell Hook Error: " + cmd + ": " + err);
					else self.logDebug(9, "Shell Hook Completed", { cmd, stdout, stderr } );
				} );
			} // command hook
		}
	}
	
	fireWebHook(url, orig_data) {
		// send HTTP POST request to URL for web hook action
		var self = this;
		var hook_data = Tools.copyHash(orig_data, true);
		
		// include web_hook_config_keys if configured
		if (this.config.get('web_hook_config_keys')) {
			var web_hook_config_keys = this.config.get('web_hook_config_keys');
			for (var idy = 0, ley = web_hook_config_keys.length; idy < ley; idy++) {
				var key = web_hook_config_keys[idy];
				hook_data[key] = this.config.get(key);
			}
		}
		
		// include web_hook_custom_data if configured
		if (this.config.get('web_hook_custom_data')) {
			var web_hook_custom_data = this.config.get('web_hook_custom_data');
			for (var key in web_hook_custom_data) hook_data[key] = web_hook_custom_data[key];
		}
		
		// custom http options for web hook
		var hook_opts = this.config.get('web_hook_custom_opts') || {};
		
		this.request.json( url, hook_data, hook_opts, function(err, resp, data) {
			// log response
			if (err) self.logDebug(9, "Web Hook Error: " + url + ": " + err);
			else self.logDebug(9, "Web Hook Response: " + url + ": HTTP " + resp.statusCode + " " + resp.statusMessage);
		} );
	}
	
}; // class Actions

module.exports = Actions;
