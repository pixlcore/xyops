# xyOps Changelog

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

## Version v0.9.57

> February 5, 2026

- [`d0d461e`](https://github.com/pixlcore/xyops/commit/d0d461ea8837f8a283202973485941a450351bc7): Version 0.9.57
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
