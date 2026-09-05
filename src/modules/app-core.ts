// public/src/modules/app.js
// ✅ mobile-first, cache-busted celebration & prize flow
// TODO: Remove @ts-nocheck after incremental typing cleanup

import { Application, Container, Assets, Graphics, Rectangle, Texture, Sprite } from 'pixi.js';
import { gsap } from 'gsap';

import {
  COLS, ROWS, TILE, GAP, HUD_H,
  ASSET_TILE, ASSET_DRAG_SHADOW, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4, ASSET_WILD, ASSET_WILD_MAGNET, ASSET_WILD_JUICE, ASSET_WILD_TNT
} from './constants.js';
import { sweetPopIn, sweetPopOut } from './app-board.ts';
import { STATE } from './app-state.ts';

import * as makeBoard from './board.ts';
import { installDrag } from './install-drag.ts';
import { glassCrackAtTile, woodShardsAtTile, spawnMerge6Shards, regularMerge6ShardsTemplated, wildMerge6ShardsTemplated, wildStarMerge6ShardsTemplated, wildJuiceMerge6ShardsTemplated, wildTntMerge6ShardsTemplated, wildMagnetMerge6ShardsTemplated, showMultiplierTile, smokeBubblesAtTile, prewarmWildSmokeGraphicsPool, screenShake, wildImpactEffect, stopWildIdle, startWildShimmer, stopWildShimmer, startWildStars, stopWildStars, startWildJuiceBubbles, stopWildJuiceBubbles, startMagnetIdleParticles, stopMagnetIdleParticles, startTntIdleParticles, stopTntIdleParticles, startTntIdleShake, stopTntIdleShake, cleanupAllTntIdleEffects, centerInBoard, killAllDelayedCalls, destroyAllGraphicsObjects, cleanupAllFxContainers, cleanupFxContainersByTag, cleanupExistingStarAnimations, forceCleanupAllStarAnimations, animateStarsToHudIcon } from './fx.ts';
import { showWildJuiceBubblesExplosion, stopWildJuiceBubblesExplosion, forceStopWildJuiceBubblesExplosion, isWildJuiceBubblesExplosionActive, isWildJuiceBubblesExplosionRecentlyStarted, isWildJuiceFinaleAnimationActive, waitForBubblesExplosionToComplete, destroyWildJuiceBubblesExplosionCache } from './wild-juice-bubbles-explosion.ts';
import { showMagneticText, isMagneticTextActive, waitForMagneticTextComplete, stopMagneticText, showSparkleText, stopSparkleText, isSparkleTextActive, waitForSparkleTextComplete, showNoMovesText, exitNoMovesText, clearNoMovesText } from './splash-text-overlay.ts';
import { showTntAnimation, stopTntAnimation, onTntBoomExitComplete, onTntAnimationComplete, preloadTntFrames, isTntAnimationActive, releaseTntGameplayInputGate } from './tnt-animation.ts';
import {
  cancelActiveLaserGunFinaleImpact,
  completeActiveLaserGunFinaleImpacts,
  prepareActiveLaserGunFinaleImpact,
  setActiveLaserGunFinaleTargets,
  triggerActiveLaserGunFinaleImpact,
  waitForActiveLaserGunFinaleBeamLaunch,
  waitForActiveLaserGunFinaleImpactArrival,
  LASERGUN_CUBE_REACTION_PRECEDES_BEAM_SECONDS,
} from './lasergun-finale-scene.ts';
import type { LaserGunEntryReadiness } from './lasergun-finale-scene.ts';
import {
  LASERGUN_ARRIVAL_TIMEOUT_MS,
  LASERGUN_FIRST_SHOT_LEAD_MS,
  LASERGUN_SHOT_INTERVAL_MS,
  runLaserGunSequentialImpactScheduler,
} from './laser-gun-impact-scheduler.ts';
import {
  getLaserGunCubeAnticipationFrames,
  LASERGUN_CUBE_ANTICIPATION_SCALE,
      LASERGUN_CUBE_CONTRACT_SCALE,
      LASERGUN_CUBE_CONTRACT_SECONDS,
      LASERGUN_CUBE_INFLATE_SECONDS,
      LASERGUN_CUBE_REBOUND_SCALE,
      LASERGUN_CUBE_REBOUND_SECONDS,
      LASERGUN_CUBE_SETTLE_SECONDS,
} from './laser-gun-cube-anticipation.ts';
import { stopWildJuiceBubblesScreen, destroyWildJuiceBubblesScreenCache } from './wild-juice-bubbles-screen.ts';
import * as StarsCollector from './stars-collector.ts';
import { runEndgameFlow } from './endgame-flow.js';
import * as SPAWN from './spawn-helpers.ts';
import * as HUD   from './hud-helpers.ts';
import { wild } from './hud-helpers.ts';
import animationManager from './animation-manager.ts';
import * as FLOW  from './level-flow.js';
import { clearWildState } from './app-merge.ts';
import { resetTileToNormalState, boardHasPersistentLockedTiles, isTileTransientlySpawning, getTransientSpawnState } from './tile-state-utils.ts';
import { statsService } from '../services/stats-service.js';
import { arcadeStatsService } from '../services/arcade-stats-service.js';
import { TILE_IDLE_BOUNCE } from './tile-idle-bounce.ts';
import { stopSpecialDiceIdleMotion } from './special-dice-idle.ts';
import { isArcadeHomeRunMode, markArcadeHomeRunOrigin, setRunMode, RUN_MODE_JOURNEY } from './run-mode.js';
import { isJourneyOriginActive } from './journey-origin-state.js';
import { waitForFinalMergeHandoff } from './final-merge-handoff.ts';
import {
  cleanupFinalMergeDiceCelebration,
  playFinalMergeDiceCelebration,
} from './final-merge-dice-celebration.ts';
import { FinalResidualHandoffOwner } from './final-residual-handoff-owner.ts';
import { shouldBlockMergeDuringRegularHandoff } from './regular-merge-handoff-guard.ts';
import { FINAL_MERGE_REASONS, getFinalMergeCleanBoardReason } from './final-merge-reasons.ts';
import {
  findRecentFinalMergeRuntime,
  isFinalMergeRuntimeTileProtected,
  markFinalMergeRuntime,
} from './final-merge-runtime-guard.ts';
import { checkEndGame, clearEndGameCache, tileIsActive, getActiveTiles, type EndGameContext } from './endgame-checker.ts';
import { updateEndgameHint, resetEndgameHint } from './endgame-hint.ts';
import { shouldShowStackItHintForTiles } from './endgame-hint-eligibility.ts';
import memoryManager from './memory-manager.ts';
import { boardSpecificRules, isWildSpawnEnabled, isWildMeterEnabled, filterWildType, getWildMeterFillRate } from './board-specific-rules.ts';
import { logger } from '../core/logger.js';
import { devLog, devWarn, devError } from './app-core-logger.ts';
import { getRendererPerformanceProfile } from './renderer-performance-profile.ts';
import { MOBILE_RUNTIME_PROFILE } from './mobile-runtime-profile.ts';
import { ForegroundResumeEpoch } from './foreground-resume-epoch.ts';
import { createHudHelpers } from './app-core-hud-helpers.ts';
import type { Tile, Board, Grid, HUD as HUDType, Stage as StageType, Drag } from '../types/game-types.js';
import type { RuntimeGameBridge } from '../types/runtime-game-bridge.ts';
import { getArcadeSaveKey, getBoardSaveKey } from '../utils/board-save-utils.js';
import { 
  setPendingCleanBoard, 
  clearPendingCleanBoard, 
  getPendingCleanBoard,
  checkAndRecoverBoard 
} from './board-recovery.js';
import { 
  boardSize, 
  cellXY, 
  randVal, 
  regularValuePool,
  randomRegularTileValue,
  isFirstPlayTutorialRunActive,
  trackAppTimeout,
  waitTracked,
  waitTrackedResult,
  clearAllAppTimeouts,
  trackAppAnimationFrame,
  clearAllAppAnimationFrames,
  clearAllAppIntervals,
  trackAppListener,
  clearAllAppListeners,
  getAppCleanupStats
} from './app-core-utils.js';
import { createReplayRecorder } from './app-core-replay.ts';
import { getJourneyBottomDecorAssetForBoard, warmBoardGameAssets } from '../utils/board-asset-warmup.ts';
import {
  isUsablePixiImageTexture,
  pinPixiImageTexture,
  probePixiImageTextureGpuPixels,
  reloadPixiImageTexture,
} from '../utils/pixi-image-texture-health.ts';
import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.ts';
import { applyAppPaperBackground } from '../utils/app-paper-background.js';
import { getReactiveActiveTiles, getScreenVisibility } from './app-core-state-helpers.ts';
import { createEmptyGrid as createEmptyGridHelper } from './app-core-grid-helpers.ts';
import { syncSharedState as syncSharedStateHelper } from './app-core-state-sync.ts';
import { resetBoardContainerHelper } from './app-core-board-reset.ts';
import { cleanupTilesForRebuild } from './app-core-tile-cleanup.ts';
import { createLockedHolders } from './app-core-board-build.ts';
import { openRandomTiles } from './app-core-open-tiles.ts';
import { ensureBackgroundLayerVisible } from './app-core-background-layer.ts';
import { schedulePopInSafetyNet } from './app-core-popin-safety.ts';
import { handleHudDropOnHalf } from './app-core-hud-drop.ts';
import { handleSweetPopInComplete } from './app-core-popin-final.ts';
import { ensureAnimationRunning } from './app-core-animation-ensure.ts';
import { createSweetPopInRunner } from './app-core-popin-runner.ts';
import { isBoardFxReduced, startBoardFrameBudgetMonitor, stopBoardFrameBudgetMonitor } from './board-frame-budget.ts';
import {
  acquirePixiMobileActivityLease,
  markPixiMobileActivity,
  startPixiMobileFrameController,
  stopPixiMobileFrameController,
} from './pixi-mobile-frame-controller.js';
import { getRegularMerge6FxProfile, getRegularStackSmokeProfile } from './gameplay-fx-profile.ts';
import { markMergePerformance } from '../utils/merge-performance.ts';
import { emitIOSArcadeGameplayTrace } from '../utils/ios-arcade-gameplay-trace.ts';
import { emitIOSSpecialTransactionTrace } from '../utils/ios-special-transaction-trace.ts';
import {
  claimTntBonusTiles,
  isTntBonusTileOwned,
  releaseTntBonusTile,
  releaseTntBonusTiles,
} from './tnt-bonus-tile-ownership.ts';
import {
  planLaserGunCrossfireTargets,
  selectSpatiallySeparatedTntTargets,
  type LaserGunShooter,
} from './tnt-bonus-target-selection.ts';
import { ensureBoardLifecycleTrace, markBoardLifecycle } from '../utils/board-lifecycle-performance.ts';
import { stopTileIdleBounce } from './app-core-tile-bounce.ts';
import { initializeBoardGrid } from './app-core-board-setup.ts';
import { finalizeBoardVisibility } from './app-core-board-visibility.ts';
import { resetTilesForRebuild } from './app-core-tiles-reset.ts';
import { createAndOpenBoard } from './app-core-board-open.ts';
import { prepareBoardForRebuild } from './app-core-board-prepare.ts';
import { ensureExitVisibility } from './app-core-exit-visibility.ts';
import { cleanupBeforeBoardExit } from './app-core-exit-cleanup.ts';
import { selectTilesForExit } from './app-core-exit-tiles.ts';
import { runExitAnimation } from './app-core-exit-anim.ts';
import { ensureStartLevelVisibility } from './app-core-startlevel-visibility.ts';
import { stopMagnetParticlesOnExit } from './app-core-exit-magnet.ts';
import { startHudExitAnimation } from './app-core-exit-hud.ts';
import { runStartLevelFxPrep } from './app-core-startlevel-fx.ts';
import { applyStartLevelState } from './app-core-startlevel-state.ts';
import { updateJourneyRunState } from './app-core-startlevel-journey.ts';
import { updateStartLevelStats } from './app-core-startlevel-stats.ts';
import { incrementBoardTimesPlayed } from './app-core-startlevel-boardstats.ts';
import { syncJourneyBoards } from './app-core-startlevel-journey-boards.ts';
import { clearComboIdleTimer } from './app-core-startlevel-combo.ts';
import { resetWildAndEndgameState } from './app-core-startlevel-wild.ts';
import { ensureStartLevelLayout } from './app-core-startlevel-layout.ts';
import {
  beginGameplayEntryPreparation,
  cancelGameplayEntryPreparation,
  commitPreparedGameplayEntry,
  hasPreparedGameplayEntry,
  isGameplayEntryGenerationLatest,
  isGameplayEntryPending,
  prepareGameplayEntryCommit,
} from './gameplay-entry-coordinator.ts';
import { boardTransitionPresentationHandoff } from './board-transition-presentation-handoff.ts';
import { applyWildSkinLocalCore } from './app-core-wild-skin.ts';
import { applyGameplayTextureFiltering } from './gameplay-texture-filtering.ts';
import { syncHudRootVisibility } from './app-core-startlevel-hudroot.ts';
import { handleStartLevelHudDrop } from './app-core-startlevel-huddrop.ts';
import { shouldShowJourneyBottomDecor } from './journey-bottom-decor-decision.ts';
import { JOURNEY_BOTTOM_DECOR_MOTION } from './journey-bottom-decor-motion.ts';
import { createGameplayTileCartoonVariant } from './gameplay-tile-cartoon-motion.ts';
import { resolveFinalMergeSpawnGuard, resolvePreSpawnFinalMergeCompletion } from './final-merge-spawn-guard.ts';
import { resolveMagnetPullProgressDecision } from './magnet-pull-progress-decision.ts';
import { resolveMerge6SpawnMode } from './merge6-spawn-mode-decision.ts';
import { resolveWildMergeSpawnBonus } from './wild-merge-spawn-bonus-decision.ts';
import { getLockedSpawnCandidates } from './locked-spawn-candidates.ts';
import { resolveRegularMerge6SpawnCount } from './regular-merge6-spawn-count.ts';
import { resolveMerge6MovesDepletedStuckAction } from './merge6-terminal-handoff-decision.ts';
import { Merge6DestinationCleanupOwner } from './merge6-destination-cleanup-owner.ts';
import { shouldDeferEndgameForActiveDrag } from './active-drag-endgame-policy.ts';
import { resolvePostSpawnEndgameDelayMs } from './post-spawn-endgame-delay.ts';
import { resolveWildEndgameSpawnMult } from './wild-endgame-spawn-mult-decision.ts';
import {
  cleanupFinalGhostResidualTargets,
  collectFinalBoardTileResidualTargets,
  collectFinalGhostResidualTargets,
  collectFinalLockedResidualTargets,
  collectOrphanFinalBoardTileResidualTargets,
  isFinalBoardTileResidueCandidate,
  prepareFinalResidualTargets,
} from './final-residual-visual-targets.ts';
import { bindTileWithFallbackCore } from './app-core-bind.ts';
import { saveAfterBoardStart } from './app-core-startlevel-save.ts';
import { runStartLevelPost } from './app-core-startlevel-post.ts';
import { maybeRebuildBoard } from './app-core-startlevel-rebuild.ts';
import { adaptSpawnBounce, OpenCellCancelledError, openAtCellCore } from './app-core-open-cell.ts';
import { getRandomEmptyCell } from './app-core-random-empty.ts';
import { hasLastMergeTile } from './app-core-wild-preload.ts';
import { resolveWildSpawnPermission, WILD_SPAWN_BOARD_SETTLE_MS } from './wild-spawn-permission.ts';
import { resolveWildMeterProgressDecision } from './wild-meter-progress-decision.ts';
import {
  isWildContinuationPending,
  isWildMeterReady,
  resolveStuckWildDeferralDecision,
  resolveWildSpawnGuardReleaseContinuation,
  shouldScheduleWildSpawnRetry,
} from './wild-spawn-continuation.ts';
import { consumeWildCharge } from './app-core-wild-meter.ts';
import { decideWildType } from './app-core-wild-type.ts';
import { detachTileFromGrid, isLockedEmptyPlaceholder, normalizePlayableTileAfterMutation, normalizeSpawnedTileVisual, removeTileFully } from './tile-lifecycle-service.ts';
import {
  applySpecialDiceVariantToTile,
  isSpecialDiceResolutionOwned,
  markSpecialDiceResolutionOwned,
  releaseSpecialDiceResolution,
  getCoreWildTypeForSpecialDiceVariant,
  getSpecialDiceExplosionSpriteSources,
  getSpecialDiceFinaleAccentSpriteSources,
  getSpecialDiceFinaleFlagsForMerge,
  getSpecialDiceFinaleFxForMerge,
  getSpecialDiceGameplayFxForMerge,
  getSpecialDiceGameplayReleaseAtSpawnRatio,
  getSpecialDiceInputReleaseAtRatio,
  getSpecialDiceShardColor,
  getSpecialDiceShardColors,
  getSpecialDiceSplashLetterColors,
  getSpecialDiceJuiceDropProfile,
  getSpecialDiceSplashOptions,
  getSpecialDiceTexturePath,
  getSpecialDiceVisualConfig,
  getSpecialDiceVariant,
  getSpecialDiceVariantForTile,
  isSpecialDiceDirectWildLikeTile,
  isSpecialDiceJuiceLikeTile,
  isSpecialDiceMagnetLikeTile,
  isSpecialDiceStarLikeTile,
  isSpecialDiceTntLikeTile,
  pickBeachWildSlot,
  pickSpecialDiceVariantForWildSpawn,
} from './special-dice-registry.ts';
import { animateWildSpawnDropFromMeter, cleanupWildSpawnDropAnimations, preloadWildSpawnDropAssets } from './wild-spawn-drop.ts';
import { startSpecialDiceIdleMotion } from './special-dice-idle.ts';
import { clearInputGateLocks, setInputGateLock } from './input-gate.ts';
import {
  canRunOrdinaryStackDuringVisualTail,
  getSpecialDiceEndgameBlock,
  isStableOrdinarySubSixStack,
  SpecialDiceTransactionOwner,
  type SpecialDiceTransactionKind,
} from './special-dice-transaction-owner.ts';
import { resolveNoMovesCommitDecision } from './no-moves-commit-decision.ts';
import { triggerMergeHaptics } from './app-core-merge-haptics.ts';
import { handleMergeCombo } from './app-core-merge-combo.ts';
import { handleLastMergeEarly } from './app-core-merge-lastmerge.ts';
import {
  getFinalMergeTileSets,
  getPlayableMagnetPullCandidates,
  isWildLikeSpecial,
  isWildLikeTile,
  shouldPlayJourneyClearedCelebration,
  type FinalMergeSnapshot,
} from './final-merge-rules.ts';
import { createGameplaySnapshot, type GameplayRuntimeFlags } from './gameplay-snapshot.ts';
import {
  getLegacyComparableDecisionType,
  getResolverComparableDecisionType,
  normalizeLevelEndDecision,
  resolveGameplayState,
  resolveLevelEndDecision,
  resolveMergeFinality,
  summarizeGameplayDecision,
  type GameplayResolutionDecision,
} from './gameplay-resolution-engine.ts';
import { applyMergeScore } from './app-core-merge-score.ts';
import { canSaveGameState } from './app-core-save-guards.ts';
import { buildGridSnapshot } from './app-core-save-tiles.ts';
import { getStarsCountForSave } from './app-core-save-stars.ts';
import { buildSaveState } from './app-core-save-state.ts';
import { stampCurrentGameSaveSchema } from './app-core-save-schema.ts';
import { restoreBasicState } from './app-core-load-basics.ts';
import { applyRulesAfterLoad } from './app-core-load-rules.ts';
import { ensureDragReadyAndRebind } from './app-core-load-drag.ts';
import { layoutAndRestoreStars } from './app-core-load-layout.ts';
import { ensureHudAfterLoad } from './app-core-load-hud.ts';
import { schedulePostLoadRecoveryCheck } from './app-core-load-recovery.ts';
import { markUserMoveAfterLoad, resumeRuntimeAfterLoad } from './app-core-load-finalize.ts';
import { handleEmptyLoadState } from './app-core-load-empty.ts';
import { triggerHudDropIfPending, ensureHudFinalPosition } from './app-core-load-animation.ts';
import { loadSavedBoardState } from './app-core-load-save.ts';
import { ensureAppReadyForLoad } from './app-core-load-boot.ts';
import { restoreTilesFromSave, resumeDeferredTntIdleEffects } from './app-core-load-tiles.ts';
import { playLoadPopInAnimation } from './app-core-load-popin.ts';
import { cleanupMobileSaveLifecycle, installMobileSaveLifecycle } from './app-core-mobile-save-lifecycle.ts';
import {
  beginArcadeEntryCue,
  cancelArcadeEntryCueOwner,
  consumeArcadeEntryCue,
  shouldOverlapArcadeEntryCueWithColdBoot,
} from './arcade-entry-cue-owner.js';
import {
  engageArcadeEntrySurfaceGate,
  cancelArcadeEntrySurfaceGate,
  enforceArcadeEntrySurfaceGate,
  isArcadeEntrySurfaceGateActive,
  releaseArcadeEntrySurfaceGateAfterPreparedFrame,
} from './arcade-entry-surface-gate.js';
import { killInvalidPixiGsapTweens, killPixiGsapSubtree } from './pixi-gsap-cleanup.ts';
import {
  fixHoverAnchor,
  ensureFonts,
  killComboTimer as killComboTimerHelper,
  scheduleComboDecay as scheduleComboDecayHelper,
  hudSetCombo as hudSetComboHelper,
  hudResetCombo as hudResetComboHelper
} from './app-core-helpers.js';

let hudStarHudFeedbackFramePending = false;

const trackTween = (target: gsap.TweenTarget, vars: gsap.TweenVars) =>
  animationManager.trackExternalTween(gsap.to(target, vars));

const trackTimeline = (vars: gsap.TimelineVars = {}) =>
  animationManager.trackExternalTimeline(gsap.timeline(vars));

const trackDelayedCall = (...args: Parameters<typeof gsap.delayedCall>) =>
  animationManager.trackExternalTween(gsap.delayedCall(...args));

type ComboTimer = ReturnType<typeof setTimeout> | { kill?: () => void } | null;
type DelayedCall = ReturnType<typeof trackDelayedCall> | null;

// TNT bonus cleanup tracking (delayed calls + wobble tweens)
let tntBoomDelayedCalls: Array<gsap.core.Tween> = [];
let tntBlastWobbleTweens: Array<gsap.core.Tween> = [];
let magnetBlastDelayedCalls: Array<gsap.core.Tween> = [];
let magnetBlastReturnTweens: Array<gsap.core.Tween> = [];
let lastTntBonusChangeAt = 0;
let tntBonusGuardUntil = 0; // Prevent premature fail while TNT bonus changes board

function isTileBoardBlastDisplacing(tile: any): boolean {
  return tile?._ccBoardBlastDisplacing === true;
}

function markTileBoardBlastDisplacing(tile: any, homeX: number, homeY: number): void {
  if (!tile || tile.destroyed) return;
  tile._ccBoardBlastDisplacing = true;
  tile._ccBoardBlastHomeX = homeX;
  tile._ccBoardBlastHomeY = homeY;
}

function clearTileBoardBlastDisplacement(tile: any, homeX?: number, homeY?: number): void {
  if (!tile || tile.destroyed) return;
  const x = typeof homeX === 'number' && Number.isFinite(homeX) ? homeX : tile._ccBoardBlastHomeX;
  const y = typeof homeY === 'number' && Number.isFinite(homeY) ? homeY : tile._ccBoardBlastHomeY;
  if (Number.isFinite(x) && Number.isFinite(y)) {
    try { gsap.set(tile, { x, y }); } catch {
      try {
        tile.x = x;
        tile.y = y;
      } catch {}
    }
  }
  try { tile.refreshShadow?.(); } catch {}
  delete tile._ccBoardBlastDisplacing;
  delete tile._ccBoardBlastHomeX;
  delete tile._ccBoardBlastHomeY;
}

function cleanupTntBoomArtifacts(reason: string = 'unknown'): void {
  try {
    tntBoomDelayedCalls.forEach((dc) => {
      try { dc?.kill?.(); } catch {}
    });
    tntBoomDelayedCalls = [];
  } catch {}
  try {
    tntBlastWobbleTweens.forEach((tw) => {
      try { tw?.kill?.(); } catch {}
    });
    tntBlastWobbleTweens = [];
  } catch {}
  try {
    magnetBlastDelayedCalls.forEach((dc) => {
      try { dc?.kill?.(); } catch {}
    });
    magnetBlastDelayedCalls = [];
  } catch {}
  try {
    magnetBlastReturnTweens.forEach((tw) => {
      try { tw?.kill?.(); } catch {}
    });
    magnetBlastReturnTweens = [];
  } catch {}
  try { devLog('🧹 cleanupTntBoomArtifacts:', reason); } catch {}
}


// HUD functions from hud-helpers.js


// --- Endless mode config ---
const MOVES_MAX = 50;
const COMBO_CAP = 99;   // praktični safety cap

// Combo idle decay: reset na x0 poslije 2s
const COMBO_IDLE_RESET_MS = 2000;
let comboIdleTimer: ComboTimer = null;
let checkLevelEndTimer: DelayedCall = null;
let gameplayRunGeneration = 0;
const finalResidualHandoffOwner = new FinalResidualHandoffOwner();
let gameplayBoardMutationRevision = 0;
let checkLevelEndRetryCount = 0; // 🔥 v38: Track reschedule attempts
const MAX_CHECK_LEVEL_END_RETRIES = 10; // 🔥 v38: Prevent infinite reschedule loops
const ENDGAME_FAIL_MUTATION_COOLDOWN_MS = 700; // Production-safe: require board to settle before fail path
const ENDGAME_GUARD_MAX_TTL_MS = 5000; // Hard cap to avoid stuck guard in case of missed cleanup
let lastEndgameBoardSignature = '';
let lastEndgameBoardMutationAt = 0;
let pendingMandatoryMergeCellSpawn: { c: number; r: number; expiresAt: number } | null = null;
let endgameGuardCount = 0;
let endgameGuardUntil = 0;
const endgameGuardSources = new Map<string, number>();
let __ccRuntimeTextureHooksInstalled = false;
let __ccNavigationCleanupInstalled = false;
let __ccGsapTickerTrackingInstalled = false;
let __ccTrackedGsapTickers: Set<Function> | null = null;
let __ccNavCleanupTimer: number | null = null;

function cancelCheckLevelEndTimer(): void {
  try { checkLevelEndTimer?.kill?.(); } catch {}
  checkLevelEndTimer = null;
}

function scheduleCheckLevelEnd(delaySeconds: number, reason: string, opts: { killExisting?: boolean } = {}): void {
  const scheduledGeneration = gameplayRunGeneration;
  try {
    if (opts.killExisting !== false) {
      cancelCheckLevelEndTimer();
    }
  } catch {}
  checkLevelEndTimer = trackDelayedCall(delaySeconds, () => {
    checkLevelEndTimer = null;
    if (scheduledGeneration !== gameplayRunGeneration) return;
    try {
      checkLevelEnd();
    } catch (err) {
      devWarn('⚠️ scheduled checkLevelEnd failed', { reason, err });
    }
  });
}

function installGsapTickerTracking(): void {
  if (__ccGsapTickerTrackingInstalled) return;
  __ccGsapTickerTrackingInstalled = true;
  try {
    const ticker = (gsap as any)?.ticker;
    if (!ticker || typeof ticker.add !== 'function' || typeof ticker.remove !== 'function') {
      return;
    }
    if ((ticker as any).__ccWrapped) {
      __ccTrackedGsapTickers = (ticker as any).__ccTracked || __ccTrackedGsapTickers;
      return;
    }
    const origAdd = ticker.add.bind(ticker);
    const origRemove = ticker.remove.bind(ticker);
    __ccTrackedGsapTickers = new Set();
    (ticker as any).__ccTracked = __ccTrackedGsapTickers;
    (ticker as any).__ccWrapped = true;
    (ticker as any).__ccOrigAdd = origAdd;
    (ticker as any).__ccOrigRemove = origRemove;

    ticker.add = (fn: any, prioritize?: boolean, once?: boolean) => {
      try { if (fn) __ccTrackedGsapTickers?.add(fn); } catch {}
      return origAdd(fn, prioritize, once);
    };
    ticker.remove = (fn: any) => {
      try { if (fn) __ccTrackedGsapTickers?.delete(fn); } catch {}
      return origRemove(fn);
    };
  } catch {}
}

function killTrackedGsapTickers(reason: string = 'unknown'): void {
  try {
    if (!__ccTrackedGsapTickers || __ccTrackedGsapTickers.size === 0) return;
    __ccTrackedGsapTickers.forEach((fn) => {
      try { gsap.ticker.remove(fn as any); } catch {}
    });
    __ccTrackedGsapTickers.clear();
    devLog('🧹 killTrackedGsapTickers:', reason);
  } catch {}
}

// 🔒 SAFETY: Remove only TRULY orphaned magnet merge-6 tiles (stale from crash/abort)
// ⚠️ CRITICAL: Do NOT remove ACTIVE magnet pull merge 6 - these flags mean "in use":
//   _wildMagnetPulledTilesMerge, _wildMagnetMergeCallback = pull already happened
//   _willPullTiles, _hasTilesToPull = pull WILL happen (tiles flying) - MUST KEEP!
//   _wildMagnetPulledTilesScoring = during pull merge
// Removing active merge 6 → first magnet spawns nothing, second magnet stuck 6
const forceRemoveMagnetMergeResidues = (reason: string) => {
  try {
    const candidates = tiles.filter((t: Tile) => {
      if (!t || t.destroyed) return false;
      if ((t.value | 0) !== 6) return false;
      if (isFinalMergeRuntimeTileProtected(t)) return false;
      // 🔒 EXCLUDE: ALL active magnet pull merge 6 - must stay on board
      if ((t as any)._wildMagnetPulledTilesMerge === true) return false;
      if ((t as any)._wildMagnetMergeCallback) return false;
      if ((t as any)._willPullTiles === true) return false;
      if ((t as any)._hasTilesToPull === true) return false;
      if ((t as any)._wildMagnetPulledTilesScoring === true) return false;
      // Only remove truly orphaned: _noTilesPulled or _wasWildMagnetMerge6 (stale from old session)
      return (t as any)._noTilesPulled === true || (t as any)._wasWildMagnetMerge6 === true;
    });
    if (!candidates.length) return;

    candidates.forEach((t: Tile) => {
      detachTileFromGrid(t, grid);
      t.visible = false;
      t.alpha = 0;
      t.eventMode = 'none';
      removeTile(t);
      delete (t as any)._wildMagnetPulledTilesMerge;
      delete (t as any)._wildMagnetMergeCallback;
      delete (t as any)._willPullTiles;
      delete (t as any)._hasTilesToPull;
      delete (t as any)._wildMagnetPulledTilesScoring;
      delete (t as any)._noTilesPulled;
      delete (t as any)._wasWildMagnetMerge6;
    });

    if (candidates.length) {
      logger.warn(`🧲 SAFETY: Removed ${candidates.length} lingering magnet merge-6 residues (${reason})`, 'app-core');
    }
  } catch (error) {
    logger.warn('⚠️ SAFETY: Failed to remove magnet merge residues', 'app-core', error);
  }
};

// 🔥 v112: Memory management functions moved to app-core-utils.ts
// Imported: trackAppTimeout, clearAllAppTimeouts, trackAppAnimationFrame, clearAllAppAnimationFrames, trackAppInterval, clearAllAppIntervals
// 🔥 CRITICAL: Increased from 500ms to 1200ms to allow all animations to complete
// - Wild spawn bounce: ~580ms
// - Magnet pull + respawn: ~1000ms
// - Regular merge animations: ~600-800ms
// This prevents premature endgame checks while animations are still running
const CHECK_LEVEL_END_DELAY_MS = 500; // 🔥 REDUCED: From 1200ms to 500ms for faster fail screen detection
// 🔥 v112: Combo functions refactored to use helpers
function killComboTimer(){
  comboIdleTimer = killComboTimerHelper(comboIdleTimer);
}

function scheduleComboDecay(customResetMs?: number){
  const resetMs = (typeof customResetMs === 'number' && Number.isFinite(customResetMs) && customResetMs > 0)
    ? Math.floor(customResetMs)
    : COMBO_IDLE_RESET_MS;
  devLog(`🔥 scheduleComboDecay called: combo=${combo}, currentTimer=${comboIdleTimer}, resetMs=${resetMs}`);
  comboIdleTimer = scheduleComboDecayHelper(
    comboIdleTimer,
    resetMs,
    combo,
    hudResetCombo,
    updateHUD
  );
  devLog(`🔥 scheduleComboDecay completed: newTimer=${comboIdleTimer}, type=${typeof comboIdleTimer}`);
}

// --- Wild tuning ---
const WILD_INC_SMALL = 0.10;
const WILD_INC_BIG   = 0.22;

type HudMetrics = { top: number; bottom: number };
type MergeHelpers = { snapBack?: (tile: Tile | null) => void };

// -------------------- global state --------------------
let app: Application | null = null;
let stage: StageType | null = null;
let board: Board | null = null;
let boardBG: Graphics | null = null;
let hud: HUDType | null = null;
let _hudInitDone = false;
let _hudDropPending = true; // One-shot fresh gameplay entry, including fail-modal Play Again
let activeGameplayEntryGeneration = 0;
let _lastSAT = -1;
let grid: Grid = Array.isArray(STATE.grid) ? (STATE.grid as Grid) : [];
const tiles: Tile[] = STATE.tiles as Tile[];
let score = 0; let level = 1; let boardNumber = 1; let moves = MOVES_MAX;
const SCORE_CAP = 999999;
const MAX_CHECK_LEVEL_END_SKIP_MS = 3000; // Hard stop for skip gates to avoid perma-deferral
const TNT_POST_MUTATION_FAIL_RECHECK_MS = 1000;

let drag: (Drag & { t?: any }) | null = null;

function repairBoardTileVisuals(reason = 'unknown'): void {
  try {
    const sourceTiles = Array.isArray(STATE?.tiles) && STATE.tiles.length ? STATE.tiles : tiles;
    let repaired = 0;
    sourceTiles.forEach((t: any) => {
      if (!t || t.destroyed || t.visible === false) return;
      if (t._ccWildSpawnDropping === true) return;
      const sx = Number.isFinite(t.scale?.x) ? t.scale.x : 1;
      const sy = Number.isFinite(t.scale?.y) ? t.scale.y : 1;
      if (Math.min(sx, sy) < 0.86) {
        try { gsap?.killTweensOf?.(t.scale); } catch {}
        try {
          if (t.scale?.set) t.scale.set(1, 1);
          else if (t.scale) {
            t.scale.x = 1;
            t.scale.y = 1;
          }
        } catch {}
        try { t._isBeingSpawned = false; } catch {}
        repaired++;
      }
      const value = (t.value | 0);
      const special = t.special;
      const isWildLike = isWildLikeSpecial(special);
      const isActive = value > 0 || isWildLike;
      if (!isActive) return;

      // A regular playable tile must never retain the internal squash/tilt of
      // an interrupted wild-impact frame. Older repair logic checked only the
      // outer tile.scale, while Cubero animates rotG.scale and rotG.rotation.
      if (
        !special &&
        t !== drag?.t &&
        t.rotG &&
        !t.rotG.destroyed &&
        !(t.rotG as any)._ccLaserGunImpactTl &&
        !(t.rotG as any)._ccWildImpactTl
      ) {
        const rotScaleX = Number.isFinite(t.rotG.scale?.x) ? t.rotG.scale.x : 1;
        const rotScaleY = Number.isFinite(t.rotG.scale?.y) ? t.rotG.scale.y : 1;
        const hasStaleInnerSquash =
          Math.min(rotScaleX, rotScaleY) < 0.90 ||
          Math.max(rotScaleX, rotScaleY) > 1.10 ||
          Math.abs(rotScaleX - rotScaleY) > 0.08;
        const hasStaleInnerTilt = Math.abs(Number(t.rotG.rotation) || 0) > 0.12;
        if (hasStaleInnerSquash || hasStaleInnerTilt) {
          try { animationManager.killExternalTimeline((t.rotG as any)._ccWildImpactTl); } catch {}
          try { gsap?.killTweensOf?.(t.rotG.scale); } catch {}
          try { t.rotG.scale?.set?.(1, 1); } catch {}
          try { t.rotG.rotation = 0; } catch {}
          try { (t.rotG as any)._ccWildImpactTl = null; } catch {}
          repaired++;
        }
      }

      t.alpha = 1;
      if (t.rotG && !t.rotG.destroyed) t.rotG.alpha = 1;
      if (t.overlay && !t.overlay.destroyed) {
        t.overlay.alpha = 1;
        t.overlay.visible = false;
      }
      if (t.num && !t.num.destroyed) t.num.alpha = 1;
      if (t.pips && !t.pips.destroyed) t.pips.alpha = 1;

      const host = t.rotG && !t.rotG.destroyed ? t.rotG : t;
      let base = t.base && !t.base.destroyed ? t.base : null;
      if (!base && host?.children) {
        base = host.children.find((child: any) => child && !child.destroyed && child instanceof Sprite) || null;
      }
      if (!base && host?.addChildAt) {
        base = new Sprite(Assets.get(ASSET_TILE) || Texture.from(ASSET_TILE));
        base.anchor.set(0.5);
        host.addChildAt(base, 0);
        t.base = base;
        repaired++;
      } else if (base && t.base !== base) {
        t.base = base;
      }

      if (base && !base.destroyed) {
        const textureLooksBad =
          !base.texture ||
          base.texture === Texture.EMPTY ||
          (base.texture as any).destroyed === true ||
          ((base.texture as any).source && (base.texture as any).source.valid === false);
        const variantTexturePath = getSpecialDiceTexturePath(t, '');
        if (textureLooksBad || variantTexturePath) {
          const assetPath = special === 'wild-magnet'
            ? ASSET_WILD_MAGNET
            : special === 'wild-juice'
              ? ASSET_WILD_JUICE
              : special === 'wild-tnt'
                ? ASSET_WILD_TNT
                : special === 'wild'
                  ? ASSET_WILD
                  : ASSET_NUMBERS;
          const resolvedAssetPath = getSpecialDiceTexturePath(t, assetPath);
          base.texture = Assets.get(resolvedAssetPath) || Texture.from(resolvedAssetPath);
          repaired++;
        }
        base.visible = true;
        base.alpha = 1;
        const faceSize = special === 'wild-magnet' ? TILE * 0.96 : TILE;
        const specialVisual = getSpecialDiceVisualConfig(t);
        if (specialVisual?.visualWidth && specialVisual?.visualHeight) {
          base.width = specialVisual.visualWidth;
          base.height = specialVisual.visualHeight;
        } else if (specialVisual?.visualFit === 'height') {
          const tex = base.texture;
          const textureHeight = tex?.orig?.height || tex?.height || faceSize;
          base.scale.set(faceSize / Math.max(1, textureHeight));
        } else if (specialVisual?.visualWidth) {
          const tex = base.texture;
          const textureWidth = tex?.orig?.width || tex?.width || faceSize;
          base.scale.set(specialVisual.visualWidth / Math.max(1, textureWidth));
        } else {
          base.width = faceSize;
          base.height = faceSize;
        }
        if (specialVisual?.hitAreaSize === 'tile') {
          const half = TILE / 2;
          const hitArea = new Rectangle(-half, -half, TILE, TILE);
          t.hitArea = hitArea;
          if (host) host.hitArea = hitArea;
          try {
            base.eventMode = 'none';
            base.cursor = 'default';
          } catch {}
        }
        applyGameplayTextureFiltering(base.texture);
      }
    });
    if (repaired > 0) devWarn('🛟 Board tile visuals repaired after FX pressure', { reason, repaired });
  } catch (err) {
    devWarn('⚠️ repairBoardTileVisuals failed', { reason, err });
  }
}

function collectBoardGameplayTiles(): Tile[] {
  const seen = new Set<any>();
  const result: Tile[] = [];
  const add = (tile: any) => {
    if (!tile || seen.has(tile)) return;
    seen.add(tile);
    result.push(tile);
  };

  try { (tiles || []).forEach(add); } catch {}
  try { ((STATE?.tiles as any[]) || []).forEach(add); } catch {}
  try {
    (grid || []).forEach((row: any[]) => {
      if (Array.isArray(row)) row.forEach(add);
    });
  } catch {}

  return result;
}

function scheduleBoardTileVisualRepair(reason = 'unknown'): void {
  try { trackAppAnimationFrame(() => repairBoardTileVisuals(`${reason}:raf`)); } catch {}
  try { trackAppTimeout(() => repairBoardTileVisuals(`${reason}:250ms`), 250); } catch {}
  try { trackAppTimeout(() => repairBoardTileVisuals(`${reason}:900ms`), 900); } catch {}
}

// -------------------- replay/snapshot harness (dev safety) --------------------
const replayRecorder = createReplayRecorder({
  tiles,
  getGrid: () => grid,
  getScore: () => (Number.isFinite(score) ? score : 0),
  getLevel: () => (Number.isFinite(level) ? level : 1),
  getBoardNumber: () => (Number.isFinite(boardNumber) ? boardNumber : Number.isFinite(level) ? level : 1),
  getMoves: () => (Number.isFinite(moves) ? moves : MOVES_MAX),
  getWildMeter: () => (Number.isFinite(wildMeter) ? wildMeter : 0),
  getStarsCount: () => {
    try {
      if (typeof StarsCollector.getStarsCount === 'function') {
        return StarsCollector.getStarsCount();
      }
    } catch {}
    return 0;
  },
});

// Combo (UI driven)
let combo = 0; // default x0
function hudSetCombo(v){ 
  combo = hudSetComboHelper(v, COMBO_CAP, HUD.setCombo);
}
function hudResetCombo(){ 
  combo = 0; // 🔥 CRITICAL: Reset combo variable first
  hudResetComboHelper(HUD.resetCombo);
}

// Export combo text for animations
window.comboText = null;

// Wild meter stores raw charge (can exceed 1); HUD clamps to 0..1
let wildMeter = 0;
let wildSpawnInProgress = false; // Prevent overlapping wild spawns
let merge6SpawnInProgress = false; // 🔥 BUG FIX: Prevent duplicate spawns when wild star/juice are used rapidly
let merge6SpawnOwnerSequence = 0;
let activeMerge6SpawnOwnerToken: number | null = null;
let merge6SpawnResetTimer: gsap.core.Tween | null = null;
const merge6DestinationCleanupOwner = new Merge6DestinationCleanupOwner();
const specialDiceTransactionOwner = new SpecialDiceTransactionOwner();
let regularMergeHandoffSequence = 0;
const regularMergeHandoffTokens = new Set<number>();
const regularMergeHandoffFinalizers = new Map<number, () => void>();
let noMovesFailFlowSequence = 0;
let activeNoMovesFailFlowToken: number | null = null;
let activeNoMovesInputLockToken: number | null = null;
let wildSpawnRetryTimer = null;  // Retry timer when no cells are free
let wildSpawnCancelToken = 0;
let wildMagnetPullInProgress = false; // Prevent overlapping wild-magnet pull animations
let busyEnding = false;

/**
 * HUD/menu controls must yield as soon as a terminal merge owns the board,
 * not only after the clean-board async flow eventually sets busyEnding.
 */
export function isTerminalEndgameInteractionLocked(): boolean {
  // The NO MOVES candidate still permits a legal rescuing drag, but navigation
  // must not start a competing Exit Game flow while terminal confirmation and
  // board pop-out are preparing the Fail screen.
  if (busyEnding || failScreenFlowInProgress || activeNoMovesFailFlowToken !== null) return true;
  try {
    if ((window as any).__ccFailScreenPending === true) return true;
    return tiles.some((tile: any) => (
      tile &&
      !tile.destroyed &&
      (tile as any)._isLastMerge === true
    ));
  } catch {
    return false;
  }
}
let failScreenFlowInProgress = false;
let checkLevelEndSkipStartedAt: number | null = null; // Track skip window to force fall-through
let activeDragEndgameDeferredAt: number | null = null; // Telemetry only; drag runtime owns stale-pointer recovery
let stuckWildDeferralStartedAt: number | null = null; // Guard against infinite stuck->wild defer loop
let tutorialFinalChanceSpawnCount = 0;
const MAX_STUCK_WILD_DEFERRAL_MS = 2200;
const MAX_TUTORIAL_FINAL_CHANCE_SPAWNS = 99;

function setWildMagnetPullInProgress(active: boolean, reason: string = 'unknown'): void {
  const wasActive = wildMagnetPullInProgress;
  wildMagnetPullInProgress = active;
  try {
    (window as any).__ccWildMagnetPullInProgress = active;
    if (!active) {
      (window as any).__ccActiveMagnetPullCleanup = null;
    }
  } catch {}
  try {
    setInputGateLock('magnet-pull', active, { ttlMs: 4500, scope: 'all' });
    if (!active) {
      setInputGateLock('magnetic-text', false);
    }
  } catch {}
  devLog(`🧲 Wild-magnet pull interaction guard ${active ? 'ON' : 'OFF'} (${reason})`);
  emitIOSSpecialTransactionTrace('magnet-pull-gate', { active, reason });
  if (wasActive && !active) {
    queueWildSpawnAfterGuardRelease(`wild-magnet-pull-reset:${reason}`);
  }
}

function clearMerge6SpawnResetTimer(): void {
  try {
    if (merge6SpawnResetTimer) {
      merge6SpawnResetTimer.kill?.();
      merge6SpawnResetTimer = null;
    }
  } catch {}
}

function resetMerge6SpawnState(
  _reason: string = 'unknown',
  options: {
    releaseSpecialTransaction?: boolean;
    specialTransactionToken?: number | null;
    merge6SpawnOwnerToken?: number | null;
    force?: boolean;
  } = {},
): boolean {
  if (
    options.force !== true &&
    activeMerge6SpawnOwnerToken !== null &&
    options.merge6SpawnOwnerToken !== activeMerge6SpawnOwnerToken
  ) {
    devWarn('🛡️ Ignoring stale merge-6 spawn reset', {
      reason: _reason,
      requestedToken: options.merge6SpawnOwnerToken ?? null,
      activeToken: activeMerge6SpawnOwnerToken,
    });
    return false;
  }
  const wasInProgress = merge6SpawnInProgress;
  merge6SpawnInProgress = false;
  activeMerge6SpawnOwnerToken = null;
  clearMerge6SpawnResetTimer();
  if (options.releaseSpecialTransaction !== false) {
    releaseSpecialDiceTransaction(
      options.specialTransactionToken ?? null,
      `merge6-spawn-reset:${_reason}`,
    );
  }
  if (wasInProgress) {
    queueWildSpawnAfterGuardRelease(`merge6-spawn-reset:${_reason}`);
  }
  return true;
}

function beginSpecialDiceTransaction(kind: SpecialDiceTransactionKind): number | null {
  const token = specialDiceTransactionOwner.claim(kind);
  if (token === null) {
    emitIOSSpecialTransactionTrace('claim-rejected', {
      kind,
      active: specialDiceTransactionOwner.snapshot(),
    });
    return null;
  }
  setInputGateLock('special-transaction', true, { ttlMs: 15000, scope: 'all' });
  devLog('🛡️ Special transaction claimed', { token, kind });
  emitIOSSpecialTransactionTrace('claimed', { token, kind });
  return token;
}

function markSpecialDiceTransactionBoardCommitted(token: number | null, reason: string): boolean {
  const active = specialDiceTransactionOwner.snapshot();
  if (!active || active.token !== token) return false;
  if (!specialDiceTransactionOwner.markBoardCommitted(token, gameplayBoardMutationRevision)) return false;
  // Keep special/wild input serialized through the visual tail, while ordinary
  // sub-six stacks are filtered separately by canDrop/merge below.
  setInputGateLock('special-transaction', true, { ttlMs: 15000, scope: 'wild-only' });
  devLog('🛡️ Special transaction entered visual tail', { ...active, reason });
  emitIOSSpecialTransactionTrace('board-committed-visual-tail', {
    token,
    kind: active.kind,
    reason,
  });
  return true;
}

function canOrdinaryStackDuringSpecialVisualTail(src: any, dst: any): boolean {
  if (!src || !dst || src.destroyed || dst.destroyed || src.locked || dst.locked) return false;
  const isStableOrdinary = (tile: any) =>
    !isWildLikeTile(tile) &&
    !getSpecialDiceVariantForTile(tile) &&
    !isSpecialDiceResolutionOwned(tile) &&
    tile._wildMagnetAffected !== true &&
    !isTntBonusTileOwned(tile) &&
    tile._ccWildSpawnDropping !== true &&
    tile._pendingRemoval !== true;
  return canRunOrdinaryStackDuringVisualTail(specialDiceTransactionOwner, {
    sourceValue: src.value | 0,
    destinationValue: dst.value | 0,
    sourceStableOrdinary: isStableOrdinary(src),
    destinationStableOrdinary: isStableOrdinary(dst),
  });
}

function canOrdinaryStackDuringMerge6Handoff(src: any, dst: any): boolean {
  const isStableOrdinary = (tile: any) =>
    !!tile &&
    !tile.destroyed &&
    !tile.locked &&
    !isWildLikeTile(tile) &&
    !getSpecialDiceVariantForTile(tile) &&
    !isSpecialDiceResolutionOwned(tile) &&
    tile._wildMagnetAffected !== true &&
    !isTntBonusTileOwned(tile) &&
    tile._ccWildSpawnDropping !== true &&
    tile._pendingRemoval !== true;
  return isStableOrdinarySubSixStack({
    sourceValue: src?.value | 0,
    destinationValue: dst?.value | 0,
    sourceStableOrdinary: isStableOrdinary(src),
    destinationStableOrdinary: isStableOrdinary(dst),
  });
}

function releaseSpecialDiceTransaction(token: number | null, reason: string): boolean {
  const active = specialDiceTransactionOwner.snapshot();
  emitIOSSpecialTransactionTrace('release-request', { token, reason, active });
  if (!active) {
    setInputGateLock('special-transaction', false);
    emitIOSSpecialTransactionTrace('release-no-active-owner', { token, reason });
    return false;
  }
  if (active.token !== token) {
    devWarn('🛡️ Ignoring stale special transaction release', {
      requestedToken: token,
      activeToken: active.token,
      activeKind: active.kind,
      reason,
    });
    emitIOSSpecialTransactionTrace('release-stale-token', { token, reason, active });
    return false;
  }
  const released = specialDiceTransactionOwner.release(token);
  if (released) {
    setInputGateLock('special-transaction', false);
    devLog('🛡️ Special transaction released', { ...active, reason });
    emitIOSSpecialTransactionTrace('released', { token, reason, kind: active.kind });
    queueWildSpawnAfterGuardRelease(`special-transaction:${reason}`);
  }
  return released;
}

function resetTransientRunGuards(reason: string = 'unknown'): void {
  devLog('🧹 Resetting transient run guards:', reason);
  gameplayRunGeneration += 1;
  cancelCheckLevelEndTimer();
  try { FLOW.cleanupLevelFlowTimeouts(); } catch {}
  try {
    if (wildSpawnRetryTimer) {
      clearTimeout(wildSpawnRetryTimer);
      wildSpawnRetryTimer = null;
    }
  } catch {}
  try {
    if (__ccNavCleanupTimer) {
      clearTimeout(__ccNavCleanupTimer);
      __ccNavCleanupTimer = null;
    }
  } catch {}
  wildSpawnInProgress = false;
  wildSpawnCancelToken++;
  resetMerge6SpawnState(`transient-guards:${reason}`, { force: true });
  specialDiceTransactionOwner.reset();
  regularMergeHandoffTokens.clear();
  regularMergeHandoffFinalizers.clear();
  activeNoMovesFailFlowToken = null;
  activeNoMovesInputLockToken = null;
  try { setInputGateLock('special-transaction', false); } catch {}
  wildMagnetPullInProgress = false;
  try { (window as any).__ccWildMagnetPullInProgress = false; } catch {}
  try { clearInputGateLocks(); } catch {}
  try { (window as any).__ccWildSpawnDropInProgress = false; } catch {}
  try { (window as any).__ccActiveMagnetPullCleanup?.(); } catch {}
  try { (window as any).__ccActiveMagnetPullCleanup = null; } catch {}
  checkLevelEndSkipStartedAt = null;
  activeDragEndgameDeferredAt = null;
  stuckWildDeferralStartedAt = null;
  resetTransientEndgameRuntimeState(`transient-guards:${reason}`);
}

function resetTransientEndgameRuntimeState(reason: string = 'unknown'): void {
  devLog('🧹 Resetting transient endgame runtime state:', reason);
  try { (window as any).__ccFailScreenPending = false; } catch {}
  try { (window as any).__ccBoardJustCompleted = false; } catch {}
  try { (window as any).__ccFinalResidualPopOutPrepared = false; } catch {}
  finalResidualHandoffOwner.reset();
  try { (window as any).__ccFinalHudExitPrepared = false; } catch {}
  try { (window as any).__ccFinalHudExitPromise = null; } catch {}
  try { (window as any).__ccFinalMergeHandoffSettledUntil = 0; } catch {}
  try { setFinalMergeVisualSuppression(false); } catch {}
  try { clearEndGameCache(); } catch {}
  try { resetEndgameHint(); } catch {}
  try { cleanupFinalMergeDiceCelebration(); } catch {}
  busyEnding = false;
  failScreenFlowInProgress = false;
}

function clearTransientTileEndgameFlags(tileList: any[], reason: string = 'unknown'): void {
  try {
    (Array.isArray(tileList) ? tileList : []).forEach((t: any) => {
      if (!t || t.destroyed) return;
      delete (t as any)._isLastMerge;
      delete (t as any)._wasWildMagnetMerge6;
      delete (t as any)._isWildMagnetLastTwo;
      delete (t as any)._wildMagnetPulledTilesMerge;
      delete (t as any)._wildMagnetPulledTilesScoring;
      delete (t as any)._wildMagnetPulledCells;
      delete (t as any)._noTilesPulled;
      delete (t as any)._willPullTiles;
      delete (t as any)._hasTilesToPull;
    });
    devLog('🧹 Cleared transient tile endgame flags:', reason);
  } catch (error) {
    devWarn('⚠️ Failed to clear transient tile endgame flags:', { reason, error });
  }
}

function beginEndgameGuard(source: string, ttlMs: number = 1500): number {
  const normalizedSource = String(source || 'unknown');
  const now = Date.now();
  const safeTtl = Math.max(50, Math.min(ENDGAME_GUARD_MAX_TTL_MS, ttlMs | 0 || 1500));
  const nextCount = (endgameGuardSources.get(normalizedSource) || 0) + 1;
  endgameGuardSources.set(normalizedSource, nextCount);
  endgameGuardCount++;
  endgameGuardUntil = Math.max(endgameGuardUntil, now + safeTtl);
  devLog('🛡️ beginEndgameGuard:', { source: normalizedSource, ttlMs: safeTtl, count: endgameGuardCount, untilInMs: endgameGuardUntil - now });
  return endgameGuardCount;
}

function endEndgameGuard(source: string): void {
  const normalizedSource = String(source || 'unknown');
  const existing = endgameGuardSources.get(normalizedSource) || 0;
  if (existing > 1) {
    endgameGuardSources.set(normalizedSource, existing - 1);
  } else {
    endgameGuardSources.delete(normalizedSource);
  }
  if (endgameGuardCount > 0) endgameGuardCount--;
  if (endgameGuardCount === 0) {
    endgameGuardUntil = 0;
  }
  devLog('🛡️ endEndgameGuard:', { source: normalizedSource, count: endgameGuardCount });
}

function getEndgameGuardState(): { active: boolean; count: number; until: number; sources: string[] } {
  const now = Date.now();
  const active = endgameGuardCount > 0 || endgameGuardUntil > now;
  return {
    active,
    count: endgameGuardCount,
    until: endgameGuardUntil,
    sources: Array.from(endgameGuardSources.keys())
  };
}

function isSpecialGameplayAnimationActive(): boolean {
  return !!isTntAnimationActive?.() ||
    !!isWildJuiceBubblesExplosionActive?.() ||
    !!isMagneticTextActive?.() ||
    !!isSparkleTextActive?.();
}

function buildGameplayRuntimeFlags(options: {
  ignoreSkipWindow?: boolean;
  skipWindowExceeded?: boolean;
  includeSpecialAnimation?: boolean;
  force?: Partial<GameplayRuntimeFlags>;
  overrides?: Partial<GameplayRuntimeFlags>;
} = {}): GameplayRuntimeFlags {
  // Runtime ownership is factual state, never a wall-clock guess. Watchdogs
  // must recover/rollback their owner; they may not pretend a mutation is idle
  // merely because an arbitrary endgame skip window elapsed.
  const flags: GameplayRuntimeFlags = {
    busyEnding,
    wildSpawnInProgress,
    merge6SpawnInProgress,
    wildMagnetPullInProgress,
    pendingSpecialAnimation: options.includeSpecialAnimation === true && isSpecialGameplayAnimationActive(),
  };

  return {
    ...flags,
    ...(options.force ?? {}),
    ...(options.overrides ?? {}),
  };
}

function debugResolveGameplayState(reason = 'manual-check', overrides: any = {}) {
  const snapshot = createGameplaySnapshot({
    tiles: collectBoardGameplayTiles(),
    moves,
    makeBoard,
    mode: overrides.mode ?? (isArcadeHomeRunMode() ? 'arcade' : 'journey'),
    phase: overrides.phase ?? 'manual-check',
    boardNumber,
    stageNumber: (window as any).__ccArcadeStageNumber,
    src: overrides.src,
    dst: overrides.dst,
    effSum: overrides.effSum ?? 0,
    finalMergeBlockersBefore: overrides.finalMergeBlockersBefore,
    flags: buildGameplayRuntimeFlags({
      ignoreSkipWindow: true,
      includeSpecialAnimation: true,
      overrides: {
        willPulledTilesMerge: overrides.willPulledTilesMerge === true,
        hasTilesToPull: overrides.hasTilesToPull === true,
      },
    }),
  });
  const decision = resolveGameplayState(snapshot);
  const summary = summarizeGameplayDecision(snapshot, decision);
  devLog('🧭 Gameplay resolver shadow decision', {
    reason,
    summary,
    endGameResult: snapshot.endGameResult,
  });
  return { snapshot, decision, summary };
}

function isFinalMergeCleanBoardReason(reason: string): boolean {
  const normalized = String(reason || '');
  return normalized.includes('last_merge') ||
    normalized.includes('final_') ||
    normalized.includes('merge6') ||
    normalized.includes('single_merge6_guard') ||
    normalized.includes('spawn_guard') ||
    normalized.includes('final_wild_guard') ||
    normalized.includes('final_regular_guard');
}

function shouldRunCleanBoardVisualHandoff(reason: string): boolean {
  const normalized = String(reason || '');
  return isFinalMergeCleanBoardReason(normalized) ||
    normalized === 'clean_board_from_checkLevelEnd' ||
    normalized === 'clean_board_from_moves_depleted' ||
    normalized === 'clean_board_from_test_overlay';
}

type FinalMergeVisualStarters = {
  showWildJuiceFinale?: () => void;
  showSparkleFinale?: () => void;
  finalMergeSnapshot?: Pick<FinalMergeSnapshot, 'isFinalRegularMerge6'> | null;
};

type CleanBoardFlowOptions = {
  finalMergeSnapshot?: Pick<FinalMergeSnapshot, 'isFinalRegularMerge6'> | null;
};

async function waitForFinalHudExitState(
  hudRoot: any,
  bottomDecor: HTMLImageElement | null,
  timeoutMs = 780,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const hudDone = !hudRoot ||
      hudRoot.destroyed === true ||
      hudRoot.parent == null ||
      hudRoot.visible === false ||
      Number(hudRoot.alpha ?? 0) <= 0.05 ||
      hudRoot._dropped === false;
    const decorDone = !bottomDecor ||
      bottomDecor.hidden === true ||
      !bottomDecor.classList.contains('is-exiting');

    if (hudDone && decorDone) return;
    if (await waitTrackedResult(40) === 'cancelled') return;
  }
}

async function animateFinalHudExitHandoff(reason: string): Promise<void> {
  const anyWindow = window as any;
  if (anyWindow.__ccFinalHudExitPrepared === true) return;
  if (anyWindow.__ccFinalHudExitPromise) {
    await anyWindow.__ccFinalHudExitPromise;
    return;
  }

  anyWindow.__ccFinalHudExitPromise = (async () => {
    const hudRoot = anyWindow.HUD_ROOT || (HUD as any).HUD_ROOT || null;
    const bottomDecor = document.getElementById('journey-game-bottom-decor') as HTMLImageElement | null;
    const shouldAnimateHud = !!hudRoot &&
      hudRoot.destroyed !== true &&
      hudRoot.parent != null &&
      hudRoot.visible !== false &&
      Number(hudRoot.alpha ?? 1) > 0.05;
    const shouldAnimateDecor = !!bottomDecor && bottomDecor.hidden !== true;

    if (!shouldAnimateHud && !shouldAnimateDecor) {
      anyWindow.__ccFinalHudExitPrepared = true;
      return;
    }

    devLog('🎬 Final merge HUD/bottom exit handoff started', { reason, shouldAnimateHud, shouldAnimateDecor });

    if (shouldAnimateDecor) {
      try { setJourneyGameBottomDecorVisible(false); } catch {}
    }
    if (shouldAnimateHud) {
      try {
        startHudExitAnimation({ HUD, devLog, devWarn });
      } catch (err) {
        devWarn('⚠️ Final merge HUD exit handoff failed to start:', err);
      }
    }

    await waitForFinalHudExitState(shouldAnimateHud ? hudRoot : null, shouldAnimateDecor ? bottomDecor : null);
    anyWindow.__ccFinalHudExitPrepared = true;
  })();

  try {
    await anyWindow.__ccFinalHudExitPromise;
  } finally {
    anyWindow.__ccFinalHudExitPromise = null;
  }
}

async function prepareFinalMergeVisualHandoff(
  reason: string,
  residualReason: string = reason,
  starters: FinalMergeVisualStarters = {},
): Promise<void> {
  if ((window as any).__ccFinalResidualPopOutPrepared === true) return;
  const handoffGeneration = gameplayRunGeneration;
  const run = finalResidualHandoffOwner.run(handoffGeneration, async () => {
    if ((window as any).__ccFinalResidualPopOutPrepared === true) return;
    devLog('[CC_FINAL_RESIDUAL_OWNER] start', { handoffGeneration, mode: 'journey', reason, residualReason });
    normalizeFinalMerge6ResidueVisuals(`handoff:${residualReason}`);
    holdFinalResidualArtifactsVisible(`handoff:${residualReason}`);

    await waitForFinalMergeHandoff({
      reason,
      isArcade: false,
      wait: waitTracked,
      logger,
      isTntAnimationActive,
      onTntBoomExitComplete,
      onTntAnimationComplete,
      isWildJuiceBubblesExplosionActive: isWildJuiceFinaleAnimationActive,
      isWildJuiceBubblesExplosionRecentlyStarted,
      waitForWildJuiceBubblesExplosionComplete: waitForBubblesExplosionToComplete,
      showWildJuiceFinale: starters.showWildJuiceFinale,
      isMagneticTextActive,
      showMagneticText,
      waitForMagneticTextComplete,
      isSparkleTextActive,
      showSparkleFinale: starters.showSparkleFinale,
      waitForSparkleTextComplete,
    });

    try { resetEndgameHint(); } catch {}
    const shouldPlayClearedCelebration =
      handoffGeneration === gameplayRunGeneration &&
      shouldPlayJourneyClearedCelebration({
        isArcade: isArcadeHomeRunMode(),
        finalMergeSnapshot: starters.finalMergeSnapshot,
      });
    await Promise.all([
      animateFinalResidualArtifactsPopOut(residualReason),
      shouldPlayClearedCelebration
        ? playFinalMergeDiceCelebration()
        : Promise.resolve(),
    ]);
    await animateFinalHudExitHandoff(residualReason);
    if (handoffGeneration !== gameplayRunGeneration) return;
    try { (window as any).__ccFinalResidualPopOutPrepared = true; } catch {}
    devLog('[CC_FINAL_RESIDUAL_OWNER] complete', { handoffGeneration, mode: 'journey', reason, residualReason });
  });
  if (run.joined) {
    devLog('[CC_FINAL_RESIDUAL_OWNER] join', { handoffGeneration, mode: 'journey', reason, residualReason });
  }
  await run.promise;
}

async function prepareArcadeStageClearFinalMergeHandoff(
  reason: string,
  residualReason: string = reason,
  starters: FinalMergeVisualStarters = {},
): Promise<void> {
  if ((window as any).__ccFinalResidualPopOutPrepared === true) return;
  const handoffGeneration = gameplayRunGeneration;
  const run = finalResidualHandoffOwner.run(handoffGeneration, async () => {
    if ((window as any).__ccFinalResidualPopOutPrepared === true) return;
    devLog('[CC_FINAL_RESIDUAL_OWNER] start', { handoffGeneration, mode: 'arcade', reason, residualReason });
    normalizeFinalMerge6ResidueVisuals(`arcade-handoff:${residualReason}`);
    holdFinalResidualArtifactsVisible(`arcade-handoff:${residualReason}`);

    await waitForFinalMergeHandoff({
      reason,
      isArcade: true,
      wait: waitTracked,
      logger,
      isTntAnimationActive,
      onTntBoomExitComplete,
      onTntAnimationComplete,
      isWildJuiceBubblesExplosionActive: isWildJuiceFinaleAnimationActive,
      isWildJuiceBubblesExplosionRecentlyStarted,
      waitForWildJuiceBubblesExplosionComplete: waitForBubblesExplosionToComplete,
      showWildJuiceFinale: starters.showWildJuiceFinale,
      isMagneticTextActive,
      showMagneticText,
      waitForMagneticTextComplete,
      isSparkleTextActive,
      showSparkleFinale: starters.showSparkleFinale,
      waitForSparkleTextComplete,
    });

    await animateFinalResidualArtifactsPopOut(`arcade-handoff:${residualReason}`);
    hardCleanupArcadeFinalMergeTerminalResidue(`arcade-handoff-after-popout:${residualReason}`);
    if (handoffGeneration !== gameplayRunGeneration) return;
    try { (window as any).__ccFinalResidualPopOutPrepared = true; } catch {}
    devLog('[CC_FINAL_RESIDUAL_OWNER] complete', { handoffGeneration, mode: 'arcade', reason, residualReason });
  });
  if (run.joined) {
    devLog('[CC_FINAL_RESIDUAL_OWNER] join', { handoffGeneration, mode: 'arcade', reason, residualReason });
  }
  await run.promise;
}

// 🔥 REFACTORED: Koristimo tileIsActive iz endgame-checker.ts za konzistentnost
// Uklonjeno tileIsVisuallyActive() - sada koristimo tileIsActive() iz endgame-checker.ts

// 🔥 REMOVED: isBoardCleanReactive() - use checkEndGame() from endgame-checker.ts instead
// This function was a duplicate of isBoardCleanCheck() and could cause conflicts

async function triggerCleanBoardFlow(
  reason: string,
  options: CleanBoardFlowOptions = {},
): Promise<void> {
  markPixiMobileActivity(7000);
  logger.info('🚨🚨🚨 triggerCleanBoardFlow invoked', 'app-core', { reason });
  const cleanBoardRunAbortToken = Number((window as any).__ccEndgameFlowAbortToken || 0);

  // 🔥 USER BUG FIX: Don't trigger clean board flow if game is hidden (user is on homepage/other screens)
  // This prevents clean board modal from appearing when user navigates away from game
  const { appVisible, homeVisible, journeyVisible } = getScreenVisibility();
  if (homeVisible || journeyVisible) {
    try { setFinalMergeVisualSuppression(false); } catch {}
    logger.debug('⏳ triggerCleanBoardFlow skipped - home/journey visible (user on other screens)', 'app-core', {
      appVisible,
      homeVisible,
      journeyVisible
    });
    return;
  }
  if (!appVisible) {
    // If no other screen is visible but app is hidden, force-show to avoid deadlock.
    try {
      const uiManagerModule = await import('./ui-manager.js');
      uiManagerModule.default?.showApp?.();
      logger.warn('⚠️ triggerCleanBoardFlow: App was hidden with no UI visible - force showApp()', 'app-core');
    } catch {}
  }

  if (busyEnding) {
    logger.debug('⏳ triggerCleanBoardFlow skipped - busyEnding already true', 'app-core');
    return;
  }
  busyEnding = true;
  cancelPendingWildContinuation(`clean-board-flow:${reason}`);

  const terminalFinalMergeReason = shouldRunCleanBoardVisualHandoff(reason);
  const arcadeStageClearTerminal = terminalFinalMergeReason && isArcadeHomeRunMode();
  const visualHandoffReason = terminalFinalMergeReason && !arcadeStageClearTerminal;
  let finalHandoffPrepared = terminalFinalMergeReason && (window as any).__ccFinalResidualPopOutPrepared === true;
  if (visualHandoffReason && (window as any).__ccFinalResidualPopOutPrepared !== true) {
    try {
      await prepareFinalMergeVisualHandoff(reason, `trigger-clean-board:${reason}`, {
        finalMergeSnapshot: options.finalMergeSnapshot,
      });
      finalHandoffPrepared = true;
    } catch (handoffError) {
      devWarn('⚠️ triggerCleanBoardFlow final merge visual handoff failed:', handoffError);
    }
  } else if (arcadeStageClearTerminal) {
    try {
      if ((window as any).__ccFinalResidualPopOutPrepared === true) {
        hardCleanupArcadeFinalMergeTerminalResidue(`trigger-clean-board:already-prepared:${reason}`);
      } else {
        await prepareArcadeStageClearFinalMergeHandoff(
          reason,
          `trigger-clean-board:${reason}`
        );
      }
      finalHandoffPrepared = true;
    } catch (handoffError) {
      devWarn('⚠️ triggerCleanBoardFlow arcade final merge handoff failed:', handoffError);
    }
  }

  try { hideTerminalLockedArtifacts(`triggerCleanBoardFlow:${reason}`); } catch {}

  if (!finalHandoffPrepared) {
    await waitForFinalMergeHandoff({
      reason,
      isArcade: isArcadeHomeRunMode(),
      wait: waitTracked,
      logger,
      isTntAnimationActive,
      onTntBoomExitComplete,
      onTntAnimationComplete,
      isWildJuiceBubblesExplosionActive: isWildJuiceFinaleAnimationActive,
      isWildJuiceBubblesExplosionRecentlyStarted,
      waitForWildJuiceBubblesExplosionComplete: waitForBubblesExplosionToComplete,
      isMagneticTextActive,
      showMagneticText,
      waitForMagneticTextComplete,
      isSparkleTextActive,
      waitForSparkleTextComplete,
    });
  } else {
    logger.debug('⏭️ triggerCleanBoardFlow: final merge handoff already settled, skipping duplicate wait', 'app-core', { reason });
  }
  // Keep the completed marker through the completion/modal handoff. A generic
  // board-exit callback must not resurrect and animate the already-retired
  // ghost layer. startLevel/resetTransientEndgameRuntimeState owns the reset.

  // 🔥 BUG FIX: Clear STACK IT! hint IMMEDIATELY when entering clean board flow
  // Prevents hint from appearing during/after boom animation when board is empty
  try { resetEndgameHint(); } catch {}
  
  // If we explicitly requested a clean-board skip (e.g., resuming straight into next board after hard-exit),
  // consume the flag and bail before any modal/animation starts.
  if ((window as any).__skipCleanBoardOnce) {
    logger.debug('⏭️ Skipping clean-board flow once due to resume jump flag', 'app-core');
    delete (window as any).__skipCleanBoardOnce;
    try { setFinalMergeVisualSuppression(false); } catch {}
    busyEnding = false;
    return;
  }

  // 🔥 UX: Stop idle bounce smoke immediately before clean board flow
  try { TILE_IDLE_BOUNCE.stop(); } catch {}
  try { cleanupFxContainersByTag('tile-idle-smoke'); } catch {}

  // 🧪 DEV LOG: Snapshot when "clean board" is triggered (cleanup stats, stage/board children, tiles, renderer, assets, gsap, memoryManager, performance.memory)
  try {
    logRuntimeStats('clean board');
  } catch (e) {
    devWarn('⚠️ DEV LOG (clean board) snapshot failed:', e);
  }

  // 🔥 NOTE: Defer texture/memory cleanup until AFTER endgame animations complete.
  // Cleaning here can destroy runtime textures used by stars/bubbles and freeze animations.

  // Reset wild meter immediately (legacy behavior)
  resetWildMeterState(`trigger-clean-board:${reason}`);
  firstWildSpawned = false; // 🔥 USER REQUEST: Reset first wild spawn tracking
  wildSpawnCount = 0;
  lastWildDropType = null;
  wildDropTypeStreak = 0;

  try {
    // 🔥 UX: No fixed delay – runEndgameFlow waits only for ongoing animations (bubbles/stars), then shows modal
    const shouldSkipStarsWaitForCleanBoard =
      reason === FINAL_MERGE_REASONS.tntAfterAnimation ||
      reason === FINAL_MERGE_REASONS.tntFallbackTimeout ||
      reason === FINAL_MERGE_REASONS.tnt ||
      (window as any).__ccSkipEndgameStarsWaitOnce === true;
    delete (window as any).__ccSkipEndgameStarsWaitOnce;

    await runEndgameFlow({
      app,
      stage,
      board,
      boardBG,
      level,
      startLevel,
      score,
      getScore: () => score,
      setScore: (v) => { score = v | 0; updateHUD(); },
      animateScore,
      updateHUD,
      boardNumber,
      skipStarsWait: shouldSkipStarsWaitForCleanBoard,
      finalMergeCompleted: terminalFinalMergeReason,
      abortToken: cleanBoardRunAbortToken,
      hideGrid: () => {
        try {
          setJourneyGameBottomDecorVisible(false);
          board.visible = false;
          hud.visible = false;
          drawBoardBG('none');
        } catch {}
      },
      showGrid: () => {
        try {
          board.visible = true;
          hud.visible = true;
          drawBoardBG();
        } catch {}
      }
    });

    // Extra pass after endgame flow completes: aggressively clear unknown small textures
    try {
      logger.debug('🧹 Performing memory cleanup after endgame flow...', 'app-core');
      memoryManager.performCleanup();
    } catch (error) {
      logger.warn('⚠️ Memory cleanup failed (post endgame)', 'app-core', error);
    }
    try {
      // Stability-first: never run destructive texture cache cleanup here.
      // Keep this pass non-destructive to avoid addressModeU crashes during next-board boot.
      cleanupTexturesForBoardTransition('after-clean-board', false, true);
    } catch {}
    
    // 🔥 BOARD RECOVERY: Clean board flow completed successfully - clear recovery flag
    // This prevents recovery from triggering on next load since flow completed normally
    try {
      clearPendingCleanBoard();
    } catch (e) {
      logger.warn('⚠️ Failed to clear pending clean board flag:', 'app-core', e);
    }
  } finally {
    try { setFinalMergeVisualSuppression(false); } catch {}
    busyEnding = false;
    failScreenFlowInProgress = false;
  }
}

type NoMovesFailFlowOptions = {
  reason: string;
  waitMs?: number;
  extraWaitMs?: number;
  resetHint?: boolean;
  exitTimeoutMs?: number;
  persistStuckState?: boolean;
};

function buildNoMovesBoardSignature(sourceTiles: Tile[] = collectBoardGameplayTiles()): string {
  return JSON.stringify(sourceTiles
    .filter((tile: any) => tile && !tile.destroyed)
    .map((tile: any) => ({
      value: tile.value | 0,
      special: tile.special || null,
      locked: tile.locked === true,
      stackDepth: tile.stackDepth || 1,
      gridX: tile.gridX ?? null,
      gridY: tile.gridY ?? null,
      visible: tile.visible !== false,
    }))
    .sort((a: any, b: any) =>
      (a.gridY ?? -1) - (b.gridY ?? -1) ||
      (a.gridX ?? -1) - (b.gridX ?? -1) ||
      a.value - b.value));
}

function getNoMovesCommitBlockReason(initialSignature: string): string | null {
  const activeDragTile = ((STATE as any)?.drag?.t) || ((drag as any)?.t);
  const endgameGuard = getEndgameGuardState();
  const gameplayTiles = collectBoardGameplayTiles();
  const currentSignature = buildNoMovesBoardSignature(gameplayTiles);
  try {
    const freshResult = checkEndGame({ tiles: gameplayTiles, moves, makeBoard }, true);
    const decision = resolveNoMovesCommitDecision({
      initialSignature,
      currentSignature,
      freshEndGameType: freshResult.type,
      wildContinuationPending: isWildContinuationPendingForFail(),
      gameplayTransactionActive:
        wildSpawnInProgress ||
        merge6SpawnInProgress ||
        wildMagnetPullInProgress ||
        specialDiceTransactionOwner.isActive() ||
        regularMergeHandoffTokens.size > 0,
      activeDrag: !!(activeDragTile && !activeDragTile.destroyed),
      endgameGuardActive: endgameGuard.active,
    });
    return decision.action === 'defer' ? decision.reason : null;
  } catch (error) {
    devWarn('⚠️ No-moves commit recheck failed; deferring terminal commit', error);
    return 'fresh-check-error';
  }
}

function getNoMovesTraceState(reason: string, phase: string): Record<string, unknown> {
  const gameplayTiles = collectBoardGameplayTiles();
  return {
    reason,
    phase,
    moves,
    wildMeter,
    wildSpawnInProgress,
    merge6SpawnInProgress,
    regularMergeHandoffCount: regularMergeHandoffTokens.size,
    specialTransactionActive: specialDiceTransactionOwner.isActive(),
    boardSignature: buildNoMovesBoardSignature(gameplayTiles),
    tiles: gameplayTiles
      .filter((tile: any) => tile && !tile.destroyed)
      .map((tile: any) => ({
        value: tile.value | 0,
        special: tile.special || null,
        locked: tile.locked === true,
        stackDepth: tile.stackDepth || 1,
        gridX: tile.gridX ?? null,
        gridY: tile.gridY ?? null,
        eventMode: tile.eventMode ?? null,
        visible: tile.visible !== false,
      })),
  };
}

function deferNoMovesFailBeforeOwnership(reason: string, blockReason: string): void {
  devWarn('🛡️ Deferring NO MOVES before terminal ownership', { reason, blockReason });
  queueWildSpawnAfterGuardRelease(`no-moves-prelock-deferred:${blockReason}`);
  scheduleCheckLevelEnd(0.2, `no_moves_prelock_deferred:${reason}:${blockReason}`);
}

function cancelNoMovesFailFlow(token: number, reason: string, blockReason: string): void {
  if (activeNoMovesFailFlowToken !== token) {
    devWarn('🛡️ Ignoring stale NO MOVES rollback', {
      requestedToken: token,
      activeToken: activeNoMovesFailFlowToken,
      reason,
      blockReason,
    });
    return;
  }
  devWarn('🛡️ Cancelling stale NO MOVES terminal flow', { reason, blockReason });
  emitIOSSpecialTransactionTrace('no-moves-cancelled', {
    token,
    blockReason,
    ...getNoMovesTraceState(reason, 'cancelled'),
  });
  activeNoMovesFailFlowToken = null;
  try { clearNoMovesText(); } catch {}
  if (activeNoMovesInputLockToken === token) {
    activeNoMovesInputLockToken = null;
    try { (window as any).__ccTerminalEndScreenPending = false; } catch {}
    try { (window as any).__ccFailScreenPending = false; } catch {}
    failScreenFlowInProgress = false;
    busyEnding = false;
    try { setInputGateLock('terminal-no-moves', false); } catch {}
  }
  try {
    if (TILE_IDLE_BOUNCE.ENABLE) TILE_IDLE_BOUNCE.start(tiles, board);
  } catch {}
  queueWildSpawnAfterGuardRelease(`no-moves-cancelled:${blockReason}`);
  scheduleCheckLevelEnd(0.2, `no_moves_cancelled:${reason}:${blockReason}`);
}

async function runNoMovesFailFlow({
  reason,
  waitMs = 1500,
  extraWaitMs = 0,
  resetHint = true,
  exitTimeoutMs,
  persistStuckState = false,
}: NoMovesFailFlowOptions): Promise<void> {
  if (activeNoMovesFailFlowToken !== null || busyEnding) {
    devLog('🛡️ NO MOVES request ignored because another terminal owner is active', {
      reason,
      activeNoMovesFailFlowToken,
      busyEnding,
    });
    return;
  }
  const initialSignature = buildNoMovesBoardSignature();
  // Terminal owner must re-check immediately before locking the game. A wild
  // charge/drop may become ready while an earlier caller awaits tutorial or FX.
  if (deferFailForWildContinuation(`no-moves-preflight:${reason}`)) {
    devLog('🛡️ No-moves preflight cancelled terminal fail because wild continuation became ready', { reason, wildMeter });
    return;
  }
  const preLockBlockReason = getNoMovesCommitBlockReason(initialSignature);
  if (preLockBlockReason) {
    deferNoMovesFailBeforeOwnership(reason, `pre-lock:${preLockBlockReason}`);
    return;
  }
  const flowToken = ++noMovesFailFlowSequence;
  activeNoMovesFailFlowToken = flowToken;
  devLog('⏳ Running no-moves fail flow before fail screen', { reason, waitMs, extraWaitMs });
  emitIOSSpecialTransactionTrace('no-moves-candidate', {
    token: flowToken,
    waitMs,
    extraWaitMs,
    ...getNoMovesTraceState(reason, 'candidate'),
  });
  // Keep gameplay responsive while the NO MOVES candidate is being confirmed.
  // A legal fast stack/merge changes the signature below and cancels this flow.
  // Input becomes terminal only at the atomic commit boundary.
  try { TILE_IDLE_BOUNCE.stop(); } catch {}
  try { cleanupFxContainersByTag('tile-idle-smoke'); } catch {}
  if (persistStuckState) {
    try { saveGameState(); } catch (_) {}
  }
  if (resetHint) {
    try { resetEndgameHint(); } catch {}
  }
  try { showNoMovesText(); } catch {}
  if (await waitTrackedResult(waitMs + Math.max(0, extraWaitMs)) === 'cancelled') {
    cancelNoMovesFailFlow(flowToken, reason, 'lifecycle-cancelled-before-commit');
    return;
  }

  const preCommitBlockReason = getNoMovesCommitBlockReason(initialSignature);
  if (preCommitBlockReason) {
    cancelNoMovesFailFlow(flowToken, reason, `pre-commit:${preCommitBlockReason}`);
    return;
  }

  if (typeof exitTimeoutMs === 'number' && exitTimeoutMs > 0) {
    try {
      const exitResult = await Promise.race([
        exitNoMovesText().then(() => 'exited' as const),
        waitTrackedResult(exitTimeoutMs).then((waitResult) => {
          if (waitResult === 'cancelled') return 'cancelled' as const;
          devWarn('⚠️ FAILFLOW: NO MOVES exit timed out - clearing overlay and continuing to fail modal', { reason });
          try { clearNoMovesText(); } catch {}
          return 'timeout' as const;
        })
      ]);
      if (exitResult === 'cancelled') {
        cancelNoMovesFailFlow(flowToken, reason, 'lifecycle-cancelled-during-exit');
        return;
      }
    } catch {
      try { clearNoMovesText(); } catch {}
    }
  } else {
    try { await exitNoMovesText(); } catch {}
  }

  const finalCommitBlockReason = getNoMovesCommitBlockReason(initialSignature);
  if (finalCommitBlockReason) {
    cancelNoMovesFailFlow(flowToken, reason, `final-commit:${finalCommitBlockReason}`);
    return;
  }

  if (activeNoMovesFailFlowToken !== flowToken) return;
  activeNoMovesInputLockToken = flowToken;
  failScreenFlowInProgress = true;
  busyEnding = true;
  try { (window as any).__ccTerminalEndScreenPending = true; } catch {}
  try { setInputGateLock('terminal-no-moves', true, { ttlMs: 12000, scope: 'all' }); } catch {}
  try { (window as any).__ccFailScreenPending = true; } catch {}
  emitIOSSpecialTransactionTrace('no-moves-lock-acquired', {
    token: flowToken,
    ...getNoMovesTraceState(reason, 'terminal-lock'),
  });

  // Close the tiny pointer-start race between the last unlocked recheck and
  // terminal ownership. If a drag began there, release only this flow's lock.
  const postLockBlockReason = getNoMovesCommitBlockReason(initialSignature);
  if (postLockBlockReason) {
    cancelNoMovesFailFlow(flowToken, reason, `post-lock:${postLockBlockReason}`);
    return;
  }

  activeNoMovesFailFlowToken = null;
  emitIOSSpecialTransactionTrace('no-moves-committed', {
    token: flowToken,
    ...getNoMovesTraceState(reason, 'commit'),
  });
  showFinalScreen({ confirmedFailFlow: true });
}


function createEmptyGrid() {
  return createEmptyGridHelper({
    ROWS,
    COLS,
    setGrid: (g) => { grid = g; },
    setStateGrid: (g) => { STATE.grid = g; },
  });
}

function syncSharedState() {
  syncSharedStateHelper({
    STATE,
    app,
    stage,
    board,
    boardBG,
    hud,
    grid,
    tiles,
    score,
    level,
    moves,
    boardNumber,
  });
  STATE.wildMeter = wildMeter;
  // 🔥 CRITICAL: Ensure STATE.boardNumber is always synced with local boardNumber
  // This ensures trackCubesCracked and other functions can access the correct board number
  if (STATE.boardNumber !== boardNumber) {
    STATE.boardNumber = boardNumber;
    devLog(`🔄 Synced STATE.boardNumber to ${boardNumber}`);
  }
  return STATE;
}

syncSharedState();
try { (window as any).__ccLogRuntimeStats = logRuntimeStats; } catch {}

const CORE_GAME_TEXTURE_ASSETS = [
  ASSET_TILE,
  ASSET_DRAG_SHADOW,
  ASSET_NUMBERS,
  ASSET_NUMBERS2,
  ASSET_NUMBERS3,
  ASSET_NUMBERS4,
  ASSET_WILD,
  ASSET_WILD_MAGNET,
  ASSET_WILD_JUICE,
  ASSET_WILD_TNT,
] as const;

const CORE_HUD_TEXTURE_ASSETS = [
  './assets/close-icon.png',
  './assets/hud/star-hud.png',
  './assets/hud/score-hud.png',
  './assets/hud/combo-hud.png',
  './assets/hud/extra-combo-hud.png',
  './assets/hud/mega-combo-hud.png',
  './assets/hud/help.png',
] as const;

const CORE_RENDER_TEXTURE_ASSETS = [
  ...CORE_GAME_TEXTURE_ASSETS,
  ...CORE_HUD_TEXTURE_ASSETS,
] as const;

const CORE_GPU_PROBE_ASSETS = [ASSET_TILE, ASSET_NUMBERS] as const;

function getRequiredCoreRenderTextureAssets(): string[] {
  const dpr = Math.max(1, Math.round(Number(window.devicePixelRatio) || 1));
  const ghostAsset = dpr >= 3
    ? './assets/ghost-placeholder@3x.png'
    : dpr >= 2
      ? './assets/ghost-placeholder@2x.png'
      : './assets/ghost-placeholder.png';
  const liveTiles = Array.isArray(STATE?.tiles) && STATE.tiles.length ? STATE.tiles : tiles;
  const activeSpecialAssets = liveTiles
    .filter((tile: any) => tile && !tile.destroyed && typeof tile.special === 'string' && tile.special.length > 0)
    .map((tile: any) => getTileBaseTextureAssetPath(tile))
    .filter(Boolean);
  return Array.from(new Set([...CORE_RENDER_TEXTURE_ASSETS, ghostAsset, ...activeSpecialAssets]));
}

function isUsableGameTexture(tex: any): boolean {
  return isUsablePixiImageTexture(tex);
}

function configureGameTextureSampling(tex: any): void {
  applyGameplayTextureFiltering(tex);
  pinPixiImageTexture(tex);
}

function isCoreHudTextureAsset(assetPath: string): boolean {
  return (CORE_HUD_TEXTURE_ASSETS as readonly string[]).includes(assetPath);
}

function isCoreGhostTextureAsset(assetPath: string): boolean {
  return assetPath.includes('/ghost-placeholder');
}

function shouldOptimizeAsGameTexture(assetPath: string): boolean {
  return (CORE_GAME_TEXTURE_ASSETS as readonly string[]).includes(assetPath);
}

let coreGhostTextureNeedsRebuild = false;

class CoreRenderTextureBarrierError extends Error {
  constructor(context: string, failedAssets: string[]) {
    super(`Core render textures unavailable (${context}): ${failedAssets.join(', ')}`);
    this.name = 'CoreRenderTextureBarrierError';
  }
}

function getUnusableRequiredCoreRenderTextureAssets(): string[] {
  return getRequiredCoreRenderTextureAssets().filter((assetPath) => {
    let tex: any = null;
    try { tex = Assets.get(assetPath); } catch {}
    return !isUsableGameTexture(tex);
  });
}

async function ensureCoreGameTexturesLoaded(
  context: string = 'unknown',
  forceReloadAssets: readonly string[] = [],
): Promise<string[]> {
  const requiredAssets = getRequiredCoreRenderTextureAssets();
  const forcedAssets = new Set(forceReloadAssets);
  const staleAssets = Array.from(new Set([
    ...getUnusableRequiredCoreRenderTextureAssets(),
    ...requiredAssets.filter((assetPath) => forcedAssets.has(assetPath)),
  ]));

  if (staleAssets.length > 0) devWarn('⚠️ Reloading stale/missing core game textures', { context, staleAssets });

  const waitForRetry = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const failedAssets = new Set<string>();

  for (const assetPath of requiredAssets) {
    let usable = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      let tex: any = null;
      try { tex = Assets.get(assetPath); } catch {}

      if ((forcedAssets.has(assetPath) && attempt === 0) || !isUsableGameTexture(tex)) {
        try {
          tex = await reloadPixiImageTexture(assetPath);
        } catch (error) {
          devWarn('⚠️ Core texture reload attempt failed', { context, assetPath, attempt: attempt + 1, error });
        }
      }

      if (isUsableGameTexture(tex)) {
        pinPixiImageTexture(tex);
        if (shouldOptimizeAsGameTexture(assetPath)) configureGameTextureSampling(tex);
        usable = true;
        break;
      }

      await waitForRetry(80 + attempt * 120);
    }

    if (!usable) {
      failedAssets.add(assetPath);
    }
  }

  if (failedAssets.size > 0) {
    const details = {
      context,
      failedAssets: Array.from(failedAssets),
    };
    devError('❌ Core render texture barrier failed; gameplay surface remains hidden', details);
    throw new CoreRenderTextureBarrierError(context, details.failedAssets);
  }

  if (staleAssets.some(isCoreGhostTextureAsset)) coreGhostTextureNeedsRebuild = true;

  return staleAssets;
}

function probeCoreGameTextureGpuPixels(context: string): {
  healthy: boolean;
  unavailable: boolean;
  failedAssets: string[];
} {
  const results = CORE_GPU_PROBE_ASSETS.map((assetPath) => {
    let texture: any = null;
    try { texture = Assets.get(assetPath); } catch {}
    return {
      assetPath,
      result: probePixiImageTextureGpuPixels(app?.renderer, texture),
    };
  });
  const failedAssets = results
    .filter(({ result }) => result.status === 'blank' || result.status === 'error')
    .map(({ assetPath }) => assetPath);
  const unavailable = results.every(({ result }) => result.status === 'unavailable');
  emitNativeConsoleDiagnostic('[CC_TEXTURE_HEALTH]', 'gpu-probe', {
    context,
    platform: MOBILE_RUNTIME_PROFILE.platform,
    results: results.map(({ assetPath, result }) => ({ assetPath, ...result })),
  });
  return { healthy: failedAssets.length === 0, unavailable, failedAssets };
}

async function ensureCoreRenderTexturesGpuReady(context: string): Promise<string[]> {
  const refreshedAssets = await ensureCoreGameTexturesLoaded(context);
  const firstProbe = probeCoreGameTextureGpuPixels(`${context}:before-repair`);
  if (firstProbe.healthy || firstProbe.unavailable) return refreshedAssets;

  hideGameplayForCoreTextureRecovery();
  const requiredAssets = getRequiredCoreRenderTextureAssets();
  emitNativeConsoleDiagnostic('[CC_TEXTURE_HEALTH]', 'forced-reload-start', {
    context,
    failedAssets: firstProbe.failedAssets,
    reloadCount: requiredAssets.length,
  });
  const forceRefreshedAssets = await ensureCoreGameTexturesLoaded(
    `${context}:gpu-repair`,
    requiredAssets,
  );
  refreshLiveCoreGameSpriteTextures(`${context}:gpu-repair`);
  const verification = probeCoreGameTextureGpuPixels(`${context}:after-repair`);
  if (!verification.healthy && !verification.unavailable) {
    emitNativeConsoleDiagnostic('[CC_TEXTURE_HEALTH]', 'forced-reload-failed', {
      context,
      failedAssets: verification.failedAssets,
    });
    throw new CoreRenderTextureBarrierError(`${context}:gpu-probe`, verification.failedAssets);
  }
  emitNativeConsoleDiagnostic('[CC_TEXTURE_HEALTH]', 'forced-reload-complete', {
    context,
    refreshedAssets: forceRefreshedAssets,
  });
  return Array.from(new Set([...refreshedAssets, ...forceRefreshedAssets]));
}

function getTileBaseTextureAssetPath(tile: any): string {
  const special = typeof tile?.special === 'string' ? tile.special : '';
  const specialFallback = special === 'wild-magnet'
    ? ASSET_WILD_MAGNET
    : special === 'wild-juice'
      ? ASSET_WILD_JUICE
      : special === 'wild-tnt'
        ? ASSET_WILD_TNT
        : special === 'wild'
          ? ASSET_WILD
          : '';
  if (specialFallback) return getSpecialDiceTexturePath(tile, specialFallback);
  const authoredPath = typeof tile?.base?._ccTextureAssetPath === 'string'
    ? tile.base._ccTextureAssetPath
    : '';
  if (authoredPath) return authoredPath;
  return (tile?.value | 0) > 0 ? ASSET_NUMBERS : ASSET_TILE;
}

function refreshLiveCoreGameSpriteTextures(reason: string = 'unknown'): void {
  try {
    const liveTiles = Array.isArray(STATE?.tiles) && STATE.tiles.length ? STATE.tiles : tiles;
    let rebound = 0;
    for (const tile of liveTiles as any[]) {
      if (!tile || tile.destroyed) continue;
      const host = tile.rotG && !tile.rotG.destroyed ? tile.rotG : tile;
      let base = tile.base && !tile.base.destroyed ? tile.base : null;
      if (!base && host?.children) {
        base = host.children.find((child: any) => child && !child.destroyed && child instanceof Sprite) || null;
      }
      let tileTextureRebound = false;
      if (!base && host?.addChildAt) {
        const assetPath = getTileBaseTextureAssetPath(tile);
        base = new Sprite(Assets.get(assetPath) || Texture.from(assetPath));
        (base as any)._ccTextureAssetPath = assetPath;
        base.anchor?.set?.(0.5);
        host.addChildAt(base, 0);
        tile.base = base;
        rebound++;
        tileTextureRebound = true;
      }
      if (!base || base.destroyed) continue;

      const assetPath = getTileBaseTextureAssetPath(tile);
      let tex: any = null;
      try { tex = Assets.get(assetPath); } catch {}
      if (!isUsableGameTexture(tex)) continue;
      if (base.texture !== tex || !isUsableGameTexture(base.texture)) {
        base.texture = tex;
        (base as any)._ccTextureAssetPath = assetPath;
        base.visible = true;
        base.alpha = Number.isFinite(base.alpha) && base.alpha > 0 ? base.alpha : 1;
        rebound++;
        tileTextureRebound = true;
      }
      if (tileTextureRebound && (tile.stackDepth || 0) > 1) {
        try { makeBoard.refreshStackVisual(tile); } catch {}
      }
    }
    if (rebound > 0) {
      devWarn('⚠️ Rebound live tile textures after cache refresh', { reason, rebound });
    }
  } catch (error) {
    devWarn('⚠️ Failed to refresh live core game sprite textures', { reason, error });
  }
}

try { (window as any).__ccEnsureCoreGameTexturesLoaded = ensureCoreGameTexturesLoaded; } catch {}

let coreTextureRecoveryPromise: Promise<void> | null = null;
let coreTextureRecoveryOwnerGeneration = -1;
let coreTextureRecoveryGeneration = 0;
let coreTextureContextCanvas: HTMLCanvasElement | null = null;
let coreTextureContextLostHandler: ((event: Event) => void) | null = null;
let coreTextureContextRestoredHandler: (() => void) | null = null;
let coreTextureVisibilityHandler: (() => void) | null = null;
let coreTexturePageShowHandler: (() => void) | null = null;
let coreTextureVisibilityBeforeLoss: { stage: boolean; board: boolean; hud: boolean } | null = null;
let coreTextureCanvasVisibilityBeforeHide: string | null = null;
let coreTextureNeedsFullRecovery = false;
const coreTextureForegroundOwner = new ForegroundResumeEpoch();

function hideGameplayForCoreTextureRecovery(): void {
  try { if (stage) stage.visible = false; } catch {}
  try { if (board) board.visible = false; } catch {}
  try { if (hud) hud.visible = false; } catch {}
  try { app?.renderer?.render?.(stage); } catch {}
  try {
    const canvas = app?.canvas as HTMLCanvasElement | undefined;
    if (canvas) {
      if (coreTextureCanvasVisibilityBeforeHide === null) {
        coreTextureCanvasVisibilityBeforeHide = canvas.style.visibility || '';
      }
      canvas.style.visibility = 'hidden';
    }
  } catch {}
}

function restoreCanvasAfterCoreTextureRecovery(): void {
  try {
    const canvas = app?.canvas as HTMLCanvasElement | undefined;
    if (canvas && coreTextureCanvasVisibilityBeforeHide !== null) {
      canvas.style.visibility = coreTextureCanvasVisibilityBeforeHide;
    }
  } catch {}
  coreTextureCanvasVisibilityBeforeHide = null;
}

function restoreHealthyForegroundSurface(): void {
  if (isGameplayEntryPending()) return;
  const visibility = coreTextureVisibilityBeforeLoss;
  if (stage && visibility) stage.visible = visibility.stage;
  if (board && visibility) board.visible = visibility.board;
  if (hud && visibility) hud.visible = visibility.hud;
  try { app?.renderer?.render?.(stage); } catch {}
  restoreCanvasAfterCoreTextureRecovery();
  coreTextureVisibilityBeforeLoss = null;
}

function recoverCoreRenderTextures(reason: string): Promise<void> {
  if (coreTextureRecoveryPromise && coreTextureRecoveryOwnerGeneration === coreTextureRecoveryGeneration) {
    return coreTextureRecoveryPromise;
  }
  const ownerGeneration = coreTextureRecoveryGeneration;
  const ownerApp = app;
  const ownerCanvas = coreTextureContextCanvas;
  const ownsCurrentLifecycle = () => (
    ownerGeneration === coreTextureRecoveryGeneration &&
    ownerApp === app &&
    ownerCanvas === coreTextureContextCanvas
  );
  const visibility = coreTextureVisibilityBeforeLoss || {
    stage: stage?.visible !== false,
    board: board?.visible !== false,
    hud: hud?.visible !== false,
  };
  hideGameplayForCoreTextureRecovery();

  const recoveryPromise = (async () => {
    const refreshedAssets = await ensureCoreRenderTexturesGpuReady(`recovery:${reason}`);
    if (!ownsCurrentLifecycle()) return;
    refreshLiveCoreGameSpriteTextures(`recovery:${reason}`);
    _hudInitDone = false;
    try { (window as any).__ccForceHudRecreateForTextures = true; } catch {}
    await layoutBoard();
    if (!ownsCurrentLifecycle()) return;
    refreshLiveCoreGameSpriteTextures(`recovery:${reason}:post-layout`);
    try { app?.renderer?.render?.(stage); } catch {}

    if (!isGameplayEntryPending()) {
      if (stage) stage.visible = visibility.stage;
      if (board) board.visible = visibility.board;
      if (hud) hud.visible = visibility.hud;
      try { app?.renderer?.render?.(stage); } catch {}
      restoreCanvasAfterCoreTextureRecovery();
    }
    devLog('✅ Core render texture recovery completed', { reason, refreshedAssets });
  })().catch((error) => {
    if (ownsCurrentLifecycle()) {
      hideGameplayForCoreTextureRecovery();
      devError('❌ Core render texture recovery failed; refusing to reveal a partial board', { reason, error });
    }
    throw error;
  }).finally(() => {
    if (coreTextureRecoveryPromise === recoveryPromise) {
      coreTextureRecoveryPromise = null;
      coreTextureRecoveryOwnerGeneration = -1;
    }
    if (ownerGeneration === coreTextureRecoveryGeneration) coreTextureVisibilityBeforeLoss = null;
  });
  coreTextureRecoveryOwnerGeneration = ownerGeneration;
  coreTextureRecoveryPromise = recoveryPromise;
  return recoveryPromise;
}

function detachCoreTextureContextRecovery(): void {
  coreTextureRecoveryGeneration += 1;
  if (coreTextureContextCanvas && coreTextureContextLostHandler) {
    try { coreTextureContextCanvas.removeEventListener('webglcontextlost', coreTextureContextLostHandler); } catch {}
  }
  if (coreTextureContextCanvas && coreTextureContextRestoredHandler) {
    try { coreTextureContextCanvas.removeEventListener('webglcontextrestored', coreTextureContextRestoredHandler); } catch {}
  }
  if (coreTextureVisibilityHandler) {
    try { document.removeEventListener('visibilitychange', coreTextureVisibilityHandler); } catch {}
  }
  if (coreTexturePageShowHandler) {
    try { window.removeEventListener('pageshow', coreTexturePageShowHandler); } catch {}
  }
  coreTextureContextCanvas = null;
  coreTextureContextLostHandler = null;
  coreTextureContextRestoredHandler = null;
  coreTextureVisibilityHandler = null;
  coreTexturePageShowHandler = null;
  coreTextureVisibilityBeforeLoss = null;
  coreTextureCanvasVisibilityBeforeHide = null;
  coreTextureNeedsFullRecovery = false;
  coreTextureForegroundOwner.invalidate();
}

function installCoreTextureContextRecovery(canvas: HTMLCanvasElement): void {
  if (coreTextureContextCanvas === canvas) return;
  detachCoreTextureContextRecovery();
  coreTextureContextCanvas = canvas;
  coreTextureContextLostHandler = (event: Event) => {
    try { event.preventDefault(); } catch {}
    const beganSuspension = coreTextureForegroundOwner.beginSuspension(app?.ticker?.started === true);
    coreTextureNeedsFullRecovery = true;
    try { app?.ticker?.stop?.(); } catch {}
    if (beganSuspension) {
      coreTextureVisibilityBeforeLoss = {
        stage: stage?.visible !== false,
        board: board?.visible !== false,
        hud: hud?.visible !== false,
      };
    }
    hideGameplayForCoreTextureRecovery();
    devWarn('⚠️ WebGL context lost; gameplay hidden until core textures recover');
  };
  const recoverAfterForeground = (reason: string) => {
    // A context can be restored while WKWebView is still backgrounded. Keep
    // the lease pending so the visible event performs the guarded recovery.
    if (document.hidden) return;
    const resumeLease = coreTextureForegroundOwner.consume();
    if (!resumeLease) return;
    const ownerCanvas = coreTextureContextCanvas;
    if (!ownerCanvas || ownerCanvas !== app?.canvas) return;
    const ownsResume = () => (
      coreTextureForegroundOwner.isCurrent(resumeLease) &&
      ownerCanvas === coreTextureContextCanvas &&
      ownerCanvas === app?.canvas
    );
    const unavailableAssets = getUnusableRequiredCoreRenderTextureAssets();
    const needsFullRepair = coreTextureNeedsFullRecovery
      || reason === 'webglcontextrestored'
      || unavailableAssets.length > 0;
    const recovery = needsFullRepair
      ? recoverCoreRenderTextures(reason)
      : Promise.resolve()
          .then(() => ensureCoreRenderTexturesGpuReady(`foreground-fast:${reason}`))
          .then((refreshedAssets) => {
            if (!ownsResume()) return;
            if (refreshedAssets.length > 0) return recoverCoreRenderTextures(`${reason}:gpu-repair`);
            refreshLiveCoreGameSpriteTextures(`foreground-fast:${reason}`);
            restoreHealthyForegroundSurface();
            devLog('✅ Healthy foreground texture validation completed without HUD/layout rebuild', { reason });
          });
    void recovery
      .then(() => {
        if (!ownsResume() || document.hidden) return;
        coreTextureNeedsFullRecovery = false;
        if (resumeLease.resumeTicker && app?.ticker && !app.ticker.started) {
          app.ticker.start();
        }
      })
      .catch((error) => {
        if (!ownsResume()) return;
        devError('❌ Foreground texture recovery failed; gameplay remains hidden', { reason, error });
      });
  };
  coreTextureContextRestoredHandler = () => recoverAfterForeground('webglcontextrestored');
  coreTextureVisibilityHandler = () => {
    if (document.hidden) {
      if (!coreTextureForegroundOwner.beginSuspension(app?.ticker?.started === true)) return;
      coreTextureVisibilityBeforeLoss = {
        stage: stage?.visible !== false,
        board: board?.visible !== false,
        hud: hud?.visible !== false,
      };
      try { app?.ticker?.stop?.(); } catch {}
      hideGameplayForCoreTextureRecovery();
      return;
    }
    recoverAfterForeground('visibility-foreground');
  };
  coreTexturePageShowHandler = () => recoverAfterForeground('pageshow');
  canvas.addEventListener('webglcontextlost', coreTextureContextLostHandler, false);
  canvas.addEventListener('webglcontextrestored', coreTextureContextRestoredHandler, false);
  document.addEventListener('visibilitychange', coreTextureVisibilityHandler, false);
  window.addEventListener('pageshow', coreTexturePageShowHandler, false);
}

try {
  (window as any).__ccRecoverCoreRenderTextures = (reason = 'external') => recoverCoreRenderTextures(String(reason));
} catch {}

function resetGlobalFxLayer(reason: string = 'unknown') {
  try {
    const fxLayer = (window as any).__ccGlobalFxLayer;
    if (fxLayer) {
      try { if (fxLayer.parent) fxLayer.parent.removeChild(fxLayer); } catch {}
      try { fxLayer.destroy?.({ children: true }); } catch {}
      delete (window as any).__ccGlobalFxLayer;
      devLog('🧹 resetGlobalFxLayer:', reason);
    }
  } catch (e) {
    devWarn('⚠️ resetGlobalFxLayer failed:', e);
  }
}

function logRuntimeStats(reason: string = 'unknown'): void {
  try {
    const cleanupStats = getAppCleanupStats();
    const activeTiles = getReactiveActiveTiles(tiles);
    const rendererAny = app?.renderer as any;
    const textureCount = (typeof rendererAny?.texture?.managedTextures !== 'undefined')
      ? (rendererAny.texture.managedTextures?.length ?? (rendererAny.texture.managedTextures?.size ?? 0))
      : (typeof rendererAny?.textureGC !== 'undefined' ? (rendererAny.textureGC?.getManagedTextures?.()?.length ?? 0) : 0);
    const cache = (Assets as any)?.cache;
    const cacheSize = cache && typeof (cache as { size?: number }).size === 'number' ? (cache as { size: number }).size : (cache && typeof cache === 'object' ? (cache instanceof Map ? cache.size : Object.keys(cache).length) : 0);
    const gsapTweens = typeof (gsap as any).getAllTweens === 'function' ? (gsap as any).getAllTweens().length : 0;
    const mmStats = typeof (memoryManager as any).getMemoryInfo === 'function' ? (memoryManager as any).getMemoryInfo() : null;
    const perfMem = (performance as any).memory ? {
      usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
      totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
    } : null;
    const snapshot: Record<string, unknown> = {
      reason,
      cleanupStats,
      stage: { hasStage: !!stage, stageVisible: !!stage?.visible, stageChildren: stage?.children?.length ?? 0 },
      board: { hasBoard: !!board, boardVisible: !!board?.visible, boardChildren: board?.children?.length ?? 0 },
      tiles: { count: tiles?.length ?? 0, active: activeTiles.length },
      renderer: { hasRenderer: !!app?.renderer, textureCount },
      assetsCache: cacheSize,
      gsapTweens,
      memoryManager: mmStats,
      performanceMemory: perfMem
    };
    devLog(`🧪 DEV LOG (${reason}):`, snapshot);
    const short = { reason, stageChildren: (snapshot.stage as any)?.stageChildren, tilesActive: (snapshot.tiles as any)?.active, textureCount: (snapshot.renderer as any)?.textureCount, gsapTweens: snapshot.gsapTweens, heapMB: perfMem ? Math.round(perfMem.usedJSHeapSize / 1024 / 1024) : null };
    console.log(`🧪 CC runtime [${reason}]:`, short);
  } catch (e) {
    devWarn(`⚠️ DEV LOG (${reason}) snapshot failed:`, e);
  }
}

function cleanupFxForBoardReset(reason: string = 'unknown') {
  devLog('🧹 cleanupFxForBoardReset:', reason);
  const isPlayAgainCleanup = reason.includes('play-again');
  const isNavCleanup =
    typeof reason === 'string' &&
    (reason.includes('nav:') || reason.includes('cc-navigation') || reason.includes('journey') || reason.includes('settings') || reason.includes('collectibles'));
  const shouldClearPools = reason.includes('cleanupGame') || reason.includes('restartGame');
  if (isNavCleanup || shouldClearPools) {
    try { (drag as any)?.cleanup?.({ resumeIdle: false }); } catch {}
  }
  try { cleanupTntBoomArtifacts(`fx:${reason}`); } catch {}
  try { cleanupAllTntIdleEffects?.(`fx:${reason}`); } catch {}
  try { killAllDelayedCalls?.(); } catch {}
  try { destroyAllGraphicsObjects?.(); } catch {}
  try { cleanupAllFxContainers?.(); } catch {}
  try {
    if (isPlayAgainCleanup) {
      forceCleanupAllStarAnimations?.();
    } else {
      cleanupExistingStarAnimations?.();
    }
  } catch {}
  try { stopTntAnimation?.(); } catch {}
  try { stopMagneticText?.(); } catch {}
  try { stopSparkleText?.(); } catch {}
  try { stopWildJuiceBubblesScreen?.(); } catch {}
  // 🔥 Safety: kill active magnet pull animations on cleanup
  try {
    const magnetCleanup = (window as any).__ccActiveMagnetPullCleanup;
    if (typeof magnetCleanup === 'function') {
      magnetCleanup();
      (window as any).__ccActiveMagnetPullCleanup = null;
    }
  } catch {}
  if (isNavCleanup || reason.includes('cleanupGame') || reason.includes('restartGame')) {
    try { killTrackedGsapTickers(`fx:${reason}`); } catch {}
    try { clearAllAppTimeouts(); } catch {}
    try { clearAllAppAnimationFrames(); } catch {}
    try { clearAllAppIntervals(); } catch {}
    try { clearAllAppListeners(); } catch {}
    if (shouldClearPools) {
      try {
        import('./dom-element-pool.js').then((m) => {
          try { m.domElementPool?.clear?.(); } catch {}
        }).catch(() => {});
      } catch {}
      try {
        import('./object-pool.js').then((m) => {
          try { m.graphicsPool?.clear?.(); } catch {}
        }).catch(() => {});
      } catch {}
    }
  }
  // 🔥 Stability: stop per-tile idle FX to avoid lingering tickers/intervals
  try {
    const tileList = (STATE && STATE.tiles && STATE.tiles.length) ? STATE.tiles : tiles;
    if (tileList && tileList.length) {
      tileList.forEach((t: any) => {
        try { stopWildIdle?.(t); } catch {}
        try { stopWildShimmer?.(t); } catch {}
        try { stopWildStars?.(t); } catch {}
        try { stopWildJuiceBubbles?.(t); } catch {}
        try { stopMagnetIdleParticles?.(t); } catch {}
        try { stopTntIdleParticles?.(t); } catch {}
        try { stopTntIdleShake?.(t); } catch {}
        if ((t as any)?._glowAnimation) {
          try { (t as any)._glowAnimation.kill?.(); } catch {}
          try { (t as any)._glowAnimation = null; } catch {}
        }
      });
    }
  } catch {}
  try {
    const isBoardTransitionActive = (window as any).__ccBoardTransitionActive === true;
    const isFromInterimBoard = (window as any).__ccFromInterimBoard === true || (window as any).__ccIsInterimBoard === true;
    const isRecentlyStarted = typeof isWildJuiceBubblesExplosionRecentlyStarted === 'function' && isWildJuiceBubblesExplosionRecentlyStarted();
    if (isNavCleanup) {
      try { forceStopWildJuiceBubblesExplosion?.(); } catch {}
      try { stopWildJuiceBubblesExplosion?.(); } catch {}
      try { stopWildJuiceBubblesScreen?.(); } catch {}
    } else if (!isBoardTransitionActive && !isFromInterimBoard && !isRecentlyStarted) {
      stopWildJuiceBubblesExplosion?.();
    } else {
      devLog('⏸️ cleanupFxForBoardReset: Skipping bubble explosion cleanup', {
        reason,
        isBoardTransitionActive,
        isFromInterimBoard,
        isRecentlyStarted
      });
      // Defensive: ensure explosion is stopped after transition settles
      trackDelayedCall(0.5, () => {
        try {
          const stillTransitioning = (window as any).__ccBoardTransitionActive === true;
          if (stillTransitioning || (typeof isWildJuiceBubblesExplosionActive === 'function' && isWildJuiceBubblesExplosionActive())) {
            forceStopWildJuiceBubblesExplosion?.();
          }
        } catch {}
      });
    }
  } catch {}
  try { resetGlobalFxLayer(`fx:${reason}`); } catch {}
  try {
    import('./confetti-system.js').then(confettiModule => {
      if (confettiModule && typeof confettiModule.stopConfettiSpawns === 'function') {
        confettiModule.stopConfettiSpawns();
      }
    }).catch(() => {});
  } catch {}
  try { (window as any).__ccLastFxCleanupAt = Date.now(); } catch {}
}

/**
 * 🔥 MEMORY SPIKE FIX: Destroy old board tiles before starting new board.
 * Call AFTER hideApp (ticker stopped) and softResetBoardView.
 * Reduces peak memory during board transition (avoids old + new tiles in memory at once).
 */
function destroyOldBoardForTransition(reason: string = 'unknown'): void {
  try {
    devLog('🧹 destroyOldBoardForTransition:', reason);
    const tileList = (STATE?.tiles && STATE.tiles.length) ? STATE.tiles : tiles;
    if (!tileList || tileList.length === 0) {
      devLog('🧹 destroyOldBoardForTransition: No tiles to destroy');
      return;
    }
    const count = tileList.length;
    tileList.forEach((t: any) => {
      try { stopSpecialDiceIdleMotion(t); } catch {}
      try { stopWildIdle?.(t); } catch {}
      try { stopWildShimmer?.(t); } catch {}
      try { stopWildStars?.(t); } catch {}
      try { stopWildJuiceBubbles?.(t); } catch {}
      try { stopMagnetIdleParticles?.(t); } catch {}
      try { stopTntIdleParticles?.(t); } catch {}
      try { stopTntIdleShake?.(t); } catch {}
      try {
        gsap.killTweensOf(t);
        gsap.killTweensOf(t?.scale);
        if ((t as any)?._idleBounceTl) {
          try { (t as any)._idleBounceTl.kill(); } catch {}
          (t as any)._idleBounceTl = null;
        }
        if ((t as any)?._glowAnimation) {
          try { (t as any)._glowAnimation.kill?.(); } catch {}
          (t as any)._glowAnimation = null;
        }
      } catch {}
      try {
        if (typeof (window as any).killTileAnimations === 'function') {
          (window as any).killTileAnimations(t);
        }
      } catch {}
      try {
        if (t && !t.destroyed) {
          t.destroy({ children: true, texture: false, textureSource: false } as any);
        }
      } catch {}
    });
    tiles.length = 0;
    if (STATE.tiles) STATE.tiles.length = 0;
    devLog('🧹 destroyOldBoardForTransition: Destroyed', count, 'tiles');
  } catch (e) {
    devWarn('⚠️ destroyOldBoardForTransition failed:', e);
  }
}

function cleanupTexturesForBoardTransition(reason: string = 'unknown', aggressiveUnknown: boolean = false, skipCacheClear: boolean = false) {
  try {
    const renderer = app?.renderer || (STATE as any)?.app?.renderer;
    const managed = renderer?.texture?.managedTextures;
    const preCount = managed ? (managed.size || Object.keys(managed).length) : 0;

    // managedTextures dev logs removed (no longer needed)

    // Stop/clear bubble resources that generate runtime textures
    try { stopWildJuiceBubblesScreen?.(); } catch {}
    try { destroyWildJuiceBubblesExplosionCache?.(); } catch {}
    try { destroyWildJuiceBubblesScreenCache?.(); } catch {}

    // Destroy registered runtime textures (generated from canvas/graphics)
    // 🔥 CRITICAL: Skip when skipCacheClear - stage/HUD may still reference these textures.
    // Destroying them causes "Cannot read properties of null (reading 'addressModeU')" when
    // renderer tries to bind texture during next frame. Runtime textures will be pruned by
    // textureGC or cleared on next hard reset.
    if (!skipCacheClear) {
      try {
        const runtimeTextures = (window as any).__ccRuntimeTextures;
        if (runtimeTextures) {
          if (typeof runtimeTextures.forEach === 'function') {
            runtimeTextures.forEach((tex: any) => {
              try { tex?.destroy?.(true); } catch {}
            });
            try { runtimeTextures.clear?.(); } catch {}
          } else if (Array.isArray(runtimeTextures)) {
            runtimeTextures.forEach((tex: any) => {
              try { tex?.destroy?.(true); } catch {}
            });
            (window as any).__ccRuntimeTextures = [];
          }
        }
      } catch {}
    }

    // Prune destroyed/runtime textures from PIXI Assets cache (prevents stale refs)
    try {
      const cache = (Assets as any)?.cache;
      if (cache) {
        const isRuntimeLabel = (label: unknown) =>
          typeof label === 'string' && label.startsWith('runtime:');
        const shouldPruneTexture = (tex: any) => {
          if (!tex) return false;
          if (tex.destroyed) return true;
          if (isRuntimeLabel(tex.label)) return true;
          const src = tex.source || tex.baseTexture || {};
          if (isRuntimeLabel(src.label)) return true;
          if (src.valid === false) return true;
          return false;
        };
        let pruned = 0;
        if (cache instanceof Map) {
          for (const [key, value] of cache.entries()) {
            if (value instanceof Texture && shouldPruneTexture(value)) {
              cache.delete(key);
              pruned++;
            }
          }
        } else if (typeof cache === 'object') {
          Object.keys(cache).forEach(key => {
            const value = (cache as any)[key];
            if (value instanceof Texture && shouldPruneTexture(value)) {
              try { delete (cache as any)[key]; } catch {}
              pruned++;
            }
          });
        }
        if (pruned > 0) {
          devLog('🧹 Assets cache pruned runtime/destroyed textures', { reason, pruned });
        }
      }
    } catch {}

    // Destroy unknown runtime textures ONLY when explicitly enabled (safety: avoid destroying in-use textures)
    try {
      const allowUnknown = (window as any).__ccUnknownTextureCleanup === true;
      if (allowUnknown && managed) {
        let destroyed = 0;
        const destroyIfUnknown = (tex: any) => {
          try {
            if (!tex || tex.destroyed) return;
            const src = tex.source || tex.baseTexture || {};
            const label = tex.label || src.label || '';
            const url = src.resource?.url || src.resource?.src || src.resource?.source?.currentSrc || '';
            const width = tex.width || src.width || 0;
            const height = tex.height || src.height || 0;
            if (label || url) return;
            if (width <= 1 && height <= 1) return; // Keep EMPTY/WHITE
            if (width > 256 || height > 256) return; // Avoid large assets
            if (!aggressiveUnknown && (width > 64 || height > 64)) return;
            tex.destroy?.(true);
            destroyed++;
          } catch {}
        };
        if (managed instanceof Map) {
          managed.forEach((value: any, key: any) => {
            const tex = value?.texture || value || key;
            destroyIfUnknown(tex);
          });
        } else if (typeof managed === 'object') {
          Object.keys(managed).forEach(k => {
            destroyIfUnknown((managed as any)[k]);
          });
        }
        if (destroyed > 0) {
          devLog('🧹 Destroyed unknown runtime textures', { reason, destroyed });
        }
      }
    } catch {}
    
    // Ask PIXI to GC textures where possible
    try { renderer?.textureGC?.run?.(); } catch {}
    
    // Clear texture cache + unused base textures (skip when skipCacheClear - avoids addressModeU crash
    // when stage may still reference textures during board transition)
    if (!skipCacheClear) {
      try {
        const pixiUtils = (window.PIXI && (window.PIXI.utils as any)) || null;
        if (pixiUtils) {
          // 🔥 CRITICAL FIX: Stop renderer before clearing texture cache to prevent addressModeU errors
          // This ensures textures aren't being accessed during cleanup
          const shouldStopRenderer = renderer && renderer.runners && typeof renderer.runners.postrender === 'object';
          if (shouldStopRenderer && renderer.ticker) {
            try {
              renderer.ticker.stop();
            } catch {}
          }
          
          if (typeof pixiUtils.clearTextureCache === 'function') {
            pixiUtils.clearTextureCache();
          } else if (typeof pixiUtils.destroyTextureCache === 'function') {
            pixiUtils.destroyTextureCache();
          }
          const baseTextureCache = pixiUtils.BaseTextureCache;
          if (baseTextureCache) {
            const toRemove: string[] = [];
            for (const [key, baseTexture] of Object.entries(baseTextureCache)) {
              try {
                const bt = baseTexture as any;
                // 🔥 CRITICAL FIX: Check if texture is still referenced before destroying
                // Only destroy if textureCacheIds is empty AND texture is not currently bound
                if (bt && (!bt.textureCacheIds || bt.textureCacheIds.length === 0)) {
                  // Additional safety check: verify texture is not in use
                  const isInUse = renderer && renderer.texture && renderer.texture.boundTextures
                    ? Array.from(renderer.texture.boundTextures.values()).some((boundTex: any) => 
                        boundTex === bt || boundTex?.baseTexture === bt
                      )
                    : false;
                  
                  if (!isInUse && typeof bt.destroy === 'function') {
                    bt.destroy();
                    toRemove.push(key as string);
                  }
                }
              } catch {}
            }
            toRemove.forEach(key => {
              try { delete baseTextureCache[key]; } catch {}
            });
          }
          
          // Restart renderer if we stopped it
          if (shouldStopRenderer && renderer.ticker) {
            try {
              renderer.ticker.start();
            } catch {}
          }
        }
      } catch {}
    }
    
    const postCount = managed ? (managed.size || Object.keys(managed).length) : 0;
    if (preCount || postCount) {
      devLog('🧹 Texture cleanup (board transition):', { reason, preCount, postCount });
    }
  } catch (e) {
    devWarn('⚠️ cleanupTexturesForBoardTransition failed:', e);
  }
}

function installRuntimeTextureHooks() {
  if (__ccRuntimeTextureHooksInstalled) return;
  __ccRuntimeTextureHooksInstalled = true;
  try {
    const origFrom = (Texture as any).from;
    if (origFrom && !(origFrom as any).__ccWrapped) {
      const wrapped = function(source: any, options?: any) {
        const tex = origFrom.call(this, source, options);
        try {
          const isCanvas = (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) ||
                           (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas);
          if (isCanvas && tex && !tex.label) {
            const w = source?.width || 0;
            const h = source?.height || 0;
            tex.label = `runtime:Texture.from:${w}x${h}`;
            const texSrc = (tex as { source?: { label?: string }; baseTexture?: { label?: string } }).source ?? tex.baseTexture;
            if (texSrc) texSrc.label = tex.label;
            const rt = (window as any).__ccRuntimeTextures || ((window as any).__ccRuntimeTextures = new Set());
            rt.add?.(tex);
          }
        } catch {}
        return tex;
      };
      (wrapped as any).__ccWrapped = true;
      (Texture as any).from = wrapped;
    }
  } catch {}
}

function killAllGsapTweensCommon(tilesList: any[] | null, label: string, _opts: { clearTimeline?: boolean } = {}) {
  try {
    devLog(`🧹 GSAP cleanup (${label})...`);
    const animationStatsBefore = animationManager.getStats();
    // Do not clear the application-wide animation registry here.
    // Journey, cards, modals and gameplay share that registry, while this
    // cleanup owns only the retiring board. Feature owners and the exact
    // Pixi subtree cleanup below retire gameplay animations safely.
    const animationStatsAfter = animationManager.getStats();
    try {
      (window as any).__ccLastAnimationCleanup = {
        label,
        before: animationStatsBefore,
        after: animationStatsAfter,
        at: Date.now(),
      };
    } catch {}
    
    // Kill UI element tweens
    gsap.killTweensOf('[data-wild-loader]');
    gsap.killTweensOf('.wild-loader');
    
    const list = tilesList || [];
    if (list.length > 0) {
      list.forEach(tile => {
        try {
          if (tile && !tile.destroyed) {
            killPixiGsapSubtree(gsap, tile);
            if (tile.hover && !tile.hover.destroyed) {
              gsap.killTweensOf(tile.hover);
            }
          }
        } catch {}
      });
    }
    
    // Kill HUD/board/stage tweens
    if (HUD && !HUD.isHUDDestroyed?.()) {
      try { gsap.killTweensOf(HUD); } catch {}
    }
    if (board && !board.destroyed) {
      try { gsap.killTweensOf(board); } catch {}
    }
    if (app && app.stage && !app.stage.destroyed) {
      try { gsap.killTweensOf(app.stage); } catch {}
    }
    if (backgroundLayer && !backgroundLayer.destroyed) {
      try { gsap.killTweensOf(backgroundLayer); } catch {}
    }
    
    killInvalidPixiGsapTweens(gsap);
    
    devLog(`✅ GSAP cleanup complete (${label})`);
  } catch (e) {
    devLog('⚠️ GSAP cleanup error:', e);
  }
}

function logBoardExitStats(label: string) {
  try {
    const mmStats = typeof (memoryManager as any).getMemoryInfo === 'function'
      ? (memoryManager as any).getMemoryInfo()
      : null;
    const animStats = typeof (animationManager as any).getStats === 'function'
      ? (animationManager as any).getStats()
      : null;
    const pixiUtils = (window as any).PIXI?.utils || null;
    const texCache = pixiUtils?.TextureCache ? Object.keys(pixiUtils.TextureCache).length : null;
    const baseCache = pixiUtils?.BaseTextureCache ? Object.keys(pixiUtils.BaseTextureCache).length : null;
    const runtimeTextures = (window as any).__ccRuntimeTextures?.size ?? null;

    devLog(`🧪 Board exit stats (${label})`, {
      memoryManager: mmStats,
      animationManager: animStats,
      pixiCache: { texture: texCache, baseTexture: baseCache },
      runtimeTextures
    });
  } catch (e) {
    devWarn('⚠️ Board exit stats failed:', e);
  }
}

function softResetBoardView(reason: string = 'unknown') {
  devLog('♻️ softResetBoardView:', reason);
  _hudInitDone = false; // 🔥 CRITICAL: Force layoutBoard to re-init HUD after board transition
  // Kill tweens on board/hud containers
  try { if (board) gsap.killTweensOf(board); } catch {}
  try { if (hud) gsap.killTweensOf(hud); } catch {}
  // Clear board/hud containers
  try { if (board) board.removeChildren(); } catch {}
  try { if (hud) hud.removeChildren(); } catch {}
  // Recreate core containers if missing
  if (!stage) stage = app?.stage;
  if (stage && stage.sortableChildren !== undefined) stage.sortableChildren = true;
  if (!board) { board = new Container(); board.sortableChildren = true; }
  if (!hud) { hud = new Container(); hud.eventMode = 'none'; }
  if (!boardBG) boardBG = new Graphics();
  // Ensure visibility
  board.visible = true; board.alpha = 1; board.renderable = true;
  hud.visible = true; hud.alpha = 1; hud.renderable = true;
  board.zIndex = 100; hud.zIndex = 10000;
  // Ensure in stage
  if (stage && board.parent !== stage) stage.addChild(board);
  if (stage && hud.parent !== stage) stage.addChild(hud);
  // Ensure boardBG
  try { board.addChildAt(boardBG, 0); } catch {}
  try { boardBG.zIndex = -1000; board.sortChildren?.(); } catch {}
  // Reset background references so startLevel can recreate safely
  backgroundLayer = null;
  window._ghostPlaceholders = null;
}

// HUD metrics (for DOM helpers to position UI under HUD)
let __hudMetrics: HudMetrics = { top: 0, bottom: 80 };
function getWildSpawnAnimationBlockReason(): string | null {
  try {
    if (busyEnding) return 'busyEnding';
    if ((window as any).__ccBoardTransitionActive === true) return 'board-transition';
    if ((window as any).__ccFailScreenPending === true) return 'fail-screen-pending';
    // The visual-tail input exception is deliberately ordinary-only. A full
    // meter may be earned by that stack, but its wild drop must wait until the
    // previous special transaction releases immutable board ownership.
    if (specialDiceTransactionOwner.isActive()) return 'special-transaction';
    const guard = getEndgameGuardState();
    if (guard.active) return `endgame-guard:${guard.sources.join(',') || 'ttl'}`;
    if (merge6SpawnInProgress) return 'merge6-spawn-in-progress';
    if (regularMergeHandoffTokens.size > 0) return 'regular-merge-handoff';
    // A regular merge-6 owns its visible destination until the merge-cell
    // cleanup and replacement spawn have been scheduled. If the same merge
    // fills the wild meter, letting the reward drop start in this window races
    // the special FX against the still-locked value-6 tile.
    const hasRegularMerge6Handoff = Array.isArray(STATE?.tiles) &&
      STATE.tiles.some((tile: any) => merge6DestinationCleanupOwner.hasClaim(tile));
    if (hasRegularMerge6Handoff) return 'regular-merge6-handoff';
    if (wildMagnetPullInProgress) return 'wild-magnet-pull';
    const sinceBoardMutation = lastEndgameBoardMutationAt ? Date.now() - lastEndgameBoardMutationAt : Infinity;
    if (sinceBoardMutation < WILD_SPAWN_BOARD_SETTLE_MS) return 'board-settling';
    const hasMagnetAffectedTiles = Array.isArray(STATE?.tiles)
      && STATE.tiles.some((tile: any) => tile && !tile.destroyed && tile._wildMagnetAffected === true);
    if (hasMagnetAffectedTiles) return 'wild-magnet-affected-tiles';
    const hasTransientTiles = Array.isArray(STATE?.tiles)
      && STATE.tiles.some((tile: any) => tile && !tile.destroyed && (
        tile._ccWildSpawnDropping === true ||
        tile._ccWildSpawnHandoffLock === true ||
        tile._ccSpawnAnimating === true ||
        tile._spawnAnimating === true ||
        tile._isSpawning === true
      ));
    if (hasTransientTiles) return 'tile-transient-animation';
    if ((window as any).__ccWildSpawnDropInProgress === true) return 'wild-spawn-drop';
  } catch {}
  return null;
}

function beginRegularMergeHandoff(): number {
  const token = ++regularMergeHandoffSequence;
  regularMergeHandoffTokens.add(token);
  lastEndgameBoardMutationAt = Date.now();
  // Navigation/interruption normally clears the whole token set. This bounded
  // fallback must finalize the accepted board mutation before it can release
  // a full wild meter into the board.
  trackAppTimeout(() => {
    if (!regularMergeHandoffTokens.has(token)) return;
    const finalize = regularMergeHandoffFinalizers.get(token);
    if (finalize) {
      devWarn('⚠️ Regular merge handoff timed out; atomically finalizing accepted stack', { token });
      finalize();
      return;
    }
    devWarn('⚠️ Regular merge handoff timed out before finalizer registration; keeping spawn blocked', { token });
  }, 2000);
  return token;
}

function registerRegularMergeHandoffFinalizer(token: number | null, finalize: () => void): void {
  if (token === null || !regularMergeHandoffTokens.has(token)) return;
  regularMergeHandoffFinalizers.set(token, finalize);
}

function releaseRegularMergeHandoff(token: number | null, reason: string): void {
  if (token === null || !regularMergeHandoffTokens.delete(token)) return;
  regularMergeHandoffFinalizers.delete(token);
  lastEndgameBoardMutationAt = Date.now();
  queueWildSpawnAfterGuardRelease(`regular-merge-handoff:${reason}`);
}

function scheduleWildSpawnRetry(reason: string, delayMs = 220): void {
  if (wildSpawnRetryTimer) return;
  if (!shouldScheduleWildSpawnRetry(reason)) return;
  devLog('⏸️ Wild spawn delayed - active animation guard:', reason);
  wildSpawnRetryTimer = trackAppTimeout(() => {
    wildSpawnRetryTimer = null;
    queueWildSpawnAfterGuardRelease(`retry:${reason}`);
  }, delayMs);
}

function queueWildSpawnAfterGuardRelease(reason: string): void {
  const initialDecision = resolveWildSpawnGuardReleaseContinuation({ wildMeter, busyEnding });
  if (initialDecision.action !== 'queue') return;
  Promise.resolve().then(() => {
    const decision = resolveWildSpawnGuardReleaseContinuation({ wildMeter, busyEnding });
    if (decision.action !== 'queue') return;
    try {
      queueWildSpawnIfNeeded();
    } catch (error) {
      devWarn('⚠️ Failed to queue wild spawn after guard release:', { reason, error });
    }
  });
}

function resetWildMeterState(reason: string, { resetHud = true, animate = false }: { resetHud?: boolean; animate?: boolean } = {}): void {
  wildMeter = 0;
  STATE.wildMeter = 0;
  try { resetWildProgress(0, animate); } catch {}
  if (resetHud) {
    try {
      if (typeof HUD.resetWildMeter === 'function') {
        HUD.resetWildMeter(true);
      } else {
        HUD.updateProgressBar?.(0, animate);
      }
    } catch (error) {
      devWarn('⚠️ resetWildMeterState failed', { reason, error });
    }
  }
}

function cancelPendingWildContinuation(reason: string): void {
  wildSpawnCancelToken++;
  wildSpawnInProgress = false;
  try {
    if (wildSpawnRetryTimer) {
      clearTimeout(wildSpawnRetryTimer);
      wildSpawnRetryTimer = null;
    }
  } catch {}

  resetWildMeterState(`cancel-pending-wild:${reason}`);
  try { cleanupWildSpawnDropAnimations(); } catch {}
  try { (window as any).__ccWildSpawnDropActiveCount = 0; } catch {}
  try { (window as any).__ccWildSpawnDropInProgress = false; } catch {}
  devLog('🧹 Pending wild continuation cancelled:', reason);
}

function queueWildSpawnIfNeeded(){
  const activeAnimationBlockReason = getWildSpawnAnimationBlockReason();
  const permission = resolveWildSpawnPermission({
    tiles: STATE.tiles,
    wildMeter,
    boardWildSpawnEnabled: isWildSpawnEnabled(boardNumber),
    boardWildMeterEnabled: isWildMeterEnabled(boardNumber),
    wildSpawnInProgress,
    busyEnding,
    boardTransitionActive: (window as any).__ccBoardTransitionActive === true,
    failScreenPending: (window as any).__ccFailScreenPending === true,
    activeAnimationBlockReason,
    devLog,
  });
  if (permission.action === 'retry') {
    scheduleWildSpawnRetry(permission.reason, permission.retryDelayMs);
    return;
  }
  if (permission.action === 'block') {
    if (permission.reason !== 'wild-meter-not-ready' && permission.reason !== 'wild-spawn-in-progress') {
      devLog('⏸️ queueWildSpawnIfNeeded blocked:', permission.reason);
    }
    return;
  }

  devLog('🎯 Wild meter ready – queueing wild spawn');
  wildSpawnInProgress = true;

  try { HUD.shimmerProgress?.(); } catch {}

  spawnWildFromMeter()
    .then((spawned) => {
      if (!spawned && isWildMeterReady(wildMeter) && !wildSpawnRetryTimer) {
        wildSpawnRetryTimer = trackAppTimeout(() => {
          wildSpawnRetryTimer = null;
          queueWildSpawnAfterGuardRelease('wild-spawn-not-spawned');
        }, 600);
      }
    })
    .catch((error) => {
      logger.error('❌ Wild spawn error', 'app-core', error);
    })
    .finally(() => {
      wildSpawnInProgress = false;
      if (isWildMeterReady(wildMeter) && !wildSpawnRetryTimer) {
        queueWildSpawnAfterGuardRelease('wild-spawn-finished');
      }
      
      // Save game state after wild spawn completes
      debouncedSaveGameState(400);
    });
}

function isWildContinuationPendingForFail(): boolean {
  return isWildContinuationPending({
    wildMeter,
    wildSpawnInProgress,
    wildSpawnRetryPending: wildSpawnRetryTimer !== null,
    wildSpawnDropInProgress: (window as any).__ccWildSpawnDropInProgress === true,
  });
}

function deferFailForWildContinuation(reason: string): boolean {
  if (!isWildContinuationPendingForFail()) return false;

  devWarn('🛡️ Deferring fail screen - wild continuation pending', {
    reason,
    wildMeter,
    wildSpawnInProgress,
    hasRetryTimer: wildSpawnRetryTimer !== null,
    dropInProgress: (window as any).__ccWildSpawnDropInProgress === true,
  });

  try { (window as any).__ccFailScreenPending = false; } catch {}
  queueWildSpawnAfterGuardRelease(`defer-fail:${reason}`);

  scheduleCheckLevelEnd(0.35, `defer_fail_for_wild_continuation:${reason}`);

  return true;
}


function setWildProgress(ratio, animate=false){
  devLog('🔥 DRAMATIC: setWildProgress called with:', { ratio, animate });

  const rawTarget = Math.max(0, Number.isFinite(ratio) ? ratio : 0);
  const target = isWildMeterReady(rawTarget) ? Math.max(1, rawTarget) : rawTarget;
  wildMeter = target;
  STATE.wildMeter = target; // raw value (may exceed 1)

  const displayRatio = Math.min(1, wildMeter);
  devLog('🔥 DRAMATIC: Wild meter raw:', wildMeter, 'display:', displayRatio);

  try {
    HUD.updateProgressBar?.(displayRatio, !!animate);
    devLog('✅ DRAMATIC: HUD.updateProgressBar called successfully');
  } catch (error) {
    logger.error('❌ DRAMATIC: Error calling HUD.updateProgressBar', 'app-core', error);
  }

  if (isWildMeterReady(wildMeter)) {
    queueWildSpawnIfNeeded();
  }
}
function addWildProgress(amount, { confirmedNonFinal = false }: { confirmedNonFinal?: boolean } = {}){
  logger.debug('🔥🔥🔥 addWildProgress CALLED', 'app-core', { amount, wildMeter, boardNumber });

  const permissionBeforeFill = resolveWildSpawnPermission({
    tiles: STATE.tiles,
    wildMeter: 1,
    boardWildSpawnEnabled: isWildSpawnEnabled(boardNumber),
    boardWildMeterEnabled: isWildMeterEnabled(boardNumber),
    busyEnding,
    boardTransitionActive: (window as any).__ccBoardTransitionActive === true,
    failScreenPending: (window as any).__ccFailScreenPending === true,
    activeAnimationBlockReason: null,
    devLog,
  });
  const progressDecision = resolveWildMeterProgressDecision({
    permission: permissionBeforeFill,
    confirmedNonFinal,
  });

  if (progressDecision.action === 'skip' && progressDecision.reason === 'wild-meter-disabled') {
    devLog(`🎯 Board ${boardNumber}: Wild meter disabled - skipping addWildProgress`);
    return;
  }

  if (progressDecision.action === 'reset') {
    devLog('🚨🚨🚨 SOURCE OF TRUTH: Preload bar blocked (in addWildProgress) - last merge detected');
    // Reset wild meter to ensure it's empty
    wildMeter = 0;
    STATE.wildMeter = 0;
    try {
      if (typeof HUD.resetWildMeter === 'function') {
        HUD.resetWildMeter(true);
        devLog('✅ LAST MERGE (addWildProgress): Wild meter reset in HUD');
      }
    } catch (error) {
      logger.warn('⚠️ LAST MERGE (addWildProgress): Failed to reset wild meter in HUD', 'app-core', error);
    }
    return;
  }

  if (progressDecision.action === 'skip') {
    devLog('⏸️ addWildProgress skipped:', progressDecision.reason);
    return;
  }

  if (progressDecision.reason === 'confirmed-non-final-merge') {
    devLog('✅ Preserving wild progress from confirmed non-final merge despite transient live-board last-pair view');
  }
  
  const inc = Number.isFinite(amount) ? amount : 0;
  if (inc <= 0) {
    devLog('⚠️ addWildProgress: Ignoring non-positive increment:', inc);
    return;
  }

  const getArcadeWildMeterMultiplier = (stageNumber: number): number => {
    const stage = Math.max(1, stageNumber | 0);
    if (stage <= 1) return 1.15;
    if (stage === 2) return 1.0;
    if (stage === 3) return 0.9;
    if (stage === 4) return 0.8;
    if (stage < 8) return 0.7;
    return 0.6;
  };

  // 🎯 BOARD-SPECIFIC RULES: Apply board fill multiplier first.
  const fillRate = getWildMeterFillRate(boardNumber);
  // USER REQUEST: First 2 wild spawns charge at 1x, then slow to 0.6x.
  const progressionMultiplier = wildSpawnCount >= 2 ? 0.6 : 1.0;
  const arcadeModeMultiplier = isArcadeHomeRunMode() ? getArcadeWildMeterMultiplier(boardNumber) : 1.0;
  const tutorialFreePlayMultiplier = (window as any).__ccFirstPlayTutorialSlowWildMeter === true ? 0.05 : 1.0;
  const adjustedInc = inc * fillRate * progressionMultiplier * arcadeModeMultiplier * tutorialFreePlayMultiplier;
  devLog(`🎯 Board ${boardNumber}: Wild meter fill rate: ${fillRate}x, progression multiplier: ${progressionMultiplier}x, arcade multiplier: ${arcadeModeMultiplier}x, tutorial multiplier: ${tutorialFreePlayMultiplier}x, wildSpawnCount: ${wildSpawnCount}, adjusted increment: ${adjustedInc} (from ${inc})`);

  const target = wildMeter + adjustedInc;
  devLog('🔥 NEW LOGIC: Direct wild meter update to raw value:', target);
  setWildProgress(target, true);

}
function resetWildProgress(value=0, animate=false){
  setWildProgress(value, animate);
}

// 🔥 v112: ensureFonts moved to app-core-helpers.ts
// Imported: ensureFonts

// -------------------- boot --------------------
export async function boot(){
  installMobileSaveLifecycle({ saveGameState, trackAppTimeout });
  ensureBoardLifecycleTrace('direct-board-boot');
  markBoardLifecycle('boot-start');
  devLog('🎮 Initializing PIXI app');
  const reuseApp = !!(app && !app.destroyed && app.renderer && app.canvas);
  const shouldGateArcadeEntrySurface = isArcadeHomeRunMode() &&
    Math.max(0, Math.trunc(Number((window as any).__ccArcadeContinuationCueRound) || 0)) > 0;
  if (shouldGateArcadeEntrySurface) {
    engageArcadeEntrySurfaceGate(reuseApp ? app.canvas : null);
  }
  // A reused renderer still contains the previous Round until startLevel owns
  // its reset/rebuild. Occlude that complete PIXI tree synchronously, before
  // boot's first await, so the DOM Round cue cannot expose stale dice or ghost
  // placeholders through its transparent areas.
  if (reuseApp) {
    // Hiding the PIXI display tree does not clear WebKit's already-presented
    // canvas framebuffer. Keep the reused canvas compositor-hidden until boot
    // has rendered the hidden stage once; otherwise Homepage -> Play can expose
    // one stale frame of dice before the Round cue/new board owns the surface.
    try {
      app.canvas.style.opacity = '0';
      app.canvas.style.visibility = 'hidden';
    } catch {}
    try { if (stage) stage.visible = false; } catch {}
    try { if (board) board.visible = false; } catch {}
    try { if (hud) hud.visible = false; } catch {}
    try { hideGhostPlaceholders(); } catch {}
  }
  // 🔥 CRITICAL: Start loading Baloo2 font early - HUD text shows black boxes if font isn't ready
  ensureFonts().catch(() => {});
  // Fade out menu soundtrack when entering board game without board transition (e.g. direct continue)
  try {
    const { fadeOutAndPause } = await import('./soundtrack-manager.js');
    fadeOutAndPause(2000);
  } catch (_) { /* ignore */ }
  if (reuseApp) {
    devLog('♻️ Reusing existing PIXI app (soft reset)');
  }
  
  // Reset user made move flag for new game
  window._userMadeMove = false;
  devLog('🔄 Reset user made move flag for new game');

  // 🔥 Stability: track GSAP tickers globally (install once)
  try { installGsapTickerTracking(); } catch {}

  // 🔥 Stability: global navigation cleanup hook (install once)
  if (!__ccNavigationCleanupInstalled) {
    __ccNavigationCleanupInstalled = true;
    try {
      window.addEventListener('cc-navigation', () => {
        // Small delay to allow exit animations to settle
        try {
          if (__ccNavCleanupTimer) {
            clearTimeout(__ccNavCleanupTimer);
            __ccNavCleanupTimer = null;
	          }
	          __ccNavCleanupTimer = window.setTimeout(() => {
	            __ccNavCleanupTimer = null;
	            if ((window as any).__ccArcadePlayAgainStarting === true) {
	              devLog('⏭️ Skipping delayed cc-navigation cleanup during Arcade Play Again start');
	              return;
	            }
	            try { cleanupFxForBoardReset('cc-navigation'); } catch {}
	            try { softResetBoardView('cc-navigation'); } catch {}
	          }, 220);
        } catch {
          try { cleanupFxForBoardReset('cc-navigation'); } catch {}
          try { softResetBoardView('cc-navigation'); } catch {}
        }
      });
    } catch {}
  }
  
  // CRITICAL: Check for unsaved high score on boot
  trackAppTimeout(() => {
    if (typeof window.checkForUnsavedHighScore === 'function') {
      window.checkForUnsavedHighScore();
    }
  }, 2000);
  
  // 🔥🔥🔥 NUCLEAR CLEANUP: Kill EVERYTHING before destroying old app (hard reset only) 🔥🔥🔥
  // This is the ROOT CAUSE of _x null errors - old GSAP callbacks try to access destroyed objects
  if (!reuseApp) {
    devLog('🔥 NUCLEAR CLEANUP: Killing all animations and clearing all references...');
    
    // Retire only game-owned animation scopes. GlobalTimeline also contains
    // Journey/modals/navigation owners and must never be cleared by gameplay.
    killAllGsapTweensCommon(tiles, 'boot-hard-reset');
    
    // Step 2: Kill tweens on specific known targets (belt and suspenders approach)
    try {
      if (tiles && tiles.length > 0) {
        tiles.forEach(tile => {
          try { gsap.killTweensOf(tile); } catch {}
          try { if (tile?.scale) gsap.killTweensOf(tile.scale); } catch {}
        });
      }
      if (board) gsap.killTweensOf(board);
      if (stage) gsap.killTweensOf(stage);
      if (hud) gsap.killTweensOf(hud);
      devLog('✅ Killed tweens on known PIXI objects');
    } catch (e) {
      devWarn('⚠️ Error killing specific tweens:', e);
    }
    
    // Step 3: Clear module-level tile array to prevent stale references
    try {
      if (tiles) {
        tiles.length = 0; // Clear array without reassigning
      }
      if (STATE.tiles) {
        STATE.tiles.length = 0;
      }
      devLog('✅ Cleared tiles arrays');
    } catch (e) {
      devWarn('⚠️ Error clearing tiles:', e);
    }
  }
  
  // Step 4: Stop PIXI ticker BEFORE any destroy operations (only on hard reset)
  if (!reuseApp && app && app.ticker) {
    try {
      app.ticker.stop();
      devLog('✅ PIXI ticker stopped');
    } catch (tickerError) {
      devWarn('⚠️ Error stopping ticker:', tickerError);
    }
  }
  
  // Step 5: Clear stage children BEFORE destroy (cleaner removal from render tree)
  // 🔥 CRITICAL FIX: Preserve bubbles explosion container if active before removing stage children
  if (!reuseApp && app && app.stage) {
    try {
      // Check if wild juice bubbles explosion is active and preserve its container
      try {
        const { isWildJuiceBubblesExplosionActive, getExplosionContainer } = await import('./wild-juice-bubbles-explosion.js');
        if (isWildJuiceBubblesExplosionActive && isWildJuiceBubblesExplosionActive()) {
          const bubblesContainer = getExplosionContainer && getExplosionContainer();
          if (bubblesContainer && !bubblesContainer.destroyed && bubblesContainer.parent) {
            // Remove container from its parent BEFORE removeChildren() destroys it
            try {
              bubblesContainer.parent.removeChild(bubblesContainer);
              (window as any).__ccPreservedBubblesContainer = bubblesContainer;
              devLog('💧 boot: Preserved bubbles explosion container before stage cleanup', {
                containerVisible: bubblesContainer.visible,
                containerAlpha: bubblesContainer.alpha,
                containerChildren: bubblesContainer.children?.length || 0
              });
            } catch (preserveError) {
              devWarn('⚠️ boot: Failed to preserve bubbles container:', preserveError);
            }
          }
        }
      } catch (importError) {
        // Silently fail - module might not be available
      }
      
      app.stage.removeChildren();
      devLog('✅ Stage children removed');
    } catch (e) {
      devWarn('⚠️ Error removing stage children:', e);
    }
  }
  
  // Step 6: Clear references BEFORE destroy (hard reset only)
  if (!reuseApp) {
    stage = null as any;
    board = null as any;
    hud = null as any;
  }
  
  // 🔥 CRITICAL FIX: DESTROY existing app if it exists (hard reset only)
  if (!reuseApp && app && app.canvas) {
    devLog('🧹 Destroying existing PIXI app');
    
    // 🔥 CRITICAL: Hide canvas IMMEDIATELY before destroy to prevent flash
    app.canvas.style.opacity = '0';
    app.canvas.style.visibility = 'hidden';
    try {
      // 🔥 FIX: Don't destroy textures - they're managed by Assets and should be unloaded, not destroyed
      // Destroying Assets-managed textures causes PixiJS warnings
      app.destroy(true, { children: true, texture: false, textureSource: false } as any);
    } catch (e) {
      devLog('⚠️ Error destroying app:', e);
    }
    app = null as any;
  }
  
  // 🔥 CRITICAL FIX: Clear global HUD_ROOT reference before creating new app (hard reset only)
  // This prevents stale HUD from flashing during reinit
  if (!reuseApp) {
    try {
      if ((window as any).HUD_ROOT) {
        const oldHud = (window as any).HUD_ROOT;
        try { gsap.killTweensOf(oldHud); } catch {}
        try { oldHud.alpha = 0; } catch {}
        try { oldHud.visible = false; } catch {}
        (window as any).HUD_ROOT = null;
        devLog('✅ Cleared stale HUD_ROOT reference');
      }
    } catch (e) {
      devLog('⚠️ Error clearing HUD_ROOT:', e);
    }
  }
  
  devLog('✅ NUCLEAR CLEANUP complete - safe to create new app');
  
  // 🔥 CRITICAL FIX: Clear ALL existing canvas elements from DOM (hard reset only)
  // This prevents leftover canvas elements from showing when starting new game
  const host = document.getElementById('app') || document.body;
  if (!reuseApp) {
    try {
      // Remove all canvas elements from app container
      const existingCanvases = host.querySelectorAll('canvas');
      existingCanvases.forEach(canvas => {
        try {
          canvas.remove();
          devLog('✅ Removed existing canvas from DOM');
        } catch (e) {
          devWarn('⚠️ Failed to remove canvas:', e);
        }
      });
      
      // Also check body for any stray canvas elements
      const bodyCanvases = document.body.querySelectorAll('canvas');
      bodyCanvases.forEach(canvas => {
        // Only remove if it's part of app container
        if (canvas.parentElement === host || canvas.parentElement === document.body) {
          try {
            canvas.remove();
            devLog('✅ Removed stray canvas from body');
          } catch (e) {
            devWarn('⚠️ Failed to remove stray canvas:', e);
          }
        }
      });
    } catch (e) {
      devWarn('⚠️ Error removing existing canvas elements:', e);
    }
  }

  // The global GSAP/runtime cleanup above is the last destructive animation
  // boundary in boot. Start the one-shot Arcade entry cue now so a cold PIXI
  // renderer, HUD cache, and board texture warmup happen behind Round 0N
  // instead of delaying the first visible feedback. The board entrance later
  // consumes this exact owner and therefore cannot replay or overtake it.
  const pendingArcadeEntryRound = isArcadeHomeRunMode()
    ? Math.max(0, Math.trunc(Number((window as any).__ccArcadeContinuationCueRound) || 0))
    : 0;
  if (pendingArcadeEntryRound > 0 && shouldOverlapArcadeEntryCueWithColdBoot()) {
    void beginArcadeEntryCue(pendingArcadeEntryRound).catch((error) => {
      devWarn('⚠️ Arcade entry cue failed during post-cleanup boot warmup; board entrance will continue safely', error);
    });
  }
  
  if (!reuseApp) {
    devLog('🎮 Creating fresh PIXI app');
    const rawDevicePixelRatio = window.devicePixelRatio || 1;
    const rendererProfile = getRendererPerformanceProfile(
      rawDevicePixelRatio,
      MOBILE_RUNTIME_PROFILE.isMobileDevice,
    );
    const initOptions = {
      resizeTo: window,
      backgroundAlpha: 0,
      antialias: false,
      resolution: rendererProfile.resolution,
      powerPreference: rendererProfile.powerPreference
    };
    const isTransientRendererInitError = (error: unknown): boolean => {
      const msg = String((error as any)?.message || error || '');
      return /Failed to fetch dynamically imported module/i.test(msg) ||
        /WebGLRenderer/i.test(msg) ||
        /ERR_CONNECTION_REFUSED/i.test(msg);
    };
    const maxInitAttempts = 3;
    let initError: unknown = null;
    for (let attempt = 1; attempt <= maxInitAttempts; attempt++) {
      app = new Application();
      try {
        await app.init(initOptions);
        initError = null;
        if (attempt > 1) {
          devWarn(`✅ PIXI init recovered on retry ${attempt}/${maxInitAttempts}`);
        }
        break;
      } catch (error) {
        initError = error;
        try {
          app.destroy(true, { children: true, texture: false, textureSource: false } as any);
        } catch {}
        app = null as any;
        if (attempt < maxInitAttempts && isTransientRendererInitError(error)) {
          const retryDelayMs = 250 * attempt;
          devWarn(`⚠️ PIXI init failed (attempt ${attempt}/${maxInitAttempts}) - retrying in ${retryDelayMs}ms`, error);
          if (await waitTrackedResult(retryDelayMs) === 'cancelled') return;
          continue;
        }
        throw error;
      }
    }
    if (initError) {
      throw initError;
    }
  } else {
    // Ensure renderer is active on reuse
    try { app.ticker.start(); } catch {}
  }

  // Install runtime texture hooks (canvas + generateTexture)
  installRuntimeTextureHooks();
  try {
    const rendererAny = app.renderer as any;
    if (rendererAny && !rendererAny.__ccGenerateTextureWrapped) {
      const origGenerate = rendererAny.generateTexture?.bind(app.renderer);
      if (origGenerate) {
        rendererAny.generateTexture = (...args: any[]) => {
          const tex = origGenerate(...args);
          try {
            if (tex && !tex.label) {
              const w = tex.width || tex.baseTexture?.width || 0;
              const h = tex.height || tex.baseTexture?.height || 0;
              tex.label = `runtime:generateTexture:${w}x${h}`;
              const texSrc = (tex as { source?: { label?: string }; baseTexture?: { label?: string } }).source ?? tex.baseTexture;
              if (texSrc) texSrc.label = tex.label;
              const rt = (window as any).__ccRuntimeTextures || ((window as any).__ccRuntimeTextures = new Set());
              rt.add?.(tex);
            }
          } catch {}
          return tex;
        };
        rendererAny.__ccGenerateTextureWrapped = true;
      }
    }
  } catch {}
  
  // 🔥 CRITICAL FIX: Ensure app is rendering
  devLog('✅ PIXI app initialized');
  devLog('✅ App renderer width:', app.renderer.width, 'height:', app.renderer.height);
  devLog('✅ App canvas width:', app.canvas.width, 'height:', app.canvas.height);
  devLog('✅ App canvas in DOM:', !!app.canvas.parentElement);
  
  // Add fade in animation for background transition
  // 🔥 CRITICAL FIX: Only auto-show canvas if NOT coming from Journey (saved game)
  // When coming from Journey, canvas stays hidden until HUD drop starts
  app.canvas.style.opacity = '0';
  app.canvas.style.transition = 'opacity 0.6s ease';
  const cameFromJourney = window.__ccCameFromJourney;
  if (!cameFromJourney && !reuseApp) {
    trackAppTimeout(() => {
      if (!enforceArcadeEntrySurfaceGate(app.canvas)) {
        app.canvas.style.opacity = '1';
      }
    }, 50);
  } else {
    devLog('🎯 Canvas kept hidden - will show when HUD drop starts');
  }
  
  // 🔥 CRITICAL: Set background to #F9F9F9 during launch (matches launch screen)
  // Gradient will be set by launch-screen.ts in Phase 2, or by ui-manager.ts after launch
  const rendererAny = app.renderer as any;
  rendererAny.backgroundColor = 0x000000;
  rendererAny.backgroundAlpha = 0; // Transparent so paper BG shows behind board + HUD
  
  const appElement = document.getElementById('app');
  const canvasElement = app.canvas;
  applyAppPaperBackground();
  
  // Keep app and canvas transparent to show paper background behind
  if (appElement) {
    appElement.style.setProperty('background', 'transparent', 'important');
    appElement.style.setProperty('background-image', 'none', 'important');
  }
  if (canvasElement) {
    canvasElement.style.setProperty('background', 'transparent', 'important');
    canvasElement.style.setProperty('background-image', 'none', 'important');
  }
  
  devLog('📄 Board game uses the shared launch paper background');
  // 🔥 CRITICAL FIX: Ensure host element exists and is visible before adding canvas
  if (!host) {
    devError('❌ Host element not found! Cannot add canvas to DOM');
    return;
  }
  
  // Ensure host element is visible
  if (host instanceof HTMLElement) {
    host.style.display = 'block';
    host.style.visibility = 'visible';
    host.style.opacity = '1';
    devLog('✅ Host element made visible before adding canvas');
  }
  
  if (!reuseApp && !isArcadeEntrySurfaceGateActive()) {
    host.appendChild(app.canvas);
  }
  app.canvas.style.touchAction = 'none';
  installCoreTextureContextRecovery(app.canvas);
  app.canvas.style.zIndex = '10'; /* Above background, below sliders */
  
  // 🔥 CRITICAL FIX: Ensure canvas is visible and properly styled
  app.canvas.style.display = 'block';
  if (!reuseApp) {
    app.canvas.style.visibility = 'visible';
    app.canvas.style.opacity = '1';
  }
  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';
  app.canvas.style.position = 'absolute';
  app.canvas.style.top = '0';
  
  // 🔥 CRITICAL: Wait for Pixi to render first frame
  // Note: Boot class is already removed in launch-screen.ts after launch sequence completes
  // This is just a safety check in case boot() is called before launch screen completes
  let firstFrameRendered = false;
  const onFirstFrame = () => {
    if (firstFrameRendered) return;
    firstFrameRendered = true;
    
    // 🔥 CRITICAL: Remove boot class if it still exists (safety check)
    // This should already be removed by launch-screen.ts, but we do it here as fallback
    try {
      if (document.documentElement && document.documentElement.classList.contains('boot')) {
        document.documentElement.classList.remove('boot');
        document.documentElement.style.background = '';
        document.documentElement.style.backgroundColor = '';
        devLog('✅ Boot class removed after first frame (fallback)');
      }
      if (document.body && document.body.classList.contains('boot')) {
        document.body.classList.remove('boot');
        document.body.style.background = '';
        document.body.style.backgroundColor = '';
      }
    } catch(e) {
      devWarn('⚠️ Failed to remove boot class:', e);
    }
    
    // 🔥 CRITICAL: Native splash is already hidden in main.ts when loading screen is shown
    // No need to hide it again here - it's already hidden
    devLog('✅ First Pixi frame rendered - native splash already hidden');
    
    // Remove ticker listener after first frame
    app.ticker.remove(onFirstFrame);
  };
  
  // This is launch-only. Re-registering it on every soft renderer reuse can
  // accumulate callbacks when an entry is interrupted before the next tick.
  if (!reuseApp) app.ticker.add(onFirstFrame);
  app.canvas.style.left = '0';
  app.canvas.style.pointerEvents = 'auto';
  devLog('✅ Canvas added to DOM and styled');
  devLog('✅ Canvas in DOM:', !!app.canvas.parentElement);
  devLog('✅ Canvas visible:', app.canvas.style.visibility, 'display:', app.canvas.style.display, 'opacity:', app.canvas.style.opacity);
  
  // Optimize canvas for pixel-perfect rendering
  app.canvas.style.imageRendering = 'pixelated';
  app.canvas.style.imageRendering = '-webkit-optimize-contrast';
  
  // Basic setup
  stage   = app.stage; stage.sortableChildren = true;
  // startLevel is the sole reveal owner after resetting the previous board.
  stage.visible = !reuseApp;
  stage.alpha = 1;
  stage.renderable = true;

  if (reuseApp && board && hud && !board.destroyed && !hud.destroyed) {
    // 🔥 CRITICAL FIX: Reuse existing board/hud when app is reused (e.g. interim → clean board → next board)
    // Creating new Container() and stage.addChild() would leave OLD board/hud on stage → duplicate children + memory leak → app reset
    devLog('♻️ boot (reuse): Keeping existing board and hud containers');
    board.visible = false;
    board.alpha = 1;
    board.renderable = true;
    hud.visible = false;
    hud.alpha = 1;
    hud.renderable = true;
  } else {
    board   = new Container(); board.sortableChildren = true;
    boardBG = new Graphics();
    hud     = new Container(); hud.eventMode = 'none';
    board.visible = true;
    board.alpha = 1;
    board.renderable = true;
    hud.visible = true;
    hud.alpha = 1;
    hud.renderable = true;
    board.zIndex = 100; hud.zIndex = 10000;
    stage.addChild(board, hud);
    board.addChildAt(boardBG, 0); boardBG.zIndex = -1000; board.sortChildren();
  }

  // 🔥 CRITICAL FIX: Clear backgroundLayer reference after boot() destroys old app (or on reuse so startLevel recreates it)
  // This ensures that backgroundLayer will be recreated in startLevel()
  backgroundLayer = null;
  window._ghostPlaceholders = null;
  devLog('✅ boot: Cleared backgroundLayer and window._ghostPlaceholders references (will be recreated in startLevel)');
  
  // 🔥 CRITICAL FIX: Restore preserved bubbles explosion container to new stage
  const preservedBubblesContainer = (window as any).__ccPreservedBubblesContainer;
  if (preservedBubblesContainer && !preservedBubblesContainer.destroyed) {
    try {
      // Use dynamic import to restore bubbles container
      import('./wild-juice-bubbles-explosion.js').then(({ setExplosionContainer }) => {
        if (setExplosionContainer && preservedBubblesContainer && !preservedBubblesContainer.destroyed) {
          // Restore the module's internal reference to the container
          setExplosionContainer(preservedBubblesContainer);
          
          // Ensure FX layer exists (create if needed, similar to getFxHost in bubbles module)
          let fxLayer = (window as any).__ccGlobalFxLayer;
          const needsNew = !fxLayer || fxLayer.destroyed || fxLayer.parent !== stage;
          if (needsNew) {
            try {
              fxLayer = new Container();
              fxLayer.label = '__ccGlobalFxLayer';
              fxLayer.zIndex = 999900; // Below bubbles container but above everything else
              fxLayer.eventMode = 'none';
              fxLayer.visible = true;
              fxLayer.alpha = 1.0;
              fxLayer.renderable = true;
              fxLayer.position.set(0, 0);
              fxLayer.scale.set(1, 1);
              try { fxLayer.interactiveChildren = false; } catch {}
              if (stage.sortableChildren !== undefined) {
                stage.sortableChildren = true;
              }
              stage.addChild(fxLayer);
              stage.sortChildren?.();
              (window as any).__ccGlobalFxLayer = fxLayer;
              devLog('💧 boot: Created new FX layer for bubbles container restoration');
            } catch (e) {
              devWarn('⚠️ boot: Failed to create FX layer:', e);
              fxLayer = stage; // Fallback to stage
            }
          }
          
          // Wait a frame to ensure stage is fully initialized
          trackAppAnimationFrame(() => {
            if (fxLayer && !fxLayer.destroyed && preservedBubblesContainer && !preservedBubblesContainer.destroyed) {
              // Ensure container properties are correct
              preservedBubblesContainer.visible = true;
              preservedBubblesContainer.alpha = 1.0;
              preservedBubblesContainer.renderable = true;
              preservedBubblesContainer.zIndex = 999999;
              
              // Add container to FX layer
              if (fxLayer.sortableChildren !== undefined) {
                fxLayer.sortableChildren = true;
              }
              fxLayer.addChild(preservedBubblesContainer);
              fxLayer.sortChildren?.();
              
              // Ensure container is at the top of display list
              const currentIndex = fxLayer.getChildIndex(preservedBubblesContainer);
              const lastIndex = fxLayer.children.length - 1;
              if (currentIndex !== lastIndex) {
                fxLayer.removeChild(preservedBubblesContainer);
                fxLayer.addChild(preservedBubblesContainer);
                preservedBubblesContainer.zIndex = 999999;
                fxLayer.sortChildren?.();
              }
              
              // Force render to ensure visibility
              try {
                app.renderer.render(stage);
              } catch {}
              
              devLog('💧 boot: Restored bubbles explosion container to new stage', {
                containerVisible: preservedBubblesContainer.visible,
                containerAlpha: preservedBubblesContainer.alpha,
                containerChildren: preservedBubblesContainer.children?.length || 0,
                containerInStage: !!(preservedBubblesContainer.parent),
                fxLayerChildren: fxLayer.children.length
              });
              
              // Clear global reference after successful restoration
              delete (window as any).__ccPreservedBubblesContainer;
            } else {
              devWarn('⚠️ boot: Cannot restore bubbles container - FX layer or container invalid', {
                hasFxLayer: !!fxLayer,
                fxLayerDestroyed: fxLayer?.destroyed,
                containerDestroyed: preservedBubblesContainer?.destroyed
              });
              delete (window as any).__ccPreservedBubblesContainer;
            }
          });
        }
      }).catch((restoreError) => {
        devWarn('⚠️ boot: Failed to restore bubbles container:', restoreError);
        delete (window as any).__ccPreservedBubblesContainer;
      });
    } catch (restoreError) {
      devWarn('⚠️ boot: Failed to import bubbles module for restoration:', restoreError);
      delete (window as any).__ccPreservedBubblesContainer;
    }
  }
  
  devLog('✅ Board and HUD containers created and added to stage');
  devLog('✅ Board visible:', board.visible, 'alpha:', board.alpha, 'renderable:', board.renderable, 'in stage:', !!board.parent);
  devLog('✅ HUD visible:', hud.visible, 'alpha:', hud.alpha, 'renderable:', hud.renderable, 'in stage:', !!hud.parent);
  devLog('✅ Stage children count:', stage.children.length);
  devLog('✅ Stage visible:', stage.visible, 'renderable:', stage.renderable);
  
  // 🔥 CRITICAL FIX: Force render to ensure everything is visible
  try {
    app.renderer.render(stage);
    devLog('✅ Initial render completed');
    if (reuseApp && !isArcadeEntrySurfaceGateActive()) {
      // The stale framebuffer is now replaced by a transparent frame from the
      // hidden stage, so revealing the canvas cannot flash the previous board.
      app.canvas.style.visibility = 'visible';
      app.canvas.style.opacity = '1';
      devLog('✅ Reused canvas revealed after hidden-stage framebuffer clear');
    }
  } catch (e) {
    devWarn('⚠️ Failed to perform initial render:', e);
  }
  
  // Initialize fixed background layer AFTER layout is set
  // (will be called from startGame after layout())
  
  syncSharedState();

  stage.eventMode = 'static';
  stage.hitArea   = new Rectangle(0, 0, app.renderer.width, app.renderer.height);

  // Resolve prize assets - DEFER non-critical prize loading to avoid delay
  // These are only needed during endgame, not for initial board
  trackAppTimeout(() => {
  }, 0);

  // 🔥 CRITICAL: Load HUD icons into PIXI Assets cache BEFORE any other assets
  // This MUST be done before layoutBoard() initializes HUD
  // HUD icons MUST be available when HUD.initHUD() is called
  // 🔥 OPTIMIZATION: Load HUD icons with timeout to prevent long waits after hard exit
  // Icons will load lazily if they're not ready, so we don't block board initialization
  try {
    const { loadHudIconsIntoPixiCache } = await import('../utils/comprehensive-image-preloader.js');
    devLog('🎮 Loading HUD icons into PIXI Assets cache (with timeout protection)...');
    // 🔥 CRITICAL: Don't wait forever - timeout is handled inside loadHudIconsIntoPixiCache
    // This prevents long delays after hard exit when cache is empty
    await loadHudIconsIntoPixiCache();
    devLog('✅ HUD icons loaded into PIXI Assets cache');
  } catch (error) {
    devError('❌ CRITICAL: Failed to load HUD icons into PIXI Assets cache:', error);
    // Continue anyway - HUD will try to load icons asynchronously
  }

  try {
    await warmBoardGameAssets({
      mode: isArcadeHomeRunMode() ? 'arcade' : 'journey',
      boardNumber,
      reason: 'app-core-boot',
      timeoutMs: 2600,
    });
  } catch (error) {
    devWarn('⚠️ Board asset warmup reported an issue during boot; runtime texture guard will continue recovery', error);
  }
  
  // Core gameplay textures must be valid, not just present in Assets.cache.
  // iOS/WebKit can keep stale cache entries after app/renderer teardown; starting with
  // those references renders pips/placeholders without tile faces.
  await ensureCoreGameTexturesLoaded('boot');
  
  // Fonts are already loaded via CSS @font-face in index.html
  // No need to load fonts dynamically - PIXI will use CSS fonts automatically
  
  // A reused app already has a drag owner from the previous board. Release it
  // before replacing STATE.drag so no stale pointer owner or stage callback can
  // survive repeated Play Again boots.
  if (reuseApp && drag) {
    try { (drag as any).cleanup?.({ resumeIdle: false }); } catch {}
  }

  // drag
  const ret = installDrag({
    app, board, TILE,
    getTiles: () => tiles,
    getGrid: () => grid, // Add getGrid function for drag system
    cellXY, // Add cellXY function
    merge,
    canDrop: (s, d) => {
      const classifyWildSpecial = (tile: any) => {
        if (!tile) return null;
        const special = typeof tile.special === 'string' ? tile.special : '';
        if (isWildLikeSpecial(special)) return special;
        const variantSpecial = getCoreWildTypeForSpecialDiceVariant(getSpecialDiceVariantForTile(tile));
        if (variantSpecial) return variantSpecial;
        const remembered = typeof tile._ccWildSpecial === 'string' ? tile._ccWildSpecial : '';
        if (isWildLikeSpecial(remembered)) return remembered;
        if (tile.isWild === true || tile.isWildFace === true) return 'wild';
        return null;
      };
      const isInternalPulledTilesMerge =
        (s as any)?._wildMagnetAffected === true &&
        (d as any)?._wildMagnetAffected === true;
      if (shouldBlockMergeDuringRegularHandoff(regularMergeHandoffTokens.size > 0, s, d)) {
        devLog('🛡️ canDrop (app-core): Regular stack absorb still owns the board');
        return false;
      }
      if (
        specialDiceTransactionOwner.isActive() &&
        !isInternalPulledTilesMerge &&
        !canOrdinaryStackDuringSpecialVisualTail(s, d)
      ) {
        devLog('🛡️ canDrop (app-core): Another special transaction owns the board');
        return false;
      }
      const touchesSpecialDice = isWildLikeTile(s) || isWildLikeTile(d) ||
        !!getSpecialDiceVariantForTile(s) || !!getSpecialDiceVariantForTile(d);
      if (merge6SpawnInProgress && touchesSpecialDice) {
        devLog('🛡️ canDrop (app-core): Special dice waits for current merge-6 spawn');
        return false;
      }
      if (isSpecialDiceResolutionOwned(s) || isSpecialDiceResolutionOwned(d)) {
        devLog('🛡️ canDrop (app-core): Special dice resolution owns this tile');
        return false;
      }
      if ((s as any)?._ccWildSpawnDropping === true || (d as any)?._ccWildSpawnDropping === true) {
        devLog('🛡️ canDrop (app-core): Incoming wild drop is not mergeable yet');
        return false;
      }
      // CRITICAL: Check if destination is valid FIRST
      if (!d || d.locked || (d.value | 0) <= 0) {
        devLog('🔥 canDrop (app-core): Invalid destination (null, locked, or value = 0)');
        return false;
      }
      
      const sv = (s && (s.value|0)) || 0;
      const dv = (d && (d.value|0)) || 0;
      const srcSpecial = classifyWildSpecial(s);
      const dstSpecial = classifyWildSpecial(d);
      
      // WILD-MAGNET LOGIC: Can go on anything except wild and wild-magnet, and anything can go on it
      const srcIsWildMagnet = isSpecialDiceMagnetLikeTile(s, srcSpecial);
      const dstIsWildMagnet = isSpecialDiceMagnetLikeTile(d, dstSpecial);
      const srcIsWild = isWildLikeSpecial(srcSpecial) && !srcIsWildMagnet;
      const dstIsWild = isWildLikeSpecial(dstSpecial) && !dstIsWildMagnet;
      
      if (srcIsWildMagnet) {
        // Wild-magnet cannot merge into wild or wild-magnet
        if (dstIsWild || dstIsWildMagnet) {
          devLog('🔥 canDrop (app-core): Wild-magnet cannot merge into wild or wild-magnet');
          return false;
        }
        // Wild-magnet can merge into any normal tile
        devLog('🔥 canDrop (app-core): Wild-magnet can merge into normal tile');
        return true;
      }
      
      if (dstIsWildMagnet) {
        // Any tile can merge into wild-magnet (except wild and wild-magnet)
        if (srcIsWild || srcIsWildMagnet) {
          devLog('🔥 canDrop (app-core): Wild or wild-magnet cannot merge into wild-magnet');
          return false;
        }
        // Normal tiles can merge into wild-magnet
        devLog('🔥 canDrop (app-core): Normal tile can merge into wild-magnet');
        return true;
      }

      // 🔥 CRITICAL: If one tile is wild-magnet affected, it can merge only with another affected tile.
      const srcIsWildMagnetAffected = (s as any)?._wildMagnetAffected === true;
      const dstIsWildMagnetAffected = (d as any)?._wildMagnetAffected === true;
      if (srcIsWildMagnetAffected && dstIsWildMagnetAffected) {
        devLog('🧲 canDrop (app-core): Both tiles are wild-magnet affected (pulled tiles) - can merge');
        return true;
      }
      if (srcIsWildMagnetAffected || dstIsWildMagnetAffected) {
        devLog('🛡️ canDrop (app-core): One tile is wild-magnet affected (protected) - blocking merge with other tiles');
        return false;
      }
      
      const wild = (srcIsWild || dstIsWild);
      
      // WILD LOGIC: Direct wilds merge with any regular active tile.
      // Do not compare values here: wild tiles carry value 6 internally, and comparing
      // against a regular 6 made some first wild drops snap back even though the move is valid.
      if (wild) {
        if (srcIsWild && dstIsWild) {
          // Wild merging into wild - not allowed
          return false;
        }
        if (srcIsWild && !dstIsWild) {
          return dv > 0 && !d?.special;
        } else if (dstIsWild && !srcIsWild) {
          return sv > 0 && !s?.special;
        }
      }
      
      // NORMAL LOGIC: Regular merge rules
      if (!Number.isFinite(sv) || !Number.isFinite(dv)) return false;
      if (sv === dv) return (sv + dv) <= 6;  // allow same value only when sum<=6 (3+3 OK, 4+4 and 5+5 must snap back)
      
      // 🔥 NEW: Allow wild star to merge with merge 6 tile (value 6)
      // Wild star (special='wild') can merge with merge 6 tile to create new merge 6
      const sIsWild = isSpecialDiceDirectWildLikeTile(s, srcSpecial);
      const dIsWild = isSpecialDiceDirectWildLikeTile(d, dstSpecial);
      if ((sIsWild && dv === 6 && !d?.special) || (dIsWild && sv === 6 && !s?.special)) {
        devLog('⭐ canDrop (app-core): Wild star can merge with merge 6 tile');
        return true; // Allow wild star to merge with merge 6
      }
      
      // 🔥 CRITICAL FIX: Allow merge 6 tile (value 6) to merge with any tile (value 1-5)
      // This allows user to merge spawned tiles with merge 6 tile that remained after magnet pull
      // Merge 6 tile should be removable by merging with any spawned tile
      if (dv === 6 && sv > 0 && sv < 6) {
        devLog('🔥 canDrop (app-core): Merge 6 tile can merge with tile value', sv);
        return true; // Allow merge 6 to merge with any tile (1-5)
      }
      if (sv === 6 && dv > 0 && dv < 6) {
        devLog('🔥 canDrop (app-core): Tile value', sv, 'can merge with merge 6 tile');
        return true; // Allow any tile (1-5) to merge with merge 6
      }
      
      const canMerge = (sv + dv) <= 6;    // allow different values that sum to 6 (e.g., 4+2, 2+4, 3+2=5)
      return canMerge;
    },
    hoverColor: 0x8a6e57,
    hoverWidth: 10,
    hoverAlpha: 0.28,
    threshold: 0.05, // Increased from 0.03 to prevent accidental merges
    hitPad: 0.26,
    snapRadius: 0.68,
  });
  drag = (ret && ret.drag) ? ret.drag : ret;
  STATE.drag = drag; // 🔥 CRITICAL: Set STATE.drag so tiles can be bound after spawning

  // Start game
  // Allow callers (e.g., resume flow after clean-board exit) to request a specific starting board
  const forcedStartLevel = Number(window.__ccStartAtLevel);
  if (Number.isFinite(forcedStartLevel) && forcedStartLevel >= 1) {
    delete window.__ccStartAtLevel;
    boardNumber = forcedStartLevel | 0;
    moves = MOVES_MAX;
    devLog('🎯 boot(): Starting at requested board', boardNumber);
    await startLevel(boardNumber);
  } else {
    boardNumber = 1;
    moves = MOVES_MAX;
    // 🔥 CRITICAL FIX: Ensure board and hud are visible before starting level
    if (board) {
      board.visible = true;
      board.alpha = 1;
      board.renderable = true;
      devLog('✅ Board made visible in boot() before startLevel');
    }
    if (hud) {
      hud.visible = true;
      hud.alpha = 1;
      hud.renderable = true;
      devLog('✅ HUD made visible in boot() before startLevel');
    }
    await startLevel(1);
  }
  
  // 🔥 CRITICAL FIX: Final check - ensure board and hud are visible after startLevel
  trackAppTimeout(() => {
    if (isGameplayEntryPending()) return;
    if (board) {
      board.visible = true;
      board.alpha = 1;
      board.renderable = true;
      devLog('✅ Board visibility confirmed after startLevel (delayed check)');
    }
    if (hud) {
      hud.visible = true;
      hud.alpha = 1;
      hud.renderable = true;
      devLog('✅ HUD visibility confirmed after startLevel (delayed check)');
    }
  }, 100);
  
  // Force HUD reinit after board numbering changes
  _hudInitDone = false;
  trackAppListener(window, 'resize', layoutBoard);

  // viewport + fonts
  {
    const vp = document.querySelector('meta[name="viewport"]') || (() => {
      const m = document.createElement('meta'); m.setAttribute('name','viewport'); document.head.appendChild(m); return m;
    })();
    vp.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');

    const viewportStyleId = 'cc-app-core-viewport-style';
    let style = document.getElementById(viewportStyleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = viewportStyleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      :root{ --sat:env(safe-area-inset-top,0px); --sal:env(safe-area-inset-left,0px); --sar:env(safe-area-inset-right,0px); --sab:env(safe-area-inset-bottom,0px); }
      html,body{ margin:0; padding:0; background:var(--app-gradient, linear-gradient(180deg, #f3eee8 0%, #FBE3C5 100%)); height:auto; }
      body{ min-height:100dvh; overflow:hidden; }
      #app{ position:fixed; inset:0; width:100vw; height:100dvh; background:var(--app-gradient, linear-gradient(180deg, #f3eee8 0%, #FBE3C5 100%)); z-index:10; /* Transition removed - GSAP handles background animations */ }
      canvas{ position:absolute; inset:0; width:100vw; height:100dvh; display:block; background:var(--app-gradient, linear-gradient(180deg, #f3eee8 0%, #FBE3C5 100%)); z-index:10; /* Transition removed - GSAP handles background animations */ }
    `;
  }

  // Function to trigger clean board screen for testing
  async function showCleanBoardOverlay() {
    devLog('🧪 Testing: Triggering clean board screen from menu Done button');
    
    // 🔥 FIX: Use triggerCleanBoardFlow for consistency with all other clean board paths
    await triggerCleanBoardFlow('clean_board_from_test_overlay');
  }

  async function devLastMergeTntScene(options: {
    coreWildType?: 'wild' | 'wild-juice' | 'wild-magnet' | 'wild-tnt';
    variantId?: string | null;
    label?: string;
  } = {}) {
    const variant = getSpecialDiceVariant(options.variantId || null);
    const coreWildType = variant
      ? (getCoreWildTypeForSpecialDiceVariant(variant) || 'wild-tnt')
      : (options.coreWildType || 'wild-tnt');
    const choiceLabel = options.label || variant?.id || coreWildType;

    devLog('🧪 DEV LAST MERGE: preparing Journey final merge scene', {
      coreWildType,
      variantId: variant?.id || null,
      label: choiceLabel,
    });

    try { setRunMode(RUN_MODE_JOURNEY); } catch {}
    const targetBoard = Math.max(1, Math.min(25, Number(boardNumber || STATE.boardNumber || 1) || 1));

    try {
      busyEnding = false;
      failScreenFlowInProgress = false;
      resetTransientRunGuards('dev-last-merge-tnt');
      setFinalMergeVisualSuppression(false);
      clearNoMovesText?.();
      exitNoMovesText?.();
      stopTntAnimation?.();
      stopWildJuiceBubblesExplosion?.();
      stopMagneticText?.();
      stopSparkleText?.();
      stopTileIdleBounce({ TILE_IDLE_BOUNCE, devLog, devWarn });
      cleanupFxForBoardReset('dev-last-merge-tnt');
    } catch {}

    await startLevel(targetBoard);
    if (await waitTrackedResult(120) === 'cancelled') return;

    try {
      stopTileIdleBounce({ TILE_IDLE_BOUNCE, devLog, devWarn });
      cleanupFxForBoardReset('dev-last-merge-tnt-after-start');
      resetTilesForRebuild({
        tiles,
        gsap,
        stopWildIdle,
        stopWildShimmer,
        stopWildStars,
        stopWildJuiceBubbles,
        stopMagnetIdleParticles,
        stopTntIdleParticles,
        stopTntIdleShake,
        stopSpecialDiceIdleMotion,
        cleanupTilesForRebuild,
        devWarn,
      });
      createEmptyGrid();
      if (STATE.tiles) STATE.tiles.length = 0;
      tiles.length = 0;
      window._ghostPlaceholders = null;
    } catch (error) {
      devWarn('⚠️ DEV LAST MERGE: tile cleanup failed:', error);
    }

    try {
      initializeBackgroundLayer();
      drawBoardBG();
      createLockedHolders({
        ROWS,
        COLS,
        board,
        grid,
        tiles,
        makeBoard,
        fixHoverAnchor,
      });

      await openAtCell(2, 4, { value: 5, timeScale: 1.25 });
      await openAtCell(3, 4, {
        isWild: coreWildType === 'wild',
        isWildJuice: coreWildType === 'wild-juice',
        isWildMagnet: coreWildType === 'wild-magnet',
        isWildTnt: coreWildType === 'wild-tnt',
        timeScale: 1.25,
      });

      const wildTile = grid?.[4]?.[3] || tiles.find((tile: any) => (
        tile && !tile.destroyed && tile.gridX === 3 && tile.gridY === 4
      ));
      if (wildTile && variant) {
        applySpecialDiceVariantToTile(wildTile, variant);
        applyWildSkinLocal(wildTile);
        if (variant.id && coreWildType === 'wild' && variant.id !== 'core-wild') {
          try { stopWildStars(wildTile); } catch {}
        }
        try { startSpecialDiceIdleMotion(wildTile); } catch {}
      }

      moves = MOVES_MAX;
      wildMeter = 0;
      STATE.wildMeter = 0;
      resetWildProgress(0, false);
      firstWildSpawned = false;
      wildSpawnCount = 0;
      lastWildDropType = null;
      wildDropTypeStreak = 0;

      try { HUD.resetWildMeter?.(true); } catch {}
      try { hudResetCombo(); } catch {}
      try { board?.sortChildren?.(); } catch {}
      try { updateGhostVisibility(); } catch {}
      syncSharedState();
      updateHUD();
      layoutBoard();
      lastSavedState = '';

      devLog('✅ DEV LAST MERGE: ready', {
        boardNumber,
        choice: choiceLabel,
        activeTiles: tiles.filter((t: any) => t && !t.destroyed && !t.locked && ((t.value | 0) > 0 || t.special)).map((t: any) => ({
          c: t.gridX,
          r: t.gridY,
          value: t.value,
          special: t.special || null,
          variant: t._ccSpecialDiceVariant || t.specialDiceVariant || null,
        })),
      });
    } catch (error) {
      devWarn('⚠️ DEV LAST MERGE: setup failed:', error);
      throw error;
    }
  }

  const scheduleHudStarHudFeedback = () => {
    if (hudStarHudFeedbackFramePending) return;
    hudStarHudFeedbackFramePending = true;
    trackAppAnimationFrame(() => {
      hudStarHudFeedbackFramePending = false;
      try {
        animateScore(score, 0.18);
      } catch {
        updateHUD();
      }
      try {
        HUD.bumpScoreNumberFromHudStar?.();
      } catch {}
      try {
        HUD.bounceScoreIcon?.();
      } catch {}
    });
  };

  // Debug mini-API (ostavljeno)
  const runtimeGameBridge = {
    nextLevel: () => startLevel(level + 1),
    retry:     () => startLevel(level),
    state:     () => ({ level, score, board: boardNumber, moves, wildMeter, tiles: tiles.length }),
    app, stage, board,
    getScore: () => score,
    setScore: (v) => { score = (v|0); updateHUD(); },
    animateScoreTo: (v, d=0.45) => animateScore((v|0), d),
    addScoreFromHudStar: (amount = 100) => {
      const bonus = Math.max(0, amount | 0);
      if (bonus <= 0) return score;
      score = Math.min(SCORE_CAP, score + bonus);
      try {
        if (STATE) STATE.score = score;
      } catch {}
      // Several flights can enter the HUD during the same display frame (TNT
      // is the common case). Preserve every score mutation, but coalesce the
      // expensive text redraw and HUD bounce into one frame-owned update.
      scheduleHudStarHudFeedback();
      return score;
    },
    updateHUD: () => updateHUD(),
    getHudMetrics: () => ({ ...__hudMetrics }),
    getUnifiedHudInfo: () => HUD.getUnifiedHudInfo ? HUD.getUnifiedHudInfo() : { y: 0, height: 0, parent: null, dropped: false },
    hideGameUI: () => { try { board.visible = false; hud.visible = false; drawBoardBG('none'); } catch {} },
    showGameUI: () => { try { board.visible = true;  hud.visible = true;  drawBoardBG(); } catch {} },
    pauseGame: () => pauseGame(),
    resumeGame: () => resumeGame(),
    resume: () => resumeGame(),
    restart: (options?: RestartOptions) => restart(options),
    showCleanBoardOverlay: () => showCleanBoardOverlay(),
    devLastMergeTntScene: (options?: {
      coreWildType?: 'wild' | 'wild-juice' | 'wild-magnet' | 'wild-tnt';
      variantId?: string | null;
      label?: string;
    }) => devLastMergeTntScene(options),
    triggerCleanBoardFlow: (reason: string) => triggerCleanBoardFlow(reason), // 🔥 CRITICAL: Export for consistent clean board flow from all paths
    checkLevelEnd: () => checkLevelEnd(), // Export checkLevelEnd for use in app-merge.ts
    beginEndgameGuard: (source: string, ttlMs?: number) => beginEndgameGuard(source, ttlMs),
    endEndgameGuard: (source: string) => endEndgameGuard(source),
    getEndgameGuardState: () => getEndgameGuardState(),
    debugResolveGameplayState: (reason?: string, overrides?: any) => debugResolveGameplayState(reason, overrides),
    isWildMagnetPullInProgress: () => wildMagnetPullInProgress === true,
    applyWildSkinLocal: (tile) => applyWildSkinLocal(tile), // 🔥 CRITICAL: Export for wild-magnet electric glow
    getCombo: () => combo, // 🔥 CRITICAL: Export getCombo for magnet pull combo logic
    setCombo: (v) => hudSetCombo(v|0), // 🔥 CRITICAL: Export setCombo for magnet pull combo logic
    scheduleComboDecay: (ms?: number) => scheduleComboDecay(ms), // 🔥 CRITICAL: Export scheduleComboDecay for magnet pull combo logic
    killComboTimer: () => killComboTimer(), // 🔥 CRITICAL: Export killComboTimer to kill existing timer before updating combo
    addStars: (count) => StarsCollector.addStars(count|0), // 🔥 CRITICAL: Export addStars for synchronous star collection
    setStarsCount: (count) => StarsCollector.setStarsCount(count|0), // 🔥 CRITICAL: Export setStarsCount for resetting star count on restart
    cleanupFxForBoardReset: (reason = 'window') => cleanupFxForBoardReset(reason),
    getCleanupStats: () => getAppCleanupStats(),
    getJourneyPlayAgainIncidentState: () => ({
      boardNumber,
      tiles: {
        total: tiles.length,
        alive: tiles.filter((tile: any) => tile && tile.destroyed !== true).length,
        destroyed: tiles.filter((tile: any) => tile?.destroyed === true).length,
        unique: new Set(tiles).size,
      },
      grid: (() => {
        const cells = Array.isArray(grid) ? grid.flat().filter(Boolean) : [];
        return {
          occupied: cells.length,
          unique: new Set(cells).size,
          destroyedRefs: cells.filter((cell: any) => cell?.destroyed === true).length,
        };
      })(),
      boardChildren: board?.children?.length ?? 0,
      stageChildren: stage?.children?.length ?? 0,
      pixiTickerStarted: app?.ticker?.started ?? null,
      pixiTickerCount: app?.ticker?.count ?? null,
    }),
    resetTransientRunGuards: (reason = 'window') => resetTransientRunGuards(reason),
    softResetBoardView: (reason = 'window') => softResetBoardView(reason),
    destroyOldBoardForTransition: (reason?: string) => destroyOldBoardForTransition(reason ?? 'unknown'),
    cleanupTexturesForBoardTransition: (reason: string, aggressive?: boolean, skipCacheClear?: boolean) =>
      cleanupTexturesForBoardTransition(reason, aggressive ?? false, skipCacheClear ?? false),
    layoutBoard: () => layoutBoard(),
    snapshotState: () => replayRecorder.snapshot(),
    replayStartRecord: () => replayRecorder.startRecord(),
    replayStartVerify: (steps) => replayRecorder.startVerify(steps),
    replayStop: () => replayRecorder.stop(),
    replayExport: () => replayRecorder.export(),
    replayImport: (json: string) => replayRecorder.import(json),
    replayStatus: () => replayRecorder.status(),
  } satisfies RuntimeGameBridge;
  window.CC = runtimeGameBridge;

  // Expose for continueGameWithSavedState fallback when loadGameState fails
  window.rebuildBoard = rebuildBoard;
  window.startLevel = startLevel;
  
  // 🔥 MEMORY LEAK FIX: Export cleanup functions for global cleanup
  window.killAllDelayedCalls = killAllDelayedCalls;
  window.destroyAllGraphicsObjects = destroyAllGraphicsObjects;
  syncSharedState();
  
  // Re-assert the single shared paper owner after boot-time DOM setup settles.
  trackAppTimeout(() => {
    applyAppPaperBackground();
    devLog('📄 Shared launch paper background re-applied after board boot');
  }, 100);
  markBoardLifecycle('boot-complete');
}

// -------------------- layout + HUD --------------------
// 🔥 REFACTORED: Preimenovano za jasnoću - ovo je board layout, ne HUD layout
export async function layoutBoard(){
  ensureBoardLifecycleTrace('direct-board-layout');
  markBoardLifecycle('layout-start');
  const layoutStageOwner = stage;
  const layoutBoardOwner = board;
  const layoutHudOwner = hud;
  const layoutVisibilityBeforeCoreRepair = {
    stage: stage?.visible !== false,
    board: board?.visible !== false,
    hud: hud?.visible !== false,
  };
  const layoutCoreRepairWasNeeded = (
    getUnusableRequiredCoreRenderTextureAssets().length > 0 ||
    coreTextureCanvasVisibilityBeforeHide !== null
  );
  if (layoutCoreRepairWasNeeded) hideGameplayForCoreTextureRecovery();
  const { w, h} = boardSize();
  const vw = app.renderer.width, vh = app.renderer.height;
  stage.hitArea = new Rectangle(0, 0, vw, vh);

  const isMobilePortrait = (vw < 768) || (vh > vw);

  const cssVars = getComputedStyle(document.documentElement);
  const SAB = parseFloat(cssVars.getPropertyValue('--sab')) || 0;
  const SAT = parseFloat(cssVars.getPropertyValue('--sat')) || 0;
  
  // iPhone 13 specific safe area handling
  const isIPhone13 = /iPhone/.test(navigator.userAgent) && window.screen.width === 390 && window.screen.height === 844;
  const adjustedSAT = isIPhone13 ? Math.max(SAT, 44) : SAT; // iPhone 13 minimum safe area top
  
  devLog('🎯 Safe area top (SAT):', SAT, 'px, adjusted for iPhone 13:', adjustedSAT, 'px');
  devLog('🎯 Device info:', {
    userAgent: navigator.userAgent,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    isIPhone13,
    viewportWidth: vw,
    viewportHeight: vh
  });

  const TOP_PAD   = 20 + Math.round(vh * 0.004); // Move HUD lower (now 0.4% = ~4px on iPhone 13)
  const BOT_PAD   = (isMobilePortrait ? 24 : 24) + SAB;
  const GAP_HUD   = 24;

  // For mobile devices, HUD will be positioned below notch, so calculate board positioning accordingly
  const isMobile = vw < 768 || vh > vw;
  let safeTop, hudBottom;
  
  if (isMobile) {
    // Mobile: HUD and board positioned EXACTLY 48px below notch (24px + 24px more)
    const safeAreaTop = Math.max(44, adjustedSAT);
    safeTop = safeAreaTop + 48; // EXACTLY 48px below notch (24px + 24px more)
    hudBottom = safeTop + HUD_H + GAP_HUD;
    __hudMetrics.top = Math.round(safeTop);
    __hudMetrics.bottom = Math.round(hudBottom);
    
    devLog('📱 Mobile: HUD positioned EXACTLY 48px below notch, safeTop:', safeTop, 'px');
  } else {
    // Desktop: Use calculated safe area positioning
    safeTop = TOP_PAD + adjustedSAT;
    hudBottom = safeTop + HUD_H + GAP_HUD;
    devLog('🖥️ Desktop: HUD at y:', safeTop, 'px, board starts at y:', hudBottom);
  }
  
  const isIPad = vw >= 768 && vw <= 1400;
  
  // Raise HUD by 56px on iPad (total)
  const BOARD_LIFT = 16;
  
  if (isIPad) {
    safeTop -= 56;
    hudBottom -= 56;
  }
  
  // Raise HUD by additional 40px on iPhone (in percentages)
  if (isMobile && !isIPad) {
    const additionalOffset = Math.round(vh * 0.047); // ~40px on iPhone 13 (844px height)
    safeTop -= additionalOffset;
    hudBottom -= additionalOffset;
    devLog('📱 iPhone: Raised HUD by', additionalOffset, 'px (4.7% of vh)');
  }

  // Final lift: move HUD 8px closer to the top edge (extra 4px lift)
  const HUD_LIFT = 8;
  safeTop -= HUD_LIFT;
  hudBottom = safeTop + HUD_H + GAP_HUD;
  __hudMetrics.top = Math.round(safeTop);
  __hudMetrics.bottom = Math.round(hudBottom);
  
  // Scale board to fit screen width
  const HUD_PADDING = 24;
  const IPAD_BOARD_PADDING = 40; // iPad-specific board padding
  
  // Calculate available height and centerY first
  const availableHeight = vh - hudBottom - BOT_PAD;
  
  let availableWidth, s, sw, sh, boardX, boardY, widthScale;
  
  if (isIPad) {
    // iPad: full width with 40px edge-to-edge board
    availableWidth = vw - (IPAD_BOARD_PADDING * 2);
    widthScale = availableWidth / w;
    s = widthScale; // Force board to match availableWidth exactly
    
    sw = w * s;
    sh = h * s;
    boardX = IPAD_BOARD_PADDING; // Left edge flush with 40px padding
    // Gap between HUD and board: exactly 24px
    const boardTopGap = 24;
    boardY = Math.round(hudBottom + boardTopGap - BOARD_LIFT + 6 - 2); // Board starts after HUD gap, lifted up, +6px down, -2px up
  } else {
    // Mobile/Desktop: match HUD width
    availableWidth = vw - (HUD_PADDING * 2);
    widthScale = availableWidth / w;
    const heightScale = availableHeight / h;
    s = Math.min(widthScale, heightScale);
    
    sw = w * s;
    sh = h * s;
    const idealLeft = Math.round((vw - sw) / 2);
    const minLeft = HUD_PADDING;
    const maxLeft = vw - HUD_PADDING - sw;
    boardX = Math.min(Math.max(idealLeft, minLeft), maxLeft);
    const centerY = hudBottom + availableHeight / 2;
    boardY = Math.round(centerY - sh / 2 + 8 - BOARD_LIFT + 6 - 2); // Previous +8 offset, now lifted up, +6px down, -2px up
  }
  
  devLog('🎯 Board scaling:', { 
    availableWidth, 
    widthScale: availableWidth / w, 
    heightScale: availableHeight / h, 
    finalScale: s,
    padding: isIPad ? `${IPAD_BOARD_PADDING}px` : `${HUD_PADDING}px`
  });
  
  board.scale.set(s, s);
  board.x = boardX;
  board.y = boardY;
  
  devLog('🎯 Board positioned at y:', board.y, 'px (available height:', availableHeight, 'px, board height:', sh, 'px)');
  
  devLog('🎯 Board positioning (HUD below notch on mobile):', {
    isMobile,
    safeTop,
    hudBottom,
    availableHeight,
    centerY: board.y,
    boardHeight: sh,
    viewportHeight: vh,
    topPad: TOP_PAD,
    isIPad
  });

  // Don't clear ghost placeholders - they should stay visible
  // drawBoardBG('none');
  if (Math.abs((_lastSAT||0) - SAT) > 0.5) { _hudInitDone = false; _lastSAT = SAT; }

  try {
    const refreshedAssets = await ensureCoreGameTexturesLoaded('layoutBoard');
    refreshLiveCoreGameSpriteTextures('layoutBoard');
    if (coreGhostTextureNeedsRebuild) {
      initializeBackgroundLayer();
      coreGhostTextureNeedsRebuild = false;
      if ((window as any).__ccEnterAnimationActive === true) hideGhostPlaceholders();
      else updateGhostVisibility();
    }
    if (refreshedAssets.length > 0) {
      if (refreshedAssets.some((assetPath) => isCoreHudTextureAsset(assetPath))) {
        _hudInitDone = false;
        try { (window as any).__ccForceHudRecreateForTextures = true; } catch {}
      }
    }
  } catch (error) {
    try { if (stage) stage.visible = false; } catch {}
    try { if (board) board.visible = false; } catch {}
    try { if (hud) hud.visible = false; } catch {}
    devError('❌ Core render texture barrier blocked layoutBoard reveal', error);
    throw error;
  }

  try {
    if (typeof HUD.initHUD === 'function') {
      if (!_hudInitDone) {
        devLog('🎯 Initializing HUD...');
        
        // 🔥 CRITICAL: Ensure Baloo2 font is loaded BEFORE creating PIXI Text
        // Without this, HUD numbers render as black boxes (tofu) when font isn't ready for Canvas
        try {
          await ensureFonts();
          devLog('✅ Fonts ready for HUD text');
        } catch (err) {
          devWarn('⚠️ Font preload failed, HUD text may show fallback:', err);
        }
        
        // 🔥 CRITICAL: Ensure HUD icons are loaded into PIXI Assets cache before initializing HUD.
        // Assets.get() alone is not enough; stale WebKit/Pixi cache entries can exist but render blank.
        try {
          const refreshedAssets = await ensureCoreGameTexturesLoaded('layoutBoard-before-hud');
          if (refreshedAssets.some((assetPath) => isCoreHudTextureAsset(assetPath))) {
            try { (window as any).__ccForceHudRecreateForTextures = true; } catch {}
          }
          devLog('✅ Core HUD textures validated before HUD init');
        } catch (err) {
          devError('❌ CRITICAL: Failed to ensure HUD icons are loaded before HUD init:', err);
          try { if (stage) stage.visible = false; } catch {}
          try { if (board) board.visible = false; } catch {}
          try { if (hud) hud.visible = false; } catch {}
          throw err;
        }
        
        HUD.initHUD({ stage, app, top: safeTop, initialHide: _hudDropPending });
        _hudInitDone = true;
        devLog('✅ HUD initialized successfully');
        
        // 🔥 CRITICAL FIX: If HUD was initialized with initialHide=false, ensure it's visible
        // This handles the case where _hudDropPending is false but HUD still needs to be visible
        // HUD_ROOT is not directly accessible, we need to get it from HUD module or window
        try {
          const hudRoot = (window as any).HUD_ROOT || HUD.HUD_ROOT || null;
          if (!_hudDropPending && hudRoot && !(hudRoot as any).destroyed) {
            const top = hudRoot._dropTop ?? safeTop;
            hudRoot.y = top;
            hudRoot.alpha = 1;
            hudRoot.visible = true;
            hudRoot._dropped = true;
            showJourneyGameBottomDecorForHudDrop();
            devLog('✅ HUD made visible immediately (no drop pending)');
          }
        } catch (e) {
          devWarn('⚠️ Failed to access HUD_ROOT:', e);
        }
        
        // 🔥 CRITICAL: Fallback to trigger HUD drop shortly after init (for slow devices)
        if (_hudDropPending && !isGameplayEntryPending()) {
          trackAppTimeout(() => {
            if (!_hudDropPending) return; // already handled by sweetPopIn
            try {
              const hudRoot = (window as any).HUD_ROOT || HUD.HUD_ROOT || null;
              if (!hudRoot || (hudRoot as any).destroyed || !hudRoot.parent) {
                // Silent - this is expected if HUD hasn't initialized yet
                return;
              }
              if (!hudRoot._dropped && typeof HUD.playHudDrop === 'function') {
                // Start on next paint so user definitely sees the drop (especially iPhone)
                trackAppAnimationFrame(() => trackAppAnimationFrame(() => {
                  // 🔥 CRITICAL: Show canvas now that HUD is ready to drop
                  if (app && app.canvas) {
                    app.canvas.style.opacity = '1';
                    app.canvas.style.transition = 'opacity 0.3s ease';
                  }
                  showJourneyGameBottomDecorForHudDrop();
                  HUD.playHudDrop({ forceRestart: true });
                }));
                devLog('✅ HUD drop fallback triggered after initHUD');
              }
              _hudDropPending = false;
            } catch (err) {
              devWarn('⚠️ HUD drop fallback failed:', err);
            }
          }, 120);
        }
        
        // 🔥 Initialize stars collector
        try {
          StarsCollector.initStarsCollector({
            app,
            stage, // 🔥 CRITICAL: Add stage for screen coordinate animations
            board,
            hud,
            getStarHudPosition: () => {
              if (typeof HUD.getStarHudPosition === 'function') {
                return HUD.getStarHudPosition();
              }
              return null;
            },
            onStarsUpdated: (count) => {
              // Update HUD star count display
              if (typeof HUD.setStarsCount === 'function') {
                HUD.setStarsCount(count);
              }
            }
          });
          devLog('✅ Stars collector initialized');
        } catch (error) {
          devWarn('⚠️ Failed to initialize stars collector:', error);
        }
      }
      
      // Update HUD with current values
      // 🔥 CRITICAL FIX: Use STATE.boardNumber if available (most up-to-date)
      const currentBoardNumber = (STATE?.boardNumber && Number.isFinite(STATE.boardNumber)) 
        ? STATE.boardNumber 
        : boardNumber;
      if (typeof HUD.updateHUD === 'function') {
        HUD.updateHUD({ score, board: currentBoardNumber, moves, combo });
        devLog('✅ HUD updated with:', { score, board: currentBoardNumber, moves, combo, 'STATE.boardNumber': STATE?.boardNumber, 'local boardNumber': boardNumber });
      }
      
      // CRITICAL: Call HUD.layout to update HUD positioning
      if (typeof HUD.layout === 'function') {
        HUD.layout({ app, top: safeTop });
        devLog('✅ HUD layout updated');
      }

  // After HUD has laid out the wild preloader, recenter board between
  // the bottom edge of the PIXI wild meter and the bottom of the screen.
  try {
    const wildY = (wild?.view?.y ?? 0);
    const wildH = (wild?.view?.height ?? 8);
    const hudRoot = wild?.view?.parent || null; // HUD_ROOT
    // If HUD is mid-drop (hidden above), use its target top for layout so board doesn't jump.
    const hudYForLayout = hudRoot
      ? (hudRoot._dropped ? (hudRoot.y ?? safeTop) : (hudRoot._dropTop ?? safeTop))
      : safeTop;
    // dynamic bottom = intended HUD top + wild local y + wild height + gap
    const dynamicHudBottom = hudYForLayout + wildY + wildH + GAP_HUD;
    __hudMetrics.bottom = Math.round(dynamicHudBottom);
    // Recompute vertical scale to ensure board fits in space between wild bottom and screen bottom
    const heightScale2 = (vh - dynamicHudBottom - BOT_PAD) / h;
    const s2 = Math.min(widthScale, heightScale2);
    board.scale.set(s2, s2);
    const sw2 = w * s2, sh2 = h * s2;
    // recenter horizontally with the same padding
    const paddingPercent = isIPad ? (IPAD_BOARD_PADDING / vw) : (HUD_PADDING / vw);
    const paddingPixels2 = vw * paddingPercent;
    const idealLeft2 = Math.round((vw - sw2) / 2);
    const minLeft2 = paddingPixels2;
    const maxLeft2 = vw - paddingPixels2 - sw2;
    board.x = Math.min(Math.max(idealLeft2, minLeft2), maxLeft2);
    // CENTER BOARD VERTICALLY in the space between wild bottom and bottom of screen
    // Use percentage-based positioning for responsive centering
    const avail2 = vh - dynamicHudBottom - BOT_PAD;
    // Center at exactly 50% of available space
    const center2 = dynamicHudBottom + (avail2 - sh2) / 2;
    board.y = Math.round(center2 - BOARD_LIFT + 6 - 2); // +6px down, -2px up
    devLog('🎯 Recentered board using PIXI wild meter (centered 50%):', { dynamicHudBottom, center2, wildY, wildH, s2, hudYForLayout, avail2 });
  } catch (e) {
    devWarn('⚠️ Could not recenter using PIXI wild meter, using estimate.', e);
  }
    } else {
      devWarn('⚠️ HUD.initHUD is not a function');
    }
  } catch (error) {
    devError('❌ Error during HUD initialization/update in app.js layout:', error);
    // Reset HUD flag on error to retry next time
    _hudInitDone = false;
    if (
      error instanceof CoreRenderTextureBarrierError ||
      layoutCoreRepairWasNeeded ||
      coreTextureRecoveryPromise !== null
    ) {
      hideGameplayForCoreTextureRecovery();
      throw error;
    }
  }
  
  // Start idle bounce animations for tiles with pips
  if (TILE_IDLE_BOUNCE.ENABLE) {
    try {
      TILE_IDLE_BOUNCE.start(tiles, board);
      devLog('✅ Tile idle bounce started');
    } catch (error) {
      devWarn('⚠️ Failed to start tile idle bounce:', error);
    }
  }
  if (
    layoutCoreRepairWasNeeded &&
    !coreTextureRecoveryPromise &&
    !isGameplayEntryPending() &&
    stage === layoutStageOwner &&
    board === layoutBoardOwner &&
    hud === layoutHudOwner
  ) {
    stage.visible = layoutVisibilityBeforeCoreRepair.stage;
    board.visible = layoutVisibilityBeforeCoreRepair.board;
    hud.visible = layoutVisibilityBeforeCoreRepair.hud;
    try { app?.renderer?.render?.(stage); } catch {}
    restoreCanvasAfterCoreTextureRecovery();
  }
  markBoardLifecycle('layout-complete');
}

// 🔥 v112: Utility functions moved to app-core-utils.ts
// Imported: boardSize, cellXY

// PROFESSIONAL SOLUTION: Fixed background layer with all ghost placeholders
// Created once, never destroyed, always visible
let backgroundLayer = null;

function initializeBackgroundLayer(){
  // CRITICAL: Always create new background layer for each game
  const PAD=5, RADIUS=Math.round(TILE*0.26), WIDTH=8, COLOR=0xF3E6DC, ALPHA=0.64;
  const dpr = Math.max(1, Math.round((window.devicePixelRatio || 1)));
  const ghostAssetPath =
    dpr >= 3 ? './assets/ghost-placeholder@3x.png'
    : dpr >= 2 ? './assets/ghost-placeholder@2x.png'
    : './assets/ghost-placeholder.png';
  let ghostTexture: Texture | null = null;
  const getCachedGhostTexture = (path: string): Texture | null => {
    try {
      if (typeof (Assets as any).cache?.has === 'function' && (Assets as any).cache.has(path)) {
        return Assets.get(path);
      }
    } catch {}
    return null;
  };
  try {
    ghostTexture = getCachedGhostTexture(ghostAssetPath) || getCachedGhostTexture('./assets/ghost-placeholder.png');
  } catch {
    try { ghostTexture = getCachedGhostTexture('./assets/ghost-placeholder.png'); } catch {}
  }
  
  // 🔥 CRITICAL FIX: Remove existing background layer if it exists
  if (backgroundLayer) {
    try {
      if (board && board.children.includes(backgroundLayer)) {
        board.removeChild(backgroundLayer);
        devLog('✅ Removed existing background layer from board');
      }
      backgroundLayer.destroy({ children: true });
      devLog('✅ Destroyed existing background layer');
    } catch (e) {
      devWarn('⚠️ Error removing existing background layer:', e);
    }
    backgroundLayer = null; // Clear reference
  }
  
  // 🔥 CRITICAL FIX: Ensure board exists before creating background layer
  if (!board) {
    devError('❌ initializeBackgroundLayer: board is null, cannot create background layer');
    return;
  }
  
  // Create a new dedicated container for background elements
  backgroundLayer = new Container();
  backgroundLayer.zIndex = -10000; // Always at the very bottom
  backgroundLayer.eventMode = 'none'; // Non-interactive
  backgroundLayer.label = 'BackgroundLayer'; // For debugging
  backgroundLayer.visible = true; // 🔥 CRITICAL: Ensure it's visible
  
  // Add to board at index 0 (bottom)
  try {
    board.addChildAt(backgroundLayer, 0);
    devLog('✅ Background layer added to board at index 0');
  } catch (e) {
    devError('❌ Failed to add background layer to board:', e);
    backgroundLayer = null;
    return;
  }
  
  devLog('🎯 Creating FIXED background layer with all ghost placeholders');
  
  // Create ghost placeholder for EVERY cell
  // Store reference in 2D array for easy access
  window._ghostPlaceholders = [];
  
  for (let r=0;r<ROWS;r++){
    window._ghostPlaceholders[r] = [];
    for (let c=0;c<COLS;c++){
      const pos = cellXY(c, r);
      const ghost = ghostTexture ? new Sprite(ghostTexture) : new Graphics();
      if (ghostTexture) {
        (ghost as any).anchor?.set?.(0.5);
        (ghost as any).position?.set?.(pos.x + TILE * 0.5, pos.y + TILE * 0.5);
        (ghost as any).width = TILE;
        (ghost as any).height = TILE;
      } else {
        (ghost as any).roundRect(pos.x+PAD, pos.y+PAD, TILE-PAD*2, TILE-PAD*2, RADIUS);
        (ghost as any).stroke({ color:COLOR, width:WIDTH, alpha:ALPHA });
      }
      ghost.eventMode = 'none';
      ghost.label = `Ghost_${c}_${r}`;
      ghost.zIndex = -10000;
      ghost.visible = true; // 🔥 v70 STYLE: Always visible - shown for empty cells
      backgroundLayer.addChild(ghost);
      window._ghostPlaceholders[r][c] = ghost; // Store reference
    }
  }
  
  board.sortChildren();
  
  devLog('✅ FIXED background layer created with', ROWS * COLS, 'ghost placeholders');
  devLog('✅ This layer will NEVER be modified or destroyed');
  devLog('🔍 Background layer zIndex:', backgroundLayer.zIndex);
  devLog('🔍 Background layer visible:', backgroundLayer.visible);
  devLog('🔍 Background layer in board:', board.children.includes(backgroundLayer));
  
  // 🔥 v70 STYLE: Update ghost visibility immediately after creation
  // Show ghosts for empty cells (where grid[r][c] === null)
  try {
    // 🔥 CRITICAL FIX: Ensure backgroundLayer is visible before updating ghost visibility
    backgroundLayer.visible = true;
    // Fallback: Show all ghosts initially (will be hidden by updateGhostVisibility later)
    updateGhostVisibility();
    devLog('✅ Ghost visibility updated after background layer creation');
    // 🔥 CRITICAL FIX: Double-check that ghost placeholders are visible
    if (window._ghostPlaceholders && Array.isArray(window._ghostPlaceholders)) {
      let visibleCount = 0;
      window._ghostPlaceholders.forEach((row: any[]) => {
        row.forEach((ghost: any) => {
          if (ghost && ghost.visible) visibleCount++;
        });
      });
      devLog(`✅ Ghost placeholders check: ${visibleCount} visible out of ${ROWS * COLS} total`);
    }
  } catch (e) {
    devError('❌ Failed to update ghost visibility:', e);
  }
}

// Helper function to hide/show ghost at specific position
function setGhostVisibility(c, r, visible) {
  try {
    if ((window as any).__ccFinalGhostLayerLockedHidden === true && visible) return;
    if (visible && hasVisibleLockedTileAtCell(c, r)) {
      const ghost = window._ghostPlaceholders?.[r]?.[c];
      if (ghost) ghost.visible = false;
      return;
    }
    if (window._ghostPlaceholders && window._ghostPlaceholders[r] && window._ghostPlaceholders[r][c]) {
      window._ghostPlaceholders[r][c].visible = visible;
    }
  } catch {}
}

function hasVisibleLockedTileAtCell(c: number, r: number): boolean {
  const isVisibleLocked = (tile: any) => {
    if (!tile || tile.destroyed || tile.locked !== true) return false;
    if (tile.visible === false || (tile.alpha ?? 1) <= 0.01) return false;
    return true;
  };
  const cellCenter = (() => {
    try {
      const pos = cellXY(c, r);
      return { x: pos.x + TILE * 0.5, y: pos.y + TILE * 0.5 };
    } catch {
      return {
        x: c * (TILE + GAP) + TILE * 0.5,
        y: r * (TILE + GAP) + TILE * 0.5,
      };
    }
  })();
  const visuallyOccupiesCell = (tile: any) => {
    if (!isVisibleLocked(tile)) return false;
    const tx = Number.isFinite(tile.targetX) ? tile.targetX : tile.x;
    const ty = Number.isFinite(tile.targetY) ? tile.targetY : tile.y;
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return false;
    return Math.abs(tx - cellCenter.x) <= TILE * 0.58 &&
      Math.abs(ty - cellCenter.y) <= TILE * 0.58;
  };

  try {
    const cell = grid?.[r]?.[c];
    if (isVisibleLocked(cell)) return true;
    if (visuallyOccupiesCell(cell)) return true;
  } catch {}

  try {
    return (Array.isArray(tiles) ? tiles : []).some((tile: any) => {
      if (!isVisibleLocked(tile)) return false;
      if ((tile.gridX | 0) === c && (tile.gridY | 0) === r) return true;
      return visuallyOccupiesCell(tile);
    });
  } catch {}

  return false;
}

function hideGhostsUnderLockedTiles(reason: string = 'unknown'): void {
  try {
    const rows = window._ghostPlaceholders;
    if (!Array.isArray(rows)) return;
    let hidden = 0;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const ghost = row[c];
        if (!ghost || ghost.destroyed || ghost.visible === false) continue;
        if (!hasVisibleLockedTileAtCell(c, r)) continue;
        ghost.visible = false;
        hidden++;
      }
    }
    if (hidden > 0) {
      devLog('👻 Hidden ghost placeholders under locked tiles', { reason, hidden });
    }
  } catch {}
}

// When true, updateGhostVisibility only hides ghosts (never shows) — prevents one-frame blink during enter animation
(window as any).__ccEnterAnimationActive = false;
// When true, force-hide ghosts/background placeholders regardless of grid state (used during final-merge cinematic).
(window as any).__ccForceHideGhosts = false;
// When true, terminal final-merge cleanup owns the board handoff and the ghost/background layer
// must not be re-shown for even one frame by legacy visibility refreshes.
(window as any).__ccFinalGhostLayerLockedHidden = false;

function setFinalGhostLayerLockedHidden(active: boolean, reason: string = 'unknown'): void {
  try { (window as any).__ccFinalGhostLayerLockedHidden = !!active; } catch {}
  if (!active) {
    devLog(`👻 Final ghost layer lock OFF (${reason})`);
    return;
  }
  devLog(`👻 Final ghost layer lock ON (${reason})`);
}

function hideFinalGhostLayerAfterPopOut(reason: string = 'final-popout-complete'): void {
  try {
    try { hideGhostPlaceholders(); } catch {}
    try { if (backgroundLayer) backgroundLayer.visible = false; } catch {}
    devLog(`👻 Final ghost layer hidden after pop-out (${reason})`);
  } catch {}
}

function setFinalMergeVisualSuppression(active: boolean, opts: { preserveGhosts?: boolean } = {}) {
  const preserveGhosts = opts.preserveGhosts === true;
  const allowSuppression = isArcadeHomeRunMode();
  setFinalGhostLayerLockedHidden(!!active, active ? 'final-merge-suppression' : 'final-merge-suppression-off');
  if (active && !allowSuppression) {
    try { (window as any).__ccForceHideGhosts = true; } catch {}
    try { holdFinalResidualArtifactsVisible('journey-final-merge-no-suppression'); } catch {}
    return;
  }
  try { (window as any).__ccForceHideGhosts = !!active; } catch {}
  if (active && preserveGhosts) {
    try { (window as any).__ccForceHideGhosts = true; } catch {}
    try { holdFinalResidualArtifactsVisible('visual-suppression'); } catch {}
  } else {
    try { hideGhostPlaceholders(); } catch {}
  }
  try {
    if (backgroundLayer) backgroundLayer.visible = !active || preserveGhosts;
  } catch {}
}

function hideTerminalLockedArtifacts(reason: string = 'unknown') {
  if ((window as any).__ccFinalResidualPopOutPrepared === true) {
    try { (window as any).__ccForceHideGhosts = true; } catch {}
    try { setFinalGhostLayerLockedHidden(true, `terminal-after-popout:${reason}`); } catch {}
    try { hideFinalGhostLayerAfterPopOut(`terminal-after-popout:${reason}`); } catch {}
  } else if (!isArcadeHomeRunMode()) {
    try { holdFinalResidualArtifactsVisible(`journey-terminal-hold:${reason}`); } catch {}
    return;
  } else {
    try {
      setFinalMergeVisualSuppression(true);
    } catch {}
  }
  try {
    let hidden = 0;
    for (const t of tiles) {
      if (!t || t.destroyed) continue;
      if (!t.locked) continue;
      // End-of-run visual polish: hide all locked placeholders/ice in terminal states.
      try { t.visible = false; } catch {}
      try { t.alpha = 0; } catch {}
      try { t.eventMode = 'none'; } catch {}
      hidden++;
    }
    if (hidden > 0) {
      devLog(`🧹 hideTerminalLockedArtifacts: hidden ${hidden} locked tiles (${reason})`);
    }
  } catch (e) {
    devWarn('⚠️ hideTerminalLockedArtifacts failed:', e);
  }
}

// Update ghost visibility based on current grid state
// SIMPLE RULE: Show ghost ONLY where grid cell is null (no tile at all)
function updateGhostVisibility() {
  // 🔥 During enter animation: never show ghosts — only hide (any call to updateGhostVisibility = no visible ghosts)
  if (
    (window as any).__ccEnterAnimationActive ||
    (window as any).__ccForceHideGhosts
  ) {
    try { hideGhostPlaceholders(); } catch {}
    return;
  }
  if ((window as any).__ccFinalGhostLayerLockedHidden) {
    // Freeze current ghost visibility during final handoff. Do not hide already visible
    // placeholders before pop-out, and do not recalculate/show new placeholders.
    return;
  }
  // 🔥 CRITICAL FIX: If window._ghostPlaceholders is null, try to reinitialize from backgroundLayer
  if (!window._ghostPlaceholders) {
    if (backgroundLayer && backgroundLayer.children.length > 0) {
      devLog('🔄 updateGhostVisibility: window._ghostPlaceholders is null, reinitializing from backgroundLayer...');
      window._ghostPlaceholders = [];
      for (let r = 0; r < ROWS; r++) {
        window._ghostPlaceholders[r] = [];
        for (let c = 0; c < COLS; c++) {
          const ghostLabel = `Ghost_${c}_${r}`;
          const ghost = backgroundLayer.children.find((child: any) => child.label === ghostLabel);
          if (ghost) {
            window._ghostPlaceholders[r][c] = ghost;
          }
        }
      }
      devLog('✅ updateGhostVisibility: window._ghostPlaceholders reinitialized from backgroundLayer');
    } else {
      // If backgroundLayer doesn't exist, we can't update ghost visibility
      devWarn('⚠️ updateGhostVisibility: window._ghostPlaceholders is null and backgroundLayer is missing - cannot update');
      return;
    }
  }
  
  let visibleCount = 0;
  const tilesSet = new Set(Array.isArray(tiles) ? tiles : []);
  
  for (let r=0; r<ROWS; r++) {
    for (let c=0; c<COLS; c++) {
      const cell = grid[r]?.[c];
      const cellMissingFromTiles = !!cell && !tilesSet.has(cell);
      const staleOrDestroyedCell = !!cell && (cell.destroyed === true || cellMissingFromTiles);
      if (staleOrDestroyedCell) {
        try {
          if (grid?.[r]?.[c] === cell) grid[r][c] = null;
        } catch {}
      }

      // Show placeholder for any effectively empty cell:
      // - null/undefined (sparse grid)
      // - stale/destroyed references left in grid
      // - hidden locked value<=0 holders (fallback safety)
      const emptyLike = (cell == null) || staleOrDestroyedCell;
      const hiddenLockedPlaceholder = isLockedEmptyPlaceholder(cell) && (cell.visible === false || (cell.alpha ?? 1) <= 0.01);
      const hiddenMagnetMerge6 =
        !!cell &&
        (cell as any)._magnetMerge6Hidden === true &&
        (cell.value | 0) === 6 &&
        (cell.visible === false || (cell.alpha ?? 1) <= 0.01);
      const lockedTileOccupiesCell = hasVisibleLockedTileAtCell(c, r);
      const shouldShow = !lockedTileOccupiesCell && (emptyLike || hiddenLockedPlaceholder || hiddenMagnetMerge6);
      
      // Self-heal missing ghost references for this cell
      if (!window._ghostPlaceholders[r]) window._ghostPlaceholders[r] = [];
      if (!window._ghostPlaceholders[r][c] && backgroundLayer) {
        const ghostLabel = `Ghost_${c}_${r}`;
        const ghost = backgroundLayer.children.find((child: any) => child.label === ghostLabel);
        if (ghost) window._ghostPlaceholders[r][c] = ghost;
      }

      const ghostAtCell = window._ghostPlaceholders[r]?.[c];
      if (ghostAtCell) {
        ghostAtCell.visible = shouldShow;
        if (shouldShow) visibleCount++;
      }
    }
  }
  hideGhostsUnderLockedTiles('updateGhostVisibility');
  
  // 🔥 CRITICAL FIX: Log ghost visibility status for debugging
  if (visibleCount > 0) {
    devLog(`✅ updateGhostVisibility: ${visibleCount} ghost placeholders visible`);
  }
}

// Hide all ghost placeholders (e.g. during board enter / pop-in animation)
function hideGhostPlaceholders() {
  try {
    if (window._ghostPlaceholders && Array.isArray(window._ghostPlaceholders)) {
      window._ghostPlaceholders.forEach((row: any[]) => {
        row.forEach((ghost: any) => {
          if (ghost) ghost.visible = false;
        });
      });
    }
  } catch {}
}

function showFinalEmptyCellGhostsForPopOut(reason: string = 'final-popout'): number {
  try {
    const rows = (window as any)._ghostPlaceholders;
    if (!Array.isArray(rows) || !grid) return 0;
    let shown = 0;
    for (let r = 0; r < ROWS; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < COLS; c++) {
        const ghost = row[c];
        if (!ghost || ghost.destroyed) continue;
        if (hasVisibleLockedTileAtCell(c, r)) continue;
        const cell = grid?.[r]?.[c];
        const emptyLike =
          cell == null ||
          cell.destroyed === true ||
          (isLockedEmptyPlaceholder(cell) && (cell.visible === false || (cell.alpha ?? 1) <= 0.01));
        if (!emptyLike) continue;
        ghost.visible = true;
        ghost.renderable = true;
        ghost.alpha = Math.max(0.22, Number.isFinite(ghost.alpha) ? ghost.alpha : 1);
        if (ghost.scale?.set) ghost.scale.set(1, 1);
        shown++;
      }
    }
    if (shown > 0) devLog('👻 Final empty-cell ghosts prepared for pop-out', { reason, shown });
    return shown;
  } catch {
    return 0;
  }
}

function holdFinalResidualArtifactsVisible(reason: string = 'final-merge-hold'): void {
  try {
    const ghostLayerLocked = (window as any).__ccFinalGhostLayerLockedHidden === true;
    try { (window as any).__ccForceHideGhosts = false; } catch {}
    try { (window as any).__ccEnterAnimationActive = false; } catch {}
    try { if (backgroundLayer) backgroundLayer.visible = true; } catch {}
    if (!ghostLayerLocked) {
      try { updateGhostVisibility(); } catch {}
    }
    try { showFinalEmptyCellGhostsForPopOut(reason); } catch {}

    const boardTilesToHold = collectFinalBoardTileResidualTargets(tiles);
    let ghostsToHold: any[] = [];
    try {
      ghostsToHold = collectFinalGhostResidualTargets((window as any)._ghostPlaceholders);
    } catch {}

    const held = prepareFinalResidualTargets([...boardTilesToHold, ...ghostsToHold]);
    if (held.length > 0) {
      devLog('👻 Final residual artifacts held visible', {
        reason,
        boardTiles: boardTilesToHold.length,
        ghosts: ghostsToHold.length,
        total: held.length,
      });
    }
  } catch (err) {
    devWarn('⚠️ holdFinalResidualArtifactsVisible failed:', err);
  }
}

function stopFinalResidualTargetIdleFx(target: any): void {
  if (!target) return;
  try { stopTntIdleParticles(target); } catch {}
  try { stopTntIdleShake(target); } catch {}
  try { stopWildJuiceBubbles(target); } catch {}
  try { stopWildIdle(target); } catch {}
  try { (TILE_IDLE_BOUNCE as any).stopForTile?.(target); } catch {}
}

function destroyStackVisualsForFinalResidue(target: any): void {
  if (!target || target.destroyed) return;
  try {
    target._ccSuppressStackVisual = true;
    target.stackDepth = 1;
  } catch {}
  try {
    target.stackG?.destroy?.({ children: true });
    target.stackG = null;
  } catch {}

  const hosts = [target, target.rotG].filter(Boolean);
  hosts.forEach((host: any) => {
    try {
      const children = Array.isArray(host.children) ? [...host.children] : [];
      children.forEach((child: any) => {
        if (!child) return;
        const label = child.label;
        if (label === 'stackG') {
          try { host.removeChild?.(child); } catch {}
          try { child.destroy?.({ children: true }); } catch {}
        }
      });
    } catch {}
  });
}

function hideFinalMergeResultTileVisual(target: any, reason: string = 'final-merge-result'): void {
  if (!target || target.destroyed) return;
  const hideOnce = () => {
    if (!target || target.destroyed) return;
    try {
      target._ccSuppressStackVisual = true;
      target._ccHideFinalMergeResultVisual = true;
      target.stackDepth = 1;
    } catch {}
    try {
      target.stackG?.destroy?.({ children: true });
      target.stackG = null;
    } catch {}
    try { if (target.base) target.base.visible = false; } catch {}
    try { if (target.pips) { target.pips.visible = false; target.pips.clear?.(); } } catch {}
    try { if (target.num) target.num.visible = false; } catch {}
    try { if (target.shadow) target.shadow.visible = false; } catch {}
    try { if (target.overlay) target.overlay.visible = false; } catch {}
  };
  hideOnce();
  try { trackAppAnimationFrame(hideOnce); } catch {}
  try { trackAppAnimationFrame(() => trackAppAnimationFrame(hideOnce)); } catch {}
  try { trackAppTimeout(hideOnce, 80); } catch {}
  devLog('🙈 Final merge result tile visual hidden', { reason });
}

function normalizeFinalMerge6ResidueVisuals(reason: string = 'final-merge'): void {
  try {
    const orphanFinalResidueTargets = collectOrphanFinalBoardTileResidualTargets({
      root: board,
      knownTiles: Array.isArray(tiles) ? tiles : [],
      maxDepth: 2,
    });
    const candidates = [
      ...(Array.isArray(tiles) ? tiles : []),
      ...orphanFinalResidueTargets,
    ];
    let normalized = 0;
    candidates.forEach((target: any) => {
      if (!target || target.destroyed) return;
      const value = target.value | 0;
      if (
        value !== 6 &&
        target._isLastMerge !== true &&
        target._wasWildMagnetMerge6 !== true &&
        target._magnetMerge6Hidden !== true
      ) {
        return;
      }
      destroyStackVisualsForFinalResidue(target);
      if (target._isLastMerge === true || target._ccFinalMergeAllowedByResolver === true) {
        hideFinalMergeResultTileVisual(target, `normalize:${reason}`);
      }
      stopFinalResidualTargetIdleFx(target);
      normalized += 1;
    });
    if (normalized > 0) {
      devLog('🧽 Final merge-6 residue visuals normalized', { reason, normalized });
    }
  } catch (err) {
    devWarn('⚠️ normalizeFinalMerge6ResidueVisuals failed:', err);
  }
}

function isNonFinalMerge6CleanVetoActive(target?: any): boolean {
  try {
    const guardUntil = Number((window as any).__ccNonFinalMerge6GuardUntil || 0);
    if (guardUntil > Date.now()) return true;
  } catch {}
  if (!target || target.destroyed) return false;
  if ((target as any)._ccNonFinalMerge6 === true) return true;
  if ((target as any)._ccFinalMergeAllowedByResolver === false) return true;
  const blockerCount = Number((target as any)._ccFinalMergeBlockerCount || 0);
  return Number.isFinite(blockerCount) && blockerCount > 0;
}

async function animateFinalResidualArtifactsPopOut(reason: string = 'final-merge'): Promise<void> {
  const residualGeneration = gameplayRunGeneration;
  const isArcadeStageResidualPopOut =
    isArcadeHomeRunMode() &&
    typeof reason === 'string' &&
    reason.includes('arcade-handoff');
  const clearTileFromGridEverywhere = (tile: any) => {
    if (!tile || !grid) return;
    try {
      const gxCandidate = tile.gridX;
      const gyCandidate = tile.gridY;
      if (gyCandidate !== undefined && gxCandidate !== undefined && grid?.[gyCandidate]?.[gxCandidate] === tile) {
        grid[gyCandidate][gxCandidate] = null;
      }
    } catch {}
    try {
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c] === tile) {
            grid[r][c] = null;
          }
        }
      }
    } catch {}
  };

  try {
    normalizeFinalMerge6ResidueVisuals(`popout:${reason}`);
    try { (window as any).__ccForceHideGhosts = false; } catch {}
    try { (window as any).__ccEnterAnimationActive = false; } catch {}
    const orphanFinalResidueTargets = collectOrphanFinalBoardTileResidualTargets({
      root: board,
      knownTiles: Array.isArray(tiles) ? tiles : [],
      maxDepth: 2,
    });
    const boardTilesToRemove = collectFinalBoardTileResidualTargets([
      ...(Array.isArray(tiles) ? tiles : []),
      ...orphanFinalResidueTargets,
    ]);
    const silentMerge6TilesToRemove = boardTilesToRemove.filter((t: any) => (t?.value | 0) === 6);
    silentMerge6TilesToRemove.forEach((t: any) => {
      hideFinalMergeResultTileVisual(t, `silent-popout-filter:${reason}`);
    });
    const lockedToRemove = collectFinalLockedResidualTargets(boardTilesToRemove);
    const gridResidualTargets: any[] = [];
    if (Array.isArray(grid)) {
      try {
        grid.forEach((row: any[]) => {
          if (!Array.isArray(row)) return;
          row.forEach((target: any) => {
            if (!target || target.destroyed || gridResidualTargets.includes(target)) return;
            if (!target.scale || typeof target.alpha === 'undefined') return;
            const isResidual = target.locked === true || ((target.value | 0) <= 0 && !target.special);
            if (isResidual) gridResidualTargets.push(target);
          });
        });
      } catch {}
    }
    let ghostList: any[] = [];
    try {
      if (backgroundLayer) backgroundLayer.visible = true;
      showFinalEmptyCellGhostsForPopOut(`popout:${reason}`);
      ghostList = collectFinalGhostResidualTargets((window as any)._ghostPlaceholders);
    } catch {}

    const residualTilesToRemove = [
      ...boardTilesToRemove.filter((t: any) => (t?.value | 0) !== 6),
      ...gridResidualTargets,
    ].filter((target: any, index: number, arr: any[]) => target && arr.indexOf(target) === index);
    const popOutTargets = prepareFinalResidualTargets([
      ...residualTilesToRemove,
      ...ghostList,
    ]);

    [...boardTilesToRemove, ...gridResidualTargets].forEach(stopFinalResidualTargetIdleFx);

    if (popOutTargets.length > 0) {
      devLog('🎬 Final residual artifacts pop-out started', {
        reason,
        boardTiles: boardTilesToRemove.length,
        locked: lockedToRemove.length,
        gridResiduals: gridResidualTargets.length,
        ghosts: ghostList.length,
        total: popOutTargets.length,
      });
      try {
        const popOutPromise = sweetPopOut(popOutTargets as any, isArcadeStageResidualPopOut
          ? {
              stepMin: 0.016,
              stepMax: 0.023,
              jitterMax: 0.12,
              rate: 0.72,
              durationScale: 0.66,
            }
          : {});
        const popOutOutcome = await Promise.race([
          popOutPromise.then(() => 'animation' as const),
          waitTrackedResult(isArcadeStageResidualPopOut ? 1200 : 1800),
        ]);
        if (popOutOutcome === 'cancelled') return;
      } catch (animationError) {
        devWarn('⚠️ Final residual artifacts pop-out failed:', animationError);
      }
      if (await waitTrackedResult(isArcadeStageResidualPopOut ? 60 : 120) === 'cancelled') return;
      if (residualGeneration !== gameplayRunGeneration) return;
    }

    residualTilesToRemove.forEach((t: any) => {
      const placeholder = (t as any)?._placeholderHolder;
      if (placeholder && placeholder !== t) {
        clearTileFromGridEverywhere(placeholder);
        try {
          placeholder.visible = false;
          placeholder.alpha = 0;
          placeholder.eventMode = 'none';
        } catch {}
        try { removeTile(placeholder); } catch {}
        try { (t as any)._placeholderHolder = undefined; } catch {}
      }

      clearTileFromGridEverywhere(t);
      try {
        t.visible = false;
        t.alpha = 0;
        t.eventMode = 'none';
      } catch {}
      try { removeTile(t); } catch {}
    });

    cleanupFinalGhostResidualTargets(ghostList);
    hideFinalGhostLayerAfterPopOut(reason);
  } catch (err) {
    devWarn('⚠️ Final residual artifacts pop-out cleanup failed:', err);
  }
}

function hardCleanupArcadeFinalMergeTerminalResidue(reason: string = 'arcade-stage-clear'): void {
  const clearTileFromGridEverywhere = (tile: any) => {
    if (!tile || !grid) return;
    try {
      const gxCandidate = tile.gridX;
      const gyCandidate = tile.gridY;
      if (gyCandidate !== undefined && gxCandidate !== undefined && grid?.[gyCandidate]?.[gxCandidate] === tile) {
        grid[gyCandidate][gxCandidate] = null;
      }
    } catch {}
    try {
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c] === tile) grid[r][c] = null;
        }
      }
    } catch {}
  };

  try {
    normalizeFinalMerge6ResidueVisuals(`arcade-terminal:${reason}`);
    const orphanFinalResidueTargets = collectOrphanFinalBoardTileResidualTargets({
      root: board,
      knownTiles: Array.isArray(tiles) ? tiles : [],
      maxDepth: 2,
    });
    const candidates = [
      ...(Array.isArray(tiles) ? tiles : []),
      ...orphanFinalResidueTargets,
    ];
    const targetsToRemove: any[] = [];

    candidates.forEach((target: any) => {
      if (!target || target.destroyed || targetsToRemove.includes(target)) return;
      const placeholder = target._placeholderHolder;
      if (placeholder && !placeholder.destroyed && !targetsToRemove.includes(placeholder)) {
        targetsToRemove.push(placeholder);
      }
      if (target.locked === true || isFinalBoardTileResidueCandidate(target)) {
        targetsToRemove.push(target);
      }
    });

    targetsToRemove.forEach((target: any) => {
      if (!target || target.destroyed) return;
      stopFinalResidualTargetIdleFx(target);
      if ((target.value | 0) === 6 || target._isLastMerge === true || target._ccFinalMergeAllowedByResolver === true) {
        hideFinalMergeResultTileVisual(target, `arcade-terminal:${reason}`);
      }
      clearTileFromGridEverywhere(target);
      try {
        target.visible = false;
        target.renderable = false;
        target.alpha = 0;
        target.eventMode = 'none';
      } catch {}
      try { removeTile(target); } catch {}
    });

    if (targetsToRemove.length > 0) {
      devLog('🧹 Arcade terminal final merge residue removed', {
        reason,
        removed: targetsToRemove.length,
      });
    }
  } catch (err) {
    devWarn('⚠️ Arcade terminal final merge residue cleanup failed:', err);
  }
}

// Export to window for use in board.js
window.setGhostVisibility = setGhostVisibility;
window.updateGhostVisibility = updateGhostVisibility;
window.hideGhostPlaceholders = hideGhostPlaceholders;
(window as any).hideGhostsUnderLockedTiles = hideGhostsUnderLockedTiles;

// 🔥 v70 STYLE: Draw ghost placeholders for empty cells
function drawBoardBG(mode = 'active+empty'){
  if (!backgroundLayer) {
    initializeBackgroundLayer();
  }

  if (mode === 'none') {
    try { hideGhostPlaceholders(); } catch {}
    try { if (backgroundLayer) backgroundLayer.visible = false; } catch {}
    return;
  }
  
  // 🔥 v70 STYLE: Update ghost visibility based on grid state
  // Show ghosts for empty cells (where grid[r][c] === null)
  updateGhostVisibility();
}

const { updateHUD, animateScore, animateBoardHUD } = createHudHelpers({
  getScore: () => score,
  setScore: (v) => { score = v; },
  getBoardNumber: () => boardNumber,
  setBoardNumber: (v) => { boardNumber = v; },
  getMoves: () => moves,
  getCombo: () =>
    typeof window.CC?.getCombo === 'function'
      ? window.CC.getCombo()
      : combo,
  setCombo: (v) => { combo = v; },
  syncSharedState,
  SCORE_CAP,
  HUD,
  getFallbackUpdateHUD: () => (typeof _updateHUD === 'function' ? _updateHUD : undefined),
  getAnimateScore: () => (typeof _animateScore === 'function' ? _animateScore : undefined),
  getAnimateBoard: () => (typeof _animateBoard === 'function' ? _animateBoard : undefined),
  getSetBoard: () => (typeof _setBoard === 'function' ? _setBoard : undefined),
});
// 🔥 v112: fixHoverAnchor moved to app-core-helpers.ts
// Imported: fixHoverAnchor

// -------------------- board build --------------------
function resetBoardContainer(){
  resetBoardContainerHelper({
    board,
    boardBG,
    backgroundLayer,
    setBackgroundLayer: (v) => { backgroundLayer = v; },
    ROWS,
    COLS,
    initializeBackgroundLayer,
    updateGhostVisibility,
    hideGhostPlaceholders,
    devLog,
    devWarn,
    devError,
  });
}
function revealPreparedGameplaySurface(): void {
  try {
    if (stage) {
      stage.visible = true;
      stage.alpha = 1;
      stage.renderable = true;
    }
    if (board) {
      board.visible = true;
      board.alpha = 1;
      board.renderable = true;
    }
    if (hud) {
      hud.visible = true;
      hud.alpha = 1;
      hud.renderable = true;
    }
    const canvas = app?.canvas as HTMLCanvasElement | null | undefined;
    if (canvas && !isArcadeEntrySurfaceGateActive()) {
      canvas.style.display = 'block';
      canvas.style.visibility = 'visible';
      canvas.style.opacity = '1';
      canvas.style.pointerEvents = 'auto';
    }
    // A texture recovery that completed while entry was pending deliberately
    // left the canvas hidden. The entry commit is the sole safe reveal owner.
    try { app?.renderer?.render?.(stage); } catch {}
    restoreCanvasAfterCoreTextureRecovery();
  } catch {}
}

function releaseBoardTransitionCoverAfterPreparedFrame(gameplayGeneration: number): void {
  const lease = boardTransitionPresentationHandoff.claimForGameplayEntry(gameplayGeneration);
  if (!lease) return;
  void boardTransitionPresentationHandoff.releaseAfterPreparedFrames({
    lease,
    renderPreparedFrame: () => {
      try { app?.renderer?.render?.(stage); } catch {}
    },
  });
}

export async function recoverFreshArcadeEntryAfterFailedLoad(): Promise<void> {
  delete (window as any).__ccSkipRebuildBoard;
  delete (window as any).__ccArcadeContinuationCueRound;
  cancelGameplayEntryPreparation();
  cancelArcadeEntryCueOwner();
  cancelArcadeEntrySurfaceGate();
  await startLevel(1);
}
function rebuildBoard(){
  const gameplayEntryGeneration = activeGameplayEntryGeneration;
  let gameplayEntrySignal: AbortSignal | null = null;
  const arcadeEntryCueRound = isArcadeHomeRunMode()
    ? Math.max(0, Math.trunc(Number((window as any).__ccArcadeContinuationCueRound) || 0))
    : 0;
  if (arcadeEntryCueRound > 0) {
    engageArcadeEntrySurfaceGate(app?.canvas ?? null);
    delete (window as any).__ccArcadeContinuationCueRound;
  }
  stopTileIdleBounce({ TILE_IDLE_BOUNCE, devLog, devWarn });
  tutorialFinalChanceSpawnCount = 0;
  
  prepareBoardForRebuild({
    resetBoardContainer,
    resetTilesForRebuild: () => {
      // NOTE: FX/timer cleanup is handled centrally in cleanupFxForBoardReset()
      resetTilesForRebuild({
        tiles,
        gsap,
        stopWildIdle,
        stopWildShimmer,
        stopWildStars,
        stopWildJuiceBubbles,
        stopMagnetIdleParticles,
        stopTntIdleParticles,
        stopTntIdleShake,
        stopSpecialDiceIdleMotion,
        cleanupTilesForRebuild,
        devWarn,
      });
    },
    // 🔥 NOTE: FX cleanup handled centrally via cleanupFxForBoardReset()
    initializeBoardGrid: () => initializeBoardGrid({ createEmptyGrid, drawBoardBG }),
  });

  createAndOpenBoard({
    ROWS,
    COLS,
    board,
    grid,
    tiles,
    makeBoard,
    fixHoverAnchor,
    drag,
    randVal,
    createLockedHolders,
    openRandomTiles,
  });

  finalizeBoardVisibility({ tiles, drawBoardBG });
  if (arcadeEntryCueRound > 0) {
    // The current-Round cue owns the empty visual stage. Prevent the freshly
    // constructed board from painting before its normal sweetPopIn begins.
    tiles.forEach((tile: any) => { if (tile) tile.visible = false; });
  }
  try { hideGhostPlaceholders(); } catch {}
  
  // 🔥 CRITICAL FIX: Ensure background layer exists and is visible
  // If backgroundLayer was destroyed in cleanupGame(), it will be null
  // initializeBackgroundLayer() is called in startLevel() after rebuildBoard()
  // But we need to ensure it's visible here if it exists
  ensureBackgroundLayerVisible({
    board,
    backgroundLayer,
    devLog,
    devWarn,
  });
  
  // Prepare the single board-entry commit. It will run only after layout/HUD readiness.
  let popInSafetyNetScheduled = false;
  const scheduleBoardPopInSafetyNet = () => {
    if (popInSafetyNetScheduled) return;
    popInSafetyNetScheduled = true;
    schedulePopInSafetyNet({
      tiles,
      gsap,
      app,
      updateGhostVisibility,
      devWarn,
      trackAppTimeout,
    });
  };
  const sweetPopInRunner = createSweetPopInRunner({
    tiles,
    sweetPopIn,
    onHalf: () => {
      if (gameplayEntrySignal?.aborted || !isGameplayEntryGenerationLatest(gameplayEntryGeneration)) return;
      handleHudDropOnHalf({
        app,
        HUD,
        hudRootFromWindow: (window as any).HUD_ROOT || null,
        trackAppAnimationFrame,
        devLog,
        devWarn,
        devError,
        hudDropPending: _hudDropPending,
        setHudDropPending: (v) => { _hudDropPending = v; },
      });
      // One clear board-entry confirmation; per-tile haptics are intentionally absent.
      try {
        if (typeof (window as any).triggerHapticImpact === 'function') {
          (window as any).triggerHapticImpact('medium');
        }
      } catch {}
    },
    beforePopIn: arcadeEntryCueRound > 0
      ? async () => {
          try {
            await consumeArcadeEntryCue(arcadeEntryCueRound);
            devLog(`🎮 Fresh Arcade Round ${String(arcadeEntryCueRound).padStart(2, '0')} cue completed before tile entrance`);
          } finally {
            if (!gameplayEntrySignal?.aborted && isGameplayEntryGenerationLatest(gameplayEntryGeneration)) {
              // The 800ms visibility watchdog must start after the intentional
              // multi-second Round cue. Starting it at board construction used
              // to force all hidden dice visible through the cue backdrop.
              scheduleBoardPopInSafetyNet();
            }
          }
        }
      : undefined,
    onPopInStarted: () => {
      if (gameplayEntrySignal?.aborted || !isGameplayEntryGenerationLatest(gameplayEntryGeneration)) return;
      if (arcadeEntryCueRound > 0) releaseArcadeEntrySurfaceGateAfterPreparedFrame(app, stage);
    },
    shouldAbort: () => gameplayEntrySignal?.aborted === true ||
      !isGameplayEntryGenerationLatest(gameplayEntryGeneration),
    getAbortSignal: () => gameplayEntrySignal,
    devLog,
  });
  
  ensureAnimationRunning({ gsap, app });
  const sweetPopPromise = prepareGameplayEntryCommit(
    gameplayEntryGeneration,
    (signal) => {
      gameplayEntrySignal = signal;
      if (signal.aborted) return;
      revealPreparedGameplaySurface();
      // The committed generation is the authoritative prepared-surface owner.
      // Cover release must not depend on an optional cue/pop-in callback.
      releaseBoardTransitionCoverAfterPreparedFrame(gameplayEntryGeneration);
      if (arcadeEntryCueRound <= 0) scheduleBoardPopInSafetyNet();
      return sweetPopInRunner();
    },
  );
  
  sweetPopPromise.then(() => {
    if (!isGameplayEntryGenerationLatest(gameplayEntryGeneration)) return;
    (window as any).__ccEnterAnimationActive = false;
    try { updateGhostVisibility(); } catch {}
    handleSweetPopInComplete({
      app,
      board,
      tiles,
      HUD,
      hudRootFromWindow: (window as any).HUD_ROOT || null,
      trackAppAnimationFrame,
      devLog,
      devWarn,
      devError,
      hudDropPending: _hudDropPending,
      setHudDropPending: (v) => { _hudDropPending = v; },
    });
    // Allocate the Wild smoke pool only after board enter settles. Small
    // tracked batches keep this warmup away from both intro and merge frames;
    // normal exit/restart cleanup cancels any batches that have not run yet.
    for (let warmupBatch = 1; warmupBatch <= 10; warmupBatch += 1) {
      trackAppTimeout(() => {
        prewarmWildSmokeGraphicsPool(Math.min(76, warmupBatch * 8));
      }, 260 + (warmupBatch * 70));
    }
  });
  devLog('✅ sweetPopIn prepared behind the gameplay-entry readiness barrier');

  syncSharedState();

}

// Board exit animation - reverse of sweetPopIn
async function animateBoardExit(){
  devLog('🎬🎬🎬 animateBoardExit() CALLED');
  setJourneyGameBottomDecorVisible(false);
  
  // 🔥 NUCLEAR BAILOUT: If app or stage are destroyed/null, skip animation entirely
  // This prevents crashes when exitToMenu is called after cleanup
  if (!app || !stage || (app as any).destroyed || (stage as any).destroyed) {
    devWarn('⚠️ animateBoardExit: PIXI app/stage destroyed - skipping animation');
    return Promise.resolve();
  }
  
  // 🔥 CRITICAL FIX: Ensure canvas/app is visible BEFORE playing exit animation
  // This fixes the bug where board "just disappears" without animation
  ensureExitVisibility({ app, stage, board, hud, devLog, devWarn });
  
  // CRITICAL: Hide board indicator (board tag) before exit animation
  try {
    const { animateBoardIndicatorExit } = await import('./hud-helpers.js');
    if (typeof animateBoardIndicatorExit === 'function') {
      animateBoardIndicatorExit(0.3);
      devLog('✅ Board exit: Board indicator exit animation started');
    }
  } catch (e) {
    devWarn('⚠️ Board exit: Error hiding board indicator:', e);
  }
  
  // CRITICAL: Stop tile idle bounce before exit animation (prevents new smoke bubbles)
  try {
    TILE_IDLE_BOUNCE.stop();
    devLog('✅ Board exit: Tile idle bounce stopped');
  } catch (e) {
    devWarn('⚠️ Board exit: Error stopping tile idle bounce:', e);
  }
  
  // 🔥 BUG FIX: Stop magnet idle particles IMMEDIATELY before exit animation
  // This prevents particles from being visible during exit animation and journey screen enter
  stopMagnetParticlesOnExit({
    tiles: STATE?.tiles || [],
    stopMagnetIdleParticles,
    devLog,
    devWarn,
  });

  // 🔥 DIAGNOSTICS: Log stats before exit animation
  logBoardExitStats('before-exit');

  const finalResidualAlreadyPopped = (window as any).__ccFinalResidualPopOutPrepared === true;
  cleanupBeforeBoardExit({ HUD, backgroundLayer, finalResidualAlreadyPopped, devLog, devWarn });
  
  const { effectiveTiles, skip, cancelled } = await selectTilesForExit({
    STATE,
    tiles,
    windowTiles: (window as any).STATE?.tiles || [],
    devLog,
    devWarn,
    HUD,
    waitTrackedResult,
    includeGhostPlaceholders: !finalResidualAlreadyPopped,
  });
  if (cancelled) return Promise.resolve();
  if (skip) return Promise.resolve();
  
  startHudExitAnimation({ HUD, devLog, devWarn });
  
  const exitCompleted = await runExitAnimation({
    tiles: effectiveTiles,
    sweetPopOut,
    waitTrackedResult,
    devLog,
    devWarn,
  });
  if (!exitCompleted) return Promise.resolve();

  // The board exit owner must not globally kill tracked DOM/modal/Homepage
  // tweens. Route-level cleanup runs after the active surface has completed;
  // this boundary owns only the board animation awaited above.
  try {
    memoryManager.performCleanup();
    devLog('✅ Board exit: Memory cleanup completed');
  } catch (error) {
    devWarn('⚠️ Board exit: Memory cleanup failed:', error);
  }

  // 🔥 DIAGNOSTICS: Log stats after cleanup
  logBoardExitStats('after-cleanup');
  return Promise.resolve();
}

// 🔥 v112: tintLocked moved to app-core-helpers.ts
// Imported: tintLocked
// 🔥 v112: randVal moved to app-core-utils.ts
// Imported: randVal
let journeyGameBottomDecorRunKey = 0;
let journeyGameBottomDecorLifecycleToken = 0;
let journeyGameBottomDecorTween: gsap.core.Animation | null = null;

async function waitForJourneyGameBottomDecorReady(
  img: HTMLImageElement,
  timeoutMs = 1000,
): Promise<void> {
  const waitForDecode = async (): Promise<void> => {
    if (typeof img.decode !== 'function') return;
    let timeoutId: number | null = null;
    try {
      await Promise.race([
        img.decode().catch(() => undefined),
        new Promise<void>((resolve) => {
          timeoutId = window.setTimeout(resolve, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    }
  };

  if (img.complete && img.naturalWidth > 0) {
    await waitForDecode();
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      img.removeEventListener('load', finish);
      img.removeEventListener('error', finish);
      resolve();
    };
    const timeoutId = window.setTimeout(finish, timeoutMs);
    img.addEventListener('load', finish, { once: true });
    img.addEventListener('error', finish, { once: true });
  });

  await waitForDecode();
}

function killJourneyGameBottomDecorTween(): void {
  if (!journeyGameBottomDecorTween) return;
  try { journeyGameBottomDecorTween.kill(); } catch {}
  journeyGameBottomDecorTween = null;
}

function updateJourneyGameBottomDecorSource(img: HTMLImageElement): void {
  const currentBoard =
    STATE?.boardNumber && Number.isFinite(STATE.boardNumber)
      ? STATE.boardNumber
      : boardNumber;
  const boardKey = String(Math.max(1, Math.floor(Number(currentBoard) || 1)));
  const runKey = String(journeyGameBottomDecorRunKey);
  const decorAsset = getJourneyBottomDecorAssetForBoard(Number(boardKey));
  if (img.dataset.decorKey === decorAsset.key && img.dataset.boardKey === boardKey && img.dataset.runKey === runKey) return;

  const oneXUrl = encodeURI(decorAsset.oneX);
  img.src = oneXUrl;
  img.srcset = decorAsset.twoX
    ? `${oneXUrl} 1x, ${encodeURI(decorAsset.twoX)} 2x`
    : `${oneXUrl} 1x`;
  img.dataset.decorKey = decorAsset.key;
  img.removeAttribute('data-decor-index');
  img.dataset.boardKey = boardKey;
  img.dataset.runKey = runKey;
}

function ensureJourneyGameBottomDecor(): HTMLImageElement | null {
  const host = document.getElementById('app');
  if (!host) return null;
  let img = host.querySelector<HTMLImageElement>('#journey-game-bottom-decor');
  if (!img) {
    img = document.createElement('img');
    img.id = 'journey-game-bottom-decor';
    img.className = 'journey-game-bottom-decor';
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.decoding = 'async';
    img.draggable = false;
    img.hidden = true;
    host.appendChild(img);
  }
  return img;
}

function primeJourneyGameBottomDecor(img: HTMLImageElement): void {
  img.hidden = false;
  img.classList.remove('is-visible', 'is-entering', 'is-exiting');
  img.classList.add('is-prepared');
  gsap.set(img, {
    y: JOURNEY_BOTTOM_DECOR_MOTION.start.y,
    scaleX: JOURNEY_BOTTOM_DECOR_MOTION.start.scaleX,
    scaleY: JOURNEY_BOTTOM_DECOR_MOTION.start.scaleY,
    opacity: 0,
    transformOrigin: '50% 100%',
    force3D: true,
  });
}

function prepareJourneyGameBottomDecor(): Promise<void> {
  const host = document.getElementById('app');
  const img = ensureJourneyGameBottomDecor();
  if (!host || !img) return Promise.resolve();

  ++journeyGameBottomDecorLifecycleToken;
  killJourneyGameBottomDecorTween();
  host.classList.add('journey-board-game-active');
  document.body?.classList.add('journey-board-game-active');
  updateJourneyGameBottomDecorSource(img);
  primeJourneyGameBottomDecor(img);
  // Decode while the board transition is still covering gameplay. The visible
  // HUD/board-enter callback owns the animation itself.
  return waitForJourneyGameBottomDecorReady(img);
}

function setJourneyGameBottomDecorVisible(visible: boolean): void {
  const host = document.getElementById('app');
  if (!host) return;
  const img = visible ? ensureJourneyGameBottomDecor() : host.querySelector<HTMLImageElement>('#journey-game-bottom-decor');
  if (!img) {
    host.classList.toggle('journey-board-game-active', visible);
    return;
  }
  if (visible) {
    const alreadyVisible = !img.hidden &&
      !img.classList.contains('is-exiting') &&
      (img.classList.contains('is-visible') || img.classList.contains('is-entering'));
    host.classList.add('journey-board-game-active');
    document.body?.classList.add('journey-board-game-active');
    if (alreadyVisible) {
      return;
    }
    updateJourneyGameBottomDecorSource(img);
    const lifecycleToken = ++journeyGameBottomDecorLifecycleToken;
    killJourneyGameBottomDecorTween();
    primeJourneyGameBottomDecor(img);
    img.classList.remove('is-prepared');
    img.classList.add('is-entering');

    void waitForJourneyGameBottomDecorReady(img).then(() => {
      if (
        lifecycleToken !== journeyGameBottomDecorLifecycleToken ||
        img.hidden ||
        img.classList.contains('is-exiting') ||
        !host.classList.contains('journey-board-game-active')
      ) return;

      const enterTimeline = trackTimeline({
        onComplete: () => {
          if (lifecycleToken !== journeyGameBottomDecorLifecycleToken) return;
          journeyGameBottomDecorTween = null;
          img.classList.remove('is-entering');
          img.classList.add('is-visible');
          gsap.set(img, { clearProps: 'transform,opacity,willChange' });
        },
      });
      journeyGameBottomDecorTween = enterTimeline;
      enterTimeline
        .to(img, {
          y: 0,
          scaleX: JOURNEY_BOTTOM_DECOR_MOTION.enter.arrivalScaleX,
          scaleY: JOURNEY_BOTTOM_DECOR_MOTION.enter.arrivalScaleY,
          opacity: 1,
          duration: JOURNEY_BOTTOM_DECOR_MOTION.enter.travelDurationSeconds,
          ease: JOURNEY_BOTTOM_DECOR_MOTION.enter.travelEase,
          force3D: true,
          overwrite: 'auto',
        })
        .to(img, {
          scaleX: 1,
          scaleY: 1,
          duration: JOURNEY_BOTTOM_DECOR_MOTION.enter.settleDurationSeconds,
          ease: JOURNEY_BOTTOM_DECOR_MOTION.enter.settleEase,
          force3D: true,
        });
    });
    return;
  }
  const lifecycleToken = ++journeyGameBottomDecorLifecycleToken;
  const exitOpacity = Number(gsap.getProperty(img, 'opacity'));
  killJourneyGameBottomDecorTween();
  if (img.hidden) {
    img.classList.remove('is-visible', 'is-entering', 'is-exiting', 'is-prepared');
    host.classList.remove('journey-board-game-active');
    document.body?.classList.remove('journey-board-game-active');
    gsap.set(img, { clearProps: 'transform,opacity,willChange' });
    return;
  }
  // Freeze the current rendered alpha before removing the steady-state class,
  // otherwise CSS would snap the image to opacity 0 before GSAP can exit it.
  gsap.set(img, { opacity: Number.isFinite(exitOpacity) ? exitOpacity : 1 });
  img.classList.remove('is-visible', 'is-entering', 'is-prepared');
  img.classList.add('is-exiting');

  const finishHide = () => {
    if (lifecycleToken !== journeyGameBottomDecorLifecycleToken) return;
    journeyGameBottomDecorTween = null;
    img.hidden = true;
    img.classList.remove('is-exiting', 'is-prepared');
    host.classList.remove('journey-board-game-active');
    document.body?.classList.remove('journey-board-game-active');
    gsap.set(img, { clearProps: 'transform,opacity,willChange' });
  };

  journeyGameBottomDecorTween = trackTween(img, {
    y: JOURNEY_BOTTOM_DECOR_MOTION.exit.y,
    scaleX: JOURNEY_BOTTOM_DECOR_MOTION.exit.scaleX,
    scaleY: JOURNEY_BOTTOM_DECOR_MOTION.exit.scaleY,
    opacity: 0,
    duration: JOURNEY_BOTTOM_DECOR_MOTION.exit.durationSeconds,
    ease: JOURNEY_BOTTOM_DECOR_MOTION.exit.ease,
    force3D: true,
    overwrite: 'auto',
    onComplete: finishHide,
    onInterrupt: finishHide,
  });
}

function showJourneyGameBottomDecorForHudDrop(): void {
  setJourneyGameBottomDecorVisible(shouldShowJourneyBottomDecor({
    isArcade: isArcadeHomeRunMode(),
    isJourneyOrigin: isJourneyOriginActive(),
  }));
}

try {
  (window as any).__ccShowJourneyGameBottomDecorForHudDrop = showJourneyGameBottomDecorForHudDrop;
  (window as any).__ccHideJourneyGameBottomDecor = () => setJourneyGameBottomDecorVisible(false);
} catch {}

async function startLevel(n): Promise<void> {
  const startLevelGeneration = beginGameplayEntryPreparation(`startLevel:${n}`);
  // Warm the Backpack/Crate frames alongside the board texture barrier. The
  // first reward must not begin decoding its entrance only after the meter is
  // already visibly full.
  void preloadWildSpawnDropAssets();
  // Retire every callback/wait owned by the previous board before the new
  // generation begins awaiting textures or creating tiles.
  try { clearAllAppTimeouts(); } catch {}
  try { clearAllAppAnimationFrames(); } catch {}
  try { FLOW.cleanupLevelFlowTimeouts(); } catch {}
  activeGameplayEntryGeneration = startLevelGeneration;
  const isCurrentStartLevel = () =>
    activeGameplayEntryGeneration === startLevelGeneration &&
    isGameplayEntryGenerationLatest(startLevelGeneration);
  devLog('🎯 startLevel called with:', n, 'current level:', level, 'current boardNumber:', boardNumber, 'current score:', score);
  resetTransientRunGuards('startLevel');
  // 🔥 Enter animation active: updateGhostVisibility will only hide ghosts until pop-in completes
  (window as any).__ccEnterAnimationActive = true;
  startBoardFrameBudgetMonitor(app?.ticker);
  startPixiMobileFrameController(app?.ticker);
  try { hideGhostPlaceholders(); } catch {}
  // Hide the previous surface before the first asynchronous texture boundary.
  // The new surface is revealed later in this function immediately before its
  // synchronous reset/rebuild, leaving no stale-board compositor frame.
  try { if (stage) stage.visible = false; } catch {}
  try { if (board) board.visible = false; } catch {}
  try { if (hud) hud.visible = false; } catch {}
  const deferSurfaceRevealForSavedLoad = (window as any).__ccSkipRebuildBoard === true;

  try {
    const refreshedAssets = await ensureCoreRenderTexturesGpuReady('startLevel');
    if (!isCurrentStartLevel()) return;
    refreshLiveCoreGameSpriteTextures('startLevel');
    if (refreshedAssets.length > 0) {
      if (refreshedAssets.some((assetPath) => isCoreHudTextureAsset(assetPath))) {
        _hudInitDone = false;
        try { (window as any).__ccForceHudRecreateForTextures = true; } catch {}
      }
    }
  } catch (error) {
    devError('❌ Core render texture barrier blocked startLevel reveal', error);
    throw error;
  }
  
  runStartLevelFxPrep({
    resetGlobalFxLayer,
    cleanupFxForBoardReset,
    softResetBoardView,
    devLog,
  });
  
  // 🔥 CRITICAL FIX: Ensure board and hud are visible BEFORE anything else
  // This fixes the issue where board is hidden after cleanup and not restored
  if (!deferSurfaceRevealForSavedLoad) {
    ensureStartLevelVisibility({ stage, board, hud, devLog, devWarn, devError });
  } else {
    devLog('⏭️ startLevel: Saved-state load owns the next visible board commit');
  }
  
  // 🔥 NOTE: FX cleanup handled centrally via cleanupFxForBoardReset()
  
  {
    const next = applyStartLevelState({
      n,
      STATE,
      boardSpecificRules,
      devLog,
    });
    level = next.level;
    boardNumber = next.boardNumber;
    score = next.score;
  }
  
  if (isArcadeHomeRunMode()) {
    setJourneyGameBottomDecorVisible(false);
  } else {
    // Journey progression must never receive Arcade Round numbers or scores.
    updateJourneyRunState({ n, score, devLog, devWarn });
    // Prime/decode behind the board transition. The visible HUD/board enter
    // callback starts the actual cartoon pop-in so it cannot finish offscreen.
    journeyGameBottomDecorRunKey += 1;
    await prepareJourneyGameBottomDecor();
    if (!isCurrentStartLevel()) return;
  }
  
  // STATS TRACKING: Update highest board reached
  updateStartLevelStats({ n, statsService, devLog, devError });
  if (isArcadeHomeRunMode()) {
    try {
      arcadeStatsService.updateHighestStageOpened(n);
    } catch (error) {
      devWarn('⚠️ Failed to update Arcade highest stage opened:', error);
    }
  }
  
  incrementBoardTimesPlayed({ n, devLog });
  if (!isArcadeHomeRunMode()) {
    syncJourneyBoards({ n, devLog, devWarn });
  }
  
  moves = MOVES_MAX;
  // Track best stack depth achieved in this run (for clean board efficiency)
  try { STATE.maxStackDepth = 1; } catch {}
  // 🔥 CRITICAL: Don't reset busyEnding here - let runEndgameFlow handle it in finally block
  // busyEnding = false; // REMOVED - runEndgameFlow resets it in finally block
  hudResetCombo();
  devLog('🎯 startLevel updated - level:', level, 'boardNumber:', boardNumber, 'score preserved:', score);
  clearComboIdleTimer({ comboIdleTimer });
  const preserveArcadeWildRunProgress =
    isArcadeHomeRunMode() &&
    (window as any).__ccArcadeStageContinuePreserveWild === true;
  const arcadeWildMeterCarryover = preserveArcadeWildRunProgress
    ? Math.max(0.25, Math.min(0.4, Number((window as any).__ccArcadeStageWildMeterCarryover) || 0.25))
    : 0;
  
  resetWildAndEndgameState({
    setWildMeter: (v) => { wildMeter = v; },
    resetWildProgress,
    setFirstWildSpawned: (v) => { firstWildSpawned = v; },
    setWildSpawnCount: (v) => { wildSpawnCount = v; },
    setWildMergeLockedSpawnCount: (v) => { wildMergeLockedSpawnCount = v; },
    setLastWildDropType: (v) => { lastWildDropType = v as any; },
    setWildDropTypeStreak: (v) => { wildDropTypeStreak = v; },
    preserveWildDropProgress: preserveArcadeWildRunProgress,
    carryoverWildMeter: arcadeWildMeterCarryover,
    clearEndGameCache,
  });
  delete (window as any).__ccArcadeStageContinuePreserveWild;
  delete (window as any).__ccArcadeStageWildMeterCarryover;
  
  // 🔥 CRITICAL FIX: Skip rebuildBoard if loading saved state
  // This prevents creating an empty board before loadGameState restores tiles
  handleStartLevelHudDrop({
    HUD,
    gsap,
    logger,
    getHudRootFromWindow: () => (window as any).HUD_ROOT,
    isTriggerHudDrop: () => !!(window as any).__ccTriggerHudDrop,
    clearTriggerHudDrop: () => { delete (window as any).__ccTriggerHudDrop; },
    setHudDropPending: (v) => { _hudDropPending = v; },
    setHudInitDone: (v) => { _hudInitDone = v; },
  });
  
  maybeRebuildBoard({
    rebuildBoard,
    logger,
    getSkipRebuildFlag: () => !!(window as any).__ccSkipRebuildBoard,
  });
  
  saveAfterBoardStart({
    boardNumber,
    trackAppTimeout,
    saveGameState,
    devLog,
  });

  runStartLevelPost({ syncSharedState, updateHUD });
  
  await ensureStartLevelLayout({
    layoutBoard,
    initializeBackgroundLayer,
    board,
    backgroundLayer,
    setBackgroundLayer: (v) => { backgroundLayer = v; },
    updateGhostVisibility,
    hideGhostPlaceholders,
    devError,
  });
  if (!isCurrentStartLevel()) return;
  if (deferSurfaceRevealForSavedLoad) {
    // layoutBoard may prepare child visibility, but the reused stage must stay
    // paint-proof until loadGameState has replaced it and uiManager commits it.
    try { if (stage) stage.visible = false; } catch {}
    try { if (board) board.visible = false; } catch {}
    try { if (hud) hud.visible = false; } catch {}
  }
  
  syncHudRootVisibility({
    HUD,
    getHudRootFromWindow: () => (window as any).HUD_ROOT,
    isHudDropPending: () => _hudDropPending,
  });

  // Commit one hidden prepared renderer frame after textures, fonts, HUD and
  // final board layout are ready. If gameplay is already visible (next Round),
  // start immediately; Homepage/Journey callers commit from showApp().
  try { app?.renderer?.render?.(stage); } catch {}
  const appElement = document.getElementById('app');
  const appIsVisible = !!appElement &&
    !appElement.hasAttribute('hidden') &&
    appElement.style.display !== 'none' &&
    appElement.style.visibility !== 'hidden';
  if (appIsVisible && hasPreparedGameplayEntry()) {
    await commitPreparedGameplayEntry();
    if (!isCurrentStartLevel()) return;
  }
  
  // layoutBoard() already called above; avoid duplicate on board 1
  
  // Don't check level end immediately - let the game play first
  // trackDelayedCall(0.1, checkLevelEnd); // REMOVED - causes immediate fail screen
  // 🔥 ENDGAME HINT: refresh after board is fully visible (covers hard-exit resume)
  trackAppTimeout(() => {
    if (!isCurrentStartLevel()) return;
    updateEndgameHintState();
  }, 600);
}

// --- local Wild skin fallback
function applyWildSkinLocal(tile){
  applyWildSkinLocalCore(tile, {
    Assets,
    Texture,
    Rectangle,
    ASSET_WILD,
    ASSET_WILD_MAGNET,
    ASSET_WILD_JUICE,
    ASSET_WILD_TNT,
    TILE,
    startWildShimmer,
    startWildJuiceBubbles,
    startWildStars,
    startMagnetIdleParticles,
    startTntIdleParticles,
    startTntIdleShake,
    stopTntIdleParticles,
    stopTntIdleShake,
    trackAppAnimationFrame,
    devWarn,
  });
}

function bindTileWithFallback(tile, skipBind){
  bindTileWithFallbackCore({
    tile,
    skipBind,
    drag,
    trackAppAnimationFrame,
    trackAppTimeout,
  });
}

function hardFallbackSpawnAtCell(
  c: number,
  r: number,
  {
    value = null,
    wildMergeTarget = null,
    clearExisting = true,
    reason = 'unknown',
  }: {
    value?: number | null;
    wildMergeTarget?: number | null;
    clearExisting?: boolean;
    reason?: string;
  } = {}
): boolean {
  try {
    if (clearExisting && grid?.[r]?.[c]) {
      const existing = grid[r][c];
      if (existing && !existing.destroyed && tiles.includes(existing)) removeTile(existing);
      grid[r][c] = null;
    } else if (grid?.[r]?.[c]) {
      grid[r][c] = null;
    }

    const t = makeBoard?.createTile?.({ board, grid, tiles, c, r, val: 0, locked: true });
    if (!t) return false;

    t.locked = false;
    try { makeBoard.syncTileZIndex?.(t, board); } catch {}
    t.eventMode = 'static';
    t.cursor = 'pointer';
    bindTileWithFallback(t, false);
    resetTileToNormalState(t);

    const spawnValue = value ?? randomRegularTileValue(wildMergeTarget || undefined);
    makeBoard?.setValue?.(t, spawnValue, 0);
    normalizeSpawnedTileVisual(t);
    try { fixHoverAnchor?.(t); } catch {}
    try { drawBoardBG?.(); } catch {}
    SPAWN?.spawnBounce?.(t, gsap, {
      max: 1.08,
      compress: 0.96,
      rebound: 1.02,
      startScale: 0.30,
      wiggle: 0.035,
      fadeIn: 0.10,
      timeScale: 2.0,
      keepFullOpacity: true,
    });
    return true;
  } catch (err) {
    devWarn('⚠️ hardFallbackSpawnAtCell failed', { c, r, reason, err });
    return false;
  }
}

// --- spawn exactly at grid cell ---
function openAtCell(c, r, { value=null, isWild=false, isWildMagnet=false, isWildJuice=false, isWildTnt=false, skipBind=false, timeScale=1.0, forceFreshPlaceholder=false, skipSpawnAnimation=false }: {
  value?: number | null;
  isWild?: boolean;
  isWildMagnet?: boolean;
  isWildJuice?: boolean;
  isWildTnt?: boolean;
  skipBind?: boolean;
  timeScale?: number;
  forceFreshPlaceholder?: boolean;
  skipSpawnAnimation?: boolean;
} = {}){
  return openAtCellCore({
    c,
    r,
    options: { value, isWild, isWildMagnet, isWildJuice, isWildTnt, skipBind, timeScale, forceFreshPlaceholder, skipSpawnAnimation },
    grid,
    board,
    tiles,
    makeBoard,
    devWarn,
    bindTileWithFallback,
    applyWildSkinLocal,
    startWildShimmer,
    startWildJuiceBubbles,
    startWildStars,
    startTntIdleParticles,
    startTntIdleShake,
    spawnBounce: adaptSpawnBounce(SPAWN.spawnBounce, gsap),
    gsap,
  });
}

async function ensureRepairSpawnAtCell(
  c: number,
  r: number,
  {
    value = null,
    wildMergeTarget = null,
    clearExistingOnFallback = true,
    reason,
    timeScale = 2.0,
    forceFreshPlaceholder = true,
  }: {
    value?: number | null;
    wildMergeTarget?: number | null;
    clearExistingOnFallback?: boolean;
    reason: string;
    timeScale?: number;
    forceFreshPlaceholder?: boolean;
  }
): Promise<boolean> {
  let spawned = false;

  try {
    spawned = !!(await openAtCell(c, r, {
      value,
      skipBind: false,
      timeScale,
      forceFreshPlaceholder,
    }));
  } catch (err) {
    if (err instanceof OpenCellCancelledError) throw err;
    devWarn('⚠️ Repair openAtCell failed', { c, r, reason, err });
  }

  if (!spawned) {
    spawned = hardFallbackSpawnAtCell(c, r, {
      value,
      wildMergeTarget,
      clearExisting: clearExistingOnFallback,
      reason,
    });
  }

  return !!spawned;
}

function randomEmptyCell(excludeCells?: { r: number; c: number }[]){
  return getRandomEmptyCell({ ROWS, COLS, grid, excludeCells });
}

function spawnLockedTilesWithPop(count: number, excludeCells?: Array<{ c: number; r: number }>): void {
  if (!count || count <= 0) return;
  if (!grid || !board || !makeBoard?.createTile) return;

  const refLocked = tiles.find(t => isLockedEmptyPlaceholder(t) && Number.isFinite((t as any).alpha));
  const lockedAlpha = Number.isFinite((refLocked as any)?.alpha) ? (refLocked as any).alpha : 0.20;

  const excludeSet = excludeCells?.length ? new Set(excludeCells.map(({ c, r }) => `${c},${r}`)) : null;
  const emptyCells: Array<{ c: number; r: number }> = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (excludeSet?.has(`${c},${r}`)) continue; // 🔥 ENDGAME: Exclude dst cell to avoid clash with openAtCell spawn
      if (!grid?.[r]?.[c]) emptyCells.push({ c, r });
    }
  }
  const toCreate: Array<{ c: number; r: number }> = [];
  if (emptyCells.length) {
    for (let i = emptyCells.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [emptyCells[i], emptyCells[j]] = [emptyCells[j], emptyCells[i]];
    }
    toCreate.push(...emptyCells.slice(0, Math.min(count, emptyCells.length)));
  }

  // If there aren't enough empty cells, spawn as many locked tiles as we can.

  toCreate.forEach(({ c, r }, index) => {
    try {
      if (grid?.[r]?.[c]) return; // Cell filled meanwhile
      const t = makeBoard.createTile({ board, grid, tiles, c, r, val: 0, locked: true });
      if (!t) return;
      try { resetTileToNormalState?.(t); } catch {}
      try { delete (t as any)._spawned; } catch {}
      t.locked = true;
      t.eventMode = 'none';
      t.cursor = 'default';
      t.alpha = lockedAlpha;
      devLog('[SPAWN-OPACITY] spawnLockedTilesWithPop (LOCKED)', { cell: `(${c},${r})`, lockedAlpha, tileAlpha: t.alpha });

      // Custom pop-in without setting _spawned (locked tiles must remain spawnable later)
      // Keep alpha low the whole time (no fade to 100%)
      const trg = t.rotG || t;
      const dir = Math.random() < 0.5 ? 1 : -1;
      t.scale?.set?.(0.30, 0.30);
      const delay = index * 150;
      const tl = trackTimeline({
        delay: delay / 1000,
        onComplete: () => {
          if (!t || t.destroyed) return;
          // 🔥 CRITICAL FIX: Only apply lockedAlpha if tile is STILL locked!
          // If openLockedBounceParallel already unlocked this tile (spawned as active), do NOT overwrite alpha
          if (!t.locked) return;
          t._spawned = false;
          t.alpha = lockedAlpha;
          // Ensure locked look persists after any deferred tweens
          trackAppTimeout(() => {
            if (!t || t.destroyed) return;
            if (!t.locked) return; // 🔥 Same check - tile may have been unlocked meanwhile
            t.alpha = lockedAlpha;
            t._spawned = false;
          }, 80);
        }
      });
      tl.to(t.scale, { x: 1.08, y: 1.08,  duration: 0.16, ease: 'back.out(2.1)' }, 0)
        .to(t.scale, { x: 0.96, y: 0.96,  duration: 0.10, ease: 'power2.inOut' })
        .to(t.scale, { x: 1.02, y: 1.02,  duration: 0.10, ease: 'power2.out' })
        .to(t.scale, { x: 1.00, y: 1.00,  duration: 0.12, ease: 'back.out(2)' });
      trackTimeline({ delay: delay / 1000 })
        .to(trg, { rotation:  0.035*dir,      duration: 0.10, ease: 'power2.out' })
        .to(trg, { rotation: -0.035*0.6*dir,  duration: 0.12, ease: 'power2.out' })
        .to(trg, { rotation:  0,              duration: 0.14, ease: 'power2.out' });
    } catch (err) {
      devWarn('⚠️ Failed to spawn locked tile with pop:', err);
    }
  });
  try { drawBoardBG?.(); } catch {}
}

// Track if wild-juice has been spawned (first wild spawn should be wild-juice)
// 🔥 USER REQUEST: Track if first wild has been spawned (must be wild zvjezdica)
let firstWildSpawned = false;
// Track total wild spawns to enforce first/second sequence.
let wildSpawnCount = 0;
let lastWildDropType: 'wild' | 'wild-juice' | 'wild-magnet' | 'wild-tnt' | null = null;
let wildDropTypeStreak = 0;
// Track wild-merge locked tile spawns (1st=7, 2nd=4)
let wildMergeLockedSpawnCount = 0;

async function spawnWildFromMeter(){
  const spawnToken = wildSpawnCancelToken;
  const isSpawnCancelled = () => spawnToken !== wildSpawnCancelToken || busyEnding || hasLastMergeTile({ tiles: STATE.tiles, devLog });
  const activeAnimationBlockReason = getWildSpawnAnimationBlockReason();
  const permission = resolveWildSpawnPermission({
    tiles: STATE.tiles,
    wildMeter,
    boardWildSpawnEnabled: isWildSpawnEnabled(boardNumber),
    boardWildMeterEnabled: isWildMeterEnabled(boardNumber),
    wildSpawnInProgress: false,
    busyEnding,
    boardTransitionActive: (window as any).__ccBoardTransitionActive === true,
    failScreenPending: (window as any).__ccFailScreenPending === true,
    activeAnimationBlockReason,
    devLog,
  });
  if (isSpawnCancelled() || permission.action !== 'allow') {
    devLog('⏸️ spawnWildFromMeter skipped:', permission.reason);
    return false;
  }

  const consumeCharge = () => consumeWildCharge({
    wildMeter,
    setWildMeter: (v) => { wildMeter = v; },
    setStateWildMeter: (v) => { STATE.wildMeter = v; },
    resetWildProgress,
    animateWildMeterChargeConsumption: HUD.animateWildMeterChargeConsumption,
  });

  const attempted = new Set();
  const maxAttempts = 12;
  let tries = 0;
  let spawned = false;
  let lastCell = null;
  // 🔥 CRITICAL: Exclude drag-origin when drag is active — grid is temporarily null there, must not spawn wild on it
  const excludeCells: { r: number; c: number }[] = [];
  if (drag && (drag as any).t && typeof (drag as any).startGX === 'number' && typeof (drag as any).startGY === 'number') {
    excludeCells.push({ r: (drag as any).startGY, c: (drag as any).startGX });
  }
  const isTutorialWildSpawnCellAvailable = (c: number, r: number): boolean => {
    if (excludeCells.some((excludedCell) => excludedCell.c === c && excludedCell.r === r)) return false;
    const existing = grid?.[r]?.[c];
    if (!existing || existing.destroyed) return true;
    return existing.locked === true || (((existing.value | 0) <= 0) && !existing.special);
  };
  const findTutorialFallbackWildSpawnCell = (preferred: { c: number; r: number }): { c: number; r: number } | null => {
    if (isTutorialWildSpawnCellAvailable(preferred.c, preferred.r)) return preferred;
    const candidates: Array<{ c: number; r: number; distance: number }> = [];
    const maxRow = Math.min(1, ROWS - 1);
    for (let r = 0; r <= maxRow; r++) {
      for (let c = 0; c < COLS; c++) {
        candidates.push({
          c,
          r,
          distance: Math.abs(c - preferred.c) + Math.abs(r - preferred.r),
        });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance || a.r - b.r || a.c - b.c);
    const fallback = candidates.find(({ c, r }) => isTutorialWildSpawnCellAvailable(c, r));
    return fallback ? { c: fallback.c, r: fallback.r } : null;
  };
  const forcedTutorialWildCell = (() => {
    try {
      const cell = (window as any).__ccFirstPlayTutorialWildSpawnCell;
      if (!cell || !Number.isFinite(cell.c) || !Number.isFinite(cell.r)) return null;
      const c = Math.max(0, Math.min(COLS - 1, cell.c | 0));
      const r = Math.max(0, Math.min(ROWS - 1, cell.r | 0));
      const resolvedCell = findTutorialFallbackWildSpawnCell({ c, r });
      if (resolvedCell) {
        try { (window as any).__ccFirstPlayTutorialWildSpawnCell = resolvedCell; } catch {}
      }
      return resolvedCell;
    } catch {
      return null;
    }
  })();

  while (tries < maxAttempts && !spawned) {
    if (isSpawnCancelled()) return false;
    const cell = tries === 0 && forcedTutorialWildCell
      ? forcedTutorialWildCell
      : randomEmptyCell(excludeCells.length ? excludeCells : undefined);
    if (!cell) {
      tries++;
      if (await waitTrackedResult(40) === 'cancelled') return false;
      continue;
    }
    const key = `${cell.c},${cell.r}`;
    if (attempted.has(key)) {
      tries++;
      continue;
    }
    attempted.add(key);
    lastCell = cell;

    try {
      const decided = decideWildType({
        boardNumber,
        isArcade: isArcadeHomeRunMode(),
        firstWildSpawned,
        wildSpawnCount,
        lastWildDropType,
        wildDropTypeStreak,
        filterWildType,
        devLog,
        devWarn,
      });
      if (!decided) {
        tries++;
        continue;
      }
      let { spawnJuice, spawnMagnet, spawnTnt, wildType, specialDiceVariantId } = decided;
      if ((window as any).__ccFirstPlayTutorialForceWildStar === true) {
        spawnJuice = false;
        spawnMagnet = false;
        spawnTnt = false;
        wildType = 'wild';
        specialDiceVariantId = null;
      }
      const isBeachJourneyBoard = !isArcadeHomeRunMode() && boardNumber >= 12 && boardNumber <= 20;
      const beachWildSlot = isBeachJourneyBoard ? pickBeachWildSlot() : undefined;
      if (isBeachJourneyBoard) {
        spawnJuice = beachWildSlot === 1 || beachWildSlot === 2;
        spawnMagnet = false;
        spawnTnt = false;
        wildType = spawnJuice ? 'wild-juice' : 'wild';
      }
      const specialDiceVariant = isFirstPlayTutorialRunActive()
        ? null
        : specialDiceVariantId !== undefined
          ? getSpecialDiceVariant(specialDiceVariantId)
          : pickSpecialDiceVariantForWildSpawn({
              isArcade: isArcadeHomeRunMode(),
              wildSpawnCount,
              arcadeStage: boardNumber,
              journeyBoard: boardNumber,
              beachWildSlot,
              previousWildType: lastWildDropType,
            });
      if (specialDiceVariant) {
        const coreWildType = getCoreWildTypeForSpecialDiceVariant(specialDiceVariant);
        spawnJuice = coreWildType === 'wild-juice';
        spawnMagnet = coreWildType === 'wild-magnet';
        spawnTnt = coreWildType === 'wild-tnt';
        wildType = (coreWildType || 'wild') as any;
        if (spawnTnt) {
          const variantFrames = getSpecialDiceExplosionSpriteSources(specialDiceVariant);
          void preloadTntFrames({
            frameSources: variantFrames || undefined,
            ...getSpecialDiceSplashOptions(specialDiceVariant),
          }).catch((error) => {
            devWarn('⚠️ TNT-archetype special frame warmup failed; merge-time preload will retry:', error);
          });
        }
      }
      let wildAssetPath = spawnTnt
        ? ASSET_WILD_TNT
        : spawnJuice
          ? ASSET_WILD_JUICE
          : spawnMagnet
            ? ASSET_WILD_MAGNET
            : ASSET_WILD;
      if (specialDiceVariant?.texture) {
        wildAssetPath = specialDiceVariant.texture;
      }
      const wildDropOrigin = HUD.getWildMeterDropOrigin?.() || null;

      if (forcedTutorialWildCell && cell.c === forcedTutorialWildCell.c && cell.r === forcedTutorialWildCell.r) {
        try {
          const existing = grid?.[cell.r]?.[cell.c];
          const emptyLike = !existing || existing.destroyed || existing.locked || ((existing.value | 0) <= 0 && !existing.special);
          if (!emptyLike) {
            (window as any).__ccFirstPlayTutorialDisplaceWildSpawnOccupant?.(cell);
          }
        } catch {}
      }
      
      const ok = await openAtCell(cell.c, cell.r, { 
        isWild: true, 
        isWildMagnet: spawnMagnet,
        isWildJuice: spawnJuice,
        isWildTnt: spawnTnt,
        skipSpawnAnimation: true
      });
      
      if (ok) {
        if (isSpawnCancelled()) {
          const spawnedTileForCancel = grid?.[cell.r]?.[cell.c] || null;
          try {
            if (grid?.[cell.r]?.[cell.c] === spawnedTileForCancel) {
              grid[cell.r][cell.c] = null;
            }
          } catch {}
          try {
            if (spawnedTileForCancel && !spawnedTileForCancel.destroyed && STATE.tiles.includes(spawnedTileForCancel)) {
              spawnedTileForCancel.visible = false;
              spawnedTileForCancel.alpha = 0;
              spawnedTileForCancel.eventMode = 'none';
              removeTile(spawnedTileForCancel);
            }
          } catch {}
          devLog('🧹 Wild spawn cancelled after openAtCell because final merge/endgame took over');
          return false;
        }
        if (forcedTutorialWildCell && cell.c === forcedTutorialWildCell.c && cell.r === forcedTutorialWildCell.r) {
          try {
            delete (window as any).__ccFirstPlayTutorialWildSpawnCell;
            delete (window as any).__ccFirstPlayTutorialForceWildStar;
          } catch {}
        }
        const spawnedTile = grid?.[cell.r]?.[cell.c] || null;
        if (spawnedTile && specialDiceVariant) {
          try {
            applySpecialDiceVariantToTile(spawnedTile, specialDiceVariant);
            applyWildSkinLocal(spawnedTile);
          } catch {}
        }
        consumeCharge();
        spawned = true;
        const wildDropSmokeOrigin = spawnedTile && !spawnedTile.destroyed
          ? {
              x: Number.isFinite((spawnedTile as any).targetX) ? (spawnedTile as any).targetX : spawnedTile.x,
              y: Number.isFinite((spawnedTile as any).targetY) ? (spawnedTile as any).targetY : spawnedTile.y,
              zIndex: spawnedTile.zIndex,
              gridX: spawnedTile.gridX,
              gridY: spawnedTile.gridY,
            }
          : null;
        let spawnCancelledAfterDrop = false;
        try {
          if (isSpawnCancelled()) {
            try {
              if (spawnedTile && !spawnedTile.destroyed) {
                if (grid?.[cell.r]?.[cell.c] === spawnedTile) grid[cell.r][cell.c] = null;
                spawnedTile.visible = false;
                spawnedTile.alpha = 0;
                spawnedTile.eventMode = 'none';
                removeTile(spawnedTile);
              }
            } catch {}
            devLog('🧹 Wild spawn drop cancelled before animation because final merge/endgame took over');
            return false;
          }
          await animateWildSpawnDropFromMeter({
            app,
            tile: spawnedTile,
            assetPath: wildAssetPath,
            from: wildDropOrigin,
            tileSize: TILE,
            onImpact: () => {
              try {
                screenShake(app, { strength: 14, duration: 0.38, steps: 18, ease: 'power2.out', yScale: 0.85 });
              } catch {}
              try {
                if (spawnedTile && !spawnedTile.destroyed) {
                  smokeBubblesAtTile(board, wildDropSmokeOrigin || spawnedTile, TILE * 1.05, 1.35, {
                    behind: true,
                    fxTag: 'wild-spawn-drop-smoke',
                    sizeScale: 1.35,
                    spawnShape: 'box',
                    ttl: 1.15,
                  });
                }
              } catch {}
            },
          });
        } catch (dropError) {
          devWarn('⚠️ Wild spawn drop animation failed; revealing tile immediately', dropError);
          try {
            if (spawnedTile && !spawnedTile.destroyed) {
              spawnedTile.visible = true;
              spawnedTile.alpha = 1;
              spawnedTile.eventMode = 'static';
              spawnedTile.cursor = 'pointer';
              delete (spawnedTile as any)._ccWildSpawnDropping;
            }
          } catch {}
        } finally {
          try {
            if (spawnedTile && !spawnedTile.destroyed) {
              if (isSpawnCancelled()) {
                try {
                  if (grid?.[cell.r]?.[cell.c] === spawnedTile) grid[cell.r][cell.c] = null;
                  spawnedTile.visible = false;
                  spawnedTile.alpha = 0;
                  spawnedTile.eventMode = 'none';
                  removeTile(spawnedTile);
                } catch {}
                spawnCancelledAfterDrop = true;
              } else {
                try {
                  (window as any).__ccWildSpawnDropActiveCount = 0;
                  (window as any).__ccWildSpawnDropInProgress = false;
                } catch {}
                delete (spawnedTile as any)._ccWildSpawnDropping;
                spawnedTile.visible = true;
                spawnedTile.alpha = 1;
                spawnedTile.eventMode = 'static';
                spawnedTile.cursor = 'pointer';
                bindTileWithFallback(spawnedTile, false);
              }
            }
          } catch {}
        }

        if (spawnCancelledAfterDrop) {
          return false;
        }

        try {
          if (spawnedTile && !spawnedTile.destroyed) {
            delete (spawnedTile as any)._ccDeferWildIdleFx;
            startWildShimmer(spawnedTile);
            if (isSpecialDiceJuiceLikeTile(spawnedTile)) {
              stopTntIdleParticles(spawnedTile);
              stopTntIdleShake(spawnedTile);
              startWildJuiceBubbles(spawnedTile);
            } else if (spawnedTile.special === 'wild-tnt') {
              startTntIdleParticles(spawnedTile);
              startTntIdleShake(spawnedTile);
            } else if (spawnedTile.special === 'wild') {
              startWildStars(spawnedTile, { introBounce: true });
            } else if (spawnedTile.special === 'wild-magnet') {
              startMagnetIdleParticles(spawnedTile);
            }
            startSpecialDiceIdleMotion(spawnedTile);
          }
        } catch {}

        emitIOSArcadeGameplayTrace('wild-spawn-complete', {
          boardNumber,
          special: spawnedTile?.special || wildType || null,
          variant: specialDiceVariant?.id || null,
          x: spawnedTile?.gridX ?? cell.c,
          y: spawnedTile?.gridY ?? cell.r,
          orbitPresent: !!((spawnedTile as any)?._wildStarSystem),
        });

        // 🔥 USER REQUEST: Mark first wild as spawned
        const wasFirstWild = !firstWildSpawned;
        if (!firstWildSpawned) {
          firstWildSpawned = true;
        }
        wildSpawnCount += 1;
        if (wildType === lastWildDropType) {
          wildDropTypeStreak += 1;
        } else {
          lastWildDropType = wildType;
          wildDropTypeStreak = 1;
        }
        
        if (spawnJuice) {
          devLog('🍺 Wild-juice spawned (35% random chance)');
          // No board shake on spawn - only on merge 6
        } else if (spawnMagnet) {
          if (wasFirstWild && boardNumber === 1) {
            devLog('🧲 Board 1: First wild-magnet spawned from preloader');
          } else {
            devLog('🧲 Wild-magnet spawned (20% random chance)');
          }
        } else if (spawnTnt) {
          if (wasFirstWild) {
            devLog('💥 First wild spawned: TNT (Explosion Pack)');
          } else {
            devLog('💥 Wild-TNT spawned (Explosion Pack, 10% random chance)');
          }
        } else {
          if (wasFirstWild) {
            devLog('⭐ First wild spawned: wild zvjezdica (stars)');
          } else {
            devLog('⭐ Regular wild spawned (40% random chance - stars)');
          }
        }
      } else {
        devWarn('⚠️ Wild spawn skipped (cell no longer empty):', cell);
        tries++;
      }
    } catch (error) {
      devWarn('⚠️ Wild spawn attempt failed at', cell, error);
      tries++;
    }
  }

  if (!spawned) {
    devWarn('🚨 CRITICAL: Unable to spawn wild cube after', tries, 'attempts. Meter remains at', wildMeter);
    return false;
  }

  if (wildSpawnRetryTimer) {
    clearTimeout(wildSpawnRetryTimer);
    wildSpawnRetryTimer = null;
  }

  devLog('✅ Wild cube spawned successfully at', lastCell?.c, lastCell?.r, 'Leftover meter:', wildMeter);
  return true;
}

// -------------------- merge --------------------

// 🔥 v112: pickWildValue moved to app-core-utils.ts
// Imported: pickWildValue
function merge(src: Tile, dst: Tile, helpers: MergeHelpers){
  markMergePerformance('merge-handler-start');
  const mergeGameplayGenerationAtEntry = activeGameplayEntryGeneration;
  const scheduleOwnedMergeRecoveryCheck = (delaySeconds: number, reason: string) => {
    if (activeGameplayEntryGeneration !== mergeGameplayGenerationAtEntry) return;
    scheduleCheckLevelEnd(delaySeconds, reason);
  };
  // Capture special-dice provenance before merge cleanup can remove `src` or
  // clear either tile's variant metadata. Magnet pull callbacks run later and
  // must not fall back to the core red/brown palette for Honey/Bottle.
  const srcSpecialVariantAtMergeEntry = getSpecialDiceVariantForTile(src);
  const dstSpecialVariantAtMergeEntry = getSpecialDiceVariantForTile(dst);
  const __replayToken = replayRecorder.beginStep('merge', {
    src: src ? { gridX: src.gridX, gridY: src.gridY, value: src.value, special: src.special } : null,
    dst: dst ? { gridX: dst.gridX, gridY: dst.gridY, value: dst.value, special: dst.special } : null,
  });
  let specialTransactionToken: number | null = null;
  let regularMergeHandoffToken: number | null = null;
  let regularMerge6CleanupToken: number | null = null;
  let merge6SpawnOwnerToken: number | null = null;
  let mergeBoardMutationStarted = false;
  let mergeEffectiveSumForRecovery: number | null = null;
  emitIOSArcadeGameplayTrace('merge-entry', {
    boardNumber,
    src: src ? { value: src.value | 0, special: src.special || null, stackDepth: (src as any).stackDepth || 1, x: src.gridX, y: src.gridY } : null,
    dst: dst ? { value: dst.value | 0, special: dst.special || null, stackDepth: (dst as any).stackDepth || 1, x: dst.gridX, y: dst.gridY } : null,
    activeTileCount: tiles.filter((tile: any) => tileIsActive(tile)).length,
  });
  try {
  logger.debug('🔥🔥🔥 MERGE FUNCTION CALLED', 'app-core', { srcValue: src?.value, dstValue: dst?.value });
  logger.debug('🔥🔥🔥 MERGE DESTINATION CHECK', 'app-core', {
    hasDst: !!dst,
    dstValue: dst?.value,
    dstLocked: dst?.locked,
    dstDestroyed: dst?.destroyed,
    dstGridX: dst?.gridX,
    dstGridY: dst?.gridY,
    isInTiles: typeof getTiles === 'function' && getTiles ? getTiles().includes(dst) : 'unknown'
  });
  
  if (busyEnding) { helpers.snapBack?.(src); return; }
  const isInternalPulledTilesMerge =
    (src as any)?._wildMagnetAffected === true &&
    (dst as any)?._wildMagnetAffected === true;
  if (shouldBlockMergeDuringRegularHandoff(regularMergeHandoffTokens.size > 0, src, dst)) {
    devWarn('🛡️ MERGE BLOCKED: Regular stack absorb still owns the board');
    helpers.snapBack?.(src);
    return;
  }
  // A merge-6 transaction must be serialized before either tile is mutated.
  // A regular merge owns its destination through merge6DestinationCleanupOwner;
  // a later special used to slip in during that 80ms/async handoff and then hit
  // the post-mutation spawn guard, leaving a passive plain value-6 forever.
  const merge6DestinationHandoffActive = collectBoardGameplayTiles().some((tile: any) =>
    merge6DestinationCleanupOwner.hasClaim(tile));
  const merge6HandoffActive = merge6SpawnInProgress || merge6DestinationHandoffActive;
  const ordinarySubSixStackDuringMerge6Handoff =
    merge6HandoffActive && canOrdinaryStackDuringMerge6Handoff(src, dst);
  if (merge6HandoffActive && !isInternalPulledTilesMerge && !ordinarySubSixStackDuringMerge6Handoff) {
    devWarn('🚨 MERGE BLOCKED: another merge-6 transaction still owns the board', {
      merge6SpawnInProgress,
      merge6DestinationHandoffActive,
    });
    helpers.snapBack?.(src);
    return;
  }
  if (ordinarySubSixStackDuringMerge6Handoff) {
    emitIOSSpecialTransactionTrace('merge6-overlap-ordinary-stack-allowed', {
      merge6SpawnInProgress,
      merge6DestinationHandoffActive,
      sourceValue: src?.value | 0,
      destinationValue: dst?.value | 0,
    });
  }
  if (src === dst) { helpers.snapBack(src); return; }
  
  // CRITICAL: Validate that both tiles are valid and merge is allowed
  if (!src || !dst || src.destroyed || dst.destroyed) {
    devWarn('⚠️ MERGE: Invalid tiles - src:', src, 'dst:', dst);
    if (src && !src.destroyed) helpers.snapBack?.(src);
    return;
  }
  if (isSpecialDiceResolutionOwned(src) || isSpecialDiceResolutionOwned(dst)) {
    devWarn('🛡️ MERGE BLOCKED: A gameplay-resolving special still owns this tile');
    helpers.snapBack?.(src);
    return;
  }
  if (
    specialDiceTransactionOwner.isActive() &&
    !isInternalPulledTilesMerge &&
    !canOrdinaryStackDuringSpecialVisualTail(src, dst)
  ) {
    devWarn('🛡️ MERGE BLOCKED: Another special transaction still owns the board');
    helpers.snapBack?.(src);
    return;
  }
  
  // 🔥 CRITICAL: Check if both tiles are wild-magnet affected (pulled tiles merge)
  const srcIsWildMagnetAffected = (src as any)?._wildMagnetAffected === true;
  const dstIsWildMagnetAffected = (dst as any)?._wildMagnetAffected === true;
  const isPulledTilesMerge = isInternalPulledTilesMerge;
  
  // 🛡️ CRITICAL: Block merge if only ONE tile is wild-magnet affected (protected tile cannot merge with others)
  // Protected tiles can only merge with other protected tiles (pulled tiles merge)
  if ((srcIsWildMagnetAffected && !dstIsWildMagnetAffected) || (!srcIsWildMagnetAffected && dstIsWildMagnetAffected)) {
    devWarn('🛡️ MERGE BLOCKED: Only one tile is wild-magnet affected (protected tile cannot merge with others)');
    devWarn('⚠️ Source protected:', srcIsWildMagnetAffected, 'Destination protected:', dstIsWildMagnetAffected);
    devWarn('⚠️ Protected tiles can only merge with other protected tiles (pulled tiles merge)');
    helpers.snapBack?.(src);
    return;
  }
  
  // CRITICAL: If destination is locked or has value 0, this is not a valid merge (ghost placeholder)
  // BUT: For pulled tiles merge (both wild-magnet affected), allow merge even if dst is locked/value 0
  if (dst.locked || (dst.value | 0) <= 0) {
    if (!isPulledTilesMerge) {
      devWarn('🚨🚨🚨 MERGE BLOCKED: Destination is locked or has value 0');
      devWarn('⚠️ Destination:', { locked: dst.locked, value: dst.value, gridX: dst.gridX, gridY: dst.gridY });
      helpers.snapBack?.(src);
      return;
    } else {
      devLog('🧲 MERGE: Allowing pulled tiles merge even if dst is locked/value 0 (both are wild-magnet affected)');
    }
  }
  
  // Block wild/wild, wild/magnet, magnet/magnet, wild-juice/wild-juice, wild-juice/wild, wild-juice/magnet merges
  // BUT: Allow wild star to merge with merge 6 tile (value 6 without special)
  // BUT: If BOTH tiles are wild-magnet affected (pulled tiles), allow merge regardless of wild status
  const srcIsMagnetLike = isSpecialDiceMagnetLikeTile(src);
  const dstIsMagnetLike = isSpecialDiceMagnetLikeTile(dst);
  const srcIsWild = isWildLikeTile(src) && !srcIsMagnetLike;
  const dstIsWild = isWildLikeTile(dst) && !dstIsMagnetLike;
  const srcIsMerge6 = (src.value|0) === 6 && !src.special;
  const dstIsMerge6 = (dst.value|0) === 6 && !dst.special;
  
  // 🔥 NEW: Allow wild star to merge with merge 6 tile
  if ((srcIsWild && dstIsMerge6) || (dstIsWild && srcIsMerge6)) {
    devLog('⭐ MERGE ALLOWED: Wild star merging with merge 6 tile');
    // Allow this merge - it will create a new merge 6
  } else if ((srcIsWild && dstIsWild) || 
      (srcIsMagnetLike && dstIsMagnetLike) ||
      (srcIsWild && dstIsMagnetLike) ||
      (srcIsMagnetLike && dstIsWild)){ 
    // CRITICAL: If both tiles are wild-magnet affected (pulled tiles), allow merge even if wild/wild
    if (!isPulledTilesMerge) {
      devWarn('🚨🚨🚨 MERGE BLOCKED: Wild/wild, wild/magnet, or magnet/magnet merge not allowed');
      helpers.snapBack?.(src); 
      return;
    } else {
      devLog('🧲 MERGE: Allowing wild/wild merge because both tiles are wild-magnet affected (pulled tiles)');
    }
  }

  const sum      = (src.value|0) + (dst.value|0);
  const srcDepth = src.stackDepth || 1;
  const dstDepth = dst.stackDepth || 1;

  // Wild-magnet works exactly like wild: always merges to 6
  // Also, if BOTH tiles are _wildMagnetAffected (pulled tiles), they act like wild
  // NOTE: srcIsWildMagnetAffected and dstIsWildMagnetAffected are already declared above
  const wildActive = isWildLikeTile(src) || isWildLikeTile(dst) ||
                     (srcIsWildMagnetAffected && dstIsWildMagnetAffected);
  const specialTransactionKind = wildActive
    ? getSpecialDiceGameplayFxForMerge({ src, dst, srcSpecial: src?.special, dstSpecial: dst?.special })
    : null;
  if (specialTransactionKind && !isInternalPulledTilesMerge) {
    specialTransactionToken = beginSpecialDiceTransaction(specialTransactionKind);
    if (specialTransactionToken === null) {
      devWarn('🛡️ MERGE BLOCKED: Failed to claim special transaction owner');
      helpers.snapBack?.(src);
      return;
    }
  }
  if (srcIsMagnetLike) markSpecialDiceResolutionOwned(src);
  if (dstIsMagnetLike) markSpecialDiceResolutionOwned(dst);
  const wildTargetValue = wildActive ? ((isWildLikeTile(src) || srcIsWildMagnetAffected) ? (dst.value|0) : (src.value|0)) : null;
  let effSum = sum;
  mergeEffectiveSumForRecovery = wildActive ? 6 : sum;
  
  // 🔥 CRITICAL: Check for wild star merge 6 BEFORE any animations or branches (to capture wildStarSystem)
  // This must happen early to capture the wild tile's _wildStarSystem before it's modified or removed
  const srcSpecialForStarCheck = src?.special;
  const dstSpecialForStarCheck = dst?.special;
  let wildStarTileForAnimation = null;
  let shouldAnimateStarsToHUD = false;
  
  // 🔥 CRITICAL: Save wild star system data EARLY, before any transformations
  // This ensures data is saved even if dst tile becomes merge 6 and loses its _wildStarSystem
  let savedStarSystemEarly = null;
  let savedStarPositionsEarly = [];
  let savedWildTileScreenPosEarly = null;
  let starsToHudTriggered = false;
  const getMerge6ScreenPos = (tileForCenter: any) => {
    const local = centerInBoard(board, tileForCenter, TILE);
    try {
      if (board && typeof (board as any).toGlobal === 'function') {
        const global = (board as any).toGlobal({ x: local.x, y: local.y });
        if (global && Number.isFinite(global.x) && Number.isFinite(global.y)) {
          return { x: global.x, y: global.y };
        }
      }
    } catch {}
    return local;
  };
	  const getMerge6DomOrigin = (tileForCenter: any) => {
	    const pos = getMerge6ScreenPos(tileForCenter);
    try {
      const canvas = (app as any)?.canvas || (app as any)?.view || (app as any)?.renderer?.canvas;
      const rect = canvas?.getBoundingClientRect?.();
      const screen = (app as any)?.renderer?.screen;
      const screenW = Number(screen?.width) || Number((app as any)?.renderer?.width) || rect?.width || window.innerWidth;
      const screenH = Number(screen?.height) || Number((app as any)?.renderer?.height) || rect?.height || window.innerHeight;
      if (rect && Number.isFinite(pos?.x) && Number.isFinite(pos?.y) && screenW > 0 && screenH > 0) {
        const x = rect.left + (pos.x / screenW) * rect.width;
        const y = rect.top + (pos.y / screenH) * rect.height;
        if (Number.isFinite(x) && Number.isFinite(y)) {
          return { x, y };
        }
      }
    } catch {}
	    return pos;
	  };

	  const createFinalMergeVisualStarters = (tileForOrigin: any, variant: any): FinalMergeVisualStarters => ({
	    showWildJuiceFinale: () => {
	      showWildJuiceBubblesExplosion({
	        showText: true,
	        text: variant?.splashText,
	        textColor: variant?.splashColor,
	        textColors: getSpecialDiceSplashLetterColors(variant),
	        direction: getSpecialDiceJuiceDropProfile(variant) ? 'down' : 'up',
	        dropProfile: getSpecialDiceJuiceDropProfile(variant),
	        spritePaths: getSpecialDiceExplosionSpriteSources(variant),
	        accentSpritePaths: getSpecialDiceFinaleAccentSpriteSources(variant),
	        inputReleaseAtRatio: getSpecialDiceInputReleaseAtRatio(variant),
	        gameplayReleaseAtSpawnRatio: getSpecialDiceGameplayReleaseAtSpawnRatio(variant),
	      });
	    },
	    showSparkleFinale: () => {
	      showSparkleText(getMerge6DomOrigin(tileForOrigin), getSpecialDiceSplashOptions(variant));
	    },
	  });
	  
	  // Calculate effSum early for wild star check (wild always merges to 6)
  const tempEffSum = wildActive ? 6 : sum;
  
  devLog('⭐ EARLY wild star check - tempEffSum:', tempEffSum, 'srcSpecial:', srcSpecialForStarCheck, 'dstSpecial:', dstSpecialForStarCheck);
  
  if (tempEffSum === 6) {
    devLog('⭐ tempEffSum === 6, checking for wild star...');
    const srcIsWildStar = srcSpecialForStarCheck === 'wild';
    const dstIsWildStar = dstSpecialForStarCheck === 'wild';
    
    devLog('⭐ Wild star check:', { srcIsWildStar, dstIsWildStar });
    
    if (srcIsWildStar || dstIsWildStar) {
      wildStarTileForAnimation = srcIsWildStar ? src : (dstIsWildStar ? dst : null);
      const hasWildStarSystem = !!(wildStarTileForAnimation as any)?._wildStarSystem;
      
      devLog('⭐ EARLY wild star check:', {
        tempEffSum,
        srcSpecialForStarCheck,
        dstSpecialForStarCheck,
        srcIsWildStar,
        dstIsWildStar,
        wildStarTile: !!wildStarTileForAnimation,
        hasWildStarSystem,
        wildStarTileValue: wildStarTileForAnimation?.value,
        wildStarTileSpecial: wildStarTileForAnimation?.special
      });
      
      if (wildStarTileForAnimation && hasWildStarSystem) {
        shouldAnimateStarsToHUD = true;
        
        // 🔥 CRITICAL: Save wild star system data IMMEDIATELY, before any transformations
        // This ensures data is preserved even if dst tile becomes merge 6 and loses _wildStarSystem
        const wildStarSystem = (wildStarTileForAnimation as any)?._wildStarSystem;
        if (wildStarSystem && wildStarSystem.stars && wildStarSystem.stars.length > 0) {
          savedStarSystemEarly = wildStarSystem;
          
          // Save star textures and their global positions (NOT sprite references - sprites get destroyed!)
          savedStarPositionsEarly = wildStarSystem.stars.map((star: any) => {
            if (!star || !star.sprite) return null;
            try {
              const globalPos = star.sprite.getGlobalPosition();
              // 🔥 CRITICAL: Save texture reference and scale values, NOT sprite reference
              // Sprite gets destroyed when tile is removed/transformed, but texture persists
              const texture = star.sprite.texture;
              const scaleX = star.sprite.scale.x;
              const scaleY = star.sprite.scale.y;
              
              if (!texture) {
                devWarn('⚠️ Star sprite has no texture, skipping');
                return null;
              }
              
              return {
                texture: texture, // Save texture reference (not sprite!)
                globalX: globalPos.x,
                globalY: globalPos.y,
                scale: { x: scaleX, y: scaleY }
              };
            } catch (err) {
              devWarn('⚠️ Failed to save star data early:', err);
              return null;
            }
          }).filter(Boolean);
          
          // Save wild tile screen position
          try {
            const wildTileGlobalPos = wildStarTileForAnimation.getGlobalPosition();
            savedWildTileScreenPosEarly = { x: wildTileGlobalPos.x, y: wildTileGlobalPos.y };
          } catch {
            devWarn('⚠️ Failed to get wild tile global position for early saving');
          }
          
          devLog('✅ Saved', savedStarPositionsEarly.length, 'star positions EARLY (before any transformations)');
        } else {
          devWarn('⚠️ Wild star system not found or empty in early check, cannot save star data');
        }
        
        devLog('✅ Will animate stars to HUD after merge animation');
      } else {
        devLog('⚠️ Wild star tile found without orbit star system, preparing fallback HUD star:', {
          hasWildStarTile: !!wildStarTileForAnimation,
          hasWildStarSystem
        });
        if (wildStarTileForAnimation) {
          try {
            const starTexture = Texture.from('./assets/small-star.png');
            let basePos = null;
            try {
              if (typeof wildStarTileForAnimation.getGlobalPosition === 'function') {
                const gp = wildStarTileForAnimation.getGlobalPosition();
                if (gp && Number.isFinite(gp.x) && Number.isFinite(gp.y)) {
                  basePos = { x: gp.x, y: gp.y };
                }
              }
            } catch {}
            if (!basePos) {
              const fallback = getMerge6ScreenPos(wildStarTileForAnimation || dst);
              basePos = { x: fallback.x, y: fallback.y };
            }

            savedWildTileScreenPosEarly = basePos;
            savedStarPositionsEarly = [{
              texture: starTexture,
              globalX: basePos.x,
              globalY: basePos.y,
              scale: { x: 0.55, y: 0.55 }
            }];
            shouldAnimateStarsToHUD = true;
            devLog('✅ Wild star fallback HUD star prepared', {
              basePos,
              variant: getSpecialDiceVariantForTile(wildStarTileForAnimation)?.id || 'core-wild'
            });
          } catch (err) {
            devWarn('⚠️ Failed to prepare fallback wild-star HUD star:', err);
          }
        }
      }
    } else {
      devLog('⭐ Not a wild star merge:', { srcSpecialForStarCheck, dstSpecialForStarCheck });
    }
    
    // ✨ Non-star wilds (juice only): send 1-3 stars to HUD
    if (!shouldAnimateStarsToHUD) {
      const srcIsNonStarWild = srcSpecialForStarCheck === 'wild-juice';
      const dstIsNonStarWild = dstSpecialForStarCheck === 'wild-juice';
      if (srcIsNonStarWild || dstIsNonStarWild) {
        const wildTile = srcIsNonStarWild ? src : (dstIsNonStarWild ? dst : null);
        const starCount = 1 + Math.floor(Math.random() * 3); // 1..3
        if (starCount > 0) {
          const starTexture = Texture.from('./assets/small-star.png');
          let basePos = null;
          try {
            if (wildTile && typeof wildTile.getGlobalPosition === 'function') {
              const gp = wildTile.getGlobalPosition();
              if (gp && Number.isFinite(gp.x) && Number.isFinite(gp.y)) {
                basePos = { x: gp.x, y: gp.y };
              }
            }
          } catch {}
          if (!basePos) {
            const fallback = getMerge6ScreenPos(wildTile || dst);
            basePos = { x: fallback.x, y: fallback.y };
          }
          
          savedWildTileScreenPosEarly = basePos;
          savedStarPositionsEarly = [];
          for (let i = 0; i < starCount; i++) {
            const offsetX = (Math.random() - 0.5) * TILE * 0.6;
            const offsetY = (Math.random() - 0.5) * TILE * 0.6;
            const scale = 0.45 + Math.random() * 0.25;
            savedStarPositionsEarly.push({
              texture: starTexture,
              globalX: basePos.x + offsetX,
              globalY: basePos.y + offsetY,
              scale: { x: scale, y: scale }
            });
          }
          
          shouldAnimateStarsToHUD = savedStarPositionsEarly.length > 0;
          devLog('✨ Non-star wild: prepared stars to HUD', { starCount, basePos, shouldAnimateStarsToHUD });
        }
      }
    }
  } else {
    devLog('⭐ Not merge 6, tempEffSum:', tempEffSum);
  }
  
  // 🔥 NOTE: Bubbles animation is now triggered when merge 6 animation starts (in effSum === 6 block)
  // This ensures bubbles start exactly when merge 6 shards animation begins

  // Wild cube logic: always merge to 6, but remember target for later spawn
  if (wildActive) {
    effSum = 6; // Wild always merges to 6
    const avoidValue = Number.isFinite(wildTargetValue) ? wildTargetValue : null;
    dst._wildMergeTarget = avoidValue;
    devLog('🎯 Wild merge: target was', wildTargetValue, 'will merge to 6, spawn will avoid', avoidValue);
  }

  // Finality must be decided from the untouched board at merge entry. Special
  // finales (especially TNT) outlive source removal and visual teardown, so a
  // later live-board read can no longer prove that src + dst were the last pair.
  // Keep this snapshot for both regular stacks and direct merge-6 paths.
  const isWildMagnetMergeAtEntry = srcIsMagnetLike || dstIsMagnetLike;
  (dst as any)._isWildMagnetMerge = isWildMagnetMergeAtEntry;
  const lastMergeResult = handleLastMergeEarly({
    tiles,
    src,
    dst,
    effSum,
    boardNumber,
    wildMeter,
    setWildMeter: (v) => { wildMeter = v; },
    setStateWildMeter: (v) => { STATE.wildMeter = v; },
    HUD,
    setPendingCleanBoard,
    devLog,
    devWarn,
    isWildMagnetMerge: isWildMagnetMergeAtEntry,
    mode: isArcadeHomeRunMode() ? 'arcade' : 'journey',
  });
  (dst as any)._ccActiveTilesAtMergeEntry = lastMergeResult.activeTilesBeforeWildProgress.slice();
  (dst as any)._ccFinalMergeSnapshotAtMergeEntry = {
    ...lastMergeResult.finalMergeSnapshot,
  };
  emitIOSArcadeGameplayTrace('last-merge-early', {
    boardNumber,
    effSum,
    isActuallyLastMerge: lastMergeResult.isActuallyLastMerge,
    activeTileCount: lastMergeResult.visibleTilesCountBeforeWildProgress,
    activeStackCount: lastMergeResult.activeTilesCountBeforeWildProgress,
    willPullTiles: lastMergeResult.willPullTiles,
    snapshot: lastMergeResult.finalMergeSnapshot,
  });

  mergeBoardMutationStarted = true;
  gameplayBoardMutationRevision += 1;
  grid[src.gridY][src.gridX] = null;
  dst.eventMode = 'none';

  // 🔥 CRITICAL FIX: Save srcSpecial and dstSpecial BEFORE any branches
  // This ensures they're available in both effSum < 6 and effSum === 6 blocks
  const srcSpecial = src?.special;
  const dstSpecial = dst?.special;

  // ---- 2..5 (računaj combo i ovdje)
  if (effSum < 6){
    // 🔥 CRITICAL FIX: Ensure dst.value is set immediately (before requestAnimationFrame)
    // This prevents race conditions where visuals might use stale value
    devLog('🔧 MERGE: Setting dst.value to', effSum, 'from src.value', src.value, '+ dst.value', dst.value, 'srcDepth:', srcDepth, 'dstDepth:', dstDepth);
    dst.value = effSum;
    makeBoard.setValue(dst, effSum, srcDepth);
    normalizePlayableTileAfterMutation(dst);
    bindTileWithFallback(dst, false);
    try { makeBoard.syncTileZIndex?.(dst, board); } catch {}
    if (wildActive) clearWildState(dst);

    // Contact feedback belongs to pointer release. Start it as soon as the stack
    // visual/value is committed, while the source tile continues its short absorb
    // motion independently. Waiting for that tween's onComplete made the board feel
    // as though it reacted after the player's finger had already left the screen.
    if (!wildActive) {
      markMergePerformance('stack-contact');
      playRegularMergeContactPresentation(dst, src);
    }

    // 2. Rotation and overlay for all stack layers (each rotates opposite to previous)
    if (srcDepth > 1 && dst.stackG && dst.stackG.children.length > 0) {
      let previousDirection = 0; // Start with no direction

      // Iterate through all stack layers (starting from bottom)
      dst.stackG.children.forEach((layer: any) => {
        if (layer && layer.alpha !== undefined) {
          // Add brown overlay to this layer
          const overlay = new Graphics();
          overlay.fill({ color: 0x8B4513, alpha: 0.4 }); // Brown color
          overlay.rect(-TILE/2, -TILE/2, TILE, TILE);

          // Position overlay at same position as the layer
          overlay.x = layer.x || 0;
          overlay.y = layer.y || 0;
          overlay.rotation = layer.rotation || 0;
          overlay.scale.set(layer.scale?.x || 1, layer.scale?.y || 1);

          dst.stackG.addChild(overlay);
          overlay.zIndex = -1;

          // Rotate this layer in opposite direction to previous layer
          const rotationDirection = previousDirection === 0 ?
            (Math.random() > 0.5 ? 1 : -1) : // First layer: random direction
            -previousDirection; // Subsequent layers: opposite to previous

          const rotationDegrees = rotationDirection * (5 + Math.random() * 5); // 5-10 degrees
          const rotationAmount = rotationDegrees * (Math.PI / 180); // Convert degrees to radians

          // Set rotation to the final value, not add to existing
          trackTween(layer, {
            rotation: rotationAmount, // Set to final value, don't add
            duration: 0.2,
            ease: 'power2.out'
          });

          // Update previous direction for next layer
          previousDirection = rotationDirection;

          // Fade out overlay after animation
          trackTween(overlay, {
            alpha: 0,
            duration: 0.4,
            delay: 0.2,
            onComplete: () => {
              try { overlay.destroy(); } catch {}
            }
          });
        }
      });
    }

    score = applyMergeScore({
      effSum,
      score,
      wildActive,
      SCORE_CAP,
      statsService,
      devLog,
      devError,
    });
    
    updateHUD();
    
    triggerMergeHaptics({ wildActive, trackAppTimeout });
    
    // 🔥 CRITICAL: Check if this is wild-magnet merge that will pull tiles
    // If so, skip combo increment AND timer here - magnet pull will handle both with proper count
    // NOTE: hasTilesToPull will be calculated later in merge-6 block, but we need a preliminary check here
    const isWildMagnetMerge = isWildMagnetMergeAtEntry;
    // 🔥 CRITICAL: Store isWildMagnetMerge for later use in last merge check
    (dst as any)._isWildMagnetMerge = isWildMagnetMerge;
    
    // Combo++ (bez realnog capa), bump anim
    handleMergeCombo({
      combo,
      effSum,
      isWildMagnetMerge,
      boardNumber,
      statsService,
      hudSetCombo,
      scheduleComboDecay,
      HUD,
      devLog,
      devError,
    });

    // 🔥 CRITICAL FIX: Check if this is last merge BEFORE adding wild progress
    // This prevents wild meter from filling and triggering wild spawn on last merge
    // We need to check early (before merge 6 block) to prevent race condition
    const {
      visibleTilesCountBeforeWildProgress,
      activeTilesCountBeforeWildProgress,
      activeTilesBeforeWildProgress,
    } = lastMergeResult;
    let stackMergeFilledWildMeter = false;

    if (!lastMergeResult.isActuallyLastMerge) {
      if (!wildActive && effSum < 6) {
        regularMergeHandoffToken = beginRegularMergeHandoff();
      }
      // Normal merge - add wild progress
      const wildMeterBeforeStackFill = Number.isFinite(wildMeter) ? wildMeter : 0;
      addWildProgress(WILD_INC_SMALL, { confirmedNonFinal: true });
      stackMergeFilledWildMeter = !isWildMeterReady(wildMeterBeforeStackFill) && isWildMeterReady(wildMeter);
      if (stackMergeFilledWildMeter) {
        devLog('🛡️ Stack merge filled wild preloader - fail/no-moves must wait for wild drop', {
          wildMeterBeforeStackFill,
          wildMeterAfterStackFill: wildMeter,
          effSum,
          mode: isArcadeHomeRunMode() ? 'arcade' : 'journey',
        });
      }
    }

    const deferFailForStackWildContinuation = (reason: string): boolean => {
      if (!stackMergeFilledWildMeter) {
        return deferFailForWildContinuation(reason);
      }

      devWarn('🛡️ Deferring fail screen - this non-final stack filled wild preloader', {
        reason,
        wildMeter,
        wildSpawnInProgress,
        hasRetryTimer: wildSpawnRetryTimer !== null,
        dropInProgress: (window as any).__ccWildSpawnDropInProgress === true,
      });

      try { (window as any).__ccFailScreenPending = false; } catch {}
      queueWildSpawnAfterGuardRelease(`stack-wild-continuation:${reason}`);

      scheduleCheckLevelEnd(0.35, `stack_wild_continuation:${reason}`);

      return true;
    };
    
    // SMART SAVE: Debounced save after merge+spawn flow completes
    // 1200ms delay ensures all spawn animations complete before save
    // This prevents saving mid-animation which causes inconsistent state
    debouncedSaveGameState(1200);
    
    // Ghost placeholders are now fixed and always visible

    // 🔥 NOTE: srcSpecial and dstSpecial are already defined at line 3648-3649 (before if blocks)
    // Prevent further interaction with the source tile during the merge animation
    src.eventMode = 'none';
    src.interactiveChildren = false;
    src.cursor = 'default';

    // Safety: If the current drag is bound to the source tile, clear it so a ghost copy can't be dragged
    if (STATE.drag?.t === src) {
      try {
        STATE.drag.t = null;
        STATE.drag.bindToTile?.(null as any);
      } catch (err) {
        devWarn('⚠️ Failed to clear drag binding from src during merge', err);
      }
    }

    // 🔥 NOTE: wildStarTileForAnimation and shouldAnimateStarsToHUD are already set at the beginning of merge function
    // Use the pre-captured values here in the animation callback

    let regularMergeBoardCommitFinalized = false;
    const finalizeRegularMergeBoardCommit = (reason: string) => {
      if (regularMergeBoardCommitFinalized) return;
      regularMergeBoardCommitFinalized = true;
      try { removeTile(src); } catch (error) {
        devWarn('⚠️ Failed to remove regular merge source during finalization', { reason, error });
      }
      try {
        normalizePlayableTileAfterMutation(dst);
        makeBoard.syncTileZIndex?.(dst, board);
        bindTileWithFallback(dst, false);
        if (STATE.drag && typeof (STATE.drag as any).bindToTile === 'function') {
          (STATE.drag as any).bindToTile(dst);
        }
      } catch (error) {
        devWarn('⚠️ Failed to normalize regular merge destination during finalization', { reason, error });
      }
      releaseRegularMergeHandoff(regularMergeHandoffToken, reason);
      regularMergeHandoffToken = null;
    };
    registerRegularMergeHandoffFinalizer(regularMergeHandoffToken, () => {
      finalizeRegularMergeBoardCommit('source-absorb-timeout');
    });

    trackTween(src, {
      x: dst.x, y: dst.y, duration: 0.08, ease: 'power2.out',
      onInterrupt: () => {
        // A navigation/global animation cleanup may kill the absorption tween.
        // Commit the already accepted stack atomically before releasing a full
        // wild meter; never expose the half-merged grid to reward spawning.
        if (regularMergeHandoffToken !== null && regularMergeHandoffTokens.has(regularMergeHandoffToken)) {
          finalizeRegularMergeBoardCommit('source-absorb-interrupted');
        }
      },
      onComplete: async () => {
        try {
        markMergePerformance('source-absorbed');
        // 🔥 CRITICAL: Use EARLY saved star data (saved before any transformations)
        // This ensures data is available even if dst tile became merge 6 and lost _wildStarSystem
        const savedStarPositionsSmall = savedStarPositionsEarly.length > 0 ? savedStarPositionsEarly : [];
        const savedWildTileScreenPosSmall = savedWildTileScreenPosEarly;
        
        // Get merge 6 position for reference (convert to screen coordinates)
        const merge6PosSmall = getMerge6ScreenPos(dst);
        
        // Get HUD star icon position
        let hudStarPosSmall = null;
        if (shouldAnimateStarsToHUD) {
          try {
            if (typeof HUD.getStarHudPosition === 'function') {
              hudStarPosSmall = HUD.getStarHudPosition();
              devLog('⭐ HUD star position retrieved:', hudStarPosSmall);
            } else {
              devWarn('⚠️ HUD.getStarHudPosition is not a function');
            }
          } catch (err) {
            devError('❌ Error getting HUD star position:', err);
          }
        }
        
        finalizeRegularMergeBoardCommit('source-absorbed-and-destination-normalized');
        
        // 🔥 STARS ANIMATION: Trigger animation with EARLY saved star data (after tile is removed)
        // 🔥 CRITICAL: Always trigger animation if shouldAnimateStarsToHUD is true, even if bubbles animation is running
            const isWildJuiceMerge = srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice';
            if (shouldAnimateStarsToHUD && !starsToHudTriggered) {
              if (savedStarPositionsSmall.length > 0 && hudStarPosSmall) {
            devLog('⭐ Starting stars animation to HUD with saved data:', { 
              starCount: savedStarPositionsSmall.length,
              merge6Pos: merge6PosSmall,
              hudStarPos: hudStarPosSmall,
              hasBubblesRunning: isWildJuiceBubblesExplosionActive?.() || false
            });
            
            starsToHudTriggered = true;
            (async () => {
              try {
                if (!isWildJuiceMerge) showSparkleText(getMerge6DomOrigin(dst), getSpecialDiceSplashOptions(getSpecialDiceVariantForTile(src) || getSpecialDiceVariantForTile(dst)));
                devLog('⭐ Calling animateStarsToHudIcon with saved star data (INSTANT):', { 
                  board: !!board, 
                  stage: !!stage,
                  savedStarCount: savedStarPositionsSmall.length,
                  merge6Pos: merge6PosSmall,
                  hudStarPos: hudStarPosSmall
                });
                await animateStarsToHudIcon(board, stage, savedStarPositionsSmall, savedWildTileScreenPosSmall, merge6PosSmall, hudStarPosSmall, app);
                devLog('✅ Stars animation to HUD completed (INSTANT)');
              } catch (error) {
                starsToHudTriggered = false;
                devError('❌ Failed to animate stars to HUD:', error);
              }
            })();
          } else {
            devWarn('⭐ Stars animation skipped - missing data:', { 
              shouldAnimate: shouldAnimateStarsToHUD,
              savedStarCount: savedStarPositionsSmall?.length || 0,
              hasHudPos: !!hudStarPosSmall,
              hasEarlySavedData: savedStarPositionsEarly.length > 0,
              hasBubblesRunning: isWildJuiceBubblesExplosionActive?.() || false
            });
          }
        }
        // 🔥 CRITICAL FIX: SKIP stuck check for merge-6 (effSum === 6)
        // Merge-6 will spawn new tiles, so we should check AFTER spawn completes, not before
        // This prevents false "stuck" detection when board has 2 tiles (e.g., 4 and 2) that can merge
        // 🔥 CRITICAL FIX: SKIP this check if wild-magnet merge (magnet will pull tiles AFTER this merge)
        const isWildMagnetMerge = isSpecialDiceMagnetLikeTile(src, srcSpecial) || isSpecialDiceMagnetLikeTile(dst, dstSpecial);
        const isRegularMergeOnly = !srcSpecial && !dstSpecial;
        const isMerge6 = effSum === 6;
        
        // 🔥 USER REQUEST: Check for last move scenarios
        // 1. Regular + regular → stack (only 2 tiles, e.g. 3+2=5) = fail screen
        // 2. Regular + regular → merge 6 (only 2 tiles) = clean board (handled in merge-6 block)
        // 3. Wild + regular → merge 6 (only 2 tiles) = clean board (handled in merge-6 block)
        const bothAreRegularForCheck = !srcSpecial && !dstSpecial && 
                                      (src.value|0) > 0 && (dst.value|0) > 0;
        // 🔥 CRITICAL FIX: Use visibleTilesCountBeforeWildProgress (not activeTilesCountBeforeWildProgress) for "last 2 tiles" detection
        // activeTilesCountBeforeWildProgress sums stackDepth, which can be > 2 even with 2 visible tiles
        // visibleTilesCountBeforeWildProgress counts actual visible tiles, which is what we need
        const wasLastTwoRegularStack = bothAreRegularForCheck && 
                                      effSum < 6 && // Stack, not merge 6
                                      visibleTilesCountBeforeWildProgress === 2 &&
                                      activeTilesBeforeWildProgress.includes(src) && 
                                      activeTilesBeforeWildProgress.includes(dst);
        
        // 🔥 USER REQUEST: Check if this was last move when stacking 3+ tiles (not merge 6)
        // Example: 1+1+1 → stack(1, depth=3) - all tiles involved, should fail quickly
        const srcDepthForPostCheck = src.stackDepth || 1;
        const dstDepthForPostCheck = dst.stackDepth || 1;
        const combinedCountForPostCheck = srcDepthForPostCheck + dstDepthForPostCheck;
        const allTilesInvolvedForPostCheck = combinedCountForPostCheck >= activeTilesCountBeforeWildProgress && 
                                            activeTilesBeforeWildProgress.includes(src) && 
                                            activeTilesBeforeWildProgress.includes(dst);
    const wasLastThreeOrMoreStack = bothAreRegularForCheck && 
                                       effSum < 6 && // Stack, not merge 6
                                       activeTilesCountBeforeWildProgress >= 3 && // 3 or more tiles before merge
                                       allTilesInvolvedForPostCheck; // All tiles involved in this stack
        
        // 🔥 CRITICAL: Only check for stuck state if it's NOT a merge-6 (merge-6 will spawn new tiles)
        // For merge-6, we check AFTER spawn completes in checkLevelEnd()
        if (!busyEnding && !isMerge6 && (!isWildMagnetMerge || isRegularMergeOnly)) {
          // Add delay to ensure removeTile has completed and tiles array is updated
          // 🔥 INCREASED DELAY: 100ms instead of 50ms to ensure tiles array is fully updated
          if (await waitTrackedResult(100) === 'cancelled') return;
          
          // 🔥 CRITICAL: Verify dst tile state before checking
          const activeTilesBeforeCheck = tiles.filter(tileIsActive);
          const dstInTiles = tiles.includes(dst);
          const dstIsActive = dst && !dst.locked && (dst.value|0) > 0;
          
          // 🔥 CRITICAL FIX: Check if there are 2+ active tiles that can still merge BEFORE checking stuck
          // This prevents false "stuck" detection when 2 tiles (e.g., 3 and 2) can still stack
          // 🔥 v112: Using centralized checkEndGame() instead of direct anyMergePossible() call
          // 🔥 BUG FIX: DO NOT return early - always continue to full stuck check below
          // Previous bug: If visibleTilesBeforeCheck >= 2 and quickCheckResult.type === 'continue',
          // we would return early and never check stuck state. But after merge completes (e.g., 1+1=2),
          // there might be only 1 tile left that can't merge, and we need to detect that!
          const visibleTilesBeforeCheck = activeTilesBeforeCheck.length;
          if (visibleTilesBeforeCheck >= 2) {
            // Use centralized end game checker to determine if game can continue
            const quickCheckContext: EndGameContext = {
              tiles: activeTilesBeforeCheck,
              moves,
              makeBoard
            };
            const quickCheckResult = checkEndGame(quickCheckContext, true);
            if (quickCheckResult.type === 'continue') {
              logger.debug('✅ Post-merge check: 2+ tiles remain and can still merge/stack - will check full stuck state below', 'app-core', {
                activeTiles: activeTilesBeforeCheck.map(t => ({ value: t.value, special: t.special }))
              });
              // Don't return early - continue to full stuck check below to catch edge cases
              // (e.g., after merge completes, there might be only 1 tile left)
            }
          }
          
          // 🔥 USER REQUEST: If this was last 2 regular tiles that stacked (not merge 6), trigger fail screen immediately
          // 🔥 CRITICAL: Only trigger if this is TRULY the last move (no other tiles on board, no locked tiles)
          // This prevents blocking normal gameplay when stacking in the middle of the game
          // 🔥 CRITICAL FIX: Use visible tiles count (not stackDepth sum) for accurate "last 2 tiles" detection
          const hasOtherActiveTilesForTwo = activeTilesBeforeCheck.some(t => t !== dst);
          const hasLockedTilesForTwo = tiles.some((t: any) => t && !t.destroyed && t.locked && (t.value|0) > 0);
          const isTrulyLastMoveForTwo = !hasOtherActiveTilesForTwo && !hasLockedTilesForTwo && visibleTilesBeforeCheck === 1 && activeTilesBeforeCheck[0] === dst;
          
          if (wasLastTwoRegularStack && isTrulyLastMoveForTwo) {
            // 🔥 CRITICAL: Check if stack can reach merge 6 by merging with itself
            // Stack can merge with itself ONLY if: value + value <= 6 AND stackDepth >= 2
            const finalValue = dst.value || effSum;
            const finalStackDepth = dst.stackDepth || 1;
            const canReachMerge6 = (finalValue + finalValue) <= 6 && finalStackDepth >= 2;
            
            if (!canReachMerge6) {
              devLog('🚨🚨🚨 LAST MOVE DETECTED - Regular + regular → stack (not merge 6), only 1 tile remains, CANNOT reach merge 6, triggering fail screen');
              try { resetEndgameHint(); } catch {}
              devLog('🚨 Details:', {
                srcValue: src.value,
                dstValue: dst.value,
                effSum,
                finalTileValue: finalValue,
                finalTileStackDepth: finalStackDepth,
                canReachMerge6: canReachMerge6,
                wouldMergeTo: finalValue + finalValue,
                hasOtherActiveTiles: hasOtherActiveTilesForTwo,
                hasLockedTiles: hasLockedTilesForTwo,
                isTrulyLastMove: isTrulyLastMoveForTwo
              });
              
              if (deferFailForStackWildContinuation('last_two_regular_stack_dead_end')) return;
              if (await preventTutorialFailWithFinalChance('last_two_regular_stack_dead_end')) return;
              if (!busyEnding) {
                await runNoMovesFailFlow({ reason: 'last_two_regular_stack_dead_end', resetHint: false });
              }
              return;
            } else {
              // 🔥 USER REQUEST FIX: Stack CAN reach merge 6, but check what remains AFTER self-merge
              // Example: value 3 (depth 2) can self-merge to 6, but then it's merge 6 (depth 1) = DEAD END!
              const afterSelfMergeDepth = finalStackDepth - 1; // Depth decreases by 1 after self-merge
              const afterSelfMergeValue = finalValue + finalValue; // New value after self-merge
              
              devLog('🔍 Stack can reach merge 6 - checking what remains after self-merge:', {
                beforeSelfMerge: { value: finalValue, depth: finalStackDepth },
                afterSelfMerge: { value: afterSelfMergeValue, depth: afterSelfMergeDepth },
                isDeadEnd: afterSelfMergeValue === 6 && afterSelfMergeDepth === 1
              });
              
              // If self-merge results in merge 6 (depth 1) → that's a DEAD END (last move)
              if (afterSelfMergeValue === 6 && afterSelfMergeDepth === 1) {
                  devLog('🚨🚨🚨 LAST MOVE DETECTED - Stack can self-merge to merge 6 BUT will result in merge 6 (depth 1) = DEAD END, triggering fail screen');
                  try { resetEndgameHint(); } catch {}
                devLog('🚨 Details:', {
                  srcValue: src.value,
                  dstValue: dst.value,
                  effSum,
                  finalTileValue: finalValue,
                  finalTileStackDepth: finalStackDepth,
                  afterSelfMergeValue,
                  afterSelfMergeDepth,
                  explanation: `${finalValue}+${finalValue}=${afterSelfMergeValue} (depth ${finalStackDepth} → ${afterSelfMergeDepth}) = merge 6 with depth 1 = DEAD END`
                });
                
                if (deferFailForStackWildContinuation('last_two_self_merge_dead_end')) return;
                if (await preventTutorialFailWithFinalChance('last_two_self_merge_dead_end')) return;
                if (!busyEnding) {
                  await runNoMovesFailFlow({ reason: 'last_two_self_merge_dead_end', resetHint: false });
                }
                return;
              }
              
              // If after self-merge there's still room to continue (e.g., value 2, depth 3 → 4, depth 2 → can continue)
              devLog('✅ Stack CAN reach merge 6 and can continue after (', finalValue, '+', finalValue, '=', afterSelfMergeValue, ', depth:', finalStackDepth, '→', afterSelfMergeDepth, ') - NOT triggering fail screen');
            }
          }
          
          // 🔥 USER REQUEST: If this was last 3+ regular tiles that stacked (not merge 6), trigger fail screen immediately
          // Example: 1+1+1 → stack(1, depth=3) - all tiles involved, this is the last move, should fail quickly
          // 🔥 CRITICAL: Only trigger if this is TRULY the last move (no other tiles on board, no locked tiles)
          // This prevents blocking normal gameplay when stacking in the middle of the game
          const hasOtherActiveTiles = activeTilesBeforeCheck.some(t => t !== dst);
          const hasLockedTiles = tiles.some((t: any) => t && !t.destroyed && t.locked && (t.value|0) > 0);
          const isTrulyLastMove = !hasOtherActiveTiles && !hasLockedTiles && activeTilesBeforeCheck.length === 1 && activeTilesBeforeCheck[0] === dst;
          
          if (wasLastThreeOrMoreStack && isTrulyLastMove) {
            // 🔥 CRITICAL: Check if stack can reach merge 6 by merging with itself
            // Stack can merge with itself ONLY if: value + value <= 6 AND stackDepth >= 2
            const finalValue = dst.value || effSum;
            const finalStackDepth = dst.stackDepth || 1;
            const canReachMerge6 = (finalValue + finalValue) <= 6 && finalStackDepth >= 2;
            
            if (!canReachMerge6) {
              devLog('🚨🚨🚨 LAST MOVE DETECTED - Regular + regular → stack (3+ tiles, all tiles involved), only 1 tile remains, CANNOT reach merge 6, triggering fail screen');
              try { resetEndgameHint(); } catch {}
              devLog('🚨 Details:', {
                srcValue: src.value,
                dstValue: dst.value,
                effSum,
                finalTileValue: finalValue,
                finalTileStackDepth: finalStackDepth,
                canReachMerge6: canReachMerge6,
                wouldMergeTo: finalValue + finalValue,
                activeTilesCountBeforeWildProgress,
                combinedCountForPostCheck,
                hasOtherActiveTiles,
                hasLockedTiles,
                isTrulyLastMove
              });
              
              if (deferFailForStackWildContinuation('last_three_regular_stack_dead_end')) return;
              if (await preventTutorialFailWithFinalChance('last_three_regular_stack_dead_end')) return;
              if (!busyEnding) {
                await runNoMovesFailFlow({ reason: 'last_three_regular_stack_dead_end', resetHint: false });
              }
              return;
            } else {
              // 🔥 USER REQUEST FIX: Stack CAN reach merge 6, but check what remains AFTER self-merge
              // Same logic as wasLastTwoRegularStack case above
              const afterSelfMergeDepth = finalStackDepth - 1;
              const afterSelfMergeValue = finalValue + finalValue;
              
              devLog('🔍 Stack (3+) can reach merge 6 - checking what remains after self-merge:', {
                beforeSelfMerge: { value: finalValue, depth: finalStackDepth },
                afterSelfMerge: { value: afterSelfMergeValue, depth: afterSelfMergeDepth },
                isDeadEnd: afterSelfMergeValue === 6 && afterSelfMergeDepth === 1
              });
              
              // If self-merge results in merge 6 (depth 1) → that's a DEAD END (last move)
              if (afterSelfMergeValue === 6 && afterSelfMergeDepth === 1) {
                  devLog('🚨🚨🚨 LAST MOVE DETECTED - Stack (3+) can self-merge to merge 6 BUT will result in merge 6 (depth 1) = DEAD END, triggering fail screen');
                  try { resetEndgameHint(); } catch {}
                
                if (deferFailForStackWildContinuation('last_three_self_merge_dead_end')) return;
                if (await preventTutorialFailWithFinalChance('last_three_self_merge_dead_end')) return;
                if (!busyEnding) {
                  await runNoMovesFailFlow({ reason: 'last_three_self_merge_dead_end', resetHint: false });
                }
                return;
              }
              
              devLog('✅ Stack (3+) CAN reach merge 6 and can continue after (', finalValue, '+', finalValue, '=', afterSelfMergeValue, ', depth:', finalStackDepth, '→', afterSelfMergeDepth, ') - NOT triggering fail screen');
            }
          }

          // 🔥 SAFETY NET: If exactly 1 active regular tile remains and it cannot self-merge to 6, trigger fail
          const activeTileCount = activeTilesBeforeCheck.length;
          if (activeTileCount === 1) {
            if (await ensureTutorialSingleTileCanFinish('post_stack_single_regular_tile')) return;
            const onlyTile = activeTilesBeforeCheck[0];
            const onlyValue = onlyTile?.value | 0;
            const onlyDepth = onlyTile?.stackDepth || 1;
            const isWild = isWildLikeTile(onlyTile);
            const canSelfMergeToSix = !isWild && onlyDepth >= 2 && (onlyValue + onlyValue) <= 6;
            if (!isWild && !canSelfMergeToSix && !busyEnding) {
              devLog('🚨 SAFETY NET: Single regular tile left that cannot reach merge 6 - routing through no-moves fail flow');
              try { resetEndgameHint(); } catch {}
              if (deferFailForStackWildContinuation('single_regular_tile_safety_net')) return;
              if (await preventTutorialFailWithFinalChance('single_regular_tile_safety_net')) return;
              await runNoMovesFailFlow({
                reason: 'single_regular_tile_safety_net',
                waitMs: 500,
                resetHint: false,
              });
              return;
            }
          }
          
          devLog('🔍 Post-merge stuck check - DETAILED STATE:', {
            totalTiles: tiles.length,
            activeTilesCount: activeTilesBeforeCheck.length,
            activeTiles: activeTilesBeforeCheck.map(t => ({ 
              value: t.value, 
              special: t.special, 
              locked: t.locked,
              stackDepth: t.stackDepth || 1,
              isDst: t === dst 
            })),
            dstValue: dst.value,
            dstStackDepth: dst.stackDepth || 1,
            dstLocked: dst.locked,
            dstInTiles: dstInTiles,
            dstIsActive: dstIsActive,
            effSum: effSum,
            busyEnding: busyEnding,
            wasLastTwoRegularStack
          });
          
          // 🔥 CRITICAL: Clear cache right before check to ensure fresh data
          clearEndGameCache();
          
          const stuckCheckContext: EndGameContext = {
            tiles,
            moves,
            makeBoard
          };
          // Force refresh because tile was just removed
          const stuckCheckResult = checkEndGame(stuckCheckContext, true);
          
          devLog('🔍 Post-merge stuck check - RESULT:', {
            resultType: stuckCheckResult.type,
            resultReason: stuckCheckResult.reason,
            activeTilesCount: activeTilesBeforeCheck.length
          });
          
          if (stuckCheckResult.type === 'stuck') {
          devLog('🚨🚨🚨 GAME STUCK after regular merge - triggering fail screen');
          try { resetEndgameHint(); } catch {}
            devLog('🚨 Final state:', {
              activeTilesCount: activeTilesBeforeCheck.length,
              tiles: activeTilesBeforeCheck.map(t => ({ 
                value: t.value, 
                stackDepth: t.stackDepth || 1,
                special: t.special 
              })),
              reason: stuckCheckResult.reason
            });
            
            if (deferFailForStackWildContinuation('post_merge_stuck')) return;
            if (await preventTutorialFailWithFinalChance('post_merge_stuck')) return;
            if (!busyEnding) {
              await runNoMovesFailFlow({ reason: 'post_merge_stuck', resetHint: false });
            } else {
              devWarn('⚠️ busyEnding is true, NOT showing fail screen');
            }
            return;
          } else {
            devLog('✅ Post-merge stuck check: Game continues -', stuckCheckResult.reason);
          }
        } else if (isWildMagnetMerge) {
          devLog('🧲 SKIPPING post-merge stuck check - wild-magnet will pull tiles after merge completes');
        } else if (isMerge6) {
          devLog('🎯 SKIPPING post-merge stuck check - merge-6 will spawn new tiles, check will happen AFTER spawn completes');
        }
        
        const isWildTntMergeNow = isSpecialDiceTntLikeTile(src) || isSpecialDiceTntLikeTile(dst);
        if (wildActive) {
          try {
            screenShake(app, {
              strength: 26,
              duration: 0.36,
              steps: 26,
              ease: 'sine.inOut'
            });
          } catch {}

          glassCrackAtTile(board, dst, TILE * 1.3, 1.6);
          if (!isWildTntMergeNow) {
            woodShardsAtTile(board, dst, { enhanced: true, wild: true, count: 26, intensity: 1.6, spread: 1.6, size: 1.4, speed: 0.9, vanishDelay: 0.0, vanishJitter: 0.015 });
          }
          wildImpactEffect(dst, { squash: 0.24, stretch: 0.20, tilt: 0.14, bounce: 1.18 });
          if (!isWildTntMergeNow) {
            markMergePerformance('wild-smoke-alt-start');
            smokeBubblesAtTile(board, dst, TILE * 1.2, 2.6, {
              spawnShape: 'box',
              maxParticles: 72,
              groupedOwner: true,
              deferFutureBursts: true,
            });
            markMergePerformance('wild-smoke-alt-created');
          }
        }

        // countdown moves
        moves = Math.max(0, moves - 1);
        animateBoardHUD(boardNumber, 0.40);
        
        // 🔥 CRITICAL FIX: If moves === 0, delay check to ensure tiles array is updated after merge
        // Problem: checkMovesDepleted() was called immediately but tiles array might not be updated yet
        // Solution: Wait for merge animation to complete (400ms) before checking
        if (moves === 0) {
          // Wait for merge animation to complete before checking stuck state
          trackAppTimeout(() => {
            checkMovesDepleted();
          }, 400);
          return;
        }

        // 🔥 REFACTORED: Uklonjen STUCK PROTECTION timer - koristimo samo checkLevelEnd() s delay-om
        // checkLevelEnd() već provjerava sve potrebne scenarije kroz checkEndGame()
        // Nema potrebe za dodatnim timerom koji stvara race conditions
        
        // 🔥 CRITICAL BUG FIX: Always call checkLevelEnd() after merge completes (even if post-merge check passed)
        // This ensures stuck state is detected even when player merges tiles spawned by magnet
        // Example: Magnet spawns 2 tiles (1+1), player merges them (1+1=2), now stuck with 1 tile that can't merge
        // Previous bug: Post-merge check might return early if visibleTilesBeforeCheck >= 2, but after merge completes
        // there might be only 1 tile left that can't merge, and checkLevelEnd() wouldn't be called
        if (effSum !== 6) {
          // 🔥 CRITICAL FIX: Increase delay to ensure merge animation completes before endgame check
          // This prevents stuck detection from being blocked by merge animations
          // Delay increased from 100ms to 400ms to match merge animation duration
          trackAppTimeout(() => {
            checkLevelEnd();
          }, 400);
        } else {
          // Za merge-6, checkLevelEnd() se poziva nakon spawn-a (već postoji delay u merge-6 block)
          // Ne treba dodatni poziv ovdje
        }
        } catch (error) {
          // GSAP does not observe rejected async callbacks. The accepted regular
          // stack must still atomically remove src, normalize dst and release a
          // full-meter handoff before any later wild spawn may continue.
          devError('❌ Regular merge async completion failed; finalizing owned board commit', error);
          finalizeRegularMergeBoardCommit('regular-merge-async-completion-error');
          scheduleOwnedMergeRecoveryCheck(0.12, 'regular-merge-async-completion-error');
        }
      }
    });
    return;
  }

  // ---- 6 (računaj combo i ovdje – nastavlja x6, x7, x8…)
  if (effSum === 6){
    // 🔥 CRITICAL FIX: Use saved srcSpecial/dstSpecial from line 3653-3654 (don't overwrite!)
    // These values were saved BEFORE any modifications to src/dst and BEFORE any branches
    // The saved values from outer scope (line 3653-3654) are already available in this closure
    // We DON'T need to reassign them - just use the saved values directly
    // 🔥 DEBUG: Log values to verify they're correct
    // Note: srcSpecial and dstSpecial are from outer scope (line 3653-3654), available via closure
    const savedSrcSpecial = srcSpecial; // From outer scope (line 3653)
    const savedDstSpecial = dstSpecial; // From outer scope (line 3654)
    
    devLog('🔍 MERGE 6: Using saved srcSpecial/dstSpecial from closure:', {
      savedSrcSpecial,
      savedDstSpecial,
      srcSpecialCurrent: src?.special,
      dstSpecialCurrent: dst?.special,
      srcDestroyed: src?.destroyed,
      dstDestroyed: dst?.destroyed,
      srcValue: src?.value,
      dstValue: dst?.value
    });
    
    // If saved values are undefined (shouldn't happen), use current values as fallback
    const srcSpecialForMerge6 = (savedSrcSpecial !== undefined && savedSrcSpecial !== null) ? savedSrcSpecial : (src?.special);
    const dstSpecialForMerge6 = (savedDstSpecial !== undefined && savedDstSpecial !== null) ? savedDstSpecial : (dst?.special);
    
    // 🔥 CRITICAL: Use these values throughout merge 6 block (create new const in this scope)
    // We can't shadow outer const, so we use new variable names
    const srcSpecialMerge6 = srcSpecialForMerge6;
    const dstSpecialMerge6 = dstSpecialForMerge6;
    
    // 🔥 NOTE: Bubbles animation is now triggered in drag-core.ts BEFORE merge function is called
    // This ensures bubbles start IMMEDIATELY when wild-juice is dropped, before any merge logic
    // No need to call it here again (it's already started in drag-core.ts)
    
    // 🔥 CRITICAL: Check if this is the last merge BEFORE starting merge 6 animation
    // This covers ALL scenarios where merge 6 is made from ALL remaining tiles:
    // - 2 tiles (stacked or not) that can merge = merge 6
    // - 3+ tiles (all stacked, e.g. 1+1+1+1+1+1) that can merge = merge 6
    // - Any combination where ALL active tiles are involved in this merge 6
    // - last tile + wild = merge 6
    // - wild + last tile(s) = merge 6
    
    // 🔥 CRITICAL: Include wild tiles even if they have value 0
    // Wild tiles should be counted as active tiles for last merge detection
    // 🔥 CRITICAL FIX: Include wild-juice in wild tile check (same as wild star)
    // Use the snapshot captured at merge entry. Special-dice finale animation can
    // mutate/remove the wild tile before this merge-6 branch runs; re-reading the
    // live board here would then lose the original final pair and incorrectly spawn.
    const capturedTilesAtMergeEntry = Array.isArray((dst as any)?._ccActiveTilesAtMergeEntry)
      ? (dst as any)._ccActiveTilesAtMergeEntry
      : null;
    const capturedFinalMergeSnapshot = (dst as any)?._ccFinalMergeSnapshotAtMergeEntry;
    const capturedWasFinalMerge = capturedFinalMergeSnapshot?.isFinalMerge === true;
    const liveFinalMergeTileSets = getFinalMergeTileSets({
      tiles: capturedTilesAtMergeEntry ?? collectBoardGameplayTiles(),
      src,
      dst,
    });
    // A confirmed entry-time final merge is immutable. Finale FX may clear the
    // special marker, visibility, or live tile ownership before this callback.
    const activeTilesBeforeMerge = capturedWasFinalMerge && capturedTilesAtMergeEntry
      ? capturedTilesAtMergeEntry
      : liveFinalMergeTileSets.activeTilesBeforeMerge;
    const finalMergeBlockersBefore = capturedWasFinalMerge
      ? []
      : liveFinalMergeTileSets.finalMergeBlockersBefore;
    
    // 🔥 CRITICAL FIX v36: Count TOTAL tiles including stacked tiles (stackDepth)
    // This is essential for correct "last merge" detection with stacked tiles
    // Example: wild + stack(5, depth=3) + stack(5, depth=2) = 6 total tiles, not 3!
    // Previous bug: activeTilesCount = activeTilesBeforeMerge.length (ignored stackDepth)
    const activeTilesCount = activeTilesBeforeMerge.reduce((sum, t) => {
      const depth = t.stackDepth || 1;
      return sum + depth;
    }, 0);
    
    logger.debug('🔍 ACTIVE TILES COUNT (including stackDepth)', 'app-core', {
      visibleTiles: activeTilesBeforeMerge.length,
      totalTilesWithStackDepth: activeTilesCount,
      tilesDetails: activeTilesBeforeMerge.map(t => ({
        value: t.value,
        special: t.special,
        stackDepth: t.stackDepth || 1
      }))
    });
    
    // 🔥 CRITICAL: Check if this is a wild-magnet merge that will pull other tiles
    // If wild-magnet will pull tiles, it's NOT a last merge (unless there are no tiles to pull)
    // 🔥 CRITICAL FIX: Use srcSpecialMerge6/dstSpecialMerge6 (saved values) instead of srcSpecial/dstSpecial
    const isWildMagnetMerge = isSpecialDiceMagnetLikeTile(src, srcSpecialMerge6) || isSpecialDiceMagnetLikeTile(dst, dstSpecialMerge6);
    const magnetVariantAtMergeEntry = isWildMagnetMerge
      ? srcSpecialVariantAtMergeEntry || dstSpecialVariantAtMergeEntry
      : null;
    const magnetShardColorsAtMergeEntry = Object.freeze([
      ...(getSpecialDiceShardColors(magnetVariantAtMergeEntry) || []),
    ]);
    let hasTilesToPull = false;
    if (isWildMagnetMerge) {
      // 🎯 CRITICAL FIX: Count magnets INCLUDING their stackDepth!
      // Example: magnet with depth 1 + regular tile with depth 2 = 3 total tiles (not 2!)
      let magnetsOnBoard = 0;
      let regularTilesOnBoard = 0;
      for (const t of activeTilesBeforeMerge) {
        if (isSpecialDiceMagnetLikeTile(t)) {
          magnetsOnBoard += 1;
          continue;
        }
        if (!isWildLikeTile(t) && (t.value | 0) > 0) {
          regularTilesOnBoard += 1;
        }
      }
      
      // 🎯 USE activeTilesCount (includes stackDepth) instead of activeTilesBeforeMerge.length
      const totalActiveTiles = activeTilesCount; // Already calculated above with stackDepth!
      
      devLog('🧲 Magnet pull logic check:', {
        magnetsOnBoard,
        regularTilesOnBoard,
        totalActiveTiles,
        physicalTiles: activeTilesBeforeMerge.length,
        srcSpecial,
        dstSpecial
      });
      
      // 🔥 CRITICAL: ONLY special case where magnet behaves like wild (NO pull):
      // 1 magnet + 1 regular tile (last 2 tiles TOTAL including depth) → NO pull, behaves like wild
      // ALL other cases (including 2 magnets + 1 tile) → magnet pulls normally
      const isOneMagnetOneTile = magnetsOnBoard === 1 && regularTilesOnBoard === 1 && totalActiveTiles === 2;
      
      devLog('🧲 MAGNET PULL CHECK:', {
        magnetsOnBoard,
        regularTilesOnBoard,
        totalActiveTiles,
        physicalTiles: activeTilesBeforeMerge.length,
        isOneMagnetOneTile,
        srcSpecial,
        dstSpecial
      });
      
      if (isOneMagnetOneTile) {
        hasTilesToPull = false;
        devLog('🧲 Magnet behaves like wild (NO pull): 1 magnet + 1 tile (last 2)');
      } else {
        // Normal magnet behavior: Check if there are other tiles that can be pulled
      const targetTile = isSpecialDiceMagnetLikeTile(src, srcSpecialMerge6) ? src : dst;
      const candidates = getPlayableMagnetPullCandidates({
        tiles: collectBoardGameplayTiles(),
        src,
        dst,
        magnetTile: targetTile,
      });
      hasTilesToPull = candidates.length > 0;
      devLog('🧲 Wild-magnet merge detected - tiles that can be pulled:', candidates.length, hasTilesToPull ? '(will pull tiles, NOT last merge)' : '(no tiles to pull, might be last merge)');
      }
      // 🔥 CRITICAL: Store hasTilesToPull on dst tile for later use in last merge check
      if (dst && !dst.destroyed) {
        (dst as any)._hasTilesToPull = hasTilesToPull;
      }
      
      // 🔥 CRITICAL FIX: Store isWildMagnetLastTwo flag for last merge check
      // This is only valid for wild magnet merge, so we calculate it here
      if (
        magnetsOnBoard === 1 &&
        regularTilesOnBoard === 1 &&
        totalActiveTiles === 2 &&
        !hasTilesToPull &&
        !boardHasPersistentLockedTiles(tiles)
      ) {
        (dst as any)._isWildMagnetLastTwo = true;
        devLog('🧲 Wild magnet + regular (last 2 tiles, no pull) - marked as last merge candidate');
      }
    }
    
    // Calculate how many tiles are involved in this merge (including stacked tiles)
    const srcDepth = src.stackDepth || 1;
    const dstDepth = dst.stackDepth || 1;
    const combinedCount = srcDepth + dstDepth; // Total tiles involved in merge (including stacked)
    
    // 🔥 CRITICAL: If ALL active tiles on board are involved in this merge, it's the last merge
    // This works for ANY number of tiles: 2, 3, 4, 5, 6... as long as they're all involved
    
    // 🔥 ENHANCED LOGGING: Log all details for debugging
    logger.debug('🔍 LAST MERGE CHECK (BEFORE merge 6)', 'app-core', {
      activeTilesCount,
      combinedCount,
      srcValue: src.value,
      dstValue: dst.value,
      srcSpecial: srcSpecial,
      dstSpecial: dstSpecial,
      srcInActiveTiles: activeTilesBeforeMerge.includes(src),
      dstInActiveTiles: activeTilesBeforeMerge.includes(dst),
      isWildMagnetMerge,
      hasTilesToPull,
      activeTilesDetails: activeTilesBeforeMerge.map(t => ({ 
        value: t.value, 
        special: t.special, 
        locked: t.locked,
        isSrc: t === src,
        isDst: t === dst
      }))
    });
    
    const allTilesInvolved = combinedCount >= activeTilesCount && 
                              activeTilesBeforeMerge.includes(src) && 
                              activeTilesBeforeMerge.includes(dst);
    
    // 🔥 CRITICAL FIX: Wild merge should NEVER be marked as "last merge" if there are other tiles on board!
    // Wild merge ALWAYS spawns new tiles (mult based on combinedCount), so it's NOT a last merge
    // Example: 2 tiles + wild = 3 tiles total
    //   - Merge tile + wild → merge 6 (wild is one of the merging tiles)
    //   - Spawns 2 new tiles (combinedCount = 2)
    //   - Board: merge 6 + 1 remaining tile + 2 new tiles = 4 tiles total
    //   - Game continues!
    // 
    // ONLY mark as last merge if:
    // 1. Exactly 2 tiles total (wild + 1 tile)
    // 2. No other tiles on board
    // 🔥 CRITICAL FIX: Include wild-juice in wild tile check (same as wild star)
    // 🔥 CRITICAL FIX: Use srcSpecialMerge6/dstSpecialMerge6 (saved values) instead of srcSpecial/dstSpecial
    const oneIsRegularWild =
      (isWildLikeSpecial(srcSpecialMerge6) && !isSpecialDiceMagnetLikeTile(src, srcSpecialMerge6)) ||
      (isWildLikeSpecial(dstSpecialMerge6) && !isSpecialDiceMagnetLikeTile(dst, dstSpecialMerge6));
    const neitherIsWildMagnet = !(isSpecialDiceMagnetLikeTile(src, srcSpecialMerge6) || isSpecialDiceMagnetLikeTile(dst, dstSpecialMerge6));
    // 🔥 CRITICAL FIX: Use visibleTilesCount (visible tiles) NOT activeTilesCount (includes stackDepth)
    const visibleTilesCountForWild = activeTilesBeforeMerge.length; // Number of VISIBLE tiles
    const exactlyTwoActiveTiles = visibleTilesCountForWild === 2; // ONLY if 2 VISIBLE tiles total
    const bothTilesInActiveList = activeTilesBeforeMerge.includes(src) && activeTilesBeforeMerge.includes(dst);
    const isRegularWildLastTwo = oneIsRegularWild && 
                                 neitherIsWildMagnet &&
                                 exactlyTwoActiveTiles && // This is key - ONLY 2 VISIBLE tiles
                                 bothTilesInActiveList;
    
    // 🔥 ENHANCED LOGGING: Log detailed breakdown for debugging
    if (oneIsRegularWild && neitherIsWildMagnet) {
      devLog('🔍 REGULAR WILD LAST TWO CHECK:', {
        oneIsRegularWild,
        neitherIsWildMagnet,
        exactlyTwoActiveTiles,
        bothTilesInActiveList,
        activeTilesCount,
        srcSpecial,
        dstSpecial,
        srcInActive: activeTilesBeforeMerge.includes(src),
        dstInActive: activeTilesBeforeMerge.includes(dst),
        activeTilesDetails: activeTilesBeforeMerge.map(t => ({ 
          value: t.value, 
          special: t.special, 
          isSrc: t === src,
          isDst: t === dst
        })),
        isRegularWildLastTwo
      });
    }
    // 🔥 CRITICAL FIX: For wild-magnet, still check if it's last merge (2 tiles total)
    // Wild-magnet pulls tiles, so it's different from regular wild
    // 🔥 CRITICAL FIX: Include wild-juice in wild tile check (same as wild star)
    // 🔥 CRITICAL FIX: Use visibleTilesCount (visible tiles) NOT activeTilesCount (includes stackDepth)
    // 🔥 CRITICAL FIX: Use srcSpecialMerge6/dstSpecialMerge6 (saved values) instead of srcSpecial/dstSpecial
    const visibleTilesCountForWildMagnet = activeTilesBeforeMerge.length; // Number of VISIBLE tiles
    const isWildRegularLastTwo = (isWildLikeSpecial(srcSpecialMerge6) || isWildLikeSpecial(dstSpecialMerge6)) &&
                                 visibleTilesCountForWildMagnet === 2 && // 🔥 FIX: ONLY if exactly 2 VISIBLE tiles total
                                 activeTilesBeforeMerge.includes(src) &&
                                 activeTilesBeforeMerge.includes(dst) &&
                                 !(isWildMagnetMerge && hasTilesToPull); // 🔥 CRITICAL: Exclude if wild-magnet will pull tiles
    
    // 🔥 CRITICAL FIX: Wild merge should ONLY be "last merge" if exactly 2 tiles total
    // If more than 2 tiles, it's NOT last merge because spawn will happen
    // Example: wild + 2 tiles = 3 tiles total → NOT last merge, will spawn
    // 🔥 CRITICAL FIX: Include wild-juice in wild tile check (same as wild star)
    // 🔥 CRITICAL FIX: Use visibleTilesCount (visible tiles) NOT activeTilesCount (includes stackDepth)
    // 🔥 CRITICAL FIX: Use srcSpecialMerge6/dstSpecialMerge6 (saved values) instead of srcSpecial/dstSpecial
    const visibleTilesCountForWildLast = activeTilesBeforeMerge.length; // Number of VISIBLE tiles
    const isWildLastTileMerge = (isWildLikeSpecial(srcSpecialMerge6) || isWildLikeSpecial(dstSpecialMerge6)) &&
                                 visibleTilesCountForWildLast === 2 && // 🔥 FIX: ONLY if exactly 2 VISIBLE tiles total
                                 allTilesInvolved &&
                                 !(isWildMagnetMerge && hasTilesToPull); // 🔥 CRITICAL: Exclude if wild-magnet will pull tiles
    
    // Check if these tiles can merge together to form merge 6
    // Since we're in the effSum === 6 block, the merge WILL result in a merge 6
    // So if all tiles are involved, this is the last merge
    // - Wild merge always creates merge 6
    // - Regular merge: sum must equal 6 OR all tiles are involved (stacked tiles can combine to 6)
    // 🔥 CRITICAL FIX: For wild merge, ONLY mark as last merge if exactly 2 tiles total
    const canMergeTogether = wildActive || 
                             (src.value|0) + (dst.value|0) === 6 ||
                             (allTilesInvolved && (src.value|0) + (dst.value|0) <= 6); // If all tiles involved, they can merge to 6
    
    // 🔥 CRITICAL FIX: If wild merge and more than 2 tiles, NOT last merge (will spawn)
    const isLastMergeableTiles = allTilesInvolved && canMergeTogether && 
                                 (!wildActive || activeTilesCount === 2); // If wild, only last merge if 2 tiles total
    
    // 🔥 USER REQUEST: Last merge applies to:
    // 1. Wild + regular → merge 6 (only 2 tiles) = clean board
    // 2. Regular + regular → merge 6 (only 2 tiles, e.g. 4+2=6, 3+3=6) = clean board
    // Regular + regular → stack (only 2 tiles, e.g. 3+2=5) = fail screen (handled in post-merge check)
    // 🔥 CRITICAL: Check if either tile is wild (any wild type with "wild" prefix)
    // 🔥 CRITICAL FIX: Use srcSpecialMerge6/dstSpecialMerge6 (saved values) instead of srcSpecial/dstSpecial
    const srcIsWild = isWildLikeSpecial(srcSpecialMerge6);
    const dstIsWild = isWildLikeSpecial(dstSpecialMerge6);
    const initialFinalMergeSpawnGuard = resolveFinalMergeSpawnGuard({
      activeTilesBeforeMerge,
      finalMergeBlockersBefore,
      src,
      dst,
      effSum,
      srcIsWild,
      dstIsWild,
      magnetWillPull: isWildMagnetMerge && hasTilesToPull,
    });
    const isRegularRegularLastTwoMerge6 =
      initialFinalMergeSpawnGuard.shouldBlockSpawn &&
      initialFinalMergeSpawnGuard.reason === 'regular-final-pair';
    
    logger.debug('🔍 LAST MERGE CHECK DETAILS (with regular + regular support)', 'app-core', {
      activeTilesCount,
      wildActive,
      isRegularWildLastTwo,
      isWildRegularLastTwo,
      isLastMergeableTiles,
      isWildLastTileMerge,
      isRegularRegularLastTwoMerge6, // 🔥 NEW: Regular + regular → merge 6
      willMarkAsLastMerge: isRegularWildLastTwo || isWildRegularLastTwo || isLastMergeableTiles || isWildLastTileMerge || isRegularRegularLastTwoMerge6
    });
    
    // 🔥 CRITICAL: Check if this is any wild + regular OR regular + regular → merge 6 with exactly 2 tiles
    // This covers ALL wild types: wild, wild-magnet, wild-juice, and any future wild types with "wild" prefix
    // 🔥 USER REQUEST: Simple rule - if exactly 2 VISIBLE tiles total and one is wild (any wild type), it's last merge
    // 🔥 CRITICAL FIX: Use activeTilesBeforeMerge.length (visible tiles) NOT activeTilesCount (includes stackDepth)
    const visibleTilesCount = activeTilesBeforeMerge.length; // Number of VISIBLE tiles (not including stackDepth)
    const isAnyWildLastTwo =
      initialFinalMergeSpawnGuard.shouldBlockSpawn &&
      initialFinalMergeSpawnGuard.reason === 'wild-final-pair';

    // 🔥 HARD RULE (catastrophic bug fix):
    // Any wild + regular as the last two ACTIVE tiles must ALWAYS resolve to clean-board.
    // Locked/ghost placeholders are irrelevant. Magnet is excluded only when it will pull more tiles.
    const finalMergeResult = resolveMergeFinality({
      mode: isArcadeHomeRunMode() ? 'arcade' : 'journey',
      finalMergeInput: {
        activeTilesBeforeMerge,
        src,
        dst,
        effSum,
        finalMergeBlockersBefore,
        isWildMagnetMerge,
        hasTilesToPull,
      },
      willPulledTilesMerge: false,
    });
    const finalMergeSnapshot = capturedWasFinalMerge
      ? capturedFinalMergeSnapshot
      : finalMergeResult.finalMerge;
    const isFinalWildLastTwo = finalMergeSnapshot.isFinalWildLastTwo;
    const isFinalRegularMerge6Snapshot = finalMergeSnapshot.isFinalRegularMerge6;
    const finalMergeDecision = finalMergeResult.decision;
    const isFinalMergeByResolver = capturedWasFinalMerge || finalMergeDecision.type === 'complete';
    emitIOSArcadeGameplayTrace('merge6-decision', {
      boardNumber,
      srcSpecial: srcSpecialMerge6 || null,
      dstSpecial: dstSpecialMerge6 || null,
      activeTileCount: activeTilesBeforeMerge.length,
      blockerCount: finalMergeBlockersBefore.length,
      isWildMagnetMerge,
      hasTilesToPull,
      capturedWasFinalMerge,
      isFinalMergeByResolver,
      snapshot: finalMergeSnapshot,
      decision: finalMergeDecision,
    });
    try {
      (dst as any)._ccFinalMergeAllowedByResolver = isFinalMergeByResolver;
      (dst as any)._ccFinalMergeBlockerCount = finalMergeBlockersBefore.length;
      (dst as any)._ccFinalMergeActiveSnapshotCount = activeTilesBeforeMerge.length;
      if (isFinalMergeByResolver) {
        markFinalMergeRuntime(dst, getSpecialDiceFinaleFxForMerge({
          src,
          dst,
          srcSpecial: srcSpecialMerge6,
          dstSpecial: dstSpecialMerge6,
        }));
      }
      if (!isFinalMergeByResolver) {
        (dst as any)._ccNonFinalMerge6 = true;
        (dst as any)._ccNonFinalMerge6At = Date.now();
        if (!wildActive) {
          regularMerge6CleanupToken = merge6DestinationCleanupOwner.claim(dst);
          if (regularMerge6CleanupToken !== null) {
            const watchdogToken = regularMerge6CleanupToken;
            trackAppTimeout(() => {
              if (!merge6DestinationCleanupOwner.owns(dst, watchdogToken)) return;
              if ((dst as any)?._isLastMerge === true || (dst as any)?._ccFinalMergeAllowedByResolver === true) {
                merge6DestinationCleanupOwner.release(dst, watchdogToken);
                return;
              }
              if ((dst?.value | 0) !== 6 || dst?.special) {
                merge6DestinationCleanupOwner.release(dst, watchdogToken);
                return;
              }
              devWarn('🧹 MERGE-6 CLEANUP WATCHDOG: removing an unfinished regular destination', {
                token: watchdogToken,
                gridX: dst?.gridX,
                gridY: dst?.gridY,
                value: dst?.value,
              });
              merge6DestinationCleanupOwner.release(dst, watchdogToken);
              try { detachTileFromGrid(dst, grid); } catch {}
              try { removeTile(dst); } catch {}
            }, 1200);
          }
        }
        (window as any).__ccNonFinalMerge6GuardUntil = Math.max(
          Number((window as any).__ccNonFinalMerge6GuardUntil || 0),
          Date.now() + 2500,
        );
      }
    } catch {}
    
    devLog('🔍 isAnyWildLastTwo CHECK:', {
      srcIsWild,
      dstIsWild,
      oneIsWild: srcIsWild || dstIsWild,
      oneWildOneNot: srcIsWild !== dstIsWild,
      visibleTilesCount, // 🔥 FIX: Use visible tiles count
      activeTilesCount, // Keep for reference
      srcInActive: activeTilesBeforeMerge.includes(src),
      dstInActive: activeTilesBeforeMerge.includes(dst),
      isWildMagnetMerge,
      hasTilesToPull,
      isAnyWildLastTwo,
      isFinalWildLastTwo,
      isFinalRegularMerge6Snapshot,
      finalMergeDecision,
      finalMergeBlockersBefore: finalMergeBlockersBefore.map((t: any) => ({
        value: t?.value,
        special: t?.special || null,
        locked: t?.locked === true,
        visible: t?.visible !== false,
        alpha: t?.alpha,
        gridX: t?.gridX,
        gridY: t?.gridY,
      }))
    });
    
    // 🔥 USER REQUEST: Mark as last merge if:
    // 1. Regular + regular → merge 6 (only 2 tiles, e.g. 3+3=6, 4+2=6) = clean board
    // 2. ANY wild + regular → merge 6 (only 2 tiles) = clean board
    // This covers ALL wild types: wild, wild-magnet, wild-juice, and any future wild types
    // The resolver is the source of truth. The legacy booleans below are retained
    // only as diagnostics, so a stale hardcoded path cannot override central rules.
    const isWildMagnetLastTwo = (dst as any)?._isWildMagnetLastTwo === true;
    const legacyLastMergeCandidate =
      isRegularRegularLastTwoMerge6 ||
      isAnyWildLastTwo ||
      isWildRegularLastTwo ||
      isLastMergeableTiles ||
      isWildLastTileMerge ||
      isWildMagnetLastTwo ||
      isFinalWildLastTwo;
    let isLastMerge = isFinalMergeByResolver;
    if (!isLastMerge && legacyLastMergeCandidate) {
      devWarn('🧭 Legacy last-merge candidate ignored by central resolver', {
        finalMergeDecision,
        isRegularRegularLastTwoMerge6,
        isAnyWildLastTwo,
        isWildRegularLastTwo,
        isLastMergeableTiles,
        isWildLastTileMerge,
        isWildMagnetLastTwo,
        isFinalWildLastTwo,
        visibleTilesCount,
        activeTilesCount,
        blockerCount: finalMergeBlockersBefore.length,
      });
    }
    // 🔥 SAFETY: If more than 2 visible tiles existed before merge, this can NEVER be the last merge
    if (isLastMerge && visibleTilesCount > 2) {
      devWarn('⚠️ LAST MERGE OVERRIDE: visibleTilesCount > 2, forcing NOT last merge', {
        visibleTilesCount,
        isRegularRegularLastTwoMerge6,
        isAnyWildLastTwo,
        isWildRegularLastTwo,
        isLastMergeableTiles,
        isWildLastTileMerge,
        isWildMagnetLastTwo,
        isFinalWildLastTwo,
        finalMergeDecision,
      });
      isLastMerge = false;
    }
    if (isLastMerge && finalMergeBlockersBefore.length > 0) {
      devWarn('⚠️ LAST MERGE OVERRIDE: other gameplay tile(s) still exist, forcing NOT last merge', {
        blockerCount: finalMergeBlockersBefore.length,
        blockers: finalMergeBlockersBefore.map((t: any) => ({
          value: t?.value,
          special: t?.special || null,
          locked: t?.locked === true,
          visible: t?.visible !== false,
          alpha: t?.alpha,
          gridX: t?.gridX,
          gridY: t?.gridY,
        })),
        visibleTilesCount,
        isRegularRegularLastTwoMerge6,
        isAnyWildLastTwo,
        isWildRegularLastTwo,
        isLastMergeableTiles,
        isWildLastTileMerge,
        isWildMagnetLastTwo,
        isFinalWildLastTwo,
        finalMergeDecision,
      });
      isLastMerge = false;
    }
    // SOURCE OF TRUTH: Final merge-6 is determined by active/visible merge candidates.
    // Locked/persistent tiles must NOT cancel last-merge detection.
    
    if (isLastMerge) {
      const mergeType = isFinalRegularMerge6Snapshot ? 'Regular + regular' : 'Wild + regular';
      devLog(`🚨🚨🚨 LAST MERGE DETECTED (BEFORE merge 6 animation) - ${mergeType} → merge 6, only 2 tiles`);
      devLog('🚨🚨🚨 Detected by:', {
        isRegularRegularLastTwoMerge6,
        isAnyWildLastTwo,
        isWildRegularLastTwo,
        isLastMergeableTiles,
        isWildLastTileMerge,
        isWildMagnetLastTwo,
        isFinalWildLastTwo,
        finalMergeDecision,
        srcIsWild,
        dstIsWild,
        srcSpecial,
        dstSpecial
      });
      devLog('🚨🚨🚨 Last merge details:', {
        activeTilesCount,
        combinedCount,
        allTilesInvolved,
        canMergeTogether,
        isWildLastTileMerge,
        isWildRegularLastTwo,
        isRegularWildLastTwo,
        isRegularRegularLastTwoMerge6, // 🔥 NEW
        isWildMagnetMerge,
        hasTilesToPull,
        srcValue: src.value,
        dstValue: dst.value,
        srcSpecial: srcSpecial,
        dstSpecial: dstSpecial
      });
      
      // 🔥 CRITICAL: DON'T set busyEnding here - let normal merge 6 flow complete with animations
      // busyEnding will be set in onComplete callback AFTER animations finish
      // busyEnding = true; // REMOVED - was preventing normal merge 6 animations
      
      // Continue with merge 6 animation, but mark that this is the last merge
      // We'll handle clean board flow in the onComplete callback
      (dst as any)._isLastMerge = true;
      try { (src as any)._isLastMerge = true; } catch {}
      devLog('✅✅✅ _isLastMerge flag SET to TRUE on dst tile (merge-6 block):', {
        dstValue: dst.value,
        dstSpecial: dst.special,
        _isLastMerge: (dst as any)._isLastMerge,
        mergeType,
        isRegularRegularLastTwoMerge6,
        isAnyWildLastTwo,
        isWildRegularLastTwo,
        isLastMergeableTiles,
        isWildLastTileMerge,
        isFinalWildLastTwo
      });
      
      // 🔥 BOARD RECOVERY: Persist intent so we can recover if app is force-quit during animation
      // This flag will trigger clean board on next load if flow doesn't complete
      try {
        setPendingCleanBoard(boardNumber);
      } catch (e) {
        devWarn('⚠️ Failed to set pending clean board flag:', e);
      }
      
      // 🔥 CRITICAL FIX: Reset wild meter IMMEDIATELY when last merge is detected in merge-6 block
      // This prevents wild spawn from happening after last merge (double protection)
      // Wild meter may have been filled by addWildProgress before last merge was detected
      devLog('🚨🚨🚨 LAST MERGE (merge-6 block): Resetting wild meter to prevent wild spawn');
      cancelPendingWildContinuation('final_merge_detected_before_merge6_animation');
      
      // 🔥 CRITICAL FIX v40.5: Mark if this was a wild merge OR magnet merge (for spawn skip logic)
      // This includes: wild + regular, regular + wild, magnet + regular, regular + magnet, wild-juice + regular, regular + wild-juice
      const wasWildMerge = isSpecialDiceStarLikeTile(src, srcSpecial) || isSpecialDiceStarLikeTile(dst, dstSpecial);
      const wasWildJuiceMerge = isSpecialDiceJuiceLikeTile(src, srcSpecial) || isSpecialDiceJuiceLikeTile(dst, dstSpecial);
      const wasMagnetMerge = isSpecialDiceMagnetLikeTile(src, srcSpecial) || isSpecialDiceMagnetLikeTile(dst, dstSpecial);
      if (wasWildMerge || wasMagnetMerge || wasWildJuiceMerge) {
        (dst as any)._wasWildMerge = true;
        devLog('✅ _wasWildMerge flag set to TRUE (wild/magnet/wild-juice merge detected)', {
          wasWildMerge,
          wasWildJuiceMerge,
          wasMagnetMerge,
          srcSpecial,
          dstSpecial
        });
      }
      
      devLog('✅ _isLastMerge flag set to TRUE on dst tile');
    } else {
      devLog('❌ NOT last merge:', {
        activeTilesCount,
        combinedCount,
        allTilesInvolved,
        canMergeTogether,
        isWildLastTileMerge,
        isWildRegularLastTwo,
        isWildMagnetMerge,
        hasTilesToPull
      });
    }
    
    // Haptic feedback for merge 6
    if (typeof (window as any).triggerHapticImpact === 'function') {
      const isWildTntMergeHaptic = isSpecialDiceTntLikeTile(src, srcSpecial) || isSpecialDiceTntLikeTile(dst, dstSpecial);
      if (isWildTntMergeHaptic) {
        // Main wild merge impact must fire immediately on merge-6.
        (window as any).triggerHapticImpact('heavy');

        // Wild-TNT merge-6 pattern:
        // immediate main impact -> delay 400ms -> 5x @150ms -> pause 2000ms -> 4x @100ms
        const triggerImpact = () => {
          try { (window as any).triggerHapticImpact?.('light'); } catch {}
        };
        const startDelayMs = 400;
        const wave1Count = 5;
        const wave1IntervalMs = 150;
        const wave2PauseMs = 500;
        const wave2Count = 4;
        const wave2IntervalMs = 100;
        for (let i = 0; i < wave1Count; i++) {
          trackAppTimeout(triggerImpact, startDelayMs + i * wave1IntervalMs);
        }
        const wave2StartMs = startDelayMs + (wave1Count * wave1IntervalMs) + wave2PauseMs;
        for (let i = 0; i < wave2Count; i++) {
          trackAppTimeout(triggerImpact, wave2StartMs + i * wave2IntervalMs);
        }
      } else if (wildActive) {
        // Other wild merge 6 = Double HEAVY for longer feel
        (window as any).triggerHapticImpact('heavy');
        trackAppTimeout(() => {
          (window as any).triggerHapticImpact('heavy');
        }, 150);
      } else {
        // Normal merge 6 = MEDIUM (stronger than regular merge)
        (window as any).triggerHapticImpact('medium');
      }
    }
    if (!wildActive) playMerge6HeroBounce(dst);
    
    // Use combinedCount calculated earlier (for last merge check).
    // Final merge results must never render as a stack of 6s; the result is only
    // a short-lived residue before clean-board/new-reward handoff.
    const isFinalMergeVisualResult =
      isLastMerge ||
      isFinalMergeByResolver ||
      (dst as any)?._isLastMerge === true ||
      (src as any)?._isLastMerge === true;
    const visualDepth = isFinalMergeVisualResult ? 1 : Math.min(4, combinedCount);
    if (isFinalMergeVisualResult) {
      (dst as any)._ccSuppressStackVisual = true;
      dst.stackDepth = 1;
      try { dst.stackG?.destroy({ children: true }); } catch {}
      try { dst.stackG = null; } catch {}
    }

    // 🔥 CRITICAL FIX: Clear wild state BEFORE setValue to ensure pips are drawn correctly
    // Problem: If setValue is called first, _setValueVisuals sees tile as wild and hides pips.
    // Then clearWildState makes pips visible, but they're not drawn because drawPips wasn't called.
    // Solution: Clear wild state first, then setValue will see tile as regular and draw pips.
    if (wildActive) {
      // Wild star on dst: defer stopWildIdle (orbiting stars destroy) to rAF after this block so the 80ms fly tween starts without a freeze
      clearWildState(dst, { skipStopWildIdle: dstSpecial === 'wild' });
      // Ensure special is null so _setValueVisuals treats it as regular tile
      dst.special = null;
      dst.isWild = false;
      dst.isWildFace = false;
    }
    makeBoard.setValue(dst, 6, 0);
    if (regularMerge6CleanupToken !== null) {
      // setValue refreshes visual/input bindings; immediately restore the
      // transaction lock before the 80ms absorb tween can yield to another tap.
      merge6DestinationCleanupOwner.protect(dst, regularMerge6CleanupToken);
    }
    // 🔥 CRITICAL: After setValue (which uses requestAnimationFrame), double-check pips are drawn
    // This ensures pips are visible even if there was a race condition
    if (wildActive) {
      trackAppAnimationFrame(() => {
        trackAppAnimationFrame(() => {
          if (dst && !dst.destroyed && dst.value === 6 && !dst.special && !dst.isWild) {
            if ((dst as any)._ccHideFinalMergeResultVisual === true) {
              hideFinalMergeResultTileVisual(dst, 'post-setValue-final-merge-rAF');
              return;
            }
            // Tile is now regular merge 6, ensure pips are visible
            if (dst.pips) {
              dst.pips.visible = true;
            }
          }
        });
      });
    }
    dst.stackDepth = visualDepth;
    makeBoard.drawStack(dst);
    if (isFinalMergeVisualResult) {
      hideFinalMergeResultTileVisual(dst, 'merge6-block-after-setValue');
    }
    dst.zIndex = 10000;

    // CRITICAL: For wild-magnet, use multiplier based on number of pulled tiles (max 4x)
    // 🔥 CRITICAL FIX: Use saved srcSpecial and dstSpecial (captured before dst.special was cleared)
    // dst.special was set to null on line 3561, so we must use the saved values
    const isWildMagnet = srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet';
    // 🔥 BUG FIX: Wild star/juice should ALWAYS be mult=2, regardless of stackDepth
    // Wild-magnet uses mult=2 initially (updated later based on pulled tiles, max 4)
    // Regular merge 6 uses combinedCount (stackDepth sum) for multiplier
    const isWildStarOrJuice =
      isSpecialDiceStarLikeTile(src, srcSpecial) ||
      isSpecialDiceStarLikeTile(dst, dstSpecial) ||
      isSpecialDiceJuiceLikeTile(src, srcSpecial) ||
      isSpecialDiceJuiceLikeTile(dst, dstSpecial);
    // Calculate multiplier: wild-magnet or wild star/juice = 2, regular merge 6 = combinedCount (no cap: 2→2x, 3→3x, 4→4x, 5→5x, …)
    let mult = (isWildMagnet || isWildStarOrJuice) ? 2 : combinedCount;
    
    // Store isWildMagnet for use in onComplete callback
    const wasWildMagnet = isWildMagnet;
    if (dst && !dst.destroyed) {
      // Mark that this merge-6 originated from a wild magnet so lingering tiles can be scrubbed safely later
      (dst as any)._wasWildMagnetMerge6 = wasWildMagnet;
    }
    // SAFETY: prepare cleanup reference for magnet pulls (assigned inside block)
    let cleanupAllPullAnimations: () => void = () => {};

    // 🔥 END GAME FIX: Check if this is the LAST MOVE (only 2 tiles: magnet + 1 tile)
    // If so, this is merge-6 WITHOUT spawn, WITHOUT pull - automatic clean board!
    // 🎯 CRITICAL: Must count TOTAL tiles including stackDepth (not just physical tiles!)
    const activeTilesBeforeMergeMagnet = getFinalMergeTileSets({
      tiles: collectBoardGameplayTiles(),
      src,
      dst,
    }).activeTilesBeforeMerge;
    
    // 🎯 CRITICAL FIX: Count TOTAL tiles including stackDepth!
    // Example: magnet (depth 1) + stack(value 3, depth 2) = 2 physical tiles BUT 3 total tiles!
    // We need EXACTLY 2 TOTAL tiles (not physical) for last move scenario
    const totalTilesIncludingDepth = activeTilesBeforeMergeMagnet.reduce((sum, t) => {
      const depth = t.stackDepth || 1;
      return sum + depth;
    }, 0);
    
    const isLastMoveScenario =
      totalTilesIncludingDepth === 2 && isWildMagnet && !boardHasPersistentLockedTiles(tiles);
    
    // 🔥 DEBUG: Log detailed info for troubleshooting
    if (isWildMagnet) {
      devLog('🧲🧲🧲 MAGNET MERGE DEBUG:', {
        physicalTiles: activeTilesBeforeMergeMagnet.length,
        totalTilesIncludingDepth,
        isLastMoveScenario,
        srcValue: src.value,
        srcSpecial: srcSpecial,
        srcDepth: src.stackDepth || 1,
        dstValue: dst.value,
        dstSpecial: dstSpecial,
        dstDepth: dst.stackDepth || 1,
        tilesDetails: activeTilesBeforeMergeMagnet.map((t: any) => ({
          value: t.value,
          special: t.special,
          depth: t.stackDepth || 1,
          locked: t.locked
        }))
      });
    }
    
    if (isLastMoveScenario) {
      devLog('🎯🎯🎯 END GAME: Last 2 tiles (magnet + tile) = MERGE-6 without spawn!');
      devLog('🎯 Marking as last merge - no pull, no spawn, direct to clean board');
      
      // Mark this as last merge (skip all spawns, go to clean board)
      if (dst && !dst.destroyed) {
        (dst as any)._isLastMerge = true;
        (dst as any)._skipMagnetPull = true; // Skip magnet pull animation
        (dst as any)._noTilesPulled = true; // Mark explicitly that no tiles were pulled
        (dst as any)._hasTilesToPull = false; // CRITICAL: Override hasTilesToPull for safety
        cancelPendingWildContinuation('final_magnet_last_move_scenario');
        devLog('✅ Last merge flag set on dst tile - pull animation will be skipped');
        
        // 🔥 BOARD RECOVERY: Persist intent so we can recover if app is force-quit during animation
        try {
          setPendingCleanBoard(boardNumber);
          devLog('✅ RECOVERY: pendingCleanBoard flag set (magnet last move scenario)');
        } catch (e) {
          devWarn('⚠️ Failed to set pending clean board flag (magnet):', e);
        }
      }
      
      // 🎯 CRITICAL: Set multiplier to 0 (NO spawns for last merge - clean board!)
      mult = 0;
      devLog('🎯 Set mult = 0 to prevent ANY spawns (clean board scenario)');
    }
    
    // 🧲 WILD-MAGNET: Find and pull up to 4 nearest tiles IMMEDIATELY when merge 6 starts
    // This happens BEFORE the merge animation completes
    // Works for BOTH: magnet on tile AND tile on magnet
    // 🔥 CRITICAL: Only pull if hasTilesToPull is true (magnet behaves like wild if false)
    // 🔥 CRITICAL FIX: If hasTilesToPull is false, magnet behaves like wild - merge 6 tile should be removed normally
    if (isWildMagnet && !hasTilesToPull && dst && !dst.destroyed) {
      // Magnet behaves like wild - merge 6 tile should be removed normally (like regular merge 6)
      // This will be handled in onComplete callback - no special flag needed
      devLog('🧲 Magnet behaves like wild (hasTilesToPull=false) - merge 6 tile will be removed normally in onComplete callback');
    }
    
    // 🔥 END GAME FIX: Skip pull animation if this is last move scenario
    if (isWildMagnet && hasTilesToPull && dst && !dst.destroyed && !dst.locked && (dst.value | 0) > 0 && !isLastMoveScenario) {
      // 🔥 CRITICAL: Declare mergeStarted at outer scope so trackAppTimeout callback always has access
      let mergeStarted = false;
      // 🔥 CRITICAL FIX: Reset flag if previous pull completed but flag wasn't reset
      // This fixes the bug where newly spawned magnet can't pull because flag is still true
      // Check if there are any active pull animations - if not, reset flag
      const hasActivePullAnimations = STATE.tiles.some((t: any) => t && !t.destroyed && t._wildMagnetAffected === true);
      if (wildMagnetPullInProgress && !hasActivePullAnimations) {
        devLog('🧲 Resetting wildMagnetPullInProgress flag - no active pull animations found');
        setWildMagnetPullInProgress(false, 'no-active-pull-animations');
      }
      
      // 🔥 CRITICAL: Prevent overlapping wild-magnet pull animations
      if (wildMagnetPullInProgress) {
        devWarn('⚠️ Wild-magnet pull already in progress, skipping new pull animation');
        // Set mult to 1 for regular merge 6 scoring
        mult = 1;
      } else {
        setWildMagnetPullInProgress(true, 'pull-start');
      devLog('🧲 WILD-MAGNET: Merge 6 starting, finding up to 4 nearest tiles to pull IMMEDIATELY');
      
      // Find up to 4 nearest tiles to the merge location (use dst position BEFORE merge animation)
      const mergeX = dst.x;
      const mergeY = dst.y;
      
      // 🔥 CRITICAL FIX v37: Detailed logging to debug why tiles might not be found
      // Use saved srcSpecial and dstSpecial for accurate logging (dst.special was cleared on line 3561)
      devLog('🔍 MAGNET PULL DEBUG: Checking all tiles on board:', {
        totalTilesInState: STATE.tiles.length,
        srcTile: { value: src.value, special: srcSpecial, locked: src.locked },
        dstTile: { value: dst.value, special: dstSpecial, locked: dst.locked }
      });
      
      const magnetTileForPull = isSpecialDiceMagnetLikeTile(src, srcSpecial) ? src : dst;
      const allTiles = getPlayableMagnetPullCandidates({
        tiles: collectBoardGameplayTiles(),
        src,
        dst,
        magnetTile: magnetTileForPull,
      });
      allTiles.forEach((tile: any) => {
        devLog('✅ INCLUDE: tile for pull', {
          value: tile.value,
          special: tile.special,
          locked: tile.locked,
          isWildOrMagnet: isWildLikeTile(tile),
        });
      });
      
      // Calculate distances and find up to 4 nearest
      const withDistance = allTiles.map((tile: any) => {
        const dx = tile.x - mergeX;
        const dy = tile.y - mergeY;
        const dist = Math.hypot(dx, dy);
        return { tile, distance: dist };
      });
      
      withDistance.sort((a, b) => a.distance - b.distance);
      const nearestTiles = withDistance.slice(0, 4).map(item => item.tile); // Max 4 tiles
      
      devLog('🧲 Found', nearestTiles.length, 'nearest tiles to pull immediately (max 4)');
      
      // 🔥 CRITICAL FIX: Check if this is last merge (magnet + 1 tile = 2 tiles total, no tiles to pull)
      // If allTiles.length === 2 (only src and dst) and nearestTiles.length === 0, this is last merge
      const isLastMergeEarly =
        allTiles.length === 2 &&
        nearestTiles.length === 0 &&
        !boardHasPersistentLockedTiles(tiles);
      if (isLastMergeEarly && dst && !dst.destroyed) {
        (dst as any)._isLastMerge = true;
        cancelPendingWildContinuation('final_magnet_early_detection');
        devLog('🚨🚨🚨 LAST MERGE DETECTED EARLY (magnet + 1 tile, no tiles to pull) - Setting _isLastMerge flag NOW');
        devLog('🎯 This is the final merge - should trigger clean board, NOT pull tiles or spawn anything');
        
        // 🔥 BOARD RECOVERY: Persist intent so we can recover if app is force-quit during animation
        try {
          setPendingCleanBoard(boardNumber);
          devLog('✅ RECOVERY: pendingCleanBoard flag set (magnet early detection)');
        } catch (e) {
          devWarn('⚠️ Failed to set pending clean board flag (magnet early):', e);
        }
      }
      
        // 🔥 CRITICAL FIX: Store whether tiles will be pulled on dst tile BEFORE onComplete callback
        // This allows onComplete to correctly determine if merge 6 tile should remain or be removed
        if (dst && !dst.destroyed) {
          (dst as any)._willPullTiles = nearestTiles.length > 0;
          (dst as any)._noTilesPulled = nearestTiles.length === 0; // default assumption if none are valid later
          devLog('🧲 Stored _willPullTiles flag on dst:', nearestTiles.length > 0, '(nearestTiles.length:', nearestTiles.length, ')');
        }
      
      // 🔥 CRITICAL FIX v37: Log if no tiles can be pulled AND reset wildMagnetPullInProgress
      // Without this reset, subsequent pulls would be blocked!
      if (nearestTiles.length === 0) {
        devWarn('⚠️ WILD-MAGNET: No tiles can be pulled (all nearby tiles are locked or invalid)');
        
        // 🔥 CRITICAL: Reset wildMagnetPullInProgress if no tiles to pull
        // Otherwise, subsequent magnet merges will be blocked!
        setWildMagnetPullInProgress(false, 'no-tiles-to-pull');
        devLog('✅ wildMagnetPullInProgress reset to false (no tiles to pull)');
        
        // 🔥 POJEDNOSTAVLJENO: Flag više nije potreban - logika u onComplete callback-u provjerava isMagnetPullMergeFinal
        // Ako isMagnetPullMergeFinal === false, merge 6 tile će biti obrisan
      }
      
      // Update multiplier based on number of pulled tiles (max 4x)
      // 🎯 CRITICAL: Do NOT override mult if this is last move scenario (mult = 0 for clean board)
      if (nearestTiles.length > 0 && !isLastMoveScenario) {
        mult = Math.min(4, nearestTiles.length + 1); // +1 for the main merge, max 4x
        devLog('🧲 Updated multiplier to', mult, 'x (based on', nearestTiles.length, 'pulled tiles)');
      } else if (isLastMoveScenario) {
        devLog('🎯 KEEPING mult = 0 (last move scenario - clean board, NO spawn override!)');
      }

      // 🔥 CRITICAL: Cleanup function for pulled tiles.
      // Keep this in the outer magnet scope because both the normal pull timeline and
      // the timeout fallback need it. If it lives inside nearestTiles.length > 0,
      // the fallback can throw and leave merge-6/magnet residue stuck on board.
      const cleanupPulledTile = (tile: any, origX: number, origY: number, origRotation: number, origScaleX: number, origScaleY: number) => {
        if (!tile || tile.destroyed) return;

        devLog('🧹 Cleaning up pulled tile - resetting to original state');

        try {
          gsap.killTweensOf(tile);
          gsap.killTweensOf(tile.scale);
          if (tile.rotG) gsap.killTweensOf(tile.rotG);
        } catch {}

        tile.x = origX;
        tile.y = origY;

        if (tile.rotG) {
          tile.rotG.rotation = origRotation;
        } else if (tile.rotation !== undefined) {
          tile.rotation = origRotation;
        }

        if (tile.scale) {
          tile.scale.x = origScaleX;
          tile.scale.y = origScaleY;
        }

        delete tile._wildMagnetAffected;
        delete tile._wildMagnetOriginalX;
        delete tile._wildMagnetOriginalY;
        delete tile._mergeTriggered75;
        delete tile._skipIdleScaleReset;

        tile.locked = false;
        try { makeBoard.syncTileZIndex?.(tile, board); } catch {}
        tile.eventMode = 'static';
        tile.cursor = 'pointer';

        if (drag && typeof drag.bindToTile === 'function') {
          try {
            drag.bindToTile(tile);
            devLog('✅ Drag handler re-bound to cleaned tile');
          } catch (error) {
            devWarn('⚠️ Failed to rebind drag handler:', error);
          }
        }

        if (tile.gridX !== undefined && tile.gridY !== undefined && grid && grid[tile.gridY]) {
          grid[tile.gridY][tile.gridX] = tile;
          devLog('✅ Tile re-added to grid at (', tile.gridX, ',', tile.gridY, ')');
        }

        if (tile.scale) {
          tile.scale.set(origScaleX, origScaleY);
          devLog('✅ Tile scale reset to (', origScaleX, ',', origScaleY, ')');
        }

        devLog('✅ Tile cleanup complete - tile restored to original state');
      };
      
      if (nearestTiles.length > 0) {
        // Store original positions and mark tiles as magnet-affected IMMEDIATELY
        nearestTiles.forEach((tile: any) => {
          if (!tile || tile.destroyed) return;
          
          // Store original position
          if (!tile._wildMagnetOriginalX) {
            tile._wildMagnetOriginalX = tile.x;
            tile._wildMagnetOriginalY = tile.y;
          }
          
          // 🔥 CRITICAL: Mark tiles as magnet-affected IMMEDIATELY (before animation)
          // This allows them to merge only with other pulled tiles
          tile._wildMagnetAffected = true;
          tile._skipIdleScaleReset = true;
          
          // 🔥 CRITICAL: Disable drag and lock pulled tiles (prevent user from dragging or merging them)
          // This ensures tiles are protected from any external interaction while being pulled
          tile.eventMode = 'none';
          tile.cursor = 'default';
          tile.locked = true; // Lock tile to prevent any interactions

          // iOS stability: pulled wild/magnet tiles should not keep their idle FX running
          // while the magnet pull and SWOOP/merge-6 FX are also active.
          try { stopWildIdle?.(tile); } catch {}
          try { stopWildShimmer?.(tile); } catch {}
          try { stopWildStars?.(tile); } catch {}
          try { stopWildJuiceBubbles?.(tile); } catch {}
          try { stopMagnetIdleParticles?.(tile); } catch {}
          try { stopTntIdleParticles?.(tile); } catch {}
          try { stopTntIdleShake?.(tile); } catch {}
          
          devLog('🛡️ Protected pulled tile:', tile.value, 'special:', tile.special, 'eventMode:', tile.eventMode, 'locked:', tile.locked);
          
          // Clear from grid immediately (they're being pulled)
          if (tile.gridX !== undefined && tile.gridY !== undefined && grid && grid[tile.gridY]) {
            grid[tile.gridY][tile.gridX] = null;
          }
          
          // 🔥 CRITICAL: Ensure tiles remain in tiles array (don't remove them yet!)
          // They will be removed when merge completes
          if (!tiles.includes(tile)) {
            devWarn('⚠️ Pulled tile not in tiles array, adding it back');
            tiles.push(tile);
            // Clear end game cache when tile is added
            clearEndGameCache();
          }
          if (!STATE.tiles.includes(tile)) {
            devWarn('⚠️ Pulled tile not in STATE.tiles array, adding it back');
            STATE.tiles.push(tile);
          }
          
          devLog('🧲 Marked tile as magnet-affected:', tile.value, 'special:', tile.special, 'in tiles:', tiles.includes(tile), 'in STATE.tiles:', STATE.tiles.includes(tile));
        });
        
        // Track how many tiles have arrived
        let arrivedCount = 0;
        const totalTiles = nearestTiles.length;
        let allTilesArrived = false;
        let multiplierShown = false;
        mergeStarted = false; // 🔥 CRITICAL: Reset for this pull (declared at outer scope)
        
        // 🔥 CRITICAL: Store all timeline references for cleanup (MEMORY LEAK FIX)
        const activeTimelines: any[] = [];
        
        // 🔥 CRITICAL: Cleanup ALL timelines and pulled tiles (MEMORY LEAK FIX)
        // Use const binding to avoid block-function scoping quirks (keeps reference for timeouts)
        cleanupAllPullAnimations = () => {
          devLog('🧹 Cleaning up all wild-magnet pull animations - killing', activeTimelines.length, 'timelines');
          
          // Kill all active timelines
          activeTimelines.forEach((tl, idx) => {
            try {
              if (tl && !tl.killed) {
                tl.kill();
                devLog(`✅ Killed timeline ${idx + 1}/${activeTimelines.length}`);
              }
            } catch (error) {
              devWarn(`⚠️ Failed to kill timeline ${idx + 1}:`, error);
            }
          });
          
          // Clear array
          activeTimelines.length = 0;
          devLog('✅ All wild-magnet pull timelines cleaned up');
          
          // 🔥 CRITICAL: Reset wildMagnetPullInProgress when cleanup is called (FAST DRAG BUG FIX)
          // This ensures that a new pull can start even if the previous one was interrupted
          if (wildMagnetPullInProgress) {
            setWildMagnetPullInProgress(false, 'cleanup-all-pull-animations');
            devLog('✅ wildMagnetPullInProgress reset to false after cleanup');
          }
          try { (window as any).__ccActiveMagnetPullCleanup = null; } catch {}
        };
        try { (window as any).__ccActiveMagnetPullCleanup = cleanupAllPullAnimations; } catch {}
        
        // Function to merge pulled tiles when both conditions are met
        const tryMergePulledTiles = async () => {
          if (mergeStarted) {
            devLog('🧲 Pulled tiles merge already started - ignoring duplicate trigger');
            return;
          }
          if (allTilesArrived && multiplierShown) {
            devLog('🧲 Both conditions met: all tiles arrived AND multiplier shown, starting merge');
            
            // 🔥 CRITICAL: Mark merge as started (prevent cleanup after this point)
            mergeStarted = true;
            devLog('✅ mergeStarted flag set to true - cleanup will be skipped if animation is interrupted');
            
            try {
              // Import handleWildMagnetMergedPulledTiles asynchronously
              const { handleWildMagnetMergedPulledTiles } = await import('./app-merge');
              
              // Check if dst is still valid before merging
              // NOTE: For pulled tiles merge, dst might be removed already (merge 6 tile), so we check differently
              const validTiles = nearestTiles.filter((t: any) => t && !t.destroyed);
              
              devLog('🧲 Wild-magnet pulled tiles validation:', {
                totalPulled: nearestTiles.length,
                validTiles: validTiles.length,
                pulledTileTypes: nearestTiles.map((t: any) => ({
                  value: t?.value,
                  special: t?.special,
                  destroyed: t?.destroyed,
                  locked: t?.locked
                }))
              });
              
              // 🔥 CRITICAL FIX: Check _isLastMerge flag FIRST - if set, this is final merge-6, NO spawns!
              const isLastMergeFlagSet = (dst as any)?._isLastMerge === true;
              if (isLastMergeFlagSet && validTiles.length === 0) {
                devLog('🚨🚨🚨 SOURCE OF TRUTH: Final merge-6 detected (_isLastMerge flag set) - magnet + 1 tile = 2 tiles total');
                devLog('🎯 This is the final merge - should trigger clean board, NOT pull tiles or spawn anything');
                devLog('🧲 Skipping handleWildMagnetMergedPulledTiles - clean board will be triggered in mergePulledTilesIntoMerge6');
                
                // Still call handleWildMagnetMergedPulledTiles with empty array - it will check _isLastMerge and trigger clean board
                // This ensures clean board flow is triggered properly
                const { handleWildMagnetMergedPulledTiles } = await import('./app-merge');
                const helpersWithMerge = {
                  ...helpers,
                  magnetShardColors: magnetShardColorsAtMergeEntry,
                  merge: merge,
                  startLevel: startLevel,
                  makeBoard,
                  drawBoardBG,
                };
                await handleWildMagnetMergedPulledTiles(dst, [], helpersWithMerge);
                devLog('✅ Clean board triggered for final magnet merge-6');
                return; // Exit early - no further processing needed
              } else if (isLastMergeFlagSet && validTiles.length > 0) {
                devLog('🧲 _isLastMerge flag was set, but magnet has valid pulled tiles - clearing flag and continuing magnet respawn flow', {
                  validTiles: validTiles.length,
                  pulledTileTypes: validTiles.map((t: any) => ({ value: t?.value, special: t?.special }))
                });
                try { (dst as any)._isLastMerge = false; } catch {}
              }
              
              // 🔥 CRITICAL FIX: If validTiles.length === 0, mark that NO tiles were actually pulled
              // This overrides _willPullTiles flag and ensures merge 6 tile is removed
              if (validTiles.length === 0 && dst && !dst.destroyed) {
                (dst as any)._willPullTiles = false; // Override: no tiles were actually pulled
                (dst as any)._noTilesPulled = true; // Mark explicitly that no tiles were pulled
                devLog('🧲🧲🧲 CRITICAL: nearestTiles.length > 0 but validTiles.length === 0 - marking as NO pull');
              } else if (validTiles.length > 0 && dst && !dst.destroyed) {
                // At least one tile will merge: clear no-pull flag and mark intent
                (dst as any)._noTilesPulled = false;
                (dst as any)._willPullTiles = true;
              }
              
              if (validTiles.length >= 1) { // Changed: need at least 1 tile (can be less than 4)
                // 🔥 CRITICAL: Mark that pulled tiles merge is happening - skip normal spawn AND scoring
                // Set flag on dst BEFORE calling handleWildMagnetMergedPulledTiles
                // This ensures the flag is checked in onComplete callback
                if (dst && !dst.destroyed) {
                  (dst as any)._wildMagnetPulledTilesMerge = true;
                  (dst as any)._wildMagnetPulledTilesScoring = true; // Flag to skip scoring in main merge 6 flow
                }
                
                const activeTilesBeforePull = tiles.filter(t => {
                  if (!t || t.locked) return false;
                  const isWild = isWildLikeTile(t);
                  const hasValue = (t.value|0) > 0;
                  return isWild || hasValue;
                });
                const magnetPullProgressDecision = resolveMagnetPullProgressDecision({
                  activeTilesBeforePull,
                  mergeTile: dst,
                  pulledTileCount: validTiles.length,
                });
                const { shouldAddWildProgress, isLastMergeBeforePull } = magnetPullProgressDecision;
                let magnetPullProgressCommitted = false;

                // 🔥 CRITICAL: Add merge function and makeBoard to helpers so handleWildMagnetMergedPulledTiles can use them
                // 🔥 USER REQUEST: Add spawnLockedTilesWithPop + openLockedBounceParallel so wild magnet gets 6 locked like wild juice/star/TNT
                const helpersWithMerge = {
                  ...helpers,
                  magnetShardColors: magnetShardColorsAtMergeEntry,
                  merge: merge, // Add merge function from app-core.ts to helpers
                  startLevel: startLevel, // Add startLevel function to helpers for clean board flow
                  makeBoard, // For fillNullCellsWithLockedPlaceholders (avoids TDZ in app-merge)
                  spawnLockedTilesWithPop: (count: number, exclude?: Array<{ c: number; r: number }>) => spawnLockedTilesWithPop(count, exclude),
                  openLockedBounceParallel: FLOW.openLockedBounceParallel,
                  gsap,
                  drawBoardBG,
                  TILE,
                  fixHoverAnchor,
                  SPAWN,
                  onMagnetPullCommitted: () => {
                    if (magnetPullProgressCommitted) return;
                    magnetPullProgressCommitted = true;
                    if (shouldAddWildProgress) {
                      devLog(`🧲 Magnet pull accepted for ${validTiles.length} tiles - starting merge-6 wild progress immediately`);
                      addWildProgress(WILD_INC_BIG, { confirmedNonFinal: true });
                    } else if (isLastMergeBeforePull) {
                      devLog(`🚨🚨🚨 LAST MERGE ACCEPTED (magnet pull) - ${activeTilesBeforePull.length} tiles before pull, resetting wild progress`);
                      resetWildMeterState('last-merge-before-magnet-pull');
                    }
                  },
                  // Magnet/Honey board ownership ends when app-merge has
                  // committed every replacement, converted the consumed die,
                  // and synchronized placeholders. Its later endgame/visual
                  // settle waits must not freeze player input.
                  onMagnetBoardCommit: () => {
                    emitIOSSpecialTransactionTrace('magnet-board-commit-callback', {
                      token: specialTransactionToken,
                    });
                    setWildMagnetPullInProgress(false, 'board-commit');
                    markSpecialDiceTransactionBoardCommitted(
                      specialTransactionToken,
                      'magnet-board-commit',
                    );
                  },
                  getBoardMutationRevision: () => gameplayBoardMutationRevision,
                };
                
                // Use dst if still valid, otherwise use merge location from first tile (with gridX/gridY for mergePulledTilesIntoMerge6)
                const mergeLocation = dst && !dst.destroyed ? dst : {
                  x: validTiles[0].x, y: validTiles[0].y,
                  gridX: validTiles[0].gridX, gridY: validTiles[0].gridY
                };
                
                // 🔥 USER REQUEST: Add wild progress IMMEDIATELY when magnet pull starts (before merge animation)
                // This makes wild meter progress bar animate during pull animation, not after
                // 🔥 CRITICAL FIX: Check if this is last merge (only 2 tiles on board) BEFORE adding wild progress
                // This prevents wild meter from filling when magnet pull results in clean board
                // Do not mutate the meter before downstream commit validation.
                // A rejected pull must have no spawn/progress side effects to roll back.
                devLog('🧲 Calling handleWildMagnetMergedPulledTiles with', validTiles.length, 'valid tiles');
                const magnetMergeCommitted = await handleWildMagnetMergedPulledTiles(mergeLocation, validTiles, helpersWithMerge);
                if (!magnetMergeCommitted) {
                  devWarn('⚠️ Wild-magnet transaction aborted during commit validation - rolling back pulled tiles');
                  if (dst && !dst.destroyed) {
                    (dst as any)._willPullTiles = false;
                    (dst as any)._noTilesPulled = true;
                    delete (dst as any)._wildMagnetPulledTilesMerge;
                    delete (dst as any)._wildMagnetPulledTilesScoring;
                  }
                  nearestTiles.forEach((tile: any) => {
                    if (!tile || tile.destroyed) return;
                    cleanupPulledTile(
                      tile,
                      tile._wildMagnetOriginalX ?? tile.x,
                      tile._wildMagnetOriginalY ?? tile.y,
                      0,
                      1,
                      1,
                    );
                  });
                  cleanupAllPullAnimations();
                  mergeStarted = false;
                  setWildMagnetPullInProgress(false, 'commit-validation-abort');
                  releaseSpecialDiceTransaction(
                    specialTransactionToken,
                    'wild-magnet-commit-validation-abort',
                  );
                  scheduleCheckLevelEnd(0.18, 'wild-magnet-commit-validation-abort');
                  return;
                }
                devLog('✅ Pulled tiles merge committed - merge 6 created with 4x multiplier');
                // Progress was already applied by onMagnetPullCommitted at the
                // validated start of app-merge, before its long visual tail.
                
                // 🔥 CRITICAL: Cleanup all timelines after successful merge (MEMORY LEAK FIX)
                cleanupAllPullAnimations();
                
                // The immutable special owner stays active until app-merge has
                // finished every spawn/endgame verification against STATE.
                setWildMagnetPullInProgress(false, 'merge-completed-fallback');
                releaseSpecialDiceTransaction(specialTransactionToken, 'wild-magnet-handler-complete-fallback');
                devLog('✅ Wild-magnet pull animation guard reset (merge completed)');
                
                // 🔥 CRITICAL: DON'T clean up flags immediately - they need to stay until onComplete callback checks them
                // The flags will be cleaned up in the onComplete callback after spawn completes
                // (mergeLocation as any)._wildMagnetPulledTilesMerge = undefined;
                // (mergeLocation as any)._wildMagnetPulledTilesScoring = undefined;
              } else {
                devWarn('⚠️ Not enough valid pulled tiles to merge (need at least 1, got', validTiles.length, ')');
                // Cleanup all timelines (MEMORY LEAK FIX)
                cleanupAllPullAnimations();
                
                // 🔥 POJEDNOSTAVLJENO: Flag više nije potreban - logika u onComplete callback-u provjerava isMagnetPullMergeFinal
                // Ako isMagnetPullMergeFinal === false, merge 6 tile će biti obrisan
                
                // Cleanup all pulled tiles since merge failed
                nearestTiles.forEach((t: any) => {
                  if (t && !t.destroyed) {
                    const origX = t._wildMagnetOriginalX ?? t.x;
                    const origY = t._wildMagnetOriginalY ?? t.y;
                    const origRot = 0; // Default rotation
                    const origScaleX = 1.0; // Default scale
                    const origScaleY = 1.0; // Default scale
                    cleanupPulledTile(t, origX, origY, origRot, origScaleX, origScaleY);
                  }
                });
                // Reset guard after cleanup (redundant but safe - cleanupAllPullAnimations also resets)
                setWildMagnetPullInProgress(false, 'not-enough-valid-tiles');
                releaseSpecialDiceTransaction(
                  specialTransactionToken,
                  'wild-magnet-not-enough-valid-tiles',
                );
              }
            } catch (err) {
              devError('❌ Error merging pulled tiles:', err);
              devError('❌ Error stack:', err instanceof Error ? err.stack : 'No stack trace');
              emitIOSSpecialTransactionTrace('magnet-merge-error', {
                token: specialTransactionToken,
                message: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack?.split('\n').slice(0, 4).join('\n') : undefined,
              });
              // Cleanup all timelines (MEMORY LEAK FIX)
              cleanupAllPullAnimations();
              // Cleanup all pulled tiles on error
              nearestTiles.forEach((t: any) => {
                if (t && !t.destroyed) {
                  const origX = t._wildMagnetOriginalX ?? t.x;
                  const origY = t._wildMagnetOriginalY ?? t.y;
                  const origRot = 0;
                  const origScaleX = 1.0;
                  const origScaleY = 1.0;
                  cleanupPulledTile(t, origX, origY, origRot, origScaleX, origScaleY);
                }
              });
              // Reset guard after error
              setWildMagnetPullInProgress(false, 'merge-error');
              releaseSpecialDiceTransaction(
                specialTransactionToken,
                'wild-magnet-merge-error-rollback',
              );
            }
          }
        };
        
        // Pull tiles towards merge location with enhanced magnetic animation
        nearestTiles.forEach((tile: any, index: number) => {
          if (!tile || tile.destroyed) return;
          
          // Store original position and rotation
          const startX = tile.x;
          const startY = tile.y;
          const startRotation = tile.rotG?.rotation || tile.rotation || 0;
          
          // Calculate direction away from center (opposite direction)
          const dx = startX - mergeX;
          const dy = startY - mergeY;
          const dist = Math.hypot(dx, dy);
          const awayDirX = dist > 0 ? dx / dist : 0;
          const awayDirY = dist > 0 ? dy / dist : 0;
          
          // Distance to move away (similar to exit animations)
          // 🔥 INCREASED: 50% more distance (42% → 63%) for exaggerated "zalet" animation
          const awayDistance = TILE * 0.63; // 63% of tile size (50% increase from 42%)
          const awayX = startX + awayDirX * awayDistance;
          const awayY = startY + awayDirY * awayDistance;
          
          // Random rotation: 10-30 degrees in either direction (clockwise or counterclockwise)
          const rotationDegrees = 10 + Math.random() * 20; // 10-30 degrees (exaggerated)
          const rotationDirection = Math.random() < 0.5 ? 1 : -1; // Random direction
          const rotationRadians = (rotationDegrees * rotationDirection) * (Math.PI / 180);
          
          // Store original scale for cleanup
          const originalScaleX = tile.scale?.x ?? 1.0;
          const originalScaleY = tile.scale?.y ?? 1.0;
          
          // Create timeline for complex animation
          // 🔥 SPEED UP: All durations reduced by 50% for faster sequential pulling (4 tiles)
          // Sequential delay: each tile starts after the previous one has moved away - FASTER for 4 tiles
          // 🔥 CRITICAL: Last tile (index === totalTiles - 1) starts 0.150s earlier to show full animation path
          const isLastTile = index === totalTiles - 1;
          const sequentialDelay = isLastTile ? (index * 0.04 - 0.150) : (index * 0.04); // Last tile starts 0.150s earlier
          const initialDelay = 0.300; // 🔥 CRITICAL: 300ms delay before pulling starts (faster than before)
          const tl = animationManager.trackExternalTimeline(gsap.timeline({
            delay: Math.max(0, initialDelay + sequentialDelay), // Ensure delay is never negative
            onInterrupt: () => {
              // 🔥 CRITICAL: Don't cleanup if merge has already started
              if (mergeStarted) {
                devLog('⏳ Wild-magnet pull animation interrupted but merge already started - skipping cleanup for tile:', index);
                return;
              }
              // 🔥 CRITICAL: Cleanup on animation interrupt (e.g., user drags tile)
              devWarn('⚠️ Wild-magnet pull animation interrupted for tile:', index);
              cleanupPulledTile(tile, startX, startY, startRotation, originalScaleX, originalScaleY);
            },
            onComplete: () => {
              // 🔥 CRITICAL: Mark timeline as killed when complete (MEMORY LEAK FIX)
              (tl as any).killed = true;
              devLog(`✅ Timeline ${index + 1}/${totalTiles} completed and marked as killed`);
            },
            onUpdate: async () => {
              // 🔥 CRITICAL: Don't cleanup if merge has already started
              if (mergeStarted) {
                // Merge has started, let it complete - don't interrupt
                return;
              }
              
              // 🔥 CRITICAL: Safety check - tile must exist and not be destroyed
              if (!tile || tile.destroyed) {
                devWarn('⚠️ Tile destroyed during animation, cleaning up and killing timeline');
                cleanupPulledTile(tile, startX, startY, startRotation, originalScaleX, originalScaleY);
                try { tl.kill(); } catch {}
                return;
              }
              
              // 🔥 CRITICAL: Safety check - tile must have valid position properties
              if (tile.x == null || tile.y == null || typeof tile.x !== 'number' || typeof tile.y !== 'number' || !Number.isFinite(tile.x) || !Number.isFinite(tile.y)) {
                devWarn('⚠️ Tile position invalid during animation, cleaning up and killing timeline');
                cleanupPulledTile(tile, startX, startY, startRotation, originalScaleX, originalScaleY);
                try { tl.kill(); } catch {}
                return;
              }
              
              // 🔥 CRITICAL: Check if tile is 75% of the way to merge location
              // Calculate current distance to merge location
              const currentDx = tile.x - mergeX;
              const currentDy = tile.y - mergeY;
              const currentDist = Math.hypot(currentDx, currentDy);
              
              // Calculate initial distance
              const initialDx = startX - mergeX;
              const initialDy = startY - mergeY;
              const initialDist = Math.hypot(initialDx, initialDy);
              
              // Calculate progress (0 = start, 1 = end)
              const progress = initialDist > 0 ? 1 - (currentDist / initialDist) : 1;
              
              // 🔥 CRITICAL: Trigger merge when tiles are 75% of the way (0.75 progress)
              // Only trigger once per tile
              if (progress >= 0.75 && !tile._mergeTriggered75) {
                // 🔥 CRITICAL: Double-check tile is still valid before triggering merge
                if (!tile || tile.destroyed || tile.x == null || tile.y == null) {
                  devWarn('⚠️ Tile destroyed just before merge trigger, skipping');
                  try { tl.kill(); } catch {}
                  return;
                }
                
                tile._mergeTriggered75 = true;
                arrivedCount++;
                devLog(`🧲 Tile ${index + 1}/${totalTiles} reached 75% - triggering merge immediately`);
                
                // When all tiles reach 75%, trigger merge IMMEDIATELY
                if (arrivedCount === totalTiles) {
                  devLog('🧲 All tiles reached 75%, triggering merge 6 IMMEDIATELY (no final alignment)');
                  allTilesArrived = true;
                  multiplierShown = true; // Mark multiplier as shown to trigger merge immediately
                  
                  // Try to merge immediately (will merge right away)
                  // Shards animation will be triggered in mergePulledTilesIntoMerge6
                  // 🔥 CRITICAL FIX: Wrap in try-catch to prevent unhandled promise rejection
                  try {
                    await tryMergePulledTiles();
                  } catch (error) {
                    devError('❌ Error in tryMergePulledTiles:', error);
                  }
                }
              }
            }
          }));
          
          // Step 1: Move away from center + rotate (no scale yet) - FASTER for 4 tiles
          tl.to(tile, {
            x: awayX,
            y: awayY,
            duration: 0.05, // Faster: 0.05s (was 0.048s)
            ease: 'power2.out'
          }, 0);
          
          // Rotate (random 5-10 degrees)
          if (tile.rotG) {
            tl.to(tile.rotG, {
              rotation: startRotation + rotationRadians,
              duration: 0.05, // Faster: 0.05s
              ease: 'power2.out'
            }, 0);
          } else if (tile.rotation !== undefined) {
            tl.to(tile, {
              rotation: startRotation + rotationRadians,
              duration: 0.05, // Faster: 0.05s
              ease: 'power2.out'
            }, 0);
          }
          
          // Step 2: Move towards merge location - FASTER
          // 🔥 CRITICAL: Calculate 75% position - merge will trigger before reaching 100%
          const moveDuration = 0.35; // Faster: 0.35s (was 0.55s, decreased by 0.200s)
          const scaleHoldDuration = moveDuration * 0.20; // Hold original scale for first 20% of the path
          const scaleShrinkDuration = moveDuration - scaleHoldDuration; // Shrink during remaining 80%
          const moveStartTime = 0.015; // Start time for movement animation
          
          // Move towards merge location (full path)
          // Add label at the START of movement for precise timing
          tl.addLabel('moveStart', `>${moveStartTime}`);
          
          tl.to(tile, {
            x: mergeX,
            y: mergeY,
            duration: moveDuration,
            ease: 'power2.inOut'
          }, 'moveStart'); // Start at moveStart label
          
          // 🔥 NEW: Scale-down to 40% AFTER reaching 40% of the path
          // Start scale-down animation at 40% progress point
          // Use scale.x/y (PIXI Point object) like in fx.js, not scaleX/scaleY
          const scaleTarget = tile;
          if (scaleTarget?.scale) {
            try { gsap.killTweensOf(scaleTarget.scale); } catch {}
            
            const currentScaleX = scaleTarget.scale.x ?? 1.0;
            const currentScaleY = scaleTarget.scale.y ?? 1.0;
            const finalScaleX = currentScaleX * 0.40;
            const finalScaleY = currentScaleY * 0.40;
            
            tl.set(scaleTarget.scale, {
              x: currentScaleX,
              y: currentScaleY
            }, 'moveStart');
            
            tl.to(scaleTarget.scale, {
              x: currentScaleX,
              y: currentScaleY,
              duration: scaleHoldDuration,
              ease: 'linear'
            }, 'moveStart');
            
            tl.to(scaleTarget.scale, {
              x: finalScaleX,
              y: finalScaleY,
              duration: scaleShrinkDuration,
              ease: 'power2.inOut'
            }, `moveStart+=${scaleHoldDuration}`);
          }
          
          // Rotate back to 0 while moving
          if (tile.rotG) {
            tl.to(tile.rotG, {
              rotation: startRotation,
              duration: moveDuration,
              ease: 'power2.inOut'
            }, '<');
          } else if (tile.rotation !== undefined) {
            tl.to(tile, {
              rotation: startRotation,
              duration: moveDuration,
              ease: 'power2.inOut'
            }, '<');
          }
          
          // 🔥 CRITICAL: Store timeline reference for cleanup (MEMORY LEAK FIX)
          activeTimelines.push(tl);
          devLog(`✅ Timeline ${index + 1}/${totalTiles} created and stored for cleanup`);
        });
        
        // Store callback to trigger merge when multiplier appears
        // This will be called from the onComplete callback after showMultiplierTile
        (dst as any)._wildMagnetMergeCallback = async () => {
          devLog('🧲 Multiplier appeared, checking if can merge pulled tiles');
          multiplierShown = true;
          // Try to merge (will only merge if all tiles have arrived)
          // 🔥 CRITICAL FIX: Wrap in try-catch to prevent unhandled promise rejection
          try {
            await tryMergePulledTiles();
          } catch (error) {
            devError('❌ Error in tryMergePulledTiles (from multiplier callback):', error);
            emitIOSSpecialTransactionTrace('magnet-multiplier-callback-error', {
              token: specialTransactionToken,
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack?.split('\n').slice(0, 4).join('\n') : undefined,
            });
            // Cleanup all timelines (MEMORY LEAK FIX)
            cleanupAllPullAnimations();
            // Reset guard on error
            setWildMagnetPullInProgress(false, 'multiplier-callback-error');
            releaseSpecialDiceTransaction(
              specialTransactionToken,
              'wild-magnet-multiplier-callback-error-rollback',
            );
          }
        };
      }
        
        // 🔥 CRITICAL: Reset wildMagnetPullInProgress after animation completes or fails
        // Use a timeout to ensure it's reset even if merge fails or animation is interrupted
        trackAppTimeout(() => {
          if (wildMagnetPullInProgress) {
            devWarn('⚠️ Wild-magnet pull animation timeout - cleaning up after 2s');
            
            // 🔥 CRITICAL: Cleanup all animations and tiles on timeout (FAST DRAG BUG FIX)
            cleanupAllPullAnimations();
            
            // Cleanup all pulled tiles
            nearestTiles.forEach((t: any) => {
              if (t && !t.destroyed && !mergeStarted) {
                // Only cleanup if merge hasn't started
                const origX = t._wildMagnetOriginalX ?? t.x;
                const origY = t._wildMagnetOriginalY ?? t.y;
                const origRot = 0;
                const origScaleX = 1.0;
                const origScaleY = 1.0;
                cleanupPulledTile(t, origX, origY, origRot, origScaleX, origScaleY);
                devLog('✅ Timeout fallback: Cleaned tile with scale reset to 1.0');
              }
            });
            
            setWildMagnetPullInProgress(false, 'timeout-fallback-cleanup');
            releaseSpecialDiceTransaction(
              specialTransactionToken,
              'wild-magnet-timeout-fallback-rollback',
            );
            devLog('✅ Wild-magnet pull animation guard reset (timeout fallback with cleanup)');
            scheduleCheckLevelEnd(0.12, 'wild-magnet-timeout-fallback-cleanup');
          }
        }, 2000); // 2 second timeout (animation should complete in ~1s)
      }
    }

    // 🔥 CRITICAL: Check if this is a last merge BEFORE starting animation
    // If _isLastMerge is set, we need to skip spawn logic but ALLOW animations and clean board flow
    const isLastMergeScenario = (dst as any)?._isLastMerge === true;
    
    if (isLastMergeScenario) {
      devLog('🚨🚨🚨 LAST MERGE DETECTED (before animation) - Will play animations, skip spawn, and trigger clean board flow');
      devLog('🚨🚨🚨 Last merge details:', {
        srcValue: src.value,
        dstValue: dst.value,
        srcSpecial: srcSpecial,
        dstSpecial: dstSpecial,
        _isLastMerge: (dst as any)?._isLastMerge
      });
      // 🔥 CRITICAL FIX: DON'T set busyEnding here!
      // Setting busyEnding = true here prevents animations and clean board flow from running
      // We need to let animations play, then trigger clean board flow
      // busyEnding = true; // REMOVED - was preventing animations and clean board flow
    }

    if (wildActive && dstSpecial === 'wild') {
      const dstRef = dst;
      requestAnimationFrame(() => {
        try {
          if (dstRef && !dstRef.destroyed) stopWildIdle(dstRef);
        } catch {}
      });
    }

    // Begin loading as soon as the TNT merge is recognized, then make the
    // merge completion handoff wait for the actual Pixi textures. Previously
    // this was fire-and-forget inside the FX branch, so BOOM DOM text could
    // appear while the sprite cache still contained zero renderable frames.
    const tntVariantForMerge = getSpecialDiceVariantForTile(src) || getSpecialDiceVariantForTile(dst);
    const tntVisualOptionsForMerge = tntVariantForMerge?.archetype === 'wild-tnt'
      ? {
          frameSources: getSpecialDiceExplosionSpriteSources(tntVariantForMerge) || undefined,
          ...getSpecialDiceSplashOptions(tntVariantForMerge),
        }
      : undefined;
    const tntAnimationOptionsForMerge = {
      ...(tntVisualOptionsForMerge || {}),
      diceDebris: tntVariantForMerge == null,
    };
    const tntFramesReadyForMerge =
      srcSpecial === 'wild-tnt' || dstSpecial === 'wild-tnt'
        ? preloadTntFrames(tntAnimationOptionsForMerge)
            .then(() => true)
            .catch((error) => {
              devWarn('⚠️ TNT merge frame preload failed before the sprite finale:', error);
              return false;
            })
        : null;

    let merge6AbsorbSettled = false;
    trackTween(src, {
      x: dst.x, y: dst.y, duration: 0.08, ease: 'power2.out',
      onComplete: async () => {
        merge6AbsorbSettled = true;
        try {
        // 🔥 CRITICAL: If dst was destroyed (e.g. by parallel mergePulledTilesIntoMerge6/checkLevelEnd),
        // bail early to prevent "Cannot read properties of null (reading 'x')" - destroyed Pixi objects throw on property access
        if (!dst || dst.destroyed) {
          try { removeTile(src); } catch {}
          releaseSpecialDiceTransaction(specialTransactionToken, 'merge6-destination-destroyed');
          return;
        }
        if (tntFramesReadyForMerge) {
          const tntFramesReady = await tntFramesReadyForMerge;
          if (!tntFramesReady) {
            devWarn('⚠️ TNT merge continues without a complete sprite cache after preload failure');
          }
        }
        try {
          if ((dst as any)?._wildStarSystem) stopWildIdle(dst);
        } catch {}
        // 🔥 CRITICAL: srcSpecial i dstSpecial su već snimljeni PRIJE setValue i clearWildState!
        // Koristimo ih iz closure-a, ne snimamo ih ponovo (jer bi mogli biti već promijenjeni)
        
        // 🔥 CRITICAL FIX: Store magnet pull merge flag EARLY, before any code clears it
        // This ensures we can correctly identify magnet pull merges even if flags are cleared later
        // Check _willPullTiles first (set BEFORE onComplete) OR _wildMagnetPulledTilesMerge (set AFTER callback executes)
        // Do NOT check _wildMagnetMergeCallback - it exists even when no tiles are pulled!
        // 🔥 CRITICAL: If _noTilesPulled is set, override _willPullTiles (tiles became invalid before merging)
        const willPullTilesFlag = isWildMagnet &&
          ((dst as any)?._noTilesPulled === true ? false : (dst as any)?._willPullTiles === true);
        const isMagnetPullMergeStored = isWildMagnet &&
          (willPullTilesFlag || (dst as any)?._wildMagnetPulledTilesMerge === true);
        
        // 🔥 CRITICAL: Use EARLY saved star data (saved before any transformations)
        // This ensures data is available even if dst tile became merge 6 and lost _wildStarSystem
        const savedStarPositions = savedStarPositionsEarly.length > 0 ? savedStarPositionsEarly : [];
        const savedWildTileScreenPos = savedWildTileScreenPosEarly;
        
        // Get merge 6 position for reference (convert to screen coordinates)
        const merge6Pos = getMerge6ScreenPos(dst);
        
        // Get HUD star icon position
        let hudStarPos = null;
        if (shouldAnimateStarsToHUD) {
          try {
            if (typeof HUD.getStarHudPosition === 'function') {
              hudStarPos = HUD.getStarHudPosition();
              devLog('⭐ HUD star position retrieved:', hudStarPos);
            } else {
              devWarn('⚠️ HUD.getStarHudPosition is not a function');
            }
          } catch (err) {
            devError('❌ Error getting HUD star position:', err);
          }
        }

        removeTile(src);
        
        // 🔥 STARS ANIMATION: Trigger animation with EARLY saved star data (after tile is removed)
        // 🔥 CRITICAL: Always trigger animation if shouldAnimateStarsToHUD is true, even if bubbles animation is running
          const isWildJuiceMerge = srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice';
          if (shouldAnimateStarsToHUD && !starsToHudTriggered) {
            if (savedStarPositions.length > 0 && hudStarPos) {
            devLog('⭐ Starting stars animation to HUD with saved data:', { 
              starCount: savedStarPositions.length,
              merge6Pos,
              hudStarPos,
              hasBubblesRunning: isWildJuiceBubblesExplosionActive?.() || false
            });
            
            starsToHudTriggered = true;
            (async () => {
              try {
                if (!isWildJuiceMerge) showSparkleText(getMerge6DomOrigin(dst), getSpecialDiceSplashOptions(getSpecialDiceVariantForTile(src) || getSpecialDiceVariantForTile(dst)));
                devLog('⭐ Calling animateStarsToHudIcon with saved star data (INSTANT):', { 
                  board: !!board, 
                  stage: !!stage,
                  savedStarCount: savedStarPositions.length,
                  merge6Pos,
                  hudStarPos
                });
                await animateStarsToHudIcon(board, stage, savedStarPositions, savedWildTileScreenPos, merge6Pos, hudStarPos, app);
                devLog('✅ Stars animation to HUD completed (INSTANT)');
              } catch (error) {
                starsToHudTriggered = false;
                devError('❌ Failed to animate stars to HUD:', error);
              }
            })();
          } else {
            devWarn('⭐ Stars animation skipped - missing data:', { 
              shouldAnimate: shouldAnimateStarsToHUD,
              savedStarCount: savedStarPositions?.length || 0,
              hasHudPos: !!hudStarPos,
              hasEarlySavedData: savedStarPositionsEarly.length > 0,
              hasBubblesRunning: isWildJuiceBubblesExplosionActive?.() || false
            });
          }
        }
        
        // 🔥 CRITICAL: Check if this was marked as last merge BEFORE animation started
        // 🔥 ENHANCED: Double-check _isLastMerge flag and verify dst still exists
        const isLastMergeInOnComplete = (dst as any)?._isLastMerge === true;
        const dstStillExists = dst && !dst.destroyed && STATE.tiles.includes(dst);
        
        // 🔥 USER REQUEST: Check if this was last 2 tiles AFTER removing src
        // This is the CORRECT time to check - after src is removed, if only merge-6 remains, it was last 2 tiles
        const activeTilesAfterSrcRemoval = getReactiveActiveTiles(collectBoardGameplayTiles());
        const onlyMerge6Remains = activeTilesAfterSrcRemoval.length === 1 && 
                                  activeTilesAfterSrcRemoval[0] === dst && 
                                  dst.value === 6;
        // 🔥 CRITICAL: Use srcSpecial and dstSpecial from closure (snimljeni PRIJE merge-6 bloka)
        // Note: These are from outer scope (line 3943-3944), not from merge 6 block
        const srcWasWild = isWildLikeSpecial(srcSpecial);
        const dstWasRegular = !dstSpecial && (dst.value|0) > 0;
        const wasWildRegularLastTwo = srcWasWild && dstWasRegular && onlyMerge6Remains;
        const wasRegularRegularLastTwo = !srcWasWild && !dstSpecial && 
                                         (src.value|0) > 0 && (dst.value|0) > 0 &&
                                         onlyMerge6Remains;
        
        // 🔥 CRITICAL FIX: Also check if src was magnet and dst was regular (magnet + 1 tile = last merge)
        // Note: Use srcSpecial/dstSpecial from outer scope (line 3943-3944), not srcSpecialMerge6/dstSpecialMerge6
        const wasMagnetRegularLastTwo = (isSpecialDiceMagnetLikeTile(src, srcSpecial) || isSpecialDiceMagnetLikeTile(dst, dstSpecial)) && 
                                        onlyMerge6Remains;
        
        // Final merge ownership belongs to the central resolver. Legacy shape checks
        // like "only merge 6 remains" can be false positives for stacked regular dice.
        if (isFinalMergeByResolver && !isLastMergeInOnComplete) {
          (dst as any)._isLastMerge = true;
          devLog('🚨🚨🚨 LAST MERGE DETECTED (AFTER src removal) - Only merge-6 remains:', {
            isFinalRegularMerge6Snapshot,
            isFinalMergeByResolver,
            wasWildRegularLastTwo,
            wasRegularRegularLastTwo,
            wasMagnetRegularLastTwo,
            srcSpecial: srcSpecial,
            dstSpecial: dstSpecial,
            srcValue: src.value,
            dstValue: dst.value,
            activeTilesAfterSrcRemoval: activeTilesAfterSrcRemoval.length
          });
          
          // 🔥 BOARD RECOVERY: Persist intent so we can recover if app is force-quit during animation
          try {
            setPendingCleanBoard(boardNumber);
            devLog('✅ RECOVERY: pendingCleanBoard flag set (after src removal detection)');
          } catch (e) {
            devWarn('⚠️ Failed to set pending clean board flag (after src removal):', e);
          }
        }
        
        logger.debug('🔍 LAST MERGE CHECK in onComplete', 'app-core', {
          isLastMergeInOnComplete,
          wasWildRegularLastTwo,
          wasRegularRegularLastTwo,
          onlyMerge6Remains,
          activeTilesAfterSrcRemoval: activeTilesAfterSrcRemoval.length,
          dstStillExists,
          dstValue: dst?.value,
          dstSpecial: dst?.special,
          busyEnding,
          _isLastMerge: (dst as any)?._isLastMerge
        });
        
        if (isLastMergeInOnComplete) {
          // 🔥 BUG FIX: Exclude tiles that are being pulled by magnet (have _wildMagnetAffected flag)
          // These tiles are in the process of being removed but haven't been destroyed yet
          // Without this exclusion, they would incorrectly trigger "false positive" detection
          const otherActive = getReactiveActiveTiles(collectBoardGameplayTiles()).filter((t) => t !== dst && !(t as any)?._wildMagnetAffected);
          if (otherActive.length === 0 && dstStillExists) {
            devLog('🚨🚨🚨 LAST MERGE DETECTED (_isLastMerge flag) - Only 2 tiles merged to merge 6');
            devLog('💥 LAST MERGE: Letting normal merge 6 flow continue (animations, dst removal, spawn check)');
            devLog('💥 LAST MERGE: Spawn will be skipped by safeguard check (line 3070), then clean board flow will trigger');
            try {
              (dst as any)._ccSuppressStackVisual = true;
              dst.stackDepth = 1;
              normalizeFinalMerge6ResidueVisuals('onComplete:last-merge-flag-before-fx');
              hideFinalMergeResultTileVisual(dst, 'onComplete:last-merge-flag-before-fx');
            } catch {}
            
            // 🔥 CRITICAL: DON'T set busyEnding here - let normal merge 6 flow continue
            // The safeguard check (line 3070) will skip spawn and trigger clean board flow
            // busyEnding = true; // REMOVED - was preventing normal merge 6 flow
            
            // 🔥 CRITICAL: DON'T reset wild meter here - let safeguard check handle it
            // 🔥 CRITICAL: DON'T trigger clean board flow here - let safeguard check handle it
            // Just let the normal merge 6 flow continue (dst removal, spawn check, clean board flow)
            devLog('✅ LAST MERGE: Continuing with normal merge 6 flow (dst removal, spawn check, clean board flow)');
            // No return - continue with normal merge 6 flow
          } else if (otherActive.length > 0) {
            devWarn('⚠️ LAST MERGE: False positive detected - other active tiles remain. Continuing normal flow.', {
              otherActive: otherActive.map(t => ({ value: t.value, special: t.special, locked: t.locked }))
            });
            (dst as any)._isLastMerge = false;
            busyEnding = false;
          } else if (!dstStillExists) {
            devWarn('⚠️ LAST MERGE: _isLastMerge flag set but dst tile no longer exists. Verifying clean board...');
            const boardIsClean = otherActive.length === 0;
            if (boardIsClean) {
              // 🔥 FIX: Use triggerCleanBoardFlow (same entry as other clean board paths) so modal shows consistently
              await triggerCleanBoardFlow('clean_board_from_last_merge_edge_case', {
                finalMergeSnapshot,
              });
              return;
            }
            (dst as any)._isLastMerge = false;
            busyEnding = false;
          }
        }
        
        // 🔥 CRITICAL: Skip endgame check if this is a wild-magnet merge that will pull tiles
        // OR if this is a regular wild merge that is NOT the last merge
        // Wild-magnet merges that pull tiles should NOT trigger endgame checks until AFTER the pulled tiles merge
        // Regular wild merges mid-game should NOT trigger endgame checks unless they're truly the last merge
        // Note: Use srcSpecial/dstSpecial from outer scope (line 3943-3944), not srcSpecialMerge6/dstSpecialMerge6
        const isWildMagnetMergeWithPull = (isSpecialDiceMagnetLikeTile(src, srcSpecial) || isSpecialDiceMagnetLikeTile(dst, dstSpecial)) && 
                                          (dst as any)?._wildMagnetMergeCallback;
        const isRegularWildMerge = (isWildLikeSpecial(srcSpecial) || isWildLikeSpecial(dstSpecial)) && 
                                   !(isSpecialDiceMagnetLikeTile(src, srcSpecial) || isSpecialDiceMagnetLikeTile(dst, dstSpecial));
        const isNotLastMerge = !(dst as any)?._isLastMerge;
        
        if (isWildMagnetMergeWithPull) {
          devLog('🧲 Wild-magnet merge with pull detected - skipping endgame check until pulled tiles merge completes');
        } else if (isRegularWildMerge && isNotLastMerge) {
          devLog('⭐ Regular wild merge mid-game detected (NOT last merge) - skipping endgame check to prevent false fail screen');
        } else {
          // 🔥 CRITICAL: Use centralized end game checker
          // Check if this was the last merge AFTER removing src tile
          const lastMergeContext: EndGameContext = {
            tiles,
            moves,
            makeBoard,
            srcTile: src,
            dstTile: dst,
            justRemovedSrc: true
          };
          
          // Force refresh because src tile was just removed
          const lastMergeResult = checkEndGame(lastMergeContext, true);
        
          if (lastMergeResult.type === 'clean' && lastMergeResult.reason === 'last_merge') {
            devLog('🚨🚨🚨 LAST MERGE DETECTED (centralized checker) - Only merge 6 remains after removing src');
            devLog('💥 LAST MERGE: This check should not trigger if _isLastMerge flag was set properly');
            devLog('💥 LAST MERGE: Continuing with normal merge 6 flow (dst removal, spawn check, clean board flow)');
            
            // 🔥 CRITICAL: Set _isLastMerge flag if not already set
            if (!(dst as any)?._isLastMerge) {
              (dst as any)._isLastMerge = true;
              devLog('✅ _isLastMerge flag set to TRUE (was missing)');
              
              // 🔥 BOARD RECOVERY: Persist intent so we can recover if app is force-quit during animation
              try {
                setPendingCleanBoard(boardNumber);
                devLog('✅ RECOVERY: pendingCleanBoard flag set (centralized checker)');
              } catch (e) {
                devWarn('⚠️ Failed to set pending clean board flag (centralized):', e);
              }
            }
            try {
              (dst as any)._ccSuppressStackVisual = true;
              dst.stackDepth = 1;
              normalizeFinalMerge6ResidueVisuals('onComplete:central-check-before-fx');
              hideFinalMergeResultTileVisual(dst, 'onComplete:central-check-before-fx');
            } catch {}
            
            // Don't set busyEnding or trigger clean board flow here - let normal flow handle it
            // No return - continue with normal merge 6 flow
          }
        }
        
        // 🔥 CRITICAL FIX: DON'T skip animations for last merge!
        // User needs to see merge 6 animations (smoke, shards, explosion) before clean board
        // We'll only skip SPAWN logic, not animations
        if (isLastMergeScenario) {
          devLog('🚨🚨🚨 LAST MERGE: Will play animations but skip spawn - clean board flow will trigger after animations');
        }
        
        // If busyEnding was set by another process, exit early
        if (busyEnding) {
          devLog('⏳ Last merge check skipped - busyEnding is true');
          try { if (dst && !dst.destroyed) removeTile(dst); } catch {}
          releaseSpecialDiceTransaction(specialTransactionToken, 'merge6-terminal-owner-active');
          scheduleOwnedMergeRecoveryCheck(0.12, 'merge6-terminal-owner-active');
          return;
        }

        // Combo++ + bump (merge 6 hits maximum balloon)
        hudSetCombo(combo + 1);
        try { HUD.bumpCombo?.({ kind: 'merge6', combo }); } catch {}

        // Wild merge-6 gets a longer combo window (4s); next merges return to default 2s.
        const isWildMerge6ForComboWindow =
          isWildLikeSpecial(srcSpecial) ||
          isWildLikeSpecial(dstSpecial);
        scheduleComboDecay(isWildMerge6ForComboWindow ? 4000 : undefined);

        // 🔥 CRITICAL: Snimiti dst poziciju PRIJE nego što se pozovu shardovi!
        // Nakon removeTile(dst), dst može biti destroyed ili undefined
        // 🔥 CRITICAL FIX: Add null/destroyed check - accessing dst.x on destroyed Pixi object throws
        if (!dst || dst.destroyed) {
          devWarn('⚠️ dst is null or destroyed in merge-6 animation setup - cannot proceed with shards animation');
          releaseSpecialDiceTransaction(specialTransactionToken, 'merge6-animation-destination-destroyed');
          return;
        }
        let dstGridX = 0, dstGridY = 0, dstZIndex = 0;
        try {
          dstGridX = dst.gridX ?? 0;
          dstGridY = dst.gridY ?? 0;
          dstZIndex = dst.zIndex ?? 0;
        } catch (_) {
          devWarn('⚠️ dst properties inaccessible (destroyed) - skipping merge-6 animation setup');
          releaseSpecialDiceTransaction(specialTransactionToken, 'merge6-animation-destination-inaccessible');
          return;
        }
        
        // FX
        const wasWild = wildActive;
        // 🔥 CRITICAL: Determine if this is wild-magnet or wild-only merge
        // 🔥 CRITICAL FIX: Use srcSpecialMerge6/dstSpecialMerge6 (saved values) instead of srcSpecial/dstSpecial
        const merge6FxInput = {
          src,
          dst,
          srcSpecial: srcSpecialMerge6,
          dstSpecial: dstSpecialMerge6,
        };
        // Gameplay and presentation are deliberately independent. Beach Ball
        // keeps its authored Juice-style drop finale, but owns TNT board
        // mechanics (blast, four reserved bonus targets, and input commit).
        const merge6GameplayFx = getSpecialDiceGameplayFxForMerge(merge6FxInput);
        const merge6FinaleFx = getSpecialDiceFinaleFxForMerge(merge6FxInput);
        const isMainWildMagnetMerge = merge6GameplayFx === 'magnet';
        const isMainWildTntMerge = merge6GameplayFx === 'tnt';
        const isMainWildStarMerge = merge6GameplayFx === 'star';
        const isMainWildJuiceMerge = merge6FinaleFx === 'juice';
        const isMainWildTntVisualMerge = merge6FinaleFx === 'tnt';
        const isMainWildOnlyMerge = !!merge6FinaleFx && !isMainWildMagnetMerge;
        type WildMerge6TileBlastHandle = {
          tile: Tile;
          origX: number;
          origY: number;
          returnDuration: number;
          returnElastic: number;
        };
        const playShortWildMerge6TileBlast = (
          label: string,
          options: { holdForExternalReturn?: boolean } = {},
        ): WildMerge6TileBlastHandle[] => {
          const heldHandles: WildMerge6TileBlastHandle[] = [];
          try {
            const blastCenter = centerInBoard(board, dst, TILE);
            const blastStrength = TILE * 0.52;
            const blastDuration = 0.40;
            const returnDelay = 0.10;
            const returnDuration = 0.64;
            const allTiles = Array.from(new Set<Tile>([
              ...(Array.isArray(STATE?.tiles) ? STATE.tiles : []),
              ...(Array.isArray(tiles) ? tiles : [])
            ]));
            let blastCount = 0;
            const blastTargets: Array<{
              tile: Tile;
              origX: number;
              origY: number;
              dirX: number;
              dirY: number;
              distance: number;
            }> = [];
            let maxDistance = 1;

            allTiles.forEach((tile: Tile) => {
              if (!tile || tile.destroyed || tile === dst || tile === src) return;
              if ((tile as any)._ccWildSpawnDropping === true) return;
              if (isTileBoardBlastDisplacing(tile)) return;
              if (tile.locked) return;
              const tileValue = (tile.value | 0);
              const isWildLike = isWildLikeSpecial(tile.special);
              if (!isWildLike && tileValue <= 0) return;

              const origX = tile.x ?? 0;
              const origY = tile.y ?? 0;
              const tileCenter = centerInBoard(board, tile, TILE);
              const dx = tileCenter.x - blastCenter.x;
              const dy = tileCenter.y - blastCenter.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              let dirX = 0;
              let dirY = 0;
              if (distance < 1) {
                const angle = Math.random() * Math.PI * 2;
                dirX = Math.cos(angle);
                dirY = Math.sin(angle);
              } else {
                const jitterAngle = (Math.random() - 0.5) * 0.58;
                const baseAngle = Math.atan2(dy, dx) + jitterAngle;
                dirX = Math.cos(baseAngle);
                dirY = Math.sin(baseAngle);
              }

              maxDistance = Math.max(maxDistance, distance);
              blastTargets.push({ tile, origX, origY, dirX, dirY, distance });
            });

            blastTargets.forEach(({ tile, origX, origY, dirX, dirY, distance }) => {
              const waveProgress = Math.min(1, distance / maxDistance);
              const waveDelay = (waveProgress * 0.26) + (Math.random() * 0.035);
              const blastDist = blastStrength * (0.86 + Math.random() * 0.52);
              const blastX = origX + dirX * blastDist;
              const blastY = origY + dirY * blastDist;
              const tileBlastDuration = blastDuration * (0.88 + Math.random() * 0.22);
              const tileReturnDuration = returnDuration * (0.9 + Math.random() * 0.22);
              let zIndexRestored = false;
              const restoreZIndex = () => {
                if (zIndexRestored || tile.destroyed) return;
                zIndexRestored = true;
                try { makeBoard.syncTileZIndex(tile, board); } catch {}
              };
              const finishBlastTile = () => {
                clearTileBoardBlastDisplacement(tile, origX, origY);
                restoreZIndex();
              };
              markTileBoardBlastDisplacing(tile, origX, origY);
              try { gsap.killTweensOf(tile); } catch {}
              gsap.set(tile, { x: origX, y: origY, zIndex: 320 });
              try { board?.sortChildren?.(); } catch {}
              const timeline = trackTimeline({
                onComplete: () => {
                  if (!options.holdForExternalReturn) finishBlastTile();
                },
                onInterrupt: finishBlastTile
              })
                .to(tile, {
                  x: blastX,
                  y: blastY,
                  duration: tileBlastDuration,
                  delay: waveDelay,
                  ease: 'back.out(2.9)',
                  overwrite: 'auto'
                });
              if (options.holdForExternalReturn) {
                heldHandles.push({
                  tile,
                  origX,
                  origY,
                  returnDuration: tileReturnDuration,
                  returnElastic: 0.30 + Math.random() * 0.12,
                });
              } else {
                timeline.to(tile, {
                  x: origX,
                  y: origY,
                  duration: tileReturnDuration,
                  delay: returnDelay,
                  ease: `elastic.out(1, ${0.30 + Math.random() * 0.12})`,
                  overwrite: 'auto'
                });
              }
              blastCount += 1;
            });

            devLog(`✨ ${label} merge 6 - Cubero-profile tile blast started`, {
              blastCount,
              holdForExternalReturn: options.holdForExternalReturn === true,
              waveDelayMaxSeconds: 0.295,
              blastStrengthTiles: 0.52,
            });
          } catch (e) {
            devWarn(`⚠️ ${label} tile blast animation failed:`, e);
          }
          return heldHandles;
        };
        
        if (wasWild) {
          // Standard screen shake for all wild merges; TNT merge = 5× jači shake (Explosion Pack)
          let baseShake = Math.min(28, 12 + Math.max(1, mult) * 4);
          if (isMainWildTntMerge) {
            baseShake = Math.min(100, Math.round(baseShake * 5));
            baseShake = Math.round(baseShake * 0.4); // -60% strength
          }
          // TNT: pokreni animaciju prije shake-a, anchor na kockici merge 6, overlay prati board shake
          const alsoShakeTargets: HTMLElement[] = [];
          let triggerTntGameplayAtVisualCommit: ((reason: string) => void) | null = null;
          let markTntVisualSequenceComplete: ((reason: string) => void) | null = null;
          if (isMainWildTntMerge) {
            try {
              const blastReturnHandles: Array<{ tile: Tile; wobble: gsap.core.Tween | null; origX: number; origY: number; returnDuration: number; returnElastic: number }> = [];
              const startTntBoardBlast = () => {
                // Pokreni blast+shake tek nakon što TNT sprite sekvenca završi.
                try {
                  // LaserGun owns target-local beam impacts and rendered debris;
                  // do not displace the complete board before those exact TNT
                  // targets are selected and hit.
                  if (tntVariantForMerge?.id === 'laser-gun') return;
                  if (tntVariantForMerge?.id === 'beach-ball') {
                    const beachBallHandles = playShortWildMerge6TileBlast('Beach Ball', {
                      holdForExternalReturn: true,
                    });
                    beachBallHandles.forEach((handle) => {
                      blastReturnHandles.push({ ...handle, wobble: null });
                    });
                    return;
                  }
                  const primaryTiles = Array.isArray(STATE?.tiles) ? STATE.tiles : [];
                  const fallbackTiles = Array.isArray(tiles) ? tiles : [];
                  const allBlastTiles = Array.from(new Set<Tile>([...primaryTiles, ...fallbackTiles]));
                  const blastStrength = TILE * 0.4;
                  const blastCenter = centerInBoard(board, dst, TILE);

                  allBlastTiles.forEach((tile: Tile) => {
                    if (!tile || tile.destroyed) return;
                    if ((tile as any)._ccWildSpawnDropping === true) return;
                    if (isTileBoardBlastDisplacing(tile)) return;
                    // User requested: move only active cubes (no locked/ghost placeholders).
                    if (tile.locked) return;
                    const tileValue = (tile.value | 0);
                    const isWildLike = isWildLikeSpecial(tile.special);
                    if (!isWildLike && tileValue <= 0) return;
                    const origX = tile.x ?? 0;
                    const origY = tile.y ?? 0;
                    const tileCenter = centerInBoard(board, tile, TILE);
                    const dx = tileCenter.x - blastCenter.x;
                    const dy = tileCenter.y - blastCenter.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    // Ensure every tile moves: if tile is exactly on blast center,
                    // assign a random outward direction instead of skipping.
                    let dirX = 0;
                    let dirY = 0;
                    if (distance < 1) {
                      const angle = Math.random() * Math.PI * 2;
                      dirX = Math.cos(angle);
                      dirY = Math.sin(angle);
                    } else {
                      dirX = dx / distance;
                      dirY = dy / distance;
                    }
                    const blastDist = blastStrength * (1 + Math.random() * 0.3);
                    const blastX = origX + dirX * blastDist;
                    const blastY = origY + dirY * blastDist;

                    markTileBoardBlastDisplacing(tile, origX, origY);
                    try { gsap.killTweensOf(tile); } catch {}
                    gsap.set(tile, { x: origX, y: origY });

	                    const returnDuration = 0.58 + Math.random() * 0.12;
	                    const returnElastic = 0.14 + Math.random() * 0.08;
	                    const blastDuration = 0.62 + Math.random() * 0.14;
                    const wobbleAmp = TILE * (0.03 + Math.random() * 0.05);
                    const wobbleDur = 0.7 + Math.random() * 0.5;
                    const wobbleElastic = 0.35 + Math.random() * 0.2;

                    trackTween(tile, {
                      x: blastX,
                      y: blastY,
                      duration: blastDuration,
                      ease: `elastic.out(1, ${returnElastic})`,
                      overwrite: 'auto'
                    });

                    const wobble = trackTween(tile, {
                      x: blastX + (Math.random() - 0.5) * wobbleAmp,
                      y: blastY + (Math.random() - 0.5) * wobbleAmp,
                      duration: wobbleDur,
                      delay: blastDuration,
                      repeat: -1,
                      yoyo: true,
                      ease: `elastic.inOut(1, ${wobbleElastic})`
                    });
                    try { tntBlastWobbleTweens.push(wobble); } catch {}

                    blastReturnHandles.push({
                      tile,
                      wobble,
                      origX,
                      origY,
                      returnDuration,
                      returnElastic
                    });
                  });
                } catch (e) {
                  devWarn('⚠️ Tile blast animation failed:', e);
                }

              };
              const returnTntBlastTiles = (onDone?: () => void) => {
                try {
                  let pending = 0;
                  let maxReturnDuration = 0;
                  let done = false;
                  const restoreAllTntBlastTiles = () => {
                    blastReturnHandles.forEach((h) => {
                      try {
                        if (!h.tile || h.tile.destroyed || !STATE?.tiles?.includes?.(h.tile)) return;
                        clearTileBoardBlastDisplacement(h.tile, h.origX, h.origY);
                      } catch {}
                    });
                  };
                  const finish = () => {
                    if (done) return;
                    done = true;
                    restoreAllTntBlastTiles();
                    try { onDone?.(); } catch {}
                  };

                  blastReturnHandles.forEach((h) => {
                    if (!h.tile || h.tile.destroyed || !STATE?.tiles?.includes?.(h.tile)) return;
                    pending += 1;
                    maxReturnDuration = Math.max(maxReturnDuration, h.returnDuration);
                    try { h.wobble?.kill(); } catch {}
                    trackTween(h.tile, {
                      x: h.origX,
                      y: h.origY,
                      duration: h.returnDuration,
                      ease: `elastic.out(0.6, ${h.returnElastic})`,
                      overwrite: 'auto',
                      onComplete: () => {
                        try { gsap.set(h.tile, { x: h.origX, y: h.origY }); } catch {}
                        try { clearTileBoardBlastDisplacement(h.tile, h.origX, h.origY); } catch {}
                        pending -= 1;
                        if (pending <= 0) finish();
                      }
                    });
                  });
                  try { tntBlastWobbleTweens = []; } catch {}
                  if (pending <= 0) {
                    finish();
                    return;
                  }
                  const safetyCall = trackDelayedCall(Math.max(0.35, maxReturnDuration + 0.18), () => {
                    devWarn('⚠️ TNT blast return safety: forcing all tiles back to original positions');
                    finish();
                  });
                  if (safetyCall) tntBoomDelayedCalls.push(safetyCall);
                } catch (e) {
                  devWarn('⚠️ TNT blast return failed:', e);
                  try { onDone?.(); } catch {}
                }
	              };
	              // Start tile separation immediately on TNT merge-6.
	              startTntBoardBlast();
	              let tntBonusTriggered = false;
	              let tntBonusGameplayComplete = false;
	              let tntVisibleSequenceComplete = false;
	              let tntBoardCommitted = false;
	              let tntTransactionReleased = false;
	              const commitTntBoardForOrdinaryStacks = (reason: string) => {
	                if (tntBoardCommitted) return;
	                tntBoardCommitted = true;
	                // The blast displacement is finished and every remaining TNT
	                // mutation is attached to an exact reserved tile. Ordinary
	                // sub-six stacks elsewhere are now safe; specials stay gated.
	                releaseTntGameplayInputGate();
	                markSpecialDiceTransactionBoardCommitted(specialTransactionToken, `tnt-board-commit:${reason}`);
	                devLog('🌸 TNT/Flower board committed; ordinary stacks released:', reason);
	              };
	              const releaseTntTransactionWhenSettled = (reason: string) => {
	                if (tntTransactionReleased) return;
	                if (!tntBonusGameplayComplete || !tntVisibleSequenceComplete) return;
	                tntTransactionReleased = true;
	                commitTntBoardForOrdinaryStacks(`settled-fallback:${reason}`);
	                releaseSpecialDiceTransaction(specialTransactionToken, `tnt-gameplay-settled:${reason}`);
	                devLog('🌸 TNT/Flower transaction released after gameplay + visual settlement:', reason);
	              };
	              const triggerTntBonusBreak = (reason: string) => {
	                if (tntBonusTriggered) return;
	                tntBonusTriggered = true;
	                // Guard endgame check until TNT bonus break/spawn phase has enough time to complete.
	                // Triggering at the ninth sprite removes the long dead wait after the TNT visual.
	                tntBonusGuardUntil = Math.max(tntBonusGuardUntil, Date.now() + 3200);
	                devLog('🔥 TNT bonus break trigger:', reason);
	                returnTntBlastTiles(() => {
	                  trackAppTimeout(() => {
	                    const finalMergeOwnsTntResolution =
	                      capturedWasFinalMerge ||
	                      isFinalMergeByResolver ||
	                      (dst as any)?._isLastMerge === true ||
	                      (src as any)?._isLastMerge === true;
	                    if (finalMergeOwnsTntResolution) {
	                      devLog('🔥 TNT bonus break skipped: immutable final-merge snapshot owns resolution');
	                      commitTntBoardForOrdinaryStacks('final-merge-no-bonus');
	                      tntBonusGameplayComplete = true;
	                      releaseTntTransactionWhenSettled('final-merge-no-bonus');
	                      return;
	                    }
	                    runTntBoomBonusBreak2Tiles({
	                      board,
	                      dst,
	                      addWildProgress,
	                      removeTile,
	                      openAtCell,
	                      regularMerge6ShardsTemplated,
	                      smokeBubblesAtTile,
	                      TILE,
	                      devLog,
	                      devWarn,
	                      bonusParticleSources: tntVariantForMerge?.id === 'flower'
	                        ? tntVisualOptionsForMerge?.burstSources
	                        : undefined,
	                      bonusParticleScale: tntVariantForMerge?.id === 'flower' ? 1.4 : 1,
	                      impactProfile: tntVariantForMerge?.id === 'beach-ball'
	                        ? 'beach-ball'
	                        : tntVariantForMerge?.id === 'laser-gun'
	                          ? 'laser-gun'
	                          : 'standard',
	                      skipFx: false,
	                      onTargetsSelected: tntVariantForMerge?.id === 'laser-gun'
	                        ? (targets) => setActiveLaserGunFinaleTargets(targets)
	                        : undefined,
	                      onBoardCommitted: () => {
	                        commitTntBoardForOrdinaryStacks('bonus-targets-reserved');
	                      },
	                      onComplete: () => {
	                        tntBonusGameplayComplete = true;
	                        releaseTntTransactionWhenSettled('bonus-gameplay-complete');
	                      },
	                    });
	                  }, 0);
	                });
	              };
	              const completeTntVisibleSequence = (reason: string) => {
	                if (tntVisibleSequenceComplete) return;
	                tntVisibleSequenceComplete = true;
	                triggerTntBonusBreak(`${reason}-fallback`);
	                releaseTntTransactionWhenSettled(reason);
	              };
	              triggerTntGameplayAtVisualCommit = triggerTntBonusBreak;
	              markTntVisualSequenceComplete = completeTntVisibleSequence;
	              if (isMainWildTntVisualMerge) {
	                const tntOverlay = showTntAnimation({
	                  ...tntAnimationOptionsForMerge,
	                  onSprite6Start: () => {
	                    triggerTntBonusBreak('sprite-6-enter-complete');
	                  },
	                  onSprite10ExitLeadStart: () => {
	                    triggerTntBonusBreak('sprite-10-exit-minus-300ms-fallback');
	                  },
	                  onSpriteSequenceComplete: () => {
	                    completeTntVisibleSequence('visible-sequence-complete');
	                  }
	                });
                if (tntOverlay) alsoShakeTargets.push(tntOverlay);
	              } else {
	                // A custom TNT archetype (Beach Ball) owns another visual
	                // engine. These bounded guards prevent asset/start failures
	                // from ever retaining the all-board transaction lock.
	                const releaseRatio = getSpecialDiceInputReleaseAtRatio(tntVariantForMerge);
	                trackAppTimeout(() => {
	                  triggerTntBonusBreak('custom-visual-release-safety');
	                }, Math.max(2200, Math.round(6200 * releaseRatio) + 450));
	                trackAppTimeout(() => {
	                  completeTntVisibleSequence('custom-visual-complete-safety');
	                }, 6500);
	              }
            } catch (e) {
              devWarn('⚠️ TNT animation position failed:', e);
            }
          }
          // Wild-magnet merge 6: odmakni ostale kockice od centra (kao TNT blast), bez pulled tiles
          if (isMainWildMagnetMerge) {
            try {
              const magnetBlastCenter = centerInBoard(board, dst, TILE);
              const magnetBlastStrength = TILE * 0.32;
              const magnetBlastDuration = 0.38;
              const magnetReturnDelay = 0.45;
              const magnetReturnDuration = 1.15;
              const magnetReturnElastic = 0.08;
              const allTiles = STATE.tiles || [];
              const magnetBlastHandles: Array<{ tile: Tile; origX: number; origY: number }> = [];
              allTiles.forEach((tile: Tile) => {
                if (!tile || tile.destroyed || tile === dst) return;
                if ((tile as any)._ccWildSpawnDropping === true) return;
                if (isTileBoardBlastDisplacing(tile)) return;
                if ((tile as any)._wildMagnetAffected === true) return;
                const origX = tile.x ?? 0;
                const origY = tile.y ?? 0;
                const tileCenter = centerInBoard(board, tile, TILE);
                const dx = tileCenter.x - magnetBlastCenter.x;
                const dy = tileCenter.y - magnetBlastCenter.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 1) return;
                const dirX = dx / distance;
                const dirY = dy / distance;
                const blastDist = magnetBlastStrength * (0.9 + Math.random() * 0.3);
                const blastX = origX + dirX * blastDist;
                const blastY = origY + dirY * blastDist;
                markTileBoardBlastDisplacing(tile, origX, origY);
                try { gsap.killTweensOf(tile); } catch {}
                gsap.set(tile, { x: origX, y: origY });
                trackTween(tile, {
                  x: blastX,
                  y: blastY,
                  duration: magnetBlastDuration,
                  ease: `elastic.out(1, ${0.04 + Math.random() * 0.04})`,
                  overwrite: 'auto'
                });
                magnetBlastHandles.push({ tile, origX, origY });
              });
              const magnetReturnCall = trackDelayedCall(magnetReturnDelay + magnetBlastDuration, () => {
                magnetBlastHandles.forEach((h) => {
                  if (!h.tile.destroyed) {
                    const retTween = trackTween(h.tile, {
                      x: h.origX,
                      y: h.origY,
                      duration: magnetReturnDuration,
                      ease: `elastic.out(0.6, ${magnetReturnElastic + Math.random() * 0.04})`,
                      overwrite: 'auto',
                      onComplete: () => {
                        clearTileBoardBlastDisplacement(h.tile, h.origX, h.origY);
                      },
                      onInterrupt: () => {
                        clearTileBoardBlastDisplacement(h.tile, h.origX, h.origY);
                      }
                    });
                    try { magnetBlastReturnTweens.push(retTween); } catch {}
                  }
                });
              });
              if (magnetReturnCall) magnetBlastDelayedCalls.push(magnetReturnCall);
              devLog('🧲 Wild-magnet merge 6 - blast (odmak kockica) started for', magnetBlastHandles.length, 'tiles');
            } catch (e) {
              devWarn('⚠️ Magnet blast animation failed:', e);
            }
          }
          try {
            const useLongerWildShake = !isMainWildTntMerge && (isMainWildStarMerge || isMainWildJuiceMerge);
            screenShake(app, {
              strength: useLongerWildShake ? Math.round(baseShake * 1.25) : baseShake,
              duration: useLongerWildShake ? 0.52 : 0.26,
              steps: useLongerWildShake ? 32 : 16,
              ease: 'sine.inOut',
              alsoShake: alsoShakeTargets
            });
          } catch {}
          
          // 🔥 NEW SYSTEM: Direct call to woodShardsAtTile with explicit flags
          // This bypasses getMerge6ShardConfig and ensures correct shard colors
          emitIOSArcadeGameplayTrace('merge6-fx-selected', {
            boardNumber,
            kind: isMainWildMagnetMerge
              ? 'magnet'
              : isMainWildTntMerge
                ? 'tnt'
                : isMainWildJuiceMerge
                  ? 'juice'
                  : isMainWildStarMerge
                    ? 'star'
                    : 'wild-fallback',
            srcSpecial: srcSpecialMerge6 || null,
            dstSpecial: dstSpecialMerge6 || null,
          });
          if (isMainWildMagnetMerge) {
            // Wild-magnet merge: red shards using template-based pooling
            // NO STARS for wild-magnet merge
            devLog('🔥 Wild-magnet merge 6 - using template-based pooling with red shards (NO STARS)');
            const mergePos = centerInBoard(board, dst, TILE);
            const wildMagnetVariant = magnetVariantAtMergeEntry;
            const wildMagnetShardColors = [...magnetShardColorsAtMergeEntry];
            wildMagnetMerge6ShardsTemplated(board, { x: mergePos.x, y: mergePos.y, gridX: dstGridX, gridY: dstGridY, zIndex: dstZIndex } as any, {
              zIndex: dstZIndex,
              color: getSpecialDiceShardColor(wildMagnetVariant),
              colors: wildMagnetShardColors,
            });
            showMagneticText(getSpecialDiceSplashOptions(wildMagnetVariant) || {
              inputReleaseAtRatio: getSpecialDiceInputReleaseAtRatio(wildMagnetVariant),
            });
          } else if (isMainWildOnlyMerge) {
            // Wild-only merge (wild on ordinary or ordinary on wild): yellow shards for wild star, orange for wild juice
            // 🔥 USER REQUEST: Skip star particles - orbiting stars will be animated to HUD instead
            devLog('🔥 Wild-only merge 6 - using template-based pooling (srcSpecial:', srcSpecial, 'dstSpecial:', dstSpecial, ')');
            // 🔥 WILD-JUICE / WILD-TNT: Check merge type (use srcSpecialMerge6/dstSpecialMerge6)
            const isWildJuiceMerge = isMainWildJuiceMerge;
            const isWildTntMerge = isMainWildTntMerge;
            // 🔥 USER REQUEST: Check if this is pure wild star (not wild-juice, not wild-tnt, not wild-magnet)
            const isPureWildStarMerge = isMainWildStarMerge;
            
            // 🔥 CRITICAL DEBUG: Log all relevant values to diagnose why bubbles explosion might not trigger
            devLog('💧 Merge 6 check - isWildJuiceMerge:', isWildJuiceMerge, 'isPureWildStarMerge:', isPureWildStarMerge);
            // Unlock for non-TNT wild merges after short delay
            devLog('💧 Merge 6 special values:', {
              srcSpecialMerge6,
              dstSpecialMerge6,
              srcSpecial,
              dstSpecial,
              srcSpecialCurrent: src?.special,
              dstSpecialCurrent: dst?.special,
              srcValue: src?.value,
              dstValue: dst?.value,
              srcDestroyed: src?.destroyed,
              dstDestroyed: dst?.destroyed
            });
            
            // 🎨 TEMPLATE-BASED: Use new template system with ORIGINAL COLORS
            if (isWildJuiceMerge) {
              // 🍺 Wild-juice merge: orange shards using template-based pooling (ORIGINAL COLOR)
              const wildJuiceVariant = getSpecialDiceVariantForTile(src) || getSpecialDiceVariantForTile(dst);
              const wildJuiceShardColor = getSpecialDiceShardColor(wildJuiceVariant);
              const wildJuiceShardColors = getSpecialDiceShardColors(wildJuiceVariant);
              devLog('🍺 Wild-juice merge 6 - using template-based pooling with shards', {
                variant: wildJuiceVariant?.id || 'core-wild-juice',
                color: wildJuiceShardColor ? `0x${wildJuiceShardColor.toString(16)}` : 'default'
              });
              // Beach Ball already owns this exact Cubero-profile board blast
              // through the TNT transaction so its return can gate bonus play.
              if (!isWildTntMerge) playShortWildMerge6TileBlast('Wild-juice');
              wildJuiceMerge6ShardsTemplated(board, dst, { 
                zIndex: 9993,
                color: wildJuiceShardColor,
                colors: wildJuiceShardColors
              });
            } else if (isWildTntMerge) {
              const wildTntVariant = getSpecialDiceVariantForTile(src) || getSpecialDiceVariantForTile(dst);
              const wildTntShardColors = getSpecialDiceShardColors(wildTntVariant);
              if (wildTntShardColors?.length) {
                wildTntMerge6ShardsTemplated(board, dst, {
                  zIndex: 9993,
                  color: getSpecialDiceShardColor(wildTntVariant),
                  colors: wildTntShardColors,
                });
                devLog('💥 Wild-TNT special merge 6 - using variant shard palette', {
                  variant: wildTntVariant?.id,
                  colors: wildTntShardColors,
                });
              } else {
                // Core TNT owns its complete explosion art and keeps the established no-extra-shards profile.
                devLog('💥 Core Wild-TNT merge 6 - TNT anim active, skipping shards');
              }
            } else if (isPureWildStarMerge) {
              // ⭐ Wild star merge: yellow shards using template-based pooling (ORIGINAL COLOR)
              const wildStarVariant = getSpecialDiceVariantForTile(src) || getSpecialDiceVariantForTile(dst);
              const wildStarShardColor = getSpecialDiceShardColor(wildStarVariant);
              const wildStarShardColors = getSpecialDiceShardColors(wildStarVariant);
              devLog('⭐ Wild star merge 6 - using template-based pooling with shards', {
                variant: wildStarVariant?.id || 'core-wild',
                color: wildStarShardColor ? `0x${wildStarShardColor.toString(16)}` : 'default'
              });
              playShortWildMerge6TileBlast('Wild-star');
              // Sparkle must always appear for pure wild-star merge-6, even when stars-to-HUD path is unavailable.
              try {
                if (!isSparkleTextActive?.()) showSparkleText(getMerge6DomOrigin(dst), getSpecialDiceSplashOptions(wildStarVariant));
              } catch {}
              wildStarMerge6ShardsTemplated(board, dst, { 
                skipStars: true,  // 🔥 USER REQUEST: Skip star particles for pure wild star merge 6
                zIndex: 9993,
                color: wildStarShardColor,
                colors: wildStarShardColors,
              });
              // Trigger stars-to-HUD exactly between shards and smoke phase.
              if (shouldAnimateStarsToHUD && !starsToHudTriggered && savedStarPositionsEarly.length > 0) {
                const merge6PosForStars = getMerge6ScreenPos(dst);
                let hudStarPosForStars = null;
                if (typeof HUD.getStarHudPosition === 'function') {
                  try {
                    hudStarPosForStars = HUD.getStarHudPosition();
                  } catch (e) {
                    devWarn('⚠️ Failed to get HUD star position for between-shards trigger:', e);
                  }
                }
                if (hudStarPosForStars) {
                  starsToHudTriggered = true;
                  (async () => {
                    try {
                      devLog('⭐ Triggering stars-to-HUD between shards and smoke (INSTANT)');
                      await animateStarsToHudIcon(
                        board,
                        stage,
                        savedStarPositionsEarly,
                        savedWildTileScreenPosEarly,
                        merge6PosForStars,
                        hudStarPosForStars,
                        app
                      );
                    } catch (error) {
                      starsToHudTriggered = false;
                      devError('❌ Failed between-shards stars-to-HUD trigger:', error);
                    }
                  })();
                }
              }
            } else {
              // Fallback to generic wild merge
              wildMerge6ShardsTemplated(board, dst, { 
                skipStars: isPureWildStarMerge,
                zIndex: 9993
              });
            }
            
            // 🔥 FPS DROP FIX: Stagger animacije umjesto istovremenog pokretanja
            // Wild-TNT animacija je već pokrenuta gore (prije screenShake, anchor na kockici)
            if (isMainWildTntVisualMerge) {
              devLog('💥 Wild-TNT merge 6 – TNT animacija već pokrenuta (anchor na kockici, prati shake)');
            } else if (isWildJuiceMerge) {
              const wildJuiceVariantForExplosion = getSpecialDiceVariantForTile(src) || getSpecialDiceVariantForTile(dst);
              devLog('💧 Wild-juice merge 6 – pokrećem bubbles explosion');
              try {
                const wasActive = isWildJuiceBubblesExplosionActive();
                if (wasActive) {
                  stopWildJuiceBubblesExplosion();
                }
                if (isWildJuiceBubblesExplosionActive()) {
                  stopWildJuiceBubblesExplosion();
                }
                showWildJuiceBubblesExplosion({
                  showText: true,
                  text: wildJuiceVariantForExplosion?.splashText,
                  textColor: wildJuiceVariantForExplosion?.splashColor,
                  textColors: getSpecialDiceSplashLetterColors(wildJuiceVariantForExplosion),
                  direction: getSpecialDiceJuiceDropProfile(wildJuiceVariantForExplosion) ? 'down' : 'up',
                  dropProfile: getSpecialDiceJuiceDropProfile(wildJuiceVariantForExplosion),
                  spritePaths: getSpecialDiceExplosionSpriteSources(wildJuiceVariantForExplosion),
                  accentSpritePaths: getSpecialDiceFinaleAccentSpriteSources(wildJuiceVariantForExplosion),
                  inputReleaseAtRatio: getSpecialDiceInputReleaseAtRatio(wildJuiceVariantForExplosion),
                  gameplayReleaseAtSpawnRatio: getSpecialDiceGameplayReleaseAtSpawnRatio(wildJuiceVariantForExplosion),
                  onGameplayRelease: triggerTntGameplayAtVisualCommit
                    ? () => triggerTntGameplayAtVisualCommit?.('custom-visual-gameplay-release')
                    : undefined,
                  onSequenceComplete: markTntVisualSequenceComplete
                    ? () => markTntVisualSequenceComplete?.('custom-visual-sequence-complete')
                    : undefined,
                });
              } catch (error) {
                devError('❌ Failed to trigger bubbles explosion:', error);
              }
            }
            if (!isWildJuiceMerge && !isWildTntMerge) {
              devLog('⚠️ Wild-juice/TNT merge NOT detected!', {
                isWildJuiceMerge,
                isWildTntMerge,
                srcSpecialMerge6,
                dstSpecialMerge6,
                srcSpecial,
                dstSpecial,
                srcSpecialCurrent: src?.special,
                dstSpecialCurrent: dst?.special,
                wasWild,
                isMainWildOnlyMerge,
                isMainWildMagnetMerge
              });
            }
          } else {
            // Fallback: use spawnMerge6Shards (shouldn't happen, but safety)
            devWarn('⚠️ Wild merge but neither wild-magnet nor wild-only detected, using spawnMerge6Shards');
            const srcSnapshot = { special: srcSpecial };
            const dstSnapshot = { special: dstSpecial };
            spawnMerge6Shards(board, srcSnapshot, dst, dstSnapshot, { count: 30, intensity: 1.9, spread: 0.3, size: 1.5, speed: 0.85, vanishDelay: 0.0, vanishJitter: 0.02 });
          }
          
          wildImpactEffect(dst, { squash: 0.30, stretch: 0.26, tilt: 0.18, bounce: 1.24 });
          scheduleBoardTileVisualRepair('wild-merge6-fx');
        } else {
          // 🔥 REGULAR MERGE 6: Use same system as wild/magnet merge but with 50% reduced intensity
          // Same effects as wild merge, but all parameters scaled down by 50%
          (dst as any)._lastMergeWasRegularOnly = true; // No stars/bubbles → skip stars wait, clean board ASAP
          
          // 🔥 CRITICAL: Regular merge 6 shards - START 0.150s EARLIER (before glass crack)
          // This ensures shards animation starts before tile "dies off"
          // 🔥 SPEED UP: Instant procedural fade-out + animation duration exactly 1s
          const mergePos = centerInBoard(board, dst, TILE);
          // 🎨 TEMPLATE-BASED: Use new template system for reliable pooling
          const reducedMergeFx = isBoardFxReduced();
          const regularMerge6Fx = getRegularMerge6FxProfile(reducedMergeFx);
          regularMerge6ShardsTemplated(board, { x: mergePos.x, y: mergePos.y, gridX: dstGridX, gridY: dstGridY, zIndex: dstZIndex } as any, {
            zIndex: dstZIndex,
            density: regularMerge6Fx.shardDensity,
            visualScale: regularMerge6Fx.shardVisualScale,
            distanceScale: regularMerge6Fx.shardDistanceScale,
          });
          
          // One uniform hero bounce already owns regular merge-6 impact.
          
          // Smoke bubbles (50% of wild: 2.6 * 0.5 = 1.3)
          smokeBubblesAtTile(board, dst, TILE * 1.0, 1.3, {
            spawnShape: regularMerge6Fx.smokeSpawnShape,
            sizeBoostChance: 0.2,
            sizeBoostScale: 1.3,
            sizeScale: regularMerge6Fx.smokeSizeScale,
            countScale: regularMerge6Fx.smokeCountScale,
            instantFadeOut: false,
            durationScale: 0.9,
            distanceScale: regularMerge6Fx.smokeDistanceScale,
            ellipseChance: regularMerge6Fx.smokeEllipseChance,
            ellipseAspectMin: regularMerge6Fx.smokeEllipseAspectMin,
            ellipseAspectMax: regularMerge6Fx.smokeEllipseAspectMax,
            color: 0xFFFFFF,
            haloColor: 0xFFFFFF,
            baseAlpha: 1,
            trailAlpha: 1,
            cloudAlphaProfile: true,
            blendMode: 'normal',
          });
        }

        
        // Show multiplier for merge 6
        if (dst && !dst.destroyed) {
        if (wasWild) {
          showMultiplierTile(board, dst, mult, TILE * 1.3, 1.2);
          if (!isMainWildTntMerge) {
            // 🔥 Wild-magnet merge: Reduce smoke intensity by 80% (3.0 * 0.2 = 0.6)
            const smokeStrength = isMainWildMagnetMerge ? 0.6 : 3.0;  // 80% reduction for wild-magnet
            markMergePerformance('wild-smoke-main-start');
            smokeBubblesAtTile(board, dst, TILE * 1.3, smokeStrength, {
              sizeScale: 0.8 + Math.random() * 0.25,  // Compact size: 0.8-1.05x
              countScale: 0.75 + Math.random() * 0.3, // Rich but contained: 0.75-1.05x
              distanceScale: 0.55,
              trailAlpha: 0.92,
              spawnShape: 'box',
              maxParticles: isMainWildMagnetMerge ? 36 : 72,
              groupedOwner: true,
              deferFutureBursts: true,
            });
            markMergePerformance('wild-smoke-main-created');
          }
        } else {
          showMultiplierTile(board, dst, mult, TILE, 1.0);
          }
          
          // 🔥 CRITICAL: For wild-magnet, trigger pulled tiles merge when multiplier animation STARTS
          // Multiplier animation starts immediately (scale from 0.12 to 1.26 over 0.18s)
          // We want to trigger when the animation starts, not when it completes
          // 🔥 SPEED UP: For wild-magnet, speed up multiplier appearance by 60% (0.18s → 0.072s)
          // Set flag on tile so showMultiplierTile can detect it and speed up animation
          if (wasWildMagnet && (dst as any)._wildMagnetMergeCallback) {
            // Mark tile so showMultiplierTile can speed up animation by 60%
            (dst as any)._wildMagnetSpeedUp = true;
            
            // Trigger immediately when multiplier animation starts (scale begins growing)
            // Note: Pulled tiles animation already started when merge 6 began (no delay)
            // Speed up by 60%: original delay was 0.2s, now 0.08s (60% faster)
            trackAppTimeout(async () => {
              devLog(`🧲 Multiplier x${mult} animation started (sped up 60%), triggering pulled tiles merge`);
              if ((dst as any)._wildMagnetMergeCallback) {
                await (dst as any)._wildMagnetMergeCallback();
                // Clean up callback
                (dst as any)._wildMagnetMergeCallback = undefined;
                (dst as any)._wildMagnetSpeedUp = undefined;
              }
            }, 80); // Speed up by 60%: 0.2s * 0.4 = 0.08s = 80ms (was 0ms, now 80ms for 60% speedup)
          }
        } else {
          devWarn('⚠️ Cannot show multiplier - destination tile is destroyed');
        }

        if (!wasWild) {
          try {
            // 🔥 USER REQUEST: Reduce regular merge 6 shake by 55% for more contained movement
            const base = Math.min(24, 10 + Math.max(1, mult) * 3);
            const reducedStrength = Math.round(base * 0.45); // 55% reduction = 45% of original
            screenShake(app, { strength: reducedStrength, duration: 0.32, steps: 18, ease: 'power2.out' });
          } catch {}
        }

        // CRITICAL: Store grid position BEFORE any checks
        const gx = dst.gridX, gy = dst.gridY;
        
        // 🔥 CRITICAL: Use centralized end game checker BEFORE removing dst
        // This is a safety check to catch cases where the earlier check might have missed it
        // BUT: Skip if this is a wild-magnet merge that will pull tiles OR a regular wild merge that is NOT the last merge
        const isWildMagnetMergeWithPullBeforeDst = (isSpecialDiceMagnetLikeTile(src, srcSpecial) || isSpecialDiceMagnetLikeTile(dst, dstSpecial)) && 
                                                    (dst as any)?._wildMagnetMergeCallback;
        const isRegularWildMergeBeforeDst = (isWildLikeSpecial(srcSpecial) || isWildLikeSpecial(dstSpecial)) && 
                                            !(isSpecialDiceMagnetLikeTile(src, srcSpecial) || isSpecialDiceMagnetLikeTile(dst, dstSpecial));
        const isNotLastMergeBeforeDst = !(dst as any)?._isLastMerge;
        
        if (!busyEnding && !isWildMagnetMergeWithPullBeforeDst && !(isRegularWildMergeBeforeDst && isNotLastMergeBeforeDst)) {
          // 🔥 CRITICAL FIX v40: Check for magnet/wild BEFORE calling checkEndGame
          // If magnet or wild exists on board, it's NOT a last merge - they can merge with merge6
          // This prevents premature clean board when: wild + tile + magnet → wild merge → magnet + merge6 (before spawn)
          const activeTilesBeforeCheck = tiles.filter((t: any) => {
            return tileIsActive(t as any);
          });
          
          const hasMagnetBeforeCheck = activeTilesBeforeCheck.some((t: any) => isSpecialDiceMagnetLikeTile(t));
          const hasWildBeforeCheck = activeTilesBeforeCheck.some((t: any) => isWildLikeTile(t) && !isSpecialDiceMagnetLikeTile(t));
          const hasMerge6BeforeCheck = activeTilesBeforeCheck.some((t: any) => t.value === 6);
          
          // 🔥 CRITICAL: If magnet + merge6 or wild + merge6 exists, skip last merge check
          // They can merge together, so it's NOT a last merge
          if ((hasMagnetBeforeCheck && hasMerge6BeforeCheck) || (hasWildBeforeCheck && hasMerge6BeforeCheck)) {
            devLog('🧲⭐ MAGNET/WILD SAFETY (before dst removal): Magnet/wild + merge6 detected - NOT a last merge, game continues');
            devLog('🧲⭐ Details:', { hasMagnet: hasMagnetBeforeCheck, hasWild: hasWildBeforeCheck, hasMerge6: hasMerge6BeforeCheck });
            // Don't call checkEndGame - continue with normal merge 6 flow (spawn, etc.)
          } else {
          const beforeDstRemovalContext: EndGameContext = {
            tiles,
            moves,
            makeBoard,
            dstTile: dst,
            justRemovedSrc: false
          };
          
          // Force refresh for critical check before dst removal
          const beforeDstRemovalResult = checkEndGame(beforeDstRemovalContext, true);
          
          // Use centralized checker result - it handles all last merge scenarios
          // also catch 'only_merge6_remains': happens when justRemovedSrc=false so
          // isLastMergeScenario bails early, but activeTiles===1 (dst merge-6) triggers it
          const isCleanBeforeDst = beforeDstRemovalResult.type === 'clean' &&
            (beforeDstRemovalResult.reason === 'last_merge' || beforeDstRemovalResult.reason === 'only_merge6_remains');
          if (isCleanBeforeDst) {
            if (
              beforeDstRemovalResult.reason === 'only_merge6_remains' &&
              isNonFinalMerge6CleanVetoActive(dst)
            ) {
              devWarn('🛡️ before-dst clean veto: merge6 was marked non-final, continuing normal spawn/gameplay', {
                reason: beforeDstRemovalResult.reason,
                blockerCount: (dst as any)?._ccFinalMergeBlockerCount,
                activeSnapshotCount: (dst as any)?._ccFinalMergeActiveSnapshotCount,
                nonFinal: (dst as any)?._ccNonFinalMerge6 === true,
              });
            } else {
            devLog('🚨🚨🚨 LAST MERGE DETECTED (before dst removal, centralized checker) - Only merge 6 remains, triggering clean board flow');
            setFinalMergeVisualSuppression(true, { preserveGhosts: true });
            try { (dst as any)._isLastMerge = true; } catch {}
            
            // 🔥 BUG FIX: Clear STACK IT! hint immediately - board will be clean
            try { resetEndgameHint(); } catch {}

            // Keep dst visible. triggerCleanBoardFlow now owns the whole visual handoff:
            // final effect wait -> residual/ghost pop-out -> HUD/bottom exit -> modal/new-card.
            // Removing dst here was legacy cleanup that bypassed the centralized animation path.
            
            // 🔥 FIX: Use triggerCleanBoardFlow (same entry as other clean board paths) so modal shows consistently
            // Note: triggerCleanBoardFlow will set busyEnding internally, so we don't need to set it here
            await triggerCleanBoardFlow('clean_board_from_last_merge_checkEndGame', {
              finalMergeSnapshot,
            });
            return; // Exit early - don't continue with normal merge 6 flow
            }
          }
          } // End of else block for checkEndGame call
        } else {
          if (busyEnding) {
            devLog('⏳ Last merge check (before dst removal) skipped - busyEnding is true');
          } else if (isWildMagnetMergeWithPullBeforeDst) {
            devLog('🧲 Last merge check (before dst removal) skipped - wild-magnet merge will pull tiles');
          } else if (isRegularWildMergeBeforeDst && isNotLastMergeBeforeDst) {
            devLog('⭐ Last merge check (before dst removal) skipped - regular wild merge mid-game (NOT last merge)');
          }
          // Don't return here - continue with normal merge 6 flow for wild-magnet and regular wild merges
        }
        
        // 🔥 CRITICAL: DON'T remove dst tile yet - we need it for endgame checks and spawn logic
        // dst will be removed AFTER spawn logic, not before
        // This prevents false "clean board" detection when dst is still the only remaining tile
        
        // 🔥 CRITICAL: Check if this is magnet pull merge BEFORE hiding dst tile
        // For magnet pull merge, dst (merge 6) should remain visible on the board
        // 🔥 CRITICAL FIX: Use _willPullTiles (set BEFORE onComplete) OR _wildMagnetPulledTilesMerge (set AFTER callback)
        // Do NOT check _wildMagnetMergeCallback - it exists even when no tiles are pulled!
        const isMagnetPullMergeFlag = isWildMagnet && (dst as any)?._wildMagnetPulledTilesMerge === true;
        const willPullEarly = isWildMagnet &&
          ((dst as any)?._noTilesPulled === true ? false : (dst as any)?._willPullTiles === true);
        const isMagnetPullMerge = isMagnetPullMergeFlag || willPullEarly;
        
        // Placeholder handling for non-regular merge flows.
        // Regular merge-6 must keep dst as visible active result tile.
        let placeholderHolder: any = null; // 🔥 v40.1: Store reference to placeholder for cleanup
        if (dst && !dst.destroyed && STATE.tiles.includes(dst)) {
          const keepRegularMerge6Visible = !isMagnetPullMerge && !wasWild;
          // 🔥 CRITICAL FIX: Only clear grid if dst will actually be hidden/replaced.
          // Regular merge-6 that stays visible must keep a valid grid pointer.
          if (!isMagnetPullMerge && !keepRegularMerge6Visible) {
            grid[gy][gx] = null;
          }

          // Regular merge-6 must remain on board as active tile.
          // Placeholder replacement here can leak as locked ghost and break merge result visuals.
          if (keepRegularMerge6Visible) {
            dst.locked = false;
            try { makeBoard.syncTileZIndex?.(dst, board); } catch {}
            dst.visible = true;
            dst.alpha = 1;
            // Cleanup ownership keeps the impact visible, but never draggable.
            // A queued rapid touch must not rebind this destination before removal.
            dst.eventMode = 'none';
            dst.interactive = false;
            dst.interactiveChildren = false;
            dst.cursor = 'default';
            devLog('🎯 Regular merge-6: keeping impact visible under cleanup ownership (non-interactive)');
          } else if (!isMagnetPullMerge) {
            // Wild non-magnet flow keeps legacy behavior (placeholder helper for spawn choreography).
            dst.visible = false;
            dst.alpha = 0;
            dst.eventMode = 'none';

            placeholderHolder = makeBoard.createTile({ board, grid, tiles, c: gx, r: gy, val: 0, locked: true });
            placeholderHolder.alpha = 0.35;
            placeholderHolder.eventMode = 'none';

            // 🔥 v40.1: Store reference on dst for cleanup
            (dst as any)._placeholderHolder = placeholderHolder;

            devLog('🔍 Dst tile hidden but NOT removed from tiles array yet - will be removed AFTER spawn');
            devLog('🔍 Placeholder created at (', gx, ',', gy, ') for spawn logic');
          } else {
            // 🔥 CRITICAL: For magnet pull merge, keep dst tile visible and don't create placeholder
            // The merge 6 tile should remain on the board along with newly spawned tiles
            devLog('🧲 Magnet pull merge detected - keeping merge 6 tile visible on board');
            devLog('🧲 Dst tile (merge 6) will remain visible:', { 
              value: dst.value, 
              gridX: dst.gridX, 
              gridY: dst.gridY,
              wasWildMagnet: wasWildMagnet,
              hasCallback: !!(dst as any)?._wildMagnetMergeCallback,
              hasFlag: isMagnetPullMergeFlag
            });
          }
        } else {
          devWarn('⚠️ Destination tile is invalid or already destroyed');
        }

        // countdown moves (this happens for both normal and pulled tiles merge)
        moves = Math.max(0, moves - 1);

        // scoring with bubble multiplier and combo multiplier
        // 🔥 CRITICAL: Skip scoring if pulled tiles merge is happening (scoring handled in mergePulledTilesIntoMerge6)
        if (isWildMagnet && (dst as any)?._wildMagnetPulledTilesScoring) {
          devLog('🧲 Skipping scoring in main merge 6 flow - pulled tiles merge will handle scoring');
        } else {
        const bubbleMult = mult || 1;
        const comboMult  = combo > 0 ? combo : 1;
        const scoreDelta = 6 * bubbleMult * comboMult;
        logger.debug('🎯 Score calculation', 'app-core', { mult, bubbleMult, comboMult, scoreDelta });
        
        score = Math.min(SCORE_CAP, score + scoreDelta);
        // CRITICAL: Sync STATE.score with local score after adding
        STATE.score = score;
        devLog('🎯 Final score after merge:', score, 'STATE.score:', STATE.score);

        animateBoardHUD(boardNumber, 0.40);
        animateScore(score, 0.40);
        }

        if (!isFirstPlayTutorialRunActive()) {
          // Stats: count merge-6 as "cubes cracked"
          statsService.incrementCubesCracked(1);
          if (isArcadeHomeRunMode()) {
            arcadeStatsService.addCubesCracked(1);
          }
          
          // 🔥 USER REQUEST: Track cubes cracked per-board for merge-6
          try {
            if (typeof window.trackCubesCracked === 'function') {
              window.trackCubesCracked(1);
              devLog(`🧊 Merge-6: Tracked cubes cracked for board ${boardNumber}`);
            }
          } catch (error) {
            devWarn('⚠️ Failed to track board-specific cubes cracked for merge-6:', error);
          }
        }
        
        if (wasWild && !isFirstPlayTutorialRunActive()) {
          statsService.incrementHelpersUsed(1);
        }
        
        // Stats: Track longest combo - use actual combo value after merge-6
        // For merge-6, combo is already incremented in the merge function above
        const currentComboForMerge6 = typeof window.CC?.getCombo === 'function'
          ? window.CC.getCombo()
          : combo;
        if (currentComboForMerge6 > 0 && !isFirstPlayTutorialRunActive()) {
          statsService.updateLongestCombo(currentComboForMerge6);
          if (isArcadeHomeRunMode()) {
            arcadeStatsService.updateLongestCombo(currentComboForMerge6);
          }
          
          // 🔥 JOURNEY BOARDS: Track longest combo per board for merge-6
          try {
            import('../services/board-stats-service.js').then(({ boardStatsService }) => {
              boardStatsService.updateBoardLongestCombo(boardNumber, currentComboForMerge6);
              devLog(`🎯 Merge-6: Tracked longest combo for board ${boardNumber}: ${currentComboForMerge6}`);
            }).catch(() => {
              // Ignore import errors
            });
          } catch {}
        }
        
        if (!isFirstPlayTutorialRunActive()) {
          // Stats: Update high score for every merge
          statsService.updateHighScore(score);
          if (isArcadeHomeRunMode()) {
            arcadeStatsService.updateHighScore(score);
          }
        }
        
        // COLLECTIBLES: Dispatch event for first merge 6
        if (!wasWild && typeof (window as any).collectiblesManager !== 'undefined' && (window as any).collectiblesManager) {
          const manager = (window as any).collectiblesManager;
          if (typeof manager.unlockCard === 'function') {
            manager.unlockCard('first_merge_6');
          }
        }
        
        // Ghost placeholders are now fixed and always visible

        // ► CLEAN BOARD flow (centralized orchestrator)
        // 🔥 DEBUG: Log when merge-6 onComplete is called
        devLog('🔥🔥🔥 MERGE-6 onComplete CALLED:', {
          dstValue: dst?.value,
          srcSpecial,
          dstSpecial,
          wildActive,
          isWildStar: srcSpecial === 'wild' || dstSpecial === 'wild',
          isWildJuice: srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice',
          isWildMagnet: srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet',
          _wildMagnetPulledTilesMerge: (dst as any)?._wildMagnetPulledTilesMerge,
          _isLastMerge: (dst as any)?._isLastMerge,
          activeTilesCount: tiles.filter(t => t && !t.destroyed && !t.locked && ((t.value|0) > 0 || t.special)).length
        });
        
        // 🔥 CRITICAL: Skip end game check AND normal spawn if pulled tiles merge is happening (or WILL happen)
        // RACE FIX: Main onComplete runs at ~80ms, but pull merge happens at ~260ms when tiles reach 75%.
        // So _wildMagnetPulledTilesMerge is false when we run - we must also check willPullTilesFlag!
        // Otherwise we'd run normal spawn here, then mergePulledTilesIntoMerge6 would also spawn → conflict/no tiles.
        const willPullMerge = isWildMagnet &&
          ((dst as any)?._wildMagnetPulledTilesMerge === true || willPullTilesFlag);
        if (willPullMerge) {
          devLog('🧲 Skipping normal spawn - magnet pull merge will handle spawn (willPullTilesFlag or merge done)');
          // Don't run normal spawn - mergePulledTilesIntoMerge6 will spawn after pull completes
          // Don't remove dst - merge 6 stays on board for user to merge with spawned tiles
          return;
        }
        
        // 🔥 REMOVED: Premature endgame check that was blocking spawn logic
        // The endgame check was running BEFORE spawn, causing board to look empty (dst removed)
        // This made it trigger clean board flow instead of spawning new tiles
        // Endgame check will be done AFTER spawn in checkLevelEnd()
        devLog('🎯 Merge 6 completed, proceeding to spawn logic...');
        devLog('🔍 DEBUG: mult value in onComplete:', mult, 'typeof mult:', typeof mult);
        
        // 🔥 USER REQUEST: Check for last merge BEFORE adding wild progress and spawning
        // Last merge applies to:
        // 1. Wild + regular → merge 6 (only 2 tiles) = clean board
        // 2. Regular + regular → merge 6 (only 2 tiles, e.g. 4+2=6) = clean board
        // 3. Wild-magnet + regular → merge 6 (only 2 tiles) = clean board
        // 🔥 CRITICAL FIX v85: If pulled tiles will merge, this is NOT last merge (new tiles will spawn)
        // Check BOTH flags: _wildMagnetPulledTilesMerge (set when merge starts) AND _hasTilesToPull (set earlier in merge function)
        // _hasTilesToPull is set when wild-magnet merge is detected and there are tiles to pull
        // This prevents premature clean board trigger when magnet pulls tiles and spawns new ones
        const willPulledTilesMerge = isWildMagnet && (dst as any)?._wildMagnetPulledTilesMerge === true;
        const hasTilesToPullFlag = isWildMagnet && (dst as any)?._hasTilesToPull === true;
        const hasConfirmedMagnetPullIntent =
          ((dst as any)?._willPullTiles === true && (dst as any)?._noTilesPulled !== true) ||
          willPulledTilesMerge;
        const hasPlayableMagnetPullCandidates = hasTilesToPullFlag && getPlayableMagnetPullCandidates({
          tiles: collectBoardGameplayTiles(),
          src,
          dst,
          magnetTile: isSpecialDiceMagnetLikeTile(src, srcSpecialMerge6) ? src : dst,
        }).length > 0;
        const hasTilesToPull = hasTilesToPullFlag && (hasConfirmedMagnetPullIntent || hasPlayableMagnetPullCandidates);
        if (hasTilesToPullFlag && !hasTilesToPull && dst) {
          (dst as any)._hasTilesToPull = false;
          (dst as any)._willPullTiles = false;
          (dst as any)._noTilesPulled = true;
          devWarn('🧲 Corrected stale _hasTilesToPull=false during merge-6 onComplete; no valid pull intent/candidates remain');
        }
        // If hasTilesToPull is true, it means wild-magnet merge will pull tiles (only for merge 6)
        const willPullTiles = willPulledTilesMerge || hasTilesToPull;
        const hasLastMergeFlag = (dst as any)?._isLastMerge === true || (src as any)?._isLastMerge === true;
        
        // 🔥 CRITICAL FIX: If pulled tiles will merge, skip last merge check (new tiles will spawn)
        let isActuallyLastMerge = false;
        if (willPullTiles) {
          devLog('🧲 Pulled tiles will merge - this is NOT last merge (new tiles will spawn)', {
            willPulledTilesMerge,
            hasTilesToPull,
            willPullTiles,
            note: 'Skipping last merge check because tiles will be pulled and new tiles will spawn'
          });
          // Don't check for last merge - pulled tiles merge will spawn new tiles
          isActuallyLastMerge = false;
        } else {
          // 🔥 CRITICAL: Double-check last merge scenario using end game checker
          // This ensures we catch last merge even if flag wasn't set properly
          const currentFinalMergeTileSets = getFinalMergeTileSets({
            tiles: collectBoardGameplayTiles(),
            src,
            dst,
          });
          const currentFinalMergeBlockers = currentFinalMergeTileSets.finalMergeBlockersBefore;
          const activeTilesAfterMerge = currentFinalMergeTileSets.activeTilesBeforeMerge;
          
          // If only merge 6 remains (or merge 6 + locked tiles), this is last merge
          const onlyMerge6RemainsInOnComplete = activeTilesAfterMerge.length === 1 && 
                                                activeTilesAfterMerge[0] === dst && 
                                                dst.value === 6;
          
          // Legacy shape checks are kept only for diagnostics. Final merge itself must
          // come from the central resolver/snapshot so stacked regular dice cannot
          // force a false clean-board flow.
          const onlyTwoActiveBeforeMerge =
            activeTilesBeforeMerge.length === 2 &&
            activeTilesBeforeMerge.includes(src) &&
            activeTilesBeforeMerge.includes(dst) &&
            finalMergeBlockersBefore.length === 0 &&
            !hasTilesToPull;
          const currentOnlyMergePairBefore =
            activeTilesBeforeMerge.length === 2 &&
            activeTilesBeforeMerge.includes(src) &&
            activeTilesBeforeMerge.includes(dst) &&
            !hasTilesToPull;
          const hasTrustedLastMergeFlag =
            hasLastMergeFlag &&
            (isFinalMergeByResolver || isFinalWildLastTwo || isFinalRegularMerge6Snapshot);

          isActuallyLastMerge =
            isFinalMergeByResolver ||
            (currentFinalMergeBlockers.length === 0 &&
              (hasTrustedLastMergeFlag ||
              isFinalWildLastTwo));
          if (currentFinalMergeBlockers.length > 0 && !isFinalMergeByResolver) {
            try { (dst as any)._isLastMerge = false; } catch {}
            try { (src as any)._isLastMerge = false; } catch {}
          }
        
          devLog('🔍 LAST MERGE CHECK in merge-6 onComplete:', {
            hasLastMergeFlag,
            hasTrustedLastMergeFlag,
            onlyMerge6RemainsInOnComplete,
            onlyTwoActiveBeforeMerge,
            currentOnlyMergePairBefore,
            isActuallyLastMerge,
            isFinalWildLastTwo,
            isFinalRegularMerge6Snapshot,
            isFinalMergeByResolver,
            finalMergeBlockersBefore: finalMergeBlockersBefore.map((t: any) => ({
              value: t ? (t.value | 0) : null,
              special: t?.special ?? null,
              locked: t?.locked === true,
              visible: t?.visible !== false,
              alpha: t?.alpha,
              gridX: t?.gridX,
              gridY: t?.gridY,
            })),
            currentFinalMergeBlockers: currentFinalMergeBlockers.map((t: any) => ({
              value: t ? (t.value | 0) : null,
              special: t?.special ?? null,
              locked: t?.locked === true,
              visible: t?.visible !== false,
              alpha: t?.alpha,
              gridX: t?.gridX,
              gridY: t?.gridY,
            })),
            activeTilesAfterMergeCount: activeTilesAfterMerge.length,
            srcSpecial: src?.special,
            dstSpecial: dst?.special,
            srcValue: src?.value,
            dstValue: dst.value
          });
        }
        
        // If _isLastMerge flag is set (from early check or merge-6 block), skip wild progress and spawn
        // This flag is set for wild + regular OR regular + regular → merge 6 scenarios (only 2 tiles)
        if (isActuallyLastMerge) {
          cancelPendingWildContinuation('final_merge_on_complete');
          const mergeType = (!src?.special && !dst?.special) ? 'Regular + regular' : 
                           (isSpecialDiceMagnetLikeTile(src) || isSpecialDiceMagnetLikeTile(dst)) ? 'Wild-magnet + regular' :
                           'Wild + regular';
          devLog(`🚨🚨🚨 LAST MERGE DETECTED (in merge-6 onComplete) - ${mergeType} → merge 6, skipping wild progress and spawn, triggering clean board`);
          devLog('🚨🚨🚨 LAST MERGE: hasLastMergeFlag =', hasLastMergeFlag, 'onlyMerge6RemainsInOnComplete =', isActuallyLastMerge, 'dst._isLastMerge =', (dst as any)?._isLastMerge);
          
          // Ensure flag is set for consistency
          if (!hasLastMergeFlag) {
            (dst as any)._isLastMerge = true;
            devLog('✅ Setting _isLastMerge flag in onComplete (was missing)');
          }
          // Keep ghost placeholders visible until the final residual pop-out animates them away.
          setFinalMergeVisualSuppression(true, { preserveGhosts: true });
          
          // Skip wild progress and spawn - go directly to clean board flow
          // The clean board flow will be triggered by the _isLastMerge flag check below
          // 🔥 CRITICAL: DON'T call addWildProgress - it would fill wild meter and trigger wild spawn!

          const isFinalTntMerge = getSpecialDiceFinaleFlagsForMerge({
            src,
            dst,
            srcSpecial: srcSpecialMerge6,
            dstSpecial: dstSpecialMerge6,
          }).isTnt;
          if (isFinalTntMerge) {
            devLog('💥 Final TNT merge: using global handoff instead of legacy full-animation defer');
            try { resetEndgameHint(); } catch {}
          }
        } else {
          // Normal merge-6 - add wild progress
          devLog('✅ Normal merge-6 (NOT last merge) - adding wild progress');
          addWildProgress(WILD_INC_BIG, { confirmedNonFinal: true });
        }
        
        // Game continues - check moves and proceed with spawn
        // 🔥 BUG FIX: For WILD merges (juice, star, TNT, magnet), ALWAYS spawn first (3 active + 6 locked)
        // Don't return early on moves depleted - spawn will add new tiles; checkLevelEnd will re-check after spawn
        const isWildMergeForMovesCheck =
          isWildLikeSpecial(srcSpecialMerge6) ||
          isWildLikeSpecial(dstSpecialMerge6);
        const isWildMagnetMergeForMovesCheck =
          srcSpecialMerge6 === 'wild-magnet' || dstSpecialMerge6 === 'wild-magnet';
        if (moves === 0 && !isWildMergeForMovesCheck && !isActuallyLastMerge) {
          // Use centralized checker for moves depleted scenario (NON-wild merges only)
          const movesDepletedContext: EndGameContext = {
            tiles,
            moves: 0,
            makeBoard
          };
          
          // 🔥 CRITICAL: Use forceRefresh for moves depleted check
          const movesDepletedResult = checkEndGame(movesDepletedContext, true);
          
          if (movesDepletedResult.type === 'stuck') {
            devLog('🚨🚨🚨 MOVES DEPLETED + GAME STUCK');
            try { resetEndgameHint(); } catch {}
            const wildContinuationDeferred = deferFailForWildContinuation('merge_moves_depleted_stuck');
            const terminalHandoffAction = resolveMerge6MovesDepletedStuckAction({ wildContinuationDeferred });
            if (terminalHandoffAction === 'continue-merge6') {
              // Do not return from the merge transaction here. The regular
              // merge-6 still owns its destination cleanup and replacement
              // spawn. Returning used to strand a locked value-6 until the
              // watchdog while the newly earned special started concurrently.
              devLog('🛡️ Wild continuation deferred No Moves; completing regular merge-6 cleanup/spawn first');
            } else {
              if (await preventTutorialFailWithFinalChance('merge_moves_depleted_stuck')) return;
              if (!busyEnding) {
                await runNoMovesFailFlow({ reason: 'merge_moves_depleted_stuck', resetHint: false });
              }
              return;
            }
          }
        } else if (moves === 0 && isActuallyLastMerge) {
          devLog('🏁 Moves depleted, but final merge-6 already won the board - skipping fail check');
        } else if (moves === 0 && isWildMergeForMovesCheck) {
          if (isWildMagnetMergeForMovesCheck) {
            devLog('🧲 Wild-magnet merge with moves depleted - no extra 3 active spawn');
          } else {
            devLog('🍺⭐ Wild merge with moves depleted - spawning 3 active + 6 locked first, then checkLevelEnd will re-check');
          }
        }
        // Pass wild merge target info for smart spawning
        const wildMergeTarget = Number.isFinite(wildTargetValue) ? wildTargetValue : null;
        
        // 🔥 CRITICAL: Skip normal spawn if pulled tiles merge is happening
        // Pulled tiles merge already spawns new tiles in mergePulledTilesIntoMerge6
        // 🔥 FIX: Do NOT remove merge 6 - mergePulledTilesIntoMerge6 re-enables it as normal draggable tile
        if (isWildMagnet && (dst as any)?._wildMagnetPulledTilesMerge) {
          devLog('🧲 Skipping normal spawn - pulled tiles merge already spawned tiles');
          // Merge 6 stays on board - already re-enabled (eventMode, bindToTile) in mergePulledTilesIntoMerge6
          (dst as any)._wildMagnetPulledTilesMerge = undefined;
          (dst as any)._wildMagnetPulledTilesScoring = undefined;
          devLog('🧲 Skipping checkLevelEnd call here - mergePulledTilesIntoMerge6 will handle it after spawn completes');
          return;
        }
        
        // 🔥 SOURCE OF TRUTH: Final Two Tiles Resolution
        // Case A — Two tiles merge into 6: This is FINAL MERGE-6, Trigger CLEAN BOARD, No further spawning
        // 🔥 SIMPLIFIED: Only check _isLastMerge flag - this is set ONLY when it's truly the last merge (2 tiles total)
        // All other checks were too aggressive and blocked spawn when it shouldn't be blocked
        // 🔥 CRITICAL FIX: If pulled tiles will merge, this is NOT last merge (new tiles will spawn)
        // Note: willPulledTilesMerge is already declared above (line 4997), so we reuse it here
        const hasRawLastMergeFlag =
          (dst as any)?._isLastMerge === true ||
          (src as any)?._isLastMerge === true;
        const isLastMergeFlagSet =
          isFinalMergeByResolver ||
          isFinalWildLastTwo ||
          (hasRawLastMergeFlag && (isFinalRegularMerge6Snapshot || isFinalWildLastTwo));
        
        // 🔥 SOURCE OF TRUTH: If final merge-6 (_isLastMerge flag), trigger CLEAN BOARD, do NOT spawn
        // This applies to ALL merge types: normal, wild juice, wild star, wild magnet
        if (isLastMergeFlagSet && !willPulledTilesMerge) {
          cancelPendingWildContinuation('final_merge_source_of_truth');
          // Keep ghost placeholders visible until the final residual pop-out animates them away.
          setFinalMergeVisualSuppression(true, { preserveGhosts: true });

          devLog('🚨🚨🚨 SOURCE OF TRUTH: Final merge-6 detected (_isLastMerge flag) - triggering CLEAN BOARD, NO spawn');
          devLog('🎯 Source of Truth: Case A — Two tiles merge into 6: This is FINAL MERGE-6, Trigger CLEAN BOARD, No further spawning');
          const finalMergeFx = getSpecialDiceFinaleFxForMerge({
            src,
            dst,
            srcSpecial: srcSpecialMerge6,
            dstSpecial: dstSpecialMerge6,
          });
          const finalSpecialDiceVariant = getSpecialDiceVariantForTile(src) || getSpecialDiceVariantForTile(dst);
          
          // 🔥 FINAL WILD ANIMATION WAIT: let wild visuals finish before clean board.
          // final-merge-handoff owns missing-finale fallback start/wait behavior.
          const isFinalTntMerge = finalMergeFx === 'tnt';
          const finalCleanReason = getFinalMergeCleanBoardReason(finalMergeFx);
          if (isArcadeHomeRunMode()) {
            await prepareArcadeStageClearFinalMergeHandoff(
              finalCleanReason,
              `final-merge:${finalMergeFx || 'regular'}`,
              createFinalMergeVisualStarters(dst, finalSpecialDiceVariant)
            );
          } else {
            await prepareFinalMergeVisualHandoff(
              finalCleanReason,
              `final-merge:${finalMergeFx || 'regular'}`,
              {
                ...createFinalMergeVisualStarters(dst, finalSpecialDiceVariant),
                finalMergeSnapshot,
              }
            );
          }
          
          // 🔥 CRITICAL: Use triggerCleanBoardFlow (same entry as moves depleted / checkLevelEnd) so modal shows consistently
          devLog('🚨🚨🚨 SOURCE OF TRUTH: Final merge-6 - triggering clean board flow via triggerCleanBoardFlow (NO spawn)');

          if (isFinalTntMerge) {
            (window as any).__ccSkipEndgameStarsWaitOnce = true;
          }
          // The final visual handoff has already consumed the special result
          // and no gameplay mutation remains. Release the exact token before
          // the modal/score flow so Play Again never has to force-reset a
          // lingering Star/Juice/Magnet/TNT owner.
          releaseSpecialDiceTransaction(
            specialTransactionToken,
            `final-merge-clean-handoff:${finalMergeFx || 'regular'}`,
          );
          await triggerCleanBoardFlow(finalCleanReason, { finalMergeSnapshot });
          
          return; // Exit early - don't spawn new tiles (SOURCE OF TRUTH: Final merge-6 = NO spawn)
        }
        
        // 🔥 CRITICAL FIX: Don't trigger clean board if pulled tiles will merge (new tiles will spawn)
        if (willPulledTilesMerge) {
          devLog('🧲 Pulled tiles will merge - this is NOT last merge (new tiles will spawn), clearing _isLastMerge flag');
          // Clear the flag since new tiles will spawn
          (dst as any)._isLastMerge = false;
          // Don't trigger clean board - pulled tiles merge will handle spawn and endgame check
        }
        
        // Use multiplier for spawning new tiles
        let spawnMult = mult;
        
        // 🔥 SOURCE OF TRUTH: Wild Juice & Wild Star spawn logic
        // Case A — Board continues: Apply wild effect normally, after Merge-6, respect Single Spawn Rule (1 tile on merge cell)
        // Case B — Board ends: If Merge-6 is the finishing state, trigger CLEAN BOARD, do NOT spawn a new tile
        // 🔥 CRITICAL: If final merge-6 (_isLastMerge flag), do NOT spawn (handled above by early return)
        // 🔥 CRITICAL: If endgame mode (no locked tiles), spawn ONLY 1 tile (handled by shouldSpawnAtDst logic)
        // This code only handles reducing spawnMult for wild merges in endgame mode (if not final merge-6)
        const isWildMergeForMultFix =
          isSpecialDiceDirectWildLikeTile(src, srcSpecial) ||
          isSpecialDiceDirectWildLikeTile(dst, dstSpecial);
        const wildEndgameSpawnMultDecision = resolveWildEndgameSpawnMult({
          spawnMult,
          isWildMerge: isWildMergeForMultFix,
          lockedEmptyPlaceholderCount: tiles.filter(isLockedEmptyPlaceholder).length,
          isLastMerge: isLastMergeFlagSet,
        });
        if (wildEndgameSpawnMultDecision.reducedToSingleSpawn) {
          devLog('🔥 SOURCE OF TRUTH: Wild merge in endgame mode → reducing spawnMult from', spawnMult, 'to 1 (Single Spawn Rule)');
        }
        spawnMult = wildEndgameSpawnMultDecision.spawnMult;
        
        // 🔥 CRITICAL: Check if spawnMult is valid before proceeding
        if (!spawnMult || spawnMult <= 0) {
          devWarn('⚠️ SPAWN BLOCKED: spawnMult is invalid:', spawnMult, 'mult:', mult);
          // This merge has already consumed src and converted dst to a passive
          // value-6. Retire that exact owned residue before releasing the
          // transaction; a malformed multiplier must never strand gameplay.
          try {
            if (dst && !dst.destroyed) removeTile(dst);
          } catch {}
          releaseSpecialDiceTransaction(specialTransactionToken, 'merge6-invalid-spawn-mult');
          scheduleOwnedMergeRecoveryCheck(0.12, 'merge6-invalid-spawn-mult');
          return;
        }
        
        const merge6SpawnFinale = getSpecialDiceFinaleFlagsForMerge({
          src,
          dst,
          srcSpecial: srcSpecialMerge6,
          dstSpecial: dstSpecialMerge6,
        });
        // Entry serialization prevents both regular and special overlap. Keep a
        // post-mutation recovery guard as defense in depth for lifecycle races.
        const isWildMerge6 = merge6SpawnFinale.isWild;
        if (merge6SpawnInProgress) {
          devWarn('🚨 MERGE-6 invariant recovery: a prior spawn owner appeared after acceptance');
          // Entry serialization should make this unreachable. If an external
          // lifecycle nevertheless changes ownership mid-flight, remove the
          // already-mutated exact destination instead of returning with a
          // frozen regular or special value-6.
          try {
            if (dst && !dst.destroyed) removeTile(dst);
          } catch {}
          releaseSpecialDiceTransaction(specialTransactionToken, 'merge6-late-spawn-owner-conflict');
          scheduleOwnedMergeRecoveryCheck(0.12, 'merge6-late-spawn-owner-conflict');
          return;
        } else {
          merge6SpawnOwnerToken = ++merge6SpawnOwnerSequence;
          activeMerge6SpawnOwnerToken = merge6SpawnOwnerToken;
          merge6SpawnInProgress = true;
          lastEndgameBoardMutationAt = Date.now();
          devLog('✅ Set merge6SpawnInProgress = true to prevent duplicate spawns');
          clearMerge6SpawnResetTimer();
          const resetOwnerToken = merge6SpawnOwnerToken;
          merge6SpawnResetTimer = trackDelayedCall(2.5, () => {
            if (merge6SpawnInProgress && activeMerge6SpawnOwnerToken === resetOwnerToken) {
              // Diagnostics only. Never release gameplay mutation ownership on
              // wall-clock time while the old async spawn coroutine can still
              // resume and mutate the board. Completion/error/navigation owns
              // the actual reset.
              devWarn('⚠️ merge6 spawn exceeded 2.5s; retaining immutable owner until settlement', {
                merge6SpawnOwnerToken: resetOwnerToken,
              });
            }
            if (activeMerge6SpawnOwnerToken === resetOwnerToken) {
              merge6SpawnResetTimer = null;
            }
          });
        }
        
        // 🔥 CRITICAL: Get pulled cells from dst tile to exclude from normal spawn
        // Only valid for wild-magnet merges; stale flags can block spawns in regular merges.
        let pulledCells = (dst as any)?._wildMagnetPulledCells || [];
        if (!isWildMagnet) {
          // Stale magnet data should never affect regular merge spawns
          pulledCells = [];
          if ((dst as any)?._wildMagnetPulledCells) {
            delete (dst as any)._wildMagnetPulledCells;
          }
        }
        const pulledCellsSet = new Set<string>(pulledCells.map((cell: { c: number; r: number }) => `${cell.c},${cell.r}`));
        
        // 🔥 DEBUG: Detailed spawn check for all merge-6 types
        const mergeType = !wildActive ? 'regular-regular' :
                         merge6SpawnFinale.isStar ? 'wild-regular' :
                         merge6SpawnFinale.isJuice ? 'wild-juice-regular' :
                         merge6SpawnFinale.isMagnet ? 'wild-magnet-regular' :
                         merge6SpawnFinale.isTnt ? 'wild-tnt-regular' : 'unknown';
        
        const activeTilesCount = tiles.filter(tileIsActive).length;
        
        devLog('🎯🎯🎯 SPAWN CHECK FOR MERGE-6:', {
          mergeType,
          srcSpecial,
          dstSpecial,
          spawnMult,
          mult,
          wasWild: wildActive,
          isWildJuice: merge6SpawnFinale.isJuice,
          isWildMagnet: merge6SpawnFinale.isMagnet,
          isWild: merge6SpawnFinale.isStar,
          willSpawn: spawnMult > 0,
          activeTilesCount,
          isLastMergeFlagSet,
          isFinalRegularMerge6Snapshot,
          isFinalMergeByResolver,
          _wasWildMerge: (dst as any)?._wasWildMerge
        });
        
        devLog('🎯 Spawning new tiles with multiplier:', spawnMult);
        devLog('🎯 Excluding pulled cells from spawn:', pulledCells);
        devLog('🎯 Wild merge target (for smart spawn):', wildMergeTarget);
        devLog('🎯 Merge type check:', {
          srcSpecial,
          dstSpecial,
          wasWild: wildActive,
          isWildJuice: merge6SpawnFinale.isJuice,
          isWildMagnet: merge6SpawnFinale.isMagnet,
          isWild: merge6SpawnFinale.isStar
        });
        
        // 🔥 SOURCE OF TRUTH: Endgame Mode Detection
        // Endgame mode begins when: There are no available locked / armored slots left for spawning new normal dice
        // 🔥 CRITICAL: Check if there are locked tiles available for spawn (excluding placeholder at dst position)
        // 🔥 BUG FIX: Count ALL locked tiles (not just value<=0) - must match level-flow.ts openLockedBounceParallel.
        // Locked tiles with value>0 (e.g. from wild merge) are openable; excluding them caused false isEndgameMode
        // and only 1 spawn when randomEmptyCell returned null (it doesn't consider locked value>0 as "empty").
        // Use raw locked tiles for endgame detection (scale can be missing on some locked tiles)
        const lockedTilesRaw = tiles.filter(t => t && !t.destroyed && t.locked);
        const lockedTiles = lockedTilesRaw.filter((t: any) => t && (t as any).scale);
        const placeholderHolderRef = (dst as any)?._placeholderHolder;
        
        // Filter out placeholder at dst position and pulled cells
        const availableLockedTiles = lockedTilesRaw.filter((t: any) => {
          if (!t || t.destroyed) return false;
          // Exclude placeholder at dst position
          if (placeholderHolderRef && t === placeholderHolderRef) {
            return false;
          }
          // Exclude pulled cells
          if (typeof t.gridX === 'number' && typeof t.gridY === 'number') {
            const cellKey = `${t.gridX},${t.gridY}`;
            return !pulledCellsSet.has(cellKey);
          }
          return true;
        });
        
        // 🔥 SOURCE OF TRUTH: Endgame Mode = no available locked tiles
        const isEndgameMode = availableLockedTiles.length === 0;
        
        // 🔥 DEBUG: Log endgame mode detection
        devLog('🎮 ENDGAME CHECK:', {
          lockedTilesCount: lockedTilesRaw.length,
          spawnableLockedTilesCount: lockedTiles.length,
          availableLockedTilesCount: availableLockedTiles.length,
          isEndgameMode,
          totalActiveTiles: tiles.filter(t => t && !t.destroyed && !t.locked).length,
          spawnMult
        });

        const isRegularMerge6 = !merge6SpawnFinale.isWild;
        const isWildMagnetMerge6Spawn = merge6SpawnFinale.isMagnet;
        const isWildTntMerge6Spawn = merge6SpawnFinale.isTnt;
        const isWildJuiceMerge6Spawn = merge6SpawnFinale.isJuice;
        const isWildStarMerge6Spawn = merge6SpawnFinale.isStar;
        const isArcadeSimpleWildMergeSpawn =
          isArcadeHomeRunMode() &&
          isWildMerge6 &&
          !isWildMagnetMerge6Spawn;
        const magnetWillPullBeforeSpawn =
          (srcSpecialMerge6 === 'wild-magnet' || dstSpecialMerge6 === 'wild-magnet') &&
          (
            ((dst as any)?._willPullTiles === true && (dst as any)?._noTilesPulled !== true) ||
            (dst as any)?._wildMagnetPulledTilesMerge === true ||
            (((dst as any)?._hasTilesToPull === true) && getPlayableMagnetPullCandidates({
              tiles: collectBoardGameplayTiles(),
              src,
              dst,
              magnetTile: isSpecialDiceMagnetLikeTile(src, srcSpecialMerge6) ? src : dst,
            }).length > 0)
          );
        const spawnGuardBeforeMerge6Spawn = resolveFinalMergeSpawnGuard({
          activeTilesBeforeMerge,
          finalMergeBlockersBefore,
          src,
          dst,
          effSum,
          srcIsWild: isWildLikeSpecial(srcSpecialMerge6),
          dstIsWild: isWildLikeSpecial(dstSpecialMerge6),
          magnetWillPull: magnetWillPullBeforeSpawn,
        });
        const isFinalWildSnapshotBeforeSpawn = (() => {
          const srcWasWild = isWildLikeSpecial(srcSpecialMerge6);
          const dstWasWild = isWildLikeSpecial(dstSpecialMerge6);
          const oneWasWild = srcWasWild !== dstWasWild;
          if (!oneWasWild) return false;
          if (spawnGuardBeforeMerge6Spawn.shouldBlockSpawn && spawnGuardBeforeMerge6Spawn.reason === 'wild-final-pair') return true;
          return isFinalWildLastTwo && finalMergeBlockersBefore.length === 0 && !magnetWillPullBeforeSpawn;
        })();

        const getWildStarOrbitCountForSpawn = (): number => {
          const savedPositionsCount = Array.isArray(savedStarPositionsEarly)
            ? savedStarPositionsEarly.filter(Boolean).length
            : 0;
          const savedSystemCount = Array.isArray((savedStarSystemEarly as any)?.stars)
            ? (savedStarSystemEarly as any).stars.filter(Boolean).length
            : 0;
          const liveSystemCount = Array.isArray((wildStarTileForAnimation as any)?._wildStarSystem?.stars)
            ? (wildStarTileForAnimation as any)._wildStarSystem.stars.filter(Boolean).length
            : 0;
          const count = savedPositionsCount || savedSystemCount || liveSystemCount || 3;
          return Math.max(1, Math.min(3, count | 0));
        };
        const wildStarOrbitCountForSpawn = isWildStarMerge6Spawn ? getWildStarOrbitCountForSpawn() : 0;

        // 🔥 Wild-merge bonus:
        // - wild star: 3 orbits => +9 locked/open 3, 2 orbits => +7 locked/open 2, 1 orbit => +5 locked/open 1
        // - TNT / magnet: +9 locked
        // - wild juice: +3 locked
        const wildMergeSpawnBonus = resolveWildMergeSpawnBonus({
          isWildMerge: isWildMerge6,
          isLastMerge: isLastMergeFlagSet,
          isArcadeSimpleWildMergeSpawn,
          isFinalWildSnapshotBeforeSpawn,
          isJuice: isWildJuiceMerge6Spawn,
          isStar: isWildStarMerge6Spawn,
          isMagnet: isWildMagnetMerge6Spawn,
          isTnt: isWildTntMerge6Spawn,
          starOrbitCount: wildStarOrbitCountForSpawn,
        });
        const wildMergeLockedBonusCount = wildMergeSpawnBonus.lockedBonusCount;
        
        // 🔥 BUG FIX (Journey / magnet / locked boards): Do NOT spawn-at-dst just because activeTilesCount ≤ 3.
        // While ANY spawnable locked tiles exist (isEndgameMode === false), merge-6 must STAY on the board and
        // new cubes must come from openLockedBounceParallel / randomEmptyCell. Old logic replaced merge 6 with
        // a fresh spawn at the same cell → removed the 6, broke visuals (ghost/no pips), false fail screen.
        // Spawn-at-merge-cell is ONLY for true endgame: no available locked placeholders left to open.
        const { shouldSpawnAtDst } = resolveMerge6SpawnMode({
          isLastMerge: isLastMergeFlagSet,
          isFinalMergeByResolver,
          spawnMult,
          isEndgameMode,
          isArcadeSimpleWildMergeSpawn,
        });

        const triggerFinalMergeCleanBoardFromMergeGuard = async (guardReason: string): Promise<void> => {
          // This fallback runs after the merge-6 mutation turn was claimed. A
          // final result must release every gameplay owner before handing the
          // board to the modal/score flow; otherwise Success can coexist with a
          // stale spawn owner or special input lock.
          if (regularMerge6CleanupToken !== null && dst) {
            merge6DestinationCleanupOwner.release(dst, regularMerge6CleanupToken);
            regularMerge6CleanupToken = null;
          }
          if (merge6SpawnOwnerToken !== null) {
            const releasedSpawnOwner = resetMerge6SpawnState(`final-merge-guard:${guardReason}`, {
              specialTransactionToken,
              merge6SpawnOwnerToken,
            });
            if (!releasedSpawnOwner) {
              throw new Error(`Unable to release merge-6 owner for final guard: ${guardReason}`);
            }
            merge6SpawnOwnerToken = null;
          } else {
            releaseSpecialDiceTransaction(
              specialTransactionToken,
              `final-merge-guard:${guardReason}`,
            );
          }
          try { releaseSpecialDiceResolution(src); } catch {}
          try { releaseSpecialDiceResolution(dst); } catch {}
          const guardFinalMergeFx = getSpecialDiceFinaleFxForMerge({
            src,
            dst,
            srcSpecial: srcSpecialMerge6,
            dstSpecial: dstSpecialMerge6,
          });
          const guardFinalSpecialDiceVariant = getSpecialDiceVariantForTile(src) || getSpecialDiceVariantForTile(dst);
          const finalReason = getFinalMergeCleanBoardReason(guardFinalMergeFx);
          if (isArcadeHomeRunMode()) {
            await prepareArcadeStageClearFinalMergeHandoff(
              finalReason,
              `final-merge-guard:${guardReason}`,
              createFinalMergeVisualStarters(dst, guardFinalSpecialDiceVariant)
            );
          } else {
            await prepareFinalMergeVisualHandoff(
              finalReason,
              `final-merge-guard:${guardReason}`,
              {
                ...createFinalMergeVisualStarters(dst, guardFinalSpecialDiceVariant),
                finalMergeSnapshot,
              }
            );
          }
          await triggerCleanBoardFlow(finalReason, { finalMergeSnapshot });
        };

        // Fallback safety: if last-merge flag was missed, but board effectively has only merge-6 left,
        // do not run any spawn/open logic; trigger clean-board flow instead.
        const maybeForceCleanBoardFromSingleMerge6 = async (reason: string): Promise<boolean> => {
          if (busyEnding) return true;
          const currentBlockers = getFinalMergeTileSets({
            tiles: collectBoardGameplayTiles(),
            src,
            dst,
          }).finalMergeBlockersBefore;
          if (currentBlockers.length > 0) return false;
          const activeNow = collectBoardGameplayTiles().filter(tileIsActive);
          const onlyDstMerge6Remains =
            !!dst &&
            !dst.destroyed &&
            (dst.value | 0) === 6 &&
            activeNow.length === 1 &&
            activeNow[0] === dst;
          if (!onlyDstMerge6Remains) return false;
          devWarn('🚨 MERGE-6 SPAWN GUARD: only merge-6 remains, forcing clean-board flow', {
            reason,
            activeNow: activeNow.length,
            dstValue: dst ? (dst.value | 0) : null,
            lastMergeFlag: (dst as any)?._isLastMerge === true,
          });
          cancelPendingWildContinuation(`final_single_merge6_guard_${reason}`);
          (dst as any)._isLastMerge = true;
          setFinalMergeVisualSuppression(true, { preserveGhosts: true });
          await triggerFinalMergeCleanBoardFromMergeGuard(`spawn_guard_${reason}`);
          return true;
        };

        const maybeForceCleanBoardFromPreSpawnFinalMerge = async (reason: string): Promise<boolean> => {
          if (busyEnding) return true;
          const srcWasWild = isWildLikeSpecial(srcSpecialMerge6);
          const dstWasWild = isWildLikeSpecial(dstSpecialMerge6);
          const otherPlayableNow = getFinalMergeTileSets({
            tiles: collectBoardGameplayTiles(),
            src,
            dst,
          }).finalMergeBlockersBefore;
          const decision = resolvePreSpawnFinalMergeCompletion({
            spawnGuardDecision: spawnGuardBeforeMerge6Spawn,
            srcWasWild,
            dstWasWild,
            effSum,
            isFinalWildLastTwo,
            otherPlayableCount: otherPlayableNow.length,
          });
          if (!decision.shouldComplete) return false;

          devWarn('🚨 FINAL MERGE GUARD: final merge detected before spawn, forcing clean-board flow', {
            reason,
            decision,
            srcSpecial: srcSpecialMerge6,
            dstSpecial: dstSpecialMerge6,
            srcValue: src ? (src.value | 0) : null,
            dstValue: dst ? (dst.value | 0) : null,
            effSum,
            activeSnapshot: activeTilesBeforeMerge.map((t: any) => ({
              value: t ? (t.value | 0) : null,
              special: t?.special ?? null,
              locked: t?.locked === true,
            })),
            otherPlayableNow: otherPlayableNow.length,
          });

          const guardPrefix = decision.reason === 'final-regular-pair' ? 'final_regular_guard' : 'final_wild_guard';
          cancelPendingWildContinuation(`${guardPrefix}_${reason}`);
          try { (dst as any)._isLastMerge = true; } catch {}
          try { (src as any)._isLastMerge = true; } catch {}
          if (decision.reason === 'final-regular-pair') {
            try { setPendingCleanBoard(boardNumber); } catch {}
          }
          setFinalMergeVisualSuppression(true, { preserveGhosts: true });
          await triggerFinalMergeCleanBoardFromMergeGuard(`${guardPrefix}_${reason}`);
          return true;
        };

        if (await maybeForceCleanBoardFromPreSpawnFinalMerge('pre_spawn')) return;

        /** Wild star merge opens k extra locked tiles — must run AFTER primary wild openLockedBounceParallel finishes (no parallel race on same locks). */
        const runWildStarExtraLockedOpens = async (): Promise<void> => {
          if (await maybeForceCleanBoardFromPreSpawnFinalMerge('wild_star_extra_locked')) return;
          if (await maybeForceCleanBoardFromSingleMerge6('wild_star_extra_locked')) return;
          if (isArcadeSimpleWildMergeSpawn) return;
          if (!isWildMerge6 || isLastMergeFlagSet || isWildMagnetMerge6Spawn || isWildTntMerge6Spawn) return;
          const wildExtraActiveCount = wildMergeSpawnBonus.extraActiveCount;
          if (wildExtraActiveCount <= 0) return;
          const wildSpawnExcludeCells = shouldSpawnAtDst
            ? new Set([...pulledCellsSet, `${gx},${gy}`])
            : pulledCellsSet;
          try {
            await FLOW.openLockedBounceParallel({
              tiles: Array.isArray(STATE.tiles) ? STATE.tiles : tiles,
              k: wildExtraActiveCount,
              drag,
              makeBoard,
              gsap,
              drawBoardBG,
              TILE,
              fixHoverAnchor,
              spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
              wildMergeTarget,
              excludeCells: wildSpawnExcludeCells,
              // Same as regular merge-6: if merge cell still has a locked placeholder, open it first (exclude wins if dst excluded)
              preferCells: new Set<string>([`${gx},${gy}`]),
            } as any);
          } catch (err) {
            if (err instanceof FLOW.LevelFlowCancelledError) throw err;
            devWarn('⚠️ Wild merge extra spawn failed:', err);
          }
        };

        const scheduleSpawnOpacitySafetySweep = () => {
          const runSpawnVisualSafetySweep = (label: string) => {
            try {
              repairBoardTileVisuals('spawn-opacity-safety');
              let fixed = 0;
              for (const t of tiles) {
                if (!t || t.destroyed) continue;
                if ((t as any)._ccWildSpawnDropping === true) continue;
                const sx = Number.isFinite((t as any).scale?.x) ? (t as any).scale.x : 1;
                const sy = Number.isFinite((t as any).scale?.y) ? (t as any).scale.y : 1;
                if (t.visible !== false && Math.min(sx, sy) < 0.86) {
                  try { gsap?.killTweensOf?.((t as any).scale); } catch {}
                  try {
                    if ((t as any).scale?.set) (t as any).scale.set(1, 1);
                    else if ((t as any).scale) {
                      (t as any).scale.x = 1;
                      (t as any).scale.y = 1;
                    }
                  } catch {}
                  try { (t as any)._isBeingSpawned = false; } catch {}
                  try { makeBoard?.syncTileZIndex?.(t, board); } catch {}
                  try { fixHoverAnchor?.(t); } catch {}
                  if (!t.locked && (t.value | 0) > 0 && drag && typeof drag.bindToTile === 'function') {
                    try { drag.bindToTile(t); } catch {}
                  }
                  fixed++;
                }
                // Nearly invisible locked ice (race with FX) — restore faint locked alpha
                if (
                  t.locked &&
                  ((t.value | 0) <= 0) &&
                  t.visible !== false &&
                  ((t.alpha ?? 1) < 0.08)
                ) {
                  t.alpha = 0.2;
                  fixed++;
                }
                if (t.locked || (t.value | 0) <= 0) continue;
                const spec = (t as any).special;
                if (isWildLikeSpecial(spec)) continue;
                if ((t.alpha ?? 1) < 0.99) {
                  t.alpha = 1;
                  if ((t as any).rotG) (t as any).rotG.alpha = 1;
                  if ((t as any).base) (t as any).base.alpha = 1;
                  if ((t as any).overlay) {
                    (t as any).overlay.alpha = 1;
                    (t as any).overlay.visible = false;
                  }
                  if ((t as any).num) (t as any).num.alpha = 1;
                  if ((t as any).pips) (t as any).pips.alpha = 1;
                  fixed++;
                }
                const p = (t as any).pips;
                if (p && !p.destroyed && (t.value | 0) > 0 && p.visible === false) {
                  p.visible = true;
                  fixed++;
                }
              }
              if (fixed > 0) devLog('[SPAWN-VISUAL] Safety sweep:', label, 'fixed', fixed, 'tiles');
            } catch {}
          };
          trackAppTimeout(() => runSpawnVisualSafetySweep('600ms'), 600);
          trackAppTimeout(() => runSpawnVisualSafetySweep('1200ms'), 1200);
        };

        if (shouldSpawnAtDst) {
          const endgameSpawnCount = 1; // Endgame: always 1 at merge cell (regular + wild)
          pendingMandatoryMergeCellSpawn = {
            c: gx | 0,
            r: gy | 0,
            expiresAt: Date.now() + 2500
          };
          devLog('🎯🎯🎯 END-GAME/LOW-TILE SPAWN: spawning', endgameSpawnCount, 'tile(s) at merge-6 cell (', gx, ',', gy, ')');
          devLog('🎯 Spawn-at-dst reason:', {
            isEndgameMode,
            isArcadeSimpleWildMergeSpawn,
            activeTilesCount,
            note: isArcadeSimpleWildMergeSpawn
              ? 'arcade wild merge-6 simple spawn: one fresh tile at merge cell'
              : 'merge-cell spawn only when no locked tiles left to open',
          });
          
          // Remove placeholder if it exists (we'll spawn active tile instead)
          if (placeholderHolderRef && !placeholderHolderRef.destroyed) {
            devLog('🧹 Removing placeholder before spawning active tile at dst position');
            if (placeholderHolderRef.gridX !== undefined && placeholderHolderRef.gridY !== undefined && grid && grid[placeholderHolderRef.gridY]) {
              grid[placeholderHolderRef.gridY][placeholderHolderRef.gridX] = null;
            }
            removeTile(placeholderHolderRef);
            (dst as any)._placeholderHolder = undefined;
          }
          
          const spawnC = gx;
          const spawnR = gy;
          
          // Force-clear grid position before spawn
          if (grid && grid[spawnR] && grid[spawnR][spawnC]) {
            const tileAtPos = grid[spawnR][spawnC];
            if (tileAtPos) {
              devLog('🧹 END-GAME SPAWN: Force-clearing cell before spawn');
              grid[spawnR][spawnC] = null;
              if (!tileAtPos.destroyed && tiles.includes(tileAtPos)) removeTile(tileAtPos);
            }
          }
          
          trackAppTimeout(() => {
            const forceClearSpawnCell = () => {
              if (grid && grid[spawnR] && grid[spawnR][spawnC]) {
                const existing = grid[spawnR][spawnC];
                if (existing) {
                  grid[spawnR][spawnC] = null;
                  if (!existing.destroyed && tiles.includes(existing)) removeTile(existing);
                }
              }
              // Also scrub any lingering tile that still claims the spawn coords (even if grid was cleared)
              for (const t of tiles) {
                if (!t || t.destroyed) continue;
                if ((t.gridX | 0) === (spawnC | 0) && (t.gridY | 0) === (spawnR | 0)) {
                  try { removeTile(t); } catch {}
                  break;
                }
              }
            };
            const hardSpawnAtCell = () => {
              return hardFallbackSpawnAtCell(spawnC, spawnR, {
                wildMergeTarget,
                clearExisting: false,
                reason: 'endgame-spawn-hard-fallback',
              });
            };
            const runSpawn = () => {
              forceClearSpawnCell();
              return openAtCell(spawnC, spawnR, {
                value: (wildMergeTarget ? randomRegularTileValue(wildMergeTarget) : null),
                skipBind: false,
                timeScale: 2.0,
                forceFreshPlaceholder: true,
              });
            };
          const doEndgameSpawns = async () => {
            if (await maybeForceCleanBoardFromPreSpawnFinalMerge('endgame_before_spawn')) return;
            if (await maybeForceCleanBoardFromSingleMerge6('endgame_before_spawn')) return;
            let firstResult = await runSpawn();
            if (!firstResult) {
              forceClearSpawnCell();
              firstResult = await runSpawn();
            }
            if (!firstResult) {
              devWarn('⚠️ END-GAME SPAWN: Retry failed at (', spawnC, ',', spawnR, ')', '- forcing hard spawn');
              const hardOk = hardSpawnAtCell();
              if (!hardOk) devWarn('⚠️ END-GAME SPAWN: hard spawn also failed at (', spawnC, ',', spawnR, ')');
            }
            const hasActiveTileAtMergeCell = () => {
              return tiles.some((t: any) => {
                if (!t || t.destroyed) return false;
                if ((t.gridX | 0) !== (spawnC | 0) || (t.gridY | 0) !== (spawnR | 0)) return false;
                return tileIsActive(t as any);
              });
            };
            if (!hasActiveTileAtMergeCell()) {
              devWarn('🚨 END-GAME/LOW-TILE SPAWN VERIFY: merge cell still empty, forcing hard spawn at dst');
              const forcedOk = hardSpawnAtCell();
              if (!forcedOk) {
                devWarn('🚨 END-GAME/LOW-TILE SPAWN VERIFY: hard spawn failed, attempting final retry via openAtCell');
                await runSpawn();
              }
            }
            if (hasActiveTileAtMergeCell()) {
              pendingMandatoryMergeCellSpawn = null;
            }
            if (await maybeForceCleanBoardFromSingleMerge6('endgame_after_spawn')) return;
            // 🔥 WILD-JUICE ENDGAME: ensure total 3 active tiles (1 at dst + 2 extra)
            const isWildJuiceMerge6 = merge6SpawnFinale.isJuice;
            const isWildMerge6Local = merge6SpawnFinale.isWild;
            if (!isArcadeSimpleWildMergeSpawn && isWildMerge6Local && isWildJuiceMerge6) {
              const extraExclude: { r: number; c: number }[] = [{ r: spawnR, c: spawnC }];
              for (let i = 0; i < 2; i++) {
                const extraCell = randomEmptyCell(extraExclude);
                if (extraCell) {
                  extraExclude.push({ r: extraCell.r, c: extraCell.c });
                  await openAtCell(extraCell.c, extraCell.r, {
                    value: wildMergeTarget ? randomRegularTileValue(wildMergeTarget) : null,
                    skipBind: false,
                    timeScale: 2.0,
                    forceFreshPlaceholder: true,
                  });
                } else {
                  devLog('🎯 END-GAME WILD-JUICE: No empty cell for extra active spawn');
                }
              }
            }
            if (!isArcadeSimpleWildMergeSpawn) {
              await runWildStarExtraLockedOpens();
            }
            scheduleSpawnOpacitySafetySweep();
          };
            doEndgameSpawns().catch((err) => devWarn('⚠️ END-GAME SPAWN: Error:', err)).finally(() => {
              resetMerge6SpawnState('endgame-spawn-finally', {
                releaseSpecialTransaction: specialTransactionKind !== 'tnt',
                specialTransactionToken,
                merge6SpawnOwnerToken,
              });
            });
          }, 50);
        } else {
          // NORMAL MODE: NEW SIMPLE LOGIC for regular merge-6
          // Always spawn tiles on RANDOM locked tiles (not at merge cell).
          // Regular merge-6: base 2, but if stack is bigger, spawn up to 3.
          if (isRegularMerge6) {
            const regularSpawnCount = resolveRegularMerge6SpawnCount(spawnMult);
            const tilesForSpawn = Array.isArray(STATE.tiles) ? STATE.tiles : tiles;
            const spawnFromLocked = async () => {
              const preferMergeCellSet = new Set<string>([`${gx},${gy}`]);
              devWarn('🧪 DEBUG REGULAR_MERGE6_RANDOM_LOCKED_SPAWN: entered', {
                regularSpawnCount,
                spawnMult,
                pulledCellsExcluded: pulledCellsSet.size,
                lockedCandidates: tilesForSpawn.filter((t: any) => t && !t.destroyed && t.locked).length,
                mergeCell: { c: gx, r: gy },
              });

              const pickSpawnValue = () => randomRegularTileValue(wildMergeTarget || undefined);

              const remainingSpawnCount = Math.max(0, regularSpawnCount);

              const ensureMinimumActiveTilesAfterSpawn = async () => {
                const activeNow = tilesForSpawn.filter(tileIsActive).length;
                if (activeNow >= 2) return;
                devWarn('⚠️ NORMAL SPAWN SAFETY: Too few active tiles after merge-6 spawn, forcing one extra open', {
                  activeNow,
                  regularSpawnCount
                });
                const emergencyOpened = await FLOW.openLockedBounceParallel({
                  tiles: tilesForSpawn,
                  k: 1,
                  drag,
                  makeBoard,
                  gsap,
                  drawBoardBG,
                  TILE,
                  fixHoverAnchor,
                  spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
                  wildMergeTarget,
                  excludeCells: pulledCellsSet,
                  preferCells: preferMergeCellSet,
                } as any);
                if ((emergencyOpened || 0) > 0) return;

                const lockedForEmergency = getLockedSpawnCandidates(
                  tilesForSpawn,
                  pulledCellsSet,
                  { c: gx, r: gy }
                );
                const fallbackLocked = lockedForEmergency[0];
                if (!fallbackLocked) return;
                try {
                  fallbackLocked.locked = false;
                  try { makeBoard.syncTileZIndex?.(fallbackLocked, board); } catch {}
                  fallbackLocked.eventMode = 'static';
                  fallbackLocked.cursor = 'pointer';
                  resetTileToNormalState?.(fallbackLocked);
                  if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(fallbackLocked);
                  const emergencyValue = pickSpawnValue();
                  makeBoard?.setValue?.(fallbackLocked, emergencyValue, 0);
                  normalizeSpawnedTileVisual(fallbackLocked);
                  try { fixHoverAnchor?.(fallbackLocked); } catch {}
                  devWarn('🛡️ NORMAL SPAWN SAFETY: Forced unlock fallback succeeded');
                } catch (err) {
                  devWarn('⚠️ NORMAL SPAWN SAFETY: Forced unlock fallback failed', err);
                }
              };
              try {
                const excludeSetDebug = new Set([...pulledCellsSet]);
                const lockedRawDebug = tilesForSpawn.filter((t: any) => t && !t.destroyed && t.locked);
                const lockedWithScaleDebug = lockedRawDebug.filter((t: any) => t && (t as any).scale);
                const lockedExcludedDebug = lockedRawDebug.filter((t: any) => {
                  if (typeof t.gridX === 'number' && typeof t.gridY === 'number') {
                    return excludeSetDebug.has(`${t.gridX},${t.gridY}`);
                  }
                  return false;
                });
                devLog('🧪 SPAWN DEBUG (regular merge-6):', {
                  regularSpawnCount,
                  lockedRaw: lockedRawDebug.length,
                  lockedWithScale: lockedWithScaleDebug.length,
                  lockedExcluded: lockedExcludedDebug.length,
                  excludeCells: Array.from(excludeSetDebug).slice(0, 6),
                });
              } catch {}
              const forceUnlockLockedTiles = async (k: number) => {
                if (!k || k <= 0) return 0;
                const lockedCandidates = getLockedSpawnCandidates(
                  tilesForSpawn,
                  pulledCellsSet,
                  { c: gx, r: gy }
                );
                if (!lockedCandidates.length) return 0;
                let opened = 0;
                for (let i = 0; i < lockedCandidates.length && opened < k; i++) {
                  const t = lockedCandidates[i];
                  try {
                    t.locked = false;
                    try { makeBoard.syncTileZIndex?.(t, board); } catch {}
                    t.eventMode = 'static';
                    t.cursor = 'pointer';
                    resetTileToNormalState?.(t);
                    if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(t);
                    const spawnValue = pickSpawnValue();
                    makeBoard?.setValue?.(t, spawnValue, 0);
                    normalizeSpawnedTileVisual(t);
                    try { fixHoverAnchor?.(t); } catch {}
                    opened++;
                  } catch (err) {
                    devWarn('⚠️ FORCE UNLOCK failed:', err);
                  }
                }
                return opened;
              };
              let opened = await FLOW.openLockedBounceParallel({
                tiles: tilesForSpawn,
                k: remainingSpawnCount,
                drag,
                makeBoard,
                gsap,
                drawBoardBG,
                TILE,
                fixHoverAnchor,
                spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
                wildMergeTarget,
                excludeCells: pulledCellsSet,
                preferCells: preferMergeCellSet,
              } as any);
              if ((opened || 0) === 0 && remainingSpawnCount > 0) {
                devWarn('⚠️ NORMAL SPAWN: openLockedBounceParallel opened 0, forcing unlock of locked tiles');
                const forcedOpened = await forceUnlockLockedTiles(remainingSpawnCount);
                opened += (forcedOpened || 0);
              }
              const remainder = Math.max(0, remainingSpawnCount - (opened || 0));
              devLog(`🧪 SPAWN QA (regular): requested=${regularSpawnCount} opened=${opened || 0} remainder=${remainder}`);
              if (remainder > 0) {
                const excludeCells: { r: number; c: number }[] = [{ r: gy, c: gx }];
                for (let i = 0; i < remainder; i++) {
                  const cell = randomEmptyCell(excludeCells);
                  if (cell) {
                    excludeCells.push({ r: cell.r, c: cell.c });
                    await openAtCell(cell.c, cell.r, {
                      value: wildMergeTarget ? randomRegularTileValue(wildMergeTarget) : null,
                      skipBind: false,
                      timeScale: 2.0,
                      forceFreshPlaceholder: true,
                    });
                  } else {
                    devLog('🎯 NORMAL SPAWN: No empty cell found, opening 1 locked tile as fallback');
                    await FLOW.openLockedBounceParallel({
                      tiles: tilesForSpawn,
                      k: 1,
                      drag,
                      makeBoard,
                      gsap,
                      drawBoardBG,
                      TILE,
                      fixHoverAnchor,
                      spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
                      wildMergeTarget,
                      excludeCells: pulledCellsSet,
                      preferCells: preferMergeCellSet,
                    } as any);
                  }
                }
              }
              await ensureMinimumActiveTilesAfterSpawn();
              scheduleSpawnOpacitySafetySweep();
            };

            trackAppTimeout(() => {
              Promise.resolve()
                .then(spawnFromLocked)
                .catch((err) => devWarn('⚠️ NORMAL SPAWN: Error:', err))
                .finally(() => {
                  resetMerge6SpawnState('regular-spawn-finally', {
                    specialTransactionToken,
                    merge6SpawnOwnerToken,
                  });
                });
            }, 50);
          } else {
            // Non-regular (wild) normal mode: fresh tile at merge cell first, then locked opens (no preferCells unlock).
            const tilesForSpawn = Array.isArray(STATE.tiles) ? STATE.tiles : tiles;
            const pickSpawnValueWild = () => randomRegularTileValue(wildMergeTarget || undefined);

            const refillWildMergeCellFresh = async (): Promise<number> => {
              try {
                const at = tilesForSpawn.find((t: any) =>
                  t && !t.destroyed && (t.gridX | 0) === (gx | 0) && (t.gridY | 0) === (gy | 0)
                );
                if (at) {
                  const spec = (at as any).special;
                  const isActive = !at.locked && (
                    (at.value | 0) > 0 ||
                    isWildLikeSpecial(spec)
                  );
                  if (isActive) return 1;
                  try {
                    if (grid?.[gy]?.[gx] === at) grid[gy][gx] = null;
                    if (!at.destroyed && tilesForSpawn.includes(at)) removeTile(at);
                  } catch (err) {
                    devWarn('⚠️ WILD SPAWN: Failed to remove merge-6 placeholder', err);
                  }
                }
              } catch (err) {
                devWarn('⚠️ WILD SPAWN: merge cell prep failed', err);
              }
              try {
                const ok = await openAtCell(gx, gy, {
                  value: pickSpawnValueWild(),
                  skipBind: false,
                  timeScale: 2.0,
                  forceFreshPlaceholder: true,
                });
                return ok ? 1 : 0;
              } catch (err) {
                if (err instanceof OpenCellCancelledError) throw err;
                return 0;
              }
            };

            const excludeWildMerge = new Set([...pulledCellsSet, `${gx},${gy}`]);
            void (async () => {
              if (await maybeForceCleanBoardFromPreSpawnFinalMerge('wild_normal_before_spawn')) return;
              let mergeCellWild = 0;
              try {
                mergeCellWild = await refillWildMergeCellFresh();
                const kLocked = Math.max(0, (spawnMult | 0) - mergeCellWild);
                devLog('🚀 NORMAL SPAWN (wild): mergeCellFresh=', mergeCellWild, 'kLocked=', kLocked, 'spawnMult=', spawnMult, 'locked pool:', tilesForSpawn.filter((t: any) => t && !t.destroyed && t.locked).length);
                const openedCount = await FLOW.openLockedBounceParallel({
                  tiles: tilesForSpawn,
                  k: kLocked,
                  drag,
                  makeBoard,
                  gsap,
                  drawBoardBG,
                  TILE,
                  fixHoverAnchor,
                  spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
                  wildMergeTarget,
                  excludeCells: excludeWildMerge,
                } as any);
                const openedFromLocked = openedCount || 0;
                const opened = mergeCellWild + openedFromLocked;
                const remainder = spawnMult > 0 ? Math.max(0, spawnMult - opened) : 0;
                devLog(`🧪 SPAWN QA (wild/normal): requested=${spawnMult || 0} mergeCell=${mergeCellWild} lockedOpened=${openedFromLocked} total=${opened} remainder=${remainder}`);
                let remainderSpawned = 0;
                const ensureMinimumActiveTilesAfterSpawn = async () => {
                  const activeNow = (Array.isArray(STATE.tiles) ? STATE.tiles : tiles).filter(tileIsActive).length;
                  if (activeNow >= 2) return;
                  devWarn('⚠️ WILD/NORMAL SPAWN SAFETY: Too few active tiles after merge-6 spawn, forcing one extra open', {
                    activeNow,
                    spawnMult,
                    opened,
                    remainderSpawned
                  });
                  const emergencyOpened = await FLOW.openLockedBounceParallel({
                    tiles: Array.isArray(STATE.tiles) ? STATE.tiles : tiles,
                    k: 1,
                    drag,
                    makeBoard,
                    gsap,
                    drawBoardBG,
                    TILE,
                    fixHoverAnchor,
                    spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
                    wildMergeTarget,
                    excludeCells: excludeWildMerge,
                  } as any);
                  if ((emergencyOpened || 0) > 0) return;
                  const fallbackLocked = getLockedSpawnCandidates(Array.isArray(STATE.tiles) ? STATE.tiles : tiles)[0];
                  if (!fallbackLocked) return;
                  try {
                    fallbackLocked.locked = false;
                    try { makeBoard.syncTileZIndex?.(fallbackLocked, board); } catch {}
                    fallbackLocked.eventMode = 'static';
                    fallbackLocked.cursor = 'pointer';
                    resetTileToNormalState?.(fallbackLocked);
                    if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(fallbackLocked);
                    const emergencyValue = randomRegularTileValue(wildMergeTarget || undefined);
                    makeBoard?.setValue?.(fallbackLocked, emergencyValue, 0);
                    normalizeSpawnedTileVisual(fallbackLocked);
                    try { fixHoverAnchor?.(fallbackLocked); } catch {}
                    devWarn('🛡️ WILD/NORMAL SPAWN SAFETY: Forced unlock fallback succeeded');
                  } catch (err) {
                    devWarn('⚠️ WILD/NORMAL SPAWN SAFETY: Forced unlock fallback failed', err);
                  }
                };
                if (remainder > 0) {
                  logger.warn('🚀 NORMAL SPAWN: Spawning ' + remainder + ' remainder (opened ' + openedFromLocked + ' from locked)', 'app-core', { remainder, openedFromLocked });
                  const remainderPromises: Promise<boolean>[] = [];
                  const excludeCells: { r: number; c: number }[] = [{ r: gy, c: gx }];
                  for (let i = 0; i < remainder; i++) {
                    if (await waitTrackedResult(80 + i * 150) === 'cancelled') {
                      return;
                    }
                    let cell = randomEmptyCell(excludeCells);
                    if (cell) {
                      excludeCells.push({ r: cell.r, c: cell.c });
                      remainderPromises.push(openAtCell(cell.c, cell.r, {
                        value: wildMergeTarget ? randomRegularTileValue(wildMergeTarget) : null,
                        skipBind: false,
                        timeScale: 2.0
                      }).then((ok: any) => !!ok).catch((err: any) => {
                        if (err instanceof OpenCellCancelledError) throw err;
                        devWarn('⚠️ Remainder spawn error:', err);
                        return false;
                      }));
                    } else {
                      logger.warn('🚀 NORMAL SPAWN: No empty cell, opening 1 locked tile as fallback', 'app-core');
                      const extraOpened = await FLOW.openLockedBounceParallel({
                        tiles: Array.isArray(STATE.tiles) ? STATE.tiles : tiles,
                        k: 1,
                        drag,
                        makeBoard,
                        gsap,
                        drawBoardBG,
                        TILE,
                        fixHoverAnchor,
                        spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
                        wildMergeTarget,
                        excludeCells: excludeWildMerge,
                      } as any);
                      remainderSpawned += (extraOpened || 0);
                      if ((extraOpened || 0) === 0) {
                        devWarn('⚠️ NORMAL SPAWN: Fallback openLockedBounceParallel opened 0 – only 1 tile spawned');
                      }
                    }
                  }
                  const remainderResults = await Promise.all(remainderPromises);
                  remainderSpawned += remainderResults.filter(Boolean).length;
                }
                // 🔥 WILD-JUICE SAFETY: Ensure 2 active spawns always happen (even if locked/empty cells were unavailable).
                const isWildJuiceMerge6 = merge6SpawnFinale.isJuice;
                if (isWildJuiceMerge6 && spawnMult >= 2) {
                  let missing = Math.max(0, 2 - (opened + remainderSpawned));
                  if (missing > 0) {
                    devWarn('⚠️ WILD-JUICE: Active spawn shortfall detected - forcing extra spawns', {
                      opened,
                      remainderSpawned,
                      missing
                    });
                    const forceUnlockLockedTiles = async (k: number) => {
                      if (!k || k <= 0) return 0;
                      const lockedCandidates = getLockedSpawnCandidates(
                        tilesForSpawn,
                        new Set([...pulledCellsSet, `${gx},${gy}`])
                      );
                      if (!lockedCandidates.length) return 0;
                      let openedForced = 0;
                      for (let i = 0; i < lockedCandidates.length && openedForced < k; i++) {
                        const t = lockedCandidates[i];
                        try {
                          t.locked = false;
                          try { makeBoard.syncTileZIndex?.(t, board); } catch {}
                          t.eventMode = 'static';
                          t.cursor = 'pointer';
                          resetTileToNormalState?.(t);
                          if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(t);
                          const spawnValue = randomRegularTileValue(wildMergeTarget || undefined);
                          makeBoard?.setValue?.(t, spawnValue, 0);
                          normalizeSpawnedTileVisual(t);
                          try { fixHoverAnchor?.(t); } catch {}
                          openedForced++;
                        } catch (err) {
                          devWarn('⚠️ WILD-JUICE FORCE UNLOCK failed:', err);
                        }
                      }
                      return openedForced;
                    };
                    const forcedOpened = await forceUnlockLockedTiles(missing);
                    missing = Math.max(0, missing - forcedOpened);
                    while (missing > 0) {
                      const cell = randomEmptyCell([{ r: gy, c: gx }]);
                      if (!cell) break;
                      const ok = await openAtCell(cell.c, cell.r, {
                        value: wildMergeTarget ? randomRegularTileValue(wildMergeTarget) : null,
                        skipBind: false,
                        timeScale: 2.0
                      }).catch((err) => {
                        if (err instanceof OpenCellCancelledError) throw err;
                        return false;
                      });
                      if (!ok) break;
                      missing--;
                    }
                    if (missing > 0) {
                      devWarn('⚠️ WILD-JUICE: Unable to fill active spawn shortfall', { missing });
                    }
                  }
                }
                await ensureMinimumActiveTilesAfterSpawn();
                await runWildStarExtraLockedOpens();
                await ensureMinimumActiveTilesAfterSpawn();
                scheduleSpawnOpacitySafetySweep();
              } catch (err) {
                if (err instanceof OpenCellCancelledError) return;
                devWarn('⚠️ WILD SPAWN error:', err);
              } finally {
                resetMerge6SpawnState('wild-spawn-finally', {
                  releaseSpecialTransaction: specialTransactionKind !== 'tnt',
                  specialTransactionToken,
                  merge6SpawnOwnerToken,
                });
              }
            })();
          }
        }

        if (wildMergeLockedBonusCount > 0) {
          if (await maybeForceCleanBoardFromPreSpawnFinalMerge('wild_locked_bonus_before_spawn')) return;
          if (await maybeForceCleanBoardFromSingleMerge6('wild_locked_bonus_before_spawn')) return;
          if ((dst as any)?._isLastMerge === true || busyEnding) {
            devWarn('🚨 WILD LOCKED BONUS BLOCKED: final merge/clean-board active, skipping locked tile spawn', {
              wildMergeLockedBonusCount,
              isLastMergeFlagSet,
              isFinalWildSnapshotBeforeSpawn,
              busyEnding,
            });
            return;
          }
          devLog('🔒 Wild merge bonus: spawning locked tiles', wildMergeLockedBonusCount);
          // 🔥 ENDGAME: Exclude dst cell to prevent clash – we spawn 1 active tile there via openAtCell
          spawnLockedTilesWithPop(wildMergeLockedBonusCount, shouldSpawnAtDst ? [{ c: gx, r: gy }] : undefined);
          wildMergeLockedSpawnCount += 1;
        }

        // 🔥 CRITICAL FIX v40.1: Clean up unused placeholder if it wasn't used in spawn
        // Placeholder might not be used if spawnMult = 0 or if placeholder was excluded
        const placeholderHolderAfterSpawn = (dst as any)?._placeholderHolder;
        if (placeholderHolderAfterSpawn && !placeholderHolderAfterSpawn.destroyed) {
          // Check if placeholder is still locked (wasn't used in spawn)
          if (isLockedEmptyPlaceholder(placeholderHolderAfterSpawn)) {
            devLog('🧹 Cleaning up unused placeholder at (', placeholderHolderAfterSpawn.gridX, ',', placeholderHolderAfterSpawn.gridY, ')');
            
            // Remove from grid
            if (placeholderHolderAfterSpawn.gridX !== undefined && placeholderHolderAfterSpawn.gridY !== undefined && grid && grid[placeholderHolderAfterSpawn.gridY]) {
              grid[placeholderHolderAfterSpawn.gridY][placeholderHolderAfterSpawn.gridX] = null;
            }
            
            // Remove from tiles array
            removeTile(placeholderHolderAfterSpawn);
            
            devLog('✅ Unused placeholder removed successfully');
          } else {
            devLog('✅ Placeholder was used in spawn - no cleanup needed');
          }
          
          // Clear reference
          if (dst) {
            (dst as any)._placeholderHolder = undefined;
          }
        }
        
        // Post-spawn destination cleanup:
        // - merge-6 (except magnet-pull) removes dst after spawn choreography
        // - magnet-pull flow removes dst once pulled merge is completed
        
        // 🔥 CRITICAL: Use the EARLY stored flag value (saved before any code cleared it)
        // This ensures we correctly identify magnet pull merges even if flags were cleared
        // The flag was stored at the beginning of onComplete callback (line ~4975)
        const isMagnetPullMergeFinal = isMagnetPullMergeStored;

        // Utility: aggressively clear a tile reference from the grid even if gridX/gridY are missing or stale
        const clearTileFromGridSafe = (tile: any) => {
          return detachTileFromGrid(tile, grid);
        };

        // Remove any lingering locked/value0 placeholder artifact from merge cell.
        // In magnet branches, grid can briefly hold a placeholder object instead of dst.
        const clearMergeCellPlaceholderArtifact = () => {
          if (!grid || !grid[gy]) return;
          const atMergeCell = grid[gy][gx];
          if (!atMergeCell || atMergeCell === dst) return;
          if (!isLockedEmptyPlaceholder(atMergeCell)) return;
          grid[gy][gx] = null;
          if (!atMergeCell.destroyed && tiles.includes(atMergeCell)) {
            try { removeTile(atMergeCell); } catch {}
          }
          devLog('🧹 Removed lingering locked placeholder artifact from merge cell (magnet flow)');
        };

        const isWildTntMerge6 = merge6SpawnFinale.isTnt;
        const restoreSpecialMergeGhostAtMergeCell = (reason: string) => {
          if (!(wasWildMagnet || isWildTntMerge6)) return;
          if ((dst as any)?._isLastMerge === true || busyEnding) return;
          try {
            if (grid && grid[gy]) grid[gy][gx] = null;
            try { (window as any).__ccForceHideGhosts = false; } catch {}
            try {
              if (backgroundLayer) backgroundLayer.visible = true;
            } catch {}
            try { setGhostVisibility(gx, gy, true); } catch {}
            try { updateGhostVisibility(); } catch {}
            try { drawBoardBG?.(); } catch {}
            devLog(`👻 Restored ghost placeholder at special merge-6 cell (${gx}, ${gy}) after ${reason}`);
          } catch (err) {
            devWarn('⚠️ Failed to restore special merge ghost placeholder:', err);
          }
        };
        
        // 🔥 POJEDNOSTAVLJENO: Ako je magnet merge i NEMA pulled tiles merge, obriši merge 6 tile
        // Ovo pokriva SVE scenarije: hasTilesToPull=false, nearestTiles.length=0, validTiles.length=0
        const isMagnetMergeWithoutPull = wasWildMagnet && !isMagnetPullMergeFinal;
        
        if (isMagnetMergeWithoutPull && dst && !dst.destroyed) {
          devLog('🧲🧲🧲 MAGNET MERGE WITHOUT PULL - Removing merge 6 tile (simplified logic)');
          clearMergeCellPlaceholderArtifact();
          
          // 🔥 CRITICAL FIX: Ensure grid position is null before removing tile
          if (clearTileFromGridSafe(dst)) {
            devLog('🧹 Explicitly cleared grid position before removeTile');
          }
          
          // 🔥 CRITICAL FIX: Hide tile before removing to prevent visual glitches
          dst.visible = false;
          dst.alpha = 0;
          dst.eventMode = 'none';
          
          removeTile(dst); // Remove from tiles array
          clearMergeCellPlaceholderArtifact();
          devLog('✅ Merge 6 tile removed successfully (magnet merge without pull)');
          restoreSpecialMergeGhostAtMergeCell('magnet merge without pull');
          
          // Clean up flags
          if (dst && !dst.destroyed) {
            delete (dst as any)?._willPullTiles;
            delete (dst as any)?._noTilesPulled;
            delete (dst as any)?._wasWildMagnetMerge6;
          }
        } else if (!isMagnetPullMergeFinal && dst && !dst.destroyed) {
          // For regular/non-regular merge-6 (except magnet-pull), remove dst after spawn choreography.
          // In endgame spawn-at-dst mode, remove with small delay so fresh spawn can bind same cell first.
          if (shouldSpawnAtDst) {
            // In end game mode, remove dst tile after a short delay to allow spawn to happen first
            trackAppTimeout(() => {
              if (dst && !dst.destroyed) {
                devLog('🗑️ END-GAME: Removing dst tile after spawn is scheduled');
                if (clearTileFromGridSafe(dst)) {
                  devLog('🧹 Cleared grid position before removing dst tile');
                }
                dst.visible = false;
                dst.alpha = 0;
                dst.eventMode = 'none';
                removeTile(dst);
                devLog('✅ Dst tile removed after end game spawn');
              }
            }, 100); // Delay to allow spawn to happen first
          } else {
            // Normal mode: remove merge-6 destination tile immediately
            devLog('🗑️ Removing dst tile IMMEDIATELY (merge 6, not magnet pull)');
            
            // Never delete an arbitrary current cell owner: a newer merge/spawn may
            // already have claimed this coordinate. Only this dst or its own wild
            // placeholder belongs to the current cleanup transaction.
            if (grid && grid[gy] && grid[gy][gx]) {
              const atCell = grid[gy][gx];
              if (atCell === dst) {
                grid[gy][gx] = null;
              } else if (wasWild && isLockedEmptyPlaceholder(atCell)) {
                grid[gy][gx] = null;
                removeTile(atCell);
                devLog('🧹 Removed owned wild placeholder from merge 6 cell (normal path)');
              }
            }
            if (clearTileFromGridSafe(dst)) {
              devLog('🧹 Explicitly cleared grid position before removeTile');
            }
            
            if (regularMerge6CleanupToken !== null) {
              merge6DestinationCleanupOwner.release(dst, regularMerge6CleanupToken);
            }
            dst.visible = false;
            dst.alpha = 0;
            dst.eventMode = 'none';
            removeTile(dst);
            devLog('✅ Dst tile removed successfully');
            restoreSpecialMergeGhostAtMergeCell(isWildTntMerge6 ? 'wild-tnt merge' : 'special merge');
          }
          
          // Clean up flags
          if (dst && !dst.destroyed) {
            delete (dst as any)?._willPullTiles;
            delete (dst as any)?._noTilesPulled;
            delete (dst as any)?._wasWildMagnetMerge6;
          }
        } else if (isMagnetPullMergeFinal) {
          devLog('🧲 Magnet pull merge detected - removing merge 6 tile to prevent stuck value 6');
          clearMergeCellPlaceholderArtifact();
          
          // Remove merge-6 tile even for magnet pulls (after pulled merge is done)
          if (dst && !dst.destroyed) {
            if (clearTileFromGridSafe(dst)) {
              devLog('🧹 Cleared grid position for magnet pull merge dst');
            }
            dst.visible = false;
            dst.alpha = 0;
            dst.eventMode = 'none';
            removeTile(dst);
            clearMergeCellPlaceholderArtifact();
            devLog('✅ Magnet pull merge dst removed successfully');
            restoreSpecialMergeGhostAtMergeCell('magnet pull merge');
          }
          
          // Clean up flags
          if (dst) {
            delete (dst as any)?._wildMagnetPulledTilesMerge;
            delete (dst as any)?._wildMagnetMergeCallback;
            delete (dst as any)?._willPullTiles;
            delete (dst as any)?._noTilesPulled;
            delete (dst as any)?._wasWildMagnetMerge6;
          }
        }

        // 🛡️ FAILSAFE: If a wild-magnet merge6 tile is still lingering, force-remove it
        if (wasWildMagnet && dst && !dst.destroyed && STATE.tiles.includes(dst)) {
          clearMergeCellPlaceholderArtifact();
          clearTileFromGridSafe(dst);
          dst.visible = false;
          dst.alpha = 0;
          dst.eventMode = 'none';
          removeTile(dst);
          clearMergeCellPlaceholderArtifact();
          devWarn('🧲 FAILSAFE: Forced removal of lingering magnet merge-6 tile to prevent stuck value 6');
          restoreSpecialMergeGhostAtMergeCell('magnet merge failsafe');
        }
        
        // Clean up pulled cells flag after spawn
        if ((dst as any)?._wildMagnetPulledCells) {
          (dst as any)._wildMagnetPulledCells = undefined;
        }

        // 🔒 SAFETY: If only a plain merge-6 remains, remove it to prevent a stuck board
        try {
          const activeTiles = tiles.filter((t: any) => tileIsActive(t as any));
          if (activeTiles.length === 1) {
            const onlyTile = activeTiles[0];
            const isPlainMerge6 = (onlyTile.value | 0) === 6 && !onlyTile.special;
            if (isPlainMerge6) {
              const gxOnly = onlyTile.gridX | 0;
              const gyOnly = onlyTile.gridY | 0;
              if (grid && grid[gyOnly] && grid[gyOnly][gxOnly] === onlyTile) {
                grid[gyOnly][gxOnly] = null;
              }
              removeTile(onlyTile);
              devWarn('🧲 SAFETY: Removed lone plain merge-6 tile to prevent stuck board after magnet pull');
            }
          }
        } catch (err) {
          devWarn('⚠️ SAFETY check for lone merge-6 failed:', err);
        }
        
        // Update idle bounce tile list with newly spawned tiles
        if (TILE_IDLE_BOUNCE.ENABLE) {
          try {
            TILE_IDLE_BOUNCE.updateTileList(tiles);
            devLog('🔄 Updated idle bounce tile list after spawn');
          } catch (error) {
            devWarn('⚠️ Failed to update idle bounce tile list:', error);
          }
        }
        
        // 🔥 CRITICAL FIX: Skip checkLevelEnd if _isLastMerge flag is set (clean board flow already triggered)
        // This prevents fail screen from triggering when clean board flow is in progress
        const hasLastMergeFlagAfterSpawn = (dst as any)?._isLastMerge === true;
        if (hasLastMergeFlagAfterSpawn || busyEnding) {
          devLog('🚨🚨🚨 SKIPPING checkLevelEnd - _isLastMerge flag is TRUE or busyEnding is true (clean board flow in progress)');
          return;
        }
        
        // 🔥 CRITICAL BUG FIX: Don't wait for bubbles animation - it's just visual and shouldn't block end game check
        // Bubbles animation can run for 4+ seconds, which would delay fail screen detection
        // Instead, check end game immediately after spawn completes (with small delay for spawn animations)
        // This ensures stuck positions are detected even if user makes quick second merge during bubbles animation
        const isTntMergeForDelay = merge6SpawnFinale.isTnt;
        // 🔥 BUG FIX: openLockedBounceParallel spawns at 80ms + 0/100/200ms delays; spawnBounce ~240ms each → last tile ~520ms
        // Must wait long enough for all 3 wild bonus tiles to finish spawning before checkLevelEnd
        const postSpawnEndgameDelayMs = resolvePostSpawnEndgameDelayMs({ isTntMerge: isTntMergeForDelay });
        devLog(`⏳ Waiting ${postSpawnEndgameDelayMs}ms after spawn animations before endgame check...`, {
          isTntMergeForDelay
        });
        if (await waitTrackedResult(postSpawnEndgameDelayMs) === 'cancelled') return;

        // 🔥 SAFETY: Never allow a locked ghost placeholder to survive on merge cell after spawn cycle.
        try {
          const mergeCellTile = grid?.[gy]?.[gx];
          if (isLockedEmptyPlaceholder(mergeCellTile)) {
            grid[gy][gx] = null;
            if (tiles.includes(mergeCellTile)) {
              removeTile(mergeCellTile);
            }
            devWarn('🧹 Removed lingering locked placeholder from merge cell before endgame check');
          }
        } catch (err) {
          devWarn('⚠️ Failed to clean merge-cell placeholder before endgame check:', err);
        }

        // 🛡️ SAFETY: Never allow board to end up with < 2 active tiles unless clean board flow is active.
        try {
          const activeTilesNow = tiles.filter((t: any) => tileIsActive(t as any));
          if (activeTilesNow.length < 2) {
            const needed = 2 - activeTilesNow.length;
            devWarn('🛟 SAFETY: Active tiles below minimum after spawn, forcing extra spawn', {
              activeTiles: activeTilesNow.length,
              needed
            });
            const tilesForSpawn = Array.isArray(STATE.tiles) ? STATE.tiles : tiles;
            const opened = await FLOW.openLockedBounceParallel({
              tiles: tilesForSpawn,
              k: needed,
              drag,
              makeBoard,
              gsap,
              drawBoardBG,
              TILE,
              fixHoverAnchor,
              spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
              wildMergeTarget,
              excludeCells: pulledCellsSet,
              preferCells: new Set<string>([`${gx},${gy}`]),
            } as any);
            let remaining = Math.max(0, needed - (opened || 0));
            if (remaining > 0) {
              const excludeCells: { r: number; c: number }[] = activeTilesNow
                .filter((t: any) => typeof t.gridX === 'number' && typeof t.gridY === 'number')
                .map((t: any) => ({ r: t.gridY, c: t.gridX }));
              for (let i = 0; i < remaining; i++) {
                const cell = randomEmptyCell(excludeCells);
                if (!cell) break;
                excludeCells.push({ r: cell.r, c: cell.c });
                await openAtCell(cell.c, cell.r, {
                  value: wildMergeTarget ? randomRegularTileValue(wildMergeTarget) : null,
                  skipBind: false,
                  timeScale: 2.0
                });
              }
            }
          }
        } catch (err) {
          if (err instanceof FLOW.LevelFlowCancelledError || err instanceof OpenCellCancelledError) throw err;
          devWarn('⚠️ SAFETY: Failed to enforce minimum active tiles:', err);
        }
        
        // 🔥 CRITICAL: Check end game after spawn completes (with delay to allow animations)
        // Use checkLevelEnd which already has proper delay and handles all edge cases
        // This replaces the inline setTimeout check to avoid duplicate checks
        // NOTE: Bubbles animation continues in background - it doesn't block end game detection
        checkLevelEnd();
        } catch (error) {
          // GSAP does not observe rejected async onComplete callbacks. Without
          // this boundary, one failed FX/preload/spawn await can abandon the
          // accepted merge after both tiles were made noninteractive.
          devError('❌ Merge-6 async completion failed; retiring owned residue', error);
          try { if (src && !src.destroyed) removeTile(src); } catch {}
          try { if (dst && !dst.destroyed) removeTile(dst); } catch {}
          if (merge6SpawnOwnerToken !== null) {
            resetMerge6SpawnState('async-completion-error', {
              specialTransactionToken,
              merge6SpawnOwnerToken,
            });
          } else {
            releaseSpecialDiceTransaction(specialTransactionToken, 'merge6-async-completion-error');
          }
          scheduleOwnedMergeRecoveryCheck(0.12, 'merge6-async-completion-error');
        }
      },
      onInterrupt: () => {
        if (merge6AbsorbSettled) return;
        merge6AbsorbSettled = true;
        // Interruption can be a same-board tween kill or navigation cleanup.
        // Retire only the exact captured objects; never continue the spawn/FX
        // transaction from an interrupt callback.
        try { if (src && !src.destroyed) removeTile(src); } catch {}
        try { if (dst && !dst.destroyed) removeTile(dst); } catch {}
        if (isWildMagnet) {
          try { cleanupAllPullAnimations(); } catch {}
          setWildMagnetPullInProgress(false, 'merge6-absorb-interrupted');
        }
        if (regularMerge6CleanupToken !== null && dst) {
          merge6DestinationCleanupOwner.release(dst, regularMerge6CleanupToken);
          regularMerge6CleanupToken = null;
        }
        try { releaseSpecialDiceResolution(src); } catch {}
        try { releaseSpecialDiceResolution(dst); } catch {}
        releaseSpecialDiceTransaction(specialTransactionToken, 'merge6-absorb-interrupted');
      },
    });
    return;
  }

  } catch (error) {
  // A synchronous error may happen after the accepted merge already detached
  // src, locked dst, or claimed one of the transaction owners. Never swallow
  // it and leave a passive board behind.
  devError('❌ Merge transaction failed synchronously; applying owned recovery', error);
  if (merge6SpawnOwnerToken !== null) {
    resetMerge6SpawnState('merge-sync-error', {
      specialTransactionToken,
      merge6SpawnOwnerToken,
    });
  } else {
    releaseSpecialDiceTransaction(specialTransactionToken, 'merge-sync-error');
  }
  releaseRegularMergeHandoff(regularMergeHandoffToken, 'merge-sync-error');
  if (regularMerge6CleanupToken !== null && dst) {
    merge6DestinationCleanupOwner.release(dst, regularMerge6CleanupToken);
  }
  try { releaseSpecialDiceResolution(src); } catch {}
  try { releaseSpecialDiceResolution(dst); } catch {}

  if (mergeBoardMutationStarted && mergeEffectiveSumForRecovery !== null) {
    if (mergeEffectiveSumForRecovery < 6 && dst && !dst.destroyed) {
      // The regular destination value was already committed before its absorb
      // animation. Finish that accepted stack instead of rolling visuals back
      // through a second, partially reconstructed source of truth.
      try { if (src && !src.destroyed) removeTile(src); } catch {}
      try {
        normalizePlayableTileAfterMutation(dst);
        makeBoard.syncTileZIndex?.(dst, board);
        bindTileWithFallback(dst, false);
      } catch (normalizationError) {
        devWarn('⚠️ Merge sync recovery could not normalize destination', normalizationError);
      }
    } else {
      // A merge-6 failure before async ownership transfer has no safe partial
      // result. Retire the exact captured objects and let the canonical board
      // resolver recover from the remaining authoritative grid.
      try { if (src && !src.destroyed) removeTile(src); } catch {}
      try { if (dst && !dst.destroyed) removeTile(dst); } catch {}
    }
    scheduleOwnedMergeRecoveryCheck(0.12, 'merge-sync-error');
  } else {
    helpers.snapBack?.(src);
    if (dst && !dst.destroyed) dst.eventMode = 'static';
  }
  } finally {
  replayRecorder.endStep(__replayToken);
  }
}

async function checkMovesDepleted(){
  // Use centralized end game checker
  if (busyEnding) return;
  
  // 🔥 CRITICAL FIX: Ensure tiles array is fully updated before checking
  // After merge completes, tiles array might still be updating
  // Wait a bit to ensure all tile state updates are complete
  if (await waitTrackedResult(100) === 'cancelled') return;

  if (await ensureTutorialSingleTileCanFinish('moves_depleted_single_regular_tile')) {
    return;
  }
  
  const movesDepletedCheckContext: EndGameContext = {
    tiles,
    moves: 0,
    makeBoard
  };
  
  // 🔥 CRITICAL: Use forceRefresh for moves depleted check
  const movesDepletedCheckResult = checkEndGame(movesDepletedCheckContext, true);
  
  devLog('🔍 checkMovesDepleted: End game check result:', {
    type: movesDepletedCheckResult.type,
    reason: movesDepletedCheckResult.reason,
    activeTilesCount: tiles.filter(tileIsActive).length,
    activeTiles: tiles.filter(tileIsActive).map(t => ({ 
      value: t.value, 
      special: t.special, 
      stackDepth: (t as any).stackDepth || 1,
      locked: t.locked
    }))
  });
  
  if (movesDepletedCheckResult.type === 'stuck') {
    devLog('🚨🚨🚨 MOVES DEPLETED + GAME STUCK');
    if (deferFailForWildContinuation('moves_depleted_stuck')) return;
    if (await preventTutorialFailWithFinalChance('moves_depleted_stuck')) return;
    if (!busyEnding) {
      await runNoMovesFailFlow({ reason: 'moves_depleted_stuck' });
    }
  } else if (movesDepletedCheckResult.type === 'clean') {
    devLog('🚨🚨🚨 MOVES DEPLETED + BOARD CLEAN');
    if (!busyEnding) {
      // Respect hidden state (same rule as checkLevelEnd)
      const { appVisible, homeVisible, journeyVisible } = getScreenVisibility();
      if (homeVisible || journeyVisible) {
        devLog('⏳ checkMovesDepleted: Home/Journey visible - skipping clean board flow', { appVisible, homeVisible, journeyVisible });
        return;
      }
      await triggerCleanBoardFlow('clean_board_from_moves_depleted');
    }
  } else {
    devLog('✅ Moves depleted but merges still possible, game continues');
  }
}

// -------------------- level-end scaffolding --------------------
// NOTE: All end game checks now use centralized checkEndGame() from endgame-checker.ts
// All deprecated functions (activeTilesList, isStuck, isBoardClean, showCleanBoardEdgeCase) have been removed
function isTutorialFinalChanceEnabled(): boolean {
  try {
    return (window as any).__ccFirstPlayTutorialSlowWildMeter === true;
  } catch {
    return false;
  }
}

function findTutorialFinalChanceCell(): { c: number; r: number } | null {
  const preferred = randomEmptyCell();
  if (preferred) return preferred;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid?.[r]?.[c] as any;
      if (!cell || cell.destroyed) return { c, r };
      const isEmptyLocked = cell.locked === true && !cell.special && ((cell.value | 0) <= 0);
      if (isEmptyLocked) return { c, r };
    }
  }
  return null;
}

async function tryTutorialFinalChanceSpawn(reason: string): Promise<boolean> {
  if (!isTutorialFinalChanceEnabled()) return false;
  if (tutorialFinalChanceSpawnCount >= MAX_TUTORIAL_FINAL_CHANCE_SPAWNS) return false;
  if (wildSpawnInProgress || merge6SpawnInProgress || wildMagnetPullInProgress) return false;

  const candidates = tiles
    .filter((tile: any) => tile && !tile.destroyed && !tile.locked && !tile.special && tile.visible !== false)
    .filter((tile: any) => {
      const value = tile.value | 0;
      return value >= 1 && value <= 5;
    })
    .sort((a: any, b: any) => {
      const av = a.value | 0;
      const bv = b.value | 0;
      return bv - av;
    });
  const targetTile = candidates[0];
  if (!targetTile) return false;

  const targetValue = targetTile.value | 0;
  const neededValue = Math.max(1, Math.min(5, 6 - targetValue));
  const cell = findTutorialFinalChanceCell();
  if (!cell) return false;

  tutorialFinalChanceSpawnCount += 1;
  devWarn('🛟 Tutorial final chance: spawning exact value to avoid fail', {
    reason,
    targetValue,
    neededValue,
    targetCell: { c: targetTile.gridX, r: targetTile.gridY },
    spawnCell: cell,
    count: tutorialFinalChanceSpawnCount,
  });

  try {
    const ok = await openAtCell(cell.c, cell.r, {
      value: neededValue,
      skipBind: false,
      timeScale: 2.0,
      forceFreshPlaceholder: true,
    });
    if (!ok) {
      tutorialFinalChanceSpawnCount = Math.max(0, tutorialFinalChanceSpawnCount - 1);
      return false;
    }
    try { drawBoardBG?.(); } catch {}
    if (await waitTrackedResult(140) === 'cancelled') return false;
    scheduleCheckLevelEnd(0.12, `tutorial_final_chance_spawn:${reason}`);
    return true;
  } catch (err) {
    tutorialFinalChanceSpawnCount = Math.max(0, tutorialFinalChanceSpawnCount - 1);
    devWarn('⚠️ Tutorial final chance spawn failed', err);
    return false;
  }
}

async function ensureTutorialSingleTileCanFinish(reason: string): Promise<boolean> {
  if (!isTutorialFinalChanceEnabled()) return false;
  const activeRegularTiles = tiles
    .filter((tile: any) => tile && !tile.destroyed && !tile.locked && !tile.special && tile.visible !== false)
    .filter((tile: any) => {
      const value = tile.value | 0;
      return value >= 1 && value <= 5;
    });

  if (activeRegularTiles.length !== 1) return false;

  const targetTile = activeRegularTiles[0];
  devWarn('🛟 Tutorial final chance: single regular tile remains, forcing complement spawn', {
    reason,
    targetValue: targetTile.value | 0,
    neededValue: 6 - (targetTile.value | 0),
    targetCell: { c: targetTile.gridX, r: targetTile.gridY },
    stackDepth: (targetTile as any).stackDepth || 1,
  });
  return tryTutorialFinalChanceSpawn(reason);
}

async function preventTutorialFailWithFinalChance(reason: string): Promise<boolean> {
  if (!isTutorialFinalChanceEnabled()) return false;
  try { clearNoMovesText?.(); } catch {}
  try { await exitNoMovesText?.(); } catch {}
  try { resetEndgameHint(); } catch {}
  const rescued = await tryTutorialFinalChanceSpawn(reason);
  if (!rescued) {
    devWarn('🛟 Tutorial final chance: fail/no-moves suppressed; retrying endgame check', { reason });
    scheduleCheckLevelEnd(0.35, `tutorial_final_chance_retry:${reason}`);
  }
  return true;
}

function checkLevelEnd(){
  // 🔥 v38: Reset retry counter on new checkLevelEnd() call (not reschedule)
  checkLevelEndRetryCount = 0;
  
  // Always wait a bit so animations/spawns can finish before deciding
  cancelCheckLevelEndTimer();
  const scheduledGeneration = gameplayRunGeneration;
  const isCurrentCheck = () => scheduledGeneration === gameplayRunGeneration;

    checkLevelEndTimer = trackDelayedCall(CHECK_LEVEL_END_DELAY_MS / 1000, async () => {
      checkLevelEndTimer = null;
      if (!isCurrentCheck()) return;
      if (failScreenFlowInProgress || (window as any).__ccFailScreenPending === true) {
        devLog('⏳ checkLevelEnd skipped - fail screen flow already pending/in progress');
        checkLevelEndRetryCount = 0;
        return;
      }
      if (busyEnding) {
        devLog('⏳ checkLevelEnd skipped - busyEnding is true');
        checkLevelEndRetryCount = 0; // Reset on exit
      return;
    }
    // A special is converted to a temporary plain value-6 before its absorb
    // callback starts the finale/spawn handoff. A previously scheduled endgame
    // observer must not mistake that transaction-owned six for stale residue
    // and replace it with a regular cube.
    const specialTransactionBlock = getSpecialDiceEndgameBlock(specialDiceTransactionOwner);
    if (specialTransactionBlock) {
      devLog('⏳ checkLevelEnd deferred - special dice transaction owns board mutation', {
        token: specialTransactionBlock.token,
        kind: specialTransactionBlock.kind,
        ageMs: Math.max(0, Date.now() - specialTransactionBlock.startedAt),
      });
      scheduleCheckLevelEnd(0.2, `special-transaction:${specialTransactionBlock.kind}`);
      return;
    }
    const guardState = getEndgameGuardState();
    if (guardState.active) {
      const guardNow = Date.now();
      if (checkLevelEndSkipStartedAt === null) checkLevelEndSkipStartedAt = guardNow;
      const guardSkipWindowExceeded = (guardNow - checkLevelEndSkipStartedAt) > MAX_CHECK_LEVEL_END_SKIP_MS;
      checkLevelEndRetryCount++;
      (guardSkipWindowExceeded ? devWarn : devLog)('⏳ checkLevelEnd deferred - external endgame guard owns board mutation', {
        retry: `${checkLevelEndRetryCount}/${MAX_CHECK_LEVEL_END_RETRIES}`,
        guardCount: guardState.count,
        guardSources: guardState.sources,
        guardMsLeft: Math.max(0, guardState.until - guardNow),
        exceededDiagnosticWindow: guardSkipWindowExceeded,
      });
      scheduleCheckLevelEnd(0.25, 'external-endgame-guard');
      return;
    }

    const checkLevelEndNow = Date.now();
    const recentFinalMergeRuntime = findRecentFinalMergeRuntime(tiles, checkLevelEndNow);
    const protectedFinalMergeTile = tiles.find((tile: any) =>
      isFinalMergeRuntimeTileProtected(tile, checkLevelEndNow)
    );
    if (protectedFinalMergeTile) {
      devLog('⏳ checkLevelEnd deferred - final merge animation/handoff is active', {
        finaleFx: recentFinalMergeRuntime?.finaleFx || 'regular',
      });
      scheduleCheckLevelEnd(0.25, 'final-merge-runtime-active');
      return;
    }

    // Recovery sweep is safe only after active final-merge runtimes have been
    // excluded. Its own predicate repeats this guard as defense in depth.
    forceRemoveMagnetMergeResidues('checkLevelEnd');

    // 🛡️ SAFETY helpers
    const clearTileFromGridSafe = (tile: any) => {
      return detachTileFromGrid(tile, grid);
    };

    // 🔥 CRITICAL FIX: Skip check if _isLastMerge flag is set on any merge-6 tile (clean board flow in progress)
    // This prevents fail screen from triggering when clean board flow is in progress
    const hasLastMergeTile = tiles.some((t: any) => t && !t.destroyed && t.value === 6 && (t as any)?._isLastMerge === true);
    if (hasLastMergeTile) {
      devLog('⏳ checkLevelEnd: _isLastMerge flag detected on merge-6 tile (clean board flow in progress)');
    }
    
    logger.debug('🎯 checkLevelEnd called - using centralized end game checker', 'app-core');
    const now = Date.now();
    const skipWindowExceeded = checkLevelEndSkipStartedAt !== null && (now - checkLevelEndSkipStartedAt) > MAX_CHECK_LEVEL_END_SKIP_MS;
    // 🔥 BUG FIX: Skip if merge-6 spawn still in progress (prevents fail screen before 3 wild bonus tiles spawn)
    if (merge6SpawnInProgress) {
      if (checkLevelEndSkipStartedAt === null) checkLevelEndSkipStartedAt = now;
      checkLevelEndRetryCount++;
      devLog('⏳ checkLevelEnd skipped - merge6 spawn in progress (retry', checkLevelEndRetryCount, '/', MAX_CHECK_LEVEL_END_RETRIES, ')');
      scheduleCheckLevelEnd(0.5, 'merge6-spawn-in-progress');
      return;
    }
    const tntAnimationRunning = !!isTntAnimationActive?.();
    const tntBonusGuardActive = tntBonusGuardUntil > now;

    // 🔥 CRITICAL FIX: Never evaluate fail/clean while TNT transition/bonus is still mutating board.
    // This prevents false fail on transient states (e.g. temporary 4+5 before TNT replacement produces 4+2).
    if (tntAnimationRunning || tntBonusGuardActive) {
      if (checkLevelEndSkipStartedAt === null) checkLevelEndSkipStartedAt = now;
      checkLevelEndRetryCount++;
      devLog('⏳ checkLevelEnd deferred - TNT animation/bonus in progress', {
        retry: `${checkLevelEndRetryCount}/${MAX_CHECK_LEVEL_END_RETRIES}`,
        tntAnimationRunning,
        tntBonusGuardMsLeft: Math.max(0, tntBonusGuardUntil - now)
      });
      scheduleCheckLevelEnd(0.4, 'tnt-animation-or-bonus');
      return;
    }
    
    // 🔥 CRITICAL BUG FIX: Don't skip check if bubbles animation is running - it's just visual
    // Bubbles animation can run for 4+ seconds and shouldn't block end game detection
    // This fixes the bug where user makes quick second merge during bubbles animation and gets stuck position
    const bubblesRunning = isWildJuiceBubblesExplosionActive();
    if (bubblesRunning) {
      devLog('💧 Bubbles animation is running, but continuing with end game check (bubbles are visual only, don\'t block detection)');
    }
    
    // 🔥 CRITICAL: Skip check if wild spawn is in progress (animation not finished yet)
    if (wildSpawnInProgress) {
      if (checkLevelEndSkipStartedAt === null) checkLevelEndSkipStartedAt = now;
      checkLevelEndRetryCount++;
      devLog('⏳ checkLevelEnd skipped - wild spawn animation in progress (retry', checkLevelEndRetryCount, '/', MAX_CHECK_LEVEL_END_RETRIES, ')');
      
      scheduleCheckLevelEnd(0.3, 'wild-spawn-in-progress');
      return;
    }
    
    // 🔥 USER BUG FIX: Update STACK IT! hint BEFORE tilesNotReady check - so it shows when we have 2 active
    // stackable tiles even if there are locked tiles (ghost placeholders or animating). Hint logic uses
    // getActiveTiles which excludes locked tiles, so we correctly show STACK IT! for 2+2, 3+2, etc.
    updateEndgameHintState();
    
    // 🔥 CRITICAL FIX: Skip check if there are LOCKED tiles with value > 0 (spawn animations in progress)
    // This prevents premature fail screen when tiles are still being spawned/animated
    // 🔥 FIX: Only count locked tiles with value > 0 (animating) - NOT ghost placeholders (value 0)
    // Ghost placeholders never unlock → would cause infinite reschedule when stuck (4,5,4,5,3)
    const spawnStateNow = getTransientSpawnState(tiles, {
      autoClearStaleFlag: true,
      ignoreWildJuice: true,
    });
    const { lockedActiveTiles, tilesStillSpawning } = spawnStateNow;
    
    // Combine both checks - if any tiles are locked or still spawning, wait
    const tilesNotReady = lockedActiveTiles.length > 0 || tilesStillSpawning.length > 0;
    
    if (tilesNotReady) {
      if (checkLevelEndSkipStartedAt === null) checkLevelEndSkipStartedAt = now;
      checkLevelEndRetryCount++;
      logger.debug('⏳ checkLevelEnd skipped - tiles still spawning/animating', 'app-core', {
        retry: `${checkLevelEndRetryCount}/${MAX_CHECK_LEVEL_END_RETRIES}`,
        lockedCount: lockedActiveTiles.length,
        stillSpawningCount: tilesStillSpawning.length,
        lockedTiles: lockedActiveTiles.map(t => ({ value: t.value, special: t.special, gridX: t.gridX, gridY: t.gridY })),
        spawningTiles: tilesStillSpawning.map(t => ({ 
          value: t.value, 
          special: t.special, 
          gridX: t.gridX, 
          gridY: t.gridY, 
          locked: t.locked,
          eventMode: t.eventMode,
          isBeingSpawned: t._isBeingSpawned
        }))
      });
      
      scheduleCheckLevelEnd(0.5, 'tiles-not-ready');
      return;
    }

    // Hard guard: if a mandatory merge-cell spawn is pending, defer endgame checks until the tile is confirmed.
    if (pendingMandatoryMergeCellSpawn) {
      const nowMs = Date.now();
      const { c, r, expiresAt } = pendingMandatoryMergeCellSpawn;
      const hasSpawnedAtMandatoryCell = tiles.some((t: any) => {
        if (!t || t.destroyed) return false;
        if ((t.gridX | 0) !== (c | 0) || (t.gridY | 0) !== (r | 0)) return false;
        return tileIsActive(t as any);
      });
      if (hasSpawnedAtMandatoryCell) {
        pendingMandatoryMergeCellSpawn = null;
      } else if (nowMs < expiresAt) {
        devLog('⏳ checkLevelEnd deferred - waiting for mandatory merge-cell spawn confirmation', {
          c,
          r,
          msLeft: expiresAt - nowMs
        });
        scheduleCheckLevelEnd(0.25, 'mandatory-merge-cell-spawn-pending');
        return;
      } else {
        devWarn('⚠️ Mandatory merge-cell spawn confirmation timed out; forcing merge-cell repair before endgame check', { c, r });

        const ghostAtMandatoryCell = tiles.find((t: any) => {
          if (!t || t.destroyed) return false;
          if ((t.gridX | 0) !== (c | 0) || (t.gridY | 0) !== (r | 0)) return false;
          return isLockedEmptyPlaceholder(t);
        });

        if (ghostAtMandatoryCell) {
          try {
            if (grid?.[r]?.[c] === ghostAtMandatoryCell) grid[r][c] = null;
            if (!ghostAtMandatoryCell.destroyed && tiles.includes(ghostAtMandatoryCell)) removeTile(ghostAtMandatoryCell);
            devWarn('🧹 Removed stuck ghost placeholder from mandatory merge cell before forced spawn', { c, r });
          } catch (err) {
            devWarn('⚠️ Failed removing ghost placeholder at mandatory merge cell', { c, r, err });
          }
        }

        pendingMandatoryMergeCellSpawn = {
          c,
          r,
          expiresAt: Date.now() + 1200,
        };

        void (async () => {
          try {
            const spawned = await ensureRepairSpawnAtCell(c, r, {
              clearExistingOnFallback: true,
              reason: 'mandatory-merge-cell-repair',
            });

            if (!isCurrentCheck()) return;

            if (!spawned) {
              pendingMandatoryMergeCellSpawn = null;
            }

            checkLevelEnd();
          } catch (err) {
            if (err instanceof OpenCellCancelledError) return;
            devWarn('⚠️ Mandatory merge-cell repair failed', err);
          }
        })();
        return;
      }
    }
    
    // Do not evaluate endgame while user is actively dragging a tile.
    // Drag temporarily mutates board/grid state and can produce transient false "stuck".
    // Never cancel it from this observer: drag-core owns pointer lifecycle and its
    // activity-refreshed watchdog handles a genuinely lost iOS pointer.
    const activeDragTile = ((STATE as any)?.drag?.t) || ((drag as any)?.t);
    if (shouldDeferEndgameForActiveDrag(activeDragTile)) {
      const dragNow = Date.now();
      if (activeDragEndgameDeferredAt === null) activeDragEndgameDeferredAt = dragNow;
      logger.debug('⏳ checkLevelEnd skipped - active drag owns pointer lifecycle', 'app-core', {
        value: activeDragTile.value,
        special: activeDragTile.special,
        gridX: activeDragTile.gridX,
        gridY: activeDragTile.gridY,
        msDeferred: dragNow - activeDragEndgameDeferredAt
      });
      scheduleCheckLevelEnd(0.25, 'active-drag-in-progress');
      return;
    }
    activeDragEndgameDeferredAt = null;

    // 🔥 v38: Reset retry counter after successful reschedule bypass (tiles no longer locked/spawn done)
    checkLevelEndRetryCount = 0;
    checkLevelEndSkipStartedAt = null;

    if (await ensureTutorialSingleTileCanFinish('check_level_end_single_regular_tile')) {
      return;
    }
    if (!isCurrentCheck()) return;

    const buildEndgameBoardSignature = () => {
      const active = tiles
        .filter((t: any) => tileIsActive(t as any))
        .map((t: any) => ({
          v: t.value | 0,
          s: t.special || null,
          l: !!t.locked,
          d: (t as any).stackDepth || 1,
          x: t.gridX ?? null,
          y: t.gridY ?? null,
          e: t.eventMode || null
        }))
        .sort((a, b) => {
          if (a.y !== b.y) return (a.y ?? -1) - (b.y ?? -1);
          if (a.x !== b.x) return (a.x ?? -1) - (b.x ?? -1);
          if (a.v !== b.v) return a.v - b.v;
          return String(a.s).localeCompare(String(b.s));
        });
      return JSON.stringify(active);
    };
    const currentEndgameSignature = buildEndgameBoardSignature();
    if (currentEndgameSignature !== lastEndgameBoardSignature) {
      lastEndgameBoardSignature = currentEndgameSignature;
      lastEndgameBoardMutationAt = Date.now();
    }
    
    // 🔥 NOTE: Removed per request (no magnet-only end state allowed)
    // updateEndgameHintState() already called above (before tilesNotReady) so STACK IT! shows even with locked tiles

    // Use centralized end game checker
    const checkLevelEndContext: EndGameContext = {
      tiles,
      moves,
      makeBoard
    };
    
    // 🔥 CRITICAL: Use forceRefresh because delay might have caused cache staleness
    const checkLevelEndResult = checkEndGame(checkLevelEndContext, true);
    let resolverDecisionForLevelEnd: GameplayResolutionDecision | null = null;
    let levelEndDecision = normalizeLevelEndDecision({
      legacyResult: checkLevelEndResult,
      resolverDecision: null,
    });
    try {
      const resolvedLevelEnd = resolveLevelEndDecision({
        legacyResult: checkLevelEndResult,
        snapshotInput: {
          tiles: collectBoardGameplayTiles(),
          moves,
          makeBoard,
          mode: isArcadeHomeRunMode() ? 'arcade' : 'journey',
          phase: 'level-check',
          boardNumber,
          stageNumber: (window as any).__ccArcadeStageNumber,
          forceEndgameRefresh: false,
          flags: buildGameplayRuntimeFlags({ skipWindowExceeded }),
        },
      });
      const resolverSnapshot = resolvedLevelEnd.snapshot;
      const resolverDecision = resolvedLevelEnd.resolverDecision;
      resolverDecisionForLevelEnd = resolvedLevelEnd.resolverDecision;
      levelEndDecision = resolvedLevelEnd.levelEndDecision;
      const legacyDecisionType = getLegacyComparableDecisionType(checkLevelEndResult);
      const resolverComparableType = getResolverComparableDecisionType(resolverDecision);
      if (resolverComparableType !== legacyDecisionType) {
        devWarn('🧭 Gameplay resolver shadow mismatch at checkLevelEnd', {
          legacy: checkLevelEndResult,
          legacyDecisionType,
          resolverDecision,
          resolverComparableType,
          summary: summarizeGameplayDecision(resolverSnapshot, resolverDecision),
          activeTiles: resolverSnapshot.activeTiles.map((t: any) => ({
            value: t?.value | 0,
            special: t?.special ?? null,
            locked: t?.locked === true,
            stackDepth: (t as any)?.stackDepth || 1,
            gridX: t?.gridX,
            gridY: t?.gridY,
          })),
          flags: resolverSnapshot.flags,
        });
      }
    } catch (resolverError) {
      // Fail closed: legacy output remains diagnostic only. A resolver error
      // cannot authorize a terminal decision from a second state authority.
      devWarn('⚠️ Gameplay resolver failed at checkLevelEnd; deferring terminal decision', resolverError);
      levelEndDecision = { type: 'wait', reason: 'resolver-error', source: 'resolver' };
    }
    if (levelEndDecision.type !== 'continue' || checkLevelEndResult.type !== 'continue') {
      emitIOSArcadeGameplayTrace('level-end-decision', {
        boardNumber,
        legacy: checkLevelEndResult,
        resolver: resolverDecisionForLevelEnd,
        selected: levelEndDecision,
        activeTiles: tiles.filter((tile: any) => tileIsActive(tile)).map((tile: any) => ({
          value: tile.value | 0,
          special: tile.special || null,
          locked: tile.locked === true,
          stackDepth: tile.stackDepth || 1,
          x: tile.gridX,
          y: tile.gridY,
        })),
      });
    }
    if (levelEndDecision.type === 'wait') {
      devLog('⏳ checkLevelEnd deferred by gameplay resolver', {
        resolverDecision: resolverDecisionForLevelEnd,
        levelEndDecision,
        legacy: checkLevelEndResult,
      });
      scheduleCheckLevelEnd(0.25, 'resolver-wait');
      return;
    }
    if (checkLevelEndResult.type === 'stuck' && levelEndDecision.type === 'continue' && levelEndDecision.source === 'resolver') {
      devWarn('🛡️ checkLevelEnd: Resolver blocked legacy stuck/fail decision', {
        resolverDecision: resolverDecisionForLevelEnd,
        levelEndDecision,
        legacy: checkLevelEndResult,
      });
      scheduleCheckLevelEnd(0.25, 'resolver-blocked-legacy-stuck');
      return;
    }
    if (levelEndDecision.type !== 'continue') {
      resetEndgameHint();
    }
    
    // 🔥 USER BUG FIX: Don't trigger clean board flow if game is hidden (user is on homepage/other screens)
    // This prevents clean board modal from appearing when user navigates away from game
    const { appVisible, homeVisible, journeyVisible } = getScreenVisibility();
    
    if ((homeVisible || journeyVisible) && !appVisible) {
      devLog('⏳ checkLevelEnd skipped - home/journey visible (user navigated away from game)', {
        appVisible,
        homeVisible,
        journeyVisible
      });
      return;
    }

    const shouldHandleStuck = levelEndDecision.type === 'stuck';
    const resolvedStuckReason = levelEndDecision.reason;

    if (!shouldHandleStuck) {
      stuckWildDeferralStartedAt = null;
    }

    if (levelEndDecision.type === 'clean') {
      if (checkLevelEndResult.reason === 'only_merge6_remains') {
        const activeMerge6 = tiles.find((t: any) => {
          if (!t || t.destroyed || t.visible === false) return false;
          return (t.value | 0) === 6;
        });
        if (isNonFinalMerge6CleanVetoActive(activeMerge6)) {
          devWarn('🛡️ checkLevelEnd clean veto: only_merge6_remains came from non-final merge6, waiting for spawn/continuation', {
            blockerCount: (activeMerge6 as any)?._ccFinalMergeBlockerCount,
            activeSnapshotCount: (activeMerge6 as any)?._ccFinalMergeActiveSnapshotCount,
            nonFinal: (activeMerge6 as any)?._ccNonFinalMerge6 === true,
            merge6SpawnInProgress,
            wildSpawnInProgress,
          });
          scheduleCheckLevelEnd(0.25, 'non-final-merge6-clean-veto');
          return;
        }
      }
      const wildDropActuallyInProgress =
        wildSpawnInProgress ||
        (window as any).__ccWildSpawnDropInProgress === true;
      if (wildDropActuallyInProgress) {
        devLog('⚠️ checkLevelEnd: Clean board detected while wild drop is already in progress – waiting for drop to settle');
        scheduleCheckLevelEnd(0.25, 'clean-detected-wild-drop-in-progress');
        return;
      }
      if (isWildMeterReady(wildMeter) || wildSpawnRetryTimer !== null) {
        devLog('🧹 checkLevelEnd: Clean board detected with pending wild meter charge - cancelling spawn and clearing board');
        cancelPendingWildContinuation('checkLevelEnd-clean');
      }
      
      // 🔥 CRITICAL FIX: Check if there are unlocked mergeable tiles on board
      // If there are unlocked tiles (other than merge 6), it's NOT a clean board - user can still merge them
      const unlockedActiveTiles = tiles.filter((t: any) => {
        if (!tileIsActive(t as any)) return false;
        if (t.locked) return false; // Only check unlocked tiles
        return true;
      });
      
      // Check if there are more than 1 unlocked tile (merge 6 + other tiles = can merge)
      const hasUnlockedMergeableTiles = unlockedActiveTiles.length > 1;
      
      // 🔥 USER REQUEST v85: Check if unlocked tiles have potential for merge/stack
      // If anyMergePossible returns true → game continues (don't trigger clean board)
      // If anyMergePossible returns false → trigger clean board or fail screen
      // This ensures clean board is only triggered when no merges/stack are possible
      // 🔥 v112 NOTE: This is a specific check for UNLOCKED tiles only (different from standard checkEndGame)
      // Keeping direct anyMergePossible() call here because we need to check only unlocked tiles, not all tiles
      let hasMergeOrStackPotential = false;
      if (unlockedActiveTiles.length > 0 && makeBoard?.anyMergePossible) {
        // Check only with unlocked tiles (available for player to use)
        hasMergeOrStackPotential = makeBoard.anyMergePossible(unlockedActiveTiles);
        devLog('🧲 checkLevelEnd: anyMergePossible check with unlocked tiles:', {
          unlockedTilesCount: unlockedActiveTiles.length,
          hasMergeOrStackPotential,
          tiles: unlockedActiveTiles.map((t: any) => ({ value: t.value, special: t.special, locked: t.locked }))
        });
      }
      
      // 🔥 CRITICAL FIX: Check if there's a magnet on board that can be used for merge
      // If magnet exists, it's NOT a clean board - user can still merge magnet with merge 6
      const activeTiles = tiles.filter((t: any) => tileIsActive(t as any));
      const hasMagnet = activeTiles.some((t: any) => isSpecialDiceMagnetLikeTile(t));
      
      // 🔥 USER REQUEST: If unlocked tiles have merge/stack potential → game continues
      if (hasMergeOrStackPotential) {
        devLog('✅ checkLevelEnd: Unlocked tiles have merge/stack potential - game continues, NOT triggering clean board');
        return; // Don't trigger clean board - game continues
      }
      
      if (hasUnlockedMergeableTiles && !hasMergeOrStackPotential) {
        devLog('🧲 checkLevelEnd: Unlocked mergeable tiles detected but no merge/stack potential - will check stuck in checkEndGame');
        // Continue to checkEndGame which will check stuck and show fail screen if needed
      }
      
      if (hasMagnet) {
        devLog('🧲 checkLevelEnd: Magnet detected on board - NOT a clean board, game continues');
        return; // Don't trigger clean board - game continues
      }
      
      const cleanFlowReason = recentFinalMergeRuntime
        ? getFinalMergeCleanBoardReason(recentFinalMergeRuntime.finaleFx)
        : checkLevelEndResult.reason === 'last_merge' || checkLevelEndResult.reason === 'only_merge6_remains'
          ? 'clean_board_from_last_merge_checkLevelEnd'
          : 'clean_board_from_checkLevelEnd';

      devLog('🚨🚨🚨 checkLevelEnd: Board is clean, triggering clean board flow', {
        cleanFlowReason,
        legacyReason: checkLevelEndResult.reason,
        resolverReason: levelEndDecision.reason,
      });
      emitIOSArcadeGameplayTrace('clean-flow-dispatch', {
        boardNumber,
        cleanFlowReason,
        legacyReason: checkLevelEndResult.reason,
        resolverReason: levelEndDecision.reason,
      });
    
      // 🔥 FIX: Use centralized triggerCleanBoardFlow instead of duplicating logic
      // This ensures consistent handling: memory cleanup, skip flags, wild resets, etc.
      await triggerCleanBoardFlow(cleanFlowReason);
      if (!isCurrentCheck()) return;
      return;
    }
    
    if (shouldHandleStuck) {
      try { resetEndgameHint(); } catch {}
      const wildReady = isWildContinuationPendingForFail();
      const stuckWildDecision = resolveStuckWildDeferralDecision({
        wildContinuationPending: wildReady,
        startedAt: stuckWildDeferralStartedAt,
        now: Date.now(),
        maxDeferralMs: MAX_STUCK_WILD_DEFERRAL_MS,
      });
      stuckWildDeferralStartedAt = stuckWildDecision.startedAt;
      if (stuckWildDecision.action === 'defer') {
        devLog('⚠️ checkLevelEnd: Stuck detected but wild meter is ready/spawning – deferring fail screen until wild cube drops', {
          deferMs: stuckWildDecision.deferMs,
        });
        queueWildSpawnAfterGuardRelease('stuck-wild-continuation-defer');
        scheduleCheckLevelEnd(0.35, 'stuck-wild-continuation-defer');
        return;
      }
      if (stuckWildDecision.action === 'force-fail') {
        devWarn('🚨 checkLevelEnd: Wild defer timeout exceeded in stuck state - forcing fail evaluation', {
          deferMs: stuckWildDecision.deferMs,
          wildMeter,
          wildSpawnInProgress,
          hasRetryTimer: wildSpawnRetryTimer !== null,
        });
      }

      stuckWildDeferralStartedAt = null;

      // Hard guard: merge-6 continuation must never enter fail flow.
      // If active board contains 6 + (1..5), player still has a legal move.
      const activeForMerge6Guard = tiles.filter((t: any) => tileIsActive(t as any));
      const hasMerge6ContinuationPair = activeForMerge6Guard.some((a: any, i: number) => {
        if (!a || a.destroyed || a.special) return false;
        const av = (a.value | 0);
        if (av !== 6) return false;
        for (let j = 0; j < activeForMerge6Guard.length; j++) {
          if (j === i) continue;
          const b = activeForMerge6Guard[j] as any;
          if (!b || b.destroyed || b.special) continue;
          const bv = (b.value | 0);
          if (bv >= 1 && bv <= 5) return true;
        }
        return false;
      });
      if (hasMerge6ContinuationPair) {
        devWarn('🛡️ checkLevelEnd: Aborting stuck/fail - detected active merge6 continuation pair (6 + 1..5)');
        scheduleCheckLevelEnd(0.12, 'merge6-continuation-pair');
        return;
      }

      // Hard recovery: if a plain merge-6 is lingering while board is considered stuck,
      // consume it and force-spawn one fresh tile at the same cell before fail evaluation.
      // This prevents false fail when merge-6 cleanup/spawn order races in endgame scenarios.
      const lingeringRegularMerge6 = tiles.find((t: any) => {
        if (!t || t.destroyed) return false;
        if ((t.value | 0) !== 6) return false;
        if (t.special) return false;
        if (t.locked) return false;
        if ((t as any)?._isLastMerge === true) return false;
        if ((t as any)?._wildMagnetPulledTilesMerge === true) return false;
        if ((t as any)?._willPullTiles === true) return false;
        if ((t as any)?._hasTilesToPull === true) return false;
        return true;
      });
      if (lingeringRegularMerge6) {
        const activeExcludingMerge6 = tiles.filter((t: any) => {
          if (!t || t === lingeringRegularMerge6) return false;
          return tileIsActive(t as any);
        });

        // Only do this in "board continues" shape (other active tiles exist).
        // Final-merge clean-board paths are handled elsewhere via _isLastMerge and clean flow.
        if (activeExcludingMerge6.length > 0) {
          const rescueGX = lingeringRegularMerge6.gridX | 0;
          const rescueGY = lingeringRegularMerge6.gridY | 0;
          devWarn('🛟 ENDGAME RESCUE: lingering plain merge-6 detected in stuck path; forcing consume + respawn', {
            gridX: rescueGX,
            gridY: rescueGY,
            otherActiveTiles: activeExcludingMerge6.length,
            reason: resolvedStuckReason
          });

          if (clearTileFromGridSafe(lingeringRegularMerge6)) {
            devLog('🧹 ENDGAME RESCUE: cleared lingering merge-6 from grid');
          }
          lingeringRegularMerge6.visible = false;
          lingeringRegularMerge6.alpha = 0;
          lingeringRegularMerge6.eventMode = 'none';
          removeTile(lingeringRegularMerge6);

          pendingMandatoryMergeCellSpawn = {
            c: rescueGX,
            r: rescueGY,
            expiresAt: Date.now() + 2500
          };

          let spawned = false;
          try {
            spawned = await ensureRepairSpawnAtCell(rescueGX, rescueGY, {
              clearExistingOnFallback: false,
              reason: 'lingering-merge6-rescue',
            });
          } catch (err) {
            if (err instanceof OpenCellCancelledError) return;
            throw err;
          }
          if (!isCurrentCheck()) return;

          if (spawned) {
            pendingMandatoryMergeCellSpawn = null;
            if (await waitTrackedResult(140) === 'cancelled') return;
            if (!isCurrentCheck()) return;
            checkLevelEnd();
            return;
          }

          devWarn('⚠️ ENDGAME RESCUE: failed to respawn replacement tile after lingering merge-6 removal, continuing stuck evaluation');
        }
      }

      const sinceMutation = lastEndgameBoardMutationAt ? (Date.now() - lastEndgameBoardMutationAt) : Infinity;
      if (sinceMutation < ENDGAME_FAIL_MUTATION_COOLDOWN_MS) {
        devLog('🛡️ checkLevelEnd: Deferring fail due to recent board mutation cooldown', {
          sinceMutation,
          cooldown: ENDGAME_FAIL_MUTATION_COOLDOWN_MS
        });
        scheduleCheckLevelEnd(0.25, 'recent-board-mutation-cooldown');
        return;
      }

      const buildBoardStabilitySignature = () => {
        const active = tiles
          .filter((t: any) => tileIsActive(t as any))
          .map((t: any) => ({
            v: t.value | 0,
            s: t.special || null,
            l: !!t.locked,
            d: (t as any).stackDepth || 1,
            x: t.gridX ?? null,
            y: t.gridY ?? null,
            e: t.eventMode || null
          }))
          .sort((a, b) => {
            if (a.y !== b.y) return (a.y ?? -1) - (b.y ?? -1);
            if (a.x !== b.x) return (a.x ?? -1) - (b.x ?? -1);
            if (a.v !== b.v) return a.v - b.v;
            return String(a.s).localeCompare(String(b.s));
          });
        return JSON.stringify(active);
      };

      const hasNotReadyTilesNow = () => {
        return tiles.some((t: any) => {
          return isTileTransientlySpawning(t, { autoClearStaleFlag: true, ignoreWildJuice: true });
        });
      };

      const initialStuckSignature = buildBoardStabilitySignature();
      const stuckConfirmationDelaysMs = [250, 250];
      let stableStuckConfirmed = true;
      let lastReason = resolvedStuckReason;

      // Production-safe guard: require multiple consistent stuck checks on unchanged board state.
      for (const delayMs of stuckConfirmationDelaysMs) {
        if (await waitTrackedResult(delayMs) === 'cancelled') return;
        if (!isCurrentCheck()) return;
        const dragTileNow = ((STATE as any)?.drag?.t) || ((drag as any)?.t);
        if (dragTileNow && !dragTileNow.destroyed) {
          devLog('🛡️ checkLevelEnd: Abort fail - drag became active during stuck confirmation');
          stableStuckConfirmed = false;
          break;
        }
        if (hasNotReadyTilesNow()) {
          const sinceMutationDuringConfirm = lastEndgameBoardMutationAt ? (Date.now() - lastEndgameBoardMutationAt) : Infinity;
          if (sinceMutationDuringConfirm <= MAX_CHECK_LEVEL_END_SKIP_MS) {
            devLog('🛡️ checkLevelEnd: Abort fail - tiles are still spawning/animating during stuck confirmation');
            stableStuckConfirmed = false;
            break;
          }
          devWarn('⚠️ checkLevelEnd: Forcing stuck confirmation despite stale not-ready flags', {
            sinceMutationDuringConfirm,
            maxSkipMs: MAX_CHECK_LEVEL_END_SKIP_MS,
          });
        }
        const recheckContext: EndGameContext = { tiles, moves, makeBoard };
        const recheckResult = checkEndGame(recheckContext, true);
        let recheckResolvedLevelEnd;
        try {
          recheckResolvedLevelEnd = resolveLevelEndDecision({
            legacyResult: recheckResult,
            snapshotInput: {
              tiles: collectBoardGameplayTiles(),
              moves,
              makeBoard,
              mode: isArcadeHomeRunMode() ? 'arcade' : 'journey',
              phase: 'level-check',
              boardNumber,
              stageNumber: (window as any).__ccArcadeStageNumber,
              forceEndgameRefresh: false,
              flags: buildGameplayRuntimeFlags({ skipWindowExceeded }),
            },
          });
        } catch (resolverError) {
          devWarn('⚠️ Gameplay resolver failed during stuck confirmation; retrying safely', resolverError);
          stableStuckConfirmed = false;
          break;
        }
        const recheckResolverDecision = recheckResolvedLevelEnd.resolverDecision;
        const recheckLevelEndDecision = recheckResolvedLevelEnd.levelEndDecision;
        lastReason = recheckLevelEndDecision.type === 'stuck' ? recheckLevelEndDecision.reason : recheckResult.reason;
        if (recheckLevelEndDecision.type !== 'stuck') {
          devLog('🛡️ checkLevelEnd: Transient stuck resolved on recheck, continuing game', {
            first: resolvedStuckReason,
            second: recheckResult.reason,
            resolverSecond: recheckResolverDecision,
            recheckLevelEndDecision,
          });
          stableStuckConfirmed = false;
          break;
        }
        const currentSignature = buildBoardStabilitySignature();
        if (currentSignature !== initialStuckSignature) {
          devLog('🛡️ checkLevelEnd: Board changed during stuck confirmation, skipping fail this tick');
          stableStuckConfirmed = false;
          break;
        }
      }

      if (!stableStuckConfirmed) {
        scheduleCheckLevelEnd(0.25, 'stuck-not-stable');
        return;
      }

      if (await preventTutorialFailWithFinalChance(lastReason)) return;
      if (!isCurrentCheck()) return;

      devLog('🚨🚨🚨 checkLevelEnd: Game is stuck, checking anyMergePossible before showing fail screen');
      devLog('🔍 checkLevelEnd: Stuck reason:', lastReason);
      devLog('🔍 checkLevelEnd: Current tiles:', tiles.filter(tileIsActive).map(t => ({ 
        value: t.value, 
        special: t.special, 
        locked: t.locked 
      })));
      
      // 🔥 REFACTORED: Uklonjena redundancija - checkEndGame() već poziva anyMergePossible() kroz isGameStuck()
      // Ako checkEndGame() vraća 'stuck', znači da anyMergePossible() već vratio false
      // Nema potrebe za dodatnom provjerom

      if (!busyEnding) {
        const sinceTntChange = lastTntBonusChangeAt ? (Date.now() - lastTntBonusChangeAt) : Infinity;
        if (sinceTntChange < TNT_POST_MUTATION_FAIL_RECHECK_MS) {
          const recheckDelayMs = TNT_POST_MUTATION_FAIL_RECHECK_MS - sinceTntChange;
          devWarn('🛡️ checkLevelEnd: Deferring TNT-adjacent stuck/fail for a fresh board recheck', {
            sinceTntChange,
            recheckDelayMs,
            lastReason,
          });
          scheduleCheckLevelEnd(Math.max(0.12, recheckDelayMs / 1000), 'recent-tnt-bonus-mutation');
          return;
        }
        await runNoMovesFailFlow({
          reason: 'check_level_end_stuck',
          resetHint: false,
          exitTimeoutMs: 700,
          persistStuckState: true,
        });
        if (!isCurrentCheck()) return;
      } else {
        devWarn('⚠️ checkLevelEnd: busyEnding is true, skipping showFinalScreen');
        scheduleCheckLevelEnd(0.35, 'busy-ending-during-stuck');
      }
    } else {
      devLog('✅ checkLevelEnd: Game continues -', checkLevelEndResult.reason);
      (window as any).__ccFailScreenPending = false; // Clear in case it was set from a prior check
      // 🔥 ANTI-EXPLOIT: Save state after merge (and spawn) have fully completed.
      // Without this, save only ran on drop (before merge), so hard exit could restore
      // pre-merge state (e.g. magnet back, revert move). Now resume always gets post-merge state.
      try {
        saveGameState();
        devLog('💾 Game state saved after merge complete (prevents hard-exit revert exploit)');
      } catch (e) {
        devWarn('⚠️ Failed to save after merge complete:', e);
      }
    }
  });
}

function updateEndgameHintState(): void {
  try {
    if ((window as any).__ccFailScreenPending === true) {
      updateEndgameHint(false);
      return;
    }
    // 🔥 CRITICAL: Never show STACK IT! during final merge / clean board flow
    if (busyEnding) {
      updateEndgameHint(false);
      return;
    }
    const hasFinalMergeFlag = tiles.some((t: any) => t && !t.destroyed && (t as any)?._isLastMerge === true);
    if (hasFinalMergeFlag) {
      updateEndgameHint(false);
      return;
    }
    // 🔥 BUG FIX: If game is stuck (no moves), NEVER show STACK IT! - fail screen will show NO MOVES
    const checkContext: EndGameContext = { tiles, moves, makeBoard };
    const checkResult = checkEndGame(checkContext, true);
    if (checkResult.type === 'clean') {
      updateEndgameHint(false);
      return;
    }
    if (checkResult.type === 'stuck') {
      updateEndgameHint(false);
      return;
    }
    const hintTiles = getActiveTiles(tiles);
    const shouldShowHint = shouldShowStackItHintForTiles(hintTiles, makeBoard?.anyMergePossible);
    updateEndgameHint(shouldShowHint);
  } catch {}
}

// 🔥 REMOVED: showCleanBoardEdgeCase() - DEPRECATED function no longer needed
// Endgame checker handles all edge cases now

// 🔥 REMOVED: openLockedBounceParallel(k) - DEAD CODE, never called
// Was a wrapper for FLOW.openLockedBounceParallel but is not used anywhere

// -------------------- helpers --------------------
// 🔥 v112: sleep moved to app-core-utils.ts
// Imported: sleep

/** Kad krenu kockice u return (BOOM exit): razbi 4 random obične kockice (delay 0.5s nakon return start), merge 6 efekat + smoke, wild meter, spawn 4 nove. Samo obične, nikad wild. */
function runTntBoomBonusBreak2Tiles(deps: {
  board: any;
  dst: Tile;
  addWildProgress: (n: number) => void;
  removeTile: (t: Tile) => void;
  openAtCell: (c: number, r: number, opts?: any) => Promise<unknown>;
  regularMerge6ShardsTemplated: (board: any, tile: any, opts?: any) => void;
  smokeBubblesAtTile: (board: any, tile: any, tileSize?: number, strength?: number, opts?: any) => void;
  TILE: number;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
  bonusParticleSources?: string[];
  bonusParticleScale?: number;
  impactProfile?: 'standard' | 'beach-ball' | 'laser-gun';
  skipFx?: boolean;
  onTargetsSelected?: (
    targets: Array<{ x: number; y: number; shooter: LaserGunShooter }>,
  ) => void | LaserGunEntryReadiness | Promise<unknown>;
  onBoardCommitted?: () => void;
  onComplete?: () => void;
}) {
  const { board, dst, addWildProgress, removeTile, openAtCell, regularMerge6ShardsTemplated, smokeBubblesAtTile, TILE, devLog, devWarn, bonusParticleSources, bonusParticleScale = 1, impactProfile = 'standard', skipFx, onTargetsSelected, onBoardCommitted, onComplete } = deps;
  // The activating merge already awards one full BIG increment. Each of the
  // four TNT/Ball bonus impacts contributes a small, explicit 5% reward.
  const bonusProgressPerImpact = 0.05;
  let ownedBonusTiles: Tile[] = [];
  let boardCommitNotified = false;
  const notifyBoardCommitted = () => {
    if (boardCommitNotified) return;
    boardCommitNotified = true;
    try { onBoardCommitted?.(); } catch {}
  };
  try {
    const getScreenPos = (tileForCenter: any) => {
      const local = centerInBoard(board, tileForCenter, TILE);
      try {
        if (board && typeof (board as any).toGlobal === 'function') {
          const global = (board as any).toGlobal({ x: local.x, y: local.y });
          if (global && Number.isFinite(global.x) && Number.isFinite(global.y)) {
            return { x: global.x, y: global.y };
          }
        }
      } catch {}
      return local;
    };
    const getDomScreenPos = (tileForCenter: any) => {
      const pos = getScreenPos(tileForCenter);
      try {
        const canvas = (app as any)?.canvas || (app as any)?.view || (app as any)?.renderer?.canvas;
        const rect = canvas?.getBoundingClientRect?.();
        const screen = (app as any)?.renderer?.screen;
        const screenW = Number(screen?.width) || Number((app as any)?.renderer?.width) || rect?.width;
        const screenH = Number(screen?.height) || Number((app as any)?.renderer?.height) || rect?.height;
        if (rect && screenW > 0 && screenH > 0) {
          return {
            x: rect.left + (pos.x / screenW) * rect.width,
            y: rect.top + (pos.y / screenH) * rect.height,
          };
        }
      } catch {}
      return pos;
    };
    const bonusParticleTextures = Array.isArray(bonusParticleSources) && bonusParticleSources.length
      ? bonusParticleSources.map((source) => Texture.from(source))
      : [Texture.from('./assets/small-star.png')];
    let hudStarPos: { x: number; y: number } | null = null;
    try {
      if (typeof HUD.getStarHudPosition === 'function') {
        hudStarPos = HUD.getStarHudPosition();
      }
    } catch {}
    if (!hudStarPos) hudStarPos = { x: 0, y: 0 };

    // Keep guard active while TNT bonus break/spawn sequence is running.
    tntBonusGuardUntil = Math.max(tntBonusGuardUntil, Date.now() + 2500);
    if ((dst as any)?._isLastMerge) {
      devLog('🔥 TNT boom bonus: skip (last merge - clean board)');
      try { onTargetsSelected?.([]); } catch {}
      notifyBoardCommitted();
      try { onComplete?.(); } catch {}
      return;
    }
    const allTiles = STATE?.tiles || [];
    const candidates = allTiles.filter((t: Tile) => {
      if (!t || t.destroyed || t === dst) return false;
      const isWild = isWildLikeTile(t);
      if (isWild) return false;
      const v = (t.value | 0);
      return v > 0 && v <= 6;
    });
    const count = Math.min(4, candidates.length);
    if (count < 1) {
      devLog('🔥 TNT boom bonus: no regular tiles to break');
      try { onTargetsSelected?.([]); } catch {}
      notifyBoardCommitted();
      try { onComplete?.(); } catch {}
      return;
    }
	    let toBreak = impactProfile === 'beach-ball' || impactProfile === 'laser-gun'
	      ? selectSpatiallySeparatedTntTargets(candidates, count)
	      : [...candidates].sort(() => Math.random() - 0.5).slice(0, count);
	    let laserVisualTargets: Array<{ x: number; y: number; shooter: LaserGunShooter }> = [];
	    if (impactProfile === 'laser-gun') {
	      const screenPositions = new Map(toBreak.map((tile) => [tile, getDomScreenPos(tile)]));
	      const crossfire = planLaserGunCrossfireTargets(
	        toBreak,
	        (tile) => screenPositions.get(tile)?.x ?? 0,
	        typeof window !== 'undefined' ? window.innerWidth : 1,
	      );
	      toBreak = crossfire.map(({ target }) => target);
	      laserVisualTargets = crossfire.map(({ target, shooter }) => ({
	        ...(screenPositions.get(target) ?? getDomScreenPos(target)),
	        shooter,
	      }));
	    }
	    ownedBonusTiles = toBreak;
	    claimTntBonusTiles(toBreak);
	    let laserGunEntryReadiness: Promise<LaserGunEntryReadiness> = Promise.resolve('cancelled');
	    if (impactProfile === 'laser-gun') {
	      try {
	        laserGunEntryReadiness = Promise.resolve(onTargetsSelected?.(laserVisualTargets))
	          .then((readiness) => readiness === 'painted' ? 'painted' : 'cancelled')
	          .catch((error) => {
	            devWarn('LaserGun entry readiness failed; continuing canonical impacts:', error);
	            return 'cancelled';
	          });
	      } catch (error) {
	        devWarn('LaserGun target handoff failed; continuing canonical impacts:', error);
	      }
	    }
	    // From this point onward only these exact tiles are unsafe. Release the
	    // global board lock before the staggered replacements finish.
	    notifyBoardCommitted();
	    const pool = regularValuePool();
	    const used: number[] = [];
	    const laserGunPoseRestorers = new Set<() => void>();
	    let completedBreaks = 0;
	    let completed = false;
	    const markBreakComplete = () => {
	      completedBreaks += 1;
	      if (completedBreaks < count || completed) return;
	      completed = true;
	      // Final transaction barrier: no shot, including shot four, may leave
	      // its same-tile rebound pose on the playable board.
	      if (impactProfile === 'laser-gun') {
	        laserGunPoseRestorers.forEach((restore) => {
	          try { restore(); } catch {}
	        });
	      }
	      releaseTntBonusTiles(ownedBonusTiles);
	      tntBonusGuardUntil = Math.max(tntBonusGuardUntil, Date.now() + 450);
	      trackAppTimeout(() => {
	        try { onComplete?.(); } catch {}
	        try { checkLevelEnd(); } catch {}
	      }, 80);
	    };
	    const lastScheduledImpactMs = impactProfile === 'laser-gun'
	      ? LASERGUN_FIRST_SHOT_LEAD_MS + Math.max(0, count - 1) * LASERGUN_SHOT_INTERVAL_MS
	      : impactProfile === 'beach-ball'
	        ? [0, 260, 560, 900][count - 1] ?? 0
	        : Math.max(0, count - 1) * 200;
	    const armForceCompleteTimeout = () => trackAppTimeout(() => {
	      if (completed) return;
	      devWarn('⚠️ TNT boom bonus safety: forcing completion after native timeout');
	      completedBreaks = count;
	      markBreakComplete();
	    }, Math.max(1600, lastScheduledImpactMs + 1600));
	    const forceCompleteTimeout = impactProfile === 'laser-gun'
	      ? null
	      : armForceCompleteTimeout();
	    const beachBallImpactDelaysMs = [0, 260, 560, 900] as const;
	    const laserGunImpactPlans: Array<{
	      prepare: () => Promise<unknown>;
	      commit: () => Promise<boolean>;
	    }> = [];
	    const laserGunRunGeneration = gameplayRunGeneration;
	    let laserGunVisualsEnabled = false;
	    toBreak.forEach((tile: Tile, i: number) => {
	      const delayMs = impactProfile === 'beach-ball'
	        ? beachBallImpactDelaysMs[i] ?? i * 300
	        : i * 200; // native timeout: mobile-safe, does not wait for GSAP ticker wake
	      const doBreak = (laserGunVisualArrived = false) => {
	        if (!tile || tile.destroyed || !board || !STATE?.tiles) {
	          releaseTntBonusTile(tile);
	          markBreakComplete();
	          return;
	        }
        if (impactProfile === 'laser-gun' && laserGunVisualArrived) {
          if (i >= 2) {
            // Hits 3 and 4 add a short, bounded screen punctuation at the same
            // canonical impact boundary. It never schedules another hit or
            // owns gameplay state, and the fourth hit is intentionally firmer.
            screenShake(app, {
              strength: i === 2 ? 9 : 12,
              duration: i === 2 ? 0.18 : 0.22,
              steps: i === 2 ? 10 : 12,
              ease: 'power2.out',
              yScale: 0.72,
              alsoShake: Array.from(document.querySelectorAll<HTMLElement>(
                '.cc-lasergun-finale-scene, .cc-lasergun-right-gun-layer',
              )),
            });
          }
        }
        const c = tile.gridX ?? 0;
        const r = tile.gridY ?? 0;
	        // Preserve the stagger and award exactly 5% per completed impact:
	        // four explosions together add 20% to the preload meter.
		        if (i < 2) {
		          addWildProgress(bonusProgressPerImpact);
		        } else {
		          trackAppTimeout(() => {
		            addWildProgress(bonusProgressPerImpact);
		          }, Math.round((0.4 + (i - 2) * 0.1) * 1000));
	        }
        if (typeof (window as any).triggerHapticImpact === 'function') {
          (window as any).triggerHapticImpact('heavy');
        }
	        // Shards + smoke appear at the actual impact boundary. LaserGun emits
	        // them at beam-tip contact while its spring scale remains visible.
	        const emitImpactFx = () => {
	          if (skipFx) return;
	          try {
	            regularMerge6ShardsTemplated(board, tile, {
	              zIndex: 9993,
	              groupedOwner: impactProfile === 'beach-ball',
	            });
	          } catch (e) { devWarn('TNT boom bonus shards:', e); }
	          try {
	            smokeBubblesAtTile(board, tile, TILE * 1.0, impactProfile === 'beach-ball' ? 1.25 : impactProfile === 'laser-gun' ? 0.62 : 1.0, {
	              sizeScale: impactProfile === 'beach-ball' ? 1.9 : impactProfile === 'laser-gun' ? 1.15 : 1.5,
	              distanceScale: impactProfile === 'beach-ball' ? 1.35 : 1,
	              countScale: impactProfile === 'beach-ball' ? 1.15 : impactProfile === 'laser-gun' ? 0.28 : 1,
	              spawnShape: 'box',
	              zIndex: 9994,
	              groupedOwner: impactProfile === 'beach-ball',
	            });
	          } catch (e) { devWarn('TNT transition smoke:', e); }
	        };
	        const oldValue = (tile.value | 0);
	        const basePos = getScreenPos(tile);
	        let bonusStarEmitted = false;
	        const emitBonusStar = () => {
	          if (bonusStarEmitted) return;
	          bonusStarEmitted = true;
	          try {
	            const bonusParticleTexture = bonusParticleTextures[(Math.random() * bonusParticleTextures.length) | 0];
	            const starPositions = [{
	              texture: bonusParticleTexture,
	              globalX: basePos.x,
	              globalY: basePos.y,
	              scale: { x: 0.55 * bonusParticleScale, y: 0.55 * bonusParticleScale }
	            }];
	            const appForAnimation = STATE.app || (STATE.stage as any)?.app;
	            devLog('⭐ TNT bonus star: spawning from broken tile', {
	              gridX: c,
	              gridY: r,
	              screenX: basePos.x,
	              screenY: basePos.y
	            });
	            void animateStarsToHudIcon(board, STATE.stage, starPositions, basePos, basePos, hudStarPos, appForAnimation);
	          } catch (e) {
	            devWarn('⚠️ TNT bonus star animation failed:', e);
	          }
	        };
	        if (impactProfile !== 'laser-gun') emitImpactFx();
        if (impactProfile === 'beach-ball') {
          const impactVisual = (tile as any).rotG || tile;
          const scale = impactVisual?.scale;
          if (scale) {
            const scaleX = Number(scale.x) || 1;
            const scaleY = Number(scale.y) || 1;
            try { gsap.killTweensOf(scale); } catch {}
            trackTween(scale, {
              x: scaleX * 1.24,
              y: scaleY * 0.72,
              duration: 0.09,
              ease: 'power2.out',
              overwrite: 'auto',
            });
          }
        }
        const selectReplacementValue = () => {
          // Prefer unique values across this burst, while always changing the
          // face that was actually hit.
          let available = pool.filter((v) => !used.includes(v) && v !== oldValue);
          if (available.length === 0) available = pool.filter((v) => v !== oldValue);
          const val = available[(Math.random() * available.length) | 0];
          used.push(val);
          return val;
        };
        const replaceTile = () => {
          if (!tile || tile.destroyed || !board || !STATE?.tiles) {
            releaseTntBonusTile(tile);
            markBreakComplete();
            return;
          }
          releaseTntBonusTile(tile);
          removeTile(tile);
        // Non-Laser profiles keep their existing replacement-boundary star.
        // Laser emits it at impact start alongside smoke/shards and scaling.
        emitBonusStar();
	        const val = selectReplacementValue();
	        openAtCell(c, r, { value: val, skipBind: false })
	          .then(() => {
	            lastTntBonusChangeAt = Date.now();
	            tntBonusGuardUntil = Math.max(tntBonusGuardUntil, Date.now() + 1200);
	          })
	          .catch(() => {})
	          .finally(() => {
	            markBreakComplete();
	          });
	        };
	        if (impactProfile === 'beach-ball') {
	          trackAppTimeout(replaceTile, 120);
	        } else if (impactProfile === 'laser-gun') {
	          const impactVisual = (tile as any).rotG || tile;
	          // rotG has a top-edge pivot for tilt. The outer tile has its origin
	          // at the canonical cube centre and contains the complete face tree.
	          const impactScale = tile.scale;
	          // Keep one display object throughout the hit. Removing it and using
	          // openAtCell here would add a second spawn bounce after this spring.
	          const replacementValue = selectReplacementValue();
	          let laserValueSwapped = false;
	          const swapLaserValueInPlace = () => {
	            if (laserValueSwapped || !tile || tile.destroyed) return;
	            laserValueSwapped = true;
	            tile.stackDepth = 1;
	            // One atomic face commit: no duplicate deferred RAF rebuild may
	            // interrupt the rebound that begins on this same timestamp.
	            makeBoard.setValueImmediate(tile, replacementValue, 0);
	          };
	          let impactSettled = false;
	          let impactBreakQueued = false;
	          let restoreImpactPose = () => {
	            if (!tile || tile.destroyed) return;
	            tile.scale?.set?.(1, 1);
	          };
	          const laserGunImpactTimelineSeconds = (
	            LASERGUN_CUBE_REACTION_PRECEDES_BEAM_SECONDS
	            + LASERGUN_CUBE_CONTRACT_SECONDS
	            + LASERGUN_CUBE_REBOUND_SECONDS
	            + LASERGUN_CUBE_SETTLE_SECONDS
	          );
	          let releaseFrameLease = acquirePixiMobileActivityLease(
	            'laser-gun-cube-impact',
	            Math.ceil(laserGunImpactTimelineSeconds * 1000) + 100,
	          );
	          const releaseImpactFrameLease = () => {
	            releaseFrameLease();
	            releaseFrameLease = () => {};
	          };
	          const commitImpactBreak = () => {
	            if (impactSettled) return;
	            impactSettled = true;
	            // Completion, interruption and the safety timeout all converge on
	            // one canonical pose. A stalled fourth shot can never remain large.
	            try {
	              animationManager.killExternalTimeline((tile as any)?._ccLaserGunImpactTl);
	            } catch {}
	            restoreImpactPose();
	            releaseImpactFrameLease();
	            if (!tile || tile.destroyed || !board || !STATE?.tiles) {
	              releaseTntBonusTile(tile);
	              markBreakComplete();
	              return;
	            }
	            // The LaserGun replacement is already committed on the same tile;
	            // only release reservation/lifecycle ownership at the end.
	            swapLaserValueInPlace();
	            releaseTntBonusTile(tile);
	            lastTntBonusChangeAt = Date.now();
	            tntBonusGuardUntil = Math.max(tntBonusGuardUntil, Date.now() + 1200);
	            markBreakComplete();
	          };
	          const queueImpactBreakAfterPaint = () => {
	            if (impactBreakQueued || impactSettled) return;
	            impactBreakQueued = true;
	            // Keep the GSAP peak alive across a complete subsequent paint
	            // opportunity before removing the Pixi display object.
	            trackAppAnimationFrame(() => {
	              trackAppAnimationFrame(commitImpactBreak);
	            });
	          };
	          if (impactVisual && impactScale) {
	            const baseX = Number(impactVisual.x) || 0;
	            const baseRotation = Number(impactVisual.rotation) || 0;
	            restoreImpactPose = () => {
	              if (!tile || tile.destroyed) return;
	              try { impactScale.set?.(1, 1); } catch {}
	              try { impactVisual.x = baseX; } catch {}
	              try { impactVisual.rotation = baseRotation; } catch {}
	            };
	            laserGunPoseRestorers.add(restoreImpactPose);
	            try {
	              animationManager.killExternalTimeline((tile as any)._ccLaserGunImpactTl);
	              animationManager.killExternalTimeline((tile as any)._idleBounceTl);
	              gsap.killTweensOf(impactVisual);
	              gsap.killTweensOf(impactScale);
	            } catch {}
	            // Settle any interrupted idle/merge pose before LaserGun acquires
	            // the complete centred cube scale.
	            impactScale.set?.(1, 1);
	            let anticipation!: gsap.core.Timeline;
	            const clearImpactOwner = () => {
	              if ((tile as any)._ccLaserGunImpactTl === anticipation) {
	                (tile as any)._ccLaserGunImpactTl = null;
	              }
	              if ((impactVisual as any)._ccLaserGunImpactTl === anticipation) {
	                (impactVisual as any)._ccLaserGunImpactTl = null;
	              }
	            };
	            anticipation = trackTimeline({
	              onComplete: () => {
	                // Restore in the timeline's own completion tick, before any
	                // scene/scheduler cleanup can cross the final paint boundary.
	                restoreImpactPose();
	                clearImpactOwner();
	                releaseImpactFrameLease();
	                queueImpactBreakAfterPaint();
	              },
	              onInterrupt: () => {
	                clearImpactOwner();
	                restoreImpactPose();
	                releaseImpactFrameLease();
	              },
	            });
	            (tile as any)._ccLaserGunImpactTl = anticipation;
	            (impactVisual as any)._ccLaserGunImpactTl = anticipation;
	            getLaserGunCubeAnticipationFrames().forEach((frame) => {
	              anticipation.to(impactVisual, {
	                x: baseX + frame.offsetX,
	                rotation: baseRotation + frame.rotation,
	                duration: frame.durationSeconds,
	                ease: 'power1.inOut',
	              }, frame.startAtSeconds);
	            });
	            anticipation.to(impactScale, {
	              x: LASERGUN_CUBE_ANTICIPATION_SCALE,
	              y: LASERGUN_CUBE_ANTICIPATION_SCALE,
	              duration: LASERGUN_CUBE_INFLATE_SECONDS,
	              ease: 'back.out(2.1)',
	            }, 0);
	            anticipation.call(() => {
	              // Beam launch keeps smoke, shards and the bonus star together;
	              // only the cube's scale lead begins 300ms earlier.
	              emitImpactFx();
	              emitBonusStar();
	            }, [], LASERGUN_CUBE_REACTION_PRECEDES_BEAM_SECONDS);
	            anticipation.to(impactScale, {
	              x: LASERGUN_CUBE_CONTRACT_SCALE,
	              y: LASERGUN_CUBE_CONTRACT_SCALE,
	              duration: LASERGUN_CUBE_CONTRACT_SECONDS,
	              // Linear into and out of the reversal removes the perceptual
	              // zero-velocity hold between compression and first rebound.
	              ease: 'none',
	            }, LASERGUN_CUBE_REACTION_PRECEDES_BEAM_SECONDS);
	            const settleStart = LASERGUN_CUBE_REACTION_PRECEDES_BEAM_SECONDS + LASERGUN_CUBE_CONTRACT_SECONDS;
	            // Swap at 0.70 and continue immediately through the one requested
	            // rebound. There is no neutral pose or second bounce sequence.
	            anticipation.call(swapLaserValueInPlace, [], settleStart);
	            const reboundStart = settleStart + LASERGUN_CUBE_REBOUND_SECONDS;
	            anticipation.to(impactVisual, {
	              x: baseX,
	              rotation: baseRotation,
	              duration: LASERGUN_CUBE_REBOUND_SECONDS
	                + LASERGUN_CUBE_SETTLE_SECONDS,
	              ease: 'power2.out',
	            }, settleStart);
	            anticipation.to(impactScale, {
	              x: LASERGUN_CUBE_REBOUND_SCALE,
	              y: LASERGUN_CUBE_REBOUND_SCALE,
	              duration: LASERGUN_CUBE_REBOUND_SECONDS,
	              ease: 'none',
	            }, settleStart);
	            anticipation.to(impactScale, {
	              x: 1,
	              y: 1,
	              duration: LASERGUN_CUBE_SETTLE_SECONDS,
	              ease: 'sine.out',
	            }, reboundStart);
	          } else {
	            queueImpactBreakAfterPaint();
	          }
	          // Safety only: normal removal is owned by the completed and painted
	          // GSAP timeline, so wall-clock time cannot race the peak frame.
	          trackAppTimeout(commitImpactBreak, 900);
	        } else {
	          replaceTile();
	        }
	      };
	      if (impactProfile === 'laser-gun') {
	        laserGunImpactPlans.push({
	          prepare: async () => {
	            if (laserGunRunGeneration !== gameplayRunGeneration) return false;
	            if (!laserGunVisualsEnabled) return true;
	            const preparation = await Promise.race([
	              prepareActiveLaserGunFinaleImpact(i, getDomScreenPos(tile))
	                .then((ready) => ready ? 'prepared' as const : 'visual-unavailable' as const),
	              waitTrackedResult(900),
	            ]);
	            if (laserGunRunGeneration !== gameplayRunGeneration) return false;
	            if (preparation === 'cancelled') return false;
	            if (preparation === 'visual-unavailable') {
	              // Never launch toward a stale relative target. Retire the DOM
	              // scene and continue the same canonical tile commits without
	              // visual beams; gameplay order and reserved identity stay intact.
	              laserGunVisualsEnabled = false;
	              completeActiveLaserGunFinaleImpacts();
	              return true;
	            }
	            if (preparation === 'elapsed') {
	              devWarn('LaserGun visual preparation timed out; preserving native impact cadence');
	            }
	            return true;
	          },
	          commit: async () => {
	            if (laserGunRunGeneration !== gameplayRunGeneration) return false;
	            let visualArrived = false;
	            let impactCommitted = false;
	            const commitCubeImpact = (arrived: boolean) => {
	              if (impactCommitted || laserGunRunGeneration !== gameplayRunGeneration) return;
	              impactCommitted = true;
	              doBreak(arrived);
	            };
	            if (laserGunVisualsEnabled) {
	              const visualFired = triggerActiveLaserGunFinaleImpact(
	                i,
	                () => commitCubeImpact(true),
	              );
	              if (visualFired) {
	                const arrivalResult = await Promise.race([
	                  waitForActiveLaserGunFinaleImpactArrival(i)
	                    .then((arrived) => arrived ? 'arrived' as const : 'unavailable' as const),
	                  waitTrackedResult(LASERGUN_ARRIVAL_TIMEOUT_MS),
	                ]);
	                if (laserGunRunGeneration !== gameplayRunGeneration) return false;
	                if (arrivalResult === 'cancelled') return false;
	                // Once launch succeeded, a false arrival can only come from
	                // scene retirement/cleanup. Never mutate that retired board;
	                // ordinary visual failures use the entry/trigger/timeout
	                // fallback branches instead.
	                if (arrivalResult === 'unavailable') return false;
	                visualArrived = arrivalResult === 'arrived';
	                if (arrivalResult === 'elapsed') {
	                  devWarn('LaserGun beam arrival timed out; preserving native cube impact');
	                  cancelActiveLaserGunFinaleImpact(i);
	                  laserGunVisualsEnabled = false;
	                  completeActiveLaserGunFinaleImpacts();
	                }
	              }
	            }
	            // Normal path already committed synchronously in the beam-launch
	            // GSAP tick. This remains only the no-visual/timeout fallback.
	            commitCubeImpact(visualArrived);
	            return true;
	          },
	        });
	      } else if (delayMs <= 0) {
	        doBreak();
	      } else {
	        trackAppTimeout(doBreak, delayMs);
	      }
	    });
	    if (impactProfile === 'laser-gun') {
	      void (async () => {
	        const entryGate = await Promise.race([
	          laserGunEntryReadiness,
	          waitTrackedResult(1500).then((result) => result === 'elapsed' ? 'cancelled' : 'aborted'),
	        ]);
	        if (laserGunRunGeneration !== gameplayRunGeneration) return;
	        if (entryGate === 'aborted') return;
	        laserGunVisualsEnabled = entryGate === 'painted';
	        let schedulerFinished = false;
	        try {
	          const schedulerResult = await runLaserGunSequentialImpactScheduler(
	            laserGunImpactPlans,
	            waitTrackedResult,
	            Date.now,
	            laserGunVisualsEnabled ? LASERGUN_FIRST_SHOT_LEAD_MS : 0,
	          );
	          if (schedulerResult === 'cancelled') return;
	          if (laserGunVisualsEnabled && laserGunImpactPlans.length > 0) {
	            const finalBeamLaunched = await waitForActiveLaserGunFinaleBeamLaunch(
	              laserGunImpactPlans.length - 1,
	            );
	            if (!finalBeamLaunched || laserGunRunGeneration !== gameplayRunGeneration) return;
	          }
	          schedulerFinished = true;
	        } catch (error) {
	          devWarn('LaserGun sequential impact scheduler failed:', error);
	          return;
	        } finally {
	          if (schedulerFinished) completeActiveLaserGunFinaleImpacts();
	        }
	        // Only the four real commits may finish scheduling. Starting the
	        // open/spawn safety timer afterward prevents a long visual frame
	        // from releasing reserved cubes while later shots are still live.
	        const laserGunForceCompleteTimeout = completed ? null : armForceCompleteTimeout();
	        void laserGunForceCompleteTimeout;
	      })();
	    }
	    void forceCompleteTimeout;
	    devLog('🔥 TNT boom bonus: broke', count, 'regular tiles, spawned new', {
	      impactProfile,
	      staggerMs: impactProfile === 'beach-ball'
	        ? beachBallImpactDelaysMs
	        : impactProfile === 'laser-gun'
	          ? LASERGUN_SHOT_INTERVAL_MS
	          : 200,
	    });
  } catch (e) {
    devWarn('TNT boom bonus break2 failed:', e);
    releaseTntBonusTiles(ownedBonusTiles);
    notifyBoardCommitted();
    try { onComplete?.(); } catch {}
  }
}

function removeTile(t){
  merge6DestinationCleanupOwner.forget(t);
  removeTileFully(t, {
    board,
    grid,
    tiles,
    clearEndGameCache,
    stopWildIdle,
    stopWildShimmer,
    stopWildStars,
    stopWildJuiceBubbles,
    stopMagnetIdleParticles,
    stopTntIdleParticles,
    stopTntIdleShake,
    log: devLog,
  });
}

// Shared Journey/Arcade stack contact motion; tuning lives in gameplay-tile-cartoon-motion.ts.
function playMergeImpactAndAbsorbAnimation(targetTile: any): void {
  if (!targetTile) return;

  // Ensure anchor/pivot is centered for proper scaling from center
  if (targetTile.anchor) {
    targetTile.anchor.set(0.5, 0.5);
  }

  try {
    gsap.killTweensOf(targetTile.scale);
    animationManager.killExternalTimeline((targetTile as any)._mergeImpactTl);
  } catch {}

  targetTile.scale?.set?.(1, 1);
  const variant = createGameplayTileCartoonVariant('stack');
  const motionVariation = 0.97 + Math.random() * 0.06;
  let tl: gsap.core.Timeline | null = null;
  const restoreNeutralPose = () => {
    if ((targetTile as any)._mergeImpactTl !== tl) return;
    if (!targetTile.destroyed && targetTile.scale) {
      targetTile.scale.set(1, 1);
      (targetTile as any)._ccDragBaseScaleX = 1;
      (targetTile as any)._ccDragBaseScaleY = 1;
    }
    (targetTile as any)._mergeImpactTl = null;
  };

  tl = animationManager.trackExternalTimeline(gsap.timeline({
    onComplete: restoreNeutralPose,
    onInterrupt: restoreNeutralPose,
  }));
  (targetTile as any)._mergeImpactTl = tl;

  tl.to(targetTile.scale, {
    x: variant.anticipation.scaleX,
    y: variant.anticipation.scaleY,
    duration: variant.anticipation.durationSeconds * motionVariation,
    ease: variant.anticipation.ease,
  }).to(targetTile.scale, {
    x: variant.peak.scaleX,
    y: variant.peak.scaleY,
    duration: variant.peak.durationSeconds * motionVariation,
    ease: variant.peak.ease,
  }).to(targetTile.scale, {
    x: variant.rebound.scaleX,
    y: variant.rebound.scaleY,
    duration: variant.rebound.durationSeconds * motionVariation,
    ease: variant.rebound.ease,
  }).to(targetTile.scale, {
    x: 1,
    y: 1,
    duration: variant.settleDurationSeconds * motionVariation,
    ease: variant.settleEase,
  });

  devLog('🍬 Playing combined merge impact + absorb animation on tile');
}

function playRegularMergeContactPresentation(targetTile: any, sourceTile: any): void {
  if (!targetTile || targetTile.destroyed) return;

  // One owner for regular merge presentation: no duplicate smoke or legacy
  // landBounce; the shared cartoon profile owns all scale motion.
  playStackLayerClick(targetTile);
  playMergeImpactAndAbsorbAnimation(targetTile);
  playNeighborMergeRecoil(targetTile, sourceTile);
  const reducedFx = isBoardFxReduced();
  const stackSmoke = getRegularStackSmokeProfile(reducedFx);
  smokeBubblesAtTile(board, targetTile, TILE, 0.72, {
    behind: true,
    // Pure white smoke complements the existing warm contact dust and escapes
    // around all four tile edges.
    color: 0xFFFFFF,
    colors: [0xFFFFFF],
    haloColor: 0xFFFFFF,
    blendMode: 'normal',
    baseAlpha: stackSmoke.baseAlpha,
    trailAlpha: stackSmoke.trailAlpha,
    sizeScale: stackSmoke.sizeScale,
    sizeBoostChance: stackSmoke.sizeBoostChance,
    sizeBoostScale: stackSmoke.sizeBoostScale,
    distanceScale: stackSmoke.distanceScale,
    countScale: stackSmoke.countScale,
    bursts: reducedFx ? 3 : 3,
    burstGap: 0.022,
    ttl: 0.55,
    durationScale: stackSmoke.durationScale,
    haloAlpha: 0.28,
    haloScale: 0.72,
    fxTag: 'stack-smoke',
    spawnShape: 'edges',
  });
}

function playStackLayerClick(targetTile: any): void {
  const layers = targetTile?.stackG?.children;
  if (!Array.isArray(layers) || layers.length === 0) return;
  const layer = layers[layers.length - 1];
  if (!layer || layer.destroyed) return;

  const baseRotation = Number(layer.rotation || 0);
  const direction = Math.random() < 0.5 ? -1 : 1;
  const clickRotation = direction * (0.035 + Math.random() * 0.017); // 2–3°
  try { gsap.killTweensOf(layer); } catch {}
  try {
    layer.rotation = baseRotation + clickRotation;
    trackTween(layer, {
      rotation: baseRotation,
      duration: 0.13 + Math.random() * 0.025,
      ease: 'back.out(2.3)',
      overwrite: 'auto',
    });
  } catch {
    try { layer.rotation = baseRotation; } catch {}
  }
}

function playNeighborMergeRecoil(targetTile: any, sourceTile: any): void {
  if (!targetTile || targetTile.destroyed) return;
  if (isBoardFxReduced()) return;
  const candidates = tiles
    .filter((tile: any) => {
      if (!tile || tile === targetTile || tile === sourceTile || tile.destroyed || tile.locked) return false;
      if (tile.special || tile.isWild || tile.isWildFace) return false;
      const distance = Math.hypot(Number(tile.x || 0) - Number(targetTile.x || 0), Number(tile.y || 0) - Number(targetTile.y || 0));
      return distance > 0 && distance <= TILE * 1.55;
    })
    .sort((a: any, b: any) => {
      const da = Math.hypot(a.x - targetTile.x, a.y - targetTile.y);
      const db = Math.hypot(b.x - targetTile.x, b.y - targetTile.y);
      return da - db;
    })
    .slice(0, 4);

  for (const tile of candidates) {
    const visual = tile.rotG;
    if (!visual || visual.destroyed) continue;
    const baseX = Number(visual.x || 0);
    const baseY = Number(visual.y || 0);
    const dx = Number(tile.x || 0) - Number(targetTile.x || 0);
    const dy = Number(tile.y || 0) - Number(targetTile.y || 0);
    const length = Math.max(1, Math.hypot(dx, dy));
    const impulse = 1.25 + Math.random() * 0.65;
    try { gsap.killTweensOf(visual); } catch {}
    animationManager.trackExternalTimeline(gsap.timeline({
      onComplete: () => {
        if (!visual.destroyed) visual.position.set(baseX, baseY);
      },
    }))
      .to(visual, {
        x: baseX + (dx / length) * impulse,
        y: baseY + (dy / length) * impulse,
        duration: 0.055,
        ease: 'power2.out',
      })
      .to(visual, {
        x: baseX,
        y: baseY,
        duration: 0.105,
        ease: 'back.out(2)',
      });
  }
}

function playMerge6HeroBounce(targetTile: any): void {
  if (!targetTile || targetTile.destroyed || !targetTile.scale) return;
  try { gsap.killTweensOf(targetTile.scale); } catch {}
  const peak = 1.15 + Math.random() * 0.018;
  animationManager.trackExternalTimeline(gsap.timeline({
    onComplete: () => {
      if (!targetTile.destroyed && targetTile.scale) targetTile.scale.set(1, 1);
    },
  }))
    .to(targetTile.scale, {
      x: peak,
      y: peak,
      duration: 0.105,
      ease: 'back.out(2.5)',
    })
    .to(targetTile.scale, {
      x: 1,
      y: 1,
      duration: 0.17,
      ease: 'back.out(1.9)',
    });
}

async function showFinalScreen({ confirmedFailFlow = false }: { confirmedFailFlow?: boolean } = {}){
  const terminalRunGeneration = gameplayRunGeneration;
  const terminalPresentationIsCurrent = (): boolean => (
    terminalRunGeneration === gameplayRunGeneration
    && (window as any).exitingToMenu !== true
  );
  if (!terminalPresentationIsCurrent()) return;
  // 🔥 CRITICAL: Guard against multiple simultaneous calls
  if (busyEnding && !confirmedFailFlow) {
    devWarn('⚠️ showFinalScreen: busyEnding is true, skipping duplicate call');
    return;
  }
  
  busyEnding = true;
  failScreenFlowInProgress = true;
  // Clear fail-screen-pending flag (busyEnding now covers this)
  (window as any).__ccFailScreenPending = false;
  const isArcadeRunReachedSummary =
    isArcadeHomeRunMode() &&
    Math.max(1, boardNumber | 0) > 1;

  // 🔥 FIX: Wrap in try/finally to ensure busyEnding is always reset
  try {
  // Clear NO MOVES splash if visible (shown during 1.5s wait before fail)
  try { clearNoMovesText(); } catch {}
  // Extra safety: scrub any lingering magnet merge-6 residues before showing fail/clean flows
  forceRemoveMagnetMergeResidues('showFinalScreen');

  // Targeted game-over handoff. Legacy code waited on broad global FX state;
  // confirmed NO MOVES already displayed the terminal text, so it can go straight to board exit.
  try {
    const { waitForGameOverAnimationHandoff } = await import('./game-over-animation-handoff.js');
    await waitForGameOverAnimationHandoff({
      confirmedFailFlow,
      isArcade: isArcadeHomeRunMode(),
    });
  } catch (e) {
    devWarn('⚠️ game-over animation handoff failed (non-fatal):', e);
  }
  if (!terminalPresentationIsCurrent()) return;

  if (confirmedFailFlow) {
    try {
      const { playGameOverBoardExitAnimation } = await import('./game-over-board-exit-animation.js');
      await playGameOverBoardExitAnimation();
    } catch (error) {
      devWarn('⚠️ Game-over board exit animation failed (continuing to end screen):', error);
    }
  }
  if (!terminalPresentationIsCurrent()) return;
  
  // 🔥 CRITICAL: Perform memory cleanup on game over (MEMORY LEAK FIX)
  devLog('🧹 Performing memory cleanup on game over...');
  try {
    memoryManager.performCleanup();
    devLog('✅ Memory cleanup completed');
  } catch (error) {
    devWarn('⚠️ Memory cleanup failed:', error);
  }
  if (!terminalPresentationIsCurrent()) return;
  
  // Arcade Stage 02+ run end is a progress summary; Stage 01 fail remains a real fail.
  if (isArcadeRunReachedSummary) {
    try {
      const { clearArcadeSaveState } = await import('../utils/board-save-utils.js');
      clearArcadeSaveState();
      (window as any).__ccForceArcadeRestartStage01 = true;
      devLog('🎮 Arcade run reached summary - cleared saved no-moves state immediately');
    } catch (error) {
      devWarn('⚠️ Failed to clear Arcade save before reached summary:', error);
    }

    if (typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact('medium');
    }
  } else if (typeof (window as any).triggerHapticNotification === 'function') {
    (window as any).triggerHapticNotification('error');
  }
  
  let result = null;
  try {
    if (isArcadeRunReachedSummary) {
      const { showCleanBoardModal } = await import('./clean-board-modal.js');
      result = await showCleanBoardModal({
        app,
        stage,
        getScore: () => Math.max(0, score | 0),
        setScore: (nextScore) => { score = Math.max(0, nextScore | 0); updateHUD(); },
        animateScore,
        updateHUD,
        comboBonus: 0,
        efficiencyBonus: 0,
        bonus: 0,
        boardNumber: Math.max(1, boardNumber | 0),
        arcadeRunReached: true,
      });
    } else {
      const { showBoardFailModal } = await import('./board-fail-modal.js');
      result = await showBoardFailModal({
        score: Math.max(0, score | 0),
        boardNumber: Math.max(1, boardNumber | 0)
      });
    }
  } catch (error) {
    devError('❌ CRITICAL: End-run modal failed - cannot show end screen:', error);
    devError('❌ This should never happen. Check board-fail-modal.js / clean-board-modal.js for errors.');
    // Don't show old stars modal - it's deprecated and shows wrong UI
  }

  // 🔥 USER REQUEST: DO NOT update high score on fail!
  // High score is ONLY updated after successful clean board (in endgame-flow.ts)
  // Fail = ne updateamo high score
  devLog(isArcadeRunReachedSummary
    ? `📊 Arcade run ended at stage ${boardNumber}`
    : `📊 Board ${boardNumber} failed - high score NOT updated (only on clean board success)`);
  updateHUD();

  if (isArcadeHomeRunMode()) {
    try {
      const { clearArcadeSaveState } = await import('../utils/board-save-utils.js');
      clearArcadeSaveState();
    } catch {}

    if (result?.action === 'play-again' || result?.action === 'retry' || result?.action === 'continue') {
      if (isArcadeRunReachedSummary) {
        try { (window as any).__ccForceArcadeRestartStage01 = true; } catch {}
        devLog('🎮 Arcade run reached Play Again - restarting fresh Round 01');
        // Round 02+ failures resolve through the Arcade run-summary modal rather
        // than board-fail-modal. Keep both retry owners on the same HUD-entry
        // contract so the fresh Round 01 HUD is primed and drops at dice midpoint.
        restart({ animateHudDrop: true });
      } else {
        // Board fail modal already calls window.CC.restart() immediately on Play Again.
        // Calling restartGame() again here causes a visible double board load.
        devLog('🎮 Arcade fail Play Again already handled by board-fail-modal - skipping duplicate restart');
      }
    } else if (result?.action === 'exit' || result?.action === 'menu') {
      if (isArcadeRunReachedSummary) {
        devLog('🚪 Arcade run reached Exit - returning to menu');
        try {
          markArcadeHomeRunOrigin();
          (window as any).__skipBoardExitAnimation = true;
          (window as any).__ccFastArcadeCleanExit = true;
          const { requestExitToMenu } = await import('./menu-exit-handoff.js');
          await requestExitToMenu({
            reason: 'arcade-summary-exit',
            target: 'homepage',
            skipBoardExit: true,
            fastArcadeCleanExit: true,
          });
        } catch (error) {
          devWarn('⚠️ Arcade run reached exitToMenu failed:', error);
          await ensureArcadeSummaryExitShowsHomepage('exitToMenu-failed');
        }
      } else {
        // Board fail modal already starts the menu handoff immediately on Exit.
        // Running it again here can wait on the in-flight exit and leave a paper-only gap.
        devLog('🚪 Arcade fail Exit already handled by board-fail-modal - skipping duplicate menu exit');
      }
    }
  } else if (result?.action === 'menu') {
    // 🔥 BUG FIX: exitToMenu is already called in board-fail-modal.ts when Exit button is clicked
    // Don't call it again here - it causes duplicate calls and blank screen
    // The modal already handles exitToMenu and waits for it to complete before resolving
    devLog('🚪 Exit action received - exitToMenu already called from board-fail-modal, skipping duplicate call');
  } else if (result?.action === '__navigation-abort__') {
    devLog('⏭️ Fail modal invalidated by navigation - stopping stale fail flow');
  } else {
    // 'retry' action - functions are called directly from board-fail-modal now
    devLog('🎮 Play Again action received - functions called directly from modal');
  }
  } finally {
    try { setFinalMergeVisualSuppression(false); } catch {}
    // 🔥 FIX: Ensure busyEnding is always reset, even on error
    busyEnding = false;
    failScreenFlowInProgress = false;
    activeNoMovesInputLockToken = null;
    try { (window as any).__ccTerminalEndScreenPending = false; } catch {}
    try { setInputGateLock('terminal-no-moves', false); } catch {}
  }
}

async function ensureArcadeSummaryExitShowsHomepage(reason = 'arcade-summary-exit'): Promise<void> {
  try {
    const { ensureMenuVisibleAfterExit } = await import('./menu-exit-handoff.js');
    await ensureMenuVisibleAfterExit({ reason, target: 'homepage' });
  } catch (error) {
    devWarn('⚠️ Arcade summary homepage handoff failed:', error);
  }
}

let restartGameInFlight: Promise<void> | null = null;

async function restartGame(): Promise<void> {
  if (restartGameInFlight) return restartGameInFlight;
  const operation = performRestartGame();
  restartGameInFlight = operation;
  try {
    await operation;
  } finally {
    if (restartGameInFlight === operation) restartGameInFlight = null;
  }
}

async function performRestartGame(): Promise<void> {
  devLog('🔄 Starting clean restart - preserving HUD position');
  
  // CRITICAL FIX: Reset game ended flag when restarting
  window._gameHasEnded = false;
  // Hard reset fail/endgame guards to avoid stale "pending fail" or final-merge suppression on Play Again.
  resetTransientEndgameRuntimeState('restartGame');

  // Hide stale board display objects before any slower restart cleanup. This prevents
  // a one-frame flash of old tiles after No Moves -> Play Again while the modal fades out.
  try {
    softResetBoardView('restartGame-immediate-clear');
  } catch (error) {
    devWarn('⚠️ RESTART: Failed immediate board clear:', error);
  }

  const killAllGsapTweensForRestart = () => {
    try {
      devLog('🔄 RESTART GAME: Killing GSAP animations...');
      
      // 🔥 CRITICAL: Stop tile idle bounce animations
      try {
        if (TILE_IDLE_BOUNCE && typeof TILE_IDLE_BOUNCE.stop === 'function') {
          TILE_IDLE_BOUNCE.stop();
          devLog('✅ RESTART GAME: Tile idle bounce stopped');
        }
      } catch {}
      
      // 🔥 CRITICAL: Cleanup combo animations
      try {
        if (typeof HUD.cleanupComboAnimations === 'function') {
          HUD.cleanupComboAnimations();
          devLog('✅ RESTART GAME: Combo animations cleaned up');
        }
      } catch {}
      
      // 🔥 CRITICAL: Kill combo idle timer
      try { 
        if (comboIdleTimer) {
          if (typeof (comboIdleTimer as any).kill === 'function') {
            (comboIdleTimer as any).kill();
          } else if (typeof comboIdleTimer === 'number') {
            clearTimeout(comboIdleTimer);
          }
        }
        comboIdleTimer = null;
        devLog('✅ RESTART GAME: Combo idle timer killed');
      } catch {}
      
      // Retire the bounded v915 wild-meter smoke owner and its live nodes.
      wild?.view?._stopWildMeterSmoke?.();
      gsap.killTweensOf(wild?.view?._fill);
      if (wild?.view?._currentAnimation) {
        wild.view._currentAnimation.kill();
        wild.view._currentAnimation = null;
      }
      // 🔥 CRITICAL: Kill HUD progress bar animations
      try {
        gsap.killTweensOf('[data-wild-loader]');
        gsap.killTweensOf('.wild-loader');
        if (wild && wild.view) {
          gsap.killTweensOf(wild.view);
          if (wild.view._fill) {
            gsap.killTweensOf(wild.view._fill);
          }
          if (wild.view._mask) {
            gsap.killTweensOf(wild.view._mask);
          }
        }
        devLog('✅ RESTART GAME: HUD progress bar animations killed');
      } catch {}
      
      // CRITICAL: Stop per-tile animations before GSAP cleanup
      if (STATE && STATE.tiles && STATE.tiles.length > 0) {
        devLog('🔄 RESTART GAME: Killing GSAP animations for', STATE.tiles.length, 'tiles...');
        STATE.tiles.forEach(tile => {
          try {
            try { stopWildIdle?.(tile); } catch {}
            try { stopWildShimmer?.(tile); } catch {}
            try { stopWildStars?.(tile); } catch {}
            try { stopWildJuiceBubbles?.(tile); } catch {}
            try { stopMagnetIdleParticles?.(tile); } catch {}
            try { stopTntIdleParticles?.(tile); } catch {}
            if ((tile as any)?._glowAnimation) {
              try { (tile as any)._glowAnimation.kill(); } catch {}
              (tile as any)._glowAnimation = null;
            }
          } catch {}
        });
        devLog('✅ RESTART GAME: Tile GSAP animations killed');
      }
      
      // Kill HUD animations
      if (STATE && STATE.hud) {
        try {
          devLog('🔄 RESTART GAME: Killing HUD GSAP animations...');
          gsap.killTweensOf(STATE.hud);
          gsap.killTweensOf(STATE.board);
          gsap.killTweensOf(STATE.stage);
          devLog('✅ RESTART GAME: HUD GSAP animations killed');
        } catch {}
      }
      
      killAllGsapTweensCommon(STATE?.tiles || tiles, 'restart', { clearTimeline: true });
    } catch (e) {
      devWarn('⚠️ RESTART GAME: Error killing GSAP animations:', e);
    }
  };
  
  // CRITICAL: Update high score before restart using statsService
  try {
    if (typeof score !== 'undefined' && score > 0) {
      devLog('🏆 Updating high score before restart:', score);
      statsService.updateHighScore(score);
      if (isArcadeHomeRunMode()) {
        arcadeStatsService.updateHighScore(score);
      }
    }
  } catch (error) {
    devWarn('⚠️ Failed to update high score during restart:', error);
  }

  // Centralized FX cleanup (non-destructive to the app)
  cleanupFxForBoardReset('restartGame');
  try { FLOW.cleanupLevelFlowTimeouts(); } catch {}
  
  // Kill all GSAP animations first - CRITICAL to prevent null reference errors
  killAllGsapTweensForRestart();
  
  // CRITICAL: Cleanup smoke bubbles before restart
  try {
    if (typeof HUD.cleanupSmokeBubbles === 'function') {
      HUD.cleanupSmokeBubbles();
      devLog('✅ RESTART GAME: Smoke bubbles cleaned up');
    }
  } catch {}
  
  // 🔥 NOTE: FX cleanup already handled by cleanupFxForBoardReset() at start of restartGame()
  
  // 🔥 CRITICAL: Cleanup confetti animations before restart (MEMORY LEAK FIX)
  try {
    import('./confetti-system.js').then(confettiModule => {
      if (confettiModule && typeof confettiModule.cleanupConfetti === 'function') {
        confettiModule.cleanupConfetti();
      }
    }).catch(() => {
      // Ignore import errors
    });
  } catch {}
  
  const forceArcadeStage01 = isArcadeHomeRunMode() && (window as any).__ccForceArcadeRestartStage01 === true;
  if (forceArcadeStage01) {
    delete (window as any).__ccForceArcadeRestartStage01;
  }
  // Keep current board by default; Arcade fail Play Again can explicitly start a fresh Stage 01 run.
  const currentBoard = forceArcadeStage01 ? 1 : (boardNumber || 1);
  devLog(`🔄 RESTART: Restart target board ${currentBoard}`, { forceArcadeStage01 });
  
  // Reset game state WITHOUT touching HUD positioning or boardNumber
  score = 0;
  // boardNumber stays the same - don't reset to 1!
  moves = MOVES_MAX;
  hudResetCombo();
  try { 
    if (comboIdleTimer) {
      if (typeof (comboIdleTimer as any).kill === 'function') {
        (comboIdleTimer as any).kill();
      } else if (typeof comboIdleTimer === 'number') {
        clearTimeout(comboIdleTimer);
      }
    }
  } catch {}
  wildMeter = 0;
  resetWildProgress(0, false);
  
  // HARD RESET: Use new resetWildMeter API for complete reset
  devLog('🔥 HARD RESET: Resetting wild meter to 0');
  try {
    if (typeof HUD.resetWildMeter === 'function') {
      HUD.resetWildMeter(true); // instant = true for immediate reset
    } else {
      devLog('🔄 FALLBACK: Using HUD.updateProgressBar with 0...');
      HUD.updateProgressBar?.(0, false);
    }
    devLog('✅ HARD RESET: Wild meter reset to 0 successfully');
  } catch (error) {
    devError('❌ HARD RESET: Error resetting wild meter:', error);
  }
  
  // Reset both wild meter variables
  wildMeter = 0;
  STATE.wildMeter = 0;

  // 🔥 CRITICAL FIX: Reset star count when restarting from end game bottom sheet
  try {
    devLog('🔄 RESTART GAME: Resetting star count...');
    // Reset stars collector via window.CC.setStarsCount (exported above)
    if (typeof window.CC?.setStarsCount === 'function') {
      window.CC.setStarsCount(0);
      devLog('✅ RESTART GAME: Star count reset to 0');
    } else {
      // Fallback: try to import and reset directly
      import('./stars-collector.js').then((StarsCollector) => {
        if (typeof StarsCollector.setStarsCount === 'function') {
          StarsCollector.setStarsCount(0);
          devLog('✅ RESTART GAME: Star count reset to 0 (via import)');
        }
      }).catch((err) => {
        devWarn('⚠️ RESTART GAME: Failed to reset star count:', err);
      });
    }
  } catch (error) {
    devWarn('⚠️ RESTART GAME: Error resetting star count:', error);
  }

  // EDGE CASE PROTECTION: Force wild meter reset with multiple methods
  try {
    devLog('🛡️ EDGE CASE: Force resetting wild meter with multiple methods...');
    
    // Method 1: Direct HUD update
    if (typeof HUD.updateProgressBar === 'function') {
      HUD.updateProgressBar(0, false);
    }
    
    // Method 2: Reset via setWildProgress
    setWildProgress(0, false);
    
    // Method 3: Direct wild meter variable reset
    wildMeter = 0;
    STATE.wildMeter = 0; // Reset both variables!
    
    // Method 4: Force update progress bar
    if (typeof HUD.updateProgressBar === 'function') {
      devLog('🔄 EDGE CASE: Calling HUD.updateProgressBar(0, false)...');
      HUD.updateProgressBar(0, false);
    }
    
    // Method 5: Force reset wild loader
    if (typeof HUD.resetWildLoader === 'function') {
      devLog('🔄 EDGE CASE: Calling HUD.resetWildLoader...');
      HUD.resetWildLoader();
    }
    
    // Method 6: Force update HUD
    updateHUD();
    
    // Method 7: Direct PIXI manipulation - force reset wild loader mask
    try {
      // Also try direct access to wild loader if available
      if (typeof wild !== 'undefined' && wild && wild.setProgress) {
        devLog('🔄 EDGE CASE: Direct wild.setProgress(0, false)...');
        wild.setProgress(0, false);
      }
    } catch (e) {
      devWarn('EDGE CASE: Direct PIXI reset failed:', e);
    }
    
    devLog('✅ EDGE CASE: Wild meter force reset completed');
  } catch (error) {
    devError('❌ EDGE CASE: Error in force reset:', error);
  }
  
  // 🔥 CRITICAL FIX: Clear saved game state from localStorage before restarting
  // This ensures we get a FRESH board, not the stuck/failed state
  try {
    localStorage.removeItem('cc_saved_game');
    devLog('✅ RESTART: Cleared stuck game state from localStorage');
  } catch (e) {
    devWarn('⚠️ RESTART: Failed to clear localStorage:', e);
  }
  
  // 🔥 CRITICAL FIX: Clear __ccSkipRebuildBoard flag to force fresh board
  delete window.__ccSkipRebuildBoard;
  logger.debug('✅ RESTART: Cleared __ccSkipRebuildBoard flag - will rebuild fresh board', 'app-core');
  
  // 🔥 NOTE: cleanupGame() is NOT called here because it destroys the PIXI app
  // cleanupGame() is only for complete game exit (exit to menu), not for restart
  // restartGame() already has comprehensive cleanup (GSAP animations, confetti, effects, etc.)
  // without destroying the app, which allows startLevel() to work properly
  
  // 🔥 OPTIMIZATION: Clear tracked app timeouts BEFORE starting the new level
  clearAllAppTimeouts();

  // If restart follows a game-over board exit, old tile display objects can remain
  // mid-scale for one frame. Clear the view before the new board pop-in starts.
  try {
    softResetBoardView('restartGame-before-startLevel');
  } catch (error) {
    devWarn('⚠️ RESTART: Failed to soft reset board view before startLevel:', error);
  }

  // 🔥 USER REQUEST: Call startLevel() with current boardNumber instead of just rebuildBoard()
  // This ensures board-specific rules are applied and the correct board is restarted
  devLog(`🔄 RESTART: Calling startLevel(${currentBoard}) to restart board ${currentBoard}...`);
  const restartLevelPromise = startLevel(currentBoard);
  const restartEntryGeneration = activeGameplayEntryGeneration;
  await restartLevelPromise;
  if (
    activeGameplayEntryGeneration !== restartEntryGeneration ||
    !isGameplayEntryGenerationLatest(restartEntryGeneration)
  ) {
    devWarn(`⏭️ RESTART: startLevel(${currentBoard}) was superseded by a newer gameplay entry`);
    return;
  }
  devLog(`✅ RESTART: startLevel(${currentBoard}) completed`);
  
  // Reinitialize background layer if it was lost
  if (!backgroundLayer) {
    devLog('🔄 RESTART: Reinitializing background layer...');
    initializeBackgroundLayer();
    devLog('✅ RESTART: Background layer reinitialized');
  }
  
  updateHUD();
  
  // 🔥 CRITICAL: Cleanup confetti animations (cleanup all timeouts/intervals/DOM elements)
  // This must be called BEFORE killAllDelayedCalls to ensure all confetti timeouts are cleared
  try {
    import('./confetti-system.js').then(confettiModule => {
      if (confettiModule && typeof confettiModule.cleanupConfetti === 'function') {
        confettiModule.cleanupConfetti();
      }
    }).catch(() => {
      // Ignore import errors
    });
  } catch (e) {
    // Ignore errors
  }
  
  // Ensure game is resumed after restart
  try {
    gsap.globalTimeline.resume();
    app.ticker.start();
    devLog('✅ Game resumed after restart');
  } catch (error) {
    devWarn('Failed to resume game after restart:', error);
  }
  
  devLog('✅ Clean restart completed - HUD position preserved');
}
// Pause/Resume functions
export function pauseGame() {
  try {
    gsap.globalTimeline.pause();
    app.ticker.stop();
  } catch {}
}

export function resumeGame() {
  try {
    gsap.globalTimeline.resume();
    app.ticker.start();
  } catch {}
}

type RestartOptions = {
  animateHudDrop?: boolean;
};

export async function restart(options: RestartOptions = {}): Promise<void> {
  devLog('🔄 RESTART: Starting restart function');

  if (options.animateHudDrop === true) {
    // Establish retry HUD ownership before restartGame reaches its fire-and-forget
    // startLevel call and subsequent updateHUD. startLevel crosses async texture work
    // before its normal trigger handler, which is too late for a fail retry.
    (window as any).__ccTriggerHudDrop = true;
    handleStartLevelHudDrop({
      HUD,
      gsap,
      logger,
      getHudRootFromWindow: () => (window as any).HUD_ROOT,
      isTriggerHudDrop: () => !!(window as any).__ccTriggerHudDrop,
      clearTriggerHudDrop: () => { delete (window as any).__ccTriggerHudDrop; },
      setHudDropPending: (v) => { _hudDropPending = v; },
      setHudInitDone: (v) => { _hudInitDone = v; },
    });
    const hudRoot = (window as any).HUD_ROOT || HUD.HUD_ROOT || null;
    console.info('[CC_HUD_RETRY_TRACE] restart-armed-before-async', {
      pending: _hudDropPending,
      zone: (window as any).__ccAppZone,
      exitingToMenu: (window as any).exitingToMenu === true,
      y: hudRoot?.y,
      alpha: hudRoot?.alpha,
      dropped: hudRoot?._dropped,
    });
  }
  
  // 🔥 JOURNEY PROGRESSION: Update state when restarting (retry after failure)
  // Keep lastOpenedBoardId and set currentRunState for the same board
  try {
    import('./journey-progression-state.js').then(({ journeyProgressionState }) => {
      const currentBoardId = boardNumber || 1;
      journeyProgressionState.setLastOpenedBoardId(currentBoardId);
      journeyProgressionState.setCurrentRunState(currentBoardId, 0);
      devLog(`🗺️ Journey: Restarting board ${currentBoardId} - lastOpenedBoardId and currentRunState updated`);
    }).catch((error) => {
      devWarn('⚠️ Failed to update Journey progression state on restart:', error);
    });
  } catch (error) {
    devWarn('⚠️ Failed to update Journey progression state on restart:', error);
  }
  
  devLog('🔄 RESTART: About to call restartGame()...');
  await restartGame();
  devLog('✅ RESTART: restartGame() completed');
}

// Clean up game when exiting
export function cleanupGame(options: { destroyRenderer?: boolean } = {}) {
  // Preserve the historic hard-teardown default for explicit shutdown/fatal
  // callers. Ordinary route exit must opt into the soft renderer session.
  const destroyRenderer = options.destroyRenderer !== false;
  devLog('🧹 Cleaning up game state');
  // Retire every hidden-entry owner before destroying its Pixi/DOM targets.
  // Waiting for uiManager.hideApp() leaves a window where a stale Round cue or
  // prepared commit can re-hide the next Homepage/new-game surface.
  cancelGameplayEntryPreparation();
  cancelArcadeEntryCueOwner();
  cancelArcadeEntrySurfaceGate();
  stopBoardFrameBudgetMonitor();
  stopPixiMobileFrameController();
  
  // 🔥 CRITICAL FIX: Stop PIXI ticker FIRST to prevent render errors during cleanup
  // This prevents "Cannot read properties of null (reading '_x')" errors
  try {
    if (app && app.ticker) {
      app.ticker.stop();
      devLog('✅ PIXI ticker stopped for cleanup');
    }
  } catch (e) {
    devWarn('⚠️ Failed to stop ticker:', e);
  }
  
  // 🔥 CRITICAL FIX: Stop and reset tile idle bounce animations
  try {
    TILE_IDLE_BOUNCE.stop();
    if (TILE_IDLE_BOUNCE.reset) {
      TILE_IDLE_BOUNCE.reset();
    }
    devLog('✅ Tile idle bounce stopped and reset');
  } catch (error) {
    devWarn('⚠️ Failed to stop/reset tile idle bounce:', error);
  }

  // HUD owns independent tap-lock and delayed reset timers; clear those before
  // destroying PIXI targets so no callback can touch a dead HUD after exit.
  try { HUD.cleanupHudTimeouts?.(); } catch {}
  
  // CRITICAL: Update high score before cleanup using statsService
  try {
    if (typeof score !== 'undefined' && score > 0) {
      devLog('🏆 Updating high score before cleanup:', score);
      statsService.updateHighScore(score);
      if (isArcadeHomeRunMode()) {
        arcadeStatsService.updateHighScore(score);
      }
    }
  } catch (error) {
    devWarn('⚠️ Failed to update high score during cleanup:', error);
  }
  
  // 🔥 CRITICAL FIX: Kill all GSAP tweens BEFORE destroying objects
  // This prevents "Cannot read properties of null (reading 'y')" errors
  killAllGsapTweensCommon(tiles, 'cleanup');
  try { gsap.killTweensOf([hud, board, stage]); } catch {}

  // 🔥 Explicit wild-TNT animation cleanup (same as wild-juice / stars)
  try {
    stopTntAnimation?.();
    devLog('✅ TNT animation cleaned up in cleanupGame()');
  } catch (e) {
    devWarn('⚠️ Failed to cleanup TNT animation:', e);
  }
  try {
    stopSparkleText?.();
  } catch (e) {
    devWarn('⚠️ Failed to cleanup SPARKLE text:', e);
  }

  try {
    cleanupWildSpawnDropAnimations?.();
    devLog('✅ Wild spawn drop animations cleaned up in cleanupGame()');
  } catch (e) {
    devWarn('⚠️ Failed to cleanup wild spawn drop animations:', e);
  }
  
  // 🔥 NOTE: Global delayed calls/graphics cleanup handled by cleanupFxForBoardReset('cleanupGame')
  
  // CRITICAL: Reset HUD initialization flag
  _hudInitDone = false;
  // Prepare HUD drop for next entry from menu
  _hudDropPending = true;
  devLog('✅ HUD initialization flag reset');
  
  // Reset all game state
  score = 0;
  boardNumber = 1;
  moves = MOVES_MAX;
  level = 1;
  combo = 0;
  wildMeter = 0;
  busyEnding = false;
  failScreenFlowInProgress = false;
  
  // Clear timers
  try { 
    if (comboIdleTimer) {
      if (typeof (comboIdleTimer as any).kill === 'function') {
        (comboIdleTimer as any).kill();
      } else if (typeof comboIdleTimer === 'number') {
        clearTimeout(comboIdleTimer);
      }
    }
  } catch {}
  comboIdleTimer = null;
  
  // 🔥 CRITICAL FIX: Clear all tracked timeouts
  clearAllAppTimeouts();
  
  // 🔥 CRITICAL FIX: Clear all tracked requestAnimationFrame callbacks
  hudStarHudFeedbackFramePending = false;
  clearAllAppAnimationFrames();
  
  // 🔥 CRITICAL FIX: Clear all tracked intervals
  clearAllAppIntervals();
  
  // 🔥 CRITICAL FIX: Clear all tracked app-core event listeners
  clearAllAppListeners();
  
  // 🔥 CRITICAL FIX: Remove event listeners properly
  // Remove resize listeners for layoutBoard and layout
  try { 
    window.removeEventListener('resize', layoutBoard); 
  } catch (e) {
    devWarn('⚠️ Failed to remove resize listener:', e);
  }
  // Note: 'layout' function was removed - this listener cleanup is no longer needed
  
  // 🔥 CRITICAL FIX: Remove HUD resize listener (stored in HUD_ROOT._onResize)
  // This is the MAIN MEMORY LEAK - HUD_ROOT._onResize listener is never removed!
  try {
    const hudRoot = (window as any).HUD_ROOT;
    if (hudRoot && hudRoot._onResize) {
      window.removeEventListener('resize', hudRoot._onResize);
      devLog('✅ HUD resize listener removed (HUD_ROOT._onResize)');
      hudRoot._onResize = null; // Clear reference
    }
  } catch (e) {
    devWarn('⚠️ Failed to remove HUD resize listener:', e);
  }
  
  // 🔥 CRITICAL FIX: Cleanup HUD lifecycle listeners (screen lifecycle helper)
  try { HUD.cleanupHudLifecycle?.(); } catch {}
  
  // Reset wild progress (with safety check for HUD)
  try {
    if (HUD && typeof HUD.resetWildLoader === 'function') {
      resetWildProgress(0, false);
      HUD.resetWildLoader();
    }
  } catch (error) {
    devLog('⚠️ Wild progress reset skipped (HUD already destroyed):', error);
  }
  
  // Clear tiles and grid
  if (tiles) {
    tiles.forEach(t => {
      // 🔥 MEMORY LEAK FIX: Cleanup all tile animations and intervals before destroy
      try { stopWildIdle?.(t); } catch {}
      try { stopWildShimmer?.(t); } catch {}
      try { stopWildStars?.(t); } catch {}
      try { stopWildJuiceBubbles?.(t); } catch {}
      try { stopMagnetIdleParticles?.(t); } catch {}
      try { stopTntIdleParticles?.(t); } catch {}
      try { t.destroy?.({ children: true, texture: false, textureSource: false } as any); } catch {}
    });
    tiles.length = 0;
  }
  
  // 🔥 CRITICAL FIX: Cleanup wild juice explosion (GSAP ticker + PIXI containers)
  // 🔥 BUBBLES ANIMATION FIX: Always cleanup to prevent stale state (even if flag says inactive)
  // 🔥 STARS ANIMATION FIX: Cleanup stars-to-HUD animations to prevent memory leaks
  try {
    if (typeof isWildJuiceBubblesExplosionActive === 'function' && typeof stopWildJuiceBubblesExplosion === 'function') {
      const wasActive = isWildJuiceBubblesExplosionActive();
      // Always cleanup (even if flag says inactive) to handle stale containers/flags
      stopWildJuiceBubblesExplosion();
      if (wasActive) {
        devLog('✅ Wild juice explosion cleaned up in cleanupGame()');
      } else {
        devLog('✅ Wild juice explosion force cleaned up in cleanupGame() (stale state prevention)');
      }
    }
    
    // 🔥 CRITICAL FIX: Release cached bubble texture to free GPU memory on hard cleanup
    try {
      destroyWildJuiceBubblesExplosionCache?.();
      devLog('✅ Wild juice bubble texture cache destroyed');
    } catch {}
    
    // 🔥 STARS ANIMATION FIX: Force cleanup ALL stars-to-HUD animations (including protected)
    // Use force cleanup in cleanupGame() because we're closing the game completely
    if (typeof forceCleanupAllStarAnimations === 'function') {
      forceCleanupAllStarAnimations();
      devLog('✅ Stars-to-HUD animations force cleaned up in cleanupGame()');
    } else if (typeof cleanupExistingStarAnimations === 'function') {
      // Fallback to regular cleanup if force cleanup not available
      cleanupExistingStarAnimations();
      devLog('✅ Stars-to-HUD animations cleaned up in cleanupGame()');
    }
  } catch (e) {
    devWarn('⚠️ Failed to cleanup animations:', e);
    // 🔥 CRITICAL: Force cleanup on error (prevents stuck state)
    try {
      if (typeof stopWildJuiceBubblesExplosion === 'function') {
        stopWildJuiceBubblesExplosion();
      }
      // 🔥 STARS ANIMATION FIX: Force cleanup stars animations on error
      if (typeof cleanupExistingStarAnimations === 'function') {
        cleanupExistingStarAnimations();
      }
    } catch {}
  }
  
  // 🔥 FIX: Cleanup level flow timeouts
  try {
    FLOW.cleanupLevelFlowTimeouts();
    devLog('✅ Level flow timeouts cleaned up in cleanupGame()');
  } catch (e) {
    devWarn('⚠️ Failed to cleanup level flow timeouts:', e);
  }

  // Keep global PIXI texture cache intact on full exit. The app is destroyed below with
  // texture:false, so clearing TextureCache here can leave Assets.cache with stale refs
  // and make the next board boot render without tile/wild textures on iOS WebKit.
  try {
    cleanupTexturesForBoardTransition('cleanupGame', true, true);
    memoryManager.performCleanup?.();
  } catch (e) {
    devWarn('⚠️ cleanupGame memory cleanup failed:', e);
  }
  
  if (grid) {
    createEmptyGrid();
  }
  
  // 🔥 CRITICAL FIX: Cleanup background layer BEFORE clearing board
  if (backgroundLayer) {
    try {
      if (board && board.children.includes(backgroundLayer)) {
        board.removeChild(backgroundLayer);
        devLog('✅ Background layer removed from board');
      }
      backgroundLayer.destroy({ children: true });
      devLog('✅ Background layer destroyed');
    } catch (e) {
      devWarn('⚠️ Error destroying background layer:', e);
    }
    backgroundLayer = null; // 🔥 CRITICAL: Nullify reference to prevent memory leak
    devLog('✅ Background layer reference nullified');
  }
  
  // 🔥 CRITICAL FIX: Clear window global variables to prevent memory leaks
  try {
    window._ghostPlaceholders = null;
    window._userMadeMove = false;
    window._gameHasEnded = false;
    devLog('✅ Window global variables cleared');
  } catch (e) {
    devWarn('⚠️ Failed to clear window globals:', e);
  }
  
  // Clear board
  if (board) {
    board.removeChildren();
    if (boardBG) {
      board.addChildAt(boardBG, 0);
      boardBG.zIndex = -1000;
      boardBG.eventMode = 'none';
    }
  }
  
  // Clear global FX layer + FX state (prevents stale transforms after hard exit)
  cleanupFxForBoardReset('cleanupGame');
  
  if (app && destroyRenderer) {
    devLog('🧹 Destroying PIXI app in cleanupGame()');
    detachCoreTextureContextRecovery();
    try {
      // 🔥 FIX: Don't destroy textures - they're managed by Assets and should be unloaded, not destroyed
      // Using texture: false prevents "A Texture managed by Assets was destroyed" warning
      app.destroy(true, { children: true, texture: false, textureSource: false } as any);
      devLog('✅ PIXI app destroyed in cleanupGame()');
    } catch (e) {
      devLog('⚠️ Error destroying app in cleanupGame():', e);
    }
    app = null as any;
    devLog('✅ app set to null');
  } else if (app) {
    try { if (stage) stage.visible = false; } catch {}
    try { if (board) board.visible = false; } catch {}
    try { if (hud) hud.visible = false; } catch {}
    try { app.renderer?.render?.(stage); } catch {}
    try {
      app.canvas.style.visibility = 'hidden';
      app.canvas.style.opacity = '0';
      app.canvas.style.pointerEvents = 'none';
    } catch {}
    devLog('⏸️ PIXI renderer session suspended for menu reuse');
  }
  
  // 🔥 CRITICAL FIX: Clear HUD_ROOT reference if it exists
  try {
    const hudRoot = (window as any).HUD_ROOT;
    if (hudRoot) {
      try {
        if (hudRoot.parent) {
          hudRoot.parent.removeChild(hudRoot);
        }
        if (typeof hudRoot.destroy === 'function') {
          hudRoot.destroy({ children: true });
        }
      } catch {}
      (window as any).HUD_ROOT = null;
      devLog('✅ HUD_ROOT reference cleared');
    }
  } catch (e) {
    devWarn('⚠️ Failed to clear HUD_ROOT:', e);
  }
  
  // 🔥 CRITICAL: Clear window.HUD exports to avoid retaining old HUD closures
  try {
    if ((window as any).HUD) {
      (window as any).HUD = null;
      devLog('✅ window.HUD reference cleared');
    }
  } catch (e) {
    devWarn('⚠️ Failed to clear window.HUD:', e);
  }
  
  // 🔥 CRITICAL: Cleanup screen lifecycles (modal/transition)
  try {
    import('./clean-board-modal.js').then(m => m.cleanupCleanBoardModalLifecycle?.()).catch(() => {});
    import('./board-transition-screen.js')
      .then(m => m.cleanupBoardTransitionScreen?.())
      .catch((error) => {
        // Navigation must not leave an opaque transition owner mounted merely
        // because the lazy cleanup module failed to load or execute.
        devError('[CC_BOARD_HANDOFF] navigation cleanup import failed', error);
        try { document.getElementById('cc-board-transition-overlay')?.remove(); } catch {}
        boardTransitionPresentationHandoff.cancel();
      });
  } catch {}
  
  // Mobile save/resume listeners are boot-owned. Remove this boot's exact
  // references; the next boot installs one fresh set before any async work.
  cleanupMobileSaveLifecycle({ log: devLog, warn: devWarn });
  
  try { drag?.cleanup?.({ resumeIdle: false }); } catch {}
  drag = null as any;
  try { (STATE as any).drag = null; } catch {}
  devLog('✅ Game cleanup completed');
  syncSharedState();
}

// Start fresh game (for re-entering) - now just calls boot
export function startFreshGame() {
  devLog('🎮 Starting fresh game - calling boot');
  boot();
}

// --- Game State Saving/Loading ---
let lastSavedState = null;

// Debounced save timer to prevent saving mid-animation
let saveGameTimer = null;

function debouncedSaveGameState(delayMs = 800) {
  // Cancel any pending save
  if (saveGameTimer) {
    clearTimeout(saveGameTimer);
  }
  
  // Schedule new save
  saveGameTimer = trackAppTimeout(() => {
    saveGameTimer = null;
    saveGameState();
  }, delayMs);
  
  devLog(`💾 Debounced save scheduled in ${delayMs}ms`);
}

function hasUnsavableTransientGameplayState(): boolean {
  try {
    if (busyEnding) return true;
    if (wildSpawnInProgress || merge6SpawnInProgress || wildMagnetPullInProgress) return true;
    if (specialDiceTransactionOwner.isActive()) return true;
    if (regularMergeHandoffTokens.size > 0) return true;
    if (collectBoardGameplayTiles().some((tile: any) => merge6DestinationCleanupOwner.hasClaim(tile))) return true;
    const activeDragTile = ((STATE as any)?.drag?.t) || ((drag as any)?.t);
    if (activeDragTile && !activeDragTile.destroyed) return true;
    if ((window as any).__ccWildSpawnDropInProgress === true) return true;
    const sourceTiles = Array.isArray(STATE?.tiles) && STATE.tiles.length ? STATE.tiles : tiles;
    return sourceTiles.some((tile: any) => tile && !tile.destroyed && (
      tile._ccWildSpawnDropping === true ||
      tile._ccWildSpawnHandoffLock === true ||
      tile._isBeingSpawned === true ||
      tile._pendingRemoval === true ||
      tile._beingRemoved === true ||
      tile._cleanupQueued === true ||
      tile._ccSpawnAnimating === true ||
      tile._spawnAnimating === true ||
      tile._isSpawning === true ||
      !!tile._spawnTween
    ));
  } catch {}
  return false;
}

function saveGameState() {
  try {
    syncSharedState();
    
    // DEBUG: Log current state
    devLog('💾 saveGameState called:', {
      boardNumber,
      _userMadeMove: window._userMadeMove,
      _gameHasEnded: window._gameHasEnded,
      score,
      tilesCount: tiles.length,
      activeTilesCount: tiles.filter(t => t && !t.locked && (t.value|0) > 0).length
    });
    
    if (!canSaveGameState({
      boardNumber,
      userMadeMove: !!(window as any)._userMadeMove,
      gameHasEnded: !!(window as any)._gameHasEnded,
      gridReady: Array.isArray(grid) && grid.length > 0,
      gameplayTransientBusy: hasUnsavableTransientGameplayState(),
      runMode: (window as any).__ccRunMode ?? null,
      cameFromJourney: (window as any).__ccCameFromJourney === true
        || localStorage.getItem('__ccCameFromJourney') === 'true',
      cameFromInterimBoard: (window as any).__ccFromInterimBoard === true
        || localStorage.getItem('__ccFromInterimBoard') === 'true'
        || (window as any).__ccIsInterimBoard === true,
      devLog,
    })) {
      return;
    }
    
    // 🔥 CRITICAL FIX: Save all tiles from tiles array, not just from grid
    // This ensures no tiles are lost during save (e.g., tiles with inconsistent grid positions)
    const { gridSnapshot } = buildGridSnapshot({
      ROWS,
      COLS,
      tiles,
      grid,
      devLog,
      devWarn,
    });

    // 🔥 CRITICAL FIX: Get stars count from stars collector before saving
    const savedStarsCount = getStarsCountForSave({ StarsCollector, devLog, devWarn });
    const currentState = stampCurrentGameSaveSchema(buildSaveState({
      gridSnapshot,
      score,
      level,
      boardNumber,
      moves,
      wildMeter,
      wildSpawnCount,
      bestScore: STATE.bestScore,
      starsCount: savedStarsCount,
      MOVES_MAX,
      devLog,
    }));

    const serialized = JSON.stringify(currentState);
    if (serialized !== lastSavedState) {
      // 🔥 USER REQUEST: Board-specific save state - each board has its own save
      // This prevents conflicts when switching between boards (e.g., Board 07 → Board 03)
      const saveKey = isArcadeHomeRunMode() ? getArcadeSaveKey() : getBoardSaveKey(boardNumber);
      localStorage.setItem(saveKey, serialized);
      lastSavedState = serialized;
      devLog(`💾 Game state saved successfully for ${isArcadeHomeRunMode() ? 'Arcade' : `board ${boardNumber}`} (${saveKey}) - state changed.`);
    } else {
      devLog(`💾 Game state unchanged for ${isArcadeHomeRunMode() ? 'Arcade' : `board ${boardNumber}`}, skipping save.`);
    }
  } catch (error) {
    devWarn('⚠️ Failed to save game state:', error);
  }
}

async function loadGameState(overrideBoardNumber?: number) {
  const boardToLoad = Number.isFinite(overrideBoardNumber) ? overrideBoardNumber! : boardNumber;
  const arcadeContinuationCueRound = isArcadeHomeRunMode()
    ? Math.max(0, Math.trunc(Number((window as any).__ccArcadeContinuationCueRound) || 0))
    : 0;
  devLog('🔄 loadGameState called...', overrideBoardNumber != null ? `(override: board ${boardToLoad})` : '');
  
  try {
    const saved = loadSavedBoardState({
      boardNumber: boardToLoad,
      getBoardSaveKey: isArcadeHomeRunMode() ? getArcadeSaveKey : getBoardSaveKey,
      devLog,
      devWarn
    });
    if (!saved) {
      const missingSaveKey = isArcadeHomeRunMode() ? getArcadeSaveKey() : getBoardSaveKey(boardToLoad);
      logger.warn(`⚠️ loadGameState: no saved state for ${isArcadeHomeRunMode() ? 'Arcade' : `board ${boardToLoad}`} (${missingSaveKey}) - will rebuild`);
      devLog('🔄 loadGameState: no saved state for', isArcadeHomeRunMode() ? 'Arcade' : `board ${boardToLoad}`, '- returning false');
      (window as any).__ccEnterAnimationActive = false;
      return false;
    }
    const { gameState } = saved;

    await ensureAppReadyForLoad({
      app,
      board,
      backgroundLayer,
      setBackgroundLayer: (v) => { backgroundLayer = v; },
      layoutBoard,
      initializeBackgroundLayer,
      boot,
      devLog,
    });

    const { deferredTntIdleTiles } = restoreTilesFromSave({
      gameState,
      tiles,
      grid,
      ROWS,
      COLS,
      board,
      makeBoard,
      createEmptyGrid,
      stopWildIdle,
      applyWildSkinLocal,
      startWildShimmer,
      stopWildShimmer,
      startMagnetIdleParticles,
      stopMagnetIdleParticles,
      startTntIdleParticles,
      stopTntIdleParticles,
      startTntIdleShake,
      stopTntIdleShake,
      startWildJuiceBubbles,
      stopWildJuiceBubbles,
      trackAppTimeout,
      STATE,
      devLog,
      devWarn,
      devError,
    });

    board?.sortChildren?.();

    const restored = restoreBasicState({
      gameState,
      MOVES_MAX,
      STATE,
      setScore: (v) => { score = v; },
      setLevel: (v) => { level = v; },
      setBoardNumber: (v) => { boardNumber = v; },
      setMoves: (v) => { moves = v; },
      setWildMeter: (v) => { wildMeter = v; },
      setWildSpawnCount: (v) => {
        wildSpawnCount = v;
        firstWildSpawned = v > 0;
      },
      devLog,
    });

    applyRulesAfterLoad({
      boardNumber: restored.boardNumber,
      syncSharedState,
      boardSpecificRules,
      drawBoardBG,
      devLog,
    });

    // Hide ghosts before any await so no frame paints with placeholders during load pop-in path
    try { hideGhostPlaceholders(); } catch {}
    
    const dragReady = await ensureDragReadyAndRebind({
      STATE,
      tiles,
      waitTrackedResult,
      devLog,
      devWarn,
      devError,
    });
    if (!dragReady) return false;
    
    await layoutAndRestoreStars({
      layoutBoard,
      StarsCollector,
      HUD,
      savedStarsCount: restored.savedStarsCount,
      devLog,
      devWarn,
    });
    
    ensureHudAfterLoad({
      app,
      hud,
      HUD,
      getHudRootFromWindow: () => (window as any).HUD_ROOT || null,
      trackAppAnimationFrame,
      devLog,
      devWarn,
      devError,
      isHudDropPending: () => _hudDropPending,
      setHudDropPending: (v) => { _hudDropPending = v; },
    });
    
    // 🔥 CRITICAL FIX: Update HUD AFTER boardNumber is restored and state is synced
    // This ensures HUD displays the correct board number
    updateHUD();
    devLog('✅ HUD updated with boardNumber:', boardNumber);
    resetWildProgress(wildMeter, true);
    
    // CRITICAL: Set _userMadeMove flag to true after loading saved game
    // This ensures that any future moves after Continue will trigger save
    markUserMoveAfterLoad({ devLog });
    
    // CRITICAL: Resume GSAP and PIXI after loading
    resumeRuntimeAfterLoad({ app, gsap, devLog, devWarn });
    
    // 🔥 CRITICAL: Check if tiles were actually loaded BEFORE starting pop-in animation
    // Fail fast so we don't animate then rebuild; also ensures we don't treat valid restore as empty
    lastSavedState = localStorage.getItem(isArcadeHomeRunMode() ? getArcadeSaveKey() : getBoardSaveKey(boardNumber));
    const activeCount = tiles.filter((t: any) => tileIsActive(t as any)).length;
    const emptyLoadResult = handleEmptyLoadState({
      tiles,
      boardNumber,
      getPendingCleanBoard,
      clearPendingCleanBoard,
      getBoardSaveKey: isArcadeHomeRunMode() ? getArcadeSaveKey : getBoardSaveKey,
      triggerCleanBoardFlow,
      runFailFlow: runNoMovesFailFlow,
      showFinalScreen,
      clearLoadedTiles: () => {
        try {
          [...tiles].forEach((tile: any) => removeTile(tile));
          for (let r = 0; r < grid.length; r++) {
            if (Array.isArray(grid[r])) grid[r].fill(null);
          }
        } catch (error) {
          devWarn('⚠️ loadGameState: failed to clear invalid loaded tiles:', error);
        }
      },
      trackAppTimeout,
      devLog,
      devWarn,
    });

    if (emptyLoadResult.handled) {
      logger.warn(`⚠️ loadGameState: empty/invalid load for board ${boardNumber} (tiles: ${tiles.length}, active: ${activeCount}) - will rebuild`);
      devLog('🔄 loadGameState: empty/invalid load handled (no active tiles) - returning false');
      (window as any).__ccEnterAnimationActive = false;
      if (Number.isFinite(emptyLoadResult.nextBoardNumber)) {
        boardNumber = emptyLoadResult.nextBoardNumber!;
        level = emptyLoadResult.nextBoardNumber!;
      }
      return false;
    }

    resetTransientEndgameRuntimeState(`loadGameState:${isArcadeHomeRunMode() ? 'arcade' : 'journey'}`);
    clearTransientTileEndgameFlags(tiles, `loadGameState:${isArcadeHomeRunMode() ? 'arcade' : 'journey'}`);

    if (isArcadeHomeRunMode()) {
      try {
        clearPendingCleanBoard();
        devLog('🧹 Arcade resume: cleared stale clean/final-merge recovery flags for playable saved board');
      } catch (error) {
        devWarn('⚠️ Arcade resume: failed to clear stale recovery flags:', error);
      }
    }

    devLog('✅ Game state loaded successfully with', tiles.length, 'tiles (', activeCount, 'active)');
    
    // ANIMATION: Show ghost placeholders FIRST, then animate tiles (only after we know load is valid)
    const loadedEntryGeneration = activeGameplayEntryGeneration;
    let loadedEntrySignal: AbortSignal | null = null;
    const loadedEntryCompletion = prepareGameplayEntryCommit(
      loadedEntryGeneration,
      (signal) => {
        loadedEntrySignal = signal;
        if (signal.aborted) return;
        revealPreparedGameplaySurface();
        releaseBoardTransitionCoverAfterPreparedFrame(loadedEntryGeneration);
        return playLoadPopInAnimation({
      tiles,
      backgroundLayer,
      sweetPopIn,
      beforePopIn: arcadeContinuationCueRound > 0
        ? async () => {
            await consumeArcadeEntryCue(arcadeContinuationCueRound);
            devLog(`🎮 Arcade continuation cue completed before Round ${String(arcadeContinuationCueRound).padStart(2, '0')} tile entrance`);
          }
        : undefined,
      onPopInStarted: () => {
        if (loadedEntrySignal?.aborted || !isGameplayEntryGenerationLatest(loadedEntryGeneration)) return;
        if (arcadeContinuationCueRound > 0) releaseArcadeEntrySurfaceGateAfterPreparedFrame(app, stage);
      },
      shouldAbort: () => loadedEntrySignal?.aborted === true ||
        !isGameplayEntryGenerationLatest(loadedEntryGeneration),
      getAbortSignal: () => loadedEntrySignal,
      onHalf: () => {
        if (loadedEntrySignal?.aborted || !isGameplayEntryGenerationLatest(loadedEntryGeneration)) return;
        // 🔥 CRITICAL FIX: Ensure HUD drop is triggered even if it wasn't triggered above
        // This is a fallback in case HUD drop wasn't triggered earlier
        triggerHudDropIfPending({
          HUD,
          app,
          showJourneyBottomDecor: showJourneyGameBottomDecorForHudDrop,
          trackAppAnimationFrame,
          devLog,
          devWarn,
          isHudDropPending: () => _hudDropPending,
          setHudDropPending: (v) => { _hudDropPending = v; },
        });
      },
      onComplete: () => {
        if (!isGameplayEntryGenerationLatest(loadedEntryGeneration)) return;
        resumeDeferredTntIdleEffects(
          deferredTntIdleTiles,
          startTntIdleParticles,
          startTntIdleShake,
        );
        // 🔥 CRITICAL FIX: Final check - ensure HUD is visible and positioned after animation
        ensureHudFinalPosition({
          getHudRoot: () => (window as any).HUD_ROOT || HUD.HUD_ROOT || null,
          showJourneyBottomDecor: showJourneyGameBottomDecorForHudDrop,
          devLog,
          devWarn,
        });
        // Start the existing settle/recovery delay only after the continuation
        // cue and saved-board pop-in have finished. Hidden entrance tiles must
        // never be interpreted as a clean Arcade board.
        schedulePostLoadRecoveryCheck({
          tiles,
          boardNumber,
          checkAndRecoverBoard,
          triggerCleanBoardFlow,
          checkLevelEnd,
          trackAppTimeout,
          devLog,
          devWarn,
        });
      },
      devLog,
        });
      },
    );
    const appElement = document.getElementById('app');
    const loadedAppIsVisible = !!appElement &&
      !appElement.hasAttribute('hidden') &&
      appElement.style.display !== 'none' &&
      appElement.style.visibility !== 'hidden';
    if (loadedAppIsVisible) void commitPreparedGameplayEntry();
    void loadedEntryCompletion;
    
    return true;
  } catch (error) {
    logger.error('❌ loadGameState failed (exception):', error instanceof Error ? error.message : String(error));
    devError('❌ Failed to load game state:', error);
  }
  devLog('🔄 loadGameState returning false (exception or early exit)');
  return false;
}

// 🔥 CRITICAL: Function to stop PIXI ticker immediately - prevents _x null errors during cleanup
function stopPixiTicker(): boolean {
  try {
    const pixiApp = app || STATE?.app;
    if (pixiApp && pixiApp.ticker) {
      pixiApp.ticker.stop();
      devLog('✅ stopPixiTicker: PIXI ticker stopped');
      return true;
    }
    devWarn('⚠️ stopPixiTicker: No PIXI app/ticker found');
    return false;
  } catch (e) {
    devWarn('⚠️ stopPixiTicker failed:', e);
    return false;
  }
}

// Expose functions globally
window.saveGameState = saveGameState;
window.loadGameState = loadGameState;
window.drawBoardBG = drawBoardBG;
window.animateBoardExit = animateBoardExit; // Export for exitToMenu
window.stopPixiTicker = stopPixiTicker; // Export for exit cleanup

// Export drawBoardBG and animateBoardExit for other modules
export { drawBoardBG, animateBoardExit };


// CRITICAL: Expose function to sync score from app-boot.ts
// This ensures STATE.score and local score variable stay in sync
(window as any).syncScoreToCore = (newScore: number) => {
  score = newScore;
  STATE.score = newScore;
  devLog('🔄 Synced score to core:', newScore);
};

export { app, stage, board, hud, tiles, grid, score, level }; 
