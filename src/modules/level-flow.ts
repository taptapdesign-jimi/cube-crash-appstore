// @ts-nocheck
import { logger } from '../core/logger.js';
import { resetTileToNormalState } from './tile-state-utils.ts';
import { randomRegularTileValue } from './app-core-utils.js';
import { isWildLikeTile } from './final-merge-rules.ts';
// public/src/modules/level-flow.ts

// 🔥 FIX: Track spawn timeouts for cleanup
const activeSpawnTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();
const pendingSpawnCancellers: Set<() => void> = new Set();
let levelFlowGeneration = 0;

/** Serialize openLockedBounceParallel — parallel calls (wild merge + timers) were racing on the same locked tiles. */
let openLockedBounceMutex: Promise<void> = Promise.resolve();

/**
 * Cleanup all spawn timeouts
 * Call this when game ends or app is destroyed
 */
export function cleanupLevelFlowTimeouts(): void {
  levelFlowGeneration++;
  activeSpawnTimeouts.forEach(timeout => {
    try { clearTimeout(timeout); } catch {}
  });
  activeSpawnTimeouts.clear();
  // Clearing a timeout alone must never strand an awaited spawn Promise.
  // Settle every in-flight pick before releasing the serialized queue.
  [...pendingSpawnCancellers].forEach(cancel => {
    try { cancel(); } catch {}
  });
  pendingSpawnCancellers.clear();
  // Reset serialized queue so a stale previous run cannot delay a fresh run.
  openLockedBounceMutex = Promise.resolve();
  console.log('✅ Level flow timeouts cleaned up');
}

// Type definitions
interface Tile {
  locked: boolean;
  eventMode?: string;
  cursor?: string;
  value: number;
}

interface MakeBoard {
  anyMergePossible?: (tiles: Tile[]) => boolean;
  setValue?: (tile: Tile, value: number, stackDepth: number, opts?: any) => void;
  syncTileZIndex?: (tile: Tile, board?: any, animating?: boolean) => void;
}

interface Drag {
  bindToTile?: (tile: Tile) => void;
}

interface SpawnBounceOptions {
  max: number;
  compress: number;
  rebound: number;
  startScale: number;
  wiggle: number;
}

interface CheckLevelEndParams {
  makeBoard?: MakeBoard;
  tiles?: Tile[];
  onCleanBoard?: () => void;
}

interface OpenLockedBounceParallelParams {
  tiles?: Tile[];
  k?: number;
  drag?: Drag;
  makeBoard?: MakeBoard;
  gsap?: any;
  drawBoardBG?: () => void;
  TILE?: any;
  fixHoverAnchor?: (tile: Tile) => void;
  spawnBounce?: (tile: Tile, callback: () => void, options: SpawnBounceOptions) => void;
  wildMergeTarget?: number | null;
  excludeCells?: Set<string>; // 🔥 CRITICAL: Set of cell keys (format: "c,r") to exclude from spawning
  preferCells?: Set<string>; // 🔥 CRITICAL: For regular merge 6 – prioritize opening placeholder at merge location (format: "c,r")
}

export class LevelFlowCancelledError extends Error {
  constructor() {
    super('Level-flow spawn cancelled by lifecycle cleanup.');
    this.name = 'LevelFlowCancelledError';
  }
}


interface WindowWithUpdateHighScore extends Window {
  updateHighScore?: (score: number) => void;
}

declare let window: WindowWithUpdateHighScore;

export function checkLevelEnd({ makeBoard, tiles, onCleanBoard }: CheckLevelEndParams = {}): void {
  if (!makeBoard?.anyMergePossible || !Array.isArray(tiles)) return;
  if (!makeBoard.anyMergePossible(tiles)) onCleanBoard?.();
}

export async function openLockedBounceParallel(params: OpenLockedBounceParallelParams = {}): Promise<number> {
  const generationAtStart = levelFlowGeneration;
  const prev = openLockedBounceMutex;
  let release!: () => void;
  openLockedBounceMutex = new Promise<void>((r) => {
    release = r;
  });
  await prev;
  if (generationAtStart !== levelFlowGeneration) {
    release();
    throw new LevelFlowCancelledError();
  }
  try {
    return await openLockedBounceParallelImpl(params, generationAtStart);
  } finally {
    release();
  }
}

async function openLockedBounceParallelImpl({
  tiles = [],
  k = 0,
  drag,
  makeBoard,
  gsap,
  drawBoardBG,
  TILE,
  fixHoverAnchor,
  spawnBounce,
  wildMergeTarget = null,
  excludeCells = new Set<string>(),
  preferCells = new Set<string>(),
}: OpenLockedBounceParallelParams = {}, generationAtStart = levelFlowGeneration): Promise<number> {
  if (generationAtStart !== levelFlowGeneration) throw new LevelFlowCancelledError();
  // 🔥 CRITICAL: Filter out destroyed tiles FIRST before any other checks
  // Also filter out tiles without scale (they can't be spawned)
  let locked = tiles.filter(t => t && !t.destroyed && t.locked && t.scale);
  
  // 🔥 CRITICAL: Filter out locked tiles that are on excluded cells (where pulled tiles were)
  if (excludeCells.size > 0) {
    locked = locked.filter((t: any) => {
      if (!t || t.destroyed) return false; // Double-check destroyed
      if (typeof t.gridX === 'number' && typeof t.gridY === 'number') {
        const cellKey = `${t.gridX},${t.gridY}`;
        const isExcluded = excludeCells.has(cellKey);
        if (isExcluded) {
          logger.info(`🎯 Excluding cell (${t.gridX}, ${t.gridY}) from spawn (was pulled tile location)`);
        }
        return !isExcluded;
      }
      return true; // Keep tiles without grid positions
    });
  }
  
  // 🔥 CRITICAL: Filter out tiles that are already spawned (have _spawned flag)
  // This prevents reanimating tiles that were already spawned in mergePulledTilesIntoMerge6
  locked = locked.filter((t: any) => {
    if (!t || t.destroyed) return false; // Double-check destroyed
    if ((t as any)._spawned === true) {
      logger.info(`🎯 Excluding tile at (${(t as any).gridX}, ${(t as any).gridY}) from spawn (already spawned)`);
      return false;
    }
    return true;
  });
  
  if (!locked.length || k <= 0) {
    logger.debug(`🎯 openLockedBounceParallel: early return - locked=${locked.length} k=${k}`, 'level-flow');
    return 0;
  }

  // 🔥 CRITICAL: For regular merge 6 – prioritize placeholder at merge location so it never stays locked
  // Partition into preferred (at merge cell) and rest, pick preferred first, then fill from shuffled rest
  let picks: any[];
  if (preferCells.size > 0) {
    const preferred = locked.filter((t: any) => typeof t.gridX === 'number' && typeof t.gridY === 'number' && preferCells.has(`${t.gridX},${t.gridY}`));
    const rest = locked.filter((t: any) => !preferred.includes(t));
    for (let i = rest.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [rest[i], rest[j]] = [rest[j], rest[i]]; }
    const nPreferred = Math.min(preferred.length, k);
    const nRest = Math.min(k - nPreferred, rest.length);
    picks = [...preferred.slice(0, nPreferred), ...rest.slice(0, nRest)];
  } else {
    for (let i = locked.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [locked[i], locked[j]] = [locked[j], locked[i]]; }
    picks = locked.slice(0, Math.min(k, locked.length));
  }

  logger.debug(`🎯 openLockedBounceParallel: locked=${locked.length} picks=${picks.length} k=${k}`, 'level-flow');
  // 🔥 CRITICAL FIX: Procedural spawn with cascading animations – 100ms between tiles
  // spawnBounce animation takes ~0.24s (with timeScale 2.0), delay 100ms between tiles for visible one-by-one
  // Sequential spawning (shifted by +50ms): 1st at 50ms, 2nd at 150ms, 3rd at 250ms, 4th at 350ms
  // 🔥 USER BUG FIX: Return Promise that resolves when ALL spawns complete (spawnBounce callbacks run).
  // Previously returned immediately, causing merge6SpawnInProgress=false too early and checkLevelEnd to run
  // before new tiles were spawned → false fail screen when locked placeholders (value 0) were about to spawn.
  const spawnPromises: Promise<void>[] = [];
  let successfulSpawns = 0;
  for (let index = 0; index < picks.length; index++) {
    const t = picks[index];
    const delay = 50 + index * 100; // 50ms, 150ms, 250ms, 350ms...
    const spawnPromise = new Promise<void>((resolve, reject) => {
      let resolved = false;
      let countedSuccess = false;
      const clearSpawnFlag = () => {
        try {
          if (t && !t.destroyed) {
            (t as any)._isBeingSpawned = false;
          }
        } catch {}
      };
      try {
        if (t && !t.destroyed) {
          (t as any)._isBeingSpawned = true;
        }
      } catch {}
      const safeResolve = () => {
        if (resolved) return;
        resolved = true;
        pendingSpawnCancellers.delete(cancelForCleanup);
        clearSpawnFlag();
        resolve();
      };
      const cancelForCleanup = () => {
        if (resolved) return;
        resolved = true;
        pendingSpawnCancellers.delete(cancelForCleanup);
        clearSpawnFlag();
        reject(new LevelFlowCancelledError());
      };
      pendingSpawnCancellers.add(cancelForCleanup);
      const ensureActiveFullVisual = (tile: any, repairScale = false) => {
        try { gsap?.killTweensOf?.(tile, 'alpha'); } catch {}
        try { if (tile?.base) gsap?.killTweensOf?.(tile.base, 'alpha'); } catch {}
        try { if (tile?.rotG) gsap?.killTweensOf?.(tile.rotG, 'alpha'); } catch {}
        if (repairScale) {
          try { if (tile?.scale) gsap?.killTweensOf?.(tile.scale); } catch {}
          try {
            if (tile?.scale?.set) tile.scale.set(1, 1);
            else if (tile?.scale) {
              tile.scale.x = 1;
              tile.scale.y = 1;
            }
          } catch {}
        }
        try {
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
        } catch {}
      };
      const markSuccessfulSpawn = () => {
        if (!t || t.destroyed) return false;
        const tileValue = (t.value | 0);
        const isWildTile = isWildLikeTile(t);
        if (t.locked) return false;
        return tileValue > 0 || isWildTile;
      };
      const countSuccessOnce = () => {
        if (countedSuccess) return;
        if (markSuccessfulSpawn()) {
          countedSuccess = true;
          successfulSpawns++;
        }
      };
      const timeout = setTimeout(() => {
        if (generationAtStart !== levelFlowGeneration) {
          activeSpawnTimeouts.delete(timeout);
          safeResolve();
          return;
        }
        activeSpawnTimeouts.delete(timeout);
        // 🔥 CRITICAL: Check if tile still exists and is not destroyed before spawning
        if (!t || t.destroyed || !t.scale) {
          logger.debug('Spawn skipped: tile null/destroyed/no scale', 'level-flow', { destroyed: t?.destroyed, hasScale: !!t?.scale });
          safeResolve();
          return;
        }

        t.locked = false;
        makeBoard?.syncTileZIndex?.(t, (t as any)?.parent);
        t.eventMode = 'static';
        t.cursor = 'pointer';
        ensureActiveFullVisual(t);
        if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(t);

        resetTileToNormalState(t);

        // Smart spawning: if this is after wild merge, avoid the target number
        const spawnValue = randomRegularTileValue(wildMergeTarget || undefined);
        if (wildMergeTarget) logger.info('🎯 Smart spawn: avoiding', wildMergeTarget, 'spawning', spawnValue);

        // 🔥 CRITICAL: Check tile again before setValue (it might have been destroyed during resetTileToNormalState)
        if (!t || t.destroyed || !t.scale) {
          logger.debug('Spawn skipped: tile destroyed during resetTileToNormalState', 'level-flow');
          safeResolve();
          return;
        }

        makeBoard?.setValue?.(t, spawnValue, 0, { immediate: true });
        makeBoard?.syncTileZIndex?.(t, (t as any)?.parent);
        ensureActiveFullVisual(t);
        try { fixHoverAnchor?.(t); } catch {}

        if (!t || t.destroyed || !t.scale) {
          logger.debug('Spawn skipped: tile destroyed during setValue', 'level-flow');
          safeResolve();
          return;
        }

        // Count as soon as value + unlock are applied — GSAP/TNT can kill bounce timelines before onComplete,
        // which previously left successfulSpawns < picks.length and triggered bogus "remainder" spawns.
        countSuccessOnce();

        let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
        const onBounceComplete = () => {
          if (resolved || generationAtStart !== levelFlowGeneration) return;
          if (fallbackTimer != null) {
            clearTimeout(fallbackTimer);
            activeSpawnTimeouts.delete(fallbackTimer);
            fallbackTimer = null;
          }
          ensureActiveFullVisual(t, true);
          countSuccessOnce();
          const reinforce = setTimeout(() => {
            if (generationAtStart !== levelFlowGeneration) {
              activeSpawnTimeouts.delete(reinforce);
              return;
            }
            activeSpawnTimeouts.delete(reinforce);
            ensureActiveFullVisual(t, true);
          }, 160);
          activeSpawnTimeouts.add(reinforce);
          safeResolve();
        };
        if (spawnBounce) {
          spawnBounce(t, onBounceComplete, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035, timeScale: 2.0, keepFullOpacity: true });
          fallbackTimer = setTimeout(() => {
            if (generationAtStart !== levelFlowGeneration) {
              if (fallbackTimer != null) {
                activeSpawnTimeouts.delete(fallbackTimer);
                fallbackTimer = null;
              }
              safeResolve();
              return;
            }
            if (fallbackTimer != null) {
              activeSpawnTimeouts.delete(fallbackTimer);
              fallbackTimer = null;
            }
            ensureActiveFullVisual(t, true);
            countSuccessOnce();
            safeResolve();
          }, delay + 1200);
          activeSpawnTimeouts.add(fallbackTimer);
        } else {
          safeResolve();
        }
      }, delay);
      activeSpawnTimeouts.add(timeout);
    });
    spawnPromises.push(spawnPromise);
  }
  try { drawBoardBG?.(); } catch {}
  await Promise.all(spawnPromises);
  logger.debug(`🎯 openLockedBounceParallel: completed requested=${picks.length} successful=${successfulSpawns}`, 'level-flow');
  return successfulSpawns;
}
