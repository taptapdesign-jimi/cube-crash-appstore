/**
 * 🔥 CENTRALIZED END GAME CHECKER
 * 
 * This is the SINGLE SOURCE OF TRUTH for all end game conditions.
 * All other end game checks should be replaced with calls to this module.
 * 
 * Handles ALL edge cases:
 * - Clean board (0 active tiles)
 * - Last merge (wild + regular → merge 6, only merge 6 remains)
 * - Game stuck (no merges possible)
 * - Moves depleted (moves = 0, no merges possible)
 * - Wild cubes with no non-wild tiles
 * - Post-spawn stuck state
 * 
 * OPTIMIZED: Includes debouncing to prevent race conditions
 */

import { logger } from '../core/logger.js';

export type EndGameResult = 
  | { type: 'clean'; reason: string }
  | { type: 'stuck'; reason: string }
  | { type: 'continue'; reason: string };

export interface EndGameContext {
  tiles: any[];
  moves: number;
  makeBoard: {
    anyMergePossible: (tiles: any[]) => boolean;
  };
  // Optional: for last merge detection
  srcTile?: any;
  dstTile?: any;
  justRemovedSrc?: boolean;
  justRemovedDst?: boolean;
}

// Configuration constants
const DEBOUNCE_MS = 50; // 50ms debounce window
const MAX_MERGE_VALUE = 6; // Maximum merge value (merge 6)
const MIN_TILES_FOR_MERGE = 2; // Minimum total tiles needed for any merge
const DEFAULT_STACK_DEPTH = 1; // Default stack depth if not specified
const MAX_OSCILLATION_CYCLES = 10; // Maximum oscillation cycles for animations (if used)

// Debouncing system to prevent multiple simultaneous checks
let lastCheckTime = 0;
let lastCheckResult: EndGameResult | null = null;
let lastCheckContextHash: string = '';

// Cache for active tiles
let cachedActiveTiles: any[] = [];
let cachedTilesLength = 0;
let cachedTilesHash: string = '';

// Cache for tile categories (wild cubes, etc.)
let cachedTileCategories: {
  wildCubes: any[];
  wildStars: any[];
  magnets: any[];
  mergeableNonWildTiles: any[];
} | null = null;
let cachedCategoriesHash: string = '';

/**
 * Create a hash of tile array for cache invalidation
 * Uses tile references and key properties to detect changes
 * OPTIMIZED: Uses simple hash instead of full string concatenation for performance
 */
function tileIsWild(tile: any): boolean {
  if (!tile) return false;
  const special = tile.special;
  return special === 'wild' || special === 'wild-magnet' || special === 'wild-beer';
}

/**
 * 🔥 EXPORTED: Check if tile is active (can be merged/moved)
 * Used by app-core.ts and other modules for consistent tile filtering
 */
export function tileIsActive(tile: any): boolean {
  if (!tile || tile.destroyed) return false;
  if (tile.visible === false) return false;
  
  // 🔥 CRITICAL: Locked tiles with value > 0 are still active (e.g. during magnet pull)
  // Only exclude locked tiles with value 0 (ghost placeholders)
  const value = (tile.value | 0);
  if (value > 0) {
    return true; // Active regardless of locked status
  }
  
  // Wild tiles are active even if locked temporarily
  return tileIsWild(tile);
}

function createTilesHash(tiles: any[]): string {
  try {
    // OPTIMIZED: Use simple hash based on length + first few tile properties
    // This is much faster than concatenating all tile properties
    let hash = tiles.length.toString();
    
    // Only check first 10 tiles for hash (enough to detect changes)
    const checkCount = Math.min(10, tiles.length);
    for (let i = 0; i < checkCount; i++) {
      const t = tiles[i];
      if (!t) {
        hash += '|null';
        continue;
      }
      // Use key properties: value, locked, special
      const tileId = (t as any).uid || (t as any).gridX + '_' + (t as any).gridY || i;
      const aliveFlag = t.destroyed ? 'D' : 'A';
      const visibleFlag = t.visible === false ? 'H' : 'V';
      const modeFlag = t.eventMode === 'none' ? 'N' : 'S';
      hash += `|${tileId}:${(t.value|0)}:${t.locked ? 'L' : 'U'}:${aliveFlag}${visibleFlag}${modeFlag}:${t.special || 'none'}`;
    }
    
    // Add total count of active tiles for better hash uniqueness
    const activeCount = tiles.filter(tileIsActive).length;
    hash += `:active${activeCount}`;
    
    return hash;
  } catch {
    return `${tiles.length}_error`;
  }
}

/**
 * 🔥 EXPORTED: Get active tiles (not locked, value > 0)
 * OPTIMIZED: Cached result if tiles array hasn't changed
 * IMPROVED: Now checks tile references and properties, not just length
 * Used by app-core.ts and other modules for consistent tile filtering
 */
export function getActiveTiles(tiles: any[]): any[] {
  try {
    // Calculate current hash
    const currentHash = createTilesHash(tiles);

    // If hash changed OR length changed, recalculate
    if (currentHash !== cachedTilesHash || tiles.length !== cachedTilesLength) {
      console.log('🔄 EndGameChecker DIAGNOSTIC: Cache MISS - refreshing active tiles', {
        oldHash: cachedTilesHash.substring(0, 20) + '...',
        newHash: currentHash.substring(0, 20) + '...',
        oldLength: cachedTilesLength,
        newLength: tiles.length
      });
      cachedTilesHash = currentHash;
      cachedTilesLength = tiles.length;
      cachedActiveTiles = tiles.filter(tileIsActive);
      logger.debug('🔄 EndGameChecker: Active tiles cache refreshed', 'endgame-checker', {
        count: cachedActiveTiles.length,
        hash: currentHash.substring(0, 50) + '...'
      });
    } else {
      logger.debug('💾 EndGameChecker DIAGNOSTIC: Cache HIT - using cached active tiles', 'endgame-checker', {
        count: cachedActiveTiles.length,
        hash: currentHash.substring(0, 20) + '...'
      });
    }

    return cachedActiveTiles;
  } catch (error) {
    console.warn('⚠️ EndGameChecker: Error in getActiveTiles', error);
    return [];
  }
}

/**
 * Create a hash of context for caching
 * IMPROVED: Now includes tile values and properties, not just count
 */
function createContextHash(context: EndGameContext): string {
  const activeTiles = getActiveTiles(context.tiles);
  
  // Create detailed hash including tile values and properties
  // Sort tiles by value to ensure consistent hash regardless of order
  const tileSignature = activeTiles
    .map(t => {
      const value = (t.value|0);
      const special = t.special || 'none';
      const tileId = (t as any).uid || (t as any).gridX + '_' + (t as any).gridY || 'unknown';
      return `${value}_${special}_${tileId}`;
    })
    .sort()
    .join(',');
  
  const dstValue = context.dstTile?.value || 'none';
  const srcRemoved = context.justRemovedSrc ? 'src' : 'no';
  const dstRemoved = context.justRemovedDst ? 'dst' : 'no';
  
  return `${activeTiles.length}_[${tileSignature}]_${context.moves}_dst${dstValue}_${srcRemoved}_${dstRemoved}`;
}

/**
 * 🔥 REFACTORED: Check if this is a "last merge" scenario
 * Last merge = ALL remaining tiles merge to create merge 6, leaving only merge 6 on board
 * This includes:
 * - wild + regular tile → merge 6 (only 2 tiles on board)
 * - regular + regular → merge 6 (only 2 tiles on board, e.g. 4+2=6, 3+3=6)
 * - wild-beer + regular → merge 6 (only 2 tiles on board)
 * - Any wild type + regular → merge 6 (only 2 tiles on board)
 * 🔥 CRITICAL FIX: If magnet exists on board, it's NOT a last merge - user can still merge magnet with merge 6
 * 🔥 CRITICAL FIX: Include wild-beer in wild tile check (same as wild star)
 */
function isLastMergeScenario(context: EndGameContext): boolean {
  const { tiles, dstTile, srcTile, justRemovedSrc } = context;

  console.log('🔍 isLastMergeScenario: Checking last merge - justRemovedSrc:', justRemovedSrc, 'dstTile.value:', dstTile?.value, 'srcTile:', srcTile ? { value: srcTile.value, special: srcTile.special } : null);

  // Only check if we just removed src tile and dst is merge 6
  if (!justRemovedSrc || !dstTile || dstTile.value !== MAX_MERGE_VALUE) {
    logger.debug('🔍 isLastMergeScenario: Conditions not met for last merge check', 'endgame-checker');
    return false;
  }

  // Get active tiles excluding dst (after src was removed)
  const activeTiles = getActiveTiles(tiles).filter(t => t !== dstTile);

  logger.debug('🔍 isLastMergeScenario: Active tiles excluding dst', 'endgame-checker', { tiles: activeTiles.map(t => ({ value: t.value, special: t.special })) });

  // 🔥 CRITICAL FIX: If magnet exists on board as separate tile, it's NOT a last merge
  // User can still merge magnet with merge 6 to create final merge
  const hasMagnet = activeTiles.some(t => t.special === 'wild-magnet');
  if (hasMagnet) {
    console.log('🧲 isLastMergeScenario: Magnet detected on board - NOT a last merge');
    return false;
  }
  
  // 🔥 CRITICAL FIX: If merge 6 was created from magnet + last tile, check if it will pull tiles
  // If merge 6 was created from magnet and there are no tiles to pull, it IS a last merge
  // Check if merge 6 has _hasTilesToPull flag or _wildMagnetMergeCallback
  const merge6FromMagnet = (srcTile?.special === 'wild-magnet' || (dstTile as any)?._isWildMagnetMerge) && dstTile.value === MAX_MERGE_VALUE;
  if (merge6FromMagnet) {
    const hasTilesToPull = (dstTile as any)?._hasTilesToPull === true; // Only true means tiles will be pulled
    const hasMagnetCallback = !!(dstTile as any)?._wildMagnetMergeCallback;
    
    console.log('🧲 isLastMergeScenario: Merge 6 from magnet detected', {
      hasTilesToPull,
      hasMagnetCallback,
      _hasTilesToPull: (dstTile as any)?._hasTilesToPull,
      _wildMagnetMergeCallback: (dstTile as any)?._wildMagnetMergeCallback
    });
    
    // If magnet will pull tiles or has callback, NOT a last merge
    // If no tiles to pull and no callback, continue to check if only merge 6 remains
    if (hasTilesToPull || hasMagnetCallback) {
      console.log('🧲 isLastMergeScenario: Merge 6 from magnet will pull tiles - NOT a last merge');
      return false;
    } else {
      console.log('🧲 isLastMergeScenario: Merge 6 from magnet + last tile, no tiles to pull - continuing to check if last merge');
      // Continue to check if only merge 6 remains
    }
  }

  // If no other active tiles remain, this is the last merge
  if (activeTiles.length === 0 &&
      dstTile &&
      !dstTile.destroyed &&
      dstTile.value === MAX_MERGE_VALUE) {

    // Determine merge type for logging
    let mergeType = 'unknown';
    if (srcTile) {
      const srcIsWild = srcTile.special === 'wild' || srcTile.special === 'wild-beer' || srcTile.special === 'wild-magnet';
      const srcIsRegular = !srcTile.special && (srcTile.value|0) > 0;
      const dstIsRegular = !dstTile.special && (dstTile.value|0) > 0;
      const dstIsMerge6 = dstTile.value === MAX_MERGE_VALUE;

      if (srcIsWild && dstIsMerge6) {
        mergeType = 'magnet/wild + merge 6';
      } else if (srcIsWild && dstIsRegular) {
        mergeType = 'wild + regular';
      } else if (srcIsRegular && dstIsRegular && (srcTile.value|0) + (dstTile.value|0) === MAX_MERGE_VALUE) {
        mergeType = 'regular + regular';
      } else if (srcIsRegular && !dstIsRegular) {
        mergeType = 'regular + wild/special';
      } else if (srcIsWild) {
        mergeType = 'wild (any type) + tile';
      }
    }

    console.log(`✅ isLastMergeScenario: Last merge detected - ${mergeType} → merge 6, only merge 6 remains`);
    return true;
  }

  logger.debug('🔍 isLastMergeScenario: Not a last merge - active tiles remaining or conditions not met', 'endgame-checker');
  return false;
}

/**
 * Check if board is clean (0 active tiles)
 */
function isBoardCleanCheck(tiles: any[]): boolean {
  const activeTiles = getActiveTiles(tiles);
  return activeTiles.length === 0;
}

/**
 * Check if anyMergePossible indicates merges are available
 */
function checkAnyMergePossible(context: EndGameContext): boolean {
  const { makeBoard, tiles } = context;
  const canMerge = makeBoard.anyMergePossible(tiles);
  logger.debug('🔍 isGameStuck: anyMergePossible returned', 'endgame-checker', { canMerge });
  return canMerge;
}

/**
 * Count total tiles including stack depth
 */
function getTotalTileCount(activeTiles: any[]): number {
  return activeTiles.reduce((sum, t) => {
    const depth = (t as any).stackDepth || DEFAULT_STACK_DEPTH;
    return sum + depth;
  }, 0);
}

/**
 * Check if a single stack tile can merge with itself
 */
function canSingleStackMerge(activeTiles: any[], totalTilesCount: number): boolean | null {
  if (activeTiles.length !== 1 || totalTilesCount < MIN_TILES_FOR_MERGE) {
    return null; // Not applicable
  }

  const singleTile = activeTiles[0];
  const value = (singleTile.value | 0);
  const stackDepth = (singleTile as any).stackDepth || 1;

  console.log('🔍 isGameStuck: Single visible tile is a stack:', { value, stackDepth, totalTilesCount });

  // Special case: merge 6 with depth 1 cannot merge (already max)
  if (value === MAX_MERGE_VALUE && stackDepth === 1) {
    console.log('🚨 isGameStuck: Single merge 6 with depth 1 - DEFINITELY STUCK');
    return false;
  }

  // Check if stack can merge with itself (2 tiles from stack)
  const canMergeSelf = (value + value) <= MAX_MERGE_VALUE;

  if (canMergeSelf && stackDepth >= 2) {
    console.log('✅ isGameStuck: Stack can merge with itself (', value, '+', value, '=', value + value, '<= 6) - NOT stuck');
    return true;
  } else {
    console.log('🚨 isGameStuck: Stack CANNOT merge with itself (', value, '+', value, '=', value + value, '> 6) - IS STUCK');
    return false;
  }
}

/**
 * Get categorized tile counts for wild combinations check
 * OPTIMIZED: Cached result if activeTiles haven't changed
 */
function getTileCategories(activeTiles: any[]) {
  // Create a simple hash of activeTiles for caching
  const tilesHash = activeTiles.map(t => (t.value|0) + '_' + (t.special || 'none')).sort().join('|');

  if (cachedTileCategories && cachedCategoriesHash === tilesHash) {
    console.log('💾 getTileCategories: Using cached tile categories');
    return cachedTileCategories;
  }

  console.log('🔄 getTileCategories: Computing tile categories');
  const wildCubes = activeTiles.filter(t => t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer');
  const wildStars = activeTiles.filter(t => t.special === 'wild' || t.special === 'wild-beer');
  const magnets = activeTiles.filter(t => t.special === 'wild-magnet');

  const mergeableNonWildTiles = activeTiles.filter(t => {
    if (!t || t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer') return false;
    const value = (t.value|0);
    return value > 0 && value <= MAX_MERGE_VALUE; // Wild can merge with 1-6
  });

  cachedTileCategories = { wildCubes, wildStars, magnets, mergeableNonWildTiles };
  cachedCategoriesHash = tilesHash;

  return cachedTileCategories;
}

/**
 * Check if wild tile combinations allow continuation
 */
function checkWildCombinations(wildStars: any[], magnets: any[], mergeableNonWildTiles: any[]): boolean {
  console.log('🔍 isGameStuck: Wild stars:', wildStars.length, 'Magnets:', magnets.length, 'Total wild cubes:', wildStars.length + magnets.length, 'Mergeable non-wild tiles:', mergeableNonWildTiles.length);

  // If we have wild stars and any mergeable non-wild tiles (including merge 6), we can merge
  if (wildStars.length > 0 && mergeableNonWildTiles.length > 0) {
    console.log('✅ isGameStuck: Wild stars + regular tiles (including merge 6) present - guaranteed merge available');
    return true;
  }

  // If we have magnets and ANY other tiles (including wild stars), we can merge
  if (magnets.length > 0 && (mergeableNonWildTiles.length > 0 || wildStars.length > 0)) {
    console.log('✅ isGameStuck: Magnets + other tiles present - can pull and merge');
    console.log('✅ Details:', {
      magnetsCount: magnets.length,
      magnets: magnets.map(t => ({ value: t.value, gridX: (t as any).gridX, gridY: (t as any).gridY })),
      mergeableTilesCount: mergeableNonWildTiles.length,
      mergeableTiles: mergeableNonWildTiles.map(t => ({ value: t.value, gridX: (t as any).gridX, gridY: (t as any).gridY })),
      wildStarsCount: wildStars.length
    });
    return true;
  }

  return false;
}

/**
 * Check if game is stuck (no merges possible)
 * 🔥 REFACTORED: Broken into smaller, focused functions for better maintainability
 */
function isGameStuck(context: EndGameContext): boolean {
  const { tiles } = context;

  // First check: anyMergePossible
  if (checkAnyMergePossible(context)) {
    logger.debug('✅ isGameStuck: Merges possible, game is NOT stuck', 'endgame-checker');
    return false;
  }

  // Get active tiles for detailed analysis
  const activeTiles = getActiveTiles(tiles);
  console.log('🔍 isGameStuck: Active tiles count:', activeTiles.length, 'Details:', activeTiles.map(t => ({
    value: t.value,
    special: t.special,
    locked: t.locked,
    stackDepth: (t as any).stackDepth || 1
  })));

  // Second check: total tile count including stacks
  const totalTilesCount = getTotalTileCount(activeTiles);
  console.log('🔍 isGameStuck: Total tiles count (with stackDepth):', totalTilesCount, 'Visible tiles:', activeTiles.length);

  if (totalTilesCount < MIN_TILES_FOR_MERGE) {
    console.log('🚨 isGameStuck: Less than 2 total tiles, game IS STUCK');
    return true;
  }

  // Third check: single stack merging capability
  const singleStackResult = canSingleStackMerge(activeTiles, totalTilesCount);
  if (singleStackResult !== null) {
    return !singleStackResult; // If can merge, not stuck; if cannot, stuck
  }

  // Fourth check: wild tile combinations
  const { wildCubes, wildStars, magnets, mergeableNonWildTiles } = getTileCategories(activeTiles);

  if (checkWildCombinations(wildStars, magnets, mergeableNonWildTiles)) {
    return false;
  }

  // Fifth check: emergency rescue scenario
  if (wildCubes.length > 0 && mergeableNonWildTiles.length === 0) {
    console.log('✅ isGameStuck: Wild cubes but no non-wild tiles - emergency rescue will handle (NOT STUCK)');
    return false; // Not stuck - emergency rescue will spawn tiles
  }

  // If all checks fail, game is stuck
  console.log('🚨 isGameStuck: anyMergePossible returned FALSE and no edge cases apply - game IS STUCK');
  return true;
}

/**
 * Check if moves are depleted and game should end
 */
function isMovesDepleted(context: EndGameContext): boolean {
  return context.moves === 0;
}

/**
 * 🔥 MAIN END GAME CHECKER
 * 
 * This is the SINGLE entry point for all end game checks.
 * Returns the type of end game condition (or 'continue' if game should continue).
 * 
 * OPTIMIZED: Includes debouncing and caching to prevent redundant checks
 * IMPROVED: Added forceRefresh parameter for critical checks
 * 
 * @param context - The game context to check
 * @param forceRefresh - If true, bypasses debouncing and cache (for critical checks)
 */
export function checkEndGame(context: EndGameContext, forceRefresh: boolean = false): EndGameResult {
  const now = Date.now();
  const contextHash = createContextHash(context);
  
  // If forceRefresh is true, skip debouncing (for critical checks like after tile removal)
  if (!forceRefresh) {
    // Debouncing: if same context checked recently, return cached result
    // BUT: Only if hash matches exactly (meaning tiles haven't changed)
    if (now - lastCheckTime < DEBOUNCE_MS && contextHash === lastCheckContextHash && lastCheckResult) {
      console.log('🎯 EndGameChecker DIAGNOSTIC: Using CACHED result (debounced)', {
        timeSinceLastCheck: now - lastCheckTime,
        hash: contextHash.substring(0, 50) + '...',
        cachedResult: lastCheckResult
      });
      return lastCheckResult;
    } else {
      console.log('🎯 EndGameChecker DIAGNOSTIC: Debounce check failed - performing fresh check', {
        timeSinceLastCheck: now - lastCheckTime,
        hashMatch: contextHash === lastCheckContextHash,
        hasCachedResult: !!lastCheckResult
      });
    }
  } else {
    logger.debug('🔥 EndGameChecker: Force refresh requested - bypassing cache', 'endgame-checker');
  }
  
  const { tiles, moves, makeBoard } = context;
  
  logger.debug('🎯 EndGameChecker: Starting comprehensive end game check', 'endgame-checker');
  
  // 1. Check for last merge scenario (highest priority)
  if (isLastMergeScenario(context)) {
    console.log('🚨🚨🚨 EndGameChecker: LAST MERGE detected - wild + regular → merge 6, only merge 6 remains');
    lastCheckResult = { type: 'clean', reason: 'last_merge' };
    lastCheckTime = now;
    lastCheckContextHash = contextHash;
    return lastCheckResult;
  }
  
  // 2. Check if board is clean (0 active tiles)
  if (isBoardCleanCheck(tiles)) {
    console.log('🚨🚨🚨 EndGameChecker: BOARD IS CLEAN - 0 active tiles');
    lastCheckResult = { type: 'clean', reason: 'clean_board' };
    lastCheckTime = now;
    lastCheckContextHash = contextHash;
    return lastCheckResult;
  }

  // 🔥 CRITICAL FIX: Check for magnet/wild + merge6 combinations BEFORE moves check
  // These combinations allow continuation even with 0 moves
  const activeTiles = getActiveTiles(tiles);
  const hasMagnet = activeTiles.some(t => t.special === 'wild-magnet');
  const hasWild = activeTiles.some(t => t.special === 'wild' || t.special === 'wild-beer');
  const hasMerge6 = activeTiles.some(t => t.value === MAX_MERGE_VALUE);

  // 🔥 DIAGNOSTIC LOG: Check anyMergePossible result vs additional conditions
  const anyMergePossibleResult = makeBoard.anyMergePossible(tiles);
  logger.debug('🔍 EndGameChecker DIAGNOSTIC: anyMergePossible result', 'endgame-checker', { anyMergePossibleResult, hasMagnet, hasWild, hasMerge6 });

  // 🔥 CRITICAL: If magnet + merge6 exists, game can continue (magnet can merge with merge6)
  if (hasMagnet && hasMerge6) {
    console.log('🧲 EndGameChecker: Magnet + merge6 detected - game can continue (magnet can merge with merge6)');
    lastCheckResult = { type: 'continue', reason: 'magnet_can_merge_with_merge6' };
    lastCheckTime = now;
    lastCheckContextHash = contextHash;
    return lastCheckResult;
  }

  // 🔥 CRITICAL: If wild + merge6 exists, game can continue (wild can merge with merge6)
  if (hasWild && hasMerge6) {
    console.log('⭐ EndGameChecker: Wild + merge6 detected - game can continue (wild can merge with merge6)');
    lastCheckResult = { type: 'continue', reason: 'wild_can_merge_with_merge6' };
    lastCheckTime = now;
    lastCheckContextHash = contextHash;
    return lastCheckResult;
  }

  // 3. Check if moves are depleted
  if (isMovesDepleted(context)) {
    console.log('🎯 EndGameChecker: Moves depleted, checking if game is stuck...');

    // If moves = 0, check if game is stuck
    if (isGameStuck(context)) {
      console.log('🚨🚨🚨 EndGameChecker: MOVES DEPLETED + GAME STUCK');
      lastCheckResult = { type: 'stuck', reason: 'moves_depleted_stuck' };
      lastCheckTime = now;
      lastCheckContextHash = contextHash;
      return lastCheckResult;
    } else {
      console.log('✅ EndGameChecker: Moves depleted but merges still possible, game continues');
      lastCheckResult = { type: 'continue', reason: 'moves_depleted_but_can_merge' };
      lastCheckTime = now;
      lastCheckContextHash = contextHash;
      return lastCheckResult;
    }
  }

if (isGameStuck(context)) {
  console.log('🚨🚨🚨 EndGameChecker: GAME STUCK - no merges possible');

  // 🔥 REFACTORED: Uklonjen double-check - isGameStuck() već poziva anyMergePossible()
  // Ako isGameStuck() vraća true, znači da anyMergePossible() već vratio false
  // Nema potrebe za double-check-om

  // 🔥 CRITICAL FIX: If only 1 tile remains and it's not merge 6, it's stuck
  // This handles the case where user merges all spawned tiles into one non-6 tile
  if (activeTiles.length === 1 && activeTiles[0].value !== MAX_MERGE_VALUE) {
    console.log('🚨🚨🚨 EndGameChecker: SINGLE NON-6 TILE - DEFINITELY STUCK');
    lastCheckResult = { type: 'stuck', reason: 'single_non_6_tile' };
    lastCheckTime = now;
    lastCheckContextHash = contextHash;
    return lastCheckResult;
  }

  lastCheckResult = { type: 'stuck', reason: 'no_merges_possible' };
  lastCheckTime = now;
  lastCheckContextHash = contextHash;
  return lastCheckResult;
}
  
  // 5. Game continues
  logger.debug('✅ EndGameChecker: Game continues - merges possible', 'endgame-checker');
  lastCheckResult = { type: 'continue', reason: 'merges_possible' };
  lastCheckTime = now;
  lastCheckContextHash = contextHash;
  return lastCheckResult;
}

/**
 * Clear cache (call when tiles array changes significantly)
 * IMPROVED: Now also clears tiles hash cache and tile categories cache
 */
export function clearEndGameCache(): void {
  cachedActiveTiles = [];
  cachedTilesLength = 0;
  cachedTilesHash = '';
  cachedTileCategories = null;
  cachedCategoriesHash = '';
  lastCheckResult = null;
  lastCheckContextHash = '';
  logger.debug('🔄 EndGameChecker: All caches cleared', 'endgame-checker');
}

/**
 * Check if emergency rescue is needed (wild cubes but no non-wild tiles)
 */
export function needsEmergencyRescue(tiles: any[]): boolean {
  const activeTiles = getActiveTiles(tiles);
  const wildCubes = activeTiles.filter(t => t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer');
  const mergeableNonWildTiles = activeTiles.filter(t => {
    if (!t || t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer') return false;
    const value = (t.value|0);
    // 🔥 CRITICAL FIX: Wild CAN merge with merge 6! Include merge 6 in mergeable tiles
    return value > 0 && value <= MAX_MERGE_VALUE;
  });
  
  return wildCubes.length > 0 && mergeableNonWildTiles.length === 0;
}
