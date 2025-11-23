# xyOps Documentation Index

Welcome to the xyOps documentation. xyOps is a job scheduler, workflow engine, and server monitoring platform with a built‑in web UI and REST API. This index organizes the docs into logical sections with short summaries to help you find what you need quickly. If you are deploying xyOps, start with Self‑Hosting.

## Getting Started

- [Self‑Hosting](hosting.md): Install xyOps with Docker, add workers, configure TLS, storage, and production settings.
- [Configuration](config.md): All server configuration options, override layers, and where settings live on disk.
- [Scaling](scaling.md): Best practices for running at scale, hardware sizing, caching, and multi‑master.
- [Command Line](cli.md): Service control commands and admin utilities available via `bin/control.sh`.
- [Cronicle](cronicle.md): Migrate from Cronicle, enable compatibility mode, and optional UI white‑labeling.
- [Recipes](recipes.md): Practical patterns like continuous jobs and error handling you can copy and adapt.

## Core Concepts

- [Events](events.md): Define what to run, where, when, and how; the foundation that launches jobs.
- [Workflows](workflows.md): Visual graphs that orchestrate multiple jobs with control flow, fan‑out/in, and limits.
- [Triggers](triggers.md): Schedules, intervals, single‑shot, manual, ranges, blackout windows, and precision options.
- [Limits](limits.md): Self‑imposed runtime constraints (time, output, CPU, memory) and retry/queue controls.
- [Actions](actions.md): Reactions to job outcomes and alert state changes (email, web hook, run job, ticket, snapshot, channel).
- [Channels](channels.md): Reusable bundles of notifications and follow‑up actions referenced from actions.
- [Categories](categories.md): Organize events/workflows, apply default actions/limits, and control visibility.
- [Tags](tags.md): Labels for events/jobs for search, filtering, limits, and conditional actions.
- [Buckets](buckets.md): Durable JSON + files storage for sharing data and artifacts between jobs and workflows.
- [Secrets](secrets.md): Encrypted variables for jobs, plugins, and web hooks; assignment and runtime delivery.

## Monitoring & Operations

- [Servers](servers.md): Worker nodes (xySat) that execute jobs, stream metrics, and participate in failover.
- [Server Groups](groups.md): Logical sets of servers for targeting, default alert actions, and group‑level views.
- [Monitors](monitors.md): Minute‑level time‑series metrics defined by expressions, used for graphs and alerts.
- [Alerts](alerts.md): Evaluate live data per server and trigger actions when expressions match.
- [Snapshots](snapshots.md): Point‑in‑time captures of server or group state for forensics and comparisons.
- [Tickets](tickets.md): Lightweight issues/runbooks integrated with jobs, alerts, files, and automation.

## Plugins & Integrations

- [Plugins](plugins.md): Extend xyOps in any language; event and monitor plugin APIs, parameters, and I/O.
- [Marketplace](marketplace.md): Publish and discover plugins; packaging, hosting, and requirements.
- [Web Hooks](webhooks.md): Outbound HTTP requests from jobs and alerts with templated headers and bodies.

## API & Data

- [REST API](api.md): REST API endpoints, API keys, authentication, and standard response format.
- [Data Structures](data.md): Complete schemas for all xyOps objects (jobs, events, users, servers, alerts, etc.).

## Access & Identity

- [Users and Roles](users.md): Account model, roles, resource restrictions, preferences, and avatars.
- [Privileges](privileges.md): Full list of privileges and what each grants across the application.
- [SSO Setup](sso.md): Single Sign‑On integration and external identity provider setup.

## File Formats and Protocols

- [xyOps Expression Format](xyexp.md): JEXL‑based expressions and helper functions used across the system.
- [xyOps Portable Data Format](xypdf.md): Export/import format (XYPDF) for moving objects between systems.
- [xyOps Wire Protocol](xywp.md): JSON over STDIO contract for plugins communicating with xyOps/xySat.

## Developer Guides

- [Development](dev.md): Architecture overview, component list, client framework, and local dev setup.
- [Security](security.md): How to report xyOps vulnerabilities responsibly.

## Meta

- [GitHub Project](https://github.com/pixlcore/xyops/blob/main/README.md): Opens source GitHub project overview.
- [Longevity](https://github.com/pixlcore/xyops/blob/main/LONGEVITY.md): Project longevity and forever license pledge.
- [Governance](governance.md): Project governance, contribution expectations, and decision‑making.
- [Code of Conduct](https://github.com/pixlcore/xyops/blob/main/CODE_OF_CONDUCT.md): Contributor Covenant Code of Conduct
- [License](https://github.com/pixlcore/xyops/blob/main/LICENSE.md): Open source BSD 3-Clause license (OSI-approved).
- [Trademarks](https://github.com/pixlcore/xyops/blob/main/TRADEMARKS.md): xyOps, xySat and PixlCore are trademarks.
