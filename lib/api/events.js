// xyOps API Layer - Events
// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the PixlCore Sustainable Use License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const Path = require('path');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class Events {
	
	api_get_events(args, callback) {
		// get list of all events
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listGet( 'global/events', 0, 0, function(err, items, list) {
				if (err) {
					// no items found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return items and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got event list
		} ); // loaded session
	}
	
	api_get_event(args, callback) {
		// get single event for editing
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listFind( 'global/events', { id: params.id }, function(err, item) {
				if (err || !item) {
					return self.doError('event', "Failed to locate event: " + params.id, callback);
				}
				
				// include running jobs, count of queued jobs
				var jobs = self.findActiveJobs({ event: params.id, state: 'active' });
				var queued = self.findActiveJobs({ event: params.id, state: 'queued' }).length;
				
				// success, return item
				callback({ code: 0, event: item, jobs, queued });
			} ); // got event
		} ); // loaded session
	}
	
	api_get_event_history(args, callback) {
		// search activity db for revision history on specific event
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		params.offset = parseInt( params.offset || 0 );
		params.limit = parseInt( params.limit || 1 );
		
		if (!params.sort_by) params.sort_by = '_id';
		if (!params.sort_dir) params.sort_dir = -1;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var event = Tools.findObject( self.events, { id: params.id } );
			if (!event) return self.doError('event', "Event not found: " + params.id, callback);
			
			if (!self.requireCategoryPrivilege(user, event.category, callback)) return;
			if (!self.requireTargetPrivilege(user, event.targets, callback)) return;
			
			args.user = user;
			args.session = session;
			
			var query = 'action:event_create|event_update|event_delete keywords:' + params.id;
			
			self.unbase.search( 'activity', query, params, function(err, results) {
				if (err) return self.doError('db', "Failed DB search: " + err, callback);
				if (!results.records) results.records = [];
				
				// prune results for security
				results.records.forEach( function(record) {
					delete record.ip;
					delete record.ips;
					delete record.headers;
				} );
				
				self.setCacheResponse(args, self.config.get('ttl'));
				
				// make response compatible with UI pagination tools
				callback({
					code: 0,
					rows: results.records,
					list: { length: results.total || 0 }
				});
				
				self.updateDailyStat( 'search', 1 );
			}); // unbase.search
		} ); // loadSession
	}
	
	api_create_event(args, callback) {
		// add new event
		var self = this;
		var params = args.params;
		var is_workflow = false;
		if (!this.requireMaster(args, callback)) return;
		
		// auto-generate unique ID if not specified
		if (!params.id) params.id = Tools.generateShortID('e');
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			title: /\S/,
			enabled: /^(\d+|true|false)$/,
			category: /^\w+$/
		}, callback)) return;
		
		if (params.type == 'workflow') {
			// special case for workflow events
			is_workflow = true;
			params.plugin = '_workflow';
		}
		else {
			// only require these for non-workflow events
			if (!params.targets) return this.doError('api', "Event has no targets specified.", callback);
			if (!params.plugin) return this.doError('api', "Event has no plugin specified.", callback);
		}
		
		if (!params.params) params.params = {};
		
		// validate optional event data parameters
		if (!this.requireValidEventData(params, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_events', callback)) return;
			if (!self.requireCategoryPrivilege(user, params.category, callback)) return;
			if (!is_workflow && !self.requireTargetPrivilege(user, params.targets, callback)) return;
			
			// for workflows, we need to check each node
			if (is_workflow && !self.requireWorkflowPrivileges(user, params.workflow, callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username || user.id;
			params.created = params.modified = Tools.timeNow(true);
			params.revision = 1;
			
			// event id must be unique
			if (Tools.findObject(self.events, { id: params.id })) {
				return self.doError('event', "That Event ID already exists: " + params.id, callback);
			}
			
			// apply defaults for locked plugin params, if user is not an admin
			var privs = self.getComputedPrivileges(user);
			if (!is_workflow && !privs.admin) {
				var plugin = Tools.findObject(self.plugins, { id: params.plugin });
				if (plugin && plugin.params) plugin.params.forEach( function(param) {
					if (param.locked) params.params[ param.id ] = param.value;
				} );
			}
			else if (is_workflow && !privs.admin) {
				// for workflows, if user is non-admin we need to default the locked params of all event and job nodes
				self.applyDefaultWorkflowNodeParams(params);
			}
			
			// keep state for each event
			self.putState( 'events/' + params.id, params.update_state || {} );
			delete params.update_state;
			
			self.logDebug(6, "Creating new event: " + params.title, params);
			
			self.storage.listPush( 'global/events', params, function(err) {
				if (err) {
					return self.doError('event', "Failed to create event: " + err, callback);
				}
				
				self.logDebug(6, "Successfully created event: " + params.title, params);
				self.logTransaction('event_create', params.title, self.getClientInfo(args, { event: params, keywords: [ params.id ] }));
				
				callback({ code: 0, event: params });
				
				self.doUserBroadcastAll('single', { list: 'events', item: params });
				
				// update cache in background
				self.storage.listGet( 'global/events', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache events: " + err);
						return;
					}
					self.events = items;
				});
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_event(args, callback) {
		// update existing event
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		// validate optional event data parameters
		if (!this.requireValidEventData(params, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_events', callback)) return;
			
			var event = Tools.findObject( self.events, { id: params.id } );
			if (!event) return self.doError('event', "Event not found: " + params.id, callback);
			var is_workflow = (event.type == 'workflow');
			
			if (!self.requireCategoryPrivilege(user, event.category, callback)) return;
			if (!is_workflow && !self.requireTargetPrivilege(user, event.targets, callback)) return;
			
			// for workflows, we need to check each node
			if (is_workflow && !self.requireWorkflowPrivileges(user, params.workflow, callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.modified = Tools.timeNow(true);
			params.revision = "+1";
			
			// apply defaults for locked plugin params, if user is not an admin
			var privs = self.getComputedPrivileges(user);
			if (!is_workflow && !privs.admin) {
				var old_params = event.params || {};
				var plugin = Tools.findObject(self.plugins, { id: params.plugin });
				if (plugin && plugin.params) plugin.params.forEach( function(param) {
					if (param.locked) params.params[ param.id ] = old_params[ param.id ];
				} );
			}
			else if (is_workflow && !privs.admin) {
				// for workflows, if user is non-admin we need to default the locked params of all event and job nodes
				self.applyDefaultWorkflowNodeParams(params);
			}
			
			// allow api to update state for each event (e.g. cursor)
			if (params.update_state) {
				for (var key in params.update_state) {
					self.putState( 'events/' + params.id + '/' + key, params.update_state[key] );
				}
				delete params.update_state;
			}
			
			self.logDebug(6, "Updating event: " + params.id, params);
			
			self.storage.listFindUpdate( 'global/events', { id: params.id }, params, function(err, event) {
				if (err) {
					return self.doError('event', "Failed to update event: " + err, callback);
				}
				
				self.logDebug(6, "Successfully updated event: " + event.title, params);
				self.logTransaction('event_update', event.title, self.getClientInfo(args, { event: event, keywords: [ params.id ] }));
				
				callback({ code: 0 });
				
				self.doUserBroadcastAll('single', { list: 'events', item: event });
				
				// update cache in background
				self.storage.listGet( 'global/events', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache events: " + err);
						return;
					}
					self.events = items;
				}); // listGet
			} ); // listFindUpdate
		} ); // loadSession
	}
	
	api_delete_event(args, callback) {
		// delete existing event
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_events', callback)) return;
			
			var event = Tools.findObject( self.events, { id: params.id } );
			if (!event) return self.doError('event', "Event not found: " + params.id, callback);
			
			if (!self.requireCategoryPrivilege(user, event.category, callback)) return;
			if (!self.requireTargetPrivilege(user, event.targets, callback)) return;
			
			args.user = user;
			args.session = session;
			
			// check for running jobs
			var jobs = self.findActiveJobs({ event: params.id });
			if (jobs.length > 0) return self.doError('event', "Failed to delete event: " + jobs.length + " active jobs found", callback);
			
			self.logDebug(6, "Deleting event: " + params.id, params);
			
			self.storage.listFindDelete( 'global/events', { id: params.id }, function(err, event) {
				if (err) {
					return self.doError('event', "Failed to delete event: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted event: " + event.title, event);
				self.logTransaction('event_delete', event.title, self.getClientInfo(args, { event: event, keywords: [ params.id ] }));
				
				// cleanup (remove) event state
				self.deleteState( 'events/' + params.id );
				
				callback({ code: 0 });
				
				self.doUserBroadcastAll('single', { list: 'events', item: params, delete: true });
				
				// update cache in background
				self.storage.listGet( 'global/events', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache events: " + err);
						return;
					}
					self.events = items;
				});
				
				// optionally delete all jobs for event in background
				if (params.delete_jobs) {
					// for workflows, include both workflow top-level jobs AND workflow sub-jobs
					self.dbSearchDelete({
						index: 'jobs',
						query: (event.type == 'workflow') ? `(event = "${params.id}" | workflow = "${params.id}")` : `event:${params.id}`,
						title: "Bulk job deletion for: " + event.title,
						username: user.username
					});
				}
			} ); // listFindDelete
		} ); // loadSession
	}
	
	api_run_event(args, callback) {
		// run event on demand with optional overrides
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		
		// default behavor: merge post params and query together
		// alt behavior (post_data): store post params into post_data
		// Ref: https://github.com/jhuckaby/Cronicle/pull/254
		var params = Tools.copyHash( args.query, true );
		if (args.query.post_data) params.post_data = args.params;
		else Tools.mergeHashInto( params, args.params );
		
		// allow raw json to be passed in 'json' param
		if (params.json && (typeof(params.json) == 'string')) {
			try { Tools.mergeHashInto( params, JSON.parse(params.json) ); }
			catch (err) { return this.doError('api', "Failed to parse JSON: " + err, callback); }
			delete params.json;
		}
		
		// allow user to specify event by id or title
		var criteria = {};
		if (params.id) criteria.id = params.id;
		else if (params.title) criteria.title = params.title;
		else return this.doError('event', "Failed to locate event: No criteria specified", callback);
		
		// validate optional event data parameters
		if (!this.requireValidEventData(params, callback)) return;
		
		// input
		if (("input" in params) && (typeof(params.input) != 'object')) {
			return this.doError('api', "Malformed event parameter: input (must be object)", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'run_jobs', callback)) return;
			
			var event = Tools.findObject( self.events, criteria );
			if (!event) return self.doError('event', "Event not found: " + (criteria.id || criteria.title), callback);
			var is_workflow = (event.type == 'workflow');
			
			var trigger = Tools.findObject( event.triggers, { type: 'manual', enabled: true } );
			if (!trigger && !params.test) {
				return self.doError('event', "Event does not allow manual job runs: " + (criteria.id || criteria.title), callback);
			}
			
			if (!event.enabled && !params.test) return self.doError('event', "Event is disabled: " + (criteria.id || criteria.title), callback);
			
			if (!self.requireCategoryPrivilege(user, event.category, callback)) return;
			if (!is_workflow && !self.requireTargetPrivilege(user, event.targets, callback)) return;

			args.user = user;
			args.session = session;
			
			// allow for &params/foo=bar and the like
			for (var key in params) {
				if (key.match(/^(\w+)\/(\w+)$/)) {
					var parent_key = RegExp.$1;
					var sub_key = RegExp.$2;
					if (!params[parent_key]) params[parent_key] = {};
					params[parent_key][sub_key] = params[key];
					delete params[key];
				}
			}
			
			// allow sparsely populated event params in request
			if (params.params && event.params) {
				for (var key in event.params) {
					if (!(key in params.params)) params.params[key] = event.params[key];
				}
			}
			
			// apply defaults for locked plugin params, if user is not an admin
			var privs = self.getComputedPrivileges(user);
			if (!is_workflow && !privs.admin) {
				var old_params = event.params || {};
				var plugin = Tools.findObject(self.plugins, { id: params.plugin });
				if (plugin && plugin.params) plugin.params.forEach( function(param) {
					if (param.locked) params.params[ param.id ] = old_params[ param.id ];
				} );
			}
			if (!privs.admin) {
				// also apply defaults for locked event fields here
				if (event.fields) event.fields.forEach( function(field) {
					if (field.locked) params.params[ field.id ] = field.value;
				} );
			}
			
			var job = Tools.mergeHashes( Tools.copyHash(event, true), params );
			
			if (user.key) {
				// API Key
				job.source = 'key';
				job.username = user.id;
			}
			else {
				job.source = 'user';
				job.username = user.username;
			}
			
			// set start node for workflows (unless set in API)
			if (job.workflow && !job.workflow.start && trigger) job.workflow.start = trigger.id;
			
			var finish = function() {
				// ready to launch
				self.logDebug(6, "Running job manually: " + event.title, job);
				
				self.launchJob(job, function(err, id) {
					if (err) return self.doError('event', "Failed to launch job: " + (err.message || err), callback);
					callback({ code: 0, id: id });
				});
			}; // finish
			
			// if no files uploaded, launch immediately
			if (!args.files || !Tools.firstKey(args.files)) return finish();
			
			// attach all files in HTTP POST data to job as inputs
			var exp_epoch = Tools.timeNow(true) + Tools.getSecondsFromText( self.config.getPath('client.job_upload_settings.user_file_expiration') );
			var storage_key_prefix = 'files/' + (user.username || user.id) + '/' + Tools.generateUniqueBase64(16);
			var files = [];
			
			async.eachSeries( Object.values(args.files),
				function(file, callback) {
					// process single file upload
					var temp_file = file.path;
					var filename = self.cleanFilename( Path.basename(file.name) );
					var url_filename = self.cleanURLFilename( Path.basename(file.name) );
					var storage_key = storage_key_prefix + '/' + url_filename;
					
					// storage key must have a file extension to be considered binary
					if (!self.storage.isBinaryKey(storage_key)) storage_key += '.bin';
					
					self.storage.putStream( storage_key, fs.createReadStream(temp_file), function(err) {
						if (err) return callback(err);
						
						files.push({
							id: Tools.generateShortID('f'),
							date: Tools.timeNow(true),
							filename: filename, 
							path: storage_key, 
							size: file.size,
							username: user.username || user.id
						});
						
						// set expiration date for file (fires off background task)
						self.storage.expire( storage_key, exp_epoch );
						
						callback();
					} ); // putStream
				},
				function(err) {
					if (err) return self.doError('file', "Failed to process uploaded files: " + err, callback);
					
					// append files to job (it may already have some)
					if (!job.input) job.input = {};
					if (!job.input.files) job.input.files = [];
					job.input.files = job.input.files.concat( files );
					
					finish();
				}
			); // async.eachSeries
		} ); // loadSession
	}
	
	validateOptionalParams(params, rules, callback) {
		// vaildate optional params given rule set
		assert( arguments.length == 3, "Wrong number of arguments to validateOptionalParams" );
		
		for (var key in rules) {
			if (key in params) {
				var rule = rules[key];
				var type_regexp = rule[0];
				var value_regexp = rule[1];
				var value = params[key];
				var type_value = typeof(value);
				
				if (!type_value.match(type_regexp)) {
					this.doError('api', "Malformed parameter type: " + key + " (" + type_value + ")", callback);
					return false;
				}
				else if (!value.toString().match(value_regexp)) {
					this.doError('api', "Malformed parameter value: " + key, callback);
					return false;
				}
			}
		}
		
		return true;
	}
	
	requireValidEventData(params, callback) {
		// make sure optional event data follows the spec
		// { id, title, enabled, icon, category, tags, targets, algo, plugin, params, triggers, limits, actions, notes }
		var RE_TYPE_STRING = /^(string)$/,
			RE_TYPE_BOOL = /^(boolean|number)$/,
			RE_TYPE_NUM = /^(number)$/,
			RE_ALPHANUM = /^\w+$/, 
			RE_POS_INT = /^\d+$/, 
			RE_BOOL = /^(\d+|true|false)$/;
		
		var rules = {
			algo: [RE_TYPE_STRING, /^[\w\:]+$/], // allow `monitor:ID` 
			category: [RE_TYPE_STRING, RE_ALPHANUM],
			enabled: [RE_TYPE_BOOL, RE_BOOL],
			id: [RE_TYPE_STRING, RE_ALPHANUM],
			notes: [RE_TYPE_STRING, /.*/],
			plugin: [RE_TYPE_STRING, RE_ALPHANUM],
			title: [RE_TYPE_STRING, /\S/]
		};
		if (!this.validateOptionalParams(params, rules, callback)) return false;
		
		// params
		if (("params" in params) && (typeof(params.params) != 'object')) {
			return this.doError('api', "Malformed event parameter: params (must be object)", callback);
		}
		
		// category
		if (params.category && !Tools.findObject(this.categories, { id: params.category })) {
			return this.doError('api', "Category not found: " + params.category, callback);
		}
		
		// plugin (special plugins like _workflow are exempted)
		if (params.plugin && !params.plugin.match(/^_/) && !Tools.findObject(this.plugins, { id: params.plugin })) {
			return this.doError('api', "Plugin not found: " + params.plugin, callback);
		}
		
		// targets
		if (params.targets && !Tools.isaArray(params.targets)) {
			return this.doError('api', "Malformed event parameter: targets (must be array)", callback);
		}
		var targets = params.targets || [];
		for (var idx = 0, len = targets.length; idx < len; idx++) {
			var target = targets[idx];
			if (typeof(target) != 'string') return this.doError('api', "Malformed target: " + target, callback);
		}
		
		// tags
		if (params.tags && !Tools.isaArray(params.tags)) {
			return this.doError('api', "Malformed event parameter: tags (must be array)", callback);
		}
		var tags = params.tags || [];
		for (var idx = 0, len = tags.length; idx < len; idx++) {
			var tag = tags[idx];
			if ((typeof(tag) != 'string') || !tag.match(RE_ALPHANUM)) return this.doError('api', "Malformed tag: " + tag, callback);
			if (!Tools.findObject(this.tags, { id: tag } )) return this.doError('api', "Unknown tag: " + tag, callback);
		}
		
		// triggers
		if (params.triggers && !Tools.isaArray(params.triggers)) {
			return this.doError('api', "Malformed event parameter: triggers (must be array)", callback);
		}
		var triggers = params.triggers || [];
		for (var idx = 0, len = triggers.length; idx < len; idx++) {
			var trigger = triggers[idx];
			var err_prefix = "Malformed trigger entry #" + Math.floor(idx + 1);
			if (!Tools.isaHash(trigger)) return this.doError('api', err_prefix + " (not an object)", callback);
			
			switch (trigger.type) {
				case 'schedule':
					for (var key in trigger) {
						if (!key.match(/^(years|months|days|weekdays|hours|minutes)$/)) continue;
						var values = trigger[key];
						if (!Tools.isaArray(values)) {
							return this.doError('api', "Malformed trigger parameter: " + key + " (must be array)", callback);
						}
						for (var idx = 0, len = values.length; idx < len; idx++) {
							var value = values[idx];
							if (typeof(value) != 'number') {
								return this.doError('api', "Malformed trigger parameter: " + key + " (must be array of numbers)", callback);
							}
							if ((key == 'years') && (value < 1)) {
								return this.doError('api', "Malformed trigger parameter: " + key + " (out of range: " + value + ")", callback);
							}
							if ((key == 'months') && ((value < 1) || (value > 12))) {
								return this.doError('api', "Malformed trigger parameter: " + key + " (out of range: " + value + ")", callback);
							}
							if ((key == 'days') && (!value || (value < -7) || (value > 31))) {
								return this.doError('api', "Malformed trigger parameter: " + key + " (out of range: " + value + ")", callback);
							}
							if ((key == 'weekdays') && ((value < 0) || (value > 6))) {
								return this.doError('api', "Malformed trigger parameter: " + key + " (out of range: " + value + ")", callback);
							}
							if ((key == 'hours') && ((value < 0) || (value > 23))) {
								return this.doError('api', "Malformed trigger parameter: " + key + " (out of range: " + value + ")", callback);
							}
							if ((key == 'minutes') && ((value < 0) || (value > 59))) {
								return this.doError('api', "Malformed trigger parameter: " + key + " (out of range: " + value + ")", callback);
							}
						} // foreach value elem
					} // forach key in trigger
					
					if (trigger.timezone && !trigger.timezone.toString().match(/^[\w\/\-\+]+$/)) {
						return this.doError('api', err_prefix + ": Invalid timezone: " + trigger.timezone, callback);
					}
					if (trigger.timezone && !this.config.getPath('intl/timezones').includes(trigger.timezone)) {
						return this.doError('api', err_prefix + ": Unknown timezone: " + trigger.timezone, callback);
					}
				break;
				
				case 'continuous':
					// continuous mode (no options)
				break;
				
				case 'interval':
					// interval
					if (!trigger.start || (typeof(trigger.start) != 'number') || !trigger.start.toString().match(RE_POS_INT)) {
						return this.doError('api', err_prefix + ": Invalid starting date/time specified for interval", callback);
					}
					if (!trigger.duration) return this.doError('api',  err_prefix + ": Interval rule is missing duration.", callback);
				break;
				
				case 'single':
					// single shot
					if (!trigger.epoch || (typeof(trigger.epoch) != 'number') || !trigger.epoch.toString().match(RE_POS_INT)) {
						return this.doError('api', err_prefix + ": Invalid date/time specified for single shot", callback);
					}
				break;
				
				case 'manual':
					// manual (no options)
				break;
				
				case 'catchup':
					// catch-up (no options)
				break;
				
				case 'range':
					if (trigger.start && ((typeof(trigger.start) != 'number') || !trigger.start.toString().match(RE_POS_INT))) {
						return this.doError('api', err_prefix + ": Invalid start date/time specified for range", callback);
					}
					if (trigger.end && ((typeof(trigger.end) != 'number') || !trigger.end.toString().match(RE_POS_INT))) {
						return this.doError('api', err_prefix + ": Invalid end date/time specified for range", callback);
					}
					if (trigger.start && trigger.end && (trigger.start > trigger.end)) {
						return this.doError('api', err_prefix + ": Invalid date range.  The start date cannot come after the end date.", callback);
					}
				break;
				
				case 'blackout':
					if (!trigger.start || !trigger.end) {
						return this.doError('api', err_prefix + ": Both a start and an end date are required for blackout.", callback);
					}
					if ((typeof(trigger.start) != 'number') || !trigger.start.toString().match(RE_POS_INT)) {
						return this.doError('api', err_prefix + ": Invalid start date/time specified for blackout", callback);
					}
					if ((typeof(trigger.end) != 'number') || !trigger.end.toString().match(RE_POS_INT)) {
						return this.doError('api', err_prefix + ": Invalid end date/time specified for blackout", callback);
					}
					if (trigger.start > trigger.end) {
						return this.doError('api', err_prefix + ": Invalid date range for blackout.  The start date cannot come after the end date.", callback);
					}
				break;
				
				case 'delay':
					if (!trigger.duration) return this.doError('api',  err_prefix + ": Starting delay rule is missing duration.", callback);
				break;
				
				case 'precision':
					if (!trigger.seconds) return this.doError('api',  err_prefix + ": Precision rule is missing seconds array.", callback);
				break;
				
				case 'plugin':
					if (!Tools.findObject(this.plugins, { id: trigger.plugin_id, type: 'scheduler' })) {
						return this.doError('api', "Scheduler Plugin not found: " + trigger.plugin_id, callback);
					}
				break;
				
				default:
					return this.doError('api', err_prefix + ": Unknown type", callback);
				break;
			} // switch type
		} // foreach trigger
		
		// enabled triggers face additional scrutiny
		var etriggers = Tools.findObjects( triggers, { enabled: true } );
		
		if (Tools.findObjects(etriggers, { type: 'continuous' }).length > 1) {
			return this.doError('api', "Multiple continuous rules found in trigger array.", callback);
		}
		if (Tools.findObjects(etriggers, { type: 'catchup' }).length > 1) {
			return this.doError('api', "Multiple catch-up rules found in trigger array.", callback);
		}
		if (Tools.findObjects(etriggers, { type: 'manual' }).length > 1) {
			return this.doError('api', "Multiple manual rules found in trigger array.", callback);
		}
		if (Tools.findObjects(etriggers, { type: 'range' }).length > 1) {
			return this.doError('api', "Multiple range rules found in trigger array.", callback);
		}
		if (Tools.findObjects(etriggers, { type: 'precision' }).length > 1) {
			return this.doError('api', "Multiple precision rules found in trigger array.", callback);
		}
		
		// continuous needs to be solo rule
		if (Tools.findObject(etriggers, { type: 'continuous' }) && (etriggers.length > 1)) {
			return this.doError('api', "Continuous rule needs to be solo (no other triggers may be present).", callback);
		}
		
		// interval, precision and delay will clash
		if (Tools.findObject(etriggers, { type: 'interval' }) && Tools.findObject(etriggers, { type: 'precision' })) {
			return this.doError('api', "Interval and precision triggers are mutually exclusive.", callback);
		}
		if (Tools.findObject(etriggers, { type: 'interval' }) && Tools.findObject(etriggers, { type: 'delay' })) {
			return this.doError('api', "Interval and delay triggers are mutually exclusive.", callback);
		}
		if (Tools.findObject(etriggers, { type: 'precision' }) && Tools.findObject(etriggers, { type: 'delay' })) {
			return this.doError('api', "Precision and delay triggers are mutually exclusive.", callback);
		}
		
		// limits
		if (!this.requireValidLimits(params, callback)) return false;
		
		// actions
		if (!this.requireValidActions(params, callback)) return false;
		
		// user fields
		if (params.fields) {
			if (!Array.isArray(params.fields)) return this.doError('api', "Malformed event parameter: fields (must be array)", callback);
			
			for (var idx = 0, len = params.fields.length; idx < len; idx++) {
				var field = params.fields[idx];
				var err_prefix = "Malformed user field #" + (field.id || 'n/a');
				
				if (typeof(field.id) != 'string') return this.doError('api', err_prefix + ": ID must be a string", callback);
				if (field.id.match(Tools.MATCH_BAD_KEY)) return this.doError('api', err_prefix + ": Invalid ID parameter: " + params.id, callback);
				
				if (typeof(field.type) != 'string') return this.doError('api', err_prefix + ": Type must be a string", callback);
				
				if (field.title && (typeof(field.title) != 'string')) return this.doError('api', err_prefix + ": Title must be a string", callback);
				if (field.title && field.title.match(/[<>]/)) return this.doError('api', err_prefix + ": Title contains illegal characters", callback);
			}
		}
		
		// workflows
		if (params.type == 'workflow') {
			if (!params.workflow) return this.doError('api', "Event has no workflow object specified.", callback);
			if (typeof(params.workflow) != 'object') return this.doError('api', "Event has invalid workflow object specified.", callback);
			if (!params.workflow.nodes) return this.doError('api', "Event has no workflow nodes specified.", callback);
			if (!Array.isArray(params.workflow.nodes)) return this.doError('api', "Event has invalid workflow nodes specified (must be array).", callback);
			if (!params.workflow.connections) return this.doError('api', "Event has no workflow connections specified.", callback);
			if (!Array.isArray(params.workflow.connections)) return this.doError('api', "Event has invalid workflow connections specified (must be array).", callback);
			
			// validate all nodes
			var nodes = params.workflow.nodes;
			for (var idx = 0, len = nodes.length; idx < len; idx++) {
				var node = nodes[idx];
				if (!Tools.isaHash(node)) return this.doError('api', "Workflow node #" + Math.floor(idx + 1) + " is not an object", callback);
				if (!node.id) return this.doError('api', "Workflow node #" + Math.floor(idx + 1) + " has no ID (id) property", callback);
				var err_prefix = "Malformed workflow node #" + node.id;
				
				if (typeof(node.id) != 'string') return this.doError('api', err_prefix + ": Node ID is not a string", callback);
				if (!node.id.match(/^\w+$/)) return this.doError('api', err_prefix + ": Node ID is not alphanumeric", callback);
				if (node.id.match(Tools.MATCH_BAD_KEY)) return this.doError('api', err_prefix + ": Invalid ID parameter: " + node.id, callback);
				
				if (!node.type) return this.doError('api', err_prefix + ": Node is missing a type", callback);
				if (typeof(node.type) != 'string') return this.doError('api', err_prefix + ": Node type is not a string", callback);
				if (!Tools.findObject( this.config.getPath('ui.workflow_node_types'), { id: node.type } )) return this.doError('api', err_prefix + ": Node type is invalid", callback);
				
				if (typeof(node.x) != 'number') return this.doError('api', err_prefix + ": Node X coordinate is invalid", callback);
				if (typeof(node.y) != 'number') return this.doError('api', err_prefix + ": Node Y coordinate is invalid", callback);
				
				if (node.data) {
					if (!Tools.isaHash(node.data)) return this.doError('api', err_prefix + ": Node data is not an object", callback);
					
					if (node.data.title && (typeof(node.data.title) != 'string')) return this.doError('api', err_prefix + ": Node data.title is not a string", callback);
					if (node.data.title && node.data.title.match(/[<>]/)) return this.doError('api', err_prefix + ": Node data.title contains illegal characters", callback);
					
					if (node.data.label && (typeof(node.data.label) != 'string')) return this.doError('api', err_prefix + ": Node data.label is not a string", callback);
					if (node.data.label && node.data.label.match(/[<>]/)) return this.doError('api', err_prefix + ": Node data.label contains illegal characters", callback);
					
					if (node.data.icon && (typeof(node.data.icon) != 'string')) return this.doError('api', err_prefix + ": Node data.icon is not a string", callback);
					if (node.data.icon && !node.data.icon.match(/^[\w\-]+$/)) return this.doError('api', err_prefix + ": Node data.icon contains illegal characters", callback);
				} // node.data
			} // foreach node
			
			// validate all connections
			var conns = params.workflow.connections;
			for (var idx = 0, len = conns.length; idx < len; idx++) {
				var conn = conns[idx];
				if (!Tools.isaHash(conn)) return this.doError('api', "Workflow connection #" + Math.floor(idx + 1) + " is not an object", callback);
				if (!conn.id) return this.doError('api', "Workflow connection #" + Math.floor(idx + 1) + " has no ID (id) property", callback);
				var err_prefix = "Malformed workflow connection #" + conn.id;
				
				if (typeof(conn.id) != 'string') return this.doError('api', err_prefix + ": ID is not a string", callback);
				if (!conn.id.match(/^\w+$/)) return this.doError('api', err_prefix + ": ID is not alphanumeric", callback);
				if (conn.id.match(Tools.MATCH_BAD_KEY)) return this.doError('api', err_prefix + ": Invalid ID parameter: " + conn.id, callback);
				
				if (!conn.source || !Tools.findObject(nodes, { id: conn.source })) return this.doError('api', err_prefix + ": Connection source node is invalid", callback);
				if (!conn.dest || !Tools.findObject(nodes, { id: conn.dest })) return this.doError('api', err_prefix + ": Connection destination node is invalid", callback);
			} // foreach conn
		}
		
		// all good!
		return true;
	}
	
	applyDefaultWorkflowNodeParams(params) {
		// for workflows, we need to apply defaults for all locked params of all event and job nodes
		// this assumes the current user is not an admin
		var self = this;
		if (!params.workflow || !params.workflow.nodes) return;
		
		params.workflow.nodes.forEach( function(node) {
			if (node.type == 'event') {
				// apply defaults for locked event + plugin params, if user is not an admin
				var event = Tools.findObject(self.events, { id: node.data.event });
				if (!event) return;
				
				if (event.fields) event.fields.forEach( function(field) {
					if (field.locked) node.data.params[ field.id ] = field.value;
				} );
				
				var plugin = Tools.findObject(self.plugins, { id: event.plugin });
				if (plugin && plugin.params) plugin.params.forEach( function(param) {
					if (param.locked) node.data.params[ param.id ] = param.value;
				} );
			}
			else if (node.type == 'job') {
				// apply defaults for locked plugin params, if user is not an admin
				var plugin = Tools.findObject(self.plugins, { id: node.data.plugin });
				if (plugin && plugin.params) plugin.params.forEach( function(param) {
					if (param.locked) node.data.params[ param.id ] = param.value;
				} );
			}
		}); // foreach node
	}
	
	requireWorkflowPrivileges(user, workflow, callback) {
		// check if user has required privileges for all nodes in workflow
		var self = this;
		if (!workflow || !workflow.nodes) return true; // sanity
		
		for (var idx = 0, len = workflow.nodes.length; idx < len; idx++) {
			var node = workflow.nodes[idx];
			
			if (node.type == 'event') {
				var event = Tools.findObject(self.events, { id: node.data.event });
				if (!event) continue; // skip missing events
				
				if (!self.requireCategoryPrivilege(user, event.category, callback)) return false;
				if (!self.requireTargetPrivilege(user, event.targets, callback)) return false;
			}
			else if (node.type == 'job') {
				if (!self.requireCategoryPrivilege(user, node.data.category, callback)) return false;
				if (!self.requireTargetPrivilege(user, node.data.targets, callback)) return false;
			}
		} // foreach node
		
		return true; // all good!
	}
	
}; // class Events

module.exports = Events;
