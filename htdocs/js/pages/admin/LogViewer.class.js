// Log Viewer Page

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.LogViewer = class LogViewer extends Page.PageUtils {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		var self = this;
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		
		app.setWindowTitle('Log Viewer');
		app.setHeaderTitle( '<i class="mdi mdi-script-text-outline">&nbsp;</i>Log Viewer' );
		
		var html = '';
		html += '<div class="box" style="border:none;">';
		html += '<div class="box_content" style="padding:20px;">';
			
			// search box
			html += '<div class="search_box" role="search">';
				html += '<i class="mdi mdi-magnify" onClick="$(\'#fe_s_match\').focus()">&nbsp;</i>';
				html += '<input type="text" id="fe_s_match" maxlength="128" placeholder="Search Logs..." value="' + escape_text_field_value(args.match || '') + '">';
				html += '<div id="d_search_opt_case" class="search_widget ' + (args.case ? 'selected' : '') + '" title="Case Sensitive" onClick="$P().toggleSearchOption(this)"><i class="mdi mdi-format-letter-case"></i></div>';
				html += '<div id="d_search_opt_regex" class="search_widget ' + (args.regex ? 'selected' : '') + '" title="Regular Expression" onClick="$P().toggleSearchOption(this)"><i class="mdi mdi-regex"></i></div>';
			html += '</div>';
			
			// options
			html += '<div id="d_s_adv" class="form_grid" style="margin-bottom:25px">';
				
				// log file
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-script-text-outline">&nbsp;</i>Log File:',
						content: this.getFormMenuSingle({
							id: 'fe_s_log',
							title: 'Select Log File',
							options: config.ui.log_files.map( function(log) { return { id: log, title: log }; } ),
							value: args.log || 'xyOps',
							default_icon: 'script-outline',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// columns multi-select
				// ["hires_epoch", "date", "hostname", "pid", "component", "category", "code", "msg", "data"]
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-database-search-outline">&nbsp;</i>Columns:',
						content: this.getFormMenuMulti({
							id: 'fe_s_cols',
							title: 'Select Columns',
							placeholder: 'None',
							options: config.log_columns.map( function(col) {
								return { id: col, title: config.ui.log_column_titles[col] || col };
							} ),
							values: args.cols ? args.cols.split(/\,\s*/) : ['hires_epoch', 'category', 'code', 'msg', 'data'],
							default_icon: 'database-marker-outline',
							'data-shrinkwrap': 1,
							'data-select-all': 1
						})
					});
				html += '</div>';
				
				// max rows
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-counter">&nbsp;</i>Max Rows:',
						content: this.getFormMenuSingle({
							id: 'fe_s_rows',
							title: 'Select Max Rows',
							options: ['10', '50', '100', '250', '500', '750', '1000'],
							value: args.rows || '100',
							default_icon: '',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// date
				var date_items = [ { id: '', title: 'Today', icon: 'calendar-cursor' } ];
				var epoch = normalize_time( time_now(), { hour:12, min:0, sec:0 } );
				for (var idx = 0; idx < 7; idx++) {
					epoch -= 86400;
					date_items.push({ id: yyyy_mm_dd(epoch, '-'), title: this.getNiceDateText(epoch) });
				}
				
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-calendar-search">&nbsp;</i>Date:',
						content: this.getFormMenuSingle({
							id: 'fe_s_date',
							title: 'Select Date',
							options: date_items.concat([ { id: 'custom', title: 'Custom...', icon: 'cog-outline' } ]),
							value: args.date,
							default_icon: 'calendar',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// sort
				html += '<div class="form_cell">';
					var sort_items = [
						{ id: 'date_desc', title: 'Newest on Top', icon: 'sort-descending' },
						{ id: 'date_asc', title: 'Oldest on Top', icon: 'sort-ascending' }
					];
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-sort">&nbsp;</i>Sort Rows:',
						content: this.getFormMenuSingle({
							id: 'fe_s_sort',
							title: 'Sort Rows',
							options: sort_items,
							value: args.sort || 'date_asc',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
			html += '</div>'; // form_grid
		
		// buttons at bottom
		html += '<div class="box_buttons" style="padding:0">';
			html += '<div id="btn_search_opts" class="button phone_collapse" onClick="$P().toggleSearchOpts()"><i>&nbsp;</i><span>Options<span></div>';
			html += '<div id="btn_s_reset" class="button phone_collapse" onClick="$P().resetFilters()"><i class="mdi mdi-undo-variant">&nbsp;</i>Reset</div>';
			html += '<div class="button primary" onClick="$P().navSearch(true)"><i class="mdi mdi-magnify">&nbsp;</i>Search</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		html += '<div id="d_search_results"><div class="loading_container"><div class="loading"></div></div></div>';
		
		this.div.html( html ).buttonize();
		
		MultiSelect.init( this.div.find('#fe_s_cols') );
		SingleSelect.init( this.div.find('#fe_s_log, #fe_s_rows, #fe_s_date, #fe_s_sort') );
		this.setupSearchOpts();
		
		this.div.find('#fe_s_date').on('change', function() {
			if (this.value == 'custom') self.showDatePicker( self.navSearch.bind(self) );
			else self.navSearch();
		});
		
		this.div.find('#fe_s_cols, #fe_s_log, #fe_s_rows, #fe_s_sort').on('change', function() {
			self.navSearch();
		});
		
		$('#fe_s_match').on('keydown', function(event) {
			// capture enter key
			if (event.keyCode == 13) {
				event.preventDefault();
				self.navSearch(true);
			}
		});
		
		setTimeout( function() { 
			// do this in another thread to ensure that Nav.loc is updated
			// not to mention user_nav
			self.doSearch();
		}, 1 );
		
		return true;
	}
	
	showDatePicker(callback) {
		// show dialog for picking a date range
		var self = this;
		var args = this.args;
		var title = "Select Log Date";
		var btn = ['check-circle', "Accept"];
		var noonish_yesterday = normalize_time( time_now(), { hour:12, min:0, sec:0 } ) - 86400;
		
		var html = '<div class="dialog_box_content scroll">';
		
		// date
		html += this.getFormRow({
			label: 'Custom Log Date:',
			content: this.getFormText({
				id: 'fe_edr_date',
				type: 'date',
				value: args.custom_date || yyyy_mm_dd(noonish_yesterday, '-'),
				'data-shrinkwrap': 1
			}),
			caption: 'Select a custom date to search for log archives on.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			if (!$('#fe_edr_date')[0].checkValidity()) return app.badField('#fe_edr_date', "Please enter a valid date.");
			
			args.custom_date = $('#fe_edr_date').val();
			var epoch = parse_date(args.custom_date);
			if (epoch > noonish_yesterday) {
				delete args.custom_date;
				args.date = '';
			}
			
			Dialog.hide();
			callback();
		}); // confirm
	}
	
	toggleSearchOption(elem) {
		// toggle search opt (case or regex) on/off
		var $elem = $(elem);
		if ($elem.hasClass('selected')) $elem.removeClass('selected');
		else $elem.addClass('selected');
		this.navSearch();
	}
	
	resetFilters() {
		// reset all filters to default and re-search
		Nav.go( this.selfNav({}) );
	}
	
	getSearchArgs() {
		// get form values, return search args object
		var args = {};
		
		var match = this.div.find('#fe_s_match').val().trim()
		if (match.length) {
			args.match = match;
			
			if (this.div.find('#d_search_opt_case').hasClass('selected')) args.case = 1;
			if (this.div.find('#d_search_opt_regex').hasClass('selected')) args.regex = 1;
		}
		
		var cols = this.div.find('#fe_s_cols').val();
		if (cols.length) args.cols = cols.join(',');
		
		var log = this.div.find('#fe_s_log').val();
		if (log) args.log = log;
		
		var rows = this.div.find('#fe_s_rows').val();
		if (rows) args.rows = parseInt(rows);
		
		var date = this.div.find('#fe_s_date').val();
		if (date) {
			args.date = date;
			if (date == 'custom') {
				args.custom_date = this.args.custom_date;
				if (!args.custom_date) { delete args.custom_date; args.date = ''; }
			}
		}
		
		var sort = this.div.find('#fe_s_sort').val();
		if (sort) args.sort = sort;
		
		if (!num_keys(args)) return null;
		
		return args;
	}
	
	navSearch(force = false) {
		// convert form into query and redirect
		app.clearError();
		
		var args = this.getSearchArgs();
		if (!args) {
			Nav.go( this.selfNav({}) );
			return;
		}
		
		Nav.go( this.selfNav(args), force );
	}
	
	doSearch() {
		// actually perform the search
		var args = this.args = this.getSearchArgs();
		
		// validate user's regexp
		if (args.match && args.regex) {
			try { new RegExp(args.match); }
			catch (err) {
				this.div.find('#d_search_results').empty(); // remove loading indicator
				return app.badField('fe_s_match', "" + err);
			}
		}
		
		app.api.post( 'app/admin_search_logs', args, this.receiveResults.bind(this) );
	}
	
	receiveResults(resp) {
		// receive search results
		var self = this;
		var args = this.args;
		var $results = this.div.find('#d_search_results');
		var html = '';
		
		if (!this.active) return; // sanity
		
		if (args.sort == 'date_desc') {
			resp.rows = resp.rows.reverse();
		}
		
		this.lastSearchResp = resp;
		this.rows = [];
		if (resp.rows) this.rows = resp.rows;
		
		var col_ids = args.cols.split(/\,\s*/);
		var col_titles = col_ids.map( function(col) {
			return config.ui.log_column_titles[col] || col;
		} );
		
		var grid_args = {
			// resp: resp,
			rows: this.rows,
			cols: col_titles,
			data_type: 'row',
			class: 'data_grid log_search_grid',
			empty_msg: 'No log rows found.',
			primary: true
		};
		
		html += '<div class="box">';
		
		html += '<div class="box_title">';
			html += 'Log Search Results';
			html += '<div class="clear"></div>';
		html += '</div>';
		
		html += '<div class="box_content table">';
		
		html += this.getBasicGrid( grid_args, function(row, idx) {
			return col_ids.map( function(col) { 
				if (col == 'hires_epoch') return self.getRelativeDateTime(row[col]);
				else if (col == 'data') {
					if (row[col]) return `<span class="link" onClick="$P().viewRowData(${idx})"><b>View Data...</b></span>`;
					else return '-';
				}
				else if (col in row) return `<span class="monospace">${row[col]}</span>`;
				else return '-'; 
			} );
		} );
		
		if (this.rows.length) {
			html += '<div style="margin-top: 30px;">';
			html += '<div class="button right secondary" onClick="$P().doLogExport()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i>Export Rows...</div>';
			html += '<div class="clear"></div>';
			html += '</div>';
		}
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		$results.html( html ).buttonize();
	}
	
	viewRowData(idx) {
		// view JSON data column
		var raw = this.rows[idx].data;
		var json = {};
		try { json = JSON.parse(raw); } catch (e) { json = {}; }
		this.viewCodeAuto("Row JSON Data", json, ['json']);
	}
	
	doLogExport() {
		// allow user to download log results
		var self = this;
		var args = this.args;
		var index = 'logs';
		var title = "Export Log Rows";
		var html = '';
		
		if (!this.rows || !this.rows.length) return app.doError("No rows found to export.");
		
		html += `<div class="dialog_intro">This allows you to export the log search results to your local machine.  Please select which log columns to include, and which file format you would prefer.</div>`;
		html += '<div class="dialog_box_content maximize scroll">';
		
		html += this.getFormRow({
			label: 'Select Columns:',
			content: this.getFormMenuMulti({
				id: 'fe_se_ex_cols',
				title: 'Select Columns',
				placeholder: 'None',
				options: config.log_columns.map( function(col) {
					return { id: col, title: config.ui.log_column_titles[col] || col };
				} ),
				values: args.cols.split(/\,\s*/),
				default_icon: 'database-marker-outline',
				'data-shrinkwrap': 1,
				'data-select-all': 1
			}),
			caption: "Choose which log columns to include in your export."
		});
		
		html += this.getFormRow({
			label: 'File Format:',
			content: this.getFormMenuSingle({
				id: 'fe_se_ex_fmt',
				title: 'Select Format',
				options: [ 
					{ id: 'log', title: "Native (Bracket-Delimited Values)", icon: 'code-brackets' },
					{ id: 'ndjson', title: "NDJSON (Newline-Delimited JSON)", icon: 'code-json' },
					{ id: 'csv', title: "CSV (Comma-Separated Values)", icon: 'file-delimited-outline' },
					{ id: 'tsv', title: "TSV (Tab-Separated Values)", icon: 'file-table-outline' }
				],
				value: app.getPref(`bse.${index}.fmt`) || 'log',
				'data-shrinkwrap': 1,
			}),
			caption: "Choose which file format to generate for your export."
		});
		
		html += '</div>';
		Dialog.confirm( title, html, ['database-export', "Export Now"], function(result) {
			if (!result) return;
			app.clearError();
			
			// prepare request
			var columns = $('#fe_se_ex_cols').val();
			var format = $('#fe_se_ex_fmt').val();
			
			if (!columns.length) {
				return app.badField('#fe_se_ex_cols', "Please select at least one log column to export.");
			}
			
			app.setPref(`bse.${index}.fmt`, format);
			
			// generate payload
			var formatters = {
				log: {
					file_ext: '.log',
					content_type: 'text/plain; charset=utf-8',
					
					format_header: function() {
						return '[' + columns.map( function(col) {
							var title = config.ui.log_column_titles[col] || col;
							return title;
						} ).join("][") + "]\n";
					},
					
					format_row: function(row) {
						return '[' + columns.map( function(col) {
							var value = row[col];
							if ((value === null) || (value === undefined) || (value === false)) value = '';
							return '' + String(value).replace(/\t/g, ' ').replace(/\n/g, ' ') + '';
						}).join("][") + "]\n";
					}
				}, // log
				
				csv: {
					file_ext: '.csv',
					content_type: 'text/csv; charset=utf-8',
					
					format_header: function() {
						return columns.map( function(col) {
							var title = config.ui.log_column_titles[col] || col;
							return '"' + title + '"';
						} ).join(',') + "\n";
					},
					
					format_row: function(row) {
						return columns.map( function(col) {
							var value = row[col];
							if ((value === null) || (value === undefined) || (value === false)) value = '';
							return '"' + String(value).replace(/^([=+\-@])/, "'$1").replace(/"/g, '""').replace(/\n/g, ' ') + '"';
						}).join(',') + "\n";
					}
				}, // csv
				
				tsv: {
					file_ext: '.tsv',
					content_type: 'text/tab-separated-values; charset=utf-8',
					
					format_header: function() {
						return columns.map( function(col) {
							var title = config.ui.log_column_titles[col] || col;
							return title;
						} ).join("\t") + "\n";
					},
					
					format_row: function(row) {
						return columns.map( function(col) {
							var value = row[col];
							if ((value === null) || (value === undefined) || (value === false)) value = '';
							return '' + String(value).replace(/^([=+\-@])/, "'$1").replace(/\t/g, ' ').replace(/\n/g, ' ') + '';
						}).join("\t") + "\n";
					}
				}, // tsv
				
				ndjson: {
					file_ext: '.ndjson',
					content_type: 'Content-Type: application/x-ndjson; charset=utf-8',
					
					format_row: function(row) {
						var json = {};
						columns.forEach( function(key) { json[key] = row[key]; } );
						return JSON.stringify(json) + "\n";
					}
				} // ndjson
			}; // formatters
			
			var formatter = formatters[format];
			var filename = 'xyops-log-export-' + args.log + '-' + (args.date || yyyy_mm_dd(0, '-')) + '-' + get_unique_id(8) + formatter.file_ext;
			
			var payload = formatter.format_header ? formatter.format_header() : '';
			var lines = self.rows.map( formatter.format_row );
			payload += lines.join("");
			
			var blob = new Blob([payload], { type: formatter.content_type });
			var url = URL.createObjectURL(blob);
			
			// create temp link element
			var a = document.createElement("a");
			a.href = url;
			a.download = filename;
			
			// click it, the remove it
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			
			// cleanup
			URL.revokeObjectURL(url);
			Dialog.hide();
		}); // Dialog.confirm
		
		MultiSelect.init( $('#fe_se_ex_cols') );
		SingleSelect.init( $('#fe_se_ex_fmt') );
		Dialog.autoResize();
	}
	
	onDeactivate() {
		// called when page is deactivated
		delete this.lastSearchResp;
		delete this.rows;
		this.div.html( '' );
		return true;
	}
	
};
