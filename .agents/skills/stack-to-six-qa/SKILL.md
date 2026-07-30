---
name: stack-to-six-qa
description: Validate Stack to Six after code, gameplay, Journey, animation, CSS, asset, bundle, native, release, or performance changes. Use for QA requests, regression checks, release readiness, visual clipping checks, iOS source/bundle verification, or an independent second-opinion review.
---

# Stack to Six QA

Run repeatable safety gates and return an explicit verdict without mutating native projects or device state.

## Prepare

1. Work only in `/Users/user/cube-crash`.
2. Read `AGENTS.md`, `docs/engineering/PROJECT_CONTEXT.md`, and `docs/engineering/CURRENT_HANDOFF.md`.
3. For Journey work, also read `docs/engineering/JOURNEY_ANIMATION_CONTRACT.md`.
4. Preserve unrelated dirty work. Never run Capacitor sync or touch the legacy Kockice Crash shell.

## Select the gate

- During implementation: run `npm run qa:fast`.
- Before handoff, commit, or push: run `npm run qa:full`.
- Before any Stack to Six native build or install: run `npm run qa:ios` and read `docs/engineering/dev-production-modes.md`.
- For viewport/background/clipping work: also inspect the affected screen at the iPhone 13 viewport. Static checks cannot judge animation feel or edge clipping alone.

Read [references/qa-contract.md](references/qa-contract.md) before issuing the final verdict.

## Independent review

When the user requests a QA agent or second opinion and subagents are available, assign one bounded read-only review after implementation:

- Provide the acceptance criteria, affected files, raw diff, and gate output.
- Do not give the reviewer the intended diagnosis or ask it to edit.
- Require it to inspect call sites, lifecycle cleanup, tests, native identity, and regression risk.
- Require findings with severity and file/line references plus exactly one verdict: `PASS`, `FAIL`, or `NEEDS PHYSICAL TEST`.
- Keep fixes and final decisions with the primary agent.

## Report

State which gates ran, their actual results, whether `dist`, `Web.bundle`, a built app, or the physical phone was changed, and any residual manual/device checks. Never imply a device test happened when only source or bundle checks ran.
