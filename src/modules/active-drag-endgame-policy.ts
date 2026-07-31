/**
 * Endgame checks observe an active drag but never own or cancel it.
 *
 * The drag runtime has the pointer listeners and an activity-refreshed watchdog,
 * so it is the only layer that can distinguish a slow, valid drag from a lost
 * pointer. A wall-clock timeout inside endgame handling would interrupt users
 * who deliberately hold or move a cube slowly.
 */
export function shouldDeferEndgameForActiveDrag(activeDragTile: any): boolean {
  return Boolean(activeDragTile && activeDragTile.destroyed !== true);
}
