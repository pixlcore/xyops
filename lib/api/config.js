// Orchestra API Layer - Configuration
// Copyright (c) 2021 - 2024 Joseph Huckaby

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
		
		var resp = {
			code: 0,
			version: this.server.__version,
			epoch: Tools.timeNow(),
			port: args.request.headers.ssl ? this.web.config.get('https_port') : this.web.config.get('http_port')
		};
		
		if (this.master) {
			resp.config = Tools.mergeHashes( this.config.get('client'), {
				debug: this.server.debug ? 1 : 0,
				privilege_list: this.config.getPath('ui.privilege_list'),
				list_list: this.config.getPath('ui.list_list'),
				database_list: this.config.getPath('ui.database_list'),
				default_privileges: this.usermgr.config.get('default_privileges'),
				free_accounts: this.usermgr.config.get('free_accounts'),
				external_users: this.usermgr.config.get('external_user_api') ? 1 : 0,
				external_user_api: this.usermgr.config.get('external_user_api') || '',
				email_from: this.config.get('email_from'),
				intl: this.config.get('intl'),
				tz: this.config.get('tz') || Intl.DateTimeFormat().resolvedOptions().timeZone,
				auth0: this.config.get('auth0') || {},
				https_port: this.web.config.get('https_port'),
				quick_monitors: this.config.get('quick_monitors'),
				systems: this.systems
			} );
			resp.masters = this.getMasterPeerData();
		}
		else {
			resp.code = 'master';
			resp.host = this.masterHost || '';
		}
		
		callback( "200 OK", { 'Content-Type': "text/javascript" }, 'app.receiveConfig(' + JSON.stringify(resp) + ');' );
	}
	
}; // class Configuration

module.exports = Configuration;
