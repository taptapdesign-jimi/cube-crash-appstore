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

On2026-10-08 the user explicitly requested a physical preview of the current
Native work. `NATIVE_GAMEPLAY_PHONE_PREVIEW` is an opt-in Debug-only build
condition for the exact `.native` target. It opens the existing Swift bootstrap
on ordinary icon launches, retains Native-only save migration, and never resets
a profile. Simulator opt-ins remain unchanged. This physical preview does not
close unfinished parity, Release admission or final shipping retirement.

## Implementation rules

**Required visual baseline:** The user explicitly reaffirmed on2026-10-07 and2026-10-08 that
Native must retain the v9/current accepted CSS style, CTA and textures. Compare
to immutable `production-benchmark-v9` plus explicitly accepted later changes:
same original artwork/audio, fonts, colors, gradients, shadows, dimensions,
spacing, shapes and animation curves. CSS is a source recipe for native layout,
drawing and motion. No platform-default restyling or replacement artwork. Track
and correct every known difference before marking visual parity complete.

Remaining HUD motion must preserve the original timing as well as appearance:
close uses the authored220ms three-phase bounce (77/77/66ms,0.92/1.06/1,
original cubic-bezier solver), with immediate modal opening and the source
gameplay pause. HUD drop starts at the actual tile-entry midpoint plus two
paint callbacks, not at entry start; it uses140px travel and0.8s
elastic.out(1,0.6). HUD rise uses0.3s power2.in and the actual HUD top,
not the prototype100px destination. These remain open until connected native
motion and lifecycle are verified; current geometry tests do not close them.

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
  NativeBoardState/NativeTile; linked portable core89tests PASS. Captured ordinary main/absorb/postcheck, delayed locked assignment and primary/cleanup phases are connected; Wild command-lifecycle completion remains open.
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
Wild spawn/input command phases, source shared idle/impact FX, Fish media,
HUD/decor parity, cold resources, default shipping activation or physical
acceptance. Native now implements the source Arcade-only bottom Round pill, top orange/beige
Wild meter and removes the prototype Moves counter.35 independent source layout
samples and actual Chrome3/Paper2 checks PASS. Remaining HUD motion/close geometry,
meter decorations and final Wild-measured board pose stay open. Selected original Journey bottom decor is connected with source finite entry/exit and readiness/epoch/lifecycle ownership; actual footer9/integration6 PASS.

Native-only QA boot uses the separate native bundle identity and original
NativeAssets.bundle without Web.bundle. The explicitly flagged Debug preview
installed on iPhone13blue now launches Swift gameplay from the ordinary icon;
unflagged physical Debug and Release activation remain gated. The installed
preview receipt and its retained unused historical Web.bundle bytes are
documented in CURRENT_HANDOFF; final package retirement remains open.
Current source is implementation work, not a shipped100%native benchmark.

2026-10-08 resumed source checkpoint: Fish fallback uses the unchanged original
SVG/embedded72WebP frames with shared route-scoped decoding, cancellation and
foreground no-rewind. Actual fallback4, FishIdle4 and HUDclose5 tests PASS;
source19gates/530suites4010tests/KING330PASS. Close220ms matches663 executed
original GSAP poses and keeps quiet-board rendering active through its child
action. Cadence60/30/15 is proved as a linked standalone value owner; complete
Scene callback integration remains private. Wild105 tests and original96
varied face/cell/bounce streams are private proofs, not linked admission. HUD
drop/rise4209 original-GSAP poses, including interrupted drop→rise, and original
midpoint/nestedRAF8 schedules/64 decisions are private proofs pending connected
lifecycle checks. User-reported phone problems are deferred until the planned
migration finishes. Physical acceptance remains open.

## Execution boundary

The roadmap/checkpoint task is complete. On 2026-10-07 the user explicitly
started the full migration and requested all available agents. Implementation
is active across pure Swift rules, SpriteKit UI, Swift persistence/content and
native app integration. See NATIVE_GAMEPLAY_RUNTIME_OWNERS.md and the parity
matrix. Simulator proof precedes default activation and physical delivery;
unresolved parity items cannot be marked complete merely because code compiles.
No PWA operations are authorized by Native migration.

## 2026-10-08 primary continuation receipt

Closed private source at `/tmp/native-resume-owned-snapshot` has source-correct
wall timeout ownership (ordinary100/50/locked50-150-250, TNT400/500), typed
completed-level-flow160 selective repair and retirement-before-interruption.
Core114/114 PASS. SDK7 actual44/44 PASS admits final675 source geometry and
original33px bold multiplier with connected Board/HUD/ordinary-six/timer checks.
Source-correct app pause/save debit49 passes SDK6; do not sum separate run counts.
Private meter122/122 mac Swift PASS keeps queue WAIT, handoff WAIT, pickup and
target admission distinct. It is still not activated in Scene. Source coupled
controller proves GSAP60 callbacks must remain independent of quiet Pixi15; a
finite-union clock consolidation prototype is pending admission.

Ownership is resolved: migration remains primary; secondary independent display
packet is available for selective review. Its earlier shared draft remains held
until reconciled, despite its separate Simulator receipt. Full native migration,
shipping default/bridge retirement, phone regressions and physical acceptance
remain unchecked. No phone install, PWA sync, asset mutation or online checkpoint
was performed by primary in this resume batch.

## 2026-10-08 primary meter and shared-effect continuation

- [x] Default-off merged pure core157 reproduced157/157; captured NoMoves and meter ownership remain separate from UI activation.
- [x] Source clock v5 actual SDK12 23/23, explicit Source wall domain and finite union transport.
- [x] Meter drop component SDK13 50/50, including same-node resource/audio/composition tests.
- [x] Immediate shared-smoke roots SDK14 8/8; old callbacks cannot steal a newly reentered resource lease. Deferred bursts remain unported.
- [x] HUD gain/spring/consume coordinator SDK17 5/5, including ten gain, seven consumption and five composed original-global-root traces. Full bounce begins at actual completion.
- [x] Selected finale texture host SDK19 22/22 with mounted cache/decode cancellation and reentry, plus HUD regressions. Original bytes preserved.
- [ ] Source before-open selection/token recheck, committed selected texture/audio preparation before charge, then pre-travel cancellation and actual Scene linkage.
- [ ] Source meter smoke emission and width resize, original impact shake and visible paint integration.
- [ ] Same-node accepted80ms absorb, selective outer merge impact, idle and nine marker producers.
- [ ] Regular-six shared smoke/RNG/shard root integration; deferred smoke and full NO MOVES UI/caller handoff.
- [ ] Whole-app default shipping activation, native diagnostics retirement and physical acceptance.

These are scoped component receipts in the closed primary candidate, newer than
online93b; they do not mark the app100%native or imply a new phone installation.
Reported phone problems remain deferred until the planned migration is finished.

Primary later continuation: exact default-off before-open Core167/167 and
actual SDK21 114/114 PASS; final CLOSED source full3 all19 gates/530suites4010
tests/KING24/330 PASS. Source first recheck → selected committed preparation →
charge → second pre-travel recheck is now a tested staged pure-core API. Actual
hidden node, selected audio and Scene activation remain open. No new phone or
PWA operation.
