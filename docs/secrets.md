# Secrets

Secrets are encrypted “vaults” for sensitive configuration such as API keys, auth tokens, passwords, and similar credentials. Each secret contains one or more named variables (key/value pairs). xyOps stores the variable data encrypted at rest and only decrypts it in memory when needed at runtime.

Secrets can be granted (assigned) to events, categories, plugins, and web hooks:

- Jobs launched by events or plugins receive secret variables as environment variables.
- Web hooks can access secret variables through template expansion via `{{ secrets.VAR_NAME }}`.

This page explains how secrets are modeled, how access is granted, how they are delivered at runtime, and how access is audited.


## Data Model

- Secret object: See the full schema in [Secret](data.md#secret).
- Encrypted payload: The variable values live in an encrypted record separate from the metadata. The UI and list APIs return metadata only; variable data is never exposed unless explicitly decrypted by an administrator.
- Plaintext metadata: The following fields are stored in plaintext for display and routing:
  - `id`, `title`, `enabled`, `icon`, `notes`
  - `names` (the list of variable names only, not values)
  - assignment lists: `events`, `categories`, `plugins`, `web_hooks`

Secret values are always strings (as they are delivered via environment variables). If you need to store binary data, [Base64‑encode](https://en.wikipedia.org/wiki/Base64) it first.


## Encryption

xyOps uses authenticated encryption to protect secret values at rest:

- Algorithm: **AES‑256‑GCM** for confidentiality and integrity.
	- AES-256-GCM is a high-security symmetric encryption algorithm that combines the Advanced Encryption Standard (AES) with a 256-bit key and the Galois/Counter Mode (GCM) to provide both data confidentiality and authentication.
- Key derivation: scrypt with `N=16384, r=8, p=1` and a per‑record random 16‑byte salt.
- Nonce/IV: Per‑record random 12‑byte IV.
- AAD: The secret’s ID is bound as Additional Authenticated Data to prevent swapping between records.
- Storage: The encrypted blob includes `alg`, `salt`, `iv`, `tag`, and `ct`.

The encryption key is derived from [config.secret_key](config.md#secret_key). Keep this value strong and private in production.  See [Key Rotation](hosting.md#key-rotation) for instructions on rotating the secret key.


## Assigning Access

Secrets control where they may be used by assigning resources. When any of these are active, xyOps decrypts and injects variables automatically.

- `events`: Grant to selected events; their jobs receive the variables.
- `categories`: Grant to all events in the selected categories.
- `plugins`: Grant to selected plugins when they run jobs, actions or triggers.
- `web_hooks`: Grant to selected web hooks; hooks use template expansion instead of environment variables.

### Merge precedence

If multiple assigned secrets define the same variable name, the final value used by the job is determined by merge order:

1. Event
2. Workflow sub‑event (if applicable and different)
3. Category
4. Plugin (merged last, so plugin wins on conflicts)

Web hooks have no merging; each referenced secret’s variables are expanded independently in templates.

When a job is part of a workflow, secrets assigned to both the sub‑event and the parent workflow event may apply. The system injects the sub‑event’s secrets first, then the parent event’s, before category and plugin layers.


## Runtime Delivery

- Jobs: Secret variables are injected into the job’s process environment as `NAME=value` pairs just before launch. Variables follow POSIX naming rules (letters, digits and underscores; starting with a letter or underscore is recommended).
- Web hooks: Secrets are available to the templating system via `{{ secrets.VAR_NAME }}` in hook URL, headers, and body templates.
- Decryption lifecycle: The encrypted data remains at rest until the exact moment it is needed. xyOps decrypts into memory, uses the values, and never persists them in plaintext.


## Auditing and Logging

xyOps records both routine and user‑initiated access to secrets.

**Routine runtime use**: Logged "quietly" to a dedicated `Secret.log` file whenever a job, plugin or web hook uses a secret. Entries include: epoch timestamp, formatted date/time, server hostname, PID, a textual description (e.g. “Using secret ...”), the full secret metadata JSON (no values), and the access type (event, category, plugin, or web hook).  Example:

```
[1763675628.397][2025-11-20 13:53:48][joemax.lan][62614][Secret][debug][1][Using secret zmeejkeb8nu (Dev Database) for events: emeekm2ablu][{"secret":{"id":"zmeejkeb8nu","title":"Dev Database","enabled":true,"icon":"","notes":"This secret provides access to the dev database.","names":["DB_HOST","DB_PASS","DB_USER"],"events":["emeekm2ablu"],"categories":[],"plugins":[],"username":"admin","modified":1757204132,"created":1755365953,"revision":8,"web_hooks":["example_hook"]},"type":"events","id":"emeekm2ablu"}]
```

**Administrator decryption**: When an admin decrypts a secret through the UI or API, the access is logged "loudly" in the Activity Log and tagged with the username. Create, update, and delete operations are also logged.  Example access:

```json
{
	"action": "secret_access",
	"username": "admin",
	"description": "Dev Database",
	"epoch": 1763675687,
	"id": "ami7yyuct2y",
	"useragent": "Safari 26.1.0 / macOS",
	"ip": "127.0.0.1",
	"ips": [
		"127.0.0.1"
	],
	"headers": {
		"host": "local.xyops.io:5523",
		/* Omitted verbose HTTP headers for brevity */
	},
	"secret": {
		"id": "zmeejkeb8nu",
		"title": "Dev Database",
		/* See Secret data structure for more */
	},
	"keywords": [
		"zmeejkeb8nu",
		"admin",
		"127.0.0.1"
	]
}
```

For API details and response formats, see [Secrets API](api.md#secrets).


## Using Secrets in the UI

The Secrets admin page requires administrator privileges.

- **Create**: Define a title, optional icon/notes, assign to events/categories/plugins/web hooks, and add variables. The values are encrypted on save; only `names` are stored in plaintext.
- **Edit metadata and assignments**: You can update title, icon, notes, and assignment lists without touching the encrypted data.
- **View or edit values**: Values are not loaded by default. Clicking to view/decrypt requires an admin role and triggers a confirmation and a logged activity. Saving updates re‑encrypts and stores the new payload.
- **Enable/disable**: Toggle availability without deleting the underlying data.
- **Delete**: Permanently removes both metadata and encrypted payload; the action is logged.


## Best Practices and Limits

- Keep titles/notes non‑sensitive: Do not include secret values or hints in `title`, `notes` or key names (they are stored in plaintext).
- Naming: Use clear, uppercase names with underscores, e.g. `DB_HOST`, `API_TOKEN`. Avoid collisions across assigned secrets.
- Binary data: Base64‑encode binary payloads before storing. Remember Base64 increases size by ~33%.
- Environment size limits: POSIX does not define a fixed per‑variable maximum; systems enforce a limit on the total size of argv+environment for `execve()` (e.g., Linux often ≥2 MB; macOS commonly ~256 KB). A single variable can approach that limit, but overhead and other variables reduce headroom. As a rule of thumb keep each value under a few kilobytes. For larger data, prefer files or [Buckets](buckets.md) and pass references instead of large env values.
  - Tip: On a target server, `getconf ARG_MAX` reports the system limit for argv+environment.
- Web hooks: Prefer placing secrets in headers or body, not in URLs. Avoid logging expanded templates that would reveal secret values.
- Plugin/jobs: Ensure scripts don’t echo environment variables to logs or error output. Scrub or redact as needed.


## API Links

For full request/response examples, see the API reference:

- [get_secrets](api.md#get_secrets)
- [get_secret](api.md#get_secret)
- [decrypt_secret](api.md#decrypt_secret)
- [create_secret](api.md#create_secret)
- [update_secret](api.md#update_secret)
- [delete_secret](api.md#delete_secret)
