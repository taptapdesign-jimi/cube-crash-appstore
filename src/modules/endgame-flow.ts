// @ts-nocheck
import { logger } from '../core/logger.js';
import { gsap } from 'gsap';
import { computeEfficiencyBonusFromState } from './clean-board-score-utils.ts';
import { isArcadeHomeRunMode } from './run-mode.js';
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
  startLevel: (level: number) => void;
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
}

interface CleanBoardModalOptions {
  app: any;
  stage: any;
  getScore: (() => number) | undefined;
  setScore: ((score: number) => void) | undefined;
  animateScore: ((score: number, duration: number) => void) | undefined;
  updateHUD: (() => void) | undefined;
  bonus: number;
  scoreCap: number;
  boardNumber: number;
}

export async function runEndgameFlow(ctx: EndgameContext): Promise<void> {
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
  } = ctx;
  
  // 🔥 CRITICAL FIX: Use STATE.boardNumber if available, fallback to ctx.boardNumber
  // This ensures we use the most up-to-date board number (STATE is synced in startLevel)
  const STATE = (window as any).STATE;
  const boardNumber = (STATE?.boardNumber && Number.isFinite(STATE.boardNumber)) 
    ? STATE.boardNumber 
    : ctxBoardNumber;
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

  // sakrij grid/ghostove dok traje flow
  const prevBG = boardBG?.visible !== false;
  try { hideGrid?.(); } catch {}

  try {
    // Clean Board modal (bonus starting at 500, +200 per board) → immediately start next level on Continue
    const effectiveBoard = Math.max(1, boardNumber | 0);
    const bonus = 500 + (effectiveBoard - 1) * 200; // Board 1: 500, Board 2: 700, Board 3: 900, Board 4: 1100
    
    // 🔥 Bonus breakdown:
    // - Combo bonus: longestCombo × 50 (computed inside clean-board-modal)
    // - Efficiency bonus: moves + stack depth (computed here)
    const efficiencyBonus = computeEfficiencyBonusFromState({ bonus, boardNumber });

    // 🔥 ENDGAME ANIMATION-WAIT: Wait for stars + bubbles before clean board; skip stars when regular/magnet (none run)
    // 🔥 CLEAN BOARD DELAY FIX: 4s max (was 5.5s/6s). Bubbles safety timeout 4.4s + early resolve when done.
    // 🔥 CLEAN BOARD TOO EARLY FIX: Bubbles/stars start via setTimeout(200ms). runEndgameFlow can be triggered
    // immediately from merge-6; if we poll before 200ms, we see "not running" → resolve → modal blocks animations.
    // When we expect stars/bubbles (!skipStarsWait), wait 350ms first so they have time to start, then poll.
    try {
      const fxModule = await import('./fx.js');
      const maxWaitMs = 4000;
      const waitForAnimations = async () => {
        if (skipStarsWait && typeof fxModule.waitForBubblesAnimationToComplete === 'function') {
          await fxModule.waitForBubblesAnimationToComplete(maxWaitMs);
        } else if (fxModule && typeof fxModule.waitForOngoingAnimations === 'function') {
          await new Promise((r) => setTimeout(r, 350)); // let bubbles/stars start (200ms) + buffer
          await fxModule.waitForOngoingAnimations(maxWaitMs);
        }
      };
      const hardTimeout = new Promise<'timeout'>((resolve) => {
        setTimeout(() => resolve('timeout'), maxWaitMs + 800);
      });
      const result = await Promise.race([waitForAnimations().then(() => 'done' as const), hardTimeout]);
      if (result === 'timeout') {
        console.warn('⚠️ endgame-flow: Animation wait timed out - forcing cleanup to proceed');
        try {
          const bubblesModule = await import('./wild-juice-bubbles-explosion.js');
          if (bubblesModule && typeof bubblesModule.stopWildJuiceBubblesExplosion === 'function') {
            bubblesModule.stopWildJuiceBubblesExplosion();
          }
        } catch {}
        try {
          if (fxModule && typeof fxModule.forceCleanupAllStarAnimations === 'function') {
            fxModule.forceCleanupAllStarAnimations();
          } else if (fxModule && typeof fxModule.cleanupExistingStarAnimations === 'function') {
            fxModule.cleanupExistingStarAnimations();
          }
        } catch {}
        try {
          const starsCollector = await import('./stars-collector.js');
          starsCollector.cleanupStarsCollector?.();
        } catch {}
      }
    } catch (e) {
      console.warn('⚠️ endgame-flow: animation wait failed (non-fatal):', e);
    }

    const { showCleanBoardModal } = await import('./clean-board-modal.js');
    
    // 🗺️ JOURNEY PROGRESSION: Unlock journey board when board is completed (won)
    // This is called when clean board modal appears (board is successfully completed)
    try {
      const { journeyBoardsManager } = await import('./journey-boards-manager.js');
      journeyBoardsManager.unlockBoardOnCompletion(boardNumber);
      logger.info(`🗺️ Journey board ${boardNumber} unlocked on completion`);
      
      // 🔥 JOURNEY PROGRESSION: Update highestUnlockedBoardId and lastOpenedBoardId
      const { journeyProgressionState } = await import('./journey-progression-state.js');
      const nextLevel = (level | 0) + 1;
      const highestUnlocked = Math.max(
        journeyProgressionState.getHighestUnlockedBoardId() || 1,
        nextLevel
      );
      journeyProgressionState.setHighestUnlockedBoardId(highestUnlocked);
      journeyProgressionState.setLastOpenedBoardId(highestUnlocked); // Move to new highest unlocked
      journeyProgressionState.clearCurrentRunState(); // Run finished successfully
      logger.info(`🗺️ Journey: Board ${boardNumber} completed - highestUnlocked: ${highestUnlocked}, lastOpened: ${highestUnlocked}`);
    } catch (error) {
      logger.warn('⚠️ Failed to unlock journey board on completion:', error);
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
    try {
      const { animateBoardIndicatorExit } = await import('./hud-helpers.js');
      if (typeof animateBoardIndicatorExit === 'function') {
        animateBoardIndicatorExit(0.3); // Exit animation
        console.log('✅ endgame-flow: Board indicator exit animation started (before clean board modal)');
        logger.info('✅ endgame-flow: Board indicator exit animation started (before clean board modal)');
      }
    } catch (indicatorError) {
      console.warn('⚠️ endgame-flow: Failed to hide board indicator (non-fatal):', indicatorError);
    }
    
    const modalResult = await showCleanBoardModal({ 
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
      isFromInterimBoardOverride: (window as any).__ccFromInterimBoard === true || (window as any).__ccIsInterimBoard === true || localStorage.getItem('__ccFromInterimBoard') === 'true',
    });
    
    console.log(`🎯 endgame-flow: Clean board modal closed with action: ${modalResult?.action}`);
    logger.info(`🎯 endgame-flow: Clean board modal result: ${modalResult?.action}`);
    
    // 🔥 NEW LOGIC: Handle different actions from clean board modal
    if (modalResult?.action === 'back-to-journey') {
      console.log('🧭 endgame-flow: Back to Journey action');
      logger.info('🧭 endgame-flow: Back to Journey action');
      try {
        (window as any).__ccCameFromJourney = true;
        localStorage.setItem('__ccCameFromJourney', 'true');
        delete (window as any).__ccCameFromDetailModal;
        delete (window as any).__ccDetailModalBoardId;
        delete (window as any).__skipBoardExitAnimation;
        if (typeof (window as any).exitToMenu === 'function') {
          // Board exit animation already played in clean-board-modal
          (window as any).__skipBoardExitAnimation = true;
          await (window as any).exitToMenu();
        }
      } catch (error) {
        console.error('❌ endgame-flow: Failed to return to Journey:', error);
        logger.error('❌ endgame-flow: Failed to return to Journey:', error);
      }
      return;
    }

    if (modalResult?.action === 'exit') {
      if (isArcadeHomeRunMode()) {
        console.log('🚪 endgame-flow: Exit action in arcade_home mode - returning to homepage');
        logger.info('🚪 endgame-flow: arcade_home exit -> homepage');
        try {
          (window as any).__ccCameFromHomepage = true;
          (window as any).__ccCameFromJourney = false;
          localStorage.setItem('__ccCameFromHomepage', 'true');
          localStorage.removeItem('__ccCameFromJourney');
          delete (window as any).__ccCameFromDetailModal;
          delete (window as any).__ccDetailModalBoardId;
          delete (window as any).__skipBoardExitAnimation;
          if (typeof (window as any).exitToMenu === 'function') {
            await (window as any).exitToMenu();
          }
        } catch (error) {
          console.error('❌ endgame-flow: Failed to exit arcade_home run:', error);
          logger.error('❌ endgame-flow: Failed to exit arcade_home run:', error);
        }
        return;
      }

      // User clicked "Exit" → return DIRECTLY to detail modal (not Journey screen)
      console.log('🚪 endgame-flow: Exit action - returning DIRECTLY to detail modal');
      logger.info(`🚪 endgame-flow: Exit action - opening detail modal for board ${boardNumber}`);
      
      try {
        // Get final score AFTER modal has updated it (modal adds bonus and sets final score)
        const finalScore = ctx.getScore ? ctx.getScore() : 0;
        
        // 🏆 Update board high score before exiting
        try {
          const { boardStatsService } = await import('../services/board-stats-service.js');
          const isNewHigh = boardStatsService.updateBoardHighScore(boardNumber, finalScore);
          if (isNewHigh) {
            logger.info(`🏆 New board ${boardNumber} high score after clean board (Exit): ${finalScore}`);
            window.dispatchEvent(new CustomEvent('cc-board-highscore-updated', {
              detail: { boardId: boardNumber, highScore: finalScore }
            }));
          }
        } catch (error) {
          logger.warn('⚠️ Failed to update board high score before Exit:', error);
        }
        
        // 🔥 CRITICAL: Set flags to return DIRECTLY to detail modal (skip Journey screen)
        // 🔥 BUG FIX: Validate boardNumber before setting flag (must be 1-16)
        const validBoardNumber = Number.isFinite(boardNumber) && boardNumber >= 1 && boardNumber <= 16 
          ? boardNumber 
          : null;
        
        if (!validBoardNumber) {
          console.error(`❌ CRITICAL: Invalid boardNumber ${boardNumber} - cannot set detail modal flag!`);
          logger.error(`❌ CRITICAL: Invalid boardNumber ${boardNumber} - cannot set detail modal flag!`);
          // Don't set flag if boardNumber is invalid - this prevents opening wrong board
          return;
        }
        
        (window as any).__ccCameFromDetailModal = true;
        (window as any).__ccDetailModalBoardId = validBoardNumber;
        console.log(`🎯 Set flags for direct detail modal return: board ${validBoardNumber} (validated)`);
        logger.info(`🎯 Set flags for direct detail modal return: board ${validBoardNumber} (validated)`);
        
        // 🎯 CRITICAL: Clear board save state BEFORE opening detail modal
        // This ensures "Play" button shows instead of "Continue" (board was completed, nothing to continue)
        try {
          const { clearBoardSaveState, hasSavedStateForBoard } = await import('../utils/board-save-utils.js');
          
          // Check before clearing
          const hadSavedState = hasSavedStateForBoard(boardNumber);
          console.log(`🔍 endgame-flow: Board ${boardNumber} has saved state BEFORE clear: ${hadSavedState}`);
          
          // Clear board save state
          clearBoardSaveState(boardNumber);
          console.log(`✅ endgame-flow: Cleared board save state for board ${boardNumber}`);
          
          // Verify it was cleared
          const stillHasSavedState = hasSavedStateForBoard(boardNumber);
          console.log(`🔍 endgame-flow: Board ${boardNumber} has saved state AFTER clear: ${stillHasSavedState}`);
          
          // Also clear any completion flags that might interfere
          localStorage.removeItem('cc_board_completed');
          console.log(`✅ endgame-flow: Cleared cc_board_completed flag`);
          
          if (stillHasSavedState) {
            console.error(`❌ CRITICAL: Failed to clear saved state for board ${boardNumber}!`);
          }
        } catch (error) {
          logger.warn('⚠️ Failed to clear board save state before opening detail modal:', error);
        }
        
        // 🔥 CRITICAL FIX: DO NOT skip board exit animation - user wants to see it!
        // Board exit animation was already played in clean-board-modal before resolving
        // Clear any skip flag to ensure exitToMenu doesn't skip it (defensive)
        delete (window as any).__skipBoardExitAnimation;
        console.log('🎯 endgame-flow: Cleared skip flag - board exit animation already played in clean-board-modal');
        
        // Call exitToMenu which will detect these flags and open detail modal directly
        // Note: Board exit animation was already played in clean-board-modal, so exitToMenu will skip it
        // But we still need to call exitToMenu to handle the transition to detail modal
        if (typeof (window as any).exitToMenu === 'function') {
          // Set flag to skip board exit animation since it was already played in clean-board-modal
          (window as any).__skipBoardExitAnimation = true;
          console.log('🎯 endgame-flow: Set skip flag for exitToMenu (animation already played in clean-board-modal)');
          await (window as any).exitToMenu();
        }
      } catch (error) {
        console.error('❌ endgame-flow: Failed to exit to detail modal:', error);
        logger.error('❌ endgame-flow: Failed to exit to detail modal:', error);
      }
      
      return; // Exit function - don't continue to next board
    }
    
    if (modalResult?.action === 'play-again') {
      // User clicked "Play Again" → restart current board
      console.log('🔁 endgame-flow: Play Again action - restarting current board');
      logger.info(`🔁 endgame-flow: Play Again action - restarting board ${boardNumber}`);
      
      try {
        // Clear board save state for fresh restart
        const { clearBoardSaveState } = await import('../utils/board-save-utils.js');
        clearBoardSaveState(boardNumber);
        console.log(`✅ endgame-flow: Cleared saved state for board ${boardNumber} before Play Again`);
        
        // Get final score AFTER modal has updated it (modal adds bonus and sets final score)
        const finalScore = ctx.getScore ? ctx.getScore() : 0;
        
        // 🏆 Update board high score before restarting
        try {
          const { boardStatsService } = await import('../services/board-stats-service.js');
          const isNewHigh = boardStatsService.updateBoardHighScore(boardNumber, finalScore);
          if (isNewHigh) {
            logger.info(`🏆 New board ${boardNumber} high score after clean board (Play Again): ${finalScore}`);
            window.dispatchEvent(new CustomEvent('cc-board-highscore-updated', {
              detail: { boardId: boardNumber, highScore: finalScore }
            }));
          }
        } catch (error) {
          logger.warn('⚠️ Failed to update board high score before Play Again:', error);
        }
        
        // Restart current board (fresh start)
        // Arcade: use arcade boot path (fresh board 1, no journey state side effects).
        // Journey/interim: keep startNewRunFromJourney flow.
        if (isArcadeHomeRunMode()) {
          const uiManagerModule = await import('./ui-manager.js');
          await uiManagerModule.default.startNewGame();
          console.log('✅ endgame-flow: Restarted arcade board via uiManager.startNewGame');
        } else if (typeof (window as any).startNewRunFromJourney === 'function') {
          await (window as any).startNewRunFromJourney(boardNumber);
          console.log(`✅ endgame-flow: Restarted board ${boardNumber} via startNewRunFromJourney`);
        } else {
          console.error('❌ endgame-flow: startNewRunFromJourney function not found');
        }
      } catch (error) {
        console.error('❌ endgame-flow: Failed to restart board:', error);
        logger.error('❌ endgame-flow: Failed to restart board:', error);
      }
      
      return; // Exit function - don't continue to next board
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
    try {
      const { animateBoardIndicatorExit } = await import('./hud-helpers.js');
      if (typeof animateBoardIndicatorExit === 'function') {
        animateBoardIndicatorExit(0.2); // Fast exit animation
        console.log('✅ endgame-flow: Board indicator exit animation started (before transition screen)');
      }
    } catch (indicatorError) {
      console.warn('⚠️ endgame-flow: Failed to hide board indicator (non-fatal):', indicatorError);
    }

    // 🏆 BOARD-SPECIFIC HIGH SCORE (clean board)
    try {
      const { boardStatsService } = await import('../services/board-stats-service.js');
      const isNewHigh = boardStatsService.updateBoardHighScore(boardNumber, finalScore);
      if (isNewHigh) {
        logger.info(`🏆 New board ${boardNumber} high score after clean board: ${finalScore}`);
        window.dispatchEvent(new CustomEvent('cc-board-highscore-updated', {
          detail: { boardId: boardNumber, highScore: finalScore }
        }));
      }
    } catch (error) {
      logger.warn('⚠️ Failed to update board high score after clean board:', error);
    }
    
    // Preserve final score before starting next board
    (window as any).__ccPreserveScore = finalScore;
    console.log('💾 endgame-flow: Preserving final score for next board:', finalScore);
    
    // 🔥 USER REQUEST FIX: DO NOT save game state after clean board!
    // Board is COMPLETED, no need to save state (would create "Continue" button on completed board)
    // Board save state was already cleared in clean-board-modal.ts when Continue was clicked
    console.log('✅ endgame-flow: Skipping saveGameState() after clean board (board is completed, no save needed)');
    
    // 🔥 REMOVED: saveGameState() call - board is completed, save state should NOT exist
    // This prevents "Continue" button from appearing on completed boards when user returns
    
    // 🔥 CRITICAL FIX: Cleanup all animations and memory BEFORE starting next level
    // This prevents memory overflow and errors that could trigger restart
    // 🔥 LONG-TERM FIX: More aggressive cleanup for board 10+ to prevent accumulation
    const isLongGameSession = nextLevel >= 10;
    const isVeryLongSession = nextLevel >= 20;

    // 🔥 Memory spike tracker: identifies which step causes the largest allocation
    try {
      const { initMemorySpikeTracker, sampleMemorySpike, reportBiggestMemorySpike } = await import('../utils/memory-spike-tracker.js');
      initMemorySpikeTracker();
    } catch {}
    
    try {
      console.log(`🧹 endgame-flow: Performing ${isVeryLongSession ? 'VERY AGGRESSIVE' : isLongGameSession ? 'AGGRESSIVE' : 'standard'} cleanup before startLevel (Board ${nextLevel})...`);
      
      // Kill all animation-manager tracked tweens (matches Exit path behavior)
      try {
        const animMod = await import('./animation-manager.js');
        const am = animMod?.default;
        if (am && typeof am.killAll === 'function') {
          am.killAll();
          console.log('✅ endgame-flow: animationManager.killAll() completed');
        }
      } catch (e) {
        console.warn('⚠️ endgame-flow: animationManager.killAll failed:', e);
      }
      
      // Kill all GSAP animations
      if (gsap) {
        try {
          gsap.killTweensOf('*');
          if (gsap.globalTimeline) {
            gsap.globalTimeline.clear();
          }
          // 🔥 LONG-TERM: Clear all timelines for board 10+
          if (isLongGameSession) {
            try {
              if ((gsap as any).getAllTweens) {
                const allTweens = (gsap as any).getAllTweens();
                if (Array.isArray(allTweens)) {
                  allTweens.forEach((tween: any) => {
                    try { tween.kill(); } catch {}
                  });
                }
              }
            } catch {}
          }
        } catch {}
      }
      
      // Clear all timeouts and intervals
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
      
      // Cleanup all modal timeouts (lazy import to avoid circular dependency)
      try {
        const cleanBoardModal = await import('./clean-board-modal.js');
        if (cleanBoardModal && (cleanBoardModal as any).clearAllModalTimeouts) {
          (cleanBoardModal as any).clearAllModalTimeouts();
        }
      } catch {}
      
      // 🔥 MEMORY LEAK FIX: Cleanup confetti animations
      try {
        const confettiSystem = await import('./confetti-system.js');
        if (confettiSystem && typeof confettiSystem.cleanupConfetti === 'function') {
          confettiSystem.cleanupConfetti();
        }
      } catch (e) {
        // Ignore errors
      }

      // 🔥 MEMORY SPIKE FIX: Stop and destroy wild-juice bubble caches BEFORE transition.
      // Board 6 often has explosion active; freeing these early reduces peak during 6→7 transition.
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
      
      // 🔥 CRITICAL FIX: Cleanup FX in one place to avoid duplicate logic
      // cleanupAllEffects already skips bubble explosion during board transition.
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
      
      // Memory cleanup (lazy import to avoid circular dependency)
      try {
        const memoryManagerModule = await import('../utils/memory-manager.js');
        if (memoryManagerModule && (memoryManagerModule as any).memoryManager) {
          const mm = (memoryManagerModule as any).memoryManager;
          if (mm.performCleanup) {
            mm.performCleanup();
          }
          // 🔥 LONG-TERM: Force aggressive cleanup for board 10+
          if (isLongGameSession && mm.forceCleanup) {
            console.log('🔥 LONG-TERM: Forcing aggressive memory cleanup for board', nextLevel);
            mm.forceCleanup();
          }
        }
      } catch {}
      
      // 🔥 LONG-TERM: GC for very long sessions (board 20+) - NO texture cleanup here;
      // clearTextureCache/destroy base textures cause addressModeU crash (stage still references them).
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
      
      // 🔥 LONG-TERM: Aggressive non-texture cleanup for board 10+ - skip PIXI texture cache;
      // Texture cleanup before transition causes "addressModeU" null crash on next render.
      if (isLongGameSession) {
        console.log('🔥 LONG SESSION: Aggressive cleanup (no texture cache) for board', nextLevel);
      }
      
      console.log(`✅ endgame-flow: ${isVeryLongSession ? 'VERY AGGRESSIVE' : isLongGameSession ? 'AGGRESSIVE' : 'Standard'} cleanup completed`);
    } catch (cleanupError) {
      console.warn('⚠️ endgame-flow: Cleanup error (non-fatal):', cleanupError);
    }
    try { (await import('../utils/memory-spike-tracker.js')).sampleMemorySpike('1_after_standard_cleanup'); } catch {}
    
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
    const cameFromJourney = (window as any).__ccCameFromJourney === true;
    const isInterimBoard = (window as any).__ccIsInterimBoard === true;
    const cameFromInterimBoard = (window as any).__ccFromInterimBoard === true;
    const shouldUseJourneyStart = cameFromJourney || isInterimBoard || cameFromInterimBoard;
    
    console.log(`🎯 endgame-flow: Continue action detected - cameFromJourney: ${cameFromJourney}, isInterimBoard: ${isInterimBoard}, cameFromInterimBoard: ${cameFromInterimBoard}`);
    
    // 🔥 CRITICAL FIX: Hide board indicator before showing transition screen
    // This prevents persistent "BOARD 07" element from showing during transition
    try {
      const { animateBoardIndicatorExit } = await import('./hud-helpers.js');
      if (typeof animateBoardIndicatorExit === 'function') {
        animateBoardIndicatorExit(0.2); // Fast exit animation
        console.log('✅ endgame-flow: Board indicator exit animation started');
      }
    } catch (indicatorError) {
      console.warn('⚠️ endgame-flow: Failed to hide board indicator (non-fatal):', indicatorError);
    }
    
    // 🔥 USER REQUEST: Show board transition screen before starting next board
    // This screen shows the board number with beautiful animations
    // 🔥 CRITICAL FIX: Show transition screen immediately without delay
    try {
      // Safety: cleanup stuck stars-to-HUD animations before transition (prevents frozen stars/HUD)
      try {
        const fxModule = await import('./fx.js');
        fxModule.forceCleanupAllStarAnimations?.();
      } catch {}
      try {
        const starsCollector = await import('./stars-collector.js');
        starsCollector.cleanupStarsCollector?.();
      } catch {}
      // Defensive: stop heavy FX before transition to reduce crash risk
      try {
        const bubbles = await import('./wild-juice-bubbles-explosion.js');
        bubbles.forceStopWildJuiceBubblesExplosion?.();
        await new Promise(resolve => requestAnimationFrame(resolve));
      } catch {}
      try {
        const tnt = await import('./tnt-animation.js');
        tnt.stopTntAnimation?.();
      } catch {}

      // 🔥 CRITICAL: Do NOT call memoryManager.performCleanup() or PIXI.utils.clearTextureCache
      // before transition. The stage (board, HUD) still references those textures. Destroying them
      // causes "TypeError: Cannot read properties of null (reading 'addressModeU')" when the
      // renderer binds a texture whose source was destroyed. Texture cleanup runs after the new
      // board is ready (triggerCleanBoardFlow in app-core) and via periodic memoryManager (30s).
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));

      // 🔥 CRITICAL FIX: Set board transition flag AFTER cleanup is guaranteed
      (window as any).__ccBoardTransitionActive = true;
      console.log('🎯 endgame-flow: Set __ccBoardTransitionActive flag to protect bubble explosion');
      
      // Log pre-transition stats (matches logBoardExitStats on Exit path)
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
      
      try { (await import('../utils/memory-spike-tracker.js')).sampleMemorySpike('2_before_show_transition'); } catch {}
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
          // 🔥 CRITICAL: Stop PIXI ticker FIRST (sync, before any await) to prevent "addressModeU" errors.
          // A frame can fire between awaits; renderer must not touch textures while we destroy them.
          try {
            const app = (window as any).CC?.app;
            if (app?.ticker) {
              app.ticker.stop();
              console.log('✅ endgame-flow: PIXI ticker stopped (first in onComplete)');
            }
          } catch {}
          const transitionEndTs = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
          console.log('⏱️ endgame-flow: Transition duration (ms)', Math.round(transitionEndTs - transitionStartTs));
          // 🔥 CRITICAL: Force-clean board transition screen before proceeding (belt-and-suspenders)
          try { cleanupBoardTransitionScreen?.(); } catch {}
          // 🔥 CRITICAL: Hide ghost placeholders immediately (sync, before any await)
          // Prevents one-frame blink when transition overlay is removed or before new board is ready
          try {
            if (typeof (window as any).hideGhostPlaceholders === 'function') {
              (window as any).hideGhostPlaceholders();
            }
          } catch {}
          // 🔥 CRITICAL FIX: Clear board transition flag after transition completes
          // Now safe to cleanup bubble explosion if needed
          (window as any).__ccBoardTransitionActive = false;
          console.log('✅ endgame-flow: Cleared __ccBoardTransitionActive flag - cleanup now allowed');
          try {
            const bubbles = await import('./wild-juice-bubbles-explosion.js');
            if (bubbles.isWildJuiceBubblesExplosionActive?.()) {
              bubbles.forceStopWildJuiceBubblesExplosion?.();
            }
          } catch {}
          // After transition screen completes, start the next board
          // 🔥 CRITICAL FIX: Hide app first to cleanup previous board before starting new one
          // This prevents blank screen with old board visible in background
          try {
            // 🔥 FIX: uiManager is a default export, not named export
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
          try { (await import('../utils/memory-spike-tracker.js')).sampleMemorySpike('5_after_hideApp'); } catch {}

          // (Ticker already stopped at start of onComplete to prevent addressModeU during cleanup)

          // 🔥 MEMORY SPIKE FIX: Destroy old tiles and run soft texture cleanup BEFORE booting new board.
          // This reduces peak memory (avoids old + new tiles + transition assets all in memory).
          try {
            (window as any).CC?.cleanupFxForBoardReset?.('endgame-flow');
            (window as any).CC?.softResetBoardView?.('endgame-flow');
            (window as any).CC?.destroyOldBoardForTransition?.('endgame-flow');
            try { (await import('../utils/memory-spike-tracker.js')).sampleMemorySpike('6_after_destroyOldBoard'); } catch {}
            // skipCacheClear=true to avoid addressModeU crash (renderer binding destroyed texture)
            (window as any).CC?.cleanupTexturesForBoardTransition?.('endgame-flow', false, true);
            try { (await import('../utils/memory-spike-tracker.js')).sampleMemorySpike('7_after_cleanupTextures'); } catch {}
            console.log('✅ endgame-flow: Old board destroyed, texture GC run');

            // 🔥 CRITICAL: Nuclear GSAP kill - prevents "Cannot set properties of null (setting 'y')" errors.
            // Orphaned tweens from board-transition-screen, journey-boards-manager, etc. animate destroyed objects.
            try {
              if (typeof (gsap as any).getAllTweens === 'function') {
                const allTweens = (gsap as any).getAllTweens();
                if (Array.isArray(allTweens)) {
                  allTweens.forEach((t: any) => { try { t?.kill?.(); } catch {} });
                  console.log('✅ endgame-flow: Killed', allTweens.length, 'GSAP tweens');
                }
              }
              gsap.killTweensOf('*');
              if (gsap.globalTimeline) gsap.globalTimeline.clear();
            } catch (gsapErr) {
              console.warn('⚠️ endgame-flow: GSAP nuclear kill failed (non-fatal):', gsapErr);
            }
          } catch (memErr) {
            console.warn('⚠️ endgame-flow: Pre-startLevel memory cleanup failed (non-fatal):', memErr);
          }

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
          try { (await import('../utils/memory-spike-tracker.js')).sampleMemorySpike('8_after_delay'); } catch {}

          // 🔥 CRITICAL: Restart PIXI ticker so boot/render can proceed
          try {
            const app = (window as any).CC?.app;
            if (app?.ticker && !app.ticker.started) {
              app.ticker.start();
              console.log('✅ endgame-flow: PIXI ticker started before boot');
            }
          } catch {}
          
          // 🔥 CRITICAL FIX: Wrap startLevel/startNewRunFromJourney in try-catch to prevent unhandled errors
          try {
            const ensureBoardVisibleAfterTransition = async () => {
              try {
                const uiManagerModule = await import('./ui-manager.js');
                const uiMgr = uiManagerModule.default;
                uiMgr?.showApp?.();
              } catch {}
              
              try {
                const app = (window as any).CC?.app;
                const stage = (window as any).CC?.stage;
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
            };

            // Centralized cleanup already done above (cleanupFx, softReset, destroyOld, texture cleanup)
            try { (await import('../utils/memory-spike-tracker.js')).sampleMemorySpike('9_before_startLevel'); } catch {}
            if (shouldUseJourneyStart) {
              // 🔥 INTERIM BOARD FIX: Use startNewRunFromJourney for proper initialization
              console.log(`🎮 endgame-flow: Calling startNewRunFromJourney(${nextLevel}) because we came from Journey/interim board`);
              if (typeof (window as any).startNewRunFromJourney === 'function') {
                await (window as any).startNewRunFromJourney(nextLevel);
                try { (await import('../utils/memory-spike-tracker.js')).sampleMemorySpike('10_after_startLevel'); } catch {}
                logger.info(`🎯 endgame-flow: startNewRunFromJourney completed for board ${nextLevel}`);
                // 🔥 CRITICAL: Await layoutBoard so HUD and board are ready before showing (prevents empty board/HUD)
                try {
                  const layoutBoardFn = (window as any).CC?.layoutBoard;
                  if (typeof layoutBoardFn === 'function') {
                    await layoutBoardFn();
                    console.log('✅ endgame-flow: layoutBoard completed before showApp');
                  }
                } catch (lbErr) { console.warn('⚠️ endgame-flow: layoutBoard await failed (non-fatal):', lbErr); }
                await ensureBoardVisibleAfterTransition();
                try { delete (window as any).__ccBoardJustCompleted; } catch {}
              } else {
                console.error('❌ endgame-flow: startNewRunFromJourney function not found, falling back to startLevel');
                try {
                  const uiManagerModule = await import('./ui-manager.js');
                  const uiMgr = uiManagerModule.default;
                  uiMgr?.showApp?.();
                } catch {}
                startLevel(nextLevel);
                try { (await import('../utils/memory-spike-tracker.js')).sampleMemorySpike('10_after_startLevel'); } catch {}
                try {
                  const layoutBoardFn = (window as any).CC?.layoutBoard;
                  if (typeof layoutBoardFn === 'function') { await layoutBoardFn(); }
                } catch {}
                await ensureBoardVisibleAfterTransition();
              }
            } else {
              // 🔥 REGULAR BOARD: Use startLevel for continuation
              console.log(`🎮 endgame-flow: Calling startLevel(${nextLevel}) for regular board continuation`);
              try {
                const uiManagerModule = await import('./ui-manager.js');
                const uiMgr = uiManagerModule.default;
                uiMgr?.showApp?.();
              } catch {}
              startLevel(nextLevel);
              try { (await import('../utils/memory-spike-tracker.js')).sampleMemorySpike('10_after_startLevel'); } catch {}
              logger.info(`🎯 endgame-flow: startLevel completed, should now be on Board ${nextLevel}`);
              // 🔥 CRITICAL: Await layoutBoard so HUD and board are ready before showing (prevents empty board/HUD)
              try {
                const layoutBoardFn = (window as any).CC?.layoutBoard;
                if (typeof layoutBoardFn === 'function') {
                  await layoutBoardFn();
                  console.log('✅ endgame-flow: layoutBoard completed before showApp');
                }
              } catch (lbErr) { console.warn('⚠️ endgame-flow: layoutBoard await failed (non-fatal):', lbErr); }
              await ensureBoardVisibleAfterTransition();
              try { delete (window as any).__ccBoardJustCompleted; } catch {}
            }
            try { (await import('../utils/memory-spike-tracker.js')).reportBiggestMemorySpike(); } catch {}

            // 🔥 RECOVERY: If board failed to appear after transition, retry once
            setTimeout(async () => {
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

                try {
                  const uiManagerModule = await import('./ui-manager.js');
                  const uiMgr = uiManagerModule.default;
                  uiMgr?.showApp?.();
                } catch {}

                if (shouldUseJourneyStart && typeof (window as any).startNewRunFromJourney === 'function') {
                  await (window as any).startNewRunFromJourney(nextLevel);
                } else if (typeof (window as any).startLevel === 'function') {
                  (window as any).startLevel(nextLevel);
                }
              } catch (recoveryError) {
                console.warn('⚠️ endgame-flow: Recovery attempt failed:', recoveryError);
              } finally {
                delete (window as any).__ccRecoverStartNewRunInProgress;
              }
            }, 600);
          } catch (startLevelError: any) {
            try { (await import('../utils/memory-spike-tracker.js')).reportBiggestMemorySpike(); } catch {}
            console.error('❌ endgame-flow: startLevel/startNewRunFromJourney failed:', startLevelError);
            logger.error('❌ endgame-flow: startLevel error:', String(startLevelError?.message || startLevelError));
            // 🔥 CRITICAL FIX: Clear board transition flag on error to prevent stuck state
            (window as any).__ccBoardTransitionActive = false;
            console.log('✅ endgame-flow: Cleared __ccBoardTransitionActive flag after error');
            // Don't rethrow - prevent unhandled error that could trigger reload
            // Instead, try to recover by waiting and retrying
            try {
              await new Promise(resolve => setTimeout(resolve, 500));
              if (shouldUseJourneyStart) {
                if (typeof (window as any).startNewRunFromJourney === 'function') {
                  await (window as any).startNewRunFromJourney(nextLevel);
                } else {
                  try {
                    const uiManagerModule = await import('./ui-manager.js');
                    const uiMgr = uiManagerModule.default;
                    uiMgr?.showApp?.();
                  } catch {}
                  startLevel(nextLevel);
                }
              } else {
                try {
                  const uiManagerModule = await import('./ui-manager.js');
                  const uiMgr = uiManagerModule.default;
                  uiMgr?.showApp?.();
                } catch {}
                startLevel(nextLevel);
              }
              logger.info('🎯 endgame-flow: startLevel retry completed');
            } catch (retryError: any) {
              console.error('❌ endgame-flow: startLevel retry also failed:', retryError);
              // Last resort: don't crash, just log - prevent unhandled error
            }
          }
        }
      });
    } catch (transitionError: any) {
      // If transition screen fails, fall back to direct board start
      console.warn('⚠️ endgame-flow: Board transition screen failed, starting board directly:', transitionError);
      logger.warn('⚠️ endgame-flow: Board transition screen failed, starting board directly:', transitionError);
      
      // 🔥 CRITICAL FIX: Wrap startLevel/startNewRunFromJourney in try-catch to prevent unhandled errors
      try {
        if (shouldUseJourneyStart) {
          // 🔥 INTERIM BOARD FIX: Use startNewRunFromJourney for proper initialization
          console.log(`🎮 endgame-flow: Calling startNewRunFromJourney(${nextLevel}) because we came from Journey/interim board`);
          if (typeof (window as any).startNewRunFromJourney === 'function') {
            await (window as any).startNewRunFromJourney(nextLevel);
            logger.info(`🎯 endgame-flow: startNewRunFromJourney completed for board ${nextLevel}`);
          } else {
            console.error('❌ endgame-flow: startNewRunFromJourney function not found, falling back to startLevel');
            try {
              const uiManagerModule = await import('./ui-manager.js');
              const uiMgr = uiManagerModule.default;
              uiMgr?.showApp?.();
            } catch {}
            startLevel(nextLevel);
          }
        } else {
          // 🔥 REGULAR BOARD: Use startLevel for continuation
          console.log(`🎮 endgame-flow: Calling startLevel(${nextLevel}) for regular board continuation`);
          try {
            const uiManagerModule = await import('./ui-manager.js');
            const uiMgr = uiManagerModule.default;
            uiMgr?.showApp?.();
          } catch {}
          startLevel(nextLevel);
          logger.info(`🎯 endgame-flow: startLevel completed, should now be on Board ${nextLevel}`);
        }
      } catch (startLevelError: any) {
        console.error('❌ endgame-flow: startLevel/startNewRunFromJourney failed:', startLevelError);
        logger.error('❌ endgame-flow: startLevel error:', String(startLevelError?.message || startLevelError));
        // Don't rethrow - prevent unhandled error that could trigger reload
        // Instead, try to recover by waiting and retrying
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          if (shouldUseJourneyStart) {
            if (typeof (window as any).startNewRunFromJourney === 'function') {
              await (window as any).startNewRunFromJourney(nextLevel);
            } else {
              try {
                const uiManagerModule = await import('./ui-manager.js');
                const uiMgr = uiManagerModule.default;
                uiMgr?.showApp?.();
              } catch {}
              startLevel(nextLevel);
            }
          } else {
            try {
              const uiManagerModule = await import('./ui-manager.js');
              const uiMgr = uiManagerModule.default;
              uiMgr?.showApp?.();
            } catch {}
            startLevel(nextLevel);
          }
          logger.info('🎯 endgame-flow: startLevel retry completed');
        } catch (retryError: any) {
          console.error('❌ endgame-flow: startLevel retry also failed:', retryError);
          // Last resort: don't crash, just log - prevent unhandled error
        }
      }
    }
    
    // Clear preserved score flag after starting
    delete (window as any).__ccPreserveScore;
  } catch (error) {
    // 🔥 FIX: Catch any errors and ensure flag is cleared
    console.error('❌ runEndgameFlow error:', error);
    throw error; // Re-throw to propagate
  } finally {
    // vrati stanje
    try { if (boardBG) boardBG.visible = prevBG; } catch {}
    try { showGrid?.(); } catch {}
    stage.eventMode = prevMode;
    // Clear flag - 🔥 FIX: This ALWAYS runs now, even on error
    (window as any).CC._endgameFlowRunning = false;
  }
}
