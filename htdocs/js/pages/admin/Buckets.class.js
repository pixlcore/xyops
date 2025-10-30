// Admin Page -- Storage Buckets Config

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Buckets = class Buckets extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'bu';
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		if (!this.requireAnyPrivilege('create_buckets', 'edit_buckets', 'delete_buckets')) return true;
		
		if (!args) args = {};
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show bucket list
		app.setWindowTitle( "Storage Buckets" );
		app.setHeaderTitle( '<i class="mdi mdi-pail-outline">&nbsp;</i>Storage Buckets' );
		
		// this.loading();
		// app.api.post( 'app/get_buckets', copy_object(args), this.receive_buckets.bind(this) );
		
		// use buckets in app cache
		this.receive_buckets({
			code: 0,
			rows: app.buckets,
			list: { length: app.buckets.length }
		});
	}
	
	receive_buckets(resp) {
		// receive all buckets from server, render them sorted
		var self = this;
		var html = '';
		
		if (!resp.rows) resp.rows = [];
		this.buckets = resp.rows;
		
		// NOTE: Don't change these columns without also changing the responsive css column collapse rules in style.css
		var cols = ['<i class="mdi mdi-checkbox-marked-outline"></i>', 'Bucket Title', 'Bucket ID', 'Author', 'Created', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Storage Buckets';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var grid_opts = {
			rows: this.buckets,
			cols: cols,
			data_type: 'bucket',
			grid_template_columns: 'min-content' + ' auto'.repeat( cols.length - 1 )
		};
		
		html += this.getBasicGrid( grid_opts, function(item, idx) {
			var actions = [];
			if (app.hasPrivilege('edit_buckets')) actions.push( '<span class="link" onClick="$P().edit_bucket('+idx+')"><b>Edit</b></span>' );
			if (app.hasPrivilege('delete_buckets')) actions.push( '<span class="link danger" onClick="$P().delete_bucket('+idx+')"><b>Delete</b></span>' );
			
			var tds = [
				'<div class="td_drag_handle" style="cursor:default">' + self.getFormCheckbox({
					checked: item.enabled,
					onChange: '$P().toggle_bucket_enabled(this,' + idx + ')'
				}) + '</div>',
				'<b>' + self.getNiceBucket(item, app.hasPrivilege('edit_buckets')) + '</b>',
				'<span class="mono">' + item.id + '</span>',
				self.getNiceUser(item.username, app.isAdmin()),
				'<span title="' + self.getNiceDateTimeText(item.created) + '">' + self.getNiceDate(item.created) + '</span>',
				actions.join(' | ')
			];
			
			if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getBasicGrid
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			if (app.hasAnyPrivilege('create_buckets', 'edit_buckets')) html += '<div class="button phone_collapse" onClick="$P().doFileImportPrompt()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i><span>Import File...</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().go_history()"><i class="mdi mdi-history">&nbsp;</i><span>Revision History...</span></div>';
			if (app.hasPrivilege('create_buckets')) html += '<div class="button default" onClick="$P().edit_bucket(-1)"><i class="mdi mdi-plus-circle-outline">&nbsp;</i><span>New Bucket...</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.setupBoxButtonFloater();
	}
	
	toggle_bucket_enabled(elem, idx) {
		// toggle bucket checkbox, actually do the enable/disable here, update row
		var self = this;
		var item = this.buckets[idx];
		
		if (config.alt_to_toggle && !app.lastClick.altKey) {
			$(elem).prop('checked', !$(elem).is(':checked'));
			return app.showMessage('warning', "Accidental Click Protection: Please hold the Alt/Opt key to toggle this checkbox.", 8);
		}
		
		item.enabled = !!$(elem).is(':checked');
		
		app.api.post( 'app/update_bucket', item, function(resp) {
			if (!self.active) return; // sanity
			
			if (item.enabled) $(elem).closest('ul').removeClass('disabled');
			else $(elem).closest('ul').addClass('disabled');
		} );
	}
	
	edit_bucket(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Buckets?sub=edit&id=' + this.buckets[idx].id );
		else Nav.go( '#Buckets?sub=new' );
	}
	
	delete_bucket(idx) {
		// delete bucket from search results
		this.bucket = this.buckets[idx];
		this.show_delete_bucket_dialog();
	}
	
	go_history() {
		Nav.go( '#Buckets?sub=history' );
	}
	
	gosub_history(args) {
		// show revision history sub-page
		app.setHeaderNav([
			{ icon: 'pail', loc: '#Buckets?sub=list', title: 'Storage Buckets' },
			{ icon: 'history', title: "Revision History" }
		]);
		app.setWindowTitle( "Bucket Revision History" );
		
		this.goRevisionHistory({
			activityType: 'buckets',
			itemKey: 'bucket',
			editPageID: 'Buckets',
			itemMenu: {
				label: '<i class="icon mdi mdi-pail-outline">&nbsp;</i>Bucket:',
				title: 'Select Bucket',
				options: [['', 'Any Bucket']].concat( app.buckets ),
				default_icon: 'pail-outline'
			}
		});
	}
	
	gosub_new(args) {
		// create new bucket
		var html = '';
		app.setWindowTitle( "New Bucket" );
		
		app.setHeaderNav([
			{ icon: 'pail', loc: '#Buckets?sub=list', title: 'Storage Buckets' },
			{ icon: 'pail-plus-outline', title: "New Bucket" }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New Storage Bucket';
			html += '<div class="box_subtitle"><a href="#Buckets?sub=list">&laquo; Back to Bucket List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.bucket = {
			"id": "",
			"title": "",
			"enabled": true,
			"icon": "",
			"notes": ""
		};
		this.bucketData = {};
		this.bucketFiles = [];
		
		html += this.get_bucket_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button phone_collapse" onClick="$P().cancel_bucket_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
			html += '<div class="button secondary phone_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button primary" onClick="$P().do_new_bucket()"><i class="mdi mdi-floppy">&nbsp;</i><span>Create Bucket</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		// MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_bu_icon') );
		// this.updateAddRemoveMe('#fe_bu_email');
		$('#fe_bu_title').focus();
		this.setupBoxButtonFloater();
	}
	
	cancel_bucket_edit() {
		// cancel editing bucket and return to list
		Nav.go( '#Buckets?sub=list' );
	}
	
	do_new_bucket(force) {
		// create new bucket
		app.clearError();
		var bucket = this.get_bucket_form_json();
		if (!bucket) return; // error
		
		this.bucket = bucket;
		
		Dialog.showProgress( 1.0, "Creating Bucket..." );
		app.api.post( 'app/create_bucket', { ...bucket, data: this.bucketData }, this.new_bucket_finish.bind(this) );
	}
	
	new_bucket_finish(resp) {
		// new bucket created successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Buckets?sub=list');
		app.showMessage('success', "The new bucket was created successfully.");
	}
	
	gosub_edit(args) {
		// edit bucket subpage
		this.loading();
		
		app.api.post( 'app/get_bucket', { id: args.id }, this.receive_bucket.bind(this), this.fullPageError.bind(this) );
	}
	
	receive_bucket(resp) {
		// edit existing bucket
		var html = '';
		
		if (this.args.rollback && this.rollbackData) {
			resp.bucket = this.rollbackData;
			delete this.rollbackData;
			app.showMessage('info', `Revision ${resp.bucket.revision} has been loaded as a draft edit.  Click 'Save Changes' to complete the rollback.  Note that a new revision number will be assigned.`);
		}
		
		this.bucket = resp.bucket;
		this.bucketData = resp.data;
		this.bucketFiles = resp.files;
		
		if (!this.active) return; // sanity
		
		app.setWindowTitle( "Editing Bucket \"" + (this.bucket.title) + "\"" );
		
		app.setHeaderNav([
			{ icon: 'pail', loc: '#Buckets?sub=list', title: 'Storage Buckets' },
			{ icon: this.bucket.icon || 'pail-outline', title: this.bucket.title }
		]);
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit Bucket Details';
			html += '<div class="box_subtitle"><a href="#Buckets?sub=list">&laquo; Back to Bucket List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_bucket_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button cancel mobile_collapse" onClick="$P().cancel_bucket_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Close</span></div>';
			html += '<div class="button danger mobile_collapse" onClick="$P().show_delete_bucket_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>';
			html += '<div class="button secondary mobile_collapse" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>';
			html += '<div class="button save phone_collapse" onClick="$P().do_save_bucket()"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Changes</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		// MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_bu_icon') );
		// this.updateAddRemoveMe('#fe_bu_email');
		this.setupBoxButtonFloater();
		this.setupUploader();
		this.setupEditTriggers();
	}
	
	do_export() {
		// show export dialog
		app.clearError();
		var bucket = this.get_bucket_form_json();
		if (!bucket) return; // error
		
		this.showExportOptions({
			name: 'bucket',
			dataType: 'bucket',
			api: this.args.id ? 'update_bucket' : 'create_bucket',
			data: bucket
		});
	}
	
	go_edit_history() {
		Nav.go( '#Buckets?sub=history&id=' + this.bucket.id );
	}
	
	do_save_bucket() {
		// save changes to bucket
		app.clearError();
		var bucket = this.get_bucket_form_json();
		if (!bucket) return; // error
		
		this.bucket = bucket;
		
		Dialog.showProgress( 1.0, "Saving Bucket..." );
		app.api.post( 'app/update_bucket', { ...bucket, data: this.bucketData }, this.save_bucket_finish.bind(this) );
	}
	
	save_bucket_finish(resp) {
		// bucket saved successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		// Nav.go( 'Buckets?sub=list' );
		this.triggerSaveComplete();
		app.showMessage('success', "The bucket was saved successfully.");
	}
	
	show_delete_bucket_dialog() {
		// show dialog confirming bucket delete action
		var self = this;
		
		Dialog.confirmDanger( 'Delete Bucket', "Are you sure you want to <b>permanently delete</b> the storage bucket &ldquo;" + this.bucket.title + "&rdquo;?  There is no way to undo this action.", ['trash-can', 'Delete'], function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Bucket..." );
				app.api.post( 'app/delete_bucket', self.bucket, self.delete_bucket_finish.bind(self) );
			}
		} );
	}
	
	delete_bucket_finish(resp) {
		// finished deleting bucket
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		Nav.go('Buckets?sub=list', 'force');
		app.showMessage('success', "The bucket &ldquo;" + this.bucket.title + "&rdquo; was deleted successfully.");
	}
	
	get_bucket_edit_html() {
		// get html for editing an bucket (or creating a new one)
		var html = '';
		var bucket = this.bucket;
		
		if (bucket.id) {
			// bucket id
			html += this.getFormRow({
				label: 'Bucket ID:',
				content: this.getFormText({
					id: 'fe_bu_id',
					class: 'monospace',
					spellcheck: 'false',
					disabled: 'disabled',
					value: bucket.id
				}),
				suffix: this.getFormIDCopier(),
				caption: 'This is a unique ID for the bucket, used by the xyOps API.  It cannot be changed.'
			});
		}
		
		// title
		html += this.getFormRow({
			label: 'Bucket Title:',
			content: this.getFormText({
				id: 'fe_bu_title',
				spellcheck: 'false',
				value: bucket.title
			}),
			caption: 'Enter the title of the bucket, for display purposes.'
		});
		
		// enabled
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_bu_enabled',
				label: 'Bucket Enabled',
				checked: bucket.enabled
			}),
			caption: 'Check this box to enable reading and writing to the bucket.'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_bu_icon',
				title: 'Select icon for bucket',
				placeholder: 'Select icon for bucket...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: bucket.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose an icon for the bucket.'
		});
		
		// data (json)
		html += this.getFormRow({
			label: 'Bucket Data:',
			content: this.getFormTextarea({
				id: 'fe_bu_data',
				rows: 1,
				value: JSON.stringify(this.bucketData, null, "\t"),
				style: 'display:none'
			}) + '<div class="button small secondary" onClick="$P().edit_bucket_json()"><i class="mdi mdi-text-box-edit-outline">&nbsp;</i>Edit JSON...</div>',
			caption: 'View or edit the JSON data content of the bucket.  This can also be manipulated by running jobs.'
		});
		
		// files
		html += this.getFormRow({
			label: 'Bucket Files:',
			content: '<div id="d_bu_files_table">' + this.getBucketFileTable() + '</div>',
			caption: 'Upload or delete files in the bucket.  These can also be manipulated by running jobs.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_bu_notes',
				rows: 5,
				value: bucket.notes
			}),
			caption: 'Optionally enter notes for the bucket, for your own internal use.'
		});
		
		return html;
	}
	
	renderBucketFileEditor() {
		// render bucket file editor
		var html = this.getBucketFileTable();
		this.div.find('#d_bu_files_table').html( html );
	}
	
	getBucketFileTable() {
		// get html for file table
		var self = this;
		var html = '';
		var rows = sort_by( this.bucketFiles, 'filename' ); // sort in place, so idx works below
		var cols = ['Filename', 'Size', 'Modified', 'Author', 'Actions'];
		
		var add_link = this.bucket.id ? 
			'<div class="button small secondary" onClick="$P().uploadBucketFiles()"><i class="mdi mdi-cloud-upload-outline">&nbsp;</i>Upload Files...</div>' : 
			'(No files uploaded yet)';
		
		if (!rows.length) return add_link;
		
		var targs = {
			rows: rows,
			cols: cols,
			data_type: 'file',
			class: 'data_grid bucket_file_grid',
			empty_msg: add_link,
			always_append_empty_msg: true
		};
		
		html += this.getCompactGrid(targs, function(file, idx) {
			var url = '/' + file.path;
			
			var actions = [];
			// actions.push( '<a href="' + url + '?download=' + encodeURIComponent(file.filename) + '"><b>Download</b></a>' );
			actions.push( '<span class="link danger" onClick="$P().deleteBucketFile('+idx+')"><b>Delete</b></span>' );
			
			var nice_author = '';
			if (file.username) nice_author = self.getNiceUser(file.username, app.isAdmin());
			else if (file.job) nice_author = self.getNiceJob(file.job, true);
			else if (file.server) nice_author = self.getNiceServer(file.server, true);
			
			var tds = [
				'<b>' + self.getNiceFile(file.filename, url) + '</b>',
				// '<span class="monospace">' + file.id + '</span>',
				'<i class="mdi mdi-floppy">&nbsp;</i>' + get_text_from_bytes( file.size || 0 ),
				self.getRelativeDateTime(file.date),
				nice_author,
				actions.join(' | ')
			];
			
			// if (!item.enabled) tds.className = 'disabled';
			return tds;
		} ); // getCompactGrid
		
		return html;
	}
	
	setupUploader() {
		// setup upload system
		var settings = config.bucket_upload_settings;
		
		ZeroUpload.setURL( '/api/app/upload_bucket_files' );
		ZeroUpload.setMaxFiles( settings.max_files_per_bucket );
		ZeroUpload.setMaxBytes( settings.max_file_size );
		ZeroUpload.setFileTypes( settings.accepted_file_types );
		
		ZeroUpload.on('start', this.uploadStart.bind(this) );
		ZeroUpload.on('progress', this.uploadProgress.bind(this) );
		ZeroUpload.on('complete', this.uploadComplete.bind(this) );
		ZeroUpload.on('error', this.uploadError.bind(this) );
		
		ZeroUpload.init();
	}
	
	uploadBucketFiles() {
		// upload files using ZeroUpload (for progress, etc.)
		if (!this.bucket.id) return; // sanity
		
		ZeroUpload.chooseFiles({}, {
			bucket: this.bucket.id
		});
	}
	
	onDragDrop(files) {
		// intercept drag-drop event and upload files to bucket
		if (this.args.sub == 'edit') {
			ZeroUpload.upload( files, {}, {
				bucket: this.bucket.id
			} );
		}
		else this.doPrepImportFile( files[0] );
	}
	
	uploadStart(files, userData) {
		// upload has started
		Dialog.showProgress( 0.0, "Uploading files..." );
		Debug.trace('bucket', "Upload started");
	}
	
	uploadProgress(progress) {
		// file(s) are on their way
		Dialog.showProgress( progress.amount );
		Debug.trace('bucket', "Upload progress: " + progress.pct);
	}
	
	uploadComplete(response, userData) {
		// upload has completed
		Dialog.hideProgress();
		Debug.trace('bucket', "Upload complete!", response.data);
		
		var data = null;
		try { data = JSON.parse( response.data ); }
		catch (err) {
			return app.doError("Upload Failed: JSON Parse Error: " + err);
		}
		
		if (data && (data.code != 0)) {
			return app.doError("Upload Failed: " + data.description);
		}
		
		// update local copy
		this.bucketFiles = data.files;
		this.renderBucketFileEditor();
		this.triggerEditChange();
		
		app.showMessage('success', "Upload completed successfully.");
	}
	
	uploadError(type, message, userData) {
		// upload error of some kind
		Dialog.hideProgress();
		app.doError("Upload Failed: " + message);
	}
	
	deleteBucketFile(idx) {
		// delete single file
		var self = this;
		var bucket = this.bucket;
		var file = this.bucketFiles[idx];
		
		Dialog.confirmDanger( 'Delete File', "Are you sure you want to permanently delete the bucket file &ldquo;<b>" + file.filename + "</b>&rdquo;?  There is no way to undo this operation.", ['trash-can', 'Delete'], function(result) {
			if (!result) return;
			app.clearError();
			Dialog.showProgress( 1.0, "Deleting File..." );
			
			app.api.post( 'app/delete_bucket_file', { id: bucket.id, path: file.path }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "File &ldquo;" + file.filename + "&rdquo; was deleted successfully.");
				
				if (!self.active) return; // sanity
				
				self.bucketFiles.splice( idx, 1 );
				self.renderBucketFileEditor();
				self.triggerEditChange();
			} ); // api.post
		} ); // confirm
	}
	
	edit_bucket_json() {
		// popup json editor for test dialog
		var self = this;
		
		this.editCodeAuto("Edit Bucket JSON", $('#fe_bu_data').val(), function(new_value) {
			$('#fe_bu_data').val( new_value );
			self.triggerEditChange();
		});
	}
	
	get_bucket_form_json() {
		// get api key elements from form, used for new or edit
		var bucket = this.bucket;
		
		bucket.title = $('#fe_bu_title').val().trim();
		bucket.enabled = $('#fe_bu_enabled').is(':checked') ? true : false;
		bucket.icon = $('#fe_bu_icon').val();
		bucket.notes = $('#fe_bu_notes').val();
		
		try {
			this.bucketData = JSON.parse( $('#fe_bu_data').val() );
		}
		catch (err) {
			return app.doError("Failed to parse JSON in bucket data: " + err);
		}
		
		if (!bucket.title.length) {
			return app.badField('#fe_bu_title', "Please enter a title for the bucket.");
		}
		
		return bucket;
	}
	
	onDataUpdate(key, data) {
		// refresh list if buckets were updated
		if ((key == 'buckets') && (this.args.sub == 'list')) this.gosub_list(this.args);
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.cleanupRevHistory();
		this.div.html( '' );
		
		delete this.bucket;
		delete this.bucketData;
		delete this.bucketFiles;
		
		return true;
	}
	
};
