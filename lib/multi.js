// xyOps Multi-Master Management Layer
// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the PixlCore Sustainable Use License.
// See the LICENSE.md file in this repository.

const EventEmitter = require("events").EventEmitter;
const fs = require('fs');
const Path = require('path');
const os = require("os");
const cp = require('child_process');
const async = require("async");
const WebSocket = require('ws');
const Tools = require("pixl-tools");
const mkdirp = Tools.mkdirp;
const rimraf = Tools.rimraf;

class Multi {
	
	master = false;
	hostID = "";
	peers = null;
	electionTimer = null;
	masterHost = "";
	masterData = null;
	masterSocket = null;
	masterListFile = "conf/masters.json";
	
	logMulti(level, msg, data) {
		// log debug msg with pseudo-component
		if (this.debugLevel(level)) {
			this.logger.set( 'component', 'Multi' );
			this.logger.print({ category: 'debug', code: level, msg: msg, data: data });
		}
	}
	
	multiSetup() {
		// initialize multi-master system
		var self = this;
		var multi = this.config.get('multi');
		
		// set multiSecure flag
		this.multiSecure = !!(multi.protocol == 'wss:');
		
		// allow config (or CLI args) to set hostname, default to OS hostname
		this.hostID = this.server.hostname;
		
		this.logMulti(2, "Initializing multi-server management system", {
			id: this.hostID
		});
		
		if (this.config.get('master')) {
			// CLI is asking us to contact a specific master
			var master_host = this.config.get('master');
			
			// CLI wants us to be our own master (debug mode)
			if (master_host === true) master_host = this.hostID;
			
			this.masterData = {
				masters: [ master_host ]
			};
			this.saveMasterData();
		}
		else if (this.config.get('masters') && (typeof(this.config.get('masters')) == 'string')) {
			// a specific fixed CSV set of masters was specified as ENV or config
			this.masterData = { masters: this.config.get('masters').split(/\,/) };
			this.saveMasterData();
		}
		else if (fs.existsSync(this.masterListFile)) {
			// list of masters exists on disk, load it
			this.masterData = JSON.parse( fs.readFileSync(this.masterListFile, 'utf8') );
		}
		else {
			// must be first time launch or single master setup
			this.logMulti(1, "No master data found, registering ourselves (first run)");
			
			this.masterData = { masters: [ this.hostID ] };
			this.saveMasterData();
			
			this.becomeMaster();
			return;
		}
		
		// are we even in the list?
		if (this.masterData.masters.includes( this.hostID )) {
			// single master?  if so, we can become master right away
			if (this.masterData.masters.length == 1) {
				this.becomeMaster();
				return;
			}
		}
		
		// try to contact a master server and register
		this.logMulti(3, "An election will be held in " + multi.master_timeout_sec + " seconds");
		this.electionTimer = setTimeout( this.electMaster.bind(this), multi.master_timeout_sec * 1000 );
	}
	
	api_master_register(args, callback) {
		// peer asking us who we are, check auth first
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			host: /^[\w\-\.]+$/, // no port allowed!
			auth: /^[0-9a-f]+$/
		}, callback)) return;
		
		var correct_token = Tools.digestHex( params.host + this.config.get('secret_key'), 'sha256' );
		if (params.auth != correct_token) {
			// nope
			var err_msg = "Peer authentication failure (mismatched secret keys): " + params.host;
			this.logTransaction('warning', err_msg);
			return this.doError('auth', err_msg, callback);
		}
		
		// if we are master, register this peer
		if (this.master && !this.masterData.masters.includes(params.host)) {
			this.addNewPeer( params.host );
		}
		else if (this.master && this.masterData.masters.includes(params.host)) {
			// if we are master, and peer is already added but in a retry loop, hurry it up
			// (it may be many seconds to wait it out, due to exponential backoff)
			var peer = Tools.findObject( this.peers, { id: params.host } );
			if (peer && peer.socket && peer.socket.reconnectTimer) {
				clearTimeout( peer.socket.reconnectTimer );
				delete peer.socket.reconnectTimer;
				peer.socket.connect();
			}
		}
		
		callback({
			code: 0,
			master: this.master
		});
	}
	
	api_master_command(args, callback) {
		// web request to restart, shutdown or upgrade a master server
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		if (!this.requireParams(params, {
			host: /^[\w\-\.]+$/ // no port allowed
		}, callback)) return;
		
		if (!params.commands || !Tools.isaArray(params.commands) || !params.commands.length) {
			return this.doError('master', "Invalid request: Missing commands array.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			// might be us!
			if (params.host == self.hostID) {
				if (params.commands[0] == "remove") {
					return self.doError('master', "You cannot remove the current master server from the cluster.", callback);
				}
				
				self.logMulti(3, "Running master command on self", params);
				self.doMasterCommand( null, params );
			}
			else if (params.commands[0] == "remove") {
				// special behavior for removal
				var peer = Tools.findObject( self.peers, { id: params.host } );
				if (!peer) {
					return self.doError('master', "Master server not found: " + params.host, callback);
				}
				if (peer.socket && peer.socket.connected) {
					self.logMulti(3, "Removing master server from cluster", params);
					peer.socket.send('masterCommand', { commands: ["stop"] });
				}
				self.removePeer( params.host );
				callback({ code: 0 });
				return;
			}
			else {
				// send control request to peer
				var peer = Tools.findObject( self.peers, { id: params.host } );
				if (!peer) {
					return self.doError('master', "Master server not found: " + params.host, callback);
				}
				if (!peer.socket || !peer.socket.connected) {
					return self.doError('master', "Master server is not online: " + params.host, callback);
				}
				self.logMulti(3, "Sending master command to peer", params);
				peer.socket.send('masterCommand', params);
			}
			
			callback({ code: 0 });
			self.logTransaction('peer_command', "Running master command '" + params.commands.join(' ') + "' on server '" + params.host + "'.", self.getClientInfo(args, params));
			
		}); // loadSession
	}
	
	doMasterCommand(socket, data) {
		// run server control command (e.g. restart)
		var self = this;
		this.logMulti(3, "Running local master command", data);
		
		// do not allow any shell metacharacters here
		data.commands = data.commands.map( function(cmd) {
			return cmd.replace(/[\&\|\;\>\<]/g, ''); // TODO: can we limit this to alphanum ONLY?  would be much more secure
		});
		
		// detect debug mode
		if (this.server.debug) {
			this.logMulti(9, "Debug mode detected, performing local shutdown");
			this.server.shutdown();
			return;
		}
		
		// issue command by shelling out to our control script in a detached child
		var child = null;
		try {
			child = cp.spawn( "bin/control.sh", data.commands, { 
				detached: true,
				stdio: ['ignore', 'ignore', 'ignore'] 
			} );
			child.on('error', function(err) {
				self.logError('master', "Failed to run local master command: " + err);
			});
			child.unref();
		}
		catch (err) {
			this.logError('master', "Failed to run local master command: " + err);
		}
	}
	
	electMaster() {
		// first, see which candidates are online
		var self = this;
		var online = [];
		var found_master = false;
		var multi = this.config.get('multi');
		var port = this.web.config.get( this.multiSecure ? 'https_port' : 'http_port' );
		
		this.logMulti(5, "Holding master election, contacting all candidates");
		
		async.each(
			this.masterData.masters.filter( function(host) {
				// only contact candidates other than ourself
				return host != self.hostID;
			}),
			function(host, callback) {
				self.logMulti(6, "Contacting server: " + host + ':' + port);
				
				var url = (self.multiSecure ? 'https://' : 'http://') + host + ':' + port + '/api/app/master_register';
				
				var data = {
					host: self.hostID,
					auth: Tools.digestHex( self.hostID + self.config.get('secret_key'), 'sha256' )
				};
				var opts = Tools.mergeHashes( multi.socket_opts, {
					timeout: 5000
				});
				
				self.request.json( url, data, opts, function(err, resp, json, perf) {
					if (err) {
						self.logMulti(4, "Failed to contact candidate: " + host + ": " + err);
					}
					else if (json.code) {
						self.logMulti(4, "Error from candidate: " + host + ": " + json.description);
					}
					else if (json.master) {
						found_master = true;
						self.logMulti(3, "Found master server: " + host + " (and we have registered)");
					}
					else {
						online.push(host);
						self.logMulti(4, "Candidate is online: " + host);
					}
					callback();
				});
			},
			function() {
				// all requests complete
				
				// if we found a master, stop now
				// (no need to continue election -- master will contact us)
				if (found_master) return;
				
				// if a master contacted us during the election, stop now
				if (self.masterSocket) return;
				
				// if we are shutting down, stop now
				if (self.shut) return;
				
				// add ourselves to the debate
				online.push( self.hostID );
				
				// determine our rank amongst the candidates
				online.sort();
				var winner = online[0];
				
				if (winner == self.hostID) {
					// we won!
					self.logMulti(3, "We are the highest ranking candidate");
					self.becomeMaster();
					
					// log transaction
					self.logTransaction('master_primary', "Conductor server is now primary: " + self.hostID, { host: self.hostID });
				}
				else {
					self.logMulti(3, "Candidate " + winner + " outranks us, so stepping aside.");
					
					// just in case candidate doesn't become master, or dies, schedule another election
					self.electionTimer = setTimeout( self.electMaster.bind(self), multi.master_timeout_sec * 1000 );
				}
			}
		); // async.each
	}
	
	becomeMaster() {
		// we are now king
		var self = this;
		
		this.logMulti(1, "We are becoming master", {
			id: this.hostID
		});
		
		if (this.masterSocket) {
			this.masterSocket.close();
			delete this.masterSocket;
		}
		
		if (this.electionTimer) {
			clearTimeout( this.electionTimer );
			this.electionTimer = null;
		}
		
		this.peers = [];
		this.masterData.masters.forEach( function(host) {
			// only add peers other than ourself
			if (host != self.hostID) self.peers.push({
				id: host,
				socket: null,
				auth: false,
				date: 0
			});
		});
		
		this.peers.forEach( function(peer) {
			self.setupPeer( peer );
		});
		
		// hash of active servers with an active connection
		this.servers = {};
		this.serverCache = {};
		
		// encrypted secret data (only decrypts on use)
		this.secretCache = {};
		
		// init maintenance (stats) system
		this.setupMaint();
		
		// archive logs daily at midnight
		this.server.on('day', function() {
			self.archiveLogs();
			
			// clear serverCache every midnight
			self.serverCache = {};
		} );
		
		// enable storage maintenance
		this.server.on( this.config.get('maintenance'), function() {
			self.runMaintenance();
		});
		
		// setup network transaction hooks, if enabled
		this.setupNetworkTransactions();
		
		// see if the previous shutdown left us any goodies
		this.importRecoveryFile();
		
		async.series(
			[
				function(callback) {
					// setup storage and create initial records if needed
					self.setupStorage(callback);
				},
				function(callback) {
					// for network transactions, enable storage transactions only when becoming master
					if (!self.storage.config.get('transactions') && self.storage.config.get('network_transactions')) {
						self.storage.config.set('transactions', true);
						self.storage.config.set('trans_auto_recover', true);
						
						self.storage.initTransactions(callback);
					}
					else callback();
				},
				function(callback) {
					async.eachSeries( self.config.getPath('ui.globalMemoryLists'),
						function(key, callback) {
							self.storage.listGet( 'global/' + key, 0, 0, function(err, items) {
								if (err) return callback(err);
								self[key] = items;
								callback();
							});
						},
						callback
					); // eachSeries
				},
				function(callback) {
					// load all encrypted secrets (do not decrypt until use)
					async.eachSeries( self.secrets,
						function(secret, callback) {
							self.storage.get( 'secrets/' + secret.id, function(err, record) {
								if (err) return callback(err);
								self.secretCache[ secret.id ] = record;
								callback();
							} );
						},
						callback
					); // eachSeries
				},
				function(callback) {
					self.storage.get( 'global/state', function(err, data) {
						if (err) return callback(err);
						self.state = data;
						callback();
					});
				},
				function(callback) {
					// make sure job log dir is created
					mkdirp( Path.join( self.config.get('log_dir'), 'jobs'), callback );
				},
				function(callback) {
					// make sure temp dir is created
					mkdirp( Path.join( self.config.get('temp_dir'), 'plugins'), callback );
				},
				function(callback) {
					// preload all sound filenames
					Tools.glob( 'htdocs/sounds/*.mp3', function(err, files) {
						self.sounds = (files || []).map( function(file) { return Path.basename(file); } ).sort();
						callback();
					} );
				},
				function(callback) {
					// setup monitoring which performs a db search
					self.setupMonitoring(callback);
				}
			],
			function(err) {
				if (err) {
					self.logError('startup', "Startup failed: " + err);
					self.server.shutdown();
					return;
				}
				
				// we are now fully master
				self.master = true;
				
				// if we suffered a crash and pixl-server-storage had to run recovery, log a loud warning here
				if (self.storage.recovery_log) {
					self.logTransaction('warning', "Unclean Shutdown: Database performed recovery operations (" + self.storage.recovery_count + " transactions rolled back). See " + Path.resolve(self.storage.recovery_log) + " for full details." );
				}
				
				// prep all plugins that run on master (action + scheduler types)
				self.prepPlugins();
				
				// startup complete, start scheduler
				self.setupScheduler();
				
				// resume db jobs if needed
				if (self.getState('db/updateServerJob')) self.updateServerGroups();
				
				// emit global event
				self.server.emit('master');
			}
		); // async.series
	}
	
	importRecoveryFile() {
		// import recovery data if present (activeJobs, etc.)
		// this is only called on startup, so it's okay to use "sync" I/O
		var self = this;
		var recovery_file = Path.join( this.config.get('log_dir'), "_recovery.json" );
		
		if (fs.existsSync(recovery_file)) try {
			var recovery_data = JSON.parse( fs.readFileSync(recovery_file, 'utf8') );
			Tools.mergeHashInto(this, recovery_data);
			fs.unlinkSync(recovery_file);
		} 
		catch(err) {
			this.logError('master', "Failed to load recovery file: " + recovery_file + ": " + err);
		}
		
		Object.values(this.activeJobs).forEach( function(job) {
			self.logMulti(5, "Resuming tracking active job: " + job.id, { event: job.event, state: job.state });
		} );
	}
	
	prepPlugins() {
		// create temp script files for all action and scheduler plugins
		// this is only called on startup and when plugins are updated, so it's okay to use "sync" I/O
		var self = this;
		var plugin_dir = Path.join( this.config.get('temp_dir'), 'plugins' );
		var filenames = {};
		
		// pre-scan dir, so we can compare (if any plugins were deleted)
		Tools.glob.sync( Path.join( plugin_dir, '*.bin' ) ).forEach( function(file) {
			filenames[ Path.basename(file) ] = true;
		} );
		
		this.plugins.forEach( function(plugin) {
			if (!plugin.type.match(/^(action|scheduler)$/)) return;
			if (plugin.script) {
				var script_file = Path.join( plugin_dir, plugin.id + '.bin' );
				fs.writeFileSync( script_file, plugin.script + "\n" );
				delete filenames[ Path.basename(script_file) ];
			}
		} );
		
		// delete any leftover files (deleted plugins)
		for (var filename in filenames) {
			var file = Path.join( plugin_dir, filename );
			try { fs.unlinkSync(file); } catch (e) {;}
		}
	}
	
	setupNetworkTransactions() {
		// persist transactions across peers in case of master failure
		var self = this;
		if (!this.storage.config.get('network_transactions')) return;
		
		this.storage.on('commitStart', function(trans) {
			// load transaction rollback log and broadcast to all peers
			fs.readFile( trans.log, 'utf8', function(err, contents) {
				if (err) {
					// this should never happen
					self.logError('storage', "Failed to load transaction log: " + trans.log + ": " + err);
					return;
				}
				
				// send rollback log to all existing peers
				self.peers.forEach( function(peer) {
					peer.socket.send('masterCommitStart', { log: trans.log, contents: contents });
				});
			} ); // fs.readFile
		}); // commitStart
		
		this.storage.on('commitEnd', function(trans) {
			// instruct all peers to delete the transaction log
			self.peers.forEach( function(peer) {
				peer.socket.send('masterCommitEnd', { log: trans.log });
			});
		});
	}
	
	doMasterCommitStart(socket, data) {
		// as peer, received commit start from master (network transactions)
		// save rollback log locally
		var self = this;
		var file = Path.join( this.transDir, "logs", Path.basename(data.log) );
		
		fs.writeFile( file, data.contents, function(err) {
			if (err) self.logError('fs', "Failed to write local commit rollback log: " + file + ": " + err);
			else self.logMulti(9, "(Network Commit Start) Wrote local commit rollback log: " + file);
		});
	}
	
	doMasterCommitEnd(socket, data) {
		// as peer, received commit end from master (network transactions)
		// delete rollback log
		var self = this;
		var file = Path.join( this.transDir, "logs", Path.basename(data.log) );
		
		fs.unlink(file, function(err) {
			if (err) self.logError('fs', "Failed to delete local commit rollback log: " + file + ": " + err);
			else self.logMulti(9, "(Network Commit End) Deleted local commit rollback log: " + file);
		});
	}
	
	addNewPeer(host) {
		// add new server as peer
		var self = this;
		this.logMulti(3, "Adding new peer server: " + host);
		
		this.masterData.masters.push( host );
		this.saveMasterData();
		
		// send updated masterData to all existing peers (new one will get it on connect)
		this.peers.forEach( function(peer) {
			peer.socket.send('masterData', self.masterData);
		});
		
		// send it to all regular servers too (i.e. xyops-satellite)
		this.doServerBroadcastAll('masterData', this.masterData);
		
		var peer = {
			id: host,
			socket: null,
			auth: false
		};
		
		this.peers.push( peer );
		this.setupPeer( peer );
	}
	
	removePeer(host) {
		// remove peer from network
		var self = this;
		var peer = Tools.findObject( this.peers, { id: host } );
		
		this.logMulti(3, "Removing peer server: " + host);
		
		this.masterData.masters.splice( this.masterData.masters.indexOf(host), 1 );
		this.saveMasterData();
		
		// delay socket disconnect while shutdown command is in transit
		// FUTURE: Figure out a cleaner way to do this without an ugly timer
		if (peer.socket) setTimeout( function() {
			peer.socket.disconnect(true);
		}, 1000 );
		
		Tools.deleteObject( this.peers, { id: host } );
		
		// send updated masterData to all existing peers (new one will get it on connect)
		this.peers.forEach( function(peer) {
			peer.socket.send('masterData', self.masterData);
		});
		
		// send it to all regular servers too (i.e. xyops-satellite)
		this.doServerBroadcastAll('masterData', this.masterData);
	}
	
	setupPeer(peer) {
		// connect peer socket
		var self = this;
		
		peer.socket = new PeerSocket( Tools.mergeHashes( this.config.get('multi'), {
			ping_timeout_sec: this.config.get('ping_timeout_sec'),
			logger: self.logger,
			host: peer.id,
			port: this.web.config.get( this.multiSecure ? 'https_port' : 'http_port' )
		}));
		
		peer.socket.on('connected', function() {
			// send hello, peers
			var token = Tools.digestHex( self.hostID + self.config.get('secret_key'), 'sha256' );
			
			peer.socket.send('master', {
				host: self.hostID,
				auth: token,
				masterData: self.masterData
			});
		});
		
		peer.socket.on('disconnected', function() {
			// log disconnection, but not if shutting down
			if (self.shut) return;
			self.logTransaction('peer_disconnect', "Backup server disconnected from the network: " + peer.id, { host: peer.id });
			self.broadcastPeerUpdate();
			peer.auth = false;
		});
		
		peer.socket.on('message', function(cmd, data) {
			// received message from peer
			switch (cmd) {
				case 'standby':
					peer.auth = true;
					for (var key in data) { peer[key] = data[key]; }
					
					self.logTransaction('peer_add', "Backup server added to the network: " + peer.id, { host: peer.id });
					self.broadcastPeerUpdate();
				break;
				
				case 'update':
					if (peer.auth) {
						for (var key in data) { peer[key] = data[key]; }
					}
				break;
			} // switch cmd
		});
	}
	
	getMasterPeerData() {
		// get JSON-friendly snapshot of all master/peer servers, for UI
		var data = {};
		
		// add ourselves as master
		data[ this.hostID ] = {
			id: this.hostID,
			online: true,
			master: true,
			date: this.server.started,
			version: this.server.__version,
			ping: 0,
			stats: this.getBasicServerStats()
		};
		
		// add all peers
		this.peers.forEach( function(peer) {
			data[ peer.id ] = {
				id: peer.id,
				date: peer.date,
				online: peer.socket ? peer.socket.connected : false,
				ping: peer.socket ? peer.socket.lastPingMs : 0,
				version: peer.version,
				stats: peer.socket ? peer.stats : {} // mem, load
			};
		});
		
		return data;
	}
	
	broadcastPeerUpdate() {
		// notify all users via ws
		this.doUserBroadcastAll('update', { masters: this.getMasterPeerData() });
	}
	
	receiveNewMaster(socket, data) {
		// a server wants to be our new master
		// data: { host, auth, masterData }
		var token = Tools.digestHex( data.host + this.config.get('secret_key'), 'sha256' );
		if (data.auth != token) {
			var err_msg = "Master authentication failure (mismatched secret keys): " + data.host;
			this.logError('multi', err_msg);
			this.logTransaction('warning', err_msg);
			return;
		}
		
		// check for duplicate masters here
		if (this.master) {
			var err_msg = "FATAL: Duplicate master servers in same cluster (" + data.host + " and " + this.hostID + "), shutting down immediately!";
			this.logMulti(1, err_msg);
			this.logError('multi', err_msg);
			this.logTransaction('warning', err_msg);
			this.server.shutdown();
			return;
		}
		
		this.logMulti(1, "We are now a backup server under master: " + data.host);
		this.masterHost = data.host;
		
		// save masterData
		this.masterData = data.masterData;
		this.saveMasterData();
		
		// tag socket as master
		socket.auth = true;
		socket.master = true;
		socket.type = 'master';
		this.masterSocket = socket;
		
		// cancel election, if one was pending
		if (this.electionTimer) {
			clearTimeout( this.electionTimer );
			this.electionTimer = null;
		}
		
		// send back standby command
		socket.send('standby', {
			version: this.server.__version,
			date: this.server.started,
			stats: this.getBasicServerStats()
		});
		
		// create storage transactions directories
		if (this.storage.config.get('network_transactions')) {
			// create temp trans dirs
			this.transDir = 'transactions';
			if (this.storage.config.get('trans_dir')) this.transDir = this.storage.config.get('trans_dir');
			else if (this.storage.engine.baseDir) this.transDir = Path.join( this.storage.engine.baseDir, "_transactions" );
			
			try {
				mkdirp.sync( Path.join(this.transDir, "logs") );
				mkdirp.sync( Path.join(this.transDir, "data") );
			}
			catch (err) {
				var msg = "Transaction directory could not be created: " + this.transDir + "/*: " + err;
				this.logError('storage', msg);
			}
			
			// delete all local storage rollback logs
			rimraf.sync( Path.join(this.transDir, "logs", "*") );
		}
	}
	
	getBasicServerStats() {
		// return basic mem/cpu info for standby servers
		return {
			started: this.server.started,
			mem: process.memoryUsage.rss(),
			load: (os.loadavg())[0]
		};
	}
	
	saveMasterData(callback) {
		// save masterData to local disk
		var self = this;
		
		fs.writeFile( this.masterListFile, JSON.stringify(this.masterData, null, "\t") + "\n", function(err) {
			if (err) self.logError('multi', "Failed to write master data: " + self.masterListFile + ": " + err);
			if (callback) callback();
		} );
	}
	
	receiveMasterData(socket, data) {
		// receive update to masterData from our master
		this.logMulti(9, "Received update to masterData", data);
		this.masterData = data;
		this.saveMasterData();
	}
	
	receiveMasterUpdate(socket, data) {
		// receive generic data update, hold in memory (i.e. activeJobs)
		for (var key in data) {
			this[key] = data[key];
		}
	}
	
	lostMaster(socket) {
		// we lost connection to the master, schedule an election
		var multi = this.config.get('multi');
		
		this.logMulti(2, "Lost connection to master server: " + this.masterHost);
		
		socket.auth = false;
		socket.master = false;
		this.masterSocket = null;
		this.masterHost = '';
		
		if (this.shut) return;
		
		this.logMulti(3, "An election will be held in " + multi.master_timeout_sec + " seconds");
		this.electionTimer = setTimeout( this.electMaster.bind(this), multi.master_timeout_sec * 1000 );
	}
	
	masterTick() {
		// called every second, maintain master peers
		var self = this;
		if (!this.master) return;
		
		this.peers.forEach( function(peer) {
			if (!peer.socket) return;
			
			// FUTURE: With thousands of queued jobs this gets crazy.  Need to do a "smart diff" instead.
			peer.socket.send('masterUpdate', { 
				activeJobs: self.activeJobs,
				activeAlerts: self.activeAlerts
			});
			peer.socket.tick();
		});
	}
	
	multiShutdown() {
		// shut down peer connections
		var self = this;
		
		if (this.electionTimer) {
			clearTimeout( this.electionTimer );
			delete this.electionTimer;
		}
		
		if (this.peers) {
			this.peers.forEach( function(peer) {
				if (peer.socket) peer.socket.disconnect(true);
			});
		}
		
		// save running jobs and other essentials for smooth recovery
		if (this.master) {
			var recovery_file = Path.join( this.config.get('log_dir'), "_recovery.json" );
			var recovery_data = {};
			['activeJobs', 'jobDetails', 'transferTokens', 'serverCache'].forEach( function(key) { recovery_data[key] = self[key]; } );
			fs.writeFileSync( recovery_file, JSON.stringify(recovery_data) + "\n" );
		}
	}
	
}; // class Multi

module.exports = Multi;

// Wrapper around WebSocket client for master peers

class PeerSocket extends EventEmitter {
	
	protocol = 'ws:';
	host = '';
	port = 0;
	ping_timeout_sec = 5;
	connect_timeout_sec = 3;
	
	logger = null;
	ws = null;
	connected = false;
	auth = false;
	lastPing = 0;
	lastPingMs = 0;
	reconnectDelay = 1000;
	
	constructor(args) {
		// class constructor
		// args: { protocol, host, logger }
		super();
		for (var key in args) { this[key] = args[key]; }
		if (this.host && this.port) this.connect();
	}
	
	connect() {
		// here we go...
		var self = this;
		var url = this.protocol + '//' + this.host + ':' + this.port + '/';
		
		if (this.forceDisconnect) {
			// final disconnect was forced, stop here
			return;
		}
		
		// make sure old socket is disconnected
		this.disconnect();
		
		this.logDebug(5, "Connecting to: " + url, { host: this.host, port: this.port });
		
		// custom socket abstraction layer
		this.connected = false;
		this.disconnected = true; // disconnected until we successfully connect
		
		this.connectTimer = setTimeout( function() {
			self.logError('comm', "Socket connect timeout (" + self.connect_timeout_sec + " sec)");
			self.disconnect();
		}, this.connect_timeout_sec * 1000 );
		
		this.ws = new WebSocket( url, this.socket_opts || {} );
		
		this.ws.on('error', function(err) {
			// socket error
			self.logError('comm', "Socket Error: " + (err.message || err));
		});
		
		this.ws.on('open', function(event) {
			// socket connected
			if (self.connectTimer) {
				clearTimeout( self.connectTimer );
				delete self.connectTimer;
			}
			
			self.connected = true;
			self.disconnected = false;
			self.lastPing = Tools.timeNow();
			self.lastPingMs = 0;
			
			self.logDebug(3, "Peer socket connected successfully");
			self.emit('connected');
			
			// reset reconnectDelay
			self.reconnectDelay = 1000;
		});
		
		this.ws.on('message', function(data) {
			// got message from server, parse JSON and handle
			self.logDebug(10, "Got message from peer: " + data);
			var json = null;
			try { json = JSON.parse( data ); }
			catch (err) {
				self.logError('comm', "Failed to parse JSON: " + err);
			}
			if (json) {
				if (json.cmd == 'echo') {
					self.lastPing = Tools.timeNow();
					self.lastPingMs = json.data.last_ping_ms || 0;
					self.send('echoback', json.data);
				}
				else {
					self.emit('message', json.cmd, json.data);
				}
			}
		});
		
		this.ws.on('close', function(event) {
			// socket has closed
			self.ws = null;
			self.lastPingMs = 0;
			
			if (self.connected) {
				// socket was actually connected (as opposed to a connect retry attempt)
				self.logDebug(3, "Socket closed");
				self.connected = false;
				self.disconnected = true;
				self.emit('disconnected');
			}
			
			if (self.connectTimer) {
				clearTimeout( self.connectTimer );
				delete self.connectTimer;
			}
			if (self.forceDisconnect) {
				// deliberate disconnect, stop here
				return;
			}
			
			self.reconnectTimer = setTimeout( function() { 
				delete self.reconnectTimer;
				self.connect(); 
			}, self.reconnectDelay );
			
			// exponential backoff
			if (self.reconnectDelay < 32000) self.reconnectDelay *= 2;
		});
	}
	
	send(cmd, data) {
		// send command and data
		if (!this.connected) return;
		this.logDebug(10, "Sending socket message: " + cmd, data);
		this.ws.send( JSON.stringify({ cmd: cmd, data: data }) );
	}
	
	tick() {
		// check lastPing
		if (this.connected && (Tools.timeNow() - this.lastPing >= this.ping_timeout_sec)) {
			// forcibly terminate connection as per:
			// https://github.com/websockets/ws#how-to-detect-and-close-broken-connections
			this.logError('comm', "Socket Ping Timeout (" + this.ping_timeout_sec + " sec)", { host: this.host, port: this.port });
			this.ws.terminate();
			delete this.ws;
		}
	}
	
	disconnect(force) {
		// close socket, maybe forever
		if (force) this.forceDisconnect = true;
		
		if (force && this.reconnectTimer) {
			clearTimeout( this.reconnectTimer );
			delete this.reconnectTimer;
		}
		
		if (this.ws) {
			this.logDebug(5, "Closing socket", { host: this.host, port: this.port });
			this.ws.close();
			delete this.ws;
		}
	}
	
	logError(code, msg, data) {
		// proxy to system logger with correct component
		if (this.logger) {
			this.logger.set( 'component', 'PeerSocket' );
			this.logger.error( code, msg, data );
		}
	}
	
	logDebug(level, msg, data) {
		// proxy to system logger with correct component
		if (this.logger) {
			this.logger.set( 'component', 'PeerSocket' );
			this.logger.debug( level, msg, data );
		}
	}
	
}; // class PeerSocket
