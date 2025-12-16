// xyOps Server - Unit Test Entrypoint
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.
// Run this via pixl-unit -- see package.json

const fs = require('fs');
const cp = require('child_process');
const async = require('async');
const PixlRequest = require("pixl-request");
const Tools = require('pixl-tools');

// override the overrides with our test overrides
process.env['XYOPS_config_overrides_file'] = 'test/fixtures/overrides.json';

// chdir to the proper server root dir
process.chdir( require('path').dirname( __dirname ) );

// load pixl-server
const server = require('../lib/loader.js');

module.exports = {
	
	setUp(callback) {
		// always called before tests start
		var self = this;
		
		// setup pixl-request
		this.request = new PixlRequest( "xyOps Unit Tester" );
		this.request.setTimeout( 30 * 1000 );
		this.request.setFollow( 5 );
		this.request.setAutoError( true );
		this.request.setKeepAlive( true );
		
		// clean out data from last run
		try { Tools.rimraf.sync('test/logs'); } catch(e) {;}
		try { Tools.rimraf.sync('test/data'); } catch(e) {;}
		try { Tools.rimraf.sync('test/temp'); } catch(e) {;}
		
		// load suites
		this.tests = this.tests.concat( 
			require('./suites/test-user-initial.js').tests,
			require('./suites/test-alerts-api.js').tests,
			require('./suites/test-buckets-api.js').tests,
			require('./suites/test-categories-api.js').tests,
			require('./suites/test-channels-api.js').tests,
			require('./suites/test-events-api.js').tests,
			require('./suites/test-files-api.js').tests,
			require('./suites/test-groups-api.js').tests,
			require('./suites/test-monitors-api.js').tests
		);
		
		// start pixl-server
		server.startup( function() {
			// server startup complete
			self.server = server;
			self.storage = server.Storage;
			self.xy = server.xyOps;
			
			// prepare to make api calls
			self.api_url = server.config.get('base_app_url') + server.API.config.get('base_uri');
			
			// write log in sync mode, for troubleshooting
			server.logger.set('sync', true);
		}); // server.startup
		
		server.on('master', function() {
			// server has become master, we can begin
			self.logDebug(2, "Caught master event, starting satellite");
			
			// start up mock satellite
			var satellite = self.satellite = require('./xysat.js');
			satellite.logger = server.logger;
			
			server.on('tick', function() {
				satellite.tick();
			});
			
			self.xy.once('serverAdded', function() {
				self.logDebug(3, "Event: addedServer");
				callback();
			});
			
			satellite.startup();
		});
	}, // setUp
	
	tests: [
		function testSatellite(test) {
			// make sure satellite is connected
			test.ok( !!this.xy.servers['satunit1'], "satunit1 in servers" );
			test.done();
		}
	],
	
	beforeEach: function(test) {
		// called just before each test
		this.logDebug(10, "Starting unit test: " + test.name );
	},
	
	afterEach: function(test) {
		// called after each test completes
		this.logDebug(10, "Unit test complete: " + test.name );
	},
	
	tearDown: function (callback) {
		// always called right before shutdown
		var self = this;
		this.logDebug(1, "Running tearDown");
		
		// send term to satellite
		if (this.satellite) {
			this.logDebug(2, "Killing satellite");
			this.satellite.shutdown();
		}
		
		// shut down server
		this.logDebug(2, "Shutting down server");
		server.shutdown( function() {
			// all done, delete data if no errors
			self.logDebug(2, "Server shutdown complete, exiting");
			
			if (self.args.delete) {
				self.logDebug(3, "Deleting all test data and logs");
				try { Tools.rimraf.sync('test/logs'); } catch(e) {;}
				try { Tools.rimraf.sync('test/data'); } catch(e) {;}
				try { Tools.rimraf.sync('test/temp'); } catch(e) {;}
			}
			
			callback();
		} );
	},
	
	logDebug: function(level, msg, data) {
		// proxy request to system logger with correct component
		if (server.logger) {
			server.logger.set( 'component', 'Test' );
			server.logger.debug( level, msg, data );
		}
	}
	
};
