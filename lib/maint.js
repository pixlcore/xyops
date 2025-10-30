// xyOps Maintenance Layer
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const cp = require("child_process");
const zlib = require('zlib');
const async = require('async');
const Path = require('path');
const Tools = require("pixl-tools");

const noop = function() {};
const glob = Tools.glob;

class Maintenance {
	
	logMaint(level, msg, data) {
		// log debug msg with pseudo-component
		if (this.debugLevel(level)) {
			this.logger.set( 'component', 'Maint' );
			this.logger.print({ category: 'debug', code: level, msg: msg, data: data });
		}
	}
	
	setupMaint() {
		// setup stat tracking system
		var self = this;
		var now = Tools.timeNow(true);
		var mem = process.memoryUsage();
		
		this.stats = {
			file: Path.join( this.config.get('log_dir'), "stats.json" ),
			currentMinute: {},
			lastMinute: {},
			currentDay: { 
				timeStart: now,
				transactions: {},
				servers: {},
				groups: {}
			},
			mem: mem.rss,
			memoryUsage: mem,
			cpu: 0
		};
		
		// Note: this is during startup, so it's okay to use the fs *sync functions.
		if (fs.existsSync(this.stats.file)) try {
			var temp = JSON.parse( fs.readFileSync(this.stats.file, 'utf8') );
			this.stats.currentDay = temp.currentDay;
		} catch(e) {;}
		
		// if day has changed since last run, reset daily stats now
		if (Tools.formatDate(this.stats.currentDay.timeStart, '[yyyy]/[mm]/[dd]') != Tools.formatDate(now, '[yyyy]/[mm]/[dd]')) {
			this.maintReset();
			fs.writeFileSync( this.stats.file, JSON.stringify(this.stats) );
		}
		
		// prime this for repeated calls (delta)
		this.stats.lastCPU = process.cpuUsage();
		this.stats.lastCPUTime = Tools.timeNow();
		
		// listen for ticks and minutes for maint system
		this.server.on('tick', this.maintSecond.bind(this));
		this.server.on('minute', this.maintMinute.bind(this));
		
		this.server.on( this.config.get('stat_reset') || 'day', function() {
			self.maintReset();
		});
	}
	
	getDailyStat(key) {
		// fetch single daily stat
		return this.stats.currentDay.transactions[key] || 0;
	}
	
	updateDailyStat(key, delta = 1) {
		// update daily transaction stat, e.g. user_login
		if (!this.master) return;
		this.stats.currentDay.transactions[key] = (this.stats.currentDay.transactions[key] || 0) + delta;
	}
	
	getDailyCustomStat(path) {
		// return current daily custom stat from path
		return Tools.getPath( this.stats.currentDay, path ) || 0;
	}
	
	updateDailyCustomStat(path, delta = 1) {
		// update daily custom stat (e.g. `servers.SERVERID.job_complete`)
		var value = Tools.getPath( this.stats.currentDay, path ) || 0;
		Tools.setPath( this.stats.currentDay, path, value + delta);
	}
	
	maintSecond() {
		// grab real-time stats from web server and accumulate in currentMinute
		if (!this.master) return;
		var web_stats = this.web.getStats();
		var minute = this.stats.currentMinute;
		
		if (!web_stats.stats) web_stats.stats = {};
		if (!web_stats.stats.total) web_stats.stats.total = {};
		if (!web_stats.queue) web_stats.queue = {};
		
		minute.sockets = (minute.sockets || 0) + (web_stats.stats.num_sockets || 0);
		minute.requests = (minute.requests || 0) + (web_stats.stats.num_requests || 0);
		minute.bytes_in = (minute.bytes_in || 0) + (web_stats.stats.bytes_in || 0);
		minute.bytes_out = (minute.bytes_out || 0) + (web_stats.stats.bytes_out || 0);
		minute.avg_elapsed = (minute.avg_elapsed || 0) + (web_stats.stats.total.avg || 0);
		minute.running = (minute.running || 0) + (web_stats.queue.running || 0);
		minute.pending = (minute.pending || 0) + (web_stats.queue.pending || 0);
		minute.count = (minute.count || 0) + 1;
	}
	
	maintMinute() {
		// copy select values to daily
		var self = this;
		var minute = this.stats.currentMinute;
		var day = this.stats.currentDay;
		
		// day totals
		['requests', 'bytes_in', 'bytes_out'].forEach( function(key) {
			day[key] = (day[key] || 0) + (minute[key] || 0);
		} );
		
		// calc sec averages for performa
		for (var key in minute) {
			minute[key] = Math.floor( minute[key] / (minute.count || 1) );
		}
		
		// add current server mem/cpu
		var now = Tools.timeNow();
		var elapsed = now - this.stats.lastCPUTime;
		var cpu = process.cpuUsage( this.stats.lastCPU );
		this.stats.lastCPU = process.cpuUsage();
		this.stats.lastCPUTime = now;
		
		var mem = process.memoryUsage();
		this.stats.mem = mem.rss;
		this.stats.memoryUsage = mem;
		
		this.stats.cpu = ((cpu.user + cpu.system) / (elapsed * 1e6)) * 100; // percent of one core
		this.stats.load = (os.loadavg())[0];
		this.stats.started = this.server.started;
		
		// add misc other stats
		this.stats.unbase = this.unbase.getStats();
		
		if (this.storage.engine.cache) {
			this.stats.cache = this.storage.engine.cache.getStats();
		}
		else if (this.storage.engine.docEngine && this.storage.engine.docEngine.cache) {
			this.stats.cache = this.storage.engine.docEngine.cache.getStats();
		}
		
		// rollover minute stats into lastMinute, reset for next minute
		this.stats.lastMinute = minute;
		this.stats.currentMinute = {};
		
		// expire old transfer toksns
		this.expireTransferTokens();
		
		// expire old servers out of serverCache
		this.expireServerCache();
		
		// save stats to disk
		fs.writeFile( self.stats.file, JSON.stringify(self.stats), function(err) {
			if (err) self.logError('stats', "Failed to write stats file: " + self.stats.file + ": " + err);
		});
		
		// broadcast stats to all users every minute
		this.doUserBroadcastAll( 'update', { stats: this.stats } );
		
		// send peer update to all user sockets
		this.broadcastPeerUpdate();
	}
	
	expireTransferTokens() {
		// expire old transfer tokens for security and freeing memory
		var now = Tools.timeNow(true);
		
		for (var id in this.transferTokens) {
			var token = this.transferTokens[id];
			if (token.expires <= now) {
				this.logMaint(9, "Deleting expired transfer token: " + id);
				delete this.transferTokens[id];
			}
		}
	}
	
	expireServerCache() {
		// expire old servers out of serverCache
		var now = Tools.timeNow(true);
		
		for (var key in this.serverCache) {
			if (this.serverCache[key].modified < now - 86400) delete this.serverCache[key];
		}
	}
	
	maintReset() {
		// daily stat reset
		var self = this;
		this.logMaint(6, "A new day dawns, resetting daily stats.");
		
		// save historical metrics in storage
		this.storage.listPush( 'global/stats', this.stats, function(err) {
			if (err) self.logError('stats', "Failed to push stats to storage: " + err);
			
			// do the reset regardless
			self.stats.currentDay = {
				timeStart: Tools.timeNow(true),
				transactions: {},
				servers: {},
				groups: {}
			};
		} ); // storage.listPush
	}
	
	runMaintenance(callback) {
		// run all daily maintenance bits
		var self = this;
		if (!this.master) return;
		if (!callback) callback = noop;
		
		async.series([
			this.runStateMaintenance.bind(this),
			this.runTimelineMaintenance.bind(this),
			this.runDBMaintenance.bind(this),
			
			function(callback) {
				// storage maint (delete expired records)
				if (self.server.shut) return process.nextTick(callback);
				if (self.findInternalJobs({ type: 'storage' }).length) return process.nextTick(callback);
				
				var job = self.startInternalJob({ title: "Storage maintenance", type: 'storage' });
				
				self.storage.runMaintenance( new Date(), function() {
					job.finish();
					callback();
				} );
			}
		], callback);
	}
	
	runStateMaintenance(callback) {
		// delete stale keys in state
		var now = Tools.timeNow(true);
		
		if (this.state.watches) {
			for (var type in this.state.watches) {
				for (var id in this.state.watches[type]) {
					if (this.state.watches[type][id] < now) {
						delete this.state.watches[type][id];
						this.state.dirty = true;
					}
				}
			}
		}
		
		process.nextTick(callback);
	}
	
	runTimelineMaintenance(callback) {
		// run nightly maint on server timeline lists
		var self = this;
		var max_epoch_sec = Tools.getSecondsFromText( this.config.get('timeline_expiration') );
		
		if (this.server.shut) return process.nextTick(callback);
		if (self.findInternalJobs({ type: 'timeline' }).length) return process.nextTick(callback);
		
		var job = self.startInternalJob({ title: "Monitor timeline maintenance", type: 'timeline' });
		
		this.storage.searchRecords( '*', this.unbase.indexes.servers, function(err, results) {
			if (err) {
				job.finish();
				self.logError('maint', "Failed to search servers: " + err);
				return callback();
			}
			if (!results) results = {};
			
			// convert hash to array for async iteration
			// sort by oldest to newest (by ID)
			var records = Object.keys(results).sort( function(a, b) { 
				return a.toString().localeCompare(b); 
			} );
			
			if (!records.length) {
				job.finish();
				self.logMaint(7, "No servers found for monitor data maint");
				return callback();
			}
			
			self.logMaint(7, "Scanning " + records.length + " servers for monitoring data");
			var server_idx = 0;
			
			async.eachSeries( records,
				function(server_id, callback) {
					// track progress
					job.update({ progress: server_idx / records.length });
					server_idx++;
					
					// construct list paths for each monitor zoom level
					async.eachSeries( self.systems,
						function(sys, callback) {
							var list_path = 'timeline/' + server_id + '/' + sys.id;
							var max_rows = Math.floor( max_epoch_sec / sys.epoch_div );
							
							self.storage.listGetInfo( list_path, function(err, info) {
								// list may not exist, skip if so
								if (err) return callback();
								
								// check list length
								if (info.length > max_rows) {
									// list has grown too long, needs a trim
									self.logMaint(5, "List " + list_path + " has grown too long, trimming to max: " + max_rows, info);
									self.storage.listSplice( list_path, 0, info.length - max_rows, null, callback );
								}
								else {
									// no trim needed, proceed to next list
									callback();
								}
							} ); // get list info
						},
						callback
					);
				},
				function(err) {
					// all done!
					job.finish();
					if (err) self.logError('export', "Server monitor maint failed: " + err);
					else self.logMaint(6, "Server monitor maint completed");
					callback();
				}
			); // eachSeries
		} ); // searchRecords
	}
	
	runDBMaintenance(callback) {
		// run nightly db maint (trim indexes)
		var self = this;
		if (this.server.shut) return process.nextTick(callback);
		
		var db_maint = this.config.get('db_maint');
		
		async.eachSeries( Object.keys(db_maint),
			function(index_id, callback) {
				var opts = Tools.copyHash( db_maint[index_id], true );
				var path = 'unbase/index/' + index_id + '/_id';
				self.logMaint(6, "Performing DB maintenance on: " + index_id, opts);
				
				self.storage.get( path, function(err, info) {
					if (err) return callback(); // not created yet, no problem
					self.logMaint(6, "DB Index Info: " + index_id, info);
					
					if (info.length > opts.max_rows) {
						// db is too large, but check for conflicting internal jobs first
						var jobs = self.findInternalJobs({ index: index_id });
						if (jobs.length) {
							self.logMaint(6, "DB Index " + index_id + " has internal jobs running, skipping maint", { info, jobs });
						}
						else {
							// go go go background job!
							opts.title = "Database maintenance (" + index_id + ")";
							opts.index = index_id;
							opts.query = '*';
							opts.max = info.length - opts.max_rows; 
							delete opts.max_rows;
							
							// one db job at a time
							opts.callback = callback;
							self.dbSearchDelete(opts);
							return;
						}
					}
					else {
						// no maint needed
						self.logMaint(6, "DB Index " + index_id + " does not require maintenance, skipping", info);
					}
					
					callback();
				} ); // storage.get
			},
			callback
		); // async.eachSeries
	}
	
	archiveLogs() {
		// archive all logs (called once daily at midnight)
		// log_archive_storage: { enabled, key_template, expiration }
		var self = this;
		var src_spec = this.config.get('log_dir') + '/*.log';
		
		if (this.config.get('log_archive_path')) {
			// archive to filesystem (not storage)
			var job = this.startInternalJob({ title: "Archiving logs to disk", type: 'logs' });
			
			var dest_path = this.config.get('log_archive_path');
			this.logMaint(4, "Archiving logs: " + src_spec + " to: " + dest_path);
			
			// generate time label from previous day, so just subtracting 30 minutes to be safe
			var epoch = Tools.timeNow(true) - 1800;
			
			this.logger.archive(src_spec, dest_path, epoch, function(err) {
				if (err) self.logError('maint', "Failed to archive logs: " + err);
				else self.logMaint(4, "Log archival complete");
				job.finish();
			});
			
			return;
		} // log_archive_path
		
		// archive to storage (i.e. S3, etc.)
		var arch_conf = this.config.get('log_archive_storage');
		if (!arch_conf || !arch_conf.enabled) return;
		
		var exp_date = 0;
		if (arch_conf.expiration) {
			exp_date = Tools.timeNow() + Tools.getSecondsFromText( arch_conf.expiration );
		}
		
		var job = this.startInternalJob({ title: "Archiving logs to storage", type: 'logs' });
		this.logMaint(4, "Archiving logs: " + src_spec + " to: " + arch_conf.key_template, arch_conf);
		
		// generate time label from previous day, so just subtracting 30 minutes to be safe
		var epoch = Tools.timeNow(true) - 1800;
		
		// fill date/time placeholders
		var dargs = Tools.getDateArgs( epoch );
		
		glob(src_spec, {}, function (err, files) {
			if (err) self.logError('fs', "Failed to glob for logs: " + err);
			
			// got files
			if (files && files.length) {
				var file_idx = 0;
				
				async.eachSeries( files, function(src_file, callback) {
					// foreach file
					job.update( { progress: file_idx / files.length } );
					file_idx++;
					
					// add filename to args
					dargs.filename = Path.basename(src_file).replace(/\.\w+$/, '');
					
					// construct final storage key
					var storage_key = Tools.sub( arch_conf.key_template, dargs );
					self.logMaint(5, "Archiving log: " + src_file + " to: " + storage_key);
					
					// rename local log first
					var src_temp_file = src_file + '.' + Tools.generateShortID() + '.tmp';
					
					fs.rename(src_file, src_temp_file, function(err) {
						if (err) {
							return callback( new Error("Failed to rename: " + src_file + " to: " + src_temp_file + ": " + err) );
						}
						
						if (storage_key.match(/\.gz$/i)) {
							// gzip the log archive
							var gzip = zlib.createGzip();
							var inp = fs.createReadStream( src_temp_file );
							var outp = fs.createWriteStream( src_temp_file + '.gz' );
							
							inp.pipe(gzip).pipe(outp).on( 'finish', function() {
								// compression complete, delete first temp file in background
								fs.unlink( src_temp_file, function(err) {
									self.logError('maint', "Failed to delete temp file: " + src_temp_file + ": " + err);
								} );
								
								self.storage.putStream( storage_key, fs.createReadStream(src_temp_file + '.gz'), function(err) {
									// all done, delete gz temp file in background
									fs.unlink( src_temp_file + '.gz', function() {
										self.logError('maint', "Failed to delete temp file: " + src_temp_file + ".gz: " + err);
									} );
									
									if (err) return callback(err);
									if (exp_date) self.storage.expire( storage_key, exp_date );
									callback();
								}); // putStream
							} ); // pipes
						} // gzip
						else {
							// straight copy (no compress)
							var inp = fs.createReadStream( src_temp_file );
							
							self.storage.putStream( storage_key, inp, function(err) {
								// all done, delete temp file
								fs.unlink( src_temp_file, function(ul_err) {
									if (ul_err) self.logError('maint', "Failed to delete temp file: " + src_temp_file + ": " + ul_err);
									if (err) return callback(err);
									if (exp_date) self.storage.expire( storage_key, exp_date );
									callback();
								} );
							}); // putStream
						} // copy
					} ); // fs.rename
				}, 
				function(err) {
					if (err) self.logError('maint', "Failed to archive logs: " + err);
					else self.logMaint(4, "Log archival complete");
					job.finish();
				}); // eachSeries
			} // got files
			else {
				self.logMaint(9, "Log Archive: No log files found matching: " + src_spec);
				job.finish();
			}
		} ); // glob
	}
	
	startInternalJob(opts) {
		// start tracking new internal job
		var self = this;
		if (!opts.title) throw new Error("Internal jobs require a title.");
		if (!opts.type) throw new Error("Internal jobs require a type.");
		
		opts.id = opts.id || Tools.generateShortID('i');
		opts.started = Tools.timeNow();
		opts.progress = opts.progress || 0;
		
		this.logJob(5, "Starting new internal job: " + opts.id, opts);
		this.internalJobs[opts.id] = opts;
		
		// convenience methods
		opts.update = function(updates) { self.updateInternalJob(opts.id, updates); };
		opts.finish = function() { return self.finishInternalJob(opts.id); };
		
		// notify all users that internal jobs changed (UI hint to do heavy table redraw)
		this.doUserBroadcastAll( 'status', { 
			epoch: Tools.timeNow(),
			internalJobs: this.getInternalJobs(),
			internalJobsChanged: true
		} );
		
		return opts;
	}
	
	updateInternalJob(id, updates) {
		// update internal job
		if (!this.internalJobs[id]) return; // sanity
		if (updates.progress) updates.progress = Tools.clamp( updates.progress, 0, 1 );
		Tools.mergeHashInto( this.internalJobs[id], updates );
	}
	
	finishInternalJob(id) {
		// complete internal job, delete from tracking
		var self = this;
		if ((typeof(id) == 'object') && id.id) id = id.id;
		
		var job = this.internalJobs[id];
		if (!job) {
			this.logError('internal', "Internal job not found: " + id);
			return;
		}
		
		job.complete = true;
		job.completed = Tools.timeNow();
		job.elapsed = Tools.shortFloat( job.completed - job.started );
		
		delete job.progress;
		delete job.update;
		delete job.finish;
		
		this.logJob(5, "Finishing internal job: " + id, job);
		delete this.internalJobs[id];
		
		// notify all users that internal jobs changed (UI hint to do heavy table redraw)
		this.doUserBroadcastAll( 'status', { 
			epoch: Tools.timeNow(),
			internalJobs: this.getInternalJobs(),
			internalJobsChanged: true
		} );
		
		if (job.username && !job.quiet) {
			// tell user their job finished
			this.doUserBroadcast(job.username, 'notify', {
				type: 'info',
				message: "Job completed: " + job.title
			});
		}
		
		// trigger a refresh on anyone sitting on the system page
		this.doPageBroadcast( 'System', 'internal_job_completed', { id } );
		
		// log activity unless quiet
		if (!job.quiet) {
			this.logTransaction('internal_job', job.title, { job: job, username: job.username || '' });
		}
		
		// optionally send email
		if (job.email && job.details) {
			var email_args = {
				job: job,
				hostname: os.hostname(),
				display: {
					started: (new Date(job.started * 1000)).toString(),
					completed: (new Date(job.completed * 1000)).toString(),
					elapsed: Tools.getTextFromSeconds(job.elapsed, false, false),
				}
			};
			
			// send it
			this.sendFancyMail( 'internal_job', email_args, function(err, body, log) {
				if (err) self.logError('mail', "Failed to send e-mail: " + job.email + ": " + err, { body } );
				else self.logJob(7, "Email sent successfully to: " + job.email, { body } );
			});
		} // send email
		
		return job;
	}
	
	getInternalJobs() {
		// get all internal jobs, for websocket updates
		return this.internalJobs;
	}
	
	findInternalJobs(criteria) {
		// find internal jobs matching criteria -- return array
		return Tools.findObjects( Object.values(this.internalJobs), criteria );
	}
	
	waitForInternalJobs(callback) {
		// wait for all internal jobs to finish before proceeding
		var self = this;
		var num_jobs = Tools.numKeys(this.internalJobs);
		
		if (num_jobs) {
			this.logJob(3, "Waiting for " + num_jobs + " internal jobs to complete", Object.keys(this.internalJobs));
			
			async.whilst(
				function () {
					return (Tools.numKeys(self.internalJobs) > 0);
				},
				function (callback) {
					setTimeout( function() { callback(); }, 250 );
				},
				function() {
					// all jobs gone
					self.logJob(9, "All internal jobs completed.");
					callback();
				}
			); // whilst
		}
		else callback();
	}
	
	dbSearchUpdate(opts) {
		// perform async background database bulk update, returning receipt to restart or abort
		// NOTE: DB records MUST have an `id` property for this to work!
		// opts: { title, index, query, iterator, limit?, callback? }
		var self = this;
		
		opts.id = opts.id || Tools.generateShortID('db');
		opts.offset = opts.offset || 0;
		opts.limit = opts.limit || 100;
		opts.sort_by = opts.sort_by || '_id';
		opts.sort_dir = opts.sort_dir || 1;
		opts.done = false;
		opts.sleep = opts.sleep || 1;
		opts.threads = opts.threads || 1;
		opts.stats = {
			pages: 0,
			count: opts.offset,
			updated: 0,
			total: 0
		};
		opts.icount = 0;
		opts.quiet = opts.quiet || false;
		
		if (!opts.index || !opts.query || !opts.iterator || !opts.title) {
			var err = new Error("Missing required parameters to run bulk search/update.");
			this.logError('db', err.message, opts);
			if (opts.callback) opts.callback(err);
			return;
		}
		
		var params = {
			// for activity log
			index: opts.index,
			query: opts.query,
			limit: opts.limit,
			sort_by: opts.sort_by,
			sort_dir: opts.sort_dir,
			sleep: opts.sleep,
			threads: opts.threads
		};
		
		this.unbase.logDebug(5, "Starting bulk search/update operation", { id: opts.id, index: opts.index, query: opts.query });
		this.startInternalJob( { id: opts.id, title: opts.title, username: opts.username || null, stats: opts.stats, params, type: 'db', quiet: opts.quiet } );
		
		// search using chunk loop
		async.whilst(
			function() { return !opts.done; },
			function(callback) {
				// check for server shutdown
				if (self.server.shut) return callback("SHUTDOWN");
				
				// perform search for current chunk
				self.unbase.logDebug(9, "Searching chunk for bulk update", { id: opts.id, stats: opts.stats });
				opts.stats.pages++;
				
				self.unbase.search( opts.index, opts.query, opts, function(err, data) {
					if (err) {
						// abort right away for search error
						opts.done = true;
						return callback(err);
					}
					if (!opts.stats.total) {
						self.unbase.logDebug(9, "Total bulk records found: " + data.total, { id: opts.id, stats: opts.stats });
						opts.stats.total = data.total;
					}
					
					// process all records in chunk, in series
					async.eachLimit( data.records, opts.threads, 
						function(record, callback) {
							// check for server shutdown
							if (self.server.shut) return callback("SHUTDOWN");
							
							// check for user abort (don't raise error)
							if (opts.done) return process.nextTick(callback);
							
							// fire user iterator function
							opts.iterator( record, function(err, need_update) {
								if (err) return callback(err);
								opts.stats.count++;
								opts.icount++; // iterator count within chunk
								
								self.updateInternalJob(opts.id, { progress: opts.stats.count / (opts.stats.total || 1) } );
								
								if (!need_update) return process.nextTick(callback);
								else opts.stats.updated++;
								
								// update record (using insert because its faster, and we have the full record)
								self.unbase.insert( opts.index, record.id, record, function(err) {
									setTimeout( function() { callback(err); }, opts.sleep );
								} );
							} ); // iterator
						},
						function(err) {
							if (err) {
								opts.done = true;
								return callback(err);
							}
							if (opts.done) {
								// user requested abort
								self.unbase.logDebug(6, "Requested abort of bulk search/update", { id: opts.id, stats: opts.stats });
								return callback();
							}
							if (opts.restart) {
								// user requested we start over at the beginning
								self.unbase.logDebug(6, "Requested restart of bulk search/update", { id: opts.id, stats: opts.stats });
								opts.offset = 0;
								opts.icount = 0;
								opts.stats.pages = 0;
								opts.stats.count = 0;
								opts.stats.updated = 0;
								opts.stats.total = 0;
								delete opts.restart;
								return callback();
							}
							if ((data.records.length < opts.limit) || (opts.offset + opts.limit >= data.total)) {
								// reached natural end of records
								opts.done = true;
								return callback();
							}
							
							// advance to next chunk
							opts.offset += opts.limit;
							opts.icount = 0;
							setTimeout( function() { callback(); }, opts.sleep );
						}
					); // async.eachSeries
				} ); // unbase.search
			},
			function(err) {
				// job complete
				self.finishInternalJob( opts.id );
				
				if (err) {
					self.logError('db', "Error performing bulk search/update: " + err, { id: opts.id, stats: opts.stats });
					if (opts.callback) opts.callback(err);
					return;
				}
				
				// extremely rare race condition, restart request COULD end up here
				if (opts.restart) {
					self.unbase.logDebug(6, "Requested LATE restart of bulk search/update", { id: opts.id });
					delete opts.restart;
					return self.dbSearchUpdate(opts);
				}
				
				self.unbase.logDebug(5, "Bulk search/update complete", { id: opts.id, stats: opts.stats });
				if (opts.callback) opts.callback();
			}
		); // async.whilst
		
		return opts;
	}
	
	dbSearchDelete(opts) {
		// perform async background database bulk delete, returning receipt to abort
		// NOTE: DB records MUST have an `id` property for this to work!
		// opts: { title, index, query, limit?, max?, iterator?, callback? }
		var self = this;
		
		opts.id = opts.id || Tools.generateShortID('db');
		opts.offset = 0;
		opts.limit = opts.limit || 100;
		opts.sort_by = '_id';
		opts.sort_dir = 1;
		opts.ids = true; // return ids only
		opts.done = false;
		opts.sleep = opts.sleep || 1;
		opts.stats = {
			pages: 0,
			count: 0,
			total: 0,
			
			// used by custom iterators:
			keys: 0,
			lists: 0
		};
		
		if (!opts.index || !opts.query || !opts.title) {
			var err = new Error("Missing required parameters to run bulk search/delete.");
			this.logError('db', err.message, opts);
			if (opts.callback) opts.callback(err);
			return;
		}
		
		// special behavior for specific indexes (e.g. jobs)
		var iter_func = 'dbSearchDelete_' + opts.index;
		if (this[iter_func]) {
			opts.iterator = this[iter_func].bind(this);
			opts.ids = false; // full load mode
		}
		
		var params = {
			// for activity log
			index: opts.index,
			query: opts.query,
			limit: opts.limit,
			sort_by: opts.sort_by,
			sort_dir: opts.sort_dir,
			sleep: opts.sleep
		};
		
		this.unbase.logDebug(5, "Starting bulk search/delete operation", { id: opts.id, index: opts.index, query: opts.query });
		this.startInternalJob( { id: opts.id, title: opts.title, username: opts.username || null, stats: opts.stats, params, type: 'db' } );
		
		// search using chunk loop
		async.whilst(
			function() { return !opts.done; },
			function(callback) {
				// check for server shutdown
				if (self.server.shut) return callback("SHUTDOWN");
				
				// perform search for current chunk
				self.unbase.logDebug(9, "Searching chunk for bulk delete", { id: opts.id, stats: opts.stats });
				opts.stats.pages++;
				
				self.unbase.search( opts.index, opts.query, opts, function(err, data) {
					if (err) {
						// abort right away for search error
						opts.done = true;
						return callback(err);
					}
					if (!opts.stats.total) {
						self.unbase.logDebug(9, "Total bulk records found: " + data.total, { id: opts.id });
						opts.stats.total = data.total;
					}
					
					// process all records in chunk, in series
					async.eachSeries( data.records,
						function(record, callback) {
							// check for server shutdown
							if (self.server.shut) return callback("SHUTDOWN");
							
							// delete record
							var finish = function() {
								var id = (typeof(record) == 'object') ? record.id : record;
								
								self.unbase.delete( opts.index, id, function(err) {
									if (err) return callback(err);
									opts.stats.count++;
									self.updateInternalJob(opts.id, { progress: opts.stats.count / (opts.max || opts.stats.total || 1) } );
									setTimeout( function() { callback(); }, opts.sleep );
								} ); // unbase.delete
							}; // finish
							
							if (opts.iterator) opts.iterator(record, opts.stats, finish);
							else finish();
						},
						function(err) {
							if (err) {
								opts.done = true;
								return callback(err);
							}
							if (opts.done) {
								// user requested abort
								self.unbase.logDebug(6, "Requested abort of bulk search/delete", { id: opts.id, stats: opts.stats });
								return callback();
							}
							if ((data.records.length < opts.limit) || (opts.offset + opts.limit >= data.total)) {
								// reached natural end of records
								self.unbase.logDebug(6, "Reached natural end of records", { id: opts.id, stats: opts.stats });
								opts.done = true;
								return callback();
							}
							if (opts.max && (opts.stats.count >= opts.max)) {
								// reached user-defined max deletes
								self.unbase.logDebug(6, "Reached max delete limit", { id: opts.id, stats: opts.stats });
								opts.done = true;
								return callback();
							}
							
							// advance to next chunk
							setTimeout( function() { callback(); }, opts.sleep );
						}
					); // async.eachSeries
				} ); // unbase.search
			},
			function(err) {
				// job complete
				self.finishInternalJob( opts.id );
				
				if (err) {
					self.logError('db', "Error performing bulk search/delete: " + err, { id: opts.id, stats: opts.stats });
					if (opts.callback) opts.callback(err);
					return;
				}
				
				self.unbase.logDebug(5, "Bulk search/delete complete", { id: opts.id, stats: opts.stats });
				if (opts.callback) opts.callback(null, opts.stats);
			}
		); // async.whilst
		
		return opts;
	}
	
	dbSearchDelete_jobs(job, stats, callback) {
		// special iterator handler for jobs db index
		// delete job log and files
		var self = this;
		var to_delete = [];
		
		// rollback affected stats
		this.rollbackJobStats(job);
		
		if (job.files && job.files.length) {
			to_delete = job.files.map( function(file) { return file.path; } );
		}
		
		if (job.log_file_size || !job.output) {
			to_delete.push( 'logs/jobs/' + job.id + '/log.txt.gz' );
		}
		
		if (!to_delete.length) return callback();
		
		// we're not using storage.deleteMulti() here because that will bail out on the first error
		// in this case we want to delete ALL files regardless of errors, and only log actual errors
		async.eachLimit(to_delete, this.storage.concurrency, 
			function(key, callback) {
				// iterator for each key
				self.storage.delete(key, function(err) {
					if (err && (err.code != 'NoSuchKey')) {
						// only log error if other than 404
						self.logError('job', "Failed to delete job file: " + key + ": " + err);
					}
					if (!err) stats.keys++;
					callback();
				} );
			}, 
			callback
		); // async.eachLimit
	}
	
	dbSearchDelete_servers(server, stats, callback) {
		// special iterator handler for servers db index
		// delete timeline data
		var self = this;
		
		// construct list paths for each monitor zoom level
		async.eachSeries( self.systems,
			function(sys, callback) {
				// delete each timeline list
				var timeline_key = 'timeline/' + server.id + '/' + sys.id;
				self.storage.listDelete( timeline_key, true, function(err) {
					if (err && (err.code != 'NoSuchKey')) {
						// only log error if other than 404
						self.logError('job', "Failed to delete server monitoring data: " + timeline_key + ": " + err);
					}
					if (!err) stats.lists++;
					callback();
				} );
			},
			function() {
				// also delete host data (last monitoring update)
				var host_key = 'hosts/' + server.id + '/data';
				self.storage.delete( host_key, function(err) {
					if (err && (err.code != 'NoSuchKey')) {
						// only log error if other than 404
						self.logError('job', "Failed to delete server monitoring data: " + host_key + ": " + err);
					}
					callback();
				} );
			}
		);
	}
	
	maintShutdown() {
		// write stats file to disk (sync is fine here)
		if (!this.master) return;
		
		try { fs.writeFileSync( this.stats.file, JSON.stringify(this.stats) ); }
		catch (err) { this.logError('fs', "Failed to write stats file: " + err); }
	}
	
}; // class Maintenance

module.exports = Maintenance;
