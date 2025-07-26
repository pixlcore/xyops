// Orchestra API Layer - File upload (attachments) and viewing
// Copyright (c) 2021 - 2024 Joseph Huckaby
// Released under the MIT License

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
		// upload arbitrary user file and associate with job
		// 3 methods of auth: api_key, server id + secret hash, or job id + secret hash
		var self = this;
		var params = args.params;
		
		if (!this.requireMaster(args, callback)) return;
		if (!this.requireParams(params, {
			id: /^\w+$/,
			auth: /^\w+$/
		}, callback)) return;
		
		// token may be an API KEY, so copy token into params
		params.api_key = params.auth;
		
		this.loadSession(args, function(err, session, user) {
			if (err) {
				// not an api key, so fallback to token check
				if (params.server) {
					// method A: satellite has perma-token based on its server ID
					var correct_token = Tools.digestHex( params.server + self.config.get('secret_key'), 'sha256' );
					if (params.auth != correct_token) return self.doError('auth', "Authentication failure", callback);
					
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
			
			var storage_key_prefix = 'files/jobs/' + job.id + '/' + Tools.generateUniqueBase64(16);
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
			id: /^\w+$/,
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
		
		this.storage.getStream( storage_key, function(err, stream) {
			if (err) {
				if (err.code == "NoSuchKey") return callback( false ); // this allows fallback to local filesystem!
				else return callback( "500 Internal Server Error", {}, '' + err );
			}
			
			var headers = {
				"Content-Type": mime.getType( Path.basename(storage_key) ) || 'application/octet-stream',
				"Cache-Control": "public, max-age=" + self.web.config.get('http_static_ttl')
			};
			if (args.query.download) {
				var filename = (args.query.download === "1") ? Path.basename(storage_key) : args.query.download;
				headers['Content-Disposition'] = 'attachment; filename="' + filename + '"';
			}
			
			callback( "200 OK", headers, stream );
		} ); // getStream
	}
	
}; // class FileManagement

module.exports = FileManagement;
