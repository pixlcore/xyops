// Page Utilities

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.PageUtils = class PageUtils extends Page.Base {
	
	setupEditTriggers() {
		// rig all form elements to triger save button highlight
		this.div.find('input, textarea, select').on('change', this.triggerEditChange.bind(this));
		this.div.find('input, textarea').on('input', this.triggerEditChange.bind(this));
		if (this.editor) this.editor.on('change', this.triggerEditChange.bind(this));
		
		// if page is in rollback draft mode, trigger the button right away
		if (this.args.rollback) this.triggerEditChange();
	}
	
	triggerEditChange() {
		// highlight save button
		var $btn = $('.button.save');
		if ($btn.length && !$btn.hasClass('primary')) {
			$btn.addClass('primary pulse');
			setTimeout( function() { $btn.removeClass('pulse'); }, 1000 );
			$('.button.cancel > span').html( config.ui.buttons.cancel );
		}
	}
	
	triggerSaveComplete() {
		// remove highlight on save button
		$('.button.save').removeClass('primary pulse');
		$('.button.cancel > span').html( config.ui.buttons.close );
	}
	
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
							'data-shrinkwrap': 1,
							'data-private': 1
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
		if (keywords.length) query += ' keywords:' + keywords.join(' '); // AND
		
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
		if (obj_key.match(/^(secret|bucket)$/)) btn = '&nbsp;';
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
			
			var diff_html = this.getDiffHTML( old_obj, new_obj ) || '(No changes)';
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
		
		html += '<div class="code_viewer scroll_shadows">';
		html += '<div class="markdown-body">';
		
		html += marked.parse(md, config.ui.marked_config);
		
		html += '</div>'; // markdown-body
		html += '</div>'; // code_viewer
		
		var buttons_html = "";
		buttons_html += '<div class="button mobile_collapse" onClick="Dialog.hide()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
		buttons_html += '<div class="button mobile_collapse" onClick="$P().copyExportToClipboard()"><i class="mdi mdi-clipboard-text-outline">&nbsp;</i><span>Copy to Clipboard</span></div>';
		// buttons_html += '<div class="button secondary mobile_collapse" onClick="$P().copyExportToAPITool()"><i class="mdi mdi-send">&nbsp;</i><span>Copy to API Tool...</span></div>';
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
			description: "xyOps Portable Data Object",
			version: "1.0",
			type: opts.dataType,
			data: opts.data
		};
		var payload = JSON.stringify(json, null, "\t") + "\n";
		var filename = 'xyops-' + opts.dataType + '-' + opts.data.id + '.json';
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
	
	// Chart Size Selector
	
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
		
		// pre-scan events for plugin-based and continuous scheduler modes
		var extra_rows = [];
		
		events.forEach( function(event) {
			var plugin_trigger = find_object( event.triggers, { type: 'plugin', enabled: true } );
			if (plugin_trigger) {
				extra_rows.push({
					event: event.id,
					type: 'plugin',
					plugin: plugin_trigger.plugin_id
				});
				return;
			}
			
			var cont_trigger = find_object( event.triggers, { type: 'continuous', enabled: true } );
			if (cont_trigger) {
				extra_rows.push({
					event: event.id,
					type: 'continuous'
				});
				return;
			}
		} ); // foreach event
		
		var opts = {
			events: events,
			duration: 86400 * 32,
			burn: 16,
			max: 1000,
			progress: null,
			callback: function(jobs) {
				self.upcomingJobs = [ ...extra_rows, ...jobs ];
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
			var type_info = find_object( config.ui.event_trigger_type_menu, { id: job.type } ) || { title: "Scheduler", icon: 'update' };
			var nice_source = `<i class="mdi mdi-${type_info.icon}">&nbsp;</i>${type_info.title}`;
			var event = find_object( app.events, { id: job.event } ) || {};
			var precision = event.triggers ? find_object(event.triggers, { type: 'precision', enabled: true }) : null;
			var nice_date_time = '';
			var nice_countdown = '';
			var nice_skip = '';
			
			if (job.type == 'plugin') {
				// special phantom row, for plugin-based schedules
				var plugin = find_object( app.plugins, { id: job.plugin } ) || { title: job.plugin };
				nice_source = `<i class="mdi mdi-${plugin.icon || 'power-plug'}">&nbsp;</i>${plugin.title}`;
				nice_date_time = '(Unknown)';
				nice_countdown = '(Unknown)';
				nice_skip = 'n/a';
			}
			else if (job.type == 'continuous') {
				// special phantom row, for continuously running events
				nice_date_time = '(Continuous)';
				nice_countdown = 'n/a';
				nice_skip = 'n/a';
			}
			else {
				// optionally vary date/time prediction display based on precision or interval
				var countdown = 0;
				
				if (precision && precision.seconds && precision.seconds.length) {
					job.seconds = precision.seconds;
				}
				
				if (job.seconds) {
					// precision or interval job
					nice_date_time = self.getRelativeDateTime( job.epoch + job.seconds[0], true );
					if (job.seconds.length > 1) nice_date_time += ' (+' + Math.floor(job.seconds.length - 1) + ')';
					countdown = Math.max( 60, Math.abs((job.epoch + job.seconds[0]) - app.epoch) );
				}
				else {
					// normal scheduled job
					nice_date_time = self.getRelativeDateTime( job.epoch );
					countdown = Math.max( 60, Math.abs(job.epoch - app.epoch) );
				}
				
				nice_countdown = '<i class="mdi mdi-clock-outline">&nbsp;</i>' + get_text_from_seconds_round( countdown );
				nice_skip = '<span class="link danger" onClick="$P().doSkipUpcomingJob(' + idx + ')"><b>Skip Job...</b></span>';
			}
			
			var tds = [
				'<b>' + self.getNiceEvent(job.event, true) + '</b>',
				self.getNiceCategory(event.category, true),
				self.getNiceTargetList(event.targets),
				nice_source,
				nice_date_time,
				nice_countdown,
				nice_skip
			];
			
			if (event.category) {
				var category = find_object( app.categories, { id: event.category } );
				if (category && category.color) tds.className = 'clr_' + category.color;
			}
			
			return tds;
		} );
		
		this.div.find('#d_upcoming_jobs > .box_content').removeClass('loading').html(html);
		
		// fire hook for pages to intercept and render additional UI (i.e. event view page)
		if (this.onAfterRenderUpcomingJobs) this.onAfterRenderUpcomingJobs();
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
				
				// fire hook for pages to intercept and render additional UI (i.e. event view page)
				if (self.onAfterSkipUpcomingJob) self.onAfterSkipUpcomingJob();
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
	
	// Job History Day Graph
	
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
		else html += `<div class="empty" data-date="${day_code}" data-epoch="${epoch}" title="No data for ${nice_date}"></div>`;
		
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
	
	// Alert History Day Graph
	
	setupAlertHistoryDayGraph() {
		// fetch historical alert stats and render as heatmap grid
		var self = this;
		var opts = {
			offset: -365,
			limit: 365,
			path: 'currentDay',
			key_prefix: 'alert_',
			current_day: 1
		};
		
		if (this.alert) opts.path += '.alerts.' + this.alert.id;
		else if (this.server) opts.path += '.servers.' + this.server.id;
		else if (this.group) opts.path += '.groups.' + this.group.id;
		else opts.path += '.transactions';
		
		app.api.get( 'app/search_stat_history', opts, this.receiveAlertHistoryDayGraph.bind(this) );
	}
	
	getAlertHistoryDaySwatch(day, epoch) {
		// get HTML for single day history swatch (grid unit)
		var html = '';
		var day_code = yyyy_mm_dd(epoch);
		var nice_date = this.formatDate(epoch, { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });
		
		if (day && day.data) {
			var data = day.data;
			var num_alerts = data.alert_new || 0;
			var tooltip = nice_date + ": " + commify(num_alerts) + " " + pluralize('alert', num_alerts);
			
			var color = '';
			if (num_alerts > 8) color = 'purple';
			else if (num_alerts > 4) color = 'red';
			else if (num_alerts > 2) color = 'orange';
			else if (num_alerts > 0) color = 'yellow';
			else color = 'green';
			
			// search link
			var alt_code = day_code.replace(/\//g, '-');
			var url = `#Alerts?date=custom&start=${alt_code}&end=${alt_code}`;
			if (this.alert) url += '&alert=' + this.alert.id;
			else if (this.server) url += '&server=' + this.server.id;
			else if (this.group) url += '&groups=' + this.group.id;
			
			html += `<div style="background:var(--${color});" data-date="${day_code}" onClick="Nav.go('${url}')" title="${tooltip}"></div>`;
		}
		else {
			html += `<div class="empty" data-date="${day_code}" data-epoch="${epoch}" title="No data for ${nice_date}"></div>`;
		}
		
		return html;
	}
	
	receiveAlertHistoryDayGraph(resp) {
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
			html += this.getAlertHistoryDaySwatch(day, epoch);
			epoch += 86400;
		} // foreach day
		
		html += '</div>';
		
		this.div.find('#d_alert_day_graph').show().find('> .box_content').removeClass('loading').html(html);
	}
	
	// Resource Limit Editor and Table:
	
	renderResLimitEditor() {
		// render res limit editor
		var dom_prefix = this.dom_prefix;
		var html = this.getResLimitTable();
		this.div.find('#d_' + dom_prefix + '_reslim_table').html( html );
	}
	
	getResLimitDisplayArgs(item) {
		// get nice title and description for resource limit
		var nice_title = '';
		var nice_desc = '';
		var short_desc = '';
		var icon = 'gauge';
		
		switch (item.type) {
			case 'mem':
				nice_title = "Max Memory";
				nice_desc = get_text_from_bytes(item.amount) + " for " + get_text_from_seconds(item.duration, false, true);
				short_desc = get_text_from_bytes(item.amount);
				icon = 'memory';
			break;
			
			case 'cpu':
				nice_title = "Max CPU %";
				nice_desc = item.amount + "% for " + get_text_from_seconds(item.duration, false, true);
				short_desc = item.amount + '%';
				icon = 'chip';
			break;
			
			case 'log':
				nice_title = "Max Log Size";
				nice_desc = short_desc = get_text_from_bytes(item.amount);
				icon = 'file-remove-outline';
			break;
			
			case 'time':
				nice_title = "Max Run Time";
				nice_desc = get_text_from_seconds(item.duration, false, false);
				short_desc = get_text_from_seconds(item.duration, true, false);
				icon = 'timer-remove-outline';
			break;
			
			case 'job':
				nice_title = "Max Jobs";
				if (!item.amount) nice_desc = short_desc = "Unlimited";
				else {
					nice_desc = "Up to " + commify(item.amount) + " concurrent " + pluralize("job", item.amount);
					short_desc = commify(item.amount) + ' ' + pluralize("job", item.amount);
				}
				icon = 'traffic-light-outline';
			break;
			
			case 'retry':
				nice_title = "Max Retries";
				if (!item.amount) {
					nice_desc = "No retries will be attempted";
					short_desc = "None";
				}
				else {
					nice_desc = short_desc = "Up to " + commify(item.amount);
					if (item.duration) nice_desc += " (" + get_text_from_seconds(item.duration, false, true) + " delay)";
				}
				icon = 'redo-variant';
			break;
			
			case 'queue':
				nice_title = "Max Queue";
				if (!item.amount) {
					nice_desc = "No jobs allowed in queue";
					short_desc = "None";
				}
				else {
					nice_desc = "Up to " + commify(item.amount) + " " + pluralize("job", item.amount) + " allowed in queue";
					short_desc = commify(item.amount) + ' ' + pluralize("job", item.amount);
				}
				icon = 'tray-full';
			break;
			
			case 'file':
				nice_title = "Max Files";
				if (!item.amount) {
					nice_desc = "No files allowed";
					short_desc = "None";
				}
				else {
					nice_desc = "Up to " + commify(item.amount) + " " + pluralize("file", item.amount);
					if (item.size) nice_desc += " (" + get_text_from_bytes(item.size) + " total)";
					
					short_desc = commify(item.amount) + ' ' + pluralize("file", item.amount);
					if (item.size) short_desc += ", " + get_text_from_bytes(item.size);
				}
				icon = 'file-multiple-outline';
			break;
		} // switch item.type
		
		return { nice_title, nice_desc, short_desc, icon };
	}
	
	getResLimitTable() {
		// get html for resource limit table
		var self = this;
		var html = '';
		var rows = this.limits;
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Limit', 'Description', 'Actions'];
		var add_link = '<div class="button small secondary" onClick="$P().editResLimit(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i>New Limit...</div>';
		
		if (!rows.length) return add_link;
		
		var targs = {
			rows: rows,
			cols: cols,
			data_type: 'limit',
			class: 'data_grid c_limit_grid',
			empty_msg: add_link,
			grid_template_columns: '40px auto auto auto'
		};
		
		if (rows.length && (rows.length < 7)) {
			targs.always_append_empty_msg = true;
		}
		
		html += this.getCompactGrid(targs, function(item, idx) {
			var actions = [];
			actions.push( '<span class="link" onClick="$P().editResLimit('+idx+')"><b>Edit</b></span>' );
			actions.push( '<span class="link danger" onClick="$P().deleteResLimit('+idx+')"><b>Delete</b></span>' );
			
			var { nice_title, nice_desc, icon } = self.getResLimitDisplayArgs(item);
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggleResLimitEnabled(this,' + idx + ')'
				}) + '</div>',
				'<div class="td_big nowrap"><span class="link" onClick="$P().editResLimit('+idx+')"><i class="mdi mdi-' + icon + '"></i>' + nice_title + '</span></div>',
				'<div class="ellip">' + nice_desc + '</div>',
				actions.join(' | ')
			];
			
			if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getCompactGrid
		
		return html;
	}
	
	toggleResLimitEnabled(elem, idx) {
		// toggle res limit checkbox, actually do the enable/disable here, update row
		var item = this.limits[idx];
		item.enabled = !!$(elem).is(':checked');
		
		if (item.enabled) $(elem).closest('ul').removeClass('disabled');
		else $(elem).closest('ul').addClass('disabled');
		
		this.triggerEditChange();
	}
	
	editResLimit(idx) {
		// show dialog to select res limit for event
		// limit: { type, amount?, duration? }
		var self = this;
		var limit = (idx > -1) ? this.limits[idx] : null;
		var title = (idx > -1) ? "Editing Resource Limit" : "New Resource Limit";
		var btn = (idx > -1) ? ['check-circle', "Accept"] : ['plus-circle', "Add Limit"];
		
		if (!limit) {
			if (!find_object(this.limits, { type: 'time' })) limit = { type: 'time' };
			else if (!find_object(this.limits, { type: 'job' })) limit = { type: 'job' };
			else if (!find_object(this.limits, { type: 'log' })) limit = { type: 'log' };
			else if (!find_object(this.limits, { type: 'mem' })) limit = { type: 'mem' };
			else if (!find_object(this.limits, { type: 'cpu' })) limit = { type: 'cpu' };
			else if (!find_object(this.limits, { type: 'retry' })) limit = { type: 'retry' };
			else if (!find_object(this.limits, { type: 'queue' })) limit = { type: 'queue' };
			else if (!find_object(this.limits, { type: 'file' })) limit = { type: 'file' };
			limit.enabled = true;
		}
		
		this.showEditResLimitDialog({
			limit: limit,
			title: title,
			btn: btn,
			
			callback: function(limit) {
				// see if we need to add or replace
				if (idx == -1) self.limits.push(limit);
				
				self.triggerEditChange();
				self.renderResLimitEditor();
			}
		});
	}
	
	showEditResLimitDialog(opts) {
		// show dialog to select res limit
		var self = this;
		var { limit, title, btn, callback } = opts;
		
		var html = '<div class="dialog_box_content scroll maximize">';
		
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_erl_enabled',
				label: 'Limit Enabled',
				checked: limit.enabled
			}),
			caption: 'Enable or disable the resource limit.'
		});
		
		html += this.getFormRow({
			label: 'Limit Type:',
			content: this.getFormMenuSingle({
				id: 'fe_erl_type',
				title: 'Select Limit Type',
				options: config.ui.limit_type_menu,
				value: limit.type
			}),
			caption: 'Select the desired limit type.'
		});
		
		html += this.getFormRow({
			id: 'd_erl_byte_amount',
			label: 'Amount:',
			content: this.getFormRelativeBytes({
				id: 'fe_erl_byte_amount',
				value: limit.amount || 0
			}),
			caption: 'Select the max byte amount for the limit.'
		});
		
		html += this.getFormRow({
			id: 'd_erl_raw_amount',
			label: 'Amount:',
			content: this.getFormText({
				id: 'fe_erl_raw_amount',
				type: 'number',
				spellcheck: 'false',
				maxlength: 32,
				min: 0,
				value: limit.amount || 0
			}),
			caption: '<span id="s_erl_raw_amount_cap"></span>'
		});
		
		html += this.getFormRow({
			id: 'd_erl_duration',
			label: 'Duration:',
			content: this.getFormRelativeTime({
				id: 'fe_erl_duration',
				value: limit.duration || 0
			}),
			caption: '<span id="s_erl_duration_cap"></span>'
		});
		
		html += this.getFormRow({
			id: 'd_erl_file_size',
			label: 'Max File Size:',
			content: this.getFormRelativeBytes({
				id: 'fe_erl_file_size',
				value: limit.size || 0
			}),
			caption: 'Select the maximum allowed file size (total), or 0 for unlimited.'
		});
		
		html += this.getFormRow({
			id: 'd_erl_file_types',
			label: 'File Types:',
			content: this.getFormText({
				id: 'fe_erl_file_types',
				class: 'monospace',
				placeholder: '*',
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 256,
				value: limit.accept || ''
			}),
			caption: 'Optionally limit the accepted file types to a list of file extensions, separated by commas.  The extensions should all begin with a period, and they are case insensitive.'
		});
		
		// tags
		html += this.getFormRow({
			id: 'd_erl_tags',
			label: 'Apply Tags:',
			content: this.getFormMenuMulti({
				id: 'fe_erl_tags',
				title: 'Select Tags',
				placeholder: 'None',
				options: app.tags,
				values: limit.tags || [],
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select which tags should be applied to the job when the limit is triggered.'
		});
		
		// email
		html += this.getFormRow({
			id: 'd_erl_users',
			label: 'Email Users:',
			content: this.getFormMenuMulti({
				id: 'fe_erl_users',
				title: 'Select Users',
				placeholder: 'None',
				options: app.users.map( function(user) {
					return { id: user.username, title: user.full_name, icon: user.icon || '' };
				} ),
				values: limit.users || [],
				default_icon: 'account',
				'data-hold': 1,
				'data-private': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select which users should be emailed when the limit is triggered.'
		});
		html += this.getFormRow({
			id: 'd_erl_email',
			label: 'Extra Recipients:',
			content: this.getFormText({
				id: 'fe_erl_email',
				// type: 'email',
				// multiple: 'multiple',
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 8192,
				placeholder: 'email@sample.com',
				value: limit.email || '',
				'data-private': ''
			}),
			caption: 'Optionally enter one or more additional email addresses for the limit.'
		});
		
		// web hook
		html += this.getFormRow({
			id: 'd_erl_web_hook',
			label: 'Web Hook:',
			content: this.getFormMenuSingle({
				id: 'fe_erl_web_hook',
				title: 'Select Web Hook',
				options: [ ['', '(None)'] ].concat( app.web_hooks ),
				value: limit.web_hook || '',
				default_icon: 'webhook'
			}),
			caption: 'Optionally select a Web Hook to fire when the limit is triggered.'
		});
		html += this.getFormRow({
			id: 'd_erl_web_hook_text',
			label: 'Custom Text:',
			content: this.getFormTextarea({
				id: 'fe_erl_web_hook_text',
				rows: 3,
				class: 'monospace',
				autocomplete: 'off',
				maxlength: 8192,
				value: limit.text || ''
			}),
			caption: 'Optionally enter custom text to be appended to the end of the web hook system message.'
		});
		
		// additional actions (checkboxes)
		html += this.getFormRow({
			id: 'd_erl_actions',
			label: 'Additional Actions:',
			content: 
				'<div style="margin-top:3px;">' + this.getFormCheckbox({ id: 'fe_erl_snapshot', label: 'Snapshot Server', checked: !!limit.snapshot }) + '</div>' + 
				'<div style="margin-top:8px;">' + this.getFormCheckbox({ id: 'fe_erl_abort', label: 'Abort Job', checked: !!limit.abort }) + '</div>',
			caption: 'Optionally take a server snapshot and/or abort the job when the limit is triggered.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			
			limit.enabled = $('#fe_erl_enabled').is(':checked');
			limit.type = $('#fe_erl_type').val();
			delete limit.amount;
			delete limit.duration;
			delete limit.accept;
			
			if (limit.type.match(/^(time|mem|cpu|log)$/)) {
				limit.tags = $('#fe_erl_tags').val();
				limit.users = $('#fe_erl_users').val();
				limit.email = $('#fe_erl_email').val();
				limit.web_hook = $('#fe_erl_web_hook').val();
				limit.text = $('#fe_erl_web_hook_text').val().trim();
				limit.snapshot = $('#fe_erl_snapshot').is(':checked');
				limit.abort = $('#fe_erl_abort').is(':checked');
			}
			
			switch (limit.type) {
				case 'time':
					limit.duration = parseInt( $('#fe_erl_duration').val() );
				break;
				
				case 'mem':
					limit.amount = parseInt( $('#fe_erl_byte_amount').val() );
					limit.duration = parseInt( $('#fe_erl_duration').val() );
				break;
				
				case 'cpu':
					limit.amount = parseInt( $('#fe_erl_raw_amount').val() );
					limit.duration = parseInt( $('#fe_erl_duration').val() );
				break;
				
				case 'log':
					limit.amount = parseInt( $('#fe_erl_byte_amount').val() );
				break;
				
				case 'job':
					limit.amount = parseInt( $('#fe_erl_raw_amount').val() );
				break;
				
				case 'retry':
					limit.amount = parseInt( $('#fe_erl_raw_amount').val() );
					limit.duration = parseInt( $('#fe_erl_duration').val() );
				break;
				
				case 'queue':
					limit.amount = parseInt( $('#fe_erl_raw_amount').val() );
				break;
				
				case 'file':
					limit.amount = parseInt( $('#fe_erl_raw_amount').val() );
					limit.size = parseInt( $('#fe_erl_file_size').val() );
					limit.accept = $('#fe_erl_file_types').val().replace(/[^\w\s\-\.\,]+/g, '').trim().toLowerCase();
				break;
			} // switch limit.type
			
			Dialog.hide();
			callback(limit);
		} ); // Dialog.confirm
		
		var change_limit_type = function(new_type) {
			$('#d_erl_byte_amount, #d_erl_raw_amount, #d_erl_duration, #d_erl_file_size, #d_erl_file_types, #d_erl_tags, #d_erl_users, #d_erl_email, #d_erl_web_hook, #d_erl_web_hook_text, #d_erl_actions').hide();
			
			if (new_type.match(/^(time|mem|cpu|log)$/)) {
				$('#d_erl_tags, #d_erl_users, #d_erl_email, #d_erl_web_hook, #d_erl_web_hook_text, #d_erl_actions').show();
			}
			
			switch (new_type) {
				case 'time':
					$('#d_erl_duration').show();
					$('#s_erl_duration_cap').html('Enter the maximum duration for the time limit.');
				break;
				
				case 'mem':
					$('#d_erl_byte_amount').show();
					$('#d_erl_duration').show();
					$('#s_erl_duration_cap').html('Specify the amount of time the memory must stay over the limit before action is taken.');
				break;
				
				case 'cpu':
					$('#d_erl_raw_amount').show();
					$('#s_erl_raw_amount_cap').html('Enter the maximum CPU precentage for the limit (100 = 1 core maxed).');
					$('#d_erl_duration').show();
					$('#s_erl_duration_cap').html('Specify the amount of time the CPU must stay over the limit before action is taken.');
				break;
				
				case 'log':
					$('#d_erl_byte_amount').show();
				break;
				
				case 'job':
					$('#d_erl_raw_amount').show();
					$('#s_erl_raw_amount_cap').html('Enter the maximum number to concurrent jobs to allow.');
				break;
				
				case 'retry':
					$('#d_erl_raw_amount').show();
					$('#s_erl_raw_amount_cap').html('Enter the maximum number of retries to attempt before failing the job.');
					$('#d_erl_duration').show();
					$('#s_erl_duration_cap').html('Optionally set a delay to wait between retries.');
				break;
				
				case 'queue':
					$('#d_erl_raw_amount').show();
					$('#s_erl_raw_amount_cap').html('Enter the maximum number of queued jobs to allow.');
				break;
				
				case 'file':
					$('#d_erl_raw_amount').show();
					$('#s_erl_raw_amount_cap').html('Enter the maximum number of input files to allow.');
					$('#d_erl_file_size').show();
					$('#d_erl_file_types').show();
				break;
			} // switch new_type
		}; // change_limit_type
		
		change_limit_type(limit.type);
		
		$('#fe_erl_type').on('change', function() {
			change_limit_type( $(this).val() );
			
			// zero out the amount fields on change, as they do not translate between types
			$('#fe_erl_raw_amount').val(0);
			$('#fe_erl_byte_amount').val(0);
			$('#fe_erl_byte_amount_val').val(0);
		}); // type change
		
		SingleSelect.init( $('#fe_erl_type, #fe_erl_web_hook') );
		MultiSelect.init( $('#fe_erl_tags, #fe_erl_users') );
		RelativeTime.init( $('#fe_erl_duration') );
		RelativeBytes.init( $('#fe_erl_byte_amount, #fe_erl_file_size') );
		
		Dialog.autoResize();
	}
	
	deleteResLimit(idx) {
		// delete selected limit
		this.limits.splice( idx, 1 );
		this.renderResLimitEditor();
		this.triggerEditChange();
	}
	
	//
	// Job Action Table and Editor:
	//
	
	renderJobActionEditor() {
		// render job action editor
		var dom_prefix = this.dom_prefix;
		var html = this.getJobActionTable();
		this.div.find('#d_' + dom_prefix + '_jobact_table').html( html );
	}
	
	getJobActionDisplayArgs(action, link) {
		// get display args for job action
		// returns: { condition, type, text, desc, icon }
		var disp = {
			condition: find_object( config.ui.action_condition_menu, { id: action.condition } ) || 
				find_object( config.ui.alert_action_condition_menu, { id: action.condition } )
		};
		
		if (!disp.condition && action.condition.match(/^tag:(\w+)$/)) {
			var tag_id = RegExp.$1;
			var tag = find_object( app.tags, { id: tag_id } ) || { title: tag_id };
			disp.condition = { title: "On " + tag.title };
			disp.condition.icon = tag.icon || 'tag-outline';
		}
		
		switch (action.type) {
			case 'email':
				disp.type = "Send Email";
				var parts = [];
				if (action.users && action.users.length) parts.push( '' + commify(action.users.length) + ' ' + pluralize('user', action.users.length) );
				if (action.email) parts.push( action.email );
				if (!parts.length) parts = [ '(None)' ];
				disp.text = disp.desc = parts.join(', ');
				disp.icon = 'email-arrow-right-outline';
			break;
			
			case 'web_hook':
				disp.type = "Web Hook";
				var web_hook = find_object( app.web_hooks, { id: action.web_hook } );
				disp.text = web_hook ? web_hook.title : "(Web Hook not found)";
				disp.desc = this.getNiceWebHook(web_hook, link);
				disp.icon = 'webhook';
			break;
			
			case 'run_event':
				disp.type = "Run Event";
				var event = find_object( app.events, { id: action.event_id } );
				disp.text = event ? event.title : "(Event not found)";
				disp.desc = this.getNiceEvent(event, link);
				disp.icon = 'calendar-clock';
			break;
			
			case 'channel':
				disp.type = "Notify Channel";
				var channel = find_object( app.channels, { id: action.channel_id } );
				disp.text = channel ? channel.title : "(Channel not found)";
				disp.desc = this.getNiceChannel(channel, link);
				disp.icon = 'bullhorn-outline';
			break;
			
			case 'snapshot':
				disp.type = "Take Snapshot";
				disp.text = disp.desc = "(Current Server)";
				disp.icon = 'monitor-screenshot';
			break;
			
			case 'store':
				disp.type = "Store Bucket";
				var bucket = find_object( app.buckets, { id: action.bucket_id } );
				disp.text = bucket ? bucket.title : "(Bucket not found)";
				disp.desc = this.getNiceBucket(bucket, link);
				disp.icon = 'import';
			break;
			
			case 'fetch':
				disp.type = "Fetch Bucket";
				var bucket = find_object( app.buckets, { id: action.bucket_id } );
				disp.text = bucket ? bucket.title : "(Bucket not found)";
				disp.desc = this.getNiceBucket(bucket, link);
				disp.icon = 'export';
			break;
			
			case 'ticket':
				disp.type = 'Create Ticket';
				var ticket_type = find_object( config.ui.ticket_types, { id: action.ticket_type } );
				disp.text = ticket_type.title;
				disp.desc = this.getNiceTicketType(action.ticket_type);
				disp.icon = 'text-box-plus-outline';
			break;
			
			case 'suspend':
				disp.type = "Suspend Job";
				var label = "";
				if ((action.users && action.users.length) || action.email.length) label = "Send Email";
				if (action.web_hook) label += (label.length ? ', ' : '') + "Web Hook";
				disp.text = disp.desc = label || 'n/a';
				disp.icon = 'motion-pause-outline';
			break;
			
			case 'disable':
				disp.type = "Disable Event";
				disp.text = disp.desc = "(Current Event)";
				disp.icon = 'cancel';
			break;
			
			case 'delete':
				disp.type = "Delete Event";
				disp.text = disp.desc = "(Current Event)";
				disp.icon = 'trash-can-outline';
			break;
			
			case 'plugin':
				disp.type = "Plugin";
				var plugin = find_object( app.plugins, { id: action.plugin_id, type: 'action' } );
				disp.text = plugin ? plugin.title : "(Plugin not found)";
				disp.desc = this.getNicePlugin(plugin, link);
				disp.icon = 'power-plug';
			break;
			
		} // switch item.type
		
		return disp;
	}
	
	getJobActionTable() {
		// get html for job action table
		var self = this;
		var html = '';
		var rows = this.actions;
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Condition', 'Type', 'Description', 'Actions'];
		var add_link = '<div class="button small secondary" onClick="$P().editJobAction(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i>New Action...</div>';
		
		if (!rows.length) return add_link;
		
		var targs = {
			rows: rows,
			cols: cols,
			data_type: 'action',
			class: 'data_grid c_action_grid',
			empty_msg: add_link,
			always_append_empty_msg: true,
			grid_template_columns: '40px auto auto auto auto'
		};
		
		html += this.getCompactGrid(targs, function(item, idx) {
			var links = [];
			links.push( '<span class="link" onClick="$P().editJobAction('+idx+')"><b>Edit</b></span>' );
			links.push( '<span class="link danger" onClick="$P().deleteJobAction('+idx+')"><b>Delete</b></span>' );
			
			var disp = self.getJobActionDisplayArgs(item);
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggleJobActionEnabled(this,' + idx + ')'
				}) + '</div>',
				'<div class="td_big nowrap"><span class="link" onClick="$P().editJobAction('+idx+')"><i class="mdi mdi-' + disp.condition.icon + '"></i>' + disp.condition.title + '</span></div>',
				'<div class="td_big ellip"><i class="mdi mdi-' + disp.icon + '">&nbsp;</i>' + disp.type + '</div>',
				'<div class="ellip">' + disp.desc + '</div>',
				'<div class="">' + links.join(' | ') + '</div>'
			];
			
			if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getCompactGrid
		
		return html;
	}
	
	toggleJobActionEnabled(elem, idx) {
		// toggle job action checkbox, actually do the enable/disable here, update row
		var item = this.actions[idx];
		item.enabled = !!$(elem).is(':checked');
		
		if (item.enabled) $(elem).closest('ul').removeClass('disabled');
		else $(elem).closest('ul').addClass('disabled');
		
		this.triggerEditChange();
	}
	
	editJobAction(idx) {
		// show dialog to select job action for event
		// action: { condition, type, email?, url? }
		var self = this;
		var action = (idx > -1) ? this.actions[idx] : { condition: 'error', type: 'email', email: '', enabled: true };
		var title = (idx > -1) ? "Editing Job Action" : "New Job Action";
		var btn = (idx > -1) ? ['check-circle', "Accept"] : ['plus-circle', "Add Action"];
		
		this.showEditJobActionDialog({
			action: action,
			title: title,
			btn: btn,
			show_condition: true,
			
			action_type_filter: function(item) { 
				return !item.id.match(/^(suspend)$/); 
			},
			
			callback: function(action) {
				// see if we need to add or replace
				if (idx == -1) {
					self.actions.push(action);
				}
				else self.actions[idx] = action;
				
				// keep list sorted
				sort_by(self.actions, 'condition');
				
				self.triggerEditChange();
				self.renderJobActionEditor();
			}
		});
	}
	
	showEditJobActionDialog(opts) {
		// show dialog to select job action
		var self = this;
		var { action, title, btn, callback } = opts;
		var action_types = opts.action_type_filter ? config.ui.action_type_menu.filter(opts.action_type_filter) : config.ui.action_type_menu;
		
		var html = '<div class="dialog_box_content scroll maximize">';
		
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_eja_enabled',
				label: 'Action Enabled',
				checked: action.enabled
			}),
			caption: 'Enable or disable the action.'
		});
		
		if (opts.show_condition) {
			html += this.getFormRow({
				label: 'Condition:',
				content: this.getFormMenuSingle({
					id: 'fe_eja_condition',
					title: 'Select Condition',
					options: opts.conditions || [ 
						...config.ui.action_condition_menu.filter( function(item) { return item.id != 'continue'; } )
					].concat(
						this.buildOptGroup( app.tags, "On Custom Tag:", 'tag-outline', 'tag:' )
					),
					value: action.condition,
					'data-nudgeheight': 1
				}),
				caption: 'Select the desired condition for the action.'
			});
		}
		
		html += this.getFormRow({
			label: 'Action Type:',
			content: this.getFormMenuSingle({
				id: 'fe_eja_type',
				title: 'Select Action Type',
				options: action_types,
				value: action.type
			}),
			caption: 'Select the desired action type.'
		});
		
		// email
		html += this.getFormRow({
			id: 'd_eja_users',
			label: 'Email Users:',
			content: this.getFormMenuMulti({
				id: 'fe_eja_users',
				title: 'Select Users',
				placeholder: 'None',
				options: app.users.map( function(user) {
					return { id: user.username, title: user.full_name, icon: user.icon || '' };
				} ),
				values: action.users || [],
				default_icon: 'account',
				'data-hold': 1,
				'data-private': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select which users should be emailed for the action.'
		});
		html += this.getFormRow({
			id: 'd_eja_email',
			label: 'Extra Recipients:',
			content: this.getFormText({
				id: 'fe_eja_email',
				// type: 'email',
				// multiple: 'multiple',
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 8192,
				placeholder: 'email@sample.com',
				value: action.email || '',
				'data-private': ''
			}),
			caption: 'Optionally enter one or more additional email addresses for the action.'
		});
		
		// web hook
		html += this.getFormRow({
			id: 'd_eja_web_hook',
			label: 'Web Hook:',
			content: this.getFormMenuSingle({
				id: 'fe_eja_web_hook',
				title: 'Select Web Hook',
				options: [ ['', '(None)'] ].concat( app.web_hooks ),
				value: action.web_hook,
				default_icon: 'webhook'
			}),
			caption: 'Select a Web Hook to fire for the action.'
		});
		html += this.getFormRow({
			id: 'd_eja_web_hook_text',
			label: 'Custom Text:',
			content: this.getFormTextarea({
				id: 'fe_eja_web_hook_text',
				rows: 3,
				class: 'monospace',
				autocomplete: 'off',
				maxlength: 8192,
				value: action.text
			}),
			caption: 'Optionally enter custom text to be appended to the end of the web hook system message.'
		});
		
		// run event
		html += this.getFormRow({
			id: 'd_eja_run_job',
			label: 'Event:',
			content: this.getFormMenuSingle({
				id: 'fe_eja_event',
				title: 'Select Event',
				options: this.getCategorizedEvents(),
				value: action.event_id,
				default_icon: 'calendar-clock'
			}),
			caption: 'Select which event to run for the action.'
		});
		
		// notification channel
		html += this.getFormRow({
			id: 'd_eja_channel',
			label: 'Channel:',
			content: this.getFormMenuSingle({
				id: 'fe_eja_channel',
				title: 'Select Channel',
				options: app.channels,
				value: action.channel_id || '',
				default_icon: 'bullhorn-outline'
			}),
			caption: 'Select which channel to notify for the action.'
		});
		
		// bucket
		html += this.getFormRow({
			id: 'd_eja_bucket',
			label: 'Storage Bucket:',
			content: this.getFormMenuSingle({
				id: 'fe_eja_bucket',
				title: 'Select Bucket',
				options: app.buckets,
				value: action.bucket_id || '',
				default_icon: 'pail-outline'
			}),
			caption: 'Select which bucket to use for the action.'
		});
		
		// bucket type
		html += this.getFormRow({
			id: 'd_eja_bucket_sync',
			label: 'Sync Type:',
			content: this.getFormMenuSingle({
				id: 'fe_eja_bucket_sync',
				title: 'Select Sync Type',
				options: [ { id: 'data_and_files', title: "Both" }, { id: 'data', title: "Data Only" }, { id: 'files', title: "Files Only" } ],
				value: action.bucket_sync || '',
				default_icon: ''
			}),
			caption: 'For this action you can choose to sync data only, files only, or both data and files with the bucket.'
		});
		
		// bucket filespec
		html += this.getFormRow({
			id: 'd_eja_bucket_glob',
			label: 'File Match:',
			content: this.getFormText({
				id: 'fe_eja_bucket_glob',
				class: 'monospace',
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 256,
				placeholder: '*',
				value: action.bucket_glob || ''
			}),
			caption: 'If you have chosen to sync files, optionally enter a glob pattern here to include only certain files.'
		});
		
		// ticket type
		html += this.getFormRow({
			id: 'd_nt_type',
			label: 'Ticket Type:',
			content: this.getFormMenuSingle({
				id: 'fe_nt_type',
				options: config.ui.ticket_types,
				value: action.ticket_type || 'issue',
				// 'data-shrinkwrap': 1
			})
		});
		
		// ticket assignees
		html += this.getFormRow({
			id: 'd_nt_assignees',
			content: this.getFormMenuMulti({
				id: 'fe_nt_assignees',
				options: app.users.map( function(user) { return { id: user.username, title: user.full_name, icon: user.icon || 'account' }; } ),
				values: action.ticket_assignees || [ app.username ],
				auto_add: true,
				// 'data-shrinkwrap': 1
			})
		});
		
		// ticket tags
		html += this.getFormRow({
			id: 'd_nt_tags',
			label: 'Ticket Tags:',
			content: this.getFormMenuMulti({
				id: 'fe_nt_tags',
				options: app.tags,
				values: action.ticket_tags || [],
				// 'data-shrinkwrap': 1
			})
		});
		
		// plugin
		html += this.getFormRow({
			id: 'd_eja_plugin',
			label: 'Action Plugin:',
			content: this.getFormMenuSingle({
				id: 'fe_eja_plugin',
				title: 'Select Action Plugin',
				options: app.plugins.filter( function(plugin) { return plugin.type == 'action'; } ),
				value: action.plugin_id,
				default_icon: 'power-plug-outline'
			}),
			caption: 'Select Plugin to use as the action.'
		});
		
		// plugin params
		html += this.getFormRow({
			id: 'd_eja_plugin_params',
			label: 'Parameters:',
			content: '<div id="d_eja_param_editor" class="plugin_param_editor_cont"></div>',
			caption: 'Enter values for all the Plugin-defined parameters here.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			
			action = {
				enabled: $('#fe_eja_enabled').is(':checked'),
				type: $('#fe_eja_type').val()
			};
			if (opts.show_condition) action.condition = $('#fe_eja_condition').val();
			
			switch (action.type) {
				case 'email':
					action.users = $('#fe_eja_users').val();
					action.email = $('#fe_eja_email').val();
					// if (!action.email) return app.badField('#fe_eja_email', "Please enter one or more email addresses for the action.");
					if (!action.users.length && !action.email) {
						return app.doError("Please select one or more users, or enter one or more custom email addresses.");
					}
				break;
				
				case 'web_hook':
					action.web_hook = $('#fe_eja_web_hook').val();
					if (!action.web_hook) return app.badField('#fe_eja_web_hook', "Please select a web hook for the action.");
					action.text = $('#fe_eja_web_hook_text').val().trim();
				break;
				
				case 'run_event':
					action.event_id = $('#fe_eja_event').val();
					if (!action.event_id) return app.badField('#fe_eja_event', "Please select an event to run for the action.");
				break;
				
				case 'channel':
					action.channel_id = $('#fe_eja_channel').val();
					if (!action.channel_id) return app.badField('#fe_eja_channel', "Please select a notification channel for the action.");
				break;
				
				case 'store':
				case 'fetch':
					action.bucket_id = $('#fe_eja_bucket').val();
					if (!action.bucket_id) return app.badField('#fe_eja_bucket', "Please select a storage bucket for the action.");
					
					action.bucket_sync = $('#fe_eja_bucket_sync').val();
					action.bucket_glob = $('#fe_eja_bucket_glob').val();
				break;
				
				case 'ticket':
					action.ticket_type = $('#fe_nt_type').val();
					action.ticket_assignees = $('#fe_nt_assignees').val();
					action.ticket_tags = $('#fe_nt_tags').val();
				break;
				
				case 'suspend':
					action.users = $('#fe_eja_users').val();
					action.email = $('#fe_eja_email').val();
					action.web_hook = $('#fe_eja_web_hook').val();
					action.text = $('#fe_eja_web_hook_text').val().trim();
				break;
				
				case 'plugin':
					action.plugin_id = $('#fe_eja_plugin').val();
					if (!action.plugin_id) return app.badField('#fe_eja_plugin', "Please select a Plugin for the action.");
					action.params = self.getPluginParamValues( action.plugin_id );
					if (!action.params) return false; // invalid
				break;
			} // switch action.type
			
			Dialog.hide();
			callback( action );
		} ); // Dialog.confirm
		
		var change_action_type = function(new_type) {
			$('#d_eja_email, #d_eja_users, #d_eja_web_hook, #d_eja_web_hook_text, #d_eja_run_job, #d_eja_channel, #d_eja_bucket, #d_eja_bucket_sync, #d_eja_bucket_glob, #d_nt_type, #d_nt_assignees, #d_nt_tags, #d_eja_plugin, #d_eja_plugin_params').hide();
			
			switch (new_type) {
				case 'email':
					$('#d_eja_email').show();
					$('#d_eja_users').show();
				break;
				
				case 'web_hook':
					$('#d_eja_web_hook').show();
					$('#d_eja_web_hook_text').show();
				break;
				
				case 'run_event':
					$('#d_eja_run_job').show();
				break;
				
				case 'channel':
					$('#d_eja_channel').show();
				break;
				
				case 'snapshot':
					// hide all
				break;
				
				case 'store':
				case 'fetch':
					$('#d_eja_bucket, #d_eja_bucket_sync, #d_eja_bucket_glob').show();
				break;
				
				case 'ticket':
					$('#d_nt_type, #d_nt_assignees, #d_nt_tags').show();
				break;
				
				case 'suspend':
					$('#d_eja_email').show();
					$('#d_eja_users').show();
					$('#d_eja_web_hook').show();
					$('#d_eja_web_hook_text').show();
				break;
				
				case 'disable':
					// hide all
				break;
				
				case 'delete':
					// hide all
				break;
				
				case 'plugin':
					$('#d_eja_plugin').show();
					$('#d_eja_plugin_params').show();
					$('#d_eja_param_editor').html( self.getPluginParamEditor( $('#fe_eja_plugin').val(), action.params || {} ) );
				break;
			} // switch new_type
			
			Dialog.autoResize();
		}; // change_action_type
		
		change_action_type(action.type);
		
		$('#fe_eja_type').on('change', function() {
			change_action_type( $(this).val() );
		}); // type change
		
		$('#fe_eja_plugin').on('change', function() {
			$('#d_eja_param_editor').html( self.getPluginParamEditor( $(this).val(), action.params || {} ) );
			Dialog.autoResize();
		}); // type change
		
		MultiSelect.init( $('#fe_eja_users, #fe_nt_assignees, #fe_nt_tags') );
		SingleSelect.init( $('#fe_eja_condition, #fe_eja_type, #fe_eja_event, #fe_eja_channel, #fe_eja_web_hook, #fe_eja_plugin, #fe_eja_bucket, #fe_eja_bucket_sync, #fe_nt_type') );
		
		Dialog.autoResize();
	}
	
	deleteJobAction(idx) {
		// delete selected limit
		this.actions.splice( idx, 1 );
		this.renderJobActionEditor();
		this.triggerEditChange();
	}
	
	// Plugin Params
	
	getPluginParamEditor(plugin_id, params, explore = false) {
		// get HTML for plugin param editor
		// { "id":"script", "type":"textarea", "title":"Script Source", "value": "#!/bin/sh\n\n# Enter your shell script code here" },
		var self = this;
		var html = '';
		if (!plugin_id) return '(No Plugin selected.)';
		
		var plugin = find_object( app.plugins, { id: plugin_id } );
		if (!plugin) return "(Could not locate Plugin definition: " + plugin_id + ")";
		if (!plugin.params.length) return '(The selected Plugin has no configurable parameters defined.)';
		
		var explore_start = '';
		var explore_end = '';
		if (explore) {
			explore_start = `<div class="form_row_compact"><div>`;
			explore_end = `</div><div class="form_suffix_icon mdi mdi-database-search-outline" title="Open Job Data Explorer..." onClick="$P().openJobDataExplorer(this)"></div></div>`;
		}
		
		plugin.params.forEach( function(param) {
			var elem_id = 'fe_pp_' + plugin_id + '_' + param.id;
			var elem_value = (param.id in params) ? params[param.id] : param.value;
			var elem_dis = (param.locked && !app.isAdmin()) ? 'disabled' : undefined; 
			var elem_icon = config.ui.control_type_icons[param.type];
			if (param.type == 'hidden') return;
			
			if (param.type != 'checkbox') html += '<div class="info_label">' + param.title + '</div>';
			html += '<div class="info_value">';
			
			switch (param.type) {
				case 'text':
					var text_args = { 
						id: elem_id, 
						type: param.variant || 'text', 
						value: elem_value, 
						class: 'monospace', 
						disabled: elem_dis, 
						autocomplete: 'off' 
					};
					if (!param.variant || param.variant.match(/^(password|text|tel)$/)) {
						// only show explorer icon for non-validating text variants
						html += explore_start + self.getFormText(text_args) + explore_end;
					}
					else {
						html += self.getFormText(text_args);
					}
				break;
				
				case 'textarea':
					html += explore_start + self.getFormTextarea({ 
						id: elem_id, 
						value: elem_value, 
						rows: 5, 
						class: 'monospace', 
						disabled: elem_dis 
					}) + explore_end;
				break;
				
				case 'code':
					html += self.getFormTextarea({ id: elem_id, value: elem_value, rows: 1, disabled: elem_dis, style: 'display:none' });
					if (elem_dis) {
						html += '<div class="button small secondary" onClick="$P().viewPluginParamCode(\'' + plugin_id + '\',\'' + param.id + '\')"><i class="mdi mdi-code-json">&nbsp;</i>View Code...</div>';
					}
					else {
						html += '<div class="button small secondary" onClick="$P().editPluginParamCode(\'' + plugin_id + '\',\'' + param.id + '\')"><i class="mdi mdi-text-box-edit-outline">&nbsp;</i>Edit Code...</div>';
					}
				break;
				
				case 'checkbox':
					html += self.getFormCheckbox({ id: elem_id, label: param.title, checked: !!elem_value, disabled: elem_dis });
				break;
				
				case 'select':
					elem_value = (param.id in params) ? params[param.id] : param.value.replace(/\,.*$/, '');
					html += self.getFormMenu({ id: elem_id, value: elem_value, options: param.value.split(/\,\s*/), disabled: elem_dis });
				break;
				
				case 'toolset':
					var data = param.data || { tools: [] };
					if (!data.tools) data.tools = [];
					var tools = data.tools;
					if (!tools.length) {
						tools.push( { id: '', title: 'No Tools', description: 'No tools defined in toolset.', fields: [] } );
						elem_dis = true;
					}
					
					var default_tool_id = data.default || tools[0].id;
					elem_value = (param.id in params) ? params[param.id] : default_tool_id;
					
					// make sure tool exists (plugin may have changed), default to first tool
					var tool = find_object( tools, { id: elem_value } );
					if (!tool) {
						tool = tools[0];
						elem_value = tool.id;
					}
					
					html += self.getFormMenu({ id: elem_id, value: elem_value, options: tools, disabled: elem_dis, onChange: `$P().changePluginParamTool('${plugin_id}','${param.id}',${explore})` });
					
					html += `<fieldset id="fs_toolset_${plugin_id}_${param.id}" class="info_fieldset">`;
					html += `<legend>${strip_html(tool.title)}</legend>`;
					html += `<div class="tool_desc">${strip_html(tool.description)}</div>`;
					if (tool.fields && tool.fields.length) html += self.getParamEditor(tool.fields, params, explore);
					html += `</fieldset>`;
				break;
			} // switch type
			
			if (param.caption) html += '<div class="info_caption">' + strip_html(param.caption) + '</div>';
			
			html += '</div>';
		} ); // foreach param
		
		return html;
	}
	
	changePluginParamTool(plugin_id, param_id, explore = false) {
		// change tool in toolset, redraw fields
		var elem_id = 'fe_pp_' + plugin_id + '_' + CSS.escape(param_id);
		var elem_value = $('#' + elem_id).val();
		
		var plugin = find_object( app.plugins, { id: plugin_id } );
		if (!plugin) return; // sanity
		
		var param = find_object( plugin.params, { id: param_id } );
		if (!param) return; // sanity
		
		var data = param.data || { tools: [] };
		if (!data.tools) data.tools = [];
		var tools = data.tools;
		var tool = find_object( tools, { id: elem_value } );
		if (!tool) return; // sanity
		
		var $fieldset = $(`#fs_toolset_${plugin_id}_${CSS.escape(param_id)}`);
		var html = '';
		
		html += `<legend>${strip_html(tool.title)}</legend>`;
		html += `<div class="tool_desc">${strip_html(tool.description)}</div>`;
		if (tool.fields && tool.fields.length) html += this.getParamEditor(tool.fields, {}, explore);
		
		$fieldset.html(html);
	}
	
	viewPluginParamCode(plugin_id, param_id) {
		// show plugin param code (no editing)
		var elem_id = 'fe_pp_' + plugin_id + '_' + CSS.escape(param_id);
		var elem_value = $('#' + elem_id).val();
		
		var plugin = find_object( app.plugins, { id: plugin_id } );
		if (!plugin) return; // sanity
		
		var param = find_object( plugin.params, { id: param_id } );
		if (!param) return; // sanity
		
		this.viewCodeAuto(param.title, elem_value);
	}
	
	editPluginParamCode(plugin_id, param_id) {
		// open editor for code plugin param
		var self = this;
		var elem_id = 'fe_pp_' + plugin_id + '_' + CSS.escape(param_id);
		var elem_value = $('#' + elem_id).val();
		
		var plugin = find_object( app.plugins, { id: plugin_id } );
		if (!plugin) return; // sanity
		
		var param = find_object( plugin.params, { id: param_id } );
		if (!param) return; // sanity
		
		this.editCodeAuto(param.title, elem_value, function(new_value) {
			$('#' + elem_id).val( new_value );
			if (!Dialog.active) self.triggerEditChange();
		});
	}
	
	getPluginParamValues(plugin_id, force) {
		// get all values for params hash
		var self = this;
		var params = {};
		var plugin = find_object( app.plugins, { id: plugin_id } );
		if (!plugin) return {}; // should never happen
		var is_valid = true;
		
		plugin.params.forEach( function(param) {
			switch (param.type) {
				case 'hidden':
					params[ param.id ] = param.value;
				break;
				
				case 'checkbox':
					params[ param.id ] = !!$('#fe_pp_' + plugin_id + '_' + CSS.escape(param.id)).is(':checked');
				break;
				
				case 'toolset':
					var tool_id = params[ param.id ] = $('#fe_pp_' + plugin_id + '_' + CSS.escape(param.id)).val();
					
					if (!param.data || !param.data.tools) return; // sanity
					var tool = find_object( param.data.tools, { id: tool_id } );
					if (!tool) return; // sanity
					
					var tool_values = self.getParamValues(tool.fields || []);
					if (!tool_values) { is_valid = false; return; } // invalid
					
					merge_hash_into( params, tool_values );
				break;
				
				default:
					params[ param.id ] = $('#fe_pp_' + plugin_id + '_' + CSS.escape(param.id)).val();
					if (param.required && !params[ param.id ].length && !force) {
						app.badField('#fe_pp_' + plugin_id + '_' + CSS.escape(param.id), "The &ldquo;" + param.title + "&rdquo; field is required.");
						is_valid = false;
					}
					else if (!force && param.variant && !param.variant.match(/^(password|text|tel)$/) && !$('#fe_pp_' + plugin_id + '_' + CSS.escape(param.id))[0].validity.valid) {
						app.badField('#fe_pp_' + plugin_id + '_' + CSS.escape(param.id), "The &ldquo;" + param.title + "&rdquo; field is invalid.");
						is_valid = false;
					}
				break;
			} // switch param.type
		}); // foreach param
		
		return is_valid ? params : false;
	}
	
	// Data Tree:
	
	getDataTree(obj) {
		// get HTML for JSON tree
		var html = '';
		
		var sorted_keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
		for (var idx = 0, len = sorted_keys.length; idx < len; idx++) {
			var key = sorted_keys[idx];
			html += this.getDataBranch('', key, obj[key]);
		}
		
		return html;
	}
	
	getDataBranch(path, key, value) {
		var html = '';
		var type = (value === null) ? 'null' : typeof(value);
		
		if (path && !key.match(/^\[\d+\]$/)) path += '.';
		path += key;
		
		if (type == 'object') {
			// hash or array
			html += `<div class="tree_row">`;
				html += `<span class="tree_ctrl mdi mdi-minus-box-outline" onClick="$P().toggleDataBranch(this)"></span>`;
				html += `<span class="tree_folder mdi mdi-folder-open-outline"></span>`;
				html += `<span class="tree_key hljs-variable" data-path="${encode_attrib_entities(path)}"><b>${encode_entities(key)}</b></span>`;
			html += `</div>`;
		}
		
		if (Array.isArray(value)) {
			// recurse for array
			html += `<div class="tree_indent expanded">`;
			for (var idx = 0, len = value.length; idx < len; idx++) {
				html += this.getDataBranch(path, '[' + idx + ']', value[idx]);
			}
			html += `</div>`;
		}
		else if (type == 'object') {
			// recurse for hash
			html += `<div class="tree_indent expanded">`;
			var sorted_keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
			for (var idx = 0, len = sorted_keys.length; idx < len; idx++) {
				var sub_key = sorted_keys[idx];
				html += this.getDataBranch(path, sub_key, value[sub_key]);
			}
			html += `</div>`;
		}
		else {
			// plain value
			var icon = 'file-outline';
			var extra_class = '';
			switch (type) {
				case 'string': icon = 'file-document-outline'; extra_class = 'hljs-string'; break;
				case 'number': icon = 'file-percent-outline'; extra_class = 'hljs-number'; break;
				case 'boolean': icon = 'file-compare'; extra_class = 'hljs-keyword'; break;
				case 'null': icon = 'file-hidden'; extra_class = 'hljs-keyword'; break;
			}
			
			html += `<div class="tree_row">`;
				html += `<span class="tree_file mdi mdi-${icon}"></span>`;
				html += `<span class="tree_key hljs-variable" data-path="${encode_attrib_entities(path)}">${encode_entities(key)}</span>`;
				html += `<span class="tree_value ${extra_class}">${encode_entities(JSON.stringify(value))}</span>`;
			html += `</div>`;
		}
		
		return html;
	}
	
	toggleDataBranch(elem) {
		// toggle branch open/closed
		var $ctrl = $(elem);
		var $row = $ctrl.closest('.tree_row');
		var $folder = $row.find('.tree_folder');
		var $cont = $row.next();
		var duration = 300;
		
		if ($cont.hasClass('expanded')) {
			// collapse
			$cont.removeClass('expanded');
			$cont.scrollTop(0).css('height', $cont[0].scrollHeight);
			$cont.stop().animate({
				scrollTop: $cont[0].scrollHeight,
				height: 0
			}, {
				duration: duration,
				easing: 'easeOutQuart'
			});
			
			$ctrl.removeClass().addClass('tree_ctrl mdi mdi-plus-box-outline');
			$folder.removeClass().addClass('tree_folder mdi mdi-folder-outline');
		}
		else {
			// expand
			$cont.addClass('expanded');
			$cont.css('height', 0).scrollTop( $cont[0].scrollHeight );
			$cont.stop().animate({
				scrollTop: 0,
				height: $cont[0].scrollHeight
			}, {
				duration: duration,
				easing: 'easeOutQuart'
			});
			
			$ctrl.removeClass().addClass('tree_ctrl mdi mdi-minus-box-outline');
			$folder.removeClass().addClass('tree_folder mdi mdi-folder-open-outline');
		}
	}
	
	// Search Options Toggle:
	
	setupSearchOpts() {
		// make search options animate smoothly
		var self = this;
		
		var $btn = this.div.find('#btn_search_opts');
		var $icon = $btn.find('i').first();
		// var $title = $btn.find('span').first();
		var $content = $btn.closest('.box').find('div.form_grid');
		
		$content.css('overflow', 'hidden');
		
		var state = app.getPref('search_opts.' + this.ID) || 'collapsed'; // default collapsed
		if (state == 'expanded') $content.addClass('expanded');
		
		if ($content.hasClass('expanded')) {
			// $title.html('Hide Options');
			$icon.addClass('mdi mdi-chevron-up');
		}
		else {
			$content.css({ height: 0, marginBottom: 0 });
			// $title.html('Show Options');
			$icon.addClass('mdi mdi-chevron-down');
		}
	}
	
	toggleSearchOpts(elem) {
		// toggle details section open/closed
		var $btn = this.div.find('#btn_search_opts');
		var $content = $btn.closest('.box').find('div.form_grid');
		
		if ($content.hasClass('expanded')) this.collapseSearchOpts();
		else this.expandSearchOpts();
	}
	
	collapseSearchOpts() {
		// collapse toggle box
		var self = this;
		var $btn = this.div.find('#btn_search_opts');
		var $content = $btn.closest('.box').find('div.form_grid');
		var $icon = $btn.find('i').first();
		// var $title = $btn.find('span').first();
		
		if ($content.hasClass('expanded')) {
			$content.removeClass('expanded');
			
			$content.scrollTop(0).css({ height: $content[0].scrollHeight, marginBottom: '25px' });
			
			$content.stop().animate({
				scrollTop: $content[0].scrollHeight,
				height: 0,
				marginBottom: 0
			}, {
				duration: app.reducedMotion() ? 1 : 400,
				easing: 'easeOutQuart',
				complete: function() { self.updateBoxButtonFloaterState(); }
			});
			
			// $title.html('Show Options');
			$icon.removeClass().addClass('mdi mdi-chevron-down');
			app.setPref('search_opts.' + this.ID, 'collapsed');
		}
	}
	
	expandSearchOpts() {
		// expand toggle box
		var self = this;
		var $btn = this.div.find('#btn_search_opts');
		var $content = $btn.closest('.box').find('div.form_grid');
		var $icon = $btn.find('i').first();
		// var $title = $btn.find('span').first();
		
		if (!$content.hasClass('expanded')) {
			$content.addClass('expanded');
			
			$content.css({ height: 0, marginBottom: 0 }).scrollTop( $content[0].scrollHeight );
			
			$content.stop().animate({
				scrollTop: 0,
				height: $content[0].scrollHeight,
				marginBottom: '25px'
			}, {
				duration: app.reducedMotion() ? 1 : 400,
				easing: 'easeOutQuart',
				complete: function() { $content.css('height', 'auto'); self.updateBoxButtonFloaterState(); }
			});
			
			// $title.html('Hide Options');
			$icon.removeClass().addClass('mdi mdi-chevron-up');
			app.setPref('search_opts.' + this.ID, 'expanded');
		}
	}
	
	openServerDataExplorer(elem, wrap) {
		// open expression builder dialog for server data
		var self = this;
		var $input = $(elem).closest('.form_row').find('.fr_content').find('input, textarea');
		var title = config.ui.titles.server_data_explorer;
		var html = '';
		
		var servers = this.getCategorizedServers(true);
		if (!servers.length) return app.doError(config.ui.errors.sde_no_servers);
		
		html += `<div class="dialog_intro">${config.ui.intros.server_data_explorer}</div>`;
		html += '<div class="dialog_box_content scroll maximize">';
		
		// server picker
		html += this.getFormRow({
			id: 'd_ex_server',
			content: this.getFormMenuSingle({
				id: 'fe_ex_server',
				options: sort_by(servers.map( function(server) {
						return merge_objects( server, { title: server.title || server.hostname } );
					} ), 'title'),
				value: '',
				default_icon: 'router-network'
			})
		});
		
		// json tree viewer
		html += this.getFormRow({
			id: 'd_ex_tree_viewer',
			content: '<div id="d_ex_tree"><div class="ex_tree_inner"><div class="loading_container"><div class="loading"></div></div></div></div>'
		});
		
		// expression
		html += this.getFormRow({
			id: 'd_ex_exp',
			content: this.getFormText({
				id: 'fe_ex_exp',
				type: 'text',
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 8192,
				class: 'monospace',
				value: ''
			})
		});
		
		html += '</div>'; // dialog_box_content
		
		var buttons_html = "";
		buttons_html += `<div class="button" onClick="CodeEditor.hide()"><i class="mdi mdi-close-circle-outline">&nbsp;</i>${config.ui.buttons.cancel}</div>`;
		buttons_html += `<div id="btn_ex_apply" class="button primary"><i class="mdi mdi-check-circle">&nbsp;</i>${config.ui.buttons.accept}</div>`;
		
		CodeEditor.showSimpleDialog(title, html, buttons_html);
		
		SingleSelect.init('#fe_ex_server');
		
		$('#fe_ex_server').on('change', function() {
			var id = $(this).val();
			if (!id) return; // sanity
			
			// now load server host data
			app.api.get( 'app/get_server', { id }, function(resp) {
				
				// render json tree
				$('#d_ex_tree > .ex_tree_inner').html( self.getDataTree(resp.data.data) );
				
				// add click handler to all keys
				$('#d_ex_tree .tree_key').on('click', function() {
					var path = $(this).data('path');
					$('#fe_ex_exp').val( path );
					
					// apply flash effect
					if (!$('#fe_ex_exp').hasClass('iflash')) {
						$('#fe_ex_exp').addClass('iflash').focus();
						setTimeout( function() { $('#fe_ex_exp').removeClass('iflash'); }, 1500 );
					}
				});
			} ); // api.get
		}); // on change
		
		$('#btn_ex_apply').on('click', function() {
			// apply changes and exit dialog
			if (wrap) {
				// codemirror mode
				self.editor.focus();
				self.editor.replaceSelection( ' {{' + $('#fe_ex_exp').val() + '}}' );
				
				// apply flash effect
				var $wrapper = self.editor.getWrapperElement();
				$wrapper.classList.add('iflash');
				setTimeout( function() { $wrapper.classList.remove('iflash'); }, 1500 );
			}
			else {
				var value = $input.val();
				if (value.length) value += ' ';
				
				if (wrap) value += '{{';
				value += $('#fe_ex_exp').val();
				if (wrap) value += '}}';
				
				$input.val( value.trim() );
				
				// apply flash effect
				$input.addClass('iflash').focus();
				setTimeout( function() { $input.removeClass('iflash'); }, 1500 );
			}
			
			CodeEditor.hide();
			self.triggerEditChange();
		});
		
		// trigger change to load first server
		$('#fe_ex_server').trigger('change');
	}
	
	openJobDataExplorer(elem) {
		// open job data explorer dialog
		var self = this;
		var title = "Job Data Explorer";
		var $input = $(elem).closest('.form_row_compact').find('input, textarea');
		var html = '';
		
		html += `<div class="dialog_intro">Select a previously completed job to select a data path, which will be inserted into the parameter value as a placeholder macro.</div>`;
		html += '<div class="dialog_box_content scroll maximize">';
		
		// job picker
		html += this.getFormRow({
			id: 'd_ex_job',
			content: this.getFormMenuSingle({
				id: 'fe_ex_job',
				options: [ { id: '', title: config.ui.menu_bits.generic_loading } ],
				value: ''
			})
		});
		
		// json tree viewer
		html += this.getFormRow({
			id: 'd_ex_tree_viewer',
			content: '<div id="d_ex_tree"><div class="ex_tree_inner"><div class="loading_container"><div class="loading"></div></div></div></div>'
		});
		
		// expression
		html += this.getFormRow({
			id: 'd_ex_exp',
			content: this.getFormText({
				id: 'fe_ex_exp',
				type: 'text',
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 8192,
				class: 'monospace',
				value: ''
			})
		});
		
		html += '</div>'; // dialog_box_content
		
		var buttons_html = "";
		buttons_html += `<div class="button" onClick="CodeEditor.hide()"><i class="mdi mdi-close-circle-outline">&nbsp;</i>${config.ui.buttons.cancel}</div>`;
		buttons_html += `<div id="btn_ex_apply" class="button primary"><i class="mdi mdi-check-circle">&nbsp;</i>Insert Macro</div>`;
		
		CodeEditor.showSimpleDialog(title, html, buttons_html);
		
		SingleSelect.init('#fe_ex_job');
		
		$('#fe_ex_job').on('change', function() {
			var id = $(this).val();
			if (!id) return; // sanity
			
			// now load job details
			app.api.get( 'app/get_job', { id, remove: ['timelines', 'activity'] }, function(resp) {
				// see if job actually produced data and/or files
				var job = resp.job;
				
				if ((job.data && first_key(job.data)) || (job.files && job.files.length)) {
					var temp_data = { data: job.data || {}, files: job.files || [] };
					
					// render json tree
					$('#d_ex_tree > .ex_tree_inner').html( self.getDataTree(temp_data) );
					
					// add click handler to all keys
					$('#d_ex_tree .tree_key').on('click', function() {
						var path = $(this).data('path');
						$('#fe_ex_exp').val( path );
						
						// apply flash effect
						if (!$('#fe_ex_exp').hasClass('iflash')) {
							$('#fe_ex_exp').addClass('iflash').focus();
							setTimeout( function() { $('#fe_ex_exp').removeClass('iflash'); }, 1500 );
						}
					});
				}
				else {
					$('#d_ex_tree > .ex_tree_inner').html(`<div class="ex_tree_none">${config.ui.errors.ex_tree_no_data}</div>`);
				}
			} ); // api.get
		}); // on change
		
		$('#btn_ex_apply').on('click', function() {
			// apply changes and exit dialog
			if ($('#fe_ex_exp').val().length) {
				var value = $input.val();
				if (value.length) value += ' ';
				
				value += '{{' + $('#fe_ex_exp').val() + '}}';
				
				$input.val( value.trim() );
				
				// apply flash effect
				$input.addClass('iflash').focus();
				setTimeout( function() { $input.removeClass('iflash'); }, 1500 );
			}
			CodeEditor.hide();
			self.triggerEditChange();
		});
		
		// job search
		var squery = (this.workflow ? 'source:workflow' : '') + ' tags:_success';
		
		app.api.get( 'app/search_jobs', { query: squery, limit: config.alt_items_per_page }, function(resp) {
			var items = (resp.rows || []).map( function(job) {
				var args = self.getJobDisplayArgs(job);
				return { id: job.id, title: args.title, icon: args.icon };
			} );
			
			if (!items.length) {
				$('#fe_ex_job').html( render_menu_options( [{ id: '', title: config.ui.errors.fe_ex_job }], '' ) ).trigger('change');
				$('#d_ex_tree > .ex_tree_inner').html(`<div class="ex_tree_none">${config.ui.errors.ex_tree_none}</div>`);
				return;
			}
			
			// change menu items and fire onChange event for redraw
			$('#fe_ex_job').html( render_menu_options( items, items[0].id ) ).trigger('change');
		} ); // api.get
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
		$cont.find('#d_wf_editor').css('touchAction', 'none').on('pointerdown', function(event) {
			var native = event.originalEvent;
			if (native.button !== 0) return; // only capture left-clicks
			var $this = $(this);
			
			event.stopPropagation();
			event.preventDefault();
			
			// if we're soldering, pause it and pop menu to create node in place
			if (self.wfSoldering) return self.solderNewNode(event);
			
			// if we're in edit mode, deselect all
			if (self.wfEdit) self.deselectAll();
			
			self.wfScroll.dragging = true;
			var start_pt = { x: event.clientX, y: event.clientY };
			var start_scroll = Object.assign( {}, self.wfScroll );
			
			$cont.addClass('dragging');
			this.setPointerCapture(native.pointerId);
			
			$this.on('pointermove.scroll', function(event) {
				self.wfScroll.x = start_scroll.x - ((event.clientX - start_pt.x) / self.wfZoom);
				self.wfScroll.y = start_scroll.y - ((event.clientY - start_pt.y) / self.wfZoom);
				self.drawWorkflow();
			});
			
			$this.on('pointerup.scroll', function(event) {
				delete self.wfScroll.dragging;
				$this.css('cursor', 'grab');
				$this.off('.scroll');
				$cont.removeClass('dragging');
				if (self.wfEdit) self.updateState();
			});
			
			$this.css('cursor', 'grabbing');
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
			if (node.type == 'controller') box.right += 64; // controller nodes are double-entity-width which offsetWidth ignores
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
		
		// tags
		html += '<div>'; // grid unit
		html += '<div class="info_label">Tags</div>';
		html += '<div class="info_value">' + this.getNiceTagList(node.data.tags || []) + '</div>';
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
			html += '<div class="info_label">' + (param.locked ? '<i class="mdi mdi-lock-outline">&nbsp;</i>' : '') + strip_html(param.title) + '</div>';
			html += '<div class="info_value">';
			
			switch (param.type) {
				case 'text':
				case 'textarea':
					if (elem_value.toString().length) {
						html += '<i class="mdi mdi-' + elem_icon + '">&nbsp;</i>';
						html += strip_html( elem_value );
					}
					else html += none;
				break;
				
				case 'code':
					if (elem_value.toString().length) {
						html += '<i class="mdi mdi-' + elem_icon + '">&nbsp;</i>';
						html += '<span class="monospace">' + strip_html(elem_value) + '</span>';
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
					html += strip_html( elem_value.toString().replace(/\,.*$/, '') );
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
		var icon = plugin.icon || config.ui.data_types.plugin.icon;
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
		
		// tags
		html += '<div>'; // grid unit
		html += '<div class="info_label">Tags</div>';
		html += '<div class="info_value">' + this.getNiceTagList(node.data.tags || []) + '</div>';
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
			html += '<div class="info_label">' + (param.locked ? '<i class="mdi mdi-lock-outline">&nbsp;</i>' : '') + strip_html(param.title) + '</div>';
			html += '<div class="info_value">';
			
			switch (param.type) {
				case 'text':
				case 'textarea':
					if (elem_value.toString().length) {
						html += '<i class="mdi mdi-' + elem_icon + '">&nbsp;</i>';
						html += strip_html(elem_value);
					}
					else html += none;
				break;
				
				case 'code':
					if (elem_value.toString().length) {
						html += '<i class="mdi mdi-' + elem_icon + '">&nbsp;</i>';
						html += '<span class="monospace">' + strip_html(elem_value) + '</span>';
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
					html += strip_html( elem_value.toString().replace(/\,.*$/, '') );
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
				icon = 'email-arrow-right-outline';
				if (action.users && action.users.length) label = commify(action.users.length) + ' ' + pluralize('user', action.users.length);
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
			
			case 'store':
				var bucket = find_object( app.buckets, { id: action.bucket_id } );
				if (!bucket) classes.push('error');
				title = "Store Bucket";
				label = bucket ? bucket.title : "(Not found)";
				icon = bucket ? (bucket.icon || 'pail-outline') : 'alert-decagram-outline';
			break;
			
			case 'fetch':
				var bucket = find_object( app.buckets, { id: action.bucket_id } );
				if (!bucket) classes.push('error');
				title = "Fetch Bucket";
				label = bucket ? bucket.title : "(Not found)";
				icon = bucket ? (bucket.icon || 'pail-outline') : 'alert-decagram-outline';
			break;
			
			case 'ticket':
				title = "Create Ticket";
				var ticket_type = find_object( config.ui.ticket_types, { id: action.ticket_type } );
				label = ticket_type.title;
				icon = 'text-box-plus-outline';
			break;
			
			case 'suspend':
				title = "Suspend Job";
				label = "";
				if ((action.users && action.users.length) || action.email.length) label = "Send Email";
				if (action.web_hook) label += (label.length ? ', ' : '') + "Web Hook";
				icon = 'motion-pause-outline';
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
			
			default:
				title = "Unknown Action";
				label = "";
				icon = 'help';
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
			
			case 'wait':
				label = get_text_from_seconds(node.data.wait, true, true);
			break;
			
			case 'repeat':
				label = '' + node.data.repeat + ' ' + pluralize('iteration', node.data.repeat);
			break;
			
			case 'split':
				label = '<span class="monospace">' + encode_entities(node.data.split) + '</span>';
			break;
			
			case 'decision':
				label = '<span class="monospace">' + encode_entities(node.data.decision) + '</span>';
				if (node.data.label) title = strip_html( node.data.label );
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
		var canvas = $cont.find('#c_wf_canvas').get(0);
		var ctx = canvas.getContext('2d');
		
		var width = $cont.width();
		var height = $cont.height();
		
		canvas.width = width * window.devicePixelRatio;
		canvas.height = height * window.devicePixelRatio;
		
		if (!workflow.connections.length) return;
		
		ctx.save();
		
		if (app.safari && (this.wfZoom != 1)) {
			// hack for safari user zoom (sigh)
			var safari_zoom = window.outerWidth / window.innerWidth;
			ctx.scale( (window.devicePixelRatio * this.wfZoom) / safari_zoom, (window.devicePixelRatio * this.wfZoom) / safari_zoom );
		}
		else {
			// sane browsers
			ctx.scale( window.devicePixelRatio * this.wfZoom, window.devicePixelRatio * this.wfZoom );
		}
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
	
	getWFCenterPoint(sel) {
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
		var a = this.getWFCenterPoint(sel1);
		var b = this.getWFCenterPoint(sel2);
		var c = [
			a[0] + ((b[0] - a[0]) / 2),
			a[1] + ((b[1] - a[1]) / 2),
		];
		
		var x = Math.floor(c[0] - 16);
		var y = Math.floor(c[1] - 16);
		
		if (app.safari && (this.wfZoom != 1)) {
			// sigh
			var safari_zoom = window.outerWidth / window.innerWidth;
			x /= safari_zoom;
			y /= safari_zoom;
		}
		
		$(trig).css({
			left: '' + x + 'px',
			top: '' + y + 'px'
		});
	}
	
	renderWFConnection(opts) {
		// draw one bezier spline connection between two poles
		var { sel1, sel2, start_dir, end_dir, custom, ctx } = opts;
		
		var a = this.getWFCenterPoint(sel1);
		var b = this.getWFCenterPoint(sel2);
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
			class: 'data_grid c_param_grid',
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
					if (param.variant && (param.variant !== 'text')) {
						var variant = find_object( config.ui.text_field_variants, { id: param.variant } );
						nice_type = variant.title;
						nice_icon = variant.icon;
					}
					if (param.value.length) pairs.push([ 'Default', '&ldquo;' + strip_html(param.value) + '&rdquo;' ]);
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
					pairs.push([ 'Value', '&ldquo;' + strip_html(param.value) + '&rdquo;' ]);
				break;
				
				case 'select':
					pairs.push([ 'Items', '(' + strip_html(param.value) + ')' ]);
				break;
				
				case 'toolset':
					if (param.data && param.data.tools && param.data.tools.length) pairs.push([ commify(param.data.tools.length) + " tools in set" ]);
					else pairs.push([ "(No tools in set)" ]);
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
		
		this.triggerEditChange();
	}
	
	editParam(idx) {
		// show dialog to configure param
		var self = this;
		var param = (idx > -1) ? this.params[idx] : { type: 'text', variant: 'text', value: '' };
		var title = (idx > -1) ? "Editing Parameter" : "New Parameter";
		var btn = (idx > -1) ? ['check-circle', "Accept"] : ['plus-circle', "Add Param"];
		
		// prepare control type menu
		var ctypes = (this.controlTypes || ['checkbox', 'code', 'hidden', 'select', 'text', 'textarea']).map (function(key) { 
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
				autocomplete: 'off',
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
				autocomplete: 'off',
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
			id: 'd_epa_text_variant',
			label: 'Text Variant:',
			content: this.getFormMenuSingle({
				id: 'fe_epa_text_variant',
				title: 'Select Text Field Variant',
				options: config.ui.text_field_variants,
				value: param.variant || 'text'
			}),
			caption: 'Choose a UI type variant for the text field.'
		});
		html += this.getFormRow({
			id: 'd_epa_value_text',
			label: 'Default Value:',
			content: this.getFormText({
				id: 'fe_epa_value_text',
				spellcheck: 'false',
				autocomplete: 'off',
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
				autocomplete: 'off',
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
				autocomplete: 'off',
				value: param.value || ''
			}),
			caption: 'Enter the default value for the hidden field.'
		});
		html += this.getFormRow({
			id: 'd_epa_value_toolset',
			label: 'Edit Toolset:',
			content: self.getFormTextarea({ 
				id: 'fe_epa_value_toolset', 
				value: JSON.stringify( param.data || { tools: [ { id: 'sample', title: "Sample Tool", fields: [ { id: 'field1', title: "Field 1", type: 'text', value: "" } ] } ] }, null, "\t" ), 
				rows: 1, 
				style: 'display:none'
			}) + `<div class="button small secondary" onClick="$P().editParamToolset()"><i class="mdi mdi-code-json">&nbsp;</i><span>Edit JSON...</span></div>`,
			caption: 'Enter JSON data describing the toolset.  [Learn More](#Docs/plugins/toolset)'
		});
		
		// caption
		html += this.getFormRow({
			label: 'Caption:',
			content: this.getFormTextarea({
				id: 'fe_epa_caption',
				rows: 3,
				spellcheck: 'false',
				autocomplete: 'off',
				value: param.caption || ''
			}),
			caption: 'Optionally enter a caption for the parameter, which will be displayed below it.'
		});
		
		// required
		html += this.getFormRow({
			id: 'd_epa_required',
			label: 'Enforce:',
			content: this.getFormCheckbox({
				id: 'fe_epa_required',
				label: 'Value Required',
				checked: !!param.required
			}),
			caption: 'Check this box to require a value in order to continue.'
		});
		
		// admin lock
		html += this.getFormRow({
			id: 'd_epa_locked',
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
			app.clearError();
			
			// start a fresh param object so we don't taint the original on errors
			var old_param = param;
			param = {};
			
			param.id = $('#fe_epa_id').val().trim();
			if (!param.id.length) return app.badField('#fe_epa_id', "The ID field is required.");
			if (!param.id.match(/^[\w\-\.]+$/)) return app.badField('#fe_epa_id', `The ID field must contain only alphanumerics, underscore, dash and period.`);
			if (!param.id.match(/^[A-Za-z_]/)) return app.badField('#fe_epa_id', `The ID field must begin with an alpha character or underscore.`);
			if (param.id.match(app.MATCH_BAD_KEY)) return app.badField('#fe_epa_id', `The ID field is invalid (reserved word).`);
			
			// check for ID collisions!  must consider NEW and EDIT modes
			if (idx == -1) {
				if (find_object(self.params, { id: param.id })) return app.badField('#fe_epa_id', "That ID is already in use.");
			}
			else {
				if ((param.id != old_param.id) && find_object(self.params, { id: param.id })) return app.badField('#fe_epa_id', "That ID is already in use.");
			}
			
			param.title = strip_html( $('#fe_epa_title').val().trim() );
			if (!param.title.length) return app.badField('#fe_epa_title', "The Title field is required.");
			
			param.type = $('#fe_epa_type').val();
			param.caption = $('#fe_epa_caption').val();
			param.locked = !!$('#fe_epa_locked').is(':checked');
			
			switch (param.type) {
				case 'text':
					param.value = $('#fe_epa_value_text').val();
					param.variant = $('#fe_epa_text_variant').val();
					param.required = !!$('#fe_epa_required').is(':checked');
				break;
				
				case 'textarea':
					param.value = $('#fe_epa_value_textarea').val();
					param.required = !!$('#fe_epa_required').is(':checked');
				break;
				
				case 'code':
					param.value = $('#fe_epa_value_code').val();
					param.required = !!$('#fe_epa_required').is(':checked');
				break;
				
				case 'checkbox':
					param.value = !!$('#fe_epa_value_checkbox').is(':checked');
					delete param.required;
				break;
				
				case 'select':
					param.value = $('#fe_epa_value_select').val();
					delete param.required;
				break;
				
				case 'hidden':
					param.value = $('#fe_epa_value_hidden').val();
					delete param.required;
				break;
				
				case 'toolset':
					try { param.data = JSON.parse( $('#fe_epa_value_toolset').val() ); }
					catch (err) { return app.doError("Failed to parse toolset JSON: " + err); }
					
					// validate tools (control types, etc.)
					if (!self.validateToolsetData(param)) return false;
					
					delete param.required;
					delete param.value;
					delete param.locked;
				break;
			} // switch action.type
			
			if (param.type != 'text') delete param.variant;
			if (param.type != 'toolset') delete param.data;
			
			// see if we need to add or replace
			if (idx == -1) {
				self.params.push(param);
			}
			else {
				self.params[idx] = param;
			}
			
			Dialog.hide();
			self.renderParamEditor();
			self.triggerEditChange();
		} ); // Dialog.confirm
		
		var change_param_type = function(new_type) {
			$('#d_epa_value_text, #d_epa_value_textarea, #d_epa_value_code, #d_epa_value_checkbox, #d_epa_value_select, #d_epa_value_hidden, #d_epa_value_toolset').hide();
			$('#d_epa_value_' + new_type).show();
			$('#d_epa_required').toggle( !!new_type.match(/^(text|textarea|code)$/) );
			$('#d_epa_text_variant').toggle( !!new_type.match(/^(text)$/) );
			$('#d_epa_locked').toggle( !new_type.match(/^(toolset)$/) );
			Dialog.autoResize();
		}; // change_action_type
		
		change_param_type(param.type);
		
		$('#fe_epa_type').on('change', function() {
			change_param_type( $(this).val() );
		}); // type change
		
		if (idx == -1) $('#fe_epa_id').focus();
		
		SingleSelect.init( $('#fe_epa_type, #fe_epa_text_variant') );
		Dialog.autoResize();
	}
	
	deleteParam(idx) {
		// delete selected param
		this.params.splice( idx, 1 );
		this.renderParamEditor();
		this.triggerEditChange();
	}
	
	validateToolsetData(param) {
		// ensure toolset data is properly formatted
		var data = param.data;
		var err_prefix = "Toolset Data Error: ";
		
		if (!data) return app.doError(err_prefix + "Toolset has no data property.");
		if (!data.tools) return app.doError(err_prefix + "Top-level tools data property is missing.");
		if (!data.tools.length) return app.doError(err_prefix + "No tools specified in toolset (at least one is required).");
		
		var is_valid = true;
		var err_msg = "";
		var ids = {};
		
		data.tools.forEach( function(tool, idx) {
			if (!is_valid) return;
			
			// id
			if (!tool.id) { err_msg = `Tool #${idx+1} is missing an ID.`; is_valid = false; return; }
			if (typeof(tool.id) != 'string') { err_msg = `Tool #${idx+1} ID is not a string.`; is_valid = false; return; }
			if (!tool.id.match(/^[\w\-\.]+$/)) { err_msg = `Tool #${idx+1} ID must contain only alphanumerics, underscore, dash and period.`; is_valid = false; return; }
			if (!tool.id.match(/^[A-Za-z_]/)) { err_msg = `Tool #${idx+1} ID must begin with an alpha character or underscore.`; is_valid = false; return; }
			if (tool.id.match(app.MATCH_BAD_KEY)) { err_msg = `Tool '${tool.id}' ID is invalid (reserved word).`; is_valid = false; return; }
			
			if (ids[tool.id]) { err_msg = `Tool ID '${tool.id}' is duplicated (each must be unique).`; is_valid = false; return; }
			ids[tool.id] = 1;
			
			// title
			if (!tool.title || !tool.title.length) { err_msg = `Tool '${tool.id}' is missing a title.`; is_valid = false; return; }
			if (typeof(tool.title) != 'string') { err_msg = `Tool '${tool.id}' title is not a string.`; is_valid = false; return; }
			if (tool.title.match(/[<>]/)) { err_msg = `Tool '${tool.id}' title contains invalid characters.`; is_valid = false; return; }
			
			// description
			if ('description' in tool) {
				if (typeof(tool.description) != 'string') { err_msg = `Tool '${tool.id}' description is not a string.`; is_valid = false; return; }
				if (tool.description.match(/[<>]/)) { err_msg = `Tool '${tool.id}' description contains invalid characters.`; is_valid = false; return; }
			}
			
			// fields
			if (!tool.fields) tool.fields = [];
			if (!Array.isArray(tool.fields)) { err_msg = `Tool '${tool.id}' fields is not an array.`; is_valid = false; return; }
			
			var fids = {};
			
			tool.fields.forEach( function(field, idx) {
				if (!is_valid) return;
				
				// id
				if (!field.id) { err_msg = `Tool '${tool.id}' field #${idx+1} is missing an ID.`; is_valid = false; return; }
				if (typeof(field.id) != 'string') { err_msg = `Tool '${tool.id}' field #${idx+1} ID is not a string.`; is_valid = false; return; }
				if (!field.id.match(/^[\w\-\.]+$/)) { err_msg = `Tool '${tool.id}' field #${idx+1} ID must contain only alphanumerics, underscore, dash and period.`; is_valid = false; return; }
				if (field.id.match(app.MATCH_BAD_KEY)) { err_msg = `Tool '${tool.id}' field '${field.id}' ID is invalid (reserved word).`; is_valid = false; return; }
				if (field.id == param.id) { err_msg = `Tool '${tool.id}' field '${field.id}' ID is invalid (cannot reuse toolset param ID).`; is_valid = false; return; }
				
				if (fids[field.id]) { err_msg = `Tool '${tool.id}' field ID ${field.id} is duplicated (each must be unique per tool).`; is_valid = false; return; }
				fids[field.id] = 1;
				
				// title
				if (!field.title || !field.title.length) { err_msg = `Tool '${tool.id}' field '${field.id}' is missing a title.`; is_valid = false; return; }
				if (typeof(field.title) != 'string') { err_msg = `Tool '${tool.id}' field '${field.id}' title is not a string.`; is_valid = false; return; }
				if (field.title.match(/[<>]/)) { err_msg = `Tool '${tool.id}' field '${field.id}' title contains invalid characters.`; is_valid = false; return; }
				
				// type
				if (!field.type || !field.type.length) { err_msg = `Tool '${tool.id}' field '${field.id}' is missing a type.`; is_valid = false; return; }
				if (typeof(field.type) != 'string') { err_msg = `Tool '${tool.id}' field '${field.id}' type is not a string.`; is_valid = false; return; }
				if (!field.type.match(/^(checkbox|code|hidden|select|text|textarea)$/)) { err_msg = `Tool '${tool.id}' field '${field.id}' type is invalid.`; is_valid = false; return; }
				
				// variant
				if ((field.type == 'text') && field.variant) {
					if (typeof(field.variant) != 'string') { err_msg = `Tool '${tool.id}' field '${field.id}' variant is not a string.`; is_valid = false; return; }
					if (!find_object(config.ui.text_field_variants, { id: field.variant })) { err_msg = `Tool '${tool.id}' field '${field.id}' variant is invalid.`; is_valid = false; return; }
				}
				
				// caption
				if (field.caption) {
					if (typeof(field.caption) != 'string') { err_msg = `Tool '${tool.id}' field '${field.id}' caption is not a string.`; is_valid = false; return; }
					if (field.caption.match(/[<>]/)) { err_msg = `Tool '${tool.id}' field '${field.id}' caption contains invalid characters.`; is_valid = false; return; }
				}
				
				// value
				if (!('value' in field)) { err_msg = `Tool '${tool.id}' field '${field.id}' is missing a value.`; is_valid = false; return; }
				if (field.type == 'checkbox') {
					if (typeof(field.value) != 'boolean') { err_msg = `Tool '${tool.id}' field '${field.id}' has an invalid checkbox value (must be boolean).`; is_valid = false; return; }
				}
				else {
					if (typeof(field.value) != 'string') { err_msg = `Tool '${tool.id}' field '${field.id}' has an invalid value (must be string).`; is_valid = false; return; }
				}
			}); // foreach field
		} ); // foreach tool
		
		if (!is_valid) return app.doError( err_prefix + err_msg );
		else return true;
	}
	
	editParamToolset() {
		// popup code editor to edit toolset JSON
		var elem_id = 'fe_epa_value_toolset';
		var elem_value = $('#' + elem_id).val();
		var title = 'Edit Toolset JSON';
		
		this.editCodeAuto(title, elem_value, function(new_value) {
			$('#' + elem_id).val( new_value );
		});
	}
	
	getParamEditor(fields, params, explore) {
		// get HTML for generic param editor
		// { "id":"script", "type":"textarea", "title":"Script Source", "value": "#!/bin/sh\n\n# Enter your shell script code here" },
		var self = this;
		var html = '';
		
		if (!fields || !fields.length) return '(No configurable parameters defined.)';
		
		var explore_start = '';
		var explore_end = '';
		if (explore) {
			explore_start = `<div class="form_row_compact"><div>`;
			explore_end = `</div><div class="form_suffix_icon mdi mdi-database-search-outline" title="Open Job Data Explorer..." onClick="$P().openJobDataExplorer(this)"></div></div>`;
		}
		
		fields.forEach( function(param) {
			var elem_id = 'fe_uf_' + param.id;
			var elem_value = (param.id in params) ? params[param.id] : param.value;
			var elem_dis = (param.locked && !app.isAdmin()) ? 'disabled' : undefined;
			var elem_icon = config.ui.control_type_icons[param.type];
			if (param.type == 'hidden') return;
			
			if (param.type != 'checkbox') html += '<div class="info_label">' + param.title + '</div>';
			html += '<div class="info_value">';
			
			switch (param.type) {
				case 'text':
					var text_args = { 
						id: elem_id, 
						type: param.variant || 'text', 
						value: elem_value, 
						class: 'monospace', 
						disabled: elem_dis, 
						autocomplete: 'off' 
					};
					if (!param.variant || param.variant.match(/^(password|text|tel)$/)) {
						// only show explorer icon for non-validating text variants
						html += explore_start + self.getFormText(text_args) + explore_end;
					}
					else {
						html += self.getFormText(text_args);
					}
				break;
				
				case 'textarea':
					html += explore_start + self.getFormTextarea({ 
						id: elem_id, 
						value: elem_value, 
						rows: 5, 
						class: 'monospace', 
						disabled: elem_dis 
					}) + explore_end;
				break;
				
				case 'code':
					// html += self.getFormTextarea({ id: elem_id, value: elem_value, rows: 5, class: 'monospace', disabled: elem_dis });
					html += self.getFormTextarea({ id: elem_id, value: elem_value, rows: 1, disabled: elem_dis, style: 'display:none', 'data-title': param.title });
					if (elem_dis) {
						html += '<div class="button small secondary" onClick="$P().viewParamCode(\'' + param.id + '\')"><i class="mdi mdi-code-json">&nbsp;</i>View Code...</div>';
					}
					else {
						html += '<div class="button small secondary" onClick="$P().editParamCode(\'' + param.id + '\')"><i class="mdi mdi-text-box-edit-outline">&nbsp;</i>Edit Code...</div>';
					}
				break;
				
				case 'checkbox':
					html += self.getFormCheckbox({ id: elem_id, label: param.title, checked: !!elem_value, disabled: elem_dis });
				break;
				
				case 'select':
					elem_value = (param.id in params) ? params[param.id] : param.value.replace(/\,.*$/, '');
					html += self.getFormMenu({ id: elem_id, value: elem_value, options: param.value.split(/\,\s*/), disabled: elem_dis });
				break;
			} // switch type
			
			if (param.caption) html += '<div class="info_caption">' + strip_html(param.caption) + '</div>';
			
			html += '</div>';
		} ); // foreach param
		
		return html;
	}
	
	viewParamCode(param_id) {
		// show param code (no editing)
		var elem_id = 'fe_uf_' + CSS.escape(param_id);
		var elem_value = $('#' + elem_id).val();
		var title = $('#' + elem_id).data('title');
		
		this.viewCodeAuto(title, elem_value);
	}
	
	editParamCode(param_id) {
		// open editor for code plugin param
		var self = this;
		var elem_id = 'fe_uf_' + CSS.escape(param_id);
		var elem_value = $('#' + elem_id).val();
		var title = $('#' + elem_id).data('title');
		
		this.editCodeAuto(title, elem_value, function(new_value) {
			$('#' + elem_id).val( new_value );
			if (!Dialog.active) self.triggerEditChange();
		});
	}
	
	getParamValues(fields, validate = true) {
		// get all values for params hash
		var params = {};
		var is_valid = true;
		if (!fields || !fields.length) return {}; // none defined
		
		fields.forEach( function(param) {
			if (param.type == 'hidden') params[ param.id ] = param.value;
			else if (param.type == 'checkbox') params[ param.id ] = !!$('#fe_uf_' + CSS.escape(param.id)).is(':checked');
			else {
				params[ param.id ] = $('#fe_uf_' + CSS.escape(param.id)).val();
				if (param.required && !params[ param.id ].length && validate) {
					app.badField('#fe_uf_' + CSS.escape(param.id), "The &ldquo;" + param.title + "&rdquo; field is required.");
					is_valid = false;
				}
				else if (validate && param.variant && !param.variant.match(/^(password|text|tel)$/) && !$('#fe_uf_' + param.id)[0].validity.valid) {
					app.badField('#fe_uf_' + CSS.escape(param.id), "The &ldquo;" + param.title + "&rdquo; field is invalid.");
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
			
			case 'interval':
				nice_icon = '<i class="mdi mdi-calendar-clock"></i>';
				nice_type = 'Schedule';
				short_desc = get_text_from_seconds(item.duration || 0, true, false);
				nice_desc = '<i class="mdi mdi-timer-sand">&nbsp;</i><b>Interval:</b> ' + get_text_from_seconds(item.duration || 0, false, false);
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
	
	// Run Event
	
	doRunEvent(event) {
		// show dialog to run event and collect user form fields, if applicable
		var self = this;
		var title = "Run Event";
		var btn = ['run-fast', 'Run Now'];
		app.clearError();
		
		if (typeof(event) == 'string') {
			event = find_object( app.events, { id: event } );
			if (!event) return app.doError("Event not found.");
		}
		
		var html = '';
		html += `<div class="dialog_intro">You are about to manually launch a job for the event &ldquo;<b>${event.title}</b>&rdquo;.  Please enter values for all the event-defined parameters if applicable.</div>`;
		html += '<div class="dialog_box_content scroll maximize">';
		
		// event may disallow files
		var ok_show_files = true;
		var limit = find_object( event.limits || [], { type: 'file', enabled: true } );
		if (limit && (limit.amount == 0)) ok_show_files = false;
		
		if (ok_show_files) {
			// user files
			var cap_suffix = '';
			if (limit) {
				var limit_args = this.getResLimitDisplayArgs(limit);
				cap_suffix += "  " + limit_args.nice_desc + " allowed.";
			}
			
			html += this.getFormRow({
				label: 'User Files:',
				content: this.getDialogFileUploader(limit),
				caption: 'Optionally upload and attach files to the job.' + cap_suffix
			});
		}
		
		// tags
		html += this.getFormRow({
			id: 'd_re_tags',
			content: this.getFormMenuMulti({
				id: 'fe_re_tags',
				options: app.tags,
				values: [],
				default_icon: 'tag-outline',
				// 'data-shrinkwrap': 1
			})
		});
		
		// user form fields
		html += this.getFormRow({
			label: 'User Parameters:',
			content: '<div class="plugin_param_editor_cont">' + this.getParamEditor(event.fields, {}) + '</div>',
			// caption: 'Enter values for all the event-defined parameters here.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			var fields = self.getParamValues(event.fields || []);
			if (!fields) return; // validation error
			
			var job = deep_copy_object(event);
			if (!job.params) job.params = {};
			merge_hash_into( job.params, fields );
			
			// add files if user uploaded
			if (self.dialogFiles && self.dialogFiles.length) {
				if (!job.input) job.input = {};
				job.input.files = self.dialogFiles;
				delete self.dialogFiles;
			}
			
			// add tags if specified
			var tags = $('#fe_re_tags').val();
			if (tags.length) job.tags = tags;
			
			Dialog.showProgress( 1.0, "Launching Job..." );
			
			app.api.post( 'app/run_event', job, function(resp) {
				Dialog.hideProgress();
				if (!self.active) return; // sanity
				
				// jump immediately to live job details page
				Nav.go('Job?id=' + resp.id);
			} ); // api.post
		}); // Dialog.confirm
		
		Dialog.onHide = function() {
			// cleanup
			// FUTURE: If self.dialogFiles still exists here, delete in background (user canceled job)
			delete self.dialogFiles;
		};
		
		MultiSelect.init( $('#fe_re_tags') );
		Dialog.autoResize();
	}
	
	getDialogFileUploader(limit) {
		// setup file upload subsystem for jobs (for use in dialog)
		var self = this;
		var html = '';
		var settings = config.job_upload_settings;
		var btn = '<div class="button small secondary" onClick="$P().uploadDialogFiles()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i>Upload Files...</div>';
		
		this.dialogFiles = [];
		
		if (!limit) limit = { amount: 0, size: 0, accept: "" };
		
		var max_files = 0;
		if (limit.amount) max_files = Math.min(limit.amount, settings.max_files_per_job);
		else max_files = settings.max_files_per_job;
		
		var max_size = 0;
		if (limit.size) max_size = Math.min(limit.size, settings.max_file_size);
		else max_size = settings.max_file_size;
		
		ZeroUpload.setURL( '/api/app/upload_job_input_files' );
		ZeroUpload.setMaxFiles( max_files );
		ZeroUpload.setMaxBytes( max_size );
		ZeroUpload.setFileTypes( limit.accept || settings.accepted_file_types );
		
		ZeroUpload.on('start', function() {
			$('#d_dialog_uploader').html( self.getNiceProgressBar(0, 'wider', true) );
		} );
		
		ZeroUpload.on('progress', function(progress) {
			self.updateProgressBar( progress.amount, $('#d_dialog_uploader .progress_bar_container') );
		} );
		
		ZeroUpload.on('complete', function(response, userData) {
			var data = null;
			try { data = JSON.parse( response.data ); }
			catch (err) {
				$('#d_dialog_uploader').html( btn );
				return app.doError("Upload Failed: JSON Parse Error: " + err);
			}
			
			if (data && (data.code != 0)) {
				$('#d_dialog_uploader').html( btn );
				return app.doError("Upload Failed: " + data.description);
			}
			
			// update local copy
			self.dialogFiles = self.dialogFiles.concat( data.files );
			
			var num_files = data.files.length;
			var total_size = 0;
			
			data.files.forEach( function(file) { total_size += file.size; } );
			
			$('#d_dialog_uploader').html(
				'<div class="button small secondary" onClick="$P().uploadDialogFiles()">' + 
					'<i class="mdi mdi-check-circle-outline">&nbsp;</i>' + commify(num_files) + ' ' + pluralize('file', num_files) + ' uploaded (' + get_text_from_bytes(total_size) + ')' + 
				'</div>'
			);
		} );
		
		ZeroUpload.on('error', function(type, message, userData) {
			$('#d_dialog_uploader').html( btn );
			return app.doError("Upload Failed: " + message);
		} );
		
		ZeroUpload.init();
		
		html += '<div id="d_dialog_uploader">';
			html += btn;
		html += '</div>';
		
		return html;
	}
	
	uploadDialogFiles() {
		// upload files using ZeroUpload (for progress, etc.)
		ZeroUpload.chooseFiles({}, {});
	}
	
};
