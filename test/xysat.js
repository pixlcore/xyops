// mock xysat for unit tests

const fs = require('fs');
const Path = require('path');
const WebSocket = require('ws');
const Tools = require('pixl-tools');
const Config = require('pixl-config');

var getDump = function(key) {
	return JSON.parse( fs.readFileSync('test/fixtures/dumps/' + key + '.json', 'utf8') );
};

var satellite = {
	
	__name: 'Satellite',
	
	server: {
		hostname: 'satunit1'
	},
	
	config: new Config('test/fixtures/satellite.json'),
	
	activeJobs: {},
	
	startup() {
		this.logDebug(1, "Mock satellite starting up");
		this.logDebug(2, "Config", this.config.get() );
		
		this.socketInit();
		this.socketConnect();
	},
	
	tick() {
		this.socketTick();
		this.jobTick();
		this.runQuickMonitors();
	},
	
	// COMM:
	
	logComm(level, msg, data) {
		// log debug msg with pseudo-component
		if (this.debugLevel(level)) {
			this.logger.set( 'component', 'Satellite' );
			this.logger.print({ category: 'debug', code: level, msg: msg, data: data });
		}
	},
	
	socketInit() {
		// called on startup and config reload
		this.connectTimeoutSec = this.config.get('connect_timeout_sec') || 5;
		this.pingTimeoutSec = this.config.get('ping_timeout_sec') || 120;
		this.sockReconnDelaySec = this.config.get('socket_reconnect_delay_sec') || 1;
		this.sockReconnDelayMax = this.config.get('socket_reconnect_delay_max') || 30;
		this.sockReconnDelayCur = this.sockReconnDelaySec;
	},
	
	socketDisconnect() {
		// kill socket if connected, and prevent auto-reconnect
		if (this.socket) {
			this.socket.forceDisconnect = true;
			this.logComm(9, "Destroying previous socket");
			this.socket.close();
			this.socket = null;
		}
	},
	
	socketConnect() {
		// connect to server via websocket
		var self = this;
		var url = '';
		var host = this.config.get('host') || Tools.randArray(this.config.get('hosts'));
		var port = this.config.get('port');
		delete this.reconnectTimer;
		
		if (this.tempHost && !this.config.get('host')) {
			// one-time connect (i.e. redirect to master)
			host = this.tempHost;
			delete this.tempHost;
		}
		url = (this.config.get('secure') ? 'wss:' : 'ws:') + '//' + host + ':' + port + '/';
		
		// make sure old socket is disconnected
		this.socketDisconnect();
		
		this.logComm(5, "Connecting to WebSocket: " + url);
		
		// custom socket abstraction layer
		var socket = this.socket = {
			host: host,
			port: port,
			url: url,
			ws: new WebSocket( url, this.config.get('socket_opts') || {} ),
			
			connected: false,
			disconnected: false,
			
			connectTimer: setTimeout( function() {
				self.logError('comm', "Socket connect timeout (" + self.connectTimeoutSec + " sec)");
				socket.close();
			}, this.connectTimeoutSec * 1000 ),
			
			send: function(cmd, data) {
				self.logComm(10, "Sending socket message: " + cmd, data);
				
				if (this.connected) this.ws.send( JSON.stringify({ cmd: cmd, data: data }) );
				else self.logError('socket', "Socket not connected, message not sent", { cmd, data });
			},
			
			close: function() {
				try { 
					this.ws.close(); 
				} 
				catch(err) {
					this.ws.terminate();
				}
			}
		};
		
		socket.ws.onerror = function(err) {
			// socket error
			if (err.error) err = err.error; // ws weirdness
			self.logError('comm', "Socket Error: " + (err.message || err.code || err), { host: socket.host, url: socket.url } );
		};
		
		socket.ws.onopen = function (event) {
			// socket connected
			if (socket.connectTimer) {
				clearTimeout( socket.connectTimer );
				delete socket.connectTimer;
			}
			
			// reset reconn delay to base level
			self.sockReconnDelayCur = self.sockReconnDelaySec;
			
			socket.connected = true;
			socket.lastPing = Tools.timeNow();
			
			self.logComm(1, "WebSocket connected successfully: " + url);
			
			socket.send( 'hello', getDump('hello') );
		};
		
		socket.ws.onmessage = function (event) {
			// got message from server, parse JSON and handle
			self.logComm(10, "Got message from server: " + event.data);
			var json = null;
			try { 
				json = JSON.parse( event.data ); 
			}
			catch (err) {
				self.logError('comm', "Failed to parse JSON: " + err);
			}
			if (json) self.handleSocketMessage(json);
		};
		
		socket.ws.onclose = function (event) {
			// socket has closed
			var was_connected = socket.connected;
			
			if (was_connected) {
				// socket was connected, and now isn't
				self.logComm(3, "Socket has closed");
			}
			else {
				// socket was already disconnected, so increase retry delay (expon backoff)
				self.sockReconnDelayCur = Math.min( self.sockReconnDelayCur * 2, self.sockReconnDelayMax );
			}
			
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
			
			self.logComm(5, `Will attempt to reconnect in ${self.sockReconnDelayCur} seconds`);
			self.reconnectTimer = setTimeout( function() { self.socketConnect(); }, self.sockReconnDelayCur * 1000 );
			self.socket = null;
			
			if (was_connected) {
				// socket was connected, and now isn't, so log into all job metas
				self.appendMetaLogAllJobs("Lost connection to conductor");
			}
		};
	},
	
	handleSocketMessage(json) {
		// process message from master server
		var self = this;
		var socket = this.socket;
		var cmd = json.cmd;
		var data = json.data;
		
		switch (cmd) {
			case 'echo':
				// send back same data we got
				socket.lastPing = Tools.timeNow();
				socket.send('echoback', data);
			break;
			
			case 'auth_failure':
				// authentiation failure (should never happen)
				var msg = data.description;
				this.logError('comm', "Authentication failure: " + msg);
				
				// close socket until config reload
				this.logComm(3, "Closing socket until config reload or service restart");
				this.socketDisconnect();
			break;
			
			case 'hello':
				// The conductor has acknowledged our hello; use the configured server token.
				// if we were assigned an ID, save it permanently
				if (data.id && !this.config.get('server_id')) {
					this.logComm(3, "We have been assigned a unique server ID: " + data.id);
					this.updateConfig({
						server_id: data.id
					});
				}
				
				// Log only the first four characters for troubleshooting.
				this.logComm(9, "Authenticating via auth_token: " + this.config.get('auth_token').substring(0, 4) + '****');
				
				// Join using the same token authentication as a real satellite.
				socket.send('join', {
					token: this.config.get('auth_token')
				});
			break;
			
			case 'joined':
				// auth successful
				this.logComm(5, "WebSocket auth successful!");
				socket.auth = true;
				
				this.updateConfig( Tools.mergeHashes( data.config || {}, {
					hosts: data.masterData.masters
				} ) );
				
				// save current server count for quickmon timing adjust
				this.numServers = data.numServers || 0;
				
				// save stuff for minute monitoring
				this.groups = data.groups || [];
				this.plugins = data.plugins || [];
				this.commands = data.commands || [];
				
				if (Tools.numKeys(this.activeJobs)) {
					// if we have active jobs, this is a "reconnect" event
					this.updateAllJobs({
						reconnected: Tools.timeNow()
					});
					this.appendMetaLogAllJobs("Reconnected to master server: " + this.socket.host);
				}
				else {
					// fire off initial monitoring pass
					this.runQuickMonitors({});
					this.runMonitors({});
				}
			break;
			
			case 'masterData':
				// auth successful
				this.logComm(5, "Received new masterData", data);
				this.updateConfig({
					hosts: data.masters
				});
			break;
			
			case 'redirect':
				// reconnect to new master
				this.logComm(5, "Reconnecting to new master", data);
				this.tempHost = data.host;
				socket.close();
			break;
			
			case 'retry':
				// reconnect after an interval (master not ready yet)
				this.logComm(5, "Master is not ready: will reconnect");
				socket.close();
			break;
			
			case 'launch_job':
				// prep and launch job
				this.prepLaunchJob(data.job, data.details || {}, data.sec || {});
			break;
			
			case 'update':
				// arbitrary data update from master
				// e.g. groups, commands
				Tools.mergeHashInto( this, data );
			break;
			
			case 'updateConfig':
				// arbitrary config update (likely new auth token from key rotation)
				this.logComm(5, "Received new config update", { keys: Object.keys(data) });
				this.updateConfig(data);
			break;
			
			// more commands here
			
		} // switch cmd
	},
	
	updateConfig(updates) {
		// update config and save file
		for (var key in updates) {
			this.config.set(key, updates[key]);
		}
	},
	
	socketTick() {
		// called once per second from app.tick()
		// see if we're receiving frequent status updates from server (might be dead socket)
		if (this.socket && this.socket.connected) {
			if (Tools.timeNow() - this.socket.lastPing >= this.pingTimeoutSec) {
				// 5 seconds and no ping = likely dead
				this.logComm(2, "No ping in last " + this.pingTimeoutSec + " seconds, assuming socket is dead");
				this.socket.close(); // should auto-reconnect
			}
		}
	},
	
	// MONITORS:
	
	runQuickMonitors(opts = {}) {
		// run select monitors every second
		if (!this.socket || !this.socket.connected || !this.socket.auth) return;
		this.socket.send('quickmon', getDump('quickmon')); 
	},
	
	runMonitors(opts = {}) {
		var info = getDump('monitor');
		this.logDebug(9, "Running (fake) monitors");
		
		info.date = opts.date || Tools.timeNow(true);
		info.data.jobs = Tools.numKeys(this.activeJobs);
		
		if (opts.data) {
			Tools.mergeHashInto( info.data, opts.data );
		}
		
		if (this.config.get('monitoring_enabled') && this.socket && this.socket.connected && this.socket.auth) {
			this.socket.send('monitor', info);
		}
	},
	
	// JOBS:
	
	updateJob(job) {
		// send separate, single update to master for specific job
		// (do not send procs or conns, as those need to be sent on a tick schedule)
		if (!this.socket || !this.socket.connected || !this.socket.auth) return;
		
		var jobs = {};
		jobs[ job.id ] = Tools.copyHashRemoveKeys(job, { procs:1, conns:1 });
		
		this.socket.send('jobs', jobs);
		
		// clean up push system
		delete job.push;
	},
	
	prepLaunchJob(job, details, sec) {
		// fake job run
		var self = this;
		this.logDebug(9, "Starting job", { job, details, sec } );
		
		if (!job.params) job.params = {};
		if (!job.params.duration) job.params.duration = 1;
		job.params.duration = parseInt( job.params.duration );
		
		this.activeJobs[ job.id ] = job;
		
		job.pid = 1234;
		job.progress = 0.5;
		self.updateJob(job);
		
		setTimeout( function() {
			job.complete = true;
			job.progress = 1.0;
			job.data = { 
				random: Math.random(),
				num: 42,
				str: "foo",
				bool: true,
				obj: { key1: "value1" },
				arr: ["aa", "bb", "cc"],
				secrets: sec // echo secrets so unit test can verify
			};
			
			// Some API tests need a completed output file record without writing a
			// real file.  Mirror the metadata shape produced by a real satellite.
			if (job.params.output_file) {
				job.files = [{
					id: Tools.generateShortID('f'),
					date: Tools.timeNow(true),
					filename: job.params.output_file,
					path: 'files/jobs/' + job.id + '/unit-test/' + job.params.output_file,
					size: 128,
					job: job.id,
					server: job.server
				}];
			}
			
			job.code = 0;
			job.description = "Unit Test Job Complete";
			job.state = 'finishing';
			
			self.logDebug(9, "Finishing job: " + job.id);
			self.updateJob(job);
			
			setTimeout( function() {
				// finalize job
				job.state = 'complete';
				self.updateJob(job);
				delete self.activeJobs[ job.id ];
				self.logDebug(9, "Job complete: " + job.id);
			}, 250 );
		}, job.params.duration * 1000 );
	},
	
	appendMetaLogAllJobs() {
		// no-op
	},
	
	jobTick() {
		// called every second
		var self = this;
		if (!this.socket || !this.socket.connected || !this.socket.auth) return;
		
		if (!Tools.numKeys(this.activeJobs)) {
			return;
		}
		
		this.socket.send('jobs', this.activeJobs);
		
		// cleanup push system
		for (var job_id in this.activeJobs) {
			var job = this.activeJobs[job_id];
			delete job.push;
		}
	},
	
	debugLevel: function(level) {
		// check if we're logging at or above the requested level
		if (!this.config || !this.config.get) return true; // sanity
		var debug_level = this.config.get('debug_level') || this.logger.get('debugLevel');
		return (debug_level >= level);
	},
	
	logDebug: function(level, msg, data) {
		// proxy request to system logger with correct component
		if (!this.logger.print && this.logger.debug) return this.logger.debug(level, msg, data);
		
		if (this.debugLevel(level)) {
			this.logger.set( 'component', this.__name );
			this.logger.print({ 
				category: 'debug', 
				code: level, 
				msg: msg, 
				data: data 
			});
		}
	},
	
	logError: function(code, msg, data) {
		// proxy request to system logger with correct component
		this.logger.set( 'component', this.__name );
		this.logger.error( code, msg, data );
	},
	
	logTransaction: function(code, msg, data) {
		// proxy request to system logger with correct component
		this.logger.set( 'component', this.__name );
		this.logger.transaction( code, msg, data );
	},
	
	shutdown() {
		this.logDebug(1, "Shutting down");
		if (this.socket) this.socketDisconnect();
		if (this.reconnectTimer) clearTimeout( this.reconnectTimer );
	}
	
};

module.exports = satellite;
