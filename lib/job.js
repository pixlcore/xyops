// Orchestra Multi-Master Job Layer
// Copyright (c) 2022 - 2024 Joseph Huckaby

const fs = require('fs');
const zlib = require('zlib');
const Path = require('path');
const cp = require('child_process');
const async = require("async");
const marked = require('marked');
const sanitizeHtml = require('sanitize-html');
const Tools = require("pixl-tools");

class Jobs {
	
	launchJob(job, callback) {
		// begin job launch sequence
		var self = this;
		
		// jobs come in as a copy of the event
		// so move the event id into job.event
		if (job.id) job.event = job.id;
		
		// remove event stuff we don't need
		delete job.id;
		delete job.title;
		delete job.enabled;
		delete job.timings;
		delete job.session_id;
		delete job.modified;
		delete job.created;
		
		if (!job.limits) job.limits = [];
		if (!job.actions) job.actions = [];
		
		// unique id for job
		job.id = Tools.generateShortID('j');
		
		// merge in category actions and res limits
		var event = Tools.findObject( this.events, { id: job.event } );
		var plugin = Tools.findObject( this.plugins, { id: job.plugin } );
		var category = Tools.findObject(this.categories, { id: job.category });
		
		(category.actions || []).forEach( function(action) {
			// append cat actions
			job.actions.push( Tools.copyHash(action, true) );
		} );
		
		(category.limits || []).forEach( function(limit) {
			// merge cat limits with unique types, allow job to override others
			if (!Tools.findObject(job.limits, { type: limit.type })) {
				job.limits.push( Tools.copyHash(limit, true) );
			}
		} );
		
		// make sure all necessary things are enabled
		// early exit for these
		if (!event.enabled) {
			var err_msg = "Event is disabled: " + event.title;
			// this.abortJob(job, err_msg);
			if (callback) callback( new Error(err_msg) );
			return;
		}
		if (!category.enabled) {
			var err_msg = "Category is disabled: " + category.title;
			// this.abortJob(job, err_msg);
			if (callback) callback( new Error(err_msg) );
			return;
		}
		if (!plugin.enabled) {
			var err_msg = "Plugin is disabled: " + plugin.title;
			// this.abortJob(job, err_msg);
			if (callback) callback( new Error(err_msg) );
			return;
		}
		
		// copy over plugin's command, cwd and uid (satellite won't have these)
		job.command = plugin.command;
		job.script = plugin.script || "";
		job.uid = plugin.uid;
		job.gid = plugin.gid;
		job.cwd = plugin.cwd;
		
		// plugin params may have changed outside of event, so recopy missing ones
		if (plugin.params) plugin.params.forEach( function(param) {
			if (!(param.id in job.params)) {
				if (param.type == 'select') job.params[ param.id ] = param.value.replace(/\,.+$/, '');
				else job.params[ param.id ] = param.value;
			}
		} );
		
		// custom env vars for job
		if (!job.env) job.env = Tools.copyHash( this.config.get('job_env') || {} );
		
		// initial state (may be passed in, i.e. startup/retry delays)
		if (!job.state) job.state = 'ready';
		job.started = Tools.timeNow();
		
		// job may be passed in a custom "now" from the scheduler (to run catch-up events)
		if (!job.now) job.now = job.started;
		
		// keep track of job log size
		job.log_file_size = 0;
		
		// add to activeJobs hash
		this.activeJobs[ job.id ] = job;
		this.jobDetails[ job.id ] = {};
		
		// start meta log (in memory)
		this.appendMetaLog(job, "Orchestra job starting: " + job.id );
		this.appendMetaLog(job, "Source: " + Tools.ucfirst(job.source) + (job.splugin ? (' (' + job.splugin + ')') : '') );
		if (job.workflow) this.appendMetaLog(job, "Workflow ID: " + job.workflow );
		this.appendMetaLog(job, "Event ID: " + job.event );
		// this.appendMetaLog(job, "Date/Time: " + (new Date()).toString() );
		
		// log job start
		this.logDebug(6, "Starting job", job);
		
		// at this point the job is ready to go into service, and will be maintained by the tick loop.
		// this is important because the job may have a startup delay (retry or other) and we don't want to pick a target server until it goes into active state.
		if (callback) callback(null, job.id);
		
		// monitor job immediately, so there isn't a ~1 second delay for all launches
		this.monitorJob(job);
		
		// add meta msg for delay if set
		if (job.until) {
			this.appendMetaLog(job, "Job will be delayed until: " + (new Date(job.until * 1000)).toString() );
		}
		
		// notify all connected users that a job has changed
		this.doUserBroadcastAll( 'status', { 
			epoch: Tools.timeNow(),
			activeJobs: this.getActiveJobs(),
			jobsChanged: true
		} );
	}
	
	appendJobLog(job, msg, data) {
		// append user-generated output to job log
		msg = '' + msg; // ensure string
		var log_file = Path.resolve( Path.join( this.config.get('log_dir'), 'jobs', job.id + '.log' ) );
		fs.appendFileSync( log_file, msg );
		job.log_file_size += Buffer.byteLength(msg);
		
		// if any users are sitting on the job detail page for this specific job, stream up the log additions in real-time
		// FUTURE NOTE: Savvy users can "cheat" category/group privilege here and tail any live job log if they know the ID.
		this.doPageBroadcast( 'Job?id=' + job.id, 'log_append', { text: msg } );
	}
	
	appendMetaLog(job, msg, data, server_id) {
		// append message to special "meta" log inside the job object
		var info = this.jobDetails[ job.id ];
		if (!info) return; // sanity check
		
		this.logDebug(6, "Job " + job.id + " Meta: " + msg, data);
		
		if (!info.activity) info.activity = [];
		var row = { epoch: Tools.timeNow(), msg: ''+msg };
		row.server = server_id || this.hostID;
		
		info.activity.push(row);
		
		// keep it under control
		if (info.activity.length > 1000) info.activity.shift();
	}
	
	monitorJobs() {
		// monitor all active jobs, called every tick
		var self = this;
		var queues = {};
		if (!this.master) return;
		
		Object.values(this.activeJobs).forEach( function(job) {
			self.monitorJob(job);
			
			if (job.state == 'queued') {
				if (!queues[job.event]) queues[job.event] = [];
				queues[job.event].push(job);
			}
		} ); // foreach job
		
		// check queues for available slots
		for (var event_id in queues) {
			var queued = queues[event_id];
			var jobs = this.findActiveJobs({ event: event_id, state: 'active' });
			var job_limit = jobs.length ? Tools.findObject( jobs[0].limits, { type: 'job', enabled: true } ) : null;
			
			if (job_limit && (jobs.length < job_limit.amount)) {
				// we have room!  launch queued job waiting the longest
				Tools.sortBy( queued, 'started', { type: 'number', dir: 1 } );
				var job = queued[0];
				
				this.appendMetaLog(job, "Moving job state from queued to ready");
				job.state = 'ready';
				this.monitorJob(job);
				
				// notify all connected users that a job has changed
				this.doUserBroadcastAll( 'status', { 
					epoch: Tools.timeNow(),
					activeJobs: this.getActiveJobs(),
					jobsChanged: true
				} );
				
				// FUTURE NOTE: This will only launch a max of 1 queued job per event per second (per tick)
			}
		} // foreach queue
	}
	
	monitorJob(job) {
		// monitor job progress / state changes
		var self = this;
		var now = Tools.timeNow();
		
		switch (job.state) {
			case 'retry_delay':
			case 'start_delay':
				if (now >= job.until) {
					this.appendMetaLog(job, "Moving job state from " + job.state + " to ready");
					job.state = 'ready';
					delete job.until;
				}
			break;
			
			case 'ready':
				// job is ready to start, check limits
				if (!this.checkJobStartLimits(job)) return;
				
				// pick server
				if (!this.chooseJobServer(job)) return;
				
				// fire job start hooks/actions
				this.runJobActions(job, 'start', function() {
					// set state to 'active'
					self.appendMetaLog(job, "Moving job state from " + job.state + " to active");
					job.state = 'active';
					job.started = now; // reset this to now
					job.updated = now; // for stale check
					job.progress = 0;
					
					// send command to server
					var server = self.servers[ job.server ];
					var socket = self.sockets[ server.socket_id ];
					if (!socket) {
						// should never happen, mostly a sanity check
						self.abortJob(job, "Chosen server has no socket connection.");
						return false;
					}
					
					self.appendMetaLog(job, "Sending launch command to remote server");
					socket.send('launch_job', {
						job: job
					});
					job.remote = true;
					
					// add job to active alerts on target server
					self.findActiveAlerts({ server: job.server }).forEach( function(alert) {
						alert.jobs.push( job.id );
						if (alert.jobs.length > 100) alert.jobs.shift();
						self.unbase.update( 'alerts', alert.id, { jobs: alert.jobs } );
					} );
				}); // runJobAction
			break;
			
			case 'active':
				// check all limits, check for stale update, etc.
				this.checkJobActiveLimits(job);
			break;
		} // switch job.state
	}
	
	getActiveJobs() {
		// get copy of active jobs for client, sans queued jobs -- return as hash
		// (there may be thousands of queued jobs -- no need to sync them to all clients every second)
		var jobs = {};
		
		for (var id in this.activeJobs) {
			if (this.activeJobs[id].state != 'queued') jobs[id] = this.activeJobs[id];
		}
		
		return jobs;
	}
	
	findActiveJobs(criteria) {
		// find active jobs matching criteria -- return array
		return Tools.findObjects( Object.values(this.activeJobs), criteria );
	}
	
	checkJobActiveLimits(job) {
		// check job running limits and stale updates
		var now = Tools.timeNow();
		
		if (now - job.updated >= this.config.get('dead_job_timeout')) {
			// job has timed out (no updates, server must be dead)
			job.retry_ok = true; // allow retry even though we're aborting
			this.abortJob(job, "No updates received in last " + Tools.getTextFromSeconds(this.config.get('dead_job_timeout')) + ", assuming job is dead.");
			return;
		}
		
		// time limit
		var time_limit = Tools.findObject( job.limits, { type: 'time', enabled: true } );
		if (time_limit && time_limit.amount && (now - job.started > time_limit.amount)) {
			// job time limit has been reached
			job.retry_ok = true; // allow retry even though we're aborting
			this.abortJob(job, "Job time limit of " + Tools.getTextFromSeconds(time_limit.amount) + " has been exceeded.");
			return;
		}
		
		// log file size limit
		var log_limit = Tools.findObject( job.limits, { type: 'log', enabled: true } );
		if (log_limit && log_limit.amount && (job.log_file_size > log_limit.amount)) {
			job.retry_ok = true; // allow retry even though we're aborting
			this.abortJob(job, "Job log file size has exceeded maximum size limit of " + Tools.getTextFromBytes(log_limit.amount) + ".");
			return;
		}
		
		// memory limit (+sustain)
		var mem_limit = Tools.findObject( job.limits, { type: 'mem', enabled: true } );
		if (mem_limit && job.mem) {
			if (!job.flags) job.flags = {};
			if (job.mem.current > mem_limit.amount) {
				if (!job.flags.mem) {
					job.flags.mem = now;
					this.logDebug(6, "Job has exceeded memory usage limit: " + job.id, job.mem);
				}
				if (now - job.flags.mem > mem_limit.duration) {
					this.abortJob(job, "Job memory has exceeded maximum limit of " + Tools.getTextFromBytes(mem_limit.amount) + " for " + Tools.getTextFromSeconds(mem_limit.duration, false, true) + ".");
					return;
				}
			}
			else if (job.flags.mem) {
				this.logDebug(6, "Job is now under the memory usage limit: " + job.id, job.mem);
				delete job.flags.mem;
			}
		}
		
		// cpu limit (+sustain)
		var cpu_limit = Tools.findObject( job.limits, { type: 'cpu', enabled: true } );
		if (cpu_limit && job.cpu) {
			if (!job.flags) job.flags = {};
			if (job.cpu.current > cpu_limit.amount) {
				if (!job.flags.cpu) {
					job.flags.cpu = now;
					this.logDebug(6, "Job has exceeded CPU usage limit: " + job.id, job.cpu);
				}
				if (now - job.flags.cpu > cpu_limit.duration) {
					this.abortJob(job, "Job CPU has exceeded maximum limit of " + Tools.getTextFromBytes(cpu_limit.amount) + "% for " + Tools.getTextFromSeconds(cpu_limit.duration, false, true) + ".");
					return;
				}
			}
			else if (job.flags.cpu) {
				this.logDebug(6, "Job is now under the CPU usage limit: " + job.id, job.cpu);
				delete job.flags.cpu;
			}
		}
	}
	
	checkJobStartLimits(job) {
		// make sure job can run - if not, possibly queue up
		var job_limit = Tools.findObject( job.limits, { type: 'job', enabled: true } );
		
		if (job_limit && job_limit.amount) {
			var jobs = this.findActiveJobs({ event: job.event, state: 'active' });
			
			if (jobs.length >= job_limit.amount) {
				// job limit reached -- can we queue?
				var queue_limit = Tools.findObject( job.limits, { type: 'queue', enabled: true } );
				
				if (queue_limit && queue_limit.amount) {
					var queued = this.findActiveJobs({ event: job.event, state: 'queued' });
					
					if (queued.length < queue_limit.amount) {
						// room in queue, yay!
						this.appendMetaLog(job, "Moving job state from " + job.state + " to queued");
						job.state = 'queued';
						return false; // stop processing job launch
					}
					else {
						// queue is full
						this.abortJob(job, "Maximum number of concurrent jobs for event has been reached, and the queue is maxed out.");
						return false;
					}
				}
				else {
					// no can run
					this.abortJob(job, "Maximum number of concurrent jobs for event has been reached.");
					return false;
				}
			} // limit reached
		} // have limit
		
		// make sure event is still around and active
		var event = Tools.findObject( this.events, { id: job.event } );
		if (!event) {
			this.abortJob(job, "Event was deleted: " + job.event);
			return false;
		}
		if (!event.enabled) {
			this.abortJob(job, "Event was disabled: " + event.title);
			return false;
		}
		
		// job is go for active
		return true;
	}
	
	filterServerByAlerts(server_id) {
		// filter server out of available set by which alerts are active (e.g. alert.limit_jobs)
		var self = this;
		
		var server_alerts = Object.values(this.activeAlerts).filter( function(alert) {
			if (alert.server != server_id) return false;
			
			var alert_def = Tools.findObject( self.alerts, { id: alert.alert } );
			return (alert_def && alert_def.limit_jobs);
		} );
		
		return !server_alerts.length;
	}
	
	chooseJobServer(job) {
		// pick a server for the job
		var self = this;
		var server_ids = [];
		var server_id = '';
		
		// gather all server candidates (targets may be groups and/or servers)
		(job.targets || []).forEach( function(target) {
			if (self.servers[target]) {
				server_ids.push(target);
				return;
			}
			
			var group = Tools.findObject( self.groups, { id: target } );
			if (!group) return;
			
			Object.values(self.servers).forEach( function(server) {
				if (server.groups.includes(group.id)) server_ids.push( server.id );
			} );
		} );
		
		// filter by actual online servers at the present moment
		server_ids = server_ids.filter( function(server_id) {
			return self.servers[server_id] && self.servers[server_id].enabled;
		} );
		
		// certain alerts being active may remove server from candidates
		server_ids = server_ids.filter( this.filterServerByAlerts.bind(this) );
		
		// do we have at least one online server?  If not, abort or queue the job
		if (!server_ids.length) {
			this.appendMetaLog(job, "No available servers matching targets", { targets: job.targets });
			
			// no servers available, but we might be able to queue it
			var queue_limit = Tools.findObject( job.limits, { type: 'queue', enabled: true } );
			
			if (queue_limit && queue_limit.amount) {
				var queued = this.findActiveJobs({ event: job.event, state: 'queued' });
				
				if (queued.length < queue_limit.amount) {
					// room in queue, yay!
					this.appendMetaLog(job, "Moving job state from " + job.state + " to queued");
					job.state = 'queued';
					return false; // stop processing job launch
				}
				else {
					// queue is full
					job.retry_ok = true; // allow retry even though we're aborting
					this.abortJob(job, "No available servers matching targets, and the queue is full.");
					return false;
				}
			}
			else {
				// no can run
				job.retry_ok = true; // allow retry even though we're aborting
				this.abortJob(job, "No available servers matching targets.");
				return false;
			}
		} // no servers found
		
		// sort by hostname (for prefer_* algos)
		server_ids.sort( function(a, b) {
			return self.servers[a].hostname.localeCompare( self.servers[b].hostname );
		} );
		
		switch (job.algo) {
			case 'random':
				server_id = Tools.randArray(server_ids);
			break;
			
			case 'round_robin':
				var robin = this.getState( 'events/' + job.event + '/robin' ) || 0;
				server_id = server_ids[ robin % server_ids.length ];
				robin = (robin + 1) % server_ids.length;
				this.putState( 'events/' + job.event + '/robin', robin );
			break;
			
			case 'prefer_first':
				server_id = server_ids[0];
			break;
			
			case 'prefer_last':
				server_id = server_ids[ server_ids.length - 1 ];
			break;
			
			case 'least_cpu':
				Object.values(this.servers).forEach( function(server) {
					if (!server_id || (server.info.cpu.avgLoad < self.servers[server_id].info.cpu.avgLoad)) server_id = server.id;
				} );
			break;
			
			case 'least_mem':
				Object.values(this.servers).forEach( function(server) {
					if (!server_id || (server.info.memory.active < self.servers[server_id].info.memory.active)) server_id = server.id;
				} );
			break;
			
			default:
				// least monitor value
				var mon_def = Tools.findObject( this.monitors, { id: job.algo.replace(/^monitor:/, '') } );
				if (!mon_def) {
					this.abortJob(job, "Unknown algorithm or monitor: " + job.algo);
					return false;
				}
				
				Object.values(this.servers).forEach( function(server) {
					if (!server_id) { 
						server_id = server.id; 
						return; 
					}
					
					var cur_value = 0;
					if (mon_def.delta) cur_value = server.info.deltas[mon_def.id] || 0;
					else cur_value = server.info.monitors[mon_def.id] || 0;
					
					var prev_value = 0;
					if (mon_def.delta) prev_value = self.servers[server_id].info.deltas[mon_def.id] || 0;
					else prev_value = self.servers[server_id].info.monitors[mon_def.id] || 0;
					
					if (cur_value < prev_value) server_id = server.id;
				} );
			break;
		} // switch algo
		
		this.logDebug(8, "Chose server for job", {
			server_id: server_id,
			server_hostname: this.servers[server_id].hostname,
			job_id: job.id,
			algo: job.algo
		});
		this.appendMetaLog(job, "Chosen server: " + this.servers[server_id].hostname + " (" + job.algo + ")" );
		
		job.server = server_id;
		return true;
	}
	
	pruneProcsForTimeline(procs) {
		// create slimmed-down version of procs for `second` timeline
		// all we need is cpu, memRss, and command
		var slims = {};
		for (var pid in procs) {
			var { cpu, memRss, command, disk, net } = procs[pid];
			slims[pid] = { cpu, memRss, command, disk, net };
		}
		return slims;
	}
	
	updateJobData(socket, data) {
		// receive job update from satellite
		// may contain multiple jobs, and apply updates as shallow merges to each
		var self = this;
		var now = Tools.timeNow();
		
		Object.values(data).forEach( function(updates) {
			var job_id = updates.id;
			updates.updated = now;
			
			// for sanity, make sure update doesn't contain certain special keys
			delete updates.activity;
			delete updates.log_file;
			delete updates.log_file_size;
			
			// locate master job record
			var job = self.activeJobs[job_id];
			var info = self.jobDetails[job_id];
			if (!job || !info) {
				// should never happen, sanity check
				self.logDebug(9, "Job not found, updates not applied: " + job_id, updates);
				return;
			}
			if (job.state == 'complete') {
				// should never happen, sanity check
				self.logDebug(9, "Job is already complete, updates not applied: " + job_id, updates);
				return;
			}
			
			// handle sec timeline (procs)
			if (updates.procs) {
				if (!info.timelines) info.timelines = {};
				if (!info.timelines.second) info.timelines.second = [];
				if (!info.timelines.minute) info.timelines.minute = [];
				
				// keep up to 5 minutes of second data
				info.timelines.second.push({ epoch: now, procs: self.pruneProcsForTimeline(updates.procs) });
				if (info.timelines.second.length > 300) info.timelines.second.shift();
				
				// keep up to 24 hours of minute snaps
				var cur_min_epoch = Tools.normalizeTime( now, { sec: 0 } );
				
				if (!info.timelines.minute.length || (info.timelines.minute[ info.timelines.minute.length - 1 ].epoch != cur_min_epoch)) {
					var item = {
						epoch: cur_min_epoch, 
						procs: updates.procs || {}, 
						conns: updates.conns || [] 
					};
					
					info.timelines.minute.push(item);
					if (info.timelines.minute.length > 1440) info.timelines.minute.shift();
					
					// update page users
					self.doPageBroadcast( 'Job?id=' + job.id, 'minute_append', item );
				} // minute
			} // procs
			
			// make sure these are not mutated directly
			delete updates.actions;
			delete updates.limits;
			
			// push system (for adding actions, limits, tags, etc.)
			if (updates.push) {
				for (var key in updates.push) {
					if (!job[key]) job[key] = [];
					job[key] = job[key].concat( updates.push[key] );
				}
				delete updates.push;
			}
			
			// transmogrify markdown and text into html, then sanitize it
			if (updates.markdown && updates.markdown.content) {
				updates.html = updates.markdown;
				updates.html.content = '<div class="markdown-body">' + marked( updates.html.content, self.config.getPath('ui.marked_config') ) + '</div>';
				delete updates.markdown;
			}
			else if (updates.text && updates.text.content) {
				updates.html = updates.text;
				updates.html.content = '<pre>' + updates.text.content.toString().replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
				delete updates.text;
			}
			
			if (updates.html && updates.html.content) {
				updates.html.content = sanitizeHtml( updates.html.content, self.config.getPath('ui.sanitize_html_config') );
			}
			
			// bring in updates, shallow merge
			Tools.mergeHashInto(job, updates);
			
			// if new job state is `complete` then it's done, and no more updates will come in
			if (updates.state == 'complete') self.finishJob(job);
		} ); // foreach job update
	}
	
	abortJob(job, reason) {
		// abort job
		if (job.remote) {
			// job is running remotely, so request an abort
			var server = this.servers[ job.server ];
			if (!server) {
				// should never happen, mostly a sanity check
				this.logError('job', "Job server not found: " + job.server, { job_id: job.id });
				delete job.remote;
				return this.abortJob(job, reason);
			}
			
			var socket = this.sockets[ server.socket_id ];
			if (!socket) {
				// should never happen, mostly a sanity check
				this.logError('job', "Server socket not found: " + server.socket_id, { job_id: job.id, server_id: job.server });
				delete job.remote;
				return this.abortJob(job, reason);
			}
			
			socket.send('abort_job', {
				id: job.id,
				reason: reason
			});
		}
		else {
			// no remote connection, just finish job now
			this.appendMetaLog(job, "Aborting Job: " + reason);
			
			job.code = 'abort';
			job.description = reason;
			job.complete = true;
			job.state = 'complete';
			this.finishJob(job);
		}
	}
	
	finishJob(job) {
		// job is done done
		var self = this;
		
		job.completed = Tools.timeNow();
		job.elapsed = job.completed - job.started;
		job.state = 'complete'; // prevent further updates
		
		// prune props
		delete job.remote;
		delete job.redraw;
		
		// prep job log (user-generated) for upload
		var log_file = Path.resolve( Path.join( this.config.get('log_dir'), 'jobs', job.id + '.log' ) );
		var stats = null;
		try { stats = fs.statSync( log_file ); }
		catch (err) {
			this.logDebug(6, "No job log file found (may be totally normal): " + log_file + ": " + err);
			stats = { size: 0 };
		}
		
		// grab job log size, for notifications
		job.log_file_size = stats.size;
		
		// upload job log in the background
		this.uploadJobLog(job);
		
		// add universal action triggers from config
		if (!job.actions) job.actions = [];
		job.actions = job.actions.concat( this.config.get('job_universal_actions') );
		
		// check for retry
		if (job.code && ((job.code != 'abort') || job.retry_ok)) this.checkRetryJob(job);
		
		// get list of action triggers to fire all at once, but only if we did NOT retry
		var triggers = [];
		
		if (!job.retried) {
			// no retry, so add actions
			triggers.push('complete');
			
			if (job.code) {
				triggers.push('error');
				if (job.code.toString().match(/^(warning|critical|abort)$/)) triggers.push(job.code);
			}
			else triggers.push('success');
			
			// custom actions for custom tags
			if (job.tags) triggers = triggers.concat( job.tags.map( function(tag) { return 'tag:' + tag; } ) );
		}
		
		this.runJobActions(job, triggers, function() {
			// actions complete, now we can really complete the job
			
			// pull out update_event from job, save for later
			var update_event = job.update_event || false;
			delete job.update_event;
			
			// pull out update_event from job, save for later
			var delete_event = job.delete_event || false;
			delete job.delete_event;
			
			// add internal tag for success or error (for searches)
			if (!job.tags) job.tags = [];
			job.tags.push( job.code ? '_error' : '_success' );
			job.tags.push( job.retried ? '_retried' : '_last' );
			
			// dedupe tags array
			job.tags = [...new Set(job.tags)];
			
			// appendMetaLog one final time, include code and description
			if (job.code == 'abort') self.appendMetaLog(job, "Job aborted: " + job.description);
			else if (job.code) self.appendMetaLog(job, "Job failed: " + job.description + " (" + job.code + ")");
			else self.appendMetaLog(job, "Job completed successfully.");
			
			// mark tail of log
			// self.appendMetaLog(job, "End of log");
			
			// merge details into combo job record
			var combo_job = Tools.mergeHashes( job, self.jobDetails[ job.id ] || {} );
			
			// this is our final form
			combo_job.final = true;
			
			// add disk and net averages
			self.calcAvgDiskNet(combo_job);
			
			// remove junk (these live on in timelines.minute)
			delete combo_job.procs;
			delete combo_job.conns;
			
			// update event state, for UI hints and such
			if (!self.state.events) self.state.events = {};
			if (!self.state.events[job.event]) self.state.events[job.event] = {};
			var event_state = self.state.events[job.event];
			event_state.last_job = job.id;
			event_state.last_code = job.code;
			event_state.total_elapsed = (event_state.total_elapsed || 0) + job.elapsed;
			event_state.total_count = (event_state.total_count || 0) + 1;
			self.state.dirty = true;
			
			// update daily stats
			self.updateDailyStat( 'job_log_file_size', job.log_file_size || 0 );
			self.updateDailyStat( 'job_elapsed', job.elapsed || 0 );
			self.updateDailyStat( 'job_files', job.files ? job.files.length : 0 );
			
			// send updated stats over to connected users
			self.doUserBroadcastAll( 'update', { stats: self.stats } );
			
			// upload job JSON data to storage and index it
			self.unbase.insert( 'jobs', job.id, combo_job, function(err) {
				if (err) self.logError('db', "Failed to index job: " + job.id + ": " + err);
				else self.logDebug(6, "Job is fully indexed in the DB: " + job.id);
				
				// remove from active jobs
				delete self.activeJobs[ job.id ];
				delete self.jobDetails[ job.id ];
				
				// notify all connected users that a job has changed
				self.doUserBroadcastAll( 'status', { 
					epoch: Tools.timeNow(),
					activeJobs: self.getActiveJobs(),
					jobsChanged: true,
					state: Tools.copyHashRemoveKeys( self.state, { dirty: 1 } )
				} );
				
				// and notify all job watchers that the job is fully complete
				self.doPageBroadcast( 'Job?id=' + job.id, 'job_completed', {} );
				
				// TODO: manage workflow here (only advance/skip if job wasn't retried! see `job.retried` set in checkRetryJob())
				// if (job.workflow) this.finishWorkflowJob(job);
				
			} ); // unbase.insert
			
			// handle delete_event/update_event in parallel with unbase op
			if (delete_event) {
				var event = Tools.findObject( self.events, { id: job.event } ); // TODO: workflows: The `job.event` is the WORKFLOW event!!!
				if (!event) {
					self.logError('event', "Event not found: " + job.event + ", cannot delete from job: " + job.id);
					return;
				}
				
				self.logDebug(6, "Deleting event: " + event.id);
				
				self.storage.listFindDelete( 'global/events', { id: event.id }, function(err, event) {
					if (err) {
						self.logError('event', "Failed to delete event: " + err);
						return;
					}
					
					self.logDebug(6, "Successfully deleted event: " + event.title, event);
					self.logTransaction('event_delete', event.title, self.getClientInfo(args, { event: event, keywords: [ event.id ], reason: 'job' }));
					
					// cleanup (remove) event state
					self.deleteState( 'events/' + event.id );
					
					// update cache in background
					self.storage.listGet( 'global/events', 0, 0, function(err, items) {
						if (err) {
							// this should never fail, as it should already be cached
							self.logError('storage', "Failed to cache events: " + err);
							return;
						}
						self.events = items;
						self.doUserBroadcastAll('update', { events: items });
					});
				} ); // listFindDelete
			}
			else if (update_event) {
				var event = Tools.findObject( self.events, { id: job.event } ); // TODO: workflows: The `job.event` is the WORKFLOW event!!!
				if (!event) {
					self.logError('event', "Event not found: " + job.event + ", cannot apply updates from job: " + job.id, update_event);
					return;
				}
				
				update_event.modified = job.completed;
				self.logDebug(6, "Updating event: " + event.id, update_event);
				
				self.storage.listFindUpdate( 'global/events', { id: event.id }, update_event, function(err, event) {
					if (err) {
						self.logError('event', "Failed to update event: " + err);
						return;
					}
					
					self.logDebug(6, "Successfully updated event: " + event.title, update_event);
					self.logTransaction('event_update', event.title, { event: event, keywords: [ event.id ], reason: 'job' });
					
					// update cache in background
					self.storage.listGet( 'global/events', 0, 0, function(err, items) {
						if (err) {
							// this should never fail, as it should already be cached
							self.logError('storage', "Failed to cache events: " + err);
							return;
						}
						self.events = items;
						self.doUserBroadcastAll('update', { events: items });
					}); // listGet
				} ); // listFindUpdate
			} // update_event
		}); // runJobActions
	}
	
	uploadJobLog(job) {
		// upload job log in background (and compress w/gzip on the way)
		var self = this;
		var log_path = 'logs/jobs/' + job.id + '/log.txt.gz';
		var log_file = Path.resolve( Path.join( this.config.get('log_dir'), 'jobs', job.id + '.log' ) );
		
		if (!log_file || !job.log_file_size) return; // no job log
		
		this.logDebug(6, "Uploading job log: " + log_file + " to: " + log_path);
		
		var inp = fs.createReadStream( log_file );
		inp.on('error', function(err) {
			self.logError('fs', "Read stream failed: " + log_file + ": " + err);
		});
		
		var gzip = zlib.createGzip( this.config.get('gzip_opts') || {} );
		gzip.on('error', function(err) {
			self.logError('fs', "Gzip stream failed: " + log_file + ": " + err);
		});
		
		inp.pipe(gzip);
		
		this.storage.putStream( log_path, gzip, function(err) {
			if (err) self.logError('storage', "Failed to upload job log: " + log_path + ": " + err);
			else {
				self.logDebug(6, "Job log uploaded successfully: " + log_path);
				
				// notify connected users that job log is ready
				// (use new system to see which users are on the job details page)
				self.doPageBroadcast( 'Job?id=' + job.id, 'log_uploaded', {} );
			}
			
			fs.unlink( log_file, function(err) {
				if (err) self.logError('fs', "Failed to delete log file: " + log_file + ": " + err);
			} );
		} ); // storage.putStream
	}
	
	checkRetryJob(job) {
		// check if job can be retried
		var self = this;
		var retry_limit = Tools.findObject( job.limits, { type: 'retry', enabled: true } );
		if (!retry_limit || !retry_limit.amount) return;
		if (!job.retry_count) job.retry_count = 0;
		
		if (job.retry_count < retry_limit.amount) {
			// yes launch retry now
			var event = Tools.findObject( this.events, { id: job.event } ); // TODO: for jobs inside workflows the "event" IS the workflow!  This will not fly.
			if (!event) {
				this.appendMetaLog(job, "Event not found: " + job.event + " (cannot retry)" );
				return;
			}
			var new_job = Tools.copyHash(event, true);
			
			// copy over some key things from current job
			['params', 'source', 'api_key', 'username', 'parent', 'workflow', 'retry_count'].forEach( function(key) {
				if (key in job) new_job[key] = job[key];
			} );
			
			// increment retry counter, and add link to old job in new
			new_job.retry_count++;
			new_job.retry_prev = job.id;
			
			// optional retry delay
			if (retry_limit.duration) {
				new_job.state = 'retry_delay';
				new_job.until = Tools.timeNow() + retry_limit.duration;
			}
			
			this.appendMetaLog(job, "Launching retry #" + new_job.retry_count + " of " + retry_limit.amount );
			this.logDebug(6, "Launching job for retry (" + new_job.retry_count + " / " + retry_limit.amount + ")", retry_limit);
			
			this.launchJob(new_job, function(err, id) {
				if (err) self.appendMetaLog(job, "Failed to launch event for retry: " + (err.message || err));
				else {
					self.appendMetaLog(job, "Launched job for retry: " + id);
					
					// populate jobs array in current job
					if (!job.jobs) job.jobs = [];
					job.jobs.push({ id, reason: 'retry' });
					
					// add flag for workflow to sniff
					job.retried = true;
				}
			});
		}
		else {
			// out of retries
			this.appendMetaLog(job, "Reached retry limit (" + retry_limit.amount + "), will not retry job.");
		}
		
		delete job.retry_ok;
	}
	
	calcAvgDiskNet(job) {
		// calc avg disk and net using minute timeline
		// disk is delta, net is only minute level
		job.disk = { total: 0, count: 0 };
		job.net = { total: 0, count: 0 };
		
		if (!job.timelines || !job.timelines.minute) return;
		var last_min = null;
		
		job.timelines.minute.forEach( function(minute) {
			// { epoch, conns, procs }
			var conns = minute.conns || [];
			conns.forEach( function(conn) { job.net.total += conn.delta || 0; } );
			job.net.count++;
			
			if (last_min) {
				// convert absolute disk counters to deltas at the process level
				var procs = minute.procs || {};
				var last_procs = last_min.procs || {};
				
				for (var pid in procs) {
					var proc = procs[pid];
					var last_proc = last_procs[pid] || null;
					if (proc.disk && last_proc && last_proc.disk) {
						job.disk.total += (proc.disk - last_proc.disk);
					}
				}
				
				job.disk.count += (minute.epoch - last_min.epoch);
			} // last_min
			
			last_min = minute;
		} ); // foreach minute
	}
	
	getJobLogExcerpt(job, callback) {
		// get job log excerpt, suitable for inclusion in a text email
		// grab first 32K of log file, if applicable
		var self = this;
		var log_file = Path.resolve( Path.join( this.config.get('log_dir'), 'jobs', job.id + '.log' ) );
		var log_fd = null;
		var log_stats = null;
		var log_chunk_size = this.config.get('log_excerpt_size') || 32678;
		var log_buffer = Buffer.alloc(log_chunk_size);
		var excerpt = '';
		
		async.series([
			function(callback) {
				fs.open(log_file, 'r', function(err, fd) {
					log_fd = fd;
					callback(err);
				} );
			},
			function(callback) {
				fs.fstat(log_fd, function(err, stats) {
					log_stats = stats;
					callback(err);
				} );
			},
			function(callback) {
				// must first 32K or so
				fs.read(log_fd, log_buffer, 0, log_chunk_size, 0, function(err, bytesRead, buffer) {
					if (err) return callback(err);
					if (!bytesRead) return callback("ABORT");
					
					var slice = buffer.slice( 0, bytesRead );
					var text = slice.toString().trim();
					
					// if file size is <= log_excerpt_size, just return entire file, no snip
					if (log_stats.size <= log_chunk_size) {
						excerpt = text;
						return callback("ABORT");
					}
					
					// need to do first/last, but half chunk size each
					log_chunk_size = Math.floor( log_chunk_size / 2 );
					slice = buffer.slice( 0, log_chunk_size );
					text = slice.toString().trim();
					
					excerpt = text + "...\n\n~~~ Snip ~~~\n";
					callback();
				} );
			},
			function(callback) {
				// grab last chunk of file
				var log_pos = Math.max(0, log_stats.size - log_chunk_size);
				
				fs.read(log_fd, log_buffer, 0, log_chunk_size, log_pos, function(err, bytesRead, buffer) {
					if (err) return callback(err);
					if (!bytesRead) return callback("ABORT");
					
					var slice = buffer.slice( 0, bytesRead );
					var text = slice.toString().trim();
					
					excerpt += "\n..." + text;
					callback();
				} );
			}
		],
		function() {
			callback(null, excerpt);
		}); // async.series
	}
	
	deleteJob(job, callback) {
		// delete job record, log and any files
		var self = this;
		
		async.series([
			function(callback) {
				// delete DB record first
				self.unbase.delete( 'jobs', job.id, callback );
			},
			function(callback) {
				// delete log file, if present
				if (!job.log_file_size) return process.nextTick(callback);
				var log_path = 'logs/jobs/' + job.id + '/log.txt.gz';
				self.storage.delete( log_path, callback );
			},
			function(callback) {
				// delete other files, if any
				if (!job.files || !job.files.length) return process.nextTick(callback);
				var keys = job.files.map( function(file) { return file.path; } );
				self.storage.deleteMulti( keys, callback );
			}
		], callback ); // async.series
	}
	
}; // class Jobs

module.exports = Jobs;
