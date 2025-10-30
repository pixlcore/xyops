// xyOps API Layer - Server Groups
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class Groups {
	
	api_get_groups(args, callback) {
		// get list of all groups
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listGet( 'global/groups', 0, 0, function(err, items, list) {
				if (err) {
					// no items found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return items and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got group list
		} ); // loaded session
	}
	
	api_get_group(args, callback) {
		// get single group for editing
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listFind( 'global/groups', { id: params.id }, function(err, item) {
				if (err || !item) {
					return self.doError('group', "Failed to locate group: " + params.id, callback);
				}
				
				// success, return item
				callback({ code: 0, group: item });
			} ); // got group
		} ); // loaded session
	}
	
	api_create_group(args, callback) {
		// add new group
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		// auto-generate unique ID if not specified
		if (!params.id) params.id = Tools.generateShortID('g');
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			title: /\S/,
			hostname_match: /\S/
		}, callback)) return;
		
		// actions
		if (!this.requireValidActions({ actions: params.alert_actions }, callback)) return false;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_groups', callback)) return;
			if (!self.requireGroupPrivilege(user, params.id, callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username || user.id;
			params.created = params.modified = Tools.timeNow(true);
			params.revision = 1;
			
			// group id must be unique
			if (Tools.findObject(self.groups, { id: params.id })) {
				return self.doError('group', "That Group ID already exists: " + params.id, callback);
			}
			
			// deleting will produce a "hole" in the sort orders, so we have to find the max + 1
			params.sort_order = -1;
			self.groups.forEach( function(group_def) {
				if (group_def.sort_order > params.sort_order) params.sort_order = group_def.sort_order;
			});
			params.sort_order++;
			
			self.logDebug(6, "Creating new group: " + params.title, params);
			
			self.storage.listPush( 'global/groups', params, function(err) {
				if (err) {
					return self.doError('group', "Failed to create group: " + err, callback);
				}
				
				self.logDebug(6, "Successfully created group: " + params.title, params);
				self.logTransaction('group_create', params.title, self.getClientInfo(args, { group: params, keywords: [ params.id ] }));
				
				callback({ code: 0, group: params });
				
				// update cache in background
				self.storage.listGet( 'global/groups', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache groups: " + err);
						return;
					}
					self.groups = items;
					self.updateServerGroups({ username: user.username || user.id });
					self.doUserBroadcastAll('update', {
						groups: items,
						servers: self.servers
					});
				});
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_group(args, callback) {
		// update existing group
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		// actions
		if (!this.requireValidActions({ actions: params.alert_actions }, callback)) return false;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_groups', callback)) return;
			if (!self.requireGroupPrivilege(user, params.id, callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.modified = Tools.timeNow(true);
			params.revision = "+1";
			
			self.logDebug(6, "Updating group: " + params.id, params);
			
			self.storage.listFindUpdate( 'global/groups', { id: params.id }, params, function(err, group) {
				if (err) {
					return self.doError('group', "Failed to update group: " + err, callback);
				}
				
				self.logDebug(6, "Successfully updated group: " + group.title, params);
				self.logTransaction('group_update', group.title, self.getClientInfo(args, { group: group, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/groups', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache groups: " + err);
						return;
					}
					self.groups = items;
					self.updateServerGroups({ username: user.username || user.id });
					self.doUserBroadcastAll('update', {
						groups: items,
						servers: self.servers
					});
				});
			} ); // listFindUpdate
		} ); // loadSession
	}
	
	api_delete_group(args, callback) {
		// delete existing group
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_groups', callback)) return;
			if (!self.requireGroupPrivilege(user, params.id, callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(6, "Deleting group: " + params.id, params);
			
			self.storage.listFindDelete( 'global/groups', { id: params.id }, function(err, group) {
				if (err) {
					return self.doError('group', "Failed to delete group: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted group: " + group.title, group);
				self.logTransaction('group_delete', group.title, self.getClientInfo(args, { group: group, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/groups', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache groups: " + err);
						return;
					}
					self.groups = items;
					self.updateServerGroups({ username: user.username || user.id });
					self.doUserBroadcastAll('update', {
						groups: items,
						servers: self.servers
					});
				});
			} ); // listFindDelete
		} ); // loadSession
	}
	
	api_multi_update_group(args, callback) {
		// update multiple groups in one call, i.e. sort_order
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!params.items || !params.items.length) {
			return this.doError('session', "Request missing 'items' parameter, or has zero length.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_groups', callback)) return;
			if (!self.requireGroupPrivilege(user, '*', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(9, "Performing multi-group update", params);
			
			// convert item array to hash for quick matches in loop
			var update_map = {};
			for (var idx = 0, len = params.items.length; idx < len; idx++) {
				var item = params.items[idx];
				if (item.id) update_map[ item.id ] = item;
			}
			
			self.storage.listEachPageUpdate( 'global/groups',
				function(items, callback) {
					// update page
					var num_updates = 0;
					
					for (var idx = 0, len = items.length; idx < len; idx++) {
						var item = items[idx];
						if (item.id && (item.id in update_map)) {
							Tools.mergeHashInto( item, update_map[item.id] );
							num_updates++;
						}
					}
					
					callback( null, !!num_updates );
				},
				function(err) {
					if (err) return callback(err);
					
					self.logDebug(6, "Successfully updated multiple groups");
					self.logTransaction('group_multi_update', '', self.getClientInfo(args, { 
						updated: Tools.hashKeysToArray( Tools.copyHashRemoveKeys(params.items[0], { id:1 }) ) 
					}));
					
					callback({ code: 0 });
					
					// update cache in background
					self.storage.listGet( 'global/groups', 0, 0, function(err, items) {
						if (err) {
							// this should never fail, as it should already be cached
							self.logError('storage', "Failed to cache groups: " + err);
							return;
						}
						self.groups = items;
						// self.updateServerGroups(); // not needed, as server.groups is no longer affected by sort_order
						self.doUserBroadcastAll('update', {
							groups: items,
							// servers: self.servers
						});
					});
				}
			); // listEachPageUpdate
		}); // loadSession
	}
	
	api_watch_group(args, callback) {
		// set a watch on a group (takes snaps every minute on the :30 for specified duration)
		// to cancel a watch, set duration to 0
		// params: { id, duration }
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			duration: /^\d+$/
		}, callback)) return;
		
		var nice_duration = Tools.getTextFromSeconds(params.duration, false, true);
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requirePrivilege(user, 'create_snapshots', callback)) return;
			
			var group = Tools.findObject( self.groups, { id: params.id } );
			if (!group) return self.doError( 'watch', "Unknown group: " + group_id, callback );
			
			args.user = user;
			args.session = session;
			
			if (params.duration) {
				self.logDebug(6, "Setting watch on group: " + params.id + ": " + nice_duration, params);
				self.putState( `watches.groups.${params.id}`, Tools.timeNow(true) + params.duration );
			}
			else {
				self.logDebug(6, "Removing watch on group: " + params.id, params);
				self.deleteState( `watches.groups.${params.id}` );
			}
			
			callback({ code: 0 });
			
			// send updated state for current user (all others will get it on the next tick)
			self.doUserBroadcast( session.username, 'update', { state: self.state } );
			
			// log transaction
			self.logTransaction('group_watch', '', self.getClientInfo(args, { 
				group: group,
				duration: params.duration ? nice_duration : '0 seconds (disabled)',
				seconds: params.duration,
				keywords: [ params.id ]
			}));
			
		} ); // loaded session
	}
	
	api_create_group_snapshot(args, callback) {
		// add new snapshot for group
		// use host data already saved in last minute
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			group: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_snapshots', callback)) return;
			
			var group = Tools.findObject( self.groups, { id: params.group } );
			if (!group) return self.doError( 'snapshot', "Unknown group: " + params.group, callback );
			
			self.createGroupSnapshot( params.group, { source: 'user', username: user.username }, function(err, id) {
				if (err) return self.doError('snapshot', "Failed to create group snapshot: " + err, callback);
				callback({ code: 0, id: id });
			}); // createGroupSnapshot
			
		} ); // loadSession
	}
	
}; // class Groups

module.exports = Groups;
