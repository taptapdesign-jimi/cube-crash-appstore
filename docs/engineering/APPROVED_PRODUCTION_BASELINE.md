# Approved Production Baseline

Updated: 2026-10-03

## Latest benchmark — FLUIDNOST

**Production Benchmark v9 — Fluidnost** is the latest user-approved recovery
point. See [PRODUCTION_BENCHMARK_V9.md](PRODUCTION_BENCHMARK_V9.md). Preserve this
tested state before any further polishing experiment.

## User-approved state

The current Stack to Six source version explicitly approved by the user as the
new benchmark from which future work continues is:

- Git tag: `production-benchmark-v9`
- App version: `2.0.653`
- Canonical branch at approval: `main`
- Native delivery status: the exact promoted runtime was built for the
  authoritative Stack to Six target, synced to bundled `Web.bundle`, installed
  over the existing app on `iPhone 13 blue`, and launched without deleting app
  data. The 2026-10-03 control/rapid stress run was physically accepted as
  `skoro pa nema trzaja` / `jako je bilo fluidno`. World preparation stayed at
  or below 32ms across 17 rapid captures; thermal telemetry stayed nominal.
  Rare Hub/exit spikes, spaceship fly-out and longer sustained thermal behavior
  retain their explicit acceptance limits.

After accepting the physical run, the user explicitly requested saving the
current state in Git as the top fluidity benchmark before proposing more changes.
It includes v8 plus the installed navigation/terminal lifecycle, finite World
transform preparation, bounded resource/audio loading and regression work.
The detailed scope and physical acceptance boundary are recorded in
`PRODUCTION_BENCHMARK_V9.md`. This request creates a local Git checkpoint;
remote publication must be reported separately and is not implied here.

## Interpretation rule

When the user says **approved version**, **approved baseline**, **perfect version**, **the version that was super**, **production benchmark**, **benchmark fluidnost**, **stable release**, or otherwise refers to the last version they personally accepted, treat `production-benchmark-v9` as the exact current source reference unless the user explicitly approves a newer baseline.

Do not infer approval from a successful build, QA pass, device installation, merge, release, or positive comment about one isolated change. Only an explicit user statement that a newer complete state is approved may supersede this file.

## Protection rule

- Never move, recreate, force-update, or delete `production-benchmark-v1`.
- Never move, recreate, force-update, or delete `production-benchmark-v2`.
- Never move, recreate, force-update, or delete `production-benchmark-v3`.
- Never move, recreate, force-update, or delete `production-benchmark-v4`.
- Never move, recreate, force-update, or delete `stable-release-v1`.
- Never move, recreate, force-update, or delete `production-benchmark-v5`.
- Never move, recreate, force-update, or delete `production-benchmark-v6`.
- Never move, recreate, force-update, or delete `production-benchmark-v7`.
- Never move, recreate, force-update, or delete `production-benchmark-v8`.
- Never move, recreate, force-update, or delete `production-benchmark-v9`.
- Preserve historical benchmark tags, including `production-benchmark-v2.0.636` and `production-benchmark-v2.0.647`; they remain immutable recovery references but no longer represent the latest user-approved complete state.
- Experimental branches may diverge from it without changing its meaning.
- Before promoting experimental work, compare behavior and scope against this baseline and preserve unrelated accepted behavior.
- If the user rejects an experiment or asks to return to the approved version, use this tag as the recovery reference; do not guess from branch names or recent commits.
- When a newer complete version is explicitly approved, create a new immutable tag and update this file in the same task. Preserve the historical tag.

## Current status

`production-benchmark-v9` is the approved complete source baseline. It records
the full repository state on `main`, retained assets, deterministic coverage,
native delivery evidence and the exact physical-test limits documented in its
benchmark record. Later experiments must preserve this tag and be compared
against it before promotion.
