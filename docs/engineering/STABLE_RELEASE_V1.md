# Stable Release v1

Date: 2026-09-19

## Identity

- Product: Stack to Six
- Source version: `2.0.653`
- Canonical branch: `main`
- Immutable tag: `stable-release-v1`
- Previous approved benchmark: `production-benchmark-v4`
- Native target: Stack to Six, bundle ID
  `com.taptapdesign.stacktosix.Stack-to-Six`
- Physical acceptance target: `iPhone 13 blue`

## Release purpose

This checkpoint is the complete stable release requested after the thermal,
long-session corruption, Beach, Area 55 and Arcade investigations. It includes
all accepted work accumulated after Production Benchmark v4, every supplied
audio asset and every regression test present in the repository. Git is the
authoritative path-level inventory.

## Gameplay and progression

- Arcade Round 01 now starts its authored Wild sequence with core Magnet; later
  visual test drops retain their existing order and gameplay archetypes.
- Beach retains Fish for Cjelina 01 and the guaranteed first Juice reward in
  Cjelina 02. Later Beach rewards use five equal 20% slots: Fish, Juice, Beach
  Ball, Bottle and core Wild Star.
- Gameplay, drag, final-merge, save/load, terminal flow and Journey/Arcade
  isolation remain protected by the Gameplay KING contract and its full gate.

## Authored audio package

- Adds the complete Area 55 Board Transition package with separately owned
  transition, flyby and real beam-boundary cues, preserving natural sound tails.
- Adds feature-owned LaserGun Merge-6, preparation, beam, changed-cube impact and
  final-tail cues with hard-cleanup ownership.
- Adds feature-owned Spaceship Merge-6, entry, abduction, suction-beam and exit
  cues with scene-boundary ownership.
- Final Kanta walking gain is 0.30 action / 0.18 effective. Each Kanta exit
  independently selects one of three cues and independently has a 50% chance to
  use the quieter 0.364 action / 0.2184 effective gain.
- Removes two superseded working audio files while preserving all active and
  supplied production assets recorded by the sound inventory.

## Thermal and long-session stability

- Special-sound warmup now decodes only specials already present on the board,
  plus their canonical gameplay foundation. A newly committed special warms
  during its drop instead of decoding every possible World or Arcade reward on
  entry.
- Removes unconditional Juice and Barrel entry warmups that repeatedly exceeded
  the 32 MiB decoded-gameplay-audio budget.
- Mobile shared Pixi sheets now use an 8-second idle eviction delay and a 24 MiB
  idle budget while active owners remain protected.
- Adds bounded decoded-audio eviction/redecode counters and lightweight 30-second
  resource samples without enabling expensive per-merge tracing in compact mode.
- Journey Beach keeps both canvases, all ten bubbles, paths, artwork, sizes,
  opacity, rise timing and 1.25 ambient DPR, while mobile ambient painting moves
  from 60 FPS to 30 FPS. The main gameplay renderer remains at resolution 1.5.
- Area 55 keeps its two fast-moving ship canvases at 60 FPS after a dedicated
  physical map/gameplay/return test showed stable frame timing. Forest remains
  30 FPS while settled and boosts to 60 only during active scrolling.

## Validation and physical acceptance

- The final deterministic `npm run qa:full` result is recorded in
  `CURRENT_HANDOFF.md` and the annotated tag message.
- The repaired build passed authoritative Stack to Six iOS source/bundle checks,
  Xcode device build and install-over with preserved app data.
- Maximum-brightness Arcade stress passed without memory warnings, WebContent or
  GPU exits, blank textures, sustained frame collapse or reported heat.
- The exact Beach failure route was first reproduced, then physically retested
  after the owner-level fix. Beach map timing returned from sustained 73-80 ms
  averages to approximately 16.7-17.2 ms with no >250 ms windows or incidents;
  the user reported it was smooth.
- A separate 4m53s Area 55 map/gameplay/return capture stayed thermally nominal,
  had no >250 ms windows, memory warnings or current WebContent/GPU incidents,
  and ended at 16.67 ms average / 18 ms worst. The user reported the ships were
  smooth and everything was okay.

## Acceptance boundary

This immutable tag is the stable source recovery point explicitly approved on
2026-09-19. It preserves the physical acceptance evidence above without claiming
that every future device, operating-system version or untested route combination
can never regress. Occasional isolated entry frames around 100-150 ms remain
measurable but did not create sustained slowdown or a user-visible failure in the
accepted runs. Merge-6 bounce feel remains optional presentation polish rather
than a stability blocker.
