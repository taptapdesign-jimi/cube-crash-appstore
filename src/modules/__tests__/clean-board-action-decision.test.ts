import { resolveCleanBoardActionDecision } from '../clean-board-action-decision';

describe('clean-board-action-decision', () => {
  it('routes back-to-journey explicitly', () => {
    expect(resolveCleanBoardActionDecision({ action: 'back-to-journey', isArcade: false })).toEqual({
      type: 'back-to-journey',
    });
  });

  it('routes exit by current game mode', () => {
    expect(resolveCleanBoardActionDecision({ action: 'exit', isArcade: true })).toEqual({
      type: 'arcade-exit',
    });
    expect(resolveCleanBoardActionDecision({ action: 'exit', isArcade: false })).toEqual({
      type: 'journey-exit',
    });
  });

  it('routes play-again explicitly', () => {
    expect(resolveCleanBoardActionDecision({ action: 'play-again', isArcade: false })).toEqual({
      type: 'play-again',
    });
  });

  it('defaults unknown or missing actions to continue', () => {
    expect(resolveCleanBoardActionDecision({ action: undefined, isArcade: false })).toEqual({
      type: 'continue',
    });
    expect(resolveCleanBoardActionDecision({ action: 'unexpected', isArcade: true })).toEqual({
      type: 'continue',
    });
  });
});
