// xyOps API Layer - File upload (attachments) and viewing
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const assert = require("assert");
const Path = require('path');
const os = require('os');
const async = require('async');
const mime = require('mime');
const Tools = require("pixl-tools");

class FileManagement {
	
	api_upload_files(args, callback) {
		// upload file for user
		var self = this;
		var files = Tools.hashValuesToArray(args.files || {});
		var urls = [];
		// var dargs = Tools.getDateArgs( Tools.timeNow() );
		var exp_epoch = Tools.timeNow(true) + Tools.getSecondsFromText( this.config.get('file_expiration') );
		if (!this.requireMaster(args, callback)) return;
		
		if (!files.length) {
			return this.doError('file', "No file upload data found in request.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var storage_key_prefix = 'files/' + user.username;
			
			async.eachSeries( files,
				function(file, callback) {
					// process single file upload
					var temp_file = file.path;
					var filename = Path.basename(file.name).replace(/[^\w\-\.]+/g, '_');
					var storage_key = storage_key_prefix + '/' + filename;
					var url = self.server.config.get('base_app_url') + '/' + storage_key;
					
					self.storage.putStream( storage_key, fs.createReadStream(temp_file), function(err) {
						if (err) return callback(err);
						urls.push( url );
						
						// set expiration date for file (fires off background task)
						self.storage.expire( storage_key, exp_epoch );
						
						callback();
					} ); // putStream
				},
				function(err) {
					if (err) return self.doError('file', "Failed to process uploaded file: " + err, callback);
					callback({ code: 0, urls: urls });
				}
			); // async.eachSeries
		} ); // loaded session
	}
	
	api_upload_job_file(args, callback) {
		// upload arbitrary file and associate with job -- this API is used by satellite
		// 3 methods of auth: api_key, server id + secret hash, or job id + secret hash
		var self = this;
		var params = args.params;
		
		if (!this.requireMaster(args, callback)) return;
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/,
			auth: /^\w+$/
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
			
			var job = self.activeJobs[params.id];
			if (!job) return self.doError('job', "Job not found: " + params.id, callback);
			
			var file = args.files.file1;
			if (!file) return self.doError('job', "File upload data not found", callback);
			
			var storage_key_prefix = 'files/jobs/' + job.id + '/' + Tools.generateUniqueBase64(32);
			var temp_file = file.path;
			var filename = Path.basename(file.name).replace(/[^\w\-\.]+/g, '_').toLowerCase();
			var storage_key = storage_key_prefix + '/' + filename;
			
			// storage key must have a file extension to be considered binary
			if (!self.storage.isBinaryKey(storage_key)) storage_key += '.bin';
			
			self.logDebug(7, "Uploading job file", { params, file, storage_key });
			
			self.storage.putStream( storage_key, fs.createReadStream(temp_file), function(err) {
				if (err) self.doError('file', "Failed to process uploaded file: " + err, callback);
				
				self.logDebug(9, "Job file stored successfully: " + storage_key);
				
				callback({ code: 0, key: storage_key, size: file.size });
			} ); // putStream
		}); // loadSession
	}
	
	api_delete_job_file(args, callback) {
		// delete file from job
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/,
			path: /.+/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_jobs', callback)) return;
			
			args.user = user;
			args.session = session;
			
			// load job from storage
			self.unbase.get( 'jobs', params.id, function(err, job) {
				if (err) return self.doError('job', "Failed to load job details: " + params.id + ": " + err, callback);
				
				if (!self.requireCategoryPrivilege(user, job.category, callback)) return;
				if (!self.requireTargetPrivilege(user, job.targets, callback)) return;
				
				if (!job.files) job.files = [];
				if (!Tools.deleteObject(job.files, { path: params.path })) {
					return self.doError('job', "Job file not found: " + Path.basename(params.path), callback);
				}
				
				// update the DB in the background
				self.unbase.insert( 'jobs', job.id, job );
				
				// delete the file itself
				self.storage.delete( params.path, function(err) {
					if (err) return self.doError('job', "Failed to delete job file: " + params.path + ": " + err, callback);
					
					self.logTransaction('job_delete_file', job.id, self.getClientInfo(args, params));
					callback({ code: 0 });
					
				}); // storage.delete
			}); // unbase.get
		}); // loadSession
	}
	
	api_upload_job_input_files(args, callback) {
		// upload files for job BEFORE job is started (i.e. from run event dialog)
		var self = this;
		var exp_epoch = Tools.timeNow(true) + Tools.getSecondsFromText( this.config.getPath('client.job_upload_settings.user_file_expiration') );
		if (!this.requireMaster(args, callback)) return;
		
		if (!args.files || !Tools.firstKey(args.files)) {
			return this.doError('file', "No file upload data found in request.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'run_jobs', callback)) return;
			
			var storage_key_prefix = 'files/' + (user.username || user.id) + '/' + Tools.generateUniqueBase64(32);
			var files = [];
			
			async.eachSeries( Object.values(args.files),
				function(file, callback) {
					// process single file upload
					var temp_file = file.path;
					var filename = self.cleanFilename( Path.basename(file.name) );
					var url_filename = self.cleanURLFilename( Path.basename(file.name) );
					var storage_key = storage_key_prefix + '/' + url_filename;
					
					// storage key must have a file extension to be considered binary
					if (!self.storage.isBinaryKey(storage_key)) storage_key += '.bin';
					
					self.storage.putStream( storage_key, fs.createReadStream(temp_file), function(err) {
						if (err) return callback(err);
						
						files.push({
							id: Tools.generateShortID('f'),
							date: Tools.timeNow(true),
							filename: filename, 
							path: storage_key, 
							size: file.size,
							username: user.username || user.id
						});
						
						// set expiration date for file (fires off background task)
						self.storage.expire( storage_key, exp_epoch );
						
						callback();
					} ); // putStream
				},
				function(err) {
					if (err) return self.doError('file', "Failed to process uploaded files: " + err, callback);
					callback({ code: 0, files: files });
				}
			); // async.eachSeries
		} ); // loaded session
	}
	
	api_file(args, callback) {
		// view file for specified user on URI: /files/2018/04/15/myimage.jpg
		var self = this;
		var storage_key = '';
		if (!this.requireMaster(args, callback)) return;
		
		if (args.query.path) {
			storage_key = 'files/' + args.query.path;
		}
		else if (args.request.url.replace(/\?.*$/, '').match(/files?\/(.+)$/)) {
			storage_key = 'files/' + RegExp.$1;
		}
		else {
			return callback( "400 Bad Request", {}, null );
		}
		
		// handle HTTP HEAD separately
		if (args.request.method == 'HEAD') {
			return this.handle_file_head(args, storage_key, callback);
		}
		
		// handle Range requests separately
		if (args.request.headers['range']) {
			return this.handle_file_range(args, storage_key, callback);
		}
		
		// standard full stream
		this.storage.getStream( storage_key, function(err, stream, info) {
			if (err) {
				if (err.code == "NoSuchKey") return callback( "404 Not Found", {}, '' + err );
				else {
					self.logError('storage', "Unexpected storage getStream error: " + err, err);
					return callback( "500 Internal Server Error", {}, '' + err );
				}
			}
			
			// conditional get
			const file_mtime = info.mod;
			const file_etag = JSON.stringify([info.len, info.mod].join('-'));
			const req_etag = args.request.headers['if-none-match'];
			const req_mtime = Date.parse( args.request.headers['if-modified-since'] ) / 1000;
			
			if ((req_mtime || req_etag) && (!req_etag || (req_etag === file_etag)) && (!req_mtime || (req_mtime >= file_mtime))) {
				// file has not changed, send back 304
				stream.destroy();
				return callback( "304 Not Modified", {}, "" );
			}
			
			var headers = {
				"Etag": file_etag,
				"Content-Type": mime.getType( Path.basename(storage_key) ) || 'application/octet-stream',
				"Content-Length": info.len,
				"Last-Modified": (new Date(info.mod * 1000)).toUTCString(),
				"Cache-Control": "public, max-age=0"
			};
			
			// security: if content type is or contains text/html, always download
			if (headers['Content-Type'].match(/\b(text\/html)\b/) && !args.query.download) args.query.download = "1";
			
			if (args.query.download) {
				var filename = (args.query.download == "1") ? Path.basename(storage_key) : args.query.download;
				headers['Content-Disposition'] = 'attachment; filename="' + filename + '"';
			}
			
			callback( "200 OK", headers, stream );
		} ); // getStream
	}
	
	handle_file_range(args, storage_key, callback) {
		// handle HTTP Range requests
		var self = this;
		
		if (!args.request.headers['range'].trim().match(/^bytes=(\d*)\-(\d*)$/i)) {
			return callback( "416 Requested Range Not Satisfiable", {}, "" );
		}
		var from = RegExp.$1;
		var to = RegExp.$2;
		
		this.storage.getStreamRange( storage_key, parseInt(from), parseInt(to), function(err, stream, info) {
			if (err) {
				if (err.code == "NoSuchKey") {
					return callback( "404 Not Found", {}, '' + err );
				}
				else if ((err.code == "InvalidRange") || err.toString().match(/invalid byte range/i)) {
					return callback( "416 Requested Range Not Satisfiable", {}, '' + err );
				}
				else {
					return callback( "500 Internal Server Error", {}, '' + err );
				}
			}
			
			// conditional get
			const file_mtime = info.mod;
			const file_etag = JSON.stringify([info.len, info.mod].join('-'));
			const req_etag = args.request.headers['if-none-match'];
			const req_mtime = Date.parse( args.request.headers['if-modified-since'] ) / 1000;
			
			if ((req_mtime || req_etag) && (!req_etag || (req_etag === file_etag)) && (!req_mtime || (req_mtime >= file_mtime))) {
				// file has not changed, send back 304
				stream.destroy();
				return callback( "304 Not Modified", {}, "" );
			}
			
			if (!info.cr) {
				if (!to) to = (info.len - parseInt(from)) - 1;
				info.cr = "bytes " + from + '-' + to + '/' + info.len;
			}
			
			var headers = {
				"Etag": file_etag,
				"Content-Type": mime.getType( Path.basename(storage_key) ) || 'application/octet-stream',
				// "Content-Length": info.len,
				"Content-Range": info.cr,
				"Last-Modified": (new Date(info.mod * 1000)).toUTCString(),
				"Cache-Control": "public, max-age=0"
			};
			
			// add content-length using data from content-range header
			if (info.cr && info.cr.toString().match(/bytes\s+(\d+)\-(\d+)/)) {
				var afrom = RegExp.$1, ato = RegExp.$2;
				afrom = parseInt(afrom); ato = parseInt(ato);
				headers['Content-Length'] = '' + Math.floor( (ato - afrom) + 1 );
			}
			
			callback( "206 Partial Content", headers, stream );
		} ); // getStream
	}
	
	handle_file_head(args, storage_key, callback) {
		// handle HTTP HEAD on static view
		var self = this;
		
		this.storage.head( storage_key, function(err, info) {
			if (err) {
				if (err.code == "NoSuchKey") return callback( "404 Not Found", {}, '' + err );
				else return callback( "500 Internal Server Error", {}, '' + err );
			}
			
			// conditional get
			const file_mtime = info.mod;
			const file_etag = JSON.stringify([info.len, info.mod].join('-'));
			const req_etag = args.request.headers['if-none-match'];
			const req_mtime = Date.parse( args.request.headers['if-modified-since'] ) / 1000;
			
			if ((req_mtime || req_etag) && (!req_etag || (req_etag === file_etag)) && (!req_mtime || (req_mtime >= file_mtime))) {
				// file has not changed, send back 304
				return callback( "304 Not Modified", {}, "" );
			}
			
			var headers = {
				"Etag": file_etag,
				"Content-Type": mime.getType( Path.basename(storage_key) ) || 'application/octet-stream',
				"Content-Length": info.len,
				"Last-Modified": (new Date(info.mod * 1000)).toUTCString(),
				"Cache-Control": "public, max-age=0"
			};
			
			callback( "200 OK", headers, "" );
		} ); // head
	}
	
}; // class FileManagement

module.exports = FileManagement;
