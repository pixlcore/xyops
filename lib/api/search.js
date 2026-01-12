// xyOps API Layer - Search
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const Path = require('path');
const assert = require("assert");
const zlib = require('zlib');
const readline = require('readline');
const async = require('async');
const UserAgent = require('useragent-ng');
const Tools = require("pixl-tools");

class Search {

	api_search_jobs(args, callback) {
		// search unbase for completed jobs
		// { query, offset, limit, sort_by, sort_dir, verbose }
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		var params = Tools.mergeHashes( args.params, args.query );
		
		params.offset = parseInt( params.offset || 0 );
		params.limit = parseInt( params.limit || 1 );
		
		if (!params.sort_by) params.sort_by = 'completed';
		if (!params.sort_dir) params.sort_dir = -1;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			// if user has limited category access, augment search query accordingly
			var cats = self.getComputedCategories(user);
			if (cats.length) {
				if (!params.query) params.query = '';
				params.query += ' category:' + cats.join('|');
			}
			
			// if user has limited group access, augment search query accordingly
			var cgrps = self.getComputedGroups(user);
			if (cgrps.length) {
				if (!params.query) params.query = '';
				params.query += ' groups:' + cgrps.join('|');
			}
			
			if (!params.query) params.query = '*';
			
			self.unbase.search( 'jobs', params.query, params, function(err, results) {
				if (err) return self.doError('db', "Failed DB search: " + err, callback);
				if (!results.records) results.records = [];
				
				self.setCacheResponse(args, self.config.get('ttl'));
				
				// prune verbose props unless requested
				if (!params.verbose) results.records.forEach( function(job) {
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
				
				// make response compatible with UI pagination tools
				callback({
					code: 0,
					rows: results.records,
					list: { length: results.total || 0 }
				});
				
				self.updateDailyStat( 'search', 1 );
			}); // unbase.search
		}); // loadSession
	}
	
	api_search_servers(args, callback) {
		// search unbase for historical servers
		// { query, offset, limit, sort_by, sort_dir, verbose }
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!params.query) params.query = '*';
		
		params.offset = parseInt( params.offset || 0 );
		params.limit = parseInt( params.limit || 1 );
		
		if (!params.sort_by) params.sort_by = '_id';
		if (!params.sort_dir) params.sort_dir = -1;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.unbase.search( 'servers', params.query, params, function(err, results) {
				if (err) return self.doError('db', "Failed DB search: " + err, callback);
				if (!results.records) results.records = [];
				
				self.setCacheResponse(args, self.config.get('ttl'));
				
				// make response compatible with UI pagination tools
				callback({
					code: 0,
					rows: results.records,
					list: { length: results.total || 0 }
				});
				
				self.updateDailyStat( 'search', 1 );
			}); // unbase.search
		}); // loadSession
	}
	
	api_get_server_summaries(args, callback) {
		// get all server field summaries and labels (OSes, CPUs, etc.)
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var index = self.unbase.getIndex('servers');
			var fields = ['os_platform', 'os_distro', 'os_release', 'os_arch', 'cpu_virt', 'cpu_brand', 'cpu_cores'];
			var keys = fields.map( function(field_id) { return index.base_path + '/' + field_id + '/summary'; } );
			
			self.storage.getMulti( keys, function(err, records) {
				if (err) {
					self.logError('db', "Failed to get server summaries: " + err + " (no servers added yet?)", { keys });
					records = [];
				}
				
				// convert array to hash
				var summaries = {};
				fields.forEach( function(field_id, idx) {
					summaries[field_id] = records[idx] || {};
				} );
				
				callback({ code: 0, summaries });
			} ); // getMulti
		}); // loadSession
	}
	
	api_search_alerts(args, callback) {
		// search unbase for historical or active alerts
		// { query, offset, limit, sort_by, sort_dir }
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!params.query) params.query = '*';
		
		params.offset = parseInt( params.offset || 0 );
		params.limit = parseInt( params.limit || 1 );
		
		if (!params.sort_by) params.sort_by = '_id';
		if (!params.sort_dir) params.sort_dir = -1;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.unbase.search( 'alerts', params.query, params, function(err, results) {
				if (err) return self.doError('db', "Failed DB search: " + err, callback);
				if (!results.records) results.records = [];
				
				self.setCacheResponse(args, self.config.get('ttl'));
				
				// make response compatible with UI pagination tools
				callback({
					code: 0,
					rows: results.records,
					list: { length: results.total || 0 }
				});
				
				self.updateDailyStat( 'search', 1 );
			}); // unbase.search
		}); // loadSession
	}
	
	api_search_snapshots(args, callback) {
		// search unbase for snapshots
		// { query, offset, limit, sort_by, sort_dir }
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!params.query) params.query = '*';
		
		params.offset = parseInt( params.offset || 0 );
		params.limit = parseInt( params.limit || 1 );
		
		if (!params.sort_by) params.sort_by = '_id';
		if (!params.sort_dir) params.sort_dir = -1;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.unbase.search( 'snapshots', params.query, params, function(err, results) {
				if (err) return self.doError('db', "Failed DB search: " + err, callback);
				if (!results.records) results.records = [];
				
				self.setCacheResponse(args, self.config.get('ttl'));
				
				// prune verbose props unless requested
				if (!params.verbose) results.records.forEach( function(snapshot) {
					if (!snapshot.data) snapshot.data = {};
					delete snapshot.data.conns;
					delete snapshot.data.processes;
					delete snapshot.data.mounts;
					delete snapshot.data.commands;
					
					// snapshot may be a group type, so prune those keys too
					delete snapshot.servers;
					delete snapshot.snapshots;
					delete snapshot.group_def;
					delete snapshot.quickmons;
				} );
				
				// make response compatible with UI pagination tools
				callback({
					code: 0,
					rows: results.records,
					list: { length: results.total || 0 }
				});
				
				self.updateDailyStat( 'search', 1 );
			}); // unbase.search
		}); // loadSession
	}
	
	api_search_activity(args, callback) {
		// search unbase for activity (audit log) -- admin only
		// { query, offset, limit, sort_by, sort_dir }
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!params.query) params.query = '*';
		
		params.offset = parseInt( params.offset || 0 );
		params.limit = parseInt( params.limit || 1 );
		
		if (!params.sort_by) params.sort_by = '_id';
		if (!params.sort_dir) params.sort_dir = -1;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			self.unbase.search( 'activity', params.query, params, function(err, results) {
				if (err) return self.doError('db', "Failed DB search: " + err, callback);
				if (!results.records) results.records = [];
				
				// parse user agents
				results.records.forEach( function(item) {
					if (!item.headers || !item.headers['user-agent']) return;
					var agent = UserAgent.parse( item.headers['user-agent'] );
					item.useragent = agent.toString(); // 'Chrome 15.0.874 / Mac OS X 10.8.1'
					item.useragent = item.useragent.replace(/Mac OS X [\d\.]+/, 'macOS');
					if (item.useragent.match(/\b(Other)\b/)) item.useragent = item.headers['user-agent'];
				});
				
				self.setCacheResponse(args, self.config.get('ttl'));
				
				// make response compatible with UI pagination tools
				callback({
					code: 0,
					rows: results.records,
					list: { length: results.total || 0 }
				});
				
				self.updateDailyStat( 'search', 1 );
			}); // unbase.search
		}); // loadSession
	}
	
	api_search_revision_history(args, callback) {
		// search unbase for revision history -- all users
		// { type, query, offset, limit, sort_by, sort_dir }
		var self = this;
		var activity_search_map = this.config.getPath('ui.activity_search_map');
		var activity_descriptions = this.config.getPath('ui.activity_descriptions');
		
		if (!this.requireMaster(args, callback)) return;
		var params = Tools.mergeHashes( args.params, args.query );
		
		params.offset = parseInt( params.offset || 0 );
		params.limit = parseInt( params.limit || 1 );
		
		if (!params.sort_by) params.sort_by = '_id';
		if (!params.sort_dir) params.sort_dir = -1;
		
		// sanity checks
		params.query = '' + (params.query || '');
		if (params.query.match(/\baction\s*\:/i)) return this.doError('search', "No.", callback);
		if (params.query.match(/^\s*\(/)) return this.doError('search', "Nope.", callback);
		
		params.type = '' + (params.type || '');
		if (!params.type || !activity_search_map[params.type]) return this.doError('search', "Invalid search type.", callback);
		if (params.type.match(/^(api_keys|jobs|users|servers|peers|system)$/)) return this.doError('search', "Invalid search type.", callback);
		
		var action_re = new RegExp( activity_search_map[params.type] );
		var action_types = [];
		
		for (var key in activity_descriptions) {
			if (key.match(action_re)) action_types.push( key );
		}
		
		params.query = ('action:' + action_types.join('|') + ' ' + params.query).trim();
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.unbase.search( 'activity', params.query, params, function(err, results) {
				if (err) return self.doError('db', "Failed DB search: " + err, callback);
				if (!results.records) results.records = [];
				
				// prune results for security
				results.records.forEach( function(record) {
					delete record.ip;
					delete record.ips;
					delete record.headers;
				} );
				
				self.setCacheResponse(args, self.config.get('ttl'));
				
				// make response compatible with UI pagination tools
				callback({
					code: 0,
					rows: results.records,
					list: { length: results.total || 0 }
				});
				
				self.updateDailyStat( 'search', 1 );
			}); // unbase.search
		}); // loadSession
	}
	
	api_search_stat_history(args, callback) {
		// grab select stats from global/stats history
		// { offset, limit, path?, key_prefix?, current_day? }
		var self = this;
		
		if (!this.requireMaster(args, callback)) return;
		var params = Tools.mergeHashes( args.params, args.query );
		
		params.offset = parseInt( params.offset || 0 );
		params.limit = parseInt( params.limit || 1 );
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listGet( 'global/stats', params.offset, params.limit, function(err, items, list) {
				if (err) return callback({ code: 0, items: [], list: list || { length: 0 } });
				
				if (params.current_day) {
					// optionally add current day's stats in progress
					items.push( self.stats );
				}
				
				var days = [];
				items.forEach( function(item) {
					var day = { epoch: item.currentDay.timeStart, data: {} };
					var dargs = Tools.getDateArgs( day.epoch );
					day.date = dargs.yyyy_mm_dd;
					
					if (params.path) item = Tools.getPath( item, params.path );
					if (!item) return;
					
					if (params.key_prefix && Tools.isaHash(item)) {
						item = Tools.copyHash(item, true);
						for (var key in item) {
							if (!key.startsWith(params.key_prefix)) delete item[key];
						}
					}
					
					day.data = item;
					days.push(day);
				} ); // foreach item
				
				callback({ code: 0, items: days, list });
			} ); // listGet
		}); // loadSession
	}
	
	api_marketplace(args, callback) {
		// make search or fetch request to the xyops marketplace system
		// search: { query?, type?, license?, tags?, requires?, sort_by?, sort_dir?, offset?, limit? }
		// fetch: { id, version?, readme?, data?, logo? }
		// fields: { fields }
		var self = this;
		var params = args.query;
		var marketplace = this.config.get('marketplace') || {};
		var cache_file = Path.join( this.config.get('temp_dir'), 'marketplace.json' );
		
		if (!this.requireMaster(args, callback)) return;
		
		var includesAllCI = function(haystack, needles) {
			// case-insensitive string version of Tools.includesAll
			const normalizedHaystack = haystack.map(s => s.toLowerCase());
			return needles.every(n =>
				normalizedHaystack.includes(n.toLowerCase())
			);
		}
		
		if (!marketplace || !marketplace.metadata_url) marketplace = {
			"enabled": true,
			"metadata_url": "https://raw.githubusercontent.com/pixlcore/xyops-marketplace/refs/heads/main/marketplace.json",
			"repo_url_template": "https://raw.githubusercontent.com/[id]/refs/tags/[version]/[filename]",
			"ttl": 3600
		};
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			if (!marketplace.enabled) {
				return self.doError('marketplace', "The marketplace system is not enabled.  Please enable it in your xyOps configuration and try again.");
			}
			
			self.setCacheResponse(args, self.config.get('ttl'));
			
			var finish = function(metadata) {
				if (params.id) {
					// fetch file from specific plugin
					var item = Tools.findObject( metadata.rows, { id: params.id } );
					if (!item) return self.doError( 'marketplace', "Marketplace item not found", callback );
					
					if (params.readme) {
						// fetch readme
						var ver = params.version || item.versions[0];
						var url = Tools.sub( marketplace.repo_url_template, {
							id: params.id,
							version: ver,
							filename: 'README.md'
						} );
						
						self.request.get( url, { retries: 8, retryDelay: 50 }, function(err, resp, data, perf) {
							if (err) return self.doError( 'marketplace', "Failed to fetch README: " + err, callback );
							
							// try to fix image src urls if relative
							var text = data.toString().replace(/(<img.*?src\s*\=\s*\")([^\"]*)(\"[^>]*>)/ig, function(m_all, m_g1, m_g2, m_g3) {
								if (!m_g2.match(/^\w+\:\/\//)) {
									return m_g1 + Tools.sub( marketplace.repo_url_template, { id: params.id, version: ver, filename: m_g2 } ) + m_g3;
								}
								else return m_all;
							});
							
							callback({ code: 0, item, version: ver, text });
						});
						return;
					}
					else if (params.data) {
						// fetch data (xypdf)
						var ver = params.version || item.versions[0];
						var url = Tools.sub( marketplace.repo_url_template, {
							id: params.id,
							version: ver,
							filename: 'xyops.json'
						} );
						
						self.request.json( url, false, { retries: 8, retryDelay: 50 }, function(err, resp, data, perf) {
							if (err) return self.doError( 'marketplace', "Failed to fetch data: " + err, callback );
							callback({ code: 0, item, version: ver, data: data });
						});
						return;
					}
					else if (params.logo) {
						// fetch logo
						var url = Tools.sub( marketplace.repo_url_template, {
							id: params.id,
							version: params.version || item.versions[0],
							filename: 'logo.png'
						} );
						
						self.request.get( url, { retries: 8, retryDelay: 50 }, function(err, resp, data, perf) {
							if (err) return self.doError( 'marketplace', "Failed to fetch README: " + err, callback );
							callback( "200 OK", { 'Content-Type': 'image/png' }, data );
						});
						return;
					}
					else return self.doError('api', "Invalid API request", callback);
				} // id
				else if (params.fields) {
					// return all unique field values (tags, licenses, etc.)
					var fields = { types: {}, plugin_types: {}, requires: {}, tags: {}, licenses: {} };
					
					metadata.rows.forEach( function(row) {
						if (row.type) fields.types[ row.type ] = 1;
						if (row.plugin_type) fields.plugin_types[ row.plugin_type ] = 1;
						if (row.license) fields.licenses[ row.license ] = 1;
						(row.requires || []).forEach( function(req) { fields.requires[req] = 1; } );
						(row.tags || []).forEach( function(tag) { fields.tags[tag] = 1; } );
					} );
					
					fields.types = Tools.hashKeysToArray(fields.types).sort();
					fields.plugin_types = Tools.hashKeysToArray(fields.plugin_types).sort();
					fields.requires = Tools.hashKeysToArray(fields.requires).sort();
					fields.tags = Tools.hashKeysToArray(fields.tags).sort();
					fields.licenses = Tools.hashKeysToArray(fields.licenses).sort();
					
					return callback({ code: 0, fields });
				} // fields
				
				if (params.tags && (typeof(params.tags) == 'string')) params.tags = params.tags.split(/\,\s*/);
				if (params.requires && (typeof(params.requires) == 'string')) params.requires = params.requires.split(/\,\s*/);
				
				// apply user search filters
				var rows = metadata.rows.filter( function(row) {
					if (params.query) {
						var text = [row.title, row.description, row.id, row.license, row.type, ...row.tags, ...row.requires].join(' ').toLowerCase();
						if (!text.includes(params.query.toLowerCase())) return false;
					}
					if (params.type && (row.type != params.type)) return false;
					if (params.plugin_type && (row.plugin_type != params.plugin_type)) return false;
					if (params.license && (row.license.toLowerCase() != params.license.toLowerCase())) return false;
					if (params.tags && !includesAllCI(row.tags, params.tags)) return false;
					if (params.requires && !includesAllCI(row.requires, params.requires)) return false;
					return true;
				} );
				
				// apply user sort
				Tools.sortBy( rows, params.sort_by || 'title', { dir: params.sort_dir || 1 } );
				
				// apply user offset/limit
				var len = rows.length;
				rows = rows.slice( params.offset || 0, (params.offset || 0) + (params.limit || 1000) );
				
				callback({ code: 0, rows: rows, list: { length: len } });
			}; // finish
			
			// use cached marketplace metadata, or fetch from origin if stale
			fs.stat( cache_file, function(err, stats) {
				if (err || (stats.mtimeMs / 1000 < Tools.timeNow() - marketplace.ttl)) {
					// fetch from origin
					self.logDebug(5, "Fetching marketplace metadata from origin: " + marketplace.metadata_url);
					self.request.json( marketplace.metadata_url, false, { retries: 8, retryDelay: 50 }, function(err, resp, metadata, perf) {
						if (err) return self.doError('marketplace', "Failed to fetch marketplace metadata: " + marketplace.metadata_url + ": " + err, callback);
						
						Tools.writeFileAtomic( cache_file, JSON.stringify(metadata), function(err) {
							if (err) return self.doError('marketplace', "Failed to write cache file: " + cache_file + ": " + err, callback);
							finish(metadata);
						}); // writeFileAtomic
					} ); // request.json
					return;
				} // err or stale
				
				// use cached file
				fs.readFile( cache_file, 'utf8', function(err, contents) {
					if (err) return self.doError('marketplace', "Failed to read cache file: " + cache_file + ": " + err, callback);
					var metadata = null;
					
					try { metadata = JSON.parse(contents); }
					catch (err) { return self.doError('marketplace', "Failed to parse cache file: " + cache_file + ": " + err, callback); }
					
					finish(metadata);
				} ); // fs.readFile
			} ); // fs.stat
		}); // loadSession
	}
	
	ws_search_job_files(args) {
		// websocket API endpoint, search inside job files
		// args: { socket, params }
		// params: { query, match, regex?, case?, offset?, max?, sort_by?, sort_dir?, loc }
		var self = this;
		var { socket, params } = args;
		var orig_loc = params.loc;
		var line_re = null;
		var num_results = 0;
		
		// make sure socket is synced with current user loc
		socket.loc.loc = orig_loc;
		
		// make sure user's regexp compiles
		try {
			line_re = new RegExp( params.regex ? params.match : Tools.escapeRegExp(params.match), (params.case ? '' : 'i') + 'g' );
		}
		catch (err) {
			this.logError('search', "Invalid regular expression: " + err);
			return;
		}
		
		// augment params with bits for logging
		params.socket_id = socket.id;
		params.username = socket.username;
		
		var sendUpdate = function(cmd, data) {
			// send page_update to our connected search page via ws
			socket.send( 'page_update', { page_cmd: cmd, page_data: data, loc: orig_loc } );
		};
		
		var processFile = function(job, file, opts, callback) {
			// search single job file
			var filename = Path.basename(file);
			
			self.storage.getStream( file, function(err, stream) {
				if (err) {
					self.logError('search', "Failed to open stream for job file search: " + file + ": " + err, params);
					return callback();
				}
				stream.on('error', function(err) {
					self.logError('search', "Storage stream error for job file search: " + file + ": " + err, params);
					if (callback) { callback(); callback = null; }
				});
				
				var rl = null;
				var preview = '';
				var count = 0;
				
				if (file.match(/\.gz$/i)) {
					// decompress in flight
					var gunzip = zlib.createGunzip();
					
					gunzip.on('error', function(err) {
						self.logError('search', "Decompression error for job file search: " + file + ": " + err, params);
						if (callback) { callback(); callback = null; }
					});
					
					stream.pipe(gunzip);
					rl = readline.createInterface({ input: gunzip, crlfDelay: Infinity });
				}
				else {
					// no decomp necessary
					rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
				}
				
				rl.on('error', function(err) { 
					self.logError('search', "Line reader error for job file search: " + file + ": " + err, params);
					if (callback) { callback(); callback = null; }
				} );
				
				rl.on('line', function(line) { 
					if (line.match(line_re)) {
						if (!preview) {
							preview = { before: RegExp.leftContext, matched: RegExp.lastMatch, after: RegExp.rightContext };
							if (preview.before.length > 25) preview.before = preview.before.substring(preview.before.length - 25);
							if (preview.after.length > 25) preview.after = preview.after.substring(0, 25);
						}
						count += [...line.matchAll(line_re)].length; // account for all matches in line
					}
				} );
				
				rl.on('close', function() { 
					// done with file
					if (count && !opts.done) {
						var token = Tools.digestBase64( 'download' + job.id + self.config.get('secret_key'), 'sha256', 16 );
						
						sendUpdate( 'search_result', { 
							id: opts.id, 
							job: job.id, 
							type: job.type || '',
							plugin: job.plugin || '',
							label: job.label || '',
							icon: job.icon || '',
							event: job.event, 
							completed: job.completed, 
							file, filename, preview, count, token 
						} );
						
						num_results++;
						if (params.max && (num_results >= params.max)) {
							opts.hit_max = true;
							opts.done = true;
						}
					}
					if (callback) { callback(); callback = null; }
				} );
			} ); // getStream
		}; // processFile
		
		var processLog = function(job, opts) {
			// process inline job log
			var lines = job.output.trim().split(/\r?\n/);
			var file = 'logs/jobs/' + job.id + '/log.txt'; // placeholder file
			var filename = Path.basename(file);
			var preview = '';
			var count = 0;
			
			self.logDebug(9, "Searching job log: " + job.id);
			
			lines.forEach( function(line) {
				if (line.match(line_re)) {
					if (!preview) {
						preview = { before: RegExp.leftContext, matched: RegExp.lastMatch, after: RegExp.rightContext };
						if (preview.before.length > 25) preview.before = preview.before.substring(preview.before.length - 25);
						if (preview.after.length > 25) preview.after = preview.after.substring(0, 25);
					}
					count += [...line.matchAll(line_re)].length; // account for all matches in line
				}
			} ); // foreach line
			
			if (count && !opts.done) {
				var token = Tools.digestBase64( 'download' + job.id + self.config.get('secret_key'), 'sha256', 16 );
				
				sendUpdate( 'search_result', { 
					id: opts.id, 
					job: job.id, 
					type: job.type || '',
					plugin: job.plugin || '',
					label: job.label || '',
					icon: job.icon || '',
					event: job.event, 
					completed: job.completed, 
					file, filename, preview, count, token 
				} );
				
				num_results++;
				if (params.max && (num_results >= params.max)) {
					opts.hit_max = true;
					opts.done = true;
				}
			}
		}; // processLog
		
		// start search job
		var opts = this.dbSearchUpdate({
			index: 'jobs',
			query: params.query || '*',
			offset: params.offset || 0,
			sort_by: params.sort_by || '_id',
			sort_dir: params.sort_dir || '-1',
			title: "Custom job file search",
			username: socket.username,
			threads: this.config.get('search_file_threads') || 1,
			quiet: true, // no notification or counter widget
			
			iterator: function(job, callback) {
				if (socket.disconnected) {
					self.logDebug(6, "Socket disconnected, aborting job file search", { socket: socket.id, user: socket.username, job: opts.id });
					opts.done = true;
					return process.nextTick(callback);
				} // socket dead
				
				if (socket.loc.loc != orig_loc) {
					self.logDebug(6, "User navigated away, aborting job file search", { socket: socket.id, user: socket.username, job: opts.id, loc: socket.loc.loc, orig_loc });
					opts.done = true;
					return process.nextTick(callback);
				} // socket dead
				
				// if job log is inline, process right away
				if (job.output) {
					processLog( job, opts );
					if (opts.done) return process.nextTick(callback);
				}
				
				// prep for processing files
				var files = [];
				var file_re = new RegExp( self.config.get('search_file_regex') || "\\.(txt|log|csv|tsv|xml|json)(\\.gz)?$", "i" );
				
				(job.files || []).forEach( function(file) {
					if (file.path.match(file_re)) files.push( file.path );
				} );
				
				if (job.log_file_size && !job.output) {
					files.push( 'logs/jobs/' + job.id + '/log.txt.gz' );
				}
				
				if (!files.length) return callback(null, false);
				self.logDebug(9, "Searching job files: " + job.id, files);
				
				// process files in series as we're already parallelized in this iterator
				async.eachSeries( files, 
					function(file, callback) {
						if (opts.done) return process.nextTick(callback);
						processFile( job, file, opts, callback );
					},
					function() {
						callback(null, false);
					}
				); // eachSeries
			}, // iterator
			
			callback: function(err) {
				// all done
				self.logDebug(9, "Job file search is complete", params);
				sendUpdate('search_complete', { id: opts.id, offset: opts.offset + opts.icount, hit_max: !!opts.hit_max });
			} // callback
		}); // dbSearchUpdate
		
		params.job_id = opts.id;
		this.logDebug(9, "Started job file search", params);
		
		// send opts.id to client
		sendUpdate('search_started', { id: opts.id });
	}
	
}; // class Search

module.exports = Search;
