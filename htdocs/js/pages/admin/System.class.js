// Admin Page -- System Status and Maintenance

Page.System = class System extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		var self = this;
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		app.setHeaderTitle( '<i class="mdi mdi-desktop-classic">&nbsp;</i>System Status &amp; Maintenance' );
		app.setWindowTitle( "System Status & Maintenance" );
		
		this.loading();
		
		app.api.get( 'app/admin_stats', {}, function(resp) {
			if (!self.active) return; // sanity
			self.render_system(resp);
		});
		
		return true;
	}
	
	render_system(resp) {
		// render system stats and maint buttons
		var self = this;
		var html = '';
		
		this.data = resp.stats;
		
		html += '<div class="dash_grid">';
		html += '</div>';
		
		// html += '<div id="d_sys_stats"></div>';
		
		// internal jobs
		html += '<div class="box" id="d_sys_jobs">';
			html += '<div class="box_title">';
				html += 'Internal System Jobs';
			html += '</div>';
			html += '<div class="box_content table">';
				// html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// websockets
		html += '<div class="box" id="d_sys_sockets">';
			html += '<div class="box_title">';
				html += 'All Connected Users';
			html += '</div>';
			html += '<div class="box_content table">';
				// html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// maint buttons
		html += '<div class="maint_grid">'; // TODO: update help links below:
		
		// import data
		html += '<div class="maint_unit">';
			html += '<div class="button secondary" onClick="$P().prompt_import_data()"><i class="mdi mdi-database-import-outline">&nbsp;</i>Import Data...</div>';
			html += '<div class="caption">Import data from a local archive file on disk.  <a href="#">Learn More</a></div>';
		html += '</div>';
		
		// export data
		html += '<div class="maint_unit">';
			html += '<div class="button secondary" onClick="$P().do_export_data()"><i class="mdi mdi-database-export-outline">&nbsp;</i>Export Data...</div>';
			html += '<div class="caption">Export a custom selection of data and download a compressed archive to disk.  <a href="#">Learn More</a></div>';
		html += '</div>';
		
		// delete data
		html += '<div class="maint_unit">';
			html += '<div class="button danger" onClick="$P().do_delete_data()"><i class="mdi mdi-trash-can-outline">&nbsp;</i>Delete Data...</div>';
			html += '<div class="caption">Permanently delete selected data.  Consider backing it up first!  <a href="#">Learn More</a></div>';
		html += '</div>';
		
		// nightly maint
		html += '<div class="maint_unit">';
			html += '<div class="button secondary" onClick="$P().do_run_maint()"><i class="mdi mdi-database-clock-outline">&nbsp;</i>Run Maintenance...</div>';
			html += '<div class="caption">Run the nightly database maintenance process manually.  <a href="#">Learn More</a></div>';
		html += '</div>';
		
		// vacuum sqlite
		html += '<div class="maint_unit">';
			html += '<div class="button secondary" onClick="$P().do_optimize_db()"><i class="mdi mdi-database-refresh-outline">&nbsp;</i>Optimize Database...</div>';
			html += '<div class="caption">Run database optimization procedure to reduce disk storage.  <a href="#">Learn More</a></div>';
		html += '</div>';
		
		// reset stats
		html += '<div class="maint_unit">';
			html += '<div class="button danger" onClick="$P().do_reset_stats()"><i class="mdi mdi-skip-previous-circle-outline">&nbsp;</i>Reset Daily Stats...</div>';
			html += '<div class="caption">Reset the daily statistic counters displayed on the dashboard.  <a href="#">Learn More</a></div>';
		html += '</div>';
		
		// shutdown server
		html += '<div class="maint_unit">';
			html += '<div class="button danger" onClick="$P().shutdown_master()"><i class="mdi mdi-power">&nbsp;</i>Shutdown Server...</div>';
			html += '<div class="caption">Shutdown the current conductor server (secondary will take over).  <a href="#">Learn More</a></div>';
		html += '</div>';
		
		// restart server
		html += '<div class="maint_unit">';
			html += '<div class="button danger" onClick="$P().restart_master()"><i class="mdi mdi-restart">&nbsp;</i>Restart Server...</div>';
			html += '<div class="caption">Restart the current conductor server (secondary will take over).  <a href="#">Learn More</a></div>';
		html += '</div>';
		
		// upgrade server
		html += '<div class="maint_unit">';
			html += '<div class="button danger" onClick="$P().upgrade_master()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i>Upgrade Server...</div>';
			html += '<div class="caption">Upgrade the current conductor server to the latest stable Orchestra release.  <a href="#">Learn More</a></div>';
		html += '</div>';
		
		html += '</div>'; // maint_grid
		
		this.div.html( html );
		
		this.renderSystemComponents();
		this.renderInternalJobs();
		this.renderWebSockets();
	}
	
	renderStat(key, value) {
		// return HTML elements for stat item
		var html = '';
		html += '<div class="stat_row">';
			html += '<div class="stat_key">' + key + ':</div>';
			html += '<div class="stat_value">' + value + '</div>';
		html += '</div>';
		return html;
	}
	
	renderSystemComponents() {
		// render system components (dash units)
		var data = this.data;
		var stats = app.stats;
		var html = '';
		
		// orch version
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + data.version + '</div>';
			html += '<div class="dash_unit_label">Orchestra Version</div>';
		html += '</div>';
		
		// node version
		// html += '<div class="dash_unit_box">';
		// 	html += '<div class="dash_unit_value">' + data.node.version + '</div>';
		// 	html += '<div class="dash_unit_label">Node.js Version</div>';
		// html += '</div>';
		
		// process mem
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + get_text_from_bytes(stats.mem, 1) + '</div>';
			html += '<div class="dash_unit_label">Process Mem</div>';
		html += '</div>';
		
		// process cpu (or load?)
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + Math.round(stats.cpu) + '%</div>';
			html += '<div class="dash_unit_label">Process CPU</div>';
		html += '</div>';
		
		// process uptime
		// var uptime_sec = app.stats.started ? (time_now() - app.stats.started) : 0;
		// html += '<div class="dash_unit_box">';
		// 	html += '<div class="dash_unit_value">' + get_text_from_seconds_round(uptime_sec, true) + '</div>';
		// 	html += '<div class="dash_unit_label">Uptime</div>';
		// html += '</div>';
		
		// storage cache objects
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + (data.cache ? commify(data.cache.count) : 'n/a') + '</div>';
			html += '<div class="dash_unit_label">Cache Objects</div>';
		html += '</div>';
		
		// storage cache mem
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + (data.cache ? get_text_from_bytes(data.cache.bytes, 1) : 'n/a') + '</div>';
			html += '<div class="dash_unit_label">Cache Memory</div>';
		html += '</div>';
		
		// cache full
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + (data.cache ? data.cache.full : 'n/a') + '</div>';
			html += '<div class="dash_unit_label">Cache Utilization</div>';
		html += '</div>';
		
		// sqlite db file size
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + (data.db.sqlite ? get_text_from_bytes(data.db.sqlite, 1) : 'n/a') + '</div>';
			html += '<div class="dash_unit_label">DB Index Disk Size</div>';
		html += '</div>';
		
		// jobs table row count
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + commify(data.db.records.jobs || 0) + '</div>';
			html += '<div class="dash_unit_label">Job DB Rows</div>';
		html += '</div>';
		
		// servers table row count
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + commify(data.db.records.servers || 0) + '</div>';
			html += '<div class="dash_unit_label">Server DB Rows</div>';
		html += '</div>';
		
		// snapshots table row count
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + commify(data.db.records.snapshots || 0) + '</div>';
			html += '<div class="dash_unit_label">Snapshot DB Rows</div>';
		html += '</div>';
		
		// alerts table row count
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + commify(data.db.records.alerts || 0) + '</div>';
			html += '<div class="dash_unit_label">Alert DB Rows</div>';
		html += '</div>';
		
		// activity table row count
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + commify(data.db.records.activity || 0) + '</div>';
			html += '<div class="dash_unit_label">Activity DB Rows</div>';
		html += '</div>';
		
		this.div.find('.dash_grid').html( html );
	}
	
	renderInternalJobs() {
		// render all active internal jobs (heavy)
		// - Std Props: id, title, type, started, progress, username?
		var self = this;
		var html = '';
		var cols = ['Job ID', 'Title', 'Type', 'Username', 'Progress', 'Elapsed', 'Remaining' ];
		
		var rows = Object.values(app.internalJobs).sort( function(a, b) {
			return (a.started < b.started) ? 1 : -1;
		} );
		
		var opts = {
			rows: rows,
			cols: cols,
			data_type: 'job',
			attribs: {
				class: 'data_grid sys_job_grid'
			}
		};
		
		html += this.getBasicGrid( opts, function(job, idx) {
			return [
				'<span class="monospace">' + job.id + '</span>',
				'<b>' + job.title + '</b>',
				
				self.getNiceInternalJobType(job.type),
				self.getNiceUser(job.username),
				
				'<div id="d_sys_job_progress_' + job.id + '">' + self.getNiceJobProgressBar(job) + '</div>',
				'<div id="d_sys_job_elapsed_' + job.id + '">' + self.getNiceJobElapsedTime(job, false, true) + '</div>',
				'<div id="d_sys_job_remaining_' + job.id + '">' + self.getNiceJobRemainingTime(job, false) + '</div>'
			];
		} );
		
		this.div.find('#d_sys_jobs > .box_content').removeClass('loading').html(html);
	}
	
	updateInternalJobs() {
		// update existing internal jobs (light)
		var self = this;
		var div = this.div;
		var bar_width = this.bar_width || 100;
		var jobs = Object.values(app.internalJobs);
		
		jobs.forEach( function(job) {
			div.find('#d_sys_job_elapsed_' + job.id).html( self.getNiceJobElapsedTime(job, false, true) );
			div.find('#d_sys_job_remaining_' + job.id).html( self.getNiceJobRemainingTime(job, false) );
			
			// update progress bar without redrawing it (so animation doesn't jitter)
			var counter = job.progress || 1;
			var cx = Math.floor( counter * bar_width );
			var label = '' + Math.floor( (counter / 1.0) * 100 ) + '%';
			var $cont = div.find('#d_sys_job_progress_' + job.id + ' > div.progress_bar_container');
			
			if ((counter == 1.0) && !$cont.hasClass('indeterminate')) {
				$cont.addClass('indeterminate').attr('title', "");
			}
			else if ((counter < 1.0) && $cont.hasClass('indeterminate')) {
				$cont.removeClass('indeterminate');
			}
			
			if (counter < 1.0) $cont.attr('title', '' + Math.floor( (counter / 1.0) * 100 ) + '%');
			
			$cont.find('> div.progress_bar_inner').css( 'width', '' + cx + 'px' );
			$cont.find('div.progress_bar_label').html( label );
		} ); // foreach job
	}
	
	renderWebSockets() {
		// render table of active web sockets
		// socket: id, ip, type, auth, username, loc, server, timeStart, ping
		var self = this;
		var sockets = this.data.sockets;
		var html = '';
		var cols = [ 'Username', 'Socket ID', 'IP Address', 'Location', 'Duration', 'Ping' ];
		
		var rows = Object.values(sockets).filter( function(socket) { return socket.type == 'user'; } ).sort( function(a, b) {
			return (a.timeStart < b.timeStart) ? 1 : -1;
		} );
		
		var opts = {
			rows: rows,
			cols: cols,
			data_type: 'connection',
			attribs: {
				class: 'data_grid sys_ws_grid'
			}
		};
		
		html += this.getBasicGrid( opts, function(socket, idx) {
			return [
				self.getNiceUser(socket.username, true),
				'<span class="monospace">' + socket.id + '</span>',
				'<span>' + socket.ip + '</span>',
				socket.loc ? ('<a href="#' + socket.loc.loc + '">#' + socket.loc.loc + '</a>') : 'n/a',
				get_text_from_seconds(app.epoch - socket.timeStart, true, true),
				socket.ping + ' ms'
			];
		} );
		
		this.div.find('#d_sys_sockets > .box_content').removeClass('loading').html(html);
	}
	
	prompt_import_data() {
		// prompt user with instructions and warnings
		var self = this;
		var html = "Use this feature to import bulk data into Orchestra by providing a file from your local machine.  The file should have been generated from a previous export.  <br><br> <b>Note:</b> It is highly recommended that you stop all running jobs when importing data.  Also note that the scheduler will automatically be paused if it is active.";
		
		Dialog.confirm( 'Import Data', html, 'Choose File...', function(result) {
			if (!result) return;
			
			var $file = $('<input type="file" style="display:none">');
			
			$file.appendTo('body');
			$file.on('change', function() {
				if (this.files && this.files.length) self.do_import_data(this.files[0]);
				$file.remove();
			});
			$file.get(0).click();
		} ); // confirm
	}
	
	do_import_data(file) {
		// perform the upload given selected file from prompt
		var self = this;
		Dialog.hide();
		Dialog.showProgress( 1.0, "Uploading File..." );
		
		// upload file now
		var form = new FormData();
		form.append('file1', file);
		
		var opts = {
			method: 'POST', 
			body: form,
			timeout: 300 * 1000 // 5 minutes
		};
		
		app.api.request( app.base_api_url + '/app/admin_import_data', opts, function(resp) {
			Dialog.hideProgress();
			app.showMessage('success', "Your import job has started in the background.");
		} );
	}
	
	do_export_data() {
		// select which data to export
		var self = this;
		var html = '<div class="dialog_box_content maximize" style="max-height:75vh; overflow-x:hidden; overflow-y:auto;">';
		
		html += this.getFormRow({
			id: 'd_sys_ex_lists',
			label: 'Storage Lists:',
			content: this.getFormMenuMulti({
				id: 'fe_sys_ex_lists',
				title: 'Select Lists',
				placeholder: '(None)',
				options: config.list_list,
				values: config.list_list.map( function(item) { return item.id; } ),
				'data-hold': 1,
				'data-shrinkwrap': 1,
				'data-select-all': 1
				// 'data-compact': 1
			}),
			caption: "Choose which storage lists to include in your export.  These are typically small and will export relatively fast."
		});
		
		html += this.getFormRow({
			id: 'd_sys_ex_dbs',
			label: 'Database Tables:',
			content: this.getFormMenuMulti({
				id: 'fe_sys_ex_dbs',
				title: 'Select Tables',
				placeholder: '(None)',
				options: config.database_list,
				values: [],
				'data-hold': 1,
				'data-shrinkwrap': 1,
				'data-select-all': 1
				// 'data-compact': 1
			}),
			caption: "Choose which database tables to include in your export.  These are generally much larger and will take longer to export."
		});
		
		html += this.getFormRow({
			id: 'd_sys_ex_extras',
			label: 'Extras:',
			content: this.getFormMenuMulti({
				id: 'fe_sys_ex_extras',
				title: 'Select Extras',
				placeholder: '(None)',
				options: [
					{ id: 'job_files', title: "Job Files", icon: 'file-image-outline' },
					{ id: 'job_logs', title: "Job Logs", icon: 'file-document-outline' },
					{ id: 'monitor_data', title: "Monitor History", icon: 'chart-timeline' },
					{ id: 'user_avatars', title: 'User Avatars', icon: 'account-circle' }
				],
				values: [],
				'data-hold': 1,
				'data-shrinkwrap': 1,
				'data-select-all': 1
				// 'data-compact': 1
			}),
			caption: "Choose optional extras to include in your export.  These are also generally quite large.  Note that job logs / files are only included if they are 1 MB or smaller."
		});
		
		html += '</div>';
		Dialog.confirm( "Export Data", html, "Export Now", function(result) {
			if (!result) return;
			app.clearError();
			
			// prepare request
			var items = [];
			var lists = $('#fe_sys_ex_lists').val();
			var dbs = $('#fe_sys_ex_dbs').val();
			var extras = $('#fe_sys_ex_extras').val();
			
			lists.forEach( function(list) {
				items.push({ type: 'list', key: 'global/' + list });
			} );
			
			dbs.forEach( function(db) {
				items.push({ type: 'index', index: db });
			} );
			
			if (lists.includes('users')) {
				items.push({ type: 'users', avatars: extras.includes('user_avatars') });
			}
			if (extras.includes('job_files') || extras.includes('job_logs')) {
				items.push({ type: 'jobFiles', logs: extras.includes('job_logs'), files: extras.includes('job_files') });
			}
			if (extras.includes('monitor_data')) {
				items.push({ type: 'monitorData' });
			}
			
			if (!items.length) return app.doError("Please select at least one item to export.");
			Dialog.hide();
			
			// fetch transfer token
			app.api.post( 'app/get_transfer_token', { items }, function(resp) {
				window.location = app.base_api_url + '/app/admin_export_data?token=' + resp.token;
			}); // api.post
		});
		
		MultiSelect.init( $('#fe_sys_ex_lists, #fe_sys_ex_dbs, #fe_sys_ex_extras') );
		Dialog.autoResize();
	}
	
	do_delete_data() {
		// delete selected data
		var self = this;
		var html = '<div class="dialog_box_content maximize" style="max-height:75vh; overflow-x:hidden; overflow-y:auto;">';
		
		html += this.getFormRow({
			id: 'd_sys_ex_lists',
			label: 'Storage Lists:',
			content: this.getFormMenuMulti({
				id: 'fe_sys_ex_lists',
				title: 'Select Lists',
				placeholder: '(None)',
				options: config.list_list,
				values: [],
				'data-hold': 1,
				'data-shrinkwrap': 1,
				'data-select-all': 1
				// 'data-compact': 1
			}),
			caption: "Choose which storage lists to delete.  These are typically small and will go relatively fast."
		});
		
		html += this.getFormRow({
			id: 'd_sys_ex_dbs',
			label: 'Database Tables:',
			content: this.getFormMenuMulti({
				id: 'fe_sys_ex_dbs',
				title: 'Select Tables',
				placeholder: '(None)',
				options: config.database_list,
				values: [],
				'data-hold': 1,
				'data-shrinkwrap': 1,
				'data-select-all': 1
				// 'data-compact': 1
			}),
			caption: "Choose which database tables to delete.  These are generally much larger and will take longer to go."
		});
		
		html += '</div>';
		Dialog.confirmDanger( "Delete Data", html, "Delete Now", function(result) {
			if (!result) return;
			app.clearError();
			
			// prepare request
			var items = [];
			var lists = $('#fe_sys_ex_lists').val();
			var dbs = $('#fe_sys_ex_dbs').val();
			
			if (lists.includes('users')) {
				items.push({ type: 'users' });
			}
			
			lists.forEach( function(list) {
				items.push({ type: 'list', key: 'global/' + list });
			} );
			
			dbs.forEach( function(db) {
				items.push({ type: 'index', index: db });
			} );
			
			if (!items.length) return app.doError("Please select at least one item to delete.");
			
			// prompt the user one last time to super-confirm the delete
			var final_opts = {
				elem: '#btn_dialog_confirm',
				title: "Type &ldquo;delete&rdquo; to confirm",
				danger: true,
				icon: 'trash-can-outline',
				confirm: 'Confirm',
				trim: true,
				lower: true,
				validate: /^delete$/,
				
				callback: function(value) {
					if (value !== 'delete') return;
					Dialog.hide();
					
					// start the job
					app.api.post( 'app/admin_delete_data', { items }, function(resp) {
						app.showMessage('success', "Your delete job has started in the background.");
					}); // api.post
				}
			};
			
			TextSelect.popupQuickMenu(final_opts);
		});
		
		MultiSelect.init( $('#fe_sys_ex_lists, #fe_sys_ex_dbs') );
		Dialog.autoResize();
	}
	
	do_run_maint() {
		// run daily maintenance manually
		var self = this;
		var html = "This runs the nightly database maintenance process manually.  The maintenance job deletes old data that has expired, and optionally backs up the database if configured.  This will run multiple internal jobs in sequence.";
		
		Dialog.confirm( 'Run Maintenance', html, 'Run Now', function(result) {
			if (!result) return;
			Dialog.hide();
			
			app.api.post( 'app/admin_run_maintenance', {}, function(resp) {
				app.showMessage('success', "Your maintenance job has started in the background.");
			}); // api.post
		} ); // confirm
	}
	
	do_optimize_db() {
		// optimize database manually (sqlite)
		var self = this;
		var html = "This optimizes the local database (SQLite engine only), by running a 'VACUUM' command.  You should only need this if you delete a large amount of data and need to reclaim unused space.<br><br>Please note that the database will be locked while the vacuum is running, so it is highly recommended that you stop all jobs and pause the scheduler before optimizing.";
		
		Dialog.confirm( 'Optimize Database', html, 'Optimize Now', function(result) {
			if (!result) return;
			Dialog.hide();
			
			app.api.post( 'app/admin_run_optimization', {}, function(resp) {
				app.showMessage('success', "Your optimization job has started in the background.");
			}); // api.post
		} ); // confirm
	}
	
	do_reset_stats() {
		// reset daily stats
		var self = this;
		var html = "This resets the daily statistics that are displayed on the Dashboard page.  Normally these are reset daily at midnight (local server time), but you can reset them manually if required.";
		
		Dialog.confirm( 'Reset Daily Stats', html, 'Reset Now', function(result) {
			if (!result) return;
			Dialog.hide();
			
			app.api.post( 'app/admin_reset_daily_stats', {}, function(resp) {
				app.showMessage('success', "The daily statistics have been reset.");
			}); // api.post
		} ); // confirm
	}
	
	do_test_job() {
		// start test job (60s)
		app.api.post( 'app/test_internal_job', {}, function(resp) {
			app.showMessage('success', "Your test job was successfully started.");
		} ); // api resp
	}
	
	do_master_cmd(cmds) {
		// send command to control master server
		var item = find_object( Object.values(app.masters), { online: true, master: true } );
		if (!item) return; // sanity
		
		var params = {
			host: item.id,
			commands: cmds
		};
		
		Dialog.confirmDanger( '<span style="">' + ucfirst(cmds[0]) + ' Conductor</span>', "Are you sure you want to " + cmds[0] + " the conductor server &ldquo;" + item.id + "&rdquo;?", 'Confirm', function(result) {
			if (result) {
				Dialog.hide();
				app.api.post( 'app/master_command', params, function(resp) {
					app.showMessage('success', "Your request was successfully sent to the target server.");
				} ); // api resp
			}
		} ); // confirm
	}
	
	upgrade_master() {
		this.do_master_cmd(["upgrade"]);
	}
	
	restart_master() {
		this.do_master_cmd(["restart"]);
	}
	
	shutdown_master() {
		this.do_master_cmd(["stop"]);
	}
	
	remove_master() {
		this.do_master_cmd(["remove"]);
	}
	
	refreshData() {
		// refresh stats every minute
		var self = this;
		
		app.api.get( 'app/admin_stats', {}, function(resp) {
			if (!self.active) return; // sanity
			self.data = resp.stats;
			self.renderSystemComponents();
			self.renderWebSockets();
		});
	}
	
	handleStatusUpdate(data) {
		// did things change that we care about
		if (data.internalJobsChanged) this.renderInternalJobs();
		else this.updateInternalJobs();
	}
	
	onStatusUpdate(data) {
		// called every 1s from websocket
		this.handleStatusUpdate(data);
	}
	
	onDataUpdate(key, data) {
		// refresh list if masters were updated
		if (key == 'stats') this.refreshData();
	}
	
	onDeactivate() {
		// called when page is deactivated
		delete this.data;
		this.div.html( '' );
		return true;
	}
	
};
