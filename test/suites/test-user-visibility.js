// Regression tests for user stub visibility at login and during live updates.
const assert = require('node:assert/strict');
const Tools = require('pixl-tools');
const Config = require('pixl-config');
const Engine = require('../../lib/engine.js');

function makeUser(username, categories = [], groups = [], roles = [], privileges = {}) {
	return {
		username, categories, groups, roles, privileges,
		full_name: username + ' Full Name',
		icon: 'account',
		active: 1,
		password: 'private-password',
		salt: 'private-salt',
		email: username + '@localhost'
	};
}

function makeEngine(users, roles = []) {
	// Exercise the real visibility, login, settings, user hooks and role refresh.
	// Only storage and unrelated services are replaced with isolated fixtures.
	var engine = Object.create(Engine.prototype);
	Object.assign( engine, {
		master: true, roles, sockets: {}, api_keys: [],
		// Use local authentication so the login hook can check its SSO policy.
		config: new Config({ SSO: { enabled: false } }),
		usermgr: { normalizeUsername: username => username.toLowerCase(), sanitizeUser() {} },
		emit() {}, logActivity() {}, logUserActivity() {}, logDebug() {}, logError() {},
		requireMaster() { return true; },
		getClientInfo(args, data) { return data; },
		getInternalJobs() { return {}; },
		countQueuedJobs() { return 0; },
		getSocketNavData() { return {}; }
	} );
	
	// Return copies just like records read from storage. Synchronous callbacks
	// keep these tests focused on sequential updates and visibility rules.
	engine.storage = {
		concurrency: 1,
		listGet(path, offset, limit, callback) {
			assert.equal(path, 'global/users');
			callback(null, users.map( user => ({ username: user.username }) ));
		},
		get(path, callback) {
			var user = users.find( user => path == 'users/' + user.username.toLowerCase() );
			assert.ok(user, 'expected user fixture for ' + path);
			callback(null, Tools.copyHash(user, true));
		},
		put(path, user, callback) {
			assert.equal(path, 'users/' + user.username.toLowerCase());
			var idx = users.findIndex( item => item.username == user.username );
			assert.ok(idx > -1, 'expected existing user fixture');
			users[idx] = Tools.copyHash(user, true);
			callback();
		},
		enqueue(task) { task({}, function() {}); },
		listDelete(path, entire, callback) { callback(); }
	};
	
	// Resource filtering has its own tests; these methods only supply login and
	// refresh payload fields which are unrelated to user name resolution.
	['getUserLimitedActiveJobs', 'getUserLimitedActiveAlerts', 'getUserLimitedCachedServers',
		'getUserLimitedActiveServers', 'getUserLimitedGroups', 'getUserLimitedCategories',
		'getUserLimitedEvents'].forEach( function(name) { engine[name] = () => []; } );
	return engine;
}

function addSocket(engine, user, id = user.username) {
	var socket = {
		auth: true, user: true, username: user.username,
		computed: engine.getComputedUser(user),
		messages: [], users: [],
		send(cmd, data) {
			// Copy through JSON like the real transport. An update replaces app.users.
			data = Tools.copyHash(data, true);
			this.messages.push({ cmd, data });
			if (cmd == 'update' && data.users) this.users = data.users;
		},
		close() { this.closed = true; }
	};
	engine.sockets[id] = socket;
	return socket;
}

function assertNames(users, expected, message) {
	assert.deepEqual(users.map( user => user.username ).sort(), expected.slice().sort(), message);
}

function changed(engine, action, user) {
	engine.afterUserChange(action, { user, admin_user: { username: 'admin' } });
}

function visibilityFixture() {
	// Separate subset and mismatch records catch accidental any-match checks,
	// reversed containment, and treating category/group checks as alternatives.
	var roles = [
		{ id: 'tenant', enabled: true, categories: ['a', 'b'], groups: ['g1', 'g2'] },
		{ id: 'extra', enabled: true, categories: ['b'], groups: ['g2'] },
		{ id: 'administrator', enabled: true, privileges: { admin: true } },
		{ id: 'disabled', enabled: false, privileges: { admin: true } }
	];
	var users = [
		makeUser('same', ['a', 'b'], ['g1', 'g2']),
		makeUser('superset', ['a', 'b', 'c'], ['g1', 'g2', 'g3']),
		makeUser('category_subset', ['a'], ['g1', 'g2']),
		makeUser('group_subset', ['a', 'b'], ['g1']),
		makeUser('category_match', ['a', 'b'], ['g3']),
		makeUser('group_match', ['c'], ['g1', 'g2']),
		makeUser('different', ['c'], ['g3']),
		makeUser('inherited', [], [], ['tenant']),
		makeUser('mixed', ['a'], ['g1'], ['extra']),
		makeUser('unrestricted'),
		makeUser('admin', [], [], [], { admin: true }),
		makeUser('role_admin', [], [], ['administrator']),
		makeUser('disabled_role', ['c'], ['g3'], ['disabled'])
	];
	var both = ['admin', 'role_admin', 'same', 'superset', 'inherited', 'mixed'];
	var everyone = users.map( user => user.username );
	return {
		users, roles,
		cases: [
			{ viewer: makeUser('category_viewer', ['a', 'b']), visible: both.concat(['group_subset', 'category_match']) },
			{ viewer: makeUser('group_viewer', [], ['g1', 'g2']), visible: both.concat(['category_subset', 'group_match']) },
			{ viewer: makeUser('both_viewer', ['a', 'b'], ['g1', 'g2']), visible: both },
			{ viewer: makeUser('inherited_viewer', [], [], ['tenant']), visible: both },
			{ viewer: makeUser('mixed_viewer', ['a'], ['g1'], ['extra']), visible: both },
			{ viewer: makeUser('unrestricted_viewer'), visible: everyone },
			{ viewer: makeUser('admin_viewer', ['a'], ['g1'], [], { admin: true }), visible: everyone },
			{ viewer: makeUser('role_admin_viewer', [], [], ['administrator']), visible: everyone }
		]
	};
}

exports.tests = [
	
	async function test_user_visibility_login() {
		var fixture = visibilityFixture();
		var engine = makeEngine(fixture.users, fixture.roles);
		var original = Tools.copyHash(fixture.users, true);
		
		for (var item of fixture.cases) {
			var args = { user: item.viewer };
			await new Promise( (resolve, reject) => {
				engine.beforeUserLogin('login', args, err => err ? reject(err) : resolve());
			} );
			assertNames(args.resp.users, item.visible, item.viewer.username + ' login visibility');
			
			// An explicit key allowlist catches any newly leaked sensitive properties.
			for (var stub of args.resp.users) {
				assert.deepEqual(Object.keys(stub).sort(), ['full_name', 'icon', 'roles', 'username']);
				assert.equal(stub.full_name, stub.username + ' Full Name');
				assert.equal(stub.icon, 'account');
				assert.deepEqual(stub.roles, fixture.users.find( user => user.username == stub.username ).roles);
			}
		}
		assert.deepEqual(fixture.users, original, 'building stubs does not modify stored users');
	},
	
	async function test_user_visibility_compatible_broadcasts() {
		var fixture = visibilityFixture();
		var engine = makeEngine(fixture.users, fixture.roles);
		for (var item of fixture.cases) addSocket(engine, item.viewer);
		
		// Ineligible sockets must never receive a user stub, even for an admin target.
		var anonymous = addSocket(engine, makeUser('anonymous'));
		anonymous.auth = false;
		var server = addSocket(engine, makeUser('server'));
		server.user = false;
		var pending = addSocket(engine, makeUser('pending'));
		delete pending.computed;
		
		for (var target of fixture.users) {
			Object.values(engine.sockets).forEach( socket => { socket.messages = []; } );
			var payload = { list: 'users', item: { username: target.username, full_name: target.full_name } };
			engine.doUserBroadcastCompat(target, 'single', payload);
			
			// Use the same independently specified visibility matrix as login.
			for (var item of fixture.cases) {
				var messages = engine.sockets[item.viewer.username].messages;
				var expected = item.visible.includes(target.username) ? [{ cmd: 'single', data: payload }] : [];
				assert.deepEqual(messages, expected, item.viewer.username + ' receives ' + target.username);
			}
			assert.equal(anonymous.messages.length, 0);
			assert.equal(server.messages.length, 0);
			assert.equal(pending.messages.length, 0);
		}
	},
	
	async function test_user_visibility_settings_broadcast() {
		var target = makeUser('target', ['a'], ['g1']);
		var compatible = makeUser('compatible', ['a'], ['g1']);
		var foreign = makeUser('foreign', ['b'], ['g2']);
		var unrestricted = makeUser('unrestricted');
		var admin = makeUser('admin', [], [], [], { admin: true });
		var users = [target, compatible, foreign, unrestricted, admin];
		var engine = makeEngine(users);
		users.forEach( user => addSocket(engine, user) );
		engine.loadSession = (args, callback) => callback(null, { username: target.username }, Tools.copyHash(target, true));
		
		// Settings use their own save and broadcast path instead of afterUserChange.
		var response = await new Promise( resolve => {
			engine.api_user_settings({ params: { full_name: 'Updated Target' } }, resolve);
		} );
		assert.equal(response.code, 0);
		assert.equal(users[0].full_name, 'Updated Target');
		for (var name of ['target', 'compatible', 'unrestricted', 'admin']) {
			var messages = engine.sockets[name].messages.filter( message => message.cmd == 'single' );
			assert.equal(messages.length, 1, name + ' receives compatible profile update');
			assert.equal(messages[0].data.item.full_name, 'Updated Target');
			assert.deepEqual(Object.keys(messages[0].data.item).sort(), ['full_name', 'icon', 'roles', 'username']);
		}
		assert.equal(engine.sockets.foreign.messages.length, 0, 'foreign tenant receives no profile update');
		assert.ok(engine.sockets.target.messages.some( message => message.cmd == 'self_update' ));
	},
	
	async function test_user_visibility_user_changes() {
		var viewer = makeUser('viewer', ['a'], ['g1']);
		var wide = makeUser('wide', ['a', 'b'], ['g1', 'g2']);
		var old_peer = makeUser('old_peer', ['a'], ['g1']);
		var new_peer = makeUser('new_peer', ['b'], ['g2']);
		var admin = makeUser('admin', [], [], [], { admin: true });
		var users = [viewer, wide, old_peer, new_peer, admin];
		var engine = makeEngine(users, [{ id: 'tenant_a', enabled: true, categories: ['a'], groups: ['g1'] }]);
		var socket = addSocket(engine, viewer);
		var second = addSocket(engine, viewer, 'second_session');
		var wide_socket = addSocket(engine, wide);
		var admin_socket = addSocket(engine, admin);
		engine.updateRoles();
		assertNames(socket.users, ['admin', 'old_peer', 'viewer', 'wide']);
		
		// A target changing either category or group restrictions removes its stub.
		wide.categories = ['b'];
		changed(engine, 'user_update', wide);
		assertNames(socket.users, ['admin', 'old_peer', 'viewer']);
		wide.categories = ['a', 'b'];
		wide.groups = ['g2'];
		changed(engine, 'user_update', wide);
		assertNames(socket.users, ['admin', 'old_peer', 'viewer']);
		wide.groups = ['g1', 'g2'];
		changed(engine, 'user_update', wide);
		assertNames(socket.users, ['admin', 'old_peer', 'viewer', 'wide']);
		
		// Moving the viewer replaces the whole list across all its sessions.
		viewer.categories = ['b'];
		viewer.groups = ['g2'];
		changed(engine, 'user_update', viewer);
		assertNames(socket.users, ['admin', 'new_peer', 'viewer', 'wide']);
		assert.deepEqual(second.users, socket.users);
		assert.ok(socket.messages.some( message => message.cmd == 'self_update' ));
		
		// Assigning a role changes the viewer's computed visibility in the same way.
		viewer.categories = [];
		viewer.groups = [];
		viewer.roles = ['tenant_a'];
		changed(engine, 'user_update', viewer);
		assertNames(socket.users, ['admin', 'old_peer', 'viewer', 'wide']);
		assert.deepEqual(second.users, socket.users);
		
		// Creation must add compatible users while withholding foreign tenant names.
		var created = makeUser('created', ['a', 'b'], ['g1', 'g2']);
		users.push(created);
		changed(engine, 'user_create', created);
		assertNames(socket.users, ['admin', 'created', 'old_peer', 'viewer', 'wide']);
		var foreign = makeUser('foreign_created', ['b'], ['g2']);
		users.push(foreign);
		changed(engine, 'user_create', foreign);
		assertNames(socket.users, ['admin', 'created', 'old_peer', 'viewer', 'wide']);
		assert.ok(!JSON.stringify(socket.messages).includes('foreign_created'));
		assert.ok(admin_socket.users.some( user => user.username == foreign.username ));
		
		// Deletion removes all copies, and disabled users still lose their sockets.
		users.splice(users.indexOf(wide), 1);
		changed(engine, 'user_delete', wide);
		assertNames(socket.users, ['admin', 'created', 'old_peer', 'viewer']);
		assert.deepEqual(second.users, socket.users);
		assert.ok(wide_socket.closed && !wide_socket.auth);
		viewer.active = 0;
		changed(engine, 'user_update', viewer);
		assert.ok(socket.closed && second.closed);
	},
	
	async function test_user_visibility_role_changes() {
		var viewer = makeUser('viewer', [], [], ['viewer_role']);
		var peer = makeUser('offline_peer', [], [], ['peer_role']);
		var roles = [
			{ id: 'viewer_role', enabled: true, categories: ['a'], groups: ['g1'] },
			{ id: 'peer_role', enabled: true, categories: ['a'], groups: ['g1'] }
		];
		var users = [viewer, peer, makeUser('peer_a', ['a'], ['g1']), makeUser('peer_b', ['b'], ['g2'])];
		var engine = makeEngine(users, roles);
		var socket = addSocket(engine, viewer);
		engine.updateRoles();
		assertNames(socket.users, ['offline_peer', 'peer_a', 'viewer']);
		
		// Role changes must affect offline targets as well as connected viewers.
		roles[1].categories = ['b'];
		roles[1].groups = ['g2'];
		engine.updateRoles();
		assertNames(socket.users, ['peer_a', 'viewer']);
		roles[1].privileges = { admin: true };
		engine.updateRoles();
		assertNames(socket.users, ['offline_peer', 'peer_a', 'viewer']);
		roles[1].enabled = false;
		engine.updateRoles();
		assertNames(socket.users, ['peer_a', 'viewer']);
		roles[1].enabled = true;
		roles[1].privileges = {};
		
		// Changing viewer scope replaces old peers; inherited admin sees everyone.
		roles[0].categories = ['b'];
		roles[0].groups = ['g2'];
		engine.updateRoles();
		assertNames(socket.users, ['offline_peer', 'peer_b', 'viewer']);
		assert.deepEqual(socket.computed.groups, ['g2']);
		roles[0].privileges = { admin: true };
		engine.updateRoles();
		assert.equal(socket.admin, true);
		assertNames(socket.users, users.map( user => user.username ));
		roles[0].privileges = {};
		engine.updateRoles();
		assert.equal(socket.admin, false);
		assertNames(socket.users, ['offline_peer', 'peer_b', 'viewer']);
		
		// Removing the viewer's only role leaves it unrestricted.
		roles.splice(0, 1);
		engine.updateRoles();
		assertNames(socket.users, users.map( user => user.username ));
	}
	
];
