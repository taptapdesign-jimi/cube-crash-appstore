import { gsap } from 'gsap';

export type TileLifecycleGrid = any[][] | null | undefined;

export type TileLifecycleRemoveOptions = {
  board?: any;
  grid?: TileLifecycleGrid;
  tiles?: any[];
  setTiles?: (tiles: any[]) => void;
  clearEndGameCache?: () => void;
  stopWildIdle?: (tile: any) => void;
  stopWildShimmer?: (tile: any) => void;
  stopWildStars?: (tile: any) => void;
  stopWildJuiceBubbles?: (tile: any) => void;
  stopMagnetIdleParticles?: (tile: any) => void;
  stopTntIdleParticles?: (tile: any) => void;
  stopTntIdleShake?: (tile: any) => void;
  log?: (...args: any[]) => void;
};

const MAGNET_TRANSIENT_FLAGS = [
  '_wildMagnetAffected',
  '_wildMagnetOriginalX',
  '_wildMagnetOriginalY',
  '_wildMagnetPulledTilesMerge',
  '_wildMagnetPulledTilesScoring',
  '_wildMagnetMergeCallback',
  '_wildMagnetPulledCells',
  '_hasTilesToPull',
  '_skipMagnetPull',
  '_noTilesPulled',
  '_willPullTiles',
  '_wasWildMagnetMerge6',
] as const;

const TILE_ANIMATION_KEYS = [
  '_wobbleTl',
  '_bounceTl',
  '_bounceRotTl',
  '_preBounceTl',
  '_preBounceRotTl',
  '_mergeTween',
  '_wildMergeTween',
  '_pulseTween',
  '_wildPulseTween',
  '_spawnTween',
  '_destroyTween',
] as const;

export function detachTileFromGrid(tile: any, grid: TileLifecycleGrid, log?: (...args: any[]) => void): boolean {
  if (!tile || !grid) return false;
  let cleared = false;
  const gx = tile.gridX;
  const gy = tile.gridY;

  try {
    if (gy !== undefined && gx !== undefined && grid?.[gy]?.[gx] === tile) {
      grid[gy][gx] = null;
      cleared = true;
      log?.(`🧹 tile-lifecycle: cleared grid[${gy}][${gx}]`);
    }
  } catch {}

  if (!cleared) {
    try {
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c] === tile) {
            grid[r][c] = null;
            cleared = true;
            log?.(`🧹 tile-lifecycle: cleared stale grid[${r}][${c}]`);
            break;
          }
        }
        if (cleared) break;
      }
    } catch {}
  }

  return cleared;
}

export function stopTileRuntimeFx(tile: any, options: TileLifecycleRemoveOptions = {}): void {
  if (!tile) return;
  try { tile.hover?.clear?.(); } catch {}
  try { tile.removeAllListeners?.(); } catch {}
  try { gsap.killTweensOf(tile); } catch {}
  try { gsap.killTweensOf(tile.scale); } catch {}
  try { gsap.killTweensOf(tile.rotG); } catch {}

  TILE_ANIMATION_KEYS.forEach((key) => {
    try {
      const timeline = tile[key];
      timeline?.kill?.();
      tile[key] = null;
    } catch {}
  });

  try { options.stopWildIdle?.(tile); } catch {}
  try { options.stopWildShimmer?.(tile); } catch {}
  try { options.stopWildStars?.(tile); } catch {}
  try { options.stopWildJuiceBubbles?.(tile); } catch {}
  try { options.stopMagnetIdleParticles?.(tile); } catch {}
  try { options.stopTntIdleParticles?.(tile); } catch {}
  try { options.stopTntIdleShake?.(tile); } catch {}
}

export function clearTileTransientFlags(tile: any): void {
  if (!tile) return;
  try {
    MAGNET_TRANSIENT_FLAGS.forEach((key) => {
      delete tile[key];
    });
    delete tile._skipIdleScaleReset;
    delete tile._pendingRemoval;
    delete tile._beingRemoved;
    delete tile._cleanupQueued;
    delete tile._ccWildSpawnDropping;
    delete tile._ccWildSpawnHandoffLock;
  } catch {}
}

export function removeTileFully(tile: any, options: TileLifecycleRemoveOptions = {}): boolean {
  if (!tile || tile.destroyed) return false;

  const tiles = options.tiles;
  const idx = Array.isArray(tiles) ? tiles.indexOf(tile) : -1;
  if (idx !== -1) {
    try { options.clearEndGameCache?.(); } catch {}
  }

  detachTileFromGrid(tile, options.grid, options.log);
  stopTileRuntimeFx(tile, options);

  try {
    tile.eventMode = 'none';
    tile.visible = false;
    tile.alpha = 0;
  } catch {}

  clearTileTransientFlags(tile);

  try { options.board?.removeChild?.(tile); } catch {}
  if (idx !== -1 && tiles) {
    tiles.splice(idx, 1);
  } else if (Array.isArray(tiles) && options.setTiles) {
    options.setTiles(tiles.filter((candidate) => candidate !== tile));
  }

  try {
    tile.destroy?.({ children: true, texture: false, textureSource: false });
  } catch {}

  return true;
}

export function isGameplayTileCandidate(tile: any): boolean {
  if (!tile || tile.destroyed) return false;
  if (tile._pendingRemoval === true || tile._beingRemoved === true || tile._cleanupQueued === true) return false;
  if (tile.visible === false) return false;
  if (typeof tile.alpha === 'number' && tile.alpha <= 0.01) return false;
  if (tile.eventMode === 'none' || tile.eventMode === 'passive') return false;
  if (tile.locked === true) return false;
  return !!tile.special || !!tile.isWild || !!tile.isWildFace || (tile.value | 0) > 0;
}

export function isLockedEmptyPlaceholder(tile: any): boolean {
  if (!tile || tile.destroyed) return false;
  if (tile.locked !== true) return false;
  if (tile.special) return false;
  return (tile.value | 0) <= 0;
}

export function normalizeSpawnedTileVisual(tile: any): void {
  if (!tile) return;

  try {
    if (tile.scale?.set) tile.scale.set(1, 1);
    else if (tile.scale) {
      tile.scale.x = 1;
      tile.scale.y = 1;
    }
  } catch {}

  try { tile._isBeingSpawned = false; } catch {}

  tile.alpha = 1;
  if (tile.rotG) tile.rotG.alpha = 1;
  if (tile.base) tile.base.alpha = 1;
  if (tile.overlay) {
    tile.overlay.alpha = 1;
    tile.overlay.visible = false;
  }
  if (tile.num) tile.num.alpha = 1;
  if (tile.pips) {
    tile.pips.alpha = 1;
    tile.pips.visible = true;
  }
}

export function normalizePlayableTileAfterMutation(tile: any): void {
  if (!tile || tile.destroyed) return;

  clearTileTransientFlags(tile);
  normalizeSpawnedTileVisual(tile);

  try { tile.locked = false; } catch {}
  try { tile.visible = true; } catch {}
  try { tile.alpha = 1; } catch {}
  try { tile.eventMode = 'static'; } catch {}
  try { tile.interactive = true; } catch {}
  try { tile.interactiveChildren = true; } catch {}
  try { tile.cursor = 'pointer'; } catch {}

  const rotG = tile.rotG;
  if (rotG && !rotG.destroyed) {
    try { rotG.eventMode = 'static'; } catch {}
    try { rotG.interactive = true; } catch {}
    try { rotG.interactiveChildren = true; } catch {}
    try { rotG.cursor = 'pointer'; } catch {}
    try { rotG.alpha = 1; } catch {}
    try { rotG.visible = true; } catch {}
  }
}
