Page.PageUtils = class PageUtils extends Page.Base {

	goRevisionHistory(opts) {
		// jump intp revision history view for parent page
		var self = this;
		this.revHistOpts = opts;
		
		var args = this.args;
		if (!args.offset) args.offset = 0;
		if (!args.limit) args.limit = 25;
		
		var date_items = config.ui.date_range_menu_items;
		
		var html = '';
		html += '<div class="box" style="border:none;">';
		html += '<div class="box_content" style="padding:20px;">';
			
			// options
			html += '<div class="form_grid four" style="margin-bottom:0px">';
				
				// item menu
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: opts.itemMenu.label,
						content: this.getFormMenuSingle({
							id: 'fe_rh_id',
							title: opts.itemMenu.title,
							options: opts.itemMenu.options,
							value: args.id || '',
							default_icon: opts.itemMenu.default_icon,
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// user
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-account">&nbsp;</i>User:',
						content: this.getFormMenuSingle({
							id: 'fe_rh_username',
							title: 'Select User',
							options: [['', 'Any User']].concat( app.users.map( function(user) {
								return { id: user.username, title: user.full_name, icon: user.icon || '' };
							} ) ),
							value: args.username || '',
							default_icon: 'account',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// date
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-calendar-multiple">&nbsp;</i>Date Range:',
						content: this.getFormMenuSingle({
							id: 'fe_rh_date',
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
						{ id: 'date_desc', title: 'Newest on Top', icon: 'sort-descending' },
						{ id: 'date_asc', title: 'Oldest on Top', icon: 'sort-ascending' }
					];
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-sort">&nbsp;</i>Sort Results:',
						content: this.getFormMenuSingle({
							id: 'fe_rh_sort',
							title: 'Sort Results',
							options: sort_items,
							value: args.sort,
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
			html += '</div>'; // form_grid
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		// revision history
		html += '<div class="box" id="d_rh_revisions">';
			html += '<div class="box_title">';
				html += 'Revision History';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html( html );
		
		// MultiSelect.init( this.div.find('#fe_s_tags') );
		SingleSelect.init( this.div.find('#fe_rh_id, #fe_rh_username, #fe_rh_date, #fe_rh_sort') );
		// $('.header_search_widget').hide();
		
		this.div.find('#fe_rh_id, #fe_rh_username, #fe_rh_date, #fe_rh_sort').on('change', function() {
			self.revHistNavSearch();
		});
		
		this.fetchRevHistory();
	}
	
	getRevHistSearchArgs() {
		// get form values, return search args object
		var self = this;
		var args = {};
		
		['id', 'username', 'date'].forEach( function(key) {
			var value = self.div.find('#fe_rh_' + key).val();
			if (value) args[key] = value;
		} );
		
		var sort = this.div.find('#fe_rh_sort').val();
		if (sort != 'date_desc') args.sort = sort;
		
		if (!num_keys(args)) return null;
		
		return args;
	}
	
	revHistNavSearch() {
		// convert form into query and redirect
		app.clearError();
		
		var args = this.getRevHistSearchArgs();
		if (!args) {
			Nav.go( this.selfNav({ sub: 'history' }) );
			return;
		}
		
		args.sub = 'history';
		Nav.go( this.selfNav(args) );
	}
	
	getRevHistSearchQuery(args) {
		// construct actual unbase simple query syntax
		var self = this;
		var query = '';
		var keywords = [];
		
		if (args.id) keywords.push( args.id );
		if (args.username) keywords.push( args.username.replace(/\W/g, '_') );
		if (keywords.length) query += ' keywords:' + keywords.join('&'); // AND
		
		if (args.date) {
			query += ' ' + this.getDateRangeQuery('date', args.date);
		}
		
		return query.trim();
	}
	
	fetchRevHistory() {
		// actually perform the search
		var args = this.args;
		var query = this.getRevHistSearchQuery(args);
		
		// compose search query
		var sopts = {
			type: this.revHistOpts.activityType,
			query: query,
			offset: args.offset || 0,
			limit: config.items_per_page + 1 // for diff'ing across pages
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
		
		app.api.get( 'app/search_revision_history', sopts, this.receiveRevHistory.bind(this) );
	}
	
	receiveRevHistory(resp) {
		// show revision history and add links to detail diff dialogs
		var self = this;
		var args = this.args;
		var $cont = this.div.find('#d_rh_revisions');
		var html = '';
		
		if (!this.active) return; // sanity
		
		// massage results for diff'ing across pages
		// revisions always contains a shallow copy (which may have limit+1 items)
		// resp.rows will be chopped to exactly limit, for display
		this.revisions = [...resp.rows];
		if (resp.rows.length > config.alt_items_per_page) resp.rows.pop();
		
		var grid_args = {
			resp: resp,
			cols: ['Revision', 'Description', 'User', 'Date/Time', 'Actions'],
			data_type: 'item',
			offset: args.offset || 0,
			limit: config.items_per_page,
			class: 'data_grid event_revision_grid',
			pagination_link: '$P().revHistNav'
		};
		
		html += this.getPaginatedGrid( grid_args, function(item, idx) {
			// figure out icon first
			if (!item.action) item.action = 'unknown';
			
			var item_type = '';
			for (var key in config.ui.activity_types) {
				var regexp = new RegExp(key);
				if (item.action.match(regexp)) {
					item_type = config.ui.activity_types[key];
					break;
				}
			}
			item._type = item_type;
			
			// compose nice description
			var desc = item.description;
			var actions = [];
			var click = '';
			var nice_rev = 'n/a';
			
			// description template
			var template = config.ui.activity_descriptions[item.action];
			if (template) desc = substitute(template, item, false);
			else if (!desc) desc = '(No description provided)';
			item._desc = desc;
			
			var obj = item[ self.revHistOpts.itemKey ] || null;
			
			if (obj) {
				click = `$P().showRevHistActionReport(${idx})`;
				actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
			}
			
			if (click) {
				desc = `<span class="link" onClick="${click}">${desc}</span>`;
				if (obj.revision) {
					nice_rev = `<span class="link" onClick="${click}"><i class="mdi mdi-file-compare">&nbsp;</i><b>${obj.revision}</b></span>`;
				}
			}
			
			return [
				nice_rev,
				'<i class="mdi mdi-' + item_type.icon + '">&nbsp;</i>' + desc + '',
				'' + self.getNiceUser(item.username, true) + '',
				'' + self.getRelativeDateTime( item.epoch ) + '',
				'' + actions.join(' | ') + ''
			];
		}); // getPaginatedGrid
		
		$cont.find('> .box_content').html( html );
	}
	
	revHistNav(offset) {
		// paginate through revision history
		this.args.offset = offset;
		this.div.find('#d_rh_revisions > .box_content').addClass('loading');
		this.fetchRevHistory();
	}
	
	showRevHistActionReport(idx) {
		// pop dialog for any action
		var item = this.revisions[idx];
		var template = config.ui.activity_descriptions[item.action];
		
		var obj_key = this.revHistOpts.itemKey;
		var obj = item[ obj_key ];
		var all_objs = app[ this.revHistOpts.activityType ];
		var is_cur_rev = false;
		
		if (all_objs) {
			var latest_obj = find_object( all_objs, { id: obj.id } );
			if (latest_obj && (latest_obj.revision === obj.revision)) is_cur_rev = true;
		}
		
		// massage a title out of description template (ugh)
		var title = template.replace(/\:\s+.+$/, '').replace(/\s+\(.+$/, '');
		var btn = '<div class="button danger" onClick="$P().prepRevHistRollback(' + idx + ')"><i class="mdi mdi-undo-variant">&nbsp;</i>Rollback...</div>';
		if (is_cur_rev) btn = '&nbsp;';
		var md = '';
		
		// summary
		md += "### Summary\n\n";
		md += '- **Description:** <i class="mdi mdi-' + item._type.icon + '">&nbsp;</i>' + item._desc + "\n";
		md += '- **Date/Time:** ' + this.getRelativeDateTime(item.epoch) + "\n";
		md += '- **User:** ' + this.getNiceUser(item.username, true) + "\n";
		md += '- **Revision:** <i class="mdi mdi-file-compare">&nbsp;</i>' + (obj.revision || 'n/a') + (is_cur_rev ? ' (Current)' : '') + "\n";
		
		// find prev rev for diff'ing
		var prev_rev = this.revisions.find( function(rev) {
			return rev[obj_key] && rev[obj_key].id && (rev[obj_key].id === obj.id) && rev[obj_key].revision && (rev[obj_key].revision === obj.revision - 1);
		} );
		
		if (prev_rev) {
			// include diff in markdown
			var old_obj = copy_object( prev_rev[obj_key] );
			delete old_obj.revision;
			delete old_obj.modified;
			delete old_obj.sort_order;
			
			var new_obj = copy_object( obj );
			delete new_obj.revision;
			delete new_obj.modified;
			delete new_obj.sort_order;
			
			var diff_html = this.getDiffHTML( old_obj, new_obj );
			md += "\n### Diff to Previous\n\n";
			md += '<div class="diff_content">' + diff_html + '</div>' + "\n";
		}
		
		// the thing itself
		md += "\n### " + toTitleCase(obj_key.replace(/_/g, ' ')) + " JSON\n\n";
		md += '```json' + "\n";
		md += JSON.stringify( obj, null, "\t" ) + "\n";
		md += '```' + "\n";
		
		this.viewMarkdownAuto( title, md, btn );
	}
	
	prepRevHistRollback(idx) {
		// prep a rollback to specified revision
		var item = this.revisions[idx];
		var obj_key = this.revHistOpts.itemKey;
		var obj = item[ obj_key ];
		Dialog.hide();
		
		this.rollbackData = obj;
		Nav.go( this.revHistOpts.editPageID + '?sub=edit&id=' + obj.id + '&rollback=1');
	}
	
	cleanupRevHistory() {
		// call on page deactivate
		delete this.revisions;
		delete this.revHistOpts;
	}
	
	showExportOptions(opts) {
		// show dialog with export and api tool options
		var self = this;
		var title = 'Export ' + opts.name;
		var html = '';
		
		this._temp_export = opts;
		
		var md = '';
		md += `Please select how you would like to export the ${opts.name}'s JSON data.` + "\n";
		md += "\n```json\n" + JSON.stringify(opts.data, null, "\t") + "\n```\n";
		
		html += '<div class="code_viewer">';
		html += '<div class="markdown-body">';
		
		html += marked(md, config.ui.marked_config);
		
		html += '</div>'; // markdown-body
		html += '</div>'; // code_viewer
		
		var buttons_html = "";
		buttons_html += '<div class="button mobile_collapse" onClick="Dialog.hide()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
		buttons_html += '<div class="button mobile_collapse" onClick="$P().copyExportToClipboard()"><i class="mdi mdi-clipboard-text-outline">&nbsp;</i><span>Copy to Clipboard</span></div>';
		buttons_html += '<div class="button secondary mobile_collapse" onClick="$P().copyExportToAPITool()"><i class="mdi mdi-send">&nbsp;</i><span>Copy to API Tool...</span></div>';
		buttons_html += '<div class="button primary" onClick="Dialog.confirm_click(true)"><i class="mdi mdi-cloud-download-outline">&nbsp;</i>Download File</div>';
		
		Dialog.showSimpleDialog(title, html, buttons_html);
		
		// special mode for key capture
		Dialog.active = 'confirmation';
		Dialog.confirm_callback = function(result) { 
			if (result) self.copyExportToFile();
		};
		Dialog.onHide = function() {
			delete self._temp_export;
		};
		
		this.highlightCodeBlocks('#dialog .markdown-body');
	}
	
	copyExportToClipboard() {
		// copy export data as pretty-printed JSON to the clipboard
		var opts = this._temp_export;
		var payload = JSON.stringify(opts.data, null, "\t") + "\n";
		copyToClipboard(payload);
		app.showMessage('info', `The ${opts.name} JSON was copied to your clipboard.`);
	}
	
	copyExportToAPITool() {
		// copy the export data over to the API tool
		var opts = this._temp_export;
		// TODO: this
		Dialog.hide();
		Nav.go('APITool?import=1');
	}
	
	copyExportToFile() {
		// download export as file (which can then be re-uploaded to create/replace)
		var opts = this._temp_export;
		var json = {
			description: "Orchestra Portable Data Object",
			version: "1.0",
			type: opts.dataType,
			data: opts.data
		};
		var payload = JSON.stringify(json, null, "\t") + "\n";
		var filename = 'orchestra-' + opts.dataType + '-' + opts.data.id + '.json';
		var blob = new Blob([payload], { type: "application/json" });
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
	}
	
	doFileImportPrompt() {
		// show file selection dialog
		var self = this;
		var $file = $('#fe_file_import');
		if ($file.length) $file.remove();
		$file = $('<input type="file" id="fe_file_import" accept=".json" style="display:none">').appendTo('body');
		
		$file.on('change', function() {
			if (this.files && this.files.length) self.doPrepImportFile( this.files[0] );
			$file.remove();
		});
		
		$file[0].click();
	}
	
	getChartSizeSelector(pref_key = 'chart_size') {
		// get chart title widget menu selector
		return '<div class="box_title_widget" style="overflow:visible; min-width:100px; max-width:200px; font-size:13px;">' + this.getFormMenuSingle({
			class: 'sel_chart_size',
			title: 'Select chart size',
			options: [
				{ id: 'small', title: 'Small', icon: 'view-module-outline' },
				{ id: 'medium', title: 'Medium', icon: 'view-grid-outline' },
				{ id: 'large', title: 'Large', icon: 'view-agenda-outline' }
			],
			value: app.getPref(pref_key) || 'medium',
			onChange: '$P().applyChartSize(this)',
			'data-shrinkwrap': 1,
			'data-compact': 1,
			'data-prefkey': pref_key
		}) + '</div>';
	}
	
	applyChartSize(elem) {
		// set new chart size
		var $elem = $(elem);
		var size = $elem.val();
		var pref_key = $elem.data('prefkey');
		$elem.closest('div.box').find('div.chart_grid_horiz').removeClass(['small', 'medium', 'large']).addClass(size);
		ChartManager.charts.forEach( function(chart) { chart.dirty = true; } );
		ChartManager.check();
		app.setPref(pref_key, size);
	}
	
	// Upcoming Jobs
	
	getUpcomingJobs(events) {
		// predict and render upcoming jobs
		var self = this;
		if (!events) events = app.events;
		
		var opts = {
			events: events,
			duration: 86400 * 32,
			burn: 16,
			max: 1000,
			progress: null,
			callback: function(jobs) {
				self.upcomingJobs = jobs;
				self.renderUpcomingJobs();
			}
		};
		this.predictUpcomingJobs(opts);
	}
	
	renderUpcomingJobs() {
		// got jobs from prediction engine, so render them!
		var self = this;
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		if (!this.upcomingJobs) return;
		if (!this.upcomingOffset) this.upcomingOffset = 0;
		
		var grid_args = {
			resp: {
				rows: this.upcomingJobs.slice( this.upcomingOffset, this.upcomingOffset + config.alt_items_per_page ),
				list: { length: this.upcomingJobs.length }
			},
			cols: ['Event', 'Category', 'Targets', 'Source', 'Scheduled Time', 'Countdown', 'Actions'],
			data_type: 'job',
			offset: this.upcomingOffset,
			limit: config.alt_items_per_page,
			class: 'data_grid dash_job_upcoming_grid',
			pagination_link: '$P().jobUpcomingNav'
		};
		
		html += this.getPaginatedGrid( grid_args, function(job, idx) {
			var countdown = Math.max( 60, Math.abs(job.epoch - app.epoch) );
			var nice_source = (job.type == 'single') ? '<i class="mdi mdi-alarm-check">&nbsp;</i>Single Shot' : '<i class="mdi mdi-update">&nbsp;</i>Scheduler';
			var event = find_object( app.events, { id: job.event } ) || {};
			
			return [
				'<b>' + self.getNiceEvent(job.event, true) + '</b>',
				self.getNiceCategory(event.category, true),
				// self.getNicePlugin(event.plugin, true),
				self.getNiceTargetList(event.targets),
				nice_source,
				self.getRelativeDateTime( job.epoch ),
				'<i class="mdi mdi-clock-outline">&nbsp;</i>' + get_text_from_seconds_round( countdown ),
				'<span class="link danger" onClick="$P().doSkipUpcomingJob(' + idx + ')"><b>Skip Job...</b></span>'
				// '<a href="#Job?id=' + job.id + '">Details</a>'
			];
		} );
		
		this.div.find('#d_upcoming_jobs > .box_content').removeClass('loading').html(html);
	}
	
	jobUpcomingNav(offset) {
		// user clicked on upcoming job pagination nav
		this.upcomingOffset = offset;
		this.div.find('#d_upcoming_jobs > .box_content').addClass('loading');
		this.renderUpcomingJobs();
	}
	
	doSkipUpcomingJob(idx) {
		// add blackout range for upcoming job
		var self = this;
		var job = this.upcomingJobs[idx];
		var event = find_object( app.events, { id: job.event } );
		if (!event) return app.doError("Event not found: " + job.event);
		
		var msg = 'Are you sure you want to skip the upcoming job at "' + this.getShortDateTimeText( job.epoch ) + '"?';
		
		switch (job.type) {
			case 'single': msg += '  Since this is a "Single Shot" trigger, it will simply be disabled.'; break;
			case 'schedule': msg += '  Since this is a scheduled trigger, a new "Blackout" range will be added to disable it.'; break;
		}
		
		Dialog.confirmDanger( 'Skip Upcoming Job', msg, ['alert-decagram', 'Skip Job'], function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Skipping Job..." );
			
			switch (job.type) {
				case 'single':
					delete_object( event.triggers, { type: 'single', enabled: true, epoch: job.epoch } );
				break;
				
				case 'schedule':
					event.triggers.push({ type: 'blackout', enabled: true, start: job.epoch, end: job.epoch }); // Note: end is inclusive!
				break;
			} // switch job.type
			
			app.api.post( 'app/update_event', { id: event.id, triggers: event.triggers }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "The selected upcoming job will be skipped.");
				
				if (!self.active) return; // sanity
				
				self.upcomingJobs.splice( idx, 1 );
				self.renderUpcomingJobs();
			} ); // api.post
		} ); // confirm
	}
	
	autoExpireUpcomingJobs() {
		// automatically remove upcoming jobs that upcame
		if (!this.upcomingJobs || !this.upcomingJobs.length) return;
		
		while (this.upcomingJobs.length && (this.upcomingJobs[0].epoch <= app.epoch)) {
			this.upcomingJobs.shift();
		}
	}
	
	setupJobHistoryDayGraph() {
		// fetch historical job stats and render as heatmap grid
		var self = this;
		var opts = {
			offset: -365,
			limit: 365,
			path: 'currentDay',
			key_prefix: 'job_',
			current_day: 1
		};
		
		if (this.event) opts.path += '.events.' + this.event.id;
		else if (this.server) opts.path += '.servers.' + this.server.id;
		else if (this.group) opts.path += '.groups.' + this.group.id;
		else if (this.category) opts.path += '.categories.' + this.category.id;
		else if (this.plugin) opts.path += '.plugins.' + this.plugin.id;
		else opts.path += '.transactions';
		
		app.api.get( 'app/search_stat_history', opts, this.receiveJobHistoryDayGraph.bind(this) );
	}
	
	getJobHistoryDaySwatch(day, epoch) {
		// get HTML for single day history swatch (grid unit)
		var html = '';
		var day_code = yyyy_mm_dd(epoch);
		var nice_date = this.formatDate(epoch, { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });
		
		if (day && day.data && day.data.job_complete) {
			var data = day.data;
			var tooltip = nice_date + ": ";
			var groups = [];
			
			// job_error means "ALL" errors (it is incremented even if job_warning, job_critical or job_abort also fired)
			// so let's adjust the "error" count for the purpose of displaying all stats in relation
			if (!data.job_error) data.job_error = 0;
			if (data.job_warning) data.job_error -= data.job_warning;
			if (data.job_critical) data.job_error -= data.job_critical;
			if (data.job_abort) data.job_error -= data.job_abort;
			data.job_error = Math.max(0, data.job_error); // sanity
			
			if (data.job_success) groups.push({ color: 'var(--green)', text: commify(data.job_success) + pluralize(' job', data.job_success) + ' succeeded' });
			if (data.job_error) groups.push({ color: 'var(--red)', text: commify(data.job_error) + pluralize(' job', data.job_error) + ' failed' });
			if (data.job_warning) groups.push({ color: 'var(--yellow)', text: commify(data.job_warning) + pluralize(' job', data.job_warning) + ' warned' });
			if (data.job_critical) groups.push({ color: 'var(--purple)', text: commify(data.job_critical) + pluralize(' job', data.job_critical) + ' critical' });
			if (data.job_abort) groups.push({ color: 'var(--gray)', text: commify(data.job_abort) + pluralize(' job', data.job_abort) + ' aborted' });
			
			tooltip += groups.map( function(group) { return group.text; } ).join(', ');
			
			// compute gradient based on groups
			var pct_jump = 100 / groups.length;
			var grad = 'linear-gradient(to bottom right';
			
			groups.forEach( function(group, idx) {
				var start_pct = short_float( idx * pct_jump );
				var end_pct = short_float( (idx + 1) * pct_jump );
				if (end_pct >= 99) end_pct = 100;
				grad += `, ${group.color} ${start_pct}%, ${group.color} ${end_pct}%`;
			} );
			
			grad += ');';
			
			// search link
			var alt_code = day_code.replace(/\//g, '-');
			var url = `#Search?date=custom&start=${alt_code}&end=${alt_code}`;
			if (this.event) url += '&event=' + this.event.id;
			else if (this.server) url += '&server=' + this.server.id;
			else if (this.group) url += '&groups=' + this.group.id;
			else if (this.category) url += '&category=' + this.category.id;
			else if (this.plugin) url += '&plugin=' + this.plugin.id;
			
			html += `<div style="background:${grad}" data-date="${day_code}" onClick="Nav.go('${url}')" title="${tooltip}"></div>`;
		}
		else html += `<div class="empty" data-date="${day_code}" title="No data for ${nice_date}"></div>`;
		
		return html;
	}
	
	receiveJobHistoryDayGraph(resp) {
		// receive stats to render into heatmap
		// resp: { code, items, list }
		// items: { epoch, date, data }
		var self = this;
		var days = {};
		var html = '';
		
		if (!this.active) return; // sanity
		
		// index all days by YYYY-MM-DD
		resp.items.forEach( function(item) {
			days[ item.date ] = item;
		} );
		
		// find start date, which must be a sunday
		var noon_today = normalize_time( time_now(), { hour:12, min:0, sec:0 } );
		var last_year = noon_today - (86400 * 365);
		var wday = (new Date(last_year * 1000)).getDay();
		var epoch = last_year - (wday * 86400);
		
		// header
		html += '<div class="data_grid_pagination">';
			html += '<div style="text-align:left">' + this.formatDate(epoch, { year: 'numeric', month: 'short' }) + '</div>';
			html += '<div style="text-align:center">' + this.formatDate(epoch + Math.floor(((noon_today - epoch) / 2)), { year: 'numeric', month: 'short' }) + '</div>';
			html += '<div style="text-align:right">' + this.formatDate(noon_today, { year: 'numeric', month: 'short' }) + '</div>';
		html += '</div>';
		
		// grid
		html += '<div class="job_day_graph">';
		
		while (epoch <= noon_today) {
			var day_code = yyyy_mm_dd(epoch);
			var day = days[ day_code ];
			html += this.getJobHistoryDaySwatch(day, epoch);
			epoch += 86400;
		} // foreach day
		
		html += '</div>';
		
		this.div.find('#d_job_day_graph').show().find('> .box_content').removeClass('loading').html(html);
	}
	
	updateJobHistoryDayGraph() {
		// update final swatch in job day history, based on current stats
		var day = { epoch: app.epoch, data: null };
		var day_code = yyyy_mm_dd(day.epoch);
		
		var $swatch = this.div.find('#d_job_day_graph .job_day_graph > div').last();
		if (!$swatch.length) return; // sanity
		if ($swatch.data('date') != day_code) {
			// day changed, need full refresh
			// FUTURE: if we implement paging in the day graph, then this needs to bail out if we're not looking at the current year
			this.setupJobHistoryDayGraph();
			return;
		}
		
		if (this.event) day.data = get_path( app.stats, 'currentDay.events.' + this.event.id );
		else if (this.server) day.data = get_path( app.stats, 'currentDay.servers.' + this.server.id );
		else if (this.group) day.data = get_path( app.stats, 'currentDay.groups.' + this.group.id );
		else if (this.category) day.data = get_path( app.stats, 'currentDay.categories.' + this.category.id );
		else if (this.plugin) day.data = get_path( app.stats, 'currentDay.plugins.' + this.plugin.id );
		else day.data = get_path( app.stats, 'currentDay.transactions' );
		
		var html = this.getJobHistoryDaySwatch(day, app.epoch);
		$swatch.replaceWith(html);
	}
	
	// Workflow Utilities:
	
	setupWorkflow() {
		// render all workflow nodes into container
		// expects workflow to exist in this.workflow
		var self = this;
		var html = '';
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		
		this.wfScroll = { x:0, y:0 };
		this.wfZoom = 1;
		this.wfSelection = {};
		
		if (!workflow.nodes) workflow.nodes = [];
		if (!workflow.connections) workflow.connections = [];
		
		html += `<div id="d_wf_editor" class="wf_root" style="zoom:${this.wfZoom}">`;
		
		html += '<div class="wf_fade">';
		
		html += '<canvas id="c_wf_canvas" class="wf_canvas"></canvas>';
		
		workflow.nodes.forEach( function(node) {
			var func = 'getWF_' + node.type;
			html += self[func](node, workflow);
		} );
		
		workflow.connections.forEach( function(conn) {
			if (!conn.condition) return;
			html += self.getWFCondition(conn);
		} );
		
		html += '</div>'; // wf_fade
		html += '</div>'; // wf_editor
		
		$cont.append(html);
		
		// auto-zoom to fit, which also triggers a redraw
		this.wfZoomAuto();
		
		// scroll handler
		$cont.find('#d_wf_editor').on('mousedown', function(event) {
			if (event.which !== 1) return; // only capture left-clicks
			var $this = $(this);
			
			event.stopPropagation();
			event.preventDefault();
			
			// if we're soldering, pause it and pop menu to create node in place
			if (self.wfSoldering) return self.solderNewNode();
			
			// if we're in edit mode, deselect all
			if (self.wfEdit) self.deselectAll();
			
			self.wfScroll.dragging = true;
			var start_pt = { x: event.clientX, y: event.clientY };
			var start_scroll = Object.assign( {}, self.wfScroll );
			
			$cont.addClass('dragging');
			
			$(document).on('mousemove.scroll', function(event) {
				self.wfScroll.x = start_scroll.x - ((event.clientX - start_pt.x) / self.wfZoom);
				self.wfScroll.y = start_scroll.y - ((event.clientY - start_pt.y) / self.wfZoom);
				self.drawWorkflow();
			});
			
			$(document).on('mouseup.scroll', function(event) {
				delete self.wfScroll.dragging;
				$this.css('cursor', 'grab');
				$(document).off('.scroll');
				$cont.removeClass('dragging');
				if (self.wfEdit) self.updateState();
			});
			
			$this.css('cursor', 'grabbing');
			return false; // legacy
		});
	}
	
	wfGetContainer() {
		// get ref to outer container div
		return this.div.find('.wf_container');
	}
	
	wfComputeBounds(use_sel) {
		// calculate the outer bounds of all nodes, also size and center point
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		var bounds = false;
		
		if (!workflow.nodes.length) return false;
		
		workflow.nodes.forEach( function(node) {
			if (use_sel && !self.wfSelection[node.id]) return;
			
			var $elem = $cont.find('#d_wfn_' + node.id);
			var elem = $elem.get(0);
			var box = { left: node.x, top: node.y, right: node.x + elem.offsetWidth, bottom: node.y + elem.offsetHeight };
			if ($elem.hasClass('wf_entity')) box.bottom += 34; // entities have captions that live "outside" the offsetHeight
			if (!bounds) { bounds = box; return; }
			
			if (box.left < bounds.left) bounds.left = box.left;
			if (box.top < bounds.top) bounds.top = box.top;
			if (box.right > bounds.right) bounds.right = box.right;
			if (box.bottom > bounds.bottom) bounds.bottom = box.bottom;
		});
		
		bounds.width = bounds.right - bounds.left;
		bounds.height = bounds.bottom - bounds.top;
		
		bounds.cx = Math.floor( bounds.left + (bounds.width / 2) );
		bounds.cy = Math.floor( bounds.top + (bounds.height / 2) );
		
		return bounds;
	}
	
	wfUpdateZoom() {
		// update zoom value in editor div, and set/unset special classes
		var $cont = this.wfGetContainer();
		var $editor = $cont.find('#d_wf_editor');
		$editor.css('zoom', this.wfZoom);
		
		if (app.safari) {
			// safari hack: zoom quality is abysmal
			if (this.wfZoom == 0.25) $editor.addClass('zoom_quarter');
			else $editor.removeClass('zoom_quarter');
		}
		
		// show zoom percentage
		var zoom_pct = Math.round( this.wfZoom * 100 );
		$cont.find('.wf_zoom_msg').html( zoom_pct + '%' );
		
		// update zoom button classes
		$cont.find('#d_btn_wf_zoom_in').toggleClass('disabled', (this.wfZoom >= 3));
		$cont.find('#d_btn_wf_zoom_out').toggleClass('disabled', (this.wfZoom <= 0.25));
	}
	
	wfZoomAuto() {
		// automatically zoom and center workflow nodes
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		var bounds = this.wfComputeBounds();
		
		if (!bounds) {
			// no nodes, just reset to default
			this.wfZoom = 1;
			this.wfScroll.x = 0;
			this.wfScroll.y = 0;
			this.wfUpdateZoom();
			this.drawWorkflow();
			return;
		}
		
		var cont_width = $cont.width() - 0; // adjust for vignette
		var cont_height = $cont.height() - 0; // adjust for vignette
		
		// start at default zoom, and only zoom out to fit, never in
		var dest_zoom = 1;
		
		while ((bounds.width > cont_width) || (bounds.height > cont_height)) {
			dest_zoom -= 0.25;
			cont_width = $cont.width() / dest_zoom;
			cont_height = $cont.height() / dest_zoom;
			if (dest_zoom <= 0.25) break;
		}
		
		this.wfZoom = dest_zoom;
		
		// now calculate correct scroll point
		this.wfScroll.x = Math.floor( bounds.cx - (cont_width / 2) );
		this.wfScroll.y = Math.floor( bounds.cy - (cont_height / 2) );
		
		// update display
		this.wfUpdateZoom();
		this.drawWorkflow();
		
		if (this.wfEdit) this.updateState();
	}
	
	wfZoomIn() {
		// zoom in
		var $cont = this.wfGetContainer();
		
		if (this.wfZoom < 3) {
			var cx = Math.floor( this.wfScroll.x + (($cont.width() / this.wfZoom) / 2) );
			var cy = Math.floor( this.wfScroll.y + (($cont.height() / this.wfZoom) / 2) );
			
			// zoom in centered on selection, if applicable
			if (num_keys(this.wfSelection)) {
				var bounds = this.wfComputeBounds(true);
				cx = bounds.cx;
				cy = bounds.cy;
			}
			
			if (this.wfZoom < 1) this.wfZoom += 0.25;
			else this.wfZoom += 0.5;
			
			// var bounds = this.wfComputeBounds();
			var cont_width = $cont.width() / this.wfZoom;
			var cont_height = $cont.height() / this.wfZoom;
			
			this.wfScroll.x = Math.floor( cx - (cont_width / 2) );
			this.wfScroll.y = Math.floor( cy - (cont_height / 2) );
			
			this.wfUpdateZoom();
			this.drawWorkflow();
			
			if (this.wfEdit) this.updateState();
		}
	}
	
	wfZoomOut() {
		// zoom out
		var $cont = this.wfGetContainer();
		
		if (this.wfZoom > 0.25) {
			var cx = Math.floor( this.wfScroll.x + (($cont.width() / this.wfZoom) / 2) );
			var cy = Math.floor( this.wfScroll.y + (($cont.height() / this.wfZoom) / 2) );
			
			if (this.wfZoom > 1) this.wfZoom -= 0.5;
			else this.wfZoom -= 0.25;
			
			// var bounds = this.wfComputeBounds();
			var cont_width = $cont.width() / this.wfZoom;
			var cont_height = $cont.height() / this.wfZoom;
			
			this.wfScroll.x = Math.floor( cx - (cont_width / 2) );
			this.wfScroll.y = Math.floor( cy - (cont_height / 2) );
			
			this.wfUpdateZoom();
			this.drawWorkflow();
			
			if (this.wfEdit) this.updateState();
		}
	}
	
	drawWorkflow(entire) {
		// redraw scroll positions, or entire WF editor
		var self = this;
		var workflow = this.workflow;
		var scroll = this.wfScroll;
		var $cont = this.wfGetContainer();
		
		if (entire) {
			// redraw entire workflow from scratch, for e.g. after undo/redo
			var $fade = $cont.find('.wf_fade');
			$fade.find('.wf_node, .wf_condition').remove();
			
			// append all wf_node elements
			workflow.nodes.forEach( function(node) {
				var func = 'getWF_' + node.type;
				$fade.append( self[func](node, workflow) );
			} );
			
			// append all connection w/condition (wf_condition) elements
			workflow.connections.forEach( function(conn) {
				if (!conn.condition) return;
				$fade.append( self.getWFCondition(conn) );
			} );
			
			this.wfUpdateZoom();
		}
		else {
			// fast redraw, only update positions, for zoom / scroll
			workflow.nodes.forEach( function(node) {
				var $node = $cont.find('#d_wfn_' + node.id);
				var pos = self.getWFPos(node);
				$node.css({ left: '' + pos.x + 'px', top: '' + pos.y + 'px' });
			} );
		}
		
		// adjust background position to mimic scroll
		$cont.find('#d_wf_editor').css('backgroundPosition', '' + Math.floor(0 - (scroll.x % 20)) + 'px ' + Math.floor(0 - (scroll.y % 20)) + 'px');
		
		// redraw canvas
		this.renderWFConnections();
	}
	
	getWFCondition(conn) {
		// get HTML for condition inside wire
		var classes = ['wf_condition'];
		var icon = '';
		var title = '';
		
		if (conn.condition.match(/^tag\:(\w+)$/)) {
			// custom tag
			var tag_id = RegExp.$1;
			var tag = find_object( app.tags, { id: tag_id } );
			if (!tag) tag = { id: tag_id, title: tag_id };
			
			classes.push('tag');
			icon = tag.icon || 'tag-outline';
			title = tag.title;
		}
		else {
			// std condition
			var trig = find_object( config.ui.action_condition_menu, { id: conn.condition } );
			classes.push( conn.condition );
			icon = trig.icon;
			title = trig.title;
			
			// fudge icons a bit
			if (conn.condition.match(/^(start|complete)$/) && !icon.match(/\-outline$/)) icon += '-outline';
		}
		
		return `<div class="${classes.join(' ')}" id="d_wft_${conn.id}"><i class="mdi mdi-${icon}"></i><div class="wf_trig_label">${title}</div></div>`;
	}
	
	getWFPos(node) {
		// calculate x/y position of node based on scroll and zoom
		var scroll = this.wfScroll;
		return { x: node.x - scroll.x, y: node.y - scroll.y };
	}
	
	getWF_event(node, workflow) {
		// get HTML for single workflow node of type event
		var html = '';
		var pos = this.getWFPos(node);
		var classes = ['wf_node', 'wf_event'];
		
		var event = find_object( app.events, { id: node.data.event } );
		if (!event) {
			// oh dear, event was deleted from under us
			event = { title: '(Event Missing)' };
			classes.push('wf_error');
		}
		
		var params = node.data.params;
		var default_icon = (event.type == 'workflow') ? 'clipboard-flow-outline' : config.ui.data_types.event.icon;
		var icon = event.icon || default_icon;
		var none = '<span>(None)</span>';
		
		html += `<div id="d_wfn_${node.id}" class="${classes.join(' ')}" style="left:${pos.x}px; top:${pos.y}px;">
			<div class="wf_event_title"><i class="mdi mdi-drag"></i><i class="mdi mdi-${icon}"></i>${event.title}</div>
			<div class="wf_body">
				<div class="wf_fallback_icon"><i class="mdi mdi-${icon}"></i></div>
				<div class="summary_grid double">
		`;
		
		// category
		html += '<div>'; // grid unit
		html += '<div class="info_label">Category</div>';
		html += '<div class="info_value">' + this.getNiceCategory(node.data.category || event.category, false) + '</div>';
		html += '</div>'; // grid unit
		
		// plugin
		html += '<div>'; // grid unit
		html += '<div class="info_label">Plugin</div>';
		html += '<div class="info_value">' + this.getNicePlugin(event.plugin, false) + '</div>';
		html += '</div>'; // grid unit
		
		// targets
		var event_targets = (node.data.targets && node.data.targets.length) ? node.data.targets : event.targets;
		html += '<div>'; // grid unit
		html += '<div class="info_label">Targets</div>';
		html += '<div class="info_value">' + this.getNiceTargetList(event_targets, false) + '</div>';
		html += '</div>'; // grid unit
		
		// algo
		var event_algo = node.data.algo || event.algo;
		html += '<div>'; // grid unit
		html += '<div class="info_label">Algorithm</div>';
		html += '<div class="info_value">' + this.getNiceAlgo(event_algo) + '</div>';
		html += '</div>'; // grid unit
		
		if (event.fields && event.fields.filter( function(param) { return param.type != 'hidden'; } ).length) {
			html += '</div>';
			html += '<div class="summary_grid single">';
		}
		
		(event.fields || []).forEach( function(param, idx) {
			var elem_value = (param.id in params) ? params[param.id] : param.value;
			var elem_icon = config.ui.control_type_icons[param.type];
			if (param.type == 'hidden') return;
			
			html += '<div>'; // grid unit
			html += '<div class="info_label">' + (param.locked ? '<i class="mdi mdi-lock-outline">&nbsp;</i>' : '') + param.title + '</div>';
			html += '<div class="info_value">';
			
			switch (param.type) {
				case 'text':
				case 'textarea':
					if (elem_value.toString().length) {
						html += '<i class="mdi mdi-' + elem_icon + '">&nbsp;</i>';
						html += elem_value;
					}
					else html += none;
				break;
				
				case 'code':
					if (elem_value.toString().length) {
						html += '<i class="mdi mdi-' + elem_icon + '">&nbsp;</i>';
						html += '<span class="monospace">' + elem_value + '</span>';
					}
					else html += none;
				break;
				
				case 'checkbox':
					elem_icon = elem_value ? 'checkbox-marked-outline' : 'checkbox-blank-outline';
					html += '<i class="mdi mdi-' + elem_icon + '">&nbsp;</i>';
					if (elem_value) html += 'Yes';
					else html += '<span>No</span>'; 
				break;
				
				case 'select':
					html += '<i class="mdi mdi-' + elem_icon + '">&nbsp;</i>';
					html += elem_value.toString().replace(/\,.*$/, '');
				break;
			} // switch type
			
			html += '</div>'; // info_value
			html += '</div>'; // grid unit
		} );
		
		html += '</div>'; // summary_grid
		html += '</div>'; // wf_body
		
		html += `
			<div class="wf_pole wf_input_pole"><i class="mdi mdi-chevron-right"></i></div>
			<div class="wf_pole wf_output_pole"><i class="mdi mdi-chevron-right"></i></div>
			<div class="wf_pole wf_down_pole"><i class="mdi mdi-chevron-down"></i></div>
		</div>`;
		
		return html;
	}
	
	getWF_job(node, workflow) {
		// get HTML for single workflow node of type job
		var html = '';
		var pos = this.getWFPos(node);
		var classes = ['wf_node', 'wf_event'];
		
		var plugin = find_object( app.plugins, { id: node.data.plugin } );
		if (!plugin) {
			// oh dear, plugin was deleted from under us
			plugin = { title: '(Plugin Missing)' };
			classes.push('wf_error');
		}
		
		var params = node.data.params;
		var title = node.data.label || plugin.title;
		var icon = node.data.icon || plugin.icon || config.ui.data_types.plugin.icon;
		var none = '<span>(None)</span>';
		
		html += `<div id="d_wfn_${node.id}" class="${classes.join(' ')}" style="left:${pos.x}px; top:${pos.y}px;">
			<div class="wf_event_title"><i class="mdi mdi-drag"></i><i class="mdi mdi-${icon}"></i>${title}</div>
			<div class="wf_body">
				<div class="wf_fallback_icon"><i class="mdi mdi-${icon}"></i></div>
				<div class="summary_grid double">
		`;
		
		// category
		html += '<div>'; // grid unit
		html += '<div class="info_label">Category</div>';
		html += '<div class="info_value">' + this.getNiceCategory(node.data.category, false) + '</div>';
		html += '</div>'; // grid unit
		
		// plugin
		html += '<div>'; // grid unit
		html += '<div class="info_label">Plugin</div>';
		html += '<div class="info_value">' + this.getNicePlugin(node.data.plugin, false) + '</div>';
		html += '</div>'; // grid unit
		
		// targets
		html += '<div>'; // grid unit
		html += '<div class="info_label">Targets</div>';
		html += '<div class="info_value">' + this.getNiceTargetList(node.data.targets, false) + '</div>';
		html += '</div>'; // grid unit
		
		// algo
		html += '<div>'; // grid unit
		html += '<div class="info_label">Algorithm</div>';
		html += '<div class="info_value">' + this.getNiceAlgo(node.data.algo) + '</div>';
		html += '</div>'; // grid unit
		
		if (plugin.params && plugin.params.filter( function(param) { return param.type != 'hidden'; } ).length) {
			html += '</div>';
			html += '<div class="summary_grid single">';
		}
		
		(plugin.params || []).forEach( function(param, idx) {
			var elem_value = (param.id in params) ? params[param.id] : param.value;
			var elem_icon = config.ui.control_type_icons[param.type];
			if (param.type == 'hidden') return;
			
			html += '<div>'; // grid unit
			html += '<div class="info_label">' + (param.locked ? '<i class="mdi mdi-lock-outline">&nbsp;</i>' : '') + param.title + '</div>';
			html += '<div class="info_value">';
			
			switch (param.type) {
				case 'text':
				case 'textarea':
					if (elem_value.toString().length) {
						html += '<i class="mdi mdi-' + elem_icon + '">&nbsp;</i>';
						html += elem_value;
					}
					else html += none;
				break;
				
				case 'code':
					if (elem_value.toString().length) {
						html += '<i class="mdi mdi-' + elem_icon + '">&nbsp;</i>';
						html += '<span class="monospace">' + elem_value + '</span>';
					}
					else html += none;
				break;
				
				case 'checkbox':
					elem_icon = elem_value ? 'checkbox-marked-outline' : 'checkbox-blank-outline';
					html += '<i class="mdi mdi-' + elem_icon + '">&nbsp;</i>';
					if (elem_value) html += 'Yes';
					else html += '<span>No</span>'; 
				break;
				
				case 'select':
					html += '<i class="mdi mdi-' + elem_icon + '">&nbsp;</i>';
					html += elem_value.toString().replace(/\,.*$/, '');
				break;
			} // switch type
			
			html += '</div>'; // info_value
			html += '</div>'; // grid unit
		} );
		
		html += '</div>'; // summary_grid
		html += '</div>'; // wf_body
		
		html += `
			<div class="wf_pole wf_input_pole"><i class="mdi mdi-chevron-right"></i></div>
			<div class="wf_pole wf_output_pole"><i class="mdi mdi-chevron-right"></i></div>
			<div class="wf_pole wf_down_pole"><i class="mdi mdi-chevron-down"></i></div>
		</div>`;
		
		return html;
	}
	
	getWF_action(node, workflow) {
		// get HTML for single workflow node of type action
		var html = '';
		var pos = this.getWFPos(node);
		var action = node.data;
		var icon = '';
		var title = '';
		var label = '';
		
		var classes = ['wf_node', 'wf_entity'];
		if (!action.enabled) classes.push('disabled');
		
		switch (action.type) {
			case 'email':
				title = "Send Email";
				icon = 'email-send-outline';
			break;
			
			case 'web_hook':
				var web_hook = find_object( app.web_hooks, { id: action.web_hook } );
				if (!web_hook) classes.push('error');
				title = "Web Hook";
				label = web_hook ? web_hook.title : "(Not found)";
				icon = web_hook ? (web_hook.icon || 'webhook') : 'alert-decagram-outline';
			break;
			
			case 'run_event':
				var event = find_object( app.events, { id: action.event_id } );
				if (!event) classes.push('error');
				title = "Run Event";
				label = event ? event.title : "(Not found)";
				icon = event ? (event.icon || 'calendar-clock') : 'alert-decagram-outline';
			break;
			
			case 'channel':
				var channel = find_object( app.channels, { id: action.channel_id } );
				if (!channel) classes.push('error');
				title = "Notify Channel";
				label = channel ? channel.title : "(Not found)";
				icon = channel ? (channel.icon || 'bullhorn-outline') : 'alert-decagram-outline';
			break;
			
			case 'snapshot':
				title = "Snapshot";
				label = "(Current server)";
				icon = 'monitor-screenshot';
			break;
			
			case 'disable':
				title = "Disable Event";
				label = "(Current event)";
				icon = 'cancel';
			break;
			
			case 'delete':
				title = "Delete Event";
				label = "(Current event)";
				icon = 'trash-can-outline';
			break;
			
			case 'plugin':
				var plugin = find_object( app.plugins, { id: action.plugin_id, type: 'action' } );
				if (!plugin) classes.push('error');
				title = "Plugin";
				label = plugin ? plugin.title : "(Not found)";
				icon = plugin ? (plugin.icon || 'power-plug') : 'alert-decagram-outline';
			break;
		} // switch action.type
		
		if (!action.enabled) label = '(Disabled)';
		
		html += `<div id="d_wfn_${node.id}" class="${classes.join(' ')}" style="left:${pos.x}px; top:${pos.y}px;">
			<div class="wf_ent_action">
				<i class="mdi mdi-${icon}"></i>
				<div class="wf_pole wf_input_pole"><i class="mdi mdi-chevron-right"></i></div>
			</div>
			<span class="wf_ent_title">${title}</span>
			<span class="wf_ent_label">${label}</span>
		</div>`;
		
		return html;
	}
	
	getWF_limit(node, workflow) {
		// get HTML for single workflow node of type action
		var html = '';
		var pos = this.getWFPos(node);
		var limit = node.data;
		
		var classes = ['wf_node', 'wf_entity'];
		if (!limit.enabled) classes.push('disabled');
		
		var { nice_title, short_desc, icon } = this.getResLimitDisplayArgs(limit);
		
		if (!limit.enabled) short_desc = '(Disabled)';
		
		html += `<div id="d_wfn_${node.id}" class="${classes.join(' ')}" style="left:${pos.x}px; top:${pos.y}px;">
			<div class="wf_ent_limit">
				<i class="mdi mdi-${icon}"></i>
				<div class="wf_pole wf_up_pole"><i class="mdi mdi-chevron-up"></i></div>
			</div>
			<span class="wf_ent_title">${nice_title}</span>
			<span class="wf_ent_label">${short_desc}</span>
		</div>`;
		
		return html;
	}
	
	getWF_trigger(node, workflow) {
		// get HTML for single workflow node of type trigger
		var html = '';
		var pos = this.getWFPos(node);
		var trigger = find_object( this.event.triggers, { id: node.id } );
		if (!trigger) return; // sanity
		
		var classes = ['wf_node', 'wf_entity'];
		var inner_classes = ['wf_ent_trigger'];
		if (!trigger.enabled) classes.push('disabled');
		
		var { nice_icon, nice_type, alt_type, nice_desc, alt_icon, short_desc } = this.getTriggerDisplayArgs(trigger);
		var nice_title = nice_type;
		var icon = alt_icon;
		var pole = `<div class="wf_pole wf_output_pole"><i class="mdi mdi-chevron-right"></i></div>`;
		
		if (!trigger.enabled) short_desc = '(Disabled)';
		
		if (trigger.type.match(/^(catchup|range|blackout|delay|precision)$/)) {
			// option triggers are rendered as pure circles with no pole
			nice_title = alt_type;
			inner_classes.push('wf_option');
			pole = '';
		}
		
		html += `<div id="d_wfn_${node.id}" class="${classes.join(' ')}" style="left:${pos.x}px; top:${pos.y}px;">
			<div class="${inner_classes.join(' ')}">
				<i class="mdi mdi-${icon}"></i>
				${pole}
			</div>
			<span class="wf_ent_title">${nice_title}</span>
			<span class="wf_ent_label">${short_desc}</span>
		</div>`;
		
		return html;
	}
	
	getWF_controller(node, workflow) {
		// get HTML for single workflow node of type controller
		var html = '';
		var pos = this.getWFPos(node);
		var classes = ['wf_node', 'wf_entity'];
		
		var { icon, title } = find_object( config.ui.workflow_controller_type_menu, { id: node.data.controller } );
		var label = '';
		
		switch (node.data.controller) {
			case 'multiplex':
				if (node.data.stagger) label = get_text_from_seconds(node.data.stagger, true, true) + ' stagger';
			break;
			
			case 'repeat':
				label = '' + node.data.repeat + ' ' + pluralize('iteration', node.data.repeat);
			break;
			
			case 'split':
				label = '<span class="monospace">' + node.data.split + '</span>';
			break;
			
			case 'decision':
				label = '<span class="monospace">' + node.data.decision + '</span>';
				if (node.data.label) title = node.data.label;
				if (node.data.icon) icon = node.data.icon;
			break;
		} // switch type
		
		html += `<div id="d_wfn_${node.id}" class="${classes.join(' ')}" style="left:${pos.x}px; top:${pos.y}px;">
			<div class="wf_ent_controller">
				<i class="mdi mdi-${icon}"></i>
				<div class="wf_pole wf_input_pole"><i class="mdi mdi-chevron-right"></i></div>
				<div class="wf_pole wf_output_pole"><i class="mdi mdi-chevron-right"></i></div>
			</div>
			<span class="wf_ent_title" style="left:0">${title}</span>
			<span class="wf_ent_label" style="left:0">${label}</span>
		</div>`;
		
		return html;
	}
	
	renderWFConnections() {
		// draw all lines connecting nodes
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		var canvas = $cont.find('canvas').get(0);
		var ctx = canvas.getContext('2d');
		
		var width = $cont.width();
		var height = $cont.height();
		
		canvas.width = width * window.devicePixelRatio;
		canvas.height = height * window.devicePixelRatio;
		
		if (!workflow.connections.length) return;
		
		ctx.save();
		ctx.scale( window.devicePixelRatio * this.wfZoom, window.devicePixelRatio * this.wfZoom );
		// ctx.translate( 0 - this.wfScroll.x, 0 - this.wfScroll.y );
		
		ctx.lineJoin = "round";
		ctx.lineWidth = 4;
		// ctx.strokeStyle = "rgba(128,130,132,0.5)";
		// ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
		// ctx.shadowOffsetX = 8;
		// ctx.shadowOffsetY = 8;
		// ctx.shadowBlur = 32;
		
		// index all nodes by id for quick lookups
		var nodes = {};
		workflow.nodes.forEach( function(node) { nodes[ node.id ] = node; });
		
		// iterate over all connections
		workflow.connections.forEach( function(conn) {
			var source = nodes[ conn.source ];
			var dest = nodes[ conn.dest ];
			
			var style = {
				"source_pole": "wf_output_pole",
				"dest_pole": "wf_input_pole",
				"start_dir": "right",
				"end_dir": "left",
				"custom": { 
					"strokeStyle": "rgba(128,130,132,0.6)" 
					// strokeStyle: app.getCSSVar('--icon-color')
				}
			};
			
			if (dest.type == 'limit') {
				style.source_pole = 'wf_down_pole';
				style.dest_pole = 'wf_up_pole';
				style.start_dir = 'bottom';
				style.end_dir = 'top';
				style.custom.lineDash = [4, 4];
			}
			// else if (source.type == 'trigger') {
			// 	var trigger = find_object( self.event.triggers, { id: source.id } );
			// 	if (trigger && trigger.enabled) style.custom = { strokeStyle: app.getCSSVar('--orange') };
			// }
			
			self.renderWFConnection({
				conn: conn,
				ctx: ctx,
				sel1: `#d_wfn_${source.id} .${style.source_pole}`,
				sel2: `#d_wfn_${dest.id} .${style.dest_pole}`,
				start_dir: style.start_dir,
				end_dir: style.end_dir,
				custom: style.custom || {}
			});
		});
		
		ctx.restore();
	}
	
	getWFPoleCenterPoint(sel) {
		// get x/y coords of center of pole, relative to canvas origin
		var el = $(sel)[0];
		var x = el.offsetWidth / 2;
		var y = el.offsetHeight / 2;
		
		while (el.id != 'd_wf_container') {
			x += el.offsetLeft;
			y += el.offsetTop;
			el = el.offsetParent;
			if (!el) break; // sanity
		}
		
		return [ x + 1, y + 1 ];
	}
	
	prepWFCondition(trig, sel1, sel2) {
		// position condition element in place between two poles
		var a = this.getWFPoleCenterPoint(sel1);
		var b = this.getWFPoleCenterPoint(sel2);
		var c = [
			a[0] + ((b[0] - a[0]) / 2),
			a[1] + ((b[1] - a[1]) / 2),
		];
		
		$(trig).css({
			left: '' + Math.floor(c[0] - 16) + 'px',
			top: '' + Math.floor(c[1] - 16) + 'px'
		});
	}
	
	renderWFConnection(opts) {
		// draw one bezier spline connection between two poles
		var { sel1, sel2, start_dir, end_dir, custom, ctx } = opts;
		
		var a = this.getWFPoleCenterPoint(sel1);
		var b = this.getWFPoleCenterPoint(sel2);
		var mid = [
			a[0] + ((b[0] - a[0]) / 2),
			a[1] + ((b[1] - a[1]) / 2),
		];
		
		ctx.save();
		if (opts.custom) {
			if (opts.custom.lineDash) {
				ctx.setLineDash(opts.custom.lineDash);
				delete opts.custom.lineDash;
			}
			for (var key in opts.custom) {
				ctx[key] = opts.custom[key];
			}
		}
		
		ctx.beginPath();
		ctx.moveTo( a[0], a[1] );
		
		if ((start_dir == 'right') && (end_dir == 'left') && (b[0] < a[0])) {
			var mult = 0.5 + ((Math.min( a[0] - b[0], 500 ) / 500) * 0.5);
			this.drawWFLine({ a: a, b: mid, start_dir: 'right', end_dir: 'right', mult, custom, ctx });
			this.drawWFLine({ a: mid, b: b, start_dir: 'left', end_dir: 'left', mult, custom, ctx });
		}
		else if ((start_dir == 'bottom') && (end_dir == 'top') && (b[1] < a[1])) {
			var mult = 0.5 + ((Math.min( a[1] - b[1], 500 ) / 500) * 0.5);
			this.drawWFLine({ a: a, b: mid, start_dir: 'bottom', end_dir: 'bottom', mult, custom, ctx });
			this.drawWFLine({ a: mid, b: b, start_dir: 'top', end_dir: 'top', mult, custom, ctx });
		}
		else {
			this.drawWFLine({ a, b, start_dir, end_dir, custom, ctx });
		}
		
		ctx.stroke();
		ctx.restore();
		
		if (opts.conn && opts.conn.condition) {
			this.prepWFCondition( '#d_wft_' + opts.conn.id, sel1, sel2 );
		}
	}
	
	drawWFLine(opts) {
		// draw one bezier spline connection between two poles
		var { a, b, start_dir, end_dir, ctx } = opts;
		
		var dist = distance(a, b);
		
		var start_offset_x = 0;
		var start_offset_y = 0;
		var end_offset_x = 0;
		var end_offset_y = 0;
		var mult = opts.mult || 0.25;
		
		switch (start_dir) {
			case 'left': start_offset_x = dist * (mult * -1); break;
			case 'right': start_offset_x = dist * mult; break;
			case 'top': start_offset_y = dist * (mult * -1); break;
			case 'bottom': start_offset_y = dist * mult; break;
		}
		switch (end_dir) {
			case 'left': end_offset_x = dist * (mult * -1); break;
			case 'right': end_offset_x = dist * mult; break;
			case 'top': end_offset_y = dist * (mult * -1); break;
			case 'bottom': end_offset_y = dist * mult; break;
		}
		
		ctx.bezierCurveTo(
			a[0] + start_offset_x,
			a[1] + start_offset_y,
			b[0] + end_offset_x,
			b[1] + end_offset_y,
			b[0],
			b[1]
		);
	}
	
	//
	// Param Editor Tools
	//
	
	renderParamEditor() {
		// render plugin param editor
		if (!this.active) return; // sanity
		
		var html = this.getParamsTable();
		this.div.find('#d_params_table').html( html );
		
		this.setupDraggableGrid({
			table_sel: this.div.find('#d_params_table div.data_grid'), 
			handle_sel: 'div.td_drag_handle', 
			drag_ghost_sel: 'div:nth-child(2)', 
			drag_ghost_x: 5, 
			drag_ghost_y: 10, 
			callback: this.moveParam.bind(this)
		});
	}
	
	getParamsTable() {
		// get html for params table
		var self = this;
		var html = '';
		var rows = this.params;
		var cols = ['<i class="mdi mdi-menu"></i>', 'Label', 'Type', 'Description', 'Actions'];
		var add_link = '<div class="button small secondary" onClick="$P().editParam(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i>New Param...</div>';
		
		if (!rows.length) return add_link;
		
		var targs = {
			rows: rows,
			cols: cols,
			data_type: 'param',
			class: 'data_grid',
			empty_msg: add_link,
			always_append_empty_msg: true,
			grid_template_columns: '40px auto auto auto auto'
		};
		
		html += this.getCompactGrid(targs, function(item, idx) {
			var actions = [];
			actions.push( '<span class="link" onClick="$P().editParam('+idx+')"><b>Edit</b></span>' );
			actions.push( '<span class="link danger" onClick="$P().deleteParam('+idx+')"><b>Delete</b></span>' );
			
			var nice_type = config.ui.control_type_labels[item.type];
			var nice_icon = config.ui.control_type_icons[item.type];
			var nice_label_icon = item.locked ? 'lock' : 'cube-outline';
			
			var param = item;
			var pairs = [];
			switch (param.type) {
				case 'text':
					if (param.value.length) pairs.push([ 'Default', '&ldquo;' + param.value + '&rdquo;' ]);
					else pairs.push([ "(No default)" ]);
				break;
				
				case 'textarea':
					if (param.value.length) pairs.push([ 'Default', '(' + param.value.length + ' chars)' ]);
					else pairs.push([ "(No default)" ]);
				break;
				
				case 'code':
					if (param.value.length) pairs.push([ 'Default', '(' + param.value.length + ' chars)' ]);
					else pairs.push([ "(No default)" ]);
				break;
				
				case 'checkbox':
					pairs.push([ 'Default', param.value ? 'Checked' : 'Unchecked' ]);
					if (!param.value) nice_icon = 'checkbox-blank-outline';
				break;
				
				case 'hidden':
					pairs.push([ 'Value', '&ldquo;' + param.value + '&rdquo;' ]);
				break;
				
				case 'select':
					pairs.push([ 'Items', '(' + param.value + ')' ]);
				break;
			}
			for (var idy = 0, ley = pairs.length; idy < ley; idy++) {
				if (pairs[idy].length == 2) pairs[idy] = '<b>' + pairs[idy][0] + ':</b> ' + pairs[idy][1];
				else pairs[idy] = pairs[idy][0];
			}
			
			return [
				// '<div class="td_big mono">' + item.id + '</div>',
				'<div class="td_drag_handle" draggable="true" title="Drag to reorder"><i class="mdi mdi-menu"></i></div>',
				'<div class="td_big ellip" title="ID: ' + item.id + '"><i class="mdi mdi-' + nice_label_icon + '">&nbsp;</i><span class="link" onClick="$P().editParam('+idx+')">' + item.title + '</span></div>',
				'<div class="ellip"><i class="mdi mdi-' + nice_icon + '">&nbsp;</i>' + nice_type + '</div>',
				'<div class="ellip">' + pairs.join(', ') + '</div>',
				'<div class="">' + actions.join(' | ') + '</div>'
			];
		} ); // getCompactGrid
		
		return html;
	}
	
	moveParam($rows) {
		// user completed a drag-drop reorder op
		var self = this;
		var params = [];
		
		$rows.each( function(idx) {
			var $row = $(this);
			var id = $row.data('id');
			params.push( find_object( self.params, { id: id } ) );
		});
		
		// replace contents of array without replacing the array itself
		this.params.length = 0;
		this.params.push( ...params );
		
		// prevent ghost hover bug in safari
		$(document).one( 'mousemove', function() { self.renderParamEditor(); } );
	}
	
	editParam(idx) {
		// show dialog to configure param
		var self = this;
		var param = (idx > -1) ? this.params[idx] : { type: 'text', value: '' };
		var title = (idx > -1) ? "Editing Parameter" : "New Parameter";
		var btn = (idx > -1) ? ['check-circle', "Apply"] : ['plus-circle', "Add Param"];
		
		// prepare control type menu
		var ctypes = (this.controlTypes || Object.keys(config.ui.control_type_labels)).map (function(key) { 
			return { 
				id: key, 
				title: config.ui.control_type_labels[key],
				icon: config.ui.control_type_icons[key]
			}; 
		} );
		sort_by( ctypes, 'title' );
		
		var html = '<div class="dialog_box_content">';
		
		// id
		html += this.getFormRow({
			label: 'Param ID:',
			content: this.getFormText({
				id: 'fe_epa_id',
				class: 'monospace',
				spellcheck: 'false',
				readonly: 'readonly', // safari hack for stupid autofill nonsense
				onFocus: "this.removeAttribute('readonly')",
				value: param.id
			}),
			caption: 'Enter a unique ID for the parameter (alphanumerics only).'
		});
		
		// label
		html += this.getFormRow({
			label: 'Label:',
			content: this.getFormText({
				id: 'fe_epa_title',
				spellcheck: 'false',
				value: param.title
			}),
			caption: 'Enter a label for the parameter, for display purposes.'
		});
		
		// type
		html += this.getFormRow({
			label: 'Control Type:',
			content: this.getFormMenuSingle({
				id: 'fe_epa_type',
				title: 'Select Control Type',
				options: ctypes,
				value: param.type
			}),
			caption: 'Select the desired control type for the parameter.'
		});
		
		// type-specific
		html += this.getFormRow({
			id: 'd_epa_value_text',
			label: 'Default Value:',
			content: this.getFormText({
				id: 'fe_epa_value_text',
				spellcheck: 'false',
				value: param.value || ''
			}),
			caption: 'Enter the default value for the text field.'
		});
		html += this.getFormRow({
			id: 'd_epa_value_textarea',
			label: 'Default Value:',
			content: this.getFormTextarea({
				id: 'fe_epa_value_textarea',
				rows: 5,
				spellcheck: 'false',
				value: (param.value || '').toString()
			}),
			caption: "Enter the default value for the text box."
		});
		html += this.getFormRow({
			id: 'd_epa_value_code',
			label: 'Default Value:',
			content: this.getFormTextarea({
				id: 'fe_epa_value_code',
				rows: 5,
				class: 'monospace',
				spellcheck: 'false',
				value: (param.value || '').toString()
			}),
			caption: "Enter the default value for the code editor."
		});
		html += this.getFormRow({
			id: 'd_epa_value_checkbox',
			label: 'Default State:',
			content: this.getFormCheckbox({
				id: 'fe_epa_value_checkbox',
				label: 'Checked',
				checked: !!param.value
			}),
			caption: 'Select the default state for the checkbox.'
		});
		html += this.getFormRow({
			id: 'd_epa_value_select',
			label: 'Menu Items:',
			content: this.getFormText({
				id: 'fe_epa_value_select',
				spellcheck: 'false',
				value: param.value || ''
			}),
			caption: "Enter items for the menu, separated by commas.  The first will be selected by default."
		});
		html += this.getFormRow({
			id: 'd_epa_value_hidden',
			label: 'Default Value:',
			content: this.getFormText({
				id: 'fe_epa_value_hidden',
				spellcheck: 'false',
				value: param.value || ''
			}),
			caption: 'Enter the default value for the hidden field.'
		});
		
		// admin lock
		html += this.getFormRow({
			label: 'Security:',
			content: this.getFormCheckbox({
				id: 'fe_epa_locked',
				label: 'Administrator Locked',
				checked: !!param.locked
			}),
			caption: 'Check this box to disallow changes from the event editor and API (except for administrators).'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			Dialog.hide();
			
			param.id = $('#fe_epa_id').val();
			param.title = $('#fe_epa_title').val();
			param.type = $('#fe_epa_type').val();
			param.locked = !!$('#fe_epa_locked').is(':checked');
			
			switch (param.type) {
				case 'text':
					param.value = $('#fe_epa_value_text').val();
				break;
				
				case 'textarea':
					param.value = $('#fe_epa_value_textarea').val();
				break;
				
				case 'code':
					param.value = $('#fe_epa_value_code').val();
				break;
				
				case 'checkbox':
					param.value = !!$('#fe_epa_value_checkbox').is(':checked');
				break;
				
				case 'select':
					param.value = $('#fe_epa_value_select').val();
				break;
				
				case 'hidden':
					param.value = $('#fe_epa_value_hidden').val();
				break;
			} // switch action.type
			
			// see if we need to add or replace
			if (idx == -1) {
				self.params.push(param);
			}
			
			// self.dirty = true;
			self.renderParamEditor();
		} ); // Dialog.confirm
		
		var change_param_type = function(new_type) {
			$('#d_epa_value_text, #d_epa_value_textarea, #d_epa_value_code, #d_epa_value_checkbox, #d_epa_value_select, #d_epa_value_hidden').hide();
			$('#d_epa_value_' + new_type).show();
			Dialog.autoResize();
		}; // change_action_type
		
		change_param_type(param.type);
		
		$('#fe_epa_type').on('change', function() {
			change_param_type( $(this).val() );
		}); // type change
		
		if (idx == -1) $('#fe_epa_id').focus();
		
		SingleSelect.init( $('#fe_epa_type') );
		Dialog.autoResize();
	}
	
	deleteParam(idx) {
		// delete selected param
		this.params.splice( idx, 1 );
		this.renderParamEditor();
	}
	
	getParamEditor(fields, params) {
		// get HTML for generic param editor
		// { "id":"script", "type":"textarea", "title":"Script Source", "value": "#!/bin/sh\n\n# Enter your shell script code here" },
		var self = this;
		var html = '';
		
		if (!fields || !fields.length) return '(No configurable parameters defined.)';
		
		fields.forEach( function(param) {
			var elem_id = 'fe_uf_' + param.id;
			var elem_value = (param.id in params) ? params[param.id] : param.value;
			var elem_dis = (param.locked && !app.isAdmin()) ? 'disabled' : undefined; 
			if (param.type == 'hidden') return;
			
			if (param.type != 'checkbox') html += '<div class="info_label">' + param.title + '</div>';
			html += '<div class="info_value">';
			
			switch (param.type) {
				case 'text':
					html += self.getFormText({ id: elem_id, value: elem_value, disabled: elem_dis, readonly: 'readonly', onFocus: "this.removeAttribute('readonly')" });
				break;
				
				case 'code':
					// html += self.getFormTextarea({ id: elem_id, value: elem_value, rows: 5, class: 'monospace', disabled: elem_dis });
					html += self.getFormTextarea({ id: elem_id, value: elem_value, rows: 1, disabled: elem_dis, style: 'display:none', 'data-title': param.title });
					if (elem_dis) {
						html += '<div class="button small secondary" onClick="$P().viewParamCode(\'' + param.id + '\')">View Code...</div>';
					}
					else {
						html += '<div class="button small secondary" onClick="$P().editParamCode(\'' + param.id + '\')">Edit Code...</div>';
					}
				break;
				
				case 'textarea':
					html += self.getFormTextarea({ id: elem_id, value: elem_value, rows: 5, disabled: elem_dis });
				break;
				
				case 'checkbox':
					html += self.getFormCheckbox({ id: elem_id, label: param.title, checked: !!elem_value, disabled: elem_dis });
				break;
				
				case 'select':
					elem_value = (param.id in params) ? params[param.id] : param.value.replace(/\,.*$/, '');
					html += self.getFormMenu({ id: elem_id, value: elem_value, options: param.value.split(/\,\s*/), disabled: elem_dis });
				break;
			} // switch type
			
			html += '</div>';
		} ); // foreach param
		
		return html;
	}
	
	viewParamCode(param_id) {
		// show param code (no editing)
		var elem_id = 'fe_uf_' + param_id;
		var elem_value = $('#' + elem_id).val();
		var title = $('#' + elem_id).data('title');
		
		this.viewCodeAuto(title, elem_value);
	}
	
	editParamCode(param_id) {
		// open editor for code plugin param
		var elem_id = 'fe_uf_' + param_id;
		var elem_value = $('#' + elem_id).val();
		var title = $('#' + elem_id).data('title');
		
		this.editCodeAuto(title, elem_value, function(new_value) {
			$('#' + elem_id).val( new_value );
		});
	}
	
	getParamValues(fields) {
		// get all values for params hash
		var params = {};
		var is_valid = true;
		if (!fields || !fields.length) return {}; // none defined
		
		fields.forEach( function(param) {
			if (param.type == 'hidden') params[ param.id ] = param.value;
			else if (param.type == 'checkbox') params[ param.id ] = !!$('#fe_uf_' + param.id).is(':checked');
			else {
				params[ param.id ] = $('#fe_uf_' + param.id).val();
				if (param.required && !params[ param.id ].length) {
					app.badField('#fe_uf_' + param.id, "The &ldquo;" + param.title + "&rdquo; field is required.");
					is_valid = false;
				}
			}
		});
		
		return is_valid ? params : false;
	}
	
	getTriggerDisplayArgs(item) {
		// prep trigger item for display
		var nice_icon = '';
		var alt_icon = '';
		var nice_type = '';
		var alt_type = '';
		var nice_desc = '';
		var short_desc = '';
		
		var menu_item = find_object( config.ui.event_trigger_type_menu, { id: item.type } );
		if (menu_item) alt_icon = menu_item.icon;
		
		switch (item.type) {
			case 'schedule':
				nice_icon = '<i class="mdi mdi-calendar-clock"></i>';
				nice_type = 'Schedule';
				short_desc = summarize_event_timing(item);
				nice_desc = '<i class="mdi mdi-update">&nbsp;</i><b>Recurring:</b> ' + short_desc;
				
				// find actual sub-type based on schedule trigger params
				var trigger = item;
				var tmode = 'hourly';
				if (trigger.years && trigger.years.length) tmode = 'custom';
				else if (trigger.months && trigger.months.length && trigger.weekdays && trigger.weekdays.length) tmode = 'custom';
				else if (trigger.days && trigger.days.length && trigger.weekdays && trigger.weekdays.length) tmode = 'custom';
				else if (trigger.months && trigger.months.length) tmode = 'yearly';
				else if (trigger.weekdays && trigger.weekdays.length) tmode = 'weekly';
				else if (trigger.days && trigger.days.length) tmode = 'monthly';
				else if (trigger.hours && trigger.hours.length) tmode = 'daily';
				else if (trigger.minutes && trigger.minutes.length) tmode = 'hourly';
				
				menu_item = find_object( config.ui.event_trigger_type_menu, { id: tmode } );
				alt_icon = menu_item.icon;
			break;
			
			case 'continuous':
				nice_icon = '<i class="mdi mdi-calendar-clock"></i>';
				nice_type = 'Schedule';
				nice_desc = '<i class="mdi mdi-all-inclusive">&nbsp;</i>Run Continuously';
				short_desc = "Continuous";
			break;
			
			case 'single':
				nice_icon = '<i class="mdi mdi-calendar-clock"></i>';
				nice_type = 'Schedule';
				short_desc = summarize_event_timing(item);
				nice_desc = '<i class="mdi mdi-alarm-check">&nbsp;</i><b>Single Shot:</b> ' + short_desc;
			break;
			
			case 'manual':
				nice_icon = '<i class="mdi mdi-gesture-tap-button"></i>';
				nice_type = 'On-Demand';
				nice_desc = '<i class="mdi mdi-run-fast">&nbsp;</i>Manual Run';
				short_desc = "Manual Run";
			break;
			
			case 'catchup':
				nice_icon = '<i class="mdi mdi-cog-outline"></i>';
				nice_type = alt_type = 'Option';
				nice_desc = '<i class="mdi mdi-calendar-refresh-outline">&nbsp;</i>Catch-Up';
				short_desc = "Catch-Up";
			break;
			
			case 'range':
				nice_icon = '<i class="mdi mdi-cog-outline"></i>';
				nice_type = 'Option';
				alt_type = 'Range';
				short_desc = (item.start && item.end) ? get_text_from_seconds( item.end - item.start, true, true ) : this.summarizeTimingRange(item);
				nice_desc = '<i class="mdi mdi-calendar-range-outline">&nbsp;</i><b>Range:</b> ' + this.summarizeTimingRange(item);
			break;
			
			case 'blackout':
				nice_icon = '<i class="mdi mdi-cog-outline"></i>';
				nice_type = 'Option';
				alt_type = 'Blackout';
				short_desc = (item.start && item.end) ? get_text_from_seconds( item.end - item.start, true, true ) : this.summarizeTimingRange(item);
				nice_desc = '<i class="mdi mdi-circle">&nbsp;</i><b>Blackout:</b> ' + this.summarizeTimingRange(item);
			break;
			
			case 'delay':
				nice_icon = '<i class="mdi mdi-cog-outline"></i>';
				nice_type = 'Option';
				alt_type = 'Delay';
				short_desc = get_text_from_seconds(item.duration || 0, false, true);
				nice_desc = '<i class="mdi mdi-chat-sleep-outline">&nbsp;</i><b>Delay:</b> ' + short_desc;
			break;
			
			case 'precision':
				nice_icon = '<i class="mdi mdi-cog-outline"></i>';
				nice_type = 'Precision';
				alt_type = 'Precision';
				short_desc = 'On the minute';
				if (item.seconds && item.seconds.length) short_desc = item.seconds.map( sec => ':' + zeroPad(sec, 2) ).join(', ');
				nice_desc = '<i class="mdi mdi-progress-clock">&nbsp;</i><b>Seconds:</b> ' + short_desc;
			break;
			
			case 'plugin':
				nice_icon = '<i class="mdi mdi-power-plug"></i>';
				nice_type = 'Plugin';
				nice_desc = this.getNicePlugin(item.plugin_id);
				var plugin = find_object( app.plugins, { id: item.plugin_id } ) || { title: item.plugin_id };
				short_desc = plugin.title;
				alt_icon = plugin.icon || menu_item.icon;
			break;
		} // switch item.type
		
		return { nice_icon, nice_type, alt_type, nice_desc, alt_icon, short_desc };
	}
	
	summarizeTimingRange(trigger) {
		// summarize date/time range, or single start/end
		var text = '';
		var tz = trigger.timezone || app.config.tz;
		var opts = this.getDateOptions({
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			timeZone: tz
		});
		var formatter = new Intl.DateTimeFormat(opts.locale, opts);
		
		if (trigger.start && trigger.end) {
			// full range
			text = formatter.formatRange( new Date(trigger.start * 1000), new Date(trigger.end * 1000) );
		}
		else if (trigger.start) {
			// start only
			text = "Start on " + formatter.format( new Date(trigger.start * 1000) );
		}
		else if (trigger.end) {
			// end only
			text = "End on " + formatter.format( new Date(trigger.end * 1000) );
		}
		else return "n/a";
		
		// show timezone if it differs from user's current
		var ropts = Intl.DateTimeFormat().resolvedOptions();
		var user_tz = app.user.timezone || ropts.timeZone;
		if (user_tz != tz) text += ' (' + tz + ')';
		
		return text;
	}
	
};
