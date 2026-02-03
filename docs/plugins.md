# Plugins

## Overview

This document describes the xyOps Plugin System.  You can extend xyOps with the inclusion of Plugins, either by writing them yourself (in any language!), or by finding one on the [Plugin Marketplace](marketplace.md).

## Plugin Types

Here are the Plugin Types available:

### Event Plugins

Event Plugins are the main type of Plugin in xyOps, as they actually are the code that "runs" jobs.  When events launch a job, either standalone or as part of a workflow, they all point to a specific Event Plugin, which executes the code that constitutes the job itself.  Event Plugins run on the target server running the job, and are launched as child processes from xySat, our remote agent.

Several built-in Event Plugins ship with xyOps.  They are:

| Plugin Name | Description |
|-------------|-------------|
| **[Shell Plugin](#shell-plugin)** | The Shell Plugin allows you to easily create events that execute arbitrary shell code, without having to learn the xyOps Plugin API. |
| **[HTTP Request Plugin](#http-request-plugin)** | The HTTP Plugin can send HTTP requests to any URL, and supports a variety of protocols and options, including custom headers and custom body content. |
| **[Test Plugin](#test-plugin)** | The Test Plugin exists mainly to test xyOps, but it can also be useful for testing pieces of workflows.  It outputs sample data and optionally a sample file, which are passed to downstream events, if connected. |
| **[Docker Plugin](#docker-plugin)** | The Docker Plugin allows you to run custom scripts inside a Docker container.  Similar to the [Shell Plugin](#shell-plugin), you can specify any custom code to run, and in any language, as long as it supports a [Shebang](https://en.wikipedia.org/wiki/Shebang_%28Unix%29) line. |

To write your own Event Plugin, all you need is to provide a command-line executable, and have it read and write JSON over [STDIN and STDOUT](https://en.wikipedia.org/wiki/Standard_streams).  Information about the current job is passed as a JSON document to your STDIN, and you can send back status updates and completion events simply by writing JSON to your STDOUT.

When your Plugin is executed on the target server for running a job, a unique temp directory will be created for it, and any files passed to the job will be pre-downloaded for you.  The CWD (current working directory) will be set to the temp dir, so your Plugin can easily list and access the input files.

#### Parameters

As with most other Plugin types, you can define custom parameters for Event Plugins.  These can be text fields, text boxes, code editors, select menus, checkboxes, or toolsets.  The user can then fill these out when they are editing the event, and they are passed to the Plugin when a job runs.  See [Plugin Parameters](#plugin-parameters) below for more details.

#### Input

When Event Plugins are invoked via a job launching, they are passed a JSON document on STDIN (compressed onto a single line).  The following top-level properties will be present in the object:

| Property Name | Type | Description |
|---------------|------|-------------|
| `xy` | Number | Indicates the [xyOps Wire Protocol](xywp.md) version.  Will be set to `1`. |
| `type` | String | The [Plugin.type](data.md#plugin-type), which will be set to `event`. |
| `params` | Object | If the Plugin defines any parameters, their values will be here. |
| (Other) | Various | All the properties from the [Job](data.md#job) object are included here. |

Here is an example JSON document sent to an Event Plugin's STDIN as part of a job launch:

```json
{
	"xy": 1,
	"type": "event",
	"targets": [
		"main"
	],
	"params": {
		"animal": "frog",
		"color": "green"
	},
	"input": {
		"data": { "foo": "bar" },
		"files": []
	},
	"fields": [],
	"limits": [],
	"actions": [],
	"notes": "",
	"category": "general",
	"plugin": "pmi11dqsxcy",
	"icon": "",
	"tags": [],
	"algo": "random",
	"username": "admin",
	"source": "user",
	"event": "emi11ejdlde",
	"id": "jmi11fqevei",
	"command": "node",
	"script": "console.log( JSON.stringify({ xy: 1, code: 0, description: \"Job successful!\" }) );\n",
	"uid": "",
	"gid": "",
	"kill": "parent",
	"env": {},
	"state": "active",
	"started": 1763256572.033,
	"now": 1763256572.024,
	"log_file_size": 0,
	"server": "smf4j79snhe",
	"groups": [
		"main"
	],
	"updated": 1763256572.033,
	"progress": 0,
	"cwd": "/opt/xyops/satellite/temp/jobs/jmi11fqevei",
	"log_file": "/opt/xyops/satellite/logs/jobs/job-jmi11fqevei.log",
	"pid": 1789701
}
```

See the [Job](data.md#job) structure for more details on these properties.

Note that all Plugin parameters are also passed to your Plugin process as environment variables (with IDs converted as needed).

##### Input Files

If your job is passed input files (either by a previous job, attached workflow node, or by manual user upload), they are made available to your Event Plugin, and file metadata is provided to you as well.

First, all job input files are automatically written out to the job's unique temp directory, which is also the current working directory for your plugin.  This directory will be empty *except* for any input files, so you can use a [glob](https://en.wikipedia.org/wiki/Glob_%28programming%29) to list them.  However, the list of files is also provided to you via the [Job.input](data.md#job-input) object, specifically `input.files`.  Here is an example:

```json
"input": {
	"data": {},
	"files": [
		{
			"id": "fmktcdzp1skybhk9",
			"date": 1769321584,
			"filename": "mario.mp3",
			"size": 309425,
			"username": "admin"
		},
		{
			"id": "fmktcdzpasm25ncs",
			"date": 1769321584,
			"filename": "webb_2.jpg",
			"size": 1065694,
			"username": "admin"
		}
	]
}
```

So you can also discover and iterate over your input files by accessing this data structure.

#### Output

Your Plugin is expected to write JSON to STDOUT in order to report status back to the xyOps primary conductor.  At the very least, you need to notify xyOps that the job was completed, and the result of the job (i.e. success or fail).  This is done by printing a JSON object with a `xy` property set to `1` (indicating the [xyOps Wire Protocol](xywp.md) version), and a `code` property set to `0` indicating success.  You need to make sure the JSON is compacted onto a single line, and ends with a single EOL character (`\n` on Unix).  Example:

```json
{ "xy": 1, "code": 0 }
```

This tells xyOps that the job was completed successfully, and your process is about to exit.  However, if the job failed and you need to report an error, you need to set the `code` property set to any non-zero error code you want, and add a `description` property set to a custom error string.  Include these along with the `xy` property in the JSON.  Example:

```json
{ "xy": 1, "code": 999, "description": "Failed to connect to database." }
```

Your error code and description will be displayed on the Job Details page in the UI, and in any e-mail notifications and/or web hooks sent out for the event completion.  The error code can be a number or a string.

If your Plugin writes anything other than JSON to STDOUT (or STDERR), or it is missing the `xy` property, it is automatically appended to your log file as text.  This is so you don't have to worry about using existing code or utilities that may emit some kind of JSON output.  xyOps is very forgiving in this regard.

Please note that the once you send a JSON line containing the `code` property, xyOps will consider your job completed, and *not process any further JSON updates from your Plugin*.  So make sure it is the **last** JSON line you send for a job.

##### Progress

In addition to reporting success or failure at the end of a job, you can also optionally report progress at custom intervals while your job is running.  This is how xyOps can display its visual progress meter in the UI, as well as calculate the estimated time remaining.  To update the progress of a job, simply print a JSON document with a `xy` property set to `1`, and a `progress` property, set to a number between `0.0` and `1.0`.  Example:

```json
{ "xy": 1, "progress": 0.5 }
```

This would show progress at 50% completion, and automatically calculate the estimated time remaining based on the duration and progress so far.  You can repeat this as often as you like, with as granular progress as you can provide.

> [!IMPORTANT]
> Beware of STDIO output buffering which many languages enable by default.  This may delay your progress updates (not to mention other output), unless you set it to auto-flush on every write.  See your specific language documentation for details.

##### Perf Metrics

You can optionally include performance metrics at the end of a job, which are displayed as a pie chart on the Job Details page.  These metrics can consist of any categories you like, and the JSON format is a simple `perf` object where the values represent the amount of time spent in seconds.  Example:

```json
{ "xy": 1, "perf": { "db": 18.51, "http": 3.22, "gzip": 0.84 } }
```

The perf keys can be anything you want.  They are just arbitrary categories you can make up, which represent how your Plugin spent its time during the job.

xyOps accepts a number of different formats for the perf metrics, to accommodate various performance tracking libraries.  For example, you can provide the metrics in query string format, like this:

```json
{ "xy":1, "perf": "db=18.51&http=3.22&gzip=0.84" }
```

If your metrics include a `total` (or `t`) in addition to other metrics, this is assumed to represent the total time, and will automatically be excluded from the pie chart (but included in the performance history graph).

If you track metrics in units other than seconds, you can provide the `scale`.  For example, if your metrics are all in milliseconds, just set the `scale` property to `1000`.  Example:

```json
{ "xy": 1, "perf": { "scale": 1000, "db": 1851, "http": 3220, "gzip": 840 } }
```

The slightly more complex format produced by our own [pixl-perf](https://www.npmjs.com/package/pixl-perf) library is also supported.

##### Custom Content

If your Plugin produces statistics or other tabular data, you can have xyOps render this into a table on the Job Details page.  You can do this during or at the end of a job run.  Simply print a JSON object with a property named `table`, containing the following keys:

| Property Name | Description |
|---------------|-------------|
| `title` | Optional title displayed above the table, defaults to "Job Data Table". |
| `header` | Optional array of header columns, displayed in shaded bold above the main data rows. |
| `rows` | **Required** array of rows, with each one being its own inner array of column values. |
| `caption` | Optional caption to show under the table (centered, small gray text). |

Here is an example data table.  Note that this has been expanded for documentation purposes, but in practice your JSON needs to be compacted onto a single line when printed to STDOUT.

```json
{
	"xy": 1,
	"table": {
		"title": "Sample Job Stats",
		"header": [
			"IP Address", "DNS Lookup", "Flag", "Count", "Percentage"
		],
		"rows": [
			["62.121.210.2", "directing.com", "MaxEvents-ImpsUserHour-DMZ", 138, "0.0032%" ],
			["97.247.105.50", "hsd2.nm.comcast.net", "MaxEvents-ImpsUserHour-ILUA", 84, "0.0019%" ],
			["21.153.110.51", "grandnetworks.net", "InvalidIP-Basic", 20, "0.00046%" ],
			["95.224.240.69", "hsd6.mi.comcast.net", "MaxEvents-ImpsUserHour-NM", 19, "0.00044%" ],
			["72.129.60.245", "hsd6.nm.comcast.net", "InvalidCat-Domestic", 17, "0.00039%" ],
			["21.239.78.116", "cable.mindsprung.com", "InvalidDog-Exotic", 15, "0.00037%" ],
			["172.24.147.27", "cliento.mchsi.com", "MaxEvents-ClicksPer", 14, "0.00035%" ],
			["60.203.211.33", "rgv.res.com", "InvalidFrog-Croak", 14, "0.00030%" ],
			["24.8.8.129", "dsl.att.com", "Pizza-Hawaiian", 12, "0.00025%" ],
			["255.255.1.1", "favoriteisp.com", "Random-Data", 10, "0%" ]
		],
		"caption": "This is an example stats table you can generate from within your Plugin code."
	}
}
```

If you would prefer to generate your own custom HTML content from your Plugin code, and just have it rendered into the Job Details page, you can do that as well.  Simply print a JSON object with a property named `html`, containing the following keys:

| Property Name | Description |
|---------------|-------------|
| `title` | Optional title displayed above the section, defaults to "Job Custom Data". |
| `content` | **Required** Raw HTML content to render into the page. |
| `caption` | Optional caption to show under your HTML (centered, small gray text). |

Here is an example HTML report.  Note that this has been expanded for documentation purposes, but in practice your JSON needs to be compacted onto a single line when printed to STDOUT.

```json
{
	"xy": 1,
	"html": {
		"title": "Sample Job Report",
		"content": "This is <b>HTML</b> so you can use <i>styling</i> and such.",
		"caption": "This is a caption displayed under your HTML content."
	}
}
```

Note that only basic HTML elements are allowed here, in order to prevent XSS attacks.  See `sanitize_html_config` in the `/opt/xyops/internal/ui.json` file for the full list of allowed tags.

If your Plugin generates plain text instead of HTML, you can change `html` to `text`, which will preserve formatting such as whitespace.  Example:

```json
{
	"xy": 1,
	"text": {
		"title": "Sample Text Report",
		"content": "This is plain text, so no styling allowed here.",
		"caption": "This is a caption displayed under your text content."
	}
}
```

Similarly, if your Plugin generates markdown, you can include that instead of HTML or text:

```json
{
	"xy": 1,
	"markdown": {
		"title": "Sample Markdown Report",
		"content": "This is **Markdown** so you can use *styling*, [links](https://xyops.io) and such.",
		"caption": "This is a caption displayed under your Markdown content."
	}
}
```

Note that only one of `html`, `text` or `markdown` output is allowed per job (text and markdown are rendered down to HTML).

##### Job Labels

Your can optionally add custom labels to your jobs, which will be displayed on the completed job history pages alongside the Job IDs.  This is useful if you launch jobs with custom parameters, and need to differentiate them in the completed list.

To set the label for a job, simply include a `label` property in your Plugin's JSON output, set to any string you want.  Example:

```json
{ "xy": 1, "label": "Reindex Database" }
```

This would cause the "Reindex Database" label to be displayed alongside the Job ID.

##### Output Data

To include arbitrary data output from your job, which will be automatically passed to the next job (via workflow node connection or run event action), use this message format:

```json
{
	"xy": 1,
	"data": {
		"text": "This is some sample data to pass to the next job!",
		"hostname": "raspberrypi",
		"pid": 13094,
		"random": 0.54,
		"obj": { "foo": 1, "bar": null, "bool": true }
	}
}
```

The format of the `data` object is freeform, and can contain whatever content you want.  Note that the above example is pretty-printed for display, but in practice all messages must be sent as single lines, so remember to compact your JSON when serializing it.

Note that if you send multiple messages with `data` properties, the previous data is overwritten (i.e. the latter prevails).

##### Output Files

To upload files as part of your job output, you can simply tell xyOps where they are on disk.  When your job completes, the files will be attached and uploaded with the job data, and displayed in the UI.  They will also be passed to the next job if applicable (via workflow node connection or run event action).  Here is an example:

```json
{
	"xy": 1,
	"files": [
		"/path/to/file1.txt",
		"/path/to/file2.mp4"
	]
}
```

You don't actually have to name each file.  You can instead specify a wildcard (glob pattern) which may match multiple files:

```json
{
	"xy": 1,
	"files": [ "/path/to/*.mp4" ]
}
```

If the files are located in the current working directory (your job's unique temp directory), you can omit the leading path and just include filename(s):

```json
{
	"xy": 1,
	"files": [ "*.mp4" ]
}
```

Note that if you send multiple messages with `files` properties, the previous list is overwritten (i.e. the latter prevails).

##### Tags

To **add** tags to the current job, use the following "push" message format:

```json
{
	"xy": 1,
	"push": {
		"tags": ["tag1", "tag2"]
	}
}
```

The `push` object is used here to instruct xyOps to "push" (append) tags onto the existing set (you cannot replace or delete tags).  The tags themselves should be valid [Tag.id](data.md#tag-id)s, and duplicates are automatically removed.

##### Actions

To **add** actions to the current job, use the following "push" message format.  This example would send an email to a specific address when the job completes:

```json
{
	"xy": 1,
	"push": {
		"actions": [
			{ "condition": "complete", "type": "email", "email": "admin@mycompany.com", "enabled": true }
		]
	}
}
```

Here is another example which will launch a subsequent job when the current job completes successfully:

```json
{
	"xy": 1,
	"push": {
		"actions": [
			{ "condition": "success", "type": "run_event", "event_id": "emi2d3f42zy", "params": {}, "enabled": true }
		]
	}
}
```

The `push` object is used here to instruct xyOps to "push" (append) actions onto the existing set (you cannot replace or delete actions).  See [Action Types](actions.md#action-types) for all the possible action objects you can add here.

### Action Plugins

Action Plugins are designed for custom actions that take place in response to jobs starting, completing, or completing with specific result codes (e.g. success, error, warning, critical, etc.).  They can also run in response to alerts firing or clearing.  You can already assign a number of [built-in actions](actions.md) including sending an email, firing a web hook, launching an event, taking a server snapshot, and more.  But with Plugins you can write your own actions that do anything you want.  They can even be configured to accept a custom set of parameters that are configured by the user in the UI.

Action Plugins run *on the primary conductor server*, as they are part of the core engine.  However, you can still write them in any language, as they are spawned as a child subprocess, and communication API is JSON over STDIO.  To create an Action Plugin, navigate to the **Plugins** page, and click the **New Plugin** button.  For the Plugin type, select "Action Plugin".

#### Parameters

As with most other Plugin types, you can define custom parameters for Action Plugins.  These can be text fields, text boxes, code editors, select menus, checkboxes, or toolsets.  The user can then fill these out when they are editing the event or alert, and they are passed to the Plugin when the action fires.  See [Plugin Parameters](#plugin-parameters) below for more details.

#### Input

When Action Plugins are invoked, they are passed a JSON document on STDIN (compressed to a single line).  The following top-level properties will be present in the object:

| Property Name | Type | Description |
|---------------|------|-------------|
| `xy` | Number | Indicates the [xyOps Wire Protocol](xywp.md) version.  Will be set to `1`. |
| `type` | String | The [Plugin.type](data.md#plugin-type), which will be set to `action`. |
| `condition` | String | The [Action.condition](data.md#action-condition) which activated the Plugin. |
| `params` | Object | If the Plugin defines any parameters, their values will be here. |
| (Other) | Various | Based on context; see below. |

If the Action Plugin is being invoked in job-related context (i.e. on job start, job complete, or other job actions) the contents of [JobHookData](data.md#jobhookdata) will also be merged in at the top-level.  Similarly, if the plugin is being invoked in an alert-related context (alert fired or cleared), then the contents of [AlertHookData](data.md#alerthookdata) will be merged in.

Here is an example JSON document sent to an Action Plugin's STDIN as part of a job completion:

```json
{
	"xy": 1,
	"type": "action",
	"condition": "success",
	"params": {
		"foo": "Baz"
	},
	"job": {
		"id": "jmhzaot10tm",
		"complete": true,
		"code": 0,
		"description": "",
		"completed": 1763151180.219,
		"elapsed": 0.701
		/* See Job data structure for more */
	},
	"action": {
		"type": "plugin",
		"condition": "success",
		"plugin_id": "pmhzan6voso",
		/* See Action data structure for more */
	},
	"event": {
		"id": "emhzaoispta",
		/* See Event data structure for more */
	},
	"plugin": {
		"id": "shellplug",
		/* See Plugin data structure for more */
	},
	"category": {
		"id": "general",
		/* See Category data structure for more */
	},
	"server": {
		"id": "smf4j79snhe",
		/* See Server data structure for more */
	},
	"nice_server": "raspberrypi",
	"nice_hostname": "raspberrypi",
	"links": {
		"job_details": "https://local.xyops.io:5523/#Job?id=jmhzaot10tm",
		"job_log": "https://local.xyops.io:5523/api/app/download_job_log?id=jmhzaot10tm&t=lnJY9P2-VTuqNIlV7jReuw",
		"job_files": "(None)"
	},
	"display": {
		"elapsed": "0 seconds",
		"log_size": "23 bytes",
		"perf": "(No metrics provided)",
		"mem": "47.4 MB (Peak: 47.4 MB)",
		"cpu": "28% (Peak: 28%)"
	},
	"text": "xyOps Job completed successfully on raspberrypi: Run Custom Action: https://local.xyops.io:5523/#Job?id=jmhzaot10tm"
}
```

See [JobHookData](data.md#jobhookdata) for more details on these properties.

And here is an example JSON document sent to an Action Plugin's STDIN as part of a new alert triggering:

```json
{
	"xy": 1,
	"type": "action",
	"condition": "alert_new",
	"alert_def": {
		"id": "active_jobs_high",
		/* See Alert data structure for more */
	},
	"params": {
		"foo": "Foosball"
	},
	"server": {
		"id": "smf4j79snhe",
		/* See Server data structure for more */
	},
	"alert": {
		"id": "amhzbmb6jhw",
		"exp": "monitors.active_jobs >= 1",
		"message": "Active job count is too high: 1",
		/* See AlertInvocation data structure for more */
	},
	"active_jobs": [
		{
			"id": "jmhzblxlvhl",
			"event": "emfetc6wcpw"
		}
	],
	"date_time": "Fri Nov 14 2025 12:39:02 GMT-0800 (Pacific Standard Time)",
	"nice_groups": "Main Group",
	"nice_load_avg": 0.02,
	"nice_mem_total": "906.2 MB",
	"nice_mem_avail": "624.4 MB",
	"nice_uptime": "91 days",
	"nice_cpu": "Sony UK BCM2837 (arm64)",
	"nice_os": "Debian GNU/Linux 12",
	"nice_notes": "(None)",
	"nice_hostname": "raspberrypi",
	"nice_ip": "10.1.10.92",
	"nice_server": "raspberrypi",
	"nice_active_jobs": "- [Job #jmhzblxlvhl](https://local.xyops.io:5523/#Job?id=jmhzblxlvhl) (Convert Video Format)\n",
	"links": {
		"server_url": "https://local.xyops.io:5523/#Server?id=smf4j79snhe",
		"alert_url": "https://local.xyops.io:5523/#Alerts?id=amhzbmb6jhw"
	},
	"text": "xyOps Alert: raspberrypi: High Active Jobs: n/a: https://local.xyops.io:5523/#Alerts?id=amhzbmb6jhw"
}
```

See [AlertHookData](data.md#alerthookdata) for more details on these properties.

#### Output

When your Action Plugin has completed, you can inform xyOps of the result (success or fail), and any additional details you might want to add.  This is done by sending a JSON record out through your process STDOUT.  Similar to the document you received via STDIN, it needs to have a top-level `xy` property set to `1`, a `code` property indicating success or fail, and an optional `description` property:

```json
{
	"xy": 1,
	"code": 0,
	"description": "Action success!"
}
```

As with all other xyOps APIs, a code of `0` or `false` indicates success, while any other value means that an error occurred.  You can use the `description` property to pass an optional success or error message.  All this information will be stored with the job or alert, and displayed in the xyOps UI.

As an advanced tip, you can also include an optional `details` property, which is rendered as Markdown in the details dialog for the action.  This can be useful if your action produces a large amount of output or logs that you want to capture and expose to the user.

If your Plugin does not output JSON, no problem.  When no JSON is detected in the output stream, xyOps will assume success or failure based on the process exit code, and display the raw output as plain text, if any.

### Trigger Plugins

Trigger Plugins are extensions of the scheduler system, in that they can decide "when" and "if" to launch jobs.  Specifically, if an event uses a trigger plugin, it is consulted *once per scheduled job*, and the Plugin decides whether to launch each assigned job or not.  For example, this can be used for custom timing algorithms like sunrise / sunset, or even watching a directory or S3 prefix for new files to appear.

This is a "modifier" trigger, so it needs to be configured in conjunction with a standard schedule trigger.  The schedule sets the cadence and frequency of when the Plugin is launched.

Trigger Plugins run *on the primary conductor server*, as they execute before a job is launched and before a server is chosen for it.  However, like the other Plugin types, they are spawned as sub-processes and can be written in virtually any language.  There is no SDK to use -- xyOps communicates with Plugins via simple JSON over STDIO.

To create a Trigger Plugin, navigate to the **Plugins** page, and click the **New Plugin** button.  For the Plugin type, select "Trigger Plugin".

#### Parameters

As with most other Plugin types, you can define custom parameters for Trigger Plugins.  These can be text fields, text boxes, code editors, select menus or checkboxes.  The user can then fill these out when they are editing the event, and they are passed to the Plugin when deciding to run jobs for that event.

#### Input

When your trigger plugin is invoked, it will be passed an array of all the events awaiting a launch decision (i.e. all the events which have added your trigger plugin to them).  A single line of JSON will be passed to your plugin process via STDIN, which looks like this (pretty-printed for display purposes):

```json
{
	"xy": 1,
	"type": "trigger",
	"items": [
		{
			"timezone": "America/Los_Angeles", 
			"now": 1757642510, 
			"dargs": {
				"year": 2022, 
				"month": 11, 
				"day": 29, 
				"rday": -3,
				"weekday": 2, 
				"hour": 22, 
				"minute": 29
			}, 
			"params": {
				"longitude": -118.2437,
				"latitude": 34.0522
			}, 
			"job": {
				"id": "emdy0mg1oum",
				"title": "Convert Video Format",
				"enabled": true,
				"username": "admin",
				"modified": 1726463348,
				"created": 1726463348,
				"category": "cat2",
				"targets": [
					"main"
				],
				"algo": "random",
				"notes": ""
			}
		}
	]
}
```

As with all xyOps STDIO communication, the JSON will always have a top-level `xy` property set to `1` (the [xyOps Wire Protocol](xywp.md) version), and a `type` property set to `trigger`.  Also present is an `items` array, which will contain an element for each event that has the plugin assigned as a trigger.  It is up to your plugin code to decide if each event should launch a job or not.  You are also provided some other information about the events:

| Property Name | Type | Description |
|---------------|------|-------------|
| `timezone` | String | The currently selected timezone for the event. |
| `now` | Number | The current time for the potential job launch in Epoch seconds.  Note that this may be in the past, if xyOps is catching up on missed events. |
| `dargs` | Object | The current date/tme for the job launch, separated out into individual numerical elements, in the event's timezone.  See below for details. |
| `params` | Object | This object will contain your plugin's own custom defined parameters, filled out by the user at the event level. |
| `job` | Object | This is a copy of the [Event](data-strictured.md#event) object that will be used to launch the job if your plugin decides it should. |

Here are descriptions of all the `dargs` date/time properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `year` | Number | The year as an integer, e.g. `2025`. |
| `month` | Number | The month number from `1` to `12`. |
| `day` | Number | The month day from `1` to `31`. |
| `rday` | Number | The reverse month day (e.g. the last day of the month will be `-1`, the second-to-last day will be `-2`, and so on). |
| `weekday` | Number | A number representing the day of the week, from `0` (Sunday) to `6` (Saturday). |
| `hour` | Number | The hour in 24-hour format (from `0` to `23`). |
| `minute` | Number | The minute number from `0` to `59`. |

The JSON will be provided to your plugin as a single line on STDIN.  You will need to read and parse the JSON to iterate over the `items` array.  Here is an example in Node.js (but you can use any language you want):

```js
// read JSON from STDIN
const chunks = [];
for await (const chunk of process.stdin) { chunks.push(chunk); }
const data = JSON.parse( chunks.join('') );

data.items.forEach( function(item) {
	// do something with item...
} );
```

#### Output

Once your plugin decides which events should launch jobs (if any), you need to communicate that information back to xyOps.  This is done by sending a JSON record out through your process STDOUT.  Similar to the document you received via STDIN, it needs to have a top-level `xy` property set to `1`, and an `items` array:

```json
{
	"xy": 1,
	"items": [ false, false, true ]
}
```

The `items` array should have the same number of elements as the initial one you received, and each element can be set to a simple Boolean as shown above.  In this case `true` means launch a job for the event, and `false` means do not.  Each item in your output array needs to line up with the corresponding object in the input array, via their indexes.

Now, instead of a simple Boolean, the items can also be objects containing a `launch` Boolean (indicating whether to launch a job or not).  This alternate verbose format exists so you can include additional metadata for the launched jobs.  Example:

```json
{
	"xy": 1,
	"items": [ 
		{
			"launch": false
		},
		{
			"launch": false
		},
		{
			"launch": true,
			"data": { "mykey1": "myvalue1" },
			"files": [ "/path/to/file.txt" ]
		}
	]
}
```

In fact, what you can do instead of constructing a new `items` array for the output, is to modify in place the existing `items` array you received via STDIN (i.e. just add `launch` and other properties directly to it), and then echo the modified object back out via STDOUT.  To illustrate this, here is a silly example that randomly launches jobs based on a 50% probability:

```js
// read JSON from STDIN
const chunks = [];
for await (const chunk of process.stdin) { chunks.push(chunk); }
const data = JSON.parse( chunks.join('') );

data.items.forEach( function(item) {
	// randomly launch a job or not (silly example)
	item.launch = Math.random() < 0.5;
} );

// write to STDOUT
process.stdout.write( JSON.stringify(data) + "\n" );
```

Obviously your plugin will do something more useful than this, but you get the idea.  See the following sections to learn what else you can include in the `items` array elements.

##### Data

When your trigger plugin decides to launch a job, you can optionally include arbitrary data that will be passed to it.  This is done by including a `data` object inside the item element, alongside the `launch` boolean.  Example:

```json
{
	"xy": 1,
	"items": [ 
		{
			"launch": false
		},
		{
			"launch": false
		},
		{
			"launch": true,
			"data": { 
				"mykey1": "myvalue1",
				"mykey2": "myvalue2"
			}
		}
	]
}
```

The format of the `data` property is user-defined, and it will be passed verbatim to the launched job, becoming the [input.data](data.md#job-input) property inside the [Job](data.md#job) object (same as if data is passed to it from a previous chained job, workflow, action, etc.).

##### Files

You can also send along files to your launched jobs.  These will be attached to the job as inputs, and automatically downloaded in each job's temp directory on the remote server.  To do this, include a `files` array alongside your `launch` property.  The files array should be populated like this:

```json
{
	"xy": 1,
	"items": [ 
		{
			"launch": false
		},
		{
			"launch": false
		},
		{
			"launch": true,
			"files": [
				{ "path": "/path/to/file.jpg", "delete": true }
			]
		}
	]
}
```

Each object in the `files` array needs to have a `path` property that points to a single file.  You can also optionally pass a `delete` property.  If this is set to `true` then xyOps will automatically delete the file after it is uploaded.

This mechanism works the same as if the files were passed to your job from a previous chained job, workflow, action, etc.

##### Delay

If you would like to delay a job launch, send back a `delay` property alongside the `launch` Boolean, set to the number of seconds you want the job to wait before running.  Example:

```json
{
	"xy": 1,
	"items": [ 
		{
			"launch": false
		},
		{
			"launch": false
		},
		{
			"launch": true,
			"delay": 30
		}
	]
}
```

Note that this mechanism works similarly to the built-in [Delay](triggers.md#delay) scheduler option.  Meaning, the job still "launches" but is set to a special pending state until the specified delay elapses, at which time the job becomes active and runs proper.  Also note that the delay value is computed relative to the job's original start time (i.e. the [Job.now](data.md#job-now) actual on-the-minute time).

### Monitor Plugins

Monitor Plugins can extend the xyOps monitoring system by gathering **any** custom metrics that you want.  These Plugins run directly on the servers they are targeted to (i.e. xySat runs them as child processes), and then their custom metrics are included along with the server last-minute monitoring data sent back to the xyOps conductor server.

Instead of running in response to an event or action, Monitor Plugins run every single minute, 24x7.  They are essentially "data collectors", and are expected to produce monitoring data for the instant in which they are run, or in many cases they return accumulated data for the last 60 seconds.

Monitor Plugins differ from the other xyOps Plugin types in that they are not passed a JSON document on STDIN, and they do not need to produce a specific JSON output format.  The API contract for these plugins is simpler -- they just execute every minute, and they can output freeform JSON, XML, or plain text.  It is then up to your [Monitors](monitors.md) to pull specific data values out of that data, and use them for graphs, alerts, etc.

Here is an example.  This Plugin actually ships with xyOps, and it tracks the total number of open files on the server:

- **Plugin Title**: Count Open Files
- **Plugin ID**: `open_files`
- **Command**: `/bin/sh`
- **Script**: `cat /proc/sys/fs/file-nr`
- **Format**: `text`

That's it -- that's the entire Plugin, including the source code.  In this example the code is this small `/bin/sh` shell script:

```sh
cat /proc/sys/fs/file-nr
```

The output of this is obviously just plain text:

```
1056	0	9223372036854775807
```

But that's fine!  The syntax doesn't matter at this point.  What happens is, this raw data gets included with the server's [ServerMonitorData.commands](data.md#servermonitordata-commands), keyed by the [Plugin.id](data.md#plugin-id), and is then made available to monitors and alerts in this format:

```json
"commands": {
	"open_files": "1056\t0\t9223372036854775807"
}
```

Then separately, we define a [Monitor](monitors.md) which pulls the appropriate value (in this case the first number) out of the raw text:

- **Monitor Title**: Open Files
- **Expression**: `commands.open_files`
- **Data Match**: `(\\d+)`
- **Data Type**: `integer`

And it's as simple as that.  Our custom monitor now graphs the total open files on the server over time, based on a custom command we execute.

If your Monitor Plugin is set to XML or JSON format, you can actually output a large, multi-value data structure, and different monitors can grab specific values out of it.  This is really useful for things like grabbing **all** of your application's performance metrics in one command, output it as a large JSON/XML structure, and then you can configure individual xyOps monitors to pull out and graph specific values.  Alerts can trigger on the data values as well.



## Plugin Parameters

Most Plugins accept one or more "parameters", which are configurable user fields.  These are displayed in the UI for users to populate when they are configuring events or workflows.  See below for all the types of parameters available.  See [Plugin.params](data.md#plugin-params) for the internal data structure.

### Text

A "text" parameter type is presented to the user as a single-line text field.

An optional "variant" property may be included, which changes the visible UI control in the browser: `color`, `date`, `datetime-local`, `email`, `number`, `password`, `text`, `time`, `tel` or `url`.

Note that the parameter value is almost always set to a string -- the "variant" only controls the visual UI control and behavior.  However, the "number" variant is a special case, where the value will actually be parsed and stored in the parameters as an actual JavaScript Number.

### Textarea

A "textarea" parameter type is presented to the user as a multi-line text box.  Here the user can enter multiple lines of text (no maximum length is enforced).

### Code

A "code" parameter type is a variant of the textarea, but it is presented to the user as a button that pops up a full code editor dialog.  The user can enter "code" of any language, and the format is automatically detected and syntax-highlighted.

### JSON

A "JSON" parameter type is a variant of the textarea, but it is presented to the user as a button that pops up a full code editor dialog with JSON syntax-highlighting and line numbers.  The JSON is also validated, so the user can only enter a proper JSON document.

This type is special in that the JSON is parsed and stored in the parameters as a real object (not a string).

### Menu

A "menu" is presented as a drop-down menu, with a configurable list of items.  The plugin declares these as a CSV list.  Example:

```
Alpha, Beta, Gamma
```

This item has type `select` in the API, to match the HTML element of the same name.

To include an empty item at the top of the menu (allowing the user to select "nothing" as an option), simply start the CSV list with a leading comma.  Example:

```
, Alpha, Beta, Gamma
```

To set the item values and the labels separately, specify the values in square brackets like this:

```
Alpha [a1], Beta [b2], Gamma [c3]
```

This would show only the labels in the menu ("Alpha", "Beta", "Gamma"), but in the data the values would be specified instead (`a1`, `b2`, `c3`).  Note that the values may only contain alphanumerics, underscores, dashes and dots, and when this feature is used the visual labels are **not** passed into the data at all.

### Bucket Menu

A "bucket menu" is a dynamically populated menu, which automatically loads its items from a global [Storage Bucket](buckets.md) that you configure.  Using this feature you can have menus across multiple Plugins or events that all share the same item pool.

To define the set of items, simply create a Storage Bucket, and edit the JSON data within.  Place your JSON array anywhere in the bucket data.  Example:

```json
{
	"countries": [
		"United States",
		"Canada",
		"Mexico",
		"Brazil",
		"United Kingdom",
		"France",
		"Germany",
		"Japan",
		"Australia",
		"South Africa"
	]
}
```

Make sure to save the bucket changes after editing the JSON.

Then, when you add your parameter and select the "Bucket Menu" field type, you will need to select the target bucket, and optionally enter a "Data Path".  The path is how to specify *where* inside the storage bucket your item array lives.  In the above example it's in a top-level property named `countries`, so that's exactly what you'd enter for the Data Path.

This allows you to store multiple different item lists in the same storage bucket.

Alternatively, if your item array lives at the very top level of the bucket JSON data, i.e. like this:

```json
[
	"United States",
	"Canada",
	"Mexico",
	"Brazil",
	"United Kingdom",
	"France",
	"Germany",
	"Japan",
	"Australia",
	"South Africa"
]
```

Then you should leave the "Data Path" field empty (as in this case the *entire* bucket data is the array).

This feature also allows you to customize the menu item "values" (i.e. what goes into the [Job.params](data.md#job-params)) and menu item "labels" (i.e. what is displayed in the menu) separately.  To do this, define your JSON array as an array of objects, with each object containing an `id` and a `title` property.  Example:

```json
{
	"countries": [
		{ "id": "US", "title": "United States" },
		{ "id": "CA", "title": "Canada" },
		{ "id": "MX", "title": "Mexico" },
		{ "id": "BR", "title": "Brazil" },
		{ "id": "GB", "title": "United Kingdom" },
		{ "id": "FR", "title": "France" },
		{ "id": "DE", "title": "Germany" },
		{ "id": "JP", "title": "Japan" },
		{ "id": "AU", "title": "Australia" },
		{ "id": "ZA", "title": "South Africa" }
	]
}
```

So in this case if the user selected "Germany" from the menu, the actual job param value would be the string `DE`.

Finally, you can define groups of items in the menu by including an object with a `label` and an `items` sub-array.  These show up as delimited labeled sections within the menu (a.k.a. an [optgroup](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/optgroup)).  Example of this:

```json
{
	"countries": [
		{
			"label": "Americas",
			"items": [
				{ "id": "US", "title": "United States" },
				{ "id": "CA", "title": "Canada" },
				{ "id": "MX", "title": "Mexico" },
				{ "id": "BR", "title": "Brazil" }
			]
		},
		{
			"label": "Europe",
			"items": [
				{ "id": "GB", "title": "United Kingdom" },
				{ "id": "FR", "title": "France" },
				{ "id": "DE", "title": "Germany" }
			]
		},
		{
			"label": "Asia / Other",
			"items": [
				{ "id": "JP", "title": "Japan" },
				{ "id": "AU", "title": "Australia" },
				{ "id": "ZA", "title": "South Africa" }
			]
		}
	]
}
```

### Checkbox

A checkbox is displayed with a label, and the "checked" state is stored as a Boolean parameter value (`true` or `false`).

### Hidden

A hidden type is not shown in the UI.  Instead, it's just a hidden, pre-populated key/value pair that is passed to the Plugin as a parameter.  The value is specified when the hidden field is added.

### Toolset

Arguably the most powerful of the Plugin parameter types, the "toolset" is presented as a drop-down menu, with a dynamic set of sub-parameters that appear based on the menu selection (i.e. the "tool").  In this way you can request different parameters from the user based on whichever "tool" is selected.

The toolset "data" is entered in JSON format, and describes all the tools and sub-parameters that should be displayed for each tool.  Here is an example:

```json
{
	"tools": [
		{
			"id": "uploadFiles",
			"title": "Upload Files",
			"description": "Upload local files to S3",
			"fields": [
				{
					"id": "localPath",
					"title": "Local Path",
					"type": "text",
					"value": ".",
					"caption": "The base filesystem path to find files under. Should resolve to a folder."
				},
				{
					"id": "filespec",
					"title": "Filename Pattern",
					"type": "text",
					"value": ".+",
					"caption": "Optionally filter the local files using a regular expression, applied to the filenames."
				},
				{
					"id": "remotePath",
					"title": "Remote Path",
					"type": "text",
					"value": "",
					"caption": "The base S3 path to store files under."
				},
			]
		},
		{
			"id": "listFiles",
			"title": "List Files",
			"description": "Generate a file listing of an S3 prefix",
			"fields": [
				{
					"id": "remotePath",
					"title": "Remote Path",
					"type": "text",
					"value": "",
					"caption": "The base S3 path to look for files under."
				},
				{
					"id": "filespec",
					"title": "Filename Pattern",
					"type": "text",
					"value": ".+",
					"caption": "Optionally filter the result files using a regular expression, matched on the filenames."
				}
			]
		}
	]
}
```

In this fictional example, the toolset menu would show two tools: "Upload Files" and "List Files".  When "Upload Files" was selected in the menu, three new sub-parameters would appear in a box under the menu: "Local Path", "Filename Pattern" and "Remote Path".  If the user selected a different tool, e.g. "List Files", then the sub-parameters would change, and a different set would be shown.

Note that when all the parameter values are collected from the user, they are "flattened" into a single-level object.

## Macro Expansion

All Plugin Parameter string values support inline macro expansion using the common `{{ mustache }}` syntax.  Using this feature you can dynamically insert values into parameters from arbitrary data passed into the job from a previous job (connected workflow node or launched by action).  Here is how it works.  Imagine that a previous job completes, and outputs the following data:

```json
{
	"xy": 1,
	"code": 0,
	"data": {
		"animal": "frog",
		"color": "green"
	}
}
```

This data object is then passed into the next job's input (either by workflow or run event action).  You could access the data directly in your Plugin by parsing the JSON from STDIN and looking in `input.data`.  However, the idea with macro expansion is that user can reroute data values into Plugin parameters.  Let's say your Plugin has a text field parameter, and the user populated it in the event configuration like this:

```
My favorite animal is {{ data.animal }}, and my favorite color is {{ data.color }}.
```

When the job runs, those `{{ mustache }}` placeholders are automatically expanded using the [Job](data.md#job) object as the context.  In addition, the [Job.input](data.md#job-input) sub-object is "flattened" into the outer context for convenience (just so you can skip the `input` prefix in the macros).  This allows you to access all the output data from the previous job in the current job, and copy it into Plugin parameters.

The mustache macros can do more than just data lookups.  They can also evaluate simple JavaScript-style expressions as well.  For more on this, see [xyOps Expression Syntax](xyexp.md).

## Built-in Plugins

The following Event Plugins are built into xyOps and come preinstalled.

### Shell Plugin

xyOps ships with a built-in "Shell Plugin", which you can use to execute arbitrary shell scripts.  Simply select the Shell Plugin when creating an event or workflow, and enter your script.  This is an easy way to get up and running quickly, because you don't have to worry about reading or writing JSON.

The Shell Plugin determines success or failure based on the [exit code](https://en.wikipedia.org/wiki/Exit_status) of your script.  This defaults to `0` representing success.  Meaning, if you want to trigger an error, exit with a non-zero status code, and make sure you print your error message to STDOUT or STDERR (both will be appended to your job's output capture).  Example:

```sh
#!/bin/bash

# Perform tasks or die trying...
/usr/local/bin/my-task-1.bin || exit 1
/usr/local/bin/my-task-2.bin || exit 1
/usr/local/bin/my-task-3.bin || exit 1
```

You can still report intermediate progress with the Shell Plugin.  It can accept JSON in the [standard output format](#progress) if enabled, but there is also a shorthand.  You can echo a single number on its own line, from 0 to 100, with a `%` suffix, and that will be interpreted as the current progress.  Example:

```sh
#!/bin/bash

# Perform some long-running task...
/usr/local/bin/my-task-1.bin || exit 1
echo "25%"

# And another...
/usr/local/bin/my-task-2.bin || exit 1
echo "50%"

# And another...
/usr/local/bin/my-task-3.bin || exit 1
echo "75%"

# And the final task...
/usr/local/bin/my-task-4.bin || exit 1
```

This would allow xyOps to show a graphical progress bar in the UI, and estimate the time remaining based on the elapsed time and current progress.

> [!TIP]
> The Shell Plugin actually supports any interpreted scripting language, including Node.js, PHP, Perl, Python, and more.  Basically, any language that supports a [Shebang](https://en.wikipedia.org/wiki/Shebang_%28Unix%29) line will work in the Shell Plugin.  Just change the `#!/bin/sh` to point to your interpreter of choice.

### HTTP Request Plugin

xyOps ships with a built-in "HTTP Request" Plugin, which you can use to send simple GET, HEAD or POST requests to any URL, and log the response.  You can specify custom HTTP request headers, and also supply regular expressions to match a successful response based on the content.

Here are the parameters it accepts:

| Plugin Parameter | Description |
|------------------|-------------|
| **Method** | Select the HTTP request method, either GET, HEAD or POST. |
| **URL** | Enter your fully-qualified URL here, which must begin with either `http://` or `https://`. |
| **Headers** | Optionally include any custom request headers here, one per line. |
| **POST Data** | If you are sending a HTTP POST, enter the raw POST data here. |
| **Timeout** | Enter the timeout in seconds, which is measured as the time to first byte in the response. |
| **Follow Redirects** | Check this box to automatically follow HTTP redirect responses (up to 32 of them). |
| **SSL Cert Bypass** | Check this box if you need to make HTTPS requests to servers with invalid SSL certificates (self-signed or other). |
| **Success Match** | Optionally enter a regular expression here, which is matched against the response body.  If specified, this must match to consider the job a success. |
| **Error Match** | Optionally enter a regular expression here, which is matched against the response body.  If this matches the response body, then the job is aborted with an error. |

#### Request Chaining

The HTTP Request Plugin supports passing data between jobs.  First, information about the HTTP response is passed into the job output data, so connected events can read and act on it.  Specifically, the HTTP response code, all the HTTP response headers, and possibly even the content body itself (if formatted as JSON and smaller than 1 MB) are included.  Example:

```js
"data": {
	"statusCode": 200,
	"statusMessage": "OK",
	"headers": {
		"date": "Sat, 14 Jul 2018 20:14:01 GMT",
		"server": "Apache/2.4.28 (Unix) LibreSSL/2.2.7 PHP/5.6.30",
		"last-modified": "Sat, 14 Jul 2018 20:13:54 GMT",
		"etag": "\"2b-570fb3c47e480\"",
		"accept-ranges": "bytes",
		"content-length": "43",
		"connection": "close",
		"content-type": "application/json",
		"x-uuid": "7617a494-823f-4566-8f8b-f479c2a6e707"
	},
	"json": {
		"key1": "value1",
		"key2": 12345
	}
}
```

In this example an HTTP request was made that returned those specific response headers (the header names are converted to lower-case), and the body was also formatted as JSON, so the JSON data itself is parsed and included in a property named `json`.  Downstream events that are linked to the HTTP Request job (either by workflow node or run event action) can read these properties and act on them.

Secondly, you can chain an HTTP Request into *another* HTTP Request, and use the chained data values from the previous response in the next request.  To do this, you need to utilize a special `{{ mustache }}` template syntax in the second request, to lookup values in the `data` object from the first one.  You can use these placeholders in the **URL**, **Request Headers** and **POST Data** text fields.  Example:

- **URL**: `http://myserver.com/test.json?key={{ data.json.key1 }}`
- **Headers**: `X-UUID: {{ data.headers['x-uuid'] }}`

Here you can see we are using two placeholders, one in the URL and another in the HTTP request headers.  These are looking up values from a *previous* HTTP Request event, and passing them into the next request.  Specifically, we are using:

| Placeholder | Description |
|-------------|-------------|
| `{{ data.json.key1 }}` | This placeholder is looking up the `key` value from the JSON data (body content) of the previous HTTP response.  Using our example response shown above, this would resolve to `value1`. |
| `{{ data.headers['x-uuid'] }}` | This placeholder is looking up the `X-UUID` response header from the previous HTTP response.  Using our example response shown above, this would resolve to `7617a494-823f-4566-8f8b-f479c2a6e707`. |

So once the second request is sent off, after placeholder expansion the URL would actually resolve to:

```
http://myserver.com/test.json?key=value1
```

And the header would expand to:

```
X-UUID: 7617a494-823f-4566-8f8b-f479c2a6e707
```

You can chain as many requests together as you like, but note that each request can only see and act on chain data from the *previous* request (the one that directly chained to it).

#### Using Secrets in Requests

To use secrets in the HTTP Request Plugin, you need to specify them using a custom macro syntax: `[secrets.KEY_NAME]`.  This square-bracket format works in the URL, the request headers, and the request body.

Note that the secrets will be printed on the job output screen.

### Test Plugin

The Test Plugin exists mainly to test xyOps, but it can also be useful for testing pieces of workflows.  It outputs sample data and optionally a sample file, which are passed to downstream events, if connected.  It can also simulate various job outcomes (success, fail, etc.).  It offers the following parameters:

| Plugin Parameter | Type | Description |
|------------------|------|-------------|
| **Test Duration** | Number | The number of seconds to run before reporting completion.  Progress is always reported. |
| **Simulate Result** | Menu | Select which result to simulate (Success, Error, Warning, Critical, Crash). |
| **Burn Memory/CPU** | Checkbox | If checked the Plugin will use some memory and CPU (it will allocate 128-256MB of memory and use about 10% of a CPU core doing math in a loop). |
| **Generate Network Traffic** | Checkbox | If checked the Plugin will make continuous network requests downloading large binary data blobs (from GitHub). |
| **Upload Sample File** | Checkbox | If checked the Plugin will produce a sample file and attach it to the job output. |

### Docker Plugin

The Docker Plugin allows you to run custom scripts inside a Docker container.  Similar to the [Shell Plugin](#shell-plugin), you can specify any custom code to run, and in any language, as long as it supports a [Shebang](https://en.wikipedia.org/wiki/Shebang_%28Unix%29) line.

You can enter any Docker image to use, including remote ones.  By default, our own [xyOps Shell Image](https://github.com/pixlcore/xyops-shell-image) is selected, which is based in Debian 12, and comes preinstalled with a variety of popular software, as well as our [xyRun](https://github.com/pixlcore/xyrun) wrapper.  xyRun will track system resources *inside* the container, as well as handle file upload/download for your jobs.  This is optional, and you can use any Docker image you want, including your own custom ones.

This is built on top of [docker run](https://docs.docker.com/reference/cli/docker/container/run/), so each job creates a new container, and can optionally delete it when the job is complete (which is the default behavior).

The Docker Plugin uses the following parameters:

| Plugin Parameter | Type | Description |
|------------------|------|-------------|
| **Image Name** | Text | The name of the Docker image to use, which can be local or remote. |
| **Image Version** | Text | The version of the image to use, or `latest`. |
| **Container Name** | Text | The name of the Docker container, which can use macros such as `{{id}}` to make it unique per job. |
| **Max CPUs** | Number | The max number of CPU cores the container is allowed to use, or 0 for unlimited. |
| **Max Memory** | Text | The max amount of memory to allow the container to use (default is unlimited). |
| **Join Network** | Text | Optionally specify a Docker network name for the container to join. |
| **Command Extras** | Text | Optionally add any extra command-line arguments to pass to `docker run` (for e.g. volume mounts). |
| **Launch Command** | Text | The initial command to run as the container starts.  It is recommended to use [xyRun](https://github.com/pixlcore/xyrun) for this, so resources are monitored, and files are managed properly. |
| **Run Mode** | Menu | Choose whether you want the entire job JSON data to be sent to STDIN, or only the script source (advanced). |
| **Script Source** | Text | The code to run inside the container.  You can use any language that supports a shebang line. |
| **Init Process Manager** | Checkbox | Run an "init" inside the container that forwards signals and reaps processes. |
| **Ephemeral Container** | Checkbox | Automatically delete the container after the job completes (recommended). |
| **Verbose Logging** | Checkbox | Enable verbose debug logging (raw docker command, etc.) |

#### Custom Images

Feel free to create your own custom Docker image for use in the Docker Plugin.  You can either build one on top of ours, or build your own from scratch.  Either way, we highly recommend you install [xyRun](https://github.com/pixlcore/xyrun) inside your image as a command wrapper, so xyOps can track system resource usage, and manage files for your jobs.

If you use an image without xyRun, please note the following caveats:

- Environment variables will not be set (i.e. `JOB_ID`, `JOB_NOW`, etc.).
- Secrets will not be passed into the container.

To use a pre-existing Docker image such as `ubuntu`, you can set the launch command to something like `sh`, and then set the "Run Mode" to "Script Source".  This will pipe in your script source directly to the STDIN of the launch process, e.g. `sh`, which will execute it inside the container.

## Plugin Marketplace

xyOps has an integrated Plugin Marketplace, so you can expand the app's feature set by leveraging Plugins published both by PixlCore (the makers of xyOps), as well as the developer community.  For more on this, please see the [Marketplace Guide](marketplace.md).

