// User Page -- My Account

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.MyAccount = class MyAccount extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.setWindowTitle('My Account');
		app.setHeaderTitle( '<i class="mdi mdi-account">&nbsp;</i>User Management' );
		app.showSidebar(true);
		
		// setup upload system
		ZeroUpload.setURL( '/api/app/upload_avatar' );
		ZeroUpload.setMaxFiles( 1 );
		ZeroUpload.setMaxBytes( 1 * 1024 * 1024 ); // 1 MB
		ZeroUpload.setFileTypes( "image/jpeg", "image/png", "image/gif" );
		ZeroUpload.on('start', this.uploadStart.bind(this) );
		ZeroUpload.on('progress', this.uploadProgress.bind(this) );
		ZeroUpload.on('complete', this.uploadComplete.bind(this) );
		ZeroUpload.on('error', this.uploadError.bind(this) );
		ZeroUpload.init();
		
		this.receiveUser({ user: app.user });
		return true;
	}
	
	receiveUser(resp) {
		var self = this;
		var user = resp.user;
		
		var html = '';
		html += '<form action="post">';
		
		html += '<div class="box">';
		html += '<div class="box_title">My Account</div>';
		html += '<div class="box_content">';
		
		// user id
		html += this.getFormRow({
			label: 'Username:',
			content: this.getFormText({
				id: 'fe_ma_username',
				class: 'monospace',
				disabled: true,
				autocomplete: 'off',
				value: app.username,
				'data-private': ''
			}),
			caption: 'Your username cannot be changed.'
		});
		
		// sync remote
		if (user.remote) {
			html += this.getFormRow({
				label: 'Remote:',
				content: this.getFormCheckbox({
					id: 'fe_ma_sync',
					label: 'Sync Enabled',
					checked: user.sync
				}),
				caption: 'Your user is managed by a 3rd party authentication system.  Check this box to automatically keep your name, email and avatar in sync on every login.  Uncheck it if you want to customimze them here.'
			});
		}
		
		// full name
		html += this.getFormRow({
			label: 'Display Name:',
			content: this.getFormText({
				id: 'fe_ma_fullname',
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 64,
				value: user.full_name,
				'data-private': ''
			}),
			caption: 'Your first and last names (or a nickname), used for display purposes only.'
		});
		
		// email
		html += this.getFormRow({
			label: 'Email Address:',
			content: this.getFormText({
				id: 'fe_ma_email',
				type: 'email',
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 64,
				value: user.email,
				'data-private': ''
			}),
			caption: 'This is used only to recover your account, and never for marketing.'
		});
		
		if (!user.remote) {
			// current password
			html += this.getFormRow({
				label: 'Current Password:',
				content: this.getFormText({
					type: 'password',
					id: 'fe_ma_old_password',
					spellcheck: 'false',
					autocomplete: 'off',
					maxlength: 256,
					value: ''
				}),
				suffix: app.get_password_toggle_html(),
				caption: "Enter your current account password if you want to change it."
			});
			
			// new password
			html += this.getFormRow({
				label: 'New Password:',
				content: '<div class="button danger" onClick="$P().showNewPasswordField(this)"><i class="mdi mdi-account-key">&nbsp;</i>Change Password...</div><div style="display:none">' + this.getFormText({
					type: 'password',
					id: 'fe_ma_new_password',
					spellcheck: 'false',
					autocomplete: 'off',
					maxlength: 256,
					value: ''
				}) + '</div>',
				suffix: '&nbsp;',
				// suffix: app.get_password_toggle_html(),
				caption: "If you need to change your password, enter the new one here."
			});
		}
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_ma_icon',
				title: 'Select my icon',
				placeholder: 'Select my icon...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: user.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose a custom icon to display alongside your name.'
		});
		
		// avatar
		var ava_html = '';
		ava_html += '<div class="simple_grid_horiz">';
		ava_html += '<div id="d_ma_image" class="avatar_edit" style="background-image:url(' + app.getUserAvatarURL(128, true) + ')" onClick="$P().uploadAvatar()"></div>';
		ava_html += '<div class="button small danger" title="Delete Avatar Image" onClick="$P().deleteAvatar()">&laquo; Delete</div>';
		ava_html += '</div>';
		html += this.getFormRow({
			label: 'Avatar:',
			content: ava_html,
			caption: "Optionally upload a custom avatar image for your user."
		});
		
		// my roles (read-only)
		html += this.getFormRow({
			label: 'My Roles:',
			content: (user.roles || []).map( function(role_id) { 
				return '<div style="margin:5px 0px 5px 0px; color:var(--label-color);"><b>' + self.getNiceRole(role_id, false) + '</b></div>'; 
			} ).join('') || '(None)',
			caption: "The roles currently assigned to your user account."
		});
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button danger" onClick="$P().showDeleteAccountDialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i>Delete Account...</div>';
			html += '<div class="button primary" onClick="$P().saveChanges()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		html += '</form>';
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_ma_icon') );
	}
	
	showNewPasswordField(elem) {
		// hide button, show new password field
		var $elem = $(elem);
		$elem.hide().next().show();
		$elem.closest('.form_row').find('.fr_suffix').html( app.get_password_toggle_html() );
		this.div.find('#fe_ma_new_password').focus();
	}
	
	uploadAvatar() {
		// upload profile pic using ZeroUpload
		ZeroUpload.chooseFiles({}, {});
	}
	
	uploadStart(files, userData) {
		// avatar upload has started
		Dialog.showProgress( 0.0, "Uploading image..." );
		Debug.trace('avatar', "Upload started");
	}
	
	uploadProgress(progress) {
		// avatar is on its way
		Dialog.showProgress( progress.amount );
		Debug.trace('avatar', "Upload progress: " + progress.pct);
	}
	
	uploadComplete(response, userData) {
		// avatar upload has completed
		Dialog.hideProgress();
		Debug.trace('avatar', "Upload complete!", response.data);
		
		var data = null;
		try { data = JSON.parse( response.data ); }
		catch (err) {
			app.doError("Image Upload Failed: JSON Parse Error: " + err);
		}
		
		if (data && (data.code != 0)) {
			app.doError("Image Upload Failed: " + data.description);
		}
		
		app.cacheBust = hires_time_now();
		$('#d_ma_image').css( 'background-image', 'url('+app.getUserAvatarURL(128, true)+')' );
		app.updateHeaderInfo(true);
	}
	
	uploadError(type, message, userData) {
		// avatar upload error
		Dialog.hideProgress();
		app.doError("Image Upload Failed: " + message);
		$('#d_ma_image').css( 'background-image', 'url('+app.getUserAvatarURL(128, true)+')' );
	}
	
	deleteAvatar() {
		// delete user avatar
		var self = this;
		
		app.api.post( 'app/delete_avatar', {
			username: app.username
		}, 
		function(resp) {
			// finished deleting
			if (!self.active) return; // sanity
			$('#d_ma_image').css( 'background-image', 'url('+app.getUserAvatarURL(128, true)+')' );
			app.updateHeaderInfo(true);
		} );
	}
	
	saveChanges() {
		// save changes to user info
		var self = this;
		app.clearError();
		
		var updates = {
			username: app.username,
			full_name: trim($('#fe_ma_fullname').val()),
			email: trim($('#fe_ma_email').val()),
			icon: $('#fe_ma_icon').val()
		};
		
		var old_password = $('#fe_ma_old_password').val();
		var new_password = $('#fe_ma_new_password').val();
		
		if (new_password.length && !old_password.length) {
			return app.badField('#fe_ma_old_password', "Please enter your current account password.");
		}
		if (new_password.length) {
			updates.old_password = old_password;
			updates.new_password = new_password;
		}
		if (app.user.remote) {
			updates.sync = !!$('#fe_ma_sync').is(':checked');
		}
		
		Dialog.showProgress( 1.0, "Saving account..." );
		
		app.api.post( new_password.length ? 'user/update' : 'app/user_settings', updates, function(resp) {
			// save complete
			Dialog.hideProgress();
			app.showMessage('success', "Your account profile was updated successfully.");
			
			$('#fe_ma_old_password').val('');
			$('#fe_ma_new_password').val('');
			
			app.user = resp.user;
			
			// keep pristine copy of user, for applying roles
			app.origUser = deep_copy_object(app.user);
			app.applyUserRoles();
			
			$('#d_ma_image').css( 'background-image', 'url('+app.getUserAvatarURL(128, true)+')' );
		} );
	}
	
	showDeleteAccountDialog() {
		// show dialog confirming account delete action
		var self = this;
		app.clearError();
		
		if (app.user.remote) {
			return app.doError("Sorry, your account is managed by a 3rd party system, so you cannot delete it from here.");
		}
		if (!$('#fe_ma_old_password').val()) {
			return app.badField('#fe_ma_old_password', "Please enter your current account password.");
		}
		
		Dialog.confirmDanger( 'Delete My Account', "Are you sure you want to <b>permanently delete</b> your user account?  There is no way to undo this action, and no way to recover your data.", ['trash-can', "Delete"], function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Account..." );
				app.api.post( 'user/delete', {
					username: app.username,
					password: $('#fe_ma_old_password').val()
				}, 
				function(resp) {
					// finished deleting, immediately log user out
					app.doUserLogout();
				} );
			}
		} );
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
