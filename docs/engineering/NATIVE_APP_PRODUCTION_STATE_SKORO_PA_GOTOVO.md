# Native app - production state skoro pa gotovo

Date: 2026-11-08 (Europe/Zagreb). Explicit user-selected Native production
continuation/recovery checkpoint. Immutable annotated tag:
`native-app-production-state-skoro-pa-gotovo`. Branch: `main`.

## Identity and scope

Active project: `native/standalone/Stack to Six.xcodeproj`; normal scheme:
`Stack to Six`; bundle: `com.taptapdesign.stacktosix.native`. Swift gameplay,
UIKit/SpriteKit/Metal presentation and Native-owned persistence remain the active
production graph, without a web gameplay fallback.

This checkpoint saves the complete current project work since
`production-95-percent-ready`, including modified/new Native sources, regression
tests, runtime ownership records, original production artwork, documentation,
development-only design candidates and HTML editor prototypes. The user's
milestone title is not independent App Store, performance or physical acceptance.

## Included work

- Shared Native navigation and route lifecycle refinements: continuous and
  retargetable transitions, standard entry/exit sequencing, atomic route
  handoff and background preparation ownership. Journey Hub, Settings and all
  three Worlds retain the shared locked 66pt navigation content height.
- Gameplay HUD/divider and preload integration from the selected Six LAB
  experiment: NativePreloadBarPresentation, curved divider/material, reveal
  masking, bounded spring entry, coordinated HUD travel, finite restart bounce,
  fast restart sequencing, existing Reduced Motion and generation cleanup.
- iPhone and iPad HUD refinements: trophy score follows the header arc, stable
  score/combo values and touch geometry, equal tablet icon spacing, tablet
  layout and modal parity. Device-specific changes preserve the other idiom.
- Modal paper, Close/material and animation refinements across Settings,
  Arcade, result/exit and collection surfaces; original artwork is preserved.
- Studio intro exit-center correction for all current character selections,
  including the dog artwork's authored entry pivot; selected frame playback,
  existing timings and resource retirement remain owned by the current graph.
- Forest End of Road, Beach Closed and Area 55 No Trespassing ending artwork,
  original 1x/2x densities, matching aspect ratios, associated cloud placement,
  viewport/scroll/resource ownership and phone/tablet-specific final offsets.
- Beach BONKERS (05) and FLY AWAY (09) common/legendary original artwork refresh,
  plus current navigation, preload and ordinary-modal paper assets.
- Expanded mounted Native tests for route interruption, modal lifecycle, HUD
  presentation, restart, first-play bootstrap, tablet layout, Journey endings,
  intro character centers, resource cleanup and stable input geometry.
- Feature/runtime and Journey animation contracts, plus detailed implementation
  and delivery evidence in CURRENT_HANDOFF.md.
- Development-only domino-meter Board, Cube and Modal HTML editor prototypes,
  artwork proposals, render candidates and related export assets. These files
  remain separate from production resource roots and are not all approved art.
- Six LAB has been retired at the user's request: its isolated Native worktree,
  branch and dedicated Simulator were removed. Selected integrated main Native
  functionality and the separate saved development prototypes remain preserved.

## Delivery evidence and limits

The existing current-tree delivery receipts record a normal Debug build and
install-over/normal launch on the retained Jimi iPhone Simulator
`1018BE2D-491B-465F-8F75-3E5BEB38C22A`. Latest recorded phone correction:
`/tmp/native-beach-phone-right-20261108/main-delivery.json`, matching built and
installed binaries, stable production inputs, no XCTest PlugIns or Web.bundle,
and both canonical saves unchanged through initial launch.

Existing dual-device receipt:
`/tmp/native-ipad-refresh-20261108/final-verification.json`, retained iPhone and
existing iPad Simulator `43A75086-0C64-464C-B71C-FDD01AF59C32`, matching normal
installed apps and stable production inputs. Subsequent focused changes and
receipt scopes remain in CURRENT_HANDOFF.md; the two installed devices must not
be assumed to contain an identical latest binary. This publication does not
perform a new build, installation or physical-device test.

Current user acceptance establishes this as the new Native continuation state.
Physical touch, audio/haptics, sustained frame pacing, temperature, App Store
readiness and remaining parity limits retain their existing explicit scope:
NEEDS PHYSICAL TEST where no current physical evidence exists.

## Publication validation

PASS: complete `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full` and `npm run qa:ios`
for this checkpoint. All 20 full deterministic gates passed, including gameplay
KING, runtime admission, TypeScript, lint, all source tests, production web output
without Native/PWA sync, visual/bundle and Native source/target contracts.
PASS: Git diff hygiene, payload size and staged credential-pattern checks.
Raw logs: `/tmp/native-production-almost-done-20261108/qa-full.log` and `qa-ios.log`.
No preserved PWA bundle sync, legacy shell operation, App Store/TestFlight upload,
Simulator reset or save migration is part of this publication.

The unrelated local contract PDF
`output/pdf/TAP_TAP_DESIGN_Prijedlog_dopune_ugovora.pdf` stays outside the payload,
consistent with prior checkpoint publications. Ignored generated NativeAssets,
Web.bundle, dist, build products/caches and private save backups are not Git
payload. Production originals and scripts needed to regenerate packaged assets
are included; built and installed apps remain separate from source recovery.

## Cleanup after publication

Only after remote branch and annotated-tag identities are verified, remove the
explicitly inventoried inactive old build/cache outputs, old PWA build/archive
and byte-verified duplicate temporary Web.bundle copies. Keep the newest main
Native build root `/tmp/home-bottom-nav-normal-derived`, production sources,
original assets, retained PWA source/bundle, installed applications, Simulator
data, both canonical save files, Git history and all historical benchmark tags.
Cleanup receipts and actual reclaimed storage are recorded separately afterward.

This tag supersedes `production-95-percent-ready` for Native continuation.
All historical Native tags and the separate PWA `production-benchmark-v9`
remain immutable. No force push or tag replacement.
