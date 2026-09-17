# Journey stationary-map CPU attribution — 2026-09-17

Capture/export PASS; exact visual owner and heat-source attribution NEEDS PHYSICAL TEST.

User GOTOVO18:09:34.967; native console buffered output read before stopping. All-process Time Profiler stopped18:09:42.992 and saved successfully (exit0); console intentionally stopped. No recording remains active. Trace starts18:05:32.130,250.863s. Early export attempted before save finished failed Document Missing Template; repeated only after successful save, final XML parsed successfully. Instruments reports dylib overlap/symbolication warnings; preserve raw trace and do not claim complete stack attribution.

Evidence: logs/journey-map-cpu-20260917/{journey-map-cpu.trace,toc.xml,cpu.xml,markers.jsonl,console.log,analyze.py,analysis.json}. Fixed phase windows:60s from MAPA18:06:18.422;20s from scroll instruction18:07:29.001;30s from explicit STAO18:08:34.688. Scroll instruction is a host marker, not exact touch start. Final viewport differs from initial; post-scroll cost change is not automatically a cadence leak.

## Sampled CPU work

Values below are CPU sample-weight milliseconds per wall second, NOT GPU utilization, watts or energy share. GPU process means CPU work in that process.

| Phase | WebContent60692 | WebKit GPU60693 | native app60691 | backboardd70 |
| --- | ---: | ---: | ---: | ---: |
| WORLD_IDLE | 228.5 | 168.0 | 64.2 | 158.2 |
| MAP_SCROLL | 162.5 | 217.3 | 70.5 | 276.4 |
| MAP_AFTER_SCROLL | 141.1 | 237.9 | 51.5 | 202.4 |

WebContent60692 initial idle has13.712s total sampled CPU/60s;8.385s exclusive leaf samples in WebCore (~61%),1.437s JavaScriptCore (~10%). Named leaves include RenderBox::computeVisibleRectsInContainer365ms, IntersectionObserver::updateObservations326ms, RenderLayer::paintLayerContents172ms, styleForStyleable167ms, applyProperty154ms, RenderImage::paintReplaced129ms. These independent leaf samples support recurrent style/visibility/paint work; they do not identify the triggering JS owner. Inclusive stack counts overlap and must never be added as independent workload.

WebKit GPU60693 has sampled CA::CG rendering and Metal/IOKit paths. This supports rendering/compositing work, not measurement of hardware GPU busy time. Native app60691 alone would miss most of these candidate web-process samples.

Process ownership limitation: trace confirms exact installed Stack to Six60691 path/container6B0AE22C and ordinary WebContent60692/GPU60693 alongside it; enhanced-security WebContent60742 is separate and not grouped. Startup adjacency, single ordinary WebContent and workload alignment make60692/60693 plausible app-associated candidates, but no explicit host-to-WebContent ownership link was exported. Do not present candidate process attribution as independently proven. All-process system services can serve other apps. ReportCrash presence does not prove a game crash; console has no app reload/crash and thermal samples remain nominal throughout.

## Source interpretation and next bounded change

Current Unit idle uses per-element gsap.quickSetter in journey-boards-manager.ts around1803–1843, mobile30FPS, runtimeActive visibility budget. Animated visibility targets are observed with240px margin; visibility observation and style/paint work may be connected but exact causality unproven. Ambient owner uses two full viewport canvas clears/repaints at30FPS,1.25DPR and80px margin; both remain candidates, not permission to remove bees or reduce authored quality.

Next attribution should compare same fixed map viewport with separately controlled Unit-idle paint and ambient repaint in a diagnostic-only web experiment, restore each owner after each short interval, and capture renderer/style cost. This identifies which subsystem merits a small production change. Do not combine both toggles or infer leak from post-scroll viewport changes. A permanent optimization should avoid unnecessary style writes/repaints or offscreen work while preserving motion, depth, input and assets. No runtime code, native bundle, install or asset change made in this capture task.
