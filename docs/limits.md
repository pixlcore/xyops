# Limits

Limits are self-imposed restrictions you can place on your events, to govern resource usage as the job runs, as well as specify options such as max number of retries, or max allowed jobs to queue up.  Limits can be defined at several different levels, including directly on events, attached as workflow nodes, inherited from categories, or inherited from your global configuration file (a.k.a "universal" limits).

In some cases when multiple limits of the same type are present for a job, only one limit will apply.  This is true for [Max Concurrent Jobs](#max-concurrent-jobs), [Max Retry Limit](#max-retry-limit), [Max Queue Limit](#max-queue-limit), and [Max File Limit](#max-file-limit).  For these limits xyOps will pick the first enabled limit it finds of the selected type, with the limits presorted in this order:

- Event defined limits *(highest priority)*
- Workflow limit nodes
- Category inherited limits
- Universal inherited limits *(lowest priority)*

For other limit types, e.g. [Max Run Time](#max-run-time), [Max Output Size](#max-output-size), [Max CPU Limit](#max-cpu-limit) and [Max Memory Limit](#max-memory-limit), when multiple limits are present, all of them are applied.  For example, you may want to emit a warning when a job uses 500MB of memory, but abort the job if the memory usage reaches 1GB.  You can achieve this by adding two separate limits, and they will both be honored.

This document explains how limits work, where they are defined, precedence and inheritance, and details each limit type with parameters and examples.

## Overview

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
- xyOps consults the first matching limit by `type` for start‑time checks like Max Concurrent Jobs (`job`) and Max Queue (`queue`). 
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

### Max Run Time

Enforce a soft or hard cap on total job elapsed time. When exceeded, optional actions can be taken (tags, email, web hook, snapshot) and the job can be aborted.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Set to `time` for max run time. |
| `duration` | Number | Yes | Maximum runtime in seconds. |
| `tags` | Array<String> | Optional | Apply these [Tag.id](data.md#tag-id) values when exceeded. |
| `users` | Array<String> | Optional | Email these [User.username](data.md#user-username) users. |
| `email` | String | Optional | Additional comma‑separated email addresses. |
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

### Max Concurrent Jobs

Limit how many jobs of the same event/workflow may run at once. If the cap is reached, xyOps can queue the job if a `queue` limit allows it; otherwise the job is aborted.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `job` for max concurrent jobs. |
| `amount` | Number | Yes | Maximum number of concurrent active jobs for the event/workflow. |

Notes:

- Scope for workflows matches the workflow’s event; for ad‑hoc workflow node jobs, the queue scope includes the node ID.
- Works in tandem with `queue`: without a queue, jobs are aborted when the limit is reached.

Example:

```json
{
  "enabled": true,
  "type": "job",
  "amount": 2
}
```

### Max Output Size

Cap the job’s output/log size (bytes). When exceeded, optional actions can be taken and the job can be aborted.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `log` for max output size. |
| `amount` | Number | Yes | Maximum bytes of output/log content. |
| `tags` | Array<String> | Optional | Apply these tags when exceeded. |
| `users` | Array<String> | Optional | Email these users. |
| `email` | String | Optional | Additional comma‑separated email addresses. |
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
| `tags` | Array<String> | Optional | Apply these tags when exceeded. |
| `users` | Array<String> | Optional | Email these users. |
| `email` | String | Optional | Additional comma‑separated email addresses. |
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
  "tags": ["memory-hot"],
  "snapshot": true,
  "abort": true
}
```

### Max CPU % Limit

Cap CPU usage for the job (including child processes). The limit triggers only if CPU stays over the threshold continuously for the sustain duration. Optional actions can be taken and the job can be aborted.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `cpu` for max CPU limit. |
| `amount` | Number | Yes | CPU percentage, where `100` equals one core fully utilized. |
| `duration` | Number | Yes | Sustain time in seconds over the limit before triggering. |
| `tags` | Array<String> | Optional | Apply these tags when exceeded. |
| `users` | Array<String> | Optional | Email these users. |
| `email` | String | Optional | Additional comma‑separated email addresses. |
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

Control how many retries are attempted for failed jobs, and optionally how long to wait between retries. On each retry, xyOps clones the job context, increments `retry_count`, and optionally delays before relaunch.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `retry` for max retry limit. |
| `amount` | Number | Yes | Maximum number of retries to attempt. `0` disables retries. |
| `duration` | Number | Optional | Delay in seconds between retries. |

Example:

```json
{
  "enabled": true,
  "type": "retry",
  "amount": 3,
  "duration": 60
}
```

### Max Queue Limit

Cap how many jobs are allowed to wait in the queue when concurrency or server availability prevents immediate start. Without a queue limit, jobs are aborted when they cannot start due to `job` or server selection limits.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `queue` for max queue limit. |
| `amount` | Number | Yes | Maximum number of queued jobs allowed. `0` disables queueing. |

Example:

```json
{
  "enabled": true,
  "type": "queue",
  "amount": 25
}
```

### Max File Limit

Soft limit that prunes incoming files (from job input) before launch. It can cap the number of files, the total combined size, and restrict file types by extension. This limit never aborts the job; it prunes and logs what was removed.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | String | Yes | Set to `file` for max file limit. |
| `amount` | Number | Yes | Maximum number of input files allowed. `0` means **no** files permitted. |
| `size` | Number | Optional | Maximum total combined size (bytes) for all files. |
| `accept` | String | Optional | Comma‑separated list of file extensions to allow (include the leading dot, case‑insensitive), e.g. `.json,.csv`. |

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

- Start‑time enforcement: `job`, `queue`, and `file` limits are evaluated before launch. `job`/`queue` determine whether a job runs now, queues, or aborts. `file` prunes input.
- Runtime enforcement: `time`, `log`, `mem`, `cpu` are checked while the job runs. `mem` and `cpu` require sustained overages for their `duration` before triggering.
- Triggered actions: For `time`, `log`, `mem`, `cpu`, when exceeded xyOps can apply tags, send emails, fire a web hook (with optional extra text), take a snapshot, and abort the job. All actions are recorded in the job’s Activity log with details.
- Multiple similar limits: If multiple sources define the same type, the event/workflow definition takes precedence for start‑time checks.
- Queues and scope: Queues are per event. For ad‑hoc workflow node runs, the queue scope includes the node identifier to avoid cross‑contending unrelated nodes. Queues are used both when `job` concurrency is saturated and when no matching servers are currently available.

See also: [Limit](data.md#limit) and [Limit Types](data.md#limit-type) for the canonical data structure definitions.
