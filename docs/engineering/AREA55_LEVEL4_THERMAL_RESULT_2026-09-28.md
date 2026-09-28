# Area 55 Level 4 natural-play thermal result — 2026-09-28

## Test identity

- Device: `iPhone 13 blue` (`iPhone14,5`)
- App: bundled Stack to Six `1.0` build `3`
- Bundle ID: `com.taptapdesign.stacktosix.Stack-to-Six`
- Installed entrypoint SHA-256: `62c45f4bcf9af25b73df21d6c511877bab28629544ff666b0a1433812786724e`
- Route: Area 55 Level 4 (`Zap - Zap`), natural play with result/Play Again cycles, then return to the Area 55 World screen
- Measurement: native-only five-second telemetry; web performance diagnostics and all passive isolation flags were off
- Evidence: `logs/area55-level4-thermal-20260928/`

## Measured result

The persisted device file contains 182 consecutive samples from 11:59:50 through 12:14:46. The phone was unplugged from 12:00:32 until 12:13:02. The user marker nearest `KRENI` is sequence 14 at 12:00:47; the marker nearest `GOTOVO` is sequence 119 at 12:09:32, giving 525 seconds of active-route coverage. The Area-ready marker to `GOTOVO` covers 415 seconds.

- Thermal state was `nominal` in all 182 samples. There was no `fair`, `serious` or `critical` transition.
- Brightness stayed at 55% throughout the measured route. There was no automatic dimming.
- Low Power Mode was off.
- No native memory-warning or WebContent-termination event appears in the persisted record.
- The user reported the final phone as `mlako` and reported no hitch on the final return to the Area 55 World screen.
- Battery reporting moved from 55% to 50%. This is a coarse five-point iOS observation and is evidence of meaningful active-play energy use, not a precise watt measurement.
- From `KRENI` through `GOTOVO`, the native bridge received 750 impact, three notification and five selection haptic requests. From Area-ready through `GOTOVO`, it received 630 impact requests. The largest five-second impact delta was 19; minute totals during active play ranged from 60 to 124. Impact counts stopped increasing after gameplay ended.

## Interpretation

This run does not reproduce the previously reported hot/serious failure. It passes the bounded physical acceptance criteria for Area 55 Level 4 at the current 1x/lifecycle-cadence build: sustained native thermal state remained nominal, the user felt only mild warmth, and the final World return was smooth. It also gives no evidence that the settled Area 55 World screen is the heat owner in this route.

The run does expose unusually dense event-driven haptics. Area 55 Level 4 admits Laser Gun, whose TNT-like Merge-6 path can emit one immediate heavy impact, nine delayed light impacts and four bonus-target heavy impacts around a single complete finale. That density is a concrete optimization candidate. It is not established as the dominant heat source: the earlier matched diagnostic C/D work kept physical haptics enabled at similar density without reproducing a thermal transition after the native generator-allocation/logging repair. A same-route haptic-isolated comparison is required before attributing temperature or battery reduction to the actuator.

## Verdict

- Area 55 Level 4 bounded thermal/smoothness: **PASS** for this 525-second route.
- Area 55 World return hitch: **PASS** in this reproduction.
- Long-session thermal release acceptance: **NEEDS PHYSICAL TEST** beyond this bounded run.
- Haptic density contribution: **NEEDS MATCHED SAME-ROUTE A/B**; do not claim it as the root cause from request counts alone.
