// Admin Page -- Alerts Config

Page.AlertSetup = class AlertSetup extends Page.Base {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'ea';
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
		// show alert list
		app.setWindowTitle( "Alert Setup" );
		app.setHeaderTitle( '<i class="mdi mdi-bell-ring-outline">&nbsp;</i>Alert Setup' );
		
		// this.loading();
		// app.api.post( 'app/get_alerts', copy_object(args), this.receive_alerts.bind(this) );
		
		// use alerts in app cache
		this.receive_alerts({
			code: 0,
			rows: app.alerts,
			list: { length: app.alerts.length }
		});
	}
	
	receive_alerts(resp) {
		// receive all alerts from server, render them sorted
		var html = '';
		
		if (!resp.rows) resp.rows = [];
		this.alerts = resp.rows;
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Alert Title', 'Alert ID', 'Groups', 'Author', 'Created', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Alert Definitions';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var self = this;
		html += this.getBasicGrid( this.alerts, cols, 'alert', function(item, idx) {
			var actions = [];
			actions.push( '<span class="link" onMouseUp="$P().edit_alert('+idx+')"><b>Edit</b></span>' );
			actions.push( '<span class="link danger" onMouseUp="$P().delete_alert('+idx+')"><b>Delete</b></span>' );
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggle_alert_enabled(this,' + idx + ')'
				}) + '</div>',
				'<b>' + self.getNiceAlert(item, true) + '</b>',
				'<span class="mono">' + item.id + '</span>',
				self.getNiceGroupList(item.groups, '', 3),
				self.getNiceUser(item.username, app.isAdmin()),
				'<span title="'+self.getNiceDateTimeText(item.created)+'">'+self.getNiceDate(item.created)+'</span>',
				actions.join(' | ')
			];
			
			if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button secondary" onMouseUp="$P().edit_alert(-1)">Add Alert...</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.setupBoxButtonFloater();
	}
	
	toggle_alert_enabled(elem, idx) {
		// toggle alert checkbox, actually do the enable/disable here, update row
		var self = this;
		var item = this.alerts[idx];
		
		if (config.alt_to_toggle && !app.lastClick.altKey) {
			$(elem).prop('checked', !$(elem).is(':checked'));
			return app.showMessage('warning', "Accidental Click Protection: Please hold the Alt/Opt key to toggle this checkbox.", 8);
		}
		
		item.enabled = !!$(elem).is(':checked');
		
		app.api.post( 'app/update_alert', item, function(resp) {
			if (!self.active) return; // sanity
			
			if (item.enabled) $(elem).closest('tr').removeClass('disabled');
			else $(elem).closest('tr').addClass('disabled');
			
			$(elem).closest('tr').find('div.td_big').html( self.getNiceAlert(item, true) );
		} );
	}
	
	edit_alert(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#AlertSetup?sub=edit&id=' + this.alerts[idx].id );
		else Nav.go( '#AlertSetup?sub=new' );
	}
	
	delete_alert(idx) {
		// delete alert from search results
		this.alert = this.alerts[idx];
		this.show_delete_alert_dialog();
	}
	
	gosub_new(args) {
		// create new alert
		var html = '';
		app.setWindowTitle( "New Alert Definition" );
		
		app.setHeaderNav([
			{ icon: 'bell-ring-outline', loc: '#AlertSetup?sub=list', title: 'Alert Setup' },
			{ icon: 'bell-plus-outline', title: "New Alert Definition" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New Alert Definition';
			html += '<div class="box_subtitle"><a href="#AlertSetup?sub=list">&laquo; Back to Alert List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.alert = {
			"id": "",
			"title": "",
			"expression": "",
			"samples": 1,
			"message": "",
			"groups": [],
			"email": "",
			"web_hook": "",
			"enabled": true
		};
		
		html += this.get_alert_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_alert_edit()">Cancel</div>';
			html += '<div class="button primary" onMouseUp="$P().do_new_alert()"><i class="mdi mdi-floppy">&nbsp;</i>Create Alert</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ea_monitor, #fe_ea_channel, #fe_ea_run_event, #fe_ea_icon, #fe_ea_web_hook') );
		this.updateAddRemoveMe('#fe_ea_email');
		$('#fe_ea_title').focus();
		this.setupBoxButtonFloater();
	}
	
	cancel_alert_edit() {
		// cancel editing alert and return to list
		Nav.go( '#AlertSetup?sub=list' );
	}
	
	do_new_alert(force) {
		// create new alert
		app.clearError();
		var alert = this.get_alert_form_json();
		if (!alert) return; // error
		
		this.alert = alert;
		
		Dialog.showProgress( 1.0, "Creating Alert..." );
		app.api.post( 'app/create_alert', alert, this.new_alert_finish.bind(this) );
	}
	
	new_alert_finish(resp) {
		// new alert created successfully
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('#AlertSetup?sub=list');
		app.showMessage('success', "The new alert was created successfully.");
	}
	
	gosub_edit(args) {
		// edit alert subpage
		this.loading();
		app.api.post( 'app/get_alert', { id: args.id }, this.receive_alert.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_alert(resp) {
		// edit existing alert
		var html = '';
		this.alert = resp.alert;
		
		if (!this.active) return; // sanity
		
		app.setWindowTitle( "Editing Alert \"" + (this.alert.title) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'bell-ring-outline', loc: '#AlertSetup?sub=list', title: 'Alert Setup' },
			{ icon: this.alert.icon || 'bell-outline', title: this.alert.title },
			// { icon: 'file-edit-outline', title: "Edit Alert" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit Alert Details';
			html += '<div class="box_subtitle"><a href="#AlertSetup?sub=list">&laquo; Back to Alert List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_alert_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_alert_edit()">Cancel</div>';
			html += '<div class="button danger" onMouseUp="$P().show_delete_alert_dialog()">Delete Alert...</div>';
			html += '<div class="button primary" onMouseUp="$P().do_save_alert()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		// lock ID for editing
		$('#fe_ea_id').attr('disabled', true);
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ea_monitor, #fe_ea_channel, #fe_ea_run_event, #fe_ea_icon, #fe_ea_web_hook') );
		this.updateAddRemoveMe('#fe_ea_email');
		this.setupBoxButtonFloater();
	}
	
	do_save_alert() {
		// save changes to alert
		app.clearError();
		var alert = this.get_alert_form_json();
		if (!alert) return; // error
		
		this.alert = alert;
		
		Dialog.showProgress( 1.0, "Saving Alert..." );
		app.api.post( 'app/update_alert', alert, this.save_alert_finish.bind(this) );
	}
	
	save_alert_finish(resp) {
		// new alert saved successfully
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go( '#AlertSetup?sub=list' );
		app.showMessage('success', "The alert was saved successfully.");
	}
	
	show_delete_alert_dialog() {
		// show dialog confirming alert delete action
		var self = this;
		
		Dialog.confirmDanger( 'Delete Alert', "Are you sure you want to <b>permanently delete</b> the alert &ldquo;" + this.alert.title + "&rdquo;?  There is no way to undo this action.", 'Delete', function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Alert..." );
				app.api.post( 'app/delete_alert', self.alert, self.delete_alert_finish.bind(self) );
			}
		} );
	}
	
	delete_alert_finish(resp) {
		// finished deleting alert
		var self = this;
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('#AlertSetup?sub=list', 'force');
		app.showMessage('success', "The alert &ldquo;" + this.alert.title + "&rdquo; was deleted successfully.");
	}
	
	get_alert_edit_html() {
		// get html for editing an alert (or creating a new one)
		var html = '';
		var alert = this.alert;
		
		// title
		html += this.getFormRow({
			label: 'Alert Title:',
			content: this.getFormText({
				id: 'fe_ea_title',
				spellcheck: 'false',
				value: alert.title,
				onChange: '$P().suggestIDFromTitle()'
			}),
			caption: 'Enter the title of the alert, for display purposes.'
		});
		
		// alert id
		html += this.getFormRow({
			label: 'Alert ID:',
			content: this.getFormText({
				id: 'fe_ea_id',
				class: 'monospace',
				spellcheck: 'false',
				onChange: '$P().checkAlertExists(this)',
				value: alert.id
			}),
			suffix: '<div class="checker"></div>',
			caption: 'Enter a unique ID for the alert (alphanumerics only).  Once created this cannot be changed.'
		});
		
		// enabled
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_ea_enabled',
				label: 'Alert Enabled',
				checked: alert.enabled
			}),
			caption: 'Check this box to enable all notifications for the alert.'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_ea_icon',
				title: 'Select icon for alert',
				placeholder: 'Select icon for alert...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: alert.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for the alert.'
		});
		
		// groups
		html += this.getFormRow({
			label: 'Server Groups:',
			content: this.getFormMenuMulti({
				id: 'fe_ea_groups',
				title: 'Select Groups',
				placeholder: '(All Groups)',
				options: app.groups,
				values: alert.groups,
				default_icon: 'server-network',
				'data-hold': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select which server group(s) the alert should apply to.'
		});
		
		// expression
		html += this.getFormRow({
			label: 'Expression:',
			content: this.getFormTextarea({
				id: 'fe_ea_expression',
				rows: 5,
				class: 'monospace',
				value: alert.expression
			}),
			caption: 'Enter the expression to evaluate the alert condition, e.g. <code>[monitors/load_avg] >= 5.0</code>.  If you need help, you can use the <span class="link" onMouseUp="$P().showHostDataExplorer(\'#fe_ea_expression\')">Server Data Explorer</span>, or view the <a href="https://github.com/jhuckaby/orchestra/blob/main/docs/Monitoring.md#alert-expressions" target="_blank">documentation</a>.' // TODO: doc link AND ALSO showHostDataExplorer!!!
		});
		
		// samples
		html += this.getFormRow({
			label: 'Samples:',
			content: this.getFormText({
				id: 'fe_ea_samples',
				type: 'number',
				min: '1',
				max: '59',
				placeholder: '1',
				value: alert.samples,
			}),
			caption: 'Enter the number of consecutive samples (minutes) the expression must evaluate to true for the alert to actually trigger.  A value of <code>1</code> triggers immediately, which is the detault.  This also applies to the alert cooldown (number of false evaluations before the alert clears).'
		});
		
		// message
		html += this.getFormRow({
			label: 'Message:',
			content: this.getFormTextarea({
				id: 'fe_ea_message',
				rows: 5,
				class: 'monospace',
				value: alert.message
			}),
			caption: 'Enter the message text to be delivered with the alert notifications.  You can use <a href="https://github.com/jhuckaby/orchestra/blob/main/docs/Monitoring.md#alert-expressions" target="_blank">alert expressions</a> here.' // TODO: doc link
		});
		
		// monitor overlay
		html += this.getFormRow({
			label: 'Overlay:',
			content: this.getFormMenuSingle({
				id: 'fe_ea_monitor',
				title: 'Select Monitor',
				options: [ ['', "(None)"] ].concat(app.monitors),
				value: alert.monitor_id || '',
				default_icon: 'chart-line'
			}),
			caption: 'Optionally select a monitor to overlay alert annotations on.'
		});
		
		// notification channel
		html += this.getFormRow({
			label: 'Notify Channel:',
			content: this.getFormMenuSingle({
				id: 'fe_ea_channel',
				title: 'Select Channel',
				options: [ ['', "(None)"] ].concat(app.channels),
				value: alert.channel_id || '',
				default_icon: 'bullhorn-outline'
			}),
			caption: 'Optionally select a notification channel to fire for this alert.'
		});
		
		// email
		html += this.getFormRow({
			label: 'Email:',
			content: this.getFormText({
				id: 'fe_ea_email',
				// type: 'email',
				spellcheck: 'false',
				placeholder: 'email@sample.com',
				value: alert.email,
				onChange: '$P().updateAddRemoveMe(this)'
			}),
			suffix: '<div class="form_suffix_icon mdi" title="" onMouseUp="$P().addRemoveMe(this)"></div>',
			caption: 'Optionally add e-mail recipients to be notified for this alert.'
		});
		
		// web hook
		html += this.getFormRow({
			label: 'Web Hook:',
			content: this.getFormMenuSingle({
				id: 'fe_ea_web_hook',
				title: 'Select Web Hook',
				options: [ ['', "(None)"] ].concat( app.web_hooks ),
				value: alert.web_hook,
				default_icon: 'webhook'
			}),
			caption: 'Optionally select a Web Hook to fire for this alert.'
		});
		
		// launch event
		html += this.getFormRow({
			label: 'Run Event:',
			content: this.getFormMenuSingle({
				id: 'fe_ea_run_event',
				title: 'Select Event',
				options: [ ['', "(None)"] ].concat(app.events),
				value: alert.run_event,
				default_icon: 'calendar-clock'
			}),
			caption: 'Optionally select an event to run for this alert.'
		});
		
		// limit jobs
		html += this.getFormRow({
			label: 'Job Limit:',
			content: this.getFormCheckbox({
				id: 'fe_ea_limit_jobs',
				label: 'Limit Jobs',
				checked: alert.limit_jobs
			}),
			caption: 'Prevent additional jobs from starting on the server while the alert remains active.'
		});
		
		// abort jobs
		html += this.getFormRow({
			label: 'Job Abort:',
			content: this.getFormCheckbox({
				id: 'fe_ea_abort_jobs',
				label: 'Abort Jobs',
				checked: alert.abort_jobs
			}),
			caption: 'Abort all running jobs on the server when the alert is first triggered.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_ea_notes',
				rows: 5,
				value: alert.notes
			}),
			caption: 'Optionally enter notes for the alert, which will be included in all e-mail notifications.'
		});
		
		return html;
	}
	
	get_alert_form_json() {
		// get api key elements from form, used for new or edit
		var alert = this.alert;
		
		alert.id = $('#fe_ea_id').val().replace(/\W+/g, '').toLowerCase();
		alert.title = $('#fe_ea_title').val().trim();
		alert.enabled = $('#fe_ea_enabled').is(':checked') ? true : false;
		alert.icon = $('#fe_ea_icon').val();
		alert.groups = $('#fe_ea_groups').val();
		alert.expression = $('#fe_ea_expression').val();
		alert.samples = parseInt( $('#fe_ea_samples').val() ) || 1;
		alert.message = $('#fe_ea_message').val();
		alert.monitor_id = $('#fe_ea_monitor').val();
		alert.channel_id = $('#fe_ea_channel').val();
		alert.email = $('#fe_ea_email').val();
		alert.web_hook = $('#fe_ea_web_hook').val();
		alert.run_event = $('#fe_ea_run_event').val();
		alert.limit_jobs = $('#fe_ea_limit_jobs').is(':checked') ? true : false;
		alert.abort_jobs = $('#fe_ea_abort_jobs').is(':checked') ? true : false;
		alert.notes = $('#fe_ea_notes').val();
		
		if (!alert.id.length) {
			return app.badField('#fe_ea_id', "Please enter a unique alphanumeric ID for the alert.");
		}
		if (!alert.title.length) {
			return app.badField('#fe_ea_title', "Please enter a title for the alert.");
		}
		if (!alert.expression.length) {
			return app.badField('#fe_ea_source', "Please enter an expression for the alert.");
		}
		
		return alert;
	}
	
	checkAlertExists(field) {
		// check if alert exists, update UI checkbox
		// called after field changes
		var $field = $(field);
		var id = trim( $field.val().toLowerCase() );
		var $elem = $field.closest('.form_row').find('.fr_suffix .checker');
		
		if (id.match(/^\w+$/)) {
			// check with cache
			if (find_object(app.alerts, { id: id })) {
				// alert taken
				$elem.css('color','red').html('<span class="mdi mdi-alert-circle"></span>').attr('title', "Alert ID is taken.");
				$field.addClass('warning');
			}
			else {
				// alert is valid and available!
				$elem.css('color','green').html('<span class="mdi mdi-check-circle"></span>').attr('title', "Alert ID is available!");
				$field.removeClass('warning');
			}
		}
		else if (id.length) {
			// bad id
			$elem.css('color','red').html('<span class="mdi mdi-alert-decagram"></span>').attr('title', "Alert ID is malformed.");
			$field.addClass('warning');
		}
		else {
			// empty
			$elem.html('').removeAttr('title');
			$field.removeClass('warning');
		}
	}
	
	onDataUpdate(key, data) {
		// refresh list if alerts were updated
		if ((key == 'alerts') && (this.args.sub == 'list')) this.gosub_list(this.args);
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
