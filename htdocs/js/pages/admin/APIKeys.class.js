// Admin Page -- API Keys

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.APIKeys = class APIKeys extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		if (!this.requireAnyPrivilege('admin')) return true;
		
		if (!args) args = {};
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		// app.setHeaderTitle( '<i class="mdi mdi-key-chain">&nbsp;</i>API Key Management' );
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show API Key list
		app.setWindowTitle( "API Keys" );
		app.setHeaderTitle( '<i class="mdi mdi-key-chain">&nbsp;</i>API Keys' );
		this.loading();
		app.api.post( 'app/get_api_keys', copy_object(args), this.receive_keys.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_keys(resp) {
		// receive all API Keys from server, render them sorted
		// this.lastAPIKeysResp = resp;
		var html = '';
		if (!resp.rows) resp.rows = [];
		
		if (!this.active) return; // sanity
		
		// sort by title ascending
		this.api_keys = resp.rows.sort( function(a, b) {
			return a.title.toLowerCase().localeCompare( b.title.toLowerCase() );
		} );
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['App Title', 'API Key', 'Status', 'Author', 'Created', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'API Keys';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var self = this;
		html += this.getBasicGrid( this.api_keys, cols, 'key', function(item, idx) {
			var actions = [
				'<span class="link" onClick="$P().edit_api_key('+idx+')"><b>Edit</b></span>',
				'<span class="link danger" onClick="$P().delete_api_key('+idx+')"><b>Delete</b></span>'
			];
			
			var nice_status = '';
			if (item.active) {
				if (item.expires && (app.epoch >= item.expires)) nice_status = '<span class="color_label yellow"><i class="mdi mdi-alert-outline">&nbsp;</i>Expired</span>';
				else nice_status = '<span class="color_label green"><i class="mdi mdi-check-circle">&nbsp;</i>Active</span>'
			}
			else {
				nice_status = '<span class="color_label red"><i class="mdi mdi-alert-circle">&nbsp;</i>Suspended</span>';
			}
			
			return [
				'<b>' + self.getNiceAPIKey(item, true) + '</b>',
				'<span class="mono" data-private>' + self.getMaskedKey(item.key) + '</span>',
				nice_status,
				self.getNiceUser(item.username, app.isAdmin()),
				'<span title="'+self.getNiceDateTimeText(item.created)+'">'+self.getNiceDate(item.created)+'</span>',
				actions.join(' | ')
			];
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button phone_collapse" onClick="$P().doFileImportPrompt()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i><span>Import File...</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().go_history()"><i class="mdi mdi-history">&nbsp;</i><span>Revision History...</span></div>';
			html += '<div class="button default" onClick="$P().edit_api_key(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i><span>New API Key...</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.setupBoxButtonFloater();
	}
	
	edit_api_key(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#APIKeys?sub=edit&id=' + this.api_keys[idx].id );
		else Nav.go( '#APIKeys?sub=new' );
	}
	
	delete_api_key(idx) {
		// delete key from search results
		this.api_key = this.api_keys[idx];
		this.show_delete_api_key_dialog();
	}
	
	go_history() {
		Nav.go( '#ActivityLog?action=api_keys' );
	}
	
	gosub_new(args) {
		// create new API Key
		var html = '';
		app.setWindowTitle( "New API Key" );
		
		app.setHeaderNav([
			{ icon: 'key-chain', loc: '#APIKeys?sub=list', title: 'API Keys' },
			{ icon: 'key-plus', title: "New API Key" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New API Key';
			html += '<div class="box_subtitle"><a href="#APIKeys?sub=list">&laquo; Back to Key List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.api_key = { 
			key: get_unique_id(24),
			active: 1,
			privileges: copy_object( config.default_user_privileges ),
			roles: [],
			expires: 0
		};
		
		// API Key
		html += this.getFormRow({
			label: 'API Key:',
			content: this.getFormText({
				id: 'fe_ak_key',
				class: 'monospace',
				spellcheck: 'false',
				readonly: 'readonly',
				value: this.api_key.key,
				'data-private': ''
			}),
			suffix: '<div class="form_suffix_icon mdi mdi-dice-5" title="Generate Random Key" onClick="$P().generate_key()" onMouseDown="event.preventDefault();"></div>',
			caption: 'The API Key string is used to authenticate API calls.'
		});
		
		html += this.get_api_key_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button phone_collapse" onClick="$P().cancel_api_key_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button primary" onClick="$P().do_new_api_key()"><i class="mdi mdi-floppy">&nbsp;</i><span>Create Key</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_ak_status') );
		MultiSelect.init( this.div.find('select[multiple]') );
		$('#fe_ak_title').focus();
		this.setupBoxButtonFloater();
	}
	
	cancel_api_key_edit() {
		// cancel editing API Key and return to list
		Nav.go( 'APIKeys?sub=list' );
	}
	
	do_new_api_key() {
		// create new API Key
		app.clearError();
		var api_key = this.get_api_key_form_json();
		if (!api_key) return; // error
		
		if (!api_key.title.length) {
			return app.badField('#fe_ak_title', "Please enter an app title for the new API Key.");
		}
		
		this.api_key = api_key;
		
		Dialog.showProgress( 1.0, "Creating API Key..." );
		app.api.post( 'app/create_api_key', api_key, this.new_api_key_finish.bind(this) );
	}
	
	new_api_key_finish(resp) {
		// new API Key created successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		// Nav.go('APIKeys?sub=edit&id=' + resp.id);
		Nav.go( 'APIKeys?sub=list' );
		
		app.showMessage('success', "The new API Key was created successfully.");
	}
	
	gosub_edit(args) {
		// edit API Key subpage
		this.loading();
		app.api.post( 'app/get_api_key', { id: args.id }, this.receive_key.bind(this), this.fullPageError.bind(this) );
	}
	
	getFormKeyCopier() {
		return `<div class="form_suffix_icon mdi mdi-clipboard-text-outline" title="Copy API Key" onClick="$P().copyAPIKey(this)"></div>`;
	}
	
	copyAPIKey(elem) {
		// copy api key to clipboard
		var $elem = $(elem);
		var $row = $elem.closest('.form_row');
		copyToClipboard( this.api_key.key );
		$elem.removeClass().addClass([ 'form_suffix_icon', 'mdi', 'mdi-clipboard-check-outline' ]).css('color', 'var(--green)');
		app.showMessage('info', "The API Key was copied to your clipboard.");
	}
	
	getMaskedKey(key) {
		// mask key for security
		return key.substring(0, 4) + ('*').repeat(key.length - 8) + key.substring(key.length - 4);
	}
	
	receive_key(resp) {
		// edit existing API Key
		var html = '';
		this.api_key = resp.api_key;
		if (!this.active) return; // sanity
		
		app.setWindowTitle( "Editing API Key \"" + (this.api_key.title) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'key-chain', loc: '#APIKeys?sub=list', title: 'API Keys' },
			{ icon: this.api_key.icon || 'key', title: this.api_key.title }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit API Key Details';
			html += '<div class="box_subtitle"><a href="#APIKeys?sub=list">&laquo; Back to Key List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		// API Key
		html += this.getFormRow({
			label: 'API Key:',
			content: this.getFormText({
				id: 'fe_ak_key',
				class: 'monospace',
				spellcheck: 'false',
				disabled: 'disabled',
				value: this.getMaskedKey(this.api_key.key),
				'data-private': ''
			}),
			suffix: this.getFormKeyCopier(),
			caption: 'The API key is masked for security purposes.  However, you can still copy it to the clipboard using the button on the right.'
		});
		
		html += this.get_api_key_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button cancel mobile_collapse" onClick="$P().cancel_api_key_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Close</span></div>';
			html += '<div class="button danger mobile_collapse" onClick="$P().show_delete_api_key_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
			html += '<div class="button save phone_collapse" onClick="$P().do_save_api_key()"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Changes</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_ak_status') );
		MultiSelect.init( this.div.find('select[multiple]') );
		this.setupBoxButtonFloater();
		this.setupEditTriggers();
	}
	
	do_export() {
		// show export dialog
		app.clearError();
		var api_key = this.get_api_key_form_json();
		if (!api_key) return; // error
		
		this.showExportOptions({
			name: 'API key',
			dataType: 'api_key',
			api: this.args.id ? 'update_api_key' : 'create_api_key',
			data: api_key
		});
	}
	
	go_edit_history() {
		Nav.go( '#ActivityLog?action=api_keys&query=' + this.api_key.id );
	}
	
	do_save_api_key() {
		// save changes to api key
		app.clearError();
		var api_key = this.get_api_key_form_json();
		if (!api_key) return; // error
		
		this.api_key = api_key;
		
		Dialog.showProgress( 1.0, "Saving API Key..." );
		app.api.post( 'app/update_api_key', api_key, this.save_api_key_finish.bind(this) );
	}
	
	save_api_key_finish(resp) {
		// new API Key saved successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		// Nav.go( 'APIKeys?sub=list' );
		this.triggerSaveComplete();
		app.showMessage('success', "The API Key was saved successfully.");
	}
	
	show_delete_api_key_dialog() {
		// show dialog confirming api key delete action
		var self = this;
		
		Dialog.confirmDanger( 'Delete API Key', "Are you sure you want to <b>permanently delete</b> the API Key &ldquo;" + this.api_key.title + "&rdquo;?  There is no way to undo this action.", ['trash-can', 'Delete'], function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting API Key..." );
				app.api.post( 'app/delete_api_key', self.api_key, self.delete_api_key_finish.bind(self) );
			}
		} );
	}
	
	delete_api_key_finish(resp) {
		// finished deleting API Key
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('APIKeys?sub=list', 'force');
		app.showMessage('success', "The API Key &ldquo;" + this.api_key.title + "&rdquo; was deleted successfully.");
	}
	
	get_api_key_edit_html() {
		// get html for editing an API Key (or creating a new one)
		var html = '';
		var api_key = this.api_key;
		
		// status
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormMenuSingle({
				id: 'fe_ak_status',
				title: 'Select Status',
				options: [[1,'Active'], [0,'Disabled']],
				value: api_key.active
			}),
			caption: '&ldquo;Disabled&rdquo; means that the API Key remains in the system, but it cannot be used for any API calls.'
		});
		
		// title
		html += this.getFormRow({
			label: 'App Title:',
			content: this.getFormText({
				id: 'fe_ak_title',
				spellcheck: 'false',
				value: api_key.title
			}),
			caption: 'Enter the title of the application that will be using the API Key.'
		});
		
		// description
		html += this.getFormRow({
			label: 'App Description:',
			content: this.getFormTextarea({
				id: 'fe_ak_desc',
				rows: 5,
				value: api_key.description
			}),
			caption: 'Optionally enter a more detailed description of the application.'
		});
		
		// roles
		html += this.getFormRow({
			label: 'Roles:',
			content: this.getFormMenuMulti({
				id: 'fe_ak_roles',
				title: 'Assign roles to key',
				placeholder: '(None)',
				options: app.roles,
				values: api_key.roles || [],
				default_icon: 'account-group-outline',
				onChange: '$P().onRoleChange(this)',
				'data-hold': 1
			}),
			caption: 'Assign one or more roles to the key.  These automatically import privileges, which are additive.'
		});
		
		// privilege list
		html += this.getFormRow({
			label: 'Privileges:',
			content: this.getFormMenuMulti({
				id: 'fe_ak_privs',
				title: 'Select Privileges',
				placeholder: 'Click to assign privileges...',
				options: config.ui.privilege_list,
				values: hash_keys_to_array( api_key.privileges ),
				default_icon: 'card-bulleted-outline',
				onChange: '$P().onPrivChange(this)',
				'data-hold': 1,
				'data-volatile': 1,
				'data-admin_set': api_key.privileges.admin ? 1 : '',
				'data-inherited': this.getInheritedPrivList(api_key.roles || []).join(','),
				'data-itooltip': "Inherited from role"
			}),
			caption: 'Select which privileges the API Key account should have. Administrators have <b>all</b> privileges.'
		});
		
		// expiration date
		html += this.getFormRow({
			label: 'Expiration:',
			content: this.getFormText({
				id: 'fe_ak_expires',
				type: 'date',
				value: api_key.expires ? yyyy_mm_dd(api_key.expires, '-') : ''
			}),
			caption: 'Optionally set an expiration date for the API Key.  It cannot be used on or after the specified date.'
		});
		
		return html;
	}
	
	getInheritedPrivList(roles) {
		// compute inherited privs from role list
		var privs = {};
		
		roles.forEach( function(role_id) {
			var role = find_object( app.roles, { id: role_id } );
			if (!role || !role.enabled) return; // disabled or deleted role
			merge_hash_into( privs, role.privileges );
		} );
		
		return Object.keys(privs);
	}
	
	onRoleChange(elem) {
		// roles changed, recalc inherited privs
		var $elem = $(elem);
		var roles = $elem.val();
		
		var priv_list = this.getInheritedPrivList(roles);
		this.div.find('#fe_ak_privs').data('inherited', priv_list.join(',')).trigger('change');
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
	
	get_api_key_form_json() {
		// get api key elements from form, used for new or edit
		var api_key = this.api_key;
		
		// only grab api key from DOM when creating new
		// on edit the existing value will pass thru
		if (!api_key.id) api_key.key = $('#fe_ak_key').val();
		
		api_key.active = parseInt( $('#fe_ak_status').val() );
		api_key.title = $('#fe_ak_title').val().trim();
		api_key.description = $('#fe_ak_desc').val();
		api_key.privileges = array_to_hash_keys( $('#fe_ak_privs').val(), true );
		api_key.roles = $('#fe_ak_roles').val();
		
		api_key.expires = $('#fe_ak_expires').val();
		if (api_key.expires.length) {
			api_key.expires = parse_date( api_key.expires + ' 00:00:00' );
		}
		else api_key.expires = 0;
		
		if (!api_key.key.length) {
			return app.badField('#fe_ak_key', "Please enter an API Key string, or generate a random one.");
		}
		if (api_key.key.length < 16) {
			return app.badField('#fe_ak_key', "API keys must be at least 16 characters in length.");
		}
		
		return api_key;
	}
	
	generate_key() {
		// generate random api key
		$('#fe_ak_key').val( get_unique_id(24) );
	}
	
	onDeactivate() {
		// called when page is deactivated
		delete this.api_keys;
		this.div.html( '' );
		return true;
	}
	
};
