# Thermal root-cause experiment — 2026-09-25

## Completed A/B evidence

The full-audio A arm ran for approximately 303 seconds at 55% brightness and stayed native `nominal`. It performed 155 total decodes, 51 redecodes and 114 evictions by its last complete resource sample. The audio-isolated B arm began at native `nominal`, 55% brightness and battery 80%; the low-level isolation counters proved zero route-time decoded bytes, voices, pending loads/decodes and redecodes while blocking 395 SFX plays, 42 preloads and 45 soundtrack-owner requests by the last pre-return resource sample. B nevertheless reached native `fair` approximately 104 seconds after KRENI, followed by automatic brightness reduction from 55% to 45%.

This excludes managed runtime JS audio as the dominant cause of B's thermal transition. It does not prove a renderer or haptic owner because the natural-play workloads, starting battery and prior cooldown were not identical. At fair onset the gameplay ticker was stopped, terminal render hold was active, and Special idle owners, shared-sheet bytes and runtime textures were zero, so the terminal screen is a lagged witness rather than a demonstrated retained-render leak. The preceding board had peaked at four Special tiles, nine idle owners and about 20.96MB of shared sheet residency.

The same capture exposed 203 native haptic bridge requests, 149 before `fair`. The native bridge allocated a new UIKit feedback generator and emitted a console line for every request. The bridge now reuses generators, reports cumulative counts through existing five-second thermal telemetry, removes per-request diagnostic logging, and supports the diagnostic-only `--cc-thermal-haptics-isolated` launch flag. This is an independently valid allocation/logging repair; haptic thermal contribution still requires a matched isolated arm.

## Completed C evidence: audio and physical haptics isolated

The C arm ran unplugged for 250 seconds at fixed 55% brightness with the same low-level audio isolation plus diagnostic native haptic isolation. Native thermal state stayed `nominal` in all 50 measured samples, brightness remained 55%, and battery moved 75% to 70%. The workload covered multiple Beach attempts, one Fail/Play Again, Special-heavy play, a Clean Board result idle and a late restarted board. Audio counters ended at zero decoded bytes, active voices, pending buffers and redecodes while suppressing 559 SFX plays, 55 SFX preloads, 305 SFX state operations and 62 soundtrack-owner operations. Native telemetry counted 255 impact, three selection and one notification request during the measured interval; all 259 were suppressed before actuator output.

Across 14,950 requestAnimationFrame callbacks in 50 five-second windows, the weighted callback interval was 16.727ms, the worst interval was 73ms, 31 intervals exceeded 34ms and none exceeded 250ms. These are JavaScript callback intervals rather than presented GPU FPS. Twelve windows contained Special tiles, with a peak of six Special idle owners, 11,986,380 shared-sheet bytes and three runtime textures. Eighteen terminal windows had zero retained ticker/Special-owner leaks.

C remaining nominal for roughly 146 seconds beyond B's `fair` onset is strong evidence that work removed between B and C matters. It does not yet distinguish physical actuator cost from the generator-allocation/per-request-logging repair because cooldown and natural board workload were not laboratory-matched. The decisive next arm is D on this same installed optimized build: keep low-level audio isolated, enable authored haptics by launching without `--cc-thermal-haptics-isolated`, and repeat the same fixed-brightness Beach route after matched natural cooldown. If D reaches `fair` while C remains reproducibly nominal, haptic density/actuator work becomes the leading causal owner. If D remains nominal, the native generator reuse/log removal or starting conditions explain the earlier difference, and stationary renderer ABBA becomes the next discriminator.

The complete reconstructed console, markers and machine-readable summary are preserved under `logs/thermal-validation-20260925/root-cause-live-c-haptics-isolated/`. The original six-line `devicectl --log-output` control log is retained separately as `devicectl.log`; the attached stdout stream was recovered exactly from the local session chunks into `console.log`.

## Completed D evidence: audio isolated, optimized physical haptics enabled

The D arm used the same installed build and low-level audio isolation, but launched without the haptic-isolation flag so authored physical haptics ran through the repaired cached native bridge. It ran unplugged for 260 seconds at fixed 55% brightness, battery 70%, and native thermal state remained `nominal` in all 53 measured samples. The route covered Beach board 16 with Special-heavy play, Fail/Play Again, a Clean Board and Journey return, then Beach board 24 with Kanta, Wild and Spaceship exposure. D produced 291 impact, two selection and one notification request during the measured interval, with zero suppression. This exceeded C's 259 suppressed requests, yet did not reproduce B's `fair` state or dimming.

D's 15,554 requestAnimationFrame callbacks across 52 windows had a weighted 16.720ms interval, a 100ms worst interval, 33 intervals above 34ms and none above 250ms. Twenty-two windows contained Specials, peaking at six idle owners, 11,986,380 shared-sheet bytes and two runtime textures. One sample during the active Clean Board route handoff had both terminal hold and a briefly restarted ticker; the following samples had ticker, Special owners, shared sheets and runtime textures at zero, so there is no persistent terminal leak.

The C/D comparison rejects physical haptic actuator output as the dominant heat owner in these runs. It also validates the repaired cached haptic bridge under a denser physical workload. The B-to-D improvement is consistent with removal of per-request UIKit generator allocation and synchronous per-request logging, but unmatched natural workload and starting thermal history mean it cannot be assigned exclusively to that repair. A full-audio normal-behavior confirmation remains required because A was nominal despite its audio churn, while B alone reached `fair` with audio isolated. Stationary `sheets` and `pixi-render` ABBA remains the next discriminator for residual render power after the normal confirmation.

The D console, markers and machine-readable summary are preserved under `logs/thermal-validation-20260925/root-cause-live-d-haptics-enabled/`.

## Decision

The 2026-09-25 physical run **failed thermal acceptance**: native thermal state reached `serious` and iOS reduced the visible display brightness. It did not isolate the dominant power owner. The next run must compare controlled interventions rather than combine normal play, charging, 100% brightness, route changes and incomplete CPU profiling.

Historical evidence does **not** prove that audio was the dominant heat source. Earlier runs proved retained decoded-audio references during native memory pressure, a broken pressure-release call, bounded cache eviction/redecode churn and unnecessary route warmups. A September 19 charging/100%-brightness run stayed nominal despite 82 evictions/45 redecodes; another nominal unplugged maximum-brightness run recorded 185 evictions. Conversely, the current run reached `serious` without a redecode burst at the transition: `redecodedBuffers` stayed at 4 across the enclosing 180.532–210.557s resource samples. Audio remains a strong candidate for avoidable CPU bursts, not an established sustained thermal cause.

The strongest prior rendering evidence is also limited. A stationary Journey World had higher GPU impact than an idle board in one Power Profiler run. The old ambient ABBA experiment lost authoritative labels/owner counts and its reconstructed suppressed windows increased summed native/WebContent/GPU-process sampled CPU by 2.8%; it did not prove ambient rendering was the cause. A synchronous `scrollTop`/style/layout path was present in prior CPU samples, and current Area 55 return contains an 869ms callback gap, but neither explains the earlier thermal transition by itself.

## Diagnostic build

Normal production behavior must remain unchanged. Diagnostics activate only with `--cc-performance-diagnostics` and collect bounded summaries without per-frame logging:

- per-source gameplay-audio cache events: caller, route/board/generation, hit/miss, decode duration and bytes, eviction reason/recency, active/pending totals and overflow;
- a diagnostic-only **audio runtime isolation** switch that gates context acquisition, fetch/decode, queued starts and playback at the low-level owner, releases existing audio through established cleanup and reports suppressed requests; Settings toggles alone are not accepted as proof of a zero-audio workload;
- one correlated terminal-return record: CTA/star setup, module readiness, existing Unit count/cold flag, cold render, transform reset, reconcile, prime, warm dispatch, asynchronous image readiness/layout/paint and cancellation/timeout;
- existing five-second RAF windows, native thermal/brightness/charging, ticker/terminal/Special-owner state and 30-second resource snapshots;
- existing stationary ABBA isolation for Journey ambient/Units, shared sheets, Pixi render submission, CSS idle and GSAP idle.

The proven decoded-cache policy defect is repaired independently: a resident preload hit refreshes its recency so the current family cannot be evicted merely because its member was already prepared. That repair needs a focused regression and full deterministic QA before delivery.

## Preconditions shared by every physical comparison

1. Let the phone cool to native `nominal` and normal screen brightness for at least ten minutes with the app closed. Stop immediately at `serious`, automatic dimming, a memory warning followed by degradation, WebContent termination or user discomfort.
2. Remove the case if one is present. Disable automatic brightness for the experiment and set exactly 50%. Keep Low Power Mode, network, orientation and room conditions fixed.
3. Use the exact same installed bundle and save. Do not rebuild or reinstall between A/B arms. Record battery percentage, charging state, brightness and app/container identity at every arm.
4. Use the bundled Stack to Six app as the primary target. Capture its console over Wi-Fi after unplugging so cable charging does not contaminate the thermal comparison. A cable is used only for a separately validated Instruments power/CPU probe.
5. Do not compare a warm second run with a cool first run. Cool to the same starting state between arms. Reverse arm order on the confirmation pair where practical.

## Test 1: audio contribution, battery A/B/then reversed confirmation

Use the same Beach stage and natural sequence for four minutes: settled board 30s, play 150s, one Fail/Play Again, then result idle 30s. Record actual Special families and merge counts instead of assuming the random boards match.

- Launch the same diagnostic build and flag in both arms so panel/telemetry overhead is identical.
- **A — full authored audio:** diagnostic audio isolation OFF, Music ON, Game Sounds ON.
- Cool to the same starting state.
- **B — route audio runtime isolated:** set Music and Game Sounds OFF, enable diagnostic audio isolation, wait until cleanup and all already-started decode jobs report drained, then cool back to the same starting condition before KRENI and enter the route. The low-level counters must prove zero **new route** context/decode/voice work while haptics and visuals remain unchanged. Legacy startup-only encoded-audio preload is allowed to finish before the measured window and must not be misreported as runtime playback. Restore the player's original settings after the experiment.
- If A/B differ materially, repeat in reversed order B/A after cooldown.

Primary comparisons are time to `fair`/`serious`, worst and count of >34/>250ms gaps, per-source decode milliseconds and bytes, eviction/redecode identities, active voices, terminal cleanup and user-observed warmth/dimming. Audio is a dominant contributor only if the matched audio-off arms repeatedly and materially reduce thermal/power load, the difference correlates with actual audio work, and a repaired full-audio confirmation retains the improvement. Cache counters alone are insufficient.

## Test 2: stationary rendering owners, validated ABBA

Run only after the phone cools. At a fixed Journey World viewport, run `journey-units`, `ambient`, `css-idle` and `gsap-idle` separately. On a settled board with recorded Special owners, run `sheets` and `pixi-render` separately. Each existing probe uses A1/B1/B2/A2 with 5s settling and 20s measurement per phase; any touch or scene change invalidates the run.

Before asking the user to wait through a probe, validate a short completed Instruments capture: at least eight seconds of numeric samples, correct device/app identity, associated WebContent/GPU processes where required, and usable CPU/power tables. A saved trace with a disconnect or missing table is not measurement coverage. A render owner is causal only when both B windows decrease the relevant metric, A2 recovers toward A1, owner/suppression counts are positive, and the scene/brightness/thermal state stayed comparable.

## Test 3: Area 55 return hitch

This is a responsiveness test, separate from sustained heat. Perform one Area 55 Clean Board return after the diagnostic build is installed. The current capture brackets 808ms from CTA to `destination-prepared` and an overlapping 869ms RAF gap, but that interval combines earned-star setup, module scheduling and synchronous World preparation. It is not a measured image-decode duration.

The new correlated record must identify the dominant subphase. Async image readiness/layout/paint occurs after the current `destination-prepared` marker and is measured separately. Only the measured phase owner is changed; authored result exit and Journey enter timing remain protected.

## Test 4: Safari differential, optional and secondary

After the app A/B tests, serve the same source on the phone over local Wi-Fi and repeat one short fixed-brightness route in Mobile Safari. Safari has a different container, cache, audio session and development-server/HMR overhead, so it cannot replace the bundled-app result.

- Similar heating and workload signatures in Safari and the bundled app point toward shared web/game work.
- Heating isolated to the bundled app points toward WKWebView/native integration or packaging differences.
- A single difference does not name the owner; use it to choose the next profiler target.

## Acceptance

The issue is closed only when the dominant owner is measured, an owner-level repair lowers the same A/B metric, and a normal full-audio/full-visual battery run lasts 15 minutes at fixed 50% brightness without `serious`/`critical`, automatic dimming, memory warning escalation, context loss or WebContent termination. Worst frames are reported separately from averages. A separate 100% brightness/charging stress run may be warmer, but must remain stable and cannot be used as the primary acceptance baseline.

## Passive Special/Wild sheet arm — 2026-09-26

The passive `--cc-passive-special-sheets-isolation` arm suppressed managed audio from startup and froze shared Special/Wild sprite-sheet controllers on their static first frame. It did not enable the diagnostics overlay, JavaScript console bridge or `[CC_SOAK]` RAF sampler. Board input, gameplay logic, haptics, the Pixi renderer, static atlas residency and cleanup remained active.

The unplugged55%-brightness run began native `nominal`. Fail1 remained `nominal` at68 impacts/1 notification/1 selection; the user reported `vrlo blago mlak`, and idle added no haptics. Attempt2 remained `nominal` through the last reliable sample at78 impacts. The Wi-Fi debugger then stopped appending before Fail2; the user reported `blago mlak`. A wired relaunch immediately reported `nominal`, changed to `fair` nine seconds later during launch/charging work and stayed `fair` through GOTOVO.

This arm does not support animated sheets as the sole thermal owner. The cooler physical report than the full-visual audio-isolated arm is directionally consistent with some contribution, but the missing unplugged endpoint and wired/WebContent/GPU startup confound prevent a causal or quantitative claim. Managed audio and animated sheets are now both rejected as sole causes. The next experiment must make native telemetry transport-independent with bounded on-device persistence, then isolate broader gameplay Pixi render/cadence while keeping input and board readability. Full evidence is in `logs/passive-special-sheets-isolated-20260926/REPORT.md`.

## Focused GPU/Journey owner repair — 2026-09-26

Three independent code audits converged on compositor/render pressure as the best-supported shared cause cluster. Audio isolation does not alter Pixi cadence, and sheet freezing stops frame advancement without releasing the atlas or stopping full-stage renders. Ordinary continuous play refreshed a2400ms 60 FPS tail on every pointer move, so the complete1.5x mobile Pixi canvas seldom returned to30 FPS. Journey added two continuous ambient canvases plus Unit motion; Area55 alone forced60 FPS and Forest doubled its ambient cadence during native scroll. Card recoil ran a JavaScript RAF and `getComputedStyle(rotor)` every frame even for common cards, while Hub idle animation remained active as the connected World prepaint tree decoded and rasterized behind it.

The bounded production repair changes those owners without altering gameplay resolution, assets or authored Special timing:

- generic pointer activity now retains60 FPS for800ms; explicit lifecycle leases still retain60 FPS for long Special/finale/HUD animation;
- Area55 and Forest ambient canvases stay within the shared30 FPS mobile Journey budget;
- common-card recoil is compositor-only, while Legendary shine derives its angle from WAAPI current time and performs no transform style readback;
- Hub idle paint is paused before the full connected World prepaint is mounted;
- zero-reference Special atlases unload immediately at route exit rather than overlapping Journey for the former8s grace period.

The native JSONL record now includes sequence, app version/build and explicit performance/audio/sheet/haptic mode fields, plus a persistence-cap marker. This corrects the provenance gap that made a lost console connection ambiguous. It still uses the existing five-second native timer and only starts under an explicit diagnostic/isolation flag.

The fixed acceptance route is ten minutes from a naturally cooled, unplugged native `nominal` start at fixed brightness: two minutes Forest World with repeated common-card open/flip/dismiss, two minutes Forest board plus Fail and return, two minutes Beach World/card repetitions, two minutes Beach board plus Fail/return and two minutes Area55 World/card repetitions. Pass requires no blank board/context loss, no common-card warm flip over34ms, no repeated World enter over100ms after cold preparation, zero Special refs/idle atlas bytes after board exit, no monotonic canvas/ticker growth, and thermal remaining nominal or reaching fair materially later than the prior matched route. Subjective smoothness and exact effect quality remain physical acceptance criteria.

## Production acceptance run I and remaining masked-card owner

The first repaired production build ran unplugged with only native telemetry from `KRENI` at19:54:59 through explicit `GOTOVO` at20:05:34, fixed60% brightness and no active isolation. It completed Forest common-card repetitions, Forest7 Fail/return, Beach common-card repetitions and Fail/return, Area55 common-card repetitions and Fail/return, then repeated World cycling. The user reported no visible hitch in any phase, so the previously reported card/World stalls did not reproduce. Native thermal changed `nominal→fair` at approximately19:57:05,126s after KRENI, during Forest common-card work and before board gameplay. It remained fair rather than escalating to serious. The final battery reading was95% after beginning at100%; iOS reports that value coarsely, so it is evidence of nontrivial use rather than a precise energy measurement. The user felt increasing warmth. Haptic counters advanced only with interaction and did not advance while idle.

The full155-record native session is `logs/gpu-journey-thermal-acceptance-20260926/device-thermal/thermal-1790445180381-38626.jsonl`; phase markers are `logs/gpu-journey-thermal-acceptance-20260926/markers.jsonl`. Provenance inside every record confirms app1.0/build3, diagnostics off, audio isolation off and Special-sheet isolation off.

Post-run source correlation found one continuous owner that remains active while World paint is correctly suspended behind a common-card modal: a three-second infinite background-position animation through a full-card alpha mask. Common cards also forced both the portaled artwork and mask from1x to the1032x1528 `@2x` source, while the modal immediately restarted a perpetual6.8s 3D float after each flip. The bounded follow-up keeps one visible Common shine sweep per front presentation, uses the1x source for Common artwork/mask, and waits1.4s of real mobile calm before starting decorative idle. Entry, pointer drag, flip, recoil, dismiss, sound and Legendary2x/holographic behavior remain unchanged. Area55 additionally gates its ten independent CSS beam pulses to the same near-viewport Unit budget already used by its transform ticker, eliminating offscreen perpetual opacity animation. These changes require a new bundled physical run; run I does not prove the final thermal issue closed.

## E normal-full run and stranded-render-chain finding

The normal full-audio/full-haptic E run was unplugged at 55% brightness. It produced 55 complete `[CC_SOAK]` samples and 59 native thermal samples: 38 `nominal`, then 21 `fair`. Across 16,116 observed RAF callbacks the worst gap was 215ms, 71 gaps exceeded 34ms and none exceeded 250ms. The preserved evidence and derived summary are in `logs/thermal-validation-20260925/root-cause-live-e-normal-full/`.

The run reproduced a critical gameplay failure on Forest board 25. The user saw no cubes and could not begin play. Telemetry nevertheless continued to say that the Pixi ticker was started, its cap was 60 FPS and the board container was visible. The board-frame-budget snapshot was byte-identical at 570809, 600833 and 630858ms, despite the route having entered at 565033ms; no fresh-board pop-in marker followed that route. This establishes that the update callbacks were no longer progressing. It does not identify the original throwing listener because the retained event ring did not contain its stack.

A direct probe against the installed Pixi version reproduced the lifecycle defect: if one ticker listener throws, Pixi can remain `started=true` with `_requestId=null`; it schedules no next RAF, and another `start()` call is a no-op. `stop()` followed by `start()` restores delivery. This is the best-supported owner of the invisible/non-starting board and the apparently frozen animation chain.

The source repair is deliberately bounded:

- A gameplay entry performs one generation-owned liveness check only when the ticker reports started and the known Pixi request slot is null. It aborts for a stale generation, hidden document, replaced app, cancelled entry or terminal render suspension. If neither a tick nor a new RAF request appears after one browser frame, it restarts the ticker once and emits `[CC_PIXI_ENTRY] stranded-ticker-restarted`.
- Every audited Special-die ticker boundary contains its own callback failure. A failed Flower, Barrel, Fish, Kanta, shared-sheet, idle-visibility, artwork-layer or HUD-foreground owner is retired and releases its leases; healthy siblings and the global Pixi ticker continue. A bounded `[CC_SPECIAL_TICKER] owner-retired` record retains the first stack and cleanup failure if present.
- Fresh Journey entry and asynchronous Arcade/resume/retry reveal paths await the gameplay entry commit before completing. The Journey surface repair now also detects collapsed, hidden and zero-opacity app/canvas roots without changing authored child poses.
- Soak telemetry separately records `tickerStarted` and `tickerRequestScheduled`, plus stage, board and live/visible tile state, so this contradiction is directly observable in the next capture.

The same E run also proved avoidable audio residency churn rather than a monotonic leak. The final audio snapshot had 27,622,316 decoded resident bytes, 274 evictions, 311,491,912 cumulative evicted bytes and 190 redecodes. Star, Honey and Arcade digit preparation now retains and preloads only the selected/current cue sources. Core gameplay entry no longer warms the complete Wild Star package unless Star is actually committed or restored. Timing, gain and sound assets are unchanged. This should lower decode/cache work, but E does not prove audio was the owner of the stranded board or the only thermal contributor.

Deterministic validation after these changes: `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full` passed all 16 gates, including 408 suites/2,729 tests, gameplay lock 24 suites/306 tests, type checks, lint, visual contracts, production build and bundle audits. The generated `dist` is current; no native bundle sync, install or launch has occurred. Source verdict is **PASS**. Localhost route behavior and a matched normal bundled iPhone run remain **NEEDS PHYSICAL TEST**. Do not call the thermal issue closed until the 15-minute acceptance condition above passes.

## F normal-full run, Forest audio churn and WebContent termination

F ran unplugged at55% brightness with full authored audio, haptics and visuals. All119 native samples remained `nominal`; the display did not dim. The trace contains28,987 RAF callbacks,126ms worst frame,92 gaps over34ms and no gap over250ms. Repeated Beach Fail/Play Again proved the entry repair: terminal samples had a stopped ticker and zero visible/Special owners, while each retry restored `tickerStarted:true`, `tickerRequestScheduled:true` and all gameplay tiles. Neither `[CC_PIXI_ENTRY] stranded-ticker-restarted` nor `[CC_SPECIAL_TICKER] owner-retired` occurred.

Forest exposed a concrete decoded-audio policy mismatch. The Worlds hub master plus its two Forest ambient loops total33,744,392 decoded bytes, already above the ordinary32MiB mobile cache budget. The Forest gameplay loop alone is33,785,136 decoded bytes and occupied the reserved long-loop slot, leaving16MiB for every gameplay effect. Between300561 and480718ms the runtime performed137 decodes,110 redecodes,109.96MB of decoded work and105.44MB of eviction. Repeated drop-special, Barrel, Flower and bonus cues dominated that churn. This proves unnecessary allocation/decode work; it does not by itself prove the later process termination owner.

After the user exited a failed Forest board, Journey destination preparation completed in84ms and the result retired. The first Unit enter then overlapped a637ms RAF gap and a WebGL/context recovery event. The18-asset reload began near the end of that first gap, so it did not cause the gap; it was unnecessary secondary work from hidden/terminal gameplay while Journey owned the screen. The reload added further82/49ms gaps, probes recovered, Journey enter completed and native then emitted `[CC_WEB_CONTENT_INCIDENT] terminated`. No native memory warning or thermal escalation was recorded. The exact upstream reason for the initial context incident and OS WebContent termination remains unknown.

The repair moves only the three long Journey/Forest loop owners to their existing HTML media transport on mobile; desktop decoded playback, source assets, gain, fade timing and cleanup stay unchanged. Core texture recovery now defers while gameplay is hidden, terminal or route-stale; the pending full repair is awaited by the next authoritative gameplay commit. Every inner probe/reload/rebind boundary verifies the captured renderer and current app, route, generation, canvas, stage, board and HUD owner. A lost-context callback no longer submits a render into the lost context, and prepared reveal restores stale canvas visibility.

Deterministic validation passes all16 gates,410 suites and2,750 tests. The repaired exact Stack to Six1.0/build3 package was installed over existing data and launched for G with diagnostics at18:06:53 CEST. Initial native state is thermal `nominal`,70% battery,charging state2,55% brightness and Low Power Mode false. G is valid only after unplug confirmation and must exercise Forest hub→level7, Special/Flower activity, Fail exit→Journey and gameplay re-entry. The expected evidence is no decoded residency for the three long mobile loops, sharply reduced redecodes/evictions, no hidden-gameplay full texture reload, no context/WebContent termination and acceptable physical audio continuity. Final15-minute normal-play acceptance remains required.

## G normal-full run: lifecycle recovery passed, Journey idle power failed

G ran unplugged at55% brightness with normal audio, haptics and visuals. The repaired gameplay lifecycle held: Forest gameplay entered with a live scheduled ticker and visible tiles, Fail/Clean Board return and re-entry succeeded, and the capture contained no blank board, context loss, hidden18-texture recovery or WebContent termination. Mobile long loops no longer occupied the decoded cache. At the final resource sample the ordinary decoded cache held32,773,544 bytes, active/pending gameplay voices were zero, and cumulative churn was85 redecodes,117 evictions and93,235,436 evicted bytes. This is materially less churn than F, while still showing avoidable short-cue cache work.

The run nevertheless **failed physical thermal and responsiveness acceptance**. The user marked a stutter during Journey card flip-to-enlarge, later broad UI stutter, and a strong Forest board-exit/Unit-appearance stutter. Relevant five-second callback windows included21.65ms average/65ms worst/42 gaps over34ms,20.24ms/103ms/25, then sustained Journey windows of19.85–27.67ms average,67–94ms worst and22–57 gaps over34ms. Native thermal changed `nominal→fair` during the Journey return tail and reached `serious` near685s while gameplay ticker and request were stopped, gameplay stage/board were hidden, tiles and Special owners were zero, shared Pixi sheets and runtime textures were zero and Pixi cadence was inactive. The final recorded native state was serious,95% battery and55% brightness. These RAF values measure JS callback delivery rather than presented GPU FPS.

Source review after GOTOVO found two concrete unbounded owners and one diagnostic contaminant:

- direct World entry and board-to-World return restarted `crumbleworlds.wav` but did not acquire the Hub path's5s hold plus1s fade. It could therefore remain as an untracked HTML media loop beside both Forest ambient loops; decoded `activeVoices:0` did not cover this owner;
- offscreen interim-card bounce/smoke/shine and NEW-ribbon mask animation could continue for mounted Units outside the viewport. The existing thermal `gsap-idle` switch also missed the repeat-at-Timeline owner, so its earlier negative isolation result did not exclude this work;
- each30s diagnostic `resources-lite` message serialized up to256 complete audio events across the native console bridge, creating33k–56k-token messages. This perturbed G and prevents treating its thermal curve as a clean production-power measurement, though it does not explain every sustained Journey window by itself.

The bounded source repair gives every World entry the same non-extendable5s+1s lifetime; duplicate entry callbacks cannot postpone it. Journey local idle work now uses the existing bounded Unit IntersectionObserver and the runtime/transition owner gate: offscreen or suspended Units pause the same bounce timeline and shine cadence, clean current smoke, pause the ribbon while preserving its phase and release `will-change`; delayed smoke/shine callbacks recheck the complete gate before painting. Gameplay-audio diagnostics drain counts and cumulative summaries during ordinary soak capture and include bounded event details only under explicit detailed diagnostics. Authored visible motion, durations, gains and assets are unchanged.

The native stdout stream for G was attached rather than losslessly file-backed. Bootstrap/control files and user markers remain under `logs/thermal-validation-20260925/root-cause-live-g-audio-render-fix/`; exact final samples were preserved in the live session record and summarized here. The stopped process signal2 was commanded only after the final buffer was read. The repair passes all16 deterministic QA gates, including the24-suite/306-test Gameplay KING lock, complete tests, TypeScript, unused-code audit, lint, visual contracts and the no-native-sync production build. Localhost approval and a newly installed physical confirmation remain required. G itself remains **FAIL** and does not close the thermal issue.

## Post-G deep audio lifecycle audit

The follow-up audit found and repaired additional source-proven audio lifecycle gaps. These are valid defects, but none retroactively proves that audio caused G's complete thermal curve.

- The three detached Journey long-loop owners (Worlds, Forest World and Forest gameplay) now share an event-driven visibility lifecycle. Hidden/pagehide pauses the exact media or decoded voice; foreground resumes only a still-current route owner. `cc:native-audio-active` remains the explicit WKWebView recovery path when `document.hidden` is stale. A route stop cancels foreground reacquisition, a terminal fade cannot revive, and stale `play()` results cannot mutate a newer session. The World five-second hold retains its original absolute deadline through background time.
- Arcade's pending Calm-to-Active bar switch is cancelled when hidden while preserving the requested layer for foreground. Cold Arcade entry and delayed new-round work cannot fetch or start a voice while hidden. The same guard now covers an async menu route handoff calling `fadeInAndResume()` after the app was backgrounded; normal visibility or native-active restores that intent.
- Fail and Clean Board HTML media fallbacks now carry a per-entry generation. An old retained element's late `play()` resolve/reject can no longer erase the new result's `onended` or `onStopped` callback and strand the soundtrack-result mix receipt.
- Ordinary soak samples now expose a bounded detached-loop aggregate (at most three owners/four media elements) and up to twelve hottest gameplay-audio sources with decode/eviction counts, byte totals, wall time and eviction reason. They do not restore the former full event array or add a timer/RAF.

The bounded gameplay PCM cache is not itself proof of ongoing CPU work. G ended with about32.77MB idle residency and zero active/pending gameplay voices. Routine trimming on every retry was deliberately not added because earlier evidence shows it increases subsequent decode churn. Arcade Calm/Active voices each decode their own bounded transport buffer when switching; that cost is outside gameplay-cache counters and did not run on G's Forest route. Short gameplay SFX still need a separate background-to-late-decode test before changing their authored one-shot semantics, and Forest/Area55 transition tails intentionally survive normal cleanup.

Final deterministic validation: integrated audio/Journey tests12 suites/117 tests PASS; `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full` PASS all16 gates,412 suites/2,797 tests, Gameplay KING24/306 and a1,080-module production build. The local `dist` is current. No Web.bundle sync, native build, install or launch occurred. The installed phone therefore does not contain this post-G lifecycle repair. Physical verdict remains **NEEDS PHYSICAL TEST**.

## H repaired-build route and diagnostic RAF contamination

The repaired build was installed and exercised unplugged through Forest, Beach and Area55 Worlds, Forest level7, Area55 level27, both board returns and Beach16 Special/Wild-heavy play. Stationary Worlds were stable. Forest and Area55 returns completed without G's sustained post-return degradation. Beach16 eventually changed native thermal `nominal→fair`; the user reported the device first `mlak`, then `mrvicu topliji ali mlak i dalje`.

At Beach16 Fail, terminal cleanup was complete: gameplay ticker/request stopped, terminal suspension active, Special owners zero, shared Pixi residency/textures zero and gameplay audio active/pending voices zero. The gameplay audio cache held about32.37MB after25 budget evictions/21.33MB evicted and one re-decode. These counters remained fixed for more than two minutes of Fail idle, so neither a continuing Special/Pixi owner nor continuing gameplay-audio decode churn explains that idle tail. One soundtrack voice remained active.

The capture also proved a stronger measurement contaminant than the prior bounded console payload: `runtime-soak-sampler.ts` continuously re-scheduled its own `requestAnimationFrame`, producing about300 callbacks per five-second interval even after every gameplay owner stopped. The app therefore could not enter a production-equivalent WebView idle state while full performance diagnostics were enabled. H remains valid for lifecycle/resource correlation and proves that `fair` occurred under heavy play plus instrumentation, but it cannot establish normal-build idle power or assign the thermal transition solely to audio, haptics or rendering.

The native wrapper now has an explicit `--cc-native-thermal-telemetry` launch mode. It starts only the existing five-second native thermal/battery/brightness/haptic timer; the JavaScript console bridge, `window.__ccPerformanceDiagnostics` flag and web RAF sampler remain disabled. `qa:ios` enforces this separation. Signed build and install-over succeeded, preserving data. A bounded verification launch emitted repeated `[CC_NATIVE_THERMAL]` records and no `[CC_SOAK]` output. It began at residual `fair`, so the next decisive run must start naturally cooled, unplugged and native `nominal`, then repeat the same route using only this passive flag.

## Passive normal versus audio-isolated Beach A/B

The passive normal arm started unplugged at native `nominal`,55% brightness and70% battery. First Beach Fail remained nominal at67 impact requests/one notification and the user reported `mlak`. During the second attempt the CoreDevice console transport invalidated; a process snapshot proved Stack to Six plus its WebContent/GPU processes remained alive, so no crash was inferred. An immediate controlled relaunch with the same passive telemetry reported native `fair` at70%/55%; the user reported `topao`. Relaunched idle added no haptics and stayed fair through explicit GOTOVO. The lost interval means exact normal-arm onset latency is unknown.

The matched B package added explicit `--cc-passive-audio-isolation`. A document-start native script marks audio isolation available and suppressed before any web audio owner subscribes. It does not set `window.__ccPerformanceDiagnostics`, register `consoleLog`, load the isolation panel or start a RAF sampler. Focused isolation tests5/5 and `qa:ios` passed; the1,083-module production build and signed Xcode build succeeded. Dist, official Web.bundle and final app entrypoint SHA-256 is `4c4598b0b747a8342c426209f164980fe22c41244d35932db9c2eb042ddf1306`; install-over preserved data in container `153BCA19-650E-4EBE-919C-155BD8CDDC06`.

B started unplugged at nominal,55% brightness and70% battery; the user confirmed complete silence. First Fail remained nominal at64 impact requests/one notification, closely matching A's67/one. During the second attempt native changed `nominal→fair` at139 impact requests. Second Fail ended at163 impacts/two notifications/two selections; the user reported `mlak`. More than one minute of Fail idle added no haptics and remained fair through GOTOVO.

**Result:** managed soundtrack/SFX work is not the dominant thermal owner for repeated Beach play. Audio cache/decode churn remains real avoidable performance work, and this comparison does not prove zero audio contribution. The common remaining work includes Pixi/gameplay render submission, Special/Wild visual animation, CSS/compositor work and physical haptics. Prior C/D evidence already failed to support physical haptic output as dominant. The next discriminator should isolate Special/Pixi visual work in a passive launch, retain normal input and static gameplay readability, and repeat the same two-attempt route after natural cooldown. Full A/B evidence is summarized in `logs/passive-audio-isolated-20260926/REPORT.md`.
