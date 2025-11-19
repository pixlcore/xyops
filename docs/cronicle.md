# Cronicle

This chapter is for users of [Cronicle](https://github.com/jhuckaby/cronicle), the spiritual predecessor of xyOps.  If you have an existing Cronicle installation, you can migrate all of your data over to xyOps, enable a special compatibility mode for Cronicle Plugin interop, and if you like, white-label the UI to bring back the Cronicle name and logo.

## Prerequisites

Before you import your Cronicle data, please make sure you [add all your worker servers](servers.md#adding-servers) to your xyOps installation.  The reason is, Cronicle events can target servers directly by their hostname, but xyOps does this differently.  It is important to have all your servers in your xyOps cluster before importing, so the code can properly match up your Cronicle server targets to your new xyOps servers.

## Data Export

Follow the [Cronicle Data Export](https://github.com/jhuckaby/Cronicle/blob/master/docs/CommandLine.md#data-import-and-export) guide for exporting all your data from Cronicle.

## Data Import

To import your Cronicle data into xyOps, follow these steps:

1. Login to xyOps as an administrator.
2. Click on the "**System**" tab in the sidebar.
3. Click on the "**Import Data...**" button.
4. In the "**File Format**" menu, select "**Cronicle Data Format**".
5. Click the "**Choose File...**" button and select your Cronicle data export file.

> [!WARNING]
> The bulk import operation is destructive, and will delete all data in the way.  Also, this will abort all running jobs, flush all queued jobs, and the scheduler will automatically be paused.

Once the process is complete, a notification will appear in the bottom-left corner of your screen.  Then, you can click on the "**Activity**" tab in the sidebar, locate the completed import job (should be the topmost entry) and click the "**Details...**" link to see a full report, including any warnings or errors.

Before you reenable the scheduler, please ensure all your Events, Categories, Server Groups, Plugins, Users, and API Keys all came over cleanly.  Verify user privileges, and event settings like multiplex, notifications, CPU/RAM limits, retries, etc.

## Plugin Compatibility Mode

While both xyOps and Cronicle communicate with Plugins via JSON over STDIO, the APIs differ slightly.  xyOps requires that each JSON message have a top-level `xy` property set to `1`, alongside any other job properties.  Example:

```json
{ "xy": 1, "progress": 0.5 }
```

This is how xyOps differentiates its own API versus other random JSON that may be emitted by your Plugin or a sub-process.  Cronicle, on the other hand, basically accepts any JSON message it finds, if it has one or more properties it recognizes:

```json
{ "progress": 0.5 }
```

If you have written existing Cronicle Plugins that you want to migrate to xyOps *without having to make any code changes*, you can enable a special compatibility mode.  Once turned on, it drops the `xy` property requirement, and also recognizes and converts several other Cronicle-specific Plugin APIs like `chain`, `chain_error`, `chain_data`, `notify_success` and `notify_fail`.  To enable compatibility mode, add a `cronicle` property set to `true` inside the [satellite.config](config.md#satellite-config) object.

You can also set it via environment variable if you like:

```
XYOPS_satellite__config__cronicle="true"
```

> [!NOTE]
> Changing the Satellite Configuration requires a restart for the changes to take effect across all your servers.

## White-Label UI

If you want to white-label the xyOps UI so it resembles Cronicle, you can change both the app "name" (used in a variety of places) and the logo image shown in the top-left corner.  To do this, modify these two configuration properties: [client.name](config.md#client-name) and [client.logo_url](config.md#client-logo_url) with the following overridden values:

```json
"name": "Cronicle",
"logo_url": "images/cronicle-logo.png"
```

Note that these properties are *inside* the `client` object, in your `config.json` file.

You can also override them via environment variables if you like:

```
XYOPS_client__name="Cronicle"
XYOPS_client__logo_url="images/cronicle-logo.png"
```

## Multiplex Events

xyOps handles [multiplex events](https://github.com/jhuckaby/Cronicle/blob/master/docs/WebUI.md#multiplexing) (jobs that run on multiple servers in parallel) differently than Cronicle.  They are now implemented as part of a [Workflow](workflows.md), using a [Multiplex Controller Node](workflows.md#multiplex-controller).  When you import your Cronicle data with multiplexed events, they are automatically converted to workflows, with the event added inside as a [Job Node](workflows.md#job-node).

What this means in practice is that your multiplex events should "just work" like they did in Cronicle.  However, you now have more options to customize things.  Inside the workflow editor, you can attach [Limiter Nodes](workflows.md#limiter-nodes) to your job node, which control how many jobs can run in parallel, allowing some to queue up.  To do this, add both a [Max Jobs Limiter](workflows.md#max-jobs-limiter), and a [Max Queue Limiter](workflows.md#max-queue-limiter).  Note that by default there is no parallel limit.

## Detached Jobs

xyOps does not have the concept of [detached jobs](https://github.com/jhuckaby/Cronicle/blob/master/docs/WebUI.md#detached-mode) like Cronicle does.  The reason is, xyOps installs a small satellite binary on your worker servers, which runs 24x7 and does not ever need to be restarted.  And if you do need to upgrade the satellite software, the process is orchestrated in such a way where it rolls out gradually, and never interrupts running jobs (each worker server waits for all jobs to complete before self-upgrading).

Also, stopping the master xyOps service does not abort any running jobs.  They all continue headless, and if they complete while the xyOps master server is still down, they simply wait for a master server to come up before reporting completion.

## User Privileges

User and API Key privileges are automatically migrated over to xyOps, but there are a couple of exceptions:

- Cronicle's **Toggle Scheduler** user privilege doesn't exist in xyOps.  The feature exists, but it is limited to administrators only.
- Cronicle's undocumented `job_read_only` privilege doesn't exist in xyOps.  Instead, individual Plugin and Event parameters can be marked as "administrator locked" (only admins can write to them), and the Shell Plugin script param is preconfigured this way.
