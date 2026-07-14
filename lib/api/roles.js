// xyOps API Layer - User Roles
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

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
			
			// return items and list header
			callback({
				code: 0,
				rows: self.roles,
				list: { length: self.roles.length }
			});
			
		} ); // loaded session
	}
	
	api_get_role(args, callback) {
		// get single role for editing
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var role = Tools.findObject( self.roles, { id: params.id } );
			if (!role) return self.doError('notfound', "Failed to locate role: " + params.id, callback);
			
			// success, return item
			callback({ code: 0, role: role });
			
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
			id: /^[a-z0-9_]+$/,
			title: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_roles', callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username || user.id;
			params.created = params.modified = Tools.timeNow(true);
			params.revision = 1;
			
			if (!('enabled' in params)) params.enabled = true;
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
				
				// add to in-memory cache
				self.roles.push( Tools.copyHash(params, true) );
				
				// send api response
				callback({ code: 0, role: params });
				
				// update all users and roles
				self.doUserBroadcastAll('update', { roles: self.roles });
				self.updateRoles();
				
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_role(args, callback) {
		// update existing role
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
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
				
				// update in-memory cache
				Tools.mergeHashInto( Tools.findObject( self.roles, { id: params.id } ) || {}, role );
				
				// send api response
				callback({ code: 0 });
				
				// update all users and roles
				self.doUserBroadcastAll('update', { roles: self.roles });
				self.updateRoles();
				
			} ); // listFindUpdate
		} ); // loadSession
	}
	
	api_delete_role(args, callback) {
		// delete existing role
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
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
				
				// remove from in-memory cache
				Tools.deleteObject( self.roles, { id: params.id } );
				
				// send api response
				callback({ code: 0 });
				
				// update all users and roles
				self.doUserBroadcastAll('update', { roles: self.roles });
				self.updateRoles();
				
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
