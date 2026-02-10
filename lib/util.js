// xyOps Server Utilities
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const Path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const assert = require("assert");
const async = require("async");
const WebSocket = require('ws');
const Tools = require("pixl-tools");
const jexl = require('jexl');
const sanitizeHtml = require('sanitize-html');

jexl.addFunction('min', Math.min);
jexl.addFunction('max', Math.max);
jexl.addFunction('floor', Math.floor);
jexl.addFunction('ceil', Math.ceil);
jexl.addFunction('round', Math.round);
jexl.addFunction('clamp', Tools.clamp);

jexl.addFunction('bytes', function(value) { return Tools.getTextFromBytes( parseInt(value) ); } );
jexl.addFunction('number', function(value) { return (new Intl.NumberFormat()).format(value || 0); } );
jexl.addFunction('pct', function(value, max, floor) { return Tools.pct( value, max || 100, floor || false ); } );
jexl.addFunction('integer', function(value) { return parseInt(value); } );
jexl.addFunction('float', function(value) { return Tools.shortFloat(value); } );
jexl.addFunction('stringify', function(value) { return JSON.stringify(value); } );
jexl.addFunction('encode', function(value) { return encodeURIComponent(value); } );
jexl.addFunction('count', function(arr) { return arr ? arr.length : 0; } );

jexl.addFunction('find', function(coll, key, value) {
	// find object in array by substring match in given key
	return coll.filter( function(item) { return !!(''+item[key]).includes(value); } );
});

class Util {
	
	messageSub(text, data, undef = "", filter = null) {
		// perform placeholder substitution on all {{macros}} and run each through jexl
		while (text.match(/\{\{(.+?)\}\}/)) {
			text = text.replace(/\{\{(.+?)\}\}/g, function(m_all, m_g1) {
				var value = '';
				try { value = jexl.evalSync( m_g1, data ); }
				catch (err) { value = '(ERROR)'; }
				if (value === undefined) value = undef;
				if (filter) value = filter(value);
				if (typeof(value) == 'object') value = JSON.stringify(value).replace(/\{\{(.+?)\}\}/g, '$1');
				return value;
			});
		}
		return text;
	}
	
	sanitizeMarkdown(md) {
		// use sanitize-html to clean markdown
		// we need to fix blockquotes that are entitized
		return sanitizeHtml( md, this.config.getPath('ui.sanitize_html_config') ).replace(/(^|\n)\&gt\;/g, '$1>');
	}
	
	cleanFilename(filename) {
		// clean up filename, converting all but safe characters to underscores
		return filename.replace(/[^\w\-\+\.\,\s\(\)\[\]\{\}\'\"\!\&\^\%\$\#\@\*\?\~]+/g, '_');
	}
	
	cleanURLFilename(filename) {
		// clean filename for use in URLs, convert bad chars to underscores, and convert to lower-case
		return filename.replace(/[^\w\-\.]+/g, '_').toLowerCase();
	}
	
	cleanEnv() {
		// make copy and strip sensitive keys from env, for passing to plugin processes
		var env = Tools.copyHash(process.env);
		
		for (var key in env) {
			if (key.match(/^XYOPS_/)) delete env[key];
		}
		
		return env;
	}
	
	toTitleCase(str) {
		// capitalize each word
		return str.toLowerCase().replace(/\b\w/g, function (txt) { return txt.toUpperCase(); });
	}
	
	isArrayDiff(a, b) {
		// determine array difference using sort/SHA256 method
		// i.e. arrays may have same items in different order (not considered diff)
		if (!a) a = []; else a = JSON.parse(JSON.stringify(a)).sort();
		if (!b) b = []; else b = JSON.parse(JSON.stringify(b)).sort();
		return( Tools.digestHex(JSON.stringify(a)) != Tools.digestHex(JSON.stringify(b)) );
	}
	
	loadMultipleUsers(usernames, callback) {
		// load multiple users and/or roles for action use
		// DO NOT FAIL if one or more users are nonexistent (holes are removed from response)
		var self = this;
		var records = {};
		
		// create array of paths to user records
		var keys = [];
		for (var idx = 0, len = usernames.length; idx < len; idx++) {
			keys.push( 'users/' + this.usermgr.normalizeUsername(usernames[idx]) );
		}
		
		async.eachLimit(keys, this.storage.concurrency, 
			function(key, callback) {
				// iterator for each key
				self.storage.get(key, function(err, data) {
					if (err) return callback(); // ignore errors
					records[key] = data;
					callback();
				} );
			}, 
			function() {
				// sort records into array of values ordered by keys
				var users = [];
				for (var idx = 0, len = keys.length; idx < len; idx++) {
					if (records[keys[idx]]) users.push( records[keys[idx]] );
				}
				
				callback(null, users);
			}
		); // eachLimit
	}
	
	updateConfigOverrides(overrides, callback) {
		// update config overrides in memory and on disk
		var self = this;
		var secret_key = this.config.get('secret_key');
		var co_file = this.config.get('config_overrides_file');
		
		if (!callback) callback = function() {};
		if (!co_file) return callback(); // sanity
		
		this.logDebug(5, "Updating config overrides", { keys: Object.keys(overrides) } );
		
		// we may need to create it
		if (!this.server.configOverrides) this.server.configOverrides = {};
		
		// update config copy in memory
		for (var key in overrides) {
			this.server.config.setPath(key, overrides[key]);
			this.server.configOverrides[key] = overrides[key];
		}
		
		// let all peers know (if we are master)
		if (this.master) {
			// encrypt overrides for peer transport
			var record = this.encryptSecret( this.server.configOverrides, secret_key );
			
			this.peers.forEach( function(peer) {
				if (!peer.socket) return;
				peer.socket.send('configOverrides', record);
			});
		} // master
		
		// save file to disk
		Tools.writeFileAtomic( co_file, JSON.stringify(this.server.configOverrides, null, "\t") + "\n", callback );
	}
	
	convertCronicleDataFile(opts, callback) {
		// convert cronicle export file to xyops compatible file in place
		var self = this;
		var { temp_file, report, job, user } = opts;
		var out_file = Path.join( os.tmpdir(), 'xyops-cronicle-temp-' + Tools.generateShortID() + '.txt' );
		var now = Tools.timeNow(true);
		var default_tz = this.config.get('tz') || Intl.DateTimeFormat().resolvedOptions().timeZone;
		var priv_list = this.config.getPath('ui.privilege_list');
		var hooks = [];
		var hook_template = {
			"id": "",
			"title": "",
			"enabled": true,
			"url": "",
			"method": "POST",
			"headers": [
				{ "name": "Content-Type", "value": "application/json" },
				{ "name": "User-Agent", "value": "xyOps/WebHook" }
			],
			"body": "{\n\t\"text\": \"{{text}}\",\n\t\"content\": \"{{text}}\",\n\t\"message\": \"{{text}}\"\n}",
			"timeout": 30,
			"retries": 0,
			"follow": false,
			"ssl_cert_bypass": false,
			"notes": "Imported from Cronicle.",
			"icon": "",
			"username": "",
			"modified": now,
			"created": now
		};
		
		this.logDebug(6, "Converting Cronicle data file: " + temp_file);
		
		// write file header
		fs.appendFileSync( out_file, [
			`# xyOps Data Export v1.0`,
			`# Hostname: ${os.hostname()}`,
			`# Date/Time: ${(new Date()).toString()}`,
			`# Format: NDJSON`
		].join("\n") + "\n\n");
		
		var appendData = function(data) {
			// append data to file
			fs.appendFileSync( out_file, JSON.stringify(data) + "\n" );
		};
		
		var appendList = function(data) {
			// append list header to file, with pre-delete cmd
			appendData({ "cmd": "listDelete", "args": [data.key, false] });
			appendData(data);
		};
		
		var addHook = function(overrides) {
			// add web hook to be list-ified at the end
			var hook = Tools.mergeHashes( Tools.copyHash(hook_template, true), overrides );
			
			// extract inline URL headers and add as real headers
			hook.url = hook.url.replace(/\s*\[header\:\s*([\w\-]+)\:\s*([^\]]+)\]/ig, function(m_all, m_g1, m_g2) {
				var header = Tools.findObject( hook.headers, { name: m_g1 } );
				if (header) header.value = m_g2;
				else hook.headers.push({ name: m_g1, value: m_g2 });
				return '';
			}).trim();
			
			hooks.push(hook);
		};
		
		var convertPrivs = function(user) {
			// convert cronicle privs to xyops, inc. cat and grp restrictions
			if (!user.privileges) user.privileges = {};
			var old_privs = user.privileges;
			
			user.privileges = {};
			var new_privs = user.privileges;
			
			if (old_privs.admin) {
				new_privs.admin = true;
				return;
			}
			
			for (var key in old_privs) {
				if (old_privs[key] && Tools.findObject(priv_list, { id: key })) new_privs[key] = true;
			}
			
			// some priv ids have been renamed
			if (old_privs.run_events) new_privs.run_jobs = true;
			if (old_privs.abort_events) new_privs.abort_jobs = true;
			
			// category restrictions
			if (old_privs.cat_limit) {
				user.categories = [];
				for (var key in old_privs) {
					if ((key != 'cat_limit') && key.match(/^cat_(\w+)$/)) {
						user.categories.push( RegExp.$1 );
					}
				}
			}
			
			// group restrictions
			if (old_privs.grp_limit) {
				user.groups = [];
				for (var key in old_privs) {
					if ((key != 'grp_limit') && key.match(/^grp_(\w+)$/)) {
						user.groups.push( RegExp.$1 );
					}
				}
			}
		}; // convertPrivs
		
		var convertUser = function(key, value) {
			// convert single user
			var user = Tools.mergeHashes( self.config.get('default_user_prefs'), value );
			user.roles = [];
			convertPrivs( user );
			appendData({ key, value: user });
		}; // convertUser
		
		var convertAPIKeyPage = function(key, value) {
			// convert list page of api keys
			value.items.forEach( function(api_key, idx) {
				// {"privileges":{"admin":1},"key":"****","active":"1","title":"test","description":"test","id":"klpbl6fqh01","username":"admin","modified":1700767704,"created":1700767704}
				if (typeof(api_key.active) == 'string') { api_key.active = parseInt(api_key.active); }
				api_key.roles = [];
				api_key.revision = 1;
				convertPrivs( api_key );
			});
			
			appendData({ key, value });
		}; // convertAPIKeyPage
		
		var convertPluginPage = function(key, value) {
			// convert list page of plugins
			value.items.forEach( function(plugin) {
				// built-in http plugin's id has changed since cronicle
				if (plugin.id == 'urlplug') plugin.id = 'httpplug';
				
				// look for built-in plugin, inherit props if found
				var xyplug = Tools.findObject( self.plugins, { id: plugin.id } );
				if (xyplug) Tools.mergeHashInto( plugin, xyplug );
				
				plugin.type = 'event';
				plugin.revision = 1;
				plugin.icon = '';
				plugin.kill = 'parent';
				
				// plugins may be copies of old cronicle defaults -- map commands as necessary
				switch (plugin.command) {
					case 'bin/shell-plugin.js': plugin.command = '[shell-plugin]'; break;
					case 'bin/test-plugin.js': plugin.command = '[test-plugin]'; break;
					case 'bin/http-plugin.js': plugin.command = '[http-plugin]'; break;
				}
			} );
			
			appendData({ key, value });
		}; // convertPluginPage
		
		var convertCategoryPage = function(key, value) {
			// convert list page of categories
			value.items.forEach( function(cat, idx) {
				cat.enabled = !!cat.enabled;
				cat.sort_order = idx;
				cat.notes = cat.description; delete cat.description;
				cat.icon = '';
				cat.color = cat.color || 'plain';
				cat.limits = [];
				cat.actions = [];
				cat.revision = 1;
				
				if (cat.max_children) {
					cat.limits.push({ "type": "job", "enabled": true, "amount": cat.max_children });
					delete cat.max_children;
				}
				if (cat.log_max_size) {
					cat.limits.push({ "type": "log", "enabled": true, "amount": cat.log_max_size });
					delete cat.log_max_size;
				}
				if (cat.cpu_limit) {
					cat.limits.push({ "type": "cpu", "enabled": true, "amount": cat.cpu_limit, "duration": cat.cpu_sustain || 0 });
					delete cat.cpu_limit;
					delete cat.cpu_sustain;
				}
				if (cat.memory_limit) {
					cat.limits.push({ "type": "mem", "enabled": true, "amount": cat.memory_limit, "duration": cat.memory_sustain || 0 });
					delete cat.memory_limit;
					delete cat.memory_sustain;
				}
				if (cat.notify_success) {
					cat.actions.push({ "enabled": true, "type": "email", "condition": "success", "users": [], "email": cat.notify_success });
					delete cat.notify_success;
				}
				if (cat.notify_fail) {
					cat.actions.push({ "enabled": true, "type": "email", "condition": "error", "users": [], "email": cat.notify_fail });
					delete cat.notify_fail;
				}
				if (cat.web_hook) {
					var hook_id = Tools.generateShortID('w');
					addHook({ id: hook_id, title: "Web Hook For " + cat.title, url: cat.web_hook, username: cat.username });
					cat.actions.push({ "enabled": true, "type": "web_hook", "condition": "complete", "web_hook": hook_id, "text": "" });
					delete cat.web_hook;
				}
			}); // foreach item
			appendData({ key, value });
		}; // convertCategoryPage
		
		var convertGroupPage = function(key, value) {
			// convert list page of groups
			value.items.forEach( function(group, idx) {
				// {"id":"maingrp","title":"Main Group","regexp":"m2ni","master":1}
				// {"id":"main","title":"Main Group","hostname_match":".+","sort_order":0,"username":"admin","modified":1754365754,"created":1754365754,"revision":1}
				group.hostname_match = group.regexp; delete group.regexp;
				group.sort_order = idx;
				group.icon = '';
				group.username = user.username;
				group.created = now;
				group.modified = now;
				group.revision = 1;
			} );
			appendData({ key, value });
		}; // convertGroupPage
		
		var convertEventPage = function(key, value) {
			// convert list page of events
			value.items.forEach( function(event, idx) {
				// event.enabled means different things in cronicle vs. xyops:
				// - in cronicle it means "scheduler disabled but manual runs still okay"
				// - in xyops it means "fully disabled in every way"
				var enabled = !!event.enabled;
				event.enabled = true;
				event.icon = '';
				event.limits = [];
				event.actions = [];
				event.triggers = [{ "type": "manual", "enabled": true }];
				event.fields = [];
				event.revision = 1;
				
				// built-in http plugin's id has changed since cronicle
				if (event.plugin == 'urlplug') event.plugin = 'httpplug';
				
				// convert timing to schedule trigger
				if (event.timing) {
					var timing = event.timing;
					timing.enabled = enabled;
					timing.type = 'schedule';
					if (event.timezone && (event.timezone != default_tz)) {
						timing.timezone = event.timezone;
					}
					event.triggers.push(timing);
				}
				delete event.timing;
				delete event.timezone;
				
				// cronicle events may target a server by its hostname
				var server = Tools.findObject( self.servers, { hostname: event.target } );
				if (server) event.targets = [ server.id ];
				else event.targets = [ event.target ];
				delete event.target;
				
				if (event.timeout) {
					event.limits.push({ "type": "time", "enabled": true, "duration": event.timeout });
					delete event.timeout;
				}
				if (event.catch_up) {
					event.triggers.push({ "type": "catchup", "enabled": true });
					delete event.catch_up;
				}
				if (event.retries) {
					event.limits.push({ "type": "retry", "enabled": true, "amount": event.retries, "duration": event.retry_delay || 0 });
					delete event.retries;
					delete event.retry_delay;
				}
				if (event.queue && event.queue_max) {
					event.limits.push({ "type": "queue", "enabled": true, "amount": event.queue_max });
					delete event.queue;
					delete event.queue_max;
				}
				if (event.chain) {
					event.actions.push({ condition: 'success', type: 'run_event', event_id: event.chain, enabled: true });
					delete event.chain;
				}
				if (event.chain_error) {
					event.actions.push({ condition: 'error', type: 'run_event', event_id: event.chain_error, enabled: true });
					delete event.chain_error;
				}
				if (event.max_children) {
					event.limits.push({ "type": "job", "enabled": true, "amount": event.max_children });
					delete event.max_children;
				}
				if (event.log_max_size) {
					event.limits.push({ "type": "log", "enabled": true, "amount": event.log_max_size });
					delete event.log_max_size;
				}
				if (event.cpu_limit) {
					event.limits.push({ "type": "cpu", "enabled": true, "amount": event.cpu_limit, "duration": event.cpu_sustain || 0 });
					delete event.cpu_limit;
					delete event.cpu_sustain;
				}
				if (event.memory_limit) {
					event.limits.push({ "type": "mem", "enabled": true, "amount": event.memory_limit, "duration": event.memory_sustain || 0 });
					delete event.memory_limit;
					delete event.memory_sustain;
				}
				if (event.notify_success) {
					event.actions.push({ "enabled": true, "type": "email", "condition": "success", "users": [], "email": event.notify_success });
					delete event.notify_success;
				}
				if (event.notify_fail) {
					event.actions.push({ "enabled": true, "type": "email", "condition": "error", "users": [], "email": event.notify_fail });
					delete event.notify_fail;
				}
				if (event.web_hook) {
					var hook_id = Tools.generateShortID('w');
					addHook({ id: hook_id, title: "Web Hook For " + event.title, url: event.web_hook, username: event.username });
					event.actions.push({ "enabled": true, "type": "web_hook", "condition": "complete", "web_hook": hook_id, "text": "" });
					delete event.web_hook;
				}
				
				// convert multiplex to workflow
				if (event.multiplex) {
					event.type = 'workflow';
					var workflow = event.workflow = {};
					workflow.nodes = [];
					workflow.connections = [];
					
					var mplex_node = {
						id: Tools.generateShortID('n'),
						type: "controller",
						x: 250,
						y: 100,
						data: {
							controller: "multiplex",
							stagger: event.stagger || 0,
							continue: 100
						}
					};
					
					var job_node = {
						id: Tools.generateShortID('n'),
						type: "job",
						x: 500,
						y: 0,
						data: {
							label: "",
							icon: "",
							category: event.category,
							targets: event.targets,
							algo: event.algo,
							plugin: event.plugin,
							params: event.params
						}
					};
					
					event.triggers.forEach( function(trigger, idx) {
						var trig_node = {
							id: Tools.generateShortID('n'),
							type: "trigger",
							x: 0,
							y: (event.triggers.length == 1) ? 100 : (50 + (idx * 128))
						};
						workflow.nodes.push(trig_node);
						trigger.id = trig_node.id;
						workflow.connections.push({
							id: Tools.generateShortID('c'),
							source: trig_node.id,
							dest: mplex_node.id
						});
					} );
					
					workflow.nodes.push(mplex_node);
					workflow.nodes.push(job_node);
					
					workflow.connections.push({
						id: Tools.generateShortID('c'),
						source: mplex_node.id,
						dest: job_node.id
					});
					
					delete event.targets;
					delete event.algo;
					delete event.plugin;
					delete event.params;
					
					event.plugin = "_workflow";
				} // multiplex workflow
				
				delete event.multiplex;
				delete event.stagger;
			}); // foreach event
			
			appendData({ key, value });
		}; // convertEventPage
		
		Tools.fileEachLine( temp_file, { buffer_size: 32 * 1024 },
			function(line, callback) {
				if (!line.match(/^(\w[\w\-\.\/]*)\s+\-\s+(\{.+\})\s*$/)) return callback();
				var key = RegExp.$1;
				var json_raw = RegExp.$2;
				var value = null;
				
				try { value = JSON.parse(json_raw); }
				catch (err) {
					return callback( new Error("Failed to parse Cronicle JSON: " + err) );
				}
				
				try {
					if (key.match(/^users\//)) convertUser(key, value);
					else if (key.match(/^global\/users/)) appendList({ key, value }); // passthru
					else if (key.match(/^global\/plugins$/)) appendList({ key, value }); // passthru
					else if (key.match(/^global\/plugins\/\-?\d+$/)) convertPluginPage(key, value);
					else if (key.match(/^global\/categories$/)) appendList({ key, value }); // passthru
					else if (key.match(/^global\/categories\/\-?\d+$/)) convertCategoryPage(key, value);
					else if (key.match(/^global\/server_groups$/)) appendList({ key: 'global/groups', value }); // rename
					else if (key.match(/^global\/server_groups\/(\-?\d+)$/)) convertGroupPage('global/groups/' + RegExp.$1, value);
					else if (key.match(/^global\/schedule$/)) appendList({ key: 'global/events', value }); // rename
					else if (key.match(/^global\/schedule\/(\-?\d+)$/)) convertEventPage('global/events/' + RegExp.$1, value);
					else if (key.match(/^global\/api_keys$/)) appendList({ key, value }); // passthru
					else if (key.match(/^global\/api_keys\/\-?\d+$/)) convertAPIKeyPage(key, value);
				}
				catch (err) {
					return callback( err );
				}
				
				callback();
			},
			function(err) {
				if (err) return callback( new Error("Failed to import Cronicle data: " + err) );
				
				// add hooks as storage list
				if (hooks.length) {
					// preserve sample hook
					addHook({ "id": "example_hook", "title": "Example Hook", "url": "https://httpbin.org/post", "notes": "An example web hook for demonstration purposes.", "username": "admin" });
					
					var total_hooks = hooks.length;
					var pages = [];
					
					while (hooks.length > 0) {
						var page = { type: 'list_page', items: [] };
						while (hooks.length && (page.items.length < 100)) { page.items.push( hooks.shift() ); }
						pages.push(page);
					}
					
					appendList({ key: 'global/web_hooks', value: {"page_size":100, "first_page":0, "last_page":pages.length - 1, "length":total_hooks, "type":"list"} });
					pages.forEach( function(page, idx) { appendData({ key: 'global/web_hooks/' + idx, value: page }); } );
				}
				
				// tag end of file
				fs.appendFileSync( out_file, "\n# End of file\n" );
				
				// rename new file over original
				fs.rename( out_file, temp_file, callback );
			}
		); // fileEachLine
	}
	
}; // class Util

module.exports = Util;
