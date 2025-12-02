import { logger } from '../core/logger.js';
import { resetTileToNormalState } from './tile-state-utils.ts';
// public/src/modules/level-flow.ts

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

interface CheckGameOverParams {
  makeBoard?: MakeBoard;
  tiles?: Tile[];
  hasWildOnBoard?: () => boolean;
  getScore?: () => number;
  setScore?: (score: number) => void;
  bestScore?: number;
  updateBest?: (score: number) => void;
  updateHUD?: () => void;
  ENDLESS?: boolean;
  showStarsModal?: (params: any) => Promise<{ pass: boolean }>;
  app?: any;
  stage?: any;
  board?: any;
  level?: number;
  startLevel?: (level: number) => void;
  animateScore?: (score: number) => void;
  wildAPI?: any;
  openEmpties?: () => void;
  // 🔥 REMOVED: isBoardClean - deprecated, use checkEndGame() from endgame-checker.ts
  gsap?: any;
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

  // 🔥 CRITICAL FIX: Procedural spawn with fast cascading animations (same as magnet merge spawn)
  // spawnBounce animation takes ~0.24s (with timeScale 2.0), delay is 30ms for very fast cascading
  // Each tile starts when previous is at 12.5% of its animation - creates very fast cascading effect
  // Sequential spawning: 1st at 0ms, 2nd at 30ms, 3rd at 60ms, 4th at 90ms
  // 🔥 CRITICAL: Use setTimeout instead of await to allow parallel execution (same as magnet pull)
  for (let index = 0; index < picks.length; index++) {
    const t = picks[index];
    const delay = index * 30; // 0ms, 30ms, 60ms, 90ms...
    
    // 🔥 CRITICAL: Use setTimeout to schedule spawn without blocking
    // This allows all tiles to be scheduled with delays, but animations run concurrently
    setTimeout(() => {
      // 🔥 CRITICAL: Check if tile still exists and is not destroyed before spawning
      if (!t || t.destroyed || !t.scale) {
        console.warn('⚠️ Spawn skipped: tile is null, destroyed, or has no scale', { tile: t, destroyed: t?.destroyed, hasScale: !!t?.scale });
        return;
      }
      
      t.locked=false; 
      // t.eventMode='static'; 
      // t.cursor='pointer';
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
        console.warn('⚠️ Spawn skipped: tile destroyed during resetTileToNormalState');
        return;
      }
      
      makeBoard?.setValue?.(t, spawnValue, 0);
      try { fixHoverAnchor?.(t); } catch {}
      
      // 🔥 CRITICAL: Final check before spawnBounce (tile might have been destroyed during setValue)
      if (!t || t.destroyed || !t.scale) {
        console.warn('⚠️ Spawn skipped: tile destroyed during setValue');
        return;
      }
      
      // 🔥 CRITICAL: Use timeScale: 2.0 to make spawn animation 50% faster (2x speed = half duration)
      // Same as magnet merge spawn for consistent feel
      spawnBounce?.(t, () => {}, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035, timeScale: 2.0 });
    }, delay);
  }
  try { drawBoardBG?.(); } catch {}
}

// 🔥 REMOVED: checkGameOver function - DEPRECATED, use checkEndGame() from endgame-checker.ts instead
// This old function showed the "Level Complete" overlay which is no longer used.
// All end game logic now goes through the centralized endgame-checker.ts system.
// If this function is still being called somewhere, it means there's dead code that needs to be removed.
export async function checkGameOver({
  makeBoard, tiles, hasWildOnBoard,
  getScore, setScore, bestScore, updateBest, updateHUD, ENDLESS,
  showStarsModal, app, stage, board,
  level, startLevel,
  animateScore,
  wildAPI, openEmpties, gsap
}: CheckGameOverParams = {}): Promise<void> {
  // 🔥 DEPRECATED: This function is no longer used and should not be called.
  // All end game checks now use checkEndGame() from endgame-checker.ts.
  // This function used to show the old "Level Complete" overlay (showStarsModal),
  // which has been replaced with board-fail-modal.ts and clean-board-modal.ts.
  console.warn('⚠️ DEPRECATED: checkGameOver from level-flow.ts was called. This is dead code and should be removed. Use checkEndGame() from endgame-checker.ts instead.');
  
  // Do nothing - this prevents the old "Level Complete" overlay from appearing
  return;
}
