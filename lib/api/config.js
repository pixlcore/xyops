// xyOps API Layer - Configuration
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class Configuration {
	
	api_config(args, callback) {
		// send config to client, JSONP-style
		// Note: this is BEFORE LOGIN, and requires NO AUTH, so make sure the response contains no sensitive data.
		// This is basically the UI config bootstrap.  The rest comes across in the successful user login response.
		var self = this;
		
		// do not cache this API response
		this.forceNoCacheResponse(args);
		
		if (args.query.code) {
			// error was injected into page (e.g. SSO related error)
			// early exit and pass along error to be displayed to user
			args.query.host = 1; // bypass master check
			args.query.version = this.server.__version; // show version on error page
			callback( "200 OK", { 'Content-Type': "text/javascript" }, 'app.receiveConfig(' + JSON.stringify(args.query) + ');' );
			return;
		}
		
		var resp = {
			code: 0,
			version: this.server.__version,
			epoch: Tools.timeNow(),
			port: args.request.headers.ssl ? this.web.config.get('https_port') : this.web.config.get('port')
		};
		
		if (this.master) {
			resp.config = Tools.mergeHashes( this.config.get('client'), {
				base_app_url: this.config.get('base_app_url'),
				debug: this.server.debug ? 1 : 0,
				ui: this.config.get('ui'),
				free_accounts: this.usermgr.config.get('free_accounts'),
				email_from: this.config.get('email_from'),
				intl: this.config.get('intl'),
				tz: this.config.get('tz') || Intl.DateTimeFormat().resolvedOptions().timeZone,
				https_port: this.web.config.get('https_port'),
				quick_monitors: this.config.get('quick_monitors'),
				systems: this.systems,
				hostname_display_strip: this.config.get('hostname_display_strip') || '(?!)',
				ip_display_strip: this.config.get('ip_display_strip') || '(?!)',
				default_user_privileges: this.config.get('default_user_privileges'),
				default_user_prefs: this.config.get('default_user_prefs'),
				job_universal_limits: this.config.get('job_universal_limits'),
				job_universal_actions: this.config.get('job_universal_actions'),
				log_columns: this.config.get('log_columns')				
			} );
			resp.masters = this.getMasterPeerData();
		}
		else {
			resp.code = 'master';
			resp.host = this.masterHost || '';
			resp.title = "Non-Primary Conductor Server";
			resp.description = Tools.sub( this.config.getPath('ui.error_type_descriptions.master'), { masterHost: this.masterHost } );
		}
		
		callback( "200 OK", { 'Content-Type': "text/javascript" }, 'app.receiveConfig(' + JSON.stringify(resp) + ');' );
	}
	
	api_form_config(args, callback) {
		// send config to client for magic link form setup
		var self = this;
		
		// locate event (and trigger) by magic token
		var matches = args.request.url.match(/\/form_config\/(v\d+\/)?([\w\-]+)/);
		if (!matches) return this.doError('api', "Malformed URL.", callback); // deliberately vague
		
		var token = matches[2];
		var trigger = null;
		var event = this.events.find( function(event) {
			var token_hash = Tools.digestHex( token + event.id, 'sha256' );
			trigger = Tools.findObject( event.triggers || [], { enabled: true, type: 'magic', token: token_hash } );
			return !!trigger;
		} );
		if (!event) return this.doError('api', "Authentication failed.", callback); // deliberately vague
		if (!event.enabled) return this.doError('event', "Event is disabled: " + event.title, callback);
		
		// do not cache this API response
		this.forceNoCacheResponse(args);
		
		var resp = {
			code: 0,
			version: this.server.__version,
			epoch: Tools.timeNow(),
			port: args.request.headers.ssl ? this.web.config.get('https_port') : this.web.config.get('port')
		};
		
		if (this.master) {
			resp.config = Tools.mergeHashes( this.config.get('client'), {
				Page: [ { 
					ID: 'Magic',
					title: event.title,
					icon: event.icon || '',
					fields: event.fields || [],
					limits: event.limits || [],
					body: trigger.body || '',
					token: token
				} ],
				DefaultPage: 'Magic',
				
				base_app_url: this.config.get('base_app_url'),
				debug: this.server.debug ? 1 : 0,
				ui: this.config.get('ui'),
				intl: this.config.get('intl'),
				tz: this.config.get('tz') || Intl.DateTimeFormat().resolvedOptions().timeZone,
				https_port: this.web.config.get('https_port')
			} );
		}
		else {
			resp.code = 'master';
			resp.host = this.masterHost || '';
			resp.title = "Non-Primary Conductor Server";
			resp.description = Tools.sub( this.config.getPath('ui.error_type_descriptions.master'), { masterHost: this.masterHost } );
		}
		
		var finish = function() {
			callback( "200 OK", { 'Content-Type': "text/javascript" }, 'app.receiveConfig(' + JSON.stringify(resp) + ');' );
		}; // finiah
		
		if (resp.code) return finish();
		
		// see if we need to load buckets
		var buckets_needed = {};
		(event.fields || []).forEach( function(param) {
			if (param.type == 'bucket') buckets_needed[ param.bucket_id ] = 1;
		} );
		
		var bucket_ids = Object.keys(buckets_needed);
		if (!bucket_ids.length) return finish();
		
		// form needs app.buckets (can just be ids)
		resp.buckets = self.buckets.map( function(bucket) { return { id: bucket.id }; } );
		
		// prime with empty data, just in case getMulti fails
		resp.bucketMenuItemCache = {};
		bucket_ids.forEach( function(id) {
			resp.bucketMenuItemCache[id] = {};
		} );
		
		// load all bucket data we need for bucketMenuItemCache
		var bucket_paths = bucket_ids.map( function(id) { return 'buckets/' + id + '/data'; } );
		
		self.storage.getMulti( bucket_paths, function(err, values) {
			if (err) self.logError('storage', "Failed to fetch bucket menu data: " + err, bucket_paths);
			
			(values || []).forEach( function(data, idx) {
				var id = bucket_ids[idx];
				resp.bucketMenuItemCache[id] = data;
			} );
			
			finish();
		}); // storage.getMulti
	}
	
	api_admin_get_config(args, callback) {
		// get configuration for editing in the UI
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			var config = Tools.copyHashRemoveKeys( self.server.config.get(), { secret_key: 1, SSO: 1, Debug: 1, config_overrides_file: 1 } );
			var overrides = Tools.copyHashRemoveKeys( self.server.configOverrides || {}, { secret_key: 1 } );
			
			for (var key in overrides) {
				// these are overrides, so matching on starts-with
				if (key.match(/^(secret_key|SSO|Debug|config_overrides_file)/)) {
					delete overrides[key];
				}
			}
			
			fs.readFile( 'docs/config.md', 'utf8', function(err, markdown) {
				if (err) return self.doError('fs', "Failed to load config doc: " + err, callback);
				callback({ code: 0, config, overrides, markdown });
			}); // fs.readFile
		}); // loadSession
	}
	
	api_admin_update_config(args, callback) {
		// update configuration overrides
		// note: this is an additive blend of sparse override paths
		var self = this;
		var params = args.params;
		if (!this.requireMaster(args, callback)) return;
		
		for (var key in params) {
			// these are overrides, so matching on starts-with
			if (key.match(/^(secret_key|SSO|Debug|config_overrides_file)/)) {
				return this.doError('api', "Cannot update reserved configuration keys via API.", callback);
			}
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(5, "Updating configuration overrides", params);
			self.updateConfigOverrides(params);
			
			self.logTransaction('config_update', '', self.getClientInfo(args, { params, keywords: ['config'] }));
			callback({ code: 0 });
		}); // loadSession
	}
	
}; // class Configuration

module.exports = Configuration;
