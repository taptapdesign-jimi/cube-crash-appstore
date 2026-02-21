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
  excludeCells = new Set<string>()  // 🔥 CRITICAL: Exclude cells where pulled tiles were
}: OpenLockedBounceParallelParams = {}): Promise<void> {
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
  
  if (!locked.length || k <= 0) return;

  // 🔥 REVERTED: Back to old logic - no prioritization, just random shuffle and pick
  // This ensures all k tiles are spawned correctly
  for (let i=locked.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [locked[i],locked[j]]=[locked[j],locked[i]]; }
  const picks = locked.slice(0, Math.min(k, locked.length));

  // 🔥 CRITICAL FIX: Procedural spawn with cascading animations – 150ms between tiles
  // spawnBounce animation takes ~0.24s (with timeScale 2.0), delay 150ms between tiles for visible one-by-one
  // Sequential spawning: 1st at 0ms, 2nd at 150ms, 3rd at 300ms, 4th at 450ms
  // 🔥 CRITICAL: Use setTimeout instead of await to allow parallel execution (same as magnet pull)
  for (let index = 0; index < picks.length; index++) {
    const t = picks[index];
    const delay = index * 150; // 0ms, 150ms, 300ms, 450ms...
    
    // 🔥 CRITICAL: Use setTimeout to schedule spawn without blocking
    // This allows all tiles to be scheduled with delays, but animations run concurrently
    // 🔥 FIX: Track timeout for cleanup
    const timeout = setTimeout(() => {
      activeSpawnTimeouts.delete(timeout);
      // 🔥 CRITICAL: Check if tile still exists and is not destroyed before spawning
      if (!t || t.destroyed || !t.scale) {
        logger.debug('Spawn skipped: tile null/destroyed/no scale', 'level-flow', { destroyed: t?.destroyed, hasScale: !!t?.scale });
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
        // Import pickWildValue function (assuming it's available globally or we need to pass it)
        const candidates = [1,2,3,4,5].filter(v => v !== wildMergeTarget);
        spawnValue = candidates[(Math.random() * candidates.length) | 0];
        logger.info('🎯 Smart spawn: avoiding', wildMergeTarget, 'spawning', spawnValue);
      } else {
        spawnValue = [1,2,3,4,5][(Math.random()*5)|0];
      }
      
      // 🔥 CRITICAL: Check tile again before setValue (it might have been destroyed during resetTileToNormalState)
      if (!t || t.destroyed || !t.scale) {
        logger.debug('Spawn skipped: tile destroyed during resetTileToNormalState', 'level-flow');
        return;
      }
      
      makeBoard?.setValue?.(t, spawnValue, 0);
      ensureActiveFullOpacity(t);
      try { fixHoverAnchor?.(t); } catch {}

      if (!t || t.destroyed || !t.scale) {
        logger.debug('Spawn skipped: tile destroyed during setValue', 'level-flow');
        return;
      }

      spawnBounce?.(t, () => {
        ensureActiveFullOpacity(t);
        const reinforce = setTimeout(() => {
          ensureActiveFullOpacity(t);
        }, 160);
        activeSpawnTimeouts.add(reinforce);
      }, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035, timeScale: 2.0, keepFullOpacity: true });
    }, delay);
    activeSpawnTimeouts.add(timeout);
  }
  try { drawBoardBG?.(); } catch {}
}
