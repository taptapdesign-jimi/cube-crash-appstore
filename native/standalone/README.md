# Stack to Six Native — active development app

User-authorized on 2026-10-06 and designated the main development project on
2026-10-07. Goal: **100% native**, including gameplay, rules and persistence.
See [the migration plan](../../docs/engineering/NATIVE_100_PERCENT_PLAN.md) and
[current handoff](../../docs/engineering/CURRENT_HANDOFF.md) for remaining work.

- Display name: **Stack to Six Native**.
- Bundle ID: `com.taptapdesign.stacktosix.native`, with its own sandbox/save.
- Project: `native/standalone/Stack to Six.xcodeproj`; scheme `Stack to Six`.
- Actual storyboard root: `NativeStandaloneViewController -> NativeBootstrap`.
- Gameplay/state/save are Swift; presentation is UIKit/SpriteKit. Shared UIKit
  Home/Hub/World/Settings and native audio owners remain connected.
- Archived `GameViewController.swift` and `Web.bundle` are excluded from app
  target membership. Native startup has no web fallback.
- `NativeAssets.bundle` contains byte-identical original artwork/audio.
- Normal storyboard launches select the complete Swift Source-fidelity graph.
  DEBUG hosted unit-test roots isolate explicit fixtures. Source means the Swift
  port of preserved rules; it does not add a JavaScript runtime. Remaining
  behavioral and physical acceptance is tracked in the current handoff.

## Preparation and validation

Run `npm run qa:ios` before a Native build. This checks the active standalone
project, Native identity/root/membership and original Native asset bytes.
`npm run qa:ios:source` is the fast source guard. Native preparation needs no
`dist` or `Web.bundle`. If asset preparation is required, the explicit
`node scripts/prepare-native-artwork.mjs` copies original bytes only.

`npm run release:native-audit -- --built-app <Release-app-path>` verifies actual
compiled host/framework dependencies and packaged original assets. It rejects
WebKit/JavaScriptCore and a web entry. The private DEBUG QA producer can link
WebKit and intentionally fails this shipping dependency gate; use Release for
shipping evidence. Build identity, source parity, signing and physical acceptance
are distinct checks.

Transitional web QA uses `SKIP_NATIVE_BUNDLE_SYNC=true`. `qa:ios:pwa` is the
separate preserved-PWA audit and is not a Native prerequisite. Never sync/build/
install `/Users/user/Stack to Six`, uninstall it or copy/reset its saves as a
Native side effect. The legacy Kockice shell is never an implicit target.

## Recovery and acceptance

`native-benchmark-v1` preserves the starting checkpoint, not complete native
acceptance. `production-benchmark-v9` remains the accepted PWA reference.
`pre-native-main-2026-10-06` and `pre-native-ui-2026-10-06` preserve earlier code.
Git recovery does not restore device saves. Preserve current dirty migration
work and the Native app's existing sandbox; QA fresh profiles are not for phones.

Unsigned Release/source/Simulator evidence does not prove physical touch,
audio, thermal behavior, signing or App Store readiness. Final Native acceptance
requires the complete migration plan and explicit user physical acceptance.
