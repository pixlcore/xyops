# Command Line

## Overview

Here are all the xyOps services available to you on the command line.  Most of these are accessed via the following shell script:

```
/opt/xyops/bin/control.sh [COMMAND]
```

Here are all the accepted commands:

| Command | Description |
|---------|-------------|
| `start` | Starts xyOps in daemon mode. See [Starting and Stopping](CommandLine.md#starting-and-stopping). |
| `stop` | Stops the xyOps daemon and waits for exit. See [Starting and Stopping](CommandLine.md#starting-and-stopping). |
| `restart` | Calls `stop`, then `start`, in sequence. See [Starting and Stopping](CommandLine.md#starting-and-stopping).  |
| `status` | Checks whether xyOps is currently running. See [Starting and Stopping](CommandLine.md#starting-and-stopping).  |
| `admin` | Creates new emergency admin account (specify user / pass). See [Recover Admin Access](CommandLine.md#recover-admin-access). |
| `grant` | Manually grant a privilege to a user: `bin/control.sh grant USERNAME PRIVILEGE_ID`. |
| `revoke` | Manually revoke a privilege from a user: `bin/control.sh revoke USERNAME PRIVILEGE_ID`. |
| `upgrade` | Upgrades xyOps to the latest stable (or specify version). See [Upgrading xyOps](CommandLine.md#upgrading-xyops). |
| `version` | Outputs the current xyOps package version and exits. |
| `help` | Displays a list of available commands and exits. |

## Starting and Stopping

To start the service, use the `start` command:

```
/opt/xyops/bin/control.sh start
```

And to stop it, the `stop` command:

```
/opt/xyops/bin/control.sh stop
```

You can also issue a quick stop + start with the `restart` command:

```
/opt/xyops/bin/control.sh restart
```

The `status` command will tell you if the service is running or not:

```
/opt/xyops/bin/control.sh status
```

## Recover Admin Access

Lost access to your admin account?  You can create a new temporary administrator account on the command-line.  Just execute this command on your primary server:

```
/opt/xyops/bin/control.sh admin USERNAME PASSWORD
```

Replace `USERNAME` with the desired username, and `PASSWORD` with the desired password for the new account.  Note that the new user will not show up in the main list of users in the UI.  But you will be able to login using the provided credentials.  This is more of an emergency operation, just to allow you to get back into the system.  *This is not a good way to create permanent users*.  Once you are logged back in, you should consider creating another account from the UI, then deleting the emergency admin account.

Note that this trick does **not** work with [SSO](sso.md).  It only applies to setups that use the built-in user management system.

## Server Startup

To register xyOps as a background daemon startup service (so it automatically start on server reboot), type this:

```sh
cd /opt/xyops
npm run boot
```

This is done via the [pixl-boot](https://github.com/jhuckaby/pixl-boot) module, and it supports [Systemd](https://en.wikipedia.org/wiki/Systemd) if available, falling back to [Sysv Init](https://en.wikipedia.org/wiki/Init#SysV-style) or [launchd](https://support.apple.com/guide/terminal/script-management-with-launchd-apdc6c1077b-5d5d-4d35-9c19-60f2397b2369/mac) on macOS.

**For Linux users:** Once you register xyOps as a Systemd service, you should always start / stop it using the proper `systemctl` commands.  The service name is `xyops.service`.

If you change your mind or want to uninstall xyOps, you can deregister the startup service with this command:

```sh
cd /opt/xyops
npm run unboot
```

**Important Note:** When xyOps starts on server boot, it typically does not have a proper user environment, namely a `PATH` environment variable.  So if your scripts rely on binary executables in non-standard locations, you may have to restore your custom `PATH` and other variables inside your scripts by redeclaring them.

## Upgrading xyOps

To upgrade xyOps, you can use the built-in `upgrade` command:

```
/opt/xyops/bin/control.sh upgrade
```

This will upgrade the app and all dependencies to the latest stable release, if a new one is available.  It will not affect your data storage, users, or configuration settings.  All those will be preserved and imported to the new version.  For multi-server clusters, you'll need to repeat this command on each server.

Alternately, you can specify the exact version you want to upgrade (or downgrade) to:

```
/opt/xyops/bin/control.sh upgrade 1.0.4
```

If you upgrade to the `HEAD` version, this will grab the very latest from GitHub.  Note that this is primarily for developers or beta-testers, and is likely going to contain bugs.  Use at your own risk:

```
/opt/xyops/bin/control.sh upgrade HEAD
```

## Database CLI

xyOps comes with a simple DB CLI from which you can execute raw commands.  The responses are always in JSON format.  This is mainly used for debugging and troubleshooting.  The command is located here:

```
/opt/xyops/bin/db-cli.js COMMAND INDEX ARG1, ARG2, ...
```

To perform a search query on a specific database:

```sh
/opt/xyops/bin/db-cli.js search tickets "status:open"
```

To fetch a single record from a database:

```sh
/opt/xyops/bin/db-cli.js get alerts "amg6sl6z0cc"
```

This is a low-level developer tool, and requires advanced knowledge of the database system in xyOps.  To learn more, see:

- The `/opt/xyops/internal/unbase.json` file, which describes all the database tables in xyOps.
- The [Unbase](https://github.com/jhuckaby/pixl-server-unbase) database system which powers xyOps.
- The [query syntax](https://github.com/jhuckaby/pixl-server-storage/blob/master/docs/Indexer.md#simple-queries) documentation.
