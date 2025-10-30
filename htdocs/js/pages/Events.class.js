// Scheduler -- Events Config

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Events = class Events extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'ee';
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		if (!args.sub && args.id) args.sub = 'view';
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show event list
		var self = this;
		
		if (args.plugin == '_workflow') {
			app.setWindowTitle( "Workflows" );
			app.setHeaderTitle( '<i class="mdi mdi-clipboard-flow-outline">&nbsp;</i>Workflows' );
			app.highlightTab( 'Workflows' );
		}
		else {
			app.setWindowTitle( "Events" );
			app.setHeaderTitle( '<i class="mdi mdi-calendar-clock">&nbsp;</i>Events' );
			app.highlightTab( 'Events' );
		}
		
		var event_plugins = app.plugins.filter( function(plugin) { return plugin.type == 'event'; } );
		var scheduler_plugins = app.plugins.filter( function(plugin) { return plugin.type == 'scheduler'; } );
		var action_plugins = app.plugins.filter( function(plugin) { return plugin.type == 'action'; } );
		
		var target_items = [].concat(
			this.buildOptGroup(app.groups, "Groups:", 'server-network'),
			this.buildServerOptGroup("Servers:", 'router-network')
		);
		
		var html = '';
		html += '<div class="box" style="border:none;">';
		html += '<div class="box_content" style="padding:20px;">';
			
			// search box
			html += '<div class="search_box">';
				html += '<i class="mdi mdi-magnify" onClick="$(\'#fe_el_search\').focus()">&nbsp;</i>'; // TODO: fix search help url below:
				html += '<div class="search_help"><a href="https://github.com/pixlcore/xyops#search" target="_blank">Search Help<i class="mdi mdi-open-in-new"></i></a></div>';
				html += '<input type="text" id="fe_el_search" maxlength="128" placeholder="Search Keywords..." value="' + escape_text_field_value(args.search || '') + '">';
			html += '</div>';
			
			// options
			html += '<div class="form_grid four" style="margin-bottom:25px">';
				
				// status
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-check-circle-outline">&nbsp;</i>Status:',
						content: this.getFormMenuSingle({
							id: 'fe_el_status',
							title: 'Select Status',
							options: [
								['', 'Any Status'], 
								{ id: 'enabled', title: 'Only Enabled', icon: 'checkbox-marked-outline' },
								{ id: 'disabled', title: 'Only Disabled', icon: 'checkbox-blank-outline' }
							],
							value: args.status || '',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// category
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-folder-open-outline">&nbsp;</i>Category:',
						content: this.getFormMenuSingle({
							id: 'fe_el_category',
							title: 'Select Category',
							options: [['', 'Any Category']].concat( app.categories ),
							value: args.category || '',
							default_icon: 'folder-open-outline',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// target
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-lan">&nbsp;</i>Target:',
						content: this.getFormMenuSingle({
							id: 'fe_el_target',
							title: 'Select Target',
							options: [['', 'Any Target']].concat( target_items ),
							value: args.target || '',
							default_icon: 'server-network',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// plugin
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-power-plug">&nbsp;</i>Plugin:',
						content: this.getFormMenuSingle({
							id: 'fe_el_plugin',
							title: 'Select Plugin',
							options: [['', 'Any Plugin']].concat( event_plugins ).concat([ 
								{ id: "_workflow", title: "Workflow", icon: "clipboard-flow-outline", group: "Special" }
							]),
							value: args.plugin || '',
							default_icon: 'power-plug-outline',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// tag
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-tag-multiple-outline">&nbsp;</i>Tag:',
						content: this.getFormMenuSingle({
							id: 'fe_el_tag',
							title: 'Select Tag',
							options: [['', 'Any Tag']].concat( app.tags ),
							value: args.tag || '',
							default_icon: 'tag-outline',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// trigger
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-rocket-launch-outline">&nbsp;</i>Trigger:',
						content: this.getFormMenuSingle({
							id: 'fe_el_trigger',
							title: 'Select Trigger',
							options: [
								['', 'Any Trigger'], 
								{ id: 'manual', title: 'Manual', icon: 'run-fast' },
								{ id: 'schedule', title: 'Schedule', icon: 'update' },
								{ id: 'single', title: "Single Shot", icon: 'alarm-check' },
								{ id: 'interval', title: "Interval", icon: 'timer-sand' },
								// { id: 'continuous', title: "Continuous", icon: 'all-inclusive' },
								{ id: 'catchup', title: "Catch-Up", icon: 'calendar-refresh-outline' },
								{ id: 'range', title: "Range", icon: 'calendar-range-outline' },
								{ id: 'blackout', title: "Blackout", icon: 'circle' },
								{ id: 'delay', title: "Delay", icon: 'chat-sleep-outline' },
								{ id: 'precision', title: "Precision", icon: 'progress-clock' },
								{ id: 'plugin', title: "Plugin", icon: 'power-plug' }
							].concat(
								this.buildOptGroup( scheduler_plugins, "Trigger Plugins:", 'power-plug-outline', 'p_' )
							),
							value: args.trigger || '',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// action
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-gesture-tap">&nbsp;</i>Action:',
						content: this.getFormMenuSingle({
							id: 'fe_el_action',
							title: 'Select Action',
							options: [ ['', 'Any Action'] ].concat( config.ui.action_type_menu ).concat(
								this.buildOptGroup( action_plugins, "Action Plugins:", 'power-plug-outline', 'p_' )
							),
							value: args.action || '',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// user
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-account">&nbsp;</i>User:',
						content: this.getFormMenuSingle({
							id: 'fe_el_username',
							title: 'Select User',
							options: [['', 'Any User']].concat( app.users.map( function(user) {
								return { id: user.username, title: user.full_name, icon: user.icon || '' };
							} ) ),
							value: args.username || '',
							default_icon: 'account',
							'data-shrinkwrap': 1,
							'data-private': 1
						})
					});
				html += '</div>';
				
			html += '</div>'; // form_grid
		
		// buttons at bottom
		html += '<div class="search_buttons" style="padding:0">';
			html += '<div id="btn_search_opts" class="button" onClick="$P().toggleSearchOpts()"><i>&nbsp;</i><span>Options<span></div>';
			html += '<div id="btn_el_reset" class="button" style="display:none" onClick="$P().resetFilters()"><i class="mdi mdi-undo-variant">&nbsp;</i><span>Reset</span></div>';
			html += '<div class="button primary" onClick="$P().applyTableFilters(true)"><i class="mdi mdi-magnify">&nbsp;</i><span>Search</span></div>';
		html += '</div>'; // search_buttons
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		html += '<div id="d_search_results"></div>';
		
		this.div.html( html );
		
		// MultiSelect.init( this.div.find('#fe_el_tags') );
		SingleSelect.init( this.div.find('#fe_el_status, #fe_el_category, #fe_el_target, #fe_el_plugin, #fe_el_tag, #fe_el_trigger, #fe_el_username, #fe_el_action') );
		// $('.header_search_widget').hide();
		this.setupSearchOpts();
		
		this.div.find('#fe_el_tag, #fe_el_status, #fe_el_category, #fe_el_target, #fe_el_plugin, #fe_el_trigger, #fe_el_username, #fe_el_action').on('change', function() {
			self.applyTableFilters(true);
		});
		
		$('#fe_el_search').on('keydown', function(event) {
			// capture enter key
			if (event.keyCode == 13) {
				event.preventDefault();
				self.applyTableFilters(true);
			}
		});
		
		// reset max events (dynamic pagination)
		this.eventsPerPage = config.events_per_page;
		
		var events = app.events;
		
		// use events in app cache
		this.receive_events({
			code: 0,
			rows: events,
			list: { length: events.length }
		});
	}
	
	receive_events(resp) {
		// receive all events from server, render them sorted
		var self = this;
		var args = this.args;
		var html = '';
		var hidden_cats = app.prefs.hidden_cats || {};
		
		// sort events based on category sort order, then alphabetically
		var cat_map = obj_array_to_hash( app.categories, 'id' );
		var last_cat_id = '';
		if (!resp.rows) resp.rows = [];
		
		this.events = deep_copy_object(resp.rows).sort( function(a, b) {
			if (a.category == b.category) {
				return a.title.toLowerCase().localeCompare( b.title.toLowerCase() );
			}
			else {
				var cat_a = cat_map[ a.category ] || { sort_order: 99999 };
				var cat_b = cat_map[ b.category ] || { sort_order: 99999 };
				return (cat_a.sort_order < cat_b.sort_order) ? -1 : 1;
			}
		} );
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Event Title', 'Category', 'Plugin', 'Target', 'Trigger', 'Status', 'Actions'];
		
		html += '<div class="box" id="d_el_results">';
		html += '<div class="box_title">';
			html += 'Event List';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var grid_opts = {
			rows: this.events,
			cols: cols,
			data_type: 'event',
			grid_template_columns: '40px' + ' auto'.repeat( cols.length - 1 ),
			below: '<ul class="grid_row_empty" id="ul_el_none_found" style="display:none"><div style="grid-column-start: span ' + cols.length + ';">No events found matching your filters.</div></ul>'
		};
		
		html += this.getBasicGrid( grid_opts, function(item, idx) {
			var classes = [];
			var action_html = '';
			var cat = cat_map[ item.category ] || { title: item.category };
			
			// action_html += '<div class="table_menu_container">';
			// 	action_html += '<select onChange="$P().do_event_action(' + idx + ')">';
			// 		action_html += '<option disabled selected value="">Select Action</option>';
			// 		action_html += '<option value="run">Run Event</option>';
			// 		action_html += '<option value="edit">Edit Event...</option>';
			// 		action_html += '<option value="stats">Event Stats...</option>';
			// 		action_html += '<option value="history">Event History...</option>';
			// 		action_html += '<option value="delete">Delete Event...</option>';
			// 	action_html += '</select>';
			// 	action_html += '<i class="mdi mdi-dots-horizontal">&nbsp;</i>';
			// action_html += '</div>';
			
			var actions = [];
			actions.push( '<span class="link" onClick="$P().do_run_event_from_list('+idx+')"><b>Run Now</b></span>' );
			// actions.push( '<span class="link" onClick="$P().edit_event('+idx+')"><b>Edit</b></span>' );
			// actions.push( '<span class="link" onClick="$P().go_event_stats('+idx+')"><b>Stats</b></span>' );
			// actions.push( '<span class="link" onClick="$P().go_event_history('+idx+')"><b>History</b></span>' );
			// // actions.push( '<span class="link" onClick="$P().delete_event('+idx+')"><b>Delete</b></span>' );
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggle_event_enabled(this,' + idx + ')'
				}) + '</div>',
				'<span style="font-weight:bold">' + self.getNiceEvent(item, true) + '</span>',
				self.getNiceCategory(item.category, true),
				(item.plugin == '_workflow') ? '(Workflow)' : self.getNicePlugin(item.plugin, true),
				self.getNiceTargetList(item.targets, true),
				summarize_event_timings(item),
				
				'<div id="d_el_jt_status_' + item.id + '">' + self.getNiceEventStatus(item) + '</div>',
				
				// self.getNiceUser(item.username, true),
				// '<span title="'+self.getNiceDateTimeText(item.created)+'">'+self.getNiceDate(item.created)+'</span>',
				// action_html
				actions.join(' | ')
			];
			
			// if (item.category != last_cat_id) {
			// 	var is_hidden = !!(item.category in hidden_cats);
			// 	tds.insertAbove = '<ul class="tr_event_category' + (is_hidden ? ' collapsed' : '') + '" id="tr_ee_cat_' + item.category + '" data-cat="' + item.category + '"><div style="grid-column-start: span ' + cols.length + ';" onClick="$P().toggle_category_collapse(this)"><i class="mdi mdi-' + (is_hidden ? 'folder-outline' : 'folder-open-outline') + '">&nbsp;</i>' + cat.title + '</div></ul>';
			// 	last_cat_id = item.category;
			// }
			
			if (!item.enabled) classes.push('disabled');
			if (cat.color) classes.push( 'clr_' + cat.color );
			if (classes.length) tds.className = classes.join(' ');
			return tds;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button tablet_collapse" onClick="$P().doFileImportPrompt()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i><span>Import File...</span></div>';
			html += '<div class="button tablet_collapse secondary" onClick="$P().go_history()"><i class="mdi mdi-history">&nbsp;</i><span>Revision History...</span></div>';
			html += '<div class="button phone_collapse default" onClick="$P().go_new_workflow()"><i class="mdi mdi-clipboard-plus-outline">&nbsp;</i><span>New Workflow...</span></div>';
			html += '<div class="button phone_collapse default" onClick="$P().edit_event(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i><span>New Event...</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		var is_floater_vis = !!this.div.find('.box_buttons.floater').length;
		
		this.div.find('#d_search_results').html( html );
		this.applyTableFilters();
		this.setupBoxButtonFloater(is_floater_vis);
		
		// SingleSelect.init( this.div.find('#fe_ee_filter') );
		// MultiSelect.init( this.div.find('#fe_ee_filter') );
	}
	
	go_new_workflow() {
		// nav to new workflow page
		Nav.go( '#Workflows?sub=new' );
	}
	
	handleStatusUpdateList(data) {
		// received status update from server
		var self = this;
		
		// only redraw status fields if jobs changed
		if (!data.jobsChanged) return;
		
		this.events.forEach( function(item, idx) {
			self.div.find('#d_el_jt_status_' + item.id).html( self.getNiceEventStatus(item) );
		} );
	}
	
	getNiceJobResultLink(job) {
		// color label + icon for job result
		var args = this.getJobResultArgs(job);
		var url = '#Job?id=' + job.id;
		return '<span class="color_label ' + args.color + ' nowrap linky" onClick="Nav.go(\'' + url + '\')"><i class="mdi mdi-' + args.icon + '"></i>' + args.text + '</span>';
	}
	
	getNiceEventStatus(event) {
		// get pretty event status (active jobs or last result)
		var num_jobs = 0;
		var last_job_id = '';
		for (var job_id in app.activeJobs) {
			var job = app.activeJobs[job_id];
			if (job.event == event.id) { num_jobs++; last_job_id = job.id; }
		}
		var nice_status = 'Idle';
		var event_state = get_path( app.state, 'events/' + event.id );
		
		if (num_jobs) {
			var url = (num_jobs > 1) ? ('#Events?sub=view&id=' + event.id) : ('#Job?id=' + last_job_id);
			nice_status = '<span class="color_label blue nowrap linky" onClick="Nav.go(\'' + url + '\')"><i class="mdi mdi-autorenew mdi-spin"></i>' + num_jobs + ' Active</span>';
		}
		else if (!num_jobs && event_state && event_state.last_job) {
			nice_status = this.getNiceJobResultLink({ id: event_state.last_job, code: event_state.last_code, final: true });
		}
		
		return nice_status;
	}
	
	applyTableFilters(reset_max) {
		// filters and/or search query changed -- re-filter table
		var self = this;
		var args = this.args;
		var num_visible = 0, num_hidden = 0, num_paged = 0, num_filters = 0;
		
		// optionally reset the event max (dynamic paging)
		if (reset_max) this.eventsPerPage = config.events_per_page;
		
		// single-selects
		['search', 'status', 'category', 'target', 'plugin', 'tag', 'trigger', 'username', 'action'].forEach( function(key) {
			var value = $('#fe_el_' + key).val();
			if (value.length) { args[key] = value; num_filters++; }
			else delete args[key];
		} );
		
		var is_filtered = (num_filters > 0);
		
		this.div.find('#d_search_results .box_content.table ul.grid_row').each( function(idx) {
			var $this = $(this);
			var row = self.events[idx];
			if (self.isRowVisible(row)) {
				if (num_visible < self.eventsPerPage) { $this.show(); num_visible++; }
				else { $this.hide(); num_paged++; }
			}
			else { $this.hide(); num_hidden++; }
		} );
		
		// if any events were paged out, set a flag for onScrollDelay to sniff
		this.moreEventsAvail = !!(num_paged > 0);
		
		// if any search/filter is applied, hide all category rows
		if (is_filtered) this.div.find('ul.tr_event_category').hide();
		else this.div.find('ul.tr_event_category').show();
		
		// if ALL items are hidden due to search/filter, show some kind of message
		if (!num_visible && is_filtered && this.events.length) this.div.find('#ul_el_none_found').show();
		else this.div.find('#ul_el_none_found').hide();
		
		this.updateBoxButtonFloaterState();
		
		// update pagination row count
		var total_non_hidden = num_visible + num_paged;
		var total_items = total_non_hidden + num_hidden;
		var nice_total = "";
		if (is_filtered && num_hidden) nice_total = "" + commify(total_non_hidden) + " of " + commify(total_items) + " events";
		else nice_total = "" + commify(total_items) + " " + pluralize("event", total_items);
		this.div.find('#d_search_results .box_content.table .data_grid_pagination > div').first().html( nice_total );
		
		// show or hide reset button
		if (is_filtered) this.div.find('#btn_el_reset').show();
		else this.div.find('#btn_el_reset').hide();
		
		// do history.replaceState jazz here
		// don't mess up initial visit href
		var query = deep_copy_object(args);
		delete query.sub;
		
		var url = '#Events' + (num_keys(query) ? compose_query_string(query) : '');
		history.pushState( null, '', url );
		Nav.loc = url.replace(/^\#/, '');
		// Nav.go(url);
		
		// magic trick: replace link in sidebar for Events
		// $('#tab_Events').attr( 'href', url );
	}
	
	resetFilters() {
		// reset all filters to default and re-search
		Nav.go( this.selfNav({}) );
	}
	
	handleScrollList() {
		// user scrolled on list view -- see if we need to load more events
		var self = this;
		if (!this.boxButtons || !this.boxFloater) return;
		
		var box = this.boxButtons[0].getBoundingClientRect();
		var isVisible = this.isRectVisible(box);
		
		if (isVisible && this.moreEventsAvail) {
			Debug.trace("Loading " + config.events_per_page + " more events");
			this.eventsPerPage += config.events_per_page;
			this.applyTableFilters();
		}
	}
	
	isRowVisible(item) {
		// check if row should be filtered using args
		var args = this.args;
		var num_filters = 0;
		
		['search', 'status', 'category', 'target', 'plugin', 'trigger', 'username', 'action', 'tag'].forEach( function(key) {
			if (key in args) num_filters++;
		} );
		
		var is_filtered = (num_filters > 0);
		
		if (!is_filtered) {
			// no filters, so we can apply user collapse/expand logic here
			var hidden_cats = app.prefs.hidden_cats || {};
			if (hidden_cats[ item.category ]) return false; // hide (by user)
			return true; // show
		}
		
		// allow keywords to search titles, usernames, notes, targets, and trigger plugins
		if (('search' in args) && args.search.length) {
			var words = [item.title, item.username, item.notes].concat(item.targets);
			if (words.join(' ').toLowerCase().indexOf(args.search.toLowerCase()) == -1) return false; // hide
		}
		
		// status
		if ('status' in args) {
			if ((args.status == 'enabled') && !item.enabled) return false; // hide
			if ((args.status == 'disabled') && item.enabled) return false; // hide
		}
		
		// category
		if ('category' in args) {
			if (item.category != args.category) return false; // hide
		}
		
		// target
		if ('target' in args) {
			if (!item.targets.includes(args.target)) return false; // hide
		}
		
		// plugin
		if ('plugin' in args) {
			if (item.plugin != args.plugin) return false; // hide
		}
		
		// tags
		if ('tag' in args) {
			if (!item.tags || !item.tags.includes(args.tag)) return false; // hide
		}
		
		// username
		if ('username' in args) {
			if (item.username != args.username) return false; // hide
		}
		
		// trigger
		if ('trigger' in args) {
			// types: manual, schedule, interval, continuous, single, plugin, catchup, range, blackout, delay, precision
			var types = {};
			(item.triggers || []).filter( function(trigger) { return trigger.enabled; } ).forEach( function(trigger) { 
				types[trigger.type || 'N/A'] = 1; 
				if (trigger.type == 'plugin') types[ 'p_' + trigger.plugin_id ] = 1;
			} );
			if (!types[args.trigger]) return false; // hide
		}
		
		// action
		if ('action' in args) {
			var types = {};
			(item.actions || []).filter( function(action) { return action.enabled; } ).forEach( function(action) { 
				types[action.type || 'N/A'] = 1; 
				if (action.type == 'plugin') types[ 'p_' + action.plugin_id ] = 1;
			} );
			if (!types[args.action]) return false; // hide
		}
		
		return true; // show
	}
	
	toggle_category_collapse(elem) {
		// toggle category open/closed
		var $ul = $(elem).parent();
		var cat_id = $ul.data('cat');
		if (!app.prefs.hidden_cats) app.prefs.hidden_cats = {};
		
		if ($ul.hasClass('collapsed')) {
			// expand
			$ul.removeClass('collapsed');
			$ul.find('i').removeClass().addClass('mdi mdi-folder-open-outline');
			delete app.prefs.hidden_cats[ cat_id ];
		}
		else {
			// collapse
			$ul.addClass('collapsed');
			$ul.find('i').removeClass().addClass('mdi mdi-folder-outline');
			app.prefs.hidden_cats[ cat_id ] = 1;
		}
		
		this.applyTableFilters();
		app.savePrefs();
	}
	
	toggle_event_enabled(elem, idx) {
		// toggle event checkbox, actually do the enable/disable here, update row
		var self = this;
		var item = this.events[idx];
		
		if (config.alt_to_toggle && !app.lastClick.altKey) {
			$(elem).prop('checked', !$(elem).is(':checked'));
			return app.showMessage('warning', "Accidental Click Protection: Please hold the Alt/Opt key to toggle this checkbox.", 8);
		}
		
		item.enabled = !!$(elem).is(':checked');
		
		app.api.post( 'app/update_event', { id: item.id, enabled: item.enabled }, function(resp) {
			if (!self.active) return; // sanity
			
			if (item.enabled) $(elem).closest('ul').removeClass('disabled');
			else $(elem).closest('ul').addClass('disabled');
			
			app.showMessage('success', item.title + " was " + (item.enabled ? 'enabled' : 'disabled') + " successfully.");
		} );
	}
	
	do_run_event_from_list(idx) {
		// run event from list
		this.doRunEvent( this.events[idx] );
	}
	
	do_run_current_event() {
		// run current event
		this.doRunEvent( this.event );
	}
	
	edit_event(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Events?sub=edit&id=' + this.events[idx].id );
		else Nav.go( '#Events?sub=new' );
	}
	
	delete_event(idx) {
		// delete event from search results
		this.event = this.events[idx];
		this.show_delete_event_dialog();
	}
	
	gosub_view(args) {
		// view event summary / stats / history
		var html = '';
		var event = this.event = find_object( app.events, { id: args.id } );
		if (!event) return this.doFullPageError("Event not found: " + args.id);
		
		this.workflow = this.event.workflow || null;
		
		var is_workflow = (event.type == 'workflow');
		var default_icon = is_workflow ? 'clipboard-flow-outline' : 'file-clock-outline';
		var icon = event.icon || default_icon;
		var edit_btn_text = is_workflow ? 'Edit Workflow...' : 'Edit Event...';
		var thing = is_workflow ? 'Workflow' : 'Event';
		
		if (is_workflow) {
			app.setHeaderNav([
				{ icon: 'clipboard-flow-outline', loc: '#Events?plugin=_workflow', title: 'Workflows' },
				{ icon: icon, title: event.title }
			]);
			app.highlightTab( 'Workflows' );
		}
		else {
			app.setHeaderNav([
				{ icon: 'calendar-clock', loc: '#Events?sub=list', title: 'Events' },
				{ icon: icon, title: event.title }
			]);
			app.highlightTab( 'Events' );
		}
		
		// app.setHeaderTitle( '<i class="mdi mdi-calendar-search">&nbsp;</i>Event Details' );
		app.setWindowTitle( `Viewing ${thing} "${event.title}"` );
		
		html += '<div class="box">';
			html += '<div class="box_title">';
				// html += '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + event.title;
				if (!event.enabled) html += `<span style="color:var(--red);">${thing} Disabled</span>`;
				else html += `${thing} Summary`;
				
				// html += '<div class="button right danger" onClick="$P().show_delete_event_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i>Delete...</div>';
				html += '<div class="button default right phone_collapse" onClick="$P().do_edit_from_view()"><i class="mdi mdi-file-edit-outline">&nbsp;</i><span>' + edit_btn_text + '</span></div>';
				if (event.enabled) html += '<div class="button right phone_collapse" onClick="$P().do_run_current_event()"><i class="mdi mdi-run-fast">&nbsp;</i><span>Run Now</span></div>';
				html += '<div class="clear"></div>';
			html += '</div>'; // title
			
			html += '<div class="box_content table">';
				html += '<div class="summary_grid">';
					
					// row 1
					html += '<div>';
						html += `<div class="info_label">${thing} ID</div>`;
						html += '<div class="info_value monospace">' + this.getNiceCopyableID(event.id) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += `<div class="info_label">${thing} Title</div>`;
						html += '<div class="info_value">' + this.getNiceEvent(event) + '</div>';
					html += '</div>';
				
					html += '<div>';
						html += '<div class="info_label">Category</div>';
						html += '<div class="info_value">' + this.getNiceCategory(event.category, true) + '</div>';
					html += '</div>';
				
					html += '<div>';
						html += '<div class="info_label">Tags</div>';
						html += '<div class="info_value">' + this.getNiceTagList(event.tags, true, ', ') + '</div>';
					html += '</div>';
					
					// row 2
					html += '<div>';
						html += '<div class="info_label">Author</div>';
						html += '<div class="info_value">' + this.getNiceUser(event.username, true) + '</div>';
					html += '</div>';
				
					html += '<div>';
						html += '<div class="info_label">Plugin</div>';
						html += '<div class="info_value">' + this.getNicePlugin(event.plugin, true) + '</div>';
					html += '</div>';
				
					html += '<div>';
						html += '<div class="info_label">Targets</div>';
						html += '<div class="info_value">' + this.getNiceTargetList(event.targets, true) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Algorithm</div>';
						html += '<div class="info_value">' + this.getNiceAlgo(event.algo) + '</div>';
					html += '</div>';
					
					// row 3
					html += '<div>';
						html += '<div class="info_label">Avg Elapsed</div>';
						html += '<div class="info_value" id="d_ve_avg_elapsed">...</div>';
					html += '</div>';
				
					html += '<div>';
						html += '<div class="info_label">Avg CPU</div>';
						html += '<div class="info_value" id="d_ve_avg_cpu">...</div>';
					html += '</div>';
				
					html += '<div>';
						html += '<div class="info_label">Avg Mem</div>';
						html += '<div class="info_value" id="d_ve_avg_mem">...</div>';
					html += '</div>';
				
					html += '<div>';
						html += '<div class="info_label">Avg Log Size</div>';
						html += '<div class="info_value" id="d_ve_log_size">...</div>';
					html += '</div>';
					
					// row 4
					html += '<div>';
						html += '<div class="info_label">Success Rate</div>';
						html += '<div class="info_value" id="d_ve_success_rate">...</div>';
					html += '</div>';
				
					html += '<div>';
						html += '<div class="info_label">Last Result</div>';
						html += '<div class="info_value" id="d_ve_last_result">...</div>';
					html += '</div>';
				
					html += '<div>';
						html += '<div class="info_label">Last Run</div>';
						html += '<div class="info_value" id="d_ve_last_run">...</div>';
					html += '</div>';
				
					html += '<div>';
						html += '<div class="info_label">Next Run</div>';
						html += '<div class="info_value" id="d_ve_next_run">...</div>';
					html += '</div>';
					
				html += '</div>'; // summary grid
				
				if (event.notes) {
					html += '<div class="summary_grid" style="grid-template-columns: 1fr; margin-top:30px;"><div>';
					html += `<div class="info_label">${thing} Notes</div>`;
					html += '<div class="info_value overflow" style="font-weight:normal; line-height:16px;">' + event.notes.replace(/\n/g, '<br>') + '</div>';
					html += '</div></div>';
				}
			html += '</div>'; // box content
		html += '</div>'; // box
		
		// event details
		html += '<div class="box_grid">';
			html += '<div id="d_ve_trigger_summary">' + this.getTriggerDetails() + '</div>';
			html += '<div>' + this.getActionDetails() + '</div>';
			html += '<div>' + this.getLimitDetails() + '</div>';
		html += '</div>';
		
		// workflow preview
		if (event.workflow) {
			html += '<div class="box">';
			html += '<div class="box_content">';
			html += '<div class="wf_container preview" id="d_wf_container" style="height:40vh; min-height:400px;">';
			
			html += `<div class="wf_grid_header">
				<div class="wf_title left"><i class="mdi mdi-clipboard-flow-outline">&nbsp;</i>Workflow Map</div>
				<div class="button secondary right" onClick="$P().goEditWorkflow()"><i class="mdi mdi-clipboard-edit-outline">&nbsp;</i>Edit...</div>
				<div class="clear"></div>
			</div>`;
			
			html += `<div class="wf_grid_footer">
				<div class="button icon left" onClick="$P().wfZoomAuto()" title="Auto-fit workflow"><i class="mdi mdi-home"></i></div>
				<div class="button icon left" id="d_btn_wf_zoom_out" onClick="$P().wfZoomOut()" title="Zoom out"><i class="mdi mdi-magnify-minus"></i></div>
				<div class="button icon left" id="d_btn_wf_zoom_in" onClick="$P().wfZoomIn()" title="Zoom in"><i class="mdi mdi-magnify-plus"></i></div>
				<div class="wf_zoom_msg left tablet_hide"></div>
				<div class="clear"></div>
			</div>`;
			
			html += '</div>'; // wf_container
			html += '</div>'; // box_content
			html += '</div>'; // box
		} // workflow
		
		// plugin parameters
		html += '<div class="box toggle" id="d_ve_params" style="display:none">';
			html += '<div class="box_title">';
				html += '<i></i><span></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				// html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// active jobs
		html += '<div class="box" id="d_ve_active">';
			html += '<div class="box_title">';
				html += '<span>Active Jobs</span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// queued jobs
		html += '<div class="box" id="d_ve_queued" style="display:none">';
			html += '<div class="box_title">';
				html += '<span>Queued Jobs</span>';
				html += '<div class="button right danger" onClick="$P().do_flush_queue()"><i class="mdi mdi-trash-can-outline">&nbsp;</i>Flush Queue</div>';
			html += '</div>';
			html += '<div class="box_content table">';
				// html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// history table
		html += '<div class="box" id="d_ve_history">';
			html += '<div class="box_title">';
				
				html += '<div class="box_title_widget" style="overflow:visible; min-width:120px; max-width:200px; font-size:13px;">' + this.getFormMenuSingle({
					id: 'fe_ve_filter',
					title: 'Filter job list',
					options: this.buildJobFilterOpts(),
					value: args.filter || '',
					onChange: '$P().applyHistoryFilters()',
					'data-shrinkwrap': 1
				}) + '</div>';
				
				html += '<span>Completed Jobs</span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// graphs
		html += '<div class="box" id="d_ve_graphs" style="display:none;">';
			html += '<div class="box_content">';
				
				html += '<div style="margin-bottom:20px"><canvas id="c_ve_perf" class="chart" style="width:100%; height:250px;"></canvas></div>';
				
				html += '<div class="chart_grid_horiz medium">';
					html += '<div><canvas id="c_ve_cpu" class="chart"></canvas></div>';
					html += '<div><canvas id="c_ve_mem" class="chart"></canvas></div>';
					html += '<div><canvas id="c_ve_disk" class="chart"></canvas></div>';
					html += '<div><canvas id="c_ve_net" class="chart"></canvas></div>';
				html += '</div>';
			html += '</div>';
		html += '</div>';
		
		// job day graph
		html += '<div class="box" id="d_job_day_graph" style="display:none">';
			html += '<div class="box_title">';
				html += '<span>Job History Day Graph</span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// upcoming jobs
		html += '<div class="box" id="d_upcoming_jobs">';
			html += '<div class="box_title">';
				html += 'Upcoming Jobs';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// revision history
		html += '<div class="box" id="d_ve_revisions">';
			html += '<div class="box_title">';
				html += 'Revision History';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html(html);
		
		SingleSelect.init( this.div.find('#fe_ve_filter') );
		
		this.setupHistoryCharts();
		this.fetchJobHistory();
		this.getUpcomingJobs([ this.event ]);
		this.renderActiveJobs();
		this.getQueuedJobs();
		this.renderPluginParams('#d_ve_params');
		this.setupToggleBoxes();
		this.fetchRevisionHistory();
		this.setupJobHistoryDayGraph();
		if (is_workflow) this.setupWorkflow();
	}
	
	goEditWorkflow() {
		// jump over to editing workflow (scroll it too)
		Nav.go(`#Workflows?sub=edit&id=${this.event.id}&scroll=bottom`);
	}
	
	getTriggerDetails() {
		// get trigger details in compact table (read-only)
		var self = this;
		var html = '';
		var cols = ['Type', 'Description'];
		
		html += '<div class="box_unit_title">Triggers</div>';
		
		// custom sort, and only enabled ones
		var rows = this.getSortedTriggers().filter( function(trigger) { return trigger.enabled; } );
		
		var targs = {
			rows: rows,
			cols: cols,
			data_type: 'item',
			class: 'data_grid',
			empty_msg: "(Disabled)",
			grid_template_columns: 'auto auto'
		};
		
		html += this.getCompactGrid(targs, function(item, idx) {
			var { nice_icon, nice_type, nice_desc } = self.getTriggerDisplayArgs(item);
			
			var tds = [
				'<div class="td_big nowrap">' + nice_icon + nice_type + '</div>',
				'<div class="wrap">' + nice_desc + '</div>'
			];
			
			if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getCompactGrid
		
		return html;
	}
	
	getActionDetails() {
		// get action details in compact table (read-only)
		var self = this;
		var html = '';
		var rows = this.event.actions.filter( function(action) { return action.enabled; } );
		var cols = ['Condition', 'Type', 'Description'];
		
		html += '<div class="box_unit_title">Job Actions</div>';
		
		var targs = {
			rows: rows,
			cols: cols,
			data_type: 'action',
			class: 'data_grid',
			grid_template_columns: 'auto auto auto'
		};
		
		// add inherited category actions
		var category = find_object( app.categories, { id: this.event.category } ) || {};
		(category.actions || []).forEach( function(action) {
			if (action.enabled) rows.push({ ...action, source: 'category' });
		} );
		
		// add universal actions (not hidden)
		var temp_event_type = this.workflow ? 'workflow' : 'default';
		config.job_universal_actions[temp_event_type].forEach( function(action) {
			if (action.enabled && !action.hidden) rows.push({ ...action, source: 'universal' });
		} );
		
		html += this.getCompactGrid(targs, function(item, idx) {
			var disp = self.getJobActionDisplayArgs(item);
			var disp_cond_icon = disp.condition.icon;
			if (item.source == 'category') disp_cond_icon = 'lock-outline';
			else if (item.source == 'universal') disp_cond_icon = 'lock';
			var tooltip = item.source ? `title="(Inherited from ${item.source})"` : '';
			
			var tds = [
				'<div class="td_big nowrap" ' + tooltip + '><i class="mdi mdi-' + disp_cond_icon + '"></i>' + disp.condition.title + '</div>',
				'<div class="td_big ellip" ' + tooltip + '><i class="mdi mdi-' + disp.icon + '">&nbsp;</i>' + disp.type + '</div>',
				'<div class="ellip" ' + tooltip + '>' + disp.desc + '</div>'
			];
			
			if (item.source == 'category') tds.className = 'src_cat';
			else if (item.source == 'universal') tds.className = 'src_uni';
			else if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getCompactGrid
		
		return html;
	}
	
	getLimitDetails() {
		// get resource limit details in compact table (read-only)
		var self = this;
		var html = '';
		var rows = this.event.limits.filter( function(limit) { return limit.enabled; } );
		var cols = ['Limit', 'Description'];
		
		html += '<div class="box_unit_title">Resource Limits</div>';
		
		var targs = {
			rows: rows,
			cols: cols,
			data_type: 'limit',
			class: 'data_grid',
			grid_template_columns: 'auto auto'
		};
		
		// add inherited category limits
		var category = find_object( app.categories, { id: this.event.category } ) || {};
		(category.limits || []).forEach( function(limit) {
			if (limit.enabled) rows.push({ ...limit, source: 'category' });
		} );
		
		// add universal limits (not hidden)
		var temp_event_type = this.workflow ? 'workflow' : 'default';
		config.job_universal_limits[temp_event_type].forEach( function(limit) {
			if (limit.enabled && !limit.hidden) rows.push({ ...limit, source: 'universal' });
		} );
		
		html += this.getCompactGrid(targs, function(item, idx) {
			var { nice_title, nice_desc, icon } = self.getResLimitDisplayArgs(item);
			if (item.source == 'category') icon = 'lock-outline';
			else if (item.source == 'universal') icon = 'lock';
			var tooltip = item.source ? `title="(Inherited from ${item.source})"` : '';
			
			var tds = [
				'<div class="td_big nowrap" ' + tooltip + '><i class="mdi mdi-' + icon + '"></i>' + nice_title + '</div>',
				'<div class="wrap" ' + tooltip + '>' + nice_desc + '</div>'
			];
			
			if (item.source == 'category') tds.className = 'src_cat';
			else if (item.source == 'universal') tds.className = 'src_uni';
			else if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getCompactGrid
		
		return html;
	}
	
	do_edit_from_view() {
		// jump to edit from view page
		Nav.go( (this.event.workflow ? '#Workflows' : '#Events') + '?sub=edit&id=' + this.event.id );
	}
	
	do_flush_queue() {
		// flush job queue after confirmation
		var self = this;
		var msg = 'Are you sure you want to flush the job queue for the current event?  All pending jobs will be silently deleted without triggering completion actions.';
		
		Dialog.confirmDanger( 'Flush Job Queue', msg, ['trash-can', 'Flush'], function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Flushing Queue..." );
			
			// reset pagination -- WS broadcast will trigger a table redraw
			self.queueOffset = 0;
			
			app.api.post( 'app/flush_event_queue', { id: self.event.id }, function(resp) {
				app.cacheBust = hires_time_now();
				Dialog.hideProgress();
				app.showMessage('success', "The job queue was successfully flushed.");
				if (!self.active) return; // sanity
			} ); // api.post
		} ); // confirm
	}
	
	getQueuedJobs() {
		// fetch queued jobs from server
		var self = this;
		if (!this.queueOffset) this.queueOffset = 0;
		
		var opts = {
			event: this.event.id,
			state: 'queued',
			offset: this.queueOffset,
			limit: this.args.limit
		};
		app.api.get( 'app/get_active_jobs', opts, function(resp) {
			self.receiveQueuedJobs(resp);
		});
	}
	
	receiveQueuedJobs(resp) {
		// receive queued jobs from server
		var self = this;
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		if (!resp.rows) resp.rows = [];
		this.queuedJobs = resp.rows;
		
		if (!resp.rows.length) {
			this.div.find('#d_ve_queued').hide().find('> .box_content').html('');
			return;
		}
		
		var grid_args = {
			resp: resp,
			cols: ['Job ID', 'State', 'Source', 'Target', 'Queued', 'Elapsed', 'Actions'],
			data_type: 'job',
			offset: this.queueOffset,
			limit: this.args.limit,
			class: 'data_grid job_queue_grid',
			pagination_link: '$P().jobQueueNav'
		};
		
		html += this.getPaginatedGrid( grid_args, function(job, idx) {
			return [
				'<b>' + self.getNiceJob(job, true) + '</b>',
				self.getNiceJobState(job),
				self.getNiceJobSource(job),
				self.getNiceTargetList(job.targets),
				self.getShortDateTime( job.started ),
				'<div id="d_ve_jt_elapsed_' + job.id + '">' + self.getNiceJobElapsedTime(job, true) + '</div>',
				'<span class="link danger" onClick="$P().doAbortJob(\'' + job.id + '\')"><b>Abort Job</b></a>'
			];
		} );
		
		this.div.find('#d_ve_queued').show().find('> .box_content').removeClass('loading').html( html );
	}
	
	jobQueueNav(offset) {
		// user clicked on queued job pagination nav
		this.queueOffset = offset;
		this.div.find('#d_ve_queued > .box_content').addClass('loading');
		this.getQueuedJobs();
	}
	
	renderActiveJobs() {
		// show all active jobs for event
		var self = this;
		var html = '';
		
		var rows = Object.values(app.activeJobs).filter( function(job) { 
			return (job.event == self.event.id) && (job.type != 'adhoc')
		} ).sort( function(a, b) {
			return (a.started < b.started) ? 1 : -1;
		} );
		
		if (!this.activeOffset) this.activeOffset = 0;
		
		var resp = {
			rows: rows.slice( this.activeOffset, this.activeOffset + this.args.limit ),
			list: { length: rows.length }
		};
		
		var grid_args = {
			resp: resp,
			cols: ['Job ID', 'Server', 'State', 'Elapsed', 'Progress', 'Remaining', 'Actions'],
			data_type: 'job',
			offset: this.activeOffset,
			limit: this.args.limit,
			class: 'data_grid ve_active_grid',
			pagination_link: '$P().jobActiveNav',
			empty_msg: 'No active jobs found.'
		};
		
		html += this.getPaginatedGrid( grid_args, function(job, idx) {
			return [
				'<b>' + self.getNiceJob(job, true) + '</b>',
				// self.getNiceJobSource(job),
				// self.getShortDateTime( job.started ),
				'<div id="d_ve_jt_server_' + job.id + '">' + self.getNiceServer(job.server, true) + '</div>',
				'<div id="d_ve_jt_state_' + job.id + '">' + self.getNiceJobState(job) + '</div>',
				'<div id="d_ve_jt_elapsed_' + job.id + '">' + self.getNiceJobElapsedTime(job, false) + '</div>',
				'<div id="d_ve_jt_progress_' + job.id + '">' + self.getNiceJobProgressBar(job) + '</div>',
				'<div id="d_ve_jt_remaining_' + job.id + '">' + self.getNiceJobRemainingTime(job, false) + '</div>',
				
				'<span class="link danger" onClick="$P().doAbortJob(\'' + job.id + '\')"><b>Abort Job</b></a>'
			];
		} );
		
		this.div.find('#d_ve_active > .box_content').removeClass('loading').html(html);
	}
	
	doAbortJob(id) {
		// abort job, clicked from active or queued tables
		Dialog.confirmDanger( 'Abort Job', "Are you sure you want to abort the job &ldquo;<b>" + id + "</b>&rdquo;?", ['alert-decagram', 'Abort'], function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Aborting Job..." );
			
			app.api.post( 'app/abort_job', { id: id }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', config.ui.messages.job_aborted);
			} ); // api.post
		} ); // confirm
	}
	
	handleStatusUpdateView(data) {
		// received status update from server, see if major or minor
		var self = this;
		var div = this.div;
		
		if (data.jobsChanged) {
			this.renderActiveJobs();
			this.getQueuedJobs();
			this.fetchJobHistory();
			
			// recompute upcoming: shift() entries off if they happened
			this.autoExpireUpcomingJobs();
			this.renderUpcomingJobs();
		}
		else {
			// fast update without redrawing entire table
			var jobs = Object.values(app.activeJobs).filter( function(job) { return job.event == self.event.id } );
			
			// FUTURE: ideally sort this, then crop based on offset / limit, so we aren't bashing the DOM for off-page jobs
			
			jobs.forEach( function(job) {
				div.find('#d_ve_jt_state_' + job.id).html( self.getNiceJobState(job) );
				div.find('#d_ve_jt_server_' + job.id).html( self.getNiceServer(job.server, true) );
				div.find('#d_ve_jt_elapsed_' + job.id).html( self.getNiceJobElapsedTime(job, false) );
				div.find('#d_ve_jt_remaining_' + job.id).html( self.getNiceJobRemainingTime(job, false) );
				
				// update progress bar without redrawing it (so animation doesn't jitter)
				self.updateJobProgressBar(job, '#d_ve_jt_progress_' + job.id + ' > div.progress_bar_container');
			} ); // foreach job
			
			// update queued job elapsed times too
			(this.queuedJobs || []).forEach( function(job) {
				div.find('#d_ve_jt_elapsed_' + job.id).html( self.getNiceJobElapsedTime(job, true) );
			} );
		}
	}
	
	jobActiveNav(offset) {
		// user clicked on active job pagination nav
		this.activeOffset = offset;
		this.div.find('#d_ve_active > .box_content').addClass('loading');
		this.renderActiveJobs();
	}
	
	applyHistoryFilters() {
		// menu change for job history filter popdown
		this.args.filter = this.div.find('#fe_ve_filter').val();
		this.div.find('#d_ve_history > .box_content').html( '<div class="loading_container"><div class="loading"></div></div>' );
		this.fetchJobHistory();
	}
	
	fetchJobHistory() {
		// fetch job history from server
		var args = this.args;
		
		// { query, offset, limit, sort_by, sort_dir }
		args.query = 'event:' + this.event.id;
		args.limit = config.alt_items_per_page || 25;
		
		// apply filters if any
		if (args.filter) {
			switch (args.filter) {
				case 'z_success': args.query += ' tags:_success'; break;
				case 'z_error': args.query += ' tags:_error'; break;
				case 'z_warning': args.query += ' code:warning'; break;
				case 'z_critical': args.query += ' code:critical'; break;
				case 'z_abort': args.query += ' code:abort'; break;
				
				case 'z_retried': args.query += ' tags:_retried'; break;
				case 'z_last': args.query += ' tags:_last'; break;
				case 'z_test': args.query += ' tags:_test'; break;
				
				default:
					if (args.filter.match(/^t_(.+)$/)) args.query += ' tags:' + RegExp.$1;
				break;
			}
		}
		
		app.api.get( 'app/search_jobs', args, this.receiveJobHistory.bind(this) );
	}
	
	receiveJobHistory(resp) {
		// receive history from db
		var self = this;
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		if (!resp.rows) resp.rows = [];
		this.jobs = resp.rows;
		
		var grid_args = {
			resp: resp,
			cols: ['Job ID', 'Server', 'Source', 'Started', 'Elapsed', 'Avg CPU/Mem', 'Result'],
			data_type: 'job',
			offset: this.args.offset || 0,
			limit: this.args.limit,
			class: 'data_grid job_history_grid',
			pagination_link: '$P().jobHistoryNav'
		};
		
		html += this.getPaginatedGrid( grid_args, function(job, idx) {
			return [
				'<b>' + self.getNiceJob(job, true) + '</b>',
				self.getNiceServer(job.server, true),
				self.getNiceJobSource(job),
				self.getRelativeDateTime( job.started, true ),
				self.getNiceJobElapsedTime(job, true),
				self.getNiceJobAvgCPU(job) + ' / ' + self.getNiceJobAvgMem(job),
				self.getNiceJobResult(job),
				// '<a href="#Job?id=' + job.id + '">Details</a>'
			];
		} );
		
		this.div.find('#d_ve_history > .box_content').removeClass('loading').html( html );
		
		// populate dynamic summary info values
		if (resp.rows.length) {
			var totals = {
				elapsed: 0,
				cpu: 0,
				mem: 0,
				log_size: 0,
				passes: 0
			};
			resp.rows.forEach( function(job) {
				totals.elapsed += job.elapsed || 0;
				
				var cpu_avg = 0;
				if (!job.cpu) job.cpu = {};
				if (job.cpu.total && job.cpu.count) {
					cpu_avg = Math.round( job.cpu.total / job.cpu.count );
				}
				totals.cpu += cpu_avg || 0;
				
				var mem_avg = 0;
				if (!job.mem) job.mem = {};
				if (job.mem.total && job.mem.count) {
					mem_avg = Math.round( job.mem.total / job.mem.count );
				}
				totals.mem += mem_avg || 0;
				
				totals.log_size += job.log_file_size || 0;
				if (!job.code) totals.passes++;
			} );
			
			var pct_icon = 'circle-outline';
			var pct_slice = Math.floor( (totals.passes / (resp.rows.length || 1)) * 8 );
			if (pct_slice) pct_icon = 'circle-slice-' + pct_slice;
			
			this.div.find('#d_ve_avg_elapsed').html( '<i class="mdi mdi-clock-outline">&nbsp;</i>' + get_text_from_seconds( Math.round(totals.elapsed / resp.rows.length), true, false ) );
			this.div.find('#d_ve_avg_cpu').html( '<i class="mdi mdi-chip">&nbsp;</i>' + Math.round(totals.cpu / resp.rows.length) + '%' );
			this.div.find('#d_ve_avg_mem').html( '<i class="mdi mdi-memory">&nbsp;</i>' + get_text_from_bytes( Math.round(totals.mem / resp.rows.length) ) );
			this.div.find('#d_ve_log_size').html( '<i class="mdi mdi-floppy">&nbsp;</i>' + get_text_from_bytes( Math.round(totals.log_size / resp.rows.length) ) );
			this.div.find('#d_ve_success_rate').html( '<i class="mdi mdi-' + pct_icon + '">&nbsp;</i>' + pct(totals.passes, resp.rows.length, true) );
			
			if (!this.args.offset) {
				var job = resp.rows[0];
				var result = this.getJobResultArgs(job);
				this.div.find('#d_ve_last_result').html( '<i class="mdi mdi-' + result.ocon + '">&nbsp;</i>' + result.text );
				this.div.find('#d_ve_last_run').html( this.getRelativeDateTime( job.started ) );
			}
		}
		else {
			this.div.find('#d_ve_avg_elapsed, #d_ve_avg_cpu, #d_ve_avg_mem, #d_ve_log_size, #d_ve_success_rate, #d_ve_last_result, #d_ve_last_run').html( 'n/a' );
		}
		
		// populate graphs (which follow the current history table pagination)
		this.populateHistoryCharts();
	}
	
	setupHistoryCharts() {
		// one time setup for all 5 charts
		this.charts = {};
		
		this.charts.perf = this.createChart({
			"canvas": '#c_ve_perf',
			"title": "Performance History",
			"dataType": "seconds",
			// "dataSuffix": " sec"
			"_allow_zoom": true
		});
		
		this.charts.cpu = this.createChart({
			"canvas": '#c_ve_cpu',
			"title": "CPU History",
			"dataType": "integer",
			"dataSuffix": "%",
			"_allow_zoom": true
		});
		
		this.charts.mem = this.createChart({
			"canvas": '#c_ve_mem',
			"title": "Memory History",
			"dataType": "bytes",
			"dataSuffix": "",
			"_allow_zoom": true
		});
		
		this.charts.disk = this.createChart({
			"canvas": '#c_ve_disk',
			"title": "I/O History",
			"dataType": "bytes",
			"dataSuffix": "/sec",
			"_allow_zoom": true
		});
		
		this.charts.net = this.createChart({
			"canvas": '#c_ve_net',
			"title": "Network History",
			"dataType": "bytes",
			"dataSuffix": "/sec",
			"_allow_zoom": true
		});
		
		this.setupChartHover('perf');
		this.setupChartHover('cpu');
		this.setupChartHover('mem');
		this.setupChartHover('disk');
		this.setupChartHover('net');
	}
	
	populateHistoryCharts() {
		// setup or update charts
		if (this.jobs.length < 2) {
			// not enough data, just hide entire div
			this.div.find('#d_ve_graphs').hide();
			return;
		}
		
		var perf_keys = {};
		var perf_data = [];
		var perf_times = [];
		
		var cpu_data = [];
		var mem_data = [];
		var disk_data = [];
		var net_data = [];
		
		// build perf data for chart
		// read backwards as server data is unshifted (descending by date, newest first)
		for (var idx = this.jobs.length - 1; idx >= 0; idx--) {
			var job = this.jobs[idx];
			
			if (!job.perf) job.perf = { total: job.elapsed };
			if (!isa_hash(job.perf)) job.perf = parse_query_string( job.perf.replace(/\;/g, '&') );
			
			var pscale = 1;
			if (job.perf.scale) {
				pscale = job.perf.scale;
			}
			
			var perf = deep_copy_object( job.perf.perf ? job.perf.perf : job.perf );
			delete perf.scale;
			
			// remove counters from perf data
			for (var key in perf) {
				if (key.match(/^c_/)) delete perf[key];
			}
			
			if (perf.t) { perf.total = perf.t; delete perf.t; }
			
			// divide everything by scale, so we get seconds
			for (var key in perf) {
				perf[key] /= pscale;
			}
			
			perf_data.push( perf );
			for (var key in perf) {
				perf_keys[key] = 1;
			}
			
			// track times as well
			perf_times.push( job.completed );
			
			// cpu
			var cpu_avg = 0;
			if (!job.cpu) job.cpu = {};
			if (job.cpu.total && job.cpu.count) {
				cpu_avg = Math.round( job.cpu.total / job.cpu.count );
			}
			
			// mem
			var mem_avg = 0;
			if (!job.mem) job.mem = {};
			if (job.mem.total && job.mem.count) {
				mem_avg = Math.round( job.mem.total / job.mem.count );
			}
			
			// disk
			var disk_avg = 0;
			if (!job.disk) job.disk = {};
			if (job.disk.total && job.disk.count) {
				disk_avg = Math.round( job.disk.total / job.disk.count );
			}
			
			// net
			var net_avg = 0;
			if (!job.net) job.net = {};
			if (job.net.total && job.net.count) {
				net_avg = Math.round( job.net.total / job.net.count );
			}
			
			cpu_data.push({ x: job.completed, y: cpu_avg });
			mem_data.push({ x: job.completed, y: mem_avg });
			disk_data.push({ x: job.completed, y: disk_avg });
			net_data.push({ x: job.completed, y: net_avg });
			
		} // foreach row
		
		var sorted_perf_keys = hash_keys_to_array(perf_keys).sort();
		var perf_layers = [];
		
		for (var idx = 0, len = sorted_perf_keys.length; idx < len; idx++) {
			var perf_key = sorted_perf_keys[idx];
			var layer = {
				title: perf_key,
				fill: false,
				data: []
			};
			
			for (var idy = 0, ley = perf_data.length; idy < ley; idy++) {
				var perf = perf_data[idy];
				var value = Math.max( 0, perf[perf_key] || 0 );
				layer.data.push({ x: perf_times[idy], y: short_float(value) });
			} // foreach row
			
			perf_layers.push( layer );
		} // foreach key
		
		this.charts.perf.layers = [];
		this.charts.perf.addLayers( perf_layers );
		
		this.charts.cpu.layers = [];
		this.charts.cpu.addLayer({ title: "CPU Usage", data: cpu_data, color: app.colors[0] });
		
		this.charts.mem.layers = [];
		this.charts.mem.addLayer({ title: "Memory Usage", data: mem_data, color: app.colors[1] });
		
		this.charts.disk.layers = [];
		this.charts.disk.addLayer({ title: "I/O Usage", data: disk_data, color: app.colors[2] });
		
		this.charts.net.layers = [];
		this.charts.net.addLayer({ title: "Network Usage", data: net_data, color: app.colors[3] });
		
		this.div.find('#d_ve_graphs').show();
		ChartManager.check();
	}
	
	jobHistoryNav(offset) {
		// intercept click on job history table pagination nav
		this.args.offset = offset;
		this.div.find('#d_ve_history > .box_content').addClass('loading');
		this.fetchJobHistory();
	}
	
	onAfterRenderUpcomingJobs() {
		// render additional upcoming job info, if upcoming pagination is on the first page
		// (this hook is fired by renderUpcomingJobs)
		if (!this.upcomingOffset) {
			// show next run in summary header
			var html = 'n/a';
			var job = this.upcomingJobs[0];
			
			if (job) {
				if (job.type == 'plugin') {
					var plugin = find_object( app.plugins, { id: job.plugin } ) || { title: job.plugin };
					html = `<i class="mdi mdi-${plugin.icon || 'power-plug'}">&nbsp;</i>${plugin.title}`;
				}
				else {
					if (job.seconds) {
						html = this.getRelativeDateTime( job.epoch + job.seconds[0], true );
						if (job.seconds.length > 1) html += ' (+' + Math.floor(job.seconds.length - 1) + ')';
					}
					else html = this.getRelativeDateTime( job.epoch );
				}
			}
			
			this.div.find('#d_ve_next_run').html(html);
		}
	}
	
	onAfterSkipUpcomingJob() {
		// an uncoming jobs was skipped -- refresh the trigger summary
		// (this hook is fired by doSkipUpcomingJob)
		this.div.find('#d_ve_trigger_summary').html( this.getTriggerDetails() );
	}
	
	fetchRevisionHistory() {
		// fetch revision history from activity db using dedicated api
		var self = this;
		if (!this.revisionOffset) this.revisionOffset = 0;
		
		var opts = {
			id: this.event.id,
			offset: this.revisionOffset,
			limit: config.alt_items_per_page + 1 // for diff'ing across pages
		};
		
		app.api.get( 'app/get_event_history', opts, this.renderRevisionHistory.bind(this) );
	}
	
	renderRevisionHistory(resp) {
		// show revision history and add links to detail diff dialogs
		var self = this;
		var $cont = this.div.find('#d_ve_revisions');
		var html = '';
		
		if (!this.active) return; // sanity
		
		// massage results for diff'ing across pages
		// revisions always contains a shallow copy (which may have limit+1 items)
		// resp.rows will be chopped to exactly limit, for display
		this.revisions = [...resp.rows];
		if (resp.rows.length > config.alt_items_per_page) resp.rows.pop();
		
		var grid_args = {
			resp: resp,
			cols: ['Revision', 'Description', 'User', 'Date/Time', 'Actions'],
			data_type: 'item',
			offset: this.revisionOffset || 0,
			limit: config.alt_items_per_page,
			class: 'data_grid event_revision_grid',
			pagination_link: '$P().revisionNav'
		};
		
		html += this.getPaginatedGrid( grid_args, function(item, idx) {
			// figure out icon first
			if (!item.action) item.action = 'unknown';
			
			var item_type = '';
			for (var key in config.ui.activity_types) {
				var regexp = new RegExp(key);
				if (item.action.match(regexp)) {
					item_type = config.ui.activity_types[key];
					break;
				}
			}
			item._type = item_type;
			
			// compose nice description
			var desc = item.description;
			var actions = [];
			var click = '';
			var nice_rev = 'n/a';
			
			// description template
			var template = config.ui.activity_descriptions[item.action];
			if (template) desc = substitute(template, item, false);
			else if (!desc) desc = '(No description provided)';
			item._desc = desc;
			
			if (item.event) {
				click = `$P().showActionReport(${idx})`;
				actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
			}
			
			if (click) {
				desc = `<span class="link" onClick="${click}">${desc}</span>`;
				if (item.event.revision) {
					nice_rev = `<span class="link" onClick="${click}"><i class="mdi mdi-file-compare">&nbsp;</i><b>${item.event.revision}</b></span>`;
				}
			}
			
			return [
				nice_rev,
				'<i class="mdi mdi-' + item_type.icon + '">&nbsp;</i>' + desc + '',
				'' + self.getNiceUser(item.username, true) + '',
				'' + self.getRelativeDateTime( item.epoch ) + '',
				'' + actions.join(' | ') + ''
			];
		}); // getPaginatedGrid
		
		$cont.find('> .box_content').html( html );
	}
	
	revisionNav(offset) {
		// paginate through revision history
		this.revisionOffset = offset;
		this.div.find('#d_ve_revisions > .box_content').addClass('loading');
		this.fetchRevisionHistory();
	}
	
	showActionReport(idx) {
		// pop dialog for any action
		var item = this.revisions[idx];
		var template = config.ui.activity_descriptions[item.action];
		var is_cur_rev = (item.event.revision === this.event.revision);
		
		// massage a title out of description template (ugh)
		var title = template.replace(/\:\s+.+$/, '').replace(/\s+\(.+$/, '');
		var btn = '<div class="button danger" onClick="$P().prepRollback(' + idx + ')"><i class="mdi mdi-undo-variant">&nbsp;</i>Rollback...</div>';
		if (is_cur_rev) btn = '&nbsp;';
		var md = '';
		
		// summary
		md += "### Summary\n\n";
		md += '- **Description:** <i class="mdi mdi-' + item._type.icon + '">&nbsp;</i>' + item._desc + "\n";
		md += '- **Date/Time:** ' + this.getRelativeDateTime(item.epoch) + "\n";
		md += '- **User:** ' + this.getNiceUser(item.username, true) + "\n";
		md += '- **Revision:** <i class="mdi mdi-file-compare">&nbsp;</i>' + (item.event.revision || 'n/a') + (is_cur_rev ? ' (Current)' : '') + "\n";
		
		// diff
		if (this.revisions[idx + 1] && this.revisions[idx + 1].event) {
			var old_event = copy_object( this.revisions[idx + 1].event );
			delete old_event.revision;
			delete old_event.modified;
			
			var new_event = copy_object( item.event );
			delete new_event.revision;
			delete new_event.modified;
			
			var diff_html = this.getDiffHTML( old_event, new_event ) || '(No changes)';
			md += "\n### Diff to Previous\n\n";
			md += '<div class="diff_content">' + diff_html + '</div>' + "\n";
		}
		
		// the thing itself
		md += "\n### Event JSON\n\n";
		md += '```json' + "\n";
		md += JSON.stringify( item.event, null, "\t" ) + "\n";
		md += '```' + "\n";
		
		this.viewMarkdownAuto( title, md, btn );
	}
	
	prepRollback(idx) {
		// prep rollback to specified revision
		var item = this.revisions[idx];
		Dialog.hide();
		
		this.rollbackData = item.event;
		Nav.go('Events?sub=edit&id=' + this.event.id + '&rollback=1');
	}
	
	go_history() {
		Nav.go( '#Events?sub=history' );
	}
	
	gosub_history(args) {
		// show revision history sub-page
		app.setHeaderNav([
			{ icon: 'calendar-clock', loc: '#Events?sub=list', title: 'Events' },
			{ icon: 'history', title: "Revision History" }
		]);
		app.setWindowTitle( "Event Revision History" );
		
		this.goRevisionHistory({
			activityType: 'events',
			itemKey: 'event',
			editPageID: 'Events',
			itemMenu: {
				label: '<i class="icon mdi mdi-calendar-clock">&nbsp;</i>Event:',
				title: 'Select Event',
				options: [['', 'Any Event']].concat( this.getCategorizedEvents() ),
				default_icon: 'file-clock-outline'
			}
		});
	}
	
	gosub_new(args) {
		// create new event
		var html = '';
		var do_snap = true;
		
		app.setHeaderNav([
			{ icon: 'calendar-clock', loc: '#Events?sub=list', title: 'Events' },
			{ icon: 'file-edit-outline', title: "New Event" }
		]);
		
		// app.setHeaderTitle( '<i class="mdi mdi-calendar-plus">&nbsp;</i>New Event' );
		app.setWindowTitle( "New Event" );
		app.highlightTab( 'NewEvent' );
		
		html += '<div class="box" style="overflow:hidden">';
		html += '<div class="box_title">';
			html += 'New Event';
			html += '<div class="box_subtitle"><a href="#Events?sub=list">&laquo; Back to Event List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		if (this.getPageDraft()) {
			this.event = this.checkRestorePageDraft();
			do_snap = false;
		}
		else {
			this.event = deep_copy_object( app.config.new_event_template );
		}
		
		this.params = this.event.fields; // for user form param editor
		this.limits = this.event.limits; // for res limit editor
		this.actions = this.event.actions; // for job action editor
		
		if (find_object(app.categories, { id: 'general' })) this.event.category = 'general';
		else if (!app.categories.length) return this.doFullPageError("You must define at least one category to add events.");
		else this.event.category = app.categories[0].id;
		
		if (find_object(app.plugins, { id: 'shellplug' })) this.event.plugin = 'shellplug';
		else if (!app.plugins.length) return this.doFullPageError("You must create at least one Plugin to add events.");
		else this.event.plugin = app.plugins[0].id;
		
		// render form
		html += this.get_event_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onClick="$P().cancel_event_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i>Cancel</div>';
			html += '<div class="button secondary" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button primary" onClick="$P().do_new_event()"><i class="mdi mdi-floppy">&nbsp;</i>Create Event</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ee_icon, #fe_ee_cat, #fe_ee_algo, #fe_ee_plugin') );
		this.renderPluginParamEditor();
		this.renderParamEditor();
		// this.updateAddRemoveMe('#fe_ee_email');
		$('#fe_ee_title').focus();
		this.setupBoxButtonFloater();
		
		if (do_snap) this.savePageSnapshot( this.get_event_form_json(true) );
	}
	
	cancel_event_edit() {
		// cancel editing event and return to list
		// delete draft + snap
		this.deletePageDraft();
		this.deletePageSnapshot();
		
		if (this.event.id) Nav.go( '#Events?sub=view&id=' + this.event.id );
		else Nav.go( '#Events?sub=list' );
	}
	
	do_new_event(force) {
		// create new event
		app.clearError();
		var event = this.get_event_form_json();
		if (!event) return; // error
		
		this.event = event;
		
		Dialog.showProgress( 1.0, "Creating Event..." );
		app.api.post( 'app/create_event', event, this.new_event_finish.bind(this) );
	}
	
	new_event_finish(resp) {
		// new event created successfully
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		this.deletePageSnapshot();
		this.deletePageDraft();
		
		// create in-memory copy, but prevent race condition as server blasts update at same time
		var idx = find_object_idx(app.events, { id: resp.event.id });
		if (idx == -1) app.events.push(resp.event);
		
		Nav.go( 'Events?sub=view&id=' + resp.event.id );
		app.showMessage('success', "The new event was created successfully.");
	}
	
	gosub_edit(args) {
		// edit event subpage
		this.loading();
		
		// app.api.post( 'app/get_event', { id: args.id }, this.receive_event.bind(this), this.fullPageError.bind(this) );
		var event = find_object( app.events, { id: args.id } );
		if (!event) return this.doFullPageError("Event not found: " + args.id);
		
		if (args.rollback && this.rollbackData) {
			event = this.rollbackData;
			delete this.rollbackData;
			app.showMessage('info', `Revision ${event.revision} has been loaded as a draft edit.  Click 'Save Changes' to complete the rollback.  Note that a new revision number will be assigned.`);
		}
		
		this.receive_event({ code: 0, event: deep_copy_object(event) });
	}
	
	receive_event(resp) {
		// edit existing event
		var html = '';
		var do_snap = true;
		
		if (this.getPageDraft()) {
			this.event = this.checkRestorePageDraft();
			do_snap = false;
			app.showMessage('info', "Your previous unsaved edits were restored.  Click the 'Cancel' button to discard them.");
		}
		else {
			this.event = resp.event;
		}
		
		if (!this.event.fields) this.event.fields = [];
		this.params = this.event.fields; // for user form param editor
		this.limits = this.event.limits; // for res limit editor
		this.actions = this.event.actions; // for job action editor
		
		app.setHeaderNav([
			{ icon: 'calendar-clock', loc: '#Events?sub=list', title: 'Events' },
			{ icon: this.event.icon || 'file-clock-outline', loc: '#Events?sub=view&id=' + this.event.id, title: this.event.title },
			{ icon: 'file-edit-outline', title: "Edit Event" }
		]);
		
		// app.setHeaderTitle( '<i class="mdi mdi-calendar-edit">&nbsp;</i>Event Editor' );
		app.setWindowTitle( "Editing Event \"" + (this.event.title) + "\"" );
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit Event Details';
			html += '<div class="box_subtitle"><a href="#Events?sub=view&id=' + this.event.id + '">&laquo; Back to Event</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_event_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button cancel mobile_collapse" onClick="$P().cancel_event_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Close</span></div>';
			html += '<div class="button danger mobile_collapse" onClick="$P().show_delete_event_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_test_event()"><i class="mdi mdi-test-tube">&nbsp;</i><span>Test...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
			html += '<div class="button save" onClick="$P().do_save_event()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ee_icon, #fe_ee_cat, #fe_ee_algo, #fe_ee_plugin') );
		this.renderPluginParamEditor();
		this.renderParamEditor();
		// this.updateAddRemoveMe('#fe_ee_email');
		this.setupBoxButtonFloater();
		this.setupEditTriggers();
		
		if (do_snap) this.savePageSnapshot( this.get_event_form_json(true) );
	}
	
	do_export() {
		// show export dialog
		app.clearError();
		var event = this.get_event_form_json();
		if (!event) return; // error
		
		this.showExportOptions({
			name: 'event',
			dataType: 'event',
			api: this.args.id ? 'update_event' : 'create_event',
			data: event
		});
	}
	
	go_edit_history() {
		Nav.go( '#Events?sub=history&id=' + this.event.id );
	}
	
	do_test_event() {
		// test event with temporary changes
		// Note: This may include unsaved changes, which are included in the on-demand run now job, by design
		var self = this;
		var title = this.workflow ? "Test Workflow" : "Test Event";
		var btn = ['open-in-new', 'Run Now'];
		
		app.clearError();
		var event = this.get_event_form_json();
		if (!event) return; // error
		
		var html = '<div class="dialog_box_content scroll maximize">';
		
		// actions
		html += this.getFormRow({
			label: 'Actions:',
			content: this.getFormCheckbox({
				id: 'fe_ete_actions',
				label: 'Enable All Actions',
				checked: true
			}),
			caption: 'Enable all event actions for the test run.'
		});
		
		// limits
		html += this.getFormRow({
			label: 'Limits:',
			content: this.getFormCheckbox({
				id: 'fe_ete_limits',
				label: 'Enable All Limits',
				checked: true
			}),
			caption: 'Enable all resource limits for the test run.'
		});
		
		// custom input json
		html += this.getFormRow({
			label: 'Data Input:',
			content: this.getFormTextarea({
				id: 'fe_ete_input',
				rows: 1,
				value: JSON.stringify({ data: {}, files: [] }, null, "\t"),
				style: 'display:none'
			}) + `<div class="button small secondary" onClick="$P().openJobDataImporter()"><i class="mdi mdi-database-search-outline">&nbsp;</i>${config.ui.buttons.wfd_data_importer}</div>` + 
				`<div class="button small secondary" style="margin-left:15px;" onClick="$P().edit_test_input()"><i class="mdi mdi-text-box-edit-outline">&nbsp;</i>${config.ui.buttons.wfd_edit_json}</div>`,
			caption: 'Optionally customize the JSON input data for the job.  This is used to simulate data being passed to it from a previous job.'
		});
		
		// user files
		var limit = find_object( event.limits || [], { type: 'file', enabled: true } );
		html += this.getFormRow({
			label: 'File Input:',
			content: this.getDialogFileUploader(limit),
			caption: 'Optionally upload and attach files to the job as inputs.'
		});
		
		// user form fields
		html += this.getFormRow({
			label: 'User Parameters:',
			content: '<div class="plugin_param_editor_cont">' + this.getParamEditor(event.fields, {}) + '</div>',
			caption: (event.fields && event.fields.length) ? 'Enter values for all the event-defined parameters here.' : ''
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			var job = deep_copy_object(event);
			job.enabled = true; // override event disabled, so test actually runs
			job.test = true;
			job.label = "Test";
			job.icon = "test-tube";
			
			if (!$('#fe_ete_actions').is(':checked')) {
				job.actions = [];
			}
			if (!$('#fe_ete_limits').is(':checked')) {
				job.limits = [];
			}
			
			// parse custom input json
			var raw_json = $('#fe_ete_input').val();
			if (raw_json) try {
				job.input = JSON.parse( raw_json );
			}
			catch (err) {
				return app.badField( '#fe_ete_input', "", { err } );
			}
			
			// add files if user uploaded
			if (self.dialogFiles && self.dialogFiles.length) {
				if (!job.input) job.input = {};
				if (!job.input.files) job.input.files = [];
				job.input.files = job.input.files.concat( self.dialogFiles );
				delete self.dialogFiles;
			}
			
			var params = self.getParamValues(self.event.fields);
			if (!params) return; // validation error
			
			if (!job.params) job.params = {};
			merge_hash_into( job.params, params );
			
			// pre-open new window/tab for job details
			var win = window.open('', '_blank');
			
			app.api.post( 'app/run_event', job, function(resp) {
				// Dialog.hideProgress();
				if (!self.active) return; // sanity
				
				// jump immediately to live details page in new window
				// Nav.go('Job?id=' + resp.id);
				win.location.href = '#Job?id=' + resp.id;
			}, 
			function(err) {
				// capture error so we can close the window we just opened
				win.close();
				app.doError("API Error: " + err.description);
			});
			
			Dialog.hide();
		}); // Dialog.confirm
		
		Dialog.onHide = function() {
			// cleanup
			// FUTURE: If self.dialogFiles still exists here, delete in background (user canceled job)
			delete self.dialogFiles;
		};
		
		Dialog.autoResize();
	}
	
	edit_test_input() {
		// popup json editor for test dialog
		this.editCodeAuto("Edit Raw Input Data", $('#fe_ete_input').val(), function(new_value) {
			$('#fe_ete_input').val( new_value );
		});
	}
	
	openJobDataImporter() {
		// open job data importer dialog
		var self = this;
		var $input = $('#fe_ete_input');
		var title = config.ui.titles.wfd_data_importer;
		var html = '';
		var temp_data = null;
		
		html += `<div class="dialog_intro">${config.ui.intros.wfd_data_importer}</div>`;
		html += '<div class="dialog_box_content scroll maximize">';
		
		// job picker
		html += this.getFormRow({
			id: 'd_ex_job',
			content: this.getFormMenuSingle({
				id: 'fe_ex_job',
				options: [ { id: '', title: config.ui.menu_bits.generic_loading } ],
				value: ''
			})
		});
		
		// json tree viewer
		html += this.getFormRow({
			id: 'd_ex_code_viewer',
			content: '<div id="d_ex_tree"><div class="ex_tree_inner"><div class="loading_container"><div class="loading"></div></div></div></div>'
		});
		
		html += '</div>'; // dialog_box_content
		
		var buttons_html = "";
		buttons_html += `<div class="button" onClick="CodeEditor.hide()"><i class="mdi mdi-close-circle-outline">&nbsp;</i>${config.ui.buttons.cancel}</div>`;
		buttons_html += `<div id="btn_ex_apply" class="button primary"><i class="mdi mdi-check-circle">&nbsp;</i>${config.ui.buttons.import_confirm}</div>`;
		
		CodeEditor.showSimpleDialog(title, html, buttons_html);
		
		SingleSelect.init('#fe_ex_job');
		
		$('#fe_ex_job').on('change', function() {
			var id = $(this).val();
			if (!id) return; // sanity
			
			// now load job details
			app.api.get( 'app/get_job', { id, remove: ['timelines', 'activity'] }, function(resp) {
				// see if job actually produced data and/or files
				var job = resp.job;
				
				if ((job.data && first_key(job.data)) || (job.files && job.files.length)) {
					temp_data = { data: job.data || {}, files: job.files || [] };
					
					$('#d_ex_tree > .ex_tree_inner').html( 
						'<pre><code class="hljs">' + app.highlightAuto(JSON.stringify(temp_data, null, "\t"), 'json') + '</code></pre>' 
					);
				}
				else {
					$('#d_ex_tree > .ex_tree_inner').html(`<div class="ex_tree_none">${config.ui.errors.ex_tree_no_data}</div>`);
					temp_data = null;
				}
			} ); // api.get
		}); // on change
		
		$('#btn_ex_apply').on('click', function() {
			// apply changes and exit dialog
			if (temp_data) {
				$input.val( JSON.stringify(temp_data, null, "\t") );
			}
			CodeEditor.hide();
		});
		
		// job search
		var squery = (this.workflow ? 'source:workflow' : 'event:' + this.event.id) + ' tags:_success';
		
		app.api.get( 'app/search_jobs', { query: squery, limit: config.alt_items_per_page }, function(resp) {
			var items = (resp.rows || []).map( function(job) {
				var args = self.getJobDisplayArgs(job);
				return { id: job.id, title: args.title, icon: args.icon };
			} );
			
			if (!items.length) {
				$('#fe_ex_job').html( render_menu_options( [{ id: '', title: config.ui.errors.fe_ex_job }], '' ) ).trigger('change');
				$('#d_ex_tree > .ex_tree_inner').html(`<div class="ex_tree_none">${config.ui.errors.ex_tree_none}</div>`);
				return;
			}
			
			// change menu items and fire onChange event for redraw
			$('#fe_ex_job').html( render_menu_options( items, items[0].id ) ).trigger('change');
		} ); // api.get
	}
	
	do_save_event() {
		// save changes to event
		app.clearError();
		var event = this.get_event_form_json();
		if (!event) return; // error
		
		this.event = event;
		
		Dialog.showProgress( 1.0, "Saving Event..." );
		app.api.post( 'app/update_event', event, this.save_event_finish.bind(this) );
	}
	
	save_event_finish(resp) {
		// event saved successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		this.deletePageSnapshot();
		this.deletePageDraft();
		
		// update in-memory copy, to prevent race condition on view page
		var idx = find_object_idx(app.events, { id: this.event.id });
		if (idx > -1) {
			this.event.modified = app.epoch;
			this.event.revision++;
			merge_hash_into( app.events[idx], this.event );
		}
		
		// Nav.go( 'Events?sub=view&id=' + this.event.id );
		this.triggerSaveComplete();
		app.showMessage('success', "The event was saved successfully.");
	}
	
	show_delete_event_dialog() {
		// show dialog confirming event delete action
		var self = this;
		var thing = this.workflow ? "workflow" : "event";
		
		// check for jobs first
		var event_jobs = find_objects( app.activeJobs, { event: this.event.id } );
		if (event_jobs.length) return app.doError("Sorry, you cannot delete a event that has active jobs running.");
		
		Dialog.confirmDanger( 'Delete Event', "Are you sure you want to <b>permanently delete</b> the " + thing + " &ldquo;<b>" + this.event.title + "</b>&rdquo;?  This will also delete all job history for the event.  There is no way to undo this action.", ['trash-can', 'Delete'], function(result) {
			if (result) {
				Dialog.showProgress( 1.0, self.workflow ? "Deleting Workflow..." : "Deleting Event..." );
				app.api.post( 'app/delete_event', { id: self.event.id, delete_jobs: true }, self.delete_event_finish.bind(self) );
			}
		} );
	}
	
	delete_event_finish(resp) {
		// finished deleting event
		var self = this;
		var thing = this.workflow ? "workflow" : "event";
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		this.deletePageSnapshot();
		this.deletePageDraft();
		
		Nav.go('Events?sub=list', 'force');
		app.showMessage('success', "The " + thing + " &ldquo;" + this.event.title + "&rdquo; was deleted successfully.  The job history is being deleted in the background.");
	}
	
	get_event_edit_html() {
		// get html for editing an event (or creating a new one)
		var html = '';
		var event = this.event;
		
		if (event.id) {
			// event id
			html += this.getFormRow({
				label: 'Event ID:',
				content: this.getFormText({
					id: 'fe_ee_id',
					class: 'monospace',
					spellcheck: 'false',
					disabled: 'disabled',
					value: event.id
				}),
				suffix: this.getFormIDCopier(),
				caption: 'This is a unique ID for the event, used by the xyOps API.  It cannot be changed.'
			});
		}
		
		// title
		html += this.getFormRow({
			label: 'Event Title:',
			content: this.getFormText({
				id: 'fe_ee_title',
				spellcheck: 'false',
				value: event.title
			}),
			caption: 'Enter the title of the event, for display purposes.'
		});
		
		// enabled
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_ee_enabled',
				label: 'Event Enabled',
				checked: event.enabled
			}),
			caption: 'Only enabled events can run jobs, including scheduled and immediate runs.'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_ee_icon',
				title: 'Select icon for event',
				placeholder: 'Select icon for event...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: event.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for the event.'
		});
		
		// category
		html += this.getFormRow({
			label: 'Category:',
			content: this.getFormMenuSingle({
				id: 'fe_ee_cat',
				title: 'Select category for event',
				placeholder: 'Select category for event...',
				options: app.categories,
				value: event.category || '',
				default_icon: 'folder-open-outline',
				// 'data-shrinkwrap': 1
			}),
			suffix: '<div class="form_suffix_icon mdi mdi-folder-plus-outline" title="Quick Add Category..." onClick="$P().quickAddCategory()" onMouseDown="event.preventDefault();"></div>',
			caption: 'Select a category for the event (this may limit the max concurrent jobs, etc.)'
		});
		
		// tags
		html += this.getFormRow({
			label: 'Tags:',
			content: this.getFormMenuMulti({
				id: 'fe_ee_tags',
				title: 'Select tags for event',
				placeholder: 'Select tags for event...',
				options: app.tags,
				values: event.tags,
				default_icon: 'tag-outline',
				// 'data-shrinkwrap': 1
			}),
			suffix: '<div class="form_suffix_icon mdi mdi-tag-plus-outline" title="Quick Add Tag..." onClick="$P().quickAddTag()" onMouseDown="event.preventDefault();"></div>',
			caption: 'Optionally select one or more tags for the event.  Each job can add its own tags at run time.'
		});
		
		// target(s)
		var target_items = [].concat(
			this.buildOptGroup(app.groups, "Groups:", 'server-network'),
			this.buildServerOptGroup("Servers:", 'router-network')
		);
		
		html += this.getFormRow({
			label: 'Targets:',
			content: this.getFormMenuMulti({
				id: 'fe_ee_targets',
				title: 'Select targets for event',
				placeholder: 'Select targets for event...',
				options: target_items,
				values: event.targets,
				auto_add: true,
				// 'data-hold': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select groups and/or servers to run the event.'
		});
		
		// algo
		var algo_items = config.ui.event_target_algo_menu.concat(
			this.buildOptGroup( app.monitors, "Least Monitor Value:", 'chart-line', 'monitor:' )
		);
		
		html += this.getFormRow({
			label: 'Algorithm:',
			content: this.getFormMenuSingle({
				id: 'fe_ee_algo',
				title: 'Select algorithm for targets',
				placeholder: 'Select algorithm for targets...',
				options: algo_items,
				value: event.algo || '',
				default_icon: 'arrow-decision',
				'data-nudgeheight': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select the desired algorithm for choosing a server from the target list.'
		});
		
		// plugin
		html += this.getFormRow({
			label: 'Plugin:',
			content: this.getFormMenuSingle({
				id: 'fe_ee_plugin',
				title: 'Select Plugin for event',
				placeholder: 'Select Plugin for event...',
				options: app.plugins.filter( function(plugin) { return plugin.type == 'event'; } ),
				value: event.plugin || '',
				default_icon: 'power-plug-outline',
				// 'data-shrinkwrap': 1
				onChange: '$P().changePlugin()'
			}),
			caption: 'Select the desired Plugin to run jobs for the event.  Plugin parameters will appear below.'
		});
		
		// plugin params
		html += this.getFormRow({
			label: 'Parameters:',
			content: '<div id="d_ee_params" class="plugin_param_editor_cont"></div>',
			caption: 'Enter values for all the Plugin-defined parameters here.'
		});
		
		// user fields
		html += this.getFormRow({
			label: 'User Fields:',
			content: '<div id="d_params_table"></div>',
			caption: 'Optionally define a custom set of extra parameters to be collected when a user runs your event manually.'
		});
		
		// triggers
		html += this.getFormRow({
			label: 'Triggers:',
			content: '<div id="d_ee_trigger_table">' + this.getTriggerTable() + '</div>',
			caption: 'Select how and when your event should run, including manual executions and scheduling options.'
		});
		
		// resource limits
		// (requires this.limits to be populated)
		html += this.getFormRow({
			label: 'Resource Limits:',
			content: '<div id="d_ee_reslim_table">' + this.getResLimitTable() + '</div>',
			caption: 'Optionally select resource limits to assign to jobs.  These will override limits set at the category level.'
		});
		
		// actions
		// (requires this.actions to be populated)
		html += this.getFormRow({
			label: 'Job Actions:',
			content: '<div id="d_ee_jobact_table">' + this.getJobActionTable() + '</div>',
			caption: 'Optionally select custom actions to perform for each job.  Actions may also be added at the category level.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_ee_notes',
				rows: 5,
				value: event.notes
			}),
			caption: 'Optionally enter notes for the event, which will be included in all email notifications.'
		});
		
		return html;
	}
	
	quickAddCategory() {
		// show dialog to quickly add a new category, then redraw cat menu, and preselect the newly added
		var self = this;
		var title = "Quick Add Category";
		var btn = ['folder-plus', "Add Category"];
		
		var html = '<div class="dialog_box_content">';
		
		html += this.getFormRow({
			label: 'Category Name:',
			content: this.getFormText({
				id: 'fe_ecd_title',
				spellcheck: 'false',
				autocomplete: 'off',
				value: ''
			}),
			caption: 'Enter the name of the new category.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			
			var title = $('#fe_ecd_title').val().trim();
			if (!title.length) return app.badField('#fe_ecd_title', "Please enter a name for the new category.");
			
			var category = { title, enabled: true };
			
			app.api.post( 'app/create_category', category, function(resp) {
				app.cacheBust = hires_time_now();
				app.showMessage('success', "The new category was created successfully.");
				
				if (!self.active) return; // sanity
				
				// append to the menu
				var id = resp.category.id;
				$('#fe_ee_cat').append( '<option value="' + id + '" data-icon="folder-open-outline">' + title + '</option>' ).val(id).trigger('change');
			} ); // api.post
			
			Dialog.hide();
		}); // Dialog.confirm
		
		$('#fe_ecd_title').focus();
	}
	
	quickAddTag() {
		// show dialog to quickly add a new tag, then redraw cat menu, and preselect the newly added
		var self = this;
		var title = "Quick Add Tag";
		var btn = ['tag-plus', "Add Tag"];
		
		var html = '<div class="dialog_box_content">';
		
		html += this.getFormRow({
			label: 'Tag Name:',
			content: this.getFormText({
				id: 'fe_etd_title',
				spellcheck: 'false',
				autocomplete: 'off',
				value: ''
			}),
			caption: 'Enter the name of the new tag.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			
			var title = $('#fe_etd_title').val().trim();
			if (!title.length) return app.badField('#fe_ecd_title', "Please enter a name for the new tag.");
			
			var tag = { title, enabled: true };
			
			app.api.post( 'app/create_tag', tag, function() {
				app.cacheBust = hires_time_now();
				app.showMessage('success', "The new tag was created successfully.");
				
				if (!self.active) return; // sanity
				
				// append to the menu
				var id = resp.tag.id;
				$('#fe_ee_tags').append( '<option value="' + id + '" data-icon="tag-outline" selected="selected">' + title + '</option>' ).trigger('change');
			} ); // api.post
			
			Dialog.hide();
		}); // Dialog.confirm
		
		$('#fe_etd_title').focus();
	}
	
	renderTriggerTable() {
		// render res limit editor
		var html = this.getTriggerTable();
		this.div.find('#d_ee_trigger_table').html( html );
	}
	
	getSortedTriggers() {
		// custom sort for display
		return [].concat(
			this.event.triggers.filter( function(row) { return row.type == 'manual'; } ),
			this.event.triggers.filter( function(row) { return row.type == 'schedule'; } ),
			this.event.triggers.filter( function(row) { return row.type == 'single'; } ),
			this.event.triggers.filter( function(row) { return row.type == 'interval'; } ),
			this.event.triggers.filter( function(row) { return row.type == 'continuous'; } ),
			this.event.triggers.filter( function(row) { return row.type == 'plugin'; } ),
			this.event.triggers.filter( function(row) { return !(row.type || '').match(/^(schedule|continuous|interval|single|manual|plugin)$/); } )
		);
	}
	
	getTriggerTable() {
		// get html for trigger table
		var self = this;
		var html = '';
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Type', 'Description', 'Actions'];
		var add_link = '<div class="button small secondary" onClick="$P().editTrigger(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i>New Trigger...</div>';
		
		if (!this.event.triggers.length) return add_link;
		
		// custom sort
		var rows = this.getSortedTriggers();
		this.event.triggers = rows; // for idx-based selections to work, we have to commit the sort
		
		var targs = {
			rows: rows,
			cols: cols,
			data_type: 'item',
			class: 'data_grid',
			empty_msg: add_link,
			always_append_empty_msg: true,
			grid_template_columns: '40px auto auto auto'
		};
		
		html += this.getCompactGrid(targs, function(item, idx) {
			var actions = [];
			actions.push( '<span class="link" onClick="$P().editTrigger('+idx+')"><b>Edit</b></span>' );
			actions.push( '<span class="link danger" onClick="$P().deleteTrigger('+idx+')"><b>Delete</b></span>' );
			
			var { nice_icon, nice_type, nice_desc } = self.getTriggerDisplayArgs(item);
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggleTriggerEnabled(this,' + idx + ')'
				}) + '</div>',
				'<div class="td_big nowrap">' + '<span class="link" onClick="$P().editTrigger('+idx+')">' + nice_icon + nice_type + '</span></div>',
				'<div class="ellip">' + nice_desc + '</div>',
				'<span class="nowrap">' + actions.join(' | ') + '</span>'
			];
			
			if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getCompactGrid
		
		return html;
	}
	
	toggleTriggerEnabled(elem, idx) {
		// toggle trigger checkbox, actually do the enable/disable here, update row
		var item = this.event.triggers[idx];
		item.enabled = !!$(elem).is(':checked');
		
		if (item.enabled) $(elem).closest('ul').removeClass('disabled');
		else $(elem).closest('ul').addClass('disabled');
		
		if (this.onAfterEditTrigger) this.onAfterEditTrigger(idx, item);
		
		this.triggerEditChange();
	}
	
	editTrigger(idx) {
		// show dialog to select trigger
		var self = this;
		var new_item = { type: 'schedule', enabled: true, minutes: [0] };
		var trigger = (idx > -1) ? this.event.triggers[idx] : new_item;
		var title = (idx > -1) ? "Editing Trigger" : "New Trigger";
		var btn = (idx > -1) ? ['check-circle', "Accept"] : ['plus-circle', "Add Trigger"];
		
		// grab external ID if applicable (workflow node)
		var ext_id = trigger.id || '';
		if (ext_id) title += ` <div class="dialog_title_widget mobile_hide"><span class="monospace">${this.getNiceCopyableID(ext_id)}</span></div>`;
		
		// if user's tz differs from server tz, pre-populate timezone menu with user's zone
		var ropts = Intl.DateTimeFormat().resolvedOptions();
		var user_tz = app.user.timezone || ropts.timeZone;
		if (user_tz != app.config.tz) new_item.timezone = user_tz;
		
		var html = '<div class="dialog_box_content maximize scroll">';
		
		// status
		html += this.getFormRow({
			id: 'd_et_status',
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_et_enabled',
				label: 'Trigger Enabled',
				checked: trigger.enabled
			}),
			caption: 'Enable or disable this trigger.'
		});
		
		// type (tmode)
		var tmode = '';
		switch (trigger.type) {
			case 'schedule':
				tmode = 'hourly';
				if (trigger.years && trigger.years.length) tmode = 'custom';
				else if (trigger.months && trigger.months.length && trigger.weekdays && trigger.weekdays.length) tmode = 'custom';
				else if (trigger.days && trigger.days.length && trigger.weekdays && trigger.weekdays.length) tmode = 'custom';
				else if (trigger.months && trigger.months.length) tmode = 'yearly';
				else if (trigger.weekdays && trigger.weekdays.length) tmode = 'weekly';
				else if (trigger.days && trigger.days.length) tmode = 'monthly';
				else if (trigger.hours && trigger.hours.length) tmode = 'daily';
				else if (trigger.minutes && trigger.minutes.length) tmode = 'hourly';
			break;
			
			default:
				tmode = trigger.type;
			break;
		} // switch trigger.type
		
		html += this.getFormRow({
			id: 'd_et_type',
			label: 'Type:',
			content: this.getFormMenuSingle({
				id: 'fe_et_type',
				title: "Select Trigger Type",
				options: config.ui.event_trigger_type_menu,
				value: tmode,
				'data-shrinkwrap': 1,
				// 'data-nudgeheight': 1
			}),
			caption: 'Select the desired type for the trigger.'
		});
		
		// years
		html += this.getFormRow({
			id: 'd_et_years',
			label: 'Years:',
			content: this.getFormMenuMulti({
				id: 'fe_et_years',
				title: 'Select Years',
				placeholder: '(Every Year)',
				options: this.getYearOptions(),
				values: trigger.years || [],
				'data-hold': 1,
				'data-shrinkwrap': 1,
				// 'data-compact': 1
			})
		});
		
		// months
		html += this.getFormRow({
			id: 'd_et_months',
			label: 'Months:',
			content: this.getFormMenuMulti({
				id: 'fe_et_months',
				title: 'Select Months',
				placeholder: '(Every Month)',
				options: this.getMonthOptions(),
				values: trigger.months || [],
				'data-hold': 1,
				'data-shrinkwrap': 1,
				// 'data-compact': 1
			})
		});
		
		// weekdays
		html += this.getFormRow({
			id: 'd_et_weekdays',
			label: 'Weekdays:',
			content: this.getFormMenuMulti({
				id: 'fe_et_weekdays',
				title: 'Select Weekdays',
				placeholder: '(Every Weekday)',
				options: this.getWeekdayOptions(),
				values: trigger.weekdays || [],
				'data-hold': 1,
				'data-shrinkwrap': 1,
				// 'data-compact': 1
			})
		});
		
		// days
		html += this.getFormRow({
			id: 'd_et_days',
			label: 'Month Days:',
			content: this.getFormMenuMulti({
				id: 'fe_et_days',
				title: 'Select Days',
				placeholder: '(Every Day)',
				options: this.getDayOptions(),
				values: trigger.days || [],
				'data-hold': 1,
				'data-shrinkwrap': 1,
				// 'data-compact': 1
			})
		});
		
		// hours
		html += this.getFormRow({
			id: 'd_et_hours',
			label: 'Hours:',
			content: this.getFormMenuMulti({
				id: 'fe_et_hours',
				title: 'Select Hours',
				placeholder: '(Every Hour)',
				options: this.getHourOptions(),
				values: trigger.hours || [],
				'data-hold': 1,
				'data-shrinkwrap': 1,
				// 'data-compact': 1
			})
		});
		
		// minutes
		html += this.getFormRow({
			id: 'd_et_minutes',
			label: 'Minutes:',
			content: this.getFormMenuMulti({
				id: 'fe_et_minutes',
				title: 'Select Minutes',
				placeholder: '(Every Minute)',
				options: this.getMinuteOptions(),
				values: trigger.minutes || [],
				'data-hold': 1,
				'data-shrinkwrap': 1,
				// 'data-compact': 1
			})
		});
		
		// crontab
		html += this.getFormRow({
			id: 'd_et_crontab',
			label: 'Crontab Expression:',
			content: this.getFormText({
				id: 'fe_et_crontab',
				class: 'monospace',
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 64,
				value: ''
			}),
			caption: 'Use this to import event trigger settings from a <a href="https://en.wikipedia.org/wiki/Cron#CRON_expression" target="_blank">Crontab expression</a>.  This is a string comprising five (or six) fields separated by white space that represents a set of dates/times.  Example: <b>30 4 1 * *</b> (First day of every month at 4:30 AM)'
		});
		
		// continuous
		html += this.getFormRow({
			id: 'd_et_continuous_desc',
			label: 'Description:',
			content: 'Add this trigger to keep your job running continuously.  If it exits or crashes for any reason (besides a manual user abort), xyOps will immediately start it up again.'
		});
		
		// interval
		html += this.getFormRow({
			id: 'd_et_interval_desc',
			label: 'Description:',
			content: 'This schedule-based trigger allows you to run jobs based on a custom time interval, and a starting date/time.'
		});
		
		html += this.getFormRow({
			id: 'd_et_interval',
			label: 'Interval:',
			content: this.getFormRelativeTime({
				id: 'fe_et_interval',
				value: trigger.duration || 0
			}),
			caption: 'Specify the desired time interval between job launches.'
		});
		
		// single shot
		html += this.getFormRow({
			id: 'd_et_single',
			label: 'Single Shot:',
			content: this.getFormText({
				id: 'fe_et_single',
				type: 'datetime-local',
				spellcheck: 'false',
				autocomplete: 'off',
				value: trigger.epoch ? this.formatDateISO( trigger.epoch, this.getUserTimezone() ) : ''
			}),
			caption: 'Select a single date/time when the event should run in your local timezone (' + this.getUserTimezone() + ').  This can accompany other triggers, or exist on its own.'
		});
		
		// manual
		html += this.getFormRow({
			id: 'd_et_manual_desc',
			label: 'Description:',
			content: 'When manual mode is enabled, users and API keys with applicable privileges can run the event on demand.'
		});
		
		// catch-up
		html += this.getFormRow({
			id: 'd_et_catchup_desc',
			label: 'Description:',
			content: 'When Catch-Up Mode mode is enabled on an event, the scheduler will do its best to ensure that <i>every</i> scheduled job will run, even if they have to run late.  This is useful for time-sensitive events such as generating reports, and is designed to accompany other triggers.'
		});
		html += this.getFormRow({
			id: 'd_et_time_machine',
			label: 'Time Machine:',
			content: this.getFormText({
				id: 'fe_et_time_machine',
				type: 'datetime-local',
				spellcheck: 'false',
				autocomplete: 'off',
				value: ''
			}),
			caption: 'Optionally adjust the internal clock for this event, to either repeat past jobs, or jump over a backlog.  Select a date/time in your local timezone (' + this.getUserTimezone() + ').  <span class="link" onClick="$P().resetTimeMachine()">Reset to Now</span>'
		});
		
		// range
		html += this.getFormRow({
			id: 'd_et_range_desc',
			label: 'Description:',
			content: 'This option allows you to set a starting and/or ending date/time for the event.  Jobs will not be scheduled before your start date/time, nor after your end date/time.  This is designed to accompany other triggers.'
		});
		
		// blackout
		html += this.getFormRow({
			id: 'd_et_blackout_desc',
			label: 'Description:',
			content: 'This option allows you to set a "blackout" period for the event, meaning jobs will not be scheduled during this time.  Examples include company holidays, and maintenance windows.  This is designed to accompany other triggers.'
		});
		
		// delay
		html += this.getFormRow({
			id: 'd_et_delay_desc',
			label: 'Description:',
			content: 'This option allows you to set a custom delay for each job launched by the scheduler.  This does not affect jobs launched manually in the UI or via the API.'
		});
		html += this.getFormRow({
			id: 'd_et_delay',
			label: 'Delay (Seconds):',
			content: this.getFormText({
				id: 'fe_et_delay',
				type: 'number',
				spellcheck: 'false',
				autocomplete: 'off',
				min: 1,
				value: trigger.duration || 1
			}),
			caption: 'Specify your custom job starting delay in seconds.'
		});
		
		// plugin
		html += this.getFormRow({
			id: 'd_et_plugin',
			label: 'Trigger Plugin:',
			content: this.getFormMenuSingle({
				id: 'fe_et_plugin',
				title: 'Select Scheduler Plugin',
				options: app.plugins.filter( function(plugin) { return plugin.type == 'scheduler'; } ),
				value: trigger.plugin_id,
				default_icon: 'power-plug-outline'
			}),
			caption: 'Select Plugin to use for custom scheduling.'
		});
		
		// plugin params
		html += this.getFormRow({
			id: 'd_et_plugin_params',
			label: 'Parameters:',
			content: '<div id="d_et_param_editor" class="plugin_param_editor_cont"></div>',
			caption: 'Enter values for all the Plugin-defined parameters here.'
		});
		
		// range & blackout share these:
		html += this.getFormRow({
			id: 'd_et_range_start',
			label: 'Start Date/Time:',
			content: this.getFormText({
				id: 'fe_et_range_start',
				type: 'datetime-local',
				spellcheck: 'false',
				autocomplete: 'off',
				value: trigger.start ? this.formatDateISO( trigger.start, this.getUserTimezone() ) : ''
			}),
			caption: 'Select a start date/time in your local timezone(' + this.getUserTimezone() + ').'
		});
		html += this.getFormRow({
			id: 'd_et_range_end',
			label: 'End Date/Time:',
			content: this.getFormText({
				id: 'fe_et_range_end',
				type: 'datetime-local',
				spellcheck: 'false',
				autocomplete: 'off',
				value: trigger.end ? this.formatDateISO( trigger.end, this.getUserTimezone() ) : ''
			}),
			caption: 'Select an end date/time in your local timezone (' + this.getUserTimezone() + ').'
		});
		
		// precision desc
		html += this.getFormRow({
			id: 'd_et_precision_desc',
			label: 'Description:',
			content: 'This option allows you to set the precise seconds when each job should launch via the scheduler.  This does not affect jobs launched manually in the UI or via the API.'
		});
		
		// precision seconds
		html += this.getFormRow({
			id: 'd_et_seconds',
			label: 'Seconds:',
			content: this.getFormMenuMulti({
				id: 'fe_et_seconds',
				title: 'Select Seconds',
				placeholder: '(On The Minute)',
				options: this.getSecondOptions(),
				values: trigger.seconds || [],
				'data-hold': 1,
				'data-shrinkwrap': 1,
				// 'data-compact': 1
			})
		});
		
		// timezone (shared by schedule and crontab types)
		var zones = [
			['', "Server Default (" + app.config.tz + ")"],
			[user_tz, "My Timezone (" + user_tz + ")"]
		].concat(app.config.intl.timezones);
		
		html += this.getFormRow({
			id: 'd_et_tz',
			label: 'Timezone:',
			content: this.getFormMenuSingle({
				id: 'fe_et_tz',
				title: 'Select Timezone',
				options: zones,
				value: trigger.timezone || ''
			}),
			caption: 'Select the desired timezone for the trigger.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			trigger = {
				enabled: $('#fe_et_enabled').is(':checked'),
				type: $('#fe_et_type').val()
			};
			
			// copy over external id if present (workflow node)
			if (ext_id) trigger.id = ext_id;
			
			switch (trigger.type) {
				case 'custom':
					trigger.type = 'schedule';
					if ($('#fe_et_years').val().length) trigger.years = $('#fe_et_years').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_months').val().length) trigger.months = $('#fe_et_months').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_weekdays').val().length) trigger.weekdays = $('#fe_et_weekdays').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_days').val().length) trigger.days = $('#fe_et_days').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_hours').val().length) trigger.hours = $('#fe_et_hours').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_minutes').val().length) trigger.minutes = $('#fe_et_minutes').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_tz').val().length) trigger.timezone = $('#fe_et_tz').val();
				break;
				
				case 'yearly':
					trigger.type = 'schedule';
					if ($('#fe_et_months').val().length) trigger.months = $('#fe_et_months').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_days').val().length) trigger.days = $('#fe_et_days').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_hours').val().length) trigger.hours = $('#fe_et_hours').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_minutes').val().length) trigger.minutes = $('#fe_et_minutes').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_tz').val().length) trigger.timezone = $('#fe_et_tz').val();
				break;
				
				case 'monthly':
					trigger.type = 'schedule';
					if ($('#fe_et_days').val().length) trigger.days = $('#fe_et_days').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_hours').val().length) trigger.hours = $('#fe_et_hours').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_minutes').val().length) trigger.minutes = $('#fe_et_minutes').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_tz').val().length) trigger.timezone = $('#fe_et_tz').val();
				break;
				
				case 'weekly':
					trigger.type = 'schedule';
					if ($('#fe_et_weekdays').val().length) trigger.weekdays = $('#fe_et_weekdays').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_days').val().length) trigger.days = $('#fe_et_days').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_hours').val().length) trigger.hours = $('#fe_et_hours').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_minutes').val().length) trigger.minutes = $('#fe_et_minutes').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_tz').val().length) trigger.timezone = $('#fe_et_tz').val();
				break;
				
				case 'daily':
					trigger.type = 'schedule';
					if ($('#fe_et_hours').val().length) trigger.hours = $('#fe_et_hours').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_minutes').val().length) trigger.minutes = $('#fe_et_minutes').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_tz').val().length) trigger.timezone = $('#fe_et_tz').val();
				break;
				
				case 'hourly':
					trigger.type = 'schedule';
					if ($('#fe_et_minutes').val().length) trigger.minutes = $('#fe_et_minutes').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_tz').val().length) trigger.timezone = $('#fe_et_tz').val();
				break;
				
				case 'crontab':
					trigger.type = 'schedule';
					var cron_exp = $('#fe_et_crontab').val().toLowerCase();
					if (!cron_exp) return app.badField('#fe_et_crontab', "Please enter a crontab date/time expression.");
					
					// validate, convert to trigger object
					var ctrigger = null;
					try {
						ctrigger = parse_crontab( cron_exp, $('#fe_ee_title').val() );
					}
					catch (e) {
						return app.badField('#fe_et_crontab', e.toString());
					}
					
					merge_hash_into(trigger, ctrigger);
					if ($('#fe_et_tz').val().length) trigger.timezone = $('#fe_et_tz').val();
				break;
				
				case 'continuous':
					// continuous mode (no options)
					if ((idx == -1) && trigger.enabled && find_object(self.event.triggers, { type: 'continuous', enabled: true })) {
						return app.doError("Sorry, you can only have one continuous rule defined per event.");
					}
				break;
				
				case 'interval':
					// interval mode
					trigger.duration = parseInt( $('#fe_et_interval').val() );
					if (!trigger.duration) return app.badField('#fe_et_interval_val', "Please enter or select a non-zero interval time.");
					
					trigger.start = self.parseDateTZ( $('#fe_et_range_start').val(), self.getUserTimezone() ) || 0;
					if (!trigger.start) return app.badField('#fe_et_range_start', "Please enter a valid date/time when the interval should start.");
					
					if ((idx == -1) && trigger.enabled && find_object(self.event.triggers, { type: 'precision', enabled: true })) {
						return app.doError("Sorry, the interval and precision triggers are mutually exclusive.");
					}
					if ((idx == -1) && trigger.enabled && find_object(self.event.triggers, { type: 'delay', enabled: true })) {
						return app.doError("Sorry, the interval and delay triggers are mutually exclusive.");
					}
				break;
				
				case 'single':
					// single shot
					trigger.epoch = self.parseDateTZ( $('#fe_et_single').val(), self.getUserTimezone() );
					if (!trigger.epoch) return app.badField('#fe_et_single', "Please enter a valid date/time when the event should run.");
				break;
				
				case 'manual':
					// manual mode (no options)
					if ((idx == -1) && trigger.enabled && find_object(self.event.triggers, { type: 'manual', enabled: true })) {
						return app.doError("Sorry, you can only have one manual rule defined per event.");
					}
				break;
				
				case 'catchup':
					// time machine
					if ($('#fe_et_time_machine').val()) {
						self.event.update_state = {
							cursor: self.parseDateTZ( $('#fe_et_time_machine').val(), self.getUserTimezone() )
						};
					}
					if ((idx == -1) && trigger.enabled && find_object(self.event.triggers, { type: 'catchup', enabled: true })) {
						return app.doError("Sorry, you can only have one catch-up rule defined per event.");
					}
				break;
				
				case 'range':
					trigger.start = self.parseDateTZ( $('#fe_et_range_start').val(), self.getUserTimezone() ) || 0;
					trigger.end = self.parseDateTZ( $('#fe_et_range_end').val(), self.getUserTimezone() ) || 0;
					if (trigger.start && trigger.end && (trigger.start > trigger.end)) {
						return app.badField('#fe_et_range_start', "Invalid date range entered.  The start date cannot come after the end date.");
					}
					if ((idx == -1) && trigger.enabled && find_object(self.event.triggers, { type: 'range', enabled: true })) {
						return app.doError("Sorry, you can only have one date/time range defined per event.");
					}
				break;
				
				case 'blackout':
					trigger.start = self.parseDateTZ( $('#fe_et_range_start').val(), self.getUserTimezone() ) || 0;
					trigger.end = self.parseDateTZ( $('#fe_et_range_end').val(), self.getUserTimezone() ) || 0;
					if (!trigger.start) return app.badField('#fe_et_range_start', "Please select both a start and an end for the range.");
					if (!trigger.end) return app.badField('#fe_et_range_end', "Please select both a start and an end for the range.");
					if (trigger.start > trigger.end) return app.badField('#fe_et_range_start', "Invalid date range entered.  The start date cannot come after the end date.");
				break;
				
				case 'delay':
					// starting delay
					if ((idx == -1) && find_object(self.event.triggers, { type: 'delay' })) {
						return app.doError("Sorry, you can only have one delay rule defined per event.");
					}
					trigger.duration = parseInt( $('#fe_et_delay').val() );
					if (!trigger.duration) return app.badField('#fe_et_delay', "Please enter or select the number of seconds to delay.");
					
					if ((idx == -1) && trigger.enabled && find_object(self.event.triggers, { type: 'interval', enabled: true })) {
						return app.doError("Sorry, the delay and interval triggers are mutually exclusive.");
					}
					if ((idx == -1) && trigger.enabled && find_object(self.event.triggers, { type: 'precision', enabled: true })) {
						return app.doError("Sorry, the delay and precision triggers are mutually exclusive.");
					}
				break;
				
				case 'precision':
					// precision (seconds)
					trigger.seconds = $('#fe_et_seconds').val().map( function(v) { return parseInt(v); } );
					
					if ((idx == -1) && trigger.enabled && find_object(self.event.triggers, { type: 'precision', enabled: true })) {
						return app.doError("Sorry, you can only have one precision rule defined per event.");
					}
					if ((idx == -1) && trigger.enabled && find_object(self.event.triggers, { type: 'interval', enabled: true })) {
						return app.doError("Sorry, the precision and interval triggers are mutually exclusive.");
					}
					if ((idx == -1) && trigger.enabled && find_object(self.event.triggers, { type: 'delay', enabled: true })) {
						return app.doError("Sorry, the precision and delay triggers are mutually exclusive.");
					}
				break;
				
				case 'plugin':
					trigger.plugin_id = $('#fe_et_plugin').val();
					if (!trigger.plugin_id) return app.badField('#fe_et_plugin', "Please select a Plugin for scheduling.");
					trigger.params = self.getPluginParamValues( trigger.plugin_id );
					if (!trigger.params) return false; // invalid
					if ($('#fe_et_tz').val().length) trigger.timezone = $('#fe_et_tz').val();
				break;
			} // switch trigger.type
			
			// see if we need to add or replace
			if (idx == -1) {
				self.event.triggers.push(trigger);
			}
			else self.event.triggers[idx] = trigger;
			
			// self.dirty = true;
			Dialog.hide();
			self.renderTriggerTable();
			if (self.onAfterEditTrigger) self.onAfterEditTrigger(idx, trigger);
			self.triggerEditChange();
		} ); // Dialog.confirm
		
		var change_trigger_type = function(new_type) {
			$('.dialog_box_content .form_row').hide();
			$('#d_et_status, #d_et_type').show();
			var new_btn_label = 'Add Trigger';
			
			switch (new_type) {
				case 'custom':
					$('#d_et_years').show();
					$('#d_et_months').show();
					$('#d_et_weekdays').show();
					$('#d_et_days').show();
					$('#d_et_hours').show();
					$('#d_et_minutes').show();
					$('#d_et_tz').show();
				break;
				
				case 'yearly':
					$('#d_et_months').show();
					$('#d_et_days').show();
					$('#d_et_hours').show();
					$('#d_et_minutes').show();
					$('#d_et_tz').show();
				break;
				
				case 'monthly':
					$('#d_et_days').show();
					$('#d_et_hours').show();
					$('#d_et_minutes').show();
					$('#d_et_tz').show();
				break;
				
				case 'weekly':
					$('#d_et_weekdays').show();
					$('#d_et_hours').show();
					$('#d_et_minutes').show();
					$('#d_et_tz').show();
				break;
				
				case 'daily':
					$('#d_et_hours').show();
					$('#d_et_minutes').show();
					$('#d_et_tz').show();
				break;
				
				case 'hourly':
					$('#d_et_minutes').show();
					$('#d_et_tz').show();
				break;
				
				case 'crontab':
					$('#d_et_crontab').show();
					$('#d_et_tz').show();
				break;
				
				case 'continuous':
					$('#d_et_continuous_desc').show();
				break;
				
				case 'interval':
					$('#d_et_interval_desc').show();
					$('#d_et_interval').show();
					$('#d_et_range_start').show();
				break;
				
				case 'single':
					$('#d_et_single').show();
				break;
				
				case 'manual':
					$('#d_et_manual_desc').show();
				break;
				
				case 'catchup':
					$('#d_et_catchup_desc').show();
					$('#d_et_time_machine').show();
					new_btn_label = 'Add Option';
				break;
				
				case 'range':
					$('#d_et_range_desc').show();
					$('#d_et_range_start').show();
					$('#d_et_range_end').show();
					new_btn_label = 'Add Option';
				break;
				
				case 'blackout':
					$('#d_et_blackout_desc').show();
					$('#d_et_range_start').show();
					$('#d_et_range_end').show();
					new_btn_label = 'Add Option';
				break;
				
				case 'delay':
					$('#d_et_delay_desc').show();
					$('#d_et_delay').show();
					new_btn_label = 'Add Option';
				break;
				
				case 'precision':
					$('#d_et_precision_desc').show();
					$('#d_et_seconds').show();
					new_btn_label = 'Add Option';
				break;
				
				case 'plugin':
					$('#d_et_plugin').show();
					$('#d_et_plugin_params').show();
					$('#d_et_param_editor').html( self.getPluginParamEditor( $('#fe_et_plugin').val(), trigger.params || {} ) );
					$('#d_et_tz').show();
				break;
			} // switch new_type
			
			if (idx == -1) {
				$('#btn_dialog_confirm > span').html( new_btn_label );
			}
			
			app.clearError();
			Dialog.autoResize();
		}; // change_action_type
		
		$('#fe_et_type').on('change', function() {
			change_trigger_type( $(this).val() );
		}); // type change
		
		$('#fe_et_plugin').on('change', function() {
			$('#d_et_param_editor').html( self.getPluginParamEditor( $(this).val(), trigger.params || {} ) );
			Dialog.autoResize();
		}); // type change
		
		SingleSelect.init( $('#fe_et_type, #fe_et_tz, #fe_et_plugin') );
		MultiSelect.init( $('#fe_et_years, #fe_et_months, #fe_et_weekdays, #fe_et_days, #fe_et_hours, #fe_et_minutes, #fe_et_seconds') );
		RelativeTime.init( $('#fe_et_interval') );
		// this.updateAddRemoveMe('#fe_eja_email');
		
		change_trigger_type( tmode );
	}
	
	resetTimeMachine() {
		// set time machine date/time to now
		$('#fe_et_time_machine').val( this.formatDateISO( time_now(), this.getUserTimezone() ) );
		this.triggerEditChange();
	}
	
	deleteTrigger(idx) {
		// delete selected trigger
		var trigger = this.event.triggers[idx];
		
		this.event.triggers.splice( idx, 1 );
		this.renderTriggerTable();
		
		if (this.onAfterEditTrigger) {
			trigger.deleted = true;
			this.onAfterEditTrigger(idx, trigger);
		}
		
		this.triggerEditChange();
	}
	
	getYearOptions() {
		// get locale-formatted year numbers for menu
		var cur_year = yyyy();
		var options = [];
		
		for (var year = cur_year; year <= cur_year + 10; year++) {
			var date = new Date( year, 5, 15, 12, 30, 30, 0 );
			var label = this.formatDate( date.getTime() / 1000, { year: 'numeric' } );
			options.push([ ''+year, label ]);
		}
		
		return options;
	}
	
	getMonthOptions() {
		// get locale-formatted month names for menu
		var cur_year = yyyy();
		var options = [];
		
		for (var month = 1; month <= 12; month++) {
			var date = new Date( cur_year, month - 1, 15, 12, 30, 30, 0 );
			// var label = this.formatDate( date.getTime() / 1000, { month: 'short' } );
			// options.push([ ''+month, label ]);
			options.push({
				id: '' + month,
				title: this.formatDate( date.getTime() / 1000, { month: 'long' } ),
				abbrev: this.formatDate( date.getTime() / 1000, { month: 'short' } )
			});
		}
		
		return options;
	}
	
	getWeekdayOptions() {
		// get locale-formatted weekday names for menu
		var cur_year = yyyy();
		var options = [];
		
		// find nearest sunday
		var date = new Date( cur_year, 5, 15, 12, 30, 30, 0 );
		while (date.getDay() != 0) {
			date.setTime( date.getTime() + 86400000 );
		}
		while (options.length < 7) {
			// var label = this.formatDate( date.getTime() / 1000, { weekday: 'short', timeZone: false } );
			// options.push([ ''+options.length, label ]);
			options.push({
				id: '' + options.length,
				title: this.formatDate( date.getTime() / 1000, { weekday: 'long', timeZone: false } ),
				abbrev: this.formatDate( date.getTime() / 1000, { weekday: 'short', timeZone: false } )
			});
			date.setTime( date.getTime() + 86400000 );
		}
		
		return options;
	}
	
	getDayOptions() {
		// get locale-formatted month days for a 31-day month
		var cur_year = yyyy();
		var options = [];
		
		var date = new Date( cur_year, 6, 1, 12, 30, 30, 0 );
		var num = 1;
		while (options.length < 31) {
			var label = this.formatDate( date.getTime() / 1000, { day: 'numeric', timeZone: false } );
			options.push([ ''+num, label ]);
			date.setTime( date.getTime() + 86400000 );
			num++;
		}
		
		options.push({
			group: 'Special',
			id: '-1',
			title: "(Last Day of Month)",
			abbrev: "(Last Day)"
		});
		options.push({
			id: '-2',
			title: "(2nd Last Day)",
			abbrev: "(2nd Last)"
		});
		options.push({
			id: '-3',
			title: "(3rd Last Day)",
			abbrev: "(3rd Last)"
		});
		options.push({
			id: '-4',
			title: "(4th Last Day)",
			abbrev: "(4th Last)"
		});
		options.push({
			id: '-5',
			title: "(5th Last Day)",
			abbrev: "(5th Last)"
		});
		options.push({
			id: '-6',
			title: "(6th Last Day)",
			abbrev: "(6th Last)"
		});
		options.push({
			id: '-7',
			title: "(7th Last Day)",
			abbrev: "(7th Last)"
		});
		
		return options;
	}
	
	getHourOptions() {
		// get locale-formatted hours for a full day
		var cur_year = yyyy();
		var options = [];
		
		var date = new Date( cur_year, 6, 1, 0, 30, 30, 0 );
		while (options.length < 24) {
			var label = this.formatDate( date.getTime() / 1000, { hour: 'numeric', timeZone: false } );
			options.push([ ''+options.length, label ]);
			date.setTime( date.getTime() + 3600000 );
		}
		
		return options;
	}
	
	getMinuteOptions() {
		// get locale-formatted minutes for a full hour
		var cur_year = yyyy();
		var options = [];
		
		var date = new Date( cur_year, 6, 1, 0, 0, 0, 0 );
		var opts = this.getDateOptions({ hour: 'numeric', minute: '2-digit', timeZone: false });
		var formatter = new Intl.DateTimeFormat( opts.locale, opts );
		
		while (options.length < 60) {
			var parts = formatter.formatToParts(date);
			var label = (find_object(parts, { type: 'literal' }) || { value: ':' }).value + find_object(parts, { type: 'minute' }).value;
			options.push([ ''+options.length, label.trim() ]);
			date.setTime( date.getTime() + 60000 );
		}
		
		return options;
	}
	
	getSecondOptions() {
		// get locale-formatted seconds for a full minute (precision option)
		var cur_year = yyyy();
		var options = [];
		
		var date = new Date( cur_year, 6, 1, 0, 0, 0, 0 );
		var opts = this.getDateOptions({ minute: '2-digit', second: '2-digit', timeZone: false });
		var formatter = new Intl.DateTimeFormat( opts.locale, opts );
		
		while (options.length < 60) {
			var parts = formatter.formatToParts(date);
			var label = (find_object(parts, { type: 'literal' }) || { value: ':' }).value + find_object(parts, { type: 'second' }).value;
			options.push([ ''+options.length, label.trim() ]);
			date.setTime( date.getTime() + 1000 );
		}
		
		return options;
	}
	
	changePlugin() {
		// change plugin, clear out event params and redraw param editor
		this.event.params = {};
		this.renderPluginParamEditor();
	}
	
	renderPluginParamEditor() {
		// render plugin paral editor
		var html = this.getPluginParamEditor( this.div.find('#fe_ee_plugin').val(), this.event.params, true );
		this.div.find('#d_ee_params').html( html );
	}
	
	get_event_form_json(force) {
		// get api key elements from form, used for new or edit
		var event = this.event;
		
		event.title = $('#fe_ee_title').val().trim();
		event.enabled = $('#fe_ee_enabled').is(':checked') ? true : false;
		event.icon = $('#fe_ee_icon').val();
		event.category = $('#fe_ee_cat').val();
		event.tags = $('#fe_ee_tags').val();
		event.targets = $('#fe_ee_targets').val();
		event.algo = $('#fe_ee_algo').val();
		event.plugin = $('#fe_ee_plugin').val();
		event.notes = $('#fe_ee_notes').val();
		
		event.params = this.getPluginParamValues( event.plugin, force );
		if (!event.params) return false; // invalid
		
		if (!force) {
			if (!event.title.length) {
				return app.badField('#fe_ee_title', "Please enter a title for the event.");
			}
			if (!event.targets.length) {
				return app.badField('#fe_ee_targets', "Please select one or more targets to run the event.");
			}
		}
		
		return event;
	}
	
	onScrollDelay() {
		// called when user scrolls, with debounce
		switch (this.args.sub) {
			case 'list': this.handleScrollList(); break;
		}
	}
	
	onStatusUpdate(data) {
		// called every 1s from websocket
		switch (this.args.sub) {
			case 'list': this.handleStatusUpdateList(data); break;
			case 'view': this.handleStatusUpdateView(data); break;
		}
	}
	
	onDataUpdate(key, data) {
		// refresh list if events were updated
		if ((key == 'events') && (this.args.sub == 'list')) this.gosub_list(this.args);
		else if ((key == 'stats') && (this.args.sub == 'view')) {
			// recompute upcoming jobs every minute
			this.autoExpireUpcomingJobs();
			this.renderUpcomingJobs();
			this.updateJobHistoryDayGraph();
		}
	}
	
	onResize() {
		// called when page is resized
		if (this.wfZoom) this.renderWFConnections();
	}
	
	onDeactivate() {
		// called when page is deactivated
		if ((this.args.sub == 'new') || (this.args.sub == 'edit')) {
			this.checkSavePageDraft( this.get_event_form_json(true) );
		}
		
		delete this.jobs;
		delete this.event;
		delete this.upcomingJobs;
		delete this.upcomingOffset;
		delete this.activeOffset;
		delete this.queueOffset;
		delete this.revisionOffset;
		delete this.revisions;
		delete this.queuedJobs;
		
		delete this.workflow;
		delete this.wfScroll;
		delete this.wfZoom;
		delete this.wfSelection;
		
		// destroy charts if applicable (view page)
		if (this.charts) {
			for (var key in this.charts) {
				this.charts[key].destroy();
			}
			delete this.charts;
		}
		
		this.cleanupRevHistory();
		this.div.html( '' );
		return true;
	}
	
};
