// @ts-nocheck
import { logger } from '../core/logger.js';
import { gsap } from 'gsap';
// public/src/modules/endgame-flow.ts
// Orkestracija (simplified): STARS → NEXT
// Privremeno maknuto: Clean Board i Mystery Prize.

// Import cleanup function from clean-board-modal (will be imported lazily)

// Type definitions
interface EndgameContext {
  app: any;
  stage: { eventMode: string };
  board: any;
  boardBG?: { visible?: boolean };
  level: number;
  startLevel: (level: number) => void;
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
  // 🔥 USER BUG FIX: Don't run endgame flow if game is hidden (user is on homepage/other screens)
  // This prevents clean board modal from appearing when user navigates away from game
  const appElement = document.getElementById('app');
  const homeElement = document.getElementById('home');
  const isGameHidden = appElement && appElement.hasAttribute('hidden');
  const isHomepageVisible = homeElement && !homeElement.hidden;
  
  if (isGameHidden || isHomepageVisible) {
    console.log('⏳ runEndgameFlow skipped - game is hidden or homepage is visible (user navigated away from game)');
    return;
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
    
    // 🔥 NEW: Calculate comboBonus and efficiencyBonus (SAME as dev clean board logic)
    // This ensures consistent bonus animation timing between dev and real clean boards
    const comboBonus = Math.floor(bonus * 0.5); // 50% for combo
    const efficiencyBonus = bonus - comboBonus; // 50% for efficiency

    // 🔥 ENDGAME ANIMATION-WAIT: Wait for stars + bubbles before clean board; skip stars when regular/magnet (none run)
    // 🔥 CLEAN BOARD DELAY FIX: 4s max (was 5.5s/6s). Bubbles safety timeout 4.4s + early resolve when done.
    // 🔥 CLEAN BOARD TOO EARLY FIX: Bubbles/stars start via setTimeout(200ms). runEndgameFlow can be triggered
    // immediately from merge-6; if we poll before 200ms, we see "not running" → resolve → modal blocks animations.
    // When we expect stars/bubbles (!skipStarsWait), wait 350ms first so they have time to start, then poll.
    try {
      const fxModule = await import('./fx.js');
      const maxWaitMs = 4000;
      if (skipStarsWait && typeof fxModule.waitForBubblesAnimationToComplete === 'function') {
        await fxModule.waitForBubblesAnimationToComplete(maxWaitMs);
      } else {
        if (fxModule && typeof fxModule.waitForOngoingAnimations === 'function') {
          await new Promise((r) => setTimeout(r, 350)); // let bubbles/stars start (200ms) + buffer
          await fxModule.waitForOngoingAnimations(maxWaitMs);
        }
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
      comboBonus, // 🔥 NEW: Explicit combo bonus for consistent animations
      efficiencyBonus, // 🔥 NEW: Explicit efficiency bonus for consistent animations
      scoreCap: 999999,
      boardNumber,
    });
    
    console.log(`🎯 endgame-flow: Clean board modal closed with action: ${modalResult?.action}`);
    logger.info(`🎯 endgame-flow: Clean board modal result: ${modalResult?.action}`);
    
    // 🔥 NEW LOGIC: Handle different actions from clean board modal
    if (modalResult?.action === 'exit') {
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
        if (typeof (window as any).startNewRunFromJourney === 'function') {
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
    
    try {
      console.log(`🧹 endgame-flow: Performing ${isVeryLongSession ? 'VERY AGGRESSIVE' : isLongGameSession ? 'AGGRESSIVE' : 'standard'} cleanup before startLevel (Board ${nextLevel})...`);
      
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
      
      // Kill all delayed calls and graphics objects
      if (typeof (window as any).killAllDelayedCalls === 'function') {
        (window as any).killAllDelayedCalls();
      }
      if (typeof (window as any).destroyAllGraphicsObjects === 'function') {
        (window as any).destroyAllGraphicsObjects();
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
      
      // 🔥 CRITICAL FIX: Cleanup bubbles animation again (in case it was restarted)
      try {
        const fxModule = await import('./fx.js');
        if (fxModule && typeof fxModule.cleanupWildBeerExplosion === 'function') {
          if (fxModule.isWildBeerExplosionRunning && fxModule.isWildBeerExplosionRunning()) {
            fxModule.cleanupWildBeerExplosion();
            console.log('🧹 endgame-flow: Cleaned up bubbles animation in cleanup section');
          }
        }
      } catch (e) {
        console.warn('⚠️ endgame-flow: Failed to cleanup bubbles animation in cleanup section:', e);
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
      
      // 🔥 LONG-TERM: Additional cleanup for very long sessions (board 20+)
      if (isVeryLongSession) {
        console.log('🔥 VERY LONG SESSION: Performing extra cleanup for board', nextLevel);
        try {
          // Clear PIXI texture cache
          if (window.PIXI && window.PIXI.utils) {
            if (typeof window.PIXI.utils.destroyTextureCache === 'function') {
              window.PIXI.utils.destroyTextureCache();
            } else if (typeof window.PIXI.utils.clearTextureCache === 'function') {
              window.PIXI.utils.clearTextureCache();
            }
            
            // 🔥 CRITICAL FIX: Force clear ALL base textures for very long sessions
            const baseTextureCache = (window.PIXI.utils as any).BaseTextureCache;
            if (baseTextureCache) {
              Object.keys(baseTextureCache).forEach((key: string) => {
                try {
                  const baseTexture = baseTextureCache[key];
                  if (baseTexture && typeof baseTexture.destroy === 'function') {
                    baseTexture.destroy();
                  }
                  delete baseTextureCache[key];
                } catch (e) {
                  console.warn('⚠️ Failed to destroy base texture:', key, e);
                }
              });
              console.log('✅ All base textures cleared for very long session');
            }
          }
          
          // 🔥 CRITICAL FIX: Force clear all GSAP timelines for very long sessions
          try {
            gsap.globalTimeline.clear();
            console.log('✅ All GSAP timelines cleared for very long session');
          } catch (e) {
            console.warn('⚠️ Failed to clear GSAP timelines:', e);
          }
          
          // Force garbage collection if available
          if (window.gc) {
            window.gc();
            console.log('✅ Garbage collection forced');
          }
        } catch (e) {
          console.warn('⚠️ Very long session cleanup error:', e);
        }
      }
      
      // 🔥 LONG-TERM: Aggressive cleanup for board 10+ (not just 20+)
      if (isLongGameSession) {
        console.log('🔥 LONG SESSION: Performing aggressive cleanup for board', nextLevel);
        try {
          // Clear PIXI texture cache more aggressively
          if (window.PIXI && window.PIXI.utils) {
            if (typeof window.PIXI.utils.clearTextureCache === 'function') {
              window.PIXI.utils.clearTextureCache();
            } else if (typeof window.PIXI.utils.destroyTextureCache === 'function') {
              window.PIXI.utils.destroyTextureCache();
            }
            
            // Clear unused base textures
            const baseTextureCache = (window.PIXI.utils as any).BaseTextureCache;
            if (baseTextureCache) {
              const toRemove: string[] = [];
              for (const [key, baseTexture] of Object.entries(baseTextureCache)) {
                try {
                  const bt = baseTexture as any;
                  if (bt && (!bt.textureCacheIds || bt.textureCacheIds.length === 0)) {
                    if (typeof bt.destroy === 'function') {
                      bt.destroy();
                    }
                    toRemove.push(key as string);
                  }
                } catch (e) {
                  // Ignore errors
                }
              }
              toRemove.forEach(key => {
                try {
                  delete baseTextureCache[key];
                } catch (e) {
                  // Ignore errors
                }
              });
              if (toRemove.length > 0) {
                console.log(`✅ Cleared ${toRemove.length} unused base textures for long session`);
              }
            }
          }
        } catch (e) {
          console.warn('⚠️ Long session cleanup error:', e);
        }
      }
      
      console.log(`✅ endgame-flow: ${isVeryLongSession ? 'VERY AGGRESSIVE' : isLongGameSession ? 'AGGRESSIVE' : 'Standard'} cleanup completed`);
    } catch (cleanupError) {
      console.warn('⚠️ endgame-flow: Cleanup error (non-fatal):', cleanupError);
    }
    
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
    
    console.log(`🎯 endgame-flow: Continue action detected - cameFromJourney: ${cameFromJourney}, isInterimBoard: ${isInterimBoard}`);
    
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
      const { showBoardTransitionScreen } = await import('./board-transition-screen.js');
      // 🔥 CRITICAL FIX: Use nextLevel for transition screen (next board, not current)
      // nextLevel is calculated from boardNumber + 1, which is the correct next board
      // This ensures correct board number is shown when coming from interim board
      console.log(`🎯 endgame-flow: Showing transition screen for board ${nextLevel} (current boardNumber: ${boardNumber}, nextLevel: ${nextLevel})`);
      await showBoardTransitionScreen({
        boardNumber: nextLevel,
        onComplete: async () => {
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
          
          // 🔥 CRITICAL FIX: Wrap startLevel/startNewRunFromJourney in try-catch to prevent unhandled errors
          try {
            if (cameFromJourney || isInterimBoard) {
              // 🔥 INTERIM BOARD FIX: Use startNewRunFromJourney for proper initialization
              console.log(`🎮 endgame-flow: Calling startNewRunFromJourney(${nextLevel}) because we came from Journey/interim board`);
              if (typeof (window as any).startNewRunFromJourney === 'function') {
                await (window as any).startNewRunFromJourney(nextLevel);
                logger.info(`🎯 endgame-flow: startNewRunFromJourney completed for board ${nextLevel}`);
              } else {
                console.error('❌ endgame-flow: startNewRunFromJourney function not found, falling back to startLevel');
                startLevel(nextLevel);
              }
            } else {
              // 🔥 REGULAR BOARD: Use startLevel for continuation
              console.log(`🎮 endgame-flow: Calling startLevel(${nextLevel}) for regular board continuation`);
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
              if (cameFromJourney || isInterimBoard) {
                if (typeof (window as any).startNewRunFromJourney === 'function') {
                  await (window as any).startNewRunFromJourney(nextLevel);
                } else {
                  startLevel(nextLevel);
                }
              } else {
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
        if (cameFromJourney || isInterimBoard) {
          // 🔥 INTERIM BOARD FIX: Use startNewRunFromJourney for proper initialization
          console.log(`🎮 endgame-flow: Calling startNewRunFromJourney(${nextLevel}) because we came from Journey/interim board`);
          if (typeof (window as any).startNewRunFromJourney === 'function') {
            await (window as any).startNewRunFromJourney(nextLevel);
            logger.info(`🎯 endgame-flow: startNewRunFromJourney completed for board ${nextLevel}`);
          } else {
            console.error('❌ endgame-flow: startNewRunFromJourney function not found, falling back to startLevel');
            startLevel(nextLevel);
          }
        } else {
          // 🔥 REGULAR BOARD: Use startLevel for continuation
          console.log(`🎮 endgame-flow: Calling startLevel(${nextLevel}) for regular board continuation`);
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
          if (cameFromJourney || isInterimBoard) {
            if (typeof (window as any).startNewRunFromJourney === 'function') {
              await (window as any).startNewRunFromJourney(nextLevel);
            } else {
              startLevel(nextLevel);
            }
          } else {
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
