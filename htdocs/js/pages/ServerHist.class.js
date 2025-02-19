// Server History

Page.ServerHist = class ServerHist extends Page.ServerUtils {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		
		this.loading();
		this['gosub_hist'](args);
		
		return true;
	}
	
	gosub_hist(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		app.highlightTab( 'Servers' );
		app.setHeaderTitle( '...' );
		
		this.loading();
		app.api.get( 'app/get_server', { id: args.id }, this.receive_snapshot.bind(this), this.fullPageError.bind(this) );
		return true;
	}
	
	receive_snapshot(resp) {
		// render snapshot details
		var self = this;
		var args = this.args;
		var { server, data, online } = resp;
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		// validate args
		if (!args.mode || !args.year) return this.doFullPageError("Missing required arguments.");
		
		this.server = server;
		this.snapshot = data;
		this.online = online;
		this.charts = {};
		this.jobHistArgs = {};
		
		var sys = this.sys = find_object( config.systems, { id: args.mode } );
		if (!sys) return this.doFullPageError("Unknown system: " + sys);
		
		var snapshot = this.snapshot;
		var server_icon = server.icon || (online ? 'router-network' : 'close-network-outline');
		var epoch_start = 0;
		var limit = 0;
		var icon = '';
		var title = '';
		var unit = '';
		
		// convert args to start / end epochs
		switch (args.mode) {
			case 'yearly':
				epoch_start = Math.ceil( this.parseDateTZ( args.year + '-01-01 00:00:00' ) / sys.epoch_div ) * sys.epoch_div;
				limit = Math.floor( (args.limit * (86400 * 366)) / sys.epoch_div );
				title = this.formatDate(epoch_start, { year: 'numeric' } );
				icon = 'earth';
				unit = 'year';
			break;
			
			case 'monthly':
				epoch_start = Math.ceil( this.parseDateTZ( args.year + '-' + args.month + '-01 00:00:00' ) / sys.epoch_div ) * sys.epoch_div;
				limit = Math.floor( (args.limit * ((86400 * 31) + 3600)) / sys.epoch_div );
				title = this.formatDate(epoch_start, { year: 'numeric', month: 'long' } );
				icon = 'calendar-month-outline';
				unit = 'month';
			break;
			
			case 'daily':
				epoch_start = Math.ceil( this.parseDateTZ( args.year + '-' + args.month + '-' + args.day + ' 00:00:00' ) / sys.epoch_div ) * sys.epoch_div;
				limit = Math.floor( (args.limit * (86400 + 3600)) / sys.epoch_div );
				title = this.formatDate(epoch_start, { year: 'numeric', month: 'long', day: 'numeric' } );
				icon = 'calendar-today-outline';
				unit = 'day';
			break;
			
			case 'hourly':
				epoch_start = Math.ceil( this.parseDateTZ( args.year + '-' + args.month + '-' + args.day + ' ' + args.hour + ':00:00' ) / sys.epoch_div ) * sys.epoch_div;
				limit = Math.floor( (args.limit * 3600) / sys.epoch_div );
				title = this.formatDate(epoch_start, { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric' } );
				icon = 'clock-outline';
				unit = 'hour';
			break;
		} // switch args.mode
		
		// nudge limit back into current range if needed
		limit = this.nudgeLimit(epoch_start, limit);
		
		// save epoch range for later
		this.epochStart = epoch_start;
		this.epochEnd = epoch_start + (limit * sys.epoch_div);
		this.chartLimit = limit;
		
		app.setHeaderNav([
			{ icon: 'server', loc: '#Servers?sub=list', title: 'Servers' },
			{ icon: server_icon, loc: '#Servers?sub=view&id=' + server.id, title: server.title || server.hostname },
			{ icon: icon, title: ucfirst(args.mode) + " View" }
		]);
		
		app.setWindowTitle( "Historical Server View: " + (server.title || server.hostname) + "" );
		
		html += '<div class="box" style="border:none;">';
			html += '<div class="box_title">';
				html += '<div class="box_title_left">' + ucfirst(args.mode) + ' &mdash; ' + title + '</div>';
				html += '<div class="box_title_left"><div class="button secondary" onClick="$P().chooseHistoricalView()"><i class="mdi mdi-calendar-cursor">&nbsp;</i>Select Range...</div></div>';
				html += '<div class="box_title_right"><div class="button secondary" onClick="$P().navNext()">Next ' + ucfirst(unit) + '&nbsp;<i class="mdi mdi-chevron-right"></i></div></div>';
				html += '<div class="box_title_right"><div class="button secondary" onClick="$P().navPrev()"><i class="mdi mdi-chevron-left">&nbsp;</i>Prev ' + ucfirst(unit) + '</div></div>';
			html += '</div>';
		html += '</div>';
		
		html += '<div class="box">';
			html += '<div class="box_title">';
				html += 'Server Summary';
				
				// if (!online) html += '<div class="box_title_note">As of ' + this.getShortDateTimeText(snapshot.date) + '</div>';
				// html += '<div class="button right danger" onMouseUp="$P().showDeleteSnapshotDialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i>Delete...</div>';
				// html += '<div class="button secondary right" onMouseUp="$P().do_edit_from_view()"><i class="mdi mdi-file-edit-outline">&nbsp;</i>Edit Event...</div>';
				// html += '<div class="button right" onMouseUp="$P().do_run_from_view()"><i class="mdi mdi-run-fast">&nbsp;</i>Run Now</div>';
				html += '<div class="clear"></div>';
			html += '</div>'; // title
			
			html += '<div class="box_content table">';
				html += '<div class="summary_grid">';
				
					// row 1
					html += '<div>';
						html += '<div class="info_label">Server ID</div>';
						html += '<div class="info_value monospace">' + server.id + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Server Hostname</div>';
						html += '<div class="info_value">' + server.hostname + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Server IP</div>';
						html += '<div class="info_value">' + server.ip + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Server Label</div>';
						html += '<div class="info_value" id="d_vs_stat_label">' + (server.title || 'n/a') + '</div>';
					html += '</div>';
					
					// row 2
					html += '<div>';
						html += '<div class="info_label">Groups</div>';
						html += '<div class="info_value">' + this.getNiceGroupList(server.groups) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Architecture</div>';
						html += '<div class="info_value">' + this.getNiceArch(snapshot.data.arch) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Operating System</div>';
						html += '<div class="info_value">' + this.getNiceOS(snapshot.data.os) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Server Uptime</div>';
						html += '<div class="info_value" id="d_vs_stat_uptime">' + this.getNiceUptime(snapshot.data.uptime_sec) + '</div>';
					html += '</div>';
					
					// row 3
					html += '<div>';
						html += '<div class="info_label">Total RAM</div>';
						html += '<div class="info_value">' + this.getNiceMemory(snapshot.data.memory.total || 0) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">CPU Cores</div>';
						html += '<div class="info_value">' + snapshot.data.cpu.physicalCores + ' physical, ' + snapshot.data.cpu.cores + ' virtual</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">CPU Type</div>';
						html += '<div class="info_value">' + this.getNiceCPUType(snapshot.data.cpu) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Virtualization</div>';
						html += '<div class="info_value">' + this.getNiceVirtualization(server.info.virt) + '</div>';
					html += '</div>';
					
				html += '</div>'; // summary grid
			html += '</div>'; // box content
		html += '</div>'; // box
		
		// monitors
		html += '<div class="box" id="d_vs_monitors">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" onInput="$P().applyMonitorFilter(this)"></div>';
				html += 'Server Monitors &mdash; ' + title;
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// alerts
		html += '<div class="box" id="d_vs_alerts" style="">';
			html += '<div class="box_title">';
				html += 'Server Alerts &mdash; ' + title;
				// html += '<div class="button right secondary" onMouseUp="$P().goAlertHistory()"><i class="mdi mdi-magnify">&nbsp;</i>Alert History...</div>';
				// html += '<div class="clear"></div>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// jobs
		html += '<div class="box" id="d_vs_jobs" style="">';
			html += '<div class="box_title">';
				
				html += '<div class="box_title_widget" style="overflow:visible; min-width:120px; max-width:200px; font-size:13px;">' + this.getFormMenuSingle({
					id: 'fe_vs_job_filter',
					title: 'Filter job list',
					options: this.buildJobFilterOpts(),
					value: this.jobHistArgs.filter || '',
					onChange: '$P().applyHistoryFilters()',
					'data-shrinkwrap': 1
				}) + '</div>';
				
				html += 'Server Jobs &mdash; ' + title;
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html(html);
		
		this.setupMonitors();
		this.fetchAlertHistory();
		this.fetchJobHistory();
		
		SingleSelect.init( this.div.find('#fe_vs_job_filter') );
	}
	
	navPrev() {
		// navigate to previous time unit (hour, day, etc.)
		var args = this.args;
		
		switch (args.mode) {
			case 'yearly':
				args.year--;
			break;
			
			case 'monthly':
				args.month--;
				if (args.month < 1) { args.month = 12; args.year--; }
			break;
			
			case 'daily':
				var dargs = this.getDateArgsTZ( this.epochStart - 43200 );
				args.year = dargs.year;
				args.month = dargs.month;
				args.day = dargs.day;
			break;
			
			case 'hourly':
				var dargs = this.getDateArgsTZ( this.epochStart - 3600 );
				args.year = dargs.year;
				args.month = dargs.month;
				args.day = dargs.day;
				
				// special case here for jumping over fall-back DST
				// (i.e. where jumping backward one hour will land on the same YYYY-MM-DD-HH)
				args.hour = (dargs.hour == args.hour) ? (dargs.hour - 1) : dargs.hour;
			break;
		} // switch args.mode
		
		Nav.go( this.selfNav(args) );
	}
	
	navNext() {
		// navigate to next time unit (hour, day, etc.)
		var args = this.args;
		
		switch (args.mode) {
			case 'yearly':
				args.year++;
			break;
			
			case 'monthly':
				args.month++;
				if (args.month > 12) { args.month = 1; args.year++; }
			break;
			
			case 'daily':
				var dargs = this.getDateArgsTZ( this.epochStart + 43200 + 86400 );
				args.year = dargs.year;
				args.month = dargs.month;
				args.day = dargs.day;
			break;
			
			case 'hourly':
				var dargs = this.getDateArgsTZ( this.epochStart + 3600 );
				args.year = dargs.year;
				args.month = dargs.month;
				args.day = dargs.day;
				
				// special case here for jumping over fall-back DST
				// (i.e. where jumping forward one hour will land on the same YYYY-MM-DD-HH)
				args.hour = (dargs.hour == args.hour) ? (dargs.hour + 1) : dargs.hour;
			break;
		} // switch args.mode
		
		Nav.go( this.selfNav(args) );
	}
	
	nudgeLimit(epoch_start, limit) {
		// ensure limit keeps graph range within current mode (yearly, etc.)
		var args = this.args;
		var sys = this.sys;
		var done = false;
		
		var criteria = {};
		['year', 'month', 'day', 'hour'].forEach( function(key) { if (key in args) criteria[key] = args[key]; } );
		var num_crit = num_keys(criteria);
		
		while (!done) {
			var end_epoch = epoch_start + ((limit - 1) * sys.epoch_div);
			var dargs = this.getDateArgsTZ(end_epoch);
			var num_matched = 0;
			for (var key in criteria) {
				if (dargs[key] == criteria[key]) num_matched++;
			}
			if (num_matched == num_crit) done = true;
			else limit--;
		}
		
		return limit;
	}
	
	setupMonitors() {
		// setup custom monitors (updated every minute)
		var self = this;
		var server = this.server;
		var monitors = this.monitors = [];
		var html = '';
		html += '<div class="chart_grid_horiz">';
		
		app.monitors.forEach( function(mon_def) {
			if (!mon_def.display) return;
			if (mon_def.groups.length && !app.includesAny(mon_def.groups, server.groups)) return;
			monitors.push(mon_def);
			
			html += '<div><canvas id="c_vs_' + mon_def.id + '" class="chart"></canvas></div>';
		} );
		
		html += '</div>';
		this.div.find('#d_vs_monitors > div.box_content').html( html );
		
		if (!monitors.length) {
			// odd situation, no monitors match this server
			this.div.find('#d_vs_monitors').hide();
			return;
		}
		
		var render_chart_overlay = function(key) {
			$('.pxc_tt_overlay').html(
				'<div class="chart_toolbar ct_' + key + '">' + 
					'<div class="chart_icon ci_di" title="Download Image" onClick="$P().chartDownload(\'' + key + '\')"><i class="mdi mdi-cloud-download-outline"></i></div>' + 
					'<div class="chart_icon ci_cl" title="Copy Image Link" onClick="$P().chartCopyLink(\'' + key + '\',this)"><i class="mdi mdi-clipboard-pulse-outline"></i></div>' + 
				'</div>' 
			);
		};
		
		monitors.forEach( function(def, idx) {
			var chart = self.createChart({
				"canvas": '#c_vs_' + def.id,
				"title": def.title,
				"dataType": def.data_type,
				"dataSuffix": def.suffix,
				"showDataGaps": true,
				"delta": def.delta || false,
				"divideByDelta": def.divide_by_delta || false,
				"minVertScale": def.min_vert_scale || 0,
				"legend": false // single layer, no legend needed
			});
			chart.on('mouseover', function(event) { render_chart_overlay(def.id); });
			self.charts[ def.id ] = chart;
		});
		
		// request data from server
		var opts = {
			server: server.id,
			sys: this.sys.id,
			date: this.epochStart,
			limit: this.chartLimit
		};
		
		app.api.post( 'app/get_historical_monitor_data', opts, function(resp) {
			if (!self.active) return; // sanity
			
			if (!resp.rows.length) {
				for (var key in self.charts) {
					self.charts[key].destroy();
				}
				self.charts = {};
				self.div.find('#d_vs_monitors > div.box_content').html( '<div class="inline_page_message">No data found in the selected range.</div>' );
				return;
			}
			
			// now iterate over all our monitors
			monitors.forEach( function(def, idx) {
				var chart = self.charts[def.id];
				
				chart.addLayer({
					id: server.id,
					title: app.formatHostname(server.hostname),
					data: self.getMonitorChartData(resp.rows, def.id),
					color: app.colors[ idx % app.colors.length ]
				});
			}); // foreach mon
			
			// self.div.find('#d_vs_monitors div.chart_grid_horiz').removeClass('loading');
		}); // api.get
		
		// prepopulate filter if saved
		if (this.monitorFilter) {
			var $elem = this.div.find('#d_vs_monitors .box_title_widget input[type="text"]');
			$elem.val( this.monitorFilter );
			this.applyMonitorFilter( $elem.get(0) );
		}
	}
	
	applyHistoryFilters() {
		// menu change for job history filter popdown
		this.jobHistArgs.filter = this.div.find('#fe_vs_job_filter').val();
		this.div.find('#d_vs_jobs > .box_content').html( '<div class="loading_container"><div class="loading"></div></div>' );
		this.fetchJobHistory();
	}
	
	fetchJobHistory() {
		// fetch job history from server
		var args = this.jobHistArgs;
		
		// { query, offset, limit, sort_by, sort_dir }
		args.query = 'server:' + this.server.id;
		args.offset = args.offset || 0;
		args.limit = config.alt_items_per_page;
		args.sort_by = 'completed'; 
		args.sort_dir = -1;
		
		// add epoch date range
		args.query += ' date:' + this.epochStart + '..' + this.epochEnd;
		
		// apply filters if any
		if (args.filter) {
			switch (args.filter) {
				case 'z_success': args.query += ' tags:_success'; break;
				case 'z_error': args.query += ' tags:_error'; break;
				case 'z_warning': args.query += ' code:warning'; break;
				case 'z_critical': args.query += ' code:critical'; break;
				case 'z_abort': args.query += ' code:abort'; break;
				
				case 'z_retried': args.query += ' tags:_retried'; break;
				case 'z_last': args.query += ' tags:_last'; break;
				
				default:
					if (args.filter.match(/^t_(.+)$/)) args.query += ' tags:' + RegExp.$1;
				break;
			}
		}
		
		app.api.get( 'app/search_jobs', args, this.receiveJobHistory.bind(this) );
	}
	
	receiveJobHistory(resp) {
		// receive history from db
		var self = this;
		var args = this.jobHistArgs;
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		if (!resp.rows) resp.rows = [];
		this.jobs = resp.rows;
		
		var grid_args = {
			resp: resp,
			cols: ['Job ID', 'Server', 'Source', 'Started', 'Elapsed', 'Avg CPU/Mem', 'Result'],
			data_type: 'job',
			offset: args.offset || 0,
			limit: args.limit,
			class: 'data_grid job_history_grid',
			pagination_link: '$P().jobHistoryNav'
		};
		
		html += this.getPaginatedGrid( grid_args, function(job, idx) {
			return [
				'<b>' + self.getNiceJob(job, true) + '</b>',
				self.getNiceServer(job.server, true),
				self.getNiceJobSource(job),
				self.getShortDateTime( job.started ),
				self.getNiceJobElapsedTime(job, true),
				self.getNiceJobAvgCPU(job) + ' / ' + self.getNiceJobAvgMem(job),
				self.getNiceJobResult(job),
				// '<a href="#Job?id=' + job.id + '">Details</a>'
			];
		} );
		
		this.div.find('#d_vs_jobs > .box_content').removeClass('loading').html( html );
	}
	
	jobHistoryNav(offset) {
		// intercept click on job history table pagination nav
		this.jobHistArgs.offset = offset;
		this.div.find('#d_vs_jobs > .box_content').addClass('loading');
		this.fetchJobHistory();
	}
	
	fetchAlertHistory() {
		// fetch history of alert on current server
		var self = this;
		if (!this.alertHistoryOffset) this.alertHistoryOffset = 0;
		
		var opts = {
			query: 'server:' + this.server.id + ' date:' + this.epochStart + '..' + this.epochEnd,
			offset: this.alertHistoryOffset,
			limit: config.alt_items_per_page,
			sort_by: '_id',
			sort_dir: -1,
			ttl: 1
		};
		
		app.api.get( 'app/search_alerts', opts, this.renderAlertHistory.bind(this));
	}
	
	renderAlertHistory(resp) {
		// render alert history
		var self = this;
		var cols = ["Alert ID", "Title", "Message", "Server", "Status", "Started", "Duration"];
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		var grid_args = {
			resp: resp,
			cols: cols,
			offset: 0,
			limit: config.alt_items_per_page,
			sort_by: '_id',
			sort_dir: -1,
			data_type: 'alert',
			pagination_link: '$P().alertHistoryNav'
		};
		
		html += this.getPaginatedGrid( grid_args, function(item, idx) {
			return [
				'<b>' + self.getNiceAlertID(item, true) + '</b>',
				self.getNiceAlert(item.alert, false),
				item.message,
				self.getNiceServer(item.server, true),
				self.getNiceAlertStatus(item),
				self.getRelativeDateTime(item.date),
				self.getNiceAlertElapsedTime(item, true, true)
			];
		}); // grid
		
		$('#d_vs_alerts > div.box_content').removeClass('loading').html( html );
	}
	
	alertHistoryNav(offset) {
		// intercept click on job history table pagination nav
		this.alertHistoryOffset = offset;
		this.div.find('#d_vs_alerts > .box_content').addClass('loading');
		this.fetchAlertHistory();
	}
	
	onKeyDown(event) {
		// key was pressed while not in a text field or dialog
		switch (event.key) {
			case 'ArrowLeft': this.navPrev(); break;
			case 'ArrowRight': this.navNext(); break;
		}
	}
	
	onDeactivate() {
		// called when page is deactivated
		delete this.servers;
		delete this.monitors;
		delete this.server;
		delete this.snapshot;
		delete this.online;
		delete this.epochStart;
		delete this.epochEnd;
		delete this.chartLimit;
		delete this.jobHistArgs;
		
		// destroy charts if applicable (view page)
		if (this.charts) {
			for (var key in this.charts) {
				this.charts[key].destroy();
			}
			delete this.charts;
		}
		
		this.div.html( '' );
		return true;
	}
	
};
