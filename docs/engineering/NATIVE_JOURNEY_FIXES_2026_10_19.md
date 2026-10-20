# Native Journey fixes — 2026-10-19

- [x] Clean Board: world and local Unit label (Forest/Beach/Area NN).
- [x] Unlock names: resolve from actual card artwork identity across all 30 cards.
- [x] Journey card X: preserve and resume existing Unit/cloud motion phase, including interrupted close/background.
- [x] User correction: all fresh/Restart openings contain ordinary dice only. The exact Unit introduction is guaranteed on its first earned Backpack drop; later drops stay random. Persisted wildSpawnCount preserves eligibility across Continue.
- [x] Every TNT-archetype coin uses Laser's gentle accelerating launch; receipt carries actual gameplay archetype, including OG TNT without variant.
- [x] Complete regression gates and retained Native Simulator refresh for all five implemented fixes.

Existing dirty combo and Arcade exit fixes are preserved. Physical phone installation is separate and not requested in this task. Original assets and preserved PWA remain untouched.

Validation: 508 gameplay tests, 64 state tests, 50 mounted result/reward/coin tests PASS. Fast/full/iOS QA PASS. Journey mounted test initially exposed immutable CA animation mutation; fixed by keeping owned mutable copies; rerun PASS42 mounted Journey tests. Read-only review also found and resolved close/background landing interruption.

Normal Debug build PASS, exact Native bundle verified; retained Simulator install-over/launch exit0 PID74592. Unlock appearance choice received and implementation completed; final SDK validation tracked in CURRENT_HANDOFF.

Final unlock validation:67 state and508 core PASS; all14 actual constructors covered; normal Play/Continue/Restart, canceled preparation, delayed skin and meter arrival verified. Fixed real Bottle/Kanta deferred-upload race across normal gameplay. Final shared skin/meter suite83PASS. Simulator refreshed normally PID83627; details/evidence in CURRENT_HANDOFF. All five items complete.
