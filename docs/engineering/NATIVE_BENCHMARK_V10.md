# Native benchmark v10 — complete Native checkpoint

User-requested complete current working-tree checkpoint on main, 2026-10-22.
Repository: https://github.com/taptapdesign-jimi/cube-crash-appstore
Immutable recovery tag: `native-benchmark-v10`.

This checkpoint includes all tracked and non-ignored work since Native v9:
Arcade-only Baloon dice, supplied artwork/audio and speech, balloon finale/idle,
coin-to-trophy motion, Honey/Clean Board transition bees, cloud lifecycle,
Native rendering and dice presentation improvements, Journey ambient/reward
and navigation/audio polish, tests, scripts and runtime ownership documentation.
The temporary first Endurance Baloon drop remains enabled for user review.
Supplied original assets are preserved; this publication does not transform art.

This is a Native development recovery checkpoint, separate from preserved PWA
production benchmarks. It does not establish release readiness or physical
visual, audio, FPS or thermal acceptance. Remaining issues and specific Native
Simulator receipts are recorded in CURRENT_HANDOFF.md. No phone installation,
Simulator change, PWA operation or production deployment is part of publication.
Build outputs, ignored runtime logs, credentials and player saves are excluded.

## Validation

Fresh checkpoint gates: full QA with SKIP_NATIVE_BUNDLE_SYNC=true, Native target
bundle audit (qa:ios), gameplay Core and State/save packages. PASS: all selected deterministic full-QA gates, 530 suites / 4010 tests;
qa:ios active Native target audit; Core 516 tests and State/save 79 tests,
all with zero failures. Logs: /tmp/native-benchmark-v10-{full,ios,core,state}.log.
Remote publication hashes are recorded below after verification. Existing Native
SDK/Simulator receipts for the included changes remain in CURRENT_HANDOFF.md.

The annotated tag identifies the complete payload. A later documentation-only
publication receipt on main records verified hashes without moving the tag or
any older Native/PWA benchmark.
