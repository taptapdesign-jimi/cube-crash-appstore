# Native Forest comparison with v10

Reference: `journey-fluidity-v10` / `8e4364e8`. Style comparison uses that
source; timing comparison uses the same current build with native Forest OFF/ON.
These are separate controls. No baseline/save reset or physical installation.

| Item | Finding and correction |
| --- | --- |
| Original art, locked labels, Unit placement | Original specification reused; geometry matches. Last Unit scroll extent intentionally fixes clipping. |
| Physical card flip | Signed v10 turns, 1050px camera, separate 2D backdrop; original faces, paper and stats. |
| Close landing | Card-only bounce and original smoke ordering; finite scoped cleanup. |
| Interim | Original World burn/glow; no New Reward masked shimmer. |
| Ordinary card shimmer | v10 owner returns with ENABLE_UNLOCKED_CARD_IDLE_BOUNCE=false before shimmer; do not introduce an inactive effect. |
| Forest bees | Missing native owner found; canonical web planner projects finite original-asset trajectories for native rendering. |
| Idle onset | Correct 180ms smoothstep and main phase zero, replacing native 520ms quintic/opposite phase. |
| New ribbon | Original center 45%/55%, (+11,-10), 41deg. Font13cqw resolves to11.7px against90px card; original tracking and tiny text shadow restored. User-requested override: ribbon top y=0 on small and large fronts; retain accepted pre-open visual NEW through opening, remove at return-flip start. Canonical viewed/save timing stays unchanged; shimmer removed. |
| Homepage navigation shadow | Original ellipse 60x15, color #EEDACA at80%, blur3px; wide original asset uses120vw−96px and40px−10vw left, cover. |

QA benchmark is isolated in a copied project under `/tmp`. Production has no
probe dependency. Same payload/build/configuration and canonical save, only
`--jimi-native-forest` differs. Native CADisplayLink measures callback entry
intervals in BOTH conditions. Record first entry separately from three warm
repeats; alternate OFF/ON/ON/OFF. Exclude other routes and cancellations.
No screenshots, recording, build or QA during timing windows. Observer and
XCTest overhead remain limitations.

Animation Hitches template availability was tested with a10s isolated Simulator
trace. Actual result: `Hitches is not supported on this platform.` Raw log:
`logs/native-forest-comparison-20261006/instrument-support.log`. Therefore these
measurements must NOT be called presented FPS. Phone frame pacing, memory/heat
and user feel remain NEEDS PHYSICAL TEST. Beach/Area55 remain gated.

Lifecycle review found and fixed a renewal response race: an accepted chunk arriving
while modal/parked is retained without decode or animation, so resume does not skip
11 seconds. Explicit bee session identity resets the native owner only after a
new logical Forest; gameplay/stats returns preserve the session. Actual UIKit
regression covers pending reply, park/resume and replacement. Final source QA:18gates PASS,524suites/3915tests; Gameplay KING330PASS. UIKit23PASS, including original main-first exit order and unchanged authored durations.

Pilot cohorts are excluded: first had printf buffering; the later OFF pilot used
the pre-session-fix build. Final same-build cohorts require immediate row writes,
UTC timestamps and raw callback intervals. These QA helpers stay outside production.

## Controlled parser diagnosis and intermediate measurements

The initial matched ABBA candidate failed the improvement check. Warm native
Hub→Forest intervals had p95 17.602ms, worst83.148ms,19 intervals above25ms and6
above50ms across6routes. Its matched web control had16.747ms p95,32.805ms worst,
1 above25ms and0 above50ms. The separate process stack sample synchronized to
actual retained-Hub Forest entries found repeated full bee-plan parsing on the
main thread. The earlier unsynchronized40s sample missed Forest and is excluded.

A validated immutable snapshot now travels through Host/View/route preparation;
its1655 bee frames are parsed once. Per-frame numeric reads and asset admission
are no longer repeated, and immutable asset lists/visual bounds are cached.
Malformed-input, stale-receipt and lifecycle protection remain enforced.

The parser-only same-build ABBA repeat had native warm p9517.263ms, worst33.005ms,
3 above25ms and0 above50ms. Matched web:16.788ms,31.780ms,1 above25ms and0 above50ms.
Median first-callback latency improved78.319→49.832ms but remained above matched
web32.433ms. This metric is reported separately: the first callback is not a
frame-to-frame interval. Native Back readiness still took1846ms vsweb1598ms.

The next source review found an authored order error: native main Unit exited
last with130ms extra stagger, while v10/current canonical `mainExitFirst` starts
it first. The corrected order preserves670.8ms main motion and all easing.
Accepted Back now returns only its admission receipt after the same fresh
canonical-state validation; stale Back retains its refresh snapshot. It does not
transfer/reparse an unchanged World solely to leave it. Final repeat below.

Raw cohorts, exact build/payload identity and per-route intervals are retained in
`logs/native-forest-comparison-20261006/` and
`logs/native-forest-comparison-parser-20261006/`. Profiling and functional video
runs are excluded from all timing statistics. Back callback windows differ
between web/native; only whole-action-to-ready latency is compared for Back.

## Final same-build ABBA result

All4 actual UI cohorts PASS. Per condition:2 first-entry routes and6 warm routes.
Final exact QA identity is in `logs/native-forest-comparison-exit-20261006/benchmark-build-identity.json`;
full raw rows in `benchmark-results.json`, summary in `benchmark-summary.json`.
Native and web share the same app/payload/save; only the Forest flag differs.

| Warm Hub→Forest | Web control | Native final |
| --- | ---: | ---: |
| p95 callback interval | 16.757ms | 16.951ms |
| Worst callback interval | 32.688ms | 33.342ms |
| Intervals >25ms / >50ms | 1 /0 | 4 /0 |
| First-callback median /worst | 32.508 /35.379ms | 50.710 /53.470ms |
| Whole action→input-ready median | 1591.629ms | 1628.447ms |
| Back whole-action→ready median | 1591.845ms | 1662.776ms |

First-entry results stay separate: native p9516.763/worst44.184ms vsweb
16.809/33.383ms (2 routes each). No measured callback interval exceeded50ms in
any final cohort. This does not erase the separately reported initial callback
latency, which still exceeds50ms on some native warm entries.

**PASS:** deterministic ownership and measured reduction of the initial native
candidate's long callback stalls (worst83.148→33.342ms; >50ms6→0) and Back latency
(1846.943→1662.776ms). **FAIL to establish native-over-web improvement:** final
native still has a slightly heavier callback tail, later first callback and
slower readiness. Small Simulator/XCTest cohorts are not presented-FPS proof.
**NEEDS PHYSICAL TEST:** actual presented frames, sustained memory/thermal and
user feel. GateB remains OPEN; Beach/Area55 stay on web. No physical installation.

## Final uninstrumented Simulator preview

The temporary benchmark was removed. Final source build/installation uses only
the opt-in native Forest flag on QA Simulator1018BE2D.1977files are byte-identical
across dist, separate Native resource folder, built and installed app;1868original
repository assets are also byte-identical. Exact identity:
`logs/native-forest-v10-preview-20261006/preview-identity.json`. Final index
`8d5343f2f39439fc580f9f9bf7bdc02f509d6ba058a3d202a8fad97a71ee07b1`;
uninstrumented dylib
`d94afe95e94d127903c6389838dbfd121c2a2f77a34f90d71e2cfa5fddac68be`.

Actual routes2PASS/0fail/0skip: scroll/completeUnit10/Back/reopen75.657s;
regular-card signed flips/Close/Continue/realExitStage/retainedreturn74.454s.
Log `/tmp/native-forest-v10-preview-ui.log`, xcresult17-51-21. Original attachments
and friendly screenshots are in the final preview folder. Home shadow, Forest
bees/original art, full legal-scroll Unit10, original stats without brownplane,
landing smoke and retained-return screenshots were visually inspected.
`startup-excluded.png` is an early startup frame, not Home/navigation evidence.
Static card screenshots do not prove edge-on motion; prior exact50ms recording
remains the unchanged flip-owner evidence. Native23UIKit tests cover signed
turns and lifecycle. User feel acceptance remains OPEN.

Original-target qa:ios reports NEEDS SYNC for the intentionally unchanged PWA;
separate-target exact-byte/identity verification above applies. No phone/PWA or
legacy installation, uninstall, save reset, runtime asset edit, commit or push.
Natural Fail/Clean evidence remains in the earlier candidate report; score
preservation on the observed Clean resume is still unproven. Do not silently
promote this Simulator preview into physical or multi-World acceptance.

## CTA and board-transition continuation

The later Simulator preview matches card Play/Continue to the Homepage button
recipe and restores the original WebKit Forest board transition using an exact
ready/ACK coverage transfer. Independent cloud clocks and authored audio wait
for that transfer. Gameplay/progression/save and the original prepared-frame
paper successor remain web-owned. This is a functional presentation correction;
the ABBA measurements above predate it and are not measurements of this build.

Final fullQA18gates/525suites/3925tests, UIKit24tests and actual preserved-profile
regular/interim route1test each PASS/0skip. Actual Continue and transitions01/02
were visually inspected, including video phases through canonical game entry.
Exact identity, artifacts and limitations: `logs/native-forest-cta-transition-20261006/README.md`.
Physical Forest performance/user acceptance remains OPEN; Beach/Area55 stay web.
