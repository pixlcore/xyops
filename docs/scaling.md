# Scaling

## Overview

Running xyOps in live production with lots of servers and/or lots of running jobs? Please read these best practices for scaling your deployment. This guide complements Self-Hosting -- start there first: see [Self-Hosting](hosting.md).

## Upgrade Hardware

- CPU cores: xyOps is multi-process and highly concurrent. More cores help the scheduler, web server, storage I/O, and log compression run smoothly under load.
- RAM: Add headroom for the Node.js heap, in-process caches, storage engine caches, and OS page cache. RAM directly improves cache hit rates and reduces disk/remote I/O.
- Storage: Prefer fast SSD/NVMe for local Filesystem/SQLite and log archives. Ensure enough IOPS for parallel job logs, snapshots, and uploads.
- Network: For large fleets, ensure good NIC throughput and low latency between conductors and workers. If using external storage (S3, Redis, MinIO), place conductors close to it.
- OS limits: Increase file descriptor and process limits for busy nodes (e.g. `ulimit -n`, systemd Limits). Ensure swap is configured conservatively to avoid heap thrash.

## Increase Node.js Memory

xyOps honors the `NODE_MAX_MEMORY` environment variable to set Node's old-space heap size (default 4096 MB).

- Example: `export NODE_MAX_MEMORY=8192` before starting xyOps (or `-e NODE_MAX_MEMORY=8192` for Docker).
- Leave headroom for the OS, filesystem cache, and any external daemons. On an instance with 16 GB RAM, an 8-12 GB heap is typical depending on other workloads.
- Monitor RSS vs. heap usage over time and adjust conservatively to avoid swapping.

## Increase Storage RAM Cache

xyOps uses [pixl-server-storage](https://github.com/jhuckaby/pixl-server-storage) and most engines support an in-memory cache for JSON records. Larger caches reduce round-trips to disk or network backends.

- Defaults: The sample config enables caches with `maxBytes` ≈ 100 MB and `maxItems` ≈ 100k for Filesystem and SQLite.
- Recommendation: For large production installs, consider increasing 5-10× if you have RAM available, and then tune based on hit ratio and latency.
- Where to set:
  - SQLite: `Storage.SQLite.cache.enabled`, `Storage.SQLite.cache.maxBytes`, `Storage.SQLite.cache.maxItems`.
  - Filesystem: `Storage.Filesystem.cache.enabled`, `...maxBytes`, `...maxItems`.
  - S3: `Storage.S3.cache.enabled`, `...maxBytes`, `...maxItems` (useful to reduce S3 GETs).
- See [Storage Engines](https://github.com/jhuckaby/pixl-server-storage#engines) for engine-specific details and considerations (e.g., what is cached, eviction policy, binary vs JSON behavior).

## Disable QuickMon

QuickMon sends lightweight metrics every second from all satellites. At large scale, per-second telemetry can add up. To reduce ingestion and WebSocket traffic, disable it:

- Set `satellite.config.quickmon_enabled` to `false` in your config. The setting is distributed to all servers automatically when they connect.
- Minute-level monitoring remains enabled via `satellite.config.monitoring_enabled`.

## Multi-Conductor Setups

Multi-conductor requires external shared storage so all conductors see the same state. See [Multi-Conductor with Nginx](hosting.md#multi-conductor-with-nginx).

- Use an external storage backend: [S3](https://github.com/jhuckaby/pixl-server-storage#amazon-s3), [MinIO](https://github.com/jhuckaby/pixl-server-storage#s3-compatible-services), [NFS](https://github.com/jhuckaby/pixl-server-storage#local-filesystem), [Redis](https://github.com/jhuckaby/pixl-server-storage#redis), or a combination. S3 works but has higher latency; MinIO (self-hosted S3) performs better on-prem.
- [Hybrid](https://github.com/jhuckaby/pixl-server-storage#hybrid) engine: You can mix engines for documents vs. files. A common pattern is a fast key/value store for JSON documents, and an object store for binaries:
  - Example: `Hybrid.docEngine = Redis` (JSON/doc store) and `Hybrid.binaryEngine = S3` (files and large artifacts).
  - Configure each sub-engine alongside [Hybrid](https://github.com/jhuckaby/pixl-server-storage#hybrid). Ensure Redis persistence (RDB/AOF) is enabled for durability.
- If you choose a shared filesystem (NFS) for [Filesystem](https://github.com/jhuckaby/pixl-server-storage#local-filesystem), ensure low latency, adequate throughput, and robust locking semantics.
- [SQLite](https://github.com/jhuckaby/pixl-server-storage#sqlite) is great for single-conductor, but for multi-conductor you must switch to a shared backend.

**Tip**: Keep conductors in the same region/AZ as your storage to minimize cross-zone latency. For HTTP ingress, front conductors with Nginx that tracks the active primary.

## Automated Backups

- Use the nightly API export for critical data as described in [Self-Hosting: Daily Backups](hosting.md#daily-backups). Schedule via cron and store off-host.
- SQLite engine: It can perform its own daily DB file backups during maintenance. Configure in `Storage.SQLite.backups` (defaults keep the most recent 7). Note backups lock the DB briefly while copying.

## Critical Errors

For critical errors (i.e. crashes and failed upgrades) you can configure a global [System Hook](syshooks.md) to send out an automated email for each one.  Set this in your `config.json` file, in the [hooks](config.md#hooks) object:

```json
"hooks": {
	"critical": {
		"email": "ops-oncall@yourcompany.com"
	}
}
```

Or you can configure the hook to create a ticket (which in turn will email all the assignees):

```json
"hooks": {
	"critical": {
		"ticket": {
			"type": "issue",
			"assignees": ["admin"]
		}
	}
}
```

See [System Hooks](syshooks.md) for more details.

## Monitoring Alert Emails

For server monitor alerts, you may want to send out emails.  This can be set up at three different levels:

- At the alert level: You can edit individual alert definitions, and configure an email action for the important ones (e.g. "Low Memory" is a good one).
- At the server group level: You can set default alert actions for all alerts in specific server groups (e.g. "Production Databases").
- At the global configuration level.  See below...

You can add global "universal" alert actions in the [alert_universal_actions](config.md#alert_universal_actions) configuration object.  These will fire for **all** alerts.  Example:

```json
"alert_universal_actions": [
	{
		"enabled": true,
		"hidden": true,
		"condition": "alert_new",
		"type": "snapshot"
	},
	{
		"enabled": true,
		"condition": "alert_new",
		"type": "email",
		"email": "oncall-pager@mycompany.com"
	}
]
```

## Security Checklist

Harden your web entry point and xyOps config before going live:

- Restrict inbound IPs using [WebServer.whitelist](https://github.com/jhuckaby/pixl-server-web#whitelist) (supports CIDR). Only allow your corporate ranges and load balancers.
- Limit valid Host headers/SNI via [WebServer.allow_hosts](https://github.com/jhuckaby/pixl-server-web#allow_hosts) to your production domains (e.g. `xyops.yourcompany.com`).
- HTTPS: Enable [WebServer.https](https://github.com/jhuckaby/pixl-server-web#https), set cert/key paths, and consider [WebServer.https_force](https://github.com/jhuckaby/pixl-server-web#https_force) so HTTP redirects to HTTPS. If terminating TLS upstream, configure [WebServer.https_header_detect](https://github.com/jhuckaby/pixl-server-web#https_header_detect).
- Upload limits: Reduce [WebServer.max_upload_size](https://github.com/jhuckaby/pixl-server-web#max_upload_size) from the default 1 GB to your expected maximums (also adjust per-feature limits in `client.*_upload_settings`).
- Connection limits: Tune [WebServer.max_connections](https://github.com/jhuckaby/pixl-server-web#max_connections) and [WebServer.max_concurrent_requests](https://github.com/jhuckaby/pixl-server-web#max_concurrent_requests) to match instance capacity. Optionally set [WebServer.max_queue_length](https://github.com/jhuckaby/pixl-server-web#max_queue_length) and [WebServer.max_queue_active](https://github.com/jhuckaby/pixl-server-web#max_queue_active) to cap overload.
- Timeouts: Consider [WebServer.socket_prelim_timeout](https://github.com/jhuckaby/pixl-server-web#socket_prelim_timeout), [WebServer.timeout](https://github.com/jhuckaby/pixl-server-web#timeout), [WebServer.request_timeout](https://github.com/jhuckaby/pixl-server-web#request_timeout), and [WebServer.keep_alive_timeout](https://github.com/jhuckaby/pixl-server-web#keep_alive_timeout) to mitigate slow-loris patterns and bound request durations.
- Bind address: If running behind a proxy, set [WebServer.bind_address](https://github.com/jhuckaby/pixl-server-web#bind_address) appropriately and configure [WebServer.public_ip_offset](https://github.com/jhuckaby/pixl-server-web#public_ip_offset) to select the correct client IP from proxy headers.
- Headers/CSP: Use [WebServer.uri_response_headers](https://github.com/jhuckaby/pixl-server-web#uri_response_headers) to enforce CSP, HSTS, and other security headers for HTML routes. 
- Access control: Use [WebServer.default_acl](https://github.com/jhuckaby/pixl-server-web#default_acl) for private handlers and verify API keys/SSO policies. Lock down admin endpoints behind SSO where applicable.
- Rotate your secret key every few months.  See [Secret Key Rotation](hosting.md#secret-key-rotation) for details.

## Rate Limiting

If you are using our [Multi-Conductor with Nginx](hosting.md#multi-conductor-with-nginx) or [Multi-Conductor with OAuth2-Proxy and TLS with Nginx](sso.md#multi-conductor-with-oauth2-proxy-and-tls-with-nginx) setups, consider adding on a rate limiting configuration.  To do this, add a new volume bind to the Nginx Docker container:

```
-v ./limits.conf:/etc/nginx/conf.d/limits.conf:ro
```

And in the `limits.conf` file on the host side, add a Nginx configuration like this:

```
limit_req_zone $binary_remote_addr zone=req_per_ip:20m rate=100r/s;
limit_req_status 429;
```

This would limit traffic to 100 requests/sec per IP, utilizing up to 20MB of IP cache (around 300K IPs).  For more details see the [ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html).

## Additional Tuning Ideas

- Job throughput: Increase [max_jobs_per_min](config.md#max_jobs_per_min) prudently and monitor worker CPU/RAM. Align with your per-category limits and workflow constraints.
- Data retention: Cap history sizes to prevent unbounded growth via the [db_maint](config.md#db_maint) `*.max_rows` properties (jobs, alerts, snapshots, activity, servers). Adjust to fit your storage budget.
- Search concurrency: If you run frequent file searches, consider increasing [search_file_threads](config.md#search_file_threads) carefully (I/O bound; test first).
- Logging: Disable verbose request or storage event logs in production unless actively debugging (`WebServer.log_requests`, `Storage.log_event_types`).

## References

- [xyOps Self-Hosting Guide](hosting.md)
- [Storage engines and Hybrid](https://github.com/jhuckaby/pixl-server-storage#engines)
- [Web server documentation](https://github.com/jhuckaby/pixl-server-web)
