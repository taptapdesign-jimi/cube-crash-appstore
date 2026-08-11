export interface JourneyPreparationRuntimeState {
  appZone?: string;
  gameStartInProgress?: boolean;
  boardTransitionActive?: boolean;
}

const ALLOWED_PREPARATION_ZONES = new Set(['home', 'journey']);

export function isJourneyBackgroundPreparationAllowed(
  state: JourneyPreparationRuntimeState
): boolean {
  if (state.gameStartInProgress || state.boardTransitionActive) return false;
  return !!state.appZone && ALLOWED_PREPARATION_ZONES.has(state.appZone);
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
  boardTransitionVisible: boolean,
  activeUiBlocksHiddenRender = false,
): boolean {
  return journeyScreenHidden && (boardTransitionVisible || activeUiBlocksHiddenRender);
}

/**
 * A prepared Journey view must be recognized by its own DOM contract.
 * The Hub intentionally has no `.journey-board-card`, so using that selector
 * as a generic readiness check destroys and rebuilds an already prepared Hub.
 */
export function isJourneyViewStructurallyPrepared(container: HTMLElement | null): boolean {
  if (!container?.isConnected) return false;

  const view = container.dataset.journeyV700View;
  if (view === 'hub') {
    const hub = container.querySelector<HTMLElement>('.journey-v700-hub');
    const cloudLayer = hub?.querySelector<HTMLElement>('.journey-v700-hub-cloud-layer');
    const worldCards = hub?.querySelectorAll<HTMLElement>('.journey-v700-world-card');
    return !!hub && !!cloudLayer && worldCards?.length === 3;
  }

  if (view === 'world') {
    const cardsContainer = container.querySelector<HTMLElement>('.journey-cards-container');
    return !!cardsContainer && !!cardsContainer.querySelector('.journey-board-card');
  }

  return false;
}
