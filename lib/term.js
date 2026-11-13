// xyOps Terminal Management Layer
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const Path = require('path');
const os = require("os");
const cp = require('child_process');
const async = require("async");
const Tools = require("pixl-tools");

class TermSystem {
	
	logTerm(level, msg, data) {
		// log debug msg with pseudo-component
		if (this.debugLevel(level)) {
			this.logger.print({ component: 'Terminal', category: 'debug', code: level, msg: msg, data: data });
		}
	}
	
	termMaint() {
		// close detached stale terminals
		var now = Tools.timeNow(true);
		var max_stale_sec = this.config.get('max_term_stale_sec') || 300;
		
		Object.values(this.terminals).forEach( term => {
			// skip connected and fresh terms
			if (term.connected) return;
			if (now - term.lastActivity < max_stale_sec) return;
			
			var server = this.servers[term.server];
			if (!server) return;
			
			var server_sock = this.sockets[ server.socket_id ];
			if (!server_sock) return;
			
			this.logTerm(5, "Stale detached terminal: Sending termClose request to server", term);
			
			server_sock.send('termClose', { id: term.id });
			term.closed = now;
		} );
	}
	
	// Client Socket API:
	
	getClientTerminalInfo(socket, data) {
		// get existing terminal, handle client error responses
		// user and server must match too
		var self = this;
		var term = this.terminals[data.id];
		
		var termError = function(msg) {
			self.logError('terminal', msg);
			socket.send( 'ext_msg', { id: 'int-term', data: { cmd: 'termWrite', data: "\r\n\r\nERROR: " + msg + "\r\n" } } );
			return {};
		};
		
		if (!data.id) return termError('Terminal ID not specified.');
		if (!term) return termError('Terminal not found: ' + data.id);
		if (term.username != socket.username) return termError('Terminal access denied.');
		
		// verify server is online too
		var server = this.servers[term.server];
		if (!server) return termError("Terminal server not found: " + term.server);
		
		var server_sock = this.sockets[ server.socket_id ];
		if (!server_sock) {
			// should never happen, mostly a sanity check
			return termError("Internal Error: Terminal server has no socket connection.");
		}
		
		return { term, server, server_sock };
	}
	
	termClientStart(socket, data) {
		// start new terminal, or reconnect existing
		var self = this;
		var now = Tools.timeNow(true);
		
		var termError = function(msg) {
			self.logError('terminal', msg);
			socket.send( 'ext_msg', { id: 'int-term', data: { cmd: 'termWrite', data: "\r\n\r\nERROR: " + msg + "\r\n" } } );
			return false;
		};
		
		if (!socket.admin) return termError('Terminal access denied.');
		
		if (data.id) {
			// rejoin existing terminal (replace old socket)
			var { term } = this.getClientTerminalInfo(socket, data);
			if (!term) return;
			if (term.server != data.server) return termError('Terminal server mismatch.');
			
			this.logTerm(5, "Reconnecting client socket to terminal", { id: term.id, old: term.client, new: socket.id });
			term.client = socket.id;
			term.connected = true;
			term.lastActivity = now;
		}
		else {
			// start new terminal
			var server = this.servers[data.server];
			if (!server) return termError("Terminal server not found: " + data.server);
			if (!server.info?.features?.terminal) return termError("Server does not support terminal access: " + (server.title || server.hostname));
			
			var server_sock = this.sockets[ server.socket_id ];
			if (!server_sock) {
				// should never happen, mostly a sanity check
				return termError("Internal Error: Server has no socket connection.");
			}
			
			var term = {
				id: Tools.generateShortID('t'),
				username: socket.username,
				server: data.server,
				client: socket.id,
				started: now,
				lastActivity: now,
				connected: true,
				pid: 0
			};
			this.terminals[term.id] = term;
			this.logTerm(5, "Starting new terminal", term);
			
			// tell client the new terminal id and pass server object
			socket.send( 'ext_msg', { id: 'int-term', data: { cmd: 'termStart', id: term.id, server } } );
			
			// tell server to open terminal on its end
			server_sock.send('termOpen', { id: term.id, opts: data.opts || {} });
			
			// Log new terminals only, using the original WebSocket upgrade request.
			var ips = this.web.getAllClientIPs(socket.request);
			var args = {
				request: socket.request,
				ip: this.web.getPublicIP(ips),
				ips: ips,
				user: { username: socket.username }
			};
			var params = {
				terminal: term,
				server: term.server,
				hostname: server.hostname,
				server_title: server.title || server.hostname,
				server_ip: server.ip,
				server_socket: server.socket_id,
				useragent: socket.request.headers['user-agent'] || '',
				keywords: [ term.id, term.server, socket.id, server.hostname, server.title || '' ]
			};
			this.logActivity('term_start', this.getClientInfo(args, params));
		}
	}
	
	termClientResize(socket, data) {
		// client terminal has resized
		var { term, server, server_sock } = this.getClientTerminalInfo(socket, data);
		if (!term) return;
		
		this.logTerm(6, "Terminal has resized", data);
		term.lastActivity = Tools.timeNow(true);
		
		server_sock.send('termResize', { id: term.id, cols: data.cols, rows: data.rows });
	}
	
	termClientWrite(socket, data) {
		// send user data to terminal
		var { term, server, server_sock } = this.getClientTerminalInfo(socket, data);
		if (!term) return;
		
		term.lastActivity = Tools.timeNow(true);
		server_sock.send('termWrite', { id: term.id, data: data.data });
	}
	
	termClientFiles(socket, data) {
		// client has files for server
		var { term, server, server_sock } = this.getClientTerminalInfo(socket, data);
		if (!term) return;
		
		this.logTerm(6, "Terminal files were uploaded", data);
		term.lastActivity = Tools.timeNow(true);
		
		server_sock.send('termFiles', { id: term.id, files: data.files, cwd: data.cwd, uid: data.uid, gid: data.gid });
	}
	
	termClientClose(id) {
		// client websocket has disconnected, mark last activity
		var term = this.terminals[id];
		if (!term) {
			this.logError('terminal', "Terminal not found to close: " + id);
			return;
		}
		
		term.connected = false;
		term.lastActivity = Tools.timeNow(true);
	}
	
	// Server Socket API:
	
	getServerTerminalInfo(socket, data) {
		// get existing terminal and client socket
		var self = this;
		var term = this.terminals[data.id];
		
		var termError = function(msg) {
			self.logError('terminal', msg);
			return {};
		};
		
		if (!data.id) return termError('Terminal ID not specified.');
		if (!term) return termError('Terminal not found: ' + data.id);
		if (term.server !== socket.server.id) return termError('Terminal Server ID mismatch: ' + term.server + ' != ' + socket.server.id);
		
		var client_id = term.client;
		var client_sock = this.sockets[client_id] || null;
		
		return { term, client_sock };
	}
	
	termServerOpen(socket, data) {
		// server terminal pty has opened
		var { term, client_sock } = this.getServerTerminalInfo(socket, data);
		if (!term) return;
		
		term.pid = data.pid;
		
		this.logTerm(5, "Server terminal has opened", data);
	}
	
	termServerWrite(socket, data) {
		// new data from server, send to client
		var { term, client_sock } = this.getServerTerminalInfo(socket, data);
		if (!term || !client_sock) return;
		
		client_sock.send( 'ext_msg', { id: 'int-term', data: { cmd: 'termWrite', data: data.data } } );
	}
	
	termServerStats(socket, data) {
		// new stats from server, send to client
		var { term, client_sock } = this.getServerTerminalInfo(socket, data);
		if (!term || !client_sock) return;
		
		client_sock.send( 'ext_msg', { id: 'int-term', data: { cmd: 'termStats', data: data.data } } );
	}
	
	termServerNotify(socket, data) {
		// display custom notification in terminal window
		var { term, client_sock } = this.getServerTerminalInfo(socket, data);
		if (!term || !client_sock) return;
		
		client_sock.send( 'notify', data );
	}
	
	termServerClose(socket, data) {
		// server has closed remotely, inform client and delete ref
		var { term, client_sock } = this.getServerTerminalInfo(socket, data);
		if (!term) return;
		
		this.logTerm(5, "Server terminal has closed", data);
		
		if (client_sock) {
			client_sock.send( 'ext_msg', { id: 'int-term', data: { cmd: 'termClose', id: term.id } } );
		}
		
		delete this.terminals[term.id];
	}
	
}; // class TermSystem

module.exports = TermSystem;
