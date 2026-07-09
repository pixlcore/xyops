# Recipes

## Overview

This document provides a set of useful recipes you can use in xyOps.

## Continuous Jobs

A continuous job is defined as a job that automatically relaunches itself upon completion. This functionality can enhance the efficiency and reliability of job execution in various systems.  To implement a continuous job, follow these steps:

1. **Wire Up Completion Actions**: 
   - Set up actions that will trigger the same event upon job completion.
2. **Error Handling**:
   - If the job fails, implement a separate error handler. This handler can:
     - Notify the responsible parties about the failure.
     - Restart the job if necessary.

### Managing Job Failures

For jobs that experience repeated failures, it is essential to manage the process to prevent system disruption. Consider the following strategies:

- **Retry Limiter**: 
  - Establish a maximum limit for retries to avoid indefinite job execution.
- **Retry Delay**: 
  - Introduce a delay between retries to allow for recovery or resolution of the underlying issue.

### Summary

By following these guidelines, you can create a robust continuous job system that can efficiently manage execution, handle errors gracefully, and avoid negative impacts on system performance. 

## Nightly S3 Backup Workflow

Back up databases and files to Amazon S3 on a fixed schedule, with optional retention and notifications.

### How It Works

- Trigger: Add a `schedule` trigger for 01:00 in your timezone, and enable `catchup` so missed runs replay after outages.
- Workflow: Use a workflow so you can multiplex the job across multiple DB servers.
  - Multiplex Controller: Attach a job node to run on a group of servers (i.e. "Database" group).
    - Use the "stagger" option to spread jobs out, or use [Max Concurrent Jobs](limits.md#max-concurrent-jobs) and [Max Queue Limit](limits.md#max-queue-limit) to run them in series.
  - Job node 1: Shell Plugin to create backups on each target DB server. 
    - Examples: `pg_dump` or `mysqldump`, plus `tar` and `gzip` for directories.
	- Add files to output of job, e.g. `echo '{"xy":1, "code":0, "files":["*.tgz"]}'`;
  - Job node 2, wired via "continue" condition: Upload all input files to S3.
    - Target a server with outbound network access.
- Limits: Add [Max Run Time](limits.md#max-run-time) and [Max CPU Limit](limits.md#max-cpu-limit) limits to the backup job. Add [Max Concurrent Jobs](limits.md#max-concurrent-jobs) limit to avoid overlapping runs.
- Notifications: Add a [Web Hook](actions.md#web-hook) or [Email](actions.md#email) action on `error` and `critical` with links to the job.

### Notes

- Use `params` and event `fields` for database credentials and include Secrets where appropriate.

## Video Transcoding Pipeline

Transcode incoming videos to MP4 H.264 and push the outputs to storage and a CDN. Supports parallel processing with progress feedback.

### How It Works

- Entry: Manual trigger for ad hoc batches or a custom trigger plugin that watches an S3 bucket for new file arrivals.
- Workflow graph:
  - Fetch: Optional fetch job on start to pull source files into the job input (wire manual run to different start node).
  - Split: Use a Split controller on `files` so each sub job gets exactly one input file.
  - Job: Shell Plugin that runs `ffmpeg` with a standard preset, writes output to the job temp dir, and prints periodic progress. 
    - For example, wrap ffmpeg and emit `{ "xy": 1, "progress": N }` updates while parsing ffmpeg stderr.
	- - Add files to output of job, e.g. `{"xy":1, "code":0, "files":["*.mp4"]}`;
  - Continue: After all items complete, continue to a packaging step that generates a manifest or index.
  - Store: On the transcoding node, attach a custom action to upload the MP4 outputs to S3 or other storage.
- Limits: Attach [Max CPU Limit](limits.md#max-cpu-limit), [Max Memory Limit](limits.md#max-memory-limit), [Max Run Time](limits.md#max-run-time), [Max Concurrent Jobs](limits.md#max-concurrent-jobs) and [Max Queue Limit](limits.md#max-queue-limit) limits to the transcode node to control resource usage and queue depth.
- Notifications: On `success`, fire a Web Hook to your CDN cache purge endpoint. On `error`, send email or post to a channel.

### Notes

- If you need per server fan out, target the ffmpeg at a server group instead of a single server, and select "Round Robin" algo.
- Tag successful jobs with `transcoded` and wire a `tag:transcoded` action to trigger downstream publishing.

## PostgreSQL Metrics

Collect PostgreSQL health metrics from the CLI and graph them, with alerts and automated remediation.

### How It Works

- Monitor Plugin: Write a simple Monitor Plugin that runs `psql` and emits one numeric metric per minute. Point the monitor expression at the plugin output.
- Examples of CLI queries that return a single number:

```sh
# Active connections on a specific database
psql -At -d mydb -c "select count(*) from pg_stat_activity where datname = 'mydb' and state = 'active'"

# Replication lag in seconds on a standby
psql -At -d postgres -c "select extract(epoch from now() - pg_last_xact_replay_timestamp())::int"

# Autovacuum backlog estimate (dead tuples)
psql -At -d mydb -c "select n_dead_tup from pg_stat_user_tables order by n_dead_tup desc limit 1"
```

- In the monitor configuration:
  - Expression: reference the plugin command output path such as `commands.pg_active_conns`.
  - Data Match: if your plugin returns a line of text, set a regex like `(\d+)` to extract the number.
  - Type: choose `integer` or `seconds` depending on the metric.
- Alerts: Create alerts that fire when thresholds are exceeded for a few minutes, for example:
  - Active connections above 90 percent of `max_connections` for 5 minutes.
  - Replication lag above 60 seconds for 3 minutes.
- Actions: On alert, run an event that captures pg diagnostics, or kick off `vacuumdb` during a maintenance window.

### Notes

- Store database credentials in Secrets and inject via environment or params; do not hardcode.

## Web Service Health Alert

Alert when a local web service stops responding on the same server as xySat. This recipe uses a [Monitor Plugin](plugins.md#monitor-plugins) to run a small `curl` check every minute, but it does **not** create a xyOps [Monitor](monitors.md). Monitors are for graphing numeric values over time. Here we only need a simple string status, so the alert can match the raw Plugin output directly.

### How It Works

- Monitor Plugin: Create a Monitor Plugin that runs on the server or server group hosting your web service.
	- **Plugin Title**: Web Service Health
	- **Plugin ID**: Automatically assigned when created
	- **Command**: `/bin/bash`
	- **Format**: `text`
	- **Script**:

```sh
URL="http://127.0.0.1:8080/health"

if curl --fail --silent --output /dev/null \
	--connect-timeout 5 \
	--max-time 5 \
	--retry 3 \
	--retry-delay 1 \
	--retry-all-errors \
	--retry-max-time 20 \
	"$URL"; then
	echo "UP"
else
	echo "DOWN"
fi
```

- Replace the `URL` value with your service's local health endpoint. This can be a loopback URL like `http://127.0.0.1:8080/health`, or any URL reachable from the xySat server.
	- The example uses `127.0.0.1` instead of `localhost` to avoid hostname lookup ambiguity, especially on systems where `localhost` may try IPv6 (`::1`) before IPv4.
- The `--fail` flag tells `curl` to treat HTTP error responses such as `404` or `500` as failures instead of successful downloads.
- The `--silent` and `--output /dev/null` flags keep the Plugin output clean, so xyOps receives only `UP` or `DOWN`.
- The `--connect-timeout 5` flag caps how long `curl` waits to establish the connection.
- The `--max-time 5` flag caps how long each request attempt may take, which prevents an unreachable service from tying up the xySat command for too long.
- The `--retry 3` flag gives the service a few extra chances within the same minute sample before reporting `DOWN`. This helps avoid firing on a single dropped packet or brief restart.
- The `--retry-delay 1` flag waits one second between retry attempts.
- The `--retry-all-errors` flag asks `curl` to retry more failure types, including connection and timeout errors.
- The `--retry-max-time 20` flag caps the total retry window, so the Plugin does not spend too much of the minute waiting.

The raw output from a Monitor Plugin is placed into [ServerMonitorData.commands](data.md#servermonitordata-commands), keyed by the Plugin ID. Replace `YOUR_PLUGIN_ID` below with the actual Plugin ID assigned by xyOps. The server data will look like this:

```json
"commands": {
	"YOUR_PLUGIN_ID": "UP"
}
```

When the service is unreachable, the value will be:

```json
"commands": {
	"YOUR_PLUGIN_ID": "DOWN"
}
```

### Alert Definition

Create a new [Alert](alerts.md) and point its expression at the Plugin output:

```js
!match(commands.YOUR_PLUGIN_ID, "UP")
```

The `match()` helper function is part of the [xyOps Expression Format](xyexp.md#custom-functions). This expression returns true when the raw command output does **not** contain `UP`, so the alert fires if the service is down, or if the Plugin fails to produce its expected healthy output.

Suggested alert settings:

- **Title**: Web Service Down
- **Expression**: `!match(commands.YOUR_PLUGIN_ID, "UP")`
- **Message**: `Web service health check failed.`
- **Samples**: `1`, so the alert can fire on the same minute sample after `curl` has exhausted its retries.
- **Server Groups**: Select the group that hosts the web service, or leave blank if it should apply everywhere.
- **Alert Actions**: Add email, channel, ticket, web hook, snapshot, or run-job actions as needed.

### Why Not Create a Monitor?

This recipe intentionally skips creating a xyOps [Monitor](monitors.md). Monitors store and graph numeric values such as CPU load, free memory, request counts, latency, or disk usage. This Plugin outputs a status string instead: `UP` or `DOWN`.

Because [alerts](alerts.md#alert-expressions) evaluate against the current server monitoring data, they can read `commands.YOUR_PLUGIN_ID` directly. That lets the alert fire from the Plugin's raw text output without forcing the value into a numeric graph.

### Notes

- Keep the Plugin output limited to `UP` or `DOWN`. Extra text can make the alert expression harder to reason about.
- Tune the timeout and retry values for your service. Shorter timeouts detect failures faster, while more retries help avoid false positives during brief restarts or network blips. If you set alert samples above `1`, remember that each sample adds another minute before the alert fires.
- If your service has a health endpoint, use that instead of the root URI path. A dedicated health endpoint can check database connections, cache availability, or other dependencies before returning success.
- If you monitor multiple services, create one Monitor Plugin per service, or output JSON from one Plugin and match each service path separately in different alerts.

## Sunrise and Sunset Trigger

Launch jobs at local sunrise and sunset with optional offsets. Useful for energy jobs, IoT device control, or time shifting heavy tasks to off peak windows.

### How It Works

- Trigger Plugin: Implement a scheduler plugin that calculates today's sunrise and sunset for a configured latitude and longitude. The plugin runs once per minute, compares the current time in a configured timezone, and indicates a launch when a window is hit.
  - Recommended module for Node.js: [SunCalc](https://www.npmjs.com/package/suncalc)
- Parameters: `lat`, `lon`, `timezone`, `sunrise_offset_sec`, `sunset_offset_sec`, and optional `launch` selector `sunrise` or `sunset` or `both`.
- Workflow: Wire the plugin trigger node into a workflow that branches on which event fired. For example:
  - At sunrise: run an HTTP Request Plugin that calls a home automation API to power down exterior lights and open blinds.
  - At sunset: run a batch window starter that increases queue sizes or begins off peak data processing.
- Actions: Add a Web Hook on `start` and `success` for observability.
- Limits: Add `max_concurrent` to protect against duplicates if the plugin window spans multiple minutes.

### Notes

- To avoid dependency on external APIs, embed sunrise calculations in the plugin. Any language is fine.
- Provide an optional test mode that forces a launch to validate the graph end to end.

## Server Offline Notifications

Notify your team when any server disconnects from the xyOps network. This uses a [System Hook](syshooks.md), which runs in the background when matching activity is logged.

### How It Works

Add a `server_remove` hook into the [hooks](config.md#hooks) section in your `config.json`. This activity fires when a server disconnects from the network. See [Activity.action](data.md#activity-action) for the full list of activity action IDs that can trigger System Hooks.

Simple web hook example:

```json
"hooks": {
	"server_remove": {
		"url": "https://alerts.mycompany.com/api/xyops-server-offline"
	}
}
```

Email example:

```json
"hooks": {
	"server_remove": {
		"email": "oncall-pager@mycompany.com"
	}
}
```

You can also use a configured xyOps web hook ID if you want custom headers, request body templates, or other delivery options:

```json
"hooks": {
	"server_remove": {
		"web_hook": "wmkd2yx4yw4ihh7lu"
	}
}
```

To notify when a server comes back online, or when a new server is added to the network, add a `server_add` hook as well:

```json
"hooks": {
	"server_remove": {
		"email": "oncall-pager@mycompany.com"
	},
	"server_add": {
		"email": "oncall-pager@mycompany.com"
	}
}
```

### Notes

- The `server_remove` activity fires whenever a server disconnects, including planned upgrades, service restarts, network maintenance, and other expected outages. It does not always mean the server crashed.
- The `server_add` activity fires whenever a server connects to the network. This means a previously offline server returned, or a brand new server was added.

## Daylight Savings Time

Run a job safely during the Daylight Savings Time changeover window without duplicates or missed runs.  During DST transitions, local clocks jump between 1:00 and 3:00 AM. Two effects occur in many regions:

- Spring ahead: the clock skips from 1:59 to 3:00 AM. Any time between 2:00–2:59 AM does not exist that day.
- Fall back: the hour from 1:00–1:59 AM repeats twice. Times in that window occur twice.

Classic Unix/Linux cron uses local time and does not de-duplicate or "catch up" around DST. On spring-ahead days, a 2:30 job is skipped. On fall-back days, a 1:30 job runs twice.

### How It Works

Use the [Max Daily Limit](limits.md#max-daily-limit) feature to allow a maximum of one job completion per calendar day, then schedule two daily runs:

- Add a Max Daily Limit to the event (or workflow) with condition set to "Complete" and max daily amount set to "1". This quietly blocks any second run after one job has completed that day. See [Action.condition](data.md#action-condition) for condition meanings.
- Add two schedule triggers (or one with multiple hours selected): one at the desired time in your timezone, and a second one exactly +1 hour later.

This arrangement covers all three cases:

- **Normal days**: the job runs at the desired time; the +1 hour run is silently blocked by the daily limit.
- **Spring ahead**: the desired time may not exist (for example 2:30). The +1 hour run exists and executes; the daily limit still allows it because nothing ran yet.
- **Fall back**: the desired time occurs twice; the first occurrence runs and completes, and both the repeated occurrence and the +1 hour run are blocked by the daily limit.

Note: Manual runs skip the Max Daily Limit check, by design. If you manually re-run the job on a changeover day, it can exceed the daily count.

### Example

The following event configuration runs at 2:30 AM local time, with a safe second attempt at 3:30 AM, and allows at most one completion per day.

- **Schedule Trigger**:
	- Hours: `2` and `3` selected
	- Minutes: `30` selected
	- Timezone: Set to yours
- **Max Daily Limit**:
	- Job Condition: "Complete"
	- Max Daily Amount: 1

You can apply the same pattern to [Workflows](workflows.md) since workflows support limits as well. If you prefer to centralize the cap, you can also define this as a category limit so multiple events inherit the one-per-day rule.

## More Recipes

Check out more recipes in the xyOps Wiki:

https://github.com/pixlcore/xyops/wiki
