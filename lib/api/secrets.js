// xyOps API Layer - Secret Management
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const Path = require('path');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class Secrets {
	
	api_get_secrets(args, callback) {
		// get list of all secrets (does not include actual secrets, just metadata)
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			// return items and list header
			callback({
				code: 0,
				rows: self.secrets,
				list: { length: self.secrets.length }
			});
			
		} ); // loaded session
	}
	
	api_get_secret(args, callback) {
		// get single secret for editing (does not include actual secret, just metadata)
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var secret = Tools.findObject( self.secrets, { id: params.id } );
			if (!secret) return self.doError('notfound', "Secret not found: " + params.id, callback);
			
			callback({ code: 0, secret });
		} ); // loaded session
	}
	
	api_decrypt_secret(args, callback) {
		// decrypt secret and send value over the wire -- log this as a transaction
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			var meta = Tools.findObject(self.secrets, { id: params.id });
			if (!meta) {
				return self.doError('secret', "Secret not found: " + params.id, callback);
			}
			
			self.storage.get( 'secrets/' + params.id, function(err, record) {
				if (err) return self.doError('secret', "Failed to fetch secret: " + err, callback);
				
				// decrypt
				var value = null;
				try {
					value = self.decryptSecret( record, self.config.get('secret_key'), params.id );
				}
				catch (err) {
					return self.doError('secret', "Failed to decrypt secret: " + err, callback);
				}
				
				self.logDebug(6, "Successfully accessed secret: " + meta.title, meta);
				self.logTransaction('secret_access', meta.title, self.getClientInfo(args, { secret: meta, keywords: [ params.id ] }));
				
				callback({ code: 0, fields: value });
			}); // storage.get
		}); // loadSession
	}
	
	api_create_secret(args, callback) {
		// add new secret, including data to encrypt
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		// auto-generate unique ID if not specified
		if (!params.id) params.id = Tools.generateShortID('z');
		if (!params.fields) params.fields = [];
		if (!('enabled' in params)) params.enabled = true;
		if (!params.icon) params.icon = '';
		if (!params.notes) params.notes = '';
		if (!params.events) params.events = [];
		if (!params.categories) params.categories = [];
		if (!params.plugins) params.plugins = [];
		if (!params.web_hooks) params.web_hooks = [];
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/,
			title: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username || user.id;
			params.created = params.modified = Tools.timeNow(true);
			params.revision = 1;
			
			// secret id must be unique
			if (Tools.findObject(self.secrets, { id: params.id })) {
				return self.doError('secret', "That Secret ID already exists: " + params.id, callback);
			}
			
			// keep list of names in plaintext
			params.names = params.fields.map( function(field) { return field.name; } );
			
			// validate variable names
			var bad_name = params.names.find( name => Tools.MATCH_BAD_KEY.test(name) );
			if (bad_name) return self.doError('secret', "Invalid secret variable name: " + bad_name, callback);
			
			// separate data into separate record and encrypt
			var secret_path = 'secrets/' + params.id;
			var record = self.encryptSecret( params.fields, self.config.get('secret_key'), params.id );
			delete params.fields;
			
			self.logDebug(6, "Creating new secret: " + params.title, params);
			
			// first write encrypted data
			self.storage.put( secret_path, record, function(err) {
				if (err) {
					return self.doError('secret', "Failed to create secret: " + err, callback);
				}
				
				// now push secret record (metadata)
				self.storage.listPush( 'global/secrets', params, function(err) {
					if (err) {
						return self.doError('secret', "Failed to create secret: " + err, callback);
					}
					
					self.logDebug(6, "Successfully created secret: " + params.title, params);
					self.logTransaction('secret_create', params.title, self.getClientInfo(args, { secret: params, keywords: [ params.id ] }));
					
					// update cache
					self.secrets.push( params );
					self.secretCache[ params.id ] = record;
					
					// send api response
					callback({ code: 0, secret: params });
					
					// update all users
					self.doUserBroadcastAll('update', { secrets: self.secrets });
					
					// update monitor commands on all servers, in case secret assignments changed
					self.doServerBroadcastAll('update', { 
						commands: self.getCommandsWithSecrets()
					});
				} ); // storage.listPush
			} ); // storage.put
		} ); // loadSession
	}
	
	api_update_secret(args, callback) {
		// update existing secret
		// optional new data can be in tow
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			if (!Tools.findObject(self.secrets, { id: params.id })) {
				return self.doError('secret', "Secret not found: " + params.id, callback);
			}
			
			params.modified = Tools.timeNow(true);
			params.revision = "+1";
			
			// separate encrypted data into separate record
			var secret_path = 'secrets/' + params.id;
			var records = {};
			if (params.fields) {
				params.names = params.fields.map( function(field) { return field.name; } );
				
				// validate variable names
				var bad_name = params.names.find( name => Tools.MATCH_BAD_KEY.test(name) );
				if (bad_name) return self.doError('secret', "Invalid secret variable name: " + bad_name, callback);
				
				records[ secret_path ] = self.encryptSecret( params.fields, self.config.get('secret_key'), params.id );
				delete params.fields;
			}
			
			self.logDebug(6, "Updating secret: " + params.id, params);
			
			// first write encrypted data (or not -- putMulti handles zero records)
			self.storage.putMulti( records, function(err) {
				if (err) {
					return self.doError('secret', "Failed to create secret: " + err, callback);
				}
				
				self.storage.listFindUpdate( 'global/secrets', { id: params.id }, params, function(err, secret) {
					if (err) {
						return self.doError('secret', "Failed to update secret: " + err, callback);
					}
					
					self.logDebug(6, "Successfully updated secret: " + secret.title, params);
					self.logTransaction('secret_update', secret.title, self.getClientInfo(args, { secret: secret, keywords: [ params.id ] }));
					
					// update cache
					var mem_secret = Tools.findObject( self.secrets, { id: params.id } ) || {};
					Tools.mergeHashInto( mem_secret, secret );
					if (records[secret_path]) self.secretCache[ params.id ] = records[secret_path];
					
					// send api response
					callback({ code: 0 });
					
					// update all users
					self.doUserBroadcastAll('update', { secrets: self.secrets });
					
					// update monitor commands on all servers, in case secret assignments changed
					self.doServerBroadcastAll('update', { 
						commands: self.getCommandsWithSecrets()
					});
				} ); // listFindUpdate
			} ); // storage.put
		} ); // loadSession
	}
	
	api_delete_secret(args, callback) {
		// delete existing secret, including encrypted data
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			var secret = Tools.findObject(self.secrets, { id: params.id });
			if (!secret) {
				return self.doError('secret', "Secret not found: " + params.id, callback);
			}
			
			self.logDebug(6, "Deleting secret: " + secret.id, secret);
			
			async.series([
				function(callback) {
					// delete secret data
					self.logDebug(7, "Deleting secret data: " + secret.id);
					self.storage.delete( 'secrets/' + secret.id, callback );
				},
				function(callback) {
					// delete secret index
					self.logDebug(7, "Deleting secret record: " + secret.id );
					self.storage.listFindDelete( 'global/secrets', { id: secret.id }, callback );
				}
			],
			function(err) {
				if (err) {
					return self.doError('secret', "Failed to delete secret: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted secret: " + secret.title, secret);
				self.logTransaction('secret_delete', secret.title, self.getClientInfo(args, { secret: secret, keywords: [ params.id ] }));
				
				// update cache
				Tools.deleteObject( self.secrets, { id: secret.id } );
				delete self.secretCache[ secret.id ];
				
				// send api response
				callback({ code: 0 });
				
				// update all users
				self.doUserBroadcastAll('update', { secrets: self.secrets });
				
				// update monitor commands on all servers, in case secret assignments changed
				self.doServerBroadcastAll('update', { 
					commands: self.getCommandsWithSecrets()
				});
			}); // async.series
		} ); // loadSession
	}
	
}; // class Secrets

module.exports = Secrets;
