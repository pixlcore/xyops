// xyOps API Layer - API Keys
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class APIKeyManagement {
	
	api_get_api_keys(args, callback) {
		// get list of all api_keys
		// does not include secrets: `key` is a salted hash of the real key
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			self.storage.listGet( 'global/api_keys', 0, 0, function(err, items, list) {
				if (err) {
					// no keys found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return keys and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got api_key list
		} ); // loaded session
	}
	
	api_get_api_key(args, callback) {
		// get single API Key for editing
		// does not include secrets: `key` is a salted hash of the real key
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			self.storage.listFind( 'global/api_keys', { id: params.id }, function(err, item) {
				if (err || !item) {
					return self.doError('api_key', "Failed to locate API Key: " + params.id, callback);
				}
				
				// success, return key
				callback({ code: 0, api_key: item });
			} ); // got api_key
		} ); // loaded session
	}
	
	api_create_api_key(args, callback) {
		// add new API Key
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			title: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.id = Tools.generateShortID('k');
			params.username = user.username || user.id;
			params.created = params.modified = Tools.timeNow(true);
			params.revision = 1;
			
			if (!params.active) params.active = 1;
			if (!params.description) params.description = "";
			if (!params.privileges) params.privileges = {};
			
			self.logDebug(6, "Creating new API Key: " + params.title, params);
			
			// generate key silent and secretly, only store a salted hash, and only tell client actual key ONCE
			var plain_key = Tools.generateUniqueBase64();
			params.key = Tools.digestHex( plain_key + params.id, 'sha256' );
			
			// also store "masked" version for convenience
			params.mask = plain_key.substring(0, 4) + ('*').repeat(8) + plain_key.substring(plain_key.length - 4);
			
			self.storage.listUnshift( 'global/api_keys', params, function(err) {
				if (err) {
					return self.doError('api_key', "Failed to create api_key: " + err, callback);
				}
				
				self.logDebug(6, "Successfully created api_key: " + params.title, params);
				self.logTransaction('apikey_create', params.title, self.getClientInfo(args, { api_key: params, keywords: [ params.id ] }));
				
				// add key to in-memory cache (hash only)
				self.api_keys.push( Tools.copyHash(params, true) );
				
				callback({ code: 0, api_key: params, plain_key });
				
				// send redacted key update to all users
				self.doUserBroadcastAll('single', { list: 'api_keys', item: Tools.mergeHashes( params, { key: 'REDACTED' } ) });
			} ); // list insert
		} ); // load session
	}
	
	api_update_api_key(args, callback) {
		// update existing API Key
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			// do not allow actual api key to be updated (security)
			delete params.key;
			
			params.modified = Tools.timeNow(true);
			params.revision = "+1";
			
			self.logDebug(6, "Updating API Key: " + params.id, params);
			
			self.storage.listFindUpdate( 'global/api_keys', { id: params.id }, params, function(err, api_key) {
				if (err) {
					return self.doError('api_key', "Failed to update API Key: " + err, callback);
				}
				
				self.logDebug(6, "Successfully updated API Key: " + api_key.title, params);
				self.logTransaction('apikey_update', api_key.title, self.getClientInfo(args, { api_key: api_key, keywords: [ params.id ] }));
				
				// update key in cache (hash only)
				Tools.mergeHashInto( Tools.findObject( self.api_keys, { id: params.id } ) || {}, api_key );
				
				callback({ code: 0 });
				
				// send redacted key update to all users
				self.doUserBroadcastAll('single', { list: 'api_keys', item: Tools.mergeHashes( api_key, { key: 'REDACTED' } ) });
			} );
		} );
	}
	
	api_delete_api_key(args, callback) {
		// delete existing API Key
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(6, "Deleting API Key: " + params.id, params);
			
			self.storage.listFindDelete( 'global/api_keys', { id: params.id }, function(err, api_key) {
				if (err) {
					return self.doError('api_key', "Failed to delete API Key: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted API Key: " + api_key.title, api_key);
				self.logTransaction('apikey_delete', api_key.title, self.getClientInfo(args, { api_key: api_key, keywords: [ params.id ] }));
				
				// delete key from cache
				Tools.deleteObject( self.api_keys, { id: params.id } );
				
				callback({ code: 0 });
				
				self.doUserBroadcastAll('single', { list: 'api_keys', item: params, delete: true });
			} );
		} );
	}
	
}; // class APIKeyManagement

module.exports = APIKeyManagement;
