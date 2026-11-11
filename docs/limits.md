# Limits

## Overview

Limits are self-imposed restrictions you can place on your events, to govern resource usage as the job runs, as well as specify options such as max number of retries, or max allowed jobs to queue up.  Limits can be defined at several different levels, including directly on events, attached as workflow nodes, inherited from categories, or inherited from your global configuration file (a.k.a "universal" limits).

In some cases when multiple limits of the same type are present for a job, only one limit will apply.  This is true for [Max Jobs Limit](#max-jobs-limit), [Max Retry Limit](#max-retry-limit), [Max Queue Limit](#max-queue-limit), and [Max File Limit](#max-file-limit).  For these limits xyOps will pick the first enabled limit it finds of the selected type, with the limits presorted in this order:

- Event defined limits *(highest priority)*
- Workflow limit nodes
- Category inherited limits
- Universal inherited limits *(lowest priority)*

For other limit types, e.g. [Max Time Limit](#max-time-limit), [Max Output Limit](#max-output-limit), [Max CPU Limit](#max-cpu-limit) and [Max Memory Limit](#max-memory-limit), when multiple limits are present, all of them are applied.  For example, you may want to emit a warning when a job uses 500MB of memory, but abort the job if the memory usage reaches 1GB.  You can achieve this by adding two separate limits, and they will both be honored.

This document explains how limits work, where they are defined, precedence and inheritance, and details each limit type with parameters and examples.

## Key Points

- Limits apply to both events and workflows. Workflows are just events in this context and support all limit types.
- Categories can define default limits that auto-inherit to all events in the category. Events can override category defaults.
- Universal defaults can be set in the main config and auto-inherit to all jobs/workflows.
- Resource limits for running jobs (time, log size, memory, CPU) can trigger additional actions such as applying tags, sending email, firing a web hook, taking a snapshot, and optionally aborting the job.

Minimal example (JSON):

```json
{
	"enabled": true,
	"type": "time",
	"duration": 3600
}
```

## Where Limits Are Defined

- **Event / Workflow** editor: Add limits directly to a specific job or workflow.
- **Category** editor: Add default limits that all events in the category inherit.
- **Configuration**: Add universal defaults in `job_universal_limits` for event jobs or only workflows.

## Scope, Inheritance, and Precedence

- All three sources can contribute limits: event/workflow, category, and universal.
- Precedence is by source order when launching jobs:
	- Event/workflow limits first (highest precedence)
	- Category limits next
	- Universal limits last
- xyOps consults the first matching limit by `type` for start-time checks like Max Jobs Limit (`job`) and Max Queue (`queue`).
- For running resource checks (`time`, `log`, `mem`, `cpu`), multiple limits can exist, and they all apply, and can perform separate actions.

## Limit Object

All [Limit](data.md#limit) objects include these common properties:

| Property | Type | Description |
|---------|------|-------------|
| `enabled` | Boolean | Enable (`true`) or disable (`false`) the limit. |
| `type` | String | Which limit to apply. See Limit Types below. |

Additional properties are required based on the limit type.

## Limit Types

The following limit types are available. Each section below describes behavior, parameters, and includes an example.

### Max Time Limit

Enforce a soft or hard cap on total job elapsed time. When exceeded, optional actions can be taken (tags, email, web hook, snapshot) and the job can be aborted.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `time` for the Max Time Limit. |
| `duration` | Number | Yes | Maximum runtime in seconds. |
| `tags` | Array(String) | Optional | Apply these [Tag.id](data.md#tag-id) values when exceeded. |
| `users` | Array(String) | Optional | Email these [User.username](data.md#user-username) users. |
| `email` | String | Optional | Additional comma-separated email addresses. |
| `web_hook` | String | Optional | Fire this [WebHook.id](data.md#webhook-id) when exceeded. |
| `text` | String | Optional | Custom text appended to the web hook message. |
| `snapshot` | Boolean | Optional | Take a server snapshot when exceeded. |
| `abort` | Boolean | Optional | Abort the job when exceeded. |

Example:

```json
{
	"enabled": true,
	"type": "time",
	"duration": 3600,
	"tags": ["limited"],
	"users": ["oncall"],
	"email": "ops@example.com",
	"web_hook": "slack_ops",
	"text": "Runaway protection triggered",
	"snapshot": true,
	"abort": true
}
```

### Max Jobs Limit

Limit how many jobs of the same event/workflow may run at once, and optionally limit the rate as well. If the cap is reached, xyOps can queue the job if a `queue` limit allows it; otherwise the job is aborted.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `job` for the Max Jobs Limit. |
| `amount` | Number | Yes | Maximum number of concurrent active jobs for the event/workflow. |
| `weight` | Number | No | Optional job weight, used in server targeting calculations. |
| `rate` | Number | No | Optional non-negative integer that caps how many jobs may start during a rate window.  Set to `0` to disable rate limiting.  See [Rate Limiting](#rate-limiting) below. |
| `window` | Number | Conditional | Rate limit window selection encoded in seconds.  Required when `rate` is present, and must be `1`, `60`, `3600`, or `86400`.  The `86400` option represents one local calendar day. |
| `cap_key` | String | No | Optional shared capacity key, used for joining a concurrency pool.  See [Shared Capacity Key](#shared-capacity-key) below. |

Notes:

- Scope for workflows matches the workflow's event; for ad-hoc workflow node jobs, the queue scope includes the node ID.
- Works in tandem with `queue`: without a queue, jobs are aborted when the limit is reached.
- The optional `weight` is used to determine if a server can run the job.  See [Max Jobs Per Server](servers.md#max-jobs-per-server).

Example:

```json
{
	"enabled": true,
	"type": "job",
	"amount": 2
}
```

#### Rate Limiting

The Max Jobs Limit can also restrict how many jobs may **start** during a period of time.  Add the `rate` and `window` properties to the same limit as the concurrency `amount`:

```json
{
	"enabled": true,
	"type": "job",
	"amount": 2,
	"rate": 10,
	"window": 1
}
```

This allows up to 2 jobs to run concurrently and up to 10 jobs to start per second.  Concurrency and rate are separate checks, so a job may start only when both have available capacity.

The `rate` must be a non-negative integer.  Set it to `0` to disable rate limiting.  The `window` may only be set to the following values:

| Window | Description |
|--------|-------------|
| `1` | Per Second |
| `60` | Per Minute |
| `3600` | Per Hour |
| `86400` | Per Day |

Rate limits use simple fixed windows aligned to the local system time zone of the server acting as the active conductor.  Per-second windows expire on the next second, per-minute windows expire at the start of the next local minute, per-hour windows expire at the start of the next local hour, and per-day windows expire at the start of the next local day at midnight.  If a pool is first used partway through a window, it receives its full allowance for the remainder of that window.

When the rate is exhausted, a [Max Queue Limit](#max-queue-limit) allows additional jobs to wait for the next available window.  Without queue capacity, excess jobs are aborted instead of waiting.

If you configure a [Shared Capacity Key](#shared-capacity-key), the rate allowance is shared along with concurrency capacity.  All members of the shared pool must use identical concurrency, rate, window, and queue settings, including the maximum queue wait time.

For a complete explanation of fixed windows, queue behavior, shared pools, workflow scope, configuration changes, resets, recovery, and operational caveats, see the [Job Rate Limits Wiki](https://github.com/pixlcore/xyops/wiki/Rate-Limits).

#### Shared Capacity Key

By default, the Max Jobs Limit only counts similar jobs from the same event or workflow node.  You can optionally set a **Shared Capacity Key** to create a global capacity pool shared by multiple events and/or workflow nodes.  This is useful when otherwise unrelated jobs all consume the same limited resource, such as an external API, database, or deployment service.

For example, several events may call the Salesforce API, but you only want three of those jobs running at once across the entire xyOps cluster.  Configure each event with the same `cap_key` and Max Jobs Limit amount:

```json
"limits": [
	{
		"enabled": true,
		"type": "job",
		"amount": 3,
		"cap_key": "salesforce"
	},
	{
		"enabled": true,
		"type": "queue",
		"amount": 100
	}
]
```

Apply these limits to every event or workflow node that should join the pool.  xyOps will then allow no more than three jobs with the `salesforce` capacity key to run concurrently, regardless of which event, workflow, workflow node, or workflow execution launched them.

Capacity keys have the following requirements:

- Keys may contain lowercase letters, numbers, underscores, and hyphens.
- Keys may be up to 32 characters long.
- The UI automatically converts keys to lowercase, replaces whitespace with hyphens, and removes unsupported characters.
- All members of a shared pool must use the same Max Jobs Limit amount.  xyOps emits a warning to the job meta log if it detects differing amounts.
- All members using rate limiting must use the same rate and window.  Members should either all enable the same rate limit or all leave it disabled.  xyOps emits a warning to the job meta log if it detects differing rate settings.
- Each member must configure its own Max Queue limit if jobs should wait when the shared concurrency pool is full.

All waiting jobs with the same capacity key share one priority-first, FIFO queue.  High-priority jobs are considered first, followed by the oldest waiting job.  A member's Max Queue amount is compared against the total number of jobs already waiting in the shared pool.  All members must use the same Max Queue amount and maximum wait time (`duration`), including whether the wait time is unlimited.  xyOps emits a warning to the job meta log if it detects differing queue amounts or wait times.  Behavior is undefined when members use different settings.

When capacity becomes available, xyOps examines the oldest waiting job, after considering high-priority jobs first.  If no eligible target server is available for that job, it remains at the front of the queue and later jobs continue waiting, even if their target servers are available.  This preserves queue ordering.  For best results, jobs sharing a capacity key should target similarly available infrastructure.

### Max Output Limit

Cap the job's output/log size (bytes). When exceeded, optional actions can be taken and the job can be aborted.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `log` for the Max Output Limit. |
| `amount` | Number | Yes | Maximum bytes of output/log content. |
| `tags` | Array(String) | Optional | Apply these tags when exceeded. |
| `users` | Array(String) | Optional | Email these users. |
| `email` | String | Optional | Additional comma-separated email addresses. |
| `web_hook` | String | Optional | Fire this web hook. |
| `text` | String | Optional | Custom text appended to the web hook message. |
| `snapshot` | Boolean | Optional | Take a server snapshot when exceeded. |
| `abort` | Boolean | Optional | Abort the job when exceeded. |

Example:

```json
{
	"enabled": true,
	"type": "log",
	"amount": 10485760,
	"users": ["sre"],
	"abort": true
}
```

### Max Memory Limit

Cap total memory usage for the job (including child processes). The limit triggers only if usage stays over the threshold continuously for the sustain duration. Optional actions can be taken and the job can be aborted.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `mem` for max memory limit. |
| `amount` | Number | Yes | Maximum memory in bytes. |
| `duration` | Number | Yes | Sustain time in seconds over the limit before triggering. |
| `tags` | Array(String) | Optional | Apply these tags when exceeded. |
| `users` | Array(String) | Optional | Email these users. |
| `email` | String | Optional | Additional comma-separated email addresses. |
| `web_hook` | String | Optional | Fire this web hook. |
| `text` | String | Optional | Custom text appended to the web hook message. |
| `snapshot` | Boolean | Optional | Take a server snapshot when exceeded. |
| `abort` | Boolean | Optional | Abort the job when exceeded. |

Example:

```json
{
	"enabled": true,
	"type": "mem",
	"amount": 1073741824,
	"duration": 30,
	"tags": ["memoryhot"],
	"snapshot": true,
	"abort": true
}
```

### Max CPU Limit

Cap CPU usage for the job (including child processes). The limit triggers only if CPU stays over the threshold continuously for the sustain duration. Optional actions can be taken and the job can be aborted.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `cpu` for max CPU limit. |
| `amount` | Number | Yes | CPU percentage, where `100` equals one core fully utilized. |
| `duration` | Number | Yes | Sustain time in seconds over the limit before triggering. |
| `tags` | Array(String) | Optional | Apply these tags when exceeded. |
| `users` | Array(String) | Optional | Email these users. |
| `email` | String | Optional | Additional comma-separated email addresses. |
| `web_hook` | String | Optional | Fire this web hook. |
| `text` | String | Optional | Custom text appended to the web hook message. |
| `snapshot` | Boolean | Optional | Take a server snapshot when exceeded. |
| `abort` | Boolean | Optional | Abort the job when exceeded. |

Example:

```json
{
	"enabled": true,
	"type": "cpu",
	"amount": 250,
	"duration": 20,
	"users": ["oncall"],
	"web_hook": "slack_ops",
	"abort": true
}
```

### Max Retry Limit

Control how many retries are attempted for failed jobs, and optionally how long to wait between retries.  On each retry, xyOps clones the job context, increments `retry_count`, and optionally delays before relaunch.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `retry` for max retry limit. |
| `amount` | Number | Yes | Maximum number of retries to attempt. `0` disables retries. |
| `duration` | Number | Optional | Delay in seconds between retries. |
| `force` | Boolean | Optional | Set to `true` to retry jobs for any abort reason.  This is labeled **Always Retry on Abort** in the UI and defaults to `false`. |

Example:

```json
{
	"enabled": true,
	"type": "retry",
	"amount": 3,
	"duration": 60
}
```

#### Retry Eligibility

xyOps launches a retry only when all of the following conditions are true:

1. The job has an enabled **Max Retry Limit** with a non-zero `amount`.
2. The job completed with a non-zero result code.  Successful jobs with a code of `0` are never retried.
3. The current `retry_count` is less than the configured `amount`.
4. If the result code is `abort`, the abort is specifically allowed to retry, or the retry limit has `force` set to `true`.

All non-zero result codes other than `abort` are eligible for retry.  The `abort` result receives extra handling because an abort often represents an intentional stop rather than a normal job failure.

By default, the following abort situations are eligible for retry:

| Abort Situation | Description |
|-----------------|-------------|
| `No available servers matching targets.` | No online, enabled, and eligible server matched the job targets. |
| `No available servers matching targets, and the queue is full.` | No eligible server was available, and the applicable queue had no remaining capacity. |
| `No updates received in last x minutes, assuming job is dead.` | The conductor stopped receiving updates from an active job for the configured dead-job timeout. |
| `Server is shutting down.` | xySat aborted its active jobs during a non-graceful shutdown. |
| Runtime limit requested an abort | A **Max Time Limit**, **Max Output Limit**, **Max Memory Limit**, or **Max CPU Limit** was exceeded and its **Abort Job** option was enabled. |

Other aborts do not retry by default.  For example, a job will not normally retry after `Maximum number of concurrent jobs...` or `Manually aborted by user: x`.  To override this protection, enable **Always Retry on Abort** in the UI, or set `force` to `true` on the retry limit.  This only overrides the special abort restriction.  The job must still have a non-zero result code, an enabled retry limit, and retries remaining.

> [!TIP]
> Retry attempts launch immediately when `duration` is omitted or set to `0`.  For temporary conditions such as unavailable target servers, configure a delay so the server has time to reconnect or become eligible before the next attempt.

### Max Queue Limit

Cap how many jobs are allowed to wait in the queue when concurrency limits, rate limits, or unavailable servers prevent immediate start.  You can also set a maximum wait time so jobs are aborted if they stay queued too long.  Without a queue limit, jobs are aborted when they cannot start due to `job` or server selection limits.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `queue` for max queue limit. |
| `amount` | Number | Yes | Maximum number of queued jobs allowed. `0` disables queueing. |
| `duration` | Number | No | Maximum queue wait time in seconds.  Omit or set to `0` for unlimited waiting.  Jobs are aborted if their queue wait exceeds this duration. |

In the limit editor, set **Max Queue Size** to control how many jobs may wait, and **Max Wait Time** to control how long they may wait.  Leave **Max Wait Time** at `0` to preserve unlimited waiting.

Example allowing up to 25 waiting jobs, with a maximum wait of one hour:

```json
{
	"enabled": true,
	"type": "queue",
	"amount": 25,
	"duration": 3600
}
```

The wait time only covers time spent queued.  Startup and retry delays do not count toward it, and it does not limit how long a job may run after leaving the queue.  To limit execution time, use a [Max Time Limit](#max-time-limit).

Queue timeouts do not retry by default; [Always Retry on Abort](#retry-eligibility) can allow retries if a Max Retry Limit is configured.

> [!IMPORTANT]
> If you include a max queue limit with a non-zero amount you must also include a [Max Jobs Limit](#max-jobs-limit).

### Max File Limit

This is a soft limit that prunes incoming files (from job input) before launch. It can cap the number of files, the total combined size, and restrict file types by extension. This limit never aborts the job; it prunes and logs what was removed.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `file` for max file limit. |
| `amount` | Number | Yes | Maximum number of input files allowed. `0` means **no** files permitted. |
| `size` | Number | Optional | Maximum total combined size (bytes) for all files. |
| `accept` | String | Optional | Comma-separated list of file extensions to allow (include the leading dot, case-insensitive), e.g. `.json,.csv`. |

Example:

```json
{
	"enabled": true,
	"type": "file",
	"amount": 100,
	"size": 52428800,
	"accept": ".json,.csv,.tsv"
}
```

If this limit is present and the amount is `0`, then the file upload selector is hidden in the "Run Event" dialog and magic link form.

### Max Daily Limit

This limit will quietly prevent additional job launches if a specific daily condition count has been reached for the event.  For example, to cap the total number of jobs allowed per day for the event, set the condition to `complete` (fired for every job completion regardless of outcome).  To put an e-brake on critical errors, set the condition to `critical` and then set the amount accordingly.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `day` for max daily limit. |
| `condition` | String | Yes | Which job [condition](data.md#action-condition) to track in the daily stats (e.g. `complete`). |
| `amount` | Number | Yes | Maximum number of conditions allowed per day. |

Example:

```json
{
	"enabled": true,
	"type": "day",
	"condition": "complete",
	"amount": 100
}
```

The daily metrics can be reset on the "System" tab in the UI.

Note that manual job runs (i.e. by user or API key) skip over this check.

### Max Tag Limit

This is a soft limit that prunes tags before job launch, and on job completion (in case tags were added dynamically). This limit never aborts the job; it prunes and logs what was removed.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `tag` for max tag limit. |
| `amount` | Number | Yes | Maximum number of tags allowed on the job. `0` means **no** tags permitted. |

Example:

```json
{
	"enabled": true,
	"type": "tag",
	"amount": 0
}
```

If this limit is present and the amount set to `0`, then the tag selector is hidden in the "Run Event" dialog and magic link form.

## Universal Limits

Set universal defaults in the server config under [job_universal_limits](config.md#job_universal_limits). You can define separate arrays for `default` (regular events) and `workflow` limits. These are appended after category and event limits, so event/workflow settings take precedence.

Example:

```json
"job_universal_limits": {
	"default": [
		{ "enabled": true, "type": "retry", "amount": 2, "duration": 30 },
		{ "enabled": true, "type": "queue", "amount": 100 }
	],
	"workflow": []
}
```

## Notes and Behavior

- Start-time enforcement: `job`, `queue`, and `file` limits are evaluated before launch. `job`/`queue` determine whether a job runs now, queues, or aborts. `file` prunes input.
- Queue wait enforcement: A non-zero `duration` on a `queue` limit aborts jobs that wait too long, before they can leave the queue and start.
- Runtime enforcement: `time`, `log`, `mem`, `cpu` are checked while the job runs. `mem` and `cpu` require sustained overages for their `duration` before triggering.
- Triggered actions: For `time`, `log`, `mem`, `cpu`, when exceeded xyOps can apply tags, send emails, fire a web hook (with optional extra text), take a snapshot, and abort the job. All actions are recorded in the job's Activity log with details.
- Multiple similar limits: If multiple sources define the same type, the event/workflow definition takes precedence for start-time checks.
- Queues and scope: Queues are per event. For ad-hoc workflow node runs, the queue scope includes the node identifier to avoid cross-contending unrelated nodes. Queues are used both when `job` concurrency is saturated and when no matching servers are currently available.

See also: [Limit](data.md#limit) and [Limit Types](data.md#limit-type) for the canonical data structure definitions.
