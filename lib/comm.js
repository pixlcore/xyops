// xyOps Server Communication Layer
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const cp = require('child_process');
const assert = require("assert");
const async = require("async");
const WebSocket = require('ws');
const Tools = require("pixl-tools");

class Communication {
	
	sockets = null;
	
	logComm(level, msg, data) {
		// log debug msg with pseudo-component
		if (this.debugLevel(level)) {
			this.logger.set( 'component', 'Comm' );
			this.logger.print({ category: 'debug', code: level, msg: msg, data: data });
		}
	}
	
	startSocketListener() {
		// start listening for websocket connections
		var self = this;
		this.numSocketClients = 0;
		this.sockets = {};
		
		// start ws server for each pixl-server-web listener
		this.wsses = this.web.listeners.map( function(listener) {
			var wss = new WebSocket.Server({ server: listener });
			wss.on('connection', self.handleNewSocket.bind(self));
			wss.on('error', function(err) {
				self.logError('ws', "WebSocket Server Error: " + err);
			});
			return wss;
		} );
		
		// update socket stats every minute
		this.server.on('minute', function() {
			self.updateSocketStats();
		} );
	}
	
	handleNewSocket(web_socket, req) {
		// handle new incoming socket connection from ws
		var self = this;
		var ip = req.socket.remoteAddress || 'Unknown';
		
		// custom socket abstraction layer
		var socket = {
			ws: web_socket,
			request: req,
			auth: false,
			disconnected: false,
			id: Tools.generateShortID( 'ws' ),
			ip: ip,
			timeStart: Tools.timeNow(),
			metadata: {
				echo_time: Tools.timeNow(),
				last_ping: Tools.timeNow()
			},
			
			send: function(cmd, data) {
				self.logComm(10, "Sending socket message: " + cmd, data);
				if (this.ws.readyState === WebSocket.OPEN) {
					this.ws.send( JSON.stringify({ cmd: cmd, data: data }) );
				}
			},
			
			close: function() {
				this.ws.close( 1000, "Force" );
			}
		};
		
		this.numSocketClients++;
		this.sockets[ socket.id ] = socket;
		this.logComm(5, "New WebSocket client connected: " + socket.id + " (IP: " + ip + ")", { current: this.numSocketClients });
		
		web_socket.on('message', function(message) {
			// receive message from socket
			var json = null;
			try { json = JSON.parse(message); }
			catch(err) {
				self.logComm(3, "Socket error: Failed to parse JSON: " + err, message);
				return;
			}
			self.handleSocketMessage(socket, json);
		});
		
		web_socket.on('error', function(err) {
			// web socket error
			self.logError('socket', "Client socket error: " + socket.id + ": " + err);
		} );
		
		web_socket.on('close', function() {
			// client disconnected
			
			// TODO: close services here, i.e. ptty, scope and/or log watch
			
			if (!self.shut) {
				// if server socket, remove server from active list (will remain in DB)
				if (socket.auth && socket.server) self.removeServer(socket.server);
				
				// handle masterSocket disconnect here too
				if (socket.auth && socket.master) self.lostMaster(socket);
			}
			
			socket.disconnected = true;
			self.numSocketClients--;
			delete self.sockets[ socket.id ];
			self.logComm(5, "WebSocket client disconnected: " + socket.id + " (IP: " + ip + ")", { current: self.numSocketClients });
		} );
	}
	
	handleSocketMessage(socket, json) {
		// receive JSON message from socket
		var self = this;
		this.logComm(10, "Got message from socket: " + socket.id, json);
		
		var cmd = json.cmd;
		var data = json.data;
		
		switch(cmd) {
			case 'hello':
				// server is saying hello, and starting auth challenge
				// (possibly assign server a permanent ID here too)
				if (!this.master && this.masterHost) {
					// tell server to reconnect to new master
					socket.send( 'redirect', { host: this.masterHost } );
					return;
				}
				if (!this.master && !this.masterHost) {
					// tell server to retry later (not ready)
					socket.send( 'retry', {} );
					return;
				}
				
				if (!this.validateServer(data)) {
					socket.send( 'auth_failure', { description: data.err || "Unknown reason" } );
					return;
				}
				
				socket.server = data;
				socket.server.ip = socket.ip;
				socket.server.socket_id = socket.id;
				socket.server.nonce = Tools.generateUniqueID();
				
				if (!data.id) {
					// brand new server, assign it a unique ID
					socket.server.id = Tools.generateShortID('s');
					this.logComm(9, "Assigning new server a unique ID: " + socket.server.hostname + " (" + socket.ip + "): " + socket.server.id);
				}
				socket.send('hello', {
					nonce: socket.server.nonce,
					id: socket.server.id
				});
			break;
			
			case 'join':
				// server trying to join the network
				// should have auth token computed using nonce
				if (!socket.server || !socket.server.nonce) {
					// should never happen
					this.logComm(9, "Server trying to join without saying hello first: " + socket.id);
					return;
				}
				
				// server can auth using secret key + nonce, or server ID + secret key (prefab)
				var correct_token1 = Tools.digestHex( socket.server.nonce + this.config.get('secret_key'), 'sha256' );
				var correct_token2 = Tools.digestHex( socket.server.id + this.config.get('secret_key'), 'sha256' );
				
				if ((data.token != correct_token1) && (data.token != correct_token2)) {
					// nope
					this.logComm(9, "Server sent us a bad token (probably mismatched secret keys): " + socket.server.id, socket.server);
					this.logTransaction('warning', "Server authentication failure (mismatched secret keys): " + socket.server.hostname + " (" + socket.ip + ")");
					socket.send( 'auth_failure', { description: "Invalid authentication token." } );
					return;
				}
				
				delete socket.server.nonce; // no longer needed
				
				// join the network
				this.addServer(socket.server);
				
				// socket is auth'ed
				this.logComm(6, "Server socket has authenticated successfully: " + socket.id);
				socket.auth = true;
				socket.type = 'server';
				
				// make sure server has vital data
				socket.send('joined', {
					config: Tools.mergeHashes( { airgap: this.config.get('airgap') }, this.config.getPath('satellite.config') ),
					masterData: this.masterData,
					groups: socket.server.groups, // in case it was auto-assigned by hostname
					plugins: Tools.findObjects( this.plugins, { type: 'event' } ),
					commands: Tools.findObjects( this.plugins, { type: 'monitor' } ),
					numServers: Tools.numKeys(this.servers)
				});
			break;
			
			case 'authenticate':
				// user (human) is trying to authenticate
				this.logComm(9, "Incoming socket auth request");
				
				// handle case when we are not master, send back retry command
				if (!this.master) {
					// tell server to retry later (not ready or not master)
					socket.send( 'retry', { masterHost: this.masterHost || '' } );
					return;
				}
				
				// create fake args object for loadSession
				var args = { cookies: {}, request: { headers: {} }, params: {} };
				
				// pull session_id out of original ws request cookies
				if (socket.request.headers.cookie && socket.request.headers.cookie.match(/\bsession_id\=([0-9a-f]{64})\b/)) {
					args.cookies.session_id = RegExp.$1;
				}
				else {
					socket.send( 'auth_failure', { description: "No cookie found" } );
					return;
				}
				
				this.loadSession( args, function(err, session, user) {
					if (err) {
						// login error
						socket.send( 'auth_failure', { description: '' + err } );
						return;
					}
					
					// login successful!
					socket.auth = true;
					socket.type = 'user';
					socket.user = true;
					socket.username = user.username;
					socket.session_id = session.id;
					
					// we need to know which sockets are for admins
					var privs = self.getComputedPrivileges(user);
					socket.admin = !!(privs.admin);
					
					self.logComm(6, "User socket has authenticated successfully: " + socket.id, { username: user.username });
					socket.send( 'login', { version: self.server.__version } );
				} ); // loadSession
			break;
			
			case 'echoback':
				// response from echo
				if (data.id == socket.metadata.echo_id) {
					var now = Tools.timeNow();
					var ping_ms = Math.floor( (now - socket.metadata.echo_time) * 1000 );
					socket.metadata.ping_ms = ping_ms;
					socket.metadata.last_ping = now;
					this.logComm(10, "Socket Ping: " + ping_ms + " ms", {
						id: socket.id, ip: socket.ip, type: socket.type
					});
				}
				else socket.metadata.ping_ms = 0;
			break;
			
			case 'master':
				// a server wants to be our master -- do we let it?
				this.receiveNewMaster(socket, data);
			break;
			
			case 'masterData':
				// received updated masterData, save to disk
				if (socket.master) this.receiveMasterData(socket, data);
			break;
			
			case 'masterUpdate':
				// received generic data update, hold in memory (e.g. activeJobs)
				if (socket.master) this.receiveMasterUpdate(socket, data);
			break;
			
			case 'masterCommand':
				// received command from master
				if (socket.master) this.doMasterCommand(socket, data);
			break;
			
			case 'masterCommitStart':
				// received commit start from master (network transactions)
				if (socket.master) this.doMasterCommitStart(socket, data);
			break;
			
			case 'masterCommitEnd':
				// received commit end from master (network transactions)
				if (socket.master) this.doMasterCommitEnd(socket, data);
			break;
			
			case 'configOverrides':
				// received updated configOverrides from master
				if (socket.master) this.updateConfigOverrides(data);
			break;
			
			case 'jobs':
				// receive job updates from satellite
				if (socket.auth && (socket.type == 'server')) this.updateJobData(socket, data);
			break;
			
			case 'job_log':
				// append user-generated content to job log
				if (socket.auth && (socket.type == 'server')) {
					var job = this.activeJobs[ data.id ];
					if (job && (job.state != 'complete')) this.appendJobLog(job, data.text);
				}
			break;
			
			case 'job_meta':
				// append to job meta log
				if (socket.auth && (socket.type == 'server')) {
					var job = this.activeJobs[ data.id ];
					if (job) this.appendMetaLog(job, data.text, { server: socket.server.id });
				}
			break;
			
			case 'user_nav':
				// user (human) is navigating to different UI page
				if (socket.auth && (socket.type == 'user')) {
					if (!socket.loc || (socket.loc.loc != data.loc)) {
						this.logComm(9, "User " + socket.username + " is now on page: " + data.loc, { id: socket.id });
						socket.loc = { loc: data.loc, id: data.loc.replace(/\?.*$/, ''), query: Tools.parseQueryString(data.loc) };
					}
				}
			break;
			
			case 'search_job_files':
				// initiate job search inside files
				if (socket.auth && (socket.type == 'user')) {
					this.ws_search_job_files({ socket, params: data });
				}
			break;
			
			case 'monitor':
				// monitoring data from worker server
				if (socket.auth && (socket.type == 'server')) this.handleMonitoringData(socket, data);
			break;
			
			case 'quickmon':
				// quick monitors from satellite
				if (socket.auth && (socket.type == 'server')) this.handleQuickMonData(socket, data);
			break;
			
			// other commands here
			
		} // switch cmd
	}
	
	compLoc(sock_loc, crit_loc) {
		// compare location and query string using criteria object
		if (sock_loc.id != crit_loc.id) return false;
		
		var num_crit = Tools.numKeys(crit_loc.query);
		var num_matched = 0;
		
		for (var key in crit_loc.query) {
			if (sock_loc.query[key] == crit_loc.query[key]) num_matched++;
		}
		
		return (num_matched == num_crit);
	}
	
	doPageBroadcast(loc, cmd, data) {
		// send command only to auth'ed users currently nav'ed to specific page
		if (this.shut) return;
		if (typeof(loc) == 'string') loc = { loc: loc, id: loc.replace(/\?.*$/, ''), query: Tools.parseQueryString(loc) };
		
		var payload = {
			page_cmd: cmd,
			page_data: data
		};
		
		for (var id in this.sockets) {
			var socket = this.sockets[id];
			if (socket.auth && socket.user && socket.loc && this.compLoc(socket.loc, loc)) {
				payload.loc = socket.loc.loc;
				socket.send( 'page_update', payload );
			}
		}
	}
	
	doUserBroadcastAll(cmd, data) {
		// send command to all authenticated users
		if (this.shut) return;
		
		this.logComm(10, "Sending broadcast to all users: " + cmd, data);
		
		for (var id in this.sockets) {
			var socket = this.sockets[id];
			if (socket.auth && socket.user) socket.send( cmd, data );
		}
	}
	
	doAdminBroadcastAll(cmd, data) {
		// send command to all admin user
		if (this.shut) return;
		
		this.logComm(10, "Sending broadcast to admins: " + cmd, data);
		
		for (var id in this.sockets) {
			var socket = this.sockets[id];
			if (socket.auth && socket.user && socket.admin) socket.send( cmd, data );
		}
	}
	
	doUserBroadcast(username, cmd, data) {
		// send command to ONE authenticated user (maybe multiple sessions tho)
		if (this.shut) return;
		
		this.logComm(10, "Sending broadcast to user: " + username + ": " + cmd, data);
		
		for (var id in this.sockets) {
			var socket = this.sockets[id];
			if (socket.auth && socket.user && (socket.username == username)) socket.send( cmd, data );
		}
	}
	
	doServerBroadcastAll(cmd, data) {
		// send command to all authenticated servers
		if (this.shut) return;
		
		this.logComm(10, "Sending broadcast to all servers: " + cmd, data);
		
		for (var id in this.sockets) {
			var socket = this.sockets[id];
			if (socket.auth && socket.server) socket.send( cmd, data );
		}
	}
	
	doServerBroadcast(server_id, cmd, data) {
		// send command to specific server by id
		if (this.shut) return;
		
		this.logComm(10, "Sending broadcast to single server: " + server_id + ": " + cmd, data);
		
		for (var id in this.sockets) {
			var socket = this.sockets[id];
			if (socket.auth && socket.server && (socket.server.id == server_id)) {
				socket.send( cmd, data );
				break;
			}
		}
	}
	
	sendSocketPings() {
		// send a ping to every open socket every N seconds
		// also check for socket death
		if (this.shut) return;
		var now = Tools.timeNow();
		
		for (var id in this.sockets) {
			var socket = this.sockets[id];
			
			// check for ping death
			// (socket may die without telling us)
			if (socket.connected && socket.metadata.echo_id && (now - socket.metadata.last_ping >= this.config.get('ping_timeout_sec'))) {
				this.logComm(5, "Socket ping death: " + socket.id + " (" + socket.ip + ")");
				socket.ws.terminate();
			}
			else if (now - socket.metadata.echo_time >= this.config.get('ping_freq_sec')) {
				// ping and measure round-trip time (RTT)
				socket.metadata.echo_time = Tools.timeNow();
				socket.metadata.echo_id = Tools.generateShortID('e');
				socket.send('echo', { 
					id: socket.metadata.echo_id,
					last_ping_ms: socket.metadata.ping_ms || 0
				} );
			}
		} // foreach socket
	}
	
	updateSocketStats() {
		// update bytes in/out for all sockets
		// called every minute
		if (this.shut) return;
		var now = Tools.timeNow();
		
		for (var id in this.sockets) {
			var socket = this.sockets[id];
			if (socket.auth) {
				var cur_bytes_in = socket.request.connection.bytesRead || 0;
				var cur_bytes_out = socket.request.connection.bytesWritten || 0;
				
				var delta_bytes_in = cur_bytes_in - socket.metadata.last_bytes_in;
				var delta_bytes_out = cur_bytes_out - socket.metadata.last_bytes_out;
				
				// update global stats
				/*if (!this.stats.bytes_in) this.stats.bytes_in = 0;
				this.stats.bytes_in += delta_bytes_in;
				
				if (!this.stats.bytes_out) this.stats.bytes_out = 0;
				this.stats.bytes_out += delta_bytes_out;*/
				
				// update for next minute
				socket.metadata.last_bytes_in = cur_bytes_in;
				socket.metadata.last_bytes_out = cur_bytes_out;
			}
		}
	}
	
	stopSocketListener(callback) {
		// shut down websocket servers
		var self = this;
		
		async.each( this.wsses,
			function(wss, callback) {
				wss.close( callback );
			},
			callback
		); // async.each
	}
	
}; // class Communication

module.exports = Communication;
