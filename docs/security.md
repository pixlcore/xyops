# Security

## Overview

The xyOps team takes security very seriously. Due to the nature of how xyOps is installed on large server fleets a lot of decisions are made with security being the priority, and we always aim to implement security by design.

For a broader overview of xyOps self-hosting, privacy, telemetry, outbound requests, and enterprise security posture, see the [Trust](trust.md) guide.

## Coordinated vulnerability disclosure

xyOps follows the [coordinated vulnerability disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure) model when dealing with security vulnerabilities. This was previously known as responsible disclosure. We strongly urge anyone reporting vulnerabilities to xyOps or any other project to follow this model as it is considered as a best practice by many in the security industry.

If you believe you have identified a security vulnerability or security related bug with xyOps please make every effort to contact us privately using one of the contact options below. Please do not open an issue, do not notify us in public, and do not disclose this issue to third parties.

Using this process helps ensure that users affected have an avenue to fixing the issue as close to the issue being made public as possible. This mitigates the increasing the attack surface (via improving attacker knowledge) for diligent administrators simply via the act of disclosing the security issue.

## Contact Options

Several contact options exist however it's important you specifically use a security contact method when reporting a security vulnerability or security related bug. These methods are clearly documented below.

### GitHub Security

Users can utilize GitHub's security vulnerability system to privately [report a vulnerability](https://github.com/pixlcore/xyops/security/advisories/new). This is an easy method for users who have a GitHub account.

### Email

Users can utilize the [security@pixlcore.com](mailto:security@pixlcore.com) email address to privately report a vulnerability. This is an easy method of users who do not have a GitHub account.

This email account is only accessible by members of the core team for the purpose of disclosing security vulnerabilities and issues within the xyOps code base.

## Process

1. The user privately reports a potential vulnerability.
2. The report is acknowledged as received.
3. The report is reviewed to ascertain if additional information is required. If it is required:
   1. The user is informed that the additional information is required.
   2. The user privately adds the additional information.
   3. The process begins at step 3 again, proceeding to step 4 if the additional information provided is sufficient.
4. The vulnerability is reproduced.
5. The vulnerability is patched, and if possible the user reporting the bug is given access to a fixed binary, docker image, and git patch.
6. The patch is confirmed to resolve the vulnerability.
7. The fix is released and users are notified that they should update urgently.
8. The [security advisory](https://github.com/pixlcore/xyops/security/advisories) is published when (whichever happens sooner):
  - The CVE details are published by [MITRE](https://www.mitre.org/), [NIST](https://www.nist.gov/), etc.
  - Roughly 7 days after users have been notified the update is available.

## Credit

Users who report bugs will at their discretion (i.e. they do not have to be if they wish to remain anonymous) be credited for the discovery. Both in the [security advisory](https://github.com/pixlcore/xyops/security/advisories) and in our documentation.
