# Area55 capture-driven repairs — 2026-09-17

## Scope and evidence

User authorized repairs after the critical Area55 physical capture. That capture remains a physical FAIL: native thermal state reached serious, six memory warnings occurred, and long frame callback gaps preceded serious thermal state. See CRITICAL_AREA55_CAPTURE_2026-09-17.md. Its Instruments CPU/power exports are empty; no energy attribution or measured thermal improvement can be derived from them.

These changes remove demonstrated unnecessary work and improve attribution of the unresolved merge-completion stall. They do not establish a single cause of all heating or guarantee cool operation at full brightness.

## Runtime changes

1. **LaserGun pre-entry layout:** replaced iterative DOM transform-write/geometry-read convergence with one coherent geometry snapshot per gun and the same constraint calculations in arithmetic. Each solve reads field, rig, axis and barrel rectangles once (four rectangle reads); the former nested loops could reach 768 rectangle reads per gun in the upper-bound path. This is an operation-count reduction, not a measured time or energy saving. Left mirror, right rotation, scale, target, entry/relay paths and live firing-marker resolution are preserved. Nonzero geometry differential tests and actual-scene tests cover the change. No assets or authored animation durations were changed.
2. **Kanta unused origin:** four merge call sites now pass a lazy origin resolver. Kanta's centered sequence does not resolve the unused origin and avoids its canvas rectangle read. Other sequences still measure before overlay cleanup/DOM writes. This is not claimed to explain the full 175 ms Kanta gap.
3. **Memory-warning diagnostic overhead:** the three warning receipts now use cache counters rather than three full DOM/style/animation/GSAP inventories. Idle audio/sheet release and renderer cleanup remain intact. This specifically reduces diagnostic-capture overhead; the expensive receipts were not a general explanation of ordinary-build heating.

## Diagnostic reliability

- Merge traces retain gaps over 250 ms instead of silently clamping them.
- Captured trace ownership prevents a late asynchronous phase marker from being assigned to a later merge.
- Added absorb-completion, frame-readiness, geometry, source-removal and multiplier phase markers in the shared merge-6 completion path. The nearby smoke marker pair uses the same owner. These markers measure the unresolved shared ~80 ms corridor; they are not a gameplay optimization or proof that the whole corridor is fixed.
- Native `webViewWebContentProcessDidTerminate` persists one bounded incident record: timestamp, host PID, URL, version/build, thermal state and last native memory-warning timestamp. The previous incident is logged at next controller start. No forced reload or save behavior change. This callback does not identify Jetsam versus crash and cannot capture every native host death.
- `scripts/verify-instruments-capture.py` rejects empty CPU/power exports. It rejected the latest capture as expected and accepted a previous populated capture. The workflow now requires a short completed recording/configuration health check before involving the user in another profiling sequence. Sample presence alone does not prove correct process/time attribution.

## Verification and delivery

- Three agents provided implementation and independent bounded review; no blocking finding remained.
- Laser focused tests: 33 passed; independent layout/scene review passed.
- Parent sampler/merge focused tests: 15 passed.
- Initial full QA: 353 suites passed, one failed because the native-pressure test harness still injected the old snapshot function name. Harness updated to the new dependency; original failure log retained.
- Final full QA: **PASS**, all 13 gates, 354 suites / 2,335 tests; Gameplay KING 24 suites / 306 tests. Exit 0, log `logs/area55-quality-repair-20260917/qa-full-final.log`. Final marker delta independently reviewed PASS.
- Native Swift source compile: BUILD SUCCEEDED (unsigned generic iOS build; not a delivery artifact).
- localhost:5174 serves the updated Laser and pressure-snapshot code, verified by HTTP fetch. Browser/physical visual acceptance has not been performed for this patch.
- Source and local dist changed. No new Web.bundle synchronization, phone installation or physical capture. Installed phone entry remains `36aac6568cdc9138cbc242b90a859767160d461fd88972d06da5d93fea1ea9c2`.

Physical verdict remains **NEEDS PHYSICAL TEST** for this candidate. Shared merge-completion CPU attribution, sustained thermal effect, board-entry stutter and the original spontaneous-logo reset remain incompletely explained. No generic repeated gameplay tour is requested as part of this source repair.
