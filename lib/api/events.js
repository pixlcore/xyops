// xyOps API Layer - Events
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const Path = require('path');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");
const jexl = require('jexl');

class Events {
	
	api_get_events(args, callback) {
		// get list of all events
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			// optional search with basic criteria
			var events = Tools.firstKey(params) ? Tools.findObjects( self.events, params ) : self.events;
			
			// filter by user limits
			events = self.getUserLimitedEvents( self.getComputedUser(user), events );
			
			// return items and list header
			callback({
				code: 0,
				rows: events,
				list: { length: events.length }
			});
			
		} ); // loaded session
	}
	
	api_get_event(args, callback) {
		// get single event for editing
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var event = Tools.findObject( self.events, { id: params.id } );
			if (!event) return self.doError('notfound', "Failed to locate event: " + params.id, callback);
			
			if (!self.requireCategoryPrivilege(user, event.category, callback)) return;
			if (!self.requireTargetPrivilege(user, event.targets, callback)) return;
			
			// include running jobs, count of queued jobs
			var jobs = self.getUserLimitedJobs( self.getComputedUser(user), self.findActiveJobs({ event: params.id, state: 'active' }) );
			var queued = self.findActiveJobs({ event: params.id, state: 'queued' }).length;
			
			// success, return event and extras
			callback({ code: 0, event, jobs, queued });
			
		} ); // loaded session
	}
	
	api_get_event_history(args, callback) {
		// search activity db for revision history on specific event
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
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
			
			params.query = 'action:event_create|event_update|event_delete keywords:' + params.id;
			params.username = user.username || user.id;
			
			self.unbaseSearch( 'activity', params.query, params, function(err, results) {
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
			}); // unbaseSearch
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
			id: /^[a-z0-9_]+$/,
			title: /\S/,
			enabled: /^(\d+|true|false)$/,
			category: /^\w+$/
		}, callback)) return;
		
		if (params.type == 'workflow') {
			// special case for workflow events
			is_workflow = true;
			params.plugin = '_workflow';
			params.targets = [];
		}
		else {
			// only require these for non-workflow events
			if (!params.targets || !params.targets.length) return this.doError('api', "Event has no targets specified.", callback);
			if (!params.algo) return this.doError('api', "Event has no algo specified.", callback);
			if (!params.plugin) return this.doError('api', "Event has no plugin specified.", callback);
		}
		
		if (!params.params) params.params = {};
		if (!params.limits) params.limits = [];
		if (!params.actions) params.actions = [];
		if (!params.triggers) params.triggers = [];
		if (!params.fields) params.fields = [];
		
		// launch context is resolved from trusted plugin/config data at runtime
		this.deleteJobLaunchContext(params);

		// apply field defaults to triggers
		this.prepEventTriggerParams( params.triggers, params.fields );
		
		// validate optional event data parameters
		if (!this.requireValidEventData(params, callback)) return;
		
		// All calendar boundary triggers operate on whole scheduler minutes.
		this.normalizeEventTriggers(params.triggers);
		
		// secure any magic keys (hash them into tokens)
		this.setupMagicTriggers(params);
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_events', callback)) return;
			if (!self.requireCategoryPrivilege(user, params.category, callback)) return;
			if (!is_workflow && !self.requireAllTargetPrivileges(user, params.targets, callback)) return;
			
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
				} ); // foreach plugin param
			}
			else if (is_workflow && !privs.admin) {
				// for workflows, if user is non-admin we need to default the locked params of all event and job nodes
				self.applyDefaultWorkflowNodeParams(params, null);
			}
			
			if (!self.requireRuntimeTargetPrivileges(user, params, callback)) return;
			
			// ensure user has proper access to all nested nodes and replays
			self.verifyDeepWorkflowAccess( user, params.workflow, function(err) {
				if (err) return self.doError('access', err.message || err, callback);
				
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
					
					// add to in-memory cache
					self.events.push( Tools.copyHash(params, true) );
					
					// send api response
					callback({ code: 0, event: params });
					
					// update all users
					self.doUserBroadcastAllEvents();
					
				} ); // listPush
			}); // verifyDeepWorkflowAccess
		} ); // loadSession
	}
	
	api_update_event(args, callback) {
		// update existing event
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_events', callback)) return;
			
			var event = Tools.findObject( self.events, { id: params.id } );
			if (!event) return self.doError('event', "Event not found: " + params.id, callback);
			var is_workflow = (event.type == 'workflow');
			
			// do not allow type to be changed
			delete params.type;
			
			// launch context is resolved from trusted plugin/config data at runtime
			self.deleteJobLaunchContext(params);

			// apply field defaults to triggers
			self.prepEventTriggerParams( params.triggers || event.triggers, params.fields || event.fields );
			
			// validate optional event data parameters
			if (!self.requireValidEventData( Tools.mergeHashes(event, params), callback)) return;
			
			// Only normalize incoming triggers.  If this is a partial update without
			// triggers, leave the existing event data untouched.
			self.normalizeEventTriggers(params.triggers);
			
			// secure any magic keys (hash them into tokens)
			self.setupMagicTriggers(params);
			
			if (!self.requireCategoryPrivilege(user, event.category, callback)) return;
			if (!is_workflow && !self.requireAllTargetPrivileges(user, event.targets, callback)) return;
			if (!self.requireRuntimeTargetPrivileges(user, event, callback)) return;
			
			// for workflows, we need to check each node
			if (is_workflow && !self.requireWorkflowPrivileges(user, event.workflow, callback)) return;
			
			// check revision against current
			if (params.revision && event.revision && (params.revision != event.revision)) {
				return self.doError('event', `Event out of date: ${params.id} (Revision mismatch: ${params.revision} != ${event.revision})`, callback);
			}
			
			// workflows always require an empty targets array
			if (is_workflow) params.targets = [];
			
			args.user = user;
			args.session = session;
			
			params.modified = Tools.timeNow(true);
			params.revision = "+1";
			
			// apply defaults for locked plugin params, if user is not an admin
			var privs = self.getComputedPrivileges(user);
			
			if (!is_workflow && !privs.admin) {
				var old_params = event.params || {};
				var plugin = Tools.findObject(self.plugins, { id: params.plugin || event.plugin });
				
				// partial top-level updates may omit params entirely, so preserve the existing values
				if (!params.params) params.params = Tools.copyHash(old_params, true);
				
				// if plugin has changed, we need to default values to the plugin defaults, NOT the previous event values
				var plugin_changed = (params.plugin && (params.plugin != event.plugin));
				
				if (plugin && plugin.params) plugin.params.forEach( function(param) {
					if (param.locked) params.params[ param.id ] = plugin_changed ? param.value : old_params[ param.id ];
				} ); // foreach plugin param
			}
			else if (is_workflow && !privs.admin) {
				// for workflows, if user is non-admin we need to default the locked params of all event and job nodes
				self.applyDefaultWorkflowNodeParams(params, event);
			}
			
			// perform local merge so we can re-check user limits
			var merged = Tools.mergeHashes( event, params );
			if (!self.requireCategoryPrivilege(user, merged.category, callback)) return;
			if (!is_workflow && !self.requireAllTargetPrivileges(user, merged.targets, callback)) return;
			if (!self.requireRuntimeTargetPrivileges(user, merged, callback)) return;
			if (is_workflow && !self.requireWorkflowPrivileges(user, merged.workflow, callback)) return;
			
			// ensure user has proper access to all nested nodes and replays, pre and post update merge
			self.verifyDeepWorkflowAccess( user, event.workflow, function(err) {
				if (err) return self.doError('access', err.message || err, callback);
				
				self.verifyDeepWorkflowAccess( user, merged.workflow, function(err) {
					if (err) return self.doError('access', err.message || err, callback);
					
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
						
						// update in-memory cache
						Tools.mergeHashInto( Tools.findObject( self.events, { id: params.id } ) || {}, event );
						
						// send api response
						callback({ code: 0, event });
						
						// update all users
						self.doUserBroadcastAllEvents();
						
					} ); // listFindUpdate
				}); // verifyDeepWorkflowAccess (inner)
			}); // verifyDeepWorkflowAccess (outer)
		} ); // loadSession
	}
	
	api_delete_event(args, callback) {
		// delete existing event
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^[a-z0-9_]+$/
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
				
				// remove from in-memory cache
				Tools.deleteObject( self.events, { id: params.id } );
				
				// send api response
				callback({ code: 0 });
				
				// update all users
				self.doUserBroadcastAllEvents();
				
				// optionally delete all jobs for event in background
				if (params.delete_jobs) {
					// for workflows, include both workflow top-level jobs AND workflow sub-jobs
					self.dbSearchDelete({
						index: 'jobs',
						query: (event.type == 'workflow') ? `(event = "${params.id}" | workflow = "${params.id}")` : `event:${params.id}`,
						title: "Bulk job deletion for: " + event.title,
						username: user.username || user.id,
						quiet: true
					});
				}
			} ); // listFindDelete
		} ); // loadSession
	}
	
	api_run_event(args, callback) {
		// run event on demand with optional overrides
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		
		// optionally wait for job to complete
		var do_wait = !!args.request.url.replace(/\?.*$/, '').match(/\/wait\b/);
		
		// default behavor: merge post params and query together
		// alt behavior (post_data): store post params into post_data
		// Ref: https://github.com/jhuckaby/Cronicle/pull/254
		var params = Tools.copyHash( args.query, true );
		if (args.query.post_data) params.post_data = args.params;
		else Tools.mergeHashInto( params, args.params );
		
		// allow raw json to be passed in 'json' param
		if (params.json && (typeof(params.json) == 'string')) {
			try { Tools.mergeHashInto( params, Tools.sjson.parse(params.json) ); }
			catch (err) { return this.doError('api', "Failed to parse JSON: " + err, callback); }
			delete params.json;
		}
		
		if (!params.params || (typeof(params.params) != 'object') || Array.isArray(params.params)) params.params = {};
		
		// allow user to specify event by id or title
		var criteria = {};
		if (params.id) criteria.id = params.id;
		else if (params.title) criteria.title = params.title;
		else return this.doError('event', "Failed to locate event: No criteria specified", callback);
		
		// validate files if present
		if (!this.validateFiles(args, callback)) return;
		
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
			if (!is_workflow && !self.requireAllTargetPrivileges(user, event.targets, callback)) return;
			if (!self.requireRuntimeTargetPrivileges(user, event, callback)) return;
			if (is_workflow && !self.requireWorkflowPrivileges(user, event.workflow, callback)) return;
			
			args.user = user;
			args.session = session;
			
			// launch context is resolved from trusted plugin/config data at runtime
			self.deleteJobLaunchContext(params);
			
			// do not allow category or event type to be changed
			delete params.type;
			delete params.category;
			
			// if overriding targets, confirm user has permission
			if (params.targets && !self.requireAllTargetPrivileges(user, params.targets, callback)) return;
			
			// allow for &params/foo=bar and the like (legacy from cronicle)
			for (var key in params) {
				if (key.match(/^(\w+)\/(\w+)$/)) {
					var parent_key = RegExp.$1;
					var sub_key = RegExp.$2;
					if (!params[parent_key]) params[parent_key] = {};
					params[parent_key][sub_key] = params[key];
					delete params[key];
				}
			}
			
			// allow sparsely populated event params and fields in request
			if (event.params) {
				for (var key in event.params) {
					if (!(key in params.params)) params.params[key] = event.params[key];
				}
			}
			if (event.fields) event.fields.forEach( function(field) {
				var key = field.id;
				if (!(key in params.params)) params.params[key] = field.value;
			});
			
			// apply defaults for locked plugin params, if user is not an admin
			var privs = self.getComputedPrivileges(user);
			
			if (!is_workflow && !privs.admin) {
				var old_params = event.params || {};
				var plugin = Tools.findObject(self.plugins, { id: params.plugin || event.plugin });
				
				// if plugin has changed, we need to default values to the plugin defaults, NOT the previous event values
				var plugin_changed = (params.plugin && (params.plugin != event.plugin));
				
				if (plugin && plugin.params) plugin.params.forEach( function(param) {
					if (param.locked) params.params[ param.id ] = plugin_changed ? param.value : old_params[ param.id ];
				} ); // foreach plugin param
			}
			else if (is_workflow && !privs.admin) {
				// for workflows, if user is non-admin we need to default the locked params of all event and job nodes
				self.applyDefaultWorkflowNodeParams(params, event);
			}
			
			var merged = Tools.mergeHashes(event, params);
			if (!self.requireValidEventData(merged, callback)) return;
			if (!self.requireRuntimeTargetPrivileges(user, merged, callback)) return;
			if (is_workflow && !self.requireWorkflowPrivileges(user, merged.workflow, callback)) return;
			
			// validate event field param values
			if (event.fields) {
				try { self.validateParamValues(params.params, event.fields); }
				catch (err) { return self.doError('api', "Event: " + err.message, callback); }
			}
			
			// ensure user has proper access to all nested nodes and replays
			self.verifyDeepWorkflowAccess( user, merged.workflow, function(err) {
				if (err) return self.doError('access', err.message || err, callback);
				
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
						if (do_wait) {
							self.waitForJob( id, function(err, results) {
								if (err) return self.doError('event', "Failed to wait for job: " + err);
								callback({ code: 0, ...results });
							} ); // waitForJob
						}
						else {
							callback({ code: 0, id: id });
						}
					});
				}; // finish
				
				// if no files uploaded, launch immediately
				if (!args.files || !Tools.firstKey(args.files)) return finish();
				
				// attach all files in HTTP POST data to job as inputs
				var exp_epoch = Tools.timeNow(true) + Tools.getSecondsFromText( self.config.getPath('client.job_upload_settings.user_file_expiration') );
				var storage_key_prefix = 'files/' + (user.username || user.id) + '/' + Tools.generateUniqueBase64(32);
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
			}); // verifyDeepWorkflowAccess
		} ); // loadSession
	}
	
	api_magic(args, callback) {
		// run event on demand with magic link auth
		// params here directly map to event.params, with exceptions (json, input)
		var self = this;
		
		// remove args.params.raw as it is a buffer
		if (args.params.raw && Buffer.isBuffer(args.params.raw)) delete args.params.raw;
		
		var params = Tools.mergeHashes( args.params, args.query );
		if (!this.requireMaster(args, callback)) return;
		if (!this.validateFiles(args, callback)) return;
		
		// allow raw json to be passed in 'json' param
		if (params.json && (typeof(params.json) == 'string')) {
			try { Tools.mergeHashInto( params, Tools.sjson.parse(params.json) ); }
			catch (err) { return this.doError('api', "Failed to parse JSON: " + err, callback); }
			delete params.json;
		}
		
		// locate event (and trigger) by magic token
		var matches = args.request.url.replace(/\?.*$/, '').match(/\/magic\/(v\d+\/)?([\w\-]+)(\/.+)?/);
		if (!matches) return this.doError('api', "Malformed URL.", callback); // deliberately vague
		
		var token = matches[2];
		var do_wait = matches[3] && matches[3].match(/\/wait\b/);
		var do_204 = matches[3] && matches[3].match(/\/204\b/);
		var trigger = null;
		var event = this.events.find( function(event) {
			var token_hash = Tools.digestHex( token + event.id, 'sha256' );
			trigger = Tools.findObject( event.triggers || [], { enabled: true, type: 'magic', token: token_hash } );
			return !!trigger;
		} );
		if (!event) return this.doError('api', "Authentication failed.", callback); // deliberately vague
		if (!event.enabled) return this.doError('event', "Event is disabled: " + event.title, callback);
		var is_workflow = (event.type == 'workflow');
		
		// input (data)
		var input = params.input || null;
		delete params.input;
		if (input && (typeof(input) != 'object')) {
			return this.doError('api', "Malformed event parameter: input (must be object)", callback);
		}
		
		// Only declared Event fields and Plugin params may come from the caller.
		// Extra names would otherwise become arbitrary process environment vars.
		// Check after unpacking json/input, but before merging trusted saved values.
		var plugin = is_workflow ? null : Tools.findObject(this.plugins, { id: event.plugin });
		var allowed_params = new Set( (event.fields || []).concat(plugin ? (plugin.params || []) : []).map(field => field.id) );
		
		for (var key of Object.keys(params)) {
			if (!allowed_params.has(key)) delete params[key];
		}
		
		// allow sparsely populated event params and fields in request
		if (event.params) {
			for (var key in event.params) {
				if (!(key in params)) params[key] = event.params[key];
			}
		}
		if (event.fields) event.fields.forEach( function(field) {
			var key = field.id;
			if (!(key in params)) params[key] = field.value;
		});
		
		if (!this.requireValidJobOverrides(params, "Magic trigger params", callback)) return;

		if (!is_workflow) {
			var old_params = event.params || {};
			
			if (plugin && plugin.params) {
				plugin.params.forEach( function(param) {
					if (param.locked) params[ param.id ] = old_params[ param.id ];
				} ); // foreach plugin param
			
				try { this.validateParamValues(params, plugin.params); }
				catch (err) { return self.doError('api', "Plugin: " + err.message, callback); }
			}
		}
		
		// validate event fields
		if (event.fields) {
			try { this.validateParamValues(params, event.fields); }
			catch (err) { return self.doError('api', "Event: " + err.message, callback); }
		}
		
		var job = Tools.copyHash(event, true);
		job.source = 'magic';
		job.params = params;
		job.input = input;
		
		// store magic request metadata in job
		job.magic = {
			headers: this.getClientInfo(args).headers, // scrubbed
			body: args.request.body ? args.request.body.toString('utf8') : null,
			params: args.params,
			query: args.query
		};
		
		// set start node for workflows (unless set in API)
		if (job.workflow && !job.workflow.start && trigger) job.workflow.start = trigger.id;
		
		var finish = function() {
			// ready to launch
			self.logDebug(6, "Running job magically: " + event.title, job);
			
			self.launchJob(job, function(err, id) {
				if (err) return self.doError('event', "Failed to launch job: " + (err.message || err), callback);
				if (do_wait) {
					self.waitForJob( id, function(err, results) {
						if (err) return self.doError('event', "Failed to wait for job: " + err);
						
						if (do_204) callback('204 No Content', { 'X-Job-ID': id, 'X-Job-Code': results.job.code, 'X-Job-Description': results.job.description || '' }, '');
						else callback({ code: 0, ...results });
					} ); // waitForJob
				}
				else {
					var stream_token = Tools.digestHex( 'stream' + id + self.config.get('secret_key') );
					
					if (do_204) callback('204 No Content', { 'X-Job-ID': id, 'X-Stream-Token': stream_token }, '');
					else callback({ code: 0, description: "Your job has started in the background.", id: id, stream: stream_token });
				}
			});
		}; // finish
		
		// if no files uploaded, launch immediately
		if (!args.files || !Tools.firstKey(args.files)) return finish();
		var input_files = Object.values(args.files);
		
		// enforce max file limit here
		var file_limit = Tools.findObject( event.limits || [], { type: 'file', enabled: true } );
		if (file_limit) {
			// file count limit
			if (input_files.length > file_limit.amount) {
				// Note: 0 means NO files allowed, not infinite
				if (!file_limit.amount) return this.doError('event', "Event does not allow file uploads.", callback);
				else return this.doError('event', "Uploaded file count exceeds limit (" + file_limit.amount + ").", callback);
			}
			
			// total size limit
			if (file_limit.size) {
				var total_size = 0;
				input_files.forEach( function(file, idx) { total_size += file.size; } );
				
				if (total_size > file_limit.size) {
					return this.doError('event', "Uploaded file total size exceeds limit (" + Tools.getTextFromBytes(file_limit.size) + ")", callback);
				}
			}
		} // file limiter
		
		// attach all files in HTTP POST data to job as inputs
		var exp_epoch = Tools.timeNow(true) + Tools.getSecondsFromText( self.config.getPath('client.job_upload_settings.user_file_expiration') );
		var storage_key_prefix = 'files/magic/' + Tools.generateUniqueBase64(32);
		var files = [];
		
		async.eachSeries( input_files,
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
						magic: true
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
	}
	
	api_form(args, callback) {
		// HTML presentation of magic landing page
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		
		// locate event (and trigger) by magic token
		var matches = args.request.url.match(/\/form\/(v\d+\/)?([\w\-]+)/);
		if (!matches) return this.doError('api', "Malformed URL.", callback); // deliberately vague
		
		var token = matches[2];
		var trigger = null;
		var event = this.events.find( function(event) {
			var token_hash = Tools.digestHex( token + event.id, 'sha256' );
			trigger = Tools.findObject( event.triggers || [], { enabled: true, type: 'magic', token: token_hash } );
			return !!trigger;
		} );
		if (!event) return this.doError('api', "Authentication failed.", callback); // deliberately vague
		if (!event.enabled) return this.doError('event', "Event is disabled: " + event.title, callback);
		
		fs.readFile( 'htdocs/index.html', 'utf8', function(err, html) {
			if (err) return self.doError('internal', "Failed to load index.html: " + err, callback);
			
			// replace config loader with our own, plus token
			html = html.replace( /\"\/api\/app\/config\"/, '"/api/app/form_config/' + token + '"' );
			
			self.setCacheResponse(args, self.config.get('ttl'));
			callback( "200 OK", { 'Content-Type': "text/html" }, html );
		} ); // fs.readFile
	}
	
	setupMagicTriggers(params) {
		// if any magic link triggers were added with keys, hash them into tokens and delete the keys
		(params.triggers || []).forEach( function(trigger) {
			if (trigger.type != 'magic') return;
			if (!trigger.key) return;
			trigger.token = Tools.digestHex( trigger.key + params.id, 'sha256' );
			delete trigger.key;
		} );
	}
	
	prepEventTriggerParams(triggers, fields) {
		// apply field defaults to trigger params if not specified
		// (hidden fields ALWAYS need to be set to default)
		if (!triggers || !triggers.length || !fields || !fields.length) return;
		
		triggers.forEach( function(trigger) {
			if (!trigger.type || !trigger.type.match(/^(schedule|single|interval|startup|keyboard|activity)$/)) return;
			if (!trigger.params) trigger.params = {};
			
			fields.forEach( function(field) {
				if (!(field.id in trigger.params) || (field.type == 'hidden')) {
					trigger.params[field.id] = (field.type == 'json') ? Tools.copyHash(field.value || {}, true) : field.value;
				}
			} ); // foreach field
		} ); // foreach trigger
	}
	
	normalizeEventTriggers(triggers) {
		// Single Shot, Range and Blackout triggers are evaluated on whole minutes.
		// Floor their absolute timestamps here so API clients cannot persist hidden
		// seconds which the scheduler and datetime-local UI are not designed to use.
		var self = this;
		
		(triggers || []).forEach( function(trigger) {
			switch (trigger.type) {
				case 'single':
					trigger.epoch = Math.floor(trigger.epoch / 60) * 60;
				break;
				
				case 'range':
				case 'blackout':
					if (trigger.start) trigger.start = Math.floor(trigger.start / 60) * 60;
					if (trigger.end) trigger.end = Math.floor(trigger.end / 60) * 60;
				break;
				
				case 'magic':
					if (trigger.body) trigger.body = self.sanitizeMarkdown(trigger.body);
				break;
			} // switch trigger type
		} ); // foreach trigger
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
		if (!this.requireValidJobOverrides(params.params, "Event params", callback)) return false;
		
		// category
		if (params.category && !Tools.findObject(this.categories, { id: params.category })) {
			return this.doError('api', "Category not found: " + params.category, callback);
		}
		
		// plugin (special plugins like _workflow are exempted)
		if (params.plugin && !params.plugin.match(/^_/) && !Tools.findObject(this.plugins, { id: params.plugin })) {
			return this.doError('api', "Plugin not found: " + params.plugin, callback);
		}
		
		// plugin params
		if (params.plugin && !params.plugin.match(/^_/) && params.params) {
			var plugin = Tools.findObject(this.plugins, { id: params.plugin });
			try { this.validateParamValues(params.params, plugin.params); }
			catch (err) { return this.doError('api', "Event Plugin: " + err.message, callback); }
		}
		
		// targets
		if (params.targets && !Tools.isaArray(params.targets)) {
			return this.doError('api', "Malformed event parameter: targets (must be array)", callback);
		}
		var targets = params.targets || [];
		
		// Empty target lists are exclusively reserved for workflows.  Keeping
		// this invariant here allows target privilege checks to safely recognize
		// workflows without needing the complete event object at every call site.
		if ((params.type != 'workflow') && !targets.length) {
			return this.doError('api', "Event has no targets specified.", callback);
		}
		
		for (var idx = 0, len = targets.length; idx < len; idx++) {
			var target = targets[idx];
			if (typeof(target) != 'string') return this.doError('api', "Malformed target: " + target, callback);
		}
		
		// pre-compile target exp to check syntax
		if (params.expression) {
			try { jexl.compile( params.expression ); }
			catch (err) {
				return this.doError('api', "Failed to compile target expression: " + params.expression + ": " + err, callback);
			}
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
						for (var idy = 0, ley = values.length; idy < ley; idy++) {
							var value = values[idy];
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
				
				case 'startup':
					// startup mode (no options)
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
				
				case 'magic':
					// magic link
				break;
				
				case 'keyboard':
					// keyboard shortcuts
					if (!trigger.keys || !Array.isArray(trigger.keys) || !trigger.keys.length) {
						return this.doError('api', err_prefix + ": Keyboard trigger has no shortcuts.", callback);
					}
				break;
				
				case 'activity':
					// system activities
					if (!trigger.activities || !Array.isArray(trigger.activities) || !trigger.activities.length) {
						return this.doError('api', err_prefix + ": Activity trigger has no activities.", callback);
					}
				break;
				
				case 'catchup':
					// catch-up (no options)
				break;
				
				case 'nth':
					// every nth
					if (!trigger.every || (trigger.every < 2)) return this.doError('api', err_prefix + ": Every Nth value is invalid (must be 2 or higher).", callback);
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
				
				case 'quiet':
					if (!trigger.invisible && !trigger.ephemeral) return this.doError('api',  err_prefix + ": Quiet rule must have one or more modes enabled.", callback);
				break;
				
				case 'plugin':
					if (!Tools.findObject(this.plugins, { id: trigger.plugin_id, type: 'scheduler' })) {
						return this.doError('api', err_prefix + ": Scheduler Plugin not found: " + trigger.plugin_id, callback);
					}
					
					var plugin = Tools.findObject(this.plugins, { id: trigger.plugin_id, type: 'scheduler' });
					try { this.validateParamValues(trigger.params, plugin.params); }
					catch (err) { return this.doError('api', err_prefix + ": " + err.message, callback); }
				break;
				
				default:
					return this.doError('api', err_prefix + ": Unknown type", callback);
				break;
			} // switch type
			
			if ((trigger.type != 'plugin') && trigger.params && params.fields) {
				// validate trigger params vs. event fields
				try { this.validateParamValues(trigger.params, params.fields); }
				catch (err) { return this.doError('api', err_prefix + ": " + err.message, callback); }
			}
		} // foreach trigger
		
		// enabled triggers face additional scrutiny
		var etriggers = Tools.findObjects( triggers, { enabled: true } );
		
		if (Tools.findObjects(etriggers, { type: 'startup' }).length > 1) {
			return this.doError('api', "Only one startup rule is allowed in trigger list.", callback);
		}
		if (Tools.findObjects(etriggers, { type: 'catchup' }).length > 1) {
			return this.doError('api', "Only one catch-up rule is allowed in trigger list.", callback);
		}
		if (Tools.findObjects(etriggers, { type: 'nth' }).length > 1) {
			return this.doError('api', "Only one every-nth rule is allowed in trigger list.", callback);
		}
		if (Tools.findObjects(etriggers, { type: 'manual' }).length > 1) {
			return this.doError('api', "Only one manual rule is allowed in trigger list.", callback);
		}
		if (Tools.findObjects(etriggers, { type: 'precision' }).length > 1) {
			return this.doError('api', "Only one precision rule is allowed in trigger list.", callback);
		}
		if (Tools.findObjects(etriggers, { type: 'quiet' }).length > 1) {
			return this.doError('api', "Only one quiet rule is allowed in trigger list.", callback);
		}
		if (Tools.findObjects(etriggers, { type: 'plugin' }).length > 1) {
			return this.doError('api', "Only one plugin rule is allowed in trigger list.", callback);
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
			var plugin = Tools.findObject(this.plugins, { id: params.plugin }) || { params: [] };
			var ids = {};
			
			for (var idx = 0, len = params.fields.length; idx < len; idx++) {
				var field = params.fields[idx];
				var err_prefix = "Malformed user field '" + (field.id || 'n/a') + "'";
				
				if (typeof(field.id) != 'string') return this.doError('api', err_prefix + ": ID must be a string", callback);
				if (field.id.match(Tools.MATCH_BAD_KEY)) return this.doError('api', err_prefix + ": Invalid parameter ID: " + field.id, callback);
				if (field.id.replace(/^_xy_override_/, '').match(Tools.MATCH_BAD_KEY)) return this.doError('api', err_prefix + ": Invalid parameter ID: " + field.id, callback);
				if (this.isReservedJobOverrideKey(field.id)) {
					return this.doError('api', err_prefix + ": Invalid parameter ID: " + field.id + " (reserved)", callback);
				}
				
				if (typeof(field.type) != 'string') return this.doError('api', err_prefix + ": Type must be a string", callback);
				if (!this.config.getPath('ui.control_type_labels.' + field.type)) return this.doError('api', err_prefix + ": Invalid type", callback);
				
				if (field.title && (typeof(field.title) != 'string')) return this.doError('api', err_prefix + ": Title must be a string", callback);
				if (field.title && field.title.match(/[<>]/)) return this.doError('api', err_prefix + ": Title contains illegal characters", callback);
				
				if (Tools.findObject(plugin.params, { id: field.id, locked: true })) {
					return this.doError('api', err_prefix + ": ID is already in use (as locked plugin parameter).", callback);
				}
				
				if (ids[field.id]) return this.doError('api', err_prefix + ": Duplicate field ID: " + field.id, callback);
				ids[field.id] = 1;
				
				if (field.type == 'toolset') {
					if (!this.requireValidToolsetData(field, params.fields, callback)) return false;
				}
				else if ((field.type == 'text') && field.variant) {
					if (!Tools.findObject( this.config.getPath('ui.text_field_variants'), { id: field.variant } )) {
						return this.doError('api', err_prefix + ": Invalid text field variant", callback);
					}
				}
				
				if (field.regex) try { new RegExp(field.regex); }
				catch (err) { return this.doError('api', err_prefix + ": Invalid regular expression: " + err, callback); }
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
			if (params.opts && !Array.isArray(params.opts)) return this.doError('api', "Event has invalid opts (must be array).", callback);
			
			// validate all nodes
			var nodes = params.workflow.nodes;
			var node_ids = {};
			
			for (var idx = 0, len = nodes.length; idx < len; idx++) {
				var node = nodes[idx];
				if (!Tools.isaHash(node)) return this.doError('api', "Workflow node #" + Math.floor(idx + 1) + " is not an object", callback);
				if (!node.id) return this.doError('api', "Workflow node #" + Math.floor(idx + 1) + " has no ID (id) property", callback);
				var err_prefix = "Malformed workflow node #" + node.id;
				
				if (typeof(node.id) != 'string') return this.doError('api', err_prefix + ": Node ID is not a string", callback);
				if (!node.id.match(/^\w+$/)) return this.doError('api', err_prefix + ": Node ID is not alphanumeric", callback);
				if (node.id.match(Tools.MATCH_BAD_KEY)) return this.doError('api', err_prefix + ": Invalid ID parameter: " + node.id, callback);
				if (node_ids[node.id]) return this.doError('api', err_prefix + ": Duplicate Node ID", callback);
				node_ids[node.id] = true;
				
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
					
					if ((node.type == 'event') || (node.type == 'job') || ((node.type == 'action') && (node.data.type == 'plugin'))) {
						// Missing params must be safe for field validation and later locked defaults.
						// Required fields below still produce normal API errors.
						if (node.data.params == null) node.data.params = {};
						if ((typeof(node.data.params) != 'object') || Array.isArray(node.data.params)) {
							return this.doError('api', err_prefix + ": Node data.params is not an object", callback);
						}
					}
					
					if (node.type == 'event') {
						var event = Tools.findObject(this.events, { id: node.data.event });
						if (!event) return this.doError('api', err_prefix + `: Unknown Event ID: ` + node.data.event, callback);
						if (!this.requireValidJobOverrides(node.data.params, err_prefix + " params", callback)) return false;
						
						if (event.fields) {
							for (var idy = 0, ley = event.fields.length; idy < ley; idy++) {
								var field = event.fields[idy];
								
								if (field.required && !this.stringValue(node.data.params[ field.id ]).length) {
									return this.doError('api', err_prefix + `: Missing required event parameter '${field.id}'.`, callback);
								}
								if (field.regex && this.stringValue(node.data.params[ field.id ]).length && !this.stringValue(node.data.params[ field.id ]).match( new RegExp(field.regex) )) {
									return this.doError('api', err_prefix + `: Invalid event parameter '${field.id}'.`, callback);
								}
								if (field.range && this.stringValue(node.data.params[ field.id ]).length && !this.checkNumberRange(node.data.params[ field.id ], field.range)) {
									return this.doError('api', err_prefix + `: Invalid event parameter value '${field.id}' (${field.range}).`, callback);
								}
							} // foreach field
						} // has fields
					} // node type event
					
					else if (node.type == 'job') {
						var plugin = Tools.findObject(this.plugins, { id: node.data.plugin });
						if (!plugin) return this.doError('api', err_prefix + `: Unknown Plugin ID: ` + node.data.plugin, callback);
						if (!this.requireValidJobOverrides(node.data.params, err_prefix + " params", callback)) return false;
						
						if (plugin.params) {
							for (var idy = 0, ley = plugin.params.length; idy < ley; idy++) {
								var param = plugin.params[idy];
								
								if (param.required && !this.stringValue(node.data.params[ param.id ]).length) {
									return this.doError('api', err_prefix + `: Missing required plugin parameter '${param.id}'.`, callback);
								}
								if (param.regex && this.stringValue(node.data.params[ param.id ]).length && !this.stringValue(node.data.params[ param.id ]).match( new RegExp(param.regex) )) {
									return this.doError('api', err_prefix + `: Invalid plugin parameter '${param.id}'.`, callback);
								}
								if (param.range && this.stringValue(node.data.params[ param.id ]).length && !this.checkNumberRange(node.data.params[ param.id ], param.range)) {
									return this.doError('api', err_prefix + `: Invalid plugin parameter value '${param.id}' (${param.range}).`, callback);
								}
							} // foreach param
						} // has params
					} // node type job
					
					else if ((node.type == 'action') && (node.data.type == 'plugin')) {
						// validate action plugin params
						var plugin = Tools.findObject(this.plugins, { id: node.data.plugin_id });
						if (!plugin) return this.doError('api', err_prefix + `: Unknown Action Plugin ID: ` + node.data.plugin_id, callback);
						if (!this.requireValidJobOverrides(node.data.params, err_prefix + " params", callback)) return false;
						
						if (plugin.params) {
							for (var idy = 0, ley = plugin.params.length; idy < ley; idy++) {
								var param = plugin.params[idy];
								
								if (param.required && !this.stringValue(node.data.params[ param.id ]).length) {
									return this.doError('api', err_prefix + `: Missing required action plugin parameter '${param.id}'.`, callback);
								}
								if (param.regex && this.stringValue(node.data.params[ param.id ]).length && !this.stringValue(node.data.params[ param.id ]).match( new RegExp(param.regex) )) {
									return this.doError('api', err_prefix + `: Invalid action plugin parameter '${param.id}'.`, callback);
								}
								if (param.range && this.stringValue(node.data.params[ param.id ]).length && !this.checkNumberRange(node.data.params[ param.id ], param.range)) {
									return this.doError('api', err_prefix + `: Invalid action plugin parameter value '${param.id}' (${param.range}).`, callback);
								}
							} // foreach param
						} // has params
					} // node type action w/ plugin
					
				} // node.data
			} // foreach node
			
			// validate all connections
			var conns = params.workflow.connections;
			var conn_ids = {};
			var conn_pairs = {};
			
			for (var idx = 0, len = conns.length; idx < len; idx++) {
				var conn = conns[idx];
				if (!Tools.isaHash(conn)) return this.doError('api', "Workflow connection #" + Math.floor(idx + 1) + " is not an object", callback);
				if (!conn.id) return this.doError('api', "Workflow connection #" + Math.floor(idx + 1) + " has no ID (id) property", callback);
				var err_prefix = "Malformed workflow connection #" + conn.id;
				
				if (typeof(conn.id) != 'string') return this.doError('api', err_prefix + ": ID is not a string", callback);
				if (!conn.id.match(/^\w+$/)) return this.doError('api', err_prefix + ": ID is not alphanumeric", callback);
				if (conn.id.match(Tools.MATCH_BAD_KEY)) return this.doError('api', err_prefix + ": Invalid ID parameter: " + conn.id, callback);
				if (conn_ids[conn.id]) return this.doError('api', err_prefix + ": Duplicate connection ID", callback);
				conn_ids[conn.id] = true;
				
				if (!conn.source || !Tools.findObject(nodes, { id: conn.source })) return this.doError('api', err_prefix + ": Connection source node is invalid", callback);
				if (!conn.dest || !Tools.findObject(nodes, { id: conn.dest })) return this.doError('api', err_prefix + ": Connection destination node is invalid", callback);
				
				var conn_pair = conn.source + '|' + conn.dest;
				if (conn_pairs[conn_pair]) return this.doError('api', err_prefix + ": Duplicate source/destination node pair", callback);
				conn_pairs[conn_pair] = true;
			} // foreach conn
		}
		
		// all good!
		return true;
	}
	
	applyDefaultWorkflowNodeParams(params, orig_event) {
		// for workflows, we need to apply defaults for all locked params of all event and job nodes
		// this assumes the current user is not an admin
		var self = this;
		if (!params.workflow || !params.workflow.nodes) return;
		
		params.workflow.nodes.forEach( function(node) {
			var orig_node = (orig_event && orig_event.workflow && orig_event.workflow.nodes) ? 
				Tools.findObject(orig_event.workflow.nodes, { id: node.id }) : null;
			
			if (node.type == 'event') {
				// apply defaults for locked event + plugin params, if user is not an admin
				var event = Tools.findObject(self.events, { id: node.data.event });
				if (!event) return;
				
				if (event.fields) event.fields.forEach( function(field) {
					if (!field.locked) return;
					
					node.data.params[ field.id ] = (orig_node && orig_node.data && orig_node.data.params && (field.id in orig_node.data.params)) ? 
						orig_node.data.params[field.id] : field.value;
				} );
				
				var plugin = Tools.findObject(self.plugins, { id: event.plugin });
				if (plugin && plugin.params) plugin.params.forEach( function(param) {
					if (!param.locked) return;
					
					// Event node params are overrides layered on top of the linked event.  If the
					// original node did not contain this param, preserve that inheritance by
					// removing any untrusted runtime override.  Applying the Plugin default here
					// would override the linked Event's trusted value (e.g. its Shell script).
					var same_event = !!(orig_node && orig_node.data && (orig_node.data.event == node.data.event));
					var orig_params = same_event && orig_node.data.params;
					
					if (orig_params && (param.id in orig_params)) {
						node.data.params[ param.id ] = orig_params[ param.id ];
					}
					else {
						delete node.data.params[ param.id ];
					}
				} );
			}
			else if (node.type == 'job') {
				// apply defaults for locked plugin params, if user is not an admin
				var plugin = Tools.findObject(self.plugins, { id: node.data.plugin });
				if (plugin && plugin.params) plugin.params.forEach( function(param) {
					if (!param.locked) return;
					
					// if plugin has changed, set locked fields to plugin defaults, not previous node defaults
					var plugin_changed = (orig_node && orig_node.data && orig_node.data.plugin && (node.data.plugin != orig_node.data.plugin));
					
					node.data.params[ param.id ] = (orig_node && orig_node.data && orig_node.data.params && (param.id in orig_node.data.params) && !plugin_changed) ? 
						orig_node.data.params[param.id] : param.value;
				} );
			}
		}); // foreach node
	}
	
	requireWorkflowPrivileges(user, workflow, callback) {
		// check if user has required privileges for all nodes in workflow,
		// including nodes inside referenced sub-workflows
		var self = this;
		if (!workflow || !workflow.nodes) return true; // sanity
		
		var cuser = this.getComputedUser(user);
		if (cuser.privileges.admin) return true; // admins can do anything
		if (!cuser.categories.length && !cuser.groups.length) return true; // user is not limited
		
		// walk the tree
		var walked = {};
		
		var walkWorkflow = function(workflow) {
			if (!workflow || !workflow.nodes) return true; // sanity
			
			for (var idx = 0, len = workflow.nodes.length; idx < len; idx++) {
				var node = workflow.nodes[idx];
				var data = node.data || {};
				
				if ((node.type == 'event') || (node.type == 'job')) {
					if (!self.requireRuntimeTargetPrivileges(user, data, callback)) return false;
				}
				
				if (node.type == 'event') {
					var event = Tools.findObject( self.events, { id: data.event } );
					if (!event) return self.doError('api', "Workflow references missing Event ID: " + data.event, callback);
					
					if (!self.requireCategoryPrivilege(user, event.category, callback)) return false;
					if (!self.requireRuntimeTargetPrivileges(user, event, callback)) return false;
					
					// Check both the saved event targets and any node-level override.
					// Replay nodes still need a future archived-job authorization pass.
					if (!self.requireAllTargetPrivileges(user, event.targets, callback)) return false;
					if (data.targets && data.targets.length && !self.requireAllTargetPrivileges(user, data.targets, callback)) return false;
					
					if ((event.type == 'workflow') && event.workflow && !walked[event.id]) {
						walked[event.id] = 1;
						if (!walkWorkflow(event.workflow)) return false;
					}
				}
				else if (node.type == 'job') {
					if (!self.requireCategoryPrivilege(user, data.category, callback)) return false;
					if (!self.requireAllTargetPrivileges(user, data.targets, callback)) return false;
				}
			} // foreach node
			
			return true; // all good!
		}; // walkWorkflow
		
		return walkWorkflow(workflow);
	}
	
	verifyDeepWorkflowAccess(user, workflow, callback) {
		// ensure user has proper access to all nested nodes and replays
		var self = this;
		if (!workflow) return callback(); // early exit for non-workflows
		
		// only traverse tree for limited users
		var cuser = this.getComputedUser(user);
		if (!cuser.categories.length && !cuser.groups.length) return callback(); // user is not limited
		
		// keep track of all the unique jobs we need to load
		var job_ids = {};
		
		// only traverse into each unique workflow once
		var walked = {};
		
		var walkWorkflow = function(workflow) {
			if (!workflow || !workflow.nodes) return true; // sanity
			
			for (var idx = 0, len = workflow.nodes.length; idx < len; idx++) {
				var node = workflow.nodes[idx];
				var data = node.data || {};
				if (data.replay) {
					if (Array.isArray(data.replay)) data.replay.forEach( job_id => { job_ids[job_id] = 1; } );
					else job_ids[data.replay] = 1;
				}
				
				if (node.type == 'event') {
					var event = Tools.findObject( self.events, { id: data.event } );
					if (event && (event.type == 'workflow') && event.workflow && !walked[event.id]) {
						walked[event.id] = 1;
						walkWorkflow(event.workflow);
					}
				}
			} // foreach node
		}; // walkWorkflow
		
		// do the walk
		walkWorkflow(workflow);
		
		// return if no replays were found
		if (!Tools.firstKey(job_ids)) return callback();
		
		// load all replayed jobs in limited parallel
		var jobs = {};
		
		async.eachLimit( Object.keys(job_ids), this.storage.concurrency,
			function(id, callback) {
				self.unbase.get( 'jobs', id, function(err, job) {
					// safe to ignore 404 storage errors here (i.e. deleted job is perfectly normal)
					if (err && (err.code == "NoSuchKey")) return callback();
					
					// other storage errors are bad
					if (err) return callback(err);
					
					jobs[id] = job;
					callback();
				}); // unbase.get
			},
			function(err) {
				if (err) return callback(err);
				
				// ensure user has access to all replayed jobs
				var final_jobs = Object.values(jobs);
				if (self.getUserLimitedJobs( cuser, final_jobs ).length < final_jobs.length) {
					return callback( new Error("You do not have the required account privileges to access one or more replayed jobs.") );
				}
				
				// success, user has access to all replayed jobs
				callback();
			}
		); // eachLimit
	}
	
}; // class Events

module.exports = Events;
