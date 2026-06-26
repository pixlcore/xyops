# Trust

## Overview

xyOps is self-hosted operations software. You install it in your own environment, connect it to your own servers, and keep control of your own data.

PixlCore does not operate customer xyOps deployments, host customer xyOps data, or receive telemetry from customer installations. The product is designed so your jobs, logs, metrics, secrets, files, tickets, snapshots, and configuration remain inside your infrastructure.

This page summarizes the main trust boundaries, privacy posture, and security practices behind xyOps. For deeper technical detail, see the [Security Overview](https://github.com/pixlcore/xyops/blob/main/SECURITY_OVERVIEW.md), [Threat Model](https://github.com/pixlcore/xyops/blob/main/THREAT_MODEL.md), [Privacy Policy](privacy.md), and [Security Reporting](security.md).


## Self-Hosted by Design

xyOps does not require a vendor cloud control plane to operate.

Your deployment is responsible for:

- hosting the conductor and any worker servers
- storing xyOps data
- securing the network, TLS, reverse proxy, SSO gateway, backups, and operating system
- choosing which integrations, plugins, web hooks, and outbound requests are allowed

PixlCore is responsible for:

- maintaining the xyOps open-source software
- publishing releases, documentation, and security advisories
- providing support to customers who choose a paid support plan
- reviewing official Marketplace entries before they are admitted to the public catalog

Paid support does not give PixlCore automatic access to your deployment. Any logs, configuration snippets, exports, or diagnostic material you share with support are shared by you, under your control.


## No Telemetry

xyOps does not send telemetry.

Specifically, the xyOps software does not:

- include product analytics or tracking
- call home to PixlCore servers
- send usage data, job data, logs, metrics, secrets, files, tickets, snapshots, configuration, customer content, or deployment identifiers to PixlCore or any telemetry service

All data processed by xyOps remains in your own infrastructure unless you configure xyOps, a plugin, a script, or a web hook to send it somewhere else.

Some optional features can make outbound HTTP requests to third-party services, primarily GitHub, to fetch public release metadata, xySat packages, Marketplace catalog data, or selected plugin files. These requests support update and installation workflows, and are not product telemetry. They can be disabled or restricted for air-gapped deployments.

As with any outbound HTTP request, the destination service may observe standard network metadata such as source IP address, request time, URL, and user agent.

For the formal privacy statement, see the [Privacy Policy](privacy.md).


## Optional External Requests

xyOps can make outbound network requests for features that administrators choose to use. These are designed to be explicit, configurable, and compatible with restricted environments.

| Feature | Default Destination | Purpose | Control |
|---------|---------------------|---------|---------|
| Core release checks | GitHub Releases API | Check whether xyOps updates are available | `multi.enable_version_checks` |
| xySat release checks | GitHub Releases API | Check whether worker agent updates are available | `satellite.enable_version_checks` |
| xySat downloads | GitHub release downloads by default | Install or upgrade worker agents | `satellite.base_url`, or bucket-based offline packages |
| Marketplace catalog | GitHub raw content | Search the official Plugin Marketplace | `marketplace.enabled` |
| Marketplace plugin install | Plugin-defined source such as GitHub, NPM, PyPI, or container registry | Download and run a selected plugin | administrator action and plugin configuration |
| Outdated badges | GitHub release metadata | Show version status in the admin UI | `client.outdated_badges` |
| Web hooks and HTTP plugins | Administrator-defined URLs | Integrate with internal or external systems | privileges, plugin parameters, and airgap rules |

The Marketplace does not install anything by default. Searching and installing plugins is user-driven, and the Marketplace can be disabled entirely.

Third-party plugins may make their own network requests. Official Marketplace requirements ask plugin authors to declare user data or metrics collection in their README, but you should still review plugin code and documentation before installing it in a sensitive environment.


## Air-Gapped and Restricted Networks

xyOps supports air-gapped installs and restricted outbound networking.

Airgap rules can limit outbound requests to approved IP ranges, and those rules are applied to xyOps itself and propagated to connected worker servers for supported request paths. For fully offline environments, xySat upgrade packages can be provided out of band and served from a local xyOps bucket instead of GitHub.

For setup details, see [Air-Gapped Mode](hosting.md#air-gapped-mode) and [Offline Satellite Packages](hosting.md#offline-satellite-packages).


## Security Model

xyOps is built around explicit trust boundaries between ordinary users, administrators, the conductor, storage, worker servers, plugins, and outbound integrations.

At a high level:

- Passwords are salted and bcrypt-hashed (and never stored in plaintext).
- Browser sessions use cryptographically generated session IDs and CSRF tokens.
- Session cookies are `HttpOnly` by default and use `SameSite=Lax`.
- API keys are stored as salted hashes and are only shown once when created.
- Secret Vault values are encrypted at rest using authenticated encryption.
- Secret values are decrypted only when needed for runtime use.
- The xySat worker agent does not open inbound listeners. It connects outbound to the conductor and authenticates before doing work.
- Standard users have a narrow default privilege set.
- Powerful features such as shell scripts, plugin installation, web hooks, arbitrary HTTP requests, and system hooks are administrator-controlled by default.

For a deeper technical walkthrough, see the [Security Overview](https://github.com/pixlcore/xyops/blob/main/SECURITY_OVERVIEW.md).


## Secrets and Sensitive Data

The Secret Vault is designed for API keys, passwords, auth tokens, and other sensitive runtime values.

Secret values are encrypted at rest. The UI and list APIs return metadata only, not secret values. Administrators can explicitly decrypt a secret through the UI or API, and that action is recorded in the Activity Log. Routine runtime use is logged separately without exposing secret values.

Jobs receive assigned secret variables at runtime. If a job script prints a secret to stdout or stderr, xyOps will record that output like any other job log, so operators should treat job logs, exports, backups, and uploaded files as sensitive data.

For details, see [Secrets](secrets.md).


## Auditability

xyOps records security-relevant activity so operators can understand what changed and who changed it.

Examples include:

- logins and logouts
- API key lifecycle events
- secret creation, update, deletion, and administrator decryption
- plugin, event, workflow, config, and web hook changes
- server enrollment and connectivity changes
- conductor and peer changes

Audit logs are part of your deployment data and remain in your infrastructure.


## Administrator-Controlled Power Features

xyOps is an operations automation system, so administrators can deliberately configure powerful behavior.

For example, trusted administrators may:

- run arbitrary shell scripts
- install plugins
- point web hooks or HTTP plugins at internal systems
- pass secrets into jobs
- run selected plugins with elevated operating system privileges
- connect xyOps to incident, ticketing, messaging, or deployment systems

These features are intentional. The security model focuses on keeping them behind the correct privilege boundaries, making their behavior visible, and giving operators controls such as admin-locked plugin fields, low-privilege runtime credentials, and airgap rules.


## Vulnerability Reporting

Please do not report security vulnerabilities publicly.

Use one of the private reporting channels listed in the [Security Reporting](security.md) guide. xyOps follows coordinated vulnerability disclosure so issues can be reproduced, fixed, released, and communicated responsibly.


## Compliance

xyOps is self-hosted software, so many operational controls belong to the customer deployment: network access, TLS, SSO policy, backups, operating system hardening, staff access, and data retention.

PixlCore has not completed a SOC 2 report for xyOps at the time of this writing. However, xyOps is designed with enterprise security review in mind, including clear documentation for privacy, data flow, secrets, audit logs, administrator privileges, air-gapped deployments, and technical threat boundaries.

If your procurement or security team needs a questionnaire completed, contact [xyOps Support](support.md).


## Related Documents

- [Privacy Policy](privacy.md)
- [Security Reporting](security.md)
- [Secrets](secrets.md)
- [Self-Hosting](hosting.md)
- [Production Scaling](scaling.md)
- [Privileges](privileges.md)
- [Plugin Marketplace](marketplace.md)
- [Security Overview](https://github.com/pixlcore/xyops/blob/main/SECURITY_OVERVIEW.md)
- [Threat Model](https://github.com/pixlcore/xyops/blob/main/THREAT_MODEL.md)
