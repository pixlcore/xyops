// Admin Page -- API Keys

Page.APIKeys = class APIKeys extends Page.Base {
	
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
		this.lastAPIKeysResp = resp;
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
				'<span class="link" onMouseUp="$P().edit_api_key('+idx+')"><b>Edit</b></span>',
				'<span class="link danger" onMouseUp="$P().delete_api_key('+idx+')"><b>Delete</b></span>'
			];
			return [
				'<b>' + self.getNiceAPIKey(item, true) + '</b>',
				'<span class="mono">' + item.key + '</span>',
				item.active ? '<span class="color_label green"><i class="mdi mdi-check-circle">&nbsp;</i>Active</span>' : '<span class="color_label red"><i class="mdi mdi-alert-circle">&nbsp;</i>Suspended</span>',
				self.getNiceUser(item.username, app.isAdmin()),
				'<span title="'+self.getNiceDateTimeText(item.created)+'">'+self.getNiceDate(item.created)+'</span>',
				actions.join(' | ')
			];
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button secondary" onMouseUp="$P().edit_api_key(-1)">Add API Key...</div>';
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
			privileges: copy_object( config.default_privileges )
		};
		
		html += this.get_api_key_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_api_key_edit()">Cancel</div>';
			html += '<div class="button primary" onMouseUp="$P().do_new_api_key()"><i class="mdi mdi-floppy">&nbsp;</i>Create Key</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
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
		
		html += this.get_api_key_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_api_key_edit()">Cancel</div>';
			html += '<div class="button danger" onMouseUp="$P().show_delete_api_key_dialog()">Delete Key...</div>';
			html += '<div class="button primary" onMouseUp="$P().do_save_api_key()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		this.setupBoxButtonFloater();
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
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go( 'APIKeys?sub=list' );
		app.showMessage('success', "The API Key was saved successfully.");
		// window.scrollTo( 0, 0 );
	}
	
	show_delete_api_key_dialog() {
		// show dialog confirming api key delete action
		var self = this;
		
		Dialog.confirmDanger( 'Delete API Key', "Are you sure you want to <b>permanently delete</b> the API Key &ldquo;" + this.api_key.title + "&rdquo;?  There is no way to undo this action.", 'Delete', function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting API Key..." );
				app.api.post( 'app/delete_api_key', self.api_key, self.delete_api_key_finish.bind(self) );
			}
		} );
	}
	
	delete_api_key_finish(resp) {
		// finished deleting API Key
		var self = this;
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('APIKeys?sub=list', 'force');
		app.showMessage('success', "The API Key &ldquo;" + this.api_key.title + "&rdquo; was deleted successfully.");
	}
	
	get_api_key_edit_html() {
		// get html for editing an API Key (or creating a new one)
		var html = '';
		var api_key = this.api_key;
		
		// API Key
		html += this.getFormRow({
			label: 'API Key:',
			content: this.getFormText({
				id: 'fe_ak_key',
				class: 'monospace',
				spellcheck: 'false',
				value: api_key.key
			}),
			suffix: '<div class="form_suffix_icon mdi mdi-dice-5" title="Generate Random Key" onMouseUp="$P().generate_key()" onMouseDown="event.preventDefault();"></div>',
			caption: 'The API Key string is used to authenticate API calls.'
		});
		
		// status
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormMenu({
				id: 'fe_ak_status',
				options: [[1,'Active'], [0,'Disabled']], // TODO: change this to a checkbox
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
				'data-admin_set': api_key.privileges.admin ? 1 : ''
			}),
			caption: 'Select which privileges the API Key account should have. Administrators have <b>all</b> privileges.'
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
	
	get_api_key_form_json() {
		// get api key elements from form, used for new or edit
		var api_key = this.api_key;
		
		api_key.key = $('#fe_ak_key').val();
		api_key.active = parseInt( $('#fe_ak_status').val() );
		api_key.title = $('#fe_ak_title').val().trim();
		api_key.description = $('#fe_ak_desc').val();
		api_key.privileges = array_to_hash_keys( $('#fe_ak_privs').val(), 1 );
		
		if (!api_key.key.length) {
			return app.badField('#fe_ak_key', "Please enter an API Key string, or generate a random one.");
		}
		
		return api_key;
	}
	
	generate_key() {
		// generate random api key
		$('#fe_ak_key').val( get_unique_id(24) );
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
