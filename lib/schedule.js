// xyOps Schedule Layer
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const Path = require('path');
const cp = require('child_process');
const async = require("async");
const Tools = require("pixl-tools");
const noop = function() {};

class Scheduler {

	logScheduler(level, msg, data) {
		// log debug msg with pseudo-component
		if (this.debugLevel(level)) {
			this.logger.set( 'component', 'Scheduler' );
			this.logger.print({ category: 'debug', code: level, msg: msg, data: data });
		}
	}
	
	setupScheduler() {
		// start scheduling!
		// called when server becomes master
		this.lastMonthDayCache = {};
		
		this.server.on('minute', this.schedulerMinuteTick.bind(this) );
	}
	
	schedulerMinuteTick(dargs) {
		// a minute has passed!  schedule all the things!
		var self = this;
		
		if (!this.master || this.shut) return;
		if (!this.getState('scheduler/enabled')) {
			this.logScheduler(9, "Scheduler is disabled, skipping minute tick");
			return;
		}
		
		var now = Tools.normalizeTime( dargs.epoch, { sec: 0 } );
		var default_tz = this.config.get('tz') || Intl.DateTimeFormat().resolvedOptions().timeZone;
		var days = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
		var formatters = {};
		var deferred_jobs = [];
		
		this.logScheduler(5, "Ticking scheduler for timestamp: " + (new Date(now * 1000)).toString());
		
		this.events.forEach( function(event) {
			if (!event.enabled) return;
			if (!event.triggers || !event.triggers.length) return; // on-demand
			
			// check for disabled category
			var category = Tools.findObject( self.categories, { id: event.category } );
			if (!category.enabled) return;
			
			// check for disabled plugin
			var plugin = Tools.findObject( self.plugins, { id: event.plugin } );
			if (plugin && !plugin.enabled) return;
			
			// process triggers
			var triggers = event.triggers.filter( function(trigger) { return trigger.enabled && trigger.type; } );
			var schedules = triggers.filter( function(trigger) { return trigger.type.match(/^(schedule|single|plugin|interval)$/); } );
			if (!schedules.length) return;
			
			// setup all unique timezones (intl formatters)
			var tzs = {};
			schedules.forEach( function(trigger) {
				if (trigger.type == 'single') return; // no tz for single
				if (trigger.type == 'interval') return; // no tz for interval
				var tz = trigger.timezone || default_tz;
				tzs[tz] = true;
				if (tz in formatters) return; // already setup
				
				formatters[tz] = new Intl.DateTimeFormat('en-US', 
					{ year: 'numeric', month: '2-digit', day: 'numeric', weekday: 'long', hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: tz }
				);
			} );
			
			var ranges = triggers.filter( function(trigger) { return (trigger.type == 'range') || (trigger.type == 'blackout'); } );
			var catch_up = Tools.findObject( triggers, { type: 'catchup' } );
			var start_delay = Tools.findObject( triggers, { type: 'delay' } );
			var precision = Tools.findObject( triggers, { type: 'precision' } );
			var cursor = catch_up ? (self.getState('events/' + event.id + '/cursor') || (now - 60)) : (now - 60);
			var date = new Date();
			var tzargs = {};
			var chosen_trigger = null;
			
			while (cursor < now) {
				var scheduled = false;
				
				// advance cursor
				cursor += 60;
				date.setTime( cursor * 1000 );
				
				// convert date to all unique timezones we care about and argify it
				// { month: 11, day: 29, weekday: 2, year: 2022, hour: 22, minute: 29 }
				for (var tz in tzs) {
					tzargs[tz] = {};
					formatters[tz].formatToParts(date).forEach( function(part) {
						if (part.type == 'literal') return;
						if (part.type == 'weekday') tzargs[tz][ part.type ] = days[ part.value ];
						else tzargs[tz][ part.type ] = parseInt( part.value );
					} );
					
					// include reverse-month-day (rday): -1 is last day of month, -2 is 2nd-to-last day, etc.
					tzargs[tz].rday = (tzargs[tz].day - self.getLastDayInMonth( tzargs[tz].year, tzargs[tz].month )) - 1;
				}
				
				schedules.forEach( function(trigger) {
					if (scheduled) return;
					
					if ((trigger.type == 'single') && (trigger.epoch == now)) {
						scheduled = 'single';
						chosen_trigger = trigger;
						return;
					}
					if (trigger.type == 'plugin') {
						scheduled = 'plugin';
						chosen_trigger = trigger;
						return;
					}
					if (trigger.type == 'interval') {
						// calculate interval, piggy-back on precision system to set multiple job launches for the minute
						var hits = self.intervalHitsPerMinute(trigger, now);
						if (hits.length) {
							scheduled = 'interval';
							chosen_trigger = trigger;
							precision = { seconds: hits };
							return;
						}
					}
					
					if (trigger.type != 'schedule') return; // sanity
					var tz = trigger.timezone || default_tz;
					var dargs = tzargs[tz];
					
					if (trigger.years && trigger.years.length && !trigger.years.includes(dargs.year)) return;
					if (trigger.months && trigger.months.length && !trigger.months.includes(dargs.month)) return;
					if (trigger.days && trigger.days.length && !trigger.days.includes(dargs.day) && !trigger.days.includes(dargs.rday)) return;
					if (trigger.weekdays && trigger.weekdays.length && !trigger.weekdays.includes(dargs.weekday)) return;
					if (trigger.hours && trigger.hours.length && !trigger.hours.includes(dargs.hour)) return;
					if (trigger.minutes && trigger.minutes.length && !trigger.minutes.includes(dargs.minute)) return;
					
					scheduled = 'schedule';
					chosen_trigger = trigger;
				} ); // foreach schedule
				
				if (!scheduled) continue;
				
				// check ranges
				// (both start/end dates are INCLUSIVE)
				ranges.forEach( function(trigger) {
					switch (trigger.type) {
						case 'range':
							if (trigger.start && (cursor < trigger.start)) scheduled = false;
							else if (trigger.end && (cursor > trigger.end)) scheduled = false;
						break;
						
						case 'blackout':
							if ((cursor >= trigger.start) && (cursor <= trigger.end)) scheduled = false;
						break;
					}
				} );
				
				if (!scheduled) continue;
				
				// we're go for launch!
				var job = Tools.copyHash(event, true);
				job.now = cursor;
				job.source = 'scheduler';
				if (scheduled !== 'schedule') job.stype = scheduled; // single, interval, etc.
				
				// workflow prep
				if (job.type == 'workflow') {
					// job.workflow.trigger = chosen_trigger;
					job.workflow.start = chosen_trigger.id;
				}
				
				// optional start_delay
				if (start_delay && start_delay.duration) {
					job.state = 'start_delay';
					job.until = cursor + start_delay.duration;
				}
				
				if (scheduled === 'plugin') {
					job.source = 'plugin';
					job.splugin = chosen_trigger.plugin_id;
					
					deferred_jobs.push( Tools.mergeHashes( chosen_trigger, {
						timezone: chosen_trigger.timezone || default_tz,
						dargs: tzargs[chosen_trigger.timezone || default_tz],
						now: cursor,
						job: job
					}));
					
					continue;
				}
				
				if (precision && precision.seconds && precision.seconds.length) {
					// multi-launch with precision
					precision.seconds.forEach( function(sec) {
						var pdate = new Date( (cursor + sec) * 1000 );
						self.logScheduler(4, `Auto-launching pending scheduled event: ${event.title} (${event.id}) for timestamp: ${pdate.toString()} (with precision)`, chosen_trigger );
						self.launchJob( Tools.mergeHashes( Tools.copyHash(job, true), {
							now: cursor + sec,
							state: 'start_delay',
							until: cursor + sec
						} ) );
					} ); // for each sec
				}
				else {
					// single launch
					self.logScheduler(4, `Auto-launching scheduled event: ${event.title} (${event.id}) for timestamp: ${date.toString()}`, chosen_trigger );
					self.launchJob(job);
				}
			} // while cursor
			
			// update event cursor state if in catch-up mode
			if (catch_up) self.putState( 'events/' + event.id + '/cursor', cursor );
			
		} ); // events.forEach
		
		// handle deferred jobs (scheduler plugins)
		if (deferred_jobs.length) {
			this.handleSchedulerPluginJobs(deferred_jobs);
		}
		
		this.logScheduler(9, "Scheduler tick complete");
	}
	
	intervalHitsPerMinute(trigger, epoch) {
		// calculate when an interval should hit in the current minute (epoch)
		// return an array of second offsets, similar to precision.seconds
		// trigger: { start, duration }
		if (trigger.start > epoch) return []; // trigger starts in future
		
		var first_idx = Math.ceil((epoch - trigger.start) / trigger.duration);
		var first_hit = trigger.start + first_idx * trigger.duration;
		var hits = [];
		
		for (var t = first_hit; t < epoch + 60; t += trigger.duration) {
			if (t >= epoch) hits.push(t - epoch);
		}
		
		return hits;
	}
	
	handleSchedulerPluginJobs(deferred_jobs, callback) {
		// handle ticked jobs with scheduler plugins
		// { plugin_id, params, timezone, dargs, now, job }
		var self = this;
		this.logScheduler(9, "Processing " + deferred_jobs.length + " deferred (plugin) jobs");
		
		// distribute jobs into unique plugin buckets
		var plugins = {};
		
		deferred_jobs.forEach( function(item) {
			if (!plugins[item.plugin_id]) plugins[item.plugin_id] = [];
			plugins[item.plugin_id].push(item);
		} );
		
		// exec unique plugins in parallel
		async.each( Object.values(plugins),
			function(items, callback) {
				var plugin_id = items[0].plugin_id;
				var plugin = Tools.findObject( self.plugins, { id: plugin_id } );
				if (!plugin) {
					self.logError('scheduler', "Trigger Plugin not found: " + plugin_id + ", skipping launches", { count: items.length } );
					return callback();
				}
				if (!plugin.enabled) {
					self.logScheduler(6, "Trigger Plugin is disabled: " + plugin_id + ", skipping launches", { count: items.length } );
					return callback();
				}
				
				self.execSchedulerPlugin(plugin, items, callback);
			},
			function() {
				self.logScheduler(9, "Deferred schedule launches complete");
				if (callback) callback();
			}
		); // async.each
	}
	
	execSchedulerPlugin(plugin, items, callback) {
		// launch scheduler plugin to see which jobs need to launch
		// items: [{ plugin_id, params, timezone, dargs, now, job }]
		var self = this;
		var plugin_dir = Path.join( this.config.get('temp_dir'), 'plugins' );
		
		var child_cmd = plugin.command;
		if (plugin.script) child_cmd += ' ' + Path.resolve( Path.join( plugin_dir, plugin.id + '.bin' ) );
		
		// grab secrets needed by plugin
		var sec = this.getSecretsForType('plugins', plugin.id);
		
		var child_opts = {
			cwd: plugin.cwd || os.tmpdir(),
			env: Object.assign( {}, this.cleanEnv(), sec ),
			timeout: (plugin.timeout || 30) * 1000
		};
		
		child_opts.env['XYOPS'] = this.server.__version;
		
		// add plugin params as env vars, expand $INLINE vars
		if (items[0].params) {
			for (var key in items[0].params) {
				child_opts.env[ key.toUpperCase() ] = 
					(''+items[0].params[key]).replace(/\$(\w+)/g, function(m_all, m_g1) {
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
				this.logError('scheduler', "Could not determine user information for: " + plugin.uid, { plugin: plugin.id } );
				return callback();
			}
		}
		if (plugin.gid && (plugin.gid != 0)) {
			var grp_info = Tools.getgrnam( plugin.gid, true );
			if (grp_info) {
				child_opts.gid = grp_info.gid;
			}
			else {
				this.logError('scheduler', "Could not determine group information for: " + plugin.gid, { plugin: plugin.id } );
				return callback();
			}
		}
		
		this.logScheduler(9, "Firing Trigger Plugin: " + plugin.title + " (" + plugin.id + ") for " + items.length + " potential job launches: " + child_cmd);
		
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
			if (err) {
				self.logError('scheduler', "Failed to launch Trigger Plugin: " + plugin.id + ": " + err, { cmd: child_cmd, stdout, stderr });
				self.logTransaction('warning', "Failed to launch Trigger Plugin: " + plugin.id + ": " + err);
				return callback();
			}
			if (!json || !json.xy || !json.items || !json.items.length) {
				self.logError('scheduler', "Unexpected result from Trigger Plugin: " + plugin.id, { cmd: child_cmd, stdout, stderr });
				self.logTransaction('warning', "Unexpected result from Trigger Plugin: " + plugin.id);
				return callback();
			}
			
			self.logScheduler(9, "Trigger Plugin Completed", { child_cmd, stderr } );
			
			// see which items the plugin says to launch
			async.eachOfSeries( json.items, 
				function(result, idx, callback) {
					if (typeof(result) == 'boolean') result = { launch: result };
					if (!result.launch) return process.nextTick(callback); // no launch
					var item = items[idx];
					var job = item.job;
					
					var event = Tools.findObject( self.events, { id: job.id } );
					if (!event || !event.triggers) return process.nextTick(callback); // sanity
					
					var finish = function() {
						var date = new Date( item.now * 1000 );
						self.logScheduler(4, `Auto-launching deferred scheduled event: ${event.title} (${event.id}) for timestamp: ${date.toString()}`, {
							plugin_id: plugin.id,
							plugin_title: plugin.title
						} );
						self.launchJob( job );
						return process.nextTick(callback);
					}; // finish
					
					// optional start delay from plugin
					if (result.delay) {
						job.state = 'start_delay';
						job.until = job.now + result.delay;
					}
					
					// see if plugin provided input data for job
					if (result.data) {
						if (!job.input) job.input = {};
						if (!job.input.data) job.input.data = {};
						Tools.mergeHashInto( job.input.data, result.data );
					}
					
					// see if plugin provided files to upload for job
					if (!result.files || !result.files.length) return finish();
					
					// upload files and inject into job input
					self.logScheduler(6, "Pre-uploading files for job", result.files);
					
					var exp_epoch = Tools.timeNow(true) + Tools.getSecondsFromText( self.config.getPath('client.job_upload_settings.plugin_file_expiration') );
					var storage_key_prefix = 'files/plugins/' + plugin.id + '/' + Tools.generateUniqueBase64(16);
					var files = [];
					
					async.eachSeries( result.files,
						function(file, callback) {
							// process single file upload
							if (typeof(file) == 'string') file = { path: file };
							
							// prepend plugin cwd if path is not absolute
							if (!Path.isAbsolute(file.path)) file.path = Path.join(child_opts.cwd, file.path);
							
							fs.stat( file.path, function(err, stats) {
								if (err) return callback(err);
								
								var filename = self.cleanFilename( Path.basename(file.filename || file.path) );
								var url_filename = self.cleanURLFilename( Path.basename(file.filename || file.path) );
								var storage_key = storage_key_prefix + '/' + url_filename;
								
								// storage key must have a file extension to be considered binary
								if (!self.storage.isBinaryKey(storage_key)) storage_key += '.bin';
								
								self.storage.putStream( storage_key, fs.createReadStream(file.path), function(err) {
									if (err) return callback(err);
									
									files.push({
										id: Tools.generateShortID('f'),
										date: Tools.timeNow(true),
										filename: filename, 
										path: storage_key, 
										size: stats.size,
										plugin: plugin.id
									});
									
									// set expiration date for file (fires off background task)
									self.storage.expire( storage_key, exp_epoch );
									
									// delete temp file if specified by plugin
									if (file.delete) fs.unlink( file.path, callback);
									else callback();
								} ); // putStream
							} ); // fs.stat
						},
						function(err) {
							if (err) {
								self.logError('scheduler', "Failed to process files from trigger plugin: " + err);
								self.logTransaction('warning', "Failed to process files from trigger plugin: " + err);
								return callback(); // do not launch
							}
							
							// append files to job (it may already have some)
							if (!job.input) job.input = {};
							if (!job.input.files) job.input.files = [];
							job.input.files = job.input.files.concat( files );
							
							finish();
						}
					); // async.eachSeries
				},
				callback
			); // eachOfSeries
		} ); // cp.exec
		
		// Write data to child's stdin
		child.stdin.on('error', noop);
		child.stdin.write( JSON.stringify({ xy: 1, type: 'trigger', items }) + "\n" );
		child.stdin.end();
	}
	
	getLastDayInMonth(year, month) {
		// compute the last day in the month, and cache in RAM
		var cache_key = '' + year + '/' + month;
		if (cache_key in this.lastMonthDayCache) return this.lastMonthDayCache[cache_key];
		
		var last_day = new Date(year, month, 0).getDate();
		this.lastMonthDayCache[cache_key] = last_day;
		
		return last_day;
	}
	
}; // class Scheduler

module.exports = Scheduler;
