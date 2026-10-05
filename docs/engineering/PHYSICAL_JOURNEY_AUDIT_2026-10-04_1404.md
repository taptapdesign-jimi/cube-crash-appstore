# Physical Journey regression audit — 2026-10-04 14:04 CEST

## Verdict

**FAIL — do not use SHA-256 `62b76f3ddaa6e60e57af66a9bb880da252657e63c5f4ed0d4e186e9b84892e00` as an accepted production baseline.**

The build/install pipeline and deterministic gates passed, but the physical iPhone 13 blue test failed the product requirement: accepted navigation must begin motion immediately, must never expose a preparation surface, and must not hitch when entering Hub, entering a World, or returning from gameplay.

This document is a read-only diagnosis and implementation handoff. No source fix followed this capture.

## Exact test identity

- Device: `iPhone 13 blue`
- Bundle: `com.taptapdesign.stacktosix.Stack-to-Six`
- Bundled entrypoint SHA-256: `62b76f3ddaa6e60e57af66a9bb880da252657e63c5f4ed0d4e186e9b84892e00`
- Diagnostic launch: 2026-10-04 14:04:22 CEST
- KRENI: approximately 2026-10-04 14:04:31 CEST
- GOTOVO: 2026-10-04 14:09:36 CEST
- Runtime flags: performance diagnostics and native thermal telemetry enabled
- Initial conditions observed: thermal nominal, battery 95%, Low Power Mode off

## User incident markers, in order

1. 14:05:17 — `problem kada u hub ulazim imam blic huba 1 frame i onda ponovni load`
2. approximately 14:06 — `uzasan iz iugre ulaz u beach screen jako los trzaj..`
3. approximately 14:06 — `kada kliknem homepageslider imam cekanje prije nego krene animacija :(`
4. approximately 14:06 — `ovo je regresija sve poboljsaj`

## Evidence boundary

The interactive native stream delivered the transition, soak, audio and thermal records quoted below. The requested host `console.log` did **not** retain that JavaScript stream; it contains only a CoreDevice initialization error from an earlier launch attempt. Therefore this audit may use the received records, source inspection and user markers, but it must not claim a complete lossless on-disk console chronology. Fix the capture transport before the next acceptance run.

The RAF records are JavaScript callback intervals, not GPU-presented FPS. No Instruments CPU/GPU/power sample set was collected. Thermal attribution beyond Apple's reported state is not allowed.

## P0 findings

### P0.1 — Hub prepaint escapes its cover and causes the one-frame Hub flash

**Proven root cause.**

The first Homepage-to-Hub route measured:

- Homepage exit: approximately 701 ms, worst callback interval approximately 38 ms.
- three resident World preparations: approximately 240 ms, 400 ms and 249 ms.
- `journey-screen-prepare`: approximately 1047 ms total.
- Hub enter/cascade: isolated approximately 102–103 ms callback intervals.
- a native memory warning immediately after Hub entry.

A later repetition independently measured `journey-screen-prepare` at 1048 ms, with `resident-worlds-ready` at 999 ms and `hub-paint-ready` at 1048 ms. The Homepage exit finishes hundreds of milliseconds before the preparation barrier.

`warmJourneyV700HubForHomepageReveal()` temporarily makes `#journey-screen` `display:flex`, `visibility:visible`, `opacity:1` and its Hub targets full opacity for three frames. It assumes Homepage is an opaque foreground cover. That assumption is false once the 701 ms Homepage exit has completed while the 1047–1048 ms preparation is still running. Its `finally` block then restores the screen state. `showCollectibles()` subsequently primes the screen hidden and starts the real enter. The resulting visible sequence is exactly: full Hub frame(s) → hidden/reset → canonical Hub enter.

There is a second correctness defect in the same function: successful paint does not restore the previous target opacities (`previousTargetOpacity` is restored only when `painted === false`). That lets preparation styling leak into the later enter owner.

**Required correction:** eliminate live full-alpha Hub prepaint from the accepted-tap transaction. Never depend on a cover whose lifetime is owned by a different promise. The preparation surface must remain non-presented until one atomic route commit transfers it to the visible enter owner. Restore every temporary style on every exit path, including success.

### P0.2 — Homepage CTA intentionally waits before starting motion

**Proven architectural cause; exact delay for the reported tap was not persisted.**

`showCollectiblesScreenWithAnimation()` queues the request whenever `homepageEnterTransitionOwner.isActive()` or `__ccIsHidingCollectibles` is true. `queueJourneyOpenAfterHomepageEnter()` then awaits the complete Homepage-enter owner and may yield up to eight additional RAFs before it calls the real route. No Slider exit motion is scheduled during that wait. This exactly permits the reported “tap, then wait, then animation”.

Even on the direct path, the accepted gesture performs synchronous navigation cleanup, board-FX cleanup, soft board reset, paper/background mutation, hero freeze and route bookkeeping before scheduling the exit animation.

**Required correction:** an accepted CTA must synchronously claim/transfer the current Homepage presentation, cancel or finish its enter owner from the current painted pose, and schedule the first WAAPI/GSAP exit keyframe in the same task. Do not wait for the old enter to settle. Defer non-visual cleanup until after the motion has been scheduled.

### P0.3 — Hub visibility is blocked on three complete World surfaces

**Proven architecture/performance failure.**

`prepareJourneyScreen({ requiredForVisibleEnter: true })` does not permit Hub reveal until `prepareJourneyResidentWorldsForHubReveal()` has built and retained Forest, Beach and Area 55 and `warmJourneyV700HubForHomepageReveal()` has painted the Hub. In the measured repetition, resident Worlds consumed 980 ms of the 1048 ms preparation. This is the dominant reason the route outlives the Homepage exit.

The same first entry produced a native memory warning. Building and retaining all rich World DOM/image surfaces before showing a lightweight three-card Hub is therefore not a safe admission rule on this device.

**Required correction:** Hub visibility must depend only on Hub readiness. World readiness must never gate the Hub's visible enter. Maintain a bounded route working set: the live Hub, the current/selected World, and lightweight metadata/readiness for other Worlds. When a World is tapped, start the selected/non-selected Hub exit synchronously and prepare or atomically acquire only that destination under the still-visible outgoing animation. If the destination misses the animation budget, extend an owned opaque outgoing cover—not an exposed paper-only gap—and record the miss. Do not keep all three heavyweight Worlds resident after a memory warning.

### P0.4 — Gameplay → Beach return does expensive preparation at the handoff boundary

**Proven timing failure; the user's exact perceived hitch cannot be reduced to one recorded frame because the full stream was not persisted.**

The captured Clean Board return recorded:

- destination adopted behind result at +63 ms;
- HUD exit complete at 270 ms with a 45 ms worst update;
- board exit owner complete at 410 ms;
- settled-cover paint requested around +869 ms;
- 96 image nodes checked, image readiness completed around +915 ms;
- three paint frames completed at approximately +917, +930 and +946 ms;
- destination declared painted at +947 ms;
- modal exit owner complete at +1008 ms;
- route handoff started at +1052 ms.

Although the World plan was marked `reused:true`, the return still enumerated 96 images, forced all prepared targets to full opacity, waited three connected paint frames, and delayed the route handoff until roughly one second after CTA acceptance. This is not a true resident return.

**Required correction:** park the actual current World presentation across gameplay instead of reconstructing/repriming its whole target set. Patch only the progression delta for the completed board/card while the terminal result is still visible. A reused return must not traverse all Units, redispatch all images, or repaint all targets. The terminal cover and destination must share one transaction: destination already committed behind the cover, cover exits, first Unit begins immediately. The existing accepted Clean Board/Fail choreography remains unchanged.

## P1 findings

### P1.1 — Audio/cache pressure is still churning after the memory warning

**Proven pressure/churn; not proven as the direct cause of a particular hitch.**

A later resource sample reported:

- soundtrack decoded bytes: 22,921,368;
- gameplay-audio decoded bytes: 12,581,192;
- gameplay-audio idle bytes: 8,948,792;
- memory-pressure mode active after one native warning;
- 614 requests, 535 hits, 53 misses and 26 pending hits;
- 52 decodes totaling 25,250,748 bytes;
- 22 evictions totaling 12,669,556 bytes;
- 30 decoded buffers retained;
- one Journey long-loop owner active but suspended, with three retained media objects.

The critical Journey package prevented total collapse, but the combined resident DOM/images, soundtrack and effect cache still crossed native pressure and caused churn. Do not blame audio alone; treat it as shared memory-budget failure.

**Required correction:** establish one device-level memory budget across Journey DOM/images, runtime textures, soundtrack and decoded effects. Preserve only the active route package and current Special family. Retire genuinely idle decoded effects before destination construction, never during visible motion. After pressure, forbid speculative World residency and make the next route operate in a reduced working-set mode until a stable interval proves recovery.

### P1.2 — Average FPS hides transition spikes

Settled windows were often near 16.67 ms and thermal stayed nominal, but transition windows contained 35–40 ms intervals and the first Hub entry contained approximately 102–103 ms intervals. A good average therefore does not satisfy the product requirement. Acceptance must be based on input-to-first-motion latency and worst visible transition frames, not only five-second averages.

### P1.3 — Capture transport is not lossless

The PTY displayed rich JS diagnostics, but `--log-output` did not persist them to the named file. Before the next run, tee the actual PTY output into the session artifact or add a bounded native persistence/export path. Verify the file is growing and contains a known JS sentinel before saying KRENI.

## Replacement architecture

Do not add another boolean, watchdog or full-alpha hidden/prepaint branch. Replace the handoff contract with these owners:

1. **JourneyRouteDirector** — the sole state machine for Home, Hub, World, Game and terminal-return transitions. It owns one generation, input gate, outgoing motion, cover, destination commit and completion. Existing route, visible-enter and stage tokens must become internal leases of this owner rather than independent authorities.
2. **JourneySurfaceStore** — owns stable Hub/current-World DOM identities and bounded retention. It exposes `prepareDetached`, `commitHidden`, `activate`, `park`, `patchProgressionDelta` and `evict`. It never changes screen visibility.
3. **JourneyPresentationOwner** — the only code allowed to change `hidden`, `display`, `visibility`, `opacity`, `z-index`, pointer events and enter transforms for `#journey-screen`. Preparation code cannot write these properties.
4. **ForegroundBudgetCoordinator** — blocks optional decode, eviction, cache trim and off-route construction from the accepted input through the final incoming animation frame. It does not wake hidden Pixi.
5. **RouteWorkingSetBudget** — one budget spanning DOM/image surfaces, decoded audio and textures. Native pressure atomically drops speculative surfaces and idle audio without destroying the active/next route pair.

The visible transaction must be:

`pointer accepted → first outgoing transform scheduled in same task → destination prepared/selected underneath outgoing owner → one atomic hidden commit → outgoing owner hands visibility directly to incoming owner → incoming cascade → input unlock → bounded post-transition trim`.

There must be no intermediate state in which paper alone, a preparation surface, or a fully visible destination appears before its enter owner.

## Implementation order for the next agent

### Phase 0 — preserve and instrument

1. Tag or commit this rejected candidate only as evidence; do not mark it approved.
2. Fix lossless console persistence and add one route transaction ID to every related diagnostic.
3. Add timestamps for `pointer-accepted`, `first-exit-animation-created`, `first-exit-frame`, `destination-ready`, `destination-commit`, `cover-release`, `first-enter-frame`, `enter-complete`.
4. At each visibility mutation, log the current presentation owner plus screen/cover `hidden`, computed display/visibility/opacity/z-index and bounding rect. Diagnostics must be gated and must not read layout in production.

### Phase 1 — close the flash and immediate-tap blocker

1. Remove Hub full-alpha screen prepaint from `warmJourneyV700HubForHomepageReveal()` and remove success-path style leakage.
2. Make Journey screen visibility writable only by the presentation owner.
3. Replace `queueJourneyOpenAfterHomepageEnter()` waiting with an interruption-safe ownership transfer that schedules exit immediately from the painted pose.
4. Move `cc-navigation`, board-FX cleanup and soft reset after first motion scheduling unless a focused test proves one must precede it.
5. Stop joining Hub reveal to all-World residency. Hub preparation and Hub visible enter form one bounded transaction.

### Phase 2 — bounded Hub → World working set

1. Keep the Hub stable and prepare only one predicted/current World during true settled idle.
2. On tap, synchronously start the canonical selected/non-selected World exits.
3. Acquire the tapped World if resident; otherwise build it detached during the 516 ms Hub exit and atomically commit it before reveal.
4. Never connect a full-alpha prepaint node without a route-owned opaque cover whose lifetime is longer than the preparation.
5. On memory pressure, evict speculative Worlds and disable speculation until recovery; never disable input without a visible product-level fallback.

### Phase 3 — true gameplay return residency

1. Park the current World surface on game entry; stop idles/listeners but preserve DOM identity and already-decoded visible art.
2. On progression change, patch only the affected card, stars, label and unlock marker from canonical save state.
3. Prepare the affected Unit's hidden enter pose while the terminal result is visible.
4. At CTA, transfer the terminal cover directly to that parked World; do not enumerate 96 images or prime all 92 targets.
5. Preserve every existing accepted Clean Board/Fail exit duration and last-visible boundary.

### Phase 4 — memory/audio convergence

1. Add a unified working-set snapshot and route-pressure policy.
2. Retain CTA/Journey and active Special audio; release idle non-route effects before destination construction.
3. Ban decode, speculative completion and ordinary trimming during visible route motion.
4. Validate zero avoidable re-decodes/evictions during the measured Home ↔ Hub ↔ World ↔ Game ↔ World loop.

## Required regression tests

- Preparation lasting longer than Homepage exit never exposes Journey before its enter owner.
- Successful and failed warm/preparation paths restore every temporary style.
- CTA during Homepage enter schedules outgoing motion in the same task and does not wait for enter completion.
- Hub visible enter does not await Forest/Beach/Area 55 construction.
- Rapid replacement/interruption leaves exactly one presentation owner and one route generation.
- Hub → each World begins canonical exit immediately with cold, warm and pressure-evicted destinations.
- Game → Forest/Beach/Area 55 reuses the parked surface and patches only the changed Unit.
- Return does not traverse every card/image or replay all hidden-pose writes.
- Memory pressure evicts speculative surfaces/audio but preserves the active/next transaction and never shows a technical modal.
- Repeated ten-minute loop returns DOM, listener, GSAP, Pixi, audio voice/buffer and retained-surface counts to a stable plateau.

## Physical acceptance gate

Deterministic QA is necessary but cannot pass this work. The next candidate is acceptable only after the same natural iPhone test shows all of the following:

- accepted CTA to first visible motion: at most one 60 Hz frame;
- no Hub/World/card flash, reset, duplicate enter or paper-only frame;
- no visible transition callback interval above 34 ms, with a target worst frame below 25 ms;
- first incoming Unit begins within 33 ms of cover release;
- no native memory warning in the repeated route loop;
- no optional decode, eviction or cache trim inside visible transition windows;
- no missing return card, hidden active Unit, Graphics-paused modal, fake final six or stale Special tile;
- all authored active SVG/Special dice animations remain enabled;
- thermal remains nominal/fair without serious/critical escalation;
- the user explicitly confirms that the transitions feel fluid.

Until then the verdict remains **FAIL**.
