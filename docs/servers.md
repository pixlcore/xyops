# Servers

Servers are the worker nodes in a xyOps cluster. Each server runs our lightweight satellite agent (xySat), maintains a persistent WebSocket connection to the master, collects monitoring metrics, and executes jobs on demand. A server may be a physical host, virtual machine, or container, and can run Linux, macOS, or Windows.

This document explains how servers fit into xyOps, how to add and organize them, how events target servers, what you can see on each server’s UI page, and how the system scales to large fleets.

## Overview

- Servers run xySat and act as job runners and metrics collectors.
- Masters run the full xyOps stack and coordinate scheduling, routing, storage, and UI.
- You can add any number of servers and masters to a cluster; agents maintain live connections and auto-failover across masters.
- Servers collect “quick” metrics every second (CPU/Mem/Disk/Net) and minute-level metrics via user-defined monitor plugins. Some metrics are not available on Windows.

## Servers vs. Masters

- **Server**: A worker node running xySat. It reports host details and metrics, and executes jobs sent by a master. Servers may be grouped and targeted by events.
- **Master**: A full xyOps instance (primary or hot standby) that manages the schedule, routes jobs to servers, stores data, and serves the UI/API. A cluster can have multiple masters for redundancy; one is primary at any time.

xySat keeps an up-to-date list of all masters. If a server loses its master connection, it automatically fails over to a backup and then reconnects to the new primary after election.

## Adding Servers

You can add servers in three ways:

1. **Via the UI** (one-line installer)
	- Go to the Servers tab and click “Add Server…”.
	- Optionally set a label, icon, enabled state, and pick groups (or leave automatic grouping on).
	- Copy the pre-configured one-line install command for Linux/macOS or Windows and run it on the target host.
	- The installer authenticates, installs xySat as a startup service (systemd/launchd/Windows Service), writes the config, and starts the agent.
	- The server appears immediately in the cluster, begins streaming metrics, and can run jobs.
2. **Automated bootstrap** (API Key)
	- For autoscaling or ephemeral hosts, generate an API Key and use your provisioning to call the bootstrap endpoint to fetch a server token and installer command during first boot.
	- See [API](api.md) for authentication and server APIs. You can include this in cloud-init, AMIs, Packer templates, or custom init scripts.
3. **Manual install**
	- Install xySat on the host and configure it with your cluster URL and secret key. The secret is exchanged for a permanent auth token. Start the service to join the cluster.

Notes:

- Server auth tokens do not expire. You can, however, rotate your secret key (which also regenerates all tokens) from the UI if needed.
- Software upgrades for xySat are orchestrated from the UI and are designed to avoid interrupting running jobs.

## Groups and Auto‑Assignment

Servers can belong to one or more groups. Groups are used for organizing the fleet, scoping monitors/alerts, and targeting events.

- **Auto‑assignment**: Groups can declare a hostname regular expression. When a server comes online (or when its hostname changes), matching groups are applied automatically.
- **Multiple groups**: Servers can match and join multiple groups.
- **Manual assignment**: If you manually assign groups to a server, automatic hostname-based matching is disabled for that server. You can re-enable auto‑assignment by clearing the manual groups.
- **Re‑evaluation**: Group matches are re-evaluated if a server’s hostname changes.

See [Server Groups](groups.md) for more details on server groups.

## Targeting Events at Servers

Events specify targets as a list containing server IDs and/or group IDs. At run time, the scheduler resolves these into the set of currently online, enabled servers, then picks one using the event’s selection algorithm (random, round_robin, least_cpu, least_mem, or a monitor-based policy). See [Event.targets](data.md#event-targets) and [Event.algo](data.md#event-algo).

Behavior when servers are offline:

- **Single-server target**: If the target server is offline, behavior is user-configurable via limits: add a Queue limit to allow queuing; without one, the job fails immediately.
- **Group target**: Offline servers are ignored; alternate online servers from the group are selected.

Alerts can optionally suppress job launches on a specific server, so a server under alert may be excluded from selection until it clears.  This feature is configured at the alert level (see [Alerts](alerts.md) for more details).

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

Snapshots capture the current state of a server and save it for later inspection and comparison. They’re available on the Snapshots area, and when linked from actions or alerts.

What a snapshot contains:

- Full process list (ps -ef equivalent), network connections (including listeners), disk mounts, network devices.
- Host facts: CPU type, core count, max RAM, OS platform/distro/release, uptime, load, etc.
- The last 60 seconds of “quick” metrics (per-second CPU/Mem/Disk/Net).
- References to active jobs and relevant alerts at capture time.

How snapshots are created:

- Manually: Click “Create Snapshot” on a server page.
- Actions: Add a Snapshot action to a job or alert; the system can take snapshots when conditions are met.
- Watch: Start a watch on a server to take a snapshot every minute for a duration (default 5 minutes).

Retention:

- Snapshots are retained up to a global cap (default 100,000 snaps) and pruned nightly.

See [Snapshots](snapshots.md) for more details.

## Metrics and Sampling

- Per second (“quick”): CPU, memory, disk, and network; retained in a rolling 60-second in-memory buffer for UI.
- Per minute (monitors): User-defined monitor plugins run each minute on servers to produce numeric values (or deltas). These feed charts, alerts, and dashboards. See [Monitors](monitors.md).
- OS differences: Some metrics are not available on Windows.

To avoid thundering herd effects on masters, each server deterministically staggers its minute collection offset using a hash of its Server ID plus a dynamically computed offset. This spreads submissions evenly across N seconds, which is based on the total number of servers in the cluster.  The quick second metrics also do this, but stagger in milliseconds.

## Lifecycle and Health

- **Online/offline**: A server is online while its xySat WebSocket is connected. If the socket drops, the server is immediately marked offline. The UI updates in real time.
- **Running jobs**: Jobs are not aborted immediately when a server goes offline. Instead, masters wait for `dead_job_timeout` before declaring the job dead and aborting it (default: 120 seconds). See [Configuration](config.md#dead_job_timeout).
- **Enable/disable**: Disabling a server removes it from job selection but it can remain online and continue reporting metrics.

## Scalability

xyOps is designed for large fleets and has been tested up to hundreds of servers per cluster. For larger clusters:

- Deterministic staggering ensures not all servers submit minute and second samples at once; load is spread evenly over a dynamic time window.
- Masters should run on strong hardware (CPU/RAM/SSD) for best performance when ingesting and aggregating data, running elections, and serving the UI/API.
- You can operate multiple masters (primary + hot standby peers). Agents auto-failover between them; the cluster performs election to select a new primary as needed.

Also see the [Scaling](scaling.md) guide.

## Decommissioning Servers

To retire a server, open its detail page and click the trash can icon:

- **Online**: The master sends an uninstall command to the agent, which shuts down and removes xySat. You can also optionally delete historical data (server record, metrics, snapshots).
- **Offline**: You can still delete the server but must opt to delete history, as uninstall requires an active connection.

Deletions are permanent and cannot be undone.

## Related Data and APIs

- Data: [Server](data.md#server), [ServerMonitorData](data.md#servermonitordata), [Snapshot](data.md#snapshot), [Group](data.md#group).
- Servers API: [get_active_servers](api.md#get_active_servers), [get_active_server](api.md#get_active_server), [get_server](api.md#get_server), [update_server](api.md#update_server), [delete_server](api.md#delete_server), [watch_server](api.md#watch_server), [create_snapshot](api.md#create_snapshot).
- Search: [search_servers](api.md#search_servers), server summaries, and snapshots search.
- Automation: See [API](api.md) for API Keys and bootstrap patterns for autoscaling and ephemeral workers.
