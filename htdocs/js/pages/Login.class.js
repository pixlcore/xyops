// User Login Page

// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the PixlCore Sustainable Use License.
// See the LICENSE.md file in this repository.

Page.Login = class Login extends Page.Base {
	
	onInit() {
		// called once at page load
		this.div.addClass('fixed_page');
	}
	
	onActivate(args) {
		// page activation
		$('body').addClass('login');
		
		if (app.user) {
			// user already logged in
			setTimeout( function() { Nav.go(app.navAfterLogin || config.DefaultPage) }, 1 );
			return true;
		}
		else if (args.u && args.h) {
			this.showPasswordResetForm(args);
			return true;
		}
		else if (args.create) {
			this.showCreateAccountForm();
			return true;
		}
		else if (args.recover) {
			this.showRecoverPasswordForm();
			return true;
		}
		
		app.setWindowTitle('Login');
		// app.setHeaderTitle( '<i class="mdi mdi-login">&nbsp;</i>Login' );
		app.setHeaderTitle( '' );
		app.showSidebar(false);
		
		var html = '';
		html += '<form action="post">';
		
		html += '<div class="dialog inline">';
			html += '<div class="dialog_title">User Login</div>';
			html += '<div class="dialog_intro">Enter the username and password associated with your ' + config.name + ' account.</div>';
			html += '<div class="box_content">';
				
				// username
				html += this.getFormRow({
					label: 'Username:',
					content: this.getFormText({
						id: 'fe_login_username',
						class: 'monospace',
						spellcheck: 'false',
						autocomplete: 'username',
						value: app.getPref('username') || ''
					})
				});
				
				// password
				html += this.getFormRow({
					label: 'Password:',
					content: this.getFormText({
						id: 'fe_login_password',
						type: 'password',
						spellcheck: 'false',
						autocomplete: 'current-password'
					}),
					suffix: app.get_password_toggle_html()
				});
				
			html += '</div>';
			
			html += '<div class="dialog_buttons">';
				// if (config.free_accounts) {
				// 	html += '<div class="button" onMouseUp="$P().navCreateAccount()">Create Account...</div>';
				// }
				html += '<div class="button mobile_hide" onMouseUp="$P().cancelCreate()">Cancel</div>';
				html += '<div class="button" onMouseUp="$P().navPasswordRecovery()">Forgot Password...</div>';
				html += '<div class="button primary" onMouseUp="$P().doLogin()"><i class="mdi mdi-key">&nbsp;</i>Login</div>';
			html += '</div>';
		html += '</div>';
		
		html += '</form>';
		this.div.html( html );
		
		setTimeout( function() {
			$( app.getPref('username') ? '#fe_login_password' : '#fe_login_username' ).focus();
			
			 $('#fe_login_username, #fe_login_password').keypress( function(event) {
				if (event.keyCode == '13') { // enter key
					event.preventDefault();
					$P().doLogin();
				}
			} );
			
		}, 1 );
		
		return true;
	}
	
	doLogin() {
		// attempt to log user in
		var username = $('#fe_login_username').val().toLowerCase();
		var password = $('#fe_login_password').val();
		
		if (username && password) {
			Dialog.showProgress(1.0, "Logging in...");
			
			app.api.post( 'user/login', {
				username: username,
				password: password
			}, 
			function(resp) {
				Debug.trace("User Login: " + username);
				
				Dialog.hideProgress();
				app.doUserLogin( resp );
				
				Nav.go( app.navAfterLogin || config.DefaultPage );
			} ); // post
		}
	}
	
	cancelRecover() {
		// return to login page
		app.clearError();
		Nav.go('Login', true);
	}
	
	cancelCreate() {
		// return to home page
		app.clearError();
		Nav.go('Login', true);
	}
	
	navCreateAccount() {
		// nav to create account form
		app.clearError();
		Nav.go('Login?create=1', true);
	}
	
	showCreateAccountForm() {
		// allow user to create a new account
		app.setWindowTitle('Create Account');
		app.showSidebar(false);
		
		var html = '';
		html += '<form action="post">';
		
		html += '<div class="dialog inline wider">';
			html += '<div class="dialog_title">Create Account</div>';
			html += '<div class="dialog_intro">Fill out this form to sign up for ' + config.name + '.</div>';
			html += '<div class="box_content">';
				
				// username
				html += this.getFormRow({
					label: 'Username:',
					content: this.getFormText({
						id: 'fe_ca_username',
						class: 'monospace',
						spellcheck: 'false',
						autocomplete: 'off',
						onChange: '$P().checkUserExists(this)'
					}),
					suffix: '<div class="checker"></div>',
					caption: 'Enter a unique alphanumeric username for your account.'
				});
				
				// password
				html += this.getFormRow({
					label: 'Password:',
					content: this.getFormText({
						id: 'fe_ca_password',
						type: 'password',
						spellcheck: 'false',
						autocomplete: 'new-password'
					}),
					suffix: app.get_password_toggle_html(),
					caption: 'Enter a secure password that you will not forget.'
				});
				
				// full name
				html += this.getFormRow({
					label: 'Display Name:',
					content: this.getFormText({
						id: 'fe_ca_fullname',
						spellcheck: 'false',
						autocomplete: 'name'
					}),
					caption: 'Your name will be used for display purposes only.'
				});
				
				// email
				html += this.getFormRow({
					label: 'Email Address:',
					content: this.getFormText({
						id: 'fe_ca_email',
						spellcheck: 'false',
						autocomplete: 'email',
						onChange: '$P().suggestUsername()'
					}),
					caption: 'We will never send you unsoliticed e-mails.'
				});
				
				html += this.getFormRow({
					label: 'Terms:',
					content: this.getFormCheckbox({
						id: 'fe_ca_terms',
						checked: false,
						label: 'I agree to the terms and conditions.'
					}),
					caption: 'Please read our <a href="/terms" target="_blank">terms of use</a> and <a href="/privacy" target="_blank">privacy policy</a>.'
				});
				
			html += '</div>';
			
			html += '<div class="dialog_buttons">';
				html += '<div class="button" onMouseUp="$P().cancelCreate()">Cancel</div>';
				html += '<div class="button primary" onMouseUp="$P().doCreateAccount()"><i class="mdi mdi-account-plus">&nbsp;</i>Create</div>';
			html += '</div>';
		html += '</div>';
		
		html += '</form>';
		this.div.html( html );
		
		setTimeout( function() {
			$( '#fe_ca_username' ).focus();
		}, 1 );
	}
	
	suggestUsername() {
		// if user hasn't entered a username yet, but has entered an e-mail,
		// suggest a username from first part of e-mail address
		if (!this.div.find('#fe_ca_username').val() && this.div.find('#fe_ca_email').val().match(/^(\w+)/)) {
			var username = RegExp.$1;
			this.div.find('#fe_ca_username').val( username ).trigger('change');
		}
	}
	
	doCreateAccount(force) {
		// actually create account
		if (Dialog.active) return; // prevent double-click
		app.clearError();
		
		var username = trim($('#fe_ca_username').val().toLowerCase());
		var email = trim($('#fe_ca_email').val());
		var full_name = trim($('#fe_ca_fullname').val());
		var password = trim($('#fe_ca_password').val());
		
		if (!username.length) {
			return app.badField('#fe_ca_username', "Please enter a username for your account.");
		}
		if (!username.match(/^[\w\-\.]+$/)) {
			return app.badField('#fe_ca_username', "Please make sure your username contains only alphanumerics, dashes and periods.");
		}
		if (!email.length) {
			return app.badField('#fe_ca_email', "Please enter an e-mail address where you can be reached.");
		}
		if (!email.match(/^\S+\@\S+$/)) {
			return app.badField('#fe_ca_email', "The e-mail address you entered does not appear to be correct.");
		}
		if (!full_name.length) {
			return app.badField('#fe_ca_fullname', "Please enter your first and last names. These are used only for display purposes.");
		}
		if (!password.length) {
			return app.badField('#fe_ca_password', "Please enter a secure password to protect your account.");
		}
		if (!$('#fe_ca_terms').is(':checked')) {
			return app.badField('#fe_ca_terms', "You must accept the terms & conditions to create your account.");
		}
		
		Dialog.hide();
		Dialog.showProgress( 1.0, "Creating account..." );
		
		app.api.post( 'user/create', {
			username: username,
			email: email,
			password: password,
			full_name: full_name
		}, 
		function(resp) {
			Dialog.hideProgress();
			app.showMessage('success', "Account created successfully.");
			
			app.setPref('username', username);
			Nav.go( 'Login', true );
		} ); // api.post
	}
	
	navPasswordRecovery() {
		// nav to recover password form
		app.clearError();
		Nav.go('Login?recover=1', true);
	}
	
	showRecoverPasswordForm() {
		// allow user to recover their password
		app.setWindowTitle('Forgot Password');
		app.showSidebar(false);
		
		var html = '';
		html += '<form action="post">';
		
		html += '<div class="dialog inline">';
			html += '<div class="dialog_title">Forgot Password</div>';
			
			html += '<div class="dialog_intro">Please enter the username and e-mail address associated with your account, and we will send you instructions for resetting your password.</div>';
			
			html += '<div class="box_content">';
				
				// username
				html += this.getFormRow({
					label: 'Username:',
					content: this.getFormText({
						id: 'fe_pr_username',
						class: 'monospace',
						spellcheck: 'false',
						autocomplete: 'off',
						value: app.getPref('username') || ''
					})
				});
				
				// email
				html += this.getFormRow({
					label: 'Email Address:',
					content: this.getFormText({
						id: 'fe_pr_email',
						spellcheck: 'false',
						autocomplete: 'email'
					})
				});
				
			html += '</div>';
			
			html += '<div class="dialog_buttons">';
				html += '<div class="button" onMouseUp="$P().cancelRecover()">Cancel</div>';
				html += '<div class="button primary" onMouseUp="$P().doSendRecoveryEmail()"><i class="mdi mdi-email-outline">&nbsp;</i>Send Email</div>';
			html += '</div>';
		html += '</div>';
		
		html += '</form>';
		this.div.html( html );
		
		setTimeout( function() { 
			$('#fe_pr_username, #fe_pr_email').keypress( function(event) {
				if (event.keyCode == '13') { // enter key
					event.preventDefault();
					$P().doSendEmail();
				}
			} );
			$( '#fe_pr_username' ).focus();
		}, 1 );
	}
	
	doSendRecoveryEmail() {
		// send password recovery e-mail
		app.clearError();
		
		var username = trim($('#fe_pr_username').val()).toLowerCase();
		var email = trim($('#fe_pr_email').val());
		
		if (username.match(/^\w+$/)) {
			if (email.match(/.+\@.+/)) {
				Dialog.hide();
				Dialog.showProgress( 1.0, "Sending e-mail..." );
				
				app.api.post( 'user/forgot_password', {
					username: username,
					email: email
				}, 
				function(resp) {
					Dialog.hideProgress();
					app.showMessage('success', "Password reset instructions sent successfully.");
					Nav.go('Login', true);
				} ); // api.post
				
			} // good address
			else {
				app.badField('#fe_pr_email', "The e-mail address you entered does not appear to be correct.");
			}
		} // good username
		else {
			app.badField('#fe_pr_username', "The username you entered does not appear to be correct.");
		}
	}
	
	showPasswordResetForm(args) {
		// show password reset form
		this.recoveryKey = args.h;
		
		app.setWindowTitle('Reset Password');
		app.showSidebar(false);
		
		var html = '';
		html += '<form action="post">';
		
		html += '<div class="dialog inline">';
			html += '<div class="dialog_title">Reset Password</div>';
			html += '<div class="dialog_intro">Please enter a new password for your account.</div>';
			html += '<div class="box_content">';
				
				// username
				html += this.getFormRow({
					label: 'Username:',
					content: this.getFormText({
						id: 'fe_reset_username',
						class: 'monospace',
						spellcheck: 'false',
						disabled: 'disabled',
						value: args.u
					})
				});
				
				html += this.getFormRow({
					label: 'New Password:',
					content: this.getFormText({
						id: 'fe_reset_password',
						type: 'password',
						spellcheck: 'false',
						autocomplete: 'new-password'
					}),
					suffix: app.get_password_toggle_html()
				});
				
			html += '</div>';
			
			html += '<div class="dialog_buttons">';
				html += '<div class="button" onMouseUp="$P().cancelCreate()">Cancel</div>';
				html += '<div class="button primary" onMouseUp="$P().doResetPassword()"><i class="mdi mdi-key">&nbsp;</i>Reset Password</div>';
			html += '</div>';
		html += '</div>';
		
		html += '</form>';
		this.div.html( html );
		
		setTimeout( function() {
			$( '#fe_reset_password' ).focus();
			$('#fe_reset_password').keypress( function(event) {
				if (event.keyCode == '13') { // enter key
					event.preventDefault();
					$P().doResetPassword();
				}
			} );
		}, 1 );
	}
	
	doResetPassword(force) {
		// reset password now
		var username = $('#fe_reset_username').val().toLowerCase();
		var new_password = $('#fe_reset_password').val();
		var recovery_key = this.recoveryKey;
		
		if (username && new_password) {
			
			Dialog.showProgress( 1.0, "Resetting password..." );
			
			app.api.post( 'user/reset_password', {
				username: username,
				key: recovery_key,
				new_password: new_password
			}, 
			function(resp) {
				Debug.trace("User password was reset: " + username);
				
				Dialog.hideProgress();
				app.setPref('username', username);
				
				Nav.go( 'Login', true );
				
				setTimeout( function() {
					app.showMessage('success', "Your password was reset successfully.");
				}, 100 );
			} ); // post
		}
	}
	
	onDeactivate() {
		// called when page is deactivated
		$('body').removeClass('login');
		this.div.html( '' );
		return true;
	}
	
};
