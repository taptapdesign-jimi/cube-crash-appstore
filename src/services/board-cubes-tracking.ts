/** Board identity is captured by the gameplay owner before the lazy service import. */
export async function trackBoardCubesCracked(boardNumber: number, count = 1): Promise<void> {
  if ((window as any).__ccFirstPlayTutorialActive === true ||
      (window as any).__ccFirstPlayTutorialSlowWildMeter === true ||
      (window as any).__ccSuppressTutorialStatsSave === true) return;
  try {
    const { boardStatsService } = await import('./board-stats-service.js');
    boardStatsService.addBoardCubesCracked(boardNumber, count);
  } catch (error) {
    console.warn('⚠️ Failed to track board-specific cubes cracked:', error);
  }
}
