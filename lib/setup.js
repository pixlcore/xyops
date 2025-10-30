// xyOps First-Install Setup
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const Path = require('path');
const cp = require('child_process');
const async = require("async");
const Tools = require("pixl-tools");
const noop = function() {};

class Setup {
	
	testStorage(callback) {
		// perform storage test
		var self = this;
		var storage = this.storage;
		var key = 'test/' + Tools.generateUniqueID(32, this.hostname + this.ip);
		
		async.series([
			function(callback) {
				// write test
				storage.put( key, { foo: 'bar' }, callback );
			},
			function(callback) {
				// read test
				storage.get( key, function(err, data) {
					if (err) return callback(err);
					if (data.foo != 'bar') return callback( new Error("Unexpected value: " + data.foo) );
					callback();
				} );
			},
			function(callback) {
				// delete test
				storage.delete( key, callback );
			}
		],
		function(err) {
			if (err) return callback( new Error("Initial storage test failed: " + (err.message || err)) );
			else return callback();
		});
	}
	
	setupStorage(callback) {
		// perform storage test, and create initial records if necessary
		var self = this;
		var storage = this.storage;
		
		async.series([
			function(callback) {
				// see if users exist, and bubble-up non-404 (bad) errors
				storage.get( 'global/users', function(err) {
					if (!err) return callback("GOOD");
					if (err.code != 'NoSuchKey') return callback(err);
					callback();
				});
			},
			function(callback) {
				self.createInitialRecords(callback);
			}
		],
		function(err) {
			if (err && (err === "GOOD")) return callback();
			else if (err) return callback( new Error("Initial storage setup failed: " + (err.message || err)) );
			else return callback();
		});
	}
	
	createInitialRecords(callback) {
		// setup new master server
		var self = this;
		var storage = this.storage;
		var unbase = this.unbase;
		var setup = require('../internal/setup.json');
		var now = Tools.timeNow(true);
		
		this.logDebug(1, "Creating initial storage records");
		
		// append activity setup steps
		setup.storage.forEach( function(params) {
			if ((params[0] != 'listPush') || !setup.activity_map[params[1]] || (typeof(params[2]) != 'object')) return;
			var info = setup.activity_map[params[1]];
			
			var item = params[2];
			item.created = item.modified = now;
			item.revision = 1;
			
			var activity = {
				id: Tools.generateShortID('a'),
				epoch: Tools.timeNow(true),
				action: info.action,
				description: item.title,
				headers: { 'user-agent': "xyOps Setup Script" },
				keywords: [ item.id, 'admin' ],
				username: 'admin'
			};
			activity[ info.key ] = Tools.copyHash( item, true );
			setup.storage.push([ 'insertActivity', '', activity ]);
		} );
		
		// utility function for inserting activity
		var insertActivity = function(dummy, activity, callback) {
			// bootstrap activity into unbase manually
			unbase.insert( 'activity', activity.id, activity, callback);
		}; // insertActivity
		
		// run setup actions
		async.eachSeries( setup.storage,
			function(params, callback) {
				// [ "listCreate", "global/users", { "page_size": 100 } ]
				var func = params.shift();
				params.push( callback );
				
				// massage a few params
				if (typeof(params[1]) == 'object') {
					var obj = params[1];
					if (obj.created) obj.created = now;
					if (obj.modified) obj.modified = now;
					if (obj.regexp && (obj.regexp == '_HOSTNAME_')) obj.regexp = '^(' + Tools.escapeRegExp( self.hostname ) + ')$';
					if (obj.hostname && (obj.hostname == '_HOSTNAME_')) obj.hostname = self.hostname;
					if (obj.ip && (obj.ip == '_IP_')) obj.ip = self.ip;
				}
				
				// special functions
				if (func == 'insertActivity') return insertActivity.apply( null, params );
				
				// call storage directly
				storage[func].apply( storage, params );
			},
			function(err) {
				if (err) return callback(err);
				self.logDebug( 1, "Storage setup completed successfully!" );
				callback();
			}
		);
	}
	
}; // class Setup

module.exports = Setup;
