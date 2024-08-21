// Orchestra API Layer - Admin
// Copyright (c) 2021 - 2024 Joseph Huckaby
// Released under the MIT License

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class Admin {
	
	api_get_servers(args, callback) {
		// get all servers
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			callback({
				code: 0,
				servers: self.servers,
				masters: self.getMasterPeerData()
			});
		} ); // loaded session
	}
	
	api_get_activity(args, callback) {
		// get rows from activity log (with pagination)
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			self.storage.listGet( 'logs/activity', parseInt(params.offset || 0), parseInt(params.limit || 50), function(err, items, list) {
				if (err) {
					// no rows found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return rows and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got data
		} ); // loaded session
	}
	
	api_get_master_state(args, callback) {
		// get state data
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			callback({ code: 0, state: self.state });
		} ); // loaded session
	}
	
	api_update_master_state(args, callback) {
		// update master state, params can be dot.props
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			// update using dot.props
			// putState also marks it as dirty
			for (var key in params) {
				self.putState(key, params[key]);
				self.logTransaction('state_update', key, self.getClientInfo(args, { key, value: params[key] }));
			}
			
			callback({ code: 0 });
		} ); // loaded session
	}
	
}; // class Admin

module.exports = Admin;
