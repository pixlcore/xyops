// Admin Page -- Masters (Peer) Stats

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Masters = class Masters extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		if (!this.requireAnyPrivilege('admin')) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		app.setHeaderTitle( '<i class="mdi mdi-database">&nbsp;</i>Master Servers' );
		app.setWindowTitle( "Master Servers" );
		
		this.render_masters();
		
		return true;
	}
	
	render_masters() {
		// receive master list, render it
		var self = this;
		var html = '';
		
		var rows = [];
		for (var host_id in app.masters) {
			rows.push( app.masters[host_id] );
		}
		
		// sort by ID ascending
		rows.sort( function(a, b) {
			return a.id.toLowerCase().localeCompare( b.id.toLowerCase() );
		} );
		
		// save local copy for actions
		this.masters = rows;
		
		var cols = ['Host ID', 'Status', 'Version', 'Load Avg', 'Ping', 'Uptime', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'All Masters';
		html += '</div>';
		html += '<div class="box_content table">';
		
		html += this.getBasicGrid( rows, cols, 'master', function(item, idx) {
			var actions = [
				'<span class="link" onClick="$P().upgrade_master(' + idx + ')"><b>Upgrade</b></span>',
				'<span class="link" onClick="$P().restart_master(' + idx + ')"><b>Restart</b></span>',
				'<span class="link" onClick="$P().shutdown_master(' + idx + ')"><b>Shutdown</b></span>',
				'<span class="link" onClick="$P().remove_master(' + idx + ')"><b>Remove</b></span>'
			];
			var status = item.online ? (item.master ? '<span class="color_label green"><i class="mdi mdi-check-circle">&nbsp;</i>Master</span>' : '<span class="color_label blue">Online</span>') : '<span class="color_label gray"><i class="mdi mdi-alert-circle">&nbsp;</i>Offline</span>';
			
			if (!item.stats) item.stats = {};
			if (!item.online) {
				item.version = null;
				item.ping = 0;
				item.date = null;
				item.stats = {};
			}
			
			var row = [
				'<div class="td_big">' + self.getNiceMaster(item) + '</div>',
				status,
				'<div style="">v' + (item.version || '-') + '</div>',
				'<div style="">' + (item.stats.load ? short_float(item.stats.load) : '-') + '</div>',
				'<div style="">' + item.ping + ' ms</div>',
				'<div style="">' + (item.date ? get_text_from_seconds( app.epoch - item.date, false, true ) : '-') + '</div>',
				item.online ? actions.join(' | ') : '-'
			];
			if (!item.online) row.className = 'disabled';
			return row;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		// html += '<div class="box_buttons">';
		// 	html += '<div class="button secondary" onClick="$P().edit_api_key(-1)">Add API Key...</div>';
		// html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
	}
	
	do_master_cmd(idx, cmds) {
		// send command to control master server
		var item = this.masters[idx];
		var params = {
			host: item.id,
			commands: cmds
		};
		
		Dialog.confirmDanger( '<span style="">' + ucfirst(cmds[0]) + ' Master Server</span>', "Are you sure you want to " + cmds[0] + " the master server &ldquo;" + item.id + "&rdquo;?", ['alert-decagram', 'Confirm'], function(result) {
			if (result) {
				Dialog.hide();
				app.api.post( 'app/master_command', params, function(resp) {
					app.showMessage('success', "Your request was successfully sent to the target server.");
				} ); // api resp
			}
		} ); // confirm
	}
	
	upgrade_master(idx) {
		this.do_master_cmd(idx, ["upgrade"]);
	}
	
	restart_master(idx) {
		this.do_master_cmd(idx, ["restart"]);
	}
	
	shutdown_master(idx) {
		this.do_master_cmd(idx, ["stop"]);
	}
	
	remove_master(idx) {
		this.do_master_cmd(idx, ["remove"]);
	}
	
	onDataUpdate(key, data) {
		// refresh list if masters were updated
		if (key == 'masters') this.render_masters();
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
