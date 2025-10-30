// xyOps Server Management Layer
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const cp = require('child_process');
const assert = require("assert");
const async = require("async");
const Tools = require("pixl-tools");

class ServerManager {
	
	servers = null;
	
	validateServer(server) {
		// check server hostname and groups
		var self = this;
		var group_defs = this.groups;
		
		// make sure server ID is unique
		if (server.id && this.servers[server.id]) {
			var msg = "Server with duplicate ID attempting to connect to the network: " + server.id + " (" + server.hostname + ")";
			this.logTransaction('warning', msg, server);
			server.err = msg;
			return false; // failure
		}
		
		// normalize hostname for storage (and sanity)
		server.hostname = this.storage.normalizeKey( server.hostname ).replace(/\//g, '');
		
		// warn if dupe hostname -- not an error
		var dupes = this.findActiveServers({ hostname: server.hostname });
		if (dupes.length) {
			this.logTransaction('warning', "Server connecting with duplicate hostname: " + server.hostname, server);
		}
		
		return true;
	}
	
	addServer(server) {
		// add server to network, or update for reconnect
		var self = this;
		
		this.unbase.get( "servers", server.id, function(err, data) {
			if (err && (err.code != 'NoSuchKey')) {
				// Note: This should never happen, but if it does, the server will be recreated
				self.logError('indexer', "Failed to get server: " + server.id + ": " + err);
			}
			if (data) {
				// check for IP / hostname change here, log transaction if diff
				if (data.hostname && server.hostname && (data.hostname != server.hostname)) {
					self.logTransaction('warning', "Server hostname has changed: " + server.hostname + " to: " + data.hostname, server);
				}
				if (data.ip && server.ip && (data.ip != server.ip)) {
					self.logTransaction('warning', "Server IP address has changed: " + server.ip + " to: " + data.ip, server);
				}
				
				// merge in existing data, preserve some keys
				Tools.mergeHashInto(server, Tools.copyHashRemoveKeys(data, { info:1, hostname:1, ip:1, socket_id:1 }));
			}
			else {
				// first time for this server
				server.created = Tools.timeNow(true);
				server.enabled = true;
				
				// initial data may have prepopulated groups (prefab sat)
				if (server.groups && server.groups.length) {
					server.autoGroup = false;
				}
				else {
					server.autoGroup = true;
					server.groups = [];
				}
			}
			
			server.modified = Tools.timeNow(true);
			// server.state = 'active';
			
			// auto-assign groups if not manually set
			if (server.autoGroup) {
				self.autoAssignServerGroups(server);
			}
			
			// add server to hash
			self.servers[ server.id ] = server;
			
			// sanity
			if (!server.info) server.info = {};
			if (!server.info.os) server.info.os = {};
			if (!server.info.memory) server.info.memory = {};
			if (!server.info.cpu) server.info.cpu = {};
			if (!server.info.virt) server.info.virt = {};
			
			// construct "combo" cpu brand / manufacturer / vendor
			server.info.cpu.combo = self.getServerCPUCombo( server.info.cpu );
			
			// remove server from cache if reconnect
			delete self.serverCache[ server.id ];
			
			// notify all users via ws
			self.doUserBroadcastAll('update', { servers: self.servers, serverCache: self.serverCache });
			
			// log activity
			self.logTransaction('server_add', "Server connected to the network: " + server.hostname + " (" + server.ip + ")", {
				server_id: server.id,
				hostname: server.hostname,
				ip: server.ip,
				groups: server.groups,
				keywords: [ server.id ]
			});
			
			// construct keywords for DB index
			server.keywords = [
				server.hostname,
				server.ip.replace(/\./g, ','), // to index each ipv4 octet separately
				server.groups.join(','),
				server.info.os.platform || 'unknown',
				server.info.os.distro || 'unknown',
				server.info.os.release || 'unknown',
				server.info.os.arch || 'unknown',
				server.info.cpu.manufacturer || 'unknown',
				server.info.cpu.brand || 'unknown',
				server.info.virt.vendor || 'unknown',
				server.info.virt.type || 'unknown',
				server.info.virt.location || 'unknown',
				server.title || 'unknown'
			].join(',');
			
			// add/update in unbase
			self.unbase.insert( "servers", server.id, server, function(err) {
				if (err) {
					self.logError('indexer', "Failed to index server: " + server.id + ": " + err);
					return;
				}
			}); // unbase.insert
		}); // unbase.get
	}
	
	updateServer(server_id, updates, callback) {
		// update server details (from user or API)
		var self = this;
		this.logDebug(6, "Updating server: " + server_id, updates);
		
		updates.modified = Tools.timeNow(true);
		
		if (this.servers[server_id]) {
			// active server, update copy in memory
			var server = this.servers[server_id];
			var old_groups = server.groups;
			Tools.mergeHashInto(server, updates);
			
			if (updates.autoGroup) {
				server.groups = old_groups; // revert this just so we can track the change, if it changes
				this.autoAssignServerGroups(server);
				
				// make sure updates has the auto-assigned groups too, for the db update below
				updates.groups = server.groups;
			}
			
			// notify all users about the server change
			this.doUserBroadcastAll('update', { servers: this.servers });
			
			// notify server itself in case groups changed
			this.doServerBroadcast( server_id, 'update', { groups: server.groups } );
		}
		
		// update DB too
		this.unbase.update( "servers", server_id, updates, function(err) {
			if (err) {
				self.logError('indexer', "Failed to index server: " + server_id + ": " + err);
				if (callback) callback(err);
				return;
			}
			if (callback) callback();
		} );
	}
	
	removeServer(server) {
		// remove server from active list
		var self = this;
		server.modified = Tools.timeNow(true);
		
		// remove server from RAM
		delete this.servers[ server.id ];
		delete this.quickMonCache[ server.id ];
		
		// log activity
		this.logTransaction('server_remove', "Server disconnected from the network: " + server.hostname + " (" + server.ip + ")", {
			hostname: server.hostname,
			ip: server.ip,
			groups: server.groups,
			server_id: server.id,
			keywords: [ server.id ]
		});
		
		// if server has pending delete action, do that now
		if (server.delete) return this.deleteServer(server);
		
		// update DB so we have the date of the disconnect
		this.unbase.update( "servers", server.id, { modified: server.modified }, function(err) {
			if (err) {
				self.logError('indexer', "Failed to index server: " + server.id + ": " + err);
				return;
			}
		} );
		
		// keep a copy of recent 10 removed servers in RAM, for client UX
		this.serverCache[ server.id ] = server;
		
		if (Tools.numKeys(this.serverCache) > 10) {
			// expunge oldest server
			var oldest = server;
			for (var key in this.serverCache) {
				if (this.serverCache[key].modified < oldest.modified) oldest = this.serverCache[key];
			}
			delete this.serverCache[ oldest.id ];
		}
		
		// notify all users via ws
		this.doUserBroadcastAll('update', { servers: this.servers, serverCache: this.serverCache });
		
		// append to job meta for affected jobs
		this.findActiveJobs({ remote: true, server: server.id }).forEach( function(job) {
			self.appendMetaLog( job, "Lost connection to remote server: " + server.hostname + " (" + server.ip + ")" );
		} );
	}
	
	deleteServer(server) {
		// delete server from database, and also monitoring data as background internal job
		var self = this;
		
		// notify all users via ws
		this.doUserBroadcastAll('update', { servers: this.servers });
		
		// append to job meta for affected jobs
		this.findActiveJobs({ remote: true, server: server.id }).forEach( function(job) {
			self.appendMetaLog( job, "Lost connection to remote server: " + server.hostname + " (" + server.ip + ")" );
		} );
		
		// spawn background job for server and monitoring data
		this.dbSearchDelete({
			index: 'servers',
			query: '#id:' + server.id,
			title: "Custom server deletion",
			username: server.delete.username
		});
		
		// and another job for server snapshots
		this.dbSearchDelete({
			index: 'snapshots',
			query: 'server:' + server.id,
			title: "Custom snapshot deletion",
			username: server.delete.username
		});
	}
	
	autoAssignServerGroups(server) {
		// automatically assign groups based on hostname match
		var group_defs = this.groups;
		var old_groups = server.groups || [];
		server.groups = [];
		
		for (var idx = 0, len = group_defs.length; idx < len; idx++) {
			var group_def = group_defs[idx];
			if (server.hostname.match(group_def.hostname_match)) {
				server.groups.push( group_def.id );
			}
		}
		
		var result = (server.groups.join(',') != old_groups.join(','));
		if (result) {
			this.logDebug(9, "Auto-assigned groups for server have changed: " + server.id, { 
				id: server.id, 
				hostname: server.hostname, 
				'old': old_groups,
				'new': server.groups 
			} );
		}
		
		return result;
	}
	
	updateServerGroups(opts) {
		// update all server groups assignments, called after groups change
		var self = this;
		if (!opts) opts = {};
		
		for (var server_id in this.servers) {
			var server = this.servers[server_id];
			if (server.autoGroup) {
				if (this.autoAssignServerGroups(server)) {
					// server groups have changed -- notify server about this
					this.doServerBroadcast( server_id, 'update', { groups: server.groups } );
				} // changed
			} // autoGroup
		} // foreach server
		
		// background update affected servers in db
		if (this.updateServerJob && !this.updateServerJob.done) {
			// request a restart of job in progress
			this.updateServerJob.restart = true;
		}
		else {
			// set flag in state, so we can resume the job on server crash
			this.putState( 'db/updateServerJob', true );
			
			// start new background job
			this.updateServerJob = this.dbSearchUpdate({
				index: 'servers',
				query: 'autoGroup:true',
				title: "Updating server database for group change.",
				quiet: true,
				
				iterator: function(server, callback) {
					callback( null, self.autoAssignServerGroups(server) );
				},
				
				callback: function(err) {
					// all done, clean up
					if (!err) {
						delete self.updateServerJob;
						self.deleteState( 'db/updateServerJob' );
					}
				},
				...opts
			});
		}
	}
	
	findActiveServers(criteria) {
		// find active servers matching criteria -- return array
		return Tools.findObjects( Object.values(this.servers), criteria );
	}
	
	getServerCPUCombo(cpu) {
		// construct "combo" cpu brand / manufacturer / vendor
		var manu = cpu.manufacturer;
		if (manu == '-') manu = cpu.vendor;
		if (manu == 'unknown') manu = cpu.vendor;
		return ((manu || cpu.vendor || 'Unknown') + ' ' + (cpu.brand || '')).trim();
	}
	
}; // class ServerManager

module.exports = ServerManager;
