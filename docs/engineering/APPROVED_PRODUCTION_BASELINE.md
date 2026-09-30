# Approved Production Baseline

Updated: 2026-10-01

## User-approved state

The current Stack to Six source version explicitly approved by the user as the
new benchmark from which future work continues is:

- Git tag: `production-benchmark-v8`
- App version: `2.0.653`
- Canonical branch at approval: `main`
- Native delivery status: the exact promoted runtime was built for the
  authoritative Stack to Six target, synced to bundled `Web.bundle`, installed
  over the existing app on `iPhone 13 blue`, and launched without deleting app
  data. Deterministic and delivery evidence pass; exact ship-bank/no-fade feel,
  broadened `ZAPED OUT`, repeated foreground soundtrack continuity and sustained
  thermal behavior retain their explicit physical-test boundary.

The user explicitly requested that the complete current repository and newly
installed package become the new online benchmark. It includes Production
Benchmark v7 plus the foreground soundtrack handshake, lossless board-runtime
optimizations, launch/result timing, Beach transition, LaserGun no-target and
Area 55 Clean Board ship changes. The detailed scope and physical acceptance
boundary are recorded in `PRODUCTION_BENCHMARK_V8.md`.

## Interpretation rule

When the user says **approved version**, **approved baseline**, **perfect version**, **the version that was super**, **production benchmark**, **stable release**, or otherwise refers to the last version they personally accepted, treat `production-benchmark-v8` as the exact current source reference unless the user explicitly approves a newer baseline.

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
- Preserve historical benchmark tags, including `production-benchmark-v2.0.636` and `production-benchmark-v2.0.647`; they remain immutable recovery references but no longer represent the latest user-approved complete state.
- Experimental branches may diverge from it without changing its meaning.
- Before promoting experimental work, compare behavior and scope against this baseline and preserve unrelated accepted behavior.
- If the user rejects an experiment or asks to return to the approved version, use this tag as the recovery reference; do not guess from branch names or recent commits.
- When a newer complete version is explicitly approved, create a new immutable tag and update this file in the same task. Preserve the historical tag.

## Current status

`production-benchmark-v8` is the approved complete source baseline. It records
the full repository state on `main`, retained assets, deterministic coverage,
native delivery evidence and the exact physical-test limits documented in its
benchmark record. Later experiments must preserve this tag and be compared
against it before promotion.
