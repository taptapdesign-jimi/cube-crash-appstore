import {
  formatJourneyWorldStageNumber,
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
});
