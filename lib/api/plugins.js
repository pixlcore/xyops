// xyOps API Layer - Plugins
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

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
			
			// return items and list header
			callback({
				code: 0,
				rows: self.plugins,
				list: { length: self.plugins.length }
			});
			
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
			
			var plugin = Tools.findObject( self.plugins, { id: params.id } );
			if (!plugin) return self.doError('plugin', "Failed to locate plugin: " + params.id, callback);
			
			// success, return item
			callback({ code: 0, plugin: plugin });
			
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
		
		// validate optional plugin data parameters
		if (!this.requireValidPluginData(params, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_plugins', callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username || user.id;
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
				
				// add to in-memory cache
				self.plugins.push( Tools.copyHash(params, true) );
				
				// prep plugins
				self.prepPlugins();
				
				// send api response
				callback({ code: 0, plugin: params });
				
				// notify all users and servers
				self.doUserBroadcastAll('update', { plugins: self.plugins });
				self.doServerBroadcastAll('update', { 
					plugins: Tools.findObjects( self.plugins, { type: 'event' } ),
					commands: self.getCommandsWithSecrets()
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
		
		// validate optional plugin data parameters
		if (!this.requireValidPluginData(params, callback)) return;
		
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
				
				// update in-memory cache
				Tools.mergeHashInto( Tools.findObject( self.plugins, { id: params.id } ) || {}, plugin );
				
				// prep plugins
				self.prepPlugins();
				
				// send api response
				callback({ code: 0 });
				
				// notify all users and servers
				self.doUserBroadcastAll('update', { plugins: self.plugins });
				self.doServerBroadcastAll('update', { 
					plugins: Tools.findObjects( self.plugins, { type: 'event' } ),
					commands: self.getCommandsWithSecrets()
				});
				
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
				
				// remove from in-memory cache
				Tools.deleteObject( self.plugins, { id: params.id } );
				
				// prep plugins
				self.prepPlugins();
				
				// send api response
				callback({ code: 0 });
				
				// notify all users and servers
				self.doUserBroadcastAll('update', { plugins: self.plugins });
				self.doServerBroadcastAll('update', { 
					plugins: Tools.findObjects( self.plugins, { type: 'event' } ),
					commands: self.getCommandsWithSecrets()
				});
				
			} ); // listFindDelete
		} ); // loadSession
	}
	
	requireValidPluginData(params, callback) {
		// validate plugin data for creating or updating
		var ids = {};
		
		if (params.params) {
			if (!Array.isArray(params.params)) return this.doError('api', "Malformed plugin parameter: params (must be array)", callback);
			
			for (var idx = 0, len = params.params.length; idx < len; idx++) {
				var param = params.params[idx];
				var err_prefix = "Malformed plugin parameter: " + (param.id || 'n/a');
				
				if (typeof(param.id) != 'string') return this.doError('api', err_prefix + ": ID must be a string", callback);
				if (!param.id.match(/^[\w\-\.]+$/)) return this.doError('api', err_prefix + `: ID field must contain only alphanumerics, underscore, dash and period.`, callback);
				if (!param.id.match(/^[A-Za-z_]/)) return this.doError('api', err_prefix + `: ID field must begin with an alpha character or underscore.`, callback);
				if (param.id.match(Tools.MATCH_BAD_KEY)) return this.doError('api', err_prefix + ": Invalid ID parameter: " + params.id, callback);
				if (ids[param.id]) return this.doError('api', err_prefix + ": Duplicate ID parameter: " + params.id, callback);
				ids[param.id] = 1;
				
				if (typeof(param.type) != 'string') return this.doError('api', err_prefix + ": Type must be a string", callback);
				if (!this.config.getPath('ui.control_type_labels.' + param.type)) return this.doError('api', err_prefix + ": Invalid type", callback);
				
				if (!param.title) return this.doError('api', err_prefix + ": Title property is missing", callback);
				if (typeof(param.title) != 'string') return this.doError('api', err_prefix + ": Title must be a string", callback);
				if (param.title.match(/[<>]/)) return this.doError('api', err_prefix + ": Title contains illegal characters", callback);
				
				if (param.caption && param.caption.match(/[<>]/)) return this.doError('api', err_prefix + ": Caption contains illegal characters", callback);
				
				if (param.type == 'toolset') {
					if (!this.requireValidToolsetData(param, callback)) return false;
				}
				else if ((param.type == 'text') && param.variant) {
					if (!Tools.findObject( this.config.getPath('ui.text_field_variants'), { id: param.variant } )) {
						return this.doError('api', err_prefix + ": Invalid text field variant", callback);
					}
				}
			}
		} // params.params
		
		return true;
	}
	
	requireValidToolsetData(param, callback) {
		// ensure toolset data is properly formatted
		var self = this;
		var data = param.data;
		var err_prefix = "Toolset Data Error: ";
		
		if (!data) return this.doError('api', err_prefix + "Toolset has no data property.", callback);
		if (!data.tools) return this.doError('api', err_prefix + "Top-level tools data property is missing.", callback);
		if (!data.tools.length) return this.doError('api', err_prefix + "No tools specified in toolset (at least one is required).", callback);
		
		var is_valid = true;
		var err_msg = "";
		var ids = {};
		
		data.tools.forEach( function(tool, idx) {
			if (!is_valid) return;
			
			// id
			if (!tool.id) { err_msg = `Tool #${idx+1} is missing an ID.`; is_valid = false; return; }
			if (typeof(tool.id) != 'string') { err_msg = `Tool #${idx+1} ID is not a string.`; is_valid = false; return; }
			if (!tool.id.match(/^[\w\-\.]+$/)) { err_msg = `Tool '${tool.id}' ID must contain only alphanumerics, underscore, dash and period.`; is_valid = false; return; }
			if (!tool.id.match(/^[A-Za-z_]/)) { err_msg = `Tool '${tool.id}' ID must begin with an alpha character or underscore.`; is_valid = false; return; }
			if (tool.id.match(Tools.MATCH_BAD_KEY)) { err_msg = `Tool '${tool.id}' ID is invalid (reserved word).`; is_valid = false; return; }
			
			if (ids[tool.id]) { err_msg = `Tool ID '${tool.id}' is duplicated (each must be unique).`; is_valid = false; return; }
			ids[tool.id] = 1;
			
			// title
			if (!tool.title || !tool.title.length) { err_msg = `Tool '${tool.id}' is missing a title.`; is_valid = false; return; }
			if (typeof(tool.title) != 'string') { err_msg = `Tool '${tool.id}' title is not a string.`; is_valid = false; return; }
			if (tool.title.match(/[<>]/)) { err_msg = `Tool '${tool.id}' title contains invalid characters.`; is_valid = false; return; }
			
			// description
			if ('description' in tool) {
				if (typeof(tool.description) != 'string') { err_msg = `Tool '${tool.id}' description is not a string.`; is_valid = false; return; }
				if (tool.description.match(/[<>]/)) { err_msg = `Tool '${tool.id}' description contains invalid characters.`; is_valid = false; return; }
			}
			
			// fields
			if (!tool.fields) tool.fields = [];
			if (!Array.isArray(tool.fields)) { err_msg = `Tool '${tool.id}' fields is not an array.`; is_valid = false; return; }
			
			var fids = {};
			
			tool.fields.forEach( function(field, idx) {
				if (!is_valid) return;
				
				// id
				if (!field.id) { err_msg = `Tool '${tool.id}' field #${idx+1} is missing an ID.`; is_valid = false; return; }
				if (typeof(field.id) != 'string') { err_msg = `Tool '${tool.id}' field #${idx+1} ID is not a string.`; is_valid = false; return; }
				if (!field.id.match(/^[\w\-\.]+$/)) { err_msg = `Tool '${tool.id}' field #${idx+1} ID must contain only alphanumerics, underscore, dash and period.`; is_valid = false; return; }
				if (field.id.match(Tools.MATCH_BAD_KEY)) { err_msg = `Tool '${tool.id}' field '${field.id}' ID is invalid (reserved word).`; is_valid = false; return; }
				if (field.id == param.id) { err_msg = `Tool '${tool.id}' field '${field.id}' ID is invalid (cannot reuse toolset param ID).`; is_valid = false; return; }
				
				if (fids[field.id]) { err_msg = `Tool '${tool.id}' field ID ${field.id} is duplicated (each must be unique per tool).`; is_valid = false; return; }
				fids[field.id] = 1;
				
				// title
				if (!field.title || !field.title.length) { err_msg = `Tool '${tool.id}' field '${field.id}' is missing a title.`; is_valid = false; return; }
				if (typeof(field.title) != 'string') { err_msg = `Tool '${tool.id}' field '${field.id}' title is not a string.`; is_valid = false; return; }
				if (field.title.match(/[<>]/)) { err_msg = `Tool '${tool.id}' field '${field.id}' title contains invalid characters.`; is_valid = false; return; }
				
				// type
				if (!field.type || !field.type.length) { err_msg = `Tool '${tool.id}' field '${field.id}' is missing a type.`; is_valid = false; return; }
				if (typeof(field.type) != 'string') { err_msg = `Tool '${tool.id}' field '${field.id}' type is not a string.`; is_valid = false; return; }
				if (!field.type.match(/^(checkbox|code|hidden|select|text|textarea)$/)) { err_msg = `Tool '${tool.id}' field '${field.id}' type is invalid.`; is_valid = false; return; }
				
				// variant
				if ((field.type == 'text') && field.variant) {
					if (typeof(field.variant) != 'string') { err_msg = `Tool '${tool.id}' field '${field.id}' variant is not a string.`; is_valid = false; return; }
					
					if (!Tools.findObject( self.config.getPath('ui.text_field_variants'), { id: field.variant } )) {
						err_msg = `Tool '${tool.id}' field '${field.id}' variant is invalid.`; is_valid = false; return;
					}
				}
				
				// caption
				if (field.caption) {
					if (typeof(field.caption) != 'string') { err_msg = `Tool '${tool.id}' field '${field.id}' caption is not a string.`; is_valid = false; return; }
					if (field.caption.match(/[<>]/)) { err_msg = `Tool '${tool.id}' field '${field.id}' caption contains invalid characters.`; is_valid = false; return; }
				}
				
				// value
				if (!('value' in field)) { err_msg = `Tool '${tool.id}' field '${field.id}' is missing a value.`; is_valid = false; return; }
				if (field.type == 'checkbox') {
					if (typeof(field.value) != 'boolean') { err_msg = `Tool '${tool.id}' field '${field.id}' has an invalid checkbox value (must be boolean).`; is_valid = false; return; }
				}
				else {
					if (typeof(field.value) != 'string') { err_msg = `Tool '${tool.id}' field '${field.id}' has an invalid value (must be string).`; is_valid = false; return; }
				}
			}); // foreach field
		} ); // foreach tool
		
		if (!is_valid) return this.doError( 'api', err_prefix + err_msg, callback );
		else return true;
	}
	
}; // class Plugins

module.exports = Plugins;
