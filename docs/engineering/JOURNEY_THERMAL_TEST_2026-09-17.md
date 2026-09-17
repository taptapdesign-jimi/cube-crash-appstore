# Journey thermal attribution test

## Scope and current status

User reports rapid heating during Journey gameplay. Investigate first; no thermal optimization or new phone installation in this task. Installed baseline remains Stack to Six index `4fd572c4e4a831ed61e1da3a5de6beb65c4f8b8f1219435a807410be02de6d36`. The newer upward-card-dismiss parity exists only in source/local dist and must not be mixed into the baseline.

## Completed capture and findings — 2026-09-17

**Capture PASS; causal attribution and optimization NEEDS PHYSICAL TEST.** User explicitly ended with GOTOVO at17:41:56.647CEST and reported still very warm, perhaps warmer. Buffered console was read, Power Profiler stopped and saved, then native console stopped. No recording remains active. No runtime changes, asset changes, build or installation made for this investigation.

Opening the exact installed app restored Instruments connectivity. All-process Power Profiler failed because Location Energy Model did not support that target; successful capture attached Stack to Six PID60091 from17:31:13.524 to17:42:09.495CEST. Failed trace/export artifacts are retained separately; the successful system export is `SystemPowerLevel-retry.xml`. Phone remained wired, battery100, low-power modefalse. Charging-state interval spans almost the full capture; actual charging wattage is unknown. System discharge rate reports0 throughout and cannot be interpreted as zero energy consumption.

Repeatable analysis: `logs/journey-thermal-attribution-20260917/analyze_phases.py`; output `phase-analysis.json`. XML IDs/references are resolved; missing subsystem sentinels excluded; interval scores weighted by overlap. Fixed windows from confirmed markers:45/45/60/120/60/45seconds. The first requested BOARD_AFTER was contaminated by continued gameplay and excluded; valid idle begins at explicit STAO17:38:50.508. Navigation gaps excluded. Each reported impact metric covers the complete chosen window. Host receipt timestamps introduce small boundary uncertainty.

| Phase | CPU impact | GPU impact | Display impact | Brightness |
| --- | ---: | ---: | ---: | ---: |
| HOME_BEFORE | 0.97 | 0.18 | 9.96 | 97.9% |
| WORLD_IDLE | 1.00 | 2.07 | 8.96 | 98.0% |
| BOARD_BEFORE | 0.23 | 1.00 | 10.00 | 98.0% |
| PLAY | 2.14 | 1.20 | 10.45 | 98.0% |
| BOARD_AFTER | 0.14 | 1.00 | 10.00 | 98.0% |
| HOME_AFTER | 1.00 | 0.29 | 9.96 | 98.0% |

Impact values are profiler scores, not watts, temperature, utilization percentages or a precise energy-share decomposition. Their relative changes within each subsystem identify useful follow-up targets.

- Display brightness97–98% throughout all analyzed phases, primarily98%, is a major uncontrolled contributor to investigate. Display impact remains high even while idle. This is a strong reason for a controlled brightness A/B, not proof display is the sole/main heat source.
- CPU impact falls from2.14 during play to0.145 after explicit stop. No sustained active-play CPU score survives that idle period. Homepage CPU returns close to baseline0.972→1.005; GPU0.180→0.294 remains low relative to map/board. This single run does not prove absence of retained work or a memory leak.
- Stationary map GPU impact2.067 exceeds idle board1.000 and active-play mean1.203 in this trace. Map rendering/animation is the first code-specific attribution target. Scenes and contents differ; score ratios are not energy ratios and do not prove any particular animation owner is faulty.
- Thermal state changed nominal→fair at trace104.126s (~17:32:57.650CEST), during stationary map, and stayedfair through end. No serious/critical interval. Subjective TOPLO occurred during board idle17:35:01.521. Thermal lag plus prior work and profiler/charging confounders prevent assigning heat to the screen showing at that moment.
- Native memory warning17:32:46.073 before confirmed map idle is a separate issue to investigate. Snapshot:349DOM nodes,118images,3canvases; decoded soundtrack22,921,368bytes and gameplay audio35,460,240bytes. The warning alone proves neither a leak nor thermal causality.
- CPU stack export contains only native Stack to Six60091 (57.157sample-weight seconds over656s), not verified WebContent JavaScript stacks. It cannot identify a JavaScript function or clear the rendering subsystem. The diagnostic RAF trace is not actual Pixi render cadence.

### Next controlled test

Allow the phone to return to a comparable cool state. Repeat the same Journey route at fixed50% brightness, same audio/network/case and charging conditions, without profiler first; include a matched98% run after cooldown/reversed order to distinguish display contribution. Prefer unplugged/wireless for both comparison runs if transport is verified; changing brightness and charging simultaneously would confound the A/B. Subjective heat alone remains coarse; collect thermal-state markers with the light console capture when available.

Separately profile45–60s stationary map with verified associated WebContent/GPU ownership and a short CPU/rendering capture. Inspect continuously running map animation/compositor owners, then board Pixi/DOM synchronization if warranted. Only implement an owner-specific optimization after attribution, retaining visuals/assets/touch behavior. Confirm any patch with deterministic QA/KING and the same physical conditions. Initial warmth, exact World/Stage, case and charging wattage were not recorded in this run.


## Controlled first pass (about six minutes)

Before KRENI: confirm connection works; record actual installed package, chosen World/Stage, battery %, charging status, brightness, Low Power Mode, case and initial subjective warmth. Wired transport is confirmed; charging status is not. Keep brightness, sound and network conditions unchanged. Prefer battery/wireless power measurement once connectivity is verified; don't compare charging with unplugged runs. Start from a similarly cool phone for repeat runs. Native thermalState is a coarse OS category, not degrees Celsius or surface temperature.

Launch exact installed Stack to Six with existing compact diagnostics and retain timestamped console until explicit GOTOVO. Use the Power Profiler for system/app CPU/GPU/display/network impact when the device provides those tracks; inspect actual trace schemas before claiming availability. Identify host and associated WebContent/GPU processes, including process restarts. Do not attribute unrelated WebKit processes to this app merely by process name. If CPU dominates, do a separate short all-process Time Profiler capture of the implicated phase and analyze only the verified app processes. Do not stack heavy profiling tools during the baseline.

| Phase marker | Minimum settled duration | User action | Question answered |
| --- | --- | --- | --- |
| HOME_BEFORE | 45 s | Leave Homepage untouched | Idle baseline |
| WORLD_IDLE | 45 s | Open reported Journey World, stop scrolling | Does map/ambient work dominate? |
| BOARD_BEFORE | 60 s | Open reported Stage, no drag | Cost of steady board rendering |
| PLAY | 120 s | Normal play, including naturally available specials | Additional ordinary/special gameplay cost |
| BOARD_AFTER | 60 s | Stop touching the same board | Does activity settle after 2.4 s, or stay expensive? |
| HOME_AFTER | 45 s | Return to Homepage, no input | Does gameplay work survive navigation? |

Mark phase arrival only after the requested screen is reached; count navigation/entry separately. User writes TOPLO/PROBLEM when warmth becomes noticeable, and GOTOVO when done. The assistant supplies phase prompts; do not require the user to time every phase. A naturally completed board changes workload: mark it and compare tile/special counts, not just stage name. No reset of user saves to force identical runs.

## Candidate ranking from current source (not measured blame)

1. **Continuous special-art presentation and Pixi/DOM synchronization.** `animated-special-artwork-layer.ts:374` obtains computed canvas style and bounds every Pixi tick, writes root visibility/depth, then invokes per-art owners. At active 60Hz this is continuous work. Need main-thread layout/style/JS samples plus actual visible special counts; compare board idle before specials, after specials and after leaving gameplay. Repeated reads/writes do not by themselves prove forced layout or dominance.
2. **Rendering cadence and lifecycle.** `pixi-mobile-frame-controller.ts` maintains60FPS during interaction/leases and30FPS at settled idle; pointer movement extends a2.4s tail. Active60FPS is intended, not automatically a bug. Check post-play work decreases; investigate leaked leases or hidden owners only with evidence. `shared-pixi-sheet-animation.ts` and `special-dice-idle.ts` contribute steady animation work. Distinguish CPU callback rate from actual GPU/display frames.
3. **Special finale bursts, particles, decoding/upload and resource retention.** Correlate merge family summaries with CPU/GPU impact and memory; repeat a short suspected phase. A single expensive frame does not establish sustained thermal causality. Growing resident memory alone is not proof of a leak.
4. **Hidden Journey/map work or compositor effects.** Compare HOME_BEFORE/HOME_AFTER and WORLD_IDLE/BOARD_BEFORE. Only inspect shadow/filter/offscreen-pass costs where that surface is actually rendered; do not blame hidden modal CSS from a source grep.

Renderer already uses mobile resolution<=1.5, antialias=false and low-power preference. Gyro remains removed. Do not blindly lower resolution/FPS or remove authored assets, audio, special dice or effects.

## Attribution and acceptance

Compare CPU time per wall second, GPU busy/power-impact tracks where available, actual Pixi cadence/leases, renderer resolution, visible special owners, memory trend and thermal timeline. Existing console does not expose every one of these; missing metrics remain unknown. Prefer bounded snapshots at phase boundaries over continuous DOM walks. Temperature lags workload: a thermal change in HOME_AFTER does not prove Homepage caused it. Power impact scores are not watts, CPU sample weights are not energy, and overall system power includes display and other processes.

For the largest measured owner: one reversible change, same scene/workload/brightness/charge state, baseline→candidate→baseline or reversed order after cooldown. Keep a normal no-profiler repeat to assess observer overhead. Optimize only if the specific CPU/GPU cost falls consistently while appearance, touch and Gameplay KING remain intact. Confirm thermal behavior in a longer10–15minute battery run after attribution; a six-minute screen tour is discovery, not thermal certification.

## References

- Apple Power Profiler/CPU attribution: https://developer.apple.com/videos/play/wwdc2025/226/
- WebKit sustained work and energy: https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/
- Project capture rules: LIVE_DEBUG_WORKFLOW.md; IOS_LIVE_PERFORMANCE_INVESTIGATION.md.

## Repeat with reduced brightness — completed18:02CEST

**Capture and export PASS; main heat-source attribution NEEDS PHYSICAL TEST.** Both streams closed after explicit GOTOVO18:02:21.126, buffered console read first. Profiler trace17:52:26.051–18:02:34.589,608.538s, same installed Stack to Six60509/container6B0AE22C. Console82126/PID63391 and profiler74895/PID63451 ended. No runtime/build/install changes. Evidence `logs/journey-thermal-50pct-20260917`, repeatable analyzer and phase-analysis.json; all phase metric windows have complete coverage.

Requested50% brightness was NOT the exact measured condition: profiler reports41% through initial Home/map/board/play/post-play,38% in final Home. Use measured conditions, not directory name, in comparisons. User confirmed phone cooled before start and reported TOPLO17:56:56 shortly after play instruction; no final subjective comparison supplied. Wired/battery100/low-powerfalse retained.

| Phase | CPU impact first → repeat | GPU impact first → repeat | Display impact first → repeat |
| --- | ---: | ---: | ---: |
| HOME_BEFORE | 0.97 → 0.66 | 0.18 → 0.14 | 9.96 → 3.00 |
| WORLD_IDLE | 1.00 → 1.00 | 2.07 → 2.00 | 8.96 → 3.00 |
| BOARD_BEFORE | 0.23 → 0.18 | 1.00 → 1.00 | 10.00 → 3.00 |
| PLAY | 2.14 → 1.06 | 1.20 → 1.04 | 10.45 → 3.00 |
| BOARD_AFTER | 0.14 → 0.22 | 1.00 → 1.00 | 10.00 → 3.00 |
| HOME_AFTER | 1.00 → 0.67 | 0.29 → 0.10 | 9.96 → 3.00 |

Scores are unitless and not energy-share percentages. The separate raw display-power metric fell approximately29–31% across matched screen phases; exported unit is unspecified, so no watts claimed. Display impact dropped to3 across phases; this supports brightness/display as a material power contributor, but does not quantify its share of heat.

Thermal nominal→fair occurred17:59:05.620CEST,399.569s after trace start, versus104.126s in first capture. Relative to KRENI: approximately6m10s versus1m30s. Stayedfair to end, no serious/critical. This delay is NOT an isolated brightness effect: second requested120s PLAY window had43 merge-performance summaries vs87 first run (wild5 vs8), with first second-run summary only17:57:55.874 (~74s after PLAY instruction); actual active gameplay was delayed and workload differed. Initial subjective cooldown was not a temperature measurement. Compare stationary phases more confidently than active-play/thermal timing.

Stationary map GPU impact reproduces2.0 vs settled board1.0 and Home0.10–0.14. This is the strongest code-specific follow-up target; score ratio is not an energy ratio. CPU after stopping falls1.064→0.223 in repeat, and Home returns0.659→0.665, with zero merge summaries during confirmed post-stop idle. No evidence of sustained active-play CPU load surviving exit in these windows; not proof of leak absence.

Memory warning repeats17:54:02 on map entry while nominal, before MAPA17:54:08.600, with same349DOM/118images/3canvases and soundtrack/gameplay decoded-byte totals as first run. Reproducible pressure signal, not established heat cause or leak; decoded image/native memory and profiler overhead remain unmeasured.

Next: short stationary-map WebContent/render attribution with verified process ownership, compare same map/viewport at fixed measured brightness, inspect actual per-frame owners/offscreen work; separate memory-pressure investigation. Do not lower active FPS, remove assets or patch arbitrary shadows based solely on this trace.

### Source attribution follow-up18:05

Current source already bounds mobile Unit idle30FPS with visibility budget2; Forest ambient uses shared two viewport canvases,1.25DPR,30FPS settled/60FPS scroll boost and80px margin. Canvas runtime clears both full surfaces per render; per-Unit GSAP setters remain separate. Continuous canvas repaint/compositing is a candidate, not established dominant cost. Cards eagerly request images with CSS background plus hidden preload img; shared URLs do not prove duplicate decode memory. Native warning handler calls generic memory cleanup and Pixi textureGC; synchronous snapshots are unchanged and cannot prove later native reclamation. Repeat also includes warnings during gameplay17:59:10 (idle audio24,352,700bytes, idle sheets11,986,380bytes) and Home18:01:00 (idle audio34,431,560bytes,sheets0). Main memory root cause remains unknown. All-process Time Profiler next to separate native/WebContent/compositor work; no runtime change.
