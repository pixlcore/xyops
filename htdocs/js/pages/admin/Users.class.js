// Admin Page -- Users

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Users = class Users extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		if (!this.requireAnyPrivilege('admin')) return true;
		
		if (!args) args = {};
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// list all users
		app.setWindowTitle( "Users" );
		app.setHeaderTitle( '<i class="mdi mdi-account-supervisor">&nbsp;</i>Users' );
		
		// show user list
		this.loading();
		if (!args.offset) args.offset = 0;
		if (!args.limit) args.limit = 25;
		app.api.post( 'user/admin_get_users', copy_object(args), this.receive_users.bind(this) );
	}
	
	receive_users(resp) {
		// receive page of users from server, render it
		this.lastUsersResp = resp;
		var html = '';
		
		this.users = [];
		if (resp.rows) this.users = resp.rows;
		
		if (!this.active) return; // sanity
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['Full Name', 'Username', 'Email Address', 'Status', 'Type', 'Created', 'Actions'];
		
		html += '<div class="box">';
		
		html += '<div class="box_title">';
			html += 'User Accounts';
			html += '<div class="box_title_widget" style="overflow:visible"><i class="mdi mdi-magnify" onClick="$(\'#fe_ul_search\').focus()">&nbsp;</i><input type="text" id="fe_ul_search" placeholder="Find user..."/></div>';
			html += '<div class="clear"></div>';
		html += '</div>';
		
		html += '<div class="box_content table">';
		
		var self = this;
		html += this.getPaginatedGrid( resp, cols, 'user', function(user, idx) {
			var actions = [
				'<span class="link" onClick="$P().edit_user('+idx+')"><b>Edit</b></span>',
				'<span class="link danger" onClick="$P().delete_user('+idx+')"><b>Delete</b></span>'
			];
			
			return [
				'<b>' + self.getNiceUser(user, true) + '</b>',
				'<span class="mono" data-private>' + user.username + '</span>',
				'<a href="mailto:'+user.email+'" data-private>'+user.email+'</a>',
				user.active ? '<span class="color_label green"><i class="mdi mdi-check-circle">&nbsp;</i>Active</span>' : '<span class="color_label red"><i class="mdi mdi-alert-circle">&nbsp;</i>Suspended</span>',
				user.privileges.admin ? '<span class="color_label purple"><i class="mdi mdi-lock">&nbsp;</i>Admin</span>' : '<span class="color_label gray">Standard</span>',
				'<span title="'+self.getNiceDateTimeText(user.created)+'">'+self.getNiceDate(user.created)+'</span>',
				actions.join(' | ')
			];
		} );
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button secondary phone_collapse" onClick="$P().go_history()"><i class="mdi mdi-history">&nbsp;</i><span>Revision History...</span></div>';
			html += '<div class="button default" onClick="$P().edit_user(-1)"><i class="mdi mdi-account-plus">&nbsp;</i><span>New User...</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.setupBoxButtonFloater();
		
		setTimeout( function() {
			$('#fe_ul_search').keypress( function(event) {
				if (event.keyCode == '13') { // enter key
					event.preventDefault();
					$P().do_user_search( $('#fe_ul_search').val() );
				}
			} )
			.blur( function() { app.hideMessage(250); } )
			.keydown( function() { app.hideMessage(); } );
		}, 1 );
	}
	
	do_user_search(text) {
		// see if user exists, edit if so
		// exact username
		var self = this;
		app.clearError();
		
		app.api.post( 'user/admin_get_user', { username: text }, 
			function(resp) {
				if (!self.active) return; // sanity
				Nav.go('Users?sub=edit&username=' + text);
			},
			function(resp) {
				app.doError("User not found: " + text);
			}
		);
	}
	
	edit_user(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Users?sub=edit&username=' + this.users[idx].username );
		else Nav.go( '#Users?sub=new' );
	}
	
	delete_user(idx) {
		// delete user from search results
		this.user = this.users[idx];
		this.show_delete_account_dialog();
	}
	
	go_history() {
		Nav.go( '#ActivityLog?action=users' );
	}
	
	gosub_new(args) {
		// create new user
		var html = '';
		app.setWindowTitle( "New User" );
		
		app.setHeaderNav([
			{ icon: 'account-supervisor', loc: '#Users?sub=list', title: 'Users' },
			{ icon: 'account-plus', title: "New User" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Add New User';
			html += '<div class="box_subtitle"><a href="#Users?sub=list">&laquo; Back to User List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.user = { 
			active: 1,
			privileges: copy_object( config.default_user_privileges )
		};
		
		html += this.get_user_edit_html();
		
		// notify user
		html += this.getFormRow({
			label: 'Notify:',
			content: this.getFormCheckbox({
				id: 'fe_eu_send_email',
				checked: true,
				label: "Send Welcome Email"
			}),
			caption: 'Select notification options for the new user.'
		});
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button phone_collapse" onClick="$P().cancel_user_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			if (config.debug) html += '<div class="button phone_collapse" onClick="$P().populate_random_user()"><i class="mdi mdi-dice-5">&nbsp;</i><span>Randomize...</span></div>';
			html += '<div class="button primary" onClick="$P().do_new_user()"><i class="mdi mdi-floppy">&nbsp;</i><span>Create User</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_eu_status') );
		MultiSelect.init( this.div.find('select[multiple]') );
		$('#fe_eu_username').focus();
		this.setupBoxButtonFloater();
	}
	
	cancel_user_edit() {
		// cancel editing user and return to list
		Nav.go( 'Users?sub=list' );
	}
	
	populate_random_user() {
		// grab random user data (for testing only)
		var self = this;
		
		$.ajax({
			url: 'https://api.randomuser.me/',
			dataType: 'json',
			success: function(data){
				// console.log(data);
				if (data.results && data.results[0] && data.results[0]) {
					var user = data.results[0];
					$('#fe_eu_username').val( user.login.username );
					$('#fe_eu_email').val( user.email );
					$('#fe_eu_fullname').val( ucfirst(user.name.first) + ' ' + ucfirst(user.name.last) );
					$('#fe_eu_send_email').prop( 'checked', false );
					self.generate_password();
					self.checkUserExists( $('#fe_eu_username')[0] );
				}
			}
		});
	}
	
	do_new_user() {
		// create new user
		app.clearError();
		var user = this.get_user_form_json();
		if (!user) return; // error
		
		if (!user.username.length) {
			return app.badField('#fe_eu_username', "Please enter a username for the new account.");
		}
		if (!user.username.match(/^[\w\-\.]+$/)) {
			return app.badField('#fe_eu_username', "Please make sure the username contains only alphanumerics, periods and dashes.");
		}
		if (!user.email.length) {
			return app.badField('#fe_eu_email', "Please enter an e-mail address where the user can be reached.");
		}
		if (!user.email.match(/^\S+\@\S+$/)) {
			return app.badField('#fe_eu_email', "The e-mail address you entered does not appear to be correct.");
		}
		if (!user.full_name.length) {
			return app.badField('#fe_eu_fullname', "Please enter the user's first and last names.");
		}
		if (!user.password.length) {
			return app.badField('#fe_eu_password', "Please enter a secure password to protect the account.");
		}
		
		user.send_email = $('#fe_eu_send_email').is(':checked') ? 1 : 0;
		
		this.user = user;
		
		Dialog.showProgress( 1.0, "Creating user..." );
		app.api.post( 'user/admin_create', user, this.new_user_finish.bind(this) );
	}
	
	new_user_finish(resp) {
		// new user created successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		// Nav.go('Users?sub=edit&username=' + this.user.username);
		Nav.go( 'Users?sub=list' );
		
		app.showMessage('success', "The new user account was created successfully.");
	}
	
	gosub_edit(args) {
		// edit user subpage
		this.loading();
		
		// setup upload system
		ZeroUpload.setURL( '/api/app/admin_upload_avatar' );
		ZeroUpload.setMaxFiles( 1 );
		ZeroUpload.setMaxBytes( 1 * 1024 * 1024 ); // 1 MB
		ZeroUpload.setFileTypes( "image/jpeg", "image/png", "image/gif" );
		ZeroUpload.on('start', this.upload_start.bind(this) );
		ZeroUpload.on('progress', this.upload_progress.bind(this) );
		ZeroUpload.on('complete', this.upload_complete.bind(this) );
		ZeroUpload.on('error', this.upload_error.bind(this) );
		ZeroUpload.init();
		
		app.api.post( 'user/admin_get_user', { username: args.username }, this.receive_user.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_user(resp) {
		// edit existing user
		var html = '';
		if (!this.active) return; // sanity
		
		this.user = resp.user;
		
		app.setWindowTitle( "Editing User \"" + (this.args.username) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'account-supervisor', loc: '#Users?sub=list', title: 'Users' },
			{ icon: this.user.icon || 'account', title: this.user.full_name || this.user.username }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit User Details';
			html += '<div class="box_subtitle"><a href="#Users?sub=list">&laquo; Back to User List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_user_edit_html();
		
		// reset lockout
		html += this.getFormRow({
			label: 'Restore:',
			content: this.getFormCheckbox({
				id: 'fe_eu_unlock',
				label: 'Reset Lockouts',
				checked: false
			}),
			caption: 'Check this box to reset any lockouts on the account (too many incorrect password attempts).'
		});
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button cancel mobile_collapse" onClick="$P().cancel_user_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Close</span></div>';
			html += '<div class="button danger mobile_collapse" onClick="$P().show_delete_account_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>';
			html += '<div class="button danger mobile_collapse" onClick="$P().logout_all()"><i class="mdi mdi-power-standby">&nbsp;</i>Logout...</div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
			html += '<div class="button save phone_collapse" onClick="$P().do_save_user()"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Changes</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_eu_status') );
		MultiSelect.init( this.div.find('select[multiple]') );
		$('#fe_eu_username').attr('disabled', true);
		this.setupBoxButtonFloater();
		this.setupEditTriggers();
	}
	
	go_edit_history() {
		Nav.go( '#ActivityLog?action=users&query=' + this.user.username );
	}
	
	upload_avatar() {
		// upload profile pic using ZeroUpload
		ZeroUpload.chooseFiles({}, {
			username: this.user.username
		});
	}
	
	upload_start(files, userData) {
		// avatar upload has started
		Dialog.showProgress( 0.0, "Uploading image..." );
		Debug.trace('avatar', "Upload started");
	}
	
	upload_progress(progress) {
		// avatar is on its way
		Dialog.showProgress( progress.amount );
		Debug.trace('avatar', "Upload progress: " + progress.pct);
	}
	
	upload_complete(response, userData) {
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
		
		var avatar_url = '/api/app/avatar/' + this.user.username + '.png?size=128&random=' + Math.random();
		$('#d_eu_image').css( 'background-image', 'url(' + avatar_url + ')' );
		
		this.triggerEditChange();
	}
	
	upload_error(type, message, userData) {
		// avatar upload error
		Dialog.hideProgress();
		app.doError("Image Upload Failed: " + message);
	}
	
	delete_avatar() {
		// delete user avatar
		var self = this;
		
		app.api.post( 'app/admin_delete_avatar', {
			username: this.user.username
		}, 
		function(resp) {
			// finished deleting
			if (!self.active) return; // sanity
			
			var avatar_url = '/api/app/avatar/' + self.user.username + '.png?size=128&random=' + Math.random();
			$('#d_eu_image').css( 'background-image', 'url(' + avatar_url + ')' );
			
			self.triggerEditChange();
		} );
	}
	
	do_save_user() {
		// save changes to user
		app.clearError();
		var user = this.get_user_form_json();
		if (!user) return; // error
		
		// if changing password, give server a hint
		if (user.password) {
			user.new_password = user.password;
			delete user.password;
		}
		
		// optional lockout reset
		if ($('#fe_eu_unlock').is(':checked')) user.unlock = true;
		
		this.user = user;
		Dialog.showProgress( 1.0, "Saving user account..." );
		
		app.api.post( 'user/admin_update', this.user, this.save_user_finish.bind(this) );
	}
	
	save_user_finish(resp) {
		// user saved successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		// Nav.go( 'Users?sub=list' );
		this.triggerSaveComplete();
		app.showMessage('success', "The user was saved successfully.");
		
		// if we edited ourself, update header
		if (this.args.username == app.username) {
			app.user = resp.user;
			app.updateHeaderInfo();
		}
	}
	
	show_delete_account_dialog() {
		// show dialog confirming account delete action
		var self = this;
		var msg = "Are you sure you want to <b>permanently delete</b> the user account &ldquo;" + this.user.username + "&rdquo;?  There is no way to undo this action, and no way to recover the data.";
		
		Dialog.confirmDanger( 'Delete Account', msg, ['trash-can', 'Delete'], function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Account..." );
				app.api.post( 'user/admin_delete', {
					username: self.user.username
				}, self.delete_user_finish.bind(self) );
			}
		} );
	}
	
	delete_user_finish(resp) {
		// finished deleting, immediately log user out
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Users?sub=list', 'force');
		app.showMessage('success', "The user account &ldquo;" + this.user.username + "&rdquo; was deleted successfully.");
	}
	
	logout_all() {
		// logout all user sessions, after prompt
		var self = this;
		var user = this.user;
		var msg = "Are you sure you want to <b>logout all sessions</b> for the user account &ldquo;" + user.username + "&rdquo;?";
		
		Dialog.confirmDanger( 'Logout All Sessions', msg, ['power-standby', 'Logout All'], function(result) {
			if (!result) return;
			Dialog.showProgress( 1.0, "Logging User Out..." );
			
			app.api.post( 'app/admin_logout_all', { username: user.username }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "User sessions for account &ldquo;" + user.username + "&rdquo; are being logged out in the background.");
			} ); // api.post
		} ); // confirmDanger
	}
	
	get_user_edit_html() {
		// get html for editing a user (or creating a new one)
		var html = '';
		var user = this.user;
		
		// user id
		html += this.getFormRow({
			label: 'Username:',
			content: this.getFormText({
				id: 'fe_eu_username',
				class: 'monospace',
				spellcheck: 'false',
				onChange: '$P().checkUserExists(this)',
				value: user.username,
				'data-private': ''
			}),
			suffix: '<div class="checker"></div>',
			caption: 'Enter the username which identifies this account.  Once entered, it cannot be changed.'
		});
		
		// status
		html += this.getFormRow({
			label: 'Account Status:',
			content: this.getFormMenuSingle({
				id: 'fe_eu_status',
				title: 'Select Status',
				options: [[1,'Active'], [0,'Suspended']],
				value: user.active
			}),
			caption: '&ldquo;Suspended&rdquo; means that the account remains in the system, but the user cannot log in.'
		});
		
		// full name
		html += this.getFormRow({
			label: 'Full Name:',
			content: this.getFormText({
				id: 'fe_eu_fullname',
				spellcheck: 'false',
				value: user.full_name,
				'data-private': ''
			}),
			caption: 'The user\'s first and last names.  This will not be shared with anyone outside the server.'
		});
		
		// email
		html += this.getFormRow({
			label: 'Email Address:',
			content: this.getFormText({
				id: 'fe_eu_email',
				type: 'email',
				spellcheck: 'false',
				autocomplete: 'off',
				value: user.email,
				'data-private': ''
			}),
			caption: 'This can be used to recover the password if the user forgets.  It will not be shared with anyone outside the server.'
		});
		
		// password
		html += this.getFormRow({
			label: user.modified ? 'Change Password:' : 'Password:',
			content: this.getFormText({
				// type: 'password',
				id: 'fe_eu_password',
				spellcheck: 'false',
				value: ''
			}),
			suffix: '<div class="form_suffix_icon mdi mdi-dice-5" title="Generate Random Password" onClick="$P().generate_password()"></div>',
			caption: user.modified ? "Optionally enter a new password here to reset it.  Please make it secure." : "Enter a password for the account.  Please make it secure."
		});
		
		// roles
		html += this.getFormRow({
			label: 'Roles:',
			content: this.getFormMenuMulti({
				id: 'fe_eu_roles',
				title: 'Assign roles to user',
				placeholder: '(None)',
				options: app.roles,
				values: user.roles || [],
				default_icon: 'account-group-outline',
				onChange: '$P().onRoleChange(this)',
				'data-hold': 1
			}),
			caption: 'Assign one or more roles to the user.  These automatically import privileges, which are additive.'
		});
		
		// privilege list
		html += this.getFormRow({
			label: 'Privileges:',
			content: this.getFormMenuMulti({
				id: 'fe_eu_privs',
				title: 'Select Privileges',
				placeholder: 'Click to assign privileges...',
				options: config.ui.privilege_list,
				values: hash_keys_to_array( user.privileges ),
				default_icon: 'card-bulleted-outline',
				onChange: '$P().onPrivChange(this)',
				'data-hold': 1,
				'data-volatile': 1,
				'data-admin_set': user.privileges.admin ? 1 : '',
				'data-inherited': this.getInheritedPrivList(user.roles || []).join(','),
				'data-itooltip': "Inherited from role"
			}),
			caption: 'Select which privileges the user account should have. Administrators have <b>all</b> privileges.'
		});
		
		// category privileges
		html += this.getFormRow({
			label: 'Categories:',
			content: this.getFormMenuMulti({
				id: 'fe_eu_cats',
				title: 'Limit user to categories',
				placeholder: '(All Categories)',
				options: app.categories,
				values: user.categories || [],
				default_icon: 'folder-open-outline',
				'data-hold': 1,
				'data-inherited': this.getInheritedCatList(user.roles || []).join(','),
				'data-itooltip': "Inherited from role"
			}),
			caption: 'Optionally limit the user\'s access to specific categories.  This only applies for non-administrators.'
		});
		
		// group privileges
		html += this.getFormRow({
			label: 'Groups:',
			content: this.getFormMenuMulti({
				id: 'fe_eu_groups',
				title: 'Limit user to server groups',
				placeholder: '(All Groups)',
				options: app.groups,
				values: user.groups || [],
				default_icon: 'server-network',
				'data-hold': 1,
				'data-inherited': this.getInheritedGroupList(user.roles || []).join(','),
				'data-itooltip': "Inherited from role"
			}),
			caption: 'Optionally limit the user\'s access to specific server groups.  This only applies for non-administrators.'
		});
		
		return html;
	}
	
	getInheritedPrivList(roles) {
		// compute inherited privs from role list
		var privs = {};
		
		roles.forEach( function(role_id) {
			var role = find_object( app.roles, { id: role_id } );
			if (!role || !role.enabled) return; // disabled or deleted role
			merge_hash_into( privs, role.privileges );
		} );
		
		return Object.keys(privs);
	}
	
	getInheritedCatList(roles) {
		// compute inherited cats from role list
		var cats = [];
		
		roles.forEach( function(role_id) {
			var role = find_object( app.roles, { id: role_id } );
			if (!role || !role.enabled) return; // disabled or deleted role
			cats = cats.concat( role.categories || [] );
		} );
		
		return [...new Set(cats)]; // remove dupes
	}
	
	getInheritedGroupList(roles) {
		// compute inherited groups from role list
		var cgrps = [];
		
		roles.forEach( function(role_id) {
			var role = find_object( app.roles, { id: role_id } );
			if (!role || !role.enabled) return; // disabled or deleted role
			cgrps = cgrps.concat( role.groups || [] );
		} );
		
		return [...new Set(cgrps)]; // remove dupes
	}
	
	onRoleChange(elem) {
		// roles changed, recalc inherited privs
		var $elem = $(elem);
		var roles = $elem.val();
		
		var priv_list = this.getInheritedPrivList(roles);
		this.div.find('#fe_eu_privs').data('inherited', priv_list.join(',')).trigger('change');
		
		var cat_list = this.getInheritedCatList(roles);
		this.div.find('#fe_eu_cats').data('inherited', cat_list.join(',')).trigger('change');
		
		var cgrp_list = this.getInheritedGroupList(roles);
		this.div.find('#fe_eu_groups').data('inherited', cgrp_list.join(',')).trigger('change');
	}
	
	onPrivChange(elem) {
		// privileges changed, resolve "admin is god" thing here
		var $elem = $(elem);
		var priv_list = $elem.val();
		var is_admin = find_in_array(priv_list, 'admin');
		
		if (is_admin && (priv_list.length > 1)) {
			if ($elem.data('admin_set')) {
				// user tried to add another priv with admin set, so deactivate admin
				var admin = find_object( elem.options, { value: 'admin' } );
				admin.selected = false;
				$elem.trigger('change');
				is_admin = false;
			}
			else {
				// user tried to add admin with other privs, so set admin to be solo
				$elem.val(['admin']).trigger('change');
				is_admin = true;
			}
		}
		
		$elem.data('admin_set', is_admin);
	}
	
	get_user_form_json() {
		// get user elements from form, used for new or edit
		var user = {
			username: trim($('#fe_eu_username').val().toLowerCase()),
			active: parseInt( $('#fe_eu_status').val() ),
			full_name: trim($('#fe_eu_fullname').val()),
			email: trim($('#fe_eu_email').val()),
			password: $('#fe_eu_password').val(),
			roles: $('#fe_eu_roles').val(),
			privileges: array_to_hash_keys( $('#fe_eu_privs').val(), true ),
			categories: $('#fe_eu_cats').val(),
			groups: $('#fe_eu_groups').val()
		};
		return user;
	}
	
	generate_password() {
		// generate random-ish password
		$('#fe_eu_password').val( get_unique_id(8) + '-' + get_unique_id(8) );
	}
	
	onDataUpdate(key, data) {
		// refresh list if groups were updated
		// if ((key == 'users') && (this.args.sub == 'list')) this.gosub_list(this.args);
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
