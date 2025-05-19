// Orchestra API Layer - Plugins
// Copyright (c) 2022 - 2024 Joseph Huckaby
// Released under the MIT License

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class Plugins {
	
	api_get_plugins(args, callback) {
		// get list of all plugins
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listGet( 'global/plugins', 0, 0, function(err, items, list) {
				if (err) {
					// no items found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return items and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got plugin list
		} ); // loaded session
	}
	
	api_get_plugin(args, callback) {
		// get single plugin for editing
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listFind( 'global/plugins', { id: params.id }, function(err, item) {
				if (err || !item) {
					return self.doError('plugin', "Failed to locate plugin: " + params.id, callback);
				}
				
				// success, return item
				callback({ code: 0, plugin: item });
			} ); // got plugin
		} ); // loaded session
	}
	
	api_create_plugin(args, callback) {
		// add new plugin
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		// auto-generate unique ID if not specified
		if (!params.id) params.id = Tools.generateShortID('p');
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			title: /\S/,
			type: /^(event|monitor|action|scheduler)$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_plugins', callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username;
			params.created = params.modified = Tools.timeNow(true);
			params.revision = 1;
			
			// plugin id must be unique
			if (Tools.findObject(self.plugins, { id: params.id })) {
				return self.doError('plugin', "That Plugin ID already exists: " + params.id, callback);
			}
			
			self.logDebug(6, "Creating new plugin: " + params.title, params);
			
			self.storage.listPush( 'global/plugins', params, function(err) {
				if (err) {
					return self.doError('plugin', "Failed to create plugin: " + err, callback);
				}
				
				self.logDebug(6, "Successfully created plugin: " + params.title, params);
				self.logTransaction('plugin_create', params.title, self.getClientInfo(args, { plugin: params, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/plugins', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache plugins: " + err);
						return;
					}
					self.plugins = items;
					self.prepPlugins();
					
					self.doUserBroadcastAll('update', { plugins: items });
					self.doServerBroadcastAll('update', { 
						plugins: Tools.findObjects( items, { type: 'event' } ),
						commands: Tools.findObjects( items, { type: 'monitor' } ) 
					});
				});
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_plugin(args, callback) {
		// update existing plugin
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_plugins', callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.modified = Tools.timeNow(true);
			params.revision = "+1";
			
			self.logDebug(6, "Updating plugin: " + params.id, params);
			
			self.storage.listFindUpdate( 'global/plugins', { id: params.id }, params, function(err, plugin) {
				if (err) {
					return self.doError('plugin', "Failed to update plugin: " + err, callback);
				}
				
				self.logDebug(6, "Successfully updated plugin: " + plugin.title, params);
				self.logTransaction('plugin_update', plugin.title, self.getClientInfo(args, { plugin: plugin, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/plugins', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache plugins: " + err);
						return;
					}
					self.plugins = items;
					self.prepPlugins();
					
					self.doUserBroadcastAll('update', { plugins: items });
					self.doServerBroadcastAll('update', { 
						plugins: Tools.findObjects( items, { type: 'event' } ),
						commands: Tools.findObjects( items, { type: 'monitor' } ) 
					});
				}); // listGet
			} ); // listFindUpdate
		} ); // loadSession
	}
	
	api_delete_plugin(args, callback) {
		// delete existing plugin
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_plugins', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(6, "Deleting plugin: " + params.id, params);
			
			self.storage.listFindDelete( 'global/plugins', { id: params.id }, function(err, plugin) {
				if (err) {
					return self.doError('plugin', "Failed to delete plugin: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted plugin: " + plugin.title, plugin);
				self.logTransaction('plugin_delete', plugin.title, self.getClientInfo(args, { plugin: plugin, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/plugins', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache plugins: " + err);
						return;
					}
					self.plugins = items;
					self.prepPlugins();
					
					self.doUserBroadcastAll('update', { plugins: items });
					self.doServerBroadcastAll('update', { 
						plugins: Tools.findObjects( items, { type: 'event' } ),
						commands: Tools.findObjects( items, { type: 'monitor' } ) 
					});
				});
			} ); // listFindDelete
		} ); // loadSession
	}
	
}; // class Plugins

module.exports = Plugins;
