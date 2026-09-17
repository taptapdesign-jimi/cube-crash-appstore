# Approved Production Baseline

Updated: 2026-09-18

## User-approved state

The current Stack to Six source version explicitly approved by the user as the
new benchmark from which future work continues is:

- Git tag: `production-benchmark-v4`
- App version: `2.0.653`
- Canonical branch at approval: `main`
- Native delivery status: this benchmark is approved and preserved as a complete
  source repository checkpoint. Its current local `dist` was produced with native
  sync disabled. The authoritative Stack to Six `Web.bundle`, signed app and
  installed `iPhone 13 blue` build were not changed for this promotion.

The user explicitly requested that the complete current repository become the
new benchmark. It includes the full runtime, Journey, Arcade, Area55, special-die,
audio, animation, performance, lifecycle and QA work accumulated after v3;
all supplied sound assets; all investigation and contract documents; and all
regression coverage present in the working tree. The detailed scope is recorded
in `PRODUCTION_BENCHMARK_V4.md`. This is a complete repository checkpoint, not a
partial visual, audio or performance checkpoint.

## Interpretation rule

When the user says **approved version**, **approved baseline**, **perfect version**, **the version that was super**, **production benchmark**, or otherwise refers to the last version they personally accepted, treat `production-benchmark-v4` as the exact current source reference unless the user explicitly approves a newer baseline.

Do not infer approval from a successful build, QA pass, device installation, merge, release, or positive comment about one isolated change. Only an explicit user statement that a newer complete state is approved may supersede this file.

## Protection rule

- Never move, recreate, force-update, or delete `production-benchmark-v1`.
- Never move, recreate, force-update, or delete `production-benchmark-v2`.
- Never move, recreate, force-update, or delete `production-benchmark-v3`.
- Never move, recreate, force-update, or delete `production-benchmark-v4`.
- Preserve historical benchmark tags, including `production-benchmark-v2.0.636` and `production-benchmark-v2.0.647`; they remain immutable recovery references but no longer represent the latest user-approved complete state.
- Experimental branches may diverge from it without changing its meaning.
- Before promoting experimental work, compare behavior and scope against this baseline and preserve unrelated accepted behavior.
- If the user rejects an experiment or asks to return to the approved version, use this tag as the recovery reference; do not guess from branch names or recent commits.
- When a newer complete version is explicitly approved, create a new immutable tag and update this file in the same task. Preserve the historical tag.

## Current status

`production-benchmark-v4` is the approved complete source baseline. It records
the full repository state on `main`, including retained assets and deterministic
coverage. It does not claim a matching native delivery: the authoritative
Stack to Six `Web.bundle`, signed app and installed phone remain on their prior
package until a separately authorized native build and install. Physical visual,
audio, touch, thermal and sustained-performance acceptance remain separate from
this exact recovery checkpoint. Gyro remains fully removed and must not be
restored. Later experiments must preserve this tag and be compared against it
before promotion.
