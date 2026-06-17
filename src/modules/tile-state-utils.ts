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

export interface SpawnReadinessOptions {
  autoClearStaleFlag?: boolean;
  ignoreWildJuice?: boolean;
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

function tileIsWild(tile: any): boolean {
  if (!tile) return false;
  return (
    tile.special === 'wild' ||
    tile.special === 'wild-magnet' ||
    tile.special === 'wild-juice' ||
    tile.special === 'wild-tnt' ||
    tile.isWild === true ||
    tile.isWildFace === true
  );
}

export function isTileTransientlySpawning(tile: any, options: SpawnReadinessOptions = {}): boolean {
  if (!tile || tile.destroyed) return false;
  const { autoClearStaleFlag = false, ignoreWildJuice = true } = options;

  if (ignoreWildJuice && tile.special === 'wild-juice') return false;

  // A plain locked value tile is not automatically "still spawning".
  // Persistent locked/stack content is not a playable move and must not
  // keep the no-moves fail screen deferred forever. Only explicit transient
  // flags/tweens below should block endgame evaluation.
  if (tile.locked && (tile.value | 0) > 0) {
    if (tile._wildMagnetAffected === true) return true;
    if (tile._spawnTween) {
      let tweenActive = false;
      try {
        tweenActive =
          typeof tile._spawnTween.isActive === 'function'
            ? tile._spawnTween.isActive()
            : !!tile._spawnTween.isActive;
      } catch {}
      if (tweenActive) return true;
      if (autoClearStaleFlag) {
        try {
          tile._spawnTween = null;
        } catch {}
      }
    }
  }

  if (tile._isBeingSpawned === true) {
    const value = (tile.value | 0);
    const mode = tile.eventMode;
    const inputEnabled = mode !== 'none' && mode !== 'passive';
    const looksInteractive =
      !tile.locked &&
      (value > 0 || tileIsWild(tile)) &&
      tile.visible !== false &&
      inputEnabled;

    // Defensive cleanup: stale spawn-flag should not indefinitely block fail/no-moves flow.
    if (looksInteractive) {
      if (autoClearStaleFlag) {
        try {
          tile._isBeingSpawned = false;
        } catch {}
      }
      return false;
    }
    return true;
  }

  return false;
}

export function getTransientSpawnState(tiles: any[] | null | undefined, options: SpawnReadinessOptions = {}) {
  const source = Array.isArray(tiles) ? tiles : [];
  const lockedActiveTiles = source.filter((t: any) => {
    if (!t || t.destroyed || !t.locked) return false;
    if (options.ignoreWildJuice !== false && t.special === 'wild-juice') return false;
    if ((t.value | 0) <= 0) return false;
    return isTileTransientlySpawning(t, options);
  });
  const tilesStillSpawning = source.filter((t: any) => isTileTransientlySpawning(t, options));
  return {
    lockedActiveTiles,
    tilesStillSpawning,
    hasNotReadyTiles: lockedActiveTiles.length > 0 || tilesStillSpawning.length > 0,
  };
}
