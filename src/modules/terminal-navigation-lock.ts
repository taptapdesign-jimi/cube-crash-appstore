let noMovesNavigationLocked = false;

/**
 * NO MOVES owns navigation until its terminal modal completes the handoff.
 * Gameplay may stay responsive during candidate confirmation, but HUD/menu
 * exits must not replace the board underneath the terminal presentation.
 */
export function setNoMovesNavigationLocked(locked: boolean): void {
  noMovesNavigationLocked = locked;
}

export function isNoMovesNavigationLocked(): boolean {
  return noMovesNavigationLocked;
}
