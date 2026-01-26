// xyOps Auto Installer
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// https://github.com/pixlcore/xyops/blob/main/LICENSE.md

// To install, issue this command as root:
// curl -s "https://raw.githubusercontent.com/pixlcore/xyops/main/bin/install.js" | node

var path = require('path');
var fs = require('fs');
var util = require('util');
var os = require('os');
var cp = require('child_process');

var installer_version = '1.0';
var base_dir = '/opt/xyops';
var log_dir = base_dir + '/logs';
var log_file = '';
var gh_repo_url = 'http://github.com/pixlcore/xyops';
var gh_releases_url = 'https://api.github.com/repos/pixlcore/xyops/releases';

// Check if Node.js version is old
if (process.version.match(/^v?(\d+)/) && (parseInt(RegExp.$1) < 16) && !process.env['XYOPS_OLD']) {
	console.error("\nERROR: You are using an incompatible version of Node.js (" + process.version + ").  Please upgrade to v16 or later.  Instructions: https://nodejs.org/en/download/\n\nTo ignore this error and run unsafely, set an XYOPS_OLD environment variable.  Do this at your own risk.\n");
	process.exit(1);
}

// Error out if we have low memory
if ((os.totalmem() < 64 * 1024 * 1024) && !process.env['XYOPS_DANGER']) {
	console.error("\nERROR: The current machine has less than 64 MB of total RAM.  xyOps will likely fail to install successfully under such low memory conditions.\n\nTo ignore this error and attempt the install anyway, set a XYOPS_DANGER environment variable.  Do this at your own risk.\n");
	process.exit(1);
}

// make sure we have NPM available
try { cp.execSync('which npm'); }
catch (err) {
	console.error("\nERROR: NPM cannot be found.  xyOps requires both Node.js and NPM to be preinstalled.  Instructions: https://nodejs.org/en/download/\n");
	process.exit(1);
}

var print = function(msg) { 
	process.stdout.write(msg); 
	if (log_file) fs.appendFileSync(log_file, msg);
};
var warn = function(msg) { 
	process.stderr.write(msg); 
	if (log_file) fs.appendFileSync(log_file, msg);
};
var die = function(msg) {
	warn( "\nERROR: " + msg.trim() + "\n\n" );
	process.exit(1);
};
var logonly = function(msg) {
	if (log_file) fs.appendFileSync(log_file, msg);
};

// create base and log directories
if (!fs.existsSync(base_dir)) {
	try { cp.execSync( "mkdir -p " + base_dir + " && chmod 775 " + base_dir ); }
	catch (err) { die("Failed to create base directory: " + base_dir + ": " + err); }

	try { cp.execSync( "mkdir -p " + log_dir + " && chmod 775 " + log_dir ); }
	catch (err) { die("Failed to create log directory: " + log_dir + ": " + err); }
}

// start logging from this point onward
log_file = log_dir + '/install.log';
logonly( "\nStarting install run: " + (new Date()).toString() + "\n" );

print( 
	"\n" + "xyOps Installer v" + installer_version + "\n" + 
	"Copyright (c) 2026 PixlCore.com. BSD 3-Clause License.\n" + 
	"Log File: " + log_file + "\n\n" 
);

process.chdir( base_dir );

var is_preinstalled = false;
var cur_version = '';
var new_version = process.argv[2] || '';

try {
	var stats = fs.statSync( base_dir + '/package.json' );
	var json = require( base_dir + '/package.json' );
	if (json && json.version) {
		cur_version = 'v' + json.version;
		is_preinstalled = true;
	}
}
catch (err) {;}

var is_running = false;
var is_container = false;
if (is_preinstalled) {
	var pid_file = log_dir + '/xyops.pid';
	try {
		var pid = fs.readFileSync(pid_file, { encoding: 'utf8' });
		is_running = process.kill( pid, 0 );
	}
	catch (err) {;}
}

// if we're in foreground mode via env var (i.e. docker) assume process is not running
// (docker's `--restart unless-stopped` should restart the service)
if (process.env['XYOPS_foreground']) {
	is_running = false;
	is_container = true;
}

print( "Fetching release list...\n");
logonly( "Releases URL: " + gh_releases_url + "\n" );

cp.exec('curl -s ' + gh_releases_url, function (err, stdout, stderr) {
	if (err) {
		print( stdout.toString() );
		warn( stderr.toString() );
		die("Failed to fetch release list: " + gh_releases_url + ": " + err);
	}
	
	var releases = null;
	try { releases = JSON.parse( stdout.toString() ); }
	catch (err) {
		die("Failed to parse JSON from GitHub: " + gh_releases_url + ": " + err);
	}
	
	if (!Array.isArray(releases)) die("Unexpected response from GitHub Releases API: " + gh_releases_url + ": Not an array");
	
	var release = null;
	for (var idx = 0, len = releases.length; idx < len; idx++) {
		var rel = releases[idx];
		var ver = rel.tag_name;
		rel.version = ver;
		
		if (!new_version || (ver == new_version)) { 
			release = rel; 
			new_version = ver; 
			idx = len; 
		}
	} // foreach release
	
	if (!release) {
		// no release found
		if (!new_version) die("No releases found!");
		else die("Release not found: " + new_version);
	}
	
	// proceed with installation
	if (is_preinstalled) print("Upgrading xyOps from " + cur_version + " to " + new_version + "...\n");
	else print("Installing xyOps " + new_version + "...\n");
	
	if (is_running) {
		print("\n");
		try { cp.execSync( base_dir + "/bin/control.sh stop", { stdio: 'inherit' } ); }
		catch (err) { die("Failed to stop xyOps: " + err); }
		print("\n");
	}
	
	// download tarball and expand into current directory
	var tarball_url = release.tarball_url;
	logonly( "Tarball URL: " + tarball_url + "\n" );
	
	cp.exec('curl -L ' + tarball_url + ' | tar zxf - --strip-components 1', function (err, stdout, stderr) {
		if (err) {
			print( stdout.toString() );
			warn( stderr.toString() );
			die("Failed to download release: " + tarball_url + ": " + err);
		}
		else {
			logonly( stdout.toString() + stderr.toString() );
		}
		
		try {
			var stats = fs.statSync( base_dir + '/package.json' );
			var json = require( base_dir + '/package.json' );
		}
		catch (err) {
			die("Failed to download package: " + tarball_url + ": " + err);
		}
		
		print( is_preinstalled ? "Updating dependencies...\n" : "Installing dependencies...\n");
		
		var npm_cmd = "npm install";
		logonly( "Executing command: " + npm_cmd + "\n" );
		
		// install dependencies via npm
		cp.exec(npm_cmd, function (err, stdout, stderr) {
			if (err) {
				print( stdout.toString() );
				warn( stderr.toString() );
				die("Failed to install dependencies: " + err);
			}
			else {
				logonly( stdout.toString() + stderr.toString() );
			}
			
			print("Running post-install script...\n");
			logonly( "Executing command: node bin/build.js dist\n" );
			
			// finally, run postinstall script
			cp.exec('node bin/build.js dist', function (err, stdout, stderr) {
				if (is_preinstalled) {
					// for upgrades only print output on error
					if (err) {
						print( stdout.toString() );
						warn( stderr.toString() );
						die("Failed to run post-install: " + err);
					}
					else {
						print("Upgrade complete.\n\n");
						
						if (is_running) {
							try { cp.execSync( base_dir + "/bin/control.sh start", { stdio: 'inherit' } ); }
							catch (err) { die("Failed to start xyOps: " + err); }
							print("\n");
						}
						else if (is_container) {
							// special container mode -- EXIT the service after upgrade (docker should restart it)
							try { cp.execSync( base_dir + "/bin/control.sh stop", { stdio: 'inherit' } ); }
							catch (err) { die("Failed to stop xyOps service: " + err); }
							print("\n");
						}
					}
				} // upgrade
				else {
					// first time install, always print output
					print( stdout.toString() );
					warn( stderr.toString() );
					
					if (err) {
						die("Failed to run post-install: " + err);
					}
					else {
						print("Installation complete.\n\n");
					}
				} // first install
				
				logonly( "Completed install run: " + (new Date()).toString() + "\n" );
				
				process.exit(0);
			} ); // build.js
		} ); // npm
	} ); // download
} ); // releases api
