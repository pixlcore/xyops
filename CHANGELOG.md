# xyOps Changelog

## Version v1.0.47

> April 13, 2026

- [`e59f9e8`](https://github.com/pixlcore/xyops/commit/e59f9e888344b70e157a9491117c0efa6839781b): Version 1.0.47
- [`b5e810d`](https://github.com/pixlcore/xyops/commit/b5e810d1b95da62a6ccd7785378e14d5ef4ff0db): Events Doc: Add sections on new custom job weight, group priority sorting, and priority job queuing features.
- [`31f60fc`](https://github.com/pixlcore/xyops/commit/31f60fc310402a0fe615bf350e96dff279a7d972): Servers Doc: Add section on new max jobs per server feature.
- [`dd9275f`](https://github.com/pixlcore/xyops/commit/dd9275f3ce3c57e83e4c287c293ef613256c69d4): UI Bug Fix: getNiceJobSourceList was missing alert, magic, and startup definitions.  Also added a catch-all.  Fixes #255.
- [`a438ee7`](https://github.com/pixlcore/xyops/commit/a438ee70132195aef66558a80c50278ee9b3cbde): Feature: Events can now define a job "weight" in the max jobs limiter, which is used in server max jobs calculations.
- [`40098d1`](https://github.com/pixlcore/xyops/commit/40098d1dccea84311d3c79abf0dcc4c115e3ef39): Feature: Custom QuickMon Plugins and graphs.
- [`44e115e`](https://github.com/pixlcore/xyops/commit/44e115e24041bb378b980f07f9433fce70b1fbf3): Snapshot Icons: Differentiate between single server and group snapshots.

## Version v1.0.46

> April 10, 2026

- [`9dd9b49`](https://github.com/pixlcore/xyops/commit/9dd9b49bbcfa5460d4a6a199fadd35c2d9792f24): Version 1.0.46
	- Bump pixl-mail to v1.1.7 for upstream vuln fix in nodemailer.
	- Bump pixl-request to v2.6.4 for upstream vuln fixes in basic-ftp (sub-dep of proxy-agent).
- [`bbf7e8d`](https://github.com/pixlcore/xyops/commit/bbf7e8d7ac6639f8319efb2a7a2588931db1d48a): Initial Setup: HTTP Request Plugin: Add new idle_timeout and connect_timeout params, set all timeouts to number variants.
- [`d6118f2`](https://github.com/pixlcore/xyops/commit/d6118f2e6bed6bbc039fea643b090ebb458c7d98): Sample Config: Add satellite.config.graphics_enabled set to false (for future xySat use).
- [`8ac3ec2`](https://github.com/pixlcore/xyops/commit/8ac3ec2ec3ec42e2966f61ce95eac42239d2b103): Quiet Modifier: For ephemeral mode, if job finishes with a non-zero code (i.e. error) remove ephemeral flag.
- [`f5ec5e2`](https://github.com/pixlcore/xyops/commit/f5ec5e2a535bc3843de235f7a38fa5f1da832787): Feature: Allow default max jobs per server to be set at the group level (individual servers can override).
- [`a98c557`](https://github.com/pixlcore/xyops/commit/a98c557a977f919cdf04dd41d00a24f9c51acb2c): Feature: New job server selection algorithms: prefer_first_natural, and prefer_last_natural.
- [`c0ba698`](https://github.com/pixlcore/xyops/commit/c0ba6982c7fcd3599bb76b9027ddabbe4cd2dd75): Feature: Optional job priority flag, to jump to the head of the queue.
- [`b5a28ec`](https://github.com/pixlcore/xyops/commit/b5a28ecd389cddce607f183bc17bbba5f0bb24ef): Feature: Implement optional max jobs per server (server.maxJobs).
- [`a3c82d0`](https://github.com/pixlcore/xyops/commit/a3c82d0f2e777335ea18aeac020c13aaf320d101): Bug Fix: Job Target Expressions: Ensure expression is re-evaluated when monitoring queued jobs.
- [`5886190`](https://github.com/pixlcore/xyops/commit/5886190c011768afb32af02bb34e66a6b1a9931d): Server UI: Fix race condition when sitting on server page while server disconnects / reconnects.
- [`d5d4609`](https://github.com/pixlcore/xyops/commit/d5d4609e531063bbcfa42c9d14f4aa2a220cd46f): Actions Doc: Added clarification about the "Suspend" action, which can only be used inside of a workflow.
- [`4ca3e59`](https://github.com/pixlcore/xyops/commit/4ca3e59931163da8e49c1cb68443d5ea707acc22): UI Fix: When clicking on an out-of-date conductor version to upgrade it, prevent the refresh from popping up the upgrade dialog again.
- [`676ca53`](https://github.com/pixlcore/xyops/commit/676ca53c7b8e18a8b967926057fd9f3132b28ace): Delete Job UI: When deleting a workflow sub-job, update the parent workflow so it shows a visual indication of the deleted job in the list.  Fixes #243
- [`c08ce54`](https://github.com/pixlcore/xyops/commit/c08ce54f1b7f938440ab9573e8488a29159288cf): Log Viewer: Add Postgres and Redis logs to the menu.
- [`a4eb1de`](https://github.com/pixlcore/xyops/commit/a4eb1deb8af1602384942d355e6fc4537e2a0768): Hot Keys: Add sanity check for event.key.  Fixes #245.
- [`e93f14b`](https://github.com/pixlcore/xyops/commit/e93f14be618381a896889688602f7aa4b6ec6647): Installer Script: Change minimum supported Node.js version to v20.

## Version v1.0.45

> April 6, 2026

- [`041c000`](https://github.com/pixlcore/xyops/commit/041c0007ab7ba6a3f02bd600e6917b60d68f9a64): Version 1.0.45
	- Bump pixl-server-storage to v4.1.0 for new Postgres storage engine.
	- Add pg module for Postgres storage engine.
	- Add ioredis module for Redis storage engine.
	- Bump lodash (sub-dep of async) to v4.18.1 for another vuln fix.
- [`715a640`](https://github.com/pixlcore/xyops/commit/715a640dbfe874709ef5cb15ac58b83f5c9b0c4e): Bug Fix: Custom sub-job labels were not visible on workflow job detail screen.  Fixes #242.
- [`f946407`](https://github.com/pixlcore/xyops/commit/f946407a845a5c4c13c045acf9472af5f2ecc215): Sample Config: Add new default Postgres storage engine configuration.
- [`6f863ba`](https://github.com/pixlcore/xyops/commit/6f863ba28b8a5914fa530ddb723fd27cfeb51ffa): Docs: Add new storage setup doc, and link it from existing docs.
- [`46fc0be`](https://github.com/pixlcore/xyops/commit/46fc0be7afc1fdb1850570636857dd608c044e11): UI Strings: Tweak limit and action table captions to be more clear about category and universal inheritance.
- [`7f962c8`](https://github.com/pixlcore/xyops/commit/7f962c8e5e111d61e51d3288fb4b48dd2e33fa99): UI Tweak: Fix "Copy to Clipboard" button in code viewer dialog.
- [`dd937e6`](https://github.com/pixlcore/xyops/commit/dd937e6b036526440be92bbc0f96127402db44d3): Bug Fix: Upon job recovery after restart, unset job.remote flag in case job is dead (so it can abort after going stale).  Fixes #240.
- [`58be32f`](https://github.com/pixlcore/xyops/commit/58be32f53d7ae29c08a354fe4610654155a293b0): Meta: Add local bin/release.sh script for automating releases.

## Version v1.0.44

> April 3, 2026

- [`bc2a0ea`](https://github.com/pixlcore/xyops/commit/bc2a0eae9a3e1de79b479d664703167d8cb7969a): Version 1.0.44
- [`ea357ff`](https://github.com/pixlcore/xyops/commit/ea357ff9b81b27d63f2866fd014d4353416fba99): Meta: Add release.yml to automatically generate release notes and a GH release via GH actions.
- [`e379951`](https://github.com/pixlcore/xyops/commit/e379951d4ffffe2864b200896f12d07cd0497164): Servers Doc: Fix tabs that snuck into docker-compose sample.
- [`e07bea5`](https://github.com/pixlcore/xyops/commit/e07bea581dcf5ccb9d5c78835f6ca5d4ae043ae6): UI Tweak: Job Details: When user content contains markdown, increase its body font size slightly.
- [`a97589d`](https://github.com/pixlcore/xyops/commit/a97589d37837fdfaeb3d33a8b02d6801be19889d): Bug Fix: Ensure web hook headers are an array at the API level, and add extra safeguards.  Fixes #238.
- [`74d5778`](https://github.com/pixlcore/xyops/commit/74d57782f0aa5152b268562e8fe61b47725ee695): Servers Doc: Updated automated docker workers section with new xysat configuration setup.
- [`3124d5c`](https://github.com/pixlcore/xyops/commit/3124d5c45fbd45af999d9e6bbea23e33e871c143): Security Overview Doc: Made a few minor corrections and wording adjustments.
- [`f4ba4f7`](https://github.com/pixlcore/xyops/commit/f4ba4f701ffec0251d7d7ab97f431ee1e73c7345): Multi/Satelite Release List APIs: Add optional `verbose` parameter, to include full response from GitHub.
- [`018e43b`](https://github.com/pixlcore/xyops/commit/018e43bff44e6ccc73f7d0494bd5d6806720cd8d): Add SECURITY_OVERVIEW.md document, to complement THREAT_MODEL.md.
- [`e8cf67b`](https://github.com/pixlcore/xyops/commit/e8cf67b5b8cf51f098bb65dfcc552e4ccd9d378b): Bulk Deletes: When internal deletion jobs complete, refresh applicable search results pages in case users are waiting.  Fixes #236
- [`4c0bf02`](https://github.com/pixlcore/xyops/commit/4c0bf024f2bb63fceeeaface8db477eb85e1ee82): Admin Upgrade Conductors API: Default single server pre-delay time to 5 seconds to allow for job to complete before starting upgrade.
- [`0ff5230`](https://github.com/pixlcore/xyops/commit/0ff5230cbb9504eba0ad00a1ae82c64379917697): Workflows: Support event/job target expression in the multiplex controller, and do not abort the workflow if no servers match.  Fixes #233
- [`68972b9`](https://github.com/pixlcore/xyops/commit/68972b9e0fc6edb28a1bd9e10b5bf9617a8e49f7): Docs: Remove NFS as a recommended storage configuration.
- [`888d1bf`](https://github.com/pixlcore/xyops/commit/888d1bf1b69bd509a8eb0bbaf1fc56744b1524ff): System Diag Report: Small tweaks, trim load avg for display, add message for zero servers.

## Version v1.0.43

> March 31, 2026

- [`fba0174`](https://github.com/pixlcore/xyops/commit/fba0174d5f7161edb9f1ba2e828d823fa21da1b3): Version 1.0.43
	- Bump pixl-server to v1.0.50 for more detailed crash logs.
	- Override lodash (sub-dependency of async) to v4.17.23 for vuln fix.
- [`eb2a6f9`](https://github.com/pixlcore/xyops/commit/eb2a6f9efc06ad7185c31d9a98eb38e4533689a1): API Doc: Add docs for internal admin_upgrade_masters and admin_upgrade_workers APIs.
- [`411c36f`](https://github.com/pixlcore/xyops/commit/411c36fbcc969bc4d46adb5a0aa4d942316e0e02): API Doc: Add new multi section, with internal master_register, get_master_releases, and master_command APIs documented.
- [`b11ee0c`](https://github.com/pixlcore/xyops/commit/b11ee0cef98fb029c07779c391f2d6ae5a1a7ba0): API Doc: Clarify some admin API privs and rename satellite section.
- [`54f1568`](https://github.com/pixlcore/xyops/commit/54f1568d855798c3f9f31752af084b5bebd4ae28): Hosting Doc: Added clarification on Docker configuration mount, as it needs to be unique per conductor.
- [`04ec3b4`](https://github.com/pixlcore/xyops/commit/04ec3b4778759e36c6f385a9a5fe85c8e80de1fd): New Feature: Magic Link Form: Allow button text, icon, and custom faux response parameters.
- [`a9828d2`](https://github.com/pixlcore/xyops/commit/a9828d25fc729a269c77129cd4c112148f16a93b): Docker Satellite Servers: Add default named volume mount for custom config dir (so containers survive upgrades).
- [`686fe20`](https://github.com/pixlcore/xyops/commit/686fe20d4bb65e42f84e942f982caa347de78282): New Feature: Visually show conductors and satellite servers that have outdated versions.  Click to popup upgrade dialog.
- [`fee2822`](https://github.com/pixlcore/xyops/commit/fee2822284b4e35fc409379b7c6a6f584a3eac61): CSS: Adjust scrollbar thumb color to better follow theme.
- [`8f2b0a3`](https://github.com/pixlcore/xyops/commit/8f2b0a36847c632de7809ed5125caf966a1e572b): Bug Fix: Ensure workflow decision and split nodes always have access to outer workflow object for use in expressions.  Fixes #232.
- [`45a3c1b`](https://github.com/pixlcore/xyops/commit/45a3c1be4073a4b7f76e24128f75f5608d501dc5): Satellite/Multi Release List APIs: Reduce requirement to any valid user or API key
- [`ad9bc80`](https://github.com/pixlcore/xyops/commit/ad9bc803bb5e52b5dfc08c4d744ca9375b045bf9): Feature: Send xyops / xysat version information along with each job launch, in `job.versions` property.
- [`4f5e4d9`](https://github.com/pixlcore/xyops/commit/4f5e4d9ebd9e561646833eaf2836ac2f3f646271): Behavior Change: For get_ APIs with v1 suffix, return HTTP 404 upon failure.  Fixes #231.
- [`039bfb0`](https://github.com/pixlcore/xyops/commit/039bfb036cecaf11d6e71bfebd95eade39506c66): README: Remove quick-start docker run command, and instead direct people to the self-hosting guide.
- [`699c9dd`](https://github.com/pixlcore/xyops/commit/699c9ddda605c88aa17ca6eac0d2348ab27a3feb): New Feature: Add "Diagnostic Report" button on System page, for generating report content for GitHub issues.
- [`113abb7`](https://github.com/pixlcore/xyops/commit/113abb76098c1bfaa8b0fd3aacbb2df9c2133817): README and Hosting Docs: Clarify Docker setup instructions, use `XYOPS_masters` environment variable even for single-conductor setups.
- [`c44a3d0`](https://github.com/pixlcore/xyops/commit/c44a3d0ca34bb58c42f10136b5fb450b70058ec9): Bug Fix: Auto-detect case where multiple hostnames resolve to same servers in masters.json, and shut down with loud error.

## Version v1.0.42

> March 29, 2026

- [`ffb1e45`](https://github.com/pixlcore/xyops/commit/ffb1e457c99f4fdc96d989d115adb39125e2cfe6): Version 1.0.42
	- Remove `jimp` dependency, replace with in-house developed `pixl-resize` module.
- [`df05634`](https://github.com/pixlcore/xyops/commit/df05634e8e9367504596b16e24ebb64afbeff8c3): Config Editor: Perform basic validation pass on save.  Fixes #224.
- [`d6dc208`](https://github.com/pixlcore/xyops/commit/d6dc208005e48a5c1897f24004cc1db096699aa1): Config Doc: Add note about leaving storage transactions enabled.
- [`db9ba58`](https://github.com/pixlcore/xyops/commit/db9ba584dbbbd855fa529b7a63f678675f84e1bd): Bug Fix: Magic Link: After creation, if user goes back into edit trigger dialog without saving first, magic link key is regenerated.
- [`fe22a26`](https://github.com/pixlcore/xyops/commit/fe22a26ee22188456d3a46e37bab03c48a331374): Config Doc: Document the satellite docker image path.
- [`db4d97b`](https://github.com/pixlcore/xyops/commit/db4d97b5dcd463f267c87675ecd84bbe4f68e4f7): Bug Fix: Crasher in monitoring subsystem when storage transactions are disabled.  Fixes #220.
- [`460ed0b`](https://github.com/pixlcore/xyops/commit/460ed0b3e73a439450f371d869f2fd2863394f3a): Cleanup: Remove unused avatar code in admin path.

## Version v1.0.41

> March 27, 2026

- [`ab845e5`](https://github.com/pixlcore/xyops/commit/ab845e5ee0978cbad7a0eb7a8e89a71a121830a4): Version 1.0.41
	- Bump pixl-tools for upstream vuln fix in picomatch.
	- Bump pixl-mail for upstream vuln fix in nodemailer.
- [`9613fd1`](https://github.com/pixlcore/xyops/commit/9613fd1a6b468d0187e387830e6898051f99e2ec): Marketplace UI: Lazy-load thubmnails from GitHub as to not exceed limits.
- [`c01e541`](https://github.com/pixlcore/xyops/commit/c01e5416d0cd8adcaae760e48d749916fd6a5f98): Feature: Global "client.hide_sidebar_sections" will force-hide specific sidebar sections for all users, regardless of their prefs.
- [`269458f`](https://github.com/pixlcore/xyops/commit/269458f6952c46605b2a307a819f0b9dc400e931): Feature: Marketplace: Allow quick setup / editing of secret vaults for installed plugins.
- [`b4e3169`](https://github.com/pixlcore/xyops/commit/b4e3169f62e405394309bc9ddd3e0bf026446667): CSS UI Tweak: Adjust max select menu height slightly, as certain positions can cause it to extend beyond the screen bounds.
- [`0bff664`](https://github.com/pixlcore/xyops/commit/0bff664658430da083a24951d74db4406f7c9713): UI Tweak: Sort secret vaults by title.
- [`ca7b032`](https://github.com/pixlcore/xyops/commit/ca7b03272ac6b91652c56877a905ce1d3360d142): CSS UI Tweak: Fix background color in plugin/event param select menus on light theme.
- [`67d4e94`](https://github.com/pixlcore/xyops/commit/67d4e94a9d3200def3eb422811233e117e3edbb7): README: Add bind mount for xyops config in docker example command.
- [`69fa782`](https://github.com/pixlcore/xyops/commit/69fa78235b10fdec136b7f8610bd3cd1ed9d64c8): Hosting Doc: Add missing bind mount for config dir in quick-start docker run command.

## Version v1.0.40

> March 24, 2026

- [`587350b`](https://github.com/pixlcore/xyops/commit/587350bb71ce9b52f56a6586b200a98d277b73d1): Version 1.0.40
- [`af38bad`](https://github.com/pixlcore/xyops/commit/af38badcc08a2cac7ca644cf4f113c25da6ecb67): SSO Doc: Fixed example command and added note about the xyOps AWS ALB SSO Plugin.
- [`be4b79f`](https://github.com/pixlcore/xyops/commit/be4b79fc66562a2baf3346a94007ccbb9331b735): Feature: Custom SSO Plugin command, to validate and transform request for prep for SSO login.
- [`9b9bb47`](https://github.com/pixlcore/xyops/commit/9b9bb47702b87abd60bff6b0e4e6433e731205c3): Sample Config: Update stock tls.crt and tls.key files (self-signed).
- [`e998189`](https://github.com/pixlcore/xyops/commit/e9981893fdaeba09974edecc9b4ad4736f0bfdb9): API Doc: Add docs on internal satellite install/upgrade/config endpoints.
- [`34290b7`](https://github.com/pixlcore/xyops/commit/34290b7796420b90d258abcec61a5db043955d56): Hosting Doc: Add section on customizing satellite config managed keys.
- [`295aa28`](https://github.com/pixlcore/xyops/commit/295aa28428c5738958f2a114fdeff6bf3dd6f9af): Servers Doc: Add details on docker workers, specifically around bind mounting the xysat config file.
- [`e96dcdb`](https://github.com/pixlcore/xyops/commit/e96dcdb106aa8ef35af4968bf66ca33ad1a938de): Workflow Behavior Change: Sub-job queuing now considers each workflow job to be its own queue "namespace".  Fixes #218.
- [`9e94e45`](https://github.com/pixlcore/xyops/commit/9e94e456a1b5fbff133642a3673166424d59be6c): Bug Fix: Crasher in workflow if job is aborted very early, before it goes into an active state.
- [`d23fe1e`](https://github.com/pixlcore/xyops/commit/d23fe1e25dd51b40fefb7c06b5a4ab5711949818): Security Hardening: Remove word boundary matching for scrubbing secrets from web hook diagnostic output.

## Version v1.0.39

> March 23, 2026

- [`6a58a69`](https://github.com/pixlcore/xyops/commit/6a58a69ffe4fa6fbda2b6a26ad98dc885acdd508): Version 1.0.39
- [`f5cd953`](https://github.com/pixlcore/xyops/commit/f5cd9536f2926fe625009a33b0830f2b5202c7e9): Server Notifications: Improve notification text for server add/remove activity.
- [`96c4284`](https://github.com/pixlcore/xyops/commit/96c428493754f890efc0ed68e35c99cd34ad0408): Docs: Add ToS and Privacy Policy.
- [`0b085a0`](https://github.com/pixlcore/xyops/commit/0b085a08f337665f278e1ce669daa483a5fd7e3c): Security Hardening: Redact secrets from web hook detail output log (best effort).
- [`45190da`](https://github.com/pixlcore/xyops/commit/45190dabe44cf75ec181cb8cb0596634db379be2): Bug Fix: UI crash in getWFParamPreviewHTML for omitted optional number param values.  Ref #175.
- [`25d22eb`](https://github.com/pixlcore/xyops/commit/25d22eb7d53bc678421bd9802287cf8dc5ed4b16): Add THREAT_MODEL.md file for security audits.
- [`b7756cc`](https://github.com/pixlcore/xyops/commit/b7756ccf64b00e66b846690bb2d89d3cb1030146): Typo fix in docs and sample config: outbound_blacklist and outbound_whitelist should be blacklist and whitelist, in the airgap config.
- [`b68995d`](https://github.com/pixlcore/xyops/commit/b68995d821e8633fc6e2ff2c91e2ac1745ee664c): Security Hardening: Secrets API: Ensure secret key names don't match any bad strings (i.e. __proto__ and the like).
- [`0be3cc7`](https://github.com/pixlcore/xyops/commit/0be3cc7094f4878224157b3a96a7295be2142985): Security Hardening: API handler: Disallow any params matching bad key names (i.e. __proto__ and the like).
- [`4a7ec2f`](https://github.com/pixlcore/xyops/commit/4a7ec2f54f76929c4707f6efe1dac5f0a2ddf115): Security Hardening: Remove macro substitution support from system hook shell exec command (was undocumented anyway).
- [`f6db695`](https://github.com/pixlcore/xyops/commit/f6db695942c690cce9990416994074c0a1911c50): Security Hardening: Lock down more built-in plugin fields to administrator-only (HTTP URL, Docker Run Command, etc.).
- [`bf41044`](https://github.com/pixlcore/xyops/commit/bf41044ac8f5fb350a19b5fabae0e7579bbfac75): Security Hardening: Check secret variable key names for illegal strings (i.e. __proto__ and the like).
- [`eb23ba4`](https://github.com/pixlcore/xyops/commit/eb23ba4c5e64f9cf7d332c0297bf331e544b829f): Security Hardening: Increase default secret key length to 32 chars in container-start.sh
- [`08f6ed0`](https://github.com/pixlcore/xyops/commit/08f6ed0345a2197f626761fede30d381221d9bb6): api_get_latest_monitor_data: Allow both GET and POST parameters.  Fixes #214.

## Version v1.0.38

> March 19, 2026

- [`5347452`](https://github.com/pixlcore/xyops/commit/5347452a4376a98a794209fd38e3a5d1cbb15d0e): Version 1.0.38
- [`f926446`](https://github.com/pixlcore/xyops/commit/f926446d56e5c54a6268428fa2eac8f97b35ce8d): Server Monitor Alerts: Use correct server label and stripped hostname in notification text.

## Version v1.0.37

> March 19, 2026

- [`fe32764`](https://github.com/pixlcore/xyops/commit/fe32764b5462393a0f7d40b5d341ed6486fddf3a): Version 1.0.37
- [`85bd8d6`](https://github.com/pixlcore/xyops/commit/85bd8d67b7ad71399572407b520f512d72e326c6): Feature: Customize sidebar section visibility in the user settings screen.
- [`6a62b36`](https://github.com/pixlcore/xyops/commit/6a62b36a595d79d5d5853586e3fbbf03ec0c973c): Server Data Explorer: Add hover tooltips for all Plugin IDs, for easier identification.  Fixes #211.
- [`036a5ca`](https://github.com/pixlcore/xyops/commit/036a5ca44843af72bfb23a86cc4eb5cbe7fd40cf): Welcome Doc: Fix wording to properly describe when the guide auto-disappears.  Fixes #212.
- [`35d319e`](https://github.com/pixlcore/xyops/commit/35d319e22dd0dc1921792f907fc3fbefb5f5c5f1): CLI Doc: Remove unused section.

## Version v1.0.36

> March 18, 2026

- [`7fc894c`](https://github.com/pixlcore/xyops/commit/7fc894c94df181fb5753569c99bb8807e068548d): Version 1.0.36
- [`b7f9f9e`](https://github.com/pixlcore/xyops/commit/b7f9f9e91457ac6a7dba86068e4e44c4bd9492bf): Feature: Recover admin access from Docker / containerized systems using a special environment variable.
- [`233a1f5`](https://github.com/pixlcore/xyops/commit/233a1f53c3e392799f7661ced6bf242e16a4174d): UI Tweak: Set all password input field fonts to monospace.

## Version v1.0.35

> March 18, 2026

- [`9c14b5c`](https://github.com/pixlcore/xyops/commit/9c14b5cb4fddbbc9a81c45df3d1f7ecea7fb9b45): Version 1.0.35
- [`d2e009c`](https://github.com/pixlcore/xyops/commit/d2e009c42baece575df17fba4976034f292b023f): UI Improvement: Add visual group separators for sorted event table, for specific columns (e.g. category, tags, plugin, targets).
- [`21813d0`](https://github.com/pixlcore/xyops/commit/21813d00dbaef433b6e75715ca34989e1c2443ed): UI Tweak: Improve icons for linked events and workflows, to show arrow pointing right (more clear).
- [`52077cc`](https://github.com/pixlcore/xyops/commit/52077ccc6f8bbe1106e5dac899afa246d24669b2): Bug Fix: Export dialog was broken for workflows.  Fixes #208.

## Version v1.0.34

> March 18, 2026

- [`fae52ac`](https://github.com/pixlcore/xyops/commit/fae52acede0b48d8a9527ec75f88eaca77cc48fc): Version 1.0.34
- [`81227d6`](https://github.com/pixlcore/xyops/commit/81227d63e8c7035ea0f32f058dbb2086147a79ce): UI Tweak: When an event has a "Run Event" action attached and enabled, change the default icon.
- [`8bdb8f6`](https://github.com/pixlcore/xyops/commit/8bdb8f6ebd865d6ef2f3610010f21c07c3fdaa0a): UI Tweak: Apply hostname strip regex to conductor ID display, to be consistent with server hostnames.
- [`ac17c97`](https://github.com/pixlcore/xyops/commit/ac17c97bed4750d955857b47a4266c7b129d3b2e): UI Tweak: Show different default icons for events / workflows if they are disabled.

## Version v1.0.33

> March 17, 2026

- [`87b4d5e`](https://github.com/pixlcore/xyops/commit/87b4d5e18b53e0aae4b2b10c31a6ee8e348caf74): Version 1.0.33
- [`132f030`](https://github.com/pixlcore/xyops/commit/132f0306272fea0fdab76cf888b803a637b719d7): Server UI: Several visual changes to better denote server groups, and if they were manually or auto-assigned.
- [`160d354`](https://github.com/pixlcore/xyops/commit/160d354446d65b97d362d59389c102e5a88e8e45): Server Groups: Correctly handle the case when a group is deleted with servers that had manually assigned the group.
- [`dded76f`](https://github.com/pixlcore/xyops/commit/dded76f72c71e9280d12a3a28267fb56b6df4b1b): Unbase Config: Add missing autoGroup column index
- [`887e100`](https://github.com/pixlcore/xyops/commit/887e100b1bf208374257b8d0b0c208256e2ebb3d): UI Fix: Show correct "All"/"None" word when group list is empty (alerts / monitors match "All" if none assigned, servers do not).

## Version v1.0.32

> March 17, 2026

- [`75e11a2`](https://github.com/pixlcore/xyops/commit/75e11a26993628aec5c079aa69322e4f4bdd523a): Version 1.0.32
- [`416931f`](https://github.com/pixlcore/xyops/commit/416931fae0acb3ef2c2ef8fd4dd30386a70bdfc9): Bug Fix: Crasher if a server group is deleted with active servers that match only said group.

## Version v1.0.31

> March 17, 2026

- [`c95eeb8`](https://github.com/pixlcore/xyops/commit/c95eeb8803f4af7120b179498714a4a8a23aaa3f): Version 1.0.31
- [`3facd5c`](https://github.com/pixlcore/xyops/commit/3facd5cd920b1e4a0d0586f4ecdb08c7cbf9dafb): Docker Container Startup: Fix typo which failed to auto-generate the secret key on first launch.  Fixes #202.

## Version v1.0.30

> March 16, 2026

- [`b06d0c1`](https://github.com/pixlcore/xyops/commit/b06d0c1780070dde166f808bf5eb1c4ed3d6d7d8): Version 1.0.30
- [`506265f`](https://github.com/pixlcore/xyops/commit/506265f42fc134e7f1022314843d4b6c0d85510c): Fix possible XSS attack on job detail screen when job description contains raw HTML.

## Version v1.0.29

> March 16, 2026

- [`2539680`](https://github.com/pixlcore/xyops/commit/25396801cbd9b2627d7ee7054a975dde4d61feaa): Version 1.0.29
- [`8e536f2`](https://github.com/pixlcore/xyops/commit/8e536f289719687b98ce2f7ca93a773de2ccf3f7): CSS: Improve contrast of checkboxes when table row is disabled.
- [`361c99c`](https://github.com/pixlcore/xyops/commit/361c99c53ce053a146c64897a3967397a7fd5913): Docs: Fix header title disappearing on mobile devices.
- [`e07e888`](https://github.com/pixlcore/xyops/commit/e07e888186054aa13f24ef5abcfe96534a2cd827): CSS: Fix documentation margins on smaller phones
- [`441eb42`](https://github.com/pixlcore/xyops/commit/441eb42e5e98ccbde588b87009ea286f4d668c7e): Marketplace UI: Improve icon, allow markdown in product listing descriptions, fix mobile responsive issue with header.
- [`3604b5f`](https://github.com/pixlcore/xyops/commit/3604b5f013d72e8c00a3e25c329350385ffa1364): Marketplace API: Fix issue with searching on tags that contain spaces or other symbols.
- [`c5fdbad`](https://github.com/pixlcore/xyops/commit/c5fdbadf1c4bf9a14421b7a41eb85167dff1a566): Update README with details on paid support tiers.
- [`f65aad1`](https://github.com/pixlcore/xyops/commit/f65aad1189f4f671eaef43db0b449ac8e6e5395e): Delete old unused sample-data.json file.

## Version v1.0.28

> March 15, 2026

- [`28e7b0d`](https://github.com/pixlcore/xyops/commit/28e7b0ddc212dfbaea29d9aaa928edcd6d95e659): Version 1.0.28
- [`5af7e75`](https://github.com/pixlcore/xyops/commit/5af7e750ff60558430b6058bbc317387e0ac721a): CORS: Add OPTIONS preflight request handler.
- [`57a7705`](https://github.com/pixlcore/xyops/commit/57a77058446734d225180e5acc82bf61032aa0c3): Alerts Doc: Add section on Universal Alert Actions.  Ref #195.
- [`0210072`](https://github.com/pixlcore/xyops/commit/021007211896e44deb5ec4350b41d05959f3d3d3): API Doc: Remove incorrect behavior for echo API.

## Version v1.0.27

> March 15, 2026

- [`a918c6f`](https://github.com/pixlcore/xyops/commit/a918c6f18a414c13f186354c576ed8695332c062): Version 1.0.27
- [`3ae2cb7`](https://github.com/pixlcore/xyops/commit/3ae2cb7cc83bb3edeb0cbff37706bd85dc17e617): Marketplace: Add "Report" button.
- [`903617b`](https://github.com/pixlcore/xyops/commit/903617bff8daa043fabb670fc626f358566cc729): Marketplace Markdown UI: Try to fix relative links to files inside Plugin repos.
- [`6eb2267`](https://github.com/pixlcore/xyops/commit/6eb22670b99eefa02a8f440b27a822d700e976ef): Markdown UI Tweak: Do not decorate links with icons if they contain inline HTML (i.e. for Marketplace shield icons).
- [`4de736c`](https://github.com/pixlcore/xyops/commit/4de736cb1cc5f993c63c0af8c3ac3979b15c2beb): UI Tweak: Channel Notifications: Do not auto-hide toasts (these are generally for high severity issues).
- [`e06e75a`](https://github.com/pixlcore/xyops/commit/e06e75af69079c72176815fe9451ab291d9c7f6e): Alerts: Fix bug where alert message text was missing from web hook args in some cases (race condition).
- [`ca2fe09`](https://github.com/pixlcore/xyops/commit/ca2fe095c9ce6c69ecf090c93b88c231da9d7d8e): Bug Fix: Channel notification sent from alerts (configured to send to specific users) crashes the conductor.  Fixes #197.
- [`b10b988`](https://github.com/pixlcore/xyops/commit/b10b988b60062f741158bfff127dd27e17960bed): Config Doc: Add User.use_csrf property.

## Version v1.0.26

> March 14, 2026

- [`445949c`](https://github.com/pixlcore/xyops/commit/445949c58e030a71bfa1d59a87bb1ad498ebab81): Version 1.0.26
	- Migrate to new bcryptjs module (v3.0.3).  Remove old bcrypt-node.
	- Bump jQuery to v3.7.1 for vuln fixes.
	- Bump pixl-chart to v1.0.27 for fix with toolbar buttons disappearing on click.
	- Bump pixl-server-api to v1.0.8 for more verbose debug logging.
	- (MAJOR) Bump pixl-server-user to v2.0.1 for new CSRF Token system.
	- Bump pixl-xyapp to v2.1.24 for CSRF token support in API calls.
- [`44fb32d`](https://github.com/pixlcore/xyops/commit/44fb32d79d62de75eed0591340a158416e867007): Security Hardening: Move to new CSRF Token system.
- [`555aeb8`](https://github.com/pixlcore/xyops/commit/555aeb895f58dcd92d7406469146054853493a86): Colophon Doc: Add bcryptjs and clean-css packages, remove old bcrypt-node.
- [`01b179b`](https://github.com/pixlcore/xyops/commit/01b179b1f698b8beeb7986b39cdbe2e442972ed2): Storage CLI: Migrate to bcryptjs.
- [`b789408`](https://github.com/pixlcore/xyops/commit/b789408102d15094764e05ca3e65cce001ea091d): GitHub Meta: Add stale issue auto-bot.
- [`1d650a7`](https://github.com/pixlcore/xyops/commit/1d650a7a0df75013d3443f0ad3a6273e08e8e1a2): Default Config: Add `exit_on_shutdown` prop to insure process always exits (a stuck socket can hang it).
- [`0e49793`](https://github.com/pixlcore/xyops/commit/0e49793078eb554f369d344ca9ae559ba89345e9): Doc Update: Remove references to old sqlite3 library, add new better-sqlite3 one.
- [`f30e307`](https://github.com/pixlcore/xyops/commit/f30e307a5b018cb233b3a74b6a5edfcc2e0acdfd): Triggers Doc: Add clarification on keyboard trigger and internal key codes.
- [`79df6c0`](https://github.com/pixlcore/xyops/commit/79df6c041679d81e4671b3eb62bee487a15a5cb3): README: Add additional step of generating a test key for local dev installs.
- [`fdc0dce`](https://github.com/pixlcore/xyops/commit/fdc0dce51aead514db3233dbd610b5e3c7dfe830): WebSocket Maintenance: Auto-close sockets that do not authenticate within 30 seconds.
- [`2f272df`](https://github.com/pixlcore/xyops/commit/2f272dff54d9df92f36b9eb9e8dfb914b6bd8578): Satellite Reconnect Race Condition: Auto-close stale sockets when a server reconnects and auths.  Fixes #194.
- [`ef7afe2`](https://github.com/pixlcore/xyops/commit/ef7afe24931eac5fd8c6cf5b24bf2eb01148e231): Alert Action Plugins: Pass in assigned secrets to JSON STDIN (as well as environment vars) to match behavior of Job Action Plugins.

## Version v1.0.25

> March 13, 2026

- [`0df0490`](https://github.com/pixlcore/xyops/commit/0df04905b61da331e6beb55140360330d924320a): Version 1.0.25
- [`4629790`](https://github.com/pixlcore/xyops/commit/462979044cdbc794e90dd77b31f010a4fbc1c295): Security Hardening: Strongly encourage default stock admin user to change password on first login.
- [`d9184b4`](https://github.com/pixlcore/xyops/commit/d9184b44b4780ffbcbbb6d202637d19d2fb34228): Storage Utility CLI: Improve admin account recovery code (use config overrides, and apply default user prefs).
- [`8930b8a`](https://github.com/pixlcore/xyops/commit/8930b8aa003471baba6680596f871f3ed3ef82f4): Security Hardening: Validate storage commands in admin_import_data API.
- [`802d16b`](https://github.com/pixlcore/xyops/commit/802d16b008bb614aedd4418da8f71eb8aa13ba63): Security Hardening: Keep config files locked down with mode 0o600 when not running in debug mode.
- [`8275f83`](https://github.com/pixlcore/xyops/commit/8275f838c5a942e63de8569e81c7ef11f79bea47): Security Hardening: Generate random secret key on first install.
- [`05d8ba5`](https://github.com/pixlcore/xyops/commit/05d8ba5eb034e62e68d5ffc5c3026d2a0ddbc48b): Startup: Perform basic validation of required config props, exit loudly if missing.

## Version v1.0.24

> March 13, 2026

- [`dba0f3b`](https://github.com/pixlcore/xyops/commit/dba0f3b70fdce35f2a7926e63b5e9f01100e3cb6): Version 1.0.24
	- Dependency bumps: diff to v5.2.2 and pixl-request to v2.6.2, for sub-dependency vuln patches.
- [`c2298c9`](https://github.com/pixlcore/xyops/commit/c2298c9432e5fef637befef930aa7fb32b7abf15): Bug Fix: Prevent UI crash if event is created via API and limits / actions / triggers params are omitted.  Fixes #192.
- [`68233ce`](https://github.com/pixlcore/xyops/commit/68233cecdab39c183091957dd12a3fcb816a0d08): Bug Fix: Race condition with logActivity and shutdown.

## Version v1.0.23

> March 10, 2026

- [`9b4fd9a`](https://github.com/pixlcore/xyops/commit/9b4fd9a4378dada1073948bc764053c9a4486913): Version 1.0.23
- [`6a73922`](https://github.com/pixlcore/xyops/commit/6a73922cecc90e0e897fb7d649a4bae238551e75): Satellite API: Allow API keys containing dashes to be substituted for the token (t) parameter.
- [`75163e2`](https://github.com/pixlcore/xyops/commit/75163e25da3fe84ff30264e9917ece015295536c): Add FUNDING.yml file for GH sponsor button.

## Version v1.0.22

> March 10, 2026

- [`6b1f9da`](https://github.com/pixlcore/xyops/commit/6b1f9da3655932b6ac36792ef9db9a4f22282b7f): Version 1.0.22
- [`246daa4`](https://github.com/pixlcore/xyops/commit/246daa4cbee9230d67de5c3dbc11b5de8dfab639): Feature: Display version number in brackets alongside 'Latest Stable'.  Fixes #188.
- [`fd1a013`](https://github.com/pixlcore/xyops/commit/fd1a01305c628875fa951033940aac633d19c848): Bug Fix: Regression from v1.0.14: Default parameter values are not correctly being applied in run_event and magic APIs.  Fixes #189.
- [`87d6b0b`](https://github.com/pixlcore/xyops/commit/87d6b0bdf01e525d393cf535e2022048543f1945): UI: Job Event Display: Use shorter "v" prefix for revision, instead of "rev.".

## Version v1.0.21

> March 9, 2026

- [`41ef84a`](https://github.com/pixlcore/xyops/commit/41ef84a7b9cd358c423da827c7e9fc038d0ca43a): Version 1.0.21
- [`9df1183`](https://github.com/pixlcore/xyops/commit/9df1183a0dcfe89833032b62e3db045584e412f2): Feature: New schedule modifier trigger: "Every Nth": Skip over every Nth job run (for things like bi-weekly events).
- [`e266594`](https://github.com/pixlcore/xyops/commit/e266594e0ba4d3ae2aa8eb6ebd52723fec271427): Upcoming Job Prediction: Correctly simulate day limits.
- [`079b9c7`](https://github.com/pixlcore/xyops/commit/079b9c72b1fd613f1ba12f7b65374cd0c12f2848): Internal: Shorten float for `total_elapsed` inside event state data, to reduce overall JSON size.
- [`20589ae`](https://github.com/pixlcore/xyops/commit/20589aeb1cdaccecb32e6cf71014c86edbe89de1): System UI: Show versions of xyOps / xySat in the upgrade dialogs.
- [`fe176e2`](https://github.com/pixlcore/xyops/commit/fe176e255a7aa453392a74c26ab835c5a5e1cf27): Multi-Server: Automatically detect primary conductor hostname (Host ID) changes, and adjust masters.json file as needed.
- [`0756051`](https://github.com/pixlcore/xyops/commit/0756051bc16991bf446d996ebf570031ae21ab67): Jobs: Allow jobs to be aborted if stuck in "finishing" state.
- [`15be10d`](https://github.com/pixlcore/xyops/commit/15be10d28b2b9f6494c7f72340aa4037605508c0): Tickets: Add author (full name) to emails, and fix tag icons.

## Version v1.0.20

> March 7, 2026

- [`e031a0d`](https://github.com/pixlcore/xyops/commit/e031a0d3bbf12048a8720f9ea263c17b56924a02): Version 1.0.20
- [`e4510e5`](https://github.com/pixlcore/xyops/commit/e4510e5f043f6b82cd6dcf50d8ac7ff26cd00da4): Number Variant Text Fields: Redesign to use special `null` value when optional fields are blank.

## Version v1.0.19

> March 6, 2026

- [`f9a047b`](https://github.com/pixlcore/xyops/commit/f9a047b92e2b2c1deb532b2f52e48d5af781350b): Version 1.0.19
- [`46a5df2`](https://github.com/pixlcore/xyops/commit/46a5df231e19ac275374be38ec72be14f95342d4): Plugins: Disallow Marketplace Plugins from setting their own UID/GID.
- [`7845974`](https://github.com/pixlcore/xyops/commit/7845974aba665708efe9d4039a47d71c837f8be9): Feature: Add `default_plugin_credentials` config option, which will set the UID/GID of plugins if not otherwise set.
- [`461997e`](https://github.com/pixlcore/xyops/commit/461997e0ef9789a270acf79e4a6388e90e173243): Active Jobs Tables UI: Show "Elapsed Time" column for wider screens.  Affects Dashboard, Server and Group Views.
- [`1405efa`](https://github.com/pixlcore/xyops/commit/1405efaf6cc92d6bc9372b97c6310e391ec2d97c): Group Server List UI: Fix responsive table columns (add missing arch and xysat ver).
- [`edc56ed`](https://github.com/pixlcore/xyops/commit/edc56ed200a498b0a400e17a5f6508dde1beed4e): Search UI: Fix collapsing buttons on tablet/mobile.

## Version v1.0.18

> March 5, 2026

- [`c59eeec`](https://github.com/pixlcore/xyops/commit/c59eeecafda0ec1b6f20e5313dd283549dfb0d34): Version 1.0.18
- [`6b38027`](https://github.com/pixlcore/xyops/commit/6b380273e8b427fee88a2b130ffbf00bfc3c42b0): Fix issue with optional number params / fields with default values, getting reset if set to empty.

## Version v1.0.17

> March 4, 2026

- [`6dc5f11`](https://github.com/pixlcore/xyops/commit/6dc5f112e22a82048a960ad1110c43bb7737457f): Version 1.0.17
- [`38b5d16`](https://github.com/pixlcore/xyops/commit/38b5d16c98cb591515b3321c79d91e6543fa3960): Health Check API: Remove ACL requirement (was accidentally added).

## Version v1.0.16

> March 3, 2026

- [`5907309`](https://github.com/pixlcore/xyops/commit/590730985ad05f33c82c62110dc51f11739c2a88): Version 1.0.16
- [`c63e99a`](https://github.com/pixlcore/xyops/commit/c63e99a2ab1bcea2f106b899d4055464711b9877): Feature: Show previous event titles and revision numbers in search results and job detail pages.  Fixes #170.  WIP.
- [`7ee4588`](https://github.com/pixlcore/xyops/commit/7ee45886386d59e6973c308d9f187304e7431e19): Bug Fix: Bulk deleting jobs tried to delete non-existent job logs causing storage log error noise.
- [`92d6eb8`](https://github.com/pixlcore/xyops/commit/92d6eb8b144b9264ba59532ee9ca0f786f663ee9): UI Bug Fix: Deleting event caused a race condition with update event.
- [`d7793fa`](https://github.com/pixlcore/xyops/commit/d7793fa256c03fbcd1833a0a76b50d2f3b64e209): Feature: Add "Export..." button inside revision dialog, so you can export any historical revision in XYPDF format.  Fixes #173.
- [`01ca56d`](https://github.com/pixlcore/xyops/commit/01ca56de1b1d5386452f8c7cdccd065c71cfc75b): Feature: Add last job completed date/time as tooltip hover on event status labels.  Fixes #172.
- [`4aca9db`](https://github.com/pixlcore/xyops/commit/4aca9db6c36407e195f9736a0600930dcda699f5): Marketplace Plugins: Do not allow direct editing, as it complicates upgrades.  Instead, allow marketplace plugins to be "cloned" for local changes.  Fixes #178.
- [`8a8606b`](https://github.com/pixlcore/xyops/commit/8a8606bc51989534209922e0a761ea074767ed75): SSO: Change group role delimiter to simple character (default comma), and allow customization via SSO.group_role_separator.  Fixes #177.

## Version v1.0.15

> March 2, 2026

- [`0c44957`](https://github.com/pixlcore/xyops/commit/0c449578daa03eba668e7bc14c5ff003eab556c8): Version 1.0.15
	- Bump pixl-request to v2.6.1 for new connectTimeout, and retryDelayMax features.
	- Bump pixl-xyapp to v2.1.23 for new getKeyLabel and getShortKetLabel functions.
- [`74a7c42`](https://github.com/pixlcore/xyops/commit/74a7c42d727c5cb10591e7b3079a80ce5089abb3): Add new internal api_finish_job API, used by xySat (replaces finishing jobs over the websocket, which isn't guaranteed).
- [`17307b7`](https://github.com/pixlcore/xyops/commit/17307b70e250016f1f050fb7a16a9e8a5c8876d6): WebSocket API: Broadcast server features to satellites.
- [`ef829be`](https://github.com/pixlcore/xyops/commit/ef829beaba6fa911ca09c02d7040ceb8e7e7d7b1): Keyboard Trigger UI: Use new getShortKeyLabel in pixl-xyapp.  Also fix capitalization in getKeyLabel.
- [`f70776d`](https://github.com/pixlcore/xyops/commit/f70776dd2ec1622eb4ea4923bb7ba90310bf451d): Event UI: Fix highlight color of "Run Now..." which should be green to match the ellipsis (dialog action).

## Version v1.0.14

> February 28, 2026

- [`4830ef2`](https://github.com/pixlcore/xyops/commit/4830ef2a38438bb5ae0d83f21899a6913236cd08): Version 1.0.14
- [`a6ff328`](https://github.com/pixlcore/xyops/commit/a6ff3283ac0a50763f44d755ea7ee0d73183fc3b): Event/Plugin Params: Improve handling of omitted non-required values (especially number fields).
- [`ec0da56`](https://github.com/pixlcore/xyops/commit/ec0da56afdc70cec5549072cb11930406365755b): UI Bug Fix: Allow number variant text fields to contain floats.
- [`93089f2`](https://github.com/pixlcore/xyops/commit/93089f2463ea0d1eaaa4fb5327934c4e054f4497): Bug Fix: (Regression) Rollback button stopped working when we introduced nav blocking while dialogs are open.  Fixes #171.
- [`0cd3e18`](https://github.com/pixlcore/xyops/commit/0cd3e18b56e146d032c767572a19f462572401c9): Network Robustness: Allow final job update to come in "late" (after job was completed), in case server dropped offline then came back later.
- [`b36bf42`](https://github.com/pixlcore/xyops/commit/b36bf4219c5c3834f8c0384c815d7cf42395c75a): Job Tags & Ticket Updates: Properly generate job metadata log rows from APIs (was missing ID and sever props).
- [`b7293b9`](https://github.com/pixlcore/xyops/commit/b7293b9142cfcc9a1fe8498526b51e1bd8d7750e): Keyboard Trigger UI: Tweak job launch notification text to include event title.

## Version v1.0.13

> February 27, 2026

- [`372e435`](https://github.com/pixlcore/xyops/commit/372e43514705538e110127c14a3f71132735860c): Version 1.0.13
- [`90c0dc9`](https://github.com/pixlcore/xyops/commit/90c0dc914435a3d1871b5b9bc5b9f337228559a6): Feature: Marketplace table is now sortable by column, and "Author" is now a drop-down menu filter option.
- [`189adea`](https://github.com/pixlcore/xyops/commit/189adea7b913eb57418ced9852c5d00d26e07bae): UI Tweak: Show "n/a" in trigger tags column for trigger modifiers, as they cannot have tags.
- [`80e11e9`](https://github.com/pixlcore/xyops/commit/80e11e9891826c97649542cb8d16189766b6e1e3): UI: Trigger Type Menu: Split into groups (Scheduling, On-Demand, and Modifiers).

## Version v1.0.12

> February 27, 2026

- [`af6eac1`](https://github.com/pixlcore/xyops/commit/af6eac15d9578c7a4486fe4a0e2a5e4db806eed2): Version 1.0.12
- [`5cf8f64`](https://github.com/pixlcore/xyops/commit/5cf8f64152293c526129ed5b5b5f692af3b26d78): New Feature: Keyboard Shortcut Trigger for launching events.
- [`6345f21`](https://github.com/pixlcore/xyops/commit/6345f2145512bfe9702de2720694ebf3146c302a): CSS Tweak: Adjust max menu height slightly.
- [`3f20cfd`](https://github.com/pixlcore/xyops/commit/3f20cfd21fea9f23ff142008b64635079f70d23b): CSS Tweak: Extend max single/multi select menu height to 40vh.

## Version v1.0.11

> February 27, 2026

- [`fcbdd81`](https://github.com/pixlcore/xyops/commit/fcbdd811848304d2f1b892866159b6ba7db47f36): Version 1.0.11
- [`946cb18`](https://github.com/pixlcore/xyops/commit/946cb185bcc47f212be69333087e5031ed533548): Favorite Events: UI Bug Fix: Run/Edit buttons did not work from dashboard.
- [`7bbc290`](https://github.com/pixlcore/xyops/commit/7bbc290b70803c4141f7022bbafcecdde964b59c): New Feature: User Event Favorites, which are displayed on the dashboard page.
- [`223d159`](https://github.com/pixlcore/xyops/commit/223d159e9f32a7d8c5b4e67264dbf2198b5743c0): Event UI Tweak: Year Selector: Show previous (past) years in menu if event still targets them.
- [`8fe319d`](https://github.com/pixlcore/xyops/commit/8fe319dce2eb40080d9e00dacd63b172331b305a): Default Config: Remove default hourly trigger for new events.  Fixes #169.
- [`eeac891`](https://github.com/pixlcore/xyops/commit/eeac891e11281e25c6b5d627a8cbf0953e28dc36): Scaling Doc: Add note about satellte's `disable_job_network_io` config prop, for large servers with tens of thousands of network connections.
- [`f9ee9f6`](https://github.com/pixlcore/xyops/commit/f9ee9f650c501821a09113d81847e01070535fa5): Alert Behavior: Disabled alerts are now completely disabled in every way, and no longer evaulate.
- [`bcdfa5b`](https://github.com/pixlcore/xyops/commit/bcdfa5bdc30417baebfa80e8940a11d5e788093f): Prep Job Log: Optimization: Skip fs check for workflows, which produce no log.
- [`d5762ce`](https://github.com/pixlcore/xyops/commit/d5762ce7e3e67040001eeddf20b8bf49a68d0f80): Upload File API: Prevent logging of API Key (was debug level 7).

## Version v1.0.10

> February 26, 2026

- [`b00b2da`](https://github.com/pixlcore/xyops/commit/b00b2da7b6a758006be8ccd2818ffb6460129268): Version 1.0.10
- [`9be5b9c`](https://github.com/pixlcore/xyops/commit/9be5b9c70b868e22527d438892c58bf4ed5f2e5f): Actions Doc: Add note about special workflow "continue" condition.  Also "user" (custom) error condition.
- [`ceb139d`](https://github.com/pixlcore/xyops/commit/ceb139d86466d223777e173f80bd8aba9acd5f75): Triggers Doc: Add "quiet" modifier mention in manual run trigger.  Plus a few other misc corrections.
- [`eafaa0c`](https://github.com/pixlcore/xyops/commit/eafaa0c8e017ebd51ca0c848338b0d9e61a70c56): Feature: Add new "Custom Error" action trigger and search filter, for job errors that aren't warning, critical or abort (i.e. user-generated errors).  Fixes #166.
- [`01344c3`](https://github.com/pixlcore/xyops/commit/01344c369bef11766300c342e2b8e332c06c49e4): Shell Plugin: Remove legacy "Interpret JSON" checkbox (unused).
- [`af349d8`](https://github.com/pixlcore/xyops/commit/af349d874f4129e7c985a653a0bc2d9f86d3c7d4): UI Tweak: For job search and action condition, change text "Error" to "Any Error", to make it more clear that errors are ANY non-zero job code value.  Ref #166 and #167.
- [`e0d6779`](https://github.com/pixlcore/xyops/commit/e0d67792125f6e69a184c94ac7de38472e00de3a): Workflow Bug Fix: Correctly bubble up sub-job output files into parent workflow files.
- [`b34fbb2`](https://github.com/pixlcore/xyops/commit/b34fbb276d0c6890b24717a1fa03887c705709e5): Job UI: Fix icon for invisible workflows and sub-jobs inside workflows.
- [`b99f7db`](https://github.com/pixlcore/xyops/commit/b99f7db0e863414c9c6a2778170f8ea9f09fdbab): Workflow Action Fix: Pass along data/files to wired actions, for things like Run Event receiving input files from previous jobs.
- [`6588351`](https://github.com/pixlcore/xyops/commit/6588351641a32b5ab67c85696444a62764695e12): Plugins Doc: Add note about deleting files after upload.
- [`8e788e0`](https://github.com/pixlcore/xyops/commit/8e788e0f6cccbf4f1810a0bc7db55624ad7bc5b7): Actions Doc: Run Event: Add new target_server and clear_alert props.
- [`5e1bafb`](https://github.com/pixlcore/xyops/commit/5e1bafbc90064a3e27df1038e3453f99f6e6f316): User Admin UI: Remove legacy "create random user" feature.
- [`dbc8469`](https://github.com/pixlcore/xyops/commit/dbc846960e38ec4a98645b2752dd8f085bf5b7ee): UI: Tweak wording for target expression labels and captions.
- [`af6338c`](https://github.com/pixlcore/xyops/commit/af6338c671afde67b2643428bf3bb7b2c538a774): New Alert Features: Exclusive alert actions (no inheritance), run event on server that alerted, and clear alert on job completion.
- [`239494d`](https://github.com/pixlcore/xyops/commit/239494db44ac1262b880ed90f4bfc291eb85d26c): Bug Fix: Server group assignments were not correctly being passed to xySat when autoGroup was set.
- [`4b481af`](https://github.com/pixlcore/xyops/commit/4b481af855f83e0734bf325a061c0cfff718d62b): JEXL Utils: Ensure "integer" and "float" helper utilities always return a numner (not NaN).
- [`061ab58`](https://github.com/pixlcore/xyops/commit/061ab583f5ed33b203014a8d29c0dd9b8ba0e4c3): New Feature: Allow user to specify event field values (user params) with the "Run Event" action (job and alert).
- [`246e658`](https://github.com/pixlcore/xyops/commit/246e658d9acdbe6acd0c4bf769310cb5d68b5eb4): UI Bug Fix: Job Details: "Additional Jobs" table was not auto-updating as jobs completed.
- [`11f1f9f`](https://github.com/pixlcore/xyops/commit/11f1f9f7a24574bfcfd5be480fb443a948f75cd5): CSS: Fix hover style on summary grid icons (for copy-to-clipobard).   Underline was showing.
- [`866b8fa`](https://github.com/pixlcore/xyops/commit/866b8fae0ec1d22c2f2de11b3de009d4426e7adc): New Feature: Alert "Exclusive Actions" mode, which only runs actions defined in the alert (i.e. does not inherit from groups or universal).
- [`16ccf08`](https://github.com/pixlcore/xyops/commit/16ccf08c3122b43c46fa1566e195b79e4eeb18c2): New Feature: Quiet Trigger Modifier: Optionally run scheduled jobs invisible from the UI, and/or ephemeral so they auto-self-delete upon completion.
- [`8d14b2f`](https://github.com/pixlcore/xyops/commit/8d14b2fcb60a23cc31be8a870d73e44f508b5922): UI Fix: Job Action Details Dialog: Properly join markdown lists so the formatting does not break.
- [`1a51c08`](https://github.com/pixlcore/xyops/commit/1a51c087acafb5340adb48ea268696679b1c7ad6): DB Optimization API: Fix issue where SQLite WAL file was growing too large.

## Version v1.0.9

> February 24, 2026

- [`db9b0d6`](https://github.com/pixlcore/xyops/commit/db9b0d64ecb1a282d568e07e1dbc9abb7c4738ab): Version 1.0.9
- [`3a47e9a`](https://github.com/pixlcore/xyops/commit/3a47e9a675fed59d0bfba39dc5086190c45bc55e): New Feature: Server User Data, to store arbitrary data per server, available in all running jobs, and can be used to augment event targeting.  Fixes #160.

## Version v1.0.8

> February 23, 2026

- [`5b88a01`](https://github.com/pixlcore/xyops/commit/5b88a01de6d6faff4fec2732df78d0a84c3e2953): Version 1.0.8
	- Bump pixl-server-storage to v4.0.2 for latest AWS SDK, for multiple upstream vuln fixes.
- [`0204291`](https://github.com/pixlcore/xyops/commit/0204291318f7acd4481d0919f1438aaa925fa3bb): Alert System: Fix issue when servers with active alerts disconnect, then reconnect after the alerts time out, which causes the alerts to get stuck in limbo, and never reappear.

## Version v1.0.7

> February 22, 2026

- [`8ba3f91`](https://github.com/pixlcore/xyops/commit/8ba3f9134565e07f235552e9febf6f93797b3221): Version 1.0.7
- [`7287b3e`](https://github.com/pixlcore/xyops/commit/7287b3edec5add2533972f710588aee80894110f): Action / Trigger Plugins: Only parse JSON from last line of output, to ignore noise emitted from plugins.  Be smart about trailing empty lines.

## Version v1.0.6

> February 22, 2026

- [`cb17b95`](https://github.com/pixlcore/xyops/commit/cb17b950ecd3c0979df0c58d36ce60b4ab677c09): Version 1.0.6
- [`d2c80ba`](https://github.com/pixlcore/xyops/commit/d2c80ba9ce731b3b75c70d864afc7f879655a14c): Action and Trigger Plugins: Provide secrets via JSON in top-level `secrets` object, to be consistent with Event Plugins.

## Version v1.0.5

> February 22, 2026

- [`28615bf`](https://github.com/pixlcore/xyops/commit/28615bf272eb6149ea6278850f789a06ad707fec): Version 1.0.5
- [`51edb92`](https://github.com/pixlcore/xyops/commit/51edb9260f8aac3cfda31dbeb337f94941d6e032): Bug Fix: Crasher when trying to use the "Notify Me" button inside running jobs.  Fixes #156.
- [`cfc1130`](https://github.com/pixlcore/xyops/commit/cfc113091091018d0ff7839e7fe674ebfc9b8bf6): Web Hooks Doc: Add section for nfty.sh

## Version v1.0.4

> February 21, 2026

- [`930e09e`](https://github.com/pixlcore/xyops/commit/930e09e6d15c4f256f978a34137e4390ea29e8ec): Version 1.0.4
- [`15a1400`](https://github.com/pixlcore/xyops/commit/15a140011b69ca9c3606380a94df06eff501a544): Bug Fix: Plugin List: Inline "Edit" and "Delete" links were no longer working after table was upgraded to sortable.  Regression from 147.

## Version v1.0.3

> February 20, 2026

- [`e168b7b`](https://github.com/pixlcore/xyops/commit/e168b7b388b3fd21576394cf8d49c466dce79725): Version 1.0.3
- [`d656dbc`](https://github.com/pixlcore/xyops/commit/d656dbcd93e709fdd1e614699a492dc173f676d7): Admin DB Optimization: Fix crasher on new better-sqlite3 engine.  Thanks to @nickdollimount for finding this!

## Version v1.0.2

> February 20, 2026

- [`ae56df7`](https://github.com/pixlcore/xyops/commit/ae56df784e9330d23e52243de4532ce27eba93ef): Version 1.0.2
- [`2447d82`](https://github.com/pixlcore/xyops/commit/2447d82bebc25b37d3668ad07b74b9484efba529): Plugin List UI: Convert to sortable table with clickable column headers and filter text field.  Fixes #147.
- [`8a23fba`](https://github.com/pixlcore/xyops/commit/8a23fba3769e320e4ee8ddee19fdde4f6af351ac): Active Jobs: When maximum concurrent jobs is exceeded, log all blocking jobs to metadata, for troubleshooting.
- [`bc53c62`](https://github.com/pixlcore/xyops/commit/bc53c62dc665f567bdb655ba2d78b2623802bcc8): Bulk Export: Added new `bulk_export` privilege just for using the `admin_export_data` API, so automated backups don't need full admin privs.
- [`39a1776`](https://github.com/pixlcore/xyops/commit/39a1776395ab2c82837c41d6d50b2f6b8d049a73): HTML Sanitization: Allow "style" tag on any element (for user HTML content in jobs).  Fixes #150.
- [`bc63feb`](https://github.com/pixlcore/xyops/commit/bc63feb82651d9a80b50b4d7ced9b27f53c2c545): Hosting Doc: Fix typo in daily backup shell script.  Fixes #148.
- [`b9c0a0e`](https://github.com/pixlcore/xyops/commit/b9c0a0e8e9bf070fd6fec2d7a3ddbe405261c61c): Servers Doc: Added section on automated docker workers.

## Version v1.0.1

> February 17, 2026

- [`bdfeb23`](https://github.com/pixlcore/xyops/commit/bdfeb2375eab452abdc485712b0efb6f06b8c47a): Version 1.0.1
	- Bump pixl-server-web to v3.0.4 for new URI auth feature.
- [`7dd58d7`](https://github.com/pixlcore/xyops/commit/7dd58d75b679932882450e969ab8e0d79b171985): Feature: Sortable tables remember the sort column and sort direction in localStorage prefs.
- [`db3dd37`](https://github.com/pixlcore/xyops/commit/db3dd37fde8a472a4c41094ce2e51ba132830bb7): Event List: Fix table sorting bug with inline links.  Fixes #144.

## Version v1.0.0

> February 15, 2026

- [`24b2ed9`](https://github.com/pixlcore/xyops/commit/24b2ed920d1c07a4083679af9724d23eef071a41): Version 1.0.0
	- Major version bump of pixl-server-storage to v4 for new better-sqlite3 engine. Fixes #7.
- [`95f1241`](https://github.com/pixlcore/xyops/commit/95f1241f1e45e75f12e7403ac8d7d040b3f8da78): Changelog Script: Add debug mode, and include extra commit details on version commits.

## Version v0.9.69

> February 15, 2026

- [`a6efd22`](https://github.com/pixlcore/xyops/commit/a6efd22393ac09614722bee71805523a1a3298af): Version 0.9.69
- [`989f622`](https://github.com/pixlcore/xyops/commit/989f622adee66a1986c30bea10bdadf4c166cbb3): Feature: Make event table sortable by column.  Remove checkboxes for more room.
- [`09625d7`](https://github.com/pixlcore/xyops/commit/09625d77dd60403fb2890eeeb57e1d4b1c802ed2): Workflow Editor UI: Change icon for "remove selection" so it isn't a trash can.
- [`79363ce`](https://github.com/pixlcore/xyops/commit/79363ce1812e2c44b08ccc068a1e9404256ed1dd): Ticket UI: FIx duplicate DOM ID in button
- [`d845ed6`](https://github.com/pixlcore/xyops/commit/d845ed69c9ac57f74a184ef84c7a52fae7d1f68f): Hosting Doc: Add note about MinIO open-source repo getting archived, and added new section on RustFS.
- [`daed1e5`](https://github.com/pixlcore/xyops/commit/daed1e5e7cc26981f536f0ef66f3ee65388fa899): Bug Fix: Secrets UI: Make change without decrypting, save changes, secret key labels disappear (cosmetic only).

## Version v0.9.68

> February 14, 2026

- [`b61f402`](https://github.com/pixlcore/xyops/commit/b61f4022dd26f37d15a8b188beb3810027c2e716): Version 0.9.68
- [`b37b2a2`](https://github.com/pixlcore/xyops/commit/b37b2a2c7380a07fcdc807301ae78e11c93065d3): Data Structures Doc: Add Job "starting" state.
- [`f5ce25c`](https://github.com/pixlcore/xyops/commit/f5ce25c5f576245346ef25ec5654a369732b00e4): Job Concurrency: Fix issue where jobs stuck in "starting" state could cause queue limits to be bypassed.
- [`9696a40`](https://github.com/pixlcore/xyops/commit/9696a406a3c32c0e73e867f23e7ccf9ad0bf0960): API Doc: Add more MIME header examples for importance.

## Version v0.9.67

> February 14, 2026

- [`211dde2`](https://github.com/pixlcore/xyops/commit/211dde2f7ba8929e3b18ce090310c35d4ad01c0a): Version 0.9.67
	- Bump pixl-server-web to v3.0.3 for Formidable hack to add support for Powershell POST requests.  Fixes #141.
	- Relevant commit: https://github.com/jhuckaby/pixl-server-web/commit/134b2ff3db1fb847deb158186228161b12a9b538
- [`1919563`](https://github.com/pixlcore/xyops/commit/1919563fe369cbf66dc1337edb77bee85c59a04d): API Doc: Add clarification about sending raw HTML instead of Markdown.  Fixes #140.
- [`12a2354`](https://github.com/pixlcore/xyops/commit/12a2354139d46de8515244e5fca781b1d3985e8f): Config Doc: Correct default values for ping_freq_sec and ping_timeout_sec

## Version v0.9.66

> February 13, 2026

- [`789baeb`](https://github.com/pixlcore/xyops/commit/789baeb074d825afb4db64630a808c633a6e4fab): Version 0.9.66
- [`8de2be2`](https://github.com/pixlcore/xyops/commit/8de2be2cc4bd6be216e2a0243780818be7efc278): UI: Make it MUCH more obvious which event fields / plugin params are admin-locked, when logged in as a non-admin.  Fixes #137.
- [`ce08885`](https://github.com/pixlcore/xyops/commit/ce0888552c574ffb1b0c0955a77383c35d102f08): Bug Fix: Non-admins updating workflows cause admin-locked text fields to reset to defaults.  Fixes #136 (again).

## Version v0.9.65

> February 13, 2026

- [`e99dbf8`](https://github.com/pixlcore/xyops/commit/e99dbf8943fb9fd1752a8f90b1902625c1b186f0): Version 0.9.65
- [`d8df06d`](https://github.com/pixlcore/xyops/commit/d8df06de268c9eeca2cc4e1104a027efb1d69be2): Bug Fix (Regression): Workflows were getting created without a targets array, which was breaking the UI.
- [`397bb94`](https://github.com/pixlcore/xyops/commit/397bb94994b8ab8695a7bd9cadcd9eb2aebca710): Move sortable table utility functions to base

## Version v0.9.64

> February 12, 2026

- [`030d1db`](https://github.com/pixlcore/xyops/commit/030d1db18cee717955a1f1ab788dc1b1ef96bcb5): API Doc: send_email: Add note re: max_emails_per_day
- [`6fac026`](https://github.com/pixlcore/xyops/commit/6fac02640a80093aa08ad2f89bff394dae772092): CSS: CodeMirror: Lighten comment / quote color on dark theme.
- [`3ab4937`](https://github.com/pixlcore/xyops/commit/3ab49370951667b3509d7a1d525dc97605898cb6): Version 0.9.64
- [`00fa562`](https://github.com/pixlcore/xyops/commit/00fa562b35c7709dbfbbafc009b61cf58235cb3e): Further improvements to UX regarding multi-user concurrent editing and saving for events and workflows.

## Version v0.9.63

> February 12, 2026

- [`c27e2db`](https://github.com/pixlcore/xyops/commit/c27e2db1670b03a29c05b2a983f1a1dd5a37fe75): Version 0.9.63
- [`5543923`](https://github.com/pixlcore/xyops/commit/5543923111d85cfd8e3abeea7fe1372169872a6d): Events / Workflows: Improve multi-user concurrent editing UX: Auto-refresh on edit if no conflicts, otherwise show notification.  Server: check revision number on save to prevent clobbering.  Fixes #136.
- [`017ba36`](https://github.com/pixlcore/xyops/commit/017ba36aba78baf3fa1f5e67105506ff98c2447a): New API: send_mail: Send custom email with optional attachments on xyOps HTML stationary.  Fixes #135.
- [`e7b8426`](https://github.com/pixlcore/xyops/commit/e7b84265c25881a3d19facd9ba5c1ba4b22a15f4): Support optional "link", "inline" and "none" email logo formats.  Change default mode to "inline".  Fixes #133.

## Version v0.9.62

> February 10, 2026

- [`ab7fbd6`](https://github.com/pixlcore/xyops/commit/ab7fbd64c936d20cbe929c02f9064a149f036102): Version 0.9.62
- [`6aa0e25`](https://github.com/pixlcore/xyops/commit/6aa0e25e86a12d708fc5fce8289a232689251e39): Marketplace: Add xyOps version to XYPDF file format, and include on export and validate on import.  Affects direct imports and Marketplace Plugins.  Fixes #128.
- [`205d5a0`](https://github.com/pixlcore/xyops/commit/205d5a0efa56729ab5551dc820ea2d902c14ca00): Hot Keys: Add "Delete" as an alternate key for workflow delete selection, as well as delete job.
- [`b369346`](https://github.com/pixlcore/xyops/commit/b369346472479fbce57f35fcec251223af7e1c84): Workflow UI: Change wording of upper delete button for nodes to say "Remove", to differientiate it from the lower "Delete" button that deletes the entire workflow.  Fixes #131.
- [`cb7cf94`](https://github.com/pixlcore/xyops/commit/cb7cf943031016f4647085577802e45c07ddd575): Improve "select [id]" syntax handling for param menus (better default value fallback).
- [`f75b508`](https://github.com/pixlcore/xyops/commit/f75b508231aee16a3153cc796d6743ee4b4c796d): Bug Fix: Prevent macro expansion infinite loop when job params is expanded directly.  Fixes #132.
- [`fd7d010`](https://github.com/pixlcore/xyops/commit/fd7d0100c3d995297ecb110d40341bf87caa9344): Server List: Add architecture as sortable column.
- [`0e69ca9`](https://github.com/pixlcore/xyops/commit/0e69ca996da28c1329f59e18bc1188600c7c237f): Job Action Details UI: Fix spacing issue between summary and mailer debug log sections.
- [`71ffe2c`](https://github.com/pixlcore/xyops/commit/71ffe2cb9131b050e8721998d15b37eec353350b): Workflow UI: When adding a new job node, honor the new_event_template config settings (category, plugin, targets)

## Version v0.9.61

> February 7, 2026

- [`cb3a762`](https://github.com/pixlcore/xyops/commit/cb3a762f91f0c1d77d4d36812c57a8ccd4ea95aa): Version 0.9.61
- [`308a91b`](https://github.com/pixlcore/xyops/commit/308a91b01205ead68b02663d3126f525a08ce0bc): Job Detail View Improvements: Configurable max output size, and lock job final output viewer to 80% window height with overflow scroll.  Fixes #125.
- [`28c1f23`](https://github.com/pixlcore/xyops/commit/28c1f23c0356c12105d5c9e6f58080cba4a0961d): Bug Fix: Skip Upcoming Job for workflows was failing to create a blackout node on the map.  Fixes #127.
- [`5ccd3d9`](https://github.com/pixlcore/xyops/commit/5ccd3d9d9e053bd927dd9d5fecdbac66182b4631): System Upgrade DIalogs: Include links to xyOps / xySat changelogs.  Fixes #124.
- [`f841e5e`](https://github.com/pixlcore/xyops/commit/f841e5e12540443c9db6e7912dabe31467834cba): Feature: Show IDs for plugin and event params in tables.  Adjust margins a bit to compensate.  Fixes #123.
- [`dca1d4f`](https://github.com/pixlcore/xyops/commit/dca1d4f9ca700bf5eacaa05f9db6b8042625ca99): Events: Typo fix in comment
- [`14e2326`](https://github.com/pixlcore/xyops/commit/14e232616209cb71edce2e201c24321246d30947): Bug Fix / Feature: Prevent unknown tag from being added to jobs, and log warning in job meta log.  Also, allow tags to be specified by title (exact match only).  Fixes #122.
- [`c6344f8`](https://github.com/pixlcore/xyops/commit/c6344f8c6fffba25c6b6b885a41019e66edd684c): CSS: Fix coloring of HR line breaks in markdown documents.

## Version v0.9.60

> February 6, 2026

- [`df026d3`](https://github.com/pixlcore/xyops/commit/df026d304684e54df0c1e4c6ddcd89e230d2e95e): Version 0.9.60
- [`77f00da`](https://github.com/pixlcore/xyops/commit/77f00da445067de6ca704830e8e1c2415624feb4): Docs UI: Fix header nav link to scroll to top in a cleaner way.
- [`d0211a3`](https://github.com/pixlcore/xyops/commit/d0211a3686a3f28d52a37ac1abee466f0d5084ee): Marketplace: Links to README sections should stay in app, not link out.  Fixes #121.
- [`a91e859`](https://github.com/pixlcore/xyops/commit/a91e859e5ddb9b8de9e35c71da4410d3e51763ee): CSS: Fix custom nav link color.
- [`2f44c51`](https://github.com/pixlcore/xyops/commit/2f44c5149c4096f4cdc641567fc6b053306abbf2): Cosmetic Bug Fix: Edit Plugins: Box button floater wasn't appearing by default for plugins with lots of params (pushing the buttons off the bottom of the page).  Fixes #120.

## Version v0.9.59

> February 6, 2026

- [`8143639`](https://github.com/pixlcore/xyops/commit/8143639be9e5cff96ec62bcbdd9dc73d111f92cf): Version 0.9.59
- [`6a20b93`](https://github.com/pixlcore/xyops/commit/6a20b937f3c74b0970bce64d3d5f0f74f1b8db7b): Bug Fix: Logout button not accepting clicks at all.  Regression from v0.9.43.  Fixes #117.
- [`3c68b20`](https://github.com/pixlcore/xyops/commit/3c68b20629dbe29441240d895dc439d4ef6b7811): Config Doc: Typo fix in metadata.

## Version v0.9.58

> February 5, 2026

- [`e7a7ba4`](https://github.com/pixlcore/xyops/commit/e7a7ba4124e533309c3937f20e2e49e614482c0e): Version 0.9.58
	- Bump pixl-xyapp to v2.1.22 for blocking nav if code editor dialog is up.  Fixes #116

## Version v0.9.57

> February 5, 2026

- [`d0d461e`](https://github.com/pixlcore/xyops/commit/d0d461ea8837f8a283202973485941a450351bc7): Version 0.9.57
	- Bump pixl-xyapp to v2.1.21 for CodeEditor nav fix.
	- Fixes #116
- [`81caf3d`](https://github.com/pixlcore/xyops/commit/81caf3d7490c1ce0d05a903b6bcf09099c926cc9): Popup Code Editor Params: Show line numbers by default.

## Version v0.9.56

> February 5, 2026

- [`e272a8e`](https://github.com/pixlcore/xyops/commit/e272a8e9bbde99ab5927ea3c889ba7a3a546c622): Version 0.9.56
- [`fa8fda1`](https://github.com/pixlcore/xyops/commit/fa8fda11f0b50e8235acc2f89664d4bef055112b): Plugin Editor: Change inline editor to popup code dialog editor, with line numbers and accidental outside click protection (and accidental ESC key protection too).
- [`bd281a5`](https://github.com/pixlcore/xyops/commit/bd281a52d9b4dd1470cb25a50b353eccb5361a98): Change default ping freq to 5 sec, and ping timeout to 30 sec, for "troublesome" networks (packet loss, etc.).
- [`ea1edc7`](https://github.com/pixlcore/xyops/commit/ea1edc7b49b7c84e4676b956a9dbc5da8f36c783): Triggers Doc: Added note about startup triggers skipping modifiers.
- [`c945d32`](https://github.com/pixlcore/xyops/commit/c945d3202484cd4ebd6c2fabdb1a295a9c7007f6): Triggers Doc: Add note about startup trigger behavior WRT self-initiated upgrades, restarts, and shutdowns.

## Version v0.9.55

> February 4, 2026

- [`244ccf6`](https://github.com/pixlcore/xyops/commit/244ccf649c0287dbc2f752174a66a0a119b87464): Version 0.9.55
- [`046aa4b`](https://github.com/pixlcore/xyops/commit/046aa4b0d5ab8ae4c64c4280cefec0dbe6fd2294): Startup Triggers: If a background upgrade or restart command was issued, skip the startup trigger check.
- [`6d14225`](https://github.com/pixlcore/xyops/commit/6d1422529469d0d80faf90b47d92ced40296fb21): Multi: Ensure becomeMaster() only ever gets called once per server process lifetime.

## Version v0.9.54

> February 4, 2026

- [`7bc869c`](https://github.com/pixlcore/xyops/commit/7bc869c54cda6ae4ff4a8de7dba49b2f033b6c65): Version 0.9.54
- [`f83d599`](https://github.com/pixlcore/xyops/commit/f83d5991577249cd6d48c5989468f84f18bab7f2): New Event Trigger: "Startup", automatically runs a job on xyOps startup, when certain conditions are met.  Similar to the crontab `@reboot` alias.

## Version v0.9.53

> February 4, 2026

- [`e0d06e1`](https://github.com/pixlcore/xyops/commit/e0d06e1f394ac95532505338c1d86f4e4686e944): Version 0.9.53
- [`0522ade`](https://github.com/pixlcore/xyops/commit/0522adef6c28fbb8aebad1d40a8eb39ed32fa3f6): Global Hot Keys: Add default Cmd+K / Ctrl+K for focusing primary search box.
- [`3767585`](https://github.com/pixlcore/xyops/commit/37675858465a97ea3abd5caf76d998563e4eef4f): UI Bug Fix: User Prefs: Steamer mode was showing raw HTML tags in the button label.

## Version v0.9.52

> February 4, 2026

- [`f80a0e6`](https://github.com/pixlcore/xyops/commit/f80a0e69bd9fa5d24eda0527b6a545db7bf4df64): Version 0.9.52
- [`adf424a`](https://github.com/pixlcore/xyops/commit/adf424a60a9fe185a4b63b7ca3be9a56435f5bc9): Dashboard: Set click behaviors on some dash units (cards), for e.g. conductors, servers, alerts, jobs today, jobs failed today.  Fixes #113.
- [`4f1c446`](https://github.com/pixlcore/xyops/commit/4f1c4464599d814a2c7d2339c62c94f570330480): New Features: Add optional rate limiting to API Keys, as well as display a "Last Used" date, as well as display the API "Key ID" on the edit screen (not used for auth).
- [`3965f8b`](https://github.com/pixlcore/xyops/commit/3965f8ba611606c51d3b85d5321f357ba6f1d8ab): Feature: Job File Search: Also search job description, input / output data, user content (text, markdown, html), and display all results separately.
- [`c353383`](https://github.com/pixlcore/xyops/commit/c3533838e13b7a870f1198c6b7410105c64e2bce): Search Jobs UI: Change name of result "Failure" menu item to "Error", to be more consistent with rest of app.
- [`e3e7f83`](https://github.com/pixlcore/xyops/commit/e3e7f83dfdc4ab77b8034e027a1a1d89b64b9356): Feature: Allow configuration to set default event category, plugin, and targets.  Fixes #110

## Version v0.9.51

> February 3, 2026

- [`f1b5128`](https://github.com/pixlcore/xyops/commit/f1b512875e7c0e15aed8f5bd1c7419a92e7cd3ac): Version 0.9.51
- [`e7fed95`](https://github.com/pixlcore/xyops/commit/e7fed957155721c4048d58dad17796fa2987d609): New Feature: Job status tagline displayed on live job details screen and all job progress bars.
- [`a4a4424`](https://github.com/pixlcore/xyops/commit/a4a442410368a2cd65b6549271cfe75b0e19c8f5): Feature: Allow plugin / event param menus to specify values and labels separately.  Fixes #107.
- [`63080ab`](https://github.com/pixlcore/xyops/commit/63080ab27d6551f30a82bb3c52080c8fe446318a): Feature: Remember event filters in the sidebar links for "Events" and "Workflows" pages.  Fixes #105.
- [`00986d8`](https://github.com/pixlcore/xyops/commit/00986d8d5207e3b924f9f25a5b3f72c3befff464): Universal Actions / Limits: Add some additional crash protection in case the configuration is invalid.

## Version v0.9.50

> February 1, 2026

- [`b39ded7`](https://github.com/pixlcore/xyops/commit/b39ded7256052ed27cd2d0912a22fdedeba9b992): Version 0.9.50
- [`7eaaaae`](https://github.com/pixlcore/xyops/commit/7eaaaae9b1a832397532e4088a6c12609e446b07): UI: Remove default sidebar "expanded" classes in prep for pixl-xyapp 2.1.20, which manages them automatically.
- [`1c82bf4`](https://github.com/pixlcore/xyops/commit/1c82bf4d0c06f76f3fa02c7b552ba0de5ab75d79): Bug Fix: Dashboard: "Jobs Failed" counter could be incorrect in certain situations.
- [`2df18c0`](https://github.com/pixlcore/xyops/commit/2df18c0eeff32033ab90c08cc32113dad665228b): Bucket API: api_delete_bucket_file: Allow params to be specified on the query string or HTTP form data.
- [`fb835c1`](https://github.com/pixlcore/xyops/commit/fb835c12b0694083dc6a5902544a77993a82b95e): API Keys: Add "Clone" button.  Fixes #99

## Version v0.9.49

> January 31, 2026

- [`fcee1d6`](https://github.com/pixlcore/xyops/commit/fcee1d6227e96f3781cdea56b54917101ca9948b): Version 0.9.49
- [`c7e144a`](https://github.com/pixlcore/xyops/commit/c7e144ac68f74f8d113fe190d4208defe8c95740): API Doc: Add docs for new admin_search_logs, admin_get_config, and admin_update_config APIs.
- [`74e6465`](https://github.com/pixlcore/xyops/commit/74e6465b8283743c4c32431f4ad06847c68133f7): Activity Log UI: Tweak action dialog display so that user is not shown as a link (looks off).
- [`e517947`](https://github.com/pixlcore/xyops/commit/e5179470836dea8915dccc06a3dfd95bda67e1f8): UI: Copy Markdown to clipboard: Strip HTML so icons etc. are not included in the copied text.
- [`9f4e97f`](https://github.com/pixlcore/xyops/commit/9f4e97fa9c6b97f4293d3131bb4fdb245d3a5294): UI Tweak: For defining text fields / text boxes for params, use monospace font for the default values.
- [`84d7339`](https://github.com/pixlcore/xyops/commit/84d73399efdc2caea921bbe1a8c7d812c5762058): API Doc: Formatting tweaks.
- [`78f23c3`](https://github.com/pixlcore/xyops/commit/78f23c3a94a47fa29227c96b5bbdcae1a1c2cb25): API Hardening: Ensure all HTTP file uploads are valid (i.e. have filenames and non-zero size).
- [`6ac6bac`](https://github.com/pixlcore/xyops/commit/6ac6bac78f02a4076c43a27e1a1032e91b299db5): API Doc: Add "pretty" parameter to echo API.

## Version v0.9.48

> January 31, 2026

- [`65d1016`](https://github.com/pixlcore/xyops/commit/65d1016de238618837ac52c6528010760b58f6be): Version 0.9.48
- [`b7cd176`](https://github.com/pixlcore/xyops/commit/b7cd1761a81ae73e5cf0ad33e358e9ce2393a6b0): API: upload_bucket_files: Rename bucket param to "id" and support both query string and HTTP POST params.
- [`de178d6`](https://github.com/pixlcore/xyops/commit/de178d6d2637649e74c17b67569e08f4ad05a774): API Doc: Typo Fix: Incorrect parameter name in write_bucket_data.  Fixes #98.
- [`890285d`](https://github.com/pixlcore/xyops/commit/890285daa2882abe0e75b2eba2af0708f510b131): UI Bug Fix: Secret key names revert to previous versions when saving.  Fixes #97.

## Version v0.9.47

> January 31, 2026

- [`d7dae73`](https://github.com/pixlcore/xyops/commit/d7dae73ecb6550cfc0a40d1116e86f9654bb3350): Version 0.9.47
- [`c0905b5`](https://github.com/pixlcore/xyops/commit/c0905b5e9ab7363b45c938798aeb0f396d19ca22): Remove "password" text field variant type, as it gives a false sense of data security (use a secret vault instead).
- [`110cf58`](https://github.com/pixlcore/xyops/commit/110cf58b029be8d39cf53d2425835ffb6853e94d): Add Powershell as an official syntax-highlighted language

## Version v0.9.46

> January 30, 2026

- [`8e97839`](https://github.com/pixlcore/xyops/commit/8e97839c555c78c742d3c09f5a02067fd2a1a761): Version 0.9.46
- [`3cc61ed`](https://github.com/pixlcore/xyops/commit/3cc61edb89c9377b2191d565ee2d24293e842684): New Feature: Programmatic bucket data access, via new API: write_bucket_data.

## Version v0.9.45

> January 30, 2026

- [`67ae5d2`](https://github.com/pixlcore/xyops/commit/67ae5d2ba23b514f98cd3f28d92d507bf065fabb): Version 0.9.45
- [`f64d395`](https://github.com/pixlcore/xyops/commit/f64d395c37c1fbd01071a50e164c53351d21f468): Log Viewer Bug Fix: Custom Date menu was not working correctly.

## Version v0.9.44

> January 30, 2026

- [`d708387`](https://github.com/pixlcore/xyops/commit/d7083871094616dc3ffbab50dc6cbc8573147787): Version 0.9.44
- [`f5b5aad`](https://github.com/pixlcore/xyops/commit/f5b5aadaa4b676b0de342bc43937a8ab36d890ce): New Feature: Log Viewer in the UI!
- [`adb6795`](https://github.com/pixlcore/xyops/commit/adb679579bdcbfbb1048e094c27ea6d4f319b6dc): Config API: Make sure reserved keys are omitted from the overrides object in admin_get_config.
- [`2441ae7`](https://github.com/pixlcore/xyops/commit/2441ae74d89b425cb7b306faac12f9f3e90e767a): Search Jobs UI: Cleanup memory on page deactivate
- [`1cf781b`](https://github.com/pixlcore/xyops/commit/1cf781bbbd1583366eda99dd64da5e2a5088fd5a): UI Fix: Remove "Any Tag" item from tags menu on job search page (not used for a multi-select menu).
- [`bf021ec`](https://github.com/pixlcore/xyops/commit/bf021ec0316ce0cb6e1a51da0d6cc2044a241c5d): UI Bug Fix: Floating buttons on config page weren't showing up until user scrolled.

## Version v0.9.43

> January 29, 2026

- [`93017cd`](https://github.com/pixlcore/xyops/commit/93017cde0db8332194e5ba35a89c63b75c4b2911): Version 0.9.43
- [`ca8fb60`](https://github.com/pixlcore/xyops/commit/ca8fb604abe382fc5dbe4bfd95d7b81ba2fdde01): New Feature: Configuration Editor in the UI!
- [`860ea3b`](https://github.com/pixlcore/xyops/commit/860ea3b17d23dbedc41d21d7025b37e61a8d93db): UI: Improve event / plugin parameter summary display, with correct icons for text variants, and masking password fields.  Fixes #89
- [`2689af3`](https://github.com/pixlcore/xyops/commit/2689af32d2925c106105f4612ed3350e52e4219f): Add Content-Disposition header for satellite file downloads.
- [`0a4f430`](https://github.com/pixlcore/xyops/commit/0a4f4301469341338942452199d7fa954ec61126): Admin Import Data API: Add optional "danger" mode which will skip scheduler disable and job abort.  For future use (i.e. sync with external systems).
- [`0e6e4cb`](https://github.com/pixlcore/xyops/commit/0e6e4cb1c1e74bbf99358510b687c2246b197e38): Delete Server: FIx issue with server sticking in cache after deletion, and also properly updating jobs on deleted servers.
- [`b26601e`](https://github.com/pixlcore/xyops/commit/b26601e682f88a39eb3ae7be9f1cc3bdd9cf6f6a): Alerts: Write active alerts to recovery data so they survive restarts cleanly.
- [`d8cd137`](https://github.com/pixlcore/xyops/commit/d8cd1378f1322dd70b0597be71d0edcf4abe9668): UI Bug FIx: Clicks on header widgets may get missed if they are redrawn during the mousedown.
- [`ff9837c`](https://github.com/pixlcore/xyops/commit/ff9837c0c72838cd34e20b412131c326449ad720): Workflow UI: Improve trigger icon titles a bit (for internal / single shot).

## Version v0.9.42

> January 26, 2026

- [`d095f91`](https://github.com/pixlcore/xyops/commit/d095f91191a0b6d0f0eba6f6c37f0bf6df6787d6): Version 0.9.42
- [`6af4f4f`](https://github.com/pixlcore/xyops/commit/6af4f4f22de003e3fe9621fe9bd97c490a96bb10): Install / Upgrade Script: Improve behavior with systemd on Linux.  Fixes #86.

## Version v0.9.41

> January 26, 2026

- [`8d69754`](https://github.com/pixlcore/xyops/commit/8d69754363e6cb687ac5f24bf0ed8f65e424fbaf): Version 0.9.41
- [`7428172`](https://github.com/pixlcore/xyops/commit/74281729e5cc809ddbbacd343c89efdf3aefd016): API Doc: Clarified _tags system tag behavior in search_jobs API.
- [`dc98381`](https://github.com/pixlcore/xyops/commit/dc98381085a33631e890b34f5b92393c27a50cc9): Job Tag Behavior: Apply "Has Files" tag if job has input OR output files.  See #68.
- [`99dfe56`](https://github.com/pixlcore/xyops/commit/99dfe56029e47a884e72b58da29f6cf97f3c7a62): UI FIx: Show tooltips on all entity names (was not working in Chrome / Firefox).  Fixes #85.
- [`27ab6f4`](https://github.com/pixlcore/xyops/commit/27ab6f4cecb3431dce2260fd4ec799e745f536fc): Install Script: chmod log dir to 775, not 777
- [`cdb3195`](https://github.com/pixlcore/xyops/commit/cdb3195f1e33005abbb5d6d95a5240f562b85a3f): Config Doc: Remove excess space.
- [`68ecea9`](https://github.com/pixlcore/xyops/commit/68ecea9d8602d5fe57b8599888fcc3f44cc08e6b): Config Doc: Add more details in client.chart_defaults, client.editor_defaults, client.bucket_upload_settings, client.ticket_upload_settings, and client.job_upload_settings.

## Version v0.9.40

> January 25, 2026

- [`b46abb6`](https://github.com/pixlcore/xyops/commit/b46abb6cfa2cbf03f739b170f96ca7311ba2fd7e): Version 0.9.40
	- Bump pixl-boot to v2.0.2 for improved systemd service behavior.
- [`d35f397`](https://github.com/pixlcore/xyops/commit/d35f3977ce5e57c2c0fb1051daf8e39754540034): Doc Index: Add link to contrib guide.
- [`f2576b2`](https://github.com/pixlcore/xyops/commit/f2576b2e6d233319925c701d2fc1f5feebf5f5dc): Satellite Install/Upgrade: Redesign Linux install/upgrade scripts to be first-class systemd citizens.
- [`53ec3a8`](https://github.com/pixlcore/xyops/commit/53ec3a87753bd9e0a7e422f19c890a4d38974c4e): Bug Fix: For fetching storage bucket actions, handle case where bucket data is a top-level array (merge in as "items" property).
- [`f3589c2`](https://github.com/pixlcore/xyops/commit/f3589c26d7b7e3f90b585a2b465505f7e6098d54): UI: Fix bucket header icon
- [`d592cb2`](https://github.com/pixlcore/xyops/commit/d592cb288b147e705722a39a94f7ec34d6af6370): CSS: Adjust repsonsive classes for compact trigger grid, for new tags column
- [`6542d44`](https://github.com/pixlcore/xyops/commit/6542d44f921105d19e26ece1af1752e56ddde280): UI: Tweak icon for New Ticket (change to outline version)
- [`7d8267e`](https://github.com/pixlcore/xyops/commit/7d8267e942915bec234ca05d992c4a0100be5804): Feature: Add optional tags and user params to all schedule triggers, for passing onto jobs.
- [`c09c45c`](https://github.com/pixlcore/xyops/commit/c09c45cd8ff2e9af2e8f1f6d83f4339ba925ba45): Job Details: Pad chart second timeline to match full job start/end range.
- [`e120494`](https://github.com/pixlcore/xyops/commit/e1204943e26343eba74bc1edddab3735bc0d985b): Bug Fix: Do not allow category to be deleted if workflow job nodes are assigned.  Also, include these nodes in the counts on the category list page.  Fixes #82.
- [`c46e006`](https://github.com/pixlcore/xyops/commit/c46e0065a03bd0f4f0ad94318206d2e3436ea2d5): Bug fix: UI crash when saving a bucket without having used the "bucket menu" feature.

## Version v0.9.39

> January 24, 2026

- [`1acce06`](https://github.com/pixlcore/xyops/commit/1acce0619508d7f79b4ed3d3ebc49fa72fa7ea0a): Version 0.9.39
- [`269b339`](https://github.com/pixlcore/xyops/commit/269b33927c38948cfcf6354f93ad7763cc16a7e4): Bug Fix: A job triggering a limit with non-email actions cause a full crash.  Fixes #81
- [`b32e260`](https://github.com/pixlcore/xyops/commit/b32e2601c45db9e9c31d768b0387cb45f2e488fe): Plugins Doc: Add section on input files for event plugins.  Also rename a few sections for TOC clarity.
- [`359fd7d`](https://github.com/pixlcore/xyops/commit/359fd7db78ef37a11df4c9bd04cd25b53aacc7d1): Doc Viewer: Add table wrapper with scroll-x for mobile.

## Version v0.9.38

> January 24, 2026

- [`a651832`](https://github.com/pixlcore/xyops/commit/a651832dcded8d0a36e5067baa47d9145073c9cf): Version 0.9.38
- [`111e1a0`](https://github.com/pixlcore/xyops/commit/111e1a0502ed60f5f757a433c320216122c70588): Web Hooks: Improve test API to better handle text inside inline JEXL function macros.
- [`a63f175`](https://github.com/pixlcore/xyops/commit/a63f175d4c1c72d8fe943423699ecdd23dc489a5): Web Hooks: Properly display core request errors (e.g. "Socket hang up") in markdown details.
- [`51a1d9c`](https://github.com/pixlcore/xyops/commit/51a1d9cccdb84a4f17bf62edc883b8993b0ffb4c): Setup: Add new "pass" checkbox to stock Shell Plugin.
- [`e9791cd`](https://github.com/pixlcore/xyops/commit/e9791cdea9558a4ad1d5455705518841f9c3bda2): Job Detail Page: On delete job, nav to previous page if one is on the stack.
- [`082a592`](https://github.com/pixlcore/xyops/commit/082a5921d4fdfe2d6beb62f40763f6280169c472): Doc Viewer: Add click on nav to scroll to top, and copy-to-clipboard icons on code blocks.
- [`9e2c2a2`](https://github.com/pixlcore/xyops/commit/9e2c2a29e0274ec898ef26bf90a83719ade1a230): Web Hooks Doc: Improve instructions for setting up Pushover.

## Version v0.9.37

> January 23, 2026

- [`4c5af9c`](https://github.com/pixlcore/xyops/commit/4c5af9cd9cca191652ce30b4084b3a4b53f31c23): Version 0.9.37
- [`4885ccb`](https://github.com/pixlcore/xyops/commit/4885ccba5ef25a350633979ca1ac0ec4cacb659f): UI: Disable spellcheck in param text fields.
- [`d1d8aa1`](https://github.com/pixlcore/xyops/commit/d1d8aa1061821937c6588f24c60e17d5b128882e): CSS: Tweak scroll shadows background color for compact table grids.
- [`294a97f`](https://github.com/pixlcore/xyops/commit/294a97f2d4d5a9d91e5cc8319305dc29b75036bf): Event Timing Summaries: Redesign to support date/time locales and 24-hour time.
- [`ff97285`](https://github.com/pixlcore/xyops/commit/ff972853458621a43ee5bb8cce4deec143f6ee1a): Event View: Cosmetic: Set max-height to trigger/action/limit summaries, and add auto-scroll.
- [`7bb4415`](https://github.com/pixlcore/xyops/commit/7bb4415d0336f435a88c39a04c4946d870461e4c): Tweak last day of month summarization format.
- [`dd108df`](https://github.com/pixlcore/xyops/commit/dd108dfc1ce5ea86dc03766d707f601ca3201e45): Cosmetic Fix: Add proper default icon for tags in drop-down menus.
- [`ad29d24`](https://github.com/pixlcore/xyops/commit/ad29d24b0975a7bc3ffd38d6a7a668d4178f7d51): Job Details: Allow input files to be deleted if source was a user or a plugin.
- [`875eb39`](https://github.com/pixlcore/xyops/commit/875eb39d299da7743da374add82fa971ec452d8e): README: Update docs links to use new official docs website.

## Version v0.9.36

> January 22, 2026

- [`9ca026c`](https://github.com/pixlcore/xyops/commit/9ca026ceb9c30e4d8b5e84065d252538febca699): Version 0.9.36
- [`da6aad5`](https://github.com/pixlcore/xyops/commit/da6aad5c508280f3d0ecea17ac0dd054716b7c5b): Hosting Doc: Added section on external storage, recommending MinIO.
- [`a57fa50`](https://github.com/pixlcore/xyops/commit/a57fa501df9123d84461637e16acc05ff2b783f9): Default Config: Set correct values in S3 cache (maxItems and maxBytes)
- [`b1a3926`](https://github.com/pixlcore/xyops/commit/b1a3926a2fb41560863e8cbb4898adb870856448): Bug fix: Preserve Job.now value when re-running a job.
- [`3e7b5ad`](https://github.com/pixlcore/xyops/commit/3e7b5adcdcf474aa538159c17742f1c74304daee): Workflows: Pass Job.now timestamp into sub-jobs by way of workflow.now sub-property.
- [`a3fa541`](https://github.com/pixlcore/xyops/commit/a3fa541054ee5456275fc72ad75e084d9e313edc): Feature: Add optional "select" parameter to the search_jobs API, to select individual job properties to return.
- [`2e59b09`](https://github.com/pixlcore/xyops/commit/2e59b09735f34bcd9ba765ce6b8eb62eb5ba6c75): Feature: Add new "Has Files" system tag to the UI and job searches.
- [`14f61a6`](https://github.com/pixlcore/xyops/commit/14f61a6430a9d97fa534eb08c90c18972e1b090e): Feature: Add special `_files` system tag when a job completes and has output files attached.
- [`6b07b7e`](https://github.com/pixlcore/xyops/commit/6b07b7e151d3df15def8243f25124962609664d3): Fix: Deleting files on the job detail screen was not working if the job also had input files displayed.  Fixes #67
- [`9df2a6e`](https://github.com/pixlcore/xyops/commit/9df2a6e72aa65420153fa82b5b6cb681d6426fc4): Database Doc: Fix table formatting.

## Version v0.9.35

> January 21, 2026

- [`a2c2bf2`](https://github.com/pixlcore/xyops/commit/a2c2bf27fca7dde87782bdd60851b277eb573c09): Version 0.9.35
- [`37b17ae`](https://github.com/pixlcore/xyops/commit/37b17aee9877f5d9c9971b984c73357dc3416ca4): Events / Workflows: When switching Plugins, retain the user's previous param selections (temporarily during edits).
- [`43eea0a`](https://github.com/pixlcore/xyops/commit/43eea0a49094758384b3517e19daa84372593d40): Keyboard Shortcuts: Add "E" hot key on job detail page, to jump straight into editing event.
- [`75f72ee`](https://github.com/pixlcore/xyops/commit/75f72eed115d2503a31b4887eee6340438addbb9): Feature: Add "Edit Event" button to job detail page.  Collapse the two tickets buttons into one, with drop-down menu.
- [`bc1a580`](https://github.com/pixlcore/xyops/commit/bc1a58089aa60028cf9fef5ce63b6ea2c0f6bfa4): Hosting Doc: Added section on default SQLite daily backups.

## Version v0.9.34

> January 20, 2026

- [`2605334`](https://github.com/pixlcore/xyops/commit/260533479e9179091175c962cd115991a631f8de): Version 0.9.34
- [`628bd9b`](https://github.com/pixlcore/xyops/commit/628bd9b83a27a059dd79951fa8251a85c9a63b89): Feature: "Bucket Menu" allows you to define a plugin or event param with dynamic items that load from a storage bucket.
- [`5490b8e`](https://github.com/pixlcore/xyops/commit/5490b8e16afd70e2fb64b7b6ab95273f0162b253): Bump pixl-xyapp to v2.0.19 for more robust menu data handling.
- [`5de61eb`](https://github.com/pixlcore/xyops/commit/5de61eb5964bda9585285cd23bfe34b656848d90): Feature: Show "Tags" column on Event List page.

## Version v0.9.33

> January 19, 2026

- [`e5d07a5`](https://github.com/pixlcore/xyops/commit/e5d07a579fa06c67201d9c8f09fc8733732d4f6c): Version 0.9.33
- [`c0edb6e`](https://github.com/pixlcore/xyops/commit/c0edb6e7d0709d3624c295c4b840a40fd1b12323): Remove: Legacy Job Comments feature (replaced by tickets).
- [`c6c7f62`](https://github.com/pixlcore/xyops/commit/c6c7f62c2bf3a0737b7a6cf0e1b5f015a93b7050): Feature: Implement log archive auto-delete via `log_archive_keep` config property.
- [`5b53e42`](https://github.com/pixlcore/xyops/commit/5b53e4254ef815cf6a52ca55f9b21fd716e1395a): Config Doc: Add `client.company` property description.

## Version v0.9.32

> January 19, 2026

- [`440913b`](https://github.com/pixlcore/xyops/commit/440913b833a0e890148bde5fd9fe1fd3aa784654): Version 0.9.32
- [`5510605`](https://github.com/pixlcore/xyops/commit/5510605836ff2ac283d0b1b46d3b5f788152ef9e): Event List: Remove "Clone" link, as it was taking up too much room.
- [`b5ca35e`](https://github.com/pixlcore/xyops/commit/b5ca35e44b0eec9d99475eb0d05ea3fe11916ee3): CSS: Add styles for job media slideshow, and also disabled button.link buttons
- [`a0e1ce5`](https://github.com/pixlcore/xyops/commit/a0e1ce5845ecc84a14387a21ec4cc935563f0b0d): Feature: Media slideshow when job outputs images, video or audio files.
- [`d9f8723`](https://github.com/pixlcore/xyops/commit/d9f8723b75f96b14c8e2b337d4e84f1b4d3c9a99): HTTP Range: Fixed another issue with computing the byte range
- [`3052623`](https://github.com/pixlcore/xyops/commit/30526233233398971dd6ed409a7f48306f101ec2): Crasher: Fix issue with HTTP Range headers and streaming media hosting.
- [`18be0f6`](https://github.com/pixlcore/xyops/commit/18be0f61ff77c05d62364426293da3cc253c4e50): Cosmetic Fix: Ensure CodeMirror deselects the current text selection on blur.
- [`82e61d4`](https://github.com/pixlcore/xyops/commit/82e61d4bea6855d9e8acee2f0bbe83ac90471ce9): Job Completion: if job failed with no output, set description as output (better UX).
- [`0224608`](https://github.com/pixlcore/xyops/commit/0224608dd702eb765dfafb022ca21d335894a7d1): Event List UI: Fix sorting order issue with some categeories.

## Version v0.9.31

> January 16, 2026

- [`085918f`](https://github.com/pixlcore/xyops/commit/085918f0a014d5f7957983ccbe5682913010d6c1): Version 0.9.31
- [`f977427`](https://github.com/pixlcore/xyops/commit/f977427c54f1258569dc55e1566053fad70c9bdb): Workflow UI: Fix display issue with trigger plugins (title not showing).
- [`1b3df7c`](https://github.com/pixlcore/xyops/commit/1b3df7cb236a7430cb693e76882112ad761f83cd): Workflow UI: Set a fixed max height for event/job nodes and enable auto-scroll inside them.

## Version v0.9.30

> January 16, 2026

- [`29008d5`](https://github.com/pixlcore/xyops/commit/29008d5d457a23d993a985a901531a165b28f2fc): Version 0.9.30
- [`89b74e6`](https://github.com/pixlcore/xyops/commit/89b74e660862545bc8d346457d8fc3bfb438fe35): Fix: Workflow nodes were not properly rendering JSON and Toolset params in the UI.
- [`2bcf02b`](https://github.com/pixlcore/xyops/commit/2bcf02b96658db04aedd138b0685a6d035696b29): Event/Job UI: Tweak height of workflow map preview.
- [`76eea07`](https://github.com/pixlcore/xyops/commit/76eea0708c6aa18bcb5f77cdf6d68c1b2209240f): Workflow Doc: Clarified behavior of workflow user field params passing to sub-jobs.
- [`2e429ba`](https://github.com/pixlcore/xyops/commit/2e429bab8c45265d06861ffb825d418c3eac3e9a): Marketplace UI: General cleanup, remove console.log, add confetti.
- [`25d236d`](https://github.com/pixlcore/xyops/commit/25d236d277a02d7a1663fccf537e700a05b04ef4): Event List: Change "History" action link to go to job history search, not revision history.

## Version v0.9.29

> January 15, 2026

- [`0a45c92`](https://github.com/pixlcore/xyops/commit/0a45c92961b0aa73c998058efab13b0c97c38b5f): Version 0.9.29
- [`506ea86`](https://github.com/pixlcore/xyops/commit/506ea86c529f2f32cdfbaa4e028f0ec8e6fa7e60): API Docs: Add docs for new bulk_search_export API
- [`7aa85df`](https://github.com/pixlcore/xyops/commit/7aa85df3076e28d92a326789f0bc89d11c66afee): Docs: Change array formatting to not use any HTML metacharacters.
- [`f016141`](https://github.com/pixlcore/xyops/commit/f0161415a751d5c79586e75683a5fa11943e0aff): New Feature: Bulk export job, ticket, alert and snapshot search results, in CSV / TSV / NDJSON format, with optional gzip wrapper.
- [`a60bf0c`](https://github.com/pixlcore/xyops/commit/a60bf0c4488069d742cacb4d51315e4f0f3b31e6): Admin: Remove comment about unused API (it is now used).
- [`16e2bb3`](https://github.com/pixlcore/xyops/commit/16e2bb3a150d12b4ce64838960314dc47e00559d): CSS: Tweak padding above first checkbox container in form row
- [`e4817c0`](https://github.com/pixlcore/xyops/commit/e4817c0cbb101a7337c144fda70e5473e0a56e46): Event List UI: Replace "Delete" with "History" in action column.

## Version v0.9.28

> January 15, 2026

- [`58edcc9`](https://github.com/pixlcore/xyops/commit/58edcc91ee4bc66d387ce3511699b001c3485c17): Version 0.9.28
- [`dfe967c`](https://github.com/pixlcore/xyops/commit/dfe967cf26e3f8c66e97381644c4a3ba2d54b2cd): Scalability: Add deboucing for several API in the UI, to better handle large job / queue throughput.
- [`56558c1`](https://github.com/pixlcore/xyops/commit/56558c175ecbe10c931fac32bb5b347941cebb5d): Event List UI: Add more options in the actions column. Fixes #53.
- [`363f5b7`](https://github.com/pixlcore/xyops/commit/363f5b7b68f12129d257cdf6848382be2b2aaa0e): User Settings: Add option to show milliseconds in dates/times.  Fixes #52.
- [`6754d72`](https://github.com/pixlcore/xyops/commit/6754d723087c4cb9bd2942f3516ad87eb88a4131): API Doc: Added query examples to main search APIs.
- [`4fdad84`](https://github.com/pixlcore/xyops/commit/4fdad84560629592236067ab876685dbcd70ba3d): Docs: Complete Activity.action in data.md and link syshooks to it.
- [`3aeb7d0`](https://github.com/pixlcore/xyops/commit/3aeb7d031529c6eaa0b1110e0296e86245125ac2): API Doc: Remove sentence.

## Version v0.9.27

> January 14, 2026

- [`773673c`](https://github.com/pixlcore/xyops/commit/773673c7ad239687190d57b4e8691f4d4893af0d): Version 0.9.27
- [`2e51788`](https://github.com/pixlcore/xyops/commit/2e517882cb53d1793bbf10f3fcea4b124a822762): Job Completion: Check for free queue slots on each job complete, to speed up queue item throughput.
- [`dab255c`](https://github.com/pixlcore/xyops/commit/dab255ca9a5ce37ddbb149ba3972eea3ae516827): Alerts: Include server info in alert_new and alert_cleared activity log entries.
- [`e872466`](https://github.com/pixlcore/xyops/commit/e872466fc48300bfeac161c3011c78bc2dbbaac9): UI: activity_search_map: Add "master_primary" activity ID to "peers" search group.
- [`a77fe3e`](https://github.com/pixlcore/xyops/commit/a77fe3e40f31df1ac5181691b82bbce710db5f5c): Activity UI: Fix issue where alert invocations were not searchable by "Alerts" menu item, and also show copyable ID in dialogs.
- [`bbacd45`](https://github.com/pixlcore/xyops/commit/bbacd45d16d23228d8cac89f4a10dd208ee5d963): CSS: Adjust font size of non-styled code in code_viewer
- [`ee4e234`](https://github.com/pixlcore/xyops/commit/ee4e234697170d50ec38a13ae15495eacbb91e4c): Comm UI: Only show "reconnecting" progress dialog if a dialog (or code editor) isn't already being displayed.
- [`af23237`](https://github.com/pixlcore/xyops/commit/af23237bec2bb296c5f1717389e3c486111a2d18): api_get_servers API: Drop admin requirement, as this is a read-only API.  Fixes #46.

## Version v0.9.26

> January 14, 2026

- [`3f6f452`](https://github.com/pixlcore/xyops/commit/3f6f452ee32dbef74528e01bfce45d3b62a90c62): Version 0.9.26
- [`4634325`](https://github.com/pixlcore/xyops/commit/46343258b237f66518d0b650dd07e8173250b68c): Multi: Include hostID in notice/critical messages for backup server startup.
- [`b1203c5`](https://github.com/pixlcore/xyops/commit/b1203c5208d9c0c95de4ad4dbce1a3eb9ee7a7ee): Satellite Upgrade Script: Unset "__daemon" variable (used by pixl-server)
- [`839df82`](https://github.com/pixlcore/xyops/commit/839df824e7bc7765b1abf35b35a95b6a4af08c76): Multi: When spawning shell for background commands, remove "__daemon" var (used by pixl-server).
- [`bae34ac`](https://github.com/pixlcore/xyops/commit/bae34ac1b2437fe7ace7162db5adfa3dcaa19232): Satellite Upgrade Script: Unset "__daemon" env var so pixl-server properly forks (for non-docker installs)
- [`c508266`](https://github.com/pixlcore/xyops/commit/c5082663877e3ef2c7ec5628dfd4e86f4dada31f): Install Script: Improve output, and remove old unused code.
- [`60fb1d0`](https://github.com/pixlcore/xyops/commit/60fb1d02693550d34d18878aaf2ea446dabb106f): Comm/Multi: Add sanity checks on websocket data format, in case remote side is still on an older version.

## Version v0.9.25

> January 14, 2026

- [`f70bc7c`](https://github.com/pixlcore/xyops/commit/f70bc7cc96c3c06838f39d13881be919c241f00c): Version 0.9.25
- [`e431b11`](https://github.com/pixlcore/xyops/commit/e431b11cb233bc3972cfe662544f413e3b2721bc): Satellite Upgrade Script: Improve logging output.

## Version v0.9.24

> January 14, 2026

- [`ad751b5`](https://github.com/pixlcore/xyops/commit/ad751b5707f752d67d1ba84b1bd7b4c09bce0972): Version 0.9.24
- [`09c5da2`](https://github.com/pixlcore/xyops/commit/09c5da221fed4eef3fad011c9a655d567d35ece7): UI: Fix color of critical notification banner.
- [`7bb2346`](https://github.com/pixlcore/xyops/commit/7bb23465cff1db2a738e98e6efaf46a9ebdf89d2): Crasher Fix: Sending incorrect websocket data for notice/critical.
- [`9c99743`](https://github.com/pixlcore/xyops/commit/9c99743e7ef207b7b4d03fb5bb9c6af99d85dff5): System Hooks Doc: Added note regarding shell_exec running on the primary conductor, and debugging tips.

## Version v0.9.23

> January 14, 2026

- [`23eebde`](https://github.com/pixlcore/xyops/commit/23eebde535e93b3a070052a402d996e5bfa1e2c9): Scaling Doc: Add sections for handling critical errors, and monitoring alerts.
- [`1196139`](https://github.com/pixlcore/xyops/commit/1196139ea5cd1e993034843bb757a8dad19e534a): System Hooks Doc: Change word.
- [`f20a75b`](https://github.com/pixlcore/xyops/commit/f20a75b74ac5bc7d0b9603d9b89b3cee7a352d76): System Hooks Doc: Add note about creating overdue tickets.
- [`ac3e093`](https://github.com/pixlcore/xyops/commit/ac3e093baf367b36d9a1316efdd806a57ce3eac5): Added note regarding passing query string or POST parameters to the magic API
- [`7f035a6`](https://github.com/pixlcore/xyops/commit/7f035a66dfbce36ea42da82ea8484d65954c2019): Version 0.9.23
- [`99cf11d`](https://github.com/pixlcore/xyops/commit/99cf11d24223372fb8083e495d188e5d8abb449c): Install Script: Disable current version check, in case user wants to reinstall the same version.
- [`684254e`](https://github.com/pixlcore/xyops/commit/684254efea870978b2ac3b1710537edccd81586b): API Doc: Added note in run_event about overriding event properties, and specifying tags.
- [`028604c`](https://github.com/pixlcore/xyops/commit/028604c103c22aff49627547b5dbccc947cb136a): Wrote: System Hooks doc.
- [`5d0504f`](https://github.com/pixlcore/xyops/commit/5d0504f1e3f903864bfa2642b83b7c7a84b0b595): System Web Hooks: Remove legacy configuration properties.
- [`0e5efaa`](https://github.com/pixlcore/xyops/commit/0e5efaaf0c6553626db1b20b40616783e0291d73): Multi-Server System: Improvements to background upgrades and remote command notifications.
- [`d0af5b9`](https://github.com/pixlcore/xyops/commit/d0af5b96f92c37e5b2bfa772b432a57baa6827e8): Mailer: New "activity.txt" email template for system hook activity email reports.
- [`b58f2e2`](https://github.com/pixlcore/xyops/commit/b58f2e20b2ca1ecaf972e5ae955912116727cdda): Mailer: Look in both conf/emails/ and sample_conf/emails/ for templates, as new ones may be introduced.
- [`67e1c14`](https://github.com/pixlcore/xyops/commit/67e1c1445eb7b6c9774354371a75aa804798ec1c): WebSocket Comm: Add support for notice, error, warning and critical activity log entries from remote servers.
- [`6e94809`](https://github.com/pixlcore/xyops/commit/6e948095eaed334927c25fb75b73a07fe86ec326): System Hook: Major improvements to shell exec, add "email" and "ticket" system hook actions.
- [`9ee9be2`](https://github.com/pixlcore/xyops/commit/9ee9be202e1e20f3766d6f0d82ea506603552e39): UI Config: Add "critical" activity type, and fix icon for warnings.
- [`c2a1cdb`](https://github.com/pixlcore/xyops/commit/c2a1cdbefcfe29d997be724f81f4e8f52071bd40): Activity UI: Add display and filtering support for general notices, warnings, errors, and criticals.
- [`3a1035f`](https://github.com/pixlcore/xyops/commit/3a1035f8c235ba625ad4281b167eef7bb7025d0a): Dynamic copyright string with configurable company name.

## Version v0.9.22

> January 12, 2026

- [`832f698`](https://github.com/pixlcore/xyops/commit/832f698ac58ef3aef73258311a33c7328847d85c): Version 0.9.22
- [`ffeffa9`](https://github.com/pixlcore/xyops/commit/ffeffa99cea41cc18700220b8d41a9dd2d253877): Self-Upgrade System: Change log filename to "background.log" for background upgrade commands (WIP).
- [`66044bf`](https://github.com/pixlcore/xyops/commit/66044bfcbe7c8f29402da8a72110a67da0ba053f): UI: Page Descriptions: Prevent flickering on some pages when server sends data updates.
- [`f0d4ee0`](https://github.com/pixlcore/xyops/commit/f0d4ee04960f067cbbe19c78f270699297ed9ae0): Satellite Upgrade: Tweak debug log levels slightly, for more info on standard level 5.
- [`a031137`](https://github.com/pixlcore/xyops/commit/a0311375b36c482ffbf26e3a121ad89a7f4918c1): Self Upgrades: Add retries with exponential backoff for upstream GitHub requests, as they randomly fail sometimes.
- [`862c674`](https://github.com/pixlcore/xyops/commit/862c67418bf0afb5c0114f0a56b338dd516bff1d): System Upgrade Dialogs: Save release and stagger selections in user prefs.

## Version v0.9.21

> January 12, 2026

- [`5513116`](https://github.com/pixlcore/xyops/commit/55131169a947306e7d4ae8b38ae261b0fd99b836): Version 0.9.21
- [`3dd571d`](https://github.com/pixlcore/xyops/commit/3dd571d9437b58cd2d2b61b58a776ee2786c0256): Marketplace: Show plugin installed status (up-to-date, outdated, not installed) on the marketplace listing page.  Fixes #40.
- [`60d0e0a`](https://github.com/pixlcore/xyops/commit/60d0e0af11678b6d74b455bee643039f59018abf): Fix: Satellite and Conductor upgrades fail if any version other than "latest" is selected.
- [`2d564d3`](https://github.com/pixlcore/xyops/commit/2d564d3d3ed56f85a28d15a9143fb3eeee272335): README: Change main heading text.

## Version v0.9.20

> January 11, 2026

- [`29822dc`](https://github.com/pixlcore/xyops/commit/29822dc0b2d67be908759441569dd252036f1426): Version 0.9.20
- [`f8d153b`](https://github.com/pixlcore/xyops/commit/f8d153b57200acecdd7ee9c69a4398709dc55599): Fix: Flickering dialog issue when waiting for conductor server election.
- [`84160de`](https://github.com/pixlcore/xyops/commit/84160de2135081052026ecee71edb6c940ceab72): Conductor Page: Add "Remove" link to remove dead / ghost conductor servers.
- [`437f209`](https://github.com/pixlcore/xyops/commit/437f2090949583292fe3b3443487114657b2cc28): Marketplace Improvements: Allow filtering by plugin type, and also display plugin type in the search results, and on landing pages.
- [`63b45f6`](https://github.com/pixlcore/xyops/commit/63b45f606dda1798b8d3f0d8e6e71320ca8213e6): Marketplace Doc: Added "plugin_type" metadata property.
- [`5bf7ab8`](https://github.com/pixlcore/xyops/commit/5bf7ab89a8ff25e6cddd6c0e753a31f6b41af4e0): UI: Improve styling of links in workflow controller description blocks.
- [`21e4e6d`](https://github.com/pixlcore/xyops/commit/21e4e6d8f7540ec929116769cd9ec9494f81e80c): UI: Added links to docs in workflow controller descriptions.
- [`ba2f605`](https://github.com/pixlcore/xyops/commit/ba2f6054b5cdcf703dd0efc7b9f2a84b7b6a6333): Data Structures Doc: Indicate that IDs must be lowercase alphanumeric.
- [`41312f0`](https://github.com/pixlcore/xyops/commit/41312f0f49fb92c458bec0d7a9927332b11cb8cc): Plugins Doc: Added note re: use of secrets in the HTTP Request Plugin.

## Version v0.9.19

> January 10, 2026

- [`0613740`](https://github.com/pixlcore/xyops/commit/0613740aa3e4419d7211bdcfea95c7a018d7bb95): Version 0.9.19
- [`74c3cd0`](https://github.com/pixlcore/xyops/commit/74c3cd08161c31712e3e64149f1a1ff0fcb39cd3): create_plugin API: Ensure plugin has an "enabled" property.
- [`43baa58`](https://github.com/pixlcore/xyops/commit/43baa5895b4bc88ddc7a2b962c08b12f76f1e01f): API Change: Ensure all object IDs are lower-case alphanumeric + underscore only.
- [`b544050`](https://github.com/pixlcore/xyops/commit/b544050dbbec1104b4720f952937acce6bda87fa): Marketplace Doc: Typo fix: Missing "enabled" property in sample exported plugin.
- [`b3fd437`](https://github.com/pixlcore/xyops/commit/b3fd437131c8d95d4b8b6febfb29bc47494b1094): Fix: Export PATH variable in control.sh and container-start.sh, so it properly propages out.

## Version v0.9.18

> January 10, 2026

- [`b13d9fb`](https://github.com/pixlcore/xyops/commit/b13d9fb29f152e1d269af38b3bb5d5f64a642b1c): Version 0.9.18
- [`9f51b25`](https://github.com/pixlcore/xyops/commit/9f51b256aaf80d9f5523b46e77e20668b9ac4b4a): Fix: Move uv/uvx binaries to a standard PATH location

## Version v0.9.17

> January 10, 2026

- [`4cca996`](https://github.com/pixlcore/xyops/commit/4cca996995a75e811e41054cb7d4c960cae891d4): Version 0.9.17
- [`fb1973c`](https://github.com/pixlcore/xyops/commit/fb1973cb45738df1166f3d73e8df89493e05a07d): Plugin API: Two new APIs: test_monitor_plugin, and test_scheduler_plugin.
- [`3d6b2f6`](https://github.com/pixlcore/xyops/commit/3d6b2f69cd7c29d058898e3de5cd09a292acddef): Run Event API Validation fixes...
- [`0cfe00f`](https://github.com/pixlcore/xyops/commit/0cfe00f9000d212f192a6e97ae829580c98eddea): Server Connect: Initialize server.info.features if not passed in by remote server.
- [`4479606`](https://github.com/pixlcore/xyops/commit/4479606971f715ad81eef8acf44e572977030948): Scheduler: Support for testing scheduler (trigger) plugins, and tweak env vars...
- [`0177dc4`](https://github.com/pixlcore/xyops/commit/0177dc40d98b2d42ce92011188f6c6f34ece3f33): Socket Comm: Improve debug logging, support for new monitor plugin test
- [`6470520`](https://github.com/pixlcore/xyops/commit/6470520711512be6fa9d72dc662f14a737909021): Action Plugins: Changes to env vars and output formatting...
- [`74c2545`](https://github.com/pixlcore/xyops/commit/74c2545283e4c9df24d9dd2978e7e3bab9efaaeb): Sanitize HTML Config: Allow "class" attrib on pre and code tags
- [`853badd`](https://github.com/pixlcore/xyops/commit/853baddb477ec4acf1784a5c238c8393fcc8a49b): Plugins: Big Change: New "Test" button, to test all 4 plugin types!
- [`ae3637d`](https://github.com/pixlcore/xyops/commit/ae3637d94f8da3f49566fe6819c36de19a6ed671): Revision Dialogs: Fix icon spacing.
- [`d79cd6f`](https://github.com/pixlcore/xyops/commit/d79cd6f97622827d380c34fd44a7bcc9dc7927c9): Job Detail: Add action popup, and a markdown style fix...
- [`f772667`](https://github.com/pixlcore/xyops/commit/f77266706b7ac5a20538d9594c08622d0d6398d1): Event Revision Dialog: Fix icon spacing.
- [`aee19f0`](https://github.com/pixlcore/xyops/commit/aee19f037880ade94966d8da268e81f535dd5dbb): Fix getNiceAPIKey, and changes to viewMarkdownAuto...
- [`3e1653c`](https://github.com/pixlcore/xyops/commit/3e1653c57ce75e90ae51f857f8c964f146afe5d9): Allow CodeEditor to show progress dialogs on top of standard dialogs.
- [`b01e5b8`](https://github.com/pixlcore/xyops/commit/b01e5b8f14232fc75445284bb3476ed22ac76157): style.css: Add new styles for using ex_tree for testing monitor plugins.

## Version v0.9.16

> January 8, 2026

- [`742c66c`](https://github.com/pixlcore/xyops/commit/742c66c575671c8530b6ba2af5776761fc9077e1): Version 0.9.16
- [`cd00341`](https://github.com/pixlcore/xyops/commit/cd00341174b7a5a48c79bddfd14bbbde0ff7c74d): Fix: Properly handle case when satellite reboots while jobs are running.
- [`f3e72b2`](https://github.com/pixlcore/xyops/commit/f3e72b2a8209f48c80fcd8282eb834f65d751593): Fix: Socket ping death logic was not happening due to a typo

## Version v0.9.15

> January 8, 2026

- [`d480269`](https://github.com/pixlcore/xyops/commit/d4802698297637eba6b3e14a270484b1a09f3a57): Version 0.9.15
- [`266b729`](https://github.com/pixlcore/xyops/commit/266b7295bab868df24c8efdf9b36580bd7ef0e06): Fix: Crasher race condition when workflow is aborted on start due to event being disbled at the same time.  Fixes #34.
- [`d6d2f49`](https://github.com/pixlcore/xyops/commit/d6d2f49b757af4e266af9b080b3ab4bc429cae22): Test Event: Allow user to disable ALL actions and limits, even inherited ones -- for test jobs only.
- [`6f1c4aa`](https://github.com/pixlcore/xyops/commit/6f1c4aa6616218da953ff18080d8351d0f44ebfe): Marketplace: Tweak button style depending on installation status.

## Version v0.9.14

> January 7, 2026

- [`f7317db`](https://github.com/pixlcore/xyops/commit/f7317db0c34f9da9f6b8bf419e38126022e28f37): Version 0.9.14
- [`16ebe45`](https://github.com/pixlcore/xyops/commit/16ebe454df9b1772b72d0b7a569986dfe53b5430): Predict Upcoming Jobs: Support Trigger Plugins as modifiers
- [`4eed080`](https://github.com/pixlcore/xyops/commit/4eed0802f5343f1eeeb5627f2fca7640f33753d7): Marketplace: Add colors to status item
- [`2dd310c`](https://github.com/pixlcore/xyops/commit/2dd310cc679849864e1e0ae9c0ca34d66f2d3745): Fix: Group Process search feature crashing on user input
- [`124648d`](https://github.com/pixlcore/xyops/commit/124648df4ba031e94fabbd7fbd5db40e16a70bac): Config: Drop default satellite.config.debug_level to 5
- [`95c3b04`](https://github.com/pixlcore/xyops/commit/95c3b04e17965e0b6297e24b200bb3502c7c6daf): Changelog: Tweak styling of git hash links
- [`53c6897`](https://github.com/pixlcore/xyops/commit/53c6897b94d9684dceb9e3936dafbd9b8e3a1dab): Changelog Generator: Add more smarts

## Version v0.9.13

> January 7, 2026

- [`df79e54`](https://github.com/pixlcore/xyops/commit/df79e544e4e8c94dc7b567f5dc8ca8e743d351ec): Version 0.9.13
- [`54ed78e`](https://github.com/pixlcore/xyops/commit/54ed78ec1e1b53f9b8bc31c99e9de575992623e5): Job Detail Page: Only show "Run Again" button if job has an event, and event still exists.
- [`b1238b4`](https://github.com/pixlcore/xyops/commit/b1238b4a1ed01ef59a523460a5d15cc73fabc808): Fix: Crasher bug when "Delete Event" action is used.
- [`7054659`](https://github.com/pixlcore/xyops/commit/7054659c5d0efead647b6320b75f893922f8b6d6): System: Tweak color of test email success dialog title.
- [`6b66b77`](https://github.com/pixlcore/xyops/commit/6b66b77b489ef0610448a48df7cff80bda7956a8): Cosmetic: Fix plugin dependency markdown list when multiple types are present.
- [`2db9ccf`](https://github.com/pixlcore/xyops/commit/2db9ccf2fae1d31cb568c2e04bbe7c4b9edd3969): Feature: Send test email from system page.
- [`f27382d`](https://github.com/pixlcore/xyops/commit/f27382d3e65585c171de2e558242b5aefc7241b1): Self-Hosting Guide: Added a bind mount for the conf directory in the sample docker compose.
- [`b778075`](https://github.com/pixlcore/xyops/commit/b7780755d8735c93c135259db4a78a193ef0383c): Tickets: Drop email send debug level to 5
- [`873f918`](https://github.com/pixlcore/xyops/commit/873f9186969fdae83da1249b520bdf8ec3b28fa6): Fix: Descending date sort not working due a typo
- [`8c7092f`](https://github.com/pixlcore/xyops/commit/8c7092f11d6da6cf91fea425447efd48232eb7ca): Config Doc: Add Fastmail SMTP setup example

## Version v0.9.12

> January 7, 2026

- [`90c5044`](https://github.com/pixlcore/xyops/commit/90c504418c7431b43ee8f9230246e353b6492610): Version 0.9.12
- [`23ad69e`](https://github.com/pixlcore/xyops/commit/23ad69ea89312c3a4b07b852931fb5da0faeb64d): Marketplace: Try to "fix" inline image URLs in product READMEs, if they are relative links.
- [`ff81208`](https://github.com/pixlcore/xyops/commit/ff812086e36bcb968a33453aa22852b974da05fa): Marketplace: Show "Visit Repo..." button on product details page.

## Version v0.9.11

> January 6, 2026

- [`c70ccb6`](https://github.com/pixlcore/xyops/commit/c70ccb60986edda674e9e5fc0e96185db3a49a1d): Version 0.9.11
- [`2d6b1e6`](https://github.com/pixlcore/xyops/commit/2d6b1e60428d38508d8018ec0862c3cb095f1355): Add user content to job success/fail emails.
- [`27d5f37`](https://github.com/pixlcore/xyops/commit/27d5f37a0e0f3ad423d80e36a177d128de5a29c5): Suppress upgrade finish notifications, as the operations run in the background
- [`acd75a9`](https://github.com/pixlcore/xyops/commit/acd75a9637d9e4d9309175b6c18508f2237ea1e0): multiSetup: If current hostID is not found in master list, add it back in (and log a loud warning)

## Version v0.9.10

> January 6, 2026

- [`1ed3301`](https://github.com/pixlcore/xyops/commit/1ed330198af002f90f3c09554ab17522b4f16ab4): Trigger Plugin: Include STDOUT in level 9 debug log entry
- [`fa9ec91`](https://github.com/pixlcore/xyops/commit/fa9ec911caa7d5b90cb420ddbf730eddf51bffd0): Version 0.9.10
	- Bump pixl-request to v2.5.0 for retry delay feature
- [`e21a2aa`](https://github.com/pixlcore/xyops/commit/e21a2aa04a2212477e733de2fee0d2f14cf18b8c): Improve UX for updating or upgrading plugins.
- [`bdbbd92`](https://github.com/pixlcore/xyops/commit/bdbbd9272744e77fe79826ff410b37b0545126f0): Fix bug where "negative" Cronicle list pages were not imported.
- [`fdf4a68`](https://github.com/pixlcore/xyops/commit/fdf4a689036866f9b894fc77abfdd2faaf5ee073): Marketplace: Use exponential backoff for proxy request retries.
- [`8a5b718`](https://github.com/pixlcore/xyops/commit/8a5b718780f7dc708f542b0a235ffc34b226fa98): Marketplace: Add retries to origin API proxy requests

## Version v0.9.9

> January 5, 2026

- [`d8ab7cb`](https://github.com/pixlcore/xyops/commit/d8ab7cba2ccbd4aa5dcbffbfa818cdd5d4cfa71d): Version 0.9.9
- [`6a7cedf`](https://github.com/pixlcore/xyops/commit/6a7cedf29172aaec6b7f31d90b3676e57ec4b271): Improved user notification for saving / deleting plugins.
- [`7e3cb28`](https://github.com/pixlcore/xyops/commit/7e3cb28794b9f28bf43b58860b39c489b02b8286): Added a note on using job data in web hook macros
- [`9b32d06`](https://github.com/pixlcore/xyops/commit/9b32d067b605fa24ea889279032e775462d11042): Wording
- [`6a4e4ee`](https://github.com/pixlcore/xyops/commit/6a4e4ee97a32e1de9dcb428caf1d04666fab8da3): Added note regarding using an actual hostname that resolves on your network
- [`7e7141d`](https://github.com/pixlcore/xyops/commit/7e7141db99ec1d3002afa89ae53c7f1a0e4e73d7): Fix cosmetic issue where server group list is rendered incorrectly (rogue "true" is displayed instead of the comma separator).
- [`575aabd`](https://github.com/pixlcore/xyops/commit/575aabd08530370006205d065c76c540a8457900): Fix issue where quick-added tag isn't added to the menu right away.
- [`501cefa`](https://github.com/pixlcore/xyops/commit/501cefa0bce63a24e86ce0a63f1293ebba65e6f0): Fix issue with cloning events, where plugin resets back to shell.  Fixes #22
- [`9191365`](https://github.com/pixlcore/xyops/commit/91913653fc6cd9cc27ab4cbcca047a1cd6215ba6): When jobs change, sync all data to master peers right away (don't wait for next tick).
- [`22316a2`](https://github.com/pixlcore/xyops/commit/22316a2305d452e48ee08aaa10bfa3422e2b2b8f): Add blurb on starting xyops automatically on server reboot
- [`323a0aa`](https://github.com/pixlcore/xyops/commit/323a0aa40b7d4dfcc1e246370ea22383e9ef4904): Fix issue with load avg display when zero, and page desc disappearing when info refreshes
- [`b50e99f`](https://github.com/pixlcore/xyops/commit/b50e99f26bcfe23eb5e4cbf1b5585b6221c8942f): Add python3-setuptools to apt-get install (for sqlite3 install)
- [`3374f07`](https://github.com/pixlcore/xyops/commit/3374f073a68b02572b873da4a57119c9b7e25d25): Added note regarding compiler tools for manual install

## Version v0.9.8

> January 4, 2026

- [`3ea5db8`](https://github.com/pixlcore/xyops/commit/3ea5db82e0d14c69270484808694ab686888e562): Version 0.9.8
- [`a157333`](https://github.com/pixlcore/xyops/commit/a157333ad306599e663cb5afa47b9ebc0f2f6648): Add docker-compose YAML for quick-start
- [`446e30a`](https://github.com/pixlcore/xyops/commit/446e30ac9384faccae7f41bfea4990cf4ce7863e): Setting config prop `satellite.config.host` will now override the satellite bootstrap install one-liner command.
- [`3fed6b8`](https://github.com/pixlcore/xyops/commit/3fed6b8117da0902c97498cf0be09d820771cb73): Fix: Crasher when getJobHookData is called with a completed job (i.e. via ticket template fill)
- [`3ba8578`](https://github.com/pixlcore/xyops/commit/3ba8578bcb8b35237bf5999bf127e77395ea5061): Bump pixl-tools to v2.0.1
- [`dd835cd`](https://github.com/pixlcore/xyops/commit/dd835cd85c37a5b4b6d060e967ad98c1cbb3ca51): Implement Plugin Marketplace!
- [`ee2db7a`](https://github.com/pixlcore/xyops/commit/ee2db7a28fe9ad71dbc7709c9a0357d6636709fb): Fix: Combine jobDetails with job data in getJobHookData, so actions can have access to job output data.
- [`686415a`](https://github.com/pixlcore/xyops/commit/686415af1ab8dee90e7f6e108e80a8406b9da6ad): Move validateOptionalParams out to api.js, so other APIs can use it

## Version v0.9.7

> January 2, 2026

- [`340ff1b`](https://github.com/pixlcore/xyops/commit/340ff1b51fa44d0e4cdceeacd49327074bc6a818): Version 0.9.7
- [`74ee1ec`](https://github.com/pixlcore/xyops/commit/74ee1ec6af7118a1a59694df547e631a7be290b1): Rewrote Docker setup instructions for handling config files
- [`1afc5f1`](https://github.com/pixlcore/xyops/commit/1afc5f1afd9aeeef56faf159b61d775ec46b3260): Automatically copy over sample config on launch, if needed (i.e. for bind mounted config dir)
- [`21a9378`](https://github.com/pixlcore/xyops/commit/21a93784c14db1ca56dd9ded8d7a2c78a3ae1389): Change default secret key

## Version v0.9.6

> January 1, 2026

- [`9b290a6`](https://github.com/pixlcore/xyops/commit/9b290a681d6d9b346c521b827624bb0229c82d60): Version 0.9.6
- [`82db8c1`](https://github.com/pixlcore/xyops/commit/82db8c1e0bef67ec1ed92709db8d84a48e3bb18d): Bump pixl-xyapp to v2.1.18 for some mobile fixes.
- [`a9840a8`](https://github.com/pixlcore/xyops/commit/a9840a8fbd374958fac2f06afa452eeaf8468759): Configuration: Add preliminary marketplace config (WIP)
- [`536aa2d`](https://github.com/pixlcore/xyops/commit/536aa2d7310bd611ca608c0833a6b2556d0470ec): Fix reset buttons and A/V sliders on mobile.
- [`7dd5ae5`](https://github.com/pixlcore/xyops/commit/7dd5ae594f4d89d68f06f763e0052adeed0a4bfb): Fix edit buttons on mobile across multiple pages.
- [`f168e78`](https://github.com/pixlcore/xyops/commit/f168e785c1d4621b032fca173eeaadb9d75c2e03): Fix A/V adjustment sliders on mobile
- [`4a6fa1d`](https://github.com/pixlcore/xyops/commit/4a6fa1d4c1335821136403e06c270a8d2dd6921f): Event Editor: Tweak trigger table for mobile
- [`a8d6adb`](https://github.com/pixlcore/xyops/commit/a8d6adb5fb7eb913198b0139859b397e6fdc36ee): Event Editor: Tweak buttons for mobile
- [`16e27cf`](https://github.com/pixlcore/xyops/commit/16e27cf0eac10f59db4a2fdaf05e4c1aa10c4887): Hide box button floater on mobile
- [`f5a55e9`](https://github.com/pixlcore/xyops/commit/f5a55e9002df985b46b06ad4cd1b038a33d8d89b): Fix compact table buttons and empty rows on mobile
- [`e49f5df`](https://github.com/pixlcore/xyops/commit/e49f5df4cf9258e5f01de01228c7e074b510350c): My Settings: Escape key will reset AV adjustments
- [`17fb730`](https://github.com/pixlcore/xyops/commit/17fb73026f029a34fab0a16dd5f068ed02629b27): Doc index: Tweak wording a bit.
- [`5c835cd`](https://github.com/pixlcore/xyops/commit/5c835cd1ab11293ab42825e026438ab147f77a26): Correct location of unit test logs.
- [`86aa816`](https://github.com/pixlcore/xyops/commit/86aa8169cd7818da0e13d7c7d3f6fd2e1d548635): Tweak wording for hljs in colophon.
- [`ec55763`](https://github.com/pixlcore/xyops/commit/ec5576394c3e33efd7b8d15fed13ebab393eb439): Fix a couple of typos in the hosting guide.
- [`a297361`](https://github.com/pixlcore/xyops/commit/a297361e5ccf1a73164219ac5adcadea91671299): Reworded the "coming soon" professional service offerings.
- [`e9106b0`](https://github.com/pixlcore/xyops/commit/e9106b0e59cc645e38068bdc196e5fe5d78c239f): Added "coming soon" labels on the upcoming cloud and enterprise offerings.

## Version v0.9.5

> December 31, 2025

- [`3388e85`](https://github.com/pixlcore/xyops/commit/3388e85c453db3ffbeced5b1acc4ff203ca39c3f): Version 0.9.5
- [`2ca5162`](https://github.com/pixlcore/xyops/commit/2ca516247f8887d00045124a55ddb29e4b7bc54a): Fix issue where files could arrive without being uploaded.
- [`c23a075`](https://github.com/pixlcore/xyops/commit/c23a0758af1e63ed37fdc6d9c44d37173382cf58): Reconfigure local satellite to connect to hostID, not "localhost" (breaks xyRun)

## Version v0.9.4

> December 31, 2025

- [`85a9875`](https://github.com/pixlcore/xyops/commit/85a9875d6e3f0734495ecbd20bf0fee3a0ffb9bc): Version 0.9.4
- [`19d0458`](https://github.com/pixlcore/xyops/commit/19d0458af157feab250e207187dd65fba0542d0d): Fix: Toolset fields need to support new JSON type, and number variant
- [`22e0b7e`](https://github.com/pixlcore/xyops/commit/22e0b7ec07da59b5e5ca7abe37d6b873ef7dccb1): Run as root inside the container, so we can access /var/run/docker.sock
- [`08060b7`](https://github.com/pixlcore/xyops/commit/08060b786f8b2570fec286987ae8d2587d00e1e7): Fix issue where conductor self-upgrade sleeps for full stagger amount even if no other servers were upgraded.

## Version v0.9.3

> December 30, 2025

- [`d341dee`](https://github.com/pixlcore/xyops/commit/d341dee3c36f3f87453c88bbb47f64292bc1d641): Version 0.9.3
- [`349d71e`](https://github.com/pixlcore/xyops/commit/349d71ea1d9ba5901c2e1036fd4011818949bf8f): Added docs on new JSON parameter type, and clarification on number parameter variant parsing behavior.
- [`715f3c7`](https://github.com/pixlcore/xyops/commit/715f3c786a3a60d980bdf5a017460ea0ad5c0c2f): Added changelog, with auto generator script.

## Version v0.9.2

> December 30, 2025

- [`029a96a`](https://github.com/pixlcore/xyops/commit/029a96aebd721fe565b1b5c8f2b661564c9017f3): Version 0.9.2
- [`0ed4aab`](https://github.com/pixlcore/xyops/commit/0ed4aaba9159ba3ee8c0fb55172650f164defc6d): Cleanup internal job report, so markdown list doesn't break
- [`aa9caa8`](https://github.com/pixlcore/xyops/commit/aa9caa8cb6c001d20990f34388ab3c0a25a1cb3a): Tweak directory permissions, for self upgrades to work properly.

## Version v0.9.1

> December 30, 2025

- [`d1c00fc`](https://github.com/pixlcore/xyops/commit/d1c00fc5558b7f1e3cb2885f2a17cf9f21a5af14): Version 0.9.1
	- Add auto-changelog dev dep
- [`094f785`](https://github.com/pixlcore/xyops/commit/094f785bca2b04b6916d7e269ee5bcb7abced2d2): Add JSON param type, and also parse number variants as numbers.
- [`6cfd035`](https://github.com/pixlcore/xyops/commit/6cfd035f16283f120b0ec0be725377d9afdef4b5): Fix typo in macro expansion example
- [`381f8bb`](https://github.com/pixlcore/xyops/commit/381f8bb4632bd2c109785bfb192a69078cf9d0fb): Add debug logging to api_get_master_releases
- [`23af35b`](https://github.com/pixlcore/xyops/commit/23af35b4cf9a91afeb0e505c6b9168333c8afcf4): Tweak column names
- [`ed9e1b2`](https://github.com/pixlcore/xyops/commit/ed9e1b20bee7a284247355b630ed8232b1a2c22a): Add icons to table
- [`9db61dc`](https://github.com/pixlcore/xyops/commit/9db61dc61a2b3a4d202000efbedc3d425d427733): Add default search presets to stock admin account
- [`7864a84`](https://github.com/pixlcore/xyops/commit/7864a844919b7f62891ce3786506d98524f9ba8e): Conductors page: Only call addPageDescription on onActivate, not every call to render_masters

## Version v0.9.0

> December 29, 2025

- Initial beta release!
