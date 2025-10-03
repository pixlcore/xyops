// Fancy Echo / REPL tools for xyOps
// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the PixlCore Sustainable Use License.
// See the LICENSE.md file in this repository.

const cli = require('pixl-cli');
const chalk = cli.chalk;
const Tools = cli.Tools;

const main_color = "#008FFB";
const hex_colors = ["#00E396", "#FEB019", "#FF4560", "#775DD0", "#3F51B5", "#4CAF50", "#546E7A", "#D4526E", "#A5978B", "#C7F464", "#81D4FA", "#2B908F", "#F9A3A4", "#90EE7E", "#FA4443", "#449DD1", "#F86624", "#69D2E7", "#EA3546", "#662E9B", "#C5D86D", "#D7263D", "#1B998B", "#2E294E", "#F46036", "#E2C044", "#662E9B", "#F86624", "#F9C80E", "#EA3546", "#43BCCD", "#5C4742", "#A5978B", "#8D5B4C", "#5A2A27", "#C4BBAF", "#A300D6", "#7D02EB", "#5653FE", "#2983FF", "#00B1F2", "#03A9F4", "#33B2DF", "#4ECDC4", "#13D8AA", "#FD6A6A", "#F9CE1D", "#FF9800"];
const comp_colors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
const color_cache = {};
const sep = chalk.gray(" | ");

function getComponentColor(name) {
	// get different-ish colors per component
	if (color_cache[name]) return color_cache[name];
	
	var comp_id = parseInt( Tools.digestHex( name, 'md5' ).substring(0, 8), 16 );
	
	if (chalk.level >= 2) {
		// 256+ color terminal
		var color = hex_colors[ comp_id % hex_colors.length ];
		if (name === 'xyOps') color = main_color; // special color for orch cat
		color_cache[name] = chalk.hex(color);
	}
	else {
		// 16 color terminal
		var color = comp_colors[ comp_id % comp_colors.length ];
		color_cache[name] = chalk[color];
	}
	
	return color_cache[name];
};

function ellipsis(text, max_len) {
	// add ellipsis to text if over N length
	text = '' + text;
	if (cli.stringWidth(text) >= max_len) {
		return text.substring(0, max_len - 1) + '…';
	}
	else return text;
};

exports.setup = function(server) {
	// setup echo hooks
	var cats = { all: 1 };
	
	if (server.echo && (typeof(server.echo) == 'string') && !server.echo.match(/^(1|true|enabled)$/)) {
		// echo custom categories/components only
		delete cats.all;
		server.echo.trim().split(/\s+/).forEach( function(cat) { cats[cat] = 1; } );
	}
	
	if (server.echo) cli.print("\n");
	
	server.echoer = function(line, cols, args) {
		// custom fancy log echo
		if (!cats.all && !cats[args.category] && !cats[args.component]) return; // echo filter
		
		var clr = getComponentColor(args.component);
		var msg = chalk.gray("| ");
		
		switch (args.category) {
			case 'error':
				msg += "❌ " + chalk.red.bold("Error") + chalk.gray(" > ") + clr(args.component) + sep + chalk.bold(args.code) + sep + args.msg;
			break;
			
			case 'transaction':
				msg += "✅ " + chalk.green.bold(args.component) + chalk.gray(" > ") + chalk.bold(args.code) + sep + args.msg;
			break;
			
			default:
				msg += clr.bold(args.component) + chalk.gray(" > ") + clr(args.msg);
			break;
		}
		
		if (args.data) msg += sep + chalk.gray( JSON.stringify(args.data) );
		msg += "\n";
		
		process.stdout.write(msg);
	};
	
	server.on('master', function() {
		// server has become master
		
		// custom info box (if echo is on)
		if (server.echo && server.WebServer && server.config.get('repl')) {
			var web = server.WebServer;
			var stats = web.getStats();
			var text = '';
			var is_localhost = true;
			
			var clr = getComponentColor("WebServer");
			text += clr.bold("Web Server Listeners:") + "\n";
			
			stats.listeners.forEach( function(info) {
				// {"address":"::1","family":"IPv6","port":3013,"ssl":true}
				var type = info.ssl ? 'HTTPS' : 'HTTP';
				var host = info.address;
				text += `\nListening for ${chalk.yellow.bold(type)} on port ${chalk.green.bold(info.port)}, network '${chalk.red.bold(info.address)}'`;
				
				switch (info.address) {
					case '::1':
					case '127.0.0.1':
						text += ' (localhost)';
						host = 'localhost';
					break;
					
					case '::':
					case '0.0.0.0':
						text += ' (all)';
						host = server.ip; // best guess (ipv4)
						is_localhost = false;
					break;
				}
				
				text += "\n";
				var url = (info.ssl ? 'https://' : 'http://') + host;
				if (info.ssl && (info.port != 443)) url += ':' + info.port;
				if (!info.ssl & (info.port != 80)) url += ':' + info.port;
				url += '/';
				text += "--> " + chalk.cyan.bold(url) + "\n";
			} );
			
			// debug_bind_local
			if (server.debug && web.config.get('debug_bind_local') && is_localhost && !server.config.get('expose')) {
				text += "\n" + chalk.green("Relaunch with ") + chalk.yellow.bold("--expose") + chalk.green(" to open access to the network.") + "\n";
			}
			
			cli.println( "\n" + cli.box(text.trim(), { indent: 2, hspace: 2, vspace: 1 }) + "\n" );
		} // echo
		
		if (server.config.get('repl')) {
			// optional REPL with access to server and components
			var repl = server.repl = require('repl').start({ prompt: '> ', useGlobal: true, ignoreUndefined: true });
			
			repl.context.server = server;
			repl.context.cli = cli;
			repl.context.xy = Tools.findObject( server.components, { __name: 'xyOps' } );
			
			server.components.forEach( function(comp) {
				if (comp.__name) repl.context[ comp.__name ] = comp;
			} );
			
			repl.defineCommand('echo', {
				help: "Add or remove echo categories: .echo add Storage",
				action: function(cmd) {
					this.clearBufferedCommand();
					
					if (cmd.match(/^add\s+(.+)$/)) {
						RegExp.$1.split(/\s+/).forEach( function(cat) {
							cat = cat.trim();
							cats[cat] = 1;
							cli.println( cli.bold("Added echo category: ") + cat );
							
							if (cats.all && (cat !== 'all')) delete cats.all;
						} );
					}
					else if (cmd.match(/^remove\s+(.+)$/)) {
						RegExp.$1.split(/\s+/).forEach( function(cat) {
							cat = cat.trim();
							delete cats[cat];
							cli.println( cli.bold("Removed echo category: ") + cat );
						} );
					}
					else {
						cli.println( cli.bold("Unknown command syntax: ") + cmd );
					}
					
					this.displayPrompt();
				} // action
			} ); // defineCommand
			
			repl.defineCommand('notify', {
				help: "Send a notification to all users: .notify HI THERE",
				action: function(cmd) {
					this.clearBufferedCommand();
					
					var data = {
						type: 'info',
						message: cmd || "This is a test notification.",
						sound: Tools.randArray( server.xyOps.sounds ),
						loc: ""
					};
					server.xyOps.doUserBroadcastAll('notify', data);
					
					cli.println( cli.bold("Notification sent to all users: ") + JSON.stringify(data) );
					
					this.displayPrompt();
				} // action
			} ); // defineCommand
			
			repl.on('exit', function() { 
				delete server.repl; 
				if (!server.shut) server.shutdown(); 
			} );
		}
	}); // master
	
	server.on('shutdown', function() {
		if (server.repl) server.repl.close();
		if (server.echo) cli.print("\n");
	});
	
};
