// Admin Page -- Secret Management

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Secrets = class Secrets extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'se';
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		if (!this.requireAnyPrivilege('admin')) return true;
		
		if (!args) args = {};
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show secret list
		app.setWindowTitle( "Secrets Management" );
		app.setHeaderTitle( '<i class="mdi mdi-shield-lock">&nbsp;</i>Secrets Management' );
		
		// this.loading();
		// app.api.post( 'app/get_secrets', copy_object(args), this.receive_secrets.bind(this) );
		
		// use secrets in app cache
		this.receive_secrets({
			code: 0,
			rows: app.secrets,
			list: { length: app.secrets.length }
		});
	}
	
	receive_secrets(resp) {
		// receive all secrets from server, render them sorted
		var self = this;
		var html = '';
		
		if (!resp.rows) resp.rows = [];
		this.secrets = resp.rows;
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Secret Title', 'Secret ID', 'Author', 'Created', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Secrets';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var grid_opts = {
			rows: this.secrets,
			cols: cols,
			data_type: 'secret',
			grid_template_columns: 'min-content' + ' auto'.repeat( cols.length - 1 )
		};
		
		html += this.getBasicGrid( grid_opts, function(item, idx) {
			var actions = [];
			actions.push( '<span class="link" onClick="$P().edit_secret('+idx+')"><b>Edit</b></span>' );
			actions.push( '<span class="link danger" onClick="$P().delete_secret('+idx+')"><b>Delete</b></span>' );
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggle_secret_enabled(this,' + idx + ')'
				}) + '</div>',
				'<b>' + self.getNiceSecret(item, true) + '</b>',
				'<span class="mono">' + item.id + '</span>',
				self.getNiceUser(item.username, app.isAdmin()),
				'<span title="' + self.getNiceDateTimeText(item.created) + '">' + self.getNiceDate(item.created) + '</span>',
				actions.join(' | ')
			];
			
			if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			// html += '<div class="button phone_collapse" onClick="$P().doFileImportPrompt()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i><span>Import File...</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().go_history()"><i class="mdi mdi-history">&nbsp;</i><span>Revision History...</span></div>';
			html += '<div class="button default" onClick="$P().edit_secret(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i><span>New Secret...</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.setupBoxButtonFloater();
	}
	
	toggle_secret_enabled(elem, idx) {
		// toggle secret checkbox, actually do the enable/disable here, update row
		var self = this;
		var item = this.secrets[idx];
		
		if (config.alt_to_toggle && !app.lastClick.altKey) {
			$(elem).prop('checked', !$(elem).is(':checked'));
			return app.showMessage('warning', "Accidental Click Protection: Please hold the Alt/Opt key to toggle this checkbox.", 8);
		}
		
		item.enabled = !!$(elem).is(':checked');
		
		app.api.post( 'app/update_secret', item, function(resp) {
			if (!self.active) return; // sanity
			
			if (item.enabled) $(elem).closest('ul').removeClass('disabled');
			else $(elem).closest('ul').addClass('disabled');
		} );
	}
	
	edit_secret(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Secrets?sub=edit&id=' + this.secrets[idx].id );
		else Nav.go( '#Secrets?sub=new' );
	}
	
	delete_secret(idx) {
		// delete secret from search results
		this.secret = this.secrets[idx];
		this.show_delete_secret_dialog();
	}
	
	go_history() {
		Nav.go( '#Secrets?sub=history' );
	}
	
	gosub_history(args) {
		// show revision history sub-page
		app.setHeaderNav([
			{ icon: 'shield-lock', loc: '#Secrets?sub=list', title: 'Secrets' },
			{ icon: 'history', title: "Revision History" }
		]);
		app.setWindowTitle( "Secret Revision History" );
		
		this.goRevisionHistory({
			activityType: 'secrets',
			itemKey: 'secret',
			editPageID: 'Secrets',
			itemMenu: {
				label: '<i class="icon mdi mdi-shield-lock-outline">&nbsp;</i>Secret:',
				title: 'Select Secret',
				options: [['', 'Any Secret']].concat( app.secrets ),
				default_icon: 'shield-lock-outline'
			}
		});
	}
	
	gosub_new(args) {
		// create new secret
		var html = '';
		app.setWindowTitle( "New Secret" );
		
		app.setHeaderNav([
			{ icon: 'shield-lock', loc: '#Secrets?sub=list', title: 'Secrets' },
			{ icon: 'shield-lock-outline', title: "New Secret" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New Secret';
			html += '<div class="box_subtitle"><a href="#Secrets?sub=list">&laquo; Back to Secret List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.secret = {
			"id": "",
			"title": "",
			"enabled": true,
			"icon": "",
			"notes": "",
			"names": [],
			"events": [],
			"categories": [],
			"plugins": [],
			"web_hooks": []
		};
		
		this.fields = []; // start in secret edit mode
		
		html += this.get_secret_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button phone_collapse" onClick="$P().cancel_secret_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			// html += '<div class="button secondary phone_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button primary" onClick="$P().do_new_secret()"><i class="mdi mdi-floppy">&nbsp;</i><span>Create Secret</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_se_icon') );
		// this.updateAddRemoveMe('#fe_se_email');
		$('#fe_se_title').focus();
		this.setupBoxButtonFloater();
	}
	
	cancel_secret_edit() {
		// cancel editing secret and return to list
		Nav.go( '#Secrets?sub=list' );
	}
	
	do_new_secret(force) {
		// create new secret
		app.clearError();
		var secret = this.get_secret_form_json();
		if (!secret) return; // error
		
		this.secret = secret;
		
		Dialog.showProgress( 1.0, "Creating Secret..." );
		app.api.post( 'app/create_secret', { ...secret }, this.new_secret_finish.bind(this) );
	}
	
	new_secret_finish(resp) {
		// new secret created successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Secrets?sub=list');
		app.showMessage('success', "The new secret was created successfully.");
	}
	
	gosub_edit(args) {
		// edit secret subpage
		this.loading();
		
		app.api.post( 'app/get_secret', { id: args.id }, this.receive_secret.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_secret(resp) {
		// edit existing secret
		var html = '';
		
		this.secret = resp.secret;
		this.fields = null; // do not load secrets by default
		
		if (!this.active) return; // sanity
		
		app.setWindowTitle( "Editing Secret \"" + (this.secret.title) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'shield-lock', loc: '#Secrets?sub=list', title: 'Secrets' },
			{ icon: this.secret.icon || 'shield-lock-outline', title: this.secret.title }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit Secret Details';
			html += '<div class="box_subtitle"><a href="#Secrets?sub=list">&laquo; Back to Secret List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_secret_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button cancel mobile_collapse" onClick="$P().cancel_secret_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Close</span></div>';
			html += '<div class="button danger mobile_collapse" onClick="$P().show_delete_secret_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>';
			// html += '<div class="button secondary mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
			html += '<div class="button save phone_collapse" onClick="$P().do_save_secret()"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Changes</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_se_icon') );
		// this.updateAddRemoveMe('#fe_se_email');
		this.setupBoxButtonFloater();
		// this.setupUploader();
		this.setupEditTriggers();
	}
	
	go_edit_history() {
		Nav.go( '#Secrets?sub=history&id=' + this.secret.id );
	}
	
	do_save_secret() {
		// save changes to secret
		app.clearError();
		var secret = this.get_secret_form_json();
		if (!secret) return; // error
		
		this.secret = secret;
		
		Dialog.showProgress( 1.0, "Saving Secret..." );
		app.api.post( 'app/update_secret', { ...secret }, this.save_secret_finish.bind(this) );
	}
	
	save_secret_finish(resp) {
		// secret saved successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		// exit from edit mode
		delete this.fields;
		this.renderSecretEditor();
		
		// Nav.go( 'Secrets?sub=list' );
		this.triggerSaveComplete();
		app.showMessage('success', "The secret was saved successfully.");
	}
	
	show_delete_secret_dialog() {
		// show dialog confirming secret delete action
		var self = this;
		
		Dialog.confirmDanger( 'Delete Secret', "Are you sure you want to <b>permanently delete</b> the secret &ldquo;" + this.secret.title + "&rdquo;?  There is no way to undo this action.", ['trash-can', 'Delete'], function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Secret..." );
				app.api.post( 'app/delete_secret', self.secret, self.delete_secret_finish.bind(self) );
			}
		} );
	}
	
	delete_secret_finish(resp) {
		// finished deleting secret
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Secrets?sub=list', 'force');
		app.showMessage('success', "The secret &ldquo;" + this.secret.title + "&rdquo; was deleted successfully.");
	}
	
	get_secret_edit_html() {
		// get html for editing an secret (or creating a new one)
		var html = '';
		var secret = this.secret;
		
		if (secret.id) {
			// secret id
			html += this.getFormRow({
				label: 'Secret ID:',
				content: this.getFormText({
					id: 'fe_se_id',
					class: 'monospace',
					spellcheck: 'false',
					disabled: 'disabled',
					value: secret.id
				}),
				suffix: this.getFormIDCopier(),
				caption: 'This is a unique ID for the secret, used by the API.  It cannot be changed.'
			});
		}
		
		// title
		html += this.getFormRow({
			label: 'Secret Title:',
			content: this.getFormText({
				id: 'fe_se_title',
				spellcheck: 'false',
				value: secret.title
			}),
			caption: 'Enter the title of the secret, for display purposes.'
		});
		
		// enabled
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_se_enabled',
				label: 'Secret Enabled',
				checked: secret.enabled
			}),
			caption: 'Check this box to enable access to the secret.'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_se_icon',
				title: 'Select icon for secret',
				placeholder: 'Select icon for secret...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: secret.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for the secret.'
		});
		
		// events
		html += this.getFormRow({
			label: 'Event Access:',
			content: this.getFormMenuMulti({
				id: 'fe_se_events',
				title: 'Allow access to events',
				placeholder: '(None)',
				options: this.getCategorizedEvents(),
				values: secret.events || [],
				default_icon: 'file-clock-outline',
				'data-hold': 1,
				'data-select-all': 1
			}),
			caption: 'Allow one or more events access to the secret.  Each event job will automatically receive the secret as environment variables when launched.'
		});
		
		// categories
		html += this.getFormRow({
			label: 'Category Access:',
			content: this.getFormMenuMulti({
				id: 'fe_se_cats',
				title: 'Allow access to categories',
				placeholder: '(None)',
				options: app.categories,
				values: secret.categories || [],
				default_icon: 'folder-open-outline',
				'data-hold': 1,
				'data-select-all': 1
			}),
			caption: 'Allow one or more categories access to the secret.  All events assigned to the selected categories will receive the secret when launched.'
		});
		
		// plugins
		html += this.getFormRow({
			label: 'Plugin Access:',
			content: this.getFormMenuMulti({
				id: 'fe_se_plugins',
				title: 'Allow access to plugins',
				placeholder: '(None)',
				options: app.plugins.filter( function(plugin) { return plugin.type != 'monitor'; } ),
				values: secret.plugins || [],
				default_icon: 'power-plug-outline',
				'data-hold': 1,
				'data-select-all': 1
			}),
			caption: 'Allow one or more plugins access to the secret.  Plugins will automatically receive the secret as environment variables when launched.'
		});
		
		// web hooks
		html += this.getFormRow({
			label: 'Web Hook Access:',
			content: this.getFormMenuMulti({
				id: 'fe_se_web_hooks',
				title: 'Allow access to web hooks',
				placeholder: '(None)',
				options: app.web_hooks,
				values: secret.web_hooks || [],
				default_icon: 'webhook',
				'data-hold': 1,
				'data-select-all': 1
			}),
			caption: 'Allow one or more web hooks access to the secret.  Web hooks can expand secrets using the `{{ secrets.VAR_NAME }}` syntax.'
		});
		
		// data
		html += this.getFormRow({
			label: 'Secret Variables:',
			content: '<div id="d_se_data_table">' + this.getSecretTable() + '</div>',
			caption: 'Add, edit or delete individual secret variables here.  They will be encrypted on save.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_se_notes',
				rows: 5,
				value: secret.notes
			}),
			caption: 'Optionally enter notes for the secret, for your own internal use.'
		});
		
		return html;
	}
	
	renderSecretEditor() {
		// render secret file editor
		var html = this.getSecretTable();
		this.div.find('#d_se_data_table').html( html );
	}
	
	getSecretTable() {
		// get html for secret grid
		var self = this;
		var html = '';
		var rows = [];
		var cols = ['Variable Name', 'Variable Value', 'Actions'];
		var add_link = '';
		
		if (this.fields) {
			// edit mode
			rows = this.fields;
			add_link = '<div class="button small secondary" onClick="$P().editVariable(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i>New Variable...</div>';
		}
		else {
			// keys only mode
			rows = this.secret.names.map( function(name) { return { name, value: '********' }; } );
			add_link = '<div class="button small danger" onClick="$P().decryptSecret()"><i class="mdi mdi-shield-key-outline">&nbsp;</i>Decrypt for Editing...</div>';
		}
		
		// sort by name
		sort_by( rows, 'name' );
		
		var targs = {
			rows: rows,
			cols: cols,
			data_type: 'variable',
			class: 'data_grid',
			empty_msg: add_link,
			always_append_empty_msg: true
		};
		
		html += this.getCompactGrid(targs, function(item, idx) {
			var link = '';
			var links = [];
			
			if (self.fields) {
				link = '<span class="link" onClick="$P().editVariable('+idx+')">' + encode_entities(item.name) + '</span>';
				links.push( '<span class="link" onClick="$P().editVariable('+idx+')"><b>Edit</b></span>' );
				links.push( '<span class="link danger" onClick="$P().deleteVariable('+idx+')"><b>Delete</b></span>' );
			}
			else {
				link = '<span>' + encode_entities(item.name) + '</span>';
			}
			
			var tds = [
				'<div class="td_big ellip monospace"><i class="mdi mdi-form-textbox">&nbsp;</i>' + link + '</div>',
				'<div class="ellip monospace" data-private>' + encode_entities(item.value) + '</div>',
				'<div class="ellip">' + (links.join(' | ') || '-') + '</div>'
			];
			
			// if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getCompactGrid
		
		return html;
	}
	
	decryptSecret() {
		// prompt user before decrypting, as it logs access
		var self = this;
		if (!this.secret.id) return; // sanity
		
		Dialog.confirmDanger( 'Decrypt Secret', "Are you sure you want to decrypt the secret for editing?  This will log a secret access event in the system activity log, tagged with your username.", ['shield-key-outline', 'Decrypt'], function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Decrypting Secret..." );
			
			app.api.post( 'app/decrypt_secret', { id: self.secret.id }, function(resp) {
				Dialog.hideProgress();
				
				self.fields = resp.fields;
				self.renderSecretEditor();
				
				app.showMessage('success', config.ui.messages.secret_decrypted);
			} ); // api.post
		} ); // confirm
	}
	
	editVariable(idx) {
		// show dialog to edit secret variable pair
		// data: { name, value }
		var self = this;
		var variable = (idx > -1) ? this.fields[idx] : { name: '', value: '' };
		var title = (idx > -1) ? "Editing Variable" : "New Variable";
		var btn = (idx > -1) ? ['check-circle', "Accept"] : ['plus-circle', "Add Variable"];
		
		var html = '<div class="dialog_box_content scroll maximize">';
		
		html += this.getFormRow({
			id: 'd_es_name',
			label: 'Variable Name:',
			content: this.getFormText({
				id: 'fe_sev_name',
				spellcheck: 'false',
				autocomplete: 'off',
				class: 'monospace',
				maxlength: 8192,
				placeholder: '',
				value: variable.name || ''
			}),
			caption: 'Enter the name of the secret variable, which must follow POSIX environment variable naming rules.'
		});
		
		html += this.getFormRow({
			id: 'd_es_value',
			label: 'Variable Value:',
			content: this.getFormTextarea({
				id: 'fe_sev_value',
				rows: 5,
				spellcheck: 'false',
				class: 'monospace',
				maxlength: 1024 * 1024,
				placeholder: '',
				value: variable.value,
				'data-private': 1
			}),
			caption: 'Enter the value for the secret variable, which can be any text-based format and up to **1 MB** in size.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			
			variable = {
				name: $('#fe_sev_name').val().trim(),
				value: $('#fe_sev_value').val()
			};
			
			if (!variable.name.match(/^[A-Za-z_]\w*$/)) {
				return app.badField('fe_sev_name', "Please enter a valid variable name (must follow POSIX environment variable rules).");
			}
			
			// if user enters a new dupe name, just silently replace existing
			if (idx == -1) idx = find_object_idx( self.fields, { name: variable.name } );
			
			// see if we need to add or replace
			if (idx == -1) self.fields.push(variable);
			else self.fields[idx] = variable;
			
			// keep list sorted
			sort_by(self.fields, 'name');
			
			self.renderSecretEditor();
			self.triggerEditChange();
			Dialog.hide();
		} ); // Dialog.confirm
		
		if (idx == -1) $('#fe_sev_name').focus();
		
		Dialog.autoResize();
	}
	
	deleteVariable(idx) {
		// delete selected variable
		this.fields.splice( idx, 1 );
		this.renderSecretEditor();
		this.triggerEditChange();
	}
	
	get_secret_form_json() {
		// get secret elements from form, used for new or edit
		var secret = this.secret;
		
		secret.title = $('#fe_se_title').val().trim();
		secret.enabled = $('#fe_se_enabled').is(':checked') ? true : false;
		secret.icon = $('#fe_se_icon').val();
		secret.events = $('#fe_se_events').val();
		secret.categories = $('#fe_se_cats').val();
		secret.plugins = $('#fe_se_plugins').val();
		secret.web_hooks = $('#fe_se_web_hooks').val();
		secret.notes = $('#fe_se_notes').val();
		
		if (this.fields) secret.fields = this.fields; // edit mode
		
		if (!secret.title.length) {
			return app.badField('#fe_se_title', "Please enter a title for the secret.");
		}
		
		return secret;
	}
	
	onDataUpdate(key, data) {
		// refresh list if secrets were updated
		if ((key == 'secrets') && (this.args.sub == 'list')) this.gosub_list(this.args);
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.cleanupRevHistory();
		this.div.html( '' );
		
		delete this.secret;
		delete this.fields;
		
		return true;
	}
	
};
