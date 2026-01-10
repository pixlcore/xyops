# xyOps Changelog

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
