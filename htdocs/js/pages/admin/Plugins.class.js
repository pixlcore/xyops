// Admin Page -- Plugins Config

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Plugins = class Plugins extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'ep';
		this.controlTypes = ['checkbox', 'code', 'hidden', 'select', 'text', 'textarea', 'toolset'];
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		if (!this.requireAnyPrivilege('create_plugins', 'edit_plugins', 'delete_plugins')) return true;
		
		if (!args) args = {};
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
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Plugin Title', 'Plugin ID', 'Type', 'Author', 'Created', 'Actions'];
		
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
			if (app.hasPrivilege('edit_plugins')) actions.push( '<span class="link" onClick="$P().edit_plugin('+idx+')"><b>Edit</b></span>' );
			if (app.hasPrivilege('delete_plugins')) actions.push( '<span class="link danger" onClick="$P().delete_plugin('+idx+')"><b>Delete</b></span>' );
			
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
				self.getNiceUser(item.username, app.isAdmin()),
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
			if (app.hasPrivilege('create_plugins')) html += '<div class="button default" onClick="$P().edit_plugin(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i><span>New Plugin...</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.setupBoxButtonFloater();
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
			"notes": ""
		};
		this.params = this.plugin.params;
		
		html += this.get_plugin_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button phone_collapse" onClick="$P().cancel_plugin_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button primary" onClick="$P().do_new_plugin()"><i class="mdi mdi-floppy">&nbsp;</i><span>Create Plugin</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_ep_icon, #fe_ep_type, #fe_ep_format, #fe_ep_kill') );
		MultiSelect.init( this.div.find('select[multiple]') );
		// this.updateAddRemoveMe('#fe_ep_email');
		$('#fe_ep_title').focus();
		this.setPluginType();
		this.setupBoxButtonFloater();
		this.setupEditor();
		this.renderParamEditor();
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
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
			html += '<div class="button save phone_collapse" onClick="$P().do_save_plugin()"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Changes</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_ep_icon, #fe_ep_type, #fe_ep_format, #fe_ep_kill') );
		MultiSelect.init( this.div.find('select[multiple]') );
		// this.updateAddRemoveMe('#fe_ep_email');
		this.setPluginType();
		this.setDefaultEditorMode();
		this.setupEditor();
		this.setupBoxButtonFloater();
		this.renderParamEditor();
		this.setupEditTriggers();
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
		app.clearError();
		var plugin = this.get_plugin_form_json();
		if (!plugin) return; // error
		
		this.plugin = plugin;
		
		Dialog.showProgress( 1.0, "Saving Plugin..." );
		app.api.post( 'app/update_plugin', plugin, this.save_plugin_finish.bind(this) );
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
		
		// check for events first
		// var plugin_events = find_objects( app.events, { plugin: this.plugin.id } );
		// var num_events = plugin_events.length;
		// if (num_events) return app.doError("Sorry, you cannot delete a plugin that has events assigned to it.");
		
		Dialog.confirmDanger( 'Delete Plugin', "Are you sure you want to <b>permanently delete</b> the " + this.plugin.type + " plugin &ldquo;" + this.plugin.title + "&rdquo;?  There is no way to undo this action.", ['trash-can', 'Delete'], function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Plugin..." );
				app.api.post( 'app/delete_plugin', self.plugin, self.delete_plugin_finish.bind(self) );
			}
		} );
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
				value: plugin.command || '',
				onChange: '$P().setDefaultEditorMode()'
			}),
			caption: 'Enter the filesystem path to your executable, including any command-line arguments you require.  This can be an interpreter like <code>/bin/sh</code> or <code>/usr/bin/python</code>, or your own custom binary.  Do not include any pipes or redirects here.'
		});
		
		// script (codemirror)
		html += this.getFormRow({
			id: 'd_editor',
			label: 'Script:',
			content: '<div onClick="$P().editor.focus()">' + this.getFormTextarea({
				id: 'fe_editor',
				class: 'monospace',
				rows: 5,
				value: (plugin.script || '') + "\n"
			}) + '</div>',
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
	}
	
	get_plugin_form_json() {
		// get api key elements from form, used for new or edit
		var plugin = this.plugin;
		
		plugin.title = $('#fe_ep_title').val().trim();
		plugin.enabled = $('#fe_ep_enabled').is(':checked') ? true : false;
		plugin.type = $('#fe_ep_type').val();
		plugin.icon = $('#fe_ep_icon').val();
		plugin.command = $('#fe_ep_command').val().trim();
		plugin.script = this.editor.getValue().trim();
		plugin.uid = $('#fe_ep_uid').val();
		plugin.gid = $('#fe_ep_gid').val();
		plugin.notes = $('#fe_ep_notes').val();
		
		if (plugin.type == 'event') plugin.kill = $('#fe_ep_kill').val();
		else delete plugin.kill;
		
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
	
	setDefaultEditorMode() {
		// set default editor mode from command text field
		this.defaultEditorMode = app.getCodemirrorModeFromBinary( $('#fe_ep_command').val() );
		
		if (this.defaultEditorMode && this.editor && this.editor.options && (this.editor.options.mode === null)) {
			Debug.trace('debug', "Setting default language: " + this.defaultEditorMode);
			this.editor.setOption('mode', { name: 'mustache', backdrop: this.defaultEditorMode });
			this.editor.refresh();
		}
	}
	
	onDragDrop(files) {
		// intercept drag-drop event and upload files to code editor
		var self = this;
		
		if (this.editor) {
			// plop file into editor
			var reader = new FileReader();
			
			reader.onload = function(e) {
				self.editor.setValue( e.target.result );
				self.editor.focus();
				
				var old_mode = self.editor.getOption('mode');
				if (old_mode.backdrop) old_mode = old_mode.backdrop;
				var mode = self.defaultEditorMode || app.detectCodemirrorMode(e.target.result) || null;
				
				if (mode != old_mode) {
					Debug.trace('debug', "Detected language: " + mode);
					self.editor.setOption('mode', { name: 'mustache', backdrop: mode });
					self.editor.refresh();
				}
				
				self.triggerEditChange();
			};
			
			reader.readAsText( files[0] );
		}
		else this.doPrepImportFile( files[0] );
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
		// refresh list if plugins were updated
		if ((key == 'plugins') && (this.args.sub == 'list')) this.gosub_list(this.args);
	}
	
	onDeactivate() {
		// called when page is deactivated
		delete this.plugins;
		delete this.plugin;
		delete this.params;
		delete this.defaultEditorMode;
		this.cleanupRevHistory();
		this.killEditor();
		this.div.html( '' );
		return true;
	}
	
};
