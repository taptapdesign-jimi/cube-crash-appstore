# Native Home and rapid ordinary-drop repair

User explicitly authorized this secondary conversation to fix Home swipe/nav
motion, investigate gameplay hitching and repair fast stack/merge rejection.
The other migration conversation remains primary for core/clock/meter/Wild work.

## Deliverable and ownership

`native/parity-candidates/v9-interaction/interaction-repair.patch` applies cleanly
against primary continuation checkpoint
`9a90908cd3b6b9dabe15d8b2df494414c2e65519`. Exact compiled file hashes are in
`source-manifest.json`; frozen source `/tmp/native-interaction-repair`.
Never promote the whole live dirty worktree: it still contains unrelated,
unaccepted intro/cadence/Wild/trail drafts. This patch preserves the primary
captured ordinary/direct-Wild80ms completion, core167 and Source frame ownership.
No gameplay core, save, audio, Wild clock or asset bytes changed by this repair.

- Installed93b ignores `animated` in Home selection and its Native app controller
  installs no slide track animation. NativeRouteMotion now owns the original
 400ms power2.out track and380ms nav layout, from the painted pose.
- Selection, pan takeover, route exit, background and disposal use its existing
  cancellation registry. Route exit retires slider/nav layout while retaining
  the selected hero's painted bounce for the original collapse retargeting.
- Swipe release starts at the synchronous last drag pose, not a stale rendered
  presentation frame. Travel accumulated before UIKit recognition participates
  in destination selection even with zero subsequent translation/velocity.
- Ordinary drop previously required the finger inside a strict geometry cell.
  It now consumes changed release coordinates once, retains source sticky4px
  logical movement and uses largest eligible rendered-bounds overlap followed
  by release-only pointer grace. Original app-core explicitly configures5%
  overlap,26% padded pointer bounds and68% radius (not helper defaults10%/22%).
  Existing resolver/tutorial legality is retained; Special-source targeting is
  unchanged. Existing held pickup/absorb and final-Wild flow tests remain valid.
- One board-lived15px rounded pip raster, corner6, RGB129/90/66 alpha0.9, replaces
  repeated live SKShapeNode pip draw/tessellation. NativeBoardTextures releases
  it on disposal. Original pip constants and all asset bytes are preserved.

## Physical capture

Phone was unavailable initially; user connected/unlocked after the prompt.
Normal Native launch PID11734 emitted the exact Swift boot sentinel.
Time Profiler preflight collected18 CPU rows. KRENI2026-10-08 14:17:17 CEST;
user GOTOVO observed14:18:42 CEST. No separate user problem markers were sent.
No code/build/install/restart occurred during KRENI→GOTOVO. Instruments was
stopped and flushed before telling the user they could unplug the cable.

Raw trace `/tmp/native-rapid-drag-live.trace`; log and CPU export/summary in
`logs/native-rapid-drag-20261008/`. Validator confirms13563 numeric CPU rows;
13513 rows have usable backtraces for the summary. Power tables were not
recorded, so aggregate CPU+power validator FAIL is retained explicitly.
No power/energy claim is made. Main-thread CPU sampled weight9309ms; inclusive
SpriteKit renderer3353ms and shape addRenderOps837ms. Inclusive values overlap.
Console records eleven throttled `SKView: no drawables available` warnings.
These are not an FPS measurement or proof that pip vectors caused the hitch.
The pip change removes measured vector work; sustained FPS, GPU-presented frame
latency, thermal state and physical input feel remain NEEDS PHYSICAL TEST.

## Actual QA receipts

- Executed immutable v9 pickDropTarget/intersectRatio with actual app-core drag
  configuration: Swift6000/6000 rectangle/eligible/overlap/release cases PASS.
- `/tmp/native-interaction-repair-qa5.xcresult`:35/35 PASS (Board27,
  AppCoordinator3, initial repair5), zero failures. Source configured5%/26%
  and sticky movement were included.
- `/tmp/native-interaction-repair-qa6.xcresult`:6/6 PASS after avoiding duplicate
  final movement (repair5 plus real rapid pickup/absorb1).
- `/tmp/native-interaction-repair-qa10.xcresult`:10/10 PASS on final runtime
  (repair7 including actual swipe callback/recognition-only release and painted
  hero route-exit handoff, AppCoordinator3).
- `/tmp/native-interaction-repair-ui2.xcresult`: actual UIKit UI test1/1 PASS,
  zero skipped: slow/fast swipes both directions and nav taps, Home retained,
  zero web views. Attachment `native-home-real-swipes-nav`.
- Gameplay KING24 suites/330 PASS; feature-runtime and qa:fast PASS.
  `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full` all19 gates PASS on shared
  source (`/tmp/native-interaction-full.log`). This is source-gate evidence,
  not admission of the unrelated dirty Native runtime.

Historical failures retained: QA1 rejected unrelated trail references accidentally
copied into the temporary candidate; QA2 found omitted primary direct-Wild absorb
completion, corrected without core changes; the initial pause fixture incorrectly
expected suspension to cancel a held pointer, now calls the real cancel owner.
QA4/7 were sandbox/wrong-directory compiler attempts, no test receipt. QA8 exposed
stale presentation start on release and the stale test fixture, corrected in QA9.
UI1 was a test-only local-variable shadowing compile failure, corrected in UI2.
Receipts are distinct scopes and are not summed into an invented aggregate.

## Delivery boundary

Phone still has93b, not this candidate. No PWA sync/install, phone install,
uninstall, save reset, commit/push or asset mutation occurred during this repair.
Simulator contains the tested candidate. Primary can integrate the scoped patch
and ownership-record changes after reconciling its current checkpoint. The
live-debug approval and physical delivery/retest step remain outstanding;
Native Swift UI requires native preview rather than treating PWA behavior as
proof of the native candidate. No request to defer these fixes until complete
migration is inferred from older handoff notes after the user's new authorization.

Verdict: source/scoped Native deterministic repair PASS;
physical hitch/FPS and touch acceptance NEEDS PHYSICAL TEST.
