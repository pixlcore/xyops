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

See [Monitoring](monitoring.md) for details on the xyOps monitoring and alert system.

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

This fetches all the current storage bucket defintions (sans actual data and files).  No input parameters are defined.  No specific privilege is required, besides a valid user session or API Key.

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

In addition to the [Standard Response Format](#standard-response-format), this will include a `category` property containing the requested category defintion.  See [Category](data-structures.md#category) for details on category properties.

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
| other fields | Various | Any updatable [Category](data-structures.md#category) fields (e.g. `title`, `enabled`, `color`, `notes`, `limits`, `actions`). |

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
| other fields | Various | Any updatable [Channel](data-structures.md#channel) fields (e.g. `title`, `enabled`, `users`, `email`, `web_hook`, `run_event`, `sound`, `icon`, `max_per_day`, `notes`). |

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
| other fields | Various | Any updatable [Event](data-structures.md#event) fields (e.g. `title`, `enabled`, `category`, `targets`, `algo`, `plugin`, `params`, `triggers`, `limits`, `actions`, `notes`). |

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
| other fields | Various | Any updatable [Group](data-structures.md#group) fields (e.g. `title`, `hostname_match`, `icon`, `notes`, `alert_actions`). |

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

### get_active_job_summary

### get_workflow_job_summary

### get_job

### get_jobs

### get_job_log

### view_job_log

### download_job_log

### tail_live_job_log

### update_job

### job_toggle_notify_me

### manage_job_tags

### abort_job

### delete_job

### flush_event_queue



## Monitors

### get_monitors

### get_monitor

### create_monitor

### update_monitor

### test_monitor

### delete_monitor

### multi_update_monitor

### get_quickmon_data

### get_latest_monitor_data

### get_historical_monitor_data



## Plugins

### get_plugins

### get_plugin

### create_plugin

### update_plugin

### delete_plugin



## Roles

### get_roles

### get_role

### create_role

### update_role

### delete_role



## Search

### search_jobs

### search_servers

### get_server_summaries

### search_alerts

### search_snapshots

### search_activity

### search_revision_history

### search_stat_history



## Secrets

### get_secret

### get_secrets

### decrypt_secret

### create_secret

### update_secret

### delete_secret



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
