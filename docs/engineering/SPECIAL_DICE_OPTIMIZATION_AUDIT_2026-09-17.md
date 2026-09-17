# Special dice optimization audit — 2026-09-17

Read-only runtime audit requested after the Laser repair. Three bounded agent reviews plus parent call-site verification. No gameplay code, assets, native bundle or installed app changed. This is not a measured thermal comparison.

## Findings, ordered for follow-up

1. **Fish finale preloads on unrelated Journey entry.** `journey-boards-manager.ts:12935` calls `preloadFishFinaleBubbles()` unconditionally on Play; `ui-manager.ts:486,643,782` also calls it for Arcade routes. That function also prepares the swimmer. On iOS both owners call `.load()` on their retained video on every preload invocation (`fish-finale-bubbles.ts:80–86`, `fish-finale-swimmer.ts:167–182`). Forest/Area55 entry therefore requests two irrelevant Fish media warmups, and repeated entry can reload retained media. Runtime calls are confirmed; decoder cost, bytes and thermal contribution are unmeasured. Follow-up: eligibility-aware preparation, including saved boards, and idempotent preparation until consumption; preserve actual-play readiness, error fallback and active-video teardown.
2. **Spaceship hidden debris is processed and made visible again.** In `spaceship-finale-scene.ts:801–859`, first hide sets opacity zero, scale .06 and hidden=true. On the next update, unconditional opacity=1 and final-visible scale assignments execute; hidden=true prevents the hiding branch from restoring opacity zero. The same finished item continues geometry reads/writes until scene cleanup. Fix should skip finished hidden items before geometry work while preserving backwards timeline seeking and replay reset. Existing lifecycle tests do not cover two consecutive frames after hide. A temporary regression probe using actual attachSpaceshipFinaleScene/master onUpdate reproduced opacity 0/scale .06 at hide, then opacity 1/scale .6 on the next frame (+1/60 s). Probe asserts the current defect, not a fix; retained under logs/special-dice-audit-20260917/spaceship-reproduction.test.txt with its result log. Temporary test removed from source tree.
3. **Flower duplicates scale easing computation.** `flower-bouncy-artwork.ts:116–125` samples identical SCALE_TIMES/SCALE_SPLINES for X and Y separately; each inverse-Bezier solve has 18 bisections. Share the interval/progress calculation, retaining distinct X/Y values. This is a small arithmetic opportunity, not an established major thermal cause.
4. **Fish idle repeats unchanged style writes.** `fish-swim-artwork.ts:372–377` assigns opacity, z-index, display and visibility on each frame. Guard identical values while retaining live transforms and correct resume/depth updates. Browser work saved needs measurement.

5. **Honey collision solver repeats invariant property reads.** `text-bolts.ts:342–362` reads scale/x/y and parses left/top repeatedly inside eight pair-relaxation passes. For 16 visible bees the loop executes 3,264 GSAP getters per update (excluding opacity filtering), versus 48 for one scale/x/y snapshot. Cache base properties once per update while preserving mutable offsets and exact pass ordering. GSAP getters are not automatically forced DOM layout; CPU/thermal magnitude unmeasured.
6. **Bee finale repeats unchanged writes.** `bee-finale-scene.ts:605–680` repeatedly assigns opacity, hidden-leaf styles and diagnostic data across its 42 leaves. Guard unchanged values while preserving active trajectories. No measured thermal attribution.

## Existing safeguards verified

- Barrel: Pixi-only idle; one shared atlas (~19.52 MiB decoded estimate), resource lease, visibility checks, independent phases and last-owner ticker detachment. Atlas participates in shared 48 MiB idle budget.
- Flower: one shared 256×256 source (256 KiB decoded estimate), Pixi transforms, hidden-branch suppression and controller cleanup. Bounded retained source is not evidence of a leak. Finale updates its 27 flowers through one master callback; sorting occurs on depth promotion.
- Robo, Juice, Mushroom, Ball and Wild Star: shared Pixi sheet per family, shared ticker, independent per-tile phases, texture assignment only when selected frame changes; protected live references, idle eviction and pressure cleanup.
- Fish: active media has suspend/dispose paths; active finale cleanup pauses, removes source and releases media. Unused prepared video is a separate lifecycle concern.
- TNT-derived Barrel/Flower: existing variant-preload routing and scoped frame-cache retirement apply. No Laser-style DOM convergence loop found in their idle owners.
- Shared DOM artwork layer reads canvas geometry once per shared update and detaches when last owner releases. No evidence from this audit justifies removing movement/depth synchronization globally.

## Validation

Nine focused suites / 67 tests PASS: Barrel, Flower, shared Pixi resource lifecycle, TNT cache/retirement, Bee/Spaceship lifecycle, Fish media visibility and shared layer depth. Evidence: `logs/special-dice-audit-20260917/focused.log`. Passing existing tests does not cover every newly found defect. Previous complete QA of unchanged runtime source remains in the Area55 repair report.

**Verdict:** source audit identifies remaining defects/redundant work; do not label all dice fully optimized. **NEEDS PHYSICAL TEST** for actual CPU/GPU/thermal benefit. No new phone test requested or initiated.
