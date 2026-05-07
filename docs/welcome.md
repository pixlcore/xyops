# Welcome to xyOps!

xyOps is a job scheduler, workflow automation engine, and server monitoring platform. It lets you run jobs on your servers, orchestrate them visually with workflows, collect metrics, trigger runs on schedules or intervals, and react with actions and limits. Everything is available in the web UI and via the REST API.

This guide is shown on the dashboard for new users to help you take your first steps, and introduce some core concepts.  It will disappear as soon as you create your first event.  You can always get back to it later by clicking on "Documentation" in the sidebar, then "Welcome to xyOps".

If you would like a more detailed walk-through, see [Getting Started with xyOps](start.md).  It covers the first install, conductor hostname, `base_app_url`, your first event, event chaining, JSON over STDIO, limits, web hook actions, and a basic workflow.


## Step 1: Add a Server

Before you can run anything, add at least one server. Servers run the lightweight xySat agent and execute jobs sent by xyOps. You can add servers for Docker, Linux, macOS, or Windows hosts.

Add a server from the UI:

1. Open the Servers page and click "Add Server".
2. Optionally set a label, icon, and groups, or leave defaults.
3. Copy the one-line install command for your OS and run it on the target host.
4. The server appears in the UI, starts streaming metrics, and is ready to run jobs.

For automated provisioning, you can bootstrap servers with an API key during first boot. See [Servers](servers.md).


## Core Concepts: Events and Workflows

- **Events**: An event defines what to run (a plugin plus parameters), where to run it (servers or groups), when to run (triggers), and how to control and react (limits and actions). Each time an event runs it launches a job. See [Events](events.md).
- **Workflows**: A workflow is a visual graph that chains jobs with control flow. A workflow run becomes a parent job that launches sub-jobs on its nodes. You can fan out, join, repeat, multiplex across servers, and attach limits/actions per node. See [Workflows](workflows.md).

You can keep most automation as simple events. Use workflows when you need orchestration, branching, or parallelism.


## Triggers: When Jobs Run

Triggers control when events and workflows are allowed to run. Common cases:

- **Manual**: Allow a user or API to launch on demand.
- **Schedule**: Specify hours/minutes/days like cron, with optional timezones.
- **Interval**: Run every N seconds starting from a timestamp.
- **Single Shot**: Run once at an exact time.
- **Plugin**: Custom trigger logic provided by a plugin.
- **Range and Blackout**: Permit or block launches between specific time ranges.
- **Options**: Catch-Up (replay missed schedules), Delay (defer launch), Precision (second-level scheduling).

Events list triggers in the editor. Workflows show triggers as nodes in the graph and you connect them to entry nodes. See [Triggers](triggers.md).


## Plugins: What Runs

Event Plugins are the code that runs your jobs. Built-in options include:

- **Shell Plugin**: Run arbitrary shell scripts/commands.
- **HTTP Request Plugin**: Call HTTP(S) endpoints.
- **Docker Plugin**: Run scripts inside containers.
- **Test Plugin**: Emit sample data/files for testing flows.

You can write your own plugins in any language. Plugins read a JSON job context on STDIN and write JSON status updates to STDOUT. See [Plugins](plugins.md).


## Actions and Limits

- **Limits**: Self-imposed constraints such as Max Run Time, Max Output Size, Max CPU/Memory, Max Concurrent Jobs, Max Queue, and Max Retries. Limits can apply tags, send notifications, take snapshots, and optionally abort jobs. Limits come from the event/workflow, the category, and universal defaults. See [Limits](limits.md).
- **Actions**: Reactions to job outcomes (start, success, error, warning, critical, abort, or tag match) or to alert state changes. Action types include email, web hook, run job, ticket, snapshot, and more. Actions execute in parallel and deduplicate per target. See [Actions](actions.md).


## Categories

Categories help organize events and control defaults and visibility. A category can:

- Apply default actions and limits to events in the category.
- Control access based on user roles and privileges.
- Provide a clean way to group related automation for teams.

You can start with a default category and refine later. See [Categories](categories.md).


## Try It: Your First Event

1. Go to Events → New Event.
2. Enter a title and pick a category.
3. Choose the Shell Plugin and paste a simple script, for example:

```sh
#!/bin/sh
echo "Hello from xyOps"
echo '{ "xy": 1, "code": 0 }'
```

The final JSON line signals success to xyOps.

4. Select one of your servers (or a group) as the target and keep the default selection algorithm.
5. Add a Manual trigger and save the event.
6. Click Run, watch logs stream live, and view the job’s result and metrics.

Next, try adding a Max Run Time limit and an email action on error. Re-run to see how actions and limits behave.


## Try It: Your First Workflow

1. Go to Workflows → New Workflow.
2. Add a Trigger node (Manual) and connect it to an Event node referencing the event you just created.
3. Optionally insert a Controller (e.g., Repeat or Multiplex) between the trigger and event to see parallelism.
4. Attach a Limit node (e.g., Max Concurrent Jobs) to the event node’s bottom pole.
5. Click Test Selection or Run, then inspect the parent workflow job and its sub-jobs.

See [Workflows](workflows.md) for node types, controllers, and graph editing tools.


## Where To Go Next

- Follow the step-by-step beginner tutorial. See [Getting Started with xyOps](start.md).
- Add more servers and organize them with groups. See [Servers](servers.md) and [Groups](groups.md).
- Create monitors and alerts for server metrics. See [Monitors](monitors.md) and [Alerts](alerts.md).
- Reuse notifications with channels. See [Channels](channels.md).
- Share data and files across jobs with buckets. See [Buckets](buckets.md).
- Explore advanced scheduling, catch-up, ranges, and blackout windows. See [Triggers](triggers.md).
- Package and share your own plugins. See [Plugins](plugins.md) and [Marketplace](marketplace.md).
- Click the "Documentation" link in the sidebar for the full docs index.

Have questions or feedback?  Check out our [Support Guide](support.md).
