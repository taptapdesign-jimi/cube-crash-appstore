# Journey comprehensive repair — 2026-09-17

## Scope and evidence

User requested a consolidated repair with independent agents after repeated physical reports of unsatisfactory smoothness. Preserve the accepted Homepage/World bounce, assets, gameplay and existing saves. This package addresses transition ownership, diagnostic layout work, Hub animation scheduling and eligible launch-time code preparation.

The previous installed build remains `925e25cb9a296fc358e599ea9c0150f652b33bcf48a14e9f729b9ae6205cba14`. Its user capture measured a 138 ms global interval overlapping the first Homepage exit, versus 16 ms synchronous input setup. That leaves substantial work unattributed: neither this report nor passing tests establishes the sole cause.

A subsequent read-only automatic WKWebView probe of that installed build is saved in `logs/journey-comprehensive-20260917/cold-probe.json`. It measured 23 ms click dispatch, 27 ms asynchronous Journey preparation, 24 ms synchronous reveal, and later 53/41/39 ms frame gaps. No individual intercepted geometry/style/storage read reached 1 ms with the coarse clock. This did not reproduce the first 138 ms stall. Debugger overhead and synthetic interaction limit the comparison. Temporary wrappers were restored, LLDB detached, and no capture remains active.

## Repairs

1. **Homepage cancellation and startup failures.** Finalizing a pending exit now settles its promise; cancellation is recorded against the original promise identity and every navigation continuation checks it. A failed WAAPI startup cleans partial owners and the cached promise so retry works. Journey input release does not wait for a pending preparation. Stale callbacks cannot clear a newer transition. Accepted timing and keyframes remain unchanged.
2. **Diagnostic layout reads.** Journey scroll-lock/unlock geometry snapshots run only with detailed diagnostics enabled. Functional scroll pinning and restoration remain active.
3. **Hub ancestor enter.** The outer scale/translation/opacity bounce uses WAAPI with the exact existing cubic curve, 100 ms delay and 540 ms duration, retaining GSAP fallback and all child cascades. Interruption freezes the painted pose; completion, cleanup and the hidden Hub-to-World handoff retire its owner and restore neutral state. Independent review caught missing opacity and inherited frozen-pose risks before delivery; both have regression coverage. Browser compositing on iPhone remains unverified.
4. **Eligible launch-time preparation.** Journey navigation imports can run beneath the launch screen for existing canonical Journey saves after tutorial completion. Eligibility checks the shared layout version, complete IDs/booleans, canonical serialized bytes and existing interim reconciliation. Fresh/tutorial/migration/missing/noncanonical saves remain on the original lazy route. The singleton still installs its listener and rewrites identical bytes: this is not side-effect-free. Actual constructor/load/save tests verify progression and Arcade save preservation. The 1500 ms deadline bounds asynchronous waiting, not synchronous JavaScript evaluation.
5. **Preparation attribution.** Compact existing performance marks distinguish module waiting, board rendering and counter update, and finish on success, stale work or errors. These marks do not add DOM traversal. Async wait is not a CPU duration.

## Validation and delivery

Independent source reviews passed after corrections. Focused tests cover actual GSAP curve equivalence, actual Hub entry, interruption, stale callbacks, failed animation startup/retry, promise identity, startup eligibility, actual save normalization and preparation outcomes.

Final `npm run qa:full`: **PASS all 13 gates, 341 suites / 2257 tests**, including Gameplay KING (24 suites / 306 tests), type/unused/lint, visual contracts, production build without native sync, bundle audit and native source guard. Evidence: `logs/journey-comprehensive-20260917/qa-full-final.log`. The initial full run found one stale Arcade source-text assertion; it was corrected to verify original-promise await and cancellation before routing, independently reviewed, and the entire gate rerun passed.

The final Hub helper is served at `http://localhost:5174`; HTTP retrieval verified. Browser automation was unavailable, so no interactive web visual acceptance is claimed. Native Web.bundle, built app and phone have not been updated by this repair. No assets, saves or production baseline were reset, and no commit/push was performed.

Verdict: **NEEDS PHYSICAL TEST** after deterministic gates pass. The next acceptance must cover cold Homepage → Hub → World, rapid interruption/back/re-entry, and original save continuity. The package is not proof of zero future frame drops, thermal stability or App Store acceptance.
