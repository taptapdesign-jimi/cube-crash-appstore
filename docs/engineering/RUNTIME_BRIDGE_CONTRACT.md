# Stack to Six Runtime Bridge Contract

Updated: 2026-08-27
Behavioral reference: `17d42949225380ac8a3ee8cef9045af10d2a74ff`

## Purpose

This is the typed migration inventory for browser-global compatibility hooks. These hooks are active adapters unless explicitly classified otherwise. They must not be bulk-deleted during cleanup.

The canonical gameplay behavior remains in `GAMEPLAY_KING_CONTRACT.md`.

## Opt-in native Forest presentation adapter

`__jimiNativeHomeHubRuntime` extends the existing native Home/Hub transport with
read-only Forest snapshots, generation/revision-validated semantic card requests,
one-use gameplay admission tokens, actual UIKit enter-completion receipts and
authored feedback delegation. It calls the existing Journey regular/interim entry
and terminal-return owners; it does not write a second save/progression model.
`__jimiNativeForestEnabled` is injected for the separate `.native` app in the
isolated QA Simulator with `--jimi-native-forest`, and for the user-authorized
Native Debug iPhone preview (2026-10-06) by exact bundle identity. Ordinary
Simulator and release launches remain OFF pending acceptance. Physical preview
installation is separate from measured performance/user acceptance. No
`window.CC` gameplay decision method is added or removed by this presentation work.

Canonical Forest entry emits `gameplay-presentation-ready` with its exact
`launchToken`, `routeGeneration` and `stateRevision` after preparing the original
WebKit board transition. UIKit synchronously retires its opaque cover, then calls
`ackNativeWorldTransitionPresentation(token)`; only the accepted current receipt
admits the paused authored enter timeline. Gameplay still starts through the
original transition completion. Background, retirement and disposal cancel a
pending ACK; stale or duplicate receipts cannot hide a successor native screen.

Terminal return uses a separate two-phase receipt. While the retained World is
parked, `prepareNativeWorldReturn(terminalToken)` publishes
`prepare-world-return` with the canonical read-only snapshot. UIKit validates
the terminal token, World, generation, revision and current Journey epoch with
`isNativeWorldReturnPreparationCurrent`, reconciles changed artwork while hidden,
decodes the incoming viewport and primes a frozen enter pose. Only then does
`ackNativeWorldReturnPrepared` re-read canonical state and release the existing
result-cover readiness wait. The original result exit and 140ms cover fade still
complete before `enter-world`; the prepared model is reused there. Readiness does
not grant input: the existing actual native enter-completion receipt does.
Background, route replacement and disposal invalidate pending preparation on
both sides. Foreground recreates the lease; stale or duplicate ACKs do not reveal
a screen. The original 1600ms timeout remains recovery for unavailable resources,
not the successful native return path. This protocol applies to the opt-in shared
native World renderer; gameplay, progression and save remain canonical web owners.

## Typed implementation boundary

- `src/types/runtime-game-bridge.ts` is the compile-time capability contract for `window.CC`.
- `app-core.ts` constructs the adapter with `satisfies RuntimeGameBridge` before publishing it.
- Save/load and recovery hooks (`rebuildBoard`, `startLevel`, `loadGameState`, renderer stop and FX cleanup adapters) have named `Window` declarations rather than relying only on the permissive legacy index signature.
- The type contract stores no runtime state and changes no ownership. Runtime methods continue delegating to the canonical owners listed below.
- Protected decision and cleanup callers now use the typed `window.CC` boundary directly. Optional method dispatch is retained so pre-boot/partial compatibility states preserve the historical no-op behavior.
- State/HUD/score, guard, restart, layout and Pixi app/stage callers use the same typed boundary.
- Repository-wide ownership proof confirmed that `CC.makeBoard`, `CC.STATE` and `CC.combo` were never published by the installed bridge. Their dead reads are removed: tutorial tile normalization remains locally owned, shared state remains owned by `window.STATE`, and combo remains owned by `getCombo()` with its existing zero fallback.
- `_endgameFlowRunning` is not legacy state: the end-game presentation flow actively reads and writes it as its duplicate-call guard. It remains a protected compatibility marker pending a separately characterized ownership migration.

## `window.CC` inventory

### Navigation and board control — `ADAPTER`

- `nextLevel`, `retry`, `restart`
- `pauseGame`, `resumeGame`, `resume`
- `layoutBoard`
- `hideGameUI`, `showGameUI`

These delegate to app-core/lifecycle owners. External UI and recovery paths still use part of this surface.

### State, HUD and score — `ADAPTER`

- `state`, `getScore`, `setScore`, `animateScoreTo`
- `addScoreFromHudStar`, `updateHUD`
- `getHudMetrics`, `getUnifiedHudInfo`
- `getCombo`, `setCombo`, `scheduleComboDecay`, `killComboTimer`
- `addStars`, `setStarsCount`

These must delegate to the live state/HUD owners. They may not become a parallel state store.

### End-game and gameplay decisions — `PROTECTED ADAPTER`

- `triggerCleanBoardFlow`
- `checkLevelEnd`
- `beginEndgameGuard`, `endEndgameGuard`, `getEndgameGuardState`
- `isWildMagnetPullInProgress`

These are protected because merge, modal and recovery modules call the central owners through the bridge. A missing central clean owner must fail closed rather than use a direct legacy terminal fallback.

### Tile/special helpers — `ADAPTER`

- `applyWildSkinLocal`
- `devLastMergeTntScene`

The development scene helper is not production gameplay authority. Removing it requires checking development/QA workflows.

### Cleanup and recovery — `PROTECTED ADAPTER`

- `cleanupFxForBoardReset`, `getCleanupStats`
- `resetTransientRunGuards`, `softResetBoardView`
- `destroyOldBoardForTransition`, `cleanupTexturesForBoardTransition`
- `getJourneyPlayAgainIncidentState`

These are lifecycle/recovery capabilities and must retain idempotent behavior.

### Replay and diagnostics — `KEEP/ADAPTER`

- `snapshotState`
- `replayStartRecord`, `replayStartVerify`, `replayStop`, `replayExport`, `replayImport`, `replayStatus`
- `debugResolveGameplayState`

They must remain observational and may not change normal gameplay decisions except when an explicitly invoked replay/verification mode owns the run.

### Removed no-op surface — `REMOVE COMPLETE`

- `testCleanBoard`
- `testCleanAndPrize`
- global `window.testCleanAndPrize`

At `gameplay-king-v1` these were empty debug stubs with no repository runtime caller. The first post-KING cleanup removed the implementations and declarations together after direct call-site proof. Their absence is now enforced by the contract audit and focused regression coverage.

### Removed unpublished fallback fields — `REMOVE COMPLETE`

- `CC.makeBoard`
- `CC.STATE`
- `CC.combo`

The production bridge never published these fields and repository code never assigned them. Their callers already had canonical owners or explicit fallbacks, so removing the unreachable reads does not alter production gameplay behavior. The gameplay audit prevents their accidental reintroduction.

### Terminal presentation marker — `PROTECTED COMPATIBILITY STATE`

- `CC._endgameFlowRunning`

This marker prevents concurrent terminal presentation flows and is released in the flow's `finally` block. It must not be deleted or relocated without dedicated duplicate-call, error-path and tutorial-continuation characterization.

## Named window hooks outside `window.CC`

`src/types/window.d.ts` is the sole canonical `Window` declaration surface. The
unused parallel `src/types/main.ts` module was removed after its live unique
capabilities were retained here; it contained no runtime code or repository
imports.

### Save/load and fresh-board recovery — `PROTECTED ADAPTER`

- `window.rebuildBoard`
- `window.startLevel`
- saved-state/load hooks declared in global types

`main.ts` uses these in recovery paths. They are not dead code.

### Cleanup compatibility — `ADAPTER`

- `window.killAllDelayedCalls`
- `window.destroyAllGraphicsObjects`

They delegate to FX lifecycle owners and must not independently destroy shared textures.

### Ghost/input/tutorial/navigation hooks — `ADAPTER`

Existing named hooks for ghost visibility, tutorial state, navigation, modal handoff and input diagnostics remain active where call-site search or runtime use exists. Each must delegate to one owner and be removed individually only after migration proof.

## Migration rules

1. Add no new global bridge when a typed import/injected capability can express the dependency.
2. Define a typed capability before migrating a bridge caller.
3. Move callers one bounded ownership group at a time.
4. Keep the bridge as a thin delegator during migration.
5. Remove the bridge only after source, tests, runtime event names and development-console use are checked.
6. Run `qa:gameplay-lock` and `qa:full` after every protected bridge migration.
7. Touch no assets as part of bridge cleanup.
