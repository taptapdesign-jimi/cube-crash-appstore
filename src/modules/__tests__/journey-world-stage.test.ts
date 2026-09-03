import {
  formatJourneyWorldStageNumber,
  getJourneyWorldCardPresentation,
  getJourneyWorldStageNumber,
  reconcileJourneyWorldInterims,
} from '../journey-world-stage';
import fs from 'node:fs';
import path from 'node:path';

describe('Journey World-local Stage progression', () => {
  test.each([
    [1, 1, '01'],
    [10, 10, '10'],
    [11, 1, '01'],
    [20, 10, '10'],
    [21, 1, '01'],
    [30, 10, '10'],
  ])('maps global board %i to local Stage %i (%s)', (boardId, localStage, label) => {
    expect(getJourneyWorldStageNumber(boardId)).toBe(localStage);
    expect(formatJourneyWorldStageNumber(boardId)).toBe(label);
  });

  test('Board Transition displays the World-local Stage while retaining the global board id', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../board-transition-screen.ts'),
      'utf8',
    );
    expect(source).toContain('beginBoardLifecycleTrace(\'board-transition\', boardNumber)');
    expect(source).toContain('formatJourneyWorldStageNumber(boardNumber)');
    expect(source).not.toContain(": boardNumber.toString().padStart(2, '0')");
  });

  test('starts an empty Forest, Beach and Area 55 at their first interim card', () => {
    const boards = Array.from({ length: 30 }, (_, index) => ({
      id: index + 1,
      unlocked: false,
      interim: false,
    }));

    expect(reconcileJourneyWorldInterims(boards)).toEqual([1, 11, 21]);
    expect(boards.filter((board) => board.interim).map((board) => board.id)).toEqual([1, 11, 21]);
  });

  test('advances each World independently and leaves a completed World without interim', () => {
    const boards = Array.from({ length: 30 }, (_, index) => ({
      id: index + 1,
      unlocked: index < 12,
      interim: index === 7,
    }));

    expect(reconcileJourneyWorldInterims(boards)).toEqual([13, 21]);
    expect(boards.filter((board) => board.interim).map((board) => board.id)).toEqual([13, 21]);
  });

  test('completed state wins over a stale interim marker when choosing card presentation', () => {
    expect(getJourneyWorldCardPresentation({ unlocked: true, interim: true })).toBe('unlocked');
    expect(getJourneyWorldCardPresentation({ unlocked: false, interim: true })).toBe('interim');
    expect(getJourneyWorldCardPresentation({ unlocked: false, interim: false })).toBe('locked');
  });

  test('reconciles preserved World card Units before priming the gameplay return enter', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../journey-boards-manager.ts'),
      'utf8',
    );
    const prepareStart = source.indexOf('public prepareJourneyV700WorldEnterFromReturn(');
    const prepareEnd = source.indexOf('\n  private playJourneyV700WorldEnter(', prepareStart);
    const prepareSource = source.slice(prepareStart, prepareEnd);
    const reconcileIndex = prepareSource.indexOf('this.reconcileMountedJourneyWorldCardUnits(');
    const primeIndex = prepareSource.indexOf('this.primeJourneyV700WorldEnter(');

    expect(prepareStart).toBeGreaterThan(-1);
    expect(reconcileIndex).toBeGreaterThan(-1);
    expect(primeIndex).toBeGreaterThan(reconcileIndex);
    expect(prepareSource).toContain('Full Journey rendering is correctly blocked while gameplay owns the');
  });

  test('rebuilds interim area hit targets after the return screen becomes playable', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../journey-boards-manager.ts'),
      'utf8',
    );
    const playStart = source.indexOf('public playJourneyV700WorldEnterFromReturn(');
    const playEnd = source.indexOf('\n  public prepareJourneyV700WorldEnterFromReturn(', playStart);
    const playSource = source.slice(playStart, playEnd);

    expect(playStart).toBeGreaterThan(-1);
    expect(playSource).toContain('this.reconcileMountedJourneyWorldCardUnits(');
    expect(playSource).toContain('this.trackRAF(() => this.installInterimAreaHitTargets(cardsContainer));');
  });

  test('restores an interim completion to New before rendering its Unit and return modal', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../journey-boards-manager.ts'),
      'utf8',
    );
    const unlockStart = source.indexOf('public unlockBoardOnCompletion(boardNumber: number): void');
    const renderIndex = source.indexOf('this.renderBoards();', unlockStart);
    const restoreIndex = source.indexOf(
      'const nextViewedBoards = viewedBoards.filter(',
      unlockStart,
    );

    expect(unlockStart).toBeGreaterThan(-1);
    expect(source.slice(unlockStart, renderIndex)).toContain(
      '(viewedBoardId) => Number(viewedBoardId) !== boardNumber',
    );
    expect(restoreIndex).toBeGreaterThan(unlockStart);
    expect(restoreIndex).toBeLessThan(renderIndex);
    expect(source.slice(unlockStart, renderIndex)).toContain('if (!wasAlreadyUnlocked)');
  });
});
