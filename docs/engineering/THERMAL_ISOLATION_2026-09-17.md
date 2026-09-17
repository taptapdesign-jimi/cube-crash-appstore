# Stationary thermal workload isolation — 2026-09-17

User requests decisive attribution after inconclusive heat tours. This is diagnostic intervention, not a claimed heat fix. User confirmed brightness setup, battery100% and cable connected; retain cable and 40% brightness, automatic brightness off throughout. Verify actual brightness, charge/battery state and thermal state in native/Power exports, rather than trusting the requested setting alone.

## Scope

Explicit `--cc-performance-diagnostics --cc-thermal-isolation` launch shows a small panel. Normal launch has no panel, timers, renderer wrapper or animation pause. Local web preview is `http://localhost:5174/?ccThermalIsolation=1`. Web HTTP verified; CUA reports no browser available, so no interactive browser acceptance claimed.

Six interventions, individually selected:

- ambient: freeze the shared Journey ambient canvas draw owner; preserve the last frame, surfaces, and lifecycle.
- journey-units: freeze settled Unit/cloud paint in the canonical World coordinator and legacy area ticker; entering and lifecycle cleanup continue. Generic GSAP probes do not cover these custom tickers.
- sheets: freeze shared Pixi animation clocks; preserve leases/textures/controllers. Does not cover procedural Flower, GSAP idle motion or every special family.
- pixi-render: temporarily intercept renderer submission only. Ticker, state, input and save owners continue. This is a diagnostic upper bound on rendering workload, not an acceptable shipped gameplay optimization.
- css-idle: pause only currently running infinite Web Animations/CSS animations. Resume paused, connected targets; finite transitions untouched. Does not stop animation inside image resources.
- gsap-idle: pause only active infinite visual tweens targeting DOM Elements/Pixi Containers. No global ticker/timeline suspension, delayed calls, finite transitions or arbitrary nonvisual targets. Does not cover every nested/procedural effect.

No assets modified; no board generation, progression, save or gameplay rule changes. Source hooks cost one inactive-state branch in normal operation. No repeating shader/audio/finale suppression during active play: that could alter gameplay handoffs and is explicitly outside this stationary experiment.

## Protocol

1. Cool phone to comparable starting state, same cable/brightness throughout; record charging, battery, LPM, thermal and exact app identity. Attach capture only to Stack to Six/iPhone 13 blue. KRENI only after verified launch and profiler start.
2. Open the same Forest map viewport, let entry settle. Start ambient probe and release the phone. Automatic sequence:5s initial quiet; A1/B1/B2/A2 each5s settling+20s measurement =105s total. Only B suppresses selected owner. Same fixed diagnostic panel remains in A and B.
3. Repeat CSS-idle and GSAP visual-tween probes at the identical viewport if ambient alone does not explain workload. Owner-count zero means no conclusion.
4. Open one board and let all transitions settle. Run Pixi-render, then sheets only if shared-sheet owners are present. Any touch aborts immediately before game input proceeds; do not play during a probe.
5. If idle owners do not explain active-game cost, profile matched play separately: Forest1 regular/Star baseline,2 Bee,3 Flower,4 Honey,7 Barrel/TNT cumulative pool. Stage number alone is not isolation: record actual tile families, successful merges and effect counts. Do not require all five stages before the stationary results are evaluated.
6. User explicit GOTOVO closes capture; retain logs, export tables and verify A return recovers normal behavior. Keep interrupted runs for debugging but exclude them from comparison.

Safety: input, background, blur/pagehide/resize, scene fingerprint change, replacement and errors release suppression. Fingerprint samples primitive state once per second; phase logging only, no per-frame console or style scans. Source tests cover ABBA, cancellation, timer cleanup, failure paths, actual canvas draw freeze/resume, and shared sheet owner preservation.

## Interpretation

Power scores are not watts. Compare each A/B/B/A window, its coverage and owner counts. A similar reduction in both B windows with recovery in A2 is stronger evidence than one before/after average. Reject runs with changed brightness/charging, significant thermal throttling, scene changes or missing samples. System power includes cable/other processes; use alongside attributable process CPU/GPU samples. Approximate device/host clock alignment must be checked. A 20s window targets workload; case temperature is lagging confirmation, not causal evidence.

One reduced score does not prove the largest total heating source, leak absence, or permanent repair. Follow the responsible owner with native/WebContent stacks and implement a bounded fix, then repeat the same comparison with full authored visuals restored.

Analysis helper: `logs/thermal-isolation-20260917/analyze_isolation.py`. Validation and delivery evidence in that directory. No new physical results yet.


## Prepared capture and validation

Final qa:full PASS13/13,347suites/2298tests including KING24/306; qa:fast PASS. Initial new ambient test omitted required className; corrected fixture and reran full gate successfully. Source-only native compile passed, then official bundle synced and qa:ios passed. Signed delivery being prepared. UI HTTP source verified, interactive browser unavailable.

First capture uses all-process Time Profiler (native, WebContent and GPU process CPU) plus compact console and actual native brightness/battery state. `analyze_cpu.py` splits completed ABBA windows per process/leaf. Verify process association, distinguish GPU-process CPU from GPU hardware work, and account for profiling overhead; do not infer GPU watts from this trace. If a component explains substantial CPU work, confirm resulting energy change with Power Profiler; `analyze_isolation.py` handles its interval exports. Native batteryState values:0unknown,1unplugged,2charging,3full. Initial candidate text-selection native fix is retained in this package.


Delivery verified18:54CEST: entrySHA256 `2ddfbcc2215c16cbe71f426c80d9244e48fefeed1d414d72ac40104de00f3c33`,1766rawassets unchanged across all packages, codesign PASS, App installed on iPhone13blue containerC6852846-DDB4-40EB-B342-2FD52096C908. Launch/capture was rejected before execution by automatic approval review for missing fresh explicit SPREMAN after preparation. User confirmation requested; no active recording and no verified launch yet. Respect the rejection. Physical validation pending.


## First physical probe: complete, instrumentation failure limits attribution

User confirmed GOTOVO—stop(complete). All-process trace saved exit0, console intentionally closed after buffer read; no active recording. Trace begins18:55:33.785. Bridge bug: panel posted string whereas native receiver expects object with level/message, yielding blank phase records. Source repaired and actual panel-to-native-envelope test added. Original raw console retained unchanged. Source also now has direct journey-units probe after verifying Unit motion runs in custom tickers, not only GSAP repeating tweens.

First apparent run18:56:23.790 aborted18:56:46.732. Second14-message sequence18:56:49.713–18:58:34.733 exactly matches105s installed ABBA sequence, supported by user reporting ambient measure-start0 and final complete. Window reconstruction is **INFERRED**, not validated intervention: labels, fingerprint and owner counters were lost. `inferred-windows.json` and `isolation-cpu-inferred-analysis.json` kept separate from valid-label analysis. No synthetic events were inserted into console.

| Inferred phase /20s | WebContent61614 CPU ms | GPU process61616 CPU ms | Stack to Six61612 CPU ms |
| --- | ---: | ---: | ---: |
| A1 | 4534 | 3181 | 1405 |
| B1 ambient suppressed | 5099 | 2712 | 1641 |
| B2 ambient suppressed | 5045 | 2721 | 1641 |
| A2 | 4503 | 3368 | 1358 |

Mean summed CPU for these three processes: A9174.5ms vsB9429.5ms (+2.8%); GPU-process CPU -17%, WebContent +12%. This does NOT demonstrate reduced total CPU work or prove ambient is the main heat source; GPU-process CPU is not GPU hardware utilization/energy. Ordinary WebContent/GPU association inferred from startup adjacency/single named candidates, not an explicit host link. Native brightness40%,battery100%,statefull,thermalnominal throughout sampled test. Memory warning18:56:23 preceded inferred complete run and released13,048,744idle bytes. WebCore visibility/render/IntersectionObserver leaf work remains present. Dylib overlap symbolication warnings retained.

Next: corrected bridge + direct settled journey-units probe, same viewport/conditions. Confirm positive owner/suppression counts, valid A/B/B/A labels and return recovery before causal claims. Do not ask for all gameplay stages before resolving stationary workload.


Corrected bridge + direct Unit ticker probe: final qa:full13/13 PASS,349suites/2300tests including KING24/306; actual coordinator settled-only freeze/enter/resume regression PASS. qa:ios,Xcode BUILD SUCCEEDED,codesign PASS;1766assets verified unchanged across source/dist/Web.bundle/final app. Corrected entrySHA256 `6e3a36d4e805988d53ac1f70cb898e365ee8ad310fa1183c7e7661c9739e3280`. New capture directory prepared `logs/thermal-unit-isolation-20260917`; no capture started there yet. Next probe is Map:Unit floating with ambient left on.
