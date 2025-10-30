// Admin Page -- User Roles

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Roles = class Roles extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'ur';
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		if (!this.requireAnyPrivilege('admin')) return true;
		
		if (!args) args = {};
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		// app.setHeaderTitle( '<i class="mdi mdi-key-chain">&nbsp;</i>User Role Management' );
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show User Role list
		app.setWindowTitle( "User Roles" );
		app.setHeaderTitle( '<i class="mdi mdi-account-group">&nbsp;</i>User Roles' );
		this.loading();
		app.api.post( 'app/get_roles', copy_object(args), this.receive_roles.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_roles(resp) {
		// receive all roles from server, render them sorted
		var self = this;
		var html = '';
		if (!resp.rows) resp.rows = [];
		
		if (!this.active) return; // sanity
		
		// sort by title ascending
		this.roles = resp.rows.sort( function(a, b) {
			return a.title.toLowerCase().localeCompare( b.title.toLowerCase() );
		} );
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Role Title', 'Role ID', 'Users', 'Author', 'Created', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'User Roles';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var grid_opts = {
			rows: this.roles,
			cols: cols,
			data_type: 'role',
			grid_template_columns: 'min-content' + ' auto'.repeat( cols.length - 1 )
		};
		
		html += this.getBasicGrid( grid_opts, function(item, idx) {
			var actions = [
				'<span class="link" onClick="$P().edit_role('+idx+')"><b>Edit</b></span>',
				'<span class="link danger" onClick="$P().delete_role('+idx+')"><b>Delete</b></span>'
			];
			
			var num_users = 0;
			app.users.forEach( function(user) { if (user.roles && user.roles.includes(item.id)) num_users++; } );
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggle_role_enabled(this,' + idx + ')'
				}) + '</div>',
				'<b>' + self.getNiceRole(item, true) + '</b>',
				'<span class="mono">' + item.id + '</span>',
				commify( num_users ),
				self.getNiceUser(item.username, app.isAdmin()),
				'<span title="'+self.getNiceDateTimeText(item.created)+'">'+self.getNiceDate(item.created)+'</span>',
				actions.join(' | ')
			];
			
			if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button phone_collapse" onClick="$P().doFileImportPrompt()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i><span>Import File...</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().go_history()"><i class="mdi mdi-history">&nbsp;</i><span>Revision History...</span></div>';
			html += '<div class="button default" onClick="$P().edit_role(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i><span>New Role...</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.setupBoxButtonFloater();
	}
	
	toggle_role_enabled(elem, idx) {
		// toggle role checkbox, actually do the enable/disable here, update row
		var self = this;
		var item = this.roles[idx];
		
		if (config.alt_to_toggle && !app.lastClick.altKey) {
			$(elem).prop('checked', !$(elem).is(':checked'));
			return app.showMessage('warning', "Accidental Click Protection: Please hold the Alt/Opt key to toggle this checkbox.", 8);
		}
		
		item.enabled = !!$(elem).is(':checked');
		
		app.api.post( 'app/update_role', item, function(resp) {
			if (!self.active) return; // sanity
			
			if (item.enabled) $(elem).closest('ul').removeClass('disabled');
			else $(elem).closest('ul').addClass('disabled');
		} );
	}
	
	edit_role(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Roles?sub=edit&id=' + this.roles[idx].id );
		else Nav.go( '#Roles?sub=new' );
	}
	
	delete_role(idx) {
		// delete role
		this.role = this.roles[idx];
		this.show_delete_role_dialog();
	}
	
	go_history() {
		Nav.go( '#ActivityLog?action=roles' );
	}
	
	gosub_new(args) {
		// create new role
		var html = '';
		app.setWindowTitle( "New User Role" );
		
		app.setHeaderNav([
			{ icon: 'account-group', loc: '#Roles?sub=list', title: 'User Roles' },
			{ icon: 'account-group-outline', title: "New Role" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New User Role';
			html += '<div class="box_subtitle"><a href="#Roles?sub=list">&laquo; Back to Role List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.role = { 
			id: '',
			title: '',
			enabled: true,
			icon: '',
			notes: '',
			categories: [],
			groups: [],
			privileges: {}
		};
		
		html += this.get_role_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button phone_collapse" onClick="$P().cancel_role_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button primary" onClick="$P().do_new_role()"><i class="mdi mdi-floppy">&nbsp;</i><span>Create Role</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ur_icon') );
		$('#fe_ur_title').focus();
		this.setupBoxButtonFloater();
	}
	
	cancel_role_edit() {
		// cancel editing role and return to list
		Nav.go( 'Roles?sub=list' );
	}
	
	do_new_role() {
		// create new role
		app.clearError();
		var role = this.get_role_form_json();
		if (!role) return; // error
		
		this.role = role;
		
		Dialog.showProgress( 1.0, "Creating User Role..." );
		app.api.post( 'app/create_role', role, this.new_role_finish.bind(this) );
	}
	
	new_role_finish(resp) {
		// new User Role created successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		// Nav.go('Roles?sub=edit&id=' + resp.id);
		Nav.go( 'Roles?sub=list' );
		
		app.showMessage('success', "The new user role was created successfully.");
	}
	
	gosub_edit(args) {
		// edit User Role subpage
		this.loading();
		app.api.post( 'app/get_role', { id: args.id }, this.receive_role.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_role(resp) {
		// edit existing User Role
		var html = '';
		this.role = resp.role;
		if (!this.active) return; // sanity
		
		app.setWindowTitle( "Editing User Role \"" + (this.role.title) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'account-group', loc: '#Roles?sub=list', title: 'User Roles' },
			{ icon: this.role.icon || 'account-group-outline', title: this.role.title }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit Role Details';
			html += '<div class="box_subtitle"><a href="#Roles?sub=list">&laquo; Back to Role List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_role_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button cancel mobile_collapse" onClick="$P().cancel_role_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Close</span></div>';
			html += '<div class="button danger mobile_collapse" onClick="$P().show_delete_role_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
			html += '<div class="button save phone_collapse" onClick="$P().do_save_role()"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Changes</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ur_icon') );
		this.setupBoxButtonFloater();
		this.setupEditTriggers();
	}
	
	do_export() {
		// show export dialog
		app.clearError();
		var role = this.get_role_form_json();
		if (!role) return; // error
		
		this.showExportOptions({
			name: 'role',
			dataType: 'role',
			api: this.args.id ? 'update_role' : 'create_role',
			data: role
		});
	}
	
	go_edit_history() {
		Nav.go( '#ActivityLog?action=roles&query=' + this.role.id );
	}
	
	do_save_role() {
		// save changes to role
		app.clearError();
		var role = this.get_role_form_json();
		if (!role) return; // error
		
		this.role = role;
		
		Dialog.showProgress( 1.0, "Saving User Role..." );
		app.api.post( 'app/update_role', role, this.save_role_finish.bind(this) );
	}
	
	save_role_finish(resp) {
		// new User Role saved successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		// Nav.go( 'Roles?sub=list' );
		this.triggerSaveComplete();
		app.showMessage('success', "The user role was saved successfully.");
	}
	
	show_delete_role_dialog() {
		// show dialog confirming role delete action
		var self = this;
		
		Dialog.confirmDanger( 'Delete User Role', "Are you sure you want to <b>permanently delete</b> the user role &ldquo;" + this.role.title + "&rdquo;?  There is no way to undo this action.", ['trash-can', 'Delete'], function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting User Role..." );
				app.api.post( 'app/delete_role', self.role, self.delete_role_finish.bind(self) );
			}
		} );
	}
	
	delete_role_finish(resp) {
		// finished deleting User Role
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Roles?sub=list', 'force');
		app.showMessage('success', "The user role &ldquo;" + this.role.title + "&rdquo; was deleted successfully.");
	}
	
	get_role_edit_html() {
		// get html for editing an User Role (or creating a new one)
		var html = '';
		var role = this.role;
		
		if (role.id) {
			// id
			html += this.getFormRow({
				label: 'Role ID:',
				content: this.getFormText({
					id: 'fe_ur_id',
					class: 'monospace',
					spellcheck: 'false',
					disabled: 'disabled',
					value: role.id
				}),
				suffix: this.getFormIDCopier(),
				caption: 'This is a unique ID for the role, used by the xyOps API.  It cannot be changed.'
			});
		}
		
		// title
		html += this.getFormRow({
			label: 'Role Title:',
			content: this.getFormText({
				id: 'fe_ur_title',
				value: role.title
			}),
			caption: 'Enter the title of the application that will be using the User Role.'
		});
		
		// enabled
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_ur_enabled',
				label: 'Role Enabled',
				checked: role.enabled
			}),
			caption: 'Check this box to enable the user role, and allow the permissions to propagate.'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_ur_icon',
				title: 'Select icon for role',
				placeholder: 'Select icon for role...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: role.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for the role.'
		});
		
		// privilege list
		html += this.getFormRow({
			label: 'Privileges:',
			content: this.getFormMenuMulti({
				id: 'fe_ak_privs',
				title: 'Select Privileges',
				placeholder: 'Click to assign privileges...',
				options: config.ui.privilege_list,
				values: hash_keys_to_array( role.privileges ),
				default_icon: 'card-bulleted-outline',
				onChange: '$P().onPrivChange(this)',
				'data-hold': 1,
				'data-volatile': 1,
				'data-admin_set': role.privileges.admin ? 1 : ''
			}),
			caption: 'Select which privileges the user role should have. Administrators have <b>all</b> privileges.'
		});
		
		// category privileges
		html += this.getFormRow({
			label: 'Categories:',
			content: this.getFormMenuMulti({
				id: 'fe_ur_cats',
				title: 'Limit role to categories',
				placeholder: '(All Categories)',
				options: app.categories,
				values: role.categories || [],
				default_icon: 'folder-open-outline',
				'data-hold': 1
			}),
			caption: 'Optionally limit the role\'s access to specific categories only.  This only applies for non-administrators.'
		});
		
		// group privileges
		html += this.getFormRow({
			label: 'Groups:',
			content: this.getFormMenuMulti({
				id: 'fe_ur_groups',
				title: 'Limit role to server groups',
				placeholder: '(All Groups)',
				options: app.groups,
				values: role.groups || [],
				default_icon: 'server-network',
				'data-hold': 1
			}),
			caption: 'Optionally limit the role\'s access to specific server groups only.  This only applies for non-administrators.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_ur_notes',
				rows: 5,
				value: role.notes
			}),
			caption: 'Optionally enter notes for the role, for your own internal use.'
		});
		
		return html;
	}
	
	onPrivChange(elem) {
		// privileges changed, resolve "admin is god" thing here
		var $elem = $(elem);
		var priv_list = $elem.val();
		var is_admin = find_in_array(priv_list, 'admin');
		
		if (is_admin && (priv_list.length > 1)) {
			if ($elem.data('admin_set')) {
				// user tried to add another priv with admin set, so deactivate admin
				var admin = find_object( elem.options, { value: 'admin' } );
				admin.selected = false;
				$elem.trigger('change');
				is_admin = false;
			}
			else {
				// user tried to add admin with other privs, so set admin to be solo
				$elem.val(['admin']).trigger('change');
				is_admin = true;
			}
		}
		
		$elem.data('admin_set', is_admin);
	}
	
	get_role_form_json() {
		// get role elements from form, used for new or edit
		var role = this.role;
		
		role.title = $('#fe_ur_title').val().trim();
		role.enabled = $('#fe_ur_enabled').is(':checked') ? true : false;
		role.icon = $('#fe_ur_icon').val();
		role.privileges = array_to_hash_keys( $('#fe_ak_privs').val(), 1 );
		role.categories = $('#fe_ur_cats').val();
		role.groups = $('#fe_ur_groups').val();
		role.notes = $('#fe_ur_notes').val();
		
		if (!role.title.length) {
			return app.badField('#fe_ur_title', "Please enter a title for the role.");
		}
		
		return role;
	}
	
	onDeactivate() {
		// called when page is deactivated
		delete this.roles;
		this.div.html( '' );
		return true;
	}
	
};
