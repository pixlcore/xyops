# Buckets

Storage Buckets provide durable, shareable storage for jobs and workflows. A bucket can hold structured JSON data and any number of files. Jobs can fetch from and store to buckets at well‑defined points in their lifecycle so outputs from one job are available as inputs to another, even when the jobs are not directly connected in a chain.

## Overview

- Purpose: Persistent data/files exchange between jobs and workflows.
- Content types: JSON data object and file collection (zero or more files).
- Access: Manage via UI and API; controlled by privileges.
- Job integration: Fetch at job start; store on job completion based on action conditions.
- Direct links: Files in buckets are downloadable by URL.

See the [Bucket](data.md#bucket) data structure and the [Bucket APIs](api.md#buckets) for full technical details.

## When To Use

- Cross‑job handoff: Pass artifacts from build to deploy, or output from data prep to analysis.
- Workflows: Share state and files between workflow nodes, even ones that don’t have a direct connection.
- Checkpointing: Persist intermediate results for retries or manual inspection.
- Shared state: Maintain small JSON documents that multiple jobs can read/update over time.

## Managing Buckets In The UI

Users with the appropriate privileges can create, edit and delete buckets from the Buckets section of the UI.

- Create: Provide a title, optional icon/notes; the ID is generated.
- Edit data: Buckets have a JSON “Data” pane you can edit directly. This is arbitrary user‑defined data.
- Upload files: Drag‑and‑drop or select multiple files. Existing files with the same normalized name are replaced.
- Delete files: Remove individual files from the list; deletions are permanent.
- Download files: Click a file to download via a direct URL. Links use the `files/bucket/...` path.

Filenames are normalized on upload (lowercased; non‑alphanumerics except dashes and periods become underscores). Uploads respect configured limits (max size/count/types) via `client.bucket_upload_settings` and server‑side enforcement. See [Configuration](config.md) for details.

### Required Privileges

- `create_buckets`: Create new buckets.
- `edit_buckets`: Edit bucket metadata, JSON data, and files.
- `delete_buckets`: Delete buckets and all contained data/files.

See [Privileges](privileges.md#buckets) for specifics. Listing and fetching typically requires only a valid session or API Key.

## Using Buckets In Jobs

Buckets integrate with jobs through two action types: Fetch Bucket and Store Bucket. You attach these as job actions with conditions controlling when they run.

### Fetch At Job Start

Use Fetch Bucket with the `start` condition to pull bucket content into the job’s input context before launch:

- **Data**: Shallow‑merged into the job’s `input.data`. Avoid key collisions or namespace your keys deliberately.
- **Files**: Selected files are added to the job’s input file list and staged into the job’s temp directory on the remote server before the Plugin starts.

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

Use Store Bucket with a completion condition (e.g., `success`, `error`, `complete`) to persist job outputs:

- **Data**: The job can emit output data which is written into the bucket when `bucket_sync` includes `data`.
- **Files**: The job’s output files can be filtered by `bucket_glob` and stored in the bucket when `bucket_sync` includes `files`.

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

## Workflows And Buckets

Buckets are commonly used in workflows to pass artifacts and state between nodes without a direct connection between them. Attach Fetch/Store actions to the relevant workflow nodes:

- Upstream nodes store outputs to a shared bucket on `success`.
- Downstream nodes fetch from the same bucket at `start` to receive the data/files as if they were provided by a predecessor.

This pattern is useful for fan‑out/fan‑in designs, optional branches, and long‑lived shared state between periodic jobs.

## Downloading Files By URL

Every bucket file includes a `path` (e.g., `files/bucket/<bucket_id>/<hash>/<filename>`). Prepend the app’s base URL and a leading slash to download directly from the browser or via HTTP clients. Example:

```
GET https://your.xyops.example.com/files/bucket/bme4wi6pg35/bdY8zZ9nKynfFUb4xH6fA/report.csv
```

## Tips

- **Namespacing**: Use distinct keys in bucket JSON to avoid shallow‑merge collisions with job input.
- **Size discipline**: Prefer buckets for modest artifacts; large datasets may be better handled via external storage and referenced by URL.
- **Cleanup**: Consider lifecycle practices (e.g., replace/rotate files) to keep buckets tidy and within limits.

## See Also

- Data structures: [Bucket](data.md#bucket)
- APIs: [Buckets](api.md#buckets)
- Actions: [Store Bucket](actions.md#store-bucket), [Fetch Bucket](actions.md#fetch-bucket)
- Privileges: [Buckets](privileges.md#buckets)
