# Self-Hosting

This guide covers self-hosting xyOps on your own infrastructure.  However, please note that for live production installs, it is dangerous to go alone.  While we provide all necessary documentation here, we strongly recommend our [Enterprise Plan](https://xyops.io/enterprise). This gives you access to our white-glove onboarding service, where our team will guide you through every step, validate your configuration, and ensure your integration is both secure and reliable.  This also gets you priority ticket support, and live chat support from a xyOps engineer.

# Quick-Start

To start quickly and just get xyOps up and running to test it out, you can use the following Docker command:

```sh
docker run --init -v xy-data:/opt/xyops/data -p 5522:5522 -p 5523:5523 --name "xyops01" --hostname "xyops01" -e XYOPS_secret_key="MY_SECRET_KEY" -e TZ="America/Los_Angeles" ghcr.io/pixlcore/xyops:latest
```

Then hit http://localhost:5522/ in your browser for HTTP, or https://localhost:5523/ for HTTPS (note that this will have a self-signed cert -- see [TLS](#tls) below).  A default administrator account will be created with username `admin` and password `admin`.  This will create a Docker volume (`xy-data`) to persist the xyOps database, which by default is a hybrid of a SQLite DB and the filesystem itself for file storage.

Note that in order to add worker servers so you can actually run jobs, the container needs to be *addressable on your network* by its hostname.  Typically this is done by adding the hostname to your local DNS, or using a `/etc/hosts` file.  Alternatively, you can add worker servers as a Docker containers on the same network.  To do this, we need a few extra commands:

```sh
# First create the bridge network
docker network create xy-net

# Next, start xyOps in the newly created network
docker run --init -v xy-data:/opt/xyops/data --network=xy-net -p 5522:5522 -p 5523:5523 --name "xyops01" --hostname "xyops01" -e XYOPS_secret_key="MY_SECRET_KEY" -e TZ="America/Los_Angeles" ghcr.io/pixlcore/xyops:latest

# And finally, start up a worker, preconfigured to connect to the master container
docker run --init --network=xy-net --name "worker01" --hostname "worker01" -e XYOPS_masters="xyops01" -e XYOPS_secret_key="MY_SECRET_KEY" -e TZ="America/Los_Angeles" ghcr.io/pixlcore/xysat:latest
```

A few things to note here:

- This method of connecting a worker and master server uses a shared secret key.  The two keys **must match exactly**.
- The worker container doesn't need the storage volume mounted, nor does it need any ports exposed.
- You can spin up as many workers as you want -- just change the `--name` and `--hostname` of each one so they are unique.
- In this case xyOps will have a self-signed cert for TLS, which the worker will accept by default.  See [TLS](#tls) for more details.
- Change the `TZ` environment variable to your local timezone, for proper midnight log rotation and daily stat resets.

As an aside, when you add worker servers via the UI, secret keys are not used (nor are they *ever* sent over the wire).  Instead, a special cryptographic token is used to authenticate new worker servers.  You can also add batches of servers in bulk via API Keys.  See [Adding Servers](servers.md#adding-servers) for more details.

## Configuration

The xyOps main configuration file is located at `/opt/xyops/conf/config.json`.  Grab our [sample file](https://github.com/pixlcore/xyops/sample_conf/config.json) to use as a starting point for building yours.  You can bind a local file to this path on your Docker container by adding this to your Docker run command:

```
-v /local/path/to/config.json:/opt/xyops/conf/config.json
```

See the [Configuration Guide](config.md) for full details on how to customize this file.

# Manual Install

This section covers manually installing xyOps on a server (outside of Docker).

Please note that xyOps currently only works on POSIX-compliant operating systems, which basically means Unix/Linux and macOS.  You'll also need to have [Node.js](https://nodejs.org/en/download/) pre-installed on your server.  Please note that we **strongly suggest that you install the LTS version of Node.js**.  While xyOps should work on the "current" release channel, LTS is more stable and more widely tested.  See [Node.js Releases](https://nodejs.org/en/about/releases/) for details.

xyOps also requires NPM to be preinstalled.  Now, this is typically bundled with and automatically installed with Node.js, but if you install Node.js by hand, you may have to install NPM yourself.

Once you have Node.js and NPM installed, type this as root:

```sh
curl -s https://raw.githubusercontent.com/pixlcore/xyops/main/bin/install.js | node
```

This will install the latest stable release of xyOps and all of its dependencies under: `/opt/xyops/`

If you'd rather install it manually (or install as a non-root user), here are the raw commands:

```sh
mkdir -p /opt/xyops && cd /opt/xyops
curl -L https://github.com/pixlcore/xyops/archive/v1.0.0.tar.gz | tar zxvf - --strip-components 1
npm install
node bin/build.js dist
```

Replace `v1.0.0` with the desired xyOps version from the [official release list](https://github.com/pixlcore/xyops/releases), or `main` for the head revision (unstable).

## Command Line

See our [Command Line Guide](cli.md) for controlling the xyOps service via command-line.

## Uninstall

To uninstall xyOps, simply stop the service and delete the `/opt/xyops` directory.

```sh
cd /opt/xyops
bin/control.sh stop
npm run unboot # deregister as system startup service
rm -rf /opt/xyops
cd -
```

Make sure you [decommission your servers](servers.md#decommissioning-servers) first.

# Environment Variables

xyOps supports a special environment variable syntax, which can specify command-line options as well as override any configuration settings.  The variable name syntax is `XYOPS_key` where `key` is one of several command-line options (see table below) or a JSON configuration property path.  These can come in handy for automating installations, and using container systems.  

For overriding configuration properties by environment variable, you can specify any top-level JSON key from `config.json`, or a *path* to a nested property using double-underscore (`__`) as a path separator.  For boolean properties, you can use `true` or `false` strings, and xyOps will convert them.  Here is an example of some of the possibilities available:

| Variable | Sample Value | Description |
|----------|--------------|-------------|
| `XYOPS_foreground` | `true` | Run xyOps in the foreground (no background daemon fork). |
| `XYOPS_echo` | `true` | Echo the event log to the console (STDOUT), use in conjunction with `XYOPS_foreground`. |
| `XYOPS_color` | `true` | Echo the event log with color-coded columns, use in conjunction with `XYOPS_echo`. |
| `XYOPS_base_app_url` | `http://xyops.yourcompany.com` | Override the [base_app_url](config.md#base_app_url) configuration property. |
| `XYOPS_email_from` | `xyops@yourcompany.com` | Override the [email_from](config.md#email_from) configuration property. |
| `XYOPS_secret_key` | `CorrectHorseBatteryStaple` | Override the [secret_key](config.md#secret_key) configuration property. |
| `XYOPS_WebServer__port` | `80` | Override the `port` property *inside* the [WebServer](config.md#webserver) object. |
| `XYOPS_WebServer__https_port` | `443` | Override the `https_port` property *inside* the [WebServer](config.md#webserver) object. |
| `XYOPS_Storage__Filesystem__base_dir` | `/data/xyops` | Override the `base_dir` property *inside* the [Filesystem](config.md#storage-filesystem) object *inside* the [Storage](config.md#storage) object. |

Almost every [configuration property](config.md) can be overridden using this environment variable syntax.  The only exceptions are things like arrays, e.g. [log_columns](config.md#log_columns).

# Daily Backups

Here is how you can generate daily backups of critical xyOps data, regardless of your backend storage engine.  First, create an [API Key](api.md#api-keys) and grant it full administrator privileges (this is required to use the [admin_export_data](api.md#admin_export_data) API).  You can then request a backup using a [curl](https://curl.se/) command like this:

```sh
curl -X POST "https://xyops.yourcompany.com/api/app/admin_export_data" \
	-H "X-API-Key: YOUR_API_KEY_HERE" -H "Content-Type: application/json" \
	-d '{"lists":"all",indexes:["tickets"]}' -O -J
```

This will save the backup as a `.txt.gz` file in the current directory named using this filename pattern:

```
xyops-data-export-YYYY-MM-DD-UNIQUEID.txt.gz
```

Please note that this example will only export **critical** data, and is not a full backup (notably absent is job history, alert history, snapshot history, server history, and activity log).  To backup *everything*, change the JSON in the curl request to: `{"lists":"all","indexes":"all","extras":"all"}`.  Note that this can take quite a while and produce a very large file depending on your xyOps database size.  To limit what exactly gets included in the backup, consult the [admin_export_data](api.md#admin_export_data) API docs.

# TLS

The xyOps built-in web server ([pixl-server-web](https://github.com/jhuckaby/pixl-server-web)) supports TLS.  Please read the following guide for setup instructions:

[Let's Encrypt / ACME TLS Certificates](https://github.com/jhuckaby/pixl-server-web#lets-encrypt--acme-tls-certificates)

Alternatively, you can setup a proxy to sit in front of xyOps and handle TLS for you (see next section).

# Multi-Master with Nginx

For a load balanced multi-master setup with Nginx w/TLS, please read this section.  This is a complex setup, and requires advanced knowledge of all the components used.  Let me recommend our [Enterprise Plan](https://xyops.io/enterprise) here, as we can set all this up for you.  Now, the way this configuration works is as follows:

- [Nginx](https://nginx.org/) sits in front, and handles TLS termination, as well as routing requests to various backends.
- Nginx handles xyOps multi-master using an embedded [Health Check Daemon](https://github.com/pixlcore/xyops-healthcheck) which runs in the same container.
	- The health check keeps track of which server is master, and dynamically reconfigures and hot-reloads Nginx as needed.
	- We maintain our own custom Nginx docker image for this (shown below), or you can [build your own from source](https://github.com/pixlcore/xyops-nginx/blob/main/Dockerfile).

A few prerequisites for this setup:

- For multi-master setups, **you must have an external storage backend**, such as NFS, S3, or S3-compatible (MinIO, etc.).
- You will need a custom domain configured and TLS certs created and ready to attach.
- You have your xyOps configuration file customized and ready to go ([config.json](https://github.com/pixlcore/xyops/blob/main/sample_conf/config.json)) (see below).

For the examples below, we'll be using the following domain placeholders:

- `xyops.yourcompany.com` - User-facing domain which should route to Nginx / SSO.
- `xyops01.yourcompany.com` - Internal domain for master server #1.
- `xyops02.yourcompany.com` - Internal domain for master server #2.

The reason why the master servers each need their own unique (internal) domain name is because of how the multi-master system works.  Each master server needs to be individually addressable, and reachable by all of your worker servers in your org.  Worker servers don't know or care about Nginx -- they contact masters directly, and have their own auto-failover system.  Also, worker servers use a persistent WebSocket connection, and can send a large amount of traffic, depending on how many worker servers you have and how many jobs you run.  For these reasons, it's better to have worker servers connect the masters directly, especially at production scale.

That being said, you *can* configure your worker servers to connect through the Nginx front door if you want.  This can be useful if you have worker servers in another network or out in the wild, but it is not recommended for most setups.  To do this, please see [Overriding The Connect URL](hosting.md#overriding-the-connect-url) in our self-hosting guide.

Here is a docker command for running Nginx:

```sh
docker run \
	--name xyops-nginx \
	--init \
	-e XYOPS_masters="xyops01.yourcompany.com,xyops02.yourcompany.com" \
	-e XYOPS_port="5522" \
	-v "$(pwd)/tls.crt:/etc/tls.crt:ro" \
	-v "$(pwd)/tls.key:/etc/tls.key:ro" \
	-p 443:443 \
	ghcr.io/pixlcore/xyops-nginx:latest
```

Here it is as a docker compose file:

```yaml
services:
  nginx:
	image: ghcr.io/pixlcore/xyops-nginx:latest
	init: true
	environment:
	  XYOPS_masters: xyops01.yourcompany.com,xyops02.yourcompany.com
	  XYOPS_port: 5522
	volumes:
	  - "./tls.crt:/etc/tls.crt:ro"
	  - "./tls.key:/etc/tls.key:ro"
	ports:
	  - "443:443"
```

Let's talk about the Nginx setup.  We are pulling in our own Docker image here ([xyops-nginx](https://github.com/pixlcore/xyops-nginx)).  This is a wrapper around the official Nginx docker image, but it includes our [xyOps Health Check](https://github.com/pixlcore/xyops-healthcheck) daemon.  The health check monitors which master server is currently primary, and dynamically reconfigures Nginx on-the-fly as needed (so Nginx always routes to the current primary server only).  The image also comes with a fully preconfigured Nginx.  To use this image you will need to provide:

- Your TLS certificate files, named `tls.crt` and `tls.key`, which are bound to `/etc/tls.crt` and `/etc/tls.key`, respectively.
- The list of xyOps master server domain names, as a CSV list in the `XYOPS_masters` environment variable (used by health check).

Once you have Nginx running, we can fire up the xyOps backend.  This is documented separately as you'll usually want to run these on separate servers.  Here is the multi-master configuration as a single Docker run command:

```sh
docker run \
	--name xyops1 \
	--hostname xyops01.yourcompany.com \
	--init \
	-e XYOPS_masters="xyops01.yourcompany.com,xyops02.yourcompany.com" \
	-e TZ="America/Los_Angeles" \
	-v "$(pwd)/config.json:/opt/xyops/conf/config.json:ro" \
	-v "$(pwd)/sso.json:/opt/xyops/conf/sso.json:ro" \
	-p 5522:5522 \
	-p 5523:5523 \
	ghcr.io/pixlcore/xyops:latest
```

And here it is as a docker compose file.

```yaml
services:
  xyops1:
	image: ghcr.io/pixlcore/xyops:latest
	hostname: xyops01.yourcompany.com # change this per master server
	init: true
	environment:
	  XYOPS_masters: xyops01.yourcompany.com,xyops02.yourcompany.com
	  TZ: America/Los_Angeles
	volumes:
	  - "./config.json:/opt/xyops/conf/config.json:ro"
	  - "./sso.json:/opt/xyops/conf/sso.json:ro"
	ports:
	  - "5522:5522"
	  - "5523:5523"
```

For additional master servers you can simply duplicate the command and change the hostname.

A few things to note here:

- We're using our official xyOps Docker image, but you can always [build your own from source](https://github.com/pixlcore/xyops/blob/main/Dockerfile).
- All master server hostnames need to be listed in the `XYOPS_masters` environment variable, comma-separated.
- All master servers need to be able to route to each other via their hostnames, so they can self-negotiate and hold elections.
- The timezone (`TZ`) should be set to your company's main timezone, so things like midnight log rotation and daily stat resets work as expected.
- You will need to supply the configuration file: `config.json`.  See below.

Grab our sample [config.json](https://github.com/pixlcore/xyops/blob/main/sample_conf/config.json) file to use as a starting point to create yours.  See the [xyOps Configuration Guide](config.md) for details on how to customize this file.

# Satellite

**xyOps Satellite (xySat)** is a companion to the xyOps system.  It is both a job runner, and a data collector for server monitoring and alerting.  xySat is designed to be installed on *all* of your servers, so it is lean, mean, and has zero dependencies.

For instructions on how to install xySat, see [Adding Servers](servers.md#adding-servers).

## Configuration

xySat is configured automatically via the xyOps master server.  The [satellite.config](config.md#satellite-config) object is automatically sent to each server after it connects and authenticates, so you can keep a master version of the xySat configuration which is auto-synced to all servers.  Here is the default config:

```json
{ 
	"port": 5522,
	"secure": false,
	"socket_opts": { "rejectUnauthorized": false },
	"pid_file": "pid.txt",
	"log_dir": "logs",
	"log_filename": "[component].log",
	"log_crashes": true,
	"log_archive_path": "logs/archives/[filename]-[yyyy]-[mm]-[dd].log.gz",
	"log_archive_keep": "7 days",
	"temp_dir": "temp",
	"debug_level": 5,
	"child_kill_timeout": 10,
	"monitoring_enabled": true,
	"quickmon_enabled": true
}
```

Here are descriptions of the configuration properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `port` | Number | Specifies which port the xyOps master server will be listening on (default is `5522` for ws:// and `5523` for wss://). |
| `secure` | Boolean | Set to `true` to use secure WebSocket (wss://) and HTTPS connections. |
| `socket_opts` | Object | Options to pass to the WebSocket connection (see [WebSocket](https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocket)). |
| `pid_file` | String | Location of the PID file to ensure two satellites don't run simultaneously. |
| `log_dir` | String | Location of the log directory, relative to the xySat base dir (`/opt/xyops/satellite`). |
| `log_filename` | String | This string is the filename pattern used by the core logger (default: `[component].log`); supports log column placeholders like `[component]`. |
| `log_crashes` | Boolean | This boolean enables capturing uncaught exceptions and crashes in the logger subsystem (default: `true`). |
| `log_archive_path` | String | This string sets the nightly log archive path pattern (default: `logs/archives/[filename]-[yyyy]-[mm]-[dd].log.gz`). |
| `log_archive_keep` | String | How many days to keep log archives before auto-deleting the oldest ones. |
| `temp_dir` | String | Location of temp directory, relative to the base dir (`/opt/xyops/satellite`). |
| `debug_level` | Number | This number sets the verbosity level for the logger (default: `5`; 1 = quiet, 10 = very verbose). |
| `child_kill_timeout` | Number | Number of seconds to wait after sending a SIGTERM to follow-up with a SIGKILL. |
| `monitoring_enabled` | Boolean | Enable or disable the monitoring subsystem (i.e. send monitoring metrics every minute). |
| `quickmon_enabled` | Boolean | Enable or disable the quick monitors, which send lightweight metrics every second. |

### Overriding The Connect URL

When xySat is first installed, it is provided an array of hosts to connect to, which becomes a `hosts` array in the xySat config file on each server.  When xySat starts up, it connects to a *random host* from this array, and figures out which master is primary, and reconnects to that host.  If the master cluster changes, a new `hosts` array is automatically distributed to all servers by the current master.

In certain situations you may need to have xySat connect to a specific master host, instead of the default master list.  For e.g. you may have servers "out in the wild" and they need to connect through a proxy, or some other kind of complex network topology.  Either way, you can override the usual array of hosts that xySat connects to, and specify a static value instead.

To do this, add a `host` property into the xySat config as a top-level JSON property, on each server that requires it.  The xySat config file is be located at:

```
/opt/xyops/satellite/config.json
```

Note that you should **not** add a `host` property into the [satellite.config](config.md#satellite-config) object on the master server, unless you want **all** of your servers to connect to the static host.

When both `hosts` and `host` exist in the config file, `host` takes precedence.

# Air-Gapped Mode

xyOps supports air-gapped installs, which prevent it from making unauthorized outbound connections beyond a specified IP range.  You can configure which IP ranges it is allowed to connect to, via whitelist and/or blacklist.  The usual setup is to allow local LAN requests so servers can communicate with each other in your infra.

To configure air-gapped mode, use the [airgap](config.md#airgap) section in the main config file.  Example:

```json
"airgap": {
	"enabled": false,
	"outbound_whitelist": ["127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "::1/128", "fd00::/8", "169.254.0.0/16", "fe80::/10"],
	"outbound_blacklist": []
}
```

Set the `enabled` property to `true` to enable air-gapped mode, and set the `outbound_whitelist` and/or `outbound_blacklist` arrays to IP addresses or [CIDR blocks](https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing).  The default whitelist includes all IPs in the [private range](https://en.wikipedia.org/wiki/Private_network).

The air-gapped rules apply to both xyOps itself, and automatically propagate to all connected worker servers, to govern things like the [HTTP Plugin](plugins.md#http-request-plugin).  However, it is important to point out that they do **not** govern your own Plugin code, your own shell scripts, nor marketplace Plugins.

For handling air-gapped software upgrades safely, please contact [xyOps Support](mailto:support@pixlcore.com).  As part of the enterprise plan we can send you signed, encrypted packages with instructions on how to install them.

All xyOps documentation is available offline inside the xyOps app.
