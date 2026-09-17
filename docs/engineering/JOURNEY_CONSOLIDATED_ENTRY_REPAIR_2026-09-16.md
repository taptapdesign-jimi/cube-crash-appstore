# Consolidated Homepage / Journey entry repair

The user requested a concrete consolidated repair after repeated performance captures. Physical acceptance of the selected-World bounce remains authoritative; no curve, duration, stagger, art, asset, gameplay rule or save format was changed.

## Verified defects addressed

- Homepage exit previously alternated `getComputedStyle` with transform/class writes for each target. The owner now stops tweens, reads all painted poses, then writes all poses and schedules the same compositor animations. The behavioral test verifies read-before-write ordering and preserved interrupted poses; existing production-vs-GSAP curve comparisons remain.
- Journey's duplicate-entry guard previously ran after navigation dispatch, explicit board cleanup and background mutations. The guard now claims the entry before those effects, including synchronous event reentry. Synchronous and asynchronous setup failures release the published locks and restore the exact prior pointer-events value/priority on the same slider node. A per-request owner prevents stale failures from unlocking replacement transitions. The legacy CSS layout boundary stays; the redundant explicit `offsetHeight` read is removed only for WAAPI.
- `emitSettingsRouteDiagnostic` previously read five nodes' computed styles and geometry whenever the native bridge existed. Compact events now retain cheap route metadata; only explicit detailed diagnostics walk those nodes. Actual-module tests verify zero DOM/style/rect reads in compact mode and full detailed payload retention.
- Journey flow logging previously built DOM snapshots before the logger could discard the message. It now checks the detailed flag first. Two readiness traversals performed only for logs are similarly guarded; functional readiness decisions remain unchanged.
- The global navigation listener scheduled fallback board/FX cleanup at220ms, even when Journey/Settings immediately completed both cleanup owners themselves. The raw timeout was not part of the tracked-timeout registry. A successfully completed explicit `nav:` soft reset now retires that pending fallback at the end of the reset. A failed reset retains fallback; event-only navigation paths remain intact. Tests execute the actual reset and cover both explicit routes, unrelated reasons and failure retry.

These changes remove confirmed redundant work and ownership defects. They do not prove that any single item caused the previously recorded169ms callback interval, nor establish a zero-hitch guarantee. The remaining image-readiness calls were not blindly removed: `decode()` may reject or time out, and caching readiness without source/lifecycle identity could reintroduce missing-image bugs.

## Verification

Independent reviews covered all ownership changes. Actual-function tests exercise duplicate/reentrant entry, lock release, pose preservation, cleanup fallback, and disabled/detailed diagnostic behavior. The first QA run found one stale source-string assertion expecting the former inline pose read; its behavior is now covered by read/write-order regression and the assertion was updated. Rerun logs and final full QA are in `logs/journey-consolidated-repair-20260916/`.

Source/local preview changes are separate from installed5e3f9dac0. Native delivery requires the established web/explicit-install authorization and exact-bundle checks. Physical acceptance remains pending for this new repair package. The next check should validate the complete natural route once as a package, rather than repeat heavy profiling between isolated speculative visual changes.


Final source verdict: **PASS** — `qa-release-final.log`, all13gates,336suites/2210tests, including Gameplay KING24suites/306tests, TypeScript/unused/lint, source-only1044-module productionbuild and bundle/native-source audits. Last pointer-recovery refinement has11 actual-method regressions and independent review. Localhost5174 serves the final sources. Installed phone remains5e3f9dac0; this new package is **NEEDS PHYSICAL TEST** after web acceptance/explicit delivery authorization.


## Physical verification — 2026-09-17

Installed entry SHA `07baf7f3736cd909cbcf39f007e6ea28c66689d540ef72e7dc13ab19fee95bfd`; final native audit, codesign and all 1766 asset hashes PASS. App installed and exact bundled launch verified on iPhone 13 blue. Capture 00:01:50.020–00:04:28.834 CEST ended after GOTOVO; buffered log preserved before intentional stop.

31 full windows / 9279 callback intervals: mean16.717ms, worst167ms,12 intervals>34ms, none>250ms.32 thermal samples nominal; no logged error/reload/crash candidates. Activity is concentrated near the end after long idle: two Hub entries and one World visit, no merge samples. Therefore this is not sustained gameplay/thermal acceptance.

Hub cascades peaked32/21ms, World Unit enter29ms, return24ms (interrupted by user navigation), Homepage enters29/18ms. Remaining stalls: viewport60ms, World prepaint103ms, second Homepage exit57ms. Global167ms interval starts162ms before first exit scope; no responsible-function attribution. Source/native PASS; strict uninterrupted frame performance FAIL; subjective acceptance pending. Do not infer that repaired duplicate cleanup or diagnostic reads caused the remaining stalls. Evidence: `logs/journey-final-device-20260916/`.
