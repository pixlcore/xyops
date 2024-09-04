// Admin Page -- Command Config

Page.Commands = class Commands extends Page.Base {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'ec';
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
		// show command list
		app.setWindowTitle( "Monitor Commands" );
		app.setHeaderTitle( '<i class="mdi mdi-console">&nbsp;</i>Monitor Commands' );
		
		// this.loading();
		// app.api.post( 'app/get_commands', copy_object(args), this.receive_commands.bind(this) );
		
		// use commands in app cache
		this.receive_commands({
			code: 0,
			rows: app.commands,
			list: { length: app.commands.length }
		});
	}
	
	receive_commands(resp) {
		// receive all commands from server, render them sorted
		var html = '';
		
		if (!resp.rows) resp.rows = [];
		this.commands = resp.rows;
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Command Title', 'Command ID', 'Groups', 'Author', 'Created', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Monitor Commands';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var self = this;
		html += this.getBasicGrid( this.commands, cols, 'command', function(item, idx) {
			var actions = [];
			actions.push( '<span class="link" onMouseUp="$P().edit_command('+idx+')"><b>Edit</b></span>' );
			actions.push( '<span class="link danger" onMouseUp="$P().delete_command('+idx+')"><b>Delete</b></span>' );
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggle_command_enabled(this,' + idx + ')'
				}) + '</div>',
				'<b>' + self.getNiceCommand(item, true) + '</b>',
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
			html += '<div class="button secondary" onMouseUp="$P().edit_command(-1)">Add Command...</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.setupBoxButtonFloater();
	}
	
	toggle_command_enabled(elem, idx) {
		// toggle command checkbox, actually do the enable/disable here, update row
		var self = this;
		var item = this.commands[idx];
		
		if (config.alt_to_toggle && !app.lastClick.altKey) {
			$(elem).prop('checked', !$(elem).is(':checked'));
			return app.showMessage('warning', "Accidental Click Protection: Please hold the Alt/Opt key to toggle this checkbox.", 8);
		}
		
		item.enabled = !!$(elem).is(':checked');
		
		app.api.post( 'app/update_command', item, function(resp) {
			if (!self.active) return; // sanity
			
			if (item.enabled) $(elem).closest('tr').removeClass('disabled');
			else $(elem).closest('tr').addClass('disabled');
			
			$(elem).closest('tr').find('div.td_big').html( self.getNiceCommand(item, true) );
		} );
	}
	
	edit_command(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Commands?sub=edit&id=' + this.commands[idx].id );
		else Nav.go( '#Commands?sub=new' );
	}
	
	delete_command(idx) {
		// delete command from search results
		this.command = this.commands[idx];
		this.show_delete_command_dialog();
	}
	
	gosub_new(args) {
		// create new command
		var html = '';
		app.setWindowTitle( "New Command" );
		
		app.setHeaderNav([
			{ icon: 'console', loc: '#Commands?sub=list', title: 'Monitor Commands' },
			{ icon: 'pound-box-outline', title: "New Command" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New Server Command';
			html += '<div class="box_subtitle"><a href="#Commands?sub=list">&laquo; Back to Command List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.command = {
			"id": "",
			"enabled": true,
			"title": "",
			"exec": "/bin/sh",
			"script": "",
			"groups": [],
			"format": "text",
			"timeout": 5,
			"uid": "",
			"notes": ""
		};
		
		html += this.get_command_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_command_edit()">Cancel</div>';
			html += '<div class="button primary" onMouseUp="$P().do_new_command()"><i class="mdi mdi-floppy">&nbsp;</i>Create Command</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_ec_icon') );
		MultiSelect.init( this.div.find('select[multiple]') );
		RelativeTime.init( this.div.find('#fe_ec_timeout') );
		$('#fe_ec_title').focus();
		this.setupBoxButtonFloater();
	}
	
	cancel_command_edit() {
		// cancel editing command and return to list
		Nav.go( '#Commands?sub=list' );
	}
	
	do_new_command(force) {
		// create new command
		app.clearError();
		var command = this.get_command_form_json();
		if (!command) return; // error
		
		this.command = command;
		
		Dialog.showProgress( 1.0, "Creating Command..." );
		app.api.post( 'app/create_command', command, this.new_command_finish.bind(this) );
	}
	
	new_command_finish(resp) {
		// new command created successfully
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Commands?sub=list');
		app.showMessage('success', "The new command was created successfully.");
	}
	
	gosub_edit(args) {
		// edit command subpage
		this.loading();
		app.api.post( 'app/get_command', { id: args.id }, this.receive_command.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_command(resp) {
		// edit existing command
		var html = '';
		this.command = resp.command;
		if (!this.active) return; // sanity
		
		app.setWindowTitle( "Editing Command \"" + (this.command.title) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'console', loc: '#Commands?sub=list', title: 'Monitor Commands' },
			{ icon: this.command.icon || 'pound-box-outline', title: this.command.title }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit Command Details';
			html += '<div class="box_subtitle"><a href="#Commands?sub=list">&laquo; Back to Command List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_command_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_command_edit()">Cancel</div>';
			html += '<div class="button danger" onMouseUp="$P().show_delete_command_dialog()">Delete Command...</div>';
			html += '<div class="button primary" onMouseUp="$P().do_save_command()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		// lock ID for editing
		$('#fe_ec_id').attr('disabled', true);
		SingleSelect.init( this.div.find('#fe_ec_icon') );
		MultiSelect.init( this.div.find('select[multiple]') );
		RelativeTime.init( this.div.find('#fe_ec_timeout') );
		this.setupBoxButtonFloater();
	}
	
	do_save_command() {
		// save changes to command
		app.clearError();
		var command = this.get_command_form_json();
		if (!command) return; // error
		
		this.command = command;
		
		Dialog.showProgress( 1.0, "Saving Command..." );
		app.api.post( 'app/update_command', command, this.save_command_finish.bind(this) );
	}
	
	save_command_finish(resp) {
		// new command saved successfully
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go( 'Commands?sub=list' );
		app.showMessage('success', "The server command was saved successfully.");
	}
	
	show_delete_command_dialog() {
		// show dialog confirming command delete action
		var self = this;
		
		Dialog.confirmDanger( 'Delete Command', "Are you sure you want to <b>permanently delete</b> the server command &ldquo;" + this.command.title + "&rdquo;?  There is no way to undo this action.", 'Delete', function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Command..." );
				app.api.post( 'app/delete_command', self.command, self.delete_command_finish.bind(self) );
			}
		} );
	}
	
	delete_command_finish(resp) {
		// finished deleting command
		var self = this;
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Commands?sub=list', 'force');
		app.showMessage('success', "The server command &ldquo;" + this.command.title + "&rdquo; was deleted successfully.");
	}
	
	get_command_edit_html() {
		// get html for editing an command (or creating a new one)
		var html = '';
		var command = this.command;
		
		// title
		html += this.getFormRow({
			label: 'Command Title:',
			content: this.getFormText({
				id: 'fe_ec_title',
				spellcheck: 'false',
				value: command.title,
				onChange: '$P().suggestIDFromTitle()'
			}),
			caption: 'Enter the title of the command, for display purposes.'
		});
		
		// command id
		html += this.getFormRow({
			label: 'Command ID:',
			content: this.getFormText({
				id: 'fe_ec_id',
				class: 'monospace',
				spellcheck: 'false',
				onChange: '$P().checkCommandExists(this)',
				value: command.id
			}),
			suffix: '<div class="checker"></div>',
			caption: 'Enter a unique ID for the command (alphanumerics only).  Once created this cannot be changed.'
		});
		
		// status
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_ec_enabled',
				label: 'Command Enabled',
				checked: command.enabled
			}),
			caption: 'Only active commands will be executed on matching servers.'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_ec_icon',
				title: 'Select icon for command',
				placeholder: 'Select icon for command...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: command.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for the command.'
		});
		
		// groups
		html += this.getFormRow({
			label: 'Server Groups:',
			content: this.getFormMenuMulti({
				id: 'fe_ec_groups',
				title: 'Select groups to run the command',
				placeholder: '(All Groups)',
				options: app.groups,
				values: command.groups,
				default_icon: 'server-network',
				'data-hold': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select which server group(s) should run the command.'
		});
		
		// exec
		html += this.getFormRow({
			label: 'Shell:',
			content: this.getFormText({
				id: 'fe_ec_exec',
				class: 'monospace',
				spellcheck: 'false',
				value: command.exec
			}),
			caption: 'Enter the shell interpreter path to process your command script. This can also be a non-shell interpreter such as <b>/usr/bin/node</b> or <b>/usr/bin/python</b>.'
		});
		
		// script
		html += this.getFormRow({
			label: 'Script:',
			content: this.getFormTextarea({
				id: 'fe_ec_script',
				class: 'monospace',
				rows: 5,
				value: command.script
			}),
			caption: 'Enter the script source to be executed using the selected interpreter.'
		});
		
		// format
		html += this.getFormRow({
			label: 'Format:',
			content: this.getFormMenu({
				id: 'fe_ec_format',
				options: [['text','Text'], ['json','JSON'], ['xml', 'XML']],
				value: command.format
			}),
			caption: 'Select the output format that the script generates, so it can be parsed correctly.'
		});
		
		// timeout
		html += this.getFormRow({
			label: 'Timeout:',
			content: this.getFormRelativeTime({
				id: 'fe_ec_timeout',
				value: command.timeout
			}),
			caption: 'Enter the maximum time to allow the command to run, or 0 for infinite.'
		});
		
		// uid
		html += this.getFormRow({
			label: 'User ID:',
			content: this.getFormText({
				id: 'fe_ec_uid',
				spellcheck: 'false',
				value: command.uid
			}),
			caption: 'Optionally enter a custom User ID to run the command as. The UID may be either numerical or a username string.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_ec_notes',
				rows: 5,
				value: command.notes
			}),
			caption: 'Optionally enter notes for the command, for your own use.'
		});
		
		return html;
	}
	
	get_command_form_json() {
		// get api key elements from form, used for new or edit
		var command = this.command;
		
		command.id = $('#fe_ec_id').val().replace(/\W+/g, '').toLowerCase();
		command.enabled = $('#fe_ec_enabled').is(':checked');
		command.icon = $('#fe_ec_icon').val();
		command.title = $('#fe_ec_title').val().trim();
		command.groups = $('#fe_ec_groups').val();
		command.exec = $('#fe_ec_exec').val();
		command.script = $('#fe_ec_script').val();
		command.format = $('#fe_ec_format').val();
		command.timeout = parseInt( $('#fe_ec_timeout').val() );
		command.uid = $('#fe_ec_uid').val();
		command.notes = $('#fe_ec_notes').val();
		
		if (!command.id.length) {
			return app.badField('#fe_ec_id', "Please enter a unique alphanumeric ID for the command.");
		}
		if (!command.title.length) {
			return app.badField('#fe_ec_title', "Please enter a title for the command.");
		}
		if (isNaN(command.timeout) || (command.timeout < 0)) {
			return app.badField('#fe_ec_timeout_val', "Please enter a valid timeout for the command, or 0 for infinite.");
		}
		
		return command;
	}
	
	checkCommandExists(field) {
		// check if command exists, update UI checkbox
		// called after field changes
		var $field = $(field);
		var id = trim( $field.val().toLowerCase() );
		var $elem = $field.closest('.form_row').find('.fr_suffix .checker');
		
		if (id.match(/^\w+$/)) {
			// check with cache
			if (find_object(app.commands, { id: id })) {
				// command taken
				$elem.css('color','red').html('<span class="mdi mdi-alert-circle"></span>').attr('title', "Command ID is taken.");
				$field.addClass('warning');
			}
			else {
				// command is valid and available!
				$elem.css('color','green').html('<span class="mdi mdi-check-circle"></span>').attr('title', "Command ID is available!");
				$field.removeClass('warning');
			}
		}
		else if (id.length) {
			// bad id
			$elem.css('color','red').html('<span class="mdi mdi-alert-decagram"></span>').attr('title', "Command ID is malformed.");
			$field.addClass('warning');
		}
		else {
			// empty
			$elem.html('').removeAttr('title');
			$field.removeClass('warning');
		}
	}
	
	onDataUpdate(key, data) {
		// refresh list if commands were updated
		if ((key == 'commands') && (this.args.sub == 'list')) this.gosub_list(this.args);
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
