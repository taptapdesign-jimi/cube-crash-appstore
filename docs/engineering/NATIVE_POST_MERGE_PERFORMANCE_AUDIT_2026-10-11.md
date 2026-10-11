# Native post-merge performance audit — 2026-10-11

## Verdict

**NEEDS PHYSICAL TEST.** The user rejected installed Native UUID
`4CA38959-9B19-3F97-8429-06A6D41374E0`: drag was initially smoother, then
ordinary/Wild merge6 introduced a pause and subsequent drag stutter. Deterministic
ownership checks and a successful install do not close that physical failure.
Final Native SDK coverage is PASS across193 distinct methods (188 unaffected from the complete193-method run plus corrected35-method focused run). Signed Release, install and post-install acceptance receipts remain pending. This document records the bounded repair and its limits.

## Capture and measured evidence

The ready-gated exact-PID26436 capture retained
20:58:37.740–20:59:47.110 CEST (69.370s). KRENI was20:58:52.019,
TRZA20:59:13.362 and explicit GOTOVO20:59:39.864. Source/app/build/install
remained frozen until GOTOVO. Artifacts:

- `/tmp/native-postmerge-markers.jsonl`, `/tmp/native-postmerge-console.log`.
- `/tmp/native-postmerge-active-game-performance.trace` and its exported CPU,
  displayed-surface, presented-handler and hang tables.
- `/tmp/native-postmerge-active-main-resolved.json` and
  `/tmp/native-postmerge-client-presented-independent.json`.
- Original binary/dSYM/source evidence: `/tmp/native-postmerge-4CA3-symbols`.

The resolved main-thread subset contains2437 weighted samples over trace time
43.578–69.355s, corresponding approximately20:59:21.318–47.095. It begins
after the first TRZA marker; do not attribute its whole CPU total to that exact
incident. Inclusive costs in that subset are927ms under SpriteKit renderer,
210ms under shape rendering,59ms under regular-idle availability and70ms under
physical observation. These overlap and are CPU sampling estimates, not GPU
frame durations. The root's user-active slice43.578–62.124s through GOTOVO
reported1071ms main CPU with377ms renderer and55ms shape work. The incident
selection59.124–63.124s reported347ms main CPU,142ms renderer and23ms shape
work. Six potential hangs were101–197ms; five had nearby cold-audio work. This
is an association to investigate, not proof that audio caused every pause.
The first TRZA marker has no CPU coverage in this resolved subset; the second
incident is covered. Those selections are distinct from the whole
resolved subset and must retain their own range/selection evidence.

The preceding rejected-build idle capture independently measured959ms main
running CPU over96.587–116.829s of trace time, including136ms regular-idle
availability,120ms escaped full-board current checks,104ms physical observation,
116ms Source clock,258ms renderer and63ms shape work. See
`/tmp/native-fps-rejected-idle-cpu-summary.json`. This confirms an idle owner
cost, not an active Wild stall cause.

The current independently resolved presentation table contains449 unique
drawables/handler rows, with no duplicate drawable IDs. Handler-gap median is
16.971ms, p9566.724ms and maximum3666.172ms, with14 gaps above100ms. It includes
route/idle changes and cannot be summarized as sustained active-drag FPS. A
handler's execution duration is not GPU execution time.

Earlier `/tmp/native-deep-console.log` shows activity counts rising during
overlapping FX, then returning to zero/one. Subsequent bad drag intervals can
have only direct-manipulation plus the settled Special registry. No permanent
cadence/FX owner leak was established. Finite Source roots unlink on completion;
regular idle has one cancellable scheduled wake. Missing drawables and large
callback gaps are evidence of the symptom, not proof of a specific GPU cause.

## Ordered regular-idle batch

The old availability scan performed an escaped full-board physical check before
each candidate, then repeated the complete availability scan when starting the
chosen idle. Every full check re-read all physical tiles. Observer reuse had
already removed repeated observer allocations; it did not remove these nested
physical reads. Canonical Swift Array equality has a proven shared-buffer fast
path and was not replaced by a mutation epoch.

The new batch keeps full physical checks at its beginning and end. It validates
each actual node's identity, generation and canvas parent. The exact marker
branch `node.isSpecial || node.sourceResidualWildPresence` can consult external
meter/scope owners, so a full check runs immediately after every such read.
Every explicitly supplied external marker reader receives the same fence, with
no fallback if it returns nil. The production wrapper also revalidates after
its final Scope-admission callback.

For an all-ordinary45-tile board this reduces full checks from47 to3 in the
production wrapper; the inner batch has two. Mixed boards retain the additional
checks required by actual external callbacks. Native preserves the source
roster order and consumes no additional RNG. Immutable v9 excludes the rigid
Kanta idle family, not every Wild/Special; other valued eligible Specials remain
in the selection list. The existing idle schedule and five random draws remain
unchanged.

`NativePhysicalObservationReuseTests` covers actual constructor-owned45-tile
geometry, ordered eligibility, counted full checks, no added draws, dynamic
event-mode exclusion, disposal and exact node/generation replacement. The
external-provider test mutates an earlier node during a later Special callback
and requires immediate rejection; it also checks missing-provider refusal,
valued Wild eligibility and Kanta exclusion. Final SDK coverage for these tests is PASS; physical timing remains open.

## Smoke ellipse projection and polygon preservation

Only authored smoke ellipses and halos now project through pooled sprites with
one shared opaque-white256px circle texture, warmed before the first burst.
Sprite dimensions remain exactly `2*radiusX` by `2*radiusY`; original scale,
rotation, color, Float32 presentation and packed eight-bit node alpha remain
owned by the existing recipe. A halo retains its actual pooled resource's blend
mode. Particle counts, RNG, roots, delays, TTL, release order and stale-lease
guards remain with their existing owners. No asset files changed.

The first SDK attempt failed because the former shared pool type also served
polygon shards: `NativeRegularSixSharedLayers` and `NativeWildMergeSixShardOwner`
still needed shape path/fill/stroke APIs. The correction introduces
`NativeSharedVectorSpritePool` with the original vector implementation and routes
the already distinct ordinary/wild per-pattern pools to that type. It creates
no extra per-pattern pool, changes no shard points and introduces no polygon
texture cache. Smoke's existing session pool uses circle sprites; shard pools
keep actual vector carriers,150-resource limits, inherited style and captured
lease cleanup.

Independent caller review found no remaining shape API on a smoke sprite lease.
All smoke recipe/global/deferred oracle tests retain positions, radius bounds,
scale/rotation, packed alpha and draw-boundary checks. Added tests inspect white
raster interiors/transparent corners, reference ellipse bounds, halo blend
inheritance, reuse and stale vector leases/eviction. Antialiased edge pixels can
differ between SpriteKit vector and texture projection; physical visual
acceptance is required. This repair does not establish a whole GPU performance
result or identical PWA/Native renderer execution.

## Selected audio preparation and reuse

Cold committed cue playback formerly initialized AVAudioPlayer inside a
MainActor task. The existing selected-file serial queue now handles this
preparation before the exact live voice starts. The same selected preparation
ledger accepts one idle returned player per source within its existing28MiB
budget; reset and prepareToPlay run on that queue. There is no second cache,
queue, player session or independent audio clock. Scoped silence still stops
its player immediately on MainActor; this repair does not claim all stop cost
is eliminated. Coalesced requests cancel per voice, distinct simultaneous voices
retain distinct players, and generation/Settings/background/disposal fences
reject late work. Per-voice delegate receipts prevent callbacks from the old
playback from retiring a new voice reusing the same player. External error
callbacks are followed by exact-voice rechecks, including reentrant replacement.
Original source selection, delay, rate, gain, fades and cues remain preserved.
The18 selected-audio methods and related audio/board-entry suites passed.

## Studio intro lifecycle

Added the missing original-logo sheen with v9's200ms delay/6s cycle and mask
stops. The selected original HEVC media receives a bounded1.8s ready admission;
on failure the original animated optimized WebP is decoded serially, retaining
one current frame rather than all frames. Sequence timing begins after media
admission. Terminal zero-scale/opacity model values are established before exit
animations, and the complete intro is hidden before animation removal and the
once-only homepage handoff. Background, disposal, deadline, frame jobs and late
media callbacks retain captured epoch ownership. Four actual lifecycle tests
passed, including original football fallback frame changes and a mounted natural
media exit without manually invoking the animation completion delegate.

## Pending validation and acceptance

The first shared-pool SDK compile failure is retained; its typed split correction
is complete in Source. The corrected SDK coverage combines `/tmp/native-postmerge-final-sdk.log`
with the successful focused fixture rerun described below. Signed Release and
install remain pending here. The root owns serialized SDK and delivery work.

After install, compare sustained ordinary drag before and after several sub6
and merge6 moves, then the actual first Wild/Special merge6 and later drag.
Align accepted touches, Source paints, target history and presented frames with
the user's incident marker. Confirm smoke silhouette/opacity/blend and unchanged
shard artwork separately. Keep the physical verdict open until that comparison;
do not infer smoothness from short CPU counters or callback targets alone.

Related architecture and Apple rendering references are recorded in
[NATIVE_FRAME_PIPELINE_AUDIT_2026-10-11.md](NATIVE_FRAME_PIPELINE_AUDIT_2026-10-11.md).

## Final deterministic validation

First complete SDK run terminal65:193 methods,188 passed and five failing
smoke/pool fixtures. Failure output retained in
`/tmp/native-postmerge-final-sdk.log`; it is not relabeled green. SpriteKit
returns scaled dimensions as Float32 whereas the former path-bound comparison
was unscaled; two transparent UIColor comparisons differed only in color space.
Three test files now compare exact Float32 diameter times scale and semantic
zero alpha, and a real SKShapeNode-versus-SKSpriteNode projected-frame oracle
checks three nonunit scales within one backend ULP. No product scale changed.
Focused four-class rerun35/35 terminal0,
`/tmp/native-postmerge-corrected-smoke-sdk.log`. Combined distinct193/193 PASS
receipts in `/tmp/native-postmerge-final-sdk-methods.json`. Actual Star/Bee
source and destination continuations, Spaceship continuation, four intro
lifecycle/real-media tests, all selected audio and mounted fresh/save/drag
regressions passed.

FullQA4010/4010 terminal0 `/tmp/native-postmerge-full.log`; final KING330/330
`/tmp/native-postmerge-final-gameplay-lock.log`. Final audio, feature, special
and Native admission/source audit gates terminal0 under
`/tmp/native-postmerge-final-{audio-gate,feature-gate,special-gate,admission,source-audit}.log`.
No PWA source, bundle, install, save or supplied asset modification. Physical
FPS, visible smoke edges, touch feel and speaker/intro acceptance remain open.

## Later physical candidate53C4: FAIL

The user rejected candidate53C4 on the iPhone: ordinary drag and Wild merge6
still visibly stall. The capture ended on explicit GOTOVO. This physical FAIL
does not invalidate the historical193/193 deterministic result above; it shows
that those tests did not establish frame delivery or touch feel. No later
performance repair is accepted from this capture alone.

The current evidence is `/tmp/native-postmerge-after-console.log`,
`/tmp/native-postmerge-after-cpu.xml`,
`/tmp/native-postmerge-after-main-resolved.json` and
`/tmp/native-postmerge-after-independent-cpu.json`. Resolved CPU coverage is
247.0676595–276.814659125 seconds on the capture clock, with2211 sampled
MainThread milliseconds. Inclusive owner totals overlap and must not be added.
The root correlated synchronous audio play/stop XPC paths with three active
hangs. Independent stack inspection confirms `AVAudioPlayer.play` reaches
`xpc_connection_send_message_with_reply_sync` through
`AudioQueueXPC_Client::SetProperty`, and stop reaches AudioQueue time/property
operations from `NativeAVGameplayAudioTransport`. The earlier selected-file
preparation/reuse repair moved cold player preparation; it did not remove these
live MainThread play/stop operations.

A selected finale texture path also materializes image pixels on MainThread:
the root identified42 samples in the selected texture/ImageIO preparation path.
Independent inspection finds31 samples with an explicit ImageIO binary within
252.126657833–252.265657333 seconds. These are overlapping stack categories,
not42 plus31 milliseconds. This supports inspecting actual decoded-pixel
materialization before publication, rather than assuming an SKTexture preload
receipt means deferred image decoding is finished. Neither observation proves
that audio or textures explain every renderer stall.

During21:29:42–48, Source delivery gaps reach200.49ms and Scene callback gaps
reach192ms. Delivered-touch to queued-paint age is usually4–8ms in those
intervals; a later paint-to-render observation reaches54.27ms. The reported
12–26 `touchSamples` per full second is not a measured touch sampling frequency:
there is no active finger-duration denominator, and intervals include pickup,
release and merge effects. The counter increments before RAF enqueue. Native
keeps the same v9 latest-pointer/one-RAF policy, and microtask admission checks
lifecycle, generation and exact scope identity rather than transient merge
flags. Raw UITouch hardware timestamp to UIKit dispatch delay is unmeasured.
No interpolation, prediction or weakened input admission follows from these
counts.

Upcoming audio serialization and selected texture materialization changes
remain unvalidated here. Review must preserve exact voice/epoch cancellation,
serial player access, original gain/rate/delay/fade behavior, actual selected
image geometry/color/alpha and stale resource publication fences. SDK, Release,
install and another sustained physical drag/Wild merge6 capture remain separate
required receipts. The present physical verdict is **FAIL**.

### Independent review of the next bounded repairs

Code review of selected raster materialization passes ownership and decoded
provider checks. The existing serial artwork queue now produces a raw CFData
RGBA provider before MainActor texture construction; dimensions, interpolation,
rendering intent and original RGB profile remain preserved. Overflow checks
precede allocation. Fixed selected bundled inputs retain their existing policy;
there is no new arbitrary image byte cap. Texture upload still occurs through
the original native preload barrier, so this is not an elimination of all
MainThread texture/render work. Actual WebP reference pixels and retired/new
upload fixtures are added; SDK and physical pixel/FPS receipts remain pending.

Code review of audio control passes exact lifetime and serialization checks.
Live player start, stop, gain/fade, reset, state access and eventual release use
the captured existing serial queue. Tiny ControlLease locks protect admission
flags without holding an AV call. Logical voice retirement is immediate, but
speaker silence is asynchronous: an already claimed native start/stop call can
finish before its same-lease stop executes. Canceled unclaimed starts cannot
play; old callbacks and stops cannot retire a replacement voice. Returned idle
players become reusable only after exact worker stop and reset, with the
existing generation/control epoch fences. Saturation rejects new starts without
discarding cleanup. The64 limit counts outstanding control voices, not every
queue closure; per-lease gain coalesces, and stop/disposal also enqueue work.
Original numeric cues remain unchanged, but native queue/start-receipt delay can
affect audible alignment and remains a physical acceptance question. Added
worker-order/cancel/reuse tests are meaningful; SDK results are pending. These
review passes do not replace candidate53C4's physical **FAIL**.

## Architectural control/texture SDK verification

Coherent audio control ownership and fully materialized pixel handoff passed
68/68 actual SDK tests terminal0 `/tmp/native-owned-control-sdk.log`. Includes
21 selected-audio methods with blocked preparation/cancel, claimed start then
retire/stop/reset order, coalesced gain and old-receipt isolation; actual original
WebP pixel provider and stale upload cases; selected warmup/host and semantic
audio tests; actual Star/Bee both-direction merge-to-next-drag continuations.
Independent owner/thread/lifetime reviews PASS. Only semantic retirement is
immediate; native speaker silence follows serialized control work and remains a
physical timing check.64 is the outstanding control-voice receipt bound, not a
claim that every queued cleanup closure counts within64. No raw player escapes
to MainActor, no AV operation runs while holding the lease lock, no extra cache
or production queue introduced. Signed delivery and physical verdict pending.

Final exact-hang resolution is retained in
`/tmp/native-postmerge-after-exact-hang-stacks.json`: first hang mixes GPU upload
and audio start (four audio samples inside the interval); second contains one
exact audio-stop sample among seven Main running samples; third mixes Source
completion/synchronize and audio start/stop. This is not an all-audio diagnosis.
Actual prepared-player control calls still perform synchronous AudioQueue XPC on
Main; the independent selected texture first-decode path is also concrete.
Native presented-handler gaps independently reach250.379ms in the active slice,
with median33.408ms; requested-time units do not establish optical FPS.
`/tmp/native-postmerge-after-presented-independent.json` retains those intervals.

Full post-changeQA4010/4010 plus KING330/330 terminal0
`/tmp/native-owned-control-full.log`. The new signed Native Release is building;
physical acceptance remains FAIL for installed53C4 and pending for the new work.

Architecture candidate signed647D5294-160F-376B-9E0A-263428BFD3F0 delivered
21:43 CEST, initially PID26782. Release/audit/signature/install and both
prelaunch save comparisons PASS. That process exited before KRENI, so its
process-only capture did not measure the user's relaunched PID26786. Explicit
GOTOVO closed this attempt; screenshot retained ordinary6 is physical FAIL.
Actual performance acceptance remains open; previous53C4 remains physicalFAIL.

## Subsequent ordinary6 watchdog parity investigation

The user supplied a screenshot with a regular6 still visible after merge6.
The attempted647D capture did not cover that running process, so it is invalid
for attributing this incident. The latest durable Journey2 snapshot has no6;
it does not rule out an unsavable in-flight6 in the live board.

Immutable v9 app-core9473–9492 schedules an ordinary1200ms watchdog owned by
its exact destination cleanup token. After the main source has been consumed,
that destination owner can still remove a nonfinal, nonspecial value6. Native's
existing watchdog requires the old source/contact to remain alive and main to
be uncommitted. The initial100ms-cancellation fixture passed because the independent50ms
primary assignment correctly removed the destination first; it did not establish
watchdog recovery. The corrected actual mounted fixture installs the genuine
Source depleted-moves caller, commits moves1 to0, and takes a controlled
unsupported final-chance return without inventing spawn arrival. At300ms it
still holds the exact canonical/physical6 and cleanup token with its source
already consumed. The old1200ms watchdog then failed three cleanup assertions:
`/tmp/native-retained-six-depleted-before-sdk.log`, terminal65. This establishes
a reproducible watchdog ownership gap independently of the invalid capture.

The correction keeps pre-main interruption behavior and adds a narrow committed
Core endpoint: exact pending plan/generation, nonfinal regular value6, captured
ID/cell and canonical cleanup markers. Scene admission keeps the exact live
physical destination and cleanup token independent of the consumed source or
retired contact. Only that destination and a matching normal cleanup receipt
are removed; noMoves caller, spawn, HUD, score, meter, debit and RNG ownership
remain unchanged. The original wall1200 callback continues during animation
pause/background; a foreground gate would consume the one-shot timer and strand
it on resume. Disposal/generation/token/replacement guards remain intact.
The corrected depth3 fixture and focused stale/special/lifecycle negatives are
PASS in actual SDK34/34 terminal0, `/tmp/native-retained-six-after-sdk.log`;
all17 variants and actualStar/Bee/Spaceship next-drag continuation also PASS.
FullQA4010/KING330 and NativeiOS target/original asset audit terminal0. This is canonical cleanup, not arbitrary6
removal or a display-only deletion.

A separate structural failure boundary remains explicitly outside that fixture:
Source main can commit Core and then reject HUD-origin capture before consume.
That skips publication of cleanup and spawn events, and triggers presentation
failure. Destination deletion alone cannot recover those unconsumed events or
prove a settled handoff. The valid-publication watchdog repair must not conceal
this separate missing-publication problem. Ordinary6 main/cleanup does not wait
for asynchronous audio completion.


## 7F7F primary-completion physical failure

User explicitly closed the second capture with GOTOVO: ordinary6 disappeared
late, then drag worked but next3+3 was rejected. This installed candidate is
physicalFAIL. ExactPID27002 GamePerformance capture22:12:39.857–22:14:44.211
CEST,124.353311s; console detached with verified Mac-host SIGKILL, profiler
Mac-host SIGINT, no phone process signal. CPU sample coverage79.957335–
124.340335s includes3401 rows/2119 Main samples; potential-hangs export has
zero rows (100ms threshold), which is not a60fps or correctness PASS.

Actual production Bootstrap/runtime-authority regression reproduces both
symptoms without artificial caller replies: old6 survives the normal<900ms
cleanup window, old pendingOrdinarySix and depleted caller remain after4s,
and remaining3+3 is rejected. BeforeSDK terminal65, four exact assertions,
`/tmp/native-ordinary-depleted-before-sdk.log`. Source review found two writer
divergences: ordinary main invokes fresh authority before consumed source node
retirement, causing model/physical roster mismatch; actual destination cleanup
marker resolutionOwned=true disagrees with canonical ordinary destination
resolutionOwned=false. No checker/receipt relaxation is authorized. Primary
repair will reconcile those writers and invoke the genuine continuation after
exact physical retirement; watchdog remains fallback.

### Candidate7F7F: watchdog recovery did not settle the main transaction

The user's next physical result is **FAIL**: the6 disappeared only after the
watchdog, and a later3+3 was rejected while dragging still worked. The previous
watchdog fixture deliberately preserved an unsupported caller. It established
fallback destination cleanup, not successful normal transaction continuation.
It must not be presented as proof that the production ordinary6 path settled.

The actual complete production Bootstrap root now reproduces all four symptoms
with restored Journey2, moves1, an accepted3+3 and a separate remaining3+3 pair.
It uses the real runtime authority/checker, no artificial unsupported response,
no canceled timer and no manually completed main. Before-fix SDK terminal65:
`/tmp/native-ordinary-depleted-before-sdk.log` lines229–233: old destination
survives the normal900ms bound, pendingOrdinarySix persists, caller remains, and
the next3+3 is rejected.

Two actual producer mismatches explain the failed continuation. Main publication
starts the forced checker while its captured physical source is still retained,
although Core already removed that source. The strict physical roster therefore
has an extra source. Separately, the actual destination cleanup marker reports
resolution ownership, while ordinary Core reservation omitted that ownership
field. Either mismatch can reject the unchanged physical runtime receipt and
make the caller unsupported. The fallback watchdog correctly cannot fabricate
completion of that caller or release the old pending merge6.

The bounded correction retires the genuine completed main contact and
synchronizes its actual source removal before enqueuing the existing Source
FIFO continuation. Captured plan, generation, scope, caller receipt/admission
epoch and installation fences prevent an old callback from continuing a new
board. Core publishes destination resolution ownership only for a nonfinal
actual Source destination while its cleanup owns it; Raw and final semantics
remain unchanged. There is no relaxed3+3 guard, checker, receipt, fake arrival or
arbitrary caller clear. New Source/raw/final ownership tests and the real root
continuation/strict-authority capture assertions are ready. SDK, Release,
installation and renewed physical acceptance remain pending.

Primary correction validation: actual SDK27/27 PASS terminal0, all canonical
Core465/465 PASS terminal0, KING330, feature and NativeiOS asset/target gatesPASS.
Timed actual production-root rerun reports137.619ms drop-to-old-six removal
under300ms, valid strict fresh authority and next3+3 accepted. This simulator
receipt does not establish physical phone timing or60fps; new Release pending.
Logs `/tmp/native-ordinary-depleted-{after-sdk,core-full,timing-sdk}.log`.
