// xyOps API Layer - Data Storage Buckets
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const Path = require('path');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class Buckets {
	
	api_get_buckets(args, callback) {
		// get list of all buckets
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			// return items and list header
			callback({
				code: 0,
				rows: self.buckets,
				list: { length: self.buckets.length }
			});
			
		} ); // loaded session
	}
	
	api_get_bucket(args, callback) {
		// get single bucket for editing (inc. data and file list)
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var bucket = Tools.findObject( self.buckets, { id: params.id } );
			if (!bucket) return self.doError('bucket', "Bucket not found: " + params.id, callback);
			
			var bucket_path = 'buckets/' + bucket.id;
			
			self.storage.getMulti( [ bucket_path + '/data', bucket_path + '/files' ], function(err, values) {
				if (err) {
					return self.doError('bucket', "Failed to locate bucket data: " + params.id, callback);
				}
				var [ data, files ] = values;
				
				// success, return all data
				callback({ code: 0, bucket, data, files });
			} ); // got bucket
		} ); // loaded session
	}
	
	api_create_bucket(args, callback) {
		// add new bucket
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		// auto-generate unique ID if not specified
		if (!params.id) params.id = Tools.generateShortID('b');
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/,
			title: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_buckets', callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username || user.id;
			params.created = params.modified = Tools.timeNow(true);
			params.revision = 1;
			
			// bucket id must be unique
			if (Tools.findObject(self.buckets, { id: params.id })) {
				return self.doError('bucket', "That Bucket ID already exists: " + params.id, callback);
			}
			
			// separate data/files into separate record
			var bucket_path = 'buckets/' + params.id;
			var records = {};
			records[ bucket_path + '/data' ] = params.data || {};
			records[ bucket_path + '/files' ] = params.files || [];
			delete params.data;
			delete params.files;
			
			self.logDebug(6, "Creating new bucket: " + params.title, params);
			
			// first write data/files
			self.storage.putMulti( records, function(err) {
				if (err) {
					return self.doError('bucket', "Failed to create bucket: " + err, callback);
				}
				
				// now push bucket record
				self.storage.listPush( 'global/buckets', params, function(err) {
					if (err) {
						return self.doError('bucket', "Failed to create bucket: " + err, callback);
					}
					
					self.logDebug(6, "Successfully created bucket: " + params.title, params);
					self.logTransaction('bucket_create', params.title, self.getClientInfo(args, { bucket: params, keywords: [ params.id ] }));
					
					// update cache
					self.buckets.push( params );
					
					// send api response
					callback({ code: 0, bucket: params });
					
					// update all users
					self.doUserBroadcastAll('update', { buckets: self.buckets });
				} ); // storage.listPush
			} ); // storage.put
		} ); // loadSession
	}
	
	api_update_bucket(args, callback) {
		// update existing bucket
		// optional data/files can be in tow
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_buckets', callback)) return;
			
			args.user = user;
			args.session = session;
			
			var bucket = Tools.findObject(self.buckets, { id: params.id });
			if (!bucket) {
				return self.doError('bucket', "Bucket not found: " + params.id, callback);
			}
			
			params.modified = Tools.timeNow(true);
			params.revision = "+1";
			
			// separate data/files into separate record
			var bucket_path = 'buckets/' + params.id;
			var records = {};
			if (params.data) records[ bucket_path + '/data' ] = params.data;
			if (params.files) records[ bucket_path + '/files' ] = params.files;
			delete params.data;
			delete params.files;
			
			self.logDebug(6, "Updating bucket: " + params.id, params);
			
			// first write data/files
			self.storage.putMulti( records, function(err) {
				if (err) {
					return self.doError('bucket', "Failed to create bucket: " + err, callback);
				}
				
				self.storage.listFindUpdate( 'global/buckets', { id: params.id }, params, function(err, bucket) {
					if (err) {
						return self.doError('bucket', "Failed to update bucket: " + err, callback);
					}
					
					self.logDebug(6, "Successfully updated bucket: " + bucket.title, params);
					self.logTransaction('bucket_update', bucket.title, self.getClientInfo(args, { bucket: bucket, keywords: [ params.id ] }));
					
					// update cache
					var mem_bucket = Tools.findObject( self.buckets, { id: params.id } ) || {};
					Tools.mergeHashInto( mem_bucket, bucket );
					
					// send api response
					callback({ code: 0 });
					
					// update all users
					self.doUserBroadcastAll('update', { buckets: self.buckets });
				} ); // listFindUpdate
			} ); // storage.put
		} ); // loadSession
	}
	
	api_delete_bucket(args, callback) {
		// delete existing bucket, including all data and files
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_buckets', callback)) return;
			
			args.user = user;
			args.session = session;
			
			var bucket = Tools.findObject(self.buckets, { id: params.id });
			if (!bucket) {
				return self.doError('bucket', "Bucket not found: " + params.id, callback);
			}
			
			self.logDebug(6, "Deleting bucket: " + params.id, params);
			
			var bucket_path = 'buckets/' + params.id;
			var bucket_files = null;
			
			async.series([
				function(callback) {
					// lock bucket
					self.storage.lock( bucket_path, true, callback );
				},
				function(callback) {
					// load bucket files
					self.storage.get( bucket_path + '/files', function(err, files) {
						if (err) return callback(err);
						bucket_files = files;
						callback();
					} );
				},
				function(callback) {
					// delete all files
					async.eachSeries( bucket_files,
						function(file, callback) {
							self.logDebug(7, "Deleting bucket file: " + file.path, file);
							self.storage.delete( file.path, callback );
						},
						callback
					); // eachSeries
				},
				function(callback) {
					// delete bucket files
					self.logDebug(7, "Deleting bucket files: " + params.id);
					self.storage.delete( bucket_path + '/files', callback );
				},
				function(callback) {
					// delete bucket data
					self.logDebug(7, "Deleting bucket data: " + params.id);
					self.storage.delete( bucket_path + '/data', callback );
				},
				function(callback) {
					// delete bucket index
					self.logDebug(7, "Deleting bucket master record: " + params.id );
					self.storage.listFindDelete( 'global/buckets', { id: params.id }, callback );
				}
			],
			function(err) {
				self.storage.unlock( bucket_path );
				if (err) {
					return self.doError('bucket', "Failed to delete bucket: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted bucket: " + bucket.title, bucket);
				self.logTransaction('bucket_delete', bucket.title, self.getClientInfo(args, { bucket: bucket, keywords: [ params.id ] }));
				
				// update cache
				Tools.deleteObject( self.buckets, { id: params.id } );
				
				// send api response
				callback({ code: 0 });
				
				// update all users
				self.doUserBroadcastAll('update', { buckets: self.buckets });
			}); // async.series
		} ); // loadSession
	}
	
	api_write_bucket_data(args, callback) {
		// write bucket data, safely with locks, and without updating bucket itself
		// note: data is shallow-merged
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_buckets', callback)) return;
			
			args.user = user;
			args.session = session;
			
			var bucket = Tools.findObject(self.buckets, { id: params.id });
			if (!bucket) {
				return self.doError('bucket', "Bucket not found: " + params.id, callback);
			}
			
			var bucket_path = 'buckets/' + bucket.id;
			var bucket_data = null;
			
			// read and write using locking
			self.logDebug(6, "Merging data into storage bucket: " + bucket.id, params);
			
			async.series([
				function(callback) {
					// lock bucket
					self.storage.lock( bucket_path, true, callback );
				},
				function(callback) {
					// load bucket data
					self.storage.get( bucket_path + '/data', function(err, data) {
						if (err) return callback(err);
						bucket_data = data;
						callback();
					} );
				},
				function(callback) {
					// shallow-merge data and save
					Tools.mergeHashInto( bucket_data, params.data || {} );
					
					// write data back to storage
					self.storage.put( bucket_path + '/data', bucket_data, callback );
				}
			],
			function(err) {
				// all done
				self.storage.unlock( bucket_path );
				if (err) return self.doError('bucket', "Failed to store data in bucket: " + (err.message || err), callback);
				
				// return success
				callback({ code: 0, data: params.fetch ? bucket_data : null });
			});
		} ); // loadSession
	}
	
	api_upload_bucket_files(args, callback) {
		// upload one or more files to storage bucket
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		var files = Tools.hashValuesToArray(args.files || {});
		
		// support both `id` and `bucket` names for backward compat
		if (!params.id && params.bucket) { params.id = params.bucket; delete params.bucket; }
		
		if (!this.requireMaster(args, callback)) return;
		if (!this.validateFiles(args, callback)) return;
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		if (!files.length) {
			return this.doError('bucket', "No file upload data found in request.", callback);
		}
		
		var largest_file_size = Math.max.apply( Math, files.map( function(file) { return file.size; } ) );
		if (largest_file_size > this.config.getPath('client.bucket_upload_settings.max_file_size')) {
			return this.doError('bucket', "One or more of the files exceed the maximum allowed bucket file size.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_buckets', callback)) return;
			
			var bucket = Tools.findObject( self.buckets, { id: params.id } );
			if (!bucket) return self.doError('bucket', "Bucket not found: " + params.id, callback);
			
			var bucket_path = 'buckets/' + bucket.id;
			var storage_key_prefix = 'files/bucket/' + bucket.id;
			
			self.storage.lock( bucket_path, true, function() {
				self.storage.get( bucket_path + '/files', function(err, bucket_files) {
					if (err) {
						self.storage.unlock( bucket_path );
						return self.doError('bucket', "Bucket data not found: " + bucket.id, callback);
					}
					
					async.eachSeries( files,
						function(file, callback) {
							// process single file upload
							var temp_file = file.path;
							var filename = self.cleanFilename( Path.basename(file.name) );
							var url_filename = self.cleanURLFilename( Path.basename(file.name) );
							var storage_key = '';
							
							var stub = Tools.findObject( bucket_files, { filename } );
							if (!stub && (bucket_files.length >= self.config.getPath('client.bucket_upload_settings.max_files_per_bucket'))) {
								// FUTURE: This may leave a mess in storage, as it could be a partial success situation
								return callback( new Error("The bucket has reached its maximum number of allowed files.") );
							}
							
							if (stub) {
								// replacing existing file, inherit same storage key
								storage_key = stub.path;
							}
							else {
								// adding new file, generate new random key
								storage_key = storage_key_prefix + '/' + Tools.generateUniqueBase64(32) + '/' + url_filename;
								
								// storage key must have a file extension to be considered binary
								if (!self.storage.isBinaryKey(storage_key)) storage_key += '.bin';
							}
							
							self.storage.putStream( storage_key, fs.createReadStream(temp_file), function(err) {
								if (err) return callback(err);
								
								if (stub) {
									// replace existing file
									stub.date = Tools.timeNow(true);
									stub.size = file.size;
									stub.username = user.username || user.id;
									delete stub.server;
									delete stub.job;
									self.logDebug(7, "Replacing file in bucket: " + bucket.id, stub);
								}
								else {
									// add new file
									stub = {
										id: Tools.generateShortID('f'),
										date: Tools.timeNow(true),
										filename: filename, 
										path: storage_key, 
										size: file.size,
										username: user.username || user.id
									};
									bucket_files.push(stub);
									self.logDebug(7, "Adding new file to bucket: " + bucket.id, stub);
								}
								
								callback();
							} ); // putStream
						},
						function(err) {
							if (err) {
								self.storage.unlock( bucket_path );
								return self.doError('bucket', "Failed to process uploaded files: " + err, callback);
							}
							
							// save files record and unlock
							self.storage.put( bucket_path + '/files', bucket_files, function(err) {
								self.storage.unlock( bucket_path );
								if (err) return self.doError('bucket', "Failed to save bucket data: " + err, callback);
								
								callback({ code: 0, files: bucket_files });
							} ); // storage.put
						}
					); // async.eachSeries
				} ); // storage.get
			} ); // storage.lock
		} ); // loaded session
	}
	
	api_delete_bucket_file(args, callback) {
		// delete one file from storage bucket
		var self = this;
		var params = args.params;
		
		if (!this.requireMaster(args, callback)) return;
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		var criteria = Tools.copyHashRemoveKeys( params, { id: 1 } );
		if (!Tools.numKeys(criteria)) {
			return this.doError('bucket', "No criteria specified to locate file.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_buckets', callback)) return;
			
			var bucket = Tools.findObject( self.buckets, { id: params.id } );
			if (!bucket) return self.doError('bucket', "Bucket not found: " + params.id, callback);
			
			var bucket_path = 'buckets/' + bucket.id;
			var bucket_files = null;
			
			async.series([
				function(callback) {
					// lock bucket
					self.storage.lock( bucket_path, true, callback );
				},
				function(callback) {
					// load bucket data
					self.storage.get( bucket_path + '/files', function(err, files) {
						if (err) return callback(err);
						bucket_files = files;
						callback();
					} );
				},
				function(callback) {
					// delete file
					var file = Tools.findObject( bucket_files, criteria );
					if (!file) { return callback(new Error("Bucket file not found: " + JSON.stringify(criteria))); }
					
					self.logDebug(7, "Deleting file from bucket: " + bucket.id + ": " + file.filename, file );
					
					// delete from list
					Tools.deleteObject( bucket_files, criteria );
					
					// delete from storage
					self.storage.delete( file.path, callback );
				},
				function(callback) {
					// write bucket data
					self.storage.put( bucket_path + '/files', bucket_files, callback );
				}
			],
			function(err) {
				self.storage.unlock( bucket_path );
				if (err) {
					return self.doError('bucket', "Failed to delete bucket file: " + (err.message || err), callback);
				}
				callback({ code: 0 });
			}); // async.series
		} ); // loaded session
	}
	
}; // class Buckets

module.exports = Buckets;
