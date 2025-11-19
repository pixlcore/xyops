# Configuration

xyOps is configured primarily by a single JSON file located here: `/opt/xyops/conf/config.json` (the location may vary for custom installs).

However, if the configuration is modified using the UI, overrides are saved in a separate file: `/opt/xyops/conf/overrides.json`

This document describes all the editable properties in the `config.json` file.

## base_app_url

This string is the base URL of your xyOps instance (default: `http://localhost:5522`), and is used to build fully-qualified links in emails, alerts, tickets, and web hooks (e.g., job/ticket URLs and the logo URL in emails).

## email_from

This string is the sender email address for all outbound messages (default: `admin@localhost`); many SMTP servers require this to be a valid address.

## secret_key

This string is a shared secret used to sign tokens (e.g., download links), authenticate multi-master messages, and encrypt/decrypt stored secrets — set this to a long random value in production.

## mail_settings

This object configures the email transport and is passed verbatim to Nodemailer via pixl-mail. The default is:

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

Example (sendmail):

```json
"mail_settings": {
  "sendmail": true,
  "newline": "unix",
  "path": "/usr/sbin/sendmail"
}
```

### mail_settings.host

This string sets the SMTP hostname (default: `localhost`).

### mail_settings.port

This number sets the SMTP port (default: `25`).

### mail_settings.auth

This object holds SMTP auth credentials. Default:

```json
{ "user": "", "pass": "" }
```

## email_format

This string controls the email body format (default: `html`); use `html` for styled emails or `text` for plain text.

## max_emails_per_day

This number caps total emails sent per day across the app (default: 0, meaning no limit); excess sends are rejected with an error.

## log_dir

This string sets the base directory for server logs and job logs (default: `logs`), e.g., `logs/Error.log` and `logs/jobs/ID.log`.

If this is a relative path, it is computed from the xyOps base directory, which is typically `/opt/xyops`.

## log_filename

This string is the filename pattern used by the core logger (default: `[component].log`); supports log column placeholders like `[component]`.

## log_columns

This array of strings controls which log columns are written and their order. Default:

```json
["hires_epoch", "date", "hostname", "pid", "component", "category", "code", "msg", "data"]
```

See [pixl-logger](https://github.com/jhuckaby/pixl-logger) for more details.

## log_archive_path

This string sets the nightly log archive path pattern (default: `logs/archives/[yyyy]/[mm]/[dd]/[filename]-[yyyy]-[mm]-[dd].log.gz`); maintenance gzips and writes logs here.

Accepts [date/time placeholders](https://github.com/jhuckaby/pixl-tools#getdateargs) to dynamically generate the log archive filenames.

## log_crashes

This boolean enables capturing uncaught exceptions and crashes in the logger subsystem (default: `true`).

The crash log location will be: `/opt/xyops/logs/crash.log`

## temp_dir

This string is the scratch directory for temporary files such as plugin bundles and staging uploads (default: `temp`).

If this is a relative path, it is computed from the xyOps base directory, which is typically `/opt/xyops`.

## pid_file

This string sets the path to the main process PID file for start/stop tooling (default: `logs/xyops.pid`).

If this is a relative path, it is computed from the xyOps base directory, which is typically `/opt/xyops`.

## debug_level

This number sets the verbosity level for the logger (default: `5`; 1 = quiet, 10 = very verbose).

## tick_precision_ms

This number sets the internal timer precision in milliseconds used by the server framework for scheduling ticks (default: `50`).

This controls how precise xyOps is when executing actions targeted on a specific second.  Lower values mean xyOps is more precise, but will result in heavier idle CPU usage.

## maintenance

This string (in `HH:MM` format, server local time) schedules daily maintenance tasks such as DB trimming and log archival (default: `04:00`).

## ttl

This number (seconds) is the default HTTP cache TTL applied to selected API responses and static resources where applicable (default: `300`).

## file_expiration

This duration string sets the default expiration for uploaded files (e.g., ticket attachments), used to compute per-file expiration timestamps (default: `5 years`).

## timeline_expiration

This duration string sets the retention for monitor timelines; older points are pruned during maintenance (default: `10 years`).

## ping_freq_sec

This number (seconds) controls the interval for sending WebSocket pings to clients/workers (default: `10`).

## ping_timeout_sec

This number (seconds) is the max allowed time without a pong before a socket is considered timed out (default: `20`).

## max_jobs_per_min

This number sets a global rate limit on job starts per minute (default: 100); additional jobs are deferred with an error.

This is designed as a runaway e-brake mechanism, to prevent an erroneous workflow configuration from bringing down the entire system.

## dead_job_timeout

This number (seconds) determines when a running job with no updates is considered dead and aborted (default: `120`).

## job_env

This object contains environment variables merged into every job process.

Values can be overridden per job.

## job_universal_limits

This object defines global limit rules automatically applied to all jobs/workflows, such as concurrency, queue, or retry caps.

## job_universal_actions

This object defines global actions executed when conditions are met (default includes a system snapshot on error).  Actions can be assigned by job type (workflow or event).  Example:

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

This array lists actions automatically applied to all alerts for standardized behavior (default includes a hidden snapshot on new alert):

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

This regex string is removed from the end of hostnames for display and notifications (default: `\\.[\\w\\-]+\\.\\w+$`), e.g., to strip the domain suffix.

## ip_display_strip

This regex string is removed from IP addresses for display (default: `^::ffff:`), e.g., to strip the IPv6 IPv4-mapped prefix.

## search_file_threads

This number sets how many worker threads are used when searching files on disk (default: `1`).

## search_file_regex

This regex string limits which filenames are scanned by the file search APIs (default: `\\.(txt|log|csv|tsv|xml|json)(\\.gz)?$`).


## tickets

This section configures the ticketing subsystem.

### tickets.email_enabled

This boolean enables ticket-related outgoing emails such as new/overdue notifications (default: `true`).

### tickets.email_debounce_sec

This number (seconds) sets the minimum spacing between repeated ticket update emails to reduce noise (default: `30`).

For example, if a user makes a series of sequential changes to a ticket, only one email will be sent in a 30-second window, containing a summary of all the accumulated changes.

### tickets.overdue_schedule

This string (`HH:MM`) sets the daily time when the system scans for overdue tickets and sends notices (default: `04:30`).

### tickets.overdue_query

This string is the [Unbase-style search query](https://github.com/jhuckaby/pixl-server-storage/blob/master/docs/Indexer.md#simple-queries) used to select overdue tickets during the scheduled scan (default: `status:open due:<today`).

### tickets.due_date_format

This date format string controls how ticket due dates are displayed (default: `[dddd], [mmmm] [mday], [yyyy]`).

### tickets.date_time_format

This date/time format string controls how ticket timestamps are displayed (default: `[dddd], [mmmm] [mday], [yyyy] [hour12]:[mi] [ampm]`).


## hooks

This object defines system-wide web hook triggers that can fire on any logged activity.  Example:

```json
{ "job_complete": "wmhv3s16ymk" }
```



## hook_text_templates

This object provides message templates for jobs and alerts; Mustache-style placeholders populate human‑readable text for emails and web hooks (default includes templates like `{{links.job_details}}`).

See [JobHookData](data.md#jobhookdata) and [AlertHookData](data.md#alerthookdata) for a list of the placeholder macros you can use here.



## multi

This section configures the multi-server subsystem.

### multi.list_url

This URL string points to the release metadata used by multi-master upgrade flows (default: `https://api.github.com/repos/pixlcore/xyops/releases`).

### multi.protocol

This string selects the WebSocket protocol for peer communications (default: `ws:`); set to `wss:` to require TLS.

### multi.connect_timeout_sec

This number (seconds) sets the connection timeout for initial peer socket connections (default: `3`).

### multi.master_timeout_sec

This number (seconds) is used for the election timer and general control timeouts for master operations (default: `10`).

### multi.socket_opts

This object holds options merged into the WebSocket client, e.g., TLS options for self‑signed certs. Default:

```json
{ "rejectUnauthorized": false }
```



## satellite

This section configures xySat, our remote satellite agent.

### satellite.list_url

This URL string points to the release metadata for the satellite agent (default: `https://api.github.com/repos/pixlcore/xysat/releases`).

### satellite.base_url

This URL string is the base for satellite downloads/upgrades (default: `https://github.com/pixlcore/xysat/releases`).

### satellite.version

This string sets the desired satellite version to fetch; may be a semver or tag (default: `latest`).

### satellite.cache_ttl

This number (seconds) sets the cache TTL for satellite release metadata to reduce network calls (default: `3600`).

### satellite.config

This object contains web server and runtime settings for xySat; these options are passed along when managing or provisioning satellite nodes (defaults provided in the sample config).


## quick_monitors

This array defines built‑in metrics to collect (defaults include CPU, memory, disk, and network presets).  These are displayed on server detail pages for real-time monitoring.

## default_user_privileges

This object sets default privileges for new users (defaults include create/edit events, run/tag/comment jobs, and ticket permissions) unless overridden by roles or SSO.

See [Privileges](privileges.md) for more details on privileges.

## default_user_prefs

This object sets default UI preferences for new users (locale, theme, motion/contrast, volume, saved searches, etc.), merged into profiles at creation/login.


## db_maint

These settings are used during nightly database maintenance.

### db_maint.jobs

#### db_maint.jobs.max_rows

This number sets the maximum rows retained for the jobs database table (default: `1000000`); oldest are pruned during maintenance.

### db_maint.alerts

#### db_maint.alerts.max_rows

This number sets the maximum rows retained for the alerts database table (default: `100000`); oldest are pruned during maintenance.

### db_maint.snapshots

#### db_maint.snapshots.max_rows

This number sets the maximum rows retained for the snapshots database table (default: `100000`); oldest are pruned during maintenance.

### db_maint.activity

#### db_maint.activity.max_rows

This number sets the maximum rows retained for the activity database table (default: `100000`); oldest are pruned during maintenance.

### db_maint.servers

#### db_maint.servers.max_rows

This number sets the maximum rows retained for the servers database table (default: `10000`); oldest are pruned during maintenance.


## airgap

This section is for airgap mode, which can prevent xyOps from making unauthorized outbound connections beyond a specified IP range.

See [Air-Gapped Mode](hosting.md#air-gapped-mode) for more details.

### airgap.enabled

This boolean enables outbound network egress controls for server‑initiated HTTP(S) requests (default: `false`).

### airgap.outbound_whitelist

This array of CIDRs/hosts defines destinations explicitly allowed for outbound requests (default includes local/private networks); when enabled, only these are permitted.

### airgap.outbound_blacklist

This array of CIDRs/hosts defines destinations that are always blocked for outbound requests.


## client

This section is for the client-side configuration, used in the xyOps web application.

### client.name

This string is the product name displayed in the UI and included in email/version text (default: `xyOps`).

### client.logo_url

This path string points to the logo used in the UI header/sidebar and in emails (default: `images/logotype.png`).

### client.items_per_page

This number sets the default page size for list views and searches (default: `50`).

### client.alt_items_per_page

This number sets the secondary page size for inline widgets and dropdown lists (default: `25`).

### client.events_per_page

This number controls how many additional events are loaded per increment in the Events view (default: `500`).

### client.max_table_rows

This number caps the number of rendered table rows client‑side to keep the UI responsive (default: `500`).

### client.max_menu_items

Upper bound for items shown in menus and dropdowns (default: `1000`).

### client.alt_to_toggle

Requires the user to hold the Opt/Alt key to toggle the `enabled` property of certain entities in the UI (prevents accidental clicks).

### client.new_event_template

Provides sensible defaults for new events (triggers, limits, actions). Used to prefill the New Event form.

### client.chart_defaults

Default chart rendering options (line width, smoothing, ticks). Applied to monitor charts in the UI.

See [pixl-chart](https://github.com/jhuckaby/pixl-chart) for more details.

### client.editor_defaults

Default code editor preferences (tabs, indent, line wrapping) for [CodeMirror](https://codemirror.net/5/) fields in the UI.

### client.bucket_upload_settings

Client-side limits for bucket uploads (max files/size/types). Enforced in the UI before upload, and enforced server-side.

### client.ticket_upload_settings

Client-side limits for ticket attachments (max files/size/types). Enforced in the UI before upload, and enforced server-side.

### client.job_upload_settings

Client-side limits for job file uploads (max files/size/types) and default expiration for user/plugin files.


## Storage

This section configures the backend storage subsystem used by xyOps.

For full storage system documentation, see [pixl-server-storage](https://github.com/jhuckaby/pixl-server-storage).

### Storage.engine

Selects the storage engine (e.g., Hybrid, Filesystem, SQLite, S3).  The default is `Hybrid`, which uses a combination of SQLite for JSON data records and the filesystem for binary file storage.

See [Engines](https://github.com/jhuckaby/pixl-server-storage#engines) for more details.

### Storage.list_page_size

Default page size for storage lists (default: `100`).

### Storage.hash_page_size

Default page size for storage hashes (default: `100`).

### Storage.concurrency

Maximum concurrent I/O operations (default: `32`).

### Storage.transactions

Enables transactional writes (default: `true`).

### Storage.network_transactions

Enables transactions across networked backends (experimental: use with caution).

### Storage.trans_auto_recover

Automatically recover incomplete transactions on startup (default: `true`).

### Storage.trans_dir

Temp directory for transaction logs/journals (default: `data/_transactions`).

### Storage.log_event_types

Default enables logging for get/put/delete and other operations. Controls which storage events are logged.

### Storage.Hybrid

Configuration for the [Hybrid](https://github.com/jhuckaby/pixl-server-storage#hybrid) storage backend.

### Storage.Filesystem

Filesystem backend options (base directory, namespacing, raw paths, fsync, in-memory cache). See [Filesystem](https://github.com/jhuckaby/pixl-server-storage#local-filesystem) for details.

### Storage.SQLite

SQLite backend options (base directory, filename, pragmas, cache, backups). See [SQLite](https://github.com/jhuckaby/pixl-server-storage#sqlite) for details.

### Storage.AWS

AWS SDK options (region/credentials) used by S3 when applicable. See [Amazon S3](https://github.com/jhuckaby/pixl-server-storage#amazon-s3) for details.

### Storage.S3

S3 backend options (timeouts, retries, bucket params, caching). See [Amazon S3](https://github.com/jhuckaby/pixl-server-storage#amazon-s3) for details.


## WebServer

This section configures the web server used by xyOps.

For full web server configuration, see [pixl-server-web](https://github.com/jhuckaby/pixl-server-web).

### WebServer.port

HTTP port for the built-in web server (default: `5522`).

### WebServer.htdocs_dir

Base directory for static assets and the web UI (default: `htdocs`).

If this is a relative path, it is computed from the xyOps base directory, which is typically `/opt/xyops`.

### WebServer.max_upload_size

Maximum accepted upload size in bytes (default: `1073741824`).

### WebServer.static_ttl

Cache TTL for serving static assets (default: `31536000`).

### WebServer.static_index

Default index file for directory roots (default: `index.html`).

### WebServer.server_signature

Server signature string included in headers (default: `xyOps`).

### WebServer.compress_text

Enables automatic gzip/deflate compression for text responses (default: `true`).

### WebServer.enable_brotli

Enables Brotli compression when supported (default: `true`).

### WebServer.timeout

Per-request idle timeout for incoming connections in seconds (default: `30`);

### WebServer.regex_json

Content-type regex pattern treated as JSON for response handling (default: `(text|javascript|js|json)`).

### WebServer.clean_headers

Strips unsafe HTTP header characters from responses (default: `true`).

### WebServer.log_socket_errors

Controls logging of low-level socket errors (default: `false`).

### WebServer.response_headers

Extra headers added to all responses.  The default is to add none.

### WebServer.keep_alives

Controls HTTP keep-alive behavior (see [keep_alives](https://github.com/jhuckaby/pixl-server-web#keep_alives) for details).

### WebServer.keep_alive_timeout

Idle timeout for keep-alive connections in seconds (default: `30`).

### WebServer.max_connections

Maximum concurrent socket connections allowed (default: `2048`).

### WebServer.max_concurrent_requests

Maximum number of concurrent requests allowed (default: `256`).

### WebServer.log_requests

Enables per-request transaction logging (default: `false`).

### WebServer.legacy_callback_support

Enables legacy JSONP/callback patterns for older clients (default: `false`).  Do not enable this on production.

### WebServer.startup_message

Emits a startup message with server URL to the console (default: `false`).  Please leave this disabled, as xyOps emits its own startup message.

### WebServer.debug_ttl

Sets the default cache TTL to `0` when running in debug mode (default: `false`).

### WebServer.debug_bind_local

Binds to localhost only when running in debug mode (default: `true`).

### WebServer.whitelist

List of client IPs/CIDRs explicitly allowed to access the webserver (default: all).

### WebServer.blacklist

List of client IPs/CIDRs explicitly denied at the webserver level (default: none).

### WebServer.uri_response_headers

Allows mapping URI regex to custom response headers.  xyOps uses this to set CSP and security headers for HTML paths. 

### WebServer.https

Enables HTTPS support (default: `true`).

### WebServer.https_port

HTTPS listener port (default: `5523`).

### WebServer.https_cert_file

TLS certificate file path (default: `conf/tls.crt`).

If this is a relative path, it is computed from the xyOps base directory, which is typically `/opt/xyops`.

### WebServer.https_key_file

TLS private key file path (default: `conf/tls.key`).

If this is a relative path, it is computed from the xyOps base directory, which is typically `/opt/xyops`.

### WebServer.https_force

Forces HTTP to redirect to HTTPS (default: `false`).

### WebServer.https_timeout

Per-request idle timeout for HTTPS in seconds (default: `30`).

### WebServer.https_header_detect

Includes common headers to detect HTTPS when behind a reverse proxy.


## User

This section configures the user management system used by xyOps.

For full user configuration, see [pixl-server-user](https://github.com/jhuckaby/pixl-server-user).

### User.session_expire_days

Session lifetime in days before requiring login again (default: `365`).

### User.max_failed_logins_per_hour

Rate limit for failed logins per user per hour (default: `5`).

### User.max_forgot_passwords_per_hour

Rate limit for password reset requests per user per hour (default: `3`).

### User.free_accounts

Allow users to self-register without admin invitation (default: `false`).

### User.sort_global_users

Sort global user lists (affects admin UI ordering, default: `false`).

### User.use_bcrypt

Use bcrypt for password hashing (default: `true`).

### User.mail_logger

Attach logger output to sent mail logs for diagnostics (default: `true`).

### User.valid_username_match

Allowed characters for usernames (default: `^[\\w\\-\\.]+$`).

### User.block_username_match

A regex for reserved/blocked usernames (for security and namespace protection).

### User.cookie_settings

Sets cookie path, secure policy, httpOnly, and sameSite. Controls session cookie attributes.



## SSO

This section configures Single Sign‑On using trusted headers. See the [SSO guide](sso.md) for setup details and examples.

### enabled

This boolean enables SSO and disables local username/password login (default: `false`).

### whitelist

This array of IPs/CIDRs limits which client addresses may send trusted headers (default allows localhost, private and link‑local ranges).

### header_map

This object maps incoming trusted headers to xyOps user fields (`username`, `full_name`, `email`, `groups`).

### cleanup_username

This boolean cleans up the username when derived from an email (strip illegal chars, lowercase, use local‑part) (default: `true`).

### cleanup_full_name

This boolean derives a display name from an email (use local‑part, replace dots with spaces, title‑case) (default: `true`).

### group_role_map

This object maps IdP group names to xyOps role IDs to auto‑assign roles on login (default: `{}`).

### group_privilege_map

This object maps IdP group names to privilege keys to auto‑assign privileges on login (default: `{}`).

### replace_roles

This boolean replaces all existing user roles with those from `group_role_map` on each login (default: `false`).

### replace_privileges

This boolean replaces all existing user privileges with those from `group_privilege_map` on each login (default: `false`).

### admin_bootstrap

This string temporarily grants full admin to the exact matching username to bootstrap initial setup; remove after configuring groups (default: empty).

### logout_url

This string is the URL to redirect to after xyOps clears its session, so your auth proxy/IdP can complete logout (e.g., `/oauth2/sign_out?rd=...`).



## Debug

### Debug.enabled

Enables remote server debugging via Chrome Dev Tools (default: `false`).



## config_overrides_file

When settings are changed via the UI, overrides are saved here and applied on top of `config.json`.
