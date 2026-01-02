// Base class for our pages to inherit from

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Base = class Base extends Page {
	
	loading() {
		// show loading indicator
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
	}
	
	getNiceAPIKey(item, link) {
		// overriding method in xyops-theme page.js
		if (!item) return 'n/a';
		var key = item.api_key || item.key;
		var title = item.title;
		
		// this is the override here:
		if ((link === true) && !item.id) link = false;
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (item.icon || 'key') + '"></i>';
		if (link) {
			if (link === true) link = '#APIKeys?sub=edit&id=' + item.id;
			html += '<a href="' + link + '">';
			html += icon + '<span>' + title + '</span></a>';
		}
		else {
			html += icon + title;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceMaster(item) {
		// get formatted master with icon, plus optional link
		if (!item) return '(None)';
		if (typeof(item) == 'string') item = { id: item };
		
		var html = '<span class="nowrap" data-private>';
		var icon = '<i class="mdi mdi-database"></i>';
		html += icon + item.id;
		html += '</span>';
		
		return html;
	}
	
	getNiceGroupList(groups, glue, max) {
		// get formatted group list
		var self = this;
		if (!glue) glue = ', ';
		if (typeof(groups) == 'string') groups = groups.split(/\,\s*/);
		if (!groups || !groups.length) return '(All)';
		if (max && (groups.length > max)) {
			var extras = groups.length - max;
			groups = groups.slice(0, max);
			return groups.map( function(group) { return self.getNiceGroup(group); } ).join(glue) + glue + ' and ' + extras + ' more';
		}
		return groups.map( function(group) { return self.getNiceGroup(group); } ).join(glue);
	}
	
	getNiceGroup(item, link) {
		// get formatted group with icon, plus optional link
		if (typeof(item) == 'string') item = find_object(app.groups, { id: item });
		if (!item) return '(None)';
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (item.icon || 'server-network') + '"></i>';
		if (link) {
			if (link === true) link = '#Groups?sub=view&id=' + item.id;
			html += '<a href="' + link + '">';
			html += icon + '<span>' + item.title + '</span></a>';
		}
		else {
			html += icon + item.title;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceCategory(item, link) {
		// get formatted category with icon, plus optional link
		if (typeof(item) == 'string') item = find_object(app.categories, { id: item });
		if (!item) return '(None)';
		
		// if user cannot edit categories, no linky!
		if (!app.hasPrivilege('edit_categories')) link = false;
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (item.icon || 'folder-open-outline') + '"></i>';
		if (link) {
			if (link === true) link = '#Categories?sub=edit&id=' + item.id;
			html += '<a href="' + link + '">';
			html += icon + '<span>' + item.title + '</span></a>';
		}
		else {
			html += icon + item.title;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceMonitor(item, link) {
		// get formatted monitor with icon, plus optional link
		if (typeof(item) == 'string') item = find_object(app.monitors, { id: item });
		if (!item) return '(None)';
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (item.icon || 'chart-line') + '"></i>';
		if (link) {
			html += '<a href="#Monitors?sub=edit&id=' + item.id + '">';
			html += icon + '<span>' + item.title + '</span></a>';
		}
		else {
			html += icon + item.title;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceAlert(item, link) {
		// get formatted alert with icon, plus optional link
		if (typeof(item) == 'string') item = find_object(app.alerts, { id: item });
		if (!item) return '(None)';
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (item.icon ? item.icon : (item.enabled ? 'bell-outline' : 'bell-off-outline')) + '"></i>';
		if (link) {
			html += '<a href="#AlertSetup?sub=edit&id=' + item.id + '">';
			html += icon + '<span>' + item.title + '</span></a>';
		}
		else {
			html += icon + item.title;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceAlertElapsedTime(alert, abbrev, no_secondary) {
		// render nice elapsed time display
		var elapsed = Math.floor( Math.max( 0, alert.active ? (time_now() - alert.date) : (alert.modified - alert.date) ) );
		var icon = alert.active ? 'progress-clock' : 'clock-check-outline';
		return '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + get_text_from_seconds( elapsed, abbrev, no_secondary );
	}
	
	getNiceAlertStatus(alert) {
		// render nice alert status
		return alert.active ? '<span class="color_label red"><i class="mdi mdi-alert-circle">&nbsp;</i>Active</span>' : '<span class="color_label gray"><i class="mdi mdi-check-circle">&nbsp;</i>Cleared</span>';
	}
	
	getNiceAlertID(item, link) {
		// get formatted alert id
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (item.active ? 'progress-alert' : 'alert-circle-outline') + '"></i>';
		if (link) {
			html += '<a href="#Alerts?sub=view&id=' + item.id + '">';
			html += icon + '<span>' + item.id + '</span></a>';
		}
		else {
			html += icon + item.id;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceSnapshotID(item, link) {
		// get formatted snap id
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-monitor-screenshot"></i>';
		if (link) {
			html += '<a href="#Snapshots?sub=view&id=' + item.id + '">';
			html += icon + '<span>' + item.id + '</span></a>';
		}
		else {
			html += icon + item.id;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceSnapshotSource(item) {
		// get formatted snap source
		// sources: alert, user, watch, job
		var icon = 'palette-swatch-outline';
		switch (item.source) {
			case 'alert': icon = 'bell-outline'; break;
			case 'user': icon = 'account'; break;
			case 'watch': icon = 'bullseye-arrow'; break;
			case 'job': icon = 'timer-outline'; break;
		}
		var html = '<i class="mdi mdi-' + icon + '">&nbsp;</i>';
		html += ucfirst(item.source);
		if ((item.source == 'user') && item.username) html += ' (' + item.username + ')';
		return html;
	}
	
	getNiceCopyableID(id, icon = 'clipboard-text-outline') {
		// show nice ID with copy-to-clipboard
		var html = '<span class="nowrap">';
		html += '<button class="link" onClick="$P().copyID(this)" title="Copy ID to Clipboard">';
		html += '<i class="mdi mdi-' + icon + '"></i><span>' + id + '</span></button>';
		html += '</span>';
		return html;
	}
	
	copyID(elem) {
		// copy ID to clipboard, and update icon
		copyToClipboard( $(elem).find('span').text() );
		$(elem).find('i.mdi').removeClass().addClass([ 'mdi', 'mdi-clipboard-check-outline' ]);
		// $(elem).css('color', 'var(--green)');
		app.showMessage('info', "The ID was copied to your clipboard.");
	}
	
	copyFormID(elem) {
		// copy ID to clipboard from inside form, as suffix icon
		var $elem = $(elem);
		var $row = $elem.closest('.form_row');
		copyToClipboard( $row.find('.fr_content input').val() );
		$elem.removeClass().addClass([ 'form_suffix_icon', 'mdi', 'mdi-clipboard-check-outline' ]).css('color', 'var(--green)');
		app.showMessage('info', "The ID was copied to your clipboard.");
	}
	
	getNiceProcessText(item) {
		// get short process name from full path + args
		if (item.name) {
			// short name already provided (i.e. win32), but do some final massaging
			if ((item.name == 'svchost.exe') && item.command && item.command.match(/\s+\-s\s+(\S+)/)) return RegExp.$1;
			else return item.name;
		}
		
		var short_cmd = '' + item.command;
		short_cmd = short_cmd.replace(/\s[\-\(\/\*].*$/, '');
		
		if (short_cmd.match(/^\w\:\\/)) {
			// windows path
			short_cmd = short_cmd.replace(/\\$/, "").replace(/^(.*)\\([^\\]+)$/, "$2");
		}
		else if (short_cmd.match(/^\//)) {
			// unix path
			short_cmd = basename(short_cmd);
		}
		
		if ((short_cmd.length > 32) && short_cmd.match(/\s/)) {
			// longer commands get chopped at the first space
			short_cmd = short_cmd.replace(/\:?\s.*$/, '');
		}
		
		// colon space gets chopped
		short_cmd = short_cmd.replace(/\:\s+.*$/, '');
		
		return short_cmd;
	}
	
	getNiceProcess(item, link) {
		// get formatted process cmd
		var short_cmd = this.getNiceProcessText(item);
		
		var icon_name = 'console';
		if (item.job && app.activeJobs[item.job]) icon_name = 'timer-play-outline';
		else if (item.job) icon_name = 'timer-outline';
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + icon_name + '"></i>';
		if (link) {
			if (typeof(link) != 'string') {
				if (item.server) link = `$P().showGroupProcessInfo(${item.pid},'${item.server}')`;
				else link = '$P().showProcessInfo(' + item.pid + ')';
			}
			html += '<button class="link" onClick="' + link + '" title="' + encode_attrib_entities(item.command) + '">';
			html += icon + '<span>' + encode_entities(short_cmd) + '</span></button>';
		}
		else {
			html += icon + encode_entities(short_cmd);
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceChannel(item, link) {
		// get formatted channel with icon, plus optional link
		if (typeof(item) == 'string') item = find_object(app.channels, { id: item });
		if (!item) return '(None)';
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (item.icon || 'bullhorn-outline') + '"></i>';
		if (link) {
			html += '<a href="#Channels?sub=edit&id=' + item.id + '">';
			html += icon + '<span>' + item.title + '</span></a>';
		}
		else {
			html += icon + item.title;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceWebHook(item, link) {
		// get formatted web hook with icon, plus optional link
		if (typeof(item) == 'string') item = find_object(app.web_hooks, { id: item });
		if (!item) return '(None)';
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (item.icon || 'webhook') + '"></i>';
		if (link) {
			html += '<a href="#WebHooks?sub=edit&id=' + item.id + '">';
			html += icon + '<span>' + item.title + '</span></a>';
		}
		else {
			html += icon + item.title;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceBucket(item, link) {
		// get formatted bucket with icon, plus optional link
		if (typeof(item) == 'string') item = find_object(app.buckets, { id: item });
		if (!item) return '(None)';
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (item.icon || 'pail-outline') + '"></i>';
		if (link) {
			html += '<a href="#Buckets?sub=edit&id=' + item.id + '">';
			html += icon + '<span>' + item.title + '</span></a>';
		}
		else {
			html += icon + item.title;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceSecret(item, link) {
		// get formatted secret with icon, plus optional link
		if (typeof(item) == 'string') item = find_object(app.secrets, { id: item });
		if (!item) return '(None)';
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (item.icon || 'shield-lock-outline') + '"></i>';
		if (link) {
			html += '<a href="#Secrets?sub=edit&id=' + item.id + '">';
			html += icon + '<span>' + item.title + '</span></a>';
		}
		else {
			html += icon + item.title;
		}
		
		html += '</span>';
		return html;
	}
	
	getNicePlugin(item, link) {
		// get formatted plugin with icon, plus optional link
		if (typeof(item) == 'string') item = find_object(app.plugins, { id: item });
		if (!item) return '(None)';
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (item.icon || 'power-plug-outline') + '"></i>';
		if (link) {
			html += '<a href="#Plugins?sub=edit&id=' + item.id + '">';
			html += icon + '<span>' + item.title + '</span></a>';
		}
		else {
			html += icon + item.title;
		}
		
		html += '</span>';
		return html;
	}
	
	getNicePluginType(type) {
		// get formatted plugin type
		var icon = '';
		var title = '';
		
		switch (type) {
			case 'event': icon = 'calendar-clock'; title = 'Event'; break;
			case 'monitor': icon = 'console'; title = 'Monitor'; break;
			case 'action': icon = 'gesture-tap'; title = 'Action'; break;
			case 'scheduler': icon = 'rocket-launch-outline'; title = 'Trigger'; break;
		}
		
		var html = '<span class="nowrap">';
		html += '<i class="mdi mdi-' + icon + '"></i><span>' + title + ' Plugin</span>';
		html += '</span>';
		return html;
	}
	
	getNiceEvent(item, link) {
		// get formatted event with icon, plus optional link
		if (typeof(item) == 'string') item = find_object(app.events, { id: item });
		if (!item) return '(None)';
		
		var default_icon = 'file-clock-outline';
		var loc = '#Events';
		
		if (item.type == 'workflow') {
			default_icon = 'clipboard-flow-outline';
		}
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (item.icon || default_icon) + '"></i>';
		if (link) {
			html += '<a href="' + loc + '?id=' + item.id + '">';
			html += icon + '<span>' + item.title + '</span></a>';
		}
		else {
			html += icon + item.title;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceWorkflowJob(workflow, link) {
		// get formatted workflow job ID with icon, plus optional link
		if (!workflow || !workflow.job) return '(None)';
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-clipboard-play-outline"></i>';
		if (link) {
			html += '<a href="#Job?id=' + workflow.job + '">';
			html += icon + '<span>' + workflow.job + '</span></a>';
		}
		else {
			html += icon + id;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceWorkflowNodeType(node) {
		// get formatted workflow node type with suitable icon
		if (!node) return 'n/a';
		var info = find_object( config.ui.workflow_node_types, { id: node.type } );
		if (!info) return '(' + node.type + ')';
		return '<i class="mdi mdi-' + info.icon +'">&nbsp;</i>' + info.title;
	}
	
	getNiceJobEvent(job, link) {
		// get nice event formatted as running job, supporting workflows etc.
		if (job.type == 'adhoc') {
			var plugin = find_object( app.plugins, { id: job.plugin } );
			if (!plugin) return 'n/a'; // sanity
			
			var title = job.label || plugin.title;
			var icon_id = job.icon || plugin.icon || 'power-plug-outline';
			
			var html = '<span class="nowrap">';
			var icon = '<i class="mdi mdi-' + icon_id + '"></i>';
			html += icon + title;
			
			html += '</span>';
			return html;
		}
		else return this.getNiceEvent(job.event, link);
	}
	
	getNiceTicket(ticket, link) {
		// return formatted ticket subject
		if (link) return '<span class="nowrap"><a href="#' + ticket.num + '"><i class="mdi mdi-text-box-outline"></i><b>' + strip_html(ticket.subject) + '</b></a></span>';
		else return '<span class="nowrap"><i class="mdi mdi-text-box-outline"></i><b>' + strip_html(ticket.subject) + '</b></span>';
	}
	
	getNiceTicketStatus(status) {
		// get formatted ticket status with suitable icon
		if (!status) return 'n/a';
		var info = find_object( config.ui.ticket_statuses, { id: status } );
		if (!info) return '(' + status + ')';
		return '<i class="mdi mdi-' + info.icon +'">&nbsp;</i>' + info.title;
	}
	
	getNiceTicketType(type) {
		// get formatted ticket type with suitable icon
		if (!type) return 'n/a';
		var info = find_object( config.ui.ticket_types, { id: type } );
		if (!info) return '(' + type + ')';
		return '<i class="mdi mdi-' + info.icon +'">&nbsp;</i>' + info.title;
	}
	
	getNiceServer(item, link) {
		// get formatted server with icon, plus optional link
		if (!item) return '(None)';
		if (typeof(item) == 'string') {
			// assume id (fallback to hostname, then fallback to "offline" server)
			var orig_item = item;
			item = find_object(app.servers, { id: orig_item }) || find_object(app.servers, { hostname: orig_item });
			if (!item && this.servers) item = find_object(this.servers, { id: orig_item });
			if (!item) {
				item = { id: orig_item, hostname: orig_item, icon: 'close-network-outline' };
			}
		}
		if (!item) return '(None)';
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (item.offline ? 'close-network-outline' : (item.icon || 'router-network')) + '"></i>';
		var text = item.title || app.formatHostname(item.hostname);
		if (link) {
			html += '<a href="#Servers?id=' + item.id + '">' + icon + '<span data-private>' + text + '</span></a>';
		}
		else {
			html += icon + '<span data-private>' + text + '</span>';
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceServerText(item) {
		// get server label or hostname in plain text (no HTML markup)
		if (!item) return '(None)';
		if (app.privacyMode()) return '(Redacted)';
		
		if (typeof(item) == 'string') {
			// assume id (fallback to hostname, then fallback to "offline" server)
			var orig_item = item;
			item = find_object(app.servers, { id: orig_item }) || find_object(app.servers, { hostname: orig_item });
			if (!item && this.servers) item = find_object(this.servers, { id: orig_item });
			if (!item) {
				item = { id: orig_item, hostname: orig_item, icon: 'close-network-outline' };
			}
		}
		if (!item) return '(None)';
		
		return item.title || app.formatHostname(item.hostname);
	}
	
	getNiceTarget(target, link) {
		// get formatted target, which may be a group or a server
		if (find_object(app.groups, { id: target })) return this.getNiceGroup(target, link);
		if (find_object(app.servers, { id: target })) return this.getNiceServer(target, link);
		
		// if target looks like a server, still call getNiceServer, for offline icon
		if (target && (''+target).match(/^s/)) return this.getNiceServer(target, link);
		return target;
	}
	
	getNiceTargetList(targets, link, glue) {
		// get formatted target list
		var self = this;
		if (!glue) glue = ', ';
		if (!targets || !targets.length) return '(None)';
		return targets.map( function(target) { return self.getNiceTarget(target, link); } ).join(glue);
	}
	
	getNiceTagList(tags, link, glue) {
		// get formatted tag group
		var self = this;
		if (!tags) return '(None)';
		if (!glue) glue = ', ';
		if (typeof(tags) == 'string') tags = tags.split(/\,\s*/);
		tags = tags.filter( function(tag) { return !tag.match(/^_/); } ); // filter out system tags
		if (!tags.length) return '(None)';
		return tags.map( function(tag) { return self.getNiceTag(tag, link); } ).join(glue);
	}
	
	getNiceTagListText(tags) {
		// just the text, ma'am
		return (tags || []).map( function(tag) {
			var tag_def = find_object( app.tags, { id: tag } );
			return tag_def ? tag_def.title : `(${tag})`;
		} ).join(', ') || '(None)';
	}
	
	getNiceTag(tag, link) {
		// get formatted tag with icon, plus optional link
		if (!tag) return '(None)';
		if (typeof(tag) == 'string') {
			var tag_def = find_object( app.tags, { id: tag } );
			if (tag_def) tag = tag_def;
			else {
				// deleted tag, no link
				tag = { id: tag, title: tag };
				link = false;
			}
		}
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (tag.icon || 'tag-outline') + '"></i>';
		
		if (link) {
			if (link === true) {
				link = '#Tags?sub=edit&id=' + tag.id;
			}
			html += '<a href="' + link + '">';
			html += icon + '<span>' + tag.title + '</span></a>';
		}
		else {
			html += icon + tag.title;
		}
		html += '</span>';
		
		return html;
	}
	
	getNiceAlgo(id) {
		// get nice event target algorithm
		if (!id) return '(None)';
		var default_icon = 'arrow-decision';
		var algo = find_object( config.ui.event_target_algo_menu, { id: id } );
		if (!algo && id.match(/^monitor\:(\w+)$/)) {
			var mon_id = RegExp.$1;
			var mon_def = find_object( app.monitors, { id: mon_id } );
			if (mon_def) algo = mon_def;
		}
		if (!algo) return 'n/a';
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (algo.icon || default_icon) + '"></i>';
		html += icon + algo.title;
		html += '</span>';
		
		return html;
	}
	
	getNiceRole(role, link) {
		// get formatted role with icon, plus optional link
		if (!role) return '(None)';
		if (typeof(role) == 'string') {
			var role_def = find_object( app.roles, { id: role } );
			if (role_def) role = role_def;
			else {
				// deleted role, no link
				role = { id: role, title: role };
				link = false;
			}
		}
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (role.icon || 'account-group-outline') + '"></i>';
		
		if (link) {
			if (link === true) {
				link = '#Roles?sub=edit&id=' + role.id;
			}
			html += '<a href="' + link + '">';
			html += icon + '<span>' + role.title + '</span></a>';
		}
		else {
			html += icon + role.title;
		}
		html += '</span>';
		
		return html;
	}
	
	getNiceFile(filename, link, icon) {
		// get nice file with type-appropriate icon
		if (!icon) icon = 'file-outline';
		var html = '';
		var ext = '';
		if (filename.match(/\.(\w+)$/)) ext = RegExp.$1.toLowerCase();
		
		if (ext.match(/^(jpg|jpe|jpeg|gif|bmp|png|webp)$/)) icon = 'file-image-outline';
		else if (ext.match(/^(mp4|m4v|mkv|mov|avi|webm)$/)) icon = 'file-video-outline';
		else if (ext.match(/^(mp3|m4a|ogg)$/)) icon = 'file-music-outline';
		else if (ext.match(/^(txt|log|md)$/)) icon = 'file-document-outline';
		else if (ext.match(/^(xml|dtd|json|yml|ini|js|mjs|ts|tsx|py|pl|rb|go|rs|php|html|css|conf|c|h|cpp|hpp)$/)) icon = 'file-code-outline';
		else if (ext.match(/^(csv|tsv)$/)) icon = 'file-delimited-outline';
		else if (ext.match(/^(xls|xlsx)$/)) icon = 'file-table-outline';
		else if (ext.match(/^(doc|docx)$/)) icon = 'file-word-outline';
		else if (ext.match(/^(ppt|pptx)$/)) icon = 'file-powerpoint-outline';
		else if (ext.match(/^(pdf)$/)) icon = 'file-sign';
		else if (ext.match(/^(zip|tar|gz|xz)$/)) icon = 'file-cabinet';
		
		html += '<span class="nowrap">';
		icon = '<i class="mdi mdi-' + icon + '"></i>';
		
		if (link) {
			html += '<a href="' + link + '" target="_blank">';
			html += icon + '<span>' + filename + '</span></a>';
		}
		else {
			html += icon + filename;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceIP(ip) {
		// get nice ip address for display
		if (!ip) return 'n/a';
		return '<i class="mdi mdi-earth">&nbsp;</i><span data-private>' + app.formatIPAddress(ip) + '</span>';
	}
	
	getNiceArch(arch) {
		// get nice server architecture for display
		if (!arch) arch = 'Unknown';
		var icon = arch.match(/64/) ? 'cpu-64-bit' : 'chip';
		return '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + arch;
	}
	
	getNiceOS(os) {
		// get nice server operating system for display
		return '<i class="mdi mdi-harddisk">&nbsp;</i>' + os.platform + ' ' + os.distro + ' ' + os.release;
	}
	
	getNiceShortOS(os) {
		// get nice server operating system for display
		return '<i class="mdi mdi-harddisk">&nbsp;</i>' + os.distro + ' ' + os.release;
	}
	
	getNiceVirtualization(virt) {
		// get nice virtualization summary
		if (!virt || !virt.vendor) return 'None';
		var icon = virt.cloud ? 'cloud-outline' : 'layers-outline';
		var html = virt.vendor;
		if (virt.type || virt.location) {
			html += '(';
			var items = [];
			if (virt.type) items.push( virt.type );
			if (virt.location) items.push( virt.location );
			html += items.join(', ') + ')';
		}
		return '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + html;
	}
	
	getNiceMemory(bytes) {
		// format bytes with memory-ish icon
		return '<i class="mdi mdi-memory">&nbsp;</i>' + get_text_from_bytes(bytes || 0);
	}
	
	getNiceCPUType(cpu) {
		// get nice cpu type with icon
		return '<i class="mdi mdi-developer-board">&nbsp;</i>' + cpu.combo || (cpu.vendor + ' ' + cpu.brand);
	}
	
	getNiceUptime(secs) {
		// get nice server uptime
		var nice_date = this.getNiceDateTimeText( time_now() - secs );
		secs -= (secs % 60); // floor to minute
		return '<span title="' + nice_date + '"><i class="mdi mdi-battery-clock-outline">&nbsp;</i>' + get_text_from_seconds(secs || 60, false, false) + '</span>';
	}
	
	getNiceInternalJobType(type) {
		// get nice icon + string for internal job type
		var html = '<span class="nowrap">';
		
		switch (type) {
			case 'storage': html += '<i class="mdi mdi-harddisk"></i><span>Storage</span>'; break;
			case 'timeline': html += '<i class="mdi mdi-chart-areaspline"></i><span>Timeline</span>'; break;
			case 'logs': html += '<i class="mdi mdi-script-text-outline"></i><span>Logs</span>'; break;
			case 'db': html += '<i class="mdi mdi-database"></i><span>Database</span>'; break;
			case 'maint': html += '<i class="mdi mdi-hammer-wrench"></i><span>Maintenance</span>'; break;
			case 'user': html += '<i class="mdi mdi-account"></i><span>User</span>'; break;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceDate(epoch) {
		// format date according to user's prefs, add icon
		return '<i class="mdi mdi-calendar-today">&nbsp;</i>' + this.getNiceDateText(epoch);
	}
	
	getNiceDateText(epoch) {
		// format date according to user's prefs, plain text
		return this.formatDate(epoch, { 
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
	
	getNiceDateTime(epoch, secs) {
		// format date according to user's prefs, add icon
		// return '<i class="mdi mdi-calendar-clock">&nbsp;</i>' + this.getNiceDateTimeText(epoch);
		var dargs = get_date_args(epoch);
		var nargs = get_date_args( time_now() );
		var result = '<i class="mdi mdi-calendar-clock">&nbsp;</i>';
		
		if (nargs.yyyy_mm_dd == dargs.yyyy_mm_dd) {
			// today
			result += 'Today at ' + this.getNiceTimeText(epoch, secs);
		}
		else {
			// some other day
			result += this.getNiceDateTimeText(epoch, secs);
		}
		
		return result;
	}
	
	getNiceDateTimeText(epoch, secs) {
		// format date according to user's prefs, plain text
		return this.formatDate(epoch, { 
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			// weekday: 'long',
			hour: 'numeric',
			minute: '2-digit',
			second: secs ? '2-digit' : false
		});
	}
	
	getShortDateTime(epoch, secs) {
		// format date according to user's prefs, add icon
		return '<i class="mdi mdi-calendar-clock">&nbsp;</i>' + this.getShortDateTimeText(epoch, secs);
	}
	
	getShortDateTimeText(epoch, secs) {
		// format date according to user's prefs, plain text
		return this.formatDate(epoch, { 
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			// weekday: 'long',
			hour: 'numeric',
			minute: '2-digit',
			second: secs ? '2-digit' : false
		});
	}
	
	getRelativeDateTime(epoch, secs) {
		var dargs = get_date_args(epoch);
		var nargs = get_date_args( time_now() );
		var result = '<i class="mdi mdi-calendar-clock">&nbsp;</i>';
		
		if (nargs.yyyy_mm_dd == dargs.yyyy_mm_dd) {
			// today
			result += 'Today at ' + this.getNiceTimeText(epoch, secs);
		}
		else {
			// some other day
			result += this.getShortDateTimeText(epoch, secs);
			// result += '<span title="' + this.getNiceDateTimeText(epoch) + '">' + this.getNiceDateText(epoch) + '</span>';
		}
		
		return result;
	}
	
	getNiceTimeText(epoch, secs) {
		// format time according to user's prefs, plain text
		return this.formatDate(epoch, { 
			hour: 'numeric',
			minute: '2-digit',
			second: secs ? '2-digit' : false
		});
	}
	
	getDateOptions(opts = {}) {
		// get combined date/time options with user locale settings
		return app.getDateOptions(opts);
	}
	
	formatDate(epoch, opts) {
		// format date and/or time according to user locale settings
		return app.formatDate(epoch, opts);
	}
	
	formatDateRange(start, end, opts) {
		// format date range based on user locale settings
		return app.formatDateRange(start, end, opts);
	}
	
	commify(number) {
		// add localized commas to integer, e.g. 1,234,567 for US
		return (new Intl.NumberFormat( this.getUserLocale() )).format(number || 0);
	}
	
	getNiceDashNumber(value) {
		// format number for display in dash unit
		if (!value) value = 0;
		value = Math.round(value);
		
		if (value >= 1000000000) {
			return '' + short_float(value / 1000000000, 1) + 'B';
		}
		else if (value >= 1000000) {
			return '' + short_float(value / 1000000, 1) + 'M';
		}
		else if (value >= 1000) {
			return '' + short_float(value / 1000, 1) + 'K';
		}
		else return value;
	}
	
	getUserLocale() {
		// get user customized locale, default to current detected one
		var user = app.user;
		var ropts = Intl.DateTimeFormat().resolvedOptions();
		var [lang, reg] = ropts.locale.split(/\-/);
		if (!reg) reg = lang.toUpperCase();
		
		lang = user.language || lang;
		reg = user.region || reg;
		
		return lang + '-' + reg;
	}
	
	getUserTimezone() {
		// get user customized timezone, default to current detected one
		var user = app.user;
		var ropts = Intl.DateTimeFormat().resolvedOptions();
		return user.timezone || ropts.timeZone;
	}
	
	formatDateISO(epoch, tz) {
		// format date in YYYY-MM-DDThh:mm format, in custom timezone
		// suitable for a input type="datetime-local" field
		if (!tz) tz = this.getUserTimezone();
		var opts = this.getDateOptions({ year: 'numeric', month: '2-digit', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: tz });
		delete opts.locale; // ISO is always en-US
		var formatter = new Intl.DateTimeFormat('en-US', opts);
		
		var args = {};
		formatter.formatToParts( new Date(epoch * 1000) ).forEach( function(part) {
			if (part.type == 'literal') return;
			args[ part.type ] = part.value;
		} );
		
		if (args.month.length < 2) args.month = '0' + args.month;
		if (args.day.length < 2) args.day = '0' + args.day;
		if (args.hour.length < 2) args.hour = '0' + args.hour;
		if (args.minute.length < 2) args.minute = '0' + args.minute;
		
		return args.year + '-' + args.month + '-' + args.day + 'T' + args.hour + ':' + args.minute;
	}
	
	parseDateTZ(str, tz) {
		// parse a date in a specified IANA timezone
		// date should be in YYYY-MM-DD HH24:MI:SS format
		if (!str) return false;
		if (!tz) tz = this.getUserTimezone();
		
		var in_parts = str.split(/\D+/).map( function(part) { return parseInt(part); } );
		while (in_parts.length < 6) in_parts.push(0); // allow some bits to be omitted, e.g. seconds
		var orig_comp = in_parts.join('-'); // save for comparison
		in_parts[1]--; // convert month to 0-base
		
		// parse as UTC
		var epoch = Date.UTC.apply( Date, in_parts ) / 1000;
		var date = new Date( epoch * 1000 );
		
		// reformat into specified tz
		var opts = { year: 'numeric', month: '2-digit', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: tz };
		var formatter = new Intl.DateTimeFormat('en-US', opts);
		
		// compile date/time into named args
		var args = {};
		formatter.formatToParts(date).forEach( function(part) {
			if (part.type == 'literal') return;
			args[ part.type ] = parseInt( part.value );
		} );
		
		// reparse as UTC again, and apply offset based on the diff
		var adj_epoch = Date.UTC( args.year, args.month - 1, args.day, args.hour, args.minute, args.second ) / 1000;
		var diff = epoch - adj_epoch;
		epoch += diff;
		
		// now, in most cases this will be exactly correct, but due to DST and timezone rules, 2 days per year it sometimes isn't.
		// luckily, we have the original date/time we can compare against, and we're never off by more than 1 hour.
		// so try exact, then +/- 1 hour, and then +/- 30 minutes (for Lord Howe Island), until we get a match.
		var deltas = [0, 3600, -3600, 1800, -1800];
		
		for (var idx = 0, len = deltas.length; idx < len; idx++) {
			var new_date = new Date( (epoch + deltas[idx]) * 1000 );
			var new_args = {};
			formatter.formatToParts(new_date).forEach( function(part) {
				if (part.type == 'literal') return;
				new_args[ part.type ] = parseInt( part.value );
			} );
			var new_parts = [ new_args.year, new_args.month, new_args.day, new_args.hour, new_args.minute, new_args.second ];
			var new_comp = new_parts.join('-');
			if (new_comp === orig_comp) return new_date.getTime() / 1000;
		}
		
		// we couldn't get a match, i.e. a non-existent time
		return false;
	}
	
	formatDateTZ(epoch, template, tz) {
		// format date according to template and tz
		if (!epoch || !template) return false;
		var dargs = this.getDateArgsTZ(epoch, tz);
		
		dargs.yyyy = '' + dargs.year;
		dargs.mm = zeroPad(dargs.month, 2);
		dargs.dd = zeroPad(dargs.day, 2);
		dargs.hh = zeroPad(dargs.hour, 2);
		dargs.mi = zeroPad(dargs.minute, 2);
		dargs.ss = zeroPad(dargs.second, 2);
		
		return substitute( template, dargs );
	}
	
	getDateArgsTZ(epoch, tz) {
		// get date args in custom timezone
		// returns: { year, month, day, weekday, hour, minute, second, epoch, tz }
		// (everything is a number except tz, and month is 1-based)
		if (!tz) tz = this.getUserTimezone();
		var days = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
		var opts = this.getDateOptions({ 
			year: 'numeric', 
			month: '2-digit', 
			day: 'numeric', 
			weekday: 'long', 
			hour: 'numeric', 
			minute: '2-digit', 
			second: '2-digit', 
			hourCycle: 'h23', 
			timeZone: tz 
		});
		delete opts.locale; // ISO is always en-US
		var formatter = new Intl.DateTimeFormat('en-US', opts);
		var args = { epoch, tz };
		
		formatter.formatToParts( new Date(epoch * 1000) ).forEach( function(part) {
			if (part.type == 'literal') return;
			if (part.type == 'weekday') args[ part.type ] = days[ part.value ];
			else args[ part.type ] = parseInt( part.value );
		} );
		
		return args;
	}
	
	showDateRangePicker(callback) {
		// show dialog for picking a date range
		var self = this;
		var args = this.args;
		var title = "Select Date Range";
		var btn = ['check-circle', "Accept"];
		
		var html = '<div class="dialog_box_content scroll">';
		
		// start
		html += this.getFormRow({
			label: 'Start Date:',
			content: this.getFormText({
				id: 'fe_edr_start',
				type: 'date',
				value: args.start || yyyy_mm_dd(0, '-'),
				'data-shrinkwrap': 1
			}),
			caption: 'Select the starting date for your range (inclusive).'
		});
		
		// end
		html += this.getFormRow({
			label: 'End Date:',
			content: this.getFormText({
				id: 'fe_edr_end',
				type: 'date',
				value: args.end || yyyy_mm_dd(0, '-'),
				'data-shrinkwrap': 1
			}),
			caption: 'Select the ending date for your range (inclusive).'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			if (!$('#fe_edr_start')[0].checkValidity()) return app.badField('#fe_edr_start', "Please enter a valid start date.");
			if (!$('#fe_edr_end')[0].checkValidity()) return app.badField('#fe_edr_end', "Please enter a valid end date.");
			
			args.start = $('#fe_edr_start').val();
			args.end = $('#fe_edr_end').val();
			
			var start = new Date( args.start + " 00:00:00" );
			var end = new Date( args.end + " 00:00:00" );
			if (start > end) return app.doError("Invalid date range. Please try again.");
			
			Dialog.hide();
			callback();
		}); // confirm
	}
	
	getDateRangeQuery(key, value) {
		// get formatted epoch/3600 date range for DB queries
		// now, lasthour, today, yesterday, month, lastmonth, year, lastyear, older
		var query = '';
		var dargs = this.getDateArgsTZ( time_now() );
		
		switch (value) {
			case 'now':
				query += '' + key + ':' + time_now();
			break;
			
			case 'lasthour':
				var date_code = time_now() - 3600;
				query += '' + key + ':' + date_code;
			break;
			
			case 'today': 
				var epoch = this.parseDateTZ( dargs.year + '-' + dargs.month + '-' + dargs.day + ' 00:00:00' );
				query += '' + key + ':>=' + epoch;
			break;
			
			case 'yesterday': 
				var midnight = this.parseDateTZ( dargs.year + '-' + dargs.month + '-' + dargs.day + ' 00:00:00' ); // get epoch of midnight today
				var noon = this.parseDateTZ( dargs.year + '-' + dargs.month + '-' + dargs.day + ' 12:00:00' ); // get epoch of noon today
				var yesterday = noon - 86400; // subtract 1d for yesterday -- can be +/- 1 hour off
				dargs = this.getDateArgsTZ( yesterday ); // get dargs for yesterday
				var yesterday_midnight = this.parseDateTZ( dargs.year + '-' + dargs.month + '-' + dargs.day + ' 00:00:00' ); // get epoch of midnight yesterday
				query += '' + key + ':' + yesterday_midnight + '..' + Math.floor(midnight - 1);
			break;
			
			case 'month': 
				var cur_month = this.parseDateTZ( dargs.year + '-' + dargs.month + '-01 00:00:00' ); // get epoch of midnight on first month day
				query += '' + key + ':>=' + cur_month;
			break;
			
			case 'lastmonth':
				var cur_month = this.parseDateTZ( dargs.year + '-' + dargs.month + '-01 00:00:00' ); // get epoch of midnight on first month day
				var before = cur_month - (86400 * 15); // sometime in last month -- does not need to be exact
				dargs = this.getDateArgsTZ( before ); // get dargs for last month
				var last_month = this.parseDateTZ( dargs.year + '-' + dargs.month + '-01 00:00:00' ); // get epoch of midnight on first day of last month
				query += '' + key + ':' + last_month + '..' + Math.floor(cur_month - 1);
			break;
			
			case 'year': 
				var cur_year = this.parseDateTZ( dargs.year + '-01-01 00:00:00' ); // get epoch of midnight on first year day
				query += '' + key + ':>=' + cur_year;
			break;
			
			case 'lastyear':
				var cur_year = this.parseDateTZ( dargs.year + '-01-01 00:00:00' ); // get epoch of midnight on first year day
				var before = cur_year - (86400 * 180); // sometime in last year -- does not need to be exact
				dargs = this.getDateArgsTZ( before ); // get dargs for last year
				var last_year = this.parseDateTZ( dargs.year + '-01-01 00:00:00' ); // get epoch of midnight on first day of last year
				query += '' + key + ':' + last_year + '..' + Math.floor(cur_year - 1);
			break;
			
			case 'older':
				var cur_year = this.parseDateTZ( dargs.year + '-01-01 00:00:00' ); // get epoch of midnight on first year day
				var before = cur_year - (86400 * 180); // sometime in last year -- does not need to be exact
				dargs = this.getDateArgsTZ( before ); // get dargs for last year
				var last_year = this.parseDateTZ( dargs.year + '-01-01 00:00:00' ); // get epoch of midnight on first day of last year
				query += '' + key + ':<' + last_year;
			break;
			
			case 'custom':
				// custom date range stored in page args -- note: end is INCLUSIVE, so compensate here
				if (!this.args.start) this.args.start = yyyy_mm_dd(0, '-');
				if (!this.args.end) this.args.end = yyyy_mm_dd(0, '-');
				var start = this.parseDateTZ( this.args.start + ' 00:00:00' );
				var dargs = this.getDateArgsTZ( this.parseDateTZ( this.args.end + ' 12:00:00' ) + 86400 ); // next day after end
				var end = this.parseDateTZ( dargs.year + '-' + dargs.month + '-' + dargs.day + ' 00:00:00' ); // midnight on end date
				query += '' + key + ':' + start + '..' + Math.floor(end - 1);
			break;
		} // switch
		
		return query;
	}
	
	getNiceUserList(users, link, glue) {
		// get formatted user group
		var self = this;
		if (!glue) glue = ', ';
		if (typeof(users) == 'string') users = users.split(/\,\s*/);
		if (!users.length) return '(None)';
		return users.map( function(user) { return self.getNiceUser(user, link); } ).join(glue);
	}
	
	getNiceUser(user, link) {
		if (!user) return 'n/a';
		if (typeof(user) == 'string') {
			user = find_object( app.users, { username: user } ) || find_object( app.api_keys, { id: user } ) || user;
		}
		if ((typeof(user) == 'object') && user.key) {
			return this.getNiceAPIKey(user, link);
		}
		var username = user.username ? user.username : user;
		if (!username || (typeof(username) != 'string')) return 'n/a';
		
		if (!user.full_name && find_object(app.users, { username })) {
			user = find_object(app.users, { username });
		}
		if (typeof(user) == 'string') {
			user = { icon: 'account-outline' };
		}
		
		var html = '<span class="nowrap" data-private>';
		var icon = '<i class="mdi mdi-' + (user.icon || 'account') + '"></i>';
		if (link && user.full_name) {
			if (link === true) link = '#Users?sub=edit&username=' + username;
			html += '<a href="' + link + '">';
			html += icon + '<span>' + (user.full_name || username) + '</span></a>';
		}
		else {
			if (username == 'system') { username = '(System)'; icon = ''; }
			html += icon + (user.full_name || username);
		}
		html += '</span>';
		
		return html;
	}
	
	getJobDisplayArgs(job) {
		// get nice display args for job
		var event_title = 'n/a';
		var event_icon = '';
		
		var event = find_object( app.events, { id: job.event } );
		var plugin = find_object( app.plugins, { id: job.plugin } );
		
		if (plugin && (job.type == 'adhoc')) {
			event_title = job.label || plugin.title;
			event_icon = job.icon || plugin.icon || 'power-plug-outline';
		}
		else if (event) {
			event_title = event.title;
			event_icon = event.icon || ((event.type == 'workflow') ? 'clipboard-flow-outline' : 'file-clock-outline');
		}
		
		var icon = 'timer-outline';
		if (job.icon) icon = job.icon;
		else if (job.type == 'workflow') icon = 'clipboard-play-outline';
		else if (job.workflow) icon = 'clipboard-clock-outline';
		
		var state = ucfirst(job.state || 'unknown');
		if (state == 'Complete') state = get_text_from_seconds( app.epoch - job.completed, true, true ) + ' ago';
		
		var title = `${job.id} (${event_title} &mdash; ${state})`;
		
		return { icon, title, state, event_title, event_icon };
	}
	
	getNiceJob(job, link) {
		// get formatted job ID with icon, plus optional link
		if (!job) return '(None)';
		if (typeof(job) == 'string') {
			if (app.activeJobs[job]) job = app.activeJobs[job];
			else job = { id: job };
		}
		
		var nice_id = job.id;
		if (job.label && (job.type != 'adhoc')) nice_id = strip_html(job.label) + ' (' + job.id + ')';
		
		var icon = '<i class="mdi mdi-timer-outline"></i>';
		if (job.icon) icon = '<i class="mdi mdi-' + job.icon + '"></i>';
		else if (job.type == 'workflow') icon = '<i class="mdi mdi-clipboard-play-outline"></i>';
		else if (job.workflow) icon = '<i class="mdi mdi-clipboard-clock-outline"></i>';
		
		var html = '<span class="nowrap">';
		if (link) {
			html += '<a href="#Job?id=' + job.id + '">';
			html += icon + '<span>' + nice_id + '</span></a>';
		}
		else {
			html += icon + nice_id;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceJobElapsedTime(job, abbrev, no_secondary) {
		// render nice elapsed time display
		var now = Math.floor( job.completed || app.epoch );
		var elapsed = job.elapsed || Math.max( 0, now - Math.floor(job.started) ) || 0;
		var icon = job.completed ? 'clock-check-outline' : 'progress-clock';
		return '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + get_text_from_seconds( elapsed, abbrev, no_secondary );
	}
	
	getNiceJobProgressBar(job, extra_classes = []) {
		// render nice progress bar for job
		var html = '';
		var counter = Math.min(1, Math.max(0, job.progress || 1));
		var bar_width = this.bar_width || 100;
		var cx = Math.floor( counter * bar_width );
		var label = '' + Math.floor( (counter / 1.0) * 100 ) + '%';
		
		if (job.suspended) {
			extra_classes.push('pending');
			cx = 0;
			label = '<i class="mdi mdi-motion-pause-outline"></i>';
		}
		else switch (job.state) {
			case 'start_delay':
				extra_classes.push('pending');
				cx = 0;
				label = '<i class="mdi mdi-clock-fast"></i>';
			break;
			
			case 'retry_delay':
				extra_classes.push('pending');
				cx = 0;
				label = '<i class="mdi mdi-update"></i>';
			break;
			
			case 'queued':
				extra_classes.push('pending');
				cx = 0;
				label = '<i class="mdi mdi-tray-full"></i>';
			break;
			
			default:
				if (counter == 1.0) extra_classes.push('indeterminate');
			break;
		}
		
		html += '<div class="progress_bar_container ' + extra_classes.join(' ') + '" style="width:' + bar_width + 'px;" role="progressbar">';
			html += '<div class="progress_bar_label first_half" style="width:' + bar_width + 'px;">' + label + '</div>';
			html += '<div class="progress_bar_inner" style="width:' + cx + 'px;">';
				html += '<div class="progress_bar_label second_half" style="width:' + bar_width + 'px;">' + label + '</div>';
			html += '</div>';
		html += '</div>';
		
		return html;
	}
	
	updateJobProgressBar(job, $cont) {
		// update job progress bar
		if (typeof($cont) == 'string') $cont = this.div.find($cont);
		
		var counter = Math.min(1, Math.max(0, job.progress || 1));
		var bar_width = this.bar_width || 100;
		var cx = Math.floor( counter * bar_width );
		var label = '' + Math.floor( (counter / 1.0) * 100 ) + '%';
		var indeterminate = !!(counter == 1.0);
		
		var pending = !!((job.state == 'start_delay') || (job.state == 'retry_delay') || (job.state == 'queued') || job.suspended);
		if (pending) { 
			cx = 0; 
			label = ''; 
			indeterminate = false; 
			
			if (job.suspended) label = '<i class="mdi mdi-motion-pause-outline"></i>';
			else if (job.state == 'start_delay') label = '<i class="mdi mdi-clock-fast"></i>';
			else if (job.state == 'retry_delay') label = '<i class="mdi mdi-update"></i>';
			else if (job.state == 'queued') label = '<i class="mdi mdi-tray-full"></i>';
		}
		
		// skip animation if going from indeterminate to determinate
		if ($cont.hasClass('indeterminate') && !indeterminate) {
			$cont.find('.progress_bar_inner').css('width', '0px').get(0).offsetWidth;
		}
		
		$cont.toggleClass('indeterminate', indeterminate);
		$cont.toggleClass('pending', pending);
		
		$cont.find('.progress_bar_inner').css('width', '' + cx + 'px');
		$cont.find('.progress_bar_label').html( label );
	}
	
	getNiceProgressBar(amount = 0, extra_classes = '', show_label = false) {
		// render nice progress bar for arbitrary value
		var html = '';
		var counter = Math.min(1, Math.max(0, amount || 0));
		var bar_width = this.bar_width || 100;
		if (extra_classes.match(/\b(wider)\b/)) bar_width = 150;
		var cx = Math.floor( counter * bar_width );
		var label = '' + Math.floor( (counter / 1.0) * 100 ) + '%';
		var extra_attribs = show_label ? '' : ('title="' + label + '"');
		
		html += '<div class="progress_bar_container ' + extra_classes + '" style="width:' + bar_width + 'px; margin:0;" ' + extra_attribs + ' role="progressbar">';
			if (show_label) html += '<div class="progress_bar_label first_half" style="width:' + bar_width + 'px;">' + label + '</div>';
			html += '<div class="progress_bar_inner" style="width:' + cx + 'px;">';
				if (show_label) html += '<div class="progress_bar_label second_half" style="width:' + bar_width + 'px;">' + label + '</div>';
			html += '</div>';
		html += '</div>';
		
		return html;
	}
	
	updateProgressBar(amount, $cont) {
		// update generic progress bar
		if (typeof($cont) == 'string') $cont = this.div.find($cont);
		
		var counter = Math.min(1, Math.max(0, amount || 1));
		var bar_width = this.bar_width || 100;
		if ($cont.hasClass('wider')) bar_width = 150;
		var cx = Math.floor( counter * bar_width );
		var label = '' + Math.floor( (counter / 1.0) * 100 ) + '%';
		var indeterminate = !!(counter == 1.0);
		
		$cont.toggleClass('indeterminate', indeterminate);
		$cont.find('.progress_bar_inner').css('width', '' + cx + 'px');
		$cont.find('.progress_bar_label').html( label );
	}
	
	getNiceJobRemainingTime(job, abbrev) {
		// get nice job remaining time, using elapsed and progress
		var elapsed = Math.floor( Math.max( 0, app.epoch - job.started ) );
		var progress = job.progress || 0;
		if ((elapsed >= 10) && (progress > 0) && (progress < 1.0)) {
			var sec_remain = Math.floor(((1.0 - progress) * elapsed) / progress);
			return '<i class="mdi mdi-update">&nbsp;</i>' + get_text_from_seconds( sec_remain, abbrev, true );
		}
		else return 'n/a';
	}
	
	getNiceJobState(job) {
		// get nice job state given job
		// (states: queued, start_delay, retry_delay, ready, starting, active, finishing, complete)
		var nice_state = ucfirst(job.state || 'unknown');
		var now = app.epoch;
		var icon = 'progress-question';
		
		switch (job.state) {
			case 'queued': 
				icon = 'tray-full'; 
				if (job.position) nice_state += ` (#${job.position})`;
			break;
			
			case 'start_delay': 
				icon = 'clock-fast';
				nice_state = 'Start Delay';
				if (job.until && (job.until > now)) nice_state += ' (' + get_text_from_seconds(job.until - now, true, true) + ')';
			break;
			
			case 'retry_delay': 
				icon = 'update';
				nice_state = 'Retry Delay';
				if (job.until && (job.until > now)) nice_state += ' (' + get_text_from_seconds(job.until - now, true, true) + ')';
			break;
			
			case 'ready': icon = 'play-speed'; break;
			case 'starting': icon = 'motion-play'; break;
			case 'active': icon = 'motion-play-outline'; break;
			case 'finishing': icon = 'progress-check'; break;
			case 'complete': icon = 'check-circle-outline'; break;
		}
		
		// special case: If job is complete but not final, it's actually still finishing
		if ((job.state == 'complete') && !job.final) { icon = 'progress-check'; nice_state = 'Finishing'; }
		
		// special case for suspended job
		if (job.suspended && !job.final) { icon = 'motion-pause-outline'; nice_state = 'Suspended'; }
		
		return '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + nice_state;
	}
	
	getNiceJobAvgCPU(job) {
		// avg cpu for display
		var cpu_avg = 0;
		if (!job.cpu) job.cpu = {};
		if (job.cpu.total && job.cpu.count) {
			cpu_avg = Math.round( job.cpu.total / job.cpu.count );
		}
		return cpu_avg + '%';
	}
	
	getNiceJobAvgMem(job) {
		// avg mem for display
		var mem_avg = 0;
		if (!job.mem) job.mem = {};
		if (job.mem.total && job.mem.count) {
			mem_avg = Math.floor( job.mem.total / job.mem.count );
		}
		return get_text_from_bytes(mem_avg);
	}
	
	getTextJobResult(job) {
		// human-friendly job result
		var text = ucfirst( '' + job.code );
		if (!job.code) text = 'Success';
		else if (!text.match(/^(Warning|Critical|Abort)$/)) text = 'Error';
		return text;
	}
	
	getJobResultArgs(job) {
		var icon = '';
		var ocon = ''; // ocon == "outline icon"
		var color = '';
		var text = ucfirst( '' + job.code );
		
		if (!job.final) {
			icon = 'progress-clock';
			ocon = icon;
			color = 'blue';
			text = 'In Progress';
		}
		else if (!job.code) {
			icon = 'check-circle';
			ocon = icon + '-outline';
			color = 'green';
			text = 'Success';
		}
		else if (job.retried) {
			icon = 'redo-variant';
			ocon = icon;
			color = 'orange';
			text = 'Retried';
		}
		else switch(job.code) {
			case 'warning': icon = 'alert-rhombus'; ocon = icon + '-outline'; color = 'yellow'; break;
			case 'critical': icon = ocon = 'fire-alert'; color = 'purple'; break;
			case 'abort': icon = ocon = 'cancel'; color = 'gray'; text = 'Aborted'; break;
			
			default:
				icon = 'alert-decagram';
				ocon = icon + '-outline';
				color = 'red';
				text = 'Error';
			break;
		}
		
		return { icon, ocon, color, text };
	}
	
	getNiceJobResult(job) {
		// color label + icon for job result
		var args = this.getJobResultArgs(job);
		return '<span class="color_label ' + args.color + ' nowrap"><i class="mdi mdi-' + args.icon + '"></i>' + args.text + '</span>';
	}
	
	getNiceActionResult(action) {
		// color label + icon for action result
		var icon = 'check-circle';
		var color = 'green';
		var text = 'Success';
		
		if (action.code) {
			icon = 'alert-decagram';
			color = 'red';
			text = 'Error';
		}
		
		return '<span class="color_label ' + color + ' nowrap"><i class="mdi mdi-' + icon + '"></i>' + text + '</span>';
	}
	
	getNiceJobSource(job) {
		// get nice job source
		if (job.source.match(/scheduler/i)) {
			if (job.stype) {
				var stype = find_object( config.ui.event_trigger_type_menu, { id: job.stype } );
				if (stype) return `<i class="mdi mdi-${stype.icon}">&nbsp;</i>${stype.title}`;
			}
			if (job.splugin) return this.getNicePlugin(job.splugin, true);
			else return '<i class="mdi mdi-update">&nbsp;</i>Scheduler';
		}
		else if (job.source.match(/(plugin)/i)) {
			return '' + this.getNicePlugin(job.splugin, true) + '';
		}
		else if (job.source.match(/(user|manual)/i)) {
			return '' + this.getNiceUser(job.username, true) + '';
		}
		else if (job.source.match(/key/i)) {
			return '' + this.getNiceAPIKey(job.username, true) + '';
		}
		else if (job.source.match(/action/i)) {
			return '<i class="mdi mdi-eye-outline">&nbsp;</i>Action';
		}
		else if (job.source.match(/alert/i)) {
			return '<i class="mdi mdi-bell-outline">&nbsp;</i>Alert';
		}
		else if (job.source.match(/workflow/i)) {
			return '<i class="mdi mdi-clipboard-flow-outline">&nbsp;</i>Workflow';
		}
		else if (job.source.match(/magic/i)) {
			return '<i class="mdi mdi-link-variant">&nbsp;</i>Magic Link';
		}
		else return '(Unknown)';
	}
	
	getNiceJobSourceList(sources) {
		// get formatted (generic) source list from array of strings
		var self = this;
		if (!sources || !sources.length) return '(None)';
		
		return sources.map( function(source) {
			switch (source) {
				case 'scheduler': return '<i class="mdi mdi-update">&nbsp;</i>Scheduler';
				case 'user': return '<i class="mdi mdi-account">&nbsp;</i>User';
				case 'key': return '<i class="mdi mdi-key">&nbsp;</i>API Key';
				case 'action': return '<i class="mdi mdi-eye-outline">&nbsp;</i>Action';
				case 'workflow': return '<i class="mdi mdi-clipboard-flow-outline">&nbsp;</i>Workflow';
			}
		} ).join(', ');
	}
	
	getNiceLimitSource(source) {
		// get formatted limit source
		var icon = '';
		var title = ucfirst(source);
		
		switch (source) {
			case 'event': icon = 'file-clock-outline'; break;
			case 'workflow': icon = 'clipboard-flow-outline'; break;
			case 'category': icon = 'folder-open-outline'; break;
			case 'universal': icon = 'earth'; break;
		}
		
		return '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + title;
	}
	
	getNiceActionSource(source) {
		// get formatted action source
		var icon = '';
		var title = ucfirst(source);
		
		switch (source) {
			case 'event': icon = 'file-clock-outline'; break;
			case 'workflow': icon = 'clipboard-flow-outline'; break;
			case 'alert': icon = 'bell-outline'; break;
			case 'category': icon = 'folder-open-outline'; break;
			case 'group': icon = 'server-network'; break;
			case 'universal': icon = 'earth'; break;
		}
		
		return '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + title;
	}
	
	getNiceLanguage(id) {
		var def = find_object( app.config.intl.languages, { id: id } );
		return def ? def.title : id;
	}
	
	getNiceRegion(id) {
		var def = find_object( app.config.intl.regions, { id: id } );
		return def ? def.title : id;
	}
	
	getNiceNumberingSystem(id) {
		var def = find_object( app.config.intl.numberingSystems, { id: id } );
		return def ? def.title : id;
	}
	
	getNiceHourCycle(id) {
		var def = find_object( app.config.intl.hourCycles, { id: id } );
		return def ? def.title : id;
	}
	
	selfNav(args) {
		// construct nav URI to current page, but with new args
		return '#' + this.ID + compose_query_string(args);
	}
	
	selfMergeNav(args) {
		// costruct nav URI to current page, but with new args merged in with current args
		return this.selfNav(merge_objects(this.args, args));
	}
	
	getCategorizedEvents() {
		// get list of categorized events for menu
		// sorted by category, then by title
		var last_cat_id = '';
		var cat_map = obj_array_to_hash( app.categories, 'id' );
		
		var events = deep_copy_object(app.events).sort( function(a, b) {
			if (a.category == b.category) {
				return a.title.toLowerCase().localeCompare( b.title.toLowerCase() );
			}
			else {
				var cat_a = cat_map[ a.category ] || { sort_order: 99999 };
				var cat_b = cat_map[ b.category ] || { sort_order: 99999 };
				return (cat_a.sort_order < cat_b.sort_order) ? -1 : 1;
			}
		} );
		
		events.forEach( function(event) {
			if (event.type == 'workflow') event.icon = 'clipboard-flow-outline';
			
			if (event.category != last_cat_id) {
				last_cat_id = event.category;
				var cat = cat_map[ event.category ] || { title: event.category };
				event.group = cat.title;
			}
		} );
		
		return events;
	}
	
	getCategorizedServers(inc_offline) {
		// get list of categorized servers for menu
		// sorted by group, then by title/hostname
		var last_grp_id = '';
		var grp_map = obj_array_to_hash( app.groups, 'id' );
		var servers = Object.values(app.servers).map( function(server) { return { ...server }; } );
		
		// optionally merge in recently offline servers
		if (inc_offline) {
			for (var server_id in app.serverCache) {
				if (!app.servers[server_id]) {
					var server = app.serverCache[server_id];
					servers.push( merge_objects(server, { offline: true, icon: server.icon || 'close-network-outline' }) );
				}
			}
		}
		
		servers.sort( function(a, b) {
			if (a.groups[0] == b.groups[0]) {
				return (a.title || a.hostname).toLowerCase().localeCompare( (b.title || b.hostname).toLowerCase() );
			}
			else {
				var grp_a = grp_map[ a.groups[0] ] || { sort_order: 99999 };
				var grp_b = grp_map[ b.groups[0] ] || { sort_order: 99999 };
				return (grp_a.sort_order < grp_b.sort_order) ? -1 : 1;
			}
		} );
		
		servers.forEach( function(server) {
			server.title = server.title || app.formatHostname(server.hostname);
			
			if (server.groups[0] != last_grp_id) {
				last_grp_id = server.groups[0];
				var grp = grp_map[ server.groups[0] ] || { title: server.groups[0] };
				server.group = grp.title;
			}
		} );
		
		return servers;
	}
	
	getFormIDCopier() {
		return `<div class="form_suffix_icon mdi mdi-clipboard-text-outline" title="${config.ui.tooltips.copy_id}" onClick="$P().copyFormID(this)"></div>`;
	}
	
	// Utilities for working with CSV lists in database records
	
	recordAddTagCSV(tags_csv, tag) {
		// add a tag to a CSV list, preventing dupes, preserving order
		// return the new CSV list
		var tags = tags_csv ? tags_csv.split(/\,\s*/) : [];
		if (!tags.includes(tag)) tags.push(tag);
		return tags.join(', ');
	}
	
	recordRemoveTagCSV(tags_csv, tag) {
		// remove a tag from a CSV list, preventing dupes, preserving order
		// return the new CSV list
		var tags = tags_csv ? tags_csv.split(/\,\s*/) : [];
		var idx = tags.indexOf(tag);
		if (idx > -1) tags.splice(idx, 1);
		return tags.join(', ');
	}
	
	doQuickSearch(value) {
		// perform quick search, pages can override this
		Nav.go( '#Search?query=' + encodeURIComponent(value) );
	}
	
	// Box Buttons Floater:
	
	setupBoxButtonFloater(initially_visible) {
		// float box buttons if original is offscreen
		if (app.mobile) return;
		this.boxButtons = this.div.find('.box_buttons').last();
		
		// add hover tooltips to mobile_collapse buttons
		this.boxButtons.find('.button.mobile_collapse').each( function() {
			var $this = $(this);
			$this.attr('title', $this.find('span').text() );
		} );
		
		// delete previous if leftover
		if (this.boxFloater) this.boxFloater.remove();
		
		var $copy = this.boxButtons.clone();
		$copy.addClass('floater');
		if (!initially_visible) $copy.addClass('hidden').addClass('gone');
		this.div.append( $copy );
		
		this.boxFloater = $copy;
		this.updateBoxButtonFloaterState();
		this.updateBoxButtonFloaterPosition();
	}
	
	isRectVisible(rect) {
		// check if box buttons div is within the current viewport
		// var rect = this.boxButtons[0].getBoundingClientRect();
		
		if (rect.width == 0) return false;
		if (rect.height == 0) return false;
		if (rect.right < 0) return false;
		if (rect.left >= window.innerWidth) return false;
		if (rect.bottom < 0) return false;
		if (rect.top >= window.innerHeight) return false;
		
		return true;
	}
	
	updateBoxButtonFloaterPosition() {
		// update position of floater, called on resize
		if (!this.boxButtons || !this.boxFloater) return;
		
		var box = this.boxButtons[0].getBoundingClientRect();
		this.boxFloater.css({ left: box.left - 1, top: window.innerHeight - box.height, width: box.width + 2 });
	}
	
	updateBoxButtonFloaterState() {
		// update state of floater, and manage fade in/out
		// called on scroll
		var self = this;
		if (!this.boxButtons || !this.boxFloater) return;
		
		var box = this.boxButtons[0].getBoundingClientRect();
		var isVisible = this.isRectVisible(box);
		
		if (isVisible) {
			// box buttons are onscreen, so floater should go away
			if (!this.boxFloater.hasClass('hidden')) {
				this.boxFloater.addClass('hidden');
				setTimeout( function() { self.boxFloater.addClass('gone'); }, 400 );
			}
		}
		else {
			// box buttons are offscreen, so floater should be visible
			if (this.boxFloater.hasClass('gone')) {
				this.boxFloater.removeClass('gone');
				this.boxFloater.css({ left: box.left - 1, top: window.innerHeight - box.height, width: box.width + 2 });
				this.boxFloater[0].offsetWidth; // trigger dom reflow
			}
			if (this.boxFloater.hasClass('hidden')) this.boxFloater.removeClass('hidden');
		}
	}
	
	cleanupBoxButtonFloater() {
		// remove our mess
		if (this.boxFloater) this.boxFloater.remove();
		delete this.boxButtons;
		delete this.boxFloater;
	}
	
	buildOptGroup(items, title, default_icon, id_prefix) {
		// build makeshift optgroup for form-menu-single
		var opts = deep_copy_object(items);
		if (opts[0]) opts[0].group = title;
		
		opts.forEach( function(opt) {
			if (id_prefix) opt.id = id_prefix + opt.id;
			if (!opt.icon && default_icon) opt.icon = default_icon;
		} );
		
		return opts;
	}
	
	buildJobFilterOpts() {
		// get list of common job filter options for quick-search menus
		return [
			{ id: '', title: 'All Jobs', icon: 'calendar-search' },
			{ id: 'z_success', title: 'Successes', icon: 'check-circle-outline' },
			{ id: 'z_error', title: 'Errors', icon: 'alert-decagram-outline' },
			{ id: 'z_warning', title: 'Warnings', icon: 'alert-outline' },
			{ id: 'z_critical', title: 'Criticals', icon: 'fire-alert' },
			{ id: 'z_abort', title: 'Aborts', icon: 'cancel' }
		].concat(
			this.buildOptGroup( app.tags, "Tags:", 'tag-outline', 't_' )
		).concat(
			{ id: 'z_retried', title: "Retried", icon: 'refresh', group: "System Tags:" },
			{ id: 'z_last', title: "Last in Set", icon: 'page-last' },
			{ id: 'z_test', title: "Test Job", icon: 'test-tube' }
		);
	}
	
	buildServerOptGroup(title, default_icon) {
		// build menu group specifically for servers
		// sorted properly, with labels and icons
		var servers = Object.values(app.servers).sort( 
			function(a, b) {
				return ( a.title || a.hostname ).localeCompare( b.title || b.hostname );
			} 
		).map( 
			function(server) {
				return merge_objects( server, { title: server.title || server.hostname } );
			}
		);
		
		return this.buildOptGroup( servers, title || "Servers:", default_icon || 'router-network' );
	}
	
	// Page State/Draft System
	
	savePageSnapshot(data) {
		// save page data as initial state for comparison
		var loc = Nav.currentAnchor();
		app.pageSnapshots[ loc ] = stableSerialize(data);
	}
	
	deletePageSnapshot() {
		// delete page snapshot
		var loc = Nav.currentAnchor();
		delete app.pageSnapshots[ loc ];
	}
	
	checkSavePageDraft(data) {
		// if current data state has changed, save draft (in memory)
		// (called as user is leaving page)
		// (have to use Nav.loc here, as Nav.currentAnchor() will already reflect new destination page)
		var snap = app.pageSnapshots[ Nav.loc ];
		if (!snap) return false;
		
		// now do the compare
		var curr = stableSerialize(data);
		if (snap != curr) {
			// user made changes, save a draft -- keep snap as well
			app.pageDrafts[ Nav.loc ] = curr;
			return true;
		}
		else {
			// no changes, discard snap
			delete app.pageSnapshots[ Nav.loc ];
		}
		
		return false;
	}
	
	getPageDraft() {
		// see if we have a draft for the current page
		var loc = Nav.currentAnchor();
		return app.pageDrafts[ loc ];
	}
	
	checkRestorePageDraft() {
		// see if user has a saved draft for the current page
		// if so, parse and return it as an object
		var draft = this.getPageDraft();
		if (!draft) return false;
		
		return JSON.parse(draft);
	}
	
	deletePageDraft() {
		// delete page draft, if any
		var loc = Nav.currentAnchor();
		delete app.pageDrafts[ loc ];
	}
	
	// Upcoming Job Prediction
	
	predictUpcomingJobs(opts) {
		// simulate schedule for predicting future jobs
		// opts: { events, duration, burn, max, progress, callback }
		if (!opts.start) opts.start = normalize_time( Math.floor(app.epoch), { sec: 0 } ) + 60; // next minute
		if (!opts.duration) opts.duration = 86400; // default 24 hours
		if (!opts.burn) opts.burn = 16; // default 16ms cpu time per chunk
		if (!opts.max) opts.max = 10000; // max 10k jobs in array
		
		opts.epoch = opts.start; // starting time
		opts.end = opts.start + opts.duration; // where to stop (inclusive)
		opts.jobs = []; // output jobs
		opts.formatters = {}; // intl formatters
		
		opts.events = deep_copy_object(opts.events).filter( function(event) { 
			if (!event.enabled) return false;
			if (!event.triggers || !event.triggers.length) return false; // on-demand
			
			// check for disabled category
			var category = find_object( app.categories, { id: event.category } );
			if (!category.enabled) return false;
			
			// check for disabled plugin
			if (event.plugin && !event.plugin.match(/^_/)) {
				var plugin = find_object( app.plugins, { id: event.plugin } );
				if (plugin && !plugin.enabled) return false;
			}
			
			// process triggers
			var triggers = event.triggers.filter( function(trigger) { return trigger.enabled; } );
			var schedules = triggers.filter( function(trigger) { return trigger.type.match(/^(schedule|single|interval)$/); } );
			if (!schedules.length) return false;
			
			// setup all unique timezones (intl formatters)
			schedules.forEach( function(trigger) {
				if (trigger.type != 'schedule') return;
				var tz = trigger.timezone || app.config.tz;
				if (tz in opts.formatters) return; // already setup
				
				opts.formatters[tz] = new Intl.DateTimeFormat('en-US', 
					{ year: 'numeric', month: '2-digit', day: 'numeric', weekday: 'long', hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: tz }
				);
			} );
			
			// store some props for fast access below
			event.schedules = schedules;
			event.ranges = triggers.filter( function(trigger) { return (trigger.type == 'range') || (trigger.type == 'blackout'); } );
			return true;
		} ); // filter events
		
		if (!opts.events.length) return opts.callback([]);
		
		this.currentPrediction = opts;
		this.predictNextChunk();
	}
	
	predictNextChunk() {
		// predict one chunk of upcoming jobs (limit CPU burn)
		var self = this;
		var opts = this.currentPrediction;
		if (!opts) return; // sanity
		
		if (!this.active) {
			// user navigated away from page -- abort!
			delete this.currentPrediction;
			return;
		}
		
		var pstart = performance.now();
		var date = new Date();
		var tzargs = {};
		var days = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
		
		do {
			// predict jobs for current minute
			date.setTime( opts.epoch * 1000 );
			
			// convert date to all unique timezones we care about and argify it
			// { month: 11, day: 29, weekday: 2, year: 2022, hour: 22, minute: 29 }
			for (var tz in opts.formatters) {
				if (!tzargs[tz]) tzargs[tz] = {};
				
				opts.formatters[tz].formatToParts(date).forEach( function(part) {
					if (part.type == 'literal') return;
					if (part.type == 'weekday') tzargs[tz][ part.type ] = days[ part.value ];
					else tzargs[tz][ part.type ] = parseInt( part.value );
				} );
				
				// include reverse-month-day (rday): -1 is last day of month, -2 is 2nd-to-last day, etc.
				tzargs[tz].rday = (tzargs[tz].day - app.getLastDayInMonth( tzargs[tz].year, tzargs[tz].month )) - 1;
			}
			
			// do any events need to run this minute?
			// { "type": "schedule", "enabled": true, "years": [2023], "months": [3, 4, 5], "days": [1, 15], "weekdays": [1, 2, 3, 4, 5], "hours": [6, 7, 8, 9, 10], "minutes": [15, 45] }
			opts.events.forEach( function(event) {
				var scheduled = false;
				var extras = {};
				
				event.schedules.forEach( function(trigger) {
					if ((trigger.type == 'single') && (trigger.epoch == opts.epoch)) {
						scheduled = 'single';
						return;
					}
					if (trigger.type == 'interval') {
						var hits = interval_hits_per_minute(trigger, opts.epoch);
						if (hits.length) {
							scheduled = 'interval';
							extras.seconds = hits;
							return;
						}
					}
					
					if (trigger.type != 'schedule') return; // sanity
					var tz = trigger.timezone || app.config.tz;
					var dargs = tzargs[tz];
					
					if (trigger.years && trigger.years.length && !trigger.years.includes(dargs.year)) return;
					if (trigger.months && trigger.months.length && !trigger.months.includes(dargs.month)) return;
					if (trigger.days && trigger.days.length && !trigger.days.includes(dargs.day) && !trigger.days.includes(dargs.rday)) return;
					if (trigger.weekdays && trigger.weekdays.length && !trigger.weekdays.includes(dargs.weekday)) return;
					if (trigger.hours && trigger.hours.length && !trigger.hours.includes(dargs.hour)) return;
					if (trigger.minutes && trigger.minutes.length && !trigger.minutes.includes(dargs.minute)) return;
					
					scheduled = 'schedule';
				} ); // foreach schedule
				
				if (!scheduled) return;
				
				// check ranges
				// (both start/end dates are INCLUSIVE)
				event.ranges.forEach( function(trigger) {
					switch (trigger.type) {
						case 'range':
							if (trigger.start && (opts.epoch < trigger.start)) scheduled = false;
							else if (trigger.end && (opts.epoch > trigger.end)) scheduled = false;
						break;
						
						case 'blackout':
							if ((opts.epoch >= trigger.start) && (opts.epoch <= trigger.end)) scheduled = false;
						break;
					}
				} );
				
				if (!scheduled) return;
				
				// add job!
				opts.jobs.push({ event: event.id, epoch: opts.epoch, type: scheduled, ...extras });
				
			} ); // foreach event
			
			opts.epoch += 60; // skip to next minute
		}
		while ((performance.now() - pstart < opts.burn) && (opts.epoch <= opts.end));
		
		if ((opts.epoch > opts.end) || (opts.jobs.length >= opts.max)) {
			// all done, reached target epoch (inclusive)
			if (opts.jobs.length > opts.max) opts.jobs.splice( opts.max );
			delete this.currentPrediction;
			return opts.callback(opts.jobs);
		}
		else {
			// not done, optionally call progress handler
			if (opts.progress) opts.progress( (opts.epoch - opts.start) / opts.duration, opts.jobs );
			
			// schedule next chunk after a frame of sleep
			setTimeout( function() { self.predictNextChunk(); }, 1 );
		}
	}
	
	// Chart Utils
	
	createChart(opts) {
		// merge opts with overrides and add user locale, return new chart
		opts.locale = this.getUserLocale();
		opts.timeZone = this.getUserTimezone();
		opts.reducedMotion = true; // app.reducedMotion();
		return new Chart( Object.assign({ dirty: true }, config.ui.chart_defaults, config.chart_defaults, opts) );
	}
	
	setupChartHover(key) {
		// setup chart hover overlay system, with custom actions
		var self = this;
		var chart = this.charts[key];
		var max_zoom = 300; // 5 minutes
		
		chart.on('mouseover', function(event) {
			var menu_html = '';
			var zoom_html = '';
			
			if (chart._allow_flatten) {
				menu_html = '<div class="chart_icon ci_fl" title="Change Graph Type"><i class="mdi mdi-cog"></i><select onChange="$P().setChartFlattenMode(\'' + key + '\',this)">' + render_menu_options(config.ui.chart_flatten_menu, app.getPref('charts.' + key)) + '</select></div>';
			}
			
			if (chart._allow_zoom) {
				zoom_html = '<div class="chart_icon ci_zo ' + (self.chartZoom ? 'selected' : '') + '" title="Disable Zoom Mode" onClick="$P().chartDisableZoom(\'' + key + '\',this)"><i class="mdi mdi-magnify"></i></div>';
				$('.pxc_tt_overlay').css('cursor', 'zoom-in');
			}
			
			$('.pxc_tt_overlay').html(
				'<div class="chart_toolbar ct_' + key + '">' + menu_html + 
					'<div class="chart_icon ci_di" title="Download Image" onClick="$P().chartDownload(\'' + key + '\')"><i class="mdi mdi-cloud-download-outline"></i></div>' + 
					'<div class="chart_icon ci_cl" title="Copy Image Link" onClick="$P().chartCopyLink(\'' + key + '\',this,event)"><i class="mdi mdi-clipboard-pulse-outline"></i></div>' + zoom_html + 
				'</div>' 
			);
		}); // mouseover
		
		chart.on('mousedown', function(event) {
			// only process click if inside canvas area (if tooltip is present)
			if (!chart.tooltip || !chart._allow_zoom) return;
			
			// get current data limits (also affected by prev zooms)
			var limits = chart.dataLimits;
			
			// abort if zoomed in too far
			if (limits.width <= max_zoom) return;
			
			// setup state if first zoom
			if (!self.chartZoom) {
				self.chartZoom = {
					orig_limits: Object.assign({}, chart.dataLimits),
					orig_zoom: chart.zoom ? Object.assign({}, chart.zoom) : null,
					charts: Object.values(self.charts).filter( function(chart) { return !!chart._allow_zoom; } )
				};
				self.chartZoom.charts.forEach( function(chart) { chart.clip = true; } );
				$('.pxc_tt_overlay .chart_icon.ci_zo').addClass('selected');
			}
			
			if (self.chartZoom.animation) {
				// zoom animation already in progress
				if (self.chartZoom.animation.final) return; // do not interrupt final animation
				cancelAnimationFrame( self.chartZoom.animation.raf ); // takeover
			}
			
			// setup zoom animation
			var anim = self.chartZoom.animation = {
				start: performance.now(),
				duration: app.reducedMotion() ? 1 : 400,
				
				xMinCurrent: limits.xMin,
				xMaxCurrent: limits.xMax
			};
			
			// center new zoom area around mouse cursor (tooltip epoch)
			var amt = Math.floor(limits.width / 4);
			if (event.altKey) amt = Math.floor(limits.width * 2); // zoom out
			
			anim.xMinTarget = chart.tooltip.epoch - amt;
			anim.xMaxTarget = chart.tooltip.epoch + amt;
			
			// constrain
			if (anim.xMinTarget < self.chartZoom.orig_limits.xMin) anim.xMinTarget = self.chartZoom.orig_limits.xMin;
			if (anim.xMaxTarget > self.chartZoom.orig_limits.xMax) anim.xMaxTarget = self.chartZoom.orig_limits.xMax;
			
			// if we're going to end up all zoomed out, set final flag
			if ((anim.xMinTarget == self.chartZoom.orig_limits.xMin) && (anim.xMaxTarget == self.chartZoom.orig_limits.xMax)) {
				anim.final = true;
			}
			
			// start ze frame ticker
			anim.raf = requestAnimationFrame( self.animateChartZoom.bind(self) );
		});
	}
	
	animateChartZoom() {
		// render frame of chart zoom animation, schedule next frame
		if (!this.active || !this.charts || !this.chartZoom || !this.chartZoom.animation) return; // sanity
		
		var self = this;
		var anim = this.chartZoom.animation;
		var now = performance.now();
		
		var progress = Math.min(1.0, (now - anim.start) / anim.duration ); // linear
		var eased = progress * progress * (3 - 2 * progress); // ease-in-out
		
		var xmin = anim.xMinCurrent + ((anim.xMinTarget - anim.xMinCurrent) * eased);
		var xmax = anim.xMaxCurrent + ((anim.xMaxTarget - anim.xMaxCurrent) * eased);
		
		this.chartZoom.charts.forEach( function(chart) {
			if (!chart.zoom) chart.zoom = {};
			chart.zoom.xMin = xmin;
			chart.zoom.xMax = xmax;
			chart.dirty = true;
		} );
		
		ChartManager.check();
		
		if (progress < 1.0) {
			// more frames still needed
			anim.raf = requestAnimationFrame( this.animateChartZoom.bind(this) );
		}
		else {
			// done, cleanup
			delete this.chartZoom.animation;
			
			if (anim.final) {
				// disable zoom mode as well
				this.chartZoom.charts.forEach( function(chart) { 
					chart.zoom = self.chartZoom.orig_zoom ? Object.assign({}, self.chartZoom.orig_zoom) : null;
					chart.clip = false;
					chart.dirty = true;
				} );
				$('.pxc_tt_overlay .chart_icon.ci_zo').removeClass('selected');
				delete this.chartZoom;
			}
		}
	}
	
	chartDisableZoom(key, elem) {
		// disable zoom mode, from user click
		var chart = this.charts[key];
		var $elem = $(elem);
		
		if (!this.chartZoom) return; // sanity
		if (this.chartZoom.animation) return; // zoom animation already in progress
		
		// setup final zoom-out animation
		var anim = this.chartZoom.animation = {
			start: performance.now(),
			duration: app.reducedMotion() ? 1 : 400,
			
			xMinCurrent: chart.dataLimits.xMin,
			xMaxCurrent: chart.dataLimits.xMax,
			
			xMinTarget: this.chartZoom.orig_limits.xMin,
			xMaxTarget: this.chartZoom.orig_limits.xMax,
			
			final: true // cleanup when animation completes
		};
		
		// if we're already really close, just skip animation
		if ((Math.abs(anim.xMinTarget - anim.xMinCurrent) < 1.0) && (Math.abs(anim.xMaxTarget - anim.xMaxCurrent) < 1.0)) anim.duration = 1;
		
		// start ze frame ticker
		anim.raf = requestAnimationFrame( this.animateChartZoom.bind(this) );
		
		// immediate user feedback (cosmetic)
		$('.pxc_tt_overlay .chart_icon.ci_zo').removeClass('selected');
	}
	
	setupCustomHeadroom(id) {
		// add custom function for smoothly animating headroom (yMax)
		var chart = this.charts[id];
		if (!chart) return;
		
		if (app.reducedMotion()) return;
		
		var yMaxTarget = false;
		var yMaxCurrent = false;
		
		chart.customHeadroom = function() {
			// called during draw cycle, just after calculating limits
			var limits = chart.dataLimits;
			if (yMaxTarget === false) { yMaxTarget = yMaxCurrent = limits.yMax; return; }
			
			yMaxTarget = limits.yMax;
			yMaxCurrent = yMaxCurrent + ((yMaxTarget - yMaxCurrent) / 8);
			if (Math.abs(yMaxTarget - yMaxCurrent) < 1.0) yMaxCurrent = yMaxTarget;
			
			limits.yMax = Math.floor( yMaxCurrent );
		};
	}
	
	updateChartFlatten(id) {
		// update flatten settings on chart, based on user prefs
		var chart = this.charts[id];
		if (!chart) return;
		
		var flatten_mode = app.getPref('charts.' + id);
		if (flatten_mode) {
			var menu_item = find_object( config.ui.chart_flatten_menu, { id: flatten_mode } );
			chart.flatten = {
				type: flatten_mode,
				tooltipTitle: menu_item.title,
				prefixTitle: menu_item.title,
				color: chart.colors[ chart._idx % chart.colors.length ]
			};
		}
		else {
			chart.flatten = null;
		}
	}
	
	setChartFlattenMode(id, elem) {
		// set new chart flatten mode based on menu selection
		var chart = this.charts[id];
		var mode = elem.value;
		
		if (mode) app.setPref('charts.' + id, mode);
		else app.deletePref('charts.' + id);
		
		this.updateChartFlatten(id);
		chart.update();
	}
	
	chartDownload(key) {
		// download chart image with custom filename
		// (this all happens client-side)
		var chart = this.charts[key];
		var filename = '';
		
		// possibly customize filename for current page
		if (this.job) filename = 'xyops-job-' + this.job.id + '-' + get_unique_id(8) + '-' + key + '.png';
		else if (this.server) filename = 'xyops-server-' + this.server.id + '-' + get_unique_id(8) + '-' + key + '.png';
		else if (this.snapshot) filename = 'xyops-snapshot-' + this.snapshot.id + '-' + get_unique_id(8) + '-' + key + '.png';
		else if (this.event) filename = 'xyops-event-' + this.event.id + '-' + get_unique_id(8) + '-' + key + '.png';
		else filename = 'xyops-' + get_unique_id(8) + '-' + key + '.png';
		
		chart.download({
			filename: filename,
			format: 'png', 
			quality: 1.0, 
			width: 1024, 
			height: 512, 
			density: 1
		});
	}
	
	chartCopyLink(key, elem, event) {
		// upload image to server and copy link to it
		var chart = this.charts[key];
		var $elem = $(elem);
		
		// hold opt/alt to copy json instead
		if (event.altKey) return this.chartCopyJSON(key, elem);
		
		// generate unique ID client-side and "predict" the URL
		// so we can copy it to the clipboard in the click thread
		var filename = '';
		
		// possibly customize filename for current page
		if (this.job) filename = 'job-' + this.job.id + '-' + get_unique_id(16) + '-' + key + '.png';
		else if (this.server) filename = 'server-' + this.server.id + '-' + get_unique_id(16) + '-' + key + '.png';
		else if (this.snapshot) filename = 'snapshot-' + this.snapshot.id + '-' + get_unique_id(16) + '-' + key + '.png';
		else if (this.event) filename = 'event-' + this.event.id + '-' + get_unique_id(16) + '-' + key + '.png';
		else filename = '' + get_unique_id(16) + '-' + key + '.png';
		
		var clip_url = location.origin + '/files/' + app.username + '/' + filename;
		copyToClipboard(clip_url);
		
		// show intermediate progress in icon
		$elem.find('i').removeClass().addClass('mdi mdi-clipboard-arrow-up-outline');
		
		var opts = {
			type: 'blob', 
			format: 'png', 
			quality: 1.0, 
			width: 1024, 
			height: 512, 
			density: 1
		};
		chart.snapshot(opts, function(blob) {
			// next, upload our blob
			var form = new FormData();
			form.append( 'file1', blob, filename );
			
			app.api.upload('app/upload_files', form, function(resp) {
				// file uploaded successfully!  show check in icon
				$elem.find('i').removeClass().addClass('mdi mdi-clipboard-check-outline success');
			});
		}); // snapshot
	}
	
	chartCopyJSON(key, elem) {
		// copy chart JSON to clipboard
		var chart = this.charts[key];
		var $elem = $(elem);
		var json = JSON.stringify( { title: chart.title, layers: chart.flatten ? [chart.flatten] : chart.layers } );
		copyToClipboard(json);
		$elem.find('i').removeClass().addClass('mdi mdi-clipboard-check-outline success');
	}
	
	getQuickMonChartData(rows, id) {
		// format quickmon data to be compat with pixl-chart
		var data = [];
		rows.forEach( function(row) {
			data.push({ x: row.date, y: row[id] || 0 });
		} );
		return data;
	}
	
	getMonitorChartData(rows, def) {
		// format monitor timeline data to be compat with pixl-chart
		var id = def.id;
		var data = [];
		
		rows.forEach( function(row) {
			if (row.date && row.totals) {
				var item = { x: row.date, y: (row.totals[id] || 0) / (row.count || 1) };
				if (row.alerts) {
					// check for alert overlays
					for (var alert_id in row.alerts) {
						var alert_def = find_object( app.alerts, { id: alert_id } );
						if (alert_def && alert_def.monitor_id && (alert_def.monitor_id == id)) {
							item.label = { "text": "Alert", "color": "red", "tooltip": true };
						}
					}
				} // row.alerts
				data.push(item);
			}
		} );
		
		// for delta monitors: drop last sample if it has a lower count than the previous
		// (partial counts will not avg properly for deltas)
		if (def.delta && (rows.length > 1)) {
			var last_row = rows[ rows.length - 1 ];
			var last_row_2 = rows[ rows.length - 2 ];
			if (last_row.count < last_row_2.count) data.pop();
		}
		
		return data;
	}
	
	// Event/Job Plugin Parameters
	
	renderPluginParams(sel) {
		// show summary of plugin param values in event
		var self = this;
		var item = this.job || this.event;
		var params = item.params || {};
		var plugin = find_object( app.plugins, { id: item.plugin } );
		var html = '';
		
		if (!plugin || !plugin.params.length) {
			this.div.find(sel).hide();
			return;
		}
		
		html += '<div class="summary_grid">' + this.getParamSummaryGrid(plugin.params, params) + '</div>';
		
		this.div.find(sel).show();
		this.div.find( sel + ' > .box_title > span').html( plugin.title + " Parameters" );
		this.div.find( sel + ' > .box_content').html( html );
	}
	
	getParamSummaryGrid(fields, params) {
		// get HTML for a summary grid containing param previews
		// (for plugin params or event params)
		var self = this;
		var html = '';
		var none = '<span>(None)</span>';
		
		fields.forEach( function(param, idx) {
			var elem_value = (param.id in params) ? params[param.id] : param.value;
			if (!elem_value) elem_value = "";
			var elem_icon = config.ui.control_type_icons[param.type];
			var after = '';
			if (param.type == 'hidden') return;
			
			html += '<div>'; // grid unit
			html += '<div class="info_label">' + (param.locked ? '<i class="mdi mdi-lock-outline">&nbsp;</i>' : '') + strip_html(param.title) + '</div>';
			html += '<div class="info_value">';
			
			switch (param.type) {
				case 'text':
					if (elem_value.toString().length) {
						html += '<i class="link mdi mdi-' + elem_icon + '" onClick="$P().copyPluginParamValue(this)" title="Copy to Clipboard">&nbsp;</i>';
						html += '<span class="data_value">' + encode_entities(elem_value) + '</span>';
					}
					else html += none;
				break;
				
				case 'textarea':
				case 'code':
					if (elem_value.toString().length) {
						html += '<i class="link mdi mdi-' + elem_icon + '" onClick="$P().copyPluginParamValue(this)" title="Copy to Clipboard">&nbsp;</i>';
						html += '<button class="link" onClick="$P().viewPluginParamValue(this)">Click to View...</button>';
						html += '<span class="data_value" style="display:none" data-title="' + encode_attrib_entities(param.title) + '">' + encode_entities(elem_value) + '</span>';
					}
					else html += none;
				break;
				
				case 'json':
					html += '<i class="link mdi mdi-' + elem_icon + '" onClick="$P().copyPluginParamValue(this)" title="Copy to Clipboard">&nbsp;</i>';
					html += '<button class="link" onClick="$P().viewPluginParamValue(this)">Click to View...</button>';
					html += '<span class="data_value" style="display:none" data-title="' + encode_attrib_entities(param.title) + '">' + encode_entities(JSON.stringify(elem_value, null, "\t")) + '</span>';
				break;
				
				case 'checkbox':
					elem_icon = elem_value ? 'checkbox-marked-outline' : 'checkbox-blank-outline';
					html += '<i class="mdi mdi-' + elem_icon + '">&nbsp;</i>';
					if (elem_value) html += 'Yes';
					else html += '<span>No</span>'; 
				break;
				
				case 'select':
					html += '<i class="link mdi mdi-' + elem_icon + '" onClick="$P().copyPluginParamValue(' + idx + ')" title="Copy to Clipboard">&nbsp;</i>';
					html += '<span class="data_value">' + encode_entities( elem_value.toString().replace(/\,.*$/, '') ) + '</span>';
				break;
				
				case 'toolset':
					if (!param.data) param.data = {};
					if (!param.data.tools) param.data.tools = [];
					var tool = find_object( param.data.tools, { id: elem_value } );
					if (tool) {
						html += `<i class="mdi mdi-${elem_icon}">&nbsp;</i><span class="data_value">${strip_html(tool.title)}</span>`;
						if (tool.fields) after = self.getParamSummaryGrid(tool.fields, params);
					}
				break;
			} // switch type
			
			html += '</div>'; // info_value
			html += '</div>'; // grid unit
			html += after;
		} ); // foreach param
		
		return html;
	}
	
	copyPluginParamValue(elem) {
		// copy specific plugin param value to the clipboard
		var $elem = $(elem);
		var $info_value = $elem.closest('div.info_value');
		var $data_value = $info_value.find('span.data_value');
		
		copyToClipboard( $data_value.text() );
		
		app.showMessage('info', "Parameter value copied to your clipboard.");
	}
	
	viewPluginParamValue(elem) {
		// popup dialog to show multi-line text box param value
		var $elem = $(elem);
		var $info_value = $elem.closest('div.info_value');
		var $data_value = $info_value.find('span.data_value');
		var text = $data_value.text();
		var formats = null;
		
		// if text is single line, and is not obviously json, prevent auto-detect on format
		if (!text.trim().match(/\n/) && !text.match(/^\s*\{[\S\s]+\}\s*$/)) formats = ['text'];
		
		this.viewCodeAuto( $data_value.data('title'), text, formats );
	}
	
	viewCodeAuto(title, data, formats) {
		// popup dialog to show pretty-printed code (auto-detect)
		var self = this;
		var value = this._temp_code = ((typeof(data) == 'string') ? data : JSON.stringify(data, null, "\t"));
		var html = '';
		
		html += '<div class="code_viewer scroll_shadows">';
		html += '<pre><code class="hljs">' + app.highlightAuto(value, formats) + '</code></pre>';
		html += '</div>';
		
		var buttons_html = "";
		buttons_html += '<div class="button" title="Copy to Clipboard" onClick="$P().copyCodeToClipboard()"><i class="mdi mdi-clipboard-text-outline">&nbsp;</i>Copy</div>';
		buttons_html += '<div class="button primary" onClick="CodeEditor.hide()"><i class="mdi mdi-close-circle-outline">&nbsp;</i>Close</div>';
		
		CodeEditor.showSimpleDialog(title, html, buttons_html);
		
		CodeEditor.onHide = function() {
			delete self._temp_code;
		};
	}
	
	viewMarkdownAuto(title, text, btn) {
		// popup dialog to show pretty-printed markdown
		var self = this;
		this._temp_code = text;
		var html = '';
		
		html += '<div class="code_viewer scroll_shadows">';
		html += '<div class="markdown-body">';
		
		html += marked.parse(text, config.ui.marked_config);
		
		html += '</div>'; // markdown-body
		html += '</div>'; // code_viewer
		
		var buttons_html = "";
		if (btn) buttons_html += btn;
		else buttons_html += '<div class="button" title="Copy to Clipboard" onClick="$P().copyCodeToClipboard()"><i class="mdi mdi-clipboard-text-outline">&nbsp;</i>Copy</div>';
		buttons_html += '<div class="button primary" onClick="Dialog.confirm_click(true)"><i class="mdi mdi-close-circle-outline">&nbsp;</i>Close</div>';
		
		Dialog.showSimpleDialog(title, html, buttons_html);
		
		// special mode for key capture
		Dialog.active = 'confirmation';
		Dialog.confirm_callback = function(result) { 
			if (result) Dialog.hide(); 
		};
		Dialog.onHide = function() {
			delete self._temp_code;
		};
		
		this.highlightCodeBlocks('#dialog .markdown-body');
		this.expandInlineImages('#dialog .markdown-body');
	}
	
	copyCodeToClipboard() {
		// copy code currently being displayed in dialog to clipboard
		if (this._temp_code) {
			copyToClipboard(this._temp_code);
			app.showMessage('info', "The data was copied to your clipboard.");
		}
		else if (this.editor) {
			copyToClipboard(this.editor.getValue());
			app.showMessage('info', "The data was copied to your clipboard.");
		}
	}
	
	highlightCodeBlocks(elem) {
		// highlight code blocks inside markdown doc
		var self = this;
		if (!elem) elem = this.div;
		else if (typeof(elem) == 'string') elem = $(elem);
		
		elem.find('pre code').each( function() {
			if (this.innerText.match(/^\s*\{[\S\s]+\}\s*$/)) this.classList.add('language-json');
			if (this.classList.length) hljs.highlightElement(this);
		});
	}
	
	getDiffHTML(old_obj, new_obj, verbose) {
		// get HTML for diff
		var old_text = stablePrettyStringify( old_obj || {} );
		var new_text = stablePrettyStringify( new_obj || {} );
		var changes = Diff.diffLines( old_text, new_text );
		var html = '';
		
		if (find_objects( changes, { added: true } ).length || find_objects( changes, { removed: true } ).length) {
			// we have changes
			changes.forEach( function(change) {
				var lines = [];
				var class_name = '';
				
				if (change.removed) {
					lines = change.value.trimRight().split(/\n/);
					class_name = 'diff_removed';
				}
				else if (change.added) {
					lines = change.value.trimRight().split(/\n/);
					class_name = 'diff_added';
				}
				else {
					lines = change.value.replace(/\n$/, '').split(/\n/);
					if ((lines.length > 2) && !verbose) {
						var top = lines.shift();
						var bottom = lines.pop();
						lines = [ top, "...", bottom ];
					}
					class_name = 'diff_same';
				}
				
				lines.forEach( function(line) {
					html += '<div class="' + class_name + '">' + encode_entities(line) + '</div>';
				} );
			}); // foreach change
		}
		else {
			// no changes
			return false;
		}
		
		return html;
	}
	
	setupEditor(mode = null) {
		// codemirror go!
		var self = this;
		var elem = document.getElementById("fe_editor");
		var auto_mode = !mode;
		
		$(elem).closest('div').attr('aria-label', config.ui.labels.code_editor);
		
		if (!mode && elem.value.length) {
			mode = this.defaultEditorMode || app.detectCodemirrorMode(elem.value) || null;
			Debug.trace('debug', "Detected initial language: " + mode);
		}
		
		this.editor = CodeMirror.fromTextArea(elem, merge_objects( config.editor_defaults, {
			mode: { name: 'mustache', backdrop: mode },
			theme: app.getCodemirrorTheme(),
			viewportMargin: Infinity,
			
			extraKeys: {
				'Esc': function() { app.focusNext(); }
			}
		}));
		
		if (auto_mode) this.setupEditorAutoDetect();
		
		// required for auto-sizing to fit width
		setTimeout( function() { self.handleEditorResize(); }, 100 );
		setTimeout( function() { self.handleEditorResize(); }, 200 );
		setTimeout( function() { self.handleEditorResize(); }, 300 );
		setTimeout( function() { self.handleEditorResize(); }, 400 );
		setTimeout( function() { self.handleEditorResize(); }, 500 );
	}
	
	setupEditorAutoDetect() {
		// setup change/paste listeners to sniff for content format
		var self = this;
		
		this.editor.on('change', debounce(function() {
			// debounce to 1000ms as to not cause high CPU while typing
			// also, do not auto-detect beyond 1K of text, for same reason
			var value = self.editor.getValue();
			if (value.length < 4096) {
				var old_mode = self.editor.getOption('mode');
				if (old_mode.backdrop) old_mode = old_mode.backdrop;
				var mode = self.defaultEditorMode || app.detectCodemirrorMode(value) || null;
				
				if (mode != old_mode) {
					Debug.trace('debug', "Detected language: " + mode);
					self.editor.setOption('mode', { name: 'mustache', backdrop: mode });
					self.editor.refresh();
				}
			}
		}, 1000));
		
		this.editor.on('paste', function() {
			// delay 1ms so we can get the full editor content
			setTimeout( function() { 
				var value = self.editor.getValue();
				var old_mode = self.editor.getOption('mode');
				if (old_mode.backdrop) old_mode = old_mode.backdrop;
				var mode = self.defaultEditorMode || app.detectCodemirrorMode(value) || null;
				
				if (mode != old_mode) {
					Debug.trace('debug', "Detected language: " + mode);
					self.editor.setOption('mode', { name: 'mustache', backdrop: mode });
					self.editor.refresh();
				}
			}, 1 );
		});
	}
	
	handleEditorResize() {
		// fix ze codemirrorz
		if (this.editor) {
			this.div.find('.CodeMirror').css('width', '' + this.div.find('div.fr_content').first().width() + 'px' );
			this.editor.refresh();
		}
	}
	
	handleEditorThemeChange(theme) {
		if (this.editor) {
			this.editor.setOption( 'theme', app.cmThemeMap[theme] );
		}
	}
	
	killEditor() {
		// shutdown codemirror safely
		if (this.editor) {
			this.editor.setOption("mode", 'text');
			this.editor.toTextArea();
			delete this.editor;
		}
	}
	
	editorSurroundText(chars) {
		// surround selection with chars, or remove them
		var editor = this.editor;
		editor.focus();
		
		var last_line_idx = editor.lastLine();
		var last_line_str = editor.getLine( last_line_idx );
		
		var doc_start = { line: 0, ch: 0 };
		var doc_end = { line: last_line_idx, ch: last_line_str.length };
		
		var sel_start = editor.getCursor('from');
		var sel_end = editor.getCursor('to');
		
		if (sel_start.line != sel_end.line) return; // sanity
		
		var before = editor.getRange( doc_start, sel_start );
		var selection = editor.getRange( sel_start, sel_end );
		var after = editor.getRange( sel_end, doc_end );
		
		var endsWith = new RegExp( escape_regexp(chars) + '$' );
		var startsWith = new RegExp( '^' + escape_regexp(chars) );
		
		if (before.match(endsWith) && after.match(startsWith)) {
			// remove chars
			sel_start.ch -= chars.length;
			sel_end.ch += chars.length;
			if (sel_start.ch < 0) sel_start.ch = 0; // sanity
			
			editor.replaceRange( selection, sel_start, sel_end );
			
			sel_end.ch -= (chars.length * 2);
			editor.setSelection( sel_start, sel_end );
		}
		else {
			// add chars
			selection = chars + selection + chars;
			editor.replaceRange( selection, sel_start, sel_end );
			
			sel_start.ch += chars.length;
			sel_end.ch += chars.length;
			editor.setSelection( sel_start, sel_end );
		}
	}
	
	editorInsertBlockElem(text) {
		// insert block level element, like # or - or >
		var editor = this.editor;
		editor.focus();
		
		var last_line_idx = editor.lastLine();
		var last_line_str = editor.getLine( last_line_idx );
		
		var doc_start = { line: 0, ch: 0 };
		var doc_end = { line: last_line_idx, ch: last_line_str.length };
		
		var sel_start = editor.getCursor('from');
		var sel_end = editor.getCursor('to');
		
		if (sel_start.line != sel_end.line) return; // sanity
		
		var before = editor.getRange( doc_start, sel_start );
		var selection = editor.getRange( sel_start, sel_end );
		var after = editor.getRange( sel_end, doc_end );
		
		if (!before.match(/\n\n$/)) {
			if (before.match(/\n$/)) text = "\n" + text;
			else if (before.length) text = "\n\n" + text;
		}
		
		var ins_after = '';
		if (!after.match(/^\n\n/)) {
			if (after.match(/^\n/)) ins_after += "\n";
			else if (after.length) ins_after += "\n\n";
			else ins_after += "\n";
		}
		
		editor.replaceRange( text + selection, sel_start, sel_end );
		
		if (ins_after) {
			var sel_new = editor.getCursor('from');
			editor.replaceRange( ins_after, sel_new );
			editor.setCursor( sel_new );
		}
	}
	
	editToggleBold() {
		this.editorSurroundText('**');
	}
	
	editToggleItalic() {
		this.editorSurroundText('*');
	}
	
	editToggleStrike() {
		this.editorSurroundText('~~');
	}
	
	editToggleCode() {
		this.editorSurroundText('`');
	}
	
	editInsertHeader(level) {
		var prefix = '';
		for (var idx = 0; idx < level; idx++) prefix += '#';
		this.editorInsertBlockElem(prefix + ' ');
	}
	
	editInsertList() {
		this.editorInsertBlockElem('- ');
	}
	
	editInsertNumList() {
		this.editorInsertBlockElem('1. ');
	}
	
	editInsertQuote() {
		this.editorInsertBlockElem('> ');
	}
	
	getEditToolbar() {
		// return HTML for editor toolbar buttons
		var html = '';
		
		html += '<div class="editor_toolbar">';
			html += '<button class="editor_toolbar_button" title="Header 1" onClick="$P().editInsertHeader(1)"><i class="mdi mdi-format-header-1"></i></button>';
			html += '<button class="editor_toolbar_button" title="Header 2" onClick="$P().editInsertHeader(2)"><i class="mdi mdi-format-header-2"></i></button>';
			html += '<button class="editor_toolbar_button" title="Header 3" onClick="$P().editInsertHeader(3)"><i class="mdi mdi-format-header-3"></i></button>';
			html += '<button class="editor_toolbar_button" title="Header 4" onClick="$P().editInsertHeader(4)"><i class="mdi mdi-format-header-4"></i></button>';
			
			html += '<div class="editor_toolbar_divider"></div>';
			
			html += '<button class="editor_toolbar_button" title="Bold" onClick="$P().editToggleBold()"><i class="mdi mdi-format-bold"></i></button>';
			html += '<button class="editor_toolbar_button" title="Italic" onClick="$P().editToggleItalic()"><i class="mdi mdi-format-italic"></i></button>';
			html += '<button class="editor_toolbar_button" title="Strikethrough" onClick="$P().editToggleStrike()"><i class="mdi mdi-format-strikethrough"></i></button>';
			html += '<button class="editor_toolbar_button" title="Code" onClick="$P().editToggleCode()"><i class="mdi mdi-code-braces"></i></button>';
			
			html += '<div class="editor_toolbar_divider"></div>';
			
			html += '<button class="editor_toolbar_button" title="Insert Bullet List" onClick="$P().editInsertList()"><i class="mdi mdi-format-list-bulleted-square"></i></button>';
			html += '<button class="editor_toolbar_button" title="Insert Numbered List" onClick="$P().editInsertNumList()"><i class="mdi mdi-format-list-numbered"></i></button>';
			html += '<button class="editor_toolbar_button" title="Insert Blockquote" onClick="$P().editInsertQuote()"><i class="mdi mdi-format-quote-open"></i></button>';
			
			// html += '<button class="editor_toolbar_button" title="Upload Files..." onClick="$P().editUploadFiles()"><i class="mdi mdi-cloud-upload-outline"></i></button>';
			
			// html += '<div class="editor_toolbar_divider"></div>';
			
			// html += '<button class="editor_toolbar_button" id="btn_show_preview" title="Show Preview" onClick="$P().editShowPreview()"><i class="mdi mdi-file-find-outline"></i></button>';
			
			html += '<div class="clear"></div>';
		html += '</div>';
		
		return html;
	}
	
	editCodeAuto(opts) {
		// show dialog with codemirror for editing code (auto-highlight)
		var self = this;
		var { title, code, format, callback } = opts;
		
		var html = '';
		var is_maxed = app.getPref('code_editor_max');
		
		var old_editor = this.editor || null;
		delete this.editor;
		
		var old_default_mode = this.defaultEditorMode || null;
		delete this.defaultEditorMode;
		
		// start with a "fake" codemirror element so the dialog can auto-size itself
		html += '<div id="fe_dialog_editor" aria-label="' + config.ui.labels.code_editor + '">';
			if (format == 'gfm') html += this.getEditToolbar();
			html += '<div class="CodeMirror ' + (is_maxed ? 'maximize' : '') + '"></div>';
		html += '</div>';
		
		var buttons_html = "";
		buttons_html += '<div class="button phone_collapse" onClick="CodeEditor.hide()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
		buttons_html += '<div class="button phone_collapse" title="Copy to Clipboard" onClick="$P().copyCodeToClipboard()"><i class="mdi mdi-clipboard-text-outline">&nbsp;</i><span>Copy</span></div>';
		buttons_html += '<div class="button phone_collapse" title="Upload File..." onClick="$P().uploadCodeFile()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i><span>Upload...</span></div>';
		buttons_html += '<div id="btn_ceditor_confirm" class="button primary"><i class="mdi mdi-check-circle">&nbsp;</i><span>Accept</span></div>';
		
		title += ' <div class="dialog_title_widget mobile_hide"><button class="link" onClick="$P().toggleDialogCodeEditorSize(this)">';
		if (is_maxed) title += 'Minimize<i style="padding-left:3px" class="mdi mdi-arrow-bottom-left-thick"></i></button></div>';
		else title += 'Maximize<i style="padding-left:3px" class="mdi mdi-arrow-top-right-thick"></i></button></div>';
		
		CodeEditor.showSimpleDialog(title, html, buttons_html);
		
		CodeEditor.onHide = function() {
			// clean shutdown of codemirror
			app.clearError();
			self.editor.setOption('mode', 'text');
			
			if (old_editor) {
				// restore original editor
				self.editor = old_editor;
				if (old_default_mode) self.defaultEditorMode = old_default_mode;
				self.handleEditorResize(); // in case window resized while in dialog
			}
			else delete self.editor;
		};
		
		CodeEditor.onDragDrop = function(files) {
			// user dropped file on code editor dialog
			var file = files[0]; // only one file
			var reader = new FileReader();
			
			reader.onload = function(e) {
				self.editor.setValue( e.target.result );
				self.editor.focus();
				
				// if format is static, return now, do not auto-detect uploaded text
				if (format) return;
				
				var old_mode = self.editor.getOption('mode');
				if (old_mode.backdrop) old_mode = old_mode.backdrop;
				var mode = app.detectCodemirrorMode(e.target.result) || null;
				
				if (mode != old_mode) {
					Debug.trace('debug', "Detected language: " + mode);
					self.editor.setOption('mode', { name: 'mustache', backdrop: mode });
					self.editor.refresh();
				}
			};
			
			reader.readAsText(file);
		}; // onDragDrop
		
		CodeEditor.onKeyDown = function(event) {
			// prevent esc from canceling if editor is focused
			if (event.keyCode == 27) {
				if (document.activeElement && ((document.activeElement.nodeName == 'TEXTAREA') || (document.activeElement.className == 'CodeMirror-code'))) {
					app.focusNext();
					return;
				}
				event.preventDefault();
				CodeEditor.hide();
			}
		};
		
		// now setup the editor itself
		var elem = $('#fe_dialog_editor > .CodeMirror').get(0);
		var mode = null;
		var editor_config = {};
		var error_line = null;
		
		if (format) {
			if (format == 'gfm') {
				mode = { name: "gfm", gitHubSpice: false };
				editor_config = {
					inputStyle: 'contenteditable',
					spellcheck: true,
					
					extraKeys: {
						'Ctrl-B': function() { self.editToggleBold(); },
						'Ctrl-I': function() { self.editToggleItalic(); },
						
						'Cmd-B': function() { self.editToggleBold(); },
						'Cmd-I': function() { self.editToggleItalic(); }
					}
				};
			}
			else if (format == 'json') {
				mode = 'application/json';
				editor_config = {
					lineNumbers: true
				};
			}
			else mode = app.cmLangMap[format] || format;
		}
		else if (code.length) {
			mode = app.detectCodemirrorMode(code) || this.defaultEditorMode || null;
			Debug.trace('debug', "Detected initial language: " + mode);
		}
		
		this.editor = CodeMirror(
			function(cm_elem) {
				// replace fake codemirror with real one
				elem.replaceWith(cm_elem);
				if (is_maxed) cm_elem.classList.add('maximize');
			}, 
			Object.assign( {}, config.editor_defaults, editor_config, {
				mode: { name: 'mustache', backdrop: mode },
				theme: app.getCodemirrorTheme(),
				scrollbarStyle: "simple",
				value: code
			} )
		);
		
		if (!format) this.setupEditorAutoDetect();
		else if (format == 'json') {
			this.editor.on('change', function() {
				// clear error state on input
				if (error_line) {
					self.editor.removeLineClass(error_line, "background", "cm-error-line");
					app.clearError();
					error_line = null;
				}
			});
		}
		
		// handle apply button
		$('#btn_ceditor_confirm').on('click', function() {
			app.clearError();
			var value = self.editor.getValue();
			
			if (format == 'json') {
				// let's validate the json for the user, and why not
				try { JSON.parse(value); }
				catch (err) {
					app.doError( 'JSON Validation Failed: ' + err );
					
					// if the error contains a line number (i.e. chrome / firefox) mark it
					if (err.toString().match(/\bline\s+(\d+)\s+column\s+(\d+)/)) {
						var line_num = parseInt( RegExp.$1 );
						error_line = self.editor.getLineHandle( line_num - 1);
						self.editor.addLineClass(error_line, "background", "cm-error-line");
					}
					return;
				}
			} // json
			
			CodeEditor.hide();
			callback(value);
		});
		
		this.editor.focus();
	}
	
	toggleDialogCodeEditorSize(span) {
		// toggle code editor dialog size between normal and maximum
		var $cm = $('#fe_dialog_editor > .CodeMirror');
		
		if ($cm.hasClass('maximize')) {
			$cm.removeClass('maximize');
			$(span).html( 'Maximize<i style="padding-left:3px" class="mdi mdi-arrow-top-right-thick"></i>' );
			app.setPref('code_editor_max', false);
		}
		else {
			$cm.addClass('maximize');
			$(span).html( 'Minimize<i style="padding-left:3px" class="mdi mdi-arrow-bottom-left-thick"></i>' );
			app.setPref('code_editor_max', true);
		}
		
		this.editor.refresh();
		CodeEditor.autoResize();
	}
	
	uploadCodeFile() {
		// user clicked "Upload" inside code editor dialog
		var self = this;
		var $file = $('#fe_code_import');
		if ($file.length) $file.remove();
		$file = $('<input type="file" id="fe_code_import" accept=".txt,.html,.css,.js,.json,.ts,.jsx,.tsx,.py,.sh,.c,.cpp,.h,.hpp,.md,.yaml,.yml,.xml,.csv,.ini,.log,.conf,.php,.rb,.pl" style="display:none">').appendTo('body');
		
		$file.on('change', function() {
			if (this.files && this.files.length && CodeEditor.onDragDrop) CodeEditor.onDragDrop( this.files );
			$file.remove();
		});
		
		$file[0].click();
	}
	
	expandInlineImages(elem) {
		// expand all inline image URLs in doc
		var self = this;
		if (!elem) elem = this.div;
		else if (typeof(elem) == 'string') elem = $(elem);
		
		elem.find('div.markdown-body p img').each( function() {
			var $this = $(this);
			if (!$this.hasClass('inline_image')) {
				$this.addClass('inline_image').click( function() { window.open(this.src); } );
			}
		});
		
		// elem.find('div.markdown-body p a').each( function() {
		// 	var $this = $(this);
		// 	var href = $this.attr('href') || '';
		// 	if (!href.match(/\.(jpg|jpeg|gif|png)(\?|$)/i)) return; // supported images only
		// 	if ($this.data('expanded')) return; // do not re-expand an expanded link
		// 	if ($this.next().length) return; // only process links at the end of parent blocks
			
		// 	$this.after('<img src="' + href + '" class="inline_image" onClick="window.open(this.src)">');
		// 	// $this.data('expanded', true);
		// 	$this.remove();
		// });
	}
	
	fixDocumentLinks(elem) {
		// fix all local links to point back to #Docs
		if (!elem) elem = this.div;
		else if (typeof(elem) == 'string') elem = $(elem);
		var doc = this.args.doc;
		
		elem.find('div.markdown-body').find('a[href]').each( function() {
			var $this = $(this);
			var href = $this.attr('href');
			if (href.match(/^(\w+)\.md$/)) {
				// link to doc
				$this.attr('href', href.replace(/^(\w+)\.md$/, '#Docs/$1'));
			}
			else if (href.match(/^(\w+)\.md\#(\S+)$/)) {
				// link to section in specific doc
				$this.attr('href', href.replace(/^(\w+)\.md\#(\S+)$/, '#Docs/$1/$2'));
			}
			else if (href.match(/^\#(\S+)$/) && doc) {
				// link to section in current doc
				$this.attr('href', href.replace(/^\#(\S+)$/, '#Docs/' + doc + '/$1') );
			}
		} );
	}
	
	confettiParty() {
		// yay!
		var count = 200;
		var defaults = {
			origin: { y: 0.7 }
		};
		
		function fire(particleRatio, opts) {
			app.confetti({
				...defaults,
				...opts,
				particleCount: Math.floor(count * particleRatio)
			});
		};
		
		fire(0.25, {
			spread: 26,
			startVelocity: 55,
		});
		fire(0.2, {
			spread: 60,
		});
		fire(0.35, {
			spread: 100,
			decay: 0.91,
			scalar: 0.8
		});
		fire(0.1, {
			spread: 120,
			startVelocity: 25,
			decay: 0.92,
			scalar: 1.2
		});
		fire(0.1, {
			spread: 120,
			startVelocity: 45,
		});
	}
	
	// 
	// Toggle Boxes
	// 
	
	setupToggleBoxes(elem) {
		// make toggle boxes animate smoothly
		var self = this;
		if (!elem) elem = this.div;
		else if (typeof(elem) == 'string') elem = $(elem);
		
		elem.find('div.box.toggle').each( function() {
			var $box = $(this);
			var $icon = $box.find('> div.box_title > i').first();
			var $title = $box.find('> div.box_title > span').first();
			var $content = $box.find('> div.box_content');
			
			var state = app.getPref('toggle_boxes.' + $box.prop('id')) || 'expanded';
			if (state == 'expanded') $box.addClass('expanded');
			
			if ($box.hasClass('expanded')) {
				// $content.scrollTop(0).css('height', $content[0].scrollHeight);
			}
			else {
				$content.css('height', 0); // .scrollTop( $content[0].scrollHeight );
			}
			
			$icon.addClass('mdi mdi-chevron-down');
			
			$icon.off('mouseup').on('mouseup', function() {
				self.toggleBox(this);
			});
			$title.off('mouseup').on('mouseup', function() {
				self.toggleBox(this);
			});
		});
	}
	
	toggleBox(elem) {
		// toggle details section open/closed
		var $box = $(elem).closest('div.box.toggle');
		if ($box.hasClass('expanded')) this.collapseToggleBox($box);
		else this.expandToggleBox($box);
	}
	
	collapseToggleBox($box) {
		// collapse toggle box
		var self = this;
		var $content = $box.find('> div.box_content');
		
		if ($box.hasClass('expanded')) {
			$box.removeClass('expanded');
			
			$content.scrollTop(0).css('height', $content[0].scrollHeight);
			
			$content.stop().animate({
				scrollTop: $content[0].scrollHeight,
				height: 0
			}, {
				duration: app.reducedMotion() ? 1 : 400,
				easing: 'easeOutQuart',
				complete: function() { self.updateBoxButtonFloaterState(); }
			});
			
			if ($box.prop('id')) app.setPref('toggle_boxes.' + $box.prop('id'), 'collapsed');
		}
	}
	
	expandToggleBox($box) {
		// expand toggle box
		var self = this;
		var $content = $box.find('> div.box_content');
		
		if (!$box.hasClass('expanded')) {
			$box.addClass('expanded');
			
			$content.css('height', 0).scrollTop( $content[0].scrollHeight );
			
			$content.stop().animate({
				scrollTop: 0,
				height: $content[0].scrollHeight
			}, {
				duration: app.reducedMotion() ? 1 : 400,
				easing: 'easeOutQuart',
				complete: function() { $content.css('height', 'auto'); self.updateBoxButtonFloaterState(); }
			});
			
			if ($box.prop('id')) app.setPref('toggle_boxes.' + $box.prop('id'), 'expanded');
		}
	}
	
};
