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
	tracks: {},
	default_prefs: {
		
	},
	debug_cats: {
		all: true,
		api: true,
		comm: false
	},
	
	colors: ["#008FFB", "#00E396", "#FEB019", "#FF4560", "#775DD0", "#3F51B5", "#4CAF50", "#546E7A", "#D4526E", "#A5978B", "#C7F464", "#81D4FA", "#2B908F", "#F9A3A4", "#90EE7E", "#FA4443", "#449DD1", "#F86624", "#69D2E7", "#EA3546", "#662E9B", "#C5D86D", "#D7263D", "#1B998B", "#2E294E", "#F46036", "#E2C044", "#662E9B", "#F86624", "#F9C80E", "#EA3546", "#43BCCD", "#5C4742", "#A5978B", "#8D5B4C", "#5A2A27", "#C4BBAF", "#A300D6", "#7D02EB", "#5653FE", "#2983FF", "#00B1F2", "#03A9F4", "#33B2DF", "#4ECDC4", "#13D8AA", "#FD6A6A", "#F9CE1D", "#FF9800"],
	
	cmLangMap: {
		"go": "text/x-go",
		"javascript": "application/javascript",
		"json": "application/json",
		"perl": "text/x-perl",
		"php": "text/x-php",
		"python": "text/x-python",
		"shell": "text/x-sh",
		"xml": "text/xml"
	},
	cmThemeMap: {
		"light": "default",
		"dark": "shadowfox"
	},
	
	receiveConfig: function(resp) {
		// receive config from server
		delete resp.code;
		window.config = resp.config;
		
		// apply menu item max
		SingleSelect.maxMenuItems = config.max_menu_items || 1000;
		
		// setup audio subsystem
		this.initAudio();
		
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
		
		// check for prefers-reduced-motion
		this.initAccessibility();
		
		for (var key in resp) {
			this[key] = resp[key];
		}
		
		// config blob should have epoch, so track delta from it
		this.serverPerfStart = performance.now();
		
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
			{ ID: 'Monitors' },
			{ ID: 'AlertSetup' },
			{ ID: 'Categories' },
			{ ID: 'Channels' },
			{ ID: 'WebHooks' },
			{ ID: 'Plugins' },
			{ ID: 'Tags' },
			{ ID: 'Roles' },
			{ ID: 'Users' },
			{ ID: 'ActivityLog' },
			{ ID: 'Masters' },
			{ ID: 'Servers' },
			{ ID: 'ServerHist' },
			{ ID: 'GroupHist' },
			{ ID: 'Snapshots' },
			{ ID: 'Alerts' },
			{ ID: 'System' }
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
		['groups', 'plugins', 'categories', 'events', 'channels', 'monitors', 'alerts'].forEach( function(key) {
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
	
	onThemeChange: function(theme) {
		// called when theme changes
		if (app.page_manager && app.page_manager.current_page_id) {
			var page = app.page_manager.find(app.page_manager.current_page_id);
			if (page && page.onThemeChange) page.onThemeChange( theme );
		}
		
		// update highlight.js css
		var $head = $('head');
		$head.find('link[hljs]').remove();
		
		switch (theme) {
			case 'light': $head.append('<link rel="stylesheet" href="css/atom-one-light.css" hljs>'); break;
			case 'dark': $head.append('<link rel="stylesheet" href="css/atom-one-dark.css" hljs>'); break;
		}
	},
	
	updateHeaderInfo: function(bust) {
		// update top-right display
		var html = '';
		
		html += '<div class="header_widget icon danger"><i class="mdi mdi-power-standby" onClick="app.doUserLogout()" title="Logout"></i></div>';
		html += '<div class="header_widget user" style="background-image:url(' + this.getUserAvatarURL( this.retina ? 64 : 32, bust ) + ')" onClick="app.doMyAccount()" title="My Account (' + app.username + ')"></div>';
		html += '<div class="header_widget icon"><i class="mdi mdi-tune-vertical-variant" onClick="app.doMySettings()" title="My Preferences"></i></div>';
		html += '<div id="d_theme_ctrl" class="header_widget icon" onMouseDown="app.openThemeSelector()" title="Select Theme"></div>';
		html += '<div id="d_header_clock" class="header_widget combo" onMouseDown="app.openScheduleSelector()" title="Toggle Scheduler">...</div>';
		
		html += '<div id="d_job_counter" class="header_widget combo marquee" onClick="app.goJobs()" title="Active Jobs" style="display:none">...</div>';
		html += '<div id="d_alert_counter" class="header_widget combo red" onClick="app.goAlerts()" title="Active Alerts" style="display:none">...</div>';
		
		// html += '<div class="header_search_widget"><i class="mdi mdi-magnify">&nbsp;</i><input type="text" size="15" id="fe_header_search" placeholder="Quick Search" onKeyDown="app.qsKeyDown(this,event)"/></div>';
		$('#d_header_user_container').html( html );
		
		this.$headerClock = $('#d_header_clock');
		this.$alertCounter = $('#d_alert_counter');
		this.$jobCounter = $('#d_job_counter');
		
		// reapply theme so header widget is updated
		this.setTheme( this.getPref('theme') || 'auto' );
		
		this.initSidebarTabs();
		this.updateHeaderClock();
		
		this.updateJobCounter();
		this.updateAlertCounter();
	},
	
	goAlerts: function() {
		Nav.go('Alerts');
	},
	
	goJobs: function() {
		Nav.go('Dashboard');
	},
	
	updateAlertCounter: function() {
		// update alert counter
		var num_alerts = num_keys( this.activeAlerts || {} );
		
		if (num_alerts) {
			this.$alertCounter.show().html( '<i class="mdi mdi-bell-ring-outline"></i><span><b>' + commify(num_alerts) + ' ' + pluralize('Alert', num_alerts) + '</b></span>' );
		}
		else {
			this.$alertCounter.hide();
		}
	},
	
	updateJobCounter: function() {
		// update job counter
		var num_jobs = num_keys( this.activeJobs || {} );
		
		// augment with internal job count
		num_jobs += app.isAdmin() ? 
			Object.values(this.internalJobs).filter( function(job) { return !job.quiet; } ).length : 
			Object.values(this.internalJobs).filter( function(job) { return job.username && (job.usernane == app.username) && !job.quiet; } ).length;
		
		if (num_jobs) {
			this.$jobCounter.show().html( '<i class="mdi mdi-run-fast"></i><span><b>' + commify(num_jobs) + ' ' + pluralize('Job', num_jobs) + '</b></span>' );
		}
		else {
			this.$jobCounter.hide();
		}
	},
	
	updateHeaderClock: function() {
		// redraw header clock (called every 1s by server status update)
		if (this.state.scheduler.enabled) {
			this.$headerClock.html( 
				'<i class="mdi mdi-clock-time-four-outline"></i><span>' + 
				app.formatDate(app.epoch, { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + 
				'</span>' 
			);
			if (this.$headerClock.hasClass('red')) this.$headerClock.removeClass('red');
		}
		else {
			this.$headerClock.html( '<i class="mdi mdi-pause-circle"></i><span><b>Paused</b></span>' );
			if (!this.$headerClock.hasClass('red')) this.$headerClock.addClass('red');
		}
	},
	
	openScheduleSelector: function() {
		// show scheduler toggler
		var self = this;
		
		SingleSelect.popupQuickMenu({
			elem: '#d_header_clock',
			title: 'Job Scheduler',
			items: [
				{ id: 'enabled', title: 'Active', icon: 'play-circle-outline' },
				{ id: 'disabled', title: 'Paused', icon: 'pause-circle-outline' }
			],
			value: this.state.scheduler.enabled ? 'enabled' : 'disabled',
			
			callback: function(value) {
				var enabled = (value == 'enabled');
				
				app.api.post( 'app/update_master_state', { 'scheduler.enabled': enabled }, function(resp) {
					self.state.scheduler.enabled = enabled;
					self.updateHeaderClock();
					if (enabled) self.showMessage(enabled ? 'success' : 'warning', "Scheduler has been " + (enabled ? 'resumed.' : 'paused.'), 8);
				} ); // api.post
			} // callback
		}); // popupQuickMenu
	},
	
	openThemeSelector: function() {
		// show light/dark/auto theme selector
		var self = this;
		
		SingleSelect.popupQuickMenu({
			elem: '#d_theme_ctrl',
			title: 'Select Theme',
			items: [
				{ id: 'light', title: 'Light', icon: 'white-balance-sunny' }, // weather-sunny
				{ id: 'dark', title: 'Dark', icon: 'moon-waning-crescent' }, // weather-night
				{ id: 'auto', title: 'Auto', icon: 'circle-half-full' }
			],
			value: this.getPref('theme'),
			
			callback: function(value) {
				app.setTheme(value);
			} // callback
		}); // popupQuickMenu
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
		$('.sidebar .section .section_item').addClass('enabled').show();
		if (!this.hasAnyPrivilege('create_categories', 'edit_categories', 'delete_categories')) $('#tab_Categories').removeClass('enabled').hide();
		if (!this.hasAnyPrivilege('create_tags', 'edit_tags', 'delete_tags')) $('#tab_Tags').removeClass('enabled').hide();
		
		// admin section
		if (!this.hasAnyPrivilege('create_alerts', 'edit_alerts', 'delete_alerts')) $('#tab_AlertSetup').removeClass('enabled').hide();
		if (!this.hasAnyPrivilege('create_channels', 'edit_channels', 'delete_channels')) $('#tab_Channels').removeClass('enabled').hide();
		if (!this.hasAnyPrivilege('create_monitors', 'edit_monitors', 'delete_monitors')) $('#tab_Monitors').removeClass('enabled').hide();
		if (!this.hasAnyPrivilege('create_plugins', 'edit_plugins', 'delete_plugins')) $('#tab_Plugins').removeClass('enabled').hide();
		if (!this.hasAnyPrivilege('create_web_hooks', 'edit_web_hooks', 'delete_web_hooks')) $('#tab_WebHooks').removeClass('enabled').hide();
		
		if (!this.isAdmin()) {
			$('#tab_ActivityLog').removeClass('enabled').hide();
			$('#tab_APIKeys').removeClass('enabled').hide();
			$('#tab_Masters').removeClass('enabled').hide();
			$('#tab_System').removeClass('enabled').hide();
			$('#tab_Users').removeClass('enabled').hide();
			$('#tab_Roles').removeClass('enabled').hide();
		}
		
		// possibly hide entire admin section
		if ($('#d_sidebar_admin_group > .section > .section_item.enabled').length) $('#d_sidebar_admin_group').show();
		else $('#d_sidebar_admin_group').hide();
		
		// add hint to body tag for admin UI hints
		if (this.isAdmin()) $('body').addClass('admin');
		else $('body').removeClass('admin');
		
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
	
	setupDragDrop: function() {
		// setup drag n' drop file upload for import
		$(document).off('dragenter').on('dragenter', function(e) {
			$(this).addClass('dragover');
			e.preventDefault();
			e.stopPropagation();
			return false;
		})
		.off('dragover').on('dragover', function(e) {
			$(this).addClass('dragover');
			e.preventDefault();
			e.stopPropagation();
			return false;
		})
		.off('dragleave').on('dragleave', function(e) {
			$(this).removeClass('dragover');
			e.preventDefault();
			e.stopPropagation();
			return false;
		})
		.off('drop').on('drop', function(e) {
			$(this).removeClass('dragover');
			
			if (e.originalEvent.dataTransfer.files.length) {
				var files = e.originalEvent.dataTransfer.files;
				
				e.preventDefault();
				e.stopPropagation();
				
				if (app.page_manager && app.page_manager.current_page_id) {
					var page = app.page_manager.find(app.page_manager.current_page_id);
					if (page && page.onDragDrop) page.onDragDrop( files );
					else if (page && page.doPrepImportFile) page.doPrepImportFile( files[0] );
				}
				
				return false;
			}
		});
	},
	
	applyUserRoles() {
		// apply user roles to augment client priv set
		// also do the same for user categories and user groups
		// (these are only for UI hints -- they are enforced server-side)
		var privs = deep_copy_object( this.origUser.privileges || {} );
		var cats = deep_copy_object( this.origUser.categories || [] );
		var cgrps = deep_copy_object( this.origUser.groups || [] );
		
		(this.user.roles || []).forEach( function(role_id) {
			var role = find_object( app.roles, { id: role_id } );
			if (!role) return; // deleted role
			if (!role.enabled) return; // disabled role
			
			merge_hash_into( privs, role.privileges );
			cats = cats.concat( role.categories || [] );
			cgrps = cgrps.concat( role.groups || [] );
		} );
		
		this.user.privileges = privs;
		this.user.categories = [...new Set(cats)]; // remove dupes
		this.user.groups = [...new Set(cgrps)]; // remove dupes
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
		
		// keep pristine copy of user, for applying roles
		this.origUser = deep_copy_object(this.user);
		
		this.applyUserRoles();
		this.presortTables();
		this.updateHeaderInfo();
		this.setupDragDrop();
		this.pruneData();
		this.updateAccessibility();
		
		// login resp should have epoch, so track delta from it
		this.serverPerfStart = performance.now();
		
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
			$(document).off('dragenter').off('dragover').off('dragleave').off('drop');
			
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
		if (!opts.second) delete opts.second;
		
		return opts;
	},
	
	formatDate(epoch, opts) {
		// format date and/or time according to user locale settings
		opts = this.getDateOptions(opts);
		return (new Date( epoch * 1000 )).toLocaleString( opts.locale, opts );
	},
	
	formatDateRange(start, end, opts) {
		// format date range based on user locale settings
		// start and end should both be epoch seconds
		if (!opts) opts = { dateStyle: 'long', timeStyle: 'short' };
		opts = this.getDateOptions(opts);
		var formatter = new Intl.DateTimeFormat(opts.locale, opts);
		return formatter.formatRange( new Date(start * 1000), new Date(end * 1000) );
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
	
	hasAnyPrivilege(...privs) {
		// check if user has priv, show full page error if not
		if (!app.user || !app.user.privileges) return false;
		if (app.user.privileges.admin) return true;
		return !!privs.filter( (priv_id) => this.hasPrivilege(priv_id) ).length;
	},
	
	requirePrivilege: function(priv_id) {
		// check if user has priv, show error toast if not
		var priv = find_object( config.ui.privilege_list, { id: priv_id } ) || { title: priv_id };
		if (!this.hasPrivilege(priv_id)) return this.doError("Your account requires the &ldquo;" + priv.title + "&rdquo; privilege to perform this action.");
		return true;
	},
	
	includesAny: function(haystack, needles) {
		// return true if haystack contains any needles, false otherwise
		for (var idx = 0, len = needles.length; idx < len; idx++) {
			if (haystack.includes(needles[idx])) return true;
		}
		return false;
	},
	
	includesAll: function(haystack, needles) {
		// return true if haystack contains ALL needles, false otherwise
		for (var idx = 0, len = needles.length; idx < len; idx++) {
			if (!haystack.includes(needles[idx])) return false;
		}
		return true;
	},
	
	getLastDayInMonth: function(year, month) {
		// compute the last day in the month, and cache in RAM
		var cache_key = '' + year + '/' + month;
		if (cache_key in this.lastMonthDayCache) return this.lastMonthDayCache[cache_key];
		
		var last_day = new Date(year, month, 0).getDate();
		this.lastMonthDayCache[cache_key] = last_day;
		
		return last_day;
	},
	
	getLangFromBinary(bin) {
		// sniff language from binary path, e.g. `/bin/sh`
		var cmd = basename( bin.trim() ).replace(/\s+.+$/, '').replace(/\d+$/, '');
		switch (cmd) {
			case 'sh':
			case 'csh':
			case 'ksh':
			case 'tcsh':
			case 'fish':
			case 'zsh':
			case 'bash':
				cmd = 'shell';
			break;
			
			case 'node':
			case 'deno':
			case 'bun':
				cmd = 'javascript';
			break;
		}
		return hljs.listLanguages().includes(cmd) ? cmd : null;
	},
	
	detectHighlightFormat: function(text, formats) {
		// auto-detect format using hljs
		var results = null;
		if (formats && (typeof(formats) == 'string')) formats = [formats];
		
		// perform our own JSON-detection, because hljs gets it wrong
		if ((!formats || formats.includes('json')) && text.match(/^\s*\{[\S\s]+\}\s*$/)) return 'json';
		
		// check for shebang, and honor that above hljs
		if (text.match(/^\#\!(\/\S+)/)) {
			var shebang = RegExp.$1;
			var lang = this.getLangFromBinary(shebang);
			if (lang && (!formats || formats.includes(lang))) return lang;
		}
		
		// highlighted code or markup (auto-detect format)
		try { results = hljs.highlightAuto( text, formats ); }
		catch (err) {
			// fallback to monospace with no hightlight
			results = null;
		}
		
		return (results && results.language) ? results.language : null;
	},
	
	detectCodemirrorMode: function(text) {
		// detect format specifically for codemirror
		var lang = this.detectHighlightFormat( text, Object.keys(this.cmLangMap) );
		if (!lang) return null;
		
		return this.cmLangMap[lang];
	},
	
	getCodemirrorModeFromBinary(bin) {
		// try to guess codemirror mode from binary (e.g. `/bin/sh`)
		var cmd = this.getLangFromBinary(bin);
		if (!cmd) return null;
		
		return this.cmLangMap[cmd] || null;
	},
	
	getCodemirrorTheme: function() {
		// get appropriate theme for cm, based on orchestra theme
		return this.cmThemeMap[ this.getPref('theme') ];
	},
	
	highlightAuto: function(text, formats) {
		var results = '';
		if (formats && (typeof(formats) == 'string')) formats = [formats];
		
		// perform our own JSON-detection, because hljs gets it wrong
		if (!formats && text.match(/^\s*\{[\S\s]+\}\s*$/)) formats = ['json'];
		
		// highlighted code or markup (auto-detect format)
		try { results = hljs.highlightAuto( text, formats ); }
		catch (err) {
			// fallback to monospace with no hightlight
			results = { value: encode_entities(text) };
		}
		
		return results.value;
	},
	
	setupNotifications() {
		// setup system-level notifications, if the user has requested it
		if (!this.user.notifications) return; // nope
		if (!("Notification" in window)) return; // nope
		if (!this.secure) return; // nope
		
		if (Notification.permission === "granted") {
			Debug.trace("Notification permissions already granted");
		}
		else if (Notification.permission !== "denied") {
			Debug.trace("Asking user for notification permissions...");
			
			Notification.requestPermission().then(permission => {
				if (permission === "granted") Debug.trace("User granted notification permissions.");
				else app.showMessage('warning', "Notification permissions have been denied.");
			});
		}
		else {
			app.showMessage('warning', "Notification permissions have been denied.");
		}
	},
	
	showChannelMessage(args) {
		// show special message for channel
		// { channel, message, lifetime, loc, sound }
		var channel = find_object( app.channels, { id: args.channel } ) || { icon: 'bullhorn-outline', title: '(Unknown Channel)' };
		var html = '<b>' + channel.title + '</b><br>' + args.message;
		
		Debug.trace("Displaying channel message", args);
		
		this.toast({
			type: 'channel', 
			icon: channel.icon || 'bullhorn-outline', 
			msg: html,
			lifetime: 10, 
			loc: args.loc || '' 
		});
		
		if (args.sound) this.playSound(args.sound);
		
		// optional system-level notification
		if (this.user.notifications && (Notification.permission === "granted")) {
			var note = new Notification( "Orchestra: " + channel.title, {
				body: args.message.replace(/<.+?>/g, ''),
				icon: '/images/logo-256.png',
				tag: 'orchestra-channel',
				renotify: true,
				requireInteraction: true
			} );
			
			if (args.loc) note.onclick = function(event) {
				Nav.go( args.loc );
			};
		}
	},
	
	initAudio() {
		// workaround for browser security and playing audio (sigh)
		var silence = new Audio('silence.mp3');
		var allowed = false;
		
		var unlockAudioContext = function() {
			if (allowed) return;
			var pstart = performance.now();
			
			silence.play().then(() => {
				allowed = true;
				var elapsed = Math.floor( performance.now() - pstart );
				Debug.trace(`Audio context unlocked (${elapsed} ms)`);
			}).catch(console.error);
		};
		
		['mousedown', 'keydown', 'keyup', 'touchstart'].forEach(eventType => {
			document.addEventListener(eventType, unlockAudioContext, { once: true });
		});
	},
	
	playSound(name, preview) {
		// play sound, load if needed
		if (!app.user.volume && !preview) return;
		var track = this.tracks[name];
		var volume = (preview || app.user.volume || 0) / 10;
		
		if (track) {
			// track already loaded, replay
			Debug.trace("Replaying loaded sound: " + name);
			track.volume = volume;
			if (!track.paused) track.currentTime = 0;
			else track.play();
		}
		else {
			// new track, load and play
			Debug.trace("Loading and playing sound: " + name);
			track = new Audio();
			
			track.autoplay = true;
			track.loop = false;
			track.preload = 'auto';
			track.volume = volume;
			track.muted = false;
			track.onerror = function(err) { console.error("Failed to load sound: " + name, err); };
			track.src = 'sounds/' + name;
			
			this.tracks[name] = track;
		}
	},
	
	getApproxServerTime() {
		// get approximate server time based on last tick epoch + cient-side performance counter
		if (!this.epoch) return hires_time_now(); // fallback to client-side time
		if (!this.serverPerfStart) return app.epoch; // 2nd fallback to last server tick
		return this.epoch + ((performance.now() - this.serverPerfStart) / 1000);
	},
	
	initAccessibility() {
		// initialize accessibility subsystem
		var rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		this.sysReducedMotion = rmQuery.matches;
		
		rmQuery.addEventListener('change', function(event) {
			app.sysReducedMotion = event.matches;
			app.updateAccessibility();
		});
	},
	
	updateAccessibility() {
		// update accessibility settings, after user login, user settings change or CSS event
		if (this.reducedMotion()) $('body').addClass('reduced'); else $('body').removeClass('reduced');
	},
	
	reducedMotion() {
		// return true if user prefers reduced motion, false otherwise
		if (this.user.motion == 'full') return false;
		else if (this.user.motion == 'reduced') return true;
		else return this.sysReducedMotion;
	}
	
}); // app
