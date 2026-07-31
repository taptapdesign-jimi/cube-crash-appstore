export function isEndgameHintSurfaceAllowed(
  appZone: unknown,
  appSurfaceVisible: boolean,
): boolean {
  if (!appSurfaceVisible) return false;
  return appZone === 'board-arcade' || appZone === 'board-journey';
}
