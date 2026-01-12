// Marketplace Page

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Marketplace = class Marketplace extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'search';
		this.bar_width = 100;
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		if (!args.sub && args.id) args.sub = 'view';
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_search(args) {
		// search marketplace
		var self = this;
		if (this.fields) return this.receive_fields({ fields: this.fields });
		
		// fetch field summaries
		this.loading();
		app.api.get( 'app/marketplace', { fields: 1 }, this.receive_fields.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_fields(resp) {
		// search marketplace
		var self = this;
		var args = this.args;
		this.fields = resp.fields;
		
		if (!args.offset) args.offset = 0;
		if (!args.limit) args.limit = config.items_per_page;
		
		app.setWindowTitle('Marketplace');
		app.setHeaderTitle( '<i class="mdi mdi-cart-outline">&nbsp;</i>Marketplace' );
		
		var html = '';
		html += '<div class="box" style="border:none;">';
		html += '<div class="box_content" style="padding:20px;">';
			
			// search box
			html += '<div class="search_box" role="search">';
				html += '<i class="mdi mdi-magnify" onClick="$(\'#fe_s_query\').focus()">&nbsp;</i>';
				html += '<input type="text" id="fe_s_query" maxlength="128" placeholder="Enter keywords..." value="' + escape_text_field_value(args.query || '') + '">';
			html += '</div>';
			
			// options
			html += '<div id="d_s_adv" class="form_grid" style="margin-bottom:25px">';
				
				// type
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-palette-swatch-outline">&nbsp;</i>Product Type:',
						content: this.getFormMenuSingle({
							id: 'fe_s_type',
							title: 'Select Type',
							options: [['', 'Any Type']].concat( this.fields.types.map( function(type) {
								var def = config.ui.data_types[type];
								if (def) return { id: type, title: toTitleCase(type), icon: def.icon };
								else return type;
							} ) ).concat( [
								{ id: 'p_action', title: 'Action Plugins', icon: 'gesture-tap', group: "Plugin Types" },
								{ id: 'p_event', title: 'Event Plugins', icon: 'calendar-clock' },
								{ id: 'p_monitor', title: 'Monitor Plugins', icon: 'console' },
								{ id: 'p_scheduler', title: 'Trigger Plugins', icon: 'rocket-launch-outline' }
							] ),
							value: args.plugin_type ? `p_${args.plugin_type}` : (args.type || ''),
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// tags
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-tag-multiple-outline">&nbsp;</i>Tags:',
						content: this.getFormMenuMulti({
							id: 'fe_s_tags',
							title: 'Select Tags',
							placeholder: 'Any Tags',
							options: this.fields.tags.map( function(tag) {
								return { id: crammify(tag), title: tag, icon: 'tag-outline' };
							} ),
							values: args.tags ? args.tags.split(/\,\s*/) : [],
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// requirements
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-disc-player">&nbsp;</i>Requirements:',
						content: this.getFormMenuMulti({
							id: 'fe_s_reqs',
							title: 'Select Requirements',
							placeholder: 'Any Requirements',
							options: this.fields.requires.map( function(req) {
								return { id: crammify(req), title: req, icon: 'floppy' };
							} ),
							values: args.requires ? args.requires.split(/\,\s*/) : [],
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// license
				html += '<div class="form_cell">';
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-scale-balance">&nbsp;</i>License:',
						content: this.getFormMenuSingle({
							id: 'fe_s_lic',
							title: 'Select License',
							options: [['', 'Any License']].concat( this.fields.licenses.map( function(lic) {
								return { id: crammify(lic), title: lic, icon: 'license' };
							} ) ),
							value: args.license || '',
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				// sort
				html += '<div class="form_cell">';
					var sort_items = [
						{ id: 'title_asc', title: 'Ascending', icon: 'sort-ascending', group: 'Alphabetical' },
						{ id: 'title_desc', title: 'Descending', icon: 'sort-descending' },
						
						{ id: 'date_desc', title: 'Newest on Top', icon: 'sort-descending', group: 'Create Date' },
						{ id: 'date_asc', title: 'Oldest on Top', icon: 'sort-ascending' }
					];
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-sort">&nbsp;</i>Sort Results:',
						content: this.getFormMenuSingle({
							id: 'fe_s_sort',
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
			html += '<div id="btn_search_opts" class="button phone_collapse" onClick="$P().toggleSearchOpts()"><i>&nbsp;</i><span>Options<span></div>';
			html += '<div id="btn_s_reset" class="button phone_collapse" style="display:none" onClick="$P().resetFilters()"><i class="mdi mdi-undo-variant">&nbsp;</i>Reset</div>';
			html += '<div class="button primary" onClick="$P().navSearch(true)"><i class="mdi mdi-magnify">&nbsp;</i>Search</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		html += '<div id="d_search_results"><div class="loading_container"><div class="loading"></div></div></div>';
		
		this.div.html( html ).buttonize();
		this.addPageDescription();
		
		MultiSelect.init( this.div.find('#fe_s_tags, #fe_s_reqs') );
		SingleSelect.init( this.div.find('#fe_s_type, #fe_s_lic, #fe_s_sort') );
		this.setupSearchOpts();
		
		this.div.find('#fe_s_tags, #fe_s_type, #fe_s_reqs, #fe_s_lic, #fe_s_sort').on('change', function() {
			self.navSearch();
		});
		
		$('#fe_s_query').on('keydown', function(event) {
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
	}
	
	resetFilters() {
		// reset all filters to default and re-search
		Nav.go( this.selfNav({}) );
	}
	
	getSearchArgs() {
		// get form values, return search args object
		var args = {};
		
		var query = this.div.find('#fe_s_query').val().trim();
		if (query.length) args.query = query;
		
		var tags = this.div.find('#fe_s_tags').val();
		if (tags.length) args.tags = tags.join(',');
		
		var reqs = this.div.find('#fe_s_reqs').val();
		if (reqs.length) args.requires = reqs.join(',');
		
		var lic = this.div.find('#fe_s_lic').val();
		if (lic) args.license = lic;
		
		var type = this.div.find('#fe_s_type').val();
		if (type) {
			if (type.match(/^p_(\w+)$/)) {
				var plugin_type = RegExp.$1;
				args.type = 'plugin';
				args.plugin_type = plugin_type;
			}
			else args.type = type;
		}
		
		var sort = this.div.find('#fe_s_sort').val();
		if (sort != 'title_asc') args.sort = sort;
		
		if (!num_keys(args)) return null;
		
		return args;
	}
	
	navSearch(force = false) {
		// convert form into query and redirect
		app.clearError();
		
		var args = this.getSearchArgs();
		if (!args) {
			// args = { query: '*' };
			Nav.go( this.selfNav({}) );
			return;
		}
		
		Nav.go( this.selfNav(args), force );
	}
	
	doSearch() {
		// actually perform the search
		var args = this.args;
		var sargs = this.getSearchArgs() || {};
		
		if (first_key(sargs)) this.div.find('#btn_s_reset').show();
		else this.div.find('#btn_s_reset').hide();
		
		// compose search query
		var sopts = {
			...sargs,
			offset: args.offset || 0,
			limit: args.limit || config.items_per_page,
			compact: 1
		};
		switch (args.sort) {
			case 'title_asc':
				sopts.sort_by = 'title'; 
				sopts.sort_dir = 1;
			break;
			
			case 'title_desc':
				sopts.sort_by = 'title'; 
				sopts.sort_dir = -1;
			break;
			
			case 'date_asc':
				sopts.sort_by = 'created'; 
				sopts.sort_dir = 1;
			break;
			
			case 'date_desc':
				sopts.sort_by = 'created'; 
				sopts.sort_dir = -1;
			break;
		} // sort
		
		app.api.get( 'app/marketplace', sopts, this.receiveResults.bind(this) );
	}
	
	receiveResults(resp) {
		// receive search results
		var self = this;
		var $results = this.div.find('#d_search_results');
		var html = '';
		
		if (!this.active) return; // sanity
		
		this.lastSearchResp = resp;
		this.products = [];
		if (resp.rows) this.products = resp.rows;
		
		var grid_args = {
			resp: resp,
			cols: ['Title / Description', 'Author', 'License', 'Type', 'Modified', 'Version'],
			data_type: 'product',
			offset: this.args.offset || 0,
			limit: this.args.limit,
			pagination_link: '$P().searchPaginate',
			primary: true
		};
		
		html += '<div class="box">';
		
		html += '<div class="box_title">';
			html += this.getSearchArgs() ? 'Search Results' : 'All Products';
			html += '<div class="clear"></div>';
		html += '</div>';
		
		html += '<div class="box_content table">';
		
		html += this.getPaginatedGrid( grid_args, function(product, idx) {
			var logo_url = app.base_api_url + '/app/marketplace?id=' + encodeURIComponent(product.id) + '&logo=1';
			
			var combo = `<div class="product_result" onClick="$P().doViewProduct(${idx})" style="background-image:url(${logo_url}">`;
				combo += `<div class="product_title ellip">${product.title}</div>`;
				combo += `<div class="product_desc ellip">${product.description}</div>`;
			combo += `</div>`;
			
			return [
				combo,
				self.getNiceProductAuthor( product.author ),
				self.getNiceProductLicense( product.license ),
				self.getNiceProductType( product ),
				self.getNiceProductDate( product.created ),
				self.getNiceProductVersion( product.versions[0] )
			];
		} );
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		$results.html( html ).buttonize();
		
		this.cleanupBoxButtonFloater();
	}
	
	getNiceProductType(product) {
		// { id: type, title: toTitleCase(type), icon: def.icon };
		if (product.plugin_type) return this.getNicePluginType(product.plugin_type);
		
		var def = config.ui.data_types[product.type];
		if (def) return `<i class="mdi mdi-${def.icon}">&nbsp;</i>` + toTitleCase(product.type);
		else return type;
	}
	
	getNiceProductAuthor(author) {
		return '<i class="mdi mdi-account">&nbsp;</i>' + author;
	}
	
	getNiceProductLicense(lic) {
		return '<i class="mdi mdi-license">&nbsp;</i>' + lic;
	}
	
	getNiceProductVersion(ver) {
		return '<i class="mdi mdi-tag-text-outline">&nbsp;</i>' + ver;
	}
	
	getNiceProductDate(date) {
		var epoch = Math.floor( (new Date(date + ' 00:00:00')).getTime() / 1000 );
		return this.getNiceDate(epoch);
	}
	
	getNiceProductReq(req) {
		return '<i class="mdi mdi-floppy">&nbsp;</i>' + req;
	}
	
	getNiceProductRequires(reqs) {
		return reqs.map( req => this.getNiceProductReq(req) ).join(', ');
	}
	
	doViewProduct(idx) {
		// jump to product view page by index
		Nav.go( 'Marketplace?id=' + encodeURIComponent(this.products[idx].id) );
	}
	
	searchPaginate(offset) {
		// special hook for intercepting pagination clicks
		this.args.offset = offset;
		
		var url = '#' + this.ID + (num_keys(this.args) ? compose_query_string(this.args) : '');
		history.pushState( null, '', url );
		Nav.loc = url.replace(/^\#/, '');
		
		this.div.find('#d_search_results .box_content').addClass('loading');
		this.doSearch();
	}
	
	// View Page
	
	gosub_view(args) {
		// view marketplace product
		this.loading();
		app.api.get( 'app/marketplace', { id: args.id, readme: 1 }, this.receive_product.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_product(resp) {
		// display product landing page
		var self = this;
		var product = this.product = resp.item;
		var text = resp.text;
		var type_def = config.ui.data_types[ product.type ];
		var installed = this.installed = this.findInstalledProduct(product);
		var html = '';
		
		app.setWindowTitle( product.title );
		app.setHeaderNav([
			{ icon: 'cart-outline', loc: '#Marketplace?sub=search', title: 'Marketplace' },
			{ icon: type_def.icon, title: product.title }
		]);
		
		var install_btn_text = installed ? `Upgrade ${ucfirst(product.type)}...` : `Install ${ucfirst(product.type)}...`;
		var install_btn_icon = installed ? 'package-up' : 'package-down';
		var install_btn_class = 'default';
		var edit_btn_text = 'Edit...';
		
		if (installed && (installed.marketplace.version == product.versions[0])) install_btn_class = '';
		
		// summary grid
		html += '<div class="box">';
			html += '<div class="box_title">';
				html += product.title;
				
				html += '<div class="button ' + install_btn_class + ' right phone_collapse" title="' + install_btn_text + '" onClick="$P().do_install_select_version()"><i class="mdi mdi-' + install_btn_icon + '">&nbsp;</i><span>' + install_btn_text + '</span></div>';
				if (installed) {
					html += '<div class="button right secondary phone_collapse" title="' + edit_btn_text + '" onClick="$P().do_edit()"><i class="mdi mdi-file-edit-outline">&nbsp;</i><span>' + edit_btn_text + '</span></div>';
				}
				html += '<div class="clear"></div>';
			html += '</div>'; // title
			
			html += '<div class="box_content table">';
				html += '<div class="summary_grid">';
					
					// author
					html += '<div>';
						html += '<div class="info_label">Author</div>';
						html += '<div class="info_value">' + this.getNiceProductAuthor(product.author) + '</div>';
					html += '</div>';
					
					// type
					html += '<div>';
						html += '<div class="info_label">Type</div>';
						html += '<div class="info_value">' + this.getNiceProductType(product) + '</div>';
					html += '</div>';
					
					// status (installed / not)
					html += '<div>';
						html += '<div class="info_label">Status</div>';
						html += '<div class="info_value">' + this.getNiceInstalledStatus() + '</div>';
					html += '</div>';
					
					// installed version
					html += '<div>';
						html += '<div class="info_label">Version</div>';
						html += '<div class="info_value">' + (installed ? this.getNiceProductVersion(installed.marketplace.version) : 'n/a') + '</div>';
					html += '</div>';
					
					// license
					html += '<div>';
						html += '<div class="info_label">License</div>';
						html += '<div class="info_value">' + this.getNiceProductLicense(product.license) + '</div>';
					html += '</div>';
					
					// requires
					html += '<div>';
						html += '<div class="info_label">Requirements</div>';
						html += '<div class="info_value">' + this.getNiceProductRequires(product.requires) + '</div>';
					html += '</div>';
					
					// created
					html += '<div>';
						html += '<div class="info_label">Created</div>';
						html += '<div class="info_value">' + this.getNiceProductDate(product.created) + '</div>';
					html += '</div>';
					
					// modified
					html += '<div>';
						html += '<div class="info_label">Modified</div>';
						html += '<div class="info_value">' + this.getNiceProductDate(product.modified) + '</div>';
					html += '</div>';
					
				html += '</div>'; // summary grid
				
			html += '</div>'; // box content
		html += '</div>'; // box
		
		// markdown
		html += '<div class="box">';
		
		html += '<div class="box_content">';
		html += '<div class="button secondary right" onClick="$P().doVisitRepo()"><i class="mdi mdi-open-in-new">&nbsp;</i>Visit Repo...</div>';
		html += '<div class="markdown-body doc-body" style="margin-top:0px; margin-bottom:15px;">';
		
		html += marked.parse(text, config.ui.marked_config);
		
		html += '</div>'; // markdown-body
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html(html);
		
		// fix article links, etc.
		this.expandInlineImages();
		this.highlightCodeBlocks();
		this.fixMarketDocumentLinks();
	}
	
	fixMarketDocumentLinks(elem) {
		// fix all local hash links to point back to remote repo
		if (!elem) elem = this.div;
		else if (typeof(elem) == 'string') elem = $(elem);
		
		// future-proofing, default to github for v1
		var repo_base_url = this.product.repo_url || `https://github.com/${this.product.id}`;
		
		elem.find('div.markdown-body').find('a[href]').each( function() {
			var $this = $(this);
			var href = $this.attr('href');
			if (href.match(/^\#/)) {
				$this.attr({ 'href': repo_base_url + href, 'target': '_blank' }).append('<i style="padding-left:3px" class="mdi mdi-open-in-new"></i>');
			}
		} );
	}
	
	doVisitRepo() {
		// open new window to plugin's repo
		// future-proofing, default to github for v1
		var repo_base_url = this.product.repo_url || `https://github.com/${this.product.id}`;
		window.open( repo_base_url );
	}
	
	findInstalledProduct(product) {
		// do we already have the thing?
		var type_def = config.ui.data_types[ product.type ];
		if (!type_def) return null;
		
		var list = app[ type_def.list ];
		if (!list) return null;
		
		return list.find( function(item) {
			return !!(item.marketplace && (item.marketplace.id == product.id));
		} );
	}
	
	getNiceInstalledStatus() {
		// (installed ? '<i class="mdi mdi-check-circle-outline">&nbsp;</i>Installed' : '<i class="mdi mdi-cancel">&nbsp;</i>Not Installed')
		var product = this.product;
		var installed = this.installed;
		
		if (installed) {
			// check version
			if (installed.marketplace.version == product.versions[0]) return '<span style="color:var(--green)"><i class="mdi mdi-check-circle-outline">&nbsp;</i>Up to Date</span>'
			else return '<span style="color:var(--red)"><i class="mdi mdi-alert-rhombus">&nbsp;</i>Outdated</span>';
		}
		else return '<i class="mdi mdi-cancel">&nbsp;</i>Not Installed';
	}
	
	do_edit() {
		// jump to editing thing
		var product = this.product;
		var installed = this.installed;
		var type_def = config.ui.data_types[ product.type ];
		if (!type_def) return null;
		
		Nav.go( type_def.page + '?id=' + installed.id );
	}
	
	do_install_select_version() {
		// install or upgrade thing
		var self = this;
		var html = '';
		var product = this.product;
		var installed = this.installed;
		var thing = ucfirst(product.type);
		
		var type_def = config.ui.data_types[ product.type ];
		if (!type_def) return null;
		
		var title = installed ? `Upgrade ${product.title}` : `Install ${product.title}`;
		var btn = installed ? ['package-up', 'Upgrade...'] : ['package-down', 'Install...'];
		
		html += '<div class="dialog_box_content">';
		
		// current
		html += this.getFormRow({
			label: 'Current Version:',
			content: (installed ? this.getNiceProductVersion(installed.marketplace.version) : '<i class="mdi mdi-cancel">&nbsp;</i>Not Installed')
		});
		
		// version select
		html += this.getFormRow({
			label: 'Version to Install:',
			content: this.getFormMenuSingle({
				id: 'fe_mkt_version',
				options: [{ id: '', title: 'Latest Stable', icon: 'tag-text' }].concat( product.versions.map( function(ver) { return { id: ver, title: ver, icon: 'tag-text-outline' }; } ) ),
				value: '',
				'data-shrinkwrap': 1
			})
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			var ver = $('#fe_mkt_version').val() || product.versions[0];
			
			Dialog.showProgress( 1.0, "Preparing installation..." );
			
			// fetch version data and switch to second dialog
			app.api.get( 'app/marketplace', { id: product.id, version: ver, data: 1 }, function(resp) {
				self.do_install_prep(resp);
			}); // api.post
		}); // confirm
		
		SingleSelect.init('#fe_mkt_version');
		Dialog.autoResize();
	}
	
	do_install_prep(resp) {
		// show install final confirmation
		// resp: { code, item, version, data }
		var self = this;
		var product = this.product;
		var installed = this.installed;
		var thing = ucfirst(product.type);
		var ver = resp.version;
		var json = resp.data;
		
		console.log(resp);
		
		if (!json.version || (json.version !== '1.0') || !json.type || (json.type !== 'xypdf') || !json.items || !json.items[0]) {
			return app.doError("Unknown Format: Marketplace file is not an xyOps Portable Data Object.");
		}
		
		// prompt user to confirm importing a single item
		var item = json.items[0];
		
		var opts = config.ui.data_types[ item.type ];
		if (!opts) return app.doError("Unknown Data Type: " + item.type);
		
		// security note: this check is only for client-side UX -- API access is checked on the server as well
		// but it's better to bail out here vs. get into a "partial success" situation.
		if (!app.hasPrivilege( 'create_' + opts.list )) return app.doError(`You do not have the necessary privileges required to install this ${product.type}.`);
		
		var all_objs = app[ opts.list ];
		
		// cleanup
		var obj = item.data;
		delete obj.created;
		delete obj.modified;
		delete obj.revision;
		delete obj.sort_order;
		
		// decorate
		obj.username = app.username;
		obj.marketplace = {
			id: product.id,
			version: ver
		};
		
		var title = `Confirm ${thing} Installation`;
		var do_replace = false;
		var prefix = opts.name.match(/^[aeiou]/i) ? 'an' : 'a';
		
		var md = '';
		md += `You are about to install **${product.title} ${ver}** from the xyOps Marketplace.  Please confirm the data is what you expect:` + "\n";
		
		var old_obj = find_object(all_objs, { id: obj.id });
		if (old_obj) {
			do_replace = true;
			md += "\n" + `> [!WARNING]\n> This ${opts.name} already exists in your xyOps database.  If you proceed, it will be **replaced** with the selected version.` + "\n";
			
			if (product.type == 'plugin') {
				var deps = this.get_plugin_dependants(old_obj);
				if (deps) {
					md += `\nPlease be advised that the following resources depend on this plugin:\n`;
					md += this.get_plugin_deps_markdown(deps);
					md += `\nIf you proceed, these items may require updating, particularly if any of the Plugin parameters changed.\n`;
				}
			}
			
			var pruned_old_obj = { ...old_obj, username: app.username, marketplace: obj.marketplace };
			delete pruned_old_obj.created;
			delete pruned_old_obj.modified;
			delete pruned_old_obj.revision;
			delete pruned_old_obj.sort_order;
			
			var diff_html = this.getDiffHTML( pruned_old_obj, obj ) || '(No changes)';
			md += "\n### Diff to Current Version:\n\n";
			md += '<div class="diff_content">' + diff_html + '</div>' + "\n";
		} // do_replace
		
		md += `\n### ${thing} JSON:\n`;
		md += "\n```json\n" + JSON.stringify(obj, null, "\t") + "\n```\n";
		
		var html = '';
		html += '<div class="code_viewer scroll_shadows">';
		html += '<div class="markdown-body">';
		
		html += marked.parse(md, config.ui.marked_config);
		
		html += '</div>'; // markdown-body
		html += '</div>'; // code_viewer
		
		var buttons_html = "";
		buttons_html += '<div class="button mobile_collapse" onClick="Dialog.hide()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
		buttons_html += '<div class="button delete" onClick="Dialog.confirm_click(true)"><i class="mdi mdi-cloud-download-outline">&nbsp;</i>Confirm Install</div>';
		
		Dialog.showSimpleDialog('<span class="danger">' + title + '</span>', html, buttons_html);
		
		// special mode for key capture
		Dialog.active = 'editor';
		Dialog.confirm_callback = function(result) { 
			if (!result) return;
			Dialog.hide();
			
			var api_name = do_replace ? 'app/update' : 'app/create';
			api_name += '_' + item.type;
			
			Dialog.showProgress( 1.0, "Installing " + opts.name + "..." );
			
			app.api.post( api_name, obj, function(resp) {
				Dialog.hideProgress();
				app.cacheBust = hires_time_now();
				app.showMessage('success', `${product.title} ${ver} was installed successfully.`);
				
				// create/update entry in app[list] due to race condition with ws broadcast
				var new_obj = resp[ opts.name ];
				var idx = find_object_idx(app[ opts.list ], { id: new_obj.id });
				if (idx == -1) app[ opts.list ].push(new_obj);
				else app[ opts.list ][idx] = new_obj;
				
				Nav.refresh();
			} ); // api.post
		};
		
		self.highlightCodeBlocks('#dialog .markdown-body');
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html('');
		
		delete this.lastSearchResp;
		delete this.products;
		delete this.product;
		delete this.installed;
		
		return true;
	}
	
};
