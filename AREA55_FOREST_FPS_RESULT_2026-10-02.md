# Mobile optimization physical retest

Date: 2026-10-02

Device: `iPhone 13 blue` (`iPhone14,5`)
App: bundled Stack to Six, `com.taptapdesign.stacktosix.Stack-to-Six`

## Verdict

**PHYSICAL FAIL.** The mobile Special-idle budget, decoded-audio scheduler/cache
limits and five-bee Forest cap did not eliminate the reported long-session
hitching, result-exit freeze or heating. The app process stayed alive and the
test continued after the worst stalls, so this run did not reproduce a process
crash or prove the previous permanent transition deadlock. It did reproduce
the same broader degradation across Area 55, Beach and Forest.

No source fix was attempted during or after this capture.

## Installed candidate

- Fresh production build: 1,102 transformed modules.
- Deterministic source QA immediately before delivery: all 18 `qa:full` gates,
  463 suites and 3,155 tests passed.
- `qa:ios` passed before and after the signed native build.
- Xcode result: `BUILD SUCCEEDED`.
- Final bundle ID: `com.taptapdesign.stacktosix.Stack-to-Six`.
- `dist`, official `Web.bundle` and final-app `index.html` SHA-256:
  `4e9aced36652a5538106bae84e4a7f544b5b34984c40cde0cb13d07cb0fadbab`.
- Apple returned explicit `App installed` over existing data at container
  `F2425726-1CA8-41A9-AA49-828FF6867131`.
- Exact bundle launch succeeded at 12:38:14 CEST. The same app PID `6132`
  remained alive through `GOTOVO` and immediately after the console capture was
  detached. At 12:53 the process was no longer present; a scoped terminate
  request returned `No such process`. The available evidence does not identify
  whether the user closed it, iOS retired it after the test, or another
  post-capture termination occurred.

## Native evidence

The normal launch accidentally omitted the existing
`--cc-performance-diagnostics` argument. Therefore the JavaScript frame sampler,
resource snapshots and exact per-frame millisecond evidence were unavailable.
This capture cannot honestly produce a before/after FPS percentage.

The native memory-warning callback still emitted four pressure events:

| Time CEST | Thermal state | Haptic impact count |
| --- | --- | ---: |
| 12:38:48 | nominal | 5 |
| 12:39:31 | nominal | 6 |
| 12:40:58 | nominal | 89 |
| 12:41:47 | fair | 110 |

The first warning arrived about 34 seconds after launch. Four warnings arrived
within about three minutes, and native thermal state had already changed to
`fair`. The user later reported that the phone was very hot. Because periodic
native telemetry was also not enabled, the later transition to `serious` or
`critical` cannot be confirmed or rejected.

## User incident sequence

The following markers are preserved in arrival order and spelling:

1. `problem board transiztion area 55 mi je mal ozatrzao`
2. `problem padajuce floruishes na area b55 celan boardu konfete su opet zatrzale i sfreezale se kada sma kliknuoe exit ovo je bug veliki`
3. `kada sam se vratio na beach trzali mi je i flip card je trzao`
4. `povratak na forest jak oveliki trzajevi`
5. `sa board game na forest taj flip koji se kod laodanja napravi aktivne kartice i cjeline postavljanje tza`
6. `sada otvaranje kartia na foretu do povecavanja taj flip i postavljanje journey modal kartice trza`
7. `evo skoro smo imal icrash sada na pola mi se smrznuo exit cjelina dok sam otvarao cjelinu 04`
8. `jako je vruc mobitel i forest mi dosta trza kad otvaram cjelinu da vidi m karticu`
9. `gotovo`

## Comparison with 2026-10-01

The prior 532-second trace measured frame spikes through 542ms, a 626ms HUD
update, a 553ms synchronous destination preparation, 253 audio re-decodes,
238,879,800 decoded/evicted bytes, repeated memory warnings and a final Forest
transition lock under `serious` thermal state.

The new candidate shows one possible partial improvement: during the
user-controlled route it remained the same live process and recovered far
enough to continue across Worlds after the reported freezes. However, the
acceptance criteria did not pass:

- native memory warnings still repeated and began early;
- Area 55 Board Transition still visibly hitched;
- active Clean Board flourishes still froze on Exit;
- degradation carried into Beach and Forest;
- return flip, active-card/Unit landing and modal-card placement visibly hitched;
- a Cjelina 04 exit again stopped halfway before recovering;
- the phone became very hot.

The five-bee Forest cap and one-active-Special idle budget reduce their own
steady-state work, but the reproduced stalls occur at transition, result-exit,
return-flip and modal-placement boundaries. The current evidence therefore does
not support claiming a meaningful whole-game percentage improvement.

## Required next measurement

Let the phone cool naturally. The next same-route capture must launch the
already-installed bundle with `--cc-performance-diagnostics` and a file-backed
console timeout longer than the planned test. It should preserve the same
problem-marker protocol through explicit `GOTOVO` and collect exact frame,
audio-cache, DOM/GSAP/Pixi and lifecycle snapshots at Area 55 transition,
Clean Board CTA exit, Beach return, Forest return flip and Cjelina 04 opening.
