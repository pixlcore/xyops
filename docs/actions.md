# Actions

## Overview

Actions in xyOps handle responses to job outcomes and alert state changes. You attach actions to events (jobs) and alerts so when specific conditions occur, xyOps executes one or more actions in parallel. Typical actions include sending email, firing a web hook, running a job, creating a ticket, taking a snapshot, and more.

This document explains how actions work, the conditions they support, and details each action type with parameters and examples.

## Key Points

- Actions are small definition objects with three core fields: `enabled`, `condition`, and `type`. Extra fields depend on the type.
- Job actions live in events and may fire when the job starts or completes with a specific outcome. Some action types are job-only.  Categories and universal defaults can add actions.
- Alert actions live in alert definitions and fire when an alert is created (fired) and/or cleared. Groups and universal defaults can add actions.
- Actions execute in parallel and are deduplicated per type + target (e.g., same email recipients, same web hook ID). Results are recorded in activity logs with details where available.

Example minimal action (JSON format):

```json
{
    "enabled": true,
    "condition": "error",
    "type": "email",
    "email": "admin@example.com"
}
```

## Where Actions Are Defined

- **Event editor**: Add job actions to run on job start or completion outcomes.
- **Workflow builder**: Attach job actions to workflow nodes.
- **Alert setup**: Add alert actions to run when alerts fire and/or clear.
- **Categories**: Event categories can set default job actions.
- **Groups**: Server groups can set default alert actions.
- **Universal**: The server config can add universal job and alert actions.

## Action Conditions

Each action has a `condition` selecting when it runs.

- **Job conditions**:
  - `start`: When the job first starts (before remote launch).
  - `complete`: When the job completes, regardless of outcome.
  - `success`: When the job completes successfully (i.e. with `code` equal to `0` or `false`).
  - `error`: When the job completes with any error (i.e. non-zero/non-false `code`).
  - `user`: When the job completes with a custom error code (i.e. not `warning`, `critical` or `abort`).
  - `warning`: When the job completes with `code` set to `"warning"`.
  - `critical`: When the job completes with `code` set to `"critical"`.
  - `abort`: When the job is aborted (by user or failure condition).
  - `tag:TAGID`: On job completion, only if the tag is present on the job.
- **Workflow conditions**:
  - `continue`: A special condition that fires from a [Controller](workflows.md#controller-nodes) in a workflow, after all the connected jobs complete.
- **Alert conditions**:
  - `alert_new`: When an alert fires on a server.
  - `alert_cleared`: When an active alert clears.

Notes:

- Job completion actions only fire if the job was not retried.  This includes tag conditions.
- Job start actions run before remote launch; a start action can suspend or abort a job before it launches.

## How Actions Run

- **Execution**: All matched actions for a given trigger run in parallel.
- **Deduplication**: Actions are deduped by a composite of type and target (e.g., email recipients, web hook ID, event ID, channel ID, plugin ID, bucket ID). This prevents sending duplicates when multiple sources contribute the same action.
- **Recording**: For jobs, action activity and details appear in the job's Activity log and metadata. For alerts, the invocation stores action results and details.

## Compatibility

Some action types are job-only and cannot be used with alerts:

- Job-only: Store Bucket (`store`), Fetch Bucket (`fetch`), Disable Event (`disable`), Delete Event (`delete`), Suspend Job (`suspend`).
- All others can be used with both jobs and alerts.

## Action Object

All [Action](data.md#action) objects include these common properties:

| Property | Type | Description |
|---------|------|-------------|
| `enabled` | Boolean | Enable (`true`) or disable (`false`) the action. |
| `condition` | String | When to run the action. See Action Conditions. |
| `type` | String | Which action to perform. See Action Types below. |

Additional properties are required based on the action type.

## Action Types

### Email

Send an email notification to one or more users and/or explicit email addresses. For jobs, the message includes context (links, log excerpt, performance, etc.). For alerts, templates include server context and links.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `users` | Array(String) | Optional | Array of [User.username](data.md#user-username) values to email. |
| `email` | String | Optional | One or more additional recipients, comma-separated. |
| `body` | String | Optional | Optionally customize the email subject and body using Markdown (see [Custom Email](#custom-email) below). |

Example (job error):

```json
{
    "enabled": true,
    "condition": "error",
    "type": "email",
    "users": ["oncall"],
    "email": "ops@example.com, dev@example.com"
}
```

Example (alert fired):

```json
{
    "enabled": true,
    "condition": "alert_new",
    "type": "email",
    "users": ["oncall", "sre"],
    "email": "noc@example.com"
}
```

#### Custom Email

If the `body` property is provided, this is used instead of a standard template for composing the email.  It should be a [GitHub-Flavored Markdown](https://github.github.com/gfm/) formatted multi-line text string.  You can also use the [xyOps Expression Format](xyexp.md) to pull in values from the [JobHookData](data.md#jobhookdata) object.

In addition, special metadata key/value pairs may be specified using [HTML Comments](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Comments) (which are ignored by the markdown parser) for things such as the email subject line.  The syntax is: `<!-- KEY: VALUE -->`.  Example use:

```
<!-- To: {{email_to}} -->
<!-- Subject: ✅ {{config.client.name}} Job Completed Successfully: {{event.title}} -->
<!-- Title: Job Successful -->
<!-- Button: View Details | {{links.job_details}} -->
```

Here is the list of supported comment properties you can include:

| Comment Key | Description |
|-------------|-------------|
| `To` | Becomes the email "To" header.  Use `{{email_to}}` for the combined list of recipients from the action. |
| `From` | Becomes the email "From" header.  Defaults to the [email_from](config.md#email_from) global configuration property. |
| `Subject` | Becomes the email "Subject" header. |
| `Title` | Displayed in large bold text inside the HTML email header.  Usually less verbose than the subject. |
| `Button` | Optionally include a large button in the header with a label and a link (separated by a pipe). |
| `Logo_URL` | Optionally customize the URL to the logo image used in the HTML email header. |
| `Version` | Optionally customize the version text shown in the HTML email footer. |
| `Copyright` | Optionally customize the copyright text shown in the HTML email footer. |

Here is the full template used when jobs complete successfully:

```
	<!-- To: {{email_to}} -->
	<!-- Subject: ✅ {{config.client.name}} Job Completed Successfully: {{event.title}} -->
	<!-- Title: Job Successful -->
	<!-- Button: View Details | {{links.job_details}} -->

	The following {{config.client.name}} job has completed successfully:

	- **Job ID:** `{{job.id}}`
	- **Event:** {{event.title}}
	- **Category:** {{category.title}}
	- **Plugin:** {{plugin.title}}
	- **Server:** {{nice_server}}
	- **PID:** {{job.pid}}
	- **Completed:** {{display.date_time}}
	- **Elapsed Time:** {{display.elapsed}}
	- **Performance Metrics:** `{{display.perf}}`
	- **Avg. Memory Usage:** {{display.mem}}
	- **Avg. CPU Usage:** {{display.cpu}}

	### Links:
	- [Job Details]({{links.job_details}})
	- [Download Log]({{links.job_log}}) ({{display.log_size}})

	### Job Files:
	{{links.job_files}}

	### Job Output:
	{{log_excerpt}}

	### Event Notes:
	{{job.notes}}
```

### Web Hook

Fire a configured outbound web hook. xyOps sends a templated payload with rich context (job or alert), and you may append custom text.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `web_hook` | String | Yes | The [WebHook.ID](data.md#webhook-id) for the hook. |
| `text` | String | Optional | Extra text appended to the generated message text. |

Example (job critical):

```json
{
    "enabled": true,
    "condition": "critical",
    "type": "web_hook",
    "web_hook": "slack_ops",
    "text": "Paging on-call"
}
```

Example (alert cleared):

```json
{
    "enabled": true,
    "condition": "alert_cleared",
    "type": "web_hook",
    "web_hook": "slack_ops"
}
```

See [Web Hooks](webhooks.md) for more details on web hooks.

### Run Event

Launch another event as a follow-up action. The new job inherits context, and for job actions you can override the child event's params.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `event_id` | String | Yes | Target [Event.id](data.md#event-id) to run. |
| `params` | Object | Optional | Override parameters for the launched event. |
| `target_server` | Boolean | Optional | For alert actions, this will override the [Event.targets](data.md#event-targets) to point at the server where the alert triggered. |
| `clear_alert` | Boolean | Optional | For alert actions, this will clear the alert when the job completes.  Useful for signal alerts (e.g. files waiting for pickup). |

Example (job warning):

```json
{
    "enabled": true,
    "condition": "warning",
    "type": "run_event",
    "event_id": "postprocess_assets",
    "params": { "optimize": true, "quality": 80 }
}
```

Example (alert fired):

```json
{
    "enabled": true,
    "condition": "alert_new",
    "type": "run_event",
    "event_id": "scale_out",
	"target_server": true,
	"clear_alert": false
}
```

See [Events](events.md) for more details on events.

### Channel

Notify a configured channel. Channels can bundle users (email/notify), a web hook, and/or an event to run. xyOps executes the contained actions and aggregates their results.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `channel_id` | String | Yes | Notification [Channel.id](data.md@channel-id). |

Example (job error):

```json
{
    "enabled": true,
    "condition": "error",
    "type": "channel",
    "channel_id": "ops_oncall"
}
```

Example (alert fired):

```json
{
    "enabled": true,
    "condition": "alert_new",
    "type": "channel",
    "channel_id": "noc_pager"
}
```

See [Channels](channels.md) for more details on channels.

### Snapshot

Capture a server snapshot. For jobs, the job must target a specific server. For alerts, the snapshot is taken for the alert's server. Links to the snapshot are included in results.

Parameters: None

Example (job error):

```json
{
    "enabled": true,
    "condition": "error",
    "type": "snapshot"
}
```

Example (alert fired):

```json
{
    "enabled": true,
    "condition": "alert_new",
    "type": "snapshot"
}
```

See [Snapshots](snapshots.md) for more details on snapshots.

### Ticket

Create a ticket with a generated body based on context (job or alert). The ticket is inserted into xyOps's ticket system and linked back to the job or alert.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ticket_type` | String | Yes | See [Ticket.type](data.md#ticket-type) (e.g., `issue`, `task`, etc.). |
| `ticket_assignees` | Array(String) | Yes | Array of [User.username](data.md#user-username) assignees. |
| `ticket_tags` | Array(String) | Optional | Array of [Tag.id](data.md#tag-id) values. |

Example (job error):

```json
{
    "enabled": true,
    "condition": "error",
    "type": "ticket",
    "ticket_type": "issue",
    "ticket_assignees": ["oncall"],
    "ticket_tags": ["production", "sev2"]
}
```

Example (alert cleared):

```json
{
    "enabled": true,
    "condition": "alert_cleared",
    "type": "ticket",
    "ticket_type": "task",
    "ticket_assignees": ["sre"],
    "ticket_tags": ["cleanup"]
}
```

See [Tickets](tickets.md) for more details on tickets.

### Plugin

Invoke a custom Action Plugin. xyOps executes your plugin command/script with a structured JSON payload via STDIN and environment variables. The plugin can emit JSON to STDOUT for rich results.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `plugin_id` | String | Yes | The [Plugin.id](data.md#plugin-id) of a plugin with `type: "action"`. |
| `params` | Object | Optional | Plugin-defined parameter values. |

Example (job success):

```json
{
    "enabled": true,
    "condition": "success",
    "type": "plugin",
    "plugin_id": "notify_grafana",
    "params": { "dashboard": "builds", "panel": "summary" }
}
```

Example (alert fired):

```json
{
    "enabled": true,
    "condition": "alert_new",
    "type": "plugin",
    "plugin_id": "custom_webhook",
    "params": { "route": "alerts", "priority": "high" }
}
```

See [Plugins](plugins.md) for more details on plugins.

### Suspend Job

> [!NOTE]
> This action can only be used inside of a workflow.

Suspend the running job until a user resumes it in the UI. Optionally notify users and/or fire a web hook about the suspension.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `users` | Array(String) | Optional | Array of [User.username](data.md#user-username) values to email. |
| `email` | String | Optional | One or more additional recipients, comma-separated. |
| `web_hook` | String | Optional | [WebHook.id](data.md#webhook-id) to fire on suspension. |
| `text` | String | Optional | Extra text appended to the suspension web hook message. |

Example (job start):

```json
{
    "enabled": true,
    "condition": "start",
    "type": "suspend",
    "users": ["deployers"],
    "email": "ops@example.com",
    "web_hook": "slack_ops",
    "text": "Manual review required before proceeding."
}
```

### Disable Event

Disable the current event when the action runs. Useful after failures to prevent subsequent scheduled executions until manually re-enabled.

Parameters: None

Example (job error):

```json
{
    "enabled": true,
    "condition": "error",
    "type": "disable"
}
```

### Delete Event

Delete the current event when the action runs. Use with care; the event is removed from the system.  This action is designed for ephemeral one-shot events that self-delete after running.

Parameters: None

Example (job critical):

```json
{
    "enabled": true,
    "condition": "critical",
    "type": "delete"
}
```

### Store Bucket

Store job data and/or files into a storage bucket. You can control whether to sync data, files, or both, and filter which files are included via a glob pattern. Bucket limits (max file size, max files per bucket) apply.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `bucket_id` | String | Yes | [Bucket.id](data.md#bucket-id) target. |
| `bucket_sync` | String | Yes | Controls what types of data are stored.  One of `data`, `files`, `data_and_files`. |
| `bucket_glob` | String | Optional | Glob pattern to match selective job files and only store those (default `*`). |

Example (job success):

```json
{
    "enabled": true,
    "condition": "success",
    "type": "store",
    "bucket_id": "bme4wi6pg35",
    "bucket_sync": "data_and_files",
    "bucket_glob": "*.json"
}
```

**Note:** The job has to explicitly output data and/or files before the Store Bucket action can see them.  See [Output Data](plugins.md#output-data) and [Output Files](plugins.md#output-files) for details.

See [Buckets](buckets.md) for more details on storage buckets.

### Fetch Bucket

Fetch bucket data and/or files and attach them to the job's input context. Files matched by the glob are added to the job input file list; data is shallow-merged into job input data.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `bucket_id` | String | Yes | [Bucket.id](data.md#bucket-id) target. |
| `bucket_sync` | String | Yes | Controls what types of data are fetched.  One of `data`, `files`, `data_and_files`. |
| `bucket_glob` | String | Optional | Glob pattern to match selective job files and only fetch those (default `*`). |

Example (job start):

```json
{
    "enabled": true,
    "condition": "start",
    "type": "fetch",
    "bucket_id": "bme4wi6pg35",
    "bucket_sync": "files",
    "bucket_glob": "*.csv"
}
```

### Apply Tags

Apply a custom set of tags to the job or workflow.

Parameters:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tags` | Array | Yes | A list of [Tag.id](data.md#tag-id)s to apply. |

Example (job complete):

```json
{
    "enabled": true,
    "condition": "complete",
    "type": "tag",
    "tags": ["important"]
}
```

Note that tags are deduplicated when the job completes.

## Notes and Tips

- For job actions, the email/web hook payloads include job links, log excerpts, performance metrics and any attached files (where applicable).
- For alert actions, payloads include friendly server details, links to the server and alert, and the alert message.
- Tag-based job conditions are specified as `tag:TAGID` and fire only at job completion.
- Bucket actions respect configured limits such as maximum file size and maximum files per bucket.

## See Also

- [Action](data.md#action) data structure
- [Alerts](alerts.md)
