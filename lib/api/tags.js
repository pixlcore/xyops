// xyOps API Layer - Tags
// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the PixlCore Sustainable Use License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class Tags {
	
	api_get_tags(args, callback) {
		// get list of all tags
		var self = this;
		var params = args.params;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listGet( 'global/tags', 0, 0, function(err, items, list) {
				if (err) {
					// no items found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return items and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got tag list
		} ); // loaded session
	}
	
	api_get_tag(args, callback) {
		// get single tag for editing
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listFind( 'global/tags', { id: params.id }, function(err, item) {
				if (err || !item) {
					return self.doError('tag', "Failed to locate tag: " + params.id, callback);
				}
				
				// success, return item
				callback({ code: 0, tag: item });
			} ); // got tag
		} ); // loaded session
	}
	
	api_create_tag(args, callback) {
		// add new tag
		var self = this;
		var params = args.params;
		
		// auto-generate unique ID if not specified
		if (!params.id) params.id = Tools.generateShortID('t');
		
		if (!this.requireParams(params, {
			id: /^[a-zA-Z0-9]\w*$/,
			title: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_tags', callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username || user.id;
			params.created = params.modified = Tools.timeNow(true);
			params.revision = 1;
			
			// id must be unique
			if (Tools.findObject(self.tags, { id: params.id })) {
				return self.doError('tag', "Tag ID already exists: " + params.id, callback);
			}
			
			self.logDebug(6, "Creating new tag: " + params.title, params);
			
			self.storage.listPush( 'global/tags', params, function(err) {
				if (err) {
					return self.doError('tag', "Failed to create tag: " + err, callback);
				}
				
				self.logDebug(6, "Successfully created tag: " + params.title, params);
				self.logTransaction('tag_create', params.title, self.getClientInfo(args, { tag: params, keywords: [ params.id ] }));
				
				callback({ code: 0, tag: params });
				
				// update cache in background
				self.storage.listGet( 'global/tags', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache tags: " + err);
						return;
					}
					self.tags = items;
					self.doUserBroadcastAll('update', { tags: items });
				});
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_tag(args, callback) {
		// update existing tag
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_tags', callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.modified = Tools.timeNow(true);
			params.revision = "+1";
			
			self.logDebug(6, "Updating tag: " + params.id, params);
			
			self.storage.listFindUpdate( 'global/tags', { id: params.id }, params, function(err, tag) {
				if (err) {
					return self.doError('tag', "Failed to update tag: " + err, callback);
				}
				
				self.logDebug(6, "Successfully updated tag: " + tag.title, params);
				self.logTransaction('tag_update', tag.title, self.getClientInfo(args, { tag: tag, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/tags', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache tags: " + err);
						return;
					}
					self.tags = items;
					self.doUserBroadcastAll('update', { tags: items });
				});
			} ); // listFindUpdate
		} ); // loadSession
	}
	
	api_delete_tag(args, callback) {
		// delete existing tag
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_tags', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(6, "Deleting tag: " + params.id, params);
			
			self.storage.listFindDelete( 'global/tags', { id: params.id }, function(err, tag) {
				if (err) {
					return self.doError('tag', "Failed to delete tag: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted tag: " + tag.title, tag);
				self.logTransaction('tag_delete', tag.title, self.getClientInfo(args, { tag: tag, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/tags', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache tags: " + err);
						return;
					}
					self.tags = items;
					self.doUserBroadcastAll('update', { tags: items });
				});
			} ); // listFindDelete
		} ); // loadSession
	}
	
}; // class Tags

module.exports = Tags;
