# Development

## Overview

xyOps runs as a component in the [pixl-server](https://github.com/jhuckaby/pixl-server) framework.  It is highly recommended to read and understand that module and its component system before attempting to work on xyOps.  The following server components are also used:

| Module Name | Description | License |
|-------------|-------------|---------|
| [pixl-server-api](https://github.com/jhuckaby/pixl-server-api) | A REST API component for the pixl-server framework. | MIT |
| [pixl-server-debug](https://github.com/jhuckaby/pixl-server-debug) | An easy way to debug your pixl-server app using Chrome Dev Tools. | MIT |
| [pixl-server-storage](https://github.com/jhuckaby/pixl-server-storage) | A key/value/list storage component for the pixl-server framework. | MIT |
| [pixl-server-user](https://github.com/jhuckaby/pixl-server-user) | A basic user login system for the pixl-server framework. | MIT |
| [pixl-server-web](https://github.com/jhuckaby/pixl-server-web) | A web server component for the pixl-server framework. | MIT |
| [pixl-server-unbase](https://github.com/jhuckaby/pixl-server-unbase) | A database component for the pixl-server framework. | MIT |

In addition, xyOps uses the following server-side PixlCore utility modules:

| Module Name | Description | License |
|-------------|-------------|---------|
| [pixl-acl](https://github.com/jhuckaby/pixl-acl) | A simple but fast implementation of IPv4 and IPv6 ACL filtering. | MIT |
| [pixl-args](https://github.com/jhuckaby/pixl-args) | A simple module for parsing command line arguments. | MIT |
| [pixl-boot](https://github.com/jhuckaby/pixl-boot) | Register your service to launch on server startup (Linux / macOS). | MIT |
| [pixl-chart](https://github.com/jhuckaby/pixl-chart) | A simple time series chart renderer using HTML5 Canvas. | MIT |
| [pixl-class-util](https://github.com/pixlcore/class-util) | Helper functions for extending classes with mixins and more. | MIT |
| [pixl-cli](https://github.com/jhuckaby/pixl-cli) | Tools for building command-line apps for Node.js. | MIT |
| [pixl-config](https://github.com/jhuckaby/pixl-config) | A simple JSON configuration loader. | MIT |
| [pixl-json-stream](https://github.com/jhuckaby/pixl-json-stream) | Provides an easy API for sending and receiving JSON records over standard streams (pipes or sockets). | MIT |
| [pixl-logger](https://github.com/jhuckaby/pixl-logger) | A simple logging class which generates bracket delimited log columns. | MIT |
| [pixl-mail](https://github.com/jhuckaby/pixl-mail) | A very simple class for sending e-mail via SMTP. | MIT |
| [pixl-perf](https://github.com/jhuckaby/pixl-perf) | A simple, high precision performance tracking system. | MIT |
| [pixl-request](https://github.com/jhuckaby/pixl-request) | A very simple module for making HTTP requests. | MIT |
| [pixl-tools](https://github.com/jhuckaby/pixl-tools) | A set of miscellaneous utility functions for Node.js. | MIT |
| [pixl-unit](https://github.com/jhuckaby/pixl-unit) | A very simple unit test runner for Node.js. | MIT |

For the client-side, the xyOps web application is built on the [pixl-xyapp](https://github.com/pixlcore/pixl-xyapp) HTML5/CSS/JavaScript framework:

| Module Name | Description | License |
|-------------|-------------|---------|
| [pixl-xyapp](https://github.com/pixlcore/pixl-xyapp) | A client-side JavaScript framework, designed to be a base for web applications. | MIT |

## Installing Dev Tools

xyOps contains some compiled binary dependencies (namely [better-sqlite3](https://npmjs.com/package/better-sqlite3)), so if a precompiled binary cannot be found by for your exact arch, it may need to be compiled from source.  To that end, you may need:

For Debian (Ubuntu) OSes:

```sh
apt-get install build-essential python3-setuptools
```

For RedHat (Fedora / CentOS):

```sh
yum install gcc-c++ make
```

For macOS, download [Apple's Xcode](https://developer.apple.com/xcode/download/), and then install the [command-line tools](https://developer.apple.com/downloads/).

## Manual Installation

Here is how you can download the very latest xyOps dev build and install it manually (may contain bugs!):

```sh
git clone https://github.com/pixlcore/xyops.git
cd xyops
npm install
node bin/build.js dev
```

Passing `dev` to the build script means it will keep all JS and CSS unobfuscated (original source served as separate files).

I highly recommend placing the following `.gitignore` file at the base of the project, if you plan on committing changes and sending pull requests:

```
.gitignore
/node_modules
/work
/logs
/data
/conf
/temp
htdocs/index.html
htdocs/test*
htdocs/js/external/*
htdocs/js/common
htdocs/fonts/*
htdocs/css/font*
htdocs/css/mat*
htdocs/css/base.css
htdocs/css/normalize.css
htdocs/css/atom*
htdocs/css/xterm*
htdocs/codemirror
sample_conf/masters.json
```

## Starting in Debug Mode

To start xyOps in debug mode, issue the following command:

```
./bin/debug.sh
```

This will launch the service without forking a daemon process, and echo the entire debug log contents to the console.  This is great for debugging server-side issues.  Beware of file permissions if you run as a non-root user.  Hit Ctrl-C twice to shut down the service when in this mode.

Also, you can customize which log categories are echoed by specifying a space-separated list as a single CLI argument, like this:

```sh
./bin/debug.sh "xyOps Transaction Error API Unbase Action Comm Job Workflow Maint Multi Scheduler SSO"
```

This is useful for muting extremely loud components like `Storage` and `WebServer`.

## REPL

By default the xyOps `debug.sh` script starts a [REPL](https://nodejs.org/api/repl.html) in the console, so you can type in live JavaScript and have it execute inside the xyOps process.  You also have access to the following globals:

| Global | Description |
|--------|-------------|
| `server` | The current global [pixl-server](https://github.com/jhuckaby/pixl-server) instance. |
| `cli` | The [pixl-cli](https://github.com/jhuckaby/pixl-cli) global, which contains a variety of utility functions. |
| `xyOps` | The main xyOps server component.  This is also aliased to `xy`. |
| `Storage` | The [pixl-server-storage](https://github.com/jhuckaby/pixl-server-storage) server component. |
| `Unbase` | The [pixl-server-unbase](https://github.com/jhuckaby/pixl-server-unbase) server component. |
| `WebServer` | The [pixl-server-web](https://github.com/jhuckaby/pixl-server-web) server component. |
| `API` | The [pixl-server-api](https://github.com/jhuckaby/pixl-server-api) server component. |
| `User` | The [pixl-server-user](https://github.com/jhuckaby/pixl-server-user) server component. |
| `Debug` | The [pixl-server-debug](https://github.com/jhuckaby/pixl-server-debug) server component. |

You also have access to the following REPL commands (use a leading dot to activate):

| Command | Description |
|---------|-------------|
| `.echo` | Add or remove echo categories, e.g. `.echo add Storage WebServer`. |
| `.notify` | Send a notification to all users, e.g. `.notify HI THERE`.  Includes a random sound effect! |

## Running Unit Tests

xyOps comes with a full unit test suite, which runs via the [pixl-unit](https://github.com/jhuckaby/pixl-unit) module (which should be installed automatically).  To run the unit tests, make sure xyOps isn't already running, and type:

```
npm test
```

If any tests fail, please open a [GitHub Issue](https://github.com/pixlcore/xyops/issues) and include any relevant unit test logs, which can be found in `./test/logs/`.

## Self-Signed Certificates

Here is how to create a self-signed and trusted TLS certificate you can use with xyOps for developing locally.  First, create a temporary config file (`san.cnf`):

```
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
```

Then run this command:

```sh
openssl req -x509 -newkey rsa:2048 -nodes -keyout tls.key -out tls.crt -days 365 -config san.cnf
```

Then, follow the instructions below for your development platform.

### Windows Cert Trust

1. Press Windows + R, type `certmgr.msc`, and press Enter.
2. In the left panel, expand: **Trusted Root Certification Authorities** → **Certificates**.
3. Right-click **Certificates**, then choose: **All Tasks → Import...**
4. Browse to your `tls.crt` file.
5. Choose "Place all certificates in the following store" → make sure it's set to **Trusted Root Certification Authorities**.
6. Finish and confirm any security prompt.

### macOS Cert Trust

1. Open the **Keychain Access** app.
2. In the left sidebar, select **System** under **Keychains**.
3. Select **Certificates** under **Category**.
4. From the top menu, choose **File → Import Items...**
5. Select your `tls.crt` file, confirm import into the System keychain.
6. You will be prompted for your macOS password to authorize the change.
7. After importing, double-click the certificate entry.
8. In the popup window, expand the **Trust** section.
9. Set "When using this certificate" to **Always Trust**.
10. Close the window, and enter your password again if prompted.

### Linux Cert Trust

**Debian/Ubuntu:**

1. `sudo cp tls.crt /usr/local/share/ca-certificates/xyops.crt`
2. `sudo update-ca-certificates`

**RedHat/CentOS/Fedora:**

1. `sudo cp tls.crt /etc/pki/ca-trust/source/anchors/xyops.crt`
2. `sudo update-ca-trust extract`

**Note:** This does not affect Firefox unless it's configured to use system trust (by default it has its own CA store).

### Move to xyOps

Move the cert files to this location for xyOps to use:

```sh
mv tls.crt /opt/xyops/conf/
mv tls.key /opt/xyops/conf/
```

You can now delete the `san.cnf` file.  It is only used temporarily during the cert creation process.
