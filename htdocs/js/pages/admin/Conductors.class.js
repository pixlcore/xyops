// Admin Page -- Conductors (Peer) Stats

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Conductors = class Conductors extends Page.PageUtils {
	
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
		app.setHeaderTitle( '<i class="mdi mdi-database">&nbsp;</i>Conductor Servers' );
		app.setWindowTitle( "Conductor Servers" );
		
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
		
		var cols = ['Host ID', 'Status', 'xyOps', 'Load Avg', 'Ping', 'Uptime', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'All Conductors';
		html += '</div>';
		html += '<div class="box_content table">';
		
		html += this.getBasicGrid( rows, cols, 'conductor', function(item, idx) {
			var actions = [
				// '<button class="link" onClick="$P().upgrade_master(' + idx + ')"><b>Upgrade</b></button>',
				'<button class="link" onClick="$P().restart_master(' + idx + ')"><b>Restart</b></button>',
				'<button class="link" onClick="$P().shutdown_master(' + idx + ')"><b>Shutdown</b></button>',
			];
			var status = item.online ? (item.master ? '<span class="color_label green"><i class="mdi mdi-check-circle">&nbsp;</i>Primary</span>' : '<span class="color_label blue">Online</span>') : '<span class="color_label gray"><i class="mdi mdi-alert-circle">&nbsp;</i>Offline</span>';
			
			if (!item.stats) item.stats = {};
			if (!item.online) {
				item.version = null;
				item.ping = 0;
				item.date = null;
				item.stats = {};
				actions = [
					'<button class="link" onClick="$P().remove_master(' + idx + ')"><b>Remove</b></button>'
				];
			}
			
			var row = [
				'<div class="td_big">' + self.getNiceMaster(item) + '</div>',
				status,
				'<div id="d_ec_ver_' + item.id + '"><i class="mdi mdi-tag-text-outline">&nbsp;</i>v' + (item.version || '-') + '</div>',
				'<div style=""><i class="mdi mdi-chip">&nbsp;</i>' + short_float(item.stats.load || 0) + '</div>',
				'<div style=""><i class="mdi mdi-timer-outline">&nbsp;</i>' + item.ping + ' ms</div>',
				'<div style="">' + (item.date ? self.getNiceUptime( app.epoch - item.date ) : 'n/a') + '</div>',
				actions.join(' | ')
			];
			if (!item.online) row.className = 'disabled';
			return row;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html( html );
		this.addPageDescription();
		this.checkAllVersions();
	}
	
	checkAllVersions() {
		// make sure all versions are up to date, highlight outdated ones in red
		var self = this;
		
		// fetch data if needed
		if (!this.latestMasterVersion) {
			app.api.get( 'app/get_master_releases', {}, function(resp) {
				// releases[0] is always `latest` (unless airgapped), releases[1] is the latest version
				if (resp && resp.releases && resp.releases[1]) {
					self.latestMasterVersion = resp.releases[1];
					self.checkAllVersions();
				}
			});
			return;
		}
		
		var latest_int = get_int_version( this.latestMasterVersion.replace(/^v/, '') );
		
		this.masters.forEach( function(item) {
			// decorate as needed
			if (!item.version || !item.online) return;
			var master_int = get_int_version( item.version );
			if (master_int < latest_int) {
				// outdated!
				self.div.find('#d_ec_ver_' + CSS.escape(item.id)).html(
					'<button class="link danger" style="color:var(--red); font-weight:bold;" data-host="' + item.id + '" onClick="$P().go_nav_upgrade(this)" title="xyOps version is outdated."><i class="mdi mdi-alert-rhombus">&nbsp;</i>v' + item.version + '</span>'
				);
			}
			else {
				self.div.find('#d_ec_ver_' + CSS.escape(item.id)).attr('title', 'xyOps is up to date.').css({ color: 'var(--green)', fontWeight: 'bold' }).html(
					`<i class="mdi mdi-check-circle">&nbsp;</i>v${item.version}</span>`
				);
			}
		} );
	}
	
	go_nav_upgrade(elem) {
		// jump over to system tab and open the upgrade dialog with master pre-selected
		if (!app.isAdmin()) return app.doError("Administrator privileges required to upgrade servers.");
		
		var host_id = $(elem).data('host');
		Nav.go('System?upgrade_master=' + host_id);
	}
	
	do_master_cmd(idx, cmds) {
		// send command to control master server
		var item = this.masters[idx];
		var params = {
			host: item.id,
			commands: cmds
		};
		
		Dialog.confirmDanger( '<span style="">' + ucfirst(cmds[0]) + ' Conductor Server</span>', "Are you sure you want to " + cmds[0] + " the conductor server &ldquo;" + item.id + "&rdquo;?", ['alert-decagram', 'Confirm'], function(result) {
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
