# Special-die animation performance contract

Applies to all four gameplay archetypes (Star, Juice, Magnet, TNT), every visual variant, board idle, spawn, drag and finale. Gameplay KING and asset preservation remain authoritative. A visual variant reuses canonical gameplay; it does not acquire a second resolver or input owner.

## Blocking admission

`npm run qa:special-dice` is part of both `qa:fast` and `qa:full`.

It reads the actual registry through the TypeScript parser and rejects:
- a new variant without an entry in `special-dice-performance-owners.json`;
- an archetype mismatch or stale manifest entry;
- missing idle/finale owner files, warmup/cleanup policy or referenced test files.

The manifest is an ownership/admission index, not a performance certification. Existing entries name current owners and minimum existing regression coverage; they do not assert every behavioral scenario below already has a test. Adding a row alone is insufficient: reviewers must inspect the owner and relevant behavioral assertions. Full QA executes the tests. Physical heat/FPS cannot be certified by this metadata gate.

The same command also reads `SpecialDiceArchetype` and
`special-dice-archetype-owners.json`. Adding a gameplay archetype is blocked
until it declares its core identity, merge owner, endgame policy, immutable
transaction policy, save/load identity, input release policy and audio policy.
Every archetype must retain the shared Arcade/Journey final-merge, gameplay
resolution, transaction, endgame, atomic save/load and input-gate regressions.
A visual variant may reuse a proven archetype; a genuinely new gameplay archetype
must extend the real resolver and matrix rather than relying on artwork tests.

Every variant must also list the shared registry cleanup, visibility, sound eligibility, finale preparation and terminal-render regression suites. Admission rejects a missing shared suite. These tests enumerate the live registry where applicable; a new variant must pass them as well as its own feature tests.

## Shared ownership after the September 25 thermal repair

- `special-dice-idle-visibility.ts` owns hidden-state suspension through one existing app ticker callback and one document listener. Reuse its policy and scoped animation lease. Do not replace the independent drag/pause owner or add per-tile polling. Direct artwork intentionally hides the base sprite; that alone is not a hidden tile.
- `special-dice-idle-budget.ts` admits at most one budgeted Special-die idle owner on mobile. Per explicit user request (2026-10-03), every live Kanta, Honey, Bee and Fish retains its authored idle independently of that slot; a new Special cannot retire those characters, including simultaneous copies. Among other variants, the newest requested live Special owns motion; older candidates keep a static pose and remain eligible for promotion when that owner leaves. Drag, regular merge handoff and Merge-6 resolution still suspend all admitted idle owners and release their settled-frame leases. Nested boundaries are reference-counted; hidden/background/terminal teardown remains authoritative. Desktop preserves all authored independent idle owners. This policy adds no ticker, timer or listener and must not lower active gameplay cadence. The higher simultaneous workload requires physical thermal/frame validation; no unchanged-heat claim is implied.
- `gameplay-render-suspension.ts` retains the terminal hold for the persistent gameplay app. App-core retires all tile idle owners and commits the final hidden/exit frame before stopping rendering. Foreground, pause return and pop-in recovery respect that hold. A new gameplay entry releases it; transparent Arcade stage cues retain their visible render owner. A deliberate board-exit animation may render, then restores the same-run hold.
- `juice-finale-textures.ts` prepares only live variants whose actual visual finale uses its sprites. Entry/drop/finale share at most four in-flight loads, coalesce paths, preserve authored order and reject stale consumers. Pixi remains the texture cache. Do not add a parallel retained cache or prepare every future reward family.
- Audio preparation follows the same actual carrier/variant as playback. `gameplay-audio-buffer-player.ts` owns bounded residency and OS-pressure release; routine Continue does not clear useful SFX. Mobile normally allows 28 MiB and drops to 16 MiB after an OS memory warning, or admits one explicitly looped buffer above 24 and at most 36 MiB plus 16 MiB shared effects. Mobile fetch/decode work is two-wide and real playback outranks speculative warmup. This is a soft cache bound protecting audible/pending voices, not a whole-process memory cap.
- Result modal scheduling, cancellation and disposal use one per-presentation lifetime. Capture cleanup for the particular presentation across awaits. Navigation cancellation must not advance tutorial progress; presentation failure must reach its recovery path. Hidden scheduling pauses pending timers/RAFs; do not describe this as automatically suspending every running DOM animation.

Behavioral coverage includes all 13 current variants' late-load cleanup, hidden idle work counts, repeated Play Again, cancelled/replaced result screens, real 30 FPS gap monitoring, bounded cold sprite loading and actual audio asset sizes at 44.1/48 kHz. Authored motion, assets, active cadence and gameplay rules remain separate protected contracts. See [repair evidence and limits](THERMAL_REPAIR_2026-09-25.md).

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
