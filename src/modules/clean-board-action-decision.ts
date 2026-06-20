export type CleanBoardModalAction =
  | 'back-to-journey'
  | 'exit'
  | 'play-again'
  | 'continue'
  | string
  | undefined;

export type CleanBoardActionDecisionType =
  | 'back-to-journey'
  | 'arcade-exit'
  | 'journey-exit'
  | 'play-again'
  | 'continue';

export type CleanBoardActionDecision = {
  type: CleanBoardActionDecisionType;
};

export function resolveCleanBoardActionDecision(input: {
  action: CleanBoardModalAction;
  isArcade: boolean;
}): CleanBoardActionDecision {
  if (input.action === 'back-to-journey') {
    return { type: 'back-to-journey' };
  }

  if (input.action === 'exit') {
    return { type: input.isArcade ? 'arcade-exit' : 'journey-exit' };
  }

  if (input.action === 'play-again') {
    return { type: 'play-again' };
  }

  return { type: 'continue' };
}
