# Native benchmark v9 — global Journey level-star ranking

User-requested complete current working-tree checkpoint on `main`, 2026-10-21.
Repository: https://github.com/taptapdesign-jimi/cube-crash-appstore
Immutable recovery tag: `native-benchmark-v9`.

Payload commit: `53abff4fd87c688151083b3e915a3f22f1595b9c`.
Annotated tag object: `cacc88c39a74623f2b169750a59473c1eb527a3a`.
Atomic main/tag GitHub push succeeded; `git ls-remote` verified main and the
dereferenced v9 tag at the exact payload. The later documentation-only receipt
on main leaves the immutable tag unchanged. Native v8 remains at its previous
annotated object/payload; no previous Native/PWA tag was moved. This is a Native
development checkpoint, distinct from preserved PWA `production-benchmark-v9`.

## Included state

All tracked and non-ignored work since Native benchmark v8: Native implementation,
tests, handoff/ownership documentation, supplied artwork/audio and the synthetic
Forest ranking experiment with reproducible analysis. Existing supplied asset
updates/removals and versioned audio candidates are captured as they stand;
this checkpoint task does not transform or delete any source asset. Candidate
files do not imply every candidate is wired into playback. Build products,
credentials, runtime logs and player saves remain outside Git.

- Global Journey **level ranking for completion stars v1**, shared by all30
  boards using local Unit01–10 thresholds in Forest, Beach and Area55.
  Existing final score includes combo/efficiency; no second combo requirement.
  Three stars grant Legendary. Durable best completion awards preserve earlier
  stars/cards, and failed statistical high scores cannot promote a reward.
  Exact table, reasoning and future tuning:
  [JOURNEY_LEVEL_STAR_RANKING.md](JOURNEY_LEVEL_STAR_RANKING.md).
- Complete current Journey/Backpack discovery, unread alerts, manual modal/icon
  switching, inverse main-art idle, shared contact/bounce motion, audio/coin/HUD
  and special-die lifecycle changes already recorded in CURRENT_HANDOFF.
- Arcade early-Box admission fix and Journey Backpack protection, with bounded
  physical acceptance of that earlier incident; updated Home/Settings/Pure Dice
  artwork and supplied navigation/reward audio work.
- Forest ranking research:36,000 synthetic attempts, not human probabilities
  or a certified optimal solver. The user explicitly adopts its thresholds
  globally; Beach/Area55 balance remains reviewable.

## Validation and delivered preview

Latest complete-tree `qa:full` PASS: Gameplay KING24 suites/330 tests; all530
TypeScript suites/4010 tests, build with Native/PWA sync disabled and all selected
gates. `qa:fast` and `qa:ios` PASS. Current runtime sources/assets have no changes
newer than that successful gate. Logs: `/tmp/journey-ranking-{fast,ios,full}.log`.

Swift state/save77/0 and mounted SDK84/0 (World45, reward21, result18) PASS.
Tests cover all30 ranking boundaries, legacy awards, save/reload, lower replay,
failed high score and actual reward artwork selected from completion award.
Logs: `/tmp/journey-ranking-state-tests-final.log`, `/tmp/journey-ranking-sdk.log`.

Normal complete-tree `Stack to Six` Debug build PASS, exact bundle ID
`com.taptapdesign.stacktosix.native` verified; installed over retained Simulator
`1018BE2D-491B-465F-8F75-3E5BEB38C22A` and launched normally (PID73855).
Both primary/previous save bytes preserved; visible iOS Silent Mode On verified.
Build receipt: `/tmp/journey-ranking-preview-build.log`. No new physical phone
installation is part of this benchmark; the latest ranking is on the Simulator.
No PWA/legacy install, uninstall or reset.

Physical balance, touch, motion, audio mix, performance and thermal acceptance
remain separate from this recoverable source checkpoint. Earlier known issues
in CURRENT_HANDOFF are not closed merely by tagging this version.
