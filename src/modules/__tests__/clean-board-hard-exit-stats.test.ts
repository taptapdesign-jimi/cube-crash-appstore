import fs from 'node:fs';
import path from 'node:path';
import { BoardStatsService } from '../../services/board-stats-service';

const repoRoot = path.resolve(__dirname, '../../..');

describe('Clean Board immediate hard-exit stats', () => {
  afterEach(() => localStorage.removeItem('cc_board_stats_v1'));

  test('persists the final Unit score before its debounce and restores it after a new boot', () => {
    localStorage.removeItem('cc_board_stats_v1');
    const active = new BoardStatsService();

    active.updateBoardHighScore(1, 19293);
    expect(localStorage.getItem('cc_board_stats_v1')).toBeNull();

    active.flushStatsNow('clean-board-visible');
    expect(JSON.parse(localStorage.getItem('cc_board_stats_v1') || '{}')[1].highScore)
      .toBe(19293);

    const restarted = new BoardStatsService();
    expect(restarted.getBoardStats(1).highScore).toBe(19293);
  });

  test('flushes the Journey result at visible Clean Board before score presentation begins', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/clean-board-modal.ts'), 'utf8');
    const mount = source.slice(
      source.indexOf('// 🔥 HARD EXIT FIX: Update board high score IMMEDIATELY'),
      source.indexOf('// Score bookkeeping', source.indexOf('// 🔥 HARD EXIT FIX:')),
    );

    expect(mount).toContain('if (isArcadeHomeRun) {');
    expect(mount).toContain('boardStatsService.updateBoardHighScore(boardNumber, finalScore);');
    expect(mount).toContain("boardStatsService.flushStatsNow('clean-board-visible');");
    expect(mount.indexOf('boardStatsService.updateBoardHighScore(boardNumber, finalScore);'))
      .toBeLessThan(mount.indexOf("boardStatsService.flushStatsNow('clean-board-visible');"));
    expect(mount.indexOf("boardStatsService.flushStatsNow('clean-board-visible');"))
      .toBeLessThan(mount.indexOf('statsService.updateHighScore(finalScore);'));
  });
});
