// xyOps Communication Layer
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

app.comm = {
	
	connectTimeoutSec: 5,
	statusTimeoutSec: 60,
	socket: null,
	commandQueue: [],
	
	init: function() {
		// connect to server via socket.io
		// this is called on every login
		this.socketConnect();
	},
	
	disconnect: function() {
		// kill socket if connected, and prevent auto-reconnect
		if (this.socket) {
			this.socket.forceDisconnect = true;
			Debug.trace('comm', "Destroying previous socket");
			try { this.socket.close(); } 
			catch(err) {
				Debug.trace('comm', "Failed to close socket: " + err);
			}
			this.socket = null;
		}
	},
	
	socketConnect: function() {
		// connect to server via websocket
		var self = this;
		var url = location.href.replace(/^http/i, "ws"); // this regexp works for both https and http
		url = url.replace(/\#.*$/, '');
		var progress_message = "Reconnecting to server...";
		
		// don't do anything if user is not logged in
		if (!app.getPref('username')) return;
		
		this.disconnect();
		
		Debug.trace('comm', "WebSocket Connect: " + url);
		
		// custom socket abstraction layer
		var socket = this.socket = {
			ws: new WebSocket( url ),
			
			connected: false,
			disconnected: false,
			
			connectTimer: setTimeout( function() {
				Debug.trace('comm', "Socket connect timeout");
				socket.close();
			}, this.connectTimeoutSec * 1000 ),
			
			emit: function(cmd, data) {
				Debug.trace('comm', "Sending socket message: " + cmd, data);
				this.ws.send( JSON.stringify({ cmd: cmd, data: data }) );
			},
			
			close: function() {
				this.ws.close();
			}
		};
		
		socket.ws.onopen = function (event) {
			// socket connected
			if (socket.connectTimer) {
				clearTimeout( socket.connectTimer );
				delete socket.connectTimer;
			}
			
			socket.connected = true;
			socket.lastPing = hires_time_now();
			
			Debug.trace('comm', "WebSocket connected successfully");
			
			if (Dialog.progress) {
				Dialog.hideProgress();
			}
			
			// authenticate websocket now
			socket.emit( 'authenticate', {} );
		};
		
		socket.ws.onmessage = function (event) {
			// got message from server, parse JSON and handle
			// Debug.trace('comm', "Got message from server: " + event.data);
			var json = JSON.parse( event.data );
			self.handleSocketMessage(socket, json);
		};
		
		socket.ws.onclose = function (event) {
			// socket has closed
			Debug.trace('comm', "Socket closed");
			socket.disconnected = true;
			socket.connected = false;
			
			if (socket.connectTimer) {
				clearTimeout( socket.connectTimer );
				delete socket.connectTimer;
			}
			if (socket.forceDisconnect) {
				// deliberate disconnect, stop here
				return;
			}
			if (!app.getPref('username')) {
				// user logged out, do not reconnect
				return;
			}
			
			Debug.trace('comm', "Reconnecting in a moment...");
			if (!Dialog.progress) {
				Dialog.showProgress( 1.0, progress_message );
			}
			setTimeout( function() { self.socketConnect(); }, 1000 );
			self.socket = null;
		};
	},
	
	handleSocketMessage: function(socket, json) {
		// process message from server
		var self = this;
		var cmd = json.cmd;
		var data = json.data;
		
		switch (cmd) {
			case 'status':
				// status update (every second)
				socket.lastPing = hires_time_now();
				this.handleStatusUpdate(data);
			break;
			
			case 'echo':
				// send back same data we got
				socket.lastPing = hires_time_now();
				socket.emit('echoback', data);
			break;
			
			case 'auth_failure':
				// authentiation failure (should never happen)
				var msg = data.description;
				app.doError(msg);
				app.doUserLogout(true);
			break;
			
			case 'retry':
				// server is not master, go into a retry loop
				// FUTURE: data.masterHost may point to the new master
				Debug.trace('comm', "Server has told us to try again...");
				socket.close();
			break;
			
			case 'login':
				// auth successful
				Debug.trace('user', "WebSocket auth successful!");
				socket.auth = true;
				
				// immediately send our nav loc
				socket.emit('user_nav', { loc: Nav.loc });
				
				// flush queue
				this.commandQueue.forEach( function(item) {
					self.sendCommand.apply( self, item );
				} );
				this.commandQueue = [];
				
				// verify server version
				if (data.version && app.version && (data.version != app.version)) {
					// server software was upgraded, so we need a refresh
					Debug.trace('user', "Software version mismatch: " + data.version + " != " + app.version);
					this.forceVersionRefresh(data);
				}
			break;
			
			case 'logout':
				// server wants us to logout (bad session, etc.)
				app.doUserLogout(true);
			break;
			
			case 'update':
				// server is sending us an update
				this.handleDataUpdate(data);
			break;
			
			case 'single':
				// server is sending us a single item update (api_key or user)
				this.handleSingleDataUpdate(data);
			break;
			
			case 'page_update':
				// page-specific data update (e.g. live log)
				this.handlePageUpdate(data);
			break;
			
			case 'activity':
				// item added to activity log (admin only)
				this.handleActivity(data);
			break;
			
			case 'notify':
				// custom notification for user
				if (data.type == 'channel') app.showChannelMessage(data);
				else {
					app.showMessage( data.type, data.message, data.lifetime || 0, data.loc || '' );
					if (data.sound) app.playSound(data.sound);
				}
			break;
			
			case 'cachebust':
				// bust cache (something on the server has changed)
				app.cacheBust = hires_time_now();
			break;
			
			case 'self_update':
				// an update was applied to OUR user, so do special update
				this.handleSelfUpdate(data);
			break;
			
			// more commands here
			
		} // switch cmd
	},
	
	forceVersionRefresh: function(data) {
		// server software was upgraded, need client refresh
		var msg = `The primary master server was upgraded to xyOps v${data.version}.  We now need to refresh your client to complete the upgrade.  Sorry for the inconvenience!`;
		
		Dialog.confirm( 'Refresh Needed', msg, ['refresh', 'Refresh'], function(result) {
			if (!result) return;
			app.clearError();
			window.location.reload();
		} ); // confirm
	},
	
	handleSelfUpdate: function(data) {
		// update to self (our user)
		app.user = data.user;
		
		// keep pristine copy of user, for applying roles
		app.origUser = deep_copy_object(app.user);
		app.applyUserRoles();
	},
	
	handleStatusUpdate: function(data) {
		// server status update, every 1s
		for (var key in data) {
			// e.g. epoch, activeJobs
			app[key] = data[key];
		}
		
		// keep track of hi-res time based off last known server time
		app.serverPerfStart = performance.now();
		
		// bust cache if jobs changed
		if (data.jobsChanged || data.internalJobsChanged) app.cacheBust = hires_time_now();
		
		// delete jobsChanged flag from app
		delete app.jobsChanged;
		delete app.internalJobsChanged;
		
		// prune jobs that user doesn't need to see
		if (data.activeJobs) app.pruneActiveJobs();
		
		// notify page if wanted
		if (app.page_manager && app.page_manager.current_page_id) {
			var id = app.page_manager.current_page_id;
			var page = app.page_manager.find(id);
			if (page && page.onStatusUpdate) page.onStatusUpdate(data);
		}
		
		// update header widgets
		app.updateHeaderClock();
		app.updateJobCounter();
	},
	
	handleDataUpdate: function(data) {
		// server data update
		Debug.trace('comm', "Received server data update for: " + hash_keys_to_array(data).join(', ') );
		for (var key in data) {
			app[key] = data[key];
		}
		app.presortTables();
		app.pruneData();
		
		// update user privs if roles changed
		if (data.roles) app.applyUserRoles();
		
		// notify page if wanted
		if (app.page_manager && app.page_manager.current_page_id) {
			var id = app.page_manager.current_page_id;
			var page = app.page_manager.find(id);
			if (page && page.onDataUpdate) {
				for (var key in data) {
					page.onDataUpdate( key, data[key] );
				}
			}
		}
		
		// header widgets
		app.updateAlertCounter();
	},
	
	handleSingleDataUpdate: function(data) {
		// update single item in app array (api_keys, users, events, etc.)
		var id_key = (data.list == 'users') ? 'username' : 'id';
		Debug.trace('comm', "Received single update for: " + data.list + ": " + data.item[id_key] );
		
		// setup crit to find a user (via username) or other (via id)
		var crit = {};
		crit[id_key] = data.item[id_key];
		
		// delete, replace or add new
		if (data.delete) {
			delete_object( app[data.list], crit );
		}
		else {
			var idx = find_object_idx( app[data.list], crit );
			if (idx > -1) app[data.list][idx] = data.item;
			else app[data.list].push( data.item );
		}
		
		app.presortTables();
		app.pruneData();
		
		// notify page if wanted
		if (app.page_manager && app.page_manager.current_page_id) {
			var id = app.page_manager.current_page_id;
			var page = app.page_manager.find(id);
			if (page && page.onDataUpdate) {
				page.onDataUpdate( data.list, app[data.list] );
			}
		}
	},
	
	handlePageUpdate: function(data) {
		// server data update for specific page
		if (data.loc != Nav.loc) return; // not for us (race condition)
		
		Debug.trace('comm', "Received page update for: " + data.loc + ": " + data.page_cmd );
		
		if (app.page_manager && app.page_manager.current_page_id) {
			var id = app.page_manager.current_page_id;
			var page = app.page_manager.find(id);
			if (page && page.onPageUpdate) page.onPageUpdate( data.page_cmd, data.page_data );
		}
	},
	
	handleActivity: function(item) {
		// something was logged to the activity log, show notification
		if (!app.isAdmin()) return; // sanity check
		Debug.trace('debug', "Activity log update: " + item.action + ": " + JSON.stringify(item));
		
		// bust cache for this
		app.cacheBust = hires_time_now();
		
		// determine activity type (icon, label)
		var item_type = null;
		for (var key in config.ui.activity_types) {
			var regexp = new RegExp(key);
			if (item.action.match(regexp)) {
				item_type = config.ui.activity_types[key];
				break;
			}
		}
		if (item_type) {
			// bring in `icon` and `label`
			for (var key in item_type) item[key] = item_type[key];
		}
		
		var type = 'info';
		
		// some activity types should be warnings or errors
		if (item.action.match(/^(error)/)) type = 'error';
		else if (item.action.match(/^(warning|server_remove|alert_new)/)) type = 'warning';
		
		// override toast icon if we have a better one
		if (item.icon) type += '/' + item.icon;
		
		// compose proper description
		var desc = item.description;
		var template = config.ui.activity_descriptions[item.action];
		if (template) desc = substitute(template, item, false);
		else if (!desc) desc = '(No description provided)';
		
		// don't show actions from ourselves, and also respect the user's settings
		if (!item.username) {
			// no username, so this is a non-user "system" event, such as a server connecting or disconnecting
			if (!app.user.admin_hide_notify_sys) app.showMessage(type, desc, 8);
		}
		else {
			// okay, item has a username, but only show if it's not us, and the user wants it
			// also, this may be a user action BY AN ADMIN, so check item.admin for the actual effective user
			var username = item.admin || item.username;
			if ((username != app.username) && !app.user.admin_hide_notify_user) app.showMessage(type, desc, 8);
		}
	},
	
	sendCommand: function(cmd, data) {
		// send user command to server
		Debug.trace('comm', "Sending command to server: " + cmd, data);
		
		if (this.socket && this.socket.auth) {
			this.socket.emit(cmd, data);
		}
		else this.commandQueue.push([ cmd, data ]);
	},
	
	tick: function() {
		// called once per second from app.tick()
		// see if we're receiving frequent status updates from server (might be dead socket)
		if (this.socket && this.socket.connected) {
			if (hires_time_now() - this.socket.lastPing >= this.statusTimeoutSec) {
				// 5 seconds and no ping = likely dead
				Debug.trace('comm', "No status update in last " + this.statusTimeoutSec + " seconds, assuming socket is dead");
				this.socket.close(); // should auto-reconnect
			}
		}
	}
	
};
