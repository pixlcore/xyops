// Alerts Page

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Alerts = class Alerts extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// alert history / search
		var self = this;
		var args = this.args;
		
		if (!args.offset) args.offset = 0;
		if (!args.limit) args.limit = 25;
		
		app.setWindowTitle('Alert History');
		app.setHeaderTitle( '<i class="mdi mdi-restore-alert">&nbsp;</i>Alert History' ); // or: cloud-alert-outline
		
		var html = '';
		html += '<div class="box" style="border:none;">';
		html += '<div class="box_content" style="padding:20px;">';
			
			// options
			html += '<div id="d_s_adv" class="form_grid" style="margin-bottom:25px">';
				
				// alert
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-bell-outline">&nbsp;</i>Alert Type:',
						content: this.getFormMenuSingle({
							id: 'fe_sa_alert',
							title: 'Select Alert',
							placeholder: 'All Alerts',
							options: [['', 'Any Alert']].concat( app.alerts ),
							value: args.alert || '',
							default_icon: 'bell-outline',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// server
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-router-network">&nbsp;</i>Server:',
						content: this.getFormMenuSingle({
							id: 'fe_sa_server',
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
				
				// group
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-server-network">&nbsp;</i>Group:',
						content: this.getFormMenuSingle({
							id: 'fe_sa_group',
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
							id: 'fe_sa_date',
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
						{ id: 'date_desc', title: 'Newest', icon: 'sort-descending' },
						{ id: 'date_asc', title: 'Oldest', icon: 'sort-ascending' }
					];
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-sort">&nbsp;</i>Sort Results:',
						content: this.getFormMenuSingle({
							id: 'fe_sa_sort',
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
			html += '<div class="button primary" onClick="$P().navSearch()"><i class="mdi mdi-magnify">&nbsp;</i>Search</div>';
			// html += '<div class="clear"></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		html += '<div id="d_search_results"><div class="loading_container"><div class="loading"></div></div></div>';
		
		this.div.html( html );
		
		var sargs = this.getSearchArgs();
		
		SingleSelect.init( this.div.find('#fe_sa_alert, #fe_sa_server, #fe_sa_group, #fe_sa_date, #fe_sa_sort') );
		// $('.header_search_widget').hide();
		
		this.div.find('#fe_sa_alert, #fe_sa_server, #fe_sa_group, #fe_sa_date, #fe_sa_sort').on('change', function() {
			self.navSearch();
		});
		
		this.doSearch();
		
		return true;
	}
	
	getSearchArgs() {
		// get form values, return search args object
		var args = {};
		
		var alert = this.div.find('#fe_sa_alert').val();
		if (alert) args.alert = alert;
		
		var server = this.div.find('#fe_sa_server').val();
		if (server) args.server = server;
		
		var group = this.div.find('#fe_sa_group').val();
		if (group) args.group = group;
		
		var date = this.div.find('#fe_sa_date').val();
		if (date) args.date = date;
		
		var sort = this.div.find('#fe_sa_sort').val();
		if (sort != 'date_desc') args.sort = sort;
		
		if (!num_keys(args)) return null;
		
		return args;
	}
	
	navSearch() {
		// convert form into query and redirect
		app.clearError();
		
		var args = this.getSearchArgs();
		if (!args) {
			Nav.go( this.selfNav({}) );
			return;
		}
		
		Nav.go( this.selfNav(args) );
	}
	
	getSearchQuery(args) {
		// construct actual unbase simple query syntax
		var query = '';
		
		if (args.alert) query += ' alert:' + args.alert;
		if (args.server) query += ' server:' + args.server;
		if (args.group) query += ' groups:' + args.group;
		
		if (args.date) {
			query += ' ' + this.getDateRangeQuery('start', args.date);
		}
		
		return query.trim();
	}
	
	doSearch() {
		// actually perform the search
		var args = this.args;
		var query = this.getSearchQuery(args);
		
		// compose search query
		var sopts = {
			query: query.trim(),
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
		
		app.api.get( 'app/search_alerts', sopts, this.receiveResults.bind(this) );
	}
	
	receiveResults(resp) {
		// receive search results
		var self = this;
		var $results = this.div.find('#d_search_results');
		var html = '';
		
		if (!this.active) return; // sanity
		
		this.lastSearchResp = resp;
		this.alerts = [];
		if (resp.rows) this.alerts = resp.rows;
		
		var grid_args = {
			resp: resp,
			cols: ["Alert ID", "Title", "Message", "Server", "Status", "Started", "Duration"],
			data_type: 'alert',
			class: 'data_grid alert_invo_grid',
			offset: this.args.offset || 0,
			limit: this.args.limit,
			pagination_link: '$P().searchPaginate'
		};
		
		html += '<div class="box">';
		
		html += '<div class="box_title" style="' + (this.alerts.length ? 'padding-bottom:10px' : '') + '">';
			html += this.getSearchArgs() ? 'Search Results' : 'All Alerts';
			html += '<div class="clear"></div>';
		html += '</div>';
		
		html += '<div class="box_content table">';
		
		html += this.getPaginatedGrid( grid_args, function(item, idx) {
			return [
				'<b>' + self.getNiceAlertID(item, true) + '</b>',
				self.getNiceAlert(item.alert, false),
				encode_entities(item.message),
				self.getNiceServer(item.server, false),
				self.getNiceAlertStatus(item),
				self.getRelativeDateTime(item.date),
				self.getNiceAlertElapsedTime(item, true, true)
			];
		} );
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		$results.html( html );
	}
	
	searchPaginate(offset) {
		// special hook for intercepting pagination clicks
		// FUTURE: history.replaceState to update the URI with new offset
		this.args.offset = offset;
		this.div.find('#d_search_results .box_content').addClass('loading');
		this.doSearch();
	}
	
	gosub_view(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		app.setHeaderTitle( '...' );
		
		this.alert = null;
		this.def = null;
		
		this.loading();
		app.api.get( 'app/search_alerts', { query: '#id:' + args.id }, this.receive_alert.bind(this), this.fullPageError.bind(this) );
		return true;
	}
	
	receive_alert(resp) {
		// render alert details
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		var alert = this.alert = resp.rows.shift();
		if (!alert) return this.doFullPageError("Alert ID not found: " + this.args.id);
		
		var def = this.def = find_object( app.alerts, { id: alert.alert } );
		if (!def) def = { title: '(' + alert.alert + ')' };
		
		// var icon = '<i class="mdi mdi-' + (alert.active ? 'progress-alert' : 'alert-circle-outline') + '">&nbsp;</i>';
		
		app.setHeaderNav([
			{ icon: 'restore-alert', loc: '#Alerts?sub=list', title: 'Alert History' },
			{ icon: (alert.active ? 'progress-alert' : 'alert-circle-outline'), title: "Alert Details" }
		]);
		
		// app.setHeaderTitle( icon + 'Alert Details' );
		app.setWindowTitle( "Viewing Alert \"" + (this.def.title) + "\"" );
		
		html += '<div class="box">';
			
			html += '<div class="box_title grid">';
				html += `<div class="btg_title">${encode_entities(alert.message)}</div>`;
				html += '<div class="btg_buttons">';
					if (app.hasPrivilege('create_tickets') && app.hasPrivilege('edit_tickets')) {
						html += '<div class="button icon secondary mobile_hide" title="Create Ticket..." onClick="$P().doCreateTicket()"><i class="mdi mdi-text-box-plus-outline"></i></div>';
					}
					if (app.hasPrivilege('edit_tickets')) {
						html += '<div class="button icon secondary mobile_hide" title="Add to Ticket..." onClick="$P().doAddToTicket()"><i class="mdi mdi-text-box-search-outline"></i></div>';
					}
					html += '<div class="button icon danger" title="Delete Alert..." onClick="$P().showDeleteAlertDialog()"><i class="mdi mdi-trash-can-outline"></i></div>';
				html += '</div>';
			html += '</div>'; // box_title
			
			html += '<div class="box_content table">';
				html += '<div class="summary_grid">';
				
					// row 1
					html += '<div>';
						html += '<div class="info_label">Alert ID</div>';
						html += '<div class="info_value monospace">' + this.getNiceCopyableID(alert.id) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Alert Definition</div>';
						html += '<div class="info_value">' + this.getNiceAlert(alert.alert, true) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Server</div>';
						html += '<div class="info_value">' + this.getNiceServer(alert.server, true) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Date/Time</div>';
						html += '<div class="info_value">' + this.getRelativeDateTime( alert.date ) + '</div>';
					html += '</div>';
					
					// row 2
					html += '<div class="overflow">';
						html += '<div class="info_label">Status</div>';
						html += '<div class="info_value overflow" style="font-weight:normal;">' + this.getNiceAlertStatus(alert) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Expression</div>';
						html += '<div class="info_value monospace">' + encode_entities(alert.exp) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Groups</div>';
						html += '<div class="info_value">' + this.getNiceGroupList(alert.groups) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Duration</div>';
						html += '<div class="info_value">' + this.getNiceAlertElapsedTime( alert ) + '</div>';
					html += '</div>';
					
				html += '</div>'; // summary grid
			html += '</div>'; // box content
		html += '</div>'; // box
		
		// snapshots
		html += '<div class="box toggle" id="d_va_snapshots">';
			html += '<div class="box_title">';
				html += '<i></i><span>Alert Snapshots</span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// tickets
		html += '<div class="box toggle" id="d_va_tickets" style="display:none">';
			html += '<div class="box_title">';
				html += '<i></i><span>Alert Tickets</span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// jobs
		html += '<div class="box toggle" id="d_va_jobs">';
			html += '<div class="box_title">';
				html += '<i></i><span>Alert Jobs</span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// actions
		html += '<div class="box toggle" id="d_va_actions">';
			html += '<div class="box_title">';
				html += '<i></i><span>Alert Actions</span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// history
		html += '<div class="box toggle" id="d_va_history">';
			html += '<div class="box_title">';
				html += '<i></i><span>Alert History</span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html(html);
		
		this.getAlertSnapshots();
		this.getAlertTickets();
		this.getAlertJobs();
		this.renderAlertActions();
		this.getAlertHistory();
		this.setupToggleBoxes();
	}
	
	doCreateTicket() {
		// create new ticket and attach to alert
		var self = this;
		var alert = this.alert;
		var def = this.def;
		var title = "Create New Ticket";
		var btn = ['text-box-plus-outline', "Create Ticket"];
		var html = '';
		
		var nice_server = this.getNiceServerText(alert.server);
		var new_subject = `Alert: ${def.title} on ${nice_server}`;
		
		html += `<div class="dialog_intro">${config.ui.intros.alert_create_ticket}</div>`;
		html += '<div class="dialog_box_content scroll maximize">';
		
		// subject
		html += this.getFormRow({
			id: 'd_nt_subject',
			content: this.getFormText({
				id: 'fe_nt_subject',
				// spellcheck: 'false',
				value: new_subject
			})
		});
		
		// type
		html += this.getFormRow({
			id: 'd_nt_type',
			content: this.getFormMenuSingle({
				id: 'fe_nt_type',
				options: config.ui.ticket_types,
				value: 'issue',
				// 'data-shrinkwrap': 1
			})
		});
		
		// assignees
		html += this.getFormRow({
			id: 'd_nt_assignees',
			content: this.getFormMenuMulti({
				id: 'fe_nt_assignees',
				options: app.users.map( function(user) { return { id: user.username, title: user.full_name, icon: user.icon || 'account' }; } ),
				values: [ app.username ],
				auto_add: true,
				// 'data-shrinkwrap': 1
			})
		});
		
		// tags
		html += this.getFormRow({
			id: 'd_nt_tags',
			content: this.getFormMenuMulti({
				id: 'fe_nt_tags',
				options: app.tags,
				values: [],
				// 'data-shrinkwrap': 1
			})
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			var ticket = {
				subject: $('#fe_nt_subject').val().trim(),
				template: 'alert', // generate ticket body from template
				alert: alert.id,
				type: $('#fe_nt_type').val(),
				status: 'open',
				category: '',
				assignees: $('#fe_nt_assignees').val(),
				cc: [],
				notify: [],
				events: [],
				tags: $('#fe_nt_tags').val(),
				due: '',
				server: alert.server || ''
			};
			if (!ticket.subject.length) return app.badField('#fe_nt_subject', "Please enter a subject line for the ticket.");
			
			Dialog.showProgress( 1.0, "Creating Ticket..." );
			
			app.api.post( 'app/create_ticket', ticket, function(resp) {
				// now add new ticket id to alert
				ticket = resp.ticket;
				
				if (!alert.tickets) alert.tickets = [];
				alert.tickets.push( ticket.id );
				
				app.api.post( 'app/manage_alert_invocation_tickets', { id: alert.id, tickets: alert.tickets }, function(resp) {
					Dialog.hideProgress();
					app.cacheBust = hires_time_now();
					app.showMessage('success', "Ticket successfully created.");
					
					// Note: We MUST nav to the ticket id here, as the rest is being indexed in the background
					Nav.go('Tickets?sub=view&id=' + ticket.id);
				} ); // api.post (mjt)
			} ); // api.post (ct)
		}); // Dialog.confirm
		
		MultiSelect.init( $('#fe_nt_assignees, #fe_nt_tags') );
		SingleSelect.init( $('#fe_nt_type') );
		Dialog.autoResize();
		
		$('#fe_nt_subject').focus().get(0).setSelectionRange( new_subject.length, new_subject.length );
	}
	
	doAddToTicket() {
		// attach alert to existing ticket
		var self = this;
		var alert = this.alert;
		var title = "Add to Ticket";
		var btn = ['text-box-plus-outline', "Add to Ticket"];
		var html = '';
		var tickets = [];
		
		html += `<div class="dialog_intro">${config.ui.intros.alert_add_to_ticket}</div>`;
		html += '<div class="dialog_box_content scroll maximize">';
		
		// ticket picker
		html += this.getFormRow({
			id: 'd_ad_ticket',
			label: "Select Ticket:",
			content: this.getFormMenuSingle({
				id: 'fe_ad_ticket',
				title: "Select Ticket",
				options: [ { id: '', title: config.ui.menu_bits.generic_loading } ],
				default_icon: 'text-box-outline',
				value: ''
			}),
			caption: "Select a ticket to attach the alert to."
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			var ticket_id = $('#fe_ad_ticket').val();
			if (!ticket_id) return app.badField('#fe_ad_ticket', "Please select a ticket to attach the alert to.");
			
			if (!alert.tickets) alert.tickets = [];
			if (alert.tickets.includes(ticket_id)) return app.badField('#fe_ad_ticket', "The alert is already attached to that ticket.");
			
			alert.tickets.push( ticket_id );
			
			Dialog.showProgress( 1.0, "Updating Ticket..." );
			
			app.api.post( 'app/manage_alert_invocation_tickets', { id: alert.id, tickets: alert.tickets }, function(resp) {
				// all done
				Dialog.hideProgress();
				app.cacheBust = hires_time_now();
				app.showMessage('success', "Alert successfully added to ticket.");
				
				// Note: We MUST nav to the ticket id here, as the rest is being indexed in the background
				Nav.go('Tickets?sub=view&id=' + ticket_id);
			} ); // api.post
		}); // Dialog.confirm
		
		SingleSelect.init('#fe_ad_ticket');
		Dialog.autoResize();
		
		// ticket search
		app.api.get( 'app/search_tickets', { query: 'status:open', limit: config.alt_items_per_page }, function(resp) {
			tickets = resp.rows || [];
			
			var items = (resp.rows || []).map( function(ticket) {
				return { id: ticket.id, title: `#${ticket.num}: ${ticket.subject}` };
			} );
			
			if (!items.length) {
				$('#fe_ad_ticket').html( render_menu_options( [{ id: '', title: "(No tickets found)" }], '' ) ).trigger('change');
				return;
			}
			
			// change menu items and fire onChange event for redraw
			$('#fe_ad_ticket').html( render_menu_options( items, items[0].id ) ).trigger('change');
		} ); // api.get
	}
	
	getAlertSnapshots() {
		// fetch snapshots associated with alert
		var self = this;
		var alert = this.alert;
		
		var opts = {
			query: 'alerts:' + alert.id,
			offset: 0,
			limit: config.items_per_page, // no pagination, so this is just a sanity limit
			sort_by: '_id',
			sort_dir: -1,
			ttl: 1
		};
		
		app.api.get( 'app/search_snapshots', opts, function(resp) {
			self.snapshots = resp.rows || [];
			self.renderAlertSnapshots();
		});
	}
	
	renderAlertSnapshots() {
		// render details on alert snapshots
		var self = this;
		var alert = this.alert;
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		if (!this.snapshots || !this.snapshots.length) {
			$('#d_va_snapshots').hide();
			return;
		}
		
		var snapshots = this.snapshots;
		var cols = ["Snapshot ID", "Source", "Server", "Uptime", "Load Avg", "Mem Avail", "Date/Time"];
		var html = '';
		
		var grid_args = {
			rows: snapshots,
			cols: cols,
			data_type: 'snapshot'
		};
		
		html += this.getBasicGrid( grid_args, function(item, idx) {
			if (!item.data) item.data = {}; // sanity
			if (!item.data.memory) item.data.memory = {}; // sanity
			
			return [
				'<b>' + self.getNiceSnapshotID(item, true) + '</b>',
				self.getNiceSnapshotSource(item),
				self.getNiceServer(item.server || alert.server, true),
				get_text_from_seconds(item.data.uptime_sec || 0, true, true),
				item.data.load.map( function(value) { return short_float(value); } ).join(', '),
				get_text_from_bytes(item.data.memory.available || 0),
				self.getRelativeDateTime(item.date)
			];
		}); // grid
		
		$('#d_va_snapshots > div.box_content').html( html );
		$('#d_va_snapshots').show();
	}
	
	getAlertTickets() {
		// load ticket info for display
		var self = this;
		var alert = this.alert;
		
		if (!alert.tickets || !alert.tickets.length) {
			this.div.find('#d_va_tickets').hide();
			return;
		}
		
		app.api.post( 'app/get_tickets', { ids: alert.tickets }, function(resp) {
			self.tickets = resp.tickets || [];
			self.renderAlertTickets();
		});
	}
	
	renderAlertTickets() {
		// render tickets in table
		var self = this;
		var tickets = this.tickets;
		var html = '';
		
		if (!tickets.length) {
			this.div.find('#d_va_tickets').hide();
			return;
		}
		
		var grid_args = {
			rows: tickets,
			cols: ['#', 'Subject', 'Type', 'Status', 'Assignees', 'Tags', 'Created', 'Actions'],
			data_type: 'ticket',
			empty_msg: 'No tickets found.'
		};
		
		html += this.getBasicGrid( grid_args, function(ticket, idx) {
			var actions = [
				'<span class="link danger" onClick="$P().doRemoveTicket(' + idx + ')"><b>Remove</b></span>'
			];
			
			// handle deleted tickets (should be rare, as they're cleaned up in background)
			if (ticket.err) return [
				'<div class="monospace">#</div>',
				'(Ticket was deleted)',
				'n/a', // type
				'n/a', // status
				'n/a', // assignees
				'n/a', // tags
				'n/a', // created
				'<span class="nowrap">' + actions.join(' | ') + '</span>'
			];
			
			return [
				'<div class="monospace">#' + ticket.num + '</div>',
				self.getNiceTicket(ticket, true),
				self.getNiceTicketType(ticket.type),
				self.getNiceTicketStatus(ticket.status),
				self.getNiceUserList(ticket.assignees, app.isAdmin()),
				self.getNiceTagList( ticket.tags, false ),
				self.getRelativeDateTime( ticket.created, true ),
				'<span class="nowrap">' + actions.join(' | ') + '</span>'
			];
		});
		
		this.div.find('#d_va_tickets > .box_content').html(html);
		this.div.find('#d_va_tickets').show();
	}
	
	doRemoveTicket(idx) {
		// remove ticket from alert
		var self = this;
		var alert = this.alert;
		var ticket = this.tickets[idx];
		
		Dialog.confirmDanger( 'Remove Ticket', "Are you sure you want to remove the ticket &ldquo;<b>" + ticket.subject + "</b>&rdquo; from the current alert invocation?  This will not delete the ticket itself.", ['trash-can', 'Remove'], function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Removing Ticket..." );
			
			// remove our ticket id from the alert ticket list
			var new_tickets = alert.tickets.filter( function(ticket_id) { return ticket_id != ticket.id } );
			
			app.api.post( 'app/manage_alert_invocation_tickets', { id: alert.id, tickets: new_tickets }, function(resp) {
				Dialog.hideProgress();
				app.cacheBust = hires_time_now();
				alert.tickets = new_tickets;
				app.showMessage('success', "Ticket successfully removed.");
				self.getAlertTickets();
			} ); // api.post
		} ); // confirm
	}
	
	getAlertJobs() {
		// fetch info about all alert jobs
		var self = this;
		var alert = this.alert;
		
		if (!alert.jobs || !alert.jobs.length) {
			this.jobs = [];
			return this.renderAlertJobs();
		}
		
		app.api.post( 'app/get_jobs', { ids: alert.jobs }, function(resp) {
			self.jobs = resp.jobs || [];
			self.renderAlertJobs();
		});
	}
	
	renderAlertJobs() {
		// render alert jobs
		var self = this;
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		var grid_args = {
			rows: this.jobs,
			cols: ['Job ID', 'Server', 'Source', 'Started', 'Elapsed', 'Avg CPU/Mem', 'Result'],
			data_type: 'job',
			class: 'data_grid job_history_grid'
		};
		
		html += this.getBasicGrid( grid_args, function(job, idx) {
			if (job.err) return [ '(Job deleted)', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a' ];
			
			var tds = [
				'<b>' + self.getNiceJob(job, true) + '</b>',
				self.getNiceServer(job.server, true),
				self.getNiceJobSource(job),
				self.getShortDateTime( job.started ),
				self.getNiceJobElapsedTime(job, true),
				self.getNiceJobAvgCPU(job) + ' / ' + self.getNiceJobAvgMem(job),
				self.getNiceJobResult(job),
				// '<a href="#Job?id=' + job.id + '">Details</a>'
			];
			
			if (job.suspended) tds.className = 'suspended';
			else if (job.category) {
				var category = find_object( app.categories, { id: job.category } );
				if (category && category.color) tds.className = 'clr_' + category.color;
			}
			
			return tds;
		} );
		
		this.div.find('#d_va_jobs > .box_content').html( html );
	}
	
	renderAlertActions() {
		// render details on executed alert actions
		var self = this;
		var alert = this.alert;
		if (!this.active) return; // sanity
		
		// we're only interested in actions that actually fired (and aren't hidden)
		var actions = this.actions = (alert.actions || []).filter( function(action) { return !!(action.date && !action.hidden); } );
		
		// decorate actions with idx, for linking
		actions.forEach( function(action, idx) { action.idx = idx; } );
		
		if (!actions.length) {
			$('#d_va_actions').hide();
			return;
		}
		
		var cols = ["Condition", "Type", "Source", "Description", "Date/Time", "Elapsed", "Result", "Actions"];
		var html = '';
		
		var grid_args = {
			rows: sort_by(actions, 'condition', { dir: -1 }), // sort in place, so idx works below
			cols: cols,
			data_type: 'action'
		};
		
		html += this.getBasicGrid( grid_args, function(item, idx) {
			var disp = self.getJobActionDisplayArgs(item, true); // condition, type, text, desc, icon
			
			var link = '';
			if (item.loc) link = `Nav.go('${item.loc}')`;
			else if (item.description || item.details) link = `$P().viewActionDetails(${idx})`;
			
			var view_details = 'n/a';
			if (link) view_details = '<span class="link" onClick="' + link + '">View Details...</span>';
			
			return [
				'<span class="link nowrap" onClick="' + link + '"><b><i class="mdi mdi-' + disp.condition.icon + '"></i>' + disp.condition.title + '</b></span>',
				'<i class="mdi mdi-' + disp.icon + '">&nbsp;</i>' + disp.type,
				self.getNiceActionSource(item.source || 'alert'),
				disp.desc,
				self.getRelativeDateTime(item.date, true),
				'<i class="mdi mdi-clock-check-outline">&nbsp;</i>' + get_text_from_ms_round( Math.floor(item.elapsed_ms), true),
				self.getNiceActionResult(item),
				'<b>' + view_details + '</b>'
			];
		}); // grid
		
		$('#d_va_actions > div.box_content').html( html );
		$('#d_va_actions').show();
	}
	
	viewActionDetails(idx) {
		// popup dialog to show action results
		var self = this;
		var action = this.actions[idx];
		var disp = self.getJobActionDisplayArgs(action); // condition, type, text, desc, icon
		var details = action.details || "";
		
		if (action.description) {
			details = "**Result:** " + action.description + "\n\n" + details;
		}
		
		var title = "Alert Action Details: " + disp.type;
		if (action.code) title = '<span style="color:var(--red);">' + title + '</span>';
		
		this.viewMarkdownAuto( title, details.trim() );
	}
	
	getAlertHistory() {
		// fetch history of alert on current server
		var self = this;
		var alert = this.alert;
		if (!this.alertHistoryOffset) this.alertHistoryOffset = 0;
		
		var opts = {
			query: 'alert:' + alert.alert + ' server:' + alert.server,
			offset: this.alertHistoryOffset,
			limit: config.alt_items_per_page,
			sort_by: '_id',
			sort_dir: -1,
			ttl: 1
		};
		
		app.api.get( 'app/search_alerts', opts, this.renderAlertHistory.bind(this));
	}
	
	renderAlertHistory(resp) {
		// render alert history
		var self = this;
		var cols = ["Alert ID", "Title", "Message", "Server", "Status", "Started", "Duration"];
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		var grid_args = {
			resp: resp,
			cols: cols,
			offset: 0,
			limit: config.alt_items_per_page,
			sort_by: '_id',
			sort_dir: -1,
			data_type: 'alert',
			pagination_link: '$P().alertHistoryNav'
		};
		
		html += this.getPaginatedGrid( grid_args, function(item, idx) {
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
		
		$('#d_va_history > div.box_content').removeClass('loading').html( html );
	}
	
	alertHistoryNav(offset) {
		// intercept click on history table pagination nav
		this.alertHistoryOffset = offset;
		this.div.find('#d_va_history > .box_content').addClass('loading');
		this.getAlertHistory();
	}
	
	showDeleteAlertDialog() {
		// delete alert invocation after user confirmation
		var self = this;
		var alert = this.alert;
		
		Dialog.confirmDanger( 'Delete Alert', "Are you sure you want to permanently delete the current alert invocation?  There is no way to undo this operation.", ['trash-can', 'Delete'], function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Deleting Alert..." );
			
			app.api.post( 'app/delete_alert_invocation', { id: alert.id }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "Alert invocation &ldquo;" + alert.id + "&rdquo; was deleted successfully.");
				
				if (!self.active) return; // sanity
				
				Nav.go('#Alerts?sub=list');
			} ); // api.post
		} ); // confirm
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		
		delete this.lastSearchResp;
		delete this.alerts;
		delete this.alert;
		delete this.def;
		delete this.snapshots;
		delete this.jobs;
		delete this.tickets;
		
		return true;
	}
	
};
