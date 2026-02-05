# Triggers

## Overview

Triggers in xyOps define when and how an event (or workflow) is allowed to run jobs. You compose one or more triggers on an event to describe automatic schedules, one-time launches, manual control, blackout windows, and optional behaviors like catch-up, delays, and sub-minute precision. The scheduler evaluates triggers once per minute (with optional second-level precision), launches matching jobs, and enforces any options.

This document explains how triggers work, how they combine, and details each trigger type with parameters and examples.

## Key Points

- Each trigger is a small definition object with two core fields: `enabled` and `type`. Extra fields depend on the type.
- An event may have multiple triggers. Some types produce launches (schedule, interval, single, plugin). Others augment or constrain scheduling (manual, catchup, range, blackout, delay, precision).
- The scheduler runs on the conductor once per minute. For schedule/interval/plugin triggers, it computes matching minutes (and optional seconds) and launches jobs accordingly.
- Timezones are supported for schedule/plugin triggers via a `timezone` field. Range/blackout/interval times are "absolute" and thus timezone-agnostic.

Example minimal trigger (JSON format):

```json
{
  "type": "schedule",
  "enabled": true,
  "minutes": [0]
}
```

This would run exactly once hourly, on the `0` minute.  It is equivalent to `0 * * * *` in cron syntax.

## User Interface

- Triggers can be added while creating or editing events.  They're listed in a table just above the event limits, with an "Add Trigger" button.
- For workflows, triggers are added as nodes on the graph, which are then connected to other nodes to setup potentially different entrypoints per trigger.

## Trigger Object

All trigger objects include these common properties:

| Property | Type | Description |
|---------|------|-------------|
| `enabled` | Boolean | Enable (`true`) or disable (`false`) the trigger. Disabled triggers are ignored. |
| `type` | String | Which trigger behavior to apply. See Trigger Types below. |

Additional properties are required based on the trigger type.

## Composition Rules

Some combinations are restricted to keep scheduling unambiguous. These rules are enforced by the API and UI:

- Uniqueness (enabled): Only one of each per event: `manual`, `catchup`, `range`, `precision`, `delay`.
- Mutual exclusions (enabled):
  - `interval` and `precision` are mutually exclusive.
  - `interval` and `delay` are mutually exclusive.
  - `precision` and `delay` are mutually exclusive.
- Launching triggers: Only `manual`, `schedule`, `interval`, `single`, and `plugin` produce launches. Others act as modifiers or constraints.
- Range triggers are modifiers that only allow launches between a start and end date/time.
- Blackout triggers are the inverse of ranges; they disallow launches between a start and end date/time.
- You may add multiple ranges and blackouts.

## Trigger Types

The following trigger types are available.

### Manual Run

Allow the event to be launched on demand by users (UI) and API keys (API). Does not produce automatic runs.  Skips over modifiers like [Catch-Up](#catch-up), [Range](#range), [Blackout](#blackout), [Delay](#delay), [Precision](#precision) and [Plugin](#plugin).

Parameters: None

Notes:

- If an event does not have an enabled `manual` trigger, attempts to run it via the API/UI are rejected (unless test paths are used).

Example:

```json
{
  "type": "manual",
  "enabled": true
}
```

### Schedule

Define a repeating schedule similar to [Unix Cron](https://en.wikipedia.org/wiki/Cron) using arrays of years, months, days, weekdays, hours, and minutes. Omitted fields mean "all" in that category. Evaluation occurs in the selected timezone (or the server default if omitted).

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `years` | Array(Number) | Optional | One or more years in YYYY format. |
| `months` | Array(Number) | Optional | Months 1-12 (Jan=1 ... Dec=12). |
| `days` | Array(Number) | Optional | Month days 1-31, or reverse month days −1 to −7 (−1 = last day, −2 = second-to-last, etc.). |
| `weekdays` | Array(Number) | Optional | Weekdays 0-6 (Sun=0 ... Sat=6). |
| `hours` | Array(Number) | Optional | Hours 0-23 (24-hour clock). |
| `minutes` | Array(Number) | Optional | Minutes 0-59. |
| `timezone` | String | Optional | IANA timezone for evaluating the schedule (defaults to server timezone). |
| `params` | Object | Optional | Optionally include parameter overrides for the event / plugin. |
| `tags` | Array | Optional | Optionally include a set of [Tag.id](data.md#tag-id)s to add to the job as it starts. |

Notes:

- You may specify both `days` and `weekdays`. All criteria must match.
- If any list is empty or omitted, it is treated as "all" (a.k.a `*` in cron parlance).
- Reverse month days allow "last day of month" style expressions.

Example: Twice daily at 4:30 AM and 4:30 PM in `America/New_York`:

```json
{
  "type": "schedule",
  "enabled": true,
  "hours": [4, 16],
  "minutes": [30],
  "timezone": "America/New_York"
}
```

Example: Last day of every month at 23:55:

```json
{
  "type": "schedule",
  "enabled": true,
  "days": [-1],
  "hours": [23],
  "minutes": [55]
}
```

### Interval

Run the event on a fixed interval starting from a specific epoch. Timezone-agnostic and can launch multiple jobs within the current minute at second offsets.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `start` | Number | Yes | Start time as Unix timestamp (seconds). First launch occurs on or after this time aligned to the interval. |
| `duration` | Number | Yes | Interval length in seconds. Must be > 0. |
| `params` | Object | Optional | Optionally include parameter overrides for the event / plugin. |
| `tags` | Array | Optional | Optionally include a set of [Tag.id](data.md#tag-id)s to add to the job as it starts. |

Notes:

- The scheduler computes all hits within the current minute and launches at the exact second(s).
- Mutually exclusive with `precision` and `delay`.

Example: Every 90 seconds starting at a specific time:

```json
{
  "type": "interval",
  "enabled": true,
  "start": 1754580000,
  "duration": 90
}
```

### Single Shot

Launch exactly once at the specified absolute timestamp.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `epoch` | Number | Yes | Exact Unix timestamp (seconds) when to run. |
| `params` | Object | Optional | Optionally include parameter overrides for the event / plugin. |
| `tags` | Array | Optional | Optionally include a set of [Tag.id](data.md#tag-id)s to add to the job as it starts. |

Example:

```json
{
  "type": "single",
  "enabled": true,
  "epoch": 1754631600
}
```

### Magic Link

This trigger type generates a unique URL to start a job from a web request (a.k.a. an "incoming web hook").  The authentication is built into the URL via a unique cryptographic token.  Two different links are provided to the user at trigger creation time:

- A direct link to start a job via a simple URL request (the response is JSON).
- A link to a standalone HTML landing page (no login required), where the user can provide event parameters, and upload files (if allowed).

For the direct link, you can include any query string and/or POST parameters with the request, and they will be passed directly into the [Job.params](data.md#job-params) object for the running job.  You can then access them inside your job plugin script by reading the JSON from STDIN, or by using environment variables.

For the landing page presentation, when the job is started, progress is streamed back to the page for live updates.  When the job completes, the user is presented with the job results, including any output files, data, and other user-provided content in the job.

This is an "on-demand" trigger, and thus it skips over modifiers like [Catch-Up](#catch-up), [Range](#range), [Blackout](#blackout), [Delay](#delay), [Precision](#precision) and [Plugin](#plugin).

Trigger Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | String | Yes | Upon creation, the client supplies the plain text key, which is then hashed into a token on the server side.  The plain key is never stored. |
| `token` | String | n/a | Upon creation, the `key` is hashed (using salted SHA-256) to produce a cryptographic token that is stored in this property. |
| `body` | String | Optional | Custom Markdown text to render onto the landing page. |

Example:

```json
{
  "type": "magic",
  "enabled": true,
  "token": "592b38cb583c1d028dde1dc7ec69a4865c321dd2e4ce09f4700f286ec7f18021",
  "body": "Hello!  This is custom **markdown** content for the _landing page_!"
}
```

### Startup

This trigger will automatically run a job for the event on xyOps startup.  Specifically, this happens when the xyOps service first starts up and becomes the primary conductor, the scheduler master switch is enabled, and the process uptime is less than 5 minutes (avoids running upon failover to a backup conductor).

It is **highly recommended** that you also add a [Max Queue Limit](limits.md#max-queue-limit) to the event when this trigger is used.  This ensures that if no target servers are available (very common on initial startup), the job will be queued up until at least one server in the target set is available.  Then it will automatically dequeue and run proper.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `params` | Object | Optional | Optionally include parameter overrides for the event / plugin. |
| `tags` | Array | Optional | Optionally include a set of [Tag.id](data.md#tag-id)s to add to the job as it starts. |

Note that the startup trigger will not activate if the xyOps service was manually restarted due to a user-requested upgrade, restart or shutdown action from the UI.

### Catch-Up

Catch-up mode is an optional feature designed to ensure that an event always runs on schedule, even when certain situations arise that may temporarily prevent its execution. This can include scenarios such as:

- Shutting down the xyOps service
- Pausing the scheduler
- Disabling the scheduler or catch-up triggers in the event
- Disabling the entire event

When catch-up mode is enabled, xyOps will execute **all** the scheduled jobs for the event, including any missed ones that should have run during the "downtime".

Internally, catch-up mode maintains a "cursor" in the xyOps database for every event, which points to a specific timestamp.  Whenever a job runs on schedule, the following occurs:

- The cursor advances to the next minute, stopping at the current time.
- In the event of a time gap, the cursor advances minute-by-minute up to the current time, to ensure that no scheduled jobs are missed.

You can manually set the cursor time by editing the catch-up trigger option for an event.  Use this to replay past events, or jump ahead to the current time.

Catch-Up mode will **not** re-run jobs that failed or were aborted.  This is by design.  If you would like failed jobs to automatically re-run, set a [Max Retry Limit](limits.md#max-retry-limit).

Parameters: None

Notes:

- Applies to schedule/interval triggers on the same event.
- On each scheduler tick, the event's cursor advances one minute at a time, evaluating schedules for each minute until present time.
- Long outages can produce a backlog of late jobs; ensure your event and infrastructure can handle catch-up bursts.
- Time Machine: In the UI you can set a custom cursor timestamp to re-run a historical window (set cursor in the past) or skip a backlog (set cursor near "now").

Example:

```json
{
  "type": "catchup",
  "enabled": true
}
```

### Range

Restrict scheduling to a date/time window. Prevents launches before `start` and after `end` (unless time is inside another range). Endpoints are inclusive.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `start` | Number | Optional | Earliest allowed time (Unix seconds). |
| `end` | Number | Optional | Latest allowed time (Unix seconds). |

Notes:

- Ranges may be open or closed.  Meaning, you can specify only `start`, only `end`, or both. If both are set, `start` must be ≤ `end`.
- Applies to automatic triggers (schedule/interval/plugin/single). Does not affect manual runs.

Example: Only run between March 1 and May 31 (inclusive):

```json
{
  "type": "range",
  "enabled": true,
  "start": 1740787200,
  "end": 1748649600
}
```

### Blackout

Prevent any automatic launches during a specific date/time window. Endpoints are inclusive.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `start` | Number | Yes | Start of blackout (Unix seconds). |
| `end` | Number | Yes | End of blackout (Unix seconds). Must be ≥ `start`. |

Notes:

- Useful for maintenance windows or holidays.
- Applies to automatic triggers (schedule/interval/plugin/single). Does not affect manual runs.

Example:

```json
{
  "type": "blackout",
  "enabled": true,
  "start": 1754694000,
  "end": 1754780400
}
```

### Delay

Add a starting delay to all scheduler-launched jobs for the event. Does not affect manual/API runs. Mutually exclusive with `interval` and `precision`.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `duration` | Number | Yes | Delay in seconds added to the scheduled start time. Must be ≥ 1. |

Example (delay all launches by 2 minutes):

```json
{
  "type": "delay",
  "enabled": true,
  "duration": 120
}
```

### Precision

Launch within the scheduled minute at specific second offsets. Augments other automatic triggers to achieve sub-minute starts. Mutually exclusive with `interval` and `delay`.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `seconds` | Array(Number) | Yes | One or more second offsets within 0-59. |

Notes:

- Applies to scheduled minutes (and to interval minutes when compatible). Multiple jobs may be launched in a single minute at the listed seconds.
- Does not affect manual/API runs.

Example (launch at :05, :20, :35, :50 within each matched minute):

```json
{
  "type": "precision",
  "enabled": true,
  "seconds": [5, 20, 35, 50]
}
```

### Plugin

Use a custom [Trigger Plugin](plugins.md#trigger-plugins) to decide whether to launch a job or not. The plugin runs with configured parameters and returns a launch/no-launch decision per each scheduled run.  This is a "modifier" so it needs to be used in conjunction with a standard schedule trigger.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `plugin_id` | String | Yes | ID of a configured Plugin of type `scheduler`. |
| `params` | Object | Optional | Plugin-defined configuration key/values. |
| `timezone` | String | Optional | Timezone context provided to the plugin (defaults to server timezone). |

Notes:

- At a high level, xyOps invokes the plugin once per scheduled run with context, and launches jobs if the plugin indicates so. Plugins can also request a per-launch delay and may provide input data/files for the job.  See [Plugins](plugins.md) for details.
- For use cases like watching for new files, set a schedule trigger to run every minute, so the Plugin is checked as often as possible.

Example:

```json
{
  "type": "plugin",
  "enabled": true,
  "plugin_id": "queue_gate",
  "params": { "queue": "nightly", "threshold": 100 },
  "timezone": "UTC"
}
```

See [Trigger Plugins](plugins.md#trigger-plugins) for more details.

## Notes on Workflows

Workflows use the same event trigger system. When a scheduled workflow launches, the scheduler records which trigger initiated the start so the workflow can reference it internally.

## Validation

When you save or run an event, xyOps validates triggers:

- Types and required parameters must be present and well-formed.
- Ranges: `start` ≤ `end` where applicable. Blackout requires both.
- Schedule lists must contain numbers in valid ranges; `days` may include −1...−7 to represent reverse month days.
- Enabled uniqueness and mutual exclusion rules are enforced (see Composition Rules).

For complete data structure details, see [Trigger](data.md#trigger) and [Trigger.type](data.md#trigger-type).
