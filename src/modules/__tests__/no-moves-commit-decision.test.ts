import { resolveNoMovesCommitDecision } from '../no-moves-commit-decision';

const stableStuck = {
  initialSignature: 'board-a',
  currentSignature: 'board-a',
  freshEndGameType: 'stuck',
  wildContinuationPending: false,
  gameplayTransactionActive: false,
  activeDrag: false,
  endgameGuardActive: false,
};

describe('NO MOVES atomic commit decision', () => {
  test('commits only an unchanged freshly confirmed stuck board', () => {
    expect(resolveNoMovesCommitDecision(stableStuck)).toEqual({ action: 'commit' });
  });

  test.each(['wild-star', 'wild-juice', 'wild-magnet', 'wild-tnt', 'bottle', 'honey'])(
    'defers stale fail after %s makes the live board playable',
    () => {
      expect(resolveNoMovesCommitDecision({
        ...stableStuck,
        currentSignature: 'board-with-playable-special',
        freshEndGameType: 'continue',
      })).toEqual({ action: 'defer', reason: 'board-changed' });
    },
  );

  test('defers during wild handoff, merge transaction, drag, and endgame guard', () => {
    expect(resolveNoMovesCommitDecision({ ...stableStuck, wildContinuationPending: true }).action).toBe('defer');
    expect(resolveNoMovesCommitDecision({ ...stableStuck, gameplayTransactionActive: true }).action).toBe('defer');
    expect(resolveNoMovesCommitDecision({ ...stableStuck, activeDrag: true }).action).toBe('defer');
    expect(resolveNoMovesCommitDecision({ ...stableStuck, endgameGuardActive: true }).action).toBe('defer');
  });
});
