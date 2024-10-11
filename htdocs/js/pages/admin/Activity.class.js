// Admin Page -- Activity Log

Page.ActivityLog = class ActivityLog extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		app.setHeaderTitle( '<i class="mdi mdi-script-text-outline">&nbsp;</i>Activity Log' );
		app.setWindowTitle( "Activity Log" );
		
		// this.loading();
		
		this.gosub_search(args);
		return true;
	}
	
	gosub_search(args) {
		// search activity db
		var self = this;
		if (!args.offset) args.offset = 0;
		if (!args.limit) args.limit = 25;
		
		var action_items = [].concat( config.ui.list_list ).concat([
			{ "id": "jobs", "title": "Jobs", "icon": "timer-outline" },
			{ "id": "servers", "title": "Servers", "icon": "router-network" },
			{ "id": "peers", "title": "Conductors", "icon": "database" },
			{ "id": "system", "title": "System", "icon": "desktop-classic" }
		]);
		sort_by( action_items, 'title' );
		
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
		
		var html = '';
		html += '<div class="box" style="border:none;">';
		html += '<div class="box_content" style="padding:20px;">';
			
			// search box
			html += '<div class="search_box">';
				html += '<i class="mdi mdi-magnify" onMouseUp="$(\'#fe_sa_query\').focus()">&nbsp;</i>'; // TODO: fix search help url below:
				html += '<div class="search_help"><a href="https://github.com/jhuckaby/orchestra#search" target="_blank">Search Help<i class="mdi mdi-open-in-new"></i></a></div>';
				html += '<input type="text" id="fe_sa_query" maxlength="128" placeholder="Search Query..." value="' + escape_text_field_value(args.query || '') + '">';
			html += '</div>';
			
			// options
			html += '<div id="d_ss_adv" class="form_grid four" style="margin-bottom:25px">';
				
				// action
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-script-text-outline">&nbsp;</i>Activity Type:',
						content: this.getFormMenuSingle({
							id: 'fe_sa_action',
							title: 'Select Type',
							placeholder: 'All Types',
							options: [['', 'Any Type']].concat( action_items ),
							value: args.action || '',
							default_icon: '',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// user
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-account">&nbsp;</i>User:',
						content: this.getFormMenuSingle({
							id: 'fe_sa_username',
							title: 'Select User',
							placeholder: 'All Users',
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
							id: 'fe_sa_date',
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
						{ id: 'date_desc', title: 'Newest to Oldest', icon: 'sort-descending' },
						{ id: 'date_asc', title: 'Oldest to Newest', icon: 'sort-ascending' }
					];
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-sort">&nbsp;</i>Sort Results:',
						content: this.getFormMenuSingle({
							id: 'fe_sa_sort',
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
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		html += '<div id="d_search_results"><div class="loading_container"><div class="loading"></div></div></div>';
		
		this.div.html( html );
		
		var sargs = this.getSearchArgs();
		
		// MultiSelect.init( this.div.find('#fe_s_tags') );
		SingleSelect.init( this.div.find('#fe_sa_action, #fe_sa_username, #fe_sa_date, #fe_sa_sort') );
		// $('.header_search_widget').hide();
		
		this.div.find('#fe_sa_action, #fe_sa_username, #fe_sa_date, #fe_sa_sort').on('change', function() {
			self.navSearch();
		});
		
		$('#fe_sa_query').on('keydown', function(event) {
			// capture enter key
			if (event.keyCode == 13) {
				event.preventDefault();
				self.navSearch();
			}
		});
		
		$('#fe_sa_query').focus();
		this.doSearch();
	}
	
	getSearchArgs() {
		// get form values, return search args object
		var self = this;
		var args = {};
		
		var query = this.div.find('#fe_sa_query').val().trim()
		if (query.length) args.query = query;
		
		['action', 'username', 'date'].forEach( function(key) {
			var value = self.div.find('#fe_sa_' + key).val();
			if (value) args[key] = value;
		} );
		
		var sort = this.div.find('#fe_sa_sort').val();
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
		var self = this;
		var query = args.query ? args.query.toString().toLowerCase().trim() : '';
		
		if (args.action) {
			// each action is an alias -- lookup the individual actions for the query
			var re = new RegExp( config.ui.activity_search_map[args.action] || '.+' );
			var keys = [];
			for (var key in config.ui.activity_descriptions) {
				if (key.match(re)) keys.push( key );
			}
			if (keys.length) query += ' action:' + keys.join('|');
		}
		
		if (args.username) {
			query += ' keywords:' + args.username;
		}
		
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
		
		app.api.get( 'app/search_activity', this.opts, this.receiveResults.bind(this) );
	}
	
	receiveResults(resp) {
		// receive search results
		var self = this;
		var $results = this.div.find('#d_search_results');
		var html = '';
		
		if (!this.active) return; // sanity
		
		this.lastSearchResp = resp;
		this.items = [];
		if (resp.rows) this.items = resp.rows;
		
		var grid_args = {
			resp: resp,
			cols: ['Date/Time', 'Type', 'Description', 'User', 'IP Address', 'Actions'],
			data_type: 'item',
			offset: this.args.offset || 0,
			limit: this.args.limit,
			class: 'data_grid activity_grid',
			pagination_link: '$P().searchPaginate'
		};
		
		html += '<div class="box">';
		
		html += '<div class="box_title">';
			html += this.getSearchArgs() ? 'Search Results' : 'All Activity';
			html += '<div class="clear"></div>';
		html += '</div>';
		
		html += '<div class="box_content table">';
		
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
			
			var search_key = '';
			for (var key in config.ui.activity_search_map) {
				var regexp = new RegExp( config.ui.activity_search_map[key] );
				if (item.action.match(regexp)) {
					search_key = key;
					break;
				}
			}
			
			// compose nice description
			var desc = item.description;
			var actions = [];
			var color = '';
			var click = '';
			
			// description template
			var template = config.ui.activity_descriptions[item.action];
			if (template) desc = substitute(template, item, false);
			else if (!desc) desc = '(No description provided)';
			item._desc = desc;
			
			// fudge username
			if (!item.username && item.user && item.user.username) item.username = item.user.username;
			
			switch (search_key) {
				
				case 'alerts':
					if (item.alert) {
						click = `$P().showActionReport(${idx},'alert')`;
						actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
					}
				break;
				
				case 'api_keys':
					if (item.api_key) {
						click = `$P().showActionReport(${idx},'api_key')`;
						actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
					}
				break;
				
				case 'categories':
					if (item.category) {
						click = `$P().showActionReport(${idx},'category')`;
						actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
					}
				break;
				
				case 'channels':
					if (item.channel) {
						click = `$P().showActionReport(${idx},'channel')`;
						actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
					}
				break;
				
				case 'events':
					if (item.event) {
						click = `$P().showActionReport(${idx},'event')`;
						actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
					}
				break;
				
				case 'jobs':
					click = `$P().showActionReport(${idx},'job')`;
					actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
				break;
				
				case 'groups':
					if (item.group) {
						click = `$P().showActionReport(${idx},'group')`;
						actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
					}
				break;
				
				case 'monitors':
					if (item.monitor) {
						click = `$P().showActionReport(${idx},'monitor')`;
						actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
					}
				break;
				
				case 'plugins':
					if (item.plugin) {
						click = `$P().showActionReport(${idx},'plugin')`;
						actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
					}
				break;
				
				case 'tags':
					if (item.tag) {
						click = `$P().showActionReport(${idx},'tag')`;
						actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
					}
				break;
				
				case 'web_hooks':
					if (item.web_hook) {
						click = `$P().showActionReport(${idx},'web_hook')`;
						actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
					}
				break;
				
				case 'users':
					if (item.user) {
						click = `$P().showActionReport(${idx},'user')`;
						actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
					}
				break;
				
				case 'servers':
					actions.push(`<a href="#Servers?id=${item.server_id}"><b>Go to Server...</b></a>`);
				break;
				
			} // search_key
			
			switch (item.action) {
				// system
				case 'peer_command':
					click = `$P().showActionReport(${idx},'blarg')`;
					actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
				break;
				
				case 'state_update':
					click = `$P().showActionReport(${idx},'blarg')`;
					actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
				break;
				
				case 'internal_job':
					click = `$P().showInternalJobReport(${idx})`;
					actions.push(`<span class="link" onClick="${click}"><b>Details...</b></span>`);
				break;
				
				// misc
				case 'error':
					desc = encode_entities( item.description );
					color = 'red';
				break;
				case 'warning':
					desc = encode_entities( item.description );
					color = 'yellow';
				break;
				case 'notice':
					desc = encode_entities( item.description );
				break;
			} // action
			
			if (click) {
				desc = `<span class="link" onClick="${click}">${desc}</span>`;
			}
			
			var tds = [
				'' + self.getRelativeDateTime( item.epoch ) + '',
				'<div class="td_big" style="white-space:nowrap; font-weight:normal;"><i class="mdi mdi-' + item_type.icon + '">&nbsp;</i>' + item_type.label + '</div>',
				'' + desc + '',
				'' + self.getNiceUser(item.username, true) + '',
				(item.ip || 'n/a'),
				'' + actions.join(' | ') + ''
			];
			if (color) tds.className = color;
			
			return tds;
		} ); // getPaginatedGrid
		
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
	
	showActionReport(idx, obj_key) {
		// pop dialog for any action
		var item = this.items[idx];
		var template = config.ui.activity_descriptions[item.action];
		
		// massage a title out of description template (ugh)
		var title = template.replace(/\:\s+.+$/, '').replace(/\s+\(.+$/, '');
		var md = '';
		
		// summary
		md += "### Summary\n\n";
		// md += '- **Category:** <i class="mdi mdi-' + item._type.icon + '">&nbsp;</i>' + item._type.label + "\n";
		md += '- **Description:** <i class="mdi mdi-' + item._type.icon + '">&nbsp;</i>' + item._desc + "\n";
		md += '- **Date/Time:** ' + this.getRelativeDateTime(item.epoch) + "\n";
		
		// user info
		md += "\n### Client Info\n\n";
		md += '- **User:** ' + this.getNiceUser(item.username, true) + "\n";
		md += '- **IP Addresses:** ' + item.ips.join(', ') + "\n";
		md += '- **User Agent:** ' + (item.useragent || 'Unknown') + "\n";
		
		// headers
		if (item.headers) {
			md += "\n### Request Headers\n\n";
			md += '```http' + "\n";
			for (var key in item.headers) {
				md += key + ": " + item.headers[key] + "\n";
			}
			md += '```' + "\n";
		}
		
		// the thing
		if (item[obj_key]) {
			md += "\n### " + item._type.label + " JSON\n\n";
			md += '```json' + "\n";
			md += JSON.stringify( item[obj_key], null, "\t" ) + "\n";
			md += '```' + "\n";
		}
		else {
			var temp = deep_copy_object(item);
			delete temp.headers;
			
			md += "\n### Raw JSON\n\n";
			md += '```json' + "\n";
			md += JSON.stringify( temp, null, "\t" ) + "\n";
			md += '```' + "\n";
		}
		
		// md += "\n*(End of report)*\n";
		
		this.viewMarkdownAuto( title, md );
	}
	
	showInternalJobReport(idx) {
		// pop dialog with internal job report (markdown)
		var item = this.items[idx];
		var job = item.job;
		
		var md = '';
		md += "### Summary\n\n";
		md += "- **Job ID:** " + job.id + "\n";
		md += "- **Job Title:** " + job.title + "\n";
		md += "- **Job Type:** " + this.getNiceInternalJobType(job.type) + "\n";
		md += "- **Requested By:** " + this.getNiceUser(job.username) + "\n";
		
		md += "\n### Timing\n\n";
		md += "- **Started:** " + this.getRelativeDateTime(job.started, true) + "\n";
		md += "- **Completed:** " + this.getRelativeDateTime(job.completed, true) + "\n";
		md += "- **Elapsed:** " + this.getNiceJobElapsedTime(job, false, true) + "\n";
		
		if (job.details) {
			md += "\n";
			md += job.details.trim() + "\n";
		}
		else {
			md += "\n### Details\n\n";
			md += "No details provided.\n";
		}
		
		// md += "\n*(End of report)*\n";
		
		this.viewMarkdownAuto( "Internal Job Report", md );
	}
	
	onPageUpdate(pcmd, pdata) {
		// new activity added, refresh search results if we're at offset 0
		if ((pcmd == 'activity') && !this.args.offset) {
			app.cacheBust = hires_time_now();
			this.doSearch();
		}
	}
	
	onDeactivate() {
		// called when page is deactivated
		delete this.items;
		delete this.lastSearchResp;
		this.div.html( '' );
		return true;
	}
	
};
