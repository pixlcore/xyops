#!/usr/bin/env node

// xyOps Server - Main entry point
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

// Check if Node.js version is old
if (process.version.match(/^v?(\d+)/) && (parseInt(RegExp.$1) < 16) && !process.env['XYOPS_OLD']) {
	console.error("\nERROR: You are using an incompatible version of Node.js (" + process.version + ").  Please upgrade to v16 or later.  Instructions: https://nodejs.org/en/download/package-manager\n\nTo ignore this error and run unsafely, set an XYOPS_OLD environment variable.  Do this at your own risk.\n");
	process.exit(1);
}

var PixlServer = require("pixl-server");
var Echo = require('./echo.js');

// chdir to the proper server root dir
process.chdir( require('path').dirname( __dirname ) );

var server = new PixlServer({
	
	__name: 'xyOps',
	__version: require('../package.json').version,
	
	// configFile: "conf/config.json",
	"multiConfig": [
		{
			"file": "conf/config.json"
		},
		{
			"file": "conf/sso.json",
			"key": "SSO"
		},
		{
			"file": "internal/unbase.json",
			"key": "Unbase"
		},
		{
			"file": "internal/ui.json",
			"key": "ui"
		},
		{
			"file": "internal/intl.json",
			"key": "intl"
		}
	],
	
	components: [
		require('pixl-server-storage'),
		require('pixl-server-unbase'),
		require('pixl-server-web'),
		require('pixl-server-api'),
		require('pixl-server-user'),
		require('pixl-server-debug'),
		require('./engine.js')
	]
	
});

server.on('init', function() {
	// setup fancy echo / repl system, if enabled
	Echo.setup(server);
});

server.startup( function() {
	// server startup complete
	process.title = server.__name + ' Server';
} );
