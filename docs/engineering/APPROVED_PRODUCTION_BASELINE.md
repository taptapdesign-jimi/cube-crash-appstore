# Approved Production Baseline

Updated: 2026-09-12

## User-approved state

The current Stack to Six source version explicitly approved by the user as the
new benchmark from which future work continues is:

- Git tag: `production-benchmark-v2`
- App version: `2.0.653`
- Canonical branch at approval: `feature/forest-unit-bee-orbits-experiment`
- Native delivery status: source/Git benchmark only; authoritative Stack to Six
  `Web.bundle`, final app and installed device were not changed for this approval.

The user explicitly approved the complete current repository state after the
Journey return-card, Cartoon Bounce, Homepage slider and Hub exit timing work,
including the latest accepted `swoosh back.wav`, as the new benchmark. The Hub
World-card exit uses the accepted 20%-longer `0.18s + 0.336s` timing while the
Forest/Beach/Area 55 X-to-Hub reference, Homepage hero timing, Unit-card tap
exit and Reduced Motion remain isolated and unchanged.

## Interpretation rule

When the user says **approved version**, **approved baseline**, **perfect version**, **the version that was super**, **production benchmark**, or otherwise refers to the last version they personally accepted, treat `production-benchmark-v2` as the exact current reference unless the user explicitly approves a newer baseline.

Do not infer approval from a successful build, QA pass, device installation, merge, release, or positive comment about one isolated change. Only an explicit user statement that a newer complete state is approved may supersede this file.

## Protection rule

- Never move, recreate, force-update, or delete `production-benchmark-v1`.
- Never move, recreate, force-update, or delete `production-benchmark-v2`.
- Preserve historical benchmark tags, including `production-benchmark-v2.0.636` and `production-benchmark-v2.0.647`; they remain immutable recovery references but no longer represent the latest user-approved complete state.
- Experimental branches may diverge from it without changing its meaning.
- Before promoting experimental work, compare behavior and scope against this baseline and preserve unrelated accepted behavior.
- If the user rejects an experiment or asks to return to the approved version, use this tag as the recovery reference; do not guess from branch names or recent commits.
- When a newer complete version is explicitly approved, create a new immutable tag and update this file in the same task. Preserve the historical tag.

## Current status

`production-benchmark-v2` is the approved complete source baseline. The prior
installed Stack to Six package remains a separate delivery state and does not
contain this complete source checkpoint. Gyro remains fully removed and must
not be restored. Later experiments must preserve this tag and be compared
against it before promotion.
