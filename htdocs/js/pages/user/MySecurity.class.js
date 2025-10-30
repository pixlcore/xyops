// User Page -- Security Log

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.MySecurity = class MySecurity extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		app.setHeaderTitle( '<i class="mdi mdi-shield-account">&nbsp;</i>User Security Log' );
		app.setWindowTitle( "User Security Log" );
		
		this.loading();
		
		if (!args.offset) args.offset = 0;
		if (!args.limit) args.limit = 25;
		app.api.post( 'app/get_user_activity', copy_object(args), this.receive_activity.bind(this) );
		
		return true;
	}
	
	receive_activity(resp) {
		// receive page of activity from server, render it
		var self = this;
		var html = '';
		
		if (!this.active) return; // sanity
		
		this.lastActivityResp = resp;
		this.events = [];
		if (resp.rows) this.events = resp.rows;
		
		var cols = ['Date/Time', 'Type', 'Description', 'User Agent', 'IP Address', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Recent User Activity';
			// html += '<div class="box_subtitle" style="font-style:italic; color:var(--label-color);">This shows all your user account related activity, including each time you logged in.  If you see any IP addresses or other events that you do not recognize, it is recommended that you logout all sessions using the button below, and reset your password right afterward.</div>';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var grid_args = {
			resp: resp,
			cols: cols,
			data_type: 'event',
			offset: this.args.offset || 0,
			limit: this.args.limit,
			class: 'data_grid activity_grid',
		};
		
		html += this.getPaginatedGrid( grid_args, function(item, idx) {		
			
			// figure out icon first
			if (!item.action) item.action = 'unknown';
			
			var item_type = '';
			for (var key in config.ui.activity_types) {
				var regexp = new RegExp(key);
				if (item.action.match(regexp)) {
					item_type = config.ui.activity_types[key];
					break;
				}
			}
			
			// compose nice description
			var desc = '';
			var actions = [];
			var color = '';
			
			switch (item.action) {
				
				// users
				case 'user_create':
					desc = 'User created: <b>' + item.user.username + "</b> (" + item.user.full_name + ")";
				break;
				case 'user_update':
					desc = 'User account details updated.';
				break;
				case 'user_login':
					desc = 'User logged in.';
				break;
				case 'user_password':
					desc = 'User password was changed.';
				break;
				
				// misc
				case 'error':
					desc = encode_entities( item.description );
					color = 'red';
				break;
				case 'warning':
					desc = encode_entities( item.description );
					color = 'yellow';
				break;
				case 'notice':
					desc = encode_entities( item.description );
				break;
				
			} // switch action
			
			var tds = [
				'' + self.getNiceDateTimeText( item.epoch ) + '',
				'<div class="td_big" style="white-space:nowrap; font-weight:normal;"><i class="mdi mdi-' + item_type.icon + '">&nbsp;</i>' + item_type.label + '</div>',
				'' + desc + '',
				'' + (item.useragent || 'n/a') + '',
				self.getNiceIP(item.ip),
				'' + (actions.join(' | ') || '-') + ''
			];
			if (color) tds.className = color;
			
			return tds;
			
		} ); // getPaginatedTable
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button danger" onClick="$P().logoutAll()"><i class="mdi mdi-power-standby">&nbsp;</i>Logout All Sessions...</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
	}
	
	logoutAll() {
		// logout all sessions, for security purposes
		var html = '';
		
		html += '<form action="post">';
		html += '<div class="dialog_intro" style="margin-bottom:0">This will <b>logout all sessions</b> associated with your account.  You should only need to do this if you suspect that your account has been compromised.  Your current session will not be affected.  It is highly recommended that you change your password after completing this step.</div>';
		html += '<div class="box_content" style="padding-bottom:15px;">';
		
		html += this.getFormRow({
			label: 'Password:',
			content: this.getFormText({
				id: 'fe_la_password',
				type: 'password',
				spellcheck: 'false',
				autocomplete: 'off'
			}),
			suffix: app.get_password_toggle_html(),
			caption: 'Enter your current account password.'
		});
		
		html += '</div>';
		html += '</form>';
		
		Dialog.confirmDanger( 'Logout Confirmation', html, ['power-standby', 'Confirm'], function(result) {
			if (!result) return;
			var password = $('#fe_la_password').val();
			if (!password) return app.badField('#fe_la_password', "Please enter your current account password.");
			
			Dialog.showProgress( 1.0, "Logging out..." );
			
			app.api.post( 'app/logout_all', { password: password }, function(resp) {
				// processing in background
				Dialog.hideProgress();
				app.showMessage('success', "Your request was successfully enqueued for background processing.");
			} ); // api resp
		} ); // Dialog.confirm
		
		$('#fe_la_password').focus();
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
