# Privileges

xyOps uses a simple, flexible privilege system to control access to features. Privileges can be assigned directly to Users and API Keys, and Roles can bundle sets of privileges that are then attached to Users and API Keys. The effective permission set is the union of all directly assigned privileges plus those granted by any roles. The special `admin` privilege grants full access to all features.

Note: Some operations also enforce resource-level access (e.g., category, group, or target restrictions). Having a privilege is necessary, but certain actions may additionally require access to the specific resource.

## Special

### admin
Full administrator access; implies all privileges and bypasses normal restrictions.

## Alerts

### create_alerts
Create new alert definitions that evaluate monitor data and trigger actions.

### edit_alerts
Edit existing alert definitions, including expressions, messages, and settings.

### delete_alerts
Delete alert definitions and remove their associated configuration.

## Buckets

### create_buckets
Create new data storage buckets for artifacts or structured data.

### edit_buckets
Edit existing buckets, including metadata, data payload, and file lists.

### delete_buckets
Delete buckets, including all associated data and files.

## Categories

### create_categories
Create new event categories that define defaults and organization.

### edit_categories
Edit existing categories and their defaults (limits, actions, colors, etc.).

### delete_categories
Delete categories from the system (subject to normal references and usage).

## Channels

### create_channels
Create outbound notification channels (e.g., email, web hook destinations).

### edit_channels
Edit existing notification channels and their delivery settings.

### delete_channels
Delete notification channels from the system.

## Events

### create_events
Create new events and workflows, including schedules, targets, and plugin settings.

### edit_events
Edit existing events and workflows, including schedules, limits, actions, and parameters.

### delete_events
Delete events and workflows (optionally including associated jobs where applicable).

## Groups

### create_groups
Create new server groups for organizing and targeting servers.

### edit_groups
Edit existing server groups, including titles, rules, and alert settings.

### delete_groups
Delete server groups from the system.

## Jobs

### run_jobs
Run events on demand and upload pre-run input files for jobs.

### abort_jobs
Abort running jobs.

### delete_jobs
Delete jobs and their associated files or logs (where applicable).

### tag_jobs
Add or update tags on completed jobs.

### comment_jobs
Add, edit, or delete comments on completed jobs.

## Monitors

### create_monitors
Create new monitors that collect and process server or application metrics.

### edit_monitors
Edit existing monitors, including expressions, matching rules, and settings.

### delete_monitors
Delete monitors from the system.

## Plugins

### create_plugins
Create new plugins (event, monitor, action, or scheduler types).

### edit_plugins
Edit existing plugin definitions and their configuration.

### delete_plugins
Delete plugins from the system.

## Roles

### create_roles
Create new roles that bundle sets of privileges.

### edit_roles
Edit existing roles, including titles and assigned privileges.

### delete_roles
Delete roles from the system.

## Tags

### create_tags
Create system tags for organizing events, jobs, and related data.

### edit_tags
Edit existing tags.

### delete_tags
Delete tags from the system.

## Tickets

### create_tickets
Create new tickets for tracking tasks, reviews, or follow-ups.

### edit_tickets
Edit existing tickets, including subject, details, assignees, and status.

### delete_tickets
Delete tickets from the system.

## Web Hooks

### create_web_hooks
Create new web hooks for outgoing notifications and integrations.

### edit_web_hooks
Edit existing web hooks and their request details.

### delete_web_hooks
Delete web hooks from the system.

## Servers

### create_snapshots
Create on-demand server snapshots and set/cancel watches that take periodic snapshots.
