# Critical Area55 physical capture — 2026-09-17

## Verdict

**FAIL: physical smoothness and thermal acceptance.** User reported LaserGun stutter, whole Area55 stutter, large board-entry transition drop, automatic display dimming and a hot phone. No spontaneous app/WebContent/GPU replacement was observed. Existing repairs cannot be declared a thermal solution. No new phone test or source change was made during analysis.

## Evidence preservation

Raw console, markers, process timeline, Power Profiler trace and integrity manifest reside in `logs/tnt-frame-phone-20260917`. `raw-evidence-sha256.json` records checksums. `raw-evidence.tar.gz` preserves the core evidence together. Analysis: `transition-analysis.json/.md`, `power-analysis.json/.md`, `capture-summary.json`, `summarize_capture.py`.

Installed entrypoint SHA25636aac6568cdc9138cbc242b90a859767160d461fd88972d06da5d93fea1ea9c2; final package verified all1766rawassets and dist chunks; container6A1DBB9C-82D5-48EC-9D50-BD41DFA4CF7D. Exact bundle com.taptapdesign.stacktosix.Stack-to-Six, native62782/WebContent62784/GPU62785 unchanged in77processsamples. Console ended with transport disconnect20:08:06, not a demonstrated app crash. User had been instructed to unplug and stop. Monitor stopped after explicitGOTOVO; no capture remains active.

## Timeline (CEST)

| Time | Observation |
| --- | --- |
|20:01:15|Native nominal,brightness setting100%,battery100%,chargingstate2,LPMfalse. User said cold/almostcold.|
|20:02:49|First memory warning on Journey map, before gameplay; this already excludes a newly played TNT finale as the sole origin of memory pressure.|
|20:04:19.758|Thermal fair,~184s after first native sample /111s afterKRENI.|
|20:05:29–48|Area55 navigation/entry corridor;44recorded intervals>34ms across selected5saggregates,worst253ms. Not all belong to board transition itself.|
|20:05:56|First LaserGun merge gap151ms.|
|20:06:09|Kanta merge gap174–175ms.|
|20:06:14|Second LaserGun merge gap142ms.|
|20:06:17.540–17.894 approximate|354msRAFcallback gap; native memorywarning at17.695 lies inside the aligned interval. Idle gameplayaudio43.01MiB→0 atcleanup. Correlation, not isolated causality.|
|20:06:29.598|User LaserGun stutter marker(processingtime).|
|20:06:34.755|First thermal serious,~319s after firstnative sample /246s afterKRENI.|
|20:07:02|Journey return/enter measured worst109ms,7intervals>34ms during686ms viewport transition.|
|20:07:03.441|User dimming marker; brightnessAPIstill100, not a luminance measurement.|
|20:07:17 /20:07:30|Further memorywarnings. Sixwarnings total duringcapture.|
|20:07:42.909|WholeArea55 and boardtransition symptommarkers(retrospective, eventtimeunspecified).|
|20:07:42 approximate|765ms callbackgap, late in capture; exactcause unknown and not automatically assigned toLaserGun.|
|20:08:01.434|Instruments reports Device disconnected; captureend earlier thanGOTOVO20:08:10.947.|

## Strongest source leads

1. **Shared merge completion, not solely lasers.** Relative to drop, long gaps begin +66ms forLaserGun54, +64ms forKanta60, +65ms forLaserGun63, +66ms forRobo71, +83ms forRobo83. All align with the80ms absorb tween completion in `app-core.ts` (around10394). That callback removes tiles and prepares mixed DOM/Pixi effects/multiplier. The gap includes callback and subsequent rendering; no CPU stack establishes which operation dominates. Kanta smoke creation milestone is only5ms inside its175msgap, so smoke creation alone is insufficient.
2. **LaserGun layout solver.** `lasergun-finale-scene.ts` solveGunLayoutBeforeEntry (around743–834) interleaves transform writes with live bounding-rectangle reads. Nested loops allow up to768rectreads pergun and up to4synchronously solved guns. This is a theoretical upper bound, NOT measured iterations or a proven151msCPUcost. Real layout differs from jsdom's early fallback. Geometry/aim and accepted visualpaths must be preserved in any replacement.
3. **Memory pressure / cleanup / reloading.** Six native warnings. At354msgap idleaudio drops43.01MiB→0; other warningsrelease22.41MiB,10.98MiB and18.36MiB. Native handler also purges its raw-filecache and asksWebKit to clear memorycache. Release/redecode churn is plausible, but warning may reflect whole-device pressure; no resident WebContent budget was captured. Active audio was correctly protected; do not indiscriminately cut it.
4. **Transitions have independent workload.** Large Area55entrycorridor gaps precede any Area55LaserGunmerge. Later transitiondegrades further whenserious. Not enough phaseinstrumentation to attribute the reported boardtransition's complete duration to a specificowner.
5. **New TNT retirement is not a per-merge timer.** It only runs atcleanupGame. LaserGun's ownDOM/videoassets are excluded fromeviction. Recurring stallswithinoneboard are not directly explained by thisretirement; reentrydecodecost is still possible and unmeasured. Forest runusedBarrel; noFlowermerge is recorded, so do not claimfullFlowerphysicalcoverage.

## Recording limitation — material

Power Profiler displayed recording, but the saved trace exports **zero CPU,time-profile,subsystempower,systempower,Metalprocess and rawPowerMetricssignpost samples**. Thermal table contains onlyUnknown coveringthetrace; validthermal data comesfromnativeconsole instead. Independent exportercheck agrees. Cause of missing samples is notestablished; disconnect andDeferredrecording are metadata,not proof of whydata isabsent. Thus no percentage CPU/GPU/display attribution, watts, stackcausality or before/afterenergysavings can be calculated fromthistrace. Do not representthetrace as successfulenergymeasurement. Rawconsole and77processsnapshots remain useful. Futureprofiling mustverify usable sampledata whileconnected beforedeclaringinstrumentcoverage.

## Interpretation and next implementation targets

Multiple costs may interact: transition/setup bursts, specialmerge/renderwork, memorypressure/redecode and laterthermalrestriction. Seriousstate does not explain earliergaps; fairstate may already affectperformance. This is not proof of a single globalrootcause or of regression fromthenewpatch: previousruns differ inbrightness,chargingstate,initialthermalstate,duration andplaycontent.

Prioritize bounded sourcework around common80mscompletion(read/write batching,creationreuse andworkownership), then replaceiterativeLaserGungeometrywith equivalentanalytic/cachedgeometry aftercorrectnessproof, then inspectscopeofpressurecleanup/reload. Avoid global30FPS,removingFX,blindWebViewreload,assetmutation orengineport. Each repairrequiresactualownerregressioncoverage and focusedphysicalacceptance; no generic newtour is requested inthisanalysis.
