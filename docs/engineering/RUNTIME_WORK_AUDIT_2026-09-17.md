# Runtime work audit — 2026-09-17

Read-only follow-up requested by the user, with three independent agents and parent source verification. No production code, assets, build, native bundle, or installation changed. Findings below are not a ranking of measured thermal energy.

## Priority findings

1. **GraphicsPool repeats GSAP timeline searches.** `src/modules/object-pool.ts` release calls five killTweensOf operations, including the Graphics target twice, then reset repeats those five. Acquire invokes reset again: 15 calls per acquire/release cycle. Local GSAP implementation traverses timeline children for these calls. Merge smoke uses this pool in `fx.ts`. Candidate repair: consolidate unique-target cleanup at actual ownership boundaries while preserving interruption safety. Prewarming also unnecessarily cleans never-animated new objects.

2. **Disposed Laser media can poison the global fallback decision.** In `lasergun-finale-scene.ts`, a pending play promise rejection invokes handleVideoFailure after disposal. It sets orbsHevcUnavailable before the fallback DOM helper checks disposed. Actual-source reproduction with an injected late AbortError confirms the next scene contains SVG fallback and no video. Candidate repair: reject stale owner callbacks before changing global capability state, retaining true active media failure fallback. Physical frequency and relative SVG/video energy costs are unknown.

3. **Journey smoke pool retains retired card DOM.** `journey-card-idle-bounce.ts` releases smokeContainer but never clears its _sourceCard property; `dom-element-pool.ts` reset does not clear custom properties. Actual-source reproduction confirms the reacquired empty pool node retains the old card and detached world ancestor. Clear the owner reference after required bookkeeping. This is bounded retention, not proven unbounded growth.

4. **Normal and Magnet merge paths increment global cubes-cracked twice.** `app-core.ts` and `app-merge.ts` increment statsService directly, then call window.trackCubesCracked; the wrapper in `main.ts` increments the same singleton again before per-board accounting. Besides incorrect totals, this repeats serialization and synchronous persistence. Establish one global increment owner while retaining per-board and Arcade accounting.

5. **Save equality includes a freshly generated timestamp.** `app-core-save-state.ts` adds Date.now before `app-core.ts` compares the serialized state with lastSavedState. Equal gameplay at different milliseconds is treated as changed. Compare gameplay content with storage-key identity separately; preserve timestamps on genuine saves and synchronous lifecycle durability.

6. **Drag publishes geometry without a remaining bounds consumer.** `drag-core.ts` reads tile bounds and canvas rectangle on pickup/movement to publish gameplayDragBounds. The field is carried into the artwork frame but has no production consumer. Preserve the setter's foreground/depth refresh and accepted drag layering when removing unused geometry. Pointer tracing additionally constructs geometry before checking the production diagnostics guard; move that same guard earlier.

7. **Merge-6 collects diagnostic-only board state.** An unconditional collection across tiles, STATE.tiles and the grid computes values used only by logs. Actual final-merge decisions use the central resolver, and a separate terminal collection serves real behavior. Gate only diagnostic collection; do not alter the gameplay resolver.

8. **High-score persistence verifies twice.** stats-service saveStats verifies its write; updateHighScore reads/parses again. Consolidate verification while preserving retry and storage-failure behavior. Existing board-stat debounce, equal-state suppression and lifecycle flushes should remain.

## Lower priority and negative findings

Robo retains 16 finale textures in the asset cache after sprite cleanup: 3,702,208 bytes of calculated RGBA pixels (about 3.53 MiB), not a measurement of device residency. This is bounded cache residency, not evidence of repeated per-run growth. Do not blindly unload shared/live textures or remove assets.

No new gameplay-time subscription leak was confirmed. Existing board-stat persistence already debounces and flushes lifecycle transitions. Cleanup must preserve these safeguards.

## Evidence and limits

- `logs/runtime-audit-round2-20260917/resource-owner-reproduction.mjs`: actual source functions extracted with TypeScript AST and run under jsdom.
- `logs/runtime-audit-round2-20260917/resource-owner-reproduction.json`: smoke retention and Laser late-abort results.
- These reproductions inject lifecycle conditions; they do not prove how often those conditions occur on the phone.
- No full QA run is warranted for this documentation-only audit. The two targeted reproductions passed their defect assertions.
- **NEEDS PHYSICAL TEST** for thermal attribution and sustained FPS. The previously installed phone build remains unchanged; recent source repairs are not yet installed.
