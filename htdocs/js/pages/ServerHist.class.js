// Server History

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

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
		if (!sys) return this.doFullPageError("Unknown system: " + args.mode);
		
		var snapshot = this.snapshot;
		var server_icon = server.icon || (online ? 'router-network' : 'close-network-outline');
		
		this.histPrep();
		
		app.setHeaderNav([
			{ icon: 'server', loc: '#Servers?sub=list', title: 'Servers' },
			{ icon: server_icon, loc: '#Servers?sub=view&id=' + server.id, title: server.title || server.hostname },
			{ icon: this.histIcon, title: ucfirst(args.mode) + " View" }
		]);
		
		app.setWindowTitle( "Historical Server View: " + (server.title || server.hostname) + "" );
		
		html += '<div class="box" style="border:none;">';
			html += '<div class="box_title">';
				html += '<div class="box_title_left" style="color:var(--green)">' + ucfirst(args.mode) + ' &mdash; ' + this.histTitle + '</div>';
				html += '<div class="box_title_left"><div class="button secondary mobile_collapse" onClick="$P().chooseHistoricalView()"><i class="mdi mdi-calendar-cursor">&nbsp;</i><span>Select Range...</span></div></div>';
				html += '<div class="box_title_right"><div class="button mobile_collapse tablet_hide" onClick="$P().histNavNext()"><span>Next ' + ucfirst(this.histUnit) + '&nbsp;</span><i class="mdi mdi-chevron-right"></i></div></div>';
				html += '<div class="box_title_right"><div class="button mobile_collapse tablet_hide" onClick="$P().histNavPrev()"><i class="mdi mdi-chevron-left">&nbsp;</i><span>Prev ' + ucfirst(this.histUnit) + '</span></div></div>';
			html += '</div>';
		html += '</div>';
		
		html += '<div class="box">';
			html += '<div class="box_title">';
				html += 'Server Summary';
				
				// if (!online) html += '<div class="box_title_note">As of ' + this.getShortDateTimeText(snapshot.date) + '</div>';
				// html += '<div class="button right danger" onClick="$P().showDeleteSnapshotDialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i>Delete...</div>';
				// html += '<div class="button secondary right" onClick="$P().do_edit_from_view()"><i class="mdi mdi-file-edit-outline">&nbsp;</i>Edit Event...</div>';
				// html += '<div class="button right" onClick="$P().do_run_from_view()"><i class="mdi mdi-run-fast">&nbsp;</i>Run Now</div>';
				html += '<div class="clear"></div>';
			html += '</div>'; // title
			
			html += '<div class="box_content table">';
				html += '<div class="summary_grid">';
				
					// row 1
					html += '<div>';
						html += '<div class="info_label">Server ID</div>';
						html += '<div class="info_value monospace">' + this.getNiceCopyableID(server.id) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Server Hostname</div>';
						html += '<div class="info_value">' + server.hostname + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Server IP</div>';
						html += '<div class="info_value">' + this.getNiceIP(server.ip) + '</div>';
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
		html += '<div class="box charts" id="d_vs_monitors">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onClick="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" onInput="$P().applyMonitorFilter(this)"></div>';
				html += this.getChartSizeSelector();
				html += 'Server Monitors &mdash; ' + this.histTitle;
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// alerts
		html += '<div class="box" id="d_vs_alerts" style="">';
			html += '<div class="box_title">';
				html += 'Server Alerts &mdash; ' + this.histTitle;
				// html += '<div class="button right secondary" onClick="$P().goAlertHistory()"><i class="mdi mdi-magnify">&nbsp;</i>Alert History...</div>';
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
					onChange: '$P().applyJobHistoryFilters()',
					'data-shrinkwrap': 1
				}) + '</div>';
				
				html += 'Server Jobs &mdash; ' + this.histTitle;
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html(html);
		
		this.setupMonitors();
		this.fetchAlertHistory();
		this.fetchJobHistory();
		
		SingleSelect.init( this.div.find('#fe_vs_job_filter, .sel_chart_size') );
	}
	
	setupMonitors() {
		// setup custom monitors (updated every minute)
		var self = this;
		var server = this.server;
		var monitors = this.monitors = [];
		var html = '';
		var chart_size = app.getPref('chart_size') || 'medium';
		html += '<div class="chart_grid_horiz ' + chart_size + '">';
		
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
		
		monitors.forEach( function(def, idx) {
			var chart = self.createChart({
				"canvas": '#c_vs_' + def.id,
				"title": def.title,
				"dataType": def.data_type,
				"dataSuffix": def.suffix,
				"showDataGaps": true,
				"delta": def.delta || false,
				"deltaMinValue": def.delta_min_value ?? false,
				"divideByDelta": def.divide_by_delta || false,
				"minVertScale": def.min_vert_scale || 0,
				"legend": false, // single layer, no legend needed
				"zoom": {
					xMin: self.epochStart,
					xMax: self.epochEnd
				},
				"_allow_zoom": true
			});
			self.charts[ def.id ] = chart;
			self.setupChartHover(def.id);
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
					title: self.getNiceServerText(server),
					data: self.getMonitorChartData(resp.rows, def),
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
	
	onKeyDown(event) {
		// key was pressed while not in a text field or dialog
		switch (event.key) {
			case 'ArrowLeft': this.histNavPrev(); break;
			case 'ArrowRight': this.histNavNext(); break;
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
		delete this.chartZoom;
		delete this.histTitle;
		delete this.histIcon;
		delete this.histUnit;
		
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
