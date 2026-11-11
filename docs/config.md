# Configuration

## Overview

xyOps is configured primarily by a single JSON file located here: `/opt/xyops/conf/config.json` (the location may vary for custom installs).

However, if the configuration is modified using the UI, overrides are saved in a separate file: `/opt/xyops/conf/overrides.json`

This document describes all the editable properties in the `config.json` file.

<!-- Group: Global Settings -->

## base_app_url
<!-- Title: Base App URL -->

This string is the base URL of your xyOps instance (default: `http://localhost:5522`), and is used to build fully-qualified links in emails, alerts, tickets, and web hooks (e.g., job/ticket URLs and the logo URL in emails).

## secret_key

This string is a shared secret used to sign tokens (e.g., download links), authenticate multi-conductor messages, and encrypt/decrypt stored secrets -- set this to a long random value in production.

## temp_dir
<!-- Title: Temp Dir Path -->

This string is the scratch directory for temporary files such as plugin bundles and staging uploads (default: `temp`).

If this is a relative path, it is computed from the xyOps base directory, which is typically `/opt/xyops`.

## pid_file
<!-- Title: PID File Path -->

This string sets the path to the main process PID file for start/stop tooling (default: `logs/xyops.pid`).

If this is a relative path, it is computed from the xyOps base directory, which is typically `/opt/xyops`.

## debug_level
<!-- Title: Debug Log Level -->

This number sets the verbosity level for the logger (default: `5`; 1 = quiet, 10 = very verbose).

## tick_precision_ms
<!-- Title: Tick Precision (ms) -->

This number sets the internal timer precision in milliseconds used by the server framework for scheduling ticks (default: `50`).

This controls how precise xyOps is when executing actions targeted on a specific second.  Lower values mean xyOps is more precise, but will result in heavier idle CPU usage.

## maintenance
<!-- Title: Maintenance Schedule (HH:MM) -->

This string (in `HH:MM` format, server local time) schedules daily maintenance tasks such as DB trimming and log archival (default: `04:00`).

## ttl
<!-- Title: API Time-to-Live (seconds) -->

This number (seconds) is the default HTTP cache TTL applied to selected API responses and static resources where applicable (default: `300`).

## file_expiration
<!-- Title: File Expiration -->

This duration string sets the default expiration for uploaded files (e.g., ticket attachments), used to compute per-file expiration timestamps (default: `5 years`).

## timeline_expiration
<!-- Title: Timeline Expiration -->

This duration string sets the retention for monitor timelines; older points are pruned during maintenance (default: `10 years`).

## ping_freq_sec
<!-- Title: WebSocket Ping Frequency (seconds) -->

This number (seconds) controls the interval for sending WebSocket pings to clients/workers (default: `5`).

## ping_timeout_sec
<!-- Title: WebSocket Timeout (seconds) -->

This number (seconds) is the max allowed time without a pong before a socket is considered timed out (default: `30`).

## max_jobs_per_min
<!-- Title: Max Jobs Per Minute -->

This number sets a global rate limit on job starts per minute (default: `100`); additional jobs are prevented from launching.

This is designed as a runaway e-brake mechanism, to prevent an erroneous workflow configuration from bringing down the entire system.

## max_jobs_per_workflow
<!-- Title: Max Jobs Per Workflow -->

This number sets a global limit on the number of sub-jobs allowed per workflow run (default: `1000`).  Additional jobs are prevented from launching, and the workflow is aborted.

## scheduler_stagger_ms
<!-- Title: Scheduler Launch Stagger (milliseconds) -->

This number sets the delay between parallel scheduled job launches, in milliseconds (default: `50`).  It insures a large amount of job launches at the same instant won't stall the system.

## dead_job_timeout
<!-- Title: Dead Job TImeout (seconds) -->

This number (in seconds) determines when a running job with no updates is considered dead and aborted (default: `120`).

## stale_alert_timeout
<!-- Title: Stale Alert Timeout (seconds) -->

This number (in seconds) determines when stale alerts are cleared.  Stale alerts occur when a server disconnects with active alerts attached.

## server_cache_max_time
<!-- Title: Server Cache Max Time -->

This is the maximum amount of time servers are kept in the offline memory cache (default: `24 hours`).

Note that all offline servers are available on the "Server History" page (subject to database retention settings).  The offline cache just keeps them in memory for a short period after they go offline.

## server_cache_max_count
<!-- Title: Server Cache Max Count -->

This is the maximum number of server entries allowed in the offline cache, before older ones are removed (default: `100`).

Note that all offline servers are available on the "Server History" page (subject to database retention settings).  The offline cache just keeps the most recent ones in memory for a short period.

## default_plugin_credentials
<!-- Title: Default Plugin Credentials -->

This object allows you to set default UID and/or GID values for each type of Plugin.  The UID/GID may be either numerical IDs or username strings (`root`, `admin`, etc.).  Linux/macOS only.

## job_env
<!-- Title: Job Environment Variables -->

This object contains environment variables merged into every job process.

Values can be overridden per job.

## job_custom_overrides
<!-- Title: Job Custom Overrides -->

This array allows you to define custom job expression rules, which can apply custom updates to the job as it completes.

Example:

```json
"job_custom_overrides": [
	{
		"expression": "(code == 'abort') && match(description, 'No available servers')",
		"updates": {
			"code": "warning",
			"push": { "tags": ["flag"] }
		}
	}
]
```

Rules are evaluated in order against the completed job.  All matching rules are applied.  See [Custom Job Overrides](recipes.md#custom-job-overrides) for timing details, protected properties, and practical examples.

## job_universal_limits
<!-- Title: Job Universal Limits -->

This object defines global limit rules automatically applied to all jobs/workflows, such as concurrency, queue, or retry caps.

## job_universal_actions
<!-- Title: Job Universal Actions -->

This object defines global actions executed when conditions are met (default includes a system snapshot on error).  Actions can be assigned by job type (workflow or event).  

Example:

```json
"job_universal_actions": {
	"default": [
		{
			"enabled": true,
			"hidden": false,
			"condition": "error",
			"type": "snapshot"
		}
	],
	"workflow": []
}
```

## alert_universal_actions
<!-- Title: Alert Universal Actions -->

This array lists actions automatically applied to all alerts for standardized behavior (default includes a hidden snapshot on new alert).

Example:

```json
"alert_universal_actions": [
	{
		"enabled": true,
		"hidden": true,
		"condition": "alert_new",
		"type": "snapshot"
	}
]
```

## hostname_display_strip
<!-- Title: Server Hostname Display Strip -->

This regex string is removed from the end of hostnames for display and notifications (default: `\\.[\\w\\-]+\\.\\w+$`), e.g., to strip the domain suffix.

## ip_display_strip
<!-- Title: IP Address Display Strip -->

This regex string is removed from IP addresses for display (default: `^::ffff:`), e.g., to strip the IPv6 IPv4-mapped prefix.

## search_file_threads
<!-- Title: Search File Threads -->

This number sets how many worker threads are used when searching files on disk (default: `1`).

## search_file_regex
<!-- Title: Search File Regex -->

This regex string limits which filenames are scanned by the file search APIs (default: `\\.(txt|log|csv|tsv|xml|json)(\\.gz)?$`).

## quick_monitors
<!-- Title: Quick Monitors -->

This array defines built-in metrics to collect (defaults include CPU, memory, disk, and network presets).  These are displayed on server detail pages for real-time monitoring.

## extensions
<!-- Title: Extension Configuration -->

Use this object to configure any installed system extensions.  Each installed extension can have its own sub-object, keyed by it's Extension ID.

Example:

```json
{
	"pixlcore-xyext-test": {
		"foo": "bar"
	}
}
```

<!-- Group: Email Settings -->

## email_from
<!-- Title: Email From -->

This string is the sender email address for all outbound messages (default: `admin@localhost`); many SMTP servers require this to be a valid address.

## mail_settings
<!-- Title: Mailer Settings -->

This object configures the email transport and is passed verbatim to [Nodemailer](https://nodemailer.com/). 

The default configuration is:

```json
{
	"host": "localhost",
	"port": 25,
	"auth": { "user": "", "pass": "" }
}
```

See [Nodemailer - SMTP](https://nodemailer.com/smtp/) and [Nodemailer - Sendmail](https://nodemailer.com/transports/sendmail/) for full options.

Example (basic SMTP on localhost):

```json
"mail_settings": {
	"host": "localhost",
	"port": 25
}
```

Example (local sendmail):

```json
"mail_settings": {
	"sendmail": true,
	"newline": "unix",
	"path": "/usr/sbin/sendmail"
}
```

Example (Fastmail):

```json
"mail_settings": {
	"host": "smtp.fastmail.com",
	"port": 465,
	"auth": { "user": "youremail@fastmail.com", "pass": "YOUR_PASSWORD" },
	"secure": true
}
```

## email_format
<!-- Title: Email Format -->
<!-- Type: Menu -->
<!-- Items: ["html", "text"] -->

This string controls the email body format (default: `html`).  Use `html` for styled emails or `text` for plain text.

## email_logo
<!-- Title: Email Logo -->
<!-- Type: Menu -->
<!-- Items: ["link", "inline", "none"] -->

This controls the email logo image (default: `inline`).  Use `inline` to include the logo as an inline attachment, `link` to link to the logo image URL directly, or `none` to hide the logo image entirely.

When this is set to `inline`, [client.logo_url](#client-logo_url) must be a local web root path under the xyOps `htdocs` directory, because xyOps loads the image from disk before attaching it to outgoing emails.  When this is set to `link`, `client.logo_url` may be a normal linked image URL instead.

## max_emails_per_day
<!-- Title: Maximum Emails Per Day -->

This number caps total emails sent per day across the app (default: 0, meaning no limit); excess sends are rejected with an error.

<!-- Group: Logging Settings -->

## log_dir
<!-- Title: Log Directory Path -->

This string sets the base directory for server logs and job logs (default: `logs`), e.g., `logs/Error.log` and `logs/jobs/ID.log`.

If this is a relative path, it is computed from the xyOps base directory, which is typically `/opt/xyops`.

## log_filename
<!-- Title: Log Filename Template -->

This string is the filename pattern used by the core logger (default: `[component].log`); supports log column placeholders like `[component]`.

## log_columns
<!-- Title: Log Column List -->

This array of strings controls which log columns are written and their order. 

Default:

```json
["hires_epoch", "date", "hostname", "pid", "component", "category", "code", "msg", "data"]
```

See [pixl-logger](https://github.com/jhuckaby/pixl-logger) for more details.

## log_archive_path
<!-- Title: Log Archive Path -->
<!-- AllowEmpty: true -->

This string sets the nightly log archive path pattern (default: `logs/archives/[yyyy]/[mm]/[dd]/[filename]-[yyyy]-[mm]-[dd].log.gz`); maintenance gzips and writes logs here.

Accepts [date/time placeholders](https://github.com/jhuckaby/pixl-tools#getdateargs) to dynamically generate the log archive filenames.

To disable filesystem log archiving, leave this field blank in the UI, or set `"log_archive_path": ""` in the JSON configuration.  Do not type quote characters into the UI field.  See [log_archive_storage](#log_archive_storage) to archive logs to storage instead.

## log_archive_keep
<!-- Title: Log Archive Keep -->
<!-- AllowEmpty: true -->

This string specifies how long to keep log archives for, e.g. `30 days`.

Older log archives found in [log_archive_path](#log_archive_path) are automatically deleted after the nightly logs are rotated.

To keep log archives indefinitely, leave this field blank in the UI, or set `"log_archive_keep": ""` in the JSON configuration.  Do not type quote characters into the UI field.  This disables automatic deletion of old archives; log rotation and archiving continue as usual.

## log_archive_storage
<!-- Title: Log Archive Storage -->

Optionally archive logs to storage instead of local disk.  This is primarily designed for 3rd party storage engines like S3.  To use this feature, first *disable* [log_archive_path](#log_archive_path) by setting it to an empty string as described above, and then set this property accordingly.

Example:

```json
"log_archive_storage": {
	"enabled": true,
	"key_template": "logs/archives/[yyyy]/[mm]/[dd]/[filename]-[yyyy]-[mm]-[dd].log.gz",
	"expiration": "1 year"
}
```

## log_crashes
<!-- Title: Log Crashes -->

This boolean enables capturing uncaught exceptions and crashes in the logger subsystem (default: `true`).

The crash log location will be: `/opt/xyops/logs/crash.log`



## tickets
<!-- Title: Ticket Settings -->
<!-- Type: Group -->

This section configures the ticketing subsystem.


### tickets.email_enabled
<!-- Title: Email Enabled -->

This boolean enables ticket-related outgoing emails such as new/overdue notifications (default: `true`).

### tickets.email_debounce_sec
<!-- Title: Email Debounce (Seconds) -->

This number (seconds) sets the minimum spacing between repeated ticket update emails to reduce noise (default: `30`).

For example, if a user makes a series of sequential changes to a ticket, only one email will be sent in a 30-second window, containing a summary of all the accumulated changes.

### tickets.overdue_schedule
<!-- Title: Overdue Schedule (HH:MM) -->

This string (`HH:MM`) sets the daily time when the system scans for overdue tickets and sends notices (default: `04:30`).

### tickets.overdue_query
<!-- Title: Overdue Query -->

This string is the [Unbase-style search query](https://github.com/jhuckaby/pixl-server-storage/blob/master/docs/Indexer.md#simple-queries) used to select overdue tickets during the scheduled scan (default: `status:open due:<today`).

### tickets.due_date_format
<!-- Title: Due Date Format -->

This date format string controls how ticket due dates are displayed (default: `[dddd], [mmmm] [mday], [yyyy]`).

### tickets.date_time_format
<!-- Title: Date/Time Format -->

This date/time format string controls how ticket timestamps are displayed (default: `[dddd], [mmmm] [mday], [yyyy] [hour12]:[mi] [ampm]`).


<!-- Group: Hook Settings -->

## hooks
<!-- Title: System Hooks -->

This object defines system-wide hook triggers that can fire on any logged activity.  

Example:

```json
{ "job_complete": { "web_hook": "wmhv3s16ymk" } }
```

See [System Hooks](syshooks.md) for more details.

## hook_text_templates
<!-- Title: Hook Text Templates -->

This object provides message templates for jobs and alerts; Mustache-style placeholders populate human-readable text for emails and web hooks (default includes templates like `{{links.job_details}}`).  

Example set:

```json
{
  "job_start": "Job started on {{nice_server}}: {{event.title}}: {{links.job_details}}",
  "job_success": "Job completed successfully on {{nice_server}}: {{event.title}}: {{links.job_details}}",
  "job_error": "Job failed on {{nice_server}}: {{event.title}}: Error ({{job.code}}): {{job.description}}: {{links.job_details}}",
  "job_progress": "Job is in progress on {{nice_server}} ({{event.title}}): {{links.job_details}}",
  "job_suspended": "Job is suspended and requires human intervention: {{event.title}}: {{links.job_details}}&resume=1",
  "job_limited": "{{action.msg}}: {{links.job_details}}",
  "alert_new": "Alert: {{nice_server}}: {{def.title}}: {{alert.message}}: {{links.alert_url}}",
  "alert_cleared": "Alert Cleared: {{nice_server}}: {{def.title}}"
}
```

See [JobHookData](data.md#jobhookdata) and [AlertHookData](data.md#alerthookdata) for a list of the placeholder macros you can use here.



## multi
<!-- Title: Multi-Conductor Settings -->
<!-- Type: Group -->

This section configures the multi-server subsystem.

### multi.enable_version_checks
<!-- Title: Enable Version Checks -->

When set to `true`, xyOps will check for version updates of the core app, which will make external web requests to the Release Metadata URL.

### multi.list_url
<!-- Title: Release Metadata URL -->

This URL string points to the release metadata used by multi-conductor upgrade flows (default: `https://api.github.com/repos/pixlcore/xyops/releases`).

### multi.protocol
<!-- Title: WebSocket Protocol -->
<!-- Type: Menu -->
<!-- Items: ["ws:", "wss:"] -->

This string selects the WebSocket protocol for peer communications (default: `ws:`); set to `wss:` to require TLS.

### multi.connect_timeout_sec
<!-- Title: Connect Timeout (seconds) -->

This number (seconds) sets the connection timeout for initial peer socket connections (default: `3`).

### multi.master_timeout_sec
<!-- Title: Master Timeout (seconds) -->

This number (seconds) is used for the election timer and general control timeouts for conductor operations (default: `10`).

### multi.socket_opts
<!-- Title: WebSocket Options -->

This object holds options merged into the WebSocket client, e.g., TLS options for self-signed certs. 

Default:

```json
{ "rejectUnauthorized": false }
```

### multi.preferred_conductors
<!-- Title: Preferred Conductors -->

This optional array lists your preferred conductor servers (by their exact hostnames), in order from highest to lowest priority.  If a preferred conductor is online and outranks the current primary (or the current primary is not preferred), and it satisfies the minimum age requirement, the current primary will relinquish command.

### multi.relinquish_min_age
<!-- Title: Relinquish Minimum Age (seconds) -->

The minimum "age" of a peer conductor (time since last connect in seconds) that must be met before the current primary conductor will consider relinquishing command to it.  This field is only applicable if you specify a list of preferred conductors.

### multi.relinquish_wait_jobs
<!-- Title: Relinquish Wait For Jobs -->

When checked, the peer relinquish operation will wait for all active jobs to complete, before the current primary conductor relinquishes command to a higher-ranked preferred one.  This field is only applicable if you specify a list of preferred conductors.

## satellite
<!-- Title: xyOps Satellite Settings -->
<!-- Type: Group -->

This section configures xySat, our remote satellite agent.

### satellite.enable_version_checks
<!-- Title: Enable Version Checks -->

When set to `true`, xyOps will check for version updates of the xySat app, which will make external web requests to the Release Metadata URL.

### satellite.list_url
<!-- Title: Release Metadata URL -->

This URL string points to the release metadata for the satellite agent (default: `https://api.github.com/repos/pixlcore/xysat/releases`).

### satellite.base_url
<!-- Title: Release Base URL -->

This URL string is the base for satellite downloads/upgrades (default: `https://github.com/pixlcore/xysat/releases`).

### satellite.image
<!-- Title: xySat Docker Image -->

This is the Docker image to use when adding Docker-based satellite servers via the UI (default: `ghcr.io/pixlcore/xysat`).

### satellite.version
<!-- Title: xySat Version -->

This string sets the desired satellite version to fetch; may be a semver or tag (default: `latest`).

### satellite.cache_ttl
<!-- Title: Cache Time-to-Live (seconds) -->

This number (seconds) sets the cache TTL for satellite release metadata and tarballs to reduce network calls (default: `3600`).

### satellite.config
<!-- Title: xySat Configuration -->

This object contains web server and runtime settings for xySat; these options are passed along when managing or provisioning satellite nodes.

Here is the full default configuration:

```json
{ 
	"port": 5522,
	"secure": false,
	"socket_opts": { "rejectUnauthorized": false },
	"pid_file": "pid.txt",
	"log_dir": "logs",
	"log_filename": "[component].log",
	"log_crashes": true,
	"log_archive_path": "logs/archives/[filename]-[yyyy]-[mm]-[dd].log.gz",
	"log_archive_keep": "7 days",
	"temp_dir": "temp",
	"debug_level": 5,
	"child_kill_timeout": 10,
	"job_data_env": true,
	"monitoring_enabled": true,
	"quickmon_enabled": true,
	"graphics_enabled": false,
	"docker_enabled": true,
	"upgrade_timeout_sec": 60,
	"graceful": false
}
```

Here are descriptions of the configuration properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `port` | Number | Specifies which port the xyOps conductor server will be listening on (default is `5522` for ws:// and `5523` for wss://). |
| `secure` | Boolean | Set to `true` to use secure WebSocket (wss://) and HTTPS connections. |
| `socket_opts` | Object | Options to pass to the WebSocket connection (see [WebSocket](https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocket)). |
| `pid_file` | String | Location of the PID file to ensure two satellites don't run simultaneously. |
| `log_dir` | String | Location of the log directory, relative to the xySat base dir (`/opt/xyops/satellite`). |
| `log_filename` | String | This string is the filename pattern used by the core logger (default: `[component].log`); supports log column placeholders like `[component]`. |
| `log_crashes` | Boolean | This boolean enables capturing uncaught exceptions and crashes in the logger subsystem (default: `true`). |
| `log_archive_path` | String | This string sets the nightly log archive path pattern (default: `logs/archives/[filename]-[yyyy]-[mm]-[dd].log.gz`). |
| `log_archive_keep` | String | How many days to keep log archives before auto-deleting the oldest ones. |
| `temp_dir` | String | Location of temp directory, relative to the base dir (`/opt/xyops/satellite`). |
| `debug_level` | Number | This number sets the verbosity level for the logger (default: `5`; 1 = quiet, 10 = very verbose). |
| `child_kill_timeout` | Number | Number of seconds to wait after sending a SIGTERM to follow-up with a SIGKILL. |
| `job_data_env` | Boolean | Include environment variables for job params, workflow params, job input data, workflow input data, and server data.  The default is `true`. |
| `monitoring_enabled` | Boolean | Enable or disable the monitoring subsystem (i.e. send monitoring metrics every minute). |
| `quickmon_enabled` | Boolean | Enable or disable the "quick" monitors, which send lightweight metrics every second. |
| `graphics_enabled` | Boolean | Enable or disable graphics card (GPU) monitoring features (default: `false`).  Currently experimental. |
| `docker_enabled` | Boolean | Enable or disable Docker container monitoring features (default: `true`). |
| `upgrade_timeout_sec` | Number | The number of seconds to allow for upgrades to complete, before reporting an error (default: `60`). |
| `graceful` | Boolean | Set to `true` to have xySat gracefully stop on shutdown (i.e. wait for all jobs to complete).  The default is `false`. |


## marketplace
<!-- Title: xyOps Marketplace -->
<!-- Type: Group -->

This section configures the xyOps Marketplace.

### marketplace.enabled
<!-- Title: Marketplace Enabled -->

This boolean enables or disables the marketplace.  If disabled, users cannot search for or install plugins.  The default is `true` (enabled).

### marketplace.metadata_url
<!-- Title: Metadata URL -->

This string points to the central marketplace metadata location, which contains the full product catalog.  

Example:

```
https://raw.githubusercontent.com/pixlcore/xyops-marketplace/refs/heads/main/marketplace.json
```

### marketplace.repo_url_template
<!-- Title: Plugin Repository URL Template -->

This string is a template used to generate plugin repository URLs to specific files.  It has placeholder macros for `id` (org and repo), `version` (git tag), and `filename`.  

Example:

```
https://raw.githubusercontent.com/[id]/refs/tags/[version]/[filename]
```

### marketplace.ttl
<!-- Title: Time-to-Live (seconds) -->

This is the number of seconds to cache the marketplace metadata locally before re-fetching from origin.  The default is `3600` (one hour).



<!-- Group: Default User Settings -->

## default_user_privileges
<!-- Title: Default User Privileges -->

This object sets default privileges for new users (defaults include create/edit events, run/tag/comment jobs, and ticket permissions) unless overridden by roles or SSO.

See [Privileges](privileges.md) for more details on privileges.

## default_user_prefs
<!-- Title: Default User Preferences -->

This object sets default UI preferences for new users (locale, theme, motion/contrast, volume, saved searches, etc.), merged into profiles at creation/login.

See [User](data.md#user) for details on what properties can be specified here.



<!-- Group: Database -->

## db_maint
<!-- Title: DB Maintenance -->

This object controls the nightly database maintenance settings, which trims tables to a maximum row count by deleting the oldest rows.

Example:

```json
"db_maint": {
	"jobs": {
		"max_rows": 100000
	},
	"alerts": {
		"max_rows": 100000
	},
	"snapshots": {
		"max_rows": 100000
	},
	"activity": {
		"max_rows": 100000
	},
	"servers": {
		"max_rows": 10000
	}
}
```



## airgap
<!-- Title: Air-Gap Settings -->
<!-- Type: Group -->

This section is for airgap mode, which can prevent xyOps from making unauthorized outbound connections beyond a specified IP range.

See [Air-Gapped Mode](hosting.md#air-gapped-mode) for more details.

### airgap.enabled
<!-- Title: Air-Gap Enabled -->

This boolean enables outbound network egress controls for server-initiated HTTP(S) requests (default: `false`).

### airgap.whitelist
<!-- Title: Outbound Whitelist -->

This array of CIDRs/hosts defines destinations explicitly allowed for outbound requests (default includes local/private networks); when enabled, only these are permitted.

### airgap.blacklist
<!-- Title: Outbound Blacklist -->

This array of CIDRs/hosts defines destinations that are always blocked for outbound requests.



## client
<!-- Title: Client UI Settings -->
<!-- Type: Group -->

This section is for the client-side configuration, used in the xyOps web application.

### client.name
<!-- Title: App Name Display -->

This string is the product name displayed in the UI and included in email/version text (default: `xyOps`).

### client.company
<!-- Title: App Company Display -->

This string is displayed as part of the copyright message at the bottom-left corner of the UI (default: `PixlCore LLC`).

### client.logo_url
<!-- Title: App Logo Image URL -->

This points to the logo used in the UI header/sidebar and in emails (default: `/images/logotype.png`).

For the default [email_logo](#email_logo) mode of `inline`, this must be a local web root path under the xyOps `htdocs` directory, because xyOps loads the image from disk before attaching it to outgoing emails.  If `email_logo` is set to `link`, this may be a normal image URL instead.

### client.hide_sidebar_sections
<!-- Title: Hide Sidebar Sections -->

This array allows you to globally hide specific sidebar sections for all users, regardless of their preferences.

### client.tables
<!-- Title: Default Table Sort -->

This object allows you to set default sort preferences for all the sortable tables in the UI.

### client.items_per_page
<!-- Title: List Items Per Page -->

This number sets the default page size for list views and searches (default: `50`).

### client.alt_items_per_page
<!-- Title: Alternate Items Per Page -->

This number sets the secondary page size for inline widgets and dropdown lists (default: `25`).

### client.max_table_rows
<!-- Title: Max Table Rows -->

This number caps the number of rendered table rows client-side to keep the UI responsive (default: `500`).

### client.max_menu_items
<!-- Title: Max Menu Items -->

Upper bound for items shown in menus and dropdowns (default: `1000`).

### client.api_timeout_ms
<!-- Title: API Timeout (milliseconds) -->

This number sets the API timeout for client requests in milliseconds (default: `10000`).

### client.max_job_output
<!-- Title: Max Job Output Display -->

Maximum size of job output to display inline on the details page (default: `5 MB`).

### client.alt_to_toggle
<!-- Title: Hold Alt to Toggle -->

Requires the user to hold the Opt/Alt key to toggle the `enabled` property of certain entities in the UI (prevents accidental clicks).

### client.outdated_badges
<!-- Title: Show Outdated Version Badges -->

When set to `true`, will show a colored badge on sidebar sections for outdated software versions on the Conductors, Servers and Marketplace tabs.  Admin only.

### client.new_event_template
<!-- Title: New Event Template -->

Provides sensible defaults for new events and workflows, such as triggers, limits, and actions.  These values prefill the creation form and do not change existing events or workflows.

### client.new_ticket_template
<!-- Title: New Ticket Template -->

Provides defaults for creating new tickets. Used to prefill the New Ticket form.

### client.chart_defaults
<!-- Title: Graph Defaults -->

Default chart rendering options (line width, smoothing, ticks). Applied to [pixl-chart](https://github.com/jhuckaby/pixl-chart) monitor charts in the UI.  

The defaults are:

```json
"chart_defaults": {
	"lineWidth": 2,
	"lineJoin": "round",
	"lineCap": "butt",
	"stroke": true,
	"fill": 0.5,
	"horizTicks": 6,
	"vertTicks": 6,
	"smoothingMaxSamples": 100,
	"smoothingMaxTotalSamples": 1000,
	"hoverSort": -1
}
```

See [pixl-chart](https://github.com/jhuckaby/pixl-chart) for more details.

### client.editor_defaults
<!-- Title: Code Editor Defaults -->

Default code editor preferences (tabs, indent, line wrapping) for [CodeMirror](https://codemirror.net/5/) fields in the UI.

The defaults are:

```json
"editor_defaults": {
	"lineNumbers": false,
	"matchBrackets": false,
	"indentWithTabs": true,
	"tabSize": 4,
	"indentUnit": 4,
	"lineWrapping": true,
	"dragDrop": false
}
```

See [CodeMirror](https://codemirror.net/5/) for more details.

### client.bucket_upload_settings
<!-- Title: Bucket Upload Settings -->

Client-side limits for bucket uploads (max files/size/types). Enforced in the UI before upload, and enforced server-side.

The defaults are:

```json
"bucket_upload_settings": {
	"max_files_per_bucket": 100,
	"max_file_size": 1073741824,
	"accepted_file_types": ""
}
```

### client.ticket_upload_settings
<!-- Title: Ticket Upload Settings -->

Client-side limits for ticket attachments (max files/size/types). Enforced in the UI before upload, and enforced server-side.

The defaults are:

```json
"ticket_upload_settings": {
	"max_files_per_ticket": 100,
	"max_file_size": 1073741824,
	"accepted_file_types": ""
}
```

### client.job_upload_settings
<!-- Title: Job Upload Settings -->

Client-side limits for job file uploads (max files/size/types) and default expiration for user/plugin files.

The defaults are:

```json
"job_upload_settings": {
	"max_files_per_job": 100,
	"max_file_size": 1073741824,
	"accepted_file_types": "",
	"user_file_expiration": "30 days",
	"plugin_file_expiration": "30 days"
}
```

### client.run_event_dialog
<!-- Title: Run Event Dialog Settings -->

Client-side configuration for the "Run Event" dialog, offering the ability to globally hide specific sections.

The defaults are:

```json
"run_event_dialog": {
	"hide_files": false,
	"hide_tags": false,
	"hide_priority": false,
	"hide_params": false
}
```


### client.xterm_defaults
<!-- Title: Terminal UI Settings -->

Client-side configuration for the terminal emulator.  These properties are passed directly to the [xterm.js](https://xtermjs.org/) component.

The defaults are:

```json
"xterm_defaults": {
	"minimumContrastRatio": 4.5,
	"scrollOnEraseInDisplay": true,
	"lineHeight": 1.2,
	"scrollback": 10000,
	"cursorStyle": "block",
	"cursorBlink": false
}
```


## Storage
<!-- Title: Storage Settings -->
<!-- Type: Group -->

This section configures the backend storage subsystem used by xyOps.

For full storage system documentation, see [pixl-server-storage](https://github.com/jhuckaby/pixl-server-storage).

### Storage.engine
<!-- Title: Engine -->

Selects the storage engine (e.g., Hybrid, Filesystem, SQLite, S3).  The default is `Hybrid`, which uses a combination of SQLite for JSON data records and the filesystem for binary file storage.

See [Engines](https://github.com/jhuckaby/pixl-server-storage#engines) for more details.

### Storage.list_page_size
<!-- Title: List Page Size -->

Default page size for storage lists (default: `100`).

### Storage.hash_page_size
<!-- Title: Hash Page Size -->

Default page size for storage hashes (default: `100`).

### Storage.concurrency
<!-- Title: Concurrency -->

Maximum concurrent I/O operations (default: `32`).

### Storage.transactions
<!-- Title: Transactions -->

Enables transactional writes (default: `true`).  Please leave this enabled!

### Storage.trans_auto_recover
<!-- Title: Transaction Auto-Recover -->

Automatically recover incomplete transactions on startup (default: `true`).

### Storage.trans_dir
<!-- Title: Transaction Directory Path -->

Local directory for transaction rollback logs and recovery bookkeeping (default: `data/_transactions`).  Engines with native transaction support, such as SQLite, Postgres, and Redis, do not write rollback logs for successful commits, but the directory is still used for transaction housekeeping.

### Storage.log_event_types
<!-- Title: Log Event Types -->

Default enables logging for get/put/delete and other operations. Controls which storage events are logged.

### Storage.Hybrid
<!-- Title: Hybrid Engine Settings -->

Configuration for the [Hybrid](https://github.com/jhuckaby/pixl-server-storage#hybrid) storage backend.

### Storage.Filesystem
<!-- Title: Filesystem Engine Settings -->

Filesystem backend options (base directory, namespacing, raw paths, fsync, in-memory cache). See [Filesystem](https://github.com/jhuckaby/pixl-server-storage#local-filesystem) for details.

### Storage.SQLite
<!-- Title: SQLite Engine Settings -->

SQLite backend options (base directory, filename, pragmas, cache, backups). See [SQLite](https://github.com/jhuckaby/pixl-server-storage#sqlite) for details.

### Storage.AWS
<!-- Title: AWS Settings -->

AWS SDK options (region/credentials) used by S3 when applicable. See [Amazon S3](https://github.com/jhuckaby/pixl-server-storage#amazon-s3) for details.

### Storage.S3
<!-- Title: S3 Engine Settings -->

S3 backend options (timeouts, retries, bucket params, caching). See [Amazon S3](https://github.com/jhuckaby/pixl-server-storage#amazon-s3) for details.


## WebServer
<!-- Title: Web Server Settings -->
<!-- Type: Group -->

This section configures the web server used by xyOps.

For full web server configuration, see [pixl-server-web](https://github.com/jhuckaby/pixl-server-web).

### WebServer.port
<!-- Title: Listen Port -->

HTTP port for the built-in web server (default: `5522`).

### WebServer.htdocs_dir
<!-- Title: Web Root Directory Path -->

Base directory for static assets and the web UI (default: `htdocs`).

If this is a relative path, it is computed from the xyOps base directory, which is typically `/opt/xyops`.

### WebServer.max_upload_size
<!-- Title: Max Upload Size (bytes) -->

Maximum accepted upload size in bytes (default: `1073741824`).

### WebServer.static_ttl
<!-- Title: Static Time-to-Live (seconds) -->

Cache TTL for serving static assets (default: `31536000`).

### WebServer.static_index
<!-- Title: Default Index Filename -->

Default index file for directory roots (default: `index.html`).

### WebServer.server_signature
<!-- Title: Server Signature -->

Server signature string included in headers (default: `xyOps`).

### WebServer.compress_text
<!-- Title: Auto-Compress Text -->

Enables automatic gzip/deflate compression for text responses (default: `true`).

### WebServer.enable_brotli
<!-- Title: Use Brotli Compression -->

Enables Brotli compression when supported (default: `true`).

### WebServer.timeout
<!-- Title: Idle Socket Timeout (seconds) -->

Per-request idle timeout for incoming connections in seconds (default: `30`);

### WebServer.regex_json
<!-- Title: JSON Content-Type Regex -->

Content-type regex pattern treated as JSON for response handling (default: `(text|javascript|js|json)`).

### WebServer.clean_headers
<!-- Title: Clean Response Headers -->

Strips unsafe HTTP header characters from responses (default: `true`).

### WebServer.log_socket_errors
<!-- Title: Log Socket Errors -->

Controls logging of low-level socket errors (default: `false`).

**Note:** This is rather noisy, and logs a lot of benign errors.

### WebServer.response_headers
<!-- Title: Custom Response Headers -->

Extra headers added to all responses.  The default is to add none.

### WebServer.keep_alives
<!-- Title: Keep-Alive Mode -->
<!-- Type: Menu -->
<!-- Items: ["default", "request", "close"] -->

Controls HTTP keep-alive behavior (see [keep_alives](https://github.com/jhuckaby/pixl-server-web#keep_alives) for details).

### WebServer.keep_alive_timeout
<!-- Title: Keep-Alive Timeout (seconds) -->

Idle timeout for keep-alive connections in seconds (default: `30`).

### WebServer.max_connections
<!-- Title: Maximum Connections -->

Maximum concurrent socket connections allowed (default: `2048`).

### WebServer.max_concurrent_requests
<!-- Title: Max Concurrent Requests -->

Maximum number of concurrent requests allowed (default: `256`).

### WebServer.log_requests
<!-- Title: Log All Requests -->

Enables per-request transaction logging (default: `false`).

**Note:** This is quite noisy.

### WebServer.legacy_callback_support
<!-- Title: Legacy Callback Support -->

Enables legacy JSONP/callback patterns for older clients (default: `false`).  Do not enable this on production.

### WebServer.startup_message
<!-- Title: Startup Message -->

Emits a startup message with server URL to the console (default: `false`).  Please leave this disabled, as xyOps emits its own startup message.

### WebServer.debug_ttl
<!-- Title: Debug Time-to-Live Override -->

Sets the default cache TTL to `0` when running in debug mode (default: `true`).

### WebServer.debug_bind_local
<!-- Title: Debug Bind to Local -->

Binds to localhost only when running in debug mode (default: `true`).

### WebServer.whitelist
<!-- Title: IP Whitelist -->

List of client IPs/CIDRs explicitly allowed to access the webserver (default: all).

### WebServer.blacklist
<!-- Title: IP Blacklist -->

List of client IPs/CIDRs explicitly denied at the webserver level (default: none).

### WebServer.uri_response_headers
<!-- Title: URI Response Headers -->

Allows mapping URI regex to custom response headers.  xyOps uses this to set CSP and security headers for HTML paths. 

### WebServer.https
<!-- Title: Enable HTTPS (TLS) -->

Enables HTTPS support (default: `true`).

### WebServer.https_port
<!-- Title: HTTPS Listen Port -->

HTTPS listener port (default: `5523`).

### WebServer.https_cert_file
<!-- Title: Certificate File Path -->

TLS certificate file path (default: `conf/tls.crt`).

If this is a relative path, it is computed from the xyOps base directory, which is typically `/opt/xyops`.

### WebServer.https_key_file
<!-- Title: Private Key File Path -->

TLS private key file path (default: `conf/tls.key`).

If this is a relative path, it is computed from the xyOps base directory, which is typically `/opt/xyops`.

### WebServer.https_force
<!-- Title: HTTPS Force Redirect -->

Forces HTTP to redirect to HTTPS (default: `false`).

### WebServer.https_timeout
<!-- Title: HTTPS Idle Socket Timeout (seconds) -->

Per-request idle timeout for HTTPS in seconds (default: `30`).

### WebServer.https_header_detect
<!-- Title: HTTPS Header Detect -->

Includes common headers to detect HTTPS when behind a reverse proxy.


## User
<!-- Title: User Manager Settings -->
<!-- Type: Group -->

This section configures the user management system used by xyOps.

For full user configuration, see [pixl-server-user](https://github.com/jhuckaby/pixl-server-user).

### User.session_expire_days
<!-- Title: Session Expiry (days) -->

Session lifetime in days before requiring login again (default: `365`).

### User.max_failed_logins_per_hour
<!-- Title: Max Login Failures Per Hour -->

Rate limit for failed logins per user per hour (default: `5`).

### User.max_forgot_passwords_per_hour
<!-- Title: Max Forgotten Passwords Per Hour -->

Rate limit for password reset requests per user per hour (default: `3`).

### User.free_accounts
<!-- Title: Free Accounts -->

Allow users to self-register without admin invitation (default: `false`).

### User.sort_global_users
<!-- Title: Sort Global User List -->

Sort global user lists (affects admin UI ordering, default: `false`).  Experimental.

### User.use_bcrypt
<!-- Title: Use Bcrypt -->

Use bcrypt for password hashing (default: `true`).  Please leave this enabled.

### User.use_csrf
<!-- Title: Use CSRF Tokens -->

Use CSRF Tokens for extra security (default: `true`).  Please leave this enabled.

### User.mail_logger
<!-- Title: Mail Logger -->

Attach logger output to sent mail logs for diagnostics (default: `true`).

### User.valid_username_match
<!-- Title: Valid Username Regex -->

Allowed characters for usernames (default: `^[\\w\\-\\.]+$`).

### User.block_username_match
<!-- Title: Block Username Regex -->

A regex for reserved/blocked usernames (for security and namespace protection).

### User.cookie_settings
<!-- Title: Cookie Settings -->

Sets cookie path, secure policy, httpOnly, and sameSite. Controls session cookie attributes.



## SSO

This section configures Single Sign-On using trusted headers. See the [SSO guide](sso.md) for setup details and examples.

### SSO.enabled

This boolean enables SSO (default: `false`).  When enabled, local username/password login is disabled unless [SSO.hybrid](#ssohybrid) is also enabled.

### SSO.hybrid

This boolean offers both local username/password login and a **Login with SSO...** button (default: `false`).  It requires `SSO.enabled` to be `true` and an SSO Plugin configured via [SSO.command](#ssocommand) that handles the browser login flow, such as the OIDC Plugin.  Enabling SSO with hybrid mode and no command causes a startup error.

Hybrid mode is **not supported** with an upstream authentication proxy.  With hybrid mode disabled, SSO starts automatically and new local password logins are rejected.  See [Hybrid Login](sso.md#hybrid-login) for setup and logout behavior.

### SSO.command

This string specifies the shell command for an SSO Plugin (default: empty).  The command receives request metadata and SSO configuration, and can redirect the browser or supply trusted identity headers.  Hybrid login requires a plugin that handles the browser login flow.  See [Custom Command](sso.md#custom-command) and the [xyOps OIDC Plugin](sso.md#xyops-oidc-plugin).

### SSO.whitelist

This array of IPs/CIDRs limits which client addresses may send trusted headers (default allows localhost, private and link-local ranges).

### SSO.header_map

This object maps incoming trusted headers to xyOps user fields (`username`, `full_name`, `email`, `groups`).

### SSO.cleanup_username

This boolean cleans up the username when derived from an email (strip illegal chars, lowercase, use local-part) (default: `true`).

### SSO.cleanup_full_name

This boolean derives a display name from an email (use local-part, replace dots with spaces, title-case) (default: `true`).

### SSO.group_role_map

This object maps IdP group names to xyOps role IDs to auto-assign roles on login (default: `{}`).

### SSO.group_role_separator

Optional character for splitting the external group list (default: `,`).

### SSO.group_privilege_map

This object maps IdP group names to privilege keys to auto-assign privileges on login (default: `{}`).

### SSO.replace_roles

This boolean replaces all existing user roles with those from `group_role_map` on each login (default: `false`).

### SSO.replace_privileges

This boolean replaces all existing user privileges with those from `group_privilege_map` on each login (default: `false`).

### SSO.admin_bootstrap

This string temporarily grants full admin to the exact matching username to bootstrap initial setup; remove after configuring groups (default: empty).

### SSO.logout_url

This string is the URL to redirect to after xyOps clears its session, so your auth proxy/IdP can complete logout (e.g., `/oauth2/sign_out?rd=...`).

In hybrid mode, this redirect applies to sessions created through SSO.  Local password sessions return to the login screen.  If the URL is empty, logout ends only the xyOps session and leaves any external sessions intact.  See [Logging Out](sso.md#logging-out).



## Debug

### Debug.enabled

Enables remote server debugging via Chrome Dev Tools (default: `false`).



## config_overrides_file

When settings are changed via the UI, overrides are saved here and applied on top of `config.json`.
