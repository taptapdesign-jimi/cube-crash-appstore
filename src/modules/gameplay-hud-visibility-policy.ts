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

  const zone = runtime.__ccAppZone;
  if (zone === undefined || zone === null || zone === '') return true;
  return zone === 'board-arcade' || zone === 'board-journey';
}
