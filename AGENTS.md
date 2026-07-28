# Cube Crash Agent Instructions

This repository is the web/game source for the product **Stack to Six**. Before changing, debugging, building, installing, or discussing the app, read and follow:

- [`docs/engineering/PROJECT_CONTEXT.md`](docs/engineering/PROJECT_CONTEXT.md) for authoritative project identity, ownership, and safety rules.
- [`docs/engineering/CURRENT_HANDOFF.md`](docs/engineering/CURRENT_HANDOFF.md) for the current branch, uncommitted work, latest installed build, and immediate continuation state.

When building or installing on iPhone, also read [`docs/engineering/dev-production-modes.md`](docs/engineering/dev-production-modes.md). **Never sync, build, install, launch, uninstall, or otherwise touch the legacy Kockice Crash shell unless the user explicitly asks for Kockice Crash by name.** The normal native target is Stack to Six.

When changing, debugging, or discussing Journey animations, first read and follow [`docs/engineering/JOURNEY_ANIMATION_CONTRACT.md`](docs/engineering/JOURNEY_ANIMATION_CONTRACT.md).

The terms **standard enter**, **standard exit**, and **cjelina / Unit** always refer to that contract unless the user explicitly requests different motion.

After a meaningful code, workflow, bundle, device-install, or product-decision change, update `CURRENT_HANDOFF.md` in the same task. Keep stable facts in `PROJECT_CONTEXT.md`; do not turn the handoff into a chat transcript.
