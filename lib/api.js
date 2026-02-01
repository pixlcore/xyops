// xyOps API Layer
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const Path = require('path');
const assert = require("assert");
const async = require('async');
const ClassUtil = require('pixl-class-util');
const Tools = require("pixl-tools");

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
		// for testing: adds configurable delay, echoes everything back
		var self = this;
		if (!this.validateFiles(args, callback)) return;
		
		setTimeout( function() {
			callback({
				method: args.request.method,
				url: self.web.getSelfURL( args.request, args.request.url ),
				ips: args.ips,
				query: args.query,
				headers: args.request.headers || {},
				cookies: args.cookies || {},
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
			if (this.web.config.get('port') != 80) api_url += ':' + this.web.config.get('port');
		}
		api_url += this.api.config.get('base_uri');
		
		return api_url;
	}
	
	requireValidUser(session, user, callback) {
		// make sure user and session are valid
		// otherwise throw an API error and return false
		assert( arguments.length == 3, "Wrong number of arguments to requireValidUser" );
		var now = Tools.timeNow(true);
		
		if (session && (session.type == 'api')) {
			// session is simulated, created by API key
			if (!user) {
				return this.doError('api', "Invalid API Key", callback);
			}
			if (!user.active) {
				return this.doError('api', "API Key is disabled", callback);
			}
			if (user.expires && (now >= user.expires)) {
				return this.doError('api', "API Key is expired", callback);
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
		
		var priv_list = this.config.getPath('ui.privilege_list');
		var priv_def = Tools.findObject( priv_list, { id: priv_id } ) || { title: "(" + priv_id + ")" };
		
		if (user.key) {
			return this.doError('access', `API Key "${user.title}" does not have the "${priv_def.title}" privilege required to perform this action.`, callback);
		}
		else {
			return this.doError('access', `You do not have the "${priv_def.title}" privilege required to perform this action.`, callback);
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
		if (!target_ids || !target_ids.length) return true; // event has no targets (i.e. workflow)
		
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
		return this.doError('access', "You do not have the required account privileges to access category ID " + cat_id + ".", callback);
	}
	
	requireGroupPrivilege(user, grp_id, callback) {
		// make sure user has the specified server group privilege
		// otherwise throw an API error and return false
		if (this.checkGroupPrivilege(user, grp_id)) return true;
		return this.doError('access', "You do not have the required account privileges to access group ID " + grp_id + ".", callback);
	}
	
	requireTargetPrivilege(user, target_ids, callback) {
		// make sure user has the specified server group privilege (could be hostname)
		// otherwise throw an API error and return false
		if (this.checkTargetPrivilege(user, target_ids)) return true;
		return this.doError('access', "You do not have the required account privileges to access any target: " + target_ids.join(', ') + ".", callback);
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
					if (limit.accept && limit.accept.match(/[^\w\s\-\.\,]+/)) {
						return this.doError('api', err_prefix + ": Invalid file type list (contains illegal characters)", callback);
					}
				break;
				
				case 'day':
					if (!Tools.findObject(this.config.getPath('ui.action_condition_menu'), { id: limit.condition })) {
						return this.doError('api', err_prefix + ": Invalid condition (unknown)", callback);
					}
					if (limit.amount && (typeof(limit.amount) != 'number')) {
						return this.doError('api', err_prefix + ": Invalid max condition count (not a number)", callback);
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
			
			if (!action.condition || !action.condition.toString().match(/^(start|complete|success|warning|error|critical|abort|tag:\w+|alert_new|alert_cleared)$/)) {
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
						return this.doError('api', err_prefix + ": Invalid Bucket sync type.", callback);
					}
				break;
				
				case 'ticket':
					if (!Tools.findObject(this.config.getPath('ui.ticket_types'), { id: action.ticket_type })) {
						return this.doError('api', err_prefix + ": Invalid Ticket type.", callback);
					}
					if (!Array.isArray(action.ticket_assignees)) {
						return this.doError('api', err_prefix + ": Invalid Ticket assignees.", callback);
					}
					if (!Array.isArray(action.ticket_tags)) return this.doError('api', err_prefix + ": Invalid Ticket tag list.", callback);
				break;
				
				case 'tag':
					if (!Array.isArray(action.tags)) return this.doError('api', err_prefix + ": Invalid tag list.", callback);
					if (!action.tags.length) return this.doError('api', err_prefix + ": No tags selected.", callback);
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
		
		callback({ code: 'master', host: this.masterHost || '', description: "This API call can only be invoked on the primary conductor server." });
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
		var now = Tools.timeNow(true);
		var session_id = args.cookies['session_id'] || args.request.headers['x-session-id'] || args.params.session_id;
		
		if (session_id) {
			this.storage.get('sessions/' + session_id, function(err, session) {
				if (err) return callback(err, null, null);
				
				// also load user
				self.storage.get('users/' + self.usermgr.normalizeUsername(session.username), function(err, user) {
					if (err) return callback(err, null, null);
					
					// set type to discern this from API Key sessions
					session.type = 'user';
					
					// scrub session_id from common places, so it doesn't interfere with API calls and isn't logged
					delete args.params.session_id;
					delete args.cookies['session_id'];
					delete args.request.headers['x-session-id'];
					delete args.request.headers['cookie'];
					
					// pass both session and user to callback
					callback(null, session, user);
				} );
			} );
			return;
		}
		
		// no session found, look for API Key
		var plain_key = args.request.headers['x-api-key'] || args.params.api_key || args.query.api_key;
		if (!plain_key) return callback( new Error("No Session ID or API Key could be found"), null, null );
		
		this.api.logDebug(9, "Client provided API key: " + plain_key.substring(0, 4) + '****');
		
		// find active key with matching salted hash
		var api_key = this.api_keys.find( function(api_key) {
			if (!api_key.active) return false;
			if (api_key.expires && (now >= api_key.expires)) return false;
			return ( Tools.digestHex(plain_key + api_key.id, 'sha256') === api_key.key );
		} );
		
		if (!api_key) return callback(new Error("Invalid API Key"), null, null);
		
		this.api.logDebug(9, "Matched server API Key: " + api_key.title + " (" + api_key.id + ")" );
		
		// create simulated session and user objects
		var session = {
			type: 'api'
		};
		var user = Tools.copyHash(api_key, true);
		
		// scrub api_key from common places, so it doesn't interfere with API calls and isn't logged
		delete args.params.api_key;
		delete args.query.api_key;
		delete args.request.headers['x-api-key'];
		delete args.request.headers['cookie'];
		
		// pass both "session" and "user" to callback
		callback(null, session, user);
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
			else if (!(''+params[key]).match(rule)) {
				return this.doError('api', "Malformed parameter: " + key, callback);
			}
		}
		
		// additionally, validate id and title, if present
		if (('id' in params) && (typeof(params.id) != 'string')) {
			return this.doError('api', "Invalid ID parameter: " + params.id + " (not a string)", callback);
		}
		if (params.id && params.id.match(Tools.MATCH_BAD_KEY)) {
			return this.doError('api', "Invalid ID parameter: " + params.id + " (reserved word)", callback);
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
		if (params.notes) params.notes = params.notes.toString().replace(/<[^>]*>/g, '');
		if (params.label) params.label = params.label.toString().replace(/<[^>]*>/g, '');
		if (params.message) params.message = params.message.toString().replace(/<[^>]*>/g, '');
		
		return true;
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
	
	validateFiles(args, callback) {
		// vaildate optional uploaded files are valid
		assert( arguments.length == 2, "Wrong number of arguments to validateFiles" );
		
		if (!args.files) return true;
		
		for (var key in args.files) {
			var file = args.files[key];
			var filename = Path.basename( '' + file.name );
			if (!file.name || !filename || filename.match(/^\.+$/)) {
				return this.doError('api', `File '${key}' is missing required name property, or name is invalid.`, callback);
			}
			if (!file.size) return this.doError('api', `File '${key}' is missing required size property, or is zero bytes.`, callback);
		}
		
		return true;
	}
	
	doError(code, msg, callback) {
		// log error and return standard API error response
		assert( arguments.length == 3, "Wrong number of arguments to doError" );
		var http_code = "200";
		
		// attempt to regain args context via hidden request id tucked away in callback
		var data = null;
		if (callback._req_id) {
			var args = this.web.requests[ callback._req_id ];
			if (args) {
				var url = this.web.getSelfURL(args.request, args.request.url) || args.request.url;
				data = { id: args.id, ip: args.ip, ips: args.ips, url: url, headers: args.request.headers };
				if (args.user && args.user.username) data.username = args.user.username;
				else if (args.user && args.user.id) data.api_key = args.user.id;
				
				if (code && args.request.url.match(/^[^\?]+\/v\d+(\?|\/|$)/)) {
					switch (code) {
						case 'api': http_code = "400"; break;
						case 'access': http_code = "403"; break;
						default: http_code = "500"; break;
					}
				} // vary http code based on error
			}
		}
		
		this.api.logError( code, msg, data );
		callback({ code: code, description: (''+msg).replace(/<[^>]*>/g, '') }, http_code);
		return false;
	}
	
}; // class API

ClassUtil.mixin( API, [ 
	require('./api/admin.js'),
	require('./api/alerts.js'),
	require('./api/apikey.js'),
	require('./api/avatar.js'),
	require('./api/config.js'),
	require('./api/docs.js'),
	require('./api/file.js'),
	require('./api/groups.js'),
	require('./api/monitors.js'),
	require('./api/categories.js'),
	require('./api/channels.js'),
	require('./api/webhook.js'),
	require('./api/buckets.js'),
	require('./api/secrets.js'),
	require('./api/plugins.js'),
	require('./api/tags.js'),
	require('./api/events.js'),
	require('./api/jobs.js'),
	require('./api/search.js'),
	require('./api/servers.js'),
	require('./api/user.js'),
	require('./api/roles.js'),
	require('./api/satellite.js'),
	require('./api/tickets.js')
] );

module.exports = API;
