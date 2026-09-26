type GameplayRenderer = {
  ticker?: { started?: boolean; start?: () => void; stop?: () => void };
};

// A terminal screen retains its app for Play Again. Only a new gameplay entry
// can release this hold; foreground recovery and stale modal finally blocks
// must not restart rendering underneath the result.
const terminalHolds = new WeakSet<GameplayRenderer>();

export function isGameplayRendererTerminalSuspended(app?: GameplayRenderer | null): boolean {
  return !!app && terminalHolds.has(app);
}

export function suspendGameplayRendererForTerminal(
  app: GameplayRenderer | null | undefined,
  isCurrent: () => boolean,
  retireIdle: () => void,
): boolean {
  if (!app || !isCurrent()) return false;
  if (terminalHolds.has(app)) return true;
  terminalHolds.add(app);
  try { retireIdle(); } finally { app.ticker?.stop?.(); }
  return true;
}

export function releaseGameplayRendererForEntry(app?: GameplayRenderer | null): void {
  if (app) terminalHolds.delete(app);
  // The existing prepared-entry owner starts the ticker when the board is ready.
}
