// xyOps API Layer - Web Hooks
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");
const jexl = require('jexl');

class WebHooks {
	
	api_get_web_hooks(args, callback) {
		// get list of all web hooks
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listGet( 'global/web_hooks', 0, 0, function(err, items, list) {
				if (err) {
					// no items found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return items and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got web hook list
		} ); // loaded session
	}
	
	api_get_web_hook(args, callback) {
		// get single web hook for editing
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listFind( 'global/web_hooks', { id: params.id }, function(err, item) {
				if (err || !item) {
					return self.doError('web_hook', "Failed to locate web hook: " + params.id, callback);
				}
				
				// success, return item
				callback({ code: 0, web_hook: item });
			} ); // got web hook
		} ); // loaded session
	}
	
	api_create_web_hook(args, callback) {
		// add new web hook
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		// auto-generate unique ID if not specified
		if (!params.id) params.id = Tools.generateShortID('w');
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			title: /\S/,
			method: /^\w+$/,
			url: /^https?:\/\/\S+$/i
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_web_hooks', callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username || user.id;
			params.created = params.modified = Tools.timeNow(true);
			params.revision = 1;
			
			// web hook id must be unique
			if (Tools.findObject(self.web_hooks, { id: params.id })) {
				return self.doError('web_hook', "That Web Hook ID already exists: " + params.id, callback);
			}
			
			// check syntax of macros in the body, if applicable
			if (params.body) {
				try {
					params.body.replace( /\{\{(.+?)\}\}/g, function(m_all, m_g1) { jexl.compile( m_g1 ); return m_all; } );
				}
				catch (err) {
					return self.doError('web_hook', "Failed to compile macro in body: " + params.id + ": " + err, callback);
				}
			}
			
			self.logDebug(6, "Creating new web hook: " + params.title, params);
			
			self.storage.listPush( 'global/web_hooks', params, function(err) {
				if (err) {
					return self.doError('web_hook', "Failed to create web hook: " + err, callback);
				}
				
				self.logDebug(6, "Successfully created web hook: " + params.title, params);
				self.logTransaction('web_hook_create', params.title, self.getClientInfo(args, { web_hook: params, keywords: [ params.id ] }));
				
				callback({ code: 0, web_hook: params });
				
				// update cache in background
				self.storage.listGet( 'global/web_hooks', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache web_hooks: " + err);
						return;
					}
					self.web_hooks = items;
					self.doUserBroadcastAll('update', { web_hooks: items });
				});
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_web_hook(args, callback) {
		// update existing web hook
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_web_hooks', callback)) return;
			
			args.user = user;
			args.session = session;
			
			// check syntax of macros in the body, if applicable
			if (params.body) {
				try {
					params.body.replace( /\{\{(.+?)\}\}/g, function(m_all, m_g1) { jexl.compile( m_g1 ); return m_all; } );
				}
				catch (err) {
					return self.doError('web_hook', "Failed to compile macro in body: " + params.id + ": " + err, callback);
				}
			}
			
			params.modified = Tools.timeNow(true);
			params.revision = "+1";
			
			self.logDebug(6, "Updating web hook: " + params.id, params);
			
			self.storage.listFindUpdate( 'global/web_hooks', { id: params.id }, params, function(err, web_hook) {
				if (err) {
					return self.doError('web_hook', "Failed to update web hook: " + err, callback);
				}
				
				self.logDebug(6, "Successfully updated web hook: " + web_hook.title, params);
				self.logTransaction('web_hook_update', web_hook.title, self.getClientInfo(args, { web_hook: web_hook, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/web_hooks', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache web_hooks: " + err);
						return;
					}
					self.web_hooks = items;
					self.doUserBroadcastAll('update', { web_hooks: items });
				}); // listGet
			} ); // listFindUpdate
		} ); // loadSession
	}
	
	api_delete_web_hook(args, callback) {
		// delete existing web hook
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_web_hooks', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(6, "Deleting web hook: " + params.id, params);
			
			self.storage.listFindDelete( 'global/web_hooks', { id: params.id }, function(err, web_hook) {
				if (err) {
					return self.doError('web_hook', "Failed to delete web hook: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted web hook: " + web_hook.title, web_hook);
				self.logTransaction('web_hook_delete', web_hook.title, self.getClientInfo(args, { web_hook: web_hook, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/web_hooks', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache web_hooks: " + err);
						return;
					}
					self.web_hooks = items;
					self.doUserBroadcastAll('update', { web_hooks: items });
				});
			} ); // listFindDelete
		} ); // loadSession
	}
	
	api_test_web_hook(args, callback) {
		// test web hook
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			title: /\S/,
			method: /^\w+$/,
			url: /^https?:\/\/\S+$/i
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_web_hooks', callback)) return;
			
			args.user = user;
			args.session = session;
			
			// allow params to override existing hook
			var combo_hook = params;
			var web_hook = Tools.findObject(self.web_hooks, { id: params.id });
			if (web_hook) {
				combo_hook = Tools.mergeHashes(web_hook, params);
			}
			
			self.logDebug(6, "Testing web hook: " + params.id, combo_hook);
			
			// construct some sample data
			var hook_data = {
				_fallback: "Web Took Test: " + combo_hook.title // macro substitution fallback value
			};
			
			self.fireWebHook(combo_hook, hook_data, function(err, result) {
				var { resp, data, perf, url, opts, code, description, details } = result;
				
				callback({
					code: 0,
					result: { code, description, details }
				});
			})
		} ); // loadSession
	}
	
}; // class WebHooks

module.exports = WebHooks;
