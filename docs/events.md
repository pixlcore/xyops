# Events

Events are the core building block of xyOps. An event describes what to run (a Plugin with parameters), where to run it (one or more target servers or groups), when to run it (Triggers), and how to constrain and react to runs (Limits and Actions). Each time an event "runs" it launches a job. Jobs have full lifecycle state, logs, metrics, limits, and actions.

## Overview

- An event is a saved configuration for launching jobs. It has an `id`, `title`, `category`, `plugin`, `params`, optional `fields`, `tags`, `targets`, `algo`, `triggers`, `limits`, and `actions`.
- When a trigger fires (schedule, interval, single-shot, plugin, or manual), the scheduler creates a job from the event and launches it on a chosen target server.
- Category defaults apply automatically: category-defined actions and limits are merged into the job in addition to any defined on the event. System “universal” defaults may also apply.
- Jobs run code provided by an Event Plugin on the selected server, stream logs back to the UI, update metrics, and honor configured limits and actions.
- Workflows are a special kind of event that launch a graph of nodes; they use a special workflow pseudo-plugin. See [Workflows](workflows.md).

## Creating and Editing Events

You can create and edit events in the Events page of the UI or via the API. The minimum you typically need:

- `title`: Human-friendly name, displayed in the UI.
- `category`: Controls access and provides default actions/limits. See [Categories](categories.md).
- `plugin`: The Event Plugin that runs the job code (not required for workflow events).  See [Event Plugins](plugins.md#event-plugins).
- `targets`: One or more servers and/or groups where jobs may run.
- `algo`: Server selection algorithm when multiple targets are available (default is random).
- `params`: Plugin parameters passed to your job. Locked parameters may be enforced by admins or categories.
- `fields`: Optional user-defined parameters that are prompted when launching manually, then merged into params.
- `tags`: Labels that help searching and filtering job history.  See [Tags](tags.md).
- `triggers`: One or more entries that determine run timing and rules.  See [Triggers](triggers.md).
- `limits`: Self-imposed resource constraints for the job to follow.  See [Limits](limits.md).
- `actions`: Optional per-event notifications/chaining behavior.  See [Actions](actions.md).

## How Events Run

Running an event produces a job. Here is the lifecycle from trigger to execution:

1. **Trigger fires**
	- The scheduler evaluates all event triggers once per minute (with optional second precision) and emits launches when conditions match.
	- Manual runs from the UI/API also count as launches. 
2. **Job object is created**
	- The job starts as a copy of the event plus trigger context and any user/API overrides. 
	- It is assigned a unique `job.id`, and `job.event` is set to the event’s ID. 
	- Category-defined actions/limits and system defaults are merged in. 
3. **Parameters resolved**
	- `event.params` and any prompted `fields` are merged and can use `{{ macros }}` that resolve against the job context (including `input.data` and `input.files` if present).
4. **Target selection**
	- The system collects candidate servers from targets (servers and/or groups), filters to enabled, online servers, and optionally removes servers under active job-limiting alerts. 
	- If no servers are available, a queue limit (if configured) may place the job in a queue; otherwise the job aborts and may be eligible for retry. 
	- Details on server algorithms appear below.
5. **Plugin execution**
	- Once a server is chosen, the job is dispatched to that server’s xySat agent and the Event Plugin runs with the final parameters and environment. 
	- Output streams into the job log; CPU/memory/IO metrics are sampled for limits and history. 
	- See [Event Plugins](plugins.md#event-plugins) for plugin anatomy and execution details.
6. **Limits and actions**
	- Active limits (time, log size, CPU, memory, etc.) are continuously evaluated. 
	- When exceeded, configured actions fire (email, web hooks, tags, snapshots, abort, etc.).
7. **Completion**
	- On finish, final actions run (success/fail/progress/abort, plus any tag‑based actions), and the job record is stored in history for searching and analytics.

## Triggers

Triggers define when jobs are allowed to launch, and optional modifiers. Common patterns:

- `manual`: Allows on‑demand runs via UI/API. If omitted or disabled, manual runs are rejected.
- `schedule`: Cron‑style arrays of years/months/days/weekdays/hours/minutes with optional timezone.
- `interval`: Run every N minutes; mutually exclusive with precision/delay.
- `single`: One-time run at a specific date/time.
- `plugin`: Scheduler Plugin decides when to run; useful for external signals.
- Modifiers: `catchup`, `range`, `blackout`, `delay`, `precision` provide windowing, lockouts, and sub‑minute behavior.

See the full trigger list and composition rules: [Triggers](triggers.md).

## Server Selection

The `targets` list may contain server IDs and/or group IDs. At launch time xyOps:

- Expands groups into member servers and de‑duplicates the list.
- Filters to currently enabled, online servers.
- Optionally removes servers that are under active blocking alerts (e.g. maintenance or capacity limits).
- If the resulting set is empty, and a `queue` limit is present, the job may enter a per‑event queue up to the configured size; otherwise it aborts with a retry‑ok flag.

Selection among remaining candidates is controlled by `algo`:

- `random`: Choose randomly among candidates.
- `round_robin`: Cycle through candidates in order, persisting position between runs.
- `least_cpu`: Choose the server reporting the lowest CPU load.
- `least_mem`: Choose the server reporting the lowest active memory.
- `prefer_first` / `prefer_last`: Prefer first/last by hostname sort for stability.
- `monitor:<id>`: Choose the server with the smallest current value of a specific monitor.

The chosen server ID is stored on the job as `server` and the server’s group memberships are copied into `groups` for analytics.

## Plugins

Every non‑workflow event references an Event Plugin via `plugin`, which defines how to execute the job: command/script, user/group IDs, kill signals, and parameter definitions. The scheduler copies missing default parameter values from the plugin spec at launch time, and enforces locked/required parameters for non‑admin users.

- **Parameters**: `params` are passed to the plugin. Locked/required attributes can be set by admins or categories. Optional `fields` collected at manual run time are merged into `params`.
- **Environment**: Jobs inherit configured `job_env` plus any event‑specific `env` overrides.  Additionally, all Plugin params are passed as environment variables as well.
- **Input**: Jobs may include structured `input.data` and uploaded `input.files` when launched from the UI/API. Actions like “Bucket Fetch” can also populate inputs before your code runs.

See [Event Plugins](plugins.md#event-plugins) for plugin parameters, and lifecycle details.

## Limits

Limits constrain running jobs and optionally trigger actions. Common types include:

- `time`: Maximum wall clock duration.
- `log`: Maximum output size (bytes).
- `cpu` and `mem`: Sustained usage thresholds with grace periods.
- `queue`: Allow queuing when no targets are available, up to N jobs per event.

Limits can apply tags, send email/web hooks, generate snapshots, and abort jobs. Event limits combine with category defaults and universal limits. See docs/limits.md for complete reference and UI usage.

## Actions

Actions run at specific job lifecycle stages and conditions: `start`, `progress`, `success`, `warning`, `critical`, `abort`, `complete`, and tag‑based triggers (`tag:xyz`). Actions can:

- Send email to users and/or custom addresses.
- Fire web hooks with rich job payloads.
- Run another event (chaining).
- Invoke an [Action Plugin](plugins.md#action-plugins).
- Store or fetch job files/data to/from [Storage Buckets](buckets.md).
- Create [Tickets](tickets.md), post to [Channels](channels.md), capture [Server Snapshots](snapshots.md), and more.

Event actions combine with category defaults and universal actions. See [Actions](actions.md) for all action types and configuration.

## Manual Runs and Prompts

To allow on‑demand runs from the UI or API, include an enabled `manual` trigger on the event. When launching manually:

- Any `fields` defined on the event are presented as a UI form, and their values are merged into `params`.
- The UI/API may attach uploaded files; these become `input.files`. Arbitrary JSON may be provided as `input.data` when testing.
- Non‑admin users must satisfy any locked/required parameters defined by the plugin or event fields; the system enforces these and applies defaults.

To run an event programmatically, see [API](api.md) for the run endpoint and parameter overrides.

## Permissions and Inheritance

- You must have privileges to create/edit events and to run jobs. The system enforces category and target privileges for all operations including history access where applicable.
- Category actions and limits are appended to the event at runtime. Universal actions/limits may also apply based on system configuration.

## Workflows

Workflow events are special "multi-event" graphs with connected nodes. Triggers on a workflow event define entry points into the graph. When launched, the workflow orchestrates sub‑jobs and actions per node and connection. See [Workflows](workflows.md) for full details.

## Related Reading

- Event schema: [Event](data.md#event)
- Triggers: [Triggers](triggers.md)
- Plugins: [Plugins](plugins.md)
- Limits: [Limits](limits.md)
- Actions: [Actions](actions.md)
- API: [API](api.md)

## Example

Here is a trimmed example of an event in JSON format (see [Data Structures](data.md#event) for the complete version):

```json
{
  "id": "event100",
  "title": "Diverse heuristic complexity",
  "enabled": true,
  "category": "cat9",
  "plugin": "shellplug",
  "params": { "script": "#!/bin/bash\nsleep 30; echo HELLO;\n" },
  "targets": ["main"],
  "algo": "random",
  "triggers": [ { "type": "schedule", "enabled": true, "hours": [19], "minutes": [6] } ],
  "limits": [ { "type": "time", "enabled": true, "duration": 3600 } ],
  "actions": [ { "enabled": true, "condition": "error", "type": "email", "email": "admin@localhost" } ]
}
```

When the scheduled time hits, a job is created from this event, a server is chosen using the `random` algorithm among eligible targets, the `shellplug` plugin runs the script, and any limits/actions apply during the run.
