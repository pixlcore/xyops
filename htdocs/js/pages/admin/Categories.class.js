// Admin Page -- Category Config

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Categories = class Categories extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'ec';
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		if (!this.requireAnyPrivilege('create_categories', 'edit_categories', 'delete_categories')) return true;
		
		if (!args) args = {};
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show category list
		app.setWindowTitle( "Event Categories" );
		app.setHeaderTitle( '<i class="mdi mdi-folder-multiple-outline">&nbsp;</i>Event Categories' );
		
		// this.loading();
		// app.api.post( 'app/get_categories', copy_object(args), this.receive_categories.bind(this) );
		
		// kill drag operation if in progress (i.e. from onDataUpdate)
		this.cancelGridDrag( this.div.find('div.data_grid') );
		
		// use categories in app cache
		this.receive_categories({
			code: 0,
			rows: app.categories,
			list: { length: app.categories.length }
		});
	}
	
	receive_categories(resp) {
		// receive all categories from server, render them sorted
		var self = this;
		var html = '';
		
		if (!resp.rows) resp.rows = [];
		this.categories = resp.rows;
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['<i class="mdi mdi-menu"></i>', 'Category Title', 'Category ID', 'Events', 'Author', 'Created', 'Actions'];
		// if (app.isCategoryLimited()) cols.shift();
		
		var drag_handle = app.isCategoryLimited() ? '<div class="td_drag_handle" style="cursor:default"><i class="mdi mdi-menu"></i></div>' : 
			'<div class="td_drag_handle" draggable="true" title="Drag to reorder"><i class="mdi mdi-menu"></i></div>';
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Event Categories';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var grid_opts = {
			rows: this.categories,
			cols: cols,
			data_type: 'category',
			grid_template_columns: 'min-content' + ' auto'.repeat( cols.length - 1 )
		};
		
		html += this.getBasicGrid( grid_opts, function(item, idx) {
			var classes = [], actions = [];
			if (app.hasPrivilege('edit_categories')) actions.push( '<span class="link" onClick="$P().edit_category('+idx+')"><b>Edit</b></span>' );
			if (app.hasPrivilege('delete_categories')) actions.push( '<span class="link danger" onClick="$P().delete_category('+idx+')"><b>Delete</b></span>' );
			
			var cat_events = find_objects( app.events, { category: item.id } );
			var num_events = cat_events.length;
			
			var tds = [
				drag_handle,
				'<b>' + self.getNiceCategory(item, app.hasPrivilege('edit_categories')) + '</b>',
				'<span class="mono">' + item.id + '</span>',
				commify( num_events ),
				// commify( item.max_jobs ),
				self.getNiceUser(item.username, app.isAdmin()),
				'<span title="'+self.getNiceDateTimeText(item.created)+'">'+self.getNiceDate(item.created)+'</span>',
				actions.join(' | ')
			];
			// if (app.isCategoryLimited()) tds.shift();
			
			if (!item.enabled) classes.push('disabled');
			if (item.color) classes.push( 'clr_' + item.color );
			if (classes.length) tds.className = classes.join(' ');
			return tds;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			if (app.hasAnyPrivilege('create_categories', 'edit_categories')) html += '<div class="button phone_collapse" onClick="$P().doFileImportPrompt()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i><span>Import File...</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().go_history()"><i class="mdi mdi-history">&nbsp;</i><span>Revision History...</span></div>';
			if (app.hasPrivilege('create_categories')) html += '<div class="button default" onClick="$P().edit_category(-1)"><i class="mdi mdi-folder-plus-outline">&nbsp;</i><span>New Category...</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.setupBoxButtonFloater();
		
		if (!app.isCategoryLimited()) this.setupDraggableGrid({
			table_sel: this.div.find('div.data_grid'), 
			handle_sel: 'div.td_drag_handle', 
			drag_ghost_sel: 'div:nth-child(2)', 
			drag_ghost_x: 5, 
			drag_ghost_y: 10, 
			callback: this.category_move.bind(this)
		});
	}
	
	category_move($rows) {
		// a drag operation has been completed
		var items = [];
		
		$rows.each( function(idx) {
			var $row = $(this);
			items.push({
				id: $row.data('id'),
				sort_order: idx
			});
		});
		
		var data = {
			items: items
		};
		app.api.post( 'app/multi_update_category', data, function(resp) {
			// done
		} );
	}
	
	edit_category(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Categories?sub=edit&id=' + this.categories[idx].id );
		else Nav.go( '#Categories?sub=new' );
	}
	
	delete_category(idx) {
		// delete category from search results
		this.category = this.categories[idx];
		this.show_delete_category_dialog();
	}
	
	go_history() {
		Nav.go( '#Categories?sub=history' );
	}
	
	gosub_history(args) {
		// show revision history sub-page
		app.setHeaderNav([
			{ icon: 'folder-multiple-outline', loc: '#Categories?sub=list', title: 'Categories' },
			{ icon: 'history', title: "Revision History" }
		]);
		app.setWindowTitle( "Category Revision History" );
		
		this.goRevisionHistory({
			activityType: 'categories',
			itemKey: 'category',
			editPageID: 'Categories',
			itemMenu: {
				label: '<i class="icon mdi mdi-folder-open-outline">&nbsp;</i>Category:',
				title: 'Select Category',
				options: [['', 'Any Category']].concat( app.categories ),
				default_icon: 'folder-open-outline'
			}
		});
	}
	
	gosub_new(args) {
		// create new category
		var html = '';
		app.setWindowTitle( "New Category" );
		
		app.setHeaderNav([
			{ icon: 'folder-multiple-outline', loc: '#Categories?sub=list', title: 'Categories' },
			{ icon: 'folder-plus-outline', title: "New Category" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New Event Category';
			html += '<div class="box_subtitle"><a href="#Categories?sub=list">&laquo; Back to Category List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.category = {
			id: "",
			title: "",
			notes: "",
			// max_jobs: 0,
			enabled: true,
			color: '',
			limits: [],
			actions: []
		};
		this.limits = this.category.limits; // for res limit editor
		this.actions = this.category.actions; // for job action editor
		
		html += this.get_category_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button phone_collapse" onClick="$P().cancel_category_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button primary" onClick="$P().do_new_category()"><i class="mdi mdi-floppy">&nbsp;</i><span>Create Category</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_ec_color, #fe_ec_icon') );
		// MultiSelect.init( this.div.find('select[multiple]') );
		$('#fe_ec_title').focus();
		this.setupBoxButtonFloater();
	}
	
	cancel_category_edit() {
		// cancel editing category and return to list
		Nav.go( '#Categories?sub=list' );
	}
	
	do_new_category(force) {
		// create new category
		app.clearError();
		var category = this.get_category_form_json();
		if (!category) return; // error
		
		this.category = category;
		
		Dialog.showProgress( 1.0, "Creating Category..." );
		app.api.post( 'app/create_category', category, this.new_category_finish.bind(this) );
	}
	
	new_category_finish(resp) {
		// new category created successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Categories?sub=list');
		app.showMessage('success', "The new category was created successfully.");
	}
	
	gosub_edit(args) {
		// edit category subpage
		this.loading();
		app.api.post( 'app/get_category', { id: args.id }, this.receive_category.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_category(resp) {
		// edit existing category
		var html = '';
		if (!this.active) return; // sanity
		
		if (this.args.rollback && this.rollbackData) {
			resp.category = this.rollbackData;
			delete this.rollbackData;
			app.showMessage('info', `Revision ${resp.category.revision} has been loaded as a draft edit.  Click 'Save Changes' to complete the rollback.  Note that a new revision number will be assigned.`);
		}
		
		this.category = resp.category;
		this.limits = this.category.limits; // for res limit editor
		this.actions = this.category.actions; // for job action editor
		
		app.setWindowTitle( "Editing Category \"" + (this.category.title) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'folder-multiple-outline', loc: '#Categories?sub=list', title: 'Categories' },
			{ icon: this.category.icon || 'folder-open-outline', title: this.category.title }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit Category Details';
			html += '<div class="box_subtitle"><a href="#Categories?sub=list">&laquo; Back to Category List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_category_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button cancel mobile_collapse" onClick="$P().cancel_category_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Close</span></div>';
			html += '<div class="button danger mobile_collapse" onClick="$P().show_delete_category_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
			html += '<div class="button save phone_collapse" onClick="$P().do_save_category()"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Changes</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_ec_color, #fe_ec_icon') );
		this.setupBoxButtonFloater();
		this.setupEditTriggers();
	}
	
	do_export() {
		// show export dialog
		app.clearError();
		var category = this.get_category_form_json();
		if (!category) return; // error
		
		this.showExportOptions({
			name: 'category',
			dataType: 'category',
			api: this.args.id ? 'update_category' : 'create_category',
			data: category
		});
	}
	
	go_edit_history() {
		Nav.go( '#Categories?sub=history&id=' + this.category.id );
	}
	
	do_save_category() {
		// save changes to category
		app.clearError();
		var category = this.get_category_form_json();
		if (!category) return; // error
		
		this.category = category;
		
		Dialog.showProgress( 1.0, "Saving Category..." );
		app.api.post( 'app/update_category', category, this.save_category_finish.bind(this) );
	}
	
	save_category_finish(resp) {
		// new category saved successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		// Nav.go( 'Categories?sub=list' );
		this.triggerSaveComplete();
		app.showMessage('success', "The event category was saved successfully.");
	}
	
	show_delete_category_dialog() {
		// show dialog confirming category delete action
		var self = this;
		
		// check for events first
		var cat_events = find_objects( app.events, { category: this.category.id } );
		var num_events = cat_events.length;
		if (num_events) return app.doError("Sorry, you cannot delete a category that has events assigned to it.");
		
		Dialog.confirmDanger( 'Delete Category', "Are you sure you want to <b>permanently delete</b> the event category &ldquo;" + this.category.title + "&rdquo;?  There is no way to undo this action.", ['trash-can', 'Delete'], function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Category..." );
				app.api.post( 'app/delete_category', self.category, self.delete_category_finish.bind(self) );
			}
		} );
	}
	
	delete_category_finish(resp) {
		// finished deleting category
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Categories?sub=list', 'force');
		app.showMessage('success', "The event category &ldquo;" + this.category.title + "&rdquo; was deleted successfully.");
	}
	
	get_category_edit_html() {
		// get html for editing an category (or creating a new one)
		var html = '';
		var category = this.category;
		
		if (category.id) {
			// category id
			html += this.getFormRow({
				label: 'Category ID:',
				content: this.getFormText({
					id: 'fe_ec_id',
					class: 'monospace',
					spellcheck: 'false',
					disabled: 'disabled',
					value: category.id
				}),
				suffix: this.getFormIDCopier(),
				caption: 'This is a unique ID for the category, used by the xyOps API.  It cannot be changed.'
			});
		}
		
		// title
		html += this.getFormRow({
			label: 'Category Title:',
			content: this.getFormText({
				id: 'fe_ec_title',
				spellcheck: 'false',
				value: category.title
			}),
			caption: 'Enter the title of the category, for display purposes.'
		});
		
		// enabled
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_ec_enabled',
				label: 'Category Enabled',
				checked: category.enabled
			}),
			caption: 'Check this box to enable jobs to run in the category.'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_ec_icon',
				title: 'Select icon for category',
				placeholder: 'Select icon for category...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: category.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for the category.'
		});
		
		// color
		var color_items = [
			{
				id: 'plain',
				title: 'Plain',
				class: 'clr_plain'
			},
			{
				id: 'red',
				title: 'Red',
				class: 'clr_red'
			},
			{
				id: 'green',
				title: 'Green',
				class: 'clr_green'
			},
			{
				id: 'blue',
				title: 'Blue',
				class: 'clr_blue'
			},
			{
				id: 'skyblue',
				title: 'Sky Blue',
				class: 'clr_skyblue'
			},
			{
				id: 'yellow',
				title: 'Yellow',
				class: 'clr_yellow'
			},
			{
				id: 'purple',
				title: 'Purple',
				class: 'clr_purple'
			},
			{
				id: 'orange',
				title: 'Orange',
				class: 'clr_orange'
			}
		];
		html += this.getFormRow({
			label: 'Highlight Color:',
			content: this.getFormMenuSingle({
				id: 'fe_ec_color',
				title: "Select Highlight Color",
				options: color_items,
				value: category.color
			}),
			caption: 'Optionally select a highlight color for the category, which will show on the schedule.'
		});
		
		// actions
		// (requires this.actions to be populated)
		html += this.getFormRow({
			label: 'Job Actions:',
			content: '<div id="d_ec_jobact_table">' + this.getJobActionTable() + '</div>',
			caption: 'Optionally select custom actions to perform for all jobs in this category.  Events can include more actions.'
		});
		
		// default resource limits
		// (requires this.limits to be populated)
		html += this.getFormRow({
			label: 'Resource Limits:',
			content: '<div id="d_ec_reslim_table">' + this.getResLimitTable() + '</div>',
			caption: 'Optionally select default resource limits for jobs in this category.  These can be overridden at the event level.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_ec_notes',
				rows: 5,
				value: category.notes
			}),
			caption: 'Optionally enter any notes for the category, for your own use.'
		});
		
		return html;
	}
	
	get_category_form_json() {
		// get api key elements from form, used for new or edit
		var category = this.category;
		
		category.title = $('#fe_ec_title').val().trim();
		category.enabled = !!$('#fe_ec_enabled').is(':checked');
		category.icon = $('#fe_ec_icon').val();
		category.color = $('#fe_ec_color').val();
		// category.max_jobs = parseInt( $('#fe_ec_max_jobs').val() );
		// category.hostname_match = $('#fe_ec_match').val();
		category.notes = $('#fe_ec_notes').val();
		
		if (!category.title.length) {
			return app.badField('#fe_ec_title', "Please enter a title for the category.");
		}
		
		return category;
	}
	
	onDataUpdate(key, data) {
		// refresh list if categories were updated
		if ((key == 'categories') && (this.args.sub == 'list')) this.gosub_list(this.args);
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.cleanupRevHistory();
		this.div.html( '' );
		return true;
	}
	
};
