# World prime physical review — 2026-10-03

## Delivery and user acceptance

Stack to Six installed over existing data on iPhone 13 blue and exact-launched
at 00:01:46 CEST with performance diagnostics. Entrypoint SHA-256:
`8759f3d42334c3f9a24800f58cd0250991801dba578079d3727f90709e8b381e`.
Source, official Web.bundle and signed final app matched; iOS gate passed.
Pre-delivery full QA passed 18 gates / 468 suites / 3,211 tests.

The user explicitly requested phone testing before a separate web acceptance.
Test covered normal World navigation, card interactions, Area55 board 25,
Clean Board exit, then approximately two minutes of rapid World/Hub/card routes
including Homepage returns. Capture stayed uninterrupted through `gtovo`.
User subsequently reported **`skoro pa nema trzaja`** and **`jako je bilo fluidno`**.
This accepts perceived fluidity for this tested build/route; it does not promote
a new complete production baseline or certify App Store readiness.

## Evidence

Archived raw console: `logs/world-prime-physical-20261003-000146/console.log`.
Raw-console SHA-256:
`c509869ceddaf15cee10667c0cdcc3fa5808e7d2556ee51915d982046bf97109`.
Derived analysis: same directory, `audit.json` (its `full` summary includes
samples through app time 500000; active-test boundary below is 485804).
Capture includes additional idle samples while the completed trace was read.

| Metric | Prior rapid run | Current rapid run |
| --- | ---: | ---: |
| App-relative comparison window | 583–631s | 340–463s |
| World prepaint captures | 12 | 17 |
| World prepaint worst callback interval | 139ms | 32ms |
| World prepaint intervals over 34ms | 12 | 0 |
| World Unit enter worst interval | 84ms | 60ms |
| Hub prepaint worst interval | 47ms | 85ms |
| Hub return cascade worst interval | 30ms | 58ms |
| Surrounding callback worst interval | 138ms | 96ms |

These are different-duration, manually played routes, not a matched laboratory
benchmark. Counts cannot be compared as rates without normalizing exposure;
maxima are observations, not a whole-game percentage speedup. Callback timing
is not presented GPU FPS. The current rapid run has 7,381 timing samples,
86 intervals over 34ms and none over 250ms. Thus “zero stutter” is not established.

Through app time 485804 (end-of-test read): 28,883 timing samples, weighted mean
16.789ms, worst 110ms during startup, 146 over 34ms, none over 250ms. All 114
native thermal samples in the complete capture, including post-test idle, were
**nominal**. The phone began charging and became unplugged early in the run;
brightness varied 50–55%, Low Power Mode stayed off. Battery telemetry remained
85%, so this is not a reliable battery-drain/energy estimate or a temperature
measurement in degrees Celsius.

World priming's new synchronous phase samples never exceeded 1ms (rounded):
maximum per-transition totals were style reads 1ms, neutral-axis normalization
2ms, transform hydration 6ms, pose writes 5ms. The cold first World prepaint
still reached 70ms; its largest gap preceded the first sampled prime work and
overlapped image readiness. Do not claim all cold/raster cost is removed.

Clean Board board-25 return adopted its existing prepared plan (109 targets,
115 images). First World Unit started 26ms after result-last-visible; World
enter peaked at 28ms with no interval over 34ms. Result opening separately
had a 92ms interval. User did not separately confirm spaceship fly-out in this
run, so its prior visual defect remains unclosed despite overall fluidity approval.

## Residual review, not a speculative patch

The worst rapid interval, 96ms at app time 427398–427494, spans Forest X input
and World-to-Hub exit setup. Hub prepaint began at 427413 and reported an 85ms
callback gap, but its measured `render-hub` work was only 2ms and geometry
commit rounded to 0ms. World exit began at 427428 during the same interval.
Source confirms `prepareJourneyHubPrepaint` and the outgoing World animation
overlap by design in the existing close owner. Awaited image readiness and
WebKit style/raster/compositing are not separately attributed by this console.
It would be incorrect to assign the full 85ms to Hub DOM construction.

If further polish is requested, first split instrumentation at the outgoing
World exit initialization, image-ready dispatch/completion and first painted
Hub boundary, or collect a validated WebKit/Instruments profile. Preserve the
currently accepted visible motion and cancellation owners. Do not add delays,
retain all Worlds, alter assets, or remove artwork merely to suppress a metric.

No runtime code was changed after this physical acceptance. Only host console
PID 79722 was SIGKILL-detached after buffered output was preserved; native app
PID 16517 was verified still running. No reinstall, restart, uninstall, commit,
push or benchmark promotion followed the test.

Verdict: delivery **PASS**; requested World-prime improvement and subjective
rapid-route acceptance **PASS for this run**; universal zero-hitch/thermal,
spaceship fly-out and App Store readiness remain unproven. Preserve this tested
candidate and keep the residual findings separate from its accepted improvement.
