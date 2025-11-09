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

// Debouncing system to prevent multiple simultaneous checks
let lastCheckTime = 0;
let lastCheckResult: EndGameResult | null = null;
let lastCheckContextHash: string = '';
const DEBOUNCE_MS = 50; // 50ms debounce window

// Cache for active tiles
let cachedActiveTiles: any[] = [];
let cachedTilesLength = 0;
let cachedTilesHash: string = '';

/**
 * Create a hash of tile array for cache invalidation
 * Uses tile references and key properties to detect changes
 * OPTIMIZED: Uses simple hash instead of full string concatenation for performance
 */
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
      hash += `|${tileId}:${(t.value|0)}:${t.locked ? 'L' : 'U'}:${t.special || 'none'}`;
    }
    
    // Add total count of active tiles for better hash uniqueness
    const activeCount = tiles.filter(t => t && !t.locked && (t.value|0) > 0).length;
    hash += `:active${activeCount}`;
    
    return hash;
  } catch {
    return `${tiles.length}_error`;
  }
}

/**
 * Get active tiles (not locked, value > 0)
 * OPTIMIZED: Cached result if tiles array hasn't changed
 * IMPROVED: Now checks tile references and properties, not just length
 */
function getActiveTiles(tiles: any[]): any[] {
  try {
    // Calculate current hash
    const currentHash = createTilesHash(tiles);
    
    // If hash changed OR length changed, recalculate
    if (currentHash !== cachedTilesHash || tiles.length !== cachedTilesLength) {
      cachedTilesHash = currentHash;
      cachedTilesLength = tiles.length;
      cachedActiveTiles = tiles.filter(t => t && !t.locked && (t.value|0) > 0);
      console.log('🔄 EndGameChecker: Active tiles cache refreshed', {
        count: cachedActiveTiles.length,
        hash: currentHash.substring(0, 50) + '...'
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
 * Check if this is a "last merge" scenario
 * Last merge = wild + regular tile merge to create merge 6, leaving only merge 6 on board
 */
function isLastMergeScenario(context: EndGameContext): boolean {
  const { tiles, dstTile, justRemovedSrc } = context;
  
  // Only check if we just removed src tile and dst is merge 6
  if (!justRemovedSrc || !dstTile || dstTile.value !== 6) {
    return false;
  }
  
  // Get active tiles excluding dst
  const activeTiles = getActiveTiles(tiles).filter(t => t !== dstTile);
  
  // If no other active tiles remain, this is the last merge
  if (activeTiles.length === 0 && 
      dstTile && 
      !dstTile.destroyed && 
      dstTile.value === 6) {
    return true;
  }
  
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
 * Check if game is stuck (no merges possible)
 * 🔥 SIMPLIFIED: Trusts anyMergePossible completely - no redundant checks
 */
function isGameStuck(context: EndGameContext): boolean {
  const { tiles, makeBoard } = context;
  
  // 🔥 CRITICAL: Trust anyMergePossible completely - it already handles all cases
  const canMerge = makeBoard.anyMergePossible(tiles);
  console.log('🔍 isGameStuck: anyMergePossible returned:', canMerge);
  
  if (canMerge) {
    console.log('✅ isGameStuck: Merges possible, game is NOT stuck');
    return false;
  }
  
  // If anyMergePossible returns false, we're stuck
  // But let's verify active tiles count for logging purposes
  const activeTiles = getActiveTiles(tiles);
  console.log('🔍 isGameStuck: Active tiles count:', activeTiles.length, 'Details:', activeTiles.map(t => ({ 
    value: t.value, 
    special: t.special, 
    locked: t.locked,
    stackDepth: (t as any).stackDepth || 1
  })));
  
  // If less than 2 tiles, we're definitely stuck
  if (activeTiles.length < 2) {
    console.log('🚨 isGameStuck: Less than 2 active tiles, game IS STUCK');
    return true;
  }
  
  // Check for wild cubes edge case (emergency rescue scenario)
  const wildCubes = activeTiles.filter(t => t.special === 'wild' || t.special === 'wild-magnet');
  const nonWildTiles = activeTiles.filter(t => t.special !== 'wild' && t.special !== 'wild-magnet');
  
  console.log('🔍 isGameStuck: Wild cubes:', wildCubes.length, 'Non-wild tiles:', nonWildTiles.length);
  
  // If we have wild cubes but no non-wild tiles, emergency rescue will handle this
  if (wildCubes.length > 0 && nonWildTiles.length === 0) {
    console.log('✅ isGameStuck: Wild cubes but no non-wild tiles - emergency rescue will handle (NOT STUCK)');
    return false; // Not stuck - emergency rescue will spawn tiles
  }
  
  // If anyMergePossible returned false, we're stuck (it already checked all merge possibilities)
  console.log('🚨 isGameStuck: anyMergePossible returned FALSE - game IS STUCK');
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
      console.log('🎯 EndGameChecker: Using cached result (debounced)', {
        timeSinceLastCheck: now - lastCheckTime,
        hash: contextHash.substring(0, 50) + '...'
      });
      return lastCheckResult;
    }
  } else {
    console.log('🔥 EndGameChecker: Force refresh requested - bypassing cache');
  }
  
  const { tiles, moves, makeBoard } = context;
  
  console.log('🎯 EndGameChecker: Starting comprehensive end game check...');
  
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
  
  // 4. Check if game is stuck (no merges possible)
  if (isGameStuck(context)) {
    console.log('🚨🚨🚨 EndGameChecker: GAME STUCK - no merges possible');
    lastCheckResult = { type: 'stuck', reason: 'no_merges_possible' };
    lastCheckTime = now;
    lastCheckContextHash = contextHash;
    return lastCheckResult;
  }
  
  // 5. Game continues
  console.log('✅ EndGameChecker: Game continues - merges possible');
  lastCheckResult = { type: 'continue', reason: 'merges_possible' };
  lastCheckTime = now;
  lastCheckContextHash = contextHash;
  return lastCheckResult;
}

/**
 * Clear cache (call when tiles array changes significantly)
 * IMPROVED: Now also clears tiles hash cache
 */
export function clearEndGameCache(): void {
  cachedActiveTiles = [];
  cachedTilesLength = 0;
  cachedTilesHash = '';
  lastCheckResult = null;
  lastCheckContextHash = '';
  console.log('🔄 EndGameChecker: All caches cleared (active tiles, result cache, hash cache)');
}

/**
 * Check if emergency rescue is needed (wild cubes but no non-wild tiles)
 */
export function needsEmergencyRescue(tiles: any[]): boolean {
  const activeTiles = getActiveTiles(tiles);
  const wildCubes = activeTiles.filter(t => t.special === 'wild' || t.special === 'wild-magnet');
  const nonWildTiles = activeTiles.filter(t => t.special !== 'wild' && t.special !== 'wild-magnet');
  
  return wildCubes.length > 0 && nonWildTiles.length === 0;
}

