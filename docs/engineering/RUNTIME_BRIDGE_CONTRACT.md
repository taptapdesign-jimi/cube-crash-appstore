# Stack to Six Runtime Bridge Contract

Updated: 2026-08-27
Behavioral reference: `17d42949225380ac8a3ee8cef9045af10d2a74ff`

## Purpose

This is the typed migration inventory for browser-global compatibility hooks. These hooks are active adapters unless explicitly classified otherwise. They must not be bulk-deleted during cleanup.

The canonical gameplay behavior remains in `GAMEPLAY_KING_CONTRACT.md`.

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

### Proven no-op candidates — `REMOVE LATER`

- `testCleanBoard`
- `testCleanAndPrize`
- global `window.testCleanAndPrize`

At the reference commit these are empty debug stubs with no repository runtime caller. They may be removed only in an isolated cleanup with declaration cleanup, contract audit and full QA. They are not removed by the lockdown work itself.

## Named window hooks outside `window.CC`

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
