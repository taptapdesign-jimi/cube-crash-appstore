export function shouldDisposeGameplayDragOwner(
  reason: string,
  isNavigationCleanup: boolean,
): boolean {
  return isNavigationCleanup || reason.includes('cleanupGame');
}
