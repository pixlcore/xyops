// Orchestra Web App
// Author: Joseph Huckaby
// Copyright (c) 2021 Joseph Huckaby

if (!window.app) throw new Error("App Framework is not present.");

app.extend({
	
	name: '',
	epoch: time_now(),
	preload_images: [],
	plain_text_post: false,
	activeJobs: {},
	pageSnapshots: {},
	pageDrafts: {},
	serverCache: {},
	default_prefs: {
		
	},
	debug_cats: {
		all: true,
		api: true,
		comm: false
	},
	
	colors: ["#008FFB", "#00E396", "#FEB019", "#FF4560", "#775DD0", "#3F51B5", "#4CAF50", "#546E7A", "#D4526E", "#A5978B", "#C7F464", "#81D4FA", "#2B908F", "#F9A3A4", "#90EE7E", "#FA4443", "#449DD1", "#F86624", "#69D2E7", "#EA3546", "#662E9B", "#C5D86D", "#D7263D", "#1B998B", "#2E294E", "#F46036", "#E2C044", "#662E9B", "#F86624", "#F9C80E", "#EA3546", "#43BCCD", "#5C4742", "#A5978B", "#8D5B4C", "#5A2A27", "#C4BBAF", "#A300D6", "#7D02EB", "#5653FE", "#2983FF", "#00B1F2", "#03A9F4", "#33B2DF", "#4ECDC4", "#13D8AA", "#FD6A6A", "#F9CE1D", "#FF9800"],
	
	activity_types: {
		'^apikey': { icon: 'key-variant', label: 'API Key' },	
		
		'^user_create': { icon: 'account-plus', label: 'User' },
		'^user_update': { icon: 'account-edit', label: 'User' },
		'^user_login': { icon: 'account-key', label: 'User' },
		'^user_password': { icon: 'account-key', label: 'User' },
		'^user': { icon: 'account', label: 'User' },
		
		'^error': { icon: 'alert-decagram', label: 'Error' },
		'^warning': { icon: 'alert-circle', label: 'Warning' },
		'^notice': { icon: 'information-outline', label: 'Notice' },
		'^group': { icon: 'server-network', label: 'Group' },
		'^command': { icon: 'console', label: 'Command' },
		'^server': { icon: 'server', label: 'Server' },
		'^master': { icon: 'database', label: 'Master' },
		'^peer': { icon: 'database', label: 'Master' },
		'^monitor': { icon: 'chart-line', label: 'Monitor' },
		
		'^alert_new': { icon: 'progress-alert', label: 'Alert' },
		'^alert_cleared': { icon: 'alert-circle-outline', label: 'Alert' },
		'^alert': { icon: 'bell-outline', label: 'Alert' },
		
		'^tag': { icon: 'tag-outline', label: 'Tag' },
		'^category': { icon: 'folder-open-outline', label: 'Category' },
		'^event': { icon: 'file-clock-outline', label: 'Event' },
		'^workflow': { icon: 'clipboard-list-outline', label: 'Workflow' },
		'^channel': { icon: 'bullhorn-outline', label: 'Channel' },
		'^plugin': { icon: 'power-plug-outline', label: 'Plugin' },
		'^job': { icon: 'timer-outline', label: 'Job' },
		'^queue': { icon: 'tray-full', label: 'Queue' },
		
		'^state': { icon: 'database-outline', label: 'State' },
	},
	
	receiveConfig: function(resp) {
		// receive config from server
		delete resp.code;
		window.config = resp.config;
		
		// load prefs and populate for first time users
		this.initPrefs();
		
		// allow special pref to enable debug
		if (this.getPref('debug')) config.debug = true;
		
		if (config.debug) {
			Debug.enable( this.debug_cats );
			Debug.trace('system', "Orchestra Client Starting Up");
		}
		
		// setup theme (light / dark)
		this.initTheme();
		
		for (var key in resp) {
			this[key] = resp[key];
		}
		
		// allow visible app name to be changed in config
		this.name = config.name;
		
		this.config.Page = [
			{ ID: 'Dashboard' },
			{ ID: 'Document' },
			{ ID: 'Login' },
			{ ID: 'Events' },
			{ ID: 'Job' },
			{ ID: 'Search' },
			{ ID: 'MyAccount' },
			{ ID: 'MySecurity' },
			{ ID: 'MySettings' },
			{ ID: 'APIKeys' },
			{ ID: 'Groups' },
			{ ID: 'Commands' },
			{ ID: 'Monitors' },
			{ ID: 'AlertSetup' },
			{ ID: 'Categories' },
			{ ID: 'Channels' },
			{ ID: 'Plugins' },
			{ ID: 'Tags' },
			{ ID: 'Users' },
			{ ID: 'ActivityLog' },
			{ ID: 'Masters' },
			{ ID: 'Servers' },
			{ ID: 'ServerHist' },
			{ ID: 'Snapshots' },
			{ ID: 'Alerts' }
		];
		this.config.DefaultPage = 'Dashboard';
		
		// did we try to init and fail?  if so, try again now
		if (this.initReady) {
			Dialog.hideProgress();
			delete this.initReady;
			this.init();
		}
	},
	
	init: function() {
		// initialize application
		if (this.abort) return; // fatal error, do not initialize app
		
		if (!this.config) {
			// must be in master server wait loop
			this.initReady = true;
			return;
		}
		
		// preload a few essential images
		for (var idx = 0, len = this.preload_images.length; idx < len; idx++) {
			var filename = '' + this.preload_images[idx];
			var img = new Image();
			img.src = '/images/'+filename;
		}
		
		// setup month day cache
		this.lastMonthDayCache = {};
		
		// precompile regexpes
		this.hostnameStrip = new RegExp( config.hostname_display_strip );
		
		// pop version into footer
		$('#d_footer_version').html( "Version " + this.version || 0 );
		// $('#d_footer_version').html( get_inner_window_size().width );
		
		// some css munging for browser weirdness
		var ua = navigator.userAgent;
		if (ua.match(/Safari/) && !ua.match(/(Chrome|Opera|Edge)/)) {
			$('body').addClass('safari');
		}
		else if (ua.match(/Chrome/)) {
			$('body').addClass('chrome');
		}
		else if (ua.match(/Firefox/)) {
			$('body').addClass('firefox');
		}
		else if (ua.match(/(MSIE|Trident)/)) {
			$('body').addClass('ie');
		}
		
		// hook up mobile sidebar pullover
		$('#d_sidebar_toggle').on('mouseup', function() { app.pullSidebar(); } );
		
		window.addEventListener( "scroll", this.onScroll.bind(this), false );
		window.addEventListener( "scroll", debounce(this.onScrollDelay.bind(this), 250), false );
		
		this.cacheBust = time_now();
		this.page_manager = new PageManager( always_array(config.Page) );
		
		if (!Nav.inited) Nav.init();
	},
	
	presortTables: function() {
		// pre-sort tables by sort order, or by title
		['groups', 'plugins', 'categories', 'events', 'channels', 'monitors', 'alerts', 'commands'].forEach( function(key) {
			if (app[key].length && ('sort_order' in app[key][0])) {
				app[key].sort( function(a, b) {
					return (a.sort_order < b.sort_order) ? -1 : 1;
				} );
			}
			else {
				app[key].sort( function(a, b) {
					return a.title.toLowerCase().localeCompare( b.title.toLowerCase() );
				} );
			}
		} );
	},
	
	updateHeaderInfo: function(bust) {
		// update top-right display
		var html = '';
		
		html += '<div class="header_widget icon"><i class="mdi mdi-power-standby" onClick="app.doUserLogout()" title="Logout"></i></div>';
		html += '<div class="header_widget user" style="background-image:url(' + this.getUserAvatarURL( this.retina ? 64 : 32, bust ) + ')" onClick="app.doMyAccount()" title="My Account (' + app.username + ')"></div>';
		html += '<div class="header_widget icon"><i class="mdi mdi-tune-vertical-variant" onClick="app.doMySettings()" title="Edit Settings"></i></div>';
		html += '<div id="d_theme_ctrl" class="header_widget icon" onClick="app.openThemeSelector()" title="Select Theme"></div>';
		html += '<div id="d_header_clock" class="header_widget combo" onClick="app.openScheduleSelector()" title="Toggle Scheduler">...</div>';
		
		html += '<div id="d_job_counter" class="header_widget combo" onClick="app.goJobs()" title="Active Jobs" style="display:none">...</div>';
		html += '<div id="d_alert_counter" class="header_widget combo red" onClick="app.goAlerts()" title="Active Alerts" style="display:none">...</div>';
		
		// html += '<div class="header_search_widget"><i class="mdi mdi-magnify">&nbsp;</i><input type="text" size="15" id="fe_header_search" placeholder="Quick Search" onKeyDown="app.qsKeyDown(this,event)"/></div>';
		$('#d_header_user_container').html( html );
		
		this.initTheme();
		this.initSidebarTabs();
		this.updateHeaderClock();
		
		this.updateJobCounter();
		this.updateAlertCounter();
	},
	
	updateAlertCounter: function() {
		// update alert counter
		var num_alerts = num_keys( this.activeAlerts || {} );
		
		if (num_alerts) {
			$('#d_alert_counter').show().html( '<i class="mdi mdi-bell-ring-outline"></i><span><b>' + commify(num_alerts) + '</b></span>' );
		}
		else {
			$('#d_alert_counter').hide();
		}
	},
	
	updateJobCounter: function() {
		// update job counter
		var num_jobs = num_keys( this.activeJobs || {} );
		
		if (num_jobs) {
			$('#d_job_counter').show().html( '<i class="mdi mdi-timer-outline"></i><span><b>' + commify(num_jobs) + '</b></span>' );
		}
		else {
			$('#d_job_counter').hide();
		}
	},
	
	updateHeaderClock: function() {
		// redraw header clock (called every 1s by server status update)
		var html = '';
		
		if (this.state.scheduler.enabled) {
			html += '<i class="mdi mdi-clock-time-four-outline"></i><span>' + app.formatDate(app.epoch, { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + '</span>';
		}
		else {
			html += '<i class="mdi mdi-pause-circle"></i><span>Paused</span>';
		}
		
		$('#d_header_clock').html( html );
	},
	
	openScheduleSelector: function() {
		// show scheduler toggler
		var self = this;
		
		this.popupQuickMenu({
			elem: '#d_header_clock',
			title: 'Job Scheduler',
			items: [
				{ id: 'enabled', title: 'Active', icon: 'play-circle' },
				{ id: 'disabled', title: 'Paused', icon: 'pause-circle' }
			],
			value: this.state.scheduler.enabled ? 'enabled' : 'disabled',
			
			callback: function(value) {
				var enabled = (value == 'enabled');
				
				app.api.post( 'app/update_master_state', { 'scheduler.enabled': enabled }, function(resp) {
					self.state.scheduler.enabled = enabled;
					self.updateHeaderClock();
					
					// add temp local flare if disabled
					if (!enabled) $('#d_header_clock').addClass('red');
					else $('#d_header_clock').removeClass('red');
				} ); // api.post
			} // callback
		}); // popupQuickMenu
	},
	
	openThemeSelector: function() {
		// show light/dark/auto theme selector
		var self = this;
		
		this.popupQuickMenu({
			elem: '#d_theme_ctrl',
			title: 'Select Theme',
			items: [
				{ id: 'light', title: 'Light', icon: 'weather-sunny' },
				{ id: 'dark', title: 'Dark', icon: 'weather-night' },
				{ id: 'auto', title: 'Auto', icon: 'circle-half-full' }
			],
			value: this.getPref('theme'),
			
			callback: function(value) {
				app.setTheme(value);
			} // callback
		}); // popupQuickMenu
	},
	
	popupQuickMenu: function(opts) {
		// show popup menu on custom element
		// opts: { elem, title, items, value, callback }
		// item: { id, title, icon }
		var self = this;
		var $elem = $(opts.elem);
		var items = opts.items;
		var callback = opts.callback;
		var html = '';
		
		html += '<div class="sel_dialog_label">' + opts.title + '</div>';
		html += '<div id="d_sel_dialog_scrollarea" class="sel_dialog_scrollarea">';
		for (var idy = 0, ley = items.length; idy < ley; idy++) {
			var item = items[idy];
			var sel = (item.id == opts.value);
			html += '<div class="sel_dialog_item check ' + (sel ? 'selected' : '') + '" data-value="' + item.id + '">';
			if (item.icon) html += '<i class="mdi mdi-' + item.icon + '">&nbsp;</i>';
			html += '<span>' + item.title + '</span>';
			html += '<div class="sel_dialog_item_check"><i class="mdi mdi-check"></i></div>';
			html += '</div>';
		}
		html += '</div>';
		
		Popover.attach( $elem, '<div style="padding:15px;">' + html + '</div>', true );
		
		$('#d_sel_dialog_scrollarea > div.sel_dialog_item').on('mouseup', function() {
			// select item, close dialog and update state
			var $item = $(this);
			var value = $item.data('value');
			
			Popover.detach();
			callback(value);
		}); // mouseup
		
		Popover.onDetach = function() {
			$elem.removeClass('popped');
		};
		
		$elem.addClass('popped');
	},
	
	qsKeyDown: function(elem, event) {
		// capture enter key in header search
		if ((event.keyCode == 13) && elem.value.length) {
			event.preventDefault();
			$P().doQuickSearch( elem.value );
			elem.value = '';
		}
	},
	
	doMySettings: function() {
		// jump to the MySettings page
		Nav.go('MySettings');
	},
	
	initSidebarTabs: function() {
		// setup dynamic tabs
		
		// user searches
		var $section = $('#d_section_my_searches').empty();
		if (this.user.searches && this.user.searches.length) {
			this.user.searches.sort( function(a, b) {
				return a.name.localeCompare( b.name );
			} );
			this.user.searches.forEach( function(search) {
				var icon = search.icon || '';
				if (!icon) icon = 'magnify';
				
				var $search = $('<a></a>')
					.prop('id', 'tab_Search_' + search.name.replace(/\W+/g, ''))
					.attr('href', '#Search?preset=' + search.name)
					.addClass('section_item')
					.html( '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + search.name );
				$section.append( $search );
			} );
		}
		else {
			$section.append( '<div class="section_item disabled">(None found)</div>' );
		}
		
		// calling this again to recalculate sidebar expandable group heights, for animation toggle thing
		setTimeout( function() { app.page_manager.initSidebar(); }, 1 );
	},
	
	notifyUserNav: function(loc) {
		// called for each user page nav operation
		this.comm.sendCommand('user_nav', { loc });
	},
	
	doUserLogin: function(resp) {
		// user login, called from login page, or session recover
		// overriding this from base.js
		delete resp.code;
		
		for (var key in resp) {
			this[key] = resp[key];
		}
		
		this.setPref('username', resp.username);
		this.setPref('session_id', resp.session_id);
		
		this.presortTables();
		this.updateHeaderInfo();
		this.pruneData();
		
		// show admin tab if user is worthy
		if (this.isAdmin()) {
			$('#d_sidebar_admin_group').show();
			$('body').addClass('admin');
		}
		else {
			$('#d_sidebar_admin_group').hide();
			$('body').removeClass('admin');
		}
		
		// websocket connect
		this.comm.init();
	},
	
	doUserLogout: function(bad_cookie) {
		// log user out and redirect to login screen
		var self = this;
		
		if (!bad_cookie) {
			// user explicitly logging out
			Dialog.showProgress(1.0, "Logging out...");
			this.setPref('username', '');
		}
		
		this.api.post( 'user/logout', {
			session_id: this.getPref('session_id')
		}, 
		function(resp) {
			Dialog.hideProgress();
			delete self.user;
			delete self.username;
			delete self.user_info;
			delete app.navAfterLogin;
			
			self.setPref('session_id', '');
			$('#d_header_user_container').html( '' );
			
			// kill websocket
			self.comm.disconnect();
			
			if (app.config.external_users) {
				// external user api
				Debug.trace("User session cookie was deleted, querying external user API");
				setTimeout( function() {
					if (bad_cookie) app.doExternalLogin(); 
					else app.doExternalLogout(); 
				}, 250 );
			}
			else if (app.auth0) {
				Debug.trace('auth0', "Logging out of auth0...");
				app.auth0.logout({
					returnTo: window.location.origin
				});
			}
			else {
				Debug.trace("User session cookie was deleted, redirecting to login page");
				Dialog.hideProgress();
				Nav.go('Login');
			}
			
			setTimeout( function() {
				if (!app.config.external_users) {
					if (bad_cookie) self.showMessage('error', "Your session has expired.  Please log in again.");
					else self.showMessage('success', "You were logged out successfully.");
				}
			}, 150 );
			
			$('#d_sidebar_admin_group').hide();
			$('body').removeClass('admin');
		} );
	},
	
	doExternalLogin: function() {
		// login using external user management system
		// Force API to hit current page hostname vs. master server, so login redirect URL reflects it
		var self = this;
		
		app.api.post( '/api/user/external_login', { cookie: document.cookie }, function(resp) {
			if (resp.user) {
				Debug.trace("User Session Resume: " + resp.username + ": " + resp.session_id);
				Dialog.hideProgress();
				self.doUserLogin( resp );
				Nav.refresh();
			}
			else if (resp.location) {
				Debug.trace("External User API requires redirect");
				Dialog.showProgress(1.0, "Logging in...");
				setTimeout( function() { window.location = resp.location; }, 250 );
			}
			else app.doError(resp.description || "Unknown login error.");
		} );
	},
	
	doExternalLogout: function() {
		// redirect to external user management system for logout
		var url = app.config.external_user_api;
		url += (url.match(/\?/) ? '&' : '?') + 'logout=1';
		
		Debug.trace("External User API requires redirect");
		Dialog.showProgress(1.0, "Logging out...");
		setTimeout( function() { window.location = url; }, 250 );
	},
	
	get_password_toggle_html: function() {
		// get html for a password toggle control
		return '<span class="link password_toggle" onMouseUp="app.toggle_password_field(this)">&laquo;&nbsp;Show</span>';
	},
	
	toggle_password_field: function(span) {
		// toggle password field visible / masked
		var $span = $(span);
		// var $field = $span.prev();
		var $field = $span.closest('.form_row').find('input');
		if ($field.attr('type') == 'password') {
			$field.attr('type', 'text');
			$span.html( '&laquo; Hide' );
		}
		else {
			$field.attr('type', 'password');
			$span.html( '&laquo; Show' );
		}
	},
	
	formatHostname: function(hostname) {
		// format hostname for display
		return hostname.replace( this.hostnameStrip, '' );
	},
	
	onScroll: function() {
		// called immediately while scrolling
		if (app.page_manager && app.page_manager.current_page_id) {
			var page = app.page_manager.find(app.page_manager.current_page_id);
			if (page && page.onScroll) page.onScroll();
		}
	},
	
	onScrollDelay: function() {
		// called every so often while scrolling
		if (app.page_manager && app.page_manager.current_page_id) {
			var page = app.page_manager.find(app.page_manager.current_page_id);
			if (page && page.onScrollDelay) page.onScrollDelay();
			if (page && page.updateBoxButtonFloaterState) page.updateBoxButtonFloaterState();
		}
	},
	
	getDateOptions(opts = {}) {
		// get combined date/time options with user locale settings
		var user = this.user;
		var ropts = Intl.DateTimeFormat().resolvedOptions();
		var [lang, reg] = ropts.locale.split(/\-/);
		
		lang = user.language || lang;
		reg = user.region || reg;
		
		if (!opts.locale) opts.locale = lang + '-' + reg;
		if (!opts.timeZone) opts.timeZone = user.timezone || ropts.timeZone;
		if (!opts.numberingSystem) opts.numberingSystem = user.num_format || ropts.numberingSystem;
		if (!opts.hourCycle) opts.hourCycle = user.hour_cycle;
		
		if (opts.locale === false) delete opts.locale;
		if (opts.timeZone === false) delete opts.timeZone;
		if (opts.numberingSystem === false) delete opts.numberingSystem;
		if (opts.hourCycle === false) delete opts.hourCycle;
		
		return opts;
	},
	
	formatDate(epoch, opts) {
		// format date and/or time according to user locale settings
		opts = this.getDateOptions(opts);
		return (new Date( epoch * 1000 )).toLocaleString( opts.locale, opts );
	},
	
	pruneData: function() {
		// prune data affected by user privs
		this.pruneEvents();
		this.pruneCategories();
		this.pruneGroups();
		this.pruneServers();
		this.pruneActiveAlerts();
	},
	
	pruneActiveJobs: function() {
		// remove active jobs that the user should not see, due to category/group privs
		if (!this.activeJobs || this.isAdmin()) return;
		
		for (var id in this.activeJobs) {
			var job = this.activeJobs[id];
			if (!this.hasCategoryAccess(job.category) || !this.hasGroupAccessAll(job.targets)) {
				delete this.activeJobs[id];
			}
		}
	},
	
	pruneEvents: function() {
		// remove events that the user should not see, due to category/group privs
		if (!this.events || !this.events.length || this.isAdmin()) return;
		var new_items = [];
		
		for (var idx = 0, len = this.events.length; idx < len; idx++) {
			var item = this.events[idx];
			if (this.hasCategoryAccess(item.category) && this.hasGroupAccessAll(item.targets)) {
				new_items.push(item);
			}
		}
		
		this.events = new_items;
	},
	
	pruneCategories: function() {
		// remove categories that the user should not see, due to category privs
		if (!this.categories || !this.categories.length || this.isAdmin()) return;
		var new_items = [];
		
		for (var idx = 0, len = this.categories.length; idx < len; idx++) {
			var item = this.categories[idx];
			if (this.hasCategoryAccess(item.id)) new_items.push(item);
		}
		
		this.categories = new_items;
	},
	
	pruneGroups: function() {
		// remove groups that the user should not see, due to group privs
		if (!this.groups || !this.groups.length || this.isAdmin()) return;
		var new_items = [];
		
		for (var idx = 0, len = this.groups.length; idx < len; idx++) {
			var item = this.groups[idx];
			if (this.hasGroupAccess(item.id)) new_items.push(item);
		}
		
		this.groups = new_items;
	},
	
	pruneServers: function() {
		// remove servers that the user should not see, due to group privs
		if (!this.isGroupLimited()) return;
		var new_servers = {};
		
		for (var server_id in this.servers) {
			var server = this.servers[server_id];
			if (this.hasGroupAccessAny(server.groups)) new_servers[server_id] = server;
		}
		
		this.servers = new_servers;
	},
	
	pruneActiveAlerts: function() {
		// remove alerts that the user should not see, due to group privs
		if (!this.isGroupLimited()) return;
		var new_alerts = {};
		
		for (var id in this.activeAlerts) {
			var alert = this.activeAlerts[id];
			if (this.hasGroupAccessAny(alert.groups)) new_alerts[id] = alert;
		}
		
		this.activeAlerts = new_alerts;
	},
	
	isCategoryLimited: function() {
		// return true if user is limited to specific categories, false otherwise
		if (this.isAdmin()) return false;
		return ( app.user && app.user.categories && app.user.categories.length );
	},
	
	isGroupLimited: function() {
		// return true if user is limited to specific server groups, false otherwise
		if (this.isAdmin()) return false;
		return ( app.user && app.user.groups && app.user.groups.length );
	},
	
	hasCategoryAccess: function(cat_id) {
		// check if user has access to specific category
		if (!app.user || !app.user.privileges) return false;
		if (app.user.privileges.admin) return true;
		if (!this.isCategoryLimited()) return true;
		return app.user.categories.includes(cat_id);
	},
	
	hasGroupAccessAll: function(targets) {
		// check if user has access to a list of targets
		// user must have access to ALL targets in list
		for (var idx = 0, len = targets.length; idx < len; idx++) {
			if (!this.hasGroupAccess(targets[idx])) return false;
		}
		return true;
	},
	
	hasGroupAccessAny: function(targets) {
		// check if user has access to a list of targets
		// user must have access to ANY targets in list
		for (var idx = 0, len = targets.length; idx < len; idx++) {
			if (this.hasGroupAccess(targets[idx])) return true;
		}
		return false;
	},
	
	hasGroupAccess: function(grp_id) {
		// check if user has access to specific server group (or hostname)
		if (!app.user || !app.user.privileges) return false;
		if (app.user.privileges.admin) return true;
		if (!this.isGroupLimited()) return true;
		if (app.user.groups.includes(grp_id)) return true;
		
		// make sure grp_id is a hostname from this point on
		if (find_object(app.groups, { id: grp_id })) return false;
		
		var groups = app.groups.filter( function(group) {
			return grp_id.match( group.hostname_match );
		} );
		
		// we just need one group to match, then the user has permission to target the server
		for (var idx = 0, len = groups.length; idx < len; idx++) {
			if (app.user.groups.includes(groups[idx].id)) return true;
		}
		return false;
	},
	
	hasPrivilege: function(priv_id) {
		// check if user has privilege
		if (!app.user || !app.user.privileges) return false;
		if (app.user.privileges.admin) return true;
		return( !!app.user.privileges[priv_id] );
	},
	
	includesAny: function(haystack, needles) {
		// return true if haystack contains any needles
		for (var idx = 0, len = needles.length; idx < len; idx++) {
			if (haystack.includes(needles[idx])) return true;
		}
		return false;
	},
	
	getLastDayInMonth: function(year, month) {
		// compute the last day in the month, and cache in RAM
		var cache_key = '' + year + '/' + month;
		if (cache_key in this.lastMonthDayCache) return this.lastMonthDayCache[cache_key];
		
		var last_day = new Date(year, month, 0).getDate();
		this.lastMonthDayCache[cache_key] = last_day;
		
		return last_day;
	}
	
}); // app
