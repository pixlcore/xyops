// xyOps Extension Management Layer
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const Path = require('path');
const os = require("os");
const cp = require('child_process');
const async = require("async");
const Tools = require("pixl-tools");

class ExtSystem {
	
	logExt(level, msg, data) {
		// log debug msg with pseudo-component
		if (this.debugLevel(level)) {
			this.logger.print({ component: 'Extension', category: 'debug', code: level, msg: msg, data: data });
		}
	}
	
	loadAllExtensions() {
		// load all extensions into memory
		// called from becomeMaster
		var self = this;
		var ext_base_dir = Path.join( 'data', 'extensions' );
		var ext_pkg_file = Path.join( ext_base_dir, 'package.json' );
		var ext_pkg = { dependencies: {} };
		
		if (fs.existsSync(ext_pkg_file)) {
			try { ext_pkg = Tools.sjson.parse( fs.readFileSync(ext_pkg_file, 'utf8') ); }
			catch (e) {;}
		}
		
		this.extMeta = ext_pkg;
		this.extensions = [];
		
		if (!ext_pkg.dependencies) ext_pkg.dependencies = {};
		if (!Tools.firstKey(ext_pkg.dependencies)) return;
		
		this.logExt(3, "Loading all extensions");
		
		Object.keys(ext_pkg.dependencies).forEach( pkg_id => {
			var ext_id = pkg_id.replace(/^\@/, '').replace(/\W+/g, '-').toLowerCase();
			var pkg_ver = ext_pkg.dependencies[pkg_id];
			var ext_obj = null;
			var ext_pkg_json = null;
			
			var overlay = {
				xy: this,
				server: this.server,
				config: this.config.getPath('extensions.' + ext_id) || {},
				logger: this.logger,
				
				logDebug: function(level, msg, data) {
					if (this.logger.get('debugLevel') < level) return;
					this.logger.print({ component: 'Extension', category: ext_id, code: level, msg: msg, data: data });
				}
			};
			
			this.logExt(3, "Loading extension: " + pkg_id + '@' + pkg_ver, { ext_id });
			
			try { 
				ext_obj = require( Path.join(process.cwd(), ext_base_dir, 'node_modules', pkg_id) ); 
				Tools.mergeHashInto( ext_obj, overlay );
				if (ext_obj.init) ext_obj.init();
			}
			catch (err) {
				var err_msg = "Failed to load extension: " + pkg_id + ": " + err;
				this.logError('multi', err_msg);
				this.logTransaction('warning', err_msg);
				return;
			}
			
			// also load extensions's package.json file, for metadata
			try { 
				ext_pkg_json = require( Path.join(process.cwd(), ext_base_dir, 'node_modules', pkg_id, 'package.json') ); 
			}
			catch (err) {
				var err_msg = "Failed to load extension package.json: " + pkg_id + ": " + err;
				this.logError('multi', err_msg);
				this.logTransaction('warning', err_msg);
				return;
			}
			
			this.extensions.push({
				id: ext_id,
				pkg: pkg_id,
				ver: pkg_ver,
				obj: ext_obj,
				json: ext_pkg_json,
				
				marketplace: {
					id: pkg_id.replace(/^\@/, ''),
					version: 'v' + pkg_ver
				}
			});
		} ); // foreach dep
		
		this.config.on('reload', function() {
			// update all ext config refs
			self.extensions.forEach( ext => {
				ext.obj.config = self.config.getPath('extensions.' + ext.id) || {};
				if (ext.obj.handleConfigReload) ext.obj.handleConfigReload(ext.obj.config);
			} );
		} );
	}
	
	masterSyncExtensions() {
		// sync current set of installed (but not necessarily loaded) extensions to all peers
		this.peers.forEach( peer => {
			if (!peer.socket || !peer.auth) return;
			peer.socket.send('extUpdate', this.extMeta);
		});
	}
	
	updateExtensions(extMeta) {
		// compare incoming extension package.json (extMeta) with our current local version
		// Note: this does not RELOAD extensions -- it only updates them via NPM
		var self = this;
		var ext_config = this.config.get('extensions') || {};
		var ext_base_dir = Path.join( 'data', 'extensions' );
		var ext_pkg_file = Path.join( ext_base_dir, 'package.json' );
		var ext_pkg = { dependencies: {} };
		
		// make sure we have npm on the conductor server
		var npm_bin = Tools.findBinSync('npm');
		if (!npm_bin) {
			this.logError('ext', "Extension system failure: NPM executable not found");
			return;
		}
		
		if (!fs.existsSync(ext_base_dir)) {
			try { Tools.mkdirp.sync(ext_base_dir); }
			catch (err) { 
				this.logError('ext', "Failed to create extension base directory: " + err);
				return; 
			}
		}
		
		if (fs.existsSync(ext_pkg_file)) {
			try { ext_pkg = Tools.sjson.parse( fs.readFileSync(ext_pkg_file, 'utf8') ); }
			catch (e) {;}
		}
		
		var a = Tools.stableStringify(extMeta.dependencies || {});
		var b = Tools.stableStringify(ext_pkg.dependencies || {});
		if (a === b) {
			this.logExt(5, "Extensions match exactly, skipping install");
			return;
		}
		
		try { fs.writeFileSync( ext_pkg_file, JSON.stringify(extMeta, null, "\t") + "\n" ); }
		catch (err) {
			this.logError('ext', "Failed to write extension data: " + err);
			return;
		}
		
		this.logExt(4, "Applying extension updates from primary conductor", { 
			old: ext_pkg.dependencies || {}, 
			new: extMeta.dependencies || {} 
		} );
		
		var child_opts = {
			cwd: ext_base_dir,
			env: Object.assign( {}, this.cleanEnv() ),
			timeout: (ext_config.timeout || 300) * 1000
		};
		
		cp.exec( npm_bin + ' install --no-update-notifier --no-fund', child_opts, function(err, stdout, stderr) {
			if (err) {
				self.logError('ext', "Extension updates failed: " + err, { stdout, stderr });
				
				// rollback package.json file
				try { fs.writeFileSync( ext_pkg_file, JSON.stringify(ext_pkg, null, "\t") + "\n" ); }
				catch (err) {
					self.logError('ext', "Failed to rollback extension data: " + err);
				}
				
				// notify primary conductor
				if (self.masterSocket) {
					var description = "Extension updates failed: " + err;
					var details = '';
					details += "\n**Command Output**\n";
					details += "\n```\n" + stdout + stderr + "\n```\n";
					self.masterSocket.send('critical', { description, details });
				}
			}
			else {
				self.logExt(5, "Extension updates complete", { stdout, stderr });
			}
		}); // cp.exec
	}
	
	getClientExtensions() {
		// get JS payload to load extensions client-side
		var payload = `app.extensions = [`;
		
		(this.extensions || []).forEach( function(ext, idx) {
			if (idx) payload += ',';
			payload += `{id:${JSON.stringify(ext.id)},marketplace:${JSON.stringify(ext.marketplace)}`;
			payload += `,pkg:${JSON.stringify(ext.json)}`;
			
			if (ext.obj.client) {
				// serialize client data and functions
				payload += `,obj:{`;
				Object.keys(ext.obj.client).forEach( function(key, idy) {
					if (idy) payload += ',';
					var value = ext.obj.client[key];
					if (typeof(value) == 'function') payload += `${key}:${value.toString()}`;
					else payload += `${key}:${JSON.stringify(value)}`;
				});
				payload += `}`;
			}
			
			payload += `}`;
		} );
		
		payload += `];\n`;
		return payload;
	}
	
	getExtensionChecksum() {
		// compute stable checksum of all loaded extensions and versions
		var meta = {};
		(this.extensions || []).forEach( function(ext) {
			meta[ ext.id ] = ext.ver;
		});
		return Tools.digestHex( Tools.stableStringify(meta) );
	}
	
	sendExtMessage(socket, data) {
		// send custom websocket message to extension (stateless)
		// data: { id, data }
		var ext_id = data.id;
		var ext = Tools.findObject( this.extensions, { id: ext_id } );
		if (!ext) {
			this.logError('ext', "Unknown extension: " + ext_id);
			return;
		}
		if (!ext.obj.handleComm) {
			this.logError('ext', "Extension does not accept WebSocket requests: " + ext_id);
			return;
		}
		
		this.logExt(9, "Sending message to extension: " + ext_id);
		ext.obj.handleComm(socket, data.data);
	}
	
	extensionShutdown() {
		// shutdown all extensions
		(this.extensions || []).forEach( ext => {
			this.logExt(4, "Shutting down extension: " + ext.id);
			if (ext.obj.shutdown) ext.obj.shutdown();
		} );
	}
	
}; // class ExtSystem

module.exports = ExtSystem;
