export interface JourneyBottomDecorDecisionInput {
  isArcade: boolean;
  isJourneyOrigin: boolean;
}

export function shouldShowJourneyBottomDecor({
  isArcade,
  isJourneyOrigin,
}: JourneyBottomDecorDecisionInput): boolean {
  void isJourneyOrigin;
  return !isArcade;
}
