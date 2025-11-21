// Job Search Page

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Search = class Search extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.bar_width = 200;
	}
	
	onActivate(args) {
		// page activation
		var self = this;
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		if (!args.offset) args.offset = 0;
		if (!args.limit) args.limit = config.items_per_page;
		
		app.showSidebar(true);
		
		var preset = find_object( app.user.searches, { uri: Nav.currentAnchor() } );
		
		if (preset) {
			// possibly highlight search preset tab
			app.highlightTab( 'Search_' + preset.name.replace(/\W+/g, '') );
			
			// expand section if applicable
			var $sect = $('#tab_Search_' + preset.name.replace(/\W+/g, '')).parent().prev();
			if ($sect.length && $sect.hasClass('section_title')) app.page_manager.expandSidebarGroup( $sect );
			
			var icon = preset.icon || '';
			if (!icon) icon = 'magnify';
			
			app.setWindowTitle( preset.name );
			app.setHeaderTitle( '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + preset.name );
		}
		else {
			// default search
			app.setWindowTitle('Job Search');
			app.setHeaderTitle( '<i class="mdi mdi-cloud-search-outline">&nbsp;</i>Job Search' );
		}
		
		var html = '';
		html += '<div class="box" style="border:none;">';
		html += '<div class="box_content" style="padding:20px;">';
			
			// search box
			html += '<div class="search_box">';
				html += '<i class="mdi mdi-magnify" onClick="$(\'#fe_s_match\').focus()">&nbsp;</i>';
				// html += '<div class="search_help"><a href="https://github.com/pixlcore/xyops#search" target="_blank">Search Help<i class="mdi mdi-open-in-new"></i></a></div>';
				html += '<input type="text" id="fe_s_match" maxlength="128" placeholder="Search Job Files..." value="' + escape_text_field_value(args.match || '') + '">';
				// html += '<div class="search_widget"><i class="mdi mdi-checkbox-marked">&nbsp;</i>RegExp</div>';
				// html += '<div class="search_widget"><i class="mdi mdi-checkbox-marked">&nbsp;</i>Case</div>';
				html += '<div id="d_search_opt_case" class="search_widget ' + (args.case ? 'selected' : '') + '" title="Case Sensitive" onClick="$P().toggleSearchOption(this)"><i class="mdi mdi-format-letter-case"></i></div>';
				html += '<div id="d_search_opt_regex" class="search_widget ' + (args.regex ? 'selected' : '') + '" title="Regular Expression" onClick="$P().toggleSearchOption(this)"><i class="mdi mdi-regex"></i></div>';
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
								{ id: 'warning', title: 'Warning', icon: 'alert-outline' },
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
							options: [['', 'Any Event']].concat( this.getCategorizedEvents() ),
							value: args.event || '',
							default_icon: 'calendar-clock',
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
				
				// tag
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-tag-multiple-outline">&nbsp;</i>Tags:',
						content: this.getFormMenuMulti({
							id: 'fe_s_tags',
							title: 'Select Tags',
							placeholder: 'Any Tag',
							options: [['', 'Any Tag']].concat( app.tags, [ 
								{ id: '_retried', title: "Retried", icon: 'refresh', group: "System Tags:" },
								{ id: '_last', title: "Last in Set", icon: 'page-last' },
								{ id: '_test', title: "Test Job", icon: 'test-tube' }
							]),
							values: args.tags ? args.tags.split(/\,\s*/) : [],
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
								{ id: 'workflow', title: "Workflow", icon: 'clipboard-play-outline' },
								{ id: 'action', title: "Job Action", icon: 'gesture-tap' },
								{ id: 'alert', title: "Server Alert", icon: 'bell-outline' },
								{ id: 'plugin', title: "Plugin", icon: 'power-plug' }
							],
							value: args.source || '',
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
							options: [['', 'Any Plugin']]
								.concat( app.plugins.filter( function(plugin) { return plugin.type == 'event'; } ) )
								.concat([ { id: "_workflow", title: "Workflow", icon: "clipboard-flow-outline", group: "Special" } ]),
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
							options: [['', 'Any Server']].concat( this.getCategorizedServers(true) ),
							value: args.server || '',
							default_icon: 'router-network',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// group
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-server-network">&nbsp;</i>Group:',
						content: this.getFormMenuSingle({
							id: 'fe_s_group',
							title: 'Select Group',
							placeholder: 'All Groups',
							options: [['', 'Any Group']].concat( app.groups ),
							value: args.group || '',
							default_icon: 'server-network',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// date
				html += '<div class="form_cell">';
					var date_items = config.ui.date_range_menu_items;
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-calendar-multiple">&nbsp;</i>Date Range:',
						content: this.getFormMenuSingle({
							id: 'fe_s_date',
							title: 'Date Range',
							options: date_items.map( function(item) { 
								return item[0] ? { id: item[0], title: item[1], icon: 'calendar-range' } : item; 
							} ).concat([ { id: 'custom', title: 'Custom...', icon: 'cog-outline' } ]),
							value: args.date,
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// sort
				html += '<div class="form_cell">';
					var sort_items = [
						{ id: 'date_desc', title: 'Newest on Top', icon: 'sort-descending' },
						{ id: 'date_asc', title: 'Oldest on Top', icon: 'sort-ascending' }
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
			html += '<div id="btn_search_opts" class="button phone_collapse" onClick="$P().toggleSearchOpts()"><i>&nbsp;</i><span>Options<span></div>';
			html += '<div id="btn_s_reset" class="button phone_collapse" style="display:none" onClick="$P().resetFilters()"><i class="mdi mdi-undo-variant">&nbsp;</i>Reset</div>';
			
			if (preset) {
				html += '<div class="button danger phone_collapse" onClick="$P().doDeletePreset()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete Preset...</span></div>';
			}
			html += '<div id="btn_s_save" class="button secondary phone_collapse" onClick="$P().doSavePreset()"><i class="mdi mdi-floppy">&nbsp;</i><span>' + (preset ? 'Edit' : 'Save') + ' Preset...</span></div>';
			// html += '<div class="button" id="btn_s_download" onClick="$P().doDownload()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i>Download All...</div>';
			html += '<div class="button primary" onClick="$P().navSearch(true)"><i class="mdi mdi-magnify">&nbsp;</i>Search</div>';
			// html += '<div class="clear"></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		html += '<div id="d_search_results"><div class="loading_container"><div class="loading"></div></div></div>';
		
		this.div.html( html );
		
		// var sargs = this.getSearchArgs();
		// if (!sargs) this.div.find('#btn_s_save').addClass('disabled');
		
		MultiSelect.init( this.div.find('#fe_s_tags') );
		SingleSelect.init( this.div.find('#fe_s_result, #fe_s_event, #fe_s_source, #fe_s_date, #fe_s_category, #fe_s_plugin, #fe_s_server, #fe_s_group, #fe_s_sort') );
		// $('.header_search_widget').hide();
		this.setupSearchOpts();
		
		this.div.find('#fe_s_date').on('change', function() {
			if (this.value == 'custom') self.showDateRangePicker( self.navSearch.bind(self) );
			else self.navSearch();
		});
		
		this.div.find('#fe_s_tags, #fe_s_result, #fe_s_event, #fe_s_source, #fe_s_category, #fe_s_plugin, #fe_s_server, #fe_s_group, #fe_s_sort').on('change', function() {
			self.navSearch();
		});
		
		$('#fe_s_match').on('keydown', function(event) {
			// capture enter key
			if (event.keyCode == 13) {
				event.preventDefault();
				self.navSearch(true);
			}
		});
		
		setTimeout( function() { 
			// do this in another thread to ensure that Nav.loc is updated
			// not to mention user_nav
			self.doSearch();
		}, 1 );
		
		return true;
	}
	
	toggleSearchOption(elem) {
		// toggle search opt (case or regex) on/off
		var $elem = $(elem);
		if ($elem.hasClass('selected')) $elem.removeClass('selected');
		else $elem.addClass('selected');
	}
	
	resetFilters() {
		// reset all filters to default and re-search
		Nav.go( this.selfNav({}) );
	}
	
	getSearchArgs() {
		// get form values, return search args object
		var args = {};
		
		var match = this.div.find('#fe_s_match').val().trim()
		if (match.length) {
			args.match = match;
			
			if (this.div.find('#d_search_opt_case').hasClass('selected')) args.case = 1;
			if (this.div.find('#d_search_opt_regex').hasClass('selected')) args.regex = 1;
		}
		
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
		
		var group = this.div.find('#fe_s_group').val();
		if (group) args.group = group;
		
		var date = this.div.find('#fe_s_date').val();
		if (date) {
			args.date = date;
			if (date == 'custom') {
				args.start = this.args.start || yyyy_mm_dd(0, '-');
				args.end = this.args.end || yyyy_mm_dd(0, '-');
			}
		}
		
		var sort = this.div.find('#fe_s_sort').val();
		if (sort != 'date_desc') args.sort = sort;
		
		if (!num_keys(args)) return null;
		
		return args;
	}
	
	navSearch(force = false) {
		// convert form into query and redirect
		app.clearError();
		
		var args = this.getSearchArgs();
		if (!args) {
			// args = { query: '*' };
			Nav.go( this.selfNav({}) );
			return;
		}
		
		Nav.go( this.selfNav(args), force );
	}
	
	getSearchQuery(args) {
		// construct actual unbase simple query syntax
		var query = '';
		if (args.tags) query += ' tags:' + args.tags.split(/\,\s*/).join(' ');
		
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
		if (args.group) query += ' groups:' + args.group;
		
		if (args.date) {
			query += ' ' + this.getDateRangeQuery('date', args.date);
		}
		
		return query.trim();
	}
	
	doSearch() {
		// actually perform the search
		var args = this.args;
		var query = this.getSearchQuery(args);
		var match = this.div.find('#fe_s_match').val().trim();
		
		if (query) this.div.find('#btn_s_reset').show();
		else this.div.find('#btn_s_reset').hide();
		
		// compose search query
		var sopts = {
			query: query,
			offset: args.offset || 0,
			limit: args.limit || config.items_per_page,
			compact: 1
		};
		switch (args.sort) {
			case 'date_asc':
				sopts.sort_by = 'completed'; 
				sopts.sort_dir = 1;
			break;
			
			case 'date_desc':
				sopts.sort_by = 'completed'; 
				sopts.sort_dir = -1;
			break;
		} // sort
		
		if (match.length) {
			// search inside job files
			if (args.regex) sopts.regex = true;
			if (args.case) sopts.case = true;
			
			// validate user's regexp
			if (sopts.regex) {
				try { new RegExp(match); }
				catch (err) {
					this.div.find('#d_search_results').empty(); // remove loading indicator
					return app.badField('fe_s_match', "" + err);
				}
			}
			
			sopts.max = config.items_per_page;
			sopts.match = match;
			sopts.loc = Nav.loc; // for race condition with user_nav
			
			delete sopts.limit;
			delete sopts.compact;
			
			this.doSearchJobFiles(sopts);
		}
		else {
			// standard job search
			app.api.get( 'app/search_jobs', sopts, this.receiveResults.bind(this) );
		}
	}
	
	doSearchJobFiles(sopts) {
		// start websocket spooling search job
		var self = this;
		var $results = this.div.find('#d_search_results');
		var html = '';
		
		var gopts = {
			rows: [],
			cols: ['Job ID', 'Event', 'File', 'Preview', 'Matches', 'Job Completed'],
			data_type: 'file',
			// grid_template_columns: 'min-content' + ' auto'.repeat( cols.length - 1 )
		};
		
		html += '<div class="box">';
		
		html += '<div class="box_title">';
			html += this.getNiceJobProgressBar({ progress: 0 }, ['right']);
			html += 'Job File Results';
			html += '<div class="clear"></div>';
		html += '</div>';
		
		html += '<div class="box_content table">';
			html += this.getBasicGrid(gopts, function() {});
			html += '<div class="loading_container streaming"><div class="loading"></div></div>';
		html += '</div>'; // box_content
		
		html += '</div>'; // box
		
		$results.html( html );
		var $grid_row_empty = $results.find('ul.grid_row_empty').detach();
		
		// { query, match, regex?, case?, offset?, max?, sort_by?, sort_dir? }
		this.jobFileSearch = { opts: sopts, count: 0, uniques: {}, $grid_row_empty };
		app.comm.sendCommand('search_job_files', sopts);
	}
	
	handleJobFileSearchStart(pdata) {
		// job file search has started!
		// { id }
		this.jobFileSearch.id = pdata.id;
	}
	
	handleJobFileSearchResult(pdata) {
		// job file search result has spooled in
		// { id, job, event, completed, file, filename, preview, count, token }
		var $results = this.div.find('#d_search_results');
		var jfs = this.jobFileSearch;
		
		// generate unique id for each row, because of the "load more" offset overlap thing
		var row_id = pdata.job + '/' + pdata.file;
		if (row_id in jfs.uniques) return; // dupe row
		jfs.uniques[row_id] = 1;
		jfs.count++;
		
		// massage preview
		if (pdata.preview.before.length == 25) pdata.preview.before = '&hellip;' + pdata.preview.before;
		if (pdata.preview.after.length == 25) pdata.preview.after += '&hellip;';
		
		// construct our row
		// ['Job ID', 'Event', 'Filename', 'Preview', 'Matches', 'Job Completed']
		var nice_file = '';
		if (pdata.file.match(/^logs\/jobs\//)) {
			var url = app.base_api_url + '/app/view_job_log?id=' + pdata.job + '&t=' + pdata.token;
			nice_file = this.getNiceFile( 'Job Output', url, 'file-document-outline');
		}
		else {
			nice_file = this.getNiceFile( pdata.filename, '/' + pdata.file);
		}
		
		var tds = [
			'<b>' + this.getNiceJob( pdata.job, true ) + '</b>',
			'<b>' + this.getNiceJobEvent( pdata, true ) + '</b>',
			'<b>' + nice_file + '</b>',
			
			'<span class="mono">' + pdata.preview.before + '</span>' + 
				'<span class="mono bold">' + pdata.preview.matched + '</span>' + 
				'<span class="mono">' + pdata.preview.after + '</span>',
			
			commify( pdata.count ),
			this.getRelativeDateTime( pdata.completed, true )
		];
		
		var html = '';
		html += '<ul class="grid_row ' + (tds.className || '') + '"' + '>';
		html += '<div>' + tds.join('</div><div>') + '</div>';
		html += '</ul>';
		
		// append it
		$results.find('div.data_grid').append( html );
		
		// update table header (# of matches)
		$results.find('.data_grid_pagination > div').first().html( commify(jfs.count) + ' ' + pluralize('file', jfs.count) );
	}
	
	updateJobFileSearchProgress() {
		// update progress bar by sniffing out the internal job that is controlling our search
		var $results = this.div.find('#d_search_results');
		var id = this.jobFileSearch.id;
		var job = app.internalJobs[id];
		if (job) this.updateJobProgressBar(job, $results.find('.box_title .progress_bar_container'));
	}
	
	handleJobFileSearchComplete(pdata) {
		// job file search has completed
		// { id, offset, hit_max }
		delete this.jobFileSearch.id;
		var $results = this.div.find('#d_search_results');
		
		$results.find('.box_title .progress_bar_container').hide();
		$results.find('.box_content .loading_container').hide();
		
		// was anything found at all?
		if (!this.jobFileSearch.count) {
			$results.find('div.data_grid').append( this.jobFileSearch.$grid_row_empty );
		}
		
		// we need to know if the search is DONE DONE, or just "hit max done"
		else if (pdata.hit_max) {
			var html = '<div class="load_more"><div class="button" onClick="$P().loadMoreFileResults()"><i class="mdi mdi-arrow-down-circle-outline">&nbsp;</i>Load More...</div></div>';
			$results.find('.box_content').append(html);
			this.jobFileSearch.opts.offset = pdata.offset; // resume at last offset
		}
	}
	
	loadMoreFileResults() {
		// user clicked the "load more" button
		var $results = this.div.find('#d_search_results');
		
		$results.find('.box_title .progress_bar_container').show();
		$results.find('.box_content .loading_container').show();
		$results.find('.box_content .load_more').remove();
		
		var sopts = this.jobFileSearch.opts;
		app.comm.sendCommand('search_job_files', sopts);
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
			cols: ['Job ID', 'Event', 'Category', 'Server', 'Source', 'Tags', 'Completed', 'Elapsed', 'Result'],
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
			var tds = [
				'<b>' + self.getNiceJob(job, true) + '</b>',
				self.getNiceJobEvent(job, true),
				self.getNiceCategory(job.category, true),
				self.getNiceServer(job.server, true),
				self.getNiceJobSource(job),
				self.getNiceTagList( job.tags, false ),
				self.getRelativeDateTime( job.completed, true ),
				self.getNiceJobElapsedTime(job, true, false),
				self.getNiceJobResult(job)
			];
			
			if (job.category) {
				var category = find_object( app.categories, { id: job.category } );
				if (category && category.color) tds.className = 'clr_' + category.color;
			}
			
			return tds;
		} );
		
		if (this.jobs.length && app.hasPrivilege('delete_jobs')) {
			html += '<div style="margin-top: 30px;">';
			html += '<div class="button right danger" onClick="$P().do_bulk_delete()"><i class="mdi mdi-trash-can-outline">&nbsp;</i>Delete All...</div>';
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
		
		Dialog.confirmDanger( 'Delete All Results', "Are you sure you want to <b>permanently delete</b> all " + commify(total) + " search results?", ['trash-can', 'Delete All'], function(result) {
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
		
		// var sargs = this.getSearchArgs() || {};
		var preset = find_object( app.user.searches, { uri: Nav.currentAnchor() } ) || {};
		
		var html = '';
		html += '<div class="box_content" style="padding-bottom:15px;">';
		
		html += this.getFormRow({
			label: 'Preset Name:',
			content: this.getFormText({
				id: 'fe_sp_name',
				spellcheck: 'false',
				maxlength: 64,
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
		
		var title = preset.name ? 'Edit Search Preset' : 'Save Search Preset';
		var btn = ['floppy', preset.name ? 'Save Changes' : 'Save Preset'];
		
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			
			preset = { uri: Nav.currentAnchor() };
			preset.name = $('#fe_sp_name').val().trim();
			preset.icon = $('#fe_sp_icon').val();
			
			if (!preset.name) return app.badField('#fe_sp_name', "Please enter a name for the search preset before saving.");
			
			var idx = find_object_idx(app.user.searches, { uri: preset.uri });
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
				Nav.go( preset.uri, true );
			} ); // api resp
		} ); // Dialog.confirm
		
		if (!preset.name) $('#fe_sp_name').focus();
		SingleSelect.init( $('#fe_sp_icon') );
	}
	
	doDeletePreset() {
		// delete search preset, after confirmation
		var self = this;
		var preset_idx = find_object_idx( app.user.searches, { uri: Nav.currentAnchor() } );
		if (preset_idx == -1) return; // sanity
		var preset = app.user.searches[preset_idx];
		
		if (preset.uri === 'Search') return app.doError("Sorry, you cannot delete the default search preset.");
		
		var msg = "Are you sure you want to delete the search preset &ldquo;<b>" + encode_entities(preset.name) + "</b>&rdquo;?  You cannot undo this action.";
		
		Dialog.confirmDanger( 'Delete Search Preset', msg, ['trash-can', 'Delete Preset'], function(result) {
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
	
	onStatusUpdate(data) {
		// refresh search results if jobsChanged
		if (data.jobsChanged) this.doSearch();
		if (this.jobFileSearch && this.jobFileSearch.id) this.updateJobFileSearchProgress();
	}
	
	onPageUpdate(pcmd, pdata) {
		// received update for page
		if (!this.active) return; // sanity
		
		switch (pcmd) {
			case 'search_started': this.handleJobFileSearchStart(pdata); break;
			case 'search_result': this.handleJobFileSearchResult(pdata); break;
			case 'search_complete': this.handleJobFileSearchComplete(pdata); break;
		}
	}
	
	onDeactivate() {
		// called when page is deactivated
		delete this.jobFileSearch;
		this.div.html( '' );
		return true;
	}
	
};
