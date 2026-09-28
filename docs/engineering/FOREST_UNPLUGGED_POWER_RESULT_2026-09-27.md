# Unplugged Forest visual power comparison — 2026-09-27

Verdict: VALID COMPARISON for aggregate visual-work power; thermal optimization remains NEEDS PHYSICAL TEST.

User started at21:48:35CEST; automatic12min5sec protocol completed22:00:40CEST. User confirmed GOTOVO and reported **Mlak**. Console and Power Profiler have stopped and saved. Device was unplugged throughout all measured windows, native brightness55% (Instruments54%, stable within its own series), native thermal nominal throughout. No app/runtime changes during reproduction.

| Phase | Condition | Estimated whole-device battery % per hour | CPU impact score | GPU impact score |
|---|---|---:|---:|---:|
|0|Static|13.108|0.134|0.011|
|1|Animated|20.873|1.417|1.841|
|2|Animated|18.785|1.491|1.863|
|3|Static|12.136|0.136|0.016|

Static mean12.622, animated mean19.829: **57.1% higher estimated whole-device power with visual work enabled**, or36.3% lower after holding it. These are rates, not a claim that the12min test drained19.8% battery. Baseline static drift7.7%; both enabled windows exceed both static windows. Export covers effectively100% of every165s measurement window. No instrumentation gaps found.

Both static windows have zero sampled DOM changes, paused captured Web Animations/global timeline, and9880/9877 blocked calls each for ambient and Unit owners. Animated windows have9870/9885 calls each with zero suppression. Audio stayed one soundtrack voice, two playing long-loop media, zero SFX voices in all resource snapshots. Haptics did not change. GPU/CPU impact values are Instruments model scores, NOT utilization percentages, watts or energy-share ratios. System power includes display, wireless instrumentation and all device work.

The difference is attributable to the **aggregate visual workload held by this diagnostic**. Static mode pauses the global GSAP timeline as well as World owners, so it may also stop hidden/unrelated visual work. This is NOT proof that a specific Forest card/bee/Unit is the single culprit. Next discriminate World-local transform/ambient/interim work and any still-running non-World GSAP owners using the now-verified power capture; previous per-owner CPU percentages cannot answer that question. No reason to remove audio based on this run.

Frame-callback windows: static0 worst58ms/8 above34ms; animated1 worst175ms/8; animated2 worst52ms/6; static3 worst56ms/6. These are callback spacing, not direct display-present measurements; window boundaries are based on sampler receipt time. Worst175ms remains recorded, not hidden by averages. Native nominal and user mlak do not certify10min active gameplay or solve prior heating.

Artifacts: `logs/unplugged-world-test-20260927/{comparison.json,subsystem-comparison.json,native-completed-test.jsonl,console-gotovo.log,toc.xml,system-power-full.xml,process-power-full.xml}`. Native file successfully extracted397 rows including all phases. Raw trace `/tmp/sts-unplugged-forest-static-animated-20260927.trace`.
