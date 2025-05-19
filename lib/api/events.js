// Orchestra API Layer - Events
// Copyright (c) 2022 - 2024 Joseph Huckaby
// Released under the MIT License

const fs = require('fs');
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
				
				// success, return item
				callback({ code: 0, event: item });
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
		if (!this.requireMaster(args, callback)) return;
		
		// auto-generate unique ID if not specified
		if (!params.id) params.id = Tools.generateShortID('e');
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			title: /\S/,
			enabled: /^(\d+|true|false)$/,
			category: /^\w+$/,
			plugin: /^\w+$/
		}, callback)) return;
		
		if (!params.targets) return this.doError('api', "Event has no targets.", callback);
		if (!params.params) params.params = {};
		
		// validate optional event data parameters
		if (!this.requireValidEventData(params, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_events', callback)) return;
			if (!self.requireCategoryPrivilege(user, params.category, callback)) return;
			if (!self.requireTargetPrivilege(user, params.targets, callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username;
			params.created = params.modified = Tools.timeNow(true);
			params.revision = 1;
			
			// event id must be unique
			if (Tools.findObject(self.events, { id: params.id })) {
				return self.doError('event', "That Event ID already exists: " + params.id, callback);
			}
			
			// apply defaults for locked plugin params, if user is not an admin
			var privs = self.getComputedPrivileges(user);
			if (!privs.admin) {
				var plugin = Tools.findObject(self.plugins, { id: params.plugin });
				if (plugin && plugin.params) plugin.params.forEach( function(param) {
					if (param.locked) params.params[ param.id ] = param.value;
				} );
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
				
				callback({ code: 0 });
				
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
			
			if (!self.requireCategoryPrivilege(user, event.category, callback)) return;
			if (!self.requireTargetPrivilege(user, event.targets, callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.modified = Tools.timeNow(true);
			params.revision = "+1";
			
			// apply defaults for locked plugin params, if user is not an admin
			var privs = self.getComputedPrivileges(user);
			if (!privs.admin) {
				var old_params = event.params || {};
				var plugin = Tools.findObject(self.plugins, { id: params.plugin });
				if (plugin && plugin.params) plugin.params.forEach( function(param) {
					if (param.locked) params.params[ param.id ] = old_params[ param.id ];
				} );
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
		
		// allow user to specify event by id or title
		var criteria = {};
		if (params.id) criteria.id = params.id;
		else if (params.title) criteria.title = params.title;
		else return this.doError('event', "Failed to locate event: No criteria specified", callback);
		
		// validate optional event data parameters
		if (!this.requireValidEventData(params, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'run_jobs', callback)) return;
			
			var event = Tools.findObject( self.events, criteria );
			if (!event) return self.doError('event', "Event not found: " + (criteria.id || criteria.title), callback);
			
			// Don't enforce enabled here, so we can override it for testing events
			// if (!event.enabled) return self.doError('event', "Event is disabled: " + (criteria.id || criteria.title), callback);
			
			if (!self.requireCategoryPrivilege(user, event.category, callback)) return;
			if (!self.requireTargetPrivilege(user, event.targets, callback)) return;
			
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
			if (!privs.admin) {
				var old_params = event.params || {};
				var plugin = Tools.findObject(self.plugins, { id: params.plugin });
				if (plugin && plugin.params) plugin.params.forEach( function(param) {
					if (param.locked) params.params[ param.id ] = old_params[ param.id ];
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
			
			self.logDebug(6, "Running job manually: " + event.title, job);
			
			self.launchJob(job, function(err, id) {
				if (err) return self.doError('event', "Failed to launch job: " + (err.message || err), callback);
				callback({ code: 0, id: id });
			});
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
		// { id, title, enabled, icon, category, tags, targets, algo, plugin, params, timings, limits, actions, notes }
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
		
		// plugin
		if (params.plugin && !Tools.findObject(this.plugins, { id: params.plugin })) {
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
		
		// timings
		if (params.timings && !Tools.isaArray(params.timings)) {
			return this.doError('api', "Malformed event parameter: timings (must be array)", callback);
		}
		var timings = params.timings || [];
		for (var idx = 0, len = timings.length; idx < len; idx++) {
			var timing = timings[idx];
			var err_prefix = "Malformed timing entry #" + Math.floor(idx + 1);
			if (!Tools.isaHash(timing)) return this.doError('api', err_prefix + " (not an object)", callback);
			
			switch (timing.type) {
				case 'schedule':
					for (var key in timing) {
						if (!key.match(/^(years|months|days|weekdays|hours|minutes)$/)) continue;
						var values = timing[key];
						if (!Tools.isaArray(values)) {
							return this.doError('api', "Malformed timing parameter: " + key + " (must be array)", callback);
						}
						for (var idx = 0, len = values.length; idx < len; idx++) {
							var value = values[idx];
							if (typeof(value) != 'number') {
								return this.doError('api', "Malformed timing parameter: " + key + " (must be array of numbers)", callback);
							}
							if ((key == 'years') && (value < 1)) {
								return this.doError('api', "Malformed timing parameter: " + key + " (out of range: " + value + ")", callback);
							}
							if ((key == 'months') && ((value < 1) || (value > 12))) {
								return this.doError('api', "Malformed timing parameter: " + key + " (out of range: " + value + ")", callback);
							}
							if ((key == 'days') && (!value || (value < -7) || (value > 31))) {
								return this.doError('api', "Malformed timing parameter: " + key + " (out of range: " + value + ")", callback);
							}
							if ((key == 'weekdays') && ((value < 0) || (value > 6))) {
								return this.doError('api', "Malformed timing parameter: " + key + " (out of range: " + value + ")", callback);
							}
							if ((key == 'hours') && ((value < 0) || (value > 23))) {
								return this.doError('api', "Malformed timing parameter: " + key + " (out of range: " + value + ")", callback);
							}
							if ((key == 'minutes') && ((value < 0) || (value > 59))) {
								return this.doError('api', "Malformed timing parameter: " + key + " (out of range: " + value + ")", callback);
							}
						} // foreach value elem
					} // forach key in timing
					
					if (timing.timezone && !timing.timezone.toString().match(/^[\w\/\-\+]+$/)) {
						return this.doError('api', err_prefix + ": Invalid timezone: " + timing.timezone, callback);
					}
					if (timing.timezone && !this.config.getPath('intl/timezones').includes(timing.timezone)) {
						return this.doError('api', err_prefix + ": Unknown timezone: " + timing.timezone, callback);
					}
				break;
				
				case 'continuous':
					// continuous mode (no options)
				break;
				
				case 'single':
					// single shot
					if (!timing.epoch || (typeof(timing.epoch) != 'number') || !timing.epoch.toString().match(RE_POS_INT)) {
						return this.doError('api', err_prefix + ": Invalid date/time specified for single shot", callback);
					}
				break;
				
				case 'catchup':
					// catch-up no options
				break;
				
				case 'range':
					if (timing.start && ((typeof(timing.start) != 'number') || !timing.start.toString().match(RE_POS_INT))) {
						return this.doError('api', err_prefix + ": Invalid start date/time specified for range", callback);
					}
					if (timing.end && ((typeof(timing.end) != 'number') || !timing.end.toString().match(RE_POS_INT))) {
						return this.doError('api', err_prefix + ": Invalid end date/time specified for range", callback);
					}
					if (timing.start && timing.end && (timing.start > timing.end)) {
						return this.doError('api', err_prefix + ": Invalid date range.  The start date cannot come after the end date.", callback);
					}
				break;
				
				case 'blackout':
					if (!timing.start || !timing.end) {
						return this.doError('api', err_prefix + ": Both a start and an end date are required for blackout.", callback);
					}
					if ((typeof(timing.start) != 'number') || !timing.start.toString().match(RE_POS_INT)) {
						return this.doError('api', err_prefix + ": Invalid start date/time specified for blackout", callback);
					}
					if ((typeof(timing.end) != 'number') || !timing.end.toString().match(RE_POS_INT)) {
						return this.doError('api', err_prefix + ": Invalid end date/time specified for blackout", callback);
					}
					if (timing.start > timing.end) {
						return this.doError('api', err_prefix + ": Invalid date range for blackout.  The start date cannot come after the end date.", callback);
					}
				break;
				
				case 'delay':
					if (!timing.duration) return this.doError('api',  err_prefix + ": Starting delay rule is missing duration.", callback);
				break;
				
				case 'plugin':
					if (!Tools.findObject(this.plugins, { id: timing.plugin_id, type: 'scheduler' })) {
						return this.doError('api', "Scheduler Plugin not found: " + timing.plugin_id, callback);
					}
				break;
				
				default:
					return this.doError('api', err_prefix + ": Unknown type", callback);
				break;
			} // switch type
		} // foreach timing
		
		if (Tools.findObjects(timings, { type: 'continuous' }).length > 1) {
			return this.doError('api', "Multiple continuous rules in timing array.", callback);
		}
		if (Tools.findObjects(timings, { type: 'catchup' }).length > 1) {
			return this.doError('api', "Multiple catch-up rules in timing array.", callback);
		}
		if (Tools.findObjects(timings, { type: 'range' }).length > 1) {
			return this.doError('api', "Multiple range rules in timing array.", callback);
		}
		
		// continuous needs to be solo rule
		if (Tools.findObject(timings, { type: 'continuous' }) && (timings.length > 1)) {
			return this.doError('api', "Continuous rule needs to be solo (no other timing rules may be present).", callback);
		}
		
		// limits
		if (!this.requireValidLimits(params, callback)) return false;
		
		// actions
		if (!this.requireValidActions(params, callback)) return false;
		
		// all good!
		return true;
	}
	
}; // class Events

module.exports = Events;
