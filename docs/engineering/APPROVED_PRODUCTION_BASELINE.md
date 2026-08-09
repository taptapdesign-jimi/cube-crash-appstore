# Approved Production Baseline

Updated: 2026-08-09

## User-approved state

The only Stack to Six version explicitly approved by the user as the current perfect production benchmark is:

- Git tag: `production-benchmark-v2.0.636`
- Commit: `2b026f0f0b91af9626b0b477b47ba562a01952fe`
- App version: `2.0.636`
- Canonical branch at approval: `main`

This baseline represents the complete accepted product flow and visual/interaction behavior that existed before the isolated whole-board gyro tilt experiment began.

## Interpretation rule

When the user says **approved version**, **approved baseline**, **perfect version**, **the version that was super**, **production benchmark**, or otherwise refers to the last version they personally accepted, treat `production-benchmark-v2.0.636` as the exact reference unless the user explicitly approves a newer baseline.

Do not infer approval from a successful build, QA pass, device installation, merge, release, or positive comment about one isolated change. Only an explicit user statement that a newer complete state is approved may supersede this file.

## Protection rule

- Never move, recreate, force-update, or delete `production-benchmark-v2.0.636`.
- Experimental branches may diverge from it without changing its meaning.
- Before promoting experimental work, compare behavior and scope against this baseline and preserve unrelated accepted behavior.
- If the user rejects an experiment or asks to return to the approved version, use this tag as the recovery reference; do not guess from branch names or recent commits.
- When a newer complete version is explicitly approved, create a new immutable tag and update this file in the same task. Preserve the historical tag.

## Current experiment

The whole-board gameplay gyro tilt is intentionally isolated on `feature/gameplay-board-gyro-tilt`. It is not part of the approved production baseline unless and until the user explicitly approves the completed experiment.
