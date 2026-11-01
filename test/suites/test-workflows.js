const assert = require('node:assert/strict');
const fs = require('fs');
const Tools = require('pixl-tools');
const Workflows = require('../../lib/workflow');
const Jobs = require('../../lib/job');
const Util = require('../../lib/util');

// helper: sleep
async function sleep(ms) {
	await new Promise(res => setTimeout(res, ms));
}

// helper: poll internal jobs until specified job id disappears
async function waitForJob(ctx, job_id, opts = {}) {
	const timeout = opts.timeout || 20000;
	const interval = opts.interval || 250;
	const start = performance.now();
	
	while (performance.now() - start < timeout) {
		let { data } = await ctx.request.json(ctx.api_url + '/app/get_active_jobs/v1', {});
		if (data.code !== 0) throw new Error('get_active_jobs failed');
		if (!data.rows.find(r => r.id === job_id)) return;
		await sleep(interval);
	}
	
	throw new Error('Timed out waiting for job to finish');
}

// helper: wait for a specific workflow node job to be actively running
async function waitForActiveWorkflowNode(ctx, workflow_job_id, node_id, opts = {}) {
	const timeout = opts.timeout || 20000;
	const interval = opts.interval || 250;
	const start = performance.now();
	
	while (performance.now() - start < timeout) {
		let { data } = await ctx.request.json(ctx.api_url + '/app/get_active_jobs/v1', {
			state: 'active'
		});
		if (data.code !== 0) throw new Error('get_active_jobs failed');
		let job = data.rows.find(function(row) {
			return row.workflow && (row.workflow.job === workflow_job_id) && (row.workflow.node === node_id);
		});
		if (job) return job;
		await sleep(interval);
	}
	
	throw new Error('Timed out waiting for active workflow node: ' + node_id);
}

// helper: load workflow template from fixtures
function getWorkflow(name) {
	const data = JSON.parse( fs.readFileSync('test/fixtures/workflows/' + name + '.json') );
	return data.items[0].data;
}

// helper: exercise real completion and aggregation without storage or a satellite.
// Capture launches so each test can complete the downstream jobs explicitly.
function getWorkflowEngine(job, details) {
	return Object.assign(new Workflows(), {
		activeJobs: { [job.id]: job }, jobDetails: { [job.id]: details }, calls: [],
		getCompletedJobConditions: Jobs.prototype.getCompletedJobConditions,
		mergeConcatInto: Util.prototype.mergeConcatInto,
		logWorkflow() {},
		runWorkflowNode(opts) { this.calls.push(opts); },
		finishJob(completed) { this.finished = Tools.mergeHashes(completed, this.jobDetails[completed.id]); }
	});
}

// helper: finish a workflow with recorded child outcomes using the real calculator.
// Keep this independent of storage and the satellite so edge cases are inexpensive.
function getWorkflowResult(codes, opts = ['preserve_sev'], extra = {}) {
	const jobs = codes.map(function(code, idx) {
		return typeof(code) == 'object' ? code : { id: 'child' + idx, code, completed: idx + 1, description: 'Result ' + code };
	});
	const job = Object.assign({ id: 'parent', type: 'workflow', opts,
		workflow: { nodes: [], connections: [], state: {}, jobs: { worker: jobs } }
	}, extra);
	// A null fixture option represents a legacy workflow with no opts property.
	if (opts === null) delete job.opts;
	
	const engine = getWorkflowEngine(job, { workflowData: {}, wfJobData: {} });
	engine.tickWorkflow(job);
	return engine.finished;
}

exports.tests = [
	
	async function test_workflow_preserve_severity_results(test) {
		// Cover the reported Multiplex cases, each severity boundary, arbitrary
		// custom codes, and superseded retries. Legacy classification must survive.
		const cases = [
			{ name: 'all healthy', codes: [0, 0], code: 0, legacy: 0 },
			{ name: 'all warnings', codes: ['warning', 'warning', 'warning', 'warning'], code: 'warning', legacy: 1 },
			{ name: 'mixed warning', codes: [0, 'warning'], code: 'warning', legacy: 'warning' },
			{ name: 'failed host', codes: [0, 0, 0, 42], code: 42, legacy: 'warning' },
			{ name: 'custom string', codes: ['warning', 'check_failed'], code: 'check_failed', legacy: 1 },
			{ name: 'negative code', codes: ['warning', -1], code: -1, legacy: 1 },
			{ name: 'abort beats custom error', codes: [42, 'abort'], code: 'abort', legacy: 1 },
			{ name: 'critical beats abort', codes: ['abort', 'critical'], code: 'critical', legacy: 1 },
			{ name: 'critical beats all', codes: ['critical', 'abort', 42, 'warning', 0], code: 'critical', legacy: 'warning' },
			{ name: 'constructor is custom', codes: ['constructor', 'warning'], code: 'constructor', legacy: 1 },
			{ name: 'prototype name is custom', codes: ['__proto__'], code: '__proto__', legacy: 1 },
			{ name: 'successful retry', codes: [{ id: 'old', code: 'critical', retried: true }, { id: 'new', code: 0 }], code: 0, legacy: 0 },
			{ name: 'warning after retry', codes: [{ id: 'old', code: 'critical', retried: true }, { id: 'new', code: 'warning' }], code: 'warning', legacy: 1 },
			{ name: 'no executed jobs', codes: [], code: 0, legacy: 0 }
		];
		
		for (const opts of [null, [], ['preserve_sev']]) {
			for (const item of cases) {
				const result = getWorkflowResult(item.codes, opts);
				assert.equal(result.code, opts && opts.length ? item.code : item.legacy, item.name + ': opts=' + opts);
			}
		}
		
		// Output selection must not hide failures, even on intermediate nodes.
		// A successful housekeeping job on another node cannot dilute severity.
		for (const bubble of ['', 'leaf']) {
			const result = getWorkflowResult([], ['preserve_sev', 'isolate_data', 'isolate_tags'], {
				bubble, workflow: { nodes: [], connections: [], state: {}, jobs: {
					checks: [{ id: 'failed', code: 42, leaf: false, description: 'Check crashed' }],
					housekeeping: [{ id: 'noop', code: 0, leaf: true }]
				} }
			});
			assert.equal(result.code, 42, bubble + ': intermediate error survives a successful leaf');
			assert.equal(result.description, 'Job #failed: Check crashed', 'description identifies the selected job');
		}
	},
	
	async function test_workflow_preserve_severity_latest_completion(test) {
		// Node insertion order and job array order must not decide which equally
		// severe failure supplies the result. Fractional timestamps matter too.
		for (const [earlier_code, latest_code] of [
			['warning', 'warning'], [999, 42], ['abort', 'abort'],
			['critical', 'critical'], ['constructor', '__proto__']
		]) {
			for (const reverse_nodes of [false, true]) {
				for (const reverse_jobs of [false, true]) {
					const first_node = [
						{ id: 'earliest', code: earlier_code, completed: 100.1, description: 'Earliest finding' },
						{ id: 'latest', code: latest_code, completed: 100.3, description: 'Latest finding' }
					];
					const second_node = [{ id: 'middle', code: earlier_code, completed: 100.2, description: 'Middle finding' }];
					if (reverse_jobs) first_node.reverse();
					const jobs = reverse_nodes ? { second: second_node, first: first_node } : { first: first_node, second: second_node };
					
					// Later successes and superseded attempts must not displace the
					// latest final failure, even if the old attempt was critical.
					jobs.other = [
						{ id: 'retried', code: 'critical', completed: 101, retried: true },
						{ id: 'healthy', code: 0, completed: 102 }
					];
					const result = getWorkflowResult([], ['preserve_sev'], {
						workflow: { nodes: [], connections: [], state: {}, jobs }
					});
					assert.equal(result.code, latest_code, 'latest completion supplies the exact code within its severity class');
					assert.equal(result.description, 'Job #latest: Latest finding', 'attribution follows completion time, not traversal order');
				}
			}
		}
		
		// Recency breaks severity ties only. A newer, less severe result must
		// never replace an older result from a higher severity class.
		for (const [higher, lower] of [['critical', 'abort'], ['abort', 42], [42, 'warning']]) {
			const result = getWorkflowResult([
				{ id: 'higher', code: higher, completed: 100, description: 'Higher severity' },
				{ id: 'lower', code: lower, completed: 200, description: 'Later lower severity' }
			]);
			assert.equal(result.code, higher, 'severity takes precedence over completion time');
			assert.equal(result.description, 'Job #higher: Higher severity', 'description comes from the higher severity job');
		}
	},
	
	async function test_workflow_preserve_severity_equal_timestamps(test) {
		// Identical timestamps provide no chronological ordering. Keep the first
		// encountered candidate, including its own code and fallback description.
		for (const reverse of [false, true]) {
			const children = [
				{ id: 'first', code: 42, completed: 100, description: 'First finding' },
				{ id: 'second', code: 'check_failed', completed: 100, description: '' }
			];
			if (reverse) children.reverse();
			const result = getWorkflowResult(children);
			assert.equal(result.code, children[0].code, 'an equal timestamp does not replace the selected job');
			assert.equal(result.description, 'Job #' + children[0].id + ': ' + (children[0].description || 'No description provided.'),
				'attribution and fallback remain attached to the selected job');
		}
	},
	
	async function test_workflow_preserve_severity_descriptions(test) {
		// All result classes provide attribution, including custom codes which
		// happen to share names with Object.prototype properties.
		for (const code of ['warning', 42, 'abort', 'critical', 'constructor', '__proto__']) {
			for (const description of [undefined, null, '', 'Pending upgrades']) {
				const result = getWorkflowResult([{ id: 'hostcheck', code, description }]);
				assert.equal(result.code, code, 'the exact selected code is retained');
				assert.equal(result.description, 'Job #hostcheck: ' + (description || 'No description provided.'),
					code + ': original description or fallback follows the job ID');
			}
		}
	},
	
	async function test_workflow_preserve_severity_cancellation(test) {
		// Explicit workflow cancellation always wins, even over a critical child.
		const cancelled = getWorkflowResult([], ['preserve_sev'], { workflow: {
			nodes: [], connections: [], state: {}, aborted: 'Cancelled by operator',
			jobs: { worker: [{ id: 'critical', code: 'critical', description: 'Disk failed' }] }
		} });
		assert.equal(cancelled.code, 'abort', 'workflow cancellation overrides child severity');
		assert.equal(cancelled.description, 'Cancelled by operator', 'cancellation retains its own reason');
		
		// Controllers can fail without launching a job. These must not be hidden
		// by the new option, either alone or alongside successful child jobs.
		for (const jobs of [[], [{ id: 'healthy', code: 0 }]]) {
			const result = getWorkflowResult([], ['preserve_sev'], { workflow: {
				nodes: [], connections: [], state: { controller: { error: true } }, jobs: { worker: jobs }
			} });
			assert.equal(result.code, 'warning', 'controller errors retain their existing warning classification');
			assert.match(result.description, /nodes generated warnings/, 'controller problem remains visible');
		}
		
		// An inherited abort is a real abort result for downstream conditions and
		// retry policy. Only forced retries should retry an ordinary child abort.
		for (const force of [false, true]) {
			const job = getWorkflowResult(['abort']);
			job.limits = [{ type: 'retry', enabled: true, amount: 1, force }];
			let retry;
			const engine = Object.assign(new Jobs(), {
				jobDetails: {}, appendMetaLog() {}, logJob() {},
				launchJob(next, callback) { retry = next; callback(null, 'retry'); }
			});
			assert.deepEqual(engine.getCompletedJobConditions(job), ['complete', 'error', 'abort'], 'abort conditions apply');
			engine.checkRetryJob(job);
			assert.equal(!!retry, force, 'inherited abort respects forced-retry policy');
			if (retry) assert.deepEqual(retry.opts, ['preserve_sev'], 'forced retry retains the option');
		}
	},
	
	async function test_workflow_preserve_severity_nested(test) {
		// Pass completed inner workflows through the actual parent notification
		// path. Both levels must opt in; a parent's flag cannot repair an inner
		// workflow that already collapsed warnings or custom errors to code 1.
		for (const inner_enabled of [false, true]) {
			for (const outer_enabled of [false, true]) {
				for (const code of ['warning', 42, 'critical']) {
					const parent = { id: 'outer', type: 'workflow', opts: outer_enabled ? ['preserve_sev'] : [],
						workflow: { nodes: [{ id: 'inner_node', type: 'event' }], connections: [], state: {}, jobs: { inner_node: [] } } };
					const engine = getWorkflowEngine(parent, { workflowData: {}, wfJobData: {} });
					const child = { id: 'inner', type: 'workflow', opts: inner_enabled ? ['preserve_sev'] : [], workflow: {
						job: parent.id, node: 'inner_node', nodes: [], connections: [], state: {},
						jobs: { checks: [{ id: 'hostcheck', code, description: 'Host finding' }] }
					} };
					engine.activeJobs.inner = child;
					engine.jobDetails.inner = { workflowData: {}, wfJobData: {} };
					const finished = {};
					engine.finishJob = function(job) {
						const completed = finished[job.id] = Tools.mergeHashes(job, this.jobDetails[job.id]);
						delete this.activeJobs[job.id];
						delete this.jobDetails[job.id];
						if (job.workflow.job) this.finishWorkflowJob(completed);
					};
					engine.tickWorkflow(child);
					await new Promise(resolve => setImmediate(resolve));
					assert.equal(finished.inner.code, inner_enabled ? code : 1, 'inner policy determines its own result');
					assert.equal(finished.outer.code, inner_enabled && outer_enabled ? code : 1, 'each level applies its own policy');
					if (inner_enabled && outer_enabled) {
						assert.equal(finished.outer.description, 'Job #inner: Job #hostcheck: Host finding', 'attribution survives nesting');
					}
				}
			}
		}
	},
	
	async function test_workflow_first_abort(test) {
		// Drive the real workflow abort lifecycle. A final failure cancels sibling
		// work and controllers before normal error wires or continuations can run.
		// Successful jobs and superseded retry attempts must not abort the workflow.
		for (const bubble of ['', 'leaf']) {
			for (const opts of [[], ['first_abort'], ['preserve_sev'], ['first_abort', 'preserve_sev']]) {
				const enabled = opts.includes('first_abort');
				for (const retried of [false, true]) {
					for (const code of [0, 1, 'warning', 'critical', 'abort']) {
						const label = 'bubble=' + bubble + ', opts=' + opts + ', retried=' + retried + ', code=' + code;
						const parent = { id: 'parent', type: 'workflow', state: 'active', bubble, opts,
							workflow: {
								nodes: [{ id: 'worker', type: 'job' }, { id: 'handler', type: 'job' }, { id: 'controller', type: 'controller' }],
								connections: [{ source: 'worker', dest: 'handler', condition: 'error' }],
								state: { controller: { active: true } }, jobs: { worker: [], handler: [] }
							} };
						const sibling = { id: 'sibling', type: 'adhoc', state: 'queued', workflow: { job: 'parent', node: 'worker' } };
						const details = { wfJobData: {}, workflowData: {} };
						const engine = getWorkflowEngine(parent, details);
						engine.activeJobs.sibling = sibling;
						engine.appendMetaLog = function() {};
						engine.logJob = function() {};
						engine.abortJob = Jobs.prototype.abortJob;
						engine.finishJob = function(job) {
							delete this.activeJobs[job.id];
							if (job.workflow.job) this.finishWorkflowJob(job);
							else this.finished = Tools.mergeHashes(job, details);
						};
						engine.finishWorkflowJob({ id: 'completed', code, retried, workflow: { job: 'parent', node: 'worker' },
							data: { result: 'completed' } });
						
						if (enabled && code && !retried) {
							assert.ok(parent.workflow.aborted, label + ': failure begins workflow abort');
							assert.ok(!engine.activeJobs.sibling, label + ': queued sibling is cancelled');
							assert.equal(parent.workflow.state.controller.active, false, label + ': controllers stop');
							assert.equal(engine.calls.length, 0, label + ': error handler does not launch');
							assert.equal(parent.workflow.jobs.worker[1].code, 'abort', label + ': sibling cancellation is recorded');
							
							// The periodic monitor performs this tick after cancellation.
							engine.tickWorkflow(parent);
							assert.equal(engine.finished.code, 'abort', label + ': workflow finishes with abort status');
						}
						else {
							assert.ok(!parent.workflow.aborted, label + ': workflow remains active');
							assert.ok(engine.activeJobs.sibling, label + ': sibling keeps running');
							assert.equal(engine.calls.length, code && !retried ? 1 : 0, label + ': normal error routing is preserved');
						}
						await new Promise(resolve => setImmediate(resolve));
					}
				}
			}
		}
	},
	
	async function test_workflow_leaf_conditions(test) {
		// Expected eligibility follows each job's result, including when the same
		// graph node is reused. Legacy workflows ignore these distinctions.
		const cases = [
			{ name: 'terminal success', leaf: true },
			{ name: 'terminal failure', code: 1, leaf: true },
			{ name: 'success continues', condition: 'success', leaf: false },
			{ name: 'failure stops before success wire', code: 1, condition: 'success', leaf: true },
			{ name: 'success stops before error handler', condition: 'error', leaf: true },
			{ name: 'failure launches error handler', code: 1, condition: 'error', leaf: false },
			{ name: 'complete on success', condition: 'complete', leaf: false },
			{ name: 'complete on failure', code: 1, condition: 'complete', leaf: false },
			{ name: 'warning matches', code: 'warning', condition: 'warning', leaf: false },
			{ name: 'critical matches', code: 'critical', condition: 'critical', leaf: false },
			{ name: 'abort matches', code: 'abort', condition: 'abort', leaf: false },
			{ name: 'different error stops', code: 'critical', condition: 'warning', leaf: true },
			{ name: 'custom tag matches', condition: 'tag:chosen', tags: ['chosen'], leaf: false },
			{ name: 'custom tag missing', condition: 'tag:chosen', leaf: true },
			{ name: 'event continues', condition: 'success', dest: 'event', leaf: false },
			{ name: 'controller continues', condition: 'success', dest: 'controller', leaf: false },
			{ name: 'action attachment', condition: 'success', dest: 'action', leaf: true },
			{ name: 'limit attachment', condition: 'complete', dest: 'limit', leaf: true },
			{ name: 'continue action attachment', condition: 'continue', dest: 'action', leaf: true },
			{ name: 'continue reserves output', condition: 'continue', leaf: false },
			{ name: 'continue after failure', code: 1, condition: 'continue', leaf: false },
			{ name: 'continue to controller', condition: 'continue', dest: 'controller', leaf: false },
			{ name: 'resume redirect', redirect: 'next', leaf: false }
		];
		
		for (const mode of [undefined, '', 'leaf']) {
			const job = { id: 'parent', bubble: mode };
			const engine = getWorkflowEngine(job, {});
			for (const item of cases) {
				const node = { id: 'worker', type: 'job' };
				const workflow = { nodes: [node, { id: 'next', type: item.dest || 'job' }],
					connections: item.condition ? [{ source: 'worker', dest: 'next', condition: item.condition }] : [] };
				const sub_job = { code: item.code || 0, tags: item.tags || [], workflow: {} };
				if (item.redirect) sub_job.workflow.redirect = item.redirect;
				
				assert.equal(engine.isWorkflowLeafNode({ job, node, workflow, sub_job }), mode == 'leaf' ? item.leaf : true,
					String(mode) + ': ' + item.name);
			}
		}
	},
	
	async function test_workflow_leaf_split_results(test) {
		// A single Split-controlled node runs 20 jobs. Only the failed jobs take
		// the error-handler wire, so successful jobs and handler jobs are leaves.
		for (const mode of [undefined, '', 'leaf']) {
			const split = { id: 'split', type: 'controller', data: { controller: 'split', split: 'data.items' } };
			const worker = { id: 'worker', type: 'job' };
			const handler = { id: 'handler', type: 'job' };
			const parent = { id: 'parent', bubble: mode, workflow: {
				nodes: [split, worker, handler], state: { split: {} }, jobs: { worker: [], handler: [] },
				connections: [
					{ id: 'splitWorker', source: 'split', dest: 'worker' },
					{ id: 'errorHandler', source: 'worker', dest: 'handler', condition: 'error' }
				]
			} };
			const details = { workflowData: {}, wfJobData: {} };
			const engine = getWorkflowEngine(parent, details);
			engine.runWFController_split({ job: parent, node: split, overrides: { input: {
				data: { items: Array.from({ length: 20 }, (_, idx) => idx) }
			} } });
			assert.equal(engine.calls.length, 20, 'Split launches all 20 workers');
			
			// Superseded attempts must neither advance the controller nor export
			// their data, files, tags, or display content in either bubbling mode.
			engine.finishWorkflowJob({ id: 'retry', code: 1, retried: true,
				workflow: { job: 'parent', node: 'worker', launcher: 'split' },
				data: { results: ['retry'] }, files: [{ filename: 'retry.txt' }],
				tags: ['retry'], table: { title: 'Retry' }, html: { content: 'Retry' }
			});
			assert.equal(parent.workflow.state.split.count, 0, 'retry does not advance Split');
			assert.equal(engine.calls.length, 20, 'retry does not launch the error handler');
			assert.ok(!parent.table && !parent.html && !parent.tags, 'retry exports no tags or content');
			
			const worker_jobs = engine.calls.slice().map(function(call, idx) {
				assert.equal(call.overrides.input.data.item, idx, 'worker receives its Split item');
				return { id: 'worker' + idx, code: idx < 13 ? 0 : 1,
					workflow: { job: 'parent', node: 'worker', launcher: 'split' },
					data: { results: ['worker' + idx] }, files: [{ filename: 'worker' + idx + '.txt' }],
					tags: ['worker' + idx, idx < 13 ? '_success' : '_error'],
					table: { title: 'worker' + idx }, html: { content: 'worker' + idx },
					workflowData: { last_worker: idx }
				};
			});
			worker_jobs.forEach(job => engine.finishWorkflowJob(job));
			assert.equal(parent.table.title, mode == 'leaf' ? 'worker12' : 'worker19', 'only eligible workers update table');
			assert.equal(parent.html.content, mode == 'leaf' ? 'worker12' : 'worker19', 'only eligible workers update HTML');
			assert.equal(details.workflowData.last_worker, 19, 'intermediate jobs still update shared data');
			
			const handlers = engine.calls.slice(20);
			assert.equal(handlers.length, 7, 'only failed workers launch error handlers');
			handlers.forEach(function(call, idx) {
				assert.equal(call.node.id, 'handler', 'failed worker takes the handler wire');
				assert.deepEqual(call.overrides.input, { data: worker_jobs[idx + 13].data, files: worker_jobs[idx + 13].files },
					'non-leaf output still reaches its error handler');
				engine.finishWorkflowJob({ id: 'handler' + idx, code: 0, workflow: { job: 'parent', node: 'handler' },
					data: { results: ['handler' + idx] }, files: [{ filename: 'handler' + idx + '.txt' }],
					tags: ['handler' + idx], table: { title: 'handler' + idx }, html: { content: 'handler' + idx }
				});
			});
			
			// Let the real completion ticks collect the results after all modeled
			// downstream jobs have finished, without launching any external work.
			await new Promise(resolve => setImmediate(resolve));
			const ids = worker_jobs.slice(0, mode == 'leaf' ? 13 : 20).map(job => job.id)
				.concat(Array.from({ length: 7 }, (_, idx) => 'handler' + idx));
			assert.deepEqual(details.data, { results: ids, last_worker: 19 }, 'workflow exports only eligible results plus shared data');
			assert.deepEqual(details.files, ids.map(id => ({ filename: id + '.txt' })), 'files follow the same eligibility');
			assert.deepEqual(parent.tags, ids, 'user tags follow eligibility and system tags stay excluded');
			assert.equal(parent.table.title, 'handler6', 'latest eligible table wins');
			assert.equal(parent.html.content, 'handler6', 'latest eligible HTML wins');
			assert.equal(parent.workflow.jobs.worker.filter(stub => !stub.retried && stub.leaf).length, mode == 'leaf' ? 13 : 20,
				'eligibility is stored separately for each completed worker');
			assert.equal(parent.code, 'warning', 'non-leaf failures still affect workflow status');
		}
	},
	
	async function test_workflow_leaf_continue(test) {
		// Continue wires reserve every worker's output for downstream processing,
		// including when a success threshold prevents the continuation entirely.
		const cases = [
			{ name: 'all successful', codes: [0, 0, 0], percentage: 100, continues: true },
			{ name: 'partial success blocked', codes: [0, 1, 0], percentage: 100, continues: false },
			{ name: 'partial success allowed', codes: [0, 1, 0], percentage: 0, continues: true },
			{ name: 'all failed blocked', codes: [1, 1, 1], percentage: 100, continues: false },
			{ name: 'all failed allowed', codes: [1, 1, 1], percentage: 0, continues: true }
		];
		
		for (const type of ['split', 'repeat', 'multiplex']) {
			for (const item of cases) {
				const label = type + ': ' + item.name;
				const controller = { id: 'controller', type: 'controller', data: { controller: type, continue: item.percentage } };
				const worker = { id: 'worker', type: 'job' };
				const join = { id: 'join', type: 'controller', data: { controller: 'join' } };
				const parent = { id: 'parent', bubble: 'leaf', tags: ['parent'], workflow: {
					nodes: [controller, worker, join, { id: 'final', type: 'job' }],
					state: { controller: { active: true, max: 3, count: 0 }, join: {} }, jobs: { worker: [], final: [] },
					connections: [
						{ id: 'workerJoin', source: 'worker', dest: 'join', condition: 'continue' },
						{ id: 'joinFinal', source: 'join', dest: 'final' }
					]
				} };
				const details = { workflowData: {}, wfJobData: {} };
				const engine = getWorkflowEngine(parent, details);
				const outputs = item.codes.map((code, idx) => ({ results: [idx] }));
				item.codes.forEach(function(code, idx) {
					engine.finishWorkflowJob({ id: 'worker' + idx, code, workflow: { job: 'parent', node: 'worker', launcher: 'controller' },
						data: outputs[idx], files: [{ filename: 'worker' + idx + '.txt' }], tags: ['worker' + idx],
						table: { title: 'worker' + idx }, html: { content: 'worker' + idx }
					});
				});
				assert.ok(parent.workflow.jobs.worker.every(stub => stub.leaf === false), label + ': no worker is a leaf');
				assert.deepEqual(parent.tags, ['parent'], label + ': worker tags stay local');
				assert.ok(!parent.table && !parent.html && !parent.redraw, label + ': worker display content stays local');
				assert.equal(engine.calls.length, item.continues ? 1 : 0, label + ': continuation respects the threshold');
				
				if (item.continues) {
					assert.equal(engine.calls[0].node.id, 'join', label + ': Continue launches Join once');
					engine.runWFController_join({ job: parent, node: join });
					const input = engine.calls[1].overrides.input;
					assert.deepEqual(input.data.items, outputs, label + ': Join retains every non-leaf worker result');
					assert.deepEqual(input.files, item.codes.map((code, idx) => ({ filename: 'worker' + idx + '.txt' })),
						label + ': Join retains worker files');
					assert.equal(input.data.percentage, item.codes.filter(code => !code).length / 3 * 100,
						label + ': Join counts every worker outcome');
					engine.finishWorkflowJob({ id: 'final', code: 0, workflow: { job: 'parent', node: 'final' },
						data: { final: true }, files: [{ filename: 'final.txt' }], tags: ['final'],
						table: { title: 'Final' }, html: { content: 'Final' }
					});
				}
				
				await new Promise(resolve => setImmediate(resolve));
				assert.deepEqual(details.data, item.continues ? { final: true } : {}, label + ': workers never enter workflow output');
				assert.deepEqual(details.files, item.continues ? [{ filename: 'final.txt' }] : [], label + ': workers never export files');
				assert.deepEqual(parent.tags, item.continues ? ['parent', 'final'] : ['parent'], label + ': only final tags bubble');
				assert.deepEqual(parent.table, item.continues ? { title: 'Final' } : undefined, label + ': only final table bubbles');
				assert.deepEqual(parent.html, item.continues ? { content: 'Final' } : undefined, label + ': only final HTML bubbles');
				assert.ok(engine.finished, label + ': workflow completes');
			}
		}
	},
	
	async function test_workflow_leaf_legacy_stubs(test) {
		// Workflows recovered during an upgrade may contain pre-feature stubs.
		// Missing eligibility preserves their output without promoting false flags
		// or superseded attempts, even alongside newly completed leaf jobs.
		for (const mode of [undefined, '', 'leaf']) {
			const parent = { id: 'parent', bubble: mode, workflow: { nodes: [], connections: [], state: {}, jobs: { worker: [
				{ id: 'old', code: 0, files: [{ filename: 'old.txt' }] },
				{ id: 'leaf', code: 0, leaf: true, files: [{ filename: 'leaf.txt' }] },
				{ id: 'intermediate', code: 0, leaf: false, files: [{ filename: 'intermediate.txt' }] },
				{ id: 'retry', code: 1, retried: true, files: [{ filename: 'retry.txt' }] }
			] } } };
			const details = { data: { results: ['parent'] }, files: [{ filename: 'parent.txt' }],
				workflowData: { shared: true }, wfJobData: {
					old: { results: ['old'] }, leaf: { results: ['leaf'] },
					intermediate: { results: ['intermediate'] }, retry: { results: ['retry'] }
				} };
			const engine = getWorkflowEngine(parent, details);
			engine.tickWorkflow(parent);
			assert.deepEqual(details.data, { results: ['parent', 'old', 'leaf'], shared: true }, 'old results remain eligible');
			assert.deepEqual(details.files, ['parent', 'old', 'leaf'].map(id => ({ filename: id + '.txt' })), 'old files remain eligible');
			assert.equal(parent.workflow.jobs.worker[0].leaf, true, 'missing leaf defaults to true');
			assert.equal(parent.workflow.jobs.worker[2].leaf, false, 'explicit false stays excluded');
			assert.equal(parent.code, 0, 'superseded retry does not affect workflow result');
		}
	},
	
	async function test_workflow_leaf_isolation(test) {
		// Existing isolation options remain additional filters on eligible leaf
		// outputs. Non-leaf outputs never bypass either filter or lose forwarding.
		const options = ['isolate_data', 'isolate_files', 'isolate_tags', 'isolate_content'];
		for (const leaf of [true, false]) {
			for (let mask = 0; mask < 16; mask++) {
				const opts = options.filter((option, idx) => mask & (1 << idx));
				const label = 'leaf=' + leaf + ': ' + opts.join(',');
				const parent = { id: 'parent', bubble: 'leaf', opts, tags: ['parent'], table: { title: 'Parent' }, html: { content: 'Parent' },
					workflow: { nodes: [{ id: 'child', type: 'job' }, { id: 'next', type: 'job' }], state: {}, jobs: { child: [] },
						connections: leaf ? [] : [{ source: 'child', dest: 'next', condition: 'success' }] } };
				const details = { workflowData: {}, wfJobData: {} };
				const engine = getWorkflowEngine(parent, details);
				const child = { id: 'child', code: 0, workflow: { job: 'parent', node: 'child' },
					data: { child: true }, files: [{ filename: 'child.txt' }], tags: ['child', '_success'],
					table: { title: 'Child' }, html: { content: 'Child' }, workflowData: { shared: true } };
				engine.finishWorkflowJob(child);
				assert.equal(engine.calls.length, leaf ? 0 : 1, label + ': normal forwarding still occurs');
				if (!leaf) assert.deepEqual(engine.calls[0].overrides.input, { data: child.data, files: child.files },
					label + ': intermediate output reaches the next node');
				
				await new Promise(resolve => setImmediate(resolve));
				const data = { shared: true };
				if (leaf && !opts.includes('isolate_data')) data.child = true;
				assert.deepEqual(details.data, data, label + ': data obeys eligibility and isolation');
				assert.deepEqual(details.files, leaf && !opts.includes('isolate_files') ? child.files : [], label + ': files obey both filters');
				assert.deepEqual(parent.tags, leaf && !opts.includes('isolate_tags') ? ['parent', 'child'] : ['parent'], label + ': tags obey both filters');
				assert.deepEqual(parent.table, leaf && !opts.includes('isolate_content') ? child.table : { title: 'Parent' }, label + ': table obeys both filters');
				assert.deepEqual(parent.html, leaf && !opts.includes('isolate_content') ? child.html : { content: 'Parent' }, label + ': HTML obeys both filters');
			}
		}
	},
	
	async function test_workflow_isolation_bubbling(test) {
		// Exercise every combination, plus legacy workflows with no opts field.
		// Keep all-node bubbling here to preserve legacy isolation coverage.
		const options = ['isolate_data', 'isolate_files', 'isolate_tags', 'isolate_content'];
		const selections = [undefined].concat( Array.from({ length: 16 }, function(value) {
			return options.filter((option, idx) => value & (1 << idx));
		}) );
		
		for (const opts of selections) {
			for (const lifecycle of ['success', 'abort', 'nested']) {
				const isolated = new Set(opts || []);
				const label = (opts === undefined ? 'legacy' : opts.join(',') || 'none') + ': ' + lifecycle;
				const join = { id: 'join', type: 'controller', data: { controller: 'join' } };
				const parent = {
					id: 'parent', tags: ['parent_tag', 'shared_tag'], redraw: 'original',
					table: { title: 'Parent table' }, html: { content: 'Parent HTML' },
					workflow: { state: { join: {} }, jobs: { leaf: [] },
						nodes: [{ id: 'leaf', type: 'job' }, join, { id: 'next', type: 'job' }],
						connections: [
							{ id: 'tagwire', source: 'leaf', dest: 'next', condition: 'tag:child_tag' },
							{ id: 'joinwire', source: 'leaf', dest: 'join', condition: 'continue' },
							{ id: 'outputwire', source: 'join', dest: 'next' }
						]
					}
				};
				if (opts !== undefined) parent.opts = opts;
				if (lifecycle == 'nested') parent.workflow.job = 'outer';
				const parent_file = { filename: 'parent.txt' };
				const shared = { shared: true };
				const details = { data: { parent_only: true, values: ['parent'] }, files: [parent_file],
					workflowData: shared, wfJobData: {} };
				const calls = [];
				let finished = false;
				const engine = Object.assign(new Workflows(), {
					activeJobs: { parent }, jobDetails: { parent: details },
					mergeConcatInto: Util.prototype.mergeConcatInto,
					getCompletedJobConditions: Jobs.prototype.getCompletedJobConditions,
					logWorkflow() {}, runWorkflowNode(call) { calls.push(call); },
					finishJob() { finished = true; }
				});
				const child = { id: 'child', code: 0, workflow: { job: 'parent', node: 'leaf' },
					data: { result: 'child', values: ['child'] }, files: [{ filename: 'child.txt' }],
					tags: ['child_tag', 'shared_tag', '_success'],
					table: { title: 'Child table' }, html: { content: 'Child HTML' },
					workflowData: { updated: true }
				};
				
				// A superseded attempt must contribute no ordinary output or content,
				// even when all isolation options are disabled.
				engine.finishWorkflowJob({ ...child, id: 'retry', code: 1, retried: true,
					data: { retry_only: true }, files: [{ filename: 'retry.txt' }],
					tags: ['retry_tag'], table: { title: 'Retry table' }, html: { content: 'Retry HTML' }
				});
				assert.equal(calls.length, 0, label + ': retry does not continue flow');
				assert.deepEqual(parent.tags, ['parent_tag', 'shared_tag'], label + ': retry does not bubble tags');
				assert.equal(parent.redraw, 'original', label + ': retry does not bubble content');
				
				engine.finishWorkflowJob(child);
				assert.equal(calls.length, 1, label + ': child tag condition still fires');
				assert.deepEqual(calls[0].overrides.input, { data: child.data, files: child.files }, label + ': downstream receives output');
				assert.notEqual(calls[0].overrides.input.data, child.data, label + ': downstream data is copied');
				assert.deepEqual(parent.tags, isolated.has('isolate_tags') ? ['parent_tag', 'shared_tag'] : ['parent_tag', 'shared_tag', 'child_tag'], label + ': user tags bubble selectively and deduplicate');
				assert.deepEqual(parent.table, isolated.has('isolate_content') ? { title: 'Parent table' } : child.table, label + ': table isolation');
				assert.deepEqual(parent.html, isolated.has('isolate_content') ? { content: 'Parent HTML' } : child.html, label + ': HTML isolation');
				assert.equal(parent.redraw == 'original', isolated.has('isolate_content'), label + ': redraw only when content bubbles');
				
				// Join uses the retained per-job results, independently of what the
				// workflow will export, and continues to exclude retry attempts.
				engine.runWFController_join({ job: parent, node: join });
				assert.deepEqual(calls[1].overrides.input, {
					data: { items: [child.data], combined: child.data, percentage: 100 }, files: child.files
				}, label + ': Join retains child data and files');
				if (lifecycle == 'abort') parent.workflow.aborted = 'Test abort';
				
				// Allow the real completion callback scheduled by finishWorkflowJob.
				await new Promise(resolve => setImmediate(resolve));
				assert.ok(finished, label + ': workflow finishes');
				const expected = isolated.has('isolate_data') ? { parent_only: true, values: ['parent'] } :
					{ parent_only: true, result: 'child', values: ['parent', 'child'] };
				if (lifecycle != 'nested') Object.assign(expected, shared);
				assert.deepEqual(details.data, expected, label + ': output data isolation preserves parent data');
				assert.deepEqual(details.files, [parent_file].concat(isolated.has('isolate_files') ? [] : child.files), label + ': file isolation preserves parent files');
				assert.equal(shared.updated, true, label + ': workflowData updates remain shared');
				assert.equal(details.workflowData, lifecycle == 'nested' ? shared : undefined, label + ': shared data promotion follows workflow scope');
				assert.equal(parent.code, lifecycle == 'abort' ? 'abort' : 0, label + ': isolation does not change workflow status');
			}
		}
	},
	
	async function test_workflow_settings_independent(test) {
		// Every workflow keeps its own options and bubbling mode. Exercise missing,
		// empty, and populated settings across two nested generations without
		// allowing a parent's isolation or first-abort policy to leak into a child.
		const cases = [
			{ name: 'both absent' },
			{ name: 'parent absent', child: ['isolate_files'] },
			{ name: 'child absent', parent: ['isolate_data'] },
			{ name: 'both empty', parent: [], child: [] },
			{ name: 'parent empty', parent: [], child: ['isolate_files'] },
			{ name: 'child empty', parent: ['isolate_data'], child: [] },
			{ name: 'overlapping options', parent: ['isolate_data', 'isolate_tags', 'isolate_content'],
				child: ['isolate_data', 'isolate_files'] },
			{ name: 'parent abort policy', parent: ['first_abort'], child: [] },
			{ name: 'child abort policy', parent: [], child: ['first_abort'] },
			{ name: 'parent severity policy', parent: ['preserve_sev'], child: [] },
			{ name: 'child severity policy', parent: [], child: ['preserve_sev'] }
		];
		
		for (const parent_bubble of [undefined, '', 'leaf']) {
			for (const child_bubble of [undefined, '', 'leaf']) {
				for (const item of cases) {
					const label = item.name + ': parent=' + parent_bubble + ', child=' + child_bubble;
					const event = { id: 'nested', title: 'Nested', bubble: child_bubble, params: {}, actions: [], limits: [],
						triggers: [{ id: 'manual', type: 'manual', enabled: true }], workflow: { nodes: [], connections: [] } };
					const parent = { id: 'parent', bubble: parent_bubble, workflow: { state: { nested: {} }, jobs: {}, connections: [] } };
					if (item.child !== undefined) event.opts = Object.freeze(item.child.slice());
					if (item.parent !== undefined) parent.opts = Object.freeze(item.parent.slice());
					const children = [];
					const engine = Object.assign(new Workflows(), {
						events: [event], jobDetails: { parent: { workflowData: {} } },
						config: { get() { return 1000; } }, countTotalWFJobs() { return 0; }, logWorkflow() {},
						launchJob(job, callback) { children.push(job); callback(null, 'child' + children.length); }
					});
					engine.runWFNode_event({ job: parent, node: { id: 'nested', data: { event: 'nested' } } });
					assert.deepEqual(children[0].opts, item.child, label + ': child keeps only its own options');
					assert.equal(children[0].bubble, child_bubble, label + ': child keeps its own bubbling mode');
					assert.deepEqual(event.opts, item.child, label + ': saved options are unchanged');
					assert.deepEqual(parent.opts, item.parent, label + ': parent options are unchanged');
					assert.equal(parent.bubble, parent_bubble, label + ': parent bubbling mode is unchanged');
					if (item.child) assert.notEqual(children[0].opts, event.opts, label + ': child has an independent option array');
					
					// Reusing a workflow as a grandchild still starts from its saved
					// settings. Ordinary event jobs also receive no parent options.
					const nested = children[0];
					Object.assign(nested, { id: 'child', workflow: { state: { nested: {}, ordinary: {} }, jobs: {}, connections: [] } });
					engine.jobDetails.child = { workflowData: {} };
					engine.runWFNode_event({ job: nested, node: { id: 'nested', data: { event: 'nested' } } });
					assert.deepEqual(children[1].opts, item.child, label + ': grandchild keeps its own options');
					assert.equal(children[1].bubble, child_bubble, label + ': grandchild keeps its own bubbling mode');
					if (item.child) assert.notEqual(children[1].opts, nested.opts, label + ': generations do not share option arrays');
					engine.events.push({ id: 'ordinary', title: 'Ordinary', params: {}, triggers: [], actions: [], limits: [] });
					engine.runWFNode_event({ job: nested, node: { id: 'ordinary', data: { event: 'ordinary' } } });
					assert.ok(!Object.hasOwn(children[2], 'opts'), label + ': ordinary events do not inherit workflow options');
					assert.ok(!Object.hasOwn(children[2], 'bubble'), label + ': ordinary events do not inherit bubbling mode');
				}
			}
		}
	},
	
	async function test_workflow_isolation_options_api(test) {
		// Check the real create/update/run validation paths without launching jobs.
		// Sparse updates must preserve stored options when omitted and clear them
		// when an empty array is explicitly saved.
		const workflow = getWorkflow('decision');
		workflow.id = 'eisolationopts';
		workflow.bubble = 'leaf';
		workflow.opts = ['preserve_sev', 'first_abort', 'isolate_data', 'isolate_files', 'isolate_tags', 'isolate_content'];
		let { data: created } = await this.request.json(this.api_url + '/app/create_event/v1', workflow);
		assert.equal(created.code, 0, 'workflow with isolation options is accepted');
		assert.deepEqual(created.event.opts, workflow.opts, 'create preserves isolation options');
		assert.equal(created.event.bubble, 'leaf', 'create preserves bubbling mode');
		
		try {
			for (const opts of [{}, 'isolate_data', 1, true]) {
				for (const operation of ['create', 'update', 'run']) {
					const params = operation == 'create' ? { ...workflow, id: 'einvalidisolationopts', opts } : { id: workflow.id, opts };
					let { data } = await this.request.json(this.api_url + '/app/' + operation + '_event/v1', params);
					assert.notEqual(data.code, 0, operation + ': non-array opts are rejected');
					assert.match(data.description, /invalid opts.*must be array/, operation + ': rejection identifies opts');
				}
			}
			
			let { data: updated } = await this.request.json(this.api_url + '/app/update_event/v1', { id: workflow.id, notes: 'Sparse update' });
			assert.equal(updated.code, 0, 'sparse update is accepted');
			assert.deepEqual(updated.event.opts, workflow.opts, 'sparse update preserves stored options');
			assert.equal(updated.event.bubble, 'leaf', 'sparse update preserves bubbling mode');
			let { data: cleared } = await this.request.json(this.api_url + '/app/update_event/v1', { id: workflow.id, opts: [] });
			assert.equal(cleared.code, 0, 'empty option array is accepted');
			assert.deepEqual(cleared.event.opts, [], 'empty array clears isolation');
			assert.equal(cleared.event.bubble, 'leaf', 'clearing options does not change bubbling mode');
			let { data: all_mode } = await this.request.json(this.api_url + '/app/update_event/v1', { id: workflow.id, bubble: '' });
			assert.equal(all_mode.code, 0, 'explicit all-node bubbling is accepted');
			assert.equal(all_mode.event.bubble, '', 'empty string persists all-node bubbling');
			assert.deepEqual(all_mode.event.opts, [], 'changing bubbling mode preserves options');
		}
		finally {
			let { data } = await this.request.json(this.api_url + '/app/delete_event/v1', { id: workflow.id });
			assert.equal(data.code, 0, 'isolation test workflow is cleaned up');
		}
	},
	
	async function test_workflow_subworkflow_output_data(test) {
		// Two inner workflows share the parent's data, but their ordinary output
		// must contain only their own leaf results when the parent collects a Join.
		const shared = {
			owner: 'parent', dealers: ['Dealer A', 'Dealer B'],
			result: { code: 'PARENT_VALUE' }
		};
		const inner_node = { id: 'inner', type: 'event' };
		const join_node = { id: 'join', type: 'controller', data: { controller: 'join' } };
		const parent = { id: 'parent', bubble: 'leaf', workflow: {
			nodes: [inner_node, join_node, { id: 'final', type: 'job' }],
			state: { join: {} }, jobs: { inner: [] },
			connections: [
				{ source: 'inner', dest: 'join', condition: 'continue' },
				{ source: 'join', dest: 'final' }
			]
		} };
		const finished = {};
		let joined;
		const engine = Object.assign(new Workflows(), {
			activeJobs: { parent },
			jobDetails: { parent: { workflowData: shared, wfJobData: {} } },
			mergeConcatInto: Util.prototype.mergeConcatInto,
			getCompletedJobConditions: Jobs.prototype.getCompletedJobConditions,
			logWorkflow() {},
			runWorkflowNode(opts) { joined = opts.overrides.input.data; },
			finishJob(job) {
				// Model finishJob's final record and parent notification without storage.
				const completed = finished[job.id] = Tools.mergeHashes(job, this.jobDetails[job.id]);
				delete this.activeJobs[job.id];
				delete this.jobDetails[job.id];
				if (job.workflow.job) this.finishWorkflowJob(completed);
			}
		});
		
		const outputs = shared.dealers.map( function(dealer) {
			return { result: { key: [dealer], code: 'SUCCESS' } };
		} );
		const children = outputs.map( function(data, idx) {
			const id = 'inner' + idx;
			const leaf_id = 'leaf' + idx;
			const intermediate_id = 'intermediate' + idx;
			const child = { id, bubble: 'leaf', workflow: {
				job: parent.id, node: inner_node.id, nodes: [], connections: [], state: {},
				jobs: {
					intermediate: [{ id: intermediate_id, code: 0, leaf: false }],
					leaf: [{ id: leaf_id, code: 0, leaf: true }]
				}
			} };
			engine.activeJobs[id] = child;
			engine.jobDetails[id] = { workflowData: shared, wfJobData: {
				[intermediate_id]: { internal: 'keep inside sub-workflow' }, [leaf_id]: data
			} };
			return child;
		} );
		
		// Complete the actual inner workflow aggregation and parent collection.
		children.forEach( function(child, idx) {
			engine.tickWorkflow(child);
			assert.deepEqual(finished[child.id].data, outputs[idx], 'inner output excludes shared fields and preserves colliding result');
			assert.equal(finished[child.id].workflowData, shared, 'inner workflow retains its shared object for parent completion');
		} );
		engine.runWFController_join({ job: parent, node: join_node });
		assert.deepEqual(joined.items, outputs, 'each Join item contains only its corresponding inner output');
		assert.equal(joined.percentage, 100, 'both inner runs succeeded');
		assert.deepEqual(shared.dealers, ['Dealer A', 'Dealer B'], 'inner completions do not duplicate shared arrays');
		assert.ok(parent.workflow.jobs.inner.every(stub => stub.leaf === false), 'parent Continue wire excludes inner jobs from its output');
		
		// The parent completion scheduled by finishWorkflowJob still exports
		// shared data at the top level, including its existing key precedence.
		await new Promise(resolve => setImmediate(resolve));
		assert.equal(finished.parent.data.owner, 'parent', 'top-level workflow promotes shared data');
		assert.deepEqual(finished.parent.data.dealers, shared.dealers, 'top-level output contains the shared list once');
		assert.deepEqual(finished.parent.data.result, shared.result, 'top-level promotion retains shared key precedence');
		assert.deepEqual(finished.parent.data, shared, 'parent exports shared data without intermediate sub-workflow outputs');
		assert.ok(!Object.hasOwn(finished.parent, 'workflowData'), 'top-level workflow removes promoted workflowData');
	},
	
	async function test_workflow_shared_data_merge(test) {
		// Completion may return the exact shared object, including when startup
		// actions abort a sub-workflow before its normal completion cleanup.
		const cases = [
			{ name: 'shared successful completion', shared: true, code: 0 },
			{ name: 'shared startup abort', shared: true, code: 'abort' },
			{ name: 'shared retry', shared: true, code: 1, retried: true },
			{ name: 'separate sparse update', update: { dealers: ['Dealer C'], status: 'updated' } },
			{ name: 'equal values in a separate object', update: { dealers: ['Dealer A', 'Dealer B'] } },
			{ name: 'no update' }
		];
		
		cases.forEach( function(item) {
			const shared = { owner: 'parent', dealers: ['Dealer A', 'Dealer B'] };
			const parent = { id: 'parent', complete: true, workflow: {
				nodes: [{ id: 'inner', type: 'event' }], jobs: { inner: [] }
			} };
			const details = { workflowData: shared, wfJobData: {} };
			const engine = Object.assign(new Workflows(), {
				activeJobs: { parent }, jobDetails: { parent: details },
				mergeConcatInto: Util.prototype.mergeConcatInto, logWorkflow() {}
			});
			const child = { id: 'child', code: item.code || 0, retried: item.retried,
				workflow: { job: parent.id, node: 'inner' }, data: { result: 'SUCCESS' }
			};
			if (item.shared) child.workflowData = shared;
			else if (item.update) child.workflowData = item.update;
			
			// Keep the parent complete to isolate result collection from new nodes.
			engine.finishWorkflowJob(child);
			const expected = ['Dealer A', 'Dealer B'].concat(item.update ? item.update.dealers : []);
			assert.deepEqual(shared.dealers, expected, item.name + ': only separate updates concatenate arrays');
			assert.equal(shared.owner, 'parent', item.name + ': inherited scalar remains available');
			if (item.update && item.update.status) assert.equal(shared.status, 'updated', 'sparse update adds new keys');
			assert.deepEqual(details.wfJobData.child, item.retried ? {} : child.data, item.name + ': ordinary output collection is preserved');
		} );
	},
	
	async function test_workflow_magic_inheritance(test) {
		// Event nodes, ad-hoc jobs and nested workflows all receive the request
		// that started the parent. Inheritance depends on metadata, not source.
		var magic = {
			headers: { 'linear-signature': 'original' }, body: '{ "text": "café" }',
			params: { unknown: { value: 42 } }, query: { caller: 'original' }
		};
		for (var has_magic of [true, false]) {
			var children = [];
			var engine = Object.assign(new Workflows(), {
				events: [
					{ id: 'event', title: 'Event', params: {}, triggers: [], actions: [], limits: [] },
					{ id: 'nested', title: 'Nested Workflow', params: {}, actions: [], limits: [],
						workflow: { nodes: [], connections: [] }, triggers: [{ id: 'manual', type: 'manual', enabled: true }] }
				],
				plugins: [{ id: 'plugin', title: 'Plugin' }],
				config: { get() { return 1000; } },
				jobDetails: { parent: { workflowData: {} } },
				countTotalWFJobs() { return 0; }, logWorkflow() {},
				launchJob(job, callback) { children.push(job); callback(null, 'child_' + children.length); }
			});
			if (has_magic) engine.jobDetails.parent.magic = magic;
			var parent = {
				id: 'parent', event: 'workflow_event', source: 'user', params: {},
				workflow: { state: { event: {}, job: {}, nested: {} }, jobs: {}, connections: [] }
			};
			
			engine.runWFNode_event({ job: parent, node: { id: 'event', data: { event: 'event' } } });
			engine.runWFNode_job({ job: parent, node: { id: 'job', data: { plugin: 'plugin', params: {} } } });
			engine.runWFNode_event({ job: parent, node: { id: 'nested', data: { event: 'nested' } } });
			assert.equal(children.length, 3, 'all three node types launch');
			assert.equal(children[2].workflow.start, 'manual', 'nested workflow retains its own start node');
			
			// launchJob moves a nested workflow's metadata to its own details.
			// Start another job from that context to exercise a second generation.
			engine.jobDetails.nested_job = { workflowData: {} };
			if (children[2].magic) engine.jobDetails.nested_job.magic = children[2].magic;
			var nested = {
				id: 'nested_job', event: 'nested', source: 'workflow', params: {},
				workflow: { state: { job: {} }, jobs: {}, connections: [] }
			};
			engine.runWFNode_job({ job: nested, node: { id: 'job', data: { plugin: 'plugin', params: {} } } });
			
			for (var child of children) {
				if (has_magic) assert.deepEqual(JSON.parse(JSON.stringify(child)).magic, magic, 'child inherits original metadata through JSON transport');
				else assert.ok(!Object.hasOwn(child, 'magic'), 'ordinary workflow does not acquire Magic Link metadata');
				assert.ok(!Object.hasOwn(child.params, 'unknown'), 'metadata does not leak into child params');
			}
		}
	},
	
	async function test_workflow_split_empty_continue(test) {
		// Empty lists may continue only when the Split does not require successful jobs.
		const cases = [
			{ name: 'continue zero', percentage: 0, continues: true },
			{ name: 'default continue zero', continues: true },
			{ name: 'positive threshold', percentage: 50 },
			{ name: 'all success threshold', percentage: 100 },
			{ name: 'previous successes', percentage: 100, previous: true },
			{ name: 'filtered empty list', percentage: 0, filter: true, continues: true },
			{ name: 'filtered positive threshold', percentage: 100, filter: true },
			{ name: 'unmanaged positive threshold', percentage: 100, unmanaged: true }
		];
		
		cases.forEach( function(item) {
			const engine = new Workflows();
			const node = { id: 'split', type: 'controller', data: {
				controller: 'split', split: 'data.items', continue: item.percentage,
				filter: item.filter ? 'item.keep' : ''
			} };
			const worker = { id: 'worker', type: item.unmanaged ? 'controller' : 'job' };
			const state = {};
			const job = { id: 'parent', workflow: {
				nodes: [node, worker, { id: 'final', type: 'job' }],
				state: { split: state }, jobs: {},
				connections: [
					{ id: 'splitWorker', source: 'split', dest: 'worker' },
					{ id: 'workerContinue', source: 'worker', dest: 'final', condition: 'continue' }
				]
			} };
			
			// A previous activation's successful jobs must not satisfy an empty activation.
			if (item.previous) job.workflow.jobs.worker = [{ id: 'previous', code: 0 }];
			engine.jobDetails = { parent: { workflowData: {} } };
			engine.logWorkflow = function() {};
			const launched = [];
			engine.runWorkflowNode = function(opts) { launched.push(opts.node.id); };
			
			engine.runWFController_split({ job, node, overrides: { input: {
				data: { items: item.filter ? [{ keep: false }] : [] }
			} } });
			
			assert.deepEqual(launched, item.continues ? ['final'] : [], item.name + ': correct continuation');
			assert.equal(!!state.error, !item.continues, item.name + ': preserves errors at positive thresholds');
			if (item.continues) {
				assert.equal(state.active, false, item.name + ': Split is inactive');
				assert.equal(state.max, 0, item.name + ': no jobs expected');
				assert.equal(state.count, 0, item.name + ': no jobs completed');
				assert.ok(state.completed, item.name + ': Split is completed');
			}
		} );
	},
	
	async function test_workflow_join_percentage(test) {
		// Exercise Join's output directly, without launching downstream jobs.
		const cases = [
			{ name: 'all succeed', top: [0, 0], bottom: [0], percentage: 100 },
			{ name: 'mixed unequal branches', top: [0, 1], bottom: [0], percentage: 66.66666666666666 },
			{ name: 'none succeed', top: [1, 'warning'], bottom: ['abort'], percentage: 0 },
			{ name: 'retry succeeds', top: [{ code: 1, retried: true }, 0], bottom: [0], percentage: 100 },
			{ name: 'no output data', top: [0], bottom: [1], percentage: 50 },
			{ name: 'below one percent', top: [0], bottom: Array(100).fill(1), percentage: 0.9900990099009901 },
			{ name: 'no job results', top: [], bottom: [], percentage: null }
		];
		
		cases.forEach( function(item) {
			const engine = new Workflows();
			const node = { id: 'join' };
			const jobs = {};
			['top', 'bottom'].forEach( function(source) {
				jobs[source] = item[source].map( function(result, idx) {
					return { id: source + idx, ...(typeof(result) == 'object' ? result : { code: result }) };
				} );
			} );
			const job = { id: 'parent', workflow: {
				jobs, state: { join: {} }, nodes: [{ id: 'final' }],
				connections: [{ source: 'top', dest: 'join' }, { source: 'bottom', dest: 'join' }, { source: 'join', dest: 'final' }]
			} };
			engine.jobDetails = { parent: { wfJobData: {} } };
			engine.logWorkflow = function() {};
			let data;
			engine.runWorkflowNode = function(opts) { data = opts.overrides.input.data; };
			
			// Both input wires must arrive before the final input is generated.
			engine.runWFController_join({ job, node });
			assert.equal(data, undefined, item.name + ': waits for both inputs');
			engine.runWFController_join({ job, node });
			assert.equal(data.percentage, item.percentage, item.name + ': correct success percentage');
			assert.equal(data.items.length, jobs.top.concat(jobs.bottom).filter(stub => !stub.retried).length, item.name + ': includes terminal jobs without output');
		} );
	},
	
	async function test_workflow_reject_duplicate_node_id(test) {
		// The API should reject duplicate workflow node IDs instead of silently repairing them.
		let workflow = getWorkflow('decision');
		workflow.id = 'edupnode01';
		workflow.workflow.nodes.push( Tools.copyHash(workflow.workflow.nodes[0], true) );
		
		let { data } = await this.request.json( this.api_url + '/app/create_event/v1', workflow );
		assert.ok( data.code !== 0, "api rejected duplicate node ID" );
	},
	
	async function test_workflow_reject_duplicate_connection_id(test) {
		// The API should reject duplicate workflow connection IDs.
		let workflow = getWorkflow('decision');
		workflow.id = 'edupconn01';
		
		let conn = Tools.copyHash(workflow.workflow.connections[0], true);
		conn.source = workflow.workflow.connections[1].source;
		conn.dest = workflow.workflow.connections[1].dest;
		workflow.workflow.connections.push(conn);
		
		let { data } = await this.request.json( this.api_url + '/app/create_event/v1', workflow );
		assert.ok( data.code !== 0, "api rejected duplicate connection ID" );
	},
	
	async function test_workflow_reject_duplicate_connection_pair(test) {
		// The API should reject duplicate wires between the same source and destination nodes.
		let workflow = getWorkflow('decision');
		workflow.id = 'eduppair01';
		
		let conn = Tools.copyHash(workflow.workflow.connections[0], true);
		conn.id = 'cduppair';
		workflow.workflow.connections.push(conn);
		
		let { data } = await this.request.json( this.api_url + '/app/create_event/v1', workflow );
		assert.ok( data.code !== 0, "api rejected duplicate connection pair" );
	},
	
	async function test_update_active_workflow(test) {
		// Update a future workflow node while xySat is delaying the current node.
		const first_node_id = 'nk42jgcz';
		const future_node_id = 'nqe6dmpv';
		let workflow = getWorkflow('decision');
		workflow.id = 'eactiveupdate';
		workflow.title = 'Active Workflow Update Test';
		Tools.findObject(workflow.workflow.nodes, { id: first_node_id }).data.params.duration = '4';
		
		let { data:wflow } = await this.request.json( this.api_url + '/app/create_event/v1', workflow );
		assert.ok( wflow.code === 0, "successful api response" );
		assert.ok( wflow.event && wflow.event.id, "expected event in response" );
		
		let { data:run_data } = await this.request.json( this.api_url + '/app/run_event/v1', { id: wflow.event.id } );
		assert.ok( run_data.code === 0, "successful api response" );
		assert.ok( run_data.id, "expected workflow job id" );
		let job_id = run_data.id;
		
		// Wait until the first node is definitely executing, then fetch the live
		// workflow so we can replace its complete nodes array.
		await waitForActiveWorkflowNode( this, job_id, first_node_id );
		let { data:before_data } = await this.request.json( this.api_url + '/app/get_job/v1', { id: job_id } );
		assert.ok( before_data.code === 0 && before_data.job, "expected active workflow job" );
		assert.ok( before_data.job.workflow.state[first_node_id], "workflow has live state before update" );
		
		let nodes = Tools.copyHash(before_data.job.workflow.nodes, true);
		let future_node = Tools.findObject(nodes, { id: future_node_id });
		future_node.data.targets = ['satunit1'];
		
		// Only send nodes.  The API should shallow-merge the workflow object and
		// preserve its connections, runtime state and completed-job history.
		let { data:update_data } = await this.request.json( this.api_url + '/app/update_active_job/v1', {
			id: job_id,
			workflow: { nodes: nodes }
		});
		assert.ok( update_data.code === 0, "active workflow update succeeded" );
		
		let { data:live_data } = await this.request.json( this.api_url + '/app/get_job/v1', { id: job_id } );
		assert.ok( live_data.code === 0 && live_data.job, "expected updated active workflow job" );
		assert.ok( live_data.job.workflow.connections.length === before_data.job.workflow.connections.length, "workflow connections were preserved" );
		assert.ok( live_data.job.workflow.state[first_node_id], "workflow runtime state was preserved" );
		assert.deepEqual( Tools.findObject(live_data.job.workflow.nodes, { id: future_node_id }).data.targets, ['satunit1'], "future node targets were updated" );
		
		// The current node completes after its mock delay, then the workflow should
		// launch the future node using its new target and finish normally.
		await waitForJob( this, job_id );
		let { data:final_data } = await this.request.json( this.api_url + '/app/get_job/v1', { id: job_id } );
		assert.ok( final_data.code === 0 && final_data.job, "expected completed workflow job" );
		assert.ok( final_data.job.code === 0, "updated workflow completed successfully" );
		assert.ok( final_data.job.workflow.jobs[future_node_id], "updated future node was launched" );
		
		let child_job_id = final_data.job.workflow.jobs[future_node_id][0].id;
		let { data:child_data } = await this.request.json( this.api_url + '/app/get_job/v1', { id: child_job_id } );
		assert.ok( child_data.code === 0 && child_data.job, "expected completed future node job" );
		assert.deepEqual( child_data.job.targets, ['satunit1'], "future node used its updated targets" );
	},
	
	async function test_workflow_decision(test) {
		// test multi-job workflow with decision controller
		let { data:wflow } = await this.request.json( this.api_url + '/app/create_event/v1', getWorkflow('decision'));
		assert.ok( wflow.code === 0, "successful api response" );
		assert.ok( wflow.event && wflow.event.id, "expected event in response" );
		let workflow_id = wflow.event.id;
		
		let { data } = await this.request.json( this.api_url + '/app/run_event/v1', { id: workflow_id });
		assert.ok( data.code === 0, "successful api response" );
		assert.ok( data.id, "expected id in response" );
		let job_id = data.id;
		
		// wait for workflow to complete
		await waitForJob( this, job_id );
		
		// get job data
		let { data:jdata } = await this.request.json( this.api_url + '/app/get_job', { id: job_id });
		assert.ok( jdata.code === 0, "successful api response" );
		assert.ok( jdata.job, "expected job in response" );
		
		let job = jdata.job;
		let state = job.workflow.state;
		let jobs = job.workflow.jobs;
		
		// assertions here
		assert.ok( job.code == 0, "workflow completed successfully" );
		
		// job node IDs:
		// nk42jgcz = "Generate Data"
		// nqe6dmpv = "Hi" (data.num == 42)
		// n8qpiq1i = "There" (data.num != 42)
		
		assert.ok( jobs['nk42jgcz'], "Found jobs for node nk42jgcz");
		assert.ok( jobs['nk42jgcz'].length == 1, "Exactly one job for node nk42jgcz");
		
		assert.ok( jobs['nqe6dmpv'], "Found jobs for node nqe6dmpv");
		assert.ok( jobs['nqe6dmpv'].length == 1, "Exactly one job for node nqe6dmpv");
		
		var job_ids = [];
		for (var node_id in jobs) {
			jobs[node_id].forEach( function(job) { job_ids.push( job.id ); } );
		}
		assert.ok( job_ids.length == 2, "correct number of sub-jobs" );
		
		// fetch all of them at once
		let { data:sjdata } = await this.request.json( this.api_url + '/app/get_jobs', {
			ids: job_ids
		});
		assert.ok( sjdata.code === 0, "successful api response" );
		assert.ok( sjdata.jobs, "expected jobs in response" );
		assert.ok( sjdata.jobs.length == 2, "correct number of jobs in response" );
		assert.ok( Tools.findObjects(sjdata.jobs, { complete: true, code: 0 }).length == 2, "all jobs are complete and successful" );
		
		job_ids.forEach( function(job_id, idx) {
			assert.ok( !!Tools.findObject(sjdata.jobs, { id: job_id }), "found job idx " + idx );
		} );
	},
	
	async function test_workflow_repeat_join(test) {
		// test multi-job workflow with repeat and join controllers
		let { data:wflow } = await this.request.json( this.api_url + '/app/create_event/v1', getWorkflow('repeat-join'));
		assert.ok( wflow.code === 0, "successful api response" );
		assert.ok( wflow.event && wflow.event.id, "expected event in response" );
		let workflow_id = wflow.event.id;
		
		let { data } = await this.request.json( this.api_url + '/app/run_event/v1', { id: workflow_id });
		assert.ok( data.code === 0, "successful api response" );
		assert.ok( data.id, "expected id in response" );
		let job_id = data.id;
		
		// wait for workflow to complete
		await waitForJob( this, job_id );
		
		// get job data
		let { data:jdata } = await this.request.json( this.api_url + '/app/get_job', { id: job_id });
		assert.ok( jdata.code === 0, "successful api response" );
		assert.ok( jdata.job, "expected job in response" );
		
		let job = jdata.job;
		let state = job.workflow.state;
		let jobs = job.workflow.jobs;
		
		// assertions here
		assert.ok( job.code == 0, "workflow completed successfully" );
		
		// job node IDs:
		// n5r4k75x = "Generate Data" (x5)
		// nbzpuk59 = "Finalize Data" (x1)
		
		assert.ok( jobs['n5r4k75x'], "Found jobs for node n5r4k75x");
		assert.ok( jobs['n5r4k75x'].length == 5, "Exactly five jobs for node n5r4k75x (generate data)");
		
		assert.ok( jobs['nbzpuk59'], "Found jobs for node nbzpuk59");
		assert.ok( jobs['nbzpuk59'].length == 1, "Exactly one job for node nbzpuk59 (finalize data)");
		
		var job_ids = [];
		for (var node_id in jobs) {
			jobs[node_id].forEach( function(job) { job_ids.push( job.id ); } );
		}
		assert.ok( job_ids.length == 6, "correct number of sub-jobs" );
		
		// fetch all of them at once
		let { data:sjdata } = await this.request.json( this.api_url + '/app/get_jobs', {
			ids: job_ids,
			verbose: true // need this for data!
		});
		assert.ok( sjdata.code === 0, "successful api response" );
		assert.ok( sjdata.jobs, "expected jobs in response" );
		assert.ok( sjdata.jobs.length == 6, "correct number of jobs in response" );
		assert.ok( Tools.findObjects(sjdata.jobs, { complete: true, code: 0 }).length == 6, "all jobs are complete and successful" );
		
		job_ids.forEach( function(job_id, idx) {
			assert.ok( !!Tools.findObject(sjdata.jobs, { id: job_id }), "found job idx " + idx );
		} );
		
		// make sure final job has correct merged (joined) data
		var final_job_id = jobs['nbzpuk59'][0].id;
		var final_job = Tools.findObject( sjdata.jobs, { id: final_job_id } );
		assert.ok( !!final_job, "Found final job in sea of completed jobs" );
		
		assert.ok( !!final_job.input, "Found input object in final job" );
		assert.ok( !!final_job.input.data, "Found input data in final job" );
		assert.ok( !!final_job.input.data.items, "Found items in input data in final job" );
		assert.ok( final_job.input.data.items.length == 5, "Correct number of items in input data in final job" );
		assert.equal( final_job.input.data.percentage, 100, "Joined success percentage reaches final job input" );
		
		assert.ok( !!final_job.input.data.combined, "Found combined object in input data in final job" );
		assert.ok( final_job.input.data.combined.num == 42, "Correct data in combined object in input data in final job" );
	},
	
	async function test_workflow_discrete_join(test) {
		// test multi-job workflow with join controller
		let { data:wflow } = await this.request.json( this.api_url + '/app/create_event/v1', getWorkflow('discrete-join'));
		assert.ok( wflow.code === 0, "successful api response" );
		assert.ok( wflow.event && wflow.event.id, "expected event in response" );
		let workflow_id = wflow.event.id;
		
		let { data } = await this.request.json( this.api_url + '/app/run_event/v1', { id: workflow_id });
		assert.ok( data.code === 0, "successful api response" );
		assert.ok( data.id, "expected id in response" );
		let job_id = data.id;
		
		// wait for workflow to complete
		await waitForJob( this, job_id );
		
		// get job data
		let { data:jdata } = await this.request.json( this.api_url + '/app/get_job', { id: job_id });
		assert.ok( jdata.code === 0, "successful api response" );
		assert.ok( jdata.job, "expected job in response" );
		
		// console.log( "\nWORKFLOW: ", JSON.stringify(jdata.job, null, "\t") );
		
		let job = jdata.job;
		let state = job.workflow.state;
		let jobs = job.workflow.jobs;
		
		// assertions here
		assert.ok( job.code == 0, "workflow completed successfully" );
		
		// job node IDs:
		// nxew2z8t = "Generate Data 1"
		// nriolmha = "Generate Data 2"
		// ndl4jafi = "Finalize Data"
		
		assert.ok( jobs['nxew2z8t'], "Found jobs for node nxew2z8t");
		assert.ok( jobs['nxew2z8t'].length == 1, "Exactly 1 job for node nxew2z8t (generate data 1)");
		
		assert.ok( jobs['nriolmha'], "Found jobs for node nriolmha");
		assert.ok( jobs['nriolmha'].length == 1, "Exactly 1 job for node nriolmha (generate data 1)");
		
		assert.ok( jobs['ndl4jafi'], "Found jobs for node ndl4jafi");
		assert.ok( jobs['ndl4jafi'].length == 1, "Exactly 1 job for node ndl4jafi (finalize data)");
		
		var job_ids = [];
		for (var node_id in jobs) {
			jobs[node_id].forEach( function(job) { job_ids.push( job.id ); } );
		}
		assert.ok( job_ids.length == 3, "correct number of sub-jobs ran" );
		
		// fetch all of them at once
		let { data:sjdata } = await this.request.json( this.api_url + '/app/get_jobs', {
			ids: job_ids,
			verbose: true // need this for data!
		});
		assert.ok( sjdata.code === 0, "successful api response" );
		assert.ok( sjdata.jobs, "expected jobs in response" );
		assert.ok( sjdata.jobs.length == 3, "correct number of jobs in response" );
		assert.ok( Tools.findObjects(sjdata.jobs, { complete: true, code: 0 }).length == 3, "all jobs are complete and successful" );
		
		job_ids.forEach( function(job_id, idx) {
			assert.ok( !!Tools.findObject(sjdata.jobs, { id: job_id }), "found job idx " + idx );
		} );
		
		// make sure final job has correct merged (joined) data
		var final_job_id = jobs['ndl4jafi'][0].id;
		var final_job = Tools.findObject( sjdata.jobs, { id: final_job_id } );
		assert.ok( !!final_job, "Found final job in sea of completed jobs" );
		
		// console.log( "\nFINAL JOB: ", JSON.stringify(final_job, null, "\t") );
		
		assert.ok( !!final_job.input, "Found input object in final job" );
		assert.ok( !!final_job.input.data, "Found input data in final job" );
		assert.ok( !!final_job.input.data.items, "Found items in input data in final job" );
		assert.ok( final_job.input.data.items.length == 2, "Correct number of items in input data in final job" );
		
		assert.ok( !!final_job.input.data.combined, "Found combined object in input data in final job" );
		assert.ok( final_job.input.data.combined.num == 42, "Correct data in combined object in input data in final job" );
	},
	
	async function test_workflow_multiplex(test) {
		// test multi-job workflow with multiplex controller
		let { data:wflow } = await this.request.json( this.api_url + '/app/create_event/v1', getWorkflow('multiplex'));
		assert.ok( wflow.code === 0, "successful api response" );
		assert.ok( wflow.event && wflow.event.id, "expected event in response" );
		let workflow_id = wflow.event.id;
		
		let { data } = await this.request.json( this.api_url + '/app/run_event/v1', { id: workflow_id });
		assert.ok( data.code === 0, "successful api response" );
		assert.ok( data.id, "expected id in response" );
		let job_id = data.id;
		
		// wait for workflow to complete
		await waitForJob( this, job_id );
		
		// get job data
		let { data:jdata } = await this.request.json( this.api_url + '/app/get_job', { id: job_id });
		assert.ok( jdata.code === 0, "successful api response" );
		assert.ok( jdata.job, "expected job in response" );
		
		let job = jdata.job;
		let state = job.workflow.state;
		let jobs = job.workflow.jobs;
		
		// console.log( "\nWORKFLOW: ", JSON.stringify(jdata.job, null, "\t") );
		
		// assertions here
		assert.ok( job.code == 0, "workflow completed successfully" );
		
		// job node IDs:
		// nizewm42 = job
		// n68r2e20 = action
		
		assert.ok( jobs['nizewm42'], "Found jobs for node nizewm42");
		assert.ok( jobs['nizewm42'].length == 1, "Exactly one job for node nizewm42");
		
		var job_ids = [];
		for (var node_id in jobs) {
			jobs[node_id].forEach( function(job) { job_ids.push( job.id ); } );
		}
		assert.ok( job_ids.length == 1, "correct number of sub-jobs" );
		
		// fetch all of them at once
		let { data:sjdata } = await this.request.json( this.api_url + '/app/get_jobs', {
			ids: job_ids
		});
		assert.ok( sjdata.code === 0, "successful api response" );
		assert.ok( sjdata.jobs, "expected jobs in response" );
		assert.ok( sjdata.jobs.length == 1, "correct number of jobs in response" );
		assert.ok( Tools.findObjects(sjdata.jobs, { complete: true, code: 0 }).length == 1, "all jobs are complete and successful" );
		
		job_ids.forEach( function(job_id, idx) {
			assert.ok( !!Tools.findObject(sjdata.jobs, { id: job_id }), "found job idx " + idx );
		} );
		
		// make sure action ran
		assert.ok( !!state['n68r2e20'], "found state for action node" );
		assert.ok( state['n68r2e20'].code == 0, "action node has code 0" );
		assert.ok( !!state['n68r2e20'].date, "action node has date prop" );
	},
	
	async function test_workflow_split(test) {
		// test multi-job workflow with split controller
		let { data:wflow } = await this.request.json( this.api_url + '/app/create_event/v1', getWorkflow('split'));
		assert.ok( wflow.code === 0, "successful api response" );
		assert.ok( wflow.event && wflow.event.id, "expected event in response" );
		let workflow_id = wflow.event.id;
		
		let { data } = await this.request.json( this.api_url + '/app/run_event/v1', { 
			id: workflow_id,
			input: {
				data: {
					list: ["Item A", "Item B", "Item C"]
				}
			}
		});
		assert.ok( data.code === 0, "successful api response" );
		assert.ok( data.id, "expected id in response" );
		let job_id = data.id;
		
		// wait for workflow to complete
		await waitForJob( this, job_id );
		
		// get job data
		let { data:jdata } = await this.request.json( this.api_url + '/app/get_job', { id: job_id });
		assert.ok( jdata.code === 0, "successful api response" );
		assert.ok( jdata.job, "expected job in response" );
		
		let job = jdata.job;
		let state = job.workflow.state;
		let jobs = job.workflow.jobs;
		
		// console.log( "\nWORKFLOW: ", JSON.stringify(jdata.job, null, "\t") );
		
		// assertions here
		assert.ok( job.code == 0, "workflow completed successfully" );
		
		// job node IDs:
		// nan42bp0 = job
		
		assert.ok( jobs['nan42bp0'], "Found jobs for node nan42bp0");
		assert.ok( jobs['nan42bp0'].length == 3, "Exactly three jobs for node nan42bp0");
		
		var job_ids = [];
		for (var node_id in jobs) {
			jobs[node_id].forEach( function(job) { job_ids.push( job.id ); } );
		}
		assert.ok( job_ids.length == 3, "correct number of sub-jobs" );
		
		// fetch all of them at once
		let { data:sjdata } = await this.request.json( this.api_url + '/app/get_jobs', {
			ids: job_ids,
			verbose: true
		});
		assert.ok( sjdata.code === 0, "successful api response" );
		assert.ok( sjdata.jobs, "expected jobs in response" );
		assert.ok( sjdata.jobs.length == 3, "correct number of jobs in response" );
		assert.ok( Tools.findObjects(sjdata.jobs, { complete: true, code: 0 }).length == 3, "all jobs are complete and successful" );
		
		// make sure each sub-job was assigned one item from our split
		var split_items = [];
		job_ids.forEach( function(job_id, idx) {
			var sub_job = Tools.findObject(sjdata.jobs, { id: job_id });
			// console.log( "\nJOB " + idx + ": ", JSON.stringify(sub_job, null, "\t") );
			assert.ok( !!sub_job, "found sub-job idx " + idx );
			assert.ok( !!sub_job.input, `found sub-job idx ${idx} input object` );
			assert.ok( !!sub_job.input.data, `found sub-job idx ${idx} input.data object` );
			assert.ok( !!sub_job.input.data.item, `found sub-job idx ${idx} input.data.item` );
			assert.ok( !!sub_job.input.data.item.match(/^Item\s+\w+$/), `sub-job idx ${idx} input.data.item matches expected string pattern` );
			split_items.push( sub_job.input.data.item );
		} );
		
		// make sure all three items are unique
		assert.ok( new Set(split_items).size === split_items.length, "all split item strings are unique" );
	}

];
