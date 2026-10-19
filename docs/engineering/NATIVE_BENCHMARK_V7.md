# Native benchmark v7 — Native game checkpoint

User-requested full working-tree checkpoint on main, 2026-10-19.
Repository: https://github.com/taptapdesign-jimi/cube-crash-appstore
Recovery tag: native-benchmark-v7. Earlier benchmark/PWA tags remain unchanged.

## Included state

All tracked and non-ignored work since ed94f0c9, including Native gameplay/UI,
original supplied HUD crate artwork, tests and runtime/handoff documentation.

- Journey World-only random drops, Beach incremental unlocks and legacy Forest
  TNT repair; Arcade random from first reward without authored numbered drops.
- Arcade Stage2+ reached-run summary and last committed Special world theme.
- Combo HUD coins, balanced TNT-family impact-origin distribution with minimum
  one per affected die, bounded independent emergence, varied trophy approaches
  and Laser slow-start acceleration; score remains arrival-owned.
- Orange HUD meter without vertical bounce and broad orange color mixing.
- Independent Forest transition bees, Clean Board ambient bees/audio and
  Bee/Honey motion refinements with finite lifecycle ownership.
- Retained Native result, Settings/World card, Backpack, source construction,
  diagnostics and regression updates from the complete working tree.

## Validation and delivery

Fresh full QA and core/state Swift tests are recorded in CURRENT_HANDOFF.md.
Focused Native SDK evidence is preserved there; no claim of a full SDK suite run.
Latest phone Release delivery: /tmp/impact-phone-build.log,
/tmp/impact-phone-audit.log, /tmp/impact-phone-install.log and
/tmp/impact-phone-launch.log. Bundle com.taptapdesign.stacktosix.native,
iPhone 13 blue, install over existing data. Simulator preview uses retained
1018BE2D-491B-465F-8F75-3E5BEB38C22A.

This is a recovery checkpoint, not a declaration of complete physical visual,
audio, thermal or gameplay parity acceptance. Preserved PWA/legacy shell and
existing saves were not reset or replaced. Build outputs, caches and local-only
ignored material are not source-controlled benchmark contents.
