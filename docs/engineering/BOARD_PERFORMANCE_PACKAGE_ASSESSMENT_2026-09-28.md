# Board performance package assessment — 2026-09-28

## Verdict

Deterministic source and production-build verdict: **PASS**.

Physical iPhone smoothness and thermal verdict: **NEEDS PHYSICAL TEST**. The code and tests prove bounded ownership, cleanup and reduced repeated work. They do not measure device temperature or guarantee a percentage thermal reduction.

## Protected behavior

This package does not change score, moves, merge eligibility, end-game resolution, final Merge 6 decisions, Special/Wild transaction ownership, save/load, input gating or authored visual/audio timing. The separately requested haptic hierarchy remains intentional. `qa:gameplay-lock` passed all 24 suites and 308 tests, including every registered Special/Wild archetype in Arcade and Journey.

## Implemented reductions

| Area | Previous repeated work | Current owner |
| --- | --- | --- |
| Mobile Pixi cadence | Settled and fully static board both painted at 30 FPS | 60 FPS during direct manipulation and bounded authored motion, 30 FPS while a visible settled-motion lease exists, 15 FPS only when the board is truly static |
| Board presentation | Stack and pip rebuilds could occupy separate RAFs and depth changes could synchronously sort the complete board repeatedly | One lifecycle-tracked presentation frame coalesces stack/pip work per tile; Pixi resolves one dirty sort before render |
| Special/Wild visibility | Every shared ticker frame walked visibility state | Shared reconciliation runs at 4 Hz and visibility events still reconcile immediately |
| Direct Special artwork | Stable frames repeatedly read computed canvas style and viewport geometry | Stable presentation and geometry are cached; resize, orientation, reparent, visibility and live CSS transition boundaries invalidate them |
| Shared Pixi sheets | Identical source-frame and pose writes were republished | Frame/presentation writes are signature-gated; foreground transforms still follow the complete ancestor chain every visible tick |
| Wild shimmer | Each tile could own an equivalent generated gradient texture | Same-size owners share a reference-counted texture; cache is bounded to four released sizes and board-transition teardown releases unused textures |
| Wild Magnet drag | Pointer movement rescanned the board twice, recreated movement tweens and repeatedly emitted entry sparkles | One candidate snapshot serves the drag; the discarded generic preview scan is skipped; only affected tiles are tracked; movement retargets only after a meaningful destination change; sparkle fires once per range entry |
| HUD and haptics | Repeated identical Combo reconciliation and nonessential board haptic bursts added work | Identical Combo state skips repeated layout; ordinary stacks and flying HUD stars are silent; every committed Merge 6 remains mandatory; Laser feedback follows confirmed beam contacts; Clean Board retains its weakest authored counters |

## Self-review findings and corrections

The first optimization pass gated foreground synchronization behind the sheet frame signature. That was unsafe because a held animation frame can still move when its board ancestor moves. The final implementation synchronizes foreground geometry on every visible shared-sheet tick while `setFromMatrix` is skipped only when the solved matrix is identical. A real Pixi regression test holds source frame 0, moves/scales the board ancestor and proves that the foreground follows without republishing the source frame or writing the same matrix across 60 stable ticks.

The Magnet review also found a re-entry edge case: if a tile returned toward home and the Magnet re-entered at the same destination, the stale destination signature could suppress the new pull after its return tween was killed. Re-entry now clears that signature, restarts the scale owner and forces a fresh pull. Repeated release remains idempotent, and cancel/restart immediately restores every tracked tile.

The shimmer review added explicit coverage for a globally destroyed generated texture and for five distinct cache sizes. The next acquire replaces an invalid texture; releasing the oldest idle entry prunes the cache back to four.

## Measured deterministic evidence

- Stable direct-art ticker frames perform zero `getComputedStyle` calls, zero geometry reads and zero identical root-style writes while live artwork transforms continue to update.
- Static mobile Pixi cadence changes from 30 to 15 render opportunities per second. Any activity lease immediately restores 60 FPS; a visible continuous Special/Wild owner uses 30 FPS.
- Same-size Wild shimmer owners create one shared gradient texture. Each tile still keeps its own visual mask because removing the authored mask would change the effect.
- Magnet pointer-up still uses the canonical forced drop resolver. Only the unused generic hover result during Magnet movement was removed.
- No new interval, RAF loop, MutationObserver, background worker or full-board RenderTexture was introduced.

## Remaining limits

- Active drag, drop, merge, finale, board enter and board exit intentionally remain 60 FPS. The package reduces work around those paths rather than lowering their accepted visual cadence.
- The Pixi ticker remains alive at 15/30 FPS. Full hidden-page render suspension stays with the existing authoritative gameplay suspension owner; this controller does not create a competing stop/start lifecycle.
- Magnet still evaluates its captured board candidates on throttled pointer updates. A spatial index was rejected here because it would add gameplay-state risk for a small board.
- Wild shimmer still uses per-tile alpha masks. Generated gradient texture duplication is removed, but the accepted local mask cost remains.
- Exact animation feel, worst-frame timing and sustained heat require an unplugged physical iPhone run on the delivered bundle.

## Validation

- Focused final regression: **8 suites / 66 tests PASS**.
- Independent read-only regression review: **PASS**, including the held-frame ancestor-motion probe and zero redundant matrix writes over 60 stable ticks.
- TypeScript, targeted lint, feature-runtime admission and Special-dice performance/archetype admission: **PASS**.
- Gameplay KING: **24 suites / 308 tests PASS**.
- Final `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full`: **all 18 gates PASS**, **438 suites / 2,985 tests**, 1,090-module production build and built-bundle audit.
- Native Web.bundle, Xcode project and iPhone were not changed by this source/build assessment.
