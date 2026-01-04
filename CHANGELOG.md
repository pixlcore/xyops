# xyOps Changelog

## Version v0.9.8

> January 4, 2026

- [3ea5db8](https://github.com/pixlcore/xyops/commit/3ea5db82e0d14c69270484808694ab686888e562): Version 0.9.8
- [a157333](https://github.com/pixlcore/xyops/commit/a157333ad306599e663cb5afa47b9ebc0f2f6648): Add docker-compose YAML for quick-start
- [446e30a](https://github.com/pixlcore/xyops/commit/446e30ac9384faccae7f41bfea4990cf4ce7863e): Setting config prop `satellite.config.host` will now override the satellite bootstrap install one-liner command.
- [3fed6b8](https://github.com/pixlcore/xyops/commit/3fed6b8117da0902c97498cf0be09d820771cb73): Fix: Crasher when getJobHookData is called with a completed job (i.e. via ticket template fill)
- [3ba8578](https://github.com/pixlcore/xyops/commit/3ba8578bcb8b35237bf5999bf127e77395ea5061): Bump pixl-tools to v2.0.1
- [dd835cd](https://github.com/pixlcore/xyops/commit/dd835cd85c37a5b4b6d060e967ad98c1cbb3ca51): Implement Plugin Marketplace!
- [ee2db7a](https://github.com/pixlcore/xyops/commit/ee2db7a28fe9ad71dbc7709c9a0357d6636709fb): Fix: Combine jobDetails with job data in getJobHookData, so actions can have access to job output data.
- [686415a](https://github.com/pixlcore/xyops/commit/686415af1ab8dee90e7f6e108e80a8406b9da6ad): Move validateOptionalParams out to api.js, so other APIs can use it

## Version v0.9.7

> January 2, 2026

- [340ff1b](https://github.com/pixlcore/xyops/commit/340ff1b51fa44d0e4cdceeacd49327074bc6a818): Version 0.9.7
- [74ee1ec](https://github.com/pixlcore/xyops/commit/74ee1ec6af7118a1a59694df547e631a7be290b1): Rewrote Docker setup instructions for handling config files
- [1afc5f1](https://github.com/pixlcore/xyops/commit/1afc5f1afd9aeeef56faf159b61d775ec46b3260): Automatically copy over sample config on launch, if needed (i.e. for bind mounted config dir)
- [21a9378](https://github.com/pixlcore/xyops/commit/21a93784c14db1ca56dd9ded8d7a2c78a3ae1389): Change default secret key

## Version v0.9.6

> January 1, 2026

- [9b290a6](https://github.com/pixlcore/xyops/commit/9b290a681d6d9b346c521b827624bb0229c82d60): Version 0.9.6
- [82db8c1](https://github.com/pixlcore/xyops/commit/82db8c1e0bef67ec1ed92709db8d84a48e3bb18d): Bump pixl-xyapp to v2.1.18 for some mobile fixes.
- [a9840a8](https://github.com/pixlcore/xyops/commit/a9840a8fbd374958fac2f06afa452eeaf8468759): Configuration: Add preliminary marketplace config (WIP)
- [536aa2d](https://github.com/pixlcore/xyops/commit/536aa2d7310bd611ca608c0833a6b2556d0470ec): Fix reset buttons and A/V sliders on mobile.
- [7dd5ae5](https://github.com/pixlcore/xyops/commit/7dd5ae594f4d89d68f06f763e0052adeed0a4bfb): Fix edit buttons on mobile across multiple pages.
- [f168e78](https://github.com/pixlcore/xyops/commit/f168e785c1d4621b032fca173eeaadb9d75c2e03): Fix A/V adjustment sliders on mobile
- [4a6fa1d](https://github.com/pixlcore/xyops/commit/4a6fa1d4c1335821136403e06c270a8d2dd6921f): Event Editor: Tweak trigger table for mobile
- [a8d6adb](https://github.com/pixlcore/xyops/commit/a8d6adb5fb7eb913198b0139859b397e6fdc36ee): Event Editor: Tweak buttons for mobile
- [16e27cf](https://github.com/pixlcore/xyops/commit/16e27cf0eac10f59db4a2fdaf05e4c1aa10c4887): Hide box button floater on mobile
- [f5a55e9](https://github.com/pixlcore/xyops/commit/f5a55e9002df985b46b06ad4cd1b038a33d8d89b): Fix compact table buttons and empty rows on mobile
- [e49f5df](https://github.com/pixlcore/xyops/commit/e49f5df4cf9258e5f01de01228c7e074b510350c): My Settings: Escape key will reset AV adjustments
- [17fb730](https://github.com/pixlcore/xyops/commit/17fb73026f029a34fab0a16dd5f068ed02629b27): Doc index: Tweak wording a bit.
- [5c835cd](https://github.com/pixlcore/xyops/commit/5c835cd1ab11293ab42825e026438ab147f77a26): Correct location of unit test logs.
- [86aa816](https://github.com/pixlcore/xyops/commit/86aa8169cd7818da0e13d7c7d3f6fd2e1d548635): Tweak wording for hljs in colophon.
- [ec55763](https://github.com/pixlcore/xyops/commit/ec5576394c3e33efd7b8d15fed13ebab393eb439): Fix a couple of typos in the hosting guide.
- [a297361](https://github.com/pixlcore/xyops/commit/a297361e5ccf1a73164219ac5adcadea91671299): Reworded the "coming soon" professional service offerings.
- [e9106b0](https://github.com/pixlcore/xyops/commit/e9106b0e59cc645e38068bdc196e5fe5d78c239f): Added "coming soon" labels on the upcoming cloud and enterprise offerings.

## Version v0.9.5

> December 31, 2025

- [3388e85](https://github.com/pixlcore/xyops/commit/3388e85c453db3ffbeced5b1acc4ff203ca39c3f): Version 0.9.5
- [2ca5162](https://github.com/pixlcore/xyops/commit/2ca516247f8887d00045124a55ddb29e4b7bc54a): Fix issue where files could arrive without being uploaded.
- [c23a075](https://github.com/pixlcore/xyops/commit/c23a0758af1e63ed37fdc6d9c44d37173382cf58): Reconfigure local satellite to connect to hostID, not "localhost" (breaks xyRun)

## Version v0.9.4

> December 31, 2025

- [85a9875](https://github.com/pixlcore/xyops/commit/85a9875d6e3f0734495ecbd20bf0fee3a0ffb9bc): Version 0.9.4
- [19d0458](https://github.com/pixlcore/xyops/commit/19d0458af157feab250e207187dd65fba0542d0d): Fix: Toolset fields need to support new JSON type, and number variant
- [22e0b7e](https://github.com/pixlcore/xyops/commit/22e0b7ec07da59b5e5ca7abe37d6b873ef7dccb1): Run as root inside the container, so we can access /var/run/docker.sock
- [08060b7](https://github.com/pixlcore/xyops/commit/08060b786f8b2570fec286987ae8d2587d00e1e7): Fix issue where conductor self-upgrade sleeps for full stagger amount even if no other servers were upgraded.

## Version v0.9.3

> December 30, 2025

- [d341dee](https://github.com/pixlcore/xyops/commit/d341dee3c36f3f87453c88bbb47f64292bc1d641): Version 0.9.3
- [349d71e](https://github.com/pixlcore/xyops/commit/349d71ea1d9ba5901c2e1036fd4011818949bf8f): Added docs on new JSON parameter type, and clarification on number parameter variant parsing behavior.
- [715f3c7](https://github.com/pixlcore/xyops/commit/715f3c786a3a60d980bdf5a017460ea0ad5c0c2f): Added changelog, with auto generator script.

## Version v0.9.2

> December 30, 2025

- [029a96a](https://github.com/pixlcore/xyops/commit/029a96aebd721fe565b1b5c8f2b661564c9017f3): Version 0.9.2
- [0ed4aab](https://github.com/pixlcore/xyops/commit/0ed4aaba9159ba3ee8c0fb55172650f164defc6d): Cleanup internal job report, so markdown list doesn't break
- [aa9caa8](https://github.com/pixlcore/xyops/commit/aa9caa8cb6c001d20990f34388ab3c0a25a1cb3a): Tweak directory permissions, for self upgrades to work properly.

## Version v0.9.1

> December 30, 2025

- [d1c00fc](https://github.com/pixlcore/xyops/commit/d1c00fc5558b7f1e3cb2885f2a17cf9f21a5af14): Version 0.9.1
- [094f785](https://github.com/pixlcore/xyops/commit/094f785bca2b04b6916d7e269ee5bcb7abced2d2): Add JSON param type, and also parse number variants as numbers.
- [6cfd035](https://github.com/pixlcore/xyops/commit/6cfd035f16283f120b0ec0be725377d9afdef4b5): Fix typo in macro expansion example
- [381f8bb](https://github.com/pixlcore/xyops/commit/381f8bb4632bd2c109785bfb192a69078cf9d0fb): Add debug logging to api_get_master_releases
- [23af35b](https://github.com/pixlcore/xyops/commit/23af35b4cf9a91afeb0e505c6b9168333c8afcf4): Tweak column names
- [ed9e1b2](https://github.com/pixlcore/xyops/commit/ed9e1b20bee7a284247355b630ed8232b1a2c22a): Add icons to table
- [9db61dc](https://github.com/pixlcore/xyops/commit/9db61dc61a2b3a4d202000efbedc3d425d427733): Add default search presets to stock admin account
- [7864a84](https://github.com/pixlcore/xyops/commit/7864a844919b7f62891ce3786506d98524f9ba8e): Conductors page: Only call addPageDescription on onActivate, not every call to render_masters

## Version v0.9.0

> December 29, 2025

- Initial beta release!
