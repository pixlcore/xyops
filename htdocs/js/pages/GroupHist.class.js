// Group History

Page.GroupHist = class GroupHist extends Page.ServerUtils {
	
	onInit() {
		// called once at page load
		
		// debounce for view sub
		this.applyServerTableFiltersDebounce = debounce( this.applyServerTableFilters.bind(this), 250 );
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
		var self = this;
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		app.highlightTab( 'Groups' );
		app.setHeaderTitle( '...' );
		
		this.loading();
		// app.api.get( 'app/get_server', { id: args.id }, this.receive_snapshot.bind(this), this.fullPageError.bind(this) );
		// return true;
		
		// validate args
		if (!args.mode || !args.year) return this.doFullPageError("Missing required arguments.");
		
		this.charts = {};
		this.jobHistArgs = {};
		
		var sys = this.sys = find_object( config.systems, { id: args.mode } );
		if (!sys) return this.doFullPageError("Unknown system: " + args.mode);
		
		var group = this.group = find_object( app.groups, { id: args.id } );
		if (!group) return this.doFullPageError("Unknown group: " + args.id);
		
		this.histPrep();
		
		app.setHeaderNav([
			{ icon: 'lan', loc: '#Groups?sub=list', title: 'Server Groups' },
			{ icon: group.icon || 'server-network', loc: '#Groups?sub=view&id=' + group.id, title: group.title },
			{ icon: this.histIcon, title: ucfirst(args.mode) + " View" }
		]);
		
		app.setWindowTitle( "Historical Group View: " + (group.title) + "" );
		
		// start building server list using online servers first (easy)
		this.servers = Object.values(app.servers).filter( function(server) {
			return server.groups.includes(group.id) && (server.created < self.epochEnd);
		} ).map( function(server) {
			// make copies so we can decorate
			return Object.assign( {}, server, { offine: false } );
		} );
		
		// augment with offline contributors (not so easy)
		// groups:GROUP_ID created:<RIGHT_SIDE_RANGE modified:>=LEFT_SIDE_RANGE
		var sopts = {
			query: `groups:${group.id} created:<${this.epochEnd} modified:>=${this.epochStart}`,
			offset: 0,
			limit: config.max_servers_per_group || 1000,
		};
		app.api.get( 'app/search_servers', sopts, this.receiveResults.bind(this) );
	}
	
	receiveResults(resp) {
		// render snapshot details
		var self = this;
		var args = this.args;
		var group = this.group;
		var servers = this.servers;
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		if (resp && resp.rows) resp.rows.forEach( function(server) {
			// skip online servers, blend rest in
			if (app.servers[server.id]) return;
			server.offline = false; // pretend all servers are "online" for this page
			server.info.booted = 0; // suppress uptime display
			servers.push( server );
		} );
		
		// sort servers by label/hostname ascending
		servers.sort( function(a, b) {
			return (a.title || a.hostname).toLowerCase().localeCompare( (b.title || b.hostname).toLowerCase() );
		} );
		
		// assign colors
		servers.forEach( function(server, idx) {
			server.color = app.colors[ idx % app.colors.length ];
		} );
		
		var nice_match = '';
		if (group.hostname_match == '(?!)') nice_match = '(None)';
		else nice_match = '<span class="regexp">/' + group.hostname_match + '/</span>';
		
		var nice_email = 'n/a';
		if (group.alert_email) nice_email = '<i class="mdi mdi-email-outline">&nbsp;</i>' + group.alert_email;
		
		// give hint for behavior in components (like the server table)
		this.groupMode = 'history';
		
		html += '<div class="box" style="border:none;">';
			html += '<div class="box_title">';
				html += '<div class="box_title_left" style="color:var(--green)">' + ucfirst(args.mode) + ' &mdash; ' + this.histTitle + '</div>';
				html += '<div class="box_title_left"><div class="button secondary mobile_collapse" onClick="$P().chooseHistoricalView(true)"><i class="mdi mdi-calendar-cursor">&nbsp;</i><span>Select Range...</span></div></div>';
				
				html += '<div class="box_title_right"><div class="button mobile_collapse tablet_hide" onClick="$P().histNavNext()"><span>Next ' + ucfirst(this.histUnit) + '&nbsp;</span><i class="mdi mdi-chevron-right"></i></div></div>';
				html += '<div class="box_title_right"><div class="button mobile_collapse tablet_hide" onClick="$P().histNavPrev()"><i class="mdi mdi-chevron-left">&nbsp;</i><span>Prev ' + ucfirst(this.histUnit) + '</span></div></div>';
				
			html += '</div>';
		html += '</div>';
		
		html += '<div class="box">';
			html += '<div class="box_title">';
				html += 'Group Summary &mdash; ' + this.histTitle;
				
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
						html += '<div class="info_label">Group ID</div>';
						html += '<div class="info_value monospace">' + group.id + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Group Title</div>';
						html += '<div class="info_value">' + this.getNiceGroup(group) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Created</div>';
						html += '<div class="info_value">' + this.getRelativeDateTime(group.created) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Modified</div>';
						html += '<div class="info_value">' + this.getRelativeDateTime(group.modified) + '</div>';
					html += '</div>';
					
					// row 2
					html += '<div>';
						html += '<div class="info_label">Hostname Match</div>';
						html += '<div class="info_value regexp">' + nice_match + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Servers</div>';
						html += '<div class="info_value" id="d_vg_stat_servers">' + commify(this.servers.length) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Alert Email</div>';
						html += '<div class="info_value">' + nice_email + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Alert Web Hook</div>';
						html += '<div class="info_value">' + (group.alert_web_hook ? this.getNiceWebHook(group.alert_web_hook, true) : 'n/a') + '</div>';
					html += '</div>';
					
					// row 3
					html += '<div>';
						html += '<div class="info_label">Architectures</div>';
						html += '<div class="info_value" id="d_vg_stat_arches">' + this.getNiceArches(this.servers) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Operating Systems</div>';
						html += '<div class="info_value" id="d_vg_stat_oses">' + this.getNiceOSes(this.servers) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">CPU Types</div>';
						html += '<div class="info_value" id="d_vg_stat_cputypes">' + this.getNiceCPUTypes(this.servers) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Virtualization</div>';
						html += '<div class="info_value" id="d_vg_stat_virts">' + this.getNiceVirts(this.servers) + '</div>';
					html += '</div>';
					
				html += '</div>'; // summary grid
			html += '</div>'; // box content
		html += '</div>'; // box
		
		// server table
		html += '<div id="d_vg_servers"></div>';
		
		// monitors
		html += '<div class="box" id="d_vg_monitors">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" onInput="$P().applyMonitorFilter(this)"></div>';
				html += this.getChartSizeSelector();
				html += 'Group Monitors &mdash; ' + this.histTitle + ' <span class="s_grp_filtered"></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// alerts
		html += '<div class="box" id="d_vs_alerts" style="">';
			html += '<div class="box_title">';
				html += 'Group Alerts &mdash; ' + this.histTitle;
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
					onChange: '$P().applyJobHistoryFilters()',
					'data-shrinkwrap': 1
				}) + '</div>';
				
				html += 'Group Jobs &mdash; ' + this.histTitle;
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html(html);
		
		this.updateGroupServerTable(); // this populates visibleServerIDs, mind
		
		this.setupGroupMonitors();
		this.fetchAlertHistory();
		this.fetchJobHistory();
		
		SingleSelect.init( this.div.find('#fe_vs_job_filter, .sel_chart_size') );
	}
	
	renderGroupFilteredSections() {
		// no-op for this page
	}
	
	setupGroupMonitors() {
		// setup custom monitors
		var self = this;
		var group = this.group;
		var monitors = this.monitors = [];
		var html = '';
		html += '<div class="chart_grid_horiz ' + (app.getPref('chart_size') || 'medium') + '">';
		
		app.monitors.forEach( function(mon_def) {
			if (!mon_def.display) return;
			if (mon_def.groups.length && !mon_def.groups.includes(group.id)) return;
			monitors.push(mon_def);
			
			html += '<div><canvas id="c_vg_' + mon_def.id + '" class="chart"></canvas></div>';
		} );
		
		html += '</div>';
		this.div.find('#d_vg_monitors > div.box_content').html( html );
		
		if (!monitors.length) {
			// odd situation, no monitors match this group
			this.div.find('#d_vg_monitors').hide();
			return;
		}
		if (!this.servers.length) {
			this.div.find('#d_vg_monitors > div.box_content').html( '<div class="inline_page_message">No data found in the selected range.</div>' );
			return;
		}
		
		monitors.forEach( function(def, idx) {
			var chart = self.createChart({
				"canvas": '#c_vg_' + def.id,
				"title": def.title,
				"dataType": def.data_type,
				"dataSuffix": def.suffix,
				"delta": def.delta || false,
				"deltaMinValue": def.delta_min_value ?? false,
				"divideByDelta": def.divide_by_delta || false,
				"minVertScale": def.min_vert_scale || 0,
				"showDataGaps": false,
				"fill": false,
				"live": true,
				"_allow_zoom": true,
				"_allow_flatten": true,
				"_idx": idx,
				"zoom": {
					xMin: self.epochStart,
					xMax: self.epochEnd
				},
			});
			self.charts[ def.id ] = chart;
			self.updateChartFlatten(def.id);
			self.setupChartHover(def.id);
		});
		
		// setup async server requests
		this.serverQueue = [ ...this.servers ];
		this.serverRequestsInFlight = 0;
		this.serverRequestsMax = config.server_requests_max || 6;
		
		for (var idx = 0; idx < this.serverRequestsMax; idx++) {
			this.manageServerRequests();
		}
		
		// prepopulate filter if saved
		if (this.monitorFilter) {
			var $elem = this.div.find('#d_vg_monitors .box_title_widget input[type="text"]');
			$elem.val( this.monitorFilter );
			this.applyMonitorFilter( $elem.get(0) );
		}
	}
	
	manageServerRequests() {
		// manage server requests for monitor data
		var self = this;
		var monitors = this.monitors;
		var handleError = function() { self.serverRequestsInFlight--; self.manageServerRequests(); };
		
		if (!this.active || !this.serverQueue || !this.serverQueue.length) return;
		if (this.serverRequestsInFlight >= this.serverRequestsMax) return;
		
		var server = this.serverQueue.shift();
		this.serverRequestsInFlight++;
		
		var opts = {
			server: server.id,
			sys: this.sys.id,
			date: this.epochStart,
			limit: this.chartLimit
		};
		
		// request snapshot hour from server
		app.api.post( 'app/get_historical_monitor_data', opts, function(resp) {
			if (!self.active) return; // sanity
			self.serverRequestsInFlight--; 
			
			// now iterate over all our monitors
			monitors.forEach( function(def, idx) {
				var chart = self.charts[def.id];
				if (find_object( chart.layers, { id: server.id } )) return; // sanity
				
				chart.addLayer({
					id: server.id,
					title: self.getNiceServerText(server),
					data: self.getMonitorChartData(resp.rows, def),
					color: server.color,
					opacity: server.offline ? 0.5 : 1.0,
					hidden: !self.visibleServerIDs[ server.id ]
				});
			}); // foreach mon
			
			// execute another request if more are pending
			requestAnimationFrame( self.manageServerRequests.bind(self) );
			
		}, handleError); // api.get
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
		delete this.visibleServerIDs;
		delete this.serverQueue;
		delete this.serverRequestsInFlight;
		delete this.serverRequestsMax;
		delete this.donutDashUnits;
		delete this.detailAnimation;
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
