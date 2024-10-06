// Orchestra API Layer - Admin
// Copyright (c) 2021 - 2024 Joseph Huckaby
// Released under the MIT License

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
	
	api_get_master_state(args, callback) {
		// get state data
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			callback({ code: 0, state: self.state });
		} ); // loaded session
	}
	
	api_update_master_state(args, callback) {
		// update master state, params can be dot.props
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			// update using dot.props
			// putState also marks it as dirty
			for (var key in params) {
				self.putState(key, params[key]);
				self.logTransaction('state_update', key, self.getClientInfo(args, { key, value: params[key] }));
			}
			
			callback({ code: 0 });
		} ); // loaded session
	}
	
	api_test_internal_job(args, callback) {
		// start background job to do nothing for a bit
		var self = this;
		var params = args.params;
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
				job.update({ progress: counter / 60 });
				
				if (counter >= 60) {
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
			
			self.runMaintenance( function() {
				job.finish();
			} );
			
			callback({ code: 0 });
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
			
			callback({ code: 0 });
			
			var job = self.startInternalJob({ 
				title: "Database integrity and optimization", 
				username: user.username || user.id, 
				email: user.email || '', // for report
				type: 'maint' 
			});
			
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
			
			var temp_file = Path.join( os.tmpdir(), 'orchestra-import-temp-' + Tools.generateShortID() + '.txt' );
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
					
					// disable scheduler if enabled
					var state_key = 'scheduler.enabled';
					if (self.getState(state_key) == true) {
						self.putState(state_key, false);
						self.logTransaction('state_update', state_key, self.getClientInfo(args, { key: state_key, value: false }));
						report.warnings.push("The job scheduler was automatically disabled for the bulk import.  You will have to manually re-enable it.");
					}
					
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
					async.eachSeries( self.globalListNames,
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
				
				// compose job report (details) for email
				job.details = '';
				job.details += "### Bulk Import " + (err ? 'Failed' : 'Completed') + "\n";
				
				// file.name, file.size, file.type
				job.details += "\n#### File Details\n\n";
				job.details += "- **Filename:** " + file.name + "\n";
				job.details += "- **File Size:** " + Tools.getTextFromBytes(file.size) + "\n";
				job.details += "- **File Type:** " + file.type + "\n";
				
				// summary
				job.details += "\n#### Import Summary\n\n";
				job.details += "- **Lines Processed:** " + commify(stats.lines) + "\n";
				job.details += "- **DB Records Imported:** " + commify(stats.records) + "\n";
				job.details += "- **Storage Keys Written:** " + commify(stats.keys) + "\n";
				job.details += "- **Commands Executed:** " + commify(stats.commands) + "\n";
				
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
				
				// cleanup temp file
				fs.unlink( temp_file, function() {} );
				
				if (err) return self.doError('admin', "Failed to process file: " + err, callback);
				else {
					self.logDebug(5, "Bulk data import finished", { num_lines });
					
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
			delete this.transferTokens[token.id];
		}
		
		if (!params.items || !params.items.length) {
			return this.doError('admin', "No data selected for export.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			var job = self.startInternalJob({ title: "Custom bulk data export", username: user.username || user.id, type: 'maint' });
			var filename = 'orchestra-data-export-' + Tools.formatDate(Tools.timeNow(), '[yyyy]-[mm]-[dd]') + '-' + Tools.generateShortID() + '.txt.gz';
			
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
				"# Orchestra Data Export v1.0\n" + 
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
								
								if (item.logs && job.log_file_size && (job.log_file_size < item.max_size)) {
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
				// NOTE: this should be FIRST in the item array
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
					async.eachSeries( self.globalListNames,
						function(key, callback) {
							self.storage.listGet( 'global/' + key, 0, 0, function(err, items) {
								self[key] = items || [];
								callback();
							});
						},
						function() {
							// compile report
							job.details = '';
							job.details += "### Custom Bulk Deletion Report\n";
							
							// summary
							job.details += "\n#### Summary\n\n";
							job.details += "- **DB Records Deleted:** " + commify(stats.records) + "\n";
							job.details += "- **Storage Lists Deleted:** " + commify(stats.lists) + "\n";
							job.details += "- **Storage Keys Deleted:** " + commify(stats.keys) + "\n";
							
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
	
}; // class Admin

module.exports = Admin;
