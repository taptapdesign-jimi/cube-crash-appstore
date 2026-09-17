# Installed thermal candidate — physical result2026-09-17

**Heat complaint unresolved; gameplay smoothness FAIL.** User PROBLEM18:33:54.203 "osjetim trzanje u igri"; final GOTOVO18:37:20.647 "gotovo jednako mozda malo tpli". Subjectively no clear improvement. Do not label nominal thermal state as acceptable user temperature or claim overheating repaired.

Installed index19b9be325f4e43dd01b79e8d13e696ef06a061b6e02faf99aba46c32729ee41f. Buffered console read before stop; profiler exit0 saved; console intentionally stopped. No active recording. Power trace18:26:59.774–18:37:29.829,630.055s. All four exports succeed; fixed-window parser reused with actual trace start. Evidence logs/journey-thermal-candidate-20260917.

## Phase comparison with previous lower-brightness baseline

| Phase | CPU impact old → new | GPU impact old → new | Brightness old → new |
| --- | ---: | ---: | ---: |
| HOME_BEFORE | 0.659 → 0.520 | 0.140 → 0.100 | 41.000 → 28.000 |
| WORLD_IDLE | 1.000 → 1.000 | 2.000 → 1.471 | 41.000 → 28.000 |
| BOARD_BEFORE | 0.177 → 0.212 | 1.000 → 1.000 | 41.000 → 28.000 |
| PLAY | 1.064 → 2.024 | 1.043 → 1.092 | 41.000 → 28.000 |
| BOARD_AFTER | 0.223 → 0.145 | 1.000 → 1.000 | 41.000 → 41.000 |
| HOME_AFTER | 0.665 → 0.631 | 0.100 → 0.160 | 38.000 → 41.000 |

Scores unitless; not watts or CPU/GPU utilization. Map GPU impact2.000→1.471 is lower in this run (~26% score reduction, NOT energy reduction), CPU stays1.0. Brightness28% initially/41% after play differs from previous41%/38%; cannot isolate code effect or thermal causality. Fixed PLAY120s merge summaries: baseline43,candidate76; workload differs. Candidate stayednominal all630s, but user still warm.

## Verified memory fix

Only recorded native warning18:35:51.563 during return Home. Gameplay audio idle/decoded34,431,560bytes→0; buffer count9→0; async sheet cleanup snapshot confirms0 (already0 before). Main soundtrack22,921,368bytes/active1 retained. This verifies idle audio pressure release on device; does not prove audio cache was main heat source or absence of pressure/leaks. No warning at earlier stutter burst.

## Stutter evidence

RAF gap147ms at JS452631–452778 and288ms at452814–453102 (~18:33:36CEST), overlaps regular-merge6 summary worst250ms (ticker delta differs from RAF). Honey wild window74ms at465963–466037. Additional Wild windows55–63ms. Full correlation saved in stutter-analysis.json. Merge windows indicate temporal overlap, not owning function; don't attribute to Honey only, cache release, or ambient canvas. During gameplay map is not the visible owner. No code change during this capture; subsequent native repair is documented below.

## Native text-interaction attribution and repair

The saved host CPU table now identifies unnecessary native work in the two largest RAF gaps. `attribute_stutter.py` resolves exported backtrace references and aligns the trace start with the median host/JS clock offset. Across145 samples, host arrival offset deviations are -4.3 to +39.8ms; this is approximate correlation, not synchronized signpost timing.

| RAF window | Sampled native CPU | Observed inclusive stack |
| --- | ---: | --- |
| 147ms, JS452631–452778 | 41ms | UIKit gesture dispatch → `UITextSelectionInteraction tapAndAHalf:` (26ms) |
| 288ms, JS452814–453102 | 72ms | WebKit `RequestDocumentEditingContext` → `UITextContextMenuInteraction _querySelectionCommandsForConfiguration` (63ms) → edit menu (51ms) → `__getDDRevealBridgeClass_block_invoke` (34ms), dlopen/dyld/ObjC loading |

Inclusive numbers overlap and MUST NOT be added. Native samples do not account for the entire RAF gaps or WebContent execution. Nevertheless, this is concrete unwanted text-selection/edit-menu work at the reported stutter burst, a strong causal candidate. The147ms gap starts before merge6; merge6 overlap alone was misleading. There is no evidence that memory-warning cleanup caused these gaps.

`GameViewController.setupWebView` now sets `webConfiguration.preferences.isTextInteractionEnabled = false` before WKWebView creation, using Apple's public API (iOS14.5+, app deployment17.0). Existing CSS already prevents selection but did not prevent this native work. Runtime source audit found no editable text fields; Settings uses toggles. Future editable text UI must revisit the policy. No blanket gesture disabling, private API, responder-focus change, gameplay handler/timing/FPS change, or asset changes. Native source QA guards policy-before-creation.

Apple API: https://developer.apple.com/documentation/webkit/wkpreferences/istextinteractionenabled

Evidence: `logs/journey-thermal-candidate-20260917/{cpu.xml,attribute_stutter.py,stutter-cpu.json,text-interaction-totals.json}`. Validation/build evidence: `logs/native-text-interaction-20260917/`.

This repair targets stutters, not a proven dominant heat source. Sustained map rendering remains measured workload; brightness and play rates differed across thermal runs. Broken pressure release was fixed and physically verified; sparse ambient clear was installed but its energy effect remains unisolated. No defensible single dominant thermal cause can be extracted from these measurements. No new installation or physical acceptance of this native repair yet.

The text-interaction work is concentrated, not a sustained host load: entire630s trace has56,650ms native CPU samples versus27ms under UITextSelectionInteraction and74ms under UITextContextMenuInteraction (overlapping categories). Most burst samples are on the native main thread. This supports targeting gesture stutter and explicitly argues against naming this the dominant heating cause.

Validation: **PASS** qa:full13/13 gates,346suites/2285tests; gameplay KING24suites/306tests; qa:ios; unsigned generic-iOS Xcode build in separate `/tmp/stack-to-six-text-interaction-derived` returned BUILD SUCCEEDED. Local dist rebuilt without native sync. Existing Web.bundle and installed app unchanged. Native repair physical acceptance: **NEEDS PHYSICAL TEST**. Original capture smoothness remains **FAIL**; thermal complaint unresolved.
