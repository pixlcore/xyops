# Overview

This document details all of the data structures used in Orchestra.

# Event

An event is an item on the schedule which launches [Jobs](#job).  It may or may not be scheduled to run at specific times (i.e. it may be on-demand only).  Here is an example event in JSON format:

```json
{
	"id": "event100",
	"title": "Diverse heuristic complexity",
	"enabled": true,
	"username": "admin",
	"modified": 1653843747,
	"created": 1651348186,
	"category": "cat9",
	"targets": [
		"main"
	],
	"notes": "This is a test event.",
	"limits": [
		{
			"type": "time",
			"enabled": true,
			"duration": 3600
		}
	],
	"actions": [
		{
			"enabled": true,
			"trigger": "error",
			"type": "email",
			"email": "admin@localhost"
		}
	],
	"plugin": "shellplug",
	"params": {
		"script": "#!/bin/bash\n\nsleep 30;\necho HELLO;\n",
		"annotate": false,
		"json": false
	},
	"timings": [
		{
			"type": "schedule",
			"enabled": true,
			"hours": [
				19
			],
			"minutes": [
				6
			]
		}
	],
	"icon": "",
	"tags": [
		"important"
	],
	"algo": "random"
}
```

Events have the following properties:

## Event.id

A unique alphanumeric ID for the event.

## Event.title

A visual title for the event, displayed in the UI.

## Event.enabled

A boolean flag indicating if the event is enabled (can run jobs) or disabled.

## Event.icon

An optional icon ID for the event, displayed in the UI.  Icons are sourced from [Material Design Icons](https://materialdesignicons.com/), but our icon IDs omit the `mdi-` prefix.

## Event.category

The [Category.id](#category-id) of the category to which the event belongs.

## Event.plugin

The [Plugin.id](#plugin-id) of the plugin which will handle running jobs.

## Event.params

An object containing key/value pairs which is passed to the job process.  These are typically defined by the [Plugin](#plugin) and populated in the UI.

## Event.tags

An array of [Tag](#tag) IDs which can be used to search for historical jobs.  The running job may also modify this list.

## Event.targets

An array of server or group targets to run the event.  Each item of the array is a string, and can can either be a [Server.id](#server-id) or a [Group.id](#group-id).

## Event.algo

When multiple servers are in the [Event.targets](#event-targets) array, Orchestra uses a select algorithm to select a server to run the job.  The available algorithms are:

| Algorithm | Notes |
|-----------|-------|
| `random` | Randomly pick a server from the list. |
| `round_robin` | Pick each server in sequence, then repeat. |
| `least_cpu` | Pick the server with the least CPU usage. |
| `least_mem` | Pick the server with the least memory usage. |
| `prefer_first` | Prefer the first server when alphabetically sorted by hostname. |
| `prefer_last` | Prefer the last server when alphabetically sorted by hostname. |

## Event.notes

Optional notes for the event, which are included in email notifications for event actions.

## Event.actions

An array of [Action](#action) items to invoke at various points during job runs.

The event's [Category](#category) can define additional actions which are appended to this list at job run time.

## Event.limits

An array of [Limit](#limit) items to apply to running jobs, e.g. CPU and memory limits.  In the UI these are referred to as "Resource Limits".

The event's [Category](#category) can define limits which act as defaults to the event limits.

## Event.timings

An array of [Timing](#timing) items to schedule future job runs and set timing rules, e.g. blackout dates.

# Job

A job is a running (or previously ran) instance of an event.  The job structure has nearly all the same properties as [Event](#event) with these differences:

| Property Name | Note |
|---------------|--------|
| `id` | Replaced with [Job.id](#job-id). |
| `event` | The [Event.id](#event-id]) of the event which spawned the job. |
| `title` | Removed from job structure when event is copied. |
| `enabled` | Removed from job structure when event is copied. |
| `created` | Removed from job structure when event is copied. |
| `modified` | Removed from job structure when event is copied. |
| `timings` | Removed from job structure when event is copied. |

And these additions:

## Job.id

An auto-generated, unique, alphanumeric ID for the job, which will always start with a `j`.

## Job.event

The [Event.id](#event-id) of the event which spawned the job.

## Job.server

Which [Server.id](#server-id) that was chosen to run the job, based on the [Event.algo](#event-algo).

## Job.command

Which executable to run for the job.  This cannot be set -- it is copied from the [Plugin](#plugin).

## Job.uid

Which UID (User ID) to run the job process as.  This cannot be set -- it is copied from the [Plugin](#plugin).

## Job.cwd

Which CWD (Current Working Directory) run the job process under.  This cannot be set -- it is copied from the [Plugin](#plugin).

## Job.env

Custom job environment variables to inject into the executable when spawning it.  If unset, this is copied from the `job_env` master configuration property.

## Job.state

Specifies which state the job is currently in.  Here is a list of all the possible states:

| Job State | Description |
|-----------|-------------|
| `queued` | Job is queued and waiting for an open slot to move to `ready` state. |
| `start_delay` | Job has a custom starting delay.  The timestamp at which the delay expires should be in [Job.until](#job-until). |
| `retry_delay` | Job is currently in a retry delay.  The timestamp at which the delay expires should be in [Job.until](#job-until). |
| `ready` | Job is ready to start. |
| `active` | Job is currently active (running). |
| `finishing` | Job is finishing (uploading logs and/or files). |
| `complete` | Job is complete. |

## Job.started

The timestamp at which the job was started (Epoch seconds).  Specifically this is when the job was moved to a `ready` state.

## Job.updated

The timestamp at which the job was last updated (Epoch seconds).

## Job.completed

The timestamp at which the job was completed (Epoch seconds).

## Job.elapsed

The duration of the job run in seconds (calculated as the difference between [Job.started](#job-started) and [Job.completed](#job-completed)).  This does not include time spent in queue or start delay.

## Job.remote

Set to `true` when the job has an active remote connection (job request sent to remote server).

## Job.until

Specifies the timestamp at which point the job can be moved into a ready state.  This property is used by the `start_delay` and `retry_delay` states.

## Job.progress

User-populated progress indicator, should be a floating point number between `0.0` to `1.0`.  Both extremes (`0.0` and `1.0`) display as "indeterminate" in the UI.

## Job.reconnected

An Epoch timestamp of when the primary server socket was reconnected, during a job run.  The presence of this property indicates that the worker server lost its connection to the primary during the job, and then reconnected later.

## Job.log_file

An optional log file for the user to write/append to, during a job.  This is a legacy carryover from Cronicle.  If present at the completion of a job, the file will be uploaded as an attachment.

## Job.log_file_size

The size of the actual job output, in bytes, and updated continuously as job runs.  This is the STDOUT and STDERR captured from the job process, and is not associated with the legacy [Job.log_file](#job-log_file) property.

## Job.activity

An array of meta log entries for the job.

## Job.source

A string ID indicating what spawned the job.  This will be one of:

| Source | Description |
|--------|-------------|
| `scheduler` | Job was spawned normally via the scheduler. |
| `key` | Job was spawned via a HTTP request to the `run_event` API using an API Key.  There will be an additional property named `key` containing the internal API Key ID (non-secret). |
| `user` | Job was spawned manually via user request in the UI.  There will be an additional property named `username` containing the username of the user who initiated the action. |
| `action` | Job was spawned by a custom job action (i.e. start, complete, success or fail action trigger).  [Job.parent](#job-parent) will also be present in this case. |
| `alert` | Job was spawned by an alert notification from the server monitoring system. |
| `workflow` | Job was spawned as part of a workflow sequence. |

## Job.parent

When the job was launched from another job (custom action or workflow step), this will be a reference to the parent job which spawned the current job.

## Job.input

When another job passes data to the current job, the `input` object is sued.  The object has the following properties:

| Property Name | Description |
|---------------|-------------|
| `data` | A copy of the data object from the parent job, if one was populated (user-supplied). |
| `files` | A copy of the files uploaded from the parent job, if applicable. |

## Job.retried

Boolean, will be set to `true` when a job was retried, and another job exists in the same set.

## Job.retry_count

For retried jobs, a retry counter is present that counts upwards for each new retry.  It will not exceed the retry [limit](#limit) set in the event.

## Job.retry_prev

When a job is a retry, this property will contain the [Job.id](#job-id) of the previous attempt.

## Job.jobs

When a job launches other jobs, either by retry or action trigger, the newly launched jobs will be added to a `jobs` array in the parent (source) job.  Each item in the array is an object with `id` and `reason` properties.  The reason can be one of `action` or `retry`.

## Job.cpu

This will contain information about the job process CPU usage.

## Job.mem

This will contain information about the job process memory usage.

## Job.disk

This will contain information about the job process disk usage.

## Job.net

This will contain information about the job process network usage (open TCP connections).

## Job.data

This is a place where the job can store arbitrary data, which will be passed to the next job (if part of a workflow, or launched via an action).

## Job.files

This will contain information about all uploaded files for the job.  While the job is running, the user can populate this array to attach files for the job.  Each item in the array can be a simple string (file path or glob), a sub-array of file path and filename, a sub-array of file path, filename, and a `true` boolean to delete the file after uploading, or an object with the following properties:

| Property Name | Description |
|---------------|-------------|
| `path` | Path to the file on disk, or a glob matching multiple files. |
| `filename` | Custom destination filename to use when uploading.  Do not combine with a glob path. |
| `delete` | Set this to `true` to delete the file(s) after uploading. |

Once the job is complete, the files will be uploaded and the array will be recreated as an array of objects, one per file, with each object containing the following properties:

| Property Name | Description |
|---------------|-------------|
| `path` | The partial path to the file in storage.  Combine this with the Orchestra master server hostname and port number (if applicable) to construct a full URL to the file. |
| `size` | The size of the file in bytes. |
| `job` | The [Job.id](#job-id) associated with the file. |
| `server` | The server ID of the server which uploaded the file. |

## Job.update_event

This allows the user job code to update the event at time of completion.  For example, here is how you would disable the event:

```sh
echo '{ "update_event": { "enabled": false }'
```

## Job.push

A system by which the user code can push new [actions](#action) and [limits](#limit) onto the job while it is still running.  For example:

```sh
echo '{ "push": { "actions": [ { "trigger":"success", "type":"email", "email":"you@yourdomain.com" } ] } }'
```

## Job.procs



## Job.conns



## Job.timelines



## Job.flags

An internal object used to track CPU/Mem thresholds.



# Workflow



# Category

# Plugin

# Channel

# Server

# Group

# Monitor

# Alert Def

# Tag

# User

# API Key



# Alert

# Snapshot

## Snapshot.source

alert, watch, user (username), job




# Sub-Objects

These objects are nested under other data structures, usually items of an array.

## Action

Actions can be assigned to job related events such as start, completion, errors, and other triggers.  Here is an example:

```json
{
	"enabled": true,
	"trigger": "error",
	"type": "email",
	"email": "admin@myserver.com"
}
```

This action would fire when the job resulted in an error, and it would send an email to `admin@myserver.com`, notifying them about the event.

Each action object should have the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `enabled` | Boolean | Specifies whether the action is enabled (`true`) or disabled (`false`). |
| `trigger` | String | Specifies the trigger which runs the action.  See [Action Triggers](#action-triggers) below. |
| `type` | String | Specifies which action will take place when the trigger fires.  See [Action Types](#action-types) below. |

Additional properties may be present based on the type.

### Action Triggers

Each action has a `trigger` property which specifies when it will fire.  The value may be one of:

| Trigger ID | Description |
|------------|-------------|
| `start` | Fires on job start. |
| `complete` | Fires on job completion, regardless of the outcome. |
| `success` | Fires on job success, i.e. when the `code` property is `0` or `false`. |
| `error` | Fires on job errors, i.e. when the `code` property is any true value or string. |
| `warning` | Fires on job warnings, i.e. when the `code` property is set to `"warning"`. |
| `critical` | Fires on critical errors, i.e. when the `code` property is set to `"critical"`. |
| `abort` | Fires when the job is aborted, either by user or special event (e.g. lost server). |

### Action Types

Each action has a `type` property which dictates what will happen when the trigger fires.  The different types are listed below:

| Type ID | Description |
|---------|-------------|
| `email` | Send email to one or more addresses.  The addresses should be in an extra property named `email` (comma-separated). |
| `web_hook` | Fire off a web hook (HTTP POST) for the action.  The URL should be specified in a property named `url`. |
| `run_event` | Run a custom job for the action.  The Event ID should be specified in a property named `event_id`. |
| `channel` | Activate a notification channel for the action.  The Channel ID should be specified in a property named `channel_id`. |
| `disable` | Disable the event for the action (no extra properties defined). |
| `snapshot` | Take a server snapshot for the action (no extra properties defined). |

## Limit

Limits (otherwise known as "Resource Limits" in the UI) govern things like CPU, memory, and log size for running jobs.  They can be assigned to both events and categories, and each may have several different limits set.  Here is an example:

```json
{
	"type": "time",
	"enabled": true,
	"duration": 3600
}
```

This would set a time limit of 3600 seconds (1 hour) for running jobs.

Each limit object should have the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `enabled` | Boolean | Specifies whether the limit is enabled (`true`) or disabled (`false`). |
| `type` | String | Specifies the type of limit.  See [Limit Types](#limit-types) below. |

Additional properties may be present based on the type.

When limits are assigned to categories, they act as defaults for events in that category.  Events may still override limits set in their categories.

### Limit Types

Each limit has a `type` property which specifies what it governs.  The different types are described below:

| Type ID | Description |
|---------|-------------|
| `time` | Set a maximum run time for jobs.  The limit should be in a property named `duration`, specified as seconds. |
| `job` | Set a maximum number of concurrent jobs for the event.  The number should be a in property named `amount`. |
| `log` | Set a maximum limit on the log file size for jobs.  The limit should be in a property named `amount`, specified as bytes. |
| `mem` | Set a maximum limit for memory usage for jobs (includes all child processes).  The limit should be in a property named `amount`, specified as bytes.  The sustain duration should be in a property named `duration`, specified as seconds. |
| `cpu` | Set a maximum limit for CPU usage for jobs (includes all child processes).  The limit should be in a property named `amount`, specified as a percentage of one CPU core.  The sustain duration should be in a property named `duration`, specified as seconds. |
| `retry` | Set a maximum number of retries allowed for failed jobs.  The number of retries should be in a property named `amount`, and optionally the delay between retries should be in a property named `duration`, specified as seconds. |
| `queue` | Set a maximum number of jobs that may be queued up, if other limits prevent them from running concurrently.  The number should be in a property named `amount`. |

## Timing

Events are scheduled using one or more timing objects, which can define repeating invocations (hourly, daily, etc.), single-shots on an exact future date/time, and other misc. timing rules such as blackout dates.  Here is an example:

```json
{
	"type": "schedule",
	"enabled": true,
	"hours": [ 4 ],
	"minutes": [ 30 ]
}
```

This would run every day at 4:30 AM (repeating).

Each timing object should have the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `enabled` | Boolean | Specifies whether the timing rule is enabled (`true`) or disabled (`false`). |
| `type` | String | Specifies the type of timing rule.  See [Timing Types](#timing-types) below. |

Additional properties may be present based on the type.

### Timing Types

Each timing rule has a `type` property which describes its behavior.  The different types are listed below:

| Type ID | Description |
|---------|-------------|
| `schedule` | Set a repeating schedule to run the event (hourly, daily, etc.).  See [Schedule Rules](#schedule-rules) below. |
| `continuous` | Run the event continuously, forever. |
| `single` | Set a single future exact date/time to run.  Requires an additional `epoch` property, set to the [Epoch timestamp](https://en.wikipedia.org/wiki/Unix_time) at which to run. |
| `catchup` | Ensure that *every* scheduled job runs, even if it has to run late. |
| `destruct` | Self-destruct (delete the event) after the first run. |
| `range` | Set a starting and/or ending date for a repeating event.  Requires additional `start` and/or `end` properties, set to [Epoch timestamps](https://en.wikipedia.org/wiki/Unix_time). |
| `blackout` | Set a blackout date/time range when the event *cannot* run.  Requires additional `start` and `end` properties, set to [Epoch timestamps](https://en.wikipedia.org/wiki/Unix_time). |
| `delay` | Set an optional starting delay for all scheduled jobs.  Requires an additional `duration` property, set to the number of seconds to delay each job by. |

#### Schedule Rules

The `schedule` type describes a repeating event (when and how frequent it should run jobs).  It works similarly to the [Unix Cron](https://en.wikipedia.org/wiki/Cron) system, with selections of years, months, days, weekdays, hours and/or minutes.  Each property should be an array of numerical values.  If omitted, it means the same as "all" in that category (i.e. asterisk `*` in Cron syntax).

For example, an event with this timing object would run once per hour, on the hour:

```js
{
	"type": "schedule",
	"enabled": true,
	"minutes": [0]
}
```

It essentially means every year, every month, every day, every hour, but only on the `0` minute.  The scheduler ticks only once a minute, so this only results in running one job for each matching minute.

For another example, this would run twice daily, at 4:30 AM and 4:30 PM:

```js
{
	"type": "schedule",
	"enabled": true,
	"hours": [4, 16],
	"minutes": [30]
}
```

For a more complex example, this would run only in year 2023, from March to May, on the 1st and 15th of the month (but only if also weekdays), at 6AM to 10AM, and on the :15 and :45 of those hours:

```js
{
	"type": "schedule",
	"enabled": true,
	"years": [2023],
	"months": [3, 4, 5],
	"days": [1, 15],
	"weekdays": [1, 2, 3, 4, 5],
	"hours": [6, 7, 8, 9, 10],
	"minutes": [15, 45]
}
```

Here is a list of all the `schedule` type timing object properties and their descriptions:

| Timing Property | Range | Description |
|-----------------|-------|-------------|
| `years` | ∞ | One or more years in YYYY format. |
| `months` | 1 - 12 | One or more months, where January is 1 and December is 12. |
| `days` | 1 - 31 | One or more month days, from 1 to 31. |
| `weekdays` | 0 - 6 | One or more weekdays, where Sunday is 0, and Saturday is 6. |
| `hours` | 0 - 23 | One or more hours in 24-hour time, from 0 to 23. |
| `minutes` | 0 - 59 | One or more minutes, from 0 to 59. |
| `timezone` | n/a | Optional timezone to evaluate the schedule entry in. |
