# Servers

## Overview

Servers are the worker nodes in a xyOps cluster. Each server runs our lightweight satellite agent (xySat), maintains a persistent WebSocket connection to the conductor, collects monitoring metrics, and executes jobs on demand. A server may be a physical host, virtual machine, or container, and can run Linux, macOS, or Windows.

This document explains how servers fit into xyOps, how to add and organize them, how events target servers, what you can see on each server's UI page, and how the system scales to large fleets.

## Key Points

- Servers run xySat and act as job runners and metrics collectors.
- Conductors run the full xyOps stack and coordinate scheduling, routing, storage, and UI.
- You can add any number of servers and conductors to a cluster; agents maintain live connections and auto-failover across conductors.
- Servers collect "quick" metrics every second (CPU/Mem/Disk/Net) and minute-level metrics via user-defined monitor plugins. Some metrics are not available on Windows.

## Servers vs. Conductors

- **Server**: A worker node running xySat. It reports host details and metrics, and executes jobs sent by a conductor. Servers may be grouped and targeted by events.
- **Conductor**: A full xyOps instance (primary or hot standby) that manages the schedule, routes jobs to servers, stores data, and serves the UI/API. A cluster can have multiple conductors for redundancy; one is primary at any time.

xySat keeps an up-to-date list of all conductors. If a server loses its primary connection, it automatically fails over to a backup and then reconnects to the new primary after election.

## Adding Servers

You can add servers in three ways:

1. **Via the UI** (one-line installer)
	- Go to the Servers tab and click "Add Server…".
	- Optionally set a label, icon, enabled state, and pick groups (or leave automatic grouping on).
	- Copy the pre-configured one-line install command for Docker, Linux, macOS or Windows and run it on the target host.
	- The installer authenticates, installs xySat as a startup service (systemd/launchd/Windows Service), writes the config, and starts the agent.
	- The server appears immediately in the cluster, begins streaming metrics, and can run jobs.
2. **Automated bootstrap** (API Key)
	- For autoscaling or ephemeral hosts, generate an API Key and use your provisioning to call the bootstrap endpoint to fetch a server token and installer command during first boot.
	- See below for details. You can include this in cloud-init, AMIs, Packer templates, or custom init scripts.
3. **Manual install**
	- Install xySat on the host and configure it with your cluster URL and secret key. The secret key is used to generate an auth token. Start the service to join the cluster.
	- This method is typically only used for development, testing and home labs.

Notes:

- Server auth tokens do not expire. You can, however, [rotate your secret key](hosting.md#secret-key-rotation) (which regenerates all tokens) from the UI if needed.
- Software upgrades for xySat are orchestrated from the UI and are designed to avoid interrupting running jobs.

### Automated Server Bootstrap

To automate adding new ephemeral servers to your cluster, follow these steps:

First, create a new [API Key](api.md#api-keys) in the UI, and assign it the [add_servers](privileges.md#add_servers) privilege only (remove all the default privileges).  

Next, click "Add Server" in the UI and copy the Linux installation command.  Do not enter any server options like label, icon or group.

Replace the temporary auth token (which expires after 24 hours) with your new API Key (which won't expire).  The token is the value of the `t` query string parameter in the URL.  Example:

```sh
curl -s "https://xyops01.mycompany.com/api/app/satellite/install?t=API_KEY_HERE" | sudo sh
```

Finally, paste the new command into your server provisioning script, specifically in the first-boot sequence, so it runs on initial startup.

Notes:

- Make sure the new server's networking stack is up before running the bootstrap command.
- After initial download, xySat will install from a local cache and not have to hit the internet for anything (or just use [Air-Gapped Mode](hosting.md#air-gapped-mode)).
- Make sure your servers have `curl` preinstalled.  Alternatively, you can rewrite the command to use `wget`.
- In automated mode your server's hostname will dictate which server groups it gets added to.

### Automated Docker Workers

To automate adding new Docker based workers to your cluster, follow these steps:

First, create a new [API Key](api.md#api-keys) in the UI, and assign it the [add_servers](privileges.md#add_servers) privilege only (remove all the default privileges).

Next, click "Add Server" from the sidebar, select "Docker" as the target platform, and copy the installation command to your clipboard.  Do not enter any server options like label, icon or group.  It will look like this:

```sh
docker run --detach --init --restart unless-stopped -v xysat-conf-12345:/etc/xysat -v /var/run/docker.sock:/var/run/docker.sock -e XYSAT_config_file="/etc/xysat/config.json" -e XYOPS_setup="http://YOUR_XYOPS_SERVER:5522/api/app/satellite/config?t=1234567890abcdefghijk" --name "xyops-worker-12345" --hostname "docker-12345" ghcr.io/pixlcore/xysat:latest
```

Grab the `XYOPS_setup` environment variable from the install command, and replace the temporary auth token (which expires after 24 hours) with your new API Key (which won't expire).  The token is the value of the `t` query string parameter in the URL.  Example:

```
http://YOUR_XYOPS_SERVER:5522/api/app/satellite/config?t=YOUR_API_KEY_HERE
```

You can now use this to spin up as many Docker workers as you want.  Just specify your new URL with API Key as the `XYOPS_setup` environment variable, and use the official `ghcr.io/pixlcore/xysat:latest` Docker image.

Make sure you use a different named volume mount for each server's configuration directory (each server needs its own).

Here is an example using Docker Compose:

```yaml
services:
  worker1:
    image: ghcr.io/pixlcore/xysat:latest
    init: true
    restart: unless-stopped
    volumes:
      - xysat-conf-worker1:/etc/xysat
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      XYSAT_config_file: /etc/xysat/config.json
      XYOPS_setup: http://YOUR_XYOPS_SERVER:5522/api/app/satellite/config?t=YOUR_API_KEY_HERE

  worker2:
    image: ghcr.io/pixlcore/xysat:latest
    init: true
    restart: unless-stopped
    volumes:
      - xysat-conf-worker2:/etc/xysat
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      XYSAT_config_file: /etc/xysat/config.json
      XYOPS_setup: http://YOUR_XYOPS_SERVER:5522/api/app/satellite/config?t=YOUR_API_KEY_HERE

  worker3:
    image: ghcr.io/pixlcore/xysat:latest
    init: true
    restart: unless-stopped
    volumes:
      - xysat-conf-worker3:/etc/xysat
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      XYSAT_config_file: /etc/xysat/config.json
      XYOPS_setup: http://YOUR_XYOPS_SERVER:5522/api/app/satellite/config?t=YOUR_API_KEY_HERE
```

All workers can use the same exact `XYOPS_setup` value and API Key.  Each request generates a new unique Server ID and permanent Auth Token, which are stored in the config file.

Note that the `XYOPS_setup` bootstrap process is only needed for the first launch of new containers.  If the config file exists, the setup process is silently skipped.

## Groups and Auto-Assignment

Servers can belong to one or more groups. Groups are used for organizing the fleet, scoping monitors/alerts, and targeting events.

- **Auto-assignment**: Groups can declare a hostname regular expression. When a server comes online (or when its hostname changes), matching groups are applied automatically.
- **Multiple groups**: Servers can match and join multiple groups.
- **Manual assignment**: If you manually assign groups to a server, automatic hostname-based matching is disabled for that server. You can re-enable auto-assignment by clearing the manual groups.
- **Re-evaluation**: Group matches are re-evaluated if a server's hostname changes.

See [Server Groups](groups.md) for more details on server groups.

## Targeting Events at Servers

Events specify targets as a list containing server IDs and/or group IDs. At run time, the scheduler resolves these into the set of currently online, enabled servers, then picks one using the event's selection algorithm (random, round_robin, least_cpu, least_mem, or a monitor-based policy). See [Event.targets](data.md#event-targets) and [Event.algo](data.md#event-algo).

Behavior when servers are offline:

- **Single-server target**: If the target server is offline, behavior is user-configurable via limits: add a Queue limit to allow queuing; without one, the job fails immediately.
- **Group target**: Offline servers are ignored; alternate online servers from the group are selected.

Alerts can optionally suppress job launches on a specific server, so a server under alert may be excluded from selection until it clears.  This feature is configured at the alert level (see [Alerts](alerts.md) for more details).

## Max Jobs Per Server

You can set a *per-server* maximum concurrent job limit.  So for example you can configure some of your underpowered servers to limit the number of jobs they can run concurrently.  This can be configured on the server details page by clicking the "Edit Server" button, or via the [update_server](api.md#update_server) API.  The default is no limit.

When a server is maxed out and a new job is starting, the way it works is that the server is "removed" from consideration when the server is being chosen from the event targets.  So any alternate servers with available "slots" will be chosen instead (assuming your event targets have multiple servers or groups).

If no servers are available due to max jobs, the behavior is the same as if the servers were unavailable for other reasons (i.e. servers offline, or blocked due to active alerts, etc.).  If the event has [queuing](limits.md#max-queue-limit) enabled, then the job will automatically queue up until a server becomes available.

You can also set defaults for the max jobs per server at the group level, so you don't have to edit each of your servers individually.  To do this, simply edit the group, and you will see a new "Max Jobs Per Server" field.  If a server is a member of multiple groups, the group with the lowest max jobs per server prevails.

## User Data

xyOps can store arbitrary data with each server, which is called the "user data".  This is a freeform object stored as JSON, which can contain any data you want (including nested objects / arrays).  The user data is automatically passed to all running jobs on the server (see [Job.serverData](data.md#job-serverdata)), and can also be used for custom event targeting.

You can add or update the server data in a number of ways:

- In the UI, on the server details page, click the "Edit Server" button.
- By calling the [update_server_data](api.md#update_server_data) API.
- Inside a running job (i.e. Event Plugin) by outputting a `serverData` object (see [Updating The Server Data](plugins.md#server-data)).

Note that all server data for all active servers is stored in memory on the primary conductor server, so it is best to keep the size reasonable.

## Server UI

Each server has a dedicated page in the xyOps UI showing live and historical state:

- **Status**: Online/offline badge, label/hostname, IP, OS/arch, CPU details, memory, virtualization, agent version, uptime, and groups.
- **Quick metrics** (per second): Small rolling graphs for CPU, memory, disk, and network over the last 60 seconds.
- **Monitors** (per minute): Charts for all user-defined monitors and deltas, with alert overlays.
- **Processes**: Current process table showing PID / parent / CPU / memory / network, and other metrics for each process.
- **Connections**: Current network connections showing state, source and dest IPs, and transfer metrics.
- **Running jobs**: Live jobs executing on the server, including workflow parents/children.
- **Upcoming jobs**: Predicted jobs scheduled to land on this server (based on event targets and schedule).
- **Alerts**: Active alerts affecting this server, with links to history.
- **User Actions**: Take a snapshot, set a watch, edit server details (label, enable/disable, icon, groups), or delete the server.

Search the fleet and history from Servers → Search. You can filter by group, OS platform/distro/release/arch, CPU brand/cores, and created/modified ranges.

## Snapshots and Watches

Snapshots capture the current state of a server and save it for later inspection and comparison. They're available on the Snapshots area, and when linked from actions or alerts.

What a snapshot contains:

- Full process list (ps -ef equivalent), network connections (including listeners), disk mounts, network devices.
- Host facts: CPU type, core count, max RAM, OS platform/distro/release, uptime, load, etc.
- The last 60 seconds of "quick" metrics (per-second CPU/Mem/Disk/Net).
- References to active jobs and relevant alerts at capture time.

How snapshots are created:

- Manually: Click "Create Snapshot" on a server page.
- Actions: Add a Snapshot action to a job or alert; the system can take snapshots when conditions are met.
- Watch: Start a watch on a server to take a snapshot every minute for a duration (default 5 minutes).

Retention:

- Snapshots are retained up to a global cap (default 100,000 snaps) and pruned nightly.

See [Snapshots](snapshots.md) for more details.

## Metrics and Sampling

- Per second ("quick"): CPU, memory, disk, and network; retained in a rolling 60-second in-memory buffer for UI.
- Per minute (monitors): User-defined monitor plugins run each minute on servers to produce numeric values (or deltas). These feed charts, alerts, and dashboards. See [Monitors](monitors.md).
- OS differences: Some metrics are not available on Windows.

To avoid thundering herd effects on conductors, each server deterministically staggers its minute collection offset using a hash of its Server ID plus a dynamically computed offset. This spreads submissions evenly across N seconds, which is based on the total number of servers in the cluster.  The quick second metrics also do this, but stagger in milliseconds.

## Lifecycle and Health

- **Online/offline**: A server is online while its xySat WebSocket is connected. If the socket drops, the server is immediately marked offline. The UI updates in real time.
- **Running jobs**: Jobs are not aborted immediately when a server goes offline. Instead, conductors wait for `dead_job_timeout` before declaring the job dead and aborting it (default: 120 seconds). See [Configuration](config.md#dead_job_timeout).
- **Enable/disable**: Disabling a server removes it from job selection but it can remain online and continue reporting metrics.

## Scalability

xyOps is designed for large fleets and has been tested up to hundreds of servers per cluster. For larger clusters:

- Deterministic staggering ensures not all servers submit minute and second samples at once; load is spread evenly over a dynamic time window.
- Conductors should run on strong hardware (CPU/RAM/SSD) for best performance when ingesting and aggregating data, running elections, and serving the UI/API.
- You can operate multiple conductors (primary + hot standby peers). Agents auto-failover between them; the cluster performs election to select a new primary as needed.

Also see the [Scaling](scaling.md) guide.

## Decommissioning Servers

To retire a server, open its detail page and click the trash can icon:

- **Online**: The conductor sends an uninstall command to the agent, which shuts down and removes xySat. You can also optionally delete historical data (server record, metrics, snapshots).
- **Offline**: You can still delete the server but must opt to delete history, as uninstall requires an active connection.

Deletions are permanent and cannot be undone.

## Related Data and APIs

- Data: [Server](data.md#server), [ServerMonitorData](data.md#servermonitordata), [Snapshot](data.md#snapshot), [Group](data.md#group).
- Servers API: [get_active_servers](api.md#get_active_servers), [get_active_server](api.md#get_active_server), [get_server](api.md#get_server), [update_server](api.md#update_server), [delete_server](api.md#delete_server), [watch_server](api.md#watch_server), [create_snapshot](api.md#create_snapshot).
- Search: [search_servers](api.md#search_servers), server summaries, and snapshots search.
