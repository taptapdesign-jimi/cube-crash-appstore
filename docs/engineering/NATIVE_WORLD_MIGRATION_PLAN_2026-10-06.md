# Native Journey Worlds — implementation handoff

Status: Forest implementation candidate validated in the isolated QA Simulator.
The user subsequently authorized implementation using agents. Physical Forest delivery
and performance acceptance remain separate; this does not authorize a Git push or
claim that native migration fixes heat/FPS.

## Objective and current state

Make Forest, Beach and Area 55, including their Units and card presentation, native
Swift/UIKit surfaces while preserving original artwork, choreography, progression,
gameplay entry and all terminal return paths. Start with one complete Forest slice.
Extend to the other Worlds only after measured improvement and functional parity.

Currently Home and Hub use UIKit; individual Worlds, card flows, Settings and
gameplay remain web in WKWebView. Native music exists; do not migrate audio here.
Cold Hub flash and overall fluidity acceptance remain OPEN. Native code alone does
not fix a visibility race or guarantee 60 FPS or lower thermal load.

## 1. Onboarding and recovery

- Read AGENTS.md and its mandatory project, handoff, approved-baseline, gameplay,
  Journey, feature, background-work and QA contracts. Read native mode and live
  workflow rules before device work. Use applicable project/architecture/stability
  skills. Recheck git status and current files; preserve all unrelated dirty work.
- Current intended development target is `native/standalone/Stack to Six.xcodeproj`,
  scheme `Stack to Six`, bundle `com.taptapdesign.stacktosix.native`.
  Original PWA app and legacy Kockice Crash are out of scope.
- Inspect newest CURRENT_HANDOFF entries for actual installation/launch evidence.
  Preserve accepted recent Home placement and incoming Hub Back fixes.
- Immutable accepted reference is `production-benchmark-v9`, commit
  `8e4364e8ee571f16c6322727a9ae79fee5a982eb`. Available
  `journey-fluidity-v10` currently points to the same commit; do not claim a lost
  uncommitted v10 worktree was recovered.
- Establish an explicit local recovery checkpoint if authorized; do not auto-push
  or discard dirty work. Keep native World rollout default OFF until tested.

## 2. Inspect existing boundaries before changing them

Read `native/jimi-2026/JimiHomeHubController.swift`, `JimiV9HubView.swift`,
`JimiV9Motion.swift` and the actual asset/cache helpers. Inspect
`src/modules/native-home-hub-runtime.ts`, `native-home-hub-bridge.ts`,
`journey-boards-manager.ts`, `journey-world-definitions.ts`, `ui-manager.ts`
and the canonical progression/game-start/terminal-return owners and callers.
Existing `prepareNativeWorld` / `activatePreparedNativeWorld` names currently
prepare/activate WEB Worlds; names are not proof of native rendering.

Write the exact current route and owner map before implementation. Locate modal
Play/Continue, interim cards, locked cards, reminder landing, Fail, Clean Board,
manual Exit Game, tutorial admission and restored-save handling. Do not replace
these with invented launch or completion shortcuts.

## 3. Ownership and bridge design

- Extend the existing native presentation/route owner; do not build a competing
  route director. Move reusable World rendering into cohesive helpers rather
  than growing the Home/Hub controller into a monolith.
- Web remains the sole authority for unlocks, progression, saves, board origin,
  scoring, no-moves, endgame and gameplay transactions.
- Native receives a versioned read-only World snapshot: world/Unit/board IDs,
  exact card/art references, lock/completion/stars, canonical stats and permitted
  actions. Separate fixed layout/art description from changing player state.
- Native issues semantic requests such as open card, Play, Continue or return;
  web revalidates against its current authoritative state before accepting.
- Every request/presentation carries request ID, route generation and state
  revision. Reject duplicate, stale, replaced and background completions.
- Define prepare/ready/commit/cancel/error boundaries and bounded recovery.
  Visibility belongs only to presentation commit, never to image preparation.
- Document native lifecycle/resource/motion/input owners in feature-runtime
  records and tests. No second save system, audio transport or result resolver.

## 4. Shared native World renderer; Forest first

Implement one reusable UIKit World surface driven by per-World descriptions,
not three independent screen implementations. Suggested roles (names provisional):
WorldView, UnitView, WorldPresentationController, CardPresentationController,
WorldSnapshot and bounded resource lease/cache using existing helpers.

- UIScrollView owns vertical scrolling and overshoot. Distinguish drag from tap;
  header stays above cards and remains correctly tappable at deep scroll.
- One Unit wrapper contains its island, stump, stars, card/locked number and
  owned clouds. Enter/exit/vertical idle move that group together. Nested cloud
  drift and card flip own separate child transforms, not the wrapper transform.
- Preserve exact art, size, relative placement, depth, pivots, accepted shadows,
  smoke, feedback, timings, cascade and main-art early upward-idle exception.
  Do not flatten animated parts into one bitmap or silently remove effects.
- Use original assets without optimization/renaming/deletion. Prepare bounded
  visible/near-visible resources before their motion; estimate decoded RGBA
  memory from pixel dimensions, not compressed file size.
- Geometry is computed at layout boundaries. Motion uses finite Core Animation
  transforms/opacity without per-frame layout, decoding or snapshot allocation.
- Prime incoming layers to hidden start poses before attaching/revealing; commit
  atomically. On interrupt, sample presentation pose before replacing motion.
- Main/Unit idle uses one bounded visible-only lifecycle owner, none when covered
  or backgrounded. Preserve authored motion; avoid per-Unit timers/tickers.
- Retain active World plus bounded near-visible resources. No all-three-World
  full decode at launch or all-card preparation gating the first Hub motion.

## 5. Complete card and gameplay integration

Forest is not complete with only static islands. Implement native card flight,
front/back flip, stats, CTA press, modal close/backdrop/drag return and live Unit
landing from existing contracts. Locked/interim/regular/restored states must work.
Use current geometry at flight/landing boundaries, not a stale scroll coordinate.

Play/Continue must call the existing canonical gameplay entry with validated
board identity and journey origin. Native only displays/animates; it does not
decide victory, loss, rewards or whether Continue is allowed.

At gameplay handoff, park the active native World, scroll and card identity;
stop all its animation/audio work. Do not keep the old WEB World rendering and
idling invisibly alongside its native replacement. Preserve web logical owners
needed by gameplay; inspect before removing any renderer-only assumptions.

Fail, Clean Board and manual Exit Game retain their existing result/board exit
owners. Prepare native return during that exit, but only its authoritative
completion may commit visibility. Refresh changed progress/card Units only;
no all-image decode or extra three-paint-frame return barrier. Card and the
rest of its Unit are ready together. Cancel stale return/reminder on World Back.

## 6. Lifecycle and fallback

Cover rapid double taps, Back during enter according to current Journey policy,
replaced navigation, card close during flip, failed/missing art, bridge failure,
background/foreground, memory warning, interrupted gameplay and repeat cleanup.
Hidden native surfaces have no active tickers/voices. Cache pressure may release
offscreen/unleased art, not trigger full rebuild in an active transition.

Keep a explicit rollback switch: either native Forest or existing web Forest owns
presentation for a route, never both. Recover through a current receipt to a
usable route without exposing a settled destination for one frame.

## 7. Verification and performance evidence

1. Record current complete hybrid Forest baseline before migration, using exact
   reproducible routes, matching build configuration and cool device conditions.
2. Behavioral tests exercise real bridge and lifecycle owners: state validation,
   stale/duplicate requests, ready/commit ordering, hidden/background suspension,
   failed resource fallback, cleanup twice and unchanged save/progression.
3. Use durable XCUITest/real UIKit tests in QA Simulator
   `1018BE2D-491B-465F-8F75-3E5BEB38C22A`: Home→Hub→Forest, shallow/deep scroll,
   card flip/close/Play/Continue, gameplay→manual Exit/Fail/Clean Board→Forest,
   Forest→Hub→Home, rapid actions and reopen. Inspect screenshots/video too;
   AX element existence alone does not prove correct pixels.
4. Run targeted tests, qa:feature-runtime, qa:gameplay-lock, qa:fast and
   `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full`. Apply audio gate if feedback
   owners change. Use qa:ios plus documented separate-native identity/payload
   checks; never sync PWA merely to suppress its intentional NEEDS SYNC result.
5. Simulator verifies functionality, not phone heat or sustained frame pacing.
   Before physical installation follow the current live/approval workflow;
   do not treat this plan as install authorization. Where native UI cannot be
   judged on web, explicitly obtain native-preview approval rather than silently
   claiming web review verified it.
6. On authorized iPhone 13 blue compare baseline/candidate across repeated cold
   and warm routes, scroll, card/modal and all result returns. Keep release-like
   configuration, diagnostics overhead, brightness/audio and thermal start state
   comparable. Record native presented-frame/hitch measurements, tap-to-first
   motion, worst stalls, memory plateau, CPU and thermal state. Instrumentation
   availability must be verified; JS RAF averages are NOT GPU/presented FPS.
7. Repeated navigation/idle run of at least 10 minutes checks growth and hidden
   work. No one-frame flash or repeatable visible hitch is accepted just because
   the average is good. A 60 Hz frame budget is about 16.7ms; report missed-frame
   counts and worst stalls, not a blanket 60 FPS claim. Heat is a separate result.

## 8. Rollout and stop conditions

Gate A: Forest/card/gameplay/terminal return parity and deterministic QA PASS.
Gate B: physical comparison shows a real improvement with no visual/behavioral
regression; user accepts the feel. Until then verdict NEEDS PHYSICAL TEST or FAIL.
Only then configure Beach and Area 55 with the same renderer and repeat their
card/progression/terminal matrices. Do not copy a failing Forest architecture.

After one failed performance experiment, profile its exact failing boundary;
do not stack speculative caches, waits or animation-engine rewrites. Migration
does not excuse leaving current Home/Hub blink or Settings defects unresolved.

Update CURRENT_HANDOFF each meaningful checkpoint with affected files, actual
gate results, artifact identity, device actions and OPEN issues. Deliver source,
Simulator behavior, phone installation and physical acceptance as distinct facts.

## First concrete task for the next agent

Inspect the real World/card/gameplay/return callers, write the owner/bridge map,
capture the current Forest baseline and implement the gated native Forest slice.
Do not start with a full game rewrite, audio migration or bulk asset work.

## Active user review TODO — 2026-10-06

- [x] Native Forest interim: replace the incorrect shimmer presentation with the
  original World burn/glow and verify the visible effect in the QA Simulator.
  Use supported iOS rendering; pause/park must release its entire working set.
- [x] Native regular card: compare the actual `journey-fluidity-v10` reference
  (`8e4364e8`, not the unrelated old `v10` tag) and reproduce CSS geometry,
  perspective, physical front/back flip direction, interruption and close in Swift.
- [x] Homepage bottom navigation shadow: user reports the Simulator shadow is
  oversized, too strong and sharp. Compare original v10 asset and CSS sizing,
  opacity and blur with the native owner before changing it. Read-only audit found
  active-icon shadow is a sharp rounded pill instead of the original ellipse
  with 3px blur; the wide original shadow asset is rendered at screen width
  with aspect-fit instead of `120vw - 96px` with cover. Preserve accepted
  navigation placement, tap feedback and slide behavior.
- [x] Diagnose and repair natural Clean Board admission: a parked web World is
  not a presented route. Legal final Wild + 5 now reaches New Reward, Clean
  Board and the retained native Forest; proof is in the candidate log folder.
- [x] Confirm retained Hub progression refresh and complete final regular-card
  and visual-effect Simulator checks on the exact verified final payload.

Physical Forest delivery and performance comparison remain a separate approval
and acceptance step. Beach/Area 55 rollout remains blocked on Forest acceptance.

Latest Simulator review addendum:

- [x] Eliminate the sharp brown half-plane during card flip by isolating the
  backdrop from the card's 3D camera; verify actual painted motion.
- [x] Restore original v10 card-only landing bounce and smoke after Close
  returns to its Unit, including contact timing, particle layer ordering and cleanup.
- [x] Include all authored Unit 10 island/cloud bounds and actual bottom safe
  area in scroll range, so the whole Unit is visible at legal maximum scroll.

These review findings keep visual acceptance OPEN despite earlier functional
source/UIKit/route passes.

Final Unit10 actual Simulator PASS: complete last island and cloud visible at settled
legal scroll end; actual Back/reopen also PASS. Screenshot: candidate evidence
`unit10-final-attachments/39D08BFC-59A7-4381-BA5F-A13171E87E07.png`.
Card camera and landing corrections have21 UIKit tests PASS plus actual regular
route PASS; captured faces/smoke reviewed, motion/user-feel acceptance separate.

Final Simulator motion recording reviewed using exact50ms AVFoundation frames
(tolerance zero): both edge-on signed turns show no brown half-plane; Close
flight/landing/smoke visible. Recorded actual regular route PASS, xcresult16-43-52.
Contact sheets and recording in candidate evidencefolder. These are Simulator
visual/function checks; user feel and physical performance acceptance remain OPEN.

2026-10-06 continuation completed source/Simulator comparison with v10: original
bees,180ms idle onset/mainphase0,New label geometry/font13cqw and Homepage ellipse
shadow restored. MainExitFirst order repaired without shortening authored motion.
Parser/Back receipt overhead reduced; final matched warm native callback p95
16.951ms vsweb16.757ms, worst33.342ms vs32.688ms. Native Back1662.776ms vsweb1591.845ms.
This improves the previous native candidate, but does NOT establish an improvement
over web or physical FPS. FullQA18gates/524suites/3915tests PASS; UIKit23PASS;
final uninstrumented actual scroll/flip/Close/Continue/Exit/retainedreturn2PASS.
Preview screenshot/identity folder `logs/native-forest-v10-preview-20261006/`.
See `NATIVE_FOREST_V10_COMPARISON_2026-10-06.md` for raw cohorts and limitations.
GateB stays OPEN; Beach/Area55 remainweb. No phone delivery in this lane.

## Explicit Beach/Area55 continuation request

On2026-10-06 the user explicitly requested both Worlds use the same native presentation as Forest. This supersedes the earlier implementation sequencing gate for this scoped extension; it does not establish GateB performance acceptance or authorize phone installation. The shared renderer and existing semantic/return owner now support all three Worlds. Beach/Area55 are gated behind `--jimi-native-worlds` in the isolated QA Simulator; physical and Release remain OFF pending preview approval. Current source/evidence and exact delivery status are in CURRENT_HANDOFF.md and NATIVE_BEACH_AREA55_OWNER_MAP_2026-10-06.md.
