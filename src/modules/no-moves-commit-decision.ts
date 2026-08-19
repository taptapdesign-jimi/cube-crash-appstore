export type NoMovesCommitDecisionInput = {
  initialSignature: string;
  currentSignature: string;
  freshEndGameType: string;
  wildContinuationPending: boolean;
  gameplayTransactionActive: boolean;
  activeDrag: boolean;
  endgameGuardActive: boolean;
};

export type NoMovesCommitDecision =
  | { action: 'commit' }
  | { action: 'defer'; reason: string };

/** Pure terminal boundary: a stale stuck snapshot can never commit gameplay. */
export function resolveNoMovesCommitDecision(input: NoMovesCommitDecisionInput): NoMovesCommitDecision {
  if (input.wildContinuationPending) return { action: 'defer', reason: 'wild-continuation-pending' };
  if (input.gameplayTransactionActive) return { action: 'defer', reason: 'gameplay-transaction-active' };
  if (input.activeDrag) return { action: 'defer', reason: 'active-drag' };
  if (input.endgameGuardActive) return { action: 'defer', reason: 'endgame-guard-active' };
  if (input.currentSignature !== input.initialSignature) return { action: 'defer', reason: 'board-changed' };
  if (input.freshEndGameType !== 'stuck') {
    return { action: 'defer', reason: `fresh-result:${input.freshEndGameType}` };
  }
  return { action: 'commit' };
}
