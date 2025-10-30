// Admin Page -- Alerts Config

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.AlertSetup = class AlertSetup extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'ea';
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		if (!this.requireAnyPrivilege('create_alerts', 'edit_alerts', 'delete_alerts')) return true;
		
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
		var self = this;
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
		
		var grid_opts = {
			rows: this.alerts,
			cols: cols,
			data_type: 'alert',
			grid_template_columns: 'min-content' + ' auto'.repeat( cols.length - 1 )
		};
		
		html += this.getBasicGrid( grid_opts, function(item, idx) {
			var actions = [];
			if (app.hasPrivilege('edit_alerts')) actions.push( '<span class="link" onClick="$P().edit_alert('+idx+')"><b>Edit</b></span>' );
			if (app.hasPrivilege('delete_alerts')) actions.push( '<span class="link danger" onClick="$P().delete_alert('+idx+')"><b>Delete</b></span>' );
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggle_alert_enabled(this,' + idx + ')'
				}) + '</div>',
				'<b>' + self.getNiceAlert(item, app.hasPrivilege('edit_alerts')) + '</b>',
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
			if (app.hasAnyPrivilege('create_alerts', 'edit_alerts')) html += '<div class="button phone_collapse" onClick="$P().doFileImportPrompt()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i><span>Import File...</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().go_history()"><i class="mdi mdi-history">&nbsp;</i><span>Revision History...</span></div>';
			if (app.hasPrivilege('create_alerts')) html += '<div class="button default" onClick="$P().edit_alert(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i><span>New Alert...</span></div>';
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
			
			if (item.enabled) $(elem).closest('ul').removeClass('disabled');
			else $(elem).closest('ul').addClass('disabled');
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
	
	go_history() {
		Nav.go( '#AlertSetup?sub=history' );
	}
	
	gosub_history(args) {
		// show revision history sub-page
		app.setHeaderNav([
			{ icon: 'bell-ring-outline', loc: '#AlertSetup?sub=list', title: 'Alert Setup' },
			{ icon: 'history', title: "Revision History" }
		]);
		app.setWindowTitle( "Alert Revision History" );
		
		this.goRevisionHistory({
			activityType: 'alerts',
			itemKey: 'alert',
			editPageID: 'AlertSetup',
			itemMenu: {
				label: '<i class="icon mdi mdi-bell-ring-outline">&nbsp;</i>Alert:',
				title: 'Select Alert',
				options: [['', 'Any Alert']].concat( app.alerts ),
				default_icon: 'bell-ring-outline'
			}
		});
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
			"enabled": true,
			"actions": []
		};
		this.actions = this.alert.actions; // for action editor
		
		html += this.get_alert_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button phone_collapse" onClick="$P().cancel_alert_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().do_test_alert()"><i class="mdi mdi-test-tube">&nbsp;</i><span>Test...</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button primary" onClick="$P().do_new_alert()"><i class="mdi mdi-floppy">&nbsp;</i><span>Create Alert</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ea_monitor, #fe_ea_icon') );
		this.updateAddRemoveMe('#fe_ea_email');
		$('#fe_ea_title').focus();
		this.setupBoxButtonFloater();
		this.setupEditor('text/plain');
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
		app.cacheBust = hires_time_now();
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
		if (!this.active) return; // sanity
		
		if (this.args.rollback && this.rollbackData) {
			resp.alert = this.rollbackData;
			delete this.rollbackData;
			app.showMessage('info', `Revision ${resp.alert.revision} has been loaded as a draft edit.  Click 'Save Changes' to complete the rollback.  Note that a new revision number will be assigned.`);
		}
		
		this.alert = resp.alert;
		this.actions = this.alert.actions; // for action editor
		
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
			html += '<div class="button cancel mobile_collapse" onClick="$P().cancel_alert_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Close</span></div>';
			html += '<div class="button danger mobile_collapse" onClick="$P().show_delete_alert_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_test_alert()"><i class="mdi mdi-test-tube">&nbsp;</i><span>Test...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
			html += '<div class="button save phone_collapse" onClick="$P().do_save_alert()"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Changes</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ea_monitor, #fe_ea_icon') );
		this.updateAddRemoveMe('#fe_ea_email');
		this.setupBoxButtonFloater();
		this.setupEditor('text/plain');
		this.setupEditTriggers();
	}
	
	do_export() {
		// show export dialog
		app.clearError();
		var alert = this.get_alert_form_json();
		if (!alert) return; // error
		
		this.showExportOptions({
			name: 'alert',
			dataType: 'alert',
			api: this.args.id ? 'update_alert' : 'create_alert',
			data: alert
		});
	}
	
	go_edit_history() {
		Nav.go( '#AlertSetup?sub=history&id=' + this.alert.id );
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
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		// Nav.go( '#AlertSetup?sub=list' );
		this.triggerSaveComplete();
		app.showMessage('success', "The alert was saved successfully.");
	}
	
	show_delete_alert_dialog() {
		// show dialog confirming alert delete action
		var self = this;
		
		Dialog.confirmDanger( 'Delete Alert', "Are you sure you want to <b>permanently delete</b> the alert &ldquo;" + this.alert.title + "&rdquo;?  There is no way to undo this action.", ['trash-can', 'Delete'], function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Alert..." );
				app.api.post( 'app/delete_alert', self.alert, self.delete_alert_finish.bind(self) );
			}
		} );
	}
	
	delete_alert_finish(resp) {
		// finished deleting alert
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('#AlertSetup?sub=list', 'force');
		app.showMessage('success', "The alert &ldquo;" + this.alert.title + "&rdquo; was deleted successfully.");
	}
	
	get_alert_edit_html() {
		// get html for editing an alert (or creating a new one)
		var html = '';
		var alert = this.alert;
		
		if (alert.id) {
			// alert id
			html += this.getFormRow({
				label: 'Alert ID:',
				content: this.getFormText({
					id: 'fe_ea_id',
					class: 'monospace',
					spellcheck: 'false',
					disabled: 'disabled',
					value: alert.id
				}),
				suffix: this.getFormIDCopier(),
				caption: 'This is a unique ID for the alert, used by the xyOps API.  It cannot be changed.'
			});
		}
		
		// title
		html += this.getFormRow({
			label: 'Alert Title:',
			content: this.getFormText({
				id: 'fe_ea_title',
				spellcheck: 'false',
				autocomplete: 'off',
				value: alert.title
			}),
			caption: 'Enter the title of the alert, for display purposes.'
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
			content: this.getFormText({
				id: 'fe_ea_expression',
				spellcheck: 'false',
				autocomplete: 'off',
				class: 'monospace',
				value: alert.expression
			}),
			suffix: `<div class="form_suffix_icon mdi mdi-database-search-outline" title="${config.ui.tooltips.server_data_explorer}" onClick="$P().openServerDataExplorer(this)"></div>`,
			caption: 'Enter an expression to evaluate the alert condition, e.g. `monitors.load_avg >= 5.0`.  For help, click the search icon to the right to open the Server Data Explorer, or [view the documentation](#Docs/monitoring/alert-expressions).'			
		});
		
		// message
		html += this.getFormRow({
			id: 'd_editor',
			label: 'Message:',
			content: '<div onClick="$P().editor.focus()">' + this.getFormTextarea({
				id: 'fe_editor',
				rows: 5,
				class: 'monospace',
				value: alert.message
			}) + '</div>',
			suffix: `<div class="form_suffix_icon mdi mdi-database-search-outline" title="${config.ui.tooltips.server_data_explorer}" onClick="$P().openServerDataExplorer(this,true)"></div>`,
			caption: 'Enter the message text to be delivered with the alert notifications.  You can use `{{macros}}` to insert dynamic content from the server data.  Click the search icon to the right to open the Server Data Explorer.  [Learn More](#Docs/monitoring/alert-messages).'
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
			caption: 'Abort all running jobs on the server when the alert fires.'
		});
		
		// actions
		// (requires this.actions to be populated)
		html += this.getFormRow({
			label: 'Alert Actions:',
			content: '<div id="d_ea_jobact_table">' + this.getJobActionTable() + '</div>',
			caption: 'Optionally select custom actions to perform when the alert fires and/or clears.'
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
		
		alert.title = $('#fe_ea_title').val().trim();
		alert.enabled = $('#fe_ea_enabled').is(':checked') ? true : false;
		alert.icon = $('#fe_ea_icon').val();
		alert.groups = $('#fe_ea_groups').val();
		alert.expression = $('#fe_ea_expression').val();
		alert.samples = parseInt( $('#fe_ea_samples').val() ) || 1;
		alert.message = this.editor.getValue().trim();
		alert.monitor_id = $('#fe_ea_monitor').val();
		alert.limit_jobs = $('#fe_ea_limit_jobs').is(':checked') ? true : false;
		alert.abort_jobs = $('#fe_ea_abort_jobs').is(':checked') ? true : false;
		alert.notes = $('#fe_ea_notes').val();
		
		if (!alert.title.length) {
			return app.badField('#fe_ea_title', "Please enter a title for the alert.");
		}
		if (!alert.expression.length) {
			return app.badField('#fe_ea_source', "Please enter an expression for the alert.");
		}
		
		return alert;
	}
	
	editJobAction(idx) {
		// show dialog to select actions for alert (overrides base one in PageUtils)
		// action: { condition, type, email?, url? }
		var self = this;
		var action = (idx > -1) ? this.actions[idx] : { condition: 'alert_new', type: 'email', email: '', enabled: true };
		var title = (idx > -1) ? "Editing Alert Action" : "New Alert Action";
		var btn = (idx > -1) ? ['check-circle', "Accept"] : ['plus-circle', "Add Action"];
		
		this.showEditJobActionDialog({
			action: action,
			title: title,
			btn: btn,
			show_condition: true,
			conditions: config.ui.alert_action_condition_menu,
			
			action_type_filter: function(item) { 
				// filter out unsupported actions for alerts
				return !item.id.match(/^(disable|delete|store|fetch|suspend)$/); 
			},
			
			callback: function(action) {
				// see if we need to add or replace
				if (idx == -1) {
					self.actions.push(action);
				}
				else self.actions[idx] = action;
				
				// keep list sorted by condition reverse (so alert_new comes first)
				sort_by(self.actions, 'condition', { dir: -1 });
				
				self.renderJobActionEditor();
				self.triggerEditChange();
			}
		});
	}
	
	do_test_alert() {
		// open dialog for testing alert on select server
		var self = this;
		var title = "Test Alert";
		var html = '';
		
		app.clearError();
		var alert = this.get_alert_form_json();
		if (!alert) return; // error
		
		var servers = this.getCategorizedServers(true);
		if (!servers.length) return app.doError(config.ui.errors.sde_no_servers);
		
		html += `<div class="dialog_intro">Test your alert expression against live server data, to see if it will trigger on the current values.</div>`;
		html += '<div class="dialog_box_content scroll maximize">';
		
		// server picker
		html += this.getFormRow({
			id: 'd_ex_server',
			content: this.getFormMenuSingle({
				id: 'fe_ex_server',
				options: servers,
				value: '',
				default_icon: 'router-network'
			})
		});
		
		// result
		html += this.getFormRow({
			id: 'd_ead_result',
			label: 'Test Result:',
			content: `<div id="d_ead_form_result" class="form_result">...</div>`,
			caption: 'Your alert trigger result will appear above.'
		});
		
		// message
		html += this.getFormRow({
			id: 'd_ead_message',
			label: 'Alert Message:',
			content: `<div id="d_ead_form_message" class="form_result">...</div>`,
			caption: 'Preview the computed alert message text above.'
		});
		
		html += '</div>'; // dialog_box_content
		
		var buttons_html = "";
		buttons_html += `<div id="btn_ead_retry" class="button"><i class="mdi mdi-refresh">&nbsp;</i>${config.ui.buttons.retry}</div>`;
		buttons_html += `<div class="button primary" onClick="Dialog.hide()"><i class="mdi mdi-close-circle-outline">&nbsp;</i>${config.ui.buttons.close}</div>`;
		
		Dialog.showSimpleDialog(title, html, buttons_html);
		
		SingleSelect.init('#fe_ex_server');
		
		$('#fe_ex_server').on('change', function() {
			var id = $(this).val();
			if (!id) return; // sanity
			
			$('#d_ead_form_result').removeClass().addClass('form_result').html('...');
			$('#d_ead_form_message').html('...');
			app.clearError();
			
			// now test alert
			app.api.post( 'app/test_alert', { ...alert, server: id }, function(resp) {
				if (resp.result) {
					var value = '<i class="mdi mdi-bell-ring-outline"></i><b>Alert triggered!</b>';
					$('#d_ead_form_result').addClass('triggered').html(value);
					
					// apply flash effect
					if (!$('#d_ead_form_result').hasClass('rflash')) {
						$('#d_ead_form_result').addClass('rflash');
						setTimeout( function() { $('#d_ead_form_result').removeClass('rflash'); }, 1500 );
					}
				}
				else {
					$('#d_ead_form_result').addClass('fail').html( `<i class="mdi mdi-bell-off-outline"></i>Alert did not trigger.` );
					
					// apply flash effect
					if (!$('#d_ead_form_result').hasClass('iflash')) {
						$('#d_ead_form_result').addClass('iflash');
						setTimeout( function() { $('#d_ead_form_result').removeClass('iflash'); }, 1500 );
					}
				}
				$('#d_ead_form_message').html( encode_entities(resp.message) );
				
				
			} ); // api.get
		}); // on change
		
		$('#btn_ead_retry').on('click', function() {
			// retry the op
			$('#d_ead_form_result').html('...');
			$('#fe_ex_server').trigger('change');
		});
		
		// trigger change to load first server
		$('#fe_ex_server').trigger('change');
	}
	
	onDataUpdate(key, data) {
		// refresh list if alerts were updated
		if ((key == 'alerts') && (this.args.sub == 'list')) this.gosub_list(this.args);
	}
	
	onResize() {
		// resize codemirror to match
		this.handleEditorResize();
	}
	
	onThemeChange(theme) {
		// change codemirror theme too
		this.handleEditorThemeChange(theme);
	}
	
	onDeactivate() {
		// called when page is deactivated
		delete this.alert;
		delete this.actions;
		
		this.killEditor();
		this.cleanupRevHistory();
		this.div.html( '' );
		return true;
	}
	
};
