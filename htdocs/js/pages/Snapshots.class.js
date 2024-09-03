Page.Snapshots = class Snapshots extends Page.ServerUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
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
		app.setHeaderTitle( '<i class="mdi mdi-camera-outline">&nbsp;</i>Snapshot History' ); // or: cloud-snapshot-outline
		
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
							options: [['', 'Any Source'], ['alert', 'Alert'], ['user', 'User'], ['watch', 'Watch']],
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
					var date_items = [
						['', 'All Dates'],
						['now', 'This Hour'],
						['lasthour', 'Last Hour'],
						['today', 'Today'],
						['yesterday', 'Yesterday'],
						['month', 'This Month'],
						['lastmonth', 'Last Month'],
						['year', 'This Year'],
						['lastyear', 'Last Year'],
						['older', 'Older']
					];
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
		this.records = [];
		this.opts = {
			query: query.trim(),
			offset: args.offset || 0,
			limit: args.limit || config.items_per_page,
			compact: 1
		};
		switch (args.sort) {
			case 'date_asc':
				this.opts.sort_by = '_id'; 
				this.opts.sort_dir = 1;
			break;
			
			case 'date_desc':
				this.opts.sort_by = '_id'; 
				this.opts.sort_dir = -1;
			break;
		} // sort
		
		app.api.get( 'app/search_snapshots', this.opts, this.receiveResults.bind(this) );
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
			cols: ["Snapshot ID", "Source", "Server", "Uptime", "Load Avg", "Mem Avail", "Date/Time"],
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
			if (!item.data) item.data = {}; // sanity
			if (!item.data.memory) item.data.memory = {}; // sanity
			
			return [
				'<b>' + self.getNiceSnapshotID(item, true) + '</b>',
				self.getNiceSnapshotSource(item),
				self.getNiceServer(item.server, true),
				get_text_from_seconds(item.data.uptime_sec || 0, true, true),
				item.data.load.map( function(avg) { return short_float(avg); } ).join(', '),
				get_text_from_bytes(item.data.memory.available || 0),
				self.getNiceDateTime(item.date)
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
		
		var snapshot = this.snapshot = resp.rows.shift();
		if (!snapshot) return this.doFullPageError("Snapshot ID not found: " + this.args.id);
		
		// var icon = '<i class="mdi mdi-monitor-screenshot">&nbsp;</i>';
		
		// this.div.html( '<pre>' + encode_entities( JSON.stringify(snapshot, null, "\t") ) + '</pre>' );
		
		app.setHeaderNav([
			{ icon: 'camera-outline', loc: '#Snapshots?sub=list', title: 'Snapshots' },
			{ icon: 'monitor-screenshot', title: "Snapshot Details" }
		]);
		
		// app.setHeaderTitle( icon + 'Snapshot Details' );
		app.setWindowTitle( "Viewing Snapshot #" + (this.snapshot.id) + "" );
		
		html += '<div class="box">';
			html += '<div class="box_title">';
				html += 'Snapshot Summary';
				
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
						html += '<div class="info_label">Server</div>';
						html += '<div class="info_value">' + this.getNiceServer(snapshot.server, true) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Source</div>';
						html += '<div class="info_value">' + this.getNiceSnapshotSource(snapshot) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Date/Time</div>';
						html += '<div class="info_value">' + this.getNiceDateTime(snapshot.date) + '</div>';
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
				html += 'Quick Look &mdash; Last Minute';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// monitor dash grid
		html += '<div class="dash_grid">';
			html += this.getMonitorGrid(snapshot);
		html += '</div>';
		
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
		
		this.getSnapshotAlerts();
		this.getSnapshotJobs();
		this.setupQuickMonitors();
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
		html += '<div class="chart_grid_horiz">';
		
		config.quick_monitors.forEach( function(def) {
			// { "id": "cpu_load", "title": "CPU Load Average", "source": "cpu.avgLoad", "type": "float", "suffix": "" },
			html += '<div><canvas id="c_vs_' + def.id + '" class="chart"></canvas></div>';
		} );
		
		html += '</div>';
		this.div.find('#d_vs_quickmon > div.box_content').html( html );
		
		var render_chart_overlay = function(key) {
			$('.pxc_tt_overlay').html(
				'<div class="chart_toolbar ct_' + key + '">' + 
					'<div class="chart_icon ci_di" title="Download Image" onClick="$P().chartDownload(\'' + key + '\')"><i class="mdi mdi-cloud-download-outline"></i></div>' + 
					'<div class="chart_icon ci_cl" title="Copy Image Link" onClick="$P().chartCopyLink(\'' + key + '\',this)"><i class="mdi mdi-clipboard-pulse-outline"></i></div>' + 
				'</div>' 
			);
		};
		
		config.quick_monitors.forEach( function(def, idx) {
			var chart = self.createChart({
				"canvas": '#c_vs_' + def.id,
				"title": def.title,
				"dataType": def.type,
				"dataSuffix": def.suffix,
				"minVertScale": def.minVertScale || 0,
				"legend": false // single layer, no legend needed
			});
			chart.on('mouseover', function(event) { render_chart_overlay(def.id); });
			self.charts[ def.id ] = chart;
			
			chart.addLayer({
				id: snapshot.server,
				title: server ? app.formatHostname(server.hostname) : snapshot.server,
				data: self.getQuickMonChartData(snapshot.quickmon || [], def.id),
				color: app.colors[ idx % app.colors.length ]
			});
		});
	}
	
	showDeleteSnapshotDialog() {
		// delete snapshot invocation after user confirmation
		var self = this;
		var snapshot = this.snapshot;
		
		Dialog.confirmDanger( 'Delete Snapshot', "Are you sure you want to permanently delete the current snapshot?  There is no way to undo this operation.", 'Delete', function(result) {
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
		switch (key) {
			case 'activeAlerts': this.getSnapshotAlerts(); break;
		}
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
