// Admin Page -- Plugins Config

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Plugins = class Plugins extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'ep';
		this.controlTypes = ['checkbox', 'code', 'json', 'hidden', 'select', 'bucket', 'text', 'textarea', 'toolset'];
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		if (!this.requireAnyPrivilege('create_plugins', 'edit_plugins', 'delete_plugins')) return true;
		
		if (!args) args = {};
		if (!args.sub && args.id) args.sub = 'edit';
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show plugin list
		app.setWindowTitle( "Plugins" );
		app.setHeaderTitle( '<i class="mdi mdi-power-plug">&nbsp;</i>Plugins' );
		
		// this.loading();
		// app.api.post( 'app/get_plugins', copy_object(args), this.receive_plugins.bind(this) );
		
		// use plugins in app cache
		this.receive_plugins({
			code: 0,
			rows: app.plugins,
			list: { length: app.plugins.length }
		});
	}
	
	receive_plugins(resp) {
		// receive all plugins from server, render them sorted
		var self = this;
		var html = '';
		
		if (!resp.rows) resp.rows = [];
		this.plugins = resp.rows;
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Plugin Title', 'Plugin ID', 'Type', 'Source', 'Created', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Plugins';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var grid_opts = {
			rows: this.plugins,
			cols: cols,
			data_type: 'plugin',
			grid_template_columns: 'min-content' + ' auto'.repeat( cols.length - 1 )
		};
		
		html += this.getBasicGrid( grid_opts, function(item, idx) {
			var actions = [];
			if (app.hasPrivilege('edit_plugins')) actions.push( '<button class="link" onClick="$P().edit_plugin('+idx+')"><b>Edit</b></button>' );
			if (app.hasPrivilege('delete_plugins')) actions.push( '<button class="link danger" onClick="$P().delete_plugin('+idx+')"><b>Delete</b></button>' );
			
			var plugin_events = find_objects( app.events, { plugin: item.id } );
			var num_events = plugin_events.length;
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggle_plugin_enabled(this,' + idx + ')'
				}) + '</div>',
				'<b>' + self.getNicePlugin(item, app.hasPrivilege('edit_plugins')) + '</b>',
				'<span class="mono">' + item.id + '</span>',
				self.getNicePluginType(item.type),
				// commify( num_events ),
				self.getNicePluginSource(item),
				// self.getNiceUser(item.username, app.isAdmin()),
				'<span title="'+self.getNiceDateTimeText(item.created)+'">'+self.getNiceDate(item.created)+'</span>',
				actions.join(' | ') || '&nbsp;'
			];
			
			if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			if (app.hasAnyPrivilege('create_plugins', 'edit_plugins')) html += '<div class="button phone_collapse" onClick="$P().doFileImportPrompt()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i><span>Import File...</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().go_history()"><i class="mdi mdi-history">&nbsp;</i><span>Revision History...</span></div>';
			if (app.hasPrivilege('create_plugins')) html += '<div class="button default" id="btn_new" onClick="$P().edit_plugin(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i><span>New Plugin...</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html ).buttonize();
		this.setupBoxButtonFloater();
		this.addPageDescription();
	}
	
	getNicePluginSource(plugin) {
		// marketplace, stock, or user
		if (plugin.marketplace) return '<span class="nowrap"><i class="mdi mdi-cart-outline"></i>Marketplace</span>';
		else if (plugin.stock) return '<span class="nowrap"><i class="mdi mdi-rocket-launch-outline"></i>xyOps Default</span>';
		else return this.getNiceUser(plugin.username, app.isAdmin());
	}
	
	toggle_plugin_enabled(elem, idx) {
		// toggle plugin checkbox, actually do the enable/disable here, update row
		var self = this;
		var item = this.plugins[idx];
		
		if (config.alt_to_toggle && !app.lastClick.altKey) {
			$(elem).prop('checked', !$(elem).is(':checked'));
			return app.showMessage('warning', "Accidental Click Protection: Please hold the Alt/Opt key to toggle this checkbox.", 8);
		}
		
		item.enabled = !!$(elem).is(':checked');
		
		app.api.post( 'app/update_plugin', item, function(resp) {
			if (!self.active) return; // sanity
			
			if (item.enabled) $(elem).closest('ul').removeClass('disabled');
			else $(elem).closest('ul').addClass('disabled');
		} );
	}
	
	edit_plugin(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Plugins?sub=edit&id=' + this.plugins[idx].id );
		else Nav.go( '#Plugins?sub=new' );
	}
	
	delete_plugin(idx) {
		// delete plugin from search results
		this.plugin = this.plugins[idx];
		this.show_delete_plugin_dialog();
	}
	
	go_history() {
		Nav.go( '#Plugins?sub=history' );
	}
	
	gosub_history(args) {
		// show revision history sub-page
		app.setHeaderNav([
			{ icon: 'power-plug', loc: '#Plugins?sub=list', title: 'Plugins' },
			{ icon: 'history', title: "Revision History" }
		]);
		app.setWindowTitle( "Plugin Revision History" );
		
		this.goRevisionHistory({
			activityType: 'plugins',
			itemKey: 'plugin',
			editPageID: 'Plugins',
			itemMenu: {
				label: '<i class="icon mdi mdi-power-plug">&nbsp;</i>Plugin:',
				title: 'Select Plugin',
				options: [['', 'Any Plugin']].concat( app.plugins ),
				default_icon: 'power-plug-outline'
			}
		});
	}
	
	gosub_new(args) {
		// create new plugin
		var html = '';
		app.setWindowTitle( "New Plugin" );
		
		app.setHeaderNav([
			{ icon: 'power-plug', loc: '#Plugins?sub=list', title: 'Plugins' },
			{ icon: 'power-plug-outline', title: "New Plugin" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New Plugin';
			html += '<div class="box_subtitle"><a href="#Plugins?sub=list">&laquo; Back to Plugin List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		if (this.clone) {
			this.plugin = this.clone;
			delete this.clone;
			app.showMessage('info', "The plugin has been cloned as an unsaved draft.", 8);
		}
		else {
			this.plugin = {
				"id": "",
				"title": "",
				"enabled": true,
				"type": "event",
				"command": "",
				"script": "",
				"groups": [],
				"format": "text",
				"params": [],
				"kill": "parent",
				"runner": false,
				"notes": ""
			};
		}
		this.params = this.plugin.params;
		
		html += this.get_plugin_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button phone_collapse" onClick="$P().cancel_plugin_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button primary" id="btn_save" onClick="$P().do_new_plugin()"><i class="mdi mdi-floppy">&nbsp;</i><span>Create Plugin</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html ).buttonize();
		
		SingleSelect.init( this.div.find('#fe_ep_icon, #fe_ep_type, #fe_ep_format, #fe_ep_kill') );
		MultiSelect.init( this.div.find('select[multiple]') );
		// this.updateAddRemoveMe('#fe_ep_email');
		$('#fe_ep_title').focus();
		this.setPluginType();
		this.renderParamEditor();
		this.setupBoxButtonFloater();
	}
	
	cancel_plugin_edit() {
		// cancel editing plugin and return to list
		Nav.go( '#Plugins?sub=list' );
	}
	
	do_new_plugin(force) {
		// create new plugin
		app.clearError();
		var plugin = this.get_plugin_form_json();
		if (!plugin) return; // error
		
		this.plugin = plugin;
		
		Dialog.showProgress( 1.0, "Creating Plugin..." );
		app.api.post( 'app/create_plugin', plugin, this.new_plugin_finish.bind(this) );
	}
	
	new_plugin_finish(resp) {
		// new plugin created successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Plugins?sub=list');
		app.showMessage('success', "The new plugin was created successfully.");
	}
	
	gosub_edit(args) {
		// edit plugin subpage
		this.loading();
		app.api.post( 'app/get_plugin', { id: args.id }, this.receive_plugin.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_plugin(resp) {
		// edit existing plugin
		var html = '';
		if (!this.active) return; // sanity
		
		if (this.args.rollback && this.rollbackData) {
			resp.plugin = this.rollbackData;
			delete this.rollbackData;
			app.showMessage('info', `Revision ${resp.plugin.revision} has been loaded as a draft edit.  Click 'Save Changes' to complete the rollback.  Note that a new revision number will be assigned.`);
		}
		
		this.plugin = resp.plugin;
		if (!this.plugin.params) this.plugin.params = [];
		this.params = this.plugin.params;
		
		app.setWindowTitle( "Editing Plugin \"" + (this.plugin.title) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'power-plug', loc: '#Plugins?sub=list', title: 'Plugins' },
			{ icon: this.plugin.icon || 'power-plug-outline', title: this.plugin.title }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit Plugin Details';
			html += '<div class="box_subtitle"><a href="#Plugins?sub=list">&laquo; Back to Plugin List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_plugin_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button cancel mobile_collapse" onClick="$P().cancel_plugin_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Close</span></div>';
			html += '<div class="button danger mobile_collapse" onClick="$P().show_delete_plugin_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_clone()"><i class="mdi mdi-content-copy">&nbsp;</i><span>Clone...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_test()"><i class="mdi mdi-test-tube">&nbsp;</i><span>Test...</span></div>';
			html += '<div class="button secondary mobile_collapse mobile_hide" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button secondary mobile_collapse mobile_hide" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
			html += '<div class="button save phone_collapse" id="btn_save" onClick="$P().do_save_plugin()"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Changes</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html ).buttonize();
		
		SingleSelect.init( this.div.find('#fe_ep_icon, #fe_ep_type, #fe_ep_format, #fe_ep_kill') );
		MultiSelect.init( this.div.find('select[multiple]') );
		// this.updateAddRemoveMe('#fe_ep_email');
		this.setPluginType();
		this.renderParamEditor();
		this.setupBoxButtonFloater();
		this.setupEditTriggers();
	}
	
	do_test() {
		// test plugin
		if (this.div.find('.button.save').hasClass('primary')) return app.doError("Please save or revert your changes before testing.");
		
		app.clearError();
		var plugin = this.get_plugin_form_json();
		if (!plugin) return; // error
		
		switch (plugin.type) {
			case 'event': this.do_test_event_plugin(plugin); break;
			case 'action': this.do_test_action_plugin(plugin); break;
			case 'monitor': this.do_test_monitor_plugin(plugin); break;
			case 'scheduler': this.do_test_trigger_plugin(plugin); break;
		}
	}
	
	do_test_event_plugin(plugin) {
		// test event plugin
		var self = this;
		var title = "Test Event Plugin";
		var btn = ['open-in-new', 'Test Plugin'];
		
		// privilege check
		if (!app.requirePrivilege('create_events')) return;
		if (!app.requirePrivilege('run_jobs')) return;
		
		if (!app.categories.length) return app.doError("No categories found.  Please add a category before testing event plugins.");
		var cat_def = find_object( app.categories, { id: 'general' } ) || app.categories[0];
		
		var html = '';
		html += `<div class="dialog_intro">Use this form to test the current event plugin.  This is done by creating a temporary self-deleting event, which immediately runs an ad-hoc test job with your custom settings below.  The test will launch in a new browser tab in order to preserve the current context.</div>`;
		html += '<div class="dialog_box_content scroll maximize">';
		
		// target
		html += this.getFormRow({
			label: 'Test Target:',
			content: this.getFormMenuSingle({
				id: 'fe_epd_target',
				options: [].concat(
					this.buildOptGroup(app.groups, config.ui.menu_bits.wf_targets_groups, 'server-network'),
					this.buildServerOptGroup(config.ui.menu_bits.wf_targets_servers, 'router-network')
				),
				value: ''
			}),
			caption: "Select a server or group to run the plugin test."
		});
		
		// custom input json
		html += this.getFormRow({
			label: 'Data Input:',
			content: this.getFormTextarea({
				id: 'fe_epd_input',
				rows: 1,
				value: JSON.stringify({ data: {}, files: [] }, null, "\t"),
				style: 'display:none'
			}) + `<div class="button small secondary" onClick="$P().edit_test_input()"><i class="mdi mdi-text-box-edit-outline">&nbsp;</i>${config.ui.buttons.wfd_edit_json}</div>`,
			caption: 'Optionally customize the JSON input data for the test job.  This is used to simulate data being passed to it from a previous job.'
		});
		
		// user files
		html += this.getFormRow({
			label: 'File Input:',
			content: this.getDialogFileUploader(),
			caption: 'Optionally upload and attach files to the test job as inputs.'
		});
		
		// plugin params
		html += this.getFormRow({
			content: '<div id="d_epd_param_editor" class="plugin_param_editor_cont">' + this.getPluginParamEditor( plugin.id, {} ) + '</div>',
			caption: plugin.params.length ? 'Enter test values for all the plugin parameters here.' : ''
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			var target = $('#fe_epd_target').val();
			if (!target) return app.badField('#fe_epd_target', "Please select a target server or group to run the test on.");
			
			var params = self.getPluginParamValues( plugin.id );
			if (!params) return; // invalid
			
			var event = {
				enabled: true,
				title: "Test Event",
				icon: 'test-tube',
				category: cat_def.id,
				targets: [ target ],
				algo: 'random',
				plugin: plugin.id,
				params: params,
				triggers: [
					{ type: "manual", enabled: true }
				],
				actions: [
					{ type: "delete", enabled: true, condition: "complete" }
				],
				limits: [],
				fields: [],
				tags: [],
				notes: "For testing only."
			};
			
			var job = deep_copy_object(event);
			job.test = true;
			job.test_actions = false;
			job.test_limits = false;
			job.label = "Test";
			
			// parse custom input json
			var raw_json = $('#fe_epd_input').val();
			if (raw_json) try {
				job.input = JSON.parse( raw_json );
			}
			catch (err) {
				return app.badField( '#fe_epd_input', "", { err } );
			}
			
			// add files if user uploaded
			if (self.dialogFiles && self.dialogFiles.length) {
				if (!job.input) job.input = {};
				if (!job.input.files) job.input.files = [];
				job.input.files = job.input.files.concat( self.dialogFiles );
				delete self.dialogFiles;
			}
			
			// pre-open new window/tab for job details
			var win = window.open('', '_blank');
			
			app.api.post( 'app/create_event', event, function(resp) {
				// now run the job
				if (!self.active) return; // sanity
				job.event = resp.event.id;
				
				app.api.post( 'app/run_event', job, function(resp) {
					// Dialog.hideProgress();
					if (!self.active) return; // sanity
					
					// jump immediately to live details page in new window
					win.location.href = '#Job?id=' + resp.id;
				}, 
				function(err) {
					// capture error so we can close the window we just opened
					win.close();
					app.doError("API Error: " + err.description);
				}); // run_event error
			},
			function(err) {
				win.close();
				app.doError("API Error: " + err.description);
			} ); // create_event error
			
			Dialog.hide();
		}); // Dialog.confirm
		
		Dialog.onDragDrop = function(files) {
			// files dropped on dialog
			ZeroUpload.upload( files, {}, {} );
		};
		
		Dialog.onHide = function() {
			// cleanup
			// FUTURE: If self.dialogFiles still exists here, delete in background (user canceled job)
			delete self.dialogFiles;
		};
		
		SingleSelect.init( $('#fe_epd_target') );
		Dialog.autoResize();
	}
	
	edit_test_input() {
		// popup json editor for test dialog
		this.editCodeAuto({
			title: "Edit Raw Input Data", 
			code: $('#fe_epd_input').val(), 
			format: 'json',
			callback: function(new_value) {
				$('#fe_epd_input').val( new_value );
			}
		});
	}
	
	do_test_action_plugin(plugin) {
		// test action plugin
		var self = this;
		var title = "Test Action Plugin";
		var btn = ['open-in-new', 'Test Plugin'];
		
		// privilege check
		if (!app.requirePrivilege('create_events')) return;
		if (!app.requirePrivilege('run_jobs')) return;
		
		if (!app.categories.length) return app.doError("No categories found.  Please add a category before testing action plugins.");
		var cat_def = find_object( app.categories, { id: 'general' } ) || app.categories[0];
		
		if (!app.groups.length) return app.doError("No server groups found.  Please add a server group before testing action plugins.");
		var grp_def = find_object( app.groups, { id: 'maingrp' } ) || app.groups[0];
		
		if (!find_object( app.plugins, { id: 'testplug' } )) return app.doError("Cannot test action plugins without the 'Test Plugin' event plugin.");
		
		var html = '';
		html += `<div class="dialog_intro">Use this form to test the current action plugin.  This is done by creating a temporary self-deleting event, which immediately runs an ad-hoc test job with your action plugin configured to fire at completion.  The test will launch in a new browser tab in order to preserve the current context.</div>`;
		html += '<div class="dialog_box_content scroll maximize">';
		
		// result
		html += this.getFormRow({
			label: 'Simulate Result:',
			content: this.getFormMenuSingle({
				id: 'fe_epd_result',
				options: [
					{ id: 'success', title: 'Success', icon: 'check-circle-outline' },
					{ id: 'error', title: 'Error', icon: 'alert-decagram-outline' },
					{ id: 'warning', title: 'Warning', icon: 'alert-outline' },
					{ id: 'critical', title: 'Critical', icon: 'fire-alert' },
					{ id: 'abort', title: 'Abort', icon: 'cancel' }
				],
				value: ''
			}),
			caption: "Select which job result to simulate for the action."
		});
		
		// plugin params
		html += this.getFormRow({
			content: '<div id="d_epd_param_editor" class="plugin_param_editor_cont">' + this.getPluginParamEditor( plugin.id, {} ) + '</div>',
			caption: plugin.params.length ? 'Enter test values for all the plugin parameters here.' : ''
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			var result = $('#fe_epd_result').val();
			if (!result) return app.badField('#fe_epd_result', "Please select a job result to simulate.");
			
			var params = self.getPluginParamValues( plugin.id );
			if (!params) return; // invalid
			
			var event = {
				enabled: true,
				title: "Test Event",
				icon: 'test-tube',
				category: cat_def.id,
				targets: [ grp_def.id ],
				algo: 'random',
				plugin: 'testplug',
				params: { 
					duration: 1,
					action: ucfirst(result)
				},
				triggers: [
					{ type: "manual", enabled: true }
				],
				actions: [
					{ type: 'plugin', enabled: true, condition: "complete", plugin_id: plugin.id },
					{ type: "delete", enabled: true, condition: "complete" }
				],
				limits: [],
				fields: [],
				tags: [],
				notes: "For testing only."
			};
			
			var job = deep_copy_object(event);
			job.test = true;
			job.test_actions = false;
			job.test_limits = false;
			job.label = "Test";
			
			// pre-open new window/tab for job details
			var win = window.open('', '_blank');
			
			app.api.post( 'app/create_event', event, function(resp) {
				// now run the job
				if (!self.active) return; // sanity
				job.event = resp.event.id;
				
				app.api.post( 'app/run_event', job, function(resp) {
					// Dialog.hideProgress();
					if (!self.active) return; // sanity
					
					// jump immediately to live details page in new window
					win.location.href = '#Job?id=' + resp.id + '&action=1';
				}, 
				function(err) {
					// capture error so we can close the window we just opened
					win.close();
					app.doError("API Error: " + err.description);
				}); // run_event error
			},
			function(err) {
				win.close();
				app.doError("API Error: " + err.description);
			} ); // create_event error
			
			Dialog.hide();
		}); // Dialog.confirm
		
		SingleSelect.init( $('#fe_epd_result') );
		Dialog.autoResize();
	}
	
	do_test_monitor_plugin(plugin) {
		// test monitor plugin
		var self = this;
		var html = '';
		var title = 'Test Monitor Plugin';
		
		var servers = this.getCategorizedServers(true);
		if (!servers.length) return app.doError(config.ui.errors.sde_no_servers);
		
		html += `<div class="dialog_intro">Test your monitor plugin on any server and view the raw result.</div>`;
		html += '<div class="dialog_box_content maximize">';
		
		// server picker
		html += this.getFormRow({
			id: 'd_epd_server',
			label: 'Select Test Server:',
			content: this.getFormMenuSingle({
				id: 'fe_epd_server',
				options: servers,
				value: '',
				default_icon: 'router-network'
			}),
			caption: "Select a server to test your monitor plugin on."
		});
		
		// json tree viewer
		html += this.getFormRow({
			id: 'd_epd_tree_viewer',
			label: plugin.title + ' Result:',
			content: '<div id="d_ex_tree"><div class="ex_tree_inner tree_static"><div class="loading_container"><div class="loading"></div></div></div></div>',
			caption: "Your plugin's parsed JSON, XML or text result will appear above."
		});
		
		html += '</div>'; // dialog_box_content
		
		var buttons_html = "";
		buttons_html += `<div id="btn_epd_retry" class="button"><i class="mdi mdi-refresh">&nbsp;</i>${config.ui.buttons.retry}</div>`;
		buttons_html += `<div class="button primary" onClick="Dialog.hide()"><i class="mdi mdi-close-circle-outline">&nbsp;</i>${config.ui.buttons.close}</div>`;
		
		Dialog.showSimpleDialog(title, html, buttons_html);
		
		SingleSelect.init('#fe_epd_server');
		
		$('#fe_epd_server').on('change', function() {
			var server_id = $(this).val();
			if (!server_id) return; // sanity
			
			$('#d_ex_tree > .ex_tree_inner').html('<div class="loading_container"><div class="loading"></div></div>');
			
			// now run the test
			app.api.post( 'app/test_monitor_plugin', { id: plugin.id, server: server_id }, function(resp) {
				// result may be plain text, or an object tree
				if (resp.result && (typeof(resp.result) == 'object')) {
					$('#d_ex_tree > .ex_tree_inner').html( self.getDataTree(resp.result) );
				}
				else {
					$('#d_ex_tree > .ex_tree_inner').html( 
						'<pre class="ex_tree_pre">' + encode_entities(resp.result || '(No output)') + '</pre>' 
					);
				}
				
				if (resp.stderr) {
					$('#d_ex_tree > .ex_tree_inner').append(
						'<pre class="ex_tree_pre"><b>STDERR:</b>' + "\n\n" + encode_entities(resp.stderr) + '</pre>' 
					);
				}
			} ); // api.get
		}); // on change
		
		$('#btn_epd_retry').on('click', function() {
			// retry the op
			$('#fe_epd_server').trigger('change');
		});
		
		// trigger change to load first server
		$('#fe_epd_server').trigger('change');
	}
	
	do_test_trigger_plugin(plugin) {
		// test trigger plugin
		var self = this;
		var html = '';
		var title = 'Test Trigger Plugin';
		var btn = ['open-in-new', 'Test Plugin'];
		
		html += `<div class="dialog_intro">Use this form to test the current trigger plugin, and view the results from a test scheduled job.  Trigger plugins always run on the primary conductor server.</div>`;
		html += '<div class="dialog_box_content scroll maximize">';
		
		// if user's tz differs from server tz, pre-populate timezone menu with user's zone
		var ropts = Intl.DateTimeFormat().resolvedOptions();
		var user_tz = app.user.timezone || ropts.timeZone;
		if (user_tz != app.config.tz) new_item.timezone = user_tz;
		
		// timezone
		var zones = [
			['', "Server Default (" + app.config.tz + ")"],
			[user_tz, "My Timezone (" + user_tz + ")"]
		].concat(app.config.intl.timezones);
		
		html += this.getFormRow({
			id: 'd_epd_tz',
			label: 'Test Timezone:',
			content: this.getFormMenuSingle({
				id: 'fe_epd_tz',
				title: 'Select Timezone',
				options: zones,
				value: ''
			}),
			caption: 'Select the desired timezone for the trigger test.'
		});
		
		// plugin params
		html += this.getFormRow({
			content: '<div id="d_epd_param_editor" class="plugin_param_editor_cont">' + this.getPluginParamEditor( plugin.id, {} ) + '</div>',
			caption: plugin.params.length ? 'Enter test values for all the plugin parameters here.' : ''
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			var timezone = $('#fe_epd_tz').val() || app.config.tz;
			
			var params = self.getPluginParamValues( plugin.id );
			if (!params) return; // invalid
			
			CodeEditor.showProgress( 1.0, "Testing trigger plugin..." );
			
			app.api.post( 'app/test_scheduler_plugin', { id: plugin.id, timezone, params }, function(resp) {
				// resp: { code, description? data?, stdout?, stderr?, child_cmd? }
				CodeEditor.hideProgress();
				
				// show results as markdown in secondary dialog
				var md = '';
				var title = '';
				
				md += `- **Plugin ID**: \`${plugin.id}\`\n`;
				md += `- **Plugin Title**: ${self.getNicePlugin(plugin.id, false)}\n`;
				md += `- **Date/Time**: ${self.getNiceDateTime(app.epoch).replace(/\&nbsp\;/g, '')}\n`;
				
				if (resp.err) {
					title = '<span class="danger"><i class="mdi mdi-alert-decagram">&nbsp;</i>Plugin Test Failed</span>';
					md += `\n### Error:\n\n${resp.description}\n`;
				}
				else {
					title = '<span style="color:var(--green)"><i class="mdi mdi-check-circle-outline">&nbsp;</i>Plugin Test Successful</span>';
					md += `\n### Launch Result:\n\n`;
					if (resp.data && resp.data.items && resp.data.items[0] && ((resp.data.items[0] === true) || resp.data.items[0].launch)) {
						md += `- <i class="mdi mdi-check-circle-outline"></i>A job launch **was triggered**.\n`;
					}
					else {
						md += `- <i class="mdi mdi-cancel"></i>A job launch was not triggered.\n`;
					}
				}
				
				if (resp.data) {
					md += "\n### Output JSON:\n\n```\n" + JSON.stringify(resp.data, null, "\t") + "\n```\n";
				}
				else if (resp.stdout) {
					md += "\n### Plugin STDOUT:\n\n```\n" + encode_entities(resp.stdout) + "\n```\n";
				}
				
				if (resp.stderr) {
					md += "\n### Plugin STDERR:\n\n```\n" + encode_entities(resp.stderr) + "\n```\n";
				}
				
				self.viewMarkdownAuto(title, md);
			}); // api.post
		}); // Dialog.confirm
		
		SingleSelect.init( $('#fe_epd_tz') );
		Dialog.autoResize();
	}
	
	do_clone() {
		// make copy of plugin and jump over to new
		app.clearError();
		var plugin = this.get_plugin_form_json();
		if (!plugin) return; // error
		
		var clone = deep_copy_object(plugin);
		clone.title = "Copy of " + clone.title;
		delete clone.id;
		delete clone.created;
		delete clone.modified;
		delete clone.revision;
		delete clone.username;
		delete clone.marketplace;
		delete clone.stock;
		
		this.clone = clone;
		Nav.go('Plugins?sub=new');
	}
	
	do_export() {
		// show export dialog
		app.clearError();
		var plugin = this.get_plugin_form_json();
		if (!plugin) return; // error
		
		this.showExportOptions({
			name: 'plugin',
			dataType: 'plugin',
			api: this.args.id ? 'update_plugin' : 'create_plugin',
			data: plugin
		});
	}
	
	go_edit_history() {
		Nav.go( '#Plugins?sub=history&id=' + this.plugin.id );
	}
	
	do_save_plugin() {
		// save changes to plugin
		var self = this;
		
		app.clearError();
		var plugin = this.get_plugin_form_json();
		if (!plugin) return; // error
		
		this.plugin = plugin;
		
		var deps = this.get_plugin_dependants();
		if (!deps) {
			// no deps, so no confirmation required
			Dialog.showProgress( 1.0, "Saving Plugin..." );
			app.api.post( 'app/update_plugin', plugin, this.save_plugin_finish.bind(this) );
			return;
		}
		
		// show confirmation to user with dep summary
		var title = `<span class="danger">Warning: Plugin Has Dependants</span>`;
		var md = '';
		var html = '';
		
		md += `Please be advised that the following resources depend on this plugin:\n`;
		md += this.get_plugin_deps_markdown(deps);
		md += `\nIf you proceed, these items may require updating, particularly if you changed any of the Plugin parameters they use.\n`;
		md += `\nAre you sure you want to proceed with saving your changes?\n`;
		
		html += '<div class="code_viewer scroll_shadows">';
		html += '<div class="markdown-body">';
		
		html += marked.parse(md, config.ui.marked_config);
		
		html += '</div>'; // markdown-body
		html += '</div>'; // code_viewer
		
		var buttons_html = "";
		buttons_html += '<div class="button mobile_collapse" onClick="Dialog.hide()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
		buttons_html += '<div class="button delete" onClick="Dialog.confirm_click(true)"><i class="mdi mdi-floppy">&nbsp;</i>Confirm Save</div>';
		
		Dialog.showSimpleDialog('<span class="danger">' + title + '</span>', html, buttons_html);
		
		// special mode for key capture
		Dialog.active = 'editor';
		Dialog.confirm_callback = function(result) { 
			if (!result) return;
			Dialog.showProgress( 1.0, "Saving Plugin..." );
			app.api.post( 'app/update_plugin', plugin, self.save_plugin_finish.bind(self) );
		};
		
		self.highlightCodeBlocks('#dialog .markdown-body');
	}
	
	save_plugin_finish(resp) {
		// new plugin saved successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		// Nav.go( 'Plugins?sub=list' );
		this.triggerSaveComplete();
		app.showMessage('success', "The plugin was saved successfully.");
	}
	
	show_delete_plugin_dialog() {
		// show dialog confirming plugin delete action
		var self = this;
		var deps = this.get_plugin_dependants();
		if (!deps) {
			// no changes, show simple prompt
			Dialog.confirmDanger( 'Delete Plugin', "Are you sure you want to <b>permanently delete</b> the " + this.plugin.type + " plugin &ldquo;" + this.plugin.title + "&rdquo;?  There is no way to undo this action.", ['trash-can', 'Delete'], function(result) {
				if (result) {
					Dialog.showProgress( 1.0, "Deleting Plugin..." );
					app.api.post( 'app/delete_plugin', self.plugin, self.delete_plugin_finish.bind(self) );
				}
			} );
			return;
		}
		
		// show user a summary of plugin's dependants
		var title = 'Delete Plugin';
		var md = '';
		var html = '';
		
		md += `Are you sure you want to **permanently delete** the ${this.plugin.type} plugin &ldquo;${this.plugin.title}&rdquo;?\n\nPlease note the following dependants that use the plugin:\n`;
		md += this.get_plugin_deps_markdown(deps);
		md += '\nIf you proceed, there is no way to undo this action.\n';
		
		html += '<div class="code_viewer scroll_shadows">';
		html += '<div class="markdown-body">';
		
		html += marked.parse(md, config.ui.marked_config);
		
		html += '</div>'; // markdown-body
		html += '</div>'; // code_viewer
		
		var buttons_html = "";
		buttons_html += '<div class="button mobile_collapse" onClick="Dialog.hide()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
		buttons_html += '<div class="button delete" onClick="Dialog.confirm_click(true)"><i class="mdi mdi-trash-can">&nbsp;</i>Confirm Delete</div>';
		
		Dialog.showSimpleDialog('<span class="danger">' + title + '</span>', html, buttons_html);
		
		// special mode for key capture
		Dialog.active = 'editor';
		Dialog.confirm_callback = function(result) { 
			if (!result) return;
			Dialog.showProgress( 1.0, "Deleting Plugin..." );
			app.api.post( 'app/delete_plugin', self.plugin, self.delete_plugin_finish.bind(self) );
		};
		
		self.highlightCodeBlocks('#dialog .markdown-body');
	}
	
	delete_plugin_finish(resp) {
		// finished deleting plugin
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Plugins?sub=list', 'force');
		app.showMessage('success', "The " + this.plugin.type + " plugin &ldquo;" + this.plugin.title + "&rdquo; was deleted successfully.");
	}
	
	get_plugin_edit_html() {
		// get html for editing an plugin (or creating a new one)
		var html = '';
		var plugin = this.plugin;
		
		if (plugin.id) {
			// plugin id
			html += this.getFormRow({
				label: 'Plugin ID:',
				content: this.getFormText({
					id: 'fe_ep_id',
					class: 'monospace',
					spellcheck: 'false',
					disabled: 'disabled',
					value: plugin.id
				}),
				suffix: this.getFormIDCopier(),
				caption: 'This is a unique ID for the plugin, used by the xyOps API.  It cannot be changed.'
			});
		}
		
		// title
		html += this.getFormRow({
			label: 'Plugin Title:',
			content: this.getFormText({
				id: 'fe_ep_title',
				spellcheck: 'false',
				value: plugin.title
			}),
			caption: 'Enter the title of the plugin, for display purposes.'
		});
		
		// enabled
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_ep_enabled',
				label: 'Plugin Enabled',
				checked: plugin.enabled
			}),
			caption: 'Check this box to enable the plugin for use.'
		});
		
		// type
		html += this.getFormRow({
			label: 'Type:',
			content: this.getFormMenuSingle({
				id: 'fe_ep_type',
				title: 'Select Plugin Type',
				placeholder: 'Select type for plugin...',
				options: [
					{ id: 'action', title: 'Action Plugin', icon: 'gesture-tap' },
					{ id: 'event', title: 'Event Plugin', icon: 'calendar-clock' },
					{ id: 'monitor', title: 'Monitor Plugin', icon: 'console' },
					{ id: 'scheduler', title: 'Trigger Plugin', icon: 'rocket-launch-outline' }
				],
				onChange: '$P().setPluginType()',
				value: plugin.type || '',
				// 'data-shrinkwrap': 1
			}),
			caption: '<span id="s_ep_plugin_type_desc"></span>'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_ep_icon',
				title: 'Select icon for plugin',
				placeholder: 'Select icon for plugin...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: plugin.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for the plugin.'
		});
		
		// command
		html += this.getFormRow({
			label: 'Executable:',
			content: this.getFormText({
				id: 'fe_ep_command',
				class: 'monospace',
				spellcheck: 'false',
				value: plugin.command || ''
			}),
			caption: 'Enter the filesystem path to your executable, including any command-line arguments you require.  This can be an interpreter like <code>/bin/sh</code> or <code>/usr/bin/python</code>, or your own custom binary.  Do not include any pipes or redirects here.'
		});
		
		// script
		html += this.getFormRow({
			label: 'Script:',
			content: this.getFormTextarea({
				id: 'fe_ep_script',
				rows: 1,
				value: plugin.script || '',
				style: 'display:none'
			}) + '<div class="button small secondary" onClick="$P().editScript()"><i class="mdi mdi-text-box-edit-outline">&nbsp;</i>Edit Script...</div>',
			caption: 'Optionally enter your Plugin source code here, which will be written to a temporary file and passed as an argument to your executable.  Leave this blank if your Plugin executable should run standalone.'
		});
		
		// params (non-monitor only)
		html += this.getFormRow({
			id: 'd_ep_params',
			label: 'Parameters:',
			content: '<div id="d_params_table"></div>',
			caption: 'Parameters are passed to your Plugin via JSON, and as environment variables. For example, you can use this to customize the PATH variable, if your Plugin requires it.'
		});
		
		// groups (monitor type only)
		html += this.getFormRow({
			id: 'd_ep_groups',
			label: 'Server Groups:',
			content: this.getFormMenuMulti({
				id: 'fe_ep_groups',
				title: 'Select Groups',
				placeholder: '(All Groups)',
				options: app.groups,
				values: plugin.groups || [],
				default_icon: 'server-network',
				'data-hold': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select which server group(s) should run the monitoring Plugin.'
		});
		
		// format (monitor type only)
		html += this.getFormRow({
			id: 'd_ep_format',
			label: 'Format:',
			content: this.getFormMenuSingle({
				id: 'fe_ep_format',
				title: 'Select Format',
				options: [['text','Text'], ['json','JSON'], ['xml', 'XML']],
				value: plugin.format || ''
			}),
			caption: 'Select the output format that the script generates, so it can be parsed correctly.'
		});
		
		// UID
		html += this.getFormRow({
			label: 'Run as User:',
			content: this.getFormText({
				id: 'fe_ep_uid',
				class: 'monospace',
				spellcheck: 'false',
				value: plugin.uid || ''
			}),
			caption: "Optionally set the User ID (UID) for the Plugin to run as.  The UID may be either numerical or a string ('root', 'www', etc.)."
		});
		
		// GID
		html += this.getFormRow({
			label: 'Run as Group:',
			content: this.getFormText({
				id: 'fe_ep_gid',
				class: 'monospace',
				spellcheck: 'false',
				value: plugin.gid || ''
			}),
			caption: "Optionally set the Group ID (GID) for the Plugin to run as.  The GID may be either numerical or a string ('wheel', 'admin', etc.)."
		});
		
		// kill policy
		html += this.getFormRow({
			id: 'd_ep_kill',
			label: 'Abort Policy:',
			content: this.getFormMenuSingle({
				id: 'fe_ep_kill',
				title: 'Select Abort Policy',
				options: [
					{ id: 'none', title: 'Kill None', icon: 'peace' },
					{ id: 'parent', title: 'Kill Parent Process', icon: 'target' },
					{ id: 'all', title: 'Kill All Processes', icon: 'death-star-variant' }
				],
				value: plugin.kill,
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select how you would like xySat to handle shutting down running jobs when they are aborted.'
		});
		
		// runner
		html += this.getFormRow({
			id: 'd_ep_runner',
			label: 'Remote Jobs:',
			content: this.getFormCheckbox({
				id: 'fe_ep_runner',
				label: 'Remote Job Runner',
				checked: !!plugin.runner
			}),
			caption: 'This indicates that jobs will run remotely (i.e. in a Docker container or over SSH) and that xySat should not monitor local resources.  In these cases an intermediate launcher script such as [xyRun](https://github.com/pixlcore/xyrun) should be used on the remote side.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_ep_notes',
				rows: 5,
				value: plugin.notes
			}),
			caption: 'Optionally enter notes for the plugin, for your own internal use.'
		});
		
		return html;
	}
	
	editScript() {
		// popup code editor
		var self = this;
		var mode = app.getCodemirrorModeFromBinary( $('#fe_ep_command').val() );
		
		this.editCodeAuto({
			title: "Edit Plugin Script", 
			code: $('#fe_ep_script').val().trim(), 
			format: mode,
			editor_config: {
				lineNumbers: true
			},
			callback: function(new_value) {
				$('#fe_ep_script').val( new_value );
				self.triggerEditChange();
			}
		});
	}
	
	setPluginType() {
		// swap out the plugin type dynamic caption
		var plugin_type = $('#fe_ep_type').val();
		var md = config.ui.plugin_type_descriptions[ plugin_type ];
		this.div.find('#s_ep_plugin_type_desc').html( inline_marked(md) );
		
		// hide/show sections based on new type
		switch (plugin_type) {
			case 'monitor':
				this.div.find('#d_ep_params').hide();
				this.div.find('#d_ep_groups').show();
				this.div.find('#d_ep_format').show();
			break;
			
			default:
				this.div.find('#d_ep_params').show();
				this.div.find('#d_ep_groups').hide();
				this.div.find('#d_ep_format').hide();
			break;
		} // switch plugin_type
		
		// only show kill checkbox for event type
		$('#d_ep_kill').toggle( plugin_type == 'event' );
		$('#d_ep_runner').toggle( plugin_type == 'event' );
	}
	
	get_plugin_form_json() {
		// get api key elements from form, used for new or edit
		var plugin = this.plugin;
		
		plugin.title = $('#fe_ep_title').val().trim();
		plugin.enabled = $('#fe_ep_enabled').is(':checked') ? true : false;
		plugin.type = $('#fe_ep_type').val();
		plugin.icon = $('#fe_ep_icon').val();
		plugin.command = $('#fe_ep_command').val().trim();
		plugin.script = $('#fe_ep_script').val().trim();
		plugin.uid = $('#fe_ep_uid').val();
		plugin.gid = $('#fe_ep_gid').val();
		plugin.notes = $('#fe_ep_notes').val();
		
		if (plugin.type == 'event') {
			plugin.kill = $('#fe_ep_kill').val();
			plugin.runner = $('#fe_ep_runner').is(':checked');
		}
		else {
			delete plugin.kill;
			delete plugin.runner;
		}
		
		if (!plugin.title.length) {
			return app.badField('#fe_ep_title', "Please enter a title for the plugin.");
		}
		if (!plugin.command.length) {
			return app.badField('#fe_ep_command', "Please enter the executable path for the plugin.");
		}
		
		switch (plugin.type) {
			case 'monitor':
				this.params = plugin.params = [];
				plugin.groups = $('#fe_ep_groups').val();
				plugin.format = $('#fe_ep_format').val();
			break;
			
			default:
				plugin.groups = [];
				plugin.format = '';
			break;
		} // switch plugin_type
		
		return plugin;
	}
	
	onDataUpdate(key, data) {
		// refresh list if plugins were updated
		if ((key == 'plugins') && (this.args.sub == 'list')) this.gosub_list(this.args);
	}
	
	onDeactivate() {
		// called when page is deactivated
		delete this.plugins;
		delete this.plugin;
		delete this.params;
		this.cleanupRevHistory();
		this.cleanupBoxButtonFloater();
		this.div.html( '' );
		return true;
	}
	
};
