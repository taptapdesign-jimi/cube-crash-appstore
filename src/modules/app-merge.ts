// src/modules/app-merge.js
import { gsap } from 'gsap';
import { STATE, ENDLESS, REFILL_ON_SIX_BY_DEPTH } from './app-state.js';
import * as makeBoard from './board.js';
import { glassCrackAtTile, woodShardsAtTile, spawnMerge6Shards, innerFlashAtTile, showMultiplierTile, screenShake, wildImpactEffect, smokeBubblesAtTile, stopWildIdle } from './fx.js';
import { COLS, ROWS, TILE, GAP } from './constants.js';
import * as HUD from './hud-helpers.js';
import { openAtCell, openEmpties, spawnBounce } from './app-spawn.ts';
import { showStarsModal } from './stars-modal.js';
import { showBoardFailModal } from './board-fail-modal.js';
import { rebuildBoard } from './app-board.js';
import { drawBoardBG } from './app-core.js';
import { statsService } from '../services/stats-service.js';

// Import updateProgressBar function
const updateProgressBar = HUD.updateProgressBar;
const updateHUD = () => {
  try {
    if (typeof HUD.updateHUD === 'function') { 
      HUD.updateHUD({ score: STATE.score, board: 1, moves: STATE.moves, combo: 0 }); 
    }
  } catch (error) {
    console.error('❌ Error calling HUD.updateHUD:', error);
  }
};
const animateScore = (toValue, duration = 0.45) => {
  try {
    if (typeof HUD.animateScore === 'function') {
      HUD.animateScore({ 
        scoreRef: () => STATE.score, 
        setScore: v => { STATE.score = v; updateHUD(); }, 
        updateHUD, 
        SCORE_CAP: 999999, 
        gsap 
      }, toValue, duration);
    }
  } catch (error) {
    console.error('❌ Error calling HUD.animateScore:', error);
  }
};
// drawBoardBG is imported from app.js

function triggerCentralEndgameCheck(source = 'app-merge'): boolean {
  const checker = (window as any)?.CC?.checkLevelEnd;
  if (typeof checker !== 'function') return false;
  try {
    console.log(`🎯 triggerCentralEndgameCheck invoked from ${source}`);
    checker();
    return true;
  } catch (error) {
    console.warn(`⚠️ triggerCentralEndgameCheck failed (${source})`, error);
    return false;
  }
}

function play(name, vol=null){ /* muted */ }

function tileIsWild(tile: any): boolean {
  if (!tile) return false;
  const special = tile.special;
  return special === 'wild' || special === 'wild-magnet' || tile.isWild === true || tile.isWildFace === true;
}

function tileIsActive(tile: any): boolean {
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
function removeTile(t){
  if(!t) return;
  try { stopWildIdle?.(t); } catch {}
  try { if (t.hover?.clear) t.hover.clear(); } catch {}
  t.eventMode='none'; t.removeAllListeners?.();
  try{ gsap.killTweensOf(t); gsap.killTweensOf(t.scale); gsap.killTweensOf(t.rotG);}catch{}
  STATE.board.removeChild(t);
  STATE.tiles = STATE.tiles.filter(x=>x!==t);
  t.destroy?.({children:true, texture:false, textureSource:false});
}

export function clearWildState(tile){
  if (!tile) return;
  try { stopWildIdle(tile); } catch {}
  // Only clear wild state if it's a regular wild (not wild-magnet, which keeps its special property)
  if (tile.special === 'wild') {
    tile.special = null;
  }
  // For wild-magnet, we keep special='wild-magnet' but clear other wild properties
  tile.isWild = false;
  tile.isWildFace = false;
  if (tile.num) tile.num.visible = true;
  if (tile.pips) tile.pips.visible = true;
  if (tile.base) {
    try { tile.base.tint = 0xFFFFFF; tile.base.alpha = 1; } catch {}
  }
}

function pulseBoardZoom(factor = 0.92, opts = {}) {
  const board = STATE.board;
  if (!board) return;
  try { board._wildZoomTl?.kill?.(); } catch {}

  const baseW = COLS * TILE + (COLS - 1) * GAP;
  const baseH = ROWS * TILE + (ROWS - 1) * GAP;
  const sx0 = board.scale?.x ?? 1;
  const sy0 = board.scale?.y ?? 1;
  const x0 = board.x ?? 0;
  const y0 = board.y ?? 0;

  const displayW = baseW * sx0;
  const displayH = baseH * sy0;

  const scaleFactor = Math.max(0.75, Math.min(0.99, factor));
  const translateFactor = Math.max(0, Math.min(1, opts.translateFactor ?? 0.4));
  const userOnComplete = typeof opts.onComplete === 'function' ? opts.onComplete : null;
  const dx = ((displayW - displayW * scaleFactor) / 2) * translateFactor;
  const dy = ((displayH - displayH * scaleFactor) / 2) * translateFactor;

  const outDur = opts.outDur ?? 0.12;
  const inDur  = opts.inDur  ?? 0.22;

  const tl = gsap.timeline({ onComplete: () => { board._wildZoomTl = null; try { userOnComplete?.(); } catch {} } });

  tl.to(board.scale, {
    x: sx0 * scaleFactor,
    y: sy0 * scaleFactor,
    duration: outDur,
    ease: opts.outEase ?? 'power3.out'
  }, 0);

  tl.to(board, {
    x: x0 + dx,
    y: y0 + dy,
    duration: outDur,
    ease: opts.outEase ?? 'power3.out'
  }, 0);

  const hold = opts.hold ?? 0.05;

  tl.to(board.scale, {
    x: sx0,
    y: sy0,
    duration: inDur,
    ease: opts.inEase ?? 'elastic.out(1, 0.6)'
  }, `>${hold}`);

  tl.to(board, {
    x: x0,
    y: y0,
    duration: inDur,
    ease: opts.inEase ?? 'elastic.out(1, 0.6)'
  }, `>${hold}`);

  board._wildZoomTl = tl;
  return tl;
}

function wobble(t){ const x0=t.x;
  gsap.timeline().to(t,{x:x0+9,rotation:0.06,duration:0.06})
                 .to(t,{x:x0-9,rotation:-0.06,duration:0.08})
                 .to(t,{x:x0,rotation:0,duration:0.08});
}
function landBounce(t){
  const r0 = t.rotG?.rotation || 0;
  gsap.killTweensOf(t.scale); gsap.killTweensOf(t.rotG);
  // nježniji, elastičniji povrat
  gsap.timeline()
    .to(t.scale, { x:1.10, y:0.94, duration:0.07, ease:'power2.out' })
    .to(t.scale, { x:1.00, y:1.00, duration:0.24, ease:'elastic.out(1,0.8)' });
  if (t.rotG){
    gsap.timeline()
      .to(t.rotG, { rotation: r0 + 0.05, duration: 0.06, ease:'power2.out' }, 0)
      .to(t.rotG, { rotation: r0,        duration: 0.20, ease:'elastic.out(1,0.8)' });
  }
}
function landPreBounce(t){
  return new Promise((resolve)=>{
    const r0 = t.rotG?.rotation || 0;
    gsap.killTweensOf(t.scale); gsap.killTweensOf(t.rotG);
    gsap.timeline({ onComplete: resolve })
      .to(t.scale, { x:1.10, y:0.94, duration:0.05, ease:'power3.out' })
      .to(t.scale, { x:1.00, y:1.00, duration:0.07, ease:'back.out(2)' });
    if (t.rotG){
      gsap.timeline()
        .to(t.rotG, { rotation: r0 + 0.05, duration: 0.05, ease:'power2.out' }, 0)
        .to(t.rotG, { rotation: r0,        duration: 0.07, ease:'back.out(2)' });
    }
  });
}

// Helper function to find nearest tiles to a target position
function findNearestTiles(targetTile: any, count: number = 2): any[] {
  const allTiles = STATE.tiles || [];
  const targetX = targetTile.gridX;
  const targetY = targetTile.gridY;
  
  // Filter: active tiles (not locked, has value, not the target, not wild-magnet itself)
  const candidates = allTiles.filter((t: any) => {
    if (!t || t.destroyed) return false;
    if (t.locked) return false;
    if ((t.value | 0) <= 0) return false;
    if (t === targetTile) return false;
    if (t.special === 'wild-magnet') return false; // Don't attract other wild-magnets
    return true;
  });
  
  // Calculate distances and sort
  const withDistance = candidates.map((t: any) => {
    const dx = (t.gridX | 0) - targetX;
    const dy = (t.gridY | 0) - targetY;
    const dist = Math.hypot(dx, dy);
    return { tile: t, distance: dist };
  });
  
  withDistance.sort((a, b) => a.distance - b.distance);
  
  // Return random 2 from the nearest ones (or all if less than count)
  const nearestCount = Math.min(count * 2, withDistance.length); // Take more candidates for randomness
  const randomSelection = withDistance.slice(0, nearestCount)
    .sort(() => Math.random() - 0.5) // Shuffle
    .slice(0, count) // Take first 2
    .map(item => item.tile);
  
  return randomSelection;
}

// Helper function to animate magnet pull (attract tile to target)
function animateMagnetPull(tile: any, targetTile: any): Promise<void> {
  return new Promise((resolve) => {
    if (!tile || !targetTile || tile.destroyed || targetTile.destroyed) {
      resolve();
      return;
    }
    
    const targetX = targetTile.x;
    const targetY = targetTile.y;
    
    // Animate tile moving to target position
    gsap.to(tile, {
      x: targetX,
      y: targetY,
      duration: 0.4,
      ease: 'power2.out',
      onComplete: () => {
        resolve();
      }
    });
  });
}

// Function to add 4x multiplier animations to existing merge 6 tile
// All pulled tiles are removed, and animations are applied to the existing merge 6 tile
/**
 * 🔥 CRITICAL: Check if all tiles on the board can be merged together
 * This simulates all possible merges to determine if the board can be completely cleared
 * Returns true if all tiles can be merged and the final merge is merge 6
 */
async function checkIfAllTilesCanMerge(tiles: any[], helpers: any): Promise<boolean> {
  // Get active tiles only
  const activeTiles = tiles.filter((t: any) => t && !t.locked && (t.value|0) > 0);
  
  if (activeTiles.length === 0) {
    return true; // Board is already clean
  }
  
  if (activeTiles.length === 1) {
    // Only one tile left - check if it's merge 6
    return activeTiles[0].value === 6;
  }
  
  // Simulate merges by creating a copy of tile values
  const tileValues = activeTiles.map((t: any) => ({
    value: t.value|0,
    isWild: t.special === 'wild' || t.special === 'wild-magnet',
    original: t
  }));
  
  // Try to simulate all possible merges
  // This is a simplified check - we try to merge tiles until we can't merge anymore
  let currentTiles = [...tileValues];
  let mergeCount = 0;
  const maxIterations = 100; // Safety limit
  
  while (currentTiles.length > 1 && mergeCount < maxIterations) {
    let merged = false;
    
    // Try to find a valid merge
    for (let i = 0; i < currentTiles.length; i++) {
      for (let j = i + 1; j < currentTiles.length; j++) {
        const tile1 = currentTiles[i];
        const tile2 = currentTiles[j];
        
        // Check if tiles can merge
        const canMerge = 
          tile1.isWild || tile2.isWild || // Wild can merge with anything
          (tile1.value + tile2.value >= 2 && tile1.value + tile2.value <= 6); // Regular merge
        
        if (canMerge) {
          // Simulate merge
          // Wild merge always results in merge 6
          const newValue = (tile1.isWild || tile2.isWild) ? 6 : Math.min(6, tile1.value + tile2.value);
          const newIsWild = false; // After merge, wild is consumed
          
          // Remove merged tiles and add new merged tile
          currentTiles = currentTiles.filter((_, idx) => idx !== i && idx !== j);
          currentTiles.push({ value: newValue, isWild: newIsWild });
          
          merged = true;
          mergeCount++;
          break;
        }
      }
      
      if (merged) break;
    }
    
    // If no merge was possible, break
    if (!merged) {
      break;
    }
  }
  
  // Check if we ended up with a single merge 6 tile
  const finalResult = currentTiles.length === 1 && currentTiles[0].value === 6;
  
  console.log('🧲 checkIfAllTilesCanMerge result:', {
    initialTiles: tileValues.length,
    finalTiles: currentTiles.length,
    finalValue: currentTiles[0]?.value,
    canAllMerge: finalResult,
    mergeCount
  });
  
  return finalResult;
}

async function mergePulledTilesIntoMerge6(dst: any, tiles: any[], helpers: any): Promise<void> {
  console.log('🧲 mergePulledTilesIntoMerge6: Removing', tiles.length, 'pulled tiles and adding 4x multiplier animations to existing merge 6');
  
  // Filter valid tiles
  const validTiles = tiles.filter((t: any) => t && !t.destroyed);
  const pulledTileCount = validTiles.length;
  const pulledCells: { c: number; r: number }[] = [];
  
  if (validTiles.length === 0 || !dst || dst.destroyed) {
    console.warn('⚠️ No valid tiles or dst destroyed');
    return;
  }
  
  // 🔥 CRITICAL: Store pulled cells BEFORE removing tiles (for excluding from later spawns)
  validTiles.forEach((tile: any) => {
    if (!tile || tile.destroyed) return;
    if (Number.isFinite(tile.gridX) && Number.isFinite(tile.gridY)) {
      pulledCells.push({ c: tile.gridX | 0, r: tile.gridY | 0 });
    }
  });
  
  // 🔥 CRITICAL: Store pulled cells in dst tile so they can be excluded from normal spawn
  (dst as any)._wildMagnetPulledCells = pulledCells;
  
  // Stop all animations
  validTiles.forEach((tile: any) => {
    if (!tile || tile.destroyed) return;
    gsap.killTweensOf(tile);
    if (tile.rotG) gsap.killTweensOf(tile.rotG);
  });
  
  // Remove all pulled tiles from grid and STATE
  validTiles.forEach((tile: any) => {
    if (!tile || tile.destroyed) return;
    
    // Clear from grid
    if (tile.gridX !== undefined && tile.gridY !== undefined && STATE.grid && STATE.grid[tile.gridY]) {
      STATE.grid[tile.gridY][tile.gridX] = null;
    }
    
    // Remove from STATE.tiles
    const tileIndex = STATE.tiles.indexOf(tile);
    if (tileIndex >= 0) {
      STATE.tiles.splice(tileIndex, 1);
    }
    
    // Hide and remove
    tile.visible = false;
    removeTile(tile);
  });
  
  // Set multiplier to 4x
  const mult = 4;
  
  // 🔥 CRITICAL: Calculate correct position - use grid coordinates if available, otherwise use current position
  let correctX: number;
  let correctY: number;
  
  if (typeof dst.gridX === 'number' && typeof dst.gridY === 'number' && Number.isFinite(dst.gridX) && Number.isFinite(dst.gridY)) {
    // Position formula: c * (TILE + GAP) + TILE / 2, r * (TILE + GAP) + TILE / 2
    correctX = dst.gridX * (TILE + GAP) + TILE / 2;
    correctY = dst.gridY * (TILE + GAP) + TILE / 2;
    console.log('🧲 Adding 4x multiplier animations to existing merge 6 tile at grid', dst.gridX, dst.gridY);
  } else {
    // Fallback: Use current position if grid coordinates are not available
    correctX = dst.x || 0;
    correctY = dst.y || 0;
    console.warn('⚠️ dst.gridX or dst.gridY is undefined, using current position:', correctX, correctY);
  }
  
  console.log('🧲 Correct position calculated:', correctX, correctY, 'current position:', dst.x, dst.y);
  
  // 🔥 CRITICAL: Set position immediately using correct formula (same as createTile)
  gsap.set(dst, { x: correctX, y: correctY });
  dst.targetX = correctX;
  dst.targetY = correctY;
  
  // 🔥 CRITICAL: Ensure grid coordinates are set if they're missing
  if (typeof dst.gridX !== 'number' || typeof dst.gridY !== 'number' || !Number.isFinite(dst.gridX) || !Number.isFinite(dst.gridY)) {
    // Try to find grid coordinates from STATE.grid
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (STATE.grid?.[r]?.[c] === dst) {
          dst.gridX = c;
          dst.gridY = r;
          console.log('🧲 Found grid coordinates from STATE.grid:', c, r);
          break;
        }
      }
      if (typeof dst.gridX === 'number' && Number.isFinite(dst.gridX)) break;
    }
  }
  
  // 🔥 CRITICAL: Red-brown shards animation when tiles gather (enhanced, visible)
  // Trigger 0.200s earlier by calling it before other animations
  if (dst && !dst.destroyed && STATE.board) {
    // 🔥 CRITICAL: Calculate shards position DIRECTLY from grid coordinates or current position
    // Don't rely on centerInBoard which might use toGlobal/toLocal transformations
    let shardX: number;
    let shardY: number;
    
    // First, try to use grid coordinates to calculate exact position (same as createTile)
    if (typeof dst.gridX === 'number' && typeof dst.gridY === 'number' && Number.isFinite(dst.gridX) && Number.isFinite(dst.gridY)) {
      // Use the same formula as createTile: c * (TILE + GAP) + TILE / 2
      shardX = dst.gridX * (TILE + GAP) + TILE / 2;
      shardY = dst.gridY * (TILE + GAP) + TILE / 2;
      console.log('🧲 Shards: Using grid coordinates', dst.gridX, dst.gridY, '→ position', shardX, shardY);
    } else if (typeof dst.x === 'number' && typeof dst.y === 'number' && Number.isFinite(dst.x) && Number.isFinite(dst.y)) {
      // Fallback: Use current tile position directly
      shardX = dst.x;
      shardY = dst.y;
      console.log('🧲 Shards: Using current tile position', shardX, shardY);
    } else {
      // Last resort: Use correctX/correctY that we calculated earlier
      shardX = correctX;
      shardY = correctY;
      console.log('🧲 Shards: Using calculated correct position', shardX, shardY);
    }
    
    // Ensure position is valid
    if (!Number.isFinite(shardX) || !Number.isFinite(shardY)) {
      console.error('❌ Invalid shards position:', shardX, shardY, 'dst:', dst);
    } else {
      // Ensure tile position is set correctly
      if (dst.x !== shardX || dst.y !== shardY) {
        gsap.set(dst, { x: shardX, y: shardY });
        dst.targetX = shardX;
        dst.targetY = shardY;
      }
      
      // 🔥 CRITICAL: Create a tile-like object with the exact calculated position
      // This bypasses centerInBoard's toGlobal/toLocal transformations which can cause offset
      const tileForShards = {
        x: shardX,
        y: shardY,
        gridX: dst.gridX,
        gridY: dst.gridY,
        zIndex: dst.zIndex || 0,
        rotG: dst.rotG,
        getBounds: () => ({ x: shardX - TILE/2, y: shardY - TILE/2, width: TILE, height: TILE }),
        toGlobal: (point: any) => {
          try {
            return STATE.board.toGlobal({ x: shardX + (point.x || 0), y: shardY + (point.y || 0) });
          } catch {
            return { x: shardX + (point.x || 0), y: shardY + (point.y || 0) };
          }
        },
        destroyed: false
      };
      
      console.log('🧲 Creating shards at calculated position:', shardX, shardY, 'grid:', dst.gridX, dst.gridY);
      
      // 🔥 CRITICAL: Trigger shards animation immediately (0.200s earlier than before)
      // 🔥 SPEED UP: Instant procedural fade-out + animation duration exactly 1s (same as regular merge 6)
      woodShardsAtTile(STATE.board, tileForShards as any, { 
        enhanced: true, 
        wild: false,  // Not wild-only, this is wild-magnet merge
        wildMagnet: true,  // Red-brown shards (wild-magnet style)
        count: 12,  // 60% fewer shards (was 30, now 12 = 30 * 0.4)
        intensity: 1.9,  // Same as magnet merge 6
        spread: 1.08,  // 40% smaller spread (was 1.8, now 1.08 = 1.8 * 0.6)
        size: 1.8,  // Size for shards
        speed: 0.85, 
        vanishDelay: 0.0, 
        vanishJitter: 0.02,
        ttl: 1.0,  // Time to live (exactly 1 second, same as regular merge 6)
        fastFadeOut: true,  // Enable instant procedural fade-out
        travelDurMultiplier: 0.5,  // 50% faster travel duration
        fadeDelayMultiplier: 0.1,  // 90% faster fade delay (instant)
        behind: false  // Ensure shards are visible (not behind tile)
      });
      
      console.log('🧲 Shards animation triggered at position:', shardX, shardY, 'grid:', dst.gridX, dst.gridY, 'dst.x:', dst.x, 'dst.y:', dst.y);
    }
  }
  
  // Apply magnet merge 6 animations to EXISTING merge 6 tile (same as main magnet merge 6)
  // Screen shake (triggered after shards for better visual effect)
  try {
    const baseShake = Math.min(28, 12 + Math.max(1, mult) * 4);
    screenShake(STATE.app, {
      strength: baseShake,
      duration: 0.36,
      steps: 28,
      ease: 'sine.inOut'
    });
  } catch {}
  
  // Wild impact effect
  wildImpactEffect(dst, { squash: 0.30, stretch: 0.26, tilt: 0.18, bounce: 1.24 });
  
  // 🔥 CRITICAL: Ensure tile position stays correct after animations
  // Use gsap.set to immediately set position using correct formula
  gsap.set(dst, { x: correctX, y: correctY });
  dst.targetX = correctX;
  dst.targetY = correctY;
  
  // Also ensure rotG position stays the same if it exists
  if (dst.rotG) {
    gsap.set(dst.rotG, { x: 0, y: 0 });
  }
  
  // Set position again after a small delay to ensure it stays (in case animations try to change it)
  setTimeout(() => {
    if (dst && !dst.destroyed) {
      gsap.set(dst, { x: correctX, y: correctY });
      dst.targetX = correctX;
      dst.targetY = correctY;
      if (dst.rotG) {
        gsap.set(dst.rotG, { x: 0, y: 0 });
      }
    }
  }, 100);
  
  // Update score - CRITICAL: Use window.CC.setScore to sync with app-core.ts local score variable
  // Score should be: 6 * multiplier (combo is already applied in main merge 6)
  // We're adding ADDITIONAL score for the pulled tiles merge 6
  const scoreDelta = 6 * mult; // Additional score from pulled tiles merge 6
  
  // Get current score from window.CC if available, otherwise use STATE.score
  const currentScore = typeof (window as any).CC?.getScore === 'function' 
    ? (window as any).CC.getScore() 
    : (STATE.score || 0);
  
  const newScore = Math.min(999999, currentScore + scoreDelta);
  
  console.log('🎯 Pulled tiles merge 6: mult=', mult, 'scoreDelta=', scoreDelta, 'currentScore=', currentScore, 'newScore=', newScore);
  
  // Update score using window.CC.setScore to sync with app-core.ts local score variable
  if (typeof (window as any).CC?.setScore === 'function') {
    (window as any).CC.setScore(newScore);
  } else {
    // Fallback: update STATE.score directly
    STATE.score = newScore;
  }
  
  // Update HUD
  updateHUD();
  animateScore(newScore, 0.45);
  
  // Stats
  statsService.incrementCubesCracked(1);
  statsService.incrementHelpersUsed(1);
  
  console.log('✅ mergePulledTilesIntoMerge6 completed - score updated to', newScore);

  if (pulledTileCount >= 4 && typeof (window as any).triggerHapticImpact === 'function') {
    try {
      (window as any).triggerHapticImpact('medium');
    } catch (error) {
      console.warn('⚠️ Failed to trigger haptic for pulled tiles merge:', error);
    }
  }

  // 🔥 CRITICAL: Check if magnet merge 6 is left with few tiles (3 or less) - if so, pull remaining tiles and trigger clean board
  // After pulled tiles merge, dst is merge 6, so we check if there are few remaining tiles on the board
  // EDGE CASE: If magnet pulled the last 4 tiles from the board, don't spawn new tiles - trigger clean board flow
  const activeTilesAfterPulledMerge = STATE.tiles.filter((t: any) => t && !t.locked && (t.value|0) > 0);
  const remainingTilesCount = activeTilesAfterPulledMerge.length;
  
  console.log('🧲 After pulled tiles merge - active tiles:', remainingTilesCount, 'dst is merge 6:', dst?.value === 6, 'pulledCells to respawn:', pulledCells.length);
  
  // 🔥 EDGE CASE: If only merge 6 remains (magnet pulled the last 4 tiles), don't spawn new tiles - trigger clean board immediately
  // BUT: Only if there are NO pulled cells to respawn! If we have pulled cells, we MUST spawn them first!
  // This covers the case when magnet pulled the last 4 tiles from the board
  if (remainingTilesCount === 1 && activeTilesAfterPulledMerge[0] === dst && pulledCells.length === 0) {
    // Only merge 6 remains - this means magnet pulled the last tiles from the board
    console.log('🚨🚨🚨 EDGE CASE: Only merge 6 remains after magnet pulled last 4 tiles - Triggering clean board flow immediately (no spawn)');
    
    // Remove merge 6
    if (dst && !dst.destroyed) {
      removeTile(dst);
    }
    
    // Trigger clean board flow
    const { runEndgameFlow } = await import('./endgame-flow.js');
    
    // Get app context from STATE and helpers
    const app = STATE.app;
    const stage = STATE.stage;
    const board = STATE.board;
    const boardBG = STATE.boardBG;
    const level = STATE.level || 1;
    const startLevel = helpers?.startLevel || (window as any).startLevel || (window as any).CC?.startLevel;
    const boardNumber = STATE.boardNumber || 1;
    
    if (!app || !stage || !board || !startLevel) {
      console.error('❌ Missing required context for clean board flow:', { app: !!app, stage: !!stage, board: !!board, startLevel: !!startLevel });
      return;
    }
    
    // Reset wild meter
    if (typeof (window as any).CC?.resetWildProgress === 'function') {
      (window as any).CC.resetWildProgress(0, false);
    } else if (typeof (window as any).resetWildProgress === 'function') {
      (window as any).resetWildProgress(0, false);
    }
    if (typeof HUD.resetWildMeter === 'function') {
      HUD.resetWildMeter(true);
    }
    
    // Set busy ending flag
    STATE.busyEnding = true;
    
    // Wait a bit before showing clean board
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Trigger clean board flow
    try {
      await runEndgameFlow({
        app,
        stage,
        board,
        boardBG,
        level,
        startLevel,
        score: newScore,
        getScore: () => newScore,
        setScore: (v) => { 
          if (typeof (window as any).CC?.setScore === 'function') {
            (window as any).CC.setScore(v);
          } else {
            STATE.score = v|0;
          }
          updateHUD();
        },
        animateScore,
        updateHUD,
        boardNumber,
        hideGrid: () => { try { if (board) board.visible = false; } catch {} },
        showGrid: () => { try { if (board) board.visible = true; } catch {} }
      });
    } finally {
      STATE.busyEnding = false;
    }
    
    return; // Don't spawn new tiles - EDGE CASE: magnet pulled last 4 tiles
  }
  
  // If merge 6 is on board with 2-3 tiles remaining (including merge 6 itself), pull all remaining tiles and trigger clean board
  // BUT: Only if there are NO pulled cells to respawn! If we have pulled cells, we MUST spawn them first!
  // This means if there are 2-3 tiles total (including merge 6), pull them and trigger clean board
  if (remainingTilesCount >= 2 && remainingTilesCount <= 3 && pulledCells.length === 0) {
    console.log('🚨🚨🚨 MAGNET MERGE 6 WITH FEW TILES DETECTED - Pulling all remaining tiles and triggering clean board flow');
    
    // Find merge 6 tile (dst) and remaining tiles
    const merge6Tile = activeTilesAfterPulledMerge.find((t: any) => t === dst && t.value === 6);
    const remainingTiles = activeTilesAfterPulledMerge.filter((t: any) => t !== dst);
    
    if (merge6Tile && remainingTiles.length > 0) {
      console.log('🧲 Pulling', remainingTiles.length, 'remaining tiles to merge 6');
      
      // Pull all remaining tiles to merge 6 (similar to normal magnet pull)
      const pullPromises = remainingTiles.map(async (tile: any, index: number) => {
        const delay = index * 0.04; // Small stagger delay
        
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
        
        // Animate tile moving to merge 6
        const merge6X = merge6Tile.x;
        const merge6Y = merge6Tile.y;
        
        return new Promise<void>((resolve) => {
          gsap.to(tile, {
            x: merge6X,
            y: merge6Y,
            duration: 0.35,
            ease: 'power2.inOut',
            onComplete: () => {
              resolve();
            }
          });
        });
      });
      
      // Wait for all tiles to arrive
      await Promise.all(pullPromises);
      
      // Merge all pulled tiles into merge 6 (create merge 6 with multiplier based on number of pulled tiles)
      // Multiplier = number of pulled tiles (remainingTiles.length)
      // If 3 tiles pulled → 3x, if 2 tiles pulled → 2x, if 1 tile pulled → 1x
      // Dynamic multiplier: exactly matches the number of tiles that were pulled
      const finalMult = remainingTiles.length; // Dynamic multiplier based on number of pulled tiles
      const finalScoreDelta = 6 * finalMult;
      const finalScore = Math.min(999999, newScore + finalScoreDelta);
      
      console.log('🧲 Final merge: pulled tiles=', remainingTiles.length, 'mult=', finalMult, 'scoreDelta=', finalScoreDelta, 'finalScore=', finalScore);
      
      // Update score
      if (typeof (window as any).CC?.setScore === 'function') {
        (window as any).CC.setScore(finalScore);
      } else {
        STATE.score = finalScore;
      }
      updateHUD();
      animateScore(finalScore, 0.45);
      
      // Remove all pulled tiles and merge 6
      remainingTiles.forEach((tile: any) => {
        if (tile && !tile.destroyed) {
          removeTile(tile);
        }
      });
      if (merge6Tile && !merge6Tile.destroyed) {
        removeTile(merge6Tile);
      }
      
      // Trigger clean board flow
      const { runEndgameFlow } = await import('./endgame-flow.js');
      
      // Get app context from STATE and helpers
      const app = STATE.app;
      const stage = STATE.stage;
      const board = STATE.board;
      const boardBG = STATE.boardBG;
      const level = STATE.level || 1;
      const startLevel = helpers?.startLevel || (window as any).startLevel || (window as any).CC?.startLevel;
      const boardNumber = STATE.boardNumber || 1;
      
      if (!app || !stage || !board || !startLevel) {
        console.error('❌ Missing required context for clean board flow:', { app: !!app, stage: !!stage, board: !!board, startLevel: !!startLevel });
        return;
      }
      
      // Reset wild meter - use window.CC if available
      if (typeof (window as any).CC?.resetWildProgress === 'function') {
        (window as any).CC.resetWildProgress(0, false);
      } else if (typeof (window as any).resetWildProgress === 'function') {
        (window as any).resetWildProgress(0, false);
      }
      if (typeof HUD.resetWildMeter === 'function') {
        HUD.resetWildMeter(true);
      }
      
      // Set busy ending flag
      STATE.busyEnding = true;
      
      // Wait a bit before showing clean board
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Trigger clean board flow
      try {
        await runEndgameFlow({
          app,
          stage,
          board,
          boardBG,
          level,
          startLevel,
          score: finalScore,
          getScore: () => finalScore,
          setScore: (v) => { 
            if (typeof (window as any).CC?.setScore === 'function') {
              (window as any).CC.setScore(v);
            } else {
              STATE.score = v|0;
            }
            updateHUD();
          },
          animateScore,
          updateHUD,
          boardNumber,
          hideGrid: () => { try { if (board) board.visible = false; } catch {} },
          showGrid: () => { try { if (board) board.visible = true; } catch {} }
        });
      } finally {
        STATE.busyEnding = false;
      }
      
      return; // Don't spawn new tiles
    }
  }

  // Find random empty cells on the board for spawning new tiles
  const findRandomEmptyCells = (count: number): { c: number; r: number }[] => {
    const empties: { c: number; r: number }[] = [];
    
    // Find all empty cells on the board
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = STATE.grid?.[r]?.[c];
        
        // 🔥 CRITICAL: Check if cell is truly empty (no active tile)
        // A cell is empty if:
        // 1. It's missing (null) - no tile at all
        // 2. It's locked (ghost placeholder) - can be replaced
        // 3. It has value 0 or less AND is locked (ghost placeholder)
        // A cell is NOT empty if:
        // - It has a value > 0 AND is not locked (active tile)
        // - It's a wild tile (wild or wild-magnet) AND is not locked
        
        const isMissing = !t;
        const isLocked = !!(t && t.locked === true);
        const hasValue = !!(t && (t.value|0) > 0);
        const isWildTile = !!(t && !t.locked && (t.special === 'wild' || t.special === 'wild-magnet' || (t as any).isWild === true || (t as any).isWildFace === true));
        const isActive = !!(t && !t.locked && hasValue);
        
        // Cell is empty if it's missing, locked (ghost), or has zero value and is locked
        // Cell is NOT empty if it has an active tile or wild tile
        if (isMissing || (isLocked && !hasValue) || (!isActive && !isWildTile && !hasValue)) {
          empties.push({ c, r });
        }
      }
    }
    
    // Shuffle and pick random cells
    if (empties.length === 0) {
      console.warn('⚠️ No empty cells found for spawning');
      return [];
    }
    
    // Shuffle array (Fisher-Yates shuffle)
    for (let i = empties.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [empties[i], empties[j]] = [empties[j], empties[i]];
    }
    
    // Return up to 'count' random empty cells
    return empties.slice(0, Math.min(count, empties.length));
  };
  
  const isLastMergeFlagSet = (dst as any)?._isLastMerge === true;
  const activeAfterRemoval = STATE.tiles.filter(tileIsActive);
  const onlyDstRemains = activeAfterRemoval.length === 1 && activeAfterRemoval[0] === dst;
  const hasTilesToRespawn = pulledCells.length > 0;

  // 🔥 CRITICAL: Only skip respawn if explicitly marked as last merge
  // OR if only dst remains AND there are no tiles to respawn
  // This prevents premature endgame when there are still wild/magnet tiles on board
  const shouldSkipRespawnAndEndGame = isLastMergeFlagSet || (onlyDstRemains && !hasTilesToRespawn);

  console.log('🧲 Pre-respawn check:', {
    isLastMergeFlagSet,
    activeAfterRemoval: activeAfterRemoval.length,
    onlyDstRemains,
    hasTilesToRespawn,
    shouldSkipRespawnAndEndGame
  });

  if (shouldSkipRespawnAndEndGame && triggerCentralEndgameCheck('mergePulledTilesBeforeRespawn')) {
    console.log('🧲 mergePulledTilesIntoMerge6: Central endgame handled before respawn, skipping spawns.');
    return;
  }
  
  // 🔥 SAFETY: If we have tiles to respawn, ALWAYS respawn them regardless of endgame state
  // This prevents the "instant fail" bug when magnet pulls tiles but doesn't spawn new ones
  if (hasTilesToRespawn) {
    console.log('🧲 Has tiles to respawn:', pulledCells.length, '- proceeding with spawn regardless of endgame state');
  }

  const spawnCount = hasTilesToRespawn ? pulledCells.length : 0; // Spawn as many tiles as were pulled
  const spawnTargets = findRandomEmptyCells(spawnCount);

  if (spawnTargets.length) {
    console.log('🧲 Respawning', spawnCount, 'tiles at random empty cells:', spawnTargets);
    console.log('🧲 STATE.drag exists?', !!STATE.drag);
    console.log('🧲 STATE.drag.bindToTile exists?', !!(STATE.drag as any)?.bindToTile);
    
    // 🔥 CRITICAL FIX: Spawn tiles with minimal delay between them for faster spawning
    // spawnBounce animation already takes ~0.58s, so we only need a very small stagger delay
    // Using parallel spawning with staggered start times (20ms apart) for faster overall completion
    await Promise.all(
      spawnTargets.map(async ({ c, r }, index) => {
        // Stagger start times: first tile starts immediately, others start 20ms apart (reduced from 50ms)
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, index * 20));
        }
        
        try {
          // 🔥 CRITICAL: Double-check cell is still empty before spawning (race condition protection)
          const existingTile = STATE.grid?.[r]?.[c];
          if (existingTile && !existingTile.locked) {
            const isActive = (existingTile.value|0) > 0;
            const isWildTile = existingTile.special === 'wild' || existingTile.special === 'wild-magnet' || (existingTile as any).isWild === true || (existingTile as any).isWildFace === true;
            
            if (isActive || isWildTile) {
              console.warn(`⚠️ Cell (${c}, ${r}) became occupied before spawn, skipping`);
              return; // Skip this cell
            }
          }
          
          // Spawn tile normally (skipBind = false means it will try to bind immediately)
          await openAtCell(c, r, { skipBind: false });
          
          // No delay needed - spawnBounce animation handles the visual delay
          
          // Get the spawned tile
          const tile = STATE.grid?.[r]?.[c];
          console.log('🧲 After spawn at', c, r, 'tile:', tile, 'locked:', tile?.locked, 'value:', tile?.value);
          
          if (tile && !tile.locked && tile.value > 0) {
            // Double-check: Ensure tile is draggable and bound to drag system
            tile.eventMode = 'static';
            tile.cursor = 'pointer';
            
            // Check if tile is in STATE.tiles
            const inTilesArray = STATE.tiles.includes(tile);
            console.log('🧲 Tile at', c, r, 'in STATE.tiles?', inTilesArray);
            
            // Explicitly bind to drag system (in case bindTileWithFallback failed)
            const drag = STATE.drag as any;
            if (drag && typeof drag.bindToTile === 'function') {
              drag.bindToTile(tile);
              console.log('✅ Spawned and bound tile to drag system at', c, r, 'value:', tile.value, 'eventMode:', tile.eventMode);
            } else {
              console.warn('⚠️ Drag system not available at', c, r, 'drag:', drag);
            }
          } else {
            console.warn('⚠️ Tile not found or invalid after spawn at', c, r, 'tile:', tile, 'locked:', tile?.locked, 'value:', tile?.value);
          }
        } catch (err) {
          console.warn(`⚠️ Failed to respawn tile at (${c}, ${r}):`, err);
        }
      })
    );
  }

  if (triggerCentralEndgameCheck('mergePulledTilesRespawn')) {
    return;
  }

  // 🔥 CRITICAL: After spawning new tiles, check if they can merge
  // This is the edge case: if magnet pulled last tiles and spawned 4 new ones,
  // we need to check if those 4 can merge with each other or with existing tiles
  // 🔥 CRITICAL: Add delay to allow spawn animations to complete before checking
  // Increased from 600ms to 800ms to ensure spawn bounce (~580ms) + unlock/bind (~50ms) completes
  await new Promise(resolve => setTimeout(resolve, 800)); // 800ms delay for spawn animations
  
  const canMerge = makeBoard.anyMergePossible(STATE.tiles);
  console.log('🧲 Post-respawn mergeability check (after delay):', canMerge);
  
  if (!canMerge) {
    // No merges possible - show fail screen
    console.log('🚨🚨🚨 No merges possible after magnet pull spawn - showing fail screen');
    
    // 🔥 CRITICAL: Wait 1 second before showing fail screen so user can see spawned tiles
    // This prevents instant fail screen after magnet spawns non-mergable tiles
    console.log('⏳ Waiting 1 second before fail screen so user can see spawned tiles...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Use checkLevelEnd from app-core.ts if available, otherwise use checkGameOver
    if (typeof (window as any).CC?.checkLevelEnd === 'function') {
      (window as any).CC.checkLevelEnd();
    } else {
      await checkGameOver();
    }
    return;
  }
  
  // 🔥 CRITICAL: Wait longer for spawn animations to complete before checking endgame
  // Spawn bounce animation takes ~580ms, plus unlock/bind takes ~50ms
  // Total safe delay: 800ms (increased from 600ms)
  console.log('⏳ Waiting 800ms for spawn animations to complete before endgame check...');
  
  // 🔥 CRITICAL: Check if ALL tiles can be merged together (simulate all possible merges)
  // If all tiles can be merged and the final merge is merge 6, trigger clean board flow
  const canAllMerge = await checkIfAllTilesCanMerge(STATE.tiles, helpers);
  if (canAllMerge) {
    console.log('🚨🚨🚨 All tiles can be merged together - will trigger clean board flow after final merge 6');
    // Note: Clean board flow will be triggered automatically when the final merge 6 occurs
    // This is handled in the merge function when board becomes clean
  }
  
  // 🔥 CRITICAL: Also call checkLevelEnd as backup (it has its own delay and handles all edge cases)
  // This ensures end game is checked even if checkGameOver doesn't catch it
  if (typeof (window as any).CC?.checkLevelEnd === 'function') {
    (window as any).CC.checkLevelEnd();
  }
}

export async function handleWildMagnetMergedPulledTiles(dst: any, pulledTiles: any[], helpers: any): Promise<boolean> {
  console.log('🧲 handleWildMagnetMergedPulledTiles called with', pulledTiles?.length || 0, 'tiles');
  
  // Filter valid tiles
  const validTiles = (pulledTiles || []).filter((t: any) => t && !t.destroyed);
  
  if (validTiles.length < 1) {
    console.warn('⚠️ Not enough pulled tiles (need at least 1, got', validTiles.length, ')');
    return false;
  }
  
  console.log('🧲 Pulled tiles state:', validTiles.map((t: any, i: number) => ({
    [`tile${i + 1}`]: { value: t.value, special: t.special, destroyed: t.destroyed }
  })));
  
  // Merge all pulled tiles into merge 6 with 4x multiplier and magnet animations
  await mergePulledTilesIntoMerge6(dst, validTiles, helpers);
  
  console.log('✅ mergePulledTilesIntoMerge6 completed');
  
  return true;
}

export function merge(src, dst, helpers){
  console.log('🔥🔥🔥 MERGE FUNCTION CALLED in app-merge.ts');
  console.log('🔥🔥🔥 MERGE DEBUG:', {
    srcValue: src?.value,
    dstValue: dst?.value,
    srcSpecial: src?.special,
    dstSpecial: dst?.special,
    srcWildMagnetAffected: (src as any)?._wildMagnetAffected,
    dstWildMagnetAffected: (dst as any)?._wildMagnetAffected,
    srcDestroyed: src?.destroyed,
    dstDestroyed: dst?.destroyed,
    dstLocked: dst?.locked,
    busyEnding: STATE.busyEnding,
    srcEqualsDst: src === dst
  });
  
  if (STATE.busyEnding) { 
    console.warn('⚠️ MERGE BLOCKED: STATE.busyEnding is true');
    helpers.snapBack?.(src); 
    return; 
  }
  if (src === dst) { 
    console.warn('⚠️ MERGE BLOCKED: src === dst');
    helpers.snapBack(src); 
    return; 
  }
  
  // CRITICAL: Validate that both tiles are valid and merge is allowed
  if (!src || !dst || src.destroyed || dst.destroyed) {
    console.warn('⚠️ MERGE: Invalid tiles - src:', src, 'dst:', dst);
    if (src && !src.destroyed) helpers.snapBack?.(src);
    return;
  }
  
  // CRITICAL: If destination is locked or has value 0, this is not a valid merge (ghost placeholder)
  // BUT: For wild-magnet affected tiles, we might want to allow merge even if dst is locked or has value 0
  // because they're merging into each other at the same location
  const srcIsWildMagnetAffected = (src as any)?._wildMagnetAffected === true;
  const dstIsWildMagnetAffected = (dst as any)?._wildMagnetAffected === true;
  const isPulledTilesMerge = srcIsWildMagnetAffected && dstIsWildMagnetAffected;
  
  if (dst.locked || (dst.value | 0) <= 0) {
    // For pulled tiles merge (both wild-magnet affected), allow merge even if dst is locked/value 0
    // because they're merging at the same location and creating merge 6
    if (!isPulledTilesMerge) {
      console.warn('⚠️ MERGE: Destination is locked or has value 0 - this should not happen!');
      console.warn('⚠️ Destination:', { locked: dst.locked, value: dst.value, gridX: dst.gridX, gridY: dst.gridY });
      helpers.snapBack?.(src);
      return;
    } else {
      console.log('🧲 MERGE: Allowing pulled tiles merge even if dst is locked/value 0 (both are wild-magnet affected)');
    }
  }

  // 3D Effects - Add merging animation
  if (window.threeDEffects && window.threeDEffects.is3DEnabled) {
    window.threeDEffects.animateMerge(src, dst);
  }

  // Check if this is a wild-magnet merge (for special pull logic after merge 6)
  const isWildMagnet = src.special === 'wild-magnet' || dst.special === 'wild-magnet';
  
  const sum      = src.value + dst.value;
  const srcDepth = src.stackDepth || 1;
  const dstDepth = dst.stackDepth || 1;

  const srcGX = src.gridX, srcGY = src.gridY;
  
  // 🔥 CRITICAL: Check if tiles are wild-magnet affected (become "wild" through magnet meaning)
  // NOTE: srcIsWildMagnetAffected and dstIsWildMagnetAffected are already declared above in the function
  
  // Wild-magnet works like wild: always merges to 6
  // Also, if BOTH tiles are wild-magnet affected, they act like wild (can merge regardless of pips)
  const wildActive = (src.special === 'wild' || dst.special === 'wild' || src.special === 'wild-magnet' || dst.special === 'wild-magnet') ||
                     (srcIsWildMagnetAffected && dstIsWildMagnetAffected);
  const wildTargetValue = wildActive ? ((src.special === 'wild' || src.special === 'wild-magnet' || srcIsWildMagnetAffected) ? (dst.value|0) : (src.value|0)) : null;
  const effSum = wildActive ? 6 : sum;
  
  console.log('🔥 MERGE DEBUG:', { 
    wildActive, 
    srcSpecial: src.special, 
    dstSpecial: dst.special,
    srcValue: src.value,
    dstValue: dst.value,
    effSum,
    srcIsWildMagnetAffected,
    dstIsWildMagnetAffected,
    sum
  });
  
  if (wildActive) {
    console.log('🎯 WILD MERGE DETECTED! Should trigger enhanced effects...');
    console.log('🎯 effSum =', effSum, '(should be 6 for merge 6)');
  } else {
    console.log('❌ NOT a wild merge - src.special:', src.special, 'dst.special:', dst.special);
    console.log('❌ srcIsWildMagnetAffected:', srcIsWildMagnetAffected, 'dstIsWildMagnetAffected:', dstIsWildMagnetAffected);
    console.log('❌ sum =', sum, 'effSum =', effSum);
  }

  STATE.grid[src.gridY][src.gridX] = null;
  dst.eventMode = 'none';

  // ---- 2..5: commit, score immediately, NO REFILL; fill wild meter
  if (effSum < 6){
    makeBoard.setValue(dst, effSum, srcDepth);
    if (wildActive) clearWildState(dst);
    STATE.score += effSum; updateHUD();
    
    // Haptic feedback based on merge/stack type
    console.log('🔍 HAPTIC CHECK:', { 
      hasTriggerHaptic: typeof (window as any).triggerHaptic === 'function',
      wildActive,
      srcValue: src.value,
      dstValue: dst.value,
      isStacking: src.value === dst.value
    });
    
    // Use same bridge as Continue/New Game buttons
    if (typeof (window as any).triggerHaptic === 'function') {
      console.log('📳 CALLING triggerHaptic');
      (window as any).triggerHaptic();
    } else {
      console.warn('⚠️ triggerHaptic function not available!');
    }

    // STATS TRACKING: Update high score immediately for all merges
    console.log('📊 ALL MERGES - Checking high score update, current score:', STATE.score);
    console.log('🔍 DEBUG: window object exists:', typeof window !== 'undefined');
    console.log('🔍 DEBUG: typeof window.trackHighScore:', typeof window.trackHighScore);
    console.log('🔍 DEBUG: window.trackHighScore is function:', typeof window.trackHighScore === 'function');
    
    try {
      if (typeof window.trackHighScore === 'function') {
        console.log('✅ CALLING trackHighScore with score:', STATE.score);
        window.trackHighScore(STATE.score);
        console.log('✅ High score tracking called for merge:', effSum);
      } else {
        console.error('❌ trackHighScore is NOT a function! Type:', typeof window.trackHighScore);
      }
    } catch (e) {
      console.error('❌ trackHighScore failed:', e);
    }

    // STATS TRACKING: Track wild usage as helpers
    if (wildActive) {
      console.log('🎯 WILD MERGE detected, tracking helpers used');
      try {
        if (typeof window.trackHelpersUsed === 'function') {
          window.trackHelpersUsed(1);
          console.log('✅ Helpers used tracking called');
        }
      } catch (e) {
        console.error('❌ trackHelpersUsed failed:', e);
      }
    }

    // meter + little bounce on score
    const inc = 0.13; // ~7.7 small merges to full (promijenjeno sa 0.25 na 0.13)
    const previous = STATE.wildMeter || 0;
    STATE.wildMeter = Math.max(0, previous + inc);
    const displayRatio = Math.min(1, STATE.wildMeter);
    console.log('🔥 MERGE: Updating wild meter raw to:', STATE.wildMeter, 'display:', displayRatio, 'inc:', inc);
    if (updateProgressBar) {
      updateProgressBar(displayRatio, true);
      console.log('✅ MERGE: updateProgressBar called successfully');
    } else {
      console.error('❌ MERGE: updateProgressBar is not defined!');
    }

    gsap.to(src, {
      x: dst.x, y: dst.y, duration: 0.10, ease: 'power2.out',
      onComplete: async () => {
        removeTile(src);
        dst.eventMode = 'static';
        // Use enhanced wild impact effect if wild cube is involved
        if (wildActive) {
          console.log('💥 WILD MERGE (< 6): Applying enhanced effects');
          try {
            screenShake(STATE.app, {
              strength: 26,
              duration: 0.36,
              steps: 26,
              ease: 'sine.inOut'
            });
          } catch {}

          // Special visual effects ONLY for wild merges
          glassCrackAtTile(STATE.board, dst, 160, 2.0);
          innerFlashAtTile(STATE.board, dst, 160, 1.6);
          woodShardsAtTile(STATE.board, dst, { enhanced: true, wild: true, intensity: 1.55, vanishDelay: 0.0, vanishJitter: 0.015 });
          
          // Enhanced impact and smoke
          wildImpactEffect(dst, { squash: 0.34, stretch: 0.30, tilt: 0.22, bounce: 1.34 });
          smokeBubblesAtTile(STATE.board, dst, {
            tileSize: 140,
            strength: 3.0, // Reduced from 5.0 to prevent overly strong effect
            behind: true,
            sizeScale: 0.75, // Smaller bubbles  
            distanceScale: 0.45, // Keep closer to tile (was default 0.75)
            countScale: 0.8,
            haloScale: 1.0,
            ttl: 0.9
          });
          
          console.log('✅ WILD MERGE (< 6): Enhanced effects applied successfully');
        } else {
          console.log('📍 NORMAL MERGE (< 6): Applying basic effects');
          landBounce(dst);
          // Only basic smoke for normal merges (no special effects)
          const softSmokeStrength = 0.55 + Math.random() * 0.25;
          smokeBubblesAtTile(STATE.board, dst, {
            tileSize: TILE,
            strength: softSmokeStrength,
            behind: true,
            sizeScale: 1.12,
            distanceScale: 0.7,
            countScale: 0.75,
            haloScale: 1.1,
            ttl: 0.9
          });
        }
        
        // Update ghost visibility after merge
        if (typeof window.updateGhostVisibility === 'function') {
          window.updateGhostVisibility();
        }
        
        STATE.moves++; updateHUD();
        
        // CRITICAL FIX: Wild merges should spawn new tiles to prevent wild cubes from getting stuck
        if (wildActive) {
          console.log('🎯 Wild merge completed, spawning new tiles to prevent wild cubes from getting stuck');
          // Spawn 1-2 new tiles after wild merge to ensure board doesn't get stuck
          const spawnCount = Math.min(2, Math.max(1, Math.floor(Math.random() * 2) + 1));
          try {
            await openEmpties(spawnCount);
            console.log('✅ Spawned', spawnCount, 'new tiles after wild merge');
          } catch (error) {
            console.warn('⚠️ Failed to spawn tiles after wild merge:', error);
          }
        }
        
        // Check game over after spawning
        ENDLESS ? checkGameOver() : checkGameOver();
      }
    });
    return;
  }

  // ---- 6: FX, then refill 2 (by depth), first 6 = Wild at explosion cell
  if (effSum === 6){
    // Haptic feedback for merge 6
    console.log('🔍 HAPTIC CHECK (merge-6):', { 
      hasTriggerHaptic: typeof (window as any).triggerHaptic === 'function',
      wildActive,
      effSum
    });
    
    // Use same bridge as Continue/New Game buttons
    if (typeof (window as any).triggerHaptic === 'function') {
      console.log('📳 CALLING triggerHaptic (merge-6)');
      (window as any).triggerHaptic();
    } else {
      console.warn('⚠️ triggerHaptic function not available (merge-6)!');
    }
    
    const combined = Math.min(4, srcDepth + dstDepth);
    const avoidValue = Number.isFinite(wildTargetValue) ? wildTargetValue : null;
    dst._wildMergeTarget = avoidValue;
    makeBoard.setValue(dst, 6, 0);
    if (wildActive) clearWildState(dst);
    dst.stackDepth = combined;
    makeBoard.drawStack(dst);
    dst.zIndex = 10000;
    // CRITICAL: For wild-magnet, always use x2 multiplier for main merge
    const mult = isWildMagnet ? 2 : (combined >= 3 ? 3 : combined);
    // Centralized HUD combo balloon for merge 6
    try { HUD.bumpCombo?.({ kind: 'merge6' }); } catch {}

    // 🔥 JIGGLY ANIMATION: Add shake and rotation to pulled tiles before merge
    if (isPulledTilesMerge) {
      console.log('🧲 Adding jiggly shake and rotation animation to pulled tiles');
      
      // Shake and rotate both tiles with a jiggly effect
      const shakeDuration = 0.25;
      const shakeAmount = 3; // pixels
      const rotationAmount = 0.08; // radians (about 4.5 degrees)
      
      // Shake and rotate src tile
      gsap.to(src, {
        x: `+=${(Math.random() - 0.5) * shakeAmount * 2}`,
        y: `+=${(Math.random() - 0.5) * shakeAmount * 2}`,
        rotation: `+=${(Math.random() - 0.5) * rotationAmount * 2}`,
        duration: shakeDuration,
        ease: 'power2.inOut',
        yoyo: true,
        repeat: 1
      });
      
      // Shake and rotate dst tile
      gsap.to(dst, {
        x: `+=${(Math.random() - 0.5) * shakeAmount * 2}`,
        y: `+=${(Math.random() - 0.5) * shakeAmount * 2}`,
        rotation: `+=${(Math.random() - 0.5) * rotationAmount * 2}`,
        duration: shakeDuration,
        ease: 'power2.inOut',
        yoyo: true,
        repeat: 1
      });
    }

    gsap.to(src, {
      x: dst.x, y: dst.y, duration: 0.10, ease: 'power2.out',
      onComplete: async () => {
        // 🔥 CRITICAL: Snimiti src.special i dst.special PRIJE removeTile(src)!
        // Nakon removeTile, src može biti destroyed ili undefined
        const srcSpecial = src?.special;
        const dstSpecial = dst?.special;

        removeTile(src);
        
        // 🔥 CRITICAL: ALWAYS run animations and remove merge 6, regardless of willClean
        // The old code would skip animations if willClean=true, causing merge 6 to freeze
        await landPreBounce(dst);
        showMultiplierTile(STATE.board, dst, mult, 120, 1.0);
        
        // CRITICAL FIX: Check for wild cubes properly (including wild-magnet)
        const allTiles = STATE.tiles.filter(t => t && !t.locked);
        const wildCubes = allTiles.filter(t => t.special === 'wild' || t.special === 'wild-magnet');
        const nonWildTiles = allTiles.filter(t => t.special !== 'wild' && t.special === 'wild-magnet');
        const willClean = wildCubes.length === 0 && nonWildTiles.length <= 1;
        const shouldRefillAfterMerge = !willClean;
        
        // 🔥 CRITICAL: Check if this is pulled tiles merge 6 (both _wildMagnetAffected)
        // Pulled tiles merge 6 should use same shard parameters as magnet merge 6
        if (isPulledTilesMerge) {
            console.log('🧲 PULLED TILES MERGE 6: Using same shard parameters as magnet merge 6');
            const base = Math.min(28, 12 + Math.max(1, mult) * 4);
            try {
              screenShake(STATE.app, {
                strength: base,
                duration: 0.36,
                steps: 28,
                ease: 'sine.inOut'
              });
            } catch {}

            // Glass, flash, shards with same parameters as magnet merge 6
            glassCrackAtTile(STATE.board, dst, 200, 2.6);
            innerFlashAtTile(STATE.board, dst, 220, 2.2);
            
            // 🔥 Use woodShardsAtTile with same parameters as magnet merge 6 (brown shards only)
            // 🔥 SIZE: 300x larger for pulled tiles merge 6 (1.5 * 300 = 450)
            // 🔥 CRITICAL: Add explicit flag to ensure pulled tiles merge 6 shards are properly generated
            woodShardsAtTile(STATE.board, dst, { 
              enhanced: true, 
              wild: false,  // Not wild, just magnet-affected
              wildMagnet: false,  // Not wild-magnet itself, just affected tiles
              pulledTilesMerge: true,  // 🔥 EXPLICIT FLAG for pulled tiles merge 6
              count: 30,  // Same as magnet merge 6
              intensity: 1.9,  // Same as magnet merge 6
              spread: 1.8,  // Same as magnet merge 6
              size: 450,  // 300x larger than magnet merge 6 (1.5 * 300 = 450)
              speed: 0.85,  // Same as magnet merge 6
              vanishDelay: 0.0, 
              vanishJitter: 0.02 
            });

            // Enhanced multiplier
            showMultiplierTile(STATE.board, dst, mult, 150, 1.6);

            // Smoke bubbles completely removed for pulled tiles merge 6
            // smokeBubblesAtTile call removed - no smoke for pulled tiles merge
            
          } else if (wildActive) {
            console.log('WILD EXPLOSION (= 6): Triggering dramatic effects');
            const base = Math.min(28, 12 + Math.max(1, mult) * 4);
            try {
              screenShake(STATE.app, {
                strength: base,
                duration: 0.36,
                steps: 28,
                ease: 'sine.inOut'
              });
            } catch {}

            // WILD-ONLY special effects - glass, flash, shards
            glassCrackAtTile(STATE.board, dst, 200, 2.6);        // stronger intensity
            innerFlashAtTile(STATE.board, dst, 220, 2.2);        // brighter flash
            
            // 🔥 CRITICAL: Use spawnMerge6Shards with saved srcSpecial AND dstSpecial snapshots
            // Create clean snapshot objects WITHOUT spread operator to avoid property conflicts
            // This ensures getMerge6ShardConfig can properly detect wild vs wild-magnet vs regular
            const srcSnapshot = { special: srcSpecial };
            const dstSnapshot = { special: dstSpecial };
            console.log('🔥 Wild merge 6 shards (app-merge) - srcSpecial:', srcSpecial, 'dstSpecial:', dstSpecial);
            spawnMerge6Shards(STATE.board, srcSnapshot, dst, dstSnapshot, { intensity: 1.8, vanishDelay: 0.0, vanishJitter: 0.02 });
            spawnMerge6Shards(STATE.board, srcSnapshot, dst, dstSnapshot, { intensity: 1.45, speed: 0.9, size: 1.3, vanishDelay: 0.0, vanishJitter: 0.02 });

            // Enhanced multiplier for wild
            showMultiplierTile(STATE.board, dst, mult, 150, 1.6);

            // Additional smoke bubbles for wild explosion
            smokeBubblesAtTile(STATE.board, dst, {
              tileSize: 140,
              strength: 4.0, // Reduced from 9.0 to prevent overly strong effect
              behind: true,
              sizeScale: 0.8, // Smaller bubbles
              distanceScale: 0.45, // Keep closer (was default 0.75)
              countScale: 0.8,
              haloScale: 1.0,
              ttl: 0.9
            });
            
          } else {
            // Normal merge 6 effects - optimized
            const softSmokeStrength = 0.6 + Math.random() * 0.3;
            smokeBubblesAtTile(STATE.board, dst, {
              tileSize: TILE,
              strength: softSmokeStrength,
              behind: true,
              sizeScale: 0.557, // 0.464 * 1.2 = 0.557 (20% increase)
              distanceScale: 0.30, // Much closer to edges (75% reduction from 0.75)
              countScale: 0.8,
              haloScale: 1.15,
              ttl: 1.0,
              // Limit max bubble size to prevent oversized bubbles
              startScale: 0.42 // 0.35 * 1.2 = 0.42 (20% increase)
            });
            try { screenShake(STATE.app, { strength: Math.min(24, 10 + Math.max(1, mult) * 3), duration: 0.34, steps: 18, ease: 'power2.out' }); } catch {}
            // 🔥 CRITICAL: Use spawnMerge6Shards with saved srcSpecial AND dstSpecial snapshots (regular merge 6 = brown)
            // Create clean snapshot objects WITHOUT spread operator to avoid property conflicts
            const srcSnapshot = { special: srcSpecial };
            const dstSnapshot = { special: dstSpecial };
            spawnMerge6Shards(STATE.board, srcSnapshot, dst, dstSnapshot, { intensity: 0.7, count: 12, spread: 1.1, size: 0.85, vanishDelay: 0.03, behind: true });
          }

        const gx = dst.gridX, gy = dst.gridY;
        STATE.grid[gy][gx] = null;
        dst.visible = false;
        removeTile(dst);

        const holder = makeBoard.createTile({ board: STATE.board, grid: STATE.grid, tiles: STATE.tiles, c: gx, r: gy, val: 0, locked: true });
        holder.alpha = 0.35; holder.eventMode = 'none';
        drawBoardBG(); // Re-enabled for dynamic ghost placeholders

        // Update ghost visibility after tile removal
        if (typeof window.updateGhostVisibility === 'function') {
          window.updateGhostVisibility();
        }

        STATE.moves++; 
        // CRITICAL: Update score BEFORE animating (score is calculated as 6 * multiplier)
        STATE.score += 6 * mult;
        console.log('🎯 MAIN MERGE-6: mult=', mult, 'scoreDelta=', 6 * mult, 'new score=', STATE.score);
        updateHUD();
        animateScore(STATE.score, 0.45);
        
        // Track cubes cracked for stats (count merge-6 events)
        console.log('🔍 BEFORE trackCubesCracked check - typeof:', typeof window.trackCubesCracked);
        console.log('🔍 wildActive:', wildActive, 'typeof trackHelpersUsed:', typeof window.trackHelpersUsed);
        
        if (typeof window.trackCubesCracked === 'function') {
          console.log('✅ CALLING trackCubesCracked(1)');
          window.trackCubesCracked(1);
          console.log('✅ trackCubesCracked returned');
        } else {
          console.error('❌ trackCubesCracked is not a function!', typeof window.trackCubesCracked);
        }
        
        // Track wild cube usage as helper (any wild involvement)
        if (typeof window.trackHelpersUsed === 'function' && wildActive) {
          console.log('✅ CALLING trackHelpersUsed(1)');
          window.trackHelpersUsed(1);
        } else {
          console.log('⏭️ Skipping trackHelpersUsed - function exists:', typeof window.trackHelpersUsed === 'function', 'wildActive:', wildActive);
        }

        // reset meter by consuming one full charge and keep any overflow
        const leftover = Math.max(0, (STATE.wildMeter || 0) - 1);
        STATE.wildMeter = leftover;
        const displayRatio = Math.min(1, leftover);
        console.log('🔥 RESET: Consumed one wild charge, leftover meter:', leftover, 'display:', displayRatio);
        if (updateProgressBar) {
          updateProgressBar(displayRatio, true);
          console.log('✅ RESET: updateProgressBar called successfully');
        } else {
          console.error('❌ RESET: updateProgressBar is not defined!');
        }

        const depth = Math.min(4, combined);
        // 🔥 CRITICAL: For wild-magnet merge with 4 pulled tiles, spawn 3 new tiles
        // Check if this is wild-magnet merge by checking if src or dst was wild-magnet
        const isWildMagnetMerge = srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet';
        const toOpen = isWildMagnetMerge ? 3 : (REFILL_ON_SIX_BY_DEPTH[depth-1] || 2); // Wild-magnet = 3, else default

        // 🔥 CRITICAL: ALWAYS spawn tiles after merge 6, regardless of shouldRefillAfterMerge
        // The old code would skip spawning if shouldRefillAfterMerge=false, causing merge 6 to freeze
        // We need to spawn first, THEN check if board is clean
        console.log('🎯 Merge 6: Spawning', toOpen, 'new tiles (shouldRefillAfterMerge:', shouldRefillAfterMerge, ')');
        
        if (!STATE.wildGuaranteedOnce){
          await openAtCell(gx, gy, { isWild:true });
          STATE.wildGuaranteedOnce = true;
          const rest = Math.max(0, toOpen - 1);
          if (rest > 0) await openEmpties(rest, { exclude: avoidValue });
        } else {
          await openEmpties(toOpen, { exclude: avoidValue });
        }
        
        // CRITICAL FIX: For wild merges, always spawn additional tiles to prevent wild cubes from getting stuck
        if (wildActive) {
          console.log('🎯 Wild merge (effSum=6) completed, spawning additional tiles to prevent wild cubes from getting stuck');
          // Spawn 1-2 additional tiles after wild merge to ensure board doesn't get stuck
          const additionalSpawnCount = Math.min(2, Math.max(1, Math.floor(Math.random() * 2) + 1));
          try {
            await openEmpties(additionalSpawnCount, { exclude: avoidValue });
            console.log('✅ Spawned', additionalSpawnCount, 'additional tiles after wild merge (effSum=6)');
          } catch (error) {
            console.warn('⚠️ Failed to spawn additional tiles after wild merge (effSum=6):', error);
          }
        }

        // 🔥 CRITICAL: Use centralized endgame checker instead of old isBoardClean()
        // Old isBoardClean() from app-board.js was causing false positives when tiles were locked
        const { checkEndGame } = await import('./endgame-checker.js');
        const endgameResult = checkEndGame({
          tiles: STATE.tiles,
          moves: 999, // Not relevant for clean board check
          makeBoard: { anyMergePossible: makeBoard.anyMergePossible }
        }, true); // forceRefresh = true
        
        console.log('🔥 Checking endgame after merge 6 and spawn:', endgameResult);
        
        if (endgameResult.type === 'clean') {
          console.log('🚨🚨🚨 BOARD IS CLEAN AFTER MERGE 6 - STARTING ENDGAME FLOW! 🚨🚨🚨');
          
          // SUCCESS haptic for clean board
          if (typeof (window as any).triggerHapticNotification === 'function') {
            (window as any).triggerHapticNotification('success');
          }
          
          STATE.busyEnding = true;
          
          // CRITICAL: Reset wild meter immediately to prevent visual residue
          console.log('🔥 CLEAN BOARD: Resetting wild meter immediately...');
          STATE.wildMeter = 0;
          if (updateProgressBar) {
            updateProgressBar(0, true); // instant = true for immediate reset
          }
          
          try {
            try { await new Promise(res => setTimeout(res, 1000)); } catch {}
            const { runEndgameFlow } = await import('./endgame-flow.js');
            await runEndgameFlow({
              app: STATE.app,
              stage: STATE.stage,
              board: STATE.board,
              boardBG: STATE.boardBG,
              level: STATE.level,
              startLevel: (n: number) => { console.log('startLevel called with', n); },
              score: STATE.score,
              getScore: () => STATE.score,
              setScore: (v: number) => { STATE.score = v|0; updateHUD(); },
              animateScore: (score: number, dur?: number) => { 
                try { HUD.animateScore?.({ scoreRef: () => STATE.score, setScore: (v: number) => { STATE.score = v; updateHUD(); }, updateHUD }); } catch {} 
              },
              updateHUD,
              boardNumber: 1,
              hideGrid: () => { try { if (STATE.board) STATE.board.visible = false; } catch {} },
              showGrid: () => { try { if (STATE.board) STATE.board.visible = true; } catch {} }
            });
            console.log('✅ Endgame flow completed');
          } catch (error) {
            console.error('❌ Error in endgame flow:', error);
            STATE.busyEnding = false;
          }
          return; // Exit early - don't call checkGameOver()
        }

        // 🔥 REMOVED: Old buggy check that caused premature stars modal
        // Bug: STATE.tiles.every(t => t.locked || t.value <= 0) returned true when tiles were locked
        // This caused stars modal to show before new tiles spawned after merge 6
        // Now we rely on checkGameOver() which uses centralized endgame checker with proper delays
        
        // 🔥 CRITICAL: Wait for spawn animations to complete before checking endgame
        // Spawn bounce takes ~580ms, so we wait 800ms to be safe
        await new Promise(res => setTimeout(res, 800));
        
        checkGameOver();
      }
    });
    return;
  }

  // >6 (shouldn't happen)
  wobble(dst);
  helpers.snapBack(src);
  dst.eventMode = 'static';
}

export async function checkGameOver(){
  if (triggerCentralEndgameCheck('app-merge.checkGameOver')) return;
  console.warn('⚠️ app-merge.checkGameOver: Centralized checker not available, skipping legacy flow.');
}
