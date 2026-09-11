import { isNoMovesNavigationLocked } from './terminal-navigation-lock.js';

type HudRuntimeState = {
  exitingToMenu?: boolean;
  __ccAppZone?: string;
};

/**
 * Gameplay HUD reveal callbacks may outlive board entry. Once menu exit owns
 * the route—or another explicit surface owns the app—they must become no-ops.
 */
export function isGameplayHudRevealAllowed(
  runtime: HudRuntimeState = window as unknown as HudRuntimeState,
): boolean {
  if (runtime.exitingToMenu === true) return false;
  // Entry callbacks can survive long enough to overlap the NO MOVES handoff.
  // During that handoff the already-visible HUD keeps its current pose; a late
  // forceRestart drop would visibly move it down again before the Fail screen.
  if (isNoMovesNavigationLocked()) return false;

  const zone = runtime.__ccAppZone;
  if (zone === undefined || zone === null || zone === '') return true;
  return zone === 'board-arcade' || zone === 'board-journey';
}
