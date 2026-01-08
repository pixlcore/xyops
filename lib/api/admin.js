// xyOps API Layer - Admin
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const readline = require('readline');
const Path = require('path');
const os = require('os');
const zlib = require('zlib');
const async = require('async');
const Tools = require("pixl-tools");

class Admin {
	
	api_get_servers(args, callback) {
		// get all servers
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			callback({
				code: 0,
				servers: self.servers,
				masters: self.getMasterPeerData()
			});
		} ); // loaded session
	}
	
	api_get_global_state(args, callback) {
		// get state data
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			callback({ code: 0, state: self.state });
		} ); // loaded session
	}
	
	api_update_global_state(args, callback) {
		// update master state, params can be dot.props
		var self = this;
		var params = args.params;
		var MATCH_BAD_KEY_WORD = /\b(constructor|__defineGetter__|__defineSetter__|hasOwnProperty|__lookupGetter__|__lookupSetter__|isPrototypeOf|propertyIsEnumerable|toString|valueOf|__proto__|toLocaleString|0)\b/;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			// disallow naughty state keys
			for (var key in params) {
				if (key.match(MATCH_BAD_KEY_WORD)) {
					return self.doError('api', "Naughty key detected.", callback);
				}
			}
			
			// update using dot.props
			// putState also marks it as dirty
			for (var key in params) {
				self.putState(key, params[key]);
				self.logTransaction('state_update', key, self.getClientInfo(args, { key, value: params[key] }));
			}
			
			callback({ code: 0 });
		} ); // loaded session
	}
	
	api_get_internal_jobs(args, callback) {
		// return all internal jobs that are currently running
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			var jobs = Object.values(self.internalJobs);
			
			callback({ code: 0, rows: jobs, list: { length: jobs.length } });
		} ); // loaded session
	}
	
	api_test_internal_job(args, callback) {
		// start background job to do nothing for a bit
		var self = this;
		var params = args.params;
		var duration = params.duration || 60;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			callback({ code: 0 });
			
			var job = self.startInternalJob({ title: "Test job that does nothing", username: user.username || user.id, type: 'maint' });
			var counter = 0;
			var timer = setInterval( function() {
				counter++;
				job.update({ progress: counter / duration });
				
				if (counter >= duration) {
					job.finish();
					clearTimeout(timer);
				}
			}, 1000 );
		} ); // loaded session
	}
	
	api_bulk_search_delete_jobs(args, callback) {
		// start background job to delete jobs in bulk
		// params: { query }
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_jobs', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.dbSearchDelete({
				index: 'jobs',
				query: params.query || '*',
				title: "Custom bulk job deletion",
				username: user.username
			});
			
			callback({ code: 0 });
		} ); // loaded session
	}
	
	api_bulk_search_delete_tickets(args, callback) {
		// start background job to delete tickets in bulk
		// params: { query }
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_tickets', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.dbSearchDelete({
				index: 'tickets',
				query: params.query || '*',
				title: "Custom bulk ticket deletion",
				username: user.username
			});
			
			callback({ code: 0 });
		} ); // loaded session
	}
	
	api_bulk_search_delete(args, callback) {
		// start background job to delete anything in bulk
		// Note: currently unused
		// params: { index, query }
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			index: /^\w+$/,
			query: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			var job = self.dbSearchDelete({
				index: params.index,
				query: params.query || '*',
				title: "Custom bulk deletion (" + params.index + ")",
				username: user.username
			});
			
			callback({ code: 0, id: job.id });
		} ); // loaded session
	}
	
	api_admin_run_maintenance(args, callback) {
		// start daily maintenance jobs manually
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			var job = self.startInternalJob({ title: "Daily maintenance manual run", type: 'maint', username: user.username || user.id });
			
			callback({ code: 0, id: job.id });
			
			self.runMaintenance( function() {
				job.finish();
			} );
		} ); // loaded session
	}
	
	api_admin_run_optimization(args, callback) {
		// run db optimization (vacuum) manually
		var self = this;
		var params = args.params;
		var sqlite = this.storage.config.get('SQLite');
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			var db = null;
			if ((self.storage.engine.__name == 'SQLite') && self.storage.engine.db) {
				db = self.storage.engine.db;
			}
			else if (self.storage.engine.docEngine && (self.storage.engine.docEngine.__name == 'SQLite') && self.storage.engine.docEngine.db) {
				db = self.storage.engine.docEngine.db;
			}
			if (!db || !sqlite) {
				return self.doError('admin', "The current storage configuration does not require optimization.", callback);
			}
			
			var db_file = Path.join( sqlite.base_dir, sqlite.filename );
			if (!fs.existsSync(db_file)) {
				return self.doError('admin', "No database file found for optimization.", callback);
			}
			
			var job = self.startInternalJob({ 
				title: "Database integrity and optimization", 
				username: user.username || user.id, 
				email: user.email || '', // for report
				type: 'maint' 
			});
			
			callback({ code: 0, id: job.id });
			
			job.details = '';
			job.details += "### Database Integrity Check\n";
			self.logDebug(7, "Running DB integrity check");
			
			db.get('PRAGMA integrity_check;', function(err, row) {
				if (!err && (!row || !row.integrity_check)) err = "No response from integrity check.";
				if (err) {
					self.logError('db', "SQLite Error: " + err);
					job.details += "\n**SQLite Error:** " + err + "\n";
					job.finish();
					return;
				}
				
				self.logDebug(7, "DB integrity check complete", row);
				var elapsed = Tools.shortFloat( Tools.timeNow() - job.started );
				
				if (row.integrity_check.trim().toLowerCase() == 'ok') {
					job.details += `\nIntegrity check 100% complete in ${elapsed} sec.  No issues found.\n`;
				}
				else {
					job.details += "\n**Integrity Check Failed:**\n\n```text\n" + row.integrity_check.trim() + "\n```\n";
					job.details += "\nPlease restore database from a backup, or perform an export / delete / import.\n";
					job.finish();
					return;
				}
				
				job.details += "\n### Database Compaction\n";
				self.logDebug(7, "Running DB VACUUM now");
				var old_size = fs.statSync(db_file).size;
				var vacuum_start = Tools.timeNow();
				
				db.run('VACUUM;', function(err) {
					if (err) {
						self.logError('db', "SQLite Error: " + err);
						job.details += "\n**SQLite Error:** " + err + "\n";
						job.finish();
						return;
					}
					
					var new_size = fs.statSync(db_file).size;
					var reclaimed = Tools.getTextFromBytes( Math.max(0, old_size - new_size) );
					var elapsed = Tools.shortFloat( Tools.timeNow() - vacuum_start );
					
					self.logDebug(7, "DB VACUUM complete");
					job.details += `\nDatabase compaction completed in ${elapsed} sec.  Reclaimed ${reclaimed}.\n`;
					job.finish();
				}); // vacuum
			}); // integrity_check
		} ); // loaded session
	}
	
	api_admin_reset_daily_stats(args, callback) {
		// reset daily stats
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.maintReset();
			self.doUserBroadcastAll( 'update', { stats: self.stats } );
			
			callback({ code: 0 });
		} ); // loaded session
	}
	
	api_get_transfer_token(args, callback) {
		// generate time-based upload/download token (good for ~1 minute, single use)
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			var token = Tools.generateUniqueID();
			
			self.transferTokens[token] = {
				id: token,
				session_id: session.id,
				params: params,
				expires: Tools.timeNow(true) + 60
			};
			
			callback({ code: 0, token: token });	
		} ); // loaded session
	}
	
	api_admin_stats(args, callback) {
		// generate more expensive admin stats for UI status page
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			var stats = {
				version: self.server.__version,
				node: {
					version: process.version
				},
				db: {
					sqlite: 0,
					records: {}
				},
				unbase: self.unbase.getStats(),
				cache: self.storage.engine.cache ? self.storage.engine.cache.getStats() : null,
				sockets: []
			};
			
			// support hybrid cache
			if (!stats.cache && self.storage.engine.docEngine && self.storage.engine.docEngine.cache) {
				stats.cache = self.storage.engine.docEngine.cache.getStats();
			}
			
			// add websocket info
			for (var id in self.sockets) {
				var socket = self.sockets[id];
				stats.sockets.push({
					id: id,
					ip: socket.ip,
					type: socket.type,
					auth: !!socket.auth,
					username: socket.username || '',
					loc: socket.loc || '',
					server: socket.server ? socket.server.id : '',
					timeStart: socket.timeStart,
					ping: socket.metadata.ping_ms || 0
				});
			}
			
			// sqlite db file stats
			var sqlite = self.storage.config.get('SQLite');
			if (sqlite) {
				var db_file = Path.join( sqlite.base_dir, sqlite.filename );
				stats.db.sqlite += fs.existsSync(db_file) ? Math.floor(fs.statSync(db_file).size) : 0;
				
				var wal_file = db_file + '-wal';
				stats.db.sqlite += fs.existsSync(wal_file) ? Math.floor(fs.statSync(wal_file).size) : 0;
			}
			
			async.eachSeries( Object.keys(self.unbase.indexes),
				function(index_id, callback) {
					self.storage.hashGetInfo( 'unbase/index/' + index_id + '/_id', function(err, hash) {
						stats.db.records[index_id] = hash ? hash.length : 0;
						callback();
					});
				},
				function() {
					// all done!
					callback({ code: 0, stats: stats });
				}
			); // async.eachSeries
			
		}); // loadSession
	}
	
	api_admin_rotate_secret_key(args, callback) {
		// rotate secret key
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			password: /.+/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			// user is required to re-verify their password for this
			var result = self.usermgr.comparePasswords(params.password, user.password, user.salt);
			if (!result) return self.doError('admin', "Incorrect password.", callback);
			
			// only one maint job allowed at a time
			if (self.findInternalJobs({ type: 'maint' }).length) {
				return self.doError('admin', "Another maintenance job is already running.", callback);
			}
			
			// sanity check
			if (process.env['XYOPS_secret_key']) {
				return self.doError('admin', "Cannot rotate secret key when specified via environment variable.", callback);
			}
			
			var job = self.startInternalJob({ 
				title: "Rotate secret key", 
				username: user.username || user.id, 
				email: user.email || '', // for report
				type: 'maint' 
			});
			
			var report = {
				stats: {
					servers: 0,
					masters: 0,
					secrets: 0
				},
				warnings: [],
				errors: [],
				
				logError(code, msg, data) {
					if (this.errors.length < 100) this.errors.push(msg);
					else if (this.errors.length == 100) this.errors.push("Too many errors to show in report.  Please see the log for more details.");
					self.logError(code, msg, data);
				}
			};
			var stats = report.stats;
			
			// send API response to user now, so we can continue processing in background
			callback({ code: 0, id: job.id });
			callback = null; // sanity
			
			// generate new secret key server-side
			var old_secret_key = self.config.get('secret_key');
			var new_secret_key = Tools.generateUniqueBase64();
			// FUTURE: Once we decommission Node v16, use: Buffer.from( crypto.getRandomValues(new Uint32Array(32)) ).toString('base64')
			
			async.series([
				function(callback) {
					// disable scheduler if enabled
					var state_key = 'scheduler.enabled';
					if (self.getState(state_key) == true) {
						self.putState(state_key, false);
						self.logTransaction('state_update', state_key, self.getClientInfo(args, { key: state_key, value: false }));
						report.warnings.push("The job scheduler was automatically disabled for the key rotation.  You will have to manually re-enable it.");
					}
					
					// flush all queued jobs
					var num_flushed = 0;
					self.findActiveJobs({ state: 'queued' }).forEach( function(job) {
						self.logDebug(6, "Silently deleting queued job for key rotation: " + job.id);
						delete self.activeJobs[ job.id ];
						num_flushed++;
					});
					if (num_flushed) report.warnings.push( `Flushed ${num_flushed} queued jobs in prep for key rotation.` );
					
					// abort all running jobs
					var num_aborted = 0;
					Object.values(self.activeJobs).forEach( function(job) {
						self.logDebug(6, "Aborting job for key rotation: " + job.id);
						self.abortJob(job, "Secret key rotation");
						num_aborted++;
					} );
					if (num_aborted) report.warnings.push( `Aborted ${num_aborted} active jobs in prep for key rotation.` );
					
					// wait for all jobs to complete
					async.whilst(
						function () {
							return (Tools.numKeys(self.activeJobs) > 0);
						},
						function (callback) {
							setTimeout( function() { callback(); }, 250 );
						},
						function() {
							// all jobs gone
							self.logDebug(9, "All jobs completed.");
							callback();
						}
					); // whilst
				},
				function(callback) {
					// re-encrypt secrets with new key
					async.eachSeries( self.secrets,
						function(secret, callback) {
							self.logDebug(6, "Re-encrypting secret for key rotation: " + secret.id + ": " + secret.title);
							
							// get secret data from cache
							var record = self.secretCache[secret.id];
							if (!record) return callback( new Error("Secret not found in cache: " + secret.id) );
							
							// decrypt using old key
							var fields = null;
							try {
								fields = self.decryptSecret( record, old_secret_key, secret.id );
							}
							catch (err) {
								return callback( new Error("Failed to decrypt secret: " + err) );
							}
							
							// encrypt using new key
							record = self.encryptSecret( fields, new_secret_key, secret.id );
							
							// write back to storage
							stats.secrets++;
							self.secretCache[secret.id] = record;
							self.storage.put( 'secrets/' + secret.id, record, callback );
						},
						callback
					); // eachSeries
				},
				function(callback) {
					// re-auth servers (dist out new tokens)
					Object.values(self.servers).forEach( function(server) {
						self.logDebug(6, "Re-authenticating server for key rotation: " + server.id + ": " + server.hostname);
						var auth_token = Tools.digestHex( server.id + new_secret_key, 'sha256' );
						self.doServerBroadcast(server.id, 'updateConfig', { auth_token });
						stats.servers++;
					} );
					
					process.nextTick( callback );
				},
				function(callback) {
					// update config (includes all master peers)
					stats.masters += self.peers.length;
					self.updateConfigOverrides( { secret_key: new_secret_key }, callback );
				}
			],
			function(err) {
				// all done, or errored out
				if (err) report.logError('import', "Failed to rotate secret key: " + err);
				
				// compose job report (details) for email
				job.details = '';
				job.details += "### Secret Key Rotation " + (err ? 'Failed' : 'Completed') + "\n";
				
				job.details += "\nThe key rotation completed with " + Tools.commify(report.errors.length) + " " + Tools.pluralize('error', report.errors.length);
				job.details += " and " + Tools.commify(report.warnings.length) + " " + Tools.pluralize('warning', report.warnings.length) + ".";
				job.details += " See below for details.\n";
				
				// errors
				job.details += "\n#### Errors\n\n";
				if (report.errors.length) {
					job.details += report.errors.map( function(msg) { return '- ' + msg; } ).join("\n") + "\n";
				}
				else job.details += "None.\n";
				
				// warnings
				job.details += "\n#### Warnings\n\n";
				if (report.warnings.length) {
					job.details += report.warnings.map( function(msg) { return '- ' + msg; } ).join("\n") + "\n";
				}
				else job.details += "None.\n";
				
				// summary
				job.details += "\n#### Rotation Details\n\n";
				job.details += "- **Secrets re-encrypted:** " + Tools.commify(stats.secrets) + "\n";
				job.details += "- **Servers re-authenticated:** " + Tools.commify(stats.servers) + "\n";
				job.details += "- **Conductor peers updated:** " + Tools.commify(stats.masters) + "\n";
				
				job.finish();
			}); // async.series
		}); // loadSession
	}
	
	api_admin_import_data(args, callback) {
		// import arbitrary data from a NDJSON file into storage or unbase
		// line format: { key: KEY, value: {...} } OR { index: INDEX, id: ID, record: {...} } OR { cmd: CMD, args: [...] }
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		var file_id = Tools.firstKey(args.files);
		if (!file_id) return this.doError('admin', "No file data found for import", callback);
		
		var file = args.files[file_id];
		var userCallback = callback;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			// only one import job allowed at a time
			if (self.findInternalJobs({ type: 'maint' }).length) {
				return self.doError('admin', "Another maintenance job is already running.", callback);
			}
			
			var job = self.startInternalJob({ 
				title: "Custom bulk data import", 
				username: user.username || user.id, 
				email: user.email || '', // for report
				type: 'maint' 
			});
			
			var temp_file = Path.join( os.tmpdir(), 'xyops-import-temp-' + Tools.generateShortID() + '.txt' );
			var num_lines = 0;
			var line_idx = 0;
			
			var report = {
				stats: {
					lines: 0,
					records: 0,
					keys: 0,
					commands: 0
				},
				warnings: [],
				errors: [],
				
				logError(code, msg, data) {
					if (this.errors.length < 100) this.errors.push(msg);
					else if (this.errors.length == 100) this.errors.push("Too many errors to show in report.  Please see the log for more details.");
					self.logError(code, msg, data);
				}
			};
			var stats = report.stats;
			
			async.series([
				function(callback) {
					// first gunzip/move uploaded file so it doesn't get deleted during processing
					if ((file.name && file.name.match(/\.gz$/i)) || (file.type && file.type.match(/gzip/i))) {
						// decompress uploaded file to temp file
						const input = fs.createReadStream(file.path);
						const output = fs.createWriteStream(temp_file);
						const gunzip = zlib.createGunzip();
						
						input.on('error', function(err) { callback(err); } );
						gunzip.on('error', function(err) { callback(err); } );
						output.on('error', function(err) { callback(err); } );
						
						input.pipe(gunzip).pipe(output).on('finish', function() { callback(); } );
					}
					else {
						// no gzip, just move file
						fs.rename( file.path, temp_file, callback );
					}
				},
				function(callback) {
					// convert cronicle data here
					if (params.format == 'cronicle') self.convertCronicleDataFile({ temp_file, report, job, user }, callback);
					else process.nextTick(callback);
				},
				function(callback) {
					// pre-count the file lines so we can report progress
					var stream = fs.createReadStream(temp_file);
					var rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
					
					rl.on('line', function(line) { if (line.match(/^\s*\{/)) num_lines++; } );
					rl.on('close', function() { callback(); } );
					rl.on('error', function(err) { callback(err); } );
				},
				function(callback) {
					// sanity check
					if (!num_lines) return callback("No valid rows found in file.");
					
					// send API response to user now, so we can continue processing in background
					userCallback({ code: 0, id: job.id });
					userCallback = null; // prevent dupe calls
					
					// disable scheduler if enabled
					var state_key = 'scheduler.enabled';
					if (self.getState(state_key) == true) {
						self.putState(state_key, false);
						self.logTransaction('state_update', state_key, self.getClientInfo(args, { key: state_key, value: false }));
						report.warnings.push("The job scheduler was automatically disabled for the bulk import.  You will have to manually re-enable it.");
					}
					
					// flush all queued jobs
					var num_flushed = 0;
					self.findActiveJobs({ state: 'queued' }).forEach( function(job) {
						self.logDebug(6, "Silently deleting queued job for data import: " + job.id);
						delete self.activeJobs[ job.id ];
						num_flushed++;
					});
					if (num_flushed) report.warnings.push( `Flushed ${num_flushed} queued jobs in prep for data import.` );
					
					// abort all running jobs
					var num_aborted = 0;
					Object.values(self.activeJobs).forEach( function(job) {
						self.logDebug(6, "Aborting job for data import: " + job.id);
						self.abortJob(job, "System data import");
						num_aborted++;
					} );
					if (num_aborted) report.warnings.push( `Aborted ${num_aborted} active jobs in prep for data import.` );
					
					// wait for all jobs to complete
					async.whilst(
						function () {
							return (Tools.numKeys(self.activeJobs) > 0);
						},
						function (callback) {
							setTimeout( function() { callback(); }, 250 );
						},
						function() {
							// all jobs gone
							self.logDebug(9, "All jobs completed.");
							callback();
						}
					); // whilst
				},
				function(callback) {
					// process file
					Tools.fileEachLine( temp_file, { buffer_size: 32768 },
						function(line, callback) {
							if (!line.match(/^\s*\{/)) return callback();
							
							// track progress
							job.update({ progress: line_idx / num_lines });
							line_idx++;
							stats.lines++;
							
							// parse line
							var row = null;
							try { row = JSON.parse( line.trim() ); }
							catch (e) { report.logError('import', "Failed to parse JSON in file import: " + err + " (line #" + line_idx + ")"); }
							if (!row) return callback();
							
							if (row.index && row.id && row.record) {
								// unbase insert
								self.unbase.insert( row.index, row.id, row.record, function(err) {
									if (err) report.logError('import', "Import line #" + line_idx + " failed: Insert: " + err);
									else stats.records++;
									callback();
								} ); // unbase.insert
							}
							else if (row.key && row.value) {
								// storage put, standard json or binary (base64)
								if (self.storage.isBinaryKey(row.key)) row.value = Buffer.from(row.value, 'base64');
								
								self.storage.put( row.key, row.value, function(err) {
									if (err) report.logError('import', "Import line #" + line_idx + " failed: Put: " + err);
									else stats.keys++;
									callback();
								} ); // storage.put
							}
							else if (row.cmd && self.storage[row.cmd] && row.args) {
								// arbitrary storage command, e.g. listDelete
								self.storage[row.cmd].apply( self.storage, row.args.concat( function(err) {
									if (err) report.logError('import', "Import line #" + line_idx + " failed: " + row.cmd + ": " + err);
									else stats.commands++;
									callback();
								} ) );
							}
							else {
								report.logError('import', "Import line #" + line_idx + " failed: Unknown format");
								callback();
							}
						}, 
						callback
					); // fileEachLine
				},
				function(callback) {
					// reload all global lists into memory, as they've probably changed
					async.eachSeries( self.config.getPath('ui.globalMemoryLists'),
						function(key, callback) {
							self.storage.listGet( 'global/' + key, 0, 0, function(err, items) {
								self[key] = items || [];
								callback();
							});
						},
						callback
					); // eachSeries
				}
			], 
			function(err) {
				// all done, or errored out
				if (err) report.logError('import', "Failed to process file: " + err);
				
				// re-compile all monitor and alert expressions
				self.precompileMonitors();
				
				// compose job report (details) for email
				job.details = '';
				job.details += "### Bulk Import " + (err ? 'Failed' : 'Completed') + "\n";
				
				job.details += "\nThe import job completed with " + Tools.commify(report.errors.length) + " " + Tools.pluralize('error', report.errors.length);
				job.details += " and " + Tools.commify(report.warnings.length) + " " + Tools.pluralize('warning', report.warnings.length) + ".";
				job.details += " See below for details.\n";
				
				// errors
				job.details += "\n#### Errors\n\n";
				if (report.errors.length) {
					job.details += report.errors.map( function(msg) { return '- ' + msg; } ).join("\n") + "\n";
				}
				else job.details += "None.\n";
				
				// warnings
				job.details += "\n#### Warnings\n\n";
				if (report.warnings.length) {
					job.details += report.warnings.map( function(msg) { return '- ' + msg; } ).join("\n") + "\n";
				}
				else job.details += "None.\n";
				
				// file.name, file.size, file.type
				job.details += "\n#### File Details\n\n";
				job.details += "- **Filename:** " + file.name + "\n";
				job.details += "- **File Size:** " + Tools.getTextFromBytes(file.size) + "\n";
				job.details += "- **File Type:** " + file.type + "\n";
				job.details += "- **File Format:** " + params.format + "\n";
				
				// summary
				job.details += "\n#### Import Details\n\n";
				job.details += "- **Lines Processed:** " + Tools.commify(stats.lines) + "\n";
				job.details += "- **DB Records Imported:** " + Tools.commify(stats.records) + "\n";
				job.details += "- **Storage Keys Written:** " + Tools.commify(stats.keys) + "\n";
				job.details += "- **Commands Executed:** " + Tools.commify(stats.commands) + "\n";
				
				job.finish();
				
				// cleanup temp file
				fs.unlink( temp_file, function() {} );
				
				if (err) {
					// send error back to user if we are still inside the API call
					if (userCallback) self.doError('admin', "Failed to process file: " + err, userCallback);
					userCallback = null;
					return;
				}
				else {
					self.logDebug(5, "Bulk data import finished", { num_lines });
					
					// re-prep plugins (they may have changed)
					self.prepPlugins();
					
					// massive data update for all connected users
					var targs = {};
					self.beforeUserLogin(targs, function() {
						self.doUserBroadcastAll('update', targs.resp );
					});
				}
			}); // series
		} ); // loaded session
	}
	
	api_admin_export_data(args, callback) {
		// export custom set of data to streamed NDJSON gzip file
		// params: { items: [ { type, key|index, query? } ] }
		// OR: params: { lists: [...], indexes: [...], extras: [...] }
		// OR: params: { lists: 'all', indexes: 'all', extras: 'all' }
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (params.token) {
			// single-use transfer token
			var token = this.transferTokens[params.token];
			if (!token) return this.doError('admin', "Access denied.", callback); // deliberately vague
			
			this.logDebug(7, "Applying single-use transfer token: " + token.id);
			args.request.headers['x-session-id'] = token.session_id;
			Tools.mergeHashInto( params, token.params );
			delete this.transferTokens[params.token];
			delete params.token;
		}
		
		if (!params.items) params.items = [];
		var items = params.items;
		
		if (params.lists && (typeof(params.lists) == 'string') && (params.lists === "all")) {
			params.lists = this.config.getPath('ui.list_list').map( function(item) { return item.id; } );
		}
		if (params.indexes && (typeof(params.indexes) == 'string') && (params.indexes === "all")) {
			params.indexes = this.config.getPath('ui.database_list').map( function(item) { return item.id; } );
		}
		if (params.extras && (typeof(params.extras) == 'string') && (params.extras === "all")) {
			params.extras = this.config.getPath('ui.extra_list').map( function(item) { return item.id; } );
		}
		
		// insure arrays here, could crash with malformed request
		if (params.lists && !Array.isArray(params.lists)) {
			return this.doError('admin', "Invalid request (lists must be an array).", callback);
		}
		if (params.indexes && !Array.isArray(params.indexes)) {
			return this.doError('admin', "Invalid request (indexes must be an array).", callback);
		}
		if (params.extras && !Array.isArray(params.extras)) {
			return this.doError('admin', "Invalid request (extras must be an array).", callback);
		}
		
		(params.lists || []).forEach( function(list) {
			items.push({ type: 'list', key: 'global/' + list });
		} );
		
		(params.indexes || []).forEach( function(db) {
			items.push({ type: 'index', index: db });
		} );
		
		var lists = params.lists || [];
		var extras = params.extras || [];
		
		if (lists.includes('users')) {
			items.push({ type: 'users', avatars: extras.includes('user_avatars') });
		}
		if (extras.includes('job_files') || extras.includes('job_logs')) {
			items.push({ type: 'jobFiles', logs: extras.includes('job_logs'), files: extras.includes('job_files') });
		}
		if (extras.includes('monitor_data')) {
			items.push({ type: 'monitorData' });
		}
		if (extras.includes('stat_data')) {
			items.push({ type: 'list', key: 'global/stats' });
		}
		if (lists.includes('buckets')) {
			// assume user always wants bucket data
			items.push({ type: 'bucketData' });
		}
		if (lists.includes('secrets')) {
			items.push({ type: 'secretData' });
		}
		if (extras.includes('bucket_files')) {
			items.push({ type: 'bucketFiles' });
		}
		if (extras.includes('ticket_files')) {
			items.push({ type: 'ticketFiles' });
		}
		
		delete params.lists;
		delete params.indexes;
		delete params.extras;
		
		if (!params.items || !params.items.length) {
			return this.doError('admin', "No data selected for export.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			var job = self.startInternalJob({ title: "Custom bulk data export", username: user.username || user.id, params, type: 'maint' });
			var filename = 'xyops-data-export-' + Tools.formatDate(Tools.timeNow(), '[yyyy]-[mm]-[dd]') + '-' + Tools.generateShortID() + '.txt.gz';
			
			// start streaming response
			args.response.setHeader( 'Content-Type', 'application/gzip' );
			args.response.setHeader( 'Content-Disposition', 'attachment; filename="' + filename + '"' );
			args.response.writeHead( "200", "OK" );
			
			args.response.on('error', function(err) {
				if (callback) { 
					job.finish();
					self.logError('export', "Data export response error: " + err, params);
					callback(true); 
					callback = null; 
				}
			});
			args.response.on('close', function() {
				if (callback) { 
					job.finish();
					self.logError('export', "Data export connection terminated", params);
					callback(true); 
					callback = null; 
				}
			});
			args.response.on('finish', function() {
				if (callback) { 
					job.finish();
					self.logDebug(6, "Data export finished", params);
					callback(true); 
					callback = null; 
				}
			});
			
			// stream a gzip file into the http response object stream
			var stream = zlib.createGzip();
			stream.pipe(args.response);
			
			// write file header
			stream.write(
				"# xyOps Data Export v1.0\n" + 
				"# Hostname: " + os.hostname() + "\n" + 
				"# Date/Time: " + (new Date()).toString() + "\n" + 
				"# Format: NDJSON\n"
			);
			
			var exportTypes = {};
			
			exportTypes.list = function(item, callback) {
				// export list
				// item: { key }
				self.logDebug(7, "Exporting list: " + item.key, item );
				stream.write( "\n# List: " + item.key + "\n" );
				
				self.storage.get( item.key, function(err, list) {
					if (err) {
						if (err.code == 'NoSuchKey') self.logDebug(7, "List does not exist, skipping: " + item.key);
						else self.logError('export', "Failed to fetch list header: " + item.key + ": " + err);
						return callback();
					}
					
					// make sure export contains instructions to pre-delete list data (not header), for re-import
					stream.write(
						JSON.stringify({ cmd: 'listDelete', args: [item.key, false] }) + "\n" + 
						JSON.stringify({ key: item.key, value: list }) + "\n" 
					);
					
					// now iterate over all the list pages
					var page_idx = list.first_page;
					
					async.whilst(
						function() { return page_idx <= list.last_page; },
						function(callback) {
							// load each page
							var page_key = item.key + '/' + page_idx;
							page_idx++;
							
							self.logDebug(8, "Exporting list page: " + page_key);
							
							self.storage.get(page_key, function(err, page) {
								if (err) {
									self.logError('export', "Failed to fetch list page: " + page_key + ": " + err);
									return callback();
								}
								
								// write page data
								stream.write( JSON.stringify({ key: page_key, value: page }) + "\n", 'utf8', callback );
							} ); // page get
						}, // iterator
						function() {
							self.logDebug(6, "List export complete: " + item.key, item);
							callback();
						}
					); // whilst
				} ); // get
			}; // export list
			
			exportTypes.index = function(item, callback) {
				// export db index, possibly with custom query
				// item: { index, query?, max_rows? }
				if (!item.query) item.query = '*';
				
				var index_config = self.unbase.indexes[item.index];
				if (!index_config) {
					self.logError('export', "Unknown index: " + item.index);
					return callback();
				}
				
				self.logDebug(7, "Exporting DB index: " + item.index + ": " + item.query, item);
				stream.write( "\n# Database Index: " + item.index + " (" + item.query + ")\n" );
				
				// use the low-level indexer API because we want more control
				self.storage.searchRecords( item.query, index_config, function(err, results) {
					if (err) {
						self.logError('export', "Failed to search records: " + item.index + ": " + item.query + ": " + err);
						return callback();
					}
					if (!results) results = {};
					
					// convert hash to array for async iteration
					// sort by newest to oldest (by ID)
					var records = Object.keys(results).sort( function(a, b) { 
						return b.toString().localeCompare(a); 
					} );
					
					if (!records.length) {
						self.logDebug(7, "No records found for export: " + item.index + ": " + item.query);
						return callback();
					}
					
					if (item.max_rows && (records.length > item.max_rows)) {
						records.splice( item.max_rows );
					}
					
					self.logDebug(7, "Exporting " + records.length + " records", item);
					
					async.eachSeries( records,
						function(record_id, callback) {
							// load one record and format as a NDJSON line
							self.unbase.get( item.index, record_id, function(err, record) {
								if (err) {
									self.logError('export', "Failed to load record for export: " + item.index + '/' + record_id);
									return callback();
								}
								
								var chunk = JSON.stringify({ index: item.index, id: record_id, record });
								stream.write( chunk + "\n", 'utf8', callback );
							}); // unbase.get
						},
						function(err) {
							if (err) self.logError('export', "DB index export failed: " + item.index + ": " + err);
							else self.logDebug(6, "DB index export completed: " + item.index);
							callback();
						}
					); // eachSeries
				} ); // searchRecords
			}; // export index
			
			exportTypes.users = function(item, callback) {
				// export all user records
				// item: { avatars? }
				self.logDebug(7, "Exporting all user records");
				stream.write( "\n# User Data:\n" );
				
				self.storage.listEach( 'global/users',
					function(user, idx, callback) {
						var username = user.username;
						var user_path = 'users/' + username.toString().toLowerCase().replace(/\W+/g, '');
						
						self.logDebug(8, "Exporting user: " + username );
						
						self.storage.get( user_path, function(err, user) {
							if (err) {
								// user deleted?
								self.logError('export', "Failed to fetch user: " + user_path + ": " + err );
								return callback();
							}
							
							// grab user avatars first (we store two different sizes)
							async.eachSeries( item.avatars ? [64, 256] : [],
								function(size, callback) {
									var avatar_path = user_path + '/avatar/' + size + '.png';
									
									self.storage.get(avatar_path, function(err, buf) {
										if (err) return callback(); // no avatar, no problem
										
										stream.write( JSON.stringify({ key: avatar_path, value: buf.toString('base64') }) + "\n", 'utf8', callback );
									} ); // storage.get
								},
								function() {
									// finally, write user data record itself
									stream.write( JSON.stringify({ key: user_path, value: user }) + "\n", 'utf8', callback );
								}
							); // eachSeries
						} ); // get
					},
					function() {
						self.logDebug(6, "User export complete");
						callback();
					}
				); // listEach
			}; // export users
			
			exportTypes.bucketData = function(item, callback) {
				// export all bucket data
				self.logDebug(7, "Exporting bucket data");
				stream.write( "\n# Bucket Data\n");
				
				self.storage.listEach( 'global/buckets',
					function(bucket, idx, callback) {
						var storage_path = 'buckets/' + bucket.id + '/data';
						
						self.logDebug(8, "Exporting bucket data: " + storage_path );
						
						self.storage.get( storage_path, function(err, data) {
							if (err) {
								// bucket data deleted?
								self.logError('export', "Failed to fetch bucket data: " + storage_path + ": " + err );
								return callback();
							}
							
							stream.write( JSON.stringify({ key: storage_path, value: data }) + "\n", 'utf8', callback );
						} ); // get
					},
					function() {
						self.logDebug(6, "Bucket data export complete");
						callback();
					}
				); // listEach
			}; // export bucket data
			
			exportTypes.bucketFiles = function(item, callback) {
				// export all bucket files (base64)
				// item: { max_size? }
				if (!item.max_size) item.max_size = 1024 * 1024;
				
				self.logDebug(7, "Exporting bucket files");
				stream.write( "\n# Bucket Files\n");
				
				self.storage.listEach( 'global/buckets',
					function(bucket, idx, callback) {
						var storage_path = 'buckets/' + bucket.id + '/files';
						
						self.logDebug(8, "Exporting bucket files: " + storage_path );
						
						self.storage.get( storage_path, function(err, data) {
							if (err) {
								// bucket file data deleted?
								self.logError('export', "Failed to fetch bucket file data: " + storage_path + ": " + err );
								return callback();
							}
							
							// now export each file itself (base64)
							async.eachSeries( data,
								function(file, callback) {
									// verify size is under the limit
									if (file.size > item.max_size) {
										self.logDebug(8, "File too large for export, skipping: " + file.path, file);
										return process.nextTick(callback);
									}
									
									// load as buffer into memory
									self.storage.get(file.path, function(err, buf) {
										if (err) {
											self.logError('export', "Failed to load file for export: " + file.path + ": " + err);
											return callback();
										}
										
										// write base64 encoded buffer
										stream.write( JSON.stringify({ key: file.path, value: buf.toString('base64') }) + "\n", 'utf8', callback );
									} ); // storage.get
								},
								function() {
									// finally write file data (manifest)
									stream.write( JSON.stringify({ key: storage_path, value: data }) + "\n", 'utf8', callback );
								}
							); // eachSeries
						} ); // get
					},
					function() {
						self.logDebug(6, "Bucket data export complete");
						callback();
					}
				); // listEach
			}; // export bucket files
			
			exportTypes.secretData = function(item, callback) {
				// export all secret data (encrypted)
				self.logDebug(7, "Exporting secret data");
				stream.write( "\n# Encrypted Secret Data\n");
				
				self.storage.listEach( 'global/secrets',
					function(secret, idx, callback) {
						var storage_path = 'secrets/' + secret.id;
						
						self.logDebug(8, "Exporting secret data: " + storage_path );
						
						self.storage.get( storage_path, function(err, data) {
							if (err) {
								// secret data deleted?
								self.logError('export', "Failed to fetch secret data: " + storage_path + ": " + err );
								return callback();
							}
							
							stream.write( JSON.stringify({ key: storage_path, value: data }) + "\n", 'utf8', callback );
						} ); // get
					},
					function() {
						self.logDebug(6, "Secret data export complete");
						callback();
					}
				); // listEach
			}; // export secret data
			
			exportTypes.jobFiles = function(item, callback) {
				// export all job files (base64)
				// item: { query?, max_rows?, max_size?, logs, files }
				if (!item.query) item.query = '*';
				if (!item.max_size) item.max_size = 1024 * 1024;
				
				self.logDebug(7, "Exporting job files: " + item.query);
				stream.write( "\n# Job Files (" + item.query + ")\n");
				
				// use the low-level indexer API because we want more control
				self.storage.searchRecords( item.query, self.unbase.indexes.jobs, function(err, results) {
					if (err) {
						self.logError('export', "Failed to search jobs: " + item.query + ": " + err);
						return callback();
					}
					if (!results) results = {};
					
					// convert hash to array for async iteration
					// sort by newest to oldest (by ID)
					var records = Object.keys(results).sort( function(a, b) { 
						return b.toString().localeCompare(a); 
					} );
					
					if (!records.length) {
						self.logDebug(7, "No jobs found for file export: " + item.query);
						return callback();
					}
					
					if (item.max_rows && (records.length > item.max_rows)) {
						records.splice( item.max_rows );
					}
					
					self.logDebug(7, "Scanning " + records.length + " jobs for files", item);
					
					async.eachSeries( records,
						function(job_id, callback) {
							// load one record and format as a NDJSON line
							self.unbase.get( "jobs", job_id, function(err, job) {
								if (err) {
									self.logError('export', "Failed to load job for export: " + job_id);
									return callback();
								}
								
								var to_export = [];
								
								if (item.files) {
									to_export = (job.files || [])
										.filter( function(file) { return file.size < item.max_size; } )
										.map( function(file) { return file.path; } );
								}
								
								if (item.logs && job.log_file_size && !job.output || (job.log_file_size < item.max_size)) {
									to_export.push( 'logs/jobs/' + job.id + '/log.txt.gz' );
								}
								
								if (!to_export.length) return callback();
								
								async.eachSeries( to_export,
									function(key, callback) {
										self.storage.get(key, function(err, buf) {
											if (err) {
												self.logError('export', "Failed to load file for export: " + key + ": " + err);
												return callback();
											}
											
											stream.write( JSON.stringify({ key: key, value: buf.toString('base64') }) + "\n", 'utf8', callback );
										} ); // storage.get
									},
									callback
								); // eachSeries
							}); // unbase.get
						},
						function(err) {
							if (err) self.logError('export', "Job file export failed: " + err);
							else self.logDebug(6, "Job file export completed");
							callback();
						}
					); // eachSeries
				} ); // searchRecords
			}; // export jobFiles
			
			exportTypes.ticketFiles = function(item, callback) {
				// export all ticket files (base64)
				// item: { query?, max_rows?, max_size? }
				if (!item.query) item.query = '*';
				if (!item.max_size) item.max_size = 1024 * 1024;
				
				self.logDebug(7, "Exporting ticket files: " + item.query);
				stream.write( "\n# Ticket Files (" + item.query + ")\n");
				
				// use the low-level indexer API because we want more control
				self.storage.searchRecords( item.query, self.unbase.indexes.tickets, function(err, results) {
					if (err) {
						self.logError('export', "Failed to search tickets: " + item.query + ": " + err);
						return callback();
					}
					if (!results) results = {};
					
					// convert hash to array for async iteration
					// sort by newest to oldest (by ID)
					var records = Object.keys(results).sort( function(a, b) { 
						return b.toString().localeCompare(a); 
					} );
					
					if (!records.length) {
						self.logDebug(7, "No tickets found for file export: " + item.query);
						return callback();
					}
					
					if (item.max_rows && (records.length > item.max_rows)) {
						records.splice( item.max_rows );
					}
					
					self.logDebug(7, "Scanning " + records.length + " tickets for files", item);
					
					async.eachSeries( records,
						function(ticket_id, callback) {
							// load one record and format as a NDJSON line
							self.unbase.get( "tickets", ticket_id, function(err, ticket) {
								if (err) {
									self.logError('export', "Failed to load ticket for file export: " + ticket_id);
									return callback();
								}
								
								var to_export = [];
								
								to_export = (ticket.files || [])
									.filter( function(file) { return file.size < item.max_size; } )
									.map( function(file) { return file.path; } );
								
								if (!to_export.length) return callback();
								
								async.eachSeries( to_export,
									function(key, callback) {
										self.storage.get(key, function(err, buf) {
											if (err) {
												self.logError('export', "Failed to load ticket file for export: " + key + ": " + err);
												return callback();
											}
											
											stream.write( JSON.stringify({ key: key, value: buf.toString('base64') }) + "\n", 'utf8', callback );
										} ); // storage.get
									},
									callback
								); // eachSeries
							}); // unbase.get
						},
						function(err) {
							if (err) self.logError('export', "Ticket file export failed: " + err);
							else self.logDebug(6, "Ticket file export completed");
							callback();
						}
					); // eachSeries
				} ); // searchRecords
			}; // export ticketFiles
			
			exportTypes.monitorData = function(item, callback) {
				// export all server monitor timelines
				// item: { query? }
				if (!item.query) item.query = '*';
				
				self.logDebug(7, "Exporting server monitor data: " + item.query);
				stream.write( "\n# Monitor Timeline Data (" + item.query + ")\n" );
				
				// use the low-level indexer API because we want more control
				self.storage.searchRecords( item.query, self.unbase.indexes.servers, function(err, results) {
					if (err) {
						self.logError('export', "Failed to search servers: " + item.query + ": " + err);
						return callback();
					}
					if (!results) results = {};
					
					// convert hash to array for async iteration
					// sort by oldest to newest (by ID)
					var records = Object.keys(results).sort( function(a, b) { 
						return a.toString().localeCompare(b); 
					} );
					
					if (!records.length) {
						self.logDebug(7, "No servers found for monitor data export: " + item.query);
						return callback();
					}
					
					self.logDebug(7, "Scanning " + records.length + " servers for monitoring data", item);
					
					async.eachSeries( records,
						function(server_id, callback) {
							// construct list paths for each monitor zoom level
							async.eachSeries( self.systems,
								function(sys, callback) {
									// invoke exportTypes.list for each timeline list
									var timeline_key = 'timeline/' + server_id + '/' + sys.id;
									exportTypes.list( { key: timeline_key }, callback );
								},
								callback
							);
						},
						function(err) {
							if (err) self.logError('export', "Server monitor export failed: " + err);
							else self.logDebug(6, "Server monitor export completed");
							callback();
						}
					); // eachSeries
				} ); // searchRecords
			}; // export monitorData
			
			var item_idx = 0;
			
			async.eachSeries( params.items,
				function(item, callback) {
					// very rough progress estimate (better than nothing)
					job.update({ progress: item_idx / params.items.length });
					item_idx++;
					
					if (!exportTypes[item.type]) {
						self.logError('export', "Unknown item type: " + item.type);
						return callback();
					}
					
					self.logDebug(7, "Exporting " + item.type, item);
					
					exportTypes[item.type]( item, function() {
						self.logDebug(7, "Item export complete", item);
						callback();
					} );
				},
				function() {
					self.logDebug(6, "Data export finished: " + filename, params);
					
					stream.end("\n# End of file\n");
					
					if (callback) { 
						job.finish();
						callback(true); 
						callback = null; 
					}
				} 
			); // eachSeries
		} ); // loaded session
	}
	
	api_admin_delete_data(args, callback) {
		// delete custom set of data
		// params: { items: [ { type, key|index, query? } ] }
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!params.items || !params.items.length) {
			return this.doError('admin', "No data selected for deletion.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			var job = self.startInternalJob({ 
				title: "Custom bulk data deletion", 
				username: user.username || user.id, 
				email: user.email || '', // for report
				params: params,
				type: 'maint'
			});
			
			var report = {
				stats: {
					lists: 0,
					records: 0,
					keys: 0
				},
				warnings: [],
				errors: [],
				
				logError(code, msg, data) {
					if (this.errors.length < 100) this.errors.push(msg);
					else if (this.errors.length == 100) this.errors.push("Too many errors to show in report.  Please see the log for more details.");
					self.logError(code, msg, data);
				}
			};
			
			var deleteTypes = {};
			
			// send user callback now, so we can proceed in the background
			callback({ code: 0, id: job.id });
			
			// disable scheduler if enabled
			var state_key = 'scheduler.enabled';
			if (self.getState(state_key) == true) {
				self.putState(state_key, false);
				self.logTransaction('state_update', state_key, self.getClientInfo(args, { key: state_key, value: false }));
				report.warnings.push("The job scheduler was automatically disabled for the bulk deletion.  You will have to manually re-enable it.");
			}
			
			deleteTypes.list = function(item, callback) {
				// delete list
				// item: { key }
				self.logDebug(7, "Deleting list: " + item.key, item );
				
				self.storage.listDelete( item.key, false, function(err) {
					if (err) {
						if (err.code == 'NoSuchKey') self.logDebug(7, "List does not exist, skipping: " + item.key);
						else report.logError('delete', "Failed to fetch list header: " + item.key + ": " + err);
					}
					else report.stats.lists++;
					callback();
				} ); // listDelete
			}; // delete list
			
			deleteTypes.index = function(item, callback) {
				// delete db index, possibly with custom query
				// note: this spawns a sub-job
				// item: { index, query? }
				self.dbSearchDelete({
					index: item.index,
					query: item.query || '*',
					title: "Custom bulk deletion task (" + item.index + ")",
					username: user.username,
					callback: function(err, stats) {
						if (err) report.logError('delete', "Failed index deletion: " + item.index + ": " + err);
						else {
							report.stats.records += stats.count || 0;
							report.stats.keys += stats.keys || 0;
							report.stats.lists += stats.lists || 0;
						}
						callback();
					}
				});
			}; // delete index
			
			deleteTypes.users = function(item, callback) {
				// delete all user records, plus avatars and security logs
				// NOTE: this should be FIRST in the item array (before global/users is deleted)
				self.logDebug(7, "Deleting all user records");
				
				self.storage.listEach( 'global/users',
					function(user, idx, callback) {
						var username = user.username;
						var user_path = 'users/' + username.toString().toLowerCase().replace(/\W+/g, '');
						
						// skip current user
						if (username == job.username) {
							self.logDebug(8, "Skipping current user: " + username );
							return callback();
						}
						
						self.logDebug(8, "Deleting user: " + username );
						
						self.storage.delete( user_path, function(err, user) {
							if (err) {
								// user deleted?
								report.logError('delete', "Failed to delete user: " + user_path + ": " + err );
								return callback();
							}
							else report.stats.keys++;
							
							// delete user avatars too (we store two different sizes)
							async.eachSeries( [64, 256],
								function(size, callback) {
									var avatar_path = user_path + '/avatar/' + size + '.png';
									
									self.storage.delete(avatar_path, function(err, buf) {
										if (!err) report.stats.keys++;
										callback(); // no avatar, no problem
									} ); // storage.get
								},
								function() {
									// finally, delete user security log
									self.storage.listDelete( 'security/' + username, true, function(err) {
										if (!err) report.stats.lists++;
										callback();
									} );
								}
							); // eachSeries
						} ); // get
					},
					function() {
						self.logDebug(6, "User deletion complete");
						callback();
					}
				); // listEach
			}; // delete users
			
			deleteTypes.bucketData = function(item, callback) {
				// delete all bucket data
				// NOTE: this should be FIRST in the item array (before global/buckets is deleted)
				self.logDebug(7, "Deleting bucket data");
				
				self.storage.listEach( 'global/buckets',
					function(bucket, idx, callback) {
						var storage_path = 'buckets/' + bucket.id + '/data';
						
						self.logDebug(8, "Deleting bucket data: " + storage_path );
						
						self.storage.delete( storage_path, function(err, data) {
							if (err) {
								// data already deleted?
								self.logError('delete', "Failed to delete bucket data: " + storage_path + ": " + err );
								return callback();
							}
							callback();
						} ); // storage.delete
					},
					function() {
						self.logDebug(6, "Bucket data deletion complete");
						callback();
					}
				); // listEach
			}; // delete bucket data
			
			deleteTypes.bucketFiles = function(item, callback) {
				// delete all bucket files
				// NOTE: this should be FIRST in the item array (before global/buckets is deleted)
				self.logDebug(7, "Deleting bucket files");
				
				self.storage.listEach( 'global/buckets',
					function(bucket, idx, callback) {
						var storage_path = 'buckets/' + bucket.id + '/files';
						
						self.logDebug(8, "Deleting bucket files: " + storage_path );
						
						self.storage.get( storage_path, function(err, data) {
							if (err) {
								// bucket file data deleted?
								self.logError('delete', "Failed to fetch bucket file data: " + storage_path + ": " + err );
								return callback();
							}
							
							// now delete each file itself
							async.eachSeries( data,
								function(file, callback) {
									self.storage.delete(file.path, function(err) {
										if (err) {
											self.logError('delete', "Failed to delete file: " + file.path + ": " + err);
											return callback();
										}
										callback();
									} ); // storage.delete
								},
								callback
							); // eachSeries
						} ); // get
					},
					function() {
						self.logDebug(6, "Bucket data deletion complete");
						callback();
					}
				); // listEach
			}; // delete bucket files
			
			deleteTypes.secretData = function(item, callback) {
				// delete all secret data
				// NOTE: this should be FIRST in the item array (before global/secrets is deleted)
				self.logDebug(7, "Deleting secret data");
				
				self.storage.listEach( 'global/secrets',
					function(secret, idx, callback) {
						var storage_path = 'secrets/' + secret.id;
						
						self.logDebug(8, "Deleting secret data: " + storage_path );
						
						self.storage.delete( storage_path, function(err, data) {
							if (err) {
								// data already deleted?
								self.logError('delete', "Failed to delete secret data: " + storage_path + ": " + err );
								return callback();
							}
							callback();
						} ); // storage.delete
					},
					function() {
						self.logDebug(6, "Secret data deletion complete");
						callback();
					}
				); // listEach
			}; // delete secret data
			
			var item_idx = 0;
			
			async.eachSeries( params.items,
				function(item, callback) {
					// very rough progress estimate (better than nothing)
					job.update({ progress: item_idx / params.items.length });
					item_idx++;
					
					if (!deleteTypes[item.type]) {
						report.logError('delete', "Unknown item type: " + item.type);
						return callback();
					}
					
					self.logDebug(7, "Deleting " + item.type, item);
					
					deleteTypes[item.type]( item, function() {
						self.logDebug(7, "Item deletion complete", item);
						callback();
					} );
				},
				function() {
					// reload all global lists into memory, as they've probably changed
					async.eachSeries( self.config.getPath('ui.globalMemoryLists'),
						function(key, callback) {
							self.storage.listGet( 'global/' + key, 0, 0, function(err, items) {
								self[key] = items || [];
								callback();
							});
						},
						function() {
							// re-compile all monitor and alert expressions
							self.precompileMonitors();
							
							// compile report
							job.details = '';
							job.details += "### Custom Bulk Deletion Report\n";
							
							job.details += "\nThe deletion job completed with ";
							job.details += Tools.commify(report.errors.length) + " " + Tools.pluralize('error', report.errors.length);
							job.details += " and " + Tools.commify(report.warnings.length) + " " + Tools.pluralize('warning', report.warnings.length) + ".";
							job.details += " See below for details.\n";
							
							// summary
							job.details += "\n#### Details\n\n";
							job.details += "- **DB Records Deleted:** " + Tools.commify(report.stats.records) + "\n";
							job.details += "- **Storage Lists Deleted:** " + Tools.commify(report.stats.lists) + "\n";
							job.details += "- **Storage Keys Deleted:** " + Tools.commify(report.stats.keys) + "\n";
							
							// errors
							job.details += "\n#### Errors\n\n";
							if (report.errors.length) {
								job.details += report.errors.map( function(msg) { return '- ' + msg; } ).join("\n") + "\n";
							}
							else job.details += "None.\n";
							
							// warnings
							job.details += "\n#### Warnings\n\n";
							if (report.warnings.length) {
								job.details += report.warnings.map( function(msg) { return '- ' + msg; } ).join("\n") + "\n";
							}
							else job.details += "None.\n";
							
							job.finish();
							self.logDebug(6, "Bulk data deletion finished", params);
							
							// re-prep plugins (they may have changed)
							self.prepPlugins();
							
							// massive data update for all connected users
							var targs = {};
							self.beforeUserLogin(targs, function() {
								self.doUserBroadcastAll('update', targs.resp );
							});
						}
					); // eachSeries
				} 
			); // eachSeries
		} ); // loaded session
	}
	
	api_admin_upgrade_workers(args, callback) {
		// start internal job to send upgrade commands to selected workers
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			release: /^[\w\-\.]+$/,
			stagger: /^\d+$/
		}, callback)) return;
		
		if (!params.targets || !Array.isArray(params.targets) || !params.targets.length) {
			return this.doError('admin', "No targets selected for upgrade.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			if (self.findInternalJobs({ type: 'maint' }).length) {
				return self.doError('admin', "Cannot start upgrade while a maintenance job is running.", callback);
			}
			
			// gather all live server ids from targets
			var server_ids = [];
			
			params.targets.forEach( function(target) {
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
				return !!self.servers[server_id];
			} );
			
			if (!server_ids.length) {
				return self.doError('admin', "No active servers matched your target selection.", callback);
			}
			
			self.logDebug(3, "Starting background worker server upgrade", { server_ids, params } );
			
			callback({ code: 0 });
			
			// start job in background
			var stats = { servers: 0, skipped: 0 };
			var job = self.startInternalJob({ 
				title: "Worker server upgrade", 
				type: 'maint', 
				username: user.username || user.id, 
				params, 
				stats, 
				details: '',
				hush: true
			});
			
			// save release version selection in config overrides, but only if changed
			if (self.config.getPath('satellite.version') != params.release) {
				self.updateConfigOverrides( { 'satellite.version': params.release } );
			}
			
			// iterate over servers
			async.eachSeries( server_ids,
				function(server_id, callback) {
					// sanity check
					if (self.server.shut) {
						var err_msg = "Server is shutting down, aborting install job";
						job.details += `- **Error**: ${err_msg}\n`;
						self.logError('admin', err_msg);
						return callback("SHUTDOWN");
					}
					
					// send upgrade command
					var server = self.servers[server_id];
					if (!server) {
						var err_msg = "Server went offline, skipping upgrade: " + server_id;
						job.details += `- **Error**: ${err_msg}\n`;
						self.logError('upgrade', err_msg);
						stats.skipped++;
						return process.nextTick(callback);
					}
					
					self.logDebug(4, "Sending upgrade command to: " + server_id, { title: server.title || '', hostname: server.hostname });
					self.doServerBroadcast( server_id, 'upgrade', {} );
					
					// update job progress
					stats.servers++;
					job.update({ progress: stats.servers / server_ids.length });
					
					// stagger
					if (params.stagger && (stats.servers < server_ids.length)) {
						self.logDebug(9, `Sleeping for ${params.stagger} seconds before next install`);
						setTimeout( function() { callback(); }, params.stagger * 1000 );
					}
					else callback();
				},
				function(err) {
					// all done
					if (!err) self.logDebug(3, "All server upgrade commands sent");
					job.finish();
				}
			); // async.eachSeries
			
		} ); // loaded session
	}
	
	api_admin_upgrade_masters(args, callback) {
		// start internal job to send upgrade commands to selected masters
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			release: /^[\w\-\.]+$/,
			stagger: /^\d+$/
		}, callback)) return;
		
		if (!params.targets || !Array.isArray(params.targets) || !params.targets.length) {
			return this.doError('admin', "No targets selected for upgrade.", callback);
		}
		if (this.config.getPath('airgap.enabled')) {
			return this.doError('admin', "Cannot perform conductor server upgrades in air-gapped mode.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			if (self.findInternalJobs({ type: 'maint' }).length) {
				return self.doError('admin', "Cannot start upgrade while a maintenance job is running.", callback);
			}
			
			// separate out current master from the rest of the pack, if applicable
			var upgrade_self = false;
			var host_ids = params.targets.filter( function(host_id) {
				if (host_id == self.hostID) { upgrade_self = true; return false; }
				
				var peer = Tools.findObject( self.peers, { id: host_id } );
				return peer && peer.socket && peer.socket.connected;
			} );
			
			if (!host_ids.length && !upgrade_self) {
				return self.doError('admin', "No active conductor servers matched your target selection.", callback);
			}
			
			self.logDebug(3, "Starting background master server upgrade", { host_ids, upgrade_self, params } );
			callback({ code: 0 });
			
			// start job in background
			var stats = { servers: 0, skipped: 0, upgrade_self };
			var job = self.startInternalJob({ 
				title: "Conductor server upgrade", 
				type: 'maint', 
				username: user.username || user.id, 
				params, 
				stats, 
				details: "### Details\n\n",
				hush: true
			});
			
			// prep master command
			var cmd_data = { commands: ["upgrade"] };
			if (params.release != 'latest') cmd_data.commands.push( params.release );
			
			// iterate over remote masters
			async.eachSeries( host_ids,
				function(host_id, callback) {
					// sanity check
					if (self.server.shut) {
						var err_msg = "Server is shutting down, aborting install job";
						job.details += `- **Error**: ${err_msg}\n`;
						self.logError('admin', err_msg);
						return callback("SHUTDOWN");
					}
					
					// send upgrade command
					var peer = Tools.findObject( self.peers, { id: host_id } );
					if (!peer || !peer.socket || !peer.socket.connected) {
						var err_msg = "Conductor server went offline, skipping upgrade: " + host_id;
						self.logError('upgrade', err_msg);
						job.details += `- **Error**: ${err_msg}\n`;
						stats.skipped++;
						return process.nextTick(callback);
					}
					if (peer.debug) {
						var err_msg = "Cannot upgrade conductor server in debug mode: " + host_id;
						self.logError('upgrade', err_msg);
						job.details += `- **Error**: ${err_msg}\n`;
						stats.skipped++;
						return process.nextTick(callback);
					}
					
					// send it
					job.details += `- Sent remote upgrade command to backup server: ${peer.id}\n`;
					self.logDebug(3, "Sending remote upgrade command to peer: " + peer.id, cmd_data);
					peer.socket.send('masterCommand', cmd_data);
					
					// update job progress
					stats.servers++;
					job.update({ progress: stats.servers / host_ids.length });
					
					// stagger
					if (params.stagger && (stats.servers < host_ids.length)) {
						self.logDebug(5, `Sleeping for ${params.stagger} seconds before next install`);
						setTimeout( function() { callback(); }, params.stagger * 1000 );
					}
					else callback();
				},
				function(err) {
					// all done
					if (!err) {
						self.logDebug(3, "All remote upgrade commands sent (" + host_ids.length + ")");
						if (upgrade_self) {
							job.details += `- Upgrading primary conductor server in background: ${self.hostID}`;
							stats.servers++;
						}
					}
					job.finish();
					
					// send self upgrade command after job completes (as we need to shut down for this)
					// allow enough time for job to complete and an activity log entry to be written
					var stagger_sec = params.stagger || 1;
					if (!host_ids.length) stagger_sec = 1;
					
					if (!err && upgrade_self) setTimeout( function() {
						// final sanity check
						if (self.server.shut) {
							self.logError('admin', "Server is shutting down, aborting self-upgrade");
							return;
						}
						
						self.logDebug(1, "Initiating local self-upgrade command (will trigger shutdown)", cmd_data);
						self.doMasterCommand( null, cmd_data );
						
					}, stagger_sec * 1000 );
				}
			); // async.eachSeries
		} ); // loaded session
	}
	
	api_admin_logout_all(args, callback) {
		// logout all sessions for user
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			username: /^[\w\-\.]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, admin_user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, admin_user, callback)) return;
			
			args.user = admin_user;
			args.session = session;
			
			var username = params.username;
			var stats = { sockets: 0, sessions: 0 };
			var job = self.startInternalJob({ title: "Logging out user sessions for: " + username, username: admin_user.username, type: 'user', stats, params });
			
			callback({ code: 0, id: job.id });
			
			self.logDebug(5, "Logging out all user sessions for: " + username);
			
			// force all connected users to logout
			// Note: we're not actually closing the sockets here, but we're sending a logout command, AND we're deauthorizing the sockets
			Tools.findObjects( Object.values(self.sockets), { type: 'user', username: username } ).forEach( function(socket) {
				self.logDebug(7, "Logging out connected user via websocket command: " + socket.id);
				socket.send( 'logout', {} );
				socket.auth = false;
				stats.sockets++;
			} );
			
			self.storage.listEach( 'security/' + username, function(item, idx, callback) {
				// we only care about `user_login` actions
				if ((item.action != 'user_login') || !item.session_id) {
					return process.nextTick(callback);
				}
				
				var session_key = 'sessions/' + item.session_id;
				self.storage.get( session_key, function(err, data) {
					// error is non-fatal, as session may have expired or been previously deleted
					if (err || !data) {
						return process.nextTick(callback);
					}
					
					self.storage.delete( session_key, function(err) {
						// error is non-fatal, as session may have expired or been previously deleted
						if (err) return process.nextTick(callback);
						self.logDebug(6, "Deleted user session by admin request: " + item.session_id, data);
						stats.sessions++;
						callback();
					}); // storage.delete
				}); // storage.get
			}, 
			function() {
				// all done, send report if we actually deleted anything
				self.logDebug(6, "Completed logout sweep across security/" + username);
				job.finish();
			} ); // listEach
		}); // loadSession
	}
	
	api_admin_send_test_email(args, callback) {
		// send test email and report results as markdown
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			to: /^[^@\s]+@[^@\s]+\.[^@\s]+(,\s*[^@\s]+@[^@\s]+\.[^@\s]+)*$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			var mail_args = {
				config: {
					client: self.config.get('client')
				},
				job: {
					email: params.to,
					title: "Send Test Email",
					id: "1234567890",
					type: "Email",
					username: user.username || user.id,
					details: "This is a test."
				},
				hostID: self.hostID,
				display: {
					started: (new Date()).toString(),
					completed: (new Date()).toString(),
					elapsed: "0 seconds",
				}
			};
			
			self.sendFancyMail('internal_job', mail_args, function(err, body, log) {
				var action = { code: 0 };
				if (err) {
					action.err = true;
					action.description = "Failed to send e-mail: " + params.to + ": " + err;
				}
				else {
					action.err = false;
					action.description = "Email sent successfully to: " + params.to;
				}
				action.details = "";
				
				// include pixl-mail debug capture
				if (log && log.length) {
					action.details += "**Mailer Debug Log:**\n\n```text\n";
					
					log.forEach( function(row) {
						var [ msg, args ] = row;
						if (args.tnx === 'message') return; // skip message body
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
				
				callback(action);
			}); // sendFancyMail
		}); // loadSession
	}
	
}; // class Admin

module.exports = Admin;
