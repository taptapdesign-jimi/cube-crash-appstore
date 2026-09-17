# Journey prepaint commit repair — 2026-09-17

User authorized immediate repair of residual Journey/World stalls after accepting native first-touch mitigation. Current native focus change is preserved.

## Changes

- Prepaint promotion now retires animation owners only in outgoing DOM roots. Previously the bulk `killTweensOf` traversal included the staged incoming subtree which the same function then preserved. Both Hub and World commits pass their retained host explicitly. Global idle ticker/observer/map cleanup still runs. Its DOM cleanup also excludes the incoming subtree before traversal, including idle targets and Alien beam normalization; independent review caught this second cleanup path and tests now execute it rather than mock it. Ordinary full replacement still retires every descendant. Regression tests use real GSAP owners and actual commit methods.
- Incoming subtree/image counts run only with detailed diagnostics. These counts otherwise traversed retained content during the commit microtask even when detailed output was disabled.
- Interim hit-target setup snapshots all geometry before removing old targets or attaching new ones. Container geometry is read once, and all new hit targets are appended in one fragment. Tap handlers, drag suppression, pixel coordinates and scheduling are preserved. Actual-method tests verify read/write order, coordinates, listeners and no-eligible cleanup.

No timing, bounce curve, visual asset, progression or save changes. Commit-time hidden priming is retained: it prevents a final-pose flash before the next frame; visible entry already reuses prepared targets.

## Evidence and limits

Previous all-process trace found WebContent main-thread work immediately before World enter, including27ms inclusive JSC microtask samples in a59ms gap. Symbols do not identify a specific TypeScript function. These changes remove verified unnecessary traversal/animation cancellation and interleaved layout work at that boundary; they do not establish that all remaining23–62ms gaps share this cause. Single-interim Worlds may see little benefit from hit-target batching; retained-tree cleanup applies regardless.

Focused tests:56 PASS, including actual cleanup/commit with real GSAP idle-beam and card-wrapper owners. Independent combined review PASS (8 tests rerun). Initial full QA13gates343suites2265testsPASS; final full rerun after the additional cleanup correction is recorded in CURRENT_HANDOFF and logs/journey-commit-repair-20260917/qa-full-final.log. HTTP localhost5174 verified serving final changed code. Native package/phone are not updated by this source repair unless a subsequent delivery is recorded.

Final full QA PASS13gates343suites2265tests; nativeqa/Xcode/signing/1766asset verificationPASS. Installed5fe719993 on iPhone13blue and exactbundlelaunch verified00:52:16CEST. Acceptednativefocus remains,116.336ms beforedocumentnavigation. PhysicalcaptureKRENI 2026-09-17T00:52:31.315302+02:00; seehandoff forlive session and acceptance status.

## Physical result

48.817s user capture:2664callbackintervals in9fullwindows,mean16.906ms,worst124ms,25>34ms.10thermalnominal,no loggederrors. Homepageexits25/18/19ms,Hubviewport40/42/42ms,WorldUnit30/32ms. Pre-Worldhandoff59/55ms remains comparable toprevious54–58ms; this repair does not establish a meaningful reduction in that boundary stall. One124ms gap falls afterHubreturn andbeforeHomepageenter, outsideexistingmeasuredscopes. Source removalofunnecessaryworkisvalid, but strictuninterruptedperformanceFAIL. Nativefirst-touchmitigationretained. Captureclosed; detailsinanalysis/transitions/correlationJSON.
