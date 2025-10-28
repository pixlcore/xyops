// Dashboard Page

// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the MIT License.
// See the LICENSE.md file in this repository.

Page.Dashboard = class Dashboard extends Page.PageUtils {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		this.args.limit = 25;
		
		app.setWindowTitle('Dashboard');
		app.setHeaderTitle( '<i class="mdi mdi-monitor-dashboard">&nbsp;</i>Dashboard' );
		app.showSidebar(true);
		
		var html = '';
		html += '<div class="dash_grid">';
		html += '</div>';
		
		// active alerts (performa) -- hide if none
		html += '<div class="box" id="d_dash_alerts" style="display:none">';
			html += '<div class="box_title">';
				html += 'Server Alerts';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// active jobs
		html += '<div class="box" id="d_dash_active">';
			html += '<div class="box_title">';
				html += 'Active Jobs';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// queued jobs
		html += '<div class="box" id="d_dash_queued" style="display:none">';
			html += '<div class="box_title">';
				html += 'Event Queues';
			html += '</div>';
			html += '<div class="box_content table">';
				// html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// internal jobs
		html += '<div class="box" id="d_dash_internal" style="display:none">';
			html += '<div class="box_title">';
				html += 'Internal Jobs';
			html += '</div>';
			html += '<div class="box_content table">';
				// html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// upcoming jobs
		html += '<div class="box" id="d_upcoming_jobs">';
			html += '<div class="box_title">';
				html += 'Upcoming Jobs';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// job day graph
		html += '<div class="box" id="d_job_day_graph" style="display:none">';
			html += '<div class="box_title">';
				html += '<span>Job History Day Graph</span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// quickmon charts
		html += '<div class="box charts" id="d_dash_monitors" style="display:none">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onClick="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" onInput="$P().applyQuickMonitorFilter(this)"></div>';
				html += this.getChartSizeSelector('chart_size_quick');
				html += 'Quick Look &mdash; All Servers';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('select.sel_chart_size') );
		
		this.updateDashGrid();
		this.renderActiveJobs();
		this.getQueueSummary();
		this.getUpcomingJobs();
		// this.setupQuickMonitors();
		this.renderActiveAlerts();
		this.renderInternalJobs();
		this.setupJobHistoryDayGraph();
		
		return true;
	}
	
	updateDashGrid() {
		var stats = app.stats;
		var day = stats.currentDay || { transactions: {} };
		var trans = day.transactions || {};
		var html = '';
		
		// masters
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + num_keys(app.masters) + '</div>';
			html += '<div class="dash_unit_label">Masters</div>';
		html += '</div>';
		
		// servers
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + num_keys(app.servers) + '</div>';
			html += '<div class="dash_unit_label">Servers</div>';
		html += '</div>';
		
		// alerts
		var num_alerts = num_keys(app.activeAlerts);
		html += '<div class="dash_unit_box ' + (num_alerts ? 'warning' : '') + '">';
			html += '<div class="dash_unit_value">' + num_alerts + '</div>';
			html += '<div class="dash_unit_label">Current Alerts</div>';
		html += '</div>';
		
		// jobs
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + this.getNiceDashNumber( num_keys(app.activeJobs) ) + '</div>';
			html += '<div class="dash_unit_label">Active Jobs</div>';
		html += '</div>';
		
		// completed
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + this.getNiceDashNumber(trans.job_complete) + '</div>';
			html += '<div class="dash_unit_label">Jobs Today</div>';
		html += '</div>';
		
		// failed
		html += '<div class="dash_unit_box ' + (trans.job_error ? 'warning' : '') + '">';
			html += '<div class="dash_unit_value">' + this.getNiceDashNumber(trans.job_error) + '</div>';
			html += '<div class="dash_unit_label">Jobs Failed Today</div>';
		html += '</div>';
		
		// success rate
		var success_rate = Math.round( ((trans.job_success || 0) / (trans.job_complete || 1)) * 100 );
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + success_rate + '%</div>';
			html += '<div class="dash_unit_label">Job Success Rate</div>';
		html += '</div>';
		
		// avg job elapsed
		var avg_job_elapsed = Math.round( (trans.job_elapsed || 0) / (trans.job_complete || 1) );
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + get_text_from_seconds_round(avg_job_elapsed, true) + '</div>';
			html += '<div class="dash_unit_label">Avg Job Elapsed</div>';
		html += '</div>';
		
		// avg job output size
		var avg_job_size = Math.round( (trans.job_log_file_size || 0) / (trans.job_complete || 1) );
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + get_text_from_bytes(avg_job_size, 1).replace(/bytes/, 'B') + '</div>';
			html += '<div class="dash_unit_label">Avg Job Output</div>';
		html += '</div>';
		
		// calculate total CPU usage
		var total_cpu = 0;
		
		// add CPU for all active jobs (avg)
		for (var job_id in app.activeJobs) {
			var job = app.activeJobs[job_id];
			if (job.cpu && job.cpu.total && job.cpu.count) {
				total_cpu += job.cpu.total / job.cpu.count;
			}
		}
		
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + Math.round(total_cpu || 0) + '%</div>';
			html += '<div class="dash_unit_label">Job CPU Usage</div>';
		html += '</div>';
		
		// calculate total memory usage
		var total_mem = 0;
		
		// add mem for all jobs (avg)
		for (var job_id in app.activeJobs) {
			var job = app.activeJobs[job_id];
			if (job.mem && job.mem.total && job.mem.count) {
				total_mem += job.mem.total / job.mem.count;
			}
		}
		
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + get_text_from_bytes(total_mem, 1).replace(/bytes/, 'B') + '</div>';
			html += '<div class="dash_unit_label">Job Mem Usage</div>';
		html += '</div>';
		
		var uptime_sec = app.stats.started ? (time_now() - app.stats.started) : 0;
		html += '<div class="dash_unit_box">';
			html += '<div class="dash_unit_value">' + get_text_from_seconds_round(uptime_sec, true) + '</div>';
			html += '<div class="dash_unit_label">Uptime</div>';
		html += '</div>';
		
		this.div.find('.dash_grid').html( html );
	}
	
	renderActiveAlerts() {
		// render details on all active alerts
		var self = this;
		var alerts = Object.values(app.activeAlerts);
		
		if (!alerts.length) {
			$('#d_dash_alerts').hide();
			return;
		}
		
		var cols = ["Alert ID", "Title", "Message", "Server", "Status", "Started", "Duration"];
		var html = '';
		
		var grid_args = {
			rows: alerts,
			cols: cols,
			data_type: 'alert'
		};
		
		html += this.getBasicGrid( grid_args, function(item, idx) {
			return [
				'<b>' + self.getNiceAlertID(item, true) + '</b>',
				self.getNiceAlert(item.alert, false),
				item.message,
				self.getNiceServer(item.server, false),
				self.getNiceAlertStatus(item),
				self.getRelativeDateTime(item.date),
				self.getNiceAlertElapsedTime(item, true, true)
			];
		}); // grid
		
		$('#d_dash_alerts > div.box_content').html( html );
		$('#d_dash_alerts').show();
	}
	
	renderActiveJobs() {
		// show all active jobs
		var self = this;
		var html = '';
		var rows = Object.values(app.activeJobs).sort( function(a, b) {
			return (a.started < b.started) ? 1 : -1;
		} );
		
		if (!this.activeOffset) this.activeOffset = 0;
		
		var resp = {
			rows: rows.slice( this.activeOffset, this.activeOffset + this.args.limit ),
			list: { length: rows.length }
		};
		
		var grid_args = {
			resp: resp,
			cols: ['Job ID', 'Event', 'Category', 'Server', 'State', 'Progress', 'Remaining', 'Actions'],
			data_type: 'job',
			offset: this.activeOffset,
			limit: this.args.limit,
			class: 'data_grid dash_active_grid',
			pagination_link: '$P().jobActiveNav',
			empty_msg: 'No active jobs found.'
		};
		
		html += this.getPaginatedGrid( grid_args, function(job, idx) {
			var tds = [
				'<b>' + self.getNiceJob(job, true) + '</b>',
				self.getNiceJobEvent(job, true),
				self.getNiceCategory(job.category, true),
				// self.getNiceJobSource(job),
				// self.getShortDateTime( job.started ),
				'<div id="d_dash_jt_server_' + job.id + '">' + self.getNiceServer(job.server, true) + '</div>',
				'<div id="d_dash_jt_state_' + job.id + '">' + self.getNiceJobState(job) + '</div>',
				// '<div id="d_dash_jt_elapsed_' + job.id + '">' + self.getNiceJobElapsedTime(job, false) + '</div>',
				'<div id="d_dash_jt_progress_' + job.id + '">' + self.getNiceJobProgressBar(job) + '</div>',
				'<div id="d_dash_jt_remaining_' + job.id + '">' + self.getNiceJobRemainingTime(job, false) + '</div>',
				
				'<span class="link danger" onClick="$P().doAbortJob(\'' + job.id + '\')"><b>Abort Job</b></a>'
			];
			
			if (job.suspended) tds.className = 'suspended';
			else if (job.category) {
				var category = find_object( app.categories, { id: job.category } );
				if (category && category.color) tds.className = 'clr_' + category.color;
			}
			
			return tds;
		} );
		
		this.div.find('#d_dash_active > .box_content').removeClass('loading').html(html);
	}
	
	doAbortJob(id) {
		// abort job, clicked from active or queued tables
		Dialog.confirmDanger( 'Abort Job', "Are you sure you want to abort the job &ldquo;<b>" + id + "</b>&rdquo;?", ['alert-decagram', 'Abort'], function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Aborting Job..." );
			
			app.api.post( 'app/abort_job', { id: id }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', config.ui.messages.job_aborted);
			} ); // api.post
		} ); // confirm
	}
	
	renderInternalJobs() {
		// render relevant active internal jobs for user (heavy)
		// - Std Props: id, title, type, started, progress, username?
		var self = this;
		var html = '';
		var cols = ['Job ID', 'Title', 'Type', 'Username', 'Progress', 'Elapsed', 'Remaining' ];
		
		var rows = Object.values(app.internalJobs).sort( function(a, b) {
			return (a.started < b.started) ? 1 : -1;
		} );
		
		if (!app.isAdmin()) {
			// for non-admins, only show relevant internal jobs
			rows = rows.filter( function(job) { return job.username && (job.username == app.username); } );
		}
		
		if (!rows.length) {
			this.div.find('#d_dash_internal').hide();
			return;
		}
		
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
		
		this.div.find('#d_dash_internal').show();
		this.div.find('#d_dash_internal > .box_content').removeClass('loading').html(html);
	}
	
	updateInternalJobs() {
		// update existing internal jobs (light)
		var self = this;
		var div = this.div;
		var bar_width = this.bar_width || 100;
		var jobs = Object.values(app.internalJobs);
		
		jobs.forEach( function(job) {
			var $cont = div.find('#d_sys_job_progress_' + job.id + ' > div.progress_bar_container');
			if (!$cont.length) return; // hidden job for current user
			
			div.find('#d_sys_job_elapsed_' + job.id).html( self.getNiceJobElapsedTime(job, false, true) );
			div.find('#d_sys_job_remaining_' + job.id).html( self.getNiceJobRemainingTime(job, false) );
			
			// update progress bar without redrawing it (so animation doesn't jitter)
			var counter = job.progress || 1;
			var cx = Math.floor( counter * bar_width );
			var label = '' + Math.floor( (counter / 1.0) * 100 ) + '%';
			
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
	
	handleStatusUpdate(data) {
		// received status update from server, see if major or minor
		var self = this;
		var div = this.div;
		
		if (data.jobsChanged) {
			this.updateDashGrid();
			this.renderActiveJobs();
			this.getQueueSummary();
			
			// recompute upcoming: shift() entries off if they happened
			this.autoExpireUpcomingJobs();
			this.renderUpcomingJobs();
		}
		else {
			// fast update without redrawing entire table
			var jobs = Object.values(app.activeJobs);
			
			// TODO: ideally sort this, then crop based on offset / limit, so we aren't bashing the DOM for off-page jobs
			
			jobs.forEach( function(job) {
				div.find('#d_dash_jt_state_' + job.id).html( self.getNiceJobState(job) );
				div.find('#d_dash_jt_server_' + job.id).html( self.getNiceServer(job.server, true) );
				// div.find('#d_dash_jt_elapsed_' + job.id).html( self.getNiceJobElapsedTime(job, false) );
				div.find('#d_dash_jt_remaining_' + job.id).html( self.getNiceJobRemainingTime(job, false) );
				
				// update progress bar without redrawing it (so animation doesn't jitter)
				self.updateJobProgressBar(job, '#d_dash_jt_progress_' + job.id + ' > div.progress_bar_container');
			} ); // foreach job
		}
		
		// update internal jobs (heavy or light)
		if (data.internalJobsChanged) this.renderInternalJobs();
		else this.updateInternalJobs();
	}
	
	jobActiveNav(offset) {
		// user clicked on active job pagination nav
		this.activeOffset = offset;
		this.div.find('#d_dash_active > .box_content').addClass('loading')
		this.renderActiveJobs();
	}
	
	getQueueSummary() {
		// fetch summary of queued job counts per event
		var self = this;
		
		app.api.get( 'app/get_active_job_summary', { state: 'queued' }, function(resp) {
			if (!self.active) return; // sanity
			
			// convert event summary hash to rows
			var rows = [];
			for (var event_id in resp.events) {
				var info = resp.events[event_id];
				var event = find_object( app.events, { id: event_id } );
				if (event) {
					info.event = event;
					info.title = event.title; // for sort_by
					rows.push(info);
				}
			}
			self.queuedJobs = sort_by( rows, 'title', { dir: 1, type: 'string', copy: false } );
			self.renderQueueSummary();
		});
	}
	
	renderQueueSummary() {
		// render job queue summary
		var self = this;
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		if (!this.queueOffset) this.queueOffset = 0;
		
		if (!this.queuedJobs.length) {
			this.div.find('#d_dash_queued').hide().find('> .box_content').html('');
			return;
		}
		
		var grid_args = {
			resp: {
				rows: this.queuedJobs.slice( this.queueOffset, this.queueOffset + this.args.limit ),
				list: { length: this.queuedJobs.length }
			},
			cols: ['Event', 'Category', 'Plugin', 'Sources', 'Targets', 'Jobs', 'Actions'],
			data_type: 'queue',
			offset: this.queueOffset,
			limit: this.args.limit,
			class: 'data_grid dash_job_queue_grid',
			pagination_link: '$P().jobQueueNav'
		};
		
		html += this.getPaginatedGrid( grid_args, function(item, idx) {
			return [
				'<b>' + self.getNiceEvent(item.id, true) + '</b>',
				self.getNiceCategory(item.event.category, true),
				self.getNicePlugin(item.event.plugin, true),
				self.getNiceJobSourceList( Object.keys(item.sources).sort() ),
				self.getNiceTargetList( Object.keys(item.targets).sort(), true ),
				commify( item.states.queued ),
				'<span class="link danger" onClick="$P().doFlushQueue(\'' + item.id + '\')"><b>Flush Queue</b></a>'
			];
		} );
		
		this.div.find('#d_dash_queued').show().find('> .box_content').removeClass('loading').html( html );
	}
	
	doFlushQueue(id) {
		// flush specific event queue
		var self = this;
		var event = find_object( app.events, { id } ) || { title: id };
		
		Dialog.confirmDanger( 'Flush Queue', "Are you sure you want to flush the event queue for &ldquo;<b>" + event.title + "</b>&rdquo;?  All pending jobs will be silently deleted without triggering completion actions.", ['trash-can', 'Flush'], function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Flushing Queue..." );
			
			app.api.post( 'app/flush_event_queue', { id: id }, function(resp) {
				app.cacheBust = hires_time_now();
				Dialog.hideProgress();
				app.showMessage('success', "The event queue was flushed successfully.");
			} ); // api.post
		} ); // confirm
	}
	
	jobQueueNav(offset) {
		// user clicked on queued event pagination nav
		this.queueOffset = offset;
		this.div.find('#d_dash_queued > .box_content').addClass('loading');
		this.renderQueueSummary();
	}
	
	setupQuickMonitors() {
		// render empty quickmon charts, then request full data
		var self = this;
		var html = '';
		html += '<div class="chart_grid_horiz ' + (app.getPref('chart_size_quick') || 'medium') + '">';
		
		config.quick_monitors.forEach( function(def) {
			// { "id": "cpu_load", "title": "CPU Load Average", "source": "cpu.avgLoad", "type": "float", "suffix": "" },
			html += '<div><canvas id="c_dash_' + def.id + '" class="chart"></canvas></div>';
		} );
		
		html += '</div>';
		this.div.find('#d_dash_monitors > div.box_content').html( html );
		
		this.charts = {};
		
		config.quick_monitors.forEach( function(def, idx) {
			var chart = self.createChart({
				"canvas": '#c_dash_' + def.id,
				"title": def.title,
				"dataType": def.type,
				"dataSuffix": def.suffix,
				"minVertScale": def.min_vert_scale || 0,
				"delta": def.delta || false,
				"deltaMinValue": def.delta_min_value ?? false,
				"divideByDelta": def.divide_by_delta || false,
				"fill": false,
				"_quick": true,
				"_allow_flatten": true,
				"_idx": idx
			});
			self.charts[ def.id ] = chart;
			self.updateChartFlatten(def.id);
			self.setupChartHover(def.id);
		});
		
		// request all data from server
		app.api.post( 'app/get_quickmon_data', {}, function(resp) {
			if (!self.active) return; // sanity
			
			// now iterate over all quick monitors
			config.quick_monitors.forEach( function(def, idx) {
				var chart = self.charts[def.id];
				
				// add layer for each server
				for (var server_id in resp.servers) {
					var rows = resp.servers[server_id];
					var server = app.servers[server_id];
					
					if (server) chart.addLayer({
						id: server_id,
						title: self.getNiceServerText(server),
						data: self.getQuickMonChartData(rows, def.id)
					});
				} // foreach server
				
				if (chart.layers.length == 1) {
					// if only 1 layer, color each chart separately (so they look nicer)
					chart.layers[0].color = app.colors[ idx % app.colors.length ];
				}
			}); // foreach mon
			
			// hide if no servers
			if (!num_keys(resp.servers)) self.div.find('#d_dash_monitors').hide();
		}); // api.get
		
		// prepopulate filter if saved
		if (this.quickMonitorFilter) {
			var $elem = this.div.find('#d_dash_monitors .box_title_widget input[type="text"]');
			$elem.val( this.quickMonitorFilter );
			this.applyQuickMonitorFilter( $elem.get(0) );
		}
	}
	
	appendSampleToChart(data) {
		// append sample to chart (real-time from server)
		// { id, row }
		var self = this;
		
		config.quick_monitors.forEach( function(def) {
			var chart = self.charts[def.id];
			if (!chart) return;
			
			var layer_idx = find_object_idx( chart.layers, { id: data.id } );
			
			if (layer_idx > -1) {
				chart.addLayerSample(layer_idx, { x: data.row.date, y: data.row[def.id] || 0 }, 60 );
			}
			else {
				// add new layer (new server just added?)
				var server = app.servers[data.id];
				if (!server) return;
				
				chart.addLayer({
					id: server.id,
					title: self.getNiceServerText(server),
					data: self.getQuickMonChartData([ data.row ], def.id)
				});
				
				// recolor all layers
				chart.layers.forEach( function(layer, idx) {
					layer.color = app.colors[idx % app.colors.length];
				} );
			}
			
			chart.dirty = true;
		}); // foreach monitor
	}
	
	applyQuickMonitorFilter(elem) {
		// hide or show specific quick monitors based on substring match on title
		var filter = this.quickMonitorFilter = $(elem).val();
		var re = new RegExp( escape_regexp(filter), 'i' );
		
		for (var key in this.charts) {
			var chart = this.charts[key];
			if (chart._quick) {
				var $cont = $(chart.canvas).parent();
				if (chart.title.match(re)) $cont.show();
				else $cont.hide();
			}
		}
	}
	
	onPageUpdate(pcmd, pdata) {
		// receive data packet for this page specifically (i.e. live graph append)
		// switch (pcmd) {
		// 	case 'quickmon': this.appendSampleToChart(pdata); break;
		// }
	}
	
	onStatusUpdate(data) {
		// called every 1s from websocket
		this.handleStatusUpdate(data);
	}
	
	onDataUpdate(key, data) {
		// refresh data if applicable
		switch (key) {
			case 'stats': 
				this.updateDashGrid(); 
				this.autoExpireUpcomingJobs();
				this.renderUpcomingJobs();
				this.updateJobHistoryDayGraph();
			break;
			
			case 'activeAlerts': 
				this.renderActiveAlerts(); 
				this.updateDashGrid();
			break;
			
			case 'servers': 
				this.updateDashGrid();
			break;
			
			case 'events':
				this.getUpcomingJobs();
			break;
		}
	}
	
	onDeactivate() {
		// called when page is deactivated
		
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
