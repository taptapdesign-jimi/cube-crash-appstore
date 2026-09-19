# Approved Production Baseline

Updated: 2026-09-19

## User-approved state

The current Stack to Six source version explicitly approved by the user as the
new benchmark from which future work continues is:

- Git tag: `stable-release-v1`
- App version: `2.0.653`
- Canonical branch at approval: `main`
- Native delivery status: the accepted runtime was built for the authoritative
  Stack to Six target, synced to its bundled `Web.bundle`, installed over the
  existing app on `iPhone 13 blue`, and physically accepted without deleting app
  data. Release documentation added for the Git checkpoint does not alter runtime.

The user explicitly requested that the complete current repository become the
new stable-release benchmark. It includes Production Benchmark v4 plus the
accepted gameplay/audio additions, thermal and cache repair, Beach canvas fix,
runtime diagnostics, deterministic coverage and physical iPhone evidence. The
detailed scope is recorded in `STABLE_RELEASE_V1.md`. This is a complete
repository checkpoint, not a partial visual, audio or performance checkpoint.

## Interpretation rule

When the user says **approved version**, **approved baseline**, **perfect version**, **the version that was super**, **production benchmark**, **stable release**, or otherwise refers to the last version they personally accepted, treat `stable-release-v1` as the exact current source reference unless the user explicitly approves a newer baseline.

Do not infer approval from a successful build, QA pass, device installation, merge, release, or positive comment about one isolated change. Only an explicit user statement that a newer complete state is approved may supersede this file.

## Protection rule

- Never move, recreate, force-update, or delete `production-benchmark-v1`.
- Never move, recreate, force-update, or delete `production-benchmark-v2`.
- Never move, recreate, force-update, or delete `production-benchmark-v3`.
- Never move, recreate, force-update, or delete `production-benchmark-v4`.
- Never move, recreate, force-update, or delete `stable-release-v1`.
- Preserve historical benchmark tags, including `production-benchmark-v2.0.636` and `production-benchmark-v2.0.647`; they remain immutable recovery references but no longer represent the latest user-approved complete state.
- Experimental branches may diverge from it without changing its meaning.
- Before promoting experimental work, compare behavior and scope against this baseline and preserve unrelated accepted behavior.
- If the user rejects an experiment or asks to return to the approved version, use this tag as the recovery reference; do not guess from branch names or recent commits.
- When a newer complete version is explicitly approved, create a new immutable tag and update this file in the same task. Preserve the historical tag.

## Current status

`stable-release-v1` is the approved complete source baseline. It records the full
repository state on `main`, including retained assets, deterministic coverage and
the installed runtime accepted through the recorded Arcade, Beach and Area 55
physical tests. Physical claims remain limited to those recorded routes and the
exact tested device conditions. Gyro remains fully removed and must not be
restored. Later experiments must preserve this tag and be compared against it
before promotion.
