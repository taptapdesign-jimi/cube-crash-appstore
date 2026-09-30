# Approved Production Baseline

Updated: 2026-09-30

## User-approved state

The current Stack to Six source version explicitly approved by the user as the
new benchmark from which future work continues is:

- Git tag: `production-benchmark-v7`
- App version: `2.0.653`
- Canonical branch at approval: `main`
- Native delivery status: the exact promoted runtime was built for the
  authoritative Stack to Six target, synced to bundled `Web.bundle`, installed
  over the existing app on `iPhone 13 blue`, and launched without deleting app
  data. The user physically confirmed the repaired Laser, Flower and other
  reported non-soundtrack behavior. Foreground soundtrack continuity remains a
  known open issue and is not accepted by this benchmark.

The user explicitly requested that the complete current repository become the
new online benchmark before beginning a new soundtrack investigation. It
includes Production Benchmark v6 plus the complete Laser/Flower/Wild-Star,
Arcade continuation, Journey navigation, mobile animation-cadence and requested
mix repairs. The detailed scope and the explicit open soundtrack boundary are
recorded in `PRODUCTION_BENCHMARK_V7.md`. This is a complete repository
checkpoint, not a claim that the known soundtrack issue is fixed.

## Interpretation rule

When the user says **approved version**, **approved baseline**, **perfect version**, **the version that was super**, **production benchmark**, **stable release**, or otherwise refers to the last version they personally accepted, treat `production-benchmark-v7` as the exact current source reference unless the user explicitly approves a newer baseline. For soundtrack recovery specifically, this means the known pre-fix state documented in the v7 acceptance boundary, not a working foreground-music reference.

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
- Preserve historical benchmark tags, including `production-benchmark-v2.0.636` and `production-benchmark-v2.0.647`; they remain immutable recovery references but no longer represent the latest user-approved complete state.
- Experimental branches may diverge from it without changing its meaning.
- Before promoting experimental work, compare behavior and scope against this baseline and preserve unrelated accepted behavior.
- If the user rejects an experiment or asks to return to the approved version, use this tag as the recovery reference; do not guess from branch names or recent commits.
- When a newer complete version is explicitly approved, create a new immutable tag and update this file in the same task. Preserve the historical tag.

## Current status

`production-benchmark-v7` is the approved complete source baseline. It records
the full repository state on `main`, including retained assets, deterministic
coverage and the exact physical limits documented in its benchmark record.
Laser, Flower and the other reported non-soundtrack fixes are accepted; the
foreground soundtrack problem is explicitly open. Later experiments must
preserve this tag and be compared against it before promotion.
