// Orchestra Server Management Layer
// Copyright (c) 2021 - 2024 Joseph Huckaby

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
		
		// detect groups from hostname if not specified
		if (!server.groups) server.groups = [];
		if (!server.groups.length) {
			this.autoAssignServerGroups(server);
			
			// set autoGroup flag so groups can be reassigned later if hostname matches change, groups resort, etc.
			server.autoGroup = true;
		}
		if (!server.groups.length) {
			var msg = "Server hostname is not a member of any groups: " + server.hostname;
			this.logTransaction('warning', msg, server);
			server.err = msg;
			return false; // failure
		}
		
		// validate groups
		var groups_valid = true;
		server.groups.forEach( function(id) {
			var group_def = Tools.findObject( group_defs, { id });
			if (!group_def) {
				var msg = "Unknown group: " + id + " (sent from server: " + server.hostname + ")";
				self.logTransaction('warning', msg, server);
				server.err = msg;
				groups_valid = false;
			}
		} );
		if (!groups_valid) return false; // failure
		
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
				
				// merge in existing data
				server = Tools.mergeHashes( data, server );
			}
			else {
				// first time for this server
				server.created = Tools.timeNow(true);
			}
			
			server.modified = Tools.timeNow(true);
			// server.state = 'active';
			
			// add server to hash
			self.servers[ server.id ] = server;
			
			// notify all users via ws
			self.doUserBroadcastAll('update', { servers: self.servers });
			
			// log activity
			self.logTransaction('server_add', "Server connected to the network: " + server.hostname + " (" + server.ip + ")", {
				server_id: server.id,
				hostname: server.hostname,
				ip: server.ip,
				groups: server.groups
			});
			
			// log activity to server-specific log
			self.logServerActivity( server.id, 'server_add', "Server connected to the network", {
				hostname: server.hostname,
				ip: server.ip,
				groups: server.groups
			});
			
			// sanity
			if (!server.info) server.info = {};
			if (!server.info.os) server.info.os = {};
			if (!server.info.memory) server.info.memory = {};
			if (!server.info.cpu) server.info.cpu = {};
			if (!server.info.virt) server.info.virt = {};
			
			// construct "combo" cpu brand / manufacturer / vendor
			server.info.cpu.combo = ((server.info.cpu.vendor || server.info.cpu.manufacturer || 'Unknown') + ' ' + (server.info.cpu.brand || '')).trim();
			
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
				server.info.virt.vendor || 'unknown'
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
	
	removeServer(server) {
		// remove server from active list
		var self = this;
		server.modified = Tools.timeNow(true);
		
		// remove server from RAM
		delete this.servers[ server.id ];
		delete this.quickMonCache[ server.id ];
		
		// notify all users via ws
		this.doUserBroadcastAll('update', { servers: this.servers });
		
		// log activity
		this.logTransaction('server_delete', "Server disconnected from the network: " + server.hostname + " (" + server.ip + ")", {
			hostname: server.hostname,
			ip: server.ip,
			groups: server.groups,
			server_id: server.id
		});
		
		// log activity to server-specific log
		this.logServerActivity( server.id, 'server_delete', "Server disconnected from the network", {
			hostname: server.hostname,
			ip: server.ip,
			groups: server.groups
		});
		
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
		
		// append to job meta for affected jobs
		this.findActiveJobs({ remote: true, server: server.id }).forEach( function(job) {
			self.appendMetaLog( job, "Lost connection to remote server: " + server.hostname + " (" + server.ip + ")" );
		} );
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
		
		return (server.groups.join(',') != old_groups.join(','));
	}
	
	updateServerGroups() {
		// update all server groups assignments, called after groups change
		var self = this;
		
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
			// start new background job
			this.updateServerJob = this.dbSearchUpdate({
				index: 'servers',
				query: 'autoGroup:true',
				title: "Updating server database for group change.",
				iterator: function(server, callback) {
					callback( null, self.autoAssignServerGroups(server) );
				},
				callback: function(err) {
					// all done, clean up
					if (!err) {
						delete self.updateServerJob;
						self.deleteState( 'db/updateServerJob' );
					}
				}
			});
			
			// set flag in state, so we can resume the job on server crash
			this.putState( 'db/updateServerJob', true );
		}
	}
	
	findActiveServers(criteria) {
		// find active servers matching criteria -- return array
		return Tools.findObjects( Object.values(this.servers), criteria );
	}
	
}; // class ServerManager

module.exports = ServerManager;
