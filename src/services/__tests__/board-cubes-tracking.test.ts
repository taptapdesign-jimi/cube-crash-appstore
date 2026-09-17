import fs from 'node:fs';
import path from 'node:path';
import { trackBoardCubesCracked } from '../board-cubes-tracking.js';
import { boardStatsService } from '../board-stats-service.js';

beforeEach(() => {
  (window as any).__ccFirstPlayTutorialActive = false;
  (window as any).__ccFirstPlayTutorialSlowWildMeter = false;
  (window as any).__ccSuppressTutorialStatsSave = false;
});

test('board and tutorial eligibility are captured before deferred service load', async () => {
  const add = jest.spyOn(boardStatsService, 'addBoardCubesCracked').mockReturnValue(1);
  const pending = trackBoardCubesCracked(7, 1);
  (window as any).STATE = { boardNumber: 9 };
  (window as any).__ccFirstPlayTutorialActive = true;
  await pending;
  expect(add).toHaveBeenCalledWith(7, 1);
  await trackBoardCubesCracked(9, 1);
  expect(add).toHaveBeenCalledTimes(1);
});

test.each([false, true])('actual normal and Magnet accounting segments count once (Arcade=%s)', (arcade) => {
  const core = fs.readFileSync(path.join(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
  const merge = fs.readFileSync(path.join(process.cwd(), 'src/modules/app-merge.ts'), 'utf8');
  const normalStart = core.indexOf('          // Stats: count merge-6 as "cubes cracked"');
  const normal = core.slice(normalStart, core.indexOf('\n        }', normalStart));
  const pulledStart = merge.indexOf('  // Stats - track cubes cracked for magnet pull merge');
  const pulled = merge.slice(pulledStart, merge.indexOf("  console.log('✅ mergePulledTilesIntoMerge6", pulledStart));
  for (const segment of [normal, pulled]) {
    const stats = { incrementCubesCracked: jest.fn(), incrementHelpersUsed: jest.fn() };
    const arcadeStats = { addCubesCracked: jest.fn() };
    const board = jest.fn();
    new Function('statsService', 'arcadeStatsService', 'isArcadeHomeRunMode', 'trackBoardCubesCracked', 'boardNumber', 'STATE', segment)(
      stats, arcadeStats, () => arcade, board, 7, { boardNumber: 7 },
    );
    expect(stats.incrementCubesCracked).toHaveBeenCalledTimes(1);
    expect(board).toHaveBeenCalledTimes(1);
    expect(board).toHaveBeenCalledWith(7, 1);
    expect(arcadeStats.addCubesCracked).toHaveBeenCalledTimes(arcade ? 1 : 0);
  }
});
