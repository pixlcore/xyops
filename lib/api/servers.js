// xyOps API Layer - Servers
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class Servers {
	
	api_get_active_servers(args, callback) {
		// get list of all active servers from memory
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var rows = Object.values(self.servers);
			
			callback({
				code: 0,
				rows: rows,
				list: { length: rows.length }
			});
		} ); // loaded session
	}
	
	api_get_active_server(args, callback) {
		// get single server record from memory
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			if (!self.servers[params.id]) {
				return self.doError('server', "Failed to locate server: " + params.id, callback);
			}
			
			callback({
				code: 0,
				server: self.servers[params.id]
			});
		} ); // loaded session
	}
	
	api_get_server(args, callback) {
		// get server from storage (including full minute monitoring data)
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			// load server host data
			var host_key = 'hosts/' + params.id + '/data';
			
			self.storage.get( host_key, function(err, data) {
				if (err) return self.doError('server', "Failed to load server data: " + err, callback);
				
				if (self.servers[params.id]) {
					// server is active
					callback({ code: 0, server: self.servers[params.id], data: data, online: true });
				}
				else if (self.serverCache[params.id]) {
					// server is recently deceased
					callback({ code: 0, server: self.serverCache[params.id], data: data, online: false });
				}
				else {
					// load server from db (offline)
					self.unbase.get( 'servers', params.id, function(err, server) {
						if (err) return self.doError('server', "Failed to locate server: " + params.id, callback);
						callback({ code: 0, server: server, data: data, online: false });
					}); // unbase.get
				}
			} ); // storage.get
		} ); // loaded session
	}
	
	api_update_server(args, callback) {
		// update server in memory and in storage (i.e. enabled, title, icon, groups)
		// params: { id, title?, enabled?, icon?, groups?, autoGroup? }
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.updateServer(params.id, params, function(err) {
				if (err) return self.doError('server', "Failed to update server: " + err, callback);
				callback({ code: 0 });
				
				// log transaction
				self.logTransaction('server_update', '', self.getClientInfo(args, { 
					server_id: params.id,
					hostname: self.servers[params.id] ? self.servers[params.id].hostname : params.id,
					updates: params,
					keywords: [ params.id ]
				}));
				
			}); // updateServer
		} ); // loaded session
	}
	
	api_delete_server(args, callback) {
		// permanently delete server, and possibly monitoring data as well
		// params: { id, history? }
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			if (self.servers[params.id]) {
				// server is online
				var server = self.servers[ params.id ];
				var socket = self.sockets[ server.socket_id ];
				if (!socket) {
					// should never happen, mostly a sanity check
					return self.doError('server', "Server has no socket connection: " + params.id, callback);
				}
				
				// add hint to perform actions after removal
				if (params.history) server.delete = { params, username: user.username || user.id };
				
				// send uninstall command -- the eventual socket closing will continue the process
				socket.send('uninstall', {});
			}
			else if (params.history) {
				// server is offline
				self.deleteServer({ id: params.id, delete: { params, username: user.username || user.id } });
			}
			else {
				// server is offline but user said do not delete monitoring data, so there's nothing to do
				return self.doError('server', "Server has gone offline: " + params.id, callback);
			}
			
			// send response
			callback({ code: 0 });
			
			// log transaction
			self.logTransaction('server_delete', '', self.getClientInfo(args, { 
				server_id: params.id,
				hostname: self.servers[params.id] ? self.servers[params.id].hostname : params.id,
				keywords: [ params.id ]
			}));
			
		}); // loaded session
	}
	
	api_watch_server(args, callback) {
		// set a watch on a server (takes snaps every minute for specified duration)
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
			if (!self.servers[params.id]) return self.doError('server', "Failed to locate server: " + params.id, callback);
			
			args.user = user;
			args.session = session;
			
			if (params.duration) {
				self.logDebug(6, "Setting watch on server: " + params.id + ": " + nice_duration, params);
				self.putState( `watches.servers.${params.id}`, Tools.timeNow(true) + params.duration );
			}
			else {
				self.logDebug(6, "Removing watch on server: " + params.id, params);
				self.deleteState( `watches.servers.${params.id}` );
			}
			
			callback({ code: 0 });
			
			// send updated state for current user (all others will get it on the next tick)
			self.doUserBroadcast( session.username, 'update', { state: self.state } );
			
			// log transaction
			self.logTransaction('server_watch', '', self.getClientInfo(args, { 
				server_id: params.id,
				hostname: self.servers[params.id].hostname,
				duration: params.duration ? nice_duration : '0 seconds (disabled)',
				seconds: params.duration,
				keywords: [ params.id ]
			}));
			
		} ); // loaded session
	}
	
	// Snapshot APIs:
	
	api_create_snapshot(args, callback) {
		// add new snapshot for server
		// use host data already saved in last minute
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			server: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_snapshots', callback)) return;
			
			self.createSnapshot(params.server, { source: 'user', username: user.username }, function(err, id) {
				if (err) return self.doError('snapshot', "Failed to create snapshot: " + err, callback);
				callback({ code: 0, id: id });
			}); // createSnapshot
			
		} ); // loadSession
	}
	
} // class Servers

module.exports = Servers;
