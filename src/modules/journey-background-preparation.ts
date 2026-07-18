export interface JourneyPreparationRuntimeState {
  appZone?: string;
  gameStartInProgress?: boolean;
  boardTransitionActive?: boolean;
}

const BLOCKED_ZONES = new Set([
  'board-arcade',
  'board-journey',
  'clean-board',
  'new-card',
  'stage-complete',
  'fail-screen',
]);

export function isJourneyBackgroundPreparationAllowed(
  state: JourneyPreparationRuntimeState
): boolean {
  if (state.gameStartInProgress || state.boardTransitionActive) return false;
  return !state.appZone || !BLOCKED_ZONES.has(state.appZone);
}

export function readJourneyPreparationRuntimeState(): JourneyPreparationRuntimeState {
  const runtime = window as any;
  return {
    appZone: runtime.__ccAppZone,
    gameStartInProgress: runtime.__ccGameStartInProgress === true,
    boardTransitionActive: runtime.__ccBoardTransitionActive === true,
  };
}

export function shouldBlockHiddenJourneyRender(
  journeyScreenHidden: boolean,
  boardTransitionVisible: boolean
): boolean {
  return journeyScreenHidden && boardTransitionVisible;
}
