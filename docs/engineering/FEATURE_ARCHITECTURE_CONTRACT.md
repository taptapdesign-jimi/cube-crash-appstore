# Stack to Six feature architecture contract

Use this contract for every new screen, modal, overlay, collection, reward flow or substantial animated UI feature. It protects the accepted Stack to Six gameplay and presentation while preventing new idle work, lifecycle leaks and avoidable mobile heat.

## Before implementation

Write a short owner map before choosing animation or media APIs:

- one entry owner and the exact point input becomes legal;
- one exit owner covering normal close, navigation, replacement and interruption;
- every timer, RAF, GSAP/WAAPI animation, Pixi ticker/controller, listener, observer, audio voice, haptic trigger and async load;
- resource eligibility, density, decoded-size estimate, cache/lease owner and release boundary;
- visible, hidden, background, reduced-motion and stale-load behavior;
- the existing standard enter/exit or the user-approved reason to differ.

Reuse shared owners and `src/utils/screen-lifecycle.ts`. Do not add a second renderer, AudioContext, global listener, polling loop or feature-local scheduler when an established owner already exists.

## Runtime rules

1. **Settled screens become quiet.** Entry, exit, reveal, shine, coach and celebration effects are finite. A persistent ambient effect needs an existing shared cadence/visibility owner, a bounded active population and explicit tests. Decorative work must never keep a hidden or covered screen active.
2. **One element, one transform owner at a time.** Snapshot the handoff state when ownership changes. Cancel the previous owner before the next starts, and never combine competing CSS, GSAP and WAAPI transforms accidentally.
3. **Cleanup is symmetric and idempotent.** Normal close, rapid double input, replacement, route exit, app background, failed load and late completion release the same owned work. Calling cleanup twice must be safe.
4. **Loading follows eligibility.** Load only content that can appear. Deduplicate concurrent loads, reject stale generations and keep a cheap fallback. Do not decode an entire collection merely because its screen exists.
5. **Images match their job.** Use density-aware art for visible display. Use the smallest sufficient source for masks, blur, glow and offscreen effects; do not use a 2x full-card alpha mask when 1x produces the same visible result.
6. **Audio and haptics are event owned.** Use the established modular sound family and shared bounded audio cache. Sounds OFF, backgrounding, replacement and hard cleanup must work. Haptics fire from authored events and never from timers or render ticks.
7. **Layout work is bounded.** Read geometry together, calculate in memory, then write. Do not mix layout reads and writes in a frame loop. Virtualize or incrementally mount large collections when a full mount would exceed the visible need.
8. **Gameplay state stays authoritative.** Unlock state is read from the existing progression/save owner. A collection screen displays that state; it does not create a second unlock system or change scoring, merge or save semantics.

## Required evidence

Every new runtime surface gets a record in `feature-runtime-owners.json` naming its surface files, entry/exit/resource/animation/audio/haptic/visibility policy, relevant behavioral tests and physical acceptance boundary.

Tests must exercise the real owners where relevant:

- entry completion and input gate;
- close plus rapid replacement/interruption;
- hidden/background suspension and resume;
- cleanup twice, late load after cleanup and failed load fallback;
- no duplicate timers, tickers, voices, listeners or controllers after reopen;
- locked/unlocked and restored-save states;
- reduced motion and small iPhone viewport;
- bounded resource preparation and unchanged gameplay state.

`npm run qa:feature-runtime` rejects a new screen-like surface without an ownership record and rejects new raw timers, animation frames, infinite GSAP/WAAPI/CSS loops, ticker callbacks, Pixi applications, AudioContexts or observers. Build new work through bounded/shared lifecycle owners. The checked baseline only grandfathers existing occurrences; it is not approval to copy them.

Run focused tests during implementation, `npm run qa:fast` before review and `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full` before handoff. Deterministic QA cannot certify heat, sustained FPS, memory growth, haptics, audio balance or animation feel. Those remain **NEEDS PHYSICAL TEST** on iPhone 13 blue after authorized bundled delivery.

## Example: unlocked dice collection screen

Use one screen lifetime and render cards from the canonical dice/unlock registry. Mount visible cards first, defer offscreen art, and keep locked cards static. A newly unlocked card may run one bounded reveal; returning to the screen must not replay it unless the product contract says so. Opening a card transfers input and transform ownership to one detail presentation; closing restores the list without rebuilding every texture. Route exit cancels pending image work, animations, audio and listeners. Repeated open/close and background/foreground cycles must return owner counts to the starting value.

## New Wild/Special gameplay archetype

Register presentation and performance ownership only after defining gameplay semantics in `special-dice-archetype-owners.json`. The archetype must participate in the real Arcade and Journey final-merge matrix, distinguish final completion from a remaining playable blocker, serialize board mutation through the shared special transaction, defer endgame while gameplay work remains, release or roll back every token, preserve versioned save/load identity, use the central input gate, and connect reward/spawn, finale cleanup and modular audio. A skin that reuses Star, Juice, Magnet or TNT gameplay remains a variant of that proven archetype; it must not create a parallel resolver.
