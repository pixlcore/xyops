# Self-Hosting

## Overview

This guide covers self-hosting xyOps on your own infrastructure.  However, please note that for live production installs, it is dangerous to go alone.  While we provide all necessary documentation here, we strongly recommend our [Enterprise Plan](https://xyops.io/pricing). This gives you access to our white-glove onboarding service, where our team will guide you through every step, validate your configuration, and ensure your integration is both secure and reliable.  This also gets you priority ticket support, and live chat support from a xyOps engineer.

## Prerequisites

It is really important to understand that wherever you decide to run xyOps, that server (or container) needs to be **addressable on your network by its hostname**.  This is how your worker servers will connect to xyOps, so they need a fixed hostname that will resolve to an IP that they can reach from wherever they are.  With Docker you should set the **container hostname** to something that resolves and can be reached on your network.

## Quick-Start

To start quickly and just get xyOps up and running to test it out, you can use the following Docker command:

```sh
docker run \
	--detach \
	--init \
	--name "xyops01" \
	--hostname "xyops01" \
	--restart unless-stopped \
	-v xy-data:/opt/xyops/data \
	-v /var/run/docker.sock:/var/run/docker.sock \
	-e XYOPS_xysat_local="true" \
	-e TZ="America/Los_Angeles" \
	-p 5522:5522 \
	-p 5523:5523 \
	ghcr.io/pixlcore/xyops:latest
```

Here it is as a docker compose file, along with an additional bind mount for the configuration directory:

```yaml
services:
  xyops01:
    image: ghcr.io/pixlcore/xyops:latest
    container_name: xyops01
    hostname: xyops01

    init: true
    restart: unless-stopped

    environment:
      XYOPS_xysat_local: "true"
      TZ: America/Los_Angeles

    volumes:
      - xy-data:/opt/xyops/data
	  - /local/path/to/xyops-conf:/opt/xyops/conf
      - /var/run/docker.sock:/var/run/docker.sock

    ports:
      - "5522:5522"
      - "5523:5523"

volumes:
  xy-data:
```

Please change `/local/path/to/xyops-conf` to a suitable location for the xyOps configuration to live on the host machine (so you can make changes easily).

Then hit http://localhost:5522/ in your browser for HTTP, or https://localhost:5523/ for HTTPS (note that this will have a self-signed cert -- see [TLS](#tls) below).  A default administrator account will be created with username `admin` and password `admin`.  This will create a Docker volume (`xy-data`) to persist the xyOps database, which by default is a hybrid of a SQLite DB and the filesystem itself for file storage.

A few notes:

- **Important:** Please change the sample `xyops01` hostname to something that actually resolves and is addressable on your network.  Without this, many features will not work properly.
- In this case xyOps will have a self-signed cert for TLS, which the worker will accept by default.  See [TLS](#tls) for more details.
- Change the `TZ` environment variable to your local timezone, for proper midnight log rotation and daily stat resets.
- The `XYOPS_xysat_local` environment variable causes xyOps to launch [xySat](#satellite) in the background, in the same container.  This is so you can start running jobs right away -- it is great for testing and home labs, but not recommended for production setups.
- If you plan on using the container long term, please make sure to [rotate the secret key](#secret-key-rotation).
- The `/var/run/docker.sock` bind is optional, and allows xyOps to launch its own containers (i.e. for the [Docker Plugin](plugins.md#docker-plugin), and the [Plugin Marketplace](marketplace.md)).

Note that in order to add worker servers, the container needs to be *addressable on your network* by its hostname.  Typically this is done by adding the hostname to your local DNS, or using a `/etc/hosts` file.  See [Adding Servers](servers.md#adding-servers) for more details.

### Configuration

The xyOps main configuration file is located at `/opt/xyops/conf/config.json`, but there are other useful files in the `/opt/xyops/conf` directory as well.  For e.g. if any configuration properties are updated via the UI, they are written to an `/opt/xyops/conf/overrides.json` file.  If you intend to use the Docker container long term, it is best to map the entire `/opt/xyops/conf` directory.  You can do this as a volume, or bind mount it to a host directory (recommended):

```
-v /local/path/to/xyops-conf:/opt/xyops/conf
```

xyOps will automatically copy over all default configuration files on first launch.

See the [Configuration Guide](config.md) for full details on how to customize the `config.json` file.

## Manual Install

This section covers manually installing xyOps on a server (outside of Docker).

Please note that the xyOps conductor currently only works on POSIX-compliant operating systems, which basically means Unix/Linux and macOS.  You'll also need to have [Node.js](https://nodejs.org/en/download/) pre-installed on your server.  Please note that we **strongly suggest that you install the LTS version of Node.js**.  While xyOps should work on the "current" release channel, LTS is more stable and more widely tested.  See [Node.js Releases](https://nodejs.org/en/about/releases/) for details.

xyOps also requires NPM to be preinstalled.  Now, this is typically bundled with and automatically installed with Node.js, but if you install Node.js by hand, you may have to install NPM yourself.  You will likely also need compiler tools (i.e. `apt-get install build-essential python3-setuptools` on Ubuntu).

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
bin/control.sh start
```

Replace `v1.0.0` with the desired xyOps version from the [official release list](https://github.com/pixlcore/xyops/releases), or `main` for the head revision (unstable).

If you would like xyOps to automatically start itself on server reboot, issue this command:

```sh
cd /opt/xyops
npm run boot
```

**For Linux users:** Once you run `npm run boot`, which registers xyOps as a Systemd service, you should always start / stop it using the proper `systemctl` commands.  The service name is `xyops.service`.

### Command Line

See our [Command Line Guide](cli.md) for controlling the xyOps service via command-line.

### Adding Conductors Manually

When you manually install xyOps, it creates a cluster of one, and promotes itself to primary.  To add backup conductors, follow these instructions.

First, for multi-conductor setups, **you must have an external storage backend**, such as NFS, S3, or S3-compatible (MinIO, etc.).  See [Storage Engines](https://github.com/jhuckaby/pixl-server-storage#engines) for details.

Once you have external storage setup and working, stop the xyOps service, and edit the `/opt/xyops/conf/masters.json` file:

```json
{
	"masters": [
		"xyops01.mycompany.com"
	]
}
```

Add the new server hostname to the `masters` array.  Remember, both servers need to be able to reach each other via their hostnames.

Then, install the software onto the new server, and copy over the following files before starting the service:

```
/opt/xyops/conf/config.json
/opt/xyops/conf/overrides.json
/opt/xyops/conf/masters.json
```

Then finally, start the service on both servers.  They should self-negotiate and one will be promoted to primary after 10 seconds (whichever hostname sorts first alphabetically).

Note that conductor server hostnames **cannot change**.  If they do, you will need to update the `/opt/xyops/conf/masters.json` file on all servers and restart everything.

For fully transparent auto-failover using a single user-facing hostname, see [Multi-Conductor with Nginx](#multi-conductor-with-nginx) below.

### Uninstall

To uninstall xyOps, simply stop the service and delete the `/opt/xyops` directory.

```sh
cd /opt/xyops
bin/control.sh stop
npm run unboot # deregister as system startup service
rm -rf /opt/xyops
cd -
```

Make sure you [decommission your servers](servers.md#decommissioning-servers) first.

## Environment Variables

xyOps supports a special environment variable syntax, which can specify command-line options as well as override any configuration settings.  The variable name syntax is `XYOPS_key` where `key` is one of several command-line options (see table below) or a JSON configuration property path.  These can come in handy for automating installations, and using container systems.  

For overriding configuration properties by environment variable, you can specify any top-level JSON key from `config.json`, or a *path* to a nested property using double-underscore (`__`) as a path separator.  For boolean properties, you can use `true` or `false` strings, and xyOps will convert them.  Here is an example of some of the possibilities available:

| Variable | Sample Value | Description |
|----------|--------------|-------------|
| `XYOPS_foreground` | `true` | Run xyOps in the foreground (no background daemon fork). |
| `XYOPS_echo` | `true` | Echo the event log to the console (STDOUT), use in conjunction with `XYOPS_foreground`. |
| `XYOPS_color` | `true` | Echo the event log with color-coded columns, use in conjunction with `XYOPS_echo`. |
| `XYOPS_base_app_url` | `http://xyops.yourcompany.com` | Override the [base_app_url](config.md#base_app_url) configuration property. |
| `XYOPS_email_from` | `xyops@yourcompany.com` | Override the [email_from](config.md#email_from) configuration property. |
| `XYOPS_WebServer__port` | `80` | Override the `port` property *inside* the [WebServer](config.md#webserver) object. |
| `XYOPS_WebServer__https_port` | `443` | Override the `https_port` property *inside* the [WebServer](config.md#webserver) object. |
| `XYOPS_Storage__Filesystem__base_dir` | `/data/xyops` | Override the `base_dir` property *inside* the [Filesystem](config.md#storage-filesystem) object *inside* the [Storage](config.md#storage) object. |

Almost every [configuration property](config.md) can be overridden using this environment variable syntax.  The only exceptions are things like arrays, e.g. [log_columns](config.md#log_columns).

## Daily Backups

Here is how you can generate daily backups of critical xyOps data, regardless of your backend storage engine.  First, create an [API Key](api.md#api-keys) and grant it full administrator privileges (this is required to use the [admin_export_data](api.md#admin_export_data) API).  You can then request a backup using a [curl](https://curl.se/) command like this:

```sh
curl -X POST "https://xyops.yourcompany.com/api/app/admin_export_data" \
	-H "X-API-Key: YOUR_API_KEY_HERE" -H "Content-Type: application/json" \
	-d '{"lists":"all","indexes":["tickets"]}' -O -J
```

This will save the backup as a `.txt.gz` file in the current directory named using this filename pattern:

```
xyops-data-export-YYYY-MM-DD-UNIQUEID.txt.gz
```

Please note that this example will only export **critical** data, and is not a full backup (notably absent is job history, alert history, snapshot history, server history, and activity log).  To backup *everything*, change the JSON in the curl request to: `{"lists":"all","indexes":"all","extras":"all"}`.  Note that this can take quite a while and produce a very large file depending on your xyOps database size.  To limit what exactly gets included in the backup, consult the [admin_export_data](api.md#admin_export_data) API docs.

### SQLite Backups

If you are using the stock storage configuration (SQLite + Filesystem), then xyOps will keep 7 days worth of compressed daily SQLite backups by default.  These are mainly for disaster recovery purposes.  You can configure or disable the backups in the [Storage.SQLite](config.md#storage-sqlite) configuration object:

```json
"SQLite": {
	"base_dir": "data",
	"filename": "sqlite.db",
	"pragmas": {
		"auto_vacuum": 0,
		"cache_size": -100000,
		"journal_mode": "WAL"
	},
	"cache": {
		"enabled": true,
		"maxItems": 100000,
		"maxBytes": 104857600
	},
	"backups": {
		"enabled": true,
		"dir": "data/backups",
		"filename": "backup-[yyyy]-[mm]-[dd]-[hh]-[mi]-[ss].db",
		"compress": true,
		"keep": 7
	}
}
```

Note that SQLite only stores data, not "files", under the default hybrid SQLite + Filesystem configuration.  So these backups are mainly for recovering from critical disaster situations like running out of disk space (where the DB may be corrupted).  They are not "complete" backups, as they do not contain job files, bucket files, ticket attachments, user uploads, etc.

## TLS

The xyOps built-in web server ([pixl-server-web](https://github.com/jhuckaby/pixl-server-web)) supports TLS.  Please read the following guide for setup instructions:

[Let's Encrypt / ACME TLS Certificates](https://github.com/jhuckaby/pixl-server-web#lets-encrypt--acme-tls-certificates)

Alternatively, you can setup a proxy to sit in front of xyOps and handle TLS for you (see next section).

## Multi-Conductor with Nginx

For a load balanced multi-conductor setup with Nginx w/TLS, please read this section.  This is a complex setup, and requires advanced knowledge of all the components used.  Let me recommend our [Enterprise Plan](https://xyops.io/pricing) here, as we can set all this up for you.  Now, the way this configuration works is as follows:

- [Nginx](https://nginx.org/) sits in front, and handles TLS termination, as well as routing requests to various backends.
- Nginx handles xyOps multi-conductor using an embedded [Health Check Daemon](https://github.com/pixlcore/xyops-healthcheck) which runs in the same container.
	- The health check keeps track of which conductor server is primary, and dynamically reconfigures and hot-reloads Nginx as needed.
	- We maintain our own custom Nginx docker image for this (shown below), or you can [build your own from source](https://github.com/pixlcore/xyops-nginx/blob/main/Dockerfile).

A few prerequisites for this setup:

- For multi-conductor setups, **you must have an external storage backend**, such as NFS, S3, or S3-compatible (MinIO, etc.).  See [Storage Engines](https://github.com/jhuckaby/pixl-server-storage#engines) for details.
- You will need a custom domain configured and TLS certs created and ready to attach.
- You have your xyOps configuration file customized and ready to go ([config.json](https://github.com/pixlcore/xyops/blob/main/sample_conf/config.json)) (see below).

For the examples below, we'll be using the following domain placeholders:

- `xyops.yourcompany.com` - User-facing domain which should route to Nginx / SSO.
- `xyops01.yourcompany.com` - Internal domain for conductor server #1.
- `xyops02.yourcompany.com` - Internal domain for conductor server #2.

The reason why the conductor servers each need their own unique (internal) domain name is because of how the multi-conductor system works.  Each conductor server needs to be individually addressable, and reachable by all of your worker servers in your org.  Worker servers don't know or care about Nginx -- they contact conductors directly, and have their own auto-failover system.  Also, worker servers use a persistent WebSocket connection, and can send a large amount of traffic, depending on how many worker servers you have and how many jobs you run.  For these reasons, it's better to have worker servers connect the conductors directly, especially at production scale.

That being said, you *can* configure your worker servers to connect through the Nginx front door if you want.  This can be useful if you have worker servers in another network or out in the wild, but it is not recommended for most setups.  To do this, please see [Overriding The Connect URL](hosting.md#overriding-the-connect-url) in our self-hosting guide.

Here is a docker command for running Nginx:

```sh
docker run \
	--detach
	--init \
	--name xyops-nginx \
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

Let's talk about the Nginx setup.  We are pulling in our own Docker image here ([xyops-nginx](https://github.com/pixlcore/xyops-nginx)).  This is a wrapper around the official Nginx docker image, but it includes our [xyOps Health Check](https://github.com/pixlcore/xyops-healthcheck) daemon.  The health check monitors which conductor server is currently primary, and dynamically reconfigures Nginx on-the-fly as needed (so Nginx always routes to the current primary server only).  The image also comes with a fully preconfigured Nginx.  To use this image you will need to provide:

- Your TLS certificate files, named `tls.crt` and `tls.key`, which are bound to `/etc/tls.crt` and `/etc/tls.key`, respectively.
- The list of xyOps conductor server domain names, as a CSV list in the `XYOPS_masters` environment variable (used by health check).

Once you have Nginx running, we can fire up the xyOps backend.  This is documented separately as you'll usually want to run these on separate servers.  Here is the multi-conductor configuration as a single Docker run command:

```sh
docker run \
	--detach \
	--init \
	--name xyops1 \
	--hostname xyops01.yourcompany.com \
	--restart unless-stopped \
	-e XYOPS_masters="xyops01.yourcompany.com,xyops02.yourcompany.com" \
	-e TZ="America/Los_Angeles" \
	-v "/local/path/to/xyops-conf:/opt/xyops/conf" \
	-v "/var/run/docker.sock:/var/run/docker.sock" \
	-p 5522:5522 \
	-p 5523:5523 \
	ghcr.io/pixlcore/xyops:latest
```

And here it is as a docker compose file:

```yaml
services:
  xyops1:
    image: ghcr.io/pixlcore/xyops:latest
    hostname: xyops01.yourcompany.com # change this per conductor server
    init: true
    environment:
      XYOPS_masters: xyops01.yourcompany.com,xyops02.yourcompany.com
      TZ: America/Los_Angeles
    volumes:
      - "/local/path/to/xyops-conf:/opt/xyops/conf"
      - "/var/run/docker.sock:/var/run/docker.sock"
    ports:
      - "5522:5522"
      - "5523:5523"
```

For additional conductor servers you can simply duplicate the command and change the hostname.

A few things to note here:

- We're using our official xyOps Docker image, but you can always [build your own from source](https://github.com/pixlcore/xyops/blob/main/Dockerfile).
- All conductor server hostnames need to be listed in the `XYOPS_masters` environment variable, comma-separated.
- All conductor servers need to be able to route to each other via their hostnames, so they can self-negotiate and hold elections.
- The timezone (`TZ`) should be set to your company's main timezone, so things like midnight log rotation and daily stat resets work as expected.
- The `/var/run/docker.sock` bind allows xyOps to launch its own containers (i.e. for the [Plugin Marketplace](marketplace.md)).
- The `/local/path/to/xyops-conf` path should be changed to a location on the host where you want to store the xyOps configuration directory.
	- xyOps will automatically populate this directory on first container launch.
	- See the [xyOps Configuration Guide](config.md) for details on how to customize the `config.json` file in this directory.

## External Storage

For using an external storage system, you have [several to choose from](https://github.com/jhuckaby/pixl-server-storage#engines).  We currently recommend **MinIO**, because it has an open source community edition, it is S3 compatible, and it handles both data and files in the same engine (i.e. you don't need to use the [Hybrid](https://github.com/jhuckaby/pixl-server-storage#hybrid) engine).  However, see the disclaimer below.

### MinIO

> [!WARNING]
> As of February 2026, MinIO's open-source repository has been archived.  The Chainguard Docker images still work, but we are actively evaluating [RustFS](#rustfs) as a viable replacement.

Here is a quick-start guide to getting MinIO up and running.  First, it should be noted that as of October 2025, MinIO stopped publishing Docker containers for the community edition.  No worries, however, because there are many trusted 3rd party MinIO Docker images that are actively maintained and work perfectly.  We recommend the [Chainguard](https://www.chainguard.dev/unchained/secure-and-free-minio-chainguard-containers) images.

First, export all your data from your current xyOps storage system.  You can perform a bulk data export from the "System" tab.

Then, create a Docker volume to store your MinIO data:

```sh
docker volume create minio-data
```

Next, download and run the Chainguard MinIO container, binding to our new data volume:

```sh
docker run --detach --name minio -p 9000:9000 -p 9001:9001 -v minio-data:/data cgr.dev/chainguard/minio:latest server /data --console-address ":9001"
```

Note that if you are also running xyOps in a Docker container on the same machine, you will need to [create a docker network](https://docs.docker.com/engine/network/) and add both containers to the same network, so they can communicate with each other.

Pull up the MinIO web interface in your browser by navigating to `http://MINIO_HOSTNAME:9001`.  Login using the default MinIO admin username and password (definitely change these later):

- **Username**: `minioadmin`
- **Password**: `minioadmin`

Create a new bucket, e.g. `xydata`.

Then, shut down xyOps completely, and reconfigure your [Storage.AWS](config.md#storage-aws) and [Storage.S3](config.md#storage-s3) objects thusly:

```json
"AWS": {
	"endpoint": "http://MINIO_HOSTNAME:9000",
	"endpointPrefix": false,
	"forcePathStyle": true,
	"hostPrefixEnabled": false,
	"region": "us-west-1",
	"credentials": {
		"accessKeyId": "YOUR_MINIO_USERNAME", 
		"secretAccessKey": "YOUR_MINIO_PASSWORD"
	}
},
"S3": {
	"connectTimeout": 5000,
	"socketTimeout": 5000,
	"maxAttempts": 50,
	"keyPrefix": "",
	"fileExtensions": true,
	"params": {
		"Bucket": "YOUR_MINIO_BUCKET_ID"
	},
	"cache": {
		"enabled": true,
		"maxItems": 100000,
		"maxBytes": 104857600
	}
}
```

Just for testing purposes you can set the `accessKeyId` and `secretAccessKey` properties to the MinIO defaults, i.e. `minioadmin`.

Finally, set the [Storage.engine](config.md#storage-engine) property to `S3` to use the new MinIO engine.

Start xyOps back up, and it should be using the new MinIO engine!  It will create a new set of default records on launch (and you'll have to re-login as `admin` / `admin`), but you can then re-import your data on the "System" tab, which should restore everything.

### RustFS

Here is a quick-start guide to getting [RustFS](https://rustfs.com/) up and running.  RustFS is an open-source S3 compatible key/value data storage system.  Note that as of this writing in February 2026, RustFS is still in alpha, but in our testing it is both stable and fast.

First, export all your data from your current xyOps storage system.  You can perform a bulk data export from the "System" tab.

Then, create a Docker volume to store your RustFS data:

```sh
docker volume create rustfs-data
```

Next, download and run the official RustFS container, binding to our new data volume:

```sh
docker run -d --name rustfs -p 9000:9000 -p 9001:9001 -v rustfs-data:/data rustfs/rustfs:latest
```

Note that if you are also running xyOps in a Docker container on the same machine, you will need to [create a docker network](https://docs.docker.com/engine/network/) and add both containers to the same network, so they can communicate with each other.

Pull up the RustFS web interface in your browser by navigating to `http://RUSTFS_HOSTNAME:9001`.  Login using the default RustFS admin username and password (definitely change these later):

- **Username**: `rustfsadmin`
- **Password**: `rustfsadmin`

Create a new bucket, e.g. `xydata`.

Create a new access key, and save both the key and secret.

Then, shut down xyOps completely, and reconfigure your [Storage.AWS](config.md#storage-aws) and [Storage.S3](config.md#storage-s3) objects thusly:

```json
"AWS": {
	"endpoint": "http://RUSTFS_HOSTNAME:9000",
	"endpointPrefix": false,
	"forcePathStyle": true,
	"hostPrefixEnabled": false,
	"region": "us-west-1",
	"credentials": {
		"accessKeyId": "YOUR_RUSTFS_ACCESS_KEY", 
		"secretAccessKey": "YOUR_RUSTFS_SECRET_KEY"
	}
},
"S3": {
	"connectTimeout": 5000,
	"socketTimeout": 5000,
	"maxAttempts": 50,
	"keyPrefix": "",
	"fileExtensions": true,
	"params": {
		"Bucket": "YOUR_RUSTFS_BUCKET_ID"
	},
	"cache": {
		"enabled": true,
		"maxItems": 100000,
		"maxBytes": 104857600
	}
}
```

Finally, set the [Storage.engine](config.md#storage-engine) property to `S3` to use the new RustFS engine.

Start xyOps back up, and it should be using the new RustFS engine!  It will create a new set of default records on launch (and you'll have to re-login as `admin` / `admin`), but you can then re-import your data on the "System" tab, which should restore everything.

## Satellite

**xyOps Satellite ([xySat](https://github.com/pixlcore/xysat))** is a companion to the xyOps system.  It is both a job runner, and a data collector for server monitoring and alerting.  xySat is designed to be installed on *all* of your servers, so it is lean, mean, and has zero dependencies.

For instructions on how to install xySat, see [Adding Servers](servers.md#adding-servers).

### Configuration

xySat is configured automatically via the xyOps conductor server.  The [satellite.config](config.md#satellite-config) object is automatically sent to each server after it connects and authenticates, so you can keep a conductor version of the xySat configuration which is auto-synced to all servers.  Here is the default config:

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
| `port` | Number | Specifies which port the xyOps conductor server will be listening on (default is `5522` for ws:// and `5523` for wss://). |
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

#### Overriding The Connect URL

When xySat is first installed, it is provided an array of hosts to connect to, which becomes a `hosts` array in the xySat config file on each server.  When xySat starts up, it connects to a *random host* from this array, and figures out which conductor is primary, and reconnects to that host.  If the conductor cluster changes, a new `hosts` array is automatically distributed to all servers by the current conductor.

In certain situations you may need to have xySat connect to a specific conductor host, instead of the default conductor list.  For e.g. you may have servers "out in the wild" and they need to connect through a proxy, or some other kind of complex network topology.  Either way, you can override the usual array of hosts that xySat connects to, and specify a static value instead.

To do this, add a `host` property into the xySat config as a top-level JSON property, on each server that requires it.  The xySat config file is located at:

```
/opt/xyops/satellite/config.json
```

Note that you should **not** add a `host` property into the [satellite.config](config.md#satellite-config) object on the conductor server, unless you want **all** of your servers to connect to the static host.

When both `hosts` and `host` exist in the config file, `host` takes precedence.

## Proxy Servers

To send all outbound requests through a proxy (for e.g. web hooks), simply set one or more of the [de-facto standard environment variables](https://curl.se/docs/manpage.html#ENVIRONMENT) used for this purpose:

```
HTTPS_PROXY
HTTP_PROXY
ALL_PROXY
NO_PROXY
```

xyOps will detect these environment variables and automatically configure proxy routing for all outbound requests.  The environment variable names may be upper or lower-case.  The proxy format should be a fully-qualified URL with port number.  To set a single proxy server for handling both HTTP and HTTPS requests, the simplest way is to just set `ALL_PROXY` (usually specified via a plain HTTP URL with port).  Example:

```
ALL_PROXY=http://company-proxy-server.com:8080
```

Use the `NO_PROXY` environment variable to specify a comma-separated domain whitelist.  Requests to any of the domains on this list will bypass the proxy and be sent directly.  Example:

```
NO_PROXY=direct.example.com
```

Please note that for proxying HTTPS (SSL) requests, unless you have pre-configured your machines to trust your proxy's local SSL cert, you will have to set the "SSL Cert Bypass" option in your web hooks.

The types of proxies supported are:

| Protocol | Example |
|----------|---------|
| `http` | `http://proxy-server-over-tcp.com:3128` |
| `https` | `https://proxy-server-over-tls.com:3129` |
| `socks` | `socks://username:password@some-socks-proxy.com:9050` |
| `socks5` | `socks5://username:password@some-socks-proxy.com:9050` |
| `socks4` | `socks4://some-socks-proxy.com:9050` |
| `pac-*` | `pac+http://www.example.com/proxy.pac` |

Make sure to set the environment variables across your server fleet, so things like the [HTTP Request Plugin](plugins.md#http-request-plugin) will also adhere.

## Air-Gapped Mode

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

For handling air-gapped software upgrades safely, please contact [xyOps Support](mailto:support@pixlcore.com).  As part of the enterprise plan we can send you digitally signed, encrypted packages with instructions on how to install them.

All xyOps documentation is available offline inside the xyOps app.

### Air-Gapped Satellite Installs

xyOps supports fully air-gapped server installs and upgrades.  Here is how it works:

1. As part of your [enterprise plan](https://xyops.io/pricing), request a signed xySat software package from us.
2. In your xyOps instance, create a [Storage Bucket](buckets.md) and note the Bucket ID.
3. Upload the files you received into the bucket.  The filenames will be in this format: `satellite-OS-ARCH.tar.gz`.
4. Edit your conductor config file, and set the `satellite.bucket` property to the Bucket ID.
5. Install or upgrade your servers as per usual.
6. xyOps will use the xySat install packages from the bucket, and not request anything over the internet.

For Docker containers, make sure that your local Docker has our images stored locally, so they aren't pulled from the repository.  Our official containers are available at the following locations:

- **xyOps**: https://github.com/pixlcore/xyops/pkgs/container/xyops
- **xySat**: https://github.com/pixlcore/xysat/pkgs/container/xysat

## Secret Key Rotation

xyOps uses a single secret key on every conductor server. This key encrypts stored secrets, signs temporary UI tokens, and issues authentication tokens for worker servers (xySat). Rotating this key is fully automated and performed from the UI.

### Overview

- **Secure generation**: A new cryptographically secure key is generated by the primary conductor and is never transmitted in plaintext.
- **Orchestrated rotation**: The scheduler is paused, queued jobs are flushed, and active jobs are aborted before rotation proceeds.
- **Seamless re-encryption**: All stored secrets are re-encrypted with the new key.
- **Re-authentication**: All connected xySat servers are re-authenticated and issued new auth tokens automatically.
- **Peer distribution**: The new key is distributed to all conductor peers (backup conductors) encrypted using the prior key.
- **Persistent config**: The new key is written to `/opt/xyops/conf/overrides.json`. The base `config.json` is not modified by design (often mounted read-only in Docker).
- **Not impacted**: Existing user sessions and API keys remain valid and are not affected by key rotation.

### Pre-Checks

Before starting a rotation, ensure that all conductors and all worker servers are online and healthy:

- Verify that every conductor is reachable and participating in the cluster.
- Verify that all worker servers show as online in the Servers list.

If a node is offline during rotation, it will not receive updates automatically. See [Offline Recovery](#offline-recovery) below.

### Rotation Process

1. Click on the "System" link in the Admin section in the sidebar, and start Key Rotation.
2. The system pauses the scheduler, flushes queued jobs, and aborts active jobs.
3. A new key is generated and used to re-encrypt all secrets.
4. Connected worker servers are issued new auth tokens.
5. The new key is securely distributed to all conductor peers.
6. The key is persisted to `/opt/xyops/conf/overrides.json` on each conductor.
7. The schedule remains paused until you resume it (click the "Paused" icon in the header).

No manual edits or restarts are required when all nodes are online.

### Offline Recovery

If a server or conductor was offline during the rotation window, you will need to perform the appropriate recovery action.

#### Re-authenticate an Offline Worker Server

If a worker server missed the rotation, you can recover it by deriving a new auth token manually.

What you need:

- The current secret key from the primary conductor. This is only available on-disk via SSH to the conductor: `/opt/xyops/conf/overrides.json` (`secret_key`). It is not retrievable via API.
- The offline server's alphanumeric ID (e.g. `smf4j79snhe`). You can find this in the UI on the server history page, or on the server itself in `/opt/xyops/satellite/config.json`.

Compute the SHA-256 of the concatenation: `SERVER_ID + SECRET_KEY`, and use the hex digest as the new auth token. Example:

```sh
## OpenSSL
printf "%s" "SERVER_IDSECRET_KEY" | openssl dgst -sha256 -r | awk '{print $1}'
```

Then edit the satellite config on the worker:

```
/opt/xyops/satellite/config.json
```

Set the `auth_token` property to the computed SHA-256 hex string. Save the file -- the satellite will auto-reload and attempt to reconnect within ~30 seconds. Check the satellite logs for troubleshooting.

#### Update an Offline Conductor

If a conductor was offline during rotation, SSH to it and update the key by hand:

1) Open `/opt/xyops/conf/overrides.json` on the offline conductor.
2) Set the `secret_key` property to the new key from the primary conductor. If the file lacks `secret_key` (e.g. first rotation), add it.
3) Save the file and restart the conductor service if needed.

After the update, the conductor will rejoin the cluster with the correct key.

### Best Practices

- Schedule rotations during a maintenance window to tolerate job aborts.
- Confirm node health beforehand to avoid manual recovery steps.
- Store the current key securely and restrict SSH access to conductors.
- Rotate periodically as part of your security program (see [Security Checklist](scaling.md#security-checklist)).
