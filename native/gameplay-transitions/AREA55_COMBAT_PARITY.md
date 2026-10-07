# Native Area55 airborne transition combat

`NativeTransitionRoboCombatPlan` ports the active `startRoboAirCombatMotion`
owner and active fighter exit in `src/modules/board-transition-screen.ts`,
plus `board-transition-robo-variation.ts` and `board-transition-ship-hover.ts`.
The explicitly rejected post-KING exit branch is excluded.

The immutable plan captures 75 source RNG draws: variation24, flight jitter24,
hover4, crossing13, beams4, active exit6. Unused source sway and crossing draws
remain in sequence. The parent constructs it after cloud/digit/shake owners;
Area55 has no intervening random owner between combat construction and exit.
No random draws, DOM reads, timers or layout allocations occur during sampling.

Left flight and hover share their original element transform. Right flight uses
an outer wrapper and hover stays on the inner original image. Renderer must
preserve this nesting, CSS transform order and centered original artwork.
Number depth is swapped atomically between9/11 at the authored crossing time.
Only Beam1 and mirrored Beam4 fire at0.20/2.12; their anchor is88%/75%, depth29.
The beams start above the viewport independently of fighter geometry. The
original PNGs and layout ratios are preserved by the parent resource owner.

The source master duration is3.001 despite the delayed right flight ending3.20.
Default exit begins2.681, captures both live poses after the0.35 parallax lead
at3.031 and preserves captured hover/skew during the finite accelerated exit.
The explicit `exitStart` parameter lets the parent carry its actual barrier.
The active exit owner hides beams immediately at2.681, before the fighter
pose capture at3.031. That exit visibility ownership suppresses Beam4's tail;
its existing source tween is still alive until the combat stop callback. Hidden beam transforms
before entry need no renderer writes. Fighters become hidden at the exact
captured exit end; the parent retires their views and resource leases.

Validation: **PASS** independent executed-original-TypeScript oracle:15 plans,
435 sampled fighter/beam states,10,335 numeric assertions and exact RNG draw
counts in a standalone native Swift run. **PASS** iOS Simulator SDK production
and XCTest source typecheck. Three XCTest cases cover that oracle, nested hover
capture, atomic depth swap, the two authored cues and finite retirement.
The oracle also executes the exact active exit beam-hide block, including
exitStart±0.001 samples. It records callback outputs; it does not prove
conflicting GSAP/DOM opacity write order between animation ticks.
The oracle executes the original flight/hover/beam/active-exit callbacks with
recording DOM/GSAP adapters; it does not reimplement motion calculations.

Actual connected UIKit/Simulator route QA is owned by the transition carrier.
**NEEDS PHYSICAL TEST**: artwork compositing, beam glow and full route cadence.
