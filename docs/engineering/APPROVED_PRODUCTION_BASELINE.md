# Approved Production Baseline

Updated: 2026-09-13

## User-approved state

The current Stack to Six source version explicitly approved by the user as the
new benchmark from which future work continues is:

- Git tag: `production-benchmark-v3`
- App version: `2.0.653`
- Canonical branch at approval: `feature/forest-unit-bee-orbits-experiment`
- Native delivery status: the matching authoritative Stack to Six `Web.bundle`
  and signed app were installed over existing data and launched on `iPhone 13 blue`
  on 2026-09-13 at 17:16 CEST.

The user explicitly approved the complete current repository and installed-app
state after the Journey Cjelina guaranteed flip-back repair, current World and
Forest ambience handoff, Forest gameplay and Board Transition audio, Clean Board
celebration/counter mix, themed residual particles, and the current Honey,
Bottle and Wild Star sound routing. The benchmark includes the complete retained
source-asset set and its regression coverage; it is not a partial audio-only
checkpoint.

## Interpretation rule

When the user says **approved version**, **approved baseline**, **perfect version**, **the version that was super**, **production benchmark**, or otherwise refers to the last version they personally accepted, treat `production-benchmark-v3` as the exact current reference unless the user explicitly approves a newer baseline.

Do not infer approval from a successful build, QA pass, device installation, merge, release, or positive comment about one isolated change. Only an explicit user statement that a newer complete state is approved may supersede this file.

## Protection rule

- Never move, recreate, force-update, or delete `production-benchmark-v1`.
- Never move, recreate, force-update, or delete `production-benchmark-v2`.
- Never move, recreate, force-update, or delete `production-benchmark-v3`.
- Preserve historical benchmark tags, including `production-benchmark-v2.0.636` and `production-benchmark-v2.0.647`; they remain immutable recovery references but no longer represent the latest user-approved complete state.
- Experimental branches may diverge from it without changing its meaning.
- Before promoting experimental work, compare behavior and scope against this baseline and preserve unrelated accepted behavior.
- If the user rejects an experiment or asks to return to the approved version, use this tag as the recovery reference; do not guess from branch names or recent commits.
- When a newer complete version is explicitly approved, create a new immutable tag and update this file in the same task. Preserve the historical tag.

## Current status

`production-benchmark-v3` is the approved complete source and installed-app
baseline. Its bundled Stack to Six package was installed and launched on the
authoritative `iPhone 13 blue`; physical audio balance remains a separate
acceptance dimension and does not alter the exact recovery checkpoint. Gyro
remains fully removed and must not be restored. Later experiments must preserve
this tag and be compared against it before promotion.
