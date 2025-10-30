// Admin Page -- Tag Config

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Tags = class Tags extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'et';
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		if (!this.requireAnyPrivilege('create_tags', 'edit_tags', 'delete_tags')) return true;
		
		if (!args) args = {};
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show tag list
		app.setWindowTitle( "Tags" );
		app.setHeaderTitle( '<i class="mdi mdi-tag-multiple-outline">&nbsp;</i>Tags' );
		
		// use tags in app cache
		this.receive_tags({
			code: 0,
			rows: app.tags,
			list: { length: app.tags.length }
		});
	}
	
	receive_tags(resp) {
		// receive all tags from server, render them sorted
		var html = '';
		if (!resp.rows) resp.rows = [];
		if (!this.active) return; // sanity
		
		// sort by title ascending
		this.tags = resp.rows.sort( function(a, b) {
			return a.title.toLowerCase().localeCompare( b.title.toLowerCase() );
		} );
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['Tag', 'ID', 'Author', 'Created', 'Modified', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'All Tags';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var self = this;
		html += this.getBasicGrid( this.tags, cols, 'tag', function(item, idx) {
			var actions = [];
			if (app.hasPrivilege('edit_tags')) actions.push( '<span class="link" onClick="$P().edit_tag('+idx+')"><b>Edit</b></span>' );
			if (app.hasPrivilege('delete_tags')) actions.push( '<span class="link danger" onClick="$P().delete_tag('+idx+')"><b>Delete</b></span>' );
			
			return [
				'<b>' + self.getNiceTag(item, !!app.hasPrivilege('edit_tags')) + '</b>',
				'<span class="mono">' + item.id + '</span>',
				self.getNiceUser(item.username, app.isAdmin()),
				
				'<span title="'+self.getNiceDateTimeText(item.created)+'">'+self.getNiceDate(item.created)+'</span>',
				'<span title="'+self.getNiceDateTimeText(item.modified)+'">'+self.getNiceDate(item.modified)+'</span>',
				
				actions.join(' | ')
			];
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			if (app.hasAnyPrivilege('create_tags', 'edit_tags')) html += '<div class="button phone_collapse" onClick="$P().doFileImportPrompt()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i><span>Import File...</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().go_history()"><i class="mdi mdi-history">&nbsp;</i><span>Revision History...</span></div>';
			if (app.hasPrivilege('create_tags')) html += '<div class="button default" onClick="$P().edit_tag(-1)"><i class="mdi mdi-tag-plus-outline">&nbsp;</i><span>New Tag...</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.setupBoxButtonFloater();
	}
	
	edit_tag(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Tags?sub=edit&id=' + this.tags[idx].id );
		else Nav.go( '#Tags?sub=new' );
	}
	
	delete_tag(idx) {
		// delete tag from search results
		this.tag = this.tags[idx];
		this.show_delete_tag_dialog();
	}
	
	go_history() {
		Nav.go( '#Tags?sub=history' );
	}
	
	gosub_history(args) {
		// show revision history sub-page
		app.setHeaderNav([
			{ icon: 'tag-multiple-outline', loc: '#Tags?sub=list', title: 'Tags' },
			{ icon: 'history', title: "Revision History" }
		]);
		app.setWindowTitle( "Tag Revision History" );
		
		this.goRevisionHistory({
			activityType: 'tags',
			itemKey: 'tag',
			editPageID: 'Tags',
			itemMenu: {
				label: '<i class="icon mdi mdi-tag-multiple-outline">&nbsp;</i>Tag:',
				title: 'Select Tag',
				options: [['', 'Any Tag']].concat( app.tags ),
				default_icon: 'tag-outline'
			}
		});
	}
	
	gosub_new(args) {
		// create new tag
		var html = '';
		app.setWindowTitle( "New Tag" );
		
		app.setHeaderNav([
			{ icon: 'tag-multiple-outline', loc: '#Tags?sub=list', title: 'Tags' },
			{ icon: 'tag-plus-outline', title: "New Tag" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Create New Tag';
			html += '<div class="box_subtitle"><a href="#Tags?sub=list">&laquo; Back to Tag List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.tag = {
			id: "",
			title: "",
			icon: "tag-outline"
		};
		
		html += this.get_tag_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button phone_collapse" onClick="$P().cancel_tag_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button primary" onClick="$P().do_new_tag()"><i class="mdi mdi-tag-plus-outline">&nbsp;</i><span>Create Tag</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		$('#fe_et_title').focus();
		SingleSelect.init( this.div.find('#fe_et_icon') );
		this.setupBoxButtonFloater();
	}
	
	cancel_tag_edit() {
		// cancel editing tag and return to list
		Nav.go( '#Tags?sub=list' );
	}
	
	do_new_tag(force) {
		// create new tag
		app.clearError();
		var tag = this.get_tag_form_json();
		if (!tag) return; // error
		
		this.tag = tag;
		
		Dialog.showProgress( 1.0, "Creating Tag..." );
		app.api.post( 'app/create_tag', tag, this.new_tag_finish.bind(this) );
	}
	
	new_tag_finish(resp) {
		// new tag created successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Tags?sub=list');
		app.showMessage('success', "The new tag was created successfully.");
	}
	
	gosub_edit(args) {
		// edit tag subpage
		this.loading();
		app.api.post( 'app/get_tag', { id: args.id }, this.receive_tag.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_tag(resp) {
		// edit existing tag
		var html = '';
		
		if (this.args.rollback && this.rollbackData) {
			resp.tag = this.rollbackData;
			delete this.rollbackData;
			app.showMessage('info', `Revision ${resp.tag.revision} has been loaded as a draft edit.  Click 'Save Changes' to complete the rollback.  Note that a new revision number will be assigned.`);
		}
		
		this.tag = resp.tag;
		if (!this.active) return; // sanity
		
		app.setWindowTitle( "Editing Tag \"" + (this.tag.title) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'tag-multiple-outline', loc: '#Tags?sub=list', title: 'Tags' },
			{ icon: this.tag.icon || 'tag-outline', title: this.tag.title }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit Tag Details';
			html += '<div class="box_subtitle"><a href="#Tags?sub=list">&laquo; Back to Tag List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_tag_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button cancel mobile_collapse" onClick="$P().cancel_tag_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Close</span></div>';
			html += '<div class="button danger mobile_collapse" onClick="$P().show_delete_tag_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
			html += '<div class="button save phone_collapse" onClick="$P().do_save_tag()"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Changes</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		SingleSelect.init( this.div.find('#fe_et_icon') );
		this.setupBoxButtonFloater();
		this.setupEditTriggers();
	}
	
	do_export() {
		// show export dialog
		app.clearError();
		var tag = this.get_tag_form_json();
		if (!tag) return; // error
		
		this.showExportOptions({
			name: 'tag',
			dataType: 'tag',
			api: this.args.id ? 'update_tag' : 'create_tag',
			data: tag
		});
	}
	
	go_edit_history() {
		Nav.go( '#Tags?sub=history&id=' + this.tag.id );
	}
	
	do_save_tag() {
		// save changes to tag
		app.clearError();
		var tag = this.get_tag_form_json();
		if (!tag) return; // error
		
		this.tag = tag;
		
		Dialog.showProgress( 1.0, "Saving Tag..." );
		app.api.post( 'app/update_tag', tag, this.save_tag_finish.bind(this) );
	}
	
	save_tag_finish(resp) {
		// new tag saved successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		// Nav.go( 'Tags?sub=list' );
		this.triggerSaveComplete();
		app.showMessage('success', "The tag was saved successfully.");
	}
	
	show_delete_tag_dialog() {
		// show dialog confirming tag delete action
		var self = this;
		
		Dialog.confirmDanger( 'Delete Tag', "Are you sure you want to <b>permanently delete</b> the tag &ldquo;" + this.tag.title + "&rdquo;?  There is no way to undo this action.", ['trash-can', 'Delete'], function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Tag..." );
				app.api.post( 'app/delete_tag', self.tag, self.delete_tag_finish.bind(self) );
			}
		} );
	}
	
	delete_tag_finish(resp) {
		// finished deleting tag
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Tags?sub=list', 'force');
		app.showMessage('success', "The tag &ldquo;" + this.tag.title + "&rdquo; was deleted successfully.");
	}
	
	get_tag_edit_html() {
		// get html for editing an tag (or creating a new one)
		var html = '';
		var tag = this.tag;
		
		if (tag.id) {
			// tag id
			html += this.getFormRow({
				label: 'Tag ID:',
				content: this.getFormText({
					id: 'fe_et_id',
					class: 'monospace',
					spellcheck: 'false',
					disabled: 'disabled',
					value: tag.id
				}),
				suffix: this.getFormIDCopier(),
				caption: 'This is a unique ID for the tag, used by the xyOps API.  It cannot be changed.'
			});
		}
		
		// title
		html += this.getFormRow({
			label: 'Tag Title:',
			content: this.getFormText({
				id: 'fe_et_title',
				spellcheck: 'false',
				value: tag.title
			}),
			caption: 'Enter the title (label) for the tag, for display purposes.'
		});
		
		html += this.getFormRow({
			label: 'Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_et_icon',
				title: 'Select icon for tag',
				placeholder: 'Select icon for tag...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: tag.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for the tag.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Description:',
			content: this.getFormTextarea({
				id: 'fe_et_notes',
				rows: 5,
				value: tag.notes
			}),
			caption: 'Optionally enter a description, for internal use.'
		});
		
		return html;
	}
	
	get_tag_form_json() {
		// get api key elements from form, used for new or edit
		var tag = this.tag;
		
		tag.title = $('#fe_et_title').val().trim();
		tag.icon = $('#fe_et_icon').val().replace(/^mdi\-/, '');
		tag.notes = $('#fe_et_notes').val();
		
		if (!tag.title.length) {
			return app.badField('#fe_et_title', "Please enter a title for the tag.");
		}
		
		return tag;
	}
	
	onDataUpdate(key, data) {
		// refresh list if tags were updated
		if ((key == 'tags') && (this.args.sub == 'list')) this.gosub_list(this.args);
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.cleanupRevHistory();
		this.div.html( '' );
		return true;
	}
	
};
