export type LaserGunBounceHandle = {
  kill?: () => void;
};

export type LaserGunTileImpactOptions = {
  tile: any;
  grid: any[][] | null | undefined;
  tiles: readonly any[] | null | undefined;
  column: number;
  row: number;
  replacementValue: number;
  setValueImmediate: (tile: any, value: number, depth: number) => void;
  startBounce: (
    tile: any,
    onComplete: () => void,
    onInterrupt: () => void,
  ) => LaserGunBounceHandle | void;
  releaseOwnership: (tile: any) => void;
  onValueCommitted?: () => void;
  onSettled: (committed: boolean) => void;
  isCurrent?: () => boolean;
  scheduleSafety: (callback: () => void, delayMs: number) => unknown;
  safetyDelayMs?: number;
};

/**
 * Commit one LaserGun hit without replacing the display object. Keeping the
 * same object is essential: drag/snapback, grid and STATE.tiles must never be
 * able to observe different identities for the cell while the four-shot
 * sequence is still running.
 */
export function commitLaserGunTileImpact({
  tile,
  grid,
  tiles,
  column,
  row,
  replacementValue,
  setValueImmediate,
  startBounce,
  releaseOwnership,
  onValueCommitted,
  onSettled,
  isCurrent = () => true,
  scheduleSafety,
  safetyDelayMs = 900,
}: LaserGunTileImpactOptions): boolean {
  let settled = false;
  let bounceHandle: LaserGunBounceHandle | void;
  let lifecycleHandle: LaserGunBounceHandle | null = null;
  const baseRotation = Number(tile?.rotG?.rotation) || 0;

  const settle = (committed: boolean, killBounce = false, notifyOwner = true): void => {
    if (settled) return;
    settled = true;
    if (killBounce) {
      try { if (bounceHandle) bounceHandle.kill?.(); } catch {}
    }
    try { tile?.scale?.set?.(1, 1); } catch {}
    try {
      if (tile?.rotG && !tile.rotG.destroyed) tile.rotG.rotation = baseRotation;
    } catch {}
    try {
      if (tile?._ccLaserGunImpactTl === lifecycleHandle) tile._ccLaserGunImpactTl = null;
    } catch {}
    try { releaseOwnership(tile); } catch {}
    if (notifyOwner && isCurrent()) {
      try { onSettled(committed); } catch {}
    }
  };

  if (!isCurrent()) {
    try { releaseOwnership(tile); } catch {}
    return false;
  }
  const isCurrentIdentity = !!tile
    && !tile.destroyed
    && Array.isArray(tiles)
    && tiles.includes(tile)
    && grid?.[row]?.[column] === tile;
  if (!isCurrentIdentity) {
    settle(false);
    return false;
  }

  let valueCommitted = false;
  try {
    tile.stackDepth = 1;
    setValueImmediate(tile, replacementValue, 0);
    valueCommitted = true;
    onValueCommitted?.();
    bounceHandle = startBounce(
      tile,
      () => settle(true),
      () => settle(true),
    );
    // Board retirement owns teardown but must not report completion back into
    // the retired run. The independent safety boundary still notifies the
    // current run so an interrupted bounce cannot strand its shot sequence.
    lifecycleHandle = { kill: () => settle(true, true, false) };
    if (!settled) tile._ccLaserGunImpactTl = lifecycleHandle;
    if (!settled) scheduleSafety(() => settle(true, true), safetyDelayMs);
    return true;
  } catch {
    // Once setValueImmediate returned, the same tile already owns its new
    // value. A presentation failure cannot truthfully turn that commit into a
    // rejected mutation or invite a duplicate fallback hit.
    settle(valueCommitted, true);
    return valueCommitted;
  }
}
