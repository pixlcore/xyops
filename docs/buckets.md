# Buckets

## Overview

Storage Buckets provide durable, shareable storage for jobs and workflows. A bucket can hold structured JSON data and any number of files. Jobs can fetch from and store to buckets at well-defined points in their lifecycle so outputs from one job are available as inputs to another, even when the jobs are not directly connected in a chain.

## Key Points

- Purpose: Persistent data/files exchange between jobs and workflows.
- Content types: JSON data object and file collection (zero or more files).
- Access: Manage via UI and API; controlled by privileges.
- Job integration: Fetch at job start; store on job completion based on action conditions.
- Direct links: Files in buckets are downloadable by URL.

See the [Bucket](data.md#bucket) data structure and the [Bucket APIs](api.md#buckets) for full technical details.

## When To Use

- Cross-job handoff: Pass artifacts from build to deploy, or output from data prep to analysis.
- Workflows: Share state and files between workflow nodes, even ones that don't have a direct connection.
- Checkpointing: Persist intermediate results for retries or manual inspection.
- Shared state: Maintain small JSON documents that multiple jobs can read/update over time.

## Managing Buckets In The UI

Users with the appropriate privileges can create, edit and delete buckets from the Buckets section of the UI.

- Create: Provide a title, optional icon/notes; the ID is generated.
- Edit data: Buckets have a JSON "Data" pane you can edit directly. This is arbitrary user-defined data.
- Upload files: Drag-and-drop or select multiple files. Existing files with the same normalized name are replaced.
- Delete files: Remove individual files from the list; deletions are permanent.
- Download files: Click a file to download via a direct URL. Links use the `files/bucket/...` path.

Filenames are normalized on upload (lowercased; non-alphanumerics except dashes and periods become underscores). Uploads respect configured limits (max size/count/types) via `client.bucket_upload_settings` and server-side enforcement. See [Configuration](config.md) for details.

### Required Privileges

- `create_buckets`: Create new buckets.
- `edit_buckets`: Edit bucket metadata, JSON data, and files.
- `delete_buckets`: Delete buckets and all contained data/files.

See [Privileges](privileges.md#buckets) for specifics. Listing and fetching typically requires only a valid session or API Key.

## Using Buckets In Jobs

Buckets integrate with jobs through two action types: [Fetch Bucket](actions.md#fetch-bucket) and [Store Bucket](actions.md#store-bucket). You attach these as job actions with conditions controlling when they run.

### Fetch At Job Start

Use [Fetch Bucket](actions.md#fetch-bucket) with the `start` condition to pull bucket content into the job's input context before launch:

- **Data**: Shallow-merged into the job's `input.data`. Avoid key collisions or namespace your keys deliberately.
- **Files**: Selected files are added to the job's input file list and staged into the job's temp directory on the remote server before the Plugin starts.

Example (JSON):

```json
{
  "enabled": true,
  "condition": "start",
  "type": "fetch",
  "bucket_id": "bme4wi6pg35",
  "bucket_sync": "data_and_files",
  "bucket_glob": "*.csv"
}
```

### Store On Completion

Use [Store Bucket](actions.md#store-bucket) with a completion condition (e.g., `success`, `error`, `complete`) to persist job outputs:

- **Data**: The job can emit output data which is written into the bucket when `bucket_sync` includes `data`.
- **Files**: The job's output files can be filtered by `bucket_glob` and stored in the bucket when `bucket_sync` includes `files`.

Example (JSON):

```json
{
  "enabled": true,
  "condition": "success",
  "type": "store",
  "bucket_id": "bme4wi6pg35",
  "bucket_sync": "data_and_files",
  "bucket_glob": "*.mp4"
}
```

Parameters used by both actions:

- `bucket_id`: Target [Bucket.id](data.md#bucket-id).
- `bucket_sync`: One of `data`, `files`, or `data_and_files` to control what is fetched/stored.
- `bucket_glob`: Optional glob pattern to filter which files are included (default `*`).

See [Store Bucket](actions.md#store-bucket) and [Fetch Bucket](actions.md#fetch-bucket) for full action semantics and notes.

**Note:** The job has to explicitly output data and/or files before the Store Bucket action can see them.  See [Output Data](plugins.md#output-data) and [Output Files](plugins.md#output-files) for details.

## Workflows And Buckets

Buckets are commonly used in workflows to pass artifacts and state between nodes without a direct connection between them. Attach Fetch/Store actions to the relevant workflow nodes:

- Upstream nodes store outputs to a shared bucket on `success`.
- Downstream nodes fetch from the same bucket at `start` to receive the data/files as if they were provided by a predecessor.

This pattern is useful for fan-out/fan-in designs, optional branches, and long-lived shared state between periodic jobs.

## Downloading Files By URL

Every bucket file includes a `path` (e.g., `files/bucket/<bucket_id>/<hash>/<filename>`). Prepend the app's base URL and a leading slash to download directly from the browser or via HTTP clients. Example:

```
GET https://your.xyops.example.com/files/bucket/bme4wi6pg35/bdY8zZ9nKynfFUb4xH6fA/report.csv
```

These URLs have built-in authentication and are "stable" (i.e. permalinks) even if the files are replaced in the bucket (however, not if they are deleted and then re-added).

## Programmatic Access

Using the [get_bucket](api.md#get_bucket), [write_bucket_data](api.md#write_bucket_data) and [upload_bucket_files](api.md#upload_bucket_files) APIs, you can programmatically read and write bucket data and files at any time, including during a job run.  Here is how to set that up:

- First, create a storage bucket, and save the new [Bucket.id](data.md#bucket-id).
- Next, create an [API Key](api.md#api-keys), and grant it the [edit_buckets](privileges.md#edit_buckets) privilege.  Save the API key secret when prompted.
- Then, create a [Secret Vault](secrets.md), and add your API Key and Bucket ID as variables (e.g. `XYOPS_API_KEY` and `XYOPS_BUCKET_ID`).
- Assign the secret vault to your Event, Category or Plugin (the scope is up to you).

When your job runs, you will now have access to your secret variables, and also a special magic variable called [Job.base_url](data.md#job-base_url) (also available as the `JOB_BASE_URL` environment variable).  Using these variables, you can write bucket data like this:

```sh
#!/bin/sh
JSON_PAYLOAD='{ "data": { "foo": "bar", "number": 1234 } }'
API_URL="$JOB_BASE_URL/api/app/write_bucket_data/v1?id=$XYOPS_BUCKET_ID"

curl -sS "$API_URL" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $XYOPS_API_KEY" \
  -d "$JSON_PAYLOAD" >/dev/null
```

And read it back like this:

```sh
#!/bin/sh
API_URL="$JOB_BASE_URL/api/app/get_bucket/v1?id=$XYOPS_BUCKET_ID"
RESPONSE=$(curl -sS -H "X-API-Key: $XYOPS_API_KEY" "$API_URL")

echo "Response: $RESPONSE"
```

The [write_bucket_data](api.md#write_bucket_data) API is designed to be rugged, and can easily handle getting bombarded with many jobs hitting it at once.  It uses locking to ensure the bucket data doesn't get corrupted.  Also, each request performs a "shallow merge" write into the data, so multiple "clients" (events / workflows) can read/write different properties in the same bucket at the same time.

Of course, you can get similar functionality using the [Store Bucket](actions.md#store-bucket) and [Fetch Bucket](actions.md#fetch-bucket) actions, but this way you have complete control over when the data is read and written, and you're not limited to the start and completion of the job.

## Tips

- **Namespacing**: Use distinct keys in bucket JSON to avoid shallow-merge collisions with job input.
- **Size discipline**: Prefer buckets for modest artifacts; large datasets may be better handled via external storage and referenced by URL.
- **Cleanup**: Consider lifecycle practices (e.g., replace/rotate files) to keep buckets tidy and within limits.

## See Also

- Data structures: [Bucket](data.md#bucket)
- APIs: [Buckets](api.md#buckets)
- Actions: [Store Bucket](actions.md#store-bucket), [Fetch Bucket](actions.md#fetch-bucket)
- Privileges: [Buckets](privileges.md#buckets)
