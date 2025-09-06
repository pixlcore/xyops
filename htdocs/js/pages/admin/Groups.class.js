// Admin Page -- Group Config

// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the PixlCore Sustainable Use License.
// See the LICENSE.md file in this repository.

Page.Groups = class Groups extends Page.ServerUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'eg';
		
		// debounce for view sub
		this.applyServerTableFiltersDebounce = debounce( this.applyServerTableFilters.bind(this), 250 );
		this.renderProcessTableDebounce = debounce( this.renderGroupProcessTable.bind(this), 1000 );
		this.renderConnectionTableDebounce = debounce( this.renderGroupConnectionTable.bind(this), 1000 );
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		// WIP:
		// if (!this.requireAnyPrivilege('create_groups', 'edit_groups', 'delete_groups')) return true;
		
		if (!args) args = {};
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show group list
		app.setWindowTitle( "Server Groups" );
		app.setHeaderTitle( '<i class="mdi mdi-lan">&nbsp;</i>Server Groups' );
		
		// this.loading();
		// app.api.post( 'app/get_groups', copy_object(args), this.receive_groups.bind(this) );
		
		// kill drag operation if in progress (i.e. from onDataUpdate)
		this.cancelGridDrag( this.div.find('div.data_grid') );
		
		// use groups in app cache
		this.receive_groups({
			code: 0,
			rows: app.groups,
			list: { length: app.groups.length }
		});
	}
	
	receive_groups(resp) {
		// receive all groups from server, render them sorted
		var self = this;
		var html = '';
		
		if (!resp.rows) resp.rows = [];
		this.groups = resp.rows;
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['<i class="mdi mdi-menu"></i>', 'Group Title', 'Group ID', 'Servers', 'Hostname Pattern', 'Author', 'Created', 'Actions'];
		// if (app.isGroupLimited()) cols.shift();
		
		var drag_handle = app.isGroupLimited() ? '<div class="td_drag_handle" style="cursor:default"><i class="mdi mdi-menu"></i></div>' : 
			'<div class="td_drag_handle" draggable="true" title="Drag to reorder"><i class="mdi mdi-menu"></i></div>';
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Server Groups';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var grid_opts = {
			rows: this.groups,
			cols: cols,
			data_type: 'group',
			grid_template_columns: 'min-content' + ' auto'.repeat( cols.length - 1 )
		};
		
		html += this.getBasicGrid( grid_opts, function(item, idx) {
			var actions = [];
			if (app.hasPrivilege('edit_groups')) actions.push( '<span class="link" onClick="$P().edit_group('+idx+')"><b>Edit</b></span>' );
			if (app.hasPrivilege('delete_groups')) actions.push( '<span class="link danger" onClick="$P().delete_group('+idx+')"><b>Delete</b></span>' );
			
			var nice_match = '';
			if (item.hostname_match == '(?!)') nice_match = '(None)';
			else nice_match = '<span class="regexp">/' + item.hostname_match + '/</span>';
			
			var servers = Object.values(app.servers).filter( function(server) {
				return server.groups && server.groups.includes(item.id);
			} );
			
			var tds = [
				drag_handle,
				'<b>' + self.getNiceGroup(item, true) + '</b>',
				'<span class="mono">' + item.id + '</span>',
				'<span id="s_grp_servers_' + item.id + '">' + commify( servers.length ) + '</span>',
				nice_match,
				self.getNiceUser(item.username, app.isAdmin()),
				'<span title="'+self.getNiceDateTimeText(item.created)+'">'+self.getNiceDate(item.created)+'</span>',
				actions.join(' | ')
			];
			// if (app.isGroupLimited()) tds.shift();
			
			return tds;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			if (app.hasAnyPrivilege('create_groups', 'edit_groups')) html += '<div class="button phone_collapse" onClick="$P().doFileImportPrompt()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i><span>Import File...</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().go_history()"><i class="mdi mdi-history">&nbsp;</i><span>Revision History...</span></div>';
			if (app.hasPrivilege('create_groups')) html += '<div class="button default" onClick="$P().edit_group(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i><span>New Group...</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.setupBoxButtonFloater();
		
		if (!app.isGroupLimited()) this.setupDraggableGrid({
			table_sel: this.div.find('div.data_grid'), 
			handle_sel: 'div.td_drag_handle', 
			drag_ghost_sel: 'div:nth-child(2)', 
			drag_ghost_x: 5, 
			drag_ghost_y: 10, 
			callback: this.group_move.bind(this)
		});
	}
	
	update_server_counts() {
		// update server counters per group (called when servers change)
		this.groups.forEach( function(item) {
			var servers = Object.values(app.servers).filter( function(server) {
				return server.groups && server.groups.includes(item.id);
			} );
			$('#s_grp_servers_' + item.id).html( commify(servers.length) );
		} );
	}
	
	group_move($rows) {
		// a drag operation has been completed
		var items = [];
		
		$rows.each( function(idx) {
			var $row = $(this);
			items.push({
				id: $row.data('id'),
				sort_order: idx
			});
		});
		
		var data = {
			items: items
		};
		app.api.post( 'app/multi_update_group', data, function(resp) {
			// done
		} );
	}
	
	edit_group(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Groups?sub=edit&id=' + this.groups[idx].id );
		else Nav.go( '#Groups?sub=new' );
	}
	
	delete_group(idx) {
		// delete group from search results
		this.group = this.groups[idx];
		this.show_delete_group_dialog();
	}
	
	go_history() {
		Nav.go( '#Groups?sub=history' );
	}
	
	gosub_history(args) {
		// show revision history sub-page
		app.setHeaderNav([
			{ icon: 'lan', loc: '#Groups?sub=list', title: 'Server Groups' },
			{ icon: 'history', title: "Revision History" }
		]);
		app.setWindowTitle( "Group Revision History" );
		
		this.goRevisionHistory({
			activityType: 'groups',
			itemKey: 'group',
			editPageID: 'Groups',
			itemMenu: {
				label: '<i class="icon mdi mdi-lan">&nbsp;</i>Group:',
				title: 'Select Group',
				options: [['', 'Any Group']].concat( app.groups ),
				default_icon: 'server-network'
			}
		});
	}
	
	gosub_new(args) {
		// create new group
		var html = '';
		app.setWindowTitle( "New Group" );
		
		app.setHeaderNav([
			{ icon: 'lan', loc: '#Groups?sub=list', title: 'Server Groups' },
			{ icon: 'server-network', title: "New Group" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New Server Group';
			html += '<div class="box_subtitle"><a href="#Groups?sub=list">&laquo; Back to Group List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.group = {
			id: "",
			title: "",
			hostname_match: "",
			mute_alerts: false
		};
		
		html += this.get_group_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button phone_collapse" onClick="$P().cancel_group_new()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button primary" onClick="$P().do_new_group()"><i class="mdi mdi-floppy">&nbsp;</i><span>Create Group</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_eg_icon, #fe_eg_web_hook') );
		$('#fe_eg_title').focus();
		this.setupBoxButtonFloater();
	}
	
	cancel_group_new() {
		// cancel editing group and return to list
		Nav.go( '#Groups?sub=list' );
	}
	
	do_new_group(force) {
		// create new group
		app.clearError();
		var group = this.get_group_form_json();
		if (!group) return; // error
		
		this.group = group;
		
		Dialog.showProgress( 1.0, "Creating Group..." );
		app.api.post( 'app/create_group', group, this.new_group_finish.bind(this) );
	}
	
	new_group_finish(resp) {
		// new group created successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Groups?sub=list');
		app.showMessage('success', "The new group was created successfully.");
	}
	
	gosub_edit(args) {
		// edit group subpage
		this.loading();
		app.api.post( 'app/get_group', { id: args.id }, this.receive_group.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_group(resp) {
		// edit existing group
		var html = '';
		
		if (this.args.rollback && this.rollbackData) {
			resp.group = this.rollbackData;
			delete this.rollbackData;
			app.showMessage('info', `Revision ${resp.group.revision} has been loaded as a draft edit.  Click 'Save Changes' to complete the rollback.  Note that a new revision number will be assigned.`);
		}
		
		this.group = resp.group;
		if (!this.active) return; // sanity
		
		app.setWindowTitle( "Editing Group \"" + (this.group.title) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'lan', loc: '#Groups?sub=list', title: 'Server Groups' },
			{ icon: this.group.icon || 'server-network', loc: '#Groups?sub=view&id=' + this.group.id, title: this.group.title },
			{ icon: 'file-edit-outline', title: "Edit Group" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit Server Group Details';
			html += '<div class="box_subtitle"><a href="#Groups?sub=view&id=' + this.group.id + '">&laquo; Back to Group View</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_group_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button mobile_collapse" onClick="$P().cancel_group_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			html += '<div class="button danger mobile_collapse" onClick="$P().show_delete_group_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
			html += '<div class="button primary phone_collapse" onClick="$P().do_save_group()"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Changes</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_eg_icon, #fe_eg_web_hook') );
		this.setupBoxButtonFloater();
	}
	
	do_export() {
		// show export dialog
		app.clearError();
		var group = this.get_group_form_json();
		if (!group) return; // error
		
		this.showExportOptions({
			name: 'group',
			dataType: 'group',
			api: this.args.id ? 'update_group' : 'create_group',
			data: group
		});
	}
	
	go_edit_history() {
		Nav.go( '#Groups?sub=history&id=' + this.group.id );
	}
	
	cancel_group_edit() {
		// cancel editing group and return to view
		Nav.go( '#Groups?sub=view&id=' + this.group.id );
	}
	
	do_save_group() {
		// save changes to group
		app.clearError();
		var group = this.get_group_form_json();
		if (!group) return; // error
		
		this.group = group;
		
		Dialog.showProgress( 1.0, "Saving Group..." );
		app.api.post( 'app/update_group', group, this.save_group_finish.bind(this) );
	}
	
	save_group_finish(resp) {
		// new group saved successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		// update in-memory copy, to prevent race condition on view page
		var idx = find_object_idx(app.groups, { id: this.group.id });
		if (idx > -1) {
			this.group.modified = app.epoch;
			this.group.revision++;
			merge_hash_into( app.groups[idx], this.group );
		}
		
		Nav.go( '#Groups?sub=view&id=' + this.group.id );
		app.showMessage('success', "The server group was saved successfully.");
	}
	
	show_delete_group_dialog() {
		// show dialog confirming group delete action
		var self = this;
		
		Dialog.confirmDanger( 'Delete Group', "Are you sure you want to <b>permanently delete</b> the server group &ldquo;" + this.group.title + "&rdquo;?  There is no way to undo this action.", ['trash-can', 'Delete'], function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Group..." );
				app.api.post( 'app/delete_group', self.group, self.delete_group_finish.bind(self) );
			}
		} );
	}
	
	delete_group_finish(resp) {
		// finished deleting group
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Groups?sub=list', 'force');
		app.showMessage('success', "The server group &ldquo;" + this.group.title + "&rdquo; was deleted successfully.");
	}
	
	get_group_edit_html() {
		// get html for editing an group (or creating a new one)
		var html = '';
		var group = this.group;
		
		if (group.id) {
			// group id
			html += this.getFormRow({
				label: 'Group ID:',
				content: this.getFormText({
					id: 'fe_eg_id',
					class: 'monospace',
					spellcheck: 'false',
					disabled: 'disabled',
					value: group.id
				}),
				suffix: this.getFormIDCopier(),
				caption: 'This is a unique ID for the group, used by the xyOps API.  It cannot be changed.'
			});
		}
		
		// title
		html += this.getFormRow({
			label: 'Group Title:',
			content: this.getFormText({
				id: 'fe_eg_title',
				spellcheck: 'false',
				value: group.title
			}),
			caption: 'Enter the title of the group, for display purposes.'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_eg_icon',
				title: 'Select icon for group',
				placeholder: 'Select icon for group...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: group.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for the group.'
		});
		
		// hostname_match
		html += this.getFormRow({
			label: 'Hostname Match:',
			content: this.getFormText({
				id: 'fe_eg_match',
				class: 'regexp',
				// style: 'font-family:monospace',
				spellcheck: 'false',
				value: (group.hostname_match == '(?!)') ? "" : group.hostname_match
			}),
			caption: 'Optionally enter a regular expression match to auto-include hostnames in the group.<br/>To match <b>all servers</b>, set this to <code>.+</code>'
		});
		
		// alert emails
		html += this.getFormRow({
			label: 'Alert Email:',
			content: this.getFormText({
				id: 'fe_eg_alert_email',
				// type: 'email',
				spellcheck: 'false',
				placeholder: 'email@sample.com',
				value: group.alert_email || '',
				onChange: '$P().updateAddRemoveMe(this)',
				'data-private': ''
			}),
			suffix: '<div class="form_suffix_icon mdi" title="" onClick="$P().addRemoveMe(this)"></div>',
			caption: 'Optionally set the default e-mail recipients to be notified for alerts in this group. Note that individual alerts can override this setting.'
		});
		
		// alert web hook
		html += this.getFormRow({
			label: 'Alert Web Hook:',
			content: this.getFormMenuSingle({
				id: 'fe_eg_web_hook',
				title: 'Select Web Hook',
				options: [ ['', "(None)"] ].concat( app.web_hooks ),
				value: group.alert_web_hook,
				default_icon: 'webhook'
			}),
			caption: 'Optionally set the default Web Hook for alerts in this group. Note that individual alerts can override this setting.'
		});
		
		// mute_alerts
		html += this.getFormRow({
			label: 'Mute:',
			content: this.getFormCheckbox({
				id: 'fe_eg_mute',
				label: 'Mute Alerts',
				checked: group.mute_alerts
			}),
			caption: 'Check this box to silence all monitoring alerts for servers in the group.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_eg_notes',
				rows: 5,
				value: group.notes
			}),
			caption: 'Optionally enter any notes for the group, for your own use.'
		});
		
		return html;
	}
	
	get_group_form_json() {
		// get api key elements from form, used for new or edit
		var group = this.group;
		
		group.title = $('#fe_eg_title').val().trim();
		group.icon = $('#fe_eg_icon').val();
		group.hostname_match = $('#fe_eg_match').val();
		group.alert_email = $('#fe_eg_alert_email').val();
		group.alert_web_hook = $('#fe_eg_web_hook').val();
		group.mute_alerts = !!$('#fe_eg_mute').is(':checked');
		group.notes = $('#fe_eg_notes').val();
		
		if (!group.title.length) {
			return app.badField('#fe_eg_title', "Please enter a title for the group.");
		}
		if (!group.hostname_match) {
			// default to never-match regexp
			group.hostname_match = '(?!)';
		}
		
		// test regexp, as it was entered by a user
		try { new RegExp(group.hostname_match); }
		catch(err) {
			return app.badField('fe_eg_match', "Invalid regular expression: " + err);
		}
		
		return group;
	}
	
	// 
	// View Page
	// 
	
	gosub_view(args) {
		// page activation
		var self = this;
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		var group = this.group = find_object( app.groups, { id: args.id } );
		if (!group) {
			this.doFullPageError( "Cannot find group: " + args.id );
			return true;
		}
		
		app.showSidebar(true);
		app.setWindowTitle( "Viewing Group \"" + (group.title) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'lan', loc: '#Groups?sub=list', title: 'Server Groups' },
			{ icon: group.icon || 'server-network', title: group.title }
		]);
		
		this.charts = {};
		this.snapshots = {};
		this.servers = [];
		
		// give hint for behavior in components (like the server table)
		this.groupMode = 'live';
		
		// grab initial server list -- this may change later
		this.setupServers();
		
		var nice_match = '';
		if (group.hostname_match == '(?!)') nice_match = '(None)';
		else nice_match = '<span class="regexp">/' + group.hostname_match + '/</span>';
		
		var nice_email = 'n/a';
		if (group.alert_email) nice_email = '<i class="mdi mdi-email-outline">&nbsp;</i>' + group.alert_email;
		
		var html = '';
		
		html += '<div class="box" style="border:none;">';
			html += '<div class="box_title">';
				html += '<div class="box_title_left">Live &mdash; Real-Time View</div>';
				html += '<div class="box_title_left"><div class="button secondary mobile_collapse" onClick="$P().chooseHistoricalView(true)"><i class="mdi mdi-calendar-cursor">&nbsp;</i><span>Change...</span></div></div>';
				
				html += '<div class="box_title_right"><div class="button default mobile_collapse" onClick="$P().goEditGroup()"><i class="mdi mdi-file-edit-outline">&nbsp;</i><span>Edit Group...</span></div></div>';
				html += '<div class="box_title_right"><div class="button mobile_collapse sm_hide" onClick="$P().createSnapshot()"><i class="mdi mdi-monitor-eye">&nbsp;</i><span>Snapshot</span></div></div>';
				html += '<div class="box_title_right" id="d_vg_watch_btn">' + this.getWatchButton() + '</div>';
				
			html += '</div>';
		html += '</div>';
		
		html += '<div class="box">';
			html += '<div class="box_title">';
				html += 'Group Summary';
				
				html += '<div class="button icon right danger" title="Delete Group..." onClick="$P().show_delete_group_dialog()"><i class="mdi mdi-trash-can-outline"></i></div>';
				html += '<div class="button icon right secondary sm_hide" title="Job History..." onClick="$P().goJobHistory()"><i class="mdi mdi-cloud-search-outline"></i></div>';
				html += '<div class="button icon right secondary sm_hide" title="Alert History..." onClick="$P().goAlertHistory()"><i class="mdi mdi-restore-alert"></i></div>';
				html += '<div class="button icon right secondary sm_hide" title="Group History..." onClick="$P().goGroupHistory()"><i class="mdi mdi-script-text-outline"></i></div>';
				html += '<div class="button icon right" title="Add Server..." onClick="$P().addServerToGroup()"><i class="mdi mdi-plus-circle-outline"></i></div>';
				
				html += '<div class="clear"></div>';
			html += '</div>'; // title
			
			html += '<div class="box_content table">';
				html += '<div class="summary_grid">';
				
					// row 1
					html += '<div>';
						html += '<div class="info_label">Group ID</div>';
						html += '<div class="info_value monospace">' +this.getNiceCopyableID(group.id) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Group Title</div>';
						html += '<div class="info_value">' + this.getNiceGroup(group) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Created</div>';
						html += '<div class="info_value">' + this.getRelativeDateTime(group.created) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Modified</div>';
						html += '<div class="info_value">' + this.getRelativeDateTime(group.modified) + '</div>';
					html += '</div>';
					
					// row 2
					html += '<div>';
						html += '<div class="info_label">Hostname Match</div>';
						html += '<div class="info_value regexp">' + nice_match + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Servers</div>';
						html += '<div class="info_value" id="d_vg_stat_servers">' + commify(this.servers.length) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Alert Email</div>';
						html += '<div class="info_value">' + nice_email + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Alert Web Hook</div>';
						html += '<div class="info_value">' + (group.alert_web_hook ? this.getNiceWebHook(group.alert_web_hook, true) : 'n/a') + '</div>';
					html += '</div>';
					
					// row 3
					html += '<div>';
						html += '<div class="info_label">Architectures</div>';
						html += '<div class="info_value" id="d_vg_stat_arches">' + this.getNiceArches(this.servers) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Operating Systems</div>';
						html += '<div class="info_value" id="d_vg_stat_oses">' + this.getNiceOSes(this.servers) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">CPU Types</div>';
						html += '<div class="info_value" id="d_vg_stat_cputypes">' + this.getNiceCPUTypes(this.servers) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Virtualization</div>';
						html += '<div class="info_value" id="d_vg_stat_virts">' + this.getNiceVirts(this.servers) + '</div>';
					html += '</div>';
					
					// row 4
					html += '<div>';
						html += '<div class="info_label">Alerts Today</div>';
						html += '<div class="info_value" id="d_vg_stat_at"></div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Jobs Today</div>';
						html += '<div class="info_value" id="d_vg_stat_jct"></div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Jobs Failed Today</div>';
						html += '<div class="info_value" id="d_vg_stat_jft"></div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Job Success Rate</div>';
						html += '<div class="info_value" id="d_vg_stat_jsr"></div>';
					html += '</div>';
					
				html += '</div>'; // summary grid
			html += '</div>'; // box content
		html += '</div>'; // box
		
		// server table
		html += '<div id="d_vg_servers"></div>';
		
		// alerts
		html += '<div class="box" id="d_vg_alerts" style="display:none">';
			html += '<div class="box_title">';
				html += 'Group Alerts <span class="s_grp_filtered"></span>';
				// html += '<div class="button right secondary" onMouseUp="$P().goAlertHistory()"><i class="mdi mdi-magnify">&nbsp;</i>Alert History...</div>';
				html += '<div class="clear"></div>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// jobs
		html += '<div class="box" id="d_vg_jobs" style="">';
			html += '<div class="box_title">';
				html += 'Group Jobs <span class="s_grp_filtered"></span>';
				// html += '<div class="button right secondary" onMouseUp="$P().goJobHistory()"><i class="mdi mdi-magnify">&nbsp;</i>Job History...</div>';
				html += '<div class="clear"></div>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// quickmon charts
		html += '<div class="box charts" id="d_vg_quickmon" style="display:none">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" onInput="$P().applyQuickMonitorFilter(this)"></div>';
				html += this.getChartSizeSelector('chart_size_quick');
				html += 'Quick Look &mdash; Last Minute <span class="s_grp_filtered"></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// mem details
		html += '<div class="box" id="d_vg_mem">';
			html += '<div class="box_title">';
				html += this.getCPUMemMergeSelector('mem');
				html += 'Group Memory Details <span class="s_grp_filtered"></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += this.getGroupMemDetails();
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// cpu details
		html += '<div class="box" id="d_vg_cpus">';
			html += '<div class="box_title">';
				html += this.getCPUMemMergeSelector('cpu');
				html += 'Group CPU Details <span class="s_grp_filtered"></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += this.getGroupCPUDetails();
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// monitors
		html += '<div class="box charts" id="d_vg_monitors">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" onInput="$P().applyMonitorFilter(this)"></div>';
				html += this.getChartSizeSelector();
				html += 'Group Monitors &mdash; Last Hour <span class="s_grp_filtered"></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// processes
		html += '<div class="box" id="d_vg_procs">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" data-id="t_snap_procs" onInput="$P().applyTableFilter(this)"></div>';
				html += 'Group Processes <span class="s_grp_filtered"></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// connections
		html += '<div class="box" id="d_vg_conns">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" data-id="t_snap_conns" onInput="$P().applyTableFilter(this)"></div>';
				html += 'Group Connections <span class="s_grp_filtered"></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// upcoming jobs
		html += '<div class="box" id="d_upcoming_jobs">';
			html += '<div class="box_title">';
				html += 'Upcoming Group Jobs';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html(html);
		
		SingleSelect.init( this.div.find('select.sel_chart_size, select.sel_cpu_mem_merge') );
		
		this.updateGroupStats();
		this.updateGroupServerTable(); // this populates visibleServerIDs, mind
		
		this.setupQuickMonitors();
		this.setupMonitors();
		
		this.setupUpcomingJobs();
		
		var animate_max_servers = config.animate_max_servers || 100;
		if (!app.reducedMotion() && this.quickmonEnabled && (this.servers.length <= animate_max_servers)) this.animate();
		
		return true;
	}
	
	setupUpcomingJobs() {
		// start prediction engine, will render when complete
		var self = this;
		
		this.getUpcomingJobs( app.events.filter( function(event) {
			return (event.targets || []).includes( self.group.id );
		} ) );
	}
	
	addServerToGroup() {
		// add server to this group
		this.showAddServerDialog([ this.group.id ]);
	}
	
	updateDonutDashUnits() {
		// called every 1s by server push
		if (this.donutDashUnits) {
			this.resetDetailAnimation();
			this.updateGroupMemDetails();
			this.updateGroupCPUDetails();
			this.startDetailAnimation();
		}
	}
	
	setupQuickMonitors() {
		// render empty quickmon charts, then request full data
		var self = this;
		var group = this.group;
		var html = '';
		html += '<div class="chart_grid_horiz ' + (app.getPref('chart_size_quick') || 'medium') + '">';
		
		// see if any of our servers support quickmon
		this.quickmonEnabled = false;
		this.servers.forEach( function(server) {
			if (server.info.quickmon) self.quickmonEnabled = true;
		} );
		if (!this.quickmonEnabled) return;
		
		config.quick_monitors.forEach( function(def) {
			// { "id": "cpu_load", "title": "CPU Load Average", "source": "cpu.avgLoad", "type": "float", "suffix": "" },
			html += '<div><canvas id="c_vg_' + def.id + '" class="chart"></canvas></div>';
		} );
		
		html += '</div>';
		
		this.div.find('#d_vg_quickmon').show();
		this.div.find('#d_vg_quickmon > div.box_content').html( html );
		
		config.quick_monitors.forEach( function(def, idx) {
			var chart = self.createChart({
				"canvas": '#c_vg_' + def.id,
				"title": def.title,
				"dataType": def.type,
				"dataSuffix": def.suffix,
				"minVertScale": def.min_vert_scale || 0,
				"delta": def.delta || false,
				"deltaMinValue": def.delta_min_value ?? false,
				"divideByDelta": def.divide_by_delta || false,
				"fill": false,
				"clip": true,
				"live": true,
				"_quick": true,
				"_allow_flatten": true,
				"_idx": idx,
			});
			self.charts[ def.id ] = chart;
			self.updateChartFlatten(def.id);
			self.setupChartHover(def.id);
			self.setupCustomHeadroom(def.id);
		});
		
		// request all data from servers
		app.api.post( 'app/get_quickmon_data', { group: this.group.id }, function(resp) {
			if (!self.active) return; // sanity
			
			for (var server_id in resp.servers) {
				var rows = resp.servers[server_id] || [];
				var server = find_object( self.servers, { id: server_id } );
				if (!server) continue;
				
				// now iterate over all quick monitors
				config.quick_monitors.forEach( function(def, idx) {
					var chart = self.charts[def.id];
					
					chart.addLayer({
						id: server.id,
						title: self.getNiceServerText(server),
						data: self.getQuickMonChartData(rows, def.id),
						color: server.color,
						hidden: !self.visibleServerIDs[ server.id ]
					});
				}); // foreach mon
			} // foreach server
			
			self.quickReady = true;
		}); // api.get
		
		// prepopulate filter if saved
		if (this.quickMonitorFilter) {
			var $elem = this.div.find('#d_vg_quickmon .box_title_widget input[type="text"]');
			$elem.val( this.quickMonitorFilter );
			this.applyQuickMonitorFilter( $elem.get(0) );
		}
	}
	
	animate() {
		// animate quickmon charts
		var self = this;
		if (!this.active) return; // auto-shutdown on page deactivate
		
		// determine if we have any online servers that are not hidden
		var chart = this.charts[ config.quick_monitors[0].id ];
		var num_live_servers = 0;
		
		for (var idx = 0, len = chart.layers.length; idx < len; idx++) {
			if (!chart.layers[idx].hidden) num_live_servers++;
		}
		
		if (num_live_servers) {
			var now = app.getApproxServerTime();
			
			config.quick_monitors.forEach( function(def, idx) {
				var chart = self.charts[def.id];
				chart.zoom = { xMin: now - 60, xMax: now };
				chart.dirty = true;
			});
			
			ChartManager.check();
		}
		else {
			config.quick_monitors.forEach( function(def, idx) {
				var chart = self.charts[def.id];
				delete chart.zoom;
				chart.dirty = true;
			});
		}
		
		requestAnimationFrame( this.animate.bind(this) );
	}
	
	appendSampleToQuickChart(data) {
		// append sample to chart (real-time from server)
		// { id, row }
		var self = this;
		if (!this.quickReady) return; // prevent race condition
		
		// locate matching server
		var server = find_object( this.servers, { id: data.id } );
		if (!server) return;
		
		// save copy in server object for dash donuts
		server.quick = data;
		
		// update all quick monitors
		config.quick_monitors.forEach( function(def) {
			var chart = self.charts[def.id];
			if (!chart) return;
			
			var layer_idx = find_object_idx( chart.layers, { id: data.id } );
			
			if (layer_idx > -1) {
				chart.addLayerSample(layer_idx, { x: data.row.date, y: data.row[def.id] || 0 }, 62 );
			}
			else {
				// add new layer (new server just added)
				chart.addLayer({
					id: server.id,
					title: self.getNiceServerText(server),
					data: self.getQuickMonChartData([ data.row ], def.id),
					color: server.color,
					hidden: !self.visibleServerIDs[ server.id ]
				});
				
				// recolor all layers, as the new one may have changed the sort
				chart.layers.forEach( function(layer, idx) {
					var server = find_object( self.servers, { id: layer.id } );
					if (server) layer.color = server.color;
				} );
			}
			
			chart.dirty = true;
		}); // foreach monitor
	}
	
	setupMonitors() {
		// setup custom monitors (updated every minute)
		var self = this;
		var group = this.group;
		var monitors = this.monitors = [];
		var html = '';
		html += '<div class="chart_grid_horiz ' + (app.getPref('chart_size') || 'medium') + '">';
		
		app.monitors.forEach( function(mon_def) {
			if (!mon_def.display) return;
			if (mon_def.groups.length && !mon_def.groups.includes(group.id)) return;
			monitors.push(mon_def);
			
			html += '<div><canvas id="c_vg_' + mon_def.id + '" class="chart"></canvas></div>';
		} );
		
		html += '</div>';
		this.div.find('#d_vg_monitors > div.box_content').html( html );
		
		if (!monitors.length) {
			// odd situation, no monitors match this group
			this.div.find('#d_vg_monitors').hide();
			return;
		}
		
		monitors.forEach( function(def, idx) {
			var chart = self.createChart({
				"canvas": '#c_vg_' + def.id,
				"title": def.title,
				"dataType": def.data_type,
				"dataSuffix": def.suffix,
				"delta": def.delta || false,
				"deltaMinValue": def.delta_min_value ?? false,
				"divideByDelta": def.divide_by_delta || false,
				"minVertScale": def.min_vert_scale || 0,
				"showDataGaps": false,
				"fill": false,
				"live": true,
				"_allow_zoom": true,
				"_allow_flatten": true,
				"_idx": idx
			});
			self.charts[ def.id ] = chart;
			self.updateChartFlatten(def.id);
			self.setupChartHover(def.id);
		});
		
		// setup async server requests
		this.serverQueue = [ ...this.servers ];
		this.serverRequestsInFlight = 0;
		this.serverRequestsMax = config.server_requests_max || 6;
		
		for (var idx = 0; idx < this.serverRequestsMax; idx++) {
			this.manageServerRequests();
		}
		
		// prepopulate filter if saved
		if (this.monitorFilter) {
			var $elem = this.div.find('#d_vg_monitors .box_title_widget input[type="text"]');
			$elem.val( this.monitorFilter );
			this.applyMonitorFilter( $elem.get(0) );
		}
	}
	
	manageServerRequests() {
		// manage server requests for monitor data
		var self = this;
		var monitors = this.monitors;
		var min_epoch = app.epoch - 3600;
		var handleError = function() { self.serverRequestsInFlight--; self.manageServerRequests(); };
		
		if (!this.active || !this.serverQueue || !this.serverQueue.length) return;
		if (this.serverRequestsInFlight >= this.serverRequestsMax) return;
		
		var server = this.serverQueue.shift();
		this.serverRequestsInFlight++;
		
		// request last hour from server
		app.api.post( 'app/get_latest_monitor_data', { server: server.id, sys: 'hourly', limit: 60 }, function(resp) {
			if (!self.active) return; // sanity
			self.serverRequestsInFlight--; 
			
			// save snapshot in server object
			server.snapshot = resp.data;
			
			// if no quickmon, set server.quick here based on snapshot, for donuts
			if (!server.info.quickmon) {
				server.quick = {
					data: {
						cpu: server.snapshot.data.cpu,
						mem: server.snapshot.data.memory
					}
				};
			}
			
			// prune all data older than 1 hour
			resp.rows = resp.rows.filter( function(row) { return row.date >= min_epoch; } );
			
			// now iterate over all our monitors
			monitors.forEach( function(def, idx) {
				var chart = self.charts[def.id];
				if (find_object( chart.layers, { id: server.id } )) return; // sanity
				
				chart.addLayer({
					id: server.id,
					title: self.getNiceServerText(server),
					data: self.getMonitorChartData(resp.rows, def),
					color: server.color,
					opacity: server.offline ? 0.5 : 1.0,
					hidden: !self.visibleServerIDs[ server.id ]
				});
			}); // foreach mon
			
			// call debounced update on process and connection tables
			self.renderProcessTableDebounce();
			self.renderConnectionTableDebounce();
			
			// execute another request if more are pending
			requestAnimationFrame( self.manageServerRequests.bind(self) );
			
		}, handleError); // api.get
	}
	
	renderActiveAlerts() {
		// render details on all active alerts
		var self = this;
		
		var rows = Object.values(app.activeAlerts).filter( function(item) { 
			if (!item.server) return false;
			if (!self.visibleServerIDs[ item.server ]) return false;
			
			var server = app.servers[ item.server ];
			if (!server || !server.groups) return false;
			
			return server.groups.includes( self.group.id );
		} );
		
		if (!rows.length) {
			$('#d_vg_alerts').hide();
			return;
		}
		
		var cols = ["Alert ID", "Title", "Message", "Server", "Status", "Started", "Duration"];
		var html = '';
		
		var grid_args = {
			rows: rows,
			cols: cols,
			data_type: 'alert'
		};
		
		html += this.getBasicGrid( grid_args, function(item, idx) {
			return [
				'<b>' + self.getNiceAlertID(item, true) + '</b>',
				self.getNiceAlert(item.alert, false),
				item.message,
				self.getNiceServer(item.server, false),
				self.getNiceAlertStatus(item),
				self.getRelativeDateTime(item.date),
				self.getNiceAlertElapsedTime(item, true, true)
			];
		}); // grid
		
		$('#d_vg_alerts > div.box_content').html( html );
		$('#d_vg_alerts').show();
	}
	
	renderActiveJobs() {
		// show all active jobs for group
		var self = this;
		var html = '';
		
		var rows = Object.values(app.activeJobs).filter( function(item) { 
			if (!item.server) return false;
			if (!self.visibleServerIDs[ item.server ]) return false;
			
			var server = app.servers[ item.server ];
			if (!server || !server.groups) return false;
			
			return server.groups.includes( self.group.id );
		} )
		.sort( function(a, b) {
			return (a.started < b.started) ? 1 : -1;
		} );
		
		if (!this.activeOffset) this.activeOffset = 0;
		
		var resp = {
			rows: rows.slice( this.activeOffset, this.activeOffset + config.alt_items_per_page ),
			list: { length: rows.length }
		};
		
		var grid_args = {
			resp: resp,
			cols: ['Job ID', 'Event', 'Category', 'Server', 'State', 'Progress', 'Remaining', 'Actions'],
			data_type: 'job',
			offset: this.activeOffset,
			limit: config.alt_items_per_page,
			class: 'data_grid dash_active_grid',
			pagination_link: '$P().jobActiveNav',
			empty_msg: 'No active jobs in this group.'
		};
		
		html += this.getPaginatedGrid( grid_args, function(job, idx) {
			return [
				'<b>' + self.getNiceJob(job, true) + '</b>',
				self.getNiceJobEvent(job, true),
				self.getNiceCategory(job.category, true),
				// self.getNiceJobSource(job),
				// self.getShortDateTime( job.started ),
				'<div id="d_vg_jt_server_' + job.id + '">' + self.getNiceServer(job.server, true) + '</div>',
				'<div id="d_vg_jt_state_' + job.id + '">' + self.getNiceJobState(job) + '</div>',
				// '<div id="d_vg_jt_elapsed_' + job.id + '">' + self.getNiceJobElapsedTime(job, false) + '</div>',
				'<div id="d_vg_jt_progress_' + job.id + '">' + self.getNiceJobProgressBar(job) + '</div>',
				'<div id="d_vg_jt_remaining_' + job.id + '">' + self.getNiceJobRemainingTime(job, false) + '</div>',
				
				'<span class="link danger" onClick="$P().doAbortJob(\'' + job.id + '\')"><b>Abort Job</b></a>'
			];
		} );
		
		this.div.find('#d_vg_jobs > .box_content').removeClass('loading').html(html);
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
	
	jobActiveNav(offset) {
		// user clicked on active job pagination nav
		this.activeOffset = offset;
		this.div.find('#d_vg_jobs > .box_content').addClass('loading');
		this.renderActiveJobs();
	}
	
	getWatchButton() {
		// get dynamic watch button html based on current group watch status
		var group = this.group;
		var icon = 'bullseye';
		var label = 'Watch...';
		var extra_classes = '';
		
		if (app.state && app.state.watches && app.state.watches.groups && app.state.watches.groups[group.id] && (app.state.watches.groups[group.id] > app.epoch)) {
			// currently watching this group
			icon = 'bullseye-arrow';
			label = 'Watching...';
			extra_classes = 'marquee';
		}
		
		return `<div class="button secondary mobile_collapse sm_hide ${extra_classes}" onClick="$P().openWatchDialog()"><i class="mdi mdi-${icon}">&nbsp;</i><span>${label}</span></div>`;
	}
	
	updateWatchButton() {
		// update dynamic watch button based on current state
		this.div.find('#d_vg_watch_btn').html( this.getWatchButton() );
	}
	
	renderGroupFilteredSections() {
		// render all sections that are affected by visibleServerIDs
		this.renderActiveJobs();
		this.renderActiveAlerts();
		this.renderGroupProcessTable();
		this.renderGroupConnectionTable();
	}
	
	appendSampleToChart(id, server, snapshot) {
		// append sample to chart (every server every minute)
		var self = this;
		var flagged_monitors = {};
		
		// check for alert overlays
		if (snapshot.new_alerts) {
			for (var alert_id in snapshot.new_alerts) {
				var alert_def = find_object( app.alerts, { id: alert_id } );
				if (alert_def && alert_def.monitor_id) flagged_monitors[alert_def.monitor_id] = true;
			}
		}
		
		this.monitors.forEach( function(def) {
			var chart = self.charts[def.id];
			var layer_idx = find_object_idx( chart.layers, { id: id } );
			if (layer_idx == -1) return; // server not in chart
			
			// normalize x to the minute (for showDataGaps to work correctly)
			var x = Math.floor( snapshot.date / 60 ) * 60;
			
			// grab delta if applicable, or abs value for std monitors
			// var y = def.delta ? snapshot.data.deltas[def.id] : snapshot.data.monitors[def.id];
			var y = snapshot.data.monitors[def.id];
			
			var item = { x: x, y: y || 0 };
			
			// check for flag (label)
			if (flagged_monitors[def.id]) item.label = { "text": "Alert", "color": "red", "tooltip": true };
			
			chart.addLayerSample(layer_idx, item, 60);
		}); // foreach monitor
	}
	
	updateSnapshotData(pdata) {
		// new snapshot from server (every minute), update graphs and tables
		var { id, snapshot } = pdata;
		var server = find_object( this.servers, { id: id } );
		if (!server) return; // sanity check
		
		server.snapshot = snapshot;
		
		// if no quickmon, set server.quick here based on snapshot, for donuts
		if (!server.info.quickmon) {
			server.quick = {
				data: {
					cpu: snapshot.data.cpu,
					mem: snapshot.data.memory
				}
			};
		}
		
		// uptime
		var now = app.epoch;
		var nice_uptime = (!server.offline && server.info.booted) ? this.getNiceUptime( now - server.info.booted ) : 'n/a';
		this.div.find('#d_vg_server_uptime_' + id).html( nice_uptime );
		
		// update pixl-charts
		this.appendSampleToChart(id, server, snapshot);
		
		// update process and connection tables debounced
		this.renderProcessTableDebounce();
		this.renderConnectionTableDebounce();
		
		// update watch button
		this.updateWatchButton();
	}
	
	updateChartLayers() {
		// update chart layers after server/group change
		var self = this;
		
		// update layer title, opacity, color, and remove servers that left the group
		this.monitors.forEach( function(def, idx) {
			var chart = self.charts[def.id];
			var need_delete = false;
			
			chart.layers.forEach( function(layer) {
				var server = find_object( self.servers, { id: layer.id } );
				if (!server) { layer._delete = true; need_delete = true; return; }
				
				layer.title = self.getNiceServerText(server);
				layer.color = server.color;
				layer.opacity = server.offline ? 0.5 : 1.0;
			}); // foreach layer
			
			if (need_delete) {
				chart.layers = chart.layers.filter( function(layer) { return !layer._delete; } );
			}
			
			chart.dirty = true;
		}); // foreach mon
		
		// for quickmon, immediately delete layers for servers that went offline or left the group
		if (this.quickmonEnabled) config.quick_monitors.forEach( function(def, idx) {
			var chart = self.charts[ def.id ];
			var need_delete = false;
			
			chart.layers.forEach( function(layer) {
				var server = find_object( self.servers, { id: layer.id } );
				if (!server || server.offline) { layer._delete = true; need_delete = true; return; }
				
				layer.title = self.getNiceServerText(server);
				layer.color = server.color;
			}); // foreach layer
			
			if (need_delete) {
				chart.layers = chart.layers.filter( function(layer) { return !layer._delete; } );
			}
			
			chart.dirty = true;
		});
	}
	
	expireChartData() {
		// expire old chart data, called every minute
		var self = this;
		var now = app.epoch;
		var min_epoch = now - 3600;
		
		(this.monitors || []).forEach( function(def, idx) {
			var chart = self.charts[def.id];
			var need_delete = false;
			
			chart.layers.forEach( function(layer) {
				var server = find_object( self.servers, { id: layer.id } );
				if (!server) { layer._delete = true; need_delete = true; return; }
				
				layer.data = layer.data.filter( function(item) { return item.x >= min_epoch; } );
				// if (!layer.data.length && server.offline) { layer._delete = true; need_delete = true; }
				
			}); // foreach layer
			
			if (need_delete) {
				chart.layers = chart.layers.filter( function(layer) { return !layer._delete; } );
			}
			
			chart.dirty = true;
		}); // foreach mon
	}
	
	handleStatusUpdateView(data) {
		// received status update from server, called every second
		var self = this;
		var div = this.div;
		var bar_width = this.bar_width || 100;
		
		this.updateDonutDashUnits();
		
		// only redraw status fields if jobs changed
		if (data.jobsChanged) {
			this.renderActiveJobs();
			
			// recompute upcoming jobs
			this.autoExpireUpcomingJobs();
			this.renderUpcomingJobs();
			
			this.servers.forEach( function(item, idx) {
				var nice_jobs = 'Idle';
				var num_jobs = find_objects( app.activeJobs, { server: item.id } ).length;
				if (num_jobs > 0) nice_jobs = '<i class="mdi mdi-autorenew mdi-spin">&nbsp;</i><b>' + num_jobs + '</b>';
				
				self.div.find('#d_vg_server_jobs_' + item.id).html( nice_jobs );
			} );
		}
		else {
			// fast update without redrawing entire table
			var jobs = Object.values(app.activeJobs).filter( function(item) { 
				if (!item.server) return false;
				if (!self.visibleServerIDs[ item.server ]) return false;
				
				var server = app.servers[ item.server ];
				if (!server || !server.groups) return false;
				
				return server.groups.includes( self.group.id );
			} )
			
			jobs.forEach( function(job) {
				div.find('#d_vg_jt_state_' + job.id).html( self.getNiceJobState(job) );
				div.find('#d_vg_jt_server_' + job.id).html( self.getNiceServer(job.server, true) );
				// div.find('#d_vg_jt_elapsed_' + job.id).html( self.getNiceJobElapsedTime(job, false) );
				div.find('#d_vg_jt_remaining_' + job.id).html( self.getNiceJobRemainingTime(job, false) );
				
				// update progress bar without redrawing it (so animation doesn't jitter)
				self.updateJobProgressBar(job, '#d_vg_jt_progress_' + job.id + ' > div.progress_bar_container');
			} ); // foreach job
		}
	}
	
	updateGroupStats() {
		// stats updated, redraw select grid elements, called every minute
		var group = this.group;
		var stats = app.stats.currentDay.groups[group.id] || {};
		
		// jobs completed today
		this.div.find('#d_vg_stat_jct').html( commify(stats.job_complete || 0) );
		
		// jobs failed today
		this.div.find('#d_vg_stat_jft').html( commify(stats.job_error || 0) );
		
		// job success rate
		this.div.find('#d_vg_stat_jsr').html( stats.job_complete ? pct( stats.job_success || 0, stats.job_complete || 1 ) : 'n/a' );
		
		// alerts today
		this.div.find('#d_vg_stat_at').html( commify(stats.alert_new || 0) );
		
		// expire old chart samples for offline servers, delete layers if all samples gone
		this.expireChartData();
		
		// refresh upcoming
		if (this.upcomingJobs) {
			this.autoExpireUpcomingJobs();
			this.renderUpcomingJobs();
		}
	}
	
	setupServers() {
		// grab all servers for group, make copies so we can decorate them
		var self = this;
		var group = this.group;
		var servers = Object.values(app.servers).map( function(server) {
			return merge_objects(server, { offline: false });
		} );
		
		// merge in recently offline servers, but only if modified in the last 60 minutes
		for (var server_id in app.serverCache) {
			if (!app.servers[server_id] && (app.serverCache[server_id].modified > app.epoch - 3600)) {
				servers.push( merge_objects(app.serverCache[server_id], { offline: true }) );
			}
		}
		
		// filter by our group
		servers = servers.filter( function(server) {
			return server.groups.includes(group.id);
		} );
		
		// sort servers by label/hostname ascending
		servers.sort( function(a, b) {
			return (a.title || a.hostname).toLowerCase().localeCompare( (b.title || b.hostname).toLowerCase() );
		} );
		
		// assign colors
		servers.forEach( function(server, idx) {
			server.color = app.colors[ idx % app.colors.length ];
		} );
		
		// import pre-existing snapshot data, queue fetch if needed
		servers.forEach( function(server, idx) {
			var old_server = find_object( self.servers, { id: server.id } );
			
			if (old_server) {
				// found server, bring data over
				server.snapshot = old_server.snapshot;
				server.quick = old_server.quick;
			}
			else if (self.serverQueue) {
				// new server, fetch snapshot data in queue system
				self.serverQueue.push( server );
				self.manageServerRequests();
			}
		});
		
		this.servers = servers;
	}
	
	updateServers() {
		// called when servers or groups changed, AND every minute
		var self = this;
		
		// refresh server list
		this.setupServers();
		
		// update summary values
		this.div.find('#d_vg_stat_servers').html( commify(this.servers.length) );
		this.div.find('#d_vg_stat_arches').html( this.getNiceArches(this.servers) );
		this.div.find('#d_vg_stat_oses').html( this.getNiceOSes(this.servers) );
		this.div.find('#d_vg_stat_cputypes').html( this.getNiceCPUTypes(this.servers) );
		this.div.find('#d_vg_stat_virts').html( this.getNiceVirts(this.servers) );
		
		// redraw server table
		this.updateGroupServerTable();
		
		// update chart layers and delete old ones
		this.updateChartLayers();
	}
	
	openWatchDialog() {
		// show dialog for setting or removing group watch
		var self = this;
		var group = this.group;
		var title = "Set Group Watch";
		var btn = ['check-circle', "Accept"];
		var cur_value = 300;
		
		if (app.state && app.state.watches && app.state.watches.groups && app.state.watches.groups[group.id] && (app.state.watches.groups[group.id] > app.epoch)) {
			cur_value = Math.floor( app.state.watches.groups[group.id] - app.epoch );
			if (cur_value >= 86400) cur_value -= (cur_value % 86400);
			else if (cur_value >= 3600) cur_value -= (cur_value % 3600);
			else if (cur_value >= 60) cur_value -= (cur_value % 60);
			else cur_value = 60; // min of 1 minute for dialog
		}
		
		var html = '';
		html += `<div class="dialog_intro">This allows you to set a "watch" on a server group, which means that xyOps will take snapshots of it every minute until the watch duration elapses.</div>`;
		html += '<div class="dialog_box_content">';
		
		html += this.getFormRow({
			label: 'Watch Duration:',
			content: this.getFormRelativeTime({
				id: 'fe_vgw_duration',
				value: cur_value
			}),
			caption: 'Enter the desired duration for the watch.  Set to 0 to disable.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			var duration = parseInt( $('#fe_vgw_duration').val() );
			
			Dialog.showProgress( 1.0, duration ? "Setting Watch..." : "Removing Watch..." );
			app.api.post( 'app/watch_group', { id: group.id, duration }, function(resp) {
				// update complete
				Dialog.hideProgress();
				app.showMessage('success', "The group watch was " + (duration ? 'set' : 'removed') + " successfully.");
			}); // api.post
		}); // Dialog.confirm
		
		RelativeTime.init( $('#fe_vgw_duration') );
		$('#fe_vgw_duration_val').focus();
	}
	
	createSnapshot() {
		// create snapshot for group
		app.clearError();
		Dialog.showProgress( 1.0, "Creating snapshot..." );
		
		app.api.post( 'app/create_group_snapshot', { group: this.group.id }, function(resp) {
			Dialog.hideProgress();
			var loc = 'Snapshots?sub=view&id=' + resp.id;
			app.showMessage('success', "Your snapshot was created successfully.  Click here to view it, or find it on the Snapshots page.", 8, loc);
		} ); // api.post
	}
	
	goEditGroup() {
		// nav to edit page
		Nav.go( '#Groups?sub=edit&id=' + this.group.id );
	}
	
	goGroupHistory() {
		// nav to activity search
		Nav.go('#ActivityLog?action=groups&query=' + this.group.id);
	}
	
	goAlertHistory() {
		// nav to alert history for this group
		Nav.go('Alerts?group=' + this.group.id);
	}
	
	goJobHistory() {
		// nav to job history for this group
		Nav.go('Search?group=' + this.group.id);
	}
	
	onPageUpdate(pcmd, pdata) {
		// receive data packet for this page specifically (i.e. live graph append)
		switch (pcmd) {
			case 'quickmon': this.appendSampleToQuickChart(pdata); break;
			case 'snapshot': this.updateSnapshotData(pdata); break;
		}
	}
	
	onStatusUpdate(data) {
		// called every 1s from websocket
		switch (this.args.sub) {
			case 'view': this.handleStatusUpdateView(data); break;
		}
	}
	
	onDataUpdate(key, data) {
		// refresh list if groups were updated
		if ((key == 'groups') && (this.args.sub == 'list')) this.gosub_list(this.args);
		if ((key == 'servers') && (this.args.sub == 'list')) this.update_server_counts();
		
		if (this.args.sub == 'view') {
			if (key == 'servers') this.updateServers();
			else if (key == 'activeAlerts') this.updateGroupServerTable();
			else if (key == 'stats') this.updateGroupStats();
			else if (key == 'state') this.updateWatchButton();
			else if (key == 'events') this.setupUpcomingJobs();
		}
	}
	
	onDeactivate() {
		// called when page is deactivated
		delete this.visibleServerIDs;
		delete this.serverQueue;
		delete this.monitors;
		delete this.activeOffset;
		delete this.serverRequestsInFlight;
		delete this.serverRequestsMax;
		delete this.donutDashUnits;
		delete this.detailAnimation;
		delete this.chartZoom;
		delete this.upcomingJobs;
		delete this.upcomingOffset;
		delete this.quickReady;
		delete this.quickmonEnabled;
		
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
