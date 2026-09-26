# Production Benchmark v6

Date: 2026-09-26

## Identity

- Product: Stack to Six
- Source version: `2.0.653`
- Canonical branch: `main`
- Immutable tag: `production-benchmark-v6`
- Complete content checkpoint: `48c65f6a` (`release: establish production benchmark v6`)
- Previous approved complete baseline: `production-benchmark-v5`
- Native target: `/Users/user/Stack to Six/Stack to Six.xcodeproj`
- Bundle identifier: `com.taptapdesign.stacktosix.Stack-to-Six`
- Physical target: `iPhone 13 blue`
- Installed entrypoint SHA-256: `39f02fca7b3d2c76e0d7a5fd3984e11a58ea6d27328adc0c8e6cf61d755318d3`

## Complete change record

This benchmark captures the complete repository state explicitly promoted by
the user after the Beach asset refresh and the 2026-09-25/26 thermal, audio,
Journey, reward-screen and lifecycle investigation. Git is the authoritative
file inventory. The sections below describe the intended behavior and the
limits of physical evidence.

The content checkpoint records 212 changed paths with 14,296 insertions and
1,171 deletions. The following documentation-only checkpoint records that hash;
the immutable tag points to the complete final benchmark record.

### Mobile thermal and render lifecycle

- Gameplay, Journey and result-screen recurring work now has explicit
  visibility, transition, background, replacement and disposal ownership.
- The shared Pixi session is suspended rather than destroyed during ordinary
  menu exits; gameplay entry commits and texture recovery cannot reveal a
  retired surface or mutate a successor.
- Settled mobile rendering uses bounded cadence while active gameplay,
  authored enter/exit motion, Wild/Special finales and HUD motion retain their
  required high-refresh leases.
- Journey ambient canvases, Area 55 ships and beams, Forest bees, Beach
  bubbles, card idle effects and offscreen Units stop or pause when hidden,
  outside the mobile working set or owned by a transition.
- Special/Wild shared sheets, idle tickers, particles and delayed callbacks
  release across board exit, result screens, retry, navigation, backgrounding
  and runtime replacement.

### Audio architecture and runtime ownership

- Gameplay SFX share bounded decoded-buffer residency, route-aware preload,
  interruption recovery, Settings gates and one audited hard-stop registry.
- Forest ambience and reusable effects use protected residency so a long loop
  cannot evict its complete active working set on every retry.
- Result, Board Transition, Journey ambience and Wild/Special audio retain
  authored cues while successor generations reject stale playback and cleanup.
- The soundtrack uses its Web Audio transport and bounded foreground recovery;
  a stalled resume falls back to the next eligible gesture without blocking
  visual navigation.
- The audio architecture contract, ownership data and `qa:audio-runtime` block
  unregistered sound sources, raw transports and incomplete cleanup.

### Journey, reward and collection presentation

- New Reward, Legendary/Common reveal, collection modal, Special Dice unlock,
  NEW ribbon and detail-card effects are finite, mask-correct and cleaned up.
  Density-appropriate 1x masks avoid unnecessary large GPU alpha surfaces.
- Tap coaching, shimmer, holo, card tilt, idle and shadow owners are bounded
  and cannot continue behind gameplay or another Journey surface.
- Forest, Beach and Area 55 return preparation is generation-owned and shares
  one visible-enter owner. Re-entrant `showCollectibles()` calls join the
  current presentation instead of hiding it again.
- A current-route watchdog performs a real visible recovery instead of leaving
  Journey primed hidden. Disposed World managers reactivate before a return,
  and a late old World completion cannot clear a newer terminal token.
- The user physically accepted Fail -> Exit on Forest, Beach and Area 55 in one
  continuous session with no paper-only state, native crash, memory warning or
  WebContent reload.

### Result screens, gameplay and Special/Wild admission

- Fail, Clean Board and Tutorial result lifetimes own their listeners, media,
  delayed work and navigation cleanup. A retired result cannot remove or mute
  its replacement.
- Gameplay entry, saved-load and endgame ownership prevent stale async work
  from revealing old boards, clearing newer state or racing a successor run.
- All registered Special/Wild variants share reviewed visibility, animation,
  audio, transaction, save/load, input and endgame contracts.
- New Special/Wild archetypes require explicit performance and behavioral
  ownership records before QA admits them.

### Beach collection refresh

- The complete supplied Beach Common and Legendary artwork refresh is
  preserved, including the approved `05 <-> 06` and `08 <-> 09` ordering and
  matching names/density resolution.
- The obsolete duplicate `common/06@2x-1.png` is removed; the retained Beach
  sources remain the user-supplied bytes and mappings.

### Preventive architecture and QA

- The feature architecture skill and contract require explicit lifecycle,
  recurring-work, animation, audio, haptic, asset, save-state and physical QA
  ownership for every new screen, modal, overlay, collection and reward flow.
- `qa:feature-runtime`, `qa:audio-runtime` and expanded `qa:special-dice` gates
  block unregistered runtime growth and incomplete Wild/Special archetypes.
- Native audit verifies the authoritative bundled Stack to Six target, bundle
  freshness and persistent thermal-capture bounds.

## Validation and delivery

- Focused Journey regression: PASS, 5 suites / 79 tests, plus terminal
  preparation 5 / 5.
- `npm run qa:fast`: PASS, all 12 gates, 184 suites / 1,601 tests.
- `npm run qa:gameplay-lock`: PASS, 24 suites / 306 tests.
- `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full`: PASS, all 18 gates,
  424 suites / 2,887 tests and a 1,084-module production build.
- TypeScript, strict unused-code audit, lint, visual contracts, release audits,
  built startup dependency boundary and native source guard passed.
- Complete raw assets were restored to `dist`; only the authoritative Stack to
  Six `Web.bundle` was synchronized.
- `npm run qa:ios`: PASS. Signed Xcode build: `BUILD SUCCEEDED`.
- `dist`, official `Web.bundle` and final `.app` entrypoint share the exact
  SHA-256 recorded above.
- Apple returned explicit `App installed` over existing data at container
  `5DED3EC9-B72D-42AD-8B0F-F7DA8A43128B`; exact-bundle launch succeeded.

## Acceptance boundary

This tag is the immutable complete-source recovery point requested on
2026-09-26. The installed build physically passes Forest, Beach and Area 55
Fail -> Exit without the paper-only blocker. Earlier controlled tests reject
managed audio as the dominant heat owner and show that the render/lifecycle
repairs removed the reported transition hitches, but physical conclusions are
limited to the recorded routes and conditions. Long-duration thermal behavior,
speaker balance, every Clean Board variant and every reward rarity remain
separate physical acceptance surfaces; deterministic QA and installation do
not claim that a phone can never warm under sustained gameplay.
