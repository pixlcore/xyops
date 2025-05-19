// Orchestra API Layer - User Roles
// Copyright (c) 2025 Joseph Huckaby
// Released under the MIT License

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class Roles {
	
	api_get_roles(args, callback) {
		// get list of all roles
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listGet( 'global/roles', 0, 0, function(err, items, list) {
				if (err) {
					// no items found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return items and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got role list
		} ); // loaded session
	}
	
	api_get_role(args, callback) {
		// get single role for editing
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listFind( 'global/roles', { id: params.id }, function(err, item) {
				if (err || !item) {
					return self.doError('role', "Failed to locate role: " + params.id, callback);
				}
				
				// success, return item
				callback({ code: 0, role: item });
			} ); // got role
		} ); // loaded session
	}
	
	api_create_role(args, callback) {
		// add new role
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		// auto-generate unique ID if not specified
		if (!params.id) params.id = Tools.generateShortID('r');
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			title: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_roles', callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username;
			params.created = params.modified = Tools.timeNow(true);
			params.revision = 1;
			
			if (!params.privileges) params.privileges = {}; // hash
			if (!params.categories) params.categories = []; // array
			if (!params.groups) params.groups = []; // array
			
			// role id must be unique
			if (Tools.findObject(self.roles, { id: params.id })) {
				return self.doError('role', "That Role ID already exists: " + params.id, callback);
			}
			
			self.logDebug(6, "Creating new role: " + params.title, params);
			
			self.storage.listPush( 'global/roles', params, function(err) {
				if (err) {
					return self.doError('role', "Failed to create role: " + err, callback);
				}
				
				self.logDebug(6, "Successfully created role: " + params.title, params);
				self.logTransaction('role_create', params.title, self.getClientInfo(args, { role: params, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/roles', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache roles: " + err);
						return;
					}
					self.roles = items;
					self.doUserBroadcastAll('update', { roles: items });
					self.updateRoles();
				});
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_role(args, callback) {
		// update existing role
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_roles', callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.modified = Tools.timeNow(true);
			params.revision = "+1";
			
			self.logDebug(6, "Updating role: " + params.id, params);
			
			self.storage.listFindUpdate( 'global/roles', { id: params.id }, params, function(err, role) {
				if (err) {
					return self.doError('role', "Failed to update role: " + err, callback);
				}
				
				self.logDebug(6, "Successfully updated role: " + role.title, params);
				self.logTransaction('role_update', role.title, self.getClientInfo(args, { role: role, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/roles', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache roles: " + err);
						return;
					}
					self.roles = items;
					self.doUserBroadcastAll('update', { roles: items });
					self.updateRoles();
				}); // listGet
			} ); // listFindUpdate
		} ); // loadSession
	}
	
	api_delete_role(args, callback) {
		// delete existing role
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_roles', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(6, "Deleting role: " + params.id, params);
			
			self.storage.listFindDelete( 'global/roles', { id: params.id }, function(err, role) {
				if (err) {
					return self.doError('role', "Failed to delete role: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted role: " + role.title, role);
				self.logTransaction('role_delete', role.title, self.getClientInfo(args, { role: role, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/roles', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache roles: " + err);
						return;
					}
					self.roles = items;
					self.doUserBroadcastAll('update', { roles: items });
					self.updateRoles();
				});
			} ); // listFindDelete
		} ); // loadSession
	}
	
	updateRoles() {
		// when roles are updated, we need to re-eval all active user sockets,
		// to see if they need their admin flag flipped
		var self = this;
		var usernames = {};
		
		// first, gather list of unique users who are connected
		for (var id in this.sockets) {
			var socket = this.sockets[id];
			if (socket.auth && socket.user) {
				usernames[ socket.username ] = 1;
			} // user's socket
		} // foreach socket
		
		// now load only those users, for effeciency
		this.loadMultipleUsers( Object.keys(usernames), function(err, users) {
			if (err) return; // should never happen
			
			users.forEach( function(user) {
				var username = user.username;
				var privs = self.getComputedPrivileges(user);
				
				for (var id in self.sockets) {
					var socket = self.sockets[id];
					if (socket.auth && socket.user && (socket.username == username)) {
						socket.admin = !!(privs.admin);
					} // user socket
				} // foreach socket
			} ); // foreach user
		}); // loadMultipleUsers
	}
	
}; // class Roles

module.exports = Roles;
