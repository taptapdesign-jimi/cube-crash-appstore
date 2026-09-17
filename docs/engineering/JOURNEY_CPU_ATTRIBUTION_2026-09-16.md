# Journey CPU attribution — 2026-09-16

Installed178314d1. CPU TimeProfiler explicitly attached WebContent52736, trace23:14:43.479–23:16:06.085,82.606s. UserKRENI23:15:09.496 toGOTOVO23:15:59.650,50.154s. CPUtrace savedbeforeconsole intentionallystopped. Sources/native unchanged.

Evidence: logs/journey-instruments-20260916/ contains trace, toc.xml,cpu.xml, parsedcpu-samples.json,cpu-analysis.json,console,markers,analysis.json and reproducibleparse_cpu.py. Hostconsole-to-JSclock alignment usesmedian offset; receiptlatency/rounding introduces uncertainty of severalms. This is statisticalCPUprofiling, not exactwalltime perfunction orGPU/presentation measurement.

-9completewindows2656frames,mean16.893ms,worst207ms,16>34ms;10thermalnominal,noinrangeerrorcandidates. Profiler overhead means absolutecomparison withpreviousunprofiledrun is notcausal.
-Homepage exits4max20/17/18/17ms. WorldUnitenters2max29/27ms. Hubviewport4max45/24/38/42ms.
-The45/38/42ms recurringRAF gaps contain approximately15/6/7ms main-threadsampleweight. Thisdoesnotprove the remainder isGPU; waiting/scheduling and sampling limits remain.
-Source has twoRAFboundariesbeforeanimationstart. Theyexplain prepare-to-startlatency, NOT independently thelonggapofacontinuouslyrunningRAFsampler. Do notclaimdoubleRAFcausesallreportedframegaps.
-FirstWorldprepaint includesbackgroundImageIO/libz/CoreGraphics stacks andmainthreadURLSchemeTaskDidReceiveData/shared-bufferIPC. Actualimage-worksummary recordsweights; exactassetnames unavailable. Thusimage-processingburst isobserved, butdominantbottleneck/exactassetnotproven.
-ManyWebCoreinternalframesareunsymbolicatedaddresses; namedupdateRendering ancestorsdonotidentifyaparticularDOMelement orlayoutoperation. Global207msworst lacksperframe timestampinold5ssoaksummary and cannotbeassignedexactly.
-Read-onlysourceaudit finds100msinteractivityrestorecallback stylewrites thengetComputedStyle, andscrollrestorationgeometryreads. Candidatesonly,no runtimecausalproof; leaveacceptedmotionunchanged.

Next: AnimationHitches rendering/presentationtrace onexactinstalledapp toseparatecallbackcadence fromactualmisseddisplayframes. No performancepatch guessedfromCPUprofile.


## Rendering follow-up — completed

Animation Hitches capture saved successfully to `logs/journey-hitches-20260916/journey-rendering.trace` (802 MB). All profiler and console processes are closed. Trace: 23:19:20.411–23:20:50.799 CEST; user KRENI 23:19:52.013 to GOTOVO 23:20:44.534 (52.521 s). Same installed 178314d1 build; no source, asset, bundle, or installation changes.

Reproducible exports and analysis: `hitches.xml`, `rendering.xml`, `parse_rendering.py`, `rendering-analysis.json`, `cpu.xml`, `parse_cpu.py`, `cpu-analysis.json`, `large-stall-cpu.json`. XML references are resolved across the whole export. Transition alignment uses median host-receipt minus JS clock offset; several milliseconds of uncertainty remain. Rendering table rows may include nested/duplicate intervals: do not sum their durations. Frame lifetime is pipeline latency, not the display frame interval.

Findings:

- Nine complete console windows: 2,556 frames, mean 17.564 ms, worst 712 ms, 29 gaps >34 ms and three >250 ms. Ten thermal samples nominal. These results include substantial profiling overhead and are not directly comparable to the unprofiled acceptance run.
- Four Homepage exit scopes: worst JS callback gaps 18/18/18/19 ms; no Apple hitch start within those scopes. Four World Unit enters: 25/24/31/18 ms; one Apple single-refresh hitch during the third enter. Smooth JS cadence alone therefore does not prove every display deadline was met.
- Journey viewport preparation gaps: 50/39/42/37 ms. Apple hitch starts do not coincide with those short scopes. Two later single-refresh hitches occur about 282–284 ms after the third/fourth viewport scope starts, outside the current short scope coverage; their annotations report 15/18 offscreen passes. Need to measure the complete Hub reveal, not only its preparation.
- Fifteen Apple hitch records start within the user window: thirteen approximately 16.67 ms and two much larger records. This is missed-deadline duration, not total frame duration. Apple calls the associated causes *potential* issues, not proven element-level attribution.
- The large record at 23:20:27.041 lasts 749.97 ms, after the fourth World entry animation scope completed. Its render interval is 767.89 ms, paired GPU interval only 7.13 ms. The subsequent frame has a 663.18 ms app-update interval. This is not evidence of a shader executing for 750 ms.
- Another large record starts 23:20:42.679 and lasts 2,516.57 ms, extending beyond GOTOVO by approximately 0.661 s. It occurs after Homepage entry, with a 2,512.33 ms render interval and 1.34 ms paired GPU interval. Do not call the entire event part of the user test or dismiss it as profiler overhead without evidence.
- Exported GPU intervals with starts in the user window peak at 9.325 ms. This does not exclude GPU queueing, scheduling, compositor waits, or WebContent delays. Host-app CPU export has no samples in the two large-stall windows; it cannot identify their cause and does not prove idle WebContent. This capture targets the native host, unlike the earlier separate WebContent CPU capture.

**Verdict: FAIL against uninterrupted frame delivery.** User acceptance of the authored motion remains valid; the capture is not a reason to change its curves. No crash/reload is established by this data. No runtime repair is claimed.

Next targeted work: extend opt-in transition measurement over the entire Hub cascade, record each global long-frame timestamp, and correlate image decode/first-paint and render-layer activity on that same clock. Inspect shadow/filter/mask/compositing owners implicated by repeated offscreen passes, but require an isolated before/after experiment before attributing blame or altering accepted visuals. The earlier 138 ms unprofiled spike is still not causally attributed; new profiled stalls cannot retroactively explain it. Follow web-first approval before installing any runtime change.


## Safe source changes and narrower follow-up capture

After user authorization to proceed, two redundant synchronous reads were removed without changing animation, assets, geometry, scrolling, input, or timing:

1. `restoreJourneyScrollableInteractivity` now obtains its diagnostic computed-style/height snapshot only with the existing detailed-diagnostics opt-in. Functional scroll styles and event cleanup still run. The actual-function regression proves normal restoration performs no diagnostic style/height reads and detailed mode retains its snapshot.
2. Hub entry uses the prepared final opacity directly. Only a locked card lacking a finite prepared value reads computed opacity. Actual owner regressions preserve target opacity values while reducing three prepared-card queries to zero.

These are verified reductions in unnecessary work, **not proof that either caused the recorded display hitches**. No filter, mask, shadow, image, bounce curve, stagger or idle motion was removed.

The opt-in `journey-hub-cascade-homepage` / `journey-hub-cascade-world-return` span now covers runtime preparation, waiting for images, the first visible tween, all targets, and the idle handoff. Route cleanup, DOM replacement and superseding entry finish the old span; late old callbacks cannot finish a replacement. Its existing five-second diagnostic timeout remains a bound, not animation cancellation.

Compact soak summaries now carry at most 24 `longFrames` records per five-second window plus `longFrameOverflow`. Each record has absolute `startAtMs`, `endAtMs`, and `durationMs` on the same performance.now callback clock as transition spans. Existing hidden/resume and diagnostic-walk exclusions remain. There are no per-frame logs or DOM reads; diagnostics remain disabled in normal bundled use. New callback-clock measurements must not be treated as identical to older RAF-supplied timestamps or as GPU frame duration.

Follow-up protocol after web approval: install the verified bundle, launch with only compact performance diagnostics, and repeat Homepage → Hub → World → Hub → Homepage several times, including the first entry and a brief settled pause. Capture KRENI through GOTOVO without Instruments. Correlate exact long-frame intervals with full Hub milestones and prepaint scopes. This isolates ordinary app behavior from heavy-profiler overhead; it does not alone prove which masked/shadowed element caused an Apple offscreen-pass annotation. Any subsequent rendering experiment should change one owner at a time and retain the accepted appearance.


## Timing-only observer isolation (next experiment)

The compact physical run on cd9a8ac0 localized the 134/137 ms interval to Hub cascade ~288 ms after start, with images ready at +2 ms and first visible tween at +55 ms. Resource snapshot timestamp JS20402 precedes the interval JS20433–20567 by31 ms. The snapshot timestamp is not its completion timestamp; asynchronous rendering consequences remain possible. Neither correlation nor source reads prove causation.

The single changed variable is periodic sampler resource work: default performance mode now emits `sampleMode: timing-only` with only at/reason/visibility/frameTiming. Explicit detailed mode or forced memory-warning snapshots emit `sampleMode: resources` and retain resource fields. Only resource-mode periodic emission resets/skips a frame baseline; timing-only emission includes its own possible bridge/logging cost. Existing other diagnostics (including Settings route geometry) remain unchanged so this is an isolated experiment, not a claim that all instrumentation is cost-free.

Independent review and8 sampler regressions PASS. Animation/gameplay/assets are unchanged. The next physical comparison must separate completed and interrupted enters, include multiple repetitions, and avoid claiming that absence of a rare stall establishes its elimination. Experiment protocol: `logs/journey-timing-only-20260916/experiment.md`.


### Timing-only device result

Installed5e3f9dac0; KRENI23:45:24.928 → GOTOVO23:47:21.734 CEST. All24 periodic reports confirmed timing-only. Capture intentionally stopped after buffered read.23 complete windows,6862frames,mean16.771ms,worst169ms,19>34ms,zero>250ms;24nominalthermal samples andno logged in-rangeerror candidates. Long initial idle means this is not117seconds of active navigation; three route cycles were observed near the end.

Hub Homepage cascade maxima31/29/30ms (two complete,one interrupted); return22/26/25ms (two complete,one interrupted). World Unit enters30/33/30ms. The earlier134/137msHub spike was not reproduced, but this small/unequal repetition set cannot prove the periodic resource walk caused it. Residual preparation maxima: Hub50/38/40ms; Worldprepaint62/37/31ms.

A169ms callback interval atJS94397–94566 straddles the firstHomepage exit span start94561:164ms precedes that scope. Its own transition gapmax is28ms. Thus the large interval is associated with firstnavigation afteridle, not demonstrated as an authoredexit-animation hitch. Need input-handler-to-animation-start attribution before prescribing a motion/render change. Other instrumentation remains a potential influence. The whole-record mean is dominated by idle and must not be presented as improved navigation performance. Strict stall-free verdictFAIL; source QA/deliveryPASS remain distinct.
