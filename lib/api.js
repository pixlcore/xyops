// OpsRocket API Layer
// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the PixlCore Sustainable Use License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const ClassUtil = require('pixl-class-util');
const Tools = require("pixl-tools");
const PixlRequest = require("pixl-request");

class API {
	
	apiSetup() {
		// setup pixl-server-api
		
		// register our class as an API namespace
		this.api.addNamespace( "app", "api_", this );
		
		// intercept all api requests early so we can tweak things
		this.api.on('request', function(args, callback) {
			// remove cachebust from all API requests
			delete args.query.cachebust;
			
			// add request id into callback as hidden property (here be dragons)
			callback._req_id = args.id;
		});
	}
	
	api_ping(args, callback) {
		// hello
		callback({ code: 0 });
	}
	
	api_echo(args, callback) {
		// for testing: adds 1 second delay, echoes everything back
		setTimeout( function() {
			callback({
				code: 0,
				query: args.query || {},
				params: args.params || {},
				files: args.files || {}
			});
		}, args.query.sleep || 1 );
	}
	
	api_error(args, callback) {
		// simulate an error
		this.doError('test', "This is a test error message.", callback);
	}
	
	api_dash_stats(args, callback) {
		// generate stats for UI dash page
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var stats = {
				day: self.stats.currentDay,
				mem: self.stats.mem,
				cpu: self.stats.cpu,
				unbase: self.unbase.getStats(),
				cache: {}
			};
			
			if (self.storage.engine.cache) {
				stats.cache = self.storage.engine.cache.getStats();
			}
			
			callback({ code: 0, stats: stats });
		}); // loadSession
	}
	
	forceNoCacheResponse(args) {
		// make sure this response isn't cached, ever
		args.response.setHeader( 'Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate' );
		args.response.setHeader( 'Expires', 'Thu, 01 Jan 1970 00:00:00 GMT' );
	}
	
	setCacheResponse(args, ttl) {
		// set normal public cache response for browsers (and possibly CDN)
		if (args.query && args.query.ttl) ttl = args.query.ttl;
		args.response.setHeader( 'Cache-Control', 'public, max-age=' + ttl + ', must-revalidate' );
	}
	
	getServerBaseAPIURL(hostname) {
		// construct fully-qualified URL to API on specified hostname
		// use proper protocol and ports as needed
		var api_url = '';
		
		if (this.web.config.get('https') && this.web.config.get('https_force')) {
			api_url = 'https://' + hostname;
			if (this.web.config.get('https_port') != 443) api_url += ':' + this.web.config.get('https_port');
		}
		else {
			api_url = 'http://' + hostname;
			if (this.web.config.get('http_port') != 80) api_url += ':' + this.web.config.get('http_port');
		}
		api_url += this.api.config.get('base_uri');
		
		return api_url;
	}
	
	requireValidUser(session, user, callback) {
		// make sure user and session are valid
		// otherwise throw an API error and return false
		assert( arguments.length == 3, "Wrong number of arguments to requireValidUser" );
		
		if (session && (session.type == 'api')) {
			// session is simulated, created by API key
			if (!user) {
				return this.doError('api', "Invalid API Key: " + session.api_key, callback);
			}
			if (!user.active) {
				return this.doError('api', "API Key is disabled: " + session.api_key, callback);
			}
			return true;
		} // api key
		
		if (!session) {
			return this.doError('session', "Session has expired or is invalid.", callback);
		}
		if (!user) {
			return this.doError('user', "User not found: " + session.username, callback);
		}
		if (!user.active) {
			return this.doError('session', "User account is disabled: " + session.username, callback);
		}
		return true;
	}
	
	getComputedPrivileges(user) {
		// combine user privs with all assigned roles
		var self = this;
		var privs = Tools.copyHash( user.privileges || {} );
		
		(user.roles || []).forEach( function(role_id) {
			var role = Tools.findObject( self.roles, { id: role_id } );
			if (role && role.enabled && role.privileges) Tools.mergeHashInto( privs, role.privileges );
		} );
		
		return privs;
	}
	
	getComputedCategories(user) {
		// combine user cats with all assigned roles
		var self = this;
		var cats = Tools.copyHash( user.categories || [], true );
		
		(user.roles || []).forEach( function(role_id) {
			var role = Tools.findObject( self.roles, { id: role_id } );
			if (role && role.enabled && role.categories) cats = cats.concat( role.categories );
		} );
		
		return [...new Set(cats)]; // remove dupes
	}
	
	getComputedGroups(user) {
		// combine user groups with all assigned roles
		var self = this;
		var groups = Tools.copyHash( user.groups || [], true );
		
		(user.roles || []).forEach( function(role_id) {
			var role = Tools.findObject( self.roles, { id: role_id } );
			if (role && role.enabled && role.groups) groups = groups.concat( role.groups );
		} );
		
		return [...new Set(groups)]; // remove dupes
	}
	
	requireAdmin(session, user, callback) {
		// make sure user and session are valid, and user is an admin
		// otherwise throw an API error and return false
		assert( arguments.length == 3, "Wrong number of arguments to requireAdmin" );
		if (!this.requireValidUser(session, user, callback)) return false;
		return this.requirePrivilege(user, 'admin', callback);
	}
	
	requirePrivilege(user, priv_id, callback) {
		// make sure user has the specified privilege
		// otherwise throw an API error and return false
		assert( arguments.length == 3, "Wrong number of arguments to requirePrivilege" );
		var privs = this.getComputedPrivileges(user);
		
		if (privs.admin) return true; // admins can do everything
		if (privs[priv_id]) return true;
		
		if (user.key) {
			return this.doError('api', "API Key ('" + user.title + "') does not have the required privileges to perform this action (" + priv_id + ").", callback);
		}
		else {
			return this.doError('user', "User '" + user.username + "' does not have the required account privileges to perform this action (" + priv_id + ").", callback);
		}
	}
	
	checkCategoryPrivilege(user, cat_id) {
		// make sure user has the specified category privilege
		var cprivs = this.getComputedPrivileges(user);
		if (cprivs.admin) return true; // admins can do everything
		
		var cats = this.getComputedCategories(user);
		if (!cats.length) return true; // user is not cat-limited
		if (cats.includes(cat_id)) return true; // user has cat access
		return false;
	}
	
	checkGroupPrivilege(user, grp_id) {
		// make sure user has the specified server group privilege
		var cprivs = this.getComputedPrivileges(user);
		if (cprivs.admin) return true; // admins can do everything
		
		var cgrps = this.getComputedGroups(user);
		if (!cgrps.length) return true; // user is not group-limited
		if (cgrps.includes(grp_id)) return true; // user has group access
		return false;
	}
	
	checkTargetPrivilege(user, target_ids) {
		// make sure user has the specified server group privilege (could be hostname)
		var privs = this.getComputedPrivileges(user);
		if (privs.admin) return true; // admins can do everything
		
		var cgrps = this.getComputedGroups(user);
		if (!cgrps.length) return true; // user is not group-limited
		if (Tools.includesAny(cgrps, target_ids)) return true; // user has any group access
		
		// FUTURE: we could check individual servers here, but it gets hairy
		// for e.g. the server could be offline, so does the user have access then?
		// also, servers may have multiple groups now -- it's just getting crazy
		// so skipping for now.
		
		return false;
	}
	
	requireCategoryPrivilege(user, cat_id, callback) {
		// make sure user has the specified category privilege
		// otherwise throw an API error and return false
		if (this.checkCategoryPrivilege(user, cat_id)) return true;
		return this.doError('user', "User '" + user.username + "' does not have the required account privileges to access category: " + cat_id + ".", callback);
	}
	
	requireGroupPrivilege(user, grp_id, callback) {
		// make sure user has the specified server group privilege
		// otherwise throw an API error and return false
		if (this.checkGroupPrivilege(user, grp_id)) return true;
		return this.doError('user', "User '" + user.username + "' does not have the required account privileges to access group: " + grp_id + ".", callback);
	}
	
	requireTargetPrivilege(user, target_ids, callback) {
		// make sure user has the specified server group privilege (could be hostname)
		// otherwise throw an API error and return false
		if (this.checkTargetPrivilege(user, target_ids)) return true;
		return this.doError('user', "User '" + user.username + "' does not have the required account privileges to access any target: " + target_ids.join(', ') + ".", callback);
	}
	
	requireValidLimits(params, callback) {
		// validate optional limits array (for events and categories)
		if (!params.limits) return true; // valid to omit
		if (params.limits && !Tools.isaArray(params.limits)) {
			return this.doError('api', "Malformed event parameter: limits (must be array)", callback);
		}
		for (var idx = 0, len = params.limits.length; idx < len; idx++) {
			var limit = params.limits[idx];
			var err_prefix = "Malformed limit entry #" + Math.floor(idx + 1);
			if (!Tools.isaHash(limit)) return this.doError('api', err_prefix + " (not an object)", callback);
			if (!('enabled' in limit)) return this.doError('api', err_prefix + ": Missing enabled flag", callback);
			
			switch (limit.type) {
				case 'mem':
					if (!limit.amount || (typeof(limit.amount) != 'number')) {
						return this.doError('api', err_prefix + ": Invalid memory amount (not a number)", callback);
					}
					if (limit.duration && (typeof(limit.duration) != 'number')) {
						return this.doError('api', err_prefix + ": Invalid memory duration (not a number)", callback);
					}
				break;
				
				case 'cpu':
					if (!limit.amount || (typeof(limit.amount) != 'number')) {
						return this.doError('api', err_prefix + ": Invalid CPU amount (not a number)", callback);
					}
					if (limit.duration && (typeof(limit.duration) != 'number')) {
						return this.doError('api', err_prefix + ": Invalid CPU duration (not a number)", callback);
					}
				break;
				
				case 'log':
					if (!limit.amount || (typeof(limit.amount) != 'number')) {
						return this.doError('api', err_prefix + ": Invalid max log size (not a number)", callback);
					}
				break;
				
				case 'time':
					if (!limit.duration || (typeof(limit.duration) != 'number')) {
						return this.doError('api', err_prefix + ": Invalid time timit (not a number)", callback);
					}
				break;
				
				case 'job':
					if (!limit.amount || (typeof(limit.amount) != 'number')) {
						return this.doError('api', err_prefix + ": Invalid max jobs (must be a positive number)", callback);
					}
				break;
				
				case 'retry':
					if (limit.amount && (typeof(limit.amount) != 'number')) {
						return this.doError('api', err_prefix + ": Invalid max retries (not a number)", callback);
					}
					if (limit.duration && (typeof(limit.duration) != 'number')) {
						return this.doError('api', err_prefix + ": Invalid retry delay (not a number)", callback);
					}
				break;
				
				case 'queue':
					if (limit.amount && (typeof(limit.amount) != 'number')) {
						return this.doError('api', err_prefix + ": Invalid max queue (not a number)", callback);
					}
				break;
				
				case 'file':
					if (limit.amount && (typeof(limit.amount) != 'number')) {
						return this.doError('api', err_prefix + ": Invalid max files (not a number)", callback);
					}
					if (limit.size && (typeof(limit.size) != 'number')) {
						return this.doError('api', err_prefix + ": Invalid max file size (not a number)", callback);
					}
					if (limit.accept && (typeof(limit.accept) != 'string')) {
						return this.doError('api', err_prefix + ": Invalid file type list (not a string)", callback);
					}
					if (limit.accept && limit.accept.match(/[^\w\s\-\.\,\/\*]+/)) {
						return this.doError('api', err_prefix + ": Invalid file type list (contains illegal characters)", callback);
					}
				break;
				
				default:
					return this.doError('api', err_prefix + ": Unknown type", callback);
				break;
			} // switch item.type
		} // foreach limit
		
		return true;
	}
	
	requireValidActions(params, callback) {
		// validate optional actions array (for events and categories)
		if (!params.actions) return true; // valid to omit
		if (params.actions && !Tools.isaArray(params.actions)) {
			return this.doError('api', "Malformed event parameter: actions (must be array)", callback);
		}
		for (var idx = 0, len = params.actions.length; idx < len; idx++) {
			var action = params.actions[idx];
			var err_prefix = "Malformed action entry #" + Math.floor(idx + 1);
			if (!Tools.isaHash(action)) return this.doError('api', err_prefix + " (not an object)", callback);
			if (!('enabled' in action)) return this.doError('api', err_prefix + ": Missing enabled flag", callback);
			
			if (!action.condition || !action.condition.toString().match(/^(start$|complete$|success$|warning$|error$|critical$|abort$|tag:\w+$)/)) {
				return this.doError('api', err_prefix + ": Invalid condition", callback);
			}
			
			switch (action.type) {
				case 'email':
					// FUTURE: Actually validate the email addresses?  Might be a CSV list!
					if (!Array.isArray(action.users)) return this.doError('api', err_prefix + ": Invalid user list.", callback);
					if (action.email && (typeof(action.email) != 'string')) return this.doError('api', err_prefix + ": Invalid email address.", callback);
					if (!action.users.length && !action.email) return this.doError('api', err_prefix + ": No email addresses provided.", callback);
				break;
				
				case 'web_hook':
					if (!action.web_hook || !action.web_hook.toString().match(/^\w+$/)) {
						return this.doError('api', err_prefix + ": Invalid Web Hook ID.", callback);
					}
				break;
				
				case 'run_event':
					if (!action.event_id || !action.event_id.toString().match(/^\w+$/)) {
						return this.doError('api', err_prefix + ": Invalid Event ID.", callback);
					}
				break;
				
				case 'channel':
					if (!action.channel_id || !action.channel_id.toString().match(/^\w+$/)) {
						return this.doError('api', err_prefix + ": Invalid Channel ID.", callback);
					}
				break;
				
				case 'store':
				case 'fetch':
					if (!action.bucket_id || !action.bucket_id.toString().match(/^\w+$/)) {
						return this.doError('api', err_prefix + ": Invalid Bucket ID.", callback);
					}
					if (!action.bucket_sync || !action.bucket_sync.toString().match(/^(data|files|data_and_files)$/)) {
						return this.doError('api', err_prefix + ": Invalid Bucket Sync Type.", callback);
					}
				break;
				
				case 'snapshot':
					// no options
				break;
				
				case 'disable':
					// no options
				break;
				
				case 'delete':
					// no options
				break;
				
				case 'plugin':
					if (!action.plugin_id || !action.plugin_id.toString().match(/^\w+$/)) {
						return this.doError('api', err_prefix + ": Invalid Plugin ID.", callback);
					}
				break;
				
				default:
					return this.doError('api', err_prefix + ": Unknown type", callback);
				break;
			} // switch item.type
		} // foreach action
		
		return true;
	}
	
	requireMaster(args, callback) {
		// make sure we are the master server
		// otherwise throw an API error and return false
		if (this.master) return true;
		
		if (this.config.get('redirect_master_requests') && this.masterHost) {
			// send back redirect to master server
			args.request.headers.host = this.masterHost;
			var url = this.web.getSelfURL( args.request, args.request.url );
			callback( "302 Found", { Location: url }, "" );
			return false;
		}
		
		callback({ code: 'master', host: this.masterHost || '', description: "This API call can only be invoked on a primary server." });
		return false;
	}
	
	getClientInfo(args, params) {
		// proxy over to user module
		// var info = this.usermgr.getClientInfo(args, params);
		var info = null;
		if (params) info = Tools.copyHash(params, true);
		else info = {};
		
		info.ip = args.ip;
		info.ips = args.ips;
		info.headers = args.request.headers;
		
		// augment with our own additions
		if (args.admin_user) {
			info.admin = args.admin_user.username;
		}
		
		if (args.user) {
			if (args.user.key) {
				// API Key
				info.username = args.user.id;
			}
			else {
				info.username = args.user.username;
			}
		}
		
		return info;
	}
	
	loadUser(username, callback) {
		// load user record from storage
		this.storage.get('users/' + this.usermgr.normalizeUsername(username), callback );
	}
	
	loadSession(args, callback) {
		// Load user session or validate API Key
		var self = this;
		var session_id = args.cookies['session_id'] || args.request.headers['x-session-id'] || args.params.session_id;
		
		if (session_id) {
			this.api.logDebug(10, "Found Session ID: " + session_id);
			
			this.storage.get('sessions/' + session_id, function(err, session) {
				if (err) return callback(err, null, null);
				
				// also load user
				self.storage.get('users/' + self.usermgr.normalizeUsername(session.username), function(err, user) {
					if (err) return callback(err, null, null);
					
					// set type to discern this from API Key sessions
					session.type = 'user';
					
					// get session_id out of args.params, so it doesn't interfere with API calls
					delete args.params.session_id;
					
					// pass both session and user to callback
					callback(null, session, user);
				} );
			} );
			return;
		}
		
		// no session found, look for API Key
		var api_key = args.request.headers['x-api-key'] || args.params.api_key || args.query.api_key;
		if (!api_key) return callback( new Error("No Session ID or API Key could be found"), null, null );
		
		this.api.logDebug(9, "Found API Key: " + api_key);
		
		if ((api_key == 'internal') && (args.ips.length == 1) && args.ips[0].match(/^(0\.0\.0\.0|127\.0\.0\.1|localhost|\:\:1)$/)) {
			// internal backdoor (localhost only)
			var session = {
				type: 'api',
				api_key: api_key
			};
			var user = {
				key: 'internal',
				active: true,
				privileges: { admin: 1 },
				title: "Internal",
				description: "",
				id: 'internal'
			};
			delete args.params.api_key;
			return callback(null, session, user);
		} // internal
		
		this.storage.listFind( 'global/api_keys', { key: api_key }, function(err, item) {
			if (err || !item) return callback(new Error("API Key is invalid: " + api_key), null, null);
			
			// create simulated session and user objects
			var session = {
				type: 'api',
				api_key: api_key
			};
			var user = item;
			
			// get api_key out of args.params, so it doesn't interfere with API calls
			delete args.params.api_key;
			
			// pass both "session" and "user" to callback
			callback(null, session, user);
		} );
		return;
	}
	
	requireParams(params, rules, callback) {
		// validate params against set of regexp rules
		assert( arguments.length == 3, "Wrong number of arguments to requireParams" );
		
		for (var key in rules) {
			var rule = rules[key];
			if (typeof(params[key]) == 'undefined') {
				return this.doError('api', "Missing parameter: " + key, callback);
			}
			if (rule === 'array') {
				if (!Tools.isaArray(params[key])) {
					return this.doError('api', "Parameter is not an array: " + key, callback);
				}
			}
			else if (typeof(rule) == 'string') {
				if (typeof(params[key]) != rule) {
					return this.doError('api', "Parameter is not type " + rule + ": " + key, callback);
				}
			}
			else if (!params[key].toString().match(rule)) {
				return this.doError('api', "Malformed parameter: " + key, callback);
			}
		}
		
		// additionally, validate id and title, if present
		if (params.id && params.id.match(Tools.MATCH_BAD_KEY)) {
			return this.doError('api', "Invalid ID parameter: " + params.id, callback);
		}
		
		// make sure title doesn't contain HTML metacharacters
		if (params.title && params.title.match(/[<>]/)) {
			return this.doError('api', "Malformed title parameter: Cannot contain HTML metacharacters", callback);
		}
		
		// make sure icon only contains valid mdi charset
		if (params.icon && !params.icon.match(/^[\w\-]+$/)) {
			return this.doError('api', "Malformed icon parameter: Contains illegal characters", callback);
		}
		
		// strip html tags out of notes and labels
		if (params.notes) params.notes = params.notes.toString().replace(/<.+>/g, '');
		if (params.label) params.label = params.label.toString().replace(/<.+>/g, '');
		
		return true;
	}
	
	doError(code, msg, callback) {
		// log error and return standard API error response
		assert( arguments.length == 3, "Wrong number of arguments to doError" );
		
		// attempt to regain args context via hidden request id tucked away in callback
		var data = null;
		if (callback._req_id) {
			var args = this.web.requests[ callback._req_id ];
			if (args) {
				var url = this.web.getSelfURL(args.request, args.request.url) || args.request.url;
				data = { id: args.id, ip: args.ip, ips: args.ips, url: url, headers: args.request.headers };
				if (args.user && args.user.username) data.username = args.user.username;
				else if (args.user && args.user.id) data.api_key = args.user.id;
			}
		}
		
		this.api.logError( code, msg, data );
		callback({ code: code, description: msg });
		return false;
	}
	
}; // class API

ClassUtil.mixin( API, [ 
	require('./api/admin.js'),
	require('./api/alerts.js'),
	require('./api/apikey.js'),
	require('./api/avatar.js'),
	require('./api/config.js'),
	require('./api/file.js'),
	require('./api/groups.js'),
	require('./api/monitors.js'),
	require('./api/categories.js'),
	require('./api/channels.js'),
	require('./api/webhook.js'),
	require('./api/buckets.js'),
	require('./api/plugins.js'),
	require('./api/tags.js'),
	require('./api/events.js'),
	require('./api/jobs.js'),
	require('./api/search.js'),
	require('./api/servers.js'),
	require('./api/user.js'),
	require('./api/roles.js'),
	require('./api/satellite.js'),
	require('./api/auth0.js')
] );

module.exports = API;
