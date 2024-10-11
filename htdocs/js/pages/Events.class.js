// Scheduler -- Events Config

Page.Events = class Events extends Page.Base {
	
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
		// app.setHeaderTitle( '<i class="mdi mdi-calendar-clock">&nbsp;</i>Scheduled Events' );
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show event list
		app.setWindowTitle( "Events" );
		app.setHeaderTitle( '<i class="mdi mdi-calendar-multiple">&nbsp;</i>Events' );
		
		// this.loading();
		// app.api.post( 'app/get_events', copy_object(args), this.receive_events.bind(this) );
		
		// reset max events (dynamic pagination)
		this.eventsPerPage = config.events_per_page;
		
		var events = app.events.filter( function(event) { return event.type != 'workflow'; } );
		
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
		
		var filter_opts = [
			{ id: '', title: 'All Events', icon: 'calendar-search' },
			{ id: 'z_enabled', title: 'Only Enabled', icon: 'checkbox-marked-outline' },
			{ id: 'z_disabled', title: 'Only Disabled', icon: 'checkbox-blank-outline' }
		].concat(
			this.buildOptGroup( app.categories, "Categories:", 'folder-open-outline', 'c_' ),
			this.buildOptGroup( app.groups, "Server Groups:", 'server-network', 'g_' ),
			this.buildOptGroup( app.plugins, "Plugins:", 'power-plug-outline', 'p_' ),
			this.buildOptGroup( app.tags, "Tags:", 'tag-outline', 't_' )
		);
		
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
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Event Title', 'Category', 'Plugin', 'Target', 'Timing', 'Status', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			// html += '<div class="header_search_widget"><i class="mdi mdi-magnify">&nbsp;</i><input type="text" size="15" placeholder="Search"/></div>';
			
			html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(\'#fe_ee_search\').focus()">&nbsp;</i><input type="text" id="fe_ee_search" placeholder="Filter" value="' + encode_attrib_entities(args.search ?? '') + '" onInput="$P().applyTableFilters(true)"/></div>';
			
			html += '<div class="box_title_widget" style="overflow:visible; min-width:120px; max-width:200px; font-size:13px;">' + this.getFormMenuSingle({
				id: 'fe_ee_filter',
				title: 'Filter event list',
				options: filter_opts,
				value: args.filter || '',
				onChange: '$P().applyTableFilters(true)',
				'data-shrinkwrap': 1
			}) + '</div>';
			
			html += 'Event List';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var grid_opts = {
			rows: this.events,
			cols: cols,
			data_type: 'event',
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
			actions.push( '<span class="link" onMouseUp="$P().do_confirm_run_event('+idx+')"><b>Run Now</b></span>' );
			// actions.push( '<span class="link" onMouseUp="$P().edit_event('+idx+')"><b>Edit</b></span>' );
			// actions.push( '<span class="link" onMouseUp="$P().go_event_stats('+idx+')"><b>Stats</b></span>' );
			// actions.push( '<span class="link" onMouseUp="$P().go_event_history('+idx+')"><b>History</b></span>' );
			// // actions.push( '<span class="link" onMouseUp="$P().delete_event('+idx+')"><b>Delete</b></span>' );
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggle_event_enabled(this,' + idx + ')'
				}) + '</div>',
				// '<div class="td_big">' + self.getNiceEvent(item, true) + '</div>',
				'<span style="font-weight:bold">' + self.getNiceEvent(item, true) + '</span>',
				self.getNiceCategory(item.category, true),
				self.getNicePlugin(item.plugin, true),
				self.getNiceTargetList(item.targets, ', ', 3),
				summarize_event_timings(item),
				
				'<div id="d_el_jt_status_' + item.id + '">' + self.getNiceEventStatus(item) + '</div>',
				
				// self.getNiceUser(item.username, true),
				// '<span title="'+self.getNiceDateTimeText(item.created)+'">'+self.getNiceDate(item.created)+'</span>',
				// action_html
				actions.join(' | ')
			];
			
			if (item.category != last_cat_id) {
				var is_hidden = !!(item.category in hidden_cats);
				tds.insertAbove = '<ul class="tr_event_category' + (is_hidden ? ' collapsed' : '') + '" id="tr_ee_cat_' + item.category + '" data-cat="' + item.category + '"><div style="grid-column-start: span ' + cols.length + ';" onClick="$P().toggle_category_collapse(this)"><i class="mdi mdi-' + (is_hidden ? 'folder-outline' : 'folder-open-outline') + '">&nbsp;</i>' + cat.title + '</div></ul>';
				last_cat_id = item.category;
			}
			
			if (!item.enabled) classes.push('disabled');
			if (cat.color) classes.push( 'clr_' + cat.color );
			if (classes.length) tds.className = classes.join(' ');
			return tds;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button secondary" onMouseUp="$P().edit_event(-1)">Add Event...</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		var is_floater_vis = !!this.div.find('.box_buttons.floater').length;
		
		this.div.html( html );
		this.applyTableFilters();
		this.setupBoxButtonFloater(is_floater_vis);
		SingleSelect.init( this.div.find('#fe_ee_filter') );
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
			nice_status = this.getNiceJobResultLink({ id: event_state.last_job, code: event_state.last_code });
		}
		
		return nice_status;
	}
	
	applyTableFilters(reset_max) {
		// filters and/or search query changed -- re-filter table
		var self = this;
		var args = this.args;
		var num_visible = 0, num_hidden = 0, num_paged = 0;
		
		// optionally reset the event max (dynamic paging)
		if (reset_max) this.eventsPerPage = config.events_per_page;
		
		args.search = $('#fe_ee_search').val();
		args.filter = $('#fe_ee_filter').val();
		if (!args.search.length) delete args.search;
		if (!args.filter.length) delete args.filter;
		var is_filtered = (('search' in args) || ('filter' in args));
		
		this.div.find('.box_content.table ul.grid_row').each( function(idx) {
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
		
		// do history.replaceState jazz here
		// don't mess up initial visit href
		var query = deep_copy_object(args);
		delete query.sub;
		
		var url = '#Events' + (num_keys(query) ? compose_query_string(query) : '');
		history.replaceState( null, '', url );
		Nav.loc = url;
		
		// magic trick: replace link in sidebar for Events
		$('#tab_Events').attr( 'href', url );
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
		var is_filtered = (('search' in args) || ('filter' in args));
		
		if (!is_filtered) {
			// no filters, so we can apply user collapse/expand logic here
			var hidden_cats = app.prefs.hidden_cats || {};
			if (hidden_cats[ item.category ]) return false; // hide (by user)
			return true; // show
		}
		
		if (('search' in args) && args.search.length) {
			var words = [item.title, item.username, item.notes].concat(item.targets).join(' ').toLowerCase();
			if (words.indexOf(args.search.toLowerCase()) == -1) return false; // hide
		}
		
		if (('filter' in args) && args.filter.match && args.filter.match(/^(\w)_(.+)$/)) {
			var mode = RegExp.$1;
			var value = RegExp.$2;
			switch (mode) {
				case 'z':
					if ((value == 'enabled') && !item.enabled) return false; // hide
					if ((value == 'disabled') && item.enabled) return false; // hide
				break;
				
				case 'c':
					if (item.category != value) return false; // hide
				break;
				
				case 'g':
					if (!item.targets.includes(value)) return false; // hide
				break;
				
				case 'p':
					if (item.plugin != value) return false; // hide
				break;
				
				case 't':
					if (!item.tags || !item.tags.includes(value)) return false; // hide
				break;
			} // switch mode
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
			
			if (item.enabled) $(elem).closest('tr').removeClass('disabled');
			else $(elem).closest('tr').addClass('disabled');
			
			$(elem).closest('tr').find('div.td_big').html( self.getNiceEvent(item, true) );
			
			app.showMessage('success', item.title + " was " + (item.enabled ? 'enabled' : 'disabled') + " successfully.");
		} );
	}
	
	do_confirm_run_event(idx) {
		// confirm user wants to run job
		var self = this;
		this.event = this.events[idx];
		app.clearError();
		
		Dialog.confirm( 'Run Event', "Are you sure you want to manually run the event &ldquo;" + this.event.title + "&rdquo;?", 'Run Now', function(result) {
			if (!result) return;
			self.run_event(idx);
		} ); // confirm
	}
	
	run_event(idx) {
		// run event from view page
		var self = this;
		this.event = this.events[idx];
		app.clearError();
		
		Dialog.showProgress( 1.0, "Launching Job..." );
		
		app.api.post( 'app/run_event', this.event, function(resp) {
			Dialog.hideProgress();
			app.showMessage('success', "The job was started successfully.");
			
			if (!self.active) return; // sanity
			
			// jump immediately to live details page
			Nav.go('Job?id=' + resp.id);
		} );
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
		var icon = event.icon || 'file-clock-outline';
		
		app.setHeaderNav([
			{ icon: 'calendar-multiple', loc: '#Events?sub=list', title: 'Events' },
			{ icon: icon, title: event.title }
		]);
		
		// app.setHeaderTitle( '<i class="mdi mdi-calendar-search">&nbsp;</i>Event Details' );
		app.setWindowTitle( "Viewing Event \"" + event.title + "\"" );
		
		html += '<div class="box">';
			html += '<div class="box_title">';
				// html += '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + event.title;
				if (!event.enabled) html += '<span style="color:var(--red);">Event Disabled</span>';
				else html += 'Event Summary';
				
				// html += '<div class="button right danger" onMouseUp="$P().show_delete_event_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i>Delete...</div>';
				html += '<div class="button secondary right" onMouseUp="$P().do_edit_from_view()"><i class="mdi mdi-file-edit-outline">&nbsp;</i>Edit Event...</div>';
				if (event.enabled) html += '<div class="button right" onMouseUp="$P().do_confirm_run_from_view()"><i class="mdi mdi-run-fast">&nbsp;</i>Run Now</div>';
				html += '<div class="clear"></div>';
			html += '</div>'; // title
			
			html += '<div class="box_content table">';
				html += '<div class="summary_grid">';
					
					// row 1
					html += '<div>';
						html += '<div class="info_label">Event ID</div>';
						html += '<div class="info_value monospace" style="font-weight:bold">' + event.id + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Event Title</div>';
						html += '<div class="info_value">' + this.getNiceEvent(event) + '</div>';
					html += '</div>';
				
					html += '<div>';
						html += '<div class="info_label">Category</div>';
						html += '<div class="info_value">' + this.getNiceCategory(event.category, true) + '</div>';
					html += '</div>';
				
					html += '<div>';
						html += '<div class="info_label">Timing</div>';
						html += '<div class="info_value"><i class="mdi mdi-calendar-multiselect">&nbsp;</i>' + summarize_event_timings(event) + '</div>';
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
						html += '<div class="info_value">' + this.getNiceTargetList(event.targets, ', ', 3) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Tags</div>';
						html += '<div class="info_value">' + this.getNiceTagList(event.tags, true, ', ') + '</div>';
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
					html += '<div class="info_label">Event Notes</div>';
					html += '<div class="info_value overflow" style="font-weight:normal; line-height:16px;">' + event.notes.replace(/\n/g, '<br>') + '</div>';
					html += '</div></div>';
				}
			html += '</div>'; // box content
		html += '</div>'; // box
		
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
				html += '<div class="button right danger" onMouseUp="$P().do_flush_queue()"><i class="mdi mdi-trash-can-outline">&nbsp;</i>Flush Queue</div>';
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
		html += '<div class="box" id="d_ve_graphs" style="display:none; margin-top:-56px; border-top:none;">';
			html += '<div class="box_content">';
				
				html += '<div style="margin-bottom:20px"><canvas id="c_ve_perf" class="chart" style="width:100%; height:250px;"></canvas></div>';
				
				html += '<div class="chart_grid_horiz">';
					html += '<div><canvas id="c_ve_cpu" class="chart"></canvas></div>';
					html += '<div><canvas id="c_ve_mem" class="chart"></canvas></div>';
					html += '<div><canvas id="c_ve_disk" class="chart"></canvas></div>';
					html += '<div><canvas id="c_ve_net" class="chart"></canvas></div>';
				html += '</div>';
			html += '</div>';
		html += '</div>';
		
		// upcoming jobs
		html += '<div class="box" id="d_ve_upcoming">';
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
		this.getUpcomingJobs();
		this.renderActiveJobs();
		this.getQueuedJobs();
		this.renderPluginParams('#d_ve_params');
		this.setupToggleBoxes();
		this.fetchRevisionHistory();
	}
	
	do_edit_from_view() {
		// jump to edit from view page
		Nav.go('#Events?sub=edit&id=' + this.event.id);
	}
	
	do_confirm_run_from_view() {
		// confirm user wants to run job
		var self = this;
		
		Dialog.confirm( 'Run Event', "Are you sure you want to manually run the current event?", 'Run Now', function(result) {
			if (!result) return;
			self.do_run_from_view();
		} ); // confirm
	}
	
	do_run_from_view() {
		// run event from view page
		var self = this;
		app.clearError();
		
		Dialog.showProgress( 1.0, "Launching Job..." );
		
		app.api.post( 'app/run_event', this.event, function(resp) {
			Dialog.hideProgress();
			app.showMessage('success', "The job was started successfully.");
			
			if (!self.active) return; // sanity
			
			// jump immediately to live details page
			Nav.go('Job?id=' + resp.id);
		} );
	}
	
	do_flush_queue() {
		// flush job queue after confirmation
		var self = this;
		var msg = 'Are you sure you want to flush the entire job queue?';
		
		Dialog.confirmDanger( 'Flush Job Queue', msg, 'Flush', function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Flushing Queue..." );
			
			app.api.post( 'app/flush_event_queue', { id: self.event.id }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "The job queue was successfully flushed.");
				if (!self.active) return; // sanity
				self.jobQueueNav(0);
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
				'<b>' + self.getNiceJob(job.id, true) + '</b>',
				self.getNiceJobState(job),
				self.getNiceJobSource(job),
				self.getNiceTargetList(job.targets),
				self.getShortDateTime( job.started ),
				self.getNiceJobElapsedTime(job, true),
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
		var rows = Object.values(app.activeJobs).filter( function(job) { return job.event == self.event.id } ).sort( function(a, b) {
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
				'<b>' + self.getNiceJob(job.id, true) + '</b>',
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
		Dialog.confirmDanger( 'Abort Job', "Are you sure you want to abort the job &ldquo;<b>" + id + "</b>&rdquo;?", 'Abort', function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Aborting Job..." );
			
			app.api.post( 'app/abort_job', { id: id }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "The job &ldquo;<b>" + id + "</b>&rdquo; was aborted successfully.");
			} ); // api.post
		} ); // confirm
	}
	
	handleStatusUpdateView(data) {
		// received status update from server, see if major or minor
		var self = this;
		var div = this.div;
		var bar_width = this.bar_width || 100;
		
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
				var counter = job.progress || 1;
				var cx = Math.floor( counter * bar_width );
				var label = '' + Math.floor( (counter / 1.0) * 100 ) + '%';
				var $cont = div.find('#d_ve_jt_progress_' + job.id + ' > div.progress_bar_container');
				
				if ((counter == 1.0) && !$cont.hasClass('indeterminate')) {
					$cont.addClass('indeterminate').attr('title', "");
				}
				else if ((counter < 1.0) && $cont.hasClass('indeterminate')) {
					$cont.removeClass('indeterminate');
				}
				
				if (counter < 1.0) $cont.attr('title', '' + Math.floor( (counter / 1.0) * 100 ) + '%');
				
				$cont.find('> div.progress_bar_inner').css( 'width', '' + cx + 'px' );
				$cont.find('div.progress_bar_label').html( label );
			} ); // foreach job
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
				'<b>' + self.getNiceJob(job.id, true) + '</b>',
				self.getNiceServer(job.server, true),
				self.getNiceJobSource(job),
				self.getShortDateTime( job.started ),
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
		});
		
		this.charts.cpu = this.createChart({
			"canvas": '#c_ve_cpu',
			"title": "CPU History",
			"dataType": "integer",
			"dataSuffix": "%"
		});
		
		this.charts.mem = this.createChart({
			"canvas": '#c_ve_mem',
			"title": "Memory History",
			"dataType": "bytes",
			"dataSuffix": ""
		});
		
		this.charts.disk = this.createChart({
			"canvas": '#c_ve_disk',
			"title": "I/O History",
			"dataType": "bytes",
			"dataSuffix": "/sec"
		});
		
		this.charts.net = this.createChart({
			"canvas": '#c_ve_net',
			"title": "Network History",
			"dataType": "bytes",
			"dataSuffix": "/sec"
		});
		
		var render_chart_overlay = function(key) {
			$('.pxc_tt_overlay').html(
				'<div class="chart_toolbar ct_' + key + '">' + 
					'<div class="chart_icon ci_di" title="Download Image" onClick="$P().chartDownload(\'' + key + '\')"><i class="mdi mdi-cloud-download-outline"></i></div>' + 
					'<div class="chart_icon ci_cl" title="Copy Image Link" onClick="$P().chartCopyLink(\'' + key + '\',this)"><i class="mdi mdi-clipboard-pulse-outline"></i></div>' + 
				'</div>' 
			);
		};
		
		this.charts.perf.on('mouseover', function(event) { render_chart_overlay('perf'); });
		this.charts.cpu.on('mouseover', function(event) { render_chart_overlay('cpu'); });
		this.charts.mem.on('mouseover', function(event) { render_chart_overlay('mem'); });
		this.charts.disk.on('mouseover', function(event) { render_chart_overlay('disk'); });
		this.charts.net.on('mouseover', function(event) { render_chart_overlay('net'); });
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
	
	getUpcomingJobs() {
		// predict and render upcoming jobs
		var self = this;
		var opts = {
			events: [ this.event ],
			duration: 86400 * 32,
			burn: 16,
			max: 1000,
			progress: null,
			callback: function(jobs) {
				self.upcomingJobs = jobs;
				self.renderUpcomingJobs();
			}
		};
		this.predictUpcomingJobs(opts);
	}
	
	renderUpcomingJobs() {
		// got jobs from prediction engine, so render them!
		var self = this;
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		if (!this.upcomingOffset) {
			this.upcomingOffset = 0;
			
			// show next run in summary
			if (this.upcomingJobs[0]) {
				this.div.find('#d_ve_next_run').html( this.getRelativeDateTime( this.upcomingJobs[0].epoch ) );
			}
			else {
				this.div.find('#d_ve_next_run').html('n/a');
			}
		}
		
		var grid_args = {
			resp: {
				rows: this.upcomingJobs.slice( this.upcomingOffset, this.upcomingOffset + this.args.limit ),
				list: { length: this.upcomingJobs.length }
			},
			cols: ['Event', 'Source', 'Scheduled Time', 'Countdown', 'Actions'],
			data_type: 'job',
			offset: this.upcomingOffset,
			limit: this.args.limit,
			class: 'data_grid event_job_upcoming_grid',
			pagination_link: '$P().jobUpcomingNav'
		};
		
		html += this.getPaginatedGrid( grid_args, function(job, idx) {
			var countdown = Math.max( 60, Math.abs(job.epoch - app.epoch) );
			var nice_source = (job.type == 'single') ? '<i class="mdi mdi-alarm-check">&nbsp;</i>Single Shot' : '<i class="mdi mdi-update">&nbsp;</i>Scheduler';
			
			return [
				self.getNiceEvent(job.event, false),
				nice_source,
				self.getShortDateTime( job.epoch ),
				'<i class="mdi mdi-clock-outline">&nbsp;</i>' + get_text_from_seconds( countdown, false, true ),
				'<span class="link danger" onClick="$P().doSkipUpcomingJob(' + idx + ')"><b>Skip Job...</b></span>'
				// '<a href="#Job?id=' + job.id + '">Details</a>'
			];
		} );
		
		this.div.find('#d_ve_upcoming > .box_content').removeClass('loading').html(html);
	}
	
	jobUpcomingNav(offset) {
		// user clicked on upcoming job pagination nav
		this.upcomingOffset = offset;
		this.div.find('#d_ve_upcoming > .box_content').addClass('loading');
		this.renderUpcomingJobs();
	}
	
	doSkipUpcomingJob(idx) {
		// add blackout range for upcoming job
		var self = this;
		var job = this.upcomingJobs[idx];
		var msg = 'Are you sure you want to skip the upcoming job at "' + self.getShortDateTimeText( job.epoch ) + '"?';
		
		switch (job.type) {
			case 'single': msg += '  Since this is a "Single Shot" timing rule, it will simply be disabled.'; break;
			case 'schedule': msg += '  Since this is a scheduled timing rule, a new "Blackout" range will be added to disable it.'; break;
		}
		
		Dialog.confirmDanger( 'Skip Upcoming Job', msg, 'Skip Job', function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Skipping Job..." );
			
			switch (job.type) {
				case 'single':
					delete_object( self.event.timings, { type: 'single', enabled: true, epoch: job.epoch } );
				break;
				
				case 'schedule':
					self.event.timings.push({ type: 'blackout', enabled: true, start: job.epoch, end: job.epoch }); // Note: end is inclusive!
				break;
			} // switch job.type
			
			app.api.post( 'app/update_event', { id: self.event.id, timings: self.event.timings }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "The selected upcoming job will be skipped.");
				
				if (!self.active) return; // sanity
				
				self.upcomingJobs.splice( idx, 1 );
				self.renderUpcomingJobs();
			} ); // api.post
		} ); // confirm
	}
	
	autoExpireUpcomingJobs() {
		// automatically remove upcoming jobs that upcame
		if (!this.upcomingJobs || !this.upcomingJobs.length) return;
		
		while (this.upcomingJobs.length && (this.upcomingJobs[0].epoch <= app.epoch)) {
			this.upcomingJobs.shift();
		}
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
		var btn = '<div class="button danger" onClick="$P().prepRollback(' + idx + ')">Rollback...</div>';
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
			
			var diff_html = this.getDiffHTML( old_event, new_event );
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
		
		this.rollbackEvent = item.event;
		Nav.go('Events?sub=edit&id=' + this.event.id + '&rollback=1');
	}
	
	gosub_new(args) {
		// create new event
		var html = '';
		var do_snap = true;
		
		app.setHeaderNav([
			{ icon: 'calendar-multiple', loc: '#Events?sub=list', title: 'Events' },
			{ icon: 'file-edit-outline', title: "New Event" }
		]);
		
		// app.setHeaderTitle( '<i class="mdi mdi-calendar-plus">&nbsp;</i>New Event' );
		app.setWindowTitle( "New Event" );
		
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
			html += '<div class="button" onMouseUp="$P().cancel_event_edit()">Cancel</div>';
			html += '<div class="button primary" onMouseUp="$P().do_new_event()"><i class="mdi mdi-floppy">&nbsp;</i>Create Event</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ee_icon, #fe_ee_cat, #fe_ee_algo, #fe_ee_plugin') );
		this.renderPluginParamEditor();
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
		
		Nav.go('Events?sub=list');
		app.showMessage('success', "The new event was created successfully.");
	}
	
	gosub_edit(args) {
		// edit event subpage
		this.loading();
		
		// app.api.post( 'app/get_event', { id: args.id }, this.receive_event.bind(this), this.fullPageError.bind(this) );
		var event = find_object( app.events, { id: args.id } );
		if (!event) return this.doFullPageError("Event not found: " + args.id);
		
		if (args.rollback && this.rollbackEvent) {
			event = this.rollbackEvent;
			delete this.rollbackEvent;
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
		
		this.limits = this.event.limits; // for res limit editor
		this.actions = this.event.actions; // for job action editor
		
		app.setHeaderNav([
			{ icon: 'calendar-multiple', loc: '#Events?sub=list', title: 'Events' },
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
			html += '<div class="button" onMouseUp="$P().cancel_event_edit()">Cancel</div>';
			html += '<div class="button danger" onMouseUp="$P().show_delete_event_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i>Delete Event...</div>';
			// html += '<div class="button" onMouseUp="$P().do_run_event()"><i class="mdi mdi-run-fast">&nbsp;</i>Run Event Now</div>';
			html += '<div class="button secondary" onMouseUp="$P().do_test_event()"><i class="mdi mdi-test-tube">&nbsp;</i>Test Event...</div>';
			html += '<div class="button primary" onMouseUp="$P().do_save_event()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		// lock ID for editing
		$('#fe_ee_id').attr('disabled', true);
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ee_icon, #fe_ee_cat, #fe_ee_algo, #fe_ee_plugin') );
		this.renderPluginParamEditor();
		// this.updateAddRemoveMe('#fe_ee_email');
		this.setupBoxButtonFloater();
		
		if (do_snap) this.savePageSnapshot( this.get_event_form_json(true) );
	}
	
	do_test_event() {
		// test event with temporary changes
		// Note: This may include unsaved changes, which are included in the on-demand run now job, by design
		app.clearError();
		var self = this;
		var event = this.get_event_form_json();
		if (!event) return; // error
		
		var html = '<div class="dialog_box_content">';
		
		html += this.getFormRow({
			label: 'Actions:',
			content: this.getFormCheckbox({
				id: 'fe_ete_actions',
				label: 'Enable All Actions',
				checked: false
			}),
			caption: 'Enable all event actions for the test run.'
		});
		
		html += this.getFormRow({
			label: 'Limits:',
			content: this.getFormCheckbox({
				id: 'fe_ete_limits',
				label: 'Enable All Limits',
				checked: false
			}),
			caption: 'Enable all resource limits for the test run.'
		});
		
		html += this.getFormRow({
			id: 'd_eja_email',
			label: 'Notify:',
			content: this.getFormText({
				id: 'fe_ete_email',
				spellcheck: 'false',
				maxlength: 8192,
				placeholder: 'email@sample.com',
				value: '',
				onChange: '$P().updateAddRemoveMe(this)'
			}),
			suffix: '<div class="form_suffix_icon mdi" title="" onMouseUp="$P().addRemoveMe(this)"></div>',
			caption: 'Optionally send the test results to one or more email addresses.'
		});
		
		html += '</div>';
		Dialog.confirm( "Test Event", html, "Run Event", function(result) {
			if (!result) return;
			
			var job = deep_copy_object(event);
			job.enabled = true; // override event disabled, so test actually runs
			
			if (!$('#fe_ete_actions').is(':checked')) {
				job.actions = [];
			}
			if (!$('#fe_ete_limits').is(':checked')) {
				job.limits = [];
			}
			
			var emails = $('#fe_ete_email').val().trim();
			if (emails.length) {
				if (!job.actions) job.actions = [];
				job.actions.push({
					enabled: true,
					trigger: 'complete',
					type: 'email',
					email: emails
				});
			}
			
			app.api.post( 'app/run_event', job, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "The job was started successfully.");
				
				if (!self.active) return; // sanity
				
				// jump immediately to live details page
				Nav.go('Job?id=' + resp.id);
			} );
			
			Dialog.hide();
		}); // Dialog.confirm
		
		this.updateAddRemoveMe('#fe_ete_email');
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
		// new event saved successfully
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
		
		Nav.go( 'Events?sub=view&id=' + this.event.id );
		app.showMessage('success', "The event was saved successfully.");
	}
	
	show_delete_event_dialog() {
		// show dialog confirming event delete action
		var self = this;
		
		// check for jobs first
		var event_jobs = find_objects( app.activeJobs, { event: this.event.id } );
		if (event_jobs.length) return app.doError("Sorry, you cannot delete a event that has active jobs running.");
		
		Dialog.confirmDanger( 'Delete Event', "Are you sure you want to <b>permanently delete</b> the event &ldquo;" + this.event.title + "&rdquo;?  There is no way to undo this action.", 'Delete', function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Event..." );
				app.api.post( 'app/delete_event', self.event, self.delete_event_finish.bind(self) );
			}
		} );
	}
	
	delete_event_finish(resp) {
		// finished deleting event
		var self = this;
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		this.deletePageSnapshot();
		this.deletePageDraft();
		
		Nav.go('Events?sub=list', 'force');
		app.showMessage('success', "The event &ldquo;" + this.event.title + "&rdquo; was deleted successfully.");
	}
	
	get_event_edit_html() {
		// get html for editing an event (or creating a new one)
		var html = '';
		var event = this.event;
		
		// title
		html += this.getFormRow({
			label: 'Event Title:',
			content: this.getFormText({
				id: 'fe_ee_title',
				spellcheck: 'false',
				onChange: '$P().suggestIDFromTitle()',
				value: event.title
			}),
			caption: 'Enter the title of the event, for display purposes.'
		});
		
		// event id
		html += this.getFormRow({
			label: 'Event ID:',
			content: this.getFormText({
				id: 'fe_ee_id',
				class: 'monospace',
				spellcheck: 'false',
				onChange: '$P().checkEventExists(this)',
				value: event.id
			}),
			suffix: '<div class="checker"></div>',
			caption: event.id ? 'This is the unique ID for the event, used by the Orchestra API.  It cannot be changed.' : 
				'Enter a unique ID for the event (alphanumerics only).  Once created this cannot be changed.'
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
			suffix: '<div class="form_suffix_icon mdi mdi-folder-plus-outline" title="Quick Add Category..." onMouseUp="$P().quickAddCategory()" onMouseDown="event.preventDefault();"></div>',
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
			suffix: '<div class="form_suffix_icon mdi mdi-tag-plus-outline" title="Quick Add Tag..." onMouseUp="$P().quickAddTag()" onMouseDown="event.preventDefault();"></div>',
			caption: 'Optionally select one or more tags for the event.  Each job can add its own tags at run time.'
		});
		
		// target(s)
		var target_items = this.buildOptGroup(app.groups, "Groups:", 'server-network');
		
		target_items = target_items.concat(
			this.buildOptGroup( sort_by(Object.values(app.servers), 'hostname').map( function(server) {
				return merge_objects( { title: server.hostname }, server );
			} ), "Servers:", 'router-network' )
		);
		
		html += this.getFormRow({
			label: 'Targets:',
			content: this.getFormMenuMulti({
				id: 'fe_ee_targets',
				title: 'Select targets to run the event',
				placeholder: 'Select targets for event...',
				options: target_items,
				values: event.targets,
				auto_add: true,
				// 'data-hold': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select which groups and/or servers to run the event.'
		});
		
		// algo
		var algo_items = [
			{ id:'random', title:"Random", icon:"dice-5-outline" },
			{ id:'round_robin', title:"Round Robin", icon:"radius-outline" },
			{ id:'prefer_first', title:"Prefer First (Alphabetically)", icon:"sort-ascending" },
			{ id:'prefer_last', title:"Prefer Last (Alphabetically)", icon:"sort-descending" },
			{ id:'least_cpu', title:"Least CPU Usage", icon:"chip" },
			{ id:'least_mem', title:"Least Memory Usage", icon:"memory" }
		].
		concat(
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
				options: app.plugins,
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
		
		// timings
		html += this.getFormRow({
			label: 'Timing Rules:',
			content: '<div id="d_ee_timing_table">' + this.getTimingTable() + '</div>',
			caption: 'Select when and how often your event should run, with options like catch-up, continuous and single shot.  Leave this section blank to run your event on-demand.'
		});
		
		// actions
		// (requires this.actions to be populated)
		html += this.getFormRow({
			label: 'Job Actions:',
			content: '<div id="d_ee_jobact_table">' + this.getJobActionTable() + '</div>',
			caption: 'Optionally select custom actions to perform for each job.  Actions may also be added at the category level.'
		});
		
		// default resource limits
		// (requires this.limits to be populated)
		html += this.getFormRow({
			label: 'Resource Limits:',
			content: '<div id="d_ee_reslim_table">' + this.getResLimitTable() + '</div>',
			caption: 'Optionally select resource limits to assign to jobs.  These will override limits set at the category level.'
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
		var btn = "Add Category";
		
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
			
			var id = title.toLowerCase().replace(/\W+/g, '_').replace(/^_+/, '').replace(/_+$/, '');
			if (!id.length) id = get_unique_id();
			while (find_object(app.categories, { id })) id += get_unique_id();
			
			var category = { id, title, enabled: true };
			app.categories.push(category);
			
			app.api.post( 'app/create_category', category, function() {
				app.showMessage('success', "The new category was created successfully.");
				
				if (!self.active) return; // sanity
				
				// append to the menu
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
		var btn = "Add Tag";
		
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
			
			var id = title.toLowerCase().replace(/\W+/g, '_').replace(/^_+/, '').replace(/_+$/, '');
			if (!id.length) id = get_unique_id();
			while (find_object(app.tags, { id })) id += get_unique_id();
			
			var tag = { id, title, enabled: true };
			app.tags.push(tag);
			
			app.api.post( 'app/create_tag', tag, function() {
				app.showMessage('success', "The new tag was created successfully.");
				
				if (!self.active) return; // sanity
				
				// append to the menu
				$('#fe_ee_tags').append( '<option value="' + id + '" data-icon="tag-outline" selected="selected">' + title + '</option>' ).trigger('change');
			} ); // api.post
			
			Dialog.hide();
		}); // Dialog.confirm
		
		$('#fe_etd_title').focus();
	}
	
	renderTimingTable() {
		// render res limit editor
		var html = this.getTimingTable();
		this.div.find('#d_ee_timing_table').html( html );
	}
	
	getSortedTimings() {
		// custom sort for display
		return [].concat(
			this.event.timings.filter( function(row) { return row.type == 'schedule'; } ),
			this.event.timings.filter( function(row) { return row.type == 'single'; } ),
			this.event.timings.filter( function(row) { return row.type == 'continuous'; } ),
			this.event.timings.filter( function(row) { return !(row.type || '').match(/^(schedule|continuous|single)$/); } )
		);
	}
	
	prepTimingDisplay(item) {
		// prep timing item for display
		var nice_icon = '';
		var nice_type = '';
		var nice_desc = '';
		
		switch (item.type) {
			case 'schedule':
				nice_icon = '<i class="mdi mdi-calendar-clock">&nbsp;</i>';
				nice_type = 'Schedule';
				nice_desc = '<i class="mdi mdi-update">&nbsp;</i>' + summarize_event_timing(item);
			break;
			
			case 'continuous':
				nice_icon = '<i class="mdi mdi-calendar-clock">&nbsp;</i>';
				nice_type = 'Schedule';
				nice_desc = '<i class="mdi mdi-all-inclusive">&nbsp;</i>Run Continuously';
			break;
			
			case 'single':
				nice_icon = '<i class="mdi mdi-calendar-clock">&nbsp;</i>';
				nice_type = 'Schedule';
				nice_desc = '<i class="mdi mdi-alarm-check">&nbsp;</i><b>Single Shot:</b> ' + summarize_event_timing(item);
			break;
			
			case 'catchup':
				nice_icon = '<i class="mdi mdi-cog-outline">&nbsp;</i>';
				nice_type = 'Option';
				nice_desc = '<i class="mdi mdi-run-fast">&nbsp;</i>Catch-Up';
			break;
			
			case 'destruct':
				nice_icon = '<i class="mdi mdi-cog-outline">&nbsp;</i>';
				nice_type = 'Option';
				nice_desc = '<i class="mdi mdi-fire">&nbsp;</i>Self-Destruct';
			break;
			
			case 'range':
				nice_icon = '<i class="mdi mdi-cog-outline">&nbsp;</i>';
				nice_type = 'Option';
				nice_desc = '<i class="mdi mdi-calendar-range-outline">&nbsp;</i><b>Range:</b> ' + this.summarizeTimingRange(item);
			break;
			
			case 'blackout':
				nice_icon = '<i class="mdi mdi-cog-outline">&nbsp;</i>';
				nice_type = 'Option';
				nice_desc = '<i class="mdi mdi-circle">&nbsp;</i><b>Blackout:</b> ' + this.summarizeTimingRange(item);
			break;
			
			case 'delay':
				nice_icon = '<i class="mdi mdi-cog-outline">&nbsp;</i>';
				nice_type = 'Option';
				nice_desc = '<i class="mdi mdi-chat-sleep-outline">&nbsp;</i><b>Delay:</b> ' + get_text_from_seconds(item.duration || 0, false, true);
			break;
		} // switch item.type
		
		return { nice_icon, nice_type, nice_desc };
	}
	
	getTimingTable() {
		// get html for timing table
		var self = this;
		var html = '';
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Type', 'Description', 'Actions'];
		var add_link = '<div class="button small secondary" onMouseUp="$P().editTiming(-1)">New Rule...</div>';
		
		// custom sort
		var rows = this.getSortedTimings();
		this.event.timings = rows; // for idx-based selections to work, we have to commit the sort
		
		var targs = {
			rows: rows,
			cols: cols,
			data_type: 'item',
			empty_msg: add_link,
			append: '<tr><td class="td_big" colspan="' + cols.length + '" style="text-align:center">' + add_link + '</td></tr>'
		};
		
		html += this.getCompactTable(targs, function(item, idx) {
			var actions = [];
			actions.push( '<span class="link" onMouseUp="$P().editTiming('+idx+')"><b>Edit</b></span>' );
			actions.push( '<span class="link danger" onMouseUp="$P().deleteTiming('+idx+')"><b>Delete</b></span>' );
			
			var { nice_icon, nice_type, nice_desc } = self.prepTimingDisplay(item);
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggleTimingEnabled(this,' + idx + ')'
				}) + '</div>',
				'<div class="td_big wrap_mobile">' + nice_icon + '<span class="link" onMouseUp="$P().editTiming('+idx+')">' + nice_type + '</span></div>',
				'<div>' + nice_desc + '</div>',
				'<span class="nowrap">' + actions.join(' | ') + '</span>'
			];
			
			if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getCompactTable
		
		return html;
	}
	
	summarizeTimingRange(timing) {
		// summarize date/time range, or single start/end
		var text = '';
		var tz = timing.timezone || app.config.tz;
		var opts = this.getDateOptions({
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			timeZone: tz
		});
		var formatter = new Intl.DateTimeFormat(opts.locale, opts);
		
		if (timing.start && timing.end) {
			// full range
			text = formatter.formatRange( new Date(timing.start * 1000), new Date(timing.end * 1000) );
		}
		else if (timing.start) {
			// start only
			text = "Start on " + formatter.format( new Date(timing.start * 1000) );
		}
		else if (timing.end) {
			// end only
			text = "End on " + formatter.format( new Date(timing.end * 1000) );
		}
		else return "n/a";
		
		// show timezone if it differs from user's current
		var ropts = Intl.DateTimeFormat().resolvedOptions();
		var user_tz = app.user.timezone || ropts.timeZone;
		if (user_tz != tz) text += ' (' + tz + ')';
		
		return text;
	}
	
	toggleTimingEnabled(elem, idx) {
		// toggle timing checkbox, actually do the enable/disable here, update row
		var item = this.event.timings[idx];
		item.enabled = !!$(elem).is(':checked');
		
		if (item.enabled) $(elem).closest('tr').removeClass('disabled');
		else $(elem).closest('tr').addClass('disabled');
	}
	
	editTiming(idx) {
		// show dialog to select timing
		var self = this;
		var new_item = { type: 'schedule', enabled: true, minutes: [0] };
		var timing = (idx > -1) ? this.event.timings[idx] : new_item;
		var title = (idx > -1) ? "Editing Timing Rule" : "New Timing Rule";
		var btn = (idx > -1) ? "Apply Changes" : "Add Rule";
		
		// if user's tz differs from server tz, pre-populate timezone menu with user's zone
		var ropts = Intl.DateTimeFormat().resolvedOptions();
		var user_tz = app.user.timezone || ropts.timeZone;
		if (user_tz != app.config.tz) new_item.timezone = user_tz;
		
		var html = '<div class="dialog_box_content maximize" style="max-height:75vh; overflow-x:hidden; overflow-y:auto;">';
		
		// status
		html += this.getFormRow({
			id: 'd_et_status',
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_et_enabled',
				label: 'Rule Enabled',
				checked: timing.enabled
			}),
			caption: 'Enable or disable this timing rule.'
		});
		
		// type (tmode)
		var tmode = '';
		switch (timing.type) {
			case 'schedule':
				tmode = 'hourly';
				if (timing.years && timing.years.length) tmode = 'custom';
				else if (timing.months && timing.months.length && timing.weekdays && timing.weekdays.length) tmode = 'custom';
				else if (timing.days && timing.days.length && timing.weekdays && timing.weekdays.length) tmode = 'custom';
				else if (timing.months && timing.months.length) tmode = 'yearly';
				else if (timing.weekdays && timing.weekdays.length) tmode = 'weekly';
				else if (timing.days && timing.days.length) tmode = 'monthly';
				else if (timing.hours && timing.hours.length) tmode = 'daily';
				else if (timing.minutes && timing.minutes.length) tmode = 'hourly';
			break;
			
			default:
				tmode = timing.type;
			break;
		} // switch timing.type
		
		html += this.getFormRow({
			id: 'd_et_type',
			label: 'Rule Type:',
			content: this.getFormMenuSingle({
				id: 'fe_et_type',
				title: "Select Timing Type",
				options: [ 
					{ id: 'custom', title: "Custom", icon: 'order-bool-descending' },
					{ id: 'yearly', title: "Yearly", icon: 'earth' },
					{ id: 'monthly', title: "Monthly", icon: 'calendar-month-outline' },
					{ id: 'weekly', title: "Weekly", icon: 'calendar-week-outline' },
					{ id: 'daily', title: "Daily", icon: 'calendar-today-outline' },
					{ id: 'hourly', title: "Hourly", icon: 'clock-outline' },
					{ id: 'crontab', title: "Crontab", icon: 'file-clock-outline' },
					{ id: 'continuous', title: "Continuous", icon: 'all-inclusive' },
					{ id: 'single', title: "Single Shot", icon: 'alarm-check' },
					
					{ id: 'catchup', title: "Catch-Up", icon: 'run-fast', group: "Options" },
					{ id: 'destruct', title: "Self-Destruct", icon: 'fire' },
					{ id: 'range', title: "Range", icon: 'calendar-range-outline' },
					{ id: 'blackout', title: "Blackout", icon: 'circle' },
					{ id: 'delay', title: "Delay", icon: 'chat-sleep-outline' }
				],
				value: tmode,
				'data-shrinkwrap': 1,
				'data-nudgeheight': 1
			}),
			caption: 'Select the desired type for the timing rule.'
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
				values: timing.years || [],
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
				values: timing.months || [],
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
				values: timing.weekdays || [],
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
				values: timing.days || [],
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
				values: timing.hours || [],
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
				values: timing.minutes || [],
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
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 64,
				value: ''
			}),
			caption: 'Use this to import event timing settings from a <a href="https://en.wikipedia.org/wiki/Cron#CRON_expression" target="_blank">Crontab expression</a>.  This is a string comprising five (or six) fields separated by white space that represents a set of dates/times.  Example: <b>30 4 1 * *</b> (First day of every month at 4:30 AM)'
		});
		
		// continuous
		html += this.getFormRow({
			id: 'd_et_continuous_desc',
			label: 'Description:',
			content: 'Add this timing rule to keep your job running continuously.  If it exits or crashes for any reason (besides a manual user abort), Orchestra will immediately start it up again.'
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
				value: timing.epoch ? this.formatDateISO( timing.epoch, this.getUserTimezone() ) : ''
			}),
			caption: 'Select a single date/time when the event should run in your local timezone (' + this.getUserTimezone() + ').  This can accompany other timing rules, or exist on its own.'
		});
		
		// catch-up
		html += this.getFormRow({
			id: 'd_et_catchup_desc',
			label: 'Description:',
			content: 'When Catch-Up Mode mode is enabled on an event, the scheduler will do its best to ensure that <i>every</i> scheduled job will run, even if they have to run late.  This is useful for time-sensitive events such as generating reports, and is designed to accompany other timing rules.'
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
		
		// self-destruct
		html += this.getFormRow({
			id: 'd_et_destruct_desc',
			label: 'Description:',
			content: 'Add this timing rule to automatically delete the event after the next job run.  This is designed to accompany other timing rules.'
		});
		
		// range
		html += this.getFormRow({
			id: 'd_et_range_desc',
			label: 'Description:',
			content: 'This option allows you to set a starting and/or ending date/time for the event.  Jobs will not be scheduled before your start date/time, nor after your end date/time.  This is designed to accompany other timing rules.'
		});
		
		// blackout
		html += this.getFormRow({
			id: 'd_et_blackout_desc',
			label: 'Description:',
			content: 'This option allows you to set a "blackout" period for the event, meaning jobs will not be scheduled during this time.  Examples include company holidays, and maintenance windows.  This is designed to accompany other timing rules.'
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
				value: timing.duration || 1
			}),
			caption: 'Specify your custom job starting delay in seconds.'
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
				value: timing.start ? this.formatDateISO( timing.start, this.getUserTimezone() ) : ''
			}),
			caption: 'Select a start date/time for the range in your local timezone(' + this.getUserTimezone() + ').'
		});
		html += this.getFormRow({
			id: 'd_et_range_end',
			label: 'End Date/Time:',
			content: this.getFormText({
				id: 'fe_et_range_end',
				type: 'datetime-local',
				spellcheck: 'false',
				autocomplete: 'off',
				value: timing.end ? this.formatDateISO( timing.end, this.getUserTimezone() ) : ''
			}),
			caption: 'Select an end date/time for the range in your local timezone (' + this.getUserTimezone() + ').'
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
				value: timing.timezone || ''
			}),
			caption: 'Select the desired timezone for the timing rule.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			timing = {
				enabled: $('#fe_et_enabled').is(':checked'),
				type: $('#fe_et_type').val()
			};
			switch (timing.type) {
				case 'custom':
					timing.type = 'schedule';
					if ($('#fe_et_years').val().length) timing.years = $('#fe_et_years').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_months').val().length) timing.months = $('#fe_et_months').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_weekdays').val().length) timing.weekdays = $('#fe_et_weekdays').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_days').val().length) timing.days = $('#fe_et_days').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_hours').val().length) timing.hours = $('#fe_et_hours').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_minutes').val().length) timing.minutes = $('#fe_et_minutes').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_tz').val().length) timing.timezone = $('#fe_et_tz').val();
				break;
				
				case 'yearly':
					timing.type = 'schedule';
					if ($('#fe_et_months').val().length) timing.months = $('#fe_et_months').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_days').val().length) timing.days = $('#fe_et_days').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_hours').val().length) timing.hours = $('#fe_et_hours').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_minutes').val().length) timing.minutes = $('#fe_et_minutes').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_tz').val().length) timing.timezone = $('#fe_et_tz').val();
				break;
				
				case 'monthly':
					timing.type = 'schedule';
					if ($('#fe_et_days').val().length) timing.days = $('#fe_et_days').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_hours').val().length) timing.hours = $('#fe_et_hours').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_minutes').val().length) timing.minutes = $('#fe_et_minutes').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_tz').val().length) timing.timezone = $('#fe_et_tz').val();
				break;
				
				case 'weekly':
					timing.type = 'schedule';
					if ($('#fe_et_weekdays').val().length) timing.weekdays = $('#fe_et_weekdays').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_days').val().length) timing.days = $('#fe_et_days').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_hours').val().length) timing.hours = $('#fe_et_hours').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_minutes').val().length) timing.minutes = $('#fe_et_minutes').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_tz').val().length) timing.timezone = $('#fe_et_tz').val();
				break;
				
				case 'daily':
					timing.type = 'schedule';
					if ($('#fe_et_hours').val().length) timing.hours = $('#fe_et_hours').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_minutes').val().length) timing.minutes = $('#fe_et_minutes').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_tz').val().length) timing.timezone = $('#fe_et_tz').val();
				break;
				
				case 'hourly':
					timing.type = 'schedule';
					if ($('#fe_et_minutes').val().length) timing.minutes = $('#fe_et_minutes').val().map( function(v) { return parseInt(v); } );
					if ($('#fe_et_tz').val().length) timing.timezone = $('#fe_et_tz').val();
				break;
				
				case 'crontab':
					timing.type = 'schedule';
					var cron_exp = $('#fe_et_crontab').val().toLowerCase();
					if (!cron_exp) return app.badField('#fe_et_crontab', "Please enter a crontab date/time expression.");
					
					// validate, convert to timing object
					var ctiming = null;
					try {
						ctiming = parse_crontab( cron_exp, $('#fe_ee_title').val() );
					}
					catch (e) {
						return app.badField('#fe_et_crontab', e.toString());
					}
					
					merge_hash_into(timing, ctiming);
					if ($('#fe_et_tz').val().length) timing.timezone = $('#fe_et_tz').val();
				break;
				
				case 'continuous':
					// continuous mode (no options)
					if ((idx == -1) && find_object(self.event.timings, { type: 'continuous' })) {
						return app.doError("Sorry, you can only have one continuous rule defined per event.");
					}
				break;
				
				case 'single':
					// single shot
					timing.epoch = self.parseDateTZ( $('#fe_et_single').val(), self.getUserTimezone() );
					if (!timing.epoch) return app.badField('#fe_et_single', "Please enter a valid date/time when the event should run.");
				break;
				
				case 'catchup':
					// time machine
					if ($('#fe_et_time_machine').val()) {
						self.event.update_state = {
							cursor: self.parseDateTZ( $('#fe_et_time_machine').val(), self.getUserTimezone() )
						};
					}
					if ((idx == -1) && find_object(self.event.timings, { type: 'catchup' })) {
						return app.doError("Sorry, you can only have one catch-up rule defined per event.");
					}
				break;
				
				case 'destruct':
					// self-destruct (no options)
					if ((idx == -1) && find_object(self.event.timings, { type: 'destruct' })) {
						return app.doError("Sorry, you can only have one self-destruct rule defined per event.");
					}
				break;
				
				case 'range':
					timing.start = self.parseDateTZ( $('#fe_et_range_start').val(), self.getUserTimezone() ) || 0;
					timing.end = self.parseDateTZ( $('#fe_et_range_end').val(), self.getUserTimezone() ) || 0;
					if (timing.start && timing.end && (timing.start > timing.end)) {
						return app.badField('#fe_et_range_start', "Invalid date range entered.  The start date cannot come after the end date.");
					}
					if ((idx == -1) && find_object(self.event.timings, { type: 'range' })) {
						return app.doError("Sorry, you can only have one date/time range defined per event.");
					}
				break;
				
				case 'blackout':
					timing.start = self.parseDateTZ( $('#fe_et_range_start').val(), self.getUserTimezone() ) || 0;
					timing.end = self.parseDateTZ( $('#fe_et_range_end').val(), self.getUserTimezone() ) || 0;
					if (!timing.start) return app.badField('#fe_et_range_start', "Please select both a start and an end for the range.");
					if (!timing.end) return app.badField('#fe_et_range_end', "Please select both a start and an end for the range.");
					if (timing.start > timing.end) return app.badField('#fe_et_range_start', "Invalid date range entered.  The start date cannot come after the end date.");
				break;
				
				case 'delay':
					// starting delay
					if ((idx == -1) && find_object(self.event.timings, { type: 'delay' })) {
						return app.doError("Sorry, you can only have one delay rule defined per event.");
					}
					timing.duration = parseInt( $('#fe_et_delay').val() );
					if (!timing.duration) return app.badField('#fe_et_delay', "Please enter or select the number of seconds to delay.");
				break;
			} // switch timing.type
			
			// see if we need to add or replace
			if (idx == -1) {
				self.event.timings.push(timing);
			}
			else self.event.timings[idx] = timing;
			
			// self.dirty = true;
			Dialog.hide();
			self.renderTimingTable();
		} ); // Dialog.confirm
		
		var change_timing_type = function(new_type) {
			$('.dialog_box_content .form_row').hide();
			$('#d_et_status, #d_et_type').show();
			
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
				
				case 'single':
					$('#d_et_single').show();
				break;
				
				case 'catchup':
					$('#d_et_catchup_desc').show();
					$('#d_et_time_machine').show();
				break;
				
				case 'destruct':
					$('#d_et_destruct_desc').show();
				break;
				
				case 'range':
					$('#d_et_range_desc').show();
					$('#d_et_range_start').show();
					$('#d_et_range_end').show();
				break;
				
				case 'blackout':
					$('#d_et_blackout_desc').show();
					$('#d_et_range_start').show();
					$('#d_et_range_end').show();
				break;
				
				case 'delay':
					$('#d_et_delay_desc').show();
					$('#d_et_delay').show();
				break;
			} // switch new_type
			
			app.clearError();
			Dialog.autoResize();
		}; // change_action_type
		
		$('#fe_et_type').on('change', function() {
			change_timing_type( $(this).val() );
		}); // type change
		
		SingleSelect.init( $('#fe_et_type, #fe_et_tz') );
		MultiSelect.init( $('#fe_et_years, #fe_et_months, #fe_et_weekdays, #fe_et_days, #fe_et_hours, #fe_et_minutes') );
		// this.updateAddRemoveMe('#fe_eja_email');
		
		change_timing_type( tmode );
	}
	
	resetTimeMachine() {
		// set time machine date/time to now
		$('#fe_et_time_machine').val( this.formatDateISO( time_now(), this.getUserTimezone() ) );
	}
	
	deleteTiming(idx) {
		// delete selected timing
		this.event.timings.splice( idx, 1 );
		this.renderTimingTable();
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
			// var label = ':' + this.formatDate( date.getTime() / 1000, { minute: '2-digit', timeZone: false } );
			options.push([ ''+options.length, label.trim() ]);
			date.setTime( date.getTime() + 60000 );
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
		var html = this.getPluginParamEditor();
		this.div.find('#d_ee_params').html( html );
	}
	
	getPluginParamEditor() {
		// get HTML for plugin param editor
		// { "id":"script", "type":"textarea", "title":"Script Source", "value": "#!/bin/sh\n\n# Enter your shell script code here" },
		var self = this;
		var html = '';
		var plugin_id = this.div.find('#fe_ee_plugin').val();
		var plugin = find_object( app.plugins, { id: plugin_id } );
		if (!plugin) return "(Could not locate Plugin definition: " + plugin_id + ")";
		if (!plugin.params.length) return '(The selected Plugin has no configurable parameters defined.)';
		
		plugin.params.forEach( function(param) {
			var elem_id = 'fe_ee_pp_' + param.id;
			var elem_value = (param.id in self.event.params) ? self.event.params[param.id] : param.value;
			var elem_dis = (param.locked && !app.isAdmin()) ? 'disabled' : undefined; 
			if (param.type == 'hidden') return;
			
			if (param.type != 'checkbox') html += '<div class="info_label">' + param.title + '</div>';
			html += '<div class="info_value">';
			
			switch (param.type) {
				case 'text':
					html += self.getFormText({ id: elem_id, value: elem_value, disabled: elem_dis });
				break;
				
				case 'textarea':
					html += self.getFormTextarea({ id: elem_id, value: elem_value, rows: 5, disabled: elem_dis });
				break;
				
				case 'checkbox':
					html += self.getFormCheckbox({ id: elem_id, label: param.title, checked: !!elem_value, disabled: elem_dis });
				break;
				
				case 'select':
					elem_value = (param.id in self.event.params) ? self.event.params[param.id] : param.value.replace(/\,.*$/, '');
					html += self.getFormMenu({ id: elem_id, value: elem_value, options: param.value.split(/\,\s*/), disabled: elem_dis });
				break;
			} // switch type
			
			html += '</div>';
		} ); // foreach param
		
		return html;
	}
	
	getPluginParamValues() {
		// get all values for params hash
		var params = {};
		var plugin_id = this.div.find('#fe_ee_plugin').val();
		var plugin = find_object( app.plugins, { id: plugin_id } );
		if (!plugin) return {}; // should never happen
		
		plugin.params.forEach( function(param) {
			if (param.type == 'hidden') params[ param.id ] = param.value;
			else if (param.type == 'checkbox') params[ param.id ] = !!$('#fe_ee_pp_' + param.id).is(':checked');
			else params[ param.id ] = $('#fe_ee_pp_' + param.id).val();
		});
		
		return params;
	}
	
	get_event_form_json(force) {
		// get api key elements from form, used for new or edit
		var event = this.event;
		
		event.id = $('#fe_ee_id').val().replace(/\W+/g, '').toLowerCase();
		event.title = $('#fe_ee_title').val().trim();
		event.enabled = $('#fe_ee_enabled').is(':checked') ? true : false;
		event.icon = $('#fe_ee_icon').val();
		event.category = $('#fe_ee_cat').val();
		event.tags = $('#fe_ee_tags').val();
		event.targets = $('#fe_ee_targets').val();
		event.algo = $('#fe_ee_algo').val();
		event.plugin = $('#fe_ee_plugin').val();
		event.params = this.getPluginParamValues();
		event.notes = $('#fe_ee_notes').val();
		
		if (!force) {
			if (!event.id.length) {
				return app.badField('#fe_ee_id', "Please enter a unique alphanumeric ID for the event.");
			}
			if (!event.title.length) {
				return app.badField('#fe_ee_title', "Please enter a title for the event.");
			}
			if (!event.targets.length) {
				return app.badField('#fe_ee_targets', "Please select one or more targets to run the event.");
			}
		}
		
		return event;
	}
	
	checkEventExists(field) {
		// check if event exists, update UI checkbox
		// called after field changes
		var $field = $(field);
		var id = trim( $field.val().toLowerCase() );
		var $elem = $field.closest('.form_row').find('.fr_suffix .checker');
		
		if (id.match(/^\w+$/)) {
			// check with cache
			if (find_object(app.events, { id: id })) {
				// event taken
				$elem.css('color','red').html('<span class="mdi mdi-event-circle"></span>').attr('title', "Event ID is taken.");
				$field.addClass('warning');
			}
			else {
				// event is valid and available!
				$elem.css('color','green').html('<span class="mdi mdi-check-circle"></span>').attr('title', "Event ID is available!");
				$field.removeClass('warning');
			}
		}
		else if (id.length) {
			// bad id
			$elem.css('color','red').html('<span class="mdi mdi-alert-decagram"></span>').attr('title', "Event ID is malformed.");
			$field.addClass('warning');
		}
		else {
			// empty
			$elem.html('').removeAttr('title');
			$field.removeClass('warning');
		}
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
		
		// destroy charts if applicable (view page)
		if (this.charts) {
			for (var key in this.charts) {
				this.charts[key].destroy();
			}
			delete this.charts;
		}
		
		this.div.html( '' );
		return true;
	}
	
};
