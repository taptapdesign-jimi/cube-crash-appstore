# Stack to Six interaction sound inventory

Updated: 2026-09-09

## Current approved integration

Sound design has been reset to these user-supplied gameplay cues:

- Shared active-SFX master: `0.60`, reducing every currently used effect by exactly 40%; soundtrack/music is a separate owner and is not multiplied by this SFX gain

## Music

- Global source: `assets/sound/soundtrack/stack to six theme.wav`
- Playback: one continuous theme across intro, Homepage, Journey, board gameplay and transitions whenever Settings Music is ON
- Loop boundary: `180ms` fade-out immediately before the end, restart from zero, then `180ms` fade-in
- Background policy: pause while the app is hidden and resume with a short fade when visible; this is lifecycle safety, not a route-specific music change
- Older soundtrack files remain preserved but are no longer runtime sources
- Pickup source: `assets/sound/merge 6/woosh.mp3` from the measured `0.045s` perceptual-onset offset at authored `1x`, `0.432 action gain`, now `0.2592 effective gain` after the shared master (8% above its preceding level)
- Pickup trigger: once when drag ownership is successfully acquired for any ordinary, Wild or registered Special die; blocked pointer-down attempts stay silent
- Rejected-return source: the same `assets/sound/merge 6/woosh.mp3` from the measured `0.045s` perceptual-onset offset at authored `1x`, `0.85 action gain`, now `0.51 effective gain` after the shared master (15% below its preceding level)
- Rejected-return trigger: once when a released/cancelled dragged die starts its canonical snap-back; successful stack and merge paths stay silent
- Stack source: `assets/sound/merge 6/stack.mp3`
- Stack gain: authored `1.0`, now `0.60 effective gain`
- Stack trigger: a committed ordinary die-on-ordinary-die stack below six
- Merge-6 sources after the shared master: `merge six obicna.mp3` at `1.30x / 0.30 effective gain`; simultaneous longer `merge6 crash.mp3` at `1.30x / 0.1632 effective gain`, shortened to an `892ms` wall-time cutoff with a `120ms` fade-out; simultaneous `merge6 boom.mp3` at `1.0x / 0.36 effective gain`; and a simultaneous Merge-6-only copy of `stack.mp3` at `1.0x / 0.60 action gain / 0.36 effective gain`, exactly 60% of its normal stack level
- Merge-6 trigger: the existing committed `effSum === 6` path, only when both source and destination dice are ordinary
- Playback: pickup and rejected-return woosh cues start from `currentTime = 0.045`; stack and all Merge-6 layers start from zero, and only the first two Merge-6 layers use the requested 1.30x speed
- Ownership: seven bounded preloaded `HTMLAudioElement` voices across `gameplay-pickup-sound.ts`, `ordinary-stack-sound.ts` and `regular-merge6-sound.ts`
- Settings: `gameSoundsEnabled` gates preload and playback; switching OFF stops and rewinds all seven voices
- Exclusions: `pick up drag.wav` is preserved but no longer used at runtime; Wild and registered Special paths use the shared woosh movement cue but do not use either ordinary stack/Merge-6 family; their authored finale ownership remains separate

All other user-supplied audio remains preserved but is not newly wired.

## Removed generated work

The assistant-generated Gameplay, Navigation and prior Merge-6 candidate/runtime packages and their runtime modules were removed permanently.

No other sound family is currently approved for a new integration. Future work should begin from a separately auditioned cue and keep Gameplay, Navigation/CTA, Journey, Settings, Wild/Special and Board Transition ownership independent.
