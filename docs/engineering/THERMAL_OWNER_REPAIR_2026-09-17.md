# Evidence-led thermal owner repair — 2026-09-17

User explicitly requested agents, concrete fixes, and no more aimless physical test tours. Three independent bounded audits plus parent source work identified actual unnecessary work. No active device capture. Preserve approved motion/assets/gameplay and unrelated dirty work.

## Evidence and attribution

- High brightness is an independent display load. Existing98% vs41% captures show raw display-power metric29–31% lower at lower brightness in comparable screen phases; units unspecified. Map CPU impact stays1→1 and GPU~2→2. Therefore do not tell user brightness proves the code is fine, or that code can guarantee a cool phone at100%. Thermal timing comparisons are confounded by different play counts.
- Actual native stacks in saved all-process trace: `Element::scrollTop → Document::updateLayout → updateStyleIfNeeded → resolveStyle`. In inferred normal A windows,564/532ms CPU per20s passes through getter (561/532ms nested layout/style), about12% of WebContent samples. Suppressed inferred B windows have0 getter samples. Phase reconstruction remains inferred because first diagnostic bridge was broken. This identifies a reachable synchronous flush path; no promise that all CPU disappears rather than being deferred to rendering.
- Ambient suppression did NOT reduce summed native/WebContent/GPU-process sampled CPU; B+2.8%. GPU-process CPU−17% is not hardware GPU energy. Do not designate ambient the proven dominant heat source.
- No verified leaked active-gameplay Pixi loop surviving stop/Home. Native background/cleanup stop ticker; shared-sheet owners detach at last release. Wild-star hidden visual work remains a secondary unpatched candidate, not main heat attribution.
- Profiling mode itself has continuous RAF sampling; final acceptance must distinguish normal launch from instrumentation.

## Three concrete repairs

1. `journey-ambient-canvas-runtime.ts`: idle draws use cached scroll position instead of reading `scrollTop` every frame. Passive scroll events update scalar position; initial geometry, explicit geometry refresh and resume refresh it. Ticker alone still moves canvas window and repaints pixels together. Dispose removes listener. No asset, path, cadence or density change.
2. `journey-world-animation-coordinator.ts`: main cloud motion wrapper is height100% of the full map. Observing it kept the entire main Unit considered visible when only its empty box intersected. Visibility now observes its actual cloud children. Motion wrapper, target setters, cloud motion, conservative partial initial observations and cleanup are preserved.
3. `animated-special-artwork-layer.ts`: do not assign identical zIndex/visibility/display values to roots every frame. Only changed values are written. Real depth/finale/drag and hidden/resume transitions remain immediate.

## Validation and review

Actual-owner tests cover60stationary frames with zero scrollTop reads, native/programmatic scroll events, geometry refresh, resume, delayed bitmap placement, disposal;60steady layer syncs with zero style mutations and genuine depth/visibility transitions; observed cloud leaves, all offscreen suppression, cloud-only resume, partial first observer batches and cleanup. Focused parent17testsPASS; agent cloud/mobile/isolation11testsPASS. Independent agent source review **PASS**, native scrolling/thermal effect **NEEDS PHYSICAL TEST**. Full QA completed350suites/2307tests,KING24/306,lint,visual,build,bundle/native-source audits PASS. Original full command reported2type-gate failures in new observer test fixture (incomplete observer-entry cast and ticker-add mock return); fixed fixture only, exact type-check and unused-type-check rerun PASS, affected5behavior tests rerunPASS. Original failure log retained; do not describe original full command exit as0. All selected gates now pass. Logs in logs/thermal-owner-repair-20260917.

HTTP5174 serves both updated render owners. No interactive browser available. Do not promote this to an approved production baseline or claim the whole heat complaint solved.

## Evidence paths

- `logs/thermal-isolation-20260917/independent-inclusive-stacks.json`
- `logs/thermal-isolation-20260917/independent-scroll-read-stacks.json`
- `logs/thermal-owner-repair-20260917/`

Apple references: https://developer.apple.com/documentation/xcode/improving-your-app-s-rendering-efficiency and https://developer.apple.com/library/archive/documentation/Performance/Conceptual/EnergyGuide-iOS/AvoidExtraneousGraphicsAndAnimations.html . Brighter pixels require more display energy; unnecessary drawing activates CPU/GPU/display. These explain mechanisms, not this phone's exact thermal shares.

Post-sync qa:ios PASS; signed native build underway. No new capture requested. Delivery will use ordinary launch without performance/isolation flags; no hidden new thermal measurement claimed.


## Delivery completed

Xcode BUILD SUCCEEDED; qa:ios/codesign PASS;1766rawasset hashes agree source/dist/Web.bundle/finalapp. EntrySHA256 `06336c7f0bc92830ebdaf3b884e89929c992e33fd4edadd51b31c5679a631915`. App installed overexistingdata on iPhone13blue, containerA464DFE1-FD54-4902-B0AC-BB5E6DC5DFBF. Exact bundle normal launch19:16CEST confirmed with no console/performance/isolation arguments. No new profiler/capture active, no physical thermal acceptance claimed. Final verdict: source/native delivery **PASS**, actual thermal/scroll acceptance **NEEDS PHYSICAL TEST**. No reset/uninstall/assets changes/commit/push.
