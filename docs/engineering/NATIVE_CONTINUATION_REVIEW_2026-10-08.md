# Native continuation integration review

This review covers concurrent changes discovered after the resumed source QA
and focused Fish/HUD snapshots. Those edits were not made by this root batch
or its Board, Rules and State agents. They are retained in the worktree. Their
ownership is awaiting user clarification; no checkpoint or physical delivery
acceptance is inferred from the earlier test receipts.

Verdict: **FAIL for source-parity admission** of the concurrent integration.

| Area | Required source behavior | Finding in concurrent draft |
| --- | --- | --- |
| Frame cadence | Captured typed leases with source100/60/180/250ms tails, visible static15 and registered idle30 | Blanket300ms activity marks and static renderer suspension replace the proved policy |
| Modal pause | Original global timeline and ticker stop immediately | Whole Scene/HUD-root actions remain active during close feedback despite paused child nodes |
| Painted readiness | Exact current generation receipt before releasing its cover | Lifetime first-board flag can satisfy a later board using an earlier generation |
| HUD midpoint | Completion-count or midpoint timer wins once, then two future frame callbacks | Same-frame didFinishUpdate counts the first callback, starting drop one future frame early |
| Cold footer | Artwork admission remains independent of optional board wave | Removing initial fallback loses footer when ReduceMotion suppresses the wave |
| HUD rise | Both captured position and alpha use power2.in for0.3s | Position uses the source ease while alpha uses linear fadeOut |
| HUD interruption | Retire the actual drop owner before rise, including after wave completion | cancelEntry's early return can retain hud-enter competing with hud-exit |

Source evidence is the immutable production-benchmark-v9 versions of
app-core.ts, app-board.ts, app-core-hud-drop.ts and hud-helpers.ts. Independent
executed proofs:

- `/tmp/native-hud-motion-draft/`:4209 original GSAP drop/rise poses, including
  interrupted drop→rise, PASS with maximum5e-7 rounding difference.
- Original completion/timer arbitration plus literal nestedRAF HUD owner:
  8 schedules/64 callback decisions PASS against the private native value owner.
- Private typed cadence helper:312 fields/39 original owner callbacks PASS.
- Linked standalone cadence policy:5119 source checks and actual Simulator4
  tests PASS; this does not admit the concurrent Scene integration.

The previous source19gates/530suites4010tests/KING330 and Fish/HUD actual test
receipts remain historical scoped evidence. Fresh connected checks are required
after ownership is resolved and integration is corrected. Original assets,
installed phone preview and PWA remain unchanged by this review. User-reported
phone problems remain deferred; this review checks new migration code only.
Physical performance and visual acceptance: **NEEDS PHYSICAL TEST**.
