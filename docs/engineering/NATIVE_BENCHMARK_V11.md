# Native benchmark v11 — complete Native checkpoint

User-requested complete current working-tree checkpoint on main, 2026-10-22.
Repository: https://github.com/taptapdesign-jimi/cube-crash-appstore
Immutable recovery tag: `native-benchmark-v11`.

Includes all tracked and non-ignored current work since the last committed
Native checkpoint: whole-board Barrel ordinary-die replacement with first impact
one second after BOOM, Mushroom bonus/rarity and its separate introduction rule,
shared Journey same-World replay discoveries and first-three-drop introduction
guarantees, queued closed-die pop visibility, Backpack/Arcade collection copy and
ordering, Balloon motion/facing, Journey ambient/navigation, HUD coin effects,
audio/runtime ownership updates, regression tests and engineering contracts.
Original assets remain preserved. Arcade trial settings remain as documented in
the current handoff.

This is a Native development recovery checkpoint, not a physical acceptance or
App Store readiness claim. The active app is the standalone Native target,
com.taptapdesign.stacktosix.native. Preserved PWA and legacy shells are separate.
No phone installation or deployment is part of this Git publication. Ignored
builds, logs, credentials and player saves are excluded.

## Validation

The complete current source tree passed full no-native-sync QA (530 suites /
4010 tests and Gameplay KING 330), Native target/resource audit, 522 gameplay
Core tests and 86 State/save tests. Three mounted Native tests passed, covering
the actual Bootstrap replay pool, manual Backpack/HUD behavior and all World
introduction alerts. Prior scoped Native checks for included changes are recorded
in CURRENT_HANDOFF.md.

Logs: /tmp/world-drops-{full,ios,core,state-verified,sdk,preview}.log.
Normal complete-tree Debug build succeeded; retained Jimi QA Simulator received
install-over and normal launch. Both production save files remained byte-identical;
actual Silent Mode ON verified. No additional build/install is needed for this
Git-only checkpoint. Changed-file credential-pattern scan and diff hygiene passed.

The annotated tag identifies the complete payload. Publication is verified by
comparing the online main and peeled tag with the local payload commit; older
Native/PWA benchmark tags are not moved.
