// public/src/modules/endgame-flow.js
// Orkestracija (simplified): STARS → NEXT
// Privremeno maknuto: Clean Board i Mystery Prize.

export const importFresh = (p) =>
  import(`${p}?bust=${Date.now()}&r=${Math.random()}`);

export async function runEndgameFlow(ctx) {
  const {
    app, stage, board, boardBG,
    level, startLevel,
    hideGrid, showGrid,
  } = ctx;

  // lock interakcije tijekom kraja levela
  const prevMode = stage.eventMode;
  stage.eventMode = 'none';

  // sakrij grid/ghostove dok traje flow
  const prevBG = boardBG?.visible !== false;
  try { hideGrid?.(); } catch {}

  try {
    // Clean Board modal (bonus +500) → immediately start next level on Continue
    const { showCleanBoardModal } = await importFresh('./clean-board-modal.js');
    await showCleanBoardModal({ 
      app, stage,
      getScore: ctx.getScore,
      setScore: ctx.setScore,
      animateScore: ctx.animateScore,
      updateHUD: ctx.updateHUD,
      bonus: 500,
      scoreCap: 999999
    });
    const next = (level | 0) + 1;
    const currentScore = ctx.getScore ? ctx.getScore() : 'unknown';
    console.log('🎯 endgame-flow: current level:', level, 'next level:', next, 'current score:', currentScore);
    console.log('🎯 endgame-flow: About to call startLevel with preserved score...');
    startLevel(next);
    console.log('🎯 endgame-flow: startLevel completed, should now be on Board', next);
  } finally {
    // vrati stanje
    try { if (boardBG) boardBG.visible = prevBG; } catch {}
    try { showGrid?.(); } catch {}
    stage.eventMode = prevMode;
  }
}
