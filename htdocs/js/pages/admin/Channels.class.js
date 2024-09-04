// Admin Page -- Notification Channels Config

Page.Channels = class Channels extends Page.Base {
	
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
		
		var self = this;
		html += this.getBasicGrid( this.channels, cols, 'channel', function(item, idx) {
			var actions = [];
			actions.push( '<span class="link" onMouseUp="$P().edit_channel('+idx+')"><b>Edit</b></span>' );
			actions.push( '<span class="link danger" onMouseUp="$P().delete_channel('+idx+')"><b>Delete</b></span>' );
			
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
			html += '<div class="button secondary" onMouseUp="$P().edit_channel(-1)">Add Channel...</div>';
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
			"web_hook": "",
			"run_event": "",
			"shell_exec": "",
			"notes": ""
		};
		
		html += this.get_channel_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_channel_edit()">Cancel</div>';
			html += '<div class="button primary" onMouseUp="$P().do_new_channel()"><i class="mdi mdi-floppy">&nbsp;</i>Create Channel</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		// MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ech_run_event, #fe_ech_icon, #fe_ech_web_hook') );
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
			html += '<div class="button" onMouseUp="$P().cancel_channel_edit()">Cancel</div>';
			html += '<div class="button danger" onMouseUp="$P().show_delete_channel_dialog()">Delete Channel...</div>';
			html += '<div class="button primary" onMouseUp="$P().do_save_channel()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		// lock ID for editing
		$('#fe_ech_id').attr('disabled', true);
		SingleSelect.init( this.div.find('#fe_ech_run_event, #fe_ech_icon, #fe_ech_web_hook') );
		this.updateAddRemoveMe('#fe_ech_email');
		this.setupBoxButtonFloater();
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
		
		// email
		html += this.getFormRow({
			label: 'Email:',
			content: this.getFormText({
				id: 'fe_ech_email',
				// type: 'email',
				spellcheck: 'false',
				placeholder: 'email@sample.com',
				value: channel.email,
				onChange: '$P().updateAddRemoveMe(this)'
			}),
			suffix: '<div class="form_suffix_icon mdi" title="" onMouseUp="$P().addRemoveMe(this)"></div>',
			caption: 'Optionally add e-mail recipients to be notified for this channel.'
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
		channel.email = $('#fe_ech_email').val();
		channel.web_hook = $('#fe_ech_web_hook').val();
		channel.run_event = $('#fe_ech_run_event').val();
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
		this.div.html( '' );
		return true;
	}
	
};
