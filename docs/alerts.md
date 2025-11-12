# Alerts

Alerts evaluate live server data and trigger actions when conditions are met. In xyOps, an alert is defined once (the “definition”) and may fire many times across servers (each firing is an “invocation”). Alerts are evaluated every minute on the master using the most recent [ServerMonitorData](data-structures.md#servermonitordata) collected from each server.

Use alerts to detect system conditions (e.g., high CPU, low memory, disk full, job spikes), notify teams, attach context via snapshots, open tickets, run jobs, and optionally limit or abort jobs on affected servers.

## Concepts

- **Definition:** The configuration that specifies the trigger condition and actions.
- **Invocation:** A single firing instance against a server. Stored in the database and visible in the Alerts view.
- **Evaluation cadence:** Once per minute per server, alongside monitor sampling.
- **Scope:** By server group. Leave blank to apply to all groups.
- **Warm-up / cool-down:** Optionally require N consecutive true evaluations before firing, and N consecutive false evaluations before clearing.
- **Actions:** Execute on alert fired and/or cleared. Actions can be defined on the alert, augmented by groups, and extended with universal defaults.
- **Job control:** Optionally prevent new jobs from launching while active, or even abort all running jobs when the alert fires.

## How Alerts Are Evaluated

Per incoming minute of server data:

1. xyOps evaluates each enabled alert definition whose group scope matches the server.
2. The alert’s expression (JavaScript format) runs against the current [ServerMonitorData](data-structures.md#servermonitordata) snapshot.
3. If the expression returns true, the alert’s internal sample counter increments. If false and previously incremented, the counter decrements toward zero.
4. When the counter first reaches the max samples, an invocation is created and actions run. When the counter subsequently returns to zero, the invocation is cleared and cleared actions run.

Notes:

- Expressions compile ahead of time; syntax errors are rejected at create/update time and in the Test dialog/API.
- The alert message is re-evaluated each minute while active, so macros reflect current server values.
- Active invocations are kept fresh as data arrives. Stale invocations are automatically expired if no updates are seen (e.g., server goes offline).

## Alert Expressions

An alert expression is a JavaScript-style expression evaluated by [jexl](https://www.npmjs.com/package/jexl) against the current [ServerMonitorData](data-structures.md#servermonitordata). Common entry points include:

- `cpu`: CPU stats and hardware information.
- `memory`: Total/available memory, etc.
- `load`: 1/5/15 minute load averages.
- `monitors`: Values from configured monitors (absolute values).
- `deltas`: Computed deltas for counter-style monitors since the last sample (per minute by default).
- `jobs`: Running job summary for the server.

Example:

```js
monitors.load_avg >= (cpu.cores + 1)
```

This fires if the 1-minute load average is greater than or equal to the number of CPU cores plus one.

Delta example (for counter-style monitors):

```js
deltas.os_bytes_out_sec >= 33554432
```

Useful helper functions available in expressions and message macros:

- `min(a, b)`, `max(a, b)`
- `integer(x)`, `float(x)`
- `bytes(x)` renders human-readable bytes
- `number(x)` renders localized numbers
- `pct(x)` renders a percentage
- `stringify(obj)` JSON stringifies a value
- `find(array, key, substr)` filters array items where `item[key]` includes `substr`

Tips:

- Use `monitors.MONITORID` for absolute values and `deltas.MONITORID` for per-minute rates when the monitor represents a counter.
- Guard against missing values with sensible defaults, e.g. `integer(monitors.foo || 0) > 10`.

## Alert Messages

The alert message is a string with `{{ ... }}` macros evaluated against the same [ServerMonitorData](data-structures.md#servermonitordata) context used for expressions. This lets you include formatted, contextual details in notifications, tickets and logs.

Example:

```
CPU load average is too high: {{float(monitors.load_avg)}} ({{cpu.cores}} CPU cores)
```

All helper functions listed under Alert Expressions are also available inside macros. Any object-valued macro is JSON stringified.

Additional variables are injected when actions run (used mainly in templates):

- `def`: The alert definition object (`def.title`, `def.notes`, etc.).
- `alert`: The alert invocation object (`alert.id`, `alert.message`, etc.).
- `nice_*`: Friendly strings for host, IP, CPU, OS, memory, uptime, groups, notes, etc.
- `links`: `server_url` and `alert_url` direct links.

## Creating and Editing Alerts

Click on "Alert Setup" in the sidebar. Creating and editing requires appropriate privileges. The form collects:

- **Title**: Display name for the alert.
- **Status**: Enable/disable notifications and actions.
- **Icon**: Optional Material Design Icon for the alert.
- **Server Groups**: One or more groups where the alert applies. Leave blank for all groups.
- **Expression**: Trigger condition evaluated each minute. Use the Server Data Explorer to discover paths.
- **Message**: Text with `{{macros}}` for dynamic context. Evaluated on fire and each minute while active.
- **Samples**: Consecutive minutes that must evaluate true to fire; also used as cool-down to clear.
- **Overlay**: Optional monitor to overlay alert annotations on charts.
- **Job Limit**: While active, prevent new jobs from starting on the server.
- **Job Abort**: When fired, abort all running jobs on the server.
- **Alert Actions**: Optional actions to run on `alert_new` and/or `alert_cleared`.
- **Notes**: Optional text included in emails and other notifications.

Testing: Use the “Test…” button to evaluate the current Expression and Message against a selected live server. The dialog shows whether it would trigger right now and previews the computed message.

## Actions on Fire and Clear

When an alert fires (`alert_new`) and when it clears (`alert_cleared`), xyOps executes actions in parallel from three sources, deduplicated by type/target:

- **Alert actions**: Configured on the alert definition itself.
- **Group actions**: Each matching server group can contribute actions.
- **Universal actions**: From `config.json` → `alert_universal_actions` (defaults to a `snapshot` on `alert_new`).

Supported action types in alerts:

- **Email**: To specified users and/or custom addresses.
- **Channel**: Fire a notification channel (a preset bundle like users, web hooks, etc.).
- **Run Job**: Start a job by event with optional parameters.
- **Create Ticket**: Open or update a ticket tied to the alert.
- **Web Hook**: Fire a preconfigured outbound web hook with templated payload.
- **Plugin**: Run a custom plugin with arguments.
- **Snapshot**: Capture a point-in-time server snapshot. Note: a snapshot is included by default via universal actions.

Action conditions are either `alert_new` or `alert_cleared`. You can attach multiple actions for either condition.

## Job Control During Alerts

- **Limit Jobs**: While the alert is active on a server, that server is excluded from job scheduling (prevents new jobs from launching there). Workflow parent jobs are exempt from this restriction.
- **Abort Jobs**: When the alert fires, all running jobs on the affected server are aborted immediately.

Both are optional, independent toggles on the alert definition.

## Examples

The default setup includes several examples:

High CPU Load

```json
{
  "id": "load_avg_high",
  "title": "High CPU Load",
  "expression": "monitors.load_avg >= (cpu.cores + 1)",
  "message": "CPU load average is too high: {{float(monitors.load_avg)}} ({{cpu.cores}} CPU cores)",
  "groups": [],
  "monitor_id": "load_avg",
  "enabled": true,
  "samples": 1
}
```

Low Memory

```json
{
  "id": "mem_free_low",
  "title": "Low Memory",
  "expression": "memory.available < (memory.total * 0.05)",
  "message": "Less than 5% of total memory is available ({{bytes(memory.available)}} of {{bytes(memory.total)}})",
  "monitor_id": "mem_free",
  "enabled": true,
  "samples": 1
}
```

High I/O Wait

```json
{
  "id": "io_wait_high",
  "title": "High I/O Wait",
  "expression": "monitors.io_wait >= 75",
  "message": "Disk I/O wait is too high: {{pct(monitors.io_wait)}}",
  "monitor_id": "io_wait",
  "enabled": true,
  "samples": 1
}
```

Disk Full

```json
{
  "id": "disk_usage_root_high",
  "title": "Disk Full",
  "expression": "monitors.disk_usage_root >= 90",
  "message": "Root filesystem is {{pct(monitors.disk_usage_root)}} full.",
  "monitor_id": "disk_usage_root",
  "enabled": true,
  "samples": 1
}
```

High Active Jobs (with job limiting)

```json
{
  "id": "active_jobs_high",
  "title": "High Active Jobs",
  "expression": "monitors.active_jobs >= 50",
  "message": "Active job count is too high: {{number(monitors.active_jobs)}}",
  "monitor_id": "active_jobs",
  "enabled": true,
  "samples": 1,
  "limit_jobs": true,
  "abort_jobs": false
}
```

## Viewing and Searching Alerts

- **Active alerts**: Shown in the header counter and the Alerts tab. Each includes the evaluated message, server context, snapshot link and related jobs/tickets.
- **Timelines**: If `monitor_id` is set, alert annotations appear on the corresponding monitor chart.
- **History search**: Search for historical alerts on the "Alerts" page.

## API Summary

See [Alerts](api.md#alerts) for full details. Highlights:

- `get_alerts`: List all alert definitions.
- `get_alert`: Fetch a single definition by ID.
- `create_alert` / `update_alert` / `delete_alert`: Manage definitions.
- `test_alert`: Compile and evaluate an expression/message against a server.
- `search_alerts`: Query historical and active alert invocations.

## Best Practices

- Tune `samples` to balance noise and responsiveness. For spiky metrics, require multiple samples.
- Prefer relative thresholds when available (e.g., compare load to `cpu.cores`).
- Use `bytes()`/`pct()`/`number()` to produce readable messages in notifications.
- Overlay alerts on monitors users already watch to provide context.
- Use group-level `alert_actions` for standard responses (e.g., page an on-call channel) and keep per-alert actions focused on specifics.
- Consider `limit_jobs` for conditions that would degrade runtime reliability (e.g., disk full, high I/O wait).

## Privileges

- Create: [create_alerts](privileges.md#create_alerts)
- Edit/Test: [edit_alerts](privileges.md#edit_alerts)
- Delete: [delete_alerts](privileges.md#delete_alerts)

Users without these privileges can still read definitions and view active alerts with a valid session or API Key.

## See Also

- Data structures: [Alert](data-structures.md#alert) and [AlertInvocation](data-structures.md#alertinvocation)
- API: [Alerts](api.md#alerts)
- Monitoring data context: [ServerMonitorData](data-structures.md#servermonitordata)
