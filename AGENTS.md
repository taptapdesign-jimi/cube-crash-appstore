# Cube Crash Agent Instructions

This repository is the **Stack to Six Native** development project on `main`
(user decision 2026-10-07), targeting **100% native** gameplay and UI. Read
[`docs/engineering/NATIVE_100_PERCENT_PLAN.md`](docs/engineering/NATIVE_100_PERCENT_PLAN.md)
for the migration sequence and Native/PWA separation. The current checkpoint is
still hybrid: web gameplay is a temporary migration dependency.

For Native work the active target is `native/standalone/Stack to Six.xcodeproj`,
bundle `com.taptapdesign.stacktosix.native`. Do not sync/build/install the
preserved PWA target `/Users/user/Stack to Six` as a side effect. Use
`SKIP_NATIVE_BUNDLE_SYNC=true` for transitional web builds/QA. Existing PWA
baseline tags and saves remain preserved; `native-benchmark-v1` identifies the
Native starting checkpoint, not complete native gameplay acceptance.

This repository also preserves the web/game source for the product **Stack to Six**. Before changing, debugging, building, installing, or discussing the app, read and follow:

- [`docs/engineering/PROJECT_CONTEXT.md`](docs/engineering/PROJECT_CONTEXT.md) for authoritative project identity, ownership, and safety rules.
- [`docs/engineering/CURRENT_HANDOFF.md`](docs/engineering/CURRENT_HANDOFF.md) for the current branch, uncommitted work, latest installed build, and immediate continuation state.
- [`docs/engineering/APPROVED_PRODUCTION_BASELINE.md`](docs/engineering/APPROVED_PRODUCTION_BASELINE.md) for the only complete version explicitly approved by the user and the immutable recovery reference for experiments.
- [`docs/engineering/GAMEPLAY_KING_CONTRACT.md`](docs/engineering/GAMEPLAY_KING_CONTRACT.md) for the highest-priority behavioral contract protecting gameplay, end-game, drag, input, lifecycle, save/load, versioning, and the explicit asset-preservation order.

When building or installing on iPhone, also read [`docs/engineering/dev-production-modes.md`](docs/engineering/dev-production-modes.md). **Never sync, build, install, launch, uninstall, or otherwise touch the legacy Kockice Crash shell unless the user explicitly asks for Kockice Crash by name.** The normal native target is Stack to Six.

When changing, debugging, or discussing Journey animations, first read and follow [`docs/engineering/JOURNEY_ANIMATION_CONTRACT.md`](docs/engineering/JOURNEY_ANIMATION_CONTRACT.md).

When validating changes, investigating regressions, preparing a commit/release, or performing QA, read and follow [`.agents/skills/stack-to-six-qa/SKILL.md`](.agents/skills/stack-to-six-qa/SKILL.md). Use its deterministic gates and explicit `PASS`, `FAIL`, or `NEEDS PHYSICAL TEST` verdict.

When auditing, designing, generating, naming, mixing, or integrating sound effects, read and follow [`.agents/skills/stack-to-six-sound-design/SKILL.md`](.agents/skills/stack-to-six-sound-design/SKILL.md). Keep Gameplay, Navigation/CTA, Journey, Settings, Wild/Special and Board Transition sound families modular; do not let a generic tap or impact replace an authored feature-specific cue.

Every new audio owner or sound source must also follow [`docs/audio/AUDIO_RUNTIME_ARCHITECTURE.md`](docs/audio/AUDIO_RUNTIME_ARCHITECTURE.md), add or update its record in `docs/audio/audio-runtime-owners.json`, and pass `npm run qa:audio-runtime`. `qa:fast` and `qa:full` include this blocking gate.

For every gameplay-affecting change or cleanup of gameplay-adjacent legacy code, run `npm run qa:gameplay-lock`. Never optimize, deduplicate, rename, move, or delete assets unless the user explicitly revokes the asset-preservation order in `GAMEPLAY_KING_CONTRACT.md`.

When adding or changing special-die animation, artwork, preloading, or an archetype visual variant, also follow [`docs/engineering/SPECIAL_DICE_PERFORMANCE_CONTRACT.md`](docs/engineering/SPECIAL_DICE_PERFORMANCE_CONTRACT.md). New registry variants must have a matching performance ownership record; `qa:fast` and `qa:full` block missing records. Behavioral regression tests and physical acceptance remain separate requirements.

A new Wild/Special gameplay archetype must also have a matching record in `docs/engineering/special-dice-archetype-owners.json`. The special-dice admission gate blocks archetypes without explicit merge, transaction, endgame, save/load, input, audio and shared regression ownership.

When creating a new screen, modal, overlay, collection, reward flow, animated UI feature, or substantial UI refactor, read and follow [`.agents/skills/stack-to-six-feature-architecture/SKILL.md`](.agents/skills/stack-to-six-feature-architecture/SKILL.md) and [`docs/engineering/FEATURE_ARCHITECTURE_CONTRACT.md`](docs/engineering/FEATURE_ARCHITECTURE_CONTRACT.md). Register its runtime owners and pass `npm run qa:feature-runtime`; `qa:fast` and `qa:full` include this blocking admission gate.

For navigation queues, background animation work, resource preparation, startup imports, or dead-code cleanup, follow [`docs/engineering/BACKGROUND_WORK_CONTRACT.md`](docs/engineering/BACKGROUND_WORK_CONTRACT.md).

When the user asks to connect to the phone, observe or collect problems, reproduce a physical issue, use **KRENI/GOTOVO**, compare phone and web behavior, or test on `localhost:5174`, read and follow [`docs/engineering/LIVE_DEBUG_WORKFLOW.md`](docs/engineering/LIVE_DEBUG_WORKFLOW.md). The required order is capture through the user's explicit **GOTOVO**, fix and show it on `http://localhost:5174`, obtain explicit web approval, and only then install on `iPhone 13 blue`.

The terms **standard enter**, **standard exit**, and **cjelina / Unit** always refer to that contract unless the user explicitly requests different motion.

After a meaningful code, workflow, bundle, device-install, or product-decision change, update `CURRENT_HANDOFF.md` in the same task. Keep stable facts in `PROJECT_CONTEXT.md`; do not turn the handoff into a chat transcript.
