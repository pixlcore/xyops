// Admin Page -- System Status and Maintenance

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.System = class System extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		var self = this;
		if (!this.requireLogin(args)) return true;
		if (!this.requireAnyPrivilege('admin')) return true;
		
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
			html += '<div class="button danger" onClick="$P().prompt_import_data()"><i class="mdi mdi-database-import-outline">&nbsp;</i>Import Data...</div>';
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
			html += '<div class="caption">Shutdown the current master server (secondary will take over if applicable).  <a href="#">Learn More</a></div>';
		html += '</div>';
		
		// restart server
		// html += '<div class="maint_unit">';
		// 	html += '<div class="button danger" onClick="$P().restart_master()"><i class="mdi mdi-restart">&nbsp;</i>Restart Server...</div>';
		// 	html += '<div class="caption">Restart the current master server (secondary will take over).  <a href="#">Learn More</a></div>';
		// html += '</div>';
		
		// upgrade satellite
		html += '<div class="maint_unit">';
			html += '<div class="button danger" onClick="$P().do_upgrade_satellite()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i>Upgrade Workers...</div>';
			html += '<div class="caption">Upgrade or downgrade the xyOps Satellite software across your fleet of worker servers.  <a href="#">Learn More</a></div>';
		html += '</div>';
		
		// upgrade masters
		html += '<div class="maint_unit">';
			html += '<div class="button danger" onClick="$P().do_upgrade_masters()"><i class="mdi mdi-database-arrow-up-outline">&nbsp;</i>Upgrade Masters...</div>';
			html += '<div class="caption">Upgrade or downgrade xyOps on your master servers to any selected version.  <a href="#">Learn More</a></div>';
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
		// html += '<div class="dash_unit_box">';
		// 	html += '<div class="dash_unit_value">' + data.version + '</div>';
		// 	html += '<div class="dash_unit_label">xyOps Version</div>';
		// html += '</div>';
		
		// node version
		// html += '<div class="dash_unit_box">';
		// 	html += '<div class="dash_unit_value">' + data.node.version + '</div>';
		// 	html += '<div class="dash_unit_label">Node.js Version</div>';
		// html += '</div>';
		
		// process cpu (or load?)
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + Math.round(stats.cpu) + '%</div>';
			html += '<div class="dash_unit_label">Process CPU</div>';
		html += '</div>';
		
		// process mem
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + get_text_from_bytes(stats.mem, 1) + '</div>';
			html += '<div class="dash_unit_label">Process Memory</div>';
		html += '</div>';
		
		// sqlite mem (external)
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + get_text_from_bytes(stats.memoryUsage.external || 0, 1) + '</div>';
			html += '<div class="dash_unit_label">DB Memory</div>';
		html += '</div>';
		
		// process uptime
		// var uptime_sec = app.stats.started ? (time_now() - app.stats.started) : 0;
		// html += '<div class="dash_unit_box">';
		// 	html += '<div class="dash_unit_value">' + get_text_from_seconds_round(uptime_sec, true) + '</div>';
		// 	html += '<div class="dash_unit_label">Uptime</div>';
		// html += '</div>';
		
		// storage cache mem
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + (data.cache ? get_text_from_bytes(data.cache.bytes, 1) : 'n/a') + '</div>';
			html += '<div class="dash_unit_label">Cache Memory</div>';
		html += '</div>';
		
		// storage cache objects
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + (data.cache ? this.getNiceDashNumber(data.cache.count) : 'n/a') + '</div>';
			html += '<div class="dash_unit_label">Cache Objects</div>';
		html += '</div>';
		
		// cache full
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + (data.cache ? data.cache.full : 'n/a') + '</div>';
			html += '<div class="dash_unit_label">Cache Utilization</div>';
		html += '</div>';
		
		// sqlite db file size
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + (data.db.sqlite ? get_text_from_bytes(data.db.sqlite, 1) : 'n/a') + '</div>';
			html += '<div class="dash_unit_label">DB Disk Size</div>';
		html += '</div>';
		
		// jobs table row count
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + this.getNiceDashNumber(data.db.records.jobs || 0) + '</div>';
			html += '<div class="dash_unit_label">Job DB Rows</div>';
		html += '</div>';
		
		// servers table row count
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + this.getNiceDashNumber(data.db.records.servers || 0) + '</div>';
			html += '<div class="dash_unit_label">Server DB Rows</div>';
		html += '</div>';
		
		// snapshots table row count
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + this.getNiceDashNumber(data.db.records.snapshots || 0) + '</div>';
			html += '<div class="dash_unit_label">Snapshot DB Rows</div>';
		html += '</div>';
		
		// alerts table row count
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + this.getNiceDashNumber(data.db.records.alerts || 0) + '</div>';
			html += '<div class="dash_unit_label">Alert DB Rows</div>';
		html += '</div>';
		
		// activity table row count
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + this.getNiceDashNumber(data.db.records.activity || 0) + '</div>';
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
				'<span>' + self.getNiceIP(socket.ip) + '</span>',
				socket.loc ? ('<a href="#' + socket.loc.loc + '">#' + socket.loc.loc + '</a>') : 'n/a',
				get_text_from_seconds(app.epoch - socket.timeStart, true, true),
				socket.ping + ' ms'
			];
		} );
		
		this.div.find('#d_sys_sockets > .box_content').removeClass('loading').html(html);
	}
	
	prompt_import_data_OLD() {
		// prompt user with instructions and warnings
		var self = this;
		var html = inline_marked("Use this feature to import bulk data into xyOps by uploading a file from your local machine.  The file should have been generated from a previous export.\n\n**Warning:** This operation is destructive, and will delete all data in the way!  Also, this will abort all running jobs, flush all queued jobs, and the scheduler will automatically be paused.");
		
		Dialog.confirmDanger( 'Import Data', html, ['database-import', 'Choose File...'], function(result) {
			if (!result) return;
			var $file = $('<input type="file" style="display:none">');
			$file.appendTo('body');
			$file.on('change', function() {
				if (this.files && this.files.length) self.do_import_data({ file1: this.files[0] });
				$file.remove();
			});
			$file.get(0).click();
		} ); // confirm
	}
	
	prompt_import_data() {
		// prompt user with instructions and warnings
		var self = this;
		var text = "Use this feature to bulk import data into xyOps by uploading a file from your local machine.  The file should have been generated from a previous xyOps or Cronicle export.\n\n**Warning:** This operation is destructive, and will delete all data in the way!  Also, this will abort all running jobs, flush all queued jobs, and the scheduler will automatically be paused.  Proceed with extreme caution.";
		
		var html = '';
		html += `<div class="dialog_intro">${inline_marked(text)}</div>`;
		html += '<div class="dialog_box_content maximize" style="max-height:75vh; overflow-x:hidden; overflow-y:auto;">';
		
		html += this.getFormRow({
			id: 'd_sys_im_fmt',
			label: 'File Format:',
			content: this.getFormMenuMulti({
				id: 'fe_sys_im_fmt',
				title: 'Select File Format',
				options: [{ id: 'xyops', title: 'xyOps Data Format', icon: 'rocket-launch' }, { id: 'cronicle', title: 'Cronicle Data Format', icon: 'progress-clock' }],
				value: 'xyops',
				'data-shrinkwrap': 1
			}),
			caption: "Select the file format of the file you will be uploading."
		});
		
		html += '</div>';
		Dialog.confirmDanger( 'Bulk Import Data', html, ['database-import', 'Choose File...'], function(result) {
			if (!result) return;
			var fmt = $('#fe_sys_im_fmt').val();
			var $file = $('<input type="file" style="display:none">');
			$file.appendTo('body');
			$file.on('change', function() {
				if (this.files && this.files.length) self.do_import_data({ file1: this.files[0], format: fmt });
				$file.remove();
			});
			$file.get(0).click();
		} ); // confirm
		
		SingleSelect.init( $('#fe_sys_im_fmt') );
		Dialog.autoResize();
	}
	
	do_import_data(data) {
		// perform the upload given selected file from prompt
		var self = this;
		Dialog.hide();
		Dialog.showProgress( 1.0, "Uploading File..." );
		
		// upload file now
		var form = new FormData();
		for (var key in data) {
			form.append(key, data[key]);
		}
		
		app.api.upload( 'app/admin_import_data', form, function(resp) {
			Dialog.hideProgress();
			app.showMessage('success', "Your import job has started in the background.");
		} );
	}
	
	do_export_data() {
		// select which data to export
		var self = this;
		var html = '';
		
		html += `<div class="dialog_intro">This allows you to bulk export xyOps data to your local machine.  A gzip-compressed text file will be downloaded when the process is complete.  Please select which categories of data you wish you export.</div>`;
		html += '<div class="dialog_box_content maximize" style="max-height:75vh; overflow-x:hidden; overflow-y:auto;">';
		
		html += this.getFormRow({
			id: 'd_sys_ex_lists',
			label: 'Storage Lists:',
			content: this.getFormMenuMulti({
				id: 'fe_sys_ex_lists',
				title: 'Select Lists',
				placeholder: '(None)',
				options: sort_by( config.ui.list_list, 'title', { copy: true } ),
				values: config.ui.list_list.map( function(item) { return item.id; } ),
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
				options: sort_by( config.ui.database_list, 'title', { copy: true } ),
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
				options: sort_by( config.ui.extra_list, 'title', { copy: true } ),
				values: [],
				'data-hold': 1,
				'data-shrinkwrap': 1,
				'data-select-all': 1
				// 'data-compact': 1
			}),
			caption: "Choose optional extras to include in your export.  These are also generally quite large.  Note that job logs / files are only included if they are 1 MB or smaller."
		});
		
		html += '</div>';
		Dialog.confirm( "Bulk Export Data", html, ['database-export', "Export Now"], function(result) {
			if (!result) return;
			app.clearError();
			
			// prepare request
			var lists = $('#fe_sys_ex_lists').val();
			var indexes = $('#fe_sys_ex_dbs').val();
			var extras = $('#fe_sys_ex_extras').val();
			
			if (!lists.length && !indexes.length && !extras.length) {
				return app.doError("Please select at least one item to export.");
			}
			
			Dialog.hide();
			
			// fetch transfer token
			app.api.post( 'app/get_transfer_token', { lists, indexes, extras }, function(resp) {
				window.location = app.base_api_url + '/app/admin_export_data?token=' + resp.token;
			}); // api.post
		});
		
		MultiSelect.init( $('#fe_sys_ex_lists, #fe_sys_ex_dbs, #fe_sys_ex_extras') );
		Dialog.autoResize();
	}
	
	do_delete_data() {
		// delete selected data
		var self = this;
		var html = '';
		
		html += `<div class="dialog_intro">This allows you to <b>permanently delete</b> xyOps data in bulk.  Please select which categories of data you wish you delete.  It is highly recommended that you stop all running jobs before deleting data.  Also note that the scheduler will automatically be paused if it is active.</div>`;
		html += '<div class="dialog_box_content maximize" style="max-height:75vh; overflow-x:hidden; overflow-y:auto;">';
		
		html += this.getFormRow({
			id: 'd_sys_ex_lists',
			label: 'Storage Lists:',
			content: this.getFormMenuMulti({
				id: 'fe_sys_ex_lists',
				title: 'Select Lists',
				placeholder: '(None)',
				options: sort_by( config.ui.list_list.concat([ { id: 'stats', title: "Stat History", icon: 'chart-scatter-plot' } ]), 'title', { copy: true } ),
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
				options: sort_by( config.ui.database_list, 'title', { copy: true } ),
				values: [],
				'data-hold': 1,
				'data-shrinkwrap': 1,
				'data-select-all': 1
				// 'data-compact': 1
			}),
			caption: "Choose which database tables to delete.  These are generally much larger and will take longer to go."
		});
		
		html += '</div>';
		Dialog.confirmDanger( "Delete Data", html, ['trash-can', "Delete Now"], function(result) {
			if (!result) return;
			app.clearError();
			
			// prepare request
			var items = [];
			var lists = $('#fe_sys_ex_lists').val();
			var dbs = $('#fe_sys_ex_dbs').val();
			
			if (lists.includes('users')) {
				items.push({ type: 'users' });
			}
			
			if (lists.includes('buckets')) {
				items.push({ type: 'bucketData' });
				items.push({ type: 'bucketFiles' });
			}
			if (lists.includes('secrets')) {
				items.push({ type: 'secretData' });
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
		var html = "This runs the nightly database maintenance process manually.  The maintenance job deletes old data that has expired, and optionally backs up the database if configured.  Note that this will run multiple internal jobs in sequence.";
		
		Dialog.confirm( 'Run Maintenance', html, ['database-clock', 'Run Now'], function(result) {
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
		var html = "This optimizes the local database by compacting it.  You should only need this if you delete a large amount of data and need to reclaim unused space.  It also runs an integrity check, and you will be sent an email report with all results.  <br><br>Please note that the database will be locked while the compaction and integrity check processes running, so it is highly recommended that you stop all jobs and pause the scheduler before running this job.";
		
		Dialog.confirm( 'Optimize Database', html, ['database-refresh', 'Optimize Now'], function(result) {
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
		
		Dialog.confirm( 'Reset Daily Stats', html, ['skip-previous-circle', 'Reset Now'], function(result) {
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
	
	do_upgrade_satellite() {
		// upgrade satellite on selected worker servers
		var self = this;
		var html = '';
		
		html += `<div class="dialog_intro">This allows you to upgrade the xyOps Satellite (xySat) software on your worker servers.  The installer will also wait for all jobs to complete on each worker server before starting the upgrade process, to reduce potential disruptions.</div>`;
		html += '<div class="dialog_box_content maximize" style="max-height:75vh; overflow-x:hidden; overflow-y:auto;">';
		
		// targets
		html += this.getFormRow({
			id: 'd_sys_sat_targets',
			content: this.getFormMenuMulti({
				id: 'fe_sys_sat_targets',
				options: [].concat(
					this.buildOptGroup(app.groups, config.ui.menu_bits.wf_targets_groups, 'server-network'),
					this.buildServerOptGroup(config.ui.menu_bits.wf_targets_servers, 'router-network')
				),
				values: [],
				'data-hold': 1,
				'data-shrinkwrap': 1
			})
		});
		
		// release version
		html += this.getFormRow({
			id: 'd_sys_sat_release',
			content: this.getFormMenuSingle({
				id: 'fe_sys_sat_release',
				options: [ { id: '', title: config.ui.menu_bits.generic_loading } ],
				value: '',
				'data-shrinkwrap': 1
			})
		});
		
		// delay between
		html += this.getFormRow({
			id: 'd_sys_sat_stagger',
			content: this.getFormRelativeTime({
				id: 'fe_sys_sat_stagger',
				value: 30
			})
		});
		
		html += '</div>';
		Dialog.confirmDanger( "Upgrade Worker Servers", html, ['cloud-upload-outline', "Upgrade Now"], function(result) {
			if (!result) return;
			app.clearError();
			
			var targets = $('#fe_sys_sat_targets').val();
			if (!targets.length) return app.badField('#fe_sys_sat_targets', "Please select one or more groups or servers to upgrade.");
			
			var release = $('#fe_sys_sat_release').val();
			var stagger = parseInt( $('#fe_sys_sat_stagger').val() ) || 0;
			
			Dialog.hide();
			
			// start the job
			app.api.post( 'app/admin_upgrade_workers', { targets, release, stagger }, function(resp) {
				app.showMessage('success', "Your upgrade job has started in the background.");
			}); // api.post
		}); // confirm
		
		SingleSelect.init('#fe_sys_sat_release');
		MultiSelect.init( $('#fe_sys_sat_targets') );
		RelativeTime.init( $('#fe_sys_sat_stagger') );
		Dialog.autoResize();
		
		// load release list
		app.api.get( 'app/get_satellite_releases', {}, function(resp) {
			var title_map = {
				latest: 'Latest Stable',
				airgap: '(Air-gapped Custom)'
			};
			var items = (resp.releases || []).map( function(release) {
				return { id: release, title: title_map[release] || release.replace(/^v([\d\.]+)$/, 'Version $1'), icon: title_map[release] ? 'tag-text' : 'tag-text-outline' };
			} );
			
			// change menu items and fire onChange event for redraw
			$('#fe_sys_sat_release').html( render_menu_options( items, items[0].id ) ).trigger('change');
		} ); // api.get
	}
	
	do_upgrade_masters() {
		// upgrade selected masters
		var self = this;
		var html = '';
		
		html += `<div class="dialog_intro">This allows you to upgrade the xyOps software on your master servers.  Note that if you include the current primary master in the upgrade list, it will be upgraded last (and the client will be disconnected during the upgrade process).</div>`;
		html += '<div class="dialog_box_content maximize" style="max-height:75vh; overflow-x:hidden; overflow-y:auto;">';
		
		// targets
		var masters = sort_by( Object.values(app.masters), 'id' ).filter( function(host) { return !!host.online; } ).map( function(host) { 
			return { id: host.id, title: host.id, icon: host.master ? 'database' : 'database-outline' }; 
		} );
		
		html += this.getFormRow({
			id: 'd_sys_multi_targets',
			content: this.getFormMenuMulti({
				id: 'fe_sys_multi_targets',
				options: masters,
				values: [],
				'data-hold': 1,
				'data-shrinkwrap': 1
			})
		});
		
		// release version
		html += this.getFormRow({
			id: 'd_sys_multi_release',
			content: this.getFormMenuSingle({
				id: 'fe_sys_multi_release',
				options: [ { id: '', title: config.ui.menu_bits.generic_loading } ],
				value: '',
				'data-shrinkwrap': 1
			})
		});
		
		// delay between
		html += this.getFormRow({
			id: 'd_sys_multi_stagger',
			content: this.getFormRelativeTime({
				id: 'fe_sys_multi_stagger',
				value: 60
			})
		});
		
		html += '</div>';
		Dialog.confirmDanger( "Upgrade Master Servers", html, ['database-arrow-up-outline', "Upgrade Now"], function(result) {
			if (!result) return;
			app.clearError();
			
			var targets = $('#fe_sys_multi_targets').val();
			if (!targets.length) return app.badField('#fe_sys_multi_targets', "Please select one or more masters to upgrade.");
			
			var release = $('#fe_sys_multi_release').val();
			var stagger = parseInt( $('#fe_sys_multi_stagger').val() ) || 0;
			
			Dialog.hide();
			
			// start the job
			app.api.post( 'app/admin_upgrade_masters', { targets, release, stagger }, function(resp) {
				app.showMessage('success', "Your upgrade job has started in the background.");
			}); // api.post
		}); // confirm
		
		SingleSelect.init('#fe_sys_multi_release');
		MultiSelect.init( $('#fe_sys_multi_targets') );
		RelativeTime.init( $('#fe_sys_multi_stagger') );
		Dialog.autoResize();
		
		// load release list
		app.api.get( 'app/get_master_releases', {}, function(resp) {
			var title_map = {
				latest: 'Latest Stable'
			};
			var items = (resp.releases || []).map( function(release) {
				return { id: release, title: title_map[release] || release.replace(/^v([\d\.]+)$/, 'Version $1'), icon: title_map[release] ? 'tag-text' : 'tag-text-outline' };
			} );
			
			// change menu items and fire onChange event for redraw
			$('#fe_sys_multi_release').html( render_menu_options( items, items[0].id ) ).trigger('change');
		} ); // api.get
	}
	
	do_master_cmd(cmds) {
		// send command to control master server
		var item = find_object( Object.values(app.masters), { online: true, master: true } );
		if (!item) return; // sanity
		
		var params = {
			host: item.id,
			commands: cmds
		};
		
		Dialog.confirmDanger( '<span style="">' + ucfirst(cmds[0]) + ' Master</span>', "Are you sure you want to " + cmds[0] + " the master server &ldquo;" + item.id + "&rdquo;?", ['alert-decagram', 'Confirm'], function(result) {
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
	
	onPageUpdate(pcmd, pdata) {
		// refresh data if internal job completed
		if (pcmd == 'internal_job_completed') this.refreshData();
	}
	
	onDeactivate() {
		// called when page is deactivated
		delete this.data;
		this.div.html( '' );
		return true;
	}
	
};
