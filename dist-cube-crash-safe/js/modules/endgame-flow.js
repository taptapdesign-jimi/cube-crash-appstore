// public/src/modules/endgame-flow.js
// Orkestracija: CLEAN → PRIZE → STARS → NEXT
// Minimalno diramo app.js – ovdje je cijela "reda vožnje".

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
    // 1) CLEAN BOARD (mora resolve-ati nakon fadeout + remove layera)
    const { showCleanBoardCelebration } =
      await importFresh('./center-celebration.js');
    await showCleanBoardCelebration({
      ...ctx,
      // osiguraj konzistentno ime layera
      LAYER_NAME: 'cc-center-celebration-layer',
    });

    // 2) Mystery prize (crate→tap→coin→collect→let-to-corner→cleanup)
    const { showMysteryPrize } = await importFresh('./mystery-prize.js');
    await showMysteryPrize({ ...ctx });

    // 3) Stars modal → NEXT
    const { showStarsModal } = await importFresh('./stars-modal.js');
    const next = (level | 0) + 1;                 // snapshot da nema async drifta
    const res = await showStarsModal({ app, stage, board, score: ctx.score });
    if (!res || res.action === 'continue') startLevel(next);
  } finally {
    // vrati stanje
    try { if (boardBG) boardBG.visible = prevBG; } catch {}
    try { showGrid?.(); } catch {}
    stage.eventMode = prevMode;
  }
}