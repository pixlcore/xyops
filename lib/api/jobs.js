// xyOps API Layer - Jobs
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const Path = require('path');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");
const UserAgent = require('useragent-ng');

class Jobs {
	
	api_get_active_jobs(args, callback) {
		// get all active jobs, possibly with search criteria and pagination / sorting
		// for e.g. get queued jobs: { state: 'queued' }
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		var offset = parseInt( params.offset || 0 );
		var limit = parseInt( params.limit || 0 );
		var sort_by = params.sort_by || 'started';
		var sort_dir = parseInt( params.sort_dir || -1 );
		
		delete params.offset;
		delete params.limit;
		delete params.sort_by;
		delete params.sort_dir;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var privs = self.getComputedPrivileges(user);
			var cats = self.getComputedCategories(user);
			var cgrps = self.getComputedGroups(user);
			
			var jobs = self.findActiveJobs(params).filter( function(job) {
				if (!privs.admin) {
					if (cats.length && !cats.includes(job.category)) return false;
					if (cgrps.length && job.targets && job.targets.length && !Tools.includesAny(cgrps, job.targets)) return false;
				}
				return true;
			} );
			
			Tools.sortBy( jobs, sort_by, { type: 'number', dir: sort_dir, copy: false } );
			if (!limit) limit = jobs.length;
			
			return callback({
				code: 0,
				rows: jobs.slice( offset, offset + limit ),
				list: { length: jobs.length }
			});
		}); // loaded session
	}
	
	api_get_active_job_summary(args, callback) {
		// summarize all active job states by event, for dashboard screen
		// for e.g. summarize queued jobs: { state: 'queued' }
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var jobs = self.findActiveJobs(params);
			var events = {};
			
			var privs = self.getComputedPrivileges(user);
			var cats = self.getComputedCategories(user);
			var cgrps = self.getComputedGroups(user);
			
			jobs.forEach( function(job) {
				if (job.type == 'adhoc') return;
				if (!privs.admin) {
					if (cats.length && !cats.includes(job.category)) return;
					if (cgrps.length && job.targets && job.targets.length && !Tools.includesAny(cgrps, job.targets)) return;
				}
				
				if (!events[job.event]) events[job.event] = { id: job.event, states: {}, sources: {}, targets: {} };
				var event = events[job.event];
				
				if (job.state) event.states[job.state] = (event.states[job.state] || 0) + 1;
				if (job.source) event.sources[job.source] = (event.sources[job.source] || 0) + 1;
				if (job.targets) job.targets.forEach( function(target) {
					event.targets[target] = (event.targets[target] || 0) + 1;
				} );
			} );
			
			return callback({
				code: 0,
				events: events
			});
		}); // loaded session
	}
	
	api_get_workflow_job_summary(args, callback) {
		// summarize all workflow job states by node, for job details screen
		// for e.g. summarize workflow queued jobs: { 'workflow.job': 'jklmnopq', state: 'queued' }
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var jobs = self.findActiveJobsDeep(params);
			var nodes = {};
			
			jobs.forEach( function(job) {
				if (!job.workflow || !job.workflow.node) return;
				var node_id = job.workflow.node;
				nodes[node_id] = (nodes[node_id] || 0) + 1;
			} );
			
			return callback({
				code: 0,
				nodes: nodes
			});
		}); // loaded session
	}
	
	api_get_job(args, callback) {
		// get single job details, running or completed
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		if (params.remove && (typeof(params.remove) == 'string')) params.remove = params.remove.split(/\,\s*/);
		
		// generate download token for log file (not guessable unless you know the secret key)
		var token = Tools.digestBase64( 'download' + params.id + self.config.get('secret_key'), 'sha256', 16 );
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			if (params.id in self.activeJobs) {
				var job = Tools.mergeHashes( self.activeJobs[params.id], self.jobDetails[params.id] || {} );
				if (params.remove && Array.isArray(params.remove)) params.remove.forEach( function(key) { delete job[key]; } );
				
				if (!self.requireCategoryPrivilege(user, job.category, callback)) return;
				if (!self.requireTargetPrivilege(user, job.targets, callback)) return;
				
				return callback({
					code: 0,
					token: token,
					job: job
				});
			} // active job
			
			// load job from storage
			self.unbase.get( 'jobs', params.id, function(err, data) {
				if (err) return self.doError('notfound', "Failed to load job details: " + params.id + ": " + err, callback);
				
				var job = Tools.copyHash(data, false); // shallow
				if (params.remove && Array.isArray(params.remove)) params.remove.forEach( function(key) { delete job[key]; } );
				
				if (!self.requireCategoryPrivilege(user, job.category, callback)) return;
				if (!self.requireTargetPrivilege(user, job.targets, callback)) return;
				
				callback({ code: 0, job, token });
			} );
		} ); // loaded session
	}
	
	api_get_jobs(args, callback) {
		// get info about multiple jobs, running or completed
		// results are pruned unless verbose is set!
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		var jobs = {};
		if (!this.requireMaster(args, callback)) return;
		
		if (params.ids && (typeof(params.ids) == 'string')) params.ids = params.ids.split(/\,\s*/);
		if (!params.ids || !Tools.isaArray(params.ids) || !params.ids.length) {
			return this.doError('job', "Missing or malformed ids parameter.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			async.eachLimit( params.ids, self.storage.concurrency,
				function(id, callback) {
					if (id in self.activeJobs) {
						jobs[id] = Tools.mergeHashes( self.activeJobs[id], self.jobDetails[id] || {} );
						return process.nextTick( callback );
					}
					else {
						self.unbase.get( 'jobs', id, function(err, job) {
							jobs[id] = job || { err };
							callback();
						}); // unbase.get
					}
				},
				function(err) {
					// prune verbose props unless requested
					if (!params.verbose) Object.values(jobs).forEach( function(job) {
						delete job.actions;
						delete job.activity;
						delete job.html;
						delete job.limits;
						delete job.procs;
						delete job.conns;
						delete job.table;
						delete job.timelines;
						delete job.input;
						delete job.data;
						delete job.files;
					} );
					
					// convert jobs to array but keep original order
					callback({ 
						code: 0, 
						jobs: params.ids.map( function(id) { return jobs[id]; } )
					});
				}
			); // eachLimit
		}); // loadSession
	}
	
	api_get_job_log(args, callback) {
		// view job log (plain text)
		// client API, session auth
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		var storage_key = 'logs/jobs/' + params.id + '/log.txt.gz';
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.getStream( storage_key, function(err, stream) {
				if (err) {
					return callback( "204 No Content", {}, "" );
				}
				
				var headers = {
					'Content-Type': "text/plain; charset=utf-8",
					'Content-Encoding': "gzip"
				};
				
				// pass stream to web server
				callback( "200 OK", headers, stream );
			} ); // getStream
		}); // loadSession
	}
	
	api_view_job_log(args, callback) {
		// view raw job log in browser (in progress or completed)
		// client API, token auth
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/,
			t: /^[\w\-]+$/
		}, callback)) return;
		
		var token = Tools.digestBase64( 'download' + params.id + self.config.get('secret_key'), 'sha256', 16 );
		if (params.t != token) return callback( "403 Forbidden", {}, "(Authentication failed.)\n" );
		
		var job = this.activeJobs[params.id];
		if (job) {
			// active job, grab partial log in progress
			var log_file = Path.resolve( Path.join( this.config.get('log_dir'), 'jobs', job.id + '.log' ) );
			
			// file might not exist or have size yet
			if (!job.log_file_size) return callback("404 Not Found", {}, "No log file found for job: " + job.id);
			
			var headers = {
				'Content-Type': "text/plain; charset=utf-8"
			};
			
			// pass stream to web server
			return callback( "200 OK", headers, fs.createReadStream(log_file) );
		}
		
		// completed job, grab full log from db or storage
		this.unbase.get( "jobs", params.id, function(err, job) {
			if (err) return callback("404 Not Found", {}, "Job record not found: " + params.id);
			
			// log might not exist or have size
			if (!job.log_file_size) {
				return callback("404 Not Found", {}, "No log file found for job: " + params.id);
			}
			
			if (job.output) {
				// job log is inline
				return callback( "200 OK", { 'Content-Type': "text/plain; charset=utf-8" }, job.output );
			}
			
			// job file must be large, grab gz from storage
			self.storage.getStream( 'logs/jobs/' + params.id + '/log.txt.gz', function(err, stream) {
				if (err) {
					return callback( "404 Not Found", {}, "(No log file found.)\n" );
				}
				
				var headers = {
					'Content-Type': "text/plain; charset=utf-8",
					'Content-Encoding': "gzip"
				};
				
				// pass stream to web server
				callback( "200 OK", headers, stream );
			} ); // getStream
		} ); // unbase.get
	}
	
	api_download_job_log(args, callback) {
		// download job log (in progress or completed)
		// client API, token auth
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/,
			t: /^[\w\-]+$/
		}, callback)) return;
		
		var token = Tools.digestBase64( 'download' + params.id + self.config.get('secret_key'), 'sha256', 16 );
		if (params.t != token) return callback( "403 Forbidden", {}, "(Authentication failed.)\n" );
		
		var job = this.activeJobs[params.id];
		if (job) {
			// active job, grab partial log in progress
			var log_file = Path.resolve( Path.join( this.config.get('log_dir'), 'jobs', job.id + '.log' ) );
			
			// file might not exist or have size yet
			if (!job.log_file_size) return callback("404 Not Found", {}, "No log file found for job: " + job.id);
			
			var headers = {
				'Content-Type': "text/plain; charset=utf-8",
				'Content-disposition': "attachment; filename=xyOps-Partial-Job-Log-" + params.id + '.txt'
			};
			
			// pass stream to web server
			return callback( "200 OK", headers, fs.createReadStream(log_file) );
		}
		
		// completed job, grab full log from db or storage
		this.unbase.get( "jobs", params.id, function(err, job) {
			if (err) return callback("404 Not Found", {}, "Job record not found: " + params.id);
			
			// log might not exist or have size
			if (!job.log_file_size) {
				return callback("404 Not Found", {}, "No log file found for job: " + params.id);
			}
			
			var headers = {
				'Content-Type': "text/plain; charset=utf-8",
				'Content-disposition': "attachment; filename=xyOps-Job-Log-" + params.id + '.txt'
			};
			
			if (job.output) {
				// job log is inline
				return callback( "200 OK", headers, job.output );
			}
			
			// job file must be large, grab gz from storage
			self.storage.getStream( 'logs/jobs/' + params.id + '/log.txt.gz', function(err, stream) {
				if (err) {
					return callback( "404 Not Found", {}, "(No log file found.)\n" );
				}
				
				// add gzip header
				headers['Content-Encoding'] = 'gzip';
				
				// pass stream to web server
				callback( "200 OK", headers, stream );
			} ); // getStream
		} ); // unbase.get
	}
	
	api_tail_live_job_log(args, callback) {
		// get end-aligned chunk of live job log (for kickstarting real-time log viewer)
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.activeJobs[params.id]) {
				// return self.doError('job', "Live job not found: " + params.id, callback);
				return callback({ code: 0, text: "" });
			}
			
			var job = self.activeJobs[params.id];
			if (!self.requireCategoryPrivilege(user, job.category, callback)) return;
			if (!self.requireTargetPrivilege(user, job.targets, callback)) return;
			
			var log_file = Path.resolve( Path.join( self.config.get('log_dir'), 'jobs', job.id + '.log' ) );
			var log_fd = null;
			var log_stats = null;
			var log_chunk_size = params.bytes || 32678;
			var log_buffer = Buffer.alloc(log_chunk_size);
			var lines = [];
			
			// open log file and locate ideal position to start from
			// (~32K from end, aligned to line boundary)
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
					var log_pos = Math.max(0, log_stats.size - log_chunk_size);
					fs.read(log_fd, log_buffer, 0, log_chunk_size, log_pos, function(err, bytesRead, buffer) {
						if (err) return callback(err);
						
						if (bytesRead > 0) {
							var slice = buffer.slice( 0, bytesRead );
							var text = slice.toString();
							
							lines = text.split(/\n/);
							if (bytesRead == log_chunk_size) {
								// remove first line, as it is likely partial
								lines.shift();
							}
						}
						
						callback();
					} );
				}
			],
			function() {
				// ignore error, as log file may not exist, which is fine
				callback({ code: 0, text: lines.join("\n") });
			}); // async.series
		}); // loadSession
	}
	
	api_update_job(args, callback) {
		// update running or completed job
		// admin-only: this API is very powerful
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			var job = self.activeJobs[ params.id ];
			if (job) {
				self.logDebug(5, "Updating job: " + job.id, params);
				Tools.mergeHashInto( job, params );
				return callback({ code: 0 });
			}
			
			self.logDebug(5, "Updating job: " + params.id, params);
			
			// job must be completed, so update job from storage
			self.unbase.update( 'jobs', params.id, params, function(err, job) {
				// done with update (and unlocked)
				if (err) return self.doError('job', "Failed to update job: " + params.id + ": " + err, callback);
				self.logTransaction('job_update', job.id, self.getClientInfo(args, { params }));
				self.doPageBroadcast( 'Job?id=' + job.id, 'job_updated', params );
				callback({ code: 0 });
			} ); // unbase.update
			
		}); // loadSession
	}
	
	api_job_skip_delay(args, callback) {
		// skip over job delay -- for active jobs only!
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'run_jobs', callback)) return;
			
			args.user = user;
			args.session = session;
			
			var job = self.activeJobs[ params.id ];
			if (!job) return self.doError('job', "Job not found: " + params.id, callback);
			
			if (!self.requireCategoryPrivilege(user, job.category, callback)) return;
			if (!self.requireTargetPrivilege(user, job.targets, callback)) return;
			
			if (!job.until) return self.doError('job', "Job is not in a delay state: " + params.id, callback);
			job.until = Tools.timeNow();
			
			self.appendMetaLog(job, `Job delay was manually skipped by user: ` + (user.username || user.id) );
			callback({ code: 0 });
		}); // loadSession
	}
	
	api_job_toggle_notify_me(args, callback) {
		// toggle job complete notification for current user
		// for active jobs only!
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			if (!user.email) return self.doError('job', "User has no email address set.", callback);
			
			var job = self.activeJobs[ params.id ];
			if (!job) return self.doError('job', "Job not found: " + params.id, callback);
			
			if (!self.requireCategoryPrivilege(user, job.category, callback)) return;
			if (!self.requireTargetPrivilege(user, job.targets, callback)) return;
			
			if (!job.actions) job.actions = [];
			var notify_me = !!Tools.findObject( job.actions, { condition: 'complete', type: 'email', email: user.email } );
			
			if (!notify_me) {
				// add notification
				job.actions.push({ condition: 'complete', type: 'email', email: user.email, users: [], enabled: true, hidden: true });
				notify_me = true;
				self.appendMetaLog(job, `User added to job notify list: ` + user.username);
			}
			else {
				// remove notification
				Tools.deleteObject( job.actions, { condition: 'complete', type: 'email', email: user.email } );
				notify_me = false;
				self.appendMetaLog(job, `User removed from job notify list: ` + user.username);
			}
			
			callback({ code: 0, enabled: notify_me });
		}); // loadSession
	}
	
	api_manage_job_tags(args, callback) {
		// update completed job tags
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/,
			tags: 'array'
		}, callback)) return;
		
		if (Tools.numKeys(params) > 2) {
			return this.doError('job', "Too many properties in params", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'tag_jobs', callback)) return;
			
			args.user = user;
			args.session = session;
			
			var job = self.activeJobs[ params.id ];
			if (job) return self.doError('job', "Cannot update tags of running job.", callback);
			
			// job must be completed, so load job from storage
			self.unbase.update( 'jobs', params.id, function(job) {
				// perform updates here or bail out (inside unbase lock block)
				if (!self.requireCategoryPrivilege(user, job.category, callback)) return false;
				if (!self.requireTargetPrivilege(user, job.targets, callback)) return false;
				
				self.logDebug(5, "Updating job tags: " + job.id, params);
				
				// append to job meta log
				job.activity.push({ 
					id: Tools.generateShortID('m'),
					epoch: Tools.timeNow(), 
					server: 'm:' + self.hostID,
					username: user.username || user.id, 
					msg: "Updated job tags: " + (params.tags.filter( function(tag) { return !tag.match(/^_/); } ).join(', ') || '(None)')
				});
				params.activity = job.activity;
				
				return params;
			}, 
			function(err, job) {
				// done with update (and unlocked)
				if (err && (err === "ABORT")) return; // update was aborted and callback was handled
				if (err) return self.doError('job', "Failed to update job: " + params.id + ": " + err, callback);
				self.logTransaction('job_update_tags', job.id, self.getClientInfo(args, params));
				self.doPageBroadcast( 'Job?id=' + job.id, 'job_updated', params );
				callback({ code: 0 });
			} ); // unbase.update
			
		}); // loadSession
	}
	
	api_manage_job_tickets(args, callback) {
		// update completed job tickets
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/,
			tickets: 'array'
		}, callback)) return;
		
		if (Tools.numKeys(params) > 2) {
			return this.doError('job', "Too many properties in params", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_tickets', callback)) return;
			
			args.user = user;
			args.session = session;
			
			var job = self.activeJobs[ params.id ];
			if (job) return self.doError('job', "Cannot update tickets of running job.", callback);
			
			// job must be completed, so load job from storage
			self.unbase.update( 'jobs', params.id, function(job) {
				// perform updates here or bail out (inside unbase lock block)
				if (!self.requireCategoryPrivilege(user, job.category, callback)) return false;
				if (!self.requireTargetPrivilege(user, job.targets, callback)) return false;
				
				self.logDebug(5, "Updating job tickets: " + job.id, params);
				
				// append to job meta log
				job.activity.push({ 
					id: Tools.generateShortID('m'),
					epoch: Tools.timeNow(), 
					server: 'm:' + self.hostID,
					username: user.username || user.id, 
					msg: "Updated job tickets: " + (params.tickets.join(', ') || '(None)')
				});
				params.activity = job.activity;
				
				return params;
			}, 
			function(err, job) {
				// done with update (and unlocked)
				if (err && (err === "ABORT")) return; // update was aborted and callback was handled
				if (err) return self.doError('job', "Failed to update job: " + params.id + ": " + err, callback);
				self.logTransaction('job_update_tickets', job.id, self.getClientInfo(args, params));
				self.doPageBroadcast( 'Job?id=' + job.id, 'job_updated', params );
				callback({ code: 0 });
			} ); // unbase.update
			
		}); // loadSession
	}
	
	api_resume_job(args, callback) {
		// resume suspended job
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'run_jobs', callback)) return;
			
			args.user = user;
			args.session = session;
			
			var job = self.activeJobs[ params.id ];
			if (!job) return self.doError('job', "Job not found or is no longer active: " + params.id, callback);
			
			if (!self.requireCategoryPrivilege(user, job.category, callback)) return;
			if (!self.requireTargetPrivilege(user, job.targets, callback)) return;
			
			if (!job.suspended) return self.doError('job', "Job is not currently suspended: " + params.id, callback);
			
			var action = Tools.findObject( job.actions || [], { type: 'suspend', active: true } );
			if (!action) return self.doError('job', "Cannot locate active suspend action in job: " + job.id, callback);
			
			self.logDebug(5, "Resuming suspended job: " + job.id);
			delete job.suspended;
			
			var agent = UserAgent.parse( args.request.headers['user-agent'] || 'Unknown' );
			var ua = agent.toString(); // 'Chrome 15.0.874 / Mac OS X 10.8.1'
			ua = ua.replace(/Mac OS X [\d\.]+/, 'macOS'); // sigh
			if (ua.match(/\b(Other)\b/)) ua = args.request.headers['user-agent'] || 'Unknown';
			
			// copy some details to action for logging
			var sus_details = "### Suspension Details:\n\n" + 
				"- **Duration:** " + Tools.getTextFromSeconds( Tools.timeNow(true) - action.date, false, false ) + "\n" + 
				"- **Resumed At:** " + (new Date()).toString() + "\n" + 
				"- **Resumed By:** `" + (user.username || user.id) + "`\n" + 
				(params.redirect ? `- **Jumped to Node:** \`#${params.redirect}\`\n` : '') + 
				"- **IP Addresses:** " + args.ips.join(', ') + "\n" + 
				"- **User Agent:** " + ua + "\n";
			
			if (params.params && Tools.firstKey(params.params)) {
				sus_details += "\n#### User Parameters\n\n```json\n" + JSON.stringify(params.params, null, "\t") + "\n```\n";
			}
			
			if (action.details) action.details = sus_details + "\n" + action.details;
			else action.details = sus_details;
			
			// import custom params into job
			if (!job.complete && params.params && Tools.firstKey(params.params)) {
				// job is starting, merge params into current job params
				Tools.mergeHashInto( job.params, params.params );
				
				for (var key in job.params) {
					if (key.match(/^_xy_override_(\w+)$/) && job.params[key] && job.params[key].length) {
						var sub_key = RegExp.$1;
						if (self.isReservedJobOverrideKey(key)) {
							self.logDebug(5, "Ignoring reserved job override param: " + key, { job: job.id, key: sub_key });
							continue;
						}
						self.logDebug(9, "Overriding job property with param: " + key, { key: sub_key, value: job.params[key] } );
						job[sub_key] = job.params[key];
					}
				} // foreach param
			} // import params
			
			// optional wf node redirect
			if (params.redirect && job.workflow && job.workflow.job) job.workflow.redirect = params.redirect;
			
			// remove job.server so it has to be re-chosen
			delete job.server;
			
			self.logTransaction('job_resume', job.id, self.getClientInfo(args, params));
			
			callback({ code: 0 });
			
			// notify all connected users that jobs have changed
			self.doUserBroadcastAll( 'status', { 
				epoch: Tools.timeNow(),
				activeJobs: self.getActiveJobs(),
				jobsChanged: true
			} );
			self.masterSync();
		}); // loadSession
	}
	
	api_abort_job(args, callback) {
		// abort running job
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'abort_jobs', callback)) return;
			
			args.user = user;
			args.session = session;
			
			var job = self.activeJobs[ params.id ];
			if (!job) return self.doError('job', "Job not found or is no longer active: " + params.id, callback);
			
			if (!self.requireCategoryPrivilege(user, job.category, callback)) return;
			if (!self.requireTargetPrivilege(user, job.targets, callback)) return;
			
			var reason = '';
			if (user.key) {
				// API Key
				reason = "Manually aborted by API Key: " + user.title;
			}
			else {
				reason = "Manually aborted by user: " + user.username;
			}
			params.reason = reason;
			
			self.abortJob(job, reason);
			self.logTransaction('job_abort', job.id, self.getClientInfo(args, params));
			
			callback({ code: 0 });
		}); // loadSession
	}
	
	api_delete_job(args, callback) {
		// delete completed job including log and files
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_jobs', callback)) return;
			
			args.user = user;
			args.session = session;
			
			var job = self.activeJobs[ params.id ];
			if (job) return self.doError('job', "Cannot delete a job that is still active: " + params.id, callback);
			
			// load job from storage
			self.unbase.get( 'jobs', params.id, function(err, job) {
				if (err) return self.doError('job', "Failed to load job details: " + params.id + ": " + err, callback);
				
				if (!self.requireCategoryPrivilege(user, job.category, callback)) return;
				if (!self.requireTargetPrivilege(user, job.targets, callback)) return;
				
				if (job.workflow && job.workflow.job) {
					var wf_job = self.activeJobs[ job.workflow.job ];
					if (wf_job) return self.doError('job', "Cannot delete a job from an active workflow: " + params.id, callback);
				}
				
				self.deleteJob(job, function(err) {
					if (err) return self.doError('job', "Failed to delete job: " + job.id + ": " + err, callback);
					
					self.logTransaction('job_delete', job.id, self.getClientInfo(args, params));
					callback({ code: 0 });
				}); // deleteJob
			}); // unbase.get
		}); // loadSession
	}
	
	api_flush_event_queue(args, callback) {
		// flush event queue without triggering completion actions
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'abort_jobs', callback)) return;
			
			args.user = user;
			args.session = session;
			
			var jobs = self.findActiveJobs({ event: params.id, state: 'queued' });
			jobs.forEach( function(job) {
				self.logDebug(6, "Silently deleting queued job: " + job.id, params);
				delete self.activeJobs[ job.id ];
			});
			
			self.logTransaction('queue_flush', params.id, self.getClientInfo(args, params));
			callback({ code: 0, count: jobs.length });
			
			// notify all connected users that jobs have changed
			self.doUserBroadcastAll( 'status', { 
				epoch: Tools.timeNow(),
				activeJobs: self.getActiveJobs(),
				jobsChanged: true
			} );
			self.masterSync();
			
		}); // loadSession
	}
	
	api_finish_job(args, callback) {
		// finish job -- this internal API is used by satellite only
		// 3 methods of auth: api_key, server id + secret hash, or job id + secret hash
		var self = this;
		var params = args.params;
		
		if (!this.requireMaster(args, callback)) return;
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/,
			auth: /^\w+$/,
			job: 'object'
		}, callback)) return;
		
		// token may be an API KEY, so copy token into params
		params.api_key = params.auth;
		
		this.loadSession(args, function(err, session, user) {
			if (err) {
				// not an api key, so fallback to token check
				if (params.server) {
					// method A: satellite has perma-token based on its server ID, 
					// or one based on server AND job ID (i.e. remote job runner)
					var correct_token_a = Tools.digestHex( params.server + self.config.get('secret_key'), 'sha256' );
					var correct_token_b = Tools.digestHex( params.id + correct_token_a );
					if ((params.auth != correct_token_a) && (params.auth != correct_token_b)) {
						return self.doError('auth', "Authentication failure", callback);
					}
					
					// also validate server is active
					if (!self.servers[params.server]) return self.doError('auth', "Authentication failure", callback);
				}
				else {
					// method B: satellite hashes job ID and secret key
					var correct_token = Tools.digestHex( params.id + self.config.get('secret_key'), 'sha256' );
					if (params.auth != correct_token) return self.doError('auth', "Authentication failure", callback);
				}
			}
			else {
				// method C: authed via api key
				if (!self.requireValidUser(session, user, callback)) return;
			}
			
			self.logDebug(9, "Updating job via API: " + params.id);
			
			// convert request to correct internal format
			var data = {};
			data[ params.id ] = params.job;
			self.updateJobData(data);
			
			callback({ code: 0 });
		}); // loadSession
	}
	
	api_stream_job(args, callback) {
		// stream job updates to client via SSE
		// params: { id, token? }
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		if (params.token) {
			// auth via magic landing page
			var correct_token = Tools.digestHex( 'stream' + params.id + this.config.get('secret_key') );
			if (params.token != correct_token) return this.doError('api', "Authentication failed.", callback);
			return this.streamJob( params.id, args, callback );
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.streamJob( params.id, args, callback );
		}); // loadSession
	}
	
	streamJob(job_id, args, callback) {
		// stream job updates to client via SSE
		var self = this;
		var last_redraw = '';
		var last_state = '';
		var sent_server = false;
		var chunk_num = 1;
		
		this.api.logDebug(9, "Starting job SSE streaming response", { request: args.id, job: job_id });
		
		args.response.setHeader('Content-Type', 'text/event-stream');
		args.response.setHeader('Cache-Control', 'no-cache');
		args.response.writeHead(200, 'OK');
		
		// send start packet
		args.response.write("event: start\n");
		args.response.write("data: {}\n\n");
		
		async.whilst(
			function() {
				return !!self.activeJobs[job_id];
			},
			function(callback) {
				// send update chunk
				if (args.request.socket.destroyed || self.shut) return callback("ABORT");
				var job = self.activeJobs[job_id];
				if (!job) return callback();
				
				var update = { xy: 1 };
				
				if (chunk_num == 1) {
					update.id = job.id;
					update.started = job.started;
				}
				
				if (job.state != last_state) {
					last_state = job.state;
					update.state = job.state;
					if (job.until) update.until = job.until;
				}
				
				if (job.server && !sent_server) {
					sent_server = true;
					update.server = job.server;
				}
				
				['cpu', 'mem', 'disk', 'net', 'updated', 'position'].forEach( function(key) {
					if (job[key]) update[key] = job[key];
				} );
				
				if (job.redraw && (job.redraw != last_redraw)) {
					last_redraw = job.redraw;
					update.redraw = job.redraw;
					if (job.table) update.table = job.table;
					if (job.html) update.html = job.html;
				}
				
				update.progress = job.progress || 0;
				
				// args.response.write("id: " + chunk_num + "\n");
				args.response.write("event: update\n");
				args.response.write("data: " + JSON.stringify(update) + "\n\n");
				
				chunk_num++;
				setTimeout( function() { callback(); }, 1000 );
			},
			function(err) {
				if (err) {
					self.api.logDebug(8, "Aborting job stream", { request: args.id, job: job_id });
					args.response.end();
					return callback(true); // handled
				}
				
				// load final job for final update
				self.unbase.get('jobs', job_id, function(err, job) {
					var update = { xy: 1 };
					
					if (err) {
						update.error = true;
						update.code = 1;
						update.description = "Failed to load job data: " + err;
					}
					else {
						update.id = job.id;
						update.code = job.code;
						update.description = job.description;
						update.completed = job.completed;
						update.elapsed = job.elapsed;
						if (job.table) update.table = job.table;
						if (job.html) update.html = job.html;
						if (job.data) update.data = job.data;
						if (job.files) update.files = job.files;
					}
					
					self.api.logDebug(9, "Job stream complete", { request: args.id, data: update } );
					
					// args.response.write("id: " + chunk_num + "\n");
					args.response.write("event: update\n");
					args.response.write("data: " + JSON.stringify(update) + "\n\n");
					
					args.response.write("event: end\n");
					args.response.write("data: {}\n\n");
					
					args.response.end();
					callback(true); // handled
				}); // unbase.get
			}
		); // async.whilst
	}
	
}; // class Jobs

module.exports = Jobs;
