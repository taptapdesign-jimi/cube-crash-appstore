# Board Render Thermal Acceptance — 2026-09-27

## Build under test

- Stack to Six 1.0 build 3, bundled production web content.
- Installed over existing data on `iPhone 13 blue`.
- Mobile Pixi backing resolution capped at 1.25x.
- Mobile Pixi cadence settles at 30 FPS and uses lifecycle-scoped 60 FPS leases.
- No thermal fallback or temperature-triggered quality change.
- Native telemetry only: `performanceDiagnosticsEnabled=false`.

## Test conditions

- Cable disconnected; battery state remained unplugged.
- Brightness stayed at 55%.
- Low Power Mode was off.
- Start state was native `nominal`; user reported the phone cold.
- Evidence: `logs/board-render-thermal-acceptance-20260927/final.jsonl`.
- Acceptance slice: sequence 116 through 254.

## Route

The 11 minute 15 second natural-play route included:

1. Forest Fail and Play Again.
2. Second Forest Fail and Play Again.
3. Forest Clean Board, New Reward reveal and next board.
4. Forest exit, Worlds, Beach entry and Beach Fail.
5. Beach Play Again, Clean Board/reward and next board.
6. Beach exit, Worlds, Area 55 entry and Area Fail.
7. Area 55 Play Again and second Fail.
8. Area 55 exit, Worlds, Forest re-entry, final board and Fail.

## Native result

- Duration: 675.01 seconds.
- Thermal samples: 139; maximum sample gap 5.494 seconds.
- Thermal state stayed `nominal` for the first 579.0 seconds.
- First `fair`: 23:45:24, 9 minutes 39 seconds after the acceptance slice began, during the final return/Forest phase.
- Final state: `fair`.
- `serious`/`critical`: never observed.
- User touch report at the end: **mlak**.
- Battery: 85% to 80% (coarse native percentage).
- Brightness: fixed at 55%.
- Haptic impact requests: 15 to 504, confirming sustained active gameplay rather than an idle soak.
- Memory warnings: two, at 7 minutes 13 seconds and 9 minutes 11.6 seconds. Telemetry continued without a gap, and the user reported no crash or blank board.

## Comparison and verdict

The previous natural-play build reached `fair` during the first Forest board and later reached `serious`; the user reported the phone hot. This build delayed `fair` until 9 minutes 39 seconds, never reached `serious`, and ended only lukewarm across all three Worlds and repeated Fail/Clean/reward transitions.

**Thermal improvement: PASS.** The board render/cadence change materially reduced thermal escalation under the matched natural-play route.

**Long-session release acceptance: NEEDS FOLLOW-UP.** The run did not stay nominal for its complete duration and iOS delivered two memory warnings. The next investigation should be narrow and read-only first: correlate World transition/resource residency around the two warning timestamps, then verify that board/world caches return to their established bounds. Do not undo the renderer/cadence improvement and do not add the rejected thermal fallback.
