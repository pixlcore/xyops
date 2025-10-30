#!/usr/bin/env node

// CLI for Storage System
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

var path = require('path');
var cp = require('child_process');
var os = require('os');
var fs = require('fs');
var zlib = require('zlib');
var async = require('async');
var bcrypt = require('bcrypt-node');

var Args = require('pixl-args');
var Tools = require('pixl-tools');
var StandaloneStorage = require('pixl-server-storage/standalone');

// chdir to the proper server root dir
process.chdir( path.dirname( __dirname ) );

// load app's config file
var config = require('../conf/config.json');

// shift commands off beginning of arg array
var argv = JSON.parse( JSON.stringify(process.argv.slice(2)) );
var commands = [];
while (argv.length && !argv[0].match(/^\-/)) {
	commands.push( argv.shift() );
}

// now parse rest of cmdline args, if any
var args = new Args( argv, {
	debug: false,
	verbose: false,
	quiet: false
} );
args = args.get(); // simple hash

// copy debug flag into config (for standalone)
config.Storage.debug = args.debug;

var print = function(msg) {
	// print message to console
	if (!args.quiet) process.stdout.write(msg);
};
var verbose = function(msg) {
	// print only in verbose mode
	if (args.verbose) print(msg);
};
var warn = function(msg) {
	// print to stderr unless quiet
	if (!args.quiet) process.stderr.write(msg);
};
var verbose_warn = function(msg) {
	// verbose print to stderr unless quiet
	if (args.verbose && !args.quiet) process.stderr.write(msg);
};

if (config.uid && (process.getuid() != 0)) {
	print( "ERROR: Must be root to use this script.\n" );
	process.exit(1);
}

// make sure xyops isn't running
var is_running = false;
var pid_file = config.log_dir + '/xyops.pid';
try {
	var pid = fs.readFileSync(pid_file, { encoding: 'utf8' });
	is_running = process.kill( pid, 0 );
}
catch (err) {;}
if (is_running && !args.force) {
	print( "ERROR: Please stop xyOps before running this script.\n" );
	process.exit(1);
}

// determine server hostname
var hostname = (process.env['HOSTNAME'] || process.env['HOST'] || os.hostname()).toLowerCase();

// find the first external IPv4 address
var ip = '';
var ifaces = os.networkInterfaces();
var addrs = [];
for (var key in ifaces) {
	if (ifaces[key] && ifaces[key].length) {
		Array.from(ifaces[key]).forEach( function(item) { addrs.push(item); } );
	}
}
var addr = Tools.findObject( addrs, { family: 'IPv4', internal: false } );
if (addr && addr.address && addr.address.match(/^\d+\.\d+\.\d+\.\d+$/)) {
	ip = addr.address;
}
else {
	print( "ERROR: Could not determine server's LAN IPv4 address.\n" );
	process.exit(1);
}

// util.isArray is DEPRECATED??? Nooooooooode!
var isArray = Array.isArray || util.isArray;

// prevent logging transactions to STDOUT
config.Storage.log_event_types = {};

// construct standalone storage server
var storage = new StandaloneStorage(config.Storage, function(err) {
	if (err) throw err;
	// storage system is ready to go
	
	// become correct user
	if (config.uid && (process.getuid() == 0)) {
		verbose( "Switching to user: " + config.uid + "\n" );
		process.setuid( config.uid );
	}
	
	// process command
	var cmd = commands.shift();
	verbose("\n");
	
	switch (cmd) {
		case 'admin':
			// create or replace admin account
			// Usage: ./storage-cli.js admin USERNAME PASSWORD [EMAIL]
			var username = commands.shift();
			var password = commands.shift();
			var email = commands.shift() || 'admin@localhost';
			if (!username || !password) {
				print( "\nUsage: bin/storage-cli.js admin USERNAME PASSWORD [EMAIL]\n\n" );
				process.exit(1);
			}
			if (!username.match(/^[\w\-\.]+$/)) {
				print( "\nERROR: Username must contain only alphanumerics, dash and period.\n\n" );
				process.exit(1);
			}
			username = username.toLowerCase();
			
			var user = {
				username: username,
				password: password,
				full_name: "Administrator",
				email: email
			};
			
			user.active = 1;
			user.created = user.modified = Tools.timeNow(true);
			user.salt = Tools.generateUniqueID( 64, user.username );
			user.password = bcrypt.hashSync( user.password + user.salt );
			user.privileges = { admin: 1 };
			
			storage.put( 'users/' + normalizeUsername(username), user, function(err) {
				if (err) throw err;
				print( "\nAdministrator '"+username+"' created successfully.\n" );
				print("\n");
				
				storage.shutdown( function() {;} );
			} );
		break;
		
		case 'grant':
		case 'revoke':
			// grant or revoke privilege from user
			// Usage: bin/storage-cli.js grant USERNAME PRIVILEGE
			var username = commands.shift();
			var priv = commands.shift();
			if (!username || !priv) {
				print( "\nUsage: bin/storage-cli.js $cmd USERNAME PRIVILEGE\n\n" );
				process.exit(1);
			}
			if (!username.match(/^[\w\-\.]+$/)) {
				print( "\nERROR: Username must contain only alphanumerics, dash and period.\n\n" );
				process.exit(1);
			}
			
			storage.get( 'users/' + normalizeUsername(username), function(err, user) {
				if (err) {
					print( "\nUser not found: " + username + "\n");
					storage.shutdown( function() {;} );
					return;
				}
				
				if (cmd == 'grant') user.privileges[priv] = 1;
				else delete user.privileges[priv];
				
				storage.put( 'users/' + normalizeUsername(username), user, function(err) {
					if (err) throw err;
					print( "\nUser '" + username + "' updated successfully (" + cmd + " " + priv + ").\n" );
					print("\n");
					
					storage.shutdown( function() {;} );
				} ); // storage.put
			} ); // storage.get
		break;
		
		case 'get':
		case 'fetch':
		case 'view':
		case 'cat':
			// get storage key
			// Usage: ./storage-cli.js get users/jhuckaby
			var key = commands.shift();
			storage.get( key, function(err, data) {
				if (err) throw err;
				if (storage.isBinaryKey(key)) {
					if (key.match(/\.gz$/)) print( zlib.gunzipSync(data).toString() + "\n" );
					else print( data.toString() + "\n" );
				}
				else print( ((typeof(data) == 'object') ? JSON.stringify(data, null, "\t") : data) + "\n" );
				print("\n");
				
				storage.shutdown( function() {;} );
			} );
		break;
		
		case 'put':
		case 'save':
		case 'store':
			// put storage key (read data from STDIN)
			// Usage: cat USER.json | ./storage-cli.js put users/jhuckaby
			var key = commands.shift();
			var json_raw = '';
			var rl = require('readline').createInterface({ input: process.stdin });
			rl.on('line', function(line) { json_raw += line; });
			rl.on('close', function() {
				print( "Writing record from STDIN: " + key + "\n" );
				
				var data = null;
				try { data = JSON.parse(json_raw); }
				catch (err) {
					warn( "Failed to parse JSON for key: " + key + ": " + err + "\n" );
					process.exit(1);
				}
				
				storage.put( key, data, function(err) {
					if (err) {
						warn( "Failed to store record: " + key + ": " + err + "\n" );
						process.exit(1);
					}
					print("Record successfully saved: "+key+"\n");
					
					storage.shutdown( function() {;} );
				} );
			});
		break;
		
		case 'edit':
		case 'vi':
			var key = commands.shift();
			
			if ((cmd == 'edit') && !process.env.EDITOR) {
				warn( "No EDITOR environment variable is set.\n" );
				process.exit(1);
			}
			
			storage.get( key, function(err, data) {
				if (err) data = {};
				print("Spawning editor to edit record: " + key + "\n");
				
				// save to local temp file
				var temp_file = path.join( os.tmpdir(), 'cli-temp-' + process.pid + '.json' );
				fs.writeFileSync( temp_file, JSON.stringify(data, null, "\t") + "\n" );
				var stats = fs.statSync( temp_file );
				var old_mod = Math.floor( stats.mtime.getTime() / 1000 );
				
				// spawn vi but inherit terminal
				var child = cp.spawn( (cmd == 'vi') ? 'vi' : process.env.EDITOR, [temp_file], {
					stdio: 'inherit'
				} );
				child.on('exit', function (e, code) {
					var stats = fs.statSync( temp_file );
					var new_mod = Math.floor( stats.mtime.getTime() / 1000 );
					if (new_mod != old_mod) {
						print("Saving new data back into record: "+key+"\n");
						
						var json_raw = fs.readFileSync( temp_file, { encoding: 'utf8' } );
						fs.unlinkSync( temp_file );
						
						var data = JSON.parse( json_raw );
						
						storage.put( key, data, function(err, data) {
							if (err) throw err;
							print("Record successfully saved with your changes: "+key+"\n");
							
							storage.shutdown( function() {;} );
						} );
					}
					else {
						fs.unlinkSync( temp_file );
						print("File has not been changed, record was not touched: "+key+"\n");
						
						storage.shutdown( function() {;} );
					}
				} );
				
			} ); // got data
		break;
		
		case 'delete':
			// delete storage key
			// Usage: ./storage-cli.js delete users/jhuckaby
			var key = commands.shift();
			storage.delete( key, function(err, data) {
				if (err) throw err;
				print("Record '"+key+"' deleted successfully.\n");
				print("\n");
				
				storage.shutdown( function() {;} );
			} );
		break;
		
		case 'list_create':
			// create new list
			// Usage: ./storage-cli.js list_create key
			var key = commands.shift();
			storage.listCreate( key, null, function(err) {
				if (err) throw err;
				print("List created successfully: " + key + "\n");
				print("\n");
				
				storage.shutdown( function() {;} );
			} );
		break;
		
		case 'list_pop':
			// pop item off end of list
			// Usage: ./storage-cli.js list_pop key
			var key = commands.shift();
			storage.listPop( key, function(err, item) {
				if (err) throw err;
				print("Item popped off list: " + key + ": " + JSON.stringify(item, null, "\t") + "\n");
				print("\n");
				
				storage.shutdown( function() {;} );
			} );
		break;
		
		case 'list_shift':
			// pop item off front of list
			// Usage: ./storage-cli.js list_shift key
			var key = commands.shift();
			storage.listShift( key, function(err, item) {
				if (err) throw err;
				print("Item shifted off list: " + key + ": " + JSON.stringify(item, null, "\t") + "\n");
				print("\n");
				
				storage.shutdown( function() {;} );
			} );
		break;
		
		case 'list_get':
			// fetch items from list
			// Usage: ./storage-cli.js list_get key idx len
			var key = commands.shift();
			var idx = parseInt( commands.shift() || 0 );
			var len = parseInt( commands.shift() || 0 );
			storage.listGet( key, idx, len, function(err, items) {
				if (err) throw err;
				print("Got " + items.length + " items.\n");
				print("Items from list: " + key + ": " + JSON.stringify(items, null, "\t") + "\n");
				print("\n");
				
				storage.shutdown( function() {;} );
			} );
		break;
		
		case 'list_info':
			// fetch info about list
			// Usage: ./storage-cli.js list_info key
			var key = commands.shift();
			
			storage.listGetInfo( key, function(err, list) {
				if (err) throw err;
				print("List Header: " + key + ": " + JSON.stringify(list, null, "\t") + "\n\n");
				var page_idx = list.first_page;
				var item_idx = 0;
				async.whilst(
					function() { return page_idx <= list.last_page; },
					function(callback) {
						// load each page
						storage._listLoadPage(key, page_idx++, false, function(err, page) {
							if (err) return callback(err);
							print("Page " + Math.floor(page_idx - 1) + ": " + page.items.length + " items\n");
							callback();
						} ); // page loaded
					},
					function(err) {
						// all pages iterated
						if (err) throw err;
						print("\n");
						
						storage.shutdown( function() {;} );
					} // pages complete
				); // whilst
			} );
		break;
		
		case 'list_delete':
			// delete list
			// Usage: ./storage-cli.js list_delete key
			var key = commands.shift();
			storage.listDelete( key, null, function(err) {
				if (err) throw err;
				print("List deleted successfully: " + key + "\n");
				print("\n");
				
				storage.shutdown( function() {;} );
			} );
		break;
		
		case 'maint':
		case 'maintenance':
			// perform daily maintenance, specify date or defaults to current day
			// Usage: ./storage-cli.js maint 2015-05-31
			storage.runMaintenance( commands.shift(), function() {
				print( "Daily maintenance completed successfully.\n" );
				print("\n");
				
				storage.shutdown( function() {;} );
			} );
		break;
		
		case 'run':
			// run custom set of storage commands from specified file
			var file = commands.shift();
			var setup = JSON.parse( fs.readFileSync(file, 'utf8') );
			
			async.eachSeries( setup.storage,
				function(params, callback) {
					verbose( "Executing: " + JSON.stringify(params) + "\n" );
					// [ "listCreate", "global/users", { "page_size": 100 } ]
					var func = params.shift();
					params.push( callback );
					
					// call storage directly
					storage[func].apply( storage, params );
				},
				function(err) {
					if (err) throw err;
					
					print("\n");
					print( "Custom commands completed successfully!\n" );
					
					storage.shutdown( function() {;} );
				} // done
			); // eachSeries
		break;
		
		default:
			print("Unknown command: " + cmd + "\n");
			storage.shutdown( function() {;} );
		break;
		
	} // switch
});

function normalizeUsername(username) {
	// lower-case, strip all non-alpha
	if (!username) return '';
	return username.toString().toLowerCase().replace(/\W+/g, '');
};
