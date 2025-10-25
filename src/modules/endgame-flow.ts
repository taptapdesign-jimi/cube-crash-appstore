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

export const importFresh = (p: string): Promise<any> =>
  import(/* @vite-ignore */ `${p}?bust=${Date.now()}&r=${Math.random()}`);

export async function runEndgameFlow(ctx: EndgameContext): Promise<void> {
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
    // Clean Board modal (bonus +500) → immediately start next level on Continue
    const effectiveBoard = Math.max(1, boardNumber | 0);
    const bonus = Math.max(500, effectiveBoard * 500);

    const { showCleanBoardModal } = await importFresh('./clean-board-modal.js');
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
  }
}

