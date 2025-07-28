// Server Utilities

// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the PixlCore Sustainable Use License.
// See the LICENSE.md file in this repository.

Page.ServerUtils = class ServerUtils extends Page.PageUtils {
	
	showProcessInfo(pid, snapshot) {
		// pop dialog with process details
		var self = this;
		var html = '';
		if (!snapshot) snapshot = this.snapshot;
		var list = snapshot.data.processes.list;
		var proc = find_object( list, { pid } );
		if (!proc) return; // sanity
		
		var cmd = '';
		if (proc.path) cmd += proc.path + '/';
		cmd += proc.command;
		if (proc.params) cmd += ' ' + proc.params;
		
		html += '<div class="dialog_box_content maximize" style="width:600px; max-height:75vh; overflow-x:hidden; overflow-y:auto;">';
		
		// command
		html += '<div class="summary_grid single" style="margin-top:10px; margin-bottom:20px;">';
			html += '<div>';
				html += '<div class="info_label">Command</div>';
				html += '<div class="info_value overflow" style="word-break:break-word;">' + cmd + '</div>';
			html += '</div>';
		html += '</div>';
		
		// grid
		html += '<div class="summary_grid triple">';
		
		// server
		if (proc.server) {
			html += '<div>';
				html += '<div class="info_label">Server</div>';
				html += '<div class="info_value">' + this.getNiceServer(proc.server, true) + '</div>';
			html += '</div>';
		}
		
		// pid
		html += '<div>';
			html += '<div class="info_label">Process ID</div>';
			html += '<div class="info_value">' + proc.pid + '</div>';
		html += '</div>';
		
		// parent pid
		if (proc.parentPid) {
			html += '<div>';
				html += '<div class="info_label">Parent PID</div>';
				html += '<div class="info_value"><span class="link" onClick="$P().showProcessInfo(' + proc.parentPid + ')">' + proc.parentPid + '</span></div>';
			html += '</div>';
		}
		
		// user
		html += '<div>';
			html += '<div class="info_label">User</div>';
			html += '<div class="info_value">' + (proc.user || 'n/a') + '</div>';
		html += '</div>';
		
		// group
		html += '<div>';
			html += '<div class="info_label">Group</div>';
			html += '<div class="info_value">' + (proc.group || 'n/a') + '</div>';
		html += '</div>';
		
		// cpu
		html += '<div>';
			html += '<div class="info_label">CPU</div>';
			html += '<div class="info_value">' + short_float(proc.cpu || 0) + '%</div>';
		html += '</div>';
		
		// mem (%)
		html += '<div>';
			html += '<div class="info_label">Memory</div>';
			html += '<div class="info_value">' + short_float(proc.mem || 0) + '%</div>';
		html += '</div>';
		
		// memVsz (virtual)
		html += '<div>';
			html += '<div class="info_label">Virtual Memory</div>';
			html += '<div class="info_value">' + get_text_from_bytes(proc.memVsz || 0) + '</div>';
		html += '</div>';
		
		// memRss (resident)
		html += '<div>';
			html += '<div class="info_label">Resident Memory</div>';
			html += '<div class="info_value">' + get_text_from_bytes(proc.memRss || 0) + '</div>';
		html += '</div>';
		
		// started (age)
		html += '<div>';
			html += '<div class="info_label">Age</div>';
			html += '<div class="info_value">' + get_text_from_seconds( proc.age || 0, false, true ) + '</div>';
		html += '</div>';
		
		// state
		html += '<div>';
			html += '<div class="info_label">State</div>';
			html += '<div class="info_value">' + ucfirst(proc.state) + '</div>';
		html += '</div>';
		
		// tty
		html += '<div>';
			html += '<div class="info_label">TTY</div>';
			html += '<div class="info_value">' + (proc.tty || 'n/a') + '</div>';
		html += '</div>';
		
		// priority
		html += '<div>';
			html += '<div class="info_label">Priority</div>';
			html += '<div class="info_value">' + (proc.priority || 'n/a') + '</div>';
		html += '</div>';
		
		// nice
		html += '<div>';
			html += '<div class="info_label">Nice</div>';
			html += '<div class="info_value">' + (proc.nice || 'n/a') + '</div>';
		html += '</div>';
		
		// threads
		html += '<div>';
			html += '<div class="info_label">Threads</div>';
			html += '<div class="info_value">' + (proc.threads || 'n/a') + '</div>';
		html += '</div>';
		
		if (proc.job) {
			// job id
			html += '<div>';
				html += '<div class="info_label">Job ID</div>';
				html += '<div class="info_value">' + this.getNiceJob(proc.job, true) + '</div>';
			html += '</div>';
			
			// disk
			html += '<div>';
				html += '<div class="info_label">Total I/O</div>';
				html += '<div class="info_value">' + get_text_from_bytes(proc.disk || 0) + '</div>';
			html += '</div>';
			
			// conns
			html += '<div>';
				html += '<div class="info_label">Net Connections</div>';
				html += '<div class="info_value">' + commify(proc.conns || 0) + '</div>';
			html += '</div>';
			
			// net
			html += '<div>';
				html += '<div class="info_label">Net Throughput</div>';
				html += '<div class="info_value">' + get_text_from_bytes(proc.net || 0) + '/sec</div>';
			html += '</div>';
		}
		
		html += '</div>'; // summary_grid
		
		// process family tree
		var rows = [ copy_object(proc) ];
		
		// add children
		var add_children = function(parent, indent) {
			find_objects(list, { parentPid: parent.pid }).forEach( function(proc) {
				rows.push( merge_objects(proc, { indent }) );
				add_children( proc, indent + 1 );
			} );
		};
		add_children( proc, 1 );
		
		// add parents
		var add_parents = function(proc) {
			var parent = find_object(list, { pid: proc.parentPid });
			if (parent) {
				rows.forEach( function(row) { row.indent = (row.indent || 0) + 1; } );
				rows.unshift( copy_object(parent) );
				add_parents(parent);
			}
		};
		add_parents( proc );
		
		if (rows.length > 1) {
			// html += '<div class="dialog_title" style="margin-top:30px; margin-bottom:10px;">Process Family</div>';
			html += '<div style="margin-top:35px;"></div>';
			
			var opts = {
				rows: rows,
				cols: ['Command', 'User', 'PID'],
				data_type: 'process',
				attribs: {
					class: 'data_grid dialog_proc_grid'
				},
				hide_pagination: true
			};
			html += this.getBasicGrid( opts, function(item, idx) {
				var indent_px = Math.floor( (item.indent || 0) * 16 );
				
				var cmd = '<span style="padding-left:' + Math.floor(indent_px - 16) + 'px;">';
				if (indent_px) cmd += '<i class="mdi mdi-subdirectory-arrow-right" style="color:var(--icon-color);">&nbsp;</i>';
				if (item.pid == proc.pid) cmd += '<b>';
				cmd += self.getNiceProcess(item, true);
				if (item.pid == proc.pid) cmd += '</b>';
				cmd += '</span>';
				
				return [
					cmd,
					item.user,
					item.pid
				];
			} ); // grid (procs)
		} // family
		
		html += '</div>'; // wrapper
		
		var buttons_html = "";
		// buttons_html += '<div class="button" onMouseUp="$P().copy_unit_results('+idx+')">Copy to Clipboard</div>';
		buttons_html += '<div class="button primary" onMouseUp="Dialog.confirm_click(true)"><i class="mdi mdi-close-circle-outline">&nbsp;</i>Close</div>';
		
		Dialog.showSimpleDialog('Process Details', html, buttons_html);
		
		// special mode for key capture
		Dialog.active = 'confirmation';
		Dialog.confirm_callback = function(result) { 
			if (result) Dialog.hide(); 
		};
	}
	
	getMemDetails(server) {
		// get memory details
		var self = this;
		var data = server.data;
		var html = '';
		var mem = data.memory || data.mem;
		
		/* "memory": {
			"total": 8318783488,
			"free": 7249416192,
			"used": 1069367296,
			"active": 926904320,
			"available": 7391879168,
			"buffers": 335872,
			"cached": 431300608,
			"slab": 53968896,
			"buffcache": 485605376,
			"swaptotal": 10466258944,
			"swapused": 0,
			"swapfree": 10466258944,
			"writeback": 0,
			"dirty": 102400
		}, */
		
		html += '<div class="dash_donut_grid">';
			html += this.getDonutDashUnit({ id: 'mem_used', value: mem.used, max: mem.total, type: 'bytes', suffix: '', label: 'Used', color: app.colors[2] });
			html += this.getDonutDashUnit({ id: 'mem_active', value: mem.active, max: mem.total, type: 'bytes', suffix: '', label: 'Active', color: app.colors[3] });
			html += this.getDonutDashUnit({ id: 'mem_available', value: mem.available, max: mem.total, type: 'bytes', suffix: '', label: 'Available', color: app.colors[0] });
			html += this.getDonutDashUnit({ id: 'mem_free', value: mem.free, max: mem.total, type: 'bytes', suffix: '', label: 'Free', color: app.colors[1] });
			html += this.getDonutDashUnit({ id: 'mem_buffers', value: mem.buffers, max: mem.total, type: 'bytes', suffix: '', label: 'Buffered', color: app.colors[4] });
			html += this.getDonutDashUnit({ id: 'mem_cached', value: mem.cached, max: mem.total, type: 'bytes', suffix: '', label: 'Cached', color: app.colors[5] });
		html += '</div>';
		
		return html;
	}
	
	getCPUDetails(server) {
		// get table of individual cpu details
		var self = this;
		var data = server.data;
		var html = '';
		var cpu_totals = data.cpu.totals;
		
		html += '<div class="dash_donut_grid">';
			html += this.getDonutDashUnit({ id: 'cpu_user', value: cpu_totals.user, max: 100, type: 'float', suffix: '%', label: 'User %', color: app.colors[6] });
			html += this.getDonutDashUnit({ id: 'cpu_system', value: cpu_totals.system, max: 100, type: 'float', suffix: '%', label: 'System %', color: app.colors[7] });
			html += this.getDonutDashUnit({ id: 'cpu_nice', value: cpu_totals.nice, max: 100, type: 'float', suffix: '%', label: 'Nice %', color: app.colors[8] });
			html += this.getDonutDashUnit({ id: 'cpu_iowait', value: cpu_totals.iowait, max: 100, type: 'float', suffix: '%', label: 'I/O Wait %', color: app.colors[9] });
			html += this.getDonutDashUnit({ id: 'cpu_irq', value: cpu_totals.irq, max: 100, type: 'float', suffix: '%', label: 'Hard IRQ %', color: app.colors[10] });
			html += this.getDonutDashUnit({ id: 'cpu_softirq', value: cpu_totals.softirq, max: 100, type: 'float', suffix: '%', label: 'Soft IRQ %', color: app.colors[11] });
		html += '</div>';
		
		html += '<div style="height:30px;"></div>';
		
		var rows = (data.cpu && data.cpu.cpus) ? data.cpu.cpus : [];
		
		var cols = ['CPU #', 'User %', 'System %', 'Nice %', 'I/O Wait %', 'Hard IRQ %', 'Soft IRQ %', 'Total %'];
		
		var grid_args = {
			rows: rows,
			cols: cols,
			data_type: 'cpu',
			grid_template_columns: 'repeat(7, 1fr) min-content'
		};
		
		html += this.getBasicGrid( grid_args, function(item, idx) {
			return [
				'#' + Math.floor(idx + 1),
				Math.floor(item.user) + '%',
				Math.floor(item.system) + '%',
				Math.floor(item.nice) + '%',
				Math.floor(item.iowait) + '%',
				Math.floor(item.irq) + '%',
				Math.floor(item.softirq) + '%',
				self.getNiceProgressBar( (100 - item.idle) / 100, 'static wider', true )
			];
		}); // grid
		
		return html;
	}
	
	resetDetailAnimation() {
		// reset detail animation
		var raf = !!(this.detailAnimation && this.detailAnimation.raf);
		this.detailAnimation = { raf, start: performance.now(), duration: app.reducedMotion() ? 1 : 500, donuts: [] };
	}
	
	startDetailAnimation() {
		// start animation frames
		if (!this.detailAnimation.raf) {
			this.detailAnimation.raf = true;
			requestAnimationFrame( this.renderDetailAnimation.bind(this) );
		}
	}
	
	renderDetailAnimation() {
		// update animation in progress
		if (!this.active) return; // sanity
		
		var now = performance.now();
		var anim = this.detailAnimation;
		if (!anim) return; // sanity
		anim.raf = false;
		
		var progress = Math.min(1.0, (now - anim.start) / anim.duration ); // linear
		var eased = progress * progress * (3 - 2 * progress); // ease-in-out
		
		// donuts need their conic-gradient redrawn
		anim.donuts.forEach( function(donut) {
			var pct = short_float( donut.from + ((donut.to - donut.from) * eased), 3 );
			donut.elem.css('background-image', 'conic-gradient( ' + donut.color + ' ' + pct + '%, ' + donut.bg + ' 0)');
		} );
		
		if (progress < 1.0) {
			// more frames still needed
			anim.raf = true;
			requestAnimationFrame( this.renderDetailAnimation.bind(this) );
		}
		else {
			// done, cleanup
			delete this.detailAnimation;
		}
	}
	
	getMonitorGrid(server) {
		// get grid of monitor dash units, sorted
		var self = this;
		var data = server.data;
		var html = '';
		
		app.monitors.forEach( function(mon_def) {
			if (!mon_def.display) return;
			if (mon_def.groups.length && !app.includesAny(mon_def.groups, server.groups)) return;
			
			var label = mon_def.title
				.replace(/\b(Total)\b/g, '')
				.replace(/\b(Average)\b/g, 'Avg')
				.replace(/\b(Operations)\b/g, 'Ops')
				// .replace(/\b(Network)\b/g, 'Net')
				.replace(/\b(Connections)\b/g, 'Conns')
				.replace(/\b(Available)\b/g, 'Avail')
				.replace(/\b(Memory)\b/g, 'Mem')
				// .replace(/\b(Processes)\b/g, 'Procs')
				.replace(/\(.+\)/g, '')
				.replace(/\%/g, '')
				.replace(/\s+/g, ' ').trim();
			
			var value = (mon_def.delta ? data.deltas[mon_def.id] : data.monitors[mon_def.id]) || 0;
			var value_disp = self.getDashValue(value, mon_def.data_type, mon_def.suffix);
			
			html += '<div class="dash_unit_box">';
				html += '<div class="dash_unit_value">' + value_disp + '</div>';
				html += '<div class="dash_unit_label">' + label + '</div>';
			html += '</div>';
		} );
		
		return html;
	}
	
	getDashValue(value, type, suffix) {
		// format number value for dashboard units
		var value_disp = '';
		
		switch (type) {
			case 'integer': value_disp = this.getNiceDashNumber(value); break;
			case 'float': value_disp = short_float(value); break;
			case 'bytes': value_disp = get_text_from_bytes_dash(value); break;
			case 'seconds': value_disp = get_text_from_seconds_round(value, 2); break;
			case 'milliseconds': value_disp = get_text_from_ms_round(value, 2); break;
		} // switch data_type
		
		if (suffix) value_disp += suffix.replace(/^\s*\/(\w)\w+$/, '/$1');
		
		return value_disp;
	}
	
	getDonutDashUnit(opts) {
		// get donut dash unit
		// opts: { value, max, type, suffix, label, color }
		var html = '';
		var amount = opts.value / (opts.max || 1);
		var pct = short_float( amount * 100, 3 );
		var value_disp = this.getDashValue(opts.value, opts.type, opts.suffix);
		
		if (!opts.bg && opts.color.match(/^\#?([0-9a-f]{6})$/i)) {
			var hex = RegExp.$1;
			var color = {
				r: parseInt(hex.substring(0, 2), 16),
				g: parseInt(hex.substring(2, 4), 16),
				b: parseInt(hex.substring(4, 6), 16)
			};
			opts.bg = `rgba(${color.r},${color.g},${color.b},0.15)`;
		}
		else if (!opts.bg) opts.bg = 'var(--border-color)';
		
		html += '<div class="dash_donut_container" id="ddc_' + opts.id + '">';
			html += '<div class="dash_donut_image" style="background-image:conic-gradient( ' + opts.color + ' ' + pct + '%, ' + opts.bg + ' 0);">';
				html += '<div class="dash_donut_overlay"></div>';
				html += '<div class="dash_donut_value">' + value_disp + '</div>';
				html += '<div class="dash_donut_label">' + opts.label + '</div>';
			html += '</div>';
			// html += '<div class="dash_donut_label">' + opts.label + '</div>';
		html += '</div>';
		
		if (!this.donutDashUnits) this.donutDashUnits = {};
		this.donutDashUnits[ opts.id ] = opts;
		
		return html;
	}
	
	renderSnapshotAlerts() {
		// render details on snapshot alerts
		var self = this;
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		if (!this.alerts || !this.alerts.length) {
			$('#d_vs_alerts').hide();
			return;
		}
		
		var alerts = this.alerts;
		if (this.visibleServerIDs) {
			alerts = this.alerts.filter( function(item) {
				if (!item.server) return false;
				if (!self.visibleServerIDs[ item.server ]) return false;
				return true;
			} );
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
				self.getNiceAlert(item.alert, true),
				item.message,
				self.getNiceServer(item.server, true),
				self.getNiceAlertStatus(item),
				self.getRelativeDateTime(item.date),
				self.getNiceAlertElapsedTime(item, true, true)
			];
		}); // grid
		
		this.div.find('#d_vs_alerts > div.box_content').html( html );
		this.div.find('#d_vs_alerts').show();
	}
	
	renderSnapshotJobs() {
		// render snapshot jobs
		var self = this;
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		if (!this.jobs) return;
		
		var jobs = this.jobs;
		if (this.visibleServerIDs) {
			jobs = this.jobs.filter( function(item) {
				if (!item.server) return false;
				if (!self.visibleServerIDs[ item.server ]) return false;
				return true;
			} );
		}
		
		var grid_args = {
			rows: jobs,
			cols: ['Job ID', 'Server', 'Source', 'Started', 'Elapsed', 'Avg CPU/Mem', 'Result'],
			data_type: 'job',
			class: 'data_grid job_history_grid'
		};
		
		html += this.getBasicGrid( grid_args, function(job, idx) {
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
		
		this.div.find('#d_vs_jobs > .box_content').html( html );
		this.div.find('#d_vs_jobs').show();
	}
	
	getProcessTable(snapshot) {
		// get initial html for sortable proc table
		var self = this;
		
		var proc_opts = {
			id: 't_snap_procs',
			item_name: 'process',
			sort_by: 'cpu',
			sort_dir: -1,
			filter: '',
			column_ids: ['command', 'user', 'pid', 'parentPid', 'cpu', 'memRss', 'age', 'state'],
			column_labels: ['Command', 'User', 'PID', 'Parent', 'CPU', 'Memory', 'Age', 'State']
		};
		
		return this.getSortableTable( snapshot.data.processes.list, proc_opts, function(proc) {
			return [
				'<b>' + self.getNiceProcess(proc, true) + '</b>',
				proc.user,
				'<span class="link" onClick="$P().showProcessInfo(' + proc.pid + ')">' + proc.pid + '</span>',
				proc.parentPid ? ('<span class="link" onClick="$P().showProcessInfo(' + proc.parentPid + ')">' + proc.parentPid + '</span>') : 'n/a',
				pct( proc.cpu, 100 ),
				get_text_from_bytes( proc.memRss ),
				get_text_from_seconds( proc.age || 0, true, true ),
				ucfirst(proc.state || 'unknown')
			];
		});
	}
	
	getConnectionTable(snapshot) {
		// get initial html for sortable conn table
		var self = this;
		
		var conn_opts = {
			id: 't_snap_conns',
			item_name: 'connection',
			sort_by: 'state',
			sort_dir: 1,
			filter: '',
			column_ids: ['state', 'type', 'local_addr', 'remote_addr', 'command', 'bytes_in', 'bytes_out'],
			column_labels: ['State', 'Protocol', 'Local Address', 'Remote Address', 'Process', 'Bytes In', 'Bytes Out']
		};
		
		return this.getSortableTable( snapshot.data.conns, conn_opts, function(conn) {
			var nice_state = conn.state.toString().split(/_/).map( function(word) { return ucfirst(word); } ).join(' ');
			var proc = conn.pid ? find_object(snapshot.data.processes.list, { pid: conn.pid }) : null;
			return [
				'<i class="mdi mdi-network-outline">&nbsp;</i>' + nice_state,
				conn.type.toUpperCase(),
				conn.local_addr,
				conn.remote_addr,
				proc ? self.getNiceProcess(proc, true) : (conn.pid || '(None)'),
				get_text_from_bytes( conn.bytes_in || 0 ),
				get_text_from_bytes( conn.bytes_out || 0 )
			];
		});
	}
	
	getInterfaceTable(snapshot) {
		// get initial html for sortable iface table
		var self = this;
		
		var iface_opts = {
			id: 't_snap_ifaces',
			item_name: 'interface',
			sort_by: 'iface',
			sort_dir: 1,
			filter: '',
			column_ids: ['iface', 'ip4', 'ip6', 'operstate', 'type', 'speed', 'rx_sec', 'tx_sec'],
			column_labels: ['Name', 'IPv4', 'IPv6', 'State', 'Type', 'Speed', 'Bytes In', 'Bytes Out']
		};
		
		return this.getSortableTable( Object.values(snapshot.data.interfaces), iface_opts, function(iface) {
			var nice_speed = 'n/a';
			if (iface.speed && (iface.speed >= 1000000)) nice_speed = Math.floor(iface.speed / 1000000) + ' Tb';
			else if (iface.speed && (iface.speed >= 1000)) nice_speed = Math.floor(iface.speed / 1000) + ' Gb';
			else if (iface.speed) nice_speed = iface.speed + ' Mb';
			
			return [
				'<i class="mdi mdi-lan">&nbsp;</i>' + iface.iface,
				iface.ip4 || 'n/a',
				iface.ip6 || 'n/a',
				ucfirst(iface.operstate || 'Unknown'),
				ucfirst(iface.type || 'Unknown'),
				nice_speed,
				get_text_from_bytes( iface.rx_sec || 0 ) + '/sec',
				get_text_from_bytes( iface.tx_sec || 0 ) + '/sec'
			];
		});
	}
	
	getMountTable(snapshot) {
		// get initial html for sortable mount table
		var self = this;
		
		var fs_opts = {
			id: 't_snap_fs',
			item_name: 'mount',
			sort_by: 'mount',
			sort_dir: 1,
			filter: '',
			column_ids: ['mount', 'type', 'fs', 'size', 'used', 'avail', 'use'],
			column_labels: ['Mount Point', 'Type', 'Device', 'Total Size', 'Used', 'Available', 'Use %']
		};
		
		return this.getSortableTable( Object.values(snapshot.data.mounts), fs_opts, function(item) {
			return [
				'<span class=""><i class="mdi mdi-harddisk">&nbsp;</i>' + item.mount + '</span>',
				item.type,
				item.fs,
				get_text_from_bytes( item.size ),
				get_text_from_bytes( item.used ),
				get_text_from_bytes( item.available ),
				self.getNiceProgressBar( item.use / 100, 'static', true )
			];
		});
	}
	
	//
	// Sortble grid stuff -- might move to base if used elsewhere...
	//
	
	getSortedTableRows(id) {
		// get sorted (and filtered!) table rows
		var opts = this.tables[id];
		var filter_re = new RegExp( escape_regexp(opts.filter) || '.*', 'i' );
		var sort_by = opts.sort_by;
		var sort_dir = opts.sort_dir;
		var sort_type = 'number';
		if (opts.rows.length && (typeof(opts.rows[0][sort_by]) == 'string')) sort_type = 'string';
		
		// apply filter
		var rows = opts.rows.filter( function(row) {
			var blob = hash_values_to_array(row).join(' ');
			return !!blob.match( filter_re );
		} );
		
		// apply custom sort
		rows.sort( function(a, b) {
			if (sort_type == 'number') {
				return( (a[sort_by] - b[sort_by]) * sort_dir );
			}
			else {
				return( a[sort_by].toString().localeCompare(b[sort_by]) * sort_dir );
			}
		});
		
		return rows;
	}
	
	updateTableRows(id, rows) {
		// replace sorted table rows, redraw
		var opts = this.tables[id];
		opts.rows = rows;
		
		var disp_rows = this.getSortedTableRows( opts.id );
		
		// redraw pagination thing
		this.div.find('#st_hinfo_' + opts.id).html(
			this.getTableHeaderInfo(id, disp_rows) 
		);
		
		// redraw rows
		this.div.find('#st_' + opts.id).html( 
			this.getTableColumnHTML( opts.id ) + 
			this.getTableContentHTML( opts.id, disp_rows ) 
		);
	}
	
	applyTableFilter(elem) {
		// key typed in table filter box, redraw
		var id = $(elem).data('id');
		var opts = this.tables[id];
		opts.filter = $(elem).val();
		
		var disp_rows = this.getSortedTableRows( opts.id );
		
		// redraw pagination thing
		this.div.find('#st_hinfo_' + opts.id).html(
			this.getTableHeaderInfo(id, disp_rows) 
		);
		
		// redraw rows
		this.div.find('#st_' + opts.id).html( 
			this.getTableColumnHTML( opts.id ) + 
			this.getTableContentHTML( opts.id, disp_rows ) 
		);
	}
	
	getTableHeaderInfo(id, disp_rows) {
		// construct HTML for sortable table header info widget
		var opts = this.tables[id];
		var rows = opts.rows;
		var html = '';
		
		if (disp_rows.length < rows.length) {
			html += commify(disp_rows.length) + ' of ' + commify(rows.length) + ' ' + pluralize(opts.item_name, rows.length) + '';
		}
		else {
			html += commify(rows.length) + ' ' + pluralize(opts.item_name, rows.length) + '';
		}
		
		var bold_idx = opts.column_ids.indexOf( opts.sort_by );
		html += ', sorted by ' + opts.column_labels[bold_idx] + '';
		html += ' <i class="mdi mdi-menu-' + ((opts.sort_dir == 1) ? 'up' : 'down') + '"></i>';
		// html += ((opts.sort_dir == 1) ? ' ascending' : ' descending');
		
		return html;
	}
	
	getTableColumnHTML(id) {
		// construct HTML for sortable table column headers (THs)
		var opts = this.tables[id];
		var html = '';
		html += '<ul class="grid_row_header">';
		
		opts.column_ids.forEach( function(col_id, idx) {
			var col_label = opts.column_labels[idx];
			var classes = ['st_col_header'];
			var icon = '';
			if (col_id == opts.sort_by) {
				classes.push('active');
				icon = ' <i class="mdi mdi-menu-' + ((opts.sort_dir == 1) ? 'up' : 'down') + '"></i>';
			}
			html += '<div class="' + classes.join(' ') + '" data-id="' + opts.id + '" data-col="' + col_id + '" onMouseUp="$P().toggleTableSort(this)">' + col_label + icon + '</div>';
		});
		
		html += '</ul>';
		return html;
	}
	
	getTableContentHTML(id, disp_rows) {
		// construct HTML for sortable table content (rows)
		var opts = this.tables[id];
		var html = '';
		var bold_idx = opts.column_ids.indexOf( opts.sort_by );
		
		var len = disp_rows.length;
		var max_rows = config.max_table_rows || 0;
		var chopped = 0;
		if (max_rows && (disp_rows.length > max_rows)) {
			chopped = disp_rows.length - max_rows;
			len = max_rows;
		}
		
		for (var idx = 0; idx < len; idx++) {
			var row = disp_rows[idx];
			var tds = opts.callback(row, idx);
			html += '<ul class="grid_row">';
			for (var idy = 0, ley = tds.length; idy < ley; idy++) {
				html += '<div' + ((bold_idx == idy) ? ' style="font-weight:bold"' : '') + '>' + tds[idy] + '</div>';
			}
			html += '</ul>';
		} // foreach row
		
		if (!disp_rows.length) {
			html += '<ul class="grid_row_empty"><div style="grid-column-start: span ' + opts.column_ids.length + ';">';
			html += 'No ' + pluralize(opts.item_name) + ' found.';
			html += '</div></ul>';
		}
		else if (chopped) {
			html += '<ul class="grid_row_more"><div style="grid-column-start: span ' + opts.column_ids.length + ';">';
			html += `(${commify(chopped)} more ${pluralize(opts.item_name, chopped)} not shown)`;
			html += '</div></ul>';
		}
		
		return html;
	}
	
	toggleTableSort(elem) {
		var id = $(elem).data('id');
		var col_id = $(elem).data('col');
		var opts = this.tables[id];
		
		// swap sort dir or change sort column
		if (col_id == opts.sort_by) {
			// swap dir
			opts.sort_dir *= -1;
		}
		else {
			// same sort dir but change column
			opts.sort_by = col_id;
		}
		
		var disp_rows = this.getSortedTableRows( opts.id );
		
		// redraw pagination thing
		this.div.find('#st_hinfo_' + opts.id).html(
			this.getTableHeaderInfo(id, disp_rows) 
		);
		
		// redraw grid
		this.div.find('#st_' + opts.id).html( 
			this.getTableColumnHTML(id) + 
			this.getTableContentHTML( opts.id, disp_rows ) 
		);
	}
	
	getSortableTable(rows, opts, callback) {
		// get HTML for sortable and filterable table
		var self = this;
		var html = '';
		if (!this.tables) this.tables = {};
		
		// retrieve previous filter if applicable
		if (this.tables[ opts.id ] && this.tables[ opts.id ].filter) {
			opts.filter = this.tables[ opts.id ].filter;
		}
		
		// save in page for resort / filtering
		opts.rows = rows;
		opts.callback = callback;
		this.tables[ opts.id ] = opts;
		
		var disp_rows = this.getSortedTableRows( opts.id );
		
		if (!opts.hide_pagination) {
			// pagination
			html += '<div class="data_grid_pagination">';
			
				html += '<div style="text-align:left" id="st_hinfo_' + opts.id + '">';
					html += this.getTableHeaderInfo( opts.id, disp_rows );
				html += '</div>';
				
				html += '<div style="text-align:center">';
					html += '&nbsp;';
				html += '</div>';
				
				html += '<div style="text-align:right">';
					html += 'Page 1 of 1';
				html += '</div>';
			
			html += '</div>';
			
			html += '<div style="margin-top:5px;">';
		}
		else {
			// no pagination
			html += '<div>';
		}
		
		var tattrs = opts.attribs || {};
		if (opts.class) tattrs.class = opts.class;
		if (!tattrs.class) {
			tattrs.class = 'data_grid';
			if (opts.item_name.match(/^\w+$/)) tattrs.class += ' ' + opts.item_name + '_grid';
		}
		if (!tattrs.style) tattrs.style = '';
		tattrs.style += 'grid-template-columns: repeat(' + opts.column_ids.length + ', auto);';
		html += '<div id="st_' + opts.id + '" ' + compose_attribs(tattrs) + '>';
		
			html += this.getTableColumnHTML( opts.id );
			html += this.getTableContentHTML( opts.id, disp_rows );
		
		html += '</div>'; // scroll wrapper
		html += '</div>'; // grid
		
		return html;
	}
	
	// 
	// Date/Time stuff for historical views
	// 
	
	chooseHistoricalView(group_mode) {
		// show dialog to select historical view for server
		var self = this;
		var args = this.args;
		var title = "View Historical " + (group_mode ? 'Group' : 'Server') + " Data";
		var btn = ['check-circle', "Apply"];
		
		var html = '<div class="dialog_box_content scroll">';
		
		if (!args.mode) {
			// default to "today" daily view, or whatever day snap was taken
			var dargs = get_date_args( this.snapshot ? this.snapshot.date : time_now() );
			args.mode = 'daily';
			args.year = dargs.year;
			args.month = dargs.mon; // this is already 1-based
			args.day = dargs.mday;
			args.limit = 1;
		}
		
		// zoom level
		html += this.getFormRow({
			id: 'd_esh_mode',
			label: 'Zoom Level:',
			content: this.getFormMenuSingle({
				id: 'fe_esh_mode',
				title: "Select Zoom Level",
				options: [ 
					{ id: 'yearly', title: "Yearly", icon: 'earth' },
					{ id: 'monthly', title: "Monthly", icon: 'calendar-month-outline' },
					{ id: 'daily', title: "Daily", icon: 'calendar-today-outline' },
					{ id: 'hourly', title: "Hourly", icon: 'clock-outline' }
				],
				value: args.mode,
				'data-shrinkwrap': 1
			}),
			caption: 'Select the desired zoom level for the timeline view.'
		});
		
		// year
		html += this.getFormRow({
			id: 'd_esh_year',
			label: 'Year:',
			content: this.getFormMenuSingle({
				id: 'fe_esh_year',
				title: 'Select Year',
				options: this.getYearOptions(),
				value: args.year || '',
				'data-shrinkwrap': 1
			})
		});
		
		// month
		html += this.getFormRow({
			id: 'd_esh_month',
			label: 'Month:',
			content: this.getFormMenuSingle({
				id: 'fe_esh_month',
				title: 'Select Month',
				options: this.getMonthOptions(),
				value: args.month || '',
				'data-shrinkwrap': 1
			})
		});
		
		// day
		html += this.getFormRow({
			id: 'd_esh_day',
			label: 'Day:',
			content: this.getFormMenuSingle({
				id: 'fe_esh_day',
				title: 'Select Day',
				options: this.getDayOptions(),
				value: args.day || '',
				'data-shrinkwrap': 1
			})
		});
		
		// hour
		html += this.getFormRow({
			id: 'd_esh_hour',
			label: 'Hour:',
			content: this.getFormMenuSingle({
				id: 'fe_esh_hour',
				title: 'Select Hour',
				options: this.getHourOptions(),
				value: args.hour || '',
				'data-shrinkwrap': 1
			})
		});
		
		// limit
		html += this.getFormRow({
			id: 'd_esh_limit',
			label: 'Limit:',
			content: this.getFormText({
				id: 'fe_esh_limit',
				title: 'Select Limit',
				type: 'number',
				spellcheck: 'false',
				maxlength: 2,
				min: 1,
				max: 15,
				value: args.limit || 1,
				'data-shrinkwrap': 1
			})
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			args.mode = $('#fe_esh_mode').val();
			args.limit = parseInt( $('#fe_esh_limit').val() );
			
			switch (args.mode) {
				case 'yearly':
					args.year = parseInt( $('#fe_esh_year').val() );
					delete args.month;
					delete args.day;
					delete args.hour;
				break;
				
				case 'monthly':
					args.year = parseInt( $('#fe_esh_year').val() );
					args.month = parseInt( $('#fe_esh_month').val() );
					delete args.day;
					delete args.hour;
				break;
				
				case 'daily':
					args.year = parseInt( $('#fe_esh_year').val() );
					args.month = parseInt( $('#fe_esh_month').val() );
					args.day = parseInt( $('#fe_esh_day').val() );
					delete args.hour;
				break;
				
				case 'hourly':
					args.year = parseInt( $('#fe_esh_year').val() );
					args.month = parseInt( $('#fe_esh_month').val() );
					args.day = parseInt( $('#fe_esh_day').val() );
					args.hour = parseInt( $('#fe_esh_hour').val() );
				break;
			} // switch mode
			
			Dialog.hide();
			var page_name = group_mode ? 'GroupHist' : 'ServerHist';
			Nav.go( '#' + page_name + compose_query_string(args) );
			
		}); // Dialog.confirm
		
		var change_mode = function(new_mode) {
			// $('.dialog_box_content .form_row').hide();
			// $('#d_esh_mode').show();
			
			switch (new_mode) {
				case 'yearly':
					$('#d_esh_year').show();
					$('#d_esh_month').hide();
					$('#d_esh_day').hide();
					$('#d_esh_hour').hide();
					$('#d_esh_limit > .fr_label').html( '# of Years:' );
				break;
				
				case 'monthly':
					$('#d_esh_year').show();
					$('#d_esh_month').show();
					$('#d_esh_day').hide();
					$('#d_esh_hour').hide();
					$('#d_esh_limit > .fr_label').html( '# of Months:' );
				break;
				
				case 'daily':
					$('#d_esh_year').show();
					$('#d_esh_month').show();
					$('#d_esh_day').show();
					$('#d_esh_hour').hide();
					$('#d_esh_limit > .fr_label').html( '# of Days:' );
				break;
				
				case 'hourly':
					$('#d_esh_year').show();
					$('#d_esh_month').show();
					$('#d_esh_day').show();
					$('#d_esh_hour').show();
					$('#d_esh_limit > .fr_label').html( '# of Hours:' );
				break;
			} // switch new_mode
			
			app.clearError();
			Dialog.autoResize();
		}; // change_mode
		
		$('#fe_esh_mode').on('change', function() {
			change_mode( $(this).val() );
			$('#fe_esh_limit').val(1);
		}); // type change
		
		SingleSelect.init( $('#fe_esh_mode, #fe_esh_year, #fe_esh_month, #fe_esh_day, #fe_esh_hour') );
		
		change_mode( args.mode );
	}
	
	getYearOptions() {
		// get locale-formatted year numbers for menu
		var start_year = yyyy( this.server ? this.server.created : this.group.created );
		var cur_year = yyyy();
		var options = [];
		
		for (var year = start_year; year <= cur_year; year++) {
			var date = new Date( year, 5, 15, 12, 30, 30, 0 );
			var label = this.formatDate( date.getTime() / 1000, { year: 'numeric' } );
			options.push([ ''+year, label ]);
		}
		
		return options;
	}
	
	getMonthOptions() {
		// get locale-formatted month names for menu
		var cur_year = yyyy();
		var options = [];
		
		for (var month = 1; month <= 12; month++) {
			var date = new Date( cur_year, month - 1, 15, 12, 30, 30, 0 );
			// var label = this.formatDate( date.getTime() / 1000, { month: 'short' } );
			// options.push([ ''+month, label ]);
			options.push({
				id: '' + month,
				title: this.formatDate( date.getTime() / 1000, { month: 'long' } ),
				abbrev: this.formatDate( date.getTime() / 1000, { month: 'short' } )
			});
		}
		
		return options;
	}
	
	getDayOptions() {
		// get locale-formatted month days for a 31-day month
		var cur_year = yyyy();
		var options = [];
		
		var date = new Date( cur_year, 6, 1, 12, 30, 30, 0 );
		var num = 1;
		while (options.length < 31) {
			var label = this.formatDate( date.getTime() / 1000, { day: 'numeric', timeZone: false } );
			options.push([ ''+num, label ]);
			date.setTime( date.getTime() + 86400000 );
			num++;
		}
		
		return options;
	}
	
	getHourOptions() {
		// get locale-formatted hours for a full day
		var cur_year = yyyy();
		var options = [];
		
		var date = new Date( cur_year, 6, 1, 0, 30, 30, 0 );
		while (options.length < 24) {
			var label = this.formatDate( date.getTime() / 1000, { hour: 'numeric', timeZone: false } );
			options.push([ ''+options.length, label ]);
			date.setTime( date.getTime() + 3600000 );
		}
		
		return options;
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
	
	applyMonitorFilter(elem) {
		// hide or show specific monitors based on substring match on title
		var filter = this.monitorFilter = $(elem).val();
		var re = new RegExp( escape_regexp(filter), 'i' );
		
		for (var key in this.charts) {
			var chart = this.charts[key];
			if (!chart._quick) {
				var $cont = $(chart.canvas).parent();
				if (chart.title.match(re)) $cont.show();
				else $cont.hide();
			}
		}
	}
	
	showAddServerDialog(default_groups) {
		// one-liner installation for opsrocket-satellite
		var self = this;
		var html = '<div class="dialog_box_content maximize">';
		
		// label
		html += this.getFormRow({
			label: 'Server Label:',
			content: this.getFormText({
				id: 'fe_as_title',
				spellcheck: 'false',
				placeholder: '(Use Hostname)',
				value: '',
				onChange: '$P().fetchServerInstallCode()'
			}),
			caption: 'Optionally enter a custom label for the new server.  Leave blank if adding multiple servers.'
		});
		
		// status
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_as_enabled',
				label: 'Server Enabled',
				checked: true,
				onChange: '$P().fetchServerInstallCode()'
			}),
			caption: 'Enable or disable the new server(s).  Disabled servers will not be chosen for any jobs.'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_as_icon',
				title: 'Select icon for server',
				placeholder: 'Select icon for server...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: '',
				onChange: '$P().fetchServerInstallCode()'
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for the new server(s).'
		});
		
		// groups
		html += this.getFormRow({
			label: 'Server Groups:',
			content: this.getFormMenuMulti({
				id: 'fe_as_groups',
				title: 'Select groups for new server',
				placeholder: '(Automatic)',
				options: app.groups,
				values: default_groups || [],
				default_icon: 'server-network',
				onChange: '$P().fetchServerInstallCode()',
				'data-hold': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Set the group(s) for the new server.  By default these are auto-assigned using the server hostname.'
		});
		
		// select platform
		html += this.getFormRow({
			label: 'Platform:',
			content: this.getFormMenuSingle({
				id: 'fe_as_platform',
				title: 'Select Platform',
				options: [ ['standard','Linux / macOS'], ['windows','Windows'] ],
				value: 'standard',
				onChange: '$P().updateServerInstallCode()',
			}),
			caption: 'Select the target platform to generate the install command for.'
		});
		
		// install commands
		html += this.getFormRow({
			label: 'Command:',
			content: this.getFormTextarea({
				id: 'fe_as_install_code',
				rows: 5,
				class: 'monospace',
				readonly: 'readonly',
				autocomplete: 'off',
				maxlength: 8192,
				value: ""
			}),
			caption: 'For Linux and macOS, paste this into a Terminal.  For Windows, hit <code>Win+R</code> and paste it right into the "Run" dialog.'
		});
		
		html += '</div>';
		
		var buttons_html = "";
		buttons_html += '<div class="button" onClick="$P().copyServerInstallCode()"><i class="mdi mdi-clipboard-text-outline">&nbsp;</i>Copy to Clipboard</div>';
		buttons_html += '<div class="button primary" onClick="Dialog.confirm_click(true)"><i class="mdi mdi-close-circle-outline">&nbsp;</i>Close</div>';
		
		Dialog.showSimpleDialog('Add Server to Network', html, buttons_html);
		
		// special mode for key capture
		Dialog.active = 'confirmation';
		Dialog.confirm_callback = function(result) { 
			if (result) Dialog.hide(); 
		};
		
		SingleSelect.init( $('#fe_as_icon, #fe_as_platform') );
		MultiSelect.init( $('#fe_as_groups') );
		Dialog.autoResize();
		
		this.fetchServerInstallCode();
	}
	
	updateServerInstallCode() {
		// update server install code based on platform
		var platform = $('#fe_as_platform').val();
		var code = substitute( config.ui.satellite_install_commands[platform], this.serverInstallArgs );
		$('#fe_as_install_code').val( code );
	}
	
	fetchServerInstallCode() {
		// update installer code based on selection
		var self = this;
		var data = {
			title: $('#fe_as_title').val().trim(),
			enabled: $('#fe_as_enabled').is(':checked'),
			icon: $('#fe_as_icon').val(),
			groups: $('#fe_as_groups').val()
		};
		
		app.api.post( 'app/get_satellite_token', data, function(resp) {
			self.serverInstallArgs = resp;
			self.updateServerInstallCode();
		});
	}
	
	copyServerInstallCode() {
		// copy install code to clipboard
		var code = $('#fe_as_install_code').val();
		copyToClipboard(code);
		app.showMessage('info', "The install command was copied to your clipboard.");
	}
	
	getNiceArches(servers) {
		// get nice list of unique arches from all servers
		var self = this;
		return [...new Set( servers.map( function(server) { return self.getNiceArch(server.info.arch); } ) )].join(', ') || 'n/a';
	}
	
	getNiceOSes(servers) {
		// get nice list of unique oses from all servers
		var self = this;
		return [...new Set( servers.map( function(server) { return self.getNiceShortOS(server.info.os); } ) )].join(', ') || 'n/a';
	}
	
	getNiceCPUTypes(servers) {
		// get nice list of unique cpu types from all servers
		var self = this;
		return [...new Set( servers.map( function(server) { return self.getNiceCPUType(server.info.cpu); } ) )].join(', ') || 'n/a';
	}
	
	getNiceVirts(servers) {
		// get nice list of unique virts from all servers
		var self = this;
		return [...new Set( servers.map( function(server) { return self.getNiceVirtualization(server.info.virt); } ) )].join(', ') || 'n/a';
	}
	
	getGroupMemDetails() {
		// get memory details
		var html = '';
		
		html += '<div class="dash_donut_grid">';
			html += this.getDonutDashUnit({ id: 'mem_used', value: 0, max: 1, type: 'bytes', suffix: '', label: 'Used', color: app.colors[2] });
			html += this.getDonutDashUnit({ id: 'mem_active', value: 0, max: 1, type: 'bytes', suffix: '', label: 'Active', color: app.colors[3] });
			html += this.getDonutDashUnit({ id: 'mem_available', value: 0, max: 1, type: 'bytes', suffix: '', label: 'Available', color: app.colors[0] });
			html += this.getDonutDashUnit({ id: 'mem_free', value: 0, max: 1, type: 'bytes', suffix: '', label: 'Free', color: app.colors[1] });
			html += this.getDonutDashUnit({ id: 'mem_buffers', value: 0, max: 1, type: 'bytes', suffix: '', label: 'Buffered', color: app.colors[4] });
			html += this.getDonutDashUnit({ id: 'mem_cached', value: 0, max: 1, type: 'bytes', suffix: '', label: 'Cached', color: app.colors[5] });
		html += '</div>';
		
		return html;
	}
	
	getGroupCPUDetails() {
		// get table of individual cpu details
		var html = '';
		
		html += '<div class="dash_donut_grid">';
			html += this.getDonutDashUnit({ id: 'cpu_user', value: 0, max: 100, type: 'float', suffix: '%', label: 'User %', color: app.colors[6] });
			html += this.getDonutDashUnit({ id: 'cpu_system', value: 0, max: 100, type: 'float', suffix: '%', label: 'System %', color: app.colors[7] });
			html += this.getDonutDashUnit({ id: 'cpu_nice', value: 0, max: 100, type: 'float', suffix: '%', label: 'Nice %', color: app.colors[8] });
			html += this.getDonutDashUnit({ id: 'cpu_iowait', value: 0, max: 100, type: 'float', suffix: '%', label: 'I/O Wait %', color: app.colors[9] });
			html += this.getDonutDashUnit({ id: 'cpu_irq', value: 0, max: 100, type: 'float', suffix: '%', label: 'Hard IRQ %', color: app.colors[11] });
			html += this.getDonutDashUnit({ id: 'cpu_softirq', value: 0, max: 100, type: 'float', suffix: '%', label: 'Soft IRQ %', color: app.colors[12] });
		html += '</div>';
		
		return html;
	}
	
	updateGroupMemDetails() {
		// update mem donuts smoothly
		var self = this;
		var $cont = this.div.find('#d_vg_mem');
		
		var mem = {};
		var mmas = {};
		var merge_type = app.getPref('cpu_mem_merge_mem') || 'total';
		
		['used', 'active', 'available', 'free', 'buffers', 'cached', 'total'].forEach( function(key) {
			mmas[key] = { total: 0, count: 0, min: false, max: false };
		} );
		
		this.servers.forEach( function(server) {
			if (!server.quick || !server.quick.data || !server.quick.data.mem) return;
			if (!self.visibleServerIDs[ server.id ]) return;
			var data = server.quick.data;
			
			for (var key in mmas) {
				var mma = mmas[key];
				var value = data.mem[key] || 0;
				
				mma.total += value;
				mma.count++;
				if ((mma.min === false) || (value < mma.min)) mma.min = value;
				if ((mma.max === false) || (value > mma.max)) mma.max = value;
			}
		} ); // foreach server
		
		for (var key in mmas) {
			var mma = mmas[key];
			switch (merge_type) {
				case 'total': mem[key] = mma.total; break;
				case 'average': mem[key] = Math.floor( mma.total / (mma.count || 1) ); break;
				case 'minimum': mem[key] = mma.min || 0; break;
				case 'maximum': mem[key] = mma.max || 0; break;
			}
		}
		
		for (var id in this.donutDashUnits) {
			if (id.match(/^mem_(\w+)$/)) {
				var key = RegExp.$1;
				var opts = this.donutDashUnits[id];
				
				var new_value = mem[key] || 0;
				var old_value = opts.value || 0;
				
				var new_pct = short_float( (new_value / (mem.total || 1)) * 100, 3 );
				var old_pct = short_float( (old_value / (opts.max || 1)) * 100, 3 );
				
				var value_disp = this.getDashValue(new_value, opts.type, opts.suffix);
				var $elem = $cont.find('#ddc_' + id + ' > div.dash_donut_image');
				$elem.find('> div.dash_donut_value').html( value_disp );
				
				// add animation controller for donut change
				this.detailAnimation.donuts.push({
					elem: $elem,
					from: old_pct,
					to: new_pct,
					color: opts.color,
					bg: opts.bg
				});
				
				opts.value = new_value;
				opts.max = mem.total;
			}
		}
	}
	
	updateGroupCPUDetails() {
		// update cpu donuts and progress bars smoothly
		var self = this;
		var $cont = this.div.find('#d_vg_cpus');
		
		var cpu = {};
		var mmas = {};
		var merge_type = app.getPref('cpu_mem_merge_cpu') || 'total';
		
		['user', 'system', 'nice', 'iowait', 'irq', 'softirq', 'total'].forEach( function(key) {
			mmas[key] = { total: 0, count: 0, min: false, max: false };
		} );
		
		this.servers.forEach( function(server) {
			if (!server.quick || !server.quick.data || !server.quick.data.cpu) return;
			if (!self.visibleServerIDs[ server.id ]) return;
			var data = server.quick.data;
			
			data.cpu.totals.total = 100;
			
			for (var key in mmas) {
				var mma = mmas[key];
				var value = data.cpu.totals[key] || 0;
				
				mma.total += value;
				mma.count++;
				if ((mma.min === false) || (value < mma.min)) mma.min = value;
				if ((mma.max === false) || (value > mma.max)) mma.max = value;
			}
		} ); // foreach server
		
		for (var key in mmas) {
			var mma = mmas[key];
			switch (merge_type) {
				case 'total': cpu[key] = mma.total; break;
				case 'average': cpu[key] = short_float( mma.total / (mma.count || 1) ); break;
				case 'minimum': cpu[key] = mma.min || 0; break;
				case 'maximum': cpu[key] = mma.max || 0; break;
			}
		}
		
		for (var id in this.donutDashUnits) {
			if (id.match(/^cpu_(\w+)$/)) {
				var key = RegExp.$1;
				var opts = this.donutDashUnits[id];
				
				var new_value = cpu[key] || 0;
				var old_value = opts.value || 0;
				
				var new_pct = short_float( (new_value / (cpu.total || 1)) * 100, 3 );
				var old_pct = short_float( (old_value / (opts.max || 1)) * 100, 3 );
				
				var value_disp = this.getDashValue(new_value, opts.type, opts.suffix);
				var $elem = $cont.find('#ddc_' + id + ' > div.dash_donut_image');
				$elem.find('> div.dash_donut_value').html( value_disp );
				
				// add animation controller for donut change
				this.detailAnimation.donuts.push({
					elem: $elem,
					from: old_pct,
					to: new_pct,
					color: opts.color,
					bg: opts.bg
				});
				
				opts.value = new_value;
				opts.max = cpu.total;
			}
		}
	}
	
	getCPUMemMergeSelector(key) {
		// get box title widget for selecting merge type
		return '<div class="box_title_widget" style="overflow:visible; min-width:100px; max-width:200px; font-size:13px;">' + this.getFormMenuSingle({
			class: 'sel_cpu_mem_merge',
			title: 'Select merge type',
			options: config.ui.cpu_mem_merge_menu,
			value: app.getPref('cpu_mem_merge_' + key) || 'total',
			onChange: `$P().applyCPUMemMerge('${key}',this)`,
			'data-shrinkwrap': 1,
			'data-compact': 1
		}) + '</div>';
	}
	
	applyCPUMemMerge(key, elem) {
		// set new cpu/mem merge type
		var type = $(elem).val();
		app.setPref('cpu_mem_merge_' + key, type);
		
		// now update the cpu & mem detail donuts
		// this may interrupt and restart an animation in progress
		this.updateDonutDashUnits();
	}
	
	updateGroupServerTable() {
		// render sortable server table, or update it
		var self = this;
		var servers = this.servers;
		var args = this.args;
		var now = this.epoch || app.epoch;
		var html = '';
		
		// build opt groups for server props like OS, CPU, etc.
		var opt_groups = { os_platform: {}, os_distro: {}, os_release: {}, os_arch: {}, cpu_virt: {}, cpu_type: {}, cpu_cores: {} };
		
		servers.forEach( function(server) {
			var info = server.info || {};
			if (!info.os) info.os = {};
			if (!info.cpu) info.cpu = {};
			if (!info.virt) info.virt = {};
			
			if (info.os.platform) opt_groups.os_platform[ info.os.platform ] = 1;
			if (info.os.distro) opt_groups.os_distro[ info.os.distro ] = 1;
			if (info.os.release) opt_groups.os_release[ info.os.release ] = 1;
			if (info.os.arch) opt_groups.os_arch[ info.os.arch ] = 1;
			if (info.virt.vendor) opt_groups.cpu_virt[ info.virt.vendor ] = 1;
			if (info.cpu.combo) opt_groups.cpu_type[ info.cpu.combo ] = 1;
			if (info.cpu.cores) opt_groups.cpu_cores[ info.cpu.cores ] = 1;
		} );
		
		// sort alpha and convert to id/title for menu opts
		for (var key in opt_groups) {
			opt_groups[key] = Object.keys(opt_groups[key]).sort().map( function(value) { return { id: crammify(value), title: value }; } );
		}
		
		// must sort cpu_cores numerically
		opt_groups.cpu_cores.sort( function(a, b) {
			return parseInt(a.id) - parseInt(b.id);
		} );
		
		var filter_opts = [
			{ id: '', title: 'All Servers', icon: 'server' },
			{ id: 'z_online', title: 'Online Only', icon: 'checkbox-marked-outline' },
		].concat(
			this.buildOptGroup( opt_groups.os_platform, "OS Platform:", '', 'osp_' ),
			this.buildOptGroup( opt_groups.os_distro, "OS Distro:", '', 'osd_' ),
			this.buildOptGroup( opt_groups.os_release, "OS Release:", '', 'osr_' ),
			this.buildOptGroup( opt_groups.os_arch, "OS Arch:", '', 'osa_' ),
			this.buildOptGroup( opt_groups.cpu_type, "CPU Type:", '', 'cput_' ),
			this.buildOptGroup( opt_groups.cpu_cores, "CPU Cores:", '', 'cpuc_' ),
			this.buildOptGroup( opt_groups.cpu_virt, "Virtualization:", '', 'virt_' )
		);
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['Server', 'IP Address', 'Groups', '# CPUs', 'RAM', 'OS', 'Uptime', '# Jobs', '# Alerts'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			// html += '<div class="header_search_widget"><i class="mdi mdi-magnify">&nbsp;</i><input type="text" size="15" placeholder="Search"/></div>';
			
			html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(\'#fe_vg_search\').focus()">&nbsp;</i><input type="text" id="fe_vg_search" placeholder="Filter" value="' + encode_attrib_entities(args.search ?? '') + '" onInput="$P().applyServerTableFiltersDebounce()"/></div>';
			
			html += '<div class="box_title_widget" style="overflow:visible; min-width:120px; max-width:200px; font-size:13px;">' + this.getFormMenuSingle({
				id: 'fe_vg_filter',
				title: 'Filter server list',
				options: filter_opts,
				value: args.filter || '',
				onChange: '$P().applyServerTableFilters()',
				'data-shrinkwrap': 1
			}) + '</div>';
			
			html += 'Group Servers';
			if (this.histTitle) html += ' &mdash; ' + this.histTitle;
			
		html += '</div>';
		html += '<div class="box_content table">';
		
		var grid_opts = {
			rows: this.servers,
			cols: cols,
			data_type: 'server',
			below: '<ul class="grid_row_empty" id="ul_vg_none_found" style="display:none"><div style="grid-column-start: span ' + cols.length + ';">No servers found matching your filters.</div></ul>'
		};
		
		html += this.getBasicGrid( grid_opts, function(item, idx) {
			var classes = [];
			if (!item.info) item.info = {};
			if (!item.info.os) item.info.os = { distro: 'Unknown', release: '' };
			if (!item.info.cpu) item.info.cpu = {};
			if (!item.info.memory) item.info.memory = {};
			
			var color_swatch = '<i class="mdi mdi-circle" style="color:' + item.color + '">&nbsp;</i>';
			
			var nice_jobs = '';
			var nice_alerts = '';
			
			switch (self.groupMode) {
				case 'live':
					nice_jobs = 'Idle';
					var num_jobs = find_objects( app.activeJobs, { server: item.id } ).length;
					if (num_jobs > 0) nice_jobs = '<i class="mdi mdi-autorenew mdi-spin">&nbsp;</i><b>' + num_jobs + '</b>';
					
					nice_alerts = 'None';
					var num_alerts = find_objects( app.activeAlerts, { server: item.id } ).length;
					if (num_alerts > 0) nice_alerts = '<i class="mdi mdi-bell-outline">&nbsp;</i><b>' + num_alerts + '</b>';
				break;
				
				case 'snapshot':
					nice_jobs = 'None';
					var num_jobs = find_objects( self.jobs || [], { server: item.id } ).length;
					if (num_jobs > 0) nice_jobs = '<b>' + num_jobs + '</b>';
					
					nice_alerts = 'None';
					var num_alerts = find_objects( self.alerts || [], { server: item.id } ).length;
					if (num_alerts > 0) nice_alerts = '<i class="mdi mdi-bell-outline">&nbsp;</i><b>' + num_alerts + '</b>';
				break;
				
				case 'history':
					nice_jobs = 'n/a';
					nice_alerts = 'n/a';
				break;
			}
			
			var nice_uptime = (!item.offline && item.info.booted) ? self.getNiceUptime( now - item.info.booted ) : 'Offline';
			
			var tds = [
				'<span style="font-weight:bold">' + color_swatch + self.getNiceServer(item, true) + '</span>',
				self.getNiceIP(item.ip),
				self.getNiceGroupList(item.groups, true),
				'<i class="mdi mdi-chip">&nbsp;</i>' + (item.info.cpu.cores || 0),
				'<i class="mdi mdi-memory">&nbsp;</i>' + get_text_from_bytes(item.info.memory.total || 0),
				self.getNiceShortOS(item.info.os),
				'<div id="d_vg_server_uptime_' + item.id + '">' + nice_uptime + '</div>',
				'<div id="d_vg_server_jobs_' + item.id + '">' + nice_jobs + '</div>',
				nice_alerts // no need for div here: alert change redraws entire table
			];
			
			if (item.offline) classes.push('disabled');
			if (num_alerts > 0) classes.push( 'clr_red' );
			if (classes.length) tds.className = classes.join(' ');
			return tds;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '</div>'; // box
		
		this.div.find('#d_vg_servers').html( html );
		this.applyServerTableFilters();
		SingleSelect.init( this.div.find('#fe_vg_filter') );
	}
	
	applyServerTableFilters() {
		// filters and/or search query changed -- re-filter table
		var self = this;
		var args = this.args;
		var num_visible = 0;
		var vis_server_ids = {};
		
		args.search = $('#fe_vg_search').val();
		args.filter = $('#fe_vg_filter').val();
		if (!args.search.length) delete args.search;
		if (!args.filter.length) delete args.filter;
		var is_filtered = (('search' in args) || ('filter' in args));
		
		this.div.find('#d_vg_servers .box_content.table ul.grid_row').each( function(idx) {
			var $this = $(this);
			var row = self.servers[idx];
			
			if (self.isServerRowVisible(row)) { $this.show(); num_visible++; vis_server_ids[row.id] = 1; }
			else $this.hide();
		} );
		
		// if ALL items are hidden due to search/filter, show some kind of message
		if (!num_visible && is_filtered && this.servers.length) this.div.find('#ul_vg_none_found').show();
		else this.div.find('#ul_vg_none_found').hide();
		
		// show filtered label on all sections below table, if applicable
		if (is_filtered) this.div.find('span.s_grp_filtered').html('(Filtered)').show();
		else this.div.find('span.s_grp_filtered').hide();
		
		// do history.replaceState jazz here (NO, not doing this, it breaks the page data stream)
		// don't mess up initial visit href
		// var query = deep_copy_object(args);
		// var url = '#Groups' + (num_keys(query) ? compose_query_string(query) : '');
		// history.replaceState( null, '', url );
		// Nav.loc = url.replace(/^\#/, '');
		
		// save these for later
		this.visibleServerIDs = vis_server_ids;
		
		// reevaluate chart layer visibility
		for (var key in this.charts) {
			var chart = this.charts[key];
			chart.layers.forEach( function(layer) {
				layer.hidden = !vis_server_ids[ layer.id ];
			} );
			chart.dirty = true;
		}
		
		ChartManager.check();
		
		// resraw everything here that may be affected, e.g. alerts, jobs
		this.renderGroupFilteredSections();
	}
	
	isServerRowVisible(item) {
		// check if row should be filtered using args
		var args = this.args;
		var is_filtered = (('search' in args) || ('filter' in args));
		if (!is_filtered) return true; // show
		
		if (('search' in args) && args.search.length) {
			var words = [item.title || '', item.hostname, item.ip, item.info.os.distro, item.info.os.release].join(' ').toLowerCase();
			if (words.indexOf(args.search.toLowerCase()) == -1) return false; // hide
		}
		
		if (('filter' in args) && args.filter.match && args.filter.match(/^([a-z0-9]+)_(.+)$/)) {
			var mode = RegExp.$1;
			var value = RegExp.$2;
			
			if (!item.info) item.info = {};
			if (!item.info.os) item.info.os = {};
			if (!item.info.cpu) item.info.cpu = {};
			if (!item.info.virt) item.info.virt = {};
			
			switch (mode) {
				case 'z':
					if ((value == 'online') && item.offline) return false; // hide
				break;
				
				case 'osp':
					if (crammify(item.info.os.platform) != value) return false; // hide
				break;
				
				case 'osd':
					if (crammify(item.info.os.distro) != value) return false; // hide
				break;
				
				case 'osr':
					if (crammify(item.info.os.release) != value) return false; // hide
				break;
				
				case 'osa':
					if (crammify(item.info.os.arch) != value) return false; // hide
				break;
				
				case 'virt':
					if (crammify(item.info.virt.vendor) != value) return false; // hide
				break;
				
				case 'cput':
					if (crammify(item.info.cpu.combo) != value) return false; // hide
				break;
				
				case 'cpuc':
					if (crammify(item.info.cpu.cores) != value) return false; // hide
				break;
			} // switch mode
		}
		
		return true; // show
	}
	
	renderGroupProcessTable() {
		// render html for sortable proc table
		var self = this;
		
		var proc_opts = {
			id: 't_grp_procs',
			item_name: 'process',
			attribs: {
				class: 'data_grid grp_proc_grid'
			},
			sort_by: 'cpu',
			sort_dir: -1,
			filter: '',
			column_ids: ['command', 'server_label', 'user', 'pid', 'parentPid', 'cpu', 'memRss', 'age', 'state'],
			column_labels: ['Command', 'Server', 'User', 'PID', 'Parent', 'CPU', 'Memory', 'Age', 'State']
		};
		
		var proc_list = [];
		this.servers.forEach( function(server) {
			if (server.offline) return; // skip offline servers
			if (!self.visibleServerIDs[ server.id ]) return; // skip hidden servers
			
			var snapshot = server.snapshot || {};
			if (!snapshot.data) return;
			if (!snapshot.data.processes) return;
			if (!snapshot.data.processes.list) return;
			
			snapshot.data.processes.list.forEach( function(proc) {
				proc.server_label = server.title || server.hostname || server.id;
				proc.server = server.id;
				proc_list.push( proc );
			} );
		} );
		
		var html = this.getSortableTable( proc_list, proc_opts, function(proc) {
			return [
				'<b>' + self.getNiceProcess(proc, true) + '</b>',
				self.getNiceServer(proc.server, true),
				proc.user,
				`<span class="link" onClick="$P().showGroupProcessInfo(${proc.pid},'${proc.server}')">${proc.pid}</span>`,
				proc.parentPid ? (`<span class="link" onClick="$P().showGroupProcessInfo(${proc.parentPid},'${proc.server}')">${proc.parentPid}</span>`) : 'n/a',
				pct( proc.cpu, 100 ),
				get_text_from_bytes( proc.memRss ),
				get_text_from_seconds( proc.age || 0, true, true ),
				ucfirst(proc.state || 'unknown')
			];
		});
		
		this.div.find('#d_vg_procs > .box_content').html( html );
	}
	
	showGroupProcessInfo(pid, sid) {
		// show process info, group edition
		var server = find_object(this.servers, { id: sid });
		if (!server) return; // sanity
		
		var snapshot = server.snapshot || {};
		if (!snapshot.data) return;
		if (!snapshot.data.processes) return;
		if (!snapshot.data.processes.list) return;
		
		this.showProcessInfo(pid, snapshot);
	}
	
	renderGroupConnectionTable() {
		// render html for sortable connection table
		var self = this;
		
		var conn_opts = {
			id: 't_snap_conns',
			item_name: 'connection',
			attribs: {
				class: 'data_grid grp_conn_grid'
			},
			sort_by: 'state',
			sort_dir: 1,
			filter: '',
			column_ids: ['state', 'server_label', 'type', 'local_addr', 'remote_addr', 'command', 'bytes_in', 'bytes_out'],
			column_labels: ['State', 'Server', 'Protocol', 'Local Address', 'Remote Address', 'Process', 'Bytes In', 'Bytes Out']
		};
		
		var conn_list = [];
		this.servers.forEach( function(server) {
			if (server.offline) return; // skip offline servers
			if (!self.visibleServerIDs[ server.id ]) return; // skip hidden servers
			
			var snapshot = server.snapshot || {};
			if (!snapshot.data) return;
			if (!snapshot.data.conns) return;
			
			snapshot.data.conns.forEach( function(conn) {
				conn.server_label = server.title || server.hostname || server.id;
				conn.server = server.id;
				
				conn.proc = null;
				if (conn.pid && snapshot.data.processes && snapshot.data.processes.list) {
					conn.proc = find_object(snapshot.data.processes.list, { pid: conn.pid });
					if (conn.proc) conn.proc.server = server.id; // for getNiceProcess
				}
				
				conn_list.push( conn );
			} );
		});
		
		var html = this.getSortableTable( conn_list, conn_opts, function(conn) {
			var nice_state = conn.state.toString().split(/_/).map( function(word) { return ucfirst(word); } ).join(' ');
			return [
				'<i class="mdi mdi-network-outline">&nbsp;</i>' + nice_state,
				self.getNiceServer(conn.server, true),
				conn.type.toUpperCase(),
				conn.local_addr,
				conn.remote_addr,
				conn.proc ? self.getNiceProcess(conn.proc, true) : (conn.pid || '(None)'),
				get_text_from_bytes( conn.bytes_in || 0 ),
				get_text_from_bytes( conn.bytes_out || 0 )
			];
		});
		
		this.div.find('#d_vg_conns > .box_content').html( html );
	}
	
	histNavPrev() {
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
	
	histNavNext() {
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
	
	histNudgeLimit(epoch_start, limit) {
		// ensure limit keeps graph range within current mode (yearly, etc.)
		var args = this.args;
		var sys = this.sys;
		var done = false;
		
		var criteria = {};
		['year', 'month', 'day', 'hour'].forEach( function(key) { if (key in args) criteria[key] = args[key]; } );
		var num_crit = num_keys(criteria);
		
		// support limit > 1 for ranges
		if (args.limit && (args.limit > 1)) {
			switch (args.mode) {
				case 'yearly':
					criteria.year += (args.limit - 1);
				break;
				
				case 'monthly':
					criteria.month += (args.limit - 1);
					if (criteria.month > 12) { criteria.month -= 12; criteria.year++; }
				break;
				
				case 'daily':
					var dargs = this.getDateArgsTZ( epoch_start + 43200 + (86400 * (args.limit - 1)) );
					criteria.year = dargs.year;
					criteria.month = dargs.month;
					criteria.day = dargs.day;
				break;
				
				case 'hourly':
					var dargs = this.getDateArgsTZ( epoch_start + (3600 * (args.limit - 1)) );
					criteria.year = dargs.year;
					criteria.month = dargs.month;
					criteria.day = dargs.day;
					
					// special case here for jumping over fall-back DST
					// (i.e. where jumping forward one hour will land on the same YYYY-MM-DD-HH)
					criteria.hour = (dargs.hour == criteria.hour) ? (dargs.hour + 1) : dargs.hour;
				break;
			} // switch args.mode
		} // limit adj
		
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
	
	histPrep() {
		// prep for ServerHist or GroupHist display
		var args = this.args;
		var sys = this.sys;
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
		limit = this.histNudgeLimit(epoch_start, limit);
		
		this.epochStart = epoch_start;
		this.epochEnd = epoch_start + (limit * sys.epoch_div);
		this.chartLimit = limit;
		
		// possibly augment title if range is wider than one unit
		if (args.limit && (args.limit > 1)) {
			switch (args.mode) {
				case 'yearly': title += ' - ' + this.formatDate(this.epochEnd - 1, { year: 'numeric' } ); break;
				case 'monthly': title += ' - ' + this.formatDate(this.epochEnd - 1, { year: 'numeric', month: 'long' } ); break;
				case 'daily': title += ' - ' + this.formatDate(this.epochEnd - 1, { year: 'numeric', month: 'long', day: 'numeric' } ); break;
				case 'hourly': title = this.formatDateRange( this.epochStart, this.epochEnd, { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric' } ); break;
			}
		}
		
		this.histTitle = title;
		this.histIcon = icon;
		this.histUnit = unit;
	}
	
	applyJobHistoryFilters() {
		// menu change for job history filter popdown
		this.jobHistArgs.filter = this.div.find('#fe_vs_job_filter').val();
		this.div.find('#d_vs_jobs > .box_content').html( '<div class="loading_container"><div class="loading"></div></div>' );
		this.fetchJobHistory();
	}
	
	fetchJobHistory() {
		// fetch job history from server
		var args = this.jobHistArgs;
		
		// { query, offset, limit, sort_by, sort_dir }
		if (this.server) args.query = 'server:' + this.server.id;
		else if (this.group) args.query = 'groups:' + this.group.id;
		
		args.offset = args.offset || 0;
		args.limit = config.alt_items_per_page;
		args.sort_by = 'completed'; 
		args.sort_dir = -1;
		
		// add epoch date range (don't use .. range shorthand because end is inclusive)
		args.query += ' date:>=' + this.epochStart + ' date:<' + this.epochEnd;
		
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
				case 'z_test': args.query += ' tags:_test'; break;
				
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
			query: '',
			offset: this.alertHistoryOffset,
			limit: config.alt_items_per_page,
			sort_by: '_id',
			sort_dir: -1,
			ttl: 1
		};
		
		if (this.server) opts.query = 'server:' + this.server.id;
		else if (this.group) opts.query = 'groups:' + this.group.id;
		
		// add epoch date range: start:<RIGHT_SIDE_RANGE end:>=LEFT_SIDE_RANGE
		opts.query += ' start:<' + this.epochEnd + ' end:>=' + this.epochStart;
		
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
	
};
