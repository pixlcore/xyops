// Magic Link Form Page

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Magic = class Magic extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		var self = this;
		this.div.addClass('fixed_page');
	}
	
	onActivate(args) {
		// page activation
		// title, icon, fields, limits, body
		var self = this;
		$('body').addClass('magic');
		Toaster.update('bottom_left');
		
		if (!args) args = {};
		this.args = args;
		
		app.setWindowTitle( this.title );
		app.setHeaderTitle( '' );
		app.showSidebar(false);
		app.setupDragDrop();
		
		setTimeout( function() {
			// break out of promise
			self.renderForm();
		}, 1 );
		
		return true;
	}
	
	getFileLimits() {
		// get computed file size/count limits
		var limit = find_object( this.limits || [], { type: 'file', enabled: true } );
		if (!limit) limit = { amount: 0, size: 0, accept: "" };
		
		var settings = config.job_upload_settings;
		
		var max_files = 0;
		if (limit.amount) max_files = Math.min(limit.amount, settings.max_files_per_job);
		else max_files = settings.max_files_per_job;
		
		var max_size = 0;
		if (limit.size) max_size = Math.min(limit.size, settings.max_file_size);
		else max_size = settings.max_file_size;
		
		var file_types = limit.accept || settings.accepted_file_types;
		
		return { max_files, max_size, file_types };
	}
	
	renderForm() {
		// show magic form
		var self = this;
		var html = '';
		this.files = [];
		
		var ok_show_params = !!(this.fields && this.fields.length);
		
		if (!this.body.trim().length) {
			this.body = `You are about to manually launch a job for the event &ldquo;<b>${this.title}</b>&rdquo;.`;
			if (ok_show_params) this.body += `Please enter values for all the event-defined parameters below.`
		}
		
		// extract html comment variables from markdown body (e.g. button)
		this.bodyArgs = {};
		this.body = this.body.replace( /<\!--\s*(\w+)\:\s*(.*?)\s*-->\s*/g, function(m_all, m_g1, m_g2) {
			var value = m_g2.trim();
			
			// massage value into various types
			if (value === 'true') value = true;
			else if (value === 'false') value = false;
			else if (value.match(/^\-?\d+$/)) value = parseInt(value);
			else if (value.match(/^\-?\d+\.\d+$/)) value = parseFloat(value);
			
			self.bodyArgs[ m_g1.toLowerCase() ] = value;
			return '';
		} ).trim();
		
		var btn_icon = this.bodyArgs.icon || 'run-fast';
		var btn_label = this.bodyArgs.button || 'Start Job';
		
		html += '<div class="dialog inline wider">';
			if (!this.body.match(/^\s*\#/)) html += '<div class="dialog_title">' + strip_html(this.title) + '</div>';
			html += '<div class="dialog_content">';
			// html += '<div class="box_content">';
			
			html += '<div class="markdown-body" style="margin-top:20px; margin-bottom:20px;">';
				html += marked.parse(this.body, config.ui.marked_config);
			html += '</div>'; // markdown-body
			
			html += '<div class="dialog_box_content maximize" id="d_form" style="width:auto; margin:0;">';
			
			// event may disallow files
			var ok_show_files = true;
			var limit = find_object( this.limits || [], { type: 'file', enabled: true } );
			if (limit && (limit.amount == 0)) ok_show_files = false;
			
			if (ok_show_files) {
				// user files
				var upload_btn = '<div class="button small secondary" onClick="$P().selectFiles()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i>Select Files...</div>';
				var { max_files, max_size, file_types } = this.getFileLimits();
				var multiple = (max_files > 1) ? 'multiple="multiple"' : '';
				
				var cap_suffix = '';
				if (limit) {
					var limit_args = this.getResLimitDisplayArgs(limit);
					if (limit_args.nice_desc) cap_suffix += "  " + limit_args.nice_desc + " allowed.";
				}
				
				var file_elem = `<input type="file" id="fe_m_files" accept="${file_types}" ${multiple} style="display:none" onChange="$P().userSelectedFiles(this)">`;
				
				html += this.getFormRow({
					label: 'Input Files:',
					content: file_elem + `<div id="d_upload_btn">${upload_btn}</div>`,
					caption: 'Optionally upload and attach files to the job.' + cap_suffix
				});
			} // files
			
			if (ok_show_params) {
				// user form fields
				html += this.getFormRow({
					label: 'Parameters:',
					content: '<div class="plugin_param_editor_cont">' + this.getParamEditor(this.fields, {}) + '</div>',
					// caption: 'Enter values for all the event-defined parameters here.'
				});
			}
			
			html += '</div>'; // dialog_box_content
			
		// html += '</div>'; // box_content
		html += '</div>'; // dialog_content
		
		html += '<div class="dialog_buttons">';
			html += '<div class="button danger mobile_hide" onClick="$P().resetForm()"><i class="mdi mdi-undo-variant">&nbsp;</i><span>Reset</span></div>';
			html += `<div class="button primary" id="btn_start" onClick="$P().doRunEvent()"><i class="mdi mdi-${btn_icon}">&nbsp;</i><span>${btn_label}</span></div>`;
		html += '</div>';
		
		html += '</div>'; // dialog
		
		this.div.html( html ).buttonize();
		
		this.expandInlineImages();
		this.highlightCodeBlocks();
	}
	
	selectFiles() {
		// user clicked upload button
		this.div.find('#fe_m_files').click();
	}
	
	userSelectedFiles(elem) {
		// user selected files
		if (elem.files && elem.files.length) {
			this.files = this.files.concat( Array.from(elem.files) );
			this.updateFileButton();
		}
	}
	
	onDragDrop(files) {
		// user dropped files on page
		this.files = this.files.concat( Array.from(files) );
		this.updateFileButton();
	}
	
	updateFileButton() {
		// update file button after user selected or dropped files
		var num_files = this.files.length;
		var total_size = 0;
		
		this.files.forEach( function(file) { total_size += file.size; } );
		
		// pre-check limits here
		var { max_files, max_size, file_types } = this.getFileLimits();
		
		if (this.files.length > max_files) {
			if (max_files == 1) app.doError("Only 1 file is allowed.");
			else app.doError("Only " + max_files + " files are allowed.");
			
			while (this.files.length > max_files) {
				var file = this.files.pop();
				total_size -= file.size;
			}
		}
		
		if (total_size > max_size) {
			app.doError("Your files exceed the maximum allowed size of " + get_text_from_bytes(max_size) + ".");
			
			while (total_size > max_size) {
				var file = this.files.pop();
				total_size -= file.size;
			}
		}
		
		if (!this.files.length) {
			this.div.find('#d_upload_btn').html( '<div class="button small" onClick="$P().selectFiles()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i>Select Files...</div>' );
			this.div.find('#btn_start > span').html('Start Job');
			return;
		}
		
		this.div.find('#d_upload_btn').html(
			'<div class="button small loaded absorb" onClick="$P().selectFiles()">' + 
				'<i class="mdi mdi-check-circle-outline">&nbsp;</i>' + commify(num_files) + ' ' + pluralize('file', num_files) + ' selected (' + get_text_from_bytes(total_size) + ')' + 
			'</div>'
		);
		
		this.div.find('#btn_start > span').html('Upload &amp; Start');
	}
	
	resetForm() {
		// start over
		delete this.job;
		delete this.values;
		delete this.files;
		
		this.renderForm();
	}
	
	doRunEvent() {
		// prep for run, validate data, start upload, etc.
		var self = this;
		app.clearError();
		
		this.values = this.getParamValues(this.fields || []);
		if (!this.values) return; // validation error
		
		this.div.find('.button').addClass('disabled');
		
		if (this.files.length) this.uploadFiles();
		else this.startJob();
	}
	
	startJob() {
		// start job without file upload
		var self = this;
		
		app.api.post( 'app/magic/' + this.token, this.values, function(resp) {
			if (self.bodyArgs.response) {
				// skip stream, show static response
				self.job = { code: 0, description: self.bodyArgs.response };
				self.finishJob();
			}
			else self.streamJob(resp.id, resp.stream);
		} );
	}
	
	uploadFiles() {
		// upload files (which also starts job)
		var self = this;
		var { max_files, max_size, file_types } = this.getFileLimits();
		
		ZeroUpload.setURL( app.base_api_url + '/app/magic/' + this.token );
		ZeroUpload.setMaxFiles( max_files );
		ZeroUpload.setMaxBytes( max_size );
		ZeroUpload.setFileTypes( file_types );
		
		ZeroUpload.on('start', function() {
			$('#d_upload_btn').html( self.getNiceProgressBar(0, 'wider', true) );
		} );
		
		ZeroUpload.on('progress', function(progress) {
			self.updateProgressBar( progress.amount, $('#d_upload_btn .progress_bar_container') );
		} );
		
		var handleUploadError = function(err) {
			self.updateFileButton();
			self.div.find('.button').removeClass('disabled');
			app.doError("Upload Failed: JSON Parse Error: " + err);
		};
		
		ZeroUpload.on('complete', function(response, userData) {
			var data = null;
			try { data = JSON.parse( response.data ); }
			catch (err) {
				return handleUploadError(err);
			}
			if (data && (data.code != 0)) {
				return handleUploadError("Upload Failed: " + data.description);
			}
			
			// grab stream token and start streaming updates
			self.streamJob(data.id, data.stream);
		} );
		
		ZeroUpload.on('error', function(type, message, userData) {
			return handleUploadError("Upload Failed: " + message);
		} );
		
		ZeroUpload.init();
		ZeroUpload.upload( this.files, {}, this.values );
	}
	
	streamJob(job_id, job_token) {
		// here we go!
		var self = this;
		var bwidth = 200;
		var html = '';
		var last_state = '';
		
		// progress bar
		html += '<div style="padding:15px;">';
		html += '<div id="d_progress_title" class="dialog_title" style="text-align:center; margin-bottom:15px;">Starting Job...</div>';
		
		html += '<div class="progress_bar_container indeterminate" id="d_live_progress_bar_cont" style="width:' + bwidth + 'px; margin:0 auto 0 auto;" role="progressbar">' + 
					'<div class="progress_bar_label first_half" style="width:' + bwidth + 'px;"></div>' + 
					'<div class="progress_bar_inner" style="width:' + bwidth + 'px;">' + 
						'<div class="progress_bar_label second_half" style="width:' + bwidth + 'px;"></div>' + 
					'</div>' + 
				'</div>';
		
		html += '</div>'; // progress bar wrapper
		
		// summary grid
		html += '<div class="summary_grid triple" style="margin-top:30px;">';
		
		// id
		html += '<div>';
			html += '<div class="info_label">Job ID</div>';
			html += '<div class="info_value monospace">' + this.getNiceCopyableID(job_id) + '</div>';
		html += '</div>';
		
		// state
		html += '<div>';
			html += '<div class="info_label">Job State</div>';
			html += '<div class="info_value" id="d_live_state">...</div>';
		html += '</div>';
		
		// elapsed?
		html += '<div>';
			html += '<div class="info_label">Elapsed Time</div>';
			html += '<div class="info_value" id="d_live_elapsed">...</div>';
		html += '</div>';
		
		// remain?
		html += '<div>';
			html += '<div class="info_label">Remaining Time</div>';
			html += '<div class="info_value" id="d_live_remain">...</div>';
		html += '</div>';
		
		// cpu
		html += '<div>';
			html += '<div class="info_label">Avg CPU</div>';
			html += '<div class="info_value" id="d_live_cpu">...</div>';
		html += '</div>';
		
		// mem
		html += '<div>';
			html += '<div class="info_label">Avg Mem</div>';
			html += '<div class="info_value" id="d_live_mem">...</div>';
		html += '</div>';
		
		html += '</div>'; // summary_grid
		
		this.div.find('#d_form').html(html);
		this.div.find('.markdown-body').hide();
		this.div.find('.dialog_buttons').hide();
		
		// start SSE stream
		var es = new EventSource( app.base_api_url + `/app/stream_job?id=${job_id}&token=${job_token}` );
		var job = this.job = { id: job_id };
		
		es.addEventListener('start', function(event) {
			// go go go
		});
		
		es.addEventListener('update', function(event) {
			// received job update
			app.epoch = hires_time_now();
			
			var data = null;
			try { data = JSON.parse(event.data); }
			catch (err) { console.error(err); return; }
			merge_hash_into(job, data);
			
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
				if ($prog_cont.hasClass('indeterminate')) {
					$prog_bar.css('width', '0px').get(0).offsetWidth; // skip animation
					$prog_cont.removeClass('indeterminate');
				}
				var cx = Math.floor( job.progress * bwidth );
				$prog_bar.css('width', '' + cx + 'px');
				$prog_pct.html( pct(job.progress, 1.0, true) );
			}
			
			self.div.find('#d_live_elapsed').html( self.getNiceJobElapsedTime(job) );
			self.div.find('#d_live_remain').html( self.getNiceJobRemainingTime(job) );
			
			self.div.find('#d_live_cpu').html( '<i class="mdi mdi-chip">&nbsp;</i>' + self.getNiceJobAvgCPU(job) );
			self.div.find('#d_live_mem').html( '<i class="mdi mdi-memory">&nbsp;</i>' + self.getNiceJobAvgMem(job) );
			
			if (job.state != last_state) {
				last_state = job.state;
				self.div.find('#d_live_state').html( self.getNiceJobState(job) );
				self.div.find('#d_progress_title').html( (job.state == 'queued') ? 'Job queued...' : 'Job in progress...' );
			}
		});
		
		es.addEventListener('end', function(event) {
			// job is complete!  render final presentation
			es.close();
			self.finishJob();
		});
	}
	
	finishJob() {
		// job is complete
		var self = this;
		var job = this.job;
		var html = '';
		
		// banner
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
			case 'critical': banner_icon = 'fire-alert'; prefix = 'Critical: '; break;
			case 'abort': banner_icon = 'cancel'; prefix = 'Job Aborted: '; break;
		}
		
		// render inline banner
		html += '<div class="box message inline ' + banner_class + '" style="margin:0 0 30px 0">';
			html += '<div class="message_inner">';
				// html += '<div id="d_job_banner_tags" class="monospace right">' + this.getNiceCopyableID(job.id) + '</div>';
				html += '<i class="mdi mdi-' + banner_icon + '">&nbsp;&nbsp;&nbsp;</i>';
				html += prefix + encode_entities( job.description );
			html += '</div>';
		html += '</div>';
		
		// simple 2D data table
		if (job.table && job.table.header && job.table.rows && Array.isArray(job.table.rows)) {
			html += '<div class="magic_section">';
			if (job.table.title) {
				html += '<div class="dialog_title">' + encode_entities(job.table.title) + '</div>';
			}
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
			html += '</div>';
		} // table
		
		// custom HTML (this was sanitized on the server)
		if (job.html && job.html.content) {
			html += '<div class="magic_section user_content">';
			if (job.html.title) {
				html += '<div class="dialog_title">' + encode_entities(job.html.title) + '</div>';
			}
			html += job.html.content;
			if (job.html.caption) html += '<div class="user_caption">' + encode_entities(job.html.caption) + '</div>';
			html += '</div>';
		} // html
		
		// file table
		if (job.files && job.files.length) {
			html += '<div class="magic_section">';
			html += '<div class="dialog_title">Job Output Files</div>';
			
			var targs = {
				rows: job.files,
				cols: ['Filename', 'Size', 'Actions'],
				data_type: 'file',
				class: 'data_grid c_file_grid',
				grid_template_columns: 'auto auto auto'
			};
			
			html += this.getCompactGrid( targs, function(file, idx) {
				var url = '/' + file.path;
				return [
					'<b>' + self.getNiceFile(file.filename, url) + '</b>',
					'<i class="mdi mdi-floppy">&nbsp;</i>' + get_text_from_bytes( file.size || 0 ),
					'<a href="' + url + '?download=' + encodeURIComponent(file.filename) + '"><b>Download</b></a>'
				];
			} ); // getCompactGrid
			html += '</div>';
		} // files
		
		// data
		if (job.data && first_key(job.data)) {
			html += '<div class="magic_section">';
			html += '<div class="dialog_title" style="margin-bottom:5px">Job Output Data</div>';
			html += '<div class="button small secondary" onClick="$P().viewJobOutputData()"><i class="mdi mdi-code-json">&nbsp;</i>View JSON Data...</div>';
			html += '</div>';
		}
		
		this.div.find('#d_form').html(html);
		
		this.div.find('.dialog_buttons').show().html(
			'<div class="button" onClick="$P().resetForm()"><i class="mdi mdi-undo-variant">&nbsp;</i><span>Start Over</span></div>'
		);
		
		// create fake user so confetti works
		app.user = { effects: true };
		this.confettiParty();
	}
	
	viewJobOutputData() {
		// show job output data in dialog
		this.viewCodeAuto("Job Data JSON", JSON.stringify(this.job.data, null, "\t"));
	}
	
	onDeactivate() {
		// do not allow page to deactivate (standalone)
		return false;
	}
	
};
