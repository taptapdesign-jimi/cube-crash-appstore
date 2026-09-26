---
name: stack-to-six-feature-architecture
description: Design or implement a new Stack to Six screen, modal, overlay, collection, reward flow, animated UI feature, or substantial UI refactor with explicit lifecycle, thermal, resource, animation, audio, haptic, save-state, and QA ownership.
---

# Stack to Six feature architecture

Use this skill before implementation, not only during final review.

1. Read `AGENTS.md`, `docs/engineering/PROJECT_CONTEXT.md`, `docs/engineering/CURRENT_HANDOFF.md`, `docs/engineering/GAMEPLAY_KING_CONTRACT.md`, `docs/engineering/FEATURE_ARCHITECTURE_CONTRACT.md` and the contracts named there for the affected subsystem.
2. Inspect the current call sites and shared owners. Preserve unrelated dirty work and accepted timing/art. Map entry, exit, input, animation, rendering, loading, audio, haptic, persistence, visibility and cleanup ownership before editing.
3. Prefer existing lifecycle/resource owners. Build settled mobile UI so it becomes quiet. Keep reveal and feedback motion finite. Never copy an existing infinite animation or raw scheduler merely because it predates the feature-runtime baseline.
4. Add or update the feature record in `docs/engineering/feature-runtime-owners.json`. Create behavioral tests for the affected real owners, including interruption, replacement, hidden/background state, late completion and reopen cleanup where relevant.
5. Run `npm run qa:feature-runtime`, focused tests, and `npm run qa:fast`. Run `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full` before final handoff for a completed feature. Run Gameplay KING and subsystem gates when their contracts require them.
6. Report deterministic results separately from web visual review, native bundle state and physical iPhone acceptance. Heat, sustained FPS, memory behavior, touch, audio/haptics and animation feel stay `NEEDS PHYSICAL TEST` until measured on the authorized device.

For a new collection/gallery screen, also verify canonical unlock/save ownership, incremental visible loading, locked-state stillness, detail open/close ownership and repeated route cleanup. Do not create a second progression model.

For a new Wild/Special archetype, add its gameplay record to `docs/engineering/special-dice-archetype-owners.json` before presentation work. Prove final merge and non-final blocker behavior in Arcade and Journey, special transaction release/rollback, endgame deferral, save/load identity, input gates, reward/spawn routing, finale cleanup and modular audio ownership. Run `npm run qa:special-dice` and `npm run qa:gameplay-lock`.
