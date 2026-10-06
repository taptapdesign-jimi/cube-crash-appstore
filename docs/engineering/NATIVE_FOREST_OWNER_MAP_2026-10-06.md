# Forest migration owner map and baseline evidence

Status: implementation comparison reference; **NEEDS PHYSICAL TEST**.

## Existing canonical ownership

| Boundary | Canonical owner and entry |
| --- | --- |
| Native Home/Hub route | `native/jimi-2026/JimiHomeHubController.swift`; typed web adapter `native-home-hub-runtime.ts` |
| World preparation/activation | `JourneyBoardsManager.prepareNativeWorld` / `activatePreparedNativeWorld` (names currently describe web preparation) |
| World layout/Units | `journey-world-definitions.ts`, `journey-boards-manager.ts`, `journey-v700-motion.ts`; each Unit groups card, stump, stars, island and clouds |
| Regular card | `openJourneyCardOverlayExperiment`, `journey-card-overlay-modal.ts`; current overlay owns flip, paper/stat art, flight, close and landing |
| Interim card | `handleInterimCardTap` → `continueFromInterimBoard`; its tap directly enters gameplay through its own area exit |
| Regular Play/Continue | `startJourneyBoardFromOverlay`; checks resumable saved state, arms origin/return receipt, calls `continueGameWithSavedState` or `startNewRunFromJourney` after canonical board transition |
| Progression/save | `journey-progression-state.ts`, existing board state persistence; presentation may read but must never reproduce or write rules |
| Fail | `board-fail-modal.ts`: preserves score through authoritative progression, prepares return behind result overlay, waits for result exit before `exitToMenu` |
| Clean Board | canonical Clean Board/result owners and `journey-terminal-return-policy.ts`; native presentation must subscribe to authoritative completion, not invent success |
| Manual Exit | canonical HUD/Exit Stage modal and `menu-exit-handoff.ts`/`exitToMenu`; return preserves Journey origin and active World |
| Return readiness/reminder | `journey-boards-manager.ts` return preparation/World enter and `journey-origin-state.ts`; stale Unit/reminder callbacks must cancel with route generation |

Native World is a rendering adapter. Existing entry, progression, save, result and
input owners remain authoritative. Replacing a renderer is not authorization to
replace card artwork, authored feedback or result rules.

## Pre-migration visual evidence and limitations

Only isolated QA Simulator `1018BE2D-491B-465F-8F75-3E5BEB38C22A` was booted and
the separate bundle `com.taptapdesign.stacktosix.native` was launched with **no
flags** (launch returned PID 7186). No physical phone, PWA app, uninstall, reset
or source build was performed by this baseline lane.

Artifacts: `logs/native-forest-baseline-20261006/home-tutorial-required.png`,
`forest-top.png`, and `forest-baseline.mov`. Forest top screenshot was visually
inspected: original main island, group/card/stars, locked numbered Units and fixed
Forest header are visible. These are art/layout references, not controlled frame
pacing, memory, thermal or complete route evidence.

The initial installed profile reported `journey-tutorial-required`. A real Journey
CTA entered the authored tutorial and one actual drag was attempted. CUA then
reported an external Simulator change; next observation was Home with
`journey-tutorial-complete`. No full natural tutorial completion was observed.
Additional CUA actions also reported external changes and produced mismatched
destinations (Forest AX action showed Area 55; a later card pixel tap showed Home).
The original installed `.native` container disappeared before its hash could be
recorded. Therefore the current visual evidence **does not prove an unchanged
exact-build baseline** or natural admission provenance. No agent baseline lane
save/progression writes occurred. Do not pool it into a performance comparison.

Captured Forest was reached through visible original Forest artwork from the
admitted Hub. Deep scrolling, flip/modal, Play/Continue, Fail/Clean/manual Exit
were not reliably captured. Those remain open acceptance rows.

## Durable candidate route tests

`native/standalone/Stack to SixUITests/JimiNativeForestUITests.swift` and shared
`Stack to Six Forest QA` scheme use only the separate `.native` identity and
isolated Simulator. They require operator launch and genuine canonical tutorial
admission, never launch/reset/edit saves. Tests cover actual Home→Hub→native
Forest, deep scroll/header, close/reopen, regular-card flip/close, validated
Play/Continue and real manual Exit Stage return. Screenshots are retained.

An interim profile skips regular modal verification explicitly. A skipped test
does not count as parity evidence. Fail/Clean need actual legal gameplay reaching
those states or separately labelled integration fixtures; no fabricated terminal
result is acceptable as real-route evidence. Simulator tests cannot accept heat,
sustained pacing or physical animation feel.

## 2026-10-06 verified candidate and terminal diagnosis

The reproducible comparison now uses the **same verified candidate** with the
Forest flag OFF for the web baseline and ON for the native candidate, on the
isolated QA Simulator only. The original early screenshots above remain limited
visual references. Exact candidate payload manifests and XCTest attachments are
under `logs/native-forest-candidate-20261006/`.

Source validation after the terminal repair: full QA **18 gates PASS**, 524 suites
and 3911 tests; Gameplay KING 24 suites / 330 tests PASS. Original-target
`qa:ios` reports NEEDS SYNC because its PWA bundle is deliberately untouched.
Only the separate target's actual resource folder
`native/standalone/Stack to Six/Web.bundle` is prepared. Final source/dist/app
1977-file byte equality is recorded in `payload-manifest-final.json`. An
incremental build with a stale resource payload was caught by byte verification
and replaced before gameplay replay; BUILD SUCCEEDED alone is not delivery proof.

Natural Fail was reached by legal moves and returned to native Forest. Natural
Clean Board initially stalled after the final legal Wild + 5: the parked web
Journey computed `display:flex; visibility:visible; opacity:1` behind gameplay,
so canonical terminal visibility guards treated it as another presented route.
Read-only live WebView state is retained in `actual-clean-stall-*-state.json`.
`isScreenPresented` now excludes the exact parking lease marker; real entering
and unparked routes retain their behavior. A regression exercises both shared
visibility and the actual terminal abort guard under the observed computed CSS.

The verified repaired candidate resumed the genuine saved final pair (no save
injection), and a legal Wild + 5 opened original New Reward, revealed Common
Star Is Out, collected the card, displayed Sixcess / Forest 01 cleared and
returned to the retained native Forest. Actual result screenshots are
`fixed-natural-prefinal-Wild5.png`, `fixed-natural-new-reward.png`, and
`fixed-natural-clean-board-result.png`. The resumed HUD score was 0; this run
therefore is **not evidence of score-preservation acceptance**.

Physical performance, memory, thermal and animation-feel comparison remain
**NEEDS PHYSICAL TEST**. The earlier Simulator-only stage kept physical Forest
OFF. User authorized the separate Native Debug iPhone preview on2026-10-06;
exact `.native` physical Debug launches now enable it. Ordinary Simulator and
release launches remain OFF. Beach and Area55 remain on the web renderer.

## Final v10 card and interim review candidate

Final UIKit validation: **21 PASS / 0 failures**, including a real attached
UIWindow exercising the actual card tap recognizer, both signed turns, settled
face normalization, shared camera, burn pixel changes, bounded cache and pending
preparation cancellation. Final actual regular-card route: **1 PASS / 0 failures**
(61.4 seconds), naturally unlocked card 1, auto-back, manual front/back, Close,
Play, canonical Exit Stage and retained native return. Screenshots in
`v10-final-regular-attachments/` were inspected: original face and textured stats
back are readable, correctly oriented, and have no internal clipping.

The correct v10 reference is `journey-fluidity-v10` / `8e4364e8`, not plain `v10`.
Swift reproduces the original opposite signed manual tap turns, 1050px shared
camera, preserve-3d carrier chain, face depth, opposite front/back tilts, paper,
warm backdrop and original Close/stat geometry. Interim retains original World
burn/glow without the New Reward masked shimmer. Supported iOS rendering uses
31 precomputed screen-blended face textures plus one filtered glow peak, maximum
2x view density, prepared on a serial background queue. A cancellation lease
retires preparation between frames; stop clears the whole cache. It uses no
unsupported CALayer compositing filter or per-frame image processing.

Final exact payload: 1977 files equal across dist, the **actual** standalone
resource folder, final built app and installed QA Simulator app. Index SHA256
`ab76c3c71ccec1f665d7cb21578c90a07b4215c1be33ec504eae4243aeedd636`;
native debug dylib SHA256
`3cd80fe61fe8c32fddc93418119584d705d17c53f6cdc8444f4b130b786671c0`.
Final app container `6752080E-6ADA-4EDE-BC26-F0E0120355A6`. The final Hub visibly
shows 1/10 and AX 1 of 10 after canonical completion.

At this historical candidate the Homepage navigation shadow was still TODO. Read-only comparison
found sharp native rounded pill instead of ellipse with 3px blur, and a wide
shadow sizing/content-mode discrepancy; no accepted Home placement was changed.

Latest review corrections: isolated card camera leaves the backdrop in a separate
2D sibling, eliminating the painted brown half-plane. Original card-only 790ms
landing follows a two-frame paint barrier; 430ms smoke renders above the island
and below the card, with cancellation scoped to its own container. Actual latest
regular-card route PASS (76.9s); screenshots in `safe-scroll-review-attachments/`
show original faces without the half-plane and smoke during landing. Static
screenshots do not establish animation feel. Unit10 scroll extent now includes
all original island/cloud bounds plus40 physical points and native safe-area inset.
The first UI assertion incorrectly treated the island offset as154px from the
card anchor; authored offset is73px (island bottom273px). Safe App-coordinate
gestures replace AX World swipes whose extent may include offscreen content.
Corrected actual scroll verification PASS: full Unit10 screenshot inspected, all artwork above safe area; Back and reopen PASS (`/tmp/native-forest-safe-scroll-correct-ui.log`, xcresult16-41-50). No runtime padding was added to
satisfy the incorrect assertion. Final fullQA log `/tmp/native-forest-scroll-final-full.log`
(18 gates,524 suites,3911 tests); UIKit log `/tmp/native-forest-camera-landing-scroll-uikit-final.log`
(21 PASS). Payload manifest records all1977 exact bytes and current identity.

Final motion review: actual regular route repeated under Simulator recording PASS
(`/tmp/native-forest-final-motion-ui.log`, xcresult16-43-52). `camera-landing-final-motion.mp4`
was decoded with zero requested time tolerance at50ms intervals; contact sheets
51–55s (both signed edge-on turns) and55–58s (Close flight/landing/smoke) inspected.
No brown half-plane in reviewed transition frames; original face remains intact.
User animation feel and physical presented frames/thermal acceptance stay separate.
Earlier `final-native-manual-flip.mp4` is BEFORE the camera fix and still shows
the rejected plane; do not confuse historical evidence with the final recording.

## Current canonical bee projection and renewal ownership

This section describes the current source protocol; earlier review records above
retain their historical provenance and do not establish acceptance of this addition.
`createNativeForestBeeProjection` in `journey-forest-bee-orbits.ts` reuses the
canonical planner, spline sampler, gate transitions and directional asset owner.
It projects five mobile bees from Unit lanes 0, 2, 5, 7 and 9, using the original
`assets/shop/honey/bee1..7.png` artwork. Each finite 11-second chunk contains 331
samples at 30 Hz, including both endpoints. The projection creates no DOM,
images, ticker, storage writes or gameplay rules.

The snapshot carries `beePlans` and monotonic `beeSessionID`. Stats changes and
gameplay parking/return preserve this session; logical Forest retirement clears
the projection, and a fresh World creates a new identity. UIKit reconciles stats
without replaying initial plans. A changed session retires the old bee owner and
installs the new initial plans.

`requestNativeForestBeePlans(generation, revision, ids)` accepts only the exact
active Forest receipt, current Journey epoch, foreground document and closed
card. Stale, parked, hidden or modal-owned requests return null. IDs must be a
nonempty unique subset of the five mobile lanes. Only selected completed bees
advance their retained planner state; paused siblings keep their exact endpoint.
Renewal occurs at finite completion or a later eligible lifecycle event, without
polling or per-frame bridge messages.

An already accepted renewal may finish delivery after a modal, background or
gameplay park. Native retains that chunk for the same live view and captured bee
session, even while visual eligibility is disabled; it performs no hidden decode
or animation installation. Resume uses the retained chunk rather than requesting
another and skipping the canonical endpoint. Cleanup or a new session rejects
late responses. Visible-only native compositor clocks own playback, directional
crossfades and front/behind depth; hidden leaves pause their clocks.

Accepted Back still reads canonical state and validates the exact action receipt,
then clears card admission and cancels any uncommitted launch. Its response is
only `{accepted:true}` because the World is leaving; it does not retransmit the
unchanged artwork/bee snapshot. Rejected stale Back continues to return the full
current snapshot so native can refresh before another action. This narrows reply
payload only; any effect on measured Back latency requires a fresh measurement.

## Native cover to authored board-transition handoff

Native launch completion previously awaited the entire canonical transition and
game entry before releasing coverage, hiding the original transition beneath
native paper. The canonical owner still creates the same Forest transition.
Its optional `onPresentationReady` hook now runs only after the connected overlay
and authored enter timeline have been constructed. Only this native path keeps
the timeline paused pending coverage release; web entry retains its existing
playback behavior.

The runtime emits `gameplay-presentation-ready` with the exact `launchToken`,
`routeGeneration` and `stateRevision`. Swift verifies its committing launch,
removes native coverage synchronously while retaining the launch callback, then
calls `ackNativeWorldTransitionPresentation(token)`. Exact foreground, epoch,
generation and revision validation resolves the ready wait. An accepted ACK
starts the original timeline; its existing completion still invokes the sole
web gameplay owner. Background, retirement and disposal resolve the wait false;
a stale ACK rejects it. Cancellation cleans the transition without invoking
gameplay or falling through to direct entry. The later authored overlay-to-Pixi
prepared-frame handoff remains unchanged. No additional transition, progression,
save or gameplay rules were introduced.

The native ready gate also pauses the original cloud pop-in, bounce and drift
child timelines at construction, preserving each authored delay. Forest bees
already start from the paused main timeline callback. Existing Forest/Area 55
transition cues and soundtrack fades begin together with these clocks only
after ACK. Default web entry starts them at its original mount boundary. The
pure `board-transition-native-presentation.ts` gate owns no timers or audio
transport; delayed, rejected and stale ACK tests verify that its authored-start
callback cannot advance hidden motion or sound before native coverage release.

## Two-phase terminal return preparation

The physical Clean Board capture in `logs/native-clean-return-20261006` confirmed
that native return reached the transferred cover's recovery timeout: cover
transfer at CTA+1015ms, release at +2616ms with `ready:false`, result last visible
at +2770ms, and native enter complete at +3674ms. The native branch waited for
result-cover completion without supplying the web branch's destination-ready
signal, adding an accidental 1600ms wait.

After the original result visual exit and logical Journey route commit,
`prepareNativeWorldReturn(terminalToken)` sends `prepare-world-return` with that
token and the current World snapshot. The logical native receipt remains parked.
Native must prepare original assets and its hidden start pose without entering,
revealing, enabling input or starting ambient work. Only its actual readiness
callback may call `ackNativeWorldReturnPrepared(token,generation,revision,worldID)`.
The runtime checks the exact terminal token, current Journey epoch, retained
World 1/2/3 identity, foreground state and freshly reconciled canonical revision
before notifying the existing static-cover owner. The original 140ms cover fade
then releases the existing result-complete/reveal chain; native Unit enter and
input completion retain their original owners. The 1600ms deadline remains a
recovery fallback, rather than the normal native return path.

Preparation coalesces per token/epoch/identity. Background, retirement or disposal
invalidate its lease; a foreground retry must request preparation again. Stale,
replaced, duplicate or changed-state ACKs cannot release another cover. Behavioral
tests exercise the real trace/static-cover owner for all three Worlds and reject
late callbacks across state, epoch, token, background and disposal boundaries.

## Final continuation preview and comparison

The Homepage shadow TODO is now resolved against the original ellipse/blur and
wide asset CSS; actual settled Home screenshot inspected. New text uses the
card's13cqw query width,180ms idle onset/main phase0 match active v10, and main
exit order matches canonical mainExitFirst without shortening any motion.
One validated model eliminates repeated bee parsing through route/Host/View.
Full source QA18gates/3915tests, UIKit23tests and final actual route2tests PASS.
The uninstrumented preview is installed only in the QA Simulator. Exact payload,
original-asset verification, screenshots and ABBA callback results are detailed
in `NATIVE_FOREST_V10_COMPARISON_2026-10-06.md`. Native long stalls improved against
the initial candidate; an improvement over the matched web control is still not
established. Presented FPS/memory/thermal and user feel remain NEEDS PHYSICAL TEST;
Beach/Area55 remain gated. Physical Native Debug preview is now user-authorized;
performance/visual acceptance and release rollout remain gated.
