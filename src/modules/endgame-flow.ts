import { logger } from '../core/logger.js';
// public/src/modules/endgame-flow.ts
// Orkestracija (simplified): STARS → NEXT
// Privremeno maknuto: Clean Board i Mystery Prize.

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
    await showCleanBoardModal({ 
      app, stage,
      getScore: ctx.getScore,
      setScore: ctx.setScore,
      animateScore: ctx.animateScore,
      updateHUD: ctx.updateHUD,
      bonus,
      scoreCap: 999999,
      boardNumber,
    });
    const next = (level | 0) + 1;
    const currentScore = ctx.getScore ? ctx.getScore() : 'unknown';
    logger.info('🎯 endgame-flow: current level:', level, 'next level:', next, 'current score:', currentScore);
    logger.info('🎯 endgame-flow: About to call startLevel with preserved score...');
    startLevel(next);
    logger.info('🎯 endgame-flow: startLevel completed, should now be on Board', next);
  } finally {
    // vrati stanje
    try { if (boardBG) boardBG.visible = prevBG; } catch {}
    try { showGrid?.(); } catch {}
    stage.eventMode = prevMode;
    // Clear flag
    (window as any).CC._endgameFlowRunning = false;
  }
}

