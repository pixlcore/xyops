// xyOps Single Sign-On (SSO) Layer
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const Path = require('path');
const os = require('os');
const cp = require('child_process');
const async = require("async");
const Tools = require("pixl-tools");
const ACL = require('pixl-acl');
const noop = function() {};

class SSO {
	
	/* {
		"enabled": true,
		"hybrid": false,
		"whitelist": ["127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "::1/128", "fd00::/8", "169.254.0.0/16", "fe80::/10"],
		"header_map": {
			"username": "x-forwarded-user",
			"full_name": "x-forwarded-user",
			"email": "x-forwarded-email",
			"groups": "x-forwarded-groups"
		},
		"cleanup_username": true,
		"cleanup_full_name": true,
		"group_role_map": {
			"pixlcore:owners": []
		},
		"group_privilege_map": {
			"pixlcore:owners": ["admin"]
		},
		"replace_roles": false,
		"replace_privileges": false,
		"logout_url": "/oauth2/sign_out?rd=https%3A%2F%2Fgoogle.com%2F"
	}*/
	
	ssoSetup() {
		// setup SSO subsystem
		var sso = this.config.get('SSO');
		if (!sso || !sso.enabled) return;
		
		this.ssoPresets = {
			tailscale: {
				"header_map": {
					"username": "Tailscale-User-Login",
					"full_name": "Tailscale-User-Name",
					"email": "Tailscale-User-Login",
					"avatar": "Tailscale-User-Profile-Pic",
					"groups": "Tailscale-App-Capabilities"
				},
				"logout_url": "/api/app/sso_logout"
			}
		};
		
		this.logSSO(3, "SSO is enabled");
		
		if (sso.whitelist) {
			// accept CSV string or array
			var whitelist = (typeof(sso.whitelist) == 'string') ? sso.whitelist.split(/\,\s*/) : sso.whitelist;
			this.ssoWhitelist = new ACL( whitelist );
		}
	}
	
	logSSO(level, msg, data) {
		// log debug msg with pseudo-component
		if (this.debugLevel(level)) {
			this.logger.set( 'component', 'SSO' );
			this.logger.print({ category: 'debug', code: level, msg: msg, data: data });
		}
	}
	
	doSSOError(code, description, callback) {
		// handle SSO error by displaying full page error
		var title = "Single Sign-On (SSO) Error";
		this.api.logError( code, description );
		
		// inject error into bootstrap loader, which bubbles up to a full page error
		fs.readFile( 'htdocs/index.html', 'utf8', function(err, body) {
			body = body.replace( '<script src="/api/app/config"></script>', function() {
				return `<script src="/api/app/config?code=${encodeURIComponent(code)}&title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}"></script>`;
			} );
			
			callback( "200 OK", { 'Content-Type': "text/html" }, body );
		} ); // fs.readFile
		
		return false;
	}
	
	handleSSO(args, callback) {
		// handle SSO request early, called from handleHome
		var self = this;
		var usermgr = this.usermgr;
		var sso = this.config.get('SSO');
		
		// merge in preset if applicable
		if (sso.preset && this.ssoPresets[sso.preset]) {
			sso = Tools.mergeHashes( sso, this.ssoPresets[sso.preset] );
		}
		
		this.forceNoCacheResponse(args);
		
		if (this.ssoWhitelist && !this.ssoWhitelist.check(args.request.socket.remoteAddress)) {
			this.logSSO(1, "Disallowing request from IP: " + args.request.socket.remoteAddress + " (not in whitelist)");
			return this.doSSOError('sso', "SSO Auth Flow Failure: IP address is not allowed.", callback);
		}
		
		if (!this.master) {
			return self.doSSOError('sso', "Server is not a primary conductor.", callback);
		}
		
		// see if user already has a valid session
		this.loadSession( args, function(err, session, user) {
			if (session && user) {
				// already logged in
				self.logSSO(7, "User is already logged in: " + user.username);
				args.internalFile = Path.resolve('htdocs/index.html');
				args.internalTTL = 'private, max-age=0';
				return callback(false); // passthru
			}
			
			// custom sso plugin command
			if (sso.command && !args._sso_command_response) {
				return self.execSSOCommand(args, callback);
			}
			
			self.logSSO(5, "Starting SSO auth flow", { uri: args.request.url, headers: self.debug ? args.request.headers : undefined });
			
			// are the magic headers present?
			var external_user = {};
			var header_map = sso.header_map;
			if (!header_map) {
				// no header map provided
				return self.doSSOError('sso', "SSO Auth Flow Failure: No header map provided.", callback);
			}
			
			// convert headers to standard keys we understand
			for (var key in header_map) {
				external_user[key] = args.request.headers[ header_map[key].toLowerCase() ] || '';
			}
			
			if (!external_user.username || !external_user.email) {
				// required bits not present
				if (sso.hybrid) {
					// allow non-SSO mode when magic headers not present
					self.logSSO(7, "SSO headers not found, falling back to local auth.");
					args.internalFile = Path.resolve('htdocs/index.html');
					args.internalTTL = 'private, max-age=0';
					return callback(false);
				}
				else return self.doSSOError('sso', "SSO Auth Flow Failure: Required headers not present.", callback);
			}
			
			// cleanup / massage fields
			var username = sso.cleanup_username ? 
				external_user.username.replace(/\@.+$/, '').replace(/[^\w\-\.]+/g, '').toLowerCase() : 
				external_user.username.replace(/[^\w\-\.]+/g, '_').toLowerCase();
			
			if (!external_user.full_name) external_user.full_name = username;
			if (sso.cleanup_full_name) {
				// also cleanup full name (i.e. set to email field)
				external_user.full_name = self.toTitleCase( external_user.full_name.replace(/\@.+$/, '').replace(/\./g, ' ') );
			}
			
			self.logSSO(9, "Got external user via trusted headers: " + username, external_user );
			
			if (!username.match(usermgr.usernameMatch)) {
				return self.doSSOError('sso', "Username contains illegal characters: " + username, callback);
			}
			
			// user found in response!  update our records and create a local session
			var path = 'users/' + usermgr.normalizeUsername(username);
			
			self.logSSO(8, "Testing if user exists: " + path, { username });
			
			self.storage.get(path, function(err, user) {
				var new_user = false;
				if (!user) {
					// first time, create new user
					self.logSSO(6, "Creating new user: " + username);
					new_user = true;
					user = Tools.mergeHashes( {
						username: username,
						active: 1,
						remote: true,
						sync: true,
						created: Tools.timeNow(true),
						modified: Tools.timeNow(true),
						salt: Tools.generateUniqueID( 64, username ),
						password: Tools.generateUniqueID(64), // unused
						privileges: self.getDefaultUserPrivileges(),
						roles: []
					}, self.config.get('default_user_prefs') );
				} // new user
				else {
					self.logSSO(7, "User already exists: " + username);
					if (user.force_password_reset) {
						return self.doSSOError('login', "Sorry, your account is locked out.  Please contact your system administrator.", callback);
					}
					if (!user.active) {
						return self.doSSOError('login', "Sorry, your user account is disabled.  Please contact your system administrator.", callback);
					}
					user.remote = true;
					if (!('sync' in user)) user.sync = true;
				}
				
				// copy to args for logging
				args.user = user;
				
				var finish = function() {
					// sync user info
					if (user.sync) {
						user.full_name = external_user.full_name;
						user.email = external_user.email;
					}
					
					/* "group_role_map": {
						"pixlcore:owners": []
					},
					"group_privilege_map": {
						"pixlcore:owners": ["admin"]
					} */
					
					// apply roles and privs to user record
					if (header_map.groups) {
						var raw_groups = [];
						
						// support ts-app-cap json header format, and also simple delimited
						if (external_user.groups && String(external_user.groups).trim().match(/^\{[\S\s]+\}$/)) {
							// "tailscale-app-capabilities": "{\"xyops.io/cap/ts\":[{\"privileges\":[\"admin\"],\"roles\":[]}]}",
							try {
								var ts_json = JSON.parse( external_user.groups );
								var ts_cap_id = sso.ts_cap_id || 'xyops.io/cap/ts';
								
								if (ts_json[ts_cap_id] && Array.isArray(ts_json[ts_cap_id])) {
									if (sso.replace_roles) user.roles = [];
									if (sso.replace_privileges) user.privileges = {};
									
									ts_json[ts_cap_id].forEach( function(cap) {
										if (cap.groups && Array.isArray(cap.groups)) raw_groups = raw_groups.concat( cap.groups );
										if (cap.privileges && Array.isArray(cap.privileges)) cap.privileges.forEach( function(priv) { user.privileges[priv] = 1; } );
										if (cap.roles && Array.isArray(cap.roles)) user.roles = user.roles.concat( cap.roles );
									} );
									
									// remove dupes
									user.roles = [ ...new Set(user.roles) ];
									
									self.logSSO(9, "User privileges/roles were auto-set by: " + ts_cap_id, {
										capabilities: ts_json,
										privileges: user.privileges,
										roles: user.roles
									});
								}
							}
							catch (e) {
								self.logSSO(5, "Warning: Failed to parse JSON in group header: " + e);
							}
						}
						else {
							// simple delimited group format
							raw_groups = external_user.groups ? external_user.groups.split( sso.group_role_separator || ',' ) : [];
						}
						
						if (sso.group_role_map) {
							if (sso.replace_roles) user.roles = [];
							
							raw_groups.forEach( function(raw_group) {
								if (!sso.group_role_map[raw_group]) return;
								user.roles = user.roles.concat( sso.group_role_map[raw_group] );
							} ); // foreach raw group
							
							// remove dupes
							user.roles = [ ...new Set(user.roles) ];
						} // sso.group_role_map
						
						if (sso.group_privilege_map) {
							if (sso.replace_privileges) user.privileges = {};
							
							raw_groups.forEach( function(raw_group) {
								(sso.group_privilege_map[raw_group] || []).forEach( function(priv) { user.privileges[priv] = 1; } );
							}); // foreach raw group
						}
						
						// special case: if admin privilege is granted, remove all other privileges
						if (user.privileges.admin) user.privileges = { admin: 1 };
					} // roles and privs
					
					// special admin bootstrap (log warning if used)
					if (sso.admin_bootstrap && (username === sso.admin_bootstrap)) {
						user.privileges = { admin: 1 };
						
						var activity_args = self.getClientInfo(args, { 
							user: Tools.copyHashRemoveKeys( user, { password: 1, salt: 1 } ),
							description: "SSO: User was bootstrapped into a full administrator: " + username
						});
						self.logActivity('warning', activity_args);
						self.logUserActivity(user.username, 'warning', activity_args);
					} // admin_bootstrap
					
					// save user locally
					self.storage.put( path, user, function(err) {
						if (err) return self.doSSOError('user', "Internal Error: Failed to save user: " + err, callback);
						
						if (new_user) {
							self.logSSO(6, "Successfully created user: " + username);
							usermgr.logTransaction('user_create', username, 
								self.getClientInfo(args, { user: Tools.copyHashRemoveKeys( user, { password: 1, salt: 1 } ) }));
						}
						
						// now create session
						var now = Tools.timeNow(true);
						var exp_sec = 86400 * usermgr.config.get('session_expire_days');
						var expiration_date = Tools.normalizeTime( now + exp_sec, { hour: 0, min: 0, sec: 0 } );
						
						// create session id and session data
						var session_id = Tools.generateUniqueID( 64, username );
						var session = {
							id: session_id,
							username: username,
							ip: args.ip,
							useragent: args.request.headers['user-agent'],
							created: now,
							modified: now,
							expires: expiration_date
						};
						
						// add csrf token
						if (self.usermgr.config.get('use_csrf')) {
							session.csrf_token = Tools.generateUniqueID(64);
						}
						
						self.logSSO(9, "Logging user in: " + username + ": New Session ID: " + session_id, session);
						
						// store session object
						self.storage.put('sessions/' + session_id, session, function(err, data) {
							if (err) {
								return self.doSSOError('user', "Internal Error: Failed to create session: " + err, callback);
							}
							
							// copy to args to logging
							args.session = session;
							
							self.logSSO(6, "Successfully logged in", username);
							usermgr.logTransaction('user_login', username, self.getClientInfo(args));
							
							// set session expiration
							self.storage.expire( 'sessions/' + session_id, expiration_date );
							
							// set our session cookie
							args.setCookie( 'session_id', session_id, Tools.mergeHashes( usermgr.config.get('cookie_settings'), {
								maxAge: exp_sec
							} ) );
							
							// internal redirect to index.html
							args.internalFile = Path.resolve('htdocs/index.html');
							args.internalTTL = 'private, max-age=0';
							callback(false);
							
							usermgr.fireHook('after_login', args);
							
							// add to master user list in the background
							if (new_user) {
								if (usermgr.config.get('sort_global_users')) {
									self.storage.listInsertSorted( 'global/users', { username: username }, ['username', 1], function(err) {
										if (err) usermgr.logError( 1, "Failed to add user to global list: " + err );
										usermgr.fireHook('after_create', args);
									} );
								}
								else {
									self.storage.listUnshift( 'global/users', { username: username }, function(err) {
										if (err) usermgr.logError( 1, "Failed to add user to global list: " + err );
										usermgr.fireHook('after_create', args);
									} );
								}
							} // new user
							else {
								usermgr.fireHook('after_update', args);
							}
							
						} ); // save session
					} ); // save user
				}; // finish
				
				// fire correct hook for action
				if (new_user) {
					usermgr.fireHook('before_create', args, function(err) {
						if (err) {
							return self.doSSOError('user', "Internal Error: Failed to create user: " + err, callback);
						}
						if (external_user.avatar) self.importExternalAvatar(username, external_user.avatar, finish);
						else finish();
					});
				}
				else {
					usermgr.fireHook('before_update', args, function(err) {
						if (err) {
							return self.doSSOError('user', "Internal Error: Failed to update user: " + err, callback);
						}
						finish();
					});
				}
				
			} ); // user get
		} ); // loadSession
	}
	
	importExternalAvatar(username, url, callback) {
		// import external avatar for user
		var self = this;
		var temp_file = Path.join( os.tmpdir(), 'xyops-avatar-temp-' + Tools.generateShortID() + '.bin' );
		
		this.logSSO(7, `Importing external avatar for user: ${username}: ${url}`);
		
		this.request.get( url, { timeout: 5 * 1000, download: temp_file }, function(err, resp, data, perf) {
			if (err) {
				self.logSSO(5, "Failed to fetch user avatar image: " + err);
				return callback();
			}
			
			var base_path = '/users/' + username + '/avatar';
			var sizes = [256, 64];
			
			async.eachSeries( sizes,
				function(size, callback) {
					self.resizeStoreImage( temp_file, size, size, base_path + '/' + size + '.png', callback );
				},
				function(err) {
					// all done with all image sizes
					if (err) self.logSSO(5, "Failed to process imported avatar image: " + err.toString());
					else self.logSSO(7, "Successfully imported avatar image for user: " + username);
					
					// delete temp file and fire callback
					fs.unlink( temp_file, function() { callback(); } );
				}
			); // eachSeries
		} ); // request.get
	}
	
	execSSOCommand(args, callback) {
		// run custom sso command to intercept request and inject headers
		var self = this;
		var sso = this.config.get('SSO');
		var request = args.request;
		
		var hook_args = {};
		hook_args.xy = 1; // wire protocol version
		hook_args.type = 'sso'; // wire action
		hook_args.config = sso;
		hook_args.method = request.method;
		hook_args.url = request.url;
		hook_args.headers = request.headers;
		hook_args.cookies = args.cookies;
		hook_args.id = args.id;
		hook_args.ip = args.ip;
		hook_args.ips = args.ips;
		
		var child_cmd = sso.command;
		var child_opts = {
			cwd: os.tmpdir(),
			env: Object.assign( {}, this.cleanEnv() ),
			timeout: 60 * 1000
		};
		
		child_opts.env['XYOPS'] = this.server.__version;
		
		var puid = this.config.getPath('default_plugin_credentials.sso.uid') || '';
		var pgid = this.config.getPath('default_plugin_credentials.sso.gid') || '';
		
		if (puid && (puid != 0)) {
			var user_info = Tools.getpwnam( puid, true );
			if (user_info) {
				child_opts.uid = parseInt( user_info.uid );
				child_opts.gid = parseInt( user_info.gid );
				child_opts.env.USER = child_opts.env.USERNAME = user_info.username;
				child_opts.env.HOME = user_info.dir;
				child_opts.env.SHELL = user_info.shell;
			}
			else {
				return this.doSSOError('sso', "Could not determine user information for: " + puid, callback);
			}
		}
		if (pgid && (pgid != 0)) {
			var grp_info = Tools.getgrnam( pgid, true );
			if (grp_info) {
				child_opts.gid = grp_info.gid;
			}
			else {
				return this.doSSOError('sso', "Could not determine group information for: " + pgid, callback);
			}
		}
		
		this.logSSO(5, "Calling SSO Plugin for request ID: " + args.id + ": " + child_cmd);
		
		// sensitive data: only log at level 9
		this.logSSO(9, "Plugin input data for req: " + args.id, hook_args);
		
		var child = cp.exec( child_cmd, child_opts, function(err, stdout, stderr) {
			// parse json from output
			var json = null;
			if (!err && stdout.match(/\S/)) {
				// parse last line only, to omit any noise from plugin
				try { json = JSON.parse( stdout.replace(/\r\n/g, "\n").trim().split(/\n/).pop() ); }
				catch (e) {
					err = new Error("JSON Parse Error: " + (e.message || e));
					err.code = 'json';
				}
			}
			
			// sensitive data: only log at level 9
			self.logSSO(9, "Plugin raw response for req: " + args.id, { stdout, stderr });
			
			var err_prefix = "SSO Plugin Error: ";
			if (err) {
				return self.doSSOError('sso', err_prefix + err, callback);
			}
			if (!json) {
				return self.doSSOError('sso', err_prefix + "No JSON found in response STDOUT", callback);
			}
			if (!json.xy) {
				return self.doSSOError('sso', err_prefix + "No XYWP format flag found in response JSON", callback);
			}
			if (json.code) {
				return self.doSSOError('sso', err_prefix + (json.description || json.code), callback);
			}
			if (!json.headers || !Tools.isaHash(json.headers)) {
				return self.doSSOError('sso', err_prefix + "No headers found in response JSON", callback);
			}
			
			// sensitive data: only log at level 9
			self.logSSO(9, "Plugin JSON response for req: " + args.id, json);
			
			// merge headers back into original request
			Tools.mergeHashInto(request.headers, json.headers);
			
			// add re-entry flag
			args._sso_command_response = true;
			
			// recurse for SSO
			self.handleSSO(args, callback);
		} ); // cp.exec
		
		// Write hook data to child's stdin
		child.stdin.on('error', noop);
		child.stdin.write( JSON.stringify(hook_args) + "\n" );
		child.stdin.end();
	}
	
	api_sso_logout(args, callback) {
		// show logout page but with special message about IdP logout
		var name = this.config.getPath('client.name');
		args.params = {
			type: 'info',
			title: name + ' Logout Successful',
			description: `You have been logged out of ${name}, however your SSO Identity Provider is likely still keeping you logged in with them.  You may need to take additional actions to truly log yourself all the way out.`
		};
		this.api_message(args, callback);
	}
	
}; // class SSO

module.exports = SSO;
