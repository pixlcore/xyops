#!/usr/bin/env node

// Simple CLI for Unbase System
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

var PixlServer = require("pixl-server");
var Echo = require('../lib/echo.js');
var cli = require('pixl-cli');
var args = cli.args;
var Tools = cli.Tools;
cli.global();

var usage = `Usage: node bin/db-cli.js COMMAND INDEX ARG1, ARG2, ...\nExample: node bin/db-cli.js get alerts amg6sl6z0cc\n`;

// chdir to the proper server root dir
process.chdir( require('path').dirname( __dirname ) );

process.env['XYOPS_foreground'] = '1';
process.env['XYOPS_echo'] = '1';
process.env['XYOPS_log_filename'] = 'db-cli.log';
process.env['XYOPS_debug_level'] = '1';
process.env['XYOPS_pid_file'] = 'logs/db-cli.pid';

var DBCLI = {
	
	run() {
		var self = this;
		
		var cmd = args.cmd;
		if (!cmd && args.other) cmd = args.other.shift();
		if (!cmd || !this[cmd]) return this.die(usage);
		delete args.cmd;
		
		var index = args.index;
		if (!index && args.other) index = args.other.shift();
		if (!index) return this.die( "Unknown index: " + index );
		this.index = index;
		delete args.index;
		
		this.compact = args.compact || false;
		delete args.compact;
		
		this[cmd]( function(err) {
			if (err) warnln(''+err);
			self.server.shutdown();
		} );
	},
	
	get(callback) {
		// get unbase record and emit to stdout
		var self = this;
		var record_id = args.id;
		if (!record_id && args.other) record_id = args.other.shift();
		if (!record_id) return callback( usage );
		
		this.unbase.get( this.index, record_id, function(err, data) {
			if (err) return callback(err);
			self.emit(data);
			callback();
		} );
	},
	
	search(callback) {
		// search unbase records and emit to stdout
		var self = this;
		var query = args.query;
		if (!query && args.other) query = args.other.shift();
		if (!query) return callback( usage );
		
		var opts = {
			offset: args.offset || 0,
			limit: args.limit || 1,
			sort_by: args.sort_by || '_id',
			sort_dir: args.sort_dir || -1
		};
		
		this.unbase.search( this.index, query, opts, function(err, data) {
			if (err) return callback(err);
			
			delete data.perf;
			data.opts = opts;
			
			self.emit(data);
			callback();
		} );
	},
	
	update(callback) {
		// update single row
		var record_id = args.id;
		if (!record_id && args.other) record_id = args.other.shift();
		if (!record_id) return callback( usage );
		
		delete args.id;
		delete args.other;
		if (!Tools.numKeys(args)) return callback( new Error("No properties specified to update.") );
		
		this.unbase.update( this.index, record_id, args, callback );
	},
	
	delete(callback) {
		// delete single row
		var record_id = args.id;
		if (!record_id && args.other) record_id = args.other.shift();
		if (!record_id) return callback( usage );
		
		this.unbase.delete( this.index, record_id, callback );
	},
	
	emit(data) {
		// print data in pretty or compact
		if (this.compact) println( JSON.stringify(data) );
		else println( JSON.stringify(data, null, "\t") );
	},
	
	die(msg) {
		// error
		warnln(msg);
		this.server.shutdown();
	}
	
};

var server = new PixlServer({
	
	__name: 'xyOps',
	__version: require('../package.json').version,
	
	// configFile: "conf/config.json",
	"multiConfig": [
		{
			"file": "conf/config.json"
		},
		{
			"file": "internal/unbase.json",
			"key": "Unbase"
		}
	],
	
	components: [
		require('pixl-server-storage'),
		require('pixl-server-unbase')
	]
	
});

server.on('init', function() {
	// setup fancy echo / repl system, if enabled
	Echo.setup(server);
	// server.emit('master');
});

server.startup( function() {
	// server startup complete
	process.title = server.__name + ' DB CLI';
	
	DBCLI.server = server;
	DBCLI.unbase = server.Unbase;
	DBCLI.storage = server.Storage;
	DBCLI.run();
} );
