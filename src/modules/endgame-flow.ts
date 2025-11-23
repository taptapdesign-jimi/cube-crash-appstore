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

    const { showCleanBoardModal } = await import('./clean-board-modal.js');
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
          if (window.PIXI && window.PIXI.utils && window.PIXI.utils.destroyTextureCache) {
            window.PIXI.utils.destroyTextureCache();
          }
          // Force garbage collection if available
          if (window.gc) {
            window.gc();
          }
        } catch {}
      }
      
      console.log(`✅ endgame-flow: ${isVeryLongSession ? 'VERY AGGRESSIVE' : isLongGameSession ? 'AGGRESSIVE' : 'Standard'} cleanup completed`);
    } catch (cleanupError) {
      console.warn('⚠️ endgame-flow: Cleanup error (non-fatal):', cleanupError);
    }
    
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
