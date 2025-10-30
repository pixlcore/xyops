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
			
			var cats = self.getComputedCategories(user);
			var cgrps = self.getComputedGroups(user);
			
			var jobs = self.findActiveJobs(params).filter( function(job) {
				if (cats.length && !cats.includes(job.category)) return false;
				if (cgrps.length && job.targets && job.targets.length && !Tools.includesAny(cgrps, job.targets)) return false;
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
			
			var cats = self.getComputedCategories(user);
			var cgrps = self.getComputedGroups(user);
			
			jobs.forEach( function(job) {
				if (job.type == 'adhoc') return;
				if (cats.length && !cats.includes(job.category)) return;
				if (cgrps.length && job.targets && job.targets.length && !Tools.includesAny(cgrps, job.targets)) return;
				
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
			id: /^\w+$/
		}, callback)) return;
		
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
				if (err) return self.doError('job', "Failed to load job details: " + params.id + ": " + err, callback);
				
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
			id: /^\w+$/
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
			id: /^\w+$/,
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
			id: /^\w+$/,
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
			id: /^\w+$/
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
			id: /^\w+$/
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
	
	api_job_toggle_notify_me(args, callback) {
		// toggle job complete notification for current user
		// for active jobs only!
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
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
				job.actions.push({ condition: 'complete', type: 'email', email: user.email, enabled: true, hidden: true });
				notify_me = true;
			}
			else {
				// remove notification
				Tools.deleteObject( job.actions, { condition: 'complete', type: 'email', email: user.email } );
				notify_me = false;
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
			id: /^\w+$/,
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
					epoch: Tools.timeNow(), 
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
			id: /^\w+$/,
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
					epoch: Tools.timeNow(), 
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
	
	api_manage_job_comments(args, callback) {
		// update completed job comments (add, update or delete)
		var self = this;
		var params = args.params;
		var now = Tools.timeNow();
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			comments: 'array'
		}, callback)) return;
		
		if (Tools.numKeys(params) > 2) {
			return this.doError('job', "Too many properties in params", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'comment_jobs', callback)) return;
			
			args.user = user;
			args.session = session;
			
			var username = user.username || user.id;
			var privs = self.getComputedPrivileges(user);
			
			var job = self.activeJobs[ params.id ];
			if (job) return self.doError('job', "Cannot update comments of running job.", callback);
			
			var appendMeta = function(job, msg) {
				// append message to job meta log
				job.activity.push({ 
					epoch: now,
					username: username, 
					msg: msg
				});
			};
			
			// job must be completed, so update job in storage
			self.unbase.update( 'jobs', params.id, function(job) {
				// perform updates here or bail out (inside unbase lock block)
				if (!self.requireCategoryPrivilege(user, job.category, callback)) return false;
				if (!self.requireTargetPrivilege(user, job.targets, callback)) return false;
				
				self.logDebug(5, "Updating job comments: " + job.id, params);
				
				if (!job.comments) job.comments = [];
				var err = null;
				
				params.comments.forEach( function(comment) {
					if (err) return;
					
					if (!comment.delete) {
						// if not deleting, then validate msg
						if (!comment.msg || (typeof(comment.msg) != 'string')) {
							err = "Missing or malformed comment body";
							return;
						}
						comment.msg = comment.msg.replace(/<[^>]*>/g, '').trim();
						if (!comment.msg.match(/\S/)) {
							err = "Missing or malformed comment body";
							return;
						}
					}
					
					if (comment.id) {
						// edit or delete, validate user
						var old_comment = Tools.findObject( job.comments, { id: comment.id } );
						if (!old_comment) {
							err = "Comment not found: " + comment.id;
							return;
						}
						if ((old_comment.username != username) && !privs.admin) {
							err = "Insufficient privileges to edit comment: " + comment.id;
							return;
						}
						
						if (comment.delete) {
							// delete comment
							Tools.deleteObject( job.comments, { id: comment.id } );
							appendMeta(job, "Deleted a comment.");
						}
						else {
							// edit comment
							old_comment.msg = comment.msg;
							old_comment.date = now;
							old_comment.edited = true;
							old_comment.username = username;
							appendMeta(job, "Edited a comment.");
						}
					}
					else {
						// add new comment
						comment.id = Tools.generateShortID('c');
						comment.date = now;
						comment.username = username;
						job.comments.push(comment);
						appendMeta(job, "Added a new comment.");
					}
				} ); // foreach change
				
				if (err) return self.doError('job', "Failed to update comments: " + err, callback);
				
				params.comments = job.comments;
				params.activity = job.activity;
				return params;
			}, 
			function(err, job) {
				// done with update (and unlocked)
				if (err && (err === "ABORT")) return; // update was aborted and callback was handled
				if (err) return self.doError('job', "Failed to update job: " + params.id + ": " + err, callback);
				self.logTransaction('job_update_comments', job.id, self.getClientInfo(args, params));
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
			id: /^\w+$/
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
				"- **IP Addresses:** " + args.ips.join(', ') + "\n" + 
				"- **User Agent:** " + ua + "\n";
			
			if (params.params && Tools.firstKey(params.params)) {
				sus_details += "\n#### User Parameters\n\n```json\n" + JSON.stringify(params.params, null, "\t") + "\n```\n";
			}
			
			if (action.details) action.details = sus_details + "\n" + action.details;
			else action.details = sus_details;
			
			// import custom params into job
			if (!job.complete) {
				// job is starting, merge params into current job params
				Tools.mergeHashInto( job.params, params.params || {} );
			}
			
			self.logTransaction('job_resume', job.id, self.getClientInfo(args, params));
			
			callback({ code: 0 });
			
			// notify all connected users that jobs have changed
			self.doUserBroadcastAll( 'status', { 
				epoch: Tools.timeNow(),
				activeJobs: self.getActiveJobs(),
				jobsChanged: true
			} );
		}); // loadSession
	}
	
	api_abort_job(args, callback) {
		// abort running job
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
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
			id: /^\w+$/
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
			id: /^\w+$/
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
			
		}); // loadSession
	}
	
}; // class Jobs

module.exports = Jobs;
