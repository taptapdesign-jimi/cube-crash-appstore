# Native memory-warning retest — 2026-09-28

## Verdict

- **Memory-warning recurrence: PASS for this bounded run.** No native memory-warning event occurred in the complete persistent record.
- **Thermal acceptance: FAIL.** The native thermal state reached `fair` after 105.188 seconds of active gameplay and `serious` after 435.181 seconds. The user reported the phone physically `mlak` after Forest and `topao` after Beach.
- This run supports the new resource cleanup, but it does not show that the main gameplay heat source is solved.

## Build and conditions

- Product: bundled Stack to Six on `iPhone 13 blue`
- Bundle ID: `com.taptapdesign.stacktosix.Stack-to-Six`
- Entry SHA-256: `c880ef3fc5c8f2203b4e3e926f94746a3a196a90da61d9fc74324c88eb7de32f`
- Installed over existing data; app container: `F0A519A8-E707-4158-B36A-65CECDEE07F9`
- Launch mode: `--cc-native-thermal-telemetry`; JS performance diagnostics disabled
- Brightness: fixed 55%; Low Power Mode off
- Test started unplugged at native `nominal`; battery stayed at the coarse 80% reading
- Route completed: Forest two Fail/Play Again cycles plus Clean/Reward/return, then Beach Fail/Play Again plus Clean/Reward/return. Area 55 was cancelled when thermal became `serious`.

## Lossless evidence

- Persistent device file: `logs/memory-warning-retest-20260928/final.jsonl`
- 146 rows, sequences 1–146
- Total captured duration: 710.341 seconds
- Unplugged captured duration: 659.696 seconds
- Maximum adjacent sample gap: 5.5 seconds; no gap exceeded 6 seconds
- Active gameplay reference: sequence 45, first haptic increment after `KRENI`
- `nominal → fair`: sequence 67, +105.188 seconds from active reference
- `fair → serious`: sequence 134, +329.993 seconds after `fair`
- Active reference → `serious`: 435.181 seconds
- `serious` persisted for 59.814 seconds through capture stop
- Haptic impacts 6→439, notifications 0→3, selections 0→4, confirming sustained play rather than an idle-only run
- Record reasons are limited to `telemetry-start`, `app-active`, `interval`, and `thermal-state-change`; there is no memory-warning reason.

## Interpretation

The new Journey canvas/cache cleanup did not trigger a regression, crash, blank screen, or memory-warning recurrence in this bounded run. One clean run cannot prove that warnings are impossible in longer play, but it directly improves on the previous comparable run that produced two warnings.

The thermal failure is independent of those warnings: the phone reached `fair` well before any memory pressure and reached `serious` without a warning. The strongest remaining target is sustained active board work and its transition/result/reward bursts, not retained World canvas memory alone. The next investigation should measure board rendering and compositor/audio/haptic owners during the same natural route without adding a continuous JavaScript RAF diagnostic.
