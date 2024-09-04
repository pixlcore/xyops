// Admin Page -- Web Hooks Config

Page.WebHooks = class WebHooks extends Page.Base {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'ewh';
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
		// show web hook list
		app.setWindowTitle( "Web Hooks" );
		app.setHeaderTitle( '<i class="mdi mdi-web">&nbsp;</i>Web Hooks' );
		
		// use web hooks in app cache
		this.receive_web_hooks({
			code: 0,
			rows: app.web_hooks,
			list: { length: app.web_hooks.length }
		});
	}
	
	receive_web_hooks(resp) {
		// receive all web hooks from server, render them sorted
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
			attribs: {
				class: 'data_grid webhook_grid'
			}
		};
		
		var self = this;
		html += this.getBasicGrid( opts, function(item, idx) {
			var actions = [];
			actions.push( '<span class="link" onMouseUp="$P().edit_web_hook('+idx+')"><b>Edit</b></span>' );
			actions.push( '<span class="link danger" onMouseUp="$P().delete_web_hook('+idx+')"><b>Delete</b></span>' );
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggle_web_hook_enabled(this,' + idx + ')'
				}) + '</div>',
				'<b>' + self.getNiceWebHook(item, true) + '</b>',
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
			html += '<div class="button secondary" onMouseUp="$P().edit_web_hook(-1)">Add Web Hook...</div>';
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
			
			if (item.enabled) $(elem).closest('tr').removeClass('disabled');
			else $(elem).closest('tr').addClass('disabled');
			
			$(elem).closest('tr').find('div.td_big').html( self.getNiceWebHook(item, true) );
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
	
	gosub_new(args) {
		// create new web hook
		var html = '';
		app.setWindowTitle( "New Web Hook" );
		
		app.setHeaderNav([
			{ icon: 'web', loc: '#WebHooks?sub=list', title: 'Web Hooks' },
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
			"headers": "Content-Type: application/json\nUser-Agent: Orchestra/WebHook",
			"body": JSON.stringify({ content: '[description]', text: '[description]' }, null, "\t"),
			"timeout": 30,
			"retries": 0,
			"follow": false,
			"ssl_cert_bypass": false,
			"notes": ""
		};
		
		html += this.get_web_hook_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_web_hook_edit()">Cancel</div>';
			html += '<div class="button secondary" onMouseUp="$P().do_test_web_hook()"><i class="mdi mdi-test-tube">&nbsp;</i>Test Web Hook...</div>';
			html += '<div class="button primary" onMouseUp="$P().do_new_web_hook()"><i class="mdi mdi-floppy">&nbsp;</i>Create Web Hook</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		// MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ewh_icon') );
		// this.updateAddRemoveMe('#fe_ewh_email');
		$('#fe_ewh_title').focus();
		this.setupBoxButtonFloater();
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
		this.web_hook = resp.web_hook;
		if (!this.active) return; // sanity
		
		app.setWindowTitle( "Editing Web Hook \"" + (this.web_hook.title) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'web', loc: '#WebHooks?sub=list', title: 'Web Hooks' },
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
			html += '<div class="button" onMouseUp="$P().cancel_web_hook_edit()">Cancel</div>';
			html += '<div class="button danger" onMouseUp="$P().show_delete_web_hook_dialog()">Delete Web Hook...</div>';
			html += '<div class="button secondary" onMouseUp="$P().do_test_web_hook()"><i class="mdi mdi-test-tube">&nbsp;</i>Test Web Hook...</div>';
			html += '<div class="button primary" onMouseUp="$P().do_save_web_hook()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		// lock ID for editing
		$('#fe_ewh_id').attr('disabled', true);
		SingleSelect.init( this.div.find('#fe_ewh_icon') );
		// this.updateAddRemoveMe('#fe_ewh_email');
		this.setupBoxButtonFloater();
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
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go( 'WebHooks?sub=list' );
		app.showMessage('success', "The web hook was saved successfully.");
	}
	
	show_delete_web_hook_dialog() {
		// show dialog confirming web_hook delete action
		var self = this;
		
		Dialog.confirmDanger( 'Delete Web Hook', "Are you sure you want to <b>permanently delete</b> the web hook &ldquo;" + this.web_hook.title + "&rdquo;?  There is no way to undo this action.", 'Delete', function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Web Hook..." );
				app.api.post( 'app/delete_web_hook', self.web_hook, self.delete_web_hook_finish.bind(self) );
			}
		} );
	}
	
	delete_web_hook_finish(resp) {
		// finished deleting web hook
		var self = this;
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('WebHooks?sub=list', 'force');
		app.showMessage('success', "The web hook &ldquo;" + this.web_hook.title + "&rdquo; was deleted successfully.");
	}
	
	get_web_hook_edit_html() {
		// get html for editing an web hook (or creating a new one)
		var html = '';
		var web_hook = this.web_hook;
		
		// title
		html += this.getFormRow({
			label: 'Web Hook Title:',
			content: this.getFormText({
				id: 'fe_ewh_title',
				spellcheck: 'false',
				value: web_hook.title,
				onChange: '$P().suggestIDFromTitle()'
			}),
			caption: 'Enter the title of the web hook, for display purposes.'
		});
		
		// web hook id
		html += this.getFormRow({
			label: 'Web Hook ID:',
			content: this.getFormText({
				id: 'fe_ewh_id',
				class: 'monospace',
				spellcheck: 'false',
				onChange: '$P().checkWebHookExists(this)',
				value: web_hook.id
			}),
			suffix: '<div class="checker"></div>',
			caption: 'Enter a unique ID for the web hook (alphanumerics only).  Once created this cannot be changed.'
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
			content: this.getFormMenu({
				id: 'fe_ewh_method',
				title: 'Select Method',
				options: [ 'GET', 'HEAD', 'POST', 'PUT', 'DELETE' ],
				value: web_hook.method
			}),
			caption: 'Select which HTTP method to use when sending the request.'
		});
		
		// headers
		html += this.getFormRow({
			label: 'Request Headers:',
			content: this.getFormTextarea({
				id: 'fe_ewh_headers',
				rows: 5,
				class: 'monospace',
				spellcheck: 'false',
				value: web_hook.headers
			}),
			caption: 'Optionally enter HTTP request headers to send along with the request.'
		});
		
		// body
		html += this.getFormRow({
			label: 'Request Body:',
			content: this.getFormTextarea({
				id: 'fe_ewh_body',
				rows: 5,
				class: 'monospace',
				spellcheck: 'false',
				value: web_hook.body
			}),
			caption: 'For endpoints that require it, compose the request body here.  You can use macros to insert dynamic content.' // TODO: link to docs
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
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_ewh_notes',
				rows: 5,
				value: web_hook.notes
			}),
			caption: 'Optionally enter notes for the web_hook, which will be included in all e-mail notifications.'
		});
		
		return html;
	}
	
	get_web_hook_form_json() {
		// get api key elements from form, used for new or edit
		var web_hook = this.web_hook;
		
		web_hook.id = $('#fe_ewh_id').val().replace(/\W+/g, '').toLowerCase();
		web_hook.title = $('#fe_ewh_title').val().trim();
		web_hook.enabled = $('#fe_ewh_enabled').is(':checked') ? true : false;
		web_hook.icon = $('#fe_ewh_icon').val();
		
		web_hook.url = $('#fe_ewh_url').val();
		web_hook.method = $('#fe_ewh_method').val();
		web_hook.headers = $('#fe_ewh_headers').val();
		web_hook.body = $('#fe_ewh_body').val();
		web_hook.timeout = parseInt( $('#fe_ewh_timeout').val() );
		web_hook.retries = parseInt( $('#fe_ewh_retries').val() );
		web_hook.follow = $('#fe_ewh_follow').is(':checked') ? true : false;
		web_hook.ssl_cert_bypass = $('#fe_ewh_ssl_cert_bypass').is(':checked') ? true : false;
		web_hook.notes = $('#fe_ewh_notes').val();
		
		if (!web_hook.id.length) {
			return app.badField('#fe_ewh_id', "Please enter a unique alphanumeric ID for the web hook.");
		}
		if (!web_hook.title.length) {
			return app.badField('#fe_ewh_title', "Please enter a title for the web hook.");
		}
		if (!web_hook.url.match(/^https?:\/\/\S+$/i)) {
			return app.badField('#fe_ewh_url', "Please enter a fully-qualified URL for the web hook.");
		}
		
		return web_hook;
	}
	
	checkWebHookExists(field) {
		// check if web hook exists, update UI checkbox
		// called after field changes
		var $field = $(field);
		var id = trim( $field.val().toLowerCase() );
		var $elem = $field.closest('.form_row').find('.fr_suffix .checker');
		
		if (id.match(/^\w+$/)) {
			// check with cache
			if (find_object(app.web_hooks, { id: id })) {
				// web_hook taken
				$elem.css('color','red').html('<span class="mdi mdi-web_hook-circle"></span>').attr('title', "Web Hook ID is taken.");
				$field.addClass('warning');
			}
			else {
				// web_hook is valid and available!
				$elem.css('color','green').html('<span class="mdi mdi-check-circle"></span>').attr('title', "Web Hook ID is available!");
				$field.removeClass('warning');
			}
		}
		else if (id.length) {
			// bad id
			$elem.css('color','red').html('<span class="mdi mdi-web_hook-decagram"></span>').attr('title', "Web Hook ID is malformed.");
			$field.addClass('warning');
		}
		else {
			// empty
			$elem.html('').removeAttr('title');
			$field.removeClass('warning');
		}
	}
	
	onDataUpdate(key, data) {
		// refresh list if web_hooks were updated
		if ((key == 'web_hooks') && (this.args.sub == 'list')) this.gosub_list(this.args);
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
