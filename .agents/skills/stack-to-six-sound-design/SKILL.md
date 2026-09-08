---
name: stack-to-six-sound-design
description: Design, generate, audit, name, mix, or integrate sound effects for Stack to Six. Use for gameplay, HUD, navigation, CTA, Journey, Settings, Wild/Special, board-transition, and interaction-audio work while keeping those sound families modular.
---

# Stack to Six Sound Design

Create sound that feels inseparable from the game's visual motion: fast, happy, cartoony, bouncy, tactile and rich, with a warm wooden toy-box core. Read [references/sound-identity.md](references/sound-identity.md) before generating or selecting sounds. Read [references/module-boundaries.md](references/module-boundaries.md) before inventory or integration work. For an external sound model or a fresh generation pass, adapt [references/generation-prompts.md](references/generation-prompts.md).

## Working contract

- Match the visible contact frame. A sound should explain the action immediately, not narrate it afterward.
- Prefer short layered one-shots: a clear transient, warm wooden body, playful tonal sweetener and only enough air/tail to read cleanly.
- Keep Gameplay, Navigation/CTA, Journey, Settings, Wild/Special and Board Transition families separate. Wild/Special and Board Transition cues require their own animation-specific pass.
- Use two to four variants for frequent actions. Choose once per committed interaction; never reroll during the same animation.
- Do not add continuous drag audio, long reverb, cinematic sub-bass, harsh realistic destruction, casino chimes or generic mobile-game clicks.
- Preserve supplied assets. Generate new candidates in a versioned folder and do not overwrite, recompress, rename, relocate or delete accepted source files.
- Candidate generation does not authorize runtime integration. Before wiring a cue, identify the exact event owner, Settings gate, interruption policy and cleanup boundary.
- All player-facing SFX must obey `gameSoundsEnabled`. Music remains a separate owner.

## Delivery workflow

1. Audit the real interaction and its visual/haptic timing in source.
2. Assign one sound ID from the modular inventory; avoid two sound owners for one gesture.
3. Generate or select variants using the identity reference.
4. Validate sample rate, channels, duration, peak, DC offset, silence and file presence.
5. Audition on phone speakers at low and normal volume. Mark subjective fit and physical mix as `NEEDS PHYSICAL TEST` until heard.
6. Integrate only approved cues through one bounded audio owner, Settings gating and cleanup.

For the current inventory, use [`docs/audio/STACK_TO_SIX_INTERACTION_SOUND_INVENTORY.md`](../../../docs/audio/STACK_TO_SIX_INTERACTION_SOUND_INVENTORY.md). The current all-wooden Gameplay v5 generator is `scripts/generate-gameplay-board-sfx-v5.mjs`; verify it with `scripts/validate-gameplay-board-sfx-v5.mjs`. Earlier generators remain versioned for comparison and recovery.
