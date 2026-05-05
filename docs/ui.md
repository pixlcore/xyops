# User Interface

## Overview

This document explains the main user interface settings in xyOps, which live under the `client` object in your configuration file.

The main configuration file is typically located at `/opt/xyops/conf/config.json`.  If you edit settings in the Admin UI, xyOps writes the changes to `/opt/xyops/conf/overrides.json` instead.  See [Configuration](config.md) and [Self-Hosting](hosting.md#configuration) for more details.

## Whitelabeling

xyOps can be lightly whitelabeled by changing the product name, footer company name, and logo.  These settings affect the web UI, email subjects, email footers, and other user-facing messages.

| Setting | Default | Description |
|---------|---------|-------------|
| `client.name` | `xyOps` | The application name shown in the UI, login text, documentation header, email subjects, alert text, web hook text, and version strings. |
| `client.company` | `PixlCore LLC` | The company name shown in the UI footer and email footer copyright. |
| `client.logo_url` | `/images/logotype.png` | The logo image path or URL used in the sidebar, login header, and email template. |

Example:

```json
{
	"client": {
		"name": "Acme Ops",
		"company": "Acme Corp",
		"logo_url": "/images/acme-ops-logo.png"
	}
}
```

The `logo_url` may be a local web root path, typically beginning with `/`, or a fully-qualified image URL.  However, the default `email_logo` mode is `inline`, which embeds the logo into outgoing emails.  In that mode, `logo_url` must be a local path under the xyOps `htdocs` directory, because xyOps loads the image from disk before attaching it to email.  If you set [email_logo](config.md#email_logo) to `link`, then `logo_url` may be a remote image URL instead.

You can also override these settings with environment variables:

```sh
XYOPS_client__name="Acme Ops"
XYOPS_client__company="Acme Corp"
XYOPS_client__logo_url="/images/acme-ops-logo.png"
```

## Sidebar

The sidebar can be controlled at three levels:

1. **User preferences in the UI:** Each user can choose which sidebar sections are visible from **My Settings**.  This is stored on their user record as `sidebar`.
2. **Default user preferences:** The server-side `default_user_prefs.sidebar` array sets the default sidebar sections for new users, and for SSO-created users when their profile is initialized.
3. **Global hidden sections:** The `client.hide_sidebar_sections` array force-hides sections for everyone, regardless of their user preferences.

Here is the full set of built-in sidebar section IDs:

```json
[
	"main",
	"job_searches",
	"ticket_searches",
	"shortcuts",
	"scheduler",
	"monitoring",
	"settings",
	"admin",
	"help"
]
```

### User Sidebar Preferences

Users can open **My Settings** and choose the sidebar sections they want to see.  This affects only their own account, and does not change permissions.  For example, hiding the **Admin** sidebar section makes the UI quieter for that user, but it does not remove admin privileges.

Internally, the selection is stored on the user record as [User.sidebar](data.md#user-sidebar).

Some individual tabs are still hidden automatically based on privileges.  For example, a non-admin user will not see most Admin links, even if their `sidebar` array includes `admin`.

### Default Sidebar Preferences

To set the starting sidebar layout for new users, add a `sidebar` array inside [default_user_prefs](config.md#default_user_prefs).

Users can still customize this later in **My Settings**, unless you also hide sections globally with `client.hide_sidebar_sections`.

### Globally Hidden Sidebar Sections

To hide sidebar sections for all users, add their IDs to `client.hide_sidebar_sections`:

```json
{
	"client": {
		"hide_sidebar_sections": ["ticket_searches", "shortcuts", "help"]
	}
}
```

Globally hidden sections are removed from the **My Settings** sidebar selector as well, so users cannot re-enable them.

This is useful when you want to simplify the UI for a focused deployment.  For example, if you use xyOps only for monitoring and alerts, you may want to hide scheduler-related sections from most installs.

## Sortable Tables

xyOps has several sortable tables in the UI.  When a user clicks a table column header, xyOps remembers the selected sort column and direction in that user's local browser preferences.

The `client.tables` object lets you define global default sort settings for these tables:

```json
{
	"client": {
		"tables": {
			"t_servers": {
				"sort_by": "num_alerts",
				"sort_dir": -1
			},
			"t_events": {
				"sort_by": "title",
				"sort_dir": 1
			}
		}
	}
}
```

The precedence order is:

1. The user's remembered browser preference, if one exists.
2. The global default in `client.tables`.
3. The built-in default from the page code.

This means `client.tables` is best used for first-run defaults, shared kiosk screens, or resetting the natural starting sort for users who have not already chosen their own table sort.

### Sort Direction

Use `1` for ascending order and `-1` for descending order:

```json
{
	"sort_by": "title",
	"sort_dir": 1
}
```

### Table IDs

Here are the built-in sortable table IDs and their default sort settings:

| Table ID | Page | Built-in Default |
|----------|------|------------------|
| `t_events` | Events and Workflows | `cat_sort`, ascending |
| `t_servers` | Active Servers | `label`, ascending |
| `t_plugins` | Plugins | `title`, ascending |
| `t_marketplace` | Marketplace | `title`, ascending |
| `t_snap_conts` | Server Snapshot Containers | `cpu`, descending |
| `t_snap_procs` | Server Snapshot Processes | `cpu`, descending |
| `t_snap_conns` | Server Snapshot Connections | `state`, ascending |
| `t_snap_ifaces` | Server Snapshot Interfaces | `iface`, ascending |
| `t_snap_fs` | Server Snapshot Mounts | `mount`, ascending |
| `t_grp_conts` | Group Containers | `cpu`, descending |
| `t_grp_procs` | Group Processes | `cpu`, descending |
| `t_grp_conns` | Group Connections | `state`, ascending |

### Column IDs

The `sort_by` value must match one of the table's column IDs.  Common examples include:

```json
{
	"client": {
		"tables": {
			"t_servers": { "sort_by": "num_jobs", "sort_dir": -1 },
			"t_plugins": { "sort_by": "created", "sort_dir": -1 },
			"t_snap_procs": { "sort_by": "memRss", "sort_dir": -1 },
			"t_snap_fs": { "sort_by": "use", "sort_dir": -1 }
		}
	}
}
```

If you use a column ID that does not exist for that table, the table header will not be able to describe the sort cleanly, and sorting may not behave as expected.  When in doubt, use the built-in defaults above.

Here are the sortable column IDs for each table:

| Table ID | Sortable Column IDs |
|----------|---------------------|
| `t_events` | `title`, `cat_sort`, `tag_sort`, `plug_sort`, `target_sort`, `timing_sort`, `status_sort` |
| `t_servers` | `label`, `ip`, `grp_labels`, `cpu_cores`, `mem_total`, `arch_label`, `os_label`, `sat_ver`, `uptime`, `num_jobs`, `num_alerts` |
| `t_plugins` | `title`, `id`, `type`, `source_sort`, `created` |
| `t_marketplace` | `title`, `author`, `license`, `type`, `modified_sort`, `status_sort` |
| `t_snap_conts` | `name`, `id`, `cpu`, `mem_usage`, `mem_total`, `net_read`, `net_write`, `disk_read`, `disk_write` |
| `t_snap_procs` | `command`, `user`, `pid`, `parentPid`, `cpu`, `memRss`, `age`, `state` |
| `t_snap_conns` | `state`, `type`, `local_addr`, `remote_addr`, `command`, `bytes_in`, `bytes_out` |
| `t_snap_ifaces` | `iface`, `ip4`, `ip6`, `operstate`, `type`, `speed`, `rx_sec`, `tx_sec` |
| `t_snap_fs` | `mount`, `type`, `fs`, `size`, `used`, `avail`, `use` |
| `t_grp_conts` | `name`, `id`, `server_label`, `cpu`, `mem_usage`, `mem_total`, `net_read`, `net_write`, `disk_read`, `disk_write` |
| `t_grp_procs` | `command`, `server_label`, `user`, `pid`, `parentPid`, `cpu`, `memRss`, `age`, `state` |
| `t_grp_conns` | `state`, `server_label`, `type`, `local_addr`, `remote_addr`, `command`, `bytes_in`, `bytes_out` |

## General UI Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `client.items_per_page` | `50` | Default page size for search results and main list pages, such as job search, tickets, servers, alerts, marketplace, activity, and snapshots. |
| `client.alt_items_per_page` | `25` | Secondary page size for compact inline lists, picker dialogs, recent job lookups, upcoming jobs, and other small UI widgets. |
| `client.events_per_page` | `500` | Number of events or workflows fetched per increment in the Events and Workflows list views. |
| `client.max_table_rows` | `500` | Maximum number of rows rendered in sortable client-side tables before the UI truncates the display with a "more not shown" row. |
| `client.max_menu_items` | `1000` | Maximum number of options shown in select menus and dropdowns. |
| `client.max_job_output` | `5 MB` | Maximum amount of job output displayed inline on the Job Details page. |
| `client.alt_to_toggle` | `false` | Requires users to hold Opt/Alt when toggling enabled flags in selected admin list screens, helping prevent accidental clicks. |

Example:

```json
{
	"client": {
		"items_per_page": 100,
		"alt_items_per_page": 50,
		"events_per_page": 1000,
		"max_table_rows": 1000,
		"max_menu_items": 2000,
		"max_job_output": "10 MB",
		"alt_to_toggle": true
	}
}
```

## New Event Template

The `client.new_event_template` object provides default values for newly-created events and workflows.  It is copied into the event form when a user starts a new event.

The default template includes:

```json
{
	"id": "",
	"title": "",
	"enabled": true,
	"targets": [],
	"params": {},
	"fields": [],
	"triggers": [
		{
			"enabled": true,
			"type": "manual"
		}
	],
	"limits": [
		{
			"type": "job",
			"enabled": true,
			"amount": 1
		},
		{
			"type": "queue",
			"enabled": true,
			"amount": 0
		},
		{
			"type": "retry",
			"enabled": true,
			"amount": 0,
			"duration": 0
		}
	],
	"actions": [],
	"notes": ""
}
```

You can use this to set defaults that match your organization, such as a default category, plugin, target group, actions, tags, limits, or notes.  See [Events](events.md), [Limits](limits.md), and [Actions](actions.md) for the event fields themselves.

Example:

```json
{
	"client": {
		"new_event_template": {
			"enabled": true,
			"category": "general",
			"targets": ["all_servers"],
			"algo": "random",
			"triggers": [
				{
					"enabled": true,
					"type": "manual"
				}
			],
			"limits": [
				{
					"type": "job",
					"enabled": true,
					"amount": 1
				},
				{
					"type": "queue",
					"enabled": true,
					"amount": 0
				}
			],
			"actions": [],
			"tags": ["ops"],
			"notes": ""
		}
	}
}
```

## Chart Defaults

The `client.chart_defaults` object is passed into the UI chart renderer used for monitor graphs and server metrics.  It controls visual details such as line width, smoothing, tick counts, fill opacity, and hover sort behavior.

Default:

```json
{
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

These options are merged with xyOps UI defaults before each chart is rendered.  See [pixl-chart](https://github.com/jhuckaby/pixl-chart) for the lower-level chart option behavior.

## Code Editor Defaults

The `client.editor_defaults` object configures CodeMirror fields in the UI, such as script editors, JSON editors, and text areas that support code formatting.

Default:

```json
{
	"lineNumbers": false,
	"matchBrackets": false,
	"indentWithTabs": true,
	"tabSize": 4,
	"indentUnit": 4,
	"lineWrapping": true,
	"dragDrop": false
}
```

These values are passed into CodeMirror when editors are created.  See [CodeMirror 5](https://codemirror.net/5/) for supported editor options.

## Upload Settings

xyOps has separate upload settings for buckets, tickets, and jobs.  These settings are used by the browser uploader, and the important limits are also enforced on the server side.

### Bucket Uploads

`client.bucket_upload_settings` controls uploads to [Storage Buckets](buckets.md):

```json
{
	"max_files_per_bucket": 100,
	"max_file_size": 1073741824,
	"accepted_file_types": ""
}
```

| Setting | Description |
|---------|-------------|
| `max_files_per_bucket` | Maximum number of files allowed in a bucket. |
| `max_file_size` | Maximum size of a single uploaded file, in bytes. |
| `accepted_file_types` | Browser file picker accept string.  Blank means any file type. |

### Ticket Uploads

`client.ticket_upload_settings` controls file attachments on [Tickets](tickets.md):

```json
{
	"max_files_per_ticket": 100,
	"max_file_size": 1073741824,
	"accepted_file_types": ""
}
```

| Setting | Description |
|---------|-------------|
| `max_files_per_ticket` | Maximum number of files allowed on one ticket. |
| `max_file_size` | Maximum size of a single uploaded file, in bytes. |
| `accepted_file_types` | Browser file picker accept string.  Blank means any file type. |

### Job Uploads

`client.job_upload_settings` controls files uploaded into jobs, including manual job runs and Magic Form submissions:

```json
{
	"max_files_per_job": 100,
	"max_file_size": 1073741824,
	"accepted_file_types": "",
	"user_file_expiration": "30 days",
	"plugin_file_expiration": "30 days"
}
```

| Setting | Description |
|---------|-------------|
| `max_files_per_job` | Maximum number of files allowed for one job run.  Field-level limits can reduce this further. |
| `max_file_size` | Maximum size of a single uploaded file, in bytes.  Field-level limits can reduce this further. |
| `accepted_file_types` | Browser file picker accept string.  Blank means any file type.  Field-level accept rules can override this. |
| `user_file_expiration` | How long user-uploaded job input files are retained. |
| `plugin_file_expiration` | How long plugin-generated uploaded job files are retained. |

The expiration values use human-readable durations, such as `30 days`, `12 hours`, or `1 week`.

## Environment Variables

All of these settings can be overridden with the `XYOPS_` environment variable syntax.  Use double underscores for nested object paths:

```sh
XYOPS_client__items_per_page="100"
XYOPS_client__alt_to_toggle="true"
XYOPS_client__tables__t_servers__sort_by="num_alerts"
XYOPS_client__tables__t_servers__sort_dir="-1"
```

For arrays and larger objects, editing `config.json` or `overrides.json` is usually clearer than trying to express the whole structure as environment variables.

## Security Note

The `client` settings are sent to the browser before login, so please do not put secrets, private tokens, internal passwords, or sensitive infrastructure details anywhere under `client`.
