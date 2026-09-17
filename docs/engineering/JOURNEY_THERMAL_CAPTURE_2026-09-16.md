# Journey / HUD / Homepage performance capture

2026-09-16, iPhone 13 blue, Stack to Six installed f153d457 package. No new source fix was installed. Exact bundled diagnostic launch confirmed at22:09:25 CEST with CC_SOAK and CC_NATIVE_THERMAL output.

KRENI22:09:36.256 → GOTOVO22:12:40.469 CEST (184.213s). User markers:

- 22:11:52.862: “pproblem hud animacija exit je jako spora kao da je probkem u trzanju u fps”
- 22:12:20.487: “problem- animacija glavne slike na homepage slideru trzne nije glatka”

## Findings

35 complete five-second frame windows,10,391 samples,weighted mean16.788ms,worst124ms,45 frames above34ms,none above250ms. This is requestAnimationFrame telemetry, not measured GPU/compositor frame presentation.

HUD report: window ending22:11:51 peaks54ms with2 frames above34ms; next window peaks63ms with1. Journey return ownership begins22:11:49.955 and navigation exit resolves22:11:50.179. Homepage report: window ending22:12:21 peaks53ms with4 frames above34ms, around home route switch22:12:20.223. Following window peaks57ms with5 frames above34ms during another Journey transition.

These observations support transition hitching, but user markers are retrospective and windows are5seconds. They do not distinguish expensive scripting, layout, image decode/upload, compositor work, intentional animation duration or competing transforms. No exact root cause or successful fix is claimed.

All36 native thermal samples were nominal, low power mode false,battery100%. No logged in-range warning/error/reload/crash. This3minute test does not establish sustained thermal safety or measure CPU/GPU power or screen brightness. End sample clears tracked runtime texture/shared-sheet/timer/listener owners; this is not a full process-memory measurement.

## Status

Physical smoothness **FAIL** based on both user reports and observed long frame intervals. Thermal under sustained play **NEEDS PHYSICAL TEST**. Next investigation requires narrow phase timings for HUD exit and Homepage hero, plus CPU/GPU attribution where available. Preserve accepted animation paths and assets; do not shorten animations merely to mask stalls.

Raw console, host markers, parsed events, analysis and scripts: `logs/journey-thermal-20260916-live/`. Buffered output read before stopping devicectl; app intentionally terminated with signal2 at22:12:46 after GOTOVO, not an in-test crash. No code/build/native package changes during this capture.

## Authorized source repairs

User requested recording and fixing Journey entrances, HUD exit and Homepage hero smoothness after the complete capture. Assets and accepted motion profiles remain protected. Three bounded owners are under review:

- HUD: duplicate indicator exit requests restart the acceleration curve; duplicate HUD exit and stale callbacks also need explicit current-object ownership. Regression tests must exercise the actual functions.
- Homepage: geometry/motion debug probes run even when console output is suppressed. Disable these costly probes in ordinary play and separately retire their timers/listeners on cancellation.
- Journey: target selection reads geometry again in every sorting comparison. Snapshot each eligible target once while preserving visibility, active-area exclusion, order and cap.

These are source-level findings, not proof that any one accounts for every measured hitch. Opt-in bounded transition diagnostics will distinguish synchronous setup/prepaint phases and visible animation stalls on the next physical repeat. They perform no DOM reads and no per-frame logging; normal play schedules no diagnostic work. Initial transition sample includes setup-to-next-RAF time; phase timings measure synchronous work only. Implemented scopes: `journey-viewport-enter`, `journey-world-unit-enter` (including Hub → World), `journey-hub-prepaint`, `journey-world-prepaint`, `homepage-enter`; HUD uses `[CC_HUD_EXIT]` sampled through its existing tween updates. Ordinary play enables none of these measurements. Expensive Homepage probes require a separate `__ccHomeEnterDiagnostics` flag.

Validation so far: Homepage 12 focused tests; HUD 15 focused tests, Gameplay KING 306 tests, typecheck/lint; Journey 74 focused tests with a subsequent 51-test rerun after correcting diagnostic scope names. Shared profiler 3 tests. Independent review passed helper and HUD/Journey ownership/selection. Final deterministic validation: **PASS** `qa:fast` (8 gates /119 suites /997 tests) and `qa:full` (13 gates /326 suites /2157 tests), including Gameplay KING24 suites /306 tests, TypeScript, lint,1043-module source-only production build, bundle audit and native source guard. Logs `/tmp/transition-polish-fast.log` and `/tmp/transition-polish-full.log`. Added16 regressions over preceding2141-test source baseline.

HTTP retrieval verifies current Homepage gating, HUD owner guards and Journey measured-target selection on localhost:5174. Local source and `dist` changed; no native sync/build/install. Physical phone remains f153d457, including previously captured Barrel/Journey8 defects until delivery. No visual browser acceptance is claimed.

**NEEDS PHYSICAL TEST:** Journey entrances (Homepage→Hub, Hub→World, gameplay→World), HUD exit and Homepage hero after web acceptance/native delivery, followed by sustained play for thermal/brightness evaluation. Do not label the result perfect or frame-drop-free based on deterministic gates. New diagnostic summaries identify local setup costs and frame gaps, but do not themselves measure GPU power or compositor presentation.

## Installed repeat: 22:23–22:27 CEST

On explicit immediate-install request, delivered0c431337cb613a580a5ad29b9f2552e892a0cd7d80082432b7028c1451334a54. qa:ios, Xcode, final identity and codesign passed;1766 raw assets verified; App installed and exact bundled diagnostic launch confirmed22:22:48.

KRENI22:23:00.479 → GOTOVO22:27:13.922 (253.443s). User at22:25:05.562 reports Journey Homepage hero jerking when inflation/exit starts;22:25:14.517 confirms identical repetition.49 full windows/14574frames,weighted16.763ms,worst166ms,38>34ms. All50 thermal samples nominal. No logged in-range error/reload/crash. Two HUD exits completed291/276ms with18updates and maximum17ms update interval; six Homepage **enter** summaries max17–28ms, but these do not measure the reported **exit**. World entry/prepaint measurements require first-sample caveat below.

Physical hero-exit acceptance remains **FAIL**. No user acceptance of all other transitions inferred from silence. The largest overall stall remains unexplained. Console saved before intentional signal2 shutdown22:27:21 after GOTOVO; evidence `logs/transition-polish-repeat-20260916/`.

### Corrective investigation

Actual-source simulation proves inflate `onfinish` is the only creator of the parent exit: if the90ms inflate's JS finish callback runs at140ms, the image holds its peak for an unplanned50ms. No neutral-scale reset was found in this boundary. This proves scheduling vulnerability, not that the physical capture's exact stall lasted50ms. Source repair pre-schedules exit after90ms on the same animation clock rather than depending on callback dispatch. Existing400ms hero exit,460ms other parts, delays, easing, image-only inflation and hidden cleanup stay intact. Correct `homepage-exit` telemetry is added for the next capture.

The transition profiler also mixed RAF frame-start timestamps with performance.now capture-start timestamps. A RAF callback in the same frame can carry an earlier timestamp, creating a negative first delta and overstated second delta. Source correction uses performance.now consistently, with a regression reproducing this ordering. Previously recorded short transition worstMs values (notably Journey viewport) cannot establish exact stall size. CC_SOAK frame-to-frame and HUD existing-tween measurements use their own clocks and are not altered by this correction.

### Source follow-up implementation and validation

Homepage child inflate and parent exit are now created together with shared WAAPI startTime; parent delay90ms preserves the boundary, logo150ms and CTA120ms preserve their existing relative stagger. Finish events count completion but no longer create the next motion. No late animation is created by cancelled inflate. Homepage exit gets select-targets/schedule-motion frame diagnostics and explicit finalization cleanup.

Independent actual-GSAP probe ruled out the proposed freeze-reset hypothesis: killing the idle hero tween retained the sampled1.0703 scale and transform, so that owner was not changed. CTA review did reproduce a separate cancellation race: delayed exit followed by prime('idle') let the old continuation hide the new button. A local motion generation now invalidates obsolete enter/exit continuations, retaining promise settlement and all motion profiles. Four actual-GSAP regressions failed before this correction; all five now pass.

Pre-CTA fast gate PASS8 gates/121 suites/1010 tests. Final CTA focused validation3 suites/18 tests PASS; profiler4 tests PASS. Final full gate PASS13 gates/328 suites/2166 tests, including KING24 suites/306 tests and source-only production build. Independent CTA review PASS5 actual-GSAP tests. These follow-up changes are source-only until new delivery; the installed0c431337 package is the captured build, not the new correction.


## Kanta and Homepage exit repeat — 22:43–22:45 CEST

Installed entrypoint SHA256 `59e60d4eed19b5f38dfc330a81865a0c695356c37050fe6a5694cf8e0ad2338c`. KRENI22:43:11.271 to explicit GOTOVO22:45:21.775 (130.504s). Evidence: `logs/kanta-transition-repeat-20260916/{console.log,markers.jsonl,analysis.json,events.json}`. Buffered console was preserved before intentionally stopping devicectl via SIGINT after GOTOVO; session73974 is closed.

26 complete five-second windows contain7725 frames: weighted average16.783ms, worst165ms,29 frames>34ms, none>250ms. All27 in-range native thermal samples nominal; no in-range logged warning/error/reload/crash. This short capture cannot establish sustained temperature or compositor-perfect motion.

- Kanta: four source drops reached merge-handler and one additional merge targeted Kanta. Input is demonstrably working in these instances; visual alignment and subjective pickup acceptance remain pending user feedback.
- HUD: three complete exits306/293/289ms, worst update17/23/17ms.
- Homepage exit: first scope648ms with145ms initial frame gap; subsequent scopes657/646/638ms with maxima20/18/18ms. Selection0ms and scheduling0–2ms do not explain the first gap. Prescheduling removed the proven callback handoff vulnerability, but does not close this residual first-exit hitch.
- Homepage enter: three maxima29/18/30ms.
- Hub viewport entry: four maxima45/40/43/39ms, consistently between viewport preparation and animation start. This identifies an interval, not the responsible CPU/GPU work.
- World unit entry: two maxima32/20ms; returning viewport32ms. World prepaint193ms total with63ms frame gap; Hub prepaint73ms total with35ms gap. Prepaint duration is not equivalent to visible animation jank.

Verdict: source QA PASS; strict no-stall smoothness FAIL. Kanta visual acceptance and sustained thermal NEEDS PHYSICAL TEST. No gameplay source edits made during or after this capture. Follow-up targets are first Homepage exit and repeat Hub preparation-to-start gap; collect rendering/CPU attribution before changing authored animation.

User follow-up explicitly confirmed “da” to correct Kanta position/normal dragging and disappearance of the repeated Homepage inflate/exit hitch. Those two reported symptoms are physically accepted on this build. This does not negate the measured first-exit and Hub-entry gaps or establish sustained thermal acceptance.

Correction: user subsequently reports Homepage image still looks wrong on Journey activation, questioning hitch versus authored motion. Homepage physical acceptance is withdrawn; Kanta acceptance remains. Source shows nested image inflation followed by an anticipating parent collapse, so motion shape must be examined separately from frame gaps. This is a hypothesis about the reported appearance, not a proven root cause.


## Focused Homepage and Arcade capture, 22:51–22:52 CEST

KRENI22:51:19.493, Arcade missing STAGE01 report22:52:03.321, GOTOVO22:52:25.961; duration66.468s. Existing59e60d4e. Console read before intentional stop, session27915 closed. No video was available; visual shape cannot be claimed observed. Evidence `logs/homepage-motion-live-20260916/`.12 full windows,3556 frames,mean16.828ms,worst87ms,15>34ms,0>250ms.13thermalnominal; no in-range error candidates. Eight Homepage exits maximum20/24/19/26/85/26/24/38ms.

Source combined motion has child inflation followed by parent negative-y easing, producing additional outward growth and a velocity discontinuity even at perfect frame cadence. Authorized fluid revision keeps90ms inflation and400ms collapse but makes both meet with zero derivative and removes parent anticipation only for hero. Otherparts and lifecycle unchanged. Actualproductioncurves test monotoniclegs/onepeak/zerovelocity; focused and independent13/13PASS. This fixes a demonstrable motion defect but does not prove the85ms/38ms framegaps solved.

Arcade first entry22:51:40 has ownerreset/cancel/cancel then freshpopinround0, no cue. Source investigation identifies failedsavedload fallback dropping the continuation cue. Second entry22:51:59–22:52:01 executes the entire savedround1cue lifecycle; callbacks alone do not prove pixels visible. Separate fallback repair and regression in progress.

Web feedback: user found first fluid preview smooth but insufficiently bouncy. Revised hero to full World-displacement1.18/1.15 over150ms, then400msmonotoniccollapse. Both phases keep zero-velocity peak; otherparts keep their curves and relative stagger after inflation. Newpreview awaitingapproval. Arcade fallbackrepair now rearmrequestedcue aftercancel, keeps entrysurfacegate and current-generation failurecleanup; focused42tests and KING306PASS, independent4PASS.

Final revised-bounce combined qa:full PASS all13gates, including KING24suites306tests and source-only productionbuild. qa:fast PASS8gates/133suites1103tests. Logs copied to capture directory. Localdist refreshed, nativeWeb.bundle/finalapp/phone unchanged; latestphone remains59e60d4e. Requested visualacceptance of revised fullbounce remains pending. PhysicalHomepagefeel and recoveredArcadeStage01 NEEDS PHYSICAL TEST.

Further user correction: accepted150msinflation, requested minimalhold thenfastinwardcollapse. Sourcepreview now explicitlyholds heropeak50ms then350mscollapse with cubic-bezier(0.60,0,0.735,0.045). Totalhero550ms/otherparts unchanged, sharedclock maintained. Compared oldHEAD curve before editing; restoring anticipation/acceleration character, not claiming identicaloldmotion or solvedGPUstalls. Focused13PASS, fast8gatesPASS, full13gates/330suites2175testsPASS. Source/localdist updated; nativeandphone unchanged. Webapproval pending; physicalfeel NEEDS PHYSICAL TEST.

Finalreference correction: user explicitly selects clickingForest/anyHubWorld to enteritsWorldscreen. Homepage nowuses sharedWorldpresetandactualHubdurationhelper through homepage-hero-motion.ts:180ms power2.in to1.18/1.15,336ms back.in1.7 tozero,50%54%pivot, sameReducedMotiontiming. ExactpolynomialCSScurves in one3-keyframeWAAPI replace alltrialinflate/hold layers. Othercontrolsunchanged. Referencevalidated against1001GSAPsamplesperleg in bothreducedmodes. Focused62PASS, independent14PASS, fast8gatesPASS, full13gates/330suites2176testsPASS includingKING24/306 and1044-modulebuild. Source/localdist only; native/phoneunchanged. Vite5174 servesnewhelper. Web/physicalacceptance remains pending; no claimthatpriorCPU/GPUstalls areeliminated.


## Approved World-style Homepage motion: physical repeat 23:08–23:09 CEST

Installed178314d1. KRENI23:08:46.144 to GOTOVO23:09:45.999 (59.855s). BufferedoutputreadbeforeintentionalSIGINT, session4738closed. Evidence `logs/journey-world-acceptance-20260916/`, including analysis and transition-summary.11completewindows/3230frames;mean16.968ms,worst138ms,30>34ms,0>250ms.13native thermalnominal; noin-range error candidates. No userproblem markers or video; subjectiveacceptance asked separately.

|Scope|Samples|Worst frame gap in sequence|
|---|---:|---|
|Homepage exit|3|21 /18 /21ms|
|Journey Hub viewport handoff|3|46 /38 /31ms|
|World Unit visible enter|4|30 /30 /24 /32ms|
|World prepaint|4|54 /34 /34 /56ms|
|Hub prepaint|3|29 /41 /24ms|
|Homepage enter|2|20 /22ms|

Homepage exits and World Unit entries have no gaps>34ms in the scoped samples; this is not a guarantee of every physical display frame. Hub handoff retains two>34ms gaps, during preparation-to-animationstart. Its diagnostic ends atviewportcommit, beforethecompleteHubcascade. World prepaint runs behindoutgoingmotion, so its stalls are not automatically identicaltoWorldentervisualhitches. The138/122msglobalmaxima occur in5swindowsending23:09:14/29; scopeevents alone cannotassignthosemaxima to a particularfunction. Rounded34msmaxwithover34count is rounding, not contradiction.

Verdict: strictwholeflow smoothness FAIL; acceptedHomepagecurveunchanged; exactphysicalfeel NEEDS PHYSICAL TEST feedback. Shortnominalthermalrun doesnotcloseheat orscreenbrightness. Next focusHubhandoff/reveal/rendercostandunattributedglobalstalls; no speculativeanimationcurvechanges. No source/native edits duringthismeasurementtask.

User feedback: “Oba su izgledala glatko.” Subjectivevisualacceptance confirmedforbothtransitions inthisrun. Retainacceptedmotion. Thisdoesnoterase residualHubhandoff/globalframegaps or establishlong-sessionthermalquality.
