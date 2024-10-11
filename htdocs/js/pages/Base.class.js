// Base class for our pages to inherit from

Page.Base = class Base extends Page {
	
	loading() {
		// show loading indicator
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
	}
	
	getNiceAPIKey(item, link) {
		// overriding method in orchestra-theme page.js
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
		
		var html = '<span class="nowrap">';
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
			if (link === true) link = '#Groups?sub=edit&id=' + item.id;
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
			case 'watch': icon = 'binoculars'; break;
			case 'job': icon = 'timer-outline'; break;
		}
		var html = '<i class="mdi mdi-' + icon + '">&nbsp;</i>';
		html += ucfirst(item.source);
		if ((item.source == 'user') && item.username) html += ' (' + item.username + ')';
		return html;
	}
	
	getNiceProcess(item, link) {
		// get formatted process cmd
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (item.job ? 'console' : 'console') + '"></i>';
		if (link) {
			html += '<span class="link" onClick="$P().showProcessInfo(' + item.pid + ')">';
			html += icon + '<span>' + item.command + '</span></span>';
		}
		else {
			html += icon + item.command;
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
			case 'action': icon = 'eye-outline'; title = 'Action'; break;
			case 'scheduler': icon = 'clock-time-four-outline'; title = 'Scheduler'; break;
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
			loc = '#Workflows';
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
	
	getNiceWorkflowJob(id, link) {
		// get formatted workflow job ID with icon, plus optional link
		if (!id) return '(None)';
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-clipboard-play-outline"></i>';
		if (link) {
			html += '<a href="#Workflows?job=' + id + '">';
			html += icon + '<span>' + id + '</span></a>';
		}
		else {
			html += icon + id;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceServer(item, link) {
		// get formatted server with icon, plus optional link
		if (!item) return '(None)';
		if (typeof(item) == 'string') {
			// assume id (fallback to hostname, then fallback to "offline" server)
			var orig_item = item;
			item = find_object(app.servers, { id: item }) || find_object(app.servers, { hostname: item });
			if (!item) {
				item = { id: orig_item, hostname: orig_item, icon: 'close-network-outline' };
			}
		}
		if (!item) return '(None)';
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (item.offline ? 'close-network-outline' : (item.icon || 'router-network')) + '"></i>';
		if (link) {
			html += '<a href="#Servers?sub=view&id=' + item.id + '">';
			html += icon + '<span>' + (item.title || this.formatHostname(item.hostname)) + '</span></a>';
		}
		else {
			html += icon + (item.title || this.formatHostname(item.hostname));
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceTarget(target) {
		// get formatted target, which may be a group or a server
		if (find_object(app.groups, { id: target })) return this.getNiceGroup(target, true);
		if (find_object(app.servers, { hostname: target })) return this.getNiceServer(target, true);
		return target;
	}
	
	getNiceTargetList(targets, glue, max) {
		// get formatted target list
		var self = this;
		if (!glue) glue = ', ';
		if (!targets || !targets.length) return '(None)';
		if (max && (targets.length > max)) {
			var extras = targets.length - max;
			targets = targets.slice(0, max);
			return targets.map( function(target) { return self.getNiceTarget(target); } ).join(glue) + glue + ' and ' + extras + ' more';
		}
		return targets.map( function(target) { return self.getNiceTarget(target); } ).join(glue);
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
	
	getNiceFile(filename, link) {
		// get nice file with type-appropriate icon
		var icon = 'file-outline';
		var html = '';
		var ext = '';
		if (filename.replace(/\.(gz|xz)$/i, '').match(/\.(\w+)$/)) ext = RegExp.$1.toLowerCase();
		
		if (ext.match(/(jpg|jpe|jpeg|gif|bmp|png|webp)/)) icon = 'file-image-outline';
		else if (ext.match(/(mp4|m4v|mkv|mov)/)) icon = 'file-video-outline';
		else if (ext.match(/(mp3|m4a)/)) icon = 'file-music-outline';
		else if (ext.match(/(txt|log)/)) icon = 'file-document-outline';
		else if (ext.match(/(xml|dtd|json|yml|ini|js|py|pl|html|css|conf)/)) icon = 'file-code-outline';
		else if (ext.match(/(csv|tsv)/)) icon = 'file-delimited-outline';
		else if (ext.match(/(xls|xlsx)/)) icon = 'file-table-outline';
		else if (ext.match(/(doc|docx)/)) icon = 'file-word-outline';
		
		html += '<span class="nowrap">';
		icon = '<i class="mdi mdi-' + icon + '"></i>';
		
		if (link) {
			html += '<a href="' + link + '">';
			html += icon + '<span>' + filename + '</span></a>';
		}
		else {
			html += icon + filename;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceHostname(hostname, link) {
		// get formatted hostname with icon, plus optional link
		if (!hostname) return '(None)';
		
		// TODO: all this shit is from performa: -- also, this function is UNUSED!
		var query = { hostname: hostname };
		if (this.args && this.args.sys) query.sys = this.args.sys;
		if (this.args && this.args.date) query.date = this.args.date;
		if (this.args && ('offset' in this.args)) query.offset = this.args.offset;
		if (this.args && this.args.length) query.length = this.args.length;
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-desktop-classic"></i>';
		if (link) {
			html += '<a href="#Server' + compose_query_string(query) + '">';
			html += icon + '<span>' + this.formatHostname(hostname) + '</span></a>';
		}
		else {
			html += icon + this.formatHostname(hostname);
		}
		
		html += '</span>';
		return html;
	}
	
	formatHostname(hostname) {
		// format hostname for display
		return app.formatHostname(hostname);
	}
	
	getNiceIP(ip) {
		// get nice ip address for display
		return '<i class="mdi mdi-earth">&nbsp;</i>' + ip;
	}
	
	getNiceArch(arch) {
		// get nice server architecture for display
		var icon = arch.match(/64/) ? 'cpu-64-bit' : 'chip';
		return '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + arch.toUpperCase();
	}
	
	getNiceOS(os) {
		// get nice server operating system for display
		return '<i class="mdi mdi-harddisk">&nbsp;</i>' + os.platform + ' ' + os.distro + ' ' + os.release;
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
		return '<i class="mdi mdi-developer-board">&nbsp;</i>' + cpu.vendor + ' ' + cpu.brand;
	}
	
	getNiceUptime(secs) {
		// get nice server uptime
		return '<i class="mdi mdi-battery-clock-outline">&nbsp;</i>' + get_text_from_seconds(secs, false, true);
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
				query += '' + key + ':' + yesterday_midnight + '..' + midnight;
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
				query += '' + key + ':' + last_month + '..' + cur_month;
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
				query += '' + key + ':' + last_year + '..' + cur_year;
			break;
			
			case 'older':
				var cur_year = this.parseDateTZ( dargs.year + '-01-01 00:00:00' ); // get epoch of midnight on first year day
				var before = cur_year - (86400 * 180); // sometime in last year -- does not need to be exact
				dargs = this.getDateArgsTZ( before ); // get dargs for last year
				var last_year = this.parseDateTZ( dargs.year + '-01-01 00:00:00' ); // get epoch of midnight on first day of last year
				query += '' + key + ':<' + last_year;
			break;
		} // switch
		
		return query;
	}
	
	getNiceUserList(users, link, glue) {
		// get formatted user group
		var self = this;
		if (!glue) glue = ', ';
		if (typeof(users) == 'string') users = users.split(/\,\s*/);
		return users.map( function(user) { return self.getNiceUser(user, link); } ).join(glue);
	}
	
	getNiceUser(user, link) {
		if (!user) return 'n/a';
		if (typeof(user) == 'string') {
			user = find_object( app.users, { username: user } ) || find_object( app.keys, { id: user } ) || user;
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
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-' + (user.icon || 'account') + '"></i>';
		if (link && user.full_name) {
			if (link === true) link = '#Users?sub=edit&username=' + username;
			html += '<a href="' + link + '">';
			html += icon + '<span>' + (user.full_name || username) + '</span></a>';
		}
		else {
			if (username == 'api') username = 'API';
			html += icon + (user.full_name || username);
		}
		html += '</span>';
		
		return html;
	}
	
	getNiceColorLabel(color, text) {
		// get nice color label with icon for certain colors
		var icon = '';
		switch (color) {
			case 'green': icon = '<i class="mdi mdi-check-circle"></i>'; break;
			case 'red': icon = '<i class="mdi mdi-alert-circle"></i>'; break;
		}
		return '<span class="color_label ' + color + ' nowrap">' + icon + text + '</span>';
	}
	
	getNiceJob(id, link) {
		// get formatted job ID with icon, plus optional link
		if (!id) return '(None)';
		
		var html = '<span class="nowrap">';
		var icon = '<i class="mdi mdi-timer-outline"></i>';
		if (link) {
			html += '<a href="#Job?id=' + id + '">';
			html += icon + '<span>' + id + '</span></a>';
		}
		else {
			html += icon + id;
		}
		
		html += '</span>';
		return html;
	}
	
	getNiceJobElapsedTime(job, abbrev, no_secondary) {
		// render nice elapsed time display
		var now = job.completed || app.epoch;
		var elapsed = job.elapsed || Math.floor( Math.max( 0, now - job.started ) );
		var icon = job.completed ? 'clock-check-outline' : 'progress-clock';
		return '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + get_text_from_seconds( elapsed, abbrev, no_secondary );
	}
	
	getNiceJobProgressBar(job) {
		// render nice progress bar for job
		var html = '';
		var counter = Math.min(1, Math.max(0, job.progress || 1));
		var bar_width = this.bar_width || 100;
		var cx = Math.floor( counter * bar_width );
		var label = '' + Math.floor( (counter / 1.0) * 100 ) + '%';
		var extra_classes = (counter == 1.0) ? 'indeterminate' : '';
		
		html += '<div class="progress_bar_container ' + extra_classes + '" style="width:' + bar_width + 'px; margin:0;">';
			html += '<div class="progress_bar_label first_half" style="width:' + bar_width + 'px;">' + label + '</div>';
			html += '<div class="progress_bar_inner" style="width:' + cx + 'px;">';
				html += '<div class="progress_bar_label second_half" style="width:' + bar_width + 'px;">' + label + '</div>';
			html += '</div>';
		html += '</div>';
		
		return html;
	}
	
	getNiceProgressBar(amount = 0, extra_classes = '', show_label = false) {
		// render nice progress bar for arbitrary value
		var html = '';
		var counter = Math.min(1, Math.max(0, amount || 0));
		var bar_width = this.bar_width || 100;
		var cx = Math.floor( counter * bar_width );
		var label = '' + Math.floor( (counter / 1.0) * 100 ) + '%';
		var extra_attribs = show_label ? '' : ('title="' + label + '"');
		
		html += '<div class="progress_bar_container ' + extra_classes + '" style="width:' + bar_width + 'px; margin:0;" ' + extra_attribs + '>';
			if (show_label) html += '<div class="progress_bar_label first_half" style="width:' + bar_width + 'px;">' + label + '</div>';
			html += '<div class="progress_bar_inner" style="width:' + cx + 'px;">';
				if (show_label) html += '<div class="progress_bar_label second_half" style="width:' + bar_width + 'px;">' + label + '</div>';
			html += '</div>';
		html += '</div>';
		
		return html;
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
		// (states: queued, start_delay, retry_delay, ready, active, finishing, complete)
		var nice_state = ucfirst(job.state || 'unknown');
		var now = app.epoch;
		var icon = 'progress-helper';
		
		switch (job.state) {
			case 'queued': icon = 'motion-pause-outline'; break;
			
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
			
			case 'ready': icon = 'motion-play'; break;
			case 'active': icon = 'motion-play-outline'; break;
			case 'finishing': icon = 'progress-check'; break;
			case 'complete': icon = 'check-circle-outline'; break;
		}
		
		// special case: If job is complete but not final, it's actually still finishing
		if ((job.state == 'complete') && !job.final) { icon = 'progress-check'; nice_state = 'Finishing'; }
		
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
		
		if (!job.code) {
			icon = 'check-circle';
			ocon = icon + '-outline';
			color = 'green';
			text = 'Success';
		}
		else switch(job.code) {
			case 'warning': icon = 'alert-rhombus'; ocon = icon + '-outline'; color = 'yellow'; break;
			case 'critical': icon = ocon = 'fire-alert'; color = 'purple'; break;
			case 'abort': icon = ocon = 'cancel'; color = 'red'; text = 'Aborted'; break;
			
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
	
	getNiceJobSource(job) {
		if (job.source.match(/scheduler/i)) {
			return job.single ? '<i class="mdi mdi-alarm-check">&nbsp;</i>Single Shot' : '<i class="mdi mdi-update">&nbsp;</i>Scheduler';
			// return '<i class="mdi mdi-calendar-multiple">&nbsp;</i>Scheduler';
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
			if (event.category != last_cat_id) {
				last_cat_id = event.category;
				var cat = cat_map[ event.category ] || { title: event.category };
				event.group = cat.title;
			}
		} );
		
		return events;
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
	
	suggestIDFromTitle() {
		// generate alphanum ID from title
		var title = $('#fe_' + this.dom_prefix +'_title').val().trim();
		var id = $('#fe_' + this.dom_prefix + '_id').val().trim();
		if (!id.length && title.length) {
			id = title.toLowerCase().replace(/\W+/g, '_').replace(/^_+/, '').replace(/_+$/, '');
			if (id.length) $('#fe_' + this.dom_prefix +'_id').val(id);
			$('#fe_' + this.dom_prefix +'_id').trigger('change');
		}
	}
	
	// Resource Limit Editor and Table:
	
	renderResLimitEditor() {
		// render res limit editor
		var dom_prefix = this.dom_prefix;
		var html = this.getResLimitTable();
		this.div.find('#d_' + dom_prefix + '_reslim_table').html( html );
	}
	
	getResLimitTable() {
		// get html for resource limit table
		var self = this;
		var html = '';
		var rows = this.limits;
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Limit', 'Description', 'Actions'];
		// var add_link = '<span class="link" onMouseUp="$P().editResLimit(-1)"><b>Add New Limit...</b></span>';
		var add_link = '<div class="button small secondary" onMouseUp="$P().editResLimit(-1)">New Limit...</div>';
		
		var targs = {
			rows: rows,
			cols: cols,
			data_type: 'limit',
			empty_msg: add_link
		};
		
		if (rows.length && (rows.length < 7)) {
			targs.append = '<tr><td class="td_big" colspan="' + cols.length + '" style="text-align:center">' + add_link + '</td></tr>';
		}
		
		html += this.getCompactTable(targs, function(item, idx) {
			var actions = [];
			actions.push( '<span class="link" onMouseUp="$P().editResLimit('+idx+')"><b>Edit</b></span>' );
			actions.push( '<span class="link danger" onMouseUp="$P().deleteResLimit('+idx+')"><b>Delete</b></span>' );
			
			var nice_title = '';
			var nice_desc = '';
			switch (item.type) {
				case 'mem':
					nice_title = "Max Memory";
					nice_desc = get_text_from_bytes(item.amount) + " for " + get_text_from_seconds(item.duration, false, true);
				break;
				
				case 'cpu':
					nice_title = "Max CPU %";
					nice_desc = item.amount + "% for " + get_text_from_seconds(item.duration, false, true);
				break;
				
				case 'log':
					nice_title = "Max Log Size";
					nice_desc = get_text_from_bytes(item.amount);
				break;
				
				case 'time':
					nice_title = "Max Run Time";
					nice_desc = get_text_from_seconds(item.duration, false, true);
				break;
				
				case 'job':
					nice_title = "Max Jobs";
					if (!item.amount) nice_desc = "None";
					else nice_desc = "Up to " + commify(item.amount) + " concurrent " + pluralize("job", item.amount);
				break;
				
				case 'retry':
					nice_title = "Max Retries";
					if (!item.amount) nice_desc = "No retries will be attempted";
					else {
						nice_desc = "Up to " + commify(item.amount);
						if (item.duration) nice_desc += " (" + get_text_from_seconds(item.duration, false, true) + " delay)";
					}
				break;
				
				case 'queue':
					nice_title = "Max Queue";
					if (!item.amount) nice_desc = "No jobs allowed in queue";
					else nice_desc = "Up to " + commify(item.amount) + " " + pluralize("job", item.amount) + " allowed in queue";
				break;
			} // switch item.type
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggleResLimitEnabled(this,' + idx + ')'
				}) + '</div>',
				'<div class="td_big"><i class="mdi mdi-gauge">&nbsp;</i><span class="link" onClick="$P().editResLimit('+idx+')">' + nice_title + '</span></div>',
				'<div style="">' + nice_desc + '</div>',
				actions.join(' | ')
			];
			
			if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getCompactTable
		
		return html;
	}
	
	toggleResLimitEnabled(elem, idx) {
		// toggle res limit checkbox, actually do the enable/disable here, update row
		var item = this.limits[idx];
		item.enabled = !!$(elem).is(':checked');
		
		if (item.enabled) $(elem).closest('tr').removeClass('disabled');
		else $(elem).closest('tr').addClass('disabled');
	}
	
	editResLimit(idx) {
		// show dialog to select res limit
		// limit: { type, amount?, duration? }
		var self = this;
		var limit = (idx > -1) ? this.limits[idx] : null;
		var title = (idx > -1) ? "Editing Resource Limit" : "New Resource Limit";
		var btn = (idx > -1) ? "Apply Changes" : "Add Limit";
		
		if (!limit) {
			if (!find_object(this.limits, { type: 'time' })) limit = { type: 'time' };
			else if (!find_object(this.limits, { type: 'job' })) limit = { type: 'job' };
			else if (!find_object(this.limits, { type: 'log' })) limit = { type: 'log' };
			else if (!find_object(this.limits, { type: 'mem' })) limit = { type: 'mem' };
			else if (!find_object(this.limits, { type: 'cpu' })) limit = { type: 'cpu' };
			else if (!find_object(this.limits, { type: 'retry' })) limit = { type: 'retry' };
			else if (!find_object(this.limits, { type: 'queue' })) limit = { type: 'queue' };
			limit.enabled = true;
		}
		
		var html = '<div class="dialog_box_content">';
		
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_erl_enabled',
				label: 'Limit Enabled',
				checked: limit.enabled
			}),
			caption: 'Enable or disable the resource limit.'
		});
		
		html += this.getFormRow({
			label: 'Limit Type:',
			content: this.getFormMenu({
				id: 'fe_erl_type',
				options: [ 
					['time', "Max Run Time"], 
					['job', "Max Concurrent Jobs"],
					['log', "Max Log Size"],
					['mem', "Memory Limit"], 
					['cpu', "CPU % Limit"],
					['retry', "Max Retry Limit"],
					['queue', "Max Queue Limit"]
				],
				value: limit.type
			}),
			caption: 'Select the desired limit type.'
		});
		
		html += this.getFormRow({
			id: 'd_erl_byte_amount',
			label: 'Amount:',
			content: this.getFormRelativeBytes({
				id: 'fe_erl_byte_amount',
				value: limit.amount || 0
			}),
			caption: 'Select the max byte amount for the limit.'
		});
		
		html += this.getFormRow({
			id: 'd_erl_raw_amount',
			label: 'Amount:',
			content: this.getFormText({
				id: 'fe_erl_raw_amount',
				type: 'number',
				spellcheck: 'false',
				maxlength: 32,
				value: limit.amount || 0
			}),
			caption: '<span id="s_erl_raw_amount_cap"></span>'
		});
		
		html += this.getFormRow({
			id: 'd_erl_duration',
			label: 'Duration:',
			content: this.getFormRelativeTime({
				id: 'fe_erl_duration',
				value: limit.duration || 0
			}),
			caption: '<span id="s_erl_duration_cap"></span>'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			
			limit.enabled = $('#fe_erl_enabled').is(':checked');
			limit.type = $('#fe_erl_type').val();
			switch (limit.type) {
				case 'time':
					limit.duration = parseInt( $('#fe_erl_duration').val() );
					delete limit.amount;
				break;
				
				case 'mem':
					limit.amount = parseInt( $('#fe_erl_byte_amount').val() );
					limit.duration = parseInt( $('#fe_erl_duration').val() );
				break;
				
				case 'cpu':
					limit.amount = parseInt( $('#fe_erl_raw_amount').val() );
					limit.duration = parseInt( $('#fe_erl_duration').val() );
				break;
				
				case 'log':
					limit.amount = parseInt( $('#fe_erl_byte_amount').val() );
					delete limit.duration;
				break;
				
				case 'job':
					limit.amount = parseInt( $('#fe_erl_raw_amount').val() );
					delete limit.duration;
				break;
				
				case 'retry':
					limit.amount = parseInt( $('#fe_erl_raw_amount').val() );
					limit.duration = parseInt( $('#fe_erl_duration').val() );
				break;
				
				case 'queue':
					limit.amount = parseInt( $('#fe_erl_raw_amount').val() );
					delete limit.duration;
				break;
			} // switch limit.type
			
			// see if we need to add or replace
			if (idx == -1) {
				var dupe_idx = find_object_idx(self.limits, { type: limit.type });
				if (dupe_idx > -1) self.limits[dupe_idx] = limit;
				else self.limits.push(limit);
			}
			
			// self.dirty = true;
			self.renderResLimitEditor();
			Dialog.hide();
		} ); // Dialog.confirm
		
		var change_limit_type = function(new_type) {
			switch (new_type) {
				case 'time':
					$('#d_erl_byte_amount').hide();
					$('#d_erl_raw_amount').hide();
					$('#d_erl_duration').show();
					$('#s_erl_duration_cap').html('Enter the maximum duration for the time limit.');
				break;
				
				case 'mem':
					$('#d_erl_byte_amount').show();
					$('#d_erl_raw_amount').hide();
					$('#d_erl_duration').show();
					$('#s_erl_duration_cap').html('Specify the amount of time the memory must stay over the limit before the job is aborted.');
				break;
				
				case 'cpu':
					$('#d_erl_byte_amount').hide();
					$('#d_erl_raw_amount').show();
					$('#s_erl_raw_amount_cap').html('Enter the maximum CPU precentage for the limit (100 = 1 core maxed).');
					$('#d_erl_duration').show();
					$('#s_erl_duration_cap').html('Specify the amount of time the CPU must stay over the limit before the job is aborted.');
				break;
				
				case 'log':
					$('#d_erl_byte_amount').show();
					$('#d_erl_raw_amount').hide();
					$('#d_erl_duration').hide();
				break;
				
				case 'job':
					$('#d_erl_byte_amount').hide();
					$('#d_erl_raw_amount').show();
					$('#s_erl_raw_amount_cap').html('Enter the maximum number to concurrent jobs to allow.');
					$('#d_erl_duration').hide();
				break;
				
				case 'retry':
					$('#d_erl_byte_amount').hide();
					$('#d_erl_raw_amount').show();
					$('#s_erl_raw_amount_cap').html('Enter the maximum number of retries to attempt before failing the job.');
					$('#d_erl_duration').show();
					$('#s_erl_duration_cap').html('Optionally set a delay to wait between retries.');
				break;
				
				case 'queue':
					$('#d_erl_byte_amount').hide();
					$('#d_erl_raw_amount').show();
					$('#s_erl_raw_amount_cap').html('Enter the maximum number of queued jobs to allow.');
					$('#d_erl_duration').hide();
				break;
			} // switch new_type
		}; // change_limit_type
		
		change_limit_type(limit.type);
		
		$('#fe_erl_type').on('change', function() {
			change_limit_type( $(this).val() );
		}); // type change
		
		RelativeTime.init( $('#fe_erl_duration') );
		RelativeBytes.init( $('#fe_erl_byte_amount') );
		
		Dialog.autoResize();
	}
	
	deleteResLimit(idx) {
		// delete selected limit
		this.limits.splice( idx, 1 );
		this.renderResLimitEditor();
	}
	
	//
	// Job Action Table and Editor:
	//
	
	renderJobActionEditor() {
		// render job action editor
		var dom_prefix = this.dom_prefix;
		var html = this.getJobActionTable();
		this.div.find('#d_' + dom_prefix + '_jobact_table').html( html );
	}
	
	getJobActionDisplayArgs(action, link) {
		// get display args for job action
		// returns: { trigger, type, text, desc, icon }
		var trigger_titles = {
			'start': "On Job Start",
			'complete': "On Job Completion",
			'success': "On Success",
			'warning': "On Warning",
			'error': "On Error",
			'critical': "On Critical",
			'abort': "On Abort"
		};
		
		var disp = {
			trigger: trigger_titles[ action.trigger ]
		};
		
		if (!disp.trigger && action.trigger.match(/^tag:(\w+)$/)) {
			var tag_id = RegExp.$1;
			disp.trigger = "On Tag: " + this.getNiceTag(tag_id, link);
		}
		
		switch (action.type) {
			case 'email':
				disp.type = "Send Email";
				disp.text = action.email;
				disp.desc = '<div style="word-break:break-word;">' + disp.text + '</div>';
				disp.icon = 'email-send-outline';
			break;
			
			case 'web_hook':
				disp.type = "Web Hook";
				var web_hook = find_object( app.web_hooks, { id: action.web_hook } );
				disp.text = web_hook ? web_hook.title : "(Web Hook not found)";
				disp.desc = this.getNiceWebHook(web_hook, link);
				disp.icon = 'web';
			break;
			
			case 'run_event':
				disp.type = "Run Event";
				var event = find_object( app.events, { id: action.event_id } );
				disp.text = event ? event.title : "(Event not found)";
				disp.desc = this.getNiceEvent(event, link);
				disp.icon = 'calendar-clock';
			break;
			
			case 'channel':
				disp.type = "Notify Channel";
				var channel = find_object( app.channels, { id: action.channel_id } );
				disp.text = channel ? channel.title : "(Channel not found)";
				disp.desc = this.getNiceChannel(channel, link);
				disp.icon = 'bullhorn-outline';
			break;
			
			case 'snapshot':
				disp.type = "Take Snapshot";
				disp.text = disp.desc = "(Current Server)";
				disp.icon = 'monitor-screenshot';
			break;
			
			case 'disable':
				disp.type = "Disable Event";
				disp.text = disp.desc = "(Current Event)";
				disp.icon = 'cancel';
			break;
			
		} // switch item.type
		
		return disp;
	}
	
	getJobActionTable() {
		// get html for job action table
		var self = this;
		var html = '';
		var rows = this.actions;
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Trigger', 'Type', 'Description', 'Actions'];
		var add_link = '<div class="button small secondary" onMouseUp="$P().editJobAction(-1)">New Action...</div>';
		
		var targs = {
			rows: rows,
			cols: cols,
			data_type: 'action',
			empty_msg: add_link,
			append: '<tr><td class="td_big" colspan="' + cols.length + '" style="text-align:center">' + add_link + '</td></tr>'
		};
		
		html += this.getCompactTable(targs, function(item, idx) {
			var links = [];
			links.push( '<span class="link" onMouseUp="$P().editJobAction('+idx+')"><b>Edit</b></span>' );
			links.push( '<span class="link danger" onMouseUp="$P().deleteJobAction('+idx+')"><b>Delete</b></span>' );
			
			var disp = self.getJobActionDisplayArgs(item);
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggleJobActionEnabled(this,' + idx + ')'
				}) + '</div>',
				'<div class="td_big wrap_mobile"><i class="mdi mdi-eye-outline">&nbsp;</i><span class="link" onClick="$P().editJobAction('+idx+')">' + disp.trigger + '</span></div>',
				'<div class="td_big wrap_mobile"><i class="mdi mdi-' + disp.icon + '">&nbsp;</i>' + disp.type + '</div>',
				'<div style="">' + disp.desc + '</div>',
				'<div class="wrap_mobile">' + links.join(' | ') + '</div>'
			];
			
			if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getCompactTable
		
		return html;
	}
	
	toggleJobActionEnabled(elem, idx) {
		// toggle job action checkbox, actually do the enable/disable here, update row
		var item = this.actions[idx];
		item.enabled = !!$(elem).is(':checked');
		
		if (item.enabled) $(elem).closest('tr').removeClass('disabled');
		else $(elem).closest('tr').addClass('disabled');
	}
	
	editJobAction(idx) {
		// show dialog to select job action
		// action: { trigger, type, email?, url? }
		var self = this;
		var action = (idx > -1) ? this.actions[idx] : { trigger: 'error', type: 'email', email: '', enabled: true };
		var title = (idx > -1) ? "Editing Job Action" : "New Job Action";
		var btn = (idx > -1) ? "Apply Changes" : "Add Action";
		
		var html = '<div class="dialog_box_content">';
		
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_eja_enabled',
				label: 'Action Enabled',
				checked: action.enabled
			}),
			caption: 'Enable or disable the job action.'
		});
		
		html += this.getFormRow({
			label: 'Action Trigger:',
			content: this.getFormMenuSingle({
				id: 'fe_eja_trigger',
				title: 'Select Action Trigger',
				options: [ 
					{ id: 'start', title: "On Job Start", icon: 'play-circle' },
					{ id: 'complete', title: "On Job Completion", icon: 'stop-circle' },
					{ id: 'success', title: "On Success", icon: 'check-circle-outline', group: "On Job Result:" },
					{ id: 'error', title: "On Error", icon: 'alert-decagram-outline' },
					{ id: 'warning', title: "On Warning", icon: 'alert-circle-outline' },
					{ id: 'critical', title: "On Critical", icon: 'fire-alert' },
					{ id: 'abort', title: "On Abort", icon: 'cancel' }
				].concat(
					this.buildOptGroup( app.tags, "On Custom Tag:", 'tag-outline', 'tag:' )
				),
				value: action.trigger,
				'data-nudgeheight': 1
			}),
			caption: 'Select the desired action trigger.'
		});
		
		html += this.getFormRow({
			label: 'Action Type:',
			content: this.getFormMenuSingle({
				id: 'fe_eja_type',
				title: 'Select Action Type',
				options: [ 
					{ id: 'email', title: "Send Email", icon: 'email-send-outline' },
					{ id: 'web_hook', title: "Web Hook", icon: 'web' },
					{ id: 'run_event', title: "Run Event", icon: 'calendar-clock' },
					{ id: 'channel', title: "Notify Channel", icon: 'bullhorn-outline' },
					{ id: 'snapshot', title: "Take Snapshot", icon: 'monitor-screenshot' },
					{ id: 'disable', title: "Disable Event", icon: 'cancel' }
				],
				value: action.type
			}),
			caption: 'Select the desired action type.'
		});
		
		html += this.getFormRow({
			id: 'd_eja_email',
			label: 'Email Addresses:',
			content: this.getFormText({
				id: 'fe_eja_email',
				// type: 'email',
				// multiple: 'multiple',
				spellcheck: 'false',
				maxlength: 8192,
				placeholder: 'email@sample.com',
				value: action.email || '',
				onChange: '$P().updateAddRemoveMe(this)'
			}),
			suffix: '<div class="form_suffix_icon mdi" title="" onMouseUp="$P().addRemoveMe(this)"></div>',
			caption: 'Enter one or more email addresses for the action.'
		});
		
		html += this.getFormRow({
			id: 'd_eja_web_hook',
			label: 'Web Hook:',
			content: this.getFormMenuSingle({
				id: 'fe_eja_web_hook',
				title: 'Select Web Hook',
				options: app.web_hooks,
				value: action.web_hook,
				default_icon: 'webhook'
			}),
			caption: 'Select a Web Hook to fire for the action.'
		});
		
		html += this.getFormRow({
			id: 'd_eja_run_job',
			label: 'Run Job:',
			content: this.getFormMenuSingle({
				id: 'fe_eja_event',
				title: 'Select Event',
				options: this.getCategorizedEvents(),
				value: action.event_id,
				default_icon: 'calendar-clock'
			}),
			caption: 'Select which event to run for the action.'
		});
		
		// notification channel
		html += this.getFormRow({
			id: 'd_eja_channel',
			label: 'Notify Channel:',
			content: this.getFormMenuSingle({
				id: 'fe_eja_channel',
				title: 'Select Channel',
				options: app.channels,
				value: action.channel_id || '',
				default_icon: 'bullhorn-outline'
			}),
			caption: 'Select which channel to notify for the action.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			
			action = {
				enabled: $('#fe_eja_enabled').is(':checked'),
				trigger: $('#fe_eja_trigger').val(),
				type: $('#fe_eja_type').val()
			};
			switch (action.type) {
				case 'email':
					action.email = $('#fe_eja_email').val();
				break;
				
				case 'web_hook':
					action.web_hook = $('#fe_eja_web_hook').val();
				break;
				
				case 'run_event':
					action.event_id = $('#fe_eja_event').val();
				break;
				
				case 'channel':
					action.channel_id = $('#fe_eja_channel').val();
				break;
			} // switch action.type
			
			// see if we need to add or replace
			if (idx == -1) {
				self.actions.push(action);
			}
			else self.actions[idx] = action;
			
			// keep list sorted
			sort_by(self.actions, 'trigger');
			
			// self.dirty = true;
			self.renderJobActionEditor();
			Dialog.hide();
		} ); // Dialog.confirm
		
		var change_action_type = function(new_type) {
			switch (new_type) {
				case 'email':
					$('#d_eja_email').show();
					$('#d_eja_web_hook').hide();
					$('#d_eja_run_job').hide();
					$('#d_eja_channel').hide();
				break;
				
				case 'web_hook':
					$('#d_eja_email').hide();
					$('#d_eja_web_hook').show();
					$('#d_eja_run_job').hide();
					$('#d_eja_channel').hide();
				break;
				
				case 'run_event':
					$('#d_eja_email').hide();
					$('#d_eja_web_hook').hide();
					$('#d_eja_run_job').show();
					$('#d_eja_channel').hide();
				break;
				
				case 'channel':
					$('#d_eja_email').hide();
					$('#d_eja_web_hook').hide();
					$('#d_eja_run_job').hide();
					$('#d_eja_channel').show();
				break;
				
				case 'snapshot':
					$('#d_eja_email').hide();
					$('#d_eja_web_hook').hide();
					$('#d_eja_run_job').hide();
					$('#d_eja_channel').hide();
				break;
				
				case 'disable':
					$('#d_eja_email').hide();
					$('#d_eja_web_hook').hide();
					$('#d_eja_run_job').hide();
					$('#d_eja_channel').hide();
				break;
			} // switch new_type
		}; // change_action_type
		
		change_action_type(action.type);
		
		$('#fe_eja_type').on('change', function() {
			change_action_type( $(this).val() );
		}); // type change
		
		SingleSelect.init( $('#fe_eja_trigger, #fe_eja_type, #fe_eja_event, #fe_eja_channel, #fe_eja_web_hook') );
		this.updateAddRemoveMe('#fe_eja_email');
		
		Dialog.autoResize();
	}
	
	deleteJobAction(idx) {
		// delete selected limit
		this.actions.splice( idx, 1 );
		this.renderJobActionEditor();
	}
	
	// Box Buttons Floater:
	
	setupBoxButtonFloater(initially_visible) {
		// float box buttons if original is offscreen
		this.boxButtons = this.div.find('.box_buttons');
		
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
		this.boxFloater.css({ left: box.left, top: window.innerHeight - box.height, width: box.width });
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
				this.boxFloater.css({ left: box.left, top: window.innerHeight - box.height, width: box.width });
				this.boxFloater[0].offsetWidth; // trigger dom reflow
			}
			if (this.boxFloater.hasClass('hidden')) this.boxFloater.removeClass('hidden');
		}
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
			{ id: 'z_warning', title: 'Warnings', icon: 'alert-circle-outline' },
			{ id: 'z_critical', title: 'Criticals', icon: 'fire-alert' },
			{ id: 'z_abort', title: 'Aborts', icon: 'cancel' }
		].concat(
			this.buildOptGroup( app.tags, "Tags:", 'tag-outline', 't_' )
		).concat(
			{ id: 'z_retried', title: "Retried", icon: 'refresh', group: "System Tags:" },
			{ id: 'z_last', title: "Last in Set", icon: 'page-last' } 
		);
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
			if (!event.timings || !event.timings.length) return false; // on-demand
			
			// check for disabled category
			var category = find_object( app.categories, { id: event.category } );
			if (!category.enabled) return false;
			
			// check for disabled plugin
			var plugin = find_object( app.plugins, { id: event.plugin } );
			if (!plugin.enabled) return false;
			
			// process timings
			var timings = event.timings.filter( function(timing) { return timing.enabled; } );
			var schedules = timings.filter( function(timing) { return (timing.type == 'schedule') || (timing.type == 'single'); } );
			if (!schedules.length) return false;
			
			// setup all unique timezones (intl formatters)
			schedules.forEach( function(timing) {
				if (timing.type != 'schedule') return;
				var tz = timing.timezone || app.config.tz;
				if (tz in opts.formatters) return; // already setup
				
				opts.formatters[tz] = new Intl.DateTimeFormat('en-US', 
					{ year: 'numeric', month: '2-digit', day: 'numeric', weekday: 'long', hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: tz }
				);
			} );
			
			// store some props for fast access below
			event.schedules = schedules;
			event.ranges = timings.filter( function(timing) { return (timing.type == 'range') || (timing.type == 'blackout'); } );
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
				
				event.schedules.forEach( function(timing) {
					if ((timing.type == 'single') && (timing.epoch == opts.epoch)) {
						scheduled = 'single';
						return;
					}
					
					if (timing.type != 'schedule') return; // sanity
					var tz = timing.timezone || app.config.tz;
					var dargs = tzargs[tz];
					
					if (timing.years && timing.years.length && !timing.years.includes(dargs.year)) return;
					if (timing.months && timing.months.length && !timing.months.includes(dargs.month)) return;
					if (timing.days && timing.days.length && !timing.days.includes(dargs.day) && !timing.days.includes(dargs.rday)) return;
					if (timing.weekdays && timing.weekdays.length && !timing.weekdays.includes(dargs.weekday)) return;
					if (timing.hours && timing.hours.length && !timing.hours.includes(dargs.hour)) return;
					if (timing.minutes && timing.minutes.length && !timing.minutes.includes(dargs.minute)) return;
					
					scheduled = 'schedule';
				} ); // foreach schedule
				
				if (!scheduled) return;
				
				// check ranges
				// (both start/end dates are INCLUSIVE)
				event.ranges.forEach( function(timing) {
					switch (timing.type) {
						case 'range':
							if (timing.start && (opts.epoch < timing.start)) scheduled = false;
							else if (timing.end && (opts.epoch > timing.end)) scheduled = false;
						break;
						
						case 'blackout':
							if ((opts.epoch >= timing.start) && (opts.epoch <= timing.end)) scheduled = false;
						break;
					}
				} );
				
				if (!scheduled) return;
				
				// add job!
				opts.jobs.push({ event: event.id, epoch: opts.epoch, type: scheduled });
				
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
		return new Chart( merge_objects(config.chart_defaults, opts) );
	}
	
	chartDownload(key) {
		// download chart image with custom filename
		// (this all happens client-side)
		var chart = this.charts[key];
		var filename = '';
		
		// possibly customize filename for current page
		if (this.job) filename = 'orchestra-job-' + this.job.id + '-' + get_unique_id(8) + '-' + key + '.png';
		else if (this.server) filename = 'orchestra-server-' + this.server.id + '-' + get_unique_id(8) + '-' + key + '.png';
		else if (this.snapshot) filename = 'orchestra-snapshot-' + this.snapshot.id + '-' + get_unique_id(8) + '-' + key + '.png';
		else if (this.event) filename = 'orchestra-event-' + this.event.id + '-' + get_unique_id(8) + '-' + key + '.png';
		else filename = 'orchestra-' + get_unique_id(8) + '-' + key + '.png';
		
		chart.download({
			filename: filename,
			format: 'png', 
			quality: 1.0, 
			width: 1024, 
			height: 512, 
			density: 1
		});
	}
	
	chartCopyLink(key, elem) {
		// upload image to server and copy link to it
		var chart = this.charts[key];
		var $elem = $(elem);
		
		// generate unique ID client-side and "predict" the URL
		// so we can copy it to the clipboard in the click thread
		var filename = '';
		
		// possibly customize filename for current page
		if (this.job) filename = 'job-' + this.job.id + '-' + get_unique_id(8) + '-' + key + '.png';
		else if (this.server) filename = 'server-' + this.server.id + '-' + get_unique_id(8) + '-' + key + '.png';
		else if (this.snapshot) filename = 'snapshot-' + this.snapshot.id + '-' + get_unique_id(8) + '-' + key + '.png';
		else if (this.event) filename = 'event-' + this.event.id + '-' + get_unique_id(8) + '-' + key + '.png';
		else filename = '' + get_unique_id(8) + '-' + key + '.png';
		
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
	
	getQuickMonChartData(rows, id) {
		// format quickmon data to be compat with pixl-chart
		var data = [];
		rows.forEach( function(row) {
			data.push({ x: row.date, y: row[id] });
		} );
		return data;
	}
	
	getMonitorChartData(rows, id) {
		// format monitor timeline data to be compat with pixl-chart
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
		
		var ctype_icons = {
			text: "form-textbox",
			textarea: "form-textarea",
			checkbox: "checkbox-marked-outline",
			select: "form-dropdown",
			hidden: "eye-off-outline"
		};
		var none = '<span>(None)</span>';
		
		html += '<div class="summary_grid">';
		
		plugin.params.forEach( function(param, idx) {
			var elem_value = (param.id in params) ? params[param.id] : param.value;
			var elem_icon = ctype_icons[param.type];
			if (param.type == 'hidden') return;
			
			html += '<div>'; // grid unit
			html += '<div class="info_label">' + (param.locked ? '<i class="mdi mdi-lock-outline">&nbsp;</i>' : '') + param.title + '</div>';
			html += '<div class="info_value">';
			
			switch (param.type) {
				case 'text':
					if (elem_value.toString().length) {
						html += '<i class="link mdi mdi-' + elem_icon + '" onClick="$P().copyPluginParamValue(' + idx + ')" title="Copy to Clipboard">&nbsp;</i>';
						html += elem_value.toString().length ? elem_value : none;
					}
					else html += none;
				break;
				
				case 'textarea':
					if (elem_value.toString().length) {
						html += '<i class="link mdi mdi-' + elem_icon + '" onClick="$P().copyPluginParamValue(' + idx + ')" title="Copy to Clipboard">&nbsp;</i>';
						html += '<span class="link" onClick="$P().viewPluginParamValue(' + idx + ')">Click to View...</span>';
					}
					else html += none;
				break;
				
				case 'checkbox':
					// html += self.getFormCheckbox({ id: elem_id, label: param.title, checked: !!elem_value, disabled: elem_dis });
					elem_icon = elem_value ? 'checkbox-marked-outline' : 'checkbox-blank-outline';
					html += '<i class="mdi mdi-' + elem_icon + '">&nbsp;</i>';
					if (elem_value) html += 'Yes';
					else html += '<span>No</span>'; 
				break;
				
				case 'select':
					html += '<i class="link mdi mdi-' + elem_icon + '" onClick="$P().copyPluginParamValue(' + idx + ')" title="Copy to Clipboard">&nbsp;</i>';
					html += elem_value;
				break;
			} // switch type
			
			html += '</div>'; // info_value
			html += '</div>'; // grid unit
		} ); // foreach param
		
		html += '</div>'; // summary_grid
		
		this.div.find(sel).show();
		this.div.find( sel + ' > .box_title > span').html( plugin.title + " Parameters" );
		this.div.find( sel + ' > .box_content').html( html );
	}
	
	copyPluginParamValue(idx) {
		// copy specific plugin param value to the clipboard
		var item = this.job || this.event;
		var plugin = find_object( app.plugins, { id: item.plugin } );
		var param = plugin.params[idx];
		var elem_value = (param.id in item.params) ? item.params[param.id] : param.value;
		
		copyToClipboard(elem_value);
		
		app.showMessage('info', "Parameter value copied to your clipboard.");
	}
	
	viewPluginParamValue(idx) {
		// popup dialog to show multi-line text box param value
		var item = this.job || this.event;
		var plugin = find_object( app.plugins, { id: item.plugin } );
		var param = plugin.params[idx];
		var elem_value = (param.id in item.params) ? item.params[param.id] : param.value;
		
		this.viewCodeAuto( param.title, elem_value );
	}
	
	viewCodeAuto(title, data, formats) {
		// popup dialog to show pretty-printed code (auto-detect)
		var self = this;
		var value = this._temp_code = ((typeof(data) == 'string') ? data : JSON.stringify(data, null, "\t"));
		var html = '';
		
		html += '<div class="code_viewer">';
		html += '<pre><code class="hljs">' + app.highlightAuto(value, formats) + '</code></pre>';
		html += '</div>';
		
		var buttons_html = "";
		buttons_html += '<div class="button" onMouseUp="$P().copyCodeToClipboard()">Copy to Clipboard</div>';
		buttons_html += '<div class="button primary" onMouseUp="Dialog.confirm_click(true)">Close</div>';
		
		Dialog.showSimpleDialog(title, html, buttons_html);
		
		// special mode for key capture
		Dialog.active = 'confirmation';
		Dialog.confirm_callback = function(result) { 
			if (result) Dialog.hide(); 
		};
		Dialog.onHide = function() {
			delete self._temp_code;
		};
	}
	
	viewMarkdownAuto(title, text, btn) {
		// popup dialog to show pretty-printed markdown
		var self = this;
		this._temp_code = text;
		var html = '';
		
		html += '<div class="code_viewer">';
		html += '<div class="markdown-body">';
		
		html += marked(text, config.ui.marked_config);
		
		html += '</div>'; // markdown-body
		html += '</div>'; // code_viewer
		
		var buttons_html = "";
		if (btn) buttons_html += btn;
		else buttons_html += '<div class="button" onMouseUp="$P().copyCodeToClipboard()">Copy to Clipboard</div>';
		buttons_html += '<div class="button primary" onMouseUp="Dialog.confirm_click(true)">Close</div>';
		
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
	}
	
	copyCodeToClipboard() {
		// copy code currently being displayed in dialog to clipboard
		if (this._temp_code) {
			copyToClipboard(this._temp_code);
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
			hljs.highlightElement(this);
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
		var $content = $box.find('> div.box_content');
		
		if ($box.hasClass('expanded')) {
			$box.removeClass('expanded');
			
			$content.scrollTop(0).css('height', $content[0].scrollHeight);
			
			$content.stop().animate({
				scrollTop: $content[0].scrollHeight,
				height: 0
			}, {
				duration: 500,
				easing: 'easeOutQuart'
			});
			
			if ($box.prop('id')) app.setPref('toggle_boxes.' + $box.prop('id'), 'collapsed');
		}
	}
	
	expandToggleBox($box) {
		// expand toggle box
		var $content = $box.find('> div.box_content');
		
		if (!$box.hasClass('expanded')) {
			$box.addClass('expanded');
			
			$content.css('height', 0).scrollTop( $content[0].scrollHeight );
			
			$content.stop().animate({
				scrollTop: 0,
				height: $content[0].scrollHeight
			}, {
				duration: 500,
				easing: 'easeOutQuart'
			});
			
			if ($box.prop('id')) app.setPref('toggle_boxes.' + $box.prop('id'), 'expanded');
		}
	}
	
};
