# Native benchmark v20 — GitHub and cable delivery receipt

2026-10-30. User-approved production benchmark: **Journey modal card**.
Payload commit/tag: `40baa98aea1bc055e65d4eb05408348e4d658e7b` /
`native-benchmark-v20`. Main fast-forwarded and main/tag atomically published to
`taptapdesign-jimi/cube-crash-appstore`; remote main and peeled tag verified.
The tag remains immutable; this receipt adds documentation only.

- Fresh `qa:full` PASS with PWA sync disabled:530 suites/4010 tests plus KING24 suites/330 tests.
- Fresh `qa:ios` PASS. Signed normal Release built directly from saved main: BUILD SUCCEEDED.
- Final compiled Native asset/dependency audit and strict deep codesign verification PASS.
- Exact `com.taptapdesign.stacktosix.native`, no Web.bundle, PlugIns or WebKit/JavaScriptCore dependency.
- iPhone13blue reverified immediately before installation with `transportType:wired`.
- Latest Native process stopped; both canonical saves backed up; explicit install-over confirmed.
- Exact Native bundle launched normally; newly installed executable running PID69306.
- Both `state-v1.json` and `state-v1.previous.json` byte-identical before install, after install and after normal launch.

Executable SHA256:
`46a35651ed2ce3f22125bd929842b81f6d0eac2fc46201666ba8d9586de388dd`.
Private device/save evidence:`/tmp/native-v20-delivery/receipt.json`; source/build/
audit logs:`/tmp/native-v20-{full,ios,release-main,release-audit,signature}.log`.
Outgoing1134blob credential-pattern scan PASS, no findings. No private app data,
credentials or build products included in Git. Seven preexisting protected
original-asset local deletions remain excluded; their committed originals survive.

Verdict: deterministic/source/build/delivery **PASS**. Physical animation feel,
touch, speaker mix, sustained FPS/thermal acceptance **NEEDS PHYSICAL TEST**.
No new mounted UIKit acceptance test or Simulator implementation refresh in this
checkpoint task; retained Simulator remains the preceding current normal Debug
preview. No uninstall/reset, PWA/legacy operation or TestFlight/App Store upload.
