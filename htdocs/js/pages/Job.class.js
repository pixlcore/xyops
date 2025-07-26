// Job Details Pages

Page.Job = class Job extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.colors = app.colors;
		this.header_bar_width = 175;
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		app.setHeaderTitle( '...' );
		
		this.job = null;
		this.converter = new AnsiUp();
		this.liveLogReady = false;
		this.snapEpoch = null;
		this.emptyLogMessage = false;
		this.emptyLogAttempts = 0;
		this.redraw = "";
		this.metaRowCount = 0;
		
		this.loading();
		app.api.get( 'app/get_job', { id: args.id }, this.receive_job.bind(this), this.fullPageError.bind(this) );
		return true;
	}
	
	receive_job(resp) {
		// render job details
		this.token = resp.token;
		this.job = resp.job;
		var job = this.job;
		var self = this;
		
		if (!this.active) return; // sanity
		
		var is_workflow = this.isWorkflow = (job.type == 'workflow');
		var is_sub_job = !!(job.workflow && job.workflow.job);
		var is_adhoc = is_sub_job && (job.type == 'adhoc');
		this.workflow = this.isWorkflow ? this.job.workflow : null;
		
		// we need the event present
		this.event = find_object( app.events, { id: this.job.event } );
		
		// sanity
		if (!job.timelines) job.timelines = {};
		if (!job.timelines.second) job.timelines.second = [];
		if (!job.timelines.minute) job.timelines.minute = [];
		
		// var event = find_object(app.events, { id: job.event }) || { title: job.event };
		var icon = '';
		
		if (job.final) {
			// complete
			this.live = false;
			
			if (is_workflow) icon = 'clipboard';
			else icon = 'timer';
			
			icon += '-' + (job.code ? 'alert' : 'check') + '-outline';
			// app.setHeaderTitle( '<i class="mdi mdi-timer-' + (job.code ? 'alert' : 'check') + '-outline">&nbsp;</i>Completed Job' );
			app.setWindowTitle( "Completed Job: #" + job.id );
			
			if (job.timelines && job.timelines.minute && job.timelines.minute.length) {
				// completed job: default snap to first minute
				this.snapEpoch = job.timelines.minute[0].epoch;
			}
		}
		else {
			// in progress
			this.live = true;
			icon = is_workflow ? 'clipboard-play-outline' : 'timer-play-outline';
			// app.setHeaderTitle( '<i class="mdi mdi-timer-play-outline">&nbsp;</i>Live Job Progress' );
			app.setWindowTitle( "Live Job Progress: #" + job.id );
		}
		
		// construct nav bar
		var nav_items = [];
		if (is_sub_job) nav_items.push({ icon: 'clipboard-play-outline', title: "Workflow #" + job.workflow.job, loc: '#Job?id=' + job.workflow.job });
		if (is_workflow) nav_items.push({ icon: icon, title: "Workflow #" + job.id });
		else nav_items.push({ icon: icon, title: "Job #" + job.id });
		
		if (job.final) {
			// job is complete
			var jargs = this.getJobResultArgs(job);
			nav_items.push(
				{ type: 'badge', color: jargs.color, icon: jargs.icon, title: jargs.text }
			);
		}
		else {
			// job in progress
			var bwidth = this.header_bar_width;
			nav_items.push(
				'<div class="progress_bar_container" id="d_live_progress_bar_cont" style="width:' + bwidth + 'px;">' + 
					'<div class="progress_bar_label first_half" style="width:' + bwidth + 'px;"></div>' + 
					'<div class="progress_bar_inner" style="width:0px;">' + 
						'<div class="progress_bar_label second_half" style="width:' + bwidth + 'px;"></div>' + 
					'</div>' + 
				'</div>'
			);
		}
		
		app.setHeaderNav( nav_items );
		
		var html = '';
		
		if (job.final) {
			// show completion banner at top
			var banner_class = 'success';
			if (job.code) {
				banner_class = 'error';
				if (job.code == 'warning') banner_class = 'warning';
				else if (job.code == 'critical') banner_class = 'critical';
				else if (job.code == 'abort') banner_class = 'abort';
				if (!job.description) job.description = 'Unknown Error (no description provided).';
			}
			else {
				if (!job.description) job.description = 'Job completed successfully.';
			}
			
			// icon for banner
			var banner_icon = '';
			var prefix = '';
			switch (banner_class) {
				case 'success': banner_icon = 'check-circle'; break;
				case 'warning': banner_icon = 'alert-rhombus'; prefix = 'Warning: '; break;
				case 'error': banner_icon = 'alert-decagram'; prefix = 'Error (' + job.code + '): '; break;
				case 'critical': banner_icon = 'flash-alert'; prefix = 'Critical: '; break;
				case 'abort': banner_icon = 'cancel'; prefix = 'Job Aborted: '; break;
			}
			
			// render inline banner
			html += '<div class="box message inline ' + banner_class + '">';
				html += '<div class="message_inner">';
					html += '<div id="d_job_banner_tags" style="float:right;"></div>';
					html += '<i class="mdi mdi-' + banner_icon + '">&nbsp;&nbsp;&nbsp;</i>';
					html += prefix + encode_entities( job.description );
				html += '</div>';
			html += '</div>';
		} // complete
		
		// nice retry count
		var nice_retry_count = '(Initial)';
		if (job.retry_count) {
			nice_retry_count = '<i class="mdi mdi-refresh">&nbsp;</i>Retry #' + job.retry_count;
			if (job.retry_prev) {
				nice_retry_count += ' (<a href="#Job?id=' + job.retry_prev + '">Previous</a>)';
			}
		}
		
		// check if user will be notified on job completion
		var notify_me = !!find_object( job.actions, { condition: 'complete', type: 'email', email: app.user.email } );
		var notify_icon = notify_me ? 'checkbox-marked-circle-outline' : 'email-outline';
		
		// summary
		html += '<div id="d_job_summary" class="box">';
			html += '<div class="box_title">';
				// html += 'Job Summary';
				
				if (job.final) {
					// job is complete
					html += '<span>Job Summary</span>';
					
					// html += '<div class="button right" onClick="$P().do_confirm_run_again()"><i class="mdi mdi-run-fast">&nbsp;</i>Run Again</div>';
					// html += '<div class="button right secondary" onClick="$P().do_view_job_data()"><i class="mdi mdi-code-json">&nbsp;</i>View JSON...</div>';
					// html += '<div class="button right danger" onClick="$P().do_delete_job()"><i class="mdi mdi-trash-can-outline">&nbsp;</i>Delete Job...</div>';
					
					html += '<div class="button icon right danger" title="Delete Job..." onClick="$P().do_delete_job()"><i class="mdi mdi-trash-can-outline"></i></div>';
					
					html += '<div class="button icon right secondary" title="Add Comment..." onClick="$P().do_edit_comment(-1)"><i class="mdi mdi-comment-processing-outline"></i></div>';
					html += '<div class="button icon right secondary" title="Update Tags..." onMouseDown="$P().do_update_tags(this)"><i class="mdi mdi-tag-plus-outline"></i></div>';
					
					// html += '<div class="button icon right secondary" title="View JSON..." onClick="$P().do_view_job_data()"><i class="mdi mdi-code-json"></i></div>';
					html += '<div class="button icon right" title="Run Again..." onClick="$P().do_confirm_run_again()"><i class="mdi mdi-run-fast"></i></div>';
					
					html += '<div class="clear"></div>';
				}
				else {
					// job is in progress
					// html += '<div id="d_live_progress_bar_cont" class="progress_bar_container" style="width:196px; float:left;">';
					// 	html += '<div id="d_live_progress_bar" class="progress_bar_inner" style="width:0px;"></div>';
					// html += '</div>';
					// html += '<div id="d_live_pct" style="float:left; margin-left:15px;"></div>';
					
					html += '<span>Job In Progress</span>';
					
					html += '<div class="button right danger" onMouseUp="$P().do_abort_job()"><i class="mdi mdi-cancel">&nbsp;</i>Abort Job...</div>';
					html += '<div class="button right" id="btn_job_notify" onMouseUp="$P().do_notify_me()"><i class="mdi mdi-' + notify_icon + '">&nbsp;</i>Notify Me</div>';
					html += '<div class="clear"></div>';
				}
			html += '</div>';
			
			html += '<div class="box_content table">';
				html += '<div class="summary_grid">';
				
					// row 1
					html += '<div>';
						html += '<div class="info_label">Job ID</div>';
						html += '<div class="info_value monospace">' + this.getNiceCopyableID(job.id) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Category</div>';
						html += '<div class="info_value">' + this.getNiceCategory(job.category, true) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Targets</div>';
						html += '<div class="info_value">' + this.getNiceTargetList(job.targets, true) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Job State</div>';
						html += '<div class="info_value" id="d_live_state">' + this.getNiceJobState(job) + '</div>';
					html += '</div>';
					
					// row 2
					html += '<div>';
						html += '<div class="info_label">Event</div>';
						html += '<div class="info_value">' + (is_adhoc ? 'n/a' : this.getNiceEvent(job.event, true)) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Plugin</div>';
						html += '<div class="info_value">' + this.getNicePlugin(job.plugin, true) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Server</div>';
						html += '<div class="info_value" id="d_live_server">' + this.getNiceServer(job.server, true) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Job Started</div>';
						html += '<div class="info_value">' + this.getRelativeDateTime( job.started, true ) + '</div>';
					html += '</div>';
					
					// row 3
					html += '<div>';
						html += '<div class="info_label">Parent Workflow</div>';
						html += '<div class="info_value">' + this.getNiceWorkflowJob(job.workflow, true) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Linked Job</div>';
						html += '<div class="info_value">' + this.getNiceJob(job.parent, true) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Avg CPU</div>';
						html += '<div class="info_value" id="d_live_cpu"><i class="mdi mdi-chip">&nbsp;</i>' + this.getNiceJobAvgCPU(job) + '</div>';
					html += '</div>';
					
					html += '<div>';
						if (job.final) {
							html += '<div class="info_label">Job Completed</div>';
							html += '<div class="info_value">' + this.getRelativeDateTime( job.completed, true ) + '</div>';
						}
						else {
							html += '<div class="info_label">Remaining Time</div>';
							html += '<div class="info_value"><span id="s_live_remain"></span></div>';
						}
					html += '</div>';
					
					// row 4
					html += '<div>';
						html += '<div class="info_label">Source</div>';
						html += '<div class="info_value">' + this.getNiceJobSource(job) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Attempt</div>';
						html += '<div class="info_value">' + nice_retry_count + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Avg Mem</div>';
						html += '<div class="info_value" id="d_live_mem"><i class="mdi mdi-memory">&nbsp;</i>' + this.getNiceJobAvgMem(job) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Elapsed Time</div>';
						html += '<div class="info_value"><span id="s_live_elapsed">' + this.getNiceJobElapsedTime(job) + '</span></div>';
					html += '</div>';
					
				html += '</div>';
			html += '</div>';
		html += '</div>';
		
		// workflow preview
		if (is_workflow) {
			html += '<div class="box">';
			html += '<div class="box_content">';
			html += '<div class="wf_container preview" id="d_wf_container" style="height:40vh; min-height:400px;">';
			
			html += `<div class="wf_grid_header">
				<div class="wf_title left"><i class="mdi mdi-clipboard-play-outline">&nbsp;</i>Workflow Map</div>
				<div class="button secondary right" onClick="$P().goEditWorkflow()"><i class="mdi mdi-clipboard-edit-outline">&nbsp;</i>Edit...</div>
				<div class="clear"></div>
			</div>`;
			
			html += `<div class="wf_grid_footer">
				<div class="button icon left" onClick="$P().wfZoomAuto()" title="Auto-fit workflow"><i class="mdi mdi-home"></i></div>
				<div class="button icon left" id="d_btn_wf_zoom_out" onClick="$P().wfZoomOut()" title="Zoom out"><i class="mdi mdi-magnify-minus"></i></div>
				<div class="button icon left" id="d_btn_wf_zoom_in" onClick="$P().wfZoomIn()" title="Zoom in"><i class="mdi mdi-magnify-plus"></i></div>
				<div class="wf_zoom_msg left tablet_hide"></div>
				<div class="clear"></div>
			</div>`;
			
			html += '</div>'; // wf_container
			html += '</div>'; // box_content
			html += '</div>'; // box
			
			html += '<div class="box toggle" id="d_job_wf_jobs">';
				html += '<div class="box_title">';
					html += '<i></i><span>Workflow Jobs</span>';
				html += '</div>';
				html += '<div class="box_content table">';
					// html += '<div class="loading_container"><div class="loading"></div></div>';
				html += '</div>'; // box_content
			html += '</div>'; // box
		} // workflow
		
		// plugin parameters
		html += '<div class="box toggle" id="d_job_params" style="display:none">';
			html += '<div class="box_title">';
				html += '<i></i><span></span>';
			html += '</div>';
			html += '<div class="box_content table">';
				// html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// comments (hidden unless needed)
		html += '<div class="box toggle" id="d_job_comments" style="display:none">';
			html += '<div class="box_title">';
				html += '<i></i><span>Comments</span>';
			html += '</div>';
			html += '<div class="box_content table">';
				// html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// actions (hidden unless needed)
		html += '<div class="box toggle" id="d_job_actions" style="display:none">';
			html += '<div class="box_title">';
				html += '<i></i><span>Job Actions</span>';
			html += '</div>';
			html += '<div class="box_content table">';
				// html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// alerts (hidden unless needed)
		html += '<div class="box toggle" id="d_job_alerts" style="display:none">';
			html += '<div class="box_title">';
				html += '<i></i><span>Server Alerts</span>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// additional jobs (completed job only)
		if (job.final && job.jobs && job.jobs.length) {
			html += '<div class="box toggle" id="d_job_add_jobs>';
				html += '<div class="box_title">';
					html += '<i></i><span>Additional Jobs</span>';
				html += '</div>';
				html += '<div class="box_content table">';
					html += '<div class="loading_container"><div class="loading"></div></div>';
				html += '</div>'; // box_content
			html += '</div>'; // box
		}
		
		// user content (table, html, perf)
		html += '<div class="box toggle" id="d_job_user_table" style="display:none">';
			html += '<div class="box_title"><i></i><span></span></div>';
			html += '<div class="box_content table"></div>';
		html += '</div>'; // box
		html += '<div class="box toggle" id="d_job_user_html" style="display:none">';
			html += '<div class="box_title"><i></i><span></span></div>';
			html += '<div class="box_content table"></div>';
		html += '</div>'; // box
		html += '<div class="box toggle" id="d_job_user_perf" style="display:none">';
			html += '<div class="box_title"><i></i><span>Performance Metrics</span></div>';
			html += '<div class="box_content table"></div>';
		html += '</div>'; // box
		html += '<div class="box toggle" id="d_job_user_counters" style="display:none">';
			html += '<div class="box_title"><i></i><span>Performance Counters</span></div>';
			html += '<div class="box_content table"></div>';
		html += '</div>'; // box
		
		// uploaded files (completed job only)
		if (job.final && ((job.files && job.files.length) || (job.input && job.input.files && job.input.files.length))) {
			html += '<div class="box toggle" id="d_job_files">';
				html += '<div class="box_title">';
					html += '<i></i><span>Job Files</span>';
				html += '</div>';
				html += '<div class="box_content table">';
					html += this.getFileTable();
				html += '</div>'; // box_content
			html += '</div>'; // box
		}
		
		// job data (input and output)
		if (job.final) {
			var has_input_data = !!(job.input && job.input.data && first_key(job.input.data));
			var has_output_data = !!(job.data && first_key(job.data));
			if (has_input_data || has_output_data) {
				html += '<div class="box_grid double">';
					html += '<div class="box_unit"><div class="box_title"><span>Input Data</span>' + (has_input_data ? '<div class="button icon right ghost" title="Copy input data to clipboard" onClick="$P().copyJobData(this)" data-path="input.data"><i class="mdi mdi-clipboard-text-outline"></i></div>' : '') + '</div>' + this.getJobDataDisplay( job.input ? job.input.data : null ) + '</div>';
					html += '<div class="box_unit"><div class="box_title"><span>Output Data</span>' + (has_output_data ? '<div class="button icon right ghost" title="Copy output data to clipboard" onClick="$P().copyJobData(this)" data-path="data"><i class="mdi mdi-clipboard-text-outline"></i></div>' : '') + '</div>' + this.getJobDataDisplay( job.data || null ) + '</div>';
				html += '</div>';
			}
		}
		
		if (!is_workflow) {
			// job log
			html += '<div class="box">';
				html += '<div class="box_title">';
					if (job.final) html += 'Job Output (' + get_text_from_bytes(job.log_file_size || 0) + ')';
					else html += 'Live Job Output';
					html += '<div class="button right" onClick="$P().do_view_job_log()"><i class="mdi mdi-open-in-new">&nbsp;</i>View Raw...</div>';
					html += '<div class="button right" onClick="$P().do_download_job_log()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i>Download...</div>';
					html += '<div class="clear"></div>';
				html += '</div>';
				html += '<div class="box_content table">';
					html += '<div id="d_live_job_log"></div>';
				html += '</div>'; // box_content
			html += '</div>'; // box
			
			// charts
			html += '<div class="box" id="d_job_graphs" >';
				html += '<div class="box_title">';
					html += this.getChartSizeSelector('chart_size_quick');
					html += 'Job Monitors';
				html += '</div>';
				html += '<div class="box_content table">';
					html += '<div class="chart_grid_horiz ' + (app.getPref('chart_size_quick') || 'medium') + '">';
					
						html += '<div><canvas id="c_live_cpu" class="chart"></canvas></div>';
						html += '<div><canvas id="c_live_mem" class="chart"></canvas></div>';
						
						html += '<div><canvas id="c_live_disk" class="chart"></canvas></div>';
						html += '<div><canvas id="c_live_net" class="chart"></canvas></div>';
					
					html += '</div>';
				html += '</div>';
			html += '</div>';
			
			// process table
			html += '<div class="box">';
				html += '<div class="box_title">';
					html += 'Job Processes';
				html += '</div>';
				html += '<div class="box_content table">';
					html += '<div id="d_process_table">' + this.getProcessTable() + '</div>';
				html += '</div>'; // box_content
			html += '</div>'; // box
		} // not workflow
		
		// meta log
		html += '<div class="box" id="d_job_meta">';
			html += '<div class="box_title">';
				html += (is_workflow ? 'Workflow Log' : 'Metadata Log');
			html += '</div>';
			html += '<div class="box_content table">';
				html += this.getMetaLog();
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// job json
		html += '<div class="box" id="d_job_data" style="display:none">';
			html += '<div class="box_title">';
				html += 'Job Data JSON';
				html += '<div class="button right" onMouseUp="$P().do_copy_job_data()"><i class="mdi mdi-clipboard-text-outline">&nbsp;</i>Copy to Clipboard</div>';
				// html += '<div class="button right" onMouseUp="$P().do_view_job_data()"><i class="mdi mdi-open-in-new">&nbsp;</i>View Raw...</div>';
				html += '<div class="button right" onMouseUp="$P().do_download_job_data()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i>Download...</div>';
				html += '<div class="clear"></div>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<pre></pre>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html(html);
		
		SingleSelect.init( this.div.find('select.sel_chart_size') );
		
		if (!job.final) {
			// in progress
			this.updateLiveJobStats();
			this.setupLiveJobLog();
		}
		else {
			// completed
			this.getCompletedJobLog();
			this.getAdditionalJobs();
			// this.showJobData();
			this.renderPluginParams('#d_job_params');
			this.renderJobActions();
			this.renderJobTags();
			this.renderJobComments();
		}
		
		this.setupCharts();
		this.updateUserContent();
		this.getJobAlerts();
		this.setupToggleBoxes();
		
		if (is_workflow) {
			this.setupActiveWorkflow();
			this.renderWorkflowJobs();
		}
	}
	
	copyJobData(elem) {
		// copy job input or output data to clipboard
		var payload = JSON.stringify( get_path( this.job, $(elem).data('path') ), null, "\t" );
		copyToClipboard( payload );
		$(elem).find('i.mdi').removeClass().addClass([ 'mdi', 'mdi-clipboard-check-outline' ]);
		// $(elem).css('color', 'var(--green)');
		app.showMessage('info', "The data was copied to your clipboard.");
	}
	
	getJobDataDisplay(json) {
		// format json with syntax highlighting
		var html = '';
		
		if (json && first_key(json)) {
			html += '<div class="box_code_viewer">';
			html += '<pre><code class="hljs">' + app.highlightAuto( JSON.stringify(json, null, "\t") ) + '</code></pre>';
			html += '</div>';
		}
		else {
			html += `<div class="box_code_none">(No data to show)</div>`;
		}
		
		return html;
	}
	
	goEditWorkflow() {
		// jump over to editing workflow (scroll it too)
		Nav.go(`#Workflows?sub=edit&id=${this.job.event}&scroll=bottom`);
	}
	
	setupActiveWorkflow() {
		// setup workflow and augment with active job tracking scaffolds
		this.setupWorkflow();
		
		if (!this.job.final) {
			// setup active job trackers for each node
			var $cont = this.wfGetContainer();
			$cont.find('.wf_node.wf_event').each( function() {
				$(this).append('<div class="wf_active_bar"><div class="wf_active_widget wf_jobs" style="display:none"></div><div class="wf_active_widget wf_queued" style="display:none"></div><div class="clear"></div></div>');
			} );
		}
	}
	
	renderWorkflowJobs() {
		// render table showing all workflow sub-jobs, and also update workflow preview
		// called on load and when jobs changed
		var self = this;
		var workflow = this.job.workflow;
		var html = '';
		
		// active jobs on top, sorted
		var rows = Object.values(app.activeJobs).filter( function(job) {
			return job.workflow && (job.workflow.job == self.job.id);
		} ).sort( function(a, b) {
			return (a.started < b.started) ? 1 : -1;
		} );
		
		// completed jobs on bottom, sorted
		var completed_stubs = [];
		
		for (var node_id in workflow.jobs) {
			var node = find_object( workflow.nodes, { id: node_id } );
			if (!node) continue; // sanity
			
			var event = node.data.event ? find_object(app.events, { id: node.data.event }) : null;
			
			workflow.jobs[node_id].forEach( function(job) {
				var stub = { ...job, state: 'complete', final: true, workflow: {} };
				if (event) {
					stub.event = node.data.event;
					stub.category = event.category;
					stub.type = event.type;
				}
				else {
					stub.type = 'adhoc';
					stub.plugin = node.data.plugin;
					stub.label = node.data.label;
					stub.icon = node.data.icon;
				}
				completed_stubs.push(stub);
			} );
		} // foreach node
		
		sort_by( completed_stubs, 'completed', { dir: -1, type: 'number' } );
		
		// all together now
		rows = rows.concat( completed_stubs );
		
		var grid_args = {
			rows: rows,
			cols: ['Job ID', 'Event', 'Category', 'Server', 'State', 'Elapsed', 'Progress/Result', 'Actions'],
			data_type: 'job',
			class: 'data_grid wf_active_grid', // TODO: css rules for this?
			empty_msg: 'No workflow jobs found.'
		};
		
		html += this.getBasicGrid( grid_args, function(job, idx) {
			if (!job.completed) return [
				'<b>' + self.getNiceJob(job, true) + '</b>',
				// self.getNiceJobSource(job),
				// self.getShortDateTime( job.started ),
				self.getNiceJobEvent(job, true),
				self.getNiceCategory(job.category, true),
				'<div id="d_wf_jt_server_' + job.id + '">' + self.getNiceServer(job.server, true) + '</div>',
				'<div id="d_wf_jt_state_' + job.id + '">' + self.getNiceJobState(job) + '</div>',
				'<div id="d_wf_jt_elapsed_' + job.id + '">' + self.getNiceJobElapsedTime(job, false) + '</div>',
				'<div id="d_wf_jt_progress_' + job.id + '">' + self.getNiceJobProgressBar(job) + '</div>',
				// '<div id="d_wf_jt_remaining_' + job.id + '">' + self.getNiceJobRemainingTime(job, false) + '</div>',
				
				'<span class="link danger" onClick="$P().doAbortJob(\'' + job.id + '\')"><b>Abort Job</b></a>'
			];
			else return [
				'<b>' + self.getNiceJob(job, true) + '</b>',
				self.getNiceJobEvent(job, true),
				self.getNiceCategory(job.category, true),
				self.getNiceServer(job.server, true),
				self.getNiceJobState(job),
				self.getNiceJobElapsedTime(job, false),
				self.getNiceJobResult(job),
				`<a href="#Job?id=${job.id}"><b>View Details...</b></a>`
			];
		} );
		
		this.div.find('#d_job_wf_jobs > .box_content').html(html);
		
		// set classes on workflow nodes to indicate status
		this.decorateWorkflowNodes();
		
		// we have to fetch queued job information separately
		if (!this.job.final) this.getWorkflowQueueSummary();
	}
	
	decorateWorkflowNodes() {
		// after rendering the table, assign css classes to workflow nodes, etc.
		var self = this;
		var workflow = this.job.workflow;
		var $cont = this.wfGetContainer();
		
		workflow.nodes.forEach( function(node) {
			var state = workflow.state[node.id] || {};
			var $elem = $cont.find(`#d_wfn_${node.id}`);
			
			if (node.type.match(/^(trigger|controller|action)$/)) {
				// these node types have simple state props we can key off of
				$elem.toggleClass('wf_active', !!state.active);
				$elem.toggleClass('wf_completed', !!state.completed);
				$elem.toggleClass('disabled', !state.active && !state.completed);
			}
			else if (node.type.match(/^(event|job)$/)) {
				// event and job types are more complex
				var jobs = Object.values(app.activeJobs).filter( function(job) {
					return job.workflow && job.workflow.job && (job.workflow.job == self.job.id) && (job.workflow.node == node.id) && (job.state == 'active');
				} );
				var num_jobs = jobs.length;
				var num_completed = 0;
				var num_success = 0;
				
				if (num_jobs) {
					// one or more jobs active for node
					$elem.find('> .wf_active_bar > .wf_active_widget.wf_jobs').show().html( `<i class="mdi mdi-run-fast"></i><span>${commify(num_jobs)}</span>` );
					$elem.toggleClass('wf_active', true);
				}
				else {
					// no active jobs, hide bar widget
					$elem.find('> .wf_active_bar > .wf_active_widget.wf_jobs').hide().html('');
					$elem.toggleClass('wf_active', false);
					
					// if 1+ jobs completed, set node class accordingly
					(workflow.jobs[node.id] || []).forEach( function(stub) {
						num_completed++;
						if (!stub.code) num_success++;
					} );
					
					$elem.toggleClass('wf_completed', !!(num_completed && (num_success == num_completed)) );
					$elem.toggleClass('wf_error', !!(num_completed && (num_success < num_completed)) );
				}
				
				$elem.toggleClass('disabled', !num_jobs && !num_completed);
				
				// decorate limits too
				find_objects( workflow.connections, { source: node.id } ).forEach( function(conn) {
					var dest = find_object( workflow.nodes, { id: conn.dest } );
					if (dest.type != 'limit') return;
					$cont.find(`#d_wfn_${dest.id}`).toggleClass('disabled', !num_jobs && !num_completed);
				} );
			} // event or job
		} ); // foreach node
		
		workflow.connections.forEach( function(conn) {
			if (!conn.condition) return;
			var state = workflow.state[conn.id] || {};
			var $elem = $cont.find(`#d_wft_${conn.id}`);
			$elem.toggleClass('disabled', !state.completed);
		} ); // foreach conn
	}
	
	getWorkflowQueueSummary() {
		// fetch summary of queued job counts per node
		var self = this;
		var workflow = this.job.workflow;
		var $cont = this.wfGetContainer();
		
		app.api.get( 'app/get_workflow_job_summary', { 'workflow.job': this.job.id, state: 'queued' }, function(resp) {
			if (!self.active || !resp || !resp.nodes || !self.job || self.job.final) return; // sanity checks
			
			workflow.nodes.filter( function(node) { return !!node.type.match(/^(event|job)$/); } ).forEach( function(node) {
				var $div = $cont.find(`#d_wfn_${node.id} > .wf_active_bar > .wf_active_widget.wf_queued`);
				var count = resp.nodes[node.id] || 0;
				
				if (count) $div.show().html( `<i class="mdi mdi-tray-full"></i><span>${commify(count)}</span>` );
				else $div.hide().html('');
			} );
		}); // api.get
	}
	
	updateWorkflowJobs() {
		// update live jobs in table without redrawing entire table
		// called on status update (every 1s)
		var self = this;
		var div = this.div;
		var workflow = this.job.workflow;
		var $cont = this.wfGetContainer();
		
		var rows = Object.values(app.activeJobs).filter( function(job) {
			return job.workflow && (job.workflow.job == self.job.id);
		} );
		
		rows.forEach( function(job) {
			div.find('#d_wf_jt_state_' + job.id).html( self.getNiceJobState(job) );
			div.find('#d_wf_jt_server_' + job.id).html( self.getNiceServer(job.server, true) );
			div.find('#d_wf_jt_elapsed_' + job.id).html( self.getNiceJobElapsedTime(job, false) );
			// div.find('#d_wf_jt_remaining_' + job.id).html( self.getNiceJobRemainingTime(job, false) );
			
			// update progress bar without redrawing it (so animation doesn't jitter)
			self.updateJobProgressBar(job, '#d_wf_jt_progress_' + job.id + ' > div.progress_bar_container');
		} ); // foreach job
		
		// we need to decorate every tick, because sub-job state changes can alter things!
		this.decorateWorkflowNodes();
	}
	
	renderJobTags() {
		// render job tags in banner at top
		var self = this;
		var nice_tags = (this.job.tags || [])
			.filter( function(tag) { return !tag.match(/^_/); } ) // filter out system tags
			.map( function(tag) { return self.getNiceTag(tag, '#Search?tags=' + tag); } )
			.join(' ');
		
		this.div.find('#d_job_banner_tags').html(nice_tags);
	}
	
	do_update_tags(elem) {
		// update tags for job
		var self = this;
		var job = this.job;
		if (!app.requirePrivilege('tag_jobs')) return;
		
		// separate system tags from user tags
		var system_tags = (job.tags || []).filter( function(tag) { return !!tag.match(/^_/); } );
		var user_tags = (job.tags || []).filter( function(tag) { return !tag.match(/^_/); } );
		
		MultiSelect.popupQuickMenu({
			elem: elem,
			title: 'Update Job Tags',
			items: app.tags,
			values: user_tags,
			
			callback: function(values) {
				app.clearError();
				var new_tags = values.concat(system_tags);
				
				Dialog.showProgress( 1.0, "Saving Tags..." );
				
				app.api.post( 'app/manage_job_tags', { id: job.id, tags: new_tags }, function(resp) {
					Dialog.hideProgress();
				} ); // api.post
			} // callback
		}); // popupQuickMenu
	}
	
	renderJobComments() {
		// show job comments if any, otherwise hide
		var self = this;
		var job = this.job;
		
		var $box = this.div.find('#d_job_comments');
		if (!job.comments || !job.comments.length) {
			$box.hide();
			return;
		}
		
		var cols = [ 'User', 'Comment', 'Date/Time', 'Actions' ];
		var html = '';
		
		html += this.getBasicTable({
			attribs: { class: 'data_table' },
			compact: false,
			cols: cols,
			rows: sort_by( job.comments, 'date', { type: 'number', dir: -1 } ),
			data_type: 'comment',
			
			callback: function(comment, idx) {
				var actions = [];
				if ((comment.username == app.username) || app.isAdmin()) {
					actions.push('<span class="link" onClick="$P().do_edit_comment(' + idx + ')"><b>Edit</b></span>');
					actions.push('<span class="link danger" onClick="$P().do_delete_comment(' + idx + ')"><b>Delete</b></span>');
				}
				return [
					self.getNiceUser(comment.username, app.isAdmin()),
					'<div style="line-height:16px;">' + comment.msg.replace(/\n/g, '<br>') + '</div>',
					'<span style="white-space:nowrap;">' + self.getRelativeDateTime(comment.date) + (comment.edited ? ' (Edited)' : '') + '</span>',
					'<span class="nowrap">' + actions.join(' | ') + '</span>'
				];
			}
		});
		
		$box.show();
		$box.find('div.box_content').html( html );
	}
	
	do_edit_comment(idx) {
		// show dialog to edit or add comment
		var self = this;
		var job = this.job;
		if (!app.requirePrivilege('comment_jobs')) return;
		if (!job.comments) job.comments = [];
		
		var comment = (idx > -1) ? job.comments[idx] : { msg: '' };
		var title = (idx > -1) ? "Editing Comment" : "New Comment";
		var btn = (idx > -1) ? ['floppy', "Save Changes"] : ['comment-plus', "Add Comment"];
		
		var html = '<div class="dialog_box_content maximize" style="max-height:75vh; overflow-x:hidden; overflow-y:auto;">';
		
		html += this.getFormRow({
			label: 'Comment:',
			content: this.getFormTextarea({
				id: 'fe_ej_comment',
				rows: 5,
				autocomplete: 'off',
				maxlength: 8192,
				value: comment.msg
			}),
			caption: 'Enter a comment to attach to the current job.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			comment.msg = $('#fe_ej_comment').val().trim();
			Dialog.hide();
			
			if (!comment.msg.length) return;
			
			Dialog.showProgress( 1.0, "Saving Comments..." );
			
			app.api.post( 'app/manage_job_comments', { id: job.id, comments: [comment] }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', (idx > -1) ? "The comment was updated successfully." : "Your comment was added successfully.");
			} ); // api.post
		}); // Dialog.confirm
		
		$('#fe_ej_comment').focus();
	}
	
	do_delete_comment(idx) {
		// delete single comment
		var self = this;
		var job = this.job;
		if (!app.requirePrivilege('comment_jobs')) return;
		
		var comment = {
			id: job.comments[idx].id,
			delete: true
		};
		
		Dialog.showProgress( 1.0, "Deleting Comment..." );
		
		app.api.post( 'app/manage_job_comments', { id: job.id, comments: [comment] }, function(resp) {
			Dialog.hideProgress();
			app.showMessage('success', "The comment was deleted successfully.");
		} ); // api.post
	}
	
	renderJobActions() {
		// render details on executed job actions
		var self = this;
		var job = this.job;
		var workflow = this.job.workflow;
		if (!this.active) return; // sanity
		
		// we're only interested in actions that actually fired (and aren't hidden)
		var actions = this.actions = (job.actions || []).filter( function(action) { return !!(action.date && !action.hidden); } );
		
		// if workflow, add sub-job actions that fired
		if (this.isWorkflow) {
			find_objects(workflow.nodes, { type: 'action' }).forEach( function(node) {
				var state = workflow.state[node.id] || null;
				if (state && state.date) actions.push( state );
			} );
		}
		
		// decorate actions with idx, for linking
		actions.forEach( function(action, idx) { action.idx = idx; } );
		
		if (!actions.length) {
			$('#d_job_actions').hide();
			return;
		}
		
		var cols = ["Condition", "Type", "Description", "Date/Time", "Elapsed", "Result", "Actions"];
		var html = '';
		
		var grid_args = {
			rows: sort_by(actions, 'condition'), // sort in place, so idx works below
			cols: cols,
			data_type: 'action'
		};
		
		html += this.getBasicGrid( grid_args, function(item, idx) {
			var disp = self.getJobActionDisplayArgs(item, true); // condition, type, text, desc, icon
			
			var link = 'n/a';
			if (item.loc) link = '<a href="' + item.loc + '">View Details...</a>';
			else if (item.description || item.details) link = '<span class="link" onClick="$P().viewJobActionDetails(' + idx + ')">View Details...</span>';
			
			return [
				'<b><i class="mdi mdi-' + disp.condition.icon + '">&nbsp;</i>' + disp.condition.title + '</b>',
				'<i class="mdi mdi-' + disp.icon + '">&nbsp;</i>' + disp.type,
				disp.desc,
				self.getRelativeDateTime(item.date, true),
				'<i class="mdi mdi-clock-check-outline">&nbsp;</i>' + get_text_from_ms_round( Math.floor(item.elapsed_ms), true),
				self.getNiceJobResult(item), // yes, this works for actions too
				'<b>' + link + '</b>'
			];
		}); // grid
		
		$('#d_job_actions > div.box_content').html( html );
		$('#d_job_actions').show();
	}
	
	viewJobActionDetails(idx) {
		// popup dialog to show action results
		var self = this;
		var action = this.actions[idx];
		var disp = self.getJobActionDisplayArgs(action); // condition, type, text, desc, icon
		var details = action.details || "";
		
		if (action.description) {
			details = "**Result:** " + action.description + "\n\n" + details;
		}
		
		var title = "Job Action Details: " + disp.type;
		if (action.code) title = '<span style="color:var(--red);">' + title + '</span>';
		
		this.viewMarkdownAuto( title, details.trim() );
	}
	
	getJobAlerts() {
		// get info on alerts that happened during job's life
		var self = this;
		var job = this.job;
		
		var opts = {
			query: 'jobs:' + job.id,
			offset: 0,
			limit: config.items_per_page, // no pagination, so this is just a sanity limit
			sort_by: '_id',
			sort_dir: -1,
			ttl: 1
		};
		
		app.api.get( 'app/search_alerts', opts, function(resp) {
			self.alerts = resp.rows || [];
			self.renderJobAlerts();
		});
	}
	
	renderJobAlerts() {
		// render details on job alerts
		var self = this;
		if (!this.active) return; // sanity
		
		if (!this.alerts || !this.alerts.length) {
			$('#d_job_alerts').hide();
			return;
		}
		
		var alerts = this.alerts;
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
		
		$('#d_job_alerts > div.box_content').html( html );
		$('#d_job_alerts').show();
	}
	
	getAdditionalJobs() {
		// get info on possible additional jobs launched as a result of the current job completing
		var self = this;
		var job = this.job;
		if (!job.jobs || !job.jobs.length) return;
		var ids = job.jobs.map( function(item) { return item.id; } );
		
		app.api.post( 'app/get_jobs', { ids: ids }, function(resp) {
			if (!self.active) return; // sanity
			
			var jobs = resp.jobs || [];
			var cols = ["Job ID", "Reason", "Event", "Category", "Plugin", "Server", "Actions"];
			var html = '';
			
			var grid_args = {
				rows: jobs,
				cols: cols,
				data_type: 'job',
				class: 'data_grid job_additional'
			};
			
			html += this.getBasicGrid( grid_args, function(item, idx) {
				var reason = job.jobs[idx].reason;
				return [
					self.getNiceJob(item, true),
					ucfirst(reason),
					self.getNiceEvent(item.event, true),
					self.getNiceCategory(item.category, true),
					self.getNicePlugin(item.plugin, true),
					self.getNiceServer(item.server, true),
					'<a href="#Job?id=' + item.id + '">Details</a>'
				];
			}); // grid
			
			$('#d_job_add_jobs > div.box_content').html( html );
		} ); // api.get
	}
	
	updateUserContent() {
		// render user table and/or html sections
		var job = this.job;
		
		// don't bash the dom
		if (job.redraw == this.redraw) return;
		this.redraw = job.redraw;
		
		// simple 2D data table
		if (job.table && job.table.header && job.table.rows) {
			var $box = this.div.find('#d_job_user_table');
			$box.show();
			
			$box.find('div.box_title > span').html( encode_entities(job.table.title || 'Job Data Table') );
			
			var html = '';
			html += this.getBasicTable({
				attribs: { class: 'data_table' },
				compact: true,
				cols: job.table.header.map( encode_entities ),
				rows: job.table.rows.map( function(row) {
					return row.map( encode_entities );
				} ),
				data_type: 'item',
				callback: function(row) { return row; }
			});
			
			if (job.table.caption) html += '<div class="user_caption">' + encode_entities(job.table.caption) + '</div>';
			$box.find('div.box_content').html( html );
		} // table
		
		// custom HTML
		// (this was sanitized on the server)
		if (job.html && job.html.content) {
			var $html = this.div.find('#d_job_user_html');
			$html.show();
			
			$html.find('div.box_title > span').html( encode_entities(job.html.title || 'Job Custom Data') );
			
			var html = '';
			html += job.html.content;
			if (job.html.caption) html += '<div class="user_caption">' + encode_entities(job.html.caption) + '</div>';
			$html.find('div.box_content').html( html );
		} // html
		
		if (job.perf) this.updateUserPerf();
	}
	
	generatePieGradient(metrics) {
		var self = this;
		var total_perf = Object.values(metrics).reduce((acc, cur) => acc + cur, 0);
		var perf_keys = Object.keys(metrics).sort();
		var color_idx = 0;
		var pct = 0;
		var slices = [];
		
		// special case for single slice (entire pie is single color)
		if (perf_keys.length == 1) {
			return this.colors[ color_idx ];
		}
		
		perf_keys.forEach( function(pkey, idx) {
			var value = metrics[pkey];
			pct += ((value / total_perf) * 100);
			var color = self.colors[ color_idx ];
			color_idx = (color_idx + 1) % self.colors.length;
			
			if (idx == 0) {
				slices.push( color + ' ' + Math.round(pct) + '%' );
			}
			else if (idx == perf_keys.length - 1) {
				slices.push( color + ' 0' );
			}
			else {
				slices.push( color + ' 0 ' + Math.round(pct) + '%' );
			}
		});
		
		return 'conic-gradient(' + slices.join(',') + ')';
	}
	
	updateUserPerf() {
		// render user perf metrics into simple bar chart
		var self = this;
		var job = this.job;
		var $perf = this.div.find('#d_job_user_perf');
		var pscale = 1;
		var perf = deep_copy_object(job.perf);
		var counters = {};
		var metrics = {};
		var html = '';
		
		if (typeof(perf) == 'string') perf = parse_query_string( perf.replace(/\;/g, '&') );
		if (perf.scale) { pscale = perf.scale; delete perf.scale; }
		if (perf.counters) counters = perf.counters;
		if (perf.perf) perf = perf.perf;
		
		// keep c_ counters out of metrics, and omit total
		for (var key in perf) {
			if (key.match(/^c_(.+)$/)) {
				counters[ RegExp.$1 ] = perf[key];
			}
			else if (!key.match(/^(t|total)$/)) {
				metrics[key] = perf[key];
			}
		}
		
		var max_height = 150;
		var max_perf = (Math.max.apply( Math, Object.values(metrics) ) || 1) / pscale;
		var total_perf = Object.values(metrics).reduce((acc, cur) => acc + cur, 0) / pscale;
		var perf_keys = Object.keys(metrics).sort();
		var color_idx = 0;
		
		if (perf_keys.length) {
			html += '<div class="job_perf_container" style="grid-template-columns:repeat(' + Math.floor(perf_keys.length + 1) + ',1fr);">';
					
			// pie chart on left
			html += '<div class="job_perf_pie" style="background:' + this.generatePieGradient(metrics) + ';"></div>';
			
			perf_keys.forEach( function(pkey) {
				var value = metrics[pkey] / pscale;
				var height = Math.floor( (value / max_perf) * max_height ) || 1;
				var color = self.colors[ color_idx ];
				color_idx = (color_idx + 1) % self.colors.length;
				
				var nice_value = '';
				if (value < 1.0) nice_value = short_float(value * 1000) + ' ms';
				else if (value < 60) nice_value = short_float(value) + ' sec';
				else nice_value = get_text_from_seconds(value, true, true);
				
				var pct = Math.round( (value / total_perf) * 100 );
				var nice_pct = '';
				if (height > 12) nice_pct = '' + pct + '%';
				
				html += '<div class="job_perf_unit">';
					html += '<div class="job_perf_value">' + nice_value + '</div>';
					html += '<div class="job_perf_bar" style="height:' + height + 'px; line-height:' + height + 'px; background-color:' + color + ';">' + nice_pct + '</div>';
					html += '<div class="job_perf_label">' + pkey + '</div>';
				html += '</div>';
			} );
			
			html += '</div>';
			$perf.show().find('div.box_content').html( html );
		} // perf_keys
		
		if (num_keys(counters)) {
			var $counters = this.div.find('#d_job_user_counters');
			html = '';
			
			max_perf = Math.max.apply( Math, Object.values(counters) ) || 1;
			perf_keys = Object.keys(counters).sort();
			
			// html += '<div style="height:25px"></div>';
			html += '<div class="job_perf_container" style="grid-template-columns:repeat(' + perf_keys.length + ',1fr);">';
			
			perf_keys.forEach( function(pkey) {
				var value = counters[pkey];
				var height = Math.floor( (value / max_perf) * max_height ) || 1;
				var color = self.colors[ color_idx ];
				color_idx = (color_idx + 1) % self.colors.length;
				
				html += '<div class="job_perf_unit">';
					html += '<div class="job_perf_value">' + self.commify(value) + '</div>';
					html += '<div class="job_perf_bar" style="height:' + height + 'px; background-color:' + color + ';"></div>';
					html += '<div class="job_perf_label">' + pkey + '</div>';
				html += '</div>';
			});
			
			html += '</div>';
			$counters.show().find('div.box_content').html( html );
		} // counters
	}
	
	getCompletedJobLog() {
		// fetch completed log file
		var self = this;
		var job = this.job;
		var $cont = this.div.find('#d_live_job_log');
		
		if (!job.final) return; // sanity
		if (this.live) return; // more sanity
		if (this.isWorkflow) return; // workflows have no job log
		
		if (!job.log_file_size) {
			$cont.html('<div class="log_message">(Job log is empty.)</div>');
			return;
		}
		if (job.log_file_size > 1024 * 1024 * 10) {
			$cont.html('<div class="log_message">(Job log is over 10 MB.)</div>');
			return;
		}
		
		$cont.html( '<div class="loading_container"><div class="loading"></div></div>' );
		
		var url = app.base_api_url + "/app/get_job_log?id=" + job.id;
		var opts = { headers: { 'X-Session-ID': app.getPref('session_id') } };
		Debug.trace('api', "Fetching job log: " + url);
		
		window.fetch( url, opts )
			.then( function(res) {
				if (!res.ok) throw new Error("HTTP " + res.status + " " + res.statusText);
				if (res.status == 204) throw "IGNORE";
				return res.text();
			} )
			.then(function(text) {
				// use setTimeout to avoid insanity with the stupid fetch promise
				setTimeout( function() {
					if (!self.active) return; // sanity
					$cont.html('');
					
					if (text.length) {
						// render it progressively as to not hang the browser
						self.logSpool = text.trimEnd().split(/\n/);
						self.spoolNextLogChunk();
					}
					else $cont.html('<div class="log_message">(Job log is empty.)</div>');
					
				}, 1 );
			} )
			.catch( function(err) {
				if (err == "IGNORE") Debug.trace('api', "Got HTTP 204, will wait for log_uploaded event");
				else app.doError( err.message || err );
			} );
	}
	
	spoolNextLogChunk() {
		// spool chunk of completed log into DIV, then RAF for next
		// (this is so we don't hang the main thread trying to render MBs of log data with ansi_to_html in the mix)
		var self = this;
		var $cont = this.div.find('#d_live_job_log');
		if (!$cont.length) return; // user may have navigated away from page
		
		var chunk = this.logSpool.splice(0, 256); // render 256 lines at a time
		$cont.append( chunk.map( function(line) { return '<p>' + (self.converter.ansi_to_html(line) || ' ') + '</p>'; } ).join("\n") );
		
		if (this.logSpool.length) requestAnimationFrame( this.spoolNextLogChunk.bind(this) );
		else delete this.logSpool;
	}
	
	getEmptyLogMessageHTML() {
		// get custom empty log message for job state
		var html = '';
		
		switch (this.job.state) {
			case 'queued':
			case 'start_delay':
			case 'retry_delay':
				html = 'Job is currently in state:&nbsp;&nbsp;' + this.getNiceJobState(this.job);
			break;
			
			default:
				html = 'Waiting for job output...';
			break;
		} // switch state
		
		return html;
	}
	
	setupLiveJobLog() {
		// kickstart the log stream
		var self = this;
		if (this.isWorkflow) return; // workflows do not have a job log
		
		if (this.emptyLogAttempts >= 3) return;
		this.emptyLogAttempts++;
		
		app.api.get( 'app/tail_live_job_log', { id: this.job.id }, function(resp) {
			if (!self.active) return; // sanity
			
			var text = resp.text;
			
			if (text.match(/\S/)) {
				self.appendLiveJobLog(text);
			}
			else if (!self.emptyLogMessage) {
				self.div.find('#d_live_job_log').append( '<div class="inline_page_message">' + self.getEmptyLogMessageHTML() + '</div>' );
				self.emptyLogMessage = true;
			}
			
			// set flag so live log updates can now come through
			self.liveLogReady = true;
		});
	}
	
	appendLiveJobLog(text) {
		// append text to live server log, and possibly pin-scroll to the bottom
		var self = this;
		if (this.isWorkflow) return; // workflows do not have a job log
		
		var $cont = this.div.find('#d_live_job_log');
		var scroll_y = $cont.scrollTop();
		var scroll_max = Math.max(0, $cont.prop('scrollHeight') - $cont.height());
		var need_scroll = ((scroll_max - scroll_y) <= 10);
		
		if (this.emptyLogMessage) {
			$cont.find('div.inline_page_message').remove();
			// $cont.addClass('active');
			this.emptyLogMessage = false;
		}
		
		var html = this.converter.ansi_to_html(text);
		$cont.append( html.replace(/\n$/, '').split(/\n/).map( function(line) { return '<p>' + (line || ' ') + '</p>'; } ).join("\n") );
		
		// only keep latest 1K chunks
		var $children = $cont.children();
		if ($children.length > 1000) {
			$children.slice( 0, $children.length - 1000 ).remove();
		}
		
		// auto-size
		if (!$cont.hasClass('active')) {
			var size = get_inner_window_size();
			if ($cont.prop('scrollHeight') > size.height * 0.8) $cont.addClass('active');
		}
		
		if (need_scroll) $cont.scrollTop( $cont.prop('scrollHeight') );
	}
	
	formatMetaRow(row) {
		// convert meta log row into table columns
		
		// var nice_timestamp = this.formatDate(row.epoch, { 
		// 	year: 'numeric',
		// 	month: 'numeric',
		// 	day: 'numeric',
		// 	// weekday: 'long',
		// 	hour: 'numeric',
		// 	minute: '2-digit',
		// 	second: '2-digit'
		// });
		var nice_timestamp = this.getRelativeDateTime(row.epoch, true);
		
		var nice_server = '-';
		if (row.server) {
			if (row.server.match(/^\w+$/)) nice_server = this.getNiceServer(row.server);
			else nice_server = this.getNiceMaster(row.server);
		}
		else if (row.username) {
			nice_server = this.getNiceUser(row.username);
		}
		
		var nice_msg = row.msg.replace(/\#(\w+)/g, '<code>#$1</code>').replace(/\{(.+?)\}/g, '<code>$1</code>');
		
		if (this.isWorkflow) {
			var nice_node_id = '-';
			var nice_node_type = '-';
			
			if (row.node) {
				nice_node_id = '#' + row.node;
				var node = find_object( this.job.workflow.nodes, { id: row.node } );
				if (node) nice_node_type = this.getNiceWorkflowNodeType(node);
			}
			return [
				nice_timestamp,
				nice_server,
				'<span class="monospace">' + nice_node_id + '</span>',
				nice_node_type,
				nice_msg
			];
		} // workflow
		
		return [
			nice_timestamp,
			nice_server,
			nice_msg
		];
	}
	
	getMetaLog() {
		// get HTML for job meta log (will append in real-time)
		var self = this;
		var job = this.job;
		var activity = job.activity || [];
		var html = '';
		
		var grid_opts = {
			rows: activity,
			cols: this.isWorkflow ? ['Date/Time', 'Server', 'Node ID', 'Type', 'Message'] : ['Date/Time', 'Server', 'Message'],
			data_type: 'row',
			hide_pagination: true
		};
		
		html += this.getBasicGrid( grid_opts, function(row, idx) {
			return self.formatMetaRow(row);
		});
		
		// html += this.getBasicTable({
		// 	attribs: { class: 'data_table' },
		// 	compact: true,
		// 	cols: this.isWorkflow ? ['Timestamp', 'Node ID', 'Type', 'Message'] : ['Timestamp', 'Server', 'Message'],
		// 	rows: activity,
		// 	data_type: 'row',
		// 	callback: function(row) {
		// 		return self.formatMetaRow(row);
		// 	}
		// });
		
		// save row count to compare on live updates
		this.metaRowCount = activity.length;
		
		return html;
	}
	
	updateLiveMetaLog() {
		// compare latest meta to what we have rendered, append as needed
		var self = this;
		var job = this.job;
		var activity = job.activity || [];
		if (activity.length <= this.metaRowCount) return;
		
		var $table = this.div.find('#d_job_meta div.data_grid');
		activity.slice(this.metaRowCount).forEach( function(row) {
			$table.append( '<ul class="grid_row"><div>' + self.formatMetaRow(row).join('</div><div>') + '</div></ul>' );
		} );
		
		this.metaRowCount = activity.length;
	}
	
	appendLiveMetaLog(row) {
		// append single row to meta log, after dupe check
		var job = this.job;
		
		if (!job.activity) job.activity = [];
		var activity = job.activity;
		if (find_object(activity, { id: row.id } )) return; // dupe row
		
		activity.push(row);
		this.metaRowCount = activity.length;
		
		var $table = this.div.find('#d_job_meta div.data_grid');
		$table.append( '<ul class="grid_row"><div>' + this.formatMetaRow(row).join('</div><div>') + '</div></ul>' );
	}
	
	updateLiveJobStats(state_changed) {
		// update progress and other indicators while job is live
		var job = this.job;
		var bwidth = this.header_bar_width;
		var $prog_cont = $('#d_live_progress_bar_cont');
		var $prog_bar = $prog_cont.find('.progress_bar_inner');
		var $prog_pct = $prog_cont.find('.progress_bar_label');
		
		if (!job.progress || (job.progress == 1.0)) {
			// indeterminate
			if (!$prog_cont.hasClass('indeterminate')) {
				$prog_cont.addClass('indeterminate');
				$prog_bar.css('width', '' + bwidth + 'px');
				$prog_pct.html('');
			}
		}
		else if ((job.progress > 0) && (job.progress < 1.0)) {
			if ($prog_cont.hasClass('indeterminate')) $prog_cont.removeClass('indeterminate');
			var cx = Math.floor( job.progress * bwidth );
			$prog_bar.css('width', '' + cx + 'px');
			$prog_pct.html( pct(job.progress, 1.0, true) );
		}
		
		this.div.find('#s_live_elapsed').html( this.getNiceJobElapsedTime(job) );
		this.div.find('#s_live_remain').html( this.getNiceJobRemainingTime(job) );
		
		this.div.find('#d_live_cpu').html( '<i class="mdi mdi-chip">&nbsp;</i>' + this.getNiceJobAvgCPU(job) );
		this.div.find('#d_live_mem').html( '<i class="mdi mdi-memory">&nbsp;</i>' + this.getNiceJobAvgMem(job) );
		
		if (state_changed) {
			// job state has changed, or redraw token changed, so update some more items
			// (trying to avoid redrawing these every second for no reason)
			this.div.find('#d_live_state').html( this.getNiceJobState(job) );
			this.div.find('#d_live_server').html( this.getNiceServer(job.server, true) );
		}
	}
	
	getChartLayers(timeline, pkey, chart) {
		// get chart layers for CPU, Mem, Disk or Net graph
		var self = this;
		var pids = {};
		var color_keys = { cpu:0, memRss:1, disk:2, net:3 };
		if (!timeline || !timeline.length) return [];
		
		if (chart._procLayers) {
			// layers for each proc
			timeline.forEach( function(item) {
				var x = item.epoch;
				
				for (var pid in item.procs) {
					var proc = item.procs[pid];
					
					if (!(pid in pids)) pids[pid] = { title: self.getNiceProcessText(proc) + ' (' + pid + ')', data: [], _first: x };
					pids[pid].data.push({ x, y: proc[pkey] || 0 });
				}
			} );
			
			var sorted = sort_by( Object.values(pids), '_first', { type: 'number', dir: 1 } );
			return sorted;
		}
		else {
			// flat mode, single layer
			var layer = { title: "Total", data: [], color: this.colors[ color_keys[pkey] ], fill: 0.5 };
			
			timeline.forEach( function(item) {
				var x = item.epoch;
				var y = 0;
				
				for (var pid in item.procs) {
					var proc = item.procs[pid];
					y += (proc[pkey] || 0);
				}
				
				layer.data.push({ x, y });
			} );
			
			return [layer];
		}
	}
	
	setupCharts() {
		// pixl-charts go!
		var self = this;
		var job = this.job;
		var timelines = job.timelines;
		var tline = (job.final && (job.elapsed > 300)) ? 'minute' : 'second';
		this.charts = {};
		
		if (this.isWorkflow) return;
		
		// if (!timelines.second || !timelines.second.length) {
		// 	this.div.find('#d_job_graphs').hide();
		// 	return;
		// }
		
		if (!timelines.minute) timelines.minute = [];
		if (!timelines.second) timelines.second = [];
		
		this.charts.cpu = this.createChart({
			"canvas": '#c_live_cpu',
			"title": "CPU Usage %",
			"dataType": "float",
			"dataSuffix": "%",
			"fill": false,
			"legend": !!app.getPref('job_chart_layers_cpu'),
			
			"_timeline": tline,
			"_procKey": "cpu",
			"_procLayers": !!app.getPref('job_chart_layers_cpu')
		});
		this.charts.cpu.addLayers( this.getChartLayers(timelines[tline], 'cpu', this.charts.cpu) );
		
		this.charts.mem = this.createChart({
			"canvas": '#c_live_mem',
			"title": "Memory Usage",
			"dataType": "bytes",
			"dataSuffix": "",
			"fill": false,
			"legend": !!app.getPref('job_chart_layers_mem'),
			
			"_timeline": tline,
			"_procKey": "memRss",
			"_procLayers": !!app.getPref('job_chart_layers_mem')
		});
		this.charts.mem.addLayers( this.getChartLayers(timelines[tline], 'memRss', this.charts.mem) );
		
		this.charts.disk = this.createChart({
			"canvas": '#c_live_disk',
			"title": "I/O Activity",
			"dataType": "bytes",
			"dataSuffix": "/sec",
			"fill": false,
			"delta": true,
			"deltaMinValue": 0,
			"divideByDelta": true,
			"legend": !!app.getPref('job_chart_layers_disk'),
			
			"_timeline": tline,
			"_procKey": "disk",
			"_procLayers": !!app.getPref('job_chart_layers_disk')
		});
		this.charts.disk.addLayers( this.getChartLayers(timelines[tline], 'disk', this.charts.disk) );
		
		this.charts.net = this.createChart({
			"canvas": '#c_live_net',
			"title": "Network Transfer",
			"dataType": "bytes",
			"dataSuffix": "/sec",
			"fill": false,
			"legend": !!app.getPref('job_chart_layers_net'),
			
			"_timeline": tline,
			"_procKey": "net",
			"_procLayers": !!app.getPref('job_chart_layers_net')
		});
		this.charts.net.addLayers( this.getChartLayers(timelines[tline], 'net', this.charts.net) );
		
		var render_chart_overlay = function(key) {
			var toggle_zoom_html = (timelines.minute && timelines.minute.length > 5) ? ('<div class="chart_icon ci_tz" title="Toggle Zoom" onClick="$P().chartToggleZoom(\'' + key + '\')"><i class="mdi mdi-image-search-outline"></i></div>') : '';
			
			$('.pxc_tt_overlay').html(
				'<div class="chart_toolbar ct_' + key + '">' + 
					'<div class="chart_icon ci_tl" title="Toggle Layers" onClick="$P().chartToggleLayers(\'' + key + '\')"><i class="mdi mdi-layers-outline"></i></div>' + 
					toggle_zoom_html + 
					'<div class="chart_icon ci_di" title="Download Image" onClick="$P().chartDownload(\'' + key + '\')"><i class="mdi mdi-cloud-download-outline"></i></div>' + 
					'<div class="chart_icon ci_cl" title="Copy Image Link" onClick="$P().chartCopyLink(\'' + key + '\',this,event)"><i class="mdi mdi-clipboard-pulse-outline"></i></div>' + 
				'</div>' 
			);
		};
		
		this.charts.cpu.on('mouseover', function(event) { render_chart_overlay('cpu'); });
		this.charts.mem.on('mouseover', function(event) { render_chart_overlay('mem'); });
		this.charts.disk.on('mouseover', function(event) { render_chart_overlay('disk'); });
		this.charts.net.on('mouseover', function(event) { render_chart_overlay('net'); });
		
		ChartManager.check();
	}
	
	refreshLiveCharts() {
		// refresh charts for underlying data change
		var self = this;
		var job = this.job;
		var timelines = job.timelines;
		
		if (this.isWorkflow) return;
		
		['cpu', 'mem', 'disk', 'net'].forEach( function(key) {
			var chart = self.charts[key];
			
			chart.layers = [];
			chart.addLayers( self.getChartLayers(timelines[ chart._timeline ], chart._procKey, chart) );
		} );
		
		ChartManager.check();
	}
	
	chartToggleLayers(key) {
		// toggle chart between multi-layer or flat
		var job = this.job;
		var timelines = job.timelines;
		var chart = this.charts[key];
		var pref_key = 'job_chart_layers_' + key;
		
		app.setPref(pref_key, !app.getPref(pref_key));
		if (!app.getPref(pref_key)) app.deletePref(pref_key); // cleanup
		
		chart._procLayers = !!app.getPref(pref_key);
		chart.legend = chart._procLayers;
		
		chart.layers = [];
		chart.addLayers( this.getChartLayers(timelines[ chart._timeline ], chart._procKey, chart) );
		chart.update();
	}
	
	chartToggleZoom(key) {
		// toggle chart between second/minute zoom
		var job = this.job;
		var timelines = job.timelines;
		var chart = this.charts[key];
		
		chart._timeline = (chart._timeline == 'minute') ? 'second' : 'minute';
		chart.layers = [];
		chart.addLayers( this.getChartLayers(timelines[ chart._timeline ], chart._procKey, chart) );
		chart.update();
	}
	
	getProcessTable() {
		// get table for process list
		var self = this;
		var job = this.job;
		var html = '';
		var procs = job.procs;
		var conns = job.conns || [];
		var rows = [];
		
		if (this.isWorkflow) return '';
		
		/* "30835": {
			"pid": 30835,
			"parentPid": 30824,
			"name": "test-plugin.js",
			"cpu": 69,
			"cpuu": 0,
			"cpus": 0,
			"mem": 0.7,
			"priority": 31,
			"memVsz": 409401328,
			"memRss": 239206400,
			"nice": 0,
			"started": 1657514820,
			"state": "running",
			"tty": "ttys001",
			"user": "jhuckaby",
			"command": "test-plugin.js",
			"params": "",
			"path": "node bin"
		} */
		
		var cols = ['Command', 'User', 'PID', 'Parent', 'CPU', 'Memory', 'Age', 'State'];
		
		if (this.snapEpoch) {
			// viewing snapshot
			var len = job.timelines.minute.length;
			var idx = find_object_idx( job.timelines.minute, { epoch: this.snapEpoch } );
			var snap = job.timelines.minute[idx];
			procs = snap.procs;
			conns = snap.conns || [];
			
			var nice_date_time = this.formatDate(this.snapEpoch, { 
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit'
			});
			cols.headerCenter = 'Snapshot (' + nice_date_time + ')';
			
			cols.headerRight = '<div class="proc_pagination">';
			// cols.headerRight += '<i class="mdi mdi-chevron-triple-left" onClick="$P().jumpSnapshotDelta(-60)"></i>';
			cols.headerRight += '<i class="mdi mdi-chevron-double-left" onClick="$P().jumpSnapshotDelta(-10)" title="Jump 10 min back">&nbsp;</i>';
			cols.headerRight += '<i class="mdi mdi-chevron-left" onClick="$P().jumpSnapshotDelta(-1)" title="Jump 1 min back">&nbsp;</i>';
			cols.headerRight += '&nbsp;' + Math.floor(idx + 1) + ' of ' + len + '&nbsp;';
			cols.headerRight += '<i class="mdi mdi-chevron-right" onClick="$P().jumpSnapshotDelta(1)" title="Jump 1 min forward">&nbsp;</i>';
			cols.headerRight += '<i class="mdi mdi-chevron-double-right" onClick="$P().jumpSnapshotDelta(10)" title="Jump 10 min forward">&nbsp;</i>';
			// cols.headerRight += '<i class="mdi mdi-chevron-triple-right" onClick="$P().jumpSnapshotDelta(60)">&nbsp;</i>';
			cols.headerRight += '</div>';
		}
		else if (procs) {
			// real-time view
			cols.headerCenter = 'Real-Time View';
			
			if (job.timelines.minute.length) {
				// completed job: default snap to first minute
				cols.headerRight = '<span class="link" onClick="$P().jumpSnapshotDelta(-1)"><i class="mdi mdi-chevron-double-left">&nbsp;</i>Snapshots</span>';
			}
		}
		else {
			return '<div style="margin:50px; text-align:center; font-style:italic;">No processes found for job.</div>';
		}
		
		// sort pids by parent/child relationship
		var root_proc = procs[job.pid];
		if (!root_proc) return '<div style="margin:50px; text-align:center; font-style:italic;">Root process not found for job.</div>';
		
		rows.push( root_proc );
		var add_children = function(parent, indent) {
			find_objects(procs, { parentPid: parent.pid }).forEach( function(proc) {
				proc.indent = indent;
				rows.push( proc );
				add_children( proc, indent + 1 );
			} );
		};
		add_children( root_proc, 1 );
		
		// get basis for proc age
		var ref_time = this.snapEpoch || time_now();
		
		html += this.getBasicGrid( rows, cols, 'process', function(proc, idx) {
			var classes = [];
			var indent_px = Math.floor( (proc.indent || 0) * 16 );
			
			var cmd = '<span style="padding-left:' + Math.floor(indent_px - 16) + 'px; font-weight:bold;">';
			if (indent_px) cmd += '<i class="mdi mdi-subdirectory-arrow-right" style="color:var(--icon-color);">&nbsp;</i>';
			// cmd += '<i class="mdi mdi-console-network-outline">&nbsp;</i>';
			// if (proc.path) cmd += proc.path + '/';
			// cmd += proc.command;
			// if (proc.params) cmd += ' ' + proc.params;
			cmd += self.getNiceProcess(proc, true);
			cmd += '</span>';
			
			var tds = [
				cmd,
				proc.user,
				proc.pid,
				proc.parentPid,
				pct( proc.cpu, 100 ),
				get_text_from_bytes( proc.memRss ),
				get_text_from_seconds( Math.max(0, ref_time - proc.started), true, true ),
				ucfirst(proc.state || 'unknown')
			];
			
			if (classes.length) tds.className = classes.join(' ');
			return tds;
		} ); // grid (procs)
		
		// include network conns just below procs
		if (conns.length) {
			cols = ['State', 'Protocol', 'Local Address', 'Peer Address', 'Process', 'Age', 'Transferred', 'Avg. Rate'];
			cols.headerCenter = '&nbsp;';
			cols.headerRight = '&nbsp;';
			
			html += '<div style="height:20px;"></div>';
			
			var opts = {
				cols: cols,
				rows: conns,
				data_type: 'connection',
				class: 'data_grid job_conn_grid'
			};
			
			html += this.getBasicGrid( opts, function(item, idx) {
				var nice_state = item.state.toString().split(/_/).map( function(word) { return ucfirst(word); } ).join(' ');
				var age = item.started ? Math.max(0, ref_time - item.started) : 0;
				var proc = item.pid ? procs[item.pid] : null;
				return [
					'<i class="mdi mdi-network-outline">&nbsp;</i><b>' + nice_state + '</b>',
					item.type.toUpperCase(),
					item.local_addr,
					item.remote_addr,
					proc ? self.getNiceProcess(proc, true) : (item.pid || '(None)'),
					get_text_from_seconds( age, true, true ),
					get_text_from_bytes( item.bytes || 0 ),
					get_text_from_bytes( Math.floor( (item.bytes || 0) / (age || 1) ) ) + '/sec'
				];
			}); // grid (conns)
		}
		
		return html;
	}
	
	showProcessInfo(pid) {
		// pop dialog with process details
		var self = this;
		var job = this.job;
		var html = '';
		var procs = job.procs;
		
		if (this.snapEpoch) {
			// viewing snapshot
			var idx = find_object_idx( job.timelines.minute, { epoch: this.snapEpoch } );
			var snap = job.timelines.minute[idx];
			procs = snap.procs;
		}
		
		var proc = procs[pid];
		if (!proc) return app.doError("Process not found: " + pid);
		
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
		
		// pid
		html += '<div>';
			html += '<div class="info_label">Process ID</div>';
			html += '<div class="info_value">' + proc.pid + '</div>';
		html += '</div>';
		
		// parent pid
		html += '<div>';
			html += '<div class="info_label">Parent PID</div>';
			html += '<div class="info_value">' + proc.parentPid + '</div>';
		html += '</div>';
		
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
		
		html += '</div>'; // summary_grid
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
	
	jumpSnapshotDelta(delta) {
		// jump forward or backward in snapshot time
		var job = this.job;
		var idx = -1;
		var len = job.timelines.minute.length;
		
		// special case: jumping from real-time drops us on the last snap
		if (!this.snapEpoch) {
			idx = len;
			delta = -1;
		}
		else {
			idx = find_object_idx( job.timelines.minute, { epoch: this.snapEpoch } );
		}
		
		// special case: if we're sitting on the very last snapshot in the array
		// and jumping forward, and the job is in progress, switch to real-time
		if ((idx == len - 1) && (delta > 0) && (!job.final)) {
			this.snapEpoch = null;
		}
		else {
			idx += delta;
			if (idx < 0) idx = 0;
			else if (idx >= job.timelines.minute.length) idx = job.timelines.minute.length - 1;
			var snap = job.timelines.minute[idx];
			this.snapEpoch = snap.epoch;
		}
		
		this.div.find('#d_process_table').html( this.getProcessTable() );
	}
	
	updateLiveProcessTable() {
		// update process table if we're live, and it is visible
		if (this.isWorkflow) return;
		var $div = this.div.find('#d_process_table');
		if (!this.snapEpoch && $div.visible(true)) {
			$div.html( this.getProcessTable() );
		}
	}
	
	updateSecondTimeline() {
		// add new row to second timeline
		// called from onStatusUpdate (every 1s)
		var job = this.job;
		var timelines = job.timelines;
		
		// second
		var last_second = timelines.second.length ? timelines.second[timelines.second.length - 1].epoch : 0;
		if (!last_second || (last_second != job.updated)) {
			timelines.second.push({ epoch: job.updated, procs: job.procs });
			if (timelines.second.length > 300) timelines.second.shift();
		}
	}
	
	updateMinuteTimeline(updates) {
		// special handler for updating minute timeline data
		// comes in from special page data event, every 1m
		var cur_min_epoch = updates.epoch;
		var procs = updates.procs;
		var conns = updates.conns;
		
		var job = this.job;
		var timelines = job.timelines;
		
		if (!timelines.minute.length || (timelines.minute[ timelines.minute.length - 1 ].epoch != cur_min_epoch)) {
			timelines.minute.push({ 
				epoch: cur_min_epoch, 
				procs: procs || {}, 
				conns: conns || [] 
			});
			if (timelines.minute.length > 1440) timelines.minute.shift();
		}
	}
	
	getFileTable() {
		// get table of job files, with download links
		var self = this;
		var job = this.job;
		var html = '';
		var cols = ['Filename', 'Size', 'Modified', 'Source', 'Job', 'Server', 'Actions'];
		
		var files = [];
		if (job.input && job.input.files) files = files.concat( job.input.files.map( function(file) { return { ...file, source: 'input' }; } ) );
		if (job.files) files = files.concat( job.files.map( function(file) { return { ...file, source: 'output' }; } ) );
		
		html += this.getBasicGrid( files, cols, 'file', function(file, idx) {
			var url = '/' + file.path;
			var classes = [];
			var actions = [
				'<a href="' + url + '" target="_blank"><b>View</b></a>',
				'<a href="' + url + '?download=' + encodeURIComponent(file.filename) + '"><b>Download</b></a>',
				'<span class="link danger" onMouseUp="$P().do_delete_file(' + idx + ')"><b>Delete</b></span>'
			];
			
			var nice_source = (file.source == 'input') ? 
				(file.bucket ? self.getNiceBucket(file.bucket, true) : '<i class="mdi mdi-file-download-outline">&nbsp;</i>Input') : 
				'<i class="mdi mdi-file-upload-outline">&nbsp;</i>Output';
			
			var tds = [
				'<b>' + self.getNiceFile(file.filename, url) + '</b>',
				// '<span class="monospace">' + file.id + '</span>',
				'<i class="mdi mdi-floppy">&nbsp;</i>' + get_text_from_bytes( file.size || 0 ),
				self.getRelativeDateTime(file.date),
				nice_source,
				self.getNiceJob(file.job || job.id, self.isWorkflow),
				self.getNiceServer(file.server || job.server, true),
				actions.join(' | ')
			];
			
			if (classes.length) tds.className = classes.join(' ');
			return tds;
		} ); // getBasicGrid
		
		return html;
	}
	
	do_delete_file(idx) {
		// delete file from job
		var self = this;
		var job = this.job;
		var file = job.files[idx];
		var filename = basename(file.filename || '(Unknown)');
		
		Dialog.confirmDanger( 'Delete File', "Are you sure you want to permanently delete the job file &ldquo;<b>" + filename + "</b>&rdquo;?  There is no way to undo this operation.", ['trash-can', 'Delete'], function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Deleting File..." );
			
			app.api.post( 'app/delete_job_file', { id: file.job || job.id, path: file.path }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "Job file &ldquo;" + filename + "&rdquo; was deleted successfully.");
				
				if (!self.active) return; // sanity
				
				job.files.splice( idx, 1 );
				self.div.find('#d_job_files > .box_content').html( self.getFileTable() );
			} ); // api.post
		} ); // confirm
	}
	
	do_delete_job() {
		// delete job and leave page
		var self = this;
		var job = this.job;
		if (!app.requirePrivilege('delete_jobs')) return;
		
		Dialog.confirmDanger( 'Delete Job', "Are you sure you want to permanently delete the current job, including all logs and files?  There is no way to undo this operation.", ['trash-can', 'Delete'], function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Deleting Job..." );
			
			app.api.post( 'app/delete_job', { id: job.id }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "Job ID &ldquo;" + job.id + "&rdquo; was deleted successfully.");
				
				if (!self.active) return; // sanity
				
				if (job.workflow && job.workflow.job) Nav.go('#Job&id=' + job.workflow.job);
				else Nav.go('#Events?sub=view&id=' + job.event);
			} ); // api.post
		} ); // confirm
	}
	
	do_abort_job() {
		// abort current job (page should automatically update via data stream)
		var self = this;
		var job = this.job;
		if (!app.requirePrivilege('abort_jobs')) return;
		
		Dialog.confirmDanger( 'Abort Job', "Are you sure you want to abort the current job?", ['alert-decagram', 'Abort'], function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Aborting Job..." );
			
			app.api.post( 'app/abort_job', { id: job.id }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "The job was aborted successfully.");
			} ); // api.post
		} ); // confirm
	}
	
	do_confirm_run_again() {
		// confirm user wants to run job
		var self = this;
		if (!app.requirePrivilege('run_jobs')) return;
		
		var text = "Are you sure you want to run the current job again?";
		if (this.job.workflow && this.job.workflow.job) text += "  Please note that this job originally ran as part of a workflow.  If you run it manually like this, it will execute in isolation, outside of the workflow context.";
		
		Dialog.confirm( 'Run Job Again', text, ['run-fast', 'Run Now'], function(result) {
			if (!result) return;
			self.do_run_again();
		} ); // confirm
	}
	
	do_run_again() {
		// run current job again
		var self = this;
		var job = this.job;
		
		var new_job = deep_copy_object(job);
		for (var key in new_job) {
			if (!key.match(/^(type|event|category|plugin|targets|algo|workflow|input|params|parent|actions|limits|icon|label|test)$/)) delete new_job[key];
		}
		
		// run_event API expects event ID in "id" prop
		new_job.id = job.event;
		
		// TODO: copy tags from event?  maybe?  NO, we're doing away with tags in events!  Set to empty array on each job launch
		
		// cleanse tainted actions which ran
		(new_job.actions || []).forEach( function(action) {
			delete action.code;
			delete action.description;
			delete action.details;
			delete action.loc;
		} );
		
		// remove workflow running context (state, etc.)
		if (new_job.workflow) {
			for (var key in new_job.workflow) {
				if (!key.match(/^(nodes|connections|start)$/)) delete new_job.workflow[key];
			}
			if (!num_keys(new_job.workflow)) delete new_job.workflow;
		}
		
		Dialog.showProgress( 1.0, "Launching Job..." );
		
		app.api.post( 'app/run_event', new_job, function(resp) {
			Dialog.hideProgress();
			// app.showMessage('success', "The job was started successfully.");
			
			if (!self.active) return; // sanity
			
			// jump immediately to live details page
			Nav.go('Job?id=' + resp.id);
		} );
	}
	
	do_notify_me() {
		// toggle email notification for current user
		var self = this;
		var job = this.job;
		
		app.clearError();
		app.api.post( 'app/job_toggle_notify_me', { id: job.id }, function(resp) {
			app.showMessage('success', resp.enabled ? 'You will be notified via email when the job completes.' : 'You will no longer be notified regarding this job.');
			
			var notify_icon = resp.enabled ? 'checkbox-marked-circle-outline' : 'email-outline';
			self.div.find('#btn_job_notify > i').removeClass().addClass('mdi mdi-' + notify_icon);
		} ); // api.post
	}
	
	do_download_job_log() {
		// download raw complete job log (no ANSI decoding)
		var job = this.job;
		window.location = app.base_api_url + '/app/download_job_log?id=' + job.id + '&t=' + this.token;
	}
	
	do_view_job_log() {
		// view raw complete job log (no ANSI decoding)
		var job = this.job;
		window.open( app.base_api_url + '/app/view_job_log?id=' + job.id + '&t=' + this.token );
	}
	
	kill_chart_hover() {
		// remove hover on all charts, for page update (e.g. alerts)
		if (this.charts) {
			for (var key in this.charts) {
				this.charts[key].cancelHover();
			}
		}
		$('.pxc_tt_overlay').remove();
	}
	
	do_view_job_data() {
		// show job json in dialog
		this.viewCodeAuto("Job Data JSON", this.getJobJSON());
	}
	
	do_copy_job_data() {
		// copy job json to clipboard
		var code = this.getJobJSON();
		copyToClipboard(code);
		app.showMessage('info', "Job data JSON copied to your clipboard.");
	}
	
	do_download_job_data() {
		// download job json data
		var code = this.getJobJSON();
		var blob = new Blob([code], { type: "application/json" });
		
		var link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = "orchestra-job-" + this.job.id + '.json';
		
		document.body.appendChild(link);
		link.click();
		
		document.body.removeChild(link);
		URL.revokeObjectURL(link.href);
	}
	
	getJobJSON() {
		// get pretty-printed and pruned job json
		var job = deep_copy_object(this.job);
		
		delete job.activity;
		delete job.timelines;
		delete job.table;
		delete job.html;
		
		(job.actions || []).forEach( function(action) {
			delete action.details;
		} );
		
		return JSON.stringify(job, null, "\t");
	}
	
	showJobData() {
		// show job json and syntax-highlight it
		var info = CodeMirror.findModeByExtension( 'json' );
		if (!info) return; // unsupported language
		
		var $cont = this.div.find('#d_job_data');
		$cont.show();
		
		var code = this.getJobJSON();
		var $pre = $cont.find('pre');
		$pre.empty().addClass( (app.getPref('theme') == 'light') ? "cm-s-default" : "cm-s-shadowfox" );
		
		CodeMirror.runMode(code, info.mime, $pre.get(0));
	}
	
	onThemeChange(theme) {
		// theme change, so we have to update codemirror
		var old_class = (theme == 'light') ? "cm-s-shadowfox" : "cm-s-default";
		var new_class = (theme == 'light') ? "cm-s-default" : "cm-s-shadowfox";
		this.div.find('#d_job_data pre.' + old_class).removeClass(old_class).addClass(new_class);
	}
	
	onStatusUpdate(data) {
		// hook main app status update (every 1s)
		// use this as a condition to update live job in progress
		// and to detect job completion
		if (!this.job || (this.job.state == 'complete')) return;
		
		var old_state = this.job.state;
		var old_redraw = this.job.redraw || '';
		
		var updates = app.activeJobs[ this.job.id ];
		if (updates) {
			for (var key in updates) this.job[key] = updates[key];
			var state_changed = !!(this.job.state != old_state);
			var redraw_changed = !!(this.job.redraw != old_redraw);
			this.updateLiveJobStats( state_changed || redraw_changed );
			this.updateSecondTimeline();
			this.refreshLiveCharts();
			this.updateLiveProcessTable();
			this.updateUserContent();
			this.updateLiveMetaLog();
			
			// fast-update jobs table for workflows
			if (this.isWorkflow) {
				this.workflow = this.job.workflow; // this is refreshed every time!
				this.updateWorkflowJobs();
			}
			
			// race condition with setting up live log and jobs that immediately print something at startup
			if (this.job.log_file_size && this.emptyLogMessage) this.setupLiveJobLog();
			
			// massage UX with jobs coming out of queue, delay, etc.
			if (!this.isWorkflow && this.emptyLogMessage && !this.job.log_file_size) {
				this.div.find('#d_live_job_log > div.inline_page_message').html( this.getEmptyLogMessageHTML() );
			}
		}
		
		// special behavior for queued jobs, they are NOT in app.activeJobs client-side, so just wait for it to appear
		if (this.job.state == 'queued') {
			this.updateLiveJobStats(); // basically for elapsed time
			return;
		}
		
		// for workflows, if jobs changed, redraw our special table
		if (this.isWorkflow && data.jobsChanged) this.renderWorkflowJobs();
		
		// if (!updates || ((old_state != 'complete') && (this.job.state == 'complete'))) {
		// 	// job has completed under our noses!  reload page!
		// 	Debug.trace('job', "Job has completed, refreshing page");
		// 	Nav.refresh();
		// }
	}
	
	onPageUpdate(pcmd, pdata) {
		// receive data packet for this page specifically (i.e. live log append)
		if (!this.job) return;
		
		switch (pcmd) {
			case 'log_append':
				var text = pdata.text;
				if (this.live && this.liveLogReady) this.appendLiveJobLog(text);
			break;
			
			case 'job_completed':
				Debug.trace('job', "Job has completed, refreshing page");
				Nav.refresh();
			break;
			
			case 'log_uploaded':
				this.getCompletedJobLog();
			break;
			
			case 'minute_append':
				this.updateMinuteTimeline(pdata);
			break;
			
			case 'job_updated':
				merge_hash_into(this.job, pdata);
				this.renderJobTags();
				this.renderJobComments();
				this.updateLiveMetaLog();
			break;
			
			case 'meta_row':
				this.appendLiveMetaLog(pdata);
			break;
		} // switch
	}
	
	onDataUpdate(key, data) {
		// refresh things as needed
		switch (key) {
			case 'activeAlerts': this.getJobAlerts(); this.kill_chart_hover(); break;
		}
	}
	
	onResize() {
		// called when page is resized
		if (this.isWorkflow && this.wfZoom) this.renderWFConnections();
	}
	
	onDeactivate() {
		// called when page is deactivated
		delete this.job;
		delete this.event;
		delete this.logSpool;
		delete this.converter;
		delete this.liveLogReady;
		delete this.snapEpoch;
		delete this.emptyLogMessage;
		delete this.emptyLogAttempts;
		delete this.redraw;
		delete this.metaRowCount;
		delete this.live;
		delete this.actions;
		
		delete this.workflow;
		delete this.wfScroll;
		delete this.wfZoom;
		delete this.wfSelection;
		delete this.isWorkflow;
		
		// destroy charts if applicable
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
