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

  test('flushes the Journey result in the first owned post-paint task before score presentation begins', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/clean-board-modal.ts'), 'utf8');
    const postPaintRuntime = source.slice(
      source.indexOf('const startPostPaintResultRuntime = () => {'),
      source.indexOf('document.body.appendChild(el);'),
    );

    expect(postPaintRuntime).toContain("runtimePerformance.phase('result-persist', () => {");
    expect(postPaintRuntime).toContain('if (isArcadeHomeRun) {');
    expect(postPaintRuntime).toContain('boardStatsService.updateBoardHighScore(boardNumber, finalScore);');
    expect(postPaintRuntime).toContain("boardStatsService.flushStatsNow('clean-board-visible');");
    expect(postPaintRuntime.indexOf('boardStatsService.updateBoardHighScore(boardNumber, finalScore);'))
      .toBeLessThan(postPaintRuntime.indexOf("boardStatsService.flushStatsNow('clean-board-visible');"));
    expect(postPaintRuntime.indexOf("boardStatsService.flushStatsNow('clean-board-visible');"))
      .toBeLessThan(postPaintRuntime.indexOf('statsService.updateHighScore(finalScore);'));
    expect(source.indexOf('document.body.appendChild(el);'))
      .toBeLessThan(source.indexOf('trackTimeout(startPostPaintResultRuntime, 0);'));
    expect(source.indexOf('trackTimeout(startPostPaintResultRuntime, 0);'))
      .toBeLessThan(source.indexOf('trackTimeout(() => {', source.indexOf('// SEQUENCE 1:')));
  });
});
