// xyOps Server Engine Component
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const Path = require('path');

const ClassUtil = require('pixl-class-util');
const Component = require("pixl-server/component");
const Tools = require("pixl-tools");
const PixlRequest = require("pixl-request");

const glob = Tools.glob;
const mkdirp = Tools.mkdirp;
const async = Tools.async;

class xyOps extends Component {
	
	activeJobs = {};
	jobDetails = {};
	activeAlerts = {};
	internalJobs = {};
	transferTokens = {};
	
	earlyStart() {
		// early startup to hook logger, to scan for errors
		var self = this;
		var log_file = Path.join( this.server.config.get('log_dir'), 'Error.log' );
		
		this.server.logger.on('row', function(line, cols, args) {
			if (args.category !== 'error') return; // early exit for non-errors
			
			// dedicated error log
			if (args.sync) fs.appendFileSync(log_file, line);
			else fs.appendFile(log_file, line, function() {});
		}); // row
		
		return true; // continue startup
	}
	
	startup(callback) {
		// start app service
		var self = this;
		
		this.logDebug(3, "xyOps engine starting up", process.argv );
		this.logDebug(5, "Local server time is: " + (new Date()).toString() );
		
		// use global config and debug flag
		this.config = this.server.config;
		this.debug = this.server.debug;
		this.foreground = this.server.foreground;
		
		// we'll need these components frequently
		this.storage = this.server.Storage;
		this.web = this.server.WebServer;
		this.api = this.server.API;
		this.usermgr = this.server.User;
		this.unbase = this.server.Unbase;
		
		// test storage to make sure we can read/write records
		this.testStorage( function(err) {
			if (err) return callback(err);
			self.finishStartup(callback);
		}); // setupStorage
	}
	
	finishStartup(callback) {
		var self = this;
		
		// setup API component
		this.apiSetup();
		
		// start WebSocket server, attach to http/https
		this.startSocketListener();
		
		// shortcut for /api/app/file
		this.web.addURIHandler( /^\/files/, "File", this.api_file.bind(this) );
		
		// special handler for home page
		this.web.addURIHandler( /^(\/|\/index\.html)$/, "Home", this.handleHome.bind(this) );
		
		// webserver stats
		this.web.addURIHandler( '/server-status', "Server Status", true, function(args, callback) {
			callback( self.web.getStats() );
		} );
		
		// health (master) check
		this.web.addURIHandler( '/health', "Health Check", true, function(args, callback) {
			if (self.master) callback({ code: 0, master: true });
			else callback( "503 Service Unavailable", {}, false );
		} );
		
		// listen for ticks so we can broadcast status
		this.server.on('tick', this.tick.bind(this));
		
		// routine tasks on minute rollover
		this.server.on('minute', this.minute.bind(this));
		
		// register hooks for when users are created / updated / deleted
		this.usermgr.registerHook( 'after_create', this.afterUserChange.bind(this, 'user_create') );
		this.usermgr.registerHook( 'after_update', this.afterUserChange.bind(this, 'user_update') );
		this.usermgr.registerHook( 'after_reset_password', this.afterUserChange.bind(this, 'user_password') );
		this.usermgr.registerHook( 'after_delete', this.afterUserChange.bind(this, 'user_delete') );
		this.usermgr.registerHook( 'after_login', this.afterUserLogin.bind(this) );
		
		this.usermgr.registerHook( 'before_create', this.beforeUserCreate.bind(this) );
		this.usermgr.registerHook( 'before_update', this.beforeUserUpdate.bind(this) );
		
		// intercept user login and session resume, to merge in extra data
		this.usermgr.registerHook( 'before_login', this.beforeUserLogin.bind(this) );
		this.usermgr.registerHook( 'before_resume_session', this.beforeUserLogin.bind(this) );
		
		// intercept usermgr's session load, to merge in our roles
		// (in case admin is an admin because of a role, not a "natural" admin)
		this.usermgr.registerHook( 'after_load_session', this.afterUserLoadSession.bind(this) );
		
		// intercept user logout, so we can add in an external logout URL if configued (SSO)
		this.usermgr.registerHook( 'before_logout', this.beforeUserLogout.bind(this) );
		
		// create a http request instance for various tasks
		this.request = new PixlRequest( "xyOps v" + this.server.__version );
		this.request.setTimeout( 30 * 1000 );
		this.request.setFollow( 5 );
		this.request.setAutoError( true );
		this.request.setKeepAlive( true );
		
		this.airgapSetup();
		this.multiSetup();
		this.ssoSetup();
		this.mailerSetup();
		
		callback();
	}
	
	airgapSetup() {
		// setup things for airgapped mode
		var airgap = this.config.get('airgap') || {};
		if (!airgap.enabled) {
			this.request.setWhitelist( false );
			this.request.setBlacklist( false );
			return;
		}
		
		this.logDebug(3, "Setting up airgapped mode", airgap);
		
		if (airgap.whitelist && airgap.whitelist.length) this.request.setWhitelist( airgap.whitelist );
		else this.request.setWhitelist( false );
		
		if (airgap.blacklist && airgap.blacklist.length) this.request.setBlacklist( airgap.blacklist );
		else this.request.setBlacklist( false );
	}
	
	handleHome(args, callback) {
		// render home page
		var self = this;
		if (this.config.getPath('SSO.enabled')) return this.handleSSO(args, callback);
		
		args.internalFile = Path.resolve('htdocs/index.html');
		args.internalTTL = 'private, max-age=0';
		return callback(false);
	}
	
	tick() {
		// called every second
		var self = this;
		var now = Tools.timeNow(true);
		
		if (this.master) this.monitorJobs();
		
		if (this.numSocketClients) {
			var status = {
				epoch: Tools.timeNow(),
				activeJobs: this.getActiveJobs(),
				internalJobs: this.getInternalJobs(),
				numQueuedJobs: this.countQueuedJobs()
			};
			
			if (this.master) this.doUserBroadcastAll( 'status', status );
			this.sendSocketPings();
		}
		
		if (this.master && this.state && this.state.dirty) {
			// write changed state to storage
			delete this.state.dirty;
			this.storage.put( 'global/state', this.state, function(err) {
				if (err) self.logError('state', "Failed to update state: " + err);
			} );
			this.doUserBroadcastAll( 'update', { state: this.state } );
		}
		
		if (this.master) {
			this.masterTick();
			this.checkTicketChanges();
		}
	}
	
	minute(dargs) {
		// run tasks every minute
		this.multiBackupStatsUpdate();
	}
	
	beforeUserLogin(args, callback) {
		// infuse data into user login client response
		var self = this;
		if (!this.master) return callback( new Error("Non-primary servers cannot log in users.") );
		
		args.resp = {
			epoch: Tools.timeNow(),
			activeJobs: this.getActiveJobs(),
			internalJobs: this.getInternalJobs(),
			numQueuedJobs: this.countQueuedJobs(),
			activeAlerts: this.activeAlerts,
			serverCache: this.serverCache,
			
			servers: this.servers,
			groups: this.groups,
			monitors: this.monitors,
			alerts: this.alerts,
			
			categories: this.categories,
			channels: this.channels,
			web_hooks: this.web_hooks,
			buckets: this.buckets,
			secrets: this.secrets, // just metadata, no actual secrets in here
			events: this.events,
			plugins: this.plugins,
			tags: this.tags,
			roles: this.roles,
			
			users: [],
			api_keys: [],
			
			state: this.state,
			stats: this.stats,
			sounds: this.sounds
		};
		
		// load all API keys
		self.storage.listGet( 'global/api_keys', 0, 0, function(err, keys) {
			if (err) self.logError('keys', "Failed to load API key list: " + err);
			if (keys) {
				keys.forEach( function(item) { item.key = 'REDACTED'; } );
				args.resp.api_keys = keys;
			}
			
			// load all users
			self.storage.listGet( 'global/users', 0, 0, function(err, stubs, list) {
				if (err) {
					self.logError('users', "Failed to load user list: " + err);
					return callback();
				}
				
				// create array of paths to user records
				var paths = [];
				for (var idx = 0, len = stubs.length; idx < len; idx++) {
					paths.push( 'users/' + self.usermgr.normalizeUsername(stubs[idx].username) );
				}
				
				// load all users
				self.storage.getMulti( paths, function(err, users) {
					if (err) {
						self.logError('users', "Failed to load users: " + err, callback);
						return callback();
					}
					
					// remove passwords and salts
					var stubs = [];
					for (var idx = 0, len = users.length; idx < len; idx++) {
						// only send over a small stub record, with only a few key bits for display purposes
						var user = users[idx];
						stubs.push({ username: user.username, full_name: user.full_name, icon: user.icon, roles: user.roles });
					}
					
					// success
					args.resp.users = stubs;
					callback();
				} ); // getMulti
			}); // listGet (users)
		}); // listGet (keys)
	}
	
	afterUserLogin(args) {
		// user has logged in
		var username = args.user.username;
		var user_stub = {};
		
		['username', 'full_name', 'email', 'active', 'created', 'modified'].forEach( function(key) {
			user_stub[key] = args.user[key];
		});
		
		var activity_args = this.getClientInfo(args, { 
			user: user_stub,
			session_id: args.session.id // needed for 'logout all sessions'
		});
		
		this.logActivity('user_login', activity_args);
		this.logUserActivity(username, 'user_login', activity_args);
	}
	
	beforeUserCreate(args, callback) {
		// hook user create (before changes are committed)
		var self = this;
		var user = args.user;
		if (!this.master) return callback( new Error("Non-primary servers cannot manage users.") );
		
		Tools.mergeHashInto( user, this.config.get('default_user_prefs') );
		
		if (!user.roles) user.roles = [];
		
		callback();
	}
	
	beforeUserUpdate(args, callback) {
		// hook user update (before changes are committed)
		// (this ONLY fires when updating an existing user, not for new, nor delete)
		var self = this;
		var user = args.user;
		var updates = args.params;
		if (!this.master) return callback( new Error("Non-primary servers cannot manage users.") );
		
		// do not allow user to self-update these params
		if (!args.admin_user) {
			delete updates.salt;
		}
		
		// check for changed password (adds log entry)
		if (updates.new_password) {
			args.do_password = true;
		}
		
		callback();
	}
	
	afterUserChange(action, args) {
		// user has changed (or created, or deleted)
		var self = this;
		var username = args.user.username; // username cannot change
		var redacted_user = Tools.copyHashRemoveKeys( args.user, { password: 1, salt: 1 } );
		var stub_user = { username, full_name: args.user.full_name, icon: args.user.icon, roles: args.user.roles };
		
		// add to activity log in the background
		var activity_args = this.getClientInfo(args, { 
			user: redacted_user
		});
		this.logActivity(action, activity_args);
		
		if (!args.admin_user && (action != 'user_delete')) {
			// don't track admin user updates (this would expose admin's IP to user)
			this.logUserActivity(username, action, activity_args);
		}
		if (!args.admin_user && args.do_password && (action != 'user_password')) {
			// don't track admin user updates (this would expose admin's IP to user)
			this.logUserActivity(username, 'user_password', activity_args);
		}
		
		// delete user security log on account delete
		if (action == 'user_delete') {
			this.storage.enqueue( function(task, callback) {
				self.storage.listDelete( 'security/' + self.usermgr.normalizeUsername(username), true, callback );
			});
			
			// close all user sockets too
			for (var id in this.sockets) {
				var socket = this.sockets[id];
				if (socket.auth && socket.user && (socket.username == username)) {
					this.logDebug(5, "Closing socket for deleted user: " + socket.id, { username });
					socket.auth = false;
					socket.close();
				}
			}
		} // user_delete
		
		// update socket `admin` flag for all user sockets
		if (action == 'user_update') {
			for (var id in this.sockets) {
				var socket = this.sockets[id];
				if (socket.auth && socket.user && (socket.username == username)) {
					var privs = this.getComputedPrivileges(args.user);
					socket.admin = !!(privs.admin);
					
					if (!args.user.active) {
						// user was disaled, close sockets
						this.logDebug(5, "Closing socket for disabled user: " + socket.id, { username });
						socket.auth = false;
						socket.close();
					}
				} // user's socket
			} // foreach socket
		} // user_update
		
		// notify all socket users
		if ((action == 'user_create') || (action == 'user_update')) {
			// send stub user update to all connected users
			self.doUserBroadcastAll('single', { list: 'users', item: stub_user });
			
			// and send redeacted user update to user's own sockets
			self.doUserBroadcast(username, 'self_update', { user: redacted_user });
		}
		else if (action == 'user_delete') {
			self.doUserBroadcastAll('single', { list: 'users', item: stub_user, delete: true });
		}
	}
	
	afterUserLoadSession(args) {
		// augment user with roles (for usermgr loadSession context only)
		var self = this;
		var { session, user } = args;
		
		(user.roles || []).forEach( function(role_id) {
			var role = Tools.findObject( self.roles, { id: role_id } );
			if (role && role.privileges) Tools.mergeHashInto( user.privileges, role.privileges );
		} );
	}
	
	beforeUserLogout(args, callback) {
		// augment user logout with redirect url (SSO)
		var sso = this.config.get('SSO');
		if (!sso || !sso.enabled || !sso.logout_url) return callback();
		
		// allow user to add the id token
		var url_args = {};
		var request = args.request;
		if (request.headers['authorization'] && request.headers['authorization'].match(/^Bearer\s+(\S+)$/)) {
			url_args.id_token_hint = encodeURIComponent( RegExp.$1 );
		}
		this.logSSO(9, "Logging user out: " + sso.logout_url, url_args );
		
		// args.resp will get merged with logout API response
		args.resp = { redirect: Tools.sub( sso.logout_url, url_args ) };
		callback();
	}
	
	logUserActivity(username, action, orig_data) {
		// add event to user activity logs async
		var self = this;
		if (!this.master) return;
		
		assert( Tools.isaHash(orig_data), "Must pass a data object to logUserActivity" );
		var data = Tools.copyHash( orig_data, true );
		
		data.action = action;
		data.epoch = Tools.timeNow(true);
		
		this.storage.enqueue( function(task, callback) {
			self.storage.listUnshift( 'security/' + self.usermgr.normalizeUsername(username), data, callback );
		});
	}
	
	logActivity(action, orig_data) {
		// add event to activity logs async
		var self = this;
		if (!this.master) return;
		
		assert( Tools.isaHash(orig_data), "Must pass a data object to logActivity" );
		var data = Tools.copyHash( orig_data, true );
		
		data.action = action;
		data.epoch = Tools.timeNow(true);
		
		// insert into activity database
		data.id = Tools.generateShortID('a');
		data.keywords = data.keywords || [];
		if (data.username) data.keywords.push( data.username.replace(/\W/g, '_') );
		if (data.admin) data.keywords.push( data.admin.replace(/\W/g, '_') );
		if (data.ips) data.keywords = data.keywords.concat( data.ips );
		
		this.unbase.insert( 'activity', data.id, data, function(err) {
			if (err) self.logError('unbase', "Database error on activity insert: " + err);
			else self.doPageBroadcast( 'ActivityLog', 'activity', { data } );
		} );
		
		// fire system hook for action
		this.fireSystemHook(action, data);
		
		// track counts of transaction types in daily stats
		this.updateDailyStat( action, 1 );
		
		// send a special cachebust command to all connected users
		this.doUserBroadcastAll('cachebust', {});
		
		// nofity all admins about activity (only admins, for security purposes)
		this.doAdminBroadcastAll('activity', data);
	}
	
	logTransaction(code, msg, data) {
		// proxy request to system logger with correct component for dedi trans log
		this.logger.set( 'component', 'Transaction' );
		this.logger.transaction( code, msg, data );
		
		if (!data) data = {};
		if (!data.description) data.description = msg;
		
		this.logActivity(code, data);
	}
	
	getState(path) {
		// fetch something from state
		return Tools.getPath( this.state, path );
	}
	
	putState(path, value) {
		// put something into state, mark as dirty (saved on next tick)
		this.logDebug(9, "State change: " + path, value);
		Tools.setPath( this.state, path, value );
		this.state.dirty = true;
	}
	
	deleteState(path) {
		// delete something from state, mark as dirty (saved on next tick)
		this.logDebug(9, "State delete: " + path);
		Tools.deletePath( this.state, path );
		this.state.dirty = true;
	}
	
	shutdown(callback) {
		// shutdown sequence
		var self = this;
		this.shut = true;
		this.logDebug(2, "Shutting down xyOps");
		this.multiShutdown();
		this.maintShutdown();
		
		this.stopSocketListener( function() {
			self.waitForInternalJobs( function() {
				if (self.master && self.state && self.state.dirty) {
					// write changed state to storage
					delete self.state.dirty;
					self.storage.put( 'global/state', self.state, function(err) {
						if (err) self.logError('state', "Failed to update state: " + err);
						callback();
					} );
				}
				else callback();
			} ); // waitForInternalJobs
		} ); // stopSocketListener
	}
	
}; // class xyOps

ClassUtil.mixin( xyOps, [
	require('./util.js'),     // Utilities Mixin
	require('./secret.js'),   // Secret Mixin
	require('./api.js'),      // API Layer Mixin
	require('./comm.js'),     // Communication Layer Mixin
	require('./mailer.js'),   // Mailer Layer Mixin
	require('./multi.js'),    // Multi-Master Layer Mixin
	require('./server.js'),   // Server Layer Mixin
	require('./maint.js'),    // Maintenance Layer Mixin
	require('./job.js'),      // Job Layer Mixin
	require('./workflow.js'), // Workflow Layer Mixin
	require('./action.js'),   // Action Layer Mixin
	require('./monitor.js'),  // Monitoring Layer Mixin
	require('./schedule.js'), // Scheduler Layer Mixin
	require('./setup.js'),    // Setup Mixin
	require('./sso.js'),      // SSO Mixin
	require('./ticket.js'),   // Ticket Mixin
	require('./alert.js')     // Alert Mixin
] );

module.exports = xyOps;
