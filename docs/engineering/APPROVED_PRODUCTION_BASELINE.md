# Approved Production Baseline

Updated: 2026-09-11

## User-approved state

The current Stack to Six version explicitly approved by the user as the new production benchmark v1 is:

- Git tag: `production-benchmark-v1`
- App version: `2.0.653`
- Canonical branch at approval: `feature/forest-unit-bee-orbits-experiment`
- Installed bundle ID: `com.taptapdesign.stacktosix.Stack-to-Six`
- Installed Web.bundle entrypoint SHA-256: `0aef456d98013697e79ff3fdd5ba88da85040f57754f883f204c705b6a5e3595`

The user explicitly approved the complete current repository and installed iPhone package as the new benchmark, describing it as a strong production-v1 direction. This baseline includes all tracked changes, new Fish/LaserGun assets and implementations, the Bottle/Ball/Fish animation and sound revisions, Special visual-tail input repair, and the explicit removal of the obsolete parrot asset set present at approval time.

## Interpretation rule

When the user says **approved version**, **approved baseline**, **perfect version**, **the version that was super**, **production benchmark**, or otherwise refers to the last version they personally accepted, treat `production-benchmark-v1` as the exact current reference unless the user explicitly approves a newer baseline.

Do not infer approval from a successful build, QA pass, device installation, merge, release, or positive comment about one isolated change. Only an explicit user statement that a newer complete state is approved may supersede this file.

## Protection rule

- Never move, recreate, force-update, or delete `production-benchmark-v1`.
- Preserve historical benchmark tags, including `production-benchmark-v2.0.636` and `production-benchmark-v2.0.647`; they remain immutable recovery references but no longer represent the latest user-approved complete state.
- Experimental branches may diverge from it without changing its meaning.
- Before promoting experimental work, compare behavior and scope against this baseline and preserve unrelated accepted behavior.
- If the user rejects an experiment or asks to return to the approved version, use this tag as the recovery reference; do not guess from branch names or recent commits.
- When a newer complete version is explicitly approved, create a new immutable tag and update this file in the same task. Preserve the historical tag.

## Current status

`production-benchmark-v1` is the approved complete baseline. Gyro remains fully removed and must not be restored. Later experiments must preserve this tag and be compared against it before promotion.
