import fs from 'node:fs';
import path from 'node:path';

describe('Journey DEV Hide/Show card refresh', () => {
  test('consumes the saved dirty marker before prepared Journey DOM can skip rendering', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/collectibles-manager.ts'),
      'utf8',
    );
    const showStart = source.indexOf('async showCollectibles(');
    const showEnd = source.indexOf('\n  async hideCollectibles', showStart);
    const showSource = source.slice(showStart, showEnd);
    const consumeIndex = showSource.indexOf('journeyBoardsManager.consumeJourneyDevBoardRefresh()');
    const preparedIndex = showSource.indexOf('isJourneyViewStructurallyPrepared(journeyContainer)');
    const forcedRenderIndex = showSource.indexOf('if (devBoardRefreshRequired)');

    expect(consumeIndex).toBeGreaterThan(0);
    expect(preparedIndex).toBeGreaterThan(consumeIndex);
    expect(forcedRenderIndex).toBeGreaterThan(preparedIndex);
    expect(showSource).toContain('journeyBoardsManager.renderBoards();');
    expect(showSource).toContain('journeyBoardsManager.updateCounter();');
  });

  test('keeps Hide/Show mutations marked and production progression reconciliation intact', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'),
      'utf8',
    );

    expect(source).toContain('this.markJourneyDevBoardRefresh(`unlock board ${boardNumber}`)');
    expect(source).toContain('this.markJourneyDevBoardRefresh(`lock board ${boardNumber}`)');
    expect(source).toContain('this.ensureWorldInterimCards();');
  });
});
