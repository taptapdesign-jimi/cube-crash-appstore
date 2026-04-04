// src/modules/tile-state-utils.ts
// Helpers for aggressively clearing magnet/wild residue before reusing a tile.

export interface TileLike {
  special?: string | null;
  isWild?: boolean;
  isWildFace?: boolean;
  num?: { visible: boolean };
  pips?: { visible: boolean; clear?: () => void };
  base?: { tint?: number; alpha?: number };
  [key: string]: any;
}

/**
 * Fully resets a tile so it behaves like a fresh, normal cube.
 * Use this immediately before re-spawning a regular tile on a recycled holder.
 */
export function resetTileToNormalState(tile: TileLike | null | undefined): void {
  if (!tile) return;

  tile.special = null;
  tile.isWild = false;
  tile.isWildFace = false;

  // Visual clean-up so the tile no longer looks like wild/magnet
  try {
    if (tile.num) tile.num.visible = true;
  } catch {}
  try {
    if (tile.pips) tile.pips.visible = true;
  } catch {}
  try {
    if (tile.base) {
      tile.base.tint = 0xffffff;
      tile.base.alpha = 1;
    }
  } catch {}

  // Remove every flag we set during magnet pulls so drag/drop treats it as a normal tile
  delete tile._wildMagnetAffected;
  delete tile._wildMagnetOriginalX;
  delete tile._wildMagnetOriginalY;
  delete tile._wildMagnetMergeCallback;
  delete tile._wildMagnetPulledTilesMerge;
  delete tile._wildMagnetPulledTilesScoring;
  delete tile._wildMagnetPulledCells;
  delete tile._wildMagnetSpeedUp;
  delete tile._skipIdleScaleReset;
}

/**
 * Locked tiles that still represent real board / level content (ice, not-yet-open cells).
 * Excludes tiles temporarily `locked` during wild-magnet pull (`_wildMagnetAffected`).
 * Aligns with endgame-checker RULE 1 (ignore value≤0 ghost placeholders).
 */
export function boardHasPersistentLockedTiles(tiles: any[] | null | undefined): boolean {
  if (!tiles?.length) return false;
  return tiles.some((t: any) => {
    if (!t || t.destroyed || !t.locked) return false;
    if (t._wildMagnetAffected === true) return false;
    const isWild =
      t.special === 'wild' ||
      t.special === 'wild-magnet' ||
      t.special === 'wild-juice' ||
      t.special === 'wild-tnt' ||
      t.isWild === true ||
      t.isWildFace === true;
    if (isWild) return true;
    if (t._isBeingSpawned === true) return true;
    return (t.value | 0) > 0;
  });
}
