// Orchestra Multi-Master Schedule Layer
// Copyright (c) 2022 - 2024 Joseph Huckaby

const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const Path = require('path');
const cp = require('child_process');
const async = require("async");
const Tools = require("pixl-tools");
const noop = function() {};

class Scheduler {

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
			this.logDebug(9, "Scheduler is disabled, skipping minute tick");
			return;
		}
		
		var now = Tools.normalizeTime( dargs.epoch, { sec: 0 } );
		var default_tz = this.config.get('tz') || Intl.DateTimeFormat().resolvedOptions().timeZone;
		var days = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
		var formatters = {};
		var deferred_jobs = [];
		
		this.logDebug(5, "Ticking scheduler for timestamp: " + (new Date(now * 1000)).toString());
		
		this.events.forEach( function(event) {
			if (!event.enabled) return;
			if (!event.timings || !event.timings.length) return; // on-demand
			
			// check for disabled category
			var category = Tools.findObject( self.categories, { id: event.category } );
			if (!category.enabled) return;
			
			// check for disabled plugin
			var plugin = Tools.findObject( self.plugins, { id: event.plugin } );
			if (!plugin.enabled) return;
			
			// process timings
			var timings = event.timings.filter( function(timing) { return timing.enabled && timing.type; } );
			var schedules = timings.filter( function(timing) { return timing.type.match(/^(schedule|single|plugin)$/); } );
			if (!schedules.length) return;
			
			// setup all unique timezones (intl formatters)
			var tzs = {};
			schedules.forEach( function(timing) {
				if (timing.type == 'single') return; // no tz for single
				var tz = timing.timezone || default_tz;
				tzs[tz] = true;
				if (tz in formatters) return; // already setup
				
				formatters[tz] = new Intl.DateTimeFormat('en-US', 
					{ year: 'numeric', month: '2-digit', day: 'numeric', weekday: 'long', hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: tz }
				);
			} );
			
			var ranges = timings.filter( function(timing) { return (timing.type == 'range') || (timing.type == 'blackout'); } );
			var catch_up = Tools.findObject( timings, { type: 'catchup' } );
			var start_delay = Tools.findObject( timings, { type: 'delay' } );
			var cursor = catch_up ? (self.getState('events/' + event.id + '/cursor') || (now - 60)) : (now - 60);
			var date = new Date();
			var tzargs = {};
			var chosen_timing = null;
			
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
				
				schedules.forEach( function(timing) {
					if (scheduled) return;
					
					if ((timing.type == 'single') && (timing.epoch == now)) {
						scheduled = 'single';
						chosen_timing = timing;
						return;
					}
					if (timing.type == 'plugin') {
						scheduled = 'plugin';
						chosen_timing = timing;
						return;
					}
					
					if (timing.type != 'schedule') return; // sanity
					var tz = timing.timezone || default_tz;
					var dargs = tzargs[tz];
					
					if (timing.years && timing.years.length && !timing.years.includes(dargs.year)) return;
					if (timing.months && timing.months.length && !timing.months.includes(dargs.month)) return;
					if (timing.days && timing.days.length && !timing.days.includes(dargs.day) && !timing.days.includes(dargs.rday)) return;
					if (timing.weekdays && timing.weekdays.length && !timing.weekdays.includes(dargs.weekday)) return;
					if (timing.hours && timing.hours.length && !timing.hours.includes(dargs.hour)) return;
					if (timing.minutes && timing.minutes.length && !timing.minutes.includes(dargs.minute)) return;
					
					scheduled = 'schedule';
					chosen_timing = timing;
				} ); // foreach schedule
				
				if (!scheduled) continue;
				
				// check ranges
				// (both start/end dates are INCLUSIVE)
				ranges.forEach( function(timing) {
					switch (timing.type) {
						case 'range':
							if (timing.start && (cursor < timing.start)) scheduled = false;
							else if (timing.end && (cursor > timing.end)) scheduled = false;
						break;
						
						case 'blackout':
							if ((cursor >= timing.start) && (cursor <= timing.end)) scheduled = false;
						break;
					}
				} );
				
				if (!scheduled) continue;
				
				// we're go for launch!
				var job = Tools.copyHash(event, true);
				job.now = cursor;
				job.source = 'scheduler';
				if (scheduled === 'single') job.single = true;
				
				// optional start_delay
				if (start_delay && start_delay.duration) {
					job.state = 'start_delay';
					job.until = Tools.timeNow() + start_delay.duration;
				}
				
				if (scheduled === 'plugin') {
					job.splugin = chosen_timing.plugin_id;
					
					deferred_jobs.push( Tools.mergeHashes( chosen_timing, {
						timezone: chosen_timing.timezone || default_tz,
						dargs: tzargs[chosen_timing.timezone || default_tz],
						now: cursor,
						job: job
					}));
					
					continue;
				}
				
				self.logDebug(4, "Auto-launching scheduled event: " + event.id + " (" + event.title + ") for timestamp: " + date.toString(), schedules );
				self.launchJob(job);
			} // while cursor
			
			// update event cursor state if in catch-up mode
			if (catch_up) self.putState( 'events/' + event.id + '/cursor', cursor );
			
		} ); // events.forEach
		
		// handle deferred jobs (scheduler plugins)
		if (deferred_jobs.length) {
			this.handleSchedulerPluginJobs(deferred_jobs);
		}
		
		this.logDebug(9, "Scheduler tick complete");
	}
	
	handleSchedulerPluginJobs(deferred_jobs, callback) {
		// handle ticked jobs with scheduler plugins
		// { plugin_id, params, timezone, dargs, now, job }
		var self = this;
		this.logDebug(9, "Processing " + deferred_jobs.length + " deferred (plugin) jobs");
		
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
					self.logError('scheduler', "Scheduler Plugin not found: " + plugin_id + ", skipping launches", { count: items.length } );
					return callback();
				}
				if (!plugin.enabled) {
					self.logDebug(6, "Scheduler Plugin is disabled: " + plugin_id + ", skipping launches", { count: items.length } );
					return callback();
				}
				
				self.execSchedulerPlugin(plugin, items, callback);
			},
			function() {
				self.logDebug(9, "Deferred schedule launches complete");
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
		
		var child_opts = {
			cwd: plugin.cwd || os.tmpdir(),
			env: Tools.copyHash( process.env ),
			timeout: (plugin.timeout || 30) * 1000
		};
		
		child_opts.env['ORCHESTRA'] = this.server.__version;
		
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
		
		this.logDebug(9, "Firing Scheduler Plugin: " + plugin.id + " for " + items.length + " potential job launches: " + child_cmd);
		
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
				self.logError('scheduler', "Failed to launch Scheduler Plugin: " + plugin.id + ": " + err, { cmd: child_cmd, stdout, stderr });
				self.logTransaction('warning', "Failed to launch Scheduler Plugin: " + plugin.id + ": " + err);
				return callback();
			}
			if (!json.orchestra || !json.items || !json.items.length) {
				self.logError('scheduler', "Unexpected result from Scheduler Plugin: " + plugin.id, { cmd: child_cmd, stdout, stderr });
				self.logTransaction('warning', "Unexpected result from Scheduler Plugin: " + plugin.id);
				return callback();
			}
			
			self.logDebug(9, "Scheduler Plugin Completed", { child_cmd, stderr } );
			
			// see which items the plugin says to launch
			json.items.forEach( function(result, idx) {
				if (!result.launch) return;
				var item = items[idx];
				
				// go for launch!
				var date = new Date( item.now * 1000 );
				self.logDebug(4, "Auto-launching deferred scheduled event: " + item.job.id + " for timestamp: " + date.toString(), {
					plugin: plugin.id
				} );
				self.launchJob( result.job || item.job );
			} ); // foreach item
			
			callback();
		} ); // cp.exec
		
		// Write data to child's stdin
		child.stdin.on('error', noop);
		child.stdin.write( JSON.stringify({ orchestra: true, items }) + "\n" );
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
