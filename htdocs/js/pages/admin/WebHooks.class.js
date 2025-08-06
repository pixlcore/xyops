// Admin Page -- Web Hooks Config

// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the PixlCore Sustainable Use License.
// See the LICENSE.md file in this repository.

Page.WebHooks = class WebHooks extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'ewh';
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		if (!this.requireAnyPrivilege('create_web_hooks', 'edit_web_hooks', 'delete_web_hooks')) return true;
		
		if (!args) args = {};
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show web hook list
		app.setWindowTitle( "Web Hooks" );
		app.setHeaderTitle( '<i class="mdi mdi-webhook">&nbsp;</i>Web Hooks' );
		
		// use web hooks in app cache
		this.receive_web_hooks({
			code: 0,
			rows: app.web_hooks,
			list: { length: app.web_hooks.length }
		});
	}
	
	receive_web_hooks(resp) {
		// receive all web hooks from server, render them sorted
		var self = this;
		var html = '';
		
		if (!resp.rows) resp.rows = [];
		this.web_hooks = resp.rows;
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Hook Title', 'Hook ID', 'URL', 'Author', 'Created', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Web Hooks';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var opts = {
			rows: this.web_hooks,
			cols: cols,
			data_type: 'web hook',
			grid_template_columns: 'min-content' + ' auto'.repeat( cols.length - 1 ),
			attribs: {
				class: 'data_grid webhook_grid'
			}
		};
		
		html += this.getBasicGrid( opts, function(item, idx) {
			var actions = [];
			if (app.hasPrivilege('edit_web_hooks')) actions.push( '<span class="link" onClick="$P().edit_web_hook('+idx+')"><b>Edit</b></span>' );
			if (app.hasPrivilege('delete_web_hooks')) actions.push( '<span class="link danger" onClick="$P().delete_web_hook('+idx+')"><b>Delete</b></span>' );
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggle_web_hook_enabled(this,' + idx + ')'
				}) + '</div>',
				'<b>' + self.getNiceWebHook(item, app.hasPrivilege('edit_web_hooks')) + '</b>',
				'<span class="mono">' + item.id + '</span>',
				'<span class="">' + item.url + '</span>',
				self.getNiceUser(item.username, app.isAdmin()),
				'<span title="' + self.getNiceDateTimeText(item.created) + '">' + self.getNiceDate(item.created) + '</span>',
				actions.join(' | ')
			];
			
			if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			if (app.hasAnyPrivilege('create_web_hooks', 'edit_web_hooks')) html += '<div class="button phone_collapse" onClick="$P().doFileImportPrompt()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i><span>Import File...</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().go_history()"><i class="mdi mdi-history">&nbsp;</i><span>Revision History...</span></div>';
			if (app.hasPrivilege('create_web_hooks')) html += '<div class="button default" onClick="$P().edit_web_hook(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i><span>New Web Hook...</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.setupBoxButtonFloater();
	}
	
	toggle_web_hook_enabled(elem, idx) {
		// toggle web hook checkbox, actually do the enable/disable here, update row
		var self = this;
		var item = this.web_hooks[idx];
		
		if (config.alt_to_toggle && !app.lastClick.altKey) {
			$(elem).prop('checked', !$(elem).is(':checked'));
			return app.showMessage('warning', "Accidental Click Protection: Please hold the Alt/Opt key to toggle this checkbox.", 8);
		}
		
		item.enabled = !!$(elem).is(':checked');
		
		app.api.post( 'app/update_web_hook', item, function(resp) {
			if (!self.active) return; // sanity
			
			if (item.enabled) $(elem).closest('ul').removeClass('disabled');
			else $(elem).closest('ul').addClass('disabled');
		} );
	}
	
	edit_web_hook(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#WebHooks?sub=edit&id=' + this.web_hooks[idx].id );
		else Nav.go( '#WebHooks?sub=new' );
	}
	
	delete_web_hook(idx) {
		// delete web hook from search results
		this.web_hook = this.web_hooks[idx];
		this.show_delete_web_hook_dialog();
	}
	
	go_history() {
		Nav.go( '#WebHooks?sub=history' );
	}
	
	gosub_history(args) {
		// show revision history sub-page
		app.setHeaderNav([
			{ icon: 'webhook', loc: '#WebHooks?sub=list', title: 'Web Hooks' },
			{ icon: 'history', title: "Revision History" }
		]);
		app.setWindowTitle( "Web Hook History" );
		
		this.goRevisionHistory({
			activityType: 'web_hooks',
			itemKey: 'web_hook',
			editPageID: 'WebHooks',
			itemMenu: {
				label: '<i class="icon mdi mdi-webhook">&nbsp;</i>Web Hook:',
				title: 'Select Web Hook',
				options: [['', 'Any Web Hook']].concat( app.web_hooks ),
				default_icon: 'webhook'
			}
		});
	}
	
	gosub_new(args) {
		// create new web hook
		var html = '';
		app.setWindowTitle( "New Web Hook" );
		
		app.setHeaderNav([
			{ icon: 'webhook', loc: '#WebHooks?sub=list', title: 'Web Hooks' },
			{ icon: 'webhook', title: "New Web Hook" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New Web Hook';
			html += '<div class="box_subtitle"><a href="#WebHooks?sub=list">&laquo; Back to Web Hook List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.web_hook = {
			"id": "",
			"title": "",
			"enabled": true,
			"url": "",
			"method": "POST",
			"headers": [
				{ "name": "Content-Type", "value": "application/json" },
				{ "name": "User-Agent", "value": "OpsRocket/WebHook" }
			],
			"body": JSON.stringify({ content: '[description]', text: '[description]' }, null, "\t"),
			"timeout": 30,
			"retries": 0,
			"follow": false,
			"ssl_cert_bypass": false,
			"max_per_day": 0,
			"notes": ""
		};
		this.headers = this.web_hook.headers;
		
		html += this.get_web_hook_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button mobile_collapse" onClick="$P().cancel_web_hook_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_test_web_hook()"><i class="mdi mdi-test-tube">&nbsp;</i><span>Test...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button primary phone_collapse" onClick="$P().do_new_web_hook()"><i class="mdi mdi-floppy">&nbsp;</i><span>Create Web Hook</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		// MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ewh_icon, #fe_ewh_method') );
		RelativeTime.init( $('#fe_ewh_timeout') );
		// this.updateAddRemoveMe('#fe_ewh_email');
		$('#fe_ewh_title').focus();
		this.setupBoxButtonFloater();
		this.setupEditor();
	}
	
	cancel_web_hook_edit() {
		// cancel editing web hook and return to list
		Nav.go( '#WebHooks?sub=list' );
	}
	
	do_new_web_hook(force) {
		// create new web hook
		app.clearError();
		var web_hook = this.get_web_hook_form_json();
		if (!web_hook) return; // error
		
		this.web_hook = web_hook;
		
		Dialog.showProgress( 1.0, "Creating Web Hook..." );
		app.api.post( 'app/create_web_hook', web_hook, this.new_web_hook_finish.bind(this) );
	}
	
	new_web_hook_finish(resp) {
		// new web hook created successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('WebHooks?sub=list');
		app.showMessage('success', "The new web hook was created successfully.");
	}
	
	gosub_edit(args) {
		// edit web hook subpage
		this.loading();
		app.api.post( 'app/get_web_hook', { id: args.id }, this.receive_web_hook.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_web_hook(resp) {
		// edit existing web hook
		var html = '';
		
		if (this.args.rollback && this.rollbackData) {
			resp.web_hook = this.rollbackData;
			delete this.rollbackData;
			app.showMessage('info', `Revision ${resp.web_hook.revision} has been loaded as a draft edit.  Click 'Save Changes' to complete the rollback.  Note that a new revision number will be assigned.`);
		}
		
		this.web_hook = resp.web_hook;
		this.headers = this.web_hook.headers;
		if (!this.active) return; // sanity
		
		app.setWindowTitle( "Editing Web Hook \"" + (this.web_hook.title) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'webhook', loc: '#WebHooks?sub=list', title: 'Web Hooks' },
			{ icon: this.web_hook.icon || 'webhook', title: this.web_hook.title }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit Web Hook Details';
			html += '<div class="box_subtitle"><a href="#WebHooks?sub=list">&laquo; Back to Web Hook List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_web_hook_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button mobile_collapse" onClick="$P().cancel_web_hook_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			html += '<div class="button danger mobile_collapse" onClick="$P().show_delete_web_hook_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_test_web_hook()"><i class="mdi mdi-test-tube">&nbsp;</i><span>Test...</span></div>';
			html += '<div class="button secondary mobile_collapse sm_hide" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button secondary mobile_collapse sm_hide" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
			html += '<div class="button primary phone_collapse" onClick="$P().do_save_web_hook()"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Changes</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_ewh_icon, #fe_ewh_method') );
		RelativeTime.init( $('#fe_ewh_timeout') );
		// this.updateAddRemoveMe('#fe_ewh_email');
		this.setupBoxButtonFloater();
		this.setupEditor();
	}
	
	do_export() {
		// show export dialog
		app.clearError();
		var web_hook = this.get_web_hook_form_json();
		if (!web_hook) return; // error
		
		this.showExportOptions({
			name: 'web hook',
			dataType: 'web_hook',
			api: this.args.id ? 'update_web_hook' : 'create_web_hook',
			data: web_hook
		});
	}
	
	go_edit_history() {
		Nav.go( '#WebHooks?sub=history&id=' + this.web_hook.id );
	}
	
	do_test_web_hook() {
		// test web hook and display markdown result
		var self = this;
		
		app.clearError();
		var web_hook = this.get_web_hook_form_json();
		if (!web_hook) return; // error
		
		this.web_hook = web_hook;
		
		Dialog.showProgress( 1.0, "Testing Web Hook..." );
		
		app.api.post( 'app/test_web_hook', web_hook, function(resp) {
			Dialog.hideProgress();
			if (!self.active) return; // sanity
			
			var { code, description, details } = resp.result;
			
			if (description) {
				details = "**Result:** " + description + "\n\n" + details;
			}
			
			var title = "Web Hook Test Results";
			if (code) title = '<span style="color:var(--red);">' + title + '</span>';
			
			self.viewMarkdownAuto( title, details.trim() );
		} ); // api.post
	}
	
	do_save_web_hook() {
		// save changes to web hook
		app.clearError();
		var web_hook = this.get_web_hook_form_json();
		if (!web_hook) return; // error
		
		this.web_hook = web_hook;
		
		Dialog.showProgress( 1.0, "Saving Web Hook..." );
		app.api.post( 'app/update_web_hook', web_hook, this.save_web_hook_finish.bind(this) );
	}
	
	save_web_hook_finish(resp) {
		// new web hook saved successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go( 'WebHooks?sub=list' );
		app.showMessage('success', "The web hook was saved successfully.");
	}
	
	show_delete_web_hook_dialog() {
		// show dialog confirming web_hook delete action
		var self = this;
		
		Dialog.confirmDanger( 'Delete Web Hook', "Are you sure you want to <b>permanently delete</b> the web hook &ldquo;" + this.web_hook.title + "&rdquo;?  There is no way to undo this action.", ['trash-can', 'Delete'], function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Web Hook..." );
				app.api.post( 'app/delete_web_hook', self.web_hook, self.delete_web_hook_finish.bind(self) );
			}
		} );
	}
	
	delete_web_hook_finish(resp) {
		// finished deleting web hook
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('WebHooks?sub=list', 'force');
		app.showMessage('success', "The web hook &ldquo;" + this.web_hook.title + "&rdquo; was deleted successfully.");
	}
	
	get_web_hook_edit_html() {
		// get html for editing an web hook (or creating a new one)
		var html = '';
		var web_hook = this.web_hook;
		
		if (web_hook.id) {
			// web hook id
			html += this.getFormRow({
				label: 'Web Hook ID:',
				content: this.getFormText({
					id: 'fe_ewh_id',
					class: 'monospace',
					spellcheck: 'false',
					disabled: 'disabled',
					value: web_hook.id
				}),
				suffix: this.getFormIDCopier(),
				caption: 'This is a unique ID for the web hook, used by the OpsRocket API.  It cannot be changed.'
			});
		}
		
		// title
		html += this.getFormRow({
			label: 'Web Hook Title:',
			content: this.getFormText({
				id: 'fe_ewh_title',
				spellcheck: 'false',
				value: web_hook.title
			}),
			caption: 'Enter the title of the web hook, for display purposes.'
		});
		
		// enabled
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_ewh_enabled',
				label: 'Web Hook Enabled',
				checked: web_hook.enabled
			}),
			caption: 'Check this box to allow the web hook to be fired.'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_ewh_icon',
				title: 'Select icon for web hook',
				placeholder: 'Select icon for web hook...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: web_hook.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for the web hook.'
		});
		
		// url
		html += this.getFormRow({
			label: 'URL:',
			content: this.getFormText({
				id: 'fe_ewh_url',
				type: 'url',
				spellcheck: 'false',
				autocomplete: 'off',
				placeholder: 'https://',
				value: web_hook.url
			}),
			caption: 'Enter the fully-qualified URL for the web hook request.'
		});
		
		// method
		html += this.getFormRow({
			label: 'Method:',
			content: this.getFormMenuSingle({
				id: 'fe_ewh_method',
				title: 'Select Method',
				options: [ 'GET', 'HEAD', 'POST', 'PUT', 'DELETE' ],
				value: web_hook.method
			}),
			caption: 'Select which HTTP method to use when sending the request.'
		});
		
		// headers
		// (requires this.headers to be populated)
		html += this.getFormRow({
			label: 'Request Headers:',
			content: '<div id="d_ewh_header_table">' + this.getHeaderGrid() + '</div>',
			caption: 'Optionally enter HTTP request headers to send along with the request.'
		});
		
		// body
		html += this.getFormRow({
			id: 'd_editor',
			label: 'Request Body:',
			content: this.getFormTextarea({
				id: 'fe_editor',
				rows: 5,
				class: 'monospace',
				spellcheck: 'false',
				value: web_hook.body
			}),
			caption: 'For endpoints that require it, compose the request body here.  You can use `{{macros}}` to insert dynamic content from the web hook data.  [Learn More](#Docs/web-hooks/body)'
		});
		
		// timeout
		html += this.getFormRow({
			label: 'Timeout:',
			content: this.getFormRelativeTime({
				id: 'fe_ewh_timeout',
				value: web_hook.timeout
			}),
			caption: 'Enter the maximum time to allow for the request to complete, or 0 for infinite.'
		});
		
		// retries
		html += this.getFormRow({
			label: 'Retries:',
			content: this.getFormText({
				id: 'fe_ewh_retries',
				type: 'number',
				// class: 'monospace',
				spellcheck: 'false',
				maxlength: 3,
				min: 0,
				max: 999,
				value: web_hook.retries
			}),
			caption: 'Optionally allow a number of request retries before the web hook fails.'
		});
		
		// follow
		html += this.getFormRow({
			label: 'Redirects:',
			content: this.getFormCheckbox({
				id: 'fe_ewh_follow',
				label: 'Follow Redirects',
				checked: web_hook.follow
			}),
			caption: 'Check this box to automatically follow redirect responses.'
		});
		
		// ssl cert bypass
		html += this.getFormRow({
			label: 'Security:',
			content: this.getFormCheckbox({
				id: 'fe_ewh_ssl_cert_bypass',
				label: 'SSL Cert Bypass',
				checked: web_hook.ssl_cert_bypass
			}),
			caption: 'Check this box to allow self-signed SSL/HTTPS certificates.'
		});
		
		// max per day
		html += this.getFormRow({
			label: 'Max Per Day:',
			content: this.getFormText({
				id: 'fe_ewh_max_per_day',
				type: 'number',
				// class: 'monospace',
				spellcheck: 'false',
				maxlength: 5,
				min: 0,
				max: 9999999,
				value: web_hook.max_per_day || 0
			}),
			caption: 'Optionally set a maximum number of invocations per day for the web hook (antiflood).'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_ewh_notes',
				rows: 5,
				value: web_hook.notes
			}),
			caption: 'Optionally enter notes for the web hook, for your own internal use.'
		});
		
		return html;
	}
	
	renderHeaderEditor() {
		// render header editor
		var dom_prefix = this.dom_prefix;
		var html = this.getHeaderGrid();
		this.div.find('#d_' + dom_prefix + '_header_table').html( html );
	}
	
	getHeaderGrid() {
		// get html for header grid
		var self = this;
		var html = '';
		var rows = this.headers;
		var cols = ['Header Name', 'Header Value', 'Actions'];
		var add_link = '<div class="button small secondary" onClick="$P().editHeader(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i>New Header...</div>';
		
		var targs = {
			rows: rows,
			cols: cols,
			data_type: 'header',
			class: 'data_grid',
			empty_msg: add_link,
			always_append_empty_msg: true
		};
		
		html += this.getCompactGrid(targs, function(item, idx) {
			var links = [];
			links.push( '<span class="link" onClick="$P().editHeader('+idx+')"><b>Edit</b></span>' );
			links.push( '<span class="link danger" onClick="$P().deleteHeader('+idx+')"><b>Delete</b></span>' );
			
			var tds = [
				'<div class="td_big ellip"><i class="mdi mdi-form-textbox">&nbsp;</i><span class="link" onClick="$P().editHeader('+idx+')">' + encode_entities(item.name) + '</span></div>',
				'<div class="ellip">' + encode_entities(item.value) + '</div>',
				'<div class="ellip">' + links.join(' | ') + '</div>'
			];
			
			// if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getCompactGrid
		
		return html;
	}
	
	editHeader(idx) {
		// show dialog to edit header
		// header: { name, value }
		var self = this;
		var header = (idx > -1) ? this.headers[idx] : { name: '', value: '' };
		var title = (idx > -1) ? "Editing Header" : "New Header";
		var btn = (idx > -1) ? ['check-circle', "Accept"] : ['plus-circle', "Add Header"];
		
		var html = '<div class="dialog_box_content scroll">';
		
		html += this.getFormRow({
			id: 'd_eh_name',
			label: 'Header Name:',
			content: this.getFormText({
				id: 'fe_eh_name',
				spellcheck: 'false',
				maxlength: 8192,
				placeholder: '',
				value: header.name || ''
			}),
			caption: 'Enter the name of the HTTP request header.'
		});
		
		html += this.getFormRow({
			id: 'd_eh_value',
			label: 'Header Value:',
			content: this.getFormText({
				id: 'fe_eh_value',
				spellcheck: 'false',
				maxlength: 8192,
				placeholder: '',
				value: header.value || ''
			}),
			caption: 'Enter the value for the HTTP request header.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			
			header = {
				name: $('#fe_eh_name').val(),
				value: $('#fe_eh_value').val()
			};
			
			if (!header.name.match(/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/)) {
				return app.badField('fe_eh_name', "Please enter a valid HTTP header name.");
			}
			if (!header.value.match(/^[\t\x20-\x7E\x80-\xFF]*$/)) {
				return app.badField('fe_eh_value', "Please enter a valid HTTP header value.");
			}
			
			// see if we need to add or replace
			if (idx == -1) {
				self.headers.push(header);
			}
			else self.headers[idx] = header;
			
			// keep list sorted
			sort_by(self.headers, 'name');
			
			// self.dirty = true;
			self.renderHeaderEditor();
			Dialog.hide();
		} ); // Dialog.confirm
		
		if (idx == -1) $('#fe_eh_name').focus();
		
		Dialog.autoResize();
	}
	
	deleteHeader(idx) {
		// delete selected header
		this.headers.splice( idx, 1 );
		this.renderHeaderEditor();
	}
	
	get_web_hook_form_json() {
		// get api key elements from form, used for new or edit
		var web_hook = this.web_hook;
		
		web_hook.title = $('#fe_ewh_title').val().trim();
		web_hook.enabled = $('#fe_ewh_enabled').is(':checked') ? true : false;
		web_hook.icon = $('#fe_ewh_icon').val();
		
		web_hook.url = $('#fe_ewh_url').val();
		web_hook.method = $('#fe_ewh_method').val();
		web_hook.body = this.editor.getValue();
		web_hook.timeout = parseInt( $('#fe_ewh_timeout').val() );
		web_hook.retries = parseInt( $('#fe_ewh_retries').val() );
		web_hook.follow = $('#fe_ewh_follow').is(':checked') ? true : false;
		web_hook.ssl_cert_bypass = $('#fe_ewh_ssl_cert_bypass').is(':checked') ? true : false;
		web_hook.max_per_day = parseInt( $('#fe_ewh_max_per_day').val() );
		web_hook.notes = $('#fe_ewh_notes').val();
		
		if (!web_hook.title.length) {
			return app.badField('#fe_ewh_title', "Please enter a title for the web hook.");
		}
		if (!web_hook.url.match(/^https?:\/\/\S+$/i)) {
			return app.badField('#fe_ewh_url', "Please enter a fully-qualified URL for the web hook.");
		}
		
		return web_hook;
	}
	
	onResize() {
		// resize codemirror to match
		this.handleEditorResize();
	}
	
	onThemeChange(theme) {
		// change codemirror theme too
		this.handleEditorThemeChange(theme);
	}
	
	onDataUpdate(key, data) {
		// refresh list if web_hooks were updated
		if ((key == 'web_hooks') && (this.args.sub == 'list')) this.gosub_list(this.args);
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.killEditor();
		this.cleanupRevHistory();
		this.div.html( '' );
		return true;
	}
	
};
