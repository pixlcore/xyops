Page.Snapshots = class Snapshots extends Page.ServerUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		
		// debounce for group snaps
		this.applyServerTableFiltersDebounce = debounce( this.applyServerTableFilters.bind(this), 250 );
		this.renderProcessTableDebounce = debounce( this.renderGroupProcessTable.bind(this), 1000 );
		this.renderConnectionTableDebounce = debounce( this.renderGroupConnectionTable.bind(this), 1000 );
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		if (!args.sub && args.id) args.sub = 'view';
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// snapshot history / search
		var self = this;
		var args = this.args;
		
		if (!args.offset) args.offset = 0;
		if (!args.limit) args.limit = 25;
		
		app.setWindowTitle('Snapshot History');
		app.setHeaderTitle( '<i class="mdi mdi-monitor-multiple">&nbsp;</i>Snapshot History' ); // or: cloud-snapshot-outline
		
		var html = '';
		html += '<div class="box" style="border:none;">';
		html += '<div class="box_content" style="padding:20px;">';
			
			// options
			html += '<div id="d_s_adv" class="form_grid" style="margin-bottom:25px">';
				
				// source
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-palette-swatch-outline">&nbsp;</i>Snapshot Source:',
						content: this.getFormMenuSingle({
							id: 'fe_ss_source',
							title: 'Select Source',
							placeholder: 'All Sources',
							options: [['', 'Any Source'], ['alert', 'Alert'], ['user', 'User'], ['watch', 'Watch'], ['job', 'Job']],
							value: args.source || '',
							default_icon: 'palette-swatch-outline',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// server
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-router-network">&nbsp;</i>Server:',
						content: this.getFormMenuSingle({
							id: 'fe_ss_server',
							title: 'Select Server',
							placeholder: 'All Servers',
							options: [['', 'Any Server']].concat( sort_by(Object.values(app.servers), 'hostname').map( function(server) {
								return merge_objects( { title: server.hostname }, server );
							} ) ),
							value: args.server || '',
							default_icon: 'router-network',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// group
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-server-network">&nbsp;</i>Group:',
						content: this.getFormMenuSingle({
							id: 'fe_ss_group',
							title: 'Select Group',
							placeholder: 'All Groups',
							options: [['', 'Any Group']].concat( app.groups ),
							value: args.group || '',
							default_icon: 'server-network',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// date
				html += '<div class="form_cell">';
					var date_items = config.ui.date_range_menu_items;
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-calendar-multiple">&nbsp;</i>Date Range:',
						content: this.getFormMenuSingle({
							id: 'fe_ss_date',
							title: 'Date Range',
							options: date_items.map( function(item) { 
								return item[0] ? { id: item[0], title: item[1], icon: 'calendar-range' } : item; 
							} ),
							value: args.date,
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// sort
				html += '<div class="form_cell">';
					var sort_items = [
						{ id: 'date_desc', title: 'Newest', icon: 'sort-descending' },
						{ id: 'date_asc', title: 'Oldest', icon: 'sort-ascending' }
					];
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-sort">&nbsp;</i>Sort Results:',
						content: this.getFormMenuSingle({
							id: 'fe_ss_sort',
							title: 'Sort Results',
							options: sort_items,
							value: args.sort,
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
			html += '</div>'; // form_grid
		
		// buttons at bottom
		html += '<div class="box_buttons" style="padding:0">';
			html += '<div class="button primary" onMouseUp="$P().navSearch()"><i class="mdi mdi-magnify">&nbsp;</i>Search</div>';
			// html += '<div class="clear"></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		html += '<div id="d_search_results"><div class="loading_container"><div class="loading"></div></div></div>';
		
		this.div.html( html );
		
		var sargs = this.getSearchArgs();
		
		SingleSelect.init( this.div.find('#fe_ss_source, #fe_ss_server, #fe_ss_group, #fe_ss_date, #fe_ss_sort') );
		// $('.header_search_widget').hide();
		
		this.div.find('#fe_ss_source, #fe_ss_server, #fe_ss_group, #fe_ss_date, #fe_ss_sort').on('change', function() {
			self.navSearch();
		});
		
		this.doSearch();
		
		return true;
	}
	
	getSearchArgs() {
		// get form values, return search args object
		var args = {};
		
		var source = this.div.find('#fe_ss_source').val();
		if (source) args.source = source;
		
		var server = this.div.find('#fe_ss_server').val();
		if (server) args.server = server;
		
		var group = this.div.find('#fe_ss_group').val();
		if (group) args.group = group;
		
		var date = this.div.find('#fe_ss_date').val();
		if (date) args.date = date;
		
		var sort = this.div.find('#fe_ss_sort').val();
		if (sort != 'date_desc') args.sort = sort;
		
		if (!num_keys(args)) return null;
		
		return args;
	}
	
	navSearch() {
		// convert form into query and redirect
		app.clearError();
		
		var args = this.getSearchArgs();
		if (!args) {
			Nav.go( this.selfNav({}) );
			return;
		}
		
		Nav.go( this.selfNav(args) );
	}
	
	getSearchQuery(args) {
		// construct actual unbase simple query syntax
		var query = '';
		
		if (args.source) query += ' source:' + args.source;
		if (args.server) query += ' server:' + args.server;
		if (args.group) query += ' groups:' + args.group;
		
		if (args.date) {
			query += ' ' + this.getDateRangeQuery('date', args.date);
		}
		
		return query.trim();
	}
	
	doSearch() {
		// actually perform the search
		var args = this.args;
		var query = this.getSearchQuery(args);
		
		// compose search query
		var sopts = {
			query: query.trim(),
			offset: args.offset || 0,
			limit: args.limit || config.items_per_page,
			compact: 1
		};
		switch (args.sort) {
			case 'date_asc':
				sopts.sort_by = '_id'; 
				sopts.sort_dir = 1;
			break;
			
			case 'date_desc':
				sopts.sort_by = '_id'; 
				sopts.sort_dir = -1;
			break;
		} // sort
		
		app.api.get( 'app/search_snapshots', sopts, this.receiveResults.bind(this) );
	}
	
	receiveResults(resp) {
		// receive search results
		var self = this;
		var $results = this.div.find('#d_search_results');
		var html = '';
		
		if (!this.active) return; // sanity
		
		this.lastSearchResp = resp;
		this.snapshots = [];
		if (resp.rows) this.snapshots = resp.rows;
		
		var grid_args = {
			resp: resp,
			cols: ["Snapshot ID", "Source", "Target", "Uptime", "Load Avg", "Mem Avail", "Date/Time"],
			data_type: 'snapshot',
			offset: this.args.offset || 0,
			limit: this.args.limit,
			pagination_link: '$P().searchPaginate'
		};
		
		html += '<div class="box">';
		
		html += '<div class="box_title" style="' + (this.snapshots.length ? 'padding-bottom:10px' : '') + '">';
			html += this.getSearchArgs() ? 'Search Results' : 'All Snapshots';
			html += '<div class="clear"></div>';
		html += '</div>';
		
		html += '<div class="box_content table">';
		
		html += this.getPaginatedGrid( grid_args, function(item, idx) {
			var nice_target = '', nice_uptime = 'n/a', nice_avg = 'n/a', nice_mem = 'n/a';
			
			if (item.type == 'group') {
				nice_target = self.getNiceGroup( item.groups[0], true );
			}
			else {
				if (!item.data) item.data = {}; // sanity
				if (!item.data.memory) item.data.memory = {}; // sanity
				if (!item.data.load) item.data.load = [0]; // sanity
				nice_target = self.getNiceServer(item.server, true);
				nice_uptime = get_text_from_seconds(item.data.uptime_sec || 0, true, true);
				nice_avg = item.data.load.map( function(avg) { return short_float(avg); } ).join(', ');
				nice_mem = get_text_from_bytes(item.data.memory.available || 0);
			}
			
			return [
				'<b>' + self.getNiceSnapshotID(item, true) + '</b>',
				self.getNiceSnapshotSource(item),
				nice_target,
				nice_uptime,
				nice_avg,
				nice_mem,
				self.getRelativeDateTime(item.date)
			];
		} );
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		$results.html( html );
	}
	
	searchPaginate(offset) {
		// special hook for intercepting pagination clicks
		// FUTURE: history.replaceState to update the URI with new offset
		this.args.offset = offset;
		this.div.find('#d_search_results .box_content').addClass('loading');
		this.doSearch();
	}
	
	gosub_view(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		app.setHeaderTitle( '...' );
		
		this.snapshot = null;
		this.charts = {};
		
		this.loading();
		app.api.get( 'app/search_snapshots', { query: '#id:' + args.id, verbose: 1 }, this.receive_snapshot.bind(this), this.fullPageError.bind(this) );
		return true;
	}
	
	receive_snapshot(resp) {
		// render snapshot details
		var self = this;
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		var snapshot = this.snapshot = resp.rows[0];
		if (!snapshot) return this.doFullPageError("Snapshot ID not found: " + this.args.id);
		
		if (snapshot.type == 'group') return this.receive_group_snapshot(resp);
		
		app.setHeaderNav([
			{ icon: 'monitor-multiple', loc: '#Snapshots?sub=list', title: 'Snapshots' },
			{ icon: 'monitor-screenshot', title: "Snapshot Details" }
		]);
		
		// app.setHeaderTitle( icon + 'Snapshot Details' );
		app.setWindowTitle( "Viewing Snapshot #" + (this.snapshot.id) + "" );
		
		html += '<div class="box">';
			html += '<div class="box_title">';
				html += 'Snapshot Summary';
				html += '<div class="button right danger" onMouseUp="$P().showDeleteSnapshotDialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i>Delete...</div>';
				html += '<div class="clear"></div>';
			html += '</div>'; // title
			
			html += '<div class="box_content table">';
				html += '<div class="summary_grid">';
				
					// row 1
					html += '<div>';
						html += '<div class="info_label">Snapshot ID</div>';
						html += '<div class="info_value">' + this.getNiceSnapshotID(snapshot, false) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Server</div>';
						html += '<div class="info_value">' + this.getNiceServer(snapshot.server, true) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Source</div>';
						html += '<div class="info_value">' + this.getNiceSnapshotSource(snapshot) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Date/Time</div>';
						html += '<div class="info_value">' + this.getRelativeDateTime(snapshot.date) + '</div>';
					html += '</div>';
					
					// row 2
					html += '<div>';
						html += '<div class="info_label">Groups</div>';
						html += '<div class="info_value">' + this.getNiceGroupList(snapshot.groups) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">IP Address</div>';
						html += '<div class="info_value">' + this.getNiceIP(snapshot.ip) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Architecture</div>';
						html += '<div class="info_value">' + this.getNiceArch(snapshot.data.arch) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Operating System</div>';
						html += '<div class="info_value">' + this.getNiceOS(snapshot.data.os) + '</div>';
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
						html += '<div class="info_label">Server Uptime</div>';
						html += '<div class="info_value">' + this.getNiceUptime(snapshot.data.uptime_sec) + '</div>';
					html += '</div>';
					
				html += '</div>'; // summary grid
			html += '</div>'; // box content
		html += '</div>'; // box
		
		// alerts
		html += '<div class="box" id="d_vs_alerts" style="display:none">';
			html += '<div class="box_title">';
				html += 'Snapshot Alerts';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// jobs
		html += '<div class="box" id="d_vs_jobs" style="display:none">';
			html += '<div class="box_title">';
				html += 'Snapshot Jobs';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// quickmon charts
		html += '<div class="box" id="d_vs_quickmon">';
			html += '<div class="box_title">';
			html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" onInput="$P().applyQuickMonitorFilter(this)"></div>';
			html += this.getChartSizeSelector('chart_size_quick');
				html += 'Quick Look &mdash; Snapshot Minute';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// mem details
		html += '<div class="box" id="d_vs_mem">';
			html += '<div class="box_title">';
				html += 'Memory Details';
			html += '</div>';
			html += '<div class="box_content table">';
				html += this.getMemDetails(snapshot);
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// cpu details
		html += '<div class="box" id="d_vs_cpus">';
			html += '<div class="box_title">';
				html += 'CPU Details';
			html += '</div>';
			html += '<div class="box_content table">';
				html += this.getCPUDetails(snapshot);
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// monitor dash grid
		html += '<div class="dash_grid">';
			html += this.getMonitorGrid(snapshot);
		html += '</div>';
		
		// monitors
		html += '<div class="box" id="d_vs_monitors">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" onInput="$P().applyMonitorFilter(this)"></div>';
				html += this.getChartSizeSelector();
				html += 'Server Monitors &mdash; Snapshot Hour';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// processes
		html += '<div class="box" id="d_vs_procs">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" data-id="t_snap_procs" onInput="$P().applyTableFilter(this)"></div>';
				html += 'Active Processes';
			html += '</div>';
			html += '<div class="box_content table">';
				html += this.getProcessTable(snapshot);
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// connections
		html += '<div class="box" id="d_vs_conns">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" data-id="t_snap_conns" onInput="$P().applyTableFilter(this)"></div>';
				html += 'Network Connections';
			html += '</div>';
			html += '<div class="box_content table">';
				html += this.getConnectionTable(snapshot);
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// network interfaces
		html += '<div class="box" id="d_vs_ifaces">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" data-id="t_snap_ifaces" onInput="$P().applyTableFilter(this)"></div>';
				html += 'Network Interfaces';
			html += '</div>';
			html += '<div class="box_content table">';
				html += this.getInterfaceTable(snapshot);
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// mounts
		html += '<div class="box" id="d_vs_fs">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" data-id="t_snap_fs" onInput="$P().applyTableFilter(this)"></div>';
				html += 'Filesystems';
			html += '</div>';
			html += '<div class="box_content table">';
				html += this.getMountTable(snapshot);
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html(html);
		
		SingleSelect.init( this.div.find('select.sel_chart_size') );
		
		this.getSnapshotAlerts();
		this.getSnapshotJobs();
		this.setupQuickMonitors();
		this.setupMonitors();
	}
	
	getSnapshotAlerts() {
		// fetch alerts associated with snapshot
		var self = this;
		var snapshot = this.snapshot;
		
		if (!snapshot.alerts || !snapshot.alerts.length) {
			this.alerts = [];
			return this.renderSnapshotAlerts();
		}
		
		app.api.post( 'app/get_alert_invocations', { ids: snapshot.alerts }, function(resp) {
			self.alerts = resp.alerts || [];
			self.renderSnapshotAlerts();
		});
	}
	
	getSnapshotJobs() {
		// fetch info about all snapshot jobs
		var self = this;
		var snapshot = this.snapshot;
		
		if (!snapshot.jobs || !snapshot.jobs.length) {
			this.jobs = [];
			return this.renderSnapshotJobs();
		}
		
		app.api.post( 'app/get_jobs', { ids: snapshot.jobs }, function(resp) {
			self.jobs = resp.jobs || [];
			self.renderSnapshotJobs();
		});
	}
	
	setupQuickMonitors() {
		// render empty quickmon charts, then request full data
		var self = this;
		var snapshot = this.snapshot;
		var server = app.servers[ snapshot.server ] || null;
		
		var html = '';
		html += '<div class="chart_grid_horiz ' + (app.getPref('chart_size_quick') || 'medium') + '">';
		
		config.quick_monitors.forEach( function(def) {
			// { "id": "cpu_load", "title": "CPU Load Average", "source": "cpu.avgLoad", "type": "float", "suffix": "" },
			html += '<div><canvas id="c_vs_' + def.id + '" class="chart"></canvas></div>';
		} );
		
		html += '</div>';
		this.div.find('#d_vs_quickmon > div.box_content').html( html );
		
		config.quick_monitors.forEach( function(def, idx) {
			var chart = self.createChart({
				"canvas": '#c_vs_' + def.id,
				"title": def.title,
				"dataType": def.type,
				"dataSuffix": def.suffix,
				"minVertScale": def.min_vert_scale || 0,
				"delta": def.delta || false,
				"deltaMinValue": def.delta_min_value ?? false,
				"divideByDelta": def.divide_by_delta || false,
				"legend": false, // single layer, no legend needed
				"_quick": true
			});
			self.charts[ def.id ] = chart;
			self.setupChartHover(def.id);
			
			chart.addLayer({
				id: snapshot.server,
				title: server ? self.getNiceServerText(server) : snapshot.server,
				data: self.getQuickMonChartData(snapshot.quickmon || [], def.id),
				color: app.colors[ idx % app.colors.length ]
			});
		});
		
		// prepopulate filter if saved
		if (this.quickMonitorFilter) {
			var $elem = this.div.find('#d_vs_quickmon .box_title_widget input[type="text"]');
			$elem.val( this.quickMonitorFilter );
			this.applyQuickMonitorFilter( $elem.get(0) );
		}
	}
	
	setupMonitors() {
		// setup custom monitors
		var self = this;
		var snapshot = this.snapshot;
		var server = app.servers[ snapshot.server ] || { id: snapshot.server, hostname: snapshot.server };
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
		
		// center charts around snapshot timestamp (normalized to minute)
		var epoch_minute = snapshot.date - (snapshot.date % 60);
		this.epochStart = epoch_minute - 1800;
		this.epochEnd = epoch_minute + 1800;
		
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
				// "zoom": {
				// 	xMin: self.epochStart,
				// 	xMax: self.epochEnd
				// },
				"_allow_zoom": true
			});
			self.charts[ def.id ] = chart;
			self.setupChartHover(def.id);
		});
		
		// request data from server
		var opts = {
			server: server.id,
			sys: 'hourly',
			date: this.epochStart,
			limit: 60
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
				
				var rows = chart.layers[0].data;
				for (var idx = 0, len = rows.length; idx < len; idx++) {
					var row = rows[idx];
					if (!row.label && (row.x == epoch_minute)) {
						row.label = { "text": "Snap", "color": "gray", "tooltip": false };
						idx = len;
					}
				}
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
	
	receive_group_snapshot(resp) {
		// render snapshot details
		var self = this;
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		var snapshot = this.snapshot = resp.rows[0];
		if (!snapshot) return this.doFullPageError("Snapshot ID not found: " + this.args.id);
		
		// format data for group view
		var group = this.group = snapshot.group_def;
		var servers = snapshot.servers;
		
		servers.forEach( function(server, idx) {
			server.snapshot = snapshot.snapshots[idx];
			server.quick = server.snapshot; // for mem/cpu donuts
			server.quick.data.mem = server.quick.data.memory;
			server.quickmon = snapshot.quickmons[idx]; // for quckmon graphs
		} );
		
		// sort servers by label/hostname ascending
		servers.sort( function(a, b) {
			return (a.title || a.hostname).toLowerCase().localeCompare( (b.title || b.hostname).toLowerCase() );
		} );
		
		// assign colors
		servers.forEach( function(server, idx) {
			server.color = app.colors[ idx % app.colors.length ];
		} );
		
		this.servers = servers;
		this.epoch = snapshot.date;
		
		app.setHeaderNav([
			{ icon: 'monitor-multiple', loc: '#Snapshots?sub=list', title: 'Snapshots' },
			{ icon: 'monitor-screenshot', title: "Group Snapshot Details" }
		]);
		
		// app.setHeaderTitle( icon + 'Snapshot Details' );
		app.setWindowTitle( "Group Snapshot #" + (this.snapshot.id) + "" );
		
		var nice_match = '';
		if (group.hostname_match == '(?!)') nice_match = '(None)';
		else nice_match = '<span class="regexp">/' + group.hostname_match + '/</span>';
		
		var nice_email = 'n/a';
		if (group.alert_email) nice_email = '<i class="mdi mdi-email-outline">&nbsp;</i>' + group.alert_email;
		
		html += '<div class="box">';
			html += '<div class="box_title">';
				html += 'Group Snapshot Summary';
				
				html += '<div class="button right danger" onMouseUp="$P().showDeleteSnapshotDialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i>Delete...</div>';
				// html += '<div class="button secondary right" onMouseUp="$P().do_edit_from_view()"><i class="mdi mdi-file-edit-outline">&nbsp;</i>Edit Event...</div>';
				// html += '<div class="button right" onMouseUp="$P().do_run_from_view()"><i class="mdi mdi-run-fast">&nbsp;</i>Run Now</div>';
				html += '<div class="clear"></div>';
			html += '</div>'; // title
			
			html += '<div class="box_content table">';
				html += '<div class="summary_grid">';
				
					// row 1
					html += '<div>';
						html += '<div class="info_label">Snapshot ID</div>';
						html += '<div class="info_value">' + this.getNiceSnapshotID(snapshot, false) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Group</div>';
						html += '<div class="info_value">' + this.getNiceGroup(this.group) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Source</div>';
						html += '<div class="info_value">' + this.getNiceSnapshotSource(snapshot) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Date/Time</div>';
						html += '<div class="info_value">' + this.getRelativeDateTime(snapshot.date) + '</div>';
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
		
		// alerts
		html += '<div class="box" id="d_vs_alerts" style="display:none">';
			html += '<div class="box_title">';
				html += 'Snapshot Alerts <span class="s_grp_filtered"></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// jobs
		html += '<div class="box" id="d_vs_jobs" style="display:none">';
			html += '<div class="box_title">';
				html += 'Snapshot Jobs <span class="s_grp_filtered"></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// quickmon charts
		html += '<div class="box" id="d_vg_quickmon" style="display:none">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" onInput="$P().applyQuickMonitorFilter(this)"></div>';
				html += this.getChartSizeSelector('chart_size_quick');
				html += 'Quick Look &mdash; Snapshot Minute <span class="s_grp_filtered"></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// mem details
		html += '<div class="box" id="d_vg_mem">';
			html += '<div class="box_title">';
				html += this.getCPUMemMergeSelector('mem');
				html += 'Group Memory Details <span class="s_grp_filtered"></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += this.getGroupMemDetails();
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// cpu details
		html += '<div class="box" id="d_vg_cpus">';
			html += '<div class="box_title">';
				html += this.getCPUMemMergeSelector('cpu');
				html += 'Group CPU Details <span class="s_grp_filtered"></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += this.getGroupCPUDetails();
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// monitors
		html += '<div class="box" id="d_vg_monitors">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" onInput="$P().applyMonitorFilter(this)"></div>';
				html += this.getChartSizeSelector();
				html += 'Group Monitors &mdash; Snapshot Hour <span class="s_grp_filtered"></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// processes
		html += '<div class="box" id="d_vg_procs">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" data-id="t_snap_procs" onInput="$P().applyTableFilter(this)"></div>';
				html += 'Group Processes &mdash; Snapshot <span class="s_grp_filtered"></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// connections
		html += '<div class="box" id="d_vg_conns">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" data-id="t_snap_conns" onInput="$P().applyTableFilter(this)"></div>';
				html += 'Group Connections &mdash; Snapshot <span class="s_grp_filtered"></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html(html);
		
		SingleSelect.init( this.div.find('select.sel_chart_size, select.sel_cpu_mem_merge') );
		
		this.updateGroupServerTable(); // this populates visibleServerIDs, mind
		
		this.getSnapshotAlerts();
		this.getSnapshotJobs();
		
		this.setupGroupQuickMonitors();
		this.setupGroupMonitors();
		
		// this.updateDonutDashUnits();
	}
	
	updateDonutDashUnits() {
		// called every 1s by server push
		if (this.donutDashUnits) {
			this.resetDetailAnimation();
			this.updateGroupMemDetails();
			this.updateGroupCPUDetails();
			this.startDetailAnimation();
		}
	}
	
	renderGroupFilteredSections() {
		// render all sections that are affected by visibleServerIDs
		this.renderSnapshotJobs();
		this.renderSnapshotAlerts();
		this.renderGroupProcessTable();
		this.renderGroupConnectionTable();
		this.updateDonutDashUnits();
	}
	
	setupGroupQuickMonitors() {
		// render empty quickmon charts, then request full data
		var self = this;
		var group = this.group;
		var html = '';
		html += '<div class="chart_grid_horiz ' + (app.getPref('chart_size_quick') || 'medium') + '">';
		
		config.quick_monitors.forEach( function(def) {
			// { "id": "cpu_load", "title": "CPU Load Average", "source": "cpu.avgLoad", "type": "float", "suffix": "" },
			html += '<div><canvas id="c_vg_' + def.id + '" class="chart"></canvas></div>';
		} );
		
		html += '</div>';
		
		this.div.find('#d_vg_quickmon').show();
		this.div.find('#d_vg_quickmon > div.box_content').html( html );
		
		config.quick_monitors.forEach( function(def, idx) {
			var chart = self.createChart({
				"canvas": '#c_vg_' + def.id,
				"title": def.title,
				"dataType": def.type,
				"dataSuffix": def.suffix,
				"minVertScale": def.min_vert_scale || 0,
				"delta": def.delta || false,
				"deltaMinValue": def.delta_min_value ?? false,
				"divideByDelta": def.divide_by_delta || false,
				"fill": false,
				"clip": true,
				"live": true,
				"_quick": true,
				"_allow_flatten": true,
				"_idx": idx,
			});
			self.charts[ def.id ] = chart;
			self.updateChartFlatten(def.id);
			self.setupChartHover(def.id);
		});
		
		// we have all data already in this case (snapshot preload)
		this.servers.forEach( function(server) {
			var rows = server.quickmon;
			
			// now iterate over all quick monitors
			config.quick_monitors.forEach( function(def, idx) {
				var chart = self.charts[def.id];
				
				chart.addLayer({
					id: server.id,
					title: self.getNiceServerText(server),
					data: self.getQuickMonChartData(rows, def.id),
					color: server.color,
					hidden: !self.visibleServerIDs[ server.id ]
				});
			}); // foreach mon
		} ); // foreach server
		
		// prepopulate filter if saved
		if (this.quickMonitorFilter) {
			var $elem = this.div.find('#d_vg_quickmon .box_title_widget input[type="text"]');
			$elem.val( this.quickMonitorFilter );
			this.applyQuickMonitorFilter( $elem.get(0) );
		}
	}
	
	setupGroupMonitors() {
		// setup custom monitors
		var self = this;
		var group = this.group;
		var snapshot = this.snapshot;
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
				"_idx": idx
			});
			self.charts[ def.id ] = chart;
			self.updateChartFlatten(def.id);
			self.setupChartHover(def.id);
		});
		
		// center charts around snapshot timestamp (normalized to minute)
		var epoch_minute = snapshot.date - (snapshot.date % 60);
		this.epochStart = epoch_minute - 1800;
		this.epochEnd = epoch_minute + 1800;
		
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
		
		var snapshot = this.snapshot;
		var epoch_minute = snapshot.date - (snapshot.date % 60);
		
		var opts = {
			server: server.id,
			sys: 'hourly',
			date: this.epochStart,
			limit: 60
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
				
				var rows = chart.layers[ chart.layers.length - 1 ].data;
				for (var idx = 0, len = rows.length; idx < len; idx++) {
					var row = rows[idx];
					if (!row.label && (row.x == epoch_minute)) {
						row.label = { "text": "Snap", "color": "gray", "tooltip": false };
						idx = len;
					}
				}
			}); // foreach mon
			
			// call debounced update on process and connection tables
			self.renderProcessTableDebounce();
			self.renderConnectionTableDebounce();
			
			// execute another request if more are pending
			requestAnimationFrame( self.manageServerRequests.bind(self) );
			
		}, handleError); // api.get
	}
	
	showDeleteSnapshotDialog() {
		// delete snapshot invocation after user confirmation
		var self = this;
		var snapshot = this.snapshot;
		
		Dialog.confirmDanger( 'Delete Snapshot', "Are you sure you want to permanently delete the current snapshot?  There is no way to undo this operation.", ['trash-can', 'Delete'], function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Deleting Snapshot..." );
			
			app.api.post( 'app/delete_snapshot', { id: snapshot.id }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "Snapshot ID &ldquo;<b>" + snapshot.id + "</b>&rdquo; was deleted successfully.");
				
				if (!self.active) return; // sanity
				
				Nav.go('#Snapshots?sub=list');
			} ); // api.post
		} ); // confirm
	}
	
	onDataUpdate(key, data) {
		// refresh things as needed
		if ((this.args.sub == 'view') && (key == 'activeAlerts')) this.getSnapshotAlerts();
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		
		delete this.lastSearchResp;
		delete this.snapshots;
		delete this.snapshot;
		delete this.alerts;
		delete this.jobs;
		delete this.tables;
		delete this.donutDashUnits;
		delete this.chartZoom;
		delete this.serverQueue;
		delete this.serverRequestsInFlight;
		delete this.serverRequestsMax;
		
		// destroy charts if applicable (view page)
		if (this.charts) {
			for (var key in this.charts) {
				this.charts[key].destroy();
			}
			delete this.charts;
		}
		
		return true;
	}
	
};
