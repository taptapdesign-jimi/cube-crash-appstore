import { resolveMerge6MovesDepletedStuckAction } from '../merge6-terminal-handoff-decision';

describe('merge-6 terminal handoff decision', () => {
  test('finishes merge-6 cleanup and spawn when the earned wild reward defers No Moves', () => {
    expect(resolveMerge6MovesDepletedStuckAction({
      wildContinuationDeferred: true,
    })).toBe('continue-merge6');
  });

  test('runs the fail flow when no wild continuation exists', () => {
    expect(resolveMerge6MovesDepletedStuckAction({
      wildContinuationDeferred: false,
    })).toBe('run-fail');
  });
});
