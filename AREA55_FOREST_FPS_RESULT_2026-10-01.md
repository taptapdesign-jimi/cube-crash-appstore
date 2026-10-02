# Area 55 to Forest long-session FPS investigation

Date: 2026-10-01

Device: `iPhone 13 blue` (`iPhone14,5`)
App: bundled Stack to Six, `com.taptapdesign.stacktosix.Stack-to-Six`

## Verdict

The reported degradation was reproduced. This was not one isolated LaserGun
animation problem and not an active hidden-Journey idle loop. Repeated board
runs drove decoded-audio eviction/redecode churn and native memory warnings;
later transitions ran under `fair`, then `serious`, thermal state. A separate
Journey lifecycle defect allowed the Forest World-to-Hub Unit timeline to stop
halfway without ever releasing the transition lock.

The source repair is deterministic **PASS** and physical acceptance is
**NEEDS PHYSICAL TEST** on the same route. No native bundle was synchronized or
installed as part of this repair.

## Capture

- User-controlled route began at `KRENI` and ended only on explicit `GOTOVO`.
- Instruments Time Profiler captured 532.236638 seconds and 40,697 numeric CPU
  samples from the Stack to Six process.
- The trace, exported CPU table, hang table and user markers are in
  `logs/iphone-area55-forest-fps-20261001/`.
- The hang instrument reported no single native main-thread hang over its 250ms
  threshold. Console frame telemetry instead captured clusters of shorter
  stalls, which are sufficient to freeze visible animation progress.
- Stopping the console after `GOTOVO` intentionally terminated only the traced
  diagnostic launch with signal 2; it was not an app crash.

## Reproduced evidence

- The user-marked LaserGun hitch aligned with a frame window whose worst frame
  was 138ms, followed by 87ms, 72ms, 45ms and 44ms frames.
- Repeated gameplay produced native memory warnings while the gameplay SFX
  cache repeatedly approached 32MiB. At the final captured pressure cycle the
  session had performed 357 decodes, 253 re-decodes, 238,879,800 decoded bytes,
  357 evictions and 238,879,800 evicted bytes. The separate active soundtrack
  retained 22,921,368 decoded bytes.
- Large gameplay/transition stalls included 154ms, 122ms, 108ms, 208ms and one
  542ms frame. The Clean Board Exit report aligned with a 626ms HUD update and
  553ms synchronous destination preparation.
- During the failed Forest World exit, frame telemetry recorded 100ms, 38ms,
  237ms, 87ms and 178ms frames. `nav-exit` completed, but no World Unit exit
  completion followed. Journey remained in runtime `transition` with input
  blocked for the rest of the capture even after frame timing became quiet.
- Native thermal state was initially `nominal`, changed to `fair` only after
  the early hitches and memory warnings, then reached `serious` during the
  failed Forest return. It later cooled to `fair` while the locked screen was
  idle. Thermal throttling amplified the late failure but does not explain the
  first Laser hitch.
- Time Profiler shows JavaScriptCore memory scavenging using about 18% of the
  sampled Stack to Six process CPU during the Forest World-exit window. The
  trace attaches to the native/UI process and does not independently sample the
  separate WebContent process, so console timing remains the authoritative JS
  event correlation.
- Hidden Journey state during gameplay had zero ambient canvases, zero admitted
  idle elements and zero running infinite CSS/GSAP animations. Removing cloud
  or Unit idle motion could reduce ordinary steady-state work, but it is not the
  owner of the reproduced freeze.

## Repair

1. A native memory warning now changes the mobile decoded-SFX session budget
   from 32MiB to 16MiB after releasing idle buffers. Later requests cannot
   refill the same session back to the warning threshold, avoiding the observed
   repeated zero-to-32MiB decode/evict cycle. Active and pending voices remain
   protected, and authored sources, gains and timing are unchanged.
2. The Journey manager marks the session memory-constrained on the first native
   warning, immediately retires optional hidden Hub/World prepaint stages and
   skips later duplicate destination prepaints for that session. Canonical
   post-exit rendering remains the fallback.
3. World Unit exit now has a 2.2-second owner-scoped watchdog. Normal exits keep
   their existing timing. If the GSAP coordinator stalls, only that outgoing
   owner is stopped, remaining outgoing Units are forced to their final hidden
   state, and the canonical Hub handoff runs once instead of leaving an eternal
   transition lock.

## Validation

- Focused audio/Journey lifecycle coverage: **PASS**, 5 suites / 112 tests.
- Dedicated stalled-coordinator watchdog behavior: **PASS**.
- `npm run qa:audio-runtime`: **PASS**.
- `npm run qa:gameplay-lock`: **PASS**, 24 suites / 308 tests.
- `npm run qa:fast`: **PASS**, all 12 deterministic gates / 142 suites /
  1,274 tests.
- `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full`: **PASS**, all 18
  deterministic gates / 460 suites / 3,141 tests, including the production
  build and built-bundle audit. Native bundle synchronization was skipped.

The final acceptance test must repeat the same Area 55 Cjelina 4 retries,
Forest Cjelina 3, Forest browsing and World exit on the physical phone. Success
requires no native memory-warning loop, no user-visible Laser/Confetti/World
freeze, no permanent Journey transition lock and materially delayed or absent
`serious` thermal state.
