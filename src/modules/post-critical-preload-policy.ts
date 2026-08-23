export interface PostCriticalPreloadRuntime {
  isMobileRuntime: boolean;
  appZone?: string;
  gameStartInProgress?: boolean;
  boardTransitionVisible?: boolean;
}

export function shouldPausePostCriticalPreload(state: PostCriticalPreloadRuntime): boolean {
  if (!state.isMobileRuntime) return false;
  if (state.gameStartInProgress || state.boardTransitionVisible) return true;
  return state.appZone !== 'home';
}
