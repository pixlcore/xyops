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
			
			// Use the canonical resource filter so list, summary and broadcast paths
			// all share the same category, group and workflow behavior.
			var jobs = self.getUserLimitedJobs( self.getComputedUser(user), self.findActiveJobs(params) );
			
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
			
			// Use the canonical resource filter so workflow jobs are explicitly
			// exempt from legacy group limits, even if they have runtime targets.
			var jobs = self.getUserLimitedJobs( self.getComputedUser(user), self.findActiveJobs(params) );
			var events = {};
			
			jobs.forEach( function(job) {
				if (job.type == 'adhoc') return;
				
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
			
			var jobs = self.getUserLimitedJobs( self.getComputedUser(user), self.findActiveJobsDeep(params) );
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
	
	api_get_queue_summary(args, callback) {
		// summarize all queued jobs, for dashboard
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			// Use the canonical resource filter so workflow jobs are explicitly
			// exempt from legacy group limits, even if they have runtime targets.
			var jobs = self.getUserLimitedJobs( self.getComputedUser(user), self.findActiveJobs({ state: 'queued' }) );
			var queues = {};
			
			jobs.forEach( function(job) {
				var queue_id = self.getJobQueueID(job);
				if (!queues[queue_id]) queues[queue_id] = { id: queue_id, events: {}, categories: {}, sources: {}, targets: {}, plugins: {}, count: 0 };
				var queue = queues[queue_id];
				queue.count++;
				
				queue.events[ job.event ] = 1;
				queue.categories[ job.category ] = 1;
				if (job.type != 'workflow') queue.plugins[ job.plugin ] = 1;
				queue.sources[ job.source ] = 1;
				
				if (job.targets) job.targets.forEach( function(target) {
					queue.targets[target] = 1;
				} );
			} );
			
			return callback({
				code: 0,
				queues: Object.values(queues)
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
					
					// Convert jobs to an array while preserving exactly one response
					// position per requested ID.  Missing and inaccessible jobs use the
					// same generic placeholder so resource existence is not disclosed.
					var cuser = self.getComputedUser(user);
					var final_jobs = params.ids.map( function(id) {
						var job = jobs[id];
						if (!job || job.err || !self.getUserLimitedJobs(cuser, [job]).length) {
							return { err: "Failed to locate job: " + id };
						}
						return job;
					} );
					
					callback({ 
						code: 0, 
						jobs: final_jobs
					});
				}
			); // eachLimit
		}); // loadSession
	}
	
	api_get_job_log(args, callback) {
		// view job log (plain text)
		// client API, session auth or api key
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
			
			self.unbase.get( "jobs", params.id, function(err, job) {
				if (err) return self.doError('notfound', "Failed to load job details: " + params.id + ": " + err, callback);
				
				if (!self.requireCategoryPrivilege(user, job.category, callback)) return;
				if (!self.requireTargetPrivilege(user, job.targets, callback)) return;
				
				if (job.output) {
					// job log is inline
					return callback( "200 OK", { 'Content-Type': "text/plain; charset=utf-8" }, job.output );
				}
				
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
			}); // unbase.get
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
			
			// job may be in completion state (final actions, suspended, etc.) so try to grab output from details
			// (Note: This only works for jobs with under 1 MB, or max_inline_job_log_size, of output)
			if ((job.state == 'complete') && this.jobDetails[params.id] && this.jobDetails[params.id].output) {
				return callback( "200 OK", headers, this.jobDetails[params.id].output );
			}
			
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
			
			// job may be in completion state (final actions, suspended, etc.) so try to grab output from details
			// (Note: This only works for jobs with under 1 MB, or max_inline_job_log_size, of output)
			if ((job.state == 'complete') && this.jobDetails[params.id] && this.jobDetails[params.id].output) {
				return callback( "200 OK", headers, this.jobDetails[params.id].output );
			}
			
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
	
	api_download_workflow_job_logs(args, callback) {
		// download all wf sub-job logs as markdown
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
		
		// load workflow job first
		this.unbase.get( "jobs", params.id, function(err, job) {
			if (err) return callback("404 Not Found", {}, "Job record not found: " + params.id);
			if (!job.workflow?.jobs || !job.workflow?.nodes) {
				return callback("404 Not Found", {}, "Job is not a valid workflow: " + params.id);
			}
			
			// get ref to event if we have it
			var event = null;
			if (job.event) event = Tools.findObject( self.events, { id: job.event } );
			
			// now load all sub-jobs
			var stubs = [];
			var sub_jobs = [];
			
			for (var node_id in job.workflow.jobs) {
				stubs = stubs.concat( job.workflow.jobs[node_id].map( function(stub) { return { ...stub, node: node_id }; } ) );
			}
			
			async.eachLimit( stubs, self.storage.concurrency,
				function(stub, callback) {
					self.unbase.get( "jobs", stub.id, function(err, sub_job) {
						if (err) sub_jobs.push({ id: stub.id, err: ''+err, stub });
						else sub_jobs.push({ ...sub_job, stub });
						callback();
					} );
				},
				function(err) {
					// compose markdown
					var md = '';
					
					if (!params.inline) {
						md += "## Workflow Job Output\n\n";
						md += "- **Workflow ID:** `" + job.id + "`\n";
						if (event) md += "- **Event:** " + event.title + " (`" + event.id + "`)\n";
						if (job.label) md += "- **Label:** " + job.label + "\n";
						md += "- **Completed:** " + (new Date( job.completed * 1000 )).toString() + "\n";
						md += "- **Elapsed:** " + Tools.getTextFromSeconds( job.elapsed, false, false ) + "\n";
						md += "- **Sub-Jobs:** " + Tools.commify( sub_jobs.length ) + "\n";
					}
					
					// sort sub-jobs by completion date ascending
					Tools.sortBy( sub_jobs, 'completed', { type: 'number', dir: 1 } );
					
					sub_jobs.forEach( function(sub_job, idx) {
						var stub = sub_job.stub;
						var node = Tools.findObject( job.workflow.nodes, { id: stub.node } ) || {};
						
						var nice_title = node.data?.label;
						if (!nice_title) {
							if ((node.type == 'job') && node.data?.plugin) {
								var plugin = Tools.findObject( self.plugins, { id: node.data.plugin } );
								nice_title = plugin?.title || `Plugin #${node.data.plugin}`;
							}
							else if ((node.type == 'event') && node.data?.event) {
								var event = Tools.findObject( self.events, { id: node.data.event } );
								nice_title = event?.title || `Event #${node.data.event}`;
							}
							else nice_title = 'Unknown Job';
						}
						md += "\n### Job #" + Math.floor(idx + 1) + "/" + sub_jobs.length + ": " + nice_title.replace(/[<>\n\`\[\]]+/g, '') + "\n\n";
						
						md += "- **Node ID:** `" + node.id + "`\n";
						md += "- **Job ID:** `" + sub_job.id + "`\n";
						if (sub_job.server) {
							var server = self.servers[ sub_job.server ] || self.serverCache[ sub_job.server ];
							if (server) md += "- **Server:** " + (server.title || server.hostname) + " (`" + server.id + "`)\n";
							else md += "- **Server ID:** `" + server.id + "`\n";
						}
						// md += "- **Completed:** " + (new Date( sub_job.completed * 1000 )).toString() + "\n";
						md += "- **Elapsed:** " + Tools.getTextFromSeconds( sub_job.elapsed, false, false ) + "\n";
						if (sub_job.code) {
							md += "- **Error Code:** `" + sub_job.code + "`\n";
							if (sub_job.description) md += "- **Description:** " + sub_job.description + "\n";
						}
						
						if (sub_job.err || sub_job.output) {
							md += "\n**Output:**\n\n";
							md += "\n```\n" + Tools.stripANSI(sub_job.err || sub_job.output).trim().replace(/\`\`\`/g, '') + "\n```\n";
						}
						else if (sub_job.log_file_size) {
							// link to job output
							var base_app_url = self.config.get('base_app_url');
							var url = base_app_url + '/api/app/download_job_log?id=' + sub_job.id + '&t=' + Tools.digestBase64( 'download' + sub_job.id + self.config.get('secret_key'), 'sha256', 16 );
							var nice_size = Tools.getTextFromBytes( sub_job.log_file_size || 0 );
							md += `[Download Job Output](${url}) (${nice_size})\n`;
						}
						else if (sub_job.type == 'workflow') {
							// link to sub-workflow job outputs
							var base_app_url = self.config.get('base_app_url');
							var url = base_app_url + '/api/app/download_workflow_job_logs?id=' + sub_job.id + '&t=' + Tools.digestBase64( 'download' + sub_job.id + self.config.get('secret_key'), 'sha256', 16 );
							md += `[Download Nested Workflow Outputs](${url})\n`;
						}
						
						if (sub_job.data && Tools.firstKey(sub_job.data)) {
							md += "\n**Data:**\n\n";
							md += "\n```json\n" + JSON.stringify(sub_job.data, null, "\t") + "\n```\n";
						}
					} ); // foreach sub-job
					
					if (!sub_jobs.length) md += "\n(No sub-jobs executed.)\n";
					else if (!params.inline) md += "\n(End of report.)\n";
					
					if (params.inline) return callback({ code: 0, text: md });
					
					// send markdown to client
					var headers = {
						'Content-Type': "text/markdown; charset=utf-8",
						'Content-disposition': "attachment; filename=xyOps-Workflow-Job-Outputs-" + job.id + '.md'
					};
					self.setCacheResponse( args, self.config.get('ttl') );
					callback( "200 OK", headers, md );
				}
			); // async.eachLimit
		}); // unbase.get
	}
	
	api_tail_live_job_log(args, callback) {
		// get end-aligned chunk of live job log (for kickstarting real-time log viewer)
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		// Query string values arrive as strings, while JSON body values may be numbers.
		if (!this.validateOptionalParams(params, {
			bytes: [/^(string|number)$/, /^\d+$/]
		}, callback)) return;
		
		var log_chunk_size = ('bytes' in params) ? parseInt( params.bytes, 10 ) : 32768;
		if ((log_chunk_size < 1) || (log_chunk_size > 1024 * 1024)) {
			return this.doError('api', "Requested byte count out of range (1 - 1048576)", callback);
		}
		
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
			
			// job may be in completion state (final actions, suspended, etc.) so try to grab output from details
			// (Note: This only works for jobs with under 1 MB, or max_inline_job_log_size, of output)
			if ((job.state == 'complete') && self.jobDetails[params.id] && self.jobDetails[params.id].output) {
				var buffer = Buffer.from( self.jobDetails[params.id].output );
				var slice = buffer.slice( 0 - log_chunk_size );
				var text = slice.toString();
				
				lines = text.split(/\n/);
				if (buffer.length > log_chunk_size) {
					// remove first line, as it is likely partial
					lines.shift();
				}
				
				return callback({ code: 0, text: lines.join("\n") });
			}
			
			var log_file = Path.resolve( Path.join( self.config.get('log_dir'), 'jobs', job.id + '.log' ) );
			var log_fd = null;
			var log_stats = null;
			var log_buffer = Buffer.alloc( log_chunk_size );
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
				self.doPageRestrictedBroadcast( 'Job?id=' + job.id, 'job_updated', params, job );
				return callback({ code: 0 });
			}
			
			self.logDebug(5, "Updating job: " + params.id, params);
			
			// job must be completed, so update job from storage
			self.unbase.update( 'jobs', params.id, params, function(err, job) {
				// done with update (and unlocked)
				if (err) return self.doError('job', "Failed to update job: " + params.id + ": " + err, callback);
				self.logTransaction('job_update', job.id, self.getClientInfo(args, { params }));
				self.doPageRestrictedBroadcast( 'Job?id=' + job.id, 'job_updated', params, job );
				callback({ code: 0 });
			} ); // unbase.update
			
		}); // loadSession
	}
	
	api_update_active_job(args, callback) {
		// update running job with limits
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'update_jobs', callback)) return;
			
			var job = self.activeJobs[ params.id ];
			if (!job) return self.doError('job', "Active job not found: " + params.id, callback);
			
			var is_workflow = (job.type == 'workflow');
			
			if (!self.requireCategoryPrivilege(user, job.category, callback)) return;
			if (!is_workflow && !self.requireAllTargetPrivileges(user, job.targets, callback)) return;
			if (!self.requireRuntimeTargetPrivileges(user, job, callback, true)) return;
			if (!self.requireRuntimeTargetPrivileges(user, params, callback)) return;
			if (is_workflow && !self.requireWorkflowPrivileges(user, job.workflow, callback)) return;
			if (job.remote) return self.doError('job', "Cannot update job while it is running remotely: " + params.id, callback);
			
			args.user = user;
			args.session = session;
			
			// launch context is resolved from trusted plugin/config data at runtime
			self.deleteJobLaunchContext(params);
			
			// do not allow category or event type to be changed
			delete params.type;
			delete params.category;
			
			// if overriding targets, confirm user has permission
			if (params.targets && !self.requireAllTargetPrivileges(user, params.targets, callback)) return;
			
			// apply defaults for locked plugin params, if user is not an admin
			var privs = self.getComputedPrivileges(user);
			
			if (!is_workflow && !privs.admin) {
				var old_params = job.params || {};
				var plugin = Tools.findObject(self.plugins, { id: params.plugin || job.plugin });
				
				// partial top-level updates may omit params entirely, so preserve the live values
				if (!params.params) params.params = Tools.copyHash(old_params, true);
				
				// if plugin has changed, we need to default values to the plugin defaults, NOT the previous event values
				var plugin_changed = (params.plugin && (params.plugin != job.plugin));
				
				if (plugin && plugin.params) plugin.params.forEach( function(param) {
					if (param.locked) params.params[ param.id ] = plugin_changed ? param.value : old_params[ param.id ];
				} ); // foreach plugin param
			}
			else if (is_workflow && !privs.admin) {
				// for workflows, if user is non-admin we need to default the locked params of all event and job nodes
				self.applyDefaultWorkflowNodeParams(params, job);
			}
			
			// workflow updates are shallow within the workflow object, so callers can update
			// nodes or connections without replacing live engine state and completed job history
			if (is_workflow && Tools.isaHash(params.workflow)) {
				params.workflow = Tools.mergeHashes(job.workflow || {}, params.workflow);
			}
			
			var merged = Tools.mergeHashes(job, params);
			if (!self.requireValidEventData(merged, callback)) return;
			if (!self.requireRuntimeTargetPrivileges(user, merged, callback, true)) return;
			if (is_workflow && !self.requireWorkflowPrivileges(user, merged.workflow, callback)) return;
			
			// validate event field param values
			if (job.fields) {
				try { self.validateParamValues(merged.params, job.fields); }
				catch (err) { return self.doError('api', "Event: " + err.message, callback); }
			}
			
			// ensure user has proper access to all nested nodes and replays
			self.verifyDeepWorkflowAccess( user, merged.workflow, function(err) {
				if (err) return self.doError('access', err.message || err, callback);
				
				self.logDebug(5, "Updating job: " + job.id, params);
				Tools.mergeHashInto( job, params );
				self.doPageRestrictedBroadcast( 'Job?id=' + job.id, 'job_updated', params, job );
				return callback({ code: 0 });
			}); // verifyDeepWorkflowAccess
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
			if (!self.requireAllTargetPrivileges(user, job.targets, callback)) return;
			if (!self.requireRuntimeTargetPrivileges(user, job, callback, true)) return;
			if ((job.type == 'workflow') && !self.requireWorkflowPrivileges(user, job.workflow, callback)) return;
			
			// allow user to skip over workflow wait contrlllers here too
			if (params.node) {
				if (!job.workflow || !job.workflow.nodes || !job.workflow.state) {
					return self.doError('job', "Job is not a workflow: " + job.id, callback);
				}
				if (job.state != 'active') {
					return self.doError('job', "Workflow job is not active: " + job.id, callback);
				}
				
				var node = Tools.findObject( job.workflow.nodes, { id: params.node } );
				if (!node) return self.doError('job', "Workflow node not found in job: " + params.node, callback);
				
				var state = job.workflow.state[ node.id ];
				if (!state) return self.doError('job', "Workflow node state not found in job: " + params.node, callback);
				
				if (node.type !== 'controller') return self.doError('job', "Workflow node is not a controller: " + params.node, callback);
				if (node.data?.controller !== 'wait') return self.doError('job', "Workflow node is not a wait controller: " + params.node, callback);
				if (state.skip) return self.doError('job', "Workflow wait controller has already been skipped: " + params.node, callback);
				
				state.skip = true;
				self.logWorkflow(job, node.id, `WARNING: Wait skipped manually by user: #${user.username || user.id}`);
				
				callback({ code: 0 });
				return;
			} // workflow
			
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
				job.actions.push({ condition: 'complete', type: 'email', email: user.email, users: [], enabled: true });
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
				self.doPageRestrictedBroadcast( 'Job?id=' + job.id, 'job_updated', params, job );
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
				self.doPageRestrictedBroadcast( 'Job?id=' + job.id, 'job_updated', params, job );
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
			var details = self.jobDetails[ params.id ];
			if (!job || !details) return self.doError('job', "Job not found or is no longer active: " + params.id, callback);
			
			if (!self.requireCategoryPrivilege(user, job.category, callback)) return;
			if (!self.requireAllTargetPrivileges(user, job.targets, callback)) return;
			if (!self.requireRuntimeTargetPrivileges(user, job, callback, true)) return;
			if (!self.requireRuntimeTargetPrivileges(user, params, callback)) return;
			if ((job.type == 'workflow') && !self.requireWorkflowPrivileges(user, job.workflow, callback)) return;
			
			if (!job.suspended) return self.doError('job', "Job is not currently suspended: " + params.id, callback);
			
			var action = Tools.findObject( job.actions || [], { type: 'suspend', active: true } );
			if (!action) return self.doError('job', "Cannot locate active suspend action in job: " + job.id, callback);
			
			// validate params and data injections
			if ('params' in params) {
				if (job.complete) return self.doError('job', "Cannot inject parameters at job completion time.", callback);
				if (!Tools.isaHash(params.params)) return self.doError('job', "Malformed user parameters object.", callback);
				if (!self.requireValidJobOverrides(params.params, "Job params", callback)) return;
			}
			if ('input' in params) {
				if (job.complete) return self.doError('job', "Cannot inject input data at job completion time.", callback);
				if (!Tools.isaHash(params.input)) return self.doError('job', "Malformed input data object.", callback);
				if (!Tools.isaHash(params.input.data)) return self.doError('job', "Malformed input data object.", callback);
			}
			if ('data' in params) {
				if (!job.complete) return self.doError('job', "Cannot inject output data at job start time.", callback);
				if (!Tools.isaHash(params.data)) return self.doError('job', "Malformed output data object.", callback);
			}
			
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
			
			var addJSONDetails = function(title, data, max_length = 8192) {
				var payload = "```json\n" + JSON.stringify(data, null, "\t") + "\n```";
				if (payload.length > max_length) payload = "(Data too large to display)";
				sus_details += "\n### " + title + "\n\n" + payload + "\n";
			};
			
			// import custom params into job
			if (!job.complete && params.params && Tools.isaHash(params.params) && Tools.firstKey(params.params)) {
				// job is starting, merge params into current job params
				Tools.mergeHashInto( job.params, params.params );
				addJSONDetails( "User Parameters", params.params );
				
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
			
			// optionally shallow-merge input data into job (at start)
			if (!job.complete && params.input && params.input.data && Tools.isaHash(params.input.data) && Tools.firstKey(params.input.data)) {
				if (!details.input) details.input = {};
				if (!details.input.data) details.input.data = {};
				Tools.mergeHashInto( details.input.data, params.input.data );
				addJSONDetails( "User Input Data", params.input.data );
			}
			
			// optionally shallow-merge output data into job (at completion)
			if (job.complete && params.data && Tools.isaHash(params.data) && Tools.firstKey(params.data)) {
				if (!details.data) details.data = {};
				Tools.mergeHashInto( details.data, params.data );
				addJSONDetails( "User Output Data", params.data );
			}
			
			if (action.details) action.details = sus_details + "\n" + action.details;
			else action.details = sus_details;
			
			// optional wf node redirect
			if (params.redirect && job.workflow && job.workflow.job) job.workflow.redirect = params.redirect;
			
			// remove job.server so it has to be re-chosen
			delete job.server;
			
			self.logTransaction('job_resume', job.id, self.getClientInfo(args, params));
			
			callback({ code: 0 });
			
			// notify all connected users that jobs have changed
			self.jobsChanged = true;
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
			
			var event = Tools.findObject( self.events, { id: params.id } );
			if (!event) return self.doError('event', "Event not found: " + params.id, callback);
			
			if (!self.requireCategoryPrivilege(user, event.category, callback)) return;
			if (!self.requireTargetPrivilege(user, event.targets, callback)) return;
			
			var jobs = self.findActiveJobs({ event: params.id, state: 'queued' });
			jobs.forEach( function(job) {
				self.logDebug(6, "Silently deleting queued job: " + job.id, params);
				delete self.activeJobs[ job.id ];
			});
			
			self.logTransaction('queue_flush', params.id, self.getClientInfo(args, params));
			callback({ code: 0, count: jobs.length });
			
			// notify all connected users that jobs have changed
			self.jobsChanged = true;
			
		}); // loadSession
	}
	
	api_flush_job_queue(args, callback) {
		// flush queue by its ID, without triggering completion actions
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_\-\:]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'abort_jobs', callback)) return;
			
			args.user = user;
			args.session = session;
			
			// Use the canonical resource filter so workflow jobs are explicitly
			// exempt from legacy group limits, even if they have runtime targets.
			var jobs = self.getUserLimitedJobs( self.getComputedUser(user), self.findActiveJobs({ state: 'queued' }) ).filter( function(job) {
				var queue_id = self.getJobQueueID(job);
				return queue_id == params.id;
			} );
			
			jobs.forEach( function(job) {
				self.logDebug(6, "Silently deleting queued job: " + job.id, params);
				delete self.activeJobs[ job.id ];
			});
			
			self.logTransaction('queue_flush', params.id, self.getClientInfo(args, params));
			callback({ code: 0, count: jobs.length });
			
			// notify all connected users that jobs have changed
			self.jobsChanged = true;
			
		}); // loadSession
	}
	
	api_finish_job(args, callback) {
		// finish job -- this internal API is used by satellite only
		// Accept an API key, a per-server auth token, or a scoped runner token.
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
				if (!params.server) return self.doError('auth', "Authentication failure", callback);
				
				// Validate the per-server token, or the scoped token passed to a runner,
				// which is derived from the job ID and the per-server token.
				var correct_token_a = Tools.digestHex( params.server + self.config.get('secret_key'), 'sha256' );
				var correct_token_b = Tools.digestHex( params.id + correct_token_a );
				if ((params.auth != correct_token_a) && (params.auth != correct_token_b)) {
					return self.doError('auth', "Authentication failure", callback);
				}
				
				// also validate server is active
				if (!self.servers[params.server]) return self.doError('auth', "Authentication failure", callback);
			}
			else {
				// Authenticated via API key.
				if (!self.requireValidUser(session, user, callback)) return;
				if (!self.requirePrivilege(user, 'add_servers', callback)) return;
				
				// make sure api key is not restricted in any way
				var cuser = self.getComputedUser(user);
				if (cuser.categories.length || cuser.groups.length) {
					return self.doError('auth', "Authorization failure: Restricted key", callback);
				}
			}
			
			self.logDebug(10, "Updating job via API: " + params.id);
			
			// convert request to correct internal format
			var data = {};
			data[ params.id ] = params.job;
			self.updateJobData(data);
			
			callback({ code: 0 });
		}); // loadSession
	}
	
	api_stream_job(args, callback) {
		// stream job updates to client via SSE
		// params: { id, token?, output?, meta? }
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
			
			if (params.id in self.activeJobs) {
				var job = self.activeJobs[params.id];
				
				if (!self.requireCategoryPrivilege(user, job.category, callback)) return;
				if (!self.requireTargetPrivilege(user, job.targets, callback)) return;
				
				self.streamJob( params.id, args, callback );
			}
			else {
				self.unbase.get('jobs', params.id, function(err, job) {
					if (err) return self.doError('notfound', "Failed to load job details: " + params.id + ": " + err, callback);
					
					if (!self.requireCategoryPrivilege(user, job.category, callback)) return;
					if (!self.requireTargetPrivilege(user, job.targets, callback)) return;
					
					self.streamJob( params.id, args, callback );
				}); // unbase.get
			}
		}); // loadSession
	}
	
	waitForJob(job_id, callback) {
		// wait for job to complete, then return full job record
		var self = this;
		
		async.whilst(
			function() {
				return !!self.activeJobs[job_id];
			},
			function(callback) {
				// send update chunk
				if (self.shut) return callback("ABORT");
				setTimeout( function() { callback(); }, 250 );
			},
			function() {
				// load final job for final update
				if (self.shut) return callback( new Error("Server is shutting down.") );
				
				self.unbase.get('jobs', job_id, function(err, job) {
					if (err) return callback(err);
					
					// remove verbose fields
					delete job.timelines;
					
					// if job is a workflow, load all sub-jobs as well
					if (job.workflow && job.workflow.jobs) {
						var keys = [];
						
						Object.values(job.workflow.jobs).forEach( jobs => {
							jobs.forEach( stub => keys.push( 'unbase/records/jobs/' + stub.id ) );
						} );
						
						self.storage.getMulti( keys, function(err, jobs) {
							if (err) return callback(err);
							
							jobs.forEach( function(sub_job) {
								// remove verbose fields
								delete sub_job.timelines;
							} );
							
							callback(null, { job, jobs });
						}); // storage.getMulti
					}
					else callback(null, { job });
				}); // unbase.get
			}
		); // async.whilst
	}
	
	streamJob(job_id, args, callback) {
		// stream job updates to client via SSE
		var self = this;
		var last_redraw = '';
		var last_state = '';
		var sent_server = false;
		var chunk_num = 1;
		
		// optionally flag args if raw job output is requested
		if (args.query.output || args.params.output) {
			args._xy_stream_job_output = job_id;
		}
		if (args.query.meta || args.params.meta) {
			args._xy_stream_job_meta = job_id;
		}
		
		this.api.logDebug(9, "Starting job SSE streaming response", { request: args.id, job: job_id });
		
		args.response.setHeader('Content-Type', 'text/event-stream');
		args.response.setHeader('Cache-Control', 'no-cache');
		
		// Ask Nginx to forward each SSE event immediately instead of buffering it.
		args.response.setHeader('X-Accel-Buffering', 'no');
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
