export interface JourneyBottomDecorDecisionInput {
  isArcade: boolean;
  isJourneyOrigin: boolean;
}

export function shouldShowJourneyBottomDecor({
  isArcade,
  isJourneyOrigin,
}: JourneyBottomDecorDecisionInput): boolean {
  return !isArcade || isJourneyOrigin === true;
}
