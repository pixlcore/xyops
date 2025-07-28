// Scheduler -- Workflow Config

// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the PixlCore Sustainable Use License.
// See the LICENSE.md file in this repository.

Page.Workflows = class Workflows extends Page.Events {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
		this.dom_prefix = 'ee';
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		if (!args.sub && args.id) args.sub = 'view';
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		app.highlightTab( 'Events' );
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_new(args) {
		// create new event
		var html = '';
		var do_snap = true;
		
		app.setHeaderNav([
			{ icon: 'calendar-multiple', loc: '#Events?sub=list', title: 'Events' },
			{ icon: 'clipboard-edit-outline', title: "New Workflow" }
		]);
		
		// app.setHeaderTitle( '<i class="mdi mdi-calendar-plus">&nbsp;</i>New Event' );
		app.setWindowTitle( "New Workflow" );
		
		html += '<div class="box" style="overflow:hidden">';
		html += '<div class="box_title">';
			html += 'New Workflow';
			html += '<div class="box_subtitle"><a href="#Events?sub=list">&laquo; Back to Event List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		if (this.getPageDraft()) {
			// restore draft
			this.event = this.checkRestorePageDraft();
			do_snap = false;
		}
		else {
			this.event = deep_copy_object( app.config.new_event_template );
		
			this.event.triggers = []; // the user needs to add these by hand
		
			this.event.workflow = this.workflow = {
				nodes: [],
				connections: []
			};
		}
		
		this.params = this.event.fields; // for user form param editor
		this.limits = this.event.limits; // for res limit editor
		this.actions = this.event.actions; // for job action editor
		
		if (find_object(app.categories, { id: 'general' })) this.event.category = 'general';
		else if (!app.categories.length) return this.doFullPageError("You must define at least one category to add workflows.");
		else this.event.category = app.categories[0].id;
		
		// render form
		html += this.get_wf_form_html();
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		// render workflow editor
		html += this.get_wf_editor_html(`
			<div class="button primary right mobile_collapse" onClick="$P().do_new_workflow()"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Workflow<span></div>
			<div class="button secondary right mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>
			<div class="button right mobile_collapse" onClick="$P().cancel_workflow_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>
		`);
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ee_icon, #fe_ee_cat, #fe_ee_algo') );
		// this.renderPluginParamEditor();
		this.renderParamEditor();
		// this.updateAddRemoveMe('#fe_ee_email');
		$('#fe_ee_title').focus();
		// this.setupBoxButtonFloater();
		
		this.setupWorkflowEditor();
		
		if (do_snap) this.savePageSnapshot( this.get_event_form_json(true) );
	}
	
	cancel_workflow_edit() {
		// cancel editing wf and return to list
		// delete draft + snap
		this.deletePageDraft();
		this.deletePageSnapshot();
		
		if (this.event.id) Nav.go( '#Events?sub=view&id=' + this.event.id );
		else Nav.go( '#Events?sub=list' );
	}
	
	do_new_workflow() {
		// create new workflow
		app.clearError();
		var event = this.get_event_form_json();
		if (!event) return; // error
		
		this.event = event;
		
		Dialog.showProgress( 1.0, "Creating Workflow..." );
		app.api.post( 'app/create_event', event, this.new_workflow_finish.bind(this) );
	}
	
	new_workflow_finish(resp) {
		// new workflow created successfully
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		this.deletePageSnapshot();
		this.deletePageDraft();
		
		Nav.go('Events?sub=list');
		app.showMessage('success', "The new workflow was created successfully.");
	}
	
	gosub_edit(args) {
		// edit workflow subpage
		this.loading();
		
		var event = find_object( app.events, { id: args.id } );
		if (!event) return this.doFullPageError("Workflow not found: " + args.id);
		
		if (args.rollback && this.rollbackData) {
			event = this.rollbackData;
			delete this.rollbackData;
			app.showMessage('info', `Revision ${event.revision} has been loaded as a draft edit.  Click 'Save Changes' to complete the rollback.  Note that a new revision number will be assigned.`);
		}
		
		this.receive_workflow({ code: 0, event: deep_copy_object(event) });
	}
	
	receive_workflow(resp) {
		// edit existing workflow
		var html = '';
		var do_snap = true;
		
		if (this.getPageDraft()) {
			this.event = this.checkRestorePageDraft();
			do_snap = false;
			app.showMessage('info', "Your previous unsaved edits were restored.  Click the 'Cancel' button to discard them.");
		}
		else {
			this.event = resp.event;
		}
		
		if (!this.event.fields) this.event.fields = [];
		this.params = this.event.fields; // for user form param editor
		this.limits = this.event.limits; // for res limit editor
		this.actions = this.event.actions; // for job action editor
		this.workflow = this.event.workflow;
		
		app.setHeaderNav([
			{ icon: 'calendar-multiple', loc: '#Events?sub=list', title: 'Events' },
			{ icon: this.event.icon || 'clipboard-flow-outline', loc: '#Events?sub=view&id=' + this.event.id, title: this.event.title },
			{ icon: 'clipboard-edit-outline', title: "Edit Workflow" }
		]);
		
		// app.setHeaderTitle( '<i class="mdi mdi-calendar-edit">&nbsp;</i>Event Editor' );
		app.setWindowTitle( "Editing Workflow \"" + (this.event.title) + "\"" );
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Edit Workflow Details';
			html += '<div class="box_subtitle"><a href="#Events?sub=view&id=' + this.event.id + '">&laquo; Back to Workflow</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_wf_form_html();
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		// render workflow editor
		html += this.get_wf_editor_html(`
			<div class="button primary right mobile_collapse" onClick="$P().do_save_workflow()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>
			<div class="button secondary right mobile_collapse" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>History...</span></div>
			<div class="button secondary right mobile_collapse" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>Export...</span></div>
			<div class="button danger right mobile_collapse" onClick="$P().show_delete_event_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete...</span></div>
			<div class="button right mobile_collapse" onClick="$P().cancel_workflow_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>
		`);
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_ee_icon, #fe_ee_cat, #fe_ee_algo') );
		// this.renderPluginParamEditor();
		this.renderParamEditor();
		// this.updateAddRemoveMe('#fe_ee_email');
		// $('#fe_ee_title').focus();
		// this.setupBoxButtonFloater();
		
		this.setupWorkflowEditor();
		
		if (do_snap) this.savePageSnapshot( this.get_event_form_json(true) );
		if (this.args.scroll == 'bottom') app.scrollToBottom();
	}
	
	do_save_workflow() {
		// save changes to workflow
		app.clearError();
		var event = this.get_event_form_json();
		if (!event) return; // error
		
		this.event = event;
		
		Dialog.showProgress( 1.0, "Saving Workflow..." );
		app.api.post( 'app/update_event', event, this.save_workflow_finish.bind(this) );
	}
	
	save_workflow_finish(resp) {
		// workflow changes saved successfully
		app.cacheBust = hires_time_now();
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		this.deletePageSnapshot();
		this.deletePageDraft();
		
		// update in-memory copy, to prevent race condition on view page
		var idx = find_object_idx(app.events, { id: this.event.id });
		if (idx > -1) {
			this.event.modified = app.epoch;
			this.event.revision++;
			merge_hash_into( app.events[idx], this.event );
		}
		
		Nav.go( 'Events?sub=view&id=' + this.event.id );
		app.showMessage('success', "The workflow was saved successfully.");
	}
	
	//
	// Workflow Editor
	//
	
	setupWorkflowEditor() {
		// setup basic workflow viewer
		this.setupWorkflow();
		
		// add editing capabilities
		this.wfEdit = true;
		
		// setup undo system, add initial snapshot
		this.wfSnapshots = [];
		this.wfSnapIdx = 0;
		this.addState();
		
		// setup mouse drag handling on nodes
		this.afterDraw();
	}
	
	afterDraw() {
		// setup mouse drag handling on nodes
		var self = this;
		var $cont = this.wfGetContainer();
		
		$cont.find('div.wf_node').on( 'mousedown', function(event) {
			if (event.which !== 1) return; // only capture left-clicks
			var $this = $(this);
			var id = this.id.replace(/^d_wfn_/, '');
			
			event.stopPropagation();
			event.preventDefault();
			
			if (self.wfSoldering) {
				// allow clicks anywhere in the node for completing solders
				if ($this.find('.wf_pole_button').length) return self.completeSolder($this, id);
				else return self.cancelSolder();
			}
			
			if (event.shiftKey) {
				// toggle selection on/off for individual nodes
				if (!self.wfSelection[id]) self.wfSelection[id] = 1; // select node
				else delete self.wfSelection[id]; // deselect node
				self.updateSelection();
				return;
			} // shiftKey
			
			if (!self.wfSelection[id]) {
				// node is not yet selected, so deselect all and then select it
				self.wfSelection = {};
				self.wfSelection[id] = 1;
				self.updateSelection();
			}
			
			// prepare for dragging entire selection
			self.prepareForDrag(event);
		} ); // mousedown (nodes)
		
		$cont.find('div.wf_node').on( 'dblclick', function(event) {
			// check for double-click
			self.doEditSelection();
		}); // mouseup (nodes)
		
		// add mouse handler for condition entities
		$cont.find('div.wf_condition').on( 'mousedown', function(event) {
			if (event.which !== 1) return; // only capture left-clicks
			var conn_id = this.id.replace(/^d_wft_/, '');
			
			event.stopPropagation();
			event.preventDefault();
			
			self.quickEditCondition( $(this), conn_id );
		}); // mousedown (conditions)
		
		// update selection after all full draws
		this.updateSelection();
	}
	
	quickEditCondition($trig, id) {
		// popup menu to change condition type
		var self = this;
		var workflow = this.workflow;
		var conn = find_object( workflow.connections, { id: id } );
		
		this.deselectAll();
		
		SingleSelect.popupQuickMenu({
			elem: '#d_wft_' + id,
			title: 'Select Condition',
			items: [ 
				...config.ui.action_condition_menu
			].concat(
				this.buildOptGroup( app.tags, "On Custom Tag:", 'tag-outline', 'tag:' )
			),
			value: conn.condition,
			
			callback: function(value) {
				// new condition type selected
				conn.condition = value;
				self.drawWorkflow(true);
				self.afterDraw();
				self.addState();
			} // callback
		}); // popupQuickMenu
	}
	
	prepareForDrag(event) {
		// prepare for single- or multi-node drag operation
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		var selection = this.wfSelection;
		var start_pt = { x: event.clientX, y: event.clientY };
		var start_wf = deep_copy_object(workflow);
		
		this.wfDragging = false;
		
		$(document).on('mousemove.drag', function(event) {
			// update all selected positions
			for (var id in selection) {
				var node = find_object( workflow.nodes, { id: id } );
				var orig = find_object( start_wf.nodes, { id: id } );
				
				node.x = orig.x + ((event.clientX - start_pt.x) / self.wfZoom);
				node.y = orig.y + ((event.clientY - start_pt.y) / self.wfZoom);
				
				// snap to grid
				if (event.altKey) { node.x -= (node.x % 20); node.y -= (node.y % 20); }
				
				var pos = self.getWFPos(node);
				var $elem = $cont.find('#d_wfn_' + node.id);
				$elem.css({ left: '' + pos.x + 'px', top: '' + pos.y + 'px' });
				
				if (!self.wfDragging) $elem.css('cursor', 'grabbing');
			} // foreach selected node
			
			self.renderWFConnections();
			
			if (!self.wfDragging) {
				self.wfDragging = true;
				$cont.addClass('dragging');
			}
		}); // mousemove
		
		$(document).on('mouseup.drag', function(event) {
			for (var id in selection) {
				var $elem = $cont.find('#d_wfn_' + id);
				$elem.css('cursor', '');
			}
			$(document).off('.drag');
			
			// add snapshot to undo buffer, but only if dragging happened
			if (self.wfDragging) {
				self.addState();
				$cont.removeClass('dragging');
			}
		}); // mouseup
	}
	
	deselectAll() {
		// deselect all nodes and refresh
		this.wfSelection = {};
		this.updateSelection();
	}
	
	updateSelection() {
		// selection was changed -- show/hide contextual toolbar icons and update state
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		var selection = this.wfSelection;
		var num_sel = num_keys(selection);
		
		// update node css classes
		workflow.nodes.forEach( function(node) {
			var $elem = $cont.find('#d_wfn_' + node.id);
			if (selection[node.id] && !$elem.hasClass('selected')) $elem.addClass('selected');
			else if (!selection[node.id] && $elem.hasClass('selected')) $elem.removeClass('selected');
		} );
		
		// add effect for freshly added nodes
		Object.keys(selection).forEach( function(id) {
			if (selection[id] != 2) return; // 2 = special flag for "new node"
			selection[id] = 1;
			
			var $elem = $cont.find('#d_wfn_' + id);
			void $elem[0].offsetWidth; // force DOM recalc for animation before state
			$elem.addClass('wf_flash');
		} );
		
		// pole buttons
		$cont.find('.wf_pole_button').remove();
		
		if (num_sel == 1) {
			// solo selection, add poles
			var id = first_key(selection);
			var $elem = $cont.find('#d_wfn_' + id);
			
			$elem.find('.wf_pole').each( function() {
				var $pole = $(this);
				var $btn = $pole.clone().removeClass('wf_pole').addClass('wf_pole_button').on('mousedown', function(event) {
					event.stopPropagation();
					event.preventDefault();
					
					if (event.altKey) self.detachPole($btn, id);
					else self.startSolder($btn, id);
				});
				$pole.after($btn);
			} );
		}
		
		// update toolbar icons
		if (num_sel) {
			$cont.find('#d_btn_wf_dup, #d_btn_wf_dis, #d_btn_wf_del').show();
			$cont.find('.wf_sel_msg').html( commify(num_sel) + ' ' + pluralize('item', num_sel) + ' selected' );
			$cont.find('.wf_title').hide();
		}
		else {
			$cont.find('#d_btn_wf_dup, #d_btn_wf_dis, #d_btn_wf_del').hide();
			$cont.find('.wf_sel_msg').html( "" );
			$cont.find('.wf_title').show();
		}
		
		if (num_sel == 1) {
			$cont.find('#d_btn_wf_edit, #d_btn_wf_test').show();
		}
		else {
			$cont.find('#d_btn_wf_edit, #d_btn_wf_test').hide();
		}
		
		// update undo state with new selection
		this.updateState();
	}
	
	detachPole($btn, id) {
		// detach all connections on a specific pole
		var self = this;
		var workflow = this.workflow;
		var node = find_object( workflow.nodes, { id: id } );
		
		if (!$btn[0].className.match(/\b(wf_[a-z]+_pole)\b/)) return; // sanity
		var pole = RegExp.$1;
		var new_conns = [];
		
		workflow.connections.forEach( function(conn) {
			var yes_delete = false;
			
			if (node.type.match(/^(event|job)$/)) {
				// events have three poles, so this requires extra sniffing
				switch (pole) {
					case 'wf_input_pole':
						if (conn.dest == id) yes_delete = true;
					break;
					
					case 'wf_output_pole':
						var dest_node = find_object( workflow.nodes, { id: conn.dest } );
						if ((conn.source == id) && (dest_node.type != 'limit')) yes_delete = true;
					break;
					
					case 'wf_down_pole':
						var dest_node = find_object( workflow.nodes, { id: conn.dest } );
						if ((conn.source == id) && (dest_node.type == 'limit')) yes_delete = true;
					break;
				}
			}
			else if (node.type.match(/^(action|limit)$/)) {
				// these only have one input pole
				if (conn.dest == id) yes_delete = true;
			}
			else if (node.type.match(/^(trigger)$/)) {
				// these only have one output pole
				if (conn.source == id) yes_delete = true;
			}
			else {
				// all other types have two poles
				switch (pole) {
					case 'wf_input_pole':
						if (conn.dest == id) yes_delete = true;
					break;
					
					case 'wf_output_pole':
						if (conn.source == id) yes_delete = true;
					break;
				}
			}
			
			if (!yes_delete) new_conns.push(conn);
		}); // foreach connection
		
		workflow.connections = new_conns;
		
		this.drawWorkflow(true);
		this.afterDraw();
		this.addState();
	}
	
	startSolder($btn, id) {
		// start a solder operation
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		var $fade = $cont.find('.wf_fade');
		var start_node = find_object( workflow.nodes, { id: id } );
		
		if (!$btn[0].className.match(/\b(wf_[a-z]+_pole)\b/)) return; // sanity
		var start_pole = RegExp.$1;
		
		var pole_map = {
			wf_input_pole: 'wf_output_pole',
			wf_output_pole: 'wf_input_pole',
			wf_down_pole: 'wf_up_pole',
			wf_up_pole: 'wf_down_pole'
		};
		var end_pole = pole_map[start_pole];
		
		var dir_map = {
			wf_input_pole: { start_dir: 'left', end_dir: 'right' },
			wf_output_pole: { start_dir: 'right', end_dir: 'left' },
			wf_down_pole: { start_dir: 'bottom', end_dir: 'top' },
			wf_up_pole: { start_dir: 'top', end_dir: 'bottom' }
		};
		
		var solder = this.wfSoldering = {
			start_node: id,
			start_pole: start_pole,
			end_pole: end_pole,
			...dir_map[start_pole]
		};
		
		// remove all pole buttons (except $btn, but kill mousedown on it)
		$btn.off('mousedown').addClass('soldering').data('keep', 1);
		
		$cont.find('.wf_pole_button').each( function() {
			var $this = $(this);
			if (!$this.data('keep')) $this.remove();
		} );
		
		// add new destination pole buttons for completing solder (all nodes except ours)
		workflow.nodes.forEach( function(node) {
			if (node.id == id) return; // skip origin node
			var $elem = $cont.find('#d_wfn_' + node.id);
			
			// some nodes cannot connect to action nodes, in either direction (despite having "compatible" poles)
			if ((start_node.type.match(/^(controller|trigger)$/)) && (node.type == 'action')) return;
			if ((node.type.match(/^(controller|trigger)$/)) && (start_node.type == 'action')) return;
			
			$elem.find('.wf_pole.' + end_pole).each( function() {
				var $pole = $(this);
				var $btn = $pole.clone().removeClass('wf_pole').addClass('wf_pole_button').html('<i class="mdi mdi-plus"></i>').on('mousedown', function(event) {
					event.stopPropagation();
					event.preventDefault();
					self.completeSolder($btn, node.id);
				});
				$pole.after($btn);
			} );
		} ); // foreach node
		
		// add mouse tracker div
		var $tracker = $('<div id="d_wf_mouse_tracker"></div>');
		$fade.append($tracker);
		
		// pre-compute theme color for use in canvas
		var color = app.getCSSVar('--theme-color');
		
		// add mousemove handler to track solder operation
		$cont.on('mousemove.solder', function(event) {
			// update mouse tracker position
			var el = event.target, x = event.offsetX / self.wfZoom, y = event.offsetY / self.wfZoom;
			
			while (el.id != 'd_wf_container') {
				x += el.offsetLeft;
				y += el.offsetTop;
				el = el.offsetParent;
				if (!el) break; // sanity
			}
			
			$tracker.css({ left: x, top: y });
			
			// redraw connections
			self.renderWFConnections();
			
			// add our temp connection
			var canvas = $cont.find('canvas').get(0);
			var ctx = canvas.getContext('2d');
			
			ctx.save();
			ctx.scale( window.devicePixelRatio * self.wfZoom, window.devicePixelRatio * self.wfZoom );
			ctx.lineJoin = "round";
			ctx.lineWidth = 4;
			
			var opts = {
				ctx: ctx,
				sel1: `#d_wfn_${solder.start_node} .${solder.start_pole}`,
				sel2: `#d_wf_mouse_tracker`,
				start_dir: solder.start_dir,
				end_dir: solder.end_dir,
				custom: { "strokeStyle": color, "lineDash": [6, 6] }
			};
			
			if (solder.start_pole.match(/^(wf_input_pole|wf_up_pole)$/)) {
				// swap poles and dirs for proper curve extension logic
				opts.sel1 = `#d_wf_mouse_tracker`;
				opts.sel2 = `#d_wfn_${solder.start_node} .${solder.start_pole}`;
				opts.start_dir = solder.end_dir;
				opts.end_dir = solder.start_dir;
			}
			
			self.renderWFConnection(opts);
			ctx.restore();
		}); // mousemove
		
		// add `dragging` class to disable floating buttons, and customize cursor
		$cont.addClass('dragging');
		$cont.find('#d_wf_editor').css('cursor', 'crosshair');
	}
	
	cancelSolder() {
		// cancel current solder in progress
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		
		$cont.find('#d_wf_mouse_tracker').remove();
		$cont.off('.solder');
		$cont.removeClass('dragging');
		$cont.find('#d_wf_editor').css('cursor', '');
		
		delete this.wfSoldering;
		
		this.drawWorkflow(true);
		this.afterDraw();
	}
	
	doAddNode() {
		// add new node from button (no solder)
		var self = this;
		
		SingleSelect.popupQuickMenu({
			elem: '#d_btn_wf_new',
			title: 'Add New Node',
			items: config.ui.workflow_new_node_menu,
			value: '',
			nocheck: true,
			
			callback: function(value) {
				// pop dialog to configure and apply new node
				var func = 'doEditNode_' + value;
				self[func]();
			} // callback
			
		}); // popupQuickMenu
	}
	
	solderNewNode() {
		// pause solder and pop menu to create new node in place
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		var scroll = this.wfScroll;
		
		var solder = this.wfPausedSolder = this.wfSoldering;
		delete this.wfSoldering;
		
		// add mouse tracker position to solder state
		var $tracker = $cont.find('#d_wf_mouse_tracker');
		solder.x = scroll.x + $tracker[0].offsetLeft;
		solder.y = scroll.y + $tracker[0].offsetTop;
		
		$cont.off('.solder');
		$cont.removeClass('dragging');
		$cont.find('#d_wf_editor').css('cursor', '');
		
		// apply rules on which nodes are allowed based on the solder in progress
		var allowed_types = {};
		var start_node = find_object( workflow.nodes, { id: solder.start_node } );
		var start_pole = solder.start_pole;
		
		if (start_pole == 'wf_down_pole') {
			allowed_types.limit = 1;
		}
		else if (start_pole == 'wf_up_pole') {
			allowed_types.event = 1;
			allowed_types.job = 1;
		}
		else if (start_pole == 'wf_output_pole') {
			allowed_types.event = 1;
			allowed_types.job = 1;
			
			if (start_node.type.match(/^(event|job)$/)) { allowed_types.action = 1; allowed_types.controller = 1; }
			if (start_node.type == 'controller') { allowed_types.controller = 1; }
			if (start_node.type == 'trigger') { allowed_types.controller = 1; }
		}
		else if (start_pole == 'wf_input_pole') {
			allowed_types.event = 1;
			allowed_types.job = 1;
			
			if (start_node.type.match(/^(event|job)$/)) { allowed_types.trigger = 1; allowed_types.controller = 1; }
			if (start_node.type == 'controller') { allowed_types.trigger = 1; allowed_types.controller = 1; }
		}
		
		SingleSelect.popupQuickMenu({
			elem: '#d_wf_mouse_tracker',
			title: 'Add New Node',
			items: [ 
				...config.ui.workflow_new_node_menu.filter( function(item) { return allowed_types[item.id]; } )
			],
			value: '',
			nocheck: true,
			
			callback: function(value) {
				// new type selected
				$tracker.remove();
				self.drawWorkflow(true);
				self.afterDraw();
				
				// pop dialog to configure and apply new node
				var func = 'doEditNode_' + value;
				self[func]();
			}, // callback
			
			onCancel: function() {
				// cleanup
				delete self.wfPausedSolder;
				$tracker.remove();
				self.drawWorkflow(true);
				self.afterDraw();
			}
		}); // popupQuickMenu
	}
	
	resumePausedSolder(id, width, height) {
		// complete a solder that was paused to create a new node
		var workflow = this.workflow;
		var node = find_object( workflow.nodes, { id: id } );
		var solder = this.wfPausedSolder;
		delete this.wfPausedSolder;
		
		solder.end_node = id;
		node.x = solder.x - (width / 2);
		node.y = solder.y - (height / 2);
		
		// adjust new node position based on end pole
		switch (solder.end_pole) {
			case 'wf_input_pole': node.x += (width / 2); break;
			case 'wf_output_pole': node.x -= (width / 2); break;
			case 'wf_down_pole': node.y -= (height / 2); break;
			case 'wf_up_pole': node.y += (height / 2); break;
		}
		
		// swap start/end nodes & poles if user started on a dest pole
		if (solder.start_pole.match(/^(wf_input_pole|wf_up_pole)$/)) {
			var temp = '';
			temp = solder.start_node; solder.start_node = solder.end_node; solder.end_node = temp;
			temp = solder.start_pole; solder.start_pole = solder.end_pole; solder.end_pole = temp;
		}
		
		// re-order source/dest based on how user started
		var conn = {
			id: gen_workflow_id('c'),
			source: solder.start_node,
			dest: solder.end_node
		};
		
		// detect event-to-event or event-to-action and add default condition prop
		var node = find_object( workflow.nodes, { id: solder.start_node } );
		if ((node.type.match(/^(event|job)$/)) && (solder.start_pole == 'wf_output_pole')) {
			conn.condition = 'success';
		}
		
		// add our new connection
		workflow.connections.push(conn);
	}
	
	completeSolder($elem, id) {
		// complete new connection
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		
		var solder = this.wfSoldering;
		solder.end_node = id;
		
		if (solder.start_node == solder.end_node) {
			// user completed on origin node, so just cancel solder
			return this.cancelSolder();
		}
		
		// swap start/end nodes & poles if user started on a dest pole
		if (solder.start_pole.match(/^(wf_input_pole|wf_up_pole)$/)) {
			var temp = '';
			temp = solder.start_node; solder.start_node = solder.end_node; solder.end_node = temp;
			temp = solder.start_pole; solder.start_pole = solder.end_pole; solder.end_pole = temp;
		}
		
		$cont.find('#d_wf_mouse_tracker').remove();
		$cont.off('.solder');
		$cont.removeClass('dragging');
		$cont.find('#d_wf_editor').css('cursor', '');
		
		delete this.wfSoldering;
		
		// re-order source/dest based on how user started
		var conn = {
			id: gen_workflow_id('c'),
			source: solder.start_node,
			dest: solder.end_node
		};
		
		// look for duplicate connections
		if (find_object(workflow.connections, { source: conn.source, dest: conn.dest })) {
			// app.showMessage('warning', "Connection already exists.", 8);
			this.drawWorkflow(true);
			this.afterDraw();
			return;
		}
		
		// detect event-to-event or event-to-action and add default condition prop
		var node = find_object( workflow.nodes, { id: solder.start_node } );
		if ((node.type.match(/^(event|job)$/)) && (solder.start_pole == 'wf_output_pole')) {
			conn.condition = 'success';
		}
		
		// add our new connection
		workflow.connections.push(conn);
		
		// redraw and add undo state
		this.drawWorkflow(true);
		this.afterDraw();
		this.addState();
	}
	
	doTestSelection() {
		// test current selection
		var self = this;
		var event = this.event;
		var title = "Test Workflow";
		var btn = ['open-in-new', 'Run Now'];
		var id = first_key(this.wfSelection);
		var node = find_object( this.workflow.nodes, { id: id } );
		
		// TODO: actions handled separately
		if (node.type == 'action') return this.doTestNode_action(node);
		
		app.clearError();
		var event = this.get_event_form_json();
		if (!event) return; // error
		
		var html = '<div class="dialog_box_content scroll maximize">';
		
		// test scope
		if (node.type.match(/^(event|job)$/)) {
			html += this.getFormRow({
				label: 'Test Scope:',
				content: this.getFormMenuSingle({
					id: 'fe_ete_scope',
					title: 'Select Test Scope',
					options: [
						{ id: 'single', title: "Single Node", icon: 'timer-play-outline' },
						{ id: 'entire', title: "Entire Workflow", icon: 'clipboard-play-outline' }
					],
					value: 'single'
				}),
				caption: 'Choose whether to test the selected node by itself, or the entire workflow from starting from the selected node.'
			});
		}
		
		// actions
		html += this.getFormRow({
			label: 'Actions:',
			content: this.getFormCheckbox({
				id: 'fe_ete_actions',
				label: 'Enable All Actions',
				checked: false
			}),
			caption: 'Enable all actions for the test run (includes both workflow and individual node actions).'
		});
		
		// limits
		html += this.getFormRow({
			label: 'Limits:',
			content: this.getFormCheckbox({
				id: 'fe_ete_limits',
				label: 'Enable All Limits',
				checked: false
			}),
			caption: 'Enable all resource limits for the test run (includes both workflow and individual node limits).'
		});
		
		// custom input json
		html += this.getFormRow({
			label: 'Custom JSON Input:',
			content: this.getFormTextarea({
				id: 'fe_ete_input',
				rows: 1,
				value: `{\n\t\n}`,
				style: 'display:none'
			}) + '<div class="button small secondary" onClick="$P().edit_test_input()"><i class="mdi mdi-text-box-edit-outline">&nbsp;</i>Edit JSON...</div>',
			caption: 'Optionally customize the JSON input data for the first job.  This is used to simulate data being passed to it from a previous job.'
		});
		
		// user files
		var limit = find_object( event.limits || [], { type: 'file', enabled: true } );
		html += this.getFormRow({
			label: 'File Input:',
			content: this.getDialogFileUploader(limit),
			caption: 'Optionally upload and attach files to the job as inputs.'
		});
		
		// user form fields
		html += this.getFormRow({
			label: 'Workflow Parameters:',
			content: '<div class="plugin_param_editor_cont">' + this.getParamEditor(event.fields, {}) + '</div>',
			caption: (event.fields && event.fields.length) ? 'Enter values for all the event-defined parameters here.' : ''
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			var job = deep_copy_object(event);
			job.enabled = true; // override event disabled, so test actually runs
			job.test = true;
			job.label = "Test";
			job.icon = "test-tube";
			job.workflow.start = node.id; // set starting node
			
			if (node.type.match(/^(event|job)$/)) {
				// event + job nodes have the scope menu
				var scope = $('#fe_ete_scope').val();
				if (scope == 'single') {
					// restrict test to just a single node
					job.workflow.nodes = [ node ];
					job.workflow.connections = [];
				}
			}
			
			if (!$('#fe_ete_actions').is(':checked')) {
				// disable both workflow actions and action nodes
				job.actions = [];
				find_objects( job.workflow.nodes, { type: 'action' } ).forEach( function(action) {
					action.enabled = false;
				} );
			}
			if (!$('#fe_ete_limits').is(':checked')) {
				// disable both workflow limits and limit nodes
				job.limits = [];
				find_objects( job.workflow.nodes, { type: 'limit' } ).forEach( function(limit) {
					limit.enabled = false;
				} );
			}
			
			// parse custom input json
			var raw_json = $('#fe_ete_input').val();
			if (raw_json) try {
				if (!job.input) job.input = {};
				job.input.data = JSON.parse( raw_json );
			}
			catch (err) {
				return app.badField( '#fe_ete_input', "Invalid JSON: " + err.message );
			}
			
			// add files if user uploaded
			if (self.dialogFiles && self.dialogFiles.length) {
				if (!job.input) job.input = {};
				job.input.files = self.dialogFiles;
				delete self.dialogFiles;
			}
			
			var params = self.getParamValues(self.event.fields);
			if (!params) return; // validation error
			
			if (!job.params) job.params = {};
			merge_hash_into( job.params, params );
			
			// pre-open new window/tab for job details
			var win = window.open('', '_blank');
			
			app.api.post( 'app/run_event', job, function(resp) {
				// Dialog.hideProgress();
				if (!self.active) return; // sanity
				
				// jump immediately to live details page in new window
				// Nav.go('Job?id=' + resp.id);
				win.location.href = '#Job?id=' + resp.id;
			}, 
			function(err) {
				// capture error so we can close the window we just opened
				win.close();
				app.doError("API Error: " + err.description);
			});
			
			Dialog.hide();
		}); // Dialog.confirm
		
		if (node.type.match(/^(event|job)$/)) {
			SingleSelect.init( $('#fe_ete_scope') );
		}
		
		Dialog.onHide = function() {
			// cleanup
			// FUTURE: If self.dialogFiles still exists here, delete in background (user canceled job)
			delete self.dialogFiles;
		};
		
		Dialog.autoResize();
	}
	
	doEditSelection() {
		// edit current selection
		var id = first_key(this.wfSelection);
		var node = find_object( this.workflow.nodes, { id: id } );
		var func = 'doEditNode_' + node.type;
		this[func](node);
	}
	
	doEditNode_event(node) {
		// edit event node
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		var do_create = !node;
		
		var sorted_events = this.getCategorizedEvents();
		if (!sorted_events.length) return app.doError(`Please create at least one event before adding a workflow event node.`);
		
		if (do_create) {
			node = { 
				id: gen_workflow_id('n'),
				type: 'event', 
				data: { event: sorted_events[0].id, params: {} } 
			};
		} // do_create
		
		var event = find_object( app.events, { id: node.data.event } );
		if (!event) return app.doError(`Event ID "${node.data.event}" could not be found.  Did someone delete it?`);
		var params = node.data.params;
		
		var title = do_create ? "New Event Node" : "Editing Event Node";
		var btn = do_create ? ['plus-circle', "Add Node"] : ['check-circle', "Apply"];
		
		if (!do_create) title += ` <div class="dialog_title_widget mobile_hide"><span class="monospace">${this.getNiceCopyableID(node.id)}</span></div>`;
		
		var html = '<div class="dialog_box_content scroll maximize">';
		
		// event
		html += this.getFormRow({
			label: 'Event:',
			content: this.getFormMenuSingle({
				id: 'fe_wfd_event',
				title: 'Select Event',
				options: sorted_events,
				value: node.data.event || '',
				default_icon: 'calendar-clock',
				'data-shrinkwrap': 1
			}),
			caption: 'Select the event to use for the workflow node.'
		});
		
		// targets
		html += this.getFormRow({
			label: 'Targets:',
			content: this.getFormMenuMulti({
				id: 'fe_wfd_targets',
				title: 'Select targets for the event',
				placeholder: '(Use event defaults)',
				options: [].concat(
					this.buildOptGroup(app.groups, "Groups:", 'server-network'),
					this.buildServerOptGroup("Servers:", 'router-network')
				),
				values: node.data.targets || [],
				auto_add: true,
				// 'data-hold': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally override the targets for running the event.'
		});
		
		// algo
		html += this.getFormRow({
			label: 'Algorithm:',
			content: this.getFormMenuSingle({
				id: 'fe_wfd_algo',
				title: 'Select algorithm for targets',
				options: [{ id: '', title: '(Use event default)' }].concat(config.ui.event_target_algo_menu).concat(
					this.buildOptGroup( app.monitors, "Least Monitor Value:", 'chart-line', 'monitor:' )
				),
				value: node.data.algo || '',
				// default_icon: 'arrow-decision',
				'data-nudgeheight': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally override the target selection algorithm for the event.'
		});
		
		// params
		html += this.getFormRow({
			label: 'User Parameters:',
			content: '<div id="d_wfd_param_editor" class="plugin_param_editor_cont"></div>',
			caption: 'Enter values for all the event-defined parameters here.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			node.data.event = $('#fe_wfd_event').val();
			node.data.targets = $('#fe_wfd_targets').val();
			node.data.algo = $('#fe_wfd_algo').val();
			
			var event = find_object( app.events, { id: node.data.event } );
			node.data.params = self.getParamValues(event.fields);
			if (!node.data.params) return; // invalid
			
			Dialog.hide();
			
			if (do_create) {
				// add new node
				workflow.nodes.push(node);
				
				// estimate size (dynamic height)
				var node_width = 275;
				var node_height = 140 + (event.fields ? (event.fields.length * 40) : 0);
				
				// compute x/y for new node
				if (self.wfPausedSolder) {
					// resume paused solder
					self.resumePausedSolder(node.id, node_width, node_height);
				}
				else {
					// center node in viewport
					var $editor = $cont.find('#d_wf_editor');
					node.x = (self.wfScroll.x + ($editor.width() / 2)) - (node_width / 2);
					node.y = (self.wfScroll.y + ($editor.height() / 2)) - (node_height / 2);
				}
				
				// select new node
				self.wfSelection = {};
				self.wfSelection[node.id] = 2;
			} // do_create
			
			self.drawWorkflow(true);
			self.afterDraw();
			self.addState();
		}); // Dialog.confirm
		
		MultiSelect.init( $('#fe_wfd_targets') );
		SingleSelect.init( $('#fe_wfd_event, #fe_wfd_algo') );
		
		// handle event change
		var do_change_event = function() {
			// refresh param editor
			var event_id = $('#fe_wfd_event').val();
			var event = find_object( app.events, { id: event_id } );
			$('#d_wfd_param_editor').html( self.getParamEditor( event.fields, params ) );
			Dialog.autoResize();
		}
		
		$('#fe_wfd_event').on('change', do_change_event);
		do_change_event();
	}
	
	doEditNode_job(node) {
		// edit job node
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		var do_create = !node;
		
		if (do_create) {
			node = { 
				id: gen_workflow_id('n'),
				type: 'job', 
				data: { params: {}, targets: [], algo: 'random', label: '' } 
			};
			
			if (find_object(app.categories, { id: 'general' })) node.data.category = 'general';
			else if (!app.categories.length) return app.doError("You must define at least one category to add workflow plugin nodes.");
			else node.data.category = app.categories[0].id;
			
			if (find_object(app.plugins, { id: 'shellplug' })) node.data.plugin = 'shellplug';
			else if (!app.plugins.length) return app.doError("You must create at least one Plugin to add workflow plugin nodes.");
			else node.data.plugin = app.plugins[0].id;
		} // do_create
		
		var plugin = find_object( app.plugins, { id: node.data.plugin } );
		if (!plugin) return app.doError(`Plugin ID "${node.data.plugin}" could not be found.  Did someone delete it?`);
		var params = node.data.params;
		
		var title = do_create ? "New Plugin Node" : "Editing Plugin Node";
		var btn = do_create ? ['plus-circle', "Add Node"] : ['check-circle', "Apply"];
		
		if (!do_create) title += ` <div class="dialog_title_widget mobile_hide"><span class="monospace">${this.getNiceCopyableID(node.id)}</span></div>`;
		
		var html = '<div class="dialog_box_content scroll maximize">';
		
		// plugin
		html += this.getFormRow({
			label: 'Plugin:',
			content: this.getFormMenuSingle({
				id: 'fe_wfd_plugin',
				title: 'Select Plugin for node',
				placeholder: 'Select Plugin for node...',
				options: app.plugins.filter( function(plugin) { return plugin.type == 'event'; } ),
				value: node.data.plugin || '',
				default_icon: 'power-plug-outline'
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select the desired Plugin for the node.  Plugin parameters will appear below.'
		});
		
		// title
		html += this.getFormRow({
			label: 'Custom Title:',
			content: this.getFormText({
				id: 'fe_wfd_title',
				spellcheck: 'false',
				value: node.data.label
			}),
			caption: 'Optionally customize the title for the node (defaults to the Plugin name).'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_wfd_icon',
				title: 'Select icon for job',
				placeholder: 'Select icon for job...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: node.data.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose a custom icon for the plugin node (defaults to the Plugin icon).'
		});
		
		// category
		html += this.getFormRow({
			label: 'Category:',
			content: this.getFormMenuSingle({
				id: 'fe_wfd_cat',
				title: 'Select category for job',
				placeholder: 'Select category for job...',
				options: app.categories,
				value: node.data.category || '',
				default_icon: 'folder-open-outline',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select a category for the plugin job (category limits and actions will apply)'
		});
		
		// targets
		html += this.getFormRow({
			label: 'Targets:',
			content: this.getFormMenuMulti({
				id: 'fe_wfd_targets',
				title: 'Select targets for job',
				placeholder: 'Select targets for job...',
				options: [].concat(
					this.buildOptGroup(app.groups, "Groups:", 'server-network'),
					this.buildServerOptGroup("Servers:", 'router-network')
				),
				values: node.data.targets,
				auto_add: true,
				// 'data-hold': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select groups and/or servers to run the plugin job.'
		});
		
		// algo
		html += this.getFormRow({
			label: 'Algorithm:',
			content: this.getFormMenuSingle({
				id: 'fe_wfd_algo',
				title: 'Select algorithm for targets',
				placeholder: 'Select algorithm for targets...',
				options: config.ui.event_target_algo_menu.concat(
					this.buildOptGroup( app.monitors, "Least Monitor Value:", 'chart-line', 'monitor:' )
				),
				value: node.data.algo || '',
				default_icon: 'arrow-decision',
				'data-nudgeheight': 1
				// 'data-shrinkwrap': 1
			}),
			caption: 'Select the desired algorithm for choosing a server from the target list.'
		});
		
		// params
		html += this.getFormRow({
			label: 'Plugin Parameters:',
			content: '<div id="d_wfd_param_editor" class="plugin_param_editor_cont"></div>',
			caption: 'Enter values for all the Plugin-defined parameters here.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			node.data.label = strip_html( $('#fe_wfd_title').val() );
			node.data.icon = $('#fe_wfd_icon').val();
			node.data.category = $('#fe_wfd_cat').val();
			node.data.plugin = $('#fe_wfd_plugin').val();
			node.data.targets = $('#fe_wfd_targets').val();
			node.data.algo = $('#fe_wfd_algo').val();
			
			if (!node.data.targets.length) return app.badField('#fe_wfd_targets', "You must select at least one target for the plugin job.");
			
			node.data.params = self.getPluginParamValues( node.data.plugin );
			if (!node.data.params) return; // invalid
			
			Dialog.hide();
			
			if (do_create) {
				// add new node
				workflow.nodes.push(node);
				
				// estimate size (dynamic height)
				var plugin = find_object( app.plugins, { id: node.data.plugin } );
				var node_width = 275;
				var node_height = 180 + (plugin.params ? (plugin.params.length * 40) : 0);
				
				// compute x/y for new node
				if (self.wfPausedSolder) {
					// resume paused solder
					self.resumePausedSolder(node.id, node_width, node_height);
				}
				else {
					// center new node in viewport
					var $editor = $cont.find('#d_wf_editor');
					node.x = (self.wfScroll.x + ($editor.width() / 2)) - (node_width / 2);
					node.y = (self.wfScroll.y + ($editor.height() / 2)) - (node_height / 2);
				}
				
				// select new node
				self.wfSelection = {};
				self.wfSelection[node.id] = 2;
			} // do_create
			
			self.drawWorkflow(true);
			self.afterDraw();
			self.addState();
		}); // Dialog.confirm
		
		MultiSelect.init( $('#fe_wfd_targets') );
		SingleSelect.init( $('#fe_wfd_icon, #fe_wfd_cat, #fe_wfd_plugin, #fe_wfd_algo') );
		
		// handle plugin change
		var do_change_plugin = function() {
			// refresh plugin param editor
			var plugin_id = $('#fe_wfd_plugin').val();
			var plugin = find_object( app.plugins, { id: plugin_id } );
			$('#d_wfd_param_editor').html( self.getPluginParamEditor( plugin_id, node.data.params ) );
			Dialog.autoResize();
		}
		
		$('#fe_wfd_plugin').on('change', do_change_plugin);
		do_change_plugin();
		
		// if (do_create) $('#fe_wfd_title').focus();
	}
	
	doEditNode_action(node) {
		// show dialog to add/edit job action
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		var do_create = !node;
		
		if (do_create) {
			node = { 
				id: gen_workflow_id('n'),
				type: 'action', 
				data: { type: 'email', email: '', enabled: true } 
			};
		} // do_create
		
		var title = do_create ? "New Action Node" : "Editing Action Node";
		var btn = do_create ? ['plus-circle', "Add Action"] : ['check-circle', "Apply"];
		var action = node.data;
		
		if (!do_create) title += ` <div class="dialog_title_widget mobile_hide"><span class="monospace">${this.getNiceCopyableID(node.id)}</span></div>`;
		
		this.showEditJobActionDialog({
			action: action,
			title: title,
			btn: btn,
			show_condition: false,
			
			action_type_filter: function(item) { 
				return !item.id.match(/^(disable|delete)$/); 
			},
			
			callback: function(action) {
				node.data = action;
				
				if (do_create) {
					// add new node
					workflow.nodes.push(node);
					
					var node_width = 64;
					var node_height = 64;
					
					// compute x/y for new node
					if (self.wfPausedSolder) {
						// resume paused solder
						self.resumePausedSolder(node.id, node_width, node_height);
					}
					else {
						// center node in viewport
						var $editor = $cont.find('#d_wf_editor');
						node.x = (self.wfScroll.x + ($editor.width() / 2)) - (node_width / 2);
						node.y = (self.wfScroll.y + ($editor.height() / 2)) - (node_height / 2);
					}
					
					// select new node
					self.wfSelection = {};
					self.wfSelection[node.id] = 2;
				} // do_create
				
				self.drawWorkflow(true);
				self.afterDraw();
				self.addState();
			} // callback
		}); // showEditJobActionDialog
	}
	
	doEditNode_limit(node) {
		// show dialog to add/edit limit
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		var do_create = !node;
		
		if (do_create) {
			node = { 
				id: gen_workflow_id('n'),
				type: 'limit', 
				data: { type: 'time', enabled: true } 
			};
		} // do_create
		
		var title = do_create ? "New Limiter Node" : "Editing Limiter Node";
		var btn = do_create ? ['plus-circle', "Add Limiter"] : ['check-circle', "Apply"];
		var limit = node.data;
		
		if (!do_create) title += ` <div class="dialog_title_widget mobile_hide"><span class="monospace">${this.getNiceCopyableID(node.id)}</span></div>`;
		
		this.showEditResLimitDialog({
			limit: limit,
			title: title,
			btn: btn,
			
			callback: function(action) {
				node.data = action;
				
				if (do_create) {
					// add new node
					workflow.nodes.push(node);
					
					var node_width = 64;
					var node_height = 64;
					
					// compute x/y for new node
					if (self.wfPausedSolder) {
						// resume paused solder
						self.resumePausedSolder(node.id, node_width, node_height);
					}
					else {
						// center node in viewport
						var $editor = $cont.find('#d_wf_editor');
						node.x = (self.wfScroll.x + ($editor.width() / 2)) - (node_width / 2);
						node.y = (self.wfScroll.y + ($editor.height() / 2)) - (node_height / 2);
					}
					
					// select new node
					self.wfSelection = {};
					self.wfSelection[node.id] = 2;
				} // do_create
				
				self.drawWorkflow(true);
				self.afterDraw();
				self.addState();
			} // callback
		}); // showEditResLimitDialog
	}
	
	doEditNode_trigger(node) {
		// show dialog to add/edit trigger (trigger)
		var idx = node ? find_object_idx( this.event.triggers, { id: node.id } ) : -1;
		this.editTrigger(idx);
	}
	
	onAfterEditTrigger(idx, trigger) {
		// called by editTrigger dialog after change made
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		var do_create = (idx == -1);
		var do_delete = !!trigger.deleted;
		var node = null;
		
		if (do_create) {
			// create new node and associate with trigger element
			node = { 
				id: gen_workflow_id('n'),
				type: 'trigger'
			};
			trigger.id = node.id;
			
			// add new node
			workflow.nodes.push(node);
			
			var node_width = 64;
			var node_height = 64;
			
			// compute x/y for new node
			if (this.wfPausedSolder) {
				// resume paused solder
				if (trigger.type.match(/^(catchup|range|blackout|delay|precision)$/)) {
					// special trigger type has no solder poles, so abort the solder, but place the node in the correct location
					var solder = this.wfPausedSolder;
					delete this.wfPausedSolder;
					node.x = solder.x - (width / 2);
					node.y = solder.y - (height / 2);
				}
				else {
					this.resumePausedSolder(node.id, node_width, node_height);
				}
			}
			else {
				// center node in viewport
				var $editor = $cont.find('#d_wf_editor');
				node.x = (this.wfScroll.x + ($editor.width() / 2)) - (node_width / 2);
				node.y = (this.wfScroll.y + ($editor.height() / 2)) - (node_height / 2);
			}
			
			// select new node
			this.wfSelection = {};
			this.wfSelection[node.id] = 2;
		} // do_create
		
		else if (do_delete) {
			// trigger was deleted, so also delete node (and connections!)
			node = find_object( this.workflow.nodes, { id: trigger.id } );
			if (!node) return; // sanity
			
			// set selection then delete it
			this.wfSelection = {};
			this.wfSelection[node.id] = 1;
			this.doDeleteSelection();
			
			return; // prevent dupe redraw
		} // do_delete
		
		this.drawWorkflow(true);
		this.afterDraw();
		this.addState();
	}
	
	doEditNode_controller(node) {
		// edit controller node
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		var do_create = !node;
		
		if (do_create) {
			node = { 
				id: gen_workflow_id('n'),
				type: 'controller', 
				data: { controller: 'multiplex', stagger: 0, continue: 100 } 
			};
		} // do_create
		
		var title = do_create ? "New Controller" : "Editing Controller";
		var btn = do_create ? ['plus-circle', "Add Controller"] : ['check-circle', "Apply"];
		
		if (!do_create) title += ` <div class="dialog_title_widget mobile_hide"><span class="monospace">${this.getNiceCopyableID(node.id)}</span></div>`;
		
		var html = '<div class="dialog_box_content scroll maximize">';
		
		// type
		html += this.getFormRow({
			label: 'Controller Type:',
			content: this.getFormMenuSingle({
				id: 'fe_wfd_type',
				title: "Select Controller Type",
				options: config.ui.workflow_controller_type_menu,
				value: node.data.controller,
				'data-shrinkwrap': 1,
				// 'data-nudgeheight': 1
			}),
			caption: 'Select the desired type for the controller.'
		});
		
		// description
		html += this.getFormRow({
			id: 'd_wfd_desc',
			label: 'Description:',
			content: 'HERE'
		});
		
		// dynamic fields based on type:
		
		// multiplex stagger
		html += this.getFormRow({
			id: 'd_wfd_stagger',
			label: 'Stagger Delay:',
			content: this.getFormRelativeTime({
				id: 'fe_wfd_stagger',
				value: node.data.stagger || 0
			}),
			caption: 'Optionally enter a duration to stagger the start of each multiplexed job.'
		});
		
		// wait time
		html += this.getFormRow({
			id: 'd_wfd_wait',
			label: 'Wait Delay:',
			content: this.getFormRelativeTime({
				id: 'fe_wfd_wait',
				value: node.data.wait || 0
			}),
			caption: 'Enter a duration to wait before control passes to the connected nodes.'
		});
		
		// repeat iterations
		html += this.getFormRow({
			id: 'd_wfd_repeat',
			label: 'Repeat Iterations:',
			content: this.getFormText({
				id: 'fe_wfd_repeat',
				type: 'number',
				spellcheck: 'false',
				maxlength: 32,
				min: 1,
				value: node.data.repeat || 1
			}),
			caption: 'Enter the number of iterations to repeat before continuing on.'
		});
		
		// split path
		html += this.getFormRow({
			id: 'd_wfd_split',
			label: 'Split Path:',
			content: this.getFormText({
				id: 'fe_wfd_split',
				type: 'text',
				spellcheck: 'false',
				maxlength: 8192,
				class: 'monospace',
				value: node.data.split || ''
			}),
			caption: 'Specify the path to the array for splitting, using dot.path.notation.'
		});
		
		// if expression
		html += this.getFormRow({
			id: 'd_wfd_if',
			label: 'Expression:',
			content: this.getFormText({
				id: 'fe_wfd_if',
				type: 'text',
				spellcheck: 'false',
				maxlength: 8192,
				class: 'monospace',
				value: node.data.decision || ''
			}),
			caption: 'Enter the expression to evaluate.  If true, control will pass onto the next node.'
		});
		
		// custom title
		html += this.getFormRow({
			id: 'd_wfd_title',
			label: 'Custom Title:',
			content: this.getFormText({
				id: 'fe_wfd_title',
				spellcheck: 'false',
				value: node.data.label || ''
			}),
			caption: 'Optionally enter a custom title for the node.'
		});
		
		// custom icon
		html += this.getFormRow({
			id: 'd_wfd_icon',
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_wfd_icon',
				title: 'Select icon for node',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: node.data.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose a custom icon for the node.'
		});
		
		// continue percentage
		html += this.getFormRow({
			id: 'd_wfd_continue',
			label: 'Continue Percentage:',
			content: this.getFormText({
				id: 'fe_wfd_continue',
				type: 'number',
				spellcheck: 'false',
				maxlength: 3,
				min: 0,
				value: node.data.continue || 0
			}),
			caption: 'Enter the percentage of jobs that must complete successfully before continuing on to the next node.'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			node.data.controller = $('#fe_wfd_type').val();
			['stagger', 'repeat', 'split', 'decision', 'label', 'icon', 'continue'].forEach( function(key) { delete node.data[key]; } );
			
			switch (node.data.controller) {
				case 'multiplex':
					node.data.stagger = parseInt( $('#fe_wfd_stagger').val() ) || 0;
					node.data.continue = parseInt( $('#fe_wfd_continue').val() ) || 0;
				break;
				
				case 'wait':
					node.data.wait = parseInt( $('#fe_wfd_wait').val() ) || 0;
				break;
				
				case 'repeat':
					node.data.repeat = parseInt( $('#fe_wfd_repeat').val() ) || 0;
					node.data.continue = parseInt( $('#fe_wfd_continue').val() ) || 0;
				break;
				
				case 'split':
					node.data.split = $('#fe_wfd_split').val().trim();
					if (!node.data.split.length) return app.badField('#fe_wfd_split', "Please enter a path to the array data to split on.");
					node.data.continue = parseInt( $('#fe_wfd_continue').val() ) || 0;
				break;
				
				case 'join':
					// no options
				break;
				
				case 'decision':
					node.data.label = strip_html( $('#fe_wfd_title').val() );
					node.data.icon = $('#fe_wfd_icon').val();
					node.data.decision = $('#fe_wfd_if').val().trim();
					if (!node.data.decision.length) return app.badField('#fe_wfd_if', "Please enter an expression to evaluate.");
				break;
			} // switch type
			
			Dialog.hide();
			
			if (do_create) {
				// add new node
				workflow.nodes.push(node);
				
				// estimate size
				var node_width = 128;
				var node_height = 64;
				
				// compute x/y for new node
				if (self.wfPausedSolder) {
					// resume paused solder
					self.resumePausedSolder(node.id, node_width, node_height);
				}
				else {
					// center new node in viewport
					var $editor = $cont.find('#d_wf_editor');
					node.x = (self.wfScroll.x + ($editor.width() / 2)) - (node_width / 2);
					node.y = (self.wfScroll.y + ($editor.height() / 2)) - (node_height / 2);
				}
				
				// select new node
				self.wfSelection = {};
				self.wfSelection[node.id] = 2;
			} // do_create
			
			self.drawWorkflow(true);
			self.afterDraw();
			self.addState();
		}); // Dialog.confirm
		
		// MultiSelect.init( $('#fe_wfd_targets') );
		SingleSelect.init( $('#fe_wfd_type, #fe_wfd_icon') );
		RelativeTime.init( $('#fe_wfd_stagger, #fe_wfd_wait') );
		
		// handle type change
		var do_change_type = function() {
			// show/hide sections based on type
			$('#d_wfd_stagger, #d_wfd_wait, #d_wfd_repeat, #d_wfd_split, #d_wfd_if, #d_wfd_title, #d_wfd_icon, #d_wfd_continue').hide();
			
			var type = $('#fe_wfd_type').val();
			switch (type) {
				case 'multiplex': $('#d_wfd_stagger, #d_wfd_continue').show(); break;
				case 'wait': $('#d_wfd_wait').show(); break;
				case 'repeat': $('#d_wfd_repeat, #d_wfd_continue').show(); break;
				case 'split': $('#d_wfd_split, #d_wfd_continue').show(); break;
				case 'decision': $('#d_wfd_if, #d_wfd_title, #d_wfd_icon').show(); break;
			}
			
			$('#d_wfd_desc .fr_content').html( inline_marked(config.ui.workflow_controller_descriptions[type]) );
			Dialog.autoResize();
		}
		
		$('#fe_wfd_type').on('change', do_change_type);
		do_change_type();
	}
	
	doDuplicateSelection() {
		// duplicate current selection, and offset by +40px x/y
		// make sure new elements are selected
		var self = this;
		var workflow = this.workflow;
		var selection = this.wfSelection;
		var id_map = {};
		
		Object.keys(selection).forEach( function(id) {
			var old_node = find_object( workflow.nodes, { id: id } );
			var new_node = deep_copy_object(old_node);
			new_node.id = gen_workflow_id('n');
			new_node.x += 40;
			new_node.y += 40;
			id_map[old_node.id] = new_node.id;
			workflow.nodes.push(new_node);
			
			// if we duped a trigger node, update the trigger table accordingly
			if (new_node.type == 'trigger') {
				var old_trigger = find_object( self.event.triggers, { id: old_node.id } );
				var new_trigger = deep_copy_object(old_trigger);
				new_trigger.id = new_node.id;
				self.event.triggers.push(new_trigger);
			}
		} );
		
		workflow.connections.forEach( function(conn) {
			// only dupe connections when both source and dest nodes are being duped
			if (!selection[conn.source] || !selection[conn.dest]) return;
			var new_conn = deep_copy_object(conn);
			new_conn.id = gen_workflow_id('c');
			new_conn.source = id_map[new_conn.source];
			new_conn.dest = id_map[new_conn.dest];
			workflow.connections.push(new_conn);
		} );
		
		// set new selection (will get updated as part of afterDraw)
		this.wfSelection = {};
		for (var id in id_map) {
			this.wfSelection[ id_map[id] ] = 2;
		}
		
		this.drawWorkflow(true);
		this.afterDraw();
		this.addState();
	}
	
	doDetachSelection() {
		// disconnect all wires touching selection
		var self = this;
		var workflow = this.workflow;
		var selection = this.wfSelection;
		var new_conns = [];
		
		workflow.connections.forEach( function(conn) {
			if (!selection[conn.source] && !selection[conn.dest]) new_conns.push(conn);
		});
		
		workflow.connections = new_conns;
		
		this.drawWorkflow(true);
		this.afterDraw();
		this.addState();
	}
	
	doDeleteSelection() {
		// delete all selected nodes
		// also remove all related connections
		var self = this;
		var workflow = this.workflow;
		var selection = this.wfSelection;
		var $cont = this.wfGetContainer();
		var new_nodes = [];
		var new_conns = [];
		
		workflow.nodes.forEach( function(node) {
			var $elem = $cont.find('#d_wfn_' + node.id);
			
			if (selection[node.id]) {
				$elem.remove(); // delete
				
				// if node is a trigger, also delete the associated trigger entry
				if (node.type == 'trigger') {
					var idx = find_object_idx( self.event.triggers, { id: node.id } );
					if (idx > -1) self.event.triggers.splice( idx, 1 ); // note: may already be deleted
				}
			}
			else new_nodes.push(node); // keep
		});
		
		workflow.connections.forEach( function(conn) {
			if (!selection[conn.source] && !selection[conn.dest]) new_conns.push(conn);
		});
		
		workflow.nodes = new_nodes;
		workflow.connections = new_conns;
		
		// clear selection
		this.wfSelection = {};
		
		// redraw and add state
		this.drawWorkflow(true);
		this.afterDraw();
		this.addState();
	}
	
	updateState() {
		// perform a "soft" update of the current zoom and scroll settings in the latest undo state
		// this is so if the user makes an actual change and reverts it, the scroll and zoom won't also revert
		if ((this.wfSnapIdx == -1) || !this.wfSnapshots[this.wfSnapIdx]) return; // sanity
		var snapshot = this.wfSnapshots[this.wfSnapIdx];
		
		snapshot.scroll = deep_copy_object(this.wfScroll);
		snapshot.zoom = this.wfZoom;
		snapshot.selection = deep_copy_object(this.wfSelection);
	}
	
	addState() {
		// add copy of current state to undo buffer
		var $cont = this.wfGetContainer();
		
		// if we are currently in a historical state, we need to fork the history just after the current point
		if ((this.wfSnapIdx > -1) && (this.wfSnapIdx < this.wfSnapshots.length - 1)) {
			this.wfSnapshots.splice( this.wfSnapIdx + 1 );
		}
		
		this.wfSnapshots.push({
			workflow: deep_copy_object(this.workflow),
			scroll: deep_copy_object(this.wfScroll),
			zoom: this.wfZoom,
			selection: deep_copy_object(this.wfSelection),
			triggers: deep_copy_object(this.event.triggers)
		});
		
		if (this.wfSnapshots.length > 100) this.wfSnapshots.shift();
		this.wfSnapIdx = this.wfSnapshots.length - 1;
		
		// update undo/redo button classes
		$cont.find('#d_btn_wf_undo').toggleClass('disabled', (this.wfSnapIdx <= 0));
		$cont.find('#d_btn_wf_redo').toggleClass('disabled', (this.wfSnapIdx >= this.wfSnapshots.length - 1));
	}
	
	setCurrentState() {
		// set the current state index, and update the workflow to match
		var $cont = this.wfGetContainer();
		var snapshot = deep_copy_object( this.wfSnapshots[this.wfSnapIdx] );
		
		this.event.workflow = this.workflow = snapshot.workflow;
		this.wfScroll = snapshot.scroll;
		this.wfZoom = snapshot.zoom;
		this.wfSelection = snapshot.selection;
		this.event.triggers = snapshot.triggers;
		
		this.drawWorkflow(true);
		this.afterDraw();
		
		// update undo/redo button classes
		$cont.find('#d_btn_wf_undo').toggleClass('disabled', (this.wfSnapIdx <= 0));
		$cont.find('#d_btn_wf_redo').toggleClass('disabled', (this.wfSnapIdx >= this.wfSnapshots.length - 1));
	}
	
	doUndo() {
		// revert to previous state
		if (this.wfSnapIdx > 0) {
			this.wfSnapIdx--;
			this.setCurrentState();
		}
	}
	
	doRedo() {
		// redo to next state
		if (this.wfSnapIdx < this.wfSnapshots.length - 1) {
			this.wfSnapIdx++;
			this.setCurrentState();
		}
	}
	
	get_wf_form_html() {
		// get html for editing a workflow (or creating a new one)
		var html = '';
		var event = this.event;
		
		if (event.id) {
			// event id
			html += this.getFormRow({
				label: 'Workflow ID:',
				content: this.getFormText({
					id: 'fe_ee_id',
					class: 'monospace',
					spellcheck: 'false',
					disabled: 'disabled',
					value: event.id
				}),
				suffix: '<div class="form_suffix_icon mdi mdi-clipboard-text-outline" title="Copy ID to Clipboard" onClick="$P().copyFormID(this)"></div>',
				caption: 'This is a unique ID for the workflow, used by the API.  It cannot be changed.'
			});
		}
		
		// title
		html += this.getFormRow({
			label: 'Workflow Title:',
			content: this.getFormText({
				id: 'fe_ee_title',
				spellcheck: 'false',
				value: event.title
			}),
			caption: 'Enter the title of the workflow, for display purposes.'
		});
		
		// enabled
		html += this.getFormRow({
			label: 'Status:',
			content: this.getFormCheckbox({
				id: 'fe_ee_enabled',
				label: 'Workflow Enabled',
				checked: event.enabled
			}),
			caption: 'Only enabled workflows can execute, including scheduled and manual runs.'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Custom Icon:',
			content: this.getFormMenuSingle({
				id: 'fe_ee_icon',
				title: 'Select icon for workflow',
				placeholder: 'Select icon for workflow...',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: event.icon || '',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Optionally choose a custom icon for the workflow.'
		});
		
		// category
		html += this.getFormRow({
			label: 'Category:',
			content: this.getFormMenuSingle({
				id: 'fe_ee_cat',
				title: 'Select category for workflow',
				placeholder: 'Select category for workflow...',
				options: app.categories,
				value: event.category || '',
				default_icon: 'folder-open-outline',
				// 'data-shrinkwrap': 1
			}),
			suffix: '<div class="form_suffix_icon mdi mdi-folder-plus-outline" title="Quick Add Category..." onClick="$P().quickAddCategory()" onMouseDown="event.preventDefault();"></div>',
			caption: 'Select a category for the workflow (this may limit the max concurrent jobs, etc.)'
		});
		
		// tags
		html += this.getFormRow({
			label: 'Tags:',
			content: this.getFormMenuMulti({
				id: 'fe_ee_tags',
				title: 'Select tags for workflow',
				placeholder: 'Select tags for workflow...',
				options: app.tags,
				values: event.tags,
				default_icon: 'tag-outline',
				// 'data-shrinkwrap': 1
			}),
			suffix: '<div class="form_suffix_icon mdi mdi-tag-plus-outline" title="Quick Add Tag..." onClick="$P().quickAddTag()" onMouseDown="event.preventDefault();"></div>',
			caption: 'Optionally select one or more tags for the workflow.  Jobs can also add their own tags at run time.'
		});
		
		// user fields
		html += this.getFormRow({
			label: 'User Fields:',
			content: '<div id="d_params_table"></div>',
			caption: 'Optionally define custom parameters to be collected when a user runs your workflow manually.'
		});
		
		// resource limits
		// (requires this.limits to be populated)
		html += this.getFormRow({
			label: 'Resource Limits:',
			content: '<div id="d_ee_reslim_table">' + this.getResLimitTable() + '</div>',
			caption: 'Optionally select resource limits to assign to jobs.  These will override limits set at the category level.'
		});
		
		// actions
		// (requires this.actions to be populated)
		html += this.getFormRow({
			label: 'Job Actions:',
			content: '<div id="d_ee_jobact_table">' + this.getJobActionTable() + '</div>',
			caption: 'Optionally select custom actions to perform for each job.  Actions may also be added at the category level.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_ee_notes',
				rows: 5,
				value: event.notes
			}),
			caption: 'Optionally enter notes for the event, which will be included in all email notifications.'
		});
		
		return html;
	}
	
	get_wf_editor_html(btns) {
		// get html for workflow editor
		var html = '';
		
		// workflow editor
		html += '<div class="box">';
		html += '<div class="box_content">';
		html += '<div class="wf_container" id="d_wf_container" style="height:85vh">';
		
		// 
		// <div class="button right"><i class="mdi mdi-clipboard-edit-outline">&nbsp;</i>Edit Info...</div>
		
		html += `<div class="wf_grid_header">
			<div class="wf_title left" style="display:none"><i class="mdi mdi-clipboard-flow-outline">&nbsp;</i>Workflow Editor</div>
			<div class="button secondary left mobile_collapse" id="d_btn_wf_edit" onClick="$P().doEditSelection()" style="display:none" title="Edit selected node"><i class="mdi mdi-note-edit-outline">&nbsp;</i><span>Edit...</span></div>
			<div class="button secondary left mobile_collapse" id="d_btn_wf_test" onClick="$P().doTestSelection()" style="display:none" title="Test selected node"><i class="mdi mdi-test-tube">&nbsp;</i><span>Test...</span></div>
			<div class="button icon left mobile_collapse" id="d_btn_wf_dup" onClick="$P().doDuplicateSelection()" style="display:none" title="Duplicate selection"><i class="mdi mdi-content-duplicate">&nbsp;</i><span>Duplicate</span></div>
			<div class="button danger left mobile_collapse" id="d_btn_wf_dis" onClick="$P().doDetachSelection()" style="display:none" title="Detach selection"><i class="mdi mdi-soldering-iron">&nbsp;</i><span>Detach</span></div>
			<div class="button danger left mobile_collapse" id="d_btn_wf_del" onClick="$P().doDeleteSelection()" style="display:none" title="Delete selection"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete</span></div>
			<div class="wf_sel_msg left tablet_hide"></div>
			
			<div class="button default right mobile_collapse" id="d_btn_wf_new" onClick="$P().doAddNode()"><i class="mdi mdi-plus-circle">&nbsp;</i>Add Node...</div>
			<div class="clear"></div>
		</div>`;
		
		html += `<div class="wf_grid_footer">
			<div class="button icon left disabled" id="d_btn_wf_undo" onClick="$P().doUndo()" title="Undo"><i class="mdi mdi-undo"></i></div>
			<div class="button icon left disabled" id="d_btn_wf_redo" onClick="$P().doRedo()" title="Redo"><i class="mdi mdi-redo"></i></div>
			<div class="wf_button_separator left"></div>
			<div class="button icon left" onClick="$P().wfZoomAuto()" title="Auto-fit workflow"><i class="mdi mdi-home"></i></div>
			<div class="button icon left" id="d_btn_wf_zoom_out" onClick="$P().wfZoomOut()" title="Zoom out"><i class="mdi mdi-magnify-minus"></i></div>
			<div class="button icon left" id="d_btn_wf_zoom_in" onClick="$P().wfZoomIn()" title="Zoom in"><i class="mdi mdi-magnify-plus"></i></div>
			<div class="wf_zoom_msg left tablet_hide"></div>
			<div class="wf_button_separator left"></div>
			
			${btns}
			
			<div class="clear"></div>
		</div>`;
		
		html += '</div>'; // wf_container
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		return html;
	}
	
	get_event_form_json(force) {
		// get api key elements from form, used for new or edit
		var event = this.event;
		event.type = 'workflow'; // always workflow for these
		
		event.title = $('#fe_ee_title').val().trim();
		event.enabled = $('#fe_ee_enabled').is(':checked') ? true : false;
		event.icon = $('#fe_ee_icon').val();
		event.category = $('#fe_ee_cat').val();
		event.tags = $('#fe_ee_tags').val();
		event.notes = $('#fe_ee_notes').val();
		
		if (!force) {
			if (!event.title.length) {
				return app.badField('#fe_ee_title', "Please enter a title for the workflow.");
			}
		}
		
		return event;
	}
	
	onResize() {
		// called when page is resized
		if (!this.wfEdit) return; // sanity
		this.renderWFConnections();
	}
	
	onDeactivate() {
		// called when page is deactivated
		if ((this.args.sub == 'new') || (this.args.sub == 'edit')) {
			this.checkSavePageDraft( this.get_event_form_json(true) );
		}
		
		delete this.event;
		delete this.workflow;
		delete this.wfScroll;
		delete this.wfZoom;
		delete this.wfEdit;
		delete this.wfSelection;
		delete this.wfSnapshots;
		delete this.wfSnapIdx;
		delete this.wfDragging;
		delete this.wfSoldering;
		delete this.wfPausedSolder;
		
		this.div.html('');
		return true;
	}
	
};
