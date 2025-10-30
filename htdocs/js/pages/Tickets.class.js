// Tickets Page

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Tickets = class Tickets extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'search';
		this.bar_width = 100;
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		if (!args.sub && (args.id || args.num)) args.sub = 'view';
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		// app.setHeaderTitle( '<i class="mdi mdi-text-box-multiple">&nbsp;</i>Tickets' );
		
		// this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_search(args) {
		// search tickets
		var self = this;
		if (!args.offset) args.offset = 0;
		if (!args.limit) args.limit = config.items_per_page;
		
		var preset = find_object( app.user.searches, { uri: Nav.currentAnchor() } );
		
		if (preset) {
			// possibly highlight search preset tab
			app.highlightTab( 'Tickets_' + preset.name.replace(/\W+/g, '') );
			
			// expand section if applicable
			var $sect = $('#tab_Tickets_' + preset.name.replace(/\W+/g, '')).parent().prev();
			if ($sect.length && $sect.hasClass('section_title')) app.page_manager.expandSidebarGroup( $sect );
			
			var icon = preset.icon || '';
			if (!icon) icon = 'magnify';
			
			app.setWindowTitle( preset.name );
			app.setHeaderTitle( '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + preset.name );
		}
		else {
			// default search
			app.setWindowTitle('Ticket Search');
			app.setHeaderTitle( '<i class="mdi mdi-text-box-search-outline">&nbsp;</i>Ticket Search' );
		}
		
		var html = '';
		html += '<div class="box" style="border:none;">';
		html += '<div class="box_content" style="padding:20px;">';
			
			// search box
			html += '<div class="search_box">';
				html += '<i class="mdi mdi-magnify" onClick="$(\'#fe_s_query\').focus()">&nbsp;</i>';
				// html += '<div class="search_help"><a href="http://source.dev.ca.admission.net/doc/codepress/#searching" target="_blank">Search Help<i class="mdi mdi-open-in-new"></i></a></div>';
				html += '<input type="text" id="fe_s_query" maxlength="128" placeholder="Enter search query..." value="' + escape_text_field_value(args.query || '') + '">';
			html += '</div>';
			
			// options
			html += '<div id="d_s_adv" class="form_grid" style="margin-bottom:25px">';
				
				// type
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-text-box-multiple-outline">&nbsp;</i>Type:',
						content: this.getFormMenuSingle({
							id: 'fe_s_type',
							title: 'Select Type',
							placeholder: 'All Types',
							options: [['', 'Any Type']].concat( config.ui.ticket_types ),
							value: args.type || '',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// assigned (single for search)
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-account-supervisor">&nbsp;</i>Assigned To:',
						content: this.getFormMenuSingle({
							id: 'fe_s_assignee',
							title: 'Select Assignee',
							placeholder: 'Any User',
							options: [['', 'Any User']].concat( app.users.map( function(user) { 
								return { 
									id: user.username, 
									title: user.full_name,
									icon: user.icon || 'account'
								}; 
							} ) ),
							value: (args.assignee === 'self') ? app.username : (args.assignee || ''),
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// username
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-account-supervisor">&nbsp;</i>Author:',
						content: this.getFormMenuSingle({
							id: 'fe_s_username',
							title: 'Select Username',
							placeholder: 'Any User',
							options: [['', 'Any User']].concat( app.users.map( function(user) { 
								return { 
									id: user.username, 
									title: user.full_name,
									icon: user.icon || 'account'
								}; 
							} ) ),
							value: (args.username === 'self') ? app.username : (args.username || ''),
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// status
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-label-multiple-outline">&nbsp;</i>Status:',
						content: this.getFormMenuSingle({
							id: 'fe_s_status',
							title: 'Select Status',
							placeholder: 'Any Status',
							options: [['', 'Any Status']].concat( config.ui.ticket_statuses ),
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
				
				// tags
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-tag-multiple-outline">&nbsp;</i>Tags:',
						content: this.getFormMenuMulti({
							id: 'fe_s_tags',
							title: 'Select Tags',
							placeholder: 'Any Tag',
							options: app.tags,
							values: args.tags ? args.tags.split(/\,\s*/) : [],
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
		SingleSelect.init( this.div.find('#fe_s_type, #fe_s_assignee, #fe_s_username, #fe_s_status, #fe_s_category, #fe_s_server, #fe_s_date, #fe_s_sort') );
		// $('.header_search_widget').hide();
		this.setupSearchOpts();
		
		this.div.find('#fe_s_date').on('change', function() {
			if (this.value == 'custom') self.showDateRangePicker( self.navSearch.bind(self) );
			else self.navSearch();
		});
		
		this.div.find('#fe_s_tags, #fe_s_type, #fe_s_assignee, #fe_s_username, #fe_s_status, #fe_s_category, #fe_s_server, #fe_s_date, #fe_s_sort').on('change', function() {
			self.navSearch();
		});
		
		$('#fe_s_query').on('keydown', function(event) {
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
	}
	
	resetFilters() {
		// reset all filters to default and re-search
		Nav.go( this.selfNav({}) );
	}
	
	getSearchArgs() {
		// get form values, return search args object
		var args = {};
		
		var query = this.div.find('#fe_s_query').val().trim()
		if (query.length) args.query = query;
		
		var tags = this.div.find('#fe_s_tags').val();
		if (tags.length) args.tags = tags.join(',');
		
		var assignee = this.div.find('#fe_s_assignee').val();
		if (assignee) args.assignee = assignee;
		
		var username = this.div.find('#fe_s_username').val();
		if (username) args.username = username;
		
		var status = this.div.find('#fe_s_status').val();
		if (status) args.status = status;
		
		var category = this.div.find('#fe_s_category').val();
		if (category) args.category = category;
		
		var server = this.div.find('#fe_s_server').val();
		if (server) args.server = server;
		
		var type = this.div.find('#fe_s_type').val();
		if (type) args.type = type;
		
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
		var query = args.query ? args.query.toString().toLowerCase().trim() : ''; //  : 'status:open|closed'; // omit drafts
		if (args.tags) query += ' tags:' + args.tags.split(/\,\s*/).join('&');
		if (args.type) query += ' type:' + args.type;
		if (args.assignee) query += ' assignees:' + args.assignee;
		if (args.username) query += ' username:' + args.username;
		if (args.status) query += ' status:' + args.status;
		if (args.category) query += ' category:' + args.category;
		if (args.server) query += ' server:' + args.server;
		
		if (args.tag) query += ' tags:' + args.tag;
		
		if (args.date) {
			query += ' ' + this.getDateRangeQuery('date', args.date);
		}
		
		return query.trim();
	}
	
	doSearch() {
		// actually perform the search
		var args = this.args;
		var query = this.getSearchQuery(args);
		
		if (query) this.div.find('#btn_s_reset').show();
		else this.div.find('#btn_s_reset').hide();
		
		// compose search query
		var sopts = {
			query: query || '*',
			offset: args.offset || 0,
			limit: args.limit || config.items_per_page,
			compact: 1
		};
		switch (args.sort) {
			case 'date_asc':
				sopts.sort_by = '_id'; 
				sopts.sort_dir = 1;
			break;
			
			case 'date_desc':
				sopts.sort_by = '_id'; 
				sopts.sort_dir = -1;
			break;
		} // sort
		
		app.api.get( 'app/search_tickets', sopts, this.receiveResults.bind(this) );
	}
	
	receiveResults(resp) {
		// receive search results
		var self = this;
		var $results = this.div.find('#d_search_results');
		var html = '';
		
		if (!this.active) return; // sanity
		
		this.lastSearchResp = resp;
		this.tickets = [];
		if (resp.rows) this.tickets = resp.rows;
		
		var grid_args = {
			resp: resp,
			cols: ['#', 'Subject', 'Type', 'Status', 'Assignees', 'Tags', 'Created', 'Actions'],
			data_type: 'ticket',
			offset: this.args.offset || 0,
			limit: this.args.limit,
			pagination_link: '$P().searchPaginate'
		};
		
		html += '<div class="box">';
		
		html += '<div class="box_title">';
			html += this.getSearchArgs() ? 'Search Results' : 'All Tickets';
			html += '<div class="clear"></div>';
		html += '</div>';
		
		html += '<div class="box_content table">';
		
		html += this.getPaginatedGrid( grid_args, function(ticket, idx) {
			var actions = [
				'<a href="#' + ticket.num + '"><b>View</b></a>',
				'<span class="link" onClick="$P().delete_ticket('+idx+')"><b>Delete</b></span>'
			];
			
			return [
				'<div class="monospace">#' + ticket.num + '</div>',
				self.getNiceTicket(ticket, true),
				self.getNiceTicketType(ticket.type),
				self.getNiceTicketStatus(ticket.status),
				self.getNiceUserList( ticket.assignees, app.isAdmin() ),
				self.getNiceTagList( ticket.tags, false ),
				self.getRelativeDateTime( ticket.created, true ),
				'<span class="nowrap">' + actions.join(' | ') + '</span>'
			];
		} );
		
		if (this.tickets.length && app.hasPrivilege('delete_tickets')) {
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
			
			app.api.post( 'app/bulk_search_delete_tickets', { query: query }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "Your bulk delete job was started in the background.  You can monitor its progress on the Dashboard.", 8, '#Dashboard');
			} ); // api.post
		} ); // confirm
	}
	
	delete_ticket(idx) {
		// delete ticket
		this.ticket = this.tickets[idx];
		this.show_delete_ticket_dialog();
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
		
		if (preset.uri === 'Tickets') return app.doError("Sorry, you cannot delete the default ticket search preset.");
		
		var msg = "Are you sure you want to delete the ticket search preset &ldquo;<b>" + encode_entities(preset.name) + "</b>&rdquo;?  You cannot undo this action.";
		
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
	
	//
	// New Ticket
	//
	
	gosub_new(args) {
		// create new ticket
		var html = '';
		app.setWindowTitle( "New Ticket" );
		app.setHeaderNav([ 'ticket_search', 'new_ticket' ]);
		app.highlightTab( 'NewTicket' );
		
		// app.selectSidebarTab('NewTicket');
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New Ticket';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.ticket = {
			status: "open",
			username: app.username,
			assignees: [],
			// due: normalize_time( time_now() + (86400 * config.default_ticket_due_days), { hour:0, min:0, sec:0 } ),
			due: 0,
			id: "",
			type: "change",
			subject: "",
			body: "",
			category: "",
			server: "",
			cc: [],
			notify: [],
			tags: []
		};
		
		html += this.get_ticket_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onClick="$P().cancel_ticket_edit()">Cancel</div>';
			html += '<div class="button primary" onClick="$P().do_new_ticket()"><i class="mdi mdi-floppy">&nbsp;</i>Create Ticket</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.setup_dynamic_elements();
		this.setupBoxButtonFloater();
		
		$('#fe_nt_subject').focus();
		
		this.current_editor_type = 'new';
	}
	
	cancel_ticket_edit() {
		// cancel editing ticket and return to new
		if (this.args.sub == 'new') Nav.go('#Tickets');
		else Nav.go( '#Tickets?sub=new', 'force' );
	}
	
	do_new_ticket(force) {
		// create new ticket
		app.clearError();
		var ticket = this.get_ticket_form_json();
		if (!ticket) return; // error
		
		this.ticket = ticket;
		
		Dialog.showProgress( 1.0, "Creating Ticket..." );
		app.api.post( 'app/create_ticket', ticket, this.new_ticket_finish.bind(this) );
	}
	
	new_ticket_finish(resp) {
		// new ticket created successfully
		Dialog.hideProgress();
		
		// refresh client-side loc list and sidebar
		this.ticket = resp.ticket;
		this.ticket.created = this.ticket.modified = time_now();
		
		// Note: We MUST nav to the ticket id here, as the rest is being indexed in the background
		Nav.go('Tickets?id=' + this.ticket.id);
		app.showMessage('success', "The new ticket was created successfully.");
	}
	
	show_delete_ticket_dialog() {
		// show dialog confirming ticket delete action
		var self = this;
		
		Dialog.confirmDanger( 'Delete Ticket', "Are you sure you want to <b>permanently delete</b> ticket #" + this.ticket.num + " (&ldquo;" + this.ticket.subject + "&rdquo;)?  There is no way to undo this action.", 'Delete', function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Ticket..." );
				app.api.post( 'app/delete_ticket', self.ticket, self.delete_ticket_finish.bind(self) );
			}
		} );
	}
	
	delete_ticket_finish(resp) {
		// finished deleting ticket
		var self = this;
		Dialog.hideProgress();
		
		app.cacheBust = hires_time_now();
		
		if (this.args.sub == 'search') Nav.go( this.selfNav({}), 'force' );
		else Nav.go('Tickets', 'force');
		
		app.showMessage('success', "Ticket #" + this.ticket.num + " was deleted successfully.");
	}
	
	get_ticket_edit_html() {
		// get html for creating a new ticket
		var html = '';
		var ticket = this.ticket;
		
		// subject
		html += this.getFormRow({
			id: 'd_nt_subject',
			content: this.getFormText({
				id: 'fe_nt_subject',
				// spellcheck: 'false',
				value: ticket.subject
			})
		});
		
		// body
		html += this.getFormRow({
			id: 'd_nt_body',
			content: '<div id="d_editor">' + this.getEditToolbar() + '<div onClick="$P().editor.focus()">' + this.getFormTextarea({
				id: 'fe_editor',
				rows: 10,
				value: ticket.body
			}) + '</div></div>'
		});
		
		// type
		html += this.getFormRow({
			id: 'd_nt_type',
			content: this.getFormMenuSingle({
				id: 'fe_nt_type',
				options: config.ui.ticket_types,
				value: ticket.type || '',
				// 'data-shrinkwrap': 1
			})
		});
		
		// status
		html += this.getFormRow({
			id: 'd_nt_status',
			content: this.getFormMenuSingle({
				id: 'fe_nt_status',
				options: config.ui.ticket_statuses,
				value: ticket.status || '',
				// 'data-shrinkwrap': 1
			})
		});
		
		// category
		html += this.getFormRow({
			id: 'd_nt_category',
			content: this.getFormMenuSingle({
				id: 'fe_nt_category',
				options: [['', '(None)']].concat( app.categories ),
				value: ticket.category || '',
				default_icon: 'folder-open-outline',
				// 'data-shrinkwrap': 1
			})
		});
		
		// server
		html += this.getFormRow({
			id: 'd_nt_server',
			content: this.getFormMenuSingle({
				id: 'fe_nt_server',
				options: [['', '(None)']].concat( this.getCategorizedServers(true) ),
				value: ticket.server || '',
				default_icon: 'router-network',
				// 'data-shrinkwrap': 1
			})
		});
		
		// assignees
		html += this.getFormRow({
			id: 'd_nt_assignees',
			content: this.getFormMenuMulti({
				id: 'fe_nt_assignees',
				options: app.users.map( function(user) { return { id: user.username, title: user.full_name, icon: user.icon || 'account' }; } ),
				values: ticket.assignees,
				auto_add: true,
				// 'data-shrinkwrap': 1
			})
		});
		
		// cc
		html += this.getFormRow({
			id: 'd_nt_cc',
			content: this.getFormMenuMulti({
				id: 'fe_nt_cc',
				options: app.users.map( function(user) { return { id: user.username, title: user.full_name, icon: user.icon || 'account' }; } ),
				values: ticket.cc,
				// 'data-shrinkwrap': 1
			})
		});
		
		// notify
		html += this.getFormRow({
			id: 'd_nt_notify',
			content: this.getFormMenuMulti({
				id: 'fe_nt_notify',
				icon: 'email-plus-outline',
				options: ticket.notify,
				values: ticket.notify,
				trim: 1,
				lower: 1,
				// 'data-shrinkwrap': 1,
				'data-validate': "^[\\w\\-\\.]+\\@[\\w\\-\\.]+$"
			})
		});
		
		// due date
		html += this.getFormRow({
			id: 'd_nt_due',
			content: this.getFormText({
				id: 'fe_nt_due',
				type: 'date',
				value: ticket.due ? this.formatDateTZ(ticket.due, '[yyyy]-[mm]-[dd]', config.tz) : '' // system timezone
			})
		});
		
		// tags
		html += this.getFormRow({
			id: 'd_nt_tags',
			content: this.getFormMenuMulti({
				id: 'fe_nt_tags',
				options: app.tags,
				values: ticket.tags,
				// 'data-shrinkwrap': 1
			})
		});
		
		return html;
	}
	
	onThemeChange(theme) {
		// called with theme changes
		this.handleEditorThemeChange(theme);
	}
	
	setup_dynamic_elements() {
		// setup popups, uploads and codemirror
		var self = this;
		
		SingleSelect.init( this.div.find('#fe_nt_category, #fe_nt_server, #fe_nt_status, #fe_nt_type') );
		MultiSelect.init( this.div.find('#fe_nt_assignees, #fe_nt_tags, #fe_nt_cc') );
		TextSelect.init( this.div.find('#fe_nt_notify') );
		
		// setup codemirror
		this.setupEditor();
		
		// setup uploader
		this.setupUploader();
	}
	
	setupUploader() {
		// setup upload system
		var settings = config.ticket_upload_settings;
		ZeroUpload.setURL( '/api/app/upload_user_ticket_files' );
		ZeroUpload.setMaxFiles( settings.max_files_per_ticket );
		ZeroUpload.setMaxBytes( settings.max_file_size );
		ZeroUpload.setFileTypes( settings.accepted_file_types );
		ZeroUpload.on('start', this.editorUploadStart.bind(this) );
		ZeroUpload.on('progress', this.editorUploadProgress.bind(this) );
		ZeroUpload.on('complete', this.editorUploadComplete.bind(this) );
		ZeroUpload.on('error', this.editorUploadError.bind(this) );
		ZeroUpload.init();
	}
	
	get_ticket_form_json() {
		// get api key elements from form, used for new or edit
		var ticket = this.ticket;
		
		ticket.subject = this.div.find('#fe_nt_subject').val().trim();
		ticket.body = this.editor.getValue();
		ticket.status = this.div.find('#fe_nt_status').val();
		ticket.assignees = this.div.find('#fe_nt_assignees').val();
		ticket.cc = this.div.find('#fe_nt_cc').val();
		ticket.notify = this.div.find('#fe_nt_notify').val();
		ticket.category = this.div.find('#fe_nt_category').val();
		ticket.server = this.div.find('#fe_nt_server').val();
		
		if (this.div.find('#fe_nt_due').val()) {
			ticket.due = this.parseDateTZ( this.div.find('#fe_nt_due').val() + ' 00:00:00', config.tz ); // use server's timezone for this
		}
		else {
			ticket.due = 0;
		}
		
		ticket.type = this.div.find('#fe_nt_type').val();
		ticket.tags = this.div.find('#fe_nt_tags').val();
		
		if (!ticket.subject.length) {
			return app.badField('#fe_nt_subject', "Please enter a subject line for the ticket.");
		}
		if (!ticket.body.length) {
			return app.doError("Please enter some body text for the ticket.");
		}
		
		return ticket;
	}
	
	//
	// View Ticket
	//
	
	gosub_view(args) {
		// view ticket subpage
		app.showSidebar(true);
		
		this.loading();
		app.api.post( 'app/get_ticket', args, this.receive_ticket_for_view.bind(this), this.receive_ticket_for_view.bind(this) );
	}
	
	render_header() {
		// render header icon, text and ticket status
		var ticket = this.ticket;
		var status_def = find_object(config.ui.ticket_statuses, { id: ticket.status }) || { color: 'gray', title: ucfirst(ticket.status) };
		var is_overdue = false;
		
		if ((ticket.status == 'open') && ticket.due && (ticket.due < app.epoch)) {
			is_overdue = true;
		}
		
		app.setHeaderNav([
			'ticket_search',
			{ icon: 'text-box-outline', title: 'Ticket #' + ticket.num },
			{ type: 'badge', ...status_def },
			is_overdue ? { type: 'badge', color: 'yellow', icon: 'calendar-alert', title: 'Overdue' } : null
		]);
	}
	
	receive_ticket_for_view(resp) {
		// display ticket
		var self = this;
		var html = '';
		var ticket = this.ticket = resp.data || resp.ticket;
		
		if (resp.code) {
			app.doError("Ticket not found (perhaps it was deleted)");
			html += '<div class="inline_page_message">No ticket to display.</div>';
			this.div.html( html );
			return;
		}
		
		app.setWindowTitle( "Ticket #" + ticket.num + ": " + ticket.subject );
		history.replaceState( null, '', '#' + ticket.num );
		this.render_header();
		
		var body = '<div class="markdown-body">' + marked.parse(ticket.body, config.ui.marked_config) + '</div>';
		
		html += '<div class="box">';
			html += '<div id="d_ticket_main_body">';
				html += '<div class="box_title grid subject">';
					html += '<div class="btg_title">' + strip_html(ticket.subject) + '</div>';
					html += '<div class="btg_buttons">';
						html += '<div class="button secondary" onClick="$P().prep_edit_ticket_body()"><i class="mdi mdi-text-box-edit-outline">&nbsp;</i>Edit Ticket...</div>';
					html += '</div>';
				html += '</div>';
				html += '<div class="message_body">' + body + '</div>';
			html += '</div>';
			html += '<div id="d_ticket_main_editor"></div>';
		html += '</div>'; // box
		
		// attributes pane
		html += '<div class="box" style="">';
		html += '<div class="box_content" style="padding:20px;">';
		
		html += '<div class="form_grid">';
		
		// type
		html += '<div class="form_cell">';
		html += this.getFormRow({
			label: 'Type:',
			content: this.getFormMenuSingle({
				id: 'fe_et_type',
				title: 'Select type of ticket',
				placeholder: 'Select type of ticket...',
				options: config.ui.ticket_types,
				value: ticket.type || '',
				'data-shrinkwrap': 1
			}),
			caption: 'Select the type for the ticket.'
		});
		html += '</div>';
		
		// status
		html += '<div class="form_cell">';
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormMenuSingle({
				id: 'fe_et_status',
				title: 'Select status for ticket',
				placeholder: 'Select status for ticket...',
				options: config.ui.ticket_statuses,
				value: ticket.status || '',
				'data-shrinkwrap': 1
			}),
			caption: 'Set the ticket status.'
		});
		html += '</div>';
		
		// assignees
		html += '<div class="form_cell">';
		html += this.getFormRow({
			label: 'Assignees:',
			content: this.getFormMenuMulti({
				id: 'fe_et_assignees',
				title: 'Select assignees for ticket',
				placeholder: 'Select assignees...',
				options: app.users.map( function(user) { return { id: user.username, title: user.full_name, icon: user.icon || 'account' }; } ),
				values: ticket.assignees,
				auto_add: true,
				'data-shrinkwrap': 1
			}),
			caption: 'Select the user(s) responsible for the ticket.'
		});
		html += '</div>';
		
		// category
		html += '<div class="form_cell">';
		html += this.getFormRow({
			label: 'Category:',
			content: this.getFormMenuSingle({
				id: 'fe_et_category',
				title: 'Select category for ticket',
				placeholder: 'Select category for ticket...',
				options: [['', '(None)']].concat( app.categories ),
				value: ticket.category,
				default_icon: 'folder-open-outline',
				'data-shrinkwrap': 1
			}),
			caption: 'Associate the ticket with a category.'
		});
		html += '</div>';
		
		// due date
		html += '<div class="form_cell">';
		html += this.getFormRow({
			label: 'Due Date:',
			content: this.getFormText({
				id: 'fe_et_due',
				type: 'date',
				value: ticket.due ? this.formatDateTZ(ticket.due, '[yyyy]-[mm]-[dd]', config.tz) : '' // system timezone
			}),
			caption: 'Optionally set a due date for the ticket.'
		});
		html += '</div>';
		
		// server
		html += '<div class="form_cell">';
		html += this.getFormRow({
			label: 'Server:',
			content: this.getFormMenuSingle({
				id: 'fe_et_server',
				title: 'Select server for ticket',
				placeholder: 'Select server for ticket...',
				options: [['', '(None)']].concat( this.getCategorizedServers(true) ),
				value: ticket.server,
				default_icon: 'router-network',
				auto_add: true,
				'data-shrinkwrap': 1
			}),
			caption: 'Associate the ticket with a server.'
		});
		html += '</div>';
		
		// tags
		html += '<div class="form_cell">';
		html += this.getFormRow({
			label: 'Tags:',
			content: this.getFormMenuMulti({
				id: 'fe_et_tags',
				title: 'Select tags to apply',
				placeholder: 'Select tags to apply...',
				options: app.tags,
				values: ticket.tags,
				'data-shrinkwrap': 1
			}),
			caption: 'Select tags to apply to the ticket.'
		});
		html += '</div>';
		
		// cc
		html += '<div class="form_cell">';
		html += this.getFormRow({
			label: 'Cc:',
			content: this.getFormMenuMulti({
				id: 'fe_et_cc',
				title: 'Select users to carbon copy',
				placeholder: 'Select users to carbon copy...',
				options: app.users.map( function(user) { return { id: user.username, title: user.full_name, icon: user.icon || 'account' }; } ),
				values: ticket.cc,
				'data-shrinkwrap': 1
			}),
			caption: 'Select users to receive ticket updates.'
		});
		html += '</div>';
		
		// notify
		html += '<div class="form_cell">';
		html += this.getFormRow({
			label: 'Notify:',
			content: this.getFormMenuMulti({
				id: 'fe_et_notify',
				title: 'Add new recipient',
				placeholder: 'Click to add recipient...',
				icon: 'email-plus-outline',
				description: 'Enter any e-mail address to receive ticket updates.',
				confirm: 'Add Recipient',
				options: ticket.notify,
				values: ticket.notify,
				trim: 1,
				lower: 1,
				'data-shrinkwrap': 1,
				'data-validate': "^[\\w\\-\\.]+\\@[\\w\\-\\.]+$"
			}),
			caption: 'Add custom e-mail addresses for updates.'
		});
		html += '</div>';
		
		html += '</div>'; // form_grid
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		// ticket alerts
		html += '<div class="box" id="d_ticket_alerts" style="display:none">';
			html += '<div class="box_title">';
				html += '<span>Ticket Alerts</span>';
				// html += '<div class="button right" onClick="$P().addTicketAlert()"><i class="mdi mdi-plus-circle-outline">&nbsp;</i><span>Add Alert...</span></div>';
				html += '<div class="clear"></div>';
			html += '</div>';
			html += '<div class="box_content table">';
				// html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// ticket events
		html += '<div class="box" id="d_ticket_events" style="display:none">';
			html += '<div class="box_title">';
				html += '<span>Ticket Events</span>';
				// html += '<div class="button right" onClick="$P().do_edit_event(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i><span>Add Event...</span></div>';
				html += '<div class="clear"></div>';
			html += '</div>';
			html += '<div class="box_content table">';
				// html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// ticket jobs
		html += '<div class="box" id="d_ticket_jobs">';
			html += '<div class="box_title">';
				html += '<span>Ticket Jobs</span>';
				// html += '<div class="button secondary right" onClick="$P().addTicketJob()"><i class="mdi mdi-timer-plus-outline">&nbsp;</i><span>Add Job...</span></div>';
				html += '<div class="clear"></div>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// ticket files
		html += '<div class="box" id="d_ticket_files" style="display:none">';
			html += '<div class="box_title">';
				html += '<span>Ticket Files</span>';
				// html += '<div class="button right" onClick="$P().do_attach_files()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i><span>Attach Files...</span></div>';
				html += '<div class="clear"></div>';
			html += '</div>';
			html += '<div class="box_content table">';
				// html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// timeline (changes / comments)
		html += '<div id="d_ticket_changes"></div>';
		
		// add comment box
		html += '<div class="ticket_change_divider"></div>';
		html += '<div id="d_ticket_add_comment_btn" class="ticket_change"><div class="button secondary" onClick="$P().show_add_comment_editor()"><i class="mdi mdi-comment-plus-outline">&nbsp;</i>Add Comment...</div></div>';
		html += '<div id="d_ticket_add_comment_editor"></div>';
		
		// button box
		html += '<div class="box">';
			html += '<div class="box_buttons" style="padding:20px">';
				// html += '<div class="button mobile_collapse" onClick="$P().cancel_ticket_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
				html += '<div class="button danger mobile_collapse" onClick="$P().show_delete_ticket_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>';
				// html += '<div class="button secondary mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
				// html += '<div class="button secondary mobile_collapse" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
				
				html += '<div id="btn_et_add_event" class="button secondary mobile_collapse sm_hide" onClick="$P().do_edit_event(-1)"><i class="mdi mdi-calendar-edit-outline">&nbsp;</i><span>Add Event...</span></div>';
				html += '<div id="btn_et_add_event" class="button secondary mobile_collapse sm_hide" onClick="$P().do_attach_files()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i><span>Attach Files...</span></div>';
				html += '<div id="btn_et_assign" class="button mobile_collapse" onClick="$P().do_assign_to_me()"><i class="mdi mdi-account">&nbsp;</i><span>Assign to Me</span></div>';
				
				var is_fav = !!(ticket.cc && ticket.cc.includes(app.username));
				html += '<div id="btn_et_fav" class="button mobile_collapse ' + (is_fav ? 'favorite' : '') + '" onClick="$P().do_toggle_follow()"><i class="mdi mdi-'+(is_fav ? 'heart' : 'heart-plus-outline')+'">&nbsp;</i><span>Follow</span></div>';
				
				html += '<div id="btn_et_close" class="button danger phone_collapse" onClick="$P().do_close_ticket()"><i class="mdi mdi-power">&nbsp;</i><span>Close Ticket</span></div>';
			html += '</div>'; // box_buttons
		html += '</div>'; // box
		
		this.div.html( html );
		this.expandInlineImages('#d_ticket_main_body');
		this.highlightCodeBlocks('#d_ticket_main_body');
		this.setupBoxButtonFloater();
		
		// render jobs, files, alerts
		this.renderTicketEvents();
		this.getTicketJobs();
		this.getTicketAlerts();
		
		this.update_buttons();
		this.render_ticket_changes();
		this.setupUploader();
		
		SingleSelect.init( this.div.find('#fe_et_type, #fe_et_status, #fe_et_category, #fe_et_server') );
		MultiSelect.init( this.div.find('#fe_et_assignees, #fe_et_tags, #fe_et_cc') );
		TextSelect.init( this.div.find('#fe_et_notify') );
		
		// handle attribute block changes
		this.div.find('#fe_et_assignees, #fe_et_type, #fe_et_status, #fe_et_category, #fe_et_server, #fe_et_tags, #fe_et_cc, #fe_et_notify, #fe_et_due').on('change', function() {
			var $this = $(this);
			var field_id = $this.prop('id').replace(/^fe_et_/, '');
			var data = { id: self.ticket.id };
			data[ field_id ] = $this.val();
			
			// special handling for due (must be int, and normalized)
			if (field_id == 'due') {
				if ($this.val()) data.due = self.parseDateTZ( $this.val() + ' 00:00:00', config.tz ); // use server's tz
				else data.due = 0;
			}
			
			// do we really need a server update?
			if (data[ field_id ] == self.ticket[ field_id ]) return;
			
			// yes we do
			app.api.post( 'app/update_ticket', data, function(resp) {
				app.showMessage('success', "Ticket updated successfully.");
				self.ticket = resp.ticket;
				app.cacheBust = hires_time_now();
				
				// redraw or append changes
				self.render_ticket_changes();
				self.update_buttons();
				self.render_header();
				
			} ); // api.post
		}); // change
	}
	
	do_attach_files() {
		// attach files to ticket
		if (this.editor) return app.doError("Please close the current text editor before attaching files.");
		
		ZeroUpload.chooseFiles({}, {
			ticket: this.ticket.id,
			save: true
		});
	}
	
	do_edit_event(idx) {
		// edit or add event to ticket
		var self = this;
		var ticket = this.ticket;
		var event = null;
		var do_create = false;
		
		if (!ticket.events) ticket.events = [];
		
		var sorted_events = this.getCategorizedEvents();
		if (!sorted_events.length) return app.doError('ticket_no_events');
		
		if (idx > -1) {
			// editing existing ticket event
			event = ticket.events[idx];
		}
		else {
			// new event
			event = { id: sorted_events[0].id, params: {} };
			do_create = true;
		}
		
		var event_def = find_object( app.events, { id: event.id } );
		if (!event_def) return app.doError('ticket_event_not_found', { event: event_def });
		var params = event.params;
		
		var title = do_create ? config.ui.titles.ticket_event_new : config.ui.titles.ticket_event_edit;
		var btn = do_create ? ['plus-circle', "Add Event"] : ['check-circle', "Save Changes"];
		
		var html = '<div class="dialog_box_content scroll maximize">';
		
		// event
		html += this.getFormRow({
			id: 'd_td_event',
			content: this.getFormMenuSingle({
				id: 'fe_td_event',
				options: sorted_events,
				value: event.id || '',
				default_icon: 'calendar-clock',
				'data-shrinkwrap': 1
			})
		});
		
		// targets
		html += this.getFormRow({
			id: 'd_td_targets',
			content: this.getFormMenuMulti({
				id: 'fe_td_targets',
				options: [].concat(
					this.buildOptGroup(app.groups, config.ui.menu_bits.wf_targets_groups, 'server-network'),
					this.buildServerOptGroup(config.ui.menu_bits.wf_targets_servers, 'router-network')
				),
				values: event.targets || [],
				auto_add: true,
				// 'data-hold': 1
				// 'data-shrinkwrap': 1
			})
		});
		
		// algo
		html += this.getFormRow({
			id: 'd_td_algo',
			content: this.getFormMenuSingle({
				id: 'fe_td_algo',
				options: [{ id: '', title: config.ui.menu_bits.wf_algo_default }].concat(config.ui.event_target_algo_menu).concat(
					this.buildOptGroup( app.monitors, config.ui.menu_bits.wf_algo_least, 'chart-line', 'monitor:' )
				),
				value: event.algo || '',
				// default_icon: 'arrow-decision',
				'data-nudgeheight': 1
				// 'data-shrinkwrap': 1
			})
		});
		
		// tags
		html += this.getFormRow({
			id: 'd_td_tags',
			content: this.getFormMenuMulti({
				id: 'fe_td_tags',
				options: app.tags,
				values: event.tags || [],
				default_icon: 'tag-outline',
				// 'data-shrinkwrap': 1
			})
		});
		
		// params
		html += this.getFormRow({
			id: 'd_td_user_params',
			content: '<div id="d_td_param_editor" class="plugin_param_editor_cont"></div>'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			event.id = $('#fe_td_event').val();
			event.targets = $('#fe_td_targets').val();
			event.algo = $('#fe_td_algo').val();
			event.tags = $('#fe_td_tags').val();
			
			var event_def = find_object( app.events, { id: event.id } );
			event.params = self.getParamValues(event_def.fields);
			if (!event.params) return; // invalid
			
			Dialog.hide();
			
			if (do_create) {
				// add new event
				ticket.events.push(event);
			}
			
			app.api.post( 'app/update_ticket', { id: ticket.id, events: ticket.events }, function(resp) {
				app.showMessage('success', do_create ? `Ticket event added successfully.` : `Ticket event updated successfully.`);
				self.ticket = resp.ticket;
				app.cacheBust = hires_time_now();
				
				// redraw or append changes
				self.render_ticket_changes();
				self.update_buttons();
				self.render_header();
				self.renderTicketEvents();
				
			} ); // api.post
		}); // Dialog.confirm
		
		MultiSelect.init( $('#fe_td_targets, #fe_td_tags') );
		SingleSelect.init( $('#fe_td_event, #fe_td_algo') );
		
		// handle event change
		var do_change_event = function() {
			// refresh param editor
			var event_id = $('#fe_td_event').val();
			var event_def = find_object( app.events, { id: event_id } );
			$('#d_td_param_editor').html( self.getParamEditor( event_def.fields, params ) );
			Dialog.autoResize();
		}
		
		$('#fe_td_event').on('change', do_change_event);
		do_change_event();
	}
	
	renderTicketEvents() {
		// show ticket events or hide section
		var self = this;
		var ticket = this.ticket;
		var events = ticket.events || [];
		this.events = events;
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		if (!events.length) {
			this.div.find('#d_ticket_events').hide();
			return;
		}
		
		var grid_args = {
			rows: events,
			cols: ['Event Title', 'Category', 'Plugin', 'Targets', 'Triggers', 'Actions'],
			data_type: 'event',
			class: 'data_grid ticket_event_grid',
			empty_msg: 'No ticket events found.'
		};
		
		html += this.getBasicGrid( grid_args, function(item, idx) {
			var actions = [
				'<span class="link" onClick="$P().do_edit_event(' + idx + ')"><b>Edit</b></span>',
				'<span class="link" onClick="$P().do_run_event(' + idx + ')"><b>Run Now</b></span>',
				'<span class="link danger" onClick="$P().do_remove_event(' + idx + ')"><b>Remove</b></span>'
			];
			
			var event_def = find_object( app.events, { id: item.id } ) || { id: item.id, title: '(Not Found)', triggers: [] };
			
			return [
				'<span style="font-weight:bold">' + self.getNiceEvent(event_def, true) + '</span>',
				self.getNiceCategory(event_def.category, true),
				self.getNicePlugin(event_def.plugin, true),
				self.getNiceTargetList(event_def.targets, true),
				summarize_event_timings(event_def),
				actions.join(' | ')
			];
		});
		
		this.div.find('#d_ticket_events > .box_content').html(html);
		this.div.find('#d_ticket_events').show();
	}
	
	do_run_event(idx) {
		// run event from ticket event list
		var self = this;
		var ticket = this.ticket;
		var event = this.events[idx];
		var event_def = find_object( app.events, { id: event.id } );
		if (!event_def) return app.doError("Event definition not found: " + event.id);
		
		var text = `Are you sure you want to run a job for the event &ldquo;<b>${event_def.title}</b>&rdquo;?  The new job will be added to the ticket.`;
		
		Dialog.confirm( 'Run Event', text, ['run-fast', 'Run Now'], function(result) {
			if (!result) return;
			var job = { ...event, tickets: [ticket.id] };
			if (!job.targets || !job.targets.length) job.targets = event_def.targets;
			if (!job.algo) job.algo = event_def.algo;
			if (!job.tags || !job.tags.length) job.tags = event_def.tags || [];
			
			if (ticket.files && ticket.files.length) {
				if (!job.input) job.input = {};
				if (!job.input.files) job.input.files = [];
				job.input.files = job.input.files.concat( ticket.files );
			}
			(self.jobs || []).forEach( function(prev_job) {
				if (!prev_job.files || !prev_job.files.length) return;
				if (!job.input) job.input = {};
				if (!job.input.files) job.input.files = [];
				job.input.files = job.input.files.concat( prev_job.files );
			} );
			
			Dialog.showProgress( 1.0, "Launching Job..." );
			
			app.api.post( 'app/run_event', job, function(resp) {
				Dialog.hideProgress();
				if (!self.active) return; // sanity
				app.showMessage('success', "Job launched successfully.");
			} ); // api.post
		} ); // confirm
	}
	
	do_remove_event(idx) {
		// remove event from ticket
		var self = this;
		var ticket = this.ticket;
		var event = this.events[idx];
		var event_def = find_object( app.events, { id: event.id } ) || { id: event.id, title: '(Not Found)', triggers: [] };
		
		Dialog.confirmDanger( 'Remove Event', "Are you sure you want to remove the event &ldquo;<b>" + event_def.title + "</b>&rdquo; from the current ticket?", ['trash-can', 'Remove'], function(result) {
			if (!result) return;
			
			ticket.events.splice(idx, 1);
			
			app.api.post( 'app/update_ticket', { id: ticket.id, events: ticket.events }, function(resp) {
				app.showMessage('success', `Ticket event removed successfully.`);
				self.ticket = resp.ticket;
				app.cacheBust = hires_time_now();
				
				// redraw or append changes
				self.render_ticket_changes();
				self.update_buttons();
				self.render_header();
				self.renderTicketEvents();
				
			} ); // api.post
		} );
	}
	
	getTicketJobs() {
		// fetch jobs that reference this ticket
		var self = this;
		var ticket = this.ticket;
		
		var opts = {
			query: 'tickets:' + ticket.id,
			offset: 0,
			limit: config.items_per_page, // no pagination, so this is just a sanity limit
			sort_by: '_id',
			sort_dir: -1,
			verbose: 1 // we need job.files
		};
		
		app.api.get( 'app/search_jobs', opts, this.renderTicketJobs.bind(this));
	}
	
	renderTicketJobs(resp) {
		// render ticket jobs including active ones
		var self = this;
		var ticket = this.ticket;
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		// active jobs on top, sorted
		var rows = Object.values(app.activeJobs).filter( function(job) {
			return job.tickets && job.tickets.includes(ticket.id);
		} ).sort( function(a, b) {
			return (a.started < b.started) ? 1 : -1;
		} );
		
		// completed jobs below, sorted
		rows = rows.concat( resp.rows || [] );
		this.jobs = rows;
		
		if (!rows.length) {
			this.div.find('#d_ticket_jobs').hide();
			this.renderTicketFiles();
			return;
		}
		
		var grid_args = {
			rows: rows,
			cols: ['Job ID', 'Event', 'Category', 'Server', 'State', 'Elapsed', 'Progress/Result', 'Actions'],
			data_type: 'job',
			class: 'data_grid wf_active_grid',
			empty_msg: 'No ticket jobs found.'
		};
		
		html += this.getBasicGrid( grid_args, function(job, idx) {
			var tds = [];
			
			if (!job.completed) tds = [
				'<b>' + self.getNiceJob(job, true) + '</b>',
				// self.getNiceJobSource(job),
				// self.getShortDateTime( job.started ),
				self.getNiceJobEvent(job, true),
				self.getNiceCategory(job.category, true),
				'<div id="d_wf_jt_server_' + job.id + '">' + self.getNiceServer(job.server, true) + '</div>',
				'<div id="d_wf_jt_state_' + job.id + '">' + self.getNiceJobState(job) + '</div>',
				'<div id="d_wf_jt_elapsed_' + job.id + '">' + self.getNiceJobElapsedTime(job, false) + '</div>',
				'<div id="d_wf_jt_progress_' + job.id + '">' + self.getNiceJobProgressBar(job) + '</div>',
				// '<div id="d_wf_jt_remaining_' + job.id + '">' + self.getNiceJobRemainingTime(job, false) + '</div>',
				
				'<span class="link danger" onClick="$P().doAbortJob(\'' + job.id + '\')"><b>Abort Job</b></a>'
			];
			else tds = [
				'<b>' + self.getNiceJob(job, true) + '</b>',
				self.getNiceJobEvent(job, true),
				self.getNiceCategory(job.category, true),
				self.getNiceServer(job.server, true),
				self.getNiceJobState(job),
				self.getNiceJobElapsedTime(job, false),
				self.getNiceJobResult(job),
				[ 
					'<a href="#Job?id=' + job.id + '"><b>View</b></a>',
					'<span class="link danger" onClick="$P().doRemoveJob(\'' + idx + '\')"><b>Remove</b></a>' 
				].join(' | ')
				// `<a href="#Job?id=${job.id}"><b>View Details...</b></a>`
			];
			
			if (job.suspended) tds.className = 'suspended';
			else if (job.category) {
				var category = find_object( app.categories, { id: job.category } );
				if (category && category.color) tds.className = 'clr_' + category.color;
			}
			
			return tds;
		} );
		
		this.div.find('#d_ticket_jobs > .box_content').html(html);
		this.div.find('#d_ticket_jobs').show();
		
		this.renderTicketFiles();
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
	
	doRemoveJob(idx) {
		// remove job from ticket
		var self = this;
		var ticket = this.ticket;
		var job = this.jobs[idx];
		
		Dialog.confirmDanger( 'Remove Job', "Are you sure you want to remove the job &ldquo;<b>" + job.id + "</b>&rdquo; from the current ticket?  This will not delete the job itself.", ['trash-can', 'Remove'], function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Removing Job..." );
			
			// remove our ticket id from the job ticket list
			var new_tickets = job.tickets.filter( function(ticket_id) { return ticket_id != ticket.id } );
			
			app.api.post( 'app/manage_job_tickets', { id: job.id, tickets: new_tickets }, function(resp) {
				Dialog.hideProgress();
				app.cacheBust = hires_time_now();
				app.showMessage('success', "Job successfully removed.");
				self.getTicketJobs();
			} ); // api.post
		} ); // confirm
	}
	
	updateTicketJobs() {
		// update live jobs in table without redrawing entire table
		// called on status update (every 1s)
		var self = this;
		var div = this.div;
		var ticket = this.ticket;
		
		var rows = Object.values(app.activeJobs).filter( function(job) {
			return job.tickets && job.tickets.includes(ticket.id);
		} );
		
		rows.forEach( function(job) {
			div.find('#d_wf_jt_state_' + job.id).html( self.getNiceJobState(job) );
			div.find('#d_wf_jt_server_' + job.id).html( self.getNiceServer(job.server, true) );
			div.find('#d_wf_jt_elapsed_' + job.id).html( self.getNiceJobElapsedTime(job, false) );
			// div.find('#d_wf_jt_remaining_' + job.id).html( self.getNiceJobRemainingTime(job, false) );
			
			// update progress bar without redrawing it (so animation doesn't jitter)
			self.updateJobProgressBar(job, '#d_wf_jt_progress_' + job.id + ' > div.progress_bar_container');
		} ); // foreach job
	}
	
	renderTicketFiles() {
		// render table of all job files, with download links
		var self = this;
		var ticket = this.ticket;
		var html = '';
		var cols = ['Filename', 'Size', 'Modified', 'Source', 'Job', 'Server', 'Actions'];
		
		var files = (ticket.files || []).map( function(file) { return { ...file, source: 'ticket' }; } );
		this.jobs.forEach( function(job) {
			// if (job.input && job.input.files) files = files.concat( job.input.files.map( function(file) { return { ...file, source: 'input' }; } ) );
			if (job.files) files = files.concat( job.files.map( function(file) { return { ...file, source: 'output' }; } ) );
		});
		this.files = files;
		
		if (!files.length) {
			this.div.find('#d_ticket_files').hide();
			return;
		}
		
		html += this.getBasicGrid( files, cols, 'file', function(file, idx) {
			var url = '/' + file.path;
			var classes = [];
			var actions = [
				'<a href="' + url + '" target="_blank"><b>View</b></a>',
				'<a href="' + url + '?download=' + encodeURIComponent(file.filename) + '"><b>Download</b></a>',
				// '<span class="link danger" onClick="$P().do_delete_file(' + idx + ')"><b>Delete</b></span>'
			];
			
			var nice_source = '';
			switch (file.source) {
				case 'ticket': 
					nice_source = '<i class="mdi mdi-text-box-outline">&nbsp;</i>Ticket'; 
					actions.push( '<span class="link danger" onClick="$P().do_delete_file(' + idx + ')"><b>Delete</b></span>' );
				break;
				case 'input': nice_source = '<i class="mdi mdi-file-download-outline">&nbsp;</i>Job Input'; break;
				case 'output': nice_source = '<i class="mdi mdi-file-upload-outline">&nbsp;</i>Job Output'; break;
			}
			
			var tds = [
				'<b>' + self.getNiceFile(file.filename, url) + '</b>',
				// '<span class="monospace">' + file.id + '</span>',
				'<i class="mdi mdi-floppy">&nbsp;</i>' + get_text_from_bytes( file.size || 0 ),
				self.getRelativeDateTime(file.date),
				nice_source,
				self.getNiceJob(file.job),
				self.getNiceServer(file.server),
				actions.join(' | ')
			];
			
			if (classes.length) tds.className = classes.join(' ');
			return tds;
		} ); // getBasicGrid
		
		this.div.find('#d_ticket_files > .box_content').html(html);
		this.div.find('#d_ticket_files').show();
	}
	
	do_delete_file(idx) {
		// delete file from ticket
		var self = this;
		var ticket = this.ticket;
		var file = ticket.files[idx];
		var filename = basename(file.filename || '(Unknown)');
		
		Dialog.confirmDanger( 'Delete File', "Are you sure you want to permanently delete the ticket file &ldquo;<b>" + filename + "</b>&rdquo;?  There is no way to undo this operation.", ['trash-can', 'Delete'], function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Deleting File..." );
			
			app.api.post( 'app/delete_ticket_file', { id: ticket.id, path: file.path }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "Ticket file &ldquo;" + filename + "&rdquo; was deleted successfully.");
				
				if (!self.active) return; // sanity
				
				ticket.files.splice( idx, 1 );
				self.renderTicketFiles();
			} ); // api.post
		} ); // confirm
	}
	
	getTicketAlerts() {
		// get info on alerts that reference our ticket
		var self = this;
		var ticket = this.ticket;
		
		var opts = {
			query: 'tickets:' + ticket.id,
			offset: 0,
			limit: config.items_per_page, // no pagination, so this is just a sanity limit
			sort_by: '_id',
			sort_dir: -1
		};
		
		app.api.get( 'app/search_alerts', opts, function(resp) {
			self.alerts = resp.rows || [];
			self.renderTicketAlerts();
		});
	}
	
	renderTicketAlerts() {
		// render details on ticket alerts
		var self = this;
		if (!this.active) return; // sanity
		
		if (!this.alerts || !this.alerts.length) {
			$('#d_ticket_alerts').hide();
			return;
		}
		
		var alerts = this.alerts;
		var cols = ["Alert ID", "Title", "Message", "Server", "Status", "Started", "Duration"];
		var html = '';
		
		var grid_args = {
			rows: alerts,
			cols: cols,
			data_type: 'alert'
		};
		
		html += this.getBasicGrid( grid_args, function(item, idx) {
			return [
				'<b>' + self.getNiceAlertID(item, true) + '</b>',
				self.getNiceAlert(item.alert, true),
				encode_entities(item.message),
				self.getNiceServer(item.server, true),
				self.getNiceAlertStatus(item),
				self.getRelativeDateTime(item.date),
				self.getNiceAlertElapsedTime(item, true, true)
			];
		}); // grid
		
		this.div.find('#d_ticket_alerts > div.box_content').html( html );
		this.div.find('#d_ticket_alerts').show();
	}
	
	do_toggle_follow() {
		// toggle follow for user (just adds to cc list)
		var self = this;
		var ticket = this.ticket;
		
		if (ticket.cc && ticket.cc.includes(app.username)) {
			ticket.cc.splice( ticket.cc.indexOf(app.username), 1 );
			// $(elem).html( '<i class="mdi mdi-heart-outline"></i>' );
			this.div.find('#btn_et_fav').removeClass('favorite').find('> i').removeClass().addClass('mdi mdi-heart-plus-outline');
		}
		else {
			if (!ticket.cc) ticket.cc = [];
			ticket.cc.push( app.username );
			// $(elem).html( '<i class="mdi mdi-heart favorite"></i>' );
			this.div.find('#btn_et_fav').addClass('favorite').find('> i').removeClass().addClass('mdi mdi-heart');
		}
		
		// trigger a redraw on the cc multiselect field
		this.div.find('#fe_et_cc').val( ticket.cc ).trigger('change');
	}
	
	do_assign_to_me() {
		// assign ticket to current user
		if (this.ticket.assignees.includes(app.username)) {
			app.showMessage('warning', "The ticket is already assigned to you.");
			return;
		}
		
		this.div.find('#fe_et_assignees').val( this.ticket.assignees.concat(app.username) ).trigger('change');
	}
	
	do_close_ticket() {
		// set ticket status to close
		if (this.ticket.status == 'closed') {
			app.showMessage('warning', "The ticket is already closed.");
			return;
		}
		
		this.div.find('#fe_et_status').val('closed').trigger('change');
	}
	
	update_buttons() {
		// update button state based on the situation
		$('#btn_et_assign').toggleClass('disabled', this.ticket.assignees.includes(app.username));
		$('#btn_et_close').toggleClass('disabled', this.ticket.status == 'closed');
	}
	
	close_current_editor() {
		// close and shutdown current editor
		// could be editing main body, editing comment, or adding new comment
		if (!this.editor) return;
		this.killEditor();
		// app.hideMessage();
		
		switch (this.current_editor_type) {
			case 'main':
				this.div.find('#d_ticket_main_body').show();
				this.div.find('#d_ticket_main_editor').hide().html('');
			break;
			
			case 'add_comment':
				this.div.find('#d_ticket_add_comment_btn').show();
				this.div.find('#d_ticket_add_comment_editor').hide().html('');
			break;
			
			case 'edit_comment':
				this.div.find('#d_ticket_comment_editor').remove();
				this.editing_comment_box.show();
				delete this.editing_comment_box;
			break;
		}
		
		delete this.current_editor_type;
	}
	
	prep_edit_ticket_body() {
		// reload ticket for edit, just in case it changed from under us
		app.api.post( 'app/get_ticket', { id: this.ticket.id }, this.do_edit_ticket_body.bind(this) );
	}
	
	do_edit_ticket_body(resp) {
		// open editor for ticket subject / body
		this.close_current_editor();
		
		var ticket = this.ticket = resp.ticket;
		var html = '';
		html += '<div class="box_content">';
		
		html += '<div class="form_grid single_column">';
		
		// subject
		html += '<div class="form_cell">';
		html += this.getFormRow({
			label: 'Subject:',
			content: this.getFormText({
				id: 'fe_et_subject',
				// spellcheck: 'false',
				value: ticket.subject
			}),
			caption: 'Enter a subject line for the ticket (i.e. title, summary, etc.).'
		});
		html += '</div>';
		
		// body
		html += '<div class="form_cell">';
		html += this.getFormRow({
			label: 'Body:',
			content: '<div id="d_editor">' + this.getEditToolbar() + '<div onClick="$P().editor.focus()">' + this.getFormTextarea({
				id: 'fe_editor',
				rows: 10,
				value: ticket.body
			}) + '</div></div>',
			caption: 'Enter the ticket body text using [GitHub Flavored Markdown](https://guides.github.com/features/mastering-markdown/) syntax.'
		});
		html += '</div>';
		
		html += '</div>'; // form_grid
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons compact">';
			html += '<div class="button" onClick="$P().close_current_editor()">Cancel</div>';
			html += '<div class="button primary" onClick="$P().save_main_body_editor()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		this.div.find('#d_ticket_main_body').hide();
		this.div.find('#d_ticket_main_editor').show().html(html);
		
		// setup codemirror
		this.setupEditor();
		this.editor.setSize( null, '65vh' );
		
		this.current_editor_type = 'main';
	}
	
	save_main_body_editor() {
		// save changes to subject / body from main view editor
		var self = this;
		var ticket = this.ticket;
		
		var subject = this.div.find('#fe_et_subject').val().trim();
		var body = this.editor.getValue();
		
		if (!subject.length) {
			return app.badField('#fe_nt_subject', "Please enter a subject line for the ticket.");
		}
		if (!body.length) {
			return app.doError("Please enter some body text for the ticket.");
		}
		
		ticket.subject = subject;
		ticket.body = body;
		
		// send changes to server
		var data = {
			id: ticket.id,
			subject: ticket.subject,
			body: ticket.body
		};
		
		Dialog.showProgress( 1.0, "Updating Ticket..." );
		
		app.api.post( 'app/update_ticket', data, function(resp) {
			app.showMessage('success', "Ticket updated successfully.");
			self.ticket = ticket = resp.ticket;
			app.cacheBust = hires_time_now();
			Dialog.hideProgress();
			
			// in case subject changed:
			app.setWindowTitle( "Ticket #" + ticket.num + ": " + ticket.subject );
			
			self.close_current_editor();
			
			// rerender subject and markdown
			self.div.find('#d_ticket_main_body div.btg_title').html( ticket.subject );
			self.div.find('#d_ticket_main_body div.markdown-body').html( marked.parse(ticket.body, config.ui.marked_config) );
			
			self.expandInlineImages('#d_ticket_main_body');
			self.highlightCodeBlocks('#d_ticket_main_body');
			
			// redraw or append changes
			self.render_ticket_changes();
		} ); // api.post
	}
	
	render_ticket_changes() {
		// render ticket changes
		var self = this;
		var html = '';
		var changes = this.ticket.changes || [];
		
		// special case: do not redraw changes if currently editing a comment
		if (this.current_editor_type == 'edit_comment') return;
		
		var groups = {};
		changes.forEach( function(change, idx) {
			var dargs = get_date_args(change.date);
			var date_code = dargs.yyyy_mm_dd + ' ' + dargs.hh + ':' + dargs.mi;
			
			if (change.type == 'comment') date_code += ':' + zeroPad(idx + 1, 4);
			else if (change.key && (change.key == 'created')) date_code += ':0000';
			else date_code += ':9999';
			// date_code += ' (' + zeroPad(idx, 4) + ')';
			
			change.date_code = date_code;
			
			if (!groups[date_code]) groups[date_code] = [];
			groups[date_code].push( change );
		});
		
		var sorted_date_codes = Object.keys(groups).sort( function(a, b) {
			return a.localeCompare( b );
		} );
		
		var sorted_groups = sorted_date_codes.map( function(date_code) {
			return groups[date_code];
		});
		
		var last_group_type = '';
		var num_groups = sorted_groups.length;
		var max_groups = 50;
		var last_hidden = false;
		
		if (num_groups > max_groups) {
			// too many groups to show by default
			html += '<div id="d_show_all_changes">';
				html += '<div class="ticket_change_divider"></div>';
				html += '<div class="ticket_change"><div class="button" onClick="$P().show_all_changes()"><i class="mdi mdi-arrow-expand-vertical">&nbsp;</i>Show Older Changes...</div></div>';
			html += '</div>';
		}
		
		sorted_groups.forEach( function(items, group_idx) {
			// render each group
			var yes_hide = false;
			if ((num_groups > max_groups) && (group_idx < (num_groups - max_groups))) {
				yes_hide = true;
				html += '<div class="change_hide_wrapper" style="display:none">';
			}
			
			if ((items.length == 1) && (items[0].type == 'comment')) {
				// special case for comments
				var change = items[0];
				
				if ((last_group_type != 'comment') || (!yes_hide && last_hidden)) {
					html += '<div class="ticket_change_divider"></div>';
				}
				last_group_type = 'comment';
				
				html += '<div class="box comment thin" data-id="' + change.id + '">';
					html += '<div class="box_title grid comment">';
					html += '<div class="btg_title" style="margin-top:0; color:var(--label-color); ">';
						html += '<i class="mdi mdi-comment-outline">&nbsp;</i>Comment by ';
						html += self.getNiceUser(change.username) + ' &mdash; ';
						html += '<i>' + self.getRelativeDateTime(change.edited || change.date) + (change.edited ? '&nbsp;<b>(Edited)</b>' : '') + '</i>';
					html += '</div>';
					
					if (change.username == app.username) {
						html += '<div class="btg_buttons">';
							html += '<div class="button icon danger" title="Delete Comment..." onClick="$P().delete_ticket_comment(this)"><i class="mdi mdi-trash-can-outline"></i></div>';
							html += '<div class="button icon secondary" title="Edit Comment..." onClick="$P().edit_ticket_comment(this)"><i class="mdi mdi-file-document-edit-outline"></i></div>';
						html += '</div>';
					}
					
					html += '</div>';
					
					html += '<div class="message_body">' + '<div class="markdown-body">' + marked.parse(change.body, config.ui.marked_config) + '</div>' + '</div>';
					// html += '<div class="message_footer">' + record.disp.foot_widgets.join('') + '<div class="clear"></div>' + '</div>';
				html += '</div>'; // box
				if (yes_hide) html += '</div>';
				last_hidden = yes_hide;
				return;
			}
			
			// not a comment
			last_group_type = 'change';
			html += '<div class="ticket_change_divider"></div>';
			html += '<div class="ticket_change markdown-body">';
			html += '<div class="ticket_change_date">' + self.getRelativeDateTime(items[0].date) + '</div>';
			
			items.forEach( function(change) {
				var md = self.getNiceUser(change.username) + ' ';
				if (!change.key || !config.ui.ticket_changes[change.key]) return;
				var text = config.ui.ticket_changes[change.key];
				
				switch (change.key) {
					case 'subject':
						md += substitute( text, { disp: change.value } );
					break;
					
					case 'status':
						md += substitute( text, { disp: self.getNiceTicketStatus(change.value) } );
					break;
					
					case 'type':
						md += substitute( text, { disp: self.getNiceTicketType(change.value) } );
					break;
					
					case 'category':
						md += substitute( text, { disp: self.getNiceCategory(change.value) } );
					break;
					
					case 'server':
						md += substitute( text, { disp: self.getNiceServer(change.value) } );
					break;
					
					case 'assignees':
						md += substitute( text, { disp: self.getNiceUserList(change.value) } );
					break;
					
					case 'due':
						md += substitute( text, { disp: change.value ? self.getNiceDate(change.value) : '(None)' } );
					break;
					
					case 'cc':
						md += substitute( text, { disp: self.getNiceUserList(change.value) } );
					break;
					
					case 'notify':
						md += substitute( text, { disp: change.value.map( function(email) { return `${email}`; } ).join(', ') || '(None)' } );
					break;
					
					case 'tags':
						md += substitute( text, { disp: self.getNiceTagList(change.value) } );
					break;
					
					default:
						md += text;
					break;
				} // switch change.key
				
				// html += marked.parse(md, config.ui.marked_config);
				html += `<p>${md}</p>`;
			}); // foreach item
			
			html += '</div>';
			if (yes_hide) html += '</div>';
			last_hidden = yes_hide;
		} ); // foreach group
		
		this.div.find('#d_ticket_changes').html(html);
		this.expandInlineImages('#d_ticket_changes');
		this.highlightCodeBlocks('#d_ticket_changes');
	}
	
	show_all_changes() {
		// show all hidden changes, and hide control
		this.div.find('div.change_hide_wrapper').show();
		this.div.find('#d_show_all_changes').hide();
	}
	
	edit_ticket_comment(btn) {
		// edit comment
		var self = this;
		var ticket = this.ticket;
		var $box = $(btn).closest('div.box.comment');
		var change_id = $box.data('id');
		if (!change_id) return app.doError("Cannot find comment ID.");
		
		var change = find_object( ticket.changes, { id: change_id } );
		if (!change) return app.doError("Cannot find comment to delete.");
		
		this.close_current_editor();
		this.editing_comment_box = $box;
		
		var html = '';
		
		html += '<div class="box" id="d_ticket_comment_editor">';
		// html += '<div class="box_title">Add Comment</div>';
		html += '<div class="box_content">';
		html += '<div class="form_grid single_column">';
		
		// body
		html += '<div class="form_cell">';
		html += this.getFormRow({
			label: 'Edit Comment:',
			content: '<div id="d_editor">' + this.getEditToolbar() + '<div onClick="$P().editor.focus()">' + this.getFormTextarea({
				id: 'fe_editor',
				rows: 5,
				value: change.body
			}) + '</div></div>',
			caption: 'Enter your comment using [GitHub Flavored Markdown](https://guides.github.com/features/mastering-markdown/) syntax.'
		});
		html += '</div>';
		
		html += '</div>'; // form_grid
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons compact">';
			html += '<div class="button" onClick="$P().close_current_editor()">Cancel</div>';
			html += '<div class="button primary" onClick="$P().do_save_comment()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		$box.after( html );
		$box.hide();
		
		// setup codemirror
		this.setupEditor();
		this.editor.setSize( null, '200px' );
		this.editor.focus();
		
		this.current_editor_type = 'edit_comment';
		
		this.div.find('#d_ticket_comment_editor')[0].scrollIntoViewIfNeeded();
	}
	
	do_save_comment() {
		// save comment changes and close editor
		var self = this;
		var ticket = this.ticket;
		var $box = this.editing_comment_box;
		
		var change_id = $box.data('id');
		if (!change_id) return app.doError("Cannot find comment ID.");
		
		var change = find_object( ticket.changes, { id: change_id } );
		if (!change) return app.doError("Cannot find comment to save.");
		
		// update comment
		var data = {
			id: ticket.id,
			change_id: change_id,
			change: {
				body: this.editor.getValue()
			}
		};
		
		// replace UI with progress bar until API completes
		this.editing_comment_box.html(
			'<div id="d_progress_bar_cont" class="progress_bar_container indeterminate" style="width:196px; margin:0 auto 0 auto;">' + 
				'<div id="d_progress_bar" class="progress_bar_inner" style="width:196px;"></div>' + 
			'</div>'
		);
		
		this.close_current_editor();
		
		app.api.post( 'app/update_ticket_change', data, function(resp) {
			app.showMessage('success', "Comment updated successfully.");
			self.ticket = ticket = resp.ticket;
			app.cacheBust = hires_time_now();
			
			// redraw or append changes
			self.render_ticket_changes();
		} ); // api.post
	}
	
	delete_ticket_comment(btn) {
		// delete specific comment after confirmation
		var self = this;
		var ticket = this.ticket;
		var $box = $(btn).closest('div.box.comment');
		var change_id = $box.data('id');
		if (!change_id) return app.doError("Cannot find comment ID.");
		
		var change = find_object( ticket.changes, { id: change_id } );
		if (!change) return app.doError("Cannot find comment to delete.");
		
		Dialog.confirmDanger( 'Delete Comment', "Are you sure you want to <b>permanently delete</b> the selected comment?  There is no way to undo this action.", 'Delete', function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Comment..." );
				var data = {
					id: ticket.id,
					change_id: change_id,
					delete: true
				};
				app.api.post( 'app/update_ticket_change', data, function(resp) {
					Dialog.hideProgress();
					app.showMessage('success', "Comment deleted successfully.");
					self.ticket = ticket = resp.ticket;
					app.cacheBust = hires_time_now();
					
					// redraw or append changes
					self.render_ticket_changes();
				} ); // api.post
			} // confirmed
		} ); // dialog
		
		$box.addClass('highlight');
		Dialog.onHide = function() {
			$box.removeClass('highlight');
		};
	}
	
	show_add_comment_editor() {
		// pop-open add comment editor
		var html = '';
		this.close_current_editor();
		
		html += '<div class="box" style="margin-top:30px">';
		// html += '<div class="box_title">Add Comment</div>';
		html += '<div class="box_content">';
		html += '<div class="form_grid single_column">';
		
		// body
		html += '<div class="form_cell">';
		html += this.getFormRow({
			label: 'Add Comment:',
			content: '<div id="d_editor">' + this.getEditToolbar() + '<div onClick="$P().editor.focus()">' + this.getFormTextarea({
				id: 'fe_editor',
				rows: 5,
				value: ''
			}) + '</div></div>',
			caption: 'Enter your comment using [GitHub Flavored Markdown](https://guides.github.com/features/mastering-markdown/) syntax.'
		});
		html += '</div>';
		
		html += '</div>'; // form_grid
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons compact">';
			html += '<div class="button" onClick="$P().close_current_editor()">Cancel</div>';
			html += '<div class="button primary" onClick="$P().do_add_comment()"><i class="mdi mdi-comment-plus">&nbsp;</i>Add Comment</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.find('#d_ticket_add_comment_btn').hide();
		this.div.find('#d_ticket_add_comment_editor').show().html(html);
		
		// setup codemirror
		this.setupEditor();
		this.editor.setSize( null, '200px' );
		this.editor.focus();
		
		this.current_editor_type = 'add_comment';
		
		// scroll to bottom
		$(document).scrollTop( this.div.find('#d_ticket_add_comment_editor').offset().top );
	}
	
	do_add_comment() {
		// save new comment, render it
		var self = this;
		var ticket = this.ticket;
		
		// add comment
		var data = {
			id: ticket.id,
			change: {
				type: 'comment',
				body: this.editor.getValue()
			}
		};
		
		this.close_current_editor();
		
		app.api.post( 'app/add_ticket_change', data, function(resp) {
			app.showMessage('success', "Ticket updated successfully.");
			self.ticket = ticket = resp.ticket;
			
			// redraw or append changes
			self.render_ticket_changes();
			
			// scroll to new comment
			$(document).scrollTop( self.div.find('#d_ticket_changes > div.box.comment').slice(-1).offset().top );
		} ); // api.post
	}
	
	setupEditor() {
		// codemirror go!
		var self = this;
		var elem = document.getElementById("fe_editor");
		
		this.editor = CodeMirror.fromTextArea(elem, merge_objects( config.editor_defaults, {
			mode: {
				name: "gfm",
				gitHubSpice: false
			},
			theme: app.getCodemirrorTheme(),
			// viewportMargin: Infinity,
			inputStyle: 'contenteditable',
			spellcheck: true,
			
			extraKeys: {
				'Ctrl-B': function() { self.editToggleBold(); },
				'Ctrl-I': function() { self.editToggleItalic(); },
				
				'Cmd-B': function() { self.editToggleBold(); },
				'Cmd-I': function() { self.editToggleItalic(); }
			}
		}));
		
		// required for auto-sizing to fit width
		setTimeout( function() { self.onResize(); }, 100 );
		setTimeout( function() { self.onResize(); }, 200 );
		setTimeout( function() { self.onResize(); }, 300 );
		setTimeout( function() { self.onResize(); }, 400 );
		setTimeout( function() { self.onResize(); }, 500 );
	}
	
	onDragDrop(files) {
		// intercept drag-drop event and upload files to ticket
		if (this.args.sub == 'view') {
			ZeroUpload.upload( files, {}, {
				ticket: this.ticket.id || 'new',
				save: this.editor ? false : true
			} );
		}
	}
	
	editUploadFiles() {
		// upload files from editor toolbar button
		if (!this.editor) return; // sanity
		
		ZeroUpload.chooseFiles({}, {
			ticket: this.ticket.id || 'new'
		});
	}
	
	editorUploadStart(files, userData) {
		// file upload has started
		Dialog.showProgress( 0.0, "Uploading " + pluralize('file', files.length) + "..." );
		Debug.trace('upload', "Upload started");
	}
	
	editorUploadProgress(progress) {
		// file is on its way
		Dialog.showProgress( progress.amount );
		Debug.trace('upload', "Upload progress: " + progress.pct);
	}
	
	editorUploadComplete(response, userData) {
		// file upload has completed
		Dialog.hideProgress();
		Debug.trace('upload', "Upload complete!", response.data);
		
		var data = null;
		try { data = JSON.parse( response.data ); }
		catch (err) {
			return app.doError("Upload Failed: JSON Parse Error: " + err);
		}
		
		if (data && (data.code != 0)) {
			return app.doError("Upload Failed: " + data.description);
		}
		
		if (this.editor) {
			// uploaded as inline editor file
			var text = '';
			data.files.forEach( function(file) {
				var url = config.base_app_url + '/' + file.path;
				if (url.match(/\.(jpg|jpeg|gif|png|webp)$/i)) text += '![' + basename(url) + '](' + url + ')' + "\n\n";
				else text += '[' + basename(url) + '](' + url + ')' + "\n\n";
			} );
			this.editorInsertBlockElem( text );
			
			app.showMessage('success', (data.files.length > 1) ?
				"Your files were uploaded successfully, and links were placed into the body text." : 
				"Your file was uploaded successfully, and a link was placed into the body text."
			);
		}
		else {
			// attached as ticket files
			this.ticket.files = data.files;
			this.renderTicketFiles();
			
			app.showMessage('success', "Your file upload completed successfully.");
		}
	}
	
	editorUploadError(type, message, userData) {
		// avatar upload error
		Dialog.hideProgress();
		app.doError("Upload Failed: " + message);
	}
	
	getEditToolbar() {
		// return HTML for editor toolbar buttons
		var html = '';
		
		html += '<div class="editor_toolbar">';
			html += '<div class="editor_toolbar_button" title="Header 1" onClick="$P().editInsertHeader(1)"><i class="mdi mdi-format-header-1"></i></div>';
			html += '<div class="editor_toolbar_button" title="Header 2" onClick="$P().editInsertHeader(2)"><i class="mdi mdi-format-header-2"></i></div>';
			html += '<div class="editor_toolbar_button" title="Header 3" onClick="$P().editInsertHeader(3)"><i class="mdi mdi-format-header-3"></i></div>';
			html += '<div class="editor_toolbar_button" title="Header 4" onClick="$P().editInsertHeader(4)"><i class="mdi mdi-format-header-4"></i></div>';
			
			html += '<div class="editor_toolbar_divider"></div>';
			
			html += '<div class="editor_toolbar_button" title="Bold" onClick="$P().editToggleBold()"><i class="mdi mdi-format-bold"></i></div>';
			html += '<div class="editor_toolbar_button" title="Italic" onClick="$P().editToggleItalic()"><i class="mdi mdi-format-italic"></i></div>';
			html += '<div class="editor_toolbar_button" title="Strikethrough" onClick="$P().editToggleStrike()"><i class="mdi mdi-format-strikethrough"></i></div>';
			html += '<div class="editor_toolbar_button" title="Code" onClick="$P().editToggleCode()"><i class="mdi mdi-code-braces"></i></div>';
			
			html += '<div class="editor_toolbar_divider"></div>';
			
			html += '<div class="editor_toolbar_button" title="Insert Bullet List" onClick="$P().editInsertList()"><i class="mdi mdi-format-list-bulleted-square"></i></div>';
			html += '<div class="editor_toolbar_button" title="Insert Numbered List" onClick="$P().editInsertNumList()"><i class="mdi mdi-format-list-numbered"></i></div>';
			html += '<div class="editor_toolbar_button" title="Insert Blockquote" onClick="$P().editInsertQuote()"><i class="mdi mdi-format-quote-open"></i></div>';
			
			html += '<div class="editor_toolbar_button" title="Upload Files..." onClick="$P().editUploadFiles()"><i class="mdi mdi-cloud-upload-outline"></i></div>';
			
			html += '<div class="editor_toolbar_divider"></div>';
			
			html += '<div class="editor_toolbar_button" id="btn_scroll_lock" title="Scroll Lock" onClick="$P().toggleScrollLock()"><i class="mdi mdi-arrow-vertical-lock"></i></div>';
			
			// html += '<div class="editor_toolbar_divider"></div>';
			
			html += '<div class="editor_toolbar_button" id="btn_show_preview" title="Show Preview" onClick="$P().editShowPreview()"><i class="mdi mdi-file-find-outline"></i></div>';
			
			// html += '<div class="editor_toolbar_help"><a href="#Document?id=markdown" target="_blank">What\'s this?</a></div>';
			
			html += '<div class="clear"></div>';
		html += '</div>';
		
		return html;
	}
	
	editShowPreview() {
		// show popup preview of markdown
		this.viewMarkdownAuto( "Markdown Preview", this.editor.getValue(), " " );
	}
	
	toggleScrollLock() {
		// toggle vertical scroll lock
		if (this.scrollLock) {
			unscroll.reset();
			delete this.scrollLock;
			$('#btn_scroll_lock').removeClass('selected');
		}
		else {
			// lock it
			unscroll();
			this.scrollLock = true;
			$('#btn_scroll_lock').addClass('selected');
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
	
	updateTicket(ticket) {
		// received server update for ticket, redraw everything
		this.ticket = ticket;
		app.cacheBust = hires_time_now();
		
		// rerender subject and markdown
		this.div.find('#d_ticket_main_body div.btg_title').html( ticket.subject );
		this.div.find('#d_ticket_main_body div.markdown-body').html( marked.parse(ticket.body, config.ui.marked_config) );
		
		this.expandInlineImages('#d_ticket_main_body');
		this.highlightCodeBlocks('#d_ticket_main_body');
		
		// update all attribute controls
		this.div.find('#fe_et_assignees').val( ticket.assignees ).trigger('redraw');
		this.div.find('#fe_et_type').val( ticket.type ).trigger('redraw');
		this.div.find('#fe_et_status').val( ticket.status ).trigger('redraw');
		this.div.find('#fe_et_category').val( ticket.category ).trigger('redraw');
		this.div.find('#fe_et_server').val( ticket.server ).trigger('redraw');
		this.div.find('#fe_et_tags').val( ticket.tags ).trigger('redraw');
		this.div.find('#fe_et_cc').val( ticket.cc ).trigger('redraw');
		this.div.find('#fe_et_notify').val( ticket.notify ).trigger('redraw');
		this.div.find('#fe_et_due').val( ticket.due ? this.formatDateTZ(ticket.due, '[yyyy]-[mm]-[dd]', config.tz) : '' ).trigger('redraw'); // system timezone
		
		// render jobs, files, alerts
		this.renderTicketEvents();
		this.getTicketJobs();
		this.getTicketAlerts();
		
		// misc
		this.render_header();
		this.update_buttons();
		this.render_ticket_changes();
	}
	
	onResize() {
		if (this.editor) {
			switch (this.current_editor_type) {
				case 'main':
					this.div.find('#d_editor .CodeMirror').css('width', '' + this.div.find('div.form_grid').first().width() + 'px' );
				break;
				
				case 'add_comment':
				case 'edit_comment':
					this.div.find('#d_editor .CodeMirror').css('width', '' + Math.floor( this.div.find('div.form_grid').first().width() - 20) + 'px' );
				break;
				
				case 'new':
					this.div.find('#d_editor .CodeMirror').css('width', '' + this.div.find('div.fr_content').first().width() + 'px' );
				break;
			}
			this.editor.refresh();
		}
	}
	
	onStatusUpdate(data) {
		// hook main app status update (every 1s)
		if (this.args.sub != 'view') return;
		
		if (data.jobsChanged) this.getTicketJobs();
		else this.updateTicketJobs();
	}
	
	onDataUpdate(key, data) {
		// refresh list if servers were updated
		switch (this.args.sub) {
			case 'view':
				if (key == 'activeAlerts') {
					app.cacheBust = hires_time_now();
					this.getTicketAlerts();
				}
			break;
		}
	}
	
	onPageUpdate(pcmd, pdata) {
		// received update specifically for this page
		if ((this.args.sub == 'view') && (pcmd == 'ticket_updated') && (pdata.username != app.username)) {
			Debug.trace("Received ticket update from: " + pdata.username);
			this.updateTicket( pdata.ticket );
		}
	}
	
	onDeactivate() {
		// called when page is deactivated
		
		// this.killEditor();
		this.close_current_editor();
		
		// this.editHidePreview();
		this.div.html('');
		
		delete this.lastSearchResp;
		delete this.tickets;
		delete this.ticket;
		delete this.jobs;
		delete this.files;
		delete this.alerts;
		delete this.events;
		
		return true;
	}
	
};
