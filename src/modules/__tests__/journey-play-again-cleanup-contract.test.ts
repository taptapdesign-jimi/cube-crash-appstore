import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const endgameSource = fs.readFileSync(path.join(root, 'src/modules/endgame-flow.ts'), 'utf8');
const appCoreSource = fs.readFileSync(path.join(root, 'src/modules/app-core.ts'), 'utf8');

describe('Journey Play Again cleanup ownership', () => {
  test('destroys the detached old board before booting the replacement run', () => {
    const playAgainSource = endgameSource.split(
      'async function handleCleanBoardPlayAgain(ctx: EndgameContext, boardNumber: number): Promise<void>',
    )[1]?.split('async function handleJourneyCleanBoardExit')[0] ?? '';
    const softResetIndex = playAgainSource.indexOf("softResetBoardView?.('endgame-play-again')");
    const destroyIndex = playAgainSource.indexOf(
      "destroyOldBoardForTransition?.('endgame-play-again')",
    );
    const restartIndex = playAgainSource.indexOf(
      'await (window as any).startNewRunFromJourney(boardNumber)',
    );

    expect(softResetIndex).toBeGreaterThanOrEqual(0);
    expect(destroyIndex).toBeGreaterThan(softResetIndex);
    expect(restartIndex).toBeGreaterThan(destroyIndex);
    expect(playAgainSource).toContain(
      "emitIOSNativeDiagnostic('journey-play-again-old-board-destroyed'",
    );
  });

  test('force-cleans protected Star FX only for a Play Again hard restart', () => {
    const cleanupSource = appCoreSource.split(
      "function cleanupFxForBoardReset(reason: string = 'unknown')",
    )[1]?.split('/**\n * 🔥 MEMORY SPIKE FIX: Destroy old board tiles')[0] ?? '';

    expect(cleanupSource).toContain("const isPlayAgainCleanup = reason.includes('play-again')");
    expect(cleanupSource).toContain('if (isPlayAgainCleanup)');
    expect(cleanupSource).toContain('forceCleanupAllStarAnimations?.()');
    expect(cleanupSource).toContain('cleanupExistingStarAnimations?.()');
  });
});
