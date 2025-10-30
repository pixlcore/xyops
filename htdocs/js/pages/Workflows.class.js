// Scheduler -- Workflow Config

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
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
		app.highlightTab( 'Workflows' );
		
		this.loading();
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_new(args) {
		// create new event
		var html = '';
		var do_snap = true;
		
		app.setHeaderNav([ 'workflow_list', 'new_workflow' ]);
		app.setWindowTitle( config.ui.titles.new_workflow );
		app.highlightTab( 'NewWorkflow' );
		
		html += '<div class="box" style="overflow:hidden">';
		html += '<div class="box_title">';
			html += config.ui.titles.new_workflow;
			html += `<div class="box_subtitle"><a href="#Events?sub=list">${config.ui.links.back_to_events}</a></div>`;
		html += '</div>';
		html += '<div class="box_content">';
		
		if (this.getPageDraft()) {
			// restore draft
			this.event = this.checkRestorePageDraft();
			this.workflow = this.event.workflow;
			do_snap = false;
		}
		else {
			this.event = deep_copy_object( app.config.new_event_template );
			
			this.event.triggers = [];
			this.event.workflow = this.workflow = {
				nodes: [],
				connections: []
			};
			
			// construct minimal example workflow
			var trigger_node_id = gen_workflow_id('n');
			var job_node_id = gen_workflow_id('n');
			var conn_id = gen_workflow_id('c');
			
			this.event.triggers.push({
				"enabled": true,
				"type": "manual",
				"id": trigger_node_id
			});
			
			this.event.workflow.nodes.push({
                "id": trigger_node_id,
                "type": "trigger",
                "x": 100,
                "y": 340
            });
			
			var cat_id = '';
			if (find_object(app.categories, { id: 'general' })) cat_id = 'general';
			else if (!app.categories.length) return this.doFullPageError(config.ui.errors.new_wf_no_cats);
			else cat_id = app.categories[0].id;
			
			var plug_id = '';
			if (find_object(app.plugins, { id: 'shellplug' })) plug_id = 'shellplug';
			else if (!app.plugins.length) return this.doFullPageError(config.ui.errors.new_wf_no_plugins);
			else plug_id = app.plugins[0].id;
			
			var group_id = '';
			if (find_object(app.groups, { id: 'main' })) group_id = 'main';
			else if (!app.groups.length) return this.doFullPageError(config.ui.errors.new_wf_no_groups);
			else group_id = app.groups[0].id;
			
			this.event.workflow.nodes.push({
                "id": job_node_id,
                "type": "job",
                "data": {
                    "params": {},
                    "targets": [ group_id ],
                    "algo": "random",
                    "label": "",
                    "category": cat_id,
                    "plugin": plug_id,
                    "icon": ""
                },
                "x": 320,
                "y": 300
            });
			
			this.event.workflow.connections.push({
                "id": conn_id,
                "source": trigger_node_id,
                "dest": job_node_id
            });
		}
		
		this.params = this.event.fields; // for user form param editor
		this.limits = this.event.limits; // for res limit editor
		this.actions = this.event.actions; // for job action editor
		
		if (find_object(app.categories, { id: 'general' })) this.event.category = 'general';
		else if (!app.categories.length) return this.doFullPageError(config.ui.errors.new_wf_no_cats);
		else this.event.category = app.categories[0].id;
		
		// render form
		html += this.get_wf_form_html();
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		// render workflow editor
		html += this.get_wf_editor_html(`
			<div class="button primary right tablet_collapse" onClick="$P().do_new_workflow()"><i class="mdi mdi-floppy">&nbsp;</i><span>${config.ui.buttons.wf_new_save}<span></div>
			<div class="button secondary right mobile_collapse sm_hide" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>${config.ui.buttons.export}</span></div>
			<div class="button right mobile_collapse" onClick="$P().cancel_workflow_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>${config.ui.buttons.cancel}</span></div>
		`);
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_wf_icon, #fe_wf_cat, #fe_wf_algo') );
		// this.renderPluginParamEditor();
		this.renderParamEditor();
		// this.updateAddRemoveMe('#fe_wf_email');
		$('#fe_wf_title').focus();
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
		else Nav.go( '#Events?plugin=_workflow' );
	}
	
	do_new_workflow() {
		// create new workflow
		app.clearError();
		var event = this.get_event_form_json();
		if (!event) return; // error
		
		this.event = event;
		
		Dialog.showProgress( 1.0, config.ui.progress.wf_new_save );
		app.api.post( 'app/create_event', event, this.new_workflow_finish.bind(this) );
	}
	
	new_workflow_finish(resp) {
		// new workflow created successfully
		Dialog.hideProgress();
		if (!this.active) return; // sanity
		
		this.deletePageSnapshot();
		this.deletePageDraft();
		
		// create in-memory copy, but prevent race condition as server blasts update at same time
		var idx = find_object_idx(app.events, { id: resp.event.id });
		if (idx == -1) app.events.push(resp.event);
		
		Nav.go( 'Events?sub=view&id=' + resp.event.id );
		app.showMessage('success', config.ui.messages.wf_new_save);
	}
	
	gosub_edit(args) {
		// edit workflow subpage
		this.loading();
		
		var event = find_object( app.events, { id: args.id } );
		if (!event) return this.doFullPageError("Workflow not found: " + args.id);
		
		if (args.rollback && this.rollbackData) {
			event = this.rollbackData;
			delete this.rollbackData;
			app.showMessage('info', substitute(config.ui.messages.rollback_draft, { event }) );
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
			app.showMessage('info', config.ui.messages.draft_restored);
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
			'workflow_list',
			{ icon: this.event.icon || 'clipboard-flow-outline', loc: '#Events?sub=view&id=' + this.event.id, title: this.event.title },
			'edit_workflow'
		]);
		
		app.setWindowTitle( substitute( config.ui.titles.edit_workflow, { event: this.event } ) );
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += config.ui.titles.edit_workflow_details;
			html += '<div class="box_subtitle"><a href="#Events?sub=view&id=' + this.event.id + '">' + config.ui.links.back_to_workflow + '</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_wf_form_html();
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		// render workflow editor
		html += this.get_wf_editor_html(`
			<div class="button save right tablet_collapse" onClick="$P().do_save_workflow()"><i class="mdi mdi-floppy">&nbsp;</i><span>${config.ui.buttons.save_changes}</span></div>
			<div class="button secondary right mobile_collapse sm_hide" onClick="$P().go_edit_history()"><i class="mdi mdi-history">&nbsp;</i><span>${config.ui.buttons.history}</span></div>
			<div class="button secondary right mobile_collapse sm_hide" onClick="$P().do_export()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i><span>${config.ui.buttons.export}</span></div>
			<div class="button danger right mobile_collapse" onClick="$P().show_delete_event_dialog()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>${config.ui.buttons.delete}</span></div>
			<div class="button cancel right mobile_collapse sm_hide" onClick="$P().cancel_workflow_edit()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>${config.ui.buttons.close}</span></div>
		`);
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		SingleSelect.init( this.div.find('#fe_wf_icon, #fe_wf_cat, #fe_wf_algo') );
		// this.renderPluginParamEditor();
		this.renderParamEditor();
		// this.updateAddRemoveMe('#fe_wf_email');
		// $('#fe_wf_title').focus();
		// this.setupBoxButtonFloater();
		this.setupWorkflowEditor();
		this.setupEditTriggers();
		
		if (do_snap) this.savePageSnapshot( this.get_event_form_json(true) );
		if (this.args.scroll == 'bottom') app.scrollToBottom();
	}
	
	do_save_workflow() {
		// save changes to workflow
		app.clearError();
		var event = this.get_event_form_json();
		if (!event) return; // error
		
		this.event = event;
		
		Dialog.showProgress( 1.0, config.ui.progress.wf_edit_save );
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
		
		// Nav.go( 'Events?sub=view&id=' + this.event.id );
		this.triggerSaveComplete();
		app.showMessage('success', config.ui.messages.wf_edit_save);
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
		
		// add effects canvas
		this.setupEffects();
	}
	
	setupEffects() {
		// setup effects canvas, if user allows
		if (!app.user.effects) return; // no whimsy
		
		var $cont = this.wfGetContainer();
		var $canvas = $('<canvas id="c_wf_effects" class="wf_canvas"></canvas>');
		$cont.find('.wf_fade').append($canvas);
		
		var canvas = $canvas.get(0);
		var width = $cont.width();
		var height = $cont.height();
		
		canvas.width = width * window.devicePixelRatio;
		canvas.height = height * window.devicePixelRatio;
		
		this.confetti = confetti.create($canvas.get(0), { resize: false });
	}
	
	updateEffects() {
		// resize effects canvas after a window resize
		if (!this.confetti) return;
		
		var $cont = this.wfGetContainer();
		var $canvas = $cont.find('#c_wf_effects');
		var canvas = $canvas.get(0);
		var width = $cont.width();
		var height = $cont.height();
		
		canvas.width = width * window.devicePixelRatio;
		canvas.height = height * window.devicePixelRatio;
	}
	
	afterDraw() {
		// setup mouse drag handling on nodes
		var self = this;
		var $cont = this.wfGetContainer();
		
		$cont.find('div.wf_node').on( 'pointerdown', function(event) {
			var native = event.originalEvent;
			if (native.button !== 0) return; // only capture left-clicks
			
			var $this = $(this);
			var id = this.id.replace(/^d_wfn_/, '');
			
			event.stopPropagation();
			event.preventDefault();
			
			if (self.wfSoldering) {
				// allow clicks anywhere in the node for completing solders
				if ($this.find('.wf_pole_button').length) return self.completeSolder($this.find('.wf_pole_button').first(), id);
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
			self.prepareForDrag(this, event);
		} ); // pointerdown (nodes)
		
		$cont.find('div.wf_node').on( 'dblclick', function(event) {
			// check for double-click
			self.doEditSelection();
		}); // dblclick (nodes)
		
		// add mouse handler for condition entities
		$cont.find('div.wf_condition').on( 'pointerdown', function(event) {
			var native = event.originalEvent;
			if (native.button !== 0) return; // only capture left-clicks
			if (self.wfSoldering) return; // no clicky during solder
			
			this.setPointerCapture(native.pointerId);
			var conn_id = this.id.replace(/^d_wft_/, '');
			var $elem = $(this);
			
			event.stopPropagation();
			event.preventDefault();
			
			$elem.on( 'pointerup.quick', function() {
				$elem.off( 'pointerup.quick' );
				self.quickEditCondition( $elem, conn_id );
			} );
		}); // pointerdown (conditions)
		
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
			title: config.ui.menu_bits.wf_select_condition,
			items: [ 
				...config.ui.action_condition_menu
			].concat(
				this.buildOptGroup( app.tags, config.ui.menu_bits.wf_condition_on_custom_tag, 'tag-outline', 'tag:' )
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
	
	prepareForDrag(elem, event) {
		// prepare for single- or multi-node drag operation
		var self = this;
		var native = event.originalEvent;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		var selection = this.wfSelection;
		var start_pt = { x: event.clientX, y: event.clientY };
		var start_wf = deep_copy_object(workflow);
		
		this.wfDragging = false;
		elem.setPointerCapture(native.pointerId);
		
		$(elem).on('pointermove.drag', function(event) {
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
		}); // pointermove
		
		$(elem).on('pointerup.drag', function(event) {
			for (var id in selection) {
				var $elem = $cont.find('#d_wfn_' + id);
				$elem.css('cursor', '');
			}
			$(elem).off('.drag');
			
			// add snapshot to undo buffer, but only if dragging happened
			if (self.wfDragging) {
				self.addState();
				$cont.removeClass('dragging');
			}
		}); // pointerup
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
			
			// how about a little confetti for the new family member?
			if (!self.confetti) return;
			
			var node = find_object( workflow.nodes, { id } );
			var color = new Color( app.getCSSVar( self.getNodeColor(node) ) );
			var pos = self.getWFCenterPoint($elem);
			
			var opts = {
				origin: { x: (pos[0] / $cont.width()) * self.wfZoom, y: (pos[1] / $cont.height()) * self.wfZoom },
				colors: [ color.hex(), color.clone().mix('#FFFFFF', 0.5).hex() ],
				angle: 0,
				spread: 360,
				particleCount: 40,
				startVelocity: 10,
				gravity: 0.5,
				decay: 0.9,
				scalar: 0.5 * window.devicePixelRatio,
				ticks: 50,
				shapes: ['star']
			};
			
			if (node.type.match(/^(event|job)$/)) {
				opts.startVelocity *= 2;
				opts.particleCount *= 2;
			}
			
			opts.startVelocity *= self.wfZoom * window.devicePixelRatio;
			opts.gravity *= self.wfZoom;
			opts.scalar *= self.wfZoom;
			
			self.confetti(opts);
		} ); // foreach key
		
		// pole buttons
		$cont.find('.wf_pole_button').remove();
		
		if (num_sel == 1) {
			// solo selection, add poles
			var id = first_key(selection);
			var $elem = $cont.find('#d_wfn_' + id);
			
			$elem.find('.wf_pole').each( function() {
				var $pole = $(this);
				var $btn = $pole.clone().removeClass('wf_pole').addClass('wf_pole_button').on('pointerdown', function(event) {
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
		
		// remove all pole buttons (except $btn, but kill pointerdown on it)
		$btn.off('pointerdown').addClass('soldering').data('keep', 1);
		
		$cont.find('.wf_pole_button').each( function() {
			var $this = $(this);
			if (!$this.data('keep')) $this.remove();
		} );
		
		// add new destination pole buttons for completing solder (all nodes except ours)
		workflow.nodes.forEach( function(node) {
			if (node.id == id) return; // skip origin node
			var $elem = $cont.find('#d_wfn_' + node.id);
			
			$elem.find('.wf_pole.' + end_pole).each( function() {
				var $pole = $(this);
				var $btn = $pole.clone().removeClass('wf_pole').addClass('wf_pole_button').html('<i class="mdi mdi-plus"></i>').on('pointerdown', function(event) {
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
		
		// add pointermove handler to track solder operation
		$cont.on('pointermove.solder', function(event) {
			// update mouse tracker position
			const rect = this.getBoundingClientRect();
			const x = (event.clientX - rect.left) / self.wfZoom;
			const y = (event.clientY - rect.top) / self.wfZoom;
			
			$tracker.css({ left: x, top: y });
			
			// redraw connections
			self.renderWFConnections();
			
			// add our temp connection
			var canvas = $cont.find('#c_wf_canvas').get(0);
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
		}); // pointermove
		
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
			title: config.ui.menu_bits.wf_add_new_node,
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
	
	solderNewNode(event) {
		// pause solder and pop menu to create new node in place
		var self = this;
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		var scroll = this.wfScroll;
		
		var solder = this.wfPausedSolder = this.wfSoldering;
		delete this.wfSoldering;
		
		// update tracker position
		var $tracker = $cont.find('#d_wf_mouse_tracker');
		var el = event.target, x = event.offsetX / self.wfZoom, y = event.offsetY / self.wfZoom;
		
		while (el.id != 'd_wf_container') {
			x += el.offsetLeft;
			y += el.offsetTop;
			el = el.offsetParent;
			if (!el) break; // sanity
		}
		
		$tracker.css({ left: x, top: y });
		
		// add mouse tracker position to solder state
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
			if (start_node.type == 'controller') { allowed_types.controller = 1; allowed_types.action = 1; }
			if (start_node.type == 'trigger') { allowed_types.controller = 1; allowed_types.action = 1; }
		}
		else if (start_pole == 'wf_input_pole') {
			allowed_types.event = 1;
			allowed_types.job = 1;
			
			if (start_node.type.match(/^(event|job)$/)) { allowed_types.trigger = 1; allowed_types.controller = 1; }
			if (start_node.type == 'controller') { allowed_types.trigger = 1; allowed_types.controller = 1; }
			if (start_node.type == 'action') { allowed_types.trigger = 1; allowed_types.controller = 1; }
		}
		
		// wait for next pointerup
		$cont.find('#d_wf_editor').on('pointerup.solder', function() {
			// go popup
			$(this).off('pointerup.solder');
			
			SingleSelect.popupQuickMenu({
				elem: '#d_wf_mouse_tracker',
				title: config.ui.menu_bits.wf_add_new_node,
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
		});
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
		
		// add some sparks for fun
		this.addSolderSparks( solder, $elem );
		
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
	
	getNodeColor(node) {
		// get CSS variable name for node color
		var color_name = '--blue';
		switch (node.type) {
			case 'controller': color_name = '--purple'; break;
			case 'trigger': color_name = '--orange'; break;
			case 'action': color_name = '--green'; break;
			case 'limit': color_name = '--cyan'; break;
		}
		return color_name;
	}
	
	addSolderSparks(solder, $elem) {
		// add solder point sparks for whimsy
		// Note: solder is PRE-swap for reserve solders, so end will be where the user clicked
		if (!this.confetti) return;
		
		var workflow = this.workflow;
		var $cont = this.wfGetContainer();
		
		// find end node so we can get the color
		var node = find_object( workflow.nodes, { id: solder.end_node } );
		if (!node) return; // sanity
		var color_name = this.getNodeColor(node);
		
		var opts = { 
			spread: 180,
			particleCount: 20,
			startVelocity: 10,
			gravity: 0.5,
			decay: 0.9,
			scalar: 0.5 * window.devicePixelRatio,
			ticks: 50,
			shapes: ['star']
		};
		
		// figure out origin point
		var pos = this.getWFCenterPoint($elem);
		opts.origin = { x: (pos[0] / $cont.width()) * this.wfZoom, y: (pos[1] / $cont.height()) * this.wfZoom };
		
		switch (solder.end_pole) {
			case 'wf_input_pole': opts.angle = 180; opts.startVelocity = 7; break;
			case 'wf_output_pole': opts.angle = 0; opts.startVelocity = 7; break;
			case 'wf_down_pole': opts.angle = 270; color_name = '--cyan'; opts.startVelocity = 5; break;
			case 'wf_up_pole': opts.angle = 90; opts.startVelocity = 5; break;
		}
		
		opts.startVelocity *= this.wfZoom;
		opts.gravity *= this.wfZoom;
		opts.scalar *= this.wfZoom;
		
		var color = new Color( app.getCSSVar(color_name) );
		opts.colors = [ color.hex(), color.clone().mix('#FFFFFF', 0.5).hex() ];
		
		this.confetti(opts);
	}
	
	doTestSelection() {
		// test current selection
		var self = this;
		var event = this.event;
		var title = config.ui.titles.test_workflow;
		var btn = ['open-in-new', config.ui.buttons.wfd_run_test];
		var id = first_key(this.wfSelection);
		var node = find_object( this.workflow.nodes, { id: id } );
		
		app.clearError();
		var event = this.get_event_form_json();
		if (!event) return; // error
		
		if (node.type == 'limit') return app.doError('wf_test_no_limit');
		
		var html = '<div class="dialog_box_content scroll maximize">';
		
		// test scope
		html += this.getFormRow({
			id: 'd_ete_scope',
			content: this.getFormMenuSingle({
				id: 'fe_ete_scope',
				value: node.type.match(/^(trigger|controller)$/) ? 'entire' : 'single'
			})
		});
		
		// actions
		html += this.getFormRow({
			id: 'd_ete_actions',
			content: this.getFormCheckbox({
				id: 'fe_ete_actions',
				checked: true
			})
		});
		
		// limits
		html += this.getFormRow({
			id: 'd_ete_limits',
			content: this.getFormCheckbox({
				id: 'fe_ete_limits',
				checked: true
			})
		});
		
		// custom input json
		html += this.getFormRow({
			id: 'd_ete_input',
			content: this.getFormTextarea({
				id: 'fe_ete_input',
				rows: 1,
				value: JSON.stringify({ data: {}, files: [] }, null, "\t"),
				style: 'display:none'
			}) + `<div class="button small secondary" onClick="$P().openJobDataImporter()"><i class="mdi mdi-database-search-outline">&nbsp;</i>${config.ui.buttons.wfd_data_importer}</div>` + 
				`<div class="button small secondary" style="margin-left:15px;" onClick="$P().edit_test_input()"><i class="mdi mdi-text-box-edit-outline">&nbsp;</i>${config.ui.buttons.wfd_edit_json}</div>`
		});
		
		// user files
		var limit = find_object( event.limits || [], { type: 'file', enabled: true } );
		html += this.getFormRow({
			id: 'd_ete_files',
			content: this.getDialogFileUploader(limit)
		});
		
		// user form fields
		html += this.getFormRow({
			id: 'd_ete_params',
			label: 'Workflow Parameters:',
			content: '<div class="plugin_param_editor_cont">' + this.getParamEditor(event.fields, {}) + '</div>',
			caption: (event.fields && event.fields.length) ? config.ui.dom.d_ete_params.caption : ''
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
			
			var scope = $('#fe_ete_scope').val();
			if (scope == 'single') {
				// restrict test to just a single node
				job.workflow.nodes = [ node ];
				job.workflow.connections = [];
			}
			
			if (!$('#fe_ete_actions').is(':checked')) {
				// disable both workflow actions and action nodes
				job.actions = [];
				if (scope != 'single') find_objects( job.workflow.nodes, { type: 'action' } ).forEach( function(action) {
					action.enabled = false;
				} );
			}
			if (!$('#fe_ete_limits').is(':checked')) {
				// disable both workflow limits and limit nodes
				job.limits = [];
				if (scope != 'single') find_objects( job.workflow.nodes, { type: 'limit' } ).forEach( function(limit) {
					limit.enabled = false;
				} );
			}
			
			// parse custom input json
			var raw_json = $('#fe_ete_input').val();
			if (raw_json) try {
				job.input = JSON.parse( raw_json );
			}
			catch (err) {
				return app.badField( '#fe_ete_input', "", { err } );
			}
			
			// add files if user uploaded
			if (self.dialogFiles && self.dialogFiles.length) {
				if (!job.input) job.input = {};
				if (!job.input.files) job.input.files = [];
				job.input.files = job.input.files.concat( self.dialogFiles );
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
				app.doError('api_error', { err });
			});
			
			Dialog.hide();
		}); // Dialog.confirm
		
		SingleSelect.init( $('#fe_ete_scope') );
		
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
		if (!sorted_events.length) return app.doError('wfde_no_events');
		
		if (do_create) {
			node = { 
				id: gen_workflow_id('n'),
				type: 'event', 
				data: { event: sorted_events[0].id, params: {} } 
			};
		} // do_create
		
		var event = find_object( app.events, { id: node.data.event } );
		if (!event) return app.doError('wfde_event_not_found', { node });
		var params = node.data.params;
		
		var title = do_create ? config.ui.titles.wfde_new : config.ui.titles.wfde_edit;
		var btn = do_create ? ['plus-circle', config.ui.buttons.wfd_add_node] : ['check-circle', config.ui.buttons.accept];
		
		if (!do_create) title += ` <div class="dialog_title_widget mobile_hide"><span class="monospace">${this.getNiceCopyableID(node.id)}</span></div>`;
		
		var html = '<div class="dialog_box_content scroll maximize">';
		
		// event
		html += this.getFormRow({
			id: 'd_wfde_event',
			content: this.getFormMenuSingle({
				id: 'fe_wfde_event',
				options: sorted_events,
				value: node.data.event || '',
				default_icon: 'calendar-clock',
				'data-shrinkwrap': 1
			})
		});
		
		// targets
		html += this.getFormRow({
			id: 'd_wfde_targets',
			content: this.getFormMenuMulti({
				id: 'fe_wfde_targets',
				options: [].concat(
					this.buildOptGroup(app.groups, config.ui.menu_bits.wf_targets_groups, 'server-network'),
					this.buildServerOptGroup(config.ui.menu_bits.wf_targets_servers, 'router-network')
				),
				values: node.data.targets || [],
				auto_add: true,
				// 'data-hold': 1
				// 'data-shrinkwrap': 1
			})
		});
		
		// algo
		html += this.getFormRow({
			id: 'd_wfde_algo',
			content: this.getFormMenuSingle({
				id: 'fe_wfde_algo',
				options: [{ id: '', title: config.ui.menu_bits.wf_algo_default }].concat(config.ui.event_target_algo_menu).concat(
					this.buildOptGroup( app.monitors, config.ui.menu_bits.wf_algo_least, 'chart-line', 'monitor:' )
				),
				value: node.data.algo || '',
				// default_icon: 'arrow-decision',
				'data-nudgeheight': 1
				// 'data-shrinkwrap': 1
			})
		});
		
		// tags
		html += this.getFormRow({
			id: 'd_wfde_tags',
			content: this.getFormMenuMulti({
				id: 'fe_wfde_tags',
				options: app.tags,
				values: node.data.tags || [],
				default_icon: 'tag-outline',
				// 'data-shrinkwrap': 1
			})
		});
		
		// params
		html += this.getFormRow({
			id: 'd_wfde_user_params',
			content: '<div id="d_wfde_param_editor" class="plugin_param_editor_cont"></div>'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			node.data.event = $('#fe_wfde_event').val();
			node.data.targets = $('#fe_wfde_targets').val();
			node.data.algo = $('#fe_wfde_algo').val();
			node.data.tags = $('#fe_wfde_tags').val();
			
			var event = find_object( app.events, { id: node.data.event } );
			node.data.params = self.getParamValues(event.fields, false); // do not validate here
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
		
		MultiSelect.init( $('#fe_wfde_targets, #fe_wfde_tags') );
		SingleSelect.init( $('#fe_wfde_event, #fe_wfde_algo') );
		
		// handle event change
		var do_change_event = function() {
			// refresh param editor
			var event_id = $('#fe_wfde_event').val();
			var event = find_object( app.events, { id: event_id } );
			$('#d_wfde_param_editor').html( self.getParamEditor( event.fields, params, true ) );
			Dialog.autoResize();
		}
		
		$('#fe_wfde_event').on('change', do_change_event);
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
			else if (!app.categories.length) return app.doError('wfdj_no_cats');
			else node.data.category = app.categories[0].id;
			
			if (find_object(app.plugins, { id: 'shellplug' })) node.data.plugin = 'shellplug';
			else if (!app.plugins.length) return app.doError('wfdj_no_plugins');
			else node.data.plugin = app.plugins[0].id;
		} // do_create
		
		var plugin = find_object( app.plugins, { id: node.data.plugin } );
		if (!plugin) return app.doError('wfdj_plugin_not_found', { node });
		var params = node.data.params;
		
		var title = do_create ? config.ui.titles.wfdj_new : config.ui.titles.wfdj_edit;
		var btn = do_create ? ['plus-circle', config.ui.buttons.wfd_add_node] : ['check-circle', config.ui.buttons.accept];
		
		if (!do_create) title += ` <div class="dialog_title_widget mobile_hide"><span class="monospace">${this.getNiceCopyableID(node.id)}</span></div>`;
		
		var html = '<div class="dialog_box_content scroll maximize">';
		
		// plugin
		html += this.getFormRow({
			id: 'd_wfdj_plugin',
			content: this.getFormMenuSingle({
				id: 'fe_wfdj_plugin',
				options: app.plugins.filter( function(plugin) { return plugin.type == 'event'; } ),
				value: node.data.plugin || '',
				default_icon: 'power-plug-outline'
				// 'data-shrinkwrap': 1
			})
		});
		
		// title
		html += this.getFormRow({
			id: 'd_wfdj_title',
			content: this.getFormText({
				id: 'fe_wfdj_title',
				spellcheck: 'false',
				autocomplete: 'off',
				value: node.data.label
			})
		});
		
		// category
		html += this.getFormRow({
			id: 'd_wfdj_cat',
			content: this.getFormMenuSingle({
				id: 'fe_wfdj_cat',
				options: app.categories,
				value: node.data.category || '',
				default_icon: 'folder-open-outline',
				// 'data-shrinkwrap': 1
			})
		});
		
		// targets
		html += this.getFormRow({
			id: 'd_wfdj_targets',
			content: this.getFormMenuMulti({
				id: 'fe_wfdj_targets',
				options: [].concat(
					this.buildOptGroup(app.groups, config.ui.menu_bits.wf_targets_groups, 'server-network'),
					this.buildServerOptGroup(config.ui.menu_bits.wf_targets_servers, 'router-network')
				),
				values: node.data.targets,
				auto_add: true,
				// 'data-hold': 1
				// 'data-shrinkwrap': 1
			})
		});
		
		// algo
		html += this.getFormRow({
			id: 'd_wfdj_algo',
			content: this.getFormMenuSingle({
				id: 'fe_wfdj_algo',
				options: config.ui.event_target_algo_menu.concat(
					this.buildOptGroup( app.monitors, config.ui.menu_bits.wf_algo_least, 'chart-line', 'monitor:' )
				),
				value: node.data.algo || '',
				default_icon: 'arrow-decision',
				'data-nudgeheight': 1
				// 'data-shrinkwrap': 1
			})
		});
		
		// tags
		html += this.getFormRow({
			id: 'd_wfdj_tags',
			content: this.getFormMenuMulti({
				id: 'fe_wfdj_tags',
				options: app.tags,
				values: node.data.tags || [],
				default_icon: 'tag-outline',
				// 'data-shrinkwrap': 1
			})
		});
		
		// params
		html += this.getFormRow({
			id: 'd_wfdj_user_params',
			content: '<div id="d_wfdj_param_editor" class="plugin_param_editor_cont"></div>'
		});
		
		html += '</div>';
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			node.data.label = strip_html( $('#fe_wfdj_title').val() );
			node.data.category = $('#fe_wfdj_cat').val();
			node.data.plugin = $('#fe_wfdj_plugin').val();
			node.data.targets = $('#fe_wfdj_targets').val();
			node.data.algo = $('#fe_wfdj_algo').val();
			node.data.tags = $('#fe_wfdj_tags').val();
			
			if (!node.data.targets.length) return app.badField('#fe_wfdj_targets');
			
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
		
		MultiSelect.init( $('#fe_wfdj_targets, #fe_wfdj_tags') );
		SingleSelect.init( $('#fe_wfdj_cat, #fe_wfdj_plugin, #fe_wfdj_algo') );
		
		// handle plugin change
		var do_change_plugin = function() {
			// refresh plugin param editor
			var plugin_id = $('#fe_wfdj_plugin').val();
			var plugin = find_object( app.plugins, { id: plugin_id } );
			$('#d_wfdj_param_editor').html( self.getPluginParamEditor( plugin_id, node.data.params, true ) );
			Dialog.autoResize();
		}
		
		$('#fe_wfdj_plugin').on('change', do_change_plugin);
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
		
		var title = do_create ? config.ui.titles.wfda_new : config.ui.titles.wfda_edit;
		var btn = do_create ? ['plus-circle', config.ui.buttons.wfd_add_action] : ['check-circle', config.ui.buttons.accept];
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
		
		var title = do_create ? config.ui.titles.wfdl_new : config.ui.titles.wfdl_edit;
		var btn = do_create ? ['plus-circle', config.ui.buttons.wfd_add_limit] : ['check-circle', config.ui.buttons.accept];
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
		
		var title = do_create ? config.ui.titles.wfdc_new : config.ui.titles.wfdc_edit;
		var btn = do_create ? ['plus-circle', config.ui.buttons.wfd_add_controller] : ['check-circle', config.ui.buttons.accept];
		
		if (!do_create) title += ` <div class="dialog_title_widget mobile_hide"><span class="monospace">${this.getNiceCopyableID(node.id)}</span></div>`;
		
		var html = '<div class="dialog_box_content scroll maximize">';
		
		// type
		html += this.getFormRow({
			id: 'd_wfd_type',
			content: this.getFormMenuSingle({
				id: 'fe_wfd_type',
				options: config.ui.workflow_controller_type_menu,
				value: node.data.controller,
				'data-shrinkwrap': 1,
				// 'data-nudgeheight': 1
			})
		});
		
		// description
		html += this.getFormRow({
			id: 'd_wfd_desc',
			content: '...'
		});
		
		// dynamic fields based on type:
		
		// multiplex stagger
		html += this.getFormRow({
			id: 'd_wfd_stagger',
			content: this.getFormRelativeTime({
				id: 'fe_wfd_stagger',
				value: node.data.stagger || 0
			})
		});
		
		// wait time
		html += this.getFormRow({
			id: 'd_wfd_wait',
			content: this.getFormRelativeTime({
				id: 'fe_wfd_wait',
				value: node.data.wait || 0
			})
		});
		
		// repeat iterations
		html += this.getFormRow({
			id: 'd_wfd_repeat',
			content: this.getFormText({
				id: 'fe_wfd_repeat',
				type: 'number',
				spellcheck: 'false',
				maxlength: 32,
				min: 1,
				value: node.data.repeat || 1
			})
		});
		
		// split path
		html += this.getFormRow({
			id: 'd_wfd_split',
			content: this.getFormText({
				id: 'fe_wfd_split',
				type: 'text',
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 8192,
				class: 'monospace',
				value: node.data.split || ''
			}) + '<div class="text_field_icon mdi mdi-database-search-outline" title="' + config.ui.tooltips.wfd_exp_builder + '" onClick="$P().openExpressionBuilder(this)"></div>'
		});
		
		// if expression
		html += this.getFormRow({
			id: 'd_wfd_if',
			content: this.getFormText({
				id: 'fe_wfd_if',
				type: 'text',
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 8192,
				class: 'monospace',
				value: node.data.decision || ''
			}) + '<div class="text_field_icon mdi mdi-database-search-outline" title="' + config.ui.tooltips.wfd_exp_builder + '" onClick="$P().openExpressionBuilder(this)"></div>'
		});
		
		// custom title
		html += this.getFormRow({
			id: 'd_wfd_title',
			content: this.getFormText({
				id: 'fe_wfd_title',
				spellcheck: 'false',
				autocomplete: 'off',
				value: node.data.label || ''
			})
		});
		
		// custom icon
		html += this.getFormRow({
			id: 'd_wfd_icon',
			content: this.getFormMenuSingle({
				id: 'fe_wfd_icon',
				options: [['', '(None)']].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: node.data.icon || '',
				// 'data-shrinkwrap': 1
			})
		});
		
		// continue percentage
		html += this.getFormRow({
			id: 'd_wfd_continue',
			content: this.getFormText({
				id: 'fe_wfd_continue',
				type: 'number',
				spellcheck: 'false',
				maxlength: 3,
				min: 0,
				value: node.data.continue || 0
			})
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
					if (!node.data.split.length) return app.badField('#fe_wfd_split');
					node.data.continue = parseInt( $('#fe_wfd_continue').val() ) || 0;
				break;
				
				case 'join':
					// no options
				break;
				
				case 'decision':
					node.data.label = strip_html( $('#fe_wfd_title').val() );
					node.data.icon = $('#fe_wfd_icon').val();
					node.data.decision = $('#fe_wfd_if').val().trim();
					if (!node.data.decision.length) return app.badField('#fe_wfd_if');
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
	
	openExpressionBuilder(elem) {
		// open expression builder dialog
		var self = this;
		var $input = $(elem).closest('.fr_content').find('input');
		var title = config.ui.titles.wfd_exp_builder;
		var html = '';
		
		html += `<div class="dialog_intro">${config.ui.intros.wfd_exp_builder}</div>`;
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
		buttons_html += `<div id="btn_ex_apply" class="button primary"><i class="mdi mdi-check-circle">&nbsp;</i>${config.ui.buttons.accept}</div>`;
		
		CodeEditor.showSimpleDialog(title, html, buttons_html);
		
		SingleSelect.init('#fe_ex_job');
		
		$('#fe_ex_job').on('change', function() {
			var id = $(this).val();
			if (!id) return; // sanity
			
			// now load job details
			app.api.get( 'app/get_job', { id, remove: ['timelines', 'activity'] }, function(resp) {
				
				// render json tree
				$('#d_ex_tree > .ex_tree_inner').html( self.getDataTree(resp.job) );
				
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
			var value = $input.val();
			if (value.length) value += ' ';
			$input.val( (value + $('#fe_ex_exp').val()).trim() );
			CodeEditor.hide();
			
			// apply flash effect
			$input.addClass('iflash').focus();
			setTimeout( function() { $input.removeClass('iflash'); }, 1500 );
		});
		
		// job search
		app.api.get( 'app/search_jobs', { query: 'source:workflow tags:_success', limit: config.alt_items_per_page }, function(resp) {
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
		
		// trigger edit change, but only if the user actually made a change
		if (this.wfSnapshots.length > 1) this.triggerEditChange();
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
		
		this.triggerEditChange();
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
				id: 'd_wf_id',
				content: this.getFormText({
					id: 'fe_wf_id',
					class: 'monospace',
					spellcheck: 'false',
					disabled: 'disabled',
					value: event.id
				}),
				suffix: this.getFormIDCopier()
			});
		}
		
		// title
		html += this.getFormRow({
			id: 'd_wf_title',
			content: this.getFormText({
				id: 'fe_wf_title',
				spellcheck: 'false',
				autocomplete: 'off',
				value: event.title
			})
		});
		
		// enabled
		html += this.getFormRow({
			id: 'd_wf_enabled',
			content: this.getFormCheckbox({
				id: 'fe_wf_enabled',
				checked: event.enabled
			})
		});
		
		// icon
		html += this.getFormRow({
			id: 'd_wf_icon',
			content: this.getFormMenuSingle({
				id: 'fe_wf_icon',
				options: [['', config.ui.menu_bits.generic_none]].concat( iconFontNames.map( function(name) { return { id: name, title: name, icon: name }; } ) ),
				value: event.icon || '',
				// 'data-shrinkwrap': 1
			})
		});
		
		// category
		html += this.getFormRow({
			id: 'd_wf_cat',
			content: this.getFormMenuSingle({
				id: 'fe_wf_cat',
				options: app.categories,
				value: event.category || '',
				default_icon: 'folder-open-outline',
				// 'data-shrinkwrap': 1
			}),
			suffix: `<div class="form_suffix_icon mdi mdi-folder-plus-outline" title="${config.ui.tooltips.quick_add_cat}" onClick="$P().quickAddCategory()" onMouseDown="event.preventDefault();"></div>`
		});
		
		// tags
		html += this.getFormRow({
			id: 'd_wf_tags',
			content: this.getFormMenuMulti({
				id: 'fe_wf_tags',
				options: app.tags,
				values: event.tags,
				default_icon: 'tag-outline',
				// 'data-shrinkwrap': 1
			}),
			suffix: '<div class="form_suffix_icon mdi mdi-tag-plus-outline" title="Quick Add Tag..." onClick="$P().quickAddTag()" onMouseDown="event.preventDefault();"></div>'
		});
		
		// user fields
		html += this.getFormRow({
			id: 'd_wf_user_fields',
			content: '<div id="d_params_table"></div>'
		});
		
		// resource limits
		// (requires this.limits to be populated)
		html += this.getFormRow({
			id: 'd_wf_res_limits',
			content: '<div id="d_ee_reslim_table">' + this.getResLimitTable() + '</div>'
		});
		
		// actions
		// (requires this.actions to be populated)
		html += this.getFormRow({
			id: 'd_wf_job_actions',
			content: '<div id="d_ee_jobact_table">' + this.getJobActionTable() + '</div>'
		});
		
		// notes
		html += this.getFormRow({
			id: 'd_wf_notes',
			content: this.getFormTextarea({
				id: 'fe_wf_notes',
				rows: 5,
				value: event.notes
			})
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
			<div class="wf_title left" style="display:none"><i class="mdi mdi-clipboard-flow-outline">&nbsp;</i>${config.ui.titles.workflow_editor}</div>
			<div class="button secondary left mobile_collapse" id="d_btn_wf_edit" onClick="$P().doEditSelection()" style="display:none" title="${config.ui.tooltips.wf_edit_sel_node}"><i class="mdi mdi-note-edit-outline">&nbsp;</i><span>${config.ui.buttons.wf_edit_sel_node}</span></div>
			<div class="button secondary left mobile_collapse" id="d_btn_wf_test" onClick="$P().doTestSelection()" style="display:none" title="${config.ui.tooltips.wf_test_sel_node}"><i class="mdi mdi-test-tube">&nbsp;</i><span>${config.ui.buttons.wf_test_sel_node}</span></div>
			<div class="button icon left mobile_collapse" id="d_btn_wf_dup" onClick="$P().doDuplicateSelection()" style="display:none" title="${config.ui.tooltips.wf_dupe_sel}"><i class="mdi mdi-content-duplicate">&nbsp;</i><span>${config.ui.buttons.wf_dupe_sel}</span></div>
			<div class="button danger left mobile_collapse" id="d_btn_wf_dis" onClick="$P().doDetachSelection()" style="display:none" title="${config.ui.tooltips.wf_detach_sel}"><i class="mdi mdi-soldering-iron">&nbsp;</i><span>${config.ui.buttons.wf_detach_sel}</span></div>
			<div class="button danger left mobile_collapse" id="d_btn_wf_del" onClick="$P().doDeleteSelection()" style="display:none" title="${config.ui.tooltips.wf_delete_sel}"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>${config.ui.buttons.wf_delete_sel}</span></div>
			<div class="wf_sel_msg left tablet_hide"></div>
			
			<div class="button default right tablet_collapse" id="d_btn_wf_new" onClick="$P().doAddNode()"><i class="mdi mdi-plus-circle">&nbsp;</i><span>${config.ui.buttons.wf_add_node}</span></div>
			<div class="clear"></div>
		</div>`;
		
		html += `<div class="wf_grid_footer">
			<div class="button icon left disabled" id="d_btn_wf_undo" onClick="$P().doUndo()" title="${config.ui.tooltips.wf_undo}"><i class="mdi mdi-undo"></i></div>
			<div class="button icon left disabled" id="d_btn_wf_redo" onClick="$P().doRedo()" title="${config.ui.tooltips.wf_redo}"><i class="mdi mdi-redo"></i></div>
			<div class="wf_button_separator left"></div>
			<div class="button icon left" onClick="$P().wfZoomAuto()" title="${config.ui.tooltips.wf_zoom_auto}"><i class="mdi mdi-home"></i></div>
			<div class="button icon left" id="d_btn_wf_zoom_out" onClick="$P().wfZoomOut()" title="${config.ui.tooltips.wf_zoom_out}"><i class="mdi mdi-magnify-minus"></i></div>
			<div class="button icon left" id="d_btn_wf_zoom_in" onClick="$P().wfZoomIn()" title="${config.ui.tooltips.wf_zoom_in}"><i class="mdi mdi-magnify-plus"></i></div>
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
		
		event.title = $('#fe_wf_title').val().trim();
		event.enabled = $('#fe_wf_enabled').is(':checked') ? true : false;
		event.icon = $('#fe_wf_icon').val();
		event.category = $('#fe_wf_cat').val();
		event.tags = $('#fe_wf_tags').val();
		event.notes = $('#fe_wf_notes').val();
		
		if (!force) {
			if (!event.title.length) {
				return app.badField('#fe_wf_title');
			}
		}
		
		return event;
	}
	
	onResize() {
		// called when page is resized
		if (this.wfZoom) {
			this.renderWFConnections();
			this.updateEffects();
		}
	}
	
	onDeactivate() {
		// called when page is deactivated
		if ((this.args.sub == 'new') || (this.args.sub == 'edit')) {
			this.checkSavePageDraft( this.get_event_form_json(true) );
		}
		if (this.confetti) {
			this.confetti.reset();
			delete this.confetti;
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
