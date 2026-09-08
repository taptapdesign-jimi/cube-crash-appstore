# Sound module boundaries

Use these families so one pass cannot accidentally flatten the whole game's identity.

1. **Gameplay board:** ordinary cube pickup, return, valid stack, ordinary spawn, combo feedback and gameplay HUD surfaces.
2. **Navigation and CTA:** shared primary/secondary CTA press/release, back, close, slider navigation and generic modal actions.
3. **Homepage:** slider swipes/snaps, bottom navigation icons, hero image/card taps and home-specific enters.
4. **Journey:** World/Unit/card interactions, reward reveal, locked feedback, Journey modal flip and progression feedback.
5. **Settings:** rows, toggles, back/privacy/developer actions and their distinct on/off confirmation.
6. **Results and tutorial:** Clean Board, Fail/No Moves, counters, earned Stars, tutorial hand and completion.
7. **Wild and Special:** one authored family per gameplay archetype/visual variant, synchronized to its finale. Treat as a dedicated project.
8. **Board Transition:** Round/Stage NN, environment motion and transition impacts. Treat as a dedicated project.

Do not trigger a cue merely because pointer input occurred. Trigger it at the committed semantic event: accepted pickup, accepted stack, rejected release, sheet opened, toggle changed, or CTA activated. If haptics already mark the event, align the acoustic transient with that same owner.

Gameplay code anchors include `drag-core.ts`, the regular branches in `app-core.ts`, `app-core-merge-haptics.ts`, `hud-helpers.ts`, `regular-merge6-sound.ts`, and the shared Settings callback in `ui-manager.ts`. Re-audit before integration because owners can move.
