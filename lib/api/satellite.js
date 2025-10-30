// xyOps API Layer - Satellite Install Utilities
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class Satellite {
	
	api_get_satellite_token(args, callback) {
		// generate time-based satellite install token
		var self = this;
		var params = args.params;
		var sat = this.config.get('satellite');
		if (!this.requireMaster(args, callback)) return;
		
		// pull out expires, and delete from params
		var expires = params.expires || 86400;
		delete params.expires;
		
		// if group is zero length, pull it out
		if (params.groups && !params.groups.length) delete params.groups;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			var token = Tools.generateUniqueID();
			
			self.transferTokens[token] = {
				id: token,
				type: 'satellite',
				params: params,
				expires: Tools.timeNow(true) + expires
			};
			
			self.logDebug(9, "Generated satellite install token: " + token, params);
			
			// generate base url for satellite install
			var base_url = '';
			if (sat.config.secure) {
				base_url = 'https://' + self.hostID;
				if (self.web.config.get('https_port') != 443) base_url += ':' + self.web.config.get('https_port');
			}
			else {
				base_url = 'http://' + self.hostID;
				if (self.web.config.get('port') != 80) base_url += ':' + self.web.config.get('port');
			}
			
			callback({ code: 0, token, base_url });	
		} ); // loaded session
	}
	
	api_get_satellite_releases(args, callback) {
		// get list of avaialble satellite versions to install
		var self = this;
		var sat = this.config.get('satellite');
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			// fetch actual list from source (usually github)
			self.request.json( sat.list_url, false, function(err, resp, data, perf) {
				if (err) {
					if (self.config.getPath('airgap.enabled') && sat.bucket) {
						// return canned list for airgap mode
						return callback({ code: 0, releases: ['airgap'] });
					}
					else return self.doError('satellite', "Failed to fetch satellite release list: " + err, callback);
				}
				
				var releases = ['latest'].concat( data.map( function(release) { return release.tag_name; } ) );
				callback({ code: 0, releases: releases });
			} ); // request.json
		}); // loadSession
	}
	
	api_satellite(args, callback) {
		// main entrypoint for satellite related install requests
		var self = this;
		var query = args.query;
		
		if (!this.requireMaster(args, callback)) return;
		if (!this.requireParams(query, {
			t: /^\w+$/
		}, callback)) return;
		
		// token may be an API KEY, so copy token into params
		args.params.api_key = query.t;
		
		this.loadSession(args, function(err, session, user) {
			if (err) {
				// not an api key, so fallback to token check
				var token = self.transferTokens[query.t];
				if (!token || (token.type != 'satellite')) {
					// allow server auth tokens as well (server must be live or recently live)
					if (query.s && (self.servers[query.s] || self.serverCache[query.s])) {
						var correct_token = Tools.digestHex( query.s + self.config.get('secret_key'), 'sha256' );
						if (query.t === correct_token) {
							// authed successfully via server token
							token = null;
						}
						else return self.doError('satellite', "Access denied.", callback); // deliberately vague
					}
					else {
						return self.doError('satellite', "Access denied.", callback); // deliberately vague
					}
				}
				
				// save token in args for later use
				args.transferToken = token;
			}
			else {
				// loaded via api key, but it MUST be an admin key!
				if (!self.requireAdmin(session, user, callback)) return;
			}
			
			// continue with satellite install
			if (!args.request.url.match(/\/satellite\/(\w+)/)) {
				return self.doError('satellite', "Invalid satellite API URL.", callback);
			}
			
			var func = 'fetch_satellite_' + RegExp.$1;
			if (!self[func]) return self.doError('satellite', "Invalid satellite API method.", callback);
			
			self[func]( args, callback );
		}); // loaded session
	}
	
	fetch_satellite_install(args, callback) {
		// get satellite install script
		var self = this;
		var sat = this.config.get('satellite');
		var filename = (args.query.os == 'windows') ? 'sat-install.ps1' : 'sat-install.sh';
		
		this.logDebug(9, "Fetching satellite install script: " + filename, args.query);
		
		// allow extra query params to augment initial config
		if (args.transferToken) {
			var extra_params = Tools.copyHashRemoveKeys(args.query, { t:1, os:1 });
			if (Tools.numKeys(extra_params)) {
				this.logDebug(9, "Merging extra params into initial server setup", extra_params);
				Tools.mergeHashInto( args.transferToken.params, extra_params );
			}
		}
		
		// Linux/macOS: curl -s https://XYOPS/api/app/satellite/install?t=123456 | sudo sh
		// Windows: powershell -Command "IEX (New-Object Net.WebClient).DownloadString('https://XYOPS/api/app/satellite/install?t=123456&os=windows')"
		
		fs.readFile( `internal/${filename}`, 'utf8', function(err, template) {
			if (err) return self.doError('satellite', "Failed to load satellite script: " + err, callback);
			
			var script = Tools.sub( template, {
				auth_token: args.query.t,
				base_url: self.web.getSelfURL(args.request).replace(/\/$/, '')
			} );
			
			callback( "200 OK", { 'Content-Type': "text/plain" }, script );
		}); // fs.readFile
	}
	
	fetch_satellite_upgrade(args, callback) {
		// get satellite upgrade script
		var self = this;
		var sat = this.config.get('satellite');
		var filename = (args.query.os == 'windows') ? 'sat-upgrade.ps1' : 'sat-upgrade.sh';
		
		if (!this.requireParams(args.query, {
			s: /^\w+$/ // server id required
		}, callback)) return;
		
		this.logDebug(9, "Fetching satellite upgrade script: " + filename, args.query);
		
		fs.readFile( `internal/${filename}`, 'utf8', function(err, template) {
			if (err) return self.doError('satellite', "Failed to load satellite script: " + err, callback);
			
			var script = Tools.sub( template, {
				server_id: args.query.s,
				auth_token: args.query.t,
				base_url: self.web.getSelfURL(args.request).replace(/\/$/, '')
			} );
			
			callback( "200 OK", { 'Content-Type': "text/plain" }, script );
		}); // fs.readFile
	}
	
	fetch_satellite_core(args, callback) {
		// get satellite core install bundle
		var self = this;
		var query = args.query;
		var sat = this.config.get('satellite');
		
		if (!this.requireParams(query, {
			os: /^\w+$/,
			arch: /^\w+$/
		}, callback)) return;
		
		var filename = `satellite-${query.os}-${query.arch}.tar.gz`;
		var storage_key = `satellite/${sat.version}/${filename}`;
		
		this.logDebug(9, "Fetching local satellite core: " + storage_key);
		
		// optionally use storage bucket (i.e. for airgap)
		if (sat.bucket) {
			this.storage.get( `buckets/${sat.bucket}/files`, function(err, files) {
				if (err) return callback( "404 Not Found", {}, "Bucket files not found for fetching Satellite core: " + sat.bucket );
				
				var file = Tools.findObject( files, { filename } );
				if (!file) return callback( "404 Not Found", {}, "Bucket file not found for fetching Satellite core: " + sat.bucket + '/' + filename );
				
				self.logDebug(9, "Using file from bucket: " + file.path, { file, bucket: sat.bucket } );
				
				self.storage.getStream( file.path, function(err, stream) {
					if (err) return self.doError('satellite', "Failed to fetch satellite core from bucket: " + err, callback);
					
					callback( "200 OK", { 'Content-Type': "application/gzip" }, stream );
				} ); // storage.getStream
			} ); // storage.get
			return;
		} // sat.bucket
		
		// check if we have this in cache
		this.storage.lock( storage_key, true, function() {
			self.storage.head( storage_key, function(err, info) {
				if (!err && info) {
					// found in cache, stream it back
					self.logDebug(9, "Found satellite core in cache: " + storage_key, info);
					
					if (info.mod >= Tools.timeNow(true) - sat.cache_ttl) {
						self.logDebug(9, "Using cached version (still fresh)");
						
						self.storage.getStream( storage_key, function(err, stream) {
							self.storage.unlock( storage_key );
							if (err) return self.doError('satellite', "Failed to fetch satellite core from cache: " + err, callback);
							
							callback( "200 OK", { 'Content-Type': "application/gzip" }, stream );
						} ); // getStream
						
						return;
					}
					else {
						self.logDebug(9, "Cached version has expired, will fetch from upstream");
					}
				}
				
				// not in cache or expired, fetch it from upstream
				var url = sat.base_url;
				if (sat.version == 'latest') url += `/latest/download/${filename}`;
				else url += `/download/v${sat.version}/${filename}`;
				
				var temp_file = self.config.get('temp_dir') + '/satellite-temp-' + Tools.generateUniqueID() + '.tar.gz';
				var fetch_opts = {
					download: temp_file
				};
				
				self.logDebug(9, "Fetching satellite core from upstream: " + url);
				
				self.request.get( url, fetch_opts, function(err, resp, data, perf) {
					if (err) {
						fs.unlink( temp_file, function() {} ); // just in case
						self.storage.unlock( storage_key );
						return self.doError('satellite', "Failed to fetch satellite core from upstream: " + err, callback);
					}
					
					// stream the temp file back to save time
					callback( "200 OK", { 'Content-Type': "application/gzip" }, fs.createReadStream(temp_file) );
					
					self.logDebug(9, "Storing satellite core in cache: " + storage_key);
					
					// save in storage cache
					self.storage.putStream( storage_key, fs.createReadStream(temp_file), function(err) {
						self.storage.unlock( storage_key );
						
						fs.unlink( temp_file, function(err) {
							if (err) self.logError( "Failed to delete temp file: " + temp_file + ": " + err );
						} ); // fs.unlink
						
						if (err) {
							return self.doError('satellite', "Failed to store satellite core in cache: " + err, callback);
						}
					}); // putStream
				}); // request.get
			}); // storage.head
		}); // storage.lock
	}
	
	fetch_satellite_config(args, callback) {
		// get satellite config file
		var self = this;
		var sat = this.config.get('satellite');
		var sconfig = Tools.copyHash( sat.config, true );
		
		// add in airgap settings
		if (!sconfig.airgap) sconfig.airgap = this.config.get('airgap');
		
		// optionally allow original token request to augment config (e.g. groups)
		if (args.transferToken && args.transferToken.params && Tools.numKeys(args.transferToken.params)) {
			sconfig.initial = args.transferToken.params;
		}
		
		// populate master hosts
		// (only use current master for initial setup -- sat will receive full peer list after auth handshake)
		sconfig.hosts = [ this.hostID ];
		sconfig.port = this.web.config.get( sat.config.secure ? 'https_port' : 'port' );
		
		// generate server id and auth token
		sconfig.server_id = Tools.generateShortID('s');
		sconfig.auth_token = Tools.digestHex( sconfig.server_id + this.config.get('secret_key'), 'sha256' );
		
		this.logDebug(9, "Generated satellite config: " + sconfig.server_id, sconfig);
		
		callback( "200 OK", { 'Content-Type': "application/json" }, JSON.stringify(sconfig, null, "\t") + "\n" );
	}
	
}; // class Satellite

module.exports = Satellite;
