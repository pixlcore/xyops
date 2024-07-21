// Admin Page -- Activity Log

Page.ActivityLog = class ActivityLog extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		app.setHeaderTitle( '<i class="mdi mdi-script-text-outline">&nbsp;</i>Activity Log' );
		app.setWindowTitle( "Activity Log" );
		
		this.loading();
		
		if (!args.offset) args.offset = 0;
		if (!args.limit) args.limit = 25;
		app.api.post( 'app/get_activity', copy_object(args), this.receive_activity.bind(this) );
		
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
		
		var cols = ['Date/Time', 'Type', 'Description', 'Username', 'IP Address', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'All Activity';
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
			for (var key in app.activity_types) {
				var regexp = new RegExp(key);
				if (item.action.match(regexp)) {
					item_type = app.activity_types[key];
					break;
				}
			}
			
			// compose nice description
			var desc = item.description || '(No description)';
			var actions = [];
			var color = '';
			
			// fudge username
			if (!item.username && item.user && item.user.username) item.username = item.user.username;
			
			switch (item.action) {
				
				// servers
				case 'server_add':
					desc = 'Server connected to the network: <b>' + item.hostname + '</b>';
					actions.push( '<a href="#Server?id=' + item.server_id + '">View Server</a>' );
				break;
				case 'server_delete':
					desc = 'Server disconnected from the network: <b>' + item.hostname + '</b>';
					actions.push( '<a href="#Server?id=' + item.server_id + '">View Server</a>' );
				break;
				
				// groups
				case 'group_create':
					desc = 'New Server Group created: <b>' + item.group.title + '</b>';
					actions.push( '<a href="#Groups?sub=edit&id=' + item.group.id + '">Edit Group</a>' );
				break;
				case 'group_update':
					desc = 'Server Group updated: <b>' + item.group.title + '</b>';
					actions.push( '<a href="#Groups?sub=edit&id=' + item.group.id + '">Edit Group</a>' );
				break;
				case 'group_delete':
					desc = 'Server Group deleted: <b>' + item.group.title + '</b>';
				break;
				case 'group_multi_update':
					desc = 'Server Group sort order changed.';
				break;
				
				// api keys
				case 'apikey_create':
					desc = 'New API Key created: <b>' + item.api_key.title + '</b> (Key: ' + item.api_key.key + ')';
					actions.push( '<a href="#APIKeys?sub=edit&id=' + item.api_key.id + '">Edit Key</a>' );
				break;
				case 'apikey_update':
					desc = 'API Key updated: <b>' + item.api_key.title + '</b> (Key: ' + item.api_key.key + ')';
					actions.push( '<a href="#APIKeys?sub=edit&id=' + item.api_key.id + '">Edit Key</a>' );
				break;
				case 'apikey_delete':
					desc = 'API Key deleted: <b>' + item.api_key.title + '</b> (Key: ' + item.api_key.key + ')';
				break;
				
				// users
				case 'user_create':
					desc = 'New user created: <b>' + item.user.username + "</b> (" + item.user.full_name + ")";
					actions.push( '<a href="#Users?sub=edit&username=' + item.user.username + '">Edit User</a>' );
				break;
				case 'user_update':
					desc = 'User account updated: <b>' + item.user.username + "</b> (" + item.user.full_name + ")";
					actions.push( '<a href="#Users?sub=edit&username=' + item.user.username + '">Edit User</a>' );
				break;
				case 'user_delete':
					desc = 'User account deleted: <b>' + item.user.username + "</b> (" + item.user.full_name + ")";
				break;
				case 'user_login':
					desc = "User logged in: <b>" + item.user.username + "</b> (" + item.user.full_name + ")";
					actions.push( '<a href="#Users?sub=edit&username=' + item.user.username + '">Edit User</a>' );
				break;
				case 'user_password':
					desc = "User password was changed: <b>" + item.user.username + "</b>";
					actions.push( '<a href="#Users?sub=edit&username=' + item.user.username + '">Edit User</a>' );
				break;
				
				// master
				case 'peer_add':
					desc = "Master server added to the network: <b>" + item.host + "</b>";
				break;
				case 'peer_disconnect':
					desc = "Master server disconnected from the network: <b>" + item.host + "</b>";
				break;
				case 'peer_command':
					desc = "Control command <b>" + item.commands.join(' ') + "</b> sent to master server: <b>" + item.host + "</b>";
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
				
			} // action
			
			var tds = [
				'<div class="wrap_mobile">' + self.getNiceDateTimeText( item.epoch ) + '</div>',
				'<div class="td_big" style="white-space:nowrap; font-weight:normal;"><i class="mdi mdi-' + item_type.icon + '">&nbsp;</i>' + item_type.label + '</div>',
				'<div class="activity_desc">' + desc + '</div>',
				'<div style="white-space:nowrap;">' + self.getNiceUser(item, app.isAdmin()) + '</div>',
				(item.ip || 'n/a').replace(/^\:\:ffff\:(\d+\.\d+\.\d+\.\d+)$/, '$1'),
				'<div style="white-space:nowrap;">' + actions.join(' | ') + '</div>'
			];
			if (color) tds.className = color;
			
			return tds;
			
		} ); // getPaginatedGrid
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html( html );
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
