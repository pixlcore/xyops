// Orchestra Workflow Mixin
// Copyright (c) 2019 - 2025 PixlCore LLC and Joseph Huckaby
// Sustainable Use License

const jexl = require('jexl');
const Tools = require("pixl-tools");
const noop = function() {};

class Workflows {
	
	logWorkflow(job, node_id, msg, data) {
		// log debug msg with pseudo-component, and append to job log
		var level = 6;
		if (!data) data = {};
		data.job = job.id;
		if (node_id) data.node = node_id;
		
		if (job.state != 'complete') {
			this.appendMetaLog( job, msg, { node: node_id || '' } );
		}
		
		if (this.debugLevel(level)) {
			this.logger.set( 'component', 'Workflow' );
			this.logger.print({ category: 'debug', code: level, msg: msg, data: data });
		}
	}
	
	startWorkflow(job) {
		// start workflow main job
		var self = this;
		var workflow = job.workflow;
		
		workflow.state = {};
		workflow.jobs = {};
		
		// store sub-job output in details, so it isn't synced to clients every second
		var details = this.jobDetails[job.id];
		details.wfJobData = {};
		
		// sanity checks
		if (!workflow.start) return this.abortJob(job, "Workflow has no start node specified.");
		if (!workflow.nodes || !workflow.nodes.length) return this.abortJob(job, "Workflow has no nodes specified.");
		if (!workflow.connections) return this.abortJob(job, "Workflow is missing connections array.");
		
		this.logWorkflow(job, null, `Workflow is starting`);
		
		var node = Tools.findObject( workflow.nodes, { id: workflow.start } );
		if (!node) return this.abortJob(job, "Workflow start node not found: " + workflow.start );
		
		this.logWorkflow(job, workflow.start, `Starting at ${node.type} node #${workflow.start}`);
		
		// blend job params in with input data, in case both are present
		var data = Tools.mergeHashes( job.params || {}, (job.input && job.input.data) ? job.input.data : {} );
		
		this.runWorkflowNode({
			job: job,
			node: node,
			overrides: {
				input: {
					data: data,
					files: job.files || [] // TODO: populate these in api_run_event
				}
			}
		});
	}
	
	runWorkflowNode(opts) {
		// run single workflow node (id or object)
		// opts: { job, node, overrides?, source? }
		var self = this;
		var { job, node } = opts;
		var workflow = job.workflow;
		if (job.complete || job.workflow.aborted) return; // sanity
		
		if (typeof(node) == 'string') {
			node = opts.node = Tools.findObject( workflow.nodes, { id: node } ) || {};
		}
		
		var func = 'runWFNode_' + node.type;
		if (!this[func]) return this.abortJob(job, "Unknown workflow node type: " + node.type);
		
		this.logWorkflow(job, node.id, `Running workflow ${node.type} node`);
		
		// setup node state
		workflow.state[ node.id ] = { started: Tools.timeNow() };
		
		this[func](opts);
	}
	
	/* {
		"id": "nsgbudi7",
		"type": "trigger",
		"x": 53.5,
		"y": 306.4453125
	}, */
	
	runWFNode_trigger(opts) {
		// run trigger node
		var self = this;
		var { job, node } = opts;
		var workflow = job.workflow;
		var state = workflow.state[ node.id ];
		
		// find our event definition
		var event = Tools.findObject( this.events, { id: job.event } );
		if (!event) {
			// should never happen
			return this.abortJob(job, `Could not find linked event definition: ${job.event}`);
		}
		
		// find connected trigger in event timing table
		var trigger = Tools.findObject( event.triggers, { id: node.id } );
		if (!trigger) {
			// should never happen
			return this.abortJob(job, `Could not find linked trigger definition: ${node.id}`);
		}
		
		this.logWorkflow(job, node.id, `Launching trigger: ${trigger.type}`);
		
		// run all connected nodes
		var num_conns = 0;
		Tools.findObjects( workflow.connections, { source: node.id } ).forEach( function(conn) {
			self.runWorkflowNode({ ...opts, node: conn.dest, source: node });
			num_conns++;
		} );
		
		if (!num_conns) this.logWorkflow(job, node.id, `WARNING: No nodes connected to trigger.`);
		state.completed = Tools.timeNow();
		
		// if this was a scheduled trigger, also light up all trigger option nodes (cosmetic)
		if (trigger.type.match(/^(schedule|single|plugin)$/)) {
			event.triggers.filter( function(item) { return !!item.type.match(/^(catchup|range|blackout|delay|precision)$/); } ).forEach( function(item) {
				if (!item.enabled) return;
				if (!workflow.state[item.id]) workflow.state[item.id] = {};
				workflow.state[item.id].completed = Tools.timeNow();
			} );
		}
	}
	
	/* {
		"id": "nbiq3bju",
		"type": "event",
		"data": {
			"event": "emcr7qj6x6p",
			"params": {},
			"targets": [],
			"algo": ""
		},
		"x": 130,
		"y": 481.4453125
	} */

	runWFNode_event(opts) {
		// run event node
		var self = this;
		var { job, node, source } = opts;
		var workflow = job.workflow;
		var state = job.workflow.state[ node.id ];
		
		// create space to hold completed job info
		if (!workflow.jobs[ node.id ]) workflow.jobs[ node.id ] = [];
		
		var event = Tools.findObject( this.events, { id: node.data.event } );
		if (!event) {
			// should never happen
			return this.abortJob(job, `Event not found: ${node.data.event} (Node #${node.id})`);
		}
		
		// create new job object
		var new_job = Tools.copyHash( event, true );
		delete new_job.id;
		new_job.event = node.data.event;
		new_job.params = Tools.copyHash( Tools.mergeHashes(event.params || {}, node.data.params || {}), true );
		new_job.source = 'workflow';
		
		// create or merge into job.workflow (so a workflow can launch a sub-workflow)
		if (!new_job.workflow) new_job.workflow = {};
		new_job.workflow.job = job.id;
		new_job.workflow.node = node.id;
		new_job.workflow.launcher = source ? source.id : null;
		
		// allow node to override certain bits
		if (node.data.targets && node.data.targets.length) new_job.targets = Tools.copyHash(node.data.targets, true);
		if (node.data.algo) new_job.algo = node.data.algo;
		
		// finally, allow runtime to override (i.e. from controller or launch)
		if (opts.overrides) {
			Tools.mergeHashInto( new_job, Tools.copyHash( opts.overrides, true ) );
		}
		
		// copy over `test` param if the parent workflow job is also a test
		if (job.test) new_job.test = true;
		
		// blend actions and limits
		if (!new_job.actions) new_job.actions = [];
		if (!new_job.limits) new_job.limits = [];
		
		Tools.findObjects( workflow.connections, { source: node.id } ).forEach( function(conn) {
			var dest = Tools.findObject( workflow.nodes, { id: conn.dest } );
			if (dest.type == 'limit') {
				// override based on limit type, or add new
				var idx = Tools.findObjectIdx( new_job.limits, { type: dest.data.type } );
				if (idx > -1) new_job.limits[idx] = Tools.copyHash(dest.data, true);
				else new_job.limits.push( Tools.copyHash(dest.data, true) );
			}
			else if ((dest.type == 'action') && conn.condition) {
				// all action connections should have a condition
				new_job.actions.push( Tools.copyHash( Tools.mergeHashes(dest.data, { id: conn.dest, condition: conn.condition, conn: conn.id }), true ) );
			}
		});
		
		this.logWorkflow(job, node.id, `Running workflow event: ${event.title} (#${event.id})`, { job: new_job });
		
		this.launchJob(new_job, function(err, id) {
			if (err) return self.abortJob(job, "Failed to launch job: " + (err.message || err));
			self.logWorkflow(job, node.id, `New event job launched: #${id}`);
		});
	}
	
	/* {
		"id": "n3duezg7",
		"type": "job",
		"data": {
			"params": {
				"script": "#!/bin/sh\n\n# Enter your shell script code here\necho \"Drained.\"\n",
				"annotate": true,
				"json": false
			},
			"targets": [
				"main"
			],
			"algo": "random",
			"label": "Drain Pond",
			"category": "general",
			"plugin": "shellplug",
			"icon": ""
		},
		"x": 505,
		"y": 165
	}, */
	
	runWFNode_job(opts) {
		// run ad-hoc job (plugin) node
		var self = this;
		var { job, node, source } = opts;
		var workflow = job.workflow;
		var state = job.workflow.state[ node.id ];
		
		// create space to hold completed job info
		if (!workflow.jobs[ node.id ]) workflow.jobs[ node.id ] = [];
		
		// create new job object
		var new_job = Tools.copyHash( node.data, true );
		new_job.event = job.event;
		new_job.source = 'workflow';
		new_job.workflow = {
			job: job.id,
			node: node.id,
			launcher: source ? source.id : null
		};
		
		// pass along input, etc. from previous job (or parent job if this is a launch situation)
		if (opts.overrides) {
			Tools.mergeHashInto( new_job, Tools.copyHash( opts.overrides, true ) );
		}
		
		// add type indicating this is an "ad-hoc" job (it has no event per se)
		new_job.type = 'adhoc';
		
		// copy over `test` param if the parent workflow job is a test
		if (job.test) new_job.test = true;
		
		// add actions and limits
		new_job.actions = [];
		new_job.limits = [];
		
		Tools.findObjects( workflow.connections, { source: node.id } ).forEach( function(conn) {
			var dest = Tools.findObject( workflow.nodes, { id: conn.dest } );
			if (dest.type == 'limit') {
				new_job.limits.push( Tools.copyHash(dest.data, true) );
			}
			else if ((dest.type == 'action') && conn.condition) {
				// all action connections should have a condition
				new_job.actions.push( Tools.copyHash( Tools.mergeHashes(dest.data, { id: conn.dest, condition: conn.condition, conn: conn.id }), true ) );
			}
		});
		
		var plugin = Tools.findObject( this.plugins, { id: new_job.plugin } ) || { title: new_job.plugin };
		
		this.logWorkflow(job, node.id, `Running custom job: ${new_job.label || plugin.title}`, { job: new_job });
		
		this.launchJob(new_job, function(err, id) {
			if (err) return self.abortJob(job, "Failed to launch job: " + (err.message || err));
			self.logWorkflow(job, node.id, `New custom job launched: #${id}`);
		});
	}
	
	/* {
		"id": "nt5mj46b",
		"type": "action",
		"data": {
			"enabled": true,
			"type": "web_hook",
			"web_hook": "example_hook"
		},
		"x": 998,
		"y": 197
	}, */
	
	runWFNode_action(opts) {
		// run action node (i.e. wired via complete condition)
		// use outer workflow job as context for action
		var self = this;
		var { job, node, source } = opts;
		var workflow = job.workflow;
		var state = job.workflow.state[ node.id ];
		
		if (!node.data.enabled) {
			this.logWorkflow(job, node.id, `Skipping disabled action: ${node.data.type}`);
			return;
		}
		if (!opts.condition) {
			this.logWorkflow(job, node.id, `Action has no condition specified: ${node.data.type}`);
			return;
		}
		
		state.active = true;
		
		// make a copy of the action, then merge it into our node state
		// (i.e. do not taint the node array with the action results)
		var action = Tools.copyHash(node.data, true);
		action.condition = opts.condition;
		
		this.logWorkflow(job, node.id, `Executing ${action.condition} action: ${action.type}`);
		
		self.runJobAction(job, action, function() {
			state.active = false;
			state.completed = Tools.timeNow();
			Tools.mergeHashInto(state, action);
			
			// tick workflow here, in case this was the final action
			self.tickWorkflow(job);
		});
	}
	
	/* {
		"id": "nc12eefd",
		"type": "controller",
		"data": {
			"controller": "multiplex",
			"stagger": 5,
			"continue": 100
		},
		"x": 235,
		"y": 180
	}, */
	
	runWFNode_controller(opts) {
		// run controller node
		var self = this;
		var { job, node, source } = opts;
		var workflow = job.workflow;
		var state = job.workflow.state[ node.id ];
		
		var type = node.data.controller;
		var func = 'runWFController_' + type;
		
		if (!this[func]) {
			// should never happen
			return this.abortJob(job, "Unknown controller type: " + type);
		}
		this[func](opts);
	}
	
	runWFController_multiplex(opts) {
		// run mutiplex controller
		var self = this;
		var { job, node, source } = opts;
		var workflow = job.workflow;
		var state = job.workflow.state[ node.id ];
		
		// find single node we need to control
		var conns = Tools.findObjects( workflow.connections, { source: node.id } );
		if (!conns.length) {
			// totally could happen
			this.logWorkflow(job, node.id, `WARNING: Multiplex controller node has no output connection: #${node.id}`);
			return;
		}
		if (conns.length > 1) {
			this.logWorkflow(job, node.id, `WARNING: Multiplex controller may only have a single output node (found ${conns.length})`);
			return;
		}
		var conn = conns[0];
		
		var dest = Tools.findObject( workflow.nodes, { id: conn.dest } );
		if (!dest) {
			// should never happen
			return this.abortJob(job, "Workflow node not found: #" + conn.dest);
		}
		
		// multiplex needs to support both event and job nodes
		// (targets are specified slightly differently between them)
		var targets = dest.data.targets || [];
		if (!targets.length && dest.data.event) {
			var event = Tools.findObject( this.events, { id: dest.data.event } );
			if (!event) {
				// should never happen
				return this.abortJob(job, `Event not found: ${dest.data.event} (Node #${dest.id})`);
			}
			targets = event.targets;
		}
		
		// expand targets to list of servers
		var server_ids = [];
		
		// gather all server candidates (targets may be groups and/or servers)
		(targets || []).forEach( function(target) {
			if (self.servers[target]) {
				server_ids.push(target);
				return;
			}
			
			var group = Tools.findObject( self.groups, { id: target } );
			if (!group) return;
			
			Object.values(self.servers).forEach( function(server) {
				if (server.groups.includes(group.id)) server_ids.push( server.id );
			} );
		} );
		
		// filter by actual online servers at the present moment
		server_ids = server_ids.filter( function(server_id) {
			return self.servers[server_id] && self.servers[server_id].enabled;
		} );
		
		// certain alerts being active may remove server from candidates
		server_ids = server_ids.filter( this.filterServerByAlerts.bind(this) );
		
		if (!server_ids.length) {
			// totally could happen
			return this.abortJob(job, `WARNING: No servers available for multiplex controller`);
		}
		
		// keep track of child jobs
		state.active = true;
		state.max = server_ids.length;
		state.count = 0;
		
		this.logWorkflow(job, node.id, `Launching ${server_ids.length} multiplex jobs for node: #${dest.id}`);
		
		// launch each job, overriding target, and passing along input, if applicable
		server_ids.forEach( function(server_id, idx) {
			var overrides = opts.overrides ? Tools.copyHash(opts.overrides, true) : {};
			overrides.targets = [ server_id ];
			
			// optionally stagger jobs using start_delay state
			if (node.data.stagger && idx) {
				overrides.state = 'start_delay';
				overrides.until = Tools.timeNow() + (node.data.stagger * idx);
			}
			
			self.runWorkflowNode({
				job: job,
				node: dest,
				source: node,
				overrides: overrides
			});
		} );
	}
	
	runWFController_repeat(opts) {
		// run repeat controller
		var self = this;
		var { job, node, source } = opts;
		var workflow = job.workflow;
		var state = job.workflow.state[ node.id ];
		
		// find single node we need to control
		var conns = Tools.findObjects( workflow.connections, { source: node.id } );
		if (!conns.length) {
			// totally could happen
			this.logWorkflow(job, node.id, `WARNING: Repeat controller node has no output connection: #${node.id}`);
			return;
		}
		if (conns.length > 1) {
			this.logWorkflow(job, node.id, `WARNING: Repeat controller may only have a single output node (found ${conns.length})`);
			return;
		}
		var conn = conns[0];
		
		var dest = Tools.findObject( workflow.nodes, { id: conn.dest } );
		if (!dest) {
			// should never happen
			return this.abortJob(job, "Workflow node not found: #" + conn.dest);
		}
		
		// keep track of child jobs
		state.active = true;
		state.max = node.data.repeat || 1;
		state.count = 0;
		
		this.logWorkflow(job, node.id, `Launching ${state.max} repeated jobs for node: #${dest.id}`);
		
		// launch all the jobs in "parallel" (they will queue up if configured)
		for (var idx = 0, len = state.max; idx < len; idx++) {
			var overrides = opts.overrides ? Tools.copyHash(opts.overrides, true) : {};
			self.runWorkflowNode({
				job: job,
				node: dest,
				source: node,
				overrides: overrides
			});
		}
	}
	
	runWFController_split(opts) {
		// run split controller
		var self = this;
		var { job, node, source } = opts;
		var workflow = job.workflow;
		var state = job.workflow.state[ node.id ];
		
		// split needs an input object to become the "context" of the user path eval
		if (!opts.overrides || !opts.overrides.input) {
			this.logWorkflow(job, node.id, `WARNING: Split controller has no input to split on.`);
			return;
		}
		
		var context = opts.overrides.input;
		var value = Tools.getPath(context, node.data.split);
		if (!value) {
			this.logWorkflow(job, node.id, `WARNING: Split data path does not point to an array: {${node.data.split}}`);
			return;
		}
		
		// allow user to point to a string, which is then trimmed and line-split
		if (typeof(value) == 'string') {
			value = value.trim().split(/\r?\n/);
		}
		
		if (!Array.isArray(value)) {
			this.logWorkflow(job, node.id, `WARNING: Split data path does not point to an array: {${node.data.split}}`);
			return;
		}
		
		if (!value.length) {
			this.logWorkflow(job, node.id, `WARNING: Split data array is empty: {${node.data.split}}`);
			return;
		}
		
		// find single node we need to control
		var conns = Tools.findObject( workflow.connections, { source: node.id } );
		if (!conns.length) {
			// totally could happen
			this.logWorkflow(job, node.id, `WARNING: Split controller node has no output connection: #${node.id}`);
			return;
		}
		if (conns.length > 1) {
			this.logWorkflow(job, node.id, `WARNING: Split controller may only have a single output node (found ${conns.length})`);
			return;
		}
		var conn = conns[0];
		
		var dest = Tools.findObject( workflow.nodes, { id: conn.dest } );
		if (!dest) {
			// should never happen
			return this.abortJob(job, "Workflow node not found: #" + conn.dest);
		}
		
		// keep track of child jobs
		state.active = true;
		state.max = value.length;
		state.count = 0;
		
		this.logWorkflow(job, node.id, `Launching ${state.max} split jobs for node: #${dest.id}`);
		
		// launch all the jobs in "parallel" (they will queue up if configured)
		value.forEach( function(item) {
			var overrides = Tools.copyHash(opts.overrides, true);
			
			if (node.data.split == 'files') {
				// special mode for splitting on files instead of data
				overrides.input.files = [ item ];
			}
			else {
				overrides.input.data = { item };
			}
			
			self.runWorkflowNode({
				job: job,
				node: dest,
				source: node,
				overrides: overrides
			});
		}); // foreach split item
	}
	
	runWFController_join(opts) {
		// run join controller
		var self = this;
		var { job, node, source } = opts;
		var workflow = job.workflow;
		var state = job.workflow.state[ node.id ];
		var details = this.jobDetails[job.id];
		
		if (!state.active) {
			// first connection coming in
			state.max = Tools.findObjects( workflow.connections, { dest: node.id } ).length;
			if (!state.max) {
				// should never happen
				this.logWorkflow(job, node.id, `WARNING: No incoming connections found for join controller.`);
				return;
			}
			state.active = true;
		} // first
		
		state.count++;
		this.logWorkflow(job, node.id, `Join controller progress: ${state.count}/${state.max} connections`);
		if (state.count < state.max) return;
		
		this.logWorkflow(job, node.id, `All input streams completed for join`);
		state.active = false;
		state.completed = Tools.timeNow();
		
		var overrides = {
			input: {
				files: [],
				data: {}
			}
		};
		
		// find all connections into us and join all job data (and files) to pass along
		Tools.findObjects( workflow.connections, { dest: node.id } ).forEach( function(conn) {
			// var source = Tools.findObject( workflow.nodes, { id: conn.source } );
			var jobs = workflow.jobs[ conn.source ];
			(jobs || []).forEach( function(stub) {
				if (stub.files && stub.files.length) overrides.input.files = overrides.input.files.concat(stub.files);
				if (details.wfJobData[stub.id]) Tools.mergeHashInto(overrides.input.data, details.wfJobData[stub.id]);
			} );
		} );
		
		// find single node we need to pass the torch to
		var conns = Tools.findObject( workflow.connections, { source: node.id } );
		if (!conns.length) {
			// totally could happen
			this.logWorkflow(job, node.id, `WARNING: Join controller has no output connection: #${node.id}`);
			return;
		}
		if (conns.length > 1) {
			this.logWorkflow(job, node.id, `WARNING: Join controller may only have a single output node (found ${conns.length})`);
			return;
		}
		var conn = conns[0];
		
		var dest = Tools.findObject( workflow.nodes, { id: conn.dest } );
		if (!dest) {
			// should never happen
			return this.abortJob(job, "Workflow node not found: #" + conn.dest);
		}
		
		self.runWorkflowNode({
			job: job,
			node: dest,
			source: node,
			overrides: overrides
		});
	}
	
	runWFController_decision(opts) {
		// run decision node
		var self = this;
		var { job, node, source } = opts;
		var workflow = job.workflow;
		var state = job.workflow.state[ node.id ];
		
		// decision needs an input object to become the "context" of the user eval
		if (!opts.overrides || !opts.overrides.input) {
			this.logWorkflow(job, node.id, `WARNING: Decision controller has no input data to eval on.`);
			return;
		}
		
		var context = opts.context || opts.overrides.input;
		var exp = node.data.decision;
		var value = false;
		this.logWorkflow(job, node.id, `Decision controller evaluating expression: {${exp}}`);
		
		try {
			value = jexl.evalSync( exp, context );
		}
		catch (err) {
			this.logWorkflow(job, node.id, `WARNING: Failed to evaluate decision expression: {${exp}}: ${err}`);
			return;
		}
		
		if (!value) {
			this.logWorkflow(job, node.id, `Expression evaluated to false: {${exp}}`);
			return;
		}
		
		this.logWorkflow(job, node.id, `Expression evaluated to true: {${exp}}`);
		
		// find all attached wires to controller as outputs
		var conns = Tools.findObjects( workflow.connections, { source: node.id });
		if (!conns.length) {
			// could totally happen
			this.logWorkflow(job, node.id, `Decision complete, no output connections found.`);
			return;
		}
		
		conns.forEach( function(conn) {
			var dest = Tools.findObject( workflow.nodes, { id: conn.dest } );
			if (!dest) {
				// should never happen
				self.logWorkflow(job, node.id, `WARNING: Target node not found for decision output: #${conn.dest}`);
				return;
			}
			self.runWorkflowNode({
				job: job,
				node: dest,
				source: node,
				overrides: opts.overrides
			});
		} );
		
		state.completed = Tools.timeNow();
	}
	
	finishWorkflowJob(sub_job) {
		// a workflow sub-job has finished (success or fail)
		var self = this;
		
		// job always refers to the parent workflow job
		var job = this.activeJobs[ sub_job.workflow.job ];
		if (!job) return; // sanity check
		
		var workflow = job.workflow;
		var details = this.jobDetails[job.id];
		
		// find the node for the sub-job that completed
		var node = Tools.findObject( workflow.nodes, { id: sub_job.workflow.node } );
		if (!node) {
			// should never happen
			return this.abortJob(job, "Workflow node not found: " + sub_job.workflow.node);
		}
		
		// vary log messaging based on result
		if (sub_job.code) {
			if (sub_job.code == 'abort') this.logWorkflow(job, node.id, `Job was aborted: #${sub_job.id}: ${sub_job.description}`);
			else this.logWorkflow(job, node.id, `Job has failed: #${sub_job.id}: ${sub_job.description} (${sub_job.code})`);
		}
		else {
			this.logWorkflow(job, node.id, `Job has completed successfully: #${sub_job.id}`);
		}
		
		// pass along data and files to wf state, and new nodes launched
		var overrides = {
			parent: sub_job.id,
			input: {
				data: Tools.copyHash( sub_job.data || {}, true ),
				files: Tools.copyHash( sub_job.files || [], true )
			}
		};
		
		// track completed job in workflow
		workflow.jobs[ node.id ].push({
			id: sub_job.id,
			code: sub_job.code,
			description: sub_job.description,
			server: sub_job.server || '',
			completed: sub_job.completed,
			elapsed: sub_job.elapsed,
			tags: Tools.copyHash( sub_job.tags || [], true ),
			files: overrides.input.files
		});
		
		// track data separately in details, to avoid syncing to clients
		details.wfJobData[sub_job.id] = overrides.input.data;
		
		// bubble up tags into top-level workflow job
		if (sub_job.tags && sub_job.tags.length) {
			if (!job.tags) job.tags = [];
			job.tags = job.tags.concat( sub_job.tags );
			
			// dedupe tags array
			job.tags = [...new Set(job.tags)];
		}
		
		// if top-level job is complete, exit now (don't run any actions or nodes)
		if (job.complete || job.workflow.aborted) return;
		
		// let controller know job finished, if applicable
		if (sub_job.workflow.launcher) {
			var launcher_node = Tools.findObject( workflow.nodes, { id: sub_job.workflow.launcher } );
			if (!launcher_node) {
				// should never happen
				return this.abortJob(job, "Workflow source node not found: " + sub_job.workflow.launcher);
			}
			if (launcher_node.type == 'controller') {
				// switch meaning of node/sub-node from here on in, as the context is now the controller node
				this.updateWorkflowController({ job, workflow, sub_node: node, sub_job, node: launcher_node });
			}
		}
		
		// compile a list of acceptable wire conditions based on job result
		var conditions = this.getCompletedJobConditions(sub_job);
		
		// run nodes connected to us (skip actions/limits, also skip continue condition, as it is handled elsewhere)
		// populate and pass along an `input` object in opts.overrides
		Tools.findObjects( workflow.connections, { source: node.id }).forEach( function(conn) {
			var dest = Tools.findObject( workflow.nodes, { id: conn.dest } );
			if (!dest) return; // should never happen
			if (dest.type.match(/^(action|limit)$/)) return; // skip these node types here
			if (!conn.condition || !conditions.includes(conn.condition)) return; // certain conditions apply
			
			self.logWorkflow(job, node.id, `Launching ${dest.type} node #${dest.id} via wire condition: ${conn.condition}`);
			self.runWorkflowNode({
				job: job,
				node: dest,
				overrides: Tools.copyHash(overrides, true),
				context: sub_job
			});
			
			if (!workflow.state[conn.id]) workflow.state[conn.id] = {};
			workflow.state[conn.id].completed = Tools.timeNow();
		} ); // foreach connection
		
		// tick the workflow in the next thread, to allow sub-job to finish completely
		process.nextTick( function() {
			// tick the workflow to see if it is finished
			self.tickWorkflow(job);
		} ); // tick
	}
	
	updateWorkflowController(opts) {
		// update controller after sub-job completion
		// node is now the controller node, sub_node is the event/job node
		var self = this;
		var { job, workflow, node, sub_job, sub_node } = opts;
		var state = workflow.state[ node.id ];
		
		if (!state) {
			// should never happen
			return this.abortJob(job, "Workflow state not found for controller node: " + node.id);
		}
		opts.state = state;
		
		var type = node.data.controller;
		var func = 'updateWFController_' + type;
		if (!this[func]) {
			// should never happen
			return this.abortJob(job, "Unknown controller type: " + type);
		}
		this[func](opts);
	}
	
	updateWFController_multiplex(opts) {
		// fire "continue" wire if all mutiplex jobs completed
		var self = this;
		var { job, workflow, node, state, sub_job, sub_node } = opts;
		
		// advance counter for each job completed
		state.count++;
		this.logWorkflow(job, node.id, `Multiplex progress: ${state.count}/${state.max} jobs completed`);
		if (state.count < state.max) return; // more jobs still running
		
		// controller is complete
		state.active = false;
		state.completed = Tools.timeNow();
		
		// launch connected nodes if continue percentage is met
		this.continueWFController(opts);
	}
	
	updateWFController_repeat(opts) {
		// update repeat controller after job completion
		var self = this;
		var { job, workflow, node, state, sub_job, sub_node } = opts;
		
		// advance counter for each job completed
		state.count++;
		this.logWorkflow(job, node.id, `Repeat progress: ${state.count}/${state.max} jobs completed`);
		if (state.count < state.max) return; // more jobs still running
		
		// controller is complete
		state.active = false;
		state.completed = Tools.timeNow();
		
		// launch connected nodes if continue percentage is met
		this.continueWFController(opts);
	}
	
	updateWFController_split(opts) {
		// update split controller after job completion
		var self = this;
		var { job, workflow, node, state, sub_job, sub_node } = opts;
		
		// advance counter for each job completed
		state.count++;
		this.logWorkflow(job, node.id, `Split progress: ${state.count}/${state.max} jobs completed`);
		if (state.count < state.max) return; // more jobs still running
		
		// controller is complete
		state.active = false;
		state.completed = Tools.timeNow();
		
		// launch connected nodes if continue percentage is met
		this.continueWFController(opts);
	}
	
	updateWFController_join(opts) {
		// update join controller after job completion
		var self = this;
		var { job, workflow, node, state, sub_job, sub_node } = opts;
		
		// no-op
	}
	
	updateWFController_decision(opts) {
		// update decision controller after job completion
		var self = this;
		var { job, workflow, node, state, sub_job, sub_node } = opts;
		
		// no-op
	}
	
	continueWFController(opts) {
		// fire "continue" wires if N%+ jobs completed successfully
		var self = this;
		var { job, workflow, node, state, sub_job, sub_node } = opts;
		
		// check continue percentage
		var min_pct = node.data.continue || 0;
		var num_success = 0;
		var ctrl_type = node.data.controller;
		
		workflow.jobs[ sub_node.id ].forEach( function(stub) {
			if (!stub.code) num_success++;
		} );
		
		var success_pct = Math.floor( (num_success / state.max) * 100 );
		
		if (success_pct < min_pct) {
			this.logWorkflow(job, node.id, `${num_success} (${success_pct}%) ${ctrl_type} jobs completed successfully, which is less than the minimum required continue percentage (${min_pct}%).`);
			return;
		}
		else if (num_success < state.max) {
			this.logWorkflow(job, node.id, `${num_success} (${success_pct}%) ${ctrl_type} jobs completed successfully, which satisfies the minimum required continue percentage (${min_pct}%).`);
		}
		else {
			this.logWorkflow(job, node.id, `All ${num_success} (${success_pct}%) ${ctrl_type} jobs completed successfully`);
		}
		
		// find all attached wires to event/job sub_node with "continue" condition
		var conns = Tools.findObjects( workflow.connections, { source: sub_node.id, condition: "continue" });
		if (!conns.length) {
			// could totally happen
			this.logWorkflow(job, node.id, `Controller complete, no continue connections found.`);
			return;
		}
		
		this.logWorkflow(job, node.id, `Controller complete, launching ${conns.length} continue nodes.`);
		
		conns.forEach( function(conn) {
			var dest = Tools.findObject( workflow.nodes, { id: conn.dest } );
			if (!dest) {
				// should never happen
				self.logWorkflow(job, node.id, `WARNING: Target node not found for continue: #${conn.dest}`);
				return;
			}
			self.runWorkflowNode({
				job: job,
				node: dest,
				condition: "continue" // for actions
			});
			
			// light up continue condition entity (cosmetic)
			if (!workflow.state[conn.id]) workflow.state[conn.id] = {};
			workflow.state[conn.id].completed = Tools.timeNow();
		} );
	}
	
	tickWorkflow(job) {
		// see if workflow has anything going on, otherwise end it
		var workflow = job.workflow;
		var state = workflow.state;
		var details = this.jobDetails[job.id];
		
		if (job.complete) return; // sanity
		job.updated = Tools.timeNow(); // keep job alive
		job.progress = 0;
		
		// check running jobs and track cpu/mem, as well as progress
		var num_active_jobs = 0;
		var cpu = 0;
		var mem = 0;
		var slots = {};
		
		// pre-sort completed jobs into node slots and create zeroed slots for jobs in progress
		for (var node_id in workflow.jobs) {
			var count = workflow.jobs[node_id].length;
			slots[node_id] = { count: count, progress: 1.0 * count };
		}
		
		// now check all active jobs
		Object.values(this.activeJobs).forEach( function(sub_job) {
			if (sub_job.workflow && sub_job.workflow.job && (sub_job.workflow.job == job.id)) {
				num_active_jobs++;
				if (sub_job.cpu) cpu += sub_job.cpu.current || 0;
				if (sub_job.mem) mem += sub_job.mem.current || 0;
				
				var slot = slots[ sub_job.workflow.node ];
				if (slot) {
					slot.count++;
					slot.progress += sub_job.progress || 0;
				}
			} // one of ours
		} ); // foreach job
		
		// compute final progress
		Object.values(slots).forEach( function(slot) {
			job.progress += (slot.progress / (slot.count || 1));
		} );
		job.progress /= (Tools.numKeys(slots) || 1);
		
		// populate cpu/mem based on our sub-jobs
		if (job.cpu) {
			if (cpu < job.cpu.min) job.cpu.min = cpu;
			if (cpu > job.cpu.max) job.cpu.max = cpu;
			job.cpu.total += cpu;
			job.cpu.count++;
			job.cpu.current = cpu;
		}
		else {
			job.cpu = { min: cpu, max: cpu, total: cpu, count: 1, current: cpu };
		}
		
		if (job.mem) {
			if (mem < job.mem.min) job.mem.min = mem;
			if (mem > job.mem.max) job.mem.max = mem;
			job.mem.total += mem;
			job.mem.count++;
			job.mem.current = mem;
		}
		else {
			job.mem = { min: mem, max: mem, total: mem, count: 1, current: mem };
		}
		
		if (num_active_jobs) return; // we still got stuff going on
		
		if (job.workflow.aborted) {
			// job was aborted, so use that code and description
			job.code = 'abort';
			job.description = job.workflow.aborted;
			delete job.workflow.aborted;
		}
		else {
			// not aborted, so also check nodes, as some may have an active state
			var num_active_nodes = 0;
			for (var key in state) {
				if (state[key].active) num_active_nodes++;
			}
			if (num_active_nodes) return; // nodes still active
			
			// okay, workflow is really done
			this.logWorkflow(job, null, `Workflow is complete`);
			
			// compute final result based on jobs
			var num_jobs = 0;
			var num_success = 0;
			
			for (var node_id in job.workflow.jobs) {
				job.workflow.jobs[node_id].forEach( function(sub_job) {
					num_jobs++;
					if (!sub_job.code) num_success++;
				} );
			}
			
			if (num_success == num_jobs) {
				job.code = 0;
				job.description = "Workflow completed successfully.";
			}
			else if (num_success) {
				job.code = 'warning';
				job.description = "Workflow completed, but one or more jobs failed.";
			}
			else {
				job.code = 1;
				job.description = "All workflow jobs failed.";
			}
		}
		
		// copy completed sub-job data and files into top-level job
		if (!job.data) job.data = {};
		if (!job.files) job.files = [];
		
		Object.values(workflow.jobs).forEach( function(jobs) {
			(jobs || []).forEach( function(stub) {
				if (stub.files && stub.files.length) job.files = job.files.concat(stub.files);
				if (details.wfJobData[stub.id]) Tools.mergeHashInto(job.data, details.wfJobData[stub.id]);
			} );
		} );
		
		// cleanup
		delete details.wfJobData;
		
		// and we're done
		job.complete = true;
		job.state = 'complete';
		this.finishJob(job);
	}
	
	abortWorkflow(job, reason) {
		// abort all sub-jobs and let parent job complete naturally
		var self = this;
		if (job.complete || job.workflow.aborted) return; // sanity check
		
		this.appendMetaLog(job, "Aborting Job: " + reason);
		this.logWorkflow(job, null, "Aborting workflow: " + reason);
		
		// prevent subsequent launches, and stash abort erason for later
		job.workflow.aborted = reason; 
		
		// abort all jobs
		var num_jobs = 0;
		Object.values(this.activeJobs).forEach( function(sub_job) {
			if (sub_job.workflow && sub_job.workflow.job && (sub_job.workflow.job == job.id) && !sub_job.complete) {
				self.logWorkflow(job, null, `Aborting workflow job: #${sub_job.id}`);
				self.abortJob(sub_job, reason);
				num_jobs++;
			} // one of ours
		} ); // foreach job
		
		// if no jobs were aborted, tick right now to save time
		if (!num_jobs) this.tickWorkflow(job);
	}
	
} // class Workflows

module.exports = Workflows;
