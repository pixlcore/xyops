# Categories

## Overview

Categories group related events and workflows, and are completely user-defined. Each event/workflow belongs to exactly one category. Categories aid navigation and search, control visibility (via roles), provide visual separation, and can define default actions and limits for everything inside.

## Key Points

- Create as many custom categories as you like.
- One category is assigned to each event/workflow (workflows behave like events in this case).
- Defaults: category [Actions](actions.md) and [Limits](limits.md) auto-apply to all contained jobs. 
	- Event → Category → Universal is the precedence for start-time limits; runtime limits can stack. 
	- Actions are deduplicated by type/target.
- Visuals: optional color and icon. The color appears as a background tint in event lists and running job lists. Icons come from Material Design Icons.
- Enable/Disable: disabling a category prevents scheduling and launching for all events/workflows in it.
- Order: Categories have a "sort order" which carries over to the event / workflow lists.

Minimal category example (JSON format):

```json
{
  "id": "prod",
  "title": "Production",
  "enabled": true,
  "color": "red",
  "actions": [
    { "enabled": true, "condition": "error", "type": "email", "users": ["oncall"] }
  ],
  "limits": [
    { "enabled": true, "type": "time", "duration": 3600, "abort": true }
  ]
}
```

See the full data shape: [Category](data.md#category)

## Defaults: Actions and Limits

Categories can carry default job actions and resource limits that apply to all events and workflows in the category when jobs launch.

- **Actions**
  - Combined with event-level and universal actions; duplicates are deduped by type/target. See [Actions](actions.md).
  - Common uses: email on `error`, fire a `web_hook` on `critical`, or kick off a cleanup event on `warning`.
- **Limits**
  - Serve as defaults; events/workflows may add more or override by type. See [Limits](limits.md).
  - Start-time precedence: Event/Workflow → Category → Universal.
  - Runtime limits (time/log/mem/cpu) can stack and trigger independently.

## Visuals: Color and Icon

- **Color** adds a background tint in event lists and running job lists. Available color IDs are `plain`, `red`, `fire`, `orange`, `tangerine`, `amber`, `gold`, `yellow`, `lemon`, `lime`, `grass`, `green`, `mint`, `emerald`, `aqua`, `teal`, `turquoise`, `cyan`, `ice`, `skyblue`, `azure`, `blue`, `sapphire`, `indigo`, `lavender`, `violet`, `orchid`, `purple`, `magenta`, `fuchsia`, `hotpink`, `pink`, `blush`, `rose`.
- **Icon**: optional [Material Design Icon](https://pictogrammers.com/library/mdi/) ID (e.g., `folder-outline`, `shield-alert-outline`). Icons are visual only.

## Enable/Disable Behavior

- Enabled categories: jobs schedule and launch normally.
- Disabled categories: scheduler will not trigger contained events, and manual runs are blocked even if the event is enabled.

## Managing

- UI: Admin → Categories. Create/edit title, enabled, icon, color, notes, default actions and limits. Drag to reorder. Delete only when no events reference it. Import/Export JSON supported.
- API: list, fetch, create, update, reorder, delete -- see [API: Categories](api.md#categories).
- Privileges: [create_categories](privileges.md#create_categories), [edit_categories](privileges.md#edit_categories), [delete_categories](privileges.md#delete_categories).

## API Quick Reference

- `GET /api/app/get_categories/v1`: list all categories.
- `GET /api/app/get_category/v1`: fetch one by `id`.
- `POST /api/app/create_category/v1`: create (validates embedded `limits`/`actions`).
- `POST /api/app/update_category/v1`: shallow-merge updates; updates `modified` and `revision`.
- `POST /api/app/delete_category/v1`: delete; blocked if any events reference it.

## Examples

Two categories with different defaults, and an event that overrides concurrency while inheriting the rest:

```json
// Category: Production
{
  "id": "prod",
  "title": "Production",
  "enabled": true,
  "color": "red",
  "icon": "shield-alert-outline",
  "actions": [
    { "enabled": true, "condition": "error", "type": "email", "users": ["oncall"] },
    { "enabled": true, "condition": "critical", "type": "web_hook", "web_hook": "slack_ops" }
  ],
  "limits": [
    { "enabled": true, "type": "retry", "amount": 2, "duration": 60 },
    { "enabled": true, "type": "time",  "duration": 3600, "abort": true }
  ]
}

// Category: Staging
{
  "id": "staging",
  "title": "Staging",
  "enabled": true,
  "color": "skyblue",
  "actions": [
    { "enabled": true, "condition": "error", "type": "email", "users": ["dev"] }
  ],
  "limits": [
    { "enabled": true, "type": "job", "amount": 3 }
  ]
}

// Event (in prod) overriding concurrency
{
  "id": "deploy_app",
  "title": "Deploy Application",
  "enabled": true,
  "category": "prod",
  "plugin": "shellplug",
  "limits": [ { "enabled": true, "type": "job", "amount": 1 } ],
  "actions": []
}
```

At launch, `deploy_app` gets the event's `job` limit, plus prod's `retry` and `time` limits, and prod's actions. Universal defaults (if configured) append after category defaults.
