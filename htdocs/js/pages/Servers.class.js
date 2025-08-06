// Server List and Server Details

// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the PixlCore Sustainable Use License.
// See the LICENSE.md file in this repository.

Page.Servers = class Servers extends Page.ServerUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'es';
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
		// show event list
		app.setWindowTitle( "Servers" );
		app.setHeaderTitle( '<i class="mdi mdi-server">&nbsp;</i>Servers' );
		
		// this.loading();
		// app.api.post( 'app/get_events', copy_object(args), this.receive_events.bind(this) );
		
		var servers = Object.values(app.servers);
		
		// merge in recently offline servers
		for (var server_id in app.serverCache) {
			if (!app.servers[server_id]) {
				servers.push( merge_objects(app.serverCache[server_id], { offline: true }) );
			}
		}
		
		this.receive_servers({
			code: 0,
			rows: servers,
			list: { length: servers.length }
		});
	}
	
	receive_servers(resp) {
		// receive all servers, render them sorted
		var self = this;
		var args = this.args;
		var now = time_now();
		var html = '';
		
		// build opt groups for server props like OS, CPU, etc.
		var opt_groups = { os_platform: {}, os_distro: {}, os_release: {}, os_arch: {}, cpu_virt: {}, cpu_type: {}, cpu_cores: {} };
		
		resp.rows.forEach( function(server) {
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
			this.buildOptGroup( app.groups, "Server Groups:", 'server-network', 'g_' ),
			this.buildOptGroup( opt_groups.os_platform, "OS Platform:", '', 'osp_' ),
			this.buildOptGroup( opt_groups.os_distro, "OS Distro:", '', 'osd_' ),
			this.buildOptGroup( opt_groups.os_release, "OS Release:", '', 'osr_' ),
			this.buildOptGroup( opt_groups.os_arch, "OS Arch:", '', 'osa_' ),
			this.buildOptGroup( opt_groups.cpu_type, "CPU Type:", '', 'cput_' ),
			this.buildOptGroup( opt_groups.cpu_cores, "CPU Cores:", '', 'cpuc_' ),
			this.buildOptGroup( opt_groups.cpu_virt, "Virtualization:", '', 'virt_' )
		);
		
		// sort servers by label/hostname ascending
		this.servers = resp.rows.sort( function(a, b) {
			return (a.title || a.hostname).toLowerCase().localeCompare( (b.title || b.hostname).toLowerCase() );
		} );
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['Server', 'IP Address', 'Groups', '# CPUs', 'RAM', 'OS', 'Uptime', '# Jobs', '# Alerts'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			// html += '<div class="header_search_widget"><i class="mdi mdi-magnify">&nbsp;</i><input type="text" size="15" placeholder="Search"/></div>';
			
			html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(\'#fe_es_search\').focus()">&nbsp;</i><input type="text" id="fe_es_search" placeholder="Filter" value="' + encode_attrib_entities(args.search ?? '') + '" onInput="$P().applyTableFilters()"/></div>';
			
			html += '<div class="box_title_widget" style="overflow:visible; min-width:120px; max-width:200px; font-size:13px;">' + this.getFormMenuSingle({
				id: 'fe_es_filter',
				title: 'Filter server list',
				options: filter_opts,
				value: args.filter || '',
				onChange: '$P().applyTableFilters()',
				'data-shrinkwrap': 1
			}) + '</div>';
			
			html += 'Active Servers';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var grid_opts = {
			rows: this.servers,
			cols: cols,
			data_type: 'server',
			below: '<ul class="grid_row_empty" id="ul_es_none_found" style="display:none"><div style="grid-column-start: span ' + cols.length + ';">No servers found matching your filters.</div></ul>'
		};
		
		html += this.getBasicGrid( grid_opts, function(item, idx) {
			var classes = [];
			if (!item.info) item.info = {};
			if (!item.info.os) item.info.os = { distro: 'Unknown', release: '' };
			if (!item.info.cpu) item.info.cpu = {};
			if (!item.info.memory) item.info.memory = {};
			
			var nice_jobs = 'Idle';
			var num_jobs = find_objects( app.activeJobs, { server: item.id } ).length;
			if (num_jobs > 0) nice_jobs = '<i class="mdi mdi-autorenew mdi-spin">&nbsp;</i><b>' + num_jobs + '</b>';
			
			var nice_alerts = 'None';
			var num_alerts = find_objects( app.activeAlerts, { server: item.id } ).length;
			if (num_alerts > 0) nice_alerts = '<i class="mdi mdi-bell-outline">&nbsp;</i><b>' + num_alerts + '</b>';
			
			var tds = [
				'<span style="font-weight:bold">' + self.getNiceServer(item, true) + '</span>',
				self.getNiceIP(item.ip),
				self.getNiceGroupList(item.groups, true),
				'<i class="mdi mdi-chip">&nbsp;</i>' + (item.info.cpu.cores || 0),
				'<i class="mdi mdi-memory">&nbsp;</i>' + get_text_from_bytes(item.info.memory.total || 0),
				self.getNiceShortOS(item.info.os),
				item.info.booted ? self.getNiceUptime( now - item.info.booted ) : 'n/a',
				'<div id="d_es_server_jobs_' + item.id + '">' + nice_jobs + '</div>',
				nice_alerts // no need for div here: alert change redraws entire table
			];
			
			if (item.offline) classes.push('disabled');
			if (num_alerts > 0) classes.push( 'clr_red' );
			if (classes.length) tds.className = classes.join(' ');
			return tds;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button secondary" onMouseUp="$P().go_server_search()"><i class="mdi mdi-magnify">&nbsp;</i>Search History...</div>';
			html += '<div class="button default" onMouseUp="$P().showAddServerDialog()"><i class="mdi mdi-plus-circle-outline">&nbsp;</i>Add Server...</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.applyTableFilters();
		SingleSelect.init( this.div.find('#fe_es_filter') );
	}
	
	go_server_search() {
		Nav.go('#Servers?sub=search');
	}
	
	applyTableFilters() {
		// filters and/or search query changed -- re-filter table
		var self = this;
		var args = this.args;
		var num_visible = 0;
		
		args.search = $('#fe_es_search').val();
		args.filter = $('#fe_es_filter').val();
		if (!args.search.length) delete args.search;
		if (!args.filter.length) delete args.filter;
		var is_filtered = (('search' in args) || ('filter' in args));
		
		this.div.find('.box_content.table ul.grid_row').each( function(idx) {
			var $this = $(this);
			var row = self.servers[idx];
			
			if (self.isRowVisible(row)) { $this.show(); num_visible++; }
			else $this.hide();
		} );
		
		// if ALL items are hidden due to search/filter, show some kind of message
		if (!num_visible && is_filtered && this.servers.length) this.div.find('#ul_es_none_found').show();
		else this.div.find('#ul_es_none_found').hide();
		
		// do history.replaceState jazz here
		// don't mess up initial visit href
		// var query = deep_copy_object(args);
		// delete query.sub;
		
		// var url = '#Servers' + (num_keys(query) ? compose_query_string(query) : '');
		// history.replaceState( null, '', url );
		// Nav.loc = url.replace(/^\#/, '');
		
		// magic trick: replace link in sidebar for Events
		// $('#tab_Servers').attr( 'href', url );
	}
	
	isRowVisible(item) {
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
				
				case 'g':
					if (!item.groups.includes(value)) return false; // hide
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
					if (crammify(item.info.cpu.brand) != value) return false; // hide
				break;
				
				case 'cpuc':
					if (crammify(item.info.cpu.cores) != value) return false; // hide
				break;
			} // switch mode
		}
		
		return true; // show
	}
	
	handleStatusUpdateList(data) {
		// received status update from server
		var self = this;
		
		// only redraw status fields if jobs changed
		if (!data.jobsChanged) return;
		
		this.servers.forEach( function(item, idx) {
			var nice_jobs = 'Idle';
			var num_jobs = find_objects( app.activeJobs, { server: item.id } ).length;
			if (num_jobs > 0) nice_jobs = '<i class="mdi mdi-autorenew mdi-spin">&nbsp;</i><b>' + num_jobs + '</b>';
			
			self.div.find('#d_es_server_jobs_' + item.id).html( nice_jobs );
		} );
	}
	
	//
	// Server Search Page:
	//
	
	gosub_search(args) {
		// search server db
		if (!args.offset) args.offset = 0;
		if (!args.limit) args.limit = config.items_per_page;
		
		app.setWindowTitle('Server Search');
		app.setHeaderNav([
			{ icon: 'server', loc: '#Servers?sub=list', title: 'Servers' },
			{ icon: 'cloud-search-outline', title: 'Search' }
		]);
		
		this.loading();
		// this.loading();
		
		app.api.get( 'app/get_server_summaries', {}, this.receiveSearchSummaries.bind(this) );
	}
	
	receiveSearchSummaries(resp) {
		// convert summaries to menu items for search box
		var self = this;
		var args = this.args;
		
		if (!this.active) return; // sanity
		
		var field_menus = {};
		for (var field_id in resp.summaries) {
			var labels = resp.summaries[field_id].labels || {};
			field_menus[field_id] = Object.keys(labels).sort().map( function(id) {
				return { id: id, title: labels[id] };
			} );
		}
		
		// resort cpu_cores numerically
		field_menus.cpu_cores.sort( function(a, b) { return parseInt(a.id) - parseInt(b.id); } );
		
		var date_items = config.ui.date_range_menu_items;
		
		var html = '';
		html += '<div class="box" style="border:none;">';
		html += '<div class="box_content" style="padding:20px;">';
			
			// search box
			html += '<div class="search_box">';
				html += '<i class="mdi mdi-magnify" onMouseUp="$(\'#fe_ss_query\').focus()">&nbsp;</i>'; // TODO: fix search help url below:
				html += '<div class="search_help"><a href="https://github.com/pixlcore/opsrocket#search" target="_blank">Search Help<i class="mdi mdi-open-in-new"></i></a></div>';
				html += '<input type="text" id="fe_ss_query" maxlength="128" placeholder="Search Keywords..." value="' + escape_text_field_value(args.query || '') + '">';
			html += '</div>';
			
			// options
			html += '<div class="form_grid" style="margin-bottom:25px">';
				
				// group
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-server-network">&nbsp;</i>Group:',
						content: this.getFormMenuSingle({
							id: 'fe_ss_groups',
							title: 'Select Group',
							placeholder: 'All Groups',
							options: [['', 'Any Group']].concat( app.groups ),
							value: args.groups || '',
							default_icon: 'server-network',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// os_platform -- laptop
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-laptop">&nbsp;</i>OS Platform:',
						content: this.getFormMenuSingle({
							id: 'fe_ss_os_platform',
							title: 'Select Platform',
							placeholder: 'All Platforms',
							options: [['', 'Any Platform']].concat( field_menus.os_platform ),
							value: args.os_platform || '',
							default_icon: 'laptop',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// os_distro -- harddisk
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-harddisk">&nbsp;</i>OS Distribution:',
						content: this.getFormMenuSingle({
							id: 'fe_ss_os_distro',
							title: 'Select Distro',
							placeholder: 'All Distros',
							options: [['', 'Any Distro']].concat( field_menus.os_distro ),
							value: args.os_distro || '',
							default_icon: 'harddisk',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// os_release -- pound
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-pound">&nbsp;</i>OS Release:',
						content: this.getFormMenuSingle({
							id: 'fe_ss_os_release',
							title: 'Select Release',
							placeholder: 'All Releases',
							options: [['', 'Any Release']].concat( field_menus.os_release ),
							value: args.os_release || '',
							default_icon: 'pound',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// os_arch -- archive
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-archive">&nbsp;</i>OS Architecture:',
						content: this.getFormMenuSingle({
							id: 'fe_ss_os_arch',
							title: 'Select Architecture',
							placeholder: 'All Architectures',
							options: [['', 'Any Architecture']].concat( field_menus.os_arch ),
							value: args.os_arch || '',
							default_icon: 'archive',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// cpu_brand -- chip
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-chip">&nbsp;</i>CPU Brand:',
						content: this.getFormMenuSingle({
							id: 'fe_ss_cpu_brand',
							title: 'Select Brand',
							placeholder: 'All Brands',
							options: [['', 'Any Brand']].concat( field_menus.cpu_brand ),
							value: args.cpu_brand || '',
							default_icon: 'chip',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// cpu_cores -- cpu-64-bit
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-pound">&nbsp;</i>CPU Cores:',
						content: this.getFormMenuSingle({
							id: 'fe_ss_cpu_cores',
							title: 'Select Cores',
							placeholder: 'All Core Counts',
							options: [['', 'Any Core Count']].concat( field_menus.cpu_cores ),
							value: args.cpu_cores || '',
							default_icon: 'pound',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// cpu_virt -- layers-outline
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-layers-outline">&nbsp;</i>Virtualization:',
						content: this.getFormMenuSingle({
							id: 'fe_ss_cpu_virt',
							title: 'Select Vendor',
							placeholder: 'All Vendors',
							options: [['', 'Any Vendor']].concat( field_menus.cpu_virt ),
							value: args.cpu_virt || '',
							default_icon: 'layers-outline',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// created
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-calendar-multiple">&nbsp;</i>Created:',
						content: this.getFormMenuSingle({
							id: 'fe_ss_created',
							title: 'Date Range',
							options: date_items.map( function(item) { 
								return item[0] ? { id: item[0], title: item[1], icon: 'calendar-range' } : item; 
							} ),
							value: args.created,
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// modified
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-calendar-multiple">&nbsp;</i>Last Modified:',
						content: this.getFormMenuSingle({
							id: 'fe_ss_modified',
							title: 'Date Range',
							options: date_items.map( function(item) { 
								return item[0] ? { id: item[0], title: item[1], icon: 'calendar-range' } : item; 
							} ),
							value: args.modified,
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
			html += '</div>'; // form_grid
		
		// buttons at bottom
		html += '<div class="box_buttons" style="padding:0">';
			html += '<div id="btn_search_opts" class="button" onClick="$P().toggleSearchOpts()"><i>&nbsp;</i><span>Options<span></div>';
			html += '<div id="btn_ss_reset" class="button" style="display:none" onClick="$P().resetFilters()"><i class="mdi mdi-undo-variant">&nbsp;</i>Reset</div>';
			html += '<div class="button primary" onMouseUp="$P().navSearch()"><i class="mdi mdi-magnify">&nbsp;</i>Search</div>';
			// html += '<div class="clear"></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		html += '<div id="d_search_results"><div class="loading_container"><div class="loading"></div></div></div>';
		
		this.div.html( html );
		
		var sargs = this.getSearchArgs();
		// if (!sargs) this.div.find('#btn_s_save').addClass('disabled');
		
		// MultiSelect.init( this.div.find('#fe_s_tags') );
		SingleSelect.init( this.div.find('#fe_ss_groups, #fe_ss_os_platform, #fe_ss_os_distro, #fe_ss_os_release, #fe_ss_os_arch, #fe_ss_cpu_virt, #fe_ss_cpu_brand, #fe_ss_cpu_cores, #fe_ss_created, #fe_ss_modified') );
		// $('.header_search_widget').hide();
		this.setupSearchOpts();
		
		this.div.find('#fe_ss_groups, #fe_ss_os_platform, #fe_ss_os_distro, #fe_ss_os_release, #fe_ss_os_arch, #fe_ss_cpu_virt, #fe_ss_cpu_brand, #fe_ss_cpu_cores, #fe_ss_created, #fe_ss_modified').on('change', function() {
			self.navSearch();
		});
		
		$('#fe_ss_query').on('keydown', function(event) {
			// capture enter key
			if (event.keyCode == 13) {
				event.preventDefault();
				self.navSearch();
			}
		});
		
		$('#fe_ss_query').focus();
		this.doSearch();
	}
	
	resetFilters() {
		// reset all filters to default and re-search
		Nav.go( this.selfNav({ sub: 'search' }) );
	}
	
	getSearchArgs() {
		// get form values, return search args object
		var self = this;
		var args = {};
		
		var query = this.div.find('#fe_ss_query').val().trim()
		if (query.length) args.query = query;
		
		['groups', 'os_platform', 'os_distro', 'os_release', 'os_arch', 'cpu_virt', 'cpu_brand', 'cpu_cores', 'created', 'modified'].forEach( function(key) {
			var value = self.div.find('#fe_ss_' + key).val();
			if (value) args[key] = value;
		} );
		
		if (!num_keys(args)) return null;
		
		return args;
	}
	
	navSearch() {
		// convert form into query and redirect
		app.clearError();
		
		var args = this.getSearchArgs();
		if (!args) {
			// return app.badField('#fe_ss_query', "Please enter a search query.");
			// args = { query: '*' };
			Nav.go( this.selfNav({ sub: 'search' }) );
			return;
		}
		
		args.sub = 'search';
		Nav.go( this.selfNav(args) );
	}
	
	getSearchQuery(args) {
		// construct actual unbase simple query syntax
		var self = this;
		var query = args.query ? args.query.toString().toLowerCase().trim() : '';
		
		['groups', 'os_platform', 'os_distro', 'os_release', 'os_arch', 'cpu_virt', 'cpu_brand', 'cpu_cores'].forEach( function(key) {
			if (args[key]) query += ' ' + key + ':' + args[key];
		} );
		
		['created', 'modified'].forEach( function(key) {
			if (!args[key]) return;
			query += ' ' + self.getDateRangeQuery(key, args[key]);
		} ); // dates
		
		return query.trim();
	}
	
	doSearch() {
		// actually perform the search
		var args = this.args;
		var query = this.getSearchQuery(args);
		
		if (query) this.div.find('#btn_ss_reset').show();
		else this.div.find('#btn_ss_reset').hide();
		
		// compose search query
		var sopts = {
			query: query,
			offset: args.offset || 0,
			limit: args.limit || config.items_per_page,
		};
		app.api.get( 'app/search_servers', sopts, this.receiveResults.bind(this) );
	}
	
	receiveResults(resp) {
		// receive search results
		var self = this;
		var $results = this.div.find('#d_search_results');
		var html = '';
		
		if (!this.active) return; // sanity
		
		// massage the DB search resp so that things are happy
		// resp.rows = resp.records;
		// resp.list = { length: resp.total };
		
		this.lastSearchResp = resp;
		this.servers = [];
		if (resp.rows) this.servers = resp.rows;
		
		var grid_args = {
			resp: resp,
			cols: ['Server', 'IP Address', 'Groups', '# CPUs', 'RAM', 'OS', 'Created', 'Modified'],
			data_type: 'server',
			offset: this.args.offset || 0,
			limit: this.args.limit,
			sort_by: 'hostname', // FUTURE: Add a sort menu?
			sort_dir: 1,
			class: 'data_grid server_search_grid',
			pagination_link: '$P().searchPaginate'
		};
		
		html += '<div class="box">';
		
		html += '<div class="box_title" style="' + (this.servers.length ? 'padding-bottom:10px' : '') + '">';
			html += this.getSearchArgs() ? 'Search Results' : 'All Servers';
			html += '<div class="clear"></div>';
		html += '</div>';
		
		html += '<div class="box_content table">';
		
		html += this.getPaginatedGrid( grid_args, function(item, idx) {
			return [
				'<b>' + self.getNiceServer(item, true) + '</b>',
				self.getNiceIP(item.ip),
				self.getNiceGroupList(item.groups, true),
				'<i class="mdi mdi-chip">&nbsp;</i>' + (item.info.cpu.cores || 0),
				'<i class="mdi mdi-memory">&nbsp;</i>' + get_text_from_bytes(item.info.memory.total || 0),
				self.getNiceShortOS(item.info.os),
				self.getRelativeDateTime( item.created ),
				self.getRelativeDateTime( item.modified )
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
	
	//
	// View Page
	//
	
	gosub_view(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		this.args.limit = config.items_per_page;
		
		app.showSidebar(true);
		app.setHeaderTitle( '...' );
		
		this.loading();
		app.api.get( 'app/get_server', { id: args.id }, this.receive_snapshot.bind(this), this.fullPageError.bind(this) );
		return true;
	}
	
	updateHeaderNav() {
		// update header nav with current server info (icon/title may change, etc.)
		var server = this.server;
		var online = this.online;
		
		var server_icon = server.icon || (online ? 'router-network' : 'network-outline');
		var badge_icon = online ? 'check-circle' : 'circle-outline';
		var badge_color = online ? 'green' : 'gray';
		var badge_title = online ? 'Online' : 'Offline';
		
		if (online && !server.enabled) {
			badge_color = 'red';
			badge_title = 'Disabled';
			badge_icon = 'close-network-outline';
		}
		
		app.setHeaderNav([
			{ icon: 'server', loc: '#Servers?sub=list', title: 'Servers' },
			{ icon: server_icon, title: server.title || server.hostname },
			{ type: 'badge', color: badge_color, icon: badge_icon, title: badge_title }
		]);
		
		app.setWindowTitle( "Viewing Server: " + (server.title || server.hostname) + "" );
	}
	
	getWatchButton() {
		// get dynamic watch button html based on current server watch status
		var server = this.server;
		var icon = 'bullseye';
		var label = 'Watch...';
		var extra_classes = '';
		
		if (app.state && app.state.watches && app.state.watches.servers && app.state.watches.servers[server.id] && (app.state.watches.servers[server.id] > app.epoch)) {
			// currently watching this server
			icon = 'bullseye-arrow';
			label = 'Watching...';
			extra_classes = 'marquee';
		}
		
		return `<div class="button secondary mobile_collapse sm_hide ${extra_classes}" onClick="$P().openWatchDialog()"><i class="mdi mdi-${icon}">&nbsp;</i><span>${label}</span></div>`;
	}
	
	updateWatchButton() {
		// update dynamic watch button based on current state
		this.div.find('#d_vs_watch_btn').html( this.getWatchButton() );
	}
	
	receive_snapshot(resp) {
		// render snapshot details
		var self = this;
		var args = this.args;
		var { server, data, online } = resp;
		var html = '';
		
		// make sure page is still active (API may be slow)
		if (!this.active) return;
		
		this.server = server;
		var snapshot = this.snapshot = data;
		this.online = online;
		this.charts = {};
		
		this.updateHeaderNav();
		
		html += '<div class="box" style="border:none;">';
			html += '<div class="box_title">';
				html += '<div class="box_title_left">' + (online ? 'Live &mdash; Real-Time View' : 'Offline &mdash; Last <span class="sm_hide">Known</span> State') + '</div>';
				html += '<div class="box_title_left"><div class="button secondary mobile_collapse" onClick="$P().chooseHistoricalView()"><i class="mdi mdi-calendar-cursor">&nbsp;</i><span>Change...</span></div></div>';
				
				html += '<div class="box_title_right"><div class="button default mobile_collapse" onClick="$P().showEditServerDialog()"><i class="mdi mdi-file-edit-outline">&nbsp;</i><span>Edit Server...</span></div></div>';
				
				if (online) {
					html += '<div class="box_title_right"><div class="button mobile_collapse sm_hide" onClick="$P().createSnapshot()"><i class="mdi mdi-monitor-eye">&nbsp;</i><span>Snapshot</span></div></div>';
					html += '<div class="box_title_right" id="d_vs_watch_btn">' + this.getWatchButton() + '</div>';
				}
			html += '</div>';
		html += '</div>';
		
		html += '<div class="box">';
			html += '<div class="box_title">';
				html += 'Server Summary';
				if (!online) html += '<span class="sm_hide">&nbsp;&mdash; As of ' + this.getShortDateTimeText(snapshot.date) + '</span>';
				
				html += '<div class="button icon right danger" title="Delete Server..." onClick="$P().goDeleteServer()"><i class="mdi mdi-trash-can-outline"></i></div>';
				html += '<div class="button icon right secondary sm_hide" title="Job History..." onClick="$P().goJobHistory()"><i class="mdi mdi-cloud-search-outline"></i></div>';
				html += '<div class="button icon right secondary sm_hide" title="Alert History..." onClick="$P().goAlertHistory()"><i class="mdi mdi-restore-alert"></i></div>';
				html += '<div class="button icon right secondary" title="Server History..." onClick="$P().goServerHistory()"><i class="mdi mdi-script-text-outline"></i></div>';
				
				// if (!online) html += '<div class="box_title_note">As of ' + this.getShortDateTimeText(snapshot.date) + '</div>';
				// html += '<div class="button right danger" onMouseUp="$P().showDeleteSnapshotDialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i>Delete...</div>';
				// html += '<div class="button secondary right" onMouseUp="$P().do_edit_from_view()"><i class="mdi mdi-file-edit-outline">&nbsp;</i>Edit Event...</div>';
				// html += '<div class="button right" onMouseUp="$P().do_run_from_view()"><i class="mdi mdi-run-fast">&nbsp;</i>Run Now</div>';
				html += '<div class="clear"></div>';
			html += '</div>'; // title
			
			html += '<div class="box_content table">';
				html += '<div class="summary_grid">';
				
					// row 1
					html += '<div>';
						html += '<div class="info_label">Server ID</div>';
						html += '<div class="info_value monospace">' + this.getNiceCopyableID(server.id) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Server IP</div>';
						html += '<div class="info_value">' + this.getNiceIP(server.ip) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Server Hostname</div>';
						html += '<div class="info_value">' + server.hostname + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Server Label</div>';
						html += '<div class="info_value" id="d_vs_stat_label">' + (server.title || 'n/a') + '</div>';
					html += '</div>';
					
					// row 2
					html += '<div>';
						html += '<div class="info_label">Groups</div>';
						html += '<div class="info_value" id="d_vs_stat_groups">' + this.getNiceGroupList(server.groups) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Architecture</div>';
						html += '<div class="info_value">' + this.getNiceArch(server.info.arch) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Operating System</div>';
						html += '<div class="info_value">' + this.getNiceOS(server.info.os) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Uptime</div>';
						html += '<div class="info_value" id="d_vs_stat_uptime">' + this.getNiceUptime(snapshot.data.uptime_sec) + '</div>';
					html += '</div>';
					
					// row 3
					html += '<div>';
						html += '<div class="info_label">Total RAM</div>';
						html += '<div class="info_value">' + this.getNiceMemory(server.info.memory.total || 0) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">CPU Cores</div>';
						html += '<div class="info_value">' + server.info.cpu.physicalCores + ' physical, ' + server.info.cpu.cores + ' virtual</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">CPU Type</div>';
						html += '<div class="info_value">' + this.getNiceCPUType(server.info.cpu) + '</div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Virtualization</div>';
						html += '<div class="info_value">' + this.getNiceVirtualization(server.info.virt) + '</div>';
					html += '</div>';
					
					// row 4
					html += '<div>';
						html += '<div class="info_label">Alerts Today</div>';
						html += '<div class="info_value" id="d_vs_stat_at"></div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Jobs Today</div>';
						html += '<div class="info_value" id="d_vs_stat_jct"></div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Jobs Failed Today</div>';
						html += '<div class="info_value" id="d_vs_stat_jft"></div>';
					html += '</div>';
					
					html += '<div>';
						html += '<div class="info_label">Job Success Rate</div>';
						html += '<div class="info_value" id="d_vs_stat_jsr"></div>';
					html += '</div>';
					
				html += '</div>'; // summary grid
			html += '</div>'; // box content
		html += '</div>'; // box
		
		// alerts
		html += '<div class="box" id="d_vs_alerts" style="display:none">';
			html += '<div class="box_title">';
				html += 'Server Alerts';
				// html += '<div class="button right secondary" onMouseUp="$P().goAlertHistory()"><i class="mdi mdi-magnify">&nbsp;</i>Alert History...</div>';
				html += '<div class="clear"></div>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// jobs
		html += '<div class="box" id="d_vs_jobs" style="">';
			html += '<div class="box_title">';
				html += 'Server Jobs';
				// html += '<div class="button right secondary" onMouseUp="$P().goJobHistory()"><i class="mdi mdi-magnify">&nbsp;</i>Job History...</div>';
				html += '<div class="clear"></div>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// quickmon charts
		html += '<div class="box charts" id="d_vs_quickmon" style="display:none">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" onInput="$P().applyQuickMonitorFilter(this)"></div>';
				html += this.getChartSizeSelector('chart_size_quick');
				html += 'Quick Look &mdash; Last Minute';
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
				// html += this.getMemDetails(snapshot);
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// cpu details
		html += '<div class="box" id="d_vs_cpus">';
			html += '<div class="box_title">';
				html += 'CPU Details';
			html += '</div>';
			html += '<div class="box_content table">';
				// html += this.getCPUDetails(snapshot);
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// monitor dash grid
		html += '<div class="dash_grid" id="d_vs_dash_grid">';
			// html += this.getMonitorGrid(snapshot);
		html += '</div>';
		
		// monitors
		html += '<div class="box charts" id="d_vs_monitors">';
			html += '<div class="box_title">';
				html += '<div class="box_title_widget" style="overflow:visible; margin-left:0;"><i class="mdi mdi-magnify" onMouseUp="$(this).next().focus()">&nbsp;</i><input type="text" placeholder="Filter" value="" onInput="$P().applyMonitorFilter(this)"></div>';
				html += this.getChartSizeSelector();
				html += 'Server Monitors &mdash; ' + (online ? 'Last Hour' : 'Last Known State');
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
		
		// upcoming jobs
		html += '<div class="box" id="d_upcoming_jobs">';
			html += '<div class="box_title">';
				html += 'Upcoming Server Jobs';
			html += '</div>';
			html += '<div class="box_content table">';
				html += '<div class="loading_container"><div class="loading"></div></div>';
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html(html);
		
		SingleSelect.init( this.div.find('select.sel_chart_size') );
		
		this.updateServerStats();
		this.renderMonitorGrid();
		this.renderMemDetails();
		this.renderCPUDetails();
		this.setupMonitors();
		this.setupUpcomingJobs();
		
		if (online) {
			// some components are online-only
			this.getLiveAlerts();
			this.renderActiveJobs();
			this.setupQuickMonitors();
			if (!app.reducedMotion()) this.animate();
		}
		else {
			// offline only
			this.div.find('#d_vs_jobs').hide(); // hide jobs
			this.getSnapshotAlerts();
		}
		
		// SingleSelect.init( this.div.find('#fe_vs_mode, #fe_vs_year') );
	}
	
	setupUpcomingJobs() {
		// start prediction engine, will render when complete
		var self = this;
		
		this.getUpcomingJobs( app.events.filter( function(event) {
			return (event.targets || []).includes( self.server.id );
		} ) );
	}
	
	openWatchDialog() {
		// show dialog for setting or removing server watch
		var self = this;
		var server = this.server;
		var title = "Set Server Watch";
		var btn = ['check-circle', "Accept"];
		var cur_value = 300;
		
		if (app.state && app.state.watches && app.state.watches.servers && app.state.watches.servers[server.id] && (app.state.watches.servers[server.id] > app.epoch)) {
			cur_value = Math.floor( app.state.watches.servers[server.id] - app.epoch );
			if (cur_value >= 86400) cur_value -= (cur_value % 86400);
			else if (cur_value >= 3600) cur_value -= (cur_value % 3600);
			else if (cur_value >= 60) cur_value -= (cur_value % 60);
			else cur_value = 60; // min of 1 minute for dialog
		}
		
		var html = '';
		html += `<div class="dialog_intro">This allows you to set a "watch" on a server, which means that OpsRocket will take snapshots of it every minute until the watch duration elapses.</div>`;
		html += '<div class="dialog_box_content">';
		
		html += this.getFormRow({
			label: 'Watch Duration:',
			content: this.getFormRelativeTime({
				id: 'fe_vsw_duration',
				value: cur_value
			}),
			caption: 'Enter the desired duration for the watch.  Set to 0 to disable.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			var duration = parseInt( $('#fe_vsw_duration').val() );
			
			Dialog.showProgress( 1.0, duration ? "Setting Watch..." : "Removing Watch..." );
			app.api.post( 'app/watch_server', { id: server.id, duration }, function(resp) {
				// update complete
				Dialog.hideProgress();
				app.showMessage('success', "The server watch was " + (duration ? 'set' : 'removed') + " successfully.");
			}); // api.post
		}); // Dialog.confirm
		
		RelativeTime.init( $('#fe_vsw_duration') );
		$('#fe_vsw_duration_val').focus();
	}
	
	showEditServerDialog() {
		// show dialog for editing server details
		var self = this;
		var server = this.server;
		var title = "Edit Server Details";
		var btn = ['check-circle', "Save Changes"];
		
		var html = '<div class="dialog_box_content">';
		
		html += this.getFormRow({
			label: 'Server Label:',
			content: this.getFormText({
				id: 'fe_es_title',
				spellcheck: 'false',
				placeholder: '(Use Hostname)',
				value: server.title || ''
			}),
			caption: 'Optionally enter a custom label for the server, for display purposes.  Omit to use the server hostname.'
		});
		
		// status
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_es_enabled',
				label: 'Server Enabled',
				checked: server.enabled
			}),
			caption: 'Enable or disable the server using this checkbox.  Disabled servers will not be chosen for any jobs.'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_es_icon',
				title: 'Select icon for server',
				placeholder: 'Select icon for server...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: server.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for the server.'
		});
		
		// groups
		html += this.getFormRow({
			label: 'Server Groups:',
			content: this.getFormMenuMulti({
				id: 'fe_es_groups',
				title: 'Select groups for the server',
				placeholder: '(Automatic)',
				options: app.groups,
				values: server.autoGroup ? [] : server.groups,
				default_icon: 'server-network',
				'data-hold': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Override the server group(s) the server should belong to.  By default these are automatically assigned using the server hostname.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			var updates = {
				id: server.id,
				title: $('#fe_es_title').val().trim(),
				enabled: $('#fe_es_enabled').is(':checked'),
				icon: $('#fe_es_icon').val(),
				groups: $('#fe_es_groups').val()
			};
			
			// set autoGroup based on group menu selection
			updates.autoGroup = !updates.groups.length;
			
			Dialog.showProgress( 1.0, "Updating Server..." );
			app.api.post( 'app/update_server', updates, function(resp) {
				// update complete
				Dialog.hideProgress();
				if (!self.active) return; // sanity
				
				app.showMessage('success', "The server was updated successfully.");
				
				// update local copy
				if (updates.autoGroup) delete updates.groups; // preserve groups in local copy
				merge_hash_into(server, updates);
				
				self.updateHeaderNav();
				self.div.find('#d_vs_stat_label').html( server.title || 'n/a' );
				self.div.find('#d_vs_stat_groups').html( self.getNiceGroupList(server.groups) );
			} ); // api.post
		}); // Dialog.confirm
		
		SingleSelect.init( $('#fe_es_icon') );
		MultiSelect.init( $('#fe_es_groups') );
		Dialog.autoResize();
	}
	
	goServerHistory() {
		// nav to activity search
		Nav.go('#ActivityLog?action=servers&query=' + this.server.id);
	}
	
	goAlertHistory() {
		// nav to alert history for this server
		Nav.go('Alerts?server=' + this.server.id);
	}
	
	goJobHistory() {
		// nav to job history for this server
		Nav.go('Search?server=' + this.server.id);
	}
	
	goDeleteServer() {
		// show delete server dialog
		var self = this;
		var server = this.server;
		var title = "Delete Server";
		var btn = ['trash-can', "Confirm Delete"];
		var nice_server = this.getNiceServer(this.server, false);
		var html = '';
		
		if (this.online) {
			// server is online
			html += `<div class="dialog_intro">Are you sure you want to permanently delete the server <b>${nice_server}</b>?  Note that this will <b>shut down</b> and <b>uninstall</b> OpsRocket Satellite from the server.</div>`;
			html += '<div class="dialog_box_content">';
			
			html += this.getFormRow({
				label: 'Options:',
				content: this.getFormCheckbox({
					id: 'fe_ds_history',
					label: 'Delete Server History',
					checked: false
				}),
				caption: 'Check this box to also delete the server\'s history, including all monitoring data and snapshots.'
			});
			
			html += '</div>';
		}
		else {
			// server is offline
			html += `Are you sure you want to permanently delete the server <b>${nice_server}</b>, including its history and monitoring data?  This operation cannot be undone.`;
		}
		
		Dialog.confirmDanger( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			var del_hist = self.online ? $('#fe_ds_history').is(':checked') : true;
			
			Dialog.showProgress( 1.0, "Deleting Server..." );
			app.api.post( 'app/delete_server', { id: server.id, history: del_hist }, function(resp) {
				// delete started in background
				Dialog.hideProgress();
				app.showMessage('success', "The server is being deleted in the background.");
				if (del_hist) Nav.go('Servers');
			}); // api.post
		}); // Dialog.confirm
	}
	
	createSnapshot() {
		// take snapshot of current server
		app.clearError();
		Dialog.showProgress( 1.0, "Creating snapshot..." );
		
		app.api.post( 'app/create_snapshot', { server: this.server.id }, function(resp) {
			Dialog.hideProgress();
			var loc = 'Snapshots?sub=view&id=' + resp.id;
			app.showMessage('success', "Your snapshot was created successfully.  Click here to view it, or find it on the Snapshots page.", 8, loc);
		} ); // api.post
	}
	
	getSnapshotAlerts() {
		// get alerts from snapshot (offline only)
		var self = this;
		var snapshot = this.snapshot;
		if (this.online) return;
		
		this.alerts = Object.values(snapshot.alerts || {}).filter( function(item) { return item.server == self.server.id; } );
		this.renderSnapshotAlerts(); // in ServerUtils.class.js
	}
	
	getLiveAlerts() {
		// grab live alerts associated with server
		var self = this;
		if (!this.online) return;
		
		this.alerts = Object.values(app.activeAlerts).filter( function(item) { return item.server == self.server.id; } );
		this.renderSnapshotAlerts(); // in ServerUtils.class.js
	}
	
	renderActiveJobs() {
		// show all active jobs for server
		var self = this;
		if (!this.online) return;
		
		var html = '';
		var rows = Object.values(app.activeJobs).filter( function(item) { return item.server == self.server.id; } ).sort( function(a, b) {
			return (a.started < b.started) ? 1 : -1;
		} );
		
		if (!this.activeOffset) this.activeOffset = 0;
		
		var resp = {
			rows: rows.slice( this.activeOffset, this.activeOffset + config.alt_items_per_page ),
			list: { length: rows.length }
		};
		
		var grid_args = {
			resp: resp,
			cols: ['Job ID', 'Event', 'Category', 'Server', 'State', 'Progress', 'Remaining', 'Actions'],
			data_type: 'job',
			offset: this.activeOffset,
			limit: config.alt_items_per_page,
			class: 'data_grid dash_active_grid',
			pagination_link: '$P().jobActiveNav',
			empty_msg: 'No active jobs on this server.'
		};
		
		html += this.getPaginatedGrid( grid_args, function(job, idx) {
			return [
				'<b>' + self.getNiceJob(job, true) + '</b>',
				self.getNiceJobEvent(job, true),
				self.getNiceCategory(job.category, true),
				// self.getNiceJobSource(job),
				// self.getShortDateTime( job.started ),
				'<div id="d_vs_jt_server_' + job.id + '">' + self.getNiceServer(job.server, true) + '</div>',
				'<div id="d_vs_jt_state_' + job.id + '">' + self.getNiceJobState(job) + '</div>',
				// '<div id="d_vs_jt_elapsed_' + job.id + '">' + self.getNiceJobElapsedTime(job, false) + '</div>',
				'<div id="d_vs_jt_progress_' + job.id + '">' + self.getNiceJobProgressBar(job) + '</div>',
				'<div id="d_vs_jt_remaining_' + job.id + '">' + self.getNiceJobRemainingTime(job, false) + '</div>',
				
				'<span class="link danger" onClick="$P().doAbortJob(\'' + job.id + '\')"><b>Abort Job</b></a>'
			];
		} );
		
		this.div.find('#d_vs_jobs > .box_content').removeClass('loading').html(html);
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
	
	jobActiveNav(offset) {
		// user clicked on active job pagination nav
		this.activeOffset = offset;
		this.div.find('#d_vs_jobs > .box_content').addClass('loading');
		this.renderActiveJobs();
	}
	
	renderMonitorGrid() {
		// show grid of monitors
		this.div.find('#d_vs_dash_grid').html( this.getMonitorGrid(this.snapshot) );
	}
	
	renderMemDetails() {
		// show memory details
		this.div.find('#d_vs_mem > .box_content').html( this.getMemDetails(this.snapshot) );
	}
	
	renderCPUDetails() {
		// show cpu details
		this.div.find('#d_vs_cpus > .box_content').html( this.getCPUDetails(this.snapshot) );
	}
	
	setupQuickMonitors() {
		// render empty quickmon charts, then request full data
		var self = this;
		var server = this.server;
		var html = '';
		html += '<div class="chart_grid_horiz ' + (app.getPref('chart_size_quick') || 'medium') + '">';
		
		config.quick_monitors.forEach( function(def) {
			// { "id": "cpu_load", "title": "CPU Load Average", "source": "cpu.avgLoad", "type": "float", "suffix": "" },
			html += '<div><canvas id="c_vs_' + def.id + '" class="chart"></canvas></div>';
		} );
		
		html += '</div>';
		
		this.div.find('#d_vs_quickmon').show();
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
				"clip": true,
				"live": true,
				"_quick": true
			});
			self.charts[ def.id ] = chart;
			self.setupChartHover(def.id);
			self.setupCustomHeadroom(def.id);
		});
		
		// request all data from server
		app.api.post( 'app/get_quickmon_data', { server: this.server.id }, function(resp) {
			if (!self.active) return; // sanity
			
			// now iterate over all quick monitors
			config.quick_monitors.forEach( function(def, idx) {
				var chart = self.charts[def.id];
				var rows = resp.servers[server.id] || [];
				
				chart.addLayer({
					id: server.id,
					title: self.getNiceServerText(server),
					data: self.getQuickMonChartData(rows, def.id),
					color: app.colors[ idx % app.colors.length ]
				});
			}); // foreach mon
		}); // api.get
		
		// prepopulate filter if saved
		if (this.quickMonitorFilter) {
			var $elem = this.div.find('#d_vs_quickmon .box_title_widget input[type="text"]');
			$elem.val( this.quickMonitorFilter );
			this.applyQuickMonitorFilter( $elem.get(0) );
		}
	}
	
	animate() {
		// animate quickmon charts
		var self = this;
		
		// invalidate raf token
		this.raf = false;
		
		if (!this.active) return; // auto-shutdown on page deactivate
		if (!this.online) return; // auto-shutdown if server is offline
		
		var now = app.getApproxServerTime();
		
		config.quick_monitors.forEach( function(def, idx) {
			var chart = self.charts[def.id];
			chart.zoom = { xMin: now - 61, xMax: now - 1 };
			chart.dirty = true;
		});
		
		ChartManager.check();
		
		this.raf = requestAnimationFrame( this.animate.bind(this) );
	}
	
	appendSampleToQuickChart(data) {
		// append sample to quickmon chart (real-time from server)
		// { id, row }
		var self = this;
		if (!this.active || !this.charts) return; // sanity
		
		config.quick_monitors.forEach( function(def) {
			var chart = self.charts[def.id];
			if (!chart) return; // sanity
			
			var layer_idx = find_object_idx( chart.layers, { id: data.id } );
			
			if ((layer_idx > -1) && data.row.date && (typeof(data.row[def.id]) == 'number')) {
				chart.addLayerSample(layer_idx, { x: data.row.date, y: data.row[def.id] || 0 }, 63 );
			}
		}); // foreach monitor
		
		// also update mem and cpu details
		if (data.data && this.donutDashUnits) {
			this.resetDetailAnimation();
			this.updateMemDetails(data);
			this.updateCPUDetails(data);
			this.startDetailAnimation();
		}
	}
	
	updateMemDetails(snapshot) {
		// update mem donuts smoothly
		var self = this;
		var data = snapshot.data;
		var mem = data.memory || data.mem;
		var $cont = this.div.find('#d_vs_mem');
		
		for (var id in this.donutDashUnits) {
			if (id.match(/^mem_(\w+)$/)) {
				var key = RegExp.$1;
				var opts = this.donutDashUnits[id];
				
				var new_value = mem[key] || 0;
				var old_value = opts.value || 0;
				
				var new_pct = short_float( (new_value / (opts.max || 1)) * 100, 3 );
				var old_pct = short_float( (old_value / (opts.max || 1)) * 100, 3 );
				
				var value_disp = this.getDashValue(new_value, opts.type, opts.suffix);
				var $elem = $cont.find('#ddc_' + id + ' > div.dash_donut_image');
				$elem.find('> div.dash_donut_value').html( value_disp );
				
				// add animation controller for donut change
				if (new_pct != old_pct) this.detailAnimation.donuts.push({
					elem: $elem,
					from: old_pct,
					to: new_pct,
					color: opts.color,
					bg: opts.bg
				});
				
				opts.value = new_value;
			}
		}
	}
	
	updateCPUDetails(snapshot) {
		// update cpu donuts and progress bars smoothly
		var self = this;
		var data = snapshot.data;
		var cpu_totals = data.cpu.totals;
		var $cont = this.div.find('#d_vs_cpus');
		
		for (var id in this.donutDashUnits) {
			if (id.match(/^cpu_(\w+)$/)) {
				var key = RegExp.$1;
				var opts = this.donutDashUnits[id];
				
				var new_value = cpu_totals[key] || 0;
				var old_value = opts.value || 0;
				
				var new_pct = short_float( (new_value / (opts.max || 1)) * 100, 3 );
				var old_pct = short_float( (old_value / (opts.max || 1)) * 100, 3 );
				
				var value_disp = this.getDashValue(new_value, opts.type, opts.suffix);
				var $elem = $cont.find('#ddc_' + id + ' > div.dash_donut_image');
				$elem.find('> div.dash_donut_value').html( value_disp );
				
				// add animation controller for donut change
				if (new_pct != old_pct) this.detailAnimation.donuts.push({
					elem: $elem,
					from: old_pct,
					to: new_pct,
					color: opts.color,
					bg: opts.bg
				});
				
				opts.value = new_value;
			}
		}
		
		// grid and bars
		var bar_width = 150;
		var rows = (data.cpu && data.cpu.cpus) ? data.cpu.cpus : [];
		var $grid_rows = $cont.find('div.data_grid.cpu_grid ul.grid_row');
		
		$grid_rows.each( function(idx) {
			var item = rows[idx];
			var $row = $(this);
			var $cols = $row.find('> div');
			
			// $cols[0] is the numerical index label (#1, #2, etc.)
			$cols[1].innerHTML = Math.floor(item.user) + '%';
			$cols[2].innerHTML = Math.floor(item.system) + '%';
			$cols[3].innerHTML = Math.floor(item.nice) + '%';
			$cols[4].innerHTML = Math.floor(item.iowait) + '%';
			$cols[5].innerHTML = Math.floor(item.irq) + '%';
			$cols[6].innerHTML = Math.floor(item.softirq) + '%';
			
			var $bar = $cols.eq(7).find('div.progress_bar_container');
			var amount = (100 - item.idle) / 100;
			var counter = Math.min(1, Math.max(0, amount || 0));
			var cx = Math.floor( counter * bar_width );
			var label = '' + Math.floor( (counter / 1.0) * 100 ) + '%';
			
			$bar.find('div.progress_bar_label').html( label ); // should update 2 elements
			$bar.find('div.progress_bar_inner').css('width', '' + cx + 'px'); // should auto-animate
		} );
	}
	
	setupMonitors() {
		// setup custom monitors (updated every minute)
		var self = this;
		var server = this.server;
		var monitors = this.monitors = [];
		var min_epoch = app.epoch - 3600;
		var html = '';
		html += '<div class="chart_grid_horiz ' + (app.getPref('chart_size') || 'medium') + '">';
		
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
		
		monitors.forEach( function(def, idx) {
			var chart = self.createChart({
				"canvas": '#c_vs_' + def.id,
				"title": def.title,
				"dataType": def.data_type,
				"dataSuffix": def.suffix,
				"delta": def.delta || false,
				"deltaMinValue": def.delta_min_value ?? false,
				"divideByDelta": def.divide_by_delta || false,
				"minVertScale": def.min_vert_scale || 0,
				"showDataGaps": true,
				"legend": false, // single layer, no legend needed
				"_allow_zoom": true
			});
			self.charts[ def.id ] = chart;
			self.setupChartHover(def.id);
		});
		
		// request last hour from server
		app.api.post( 'app/get_latest_monitor_data', { server: server.id, sys: 'hourly', limit: 60 }, function(resp) {
			if (!self.active) return; // sanity
			
			// prune based on latest sample, not "now" (server may be offline and we're rendering the last known state)
			if (resp.rows.length) min_epoch = resp.rows[ resp.rows.length - 1 ].date - 3600;
			
			// prune all data older than 1 hour
			resp.rows = resp.rows.filter( function(row) { return row.date >= min_epoch; } );
			
			// now iterate over all our monitors
			monitors.forEach( function(def, idx) {
				var chart = self.charts[def.id];
				
				chart.addLayer({
					id: server.id,
					title: self.getNiceServerText(server),
					data: self.getMonitorChartData(resp.rows, def),
					color: app.colors[ idx % app.colors.length ]
				});
			}); // foreach mon
		}); // api.get
		
		// prepopulate filter if saved
		if (this.monitorFilter) {
			var $elem = this.div.find('#d_vs_monitors .box_title_widget input[type="text"]');
			$elem.val( this.monitorFilter );
			this.applyMonitorFilter( $elem.get(0) );
		}
	}
	
	appendSampleToChart() {
		// append sample to chart (every minute)
		var self = this;
		var snapshot = this.snapshot;
		var flagged_monitors = {};
		
		// check for alert overlays
		if (snapshot.new_alerts) {
			for (var alert_id in snapshot.new_alerts) {
				var alert_def = find_object( app.alerts, { id: alert_id } );
				if (alert_def && alert_def.monitor_id) flagged_monitors[alert_def.monitor_id] = true;
			}
		}
		
		this.monitors.forEach( function(def) {
			var chart = self.charts[def.id];
			var layer = chart.layers[0]; // single layer charts
			
			// normalize x to the minute (for showDataGaps to work correctly)
			var x = Math.floor( snapshot.date / 60 ) * 60;
			
			// grab delta if applicable, or abs value for std monitors
			// var y = def.delta ? snapshot.data.deltas[def.id] : snapshot.data.monitors[def.id];
			var y = snapshot.data.monitors[def.id];
			
			var item = { x: x, y: y || 0 };
			
			// check for flag (label)
			if (flagged_monitors[def.id]) item.label = { "text": "Alert", "color": "red", "tooltip": true };
			
			chart.addLayerSample(0, item, 60);
		}); // foreach monitor
	}
	
	updateServerStats() {
		// stats updated, redraw select grid elements
		var server = this.server;
		var stats = app.stats.currentDay.servers[server.id] || {};
		
		// jobs completed today
		this.div.find('#d_vs_stat_jct').html( commify(stats.job_complete || 0) );
		
		// jobs failed today
		this.div.find('#d_vs_stat_jft').html( commify(stats.job_error || 0) );
		
		// job success rate
		this.div.find('#d_vs_stat_jsr').html( stats.job_complete ? pct( stats.job_success || 0, stats.job_complete || 1 ) : 'n/a' );
		
		// alerts today
		this.div.find('#d_vs_stat_at').html( commify(stats.alert_new || 0) );
		
		// refresh upcoming
		if (this.upcomingJobs) {
			this.autoExpireUpcomingJobs();
			this.renderUpcomingJobs();
		}
	}
	
	updateSnapshotData(snapshot) {
		// new snapshot from server (every minute), update graphs and tables
		this.snapshot = snapshot;
		
		// uptime
		this.div.find('#d_vs_stat_uptime').html( this.getNiceUptime(snapshot.data.uptime_sec) );
		
		this.renderMonitorGrid();
		
		// These now happen every sec as part of quickmon
		// this.renderMemDetails();
		// this.renderCPUDetails();
		
		this.div.find('#d_vs_procs > div.box_content').html( this.getProcessTable(snapshot) );
		this.div.find('#d_vs_conns > div.box_content').html( this.getConnectionTable(snapshot) );
		this.div.find('#d_vs_ifaces > div.box_content').html( this.getInterfaceTable(snapshot) );
		this.div.find('#d_vs_fs > div.box_content').html( this.getMountTable(snapshot) );
		
		// update pixl-charts
		this.appendSampleToChart();
		
		// update watch button
		this.updateWatchButton();
	}
	
	handleStatusUpdateView(data) {
		// update live job data
		var self = this;
		var div = this.div;
		
		if (data.jobsChanged) {
			this.renderActiveJobs();
			
			// recompute upcoming jobs
			this.autoExpireUpcomingJobs();
			this.renderUpcomingJobs();
		}
		else {
			// fast update without redrawing entire table
			var jobs = Object.values(app.activeJobs).filter( function(item) { return item.server == self.server.id; } )
			
			jobs.forEach( function(job) {
				div.find('#d_vs_jt_state_' + job.id).html( self.getNiceJobState(job) );
				div.find('#d_vs_jt_server_' + job.id).html( self.getNiceServer(job.server, true) );
				// div.find('#d_vs_jt_elapsed_' + job.id).html( self.getNiceJobElapsedTime(job, false) );
				div.find('#d_vs_jt_remaining_' + job.id).html( self.getNiceJobRemainingTime(job, false) );
				
				// update progress bar without redrawing it (so animation doesn't jitter)
				self.updateJobProgressBar(job, '#d_vs_jt_progress_' + job.id + ' > div.progress_bar_container');
			} ); // foreach job
		}
	}
	
	checkUpdateServerState() {
		// servers were updated (add or removed) -- check if OUR server was affected
		var server = this.server;
		var snapshot = this.snapshot;
		
		if (this.online && !app.servers[server.id]) {
			// our server went offline!
			this.onDeactivate();
			this.receive_snapshot({ server: server, data: snapshot, online: false });
		}
		else if (!this.online && app.servers[server.id]) {
			// our server came back online!
			this.onDeactivate();
			this.receive_snapshot({ server: app.servers[server.id], data: snapshot, online: true });
		}
	}
	
	onPageUpdate(pcmd, pdata) {
		// receive data packet for this page specifically (i.e. live graph append)
		switch (this.args.sub) {
			case 'view':
				switch (pcmd) {
					case 'quickmon': this.appendSampleToQuickChart(pdata); break;
					case 'snapshot': this.updateSnapshotData(pdata.snapshot); break;
				}
			break;
		} // switch sub
	}
	
	onStatusUpdate(data) {
		// called every 1s from websocket
		switch (this.args.sub) {
			case 'list': this.handleStatusUpdateList(data); break;
			case 'view': this.handleStatusUpdateView(data); break;
		}
	}
	
	onDataUpdate(key, data) {
		// refresh list if servers were updated
		switch (this.args.sub) {
			case 'list':
				if ((key == 'servers') || (key == 'activeAlerts')) this.gosub_list(this.args);
			break;
			
			case 'view':
				if (key == 'activeAlerts') this.getLiveAlerts();
				else if (key == 'stats') this.updateServerStats();
				else if (key == 'servers') this.checkUpdateServerState();
				else if (key == 'state') this.updateWatchButton();
				else if (key == 'events') this.setupUpcomingJobs();
			break;
		}
	}
	
	onDeactivate() {
		// called when page is deactivated
		delete this.servers;
		delete this.monitors;
		delete this.server;
		delete this.snapshot;
		delete this.online;
		delete this.donutDashUnits;
		delete this.detailAnimation;
		delete this.serverInstallArgs;
		delete this.chartZoom;
		delete this.upcomingJobs;
		delete this.upcomingOffset;
		
		// destroy charts if applicable (view page)
		if (this.charts) {
			for (var key in this.charts) {
				this.charts[key].destroy();
			}
			delete this.charts;
		}
		
		// cancel raf if scheduled
		if (this.raf) {
			cancelAnimationFrame(this.raf);
			this.raf = false;
		}
		
		this.div.html( '' );
		return true;
	}
	
};
