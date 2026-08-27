// @ts-nocheck
import { logger } from '../core/logger.js';
import { gsap } from 'gsap';
import { computeEfficiencyBonusFromState } from './clean-board-score-utils.ts';
import { isArcadeHomeRunMode, markArcadeHomeRunOrigin } from './run-mode.js';
import { wasFinalMergeHandoffRecentlySettled } from './final-merge-handoff.ts';
import { waitForEndgameAnimationHandoff } from './endgame-animation-handoff.ts';
import { requestExitToMenu } from './menu-exit-handoff.ts';
import { resolveCleanBoardActionDecision } from './clean-board-action-decision.ts';
import {
  clearJourneyDetailReturn,
  isJourneyInterimOriginActive,
  markJourneyGameOrigin,
  resolveJourneyReturnTarget,
} from './journey-origin-state.js';
import { resolveJourneyStartDecision } from './journey-start-decision.ts';
import { emitIOSNativeDiagnostic } from '../utils/ios-native-diagnostic.js';
import { applyAppPaperSurfaceToElement } from '../utils/app-paper-background.js';
import {
  beginJourneyPlayAgainIncidentCycle,
  recordJourneyPlayAgainIncident,
} from '../utils/journey-play-again-incident-ring.js';
// public/src/modules/endgame-flow.ts
// Orkestracija (simplified): STARS → NEXT
// Privremeno maknuto: Clean Board i Mystery Prize.

// Import cleanup function from clean-board-modal (will be imported lazily)

// Type definitions
interface EndgameContext {
  app: any;
  stage: any;
  board: any;
  boardBG?: { visible?: boolean };
  level: number;
  startLevel: (level: number) => Promise<void>;
  score?: number;
  hideGrid?: () => void;
  showGrid?: () => void;
  boardNumber?: number;
  getScore?: () => number;
  setScore?: (score: number) => void;
  animateScore?: (score: number, duration: number) => void;
  updateHUD?: () => void;
  /** true = regular+regular or magnet last merge; no stars/bubbles, skip stars wait so clean board shows ASAP */
  skipStarsWait?: boolean;
  /** final-merge-handoff already completed; do not run secondary FX waits before reward UI */
  finalMergeCompleted?: boolean;
  /** Run ownership captured when the terminal merge first requested this flow. */
  abortToken?: number;
}

function isFirstPlayTutorialCompletionFlow(): boolean {
  return typeof window !== 'undefined' && (window as any).__ccFirstPlayTutorialSlowWildMeter === true;
}

function clearFirstPlayTutorialCompletionFlags(): void {
  try {
    delete (window as any).__ccFirstPlayTutorialSlowWildMeter;
    delete (window as any).__ccFirstPlayTutorialFreezeWildMeterSmoke;
    delete (window as any).__ccFirstPlayTutorialActive;
    delete (window as any).__ccFirstPlayTutorialCanDrop;
    delete (window as any).__ccFirstPlayTutorialDragStarted;
    delete (window as any).__ccFirstPlayTutorialDragReturned;
    delete (window as any).__ccFirstPlayTutorialWildSpawnCell;
    delete (window as any).__ccFirstPlayTutorialForceWildStar;
    delete (window as any).__ccFirstPlayTutorialDisplaceWildSpawnOccupant;
    delete (window as any).__ccFirstPlayTutorialDemoBoardReady;
    delete (window as any).__ccFirstPlayTutorialRunSource;
  } catch {}
}

async function clearFirstPlayTutorialRunState(): Promise<void> {
  const tutorialBoardNumber = (window as any).STATE?.boardNumber || 1;
  clearFirstPlayTutorialCompletionFlags();
  try {
    const { clearFirstPlayTutorialResumeBlockers } = await import('./first-play-tutorial-dev-reset.js');
    clearFirstPlayTutorialResumeBlockers();
    const { clearArcadeSaveState, clearBoardSaveState } = await import('../utils/board-save-utils.js');
    clearArcadeSaveState();
    clearBoardSaveState(tutorialBoardNumber);
    const { journeyProgressionState } = await import('./journey-progression-state.js');
    journeyProgressionState.clearCurrentRunState();
    const { boardStatsService } = await import('../services/board-stats-service.js');
    boardStatsService.resetBoardStats(tutorialBoardNumber);
    const { arcadeStatsService } = await import('../services/arcade-stats-service.js');
    arcadeStatsService.resetStats();
  } catch {}
  delete (window as any).__ccSuppressTutorialStatsSave;
  delete (window as any).__ccBoardJustCompleted;
  delete (window as any).__ccSkipRebuildBoard;
  delete (window as any).__skipBoardExitAnimation;
  delete (window as any).__ccFastArcadeCleanExit;
}

async function prepareFirstPlayTutorialArcadeRestart(): Promise<void> {
  await clearFirstPlayTutorialRunState();
  markArcadeHomeRunOrigin();
  (window as any)._gamePaused = false;
}

async function continueFirstPlayTutorialIntoJourney(cleanupCover: () => void): Promise<void> {
  let coverReleased = false;
  const releaseCover = (): void => {
    if (coverReleased) return;
    coverReleased = true;
    cleanupCover();
  };
  try {
    await clearFirstPlayTutorialRunState();
    (window as any).__ccFirstPlayTutorialReturnToJourneyHub = true;
    (window as any).__ccBoardJustCompleted = true;
    (window as any).__ccSuppressTutorialStatsSave = true;
    markJourneyGameOrigin({ fromInterim: false });
    (window as any).__skipBoardExitAnimation = true;

    // Prime the exact hidden Hub destination and subscribe before routing.
    // Waiting until requestExitToMenu resolves lets the full Hub cascade play
    // underneath the opaque Tutorial Complete cover, revealing only its tail.
    const { journeyBoardsManager } = await import('./journey-boards-manager.js');
    journeyBoardsManager.prepareFirstPlayTutorialHubReturn?.();
    const hubPresentation = journeyBoardsManager
      .waitForJourneyV700HubPresentation?.(6000)
      .then((presented) => {
        if (presented) releaseCover();
        return presented;
      });

    await requestExitToMenu({
      reason: 'first-play-tutorial-complete-journey-worlds',
      target: 'auto',
      skipBoardExit: true,
    });
    await hubPresentation;
  } finally {
    delete window.__ccBoardJustCompleted;
    delete window.__ccSuppressTutorialStatsSave;
    delete window.__skipBoardExitAnimation;
    delete (window as any).__ccFirstPlayTutorialReturnToJourneyHub;
    releaseCover();
  }
}

async function continueFirstPlayTutorialIntoArcade(
  startLevel: (level: number) => Promise<void>,
  cleanupCover: () => void,
): Promise<void> {
  let coverReleased = false;
  const releaseCover = (): void => {
    if (coverReleased) return;
    coverReleased = true;
    cleanupCover();
  };
  try {
    await prepareFirstPlayTutorialArcadeRestart();
    (window as any).__ccTriggerHudDrop = true;
    (window as any).__ccArcadeContinuationCueRound = 1;
    const {
      resetArcadeEntryCueOwner,
      waitForArcadeEntryCuePresentation,
    } = await import('./arcade-entry-cue-owner.js');
    resetArcadeEntryCueOwner();
    const cuePresented = waitForArcadeEntryCuePresentation(1);
    const startPromise = startLevel(1);
    await Promise.race([cuePresented, startPromise]);
    releaseCover();
    await startPromise;
  } catch (tutorialContinuationError) {
    delete (window as any).__ccTriggerHudDrop;
    delete (window as any).__ccArcadeContinuationCueRound;
    try {
      const { cancelArcadeEntryCueOwner } = await import('./arcade-entry-cue-owner.js');
      cancelArcadeEntryCueOwner();
    } catch {}
    logger.error('❌ endgame-flow: Failed to continue tutorial into Arcade Round 01:', tutorialContinuationError);
    throw tutorialContinuationError;
  } finally {
    releaseCover();
  }
}

async function initTransitionMemoryTracking(): Promise<void> {
  try {
    const { initMemorySpikeTracker } = await import('../utils/memory-spike-tracker.js');
    initMemorySpikeTracker();
  } catch {}
}

async function sampleTransitionMemory(label: string): Promise<void> {
  try {
    const { sampleMemorySpike } = await import('../utils/memory-spike-tracker.js');
    sampleMemorySpike(label);
  } catch {}
}

async function reportTransitionMemory(): Promise<void> {
  try {
    const { reportBiggestMemorySpike } = await import('../utils/memory-spike-tracker.js');
    reportBiggestMemorySpike();
  } catch {}
}

async function updateCleanBoardHighScore(boardNumber: number, finalScore: number, source: string): Promise<void> {
  try {
    const { boardStatsService } = await import('../services/board-stats-service.js');
    const isNewHigh = boardStatsService.updateBoardHighScore(boardNumber, finalScore);
    const stats = boardStatsService.getBoardStats(boardNumber);
    if (isNewHigh) {
      logger.info(`🏆 New board ${boardNumber} high score after clean board (${source}): ${finalScore}`);
    }
    window.dispatchEvent(new CustomEvent('cc-board-highscore-updated', {
      detail: { boardId: boardNumber, highScore: stats.highScore, source }
    }));
  } catch (error) {
    logger.warn(`⚠️ Failed to update board high score before ${source}:`, error);
  }
}

async function clearCompletedBoardSaveState(boardNumber: number, source: string): Promise<void> {
  try {
    const { clearBoardSaveState, hasSavedStateForBoard } = await import('../utils/board-save-utils.js');

    const hadSavedState = hasSavedStateForBoard(boardNumber);
    console.log(`🔍 endgame-flow: Board ${boardNumber} has saved state BEFORE clear (${source}): ${hadSavedState}`);

    clearBoardSaveState(boardNumber);
    console.log(`✅ endgame-flow: Cleared board save state for board ${boardNumber} (${source})`);

    const stillHasSavedState = hasSavedStateForBoard(boardNumber);
    console.log(`🔍 endgame-flow: Board ${boardNumber} has saved state AFTER clear (${source}): ${stillHasSavedState}`);

    localStorage.removeItem('cc_board_completed');
    console.log(`✅ endgame-flow: Cleared cc_board_completed flag (${source})`);

    if (stillHasSavedState) {
      console.error(`❌ CRITICAL: Failed to clear saved state for board ${boardNumber}!`);
    }
  } catch (error) {
    logger.warn(`⚠️ Failed to clear board save state (${source}):`, error);
  }
}

async function handleCleanBoardBackToJourney(): Promise<void> {
  console.log('🧭 endgame-flow: Back to Journey action');
  logger.info('🧭 endgame-flow: Back to Journey action');
  try {
    markJourneyGameOrigin({ fromInterim: isJourneyInterimOriginActive() });
    clearJourneyDetailReturn();
    delete (window as any).__skipBoardExitAnimation;
    await requestExitToMenu({
      reason: 'clean-board-back-to-journey',
      target: 'auto',
      skipBoardExit: true,
    });
  } catch (error) {
    console.error('❌ endgame-flow: Failed to return to Journey:', error);
    logger.error('❌ endgame-flow: Failed to return to Journey:', error);
  }
}

async function handleArcadeCleanBoardExit(): Promise<void> {
  console.log('🚪 endgame-flow: Exit action in arcade_home mode - returning to homepage');
  logger.info('🚪 endgame-flow: arcade_home exit -> homepage');
  try {
    markArcadeHomeRunOrigin();
    delete (window as any).__skipBoardExitAnimation;
    (window as any).__skipBoardExitAnimation = true;
    (window as any).__ccFastArcadeCleanExit = true;
    await requestExitToMenu({
      reason: 'clean-board-arcade-exit',
      target: 'homepage',
      skipBoardExit: true,
      fastArcadeCleanExit: true,
    });
  } catch (error) {
    console.error('❌ endgame-flow: Failed to exit arcade_home run:', error);
    logger.error('❌ endgame-flow: Failed to exit arcade_home run:', error);
  }
}

async function handleCleanBoardPlayAgain(ctx: EndgameContext, boardNumber: number): Promise<void> {
  console.log('🔁 endgame-flow: Play Again action - restarting current board');
  logger.info(`🔁 endgame-flow: Play Again action - restarting board ${boardNumber}`);

  try {
    if ((window as any).__ccPlayAgainRestartInProgress) {
      logger.warn('⚠️ endgame-flow: Play Again restart already in progress, skipping duplicate');
      return;
    }
    (window as any).__ccPlayAgainRestartInProgress = true;
    beginJourneyPlayAgainIncidentCycle({ boardId: boardNumber });

    await clearCompletedBoardSaveState(boardNumber, 'clean-board-play-again');

    const finalScore = ctx.getScore ? ctx.getScore() : 0;
    await updateCleanBoardHighScore(boardNumber, finalScore, 'Play Again');

    if (isArcadeHomeRunMode()) {
      (window as any).__ccArcadePlayAgainStarting = true;
      try { window.CC?.cleanupFxForBoardReset?.('endgame-arcade-play-again'); } catch {}
      (window as any).__ccTriggerHudDrop = true;
      const uiManagerModule = await import('./ui-manager.js');
      await uiManagerModule.default.startNewGame();
      console.log('✅ endgame-flow: Restarted arcade board via uiManager.startNewGame');
    } else if (typeof (window as any).startNewRunFromJourney === 'function') {
      recordJourneyPlayAgainIncident('before-play-again-cleanup', { boardId: boardNumber });
      try { window.CC?.cleanupFxForBoardReset?.('endgame-play-again'); } catch {}
      recordJourneyPlayAgainIncident('after-play-again-fx-cleanup', { boardId: boardNumber });
      try { window.CC?.resetTransientRunGuards?.('endgame-play-again'); } catch {}
      try { window.CC?.softResetBoardView?.('endgame-play-again'); } catch {}
      recordJourneyPlayAgainIncident('after-play-again-soft-reset', { boardId: boardNumber });
      try { window.CC?.destroyOldBoardForTransition?.('endgame-play-again'); } catch {}
      recordJourneyPlayAgainIncident('after-play-again-old-board-destroy', { boardId: boardNumber });
      emitIOSNativeDiagnostic('journey-play-again-old-board-destroyed', { boardId: boardNumber });
      await (window as any).startNewRunFromJourney(boardNumber);
      console.log(`✅ endgame-flow: Restarted board ${boardNumber} via startNewRunFromJourney`);
    } else {
      console.error('❌ endgame-flow: startNewRunFromJourney function not found');
    }
  } catch (error) {
    console.error('❌ endgame-flow: Failed to restart board:', error);
    logger.error('❌ endgame-flow: Failed to restart board:', error);
  } finally {
    delete (window as any).__ccPlayAgainRestartInProgress;
  }
}

async function handleJourneyCleanBoardExit(ctx: EndgameContext, boardNumber: number): Promise<void> {
  console.log('🚪 endgame-flow: Exit action - returning DIRECTLY to detail modal');
  logger.info(`🚪 endgame-flow: Exit action - opening detail modal for board ${boardNumber}`);

  try {
    const finalScore = ctx.getScore ? ctx.getScore() : 0;
    await updateCleanBoardHighScore(boardNumber, finalScore, 'Exit');

    const returnDecision = await resolveJourneyReturnTarget(boardNumber);
    if (returnDecision.target === 'homepage') {
      console.error(`❌ CRITICAL: Invalid/non-Journey return target for board ${boardNumber}`);
      logger.error(`❌ CRITICAL: Invalid/non-Journey return target for board ${boardNumber}`);
      return;
    }
    console.log('🎯 endgame-flow: Clean board exit return target prepared:', returnDecision);
    logger.info('🎯 endgame-flow: Clean board exit return target prepared', returnDecision);

    if (returnDecision.target === 'journey') {
      // Prepare the visible world return before requestExitToMenu begins its
      // cleanup/shell handoff. Waiting until main.ts resolves the final route
      // is too late: the preserved Journey DOM can scope the Beach world and
      // start its default enter while the screen is still hidden.
      (window as any).__ccReturningFromDetailModal = true;
      (window as any).__ccSuppressJourneyV700AutoWorldEnter = true;
      (window as any).__ccJourneyReturnBoardId = boardNumber;
      (window as any).__ccLastActiveJourneyBoardAreaId = boardNumber;
      try { localStorage.setItem('__ccJourneyReturnBoardId', String(boardNumber)); } catch {}
      try { localStorage.setItem('__ccLastActiveJourneyBoardAreaId', String(boardNumber)); } catch {}
      emitIOSNativeDiagnostic('clean-board-journey-return-prepared', { boardId: boardNumber });
    }

    await clearCompletedBoardSaveState(boardNumber, 'clean-board-detail-exit');

    delete (window as any).__skipBoardExitAnimation;
    console.log('🎯 endgame-flow: Cleared skip flag - board exit animation already played in clean-board-modal');

    console.log('🎯 endgame-flow: requesting menu handoff (animation already played in clean-board-modal)');
    await requestExitToMenu({
      reason: 'clean-board-detail-exit',
      target: 'auto',
      skipBoardExit: true,
    });
  } catch (error) {
    console.error('❌ endgame-flow: Failed to exit to detail modal:', error);
    logger.error('❌ endgame-flow: Failed to exit to detail modal:', error);
  }
}

async function animateBoardIndicatorExitSafe(duration: number, reason: string): Promise<void> {
  try {
    const { animateBoardIndicatorExit } = await import('./hud-helpers.js');
    if (typeof animateBoardIndicatorExit === 'function') {
      animateBoardIndicatorExit(duration);
      console.log(`✅ endgame-flow: Board indicator exit animation started (${reason})`);
      logger.info(`✅ endgame-flow: Board indicator exit animation started (${reason})`);
    }
  } catch (indicatorError) {
    console.warn(`⚠️ endgame-flow: Failed to hide board indicator (${reason}, non-fatal):`, indicatorError);
  }
}

async function performPreNextBoardCleanup(nextLevel: number): Promise<void> {
  const isLongGameSession = nextLevel >= 10;
  const isVeryLongSession = nextLevel >= 20;

  await initTransitionMemoryTracking();

  try {
    console.log(`🧹 endgame-flow: Performing ${isVeryLongSession ? 'VERY AGGRESSIVE' : isLongGameSession ? 'AGGRESSIVE' : 'standard'} cleanup before startLevel (Board ${nextLevel})...`);

    // Feature owners clean their own tracked timelines. Never clear the
    // shared AnimationManager or GSAP global timeline here: Journey, cards
    // and modals may overlap this board handoff and own separate lifecycles.

    if ((window as any)._activeTimeouts) {
      (window as any)._activeTimeouts.forEach((timeout: NodeJS.Timeout) => {
        try { clearTimeout(timeout); } catch {}
      });
      (window as any)._activeTimeouts.clear();
    }
    if ((window as any)._activeIntervals) {
      (window as any)._activeIntervals.forEach((interval: NodeJS.Timeout) => {
        try { clearInterval(interval); } catch {}
      });
      (window as any)._activeIntervals.clear();
    }

    try {
      const cleanBoardModal = await import('./clean-board-modal.js');
      if (cleanBoardModal && (cleanBoardModal as any).clearAllModalTimeouts) {
        (cleanBoardModal as any).clearAllModalTimeouts();
      }
    } catch {}

    try {
      const confettiSystem = await import('./confetti-system.js');
      if (confettiSystem && typeof confettiSystem.cleanupConfetti === 'function') {
        confettiSystem.cleanupConfetti();
      }
    } catch {}

    try {
      const bubbles = await import('./wild-juice-bubbles-explosion.js');
      const bubblesScreen = await import('./wild-juice-bubbles-screen.js');
      bubbles.forceStopWildJuiceBubblesExplosion?.();
      bubblesScreen.stopWildJuiceBubblesScreen?.();
      bubbles.destroyWildJuiceBubblesExplosionCache?.();
      bubblesScreen.destroyWildJuiceBubblesScreenCache?.();
      console.log('✅ endgame-flow: Bubble caches destroyed before transition');
    } catch (e) {
      console.warn('⚠️ endgame-flow: Bubble cache cleanup failed (non-fatal):', e);
    }

    try {
      const lastFxCleanup = (window as any).__ccLastFxCleanupAt || 0;
      const recentlyCleaned = (Date.now() - lastFxCleanup) < 1000;
      if (recentlyCleaned) {
        console.log('⏭️ endgame-flow: Skipping cleanupAllEffects (recently cleaned)');
      } else {
        const fxModule = await import('./fx.js');
        if (fxModule && typeof fxModule.cleanupAllEffects === 'function') {
          fxModule.cleanupAllEffects();
          console.log('🧹 endgame-flow: cleanupAllEffects completed');
          (window as any).__ccLastFxCleanupAt = Date.now();
        }
      }
    } catch (e) {
      console.warn('⚠️ endgame-flow: Failed to cleanup FX in cleanup section:', e);
    }

    try {
      const memoryManagerModule = await import('../utils/memory-manager.js');
      if (memoryManagerModule && (memoryManagerModule as any).memoryManager) {
        const mm = (memoryManagerModule as any).memoryManager;
        if (mm.performCleanup) {
          mm.performCleanup();
        }
        if (isLongGameSession && mm.forceCleanup) {
          console.log('🔥 LONG-TERM: Forcing aggressive memory cleanup for board', nextLevel);
          mm.forceCleanup();
        }
      }
    } catch {}

    if (isVeryLongSession) {
      console.log('🔥 VERY LONG SESSION: Forcing GC for board', nextLevel);
      try {
        if (window.gc && typeof window.gc === 'function') {
          window.gc();
          console.log('✅ Garbage collection forced');
        }
      } catch (e) {
        console.warn('⚠️ Very long session GC error:', e);
      }
    }

    if (isLongGameSession) {
      console.log('🔥 LONG SESSION: Aggressive cleanup (no texture cache) for board', nextLevel);
    }

    console.log(`✅ endgame-flow: ${isVeryLongSession ? 'VERY AGGRESSIVE' : isLongGameSession ? 'AGGRESSIVE' : 'Standard'} cleanup completed`);
  } catch (cleanupError) {
    console.warn('⚠️ endgame-flow: Cleanup error (non-fatal):', cleanupError);
  }

  await sampleTransitionMemory('1_after_standard_cleanup');
}

async function prepareForBoardTransitionScreen(): Promise<void> {
  try {
    const fxModule = await import('./fx.js');
    fxModule.forceCleanupAllStarAnimations?.();
  } catch {}
  try {
    const starsCollector = await import('./stars-collector.js');
    starsCollector.cleanupStarsCollector?.();
  } catch {}
  try {
    const bubbles = await import('./wild-juice-bubbles-explosion.js');
    bubbles.forceStopWildJuiceBubblesExplosion?.();
    await new Promise(resolve => requestAnimationFrame(resolve));
  } catch {}
  try {
    const tnt = await import('./tnt-animation.js');
    tnt.stopTntAnimation?.();
  } catch {}

  await new Promise(resolve => requestAnimationFrame(resolve));
  await new Promise(resolve => requestAnimationFrame(resolve));

  (window as any).__ccBoardTransitionActive = true;
  console.log('🎯 endgame-flow: Set __ccBoardTransitionActive flag to protect bubble explosion');

  try {
    const mmMod = await import('./memory-manager.js');
    const mm = mmMod?.default;
    const animMod = await import('./animation-manager.js');
    const am = animMod?.default;
    const mmStats = mm && typeof (mm as any).getMemoryInfo === 'function' ? (mm as any).getMemoryInfo() : null;
    const animStats = am && typeof (am as any).getStats === 'function' ? (am as any).getStats() : null;
    const pixiUtils = (window as any).PIXI?.utils || null;
    const texCache = pixiUtils?.TextureCache ? Object.keys(pixiUtils.TextureCache).length : null;
    const baseCache = pixiUtils?.BaseTextureCache ? Object.keys(pixiUtils.BaseTextureCache).length : null;
    const runtimeTextures = (window as any).__ccRuntimeTextures?.size ?? null;
    console.log('🧪 endgame-flow: Pre-transition stats (Continue)', {
      memoryManager: mmStats,
      animationManager: animStats,
      pixiCache: { texture: texCache, baseTexture: baseCache },
      runtimeTextures
    });
  } catch (e) {
    console.warn('⚠️ endgame-flow: Pre-transition stats failed:', e);
  }

  await sampleTransitionMemory('2_before_show_transition');
}

async function completeBoardTransitionHandoff(): Promise<void> {
  try {
    if (typeof (window as any).hideGhostPlaceholders === 'function') {
      (window as any).hideGhostPlaceholders();
    }
  } catch {}

  (window as any).__ccBoardTransitionActive = false;
  console.log('✅ endgame-flow: Cleared __ccBoardTransitionActive flag - cleanup now allowed');

  try {
    const bubbles = await import('./wild-juice-bubbles-explosion.js');
    if (bubbles.isWildJuiceBubblesExplosionActive?.()) {
      bubbles.forceStopWildJuiceBubblesExplosion?.();
    }
  } catch {}
}

function stopPixiTickerForTransition(): void {
  try {
    const app = window.CC?.app;
    if (app?.ticker) {
      app.ticker.stop();
      console.log('✅ endgame-flow: PIXI ticker stopped (first in onComplete)');
    }
  } catch {}
}

function startPixiTickerForBoot(): void {
  try {
    const app = window.CC?.app;
    if (app?.ticker && !app.ticker.started) {
      app.ticker.start();
      console.log('✅ endgame-flow: PIXI ticker started before boot');
    }
  } catch {}
}

async function hideAppBeforeNextBoard(): Promise<void> {
  try {
    const uiManagerModule = await import('./ui-manager.js');
    const uiMgr = uiManagerModule.default;
    if (uiMgr && typeof uiMgr.hideApp === 'function') {
      uiMgr.hideApp();
      console.log('✅ endgame-flow: Hidden app before starting new board');
    } else {
      console.warn('⚠️ endgame-flow: uiManager.hideApp not available');
    }
  } catch (hideError) {
    console.warn('⚠️ endgame-flow: Failed to hide app (non-fatal):', hideError);
  }
  await sampleTransitionMemory('5_after_hideApp');
}

async function showAppAndRenderBoard(): Promise<void> {
  try {
    const uiManagerModule = await import('./ui-manager.js');
    const uiMgr = uiManagerModule.default;
    uiMgr?.showApp?.();
  } catch {}

  try {
    const app = window.CC?.app;
    const stage = window.CC?.stage;
    if (app?.canvas) {
      app.canvas.style.display = 'block';
      app.canvas.style.visibility = 'visible';
      app.canvas.style.opacity = '1';
    }
    if (stage) {
      stage.visible = true;
      stage.alpha = 1;
      stage.renderable = true;
    }
    if (app?.renderer && stage) {
      app.renderer.render(stage);
    }
  } catch {}
}

async function showAppOnly(): Promise<void> {
  try {
    const uiManagerModule = await import('./ui-manager.js');
    const uiMgr = uiManagerModule.default;
    uiMgr?.showApp?.();
  } catch {}
}

async function layoutBoardSafe(): Promise<void> {
  try {
    const layoutBoardFn = window.CC?.layoutBoard;
    if (typeof layoutBoardFn === 'function') {
      await layoutBoardFn();
      console.log('✅ endgame-flow: layoutBoard completed before showApp');
    }
  } catch (lbErr) {
    console.warn('⚠️ endgame-flow: layoutBoard await failed (non-fatal):', lbErr);
  }
}

async function startNextBoardAfterClean(options: {
  nextLevel: number;
  shouldUseJourneyStart: boolean;
  startLevel: (level: number) => Promise<void>;
  ensureVisible?: boolean;
  sampleMemory?: boolean;
}): Promise<void> {
  const { nextLevel, shouldUseJourneyStart, startLevel, ensureVisible = true, sampleMemory = true } = options;

  if (sampleMemory) {
    await sampleTransitionMemory('9_before_startLevel');
  }

  if (shouldUseJourneyStart) {
    console.log(`🎮 endgame-flow: Calling startNewRunFromJourney(${nextLevel}) because we came from Journey/interim board`);
    if (typeof (window as any).startNewRunFromJourney === 'function') {
      await (window as any).startNewRunFromJourney(nextLevel);
      if (sampleMemory) {
        await sampleTransitionMemory('10_after_startLevel');
      }
      logger.info(`🎯 endgame-flow: startNewRunFromJourney completed for board ${nextLevel}`);
      if (ensureVisible) {
        await layoutBoardSafe();
        await showAppAndRenderBoard();
      }
      try { delete (window as any).__ccBoardJustCompleted; } catch {}
      return;
    }

    console.error('❌ endgame-flow: startNewRunFromJourney function not found, falling back to startLevel');
    await showAppOnly();
    await startLevel(nextLevel);
    if (sampleMemory) {
      await sampleTransitionMemory('10_after_startLevel');
    }
    if (ensureVisible) {
      await showAppAndRenderBoard();
    }
    return;
  }

  console.log(`🎮 endgame-flow: Calling startLevel(${nextLevel}) for regular board continuation`);
  await showAppOnly();
  await startLevel(nextLevel);
  if (sampleMemory) {
    await sampleTransitionMemory('10_after_startLevel');
  }
  logger.info(`🎯 endgame-flow: startLevel completed, should now be on Board ${nextLevel}`);
  if (ensureVisible) {
    await showAppAndRenderBoard();
  }
  try { delete (window as any).__ccBoardJustCompleted; } catch {}
}

function schedulePostTransitionBoardRecovery(options: {
  nextLevel: number;
  shouldUseJourneyStart: boolean;
  startLevel: (level: number) => Promise<void>;
  shouldAbortEndgameFlow: () => boolean;
  delayMs?: number;
}): void {
  const { nextLevel, shouldUseJourneyStart, startLevel, shouldAbortEndgameFlow, delayMs = 600 } = options;

  setTimeout(async () => {
    if (shouldAbortEndgameFlow()) return;
    try {
      const appEl = document.getElementById('app');
      const appVisible = !!appEl && !appEl.hasAttribute('hidden') &&
        appEl.style.display !== 'none' && appEl.style.visibility !== 'hidden';
      const tilesCount = (window as any).STATE?.tiles?.filter?.((t: any) => t && !t.destroyed && (t.value | 0) > 0)?.length || 0;
      const needsRecovery = !appVisible || tilesCount === 0;
      if (!needsRecovery) return;

      if ((window as any).__ccRecoverStartNewRunInProgress) return;
      (window as any).__ccRecoverStartNewRunInProgress = true;

      console.warn('⚠️ endgame-flow: Board did not appear after transition - attempting recovery', {
        appVisible,
        tilesCount,
        nextLevel
      });

      await startNextBoardAfterClean({
        nextLevel,
        shouldUseJourneyStart,
        startLevel,
        ensureVisible: false,
        sampleMemory: false,
      });
    } catch (recoveryError) {
      console.warn('⚠️ endgame-flow: Recovery attempt failed:', recoveryError);
    } finally {
      delete (window as any).__ccRecoverStartNewRunInProgress;
    }
  }, delayMs);
}

async function startNextBoardWithRetry(options: {
  nextLevel: number;
  shouldUseJourneyStart: boolean;
  startLevel: (level: number) => Promise<void>;
  ensureVisible?: boolean;
  sampleMemory?: boolean;
  clearTransitionFlagOnError?: boolean;
}): Promise<void> {
  const {
    nextLevel,
    shouldUseJourneyStart,
    startLevel,
    ensureVisible = false,
    sampleMemory = false,
    clearTransitionFlagOnError = false,
  } = options;

  try {
    await startNextBoardAfterClean({
      nextLevel,
      shouldUseJourneyStart,
      startLevel,
      ensureVisible,
      sampleMemory,
    });
  } catch (startLevelError: any) {
    if (sampleMemory) {
      await reportTransitionMemory();
    }
    console.error('❌ endgame-flow: startLevel/startNewRunFromJourney failed:', startLevelError);
    logger.error('❌ endgame-flow: startLevel error:', String(startLevelError?.message || startLevelError));

    if (clearTransitionFlagOnError) {
      (window as any).__ccBoardTransitionActive = false;
      console.log('✅ endgame-flow: Cleared __ccBoardTransitionActive flag after error');
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await startNextBoardAfterClean({
        nextLevel,
        shouldUseJourneyStart,
        startLevel,
        ensureVisible: false,
        sampleMemory: false,
      });
      logger.info('🎯 endgame-flow: startLevel retry completed');
    } catch (retryError: any) {
      console.error('❌ endgame-flow: startLevel retry also failed:', retryError);
    }
  }
}

async function performPreStartLevelCleanup(): Promise<void> {
  try {
    window.CC?.cleanupFxForBoardReset?.('endgame-flow');
    window.CC?.softResetBoardView?.('endgame-flow');
    window.CC?.destroyOldBoardForTransition?.('endgame-flow');
    await sampleTransitionMemory('6_after_destroyOldBoard');
    window.CC?.cleanupTexturesForBoardTransition?.('endgame-flow', false, true);
    await sampleTransitionMemory('7_after_cleanupTextures');
    console.log('✅ endgame-flow: Old board destroyed, texture GC run');

    // AnimationManager and the board FX cleanup above own gameplay animation
    // retirement. Global GSAP state belongs to the whole application.
  } catch (memErr) {
    console.warn('⚠️ endgame-flow: Pre-startLevel memory cleanup failed (non-fatal):', memErr);
  }
}

function createNewCardCleanBoardHandoffCover(): () => void {
  if (typeof document === 'undefined') return () => {};
  const existing = document.getElementById('cc-new-card-clean-board-handoff');
  if (existing) {
    try { existing.remove(); } catch {}
  }
  const cover = document.createElement('div');
  cover.id = 'cc-new-card-clean-board-handoff';
  cover.setAttribute('aria-hidden', 'true');
  cover.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:1294000',
    'pointer-events:none',
    'opacity:1',
    'transform:translateZ(0)',
  ].join(';');
  applyAppPaperSurfaceToElement(cover);
  document.body.appendChild(cover);
  return () => {
    try { gsap.killTweensOf(cover); } catch {}
    try { cover.remove(); } catch {}
  };
}

export async function runEndgameFlow(ctx: EndgameContext): Promise<void> {
  // A terminal merge can spend time in its visual handoff before calling this
  // function. Use the token captured at that original request, otherwise a
  // late callback can start after Exit -> Play and incorrectly adopt the new
  // run's token as its own.
  const abortTokenAtStart = Number(
    ctx.abortToken ?? (window as any).__ccEndgameFlowAbortToken ?? 0
  );
  const shouldAbortEndgameFlow = (): boolean => {
    try {
      if ((window as any).exitingToMenu === true) return true;
      if (Number((window as any).__ccEndgameFlowAbortToken || 0) !== abortTokenAtStart) return true;
      const home = document.getElementById('home');
      const journey = document.getElementById('journey-screen');
      const homeVisible = !!home && !home.hasAttribute('hidden') && window.getComputedStyle(home).display !== 'none';
      const journeyVisible = !!journey && !journey.hasAttribute('hidden') && window.getComputedStyle(journey).display !== 'none';
      return homeVisible || journeyVisible;
    } catch {
      return false;
    }
  };
  if (shouldAbortEndgameFlow()) {
    console.warn('⚠️ runEndgameFlow: aborted before start (exit/home/journey active)');
    return;
  }
  try {
    const { resetEndgameHint } = await import('./endgame-hint.js');
    resetEndgameHint();
  } catch {}
  // 🔥 USER BUG FIX: Don't run endgame flow if game is hidden (user is on homepage/other screens)
  // This prevents clean board modal from appearing when user navigates away from game
  const appElement = document.getElementById('app') as HTMLElement | null;
  const homeElement = document.getElementById('home') as HTMLElement | null;
  const journeyElement = document.getElementById('journey-screen') as HTMLElement | null;
  const isAppVisible = !!appElement && !appElement.hasAttribute('hidden') && (() => {
    const style = window.getComputedStyle(appElement);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  })();
  const isHomeVisible = !!homeElement && !homeElement.hasAttribute('hidden') && (() => {
    const style = window.getComputedStyle(homeElement);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  })();
  const isJourneyVisible = !!journeyElement && !journeyElement.hasAttribute('hidden') && (() => {
    const style = window.getComputedStyle(journeyElement);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  })();
  
  if (isHomeVisible || isJourneyVisible) {
    console.log('⏳ runEndgameFlow skipped - home/journey visible (user navigated away from game)', {
      isAppVisible,
      isHomeVisible,
      isJourneyVisible
    });
    return;
  }
  if (!isAppVisible) {
    try {
      const transitionStartMem = (performance as any)?.memory;
      if (transitionStartMem) {
        console.log('🧠 endgame-flow: Transition start memory snapshot', {
          usedJSHeapSize: transitionStartMem.usedJSHeapSize,
          totalJSHeapSize: transitionStartMem.totalJSHeapSize,
          jsHeapSizeLimit: transitionStartMem.jsHeapSizeLimit
        });
      }
      const uiManagerModule = await import('./ui-manager.js');
      uiManagerModule.default?.showApp?.();
      console.warn('⚠️ runEndgameFlow: App was hidden with no UI visible - force showApp()');
    } catch {}
  }
  
  // 🔥 CRITICAL: Guard against multiple simultaneous calls
  if ((window as any).CC?._endgameFlowRunning) {
    console.warn('⚠️ runEndgameFlow: Already running, skipping duplicate call');
    return;
  }
  
  (window as any).CC = (window as any).CC || {};
  (window as any).CC._endgameFlowRunning = true;
  
  const {
    app, stage, board, boardBG,
    level, startLevel,
    hideGrid, showGrid,
    boardNumber: ctxBoardNumber = 1,
    skipStarsWait = false,
    finalMergeCompleted = false,
  } = ctx;
  
  // 🔥 CRITICAL FIX: Use STATE.boardNumber if available, fallback to ctx.boardNumber
  // This ensures we use the most up-to-date board number (STATE is synced in startLevel)
  const STATE = (window as any).STATE;
  const boardNumber = (STATE?.boardNumber && Number.isFinite(STATE.boardNumber)) 
    ? STATE.boardNumber 
    : ctxBoardNumber;
  if (!isArcadeHomeRunMode()) {
    recordJourneyPlayAgainIncident('journey-endgame-flow-start', { boardId: boardNumber });
  }
  const firstPlayTutorialCompletion = isFirstPlayTutorialCompletionFlow();
  const firstPlayTutorialSource = (window as any).__ccFirstPlayTutorialRunSource === 'journey'
    ? 'journey'
    : 'arcade';
  console.log(`🎯 endgame-flow: Using boardNumber ${boardNumber} (STATE.boardNumber: ${STATE?.boardNumber}, ctx.boardNumber: ${ctxBoardNumber})`);

  // 🔥 CRITICAL FIX: Save score BEFORE clearing saved game state
  // This allows us to show the correct score when resuming from clean board screen
  let savedScore = 0;
  try {
    const savedGame = localStorage.getItem('cc_saved_game');
    if (savedGame) {
      const gameState = JSON.parse(savedGame);
      savedScore = Number(gameState.score) || 0;
      console.log('📊 endgame-flow: Saved score before clearing:', savedScore);
    }
  } catch (e) {
    console.warn('⚠️ endgame-flow: Failed to read saved score:', e);
  }
  
  // Clear old game state when clean board screen appears
  try {
    localStorage.removeItem('cc_saved_game');
    localStorage.removeItem('cubeCrash_gameState');
  } catch (error) {
    console.warn('⚠️ endgame-flow: Failed to clear saved game state:', error);
  }

  // lock interakcije tijekom kraja levela
  const prevMode = stage.eventMode;
  stage.eventMode = 'none';

  // Keep the grid visible through final handoff/residual pop-out. Hiding it before
  // the wait makes final wild merges look like a dead 2-4s pause before New Card.
  const prevBG = boardBG?.visible !== false;
  let cleanupNewCardHandoffCover: (() => void) | null = null;
  let cleanupTutorialCompleteCover: (() => void) | null = null;
  let continueTutorialIntoArcade = false;
  let continueTutorialIntoJourney = false;

  try {
    // Clean Board modal (bonus starting at 500, +200 per board) → immediately start next level on Continue
    const effectiveBoard = Math.max(1, boardNumber | 0);
    const bonus = 500 + (effectiveBoard - 1) * 200; // Board 1: 500, Board 2: 700, Board 3: 900, Board 4: 1100
    
    // 🔥 Bonus breakdown:
    // - Combo bonus: longestCombo × 50 (computed inside clean-board-modal)
    // - Efficiency bonus: moves + stack depth (computed here)
    const efficiencyBonus = computeEfficiencyBonusFromState({ bonus, boardNumber });
    const arcadeStageClearMode = isArcadeHomeRunMode();

    // Targeted handoff only. Avoid waiting on unrelated animation families:
    // final-merge-handoff already waits exact TNT/juice/magnet/sparkle finales.
    // Here we only give active stars/bubbles a short, specific chance to complete.
    try {
      await waitForEndgameAnimationHandoff({
        isArcade: arcadeStageClearMode,
        skipStarsWait: skipStarsWait || finalMergeCompleted,
        handoffAlreadySettled: finalMergeCompleted || wasFinalMergeHandoffRecentlySettled(),
      });
    } catch (e) {
      console.warn('⚠️ endgame-flow: animation wait failed (non-fatal):', e);
    }
    if (shouldAbortEndgameFlow()) {
      console.warn('⚠️ endgame-flow: aborted after handoff wait');
      return;
    }

    // sakrij grid/ghostove tek nakon final handoffa i residual pop-outa,
    // neposredno prije modala/new-card flowa.
    if (!arcadeStageClearMode) {
      try { hideGrid?.(); } catch {}
    }

    if (firstPlayTutorialCompletion) {
      await animateBoardIndicatorExitSafe(0.3, 'tutorial-complete');
      try {
        const { showTutorialCompleteModal, cleanupTutorialCompleteModal } = await import('./tutorial-complete-modal.js');
        cleanupTutorialCompleteCover = cleanupTutorialCompleteModal;
        await showTutorialCompleteModal();
        const { markFirstPlayTutorialDone } = await import('./first-play-tutorial.js');
        markFirstPlayTutorialDone();
      } catch (modalError) {
        console.warn('⚠️ endgame-flow: Tutorial complete modal failed; continuing to selected first-play destination:', modalError);
        const { markFirstPlayTutorialDone } = await import('./first-play-tutorial.js');
        markFirstPlayTutorialDone();
      }
      if (firstPlayTutorialSource === 'journey') {
        continueTutorialIntoJourney = true;
      } else {
        continueTutorialIntoArcade = true;
      }
      return;
    }

    if (arcadeStageClearMode) {
      const clearedStage = Math.max(1, boardNumber | 0);
      const nextStage = clearedStage + 1;
      const currentScore = ctx.getScore ? (ctx.getScore() | 0) : 0;

      try {
        const { arcadeStatsService } = await import('../services/arcade-stats-service.js');
        arcadeStatsService.updateHighScore(currentScore);
      } catch (error) {
        logger.warn('⚠️ endgame-flow: Failed to update Arcade high score on stage clear:', error);
      }

      try {
        const { showArcadeStageClearModal } = await import('./arcade-stage-clear-modal.js');
        const stageClearResult = await showArcadeStageClearModal(clearedStage, nextStage);
        if (stageClearResult.action !== 'continue') {
          logger.info(`🎮 endgame-flow: Arcade stage ${clearedStage} continuation was cancelled; progression remains unchanged`);
          return;
        }
      } catch (modalError) {
        logger.warn('⚠️ endgame-flow: Arcade stage clear modal failed, continuing to next stage:', modalError);
      }

      try {
        localStorage.removeItem('cc_board_completed');
        localStorage.removeItem('cc_saved_game');
        localStorage.removeItem('cubeCrash_gameState');
      } catch {}

      try {
        (window as any).__ccPreserveScore = currentScore;
        (window as any).__ccArcadeStageContinuePreserveWild = true;
        (window as any).__ccArcadeStageWildMeterCarryover = 0.25;
        delete (window as any).__ccSkipRebuildBoard;
        delete (window as any).__skipBoardExitAnimation;
        // This modal already presented the next Round. Do not replay a stale
        // Homepage continuation cue while rebuilding it.
        delete (window as any).__ccArcadeContinuationCueRound;
        try {
          const uiManagerModule = await import('./ui-manager.js');
          uiManagerModule.default?.showApp?.();
        } catch {}

        // startLevel is the single reset/rebuild/layout owner. Await it so the
        // outer finally cannot reveal ghosts, restore input, or clear score and
        // wild carryover while the next board is still preparing.
        await startLevel(nextStage);
        logger.info(`🎮 endgame-flow: Arcade continued from stage ${clearedStage} to stage ${nextStage} with score ${currentScore}`);
      } finally {
        delete (window as any).__ccPreserveScore;
        delete (window as any).__ccArcadeStageContinuePreserveWild;
        delete (window as any).__ccArcadeStageWildMeterCarryover;
      }
      return;
    }

    try {
      const { runJourneyCompletionFlow } = await import('./journey-completion-flow.js');
      const journeyCompletionResult = await runJourneyCompletionFlow({
        boardNumber,
        level,
        logger,
        createNewCardHandoffCover: createNewCardCleanBoardHandoffCover,
      });
      cleanupNewCardHandoffCover = journeyCompletionResult.cleanupNewCardHandoffCover;
    } catch (error) {
      logger.warn('⚠️ Journey completion flow failed:', error);
    }
    // The completion flow can include its own visible/async handoff. The user
    // may open X -> Exit while it is running, then start the board again from
    // the returned detail modal. Never let this old run continue into a Clean
    // Board modal over that newer gameplay session.
    if (shouldAbortEndgameFlow()) {
      console.warn('⚠️ endgame-flow: aborted after Journey completion handoff');
      return;
    }
    // 🔥 CRITICAL FIX: Calculate nextLevel from boardNumber, not level
    // boardNumber is always accurate (set in startLevel), while level might be stale
    // This ensures correct next board number when coming from interim board
    const nextLevel = (boardNumber | 0) + 1;
    const currentScore = ctx.getScore ? (ctx.getScore() | 0) : 0;
    const finalScoreForecast = Math.min(999999, Math.max(0, currentScore) + Math.max(0, bonus));

    // Save completion data for hard-exit resume (includes score + bonus breakdown)
    try {
      localStorage.setItem('cc_board_completed', JSON.stringify({
        completedLevel: level,
        nextLevel,
        timestamp: Date.now(),
        score: currentScore,
        bonus,
        finalScore: finalScoreForecast
      }));
      console.log('💾 endgame-flow: Saved completed board state', { level, nextLevel, currentScore, bonus, finalScoreForecast });
    } catch (error) {
      console.warn('⚠️ endgame-flow: Failed to save completed board state:', error);
    }
    
    // 🔥 CRITICAL FIX: Hide board indicator IMMEDIATELY when clean board modal appears
    // This prevents persistent "BOARD 07" element from showing during clean board modal and transition
    await animateBoardIndicatorExitSafe(0.3, 'before-clean-board-modal');
    if (shouldAbortEndgameFlow()) {
      console.warn('⚠️ endgame-flow: aborted before Clean Board modal');
      return;
    }
    
    let modalResult: { action: string } | undefined;
    try {
      const { showCleanBoardModal } = await import('./clean-board-modal.js');
      modalResult = await showCleanBoardModal({
        app, stage,
        getScore: ctx.getScore,
        setScore: ctx.setScore,
        animateScore: ctx.animateScore ? ((score: number, duration?: number) => {
          if (ctx.animateScore) {
            ctx.animateScore(score, duration || 0.45);
          }
        }) : undefined,
        updateHUD: ctx.updateHUD,
        bonus,
        efficiencyBonus,
        scoreCap: 999999,
        boardNumber,
        isFromInterimBoardOverride: !arcadeStageClearMode && isJourneyInterimOriginActive(),
      });
    } finally {
      if (cleanupNewCardHandoffCover) {
        cleanupNewCardHandoffCover();
        cleanupNewCardHandoffCover = null;
      }
    }

    if (modalResult?.action === '__navigation-abort__' || shouldAbortEndgameFlow()) {
      console.warn('⚠️ endgame-flow: Clean Board modal invalidated by navigation; stopping stale completion flow');
      return;
    }
    
    console.log(`🎯 endgame-flow: Clean board modal closed with action: ${modalResult?.action}`);
    logger.info(`🎯 endgame-flow: Clean board modal result: ${modalResult?.action}`);
    const modalActionDecision = resolveCleanBoardActionDecision({
      action: modalResult?.action,
      isArcade: isArcadeHomeRunMode(),
    });
    
    // 🔥 NEW LOGIC: Handle different actions from clean board modal
    if (modalActionDecision.type === 'back-to-journey') {
      await handleCleanBoardBackToJourney();
      return;
    }

    if (modalActionDecision.type === 'arcade-exit') {
      await handleArcadeCleanBoardExit();
      return;
    }

    if (modalActionDecision.type === 'journey-exit') {
      await handleJourneyCleanBoardExit(ctx, boardNumber);
      return;
    }
    
    if (modalActionDecision.type === 'play-again') {
      await handleCleanBoardPlayAgain(ctx, boardNumber);
      return;
    }
    
    // Default: 'continue' action (interim boards or fallback)
    // 🔥 CRITICAL FIX: Don't wait for clean board modal to fully close - show transition screen immediately
    // The modal will clean up in background while transition screen is showing
    // Get final score AFTER modal has updated it (modal adds bonus and sets final score)
    const finalScore = ctx.getScore ? ctx.getScore() : 0;
    logger.info(`🎯 endgame-flow: Continue action - current level: ${level}, next level: ${nextLevel}, final score: ${finalScore}`);
    // 🔥 FIX: Define in scope for transition path (used for duration logging)
    const transitionStartTs = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

    // 🔥 CRITICAL FIX: Hide board indicator immediately before showing transition screen
    // This prevents persistent "BOARD 07" element from showing during transition
    await animateBoardIndicatorExitSafe(0.2, 'before-transition-screen');

    await updateCleanBoardHighScore(boardNumber, finalScore, 'Continue');
    
    // Preserve final score before starting next board
    (window as any).__ccPreserveScore = finalScore;
    console.log('💾 endgame-flow: Preserving final score for next board:', finalScore);
    
    // 🔥 USER REQUEST FIX: DO NOT save game state after clean board!
    // Board is COMPLETED, no need to save state (would create "Continue" button on completed board)
    // Board save state was already cleared in clean-board-modal.ts when Continue was clicked
    console.log('✅ endgame-flow: Skipping saveGameState() after clean board (board is completed, no save needed)');
    
    // 🔥 REMOVED: saveGameState() call - board is completed, save state should NOT exist
    // This prevents "Continue" button from appearing on completed boards when user returns
    
    await performPreNextBoardCleanup(nextLevel);
    
    // 🧪 DEV LOG: Snapshot right before starting next board
    try {
      (window as any).__ccLogRuntimeStats?.(`continue->board${nextLevel}:preStart`);
    } catch {}
    
    // 🔥 USER BUG FIX: Clear __ccSkipRebuildBoard flag before starting next level
    // This ensures board is rebuilt properly for each new level (prevents ghost placeholders)
    // The flag may have been set by previous game state loading, but for clean board continuation
    // we always want to rebuild the board with new tiles
    delete (window as any).__ccSkipRebuildBoard;
    // 🔥 CRITICAL FIX: Clear skip board exit animation flag - new board should always animate exit
    delete (window as any).__skipBoardExitAnimation;
    console.log('✅ endgame-flow: Cleared __ccSkipRebuildBoard and __skipBoardExitAnimation flags - board will be rebuilt for next level');
    
    // 🔥 CRITICAL FIX: Detect if we came from interim board (Journey) and use proper initialization
    // If we came from Journey (interim board), we need to use startNewRunFromJourney() instead of startLevel()
    // because startLevel() doesn't initialize board properly (no bootGame() + layoutGame())
    const journeyStartDecision = resolveJourneyStartDecision({
      cameFromJourney: (window as any).__ccCameFromJourney,
      isInterimBoard: (window as any).__ccIsInterimBoard,
      cameFromInterimBoard: (window as any).__ccFromInterimBoard,
    });
    const {
      cameFromJourney,
      isInterimBoard,
      cameFromInterimBoard,
      shouldUseJourneyStart,
    } = journeyStartDecision;
    
    console.log(`🎯 endgame-flow: Continue action detected - cameFromJourney: ${cameFromJourney}, isInterimBoard: ${isInterimBoard}, cameFromInterimBoard: ${cameFromInterimBoard}`);
    
    // 🔥 CRITICAL FIX: Hide board indicator before showing transition screen
    // This prevents persistent "BOARD 07" element from showing during transition
    await animateBoardIndicatorExitSafe(0.2, 'transition-start');
    
    // 🔥 USER REQUEST: Show board transition screen before starting next board
    // This screen shows the board number with beautiful animations
    // 🔥 CRITICAL FIX: Show transition screen immediately without delay
    try {
      await prepareForBoardTransitionScreen();
      const { showBoardTransitionScreen, cleanupBoardTransitionScreen } = await import('./board-transition-screen.js');
      try {
        cleanupBoardTransitionScreen?.();
        console.log('✅ endgame-flow: Forced cleanup before transition screen');
      } catch {}
      await new Promise(resolve => requestAnimationFrame(resolve));
      // 🔥 CRITICAL FIX: Use nextLevel for transition screen (next board, not current)
      // nextLevel is calculated from boardNumber + 1, which is the correct next board
      // This ensures correct board number is shown when coming from interim board
      console.log(`🎯 endgame-flow: Showing transition screen for board ${nextLevel} (current boardNumber: ${boardNumber}, nextLevel: ${nextLevel})`);
      await showBoardTransitionScreen({
        boardNumber: nextLevel,
        onComplete: async () => {
          if (shouldAbortEndgameFlow()) {
            try { cleanupBoardTransitionScreen?.(); } catch {}
            console.warn('⚠️ endgame-flow: transition onComplete aborted (exit/home/journey active)');
            return;
          }
          // 🔥 CRITICAL: Stop PIXI ticker FIRST (sync, before any await) to prevent "addressModeU" errors.
          // A frame can fire between awaits; renderer must not touch textures while we destroy them.
          stopPixiTickerForTransition();
          const transitionEndTs = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
          console.log('⏱️ endgame-flow: Transition duration (ms)', Math.round(transitionEndTs - transitionStartTs));
          await completeBoardTransitionHandoff();
          // After transition screen completes, start the next board
          // 🔥 CRITICAL FIX: Hide app first to cleanup previous board before starting new one
          // This prevents blank screen with old board visible in background
          await hideAppBeforeNextBoard();

          // (Ticker already stopped at start of onComplete to prevent addressModeU during cleanup)

          // 🔥 MEMORY SPIKE FIX: Destroy old tiles and run soft texture cleanup BEFORE booting new board.
          // This reduces peak memory (avoids old + new tiles + transition assets all in memory).
          await performPreStartLevelCleanup();

          const transitionEndMem = (performance as any)?.memory;
          if (transitionEndMem) {
            console.log('🧠 endgame-flow: Pre-startLevel memory snapshot', {
              usedJSHeapSize: transitionEndMem.usedJSHeapSize,
              totalJSHeapSize: transitionEndMem.totalJSHeapSize,
              jsHeapSizeLimit: transitionEndMem.jsHeapSizeLimit
            });
          }
          await new Promise(resolve => requestAnimationFrame(resolve));
          await new Promise(resolve => requestAnimationFrame(resolve));

          // 🔥 MEMORY SPIKE FIX: Short delay so GC can reclaim old board before new board allocates.
          // Reduces peak on iOS during board transition (esp. 6→7).
          await new Promise(resolve => setTimeout(resolve, 100));
          await sampleTransitionMemory('8_after_delay');

          // 🔥 CRITICAL: Restart PIXI ticker so boot/render can proceed
          startPixiTickerForBoot();
          
          // 🔥 CRITICAL FIX: Wrap startLevel/startNewRunFromJourney in try-catch to prevent unhandled errors
          // Centralized cleanup already done above (cleanupFx, softReset, destroyOld, texture cleanup)
          await startNextBoardWithRetry({
            nextLevel,
            shouldUseJourneyStart,
            startLevel,
            ensureVisible: true,
            sampleMemory: true,
            clearTransitionFlagOnError: true,
          });
          await reportTransitionMemory();

          // 🔥 RECOVERY: If board failed to appear after transition, retry once
          schedulePostTransitionBoardRecovery({
            nextLevel,
            shouldUseJourneyStart,
            startLevel,
            shouldAbortEndgameFlow,
          });
        }
      });
    } catch (transitionError: any) {
      // If transition screen fails, fall back to direct board start
      console.warn('⚠️ endgame-flow: Board transition screen failed, starting board directly:', transitionError);
      logger.warn('⚠️ endgame-flow: Board transition screen failed, starting board directly:', transitionError);
      
      await startNextBoardWithRetry({
        nextLevel,
        shouldUseJourneyStart,
        startLevel,
        ensureVisible: false,
        sampleMemory: false,
      });
    }
    
    // Clear preserved score flag after starting
    delete (window as any).__ccPreserveScore;
  } catch (error) {
    // 🔥 FIX: Catch any errors and ensure flag is cleared
    console.error('❌ runEndgameFlow error:', error);
    throw error; // Re-throw to propagate
  } finally {
    if (cleanupNewCardHandoffCover) {
      cleanupNewCardHandoffCover();
      cleanupNewCardHandoffCover = null;
    }
    // vrati stanje
    try { if (boardBG) boardBG.visible = prevBG; } catch {}
    try { showGrid?.(); } catch {}
    stage.eventMode = prevMode;
    // Clear flag - 🔥 FIX: This ALWAYS runs now, even on error
    (window as any).CC._endgameFlowRunning = false;

    if (continueTutorialIntoArcade) {
      const cleanupCover = cleanupTutorialCompleteCover || (() => {});
      cleanupTutorialCompleteCover = null;
      await continueFirstPlayTutorialIntoArcade(startLevel, cleanupCover);
    }
    if (continueTutorialIntoJourney) {
      const cleanupCover = cleanupTutorialCompleteCover || (() => {});
      cleanupTutorialCompleteCover = null;
      await continueFirstPlayTutorialIntoJourney(cleanupCover);
    }
  }
}
