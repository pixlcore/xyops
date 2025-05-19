// Orchestra API Layer - Notification Channels
// Copyright (c) 2022 - 2024 Joseph Huckaby
// Released under the MIT License

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class Channels {
	
	api_get_channels(args, callback) {
		// get list of all channels
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listGet( 'global/channels', 0, 0, function(err, items, list) {
				if (err) {
					// no items found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return items and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got channel list
		} ); // loaded session
	}
	
	api_get_channel(args, callback) {
		// get single channel for editing
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listFind( 'global/channels', { id: params.id }, function(err, item) {
				if (err || !item) {
					return self.doError('channel', "Failed to locate channel: " + params.id, callback);
				}
				
				// success, return item
				callback({ code: 0, channel: item });
			} ); // got channel
		} ); // loaded session
	}
	
	api_create_channel(args, callback) {
		// add new channel
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		// auto-generate unique ID if not specified
		if (!params.id) params.id = Tools.generateShortID('ch');
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			title: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_channels', callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username;
			params.created = params.modified = Tools.timeNow(true);
			params.revision = 1;
			
			// channel id must be unique
			if (Tools.findObject(self.channels, { id: params.id })) {
				return self.doError('channel', "That Channel ID already exists: " + params.id, callback);
			}
			
			self.logDebug(6, "Creating new channel: " + params.title, params);
			
			self.storage.listPush( 'global/channels', params, function(err) {
				if (err) {
					return self.doError('channel', "Failed to create channel: " + err, callback);
				}
				
				self.logDebug(6, "Successfully created channel: " + params.title, params);
				self.logTransaction('channel_create', params.title, self.getClientInfo(args, { channel: params, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/channels', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache channels: " + err);
						return;
					}
					self.channels = items;
					self.doUserBroadcastAll('update', { channels: items });
				});
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_channel(args, callback) {
		// update existing channel
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_channels', callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.modified = Tools.timeNow(true);
			params.revision = "+1";
			
			self.logDebug(6, "Updating channel: " + params.id, params);
			
			self.storage.listFindUpdate( 'global/channels', { id: params.id }, params, function(err, channel) {
				if (err) {
					return self.doError('channel', "Failed to update channel: " + err, callback);
				}
				
				self.logDebug(6, "Successfully updated channel: " + channel.title, params);
				self.logTransaction('channel_update', channel.title, self.getClientInfo(args, { channel: channel, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/channels', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache channels: " + err);
						return;
					}
					self.channels = items;
					self.doUserBroadcastAll('update', { channels: items });
				}); // listGet
			} ); // listFindUpdate
		} ); // loadSession
	}
	
	api_delete_channel(args, callback) {
		// delete existing channel
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_channels', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(6, "Deleting channel: " + params.id, params);
			
			self.storage.listFindDelete( 'global/channels', { id: params.id }, function(err, channel) {
				if (err) {
					return self.doError('channel', "Failed to delete channel: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted channel: " + channel.title, channel);
				self.logTransaction('channel_delete', channel.title, self.getClientInfo(args, { channel: channel, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/channels', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache channels: " + err);
						return;
					}
					self.channels = items;
					self.doUserBroadcastAll('update', { channels: items });
				});
			} ); // listFindDelete
		} ); // loadSession
	}
	
}; // class Channels

module.exports = Channels;
