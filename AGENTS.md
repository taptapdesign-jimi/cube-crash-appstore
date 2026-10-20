# iOS Stack to Six — Agent Instructions

This repository is the **Stack to Six Native** development project on `main`
(user decision 2026-10-07), targeting **100% native** gameplay and UI. Read
[`docs/engineering/NATIVE_100_PERCENT_PLAN.md`](docs/engineering/NATIVE_100_PERCENT_PLAN.md)
for the migration sequence and Native/PWA separation. The active standalone app runs Swift gameplay and UIKit/SpriteKit UI without a
web gameplay fallback. Complete parity and physical acceptance remain tracked
in the current handoff; preserved web source is a separate reference/product.

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

When the user asks to connect to the phone, observe or collect problems, reproduce a physical issue, use **KRENI/GOTOVO**, compare phone and web behavior, or test on `localhost:5174`, read and follow [`docs/engineering/LIVE_DEBUG_WORKFLOW.md`](docs/engineering/LIVE_DEBUG_WORKFLOW.md). User decision 2026-10-19: all Native fixes and reviews use the dedicated Native Simulator; no web check or web approval is required. For live phone incidents, capture through the user's explicit **GOTOVO**, implement and validate, then refresh the dedicated Simulator for review. Physical installation remains a separately authorized step; preserve existing saves.

The terms **standard enter**, **standard exit**, and **cjelina / Unit** always refer to that contract unless the user explicitly requests different motion.

After a meaningful code, workflow, bundle, device-install, or product-decision change, update `CURRENT_HANDOFF.md` in the same task. Keep stable facts in `PROJECT_CONTEXT.md`; do not turn the handoff into a chat transcript.

## Shared Native Simulator preview (user decision 2026-10-16)

Keep one current Native app on the existing `Jimi 2026 QA iPhone 13` Simulator
(`1018BE2D-491B-465F-8F75-3E5BEB38C22A`), bundle
`com.taptapdesign.stacktosix.native`. After a Native implementation task and its
required checks, refresh this same app from the complete current working tree,
including other agents' saved changes: build the normal `Stack to Six` Debug
scheme, verify the built bundle ID, install over the existing Simulator app,
and launch it normally for user review. Do not leave a test runner as the final
preview. Preserve app data; never uninstall/reset the retained Native app.
Coordinate concurrent builds so the last preview includes the latest completed
changes. Record actual build/install/launch evidence in `CURRENT_HANDOFF.md`.
This standing preview request applies only to this Simulator; physical phone,
preserved PWA and legacy shell retain their existing separate boundaries.

## Simulator audio mode follows the task (user decision 2026-10-19)

The user controls when the dedicated Native Simulator is audible. For an explicit
audio task/review, turn Silent Mode OFF; for non-audio development/review, turn
Silent Mode ON. Explicit user direction overrides this default. Check the actual
iOS Silent Mode state after every Simulator boot/restart and final preview launch;
the Simulator toolbar Mute value alone can disagree with SpringBoard. If needed,
toggle toolbar Mute ON then OFF for audio review and verify the visible iOS
“Silent Mode Off” banner. For non-audio review verify “Silent Mode On”. Do not
change the game's Sounds/Music preferences, macOS volume/output or production
audio-session policy to work around Simulator state. This is a standing review
workflow, not permission to force physical iPhone audio settings.

## Persistent game art direction (user decision 2026-10-17)

For new artwork, visual design, scene/character generation or render-style review,
read and use [`game design/SKILL.md`](<game design/SKILL.md>) and its linked visual
reference guide. Open the relevant PNG references, especially the recurring human
and dog identity images, before generation. The library covers Home heroes,
ordinary and Wild/Special dice, effects, and Forest/Beach/Area 55 Journey worlds.
Keep `game design/` development-only and outside application resource/copy roots;
see [`game design/PACKAGING.md`](<game design/PACKAGING.md>). Existing original
assets remain protected. This routing does not authorize runtime asset changes.

## ChatGPT Work project identity (user decision 2026-10-17)

The shared development/design project is named **iOS Stack to Six**, with
`/Users/user/cube-crash` as its primary local folder. Ready-to-paste project
instructions and setup steps live in `game design/PROJECT_INSTRUCTIONS.md` and
`game design/PROJECT_SETUP.md`. This project label does not rename the app target,
bundle ID, repository path or preserved products.

## Character illustration render style

When the user includes **render style** in a request about character artwork,
read and follow [`.agents/skills/stack-to-six-render-style/SKILL.md`](.agents/skills/stack-to-six-render-style/SKILL.md).
It defines the accepted soft, light, creamy rendering and elongated cartoony
limbs, with original project images as visual references. Distinguish review,
prompt writing and actual image editing from the user's request. This phrase
refers to illustration appearance, not runtime renderer performance.
