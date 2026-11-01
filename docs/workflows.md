# Workflows

## Overview

Workflows in xyOps are visual graphs of nodes connected by wires that control job execution. Conceptually, a workflow is an event with an embedded graph and some special runtime behavior. When a workflow runs, it becomes a "workflow job" which may spawn any number of sub-jobs on connected nodes. The system manages their lifecycle, collects results, applies actions and limits, and tracks everything in the parent job record.

How a workflow runs, at a glance:

- A trigger node fires (e.g. manual trigger, schedule trigger, etc.). That starts the workflow job and "lights" the trigger node.
- All nodes wired from that trigger activate. Multiple outputs run in parallel unless constrained by limits.
- Event or job nodes launch sub-jobs. Their completion result determines which outgoing wires fire next.
- Controller nodes implement fan-out/fan-in, loops, conditionals, delays and multiplexing.
- Action and limit nodes visually attach to event/job nodes and are merged into the launched sub-jobs.
- The workflow completes when no nodes are active and all sub-jobs are finished or aborted. The parent job's result summarizes overall success/warnings/failures.

Workflows are powerful because they combine reusable events, ad-hoc jobs, resource limits, job actions, and flow control on one graph. They run everything in parallel by default, with concurrency governed by resource limits.


## When To Use Workflows

- **Orchestration**: Coordinate multiple jobs with conditional logic, joins, and/or delays.
- **Fan-out processing**: Split a dataset or file list and process items concurrently, then join results.
- **Multi-target runs**: Run the same job on many servers (multiplex) with optional staggering.
- **Reusability**: Compose pre-defined events into larger flows, or create ad-hoc job nodes when one-offs are easier.
- **Post-processing**: Attach actions directly to nodes with conditions, including success, failure, warnings, and custom tags.


## Graph Editor

The workflow editor provides:

- **Connect Nodes**: Click pole buttons to solder connections. Invalid pairs are suppressed by the UI. Conditions appear inline on wires; click to change.
- **Add Node**: Click "Add Node" or solder from a pole and click the background to insert a new node in place.
- **Duplicate**: Select one or more nodes (shift-click) and duplicate; connections between selected nodes are preserved.
- **Detach**: Detach all connections to/from selected nodes.
- **Delete**: Delete selected nodes and any connected wires. Deleting a trigger node also removes the underlying trigger.
- **Undo/Redo**: Up to 100 levels for all editor operations.
- **Zoom/Scroll**: Zoom in/out/reset and drag to pan.
- **Test Selection**: Run a test starting from the selected node or only that single node. Optional: disable actions/limits, provide custom input JSON and/or upload files.
- **Standard Buttons**: Cancel, Export, History, Save Changes.


## Node Types

Nodes have connection "poles" on their sides: an input pole on the left (incoming flow), an output pole on the right (outgoing flow), and for event/job nodes a special limit pole on the bottom used to attach limit nodes. Poles can connect to multiple nodes unless the controller type restricts its output as noted below.

### Trigger Nodes

Trigger nodes visually represent event triggers inside the graph, such as manual, schedule, interval, webhook or plugin triggers (see [Triggers](triggers.md)). They have a single output and typically feed Event, Job, or Controller nodes.

Special trigger option bubbles (Catch-Up, Range, Blackout, Delay, Precision) have no poles and are purely modifiers that light up when their associated scheduled trigger fires; they do not connect to anything.

### Event Nodes

Event nodes place a pre-created event on the graph. You can override targets, algo, tags and user parameters for that use. When the node runs, the sub-job inherits the event's configuration plus the node's overrides. Event nodes can also replay a previous job for testing. If the referenced event is a workflow, it must include an enabled manual trigger so the engine knows where to start the sub-workflow.

Event nodes present input, output and limit poles and can accept flow from triggers, other event/job nodes or controllers, and can send flow to other event/job nodes, actions, or controllers.

### Job Nodes

Job nodes are ad-hoc jobs without a backing event. You choose a plugin and provide any parameters, plus optional title/icon/category, targets, algo and tags. Actions and limits attached in the graph are merged into the launched sub-job at runtime. Job nodes can also replay a previous job for testing. Job nodes also include input, output and limit poles, accept flow from triggers/event/job/controllers, and can send to event/job/action/controller nodes.

See [Event vs Job Nodes](#event-vs-job-nodes) below.

### Action Nodes

Action nodes attach post-job actions to event/job nodes and are merged into the launched sub-job with the selected condition. Typical uses include email notifications, webhooks, or disabling/deleting future runs (see [Actions](actions.md)).

Action nodes have a single input and connect from event/job nodes.

### Limit Nodes

Limit nodes attach resource controls to event/job nodes and are merged into the launched sub-job's limits (see [Limits](limits.md)). Examples include Max Jobs, Max Queue, CPU/Memory/Time and File inputs.

A limit node connects via the bottom limit pole on an event/job node.

### Controller Nodes

Controllers implement flow control. They generally have input and output poles and connect in-line between other nodes. Some controllers require a single output connection; details are in the controller sections below.

#### Split Controller

The Split controller fans out work by taking an input list and launching one sub-job per item. Provide an [expression](xyexp.md) to the list in the previous job context, such as `data.rows`. The engine resolves the path and expects an array; if the value is a string it is trimmed and split by newline.   A special case is `files`, which splits the incoming files array so that each sub-job receives exactly one file. 

In the UI, the split controller configuration dialog provides an "Expression Builder" button, which allows you to explore output data from recently completed jobs, and pick out a specific JSON key path to use for the expression string.

Each individual sub-job will receive one item from the split data.  It will arrive in the job's [Job.input](data.md#job-input), either in `data` as a property named `item` (or `items` if multiple are batched), or as a [File](data.md#file) in the `files` array.

Split requires exactly one output connection to the Event or Job node it will run per item. Concurrency and queuing are governed by the limits attached to that node. After all items complete, you can continue the flow using a `continue` wire from the controlled node. The controller includes a "continue percentage" setting so you can require that at least N% of the sub-jobs succeed before continuing.

##### Split Item Filter

You can optionally filter out items from your split array, by including a special item filter expression.  In this context use the special `item` keyword to refer to the item being filtered.  If your expression evaluates to true, the item will be included in the set.  Otherwise, it will be left out.  Here is an example using a property inside the item:

```js
item.random < 0.5
```

Also available in context here is `index` (the 0-based index of the current item in the set), `workflow.params` (all workflow-level user fields), and `workflowData` (shared workflow data object).  For example, here is how to filter out all odd items, and only keep the even ones, using the modulo operator:

```js
index % 2 == 0
```

##### Split Batch Size

By default, each split item launches one downstream job.  To process multiple items per job, increase the Split controller's Batch Size setting.  xyOps will chunk the split items in order, using one downstream job per batch, with the final batch containing any remaining items.

For batched splits, each job receives an array in `data.items` (note: plural).  For `files` splits, each batched job receives multiple [File](data.md#file) objects in its `files` array.  A special case is when the Batch Size is `1`, which keeps the original legacy behavior, where each job receives a single `data.item` (note: singular) or one file.

#### Join Controller

The Join controller waits for multiple incoming flows to finish, then passes a combined result to the next step. You can wire multiple inputs into a Join; it initializes when the first input arrives and completes after all of its inputs have fired.

The joining process works as follows: all input job data is appended to an `items` array, and also separately all job data is shallow-merged into a `combined` object, which is passed to the next job (via continue condition).  For e.g. if 3 connected input jobs all succeed and output this data: `{"foo":1234}` then the final joined data that is passed along would look like this:

```json
{
	"items": [
		{ "foo": 1234 },
		{ "foo": 1234 },
		{ "foo": 1234 }
	],
	"combined": {
		"foo": 1234
	},
	"percentage": 100
}
```

The `percentage` field is the success percentage of the collected jobs, from 0 to 100, preserving fractional values. It counts jobs across all incoming nodes, includes failed jobs even when they produce no output, and excludes superseded retry attempts. If there are no job results to collect, it is `null`. You can use `data.percentage` downstream to distinguish all jobs succeeding (`100`), some succeeding (greater than `0` and less than `100`), and none succeeding (`0`). For Split workflows, use On Continue wires into Join and set each Split's Continue Percentage to `0` to include all outcomes.

Any files produced upstream are concatenated and passed along. Join requires exactly one output connection.

#### Repeat Controller

The Repeat controller runs the same Event or Job node a fixed number of times. You configure the iteration count on the controller. All runs are launched immediately and will queue or run in parallel based on the limits attached to the target node. Repeat requires exactly one output connection (to the node being repeated). After all iterations complete, use a `continue` wire from the repeated node to define post-processing.

To control the series/parallel run of the repeat jobs, the user simply has to connect limit nodes to the event/job node, e.g. "Max Jobs Limit" and "Max Queue Limit".

The repeat controller also offers a "continue percentage" text field, where the user can enter a number from 0-100.  This represents the number of sub-jobs that must complete successfully for the controller to fire the "continue" condition and allow flow to continue (otherwise the workflow will end, assuming no other nodes are active).

#### Multiplex Controller

The Multiplex controller runs a job across many servers. It expands the target selection from the destination Event/Job into concrete server IDs, filters to currently enabled servers, and applies server alert filters. It then launches one sub-job per server. An optional stagger setting delays starts by a fixed interval per job, which helps avoid thundering herds. Multiplex requires exactly one output connection (to the Event/Job to be run per server).

To control the series/parallel run of the multiplexed jobs, the user simply has to connect limit nodes to the event/job node, e.g. "Max Jobs Limit" and "Max Queue Limit".

The multiplex controller also offers a "continue percentage" text field, where the user can enter a number from 0-100.  This represents the number of sub-jobs that must complete successfully for the controller to fire the "continue" condition and allow flow to continue (otherwise the workflow will end, assuming no other nodes are active).

#### Decision Controller

The Decision controller evaluates a JEXL expression (with [xyOps extensions](xyexp.md)) against the previous job context, for example `data.random > 0.5`. If the expression evaluates to true, the controller passes control to all of its connected outputs; when false, no outputs fire. There is no explicit "false" pole. For multi-branch logic, create multiple Decision nodes with different expressions and optional titles/icons to make branches visually clear.

In the UI, the decision controller configuration dialog provides an "Expression Builder" button, which allows you to explore output data from recently completed jobs, and pick out a specific JSON key path to use for the expression string.

Decision does not require a single output and can fan out to many.

#### Wait Controller

The Wait controller pauses flow for a configured duration, then passes control to all connected outputs. It maintains active state while waiting and is aborted if the workflow is aborted.

Wait does not require a single output and can feed multiple downstream steps.

### Note Nodes

A Note node is simply a customizable text box you can use to annotate your workflows.  Enter your note's body content using [GitHub Flavored Markdown](https://guides.github.com/features/mastering-markdown/), and it will display on your workflow map.  You can drag notes around to position them wherever you like, and even make a double-wide note.

By default, notes are not shown during job runs -- they are more for providing instructions to users who are configuring the workflow.  However, a checkbox is provided to always show the note, even during job runs.

## Connections and Conditions

Here are the connection rules by node type: 

- Triggers send flow to Event, Job, or Controller nodes.
- Event and Job nodes accept flow from Triggers, Event/Job, or Controller nodes and can send to Event/Job, Action, or Controller nodes; their bottom limit pole accepts Limit nodes. 
- Action nodes connect from Event/Job nodes only. 
- Limit nodes attach to the bottom pole of Event/Job nodes. 
- Controllers accept flow from Trigger/Event/Job nodes and send to Event/Job nodes.

Controller output restrictions:

- Split, Join, Repeat, Multiplex: must have exactly one output connection (to the node being controlled or the post-join node).
- Decision and Wait: may have multiple outputs.

Conditions on wires from Event/Job nodes determine which outputs fire when a sub-job completes. Supported values include complete (always), success (code 0), error (any failure), the specific codes warning, critical, or abort, tag:NAME (fires if the sub-job produced tag NAME), and continue (a special condition fired after Repeat/Multiplex/Split completes when the success threshold is met).

The editor defaults new wires from Event/Job outputs to success, and you can change the condition inline on the wire (just click it). Note that Action and Limit nodes do not forward flow: they are attached to the launched sub-job; actions require a condition and limits attach via the bottom pole.


## Custom Resume Flow

When a workflow sub-job is suspended by a completion action, the resume dialog lets the user choose how workflow flow should continue after the job is resumed.  The default option resumes normally, which means xyOps evaluates the completed sub-job result and follows any matching output wires from the current Event or Job node.

The user can also choose a specific workflow Event or Job node to jump to.  In this mode, xyOps launches that selected node directly after the suspended sub-job resumes, instead of following the normal matching output wires from the suspended node.

This selector is only shown when the suspended workflow sub-job is already at the end of its job lifecycle.  In other words, it appears for a Suspend Job action wired to a completion condition such as `On Complete`, `On Success`, `On Any Error`, `On Warning`, `On Critical`, `On Abort`, or a tag condition.  It is not shown when the Suspend Job action fires at the start of the job, such as `On Start`.

The same behavior is available through the [resume_job](api.md#resume_job) API by passing the optional `redirect` property with the target workflow node ID.


## Continue After Controllers

[Repeat](#repeat-controller), [Multiplex](#multiplex-controller) and [Split](#split-controller) are special because they launch the same Event or Job node multiple times.  For example, Repeat may run the same job 10 times, Multiplex may run it once per server in the target group, and Split may run it once per item or file.

This creates an important distinction for outgoing wires from the controlled event/job node:

- "On Success", "On Complete", "On Any Error" and tag conditions are evaluated for *each individual sub-job*.  If you wire another node using "On Success" or "On Complete", it may run many times, once for each matching sub-job.
- "On Continue" is evaluated *only once* for the controller as a whole.  It fires only after all the jobs launched by that Repeat, Multiplex or Split controller have finished.

Use "On Continue" when you want a single next step after the whole controlled set is done.  For example:

```text
+-----------+     +-------+      -------------      +-------+
| Multiplex | --> | Job A | --> | On Continue | --> | Job B |
+-----------+     +-------+      -------------      +-------+
```

The "On Continue" wire is soldered from the controlled Event or Job node, not from the controller itself.

In this example, `Job A` runs multiple times, once per selected server.  `Job B` runs only once, and only after every multiplexed `Job A` has completed.  If the wire condition was changed to `On Success` or `On Complete`, then `Job B` would run once for every matching `Job A` instead.

The controller's "continue percentage" setting controls whether the "On Continue" wire is allowed to fire.  It is a number from 0 to 100, representing the minimum percentage of controlled sub-jobs that must succeed.  After the last sub-job finishes, xyOps checks the success percentage:

- If the success percentage meets or exceeds the controller setting, all "On Continue" wires from the controlled Event or Job node fire.
- If the success percentage is below the controller setting, the "On Continue" wires do not fire, and the workflow may finish if no other nodes are active.

Each "On Continue" condition is scoped to the specific controller and Event/Job node pair it is attached to.  You can have multiple controller sections in the same workflow, and each one waits for its own controlled jobs before firing its own "On Continue" wires.

When [leaf bubbling](#workflow-output) is enabled, an "On Continue" wire to an Event, Job, or Controller always excludes the controlled jobs from the workflow's output.  This applies even when the Continue Percentage is not met and the wire never fires.  You can collect the controlled jobs' data and files through a Join and use a final job to produce the workflow's output.


## Replay Previous Jobs

Event and Job nodes can be set to replay a previous job instead of launching a new one.  This is useful while testing a workflow where one step is expensive, slow, rate-limited, or difficult to reproduce.  For example, you can run a database query or AI request once, then replay that saved result while you keep working on the downstream nodes.

To use this, edit an Event or Job node and choose a job from the "Replay Previous Job" menu.  xyOps lists previous workflow jobs that match the selected event or plugin.  After you save the node, the graph shows a "Replay" badge in the node header so you can quickly see which nodes are frozen.

When the workflow reaches a replayed node:

- xyOps does not launch a new sub-job.
- The selected previous job is loaded and treated as if it just completed for this node.
- The previous job's output `data`, output `files`, tags and `workflowData` are passed to downstream nodes.
- The previous job's result is simulated too, so `On Success`, `On Any Error`, `On Warning`, `On Critical`, `On Abort` and tag conditions follow the same path they would have followed originally.

Actions attached directly to the replayed node, such as emails, web hooks, suspend actions, or disable/delete actions, are not run again.  They are considered part of the replayed job's original lifecycle, so replay mode only feeds the saved result back into workflow flow.

### Run a Workflow Again

On a completed workflow job, click **Run Again** to open the **Run Workflow Again** dialog and choose how the new run should use previous results.  This starts a new workflow job using the previous job's workflow map.  The original job history and saved workflow event are kept unchanged.

In this dialog, **frozen nodes** replay their previous completed job results without executing those jobs again.  Unfrozen nodes launch fresh jobs when reached.  Frozen nodes show the **Replay** badge in the workflow graph.

| Replay Mode | Behavior |
|-------------|----------|
| **Run All Jobs** | The default. Clears replay settings on this workflow's Event and Job nodes, so they launch fresh jobs when reached. |
| **Freeze Successful Nodes** | Freezes nodes whose previous jobs all succeeded. Nodes with any failures, or no previous jobs, launch fresh jobs when reached. |
| **Freeze Custom Nodes...** | Shows the **Nodes to Freeze** multi-select menu of Event and Job nodes with completed jobs. Selected nodes reuse their previous job results; unselected nodes launch fresh jobs when reached. |

For example, if Job A succeeded, Job B failed, and Job C was never reached, choose **Freeze Successful Nodes** to reuse A's saved result and run B again.  If B succeeds, the workflow can proceed to C through its normal connections.

Attempts superseded by a retry are excluded from replay selection.  For a node that ran several jobs (i.e. via a split, multiplex or repeat controller), **Freeze Successful Nodes** requires every remaining job to have succeeded; otherwise the entire node runs fresh jobs.  **Freeze Custom Nodes** can reuse failures too, including their error paths, so leave a failed node unfrozen when you want to try it again.  Each choice replaces the previous run's replay settings, including when you run a workflow with frozen nodes again.

Previous jobs must still be stored and accessible to your account.  If a selected job cannot be loaded, the new workflow aborts with a message identifying that job.

### Replaying Multi-Job Nodes

Split, Multiplex and Repeat controllers can invoke the same Event or Job node several times.  A replay selected in the workflow editor uses one saved job for every invocation.  Freezing a node in **Run Again** instead supplies a list of that node's previous job IDs, and each invocation consumes the next ID from that list.

Replay results are assigned in list order, without matching them to the current split items or multiplex servers.  If an upstream node runs again and produces different split input, or the multiplex servers change, review which nodes you freeze to make sure the saved results still fit the new run.  You can select **Run All Jobs**, or leave the affected nodes unfrozen in **Freeze Custom Nodes**, to process their current inputs afresh.


## Passing Data Between Nodes

Inputs and outputs are automatically passed along:

- At workflow start, the inbound `input.data` and `input.files` are passed to the trigger node.  The trigger nodes passes these on to any soldered nodes.
- When an Event/Job finishes, its output `data` and `files` are passed to downstream nodes as `input.data` and `input.files`.
	- Note that your job script has to explicitly specify data and file paths for output.  See [Output Data](plugins.md#output-data) and [Output Files](plugins.md#output-files).
- If the workflow itself has any user fields defined, these are passed to all sub-jobs via a `workflow.params` object inside the job data.
- Tags: user tags bubble up according to the [workflow output rules](#workflow-output), unless [Isolate Tags](#data-isolation) is enabled.  Each sub-job's own tags can drive `tag:...` conditions regardless of whether they bubble.
- HTML and table content: a sub-job's `html` or `table` bubbles up for display according to the [workflow output rules](#workflow-output), unless [Isolate Content](#data-isolation) is enabled.  If multiple eligible jobs emit the same type of content, the most recently completed job's content prevails.
- Retries: if a sub-job was retried, its data/files are not bubbled and it doesn't count toward tag/condition firing.

Join specifics:

- The next node after a Join Controller receives a custom `input.data` with two properties: `items` (array of each upstream job's data) and `combined` (shallow merge of all data).
- Any files are concatenated onto the `input.files` array.

Split specifics:

- The Split controller resolves its data path against the previous job context (or incoming input).
- If the path is `files`, each incoming file is sent to a separate sub-job; otherwise, each array element becomes `input.data = { item: ... }` for the launched sub-job.

## Workflow Output

The **Workflow Bubbling** menu in the workflow editor controls which sub-job outputs bubble up to that workflow.  Each workflow has its own setting:

- **Bubble Leaf Nodes** (`bubble: "leaf"`): Collect output data, files, user tags, and custom tables or HTML from leaf sub-jobs only.
- **Bubble All Nodes** (`bubble: ""`, or an omitted `bubble` property): Collect these outputs from *all* sub-jobs.

Intermediate outputs remain available on the jobs that produced them and continue to pass to downstream nodes, including through Join controllers, in either mode.  [Workflow Options](#workflow-options) can further control how the workflow handles output and failures.

In leaf mode, leaf status is evaluated for each completed sub-job using its result and outgoing wire conditions:

- A job with no matching outgoing wire to an Event, Job, or Controller is a leaf.
- A matching wire to an Event, Job, or Controller makes the job intermediate.  Action and Limit attachments do not affect leaf status.
- An outgoing **On Continue** wire to an Event, Job, or Controller always makes the job intermediate, even if the controller's Continue Percentage prevents continuation.
- A job resumed with a redirect to another node is intermediate.
- Superseded retry attempts do not contribute output.

For example, suppose a Split launches 20 jobs on one node, with an **On Any Error** wire to an error handler and no **On Continue** wire.  Successful jobs are leaves and can bubble their output.  Failed jobs pass their output to the error handler instead.  Each error-handler job is evaluated using its own result and outgoing wires.  Adding an **On Continue** wire to a downstream Event, Job, or Controller makes every job on the controlled node intermediate, regardless of its result or whether continuation occurs.

In either mode, eligible output data is shallow-merged into the workflow's output, with top-level arrays concatenated.  Matching properties otherwise replace earlier values, so use distinct property names or a final formatting job when combining multiple results.  Files are concatenated, user tags are combined without duplicates, and the latest eligible table or HTML of each type is displayed.  Superseded retry attempts are excluded, and [isolation options](#data-isolation) can further suppress these outputs.

Each sub-workflow uses its own bubbling setting, independently of its parent.  For example, an outer workflow can use leaf mode while an inner workflow uses all mode.  The inner workflow collects its outputs using its own mode, then its parent receives those outputs as normal node output and can pass them to subsequent jobs or Joins.  The parent's mode determines whether that sub-workflow job contributes to the parent's collected output.

Shared [workflowData](#sharing-data-between-all-nodes) continues to work for all jobs.  It is included in the top-level workflow's final output and kept separate from ordinary sub-workflow output.  Leaf status also does not change the workflow's overall result: intermediate job failures still count.

### Backwards Compatibility

New workflows created in the UI default to **Bubble Leaf Nodes**.  Existing workflows with no `bubble` property retain **Bubble All Nodes**, including when you edit or clone them.  To use leaf mode when creating or importing a workflow through the API, include `"bubble": "leaf"` in its event data.

To default new workflows in the UI to **Bubble All Nodes**, add `"bubble": ""` to your existing [client.new_event_template](config.md#clientnew_event_template) configuration object.  This changes the creation default only; saved workflows keep their own settings.  The workflow editor uses leaf mode when the template omits `bubble`.

## Sharing Data Between All Nodes

xyOps offers another way to share data between nodes, including nodes that are not directly connected.  There is a special shared [workflowData](data.md#job-workflowdata) object which is passed to all sub-jobs when they launch.  This works similarly to [Server User Data](servers.md#user-data).  The idea is, each sub-job can read from this object, and also write back to it by including a `workflowData` object in its output.  Example:

```json
{ "xy": 1, "workflowData": { "foo": "bar" } }
```

The data is shallow-merged into the shared `workflowData` object when the sub-job completes (also, top-level arrays are concatenated together instead of replacing).  Then, any subsequent jobs that launch from the same workflow are passed the updated `workflowData` object.

The `workflowData` object only lasts for the duration of the workflow run.  It is not persistent like [Server User Data](servers.md#user-data), but it works in the same way.

> [!TIP]
> If you launch your workflow via the [run_event](api.md#run_event) API, you can prepopulate the `workflowData` object by simply including it in the API call as a top-level JSON property.

## Event vs Job Nodes

When should you use an Event vs a Job Node:

- **Event node**: References a pre-created event. Use this when you want reusable configuration: plugin params, targets, algo, actions, limits, and optional user fields. The node can override targets, algo, tags, and user params per use.
- **Job node**: Ad-hoc job without an event. You pick the plugin and fill plugin parameters right in the workflow editor (e.g. write inline shell script with the Shell plugin). This is faster for one-offs or when you don't want a separate event.


## Sub-Workflows

Event nodes can reference events of type `workflow`. To run as a sub-workflow:

- The sub-workflow must have an enabled manual trigger. The engine uses this to determine the start node.
- Parent workflow input (data/files) is passed into the sub-workflow's trigger node.
- Limits and actions on the parent workflow do not automatically apply to the sub-workflow unless explicitly attached to the node.


## Workflow Options

Use the **Workflow Options** multi-select in the workflow editor to choose optional behavior for that workflow.  Selected options are stored in the event's `opts` array and copied to the workflow job when it launches.  An empty or omitted array enables no options.  For example:

```json
{
	"bubble": "leaf",
	"opts": ["first_abort", "isolate_files"]
}
```

Each workflow has its own options, including when it runs as a sub-workflow.  Options are not inherited from the parent or merged with its options.  For example, enabling **First Fail Aborts** on an outer workflow does not enable it inside an inner workflow.  The outer workflow applies its policy when the inner workflow completes and reports its result.  Workflow options are preserved when a workflow is retried or run again.

### First Fail Aborts

Select **First Fail Aborts** (`first_abort`) to abort the workflow when one of its sub-jobs completes with a nonzero result.  This includes warnings, critical errors, aborts, and other failure codes.  xyOps requests cancellation of the remaining running jobs, cancels queued work, and stops active controllers.  The workflow completes with an abort status once its remaining jobs have finished cancelling.

This option prevents the failed job's normal downstream paths, including error-handler jobs and controller continuations, from launching.  Completion actions attached to the sub-job still follow that job's normal lifecycle.  A superseded attempt that is being retried does not trigger the workflow abort; a final failed attempt does.

### Preserve Severity

Select **Preserve Severity** (`preserve_sev`) to set the workflow's final result to the highest severity reported by its completed sub-jobs.  This is useful for checks across many hosts: findings can remain warnings, while a failed check remains an error even when other hosts are healthy.

The option is disabled by default.  Without it, xyOps keeps its existing calculation: all successful jobs produce success, a mixture of successful and failed jobs produces a warning, and all failed jobs produce an error.  Warnings count as failures in that default calculation.

With **Preserve Severity** enabled, the priority order is:

```text
Success (0) < Warning < Custom error codes < Abort < Critical
```

Custom error codes include nonzero numeric codes and other error strings besides `warning`, `abort`, and `critical`.  They all have the same priority; a larger numeric code does not imply higher severity.  The selected sub-job's actual code is preserved, rather than converted to a generic error.

| Sub-job Results | Default Workflow Result | With Preserve Severity |
|----------------|-------------------------|------------------------|
| All successful | Success | Success |
| All warnings | Error (`1`) | Warning |
| Successes and warnings | Warning | Warning |
| Three successes and one error `42` | Warning | Error (`42`) |
| Error `42` and an aborted job | Error (`1`) | Abort |
| An aborted job and a critical error | Error (`1`) | Critical |

The description identifies a sub-job at the selected severity, for example `Job #j123: Pending upgrades`.  When multiple sub-jobs share the highest severity, the last completed job supplies the code and description, based on its `completed` timestamp.  This applies across all nodes, regardless of node or job-list order.  If timestamps are identical, the first matching job encountered is retained.  The description is not a summary of every finding.

The calculation excludes superseded retry attempts and includes intermediate jobs, regardless of **Workflow Bubbling** or isolation settings.  Adding a successful housekeeping job does not reduce a failure's severity.  Controller/node errors retain their existing handling: if all launched jobs succeeded, or no jobs were launched, a node error produces a warning instead of success.

Each workflow uses its own option.  Enable **Preserve Severity** on every level where you want this policy, including sub-workflows.  A parent sees the sub-workflow's final code, so it cannot recover a severity that the inner workflow already converted using the default calculation.  With the option enabled at both levels, a warning stays a warning, and attribution can read `Job #jouter123: Job #jinner456: Pending upgrades`.

This option controls final result aggregation.  It does not make warnings successful for **On Any Error**, retries, controller Continue Percentage thresholds, or **First Fail Aborts**:

- Explicit cancellation of the workflow always produces `abort`, even if a child reported `critical`.
- If **First Fail Aborts** is also enabled, the first final sub-job failure still cancels the workflow.  The workflow finishes with `abort` rather than waiting to select a severity from normally completed work.
- An inherited `abort` code follows normal abort behavior for completion actions and retries.  In particular, ordinary retry limits skip an aborted workflow unless a forced retry or other existing retry permission applies.  Reporting an inherited abort does not itself cancel sibling jobs; **First Fail Aborts** controls that behavior.
- [Custom Job Overrides](recipes.md#custom-job-overrides) still run after aggregation and may change the final workflow code or description.

For API creation or updates, include `preserve_sev` in the workflow event's `opts` array alongside any other desired options:

```json
{
	"opts": ["preserve_sev", "isolate_files"]
}
```

### Data Isolation

[Workflow output rules](#workflow-output) determine which sub-job outputs are eligible to bubble up.  To further suppress selected output, choose one or more isolation settings from **Workflow Options**:

- **Isolate Data** (`isolate_data`): Exclude sub-job output `data` from the workflow's combined output data.
- **Isolate Files** (`isolate_files`): Exclude sub-job output files from the workflow's output files.
- **Isolate Tags** (`isolate_tags`): Prevent sub-job user tags from being added to the workflow's tags.
- **Isolate Content** (`isolate_content`): Prevent sub-job tables and HTML from being displayed as the workflow's custom content.

Within a workflow, data and files are still passed between its nodes, including through Join controllers.  Tag conditions on a sub-job still use that sub-job's own tags.  The original outputs remain available on the jobs that produced them.

**Isolate Data** applies to ordinary output `data`.  The shared [workflowData](#sharing-data-between-all-nodes) object continues to work normally, including being included in the top-level workflow's final output data.

Isolation applies only to the workflow where it is selected.  For example, if the parent selects **Isolate Data** and a sub-workflow selects **Isolate Files**, the sub-workflow still collects its own output data, while the parent excludes that data from its collected output.  The sub-workflow excludes its own sub-job files from its output.


## Tips

- **Reuse vs. ad-hoc**: Use Event nodes to encapsulate stable configuration and user fields, and Job nodes for quick one-offs or inline scripts.
- **Concurrency control**: Everything runs in parallel by default; attach [Max Jobs Limit](limits.md#max-jobs-limit) and [Max Queue Limit](limits.md#max-queue-limit) to throttle fan-out.
- **Post-controller flow**: For Repeat/Multiplex/Split, use `continue` wires from the controlled node to handle "after all done" steps, optionally with a success threshold.
- **Fan-in**: Use Join to aggregate multiple upstream results; the next node sees both `items` and a `combined` object.
- **Condition routing**: Prefer `success`/`error` wires for the main paths and add `warning`, `critical`, `abort`, or `tag:NAME` for special handling.
- **Conditional logic**: Use Decision for branching; duplicate the node for multi-branch flows and give each a clear title/icon.
- **Staggering**: For massive multi-server jobs, add a Multiplex controller with a stagger to avoid spikes.
- **File workloads**: Split on `files` to process one file per sub-job; combine results with Join.
- **Replay while testing**: Use Replay on expensive or slow Event/Job nodes so downstream workflow logic can be tested repeatedly from a known saved result.


## Data Model Reference

Workflows are stored inside events. See [Data Structures](data.md) for complete schemas. Highlights:

- [Workflow](data.md#workflow): `{ start?, nodes: [], connections: [] }`.
- [Nodes](data.md#workflownode): `{ id, type: 'trigger'|'event'|'job'|'limit'|'action'|'controller', x, y, data? }`.  Event and Job node data may include `replay`, containing one previous job ID or an array of job IDs to replay.
- [Connections](data.md#workflowconnection): `{ id, source, dest, condition? }` where `condition` matches the wire condition list above.
- Controller data:
  - Multiplex: `{ controller: 'multiplex', stagger?, continue? }`
  - Repeat: `{ controller: 'repeat', repeat, continue? }`
  - Split: `{ controller: 'split', split: 'data.path.or.files', continue? }`
  - Join: `{ controller: 'join' }`
  - Decision: `{ controller: 'decision', decision: '<expression>' , title?, icon? }`
  - Wait: `{ controller: 'wait', wait }`


## Security and Privileges

Creating or editing a workflow is subject to the same privileges as events. When a workflow runs sub-jobs, target and category privileges still apply to those launched jobs. 

See [Privileges](privileges.md) and [Events](events.md) for more details.


## API

Workflows reuse the event APIs -- there are no separate workflow APIs. In particular:

- [get_events](api.md#get_events)
- [get_event](api.md#get_event)
- [create_event](api.md#create_event)
- [update_event](api.md#update_event)
- [run_event](api.md#run_event)
- [delete_event](api.md#delete_event)

See [API → Events](api.md#events) for details.

## Notes and Caveats

- Controller single-output requirement: Split, Join, Repeat, and Multiplex controllers must have exactly one output.
- Sub-workflow manual trigger: A sub-workflow must have an enabled manual trigger or it cannot be launched from a workflow node.
- Action/Limit nodes: These do not forward flow; they are merged into the launched sub-job and executed/checked there.
- Modifier triggers: Catch-Up, Range, Blackout, Delay, Precision are visual modifiers only and are "lit" when their associated schedule fires; they do not connect to other nodes.


## See Also

- [Events](events.md)
- [Actions](actions.md)
- [Limits](limits.md)
- [Triggers](triggers.md)
- [Plugins → Event Plugins](plugins.md)
- [xyOps Expression Format](xyexp.md)
