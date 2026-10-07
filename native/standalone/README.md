# Stack to Six Native — separate development app

User-authorized on 2026-10-06; designated the main development project on
2026-10-07. Goal: **100% native**, including gameplay, rules and persistence.
See [the migration plan](../../docs/engineering/NATIVE_100_PERCENT_PLAN.md).
`native-benchmark-v1` preserves the starting source. This starting implementation
is still hybrid; production-benchmark-v9 remains the preserved PWA reference.

- Display name: **Stack to Six Native**.
- Bundle ID: `com.taptapdesign.stacktosix.native` (separate sandbox/save).
- Project: `native/standalone/Stack to Six.xcodeproj`; scheme `Stack to Six`.
- UIKit Home/Hub and native soundtrack are enabled by this exact bundle identity,
  including ordinary launches from the phone icon. No Simulator launch flags needed.
- Swift presentation/audio implementations are shared directly from `../jimi-2026`.
- Gameplay and progression remain in the complete web runtime.
- Main Settings, its three switches, authored enter/exit, Back and Privacy Policy
  modal now use UIKit/CoreAnimation, including v10 pill/knob toggles and the centered textured Privacy card. Existing `_settings`/`saveSettings` and
  soundtrack/SFX/haptic owners remain authoritative. Internal DEV tools are an
  explicit web diagnostic escape; Back to main restores native Settings.
- Arcade Home hero, CTA, tabs and swipe use UIKit. Play now delegates directly
  to canonical gameplay after native exit, without preparing a web Home copy.
- User authorized all three Native Debug iPhone Worlds on2026-10-06. Forest,
  Beach and Area55 use shared UIKit presentation on ordinary icon launches.
  QA Simulator retains `--jimi-native-forest` and `--jimi-native-worlds` opt-ins.
  Release Worlds remain disabled. Physical performance acceptance is separate.
- Existing `com.taptapdesign.stacktosix.Stack-to-Six` installation is separate.
  Never uninstall it or copy/reset its save as part of this experiment.

## Reproducible preparation

Run `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full` from the repo root. It builds
the complete normal web payload without updating the original native project.
Copy `dist` to `native/standalone/Stack to Six/Web.bundle` with `ditto`; this
generated bundle is ignored by Git. Build this project only. Verify final plist
identity, signing, complete assets and entry hash before installing exclusively
on the user-authorized iPhone 13 blue. Do not use the original bundle sync command.

## Recovery and acceptance

`pre-native-main-2026-10-06` preserves prior main; `pre-native-ui-2026-10-06`
preserves the last committed Jimi source before UIKit work (not a stable baseline).
`production-benchmark-v9` remains the accepted complete baseline, unchanged.
Git recovery restores code, not device save migrations. This separate app begins
with its own save/tutorial; the original app retains its own progress.

Open findings: Simulator audio inaudible even with an independent native player;
Settings apparent duplicate entry and Homepage vertical handoff jump. Physical
audio, sustained fluidity and complete terminal flows are not accepted yet.
