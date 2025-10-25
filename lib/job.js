// xyOps Job Layer
// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the MIT License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const zlib = require('zlib');
const Path = require('path');
const cp = require('child_process');
const async = require("async");
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const Tools = require("pixl-tools");
const noop = function() {};

class Jobs {
	
	logJob(level, msg, data) {
		// log debug msg with pseudo-component
		if (this.debugLevel(level)) {
			this.logger.set( 'component', 'Job' );
			this.logger.print({ category: 'debug', code: level, msg: msg, data: data });
		}
	}
	
	launchJob(job, callback) {
		// begin job launch sequence
		var self = this;
		if (!callback) callback = noop;
		
		// jobs come in as a copy of the event
		// so move the event id into job.event
		if (job.id) job.event = job.id;
		
		// remove event stuff we don't need
		delete job.id;
		delete job.title;
		delete job.enabled;
		delete job.triggers;
		delete job.session_id;
		delete job.modified;
		delete job.created;
		delete job.revision;
		
		if (!job.limits) job.limits = [];
		if (!job.actions) job.actions = [];
		
		// unique id for job
		job.id = Tools.generateShortID('j');
		
		// merge in category actions and res limits
		var event = Tools.findObject( this.events, { id: job.event } );
		var plugin = Tools.findObject( this.plugins, { id: job.plugin } );
		var category = Tools.findObject( this.categories, { id: job.category });
		
		// sanity checks
		if (!event) {
			return callback( new Error("Event not found: " + job.event) );
		}
		if (!category) {
			return callback( new Error("Category not found: " + job.category) );
		}
		if ((job.type != 'workflow') && !plugin) {
			return callback( new Error("Plugin not found: " + job.plugin) );
		}
		
		// make sure all necessary things are enabled
		// early exit for these
		if (!job.test) {
			if (!event.enabled) {
				return callback( new Error("Event is disabled: " + event.title) );
			}
			if (!category.enabled) {
				return callback( new Error("Category is disabled: " + category.title) );
			}
			if (plugin && !plugin.enabled) {
				return callback( new Error("Plugin is disabled: " + plugin.title) );
			}
		}
		
		// apply category defaults
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
		
		// job antiflood
		var max_jobs_per_min = this.config.get('max_jobs_per_min') || 0;
		var jobs_ran = this.stats.currentMinute.jobs || 0;
		if (max_jobs_per_min && (jobs_ran >= max_jobs_per_min)) {
			var err_msg = `Maximum jobs per minute limit has been reached (${max_jobs_per_min}/min)`;
			return callback( new Error(err_msg) );
		}
		this.stats.currentMinute.jobs = jobs_ran + 1;
		
		// copy over plugin's command, uid and gid (satellite won't have these)
		if (plugin) {
			job.command = plugin.command;
			job.script = plugin.script || "";
			job.uid = plugin.uid;
			job.gid = plugin.gid;
			job.kill = plugin.kill;
			
			// plugin params may have changed outside of event, so recopy missing ones
			if (plugin.params) plugin.params.forEach( function(param) {
				if (!(param.id in job.params)) {
					if (param.type == 'select') job.params[ param.id ] = param.value.replace(/\,.+$/, '');
					else job.params[ param.id ] = param.value;
				}
			} );
		} // plugin
		
		// apply placeholder substitution on all event params with job as context
		if (job.params) {
			var context = { ...job };
			if (job.input && job.input.data) context.data = job.input.data; // convenience
			if (job.input && job.input.files) context.files = job.input.files; // convenience
			
			for (var key in job.params) {
				if (typeof(job.params[key]) == 'string') {
					job.params[key] = this.messageSub( job.params[key], context );
				}
			}
		}
		
		// custom env vars for job
		job.env = Object.assign( {}, this.config.get('job_env') || {}, job.env || {} );
		
		// initial state (may be passed in, i.e. startup/retry delays)
		if (!job.state) job.state = 'ready';
		job.started = Tools.timeNow();
		
		// job may be passed in a custom "now" from the scheduler (to run catch-up events)
		if (!job.now) job.now = job.started;
		
		// keep track of job log size
		job.log_file_size = 0;
		
		// add to activeJobs hash
		this.activeJobs[ job.id ] = job;
		var info = this.jobDetails[ job.id ] = {};
		
		// move input to details so it isn't synced to all users every second
		if (job.input) {
			info.input = job.input;
			delete job.input;
		}
		
		// start meta log (in memory)
		this.appendMetaLog(job, `xyOps job starting: #${job.id}` );
		this.appendMetaLog(job, "Source: " + Tools.ucfirst(job.source) + (job.splugin ? (' (' + job.splugin + ')') : '') + (job.stype ? (' (' + job.stype + ')') : '') );
		if (job.type != 'adhoc') this.appendMetaLog(job, "Event ID: #" + job.event );
		// this.appendMetaLog(job, "Date/Time: " + (new Date()).toString() );
		if (job.workflow && job.workflow.job) this.appendMetaLog(job, "Parent Workflow Job ID: #" + job.workflow.job);
		
		// log job start
		this.logJob(6, "Starting job", job);
		
		// at this point the job is ready to go into service, and will be maintained by the tick loop.
		// this is important because the job may have a startup delay (retry or other) and we don't want to pick a target server until it goes into active state.
		callback(null, job.id);
		
		// monitor job immediately, so there isn't a ~1 second delay for all launches
		this.monitorJob(job);
		
		// add meta msg for delay if set
		if (job.until) {
			var delay_sec = Math.max(0, Math.round(job.until - job.started));
			if (delay_sec) this.appendMetaLog(job, "Job will be delayed for " + Tools.getTextFromSeconds( delay_sec, false, false ) );
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
	
	appendMetaLog(job, msg, data) {
		// append message to special "meta" log inside the job object
		var info = this.jobDetails[ job.id ];
		if (!info) return; // sanity check
		
		this.logJob(6, "Job " + job.id + " Meta: " + msg, data);
		
		if (!info.activity) info.activity = [];
		var row = { ...data, id: Tools.generateShortID('m'), epoch: Tools.timeNow(), msg: ''+msg };
		row.server = row.server || this.hostID;
		
		info.activity.push(row);
		
		// keep it under control
		if (info.activity.length > 1000) info.activity.shift();
		
		// update anyone watching the live job
		this.doPageBroadcast( 'Job?id=' + job.id, 'meta_row', row );
	}
	
	monitorJobs() {
		// monitor all active jobs, called every tick
		var self = this;
		var queues = {};
		if (!this.master) return;
		
		Object.values(this.activeJobs).forEach( function(job) {
			self.monitorJob(job);
			
			if (job.state == 'queued') {
				var queue_id = job.event;
				if (job.workflow && job.workflow.node && (job.type == 'adhoc')) queue_id += '-' + job.workflow.node;
				
				if (!queues[queue_id]) queues[queue_id] = [];
				queues[queue_id].push(job);
			}
		} ); // foreach job
		
		// check queues for available slots
		for (var queue_id in queues) {
			var queued = queues[queue_id];
			// var event = Tools.findObject( this.events, { id: event_id } );
			// if (!event) continue; // sanity
			
			var criteria = { state: 'active' };
			if (queue_id.match(/^(\w+)\-(\w+)$/)) {
				// support adhoc workflow jobs (where the event is the WF event)
				var event_id = RegExp.$1;
				var node_id = RegExp.$2;
				criteria['event'] = event_id;
				criteria['workflow.node'] = node_id;
			}
			else {
				criteria['event'] = queue_id;
			}
			
			// use limit definition from first queued job (honor system)
			var job = queued[0];
			var job_limit = Tools.findObject( job.limits || [], { type: 'job', enabled: true } );
			var jobs = this.findActiveJobsDeep(criteria);
			
			if (job_limit && (jobs.length < job_limit.amount)) {
				// we have room!  launch queued job waiting the longest
				Tools.sortBy( queued, 'started', { type: 'number', dir: 1 } );
				
				if (this.checkAvailableJobServer(job)) {
					this.appendMetaLog(job, "Moving job state from {queued} to {ready}");
					job.state = 'ready';
					this.monitorJob(job);
					
					// notify all connected users that a job has changed
					this.doUserBroadcastAll( 'status', { 
						epoch: Tools.timeNow(),
						activeJobs: this.getActiveJobs(),
						jobsChanged: true
					} );
				}
				
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
					this.appendMetaLog(job, "Moving job state from {" + job.state + "} to {ready}");
					job.state = 'ready';
					delete job.until;
					
					// process new ready state immediately
					return this.monitorJob(job);
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
					self.appendMetaLog(job, "Moving job state from {" + job.state + "} to {active}");
					job.state = 'active';
					job.started = now; // reset this to now
					job.updated = now; // for stale check
					job.progress = 0;
					
					// branch off for workflows here
					if (job.type == 'workflow') return self.startWorkflow(job);
					
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
						job: job,
						details: self.jobDetails[ job.id ],
						sec: self.getSecretsForJob(job)
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
				if (job.type == 'workflow') this.tickWorkflow(job);
				this.checkJobActiveLimits(job);
			break;
		} // switch job.state
	}
	
	getActiveJobs() {
		// get copy of active jobs for client, sans queued jobs -- return as hash
		// (there may be thousands of queued jobs -- no need to sync them to all clients every second)
		// (also filter out verbose props that users don't need every second)
		var jobs = {};
		
		for (var id in this.activeJobs) {
			if (this.activeJobs[id].state != 'queued') {
				jobs[id] = Tools.copyHashRemoveKeys( this.activeJobs[id], { input:1, data:1, files:1 } );
			}
		}
		
		return jobs;
	}
	
	findActiveJobs(criteria) {
		// find active jobs matching criteria -- return array
		return Tools.findObjects( Object.values(this.activeJobs), criteria );
	}
	
	findActiveJobsDeep(criteria) {
		// find active jobs matching deep dot.path.notation criteria -- return array
		return Tools.findObjectsDeep( Object.values(this.activeJobs), criteria );
	}
	
	findSimilarJobs(job, criteria) {
		// find jobs with criteria and same event, OR same wf+node if adhoc
		criteria['event'] = job.event;
		
		if (job.workflow && job.workflow.node && (job.type == 'adhoc')) {
			criteria['workflow.node'] = job.workflow.node;
		}
		
		return Tools.findObjectsDeep( Object.values(this.activeJobs), criteria );
	}
	
	countQueuedJobs() {
		// return count of currently queued jobs
		return this.findActiveJobs({ state: 'queued' }).length;
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
					this.logJob(6, "Job has exceeded memory usage limit: " + job.id, job.mem);
				}
				if (now - job.flags.mem > mem_limit.duration) {
					this.abortJob(job, "Job memory has exceeded maximum limit of " + Tools.getTextFromBytes(mem_limit.amount) + " for " + Tools.getTextFromSeconds(mem_limit.duration, false, true) + ".");
					return;
				}
			}
			else if (job.flags.mem) {
				this.logJob(6, "Job is now under the memory usage limit: " + job.id, job.mem);
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
					this.logJob(6, "Job has exceeded CPU usage limit: " + job.id, job.cpu);
				}
				if (now - job.flags.cpu > cpu_limit.duration) {
					this.abortJob(job, "Job CPU has exceeded maximum limit of " + Tools.getTextFromBytes(cpu_limit.amount) + "% for " + Tools.getTextFromSeconds(cpu_limit.duration, false, true) + ".");
					return;
				}
			}
			else if (job.flags.cpu) {
				this.logJob(6, "Job is now under the CPU usage limit: " + job.id, job.cpu);
				delete job.flags.cpu;
			}
		}
	}
	
	checkJobStartLimits(job) {
		// make sure job can run - if not, possibly queue up
		var job_limit = Tools.findObject( job.limits, { type: 'job', enabled: true } );
		
		if (job_limit && job_limit.amount) {
			var jobs = this.findSimilarJobs(job, { state: 'active' });
			
			if (jobs.length >= job_limit.amount) {
				// job limit reached -- can we queue?
				var queue_limit = Tools.findObject( job.limits, { type: 'queue', enabled: true } );
				
				if (queue_limit && queue_limit.amount) {
					var queued = this.findSimilarJobs(job, { state: 'queued' });
					
					if (queued.length < queue_limit.amount) {
						// room in queue, yay!
						this.appendMetaLog(job, "Moving job state from {" + job.state + "} to {queued}");
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
		
		// enforce max file limit here
		var info = this.jobDetails[ job.id ];
		var file_limit = Tools.findObject( job.limits, { type: 'file', enabled: true } );
		if (file_limit && info.input && info.input.files && info.input.files.length) {
			// file count limit
			if (info.input.files.length > file_limit.amount) {
				// Note: 0 means NO files allowed, not infinite
				var num_exceeded = info.input.files.length - file_limit.amount;
				this.appendMetaLog(job, `Pruned ${num_exceeded} files from input (file amount limit exceeded)`);
				info.input.files.length = file_limit.amount;
			}
			
			// total size limit
			if (file_limit.size) {
				var total_size = 0;
				var size_exceeded = false;
				var new_len = 0;
				
				info.input.files.forEach( function(file, idx) { 
					total_size += file.size;
					if (!size_exceeded && (total_size > file_limit.size)) {
						size_exceeded = true;
						new_len = idx;
					}
				} );
				
				if (size_exceeded) {
					var num_exceeded = info.input.files.length - new_len;
					this.appendMetaLog(job, `Pruned ${num_exceeded} files from input (file size limit exceeded)`);
					info.input.files.length = new_len;
				}
			}
			
			// limit file extensions (prune files, do not abort)
			if (file_limit.accept && file_limit.accept.length) {
				var exts = file_limit.accept.trim().toLowerCase().split(/\,\s*/);
				var ext_re = new RegExp( '(' + exts.map( Tools.escapeRegExp ).join('|') + ')$', 'i' );
				var orig_len = info.input.files.length;
				
				info.input.files = info.input.files.filter( function(file) {
					return !!file.filename.match(ext_re);
				} );
				
				if (info.input.files.length < orig_len) {
					var num_pruned = orig_len - info.input.files.length;
					this.appendMetaLog(job, `Pruned ${num_pruned} files from input (file extension match)`);
				}
			}
		} // file limiter
		
		// make sure event is still around and active
		var event = Tools.findObject( this.events, { id: job.event } );
		if (!event) {
			this.abortJob(job, "Event was deleted: " + job.event);
			return false;
		}
		if (!event.enabled && !job.test) {
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
	
	checkAvailableJobServer(job) {
		// see if we have any available servers to run queued job
		var self = this;
		var server_ids = [];
		
		// skip this entirely for workflows
		if (job.type == 'workflow') return true;
		
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
		
		// de-dupe
		server_ids = [ ...new Set(server_ids) ];
		
		// filter by actual online servers at the present moment
		server_ids = server_ids.filter( function(server_id) {
			return self.servers[server_id] && self.servers[server_id].enabled;
		} );
		
		// certain alerts being active may remove server from candidates
		server_ids = server_ids.filter( this.filterServerByAlerts.bind(this) );
		
		return server_ids.length > 0;
	}
	
	chooseJobServer(job) {
		// pick a server for the job
		var self = this;
		var server_ids = [];
		var server_id = '';
		
		// skip this entirely for workflows
		if (job.type == 'workflow') return true;
		
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
		
		// de-dupe
		server_ids = [ ...new Set(server_ids) ];
		
		// filter by actual online servers at the present moment
		server_ids = server_ids.filter( function(server_id) {
			return self.servers[server_id] && self.servers[server_id].enabled;
		} );
		
		// certain alerts being active may remove server from candidates
		server_ids = server_ids.filter( this.filterServerByAlerts.bind(this) );
		
		// do we have at least one online server?  If not, abort or queue the job
		if (!server_ids.length) {
			this.appendMetaLog(job, "No available servers matching targets");
			
			// no servers available, but we might be able to queue it
			var queue_limit = Tools.findObject( job.limits, { type: 'queue', enabled: true } );
			
			if (queue_limit && queue_limit.amount) {
				var queued = this.findActiveJobs({ event: job.event, state: 'queued' });
				
				if (queued.length < queue_limit.amount) {
					// room in queue, yay!
					this.appendMetaLog(job, "Moving job state from {" + job.state + "} to {queued}");
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
				
				server_ids.forEach( function(id) {
					var server = self.servers[id];
					
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
		
		var server = this.servers[server_id];
		
		this.logJob(8, "Chose server for job", {
			server_id: server_id,
			server_hostname: server.hostname,
			job_id: job.id,
			algo: job.algo
		});
		this.appendMetaLog(job, "Chosen server: " + (server.title || server.hostname) + " (" + job.algo + ")" );
		
		job.server = server_id;
		job.groups = [ ...server.groups ];
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
				self.logJob(9, "Job not found, updates not applied: " + job_id, updates);
				return;
			}
			if (job.state == 'complete') {
				// should never happen, sanity check
				self.logJob(9, "Job is already complete, updates not applied: " + job_id, updates);
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
				updates.html.content = '<div class="markdown-body">' + marked.parse( updates.html.content, self.config.getPath('ui.marked_config') ) + '</div>';
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
			
			// if job sent data or files, move those to details right away, so they aren't synced to users (while job is still active)
			if (updates.data) {
				info.data = updates.data;
				delete updates.data;
			}
			if (updates.files) {
				info.files = updates.files;
				delete updates.files;
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
		else if (job.type == 'workflow') {
			// special abort handler for workflows
			this.abortWorkflow(job, reason);
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
	
	getCompletedJobConditions(job) {
		// get list of action conditions to fire all at once, but only if we did NOT retry
		var conditions = [];
		
		if (!job.retried) {
			// no retry, so add actions
			conditions.push('complete');
			
			if (job.code) {
				conditions.push('error');
				if (job.code.toString().match(/^(warning|critical|abort)$/)) conditions.push(job.code);
			}
			else conditions.push('success');
			
			// custom actions for custom tags
			if (job.tags) conditions = conditions.concat( job.tags.map( function(tag) { return 'tag:' + tag; } ) );
		}
		
		return conditions;
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
		this.prepJobLog( job, function() {
			// job code should be a number or a string
			if (!job.code) job.code = 0;
			else {
				if ((typeof(job.code) != 'number') && (typeof(job.code) != 'string')) job.code = 'unknown';
				else if (typeof(job.code) == 'string') job.code = job.code.replace(/\W+/g, '_').toLowerCase();
			}
			
			// add universal action conditions from config
			if (!job.actions) job.actions = [];
			var temp_job_type = (job.type == 'workflow') ? 'workflow' : 'default';
			job.actions = job.actions.concat( self.config.getPath('job_universal_actions.' + temp_job_type) );
			
			// check for retry
			if (job.code && ((job.code != 'abort') || job.retry_ok)) self.checkRetryJob(job);
			
			// get list of action conditions to fire (will be empty if job was retried)
			var conditions = self.getCompletedJobConditions(job);
			
			self.runJobActions(job, conditions, function() {
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
				if (job.test) job.tags.push('_test');
				
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
				if (!job.retried && (job.type != 'adhoc')) {
					if (!self.state.events) self.state.events = {};
					if (!self.state.events[job.event]) self.state.events[job.event] = {};
					var event_state = self.state.events[job.event];
					event_state.last_job = job.id;
					event_state.last_code = job.code;
					event_state.total_elapsed = (event_state.total_elapsed || 0) + job.elapsed;
					event_state.total_count = (event_state.total_count || 0) + 1;
					self.state.dirty = true;
				}
				
				// special case for adhoc: no event should be indexed in db
				if (job.type == 'adhoc') combo_job.event = '';
				
				// update daily stats
				self.updateDailyStat( 'job_log_file_size', job.log_file_size || 0 );
				self.updateDailyStat( 'job_elapsed', job.elapsed || 0 );
				self.updateDailyStat( 'job_files', job.files ? job.files.length : 0 );
				
				// send updated stats over to connected users
				self.doUserBroadcastAll( 'update', { stats: self.stats } );
				
				// upload job JSON data to storage and index it
				self.unbase.insert( 'jobs', job.id, combo_job, function(err) {
					if (err) self.logError('db', "Failed to index job: " + job.id + ": " + err);
					else self.logJob(6, "Job is fully indexed in the DB: " + job.id);
					
					// remove from active jobs
					delete self.activeJobs[ job.id ];
					delete self.jobDetails[ job.id ];
					
					// manage parent workflow here
					// do this BEFORE the user broadcast, so users get the workflow update as well
					// NOTE: This is a workflow SUB-JOB, not a workflow main job
					if (job.workflow && job.workflow.job) self.finishWorkflowJob(combo_job);
					
					// notify all connected users that a job has changed
					self.doUserBroadcastAll( 'status', { 
						epoch: Tools.timeNow(),
						activeJobs: self.getActiveJobs(),
						jobsChanged: true,
						state: Tools.copyHashRemoveKeys( self.state, { dirty: 1 } )
					} );
					
					// and notify all job watchers that the job is fully complete
					self.doPageBroadcast( 'Job?id=' + job.id, 'job_completed', {} );
					
				} ); // unbase.insert
				
				// handle delete_event/update_event in parallel with unbase op
				if (delete_event) {
					var event = Tools.findObject( self.events, { id: job.event } );
					if (!event) {
						self.logError('event', "Event not found: " + job.event + ", cannot delete from job: " + job.id);
						return;
					}
					
					self.logJob(6, "Deleting event: " + event.id);
					
					self.storage.listFindDelete( 'global/events', { id: event.id }, function(err, event) {
						if (err) {
							self.logError('event', "Failed to delete event: " + err);
							return;
						}
						
						self.logJob(6, "Successfully deleted event: " + event.title, event);
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
					var event = Tools.findObject( self.events, { id: job.event } );
					if (!event) {
						self.logError('event', "Event not found: " + job.event + ", cannot apply updates from job: " + job.id, update_event);
						return;
					}
					
					update_event.modified = job.completed;
					self.logJob(6, "Updating event: " + event.id, update_event);
					
					self.storage.listFindUpdate( 'global/events', { id: event.id }, update_event, function(err, event) {
						if (err) {
							self.logError('event', "Failed to update event: " + err);
							return;
						}
						
						self.logJob(6, "Successfully updated event: " + event.title, update_event);
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
		}); // prepJobLog
	}
	
	prepJobLog(job, callback) {
		// see if we need to upload job log, or include it in jobDetails instead
		var self = this;
		var log_file = Path.resolve( Path.join( this.config.get('log_dir'), 'jobs', job.id + '.log' ) );
		var max_inline_size = Tools.getBytesFromText( this.config.get('max_inline_job_log_size') || '1 MB' );
		
		fs.stat( log_file, function(err, stats) {
			if (err) {
				self.logJob(6, "No job log file found (may be totally normal): " + log_file + ": " + err);
				job.log_file_size = 0;
				return callback();
			}
			job.log_file_size = stats.size;
			
			if (!stats.size) {
				// zero-byte log
				fs.unlink( log_file, noop );
				return callback();
			}
			
			if (stats.size > max_inline_size) {
				// job log is large, so upload as binary object in background
				self.uploadJobLog(job);
				return callback();
			}
			
			// include as inline string in jobDetails
			fs.readFile( log_file, 'utf8', function(err, contents) {
				fs.unlink( log_file, noop );
				if (err) self.jobDetails[ job.id ].output = '' + err;
				else self.jobDetails[ job.id ].output = contents;
				callback();
			} ); // fs.readFile
		} ); // fs.stat
	}
	
	uploadJobLog(job) {
		// upload job log in background (and compress w/gzip on the way)
		var self = this;
		var log_path = 'logs/jobs/' + job.id + '/log.txt.gz';
		var log_file = Path.resolve( Path.join( this.config.get('log_dir'), 'jobs', job.id + '.log' ) );
		
		if (!log_file || !job.log_file_size) return; // no job log
		
		this.logJob(6, "Uploading job log: " + log_file + " to: " + log_path);
		
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
				self.logJob(6, "Job log uploaded successfully: " + log_path);
				
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
			var new_job = Tools.copyHash(job, true);
			
			// clense new job of previous running context
			for (var key in new_job) {
				if (!key.match(/^(type|event|category|plugin|targets|algo|workflow|input|params|parent|source|username|api_key|actions|limits|icon|label|test|retry_count|tags)$/)) delete new_job[key];
			}
			
			// remove workflow running context (state, etc.)
			if (new_job.workflow) {
				delete new_job.workflow.state;
				delete new_job.workflow.jobs;
			}
			
			// increment retry counter, and add link to old job in new
			new_job.retry_count++;
			new_job.retry_prev = job.id;
			
			// optional retry delay
			if (retry_limit.duration) {
				new_job.state = 'retry_delay';
				new_job.until = Tools.timeNow() + retry_limit.duration;
			}
			
			this.appendMetaLog(job, "Launching retry #" + new_job.retry_count + " of " + retry_limit.amount );
			this.logJob(6, "Launching job for retry (" + new_job.retry_count + " / " + retry_limit.amount + ")", retry_limit);
			
			this.launchJob(new_job, function(err, id) {
				if (err) self.appendMetaLog(job, "Failed to launch event for retry: " + (err.message || err));
				else {
					self.appendMetaLog(job, "Launched job for retry: #" + id);
					
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
	
	rollbackJobStats(job) {
		// if the job is from "today" (local server time) rollback affected stats
		var self = this;
		var dargs = Tools.getDateArgs( Tools.timeNow(true) );
		var dargs_job = Tools.getDateArgs( job.completed );
		
		if (dargs.yyyy_mm_dd != dargs_job.yyyy_mm_dd) return; // not from today
		
		// get list of std conditions that fired when job completed
		var conditions = this.getCompletedJobConditions(job);
		
		conditions.forEach( function(condition) {
			if (!condition.match(/^\w+$/)) return; // only std conditions incr stats (skip `tag:` conditions)
			
			self.updateDailyStat( 'job_' + condition, -1 );
			if (job.event) self.updateDailyCustomStat( `events.${job.event}.job_${condition}`, -1 );
			if (job.server) self.updateDailyCustomStat( `servers.${job.server}.job_${condition}`, -1 );
			if (job.category) self.updateDailyCustomStat( `categories.${job.category}.job_${condition}`, -1 );
			if (job.plugin) self.updateDailyCustomStat( `plugins.${job.plugin}.job_${condition}`, -1 );
			
			// also give credit to all groups server is in
			if (job.server && self.servers[job.server] && self.servers[job.server].groups) {
				self.servers[job.server].groups.forEach( function(group_id) {
					self.updateDailyCustomStat( `groups.${group_id}.job_${condition}`, -1 );
				} );
			}
		} ); // foreach condition
	}
	
	deleteJob(job, callback) {
		// delete job record, log and any files
		var self = this;
		
		// rollback affected stats
		this.rollbackJobStats(job);
		
		async.series([
			function(callback) {
				// delete DB record first
				self.unbase.delete( 'jobs', job.id, callback );
			},
			function(callback) {
				// delete log file, if present
				if (!job.log_file_size || job.output) return process.nextTick(callback);
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
