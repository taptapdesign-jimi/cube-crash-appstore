# Stack to Six Native — 100% native migration

Decision date: 2026-10-07. Explicitly authorized by the user.

## Project identity and benchmark

`main` is the Stack to Six Native development line. Target:
`native/standalone/Stack to Six.xcodeproj`, scheme `Stack to Six`, bundle ID
`com.taptapdesign.stacktosix.native`. The development objective is 100% native
player-facing UI, board rendering, input, rules, progression, persistence,
animation, audio and haptics, with no WKWebView/JavaScript dependency in the
finished shipped game. Native internal diagnostics must also replace the web
escape before final closure.

`native-benchmark-v1` is the immutable source starting checkpoint requested by
the user, including the current Native UI and accumulated gameplay repairs.
Resolve its commit with `git rev-parse native-benchmark-v1^{commit}`. It is a
migration/recovery benchmark, not a claim of complete native implementation or
complete physical acceptance. It captures tracked source, documentation and
assets; ignored dist, Web.bundle, signed apps, logs and device saves are not Git
artifacts. Latest installed app identity remains recorded in CURRENT_HANDOFF.

At this checkpoint gameplay, progression and save authority still use the web
runtime. Native UI is already implemented for multiple screens. Those are
explicit migration dependencies, not permission to ship a hybrid final game.

PWA is a separate preserved product/reference: bundle ID
`com.taptapdesign.stacktosix.Stack-to-Six`, external Xcode project
`/Users/user/Stack to Six/Stack to Six.xcodeproj`. Its latest completely approved
recovery remains `production-benchmark-v9`; other existing PWA tags are retained.
Do not synchronize, build, install or migrate PWA saves for Native work. Never
operate the legacy Kockice Crash target. No branch or historical tag is rewritten.
Existing TypeScript, tests and assets stay preserved as migration references.
Use `SKIP_NATIVE_BUNDLE_SYNC=true` for transitional web QA/builds.

## Implementation rules

- Gameplay KING remains the behavioral authority; language changes do not waive it.
- Start with Swift + SpriteKit for the board and UIKit/Core Animation for UI.
  Validate this choice on a complete small board before broad implementation.
- Separate pure Swift state/rules from nodes, animation and audio. Rendering
  completion must never invent gameplay decisions.
- Keep one authoritative runtime per board session. A test-only TypeScript
  oracle may compare fixtures; production must not resolve the same move twice.
- Keep four shared Wild archetypes: Star, Juice, Magnet and TNT. Native registry
  ports current special-dice-registry mappings exactly, including compatibility
  overrides such as Beach Ball; names/artwork cannot infer gameplay rules.
- Preserve supplied assets and audio bytes. Do not rename, delete, optimize or
  convert assets without separate explicit user authorization. Port animated SVG
  motion to native composition using preserved artwork where needed; source
  animations remain timing/geometry references.
- Each owner declares cancellation, generation, background/resume and disposal.
  Avoid continuous idle work on hidden screens and repeated texture decoding.
- Register native feature/audio/archetype ownership and extend admission gates
  to Swift owners rather than pretending TypeScript gates validate Swift rules.

## Ordered TODO and acceptance

### 0. Preserve and identify the starting state
- [x] Full source QA: all 18 gates PASS, including KING 24 suites/330 tests;
  receipt `/tmp/native-benchmark-v1-full.log`. Native sync disabled.
- [x] Save current source on main as the native-benchmark-v1 checkpoint commit.
  The annotated tag resolves its immutable commit after this document is committed.
- [x] Verify tag/commit and clean worktree after checkpoint creation.
  Main and annotated tag published atomically to origin and verified online
  at `7119c759651ce97fc2cecd8589ae49fa5d10f6c8` on 2026-10-07.
- [x] Document Native/PWA identities, current hybrid dependencies and final goal.

### 1. Inventory and parity fixtures
- [ ] Build a source-to-Swift owner matrix for grid, tile IDs, generation, input,
  resolution, spawn/RNG, score/combo, locks, endgame, saves and mode progression.
- [ ] Export deterministic board fixtures and expected command/result snapshots
  from existing KING tests, using recorded RNG choices/seeds and logical time.
- [ ] Include final regular/Wild merge, NO MOVES confirmation cancellation,
  Magnet survivor identity, special continuations and rapid restart/return.
- [ ] Inventory every variant, idle/finale, sound cue, HUD and terminal surface.
Acceptance: a traceable implementation checklist, no missing registered variant.

### 2. Pure Swift gameplay core
- [x] Implement board/tile model, stable IDs, grid classification and run modes.
  NativeBoardState/NativeTile; linked portable core69tests PASS. Captured ordinary main/absorb/postcheck phases are connected; the next isolated79-test delayed-assignment draft is not linked proof.
- [ ] Port ordinary legality, stack/merge, final resolver and fail-closed errors.
- [ ] Port spawn, moves, scoring/combo, rewards and deterministic RNG ownership.
- [ ] Port transactions, exact-tile locks, endgame guards and generation cleanup.
- [ ] Run Swift fixtures against reference results; no SpriteKit dependency here.
Acceptance: identical state/results for the ported KING scenario matrix.

### 3. Complete ordinary native board
- [ ] Create SKScene renderer with preserved board/dice/HUD geometry and layers.
- [ ] Implement hit testing, tap/drag, valid drop, rejected snap-back, multitouch
  admission, safe-area layout and cancellation during background/navigation.
- [ ] Reproduce enter/exit, stack, merge-six, particles, smoke and collection.
- [ ] Connect ordinary sound/haptics with existing Settings semantics.
- [ ] Run one full native board through Clean Board and Fail on iPhone 13 blue.
Acceptance: no web board/drag/rule callbacks; measure FPS, memory and heat before
expanding. Visual similarity alone is insufficient.

### 4. Four Wild archetypes and all Special variants
- [ ] Star: eligibility, merge, continuation, collection and final merge.
- [ ] Juice: mutation/continuation ordering, spawn and terminal guards.
- [ ] Magnet: pull ownership, consumed IDs, survivor commit/input release and cleanup.
- [ ] TNT: affected tiles, mutation boundaries, delayed FX and terminal evaluation.
- [ ] Port all registry variants and compatibility rules from the checkpoint,
  including Fish, Kanta, Bee, LaserGun, Spaceship, Bottle, Honey, Flower, Barrel,
  Mushroom, Robo Cube, Cubero and Beach Ball.
- [ ] Port each idle/drag/finale composition: curves, pivots, phase offsets,
  frame timing, z-order, input-release boundary and sound family.
- [ ] Test mixed archetypes, late visual tails with playable ordinary dice,
  last-tile specials, restart/exit mid-action and stale completions.
Acceptance: every registry entry accounted for and shared KING matrix passes in Swift.

### 5. Native persistence, progression and integration
- [x] Port native-owned settings, versioned save/load and coherent recovery.
  Native state23tests PASS; atomic writes/dedup/compatibility/recovery and transient-save admission are independently exercised.
- [ ] Port Journey reward pools/unlocks/wildSpawnCount and Arcade progression;
  preserve mode separation and current internal board identifiers.
- [x] Define and test migration of the separate Native app's existing hybrid save
  into its native format; never read/copy/reset the PWA app sandbox.
  One-time blank-origin NativeHybridExport; actual Simulator transport test PASS.
  No physical migration acceptance yet.
- [ ] Complete native HUD, tutorials, rewards, result/NO MOVES, board transition,
  modal actions and all remaining player-facing surfaces.
- [ ] Replace JS route/preferences/music orchestration with native owners while
  preserving currently accepted native UI motion and uninterrupted theme.
Acceptance: fresh play, resume, restart, next stage, result return and relaunch
work with WKWebView gameplay disabled.

### 6. Remove shipping web dependency and physical acceptance
- [ ] Inventory remaining WKWebView/JavaScript/bridge entry points and replace
  required behavior. Keep archived web source/assets; do not broadly delete.
- [ ] Remove web boot/Web.bundle dependence from the Native target and replace
  internal web DEV tools. Update Native QA so no PWA sync is a prerequisite.
- [ ] Verify release configuration enables intended native screens (Worlds are
  currently Debug-only), packaging, identity, offline startup and signing.
- [ ] Run complete native fixture/unit/UI checks and physical journey/arcade
  regression matrix, rapid tap/drag, background/audio interruption and soak.
- [ ] Verify texture/resource cleanup, sustained FPS, memory and thermal state;
  preserve animation quality rather than silently reducing authored effects.
- [ ] Create a separately accepted 100%-native benchmark after user acceptance.
Acceptance: Native app launches and completes all flows without web runtime,
with explicit physical acceptance. A successful build is not final closure.

## Current implementation proof (2026-10-07)

Linked pure core69 tests and native state23 tests PASS. Independent executed
TypeScript fixtures include308rule/score decisions,15,200reward choices and220
Laser shot/order/RNG cases. The complete dedicated Simulator run passed272/272
tests in `/tmp/stack-native100-ordinary-return-full-qa2.xcresult`: actual Board27,
ordinary80ms absorb/conditional100ms postcheck, all13 typed finale dispatches,
fresh/resumed/completed Journey transition admission, next-board continuation,
NewReward→FlowerUnlock→CleanBoard, both tutorial routes and native prepared
Fail→World return. Result9 and destination5 checks cover opaque readiness,
same-instance adoption and stale/background callbacks. Actual Music4 checks
preserve the existing native fade-end/cancellation receipt after numeric input
was corrected. Source full19gates/530suites4010tests andKING330PASS are separate
evidence; latest checkpoint gates and Honey/shared-phase focused proof are
recorded in CURRENT_HANDOFF.

Forest/Beach/Area55 full scene carriers, authored digits/clouds/bees/combat,
music phases, result confetti/Area55 flybys and all authored Special finales
are connected. Three original-art transition screenshots and the connected
result/confetti/ships were visually reviewed. This does not close remaining
delayed ordinary spawn assignments, source shared idle/impact FX, Fish media,
HUD/decor parity, cold resources, default shipping activation or physical
acceptance. The current HUD audit specifically found source Arcade-only bottom
Round pill, top orange/beige Wild meter and no displayed Moves counter; the
prototype native placement/extra counter still require correction.

Native-only QA boot uses the separate native bundle identity and original
NativeAssets.bundle without Web.bundle. The default physical/Release entry is
still the preserved hybrid entry until all parity and release gates close.
Current source is implementation work, not a shipped100%native benchmark.

## Execution boundary

The roadmap/checkpoint task is complete. On 2026-10-07 the user explicitly
started the full migration and requested all available agents. Implementation
is active across pure Swift rules, SpriteKit UI, Swift persistence/content and
native app integration. See NATIVE_GAMEPLAY_RUNTIME_OWNERS.md and the parity
matrix. Simulator proof precedes default activation and physical delivery;
unresolved parity items cannot be marked complete merely because code compiles.
No PWA operations are authorized by Native migration.
