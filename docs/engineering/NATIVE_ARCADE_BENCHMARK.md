# Native Arcade benchmark — 2026-10-18

Immutable Git tag: `benchmark-arcade-native`. Branch: `main`.
Requested by the user as an important complete working-tree checkpoint, including
source, tests, documentation, current artwork and development design candidates.
Active target: `native/standalone/Stack to Six.xcodeproj`, scheme `Stack to Six`,
bundle `com.taptapdesign.stacktosix.native`.

## What is new since Benchmark Backpack

- Native Arcade Hub with Endurance, One Lucky Drop and Slow Burn; each mode has
  its own information/Play/Continue modal, durable run, pending round and records.
  Existing saves default to Endurance; Journey remains independently owned.
- Endurance retains normal Arcade rules. One Lucky Drop slowly charges one random
  eligible Special reward per round, persists its consumed flag before travel,
  prevents further drops until the next round and eases opening values in rounds
  1–4. Its final description is “Only one random Special die per round.”
- Slow Burn charges at half the normal rate and carries completed-round charge
  into the next round. Explicit restart starts fresh. Final-pair reward veto and
  canonical unlock eligibility remain in force for all modes.
- Dice Box collection from the Arcade Hub and Endurance/Slow Burn gameplay,
  with three dice in a 2+1 grid, selected detail and exact paused-board return.
  One Lucky Drop has no gameplay Dice Box button or opening path.
- Mode/round gameplay footer, Journey-style Hub back arrow, refined world/cloud
  layout and finite 0.25s Arcade artwork selection before modal admission.
  Journey selection now has only its existing whole-Unit scale owner.
- Arcade modal paper/CTA exit together, measured descriptions, artwork-to-CTA
  gap32pt, shared idle/drag behavior, and one stable randomized whole-modal tilt
  in half-degree steps up to +/-2.5 degrees per opening.
- Native combo icon motion and finite number balloon/deflation follow existing
  visible Scene clock, including tier feedback, interruption and expiry cleanup.
- Bottle finale rising/trailing bubbles use bounded30–80percent opacity.
  Football intro removed from random selection without deleting its artwork.
- Current Home/Journey/Settings slider density variants and crate HUD artwork
  preserved exactly as supplied. New human/dog render studies, board mayhem,
  dice-catching, Journey treasure, Settings and workshop candidates are saved
  under development-only `game design/output/`; candidate storage is not approval
  or runtime integration of every image.
- Focused Arcade, collection, navigation, lifecycle, gameplay, combo and layout
  regression tests plus updated feature ownership and gameplay contract.

## Validation and acceptance boundary

Current publication checks are recorded in CURRENT_HANDOFF.md. Existing detailed
mounted Simulator test/build/install evidence remains there, including the latest
normal retained Simulator launch after the final concise One Lucky Drop copy.
This Git publication task does not rebuild/install or modify device saves.
Ignored generated builds, signed apps, temporary logs and device saves are not Git
artifacts. Preserved PWA and legacy shell are untouched; historical tags remain
immutable.

Open issue: the earlier Pure Dice/One Lucky Drop missing NO MOVES report remains
unresolved. Exact saved-layout and merge-to-layout mounted regressions pass, but
the live capture ended without a reported incident or a diagnosed live cause.
Do not describe this checkpoint as repairing that report. Physical visual/touch,
audio, sustained performance and thermal acceptance remain NEEDS PHYSICAL TEST.
