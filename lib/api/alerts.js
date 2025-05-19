// Orchestra API Layer - Alerts
// Copyright (c) 2021 - 2024 Joseph Huckaby
// Released under the MIT License

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class Alerts {
	
	api_get_alerts(args, callback) {
		// get list of all alerts
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listGet( 'global/alerts', 0, 0, function(err, items, list) {
				if (err) {
					// no items found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return items and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got alert list
		} ); // loaded session
	}
	
	api_get_alert(args, callback) {
		// get single alert for editing
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listFind( 'global/alerts', { id: params.id }, function(err, item) {
				if (err || !item) {
					return self.doError('alert', "Failed to locate alert: " + params.id, callback);
				}
				
				// success, return item
				callback({ code: 0, alert: item });
			} ); // got alert
		} ); // loaded session
	}
	
	api_create_alert(args, callback) {
		// add new alert
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		// auto-generate unique ID if not specified
		if (!params.id) params.id = Tools.generateShortID('a');
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			title: /\S/,
			expression: /\S/,
			message: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_alerts', callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username;
			params.created = params.modified = Tools.timeNow(true);
			params.revision = 1;
			
			// ids must be unique
			if (Tools.findObject(self.alerts, { id: params.id })) {
				return self.doError('alert', "That Alert ID already exists: " + params.id, callback);
			}
			
			self.logDebug(6, "Creating new alert: " + params.title, params);
			
			self.storage.listPush( 'global/alerts', params, function(err) {
				if (err) {
					return self.doError('alert', "Failed to create alert: " + err, callback);
				}
				
				self.logDebug(6, "Successfully created alert: " + params.title, params);
				self.logTransaction('alert_create', params.title, self.getClientInfo(args, { alert: params, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/alerts', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache alerts: " + err);
						return;
					}
					self.alerts = items;
					self.doUserBroadcastAll('update', { alerts: items });
				});
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_alert(args, callback) {
		// update existing alert
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_alerts', callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.modified = Tools.timeNow(true);
			params.revision = "+1";
			
			self.logDebug(6, "Updating alert: " + params.id, params);
			
			self.storage.listFindUpdate( 'global/alerts', { id: params.id }, params, function(err, alert) {
				if (err) {
					return self.doError('alert', "Failed to update alert: " + err, callback);
				}
				
				self.logDebug(6, "Successfully updated alert: " + alert.title, params);
				self.logTransaction('alert_update', alert.title, self.getClientInfo(args, { alert: alert, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/alerts', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache alerts: " + err);
						return;
					}
					self.alerts = items;
					self.doUserBroadcastAll('update', { alerts: items });
				});
			} ); // listFindUpdate
		} ); // loadSession
	}
	
	api_delete_alert(args, callback) {
		// delete existing alert
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_alerts', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(6, "Deleting alert: " + params.id, params);
			
			self.storage.listFindDelete( 'global/alerts', { id: params.id }, function(err, alert) {
				if (err) {
					return self.doError('alert', "Failed to delete alert: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted alert: " + alert.title, alert);
				self.logTransaction('alert_delete', alert.title, self.getClientInfo(args, { alert: alert, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/alerts', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache alerts: " + err);
						return;
					}
					self.alerts = items;
					self.doUserBroadcastAll('update', { alerts: items });
				});
			} ); // listFindDelete
		} ); // loadSession
	}
	
	api_get_alert_invocations(args, callback) {
		// get info about multiple alert invocations
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		var alerts = {};
		if (!this.requireMaster(args, callback)) return;
		
		if (!params.ids || !Tools.isaArray(params.ids) || !params.ids.length) {
			return this.doError('alert', "Missing or malformed ids parameter.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			async.eachLimit( params.ids, self.storage.concurrency,
				function(id, callback) {
					self.unbase.get( 'alerts', id, function(err, alert) {
						alerts[id] = alert || { err };
						callback();
					}); // unbase.get
				},
				function(err) {
					// convert alerts to array but keep original order
					callback({ 
						code: 0, 
						alerts: params.ids.map( function(id) { return alerts[id]; } )
					});
				}
			); // eachLimit
		}); // loadSession
	}
	
	api_delete_alert_invocation(args, callback) {
		// delete single alert invocation
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_alerts', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(6, "Deleting alert invocation: " + params.id, params);
			
			self.unbase.delete( 'alerts', params.id, function(err) {
				if (err) {
					return self.doError('alert', "Failed to delete alert invocation: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted alert invocation: " + params.id);
				self.logTransaction('alert_delete_invocation', params.id, self.getClientInfo(args, {}));
				
				callback({ code: 0 });
			} ); // unbase.delete
		} ); // loadSession
	}
	
}; // class Alerts

module.exports = Alerts;
