import { logger } from '../core/logger.js';
// public/src/modules/endgame-flow.ts
// Orkestracija (simplified): STARS → NEXT
// Privremeno maknuto: Clean Board i Mystery Prize.

// Import cleanup function from clean-board-modal (will be imported lazily)

// Type definitions
interface EndgameContext {
  app: any;
  stage: {
    eventMode: string;
  };
  board: any;
  boardBG?: {
    visible?: boolean;
  };
  level: number;
  startLevel: (level: number) => void;
  hideGrid?: () => void;
  showGrid?: () => void;
  boardNumber?: number;
  getScore?: () => number;
  setScore?: (score: number) => void;
  animateScore?: (score: number, duration: number) => void;
  updateHUD?: () => void;
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
    boardNumber = 1,
  } = ctx;

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

    // 🔥 CRITICAL FIX: Cleanup bubbles animaciju PRIJE clean board flow-a
    // This prevents conflicts with stage/board objects during clean board flow
    try {
      const fxModule = await import('./fx.js');
      if (fxModule && typeof fxModule.isWildBeerExplosionRunning === 'function' && 
          typeof fxModule.cleanupWildBeerExplosion === 'function') {
        if (fxModule.isWildBeerExplosionRunning()) {
          console.log('🧹 endgame-flow: Bubbles animation detected - cleaning up before clean board flow');
          fxModule.cleanupWildBeerExplosion();
          console.log('✅ endgame-flow: Bubbles animation cleaned up');
        }
      }
    } catch (e) {
      console.warn('⚠️ endgame-flow: Failed to cleanup bubbles animation:', e);
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
    const nextLevel = (level | 0) + 1;
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
    
    await showCleanBoardModal({ 
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
      scoreCap: 999999,
      boardNumber,
    });
    
    // CRITICAL: Wait for clean board modal to close (user clicked Continue)
    // Only then start the next board
    // Get final score AFTER modal has updated it (modal adds bonus and sets final score)
    const finalScore = ctx.getScore ? ctx.getScore() : 0;
    logger.info(`🎯 endgame-flow: current level: ${level}, next level: ${nextLevel}, final score: ${finalScore}`);
    
    // Preserve final score before starting next board
    (window as any).__ccPreserveScore = finalScore;
    console.log('💾 endgame-flow: Preserving final score for next board:', finalScore);
    
    // 🔥 CRITICAL FIX: Save game state AFTER clean board modal closes and score is finalized
    // This ensures the final score (with bonus) is saved before starting next board
    try {
      const saveGameState = (window as any).saveGameState;
      if (typeof saveGameState === 'function') {
        saveGameState();
        console.log('💾 endgame-flow: Game state saved after clean board flow (final score:', finalScore, ')');
      } else {
        console.warn('⚠️ endgame-flow: saveGameState function not found');
      }
    } catch (error) {
      console.warn('⚠️ endgame-flow: Failed to save game state after clean board flow:', error);
    }
    
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
    console.log('✅ endgame-flow: Cleared __ccSkipRebuildBoard flag - board will be rebuilt for next level');
    
    // 🔥 CRITICAL FIX: Wrap startLevel in try-catch to prevent unhandled errors
    try {
      startLevel(nextLevel);
      logger.info(`🎯 endgame-flow: startLevel completed, should now be on Board ${nextLevel}`);
    } catch (startLevelError: any) {
      console.error('❌ endgame-flow: startLevel failed:', startLevelError);
      logger.error('❌ endgame-flow: startLevel error:', String(startLevelError?.message || startLevelError));
      // Don't rethrow - prevent unhandled error that could trigger reload
      // Instead, try to recover by waiting and retrying
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        startLevel(nextLevel);
        logger.info('🎯 endgame-flow: startLevel retry completed');
      } catch (retryError: any) {
        console.error('❌ endgame-flow: startLevel retry also failed:', retryError);
        // Last resort: don't crash, just log - prevent unhandled error
      }
    }
    
    // Clear preserved score flag after starting
    delete (window as any).__ccPreserveScore;
  } finally {
    // vrati stanje
    try { if (boardBG) boardBG.visible = prevBG; } catch {}
    try { showGrid?.(); } catch {}
    stage.eventMode = prevMode;
    // Clear flag
    (window as any).CC._endgameFlowRunning = false;
  }
}
