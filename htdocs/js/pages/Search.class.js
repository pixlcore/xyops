Page.Search = class Search extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		var self = this;
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		if (!args.offset) args.offset = 0;
		if (!args.limit) args.limit = 25;
		
		app.showSidebar(true);
		
		var preset = args.preset ? find_object( app.user.searches, { name: args.preset } ) : null;
		
		if (preset) {
			// load preset
			for (var key in preset) {
				if (!args[key]) args[key] = preset[key];
			}
			delete args.name;
			delete args.icon;
			
			// possibly highlight search preset tab
			app.highlightTab( 'Search_' + args.preset.replace(/\W+/g, '') );
			
			// expand section if applicable
			var $sect = $('#tab_Search_' + args.preset.replace(/\W+/g, '')).parent().prev();
			if ($sect.length && $sect.hasClass('section_title')) app.page_manager.expandSidebarGroup( $sect );
			
			var icon = preset.icon || '';
			if (!icon) icon = 'magnify';
			
			app.setWindowTitle( args.preset );
			app.setHeaderTitle( '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + args.preset );
		}
		else {
			// default search
			delete args.preset;
			app.setWindowTitle('Job Search');
			app.setHeaderTitle( '<i class="mdi mdi-cloud-search-outline">&nbsp;</i>Job Search' );
		}
		
		var html = '';
		html += '<div class="box" style="border:none;">';
		html += '<div class="box_content" style="padding:20px;">';
			
			// search box
			html += '<div class="search_box">';
				html += '<i class="mdi mdi-magnify" onMouseUp="$(\'#fe_s_query\').focus()">&nbsp;</i>'; // TODO: fix search help url below:
				html += '<div class="search_help"><a href="https://github.com/jhuckaby/orchestra#search" target="_blank">Search Help<i class="mdi mdi-open-in-new"></i></a></div>';
				html += '<input type="text" id="fe_s_query" maxlength="128" placeholder="Search Job Result Codes..." value="' + escape_text_field_value(args.query || '') + '">';
			html += '</div>';
			
			// options
			html += '<div id="d_s_adv" class="form_grid" style="margin-bottom:25px">';
				
				// result
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-check-circle-outline">&nbsp;</i>Result:',
						content: this.getFormMenuSingle({
							id: 'fe_s_result',
							title: 'Select Result',
							placeholder: 'Any Result',
							options: [
								['', 'Any Result'], 
								{ id: 'success', title: 'Success', icon: 'check-circle-outline' },
								{ id: 'error', title: 'Failure', icon: 'alert-decagram-outline' },
								{ id: 'warning', title: 'Warning', icon: 'alert-circle-outline' },
								{ id: 'critical', title: 'Critical', icon: 'fire-alert' },
								{ id: 'abort', title: 'Abort', icon: 'cancel' },
							],
							value: args.result || '',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// event
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-calendar-clock">&nbsp;</i>Event:',
						content: this.getFormMenuSingle({
							id: 'fe_s_event',
							title: 'Select Event',
							placeholder: 'All Events',
							options: [['', 'Any Event']].concat( app.events.filter( function(event) { return event.type != 'workflow'; } ) ),
							value: args.event || '',
							default_icon: 'calendar-clock',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// workflow
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-clipboard-flow-outline">&nbsp;</i>Workflow:',
						content: this.getFormMenuSingle({
							id: 'fe_s_workflow',
							title: 'Select Workflow',
							placeholder: 'All Workflows',
							options: [['', 'Any Workflow']].concat( app.events.filter( function(event) { return event.type == 'workflow'; } ) ),
							value: args.workflow || '',
							default_icon: 'clipboard-flow-outline',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// tags
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-tag-multiple-outline">&nbsp;</i>Tags:',
						content: this.getFormMenuMulti({
							id: 'fe_s_tags',
							title: 'Select Tags',
							placeholder: 'Any Tag',
							options: app.tags.concat([ 
								{ id: '_retried', title: "Retried", icon: 'refresh', group: "System Tags:" },
								{ id: '_last', title: "Last in Set", icon: 'page-last' } 
							]),
							values: args.tags ? args.tags.split(/\,\s*/) : [],
							default_icon: 'tag-outline',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// source
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-label-multiple-outline">&nbsp;</i>Source:',
						content: this.getFormMenuSingle({
							id: 'fe_s_source',
							title: 'Select Source',
							placeholder: 'Any Source',
							options: [
								['', 'Any Source'], 
								{ id: 'scheduler', title: "Scheduler", icon: 'update' },
								{ id: 'user', title: "Manual (User)", icon: 'account' },
								{ id: 'key', title: "Manual (API Key)", icon: 'key' },
								{ id: 'action', title: "Action Trigger", icon: 'eye-outline' },
								{ id: 'alert', title: "Server Alert", icon: 'bell-outline' },
								{ id: 'workflow', title: "Workflow", icon: 'clipboard-flow-outline' }
							],
							value: args.source || '',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// category
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-folder-open-outline">&nbsp;</i>Category:',
						content: this.getFormMenuSingle({
							id: 'fe_s_category',
							title: 'Select Category',
							placeholder: 'All Categories',
							options: [['', 'Any Category']].concat( app.categories ),
							value: args.category || '',
							default_icon: 'folder-open-outline',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// plugin
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-power-plug-outline">&nbsp;</i>Plugin:',
						content: this.getFormMenuSingle({
							id: 'fe_s_plugin',
							title: 'Select Plugin',
							placeholder: 'All Plugins',
							options: [['', 'Any Plugin']].concat( app.plugins ),
							value: args.plugin || '',
							default_icon: 'power-plug-outline',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// server
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-router-network">&nbsp;</i>Server:',
						content: this.getFormMenuSingle({
							id: 'fe_s_server',
							title: 'Select Server',
							placeholder: 'All Servers',
							options: [['', 'Any Server']].concat( sort_by(Object.values(app.servers), 'hostname').map( function(server) {
								return merge_objects( { title: server.hostname }, server );
							} ) ),
							value: args.server || '',
							default_icon: 'router-network',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// date
				html += '<div class="form_cell">';
					var date_items = [
						['', 'All Dates'],
						['now', 'This Hour'],
						['lasthour', 'Last Hour'],
						['today', 'Today'],
						['yesterday', 'Yesterday'],
						['month', 'This Month'],
						['lastmonth', 'Last Month'],
						['year', 'This Year'],
						['lastyear', 'Last Year'],
						['older', 'Older']
					];
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-calendar-multiple">&nbsp;</i>Date Range:',
						content: this.getFormMenuSingle({
							id: 'fe_s_date',
							title: 'Date Range',
							options: date_items.map( function(item) { 
								return item[0] ? { id: item[0], title: item[1], icon: 'calendar-range' } : item; 
							} ),
							value: args.date,
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// sort
				html += '<div class="form_cell">';
					var sort_items = [
						{ id: 'date_desc', title: 'Newest to Oldest', icon: 'sort-descending' },
						{ id: 'date_asc', title: 'Oldest to Newest', icon: 'sort-ascending' }
					];
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-sort">&nbsp;</i>Sort Results:',
						content: this.getFormMenuSingle({
							id: 'fe_s_sort',
							title: 'Sort Results',
							options: sort_items,
							value: args.sort,
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
			html += '</div>'; // form_grid
		
		// buttons at bottom
		html += '<div class="box_buttons" style="padding:0">';
			// html += '<div class="search_help"><a href="http://source.dev.ca.admission.net/doc/codepress/#searching" target="_blank">Search Help<i class="mdi mdi-open-in-new"></i></a></div>';
			
			// html += '<div id="btn_s_adv" class="button mobile_collapse" onMouseUp="$P().toggleAdvanced()"><i class="mdi mdi-tune-variant">&nbsp;</i><span>' + (options_open ? 'Hide Options' : 'Show Options') + '</span></div>';
			
			if (preset) {
				html += '<div class="button danger mobile_collapse" onMouseUp="$P().doDeletePreset()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete Preset...</span></div>';
			}
			html += '<div id="btn_s_save" class="button secondary mobile_collapse" onMouseUp="$P().doSavePreset()"><i class="mdi mdi-floppy">&nbsp;</i><span>' + (preset ? 'Edit' : 'Save') + ' Preset...</span></div>';
			// html += '<div class="button" id="btn_s_download" onMouseUp="$P().doDownload()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i>Download All...</div>';
			html += '<div class="button primary" onMouseUp="$P().navSearch()"><i class="mdi mdi-magnify">&nbsp;</i>Search</div>';
			// html += '<div class="clear"></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		html += '<div id="d_search_results"><div class="loading_container"><div class="loading"></div></div></div>';
		
		this.div.html( html );
		
		var sargs = this.getSearchArgs();
		// if (!sargs) this.div.find('#btn_s_save').addClass('disabled');
		
		MultiSelect.init( this.div.find('#fe_s_tags') );
		SingleSelect.init( this.div.find('#fe_s_result, #fe_s_event, #fe_s_source, #fe_s_date, #fe_s_category, #fe_s_plugin, #fe_s_server, #fe_s_workflow, #fe_s_sort') );
		// $('.header_search_widget').hide();
		
		this.div.find('#fe_s_tags, #fe_s_result, #fe_s_event, #fe_s_source, #fe_s_date, #fe_s_category, #fe_s_plugin, #fe_s_server, #fe_s_workflow, #fe_s_sort').on('change', function() {
			self.navSearch();
		});
		
		$('#fe_s_query').on('keydown', function(event) {
			// capture enter key
			if (event.keyCode == 13) {
				event.preventDefault();
				self.navSearch();
			}
		});
		
		$('#fe_s_query').focus();
		this.doSearch();
		
		return true;
	}
	
	getSearchArgs() {
		// get form values, return search args object
		var args = {};
		
		var query = this.div.find('#fe_s_query').val().trim()
		if (query.length) args.query = query;
		
		var tags = this.div.find('#fe_s_tags').val();
		if (tags.length) args.tags = tags.join(',');
		
		var result = this.div.find('#fe_s_result').val();
		if (result) args.result = result;
		
		var event = this.div.find('#fe_s_event').val();
		if (event) args.event = event;
		
		var source = this.div.find('#fe_s_source').val();
		if (source) args.source = source;
		
		var category = this.div.find('#fe_s_category').val();
		if (category) args.category = category;
		
		var plugin = this.div.find('#fe_s_plugin').val();
		if (plugin) args.plugin = plugin;
		
		var server = this.div.find('#fe_s_server').val();
		if (server) args.server = server;
		
		var workflow = this.div.find('#fe_s_workflow').val();
		if (workflow) args.workflow = workflow;
		
		var date = this.div.find('#fe_s_date').val();
		if (date) args.date = date;
		
		var sort = this.div.find('#fe_s_sort').val();
		if (sort != 'date_desc') args.sort = sort;
		
		if (!num_keys(args)) return null;
		
		return args;
	}
	
	navSearch() {
		// convert form into query and redirect
		app.clearError();
		
		var args = this.getSearchArgs();
		if (!args) {
			// return app.badField('#fe_s_query', "Please enter a search query.");
			// args = { query: '*' };
			Nav.go( this.selfNav({}) );
			return;
		}
		
		// save editing state across searches
		if (this.args.preset) args.preset = this.args.preset;
		
		Nav.go( this.selfNav(args) );
	}
	
	getSearchQuery(args) {
		// construct actual unbase simple query syntax
		var query = args.query ? args.query.toString().toLowerCase().trim() : '';
		if (args.tags) query += ' tags:' + args.tags.split(/\,\s*/).join('&');
		
		switch (args.result) {
			case 'success': query += ' tags:_success'; break;
			case 'error': query += ' tags:_error'; break;
			
			case 'warning':
			case 'critical':
			case 'abort':
				query += ' code:' + args.result;
			break;
		}
		
		if (args.event) query += ' event:' + args.event;
		if (args.source) query += ' source:' + args.source;
		if (args.category) query += ' category:' + args.category;
		if (args.plugin) query += ' plugin:' + args.plugin;
		if (args.server) query += ' server:' + args.server;
		if (args.workflow) query += ' workflow:' + args.workflow;
		
		if (args.date) {
			query += ' ' + this.getDateRangeQuery('date', args.date);
		}
		
		return query.trim();
	}
	
	doSearch() {
		// actually perform the search
		var args = this.args;
		var query = this.getSearchQuery(args);
		
		// compose search query
		this.records = [];
		this.opts = {
			query: query.trim(),
			offset: args.offset || 0,
			limit: args.limit || config.items_per_page,
			compact: 1
		};
		switch (args.sort) {
			case 'date_asc':
				this.opts.sort_by = 'completed'; 
				this.opts.sort_dir = 1;
			break;
			
			case 'date_desc':
				this.opts.sort_by = 'completed'; 
				this.opts.sort_dir = -1;
			break;
		} // sort
		
		app.api.get( 'app/search_jobs', this.opts, this.receiveResults.bind(this) );
	}
	
	receiveResults(resp) {
		// receive search results
		var self = this;
		var $results = this.div.find('#d_search_results');
		var html = '';
		
		if (!this.active) return; // sanity
		
		// massage the DB search resp so that things are happy
		// resp.rows = resp.records;
		// resp.list = { length: resp.total };
		
		this.lastSearchResp = resp;
		this.jobs = [];
		if (resp.rows) this.jobs = resp.rows;
		
		var grid_args = {
			resp: resp,
			cols: ['Job ID', 'Event', 'Category', 'Server', 'Source', 'Started', 'Elapsed', 'Result'],
			data_type: 'job',
			offset: this.args.offset || 0,
			limit: this.args.limit,
			class: 'data_grid job_search_grid',
			pagination_link: '$P().searchPaginate'
		};
		
		html += '<div class="box">';
		
		html += '<div class="box_title">';
			html += this.getSearchArgs() ? 'Search Results' : 'All Completed Jobs';
			html += '<div class="clear"></div>';
		html += '</div>';
		
		html += '<div class="box_content table">';
		
		html += this.getPaginatedGrid( grid_args, function(job, idx) {
			return [
				'<b>' + self.getNiceJob(job.id, true) + '</b>',
				self.getNiceEvent(job.event, true),
				self.getNiceCategory(job.category, true),
				self.getNiceServer(job.server, true),
				self.getNiceJobSource(job),
				self.getShortDateTime( job.started ),
				self.getNiceJobElapsedTime(job, true, false),
				self.getNiceJobResult(job)
			];
		} );
		
		if (this.jobs.length && app.hasPrivilege('delete_jobs')) {
			html += '<div style="margin-top: 30px;">';
			html += '<div class="button right danger" onMouseUp="$P().do_bulk_delete()"><i class="mdi mdi-trash-can-outline">&nbsp;</i>Delete Results...</div>';
			html += '<div class="clear"></div>';
			html += '</div>';
		}
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		$results.html( html );
	}
	
	do_bulk_delete() {
		// start bulk delete job after danger confirmation
		var total = this.lastSearchResp.list.length;
		var args = this.args;
		var query = this.getSearchQuery(args);
		
		Dialog.confirmDanger( 'Delete All Results', "Are you sure you want to <b>permanently delete</b> all " + commify(total) + " search results?", 'Delete All', function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Starting Bulk Delete..." );
			
			app.api.post( 'app/bulk_search_delete_jobs', { query: query }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "Your bulk delete job was started in the background.  You can monitor its progress on the Dashboard.", 8, '#Dashboard');
			} ); // api.post
		} ); // confirm
	}
	
	searchPaginate(offset) {
		// special hook for intercepting pagination clicks
		// FUTURE: history.replaceState to update the URI with new offset
		this.args.offset = offset;
		this.div.find('#d_search_results .box_content').addClass('loading');
		this.doSearch();
	}
	
	doSavePreset() {
		// save search preset
		var self = this;
		app.clearError();
		
		var sargs = this.getSearchArgs() || {};
		// if (!sargs) return app.badField('#fe_s_query', "Please enter a search query before saving a preset.");
		
		var preset = {};
		if (this.args.preset) {
			preset = find_object( app.user.searches, { name: this.args.preset } ) || {};
		}
		
		var html = '';
		html += '<div class="box_content" style="padding-bottom:15px;">';
		
		html += this.getFormRow({
			label: 'Preset Name:',
			content: this.getFormText({
				id: 'fe_sp_name',
				spellcheck: 'false',
				maxlength: 64,
				disabled: !!preset.name,
				value: preset.name || ''
			}),
			caption: preset.name ? 'You are editing an existing search preset.' : 'Enter a title for your search preset (this will show in the sidebar).'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_sp_icon',
				title: 'Select icon for preset',
				placeholder: 'Select icon for preset...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: preset.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for your search preset.'
		});
		
		html += '</div>';
		Dialog.confirm( preset.name ? 'Edit Search Preset' : 'Save Search Preset', html, preset.name ? 'Save Changes' : 'Save Preset', function(result) {
			if (!result) return;
			
			preset = sargs;
			preset.name = $('#fe_sp_name').val().trim();
			preset.icon = $('#fe_sp_icon').val();
			
			if (!preset.name) return app.badField('#fe_sp_name', "Please enter a name for the search preset before saving.");
			
			var idx = find_object_idx(app.user.searches, { name: preset.name });
			if (idx > -1) {
				// replace
				app.user.searches[idx] = preset;
			}
			else {
				// add new
				app.user.searches.push( preset );
			}
			
			Dialog.showProgress( 1.0, "Saving preset..." );
			
			app.api.post( 'app/user_settings', {
				searches: app.user.searches
			}, 
			function(resp) {
				// save complete
				Dialog.hideProgress();
				app.showMessage('success', "Your search preset was saved successfully.");
				
				if (!self.active) return; // sanity
				
				app.initSidebarTabs();
				Nav.go( self.selfNav({ preset: preset.name }), true );
			} ); // api resp
		} ); // Dialog.confirm
		
		$('#fe_sp_name').focus();
		SingleSelect.init( $('#fe_sp_icon') );
	}
	
	doDeletePreset() {
		// delete search preset, after confirmation
		var self = this;
		var preset_idx = find_object_idx( app.user.searches, { name: this.args.preset } );
		if (preset_idx == -1) return; // sanity
		var preset = app.user.searches[preset_idx];
		
		var msg = "Are you sure you want to delete the search preset &ldquo;<b>" + encode_entities(preset.name) + "</b>&rdquo;?  You cannot undo this action.";
		
		Dialog.confirmDanger( 'Delete Search Preset', msg, 'Delete Preset', function(result) {
			if (result) {
				app.user.searches.splice( preset_idx, 1 );
				Dialog.showProgress( 1.0, "Saving settings..." );
				
				app.api.post( 'app/user_settings', {
					searches: app.user.searches
				}, 
				function(resp) {
					// save complete
					Dialog.hideProgress();
					app.showMessage('success', "Your search preset was successfully deleted.");
					
					if (!self.active) return; // sanity
					
					app.initSidebarTabs();
					Nav.go('Search');
				} ); // api resp
			} // confirmed
		} ); // Dialog.confirm
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
