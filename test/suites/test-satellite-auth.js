const assert = require('node:assert/strict');
const Tools = require('pixl-tools');
const Communication = require('../../lib/comm.js');
const FileManagement = require('../../lib/api/file.js');
const Jobs = require('../../lib/api/jobs.js');

// Exercise the actual authentication handlers with isolated cluster state.
// These fixtures never connect to a live worker or alter a running job.
var secret_key = 'SATELLITE_AUTH_TEST';
var server_id = 'sauthunit1';
var job_id = 'jauthunit1';
var auth_token = Tools.digestHex( server_id + secret_key, 'sha256' );

function createConductor() {
	var conductor = new Communication();
	Object.assign(conductor, {
		master: true,
		config: { get: function() { return secret_key; } },
		sockets: {},
		joins: 0,
		validateServer: function() { return true; },
		logComm: function() {},
		logTransaction: function() {},
		addServer: function() { this.joins++; }
	});
	return conductor;
}

function createSocket() {
	return {
		id: 'auth_test_socket',
		ip: '127.0.0.1',
		messages: [],
		send: function(cmd, data) { this.messages.push({ cmd, data }); }
	};
}

async function callJobAPI(method, params, use_api_key) {
	// Stub the session lookup so the test explicitly selects token or API key auth.
	var handler = {
		config: { get: function() { return secret_key; } },
		servers: { [server_id]: {} },
		requireMaster: function() { return true; },
		validateFiles: function() { return true; },
		requireParams: function() { return true; },
		requireValidUser: function() { return true; },
		requirePrivilege: function() { return true; },
		getComputedUser: function() { return { categories: [], groups: [] }; },
		loadSession: function(args, callback) {
			callback(use_api_key ? null : new Error('No API key'), {}, {});
		},
		doError: function(code, description, callback) { callback({ code, description }); },
		logDebug: function() {},
		updateJobData: function() {},
		storage: {
			isBinaryKey: function() { return true; },
			putStream: function(key, stream, callback) {
				// Consume the actual fixture stream to exercise the successful upload path.
				stream.on('error', callback);
				stream.on('end', function() { callback(); });
				stream.resume();
			}
		}
	};
	var args = {
		params: { id: job_id, job: { complete: true }, ...params },
		files: { file1: { path: 'test/fixtures/rgb-ramp.png', name: 'rgb-ramp.png', size: 1 } }
	};
	return new Promise(function(resolve) { method.call(handler, args, resolve); });
}

exports.tests = [
	function test_satellite_join_requires_token_and_hello(test) {
		var conductor = createConductor();
		var socket = createSocket();
		var join = { cmd: 'join', data: { token: auth_token } };
		
		// Even a valid token must follow the hello handshake.
		conductor.handleSocketMessage(socket, join);
		assert.equal(conductor.joins, 0);
		conductor.handleSocketMessage(socket, { cmd: 'hello', data: { id: server_id } });
		assert.deepEqual(socket.messages.pop(), { cmd: 'hello', data: { id: server_id } });
		conductor.handleSocketMessage(socket, join);
		assert.equal(conductor.joins, 1, 'per-server token accepted');
		conductor.handleSocketMessage(socket, join);
		assert.equal(conductor.joins, 1, 'hello consumed before asynchronous server registration');
		test.done();
	},
	
	function test_satellite_join_rejects_legacy_nonce_hash(test) {
		var conductor = createConductor();
		var socket = createSocket();
		
		// Simulate the old challenge response, including its former nonce state.
		conductor.handleSocketMessage(socket, { cmd: 'hello', data: { id: server_id } });
		socket.server.nonce = 'old_nonce';
		conductor.handleSocketMessage(socket, {
			cmd: 'join', data: { token: Tools.digestHex('old_nonce' + secret_key, 'sha256') }
		});
		assert.equal(conductor.joins, 0);
		assert.equal(socket.messages.pop().cmd, 'auth_failure');
		test.done();
	},
	
	async function test_satellite_job_apis_reject_legacy_auth(test) {
		var methods = [ FileManagement.prototype.api_upload_job_file, Jobs.prototype.api_finish_job ];
		for (var method of methods) {
			var legacy_token = Tools.digestHex(job_id + secret_key, 'sha256');
			for (var params of [
				{ auth: legacy_token },
				{ server: server_id, auth: legacy_token },
				{ auth: auth_token },
				{ server: 'missing_server', auth: auth_token },
				{ server: 'missing_server', auth: Tools.digestHex('missing_server' + secret_key) },
				{ server: server_id, auth: Tools.digestHex('other_job' + auth_token) }
			]) {
				var data = await callJobAPI(method, params);
				assert.equal(data.code, 'auth', 'legacy, unidentified, inactive, and mismatched tokens rejected');
			}
		}
	},
	
	async function test_satellite_job_apis_accept_server_and_runner_tokens(test) {
		var methods = [ FileManagement.prototype.api_upload_job_file, Jobs.prototype.api_finish_job ];
		for (var method of methods) {
			for (var token of [ auth_token, Tools.digestHex(job_id + auth_token, 'sha256') ]) {
				var data = await callJobAPI(method, { server: server_id, auth: token });
				assert.equal(data.code, 0, 'server and scoped runner tokens accepted');
			}
			
			// The existing privileged API key route does not need a satellite ID.
			var data = await callJobAPI(method, { auth: 'privileged_api_key' }, true);
			assert.equal(data.code, 0, 'API key authentication preserved');
		}
	}
];
