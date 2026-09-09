# Stack to Six interaction sound inventory

Updated: 2026-09-09

## Current approved integration

Sound design has been reset to these user-supplied gameplay cues:

- Shared active-SFX master: `0.60`, reducing every currently used effect by exactly 40%; soundtrack/music is a separate owner and is not multiplied by this SFX gain

## Music

- Global source: `assets/sound/soundtrack/stack to six theme.wav`
- Playback: one continuous theme across intro, Homepage, Journey, board gameplay and transitions whenever Settings Music is ON
- Mix: `0.68` in menus; Arcade Round NN and Journey Board Transition duck it to exactly 20% (`0.136`) with a `320ms` soft tail, and menu return restores `0.68` over `420ms`
- Loop boundary: `180ms` fade-out immediately before the end, restart from zero, then `180ms` fade-in
- Background policy: pause while the app is hidden and resume with a short fade when visible; this is lifecycle safety, not a route-specific music change
- Older soundtrack files remain preserved but are no longer runtime sources
- Pickup source: `assets/sound/merge 6/woosh.mp3` from the measured `0.045s` perceptual-onset offset at authored `1x`, `0.432 action gain`, now `0.2592 effective gain` after the shared master (8% above its preceding level)
- Pickup trigger: once when drag ownership is successfully acquired for any ordinary, Wild or registered Special die; blocked pointer-down attempts stay silent
- Rejected-return source: the same `assets/sound/merge 6/woosh.mp3` from the measured `0.045s` perceptual-onset offset at authored `1x`, `0.85 action gain`, now `0.51 effective gain` after the shared master (15% below its preceding level)
- Rejected-return trigger: once when a released/cancelled dragged die starts its canonical snap-back; successful stack and merge paths stay silent
- Ordinary stack sources: simultaneous `assets/sound/merge 6/wood.wav` at `1.50x / 0.384 action gain / 0.2304 effective gain` (approximately 0.853s wall time; cumulative 40% then 20% reductions) plus restored `assets/sound/merge 6/stack.mp3` at `1.0x / 0.80 action gain / 0.48 effective gain` (20% below its preceding ordinary-stack level)
- Ordinary stack scope: both layers play once on only a committed ordinary sub-six stack; the separate Merge-6 copies of `stack.mp3` remain unchanged
- Stack trigger: a committed ordinary die-on-ordinary-die stack below six
- Merge-6 sources after the shared master: `merge six obicna.mp3` at `1.30x / 0.30 effective gain`; simultaneous longer `merge6 crash.mp3` at `1.30x / 0.1632 effective gain`, shortened to an `892ms` wall-time cutoff with a `120ms` fade-out; simultaneous `merge6 boom.mp3` at `1.0x / 0.36 effective gain`; and a simultaneous Merge-6-only copy of `stack.mp3` at `1.0x / 0.60 action gain / 0.36 effective gain`, exactly 60% of its normal stack level
- Merge-6 trigger: the existing committed `effSum === 6` path, only when both source and destination dice are ordinary
- Core Wild Star Merge-6 sources: one per-event 50/50 choice between `long_magica_happy_ac_#2-1788980185281.wav` and `long_magica_happy_ac_#3-1788980189939.wav`, both at `1.0x / 0.6667 action gain / 0.40 effective gain`; simultaneous `big_tnt_boom_explosi_#1-1788980586466.wav` at `1.0x / 0.3333 action gain / 0.20 effective gain`; `magicle_sparkle_for__#1-1788980027254.wav` at `1.0x / 0.60 action gain / 0.36 effective gain`, beginning exactly `200ms` after the event; simultaneous `stack.mp3` at `1.0x / 0.08 action gain / 0.048 effective gain`; and simultaneous `merge six obicna.mp3` at `1.0x / 0.70 action gain / 0.42 effective gain`. The four literal filename hashes remain unchanged on disk and are referenced as `%23` in runtime URLs so browser fetch/media decoders receive the complete WAV path.
- Core Wild Star trigger: the same committed `effSum === 6` branch, but only when at least one merge-entry tile is the unregistered core `wild` Star and neither tile carries a registered Special-die variant; Bee, Kanta and every other registry-backed Special die remain excluded even when they share the `wild-star` archetype
- Wild/Special landing source: `assets/sound/sfx/bag drop.wav` at authored `1.0x / 0.50 action gain / 0.30 effective gain` after the shared master
- Wild/Special landing trigger: exactly once at the committed grid-contact `onImpact` shared by every meter/backpack/crate-spawned core Wild and registered Special reward; initial board population and merge/finale sounds remain separate owners
- Arcade crate sequence: after the preceding proportional 30% reduction, all four layers receive another proportional 20% reduction; `crate 1.wav` starts with the crate entrance at `0.448 action / 0.2688 effective gain`, `crate2.wav` follows at `+300ms` at `0.336 / 0.2016`, `crate 3.wav` at `+600ms` at `0.224 / 0.1344`, and `crate 4.wav` at `+800ms` (200ms after layer 3) at `0.392 / 0.2352`; all four retain authored 1.0x speed and are exclusive to the Arcade crate
- Journey backpack sequence: `backpack1.wav` starts with the backpack entrance at `1.40x / 0.80 action / 0.48 effective gain` (approximately 1.429s wall time); `backpack2.wav` starts at `+200ms` at `2.10x / 0.25 action / 0.15 effective gain` (approximately 0.952s wall time). Neither layer plays for the Arcade crate.
- NO MOVES source: `assets/sound/grandpa - no moves left.mp3` at authored `1.0x / 0.70 action gain / 0.42 effective gain`; it plays once only after the real `.cc-no-moves-overlay` mounts and then continues naturally through overlay removal, Fail presentation and board cleanup until its approximately 3.997s file ends. Settings Sounds OFF remains the explicit interruption owner.
- Playback: pickup and rejected-return woosh cues start from `currentTime = 0.045`; all ordinary Merge-6 layers start from zero and only that family's primary/crash pair uses the requested 1.30x speed; all core Wild Star layers use authored 1.0x speed, with only its sparkle layer delayed by 200ms
- Ownership: twenty-one bounded preloaded decoded/fallback sources across `gameplay-pickup-sound.ts`, `ordinary-stack-sound.ts`, `regular-merge6-sound.ts`, `wild-star-merge6-sound.ts`, `wild-special-landing-sound.ts`, `arcade-crate-sound.ts` and `journey-backpack-sound.ts`; shared source buffers are decoded only once, while each Wild Star event plays five layers and only one of its two magic sources
- Settings: `gameSoundsEnabled` gates preload and playback; switching OFF or board cleanup stops and rewinds all twenty-one preloaded sources and cancels all delayed sparkle/crate/backpack fallback timers
- Exclusions: `pick up drag.wav` is preserved but no longer used at runtime; registered Special paths use the shared woosh movement cue but do not inherit either ordinary or core-Wild-Star Merge-6 family, so their authored finale ownership remains separate

All other user-supplied audio remains preserved but is not newly wired.

## Removed generated work

The assistant-generated Gameplay, Navigation and prior Merge-6 candidate/runtime packages and their runtime modules were removed permanently.

Beyond the integrations listed above, no other sound family is currently approved for a new integration. Future work should begin from a separately auditioned cue and keep Gameplay, Navigation/CTA, Journey, Settings, Wild/Special and Board Transition ownership independent.
