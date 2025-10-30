// xyOps API Layer - User
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const UserAgent = require('useragent-ng');
const Tools = require("pixl-tools");

class Users {
	
	api_get_user_activity(args, callback) {
		// get rows from user activity log (with pagination)
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listGet( 'security/' + self.usermgr.normalizeUsername(user.username), parseInt(params.offset || 0), parseInt(params.limit || 50), function(err, items, list) {
				if (err) {
					// no rows found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// parse user agents
				items.forEach( function(item) {
					if (!item.headers || !item.headers['user-agent']) return;
					var agent = UserAgent.parse( item.headers['user-agent'] );
					item.useragent = agent.toString(); // 'Chrome 15.0.874 / Mac OS X 10.8.1'
					item.useragent = item.useragent.replace(/Mac OS X [\d\.]+/, 'macOS');
					if (item.useragent.match(/\b(Other)\b/)) item.useragent = item.headers['user-agent'];
				});
				
				// success, return rows and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got data
		} ); // loaded session
	}
	
	api_user_settings(args, callback) {
		// update user settings (non-critical only)
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		delete params.password;
		delete params.new_password;
		delete params.old_password;
		delete params.salt;
		delete params.active;
		delete params.created;
		delete params.privileges;
		delete params.roles;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			for (var key in params) {
				user[key] = params[key];
			}
			
			var path = 'users/' + self.usermgr.normalizeUsername(user.username);
			user.modified = Tools.timeNow(true);
			
			self.logDebug(6, "Updating user", user);
			
			self.storage.put( path, user, function(err) {
				if (err) return self.doError('user', "Failed to save settings for: " + user.username + ": " + err, callback);
				
				// JH 2024-10-05: Not calling logActivity for this because it's used for non-critical user updates like simple prefs
				// self.logActivity('user_update', self.getClientInfo(args, { 
				// 	user: Tools.copyHashRemoveKeys( user, { password: 1, salt: 1 } )
				// }));
				
				callback({ 
					code: 0, 
					user: Tools.copyHashRemoveKeys( user, { password: 1, salt: 1 } )
				});
				
			}); // storage.put
		} ); // loaded session
	}
	
	api_check_user_exists(args, callback) {
		// checks if username is taken (used for showing green checkmark on form)
		var self = this;
		var query = args.query;
		var path = 'users/' + this.usermgr.normalizeUsername(query.username);
		if (!this.requireMaster(args, callback)) return;
		
		// do not cache this API response
		this.forceNoCacheResponse(args);
		
		if (!query.username.match(this.usermgr.usernameMatch)) {
			// invalid username
			callback({ code: 0, user_invalid: true });
			return;
		}
		
		if (query.username.match(this.usermgr.usernameBlock)) {
			// if username is blocked, return as if it exists (username taken)
			callback({ code: 0, user_exists: true });
			return;
		}
		
		this.storage.get(path, function(err, user) {
			callback({ code: 0, user_exists: !!user });
		} );
	}
	
	api_logout_all(args, callback) {
		// logout all sessions associated with user (except current session)
		// do this in the background
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			password: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			if (!self.usermgr.comparePasswords(params.password, user.password, user.salt)) {
				return self.doError('login', "Your password is incorrect.", callback);
			}
			
			callback({ code: 0 });
			
			// begin background processing
			self.storage.enqueue( function(task, callback) {
				self.logoutAllUserSessions(session, user, callback);
			});
			
			// log user activity
			var activity_args = self.getClientInfo(args, { 
				user: Tools.copyHashRemoveKeys( user, { password: 1, salt: 1 } ),
				description: "Logged out all user sessions by request"
			});
			self.logActivity('notice', activity_args);
			self.logUserActivity(user.username, 'warning', activity_args);
			
		}); // loadSession
	}
	
	logoutAllUserSessions(session, user, callback) {
		// logout all sessions associated with user (except current session)
		var self = this;
		var username = user.username;
		var current_session_id = session.id;
		var report = '';
		
		this.logDebug(5, "Logging out all user sessions for: " + username, { exclude: current_session_id });
		var stats = { sockets: 0, sessions: 0 };
		var job = this.startInternalJob({ title: "Logging out user sessions", username: user.username, type: 'user', stats });
		
		this.storage.listEach( 'security/' + this.usermgr.normalizeUsername(username), function(item, idx, callback) {
			// we only care about `user_login` actions
			if ((item.action != 'user_login') || !item.session_id) {
				return process.nextTick(callback);
			}
			if (item.session_id == current_session_id) {
				self.logDebug(9, "Skipping session delete, as it is the current one: " + item.session_id, { username } );
				return process.nextTick(callback);
			}
			
			// logout associated websockets if found
			// Note: we're not actually closing the sockets here, but we're sending a logout command, AND we're deauthorizing the sockets
			Tools.findObjects( Object.values(self.sockets), { type: 'user', session_id: item.session_id } ).forEach( function(socket) {
				self.logDebug(7, "Logging out connected user via websoket command: " + socket.id);
				socket.send( 'logout', {} );
				socket.auth = false;
				stats.sockets++;
			} );
			
			var session_key = 'sessions/' + item.session_id;
			self.storage.get( session_key, function(err, data) {
				// error is non-fatal, as session may have expired or been previously deleted
				if (err || !data) {
					return process.nextTick(callback);
				}
				
				self.storage.delete( session_key, function(err) {
					// error is non-fatal, as session may have expired or been previously deleted
					if (err) return process.nextTick(callback);
					
					if (report) report += "\n\n";
					report += [
						"Session ID: " + item.session_id,
						"IP Address: " + data.ip,
						"User Agent: " + UserAgent.parse( data.useragent ).toString(),
						"Created: " + (new Date(data.created * 1000)).toString(),
						"Last Used: " + (new Date(data.modified * 1000)).toString()
					].join("\n");
					
					self.logDebug(6, "Deleted user session by request: " + item.session_id, data);
					stats.sessions++;
					callback();
				}); // storage.delete
			}); // storage.get
		}, 
		function() {
			// all done, send report if we actually deleted anything
			self.logDebug(6, "Completed logout sweep across security/" + self.usermgr.normalizeUsername(username));
			
			if (report.length) {
				var args = {
					session: session, 
					user: user, 
					report: report,
					useragent: UserAgent.parse( session.useragent ).toString()
				};
				self.sendFancyMail( 'logout_all_sessions', args, function(err) {
					if (err) self.logError('email', "Failed to send session report e-mail: " + err, session);
				} ); // sendFancyMail
			}
			else {
				self.logDebug(6, "No sessions deleted for " + username + ", so skipping report e-mail");
			}
			
			job.finish();
			callback(); // queue
		} ); // listEach
	}
	
}; // class Users

module.exports = Users;
