# Overview

This section details the xyOps REST API and API Key system.  All API calls expect JSON as input (unless they are simple HTTP GETs), and will return JSON as output.  The main API endpoint is:

```
https://SERVER/api/app/NAME/v1
```

Replace `NAME` with the specific API function you are calling (see below for list).  All requests should be HTTP GET or HTTP POST as the API dictates, and should be directed at your xyOps primary server.  Example URL:

```
http://sample.west.xyops.io/api/app/search_jobs/v1
```

## API Keys

API Keys allow you to register external applications or services to use the REST API.  These can be thought of as special user accounts specifically for applications.  Each API key can be granted a specific set of privileges.

To create an API Key, you must first be an administrator level user.  Login to the xyOps UI, proceed to the **API Keys** tab, and click the "Add API Key..." button.  Fill out the form and click the "Create Key" button at the bottom of the page.

API Keys are randomly generated alphanumeric strings, and are 24 characters in length by default.  They **are** case sensitive.  Example:

```
muJm8T6QSzqQzuO6MvbOdtlB
```

You must include a valid API Key with every API request.  There are three ways to do this: include a `X-API-Key` HTTP request header, an `api_key` query string parameter, or an `api_key` JSON property.

Here is a raw HTTP request showing all three methods of passing the API Key (only one of these is required):

```
GET /api/app/search_jobs/v1?api_key=muJm8T6QSzqQzuO6MvbOdtlB HTTP/1.1
Host: sample.west.xyops.io
X-API-Key: muJm8T6QSzqQzuO6MvbOdtlB
Content-Type: application/json

{"query": "*", "offset": 0, "limit": 50, "api_key": "muJm8T6QSzqQzuO6MvbOdtlB"}
```

## Standard Response Format

Regardless of the specific API call you requested, all responses will be in JSON format, and include at the very least a `code` property.  This will be set to `0` upon success, or any other value if an error occurred.  In the event of an error, a `description` property will also be included, containing the error message itself.  Individual API calls may include additional properties, but these two are standard fare in all cases.  Example successful response:

```json
{
	"code": 0
}
```

Example error response:

```json
{
	"code": "session", 
	"description": "No Session ID or API Key could be found"
}
```

# API Reference

## Alerts

See [Monitoring](monitors.md) for details on the xyOps monitoring and alert system.

### get_alerts

```
GET /api/app/get_alerts/v1
```

This fetches all the current alert definitions.  No input parameters are defined.  No specific privilege is required, besides a valid user session or API Key.

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing all alerts, and a `list` object containing list metadata (e.g. `length` for total rows without pagination). Example response:

```json
{
	"code": 0,
	"rows": [
		{
			"id": "load_avg_high",
			"title": "High CPU Load",
			"expression": "monitors.load_avg >= (cpu.cores + 1)",
			"message": "CPU load average is too high: {{float(monitors.load_avg)}} ({{cpu.cores}} CPU cores)",
			"groups": [],
			"email": "",
			"web_hook": "",
			"monitor_id": "load_avg",
			"enabled": true,
			"samples": 1,
			"notes": "",
			"username": "admin",
			"modified": 1434125333,
			"created": 1434125333
		}
	],
	"list": { "length": 1 }
}
```

In addition to the [Standard Response Format](#standard-response-format), this API will also include a `rows` array containing information about every alert definition, and a `list` object containing list metadata.

See [Alert](data-structures.md#alert) for details on the properties on each alert.

### get_alert

```
GET /api/app/get_alert/v1
```

This fetches a single alert definition given its ID. No specific privilege is required, besides a valid user session or API Key.  Both a HTTP GET with query string parameters and a HTTP POST with JSON are allowed.  The input parameters are as follows:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the alert to fetch. |

Here is an example request:

```json
{
	"id": "load_avg_high"
}
```

And an example response:

```json
{
	"code": 0,
	"alert": {
		"id": "load_avg_high",
		"title": "High CPU Load",
		"expression": "monitors.load_avg >= (cpu.cores + 1)",
		"message": "CPU load average is too high: {{float(monitors.load_avg)}} ({{cpu.cores}} CPU cores)",
		"groups": [],
		"email": "",
		"web_hook": "",
		"monitor_id": "load_avg",
		"enabled": true,
		"samples": 1,
		"notes": "",
		"username": "admin",
		"modified": 1434125333,
		"created": 1434125333
	}
}
```

In addition to the [Standard Response Format](#standard-response-format), this API will also include an `alert` object containing information about the requested alert.

See [Alert](data-structures.md#alert) for details on the alert properties.

### create_alert

```
POST /api/app/create_alert/v1
```

This creates a new alert definition.  The [create_alerts](privileges.md#create_alerts) privilege is required, as well as a valid user session or API Key.   The request must be sent as an HTTP POST with a JSON body.  See [Alert](data-structures.md#alert) for details on the input properties.  The `id`, `username`, `created` and `modified` properties may be omitted, as they are automatically generated.  Here is an example request:

```json
{
	"title": "High CPU Load",
	"expression": "monitors.load_avg >= (cpu.cores + 1)",
	"message": "CPU load average is too high: {{float(monitors.load_avg)}} ({{cpu.cores}} CPU cores)",
	"groups": [],
	"email": "",
	"web_hook": "",
	"monitor_id": "load_avg",
	"enabled": true,
	"samples": 1,
	"notes": ""
}
```

And an example response:

```json
{
	"code": 0,
	"alert": {...}
}
```

In addition to the [Standard Response Format](#standard-response-format), this API will also include an `alert` object containing the alert that was just created (including all the auto-generated properties).

See [Alert](data-structures.md#alert) for details on the alert properties.

### update_alert

```
POST /api/app/update_alert/v1
```

This updates an existing alert definition, specified by its ID.  The [edit_alerts](privileges.md#edit_alerts) privilege is required, as well as a valid user session or API Key.  The request must be sent as an HTTP POST with a JSON body.  See [Alert](data-structures.md#alert) for details on the input properties.  The request is "shallow-merged" into the existing alert, so you can provide a sparse set of properties to update.  Here is an example request:

```json
{
	"id": "load_avg_high",
	"title": "High CPU Load",
	"expression": "monitors.load_avg >= (cpu.cores + 1)"
}
```

And an example response:

```json
{
	"code": 0
}
```

The above example would update the `title` and `expression` of the alert with ID `load_avg_high`.  The other properties in the alert will not be touched (except for `modified` which is always updated, and some other internal properties).

### test_alert

```
POST /api/app/test_alert/v1
```

This tests an alert configuration, specifically the `expression` and `message` properties, against a specified server.  It tests both the syntax of the properties by pre-compiling them, and it also evaluates them against the specified server data, so you can see if the alert would fire given current conditions.  The [edit_alerts](privileges.md#edit_alerts) privilege is required, as well as a valid user session or API Key.  The request must be sent as an HTTP POST with a JSON body.  The input parameters are as follows:

| Property Name | Type | Description |
|---------------|------|-------------|
| `server` | String | **(Required)** The alphanumeric ID of the server to test the expression and message on. |
| `expression` | String | **(Required)** The alert expression to test. |
| `message` | String | **(Required)** The alert message to test. |

Here is an example request:

```json
{
	"server": "s12345abcde",
	"expression": "monitors.load_avg >= (cpu.cores + 1)",
	"message": "CPU load average is too high: {{float(monitors.load_avg)}} ({{cpu.cores}} CPU cores)"
}

And an example response:

```json
{
	"code": 0,
	"result": false,
	"message": "CPU load average is too high: 2.5 (2 CPU cores)"
}
```

In addition to the [Standard Response Format](#standard-response-format), this API will also include a `result` boolean indicating whether the alert would fire given the current server data, and a `message` string containing the evaluated message.

### delete_alert

```
POST /api/app/delete_alert/v1
```

This deletes an alert definition, specified by its ID. The [delete_alerts](privileges.md#delete_alerts) privilege is required, as well as a valid user session or API Key. The request must be sent as an HTTP POST with a JSON body. The input parameters are as follows:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the alert to delete. |

Here is an example request:

```json
{
	"id": "load_avg_high"
}
```

And an example response:

```json
{
	"code": 0
}
```

Deletions are permanent and cannot be undone.

## Buckets

A storage bucket is a logical container for storing files, for use in events and workflows. Buckets can hold an arbitrary number of files, and JSON data.

### get_buckets

```
GET /api/app/get_buckets/v1
```

This fetches all the current storage bucket definitions (sans actual data and files).  No input parameters are defined.  No specific privilege is required, besides a valid user session or API Key.

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing all buckets, and a `list` object containing list metadata (e.g. `length` for total rows without pagination). Example response:

```json
{
	"code": 0,
	"rows": [
		{
			"id": "bme4wi6pg35",
			"title": "The Void",
			"enabled": true,
			"icon": "",
			"notes": "",
			"username": "admin",
			"modified": 1754783050,
			"created": 1754783023,
			"revision": 2
		}
	],
	"list": { "length": 1 }
}
```

In addition to the [Standard Response Format](#standard-response-format), this API will also include a `rows` array containing information about every bucket definition, and a `list` object containing list metadata.

See [Bucket](data-structures.md#bucket) for details on the properties on each bucket.

### get_bucket

```
GET /api/app/get_bucket/v1
```

This retrieves the definition of a specific storage bucket, including its data and file list.  No specific privilege is required, besides a valid user session or API Key.  Here are the input parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the bucket to retrieve. |

And here is an example response:

```json
{
	"code": 0,
	"bucket": {
		"id": "bme4wi6pg35",
		"title": "The Void",
		"enabled": true,
		"icon": "",
		"notes": "",
		"username": "admin",
		"modified": 1754783050,
		"created": 1754783023,
		"revision": 2
	},
	"data": {
		"foo": "Hello this is a bucket"
	},
	"files": [
		{
			"id": "fme4wijr73h",
			"date": 1754783040,
			"filename": "test.png",
			"path": "files/bucket/bme4wi6pg35/bdY8zZ9nKynfFUb4xH6fA/test.png",
			"size": 92615,
			"username": "admin"
		}
	]
}
```

See [Bucket](data-structures.md#bucket) for details on the properties in the `bucket` object.  The `data` object will be populated with the bucket data, which is all user-defined.  The `files` array is a list of all the files in the bucket, if any.  To download a file, use the `path` property, prepended with the app's base URL (and a slash).

### create_bucket

```
POST /api/app/create_bucket/v1
```

This creates a new storage bucket.  The [create_buckets](privileges.md#create_buckets) privilege is required, as well as a valid user session or API Key.   The request must be sent as an HTTP POST with a JSON body.  See [Bucket](data-structures.md#bucket) for details on the input properties.  The `id`, `username`, `created` and `modified` properties may be omitted, as they are automatically generated.  Here is an example request:

```json
{
	"title": "The Void",
	"enabled": true,
	"icon": "",
	"notes": "",
	"data": {
		"foo": "Hello this is a bucket"
	}
}
```

And an example response:

```json
{
	"code": 0,
	"bucket": {...}
}
```

In addition to the [Standard Response Format](#standard-response-format), this API will also include a `bucket` object containing the bucket that was just created (including all the auto-generated properties).

As you can see in the above example, you can specify the user-defined bucket data along with the creation of the bucket itself.  Bucket files, however, need to be uploaded separately (see [upload_bucket_files](#upload_bucket_files)).

See [Bucket](data-structures.md#bucket) for details on the bucket properties.

### update_bucket

```
POST /api/app/update_bucket/v1
```

This updates an existing storage bucket, specified by its ID.  The [edit_buckets](privileges.md#edit_buckets) privilege is required, as well as a valid user session or API Key.  The request must be sent as an HTTP POST with a JSON body.  See [Bucket](data-structures.md#bucket) for details on the input properties.  The request is "shallow-merged" into the existing bucket, so you can provide a sparse set of properties to update.  Here is an example request:

```json
{
	"id": "bme4wi6pg35",
	"title": "The Void",
	"data": {
		"foo": "Hello this is a bucket"
	}
}
```

And an example response:

```json
{
	"code": 0
}
```

The above example would update the `title` and `data` of the bucket with ID `bme4wi6pg35`.  The other properties in the bucket will not be touched (except for `modified` which is always updated, and some other internal properties).

### delete_bucket

```
POST /api/app/delete_bucket/v1
```

This deletes a storage bucket, including all data and files, specified by its ID. The [delete_buckets](privileges.md#delete_buckets) privilege is required, as well as a valid user session or API Key. The request must be sent as an HTTP POST with a JSON body. The input parameters are as follows:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the bucket to delete. |

Here is an example request:

```json
{
	"id": "bme4wi6pg35"
}
```

And an example response:

```json
{
	"code": 0
}
```

Deletions are permanent and cannot be undone.

### upload_bucket_files

```
POST /api/app/upload_bucket_files/v1
```

This API allows you to upload files into a storage bucket.  Unlike most of the other APIs, this one handles files, so it requires a `multipart/form-data` style request.  The parameters should be actual HTTP POST parameters, rather than JSON keys.  The [edit_buckets](privileges.md#edit_buckets) privilege is required, as well as a valid user session or API Key.  The input parameters are as follows:

| Property Name | Type | Description |
|---------------|------|-------------|
| `bucket` | String | **(Required)** The alphanumeric ID of the bucket to upload files to. |

The file properties are automatically set based on the user files themselves, including the filename, file size, etc.  The `bucket` parameter is used to specify the target bucket for the upload.

Note that bucket files are automatically added or replaced based on their normalized filenames.  Normalization involves converting anything other than alphanumerics, dashes and periods to underscores, and converting the filename to lowercase.

### delete_bucket_file

```
POST /api/app/delete_bucket_file/v1
```

This API deletes a file from a storage bucket. The [edit_buckets](privileges.md#edit_buckets) privilege is required, as well as a valid user session or API Key. The request must be sent as an HTTP POST with a JSON body. The input parameters are as follows:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the bucket to delete the file from. |
| `filename` | String | **(Required)** The normalized filename of the file to delete. |
	
Here is an example request:

```json
{
	"id": "bme4wi6pg35",
	"filename": "test.png"
}
```

And an example response:

```json
{
	"code": 0
}
```

Deletions are permanent and cannot be undone.

## Categories

### get_categories

```
GET /api/app/get_categories/v1
```

Fetch all category definitions. No input parameters are required. No specific privilege is required beyond a valid user session or API Key. In addition to the [Standard Response Format](#standard-response-format), the response includes a `rows` array of categories and a `list` object with summary metadata. The `list.length` value is the total number of categories (without pagination).

Example response:

```json
{
    "code": 0,
    "rows": [
        {
            "id": "general",
            "title": "General",
            "enabled": true,
            "sort_order": 0,
            "username": "admin",
            "modified": 1754365754,
            "created": 1754365754,
            "notes": "For events that don't fit anywhere else.",
            "color": "plain",
            "icon": "",
            "limits": [],
            "actions": [],
            "revision": 1
        }
        
    ],
    "list": { "length": 1 }
}
```

See [Category](data-structures.md#category) for details on category properties.

### get_category

```
GET /api/app/get_category/v1
```

Fetch a single category definition by ID. No specific privilege is required beyond a valid user session or API Key. Both HTTP GET with query string parameters and HTTP POST with JSON are accepted. Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the category to fetch. |

Example request:

```json
{
    "id": "general"
}
```

Example response:

```json
{
    "code": 0,
    "category": {
        "id": "general",
        "title": "General",
        "enabled": true,
        "sort_order": 0,
        "username": "admin",
        "modified": 1754365754,
        "created": 1754365754,
        "notes": "For events that don't fit anywhere else.",
        "color": "plain",
        "icon": "",
        "limits": [],
        "actions": [],
        "revision": 1
    }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `category` property containing the requested category definition.  See [Category](data-structures.md#category) for details on category properties.

### create_category

```
POST /api/app/create_category/v1
```

Create a new category. Requires the [create_categories](privileges.md#create_categories) privilege and category-level access to the specified ID (for category-limited accounts), plus a valid user session or API Key. Send as HTTP POST with JSON. See [Category](data-structures.md#category) for property details. The `id` may be omitted and will be auto-generated; `username`, `created`, `modified`, `revision`, and `sort_order` are set by the server.

Example request:

```json
{
    "title": "General",
    "enabled": true,
    "color": "plain",
    "icon": "",
    "notes": "For events that don't fit anywhere else.",
    "limits": [],
    "actions": []
}
```

Example response:

```json
{
    "code": 0,
    "category": { /* full category object including auto-generated fields */ }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `category` property containing the full category object including auto-generated fields.

Notes:

- The server validates [Limits](data-structures.md#limit) and [Actions](data-structures.md#action).
- `sort_order` is automatically assigned at the end of the current list.

### update_category

```
POST /api/app/update_category/v1
```

Update an existing category by ID. Requires the [edit_categories](privileges.md#edit_categories) privilege and category-level access to the specified ID (for category-limited accounts), plus a valid user session or API Key. Send as HTTP POST with JSON. The request is shallow-merged into the existing category, so you can provide a sparse set of properties to update. The server updates `modified` and increments `revision` automatically.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The category ID to update. |
| (Other) | Various | Any updatable [Category](data-structures.md#category) fields (e.g. `title`, `enabled`, `color`, `notes`, `limits`, `actions`). |

Example request:

```json
{
    "id": "general",
    "title": "General Jobs",
    "color": "blue"
}
```

Example response:

```json
{
    "code": 0
}
```

See [Limit](data-structures.md#limit) and [Action](data-structures.md#action) for nested structures.

### delete_category

```
POST /api/app/delete_category/v1
```

Delete an existing category by ID. Requires the [delete_categories](privileges.md#delete_categories) privilege and category-level access to the specified ID (for category-limited accounts), plus a valid user session or API Key. Deletion is blocked if any [Events](data-structures.md#event) are assigned to the category.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The category ID to delete. |

Example request:

```json
{
    "id": "general"
}
```

Example response:

```json
{
    "code": 0
}
```

Deletions are permanent and cannot be undone.

### multi_update_category

```
POST /api/app/multi_update_category/v1
```

Update multiple categories in a single call. This endpoint is intended for updating `sort_order` only (e.g., after drag-and-drop reordering in the UI). Requires the [edit_categories](privileges.md#edit_categories) privilege and category-level access to all categories (`*`), plus a valid user session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `items` | Array<Object> | **(Required)** Array of objects, each with an `id` and the new `sort_order`. |

Example request:

```json
{
    "items": [
        { "id": "general", "sort_order": 0 },
        { "id": "logs",    "sort_order": 1 }
    ]
}
```

Example response:

```json
{
    "code": 0
}
```

Notes:

- Only `sort_order` is updated by this endpoint.
- `modified` and `revision` are not updated by design for multi-updates of sort order.



## Channels

### get_channels

```
GET /api/app/get_channels/v1
```

Fetch all notification channel definitions. No input parameters are required. No specific privilege is required beyond a valid user session or API Key.

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing all channels, and a `list` object containing list metadata (e.g. `length` for total rows without pagination).

Example response:

```json
{
    "code": 0,
    "rows": [
        {
            "id": "sev1",
            "title": "Severity 1",
            "enabled": true,
            "username": "admin",
            "modified": 1754603045,
            "created": 1754365754,
            "notes": "For major events that require everyone's attention right away.",
            "users": ["admin"],
            "email": "",
            "web_hook": "",
            "run_event": "",
            "sound": "attention-3.mp3",
            "icon": "",
            "revision": 3,
            "max_per_day": 0
        }
        
    ],
    "list": { "length": 1 }
}
```

See [Channel](data-structures.md#channel) for details on channel properties.

### get_channel

```
GET /api/app/get_channel/v1
```

Fetch a single channel definition by ID. No specific privilege is required beyond a valid user session or API Key. Both HTTP GET with query string parameters and HTTP POST with JSON are accepted.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the channel to fetch. |

Example request:

```json
{
    "id": "sev1"
}
```

Example response:

```json
{
    "code": 0,
    "channel": {
        "id": "sev1",
        "title": "Severity 1",
        "enabled": true,
        "username": "admin",
        "modified": 1754603045,
        "created": 1754365754,
        "notes": "For major events that require everyone's attention right away.",
        "users": ["admin"],
        "email": "",
        "web_hook": "",
        "run_event": "",
        "sound": "attention-3.mp3",
        "icon": "",
        "revision": 3,
        "max_per_day": 0
    }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `channel` object containing the requested channel.

See [Channel](data-structures.md#channel) for details on channel properties.

### create_channel

```
POST /api/app/create_channel/v1
```

Create a new notification channel. Requires the [create_channels](privileges.md#create_channels) privilege, plus a valid user session or API Key. Send as HTTP POST with JSON. See [Channel](data-structures.md#channel) for property details. The `id` may be omitted and will be auto-generated; `username`, `created`, `modified`, and `revision` are set by the server.

Example request:

```json
{
    "title": "Severity 1",
    "enabled": true,
    "notes": "For major events that require everyone's attention right away.",
    "users": ["admin"],
    "email": "",
    "web_hook": "",
    "run_event": "",
    "sound": "attention-3.mp3",
    "icon": "",
    "max_per_day": 0
}
```

Example response:

```json
{
    "code": 0,
    "channel": { /* full channel object including auto-generated fields */ }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `channel` object containing the newly created channel.

### update_channel

```
POST /api/app/update_channel/v1
```

Update an existing channel by ID. Requires the [edit_channels](privileges.md#edit_channels) privilege, plus a valid user session or API Key. Send as HTTP POST with JSON. The request is shallow-merged into the existing channel, so you can provide a sparse set of properties to update. The server updates `modified` and increments `revision` automatically.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The channel ID to update. |
| (Other) | Various | Any updatable [Channel](data-structures.md#channel) fields (e.g. `title`, `enabled`, `users`, `email`, `web_hook`, `run_event`, `sound`, `icon`, `max_per_day`, `notes`). |

Example request:

```json
{
    "id": "sev1",
    "title": "Severity 1 Alerts",
    "max_per_day": 5
}
```

Example response:

```json
{
    "code": 0
}
```

### delete_channel

```
POST /api/app/delete_channel/v1
```

Delete an existing channel by ID. Requires the [delete_channels](privileges.md#delete_channels) privilege, plus a valid user session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The channel ID to delete. |

Example request:

```json
{
    "id": "sev1"
}
```

Example response:

```json
{
    "code": 0
}
```

Deletions are permanent and cannot be undone.



## Events

### get_events

```
GET /api/app/get_events/v1
```

Fetch all event definitions. No input parameters are required. No specific privilege is required beyond a valid user session or API Key.

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing all events, and a `list` object containing list metadata (e.g. `length` for total rows without pagination).

Example response:

```json
{
    "code": 0,
    "rows": [
        {
            "id": "event100",
            "title": "Diverse heuristic complexity",
            "enabled": true,
            "username": "admin",
            "modified": 1653843747,
            "created": 1651348186,
            "category": "cat9",
            "targets": ["main"],
            "notes": "This is a test event.",
            "limits": [
                { "type": "time", "enabled": true, "duration": 3600 }
            ],
            "actions": [
                { "enabled": true, "condition": "error", "type": "email", "email": "admin@localhost" }
            ],
            "plugin": "shellplug",
            "params": { "script": "#!/bin/bash\n\nsleep 30;\necho HELLO;\n", "annotate": false, "json": false },
            "triggers": [
                { "type": "schedule", "enabled": true, "hours": [19], "minutes": [6] }
            ],
            "icon": "",
            "tags": ["important"],
            "algo": "random"
        }
        
    ],
    "list": { "length": 1 }
}
```

See [Event](data-structures.md#event) for details on event properties.

### get_event

```
GET /api/app/get_event/v1
```

Fetch a single event definition by ID. No specific privilege is required beyond a valid user session or API Key. Both HTTP GET with query string parameters and HTTP POST with JSON are accepted.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the event to fetch. |

Example request:

```json
{
    "id": "event100"
}
```

Example response:

```json
{
    "code": 0,
    "event": { /* full event object */ },
    "jobs": [ /* currently active jobs for this event */ ],
    "queued": 0
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include an `event` object containing the requested event, a `jobs` array of currently running jobs for the event, and a `queued` number indicating the count of queued jobs.

See [Event](data-structures.md#event) for details on event properties, and [Job](data-structures.md#job) for job properties.

### get_event_history

```
GET /api/app/get_event_history/v1
```

Fetch the revision history for a specific event from the activity log. Requires a valid user session or API Key, and category/target access to the event.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The event ID to fetch history for. |
| `offset` | Number | Optional row offset for pagination. Defaults to `0`. |
| `limit` | Number | Optional row limit for pagination. Defaults to `1`. |
| `sort_by` | String | Optional sort field. Defaults to `_id`. |
| `sort_dir` | Number | Optional sort direction. Use `-1` for descending (default) or `1` for ascending. |

Example request:

```json
{
    "id": "event100",
    "offset": 0,
    "limit": 50
}
```

Example response:

```json
{
    "code": 0,
    "rows": [
        { "action": "event_update", "username": "admin", "description": "Updated title", "date": 1754784000 }
        
    ],
    "list": { "length": 1 }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array of activity records related to the event, and a `list` object with pagination metadata.

### create_event

```
POST /api/app/create_event/v1
```

Create a new event. Requires the [create_events](privileges.md#create_events) privilege, plus category/target access for the event, and a valid user session or API Key. Send as HTTP POST with JSON. See [Event](data-structures.md#event) for property details. The `id` may be omitted and will be auto-generated; `username`, `created`, and `modified` are set by the server.

Notes:

- For non-workflow events, `targets` and `plugin` are required.
- For workflow events (`type: "workflow"`), the server sets `plugin` to `_workflow` and requires a `workflow` object; `targets` are not required.
- Locked plugin/event parameters are enforced for non-admins and required fields are validated.

Example request (non-workflow event):

```json
{
    "title": "Diverse heuristic complexity",
    "enabled": true,
    "category": "cat9",
    "targets": ["main"],
    "plugin": "shellplug",
    "params": { "script": "#!/bin/bash\necho HELLO\n" },
    "triggers": [ { "type": "manual", "enabled": true } ]
}
```

Example response:

```json
{
    "code": 0,
    "event": { /* full event object including auto-generated fields */ }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include an `event` object containing the newly created event.

### update_event

```
POST /api/app/update_event/v1
```

Update an existing event by ID. Requires the [edit_events](privileges.md#edit_events) privilege, plus category/target access to the event, and a valid user session or API Key. Send as HTTP POST with JSON. The request is shallow-merged into the existing event, so you can provide a sparse set of properties to update. The server updates `modified` and increments `revision` automatically.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The event ID to update. |
| (Other) | Various | Any updatable [Event](data-structures.md#event) fields (e.g. `title`, `enabled`, `category`, `targets`, `algo`, `plugin`, `params`, `triggers`, `limits`, `actions`, `notes`). |

Special behavior:

- Non-admins have locked plugin/event parameters enforced; required fields must be present.
- You can update per-event state by passing `update_state` as an object of key/value pairs. These are stored in event state and removed from the event record itself.

Example request:

```json
{
    "id": "event100",
    "title": "Diverse heuristic complexity (v2)",
    "limits": [ { "type": "time", "enabled": true, "duration": 1800 } ],
    "update_state": { "cursor": 1234 }
}
```

Example response:

```json
{
    "code": 0
}
```

The `update_state` is used to reset the event's time cursor for [Catch-Up](events.md#catch-up) mode.

### delete_event

```
POST /api/app/delete_event/v1
```

Delete an existing event by ID. Requires the [delete_events](privileges.md#delete_events) privilege, plus category/target access to the event, and a valid user session or API Key. Deletion is blocked if any jobs are active for the event. You may optionally request deletion of all historical jobs for the event.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The event ID to delete. |
| `delete_jobs` | Boolean | Optional. If `true`, delete all historical jobs for the event (performed in background). |

Example request:

```json
{
    "id": "event100",
    "delete_jobs": true
}
```

Example response:

```json
{
    "code": 0
}
```

Deletions are permanent and cannot be undone.

### run_event

```
POST /api/app/run_event/v1
```

Run an event on demand with optional overrides and optional file uploads. Requires the [run_jobs](privileges.md#run_jobs) privilege, plus category/target access to the event, and a valid user session or API Key.

Manual run rules:

- The event must have an enabled `manual` trigger, unless you pass `test: true`.
- Disabled events cannot be run unless you pass `test: true`.

Input formats:

- Pure JSON: Send `Content-Type: application/json` with a JSON body.
- Multipart form-data (for file uploads): Send `Content-Type: multipart/form-data` and include a `json` field containing the full JSON payload (as a string), plus one or more file fields. All uploaded files are attached to `input.files` for the job.

Parameters (core):

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | The event ID to run. One of `id` or `title` is required. |
| `title` | String | The event title to run (alternative to `id`). |
| `params` | Object | Optional overrides for [Event.params](data-structures.md#event-params). Missing keys fall back to the event's saved params. |
| `input` | Object | Optional input object; may include `data` and/or `files` (see [Job.input](data-structures.md#job-input)). Uploaded files are appended to `input.files`. |
| `test` | Boolean | If `true`, bypasses manual-trigger and enabled checks and marks the job as a test. |

Additional behaviors:

- Nested keys using `parent/child` can be supplied as flat parameters (e.g. `params/foo=bar`).
- When using multipart uploads, the `json` field should contain the exact JSON you would otherwise POST.
- If the `post_data` query parameter is present, all raw POST fields are placed under `post_data` instead of being merged (advanced usage).
- Non-admins have locked plugin/event parameters enforced; required fields must be present.

Example: JSON POST (no files)

```json
{
    "id": "event100",
    "params": { "foo": "bar" },
    "input": { "data": { "greeting": "hello" } }
}
```

Example: multipart/form-data with files

```
POST /api/app/run_event/v1
Content-Type: multipart/form-data; boundary=----XYZ

------XYZ
Content-Disposition: form-data; name="json"

{"id":"event100","params":{"foo":"bar"}}
------XYZ
Content-Disposition: form-data; name="file1"; filename="input.csv"
Content-Type: text/csv

id,value\n1,alpha\n2,beta\n
------XYZ
Content-Disposition: form-data; name="file2"; filename="notes.txt"
Content-Type: text/plain

hello world
------XYZ--
```

Example response:

```json
{
    "code": 0,
    "id": "jabc123def" 
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include an `id` property containing the newly created [Job.id](data-structures.md#job-id).



## Files

### upload_files

```
POST /api/app/upload_files/v1
```

Upload one or more files for the authenticated user. This is a general-purpose upload endpoint (not tied to any specific job). Requires a valid user session or API Key. Use `multipart/form-data` with one or more file fields.

Notes:

- Files are stored under a user-specific path and automatically expire per server configuration (see [file_expiration](configuration.md#file_expiration)).
- Field names are arbitrary; all files in the request are processed.

In addition to the [Standard Response Format](#standard-response-format), this will include a `urls` array of absolute URLs for the uploaded files.

Example response:

```json
{
    "code": 0,
    "urls": [
        "https://example.xyops.io/files/admin/report.csv"
    ]
}
```

### upload_job_file

```
POST /api/app/upload_job_file/v1
```

Upload a file and associate it with a running job. This endpoint is primarily used by the satellite agent (xySat), and is not designed for external use. Requires authentication via one of three methods below and `multipart/form-data` with a single file field named `file1`.

Authentication methods:

- API Key: Provide a valid API key via standard mechanisms (e.g., `X-API-Key` header or `api_key` param). For convenience, you may also pass it in an `auth` parameter.
- Server token: Provide `server` (Server ID) and `auth` (a server token). The satellite computes this token; it’s verified by the primary.
- Job token: Provide `auth` computed for the job. The satellite computes this token; it’s verified by the primary.

Parameters (form + query):

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The running [Job.id](data-structures.md#job-id). |
| `auth` | String | **(Required)** Authentication token or API key (see above). |
| `server` | String | Optional. Required only for the server token method. |
| `file1` | File | **(Required)** The uploaded file content (multipart field name must be `file1`). |

Example multipart request (pseudocode):

```
POST /api/app/upload_job_file/v1?id=jabc123def&auth=...&server=main
Content-Type: multipart/form-data; boundary=----XYZ

------XYZ
Content-Disposition: form-data; name="file1"; filename="log.txt"
Content-Type: text/plain

hello
------XYZ--
```

Example response:

```json
{
    "code": 0,
    "key": "files/jobs/jabc123def/Y2Jh.../log.txt",
    "size": 5338
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `key` (storage path) and `size` (bytes). You can later fetch the file with `GET /{key}` relative to your base URL (see [file](#file)).

### delete_job_file

```
POST /api/app/delete_job_file/v1
```

Delete a file previously attached to a job. Requires a valid session or API Key with the [delete_jobs](privileges.md#delete_jobs) privilege, and category/target access to the job’s event. Supports HTTP POST with JSON, or HTTP GET with query parameters.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The [Job.id](data-structures.md#job-id). |
| `path` | String | **(Required)** The exact storage path of the file to delete.  Must be a file attached to the specified job. |

Example request:

```json
{
    "id": "jabc123def",
    "path": "files/jobs/jabc123def/Y2Jh.../log.txt"
}
```

Example response:

```json
{
    "code": 0
}
```

The file is removed from storage and the job’s `files` list.  To be clear, this API does not allow file deletion given any arbitrary storage path.  The specified `path` must be registered as a file inside the given job object, or else the API returns an error.

### upload_job_input_files

```
POST /api/app/upload_job_input_files/v1
```

Upload one or more files intended as input to a job before it starts (e.g., from the Run Event dialog). Requires a valid session or API Key with the [run_jobs](privileges.md#run_jobs) privilege. Use `multipart/form-data` with one or more file fields.

Notes:

- Files automatically expire per [client.job_upload_settings.user_file_expiration](configuration.md#client-job_upload_settings) in server configuration.
- The response provides metadata that can be supplied to `run_event` under `input.files`.

In addition to the [Standard Response Format](#standard-response-format), this will include a `files` array with metadata for each uploaded file.

Example response:

```json
{
    "code": 0,
    "files": [
        {
            "id": "fme4wijr73h",
            "date": 1754783040,
            "filename": "input.csv",
            "path": "files/admin/bdY8zZ9nKynfFUb4xH6fA/input.csv",
            "size": 92615,
            "username": "admin"
        }
        
    ]
}
```

See [Job.files](data-structures.md#job-files) for how these are consumed by jobs.

### file

```
GET /files/...  or  GET /api/app/file/v1?path=...
```

Serve a file from storage. This is a binary/streaming endpoint (not JSON). It supports full GET, HEAD, conditional requests via `ETag` and `If-Modified-Since`, and HTTP Range requests for partial content. You can access files by direct path under `/files/...`, or via `GET /api/app/file/v1?path=...`.

Parameters (query):

| Property Name | Type | Description |
|---------------|------|-------------|
| `path` | String | When using `/api/app/file/v1`, the relative storage path under `files/` to serve. |
| `download` | String | Optional. If set, forces download. Use `1` to download with the original filename, or supply a custom filename. |

Behavior:

- When content type is or contains `text/html`, downloads are enforced unless `download` is specified, to prevent HTML rendering in the browser.
- Range requests return `206 Partial Content` with `Content-Range` and `Content-Length` headers.
- HEAD requests return headers only, and may return `304 Not Modified` if applicable.

Examples:

- Direct URL: `GET https://example.xyops.io/files/admin/report.csv`
- API form: `GET https://example.xyops.io/api/app/file/v1?path=admin/report.csv&download=1`



## Groups

### get_groups

```
GET /api/app/get_groups/v1
```

Fetch all server groups. No input parameters are required. No specific privilege is required beyond a valid user session or API Key.

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing all groups, and a `list` object containing list metadata (e.g. `length` for total rows without pagination).

Example response:

```json
{
    "code": 0,
    "rows": [
        {
            "id": "main",
            "title": "Main Group",
            "hostname_match": ".+",
            "sort_order": 0,
            "username": "admin",
            "modified": 1754365754,
            "created": 1754365754,
            "revision": 1
        }
        
    ],
    "list": { "length": 1 }
}
```

See [Group](data-structures.md#group) for details on group properties.

### get_group

```
GET /api/app/get_group/v1
```

Fetch a single group definition by ID. No specific privilege is required beyond a valid user session or API Key. Both HTTP GET with query string parameters and HTTP POST with JSON are accepted.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the group to fetch. |

Example request:

```json
{
    "id": "main"
}
```

Example response:

```json
{
    "code": 0,
    "group": {
        "id": "main",
        "title": "Main Group",
        "hostname_match": ".+",
        "sort_order": 0,
        "username": "admin",
        "modified": 1754365754,
        "created": 1754365754,
        "revision": 1
    }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `group` object containing the requested group.

See [Group](data-structures.md#group) for details on group properties.

### create_group

```
POST /api/app/create_group/v1
```

Create a new server group. Requires the [create_groups](privileges.md#create_groups) privilege and group-level access to the specified ID, plus a valid user session or API Key. Send as HTTP POST with JSON. See [Group](data-structures.md#group) for property details. The `id` may be omitted and will be auto-generated; `username`, `created`, `modified`, `revision`, and `sort_order` are set by the server.

Parameters (required fields):

| Property Name | Type | Description |
|---------------|------|-------------|
| `title` | String | **(Required)** Visual name for the group. |
| `hostname_match` | String | **(Required)** A regular expression string used to auto-match servers to the group. |

Example request:

```json
{
    "title": "Main Group",
    "hostname_match": ".+",
    "notes": "Primary workers"
}
```

Example response:

```json
{
    "code": 0,
    "group": { /* full group object including auto-generated fields */ }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `group` object containing the newly created group.

Notes:

- Group alert actions are validated (see [Action](data-structures.md#action)) via `alert_actions`.
- `sort_order` is automatically assigned at the end of the current list.

### update_group

```
POST /api/app/update_group/v1
```

Update an existing group by ID. Requires the [edit_groups](privileges.md#edit_groups) privilege and group-level access to the specified ID, plus a valid user session or API Key. Send as HTTP POST with JSON. The request is shallow-merged into the existing group, so you can provide a sparse set of properties to update. The server updates `modified` and increments `revision` automatically.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The group ID to update. |
| (Other) | Various | Any updatable [Group](data-structures.md#group) fields (e.g. `title`, `hostname_match`, `icon`, `notes`, `alert_actions`). |

Example request:

```json
{
    "id": "main",
    "title": "Main Group (prod)",
    "hostname_match": "^prod-\\w+$"
}
```

Example response:

```json
{
    "code": 0
}
```

### delete_group

```
POST /api/app/delete_group/v1
```

Delete an existing group by ID. Requires the [delete_groups](privileges.md#delete_groups) privilege and group-level access to the specified ID, plus a valid user session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The group ID to delete. |

Example request:

```json
{
    "id": "main"
}
```

Example response:

```json
{
    "code": 0
}
```

Deletions are permanent and cannot be undone.

### multi_update_group

```
POST /api/app/multi_update_group/v1
```

Update multiple groups in a single call. This endpoint is intended for updating `sort_order` only (e.g., after drag-and-drop reordering in the UI). Requires the [edit_groups](privileges.md#edit_groups) privilege and group-level access to all groups (`*`), plus a valid user session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `items` | Array<Object> | **(Required)** Array of objects, each with an `id` and the new `sort_order`. |

Example request:

```json
{
    "items": [
        { "id": "main",   "sort_order": 0 },
        { "id": "staging", "sort_order": 1 }
    ]
}
```

Example response:

```json
{
    "code": 0
}
```

Notes:

- Only `sort_order` is updated by this endpoint.
- `modified` and `revision` are not updated by design for multi-updates of sort order.

### watch_group

```
POST /api/app/watch_group/v1
```

Start or stop a watch on a group, which takes a snapshot once per minute for a specified duration. Requires the [create_snapshots](privileges.md#create_snapshots) privilege and a valid user session or API Key. Supports HTTP POST with JSON, or HTTP GET with query parameters.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The group ID to watch. |
| `duration` | Number | **(Required)** Duration in seconds. Set to `0` to cancel an existing watch. |

Example request:

```json
{
    "id": "main",
    "duration": 3600
}
```

Example response:

```json
{
    "code": 0
}
```

See [Snapshots](snapshots.md) for more details.

### create_group_snapshot

```
POST /api/app/create_group_snapshot/v1
```

Create a snapshot for the specified group using the most recent server data. Requires the [create_snapshots](privileges.md#create_snapshots) privilege and a valid user session or API Key. Supports HTTP POST with JSON, or HTTP GET with query parameters.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `group` | String | **(Required)** The group ID for which to create a snapshot. |

Example request:

```json
{
    "group": "main"
}
```

Example response:

```json
{
    "code": 0,
    "id": "snmhr6zkefh1"
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include an `id` property containing the new [GroupSnapshot.id](data-structures.md#groupsnapshot-id).

See [Snapshots](snapshots.md) for more details.



## Jobs

### get_active_jobs

```
GET /api/app/get_active_jobs/v1
```

Fetch active jobs with optional filters, pagination and sorting. Active jobs include states such as `queued`, `ready`, `active`, and `finishing`. Requires a valid user session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `offset` | Number | Optional row offset. Defaults to `0`. |
| `limit` | Number | Optional row limit. Defaults to all matching rows. |
| `sort_by` | String | Optional sort field. Defaults to `started`. |
| `sort_dir` | Number | Optional sort direction. Use `-1` for descending (default) or `1` for ascending. |
| other filters | Various | Optional job property filters (e.g., `state`, `event`, `server`, `workflow.job`). |

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing the matching active jobs, and a `list` object containing list metadata (e.g. `length` for total rows without pagination).

Example response:

```json
{
    "code": 0,
    "rows": [ { /* Job */ } ],
    "list": { "length": 1 }
}
```

See [Job](data-structures.md#job) for job properties.

### get_active_job_summary

```
GET /api/app/get_active_job_summary/v1
```

Summarize active jobs by event, grouped by state, source, and targets. Accepts the same optional filters as [get_active_jobs](#get_active_jobs). Requires a valid user session or API Key.

In addition to the [Standard Response Format](#standard-response-format), this will include an `events` object keyed by [Event.id](data-structures.md#event-id), each containing `states`, `sources`, and `targets` counters.

Example response:

```json
{
    "code": 0,
    "events": {
        "event100": {
            "id": "event100",
            "states": { "queued": 2, "active": 1 },
            "sources": { "user": 1, "scheduler": 2 },
            "targets": { "main": 3 }
        }
    }
}
```

### get_workflow_job_summary

```
GET /api/app/get_workflow_job_summary/v1
```

Summarize workflow jobs by node for a given workflow context (e.g., a particular top-level workflow job). Accepts the same optional filters as [get_active_jobs](#get_active_jobs). Requires a valid user session or API Key.

In addition to the [Standard Response Format](#standard-response-format), this will include a `nodes` object keyed by workflow node ID with counts of matching active jobs per node.

Example response:

```json
{
    "code": 0,
    "nodes": { "nmhr8zbgjiv": 3, "nmhr8zjdtiw": 1 }
}
```

This API is used in the UI to summarize (count) queued jobs per workflow node.

### get_job

```
GET /api/app/get_job/v1
```

Fetch a single job’s details, running or completed. Requires a valid user session or API Key, and category/target access to the job’s event. Both HTTP GET with query string parameters and HTTP POST with JSON are accepted.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The [Job.id](data-structures.md#job-id) to fetch. |
| `remove` | Array | Optional array of property names to exclude from the returned job object (e.g., heavy fields). |

Example request:

```json
{ "id": "jabc123def" }
```

Example response:

```json
{
    "code": 0,
    "token": "Zy8...",
    "job": { /* Job object */ }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `job` object containing the requested job, and a `token` string used for viewing/downloading the job log (see [view_job_log](#view_job_log) and [download_job_log](#download_job_log)).

See [Job](data-structures.md#job) for details on the job object.

### get_jobs

```
POST /api/app/get_jobs/v1
```

Fetch multiple jobs (running or completed) by IDs. Requires a valid user session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `ids` | Array<String> | **(Required)** Array of [Job.id](data-structures.md#job-id) values. |
| `verbose` | Boolean | Optional. If `true`, includes heavy fields; otherwise they are pruned. |

Example request:

```json
{
    "ids": ["jabc123def", "jdef456ghi"],
    "verbose": false
}
```

Example response:

```json
{
    "code": 0,
    "jobs": [
        { /* Job 1 (pruned by default) */ },
        { /* Job 2 (pruned by default) */ }
    ]
}
```

Notes:

- When `verbose` is not set, the following heavy fields are removed: `actions`, `activity`, `html`, `limits`, `procs`, `conns`, `table`, `timelines`, `input`, `data`, `files`.
- See [Job](data-structures.md#job) for details on the job object.

### get_job_log

```
GET /api/app/get_job_log/v1
```

Stream a job’s log as plain text. Requires a valid user session (session auth).

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The [Job.id](data-structures.md#job-id). |

Response:

- Returns HTTP `200 OK` with `Content-Type: text/plain; charset=utf-8`. For archived logs it may include `Content-Encoding: gzip`.
- Returns `204 No Content` if no log is available.

### view_job_log

```
GET /api/app/view_job_log/v1?id=JOB_ID&t=TOKEN
```

View a job’s log (plain text) via token authentication. This is useful for shareable links. Obtain the `t` token from [get_job](#get_job) response.

Parameters (query):

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The [Job.id](data-structures.md#job-id). |
| `t` | String | **(Required)** The download token from [get_job](#get_job). |

Response:

- Returns HTTP `200 OK` with `Content-Type: text/plain; charset=utf-8`. For archived logs it may include `Content-Encoding: gzip`.
- Returns `404 Not Found` if no log is available, or `403 Forbidden` if the token is invalid.

### download_job_log

```
GET /api/app/download_job_log/v1?id=JOB_ID&t=TOKEN
```

Download a job’s log as a file via token authentication. Obtain the `t` token from [get_job](#get_job) response.

Parameters (query):

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The [Job.id](data-structures.md#job-id). |
| `t` | String | **(Required)** The download token from [get_job](#get_job). |

Response:

- Returns HTTP `200 OK` with `Content-Type: text/plain; charset=utf-8` and a `Content-Disposition` suggesting a filename. For archived logs it may include `Content-Encoding: gzip`.
- Returns `404 Not Found` if no log is available, or `403 Forbidden` if the token is invalid.

### tail_live_job_log

```
GET /api/app/tail_live_job_log/v1
```

Return a tail chunk of a live job’s log (end-aligned ~32KB) to prime the real-time log viewer. Requires a valid user session or API Key, and the job must be active.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The [Job.id](data-structures.md#job-id). |
| `bytes` | Number | Optional. Approximate number of bytes to return from the end. Defaults to `32678` (32K). |

Example response:

```json
{
    "code": 0,
    "text": "...last lines of log..."
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `text` string containing the tail of the live log. If the job is not active, `text` will be empty.

### update_job

```
POST /api/app/update_job/v1
```

Admin-only. Update a running or completed job. This is a powerful API intended for administrative corrections and metadata updates. Requires the [admin](privileges.md#admin) privilege.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The [Job.id](data-structures.md#job-id). |
| (Other) | Various | Any writable job fields to update. Running jobs are updated in-memory; completed jobs are updated in storage. |

Example response:

```json
{ "code": 0 }
```

Use with care. This can alter persisted job history.

### resume_job

```
POST /api/app/resume_job/v1
```

Resume a suspended active job. Requires the [run_jobs](privileges.md#run_jobs) privilege and a valid session or API Key, plus category/target access to the job’s event. The job must be active and currently suspended.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The [Job.id](data-structures.md#job-id). |
| `params` | Object | Optional. User parameters to merge into the job’s `params` when resuming. |

Behavior:

- Fails if the job is not active or not suspended.
- Records suspension metadata (duration, resumed at/by, IPs, user agent) in the job’s suspend action details for audit.
- If provided, merges `params` into current job parameters upon resume.  This is used to collect user parameters in the UI at resume time.

Example request:

```json
{
    "id": "jabc123def",
    "params": { "example": 12345 }
}
```

Example response:

```json
{ "code": 0 }
```

### job_toggle_notify_me

```
POST /api/app/job_toggle_notify_me/v1
```

Toggle a completion notification e-mail for the current user on an active job. Requires a valid user session (with an email address set).

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The [Job.id](data-structures.md#job-id). |

Example response:

```json
{
    "code": 0,
    "enabled": true
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include an `enabled` boolean indicating the new toggle state.

### manage_job_tags

```
POST /api/app/manage_job_tags/v1
```

Replace the tags on a completed job. Requires the [tag_jobs](privileges.md#tag_jobs) privilege and a valid session or API Key. Cannot be used on running jobs.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The [Job.id](data-structures.md#job-id). |
| `tags` | Array<String> | **(Required)** Full replacement list of tags for the job. |

Example request:

```json
{
    "id": "jabc123def",
    "tags": ["ops", "nightly"]
}
```

Example response:

```json
{ "code": 0 }
```

Notes:

- The job’s activity log is appended to with a summary of tag changes.

### abort_job

```
POST /api/app/abort_job/v1
```

Abort a running job. Requires the [abort_jobs](privileges.md#abort_jobs) privilege and a valid session or API Key, plus category/target access to the job’s event.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The [Job.id](data-structures.md#job-id). |

Example response:

```json
{ "code": 0 }
```

### delete_job

```
POST /api/app/delete_job/v1
```

Delete a completed job, including logs and files. Requires the [delete_jobs](privileges.md#delete_jobs) privilege and a valid session or API Key, plus category/target access. Cannot delete active jobs.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The [Job.id](data-structures.md#job-id). |

Example response:

```json
{ "code": 0 }
```

Deletions are permanent and cannot be undone.

### flush_event_queue

```
POST /api/app/flush_event_queue/v1
```

Flush all queued jobs for an event without triggering completion actions. Requires the [abort_jobs](privileges.md#abort_jobs) privilege and a valid session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The [Event.id](data-structures.md#event-id) whose queue to flush. |

Example response:

```json
{
    "code": 0,
    "count": 3
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `count` property indicating how many queued jobs were removed.



## Monitors

### get_monitors

```
GET /api/app/get_monitors/v1
```

Fetch all monitor definitions. No input parameters are required. No specific privilege is required beyond a valid user session or API Key.

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing all monitors, and a `list` object containing list metadata (e.g. `length` for total rows without pagination).

Example response:

```json
{
    "code": 0,
    "rows": [
        {
            "id": "cpu_usage",
            "title": "CPU Usage %",
            "source": "cpu.currentLoad",
            "data_type": "float",
            "suffix": "%",
            "groups": [],
            "display": true,
            "min_vert_scale": 100,
            "sort_order": 1,
            "username": "admin",
            "modified": 1754365754,
            "created": 1754365754,
            "revision": 1
        }
        
    ],
    "list": { "length": 1 }
}
```

See [Monitor](data-structures.md#monitor) for details on monitor properties.

### get_monitor

```
GET /api/app/get_monitor/v1
```

Fetch a single monitor definition by ID. No specific privilege is required beyond a valid user session or API Key. HTTP POST with JSON is also accepted.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the monitor to fetch. |

Example response:

```json
{
    "code": 0,
    "monitor": {
        "id": "cpu_usage",
        "title": "CPU Usage %",
        "source": "cpu.currentLoad",
        "data_type": "float",
        "suffix": "%",
        "groups": [],
        "display": true,
        "min_vert_scale": 100,
        "sort_order": 1,
        "username": "admin",
        "modified": 1754365754,
        "created": 1754365754,
        "revision": 1
    }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `monitor` object containing the requested monitor.

See [Monitor](data-structures.md#monitor) for details on monitor properties.

### create_monitor

```
POST /api/app/create_monitor/v1
```

Create a new monitor. Requires the [create_monitors](privileges.md#create_monitors) privilege and a valid user session or API Key. Send as HTTP POST with JSON. See [Monitor](data-structures.md#monitor) for property details. The `id` may be omitted and will be auto-generated; `username`, `created`, `modified`, `revision`, and `sort_order` are set by the server.

Validation and behavior:

- The `source` expression is validated; syntax errors are rejected.
- If `data_match` is provided, it must compile as a valid regular expression.
- `sort_order` is automatically assigned at the end of the current list.

Example request:

```json
{
    "title": "CPU Usage %",
    "source": "cpu.currentLoad",
    "data_type": "float",
    "suffix": "%",
    "display": true,
    "min_vert_scale": 100,
    "groups": []
}
```

Example response:

```json
{
    "code": 0,
    "monitor": { /* full monitor object including auto-generated fields */ }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `monitor` object containing the newly created monitor.

### update_monitor

```
POST /api/app/update_monitor/v1
```

Update an existing monitor by ID. Requires the [edit_monitors](privileges.md#edit_monitors) privilege and a valid user session or API Key. Send as HTTP POST with JSON. The request is shallow-merged into the existing monitor, so you can provide a sparse set of properties to update. The server updates `modified` and increments `revision` automatically.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The monitor ID to update. |
| (Other) | Various | Any updatable [Monitor](data-structures.md#monitor) fields (e.g. `title`, `source`, `data_type`, `suffix`, `display`, `min_vert_scale`, `groups`, `icon`, `notes`). |

Validation and behavior:

- If `source` is included, it is validated; syntax errors are rejected.
- If `data_match` is included, it must compile as a valid regular expression.

Example response:

```json
{ "code": 0 }
```

### test_monitor

```
POST /api/app/test_monitor/v1
```

Test a monitor configuration (expression and optional `data_match`) against a specific server’s current data. Requires the [edit_monitors](privileges.md#edit_monitors) privilege and a valid user session or API Key. Send as HTTP POST with JSON.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `server` | String | **(Required)** The [Server.id](data-structures.md#server-id) to test against. |
| `source` | String | **(Required)** The [Monitor.source](data-structures.md#monitor-source) expression to evaluate. |
| `data_type` | String | **(Required)** One of `integer`, `float`, `bytes`, `seconds`, or `milliseconds`. |
| `data_match` | String | Optional JavaScript regular expression string to extract a value from text. |

Example request:

```json
{
    "server": "s12345abcde",
    "source": "cpu.currentLoad",
    "data_type": "float"
}
```

Example responses:

```json
{ "code": 0, "value": 37.5 }
```

```json
{ "code": 0, "fail": true }
```

In addition to the [Standard Response Format](#standard-response-format), this will include either a `value` property containing the computed numeric result, or `fail: true` if the expression could not be evaluated.

### delete_monitor

```
POST /api/app/delete_monitor/v1
```

Delete an existing monitor by ID. Requires the [delete_monitors](privileges.md#delete_monitors) privilege and a valid user session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The monitor ID to delete. |

Example response:

```json
{ "code": 0 }
```

Deletions are permanent and cannot be undone.

### multi_update_monitor

```
POST /api/app/multi_update_monitor/v1
```

Update multiple monitors in a single call. This endpoint is intended for updating `sort_order` only (e.g., after drag-and-drop reordering in the UI). Requires the [edit_monitors](privileges.md#edit_monitors) privilege and a valid user session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `items` | Array<Object> | **(Required)** Array of objects, each with an `id` and the new `sort_order`. |

Example request:

```json
{
    "items": [
        { "id": "cpu_usage", "sort_order": 0 },
        { "id": "disk_io",   "sort_order": 1 }
    ]
}
```

Example response:

```json
{ "code": 0 }
```

Notes:

- Only `sort_order` is updated by this endpoint.
- `modified` and `revision` are not updated by design for multi-updates of sort order.

### get_quickmon_data

```
GET /api/app/get_quickmon_data/v1
```

Fetch the current [QuickMonData](data-structures.md#quickmondata) snapshots for servers (last 60 seconds). No specific privilege is required beyond a valid user session or API Key. Useful for dashboards.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `server` | String | Optional. Limit results to a single [Server.id](data-structures.md#server-id). |
| `group` | String | Optional. Limit results to servers in a specific [Group.id](data-structures.md#group-id). |

Example response:

```json
{
    "code": 0,
    "servers": {
        "s12345abcde": [ /* QuickMon entries */ ]
    }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `servers` object keyed by server ID, each value being an array of QuickMon entries.

See [QuickMon](monitors.md#quickmon) for more details on these types of real-time monitors.

### get_latest_monitor_data

```
GET /api/app/get_latest_monitor_data/v1
```

Fetch the latest timeline entries for a specific system on a server, along with the server’s current data snapshot. Requires a valid user session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `server` | String | **(Required)** The [Server.id](data-structures.md#server-id). |
| `sys` | String | **(Required)** The timeline system ID to query (e.g., `hourly`, `daily`, `monthly` or `yearly`). |
| `limit` | Number | **(Required)** The number of timeline entries to return. |

Example response:

```json
{
    "code": 0,
    "rows": [ /* timeline entries */ ],
    "data": { /* server host data snapshot */ }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing [ServerTimelineData](data-structures.md#servertimelinedata) entries, and a `data` object containing the server’s current [ServerMonitorData](data-structures.md#servermonitordata).

See [Monitors](monitors.md) for more details on the monitoring subsystem.

### get_historical_monitor_data

```
GET /api/app/get_historical_monitor_data/v1
```

Fetch historical timeline entries for a specific server. Requires a valid user session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `server` | String | **(Required)** The [Server.id](data-structures.md#server-id). |
| `sys` | String | **(Required)** The timeline system ID to query (e.g., `hourly`, `daily`, `monthly` or `yearly`). |
| `date` | Number | **(Required)** Unix timestamp (seconds) specifying the start of the range of data to fetch. |
| `limit` | Number | **(Required)** The number of timeline entries to return. |

Example response:

```json
{
    "code": 0,
    "rows": [ /* timeline entries */ ]
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing the historical [ServerTimelineData](data-structures.md#servertimelinedata) entries.

See [Monitors](monitors.md) for more details on the monitoring subsystem.



## Plugins

### get_plugins

```
GET /api/app/get_plugins/v1
```

Fetch all plugin definitions. No specific privilege is required, besides a valid user session or API Key.

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing all plugins, and a `list` object containing list metadata (e.g. `length` for total rows without pagination).

Example response:

```json
{
    "code": 0,
    "rows": [
        {
            "id": "shellplug",
            "title": "Shell Script",
            "enabled": true,
            "command": "[shell-plugin]",
            "username": "admin",
            "type": "event",
            "modified": 1754365754,
            "created": 1754365754,
            "params": [
                { "id": "script", "type": "code", "title": "Script Source", "value": "#!/bin/sh\n\n# Enter your shell script code here" },
                { "id": "annotate", "type": "checkbox", "title": "Add Date/Time Stamps to Log", "value": false }
            ],
            "revision": 1
        }
    ],
    "list": { "length": 1 }
}
```

See [Plugin](data-structures.md#plugin) for details on the plugin object and all its properties.

### get_plugin

```
GET /api/app/get_plugin/v1
```

Fetch a single plugin definition by ID. No specific privilege is required, besides a valid user session or API Key. Both a HTTP GET with query string parameters and a HTTP POST with JSON are allowed.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the plugin to fetch. |

Example request:

```json
{ "id": "shellplug" }
```

Example response:

```json
{
    "code": 0,
    "plugin": {
        "id": "shellplug",
        "title": "Shell Script",
        "enabled": true,
        "command": "[shell-plugin]",
        "username": "admin",
        "type": "event",
        "modified": 1754365754,
        "created": 1754365754,
        "params": [
            { "id": "script", "type": "code", "title": "Script Source", "value": "#!/bin/sh\n\n# Enter your shell script code here" },
            { "id": "json", "type": "checkbox", "title": "Interpret JSON in Output", "value": false }
        ],
        "revision": 1
    }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `plugin` object containing the requested plugin.

See [Plugin](data-structures.md#plugin) for details on the plugin properties.

### create_plugin

```
POST /api/app/create_plugin/v1
```

Create a new plugin definition. The [create_plugins](privileges.md#create_plugins) privilege is required, as well as a valid user session or API Key. The request must be sent as an HTTP POST with a JSON body.

See [Plugin](data-structures.md#plugin) for details on the input properties. The `id`, `username`, `created`, `modified` and `revision` properties may be omitted, as they are automatically generated (a unique `id` will be assigned if omitted, and the initial `revision` will be set to `1`). The `type` property must be one of: `event`, `monitor`, `action`, or `scheduler`. If you include [Plugin.params](data-structures.md#plugin-params), they must follow the documented schema and will be validated.

Example request:

```json
{
    "title": "Shell Script",
    "enabled": true,
    "type": "event",
    "command": "[shell-plugin]",
    "params": [
        { "id": "script", "type": "code", "title": "Script Source", "value": "#!/bin/sh\n\n# Enter your shell script code here" },
        { "id": "annotate", "type": "checkbox", "title": "Add Date/Time Stamps to Log", "value": false }
    ]
}
```

Example response:

```json
{
    "code": 0,
    "plugin": { /* full plugin object including auto-generated fields */ }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `plugin` object containing the plugin that was just created (including all the auto-generated properties).

### update_plugin

```
POST /api/app/update_plugin/v1
```

Update an existing plugin definition, specified by its ID. The [edit_plugins](privileges.md#edit_plugins) privilege is required, as well as a valid user session or API Key. The request must be sent as an HTTP POST with a JSON body.

See [Plugin](data-structures.md#plugin) for details on the input properties. The request is shallow-merged into the existing plugin, so you can provide a sparse set of properties to update. The `modified` timestamp is updated automatically, and the `revision` is incremented.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the plugin to update. |
| (Other) | Various | Any updatable [Plugin](data-structures.md#plugin) fields (e.g. `title`, `enabled`, `type`, `command`, `script`, `params`, `groups`, `format`, `uid`, `gid`, `kill`, `icon`, `notes`). |

Example request:

```json
{
    "id": "shellplug",
    "title": "Shell Script (Updated)",
    "enabled": false
}
```

Example response:

```json
{ "code": 0 }
```

The above example would update the `title` and `enabled` properties of the plugin with ID `shellplug`. Other properties will not be touched (aside from `modified` and `revision`, which are updated automatically).

### delete_plugin

```
POST /api/app/delete_plugin/v1
```

Delete an existing plugin definition, specified by its ID. The [delete_plugins](privileges.md#delete_plugins) privilege is required, as well as a valid user session or API Key. The request must be sent as an HTTP POST with a JSON body.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the plugin to delete. |

Example request:

```json
{ "id": "shellplug" }
```

Example response:

```json
{ "code": 0 }
```




## Roles

### get_roles

```
GET /api/app/get_roles/v1
```

Fetch all user role definitions. No specific privilege is required, besides a valid user session or API Key.

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing all roles, and a `list` object containing list metadata (e.g. `length` for total rows without pagination).

Example response:

```json
{
    "code": 0,
    "rows": [
        {
            "id": "all",
            "title": "All Users",
            "enabled": true,
            "username": "admin",
            "modified": 1434125333,
            "created": 1434125333,
            "notes": "A base set of privileges for all users to enjoy.",
            "icon": "",
            "categories": [],
            "groups": [],
            "privileges": {
                "create_events": true,
                "edit_events": true,
                "run_jobs": true,
                "tag_jobs": true,
                "comment_jobs": true
            }
        }
    ],
    "list": { "length": 1 }
}
```

See [Role](data-structures.md#role) for details on the role object and its properties.

### get_role

```
GET /api/app/get_role/v1
```

Fetch a single role definition by ID. No specific privilege is required, besides a valid user session or API Key. Both a HTTP GET with query string parameters and a HTTP POST with JSON are allowed.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the role to fetch. |

Example request:

```json
{ "id": "all" }
```

Example response:

```json
{
    "code": 0,
    "role": {
        "id": "all",
        "title": "All Users",
        "enabled": true,
        "username": "admin",
        "modified": 1434125333,
        "created": 1434125333,
        "notes": "A base set of privileges for all users to enjoy.",
        "icon": "",
        "categories": [],
        "groups": [],
        "privileges": {
            "create_events": true,
            "edit_events": true,
            "run_jobs": true,
            "tag_jobs": true,
            "comment_jobs": true
        }
    }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `role` object containing the requested role.

See [Role](data-structures.md#role) for details on the role properties.

### create_role

```
POST /api/app/create_role/v1
```

Create a new user role. The [create_roles](privileges.md#create_roles) privilege is required, as well as a valid user session or API Key. The request must be sent as an HTTP POST with a JSON body.

See [Role](data-structures.md#role) for details on the input properties. The `id`, `username`, `created`, `modified` and `revision` properties may be omitted, as they are automatically generated (a unique `id` will be assigned if omitted, and the initial `revision` will be set to `1`). If omitted, `privileges` defaults to an empty object, and `categories`/`groups` default to empty arrays.

Example request:

```json
{
    "title": "Operators",
    "enabled": true,
    "icon": "account-hard-hat",
    "notes": "Ops can run jobs and view logs.",
    "categories": ["cat1", "cat2"],
    "groups": ["main"],
    "privileges": {
        "run_jobs": true,
        "view_jobs": true
    }
}
```

Example response:

```json
{
    "code": 0,
    "role": { /* full role object including auto-generated fields */ }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `role` object containing the role that was just created (including all the auto-generated properties).

### update_role

```
POST /api/app/update_role/v1
```

Update an existing user role, specified by its ID. The [edit_roles](privileges.md#edit_roles) privilege is required, as well as a valid user session or API Key. The request must be sent as an HTTP POST with a JSON body.

See [Role](data-structures.md#role) for details on the input properties. The request is shallow-merged into the existing role, so you can provide a sparse set of properties to update. The `modified` timestamp is updated automatically, and the `revision` is incremented.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the role to update. |
| (Other) | Various | Any updatable [Role](data-structures.md#role) fields (e.g. `title`, `enabled`, `categories`, `groups`, `privileges`, `icon`, `notes`). |

Example request:

```json
{
    "id": "operators",
    "title": "Operators (North Region)",
    "categories": ["cat_north"],
    "enabled": true
}
```

Example response:

```json
{ "code": 0 }
```

The above example would update the `title`, `categories` and `enabled` properties of the role with ID `operators`. Other properties will not be modified (aside from `modified` and `revision`, which are updated automatically).

### delete_role

```
POST /api/app/delete_role/v1
```

Delete an existing user role, specified by its ID. The [delete_roles](privileges.md#delete_roles) privilege is required, as well as a valid user session or API Key. The request must be sent as an HTTP POST with a JSON body.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the role to delete. |

Example request:

```json
{ "id": "operators" }
```

Example response:

```json
{ "code": 0 }
```




## Search

### search_jobs

```
GET /api/app/search_jobs/v1
```

Search completed jobs. Requires a valid user session or API Key. Results are automatically filtered by the caller’s category and group access rights.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `query` | String | Optional. [Unbase-style search query](https://github.com/jhuckaby/pixl-server-storage/blob/master/docs/Indexer.md#simple-queries). Defaults to `*` if omitted. |
| `offset` | Number | Optional. Zero-based row offset for pagination. Defaults to `0`. |
| `limit` | Number | Optional. Number of rows to return. Defaults to `1`. |
| `sort_by` | String | Optional. Field to sort by. Defaults to `completed`. |
| `sort_dir` | Number | Optional. Sort direction: `1` for ascending or `-1` for descending. Defaults to `-1`. |
| `verbose` | Boolean | Optional. If `true`, include verbose job fields (`actions`, `activity`, `input`, `files`, etc.). Defaults to `false` (i.e. these are pruned). |

Example response:

```json
{
    "code": 0,
    "rows": [
        {
            "id": "jabc123",
            "event": "ev12345",
            "title": "Nightly Database Backup",
            "category": "ops",
            "plugin": "shellplug",
            "type": "event",
            "completed": 1757439210,
            "code": 0
        }
    ],
    "list": { "length": 287 }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing [Job](data-structures.md#job) records, and a `list` object containing list metadata (e.g. `length` for total rows without pagination). When `verbose` is not set, large fields are pruned from the job records.

### search_servers

```
GET /api/app/search_servers/v1
```

Search historical server records. Requires a valid user session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `query` | String | Optional. [Unbase-style search query](https://github.com/jhuckaby/pixl-server-storage/blob/master/docs/Indexer.md#simple-queries). Defaults to `*`. |
| `offset` | Number | Optional. Zero-based row offset for pagination. Defaults to `0`. |
| `limit` | Number | Optional. Number of rows to return. Defaults to `1`. |
| `sort_by` | String | Optional. Field to sort by. Defaults to `_id`. |
| `sort_dir` | Number | Optional. Sort direction: `1` for ascending or `-1` for descending. Defaults to `-1`. |

Example response:

```json
{
    "code": 0,
    "rows": [ /* server records */ ],
    "list": { "length": 42 }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing [Server](data-structures.md#server) records, and a `list` object containing list metadata.

### get_server_summaries

```
GET /api/app/get_server_summaries/v1
```

Fetch field summaries across all indexed servers (e.g., OS and CPU distributions). Requires a valid user session or API Key.

No input parameters.

Example response:

```json
{
    "code": 0,
    "summaries": {
        "os_platform": { /* value → count map */ },
        "os_distro": { /* value → count map */ },
        "os_release": { /* value → count map */ },
        "os_arch": { /* value → count map */ },
        "cpu_virt": { /* value → count map */ },
        "cpu_brand": { /* value → count map */ },
        "cpu_cores": { /* value → count map */ }
    }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `summaries` object keyed by field ID, each containing a value-to-count map for that field.

### search_alerts

```
GET /api/app/search_alerts/v1
```

Search historical or active alert invocations. Requires a valid user session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `query` | String | Optional. [Unbase-style search query](https://github.com/jhuckaby/pixl-server-storage/blob/master/docs/Indexer.md#simple-queries). Defaults to `*`. |
| `offset` | Number | Optional. Zero-based row offset for pagination. Defaults to `0`. |
| `limit` | Number | Optional. Number of rows to return. Defaults to `1`. |
| `sort_by` | String | Optional. Field to sort by. Defaults to `_id`. |
| `sort_dir` | Number | Optional. Sort direction: `1` for ascending or `-1` for descending. Defaults to `-1`. |

Example response:

```json
{
    "code": 0,
    "rows": [ /* alert records */ ],
    "list": { "length": 12 }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing [AlertInvocation](data-structures.md#alertinvocation) records, and a `list` object containing list metadata.

### search_snapshots

```
GET /api/app/search_snapshots/v1
```

Search server snapshots (individual servers or group snapshots). Requires a valid user session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `query` | String | Optional. [Unbase-style search query](https://github.com/jhuckaby/pixl-server-storage/blob/master/docs/Indexer.md#simple-queries). Defaults to `*`. |
| `offset` | Number | Optional. Zero-based row offset for pagination. Defaults to `0`. |
| `limit` | Number | Optional. Number of rows to return. Defaults to `1`. |
| `sort_by` | String | Optional. Field to sort by. Defaults to `_id`. |
| `sort_dir` | Number | Optional. Sort direction: `1` for ascending or `-1` for descending. Defaults to `-1`. |
| `verbose` | Boolean | Optional. If `true`, include heavy nested fields (e.g., `data.processes`, `data.mounts`, group keys). Defaults to `false` (these are pruned). |

Example response:

```json
{
    "code": 0,
    "rows": [ /* snapshot records */ ],
    "list": { "length": 8 }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing [Snapshot](data-structures.md#snapshot) records, and a `list` object containing list metadata. When `verbose` is not set, large fields are pruned from the snapshot records.

### search_activity

```
GET /api/app/search_activity/v1
```

Search the activity (audit) log. Admin only. Requires a valid administrator session or API Key with admin privileges.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `query` | String | Optional. [Unbase-style search query](https://github.com/jhuckaby/pixl-server-storage/blob/master/docs/Indexer.md#simple-queries). Defaults to `*`. |
| `offset` | Number | Optional. Zero-based row offset for pagination. Defaults to `0`. |
| `limit` | Number | Optional. Number of rows to return. Defaults to `1`. |
| `sort_by` | String | Optional. Field to sort by. Defaults to `_id`. |
| `sort_dir` | Number | Optional. Sort direction: `1` for ascending or `-1` for descending. Defaults to `-1`. |

Example response:

```json
{
    "code": 0,
    "rows": [ /* activity records */ ],
    "list": { "length": 120 }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing [Activity](data-structures.md#activity) records, and a `list` object containing list metadata. When available, each activity record will also include a computed `useragent` string derived from the original `headers.user-agent`.

### search_revision_history

```
GET /api/app/search_revision_history/v1
```

Search the activity log for revision history related to a specific data type (e.g., events, plugins, roles). Requires a valid user session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `type` | String | **(Required)** The data type to filter by. One of: `alerts`, `categories`, `channels`, `events`, `groups`, `monitors`, `plugins`, `tags`, `web_hooks`, `buckets`, `secrets`, `tickets`, `roles`. |
| `query` | String | Optional. Additional Unbase-style search terms to AND with the type filter. |
| `offset` | Number | Optional. Zero-based row offset for pagination. Defaults to `0`. |
| `limit` | Number | Optional. Number of rows to return. Defaults to `1`. |
| `sort_by` | String | Optional. Field to sort by. Defaults to `_id`. |
| `sort_dir` | Number | Optional. Sort direction: `1` for ascending or `-1` for descending. Defaults to `-1`. |

Example response:

```json
{
    "code": 0,
    "rows": [ /* activity records for the selected type */ ],
    "list": { "length": 34 }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing [Activity](data-structures.md#activity) records matching the selected type, and a `list` object containing list metadata. For security, these records have certain network details removed (e.g., IPs and raw headers).

### search_stat_history

```
GET /api/app/search_stat_history/v1
```

Fetch daily snapshots from the system stats history. These are counters incremented throughout the day, and used to display the "Job History Day Graph" and "Alert History Day Graph" swatch grids, among other things.  The API requires a valid user session or API Key.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `offset` | Number | Optional. Zero-based day offset for pagination. Defaults to `0`. |
| `limit` | Number | Optional. Number of days to return. Defaults to `1`. |
| `path` | String | Optional. Dot-path into the stats object to return a subset (e.g., `daily.jobs`). |
| `key_prefix` | String | Optional. If set and the selected node is an object, include only keys beginning with this prefix. |
| `current_day` | Boolean | Optional. If `true`, append in-progress counters for the current day as an extra item. |

Example response:

```json
{
    "code": 0,
    "items": [
        {
            "epoch": 1757376000,
            "date": "2025-10-09",
            "data": { /* selected stats subtree for the day */ }
        }
    ],
    "list": { "length": 30 }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include an `items` array containing per-day records with `epoch`, human-readable `date`, and the selected `data` subtree, plus a `list` object containing list metadata.



## Secrets

### get_secrets

```
GET /api/app/get_secrets/v1
```

Fetch all secret metadata. No specific privilege is required, besides a valid user session or API Key. Note that this returns only secret metadata; the actual secret variable data is stored separately and encrypted.

In addition to the [Standard Response Format](#standard-response-format), this will include a `rows` array containing all secrets, and a `list` object containing list metadata (e.g. `length` for total rows without pagination).

Example response:

```json
{
    "code": 0,
    "rows": [
        {
            "id": "zmeejkeb8nu",
            "title": "Dev Database Creds",
            "enabled": true,
            "icon": "",
            "notes": "This secret provides access to the dev database.",
            "names": ["DB_HOST", "DB_PASS", "DB_USER"],
            "events": ["emeekm2ablu"],
            "categories": [],
            "plugins": [],
            "web_hooks": ["example_hook"],
            "username": "admin",
            "modified": 1757204132,
            "created": 1755365953,
            "revision": 8
        }
    ],
    "list": { "length": 1 }
}
```

See [Secret](data-structures.md#secret) for details on the secret object and its properties. The actual encrypted data structure is described under [Secret.fields](data-structures.md#secret-fields).

### get_secret

```
GET /api/app/get_secret/v1
```

Fetch a single secret’s metadata by ID. No specific privilege is required, besides a valid user session or API Key. Both a HTTP GET with query string parameters and a HTTP POST with JSON are allowed. This returns only metadata; not the encrypted variable values.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the secret to fetch. |

Example request:

```json
{ "id": "zmeejkeb8nu" }
```

Example response:

```json
{
    "code": 0,
    "secret": {
        "id": "zmeejkeb8nu",
        "title": "Dev Database Creds",
        "enabled": true,
        "icon": "",
        "notes": "This secret provides access to the dev database.",
        "names": ["DB_HOST", "DB_PASS", "DB_USER"],
        "events": ["emeekm2ablu"],
        "categories": [],
        "plugins": [],
        "web_hooks": ["example_hook"],
        "username": "admin",
        "modified": 1757204132,
        "created": 1755365953,
        "revision": 8
    }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `secret` object containing the requested secret metadata. To retrieve and decrypt the actual variable values, use [decrypt_secret](#decrypt_secret).

See [Secret](data-structures.md#secret) for details on the metadata fields.

### decrypt_secret

```
GET /api/app/decrypt_secret/v1
```

Decrypt and return a secret’s variable data. Admin only. Requires a valid administrator session or API Key. Both a HTTP GET with query string parameters and a HTTP POST with JSON are allowed.

Access to this API is logged as a transaction in the activity log (action type `secret_access`), tagged with the requesting username.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the secret to decrypt. |

Example request:

```json
{ "id": "zmeejkeb8nu" }
```

Example response:

```json
{
    "code": 0,
    "fields": [
        { "name": "DB_HOST", "value": "db.dev.internal" },
        { "name": "DB_USER", "value": "appuser" },
        { "name": "DB_PASS", "value": "CorrectHorseBatteryStaple" }
    ]
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `fields` array containing the decrypted [Secret.fields](data-structures.md#secret-fields) entries.

### create_secret

```
POST /api/app/create_secret/v1
```

Create a new secret and store its encrypted variable data. Admin only. Requires a valid administrator session or API Key. The request must be sent as an HTTP POST with a JSON body.

See [Secret](data-structures.md#secret) for details on the metadata properties. The `id`, `username`, `created`, `modified` and `revision` properties may be omitted, as they are automatically generated (a unique `id` will be assigned if omitted, and the initial `revision` will be set to `1`). Include [Secret.fields](data-structures.md#secret-fields) to define the variable names and values; these will be encrypted and stored separately from the metadata. The `names` list is auto-generated from `fields` and stored in plaintext for display.

Example request:

```json
{
    "title": "Dev Database Creds",
    "enabled": true,
    "icon": "database-lock",
    "notes": "App DB credentials for dev",
    "events": ["emeekm2ablu"],
    "categories": ["cat_dev"],
    "plugins": ["shellplug"],
    "web_hooks": ["example_hook"],
    "fields": [
        { "name": "DB_HOST", "value": "db.dev.internal" },
        { "name": "DB_USER", "value": "appuser" },
        { "name": "DB_PASS", "value": "CorrectHorseBatteryStaple" }
    ]
}
```

Example response:

```json
{
    "code": 0,
    "secret": { /* full secret metadata, including auto-generated fields and names; excludes encrypted data */ }
}
```

In addition to the [Standard Response Format](#standard-response-format), this will include a `secret` object containing the created secret metadata. The encrypted variable data is stored separately and is not returned here.

### update_secret

```
POST /api/app/update_secret/v1
```

Update an existing secret’s metadata and/or encrypted variable data. Admin only. Requires a valid administrator session or API Key. The request must be sent as an HTTP POST with a JSON body.

See [Secret](data-structures.md#secret) for details on the metadata properties. The request is shallow-merged into the existing secret, so you can provide a sparse set of properties to update. If you include [Secret.fields](data-structures.md#secret-fields), the variables will be re-encrypted and stored; the `names` list will be regenerated from the provided field names. The `modified` timestamp is updated automatically, and the `revision` is incremented.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the secret to update. |
| (Other) | Various | Any updatable [Secret](data-structures.md#secret) fields (e.g. `title`, `enabled`, `fields`, `events`, `categories`, `plugins`, `web_hooks`, `icon`, `notes`). |

Example request (metadata-only update):

```json
{
    "id": "zmeejkeb8nu",
    "title": "Dev Database Credentials",
    "enabled": false
}
```

Example request (replace variables):

```json
{
    "id": "zmeejkeb8nu",
    "fields": [
        { "name": "DB_HOST", "value": "db.dev.example.com" },
        { "name": "DB_USER", "value": "appuser" },
        { "name": "DB_PASS", "value": "NewStrongPassword123!" }
    ]
}
```

Example response:

```json
{ "code": 0 }
```

### delete_secret

```
POST /api/app/delete_secret/v1
```

Delete an existing secret, including its encrypted variable data. Admin only. Requires a valid administrator session or API Key. The request must be sent as an HTTP POST with a JSON body.

Parameters:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | **(Required)** The alphanumeric ID of the secret to delete. |

Example request:

```json
{ "id": "zmeejkeb8nu" }
```

Example response:

```json
{ "code": 0 }
```



## Servers

### get_active_servers

### get_active_server

### get_server

### update_server

### delete_server

### watch_server

### create_snapshot



## Tags

### get_tags

### get_tag

### create_tag

### update_tag

### delete_tag



## Tickets

### get_ticket

### get_tickets

### search_tickets

### create_ticket

### update_ticket

### add_ticket_change

### update_ticket_change

### delete_ticket_file

### delete_ticket



## Users

### create_user

### update_user

### delete_user

### get_user_activity

### user_settings

### check_user_exists

### logout_all

### upload_avatar

### admin_upload_avatar

### delete_avatar

### admin_delete_avatar

### avatar



## Web Hooks

### get_web_hooks

### get_web_hook

### create_web_hook

### update_web_hook

### delete_web_hook

### test_web_hook



## Administrative

### get_servers

### get_master_state

### update_master_state

### test_internal_job

### bulk_search_delete_jobs

### bulk_search_delete

### admin_run_maintenance

### admin_run_optimization

### admin_reset_daily_stats

### get_transfer_token

### admin_stats

### admin_import_data

### admin_export_data

### admin_delete_data

### get_api_keys

```
GET /api/app/get_api_keys/v1
```

This retrieves a list of all registered API Keys.  

### get_api_key

### create_api_key

### update_api_key

### delete_api_key
