# Web Hooks

## Overview

Web hooks in xyOps are outbound HTTP requests that fire in response to job and alert activity. They integrate xyOps with external systems such as Slack, Discord, Pushover, incident and chat systems, or any custom HTTP endpoint you control.

- **Fully customizable request**: URL, method, headers, and body are user-defined and support templating (macros).
- **Action-driven**: Jobs and alerts trigger hooks based on conditions (start, outcomes, tags, suspensions, limits, alert fired/cleared, etc.).
- **Observable**: Each execution records success/failure, timing, request/response, and a performance breakdown.


## When Hooks Fire

Attach a "Web Hook" action to jobs (events/workflows) or alerts. Hooks can fire on:

- **Job start**: `start` (before remote launch).
- **Job completion**: `complete`, or specific outcomes `success`, `error`, `warning`, `critical`, `abort`.
- **Job tag**: `tag:TAGID` (on completion and tag present).
- **Job suspensions**: when a job is suspended for human intervention.
- **Job resource limits**: when limits are exceeded (max memory / max cpu / max elapsed / max output).
- **Alerts**: `alert_new` when an alert is created, and `alert_cleared` when it clears.

Notes:

- Actions are deduplicated by type + target (e.g., same hook ID) across event/category/universal sources.
- For jobs, completion actions only fire if the job was not retried.


## Defining a Web Hook

A web hook definition is reusable and referenced by actions. Core properties (see full schema in [WebHook](docs/data.md#webhook)):

- `id`: Unique alphanumeric ID (auto-generated).
- `title`: Display title.
- `enabled`: Enable/disable without deleting.
- `icon`: Optional [Material Design Icons](https://pictogrammers.com/library/mdi/) id for display.
- `url`: Fully-qualified `http://` or `https://` endpoint. Templating supported; placeholders are URL-encoded automatically.
- `method`: HTTP verb (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`).
- `headers`: Array of `{ name, value }`. Values support templating.
- `body`: Optional request body as a string. Templating supported. Sent for non-GET/HEAD when non-empty.
- `timeout`: Seconds to wait for first byte and idle socket (TTFB + idle).
- `retries`: Number of automatic retries on transport errors.
- `follow`: Auto-follow redirects (numeric cap internally; off when false).
- `ssl_cert_bypass`: If true, disables TLS verification (`rejectUnauthorized: false`).
- `max_per_day`: Daily cap on executions for anti-flooding (0 = unlimited).
- `notes`: Free-form notes.

Create, update, list, delete and test are available via the UI and the [Web Hooks API](docs/api.md#web-hooks).


## Request Templating

Web hook `url`, `headers[].value`, and `body` support templating using `{{ ... }}` expressions evaluated in [xyOps Expression Format](xyexp.md) with access to the current job/alert context. Examples:

```
POST https://hooks.example.com/ingest/{{event.id}}?server={{nice_hostname}}
Authorization: Bearer {{ secrets.API_TOKEN }}
Content-Type: application/json

{
  "message": "{{text}}",
  "job": { "id": {{job.id}}, "event": "{{event.title}}", "code": {{job.code}} },
  "server": "{{nice_server}}",
  "links": {{ stringify(links) }}
}
```

Key behavior:

- URL placeholders are URL-encoded automatically.
- Secrets are available as `{{ secrets.VAR_NAME }}` when the secret is assigned to the hook (see "Secrets" below).
- Helpers include `float()`, `integer()`, `bytes()`, `number()`, `pct()`, `encode()`, `stringify()`, `count()`, `min()`, `max()`, `round()`, `ceil()`, `floor()`, `clamp()`. See [xyOps Expression Format](xyexp.md) for the full helper list.
- To use the output data from a job, use `{{ job.data.PROP_NAME }}`.
- Job context: [JobHookData](data.md#jobhookdata) including `text`, `event`, `job`, `server`, `display` (CPU/mem summaries), `links`, etc.
- Alert context: [AlertHookData](data.md#alerthookdata) including `text`, `def`, `alert`, `server`, `links`, and other niceties.

Tip: Prefer JSON for bodies where possible; for form-encoded APIs, set `Content-Type: application/x-www-form-urlencoded` and compose the body accordingly.


## Secrets

Web hooks can use encrypted secrets via templating:

- Syntax: `{{ secrets.VAR_NAME }}` anywhere in `url`, `headers`, or `body`.
- Assignment: Administrators must grant a secret to the hook in the secret editor. Without assignment, `secrets.*` resolves empty.
- Security: Avoid placing secrets in the URL (they may end up in logs at the destination and xyOps records the composed request). Prefer headers or body.

See [Secrets](secrets.md) for model, assignment and auditing details.


## Default Text Templates

When a hook is used by an action, xyOps generates a context-aware `{{text}}` value from configurable templates ([hook_text_templates](config.md#hook_text_templates)). You can append your own text in the action's "Custom Text" field.

Default templates include:

```json
{
  "job_start": "Job started on {{nice_server}}: {{event.title}}: {{links.job_details}}",
  "job_success": "Job completed successfully on {{nice_server}}: {{event.title}}: {{links.job_details}}",
  "job_error": "Job failed on {{nice_server}}: {{event.title}}: Error ({{job.code}}): {{job.description}}: {{links.job_details}}",
  "job_progress": "Job is in progress on {{nice_server}} ({{event.title}}): {{links.job_details}}",
  "job_suspended": "Job is suspended and requires human intervention: {{event.title}}: {{links.job_details}}&resume=1",
  "job_limited": "{{action.msg}}: {{links.job_details}}",
  "alert_new": "Alert: {{nice_server}}: {{def.title}}: {{alert.message}}: {{links.alert_url}}",
  "alert_cleared": "Alert Cleared: {{nice_server}}: {{def.title}}"
}
```

These provide broad compatibility with common services (Slack uses `text`; Discord maps `content`; Pushover uses `message`). You can also map `content`/`message` in your body to the same value as `text` if needed.


## Execution and Observability

Every web hook execution records rich diagnostics and surfaces them in the UI (job Activity or alert action log):

- **Status**: Success with HTTP status line or an error code.
- **Timing**: Total elapsed and a performance breakdown of network lifecycle phases (dns, connect, send, wait, receive, compress, decompress).
- **Request**: Final method, URL (with templates expanded and URL-encoded), headers, and body.
- **Response**: Raw headers and body returned by the endpoint.

These details are also returned by the test API for ad-hoc verification.


## Tips and Examples

These recipes show common integrations. Replace IDs and secrets with your own.

### Slack Incoming Webhook

- Create a Slack Incoming Webhook URL.
- Hook settings:
  - method: `POST`
  - url: `https://hooks.slack.com/services/XXX/YYY/ZZZ`
  - headers: `Content-Type: application/json`
  - body:

```json
{
  "text": "{{text}}"
}
```

If you use Slack's newer Bot Token + chat.postMessage, set `Authorization: Bearer {{ secrets.SLACK_TOKEN }}` and include `channel` in the body.

### Discord Webhook

- Hook settings:
  - method: `POST`
  - url: `https://discord.com/api/webhooks/ID/TOKEN`
  - headers: `Content-Type: application/json`
  - body:

```json
{
  "content": "{{text}}"
}
```

### Pushover

- Create a Pushover application and collect `PUSHOVER_API_KEY` and `PUSHOVER_APP_KEY`.
- Use `encode` macro function to URI-encode the values for x-www-form-urlencoded.
- Hook settings:
  - method: `POST`
  - url: `https://api.pushover.net/1/messages.json`
  - headers: `Content-Type: application/x-www-form-urlencoded`
  - body:

```
token={{ encode(secrets.PUSHOVER_APP_KEY) }}&user={{ encode(secrets.PUSHOVER_API_KEY) }}&message={{ encode(text) }}
```

### ntfy.sh

- Choose a private topic name. On `ntfy.sh`, topic names are public and guessable topic names may be discovered by others.
- Optional but recommended for protected topics: create an access token and store it as a secret like `NTFY_TOKEN`.
- Hook settings:
  - method: `POST`
  - url: `https://ntfy.sh/YOUR_TOPIC`
  - headers: 
  	- `Content-Type: text/plain; charset=utf-8`, 
	- `Title: xyOps: {{event.title}}`, 
	- `Priority: high`, 
	- `Tags: warning`, 
	- `Authorization: Bearer {{ secrets.NTFY_TOKEN }}`
  - body:

```
{{text}}
```

If your topic allows anonymous writes, omit the `Authorization` header. For self-hosted ntfy, replace `https://ntfy.sh` with your server URL.

### Generic Bearer API

- Hook settings:
  - method: `POST`
  - url: `https://api.example.com/v1/event`
  - headers: `Authorization: Bearer {{ secrets.API_TOKEN }}`, `Content-Type: application/json`
  - body:

```json
{
  "source": "xyops",
  "summary": "{{text}}",
  "job": { "id": "{{job.id}}", "event": "{{event.title}}", "code": "{{job.code}}" },
  "server": "{{nice_server}}"
}
```


## Troubleshooting

- Hook not firing: Confirm the action condition matches and the hook is enabled. For jobs, ensure the run wasn't retried; completion actions skip retried runs.
- Daily cap: If `max_per_day` is set and reached, xyOps skips execution and records a failure (visible on job details page).
- Templating errors: Invalid `{{ ... }}` expressions in the body are rejected on save/update. For URL/headers/body, use the Test feature to validate expansions.
- TLS issues: For development endpoints with self-signed certificates, enable "SSL Cert Bypass". Prefer valid certificates in production.
- Secrets not expanding: Ensure the secret is assigned to the hook and variable names match. Avoid using secrets in the URL when possible.


## API Reference

Programmatic management and live testing:

- [get_web_hooks](api.md#get_web_hooks) -- list hooks
- [get_web_hook](api.md#get_web_hook) -- fetch one
- [create_web_hook](api.md#create_web_hook) -- create hook
- [update_web_hook](api.md#update_web_hook) -- update, shallow merge
- [delete_web_hook](api.md#delete_web_hook) -- delete hook
- [test_web_hook](api.md#test_web_hook) -- live test, returns markdown report

See [Web Hook APIs](api.md#web-hooks) for full request/response examples.


## See Also

- [Actions](actions.md)
- [WebHook Object](data.md#webhook)
- [Web Hook API](api.md#web-hooks)
- [Secrets](secrets.md)
- [hook_text_templates](config.md#hook_text_templates)
