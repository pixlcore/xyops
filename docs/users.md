# Users and Roles

## Overview

This document explains how user accounts, roles, and permissions work in xyOps. The platform includes account management (creation, login, sessions, password reset) and extends it with roles, resource restrictions, security logging, avatars, and admin tooling.

- Core account system: built-in authentication, session management, and password workflows.
- Extensions: roles and effective privileges, category/group restrictions, user security log, "Logout All Sessions", avatars, and rich UI preferences.
- Admins manage users and roles in the Admin UI; all changes are enforced by the backend.

See also:

- [User](data.md#user) and [Role](data.md#role) object definitions.
- [Privilege List](privileges.md)
- [SSO Integration](sso.md)

## User Profile

Each user represents one human account. The profile combines identity, authentication, permissions, and UI preferences. For the full JSON schema, see [User](data.md#user).

- **Identity**: `username` (unique), `full_name` (display name), `email` (contact).
- **Status**: `active` (true/false for active/suspended). Suspended users cannot log in.
- **Authentication**: `password` (bcrypt hash), `salt` (per-user). Plaintext passwords are never stored.
- **Roles**: `roles` array of role IDs; see Roles below.
- **Privileges**: `privileges` object (keys grant capabilities). See [Privileges](privileges.md).
- **Resource limits**: `categories` and `groups` arrays optionally restrict access to event categories and server groups.
- **Preferences**: UI/locale options including `language`, `region`, `num_format`, `hour_cycle`, `timezone`, `color_acc`, `flat_acc`, `privacy_mode`, `effects`, `contrast`, `motion`, `volume`, and saved `searches`.
- **Avatar**: Optional profile image. Upload/replace in the UI.

Notes:

- The special privilege `admin` grants full access to all current and future capabilities, and bypasses category/group restrictions.
- xyOps may set internal flags for SSO-managed accounts (e.g., `remote`, `sync`); see [SSO](sso.md) for details.

## Roles

A role bundles a set of privileges and optional resource restrictions. Assign roles to users to simplify permission management. For the full JSON schema, see [Role](data.md#role).

- **Privileges**: A role's `privileges` object contributes privileges to assigned users.
- **Category restrictions**: `categories` can limit access to specific event categories.
- **Group restrictions**: `groups` can limit access to specific server groups.
- **Enabled flag**: Only enabled roles contribute to a user's effective permissions.

Admins can create, edit, enable/disable, and delete roles in the Admin UI. When roles change, user sockets are updated so active sessions reflect new permissions right away.

## Effective Permissions

xyOps computes a user's effective authorization by combining direct assignments with role grants.  Privileges are additive when merged with assigned roles.

- Privilege union: Account and role privileges are merged.
- Category and group limits: If not assigned, user has access to "all" categories or groups.
- Admin override: If `admin` is true, directly or inherited by role, the user can perform any action and is not limited by category/group restrictions.

How enforcement works:

- API checks: The backend enforces privileges on every call, and resource checks for categories/groups/targets.
- UI filtering: Lists and controls in the UI respect effective permissions and resource limits; inaccessible items are hidden or blocked.

For the complete list of privilege IDs the system recognizes, see [Privileges](privileges.md). The `admin` privilege is special and implies all others.

## Resource Restrictions

Users can be limited to specific event categories and/or server groups:

- Categories: If a user/role defines any `categories`, the user can only see and operate on events in those categories. With none defined, all categories are allowed (unless otherwise prohibited by privileges).
- Groups: If a user/role defines any `groups`, each explicitly listed target must be allowed when creating, updating, or manually running events, changing live job targets, releasing delayed jobs, or resuming suspended jobs. Event and job reads still require only one matching target, and access to a server requires only one matching group membership. With no group restrictions defined, all groups are allowed (subject to privileges). Execution target checks compare IDs directly; they do not resolve individual server IDs to group memberships.
- Runtime targeting: Group-limited accounts cannot use `_xy_override_targets` or a forced `server`, even for an allowed destination. This includes saved events, workflow nodes, user fields, trigger parameters, and plugin parameter defaults. Administrators and accounts without group restrictions can continue using these features. The `_xy_override_server` parameter is reserved and cannot be used by any account.
- Admin bypass: Administrators are not limited by category/group restrictions.

Typical scenarios:

- Department scoping: Assign users to roles that permit only the "Dev" or "Ops" categories.
- Environment separation: Restrict specific users to the "Staging" group but not "Production".

### Legacy Group Limits and Workflows

Server group limits are a legacy compatibility feature inherited from Cronicle. Workflows are newer and may contain nested sub-workflows, so they use a deliberately simpler read policy:

- Workflow reads: Group-limited users may view workflow definitions and parent workflow jobs. Category-limited users may view them only when the workflow's top-level category is in scope. Categories and groups used by nested nodes do not affect read visibility.
- Workflow writes and manual runs: Creating, updating, or manually running a workflow recursively checks every reachable Event Node and Job Node, including nodes in nested sub-workflows. The user must have access to the referenced categories, every saved event target, and every node-level target override.
- Cyclic references: Recursive validation safely detects already visited sub-workflows, so cyclic workflow references do not cause an infinite loop.

This keeps workflow lists and live workflow pages practical on installations with thousands of events, while still preventing limited users from creating, modifying, or manually launching work outside their assigned scope.

## Sessions and Authentication

xyOps handles account creation, login, session management, and password reset, and also adds activity logging and related features.

- Expiration: Sessions expire per the [User.session_expire_days](config.md#user-session_expire_days) configuration setting.
- Lockouts: Multiple failed logins per hour trigger a lockout requiring password reset (configurable). Admins can "Reset Lockouts" on a user.
- Password management: Users can change their password (must provide current password). Forgot/reset flows are supported via email templates.
- Single Sign-On: xyOps supports trusted-header SSO via a proxy (e.g., OAuth2-Proxy) or an SSO Plugin (e.g., the OIDC Plugin), can auto-assign roles/privileges based on IdP groups, and can redirect on logout. Local username/password login is disabled when SSO is enabled unless hybrid mode is also enabled. See [SSO](sso.md).
- Hybrid login: With a supported SSO Plugin, administrators can enable a login-screen choice between local accounts and SSO. Local sessions return to the login screen on logout; SSO sessions follow the configured external logout URL. See [Hybrid Login](sso.md#hybrid-login).

## Security Log

xyOps records account-related activity in a per-user security log and a system-wide activity log.

- User security log: Includes actions like login, profile updates, password changes, notices/warnings, and IP/user-agent metadata. Viewable in the UI under Security Log".
- System activity log: A broader audit log for all system actions (admin-facing).
- Parsed user agents: The UI shows friendly user agent strings when available.

Logout All Sessions:

- Users can invalidate all their other sessions after entering their current password. The current session remains active.
- Admins can force a "Logout All Sessions" for any user. This also sends a summary email if sessions were terminated.

## Admin Tasks

Administrators can perform the following actions from the Admin UI or equivalent APIs:

- **Create users**: Set username, display name, email, initial password, privileges/roles; optionally send welcome email.
- **Edit users**: Update profile, change password, adjust privileges/roles, assign category/group restrictions, toggle active/suspended.
- **Unlock accounts**: Reset lockouts and clear throttles if an account was locked due to failed logins.
- **Delete users**: Removes the account and deletes the user's security log; active sockets are closed.
- **Force logout**: Enqueue a background job to terminate all other sessions for a user.
- **Manage roles**: Create/update roles with privileges and category/group limits; enable/disable roles.
