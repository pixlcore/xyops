# Getting Started with xyOps

This guide walks you from a fresh xyOps install to a few useful automations: a first job, job chaining, queue limits, failure web hooks, and a tiny workflow.

The goal here is not to cover every option.  The goal is to get you oriented, help you avoid the common setup traps, and show how the pieces fit together.

For deeper reference material, each section links to the full docs.


## What You Will Build

By the end of this guide, you will have:

- A running xyOps conductor.
- At least one server that can run jobs.
- A "Hello World" event.
- A second event triggered by the first event.
- A basic job script that reports progress and output data.
- A concurrency limit with queueing.
- A web hook action that fires when a job fails.
- A simple workflow with a trigger node, an event node, and an action node.


## A Few Terms First

xyOps has a small set of core concepts:

- **Conductor**: The primary xyOps server.  It hosts the UI, scheduler, API, and coordination logic.
- **xySat**: The lightweight agent that runs on worker servers.  It executes jobs and sends monitoring metrics back to xyOps.
- **Server**: A registered xySat worker, or the local xySat bundled with the conductor for testing.
- **Event**: A reusable definition for launching one kind of job.
- **Job**: One actual run of an event (other apps call this an "execution" or "task").
- **Trigger**: A rule that starts a job or workflow, such as Manual, Schedule, Interval, or Single Shot.
- **Action**: A reaction that runs when a job reaches a selected condition, such as start, success, error, or completion.  Actions can send email, fire a web hook, run another event, call an Action Plugin, and more.
- **Limit**: A guardrail for jobs, such as maximum runtime, maximum concurrent jobs, or maximum queue size.
- **Workflow**: A visual graph that connects triggers, events, jobs, actions, limits, and controllers.

Most new automations should start as simple events.  Use workflows when you need visual orchestration, branching, fan-out, fan-in, or multi-step flows.


## Install xyOps

For a first test install, Docker is the fastest path.  Pick a hostname that will resolve on your network and be reachable by any worker server you plan to add.

In the example below, replace `xyops01.internal.example.com` with your real conductor hostname.

```sh
docker run \
	--detach \
	--init \
	--name "xyops-conductor-1" \
	--hostname "xyops01.internal.example.com" \
	-e XYOPS_masters="xyops01.internal.example.com" \
	-e XYOPS_xysat_local="true" \
	-e XYOPS_base_app_url="http://xyops01.internal.example.com:5522" \
	-e TZ="America/Los_Angeles" \
	-v xy-data:/opt/xyops/data \
	-v ./xyops01-conf:/opt/xyops/conf \
	-v ./xyops01-logs:/opt/xyops/logs \
	-v /var/run/docker.sock:/var/run/docker.sock \
	--restart unless-stopped \
	-p 5522:5522 \
	-p 5523:5523 \
	ghcr.io/pixlcore/xyops:latest
```

Then open:

```text
http://xyops01.internal.example.com:5522/
```

The default administrator account is:

- **Username:** `admin`
- **Password:** `admin`

You will be prompted to change the password on first login.

See [Self-Hosting](hosting.md) for Docker Compose, manual installs, storage, TLS, and production recommendations.


## Set The Two Important URLs Correctly

There are two related settings that are easy to confuse.

### The Conductor Hostname

The conductor hostname is the network name of the xyOps server or container.  Worker servers need to connect to this name.

This is very important:

- The hostname must resolve in DNS, Tailscale, `/etc/hosts`, or whatever name system your network uses.
- The resolved address must be reachable from every worker server.
- Workers must be able to reach the conductor's web port and satellite socket port, typically `5522` and `5523`.
- If you are using Docker, the container hostname should be the same stable, routable name.
- The `XYOPS_masters` value must include the conductor hostname.  For a single-conductor install, it is just that one hostname.
- Treat conductor hostnames as long-lived infrastructure names.  If you change them later, you may need to update conductor and worker configuration.

For example:

```sh
--hostname "xyops01.internal.example.com"
-e XYOPS_masters="xyops01.internal.example.com"
```

A quick test from a worker server should succeed:

```sh
curl http://xyops01.internal.example.com:5522/health
```

If this does not connect, fix that before adding remote workers.  Many xyOps features depend on conductors and workers being able to route to each other by hostname.

### The Base App URL

`base_app_url` is the user-facing URL for your xyOps web app.  It is used to generate fully-qualified links in places like emails, tickets, alerts, and web hook payloads.

**Important:** This is *not* the server-to-server host.

Set it to the URL humans should click:

```sh
-e XYOPS_base_app_url="https://xyops.example.com"
```

Examples:

| Situation | `base_app_url` |
|----------|----------------|
| Local test | `http://localhost:5522` |
| Internal network | `http://xyops01.internal.example.com:5522` |
| Public HTTPS behind a proxy | `https://xyops.example.com` |

If you are running behind a proxy, load balancer, Cloudflare Tunnel, or SSO gateway, there are more moving pieces involved.  Start with this guide for a local or direct internal setup, then see [Self-Hosting](hosting.md), [SSO Setup](sso.md), and [Tailscale](tailscale.md) for advanced hosting.


## Add Your First Server

If you set `XYOPS_xysat_local=true` during Docker startup, xyOps launches a local xySat agent in the conductor container.  That is enough to run your first jobs.

To add another server:

1. Open **Servers**.
2. Click **Add Server**.
3. Choose the target OS or Docker install option.
4. Copy the generated install command.
5. Run it on the worker server.

The worker should appear online in the UI and begin streaming metrics.

If the worker does not appear, check the conductor hostname and routing first.  The worker must be able to reach the conductor by the hostname configured during setup.

See [Servers](servers.md) for automated provisioning, groups, user data, and server settings.


## Create A Hello World Event

Events are the basic unit of automation in xyOps.  Each event says what to run, where to run it, when to run it, and what to do afterward.

Create your first event:

1. Open **Events**.
2. Click **New Event**.
3. Set the title to "Hello World".
4. Select the default "General" category.
5. Select the **Shell Plugin**.
6. Paste this script:

```sh
#!/bin/sh

# This text appears in the job log.
echo "Hello from xyOps."

# This shorthand updates the live progress meter.
echo "25%"

# Sleep for 5 seconds
sleep 5

# You can also write full XYWP JSON messages from Shell Plugin scripts.
echo '{ "xy": 1, "status": "Taking a short break...", "progress": 0.5 }'

# Sleep for another 5 seconds
sleep 5

# This is just more normal log output.
echo "The job is almost done."

# Exit 0 tells the Shell Plugin that the job succeeded.
exit 0
```

Then:

1. Select a target server or group.
2. A **Manual** trigger should already be included and enabled.
3. Save the event.
4. Click **Run Now...**.

Open the job details page and look at the live log, progress meter, result code, runtime, and server metrics.

The Shell Plugin is not limited to `/bin/sh`.  It can run any script that starts with a valid shebang line, including Node.js, Python, Perl, PHP, Ruby, Powershell, and more.

See [Events](events.md), [Triggers](triggers.md), and [Plugins](plugins.md) for the full details.


## Understand JSON Over STDIO

The Shell Plugin is the easiest way to get started because it can use normal process exit codes and normal log output.  But it also supports the full [xyOps Wire Protocol](xywp.md), or XYWP: newline-delimited JSON over STDIN and STDOUT.

At job start, xyOps sends one compact JSON document to your script on STDIN.  It includes the job ID, event ID, selected server, parameters, input data, input files, and more.

Your script can write compact JSON messages to STDOUT.  Every protocol message should include `"xy": 1`.

Here is a Shell Plugin script written in Node.js.  The `#!/usr/bin/env node` shebang tells the Shell Plugin to run it with Node instead of `/bin/sh`:

```js
#!/usr/bin/env node

// Read the single JSON job document from STDIN.
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
let job = JSON.parse( chunks.join('') );

// Report a status message and progress while the job is still running.
console.log( JSON.stringify({
	xy: 1,
	progress: 0.25,
	status: "Reading job input..."
} ) );

// Read user input passed from the UI, API, workflow, or previous job.
let name = (job.input && job.input.data && job.input.data.name) || "xyOps";

// Send custom output data.  This can be passed to the next job.
console.log( JSON.stringify({
	xy: 1,
	data: {
		greeting: "Hello, " + name + ".",
		sourceJob: job.id
	}
} ) );

// Update progress again.
console.log( JSON.stringify({
	xy: 1,
	progress: 0.75,
	status: "Finishing..."
} ) );

// This final message completes the job successfully.
// Send it last, because xyOps treats any message with "code" as final.
console.log( JSON.stringify({
	xy: 1,
	code: 0,
	description: "Job completed successfully."
} ) );
```

To report an error, send a final message with a non-zero code:

```json
{ "xy": 1, "code": 999, "description": "Failed to connect to the database." }
```

Common output messages:

| What You Want | Example |
|---------------|---------|
| Progress | `{ "xy": 1, "progress": 0.5 }` |
| Live status | `{ "xy": 1, "status": "Processing records..." }` |
| Custom output data | `{ "xy": 1, "data": { "count": 42 } }` |
| Attach output files | `{ "xy": 1, "files": [ "*.csv" ] }` |
| Success | `{ "xy": 1, "code": 0 }` |
| Error | `{ "xy": 1, "code": 999, "description": "Something failed." }` |

Anything that is not recognized as an XYWP message is captured as plain log output.  Also, STDERR is captured as raw text, not protocol JSON.

Writing your own reusable Event Plugin is also an option, but you do not need to start there.  Custom Event Plugins are best when you want to package reusable components, define Plugin Parameters for event authors, or share a polished integration with other xyOps users.

See [xyOps Wire Protocol](xywp.md) and [Plugins](plugins.md#job-output) for the full protocol.


## Chain Two Events Without A Workflow

You do not need a workflow just to run one event after another.  Use a **Run Event** action.

Create a second event:

1. Open **Events**.
2. Click **New Event**.
3. Set the title to "Hello Followup".
4. Choose the **Shell Plugin**.
5. Paste this script:

```sh
#!/bin/sh

# This event is launched by the first event.
echo "The followup event is running."

# If the previous job produced output data, xyOps can pass it along.
# For simple Shell Plugin scripts, you can usually start with env vars,
# plugin params, or plain log output before writing a custom plugin.

exit 0
```

6. Select a target server or group.
7. Leave the default **Manual** trigger enabled.
8. Save the event.

Now edit the first `Hello World` event:

1. Open the **Actions** section.
2. Add an action.
3. Set **Condition** to "On Success".
4. Set **Type** to "Run Event".
5. Select "Hello Followup" as the event to run.
6. Save.

Run the "Hello World" event again.  When it succeeds, xyOps will launch "Hello Followup".

This is the simplest way to build a linear chain:

```text
Event A succeeds -> Run Event action -> Event B runs
```

Use this pattern for simple pipelines.  Move to workflows when you need visual branching, joins, fan-out, or more complex control flow.

See [Actions](actions.md#run-event) for all Run Event options.


## Add Concurrency And Queue Limits

By default, if a job cannot start because its event is already at the concurrency limit, it will immediately fail with an error.  You should pair **Max Concurrent Jobs** with **Max Queue Limit** when you want jobs to queue.

For example, suppose you want an event to run only one job at a time, with up to 25 waiting jobs.

Edit the event:

1. Open the event editor.
2. Open the **Limits** section.
3. Add **Max Concurrent Jobs**.
4. Set the amount to `1`.
5. Add **Max Queue Limit**.
6. Set the amount to `25`.
7. Save.

This means:

- If no job is running, the new job starts.
- If one job is already running, the new job waits in the event queue.
- If 25 jobs are already waiting, the next launch is rejected.

This pair is also important when jobs can launch faster than your workers can accept them, such as web hook triggers, repeat workflows, multiplex workflows, or busy schedules.

See [Limits](limits.md#max-concurrent-jobs) and [Limits](limits.md#max-queue-limit) for the full behavior.


## Fire A Web Hook When A Job Fails

Web hooks are reusable outbound HTTP requests.  You create the web hook once, then attach it to events or alerts with an action.

First create a web hook:

1. Open **Web Hooks**.
2. Click **New Web Hook**.
3. Give it a title, such as "Ops Failure Hook".
4. Set the method to `POST`.
5. Set the URL to your endpoint.
6. Add a `Content-Type: application/json` header.
7. Use a JSON body like this:

```json
{
	"text": "{{text}}",
	"job": "{{job.id}}",
	"event": "{{event.title}}",
	"code": "{{job.code}}",
	"description": "{{job.description}}",
	"url": "{{links.job_details}}"
}
```

Then attach it to an event:

1. Open the event editor.
2. Open the **Actions** section.
3. Add an action.
4. Set **Condition** to "On Any Error".
5. Set **Type** to "Web Hook".
6. Select "Ops Failure Hook".
7. Save.

To test it, temporarily change your Shell Plugin script to fail:

```sh
#!/bin/sh

echo "This job is going to fail for testing."
exit 1
```

Run the event.  The job should fail, and the web hook action should fire.  The job details page will show action activity and web hook diagnostics.

See [Web Hooks](webhooks.md) and [Actions](actions.md#web-hook) for templating, secrets, retries, and troubleshooting.


## Build A Tiny Workflow

Workflows are visual graphs.  They are useful when the automation needs to be seen and edited as a flow.

Create a small workflow:

1. Open **Workflows**.
2. Click **New Workflow**.
3. Use the default **Manual** trigger node.
4. Add an **Event** node.
5. Select your "Hello World" event.
6. Connect the trigger node output (right side) to the event node input (left side).
7. Add an **Action** node.
8. Choose an action, such as Web Hook or Email.
9. Connect the event node output (right side) to the action node (left side).
10. Click the wire from the event node to the action node and set the condition, such as "On Any Error" or "On Success".
11. Save and run the workflow.

The basic shape is:

```text
+----------------+     +-------------------+     +--------+
| Manual Trigger | --> | Hello World Event | --> | Action |
+----------------+     +-------------------+     +--------+
```

If you attach a **Limit** node, connect it to the event node's South pole.  For example, attach Max Concurrent Jobs and Max Queue Limit to control fan-out.

A few workflow tips:

- New wires from event and job nodes mean "continue when this job succeeds" by default, but you can click the icon to change the condition.
- Event and job nodes run in parallel by default if multiple paths are active.
- Action nodes do not continue the flow.  They attach a reaction to the event or job node.
- Limit nodes do not continue the flow.  They attach guardrails and/or configuration to the event or job node.
- For simple "run B after A succeeds" chains, a Run Event action may be easier than a workflow.

See [Workflows](workflows.md) for node types, wire conditions, controllers, and data passing.


## Where To Go Next

Once the basics are working, these docs are good next stops:

- [Self-Hosting](hosting.md): Production installs, TLS, Docker Compose, storage, and multi-conductor setups.
- [Events](events.md): The complete event model.
- [Triggers](triggers.md): Manual, schedule, interval, single-shot, incoming web hooks, ranges, blackout windows, and catch-up.
- [Actions](actions.md): Email, web hooks, Run Event, channels, tickets, snapshots, and more.
- [Limits](limits.md): Runtime limits, queueing, retries, concurrency, and daily caps.
- [Workflows](workflows.md): Visual orchestration, controllers, wire conditions, and data flow.
- [xyOps Wire Protocol](xywp.md): The JSON over STDIO protocol for writing plugins.
- [Plugins](plugins.md): Built-in plugins and custom plugin development.

Start small, get one event running reliably, then add triggers, actions, limits, and workflows as your automation grows.
