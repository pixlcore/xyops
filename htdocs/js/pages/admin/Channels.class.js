// Admin Page -- Notification Channels Config

Page.Channels = class Channels extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'ech';
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
		// show channel list
		app.setWindowTitle( "Notification Channels" );
		app.setHeaderTitle( '<i class="mdi mdi-bullhorn-outline">&nbsp;</i>Notification Channels' );
		
		// this.loading();
		// app.api.post( 'app/get_channels', copy_object(args), this.receive_channels.bind(this) );
		
		// use channels in app cache
		this.receive_channels({
			code: 0,
			rows: app.channels,
			list: { length: app.channels.length }
		});
	}
	
	receive_channels(resp) {
		// receive all channels from server, render them sorted
		var self = this;
		var html = '';
		
		if (!resp.rows) resp.rows = [];
		this.channels = resp.rows;
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Channel Title', 'Channel ID', 'Author', 'Created', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Notification Channels';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var grid_opts = {
			rows: this.channels,
			cols: cols,
			data_type: 'channel',
			grid_template_columns: 'min-content' + ' auto'.repeat( cols.length - 1 )
		};
		
		html += this.getBasicGrid( grid_opts, function(item, idx) {
			var actions = [];
			actions.push( '<span class="link" onClick="$P().edit_channel('+idx+')"><b>Edit</b></span>' );
			actions.push( '<span class="link danger" onClick="$P().delete_channel('+idx+')"><b>Delete</b></span>' );
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggle_channel_enabled(this,' + idx + ')'
				}) + '</div>',
				'<b>' + self.getNiceChannel(item, true) + '</b>',
				'<span class="mono">' + item.id + '</span>',
				self.getNiceUser(item.username, app.isAdmin()),
				'<span title="'+self.getNiceDateTimeText(item.created)+'">'+self.getNiceDate(item.created)+'</span>',
				actions.join(' | ')
			];
			
			if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button" onClick="$P().doFileImportPrompt()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i>Import File...</div>';
			html += '<div class="button secondary" onClick="$P().go_history()"><i class="mdi mdi-history">&nbsp;</i>Revision History...</div>';
			html += '<div class="button secondary" onClick="$P().edit_channel(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i>New Channel...</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.setupBoxButtonFloater();
	}
	
	toggle_channel_enabled(elem, idx) {
		// toggle channel checkbox, actually do the enable/disable here, update row
		var self = this;
		var item = this.channels[idx];
		
		if (config.alt_to_toggle && !app.lastClick.altKey) {
			$(elem).prop('checked', !$(elem).is(':checked'));
			return app.showMessage('warning', "Accidental Click Protection: Please hold the Alt/Opt key to toggle this checkbox.", 8);
		}
		
		item.enabled = !!$(elem).is(':checked');
		
		app.api.post( 'app/update_channel', item, function(resp) {
			if (!self.active) return; // sanity
			
			if (item.enabled) $(elem).closest('tr').removeClass('disabled');
			else $(elem).closest('tr').addClass('disabled');
			
			$(elem).closest('tr').find('div.td_big').html( self.getNiceChannel(item, true) );
		} );
	}
	
	edit_channel(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Channels?sub=edit&id=' + this.channels[idx].id );
		else Nav.go( '#Channels?sub=new' );
	}
	
	delete_channel(idx) {
		// delete channel from search results
		this.channel = this.channels[idx];
		this.show_delete_channel_dialog();
	}
	
	go_history() {
		Nav.go( '#Channels?sub=history' );
	}
	
	gosub_history(args) {
		// show revision history sub-page
		app.setHeaderNav([
			{ icon: 'bullhorn-outline', loc: '#Channels?sub=list', title: 'Channels' },
			{ icon: 'history', title: "Revision History" }
		]);
		app.setWindowTitle( "Channel Revision History" );
		
		this.goRevisionHistory({
			activityType: 'channels',
			itemKey: 'channel',
			editPageID: 'Channels',
			itemMenu: {
				label: '<i class="icon mdi mdi-bullhorn-outline">&nbsp;</i>Channel:',
				title: 'Select Channel',
				options: [['', 'Any Channel']].concat( app.channels ),
				default_icon: 'bullhorn-outline'
			}
		});
	}
	
	gosub_new(args) {
		// create new channel
		var html = '';
		app.setWindowTitle( "New Channel" );
		
		app.setHeaderNav([
			{ icon: 'bullhorn-outline', loc: '#Channels?sub=list', title: 'Channels' },
			{ icon: 'bullhorn-outline', title: "New Channel" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New Notification Channel';
			html += '<div class="box_subtitle"><a href="#Channels?sub=list">&laquo; Back to Channel List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.channel = {
			"id": "",
			"title": "",
			"enabled": true,
			"email": "",
			"users": [],
			"run_event": "",
			"sound": "",
			"shell_exec": "",
			"notes": ""
		};
		
		html += this.get_channel_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onClick="$P().cancel_channel_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i>Cancel</div>';
			html += '<div class="button secondary" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button primary" onClick="$P().do_new_channel()"><i class="mdi mdi-floppy">&nbsp;</i>Create Channel</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ech_run_event, #fe_ech_icon, #fe_ech_web_hook, #fe_ech_sound') );
		this.updateAddRemoveMe('#fe_ech_email');
		$('#fe_ech_title').focus();
		this.setupBoxButtonFloater();
	}
	
	cancel_channel_edit() {
		// cancel editing channel and return to list
		Nav.go( '#Channels?sub=list' );
	}
	
	do_new_channel(force) {
		// create new channel
		app.clearError();
		var channel = this.get_channel_form_json();
		if (!channel) return; // error
		
		this.channel = channel;
		
		Dialog.showProgress( 1.0, "Creating Channel..." );
		app.api.post( 'app/create_channel', channel, this.new_channel_finish.bind(this) );
	}
	
	new_channel_finish(resp) {
		// new channel created successfully
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Channels?sub=list');
		app.showMessage('success', "The new channel was created successfully.");
	}
	
	gosub_edit(args) {
		// edit channel subpage
		this.loading();
		app.api.post( 'app/get_channel', { id: args.id }, this.receive_channel.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_channel(resp) {
		// edit existing channel
		var html = '';
		
		if (this.args.rollback && this.rollbackData) {
			resp.channel = this.rollbackData;
			delete this.rollbackData;
			app.showMessage('info', `Revision ${resp.channel.revision} has been loaded as a draft edit.  Click 'Save Changes' to complete the rollback.  Note that a new revision number will be assigned.`);
		}
		
		this.channel = resp.channel;
		if (!this.active) return; // sanity
		
		app.setWindowTitle( "Editing Channel \"" + (this.channel.title) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'bullhorn-outline', loc: '#Channels?sub=list', title: 'Channels' },
			{ icon: this.channel.icon || 'bullhorn-outline', title: this.channel.title }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit Channel Details';
			html += '<div class="box_subtitle"><a href="#Channels?sub=list">&laquo; Back to Channel List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_channel_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button mobile_collapse" onClick="$P().cancel_channel_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			html += '<div class="button danger mobile_collapse" onClick="$P().show_delete_channel_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
			html += '<div class="button primary" onClick="$P().do_save_channel()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		// lock ID for editing
		$('#fe_ech_id').attr('disabled', true);
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ech_run_event, #fe_ech_icon, #fe_ech_web_hook, #fe_ech_sound') );
		this.updateAddRemoveMe('#fe_ech_email');
		this.setupBoxButtonFloater();
	}
	
	do_export() {
		// show export dialog
		app.clearError();
		var channel = this.get_channel_form_json();
		if (!channel) return; // error
		
		this.showExportOptions({
			name: 'channel',
			dataType: 'channel',
			api: this.args.id ? 'update_channel' : 'create_channel',
			data: channel
		});
	}
	
	go_edit_history() {
		Nav.go( '#Channels?sub=history&id=' + this.channel.id );
	}
	
	do_save_channel() {
		// save changes to channel
		app.clearError();
		var channel = this.get_channel_form_json();
		if (!channel) return; // error
		
		this.channel = channel;
		
		Dialog.showProgress( 1.0, "Saving Channel..." );
		app.api.post( 'app/update_channel', channel, this.save_channel_finish.bind(this) );
	}
	
	save_channel_finish(resp) {
		// new channel saved successfully
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go( 'Channels?sub=list' );
		app.showMessage('success', "The channel was saved successfully.");
	}
	
	show_delete_channel_dialog() {
		// show dialog confirming channel delete action
		var self = this;
		
		Dialog.confirmDanger( 'Delete Channel', "Are you sure you want to <b>permanently delete</b> the notification channel &ldquo;" + this.channel.title + "&rdquo;?  There is no way to undo this action.", 'Delete', function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Channel..." );
				app.api.post( 'app/delete_channel', self.channel, self.delete_channel_finish.bind(self) );
			}
		} );
	}
	
	delete_channel_finish(resp) {
		// finished deleting channel
		var self = this;
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Channels?sub=list', 'force');
		app.showMessage('success', "The channel &ldquo;" + this.channel.title + "&rdquo; was deleted successfully.");
	}
	
	getNiceSounds() {
		// get nice list of sounds suitable for menu
		return app.sounds.map( function(filename) {
			return { id: filename, title: toTitleCase( filename.replace(/\.\w+$/, '').replace(/-/g, ' ') ) };
		} );
	}
	
	playCurrentSound(elem) {
		// play current sound if one is selected
		var sound = elem.value;
		if (sound) app.playSound(sound);
	}
	
	get_channel_edit_html() {
		// get html for editing an channel (or creating a new one)
		var html = '';
		var channel = this.channel;
		
		// title
		html += this.getFormRow({
			label: 'Channel Title:',
			content: this.getFormText({
				id: 'fe_ech_title',
				spellcheck: 'false',
				value: channel.title,
				onChange: '$P().suggestIDFromTitle()'
			}),
			caption: 'Enter the title of the channel, for display purposes.'
		});
		
		// channel id
		html += this.getFormRow({
			label: 'Channel ID:',
			content: this.getFormText({
				id: 'fe_ech_id',
				class: 'monospace',
				spellcheck: 'false',
				onChange: '$P().checkChannelExists(this)',
				value: channel.id
			}),
			suffix: '<div class="checker"></div>',
			caption: 'Enter a unique ID for the channel (alphanumerics only).  Once created this cannot be changed.'
		});
		
		// enabled
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_ech_enabled',
				label: 'Notifications Enabled',
				checked: channel.enabled
			}),
			caption: 'Check this box to enable all notifications for the channel.'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_ech_icon',
				title: 'Select icon for channel',
				placeholder: 'Select icon for channel...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: channel.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for the channel.'
		});
		
		// users
		html += this.getFormRow({
			label: 'Notify Users:',
			content: this.getFormMenuMulti({
				id: 'fe_ech_users',
				title: 'Select Users',
				placeholder: 'None',
				options: app.users.map( function(user) {
					return { id: user.username, title: user.full_name, icon: user.icon || '' };
				} ),
				values: channel.users || [],
				default_icon: 'account',
				'data-hold': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select which users should be notified for this channel.'
		});
		
		// email
		html += this.getFormRow({
			label: 'Send Email:',
			content: this.getFormText({
				id: 'fe_ech_email',
				// type: 'email',
				spellcheck: 'false',
				placeholder: 'email@sample.com',
				value: channel.email,
				onChange: '$P().updateAddRemoveMe(this)'
			}),
			suffix: '<div class="form_suffix_icon mdi" title="" onClick="$P().addRemoveMe(this)"></div>',
			caption: 'Optionally add custom e-mail recipients to be notified for this channel.'
		});
		
		// web hook
		html += this.getFormRow({
			label: 'Web Hook:',
			content: this.getFormMenuSingle({
				id: 'fe_ech_web_hook',
				title: 'Select Web Hook',
				options: [ ['', "(None)"] ].concat( app.web_hooks ),
				value: channel.web_hook,
				default_icon: 'webhook'
			}),
			caption: 'Optionally select a Web Hook to fire for this channel.'
		});
		
		// run event
		html += this.getFormRow({
			label: 'Run Event:',
			content: this.getFormMenuSingle({
				id: 'fe_ech_run_event',
				title: 'Select Event',
				options: [ ['', "(None)"] ].concat( this.getCategorizedEvents() ),
				value: channel.run_event,
				default_icon: 'calendar-clock'
			}),
			caption: 'Optionally select an event to run for this action.'
		});
		
		// play sound
		html += this.getFormRow({
			label: 'Play Sound:',
			content: this.getFormMenuSingle({
				id: 'fe_ech_sound',
				title: 'Select Sound',
				options: [ ['', "(None)"] ].concat( this.getNiceSounds() ),
				value: channel.sound || '',
				default_icon: 'volume-high',
				onChange: '$P().playCurrentSound(this)'
			}),
			caption: 'Optionally select a sound effect to play for all channel users.'
		});
		
		// shell exec
		html += this.getFormRow({
			label: 'Shell Exec:',
			content: this.getFormText({
				id: 'fe_ech_shell_exec',
				class: 'monospace',
				spellcheck: 'false',
				value: channel.shell_exec
			}),
			caption: 'Optionally enter a shell command to execute for this action.  This will always run on the primary server.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_ech_notes',
				rows: 5,
				value: channel.notes
			}),
			caption: 'Optionally enter notes for the channel, which will be included in all e-mail notifications.'
		});
		
		return html;
	}
	
	get_channel_form_json() {
		// get api key elements from form, used for new or edit
		var channel = this.channel;
		
		channel.id = $('#fe_ech_id').val().replace(/\W+/g, '').toLowerCase();
		channel.title = $('#fe_ech_title').val().trim();
		channel.enabled = $('#fe_ech_enabled').is(':checked') ? true : false;
		channel.icon = $('#fe_ech_icon').val();
		channel.users = $('#fe_ech_users').val();
		channel.email = $('#fe_ech_email').val();
		channel.web_hook = $('#fe_ech_web_hook').val();
		channel.run_event = $('#fe_ech_run_event').val();
		channel.sound = $('#fe_ech_sound').val();
		channel.shell_exec = $('#fe_ech_shell_exec').val();
		channel.notes = $('#fe_ech_notes').val();
		
		if (!channel.id.length) {
			return app.badField('#fe_ech_id', "Please enter a unique alphanumeric ID for the channel.");
		}
		if (!channel.title.length) {
			return app.badField('#fe_ech_title', "Please enter a title for the channel.");
		}
		
		return channel;
	}
	
	checkChannelExists(field) {
		// check if channel exists, update UI checkbox
		// called after field changes
		var $field = $(field);
		var id = trim( $field.val().toLowerCase() );
		var $elem = $field.closest('.form_row').find('.fr_suffix .checker');
		
		if (id.match(/^\w+$/)) {
			// check with cache
			if (find_object(app.channels, { id: id })) {
				// channel taken
				$elem.css('color','red').html('<span class="mdi mdi-channel-circle"></span>').attr('title', "Channel ID is taken.");
				$field.addClass('warning');
			}
			else {
				// channel is valid and available!
				$elem.css('color','green').html('<span class="mdi mdi-check-circle"></span>').attr('title', "Channel ID is available!");
				$field.removeClass('warning');
			}
		}
		else if (id.length) {
			// bad id
			$elem.css('color','red').html('<span class="mdi mdi-channel-decagram"></span>').attr('title', "Channel ID is malformed.");
			$field.addClass('warning');
		}
		else {
			// empty
			$elem.html('').removeAttr('title');
			$field.removeClass('warning');
		}
	}
	
	onDataUpdate(key, data) {
		// refresh list if channels were updated
		if ((key == 'channels') && (this.args.sub == 'list')) this.gosub_list(this.args);
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.cleanupRevHistory();
		this.div.html( '' );
		return true;
	}
	
};
