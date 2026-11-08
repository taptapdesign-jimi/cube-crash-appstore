# Production ready v1

Date: 2026-11-08 (Europe/Zagreb). User-selected complete Native project
benchmark, requested for online Git preservation. Immutable annotated tag:
`production-ready-v1`. Branch: `main`.

## Recovery identity

Repository: https://github.com/taptapdesign-jimi/cube-crash-appstore

Active project: `native/standalone/Stack to Six.xcodeproj`; scheme:
`Stack to Six`; bundle: `com.taptapdesign.stacktosix.native`.
Swift gameplay and UIKit/SpriteKit/Metal UI remain the active Native graph.

This benchmark supersedes `native-app-production-state-skoro-pa-gotovo` for
Native continuation. All historical Native and PWA tags remain immutable.
The separate approved PWA recovery point remains `production-benchmark-v9`.

To inspect/recover the exact saved source without moving the benchmark:

```sh
git fetch origin --tags
git switch --detach production-ready-v1
```

Create a new branch before making further changes from that detached checkpoint.

## Saved project scope

Complete current project changes since the previous checkpoint, including:

- Native gameplay/HUD entry and continued Arcade round ownership, restart/new
  game old/new board handoff, Source clock admission, and foreground recovery.
- Preload holder fully opens before restored liquid fills; canonical charge,
  generation cleanup, existing scene clock and Reduced Motion stay authoritative.
- Beach Ball uses Mushroom's refill count/cell arrangement while preserving its
  authored media, legacy-save compatibility and final-merge ownership.
- Shared navigation/title/caption motion, Backpack/Box geometry and lifecycle,
  Stage info CTA/order/return/contact motion, Home phone cloud distribution,
  tablet-specific layout and HUD refinements.
- Result and Journey info earned-star burn with uniform original-alpha
  highlighting; empty stars retain their original artwork. Result-star shimmer
  was removed by the later user instruction; existing CTA shimmer is retained.
- Reward, sound/runtime/resource ownership refinements, focused mounted Native
  regression tests, gameplay/state tests, architecture admission records,
  current contracts and detailed implementation/delivery documentation.
- Existing tracked source, original artwork/audio, development prototypes,
  reference material and project configuration remain preserved in Git history.

No source cleanup, artwork replacement, save reset, device installation or
additional deletion is part of this checkpoint publication.

## Current delivery evidence

Latest recorded normal Native Debug preview:
`/tmp/native-holder-before-fill-20261108/`, retained Jimi QA iPhone Simulator
`1018BE2D-491B-465F-8F75-3E5BEB38C22A`, normal launch PID88103.
The handoff records matching Native bundle/binaries/production inputs, no test
PlugIns or Web.bundle, both canonical saves preserved, actual Silent Mode ON.
Publication preserves that installed app; no new build/install is required.

Earlier focused work and actual mounted visual checks remain documented in
CURRENT_HANDOFF.md, NATIVE_PHONE_BUGFIX_CHECKLIST_2026-11-08.md and
NATIVE_RESTART_FLASH_REPAIR_2026-11-08.md. The inherited broader standalone Core
assertion debt documented in the phone checklist remains historical evidence;
publication does not claim a fresh all-Core pass or new physical-device test.

The user-selected milestone title records acceptance of the current project.
Unmeasured physical feel, sustained FPS/temperature, audio/touch and final
App Store release checks retain their documented acceptance boundaries.

## Publication validation

Publication check: `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full` completed
with 19/20 gates PASS. All 530 source suites / 4011 tests and Gameplay KING
330 tests PASS, as do TypeScript/lint, runtime/admission, visual contracts,
built bundle/startup and Native source/target guards. `npm run qa:ios` PASS.
The sole FAIL is production postbuild copying assets into ignored dist: ENOSPC
(disk full). This is not an uninterrupted full-QA/production-build PASS. Only
this attempt's incomplete ignored dist was removed afterward; original assets,
current Native build/installed app and player saves were retained.

PASS: diff hygiene, changed-payload size and credential-pattern preflight.
Raw logs and publication receipts:
`/tmp/native-production-ready-v1-20261108/`.

## Payload boundaries

All modified tracked project files and new project engineering documents are
included. The unrelated private contract PDF
`output/pdf/TAP_TAP_DESIGN_Prijedlog_dopune_ugovora.pdf` stays local, consistent
with the previous benchmark. Ignored generated build products, packaged asset
copies, caches, dist/Web.bundle and private Simulator save backups are not Git
payload. Production original assets and regeneration scripts stay preserved.

Source recovery in Git is separate from installed apps and player data.
No force push, historical-tag replacement, PWA sync or legacy-shell operation.

## Verified online publication

Checkpoint commit: `052050d23dd445a7d05c847c56c49785cdeeba8d`.
Annotated tag object: `81f2fe4907da06454cf33396214de1e7535c59a0`.

Atomic push of main and the new tag succeeded. Independent `git ls-remote`
confirmed the branch and peeled tag at the checkpoint and preserved all 341
previous remote tag refs (including peeled refs). A documentation-only follow-up
records publication on main; the immutable benchmark remains at the checkpoint.

[Online benchmark](https://github.com/taptapdesign-jimi/cube-crash-appstore/tree/production-ready-v1)
