// Admin Page -- Configuration Editor

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Config = class Config extends Page.PageUtils {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		if (!this.requireAnyPrivilege('admin')) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		app.setHeaderTitle( '<i class="mdi mdi-cog">&nbsp;</i>Server Configuration' );
		app.setWindowTitle( "Server Configuration" );
		
		this.div.html( '' );
		this.loading();
		
		app.api.get( 'app/admin_get_config', {}, this.receive_config.bind(this), this.fullPageError.bind(this) );
		
		return true;
	}
	
	receive_config(resp) {
		// receive config from server
		var self = this;
		this.lastResp = resp;
		var { config, overrides, markdown } = resp;
		
		// parse markdown into sections
		var rows = [];
		var row = null;
		var group_id = '';
		
		markdown.trim().split(/\n/).forEach( function(line) {
			if (line.match(/<\!--\s+Group:\s+(.+?)\s+-->/i)) {
				var title = RegExp.$1;
				group_id = 'd_cfg_' + crammify(title);
				if (row) {
					rows.push(row);
					row = null;
				}
				rows.push({ Type: 'Group', Title: title, row_id: group_id });
				return;
			}
			
			if (line.match(/^\#+\s+(.+)$/)) {
				var path = RegExp.$1;
				// end previous row
				if (row) {
					rows.push(row);
					row = null;
				}
				if (path.match(/^(Configuration|Overview|secret_key|SSO|Debug|config_overrides_file)/)) return; // skip these
				row = { 
					row_id: 'd_cfg_' + crammify(path),
					elem_id: 'fe_cfg_' + crammify(path),
					group_id: group_id,
					path: path, 
					lines: [] 
				};
				
				if (path in overrides) row.value = overrides[path];
				else row.value = get_path( config, path );
				
				if (row.value === undefined) {
					// should never happen, but who knows
					row = null;
					return;
				}
				
				row.type = typeof(row.value);
			}
			else if (row) {
				if (line.match(/<\!--\s+(\w+):\s+(.+?)\s+-->/)) {
					var key = RegExp.$1;
					var value = RegExp.$2;
					if (value.match(/^\{.+\}$/) || value.match(/^\[.+\]$/)) value = JSON.parse(value);
					row[key] = value;
					
					if ((key == 'Type') && (value == 'Group')) group_id = row.row_id;
				}
				else if (row.lines.length || line.match(/\S/)) row.lines.push(line);
			}
		} ); // foreach line
		
		if (row) {
			rows.push(row);
			row = null;
		}
		
		this.rows = rows;
		this.render_config();
	}
	
	render_config() {
		// render config editor
		var self = this;
		var args = this.args;
		var resp = this.lastResp;
		var { config, overrides, markdown } = resp;
		var html = '';
		
		html += '<div class="box">';
		
		html += '<div class="box_title">';
			html += args.query ? `Settings Matching &ldquo;${args.query}&rdquo;` : 'All Configuration Settings';
			html += '<div class="box_title_widget" style="overflow:visible"><i class="mdi mdi-magnify" onClick="$(\'#fe_cfgh_search\').focus()">&nbsp;</i><input type="text" id="fe_cfgh_search" placeholder="Filter..."/></div>';
			html += '<div class="clear"></div>';
			html += '<div class="box_subtitle">' + inline_marked('Use this form to customize your xyOps configuration. [Learn More](#Docs/config)') + '</div>';
		html += '</div>';
		
		html += '<div class="box_content config_editor maximize">';
		
		this.rows.forEach( function(row, idx) {
			if (row.Type == 'Group') {
				html += self.getFormRow({ id: row.row_id, class: 'cfg_group cfg_hidden', content: '<div class="config_editor_group">' + row.Title + '</div>' });
				return;
			}
			html += self.renderConfigRow(row, idx);
		} );
		
		html += `<div class="config_editor_none" style="display:none">No configuration items matched your search filter.</div>`;
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button secondary phone_collapse" onClick="$P().goHistory()"><i class="mdi mdi-history">&nbsp;</i><span>Revision History...</span></div>';
			html += '<div class="button save" id="btn_save" onClick="$P().saveChanges()"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Changes</span></div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html ).buttonize();
		this.setupBoxButtonFloater();
		this.setupEditTriggers( this.div.find('.box_content') );
		this.applyFilters();
		
		setTimeout( function() {
			$('#fe_cfgh_search').keypress( function(event) {
				if (event.keyCode == '13') { // enter key
					event.preventDefault();
					self.doSearch( $('#fe_cfgh_search').val() );
				}
			} );
			if (args.query) $('#fe_cfgh_search').val(args.query);
		}, 1 );
	}
	
	applyFilters() {
		// apply search filters
		var self = this;
		var args = this.args;
		
		if (!args.query) {
			// show all
			this.div.find('.cfg_group, .cfg_item').removeClass('cfg_hidden').addClass('cfg_visible');
			return;
		}
		
		var re = new RegExp( escape_regexp(args.query), 'i' );
		var group_ids = {};
		var num_items = 0;
		
		this.rows.forEach( function(row, idx) {
			var $row = self.div.find('#' + row.row_id);
			if (row.Type == 'Group') {
				$row.removeClass('cfg_visible').addClass('cfg_hidden');
				return;
			}
			if (!row.path) return;
			
			var text = [ row.Title, row.path, row.lines[0].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') ].join(' ');
			if (text.match(re)) {
				$row.removeClass('cfg_hidden').addClass('cfg_visible');
				group_ids[ row.group_id ] = 1;
				num_items++;
			}
			else $row.removeClass('cfg_visible').addClass('cfg_hidden');
		});
		
		// now adjust groups
		Object.keys(group_ids).forEach( function(group_id) {
			self.div.find('#' + group_id).removeClass('cfg_hidden').addClass('cfg_visible');
		});
		
		this.div.find('.config_editor_none').toggle( num_items == 0 );
		
		this.updateBoxButtonFloaterState();
	}
	
	renderConfigRow(row, idx) {
		// render config row
		var content = '';
		var elem_id = row.elem_id;
		var label = row.Title || row.path;
		
		switch (row.Type || row.type) {
			case 'string':
				content = this.getFormText({
					id: elem_id,
					spellcheck: 'false',
					class: 'monospace',
					value: row.value
				});
			break;
			
			case 'number':
				content = this.getFormText({
					id: elem_id,
					type: 'number',
					spellcheck: 'false',
					class: 'monospace',
					value: row.value
				});
			break;
			
			case 'boolean':
				content = this.getFormCheckbox({
					id: elem_id,
					label: label,
					checked: row.value
				});
				label = '';
			break;
			
			case 'object':
				content = this.getFormTextarea({
					id: elem_id,
					rows: 1,
					value: JSON.stringify(row.value, null, "\t"),
					style: 'display:none'
				}) + '<div class="button small secondary" onClick="$P().editRowObject(' + idx + ')"><i class="mdi mdi-text-box-edit-outline">&nbsp;</i>Edit JSON...</div>';
			break;
			
			case 'Menu':
				content = this.getFormMenu({ 
					id: elem_id, 
					value: row.value, 
					options: row.Items
				});
			break;
		} // switch row.type
		
		return this.getFormRow({
			id: row.row_id,
			class: 'cfg_item cfg_hidden',
			label: label,
			content: content,
			caption: row.lines[0] + ' [Learn More](#Docs/config/' + row.path.replace(/\W+/g, '-') + ')'
		});
	}
	
	editRowObject(idx) {
		// popup json editor for object row
		var self = this;
		var row = this.rows[idx];
		var elem_id = row.elem_id;
		
		this.editCodeAuto({
			title: "Edit " + row.Title, 
			code: $('#' + elem_id).val(), 
			format: 'json',
			callback: function(new_value) {
				$('#' + elem_id).val( new_value );
				self.triggerEditChange();
			}
		});
	}
	
	doSearch(query) {
		// apply search query and refresh display
		if (query.length) this.args.query = query;
		else delete this.args.query;
		
		var url = '#' + this.ID + (num_keys(this.args) ? compose_query_string(this.args) : '');
		history.pushState( null, '', url );
		Nav.loc = url.replace(/^\#/, '');
		this.applyFilters();
	}
	
	goHistory() {
		// jump over to activity log history
		Nav.go('ActivityLog?query=config&action=system');
	}
	
	saveChanges() {
		// save current changes
		var self = this;
		var overrides = {};
		
		this.rows.forEach( function(row) {
			switch (row.Type || row.type) {
				case 'string':
				case 'Menu':
					var value = $('#' + row.elem_id).val();
					if (value != row.value) overrides[row.path] = value;
				break;
				
				case 'number':
					var value = parseFloat( $('#' + row.elem_id).val() );
					if (value != row.value) overrides[row.path] = value;
				break;
				
				case 'boolean':
					var value = $('#' + row.elem_id).is(':checked');
					if (value != row.value) overrides[row.path] = value;
				break;
				
				case 'object':
					var json = JSON.parse( $('#' + row.elem_id).val() );
					var value = stableSerialize( json );
					var old_value = stableSerialize( row.value );
					if (value != old_value) overrides[row.path] = json;
				break;
			} // switch row.type
		} );
		
		Dialog.showProgress( 1.0, "Saving Configuration..." );
		app.api.post( 'app/admin_update_config', overrides, function(resp) {
			app.cacheBust = hires_time_now();
			Dialog.hideProgress();
			self.triggerSaveComplete();
			app.showMessage('success', "Your changes were saved successfully.");
		});
	}
	
	onDeactivate() {
		// called when page is deactivated
		delete this.lastResp;
		delete this.rows;
		
		this.div.html( '' );
		return true;
	}
	
};
