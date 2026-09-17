# Special-die animation performance contract

Applies to all four gameplay archetypes (Star, Juice, Magnet, TNT), every visual variant, board idle, spawn, drag and finale. Gameplay KING and asset preservation remain authoritative. A visual variant reuses canonical gameplay; it does not acquire a second resolver or input owner.

## Blocking admission

`npm run qa:special-dice` is part of both `qa:fast` and `qa:full`.

It reads the actual registry through the TypeScript parser and rejects:
- a new variant without an entry in `special-dice-performance-owners.json`;
- an archetype mismatch or stale manifest entry;
- missing idle/finale owner files, warmup/cleanup policy or referenced test files.

The manifest is an ownership/admission index, not a performance certification. Existing entries name current owners and minimum existing regression coverage; they do not assert every behavioral scenario below already has a test. Adding a row alone is insufficient: reviewers must inspect the owner and relevant behavioral assertions. Full QA executes the tests. Physical heat/FPS cannot be certified by this metadata gate.

## Rules for implementation and review

1. **One resource owner.** Reuse shared Pixi sheets/resources where compatible with the authored art. One controller per tile; repeated start/preload must be idempotent. Do not add a second application or perpetual RAF for a visual variant. Preserve independent phases and fallback until ready.
2. **Prepare only eligible content.** Determine eligibility from the actual board/mode reward pool plus restored live tiles. Navigation buttons must not unconditionally initialize unrelated finale media. Use the existing generation-owned post-entry warmup boundary. Cancel stale work on exit; do not delay input waiting for speculative warmup. On-demand rendering must remain safe if preparation has not completed.
3. **Media readiness is a lifecycle.** A retained pending/ready video must not call load again on every request. Consumption permits a fresh next-run resource. Failure must preserve fallback; active or borrowed media must not be destroyed by an idle cleanup. A late play rejection from a disposed owner must not change global format availability or the next scene's renderer. Test interruption followed by a new scene separately from a genuine active media error. Document unused prepared-media retention and release ownership.
4. **Read once, calculate, write.** Avoid transform-write/layout-read loops. Capture coherent geometry before mutations, then solve in memory. In a synchronous iterative solver snapshot invariant base properties once, retaining mutable corrections and exact pass ordering. Share identical easing computations; do not approximate authored motion without approval.
5. **Finished objects stop working.** Once hidden/retired, skip frame geometry and setters. Do not restore opacity before checking completion. If a timeline supports seek/replay, explicitly reset/reactivate on backward seek. Hidden is not equivalent to disposed; both states need a defined owner.
6. **Do not rewrite unchanged presentation.** Compare CSS/display/visibility/depth/diagnostic values before assigning. A cache must not become stale after external style changes or resume. Keep active transform updates and accepted display cadence; do not lower active animation FPS as a substitute for eliminating waste.
7. **Cleanup all paths.** Normal completion, interruption, tile destruction, restart, route exit, background and late/failed loads must release their owned timers, callbacks, controllers and leases. Detach shared ticker after final owner. Never destroy shared assets while another owner uses them.
8. **Measure honestly.** Count work with behavioral spies and compare outputs, not only source strings. CPU time, GPU time, callback gaps, memory and thermal state are distinct. Validate profiler sample presence before asking the user to play. No claim of thermal improvement from operation counts alone.
9. **Declare HUD depth.** A Pixi idle animation whose authored motion leaves the die footprint must use the shared `ANIMATED_DICE_HUD_FOREGROUND` owner (`renderAboveHud` for shared sheets) and prove transform following plus last-owner cleanup. Do not add a family-specific HUD layer. Direct-media renderers must document their equivalent DOM depth owner.

## Required regression scenarios when relevant

| Change | Required evidence |
| --- | --- |
| Finale hidden/retired state | First hidden frame and multiple later frames stay hidden; no geometry/setter work; backward seek/replay restores correct state; cleanup twice is safe |
| Eligibility/preload | Ineligible board creates no resource; eligible and restored variant work; repeated warmup loads once; consumed resource can prepare next run; failure fallback and stale generation |
| Iterative solver | Independent before/after result comparison for representative/edge cases and repeated ticks; property-read count bounded per object, not per solver pass |
| Shared easing | Exact output at key boundaries, between keys and cycle wrap against authored/prior sampling |
| Presentation guards | Same frame produces no redundant mutations; movement, depth changes, hide/resume still update |
| New variant/lifecycle | Two simultaneous copies, stop one vs last, interrupted merge/drag, late load after exit, failed load, save/load and final merge archetype semantics |

Existing examples: `lasergun-measured-layout.test.ts`, `spaceship-finale-lifecycle.test.ts`, `flower-bouncy-artwork.test.ts`, `shared-pixi-sheet-animation.test.ts`, and the Fish/Honey/Bee behavioral tests added with the September 17 repair. Reuse the test technique, not copied runtime ownership.

## New-variant review template

Record in the PR/handoff:
- Registry ID and existing archetype; idle/finale owners and depth contract.
- Resource formats, decoded-size estimate, sharing/lease and fallback ownership.
- Eligibility including restored saves; generation cancellation and media consumption/reuse policy.
- Per-frame reads/writes, active population bound and finished-object behavior.
- Completion/interruption/late-load cleanup; regression tests and admission/full QA results.
- Separate web visual, bundled artifact and physical acceptance status.

No asset conversion, timing reduction, emitter reduction or gameplay rule change follows automatically from this contract. Such changes need the user's corresponding authorization. Preserve authored fun and motion while removing unnecessary work.
