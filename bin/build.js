#!/usr/bin/env node

// Simple Node Project Builder
// Copies, symlinks and compresses files into the right locations.
// Can also compact & bundle JS/CSS together for distribution.

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

var fs = require('fs');
var path = require('path');
var util = require('util');
var async = require('async');

var Tools = require('pixl-tools');
var mkdirp = Tools.mkdirp;

var BuildTools = require('./build-tools.js');
var setup = require('../internal/setup.json');
var package = require('../package.json');

var mode = 'dist';
if (process.argv.length > 2) mode = process.argv[2];

var steps = setup.build.common || [];
if (setup.build[mode]) {
	steps = steps.concat( setup.build[mode] );
}

// chdir to the proper server root dir
process.chdir( path.dirname( __dirname ) );

// make sure we have a logs dir
mkdirp.sync( 'logs' );
fs.chmodSync( 'logs', "755" );

// log to file instead of console
console.log = function(msg, data) {
	if (data) msg += ' ' + JSON.stringify(data);
	fs.appendFile( 'logs/install.log', msg + "\n", function() {} );
	
	// echo to console for dev
	if (mode == 'dev') process.stdout.write( msg + "\n" );
};

console.log("\nBuilding project ("+mode+")...\n");

async.eachSeries( steps, function(step, callback) {
	// foreach step
	
	// util.isArray is DEPRECATED??? Nooooooooode!
	var isArray = Array.isArray || util.isArray;
	
	if (isArray(step)) {
		// [ "symlinkFile", "node_modules/pixl-webapp/js", "htdocs/js/common" ],
		var func = step.shift();
		console.log( func + ": " + JSON.stringify(step));
		step.push( callback );
		BuildTools[func].apply( null, step );
	}
	else {
		// { "action": "bundleCompress", ... }
		var func = step.action;
		delete step.action;
		step.version = package.version; // for infusing into combo URLs
		console.log( func + ": " + JSON.stringify(step));
		BuildTools[func].apply( null, [step, callback] );
	}
}, 
function(err) {
	// done with iteration, check for error
	if (err) {
		console.error("\nBuild Error: " + err + "\n");
	}
	else {
		console.log("\nBuild complete.\n");
	}
} );

// End
