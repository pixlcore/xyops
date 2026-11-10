// xyOps Server - Unit Test Entrypoint
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.
// Run this via pixl-unit -- see package.json

const fs = require('fs');
const cp = require('child_process');
const assert = require('node:assert/strict');
const async = require('async');
const PixlRequest = require("pixl-request");
const Tools = require('pixl-tools');
const API = require('../lib/api.js');

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
		this.request.setAutoError( false );
		this.request.setKeepAlive( true );
		
		// clean out data from last run
		try { Tools.rimraf.sync('test/logs'); } catch(e) {;}
		try { Tools.rimraf.sync('test/data'); } catch(e) {;}
		try { Tools.rimraf.sync('test/temp'); } catch(e) {;}
		
		// load suites
		this.tests = this.tests.concat( 
			require('./suites/test-initial.js').tests,
			require('./suites/test-expressions.js').tests,
			require('./suites/test-syshooks.js').tests,
			require('./suites/test-buckets.js').tests,
			require('./suites/test-categories.js').tests,
			require('./suites/test-channels.js').tests,
			require('./suites/test-events.js').tests,
			require('./suites/test-files.js').tests,
			require('./suites/test-groups.js').tests,
			require('./suites/test-monitors.js').tests,
			require('./suites/test-plugins.js').tests,
			require('./suites/test-secrets.js').tests,
			require('./suites/test-roles.js').tests,
			require('./suites/test-apikeys.js').tests,
			require('./suites/test-tags.js').tests,
			require('./suites/test-servers.js').tests,
			require('./suites/test-satellite-auth.js').tests,
			require('./suites/test-webhooks.js').tests,
			require('./suites/test-tickets.js').tests,
			require('./suites/test-jobs.js').tests,
			require('./suites/test-workflows.js').tests,
			require('./suites/test-workflow-replay.js').tests,
			require('./suites/test-alerts.js').tests,
			require('./suites/test-search.js').tests,
			require('./suites/test-scheduler.js').tests,
			require('./suites/test-users.js').tests,
			require('./suites/test-user-visibility.js').tests,
			require('./suites/test-admin.js').tests // do this one last!
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
		async function test_api_basic(test) {
			// make sure web server and api are up
			let { data } = await this.request.json( this.api_url + '/app/echo', { foo: 'bar' } );
			assert.ok( !data.code, 'successful api response' );
			assert.ok( !!data.params, 'found params in response' );
			assert.ok( data.params.foo === 'bar', 'found our value in params' );
		},
		
		async function test_api_error_redacts_sensitive_headers(test) {
			// Exercise the centralized error logger directly, so no real credentials
			// ever have to pass through the test server or reach a log file.
			var api = new API();
			var logged_data = null;
			var response = null;
			var sensitive_headers = [
				'x-api-key',
				'x-session-id',
				'x-csrf-token',
				'authorization',
				'proxy-authorization',
				'cookie'
			];
			var request_headers = {
				'x-api-key': 'api-secret',
				'x-session-id': 'session-secret',
				'x-csrf-token': 'csrf-secret',
				'authorization': 'Bearer auth-secret',
				'proxy-authorization': 'Basic proxy-secret',
				'cookie': 'session_id=cookie-secret',
				'user-agent': 'xyOps Unit Tester'
			};
			var original_headers = Tools.copyHash(request_headers);
			
			api.api = {
				logError(code, msg, data) {
					logged_data = data;
				}
			};
			api.web = {
				requests: {
					test_request: {
						id: 'test_request',
						ip: '127.0.0.1',
						ips: [ '127.0.0.1' ],
						request: {
							url: '/api/app/error/v1',
							headers: request_headers
						}
					}
				},
				getSelfURL(request, url) {
					return 'http://localhost' + url;
				}
			};
			
			function callback(data, http_code) {
				response = { data, http_code };
			}
			callback._req_id = 'test_request';
			
			api.doError('api', 'Sensitive header regression test', callback);
			
			assert.ok(logged_data && logged_data.headers, 'captured API error log data');
			sensitive_headers.forEach( function(header) {
				assert.ok(!(header in logged_data.headers), 'redacted sensitive header: ' + header);
			} );
			assert.equal(logged_data.headers['user-agent'], 'xyOps Unit Tester', 'preserved non-sensitive header');
			assert.deepEqual(request_headers, original_headers, 'did not mutate live request headers');
			assert.equal(response.http_code, '400', 'returned API validation HTTP status');
		},
		
		async function test_satellite(test) {
			// make sure satellite is connected
			assert.ok( !!this.xy.servers['satunit1'], "satunit1 in servers" );
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
