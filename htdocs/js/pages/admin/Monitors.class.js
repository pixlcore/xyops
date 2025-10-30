// Admin Page -- Monitors Config

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Monitors = class Monitors extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'em';
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		if (!this.requireAnyPrivilege('create_monitors', 'edit_monitors', 'delete_monitors')) return true;
		
		if (!args) args = {};
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show monitor list
		app.setWindowTitle( "Monitors" );
		app.setHeaderTitle( '<i class="mdi mdi-chart-areaspline">&nbsp;</i>Monitors' );
		
		// this.loading();
		// app.api.post( 'app/get_monitors', copy_object(args), this.receive_monitors.bind(this) );
		
		// kill drag operation if in progress (i.e. from onDataUpdate)
		this.cancelGridDrag( this.div.find('div.data_grid') );
		
		// use monitors in app cache
		this.receive_monitors({
			code: 0,
			rows: app.monitors,
			list: { length: app.monitors.length }
		});
	}
	
	receive_monitors(resp) {
		// receive all monitors from server, render them sorted
		var self = this;
		var html = '';
		
		if (!resp.rows) resp.rows = [];
		this.monitors = resp.rows;
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['<i class="mdi mdi-menu"></i>', 'Monitor Title', 'Monitor ID', 'Groups', 'Author', 'Created', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Monitors';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var grid_opts = {
			rows: this.monitors,
			cols: cols,
			data_type: 'monitor',
			grid_template_columns: 'min-content' + ' auto'.repeat( cols.length - 1 )
		};
		
		html += this.getBasicGrid( grid_opts, function(item, idx) {
			var actions = [];
			if (app.hasPrivilege('edit_monitors')) actions.push( '<span class="link" onClick="$P().edit_monitor('+idx+')"><b>Edit</b></span>' );
			if (app.hasPrivilege('delete_monitors')) actions.push( '<span class="link danger" onClick="$P().delete_monitor('+idx+')"><b>Delete</b></span>' );
			
			var tds = [
				'<div class="td_drag_handle" draggable="true" title="Drag to reorder"><i class="mdi mdi-menu"></i></div>',
				'<b>' + self.getNiceMonitor(item, app.hasPrivilege('edit_monitors')) + '</b>',
				'<span class="mono">' + item.id + '</span>',
				self.getNiceGroupList(item.groups, '', 3),
				self.getNiceUser(item.username, app.isAdmin()),
				'<span title="'+self.getNiceDateTimeText(item.created)+'">'+self.getNiceDate(item.created)+'</span>',
				actions.join(' | ')
			];
			
			if (!item.display) tds.className = 'disabled';
			return tds;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			if (app.hasAnyPrivilege('create_monitors', 'edit_monitors')) html += '<div class="button phone_collapse" onClick="$P().doFileImportPrompt()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i><span>Import File...</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().go_history()"><i class="mdi mdi-history">&nbsp;</i><span>Revision History...</span></div>';
			if (app.hasPrivilege('create_monitors')) html += '<div class="button default" onClick="$P().edit_monitor(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i><span>New Monitor...</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.setupBoxButtonFloater();
		
		this.setupDraggableGrid({
			table_sel: this.div.find('div.data_grid'), 
			handle_sel: 'div.td_drag_handle', 
			drag_ghost_sel: 'div:nth-child(2)', 
			drag_ghost_x: 5, 
			drag_ghost_y: 10, 
			callback: this.monitor_move.bind(this)
		});
	}
	
	monitor_move($rows) {
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
		app.api.post( 'app/multi_update_monitor', data, function(resp) {
			// done
		} );
	}
	
	edit_monitor(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Monitors?sub=edit&id=' + this.monitors[idx].id );
		else Nav.go( '#Monitors?sub=new' );
	}
	
	delete_monitor(idx) {
		// delete monitor from search results
		this.monitor = this.monitors[idx];
		this.show_delete_monitor_dialog();
	}
	
	go_history() {
		Nav.go( '#Monitors?sub=history' );
	}
	
	gosub_history(args) {
		// show revision history sub-page
		app.setHeaderNav([
			{ icon: 'chart-areaspline', loc: '#Monitors?sub=list', title: 'Monitors' },
			{ icon: 'history', title: "Revision History" }
		]);
		app.setWindowTitle( "Monitor Revision History" );
		
		this.goRevisionHistory({
			activityType: 'monitors',
			itemKey: 'monitor',
			editPageID: 'Monitors',
			itemMenu: {
				label: '<i class="icon mdi mdi-chart-areaspline">&nbsp;</i>Monitor:',
				title: 'Select Monitor',
				options: [['', 'Any Monitor']].concat( app.monitors ),
				default_icon: 'chart-line'
			}
		});
	}
	
	gosub_new(args) {
		// create new monitor
		var html = '';
		app.setWindowTitle( "New Monitor" );
		
		app.setHeaderNav([
			{ icon: 'chart-areaspline', loc: '#Monitors?sub=list', title: 'Monitors' },
			{ icon: 'chart-line', title: "New Monitor" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New Monitor';
			html += '<div class="box_subtitle"><a href="#Monitors?sub=list">&laquo; Back to Monitor List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.monitor = {
			"id": "",
			"title": "",
			"source": "",
			"data_type": "float",
			"suffix": "",
			"groups": [],
			"display": true,
			"min_vert_scale": 0
		};
		
		html += this.get_monitor_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button phone_collapse" onClick="$P().cancel_monitor_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().do_test_monitor()"><i class="mdi mdi-test-tube">&nbsp;</i><span>Test...</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button primary" onClick="$P().do_new_monitor()"><i class="mdi mdi-floppy">&nbsp;</i><span>Create Monitor</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_em_icon, #fe_em_data_type') );
		MultiSelect.init( this.div.find('select[multiple]') );
		$('#fe_em_title').focus();
		this.setupBoxButtonFloater();
	}
	
	cancel_monitor_edit() {
		// cancel editing monitor and return to list
		Nav.go( '#Monitors?sub=list' );
	}
	
	do_new_monitor(force) {
		// create new monitor
		app.clearError();
		var monitor = this.get_monitor_form_json();
		if (!monitor) return; // error
		
		this.monitor = monitor;
		
		Dialog.showProgress( 1.0, "Creating Monitor..." );
		app.api.post( 'app/create_monitor', monitor, this.new_monitor_finish.bind(this) );
	}
	
	new_monitor_finish(resp) {
		// new monitor created successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Monitors?sub=list');
		app.showMessage('success', "The new monitor was created successfully.");
	}
	
	gosub_edit(args) {
		// edit monitor subpage
		this.loading();
		app.api.post( 'app/get_monitor', { id: args.id }, this.receive_monitor.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_monitor(resp) {
		// edit existing monitor
		var html = '';
		
		if (this.args.rollback && this.rollbackData) {
			resp.monitor = this.rollbackData;
			delete this.rollbackData;
			app.showMessage('info', `Revision ${resp.monitor.revision} has been loaded as a draft edit.  Click 'Save Changes' to complete the rollback.  Note that a new revision number will be assigned.`);
		}
		
		this.monitor = resp.monitor;
		if (!this.active) return; // sanity
		
		app.setWindowTitle( "Editing Monitor \"" + (this.monitor.title) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'chart-areaspline', loc: '#Monitors?sub=list', title: 'Monitors' },
			{ icon: this.monitor.icon || 'chart-line', title: this.monitor.title }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit Monitor Details';
			html += '<div class="box_subtitle"><a href="#Monitors?sub=list">&laquo; Back to Monitor List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_monitor_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button cancel mobile_collapse" onClick="$P().cancel_monitor_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Close</span></div>';
			html += '<div class="button danger mobile_collapse" onClick="$P().show_delete_monitor_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_test_monitor()"><i class="mdi mdi-test-tube">&nbsp;</i><span>Test...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
			html += '<div class="button save phone_collapse" onClick="$P().do_save_monitor()"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Changes</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_em_icon, #fe_em_data_type') );
		MultiSelect.init( this.div.find('select[multiple]') );
		this.setupBoxButtonFloater();
		this.setupEditTriggers();
	}
	
	do_export() {
		// show export dialog
		app.clearError();
		var monitor = this.get_monitor_form_json();
		if (!monitor) return; // error
		
		this.showExportOptions({
			name: 'monitor',
			dataType: 'monitor',
			api: this.args.id ? 'update_monitor' : 'create_monitor',
			data: monitor
		});
	}
	
	go_edit_history() {
		Nav.go( '#Monitors?sub=history&id=' + this.monitor.id );
	}
	
	do_save_monitor() {
		// save changes to monitor
		app.clearError();
		var monitor = this.get_monitor_form_json();
		if (!monitor) return; // error
		
		this.monitor = monitor;
		
		Dialog.showProgress( 1.0, "Saving Monitor..." );
		app.api.post( 'app/update_monitor', monitor, this.save_monitor_finish.bind(this) );
	}
	
	save_monitor_finish(resp) {
		// new monitor saved successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		// Nav.go( 'Monitors?sub=list' );
		this.triggerSaveComplete();
		app.showMessage('success', "The monitor was saved successfully.");
	}
	
	show_delete_monitor_dialog() {
		// show dialog confirming monitor delete action
		var self = this;
		
		Dialog.confirmDanger( 'Delete Monitor', "Are you sure you want to <b>permanently delete</b> the monitor &ldquo;" + this.monitor.title + "&rdquo;?  There is no way to undo this action.", ['trash-can', 'Delete'], function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Monitor..." );
				app.api.post( 'app/delete_monitor', self.monitor, self.delete_monitor_finish.bind(self) );
			}
		} );
	}
	
	delete_monitor_finish(resp) {
		// finished deleting monitor
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Monitors?sub=list', 'force');
		app.showMessage('success', "The monitor &ldquo;" + this.monitor.title + "&rdquo; was deleted successfully.");
	}
	
	get_monitor_edit_html() {
		// get html for editing an monitor (or creating a new one)
		var html = '';
		var monitor = this.monitor;
		
		if (monitor.id) {
			// monitor id
			html += this.getFormRow({
				label: 'Monitor ID:',
				content: this.getFormText({
					id: 'fe_em_id',
					class: 'monospace',
					spellcheck: 'false',
					disabled: 'disabled',
					value: monitor.id
				}),
				suffix: this.getFormIDCopier(),
				caption: 'This is a unique ID for the monitor, used by the xyOps API.  It cannot be changed.'
			});
		}
		
		// title
		html += this.getFormRow({
			label: 'Monitor Title:',
			content: this.getFormText({
				id: 'fe_em_title',
				spellcheck: 'false',
				value: monitor.title
			}),
			caption: 'Enter the title of the monitor, for display purposes.'
		});
		
		// status
		html += this.getFormRow({
			label: 'Display:',
			content: this.getFormCheckbox({
				id: 'fe_em_display',
				label: 'Show Monitor Graphs',
				checked: monitor.display
			}),
			caption: 'Select whether this monitor should display a visible graph or not.'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_em_icon',
				title: 'Select icon for monitor',
				placeholder: 'Select icon for monitor...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: monitor.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for the monitor.'
		});
		
		// groups
		html += this.getFormRow({
			label: 'Server Groups:',
			content: this.getFormMenuMulti({
				id: 'fe_em_groups',
				title: 'Select groups for the monitor',
				placeholder: '(All Groups)',
				options: app.groups,
				values: monitor.groups,
				default_icon: 'server-network',
				'data-hold': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select which server group(s) the monitor should apply to.'
		});
		
		// data source
		html += this.getFormRow({
			label: 'Data Expression:',
			content: this.getFormText({
				id: 'fe_em_source',
				class: 'monospace',
				spellcheck: 'false',
				value: monitor.source
			}),
			suffix: `<div class="form_suffix_icon mdi mdi-database-search-outline" title="${config.ui.tooltips.server_data_explorer}" onClick="$P().openServerDataExplorer(this)"></div>`,
			caption: 'Enter an expression for evaluating the data source using dot path notation (e.g. `stats.network.conns`).  For help, click the search icon above to open the Server Data Explorer, or [view the documentation](#Docs/monitoring/expressions).'
		});
		
		// data match
		html += this.getFormRow({
			label: 'Data Match:',
			content: this.getFormText({
				id: 'fe_em_data_match',
				class: 'monospace',
				spellcheck: 'false',
				value: monitor.data_match
			}),
			caption: 'Optionally enter a regular expression to grab the desired data value out of a string.  Surround the match with parenthesis to isolate it.  This is mainly for custom commands.  [Learn More](#Docs/monitoring/data-match)'
		});
		
		// data type
		var type_items = [
			['integer', "Integer"],
			['float', "Float"],
			['bytes', "Bytes"],
			['seconds', "Seconds"],
			['milliseconds', "Milliseconds"]
			// ['percent', "Percent"]
		];
		html += this.getFormRow({
			label: 'Data Type:',
			content: this.getFormMenuSingle({
				id: 'fe_em_data_type',
				title: 'Select Data Type',
				options: type_items,
				value: monitor.data_type
			}),
			caption: 'Select the data type for the monitor, which controls how the value is read and displayed.'
		});
		
		// delta features
		var feats = [];
		if (monitor.delta) {
			feats.push('delta');
			if (monitor.delta_min_value === 0) feats.push('delta_min');
			if (monitor.divide_by_delta) feats.push('delta_div');
		}
		
		html += this.getFormRow({
			label: 'Delta Features:',
			content: this.getFormMenuMulti({
				id: 'fe_em_delta',
				title: 'Select delta features',
				placeholder: '(None)',
				options: [
					{ id: 'delta', icon: 'finance', title: "Calc as Delta" },
					{ id: 'delta_div', icon: 'av-timer', title: "Divide by Time" },
					{ id: 'delta_min', icon: 'altimeter', title: "Zero Minimum" }
				],
				values: feats,
				default_icon: 'delta',
				'data-hold': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally interpret the data value as a delta, and optionally divided by time.  This is mainly for measuring values that continually count upwards, and you want to graph the difference over time, instead of the absolute value.'
		});
		
		// min_vert_scale
		html += this.getFormRow({
			label: 'Min Vert Range:',
			content: this.getFormText({
				id: 'fe_em_min_vert_scale',
				type: 'number',
				spellcheck: 'false',
				maxlength: 32,
				min: 0,
				step: 0.1,
				value: monitor.min_vert_scale || 0
			}),
			caption: 'Optionally limit the vertical range of the monitor graph to the specified minimum value.  For example, a CPU % monitor may benefit from having a minimum range of <code>100</code>.  When set to <code>0</code>, the graph will automatically zoom to fit the current visible range.'
		});
		
		// suffix
		html += this.getFormRow({
			label: 'Data Suffix:',
			content: this.getFormText({
				id: 'fe_em_suffix',
				spellcheck: 'false',
				value: monitor.suffix
			}),
			caption: 'Optionally enter a suffix to be displayed after the data value, e.g. <code>/sec</code>.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_em_notes',
				rows: 5,
				value: monitor.notes
			}),
			caption: 'Optionally enter any notes for the monitor, for your own use.'
		});
		
		return html;
	}
	
	get_monitor_form_json() {
		// get api key elements from form, used for new or edit
		var monitor = this.monitor;
		
		monitor.title = $('#fe_em_title').val().trim();
		monitor.display = $('#fe_em_display').is(':checked') ? true : false;
		monitor.icon = $('#fe_em_icon').val();
		monitor.groups = $('#fe_em_groups').val();
		monitor.source = $('#fe_em_source').val();
		monitor.data_match = $('#fe_em_data_match').val();
		monitor.data_type = $('#fe_em_data_type').val();
		monitor.min_vert_scale = parseFloat( $('#fe_em_min_vert_scale').val() );
		monitor.suffix = $('#fe_em_suffix').val();
		monitor.notes = $('#fe_em_notes').val();
		
		// min_vert_scale should be 1+ for integers, if not set
		if ((monitor.min_vert_scale < 1) && (monitor.data_type == 'integer')) monitor.min_vert_scale = 1;
		
		var feats = $('#fe_em_delta').val();
		monitor.delta = false;
		monitor.delta_min_value = false;
		monitor.divide_by_delta = false;
		
		if (feats.length) {
			if (feats.includes('delta')) monitor.delta = true;
			if (feats.includes('delta_min')) monitor.delta_min_value = 0;
			if (feats.includes('delta_div')) monitor.divide_by_delta = true;
		}
		
		if (monitor.data_match) {
			// test regexp, as it was entered by a user
			try { new RegExp(monitor.data_match); }
			catch(err) {
				return app.badField('fe_em_data_match', "Invalid regular expression: " + err);
			}
		}
		
		if (!monitor.title.length) {
			return app.badField('#fe_em_title', "Please enter a title for the monitor.");
		}
		if (!monitor.source.length) {
			return app.badField('#fe_em_source', "Please enter a data source for the monitor.");
		}
		
		return monitor;
	}
	
	do_test_monitor() {
		// open dialog for testing monitor on select server
		var self = this;
		var title = "Test Monitor";
		var html = '';
		
		app.clearError();
		var monitor = this.get_monitor_form_json();
		if (!monitor) return; // error
		
		var servers = this.getCategorizedServers(true);
		if (!servers.length) return app.doError(config.ui.errors.sde_no_servers);
		
		html += `<div class="dialog_intro">Evaluate your monitor's data source expression against your own live server data, to see what the computed result comes out as.</div>`;
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
			id: 'd_emd_result',
			label: monitor.title + ':',
			content: `<div id="d_emd_form_result" class="form_result">...</div>`,
			caption: 'Your monitor result will appear above.'
		});
		
		html += '</div>'; // dialog_box_content
		
		var buttons_html = "";
		buttons_html += `<div id="btn_emd_retry" class="button"><i class="mdi mdi-refresh">&nbsp;</i>${config.ui.buttons.retry}</div>`;
		buttons_html += `<div class="button primary" onClick="Dialog.hide()"><i class="mdi mdi-close-circle-outline">&nbsp;</i>${config.ui.buttons.close}</div>`;
		
		Dialog.showSimpleDialog(title, html, buttons_html);
		
		SingleSelect.init('#fe_ex_server');
		
		$('#fe_ex_server').on('change', function() {
			var id = $(this).val();
			if (!id) return; // sanity
			
			$('#d_emd_form_result').removeClass().addClass('form_result').html('...');
			app.clearError();
			
			// now test monitor
			app.api.post( 'app/test_monitor', { ...monitor, server: id }, function(resp) {
				if (resp.fail) {
					$('#d_emd_form_result').addClass('invalid').html( `<i class="mdi mdi-alert-decagram-outline"></i><b>No Value</b>` );
					return;
				}
				
				var value = '<i class="mdi mdi-check-circle-outline"></i><b>' + resp.value + '</b>';
				if (monitor.data_type == 'bytes') value += ' (' + get_text_from_bytes(resp.value) + ')';
				$('#d_emd_form_result').addClass('success').html(value);
				
				// apply flash effect
				if (!$('#d_emd_form_result').hasClass('iflash')) {
					$('#d_emd_form_result').addClass('iflash');
					setTimeout( function() { $('#d_emd_form_result').removeClass('iflash'); }, 1500 );
				}
			} ); // api.get
		}); // on change
		
		$('#btn_emd_retry').on('click', function() {
			// retry the op
			$('#d_emd_form_result').html('...');
			$('#fe_ex_server').trigger('change');
		});
		
		// trigger change to load first server
		$('#fe_ex_server').trigger('change');
	}
	
	onDataUpdate(key, data) {
		// refresh list if monitors were updated
		if ((key == 'monitors') && (this.args.sub == 'list')) this.gosub_list(this.args);
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.cleanupRevHistory();
		this.div.html( '' );
		return true;
	}
	
};
