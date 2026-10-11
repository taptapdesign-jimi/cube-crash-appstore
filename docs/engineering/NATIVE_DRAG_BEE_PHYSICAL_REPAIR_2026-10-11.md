# Native drag and live Bee repair after physical regression

Reference: immutable `production-benchmark-v9`, commit
`fc085599e759369900d5dc4135246a9f1355a897`. Native-only Source changes;
no PWA runtime/bundle, original artwork/audio or user-save edits.

## Physical evidence

The latest FX Release UUID `09D0CAFF-B6EA-33D3-BD51-740086772D4D` was installed
and launched before this capture. Exact iPhone13blue NativePID25573 recorded
KRENI17:30:26.346 through user `govoto` (GOTOVO)17:47:56.991 CEST, with
`vidis sada?` marker17:47:31.530. Logs and markers:
`/tmp/native-fx-still-bad-console2.log`, `/tmp/native-fx-still-bad-markers.jsonl`.

At17:47:42.159 the live Bee `native:2:8:1:0:die:1` is rejected by board safety;
generation2 retires at17:47:42.167 with `source_spawn_visual_safety_rejected`.
This proves a presentation safety retirement, not an OS crash. Scene callback
windows show gaps up to107.8ms and missing SKView drawables. Thermal reaches
serious before those gameplay windows. Target15/60 and `dragging` at a window
endpoint do not establish whole-window active cadence or GPU-presented FPS.
The all-process Instruments trace is large and slow to finalize; early export
errors and symbol overlaps are not usable CPU/GPU proof. Do not infer thermal
causality from these bounded receipts.

## Original drag routing restored

Actual v9 `drag-core.ts` `onMove` stores only the newest pointer sample under
one `requestAnimationFrame(processQueuedMove)`. `onUp` cancels pending RAF and
processes the actual final release position before drop. The executable tagged
function oracle `scripts/native-oracles/drag-input-queue.cjs` records12events,
1scheduled RAF,0paints before callback and1paint at the newest sample afterward.

Native formerly ran full position/trail/shadow/hover work synchronously for
every UIKit touch event. `NativeSourceDragMoveQueue` now borrows the installed
Source RAF service, owns only one pending latest sample and captures the exact
drag/node/generation/service/Scope admission. Real release cancels queued paint
and forces its final sample, including a same-position queued sample; explicit
programmatic `moveDrag` remains synchronous. Cancellation, Scope loss, board
replacement and disposal cannot repaint a successor. No new timer/display
link or cadence cap was introduced.

Fresh SDK baseline reproduces immediate pre-RAF paint and missing queued RAF.
Unrelated SpriteKit Float32 equality noise in that baseline is separately fixed
in coordinate assertions; it is not product failure evidence. Five actual
Scene/Source-service regressions cover latest input, release, cancellation,
generation and Scope loss. This fixes a proven routing/work-frequency mismatch;
it does not yet prove the physical drag or pre-merge pause is resolved.

## Live Bee safety repair

The actual Bee idle writer publishes an admitted frame2/3/4 texture receipt.
The old paint-only repair required that current receipt's path equal registry
base `bee1@2x.png`, rejecting healthy live animation. Original v9
`app-core.ts` board repair restores the registry base. Native now borrows the
original admitted base handle only while the exact live Bee cohort owns the
published animated frame; it retains generation/binding/skin/hit/texture and
pre/post callback guards. Unknown, unrelated and retired cohorts still refuse.
Static repair preserves facing and does not restart idle, frame cadence or RNG.
Only Bee's Source frame writer replaces the receipt this way; all13 static
variant repairs remain independently covered.

Fresh DerivedData baseline actually fails the old live-frame guard; an earlier
cached Simulator host ran stale test code and is explicitly non-evidence.
Two new actual earned Journey2 Bee roots (both merge directions) survive real
600/1200ms safety sweeps, merge and continued ordinary play. Initial fixture
incorrectly requested Board8 (core Star); corrected to actual Bee intro Board2,
without changing product reward policy. Current final compiled results and
shipping/phone identity are recorded in CURRENT_HANDOFF.

## Diagnostic boundary

Existing opt-in one-second Scene diagnostics now include prior-target duration
buckets, active60 worst callback gap, accepted drags/touch samples/paint counts,
any-dragging during the interval, exact cadence lease labels and elapsed stage
costs. These are callback elapsed timings, not process CPU or presented FPS.
The existing five-second Native diagnostic owner samples `RUSAGE_SELF` user/
system CPU with monotonic deltas, resets after lifecycle/invalid readings and
reports the existing route receipt without UI-tree/render work. No new sampling
timer or default diagnostic mode was added. A new physical replay remains
required to attribute any remaining pre-merge pause and validate fluidity.

## Empty-cell refresh allocation

Actual v9 app-core creates the fixed ghost grid once and changes visibility.
Native renderGhosts previously discarded and reconstructed every empty-cell
SKSpriteNode on each synchronize, including before accepted stack main. Native
now retains a bounded per-cell cache; occupied cells detach, original row-major
attached order and exit/RNG footprint remain exact, obsolete cells prune, and
disposal releases both mounted and detached objects. Four actual Scene tests
cover identity across12 refreshes, occupancy toggle/order, real texture/relayout,
shrink and disposal. This removes proven redundant allocation; dominant pause
causality and physical improvement are not established from source alone.

Additional noMoves/save/regular-idle physical snapshot consumers perform repeated
whole-roster validation. Special/residual reads invoke captured current owners;
those callback fences remain intact. No evidence establishes these consumers as
the dominant active drag cost, so no broad guard optimization was applied.

## Recapture and expanded-test limitations

Animation Hitches all-process capture failed during finalization with terminal134
and no space left on device. Observed23GB recording was not successfully saved;
the43MB remainder is incomplete. No GPU or process CPU attribution is claimed.

The final80 SDK batch found an actual-earned Honey destination timeout without
a captured source failure, and an all13 test assumption that painted sprites
were direct children. The skin fixture now follows the admitted texture through
authored hosts (focused PASS). Both source and plain presentation-failure hooks
now capture Honey diagnostics. Focused unprofiled Honey destination PASS18.958s
without a product Honey change; three fresh-host repetitions now PASS78/78 selected executions (26 per host),
including Honey both ways and the affected Source ownership tests.
Keep the initial timeout as non-reproduced evidence until physical replay; do
not attribute it to host pressure without proof.
