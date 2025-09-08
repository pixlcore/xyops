// xyOps API Layer - Monitors
// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the PixlCore Sustainable Use License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");
const jexl = require('jexl');

class Monitors {
	
	api_get_monitors(args, callback) {
		// get list of all monitors
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listGet( 'global/monitors', 0, 0, function(err, items, list) {
				if (err) {
					// no items found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return items and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got monitor list
		} ); // loaded session
	}
	
	api_get_monitor(args, callback) {
		// get single monitor for editing
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listFind( 'global/monitors', { id: params.id }, function(err, item) {
				if (err || !item) {
					return self.doError('monitor', "Failed to locate monitor: " + params.id, callback);
				}
				
				// success, return item
				callback({ code: 0, monitor: item });
			} ); // got monitor
		} ); // loaded session
	}
	
	api_create_monitor(args, callback) {
		// add new monitor
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		// auto-generate unique ID if not specified
		if (!params.id) params.id = Tools.generateShortID('m');
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			title: /\S/,
			source: /\S/,
			data_type: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_monitors', callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username || user.id;
			params.created = params.modified = Tools.timeNow(true);
			params.revision = 1;
			
			// ids must be unique
			if (Tools.findObject(self.monitors, { id: params.id })) {
				return self.doError('monitor', "That Monitor ID already exists: " + params.id, callback);
			}
			
			// pre-compile exp to check syntax and cache compiled exp in memory
			try {
				var exp = jexl.compile( params.source );
				self.expressionCache[params.id] = exp;
			}
			catch (err) {
				return self.doError('monitor', "Failed to compile expression: " + params.id + ": " + err, callback);
			}
			
			// make sure regexp compiles for data_match (optional)
			if (params.data_match) {
				try { new RegExp(params.data_match); }
				catch(err) {
					return self.doError('monitor', "Failed to compile data match regular expression: " + params.id + ": " + err, callback);
				}
			}
			
			// deleting will produce a "hole" in the sort orders, so we have to find the max + 1
			params.sort_order = -1;
			self.monitors.forEach( function(mon_def) {
				if (mon_def.sort_order > params.sort_order) params.sort_order = mon_def.sort_order;
			});
			params.sort_order++;
			
			self.logDebug(6, "Creating new monitor: " + params.title, params);
			
			self.storage.listPush( 'global/monitors', params, function(err) {
				if (err) {
					return self.doError('monitor', "Failed to create monitor: " + err, callback);
				}
				
				self.logDebug(6, "Successfully created monitor: " + params.title, params);
				self.logTransaction('monitor_create', params.title, self.getClientInfo(args, { monitor: params, keywords: [ params.id ] }));
				
				callback({ code: 0, monitor: params });
				
				// update cache in background
				self.storage.listGet( 'global/monitors', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache monitors: " + err);
						return;
					}
					self.monitors = items;
					self.doUserBroadcastAll('update', { monitors: items });
				});
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_monitor(args, callback) {
		// update existing monitor
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_monitors', callback)) return;
			
			args.user = user;
			args.session = session;
			
			// pre-compile exp to check syntax and cache compiled exp in memory
			if (params.source) {
				try {
					var exp = jexl.compile( params.source );
					self.expressionCache[params.id] = exp;
				}
				catch (err) {
					return self.doError('monitor', "Failed to compile expression: " + params.id + ": " + err, callback);
				}
			}
			
			// make sure regexp compiles for data_match (optional)
			if (params.data_match) {
				try { new RegExp(params.data_match); }
				catch(err) {
					return self.doError('monitor', "Failed to compile data match regular expression: " + params.id + ": " + err, callback);
				}
			}
			
			params.modified = Tools.timeNow(true);
			params.revision = "+1";
			
			self.logDebug(6, "Updating monitor: " + params.id, params);
			
			self.storage.listFindUpdate( 'global/monitors', { id: params.id }, params, function(err, monitor) {
				if (err) {
					return self.doError('monitor', "Failed to update monitor: " + err, callback);
				}
				
				self.logDebug(6, "Successfully updated monitor: " + monitor.title, params);
				self.logTransaction('monitor_update', monitor.title, self.getClientInfo(args, { monitor: monitor, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/monitors', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache monitors: " + err);
						return;
					}
					self.monitors = items;
					self.doUserBroadcastAll('update', { monitors: items });
				});
			} ); // listFindUpdate
		} ); // loadSession
	}
	
	api_test_monitor(args, callback) {
		// test monitor (before creating, or while editing)
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			server: /^\w+$/,
			source: /\S/,
			data_type: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_monitors', callback)) return;
			
			args.user = user;
			args.session = session;
			
			// pre-compile exp to check syntax and cache compiled exp in memory
			var exp = null;
			try { exp = jexl.compile( params.source ); }
			catch (err) { return self.doError('monitor', "Failed to compile expression: " + err, callback); }
			
			// make sure regexp compiles for data_match (optional)
			if (params.data_match) {
				try { new RegExp(params.data_match); }
				catch(err) { return self.doError('monitor', "Failed to compile data match regular expression: " + err, callback); }
			}
			
			// load server host data
			var host_key = 'hosts/' + params.server + '/data';
			
			self.storage.get( host_key, function(err, data) {
				if (err) return self.doError('monitor', "Failed to load server data: " + err, callback);
				
				self.logDebug(7, "Testing monitor expression: " + params.source + " on server: " + params.server);
				
				var value = 0;
				try { value = exp.evalSync( data.data ); }
				catch (err) { value = undefined; }
				
				if (value === undefined) {
					return callback({ code: 0, fail: true });
				}
				
				// support custom data_match regexp to extract value out of string
				if (params.data_match) {
					var matches = ('' + value).match( params.data_match );
					if (matches && (matches.length >= 2)) {
						// data_match has a group capture, use first group
						value = matches[1];
					}
					else if (matches) {
						// just grab entire match (no group)
						value = matches[0];
					}
					else {
						return self.doError('monitor', "Custom data regular expression did not match: " + params.data_match, callback);
					}
				} // data_match
				
				switch (params.data_type) {
					case 'integer': 
					case 'bytes':
					case 'seconds':
					case 'milliseconds':
						value = parseInt(value) || 0; 
					break;
					
					default: 
						value = Tools.shortFloat( parseFloat(value) || 0, 5 ); 
					break;
				} // data_type
				
				self.logDebug(7, "Monitor test result: " + value);
				callback({ code: 0, value: value });
			}); // storage.get
		} ); // loadSession
	}
	
	api_delete_monitor(args, callback) {
		// delete existing monitor
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_monitors', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(6, "Deleting monitor: " + params.id, params);
			
			self.storage.listFindDelete( 'global/monitors', { id: params.id }, function(err, monitor) {
				if (err) {
					return self.doError('monitor', "Failed to delete monitor: " + err, callback);
				}
				
				// also cleanup exp cache
				delete self.expressionCache[params.id];
				
				self.logDebug(6, "Successfully deleted monitor: " + monitor.title, monitor);
				self.logTransaction('monitor_delete', monitor.title, self.getClientInfo(args, { monitor: monitor, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/monitors', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache monitors: " + err);
						return;
					}
					self.monitors = items;
					self.doUserBroadcastAll('update', { monitors: items });
				});
			} ); // listFindDelete
		} ); // loadSession
	}
	
	api_multi_update_monitor(args, callback) {
		// update multiple monitors in one call, i.e. sort_order
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!params.items || !params.items.length) {
			return this.doError('session', "Request missing 'items' parameter, or has zero length.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_monitors', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(9, "Performing multi-monitor update", params);
			
			// convert item array to hash for quick matches in loop
			var update_map = {};
			for (var idx = 0, len = params.items.length; idx < len; idx++) {
				var item = params.items[idx];
				if (item.id) update_map[ item.id ] = item;
			}
			
			self.storage.listEachPageUpdate( 'global/monitors',
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
					
					self.logDebug(6, "Successfully updated multiple monitors");
					self.logTransaction('monitor_multi_update', '', self.getClientInfo(args, { 
						updated: Tools.hashKeysToArray( Tools.copyHashRemoveKeys(params.items[0], { id:1 }) ) 
					}));
					
					callback({ code: 0 });
					
					// update cache in background
					self.storage.listGet( 'global/monitors', 0, 0, function(err, items) {
						if (err) {
							// this should never fail, as it should already be cached
							self.logError('storage', "Failed to cache monitors: " + err);
							return;
						}
						self.monitors = items;
						self.doUserBroadcastAll('update', { monitors: items });
					});
				}
			); // listEachPageUpdate
		}); // loadSession
	}
	
	api_get_quickmon_data(args, callback) {
		// get quickmon data for a server, group, or all
		// { server, group }
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(9, "Getting QuickMon data", params);
			
			var resp = { code: 0, servers: {} };
			
			if (params.server) {
				// include single server
				resp.servers[ params.server ] = self.quickMonCache[ params.server ] || [];
			}
			else if (params.group) {
				// include all online servers in specified group
				for (var server_id in self.servers) {
					var server = self.servers[server_id];
					if (server.groups.includes(params.group)) {
						resp.servers[ server_id ] = self.quickMonCache[ server_id ] || [];
					}
				}
			}
			else {
				// include ALL servers
				resp.servers = self.quickMonCache;
			}
			
			callback(resp);
		}); // loadSession
	}
	
	api_get_latest_monitor_data(args, callback) {
		// get latest (real-time) monitoring data for a given server
		// { server, sys, limit }
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			server: /^\w+$/,
			sys: /^\w+$/,
			limit: /^\d+$/
		}, callback)) return;
		
		var sys = Tools.findObject( this.systems, { id: params.sys } );
		if (!sys) return this.doError('monitor', "Unknown system: " + params.sys, callback);
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(9, "Fetching latest monitoring data", params);
			
			var timeline_key = 'timeline/' + params.server + '/' + params.sys;
			var host_key = 'hosts/' + params.server + '/data';
			
			self.storage.get( host_key, function(err, data) {
				if (err) return self.doError('monitor', "Failed to load server data: " + err, callback);
				
				self.storage.listGet( timeline_key, 0 - params.limit, params.limit, function(err, items, list) {
					if (err) self.logError('monitor', err.message || err.toString());
					callback({ code: 0, rows: items || [], data: data });
				} ); // listGet
			} ); // storage.get
		}); // loadSession
	}
	
	api_get_historical_monitor_data(args, callback) {
		// get historical monitoring data for a given server
		// { server, sys, date, limit }
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			server: /^\w+$/,
			sys: /^\w+$/,
			date: /^\d+$/,
			limit: /^\d+$/
		}, callback)) return;
		
		var sys = Tools.findObject( this.systems, { id: params.sys } );
		if (!sys) return this.doError('monitor', "Unknown system: " + params.sys, callback);
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(9, "Fetching historical monitoring data", params);
			
			var timeline_key = 'timeline/' + params.server + '/' + params.sys;
			var epoch_div = Math.floor( params.date / sys.epoch_div );
			
			// load first item in list which has our epoch_div basis
			self.storage.listGet( timeline_key, 0, 1, function(err, first_items) {
				if (err) {
					// log error but return empty result to user
					self.logError('monitor', err.message || err.toString());
					return callback({ code: 0, rows: [] });
				}
				if (!first_items || !first_items[0] || !first_items[0].epoch_div) {
					return callback({ code: 0, rows: [] });
				}
				
				// calc offset based on divided epoch
				var offset = epoch_div - first_items[0].epoch_div;
				
				if (offset < 0) {
					// adjust for date ranges before server's birth (may still match partial)
					params.limit += offset; // note: offset is negative, so this decreases the limit
					offset = 0;
					if (params.limit <= 0) {
						// totally out of range, return nothing without complaint
						return callback({ code: 0, rows: [] });
					}
				}
				
				self.storage.listGet( timeline_key, offset, params.limit, function(err, items, list) {
					if (err) self.logError('monitor', err.message || err.toString());
					callback({ code: 0, rows: items || [] });
				} ); // listGet
			} ); // listGetInfo
		}); // loadSession
	}
	
}; // class Monitors

module.exports = Monitors;
