// @ts-nocheck
import { logger } from '../core/logger.js';
import { resetTileToNormalState } from './tile-state-utils.ts';
// public/src/modules/level-flow.ts

// 🔥 FIX: Track spawn timeouts for cleanup
const activeSpawnTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

/**
 * Cleanup all spawn timeouts
 * Call this when game ends or app is destroyed
 */
export function cleanupLevelFlowTimeouts(): void {
  activeSpawnTimeouts.forEach(timeout => {
    try { clearTimeout(timeout); } catch {}
  });
  activeSpawnTimeouts.clear();
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
  setValue?: (tile: Tile, value: number, stackDepth: number) => void;
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


interface WindowWithUpdateHighScore extends Window {
  updateHighScore?: (score: number) => void;
}

declare let window: WindowWithUpdateHighScore;

export function checkLevelEnd({ makeBoard, tiles, onCleanBoard }: CheckLevelEndParams = {}): void {
  if (!makeBoard?.anyMergePossible || !Array.isArray(tiles)) return;
  if (!makeBoard.anyMergePossible(tiles)) onCleanBoard?.();
}

export async function openLockedBounceParallel({ 
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
  excludeCells = new Set<string>(),  // 🔥 CRITICAL: Exclude cells where pulled tiles were
  preferCells = new Set<string>()    // 🔥 CRITICAL: For regular merge 6 – prioritize placeholder at merge location
}: OpenLockedBounceParallelParams = {}): Promise<number> {
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
    logger.warn(`🎯 openLockedBounceParallel: early return - locked=${locked.length} k=${k}`, 'level-flow');
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

  logger.warn(`🎯 openLockedBounceParallel: locked=${locked.length} picks=${picks.length} k=${k}`, 'level-flow');
  // 🔥 CRITICAL FIX: Procedural spawn with cascading animations – 150ms between tiles
  // spawnBounce animation takes ~0.24s (with timeScale 2.0), delay 150ms between tiles for visible one-by-one
  // Sequential spawning: 1st at 0ms, 2nd at 150ms, 3rd at 300ms, 4th at 450ms
  // 🔥 USER BUG FIX: Return Promise that resolves when ALL spawns complete (spawnBounce callbacks run).
  // Previously returned immediately, causing merge6SpawnInProgress=false too early and checkLevelEnd to run
  // before new tiles were spawned → false fail screen when locked placeholders (value 0) were about to spawn.
  const spawnPromises: Promise<void>[] = [];
  for (let index = 0; index < picks.length; index++) {
    const t = picks[index];
    const delay = index * 150; // 0ms, 150ms, 300ms, 450ms...
    const spawnPromise = new Promise<void>((resolve) => {
      let resolved = false;
      const safeResolve = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };
      const timeout = setTimeout(() => {
        activeSpawnTimeouts.delete(timeout);
        // 🔥 CRITICAL: Check if tile still exists and is not destroyed before spawning
        if (!t || t.destroyed || !t.scale) {
          logger.debug('Spawn skipped: tile null/destroyed/no scale', 'level-flow', { destroyed: t?.destroyed, hasScale: !!t?.scale });
          safeResolve();
          return;
        }

        const ensureActiveFullOpacity = (tile: any) => {
          try { gsap?.killTweensOf?.(tile, 'alpha'); } catch {}
          try { if (tile?.base) gsap?.killTweensOf?.(tile.base, 'alpha'); } catch {}
          try { if (tile?.rotG) gsap?.killTweensOf?.(tile.rotG, 'alpha'); } catch {}
          try {
            tile.alpha = 1;
            if (tile.rotG) tile.rotG.alpha = 1;
            if (tile.base) tile.base.alpha = 1;
            if (tile.overlay) {
              tile.overlay.alpha = 1;
              tile.overlay.visible = false;
            }
            if (tile.num) tile.num.alpha = 1;
            if (tile.pips) tile.pips.alpha = 1;
          } catch {}
        };

        t.locked = false;
        t.eventMode = 'static';
        t.cursor = 'pointer';
        ensureActiveFullOpacity(t);
        if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(t);

        resetTileToNormalState(t);

        // Smart spawning: if this is after wild merge, avoid the target number
        let spawnValue: number;
        if (wildMergeTarget) {
          const candidates = [1,2,3,4,5].filter(v => v !== wildMergeTarget);
          spawnValue = candidates[(Math.random() * candidates.length) | 0];
          logger.info('🎯 Smart spawn: avoiding', wildMergeTarget, 'spawning', spawnValue);
        } else {
          spawnValue = [1,2,3,4,5][(Math.random()*5)|0];
        }

        // 🔥 CRITICAL: Check tile again before setValue (it might have been destroyed during resetTileToNormalState)
        if (!t || t.destroyed || !t.scale) {
          logger.debug('Spawn skipped: tile destroyed during resetTileToNormalState', 'level-flow');
          safeResolve();
          return;
        }

        makeBoard?.setValue?.(t, spawnValue, 0);
        ensureActiveFullOpacity(t);
        try { fixHoverAnchor?.(t); } catch {}

        if (!t || t.destroyed || !t.scale) {
          logger.debug('Spawn skipped: tile destroyed during setValue', 'level-flow');
          safeResolve();
          return;
        }

        const onBounceComplete = () => {
          ensureActiveFullOpacity(t);
          const reinforce = setTimeout(() => {
            ensureActiveFullOpacity(t);
          }, 160);
          activeSpawnTimeouts.add(reinforce);
          safeResolve();
        };
        if (spawnBounce) {
          spawnBounce(t, onBounceComplete, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035, timeScale: 2.0, keepFullOpacity: true });
        } else {
          safeResolve();
        }
      }, delay);
      activeSpawnTimeouts.add(timeout);

      // Fail-safe: resolve even if spawnBounce never calls back
      const fallback = setTimeout(() => {
        activeSpawnTimeouts.delete(fallback);
        safeResolve();
      }, delay + 1200);
      activeSpawnTimeouts.add(fallback);
    });
    spawnPromises.push(spawnPromise);
  }
  try { drawBoardBG?.(); } catch {}
  await Promise.all(spawnPromises);
  return picks.length;
}
