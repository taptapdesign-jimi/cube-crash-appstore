# Arcade Stage 2 input freeze — 2026-09-17

Physical reproduction verdict: **FAIL**. Diagnosis only; no runtime patch, build, sync or install.

## Capture

Exact Stack to Six bundle launched on iPhone 13 blue 15:55:42 CEST; bundled page loaded 15:55:43. KRENI 15:55:52.168550; GOTOVO 15:58:57.560817. User markers recorded on handling messages (not exact symptom onset):

- 15:57:38.843843: “porblem .- hud exit gornji je opat nekako sa manjim fps mozda30 jako je drugaciji od 60fps”
- 15:58:45.346669: “problem, smrznuti je stage 2 nemogu dragati nista”

Buffer read before intentional SIGINT to devicectl PID 57522; session 36033 finished (exit 1 from intentional stop). Capture no longer active.

## Stage 2

Round 2 card completes 15:58:27.685697. New board pop-in starts 15:58:27.712935, entry generation 5. The logged round=0 is the optional continuation-cue variable, not evidence of an incorrect actual board number. Both texture probes are healthy. RAF telemetry continues around 16.67 ms during reported input freeze; it is not a direct measurement of rendered Pixi frames. Thermal transitions nominal→fair at 15:58:27.552168; trace does not establish thermal causality.

Source defect with isolated execution reproduction:

1. endgame-flow.ts captures previous event mode and sets stage.eventMode='none' (995–996).
2. Its Arcade branch awaits startLevel(nextStage) (1128).
3. startLevel calls resetTransientRunGuards; this increments gameplayRunGeneration (1165), invalidating ownsCleanBoardRun passed as ctx.isRunCurrent (1557–1561, 1732).
4. Terminal finally therefore skips stage.eventMode restoration (1461–1466).
5. Same-stage startLevel path does not restore eventMode. The two static assignments belong to boot/installDrag, not same-stage continuation.
6. Actual extracted finalizer execution leaves eventMode='none' while clearing _endgameFlowRunning. Local Pixi EventBoundary prunes containers with eventMode='none', blocking child dice events.

This is a deterministic source defect matching the physical symptom. Live phone stage.eventMode was not directly sampled, so exact runtime state remains inferred. Evidence: logs/arcade-stage2-freeze-20260917/finalizer-reproduction.json. Fix should give the current prepared-board owner responsibility for restoring its input without allowing stale finalizers to unlock unrelated newer boards. No fix applied in this observational session.

## HUD exit

Only one HUD exit trace: 15:57:06.841265, 292 ms, 17 GSAP updates, max update gap 34 ms, completed owner. Nearby global RAF gap 35 ms at JS 83368–83403. This does not measure actual Pixi paint cadence and cannot confirm or rule out perceived 30 FPS. playHudRise has no activity lease; mobile frame controller can settle to 30 FPS after its interaction tail. This is a candidate requiring direct Pixi cadence/ticker evidence, not a proven cause. User marker arrived later than the recorded exit.

## Next step

Implement scoped input ownership repair with behavioral coverage, then show on localhost:5174; explicit web acceptance precedes native delivery under LIVE_DEBUG_WORKFLOW. HUD needs targeted actual-render cadence diagnostics. No full QA gates run because this was read-only runtime diagnosis; isolated finalizer reproduction was run. Existing dirty work preserved. No assets or saves manually changed; launched app may perform ordinary gameplay persistence.

## Authorized repair

User subsequently requested “ajde popravi sve sto sada mozes”. Changes:

- `app-core.ts`: capture the stage at fresh-board preparation. When pop-in settles, only the latest, non-aborted entry whose captured stage is still current and not destroyed restores `eventMode=static`. Stale terminal finalizers remain guarded; authored gameplay, scores, assets, animations and save rules are retained.
- `hud-helpers.ts`: hold the existing mobile activity lease for the complete HUD rise, release idempotently on completion/interruption/setup error even with diagnostics disabled. This closes the path where automatic HUD exit may run after the controller has settled to 30 FPS; it does not prove the original symptom had only that cause.
- `arcade-stage-input-handoff.test.ts`: actual production entry callback plus real coordinator and actual terminal finalizer verify restored same-scene Stage 2 input and preserved locks on generation change, scene replacement, abort or destruction.
- `hud-exit-owner-runtime.test.ts`: real mobile cadence controller verifies 30→60→30 around completion, interruption and setup failure, including diagnostics disabled and duplicate exits.
- `arcade-recovery-entry-cue.test.ts`: provide the scene in the existing extracted-production-code fixture.

Targeted initial four suites / 26 tests passed. The broader first pass found two missing-scene fixture errors in the recovery suite; fixture corrected and all four recovery tests passed. Gameplay KING 24 suites / 306 tests passed. Final qa:fast PASS 8/8 gates, 148 suites / 1249 tests. Final qa:full PASS 13/13 gates, 344 suites / 2273 tests, including Gameplay KING 24 suites / 306 tests, TypeScript/unused/lint, production web build, bundle audit and native source guard. Logs: qa-fast-final.log and qa-full-final.log. Source/build verdict PASS; natural web acceptance and physical verification pending. Local dist refreshed; authoritative Web.bundle, signed app and installed phone unchanged.

Vite HTTP source verification passed at localhost:5174 for both runtime fixes; details in `web-source-verification.json`. No phone build/sync/install performed. Await natural web reproduction and explicit acceptance before native delivery. Physical drag and HUD feel remain NEEDS PHYSICAL TEST after source checks.
