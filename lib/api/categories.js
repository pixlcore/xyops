// xyOps API Layer - Event Categories
// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the PixlCore Sustainable Use License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class Categories {
	
	api_get_categories(args, callback) {
		// get list of all categories
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listGet( 'global/categories', 0, 0, function(err, items, list) {
				if (err) {
					// no items found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return items and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got category list
		} ); // loaded session
	}
	
	api_get_category(args, callback) {
		// get single category for editing
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listFind( 'global/categories', { id: params.id }, function(err, item) {
				if (err || !item) {
					return self.doError('category', "Failed to locate category: " + params.id, callback);
				}
				
				// success, return item
				callback({ code: 0, category: item });
			} ); // got category
		} ); // loaded session
	}
	
	api_create_category(args, callback) {
		// add new category
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		// auto-generate unique ID if not specified
		if (!params.id) params.id = Tools.generateShortID('ca');
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			title: /\S/
		}, callback)) return;
		
		if (!params.limits) params.limits = [];
		if (!params.actions) params.actions = [];
		
		if (!this.requireValidLimits(params, callback)) return;
		if (!this.requireValidActions(params, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_categories', callback)) return;
			if (!self.requireCategoryPrivilege(user, params.id, callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username || user.id;
			params.created = params.modified = Tools.timeNow(true);
			params.revision = 1;
			
			// category id must be unique
			if (Tools.findObject(self.categories, { id: params.id })) {
				return self.doError('category', "That Category ID already exists: " + params.id, callback);
			}
			
			// deleting will produce a "hole" in the sort orders, so we have to find the max + 1
			params.sort_order = -1;
			self.categories.forEach( function(category_def) {
				if (category_def.sort_order > params.sort_order) params.sort_order = category_def.sort_order;
			});
			params.sort_order++;
			
			self.logDebug(6, "Creating new category: " + params.title, params);
			
			self.storage.listPush( 'global/categories', params, function(err) {
				if (err) {
					return self.doError('category', "Failed to create category: " + err, callback);
				}
				
				self.logDebug(6, "Successfully created category: " + params.title, params);
				self.logTransaction('category_create', params.title, self.getClientInfo(args, { category: params, keywords: [ params.id ] }));
				
				callback({ code: 0, category: params });
				
				// update cache in background
				self.storage.listGet( 'global/categories', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache categories: " + err);
						return;
					}
					self.categories = items;
					self.doUserBroadcastAll('update', { categories: items });
				});
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_category(args, callback) {
		// update existing category
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		if (!this.requireValidLimits(params, callback)) return;
		if (!this.requireValidActions(params, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_categories', callback)) return;
			if (!self.requireCategoryPrivilege(user, params.id, callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.modified = Tools.timeNow(true);
			params.revision = "+1";
			
			self.logDebug(6, "Updating category: " + params.id, params);
			
			self.storage.listFindUpdate( 'global/categories', { id: params.id }, params, function(err, category) {
				if (err) {
					return self.doError('category', "Failed to update category: " + err, callback);
				}
				
				self.logDebug(6, "Successfully updated category: " + category.title, params);
				self.logTransaction('category_update', category.title, self.getClientInfo(args, { category: category, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/categories', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache categories: " + err);
						return;
					}
					self.categories = items;
					self.doUserBroadcastAll('update', { categories: items });
				}); // listGet
			} ); // listFindUpdate
		} ); // loadSession
	}
	
	api_delete_category(args, callback) {
		// delete existing category
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_categories', callback)) return;
			if (!self.requireCategoryPrivilege(user, params.id, callback)) return;
			
			args.user = user;
			args.session = session;
			
			// make sure no events are assigned to category
			if (Tools.findObjects(self.events, { category: params.id }).length) {
				return self.doError('category', "Failed to delete category: Still in use by one or more events.", callback);
			}
			
			self.logDebug(6, "Deleting category: " + params.id, params);
			
			self.storage.listFindDelete( 'global/categories', { id: params.id }, function(err, category) {
				if (err) {
					return self.doError('category', "Failed to delete category: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted category: " + category.title, category);
				self.logTransaction('category_delete', category.title, self.getClientInfo(args, { category: category, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/categories', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache categories: " + err);
						return;
					}
					self.categories = items;
					self.doUserBroadcastAll('update', { categories: items });
				});
			} ); // listFindDelete
		} ); // loadSession
	}
	
	api_multi_update_category(args, callback) {
		// update multiple categories in one call, i.e. sort_order
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!params.items || !params.items.length) {
			return this.doError('session', "Request missing 'items' parameter, or has zero length.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_categories', callback)) return;
			if (!self.requireCategoryPrivilege(user, '*', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(9, "Performing multi-category update", params);
			
			// convert item array to hash for quick matches in loop
			var update_map = {};
			for (var idx = 0, len = params.items.length; idx < len; idx++) {
				var item = params.items[idx];
				if (item.id) update_map[ item.id ] = item;
			}
			
			self.storage.listEachPageUpdate( 'global/categories',
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
					
					self.logDebug(6, "Successfully updated multiple categories");
					self.logTransaction('category_multi_update', '', self.getClientInfo(args, { 
						updated: Tools.hashKeysToArray( Tools.copyHashRemoveKeys(params.items[0], { id:1 }) ) 
					}));
					
					callback({ code: 0 });
					
					// update cache in background
					self.storage.listGet( 'global/categories', 0, 0, function(err, items) {
						if (err) {
							// this should never fail, as it should already be cached
							self.logError('storage', "Failed to cache categories: " + err);
							return;
						}
						self.categories = items;
						self.doUserBroadcastAll('update', { categories: items });
					});
				}
			); // listEachPageUpdate
		}); // loadSession
	}
	
}; // class Categories

module.exports = Categories;
