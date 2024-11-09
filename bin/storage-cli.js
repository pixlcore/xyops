#!/usr/bin/env node

// CLI for Storage System
// Copyright (c) 2018 - 2021 Joseph Huckaby
// Released under the MIT License

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

// make sure orchestra isn't running
var is_running = false;
var pid_file = config.log_dir + '/orchestra.pid';
try {
	var pid = fs.readFileSync(pid_file, { encoding: 'utf8' });
	is_running = process.kill( pid, 0 );
}
catch (err) {;}
if (is_running && !args.force) {
	print( "ERROR: Please stop Orchestra before running this script.\n" );
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
		case 'setup':
		case 'install':
			// setup new master server
			var setup = require('../internal/setup.json');
			var unbase_config = require('../internal/unbase.json');
			
			// make sure this is only run once
			storage.get( 'global/users', function(err) {
				if (!err) {
					print( "Storage has already been set up.  There is no need to run this command again.\n\n" );
					process.exit(1);
				}
				
				// append activity setup steps
				setup.storage.forEach( function(params) {
					if ((params[0] != 'listPush') || !setup.activity_map[params[1]] || (typeof(params[2]) != 'object')) return;
					var info = setup.activity_map[params[1]];
					var item = params[2];
					var activity = {
						id: Tools.generateShortID('a'),
						epoch: Tools.timeNow(true),
						action: info.action,
						description: item.title,
						headers: { 'user-agent': "Orchestra Setup Script" },
						keywords: [ item.id, 'admin' ],
						username: 'admin'
					};
					item.revision = 1;
					activity[ info.key ] = Tools.copyHash( item, true );
					setup.storage.push([ 'insertActivity', activity ]);
				} );
				
				// utility function for inserting activity
				var insertActivity = function(activity, callback) {
					// bootstrap activity into unbase manually
					var record_id = activity.id;
					var record_data = activity;
					var base_path = unbase_config.base_path || 'unbase';
					var index = unbase_config.indexes.activity;
					index.base_path = base_path + '/index/activity';
					var data_path = base_path + '/records/activity/' + record_id;
					
					// store data itself
					storage.put( data_path, record_data, function(err) {
						if (err) return callback(err);
						
						// now index it
						storage.indexRecord( record_id, record_data, index, function(err, state) {
							if (err) return callback(err);
							callback();
						}); // indexRecord
					}); // put
				}; // insertActivity
				
				// run setup actions
				async.eachSeries( setup.storage,
					function(params, callback) {
						verbose( "Executing: " + JSON.stringify(params) + "\n" );
						// [ "listCreate", "global/users", { "page_size": 100 } ]
						var func = params.shift();
						params.push( callback );
						
						// special functions
						if (func == 'insertActivity') return insertActivity.apply( null, params );
						
						// massage a few params
						if (typeof(params[1]) == 'object') {
							var obj = params[1];
							if (obj.created) obj.created = Tools.timeNow(true);
							if (obj.modified) obj.modified = Tools.timeNow(true);
							if (obj.regexp && (obj.regexp == '_HOSTNAME_')) obj.regexp = '^(' + Tools.escapeRegExp( hostname ) + ')$';
							if (obj.hostname && (obj.hostname == '_HOSTNAME_')) obj.hostname = hostname;
							if (obj.ip && (obj.ip == '_IP_')) obj.ip = ip;
						}
						
						// call storage directly
						storage[func].apply( storage, params );
					},
					function(err) {
						if (err) throw err;
						
						print("\n");
						print( "Setup completed successfully!\n" );
						print( "An administrator account has been created with username 'admin' and password 'admin'.\n" );
						print( "You should now be able to start the service by typing: '/opt/orchestra/bin/control.sh start'\n" );
						print( "Then, the web interface should be available at: http://"+hostname+":"+config.WebServer.http_port+"/\n\n" );
						
						storage.shutdown( function() {;} );
					}
				);
			} );
		break;
		
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
		
		case 'export':
			// export all storage data (except completed jobs, sessions)
			var file = commands.shift();
			export_data(file);
		break;
		
		case 'import':
			// import storage data from file
			var file = commands.shift();
			import_data(file);
		break;
		
		default:
			print("Unknown command: " + cmd + "\n");
			storage.shutdown( function() {;} );
		break;
		
	} // switch
});

function export_data(file) {
	// export data to file or stdout (except for completed jobs, logs, server history and sessions)
	// one record per line: KEY - JSON
	var stream = file ? fs.createWriteStream(file) : process.stdout;
	
	// file header (for humans)
	var file_header = "# Orchestra Data Export v1.0\n" + 
		"# Hostname: " + hostname + "\n" + 
		"# Date/Time: " + (new Date()).toString() + "\n" + 
		"# Format: KEY - JSON\n\n";
	
	stream.write( file_header );
	verbose_warn( file_header );
	
	if (file) verbose_warn("Exporting to file: " + file + "\n\n");
	
	// need to handle users separately, as they're stored as a list + individual records
	storage.listEach( 'global/users',
		function(item, idx, callback) {
			var username = item.username;
			var key = 'users/' + username.toString().toLowerCase().replace(/\W+/g, '');
			verbose_warn( "Exporting user: " + username + "\n" );
			
			storage.get( key, function(err, user) {
				if (err) {
					// user deleted?
					warn( "\nFailed to fetch user: " + key + ": " + err + "\n\n" );
					return callback();
				}
				
				stream.write( key + ' - ' + JSON.stringify(user) + "\n", 'utf8', callback );
			} ); // get
		},
		function(err) {
			// ignoring errors here
			// proceed to the rest of the lists
			async.eachSeries(
				[
					'global/users',
					'global/api_keys',
					'global/plugins',
					'global/categories',
					'global/groups',
					'global/events',
					'global/channels',
					'global/web_hooks',
					'global/commands',
					'global/monitors',
					'global/alerts',
					'global/tags'
				],
				function(list_key, callback) {
					// first get the list header
					verbose_warn( "Exporting list: " + list_key + "\n" );
					
					storage.get( list_key, function(err, list) {
						if (err) return callback( new Error("Failed to fetch list: " + list_key + ": " + err) );
						
						stream.write( list_key + ' - ' + JSON.stringify(list) + "\n" );
						
						// now iterate over all the list pages
						var page_idx = list.first_page;
						
						async.whilst(
							function() { return page_idx <= list.last_page; },
							function(callback) {
								// load each page
								var page_key = list_key + '/' + page_idx;
								page_idx++;
								
								verbose_warn( "Exporting list page: " + page_key + "\n");
								
								storage.get(page_key, function(err, page) {
									if (err) return callback( new Error("Failed to fetch list page: " + page_key + ": " + err) );
									
									// write page data
									stream.write( page_key + ' - ' + JSON.stringify(page) + "\n", 'utf8', callback );
								} ); // page get
							}, // iterator
							callback
						); // whilst
						
					} ); // get
				}, // iterator
				function(err) {
					if (err) {
						warn( "\nEXPORT ERROR: " + err + "\n" );
						process.exit(1);
					}
					
					verbose_warn( "\nExport completed at " + (new Date()).toString() + ".\nExiting.\n\n" );
					
					if (file) stream.end();
					
					storage.shutdown( function() { process.exit(0); } );
				} // done done
			); // list eachSeries
		} // done with users
	); // users listEach
};

function import_data(file) {
	// import storage data from specified file or stdin
	// one record per line: KEY - JSON
	print( "\nOrchestra Data Importer v1.0\n" );
	if (file) print( "Importing from file: " + file + "\n" );
	else print( "Importing from STDIN\n" );
	print( "\n" );
	
	var count = 0;
	var queue = async.queue( function(line, callback) {
		// process each line
		if (line.match(/^(\w[\w\-\.\/]*)\s+\-\s+(\{.+\})\s*$/)) {
			var key = RegExp.$1;
			var json_raw = RegExp.$2;
			print( "Importing record: " + key + "\n" );
			
			var data = null;
			try { data = JSON.parse(json_raw); }
			catch (err) {
				warn( "Failed to parse JSON for key: " + key + ": " + err + "\n" );
				return callback();
			}
			
			storage.put( key, data, function(err) {
				if (err) {
					warn( "Failed to store record: " + key + ": " + err + "\n" );
					return callback();
				}
				count++;
				callback();
			} );
		}
		else callback();
	}, 1 );
	
	// setup readline to line-read from file or stdin
	var readline = require('readline');
	var rl = readline.createInterface({
		input: file ? fs.createReadStream(file) : process.stdin
	});
	
	rl.on('line', function(line) {
		// enqueue each line
		queue.push( line );
	});
	
	rl.on('close', function() {
		// end of input stream
		var complete = function() {
			// finally, delete state so orchestra recreates it
			storage.delete( 'global/state', function(err) {
				// ignore error here, as state may not exist yet
				print( "\nImport complete. " + count + " records imported.\nExiting.\n\n" );
				storage.shutdown( function() { process.exit(0); } );
			});
		};
		
		// fire complete on queue drain
		if (queue.idle()) complete();
		else queue.drain = complete;
	}); // rl close
};

function normalizeUsername(username) {
	// lower-case, strip all non-alpha
	if (!username) return '';
	return username.toString().toLowerCase().replace(/\W+/g, '');
};
