// src/modules/app-merge.js
import { gsap } from 'gsap';
import { STATE, ENDLESS, REFILL_ON_SIX_BY_DEPTH } from './app-state.js';
import * as makeBoard from './board.js';
import { glassCrackAtTile, woodShardsAtTile, innerFlashAtTile, showMultiplierTile, screenShake, wildImpactEffect, smokeBubblesAtTile, stopWildIdle } from './fx.js';
import { COLS, ROWS, TILE, GAP } from './constants.js';
import * as HUD from './hud-helpers.js';
import { openAtCell, openEmpties, spawnBounce } from './app-spawn.ts';
import { showStarsModal } from './stars-modal.js';
import { showBoardFailModal } from './board-fail-modal.js';
import { rebuildBoard } from './app-board.js';
import { drawBoardBG } from './app-core.js';

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

function play(name, vol=null){ /* muted */ }
function removeTile(t){
  if(!t) return;
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

// Handle wild-magnet merged pulled tiles: IMMEDIATELY when magnet is dropped, merge tiles that were pulled during drag
export async function handleWildMagnetMergedPulledTiles(dst: any, pulledTiles: any[], helpers: any): Promise<void> {
  console.log('🧲 WILD-MAGNET merging', pulledTiles?.length || 0, 'pulled tiles IN MIDDLE of animation at position:', dst?.x, dst?.y);
  console.log('🧲 Destination tile:', dst, 'pulledTiles:', pulledTiles);
  
  // CRITICAL: Pulled tiles merge together FIRST (hard merge), then create merge 6
  // This creates a second merge 6 at the same location as the main merge 6
  
  if (!dst || dst.destroyed) {
    console.warn('⚠️ Destination is invalid, skipping pulled tiles merge');
    if (pulledTiles && pulledTiles.length > 0) {
      pulledTiles.forEach((pulledTile: any) => {
        if (pulledTile && !pulledTile.destroyed) {
          gsap.killTweensOf(pulledTile);
          removeTile(pulledTile);
        }
      });
    }
    return;
  }
  
  // CRITICAL: Get destination position from grid coordinates (more reliable than x/y)
  // Use gridX/gridY to calculate position using cellXY formula
  let targetX = 0;
  let targetY = 0;
  
  if (dst.gridX !== undefined && dst.gridY !== undefined) {
    // Calculate position from grid coordinates: x = c * (TILE + GAP), y = r * (TILE + GAP)
    targetX = dst.gridX * (TILE + GAP);
    targetY = dst.gridY * (TILE + GAP);
    console.log('🧲 Target position from grid:', dst.gridX, dst.gridY, '->', targetX, targetY);
  } else if (dst.x !== undefined && dst.y !== undefined) {
    // Fallback to x/y if grid coordinates not available
    targetX = dst.x;
    targetY = dst.y;
    console.log('🧲 Target position from x/y:', targetX, targetY);
  } else {
    // Try to get bounds as last resort
    try {
      const bounds = dst.getBounds();
      if (bounds) {
        targetX = bounds.x + bounds.width / 2;
        targetY = bounds.y + bounds.height / 2;
        console.log('🧲 Target position from bounds:', targetX, targetY);
      }
    } catch {}
  }
  
  console.log('🧲 Final target position:', targetX, targetY);
  console.log('🧲 Destination tile:', {
    gridX: dst.gridX,
    gridY: dst.gridY,
    x: dst.x,
    y: dst.y,
    destroyed: dst.destroyed
  });
  
  if (!targetX && !targetY) {
    console.warn('⚠️ Destination position is invalid, skipping pulled tiles merge');
    if (pulledTiles && pulledTiles.length > 0) {
      pulledTiles.forEach((pulledTile: any) => {
        if (pulledTile && !pulledTile.destroyed) {
          gsap.killTweensOf(pulledTile);
          removeTile(pulledTile);
        }
      });
    }
    return;
  }
  
  if (!pulledTiles || pulledTiles.length === 0) {
    console.warn('⚠️ No pulled tiles provided, skipping merge');
    return;
  }
  
  // CRITICAL: Validate pulled tiles are still available
  const validPulledTiles = pulledTiles.filter((pt: any) => pt && !pt.destroyed && STATE.tiles.includes(pt));
  
  if (validPulledTiles.length < 2) {
    console.warn('⚠️ Not enough valid pulled tiles for merge, removing remaining ones');
    validPulledTiles.forEach((pulledTile: any) => {
      if (pulledTile && !pulledTile.destroyed) {
        gsap.killTweensOf(pulledTile);
        removeTile(pulledTile);
      }
    });
    return;
  }
  
  // CRITICAL: First, merge pulled tiles together (hard merge - they crash into each other)
  const tile1 = validPulledTiles[0];
  const tile2 = validPulledTiles[1];
  
  if (tile1 && !tile1.destroyed && tile2 && !tile2.destroyed) {
    console.log('🧲 HARD MERGE: Pulled tiles crashing into each other at', targetX, targetY);
    
    // Stop all animations on both tiles
    gsap.killTweensOf(tile1);
    gsap.killTweensOf(tile1.rotG);
    gsap.killTweensOf(tile1.scale);
    gsap.killTweensOf(tile2);
    gsap.killTweensOf(tile2.rotG);
    gsap.killTweensOf(tile2.scale);
    
    // Clear from grid
    if (tile1.gridX !== undefined && tile1.gridY !== undefined) {
      STATE.grid[tile1.gridY][tile1.gridX] = null;
    }
    if (tile2.gridX !== undefined && tile2.gridY !== undefined) {
      STATE.grid[tile2.gridY][tile2.gridX] = null;
    }
    
    // Set zIndex so they're visible
    tile1.visible = true;
    tile1.alpha = 1;
    tile1.zIndex = 9999;
    tile2.visible = true;
    tile2.alpha = 1;
    tile2.zIndex = 9998;
    
    console.log('🧲 Tile1 position:', tile1.x, tile1.y, 'Tile2 position:', tile2.x, tile2.y);
    console.log('🧲 Target position:', targetX, targetY);
    
    // Animate both tiles moving to destination (crashing into each other)
    await Promise.all([
      new Promise<void>((resolve) => {
        gsap.to(tile1, {
          x: targetX - 10, // Slight offset for crash effect
          y: targetY - 10,
          duration: 0.20,
          ease: 'power2.out',
          onComplete: () => {
            console.log('✅ Tile1 moved to crash position');
            resolve();
          }
        });
      }),
      new Promise<void>((resolve) => {
        gsap.to(tile2, {
          x: targetX + 10, // Slight offset for crash effect
          y: targetY + 10,
          duration: 0.20,
          ease: 'power2.out',
          onComplete: () => {
            console.log('✅ Tile2 moved to crash position');
            resolve();
          }
        });
      })
    ]);
    
    // HARD CRASH: Both tiles scale down and crash into each other
    await Promise.all([
      new Promise<void>((resolve) => {
        gsap.to(tile1, {
          x: targetX,
          y: targetY,
          scaleX: 0.5,
          scaleY: 0.5,
          duration: 0.12,
          ease: 'power2.in',
          onComplete: () => {
            console.log('✅ Tile1 crashed');
            resolve();
          }
        });
      }),
      new Promise<void>((resolve) => {
        gsap.to(tile2, {
          x: targetX,
          y: targetY,
          scaleX: 0.5,
          scaleY: 0.5,
          duration: 0.12,
          ease: 'power2.in',
          onComplete: () => {
            console.log('✅ Tile2 crashed');
            resolve();
          }
        });
      })
    ]);
    
    // Remove both tiles
    [tile1, tile2].forEach((pulledTile: any) => {
      if (pulledTile && !pulledTile.destroyed) {
        console.log('🧹 Removing pulled tile at', pulledTile.x, pulledTile.y);
        gsap.killTweensOf(pulledTile);
        if (pulledTile.parent) {
          pulledTile.parent.removeChild(pulledTile);
        }
        STATE.tiles = STATE.tiles.filter((t: any) => t !== pulledTile);
        pulledTile.destroy?.({ children: true, texture: false, textureSource: false });
      }
    });
    
    console.log('✅ Both pulled tiles removed');
  } else {
    console.warn('⚠️ Pulled tiles are invalid, cannot merge');
    return;
  }
  
  // CRITICAL: Now create merge 6 at the same location with full effects
  // Set destination stackDepth to 4 for x4 multiplier
  // Previous stackDepth was 2 (from main merge), now increase to 4 for x4 multiplier
  if (dst && !dst.destroyed) {
    console.log('🧲 Creating merge 6 at destination with stackDepth 4 (for x4 multiplier)');
    console.log('🧲 Previous stackDepth:', dst.stackDepth);
    
    // CRITICAL: Set stackDepth to 4 explicitly for x4 multiplier
    // Main merge set it to 2, now we need 4 total
    dst.stackDepth = 4;
    makeBoard.drawStack(dst);
    makeBoard.setValue(dst, 6, 0);
    
    console.log('🧲 New stackDepth:', dst.stackDepth);
    
    // Perform merge 6 effects with x4 multiplier
    await performMerge6Effects(dst, helpers);
    console.log('✅ Merge 6 effects completed with stackDepth', dst.stackDepth);
  } else {
    console.warn('⚠️ Destination tile is destroyed, cannot create merge 6');
  }
  
  console.log('✅ Pulled tiles merge completed');
  
  // Clean up original position references
  pulledTiles.forEach((pulledTile: any) => {
    if (pulledTile) {
      pulledTile._wildMagnetOriginalX = undefined;
      pulledTile._wildMagnetOriginalY = undefined;
      pulledTile._wildMagnetAffected = undefined;
      pulledTile._wildMagnetMergeValue = undefined;
    }
  });
  
  // CRITICAL: Clear pulled tiles from drag state after merge completes
  if (helpers && (helpers as any).wildMagnetPulledTiles) {
    (helpers as any).wildMagnetPulledTiles = null;
  }
}

// Handle wild-magnet pull: after merge 6, pull 2 nearest tiles and merge them sequentially
async function handleWildMagnetPullAfterMerge(dst: any, helpers: any): Promise<void> {
  console.log('🧲 WILD-MAGNET pull after merge 6 triggered!');
  
  // Small delay after merge 6 effects
  await new Promise(resolve => setTimeout(resolve, 400));
  
  // Find 2 nearest tiles to attract (excluding wild and wild-magnet)
  const nearestTiles = findNearestTiles(dst, 2);
  console.log('🧲 Found', nearestTiles.length, 'tiles to attract');
  
  if (nearestTiles.length === 0) {
    // No tiles to attract, we're done
    return;
  }
  
  // Attract tiles (pull all simultaneously)
  const pullPromises = nearestTiles.map((tile: any) => animateMagnetPull(tile, dst));
  await Promise.all(pullPromises);
  
  // Small delay after pull completes
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // NOW: Merge each attracted tile sequentially into dst (creating merge 6 each time)
  for (let i = 0; i < nearestTiles.length; i++) {
    const attractedTile = nearestTiles[i];
    if (!attractedTile || attractedTile.destroyed || !STATE.tiles.includes(attractedTile)) {
      continue; // Skip if tile was destroyed or removed
    }
    
    // Move tile to destination position if not already there
    if (attractedTile.x !== dst.x || attractedTile.y !== dst.y) {
      attractedTile.x = dst.x;
      attractedTile.y = dst.y;
    }
    
    // Clear from grid
    if (attractedTile.gridX !== undefined && attractedTile.gridY !== undefined) {
      STATE.grid[attractedTile.gridY][attractedTile.gridX] = null;
    }
    
    // Increase stack depth
    dst.stackDepth = Math.min(4, (dst.stackDepth || 1) + 1);
    makeBoard.drawStack(dst);
    
    // Animate merge
    await new Promise<void>((resolve) => {
      gsap.to(attractedTile, {
        scaleX: 0.8,
        scaleY: 0.8,
        alpha: 0,
        duration: 0.10,
        ease: 'power2.out',
        onComplete: () => {
          removeTile(attractedTile);
          resolve();
        }
      });
    });
    
    // Merge 6 effects for each merge
    await performMerge6Effects(dst, helpers);
    
    // Small delay between merges
    if (i < nearestTiles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
}

// Helper function to perform merge 6 effects
async function performMerge6Effects(tile: any, helpers: any): Promise<void> {
  // CRITICAL: Use actual stackDepth for multiplier (up to x4)
  // For pulled tiles merge, stackDepth should be 4 for x4 multiplier
  const actualMult = tile.stackDepth || 1;
  const mult = actualMult >= 4 ? 4 : (actualMult >= 3 ? 3 : actualMult); // Use actual depth (up to x4)
  
  console.log('🎯 performMerge6Effects: stackDepth=', actualMult, 'multiplier=', mult);
  
  // Use existing merge 6 effects from the codebase
  try {
    screenShake(STATE.app, { strength: Math.min(24, 10 + Math.max(1, mult) * 3), duration: 0.34, steps: 18, ease: 'power2.out' });
  } catch {}
  
  try {
    const softSmokeStrength = 0.6 + Math.random() * 0.3;
    smokeBubblesAtTile(STATE.board, tile, {
      tileSize: TILE,
      strength: softSmokeStrength,
      behind: true,
      sizeScale: 0.557,
      distanceScale: 0.30,
      countScale: 0.8,
      haloScale: 1.15,
      ttl: 1.0,
      startScale: 0.42
    });
  } catch {}
  
  try {
    woodShardsAtTile(STATE.board, tile, { intensity: 0.7, count: 12, spread: 1.1, size: 0.85, vanishDelay: 0.03, behind: true });
  } catch {}
  
  // CRITICAL: Update score with multiplier (like main merge function)
  // For pulled tiles merge, use actual stackDepth (up to x4)
  // Note: actualMult is already declared above, so use it directly
  const scoreMult = actualMult >= 4 ? 4 : (actualMult >= 3 ? 3 : actualMult); // Use actual depth (up to x4)
  const scoreDelta = 6 * scoreMult;
  STATE.score += scoreDelta;
  console.log('🎯 performMerge6Effects: stackDepth=', actualMult, 'scoreMult=', scoreMult, 'scoreDelta=', scoreDelta, 'new score=', STATE.score);
  updateHUD();
  
  // Combo bump
  try { HUD.bumpCombo?.({ kind: 'merge6' }); } catch {}
  
  // Add wild progress
  const inc = 0.22;
  const previous = STATE.wildMeter || 0;
  STATE.wildMeter = Math.max(0, previous + inc);
  const displayRatio = Math.min(1, STATE.wildMeter);
  if (updateProgressBar) {
    updateProgressBar(displayRatio, true);
  }
  
  tile.eventMode = 'static';
}

export function merge(src, dst, helpers){
  if (STATE.busyEnding) { helpers.snapBack?.(src); return; }
  if (src === dst) { helpers.snapBack(src); return; }

  // 3D Effects - Add merging animation
  if (window.threeDEffects && window.threeDEffects.is3DEnabled) {
    window.threeDEffects.animateMerge(src, dst);
  }

  // Check if this is a wild-magnet merge (for special pull logic after merge 6)
  const isWildMagnet = src.special === 'wild-magnet';
  
  const sum      = src.value + dst.value;
  const srcDepth = src.stackDepth || 1;
  const dstDepth = dst.stackDepth || 1;

  const srcGX = src.gridX, srcGY = src.gridY;
  // Wild-magnet works like wild: always merges to 6
  const wildActive = (src.special === 'wild' || dst.special === 'wild' || src.special === 'wild-magnet' || dst.special === 'wild-magnet');
  const wildTargetValue = wildActive ? ((src.special === 'wild' || src.special === 'wild-magnet') ? (dst.value|0) : (src.value|0)) : null;
  const effSum = wildActive ? 6 : sum;
  
  console.log('🔥 MERGE DEBUG:', { 
    wildActive, 
    srcSpecial: src.special, 
    dstSpecial: dst.special,
    srcValue: src.value,
    dstValue: dst.value,
    effSum 
  });
  
  if (wildActive) {
    console.log('🎯 WILD MERGE DETECTED! Should trigger enhanced effects...');
  } else {
    console.log('❌ NOT a wild merge - src.special:', src.special, 'dst.special:', dst.special);
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
    const inc = 0.25; // 4 small merges to full
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

    // WILD-MAGNET: Check for pulled tiles BEFORE animation starts
    const pulledTiles = (helpers as any).wildMagnetPulledTiles || (src as any)._wildMagnetPulledTiles;
    const hasPulledTiles = isWildMagnet && pulledTiles && pulledTiles.length > 0;
    
    console.log('🔥 MERGE-6 DEBUG:', {
      isWildMagnet,
      hasPulledTiles,
      pulledTilesCount: pulledTiles?.length || 0,
      pulledTiles: pulledTiles,
      helpersHasPulledTiles: !!(helpers as any).wildMagnetPulledTiles,
      srcHasPulledTiles: !!(src as any)._wildMagnetPulledTiles
    });

    gsap.to(src, {
      x: dst.x, y: dst.y, duration: 0.10, ease: 'power2.out',
      onComplete: async () => {
        removeTile(src);
        
        // CRITICAL FIX: Check for wild cubes properly (including wild-magnet)
        const allTiles = STATE.tiles.filter(t => t && !t.locked);
        const wildCubes = allTiles.filter(t => t.special === 'wild' || t.special === 'wild-magnet');
        const nonWildTiles = allTiles.filter(t => t.special !== 'wild' && t.special !== 'wild-magnet');
        const willClean = wildCubes.length === 0 && nonWildTiles.length <= 1;
        
        // WILD-MAGNET: Re-check pulled tiles in case they weren't available before
        const pulledTilesFinal = (helpers as any).wildMagnetPulledTiles || (src as any)._wildMagnetPulledTiles;
        const hasPulledTilesFinal = isWildMagnet && pulledTilesFinal && pulledTilesFinal.length > 0;
        
        console.log('🔥 MERGE-6 onComplete DEBUG:', {
          isWildMagnet,
          hasPulledTilesFinal,
          pulledTilesFinalCount: pulledTilesFinal?.length || 0,
          willClean,
          dstValid: dst && !dst.destroyed,
          dstX: dst?.x,
          dstY: dst?.y
        });
        
        // WILD-MAGNET: Merge pulled tiles IMMEDIATELY after main merge animation starts
        // This creates a second merge 6 at the same location, making it look like 2 merges happen
        if (hasPulledTilesFinal && !willClean && dst && !dst.destroyed) {
          console.log('🧲 WILD-MAGNET: Starting pulled tiles merge IMMEDIATELY after main merge');
          console.log('🧲 Destination tile:', dst.x, dst.y, 'stackDepth:', dst.stackDepth);
          console.log('🧲 Pulled tiles:', pulledTilesFinal);
          
          // CRITICAL: Merge pulled tiles IMMEDIATELY (don't wait, execute now)
          // Use async/await to ensure it happens synchronously
          try {
            console.log('🧲 Calling handleWildMagnetMergedPulledTiles...');
            await handleWildMagnetMergedPulledTiles(dst, pulledTilesFinal, helpers);
            console.log('✅ Pulled tiles merge completed successfully');
          } catch (err) {
            console.error('❌ Error merging pulled tiles:', err);
            console.error('❌ Error stack:', err instanceof Error ? err.stack : 'No stack trace');
            // Fallback: remove pulled tiles if merge fails
            if (pulledTilesFinal && pulledTilesFinal.length > 0) {
              pulledTilesFinal.forEach((pulledTile: any) => {
                if (pulledTile && !pulledTile.destroyed) {
                  console.log('🧹 Force removing pulled tile at', pulledTile.x, pulledTile.y);
                  gsap.killTweensOf(pulledTile);
                  removeTile(pulledTile);
                }
              });
            }
          }
        } else {
          console.log('⚠️ WILD-MAGNET: Skipping pulled tiles merge');
          console.log('⚠️ hasPulledTilesFinal:', hasPulledTilesFinal, 'willClean:', willClean, 'dstValid:', dst && !dst.destroyed);
          if (isWildMagnet && !willClean && !hasPulledTilesFinal) {
            // If no pulled tiles, trigger magnet pull after merge 6 (before cleanup/refill)
            console.log('🧲 No pulled tiles, triggering magnet pull after merge');
            handleWildMagnetPullAfterMerge(dst, helpers).catch((err) => {
              console.warn('⚠️ Error in wild-magnet pull:', err);
            });
          }
        }
        
        console.log('🔥 MERGE-6 willClean check:', {
          totalActiveTiles: allTiles.length,
          wildCubesCount: wildCubes.length,
          nonWildTilesCount: nonWildTiles.length,
          willClean,
          wildCubes: wildCubes.map(t => ({
            value: t.value,
            special: t.special,
            locked: t.locked,
            gridX: t.gridX,
            gridY: t.gridY
          })),
          nonWildTiles: nonWildTiles.map(t => ({
            value: t.value,
            special: t.special,
            locked: t.locked,
            gridX: t.gridX,
            gridY: t.gridY
          }))
        });

        if (!willClean) {
          await landPreBounce(dst);
          showMultiplierTile(STATE.board, dst, mult, 120, 1.0);
          
          if (wildActive) {
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
            
            woodShardsAtTile(STATE.board, dst, { enhanced: true, wild: true, intensity: 1.8, vanishDelay: 0.0, vanishJitter: 0.02 });
            woodShardsAtTile(STATE.board, dst, { enhanced: true, wild: true, intensity: 1.45, speed: 0.9, sizeBoost: 1.3, vanishDelay: 0.0, vanishJitter: 0.02 });

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
            woodShardsAtTile(STATE.board, dst, { intensity: 0.7, count: 12, spread: 1.1, size: 0.85, vanishDelay: 0.03, behind: true });
          }
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
        const toOpen = REFILL_ON_SIX_BY_DEPTH[depth-1] || 2; // default 2

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

        if (STATE.tiles.every(t => t.locked || t.value <= 0)){
          // Track highest board reached in alt merge flow
          try { if (typeof window.trackHighestBoard === 'function') window.trackHighestBoard(STATE.level); } catch {}
          try { await new Promise(res => setTimeout(res, 1000)); } catch {}
          await showStarsModal({ app: STATE.app, stage: STATE.stage, board: STATE.board, score: STATE.score, thresholds:{one:120,two:240,three:360}, buttonLabel:'Keep Going' });
          STATE.score = 0; STATE.moves = 0; updateHUD();
        }
        checkGameOver();
      }
    });
    return;
  }

  // >6 (shouldn’t happen)
  wobble(dst);
  helpers.snapBack(src);
  dst.eventMode = 'static';
}

export async function checkGameOver(){
  if (STATE.busyEnding) {
    console.log('⏳ checkGameOver skipped - end sequence already running');
    return;
  }
  console.log('🔥 checkGameOver called');
  
  const activeTiles = STATE.tiles.filter(t => !t.locked && t.value > 0);
  const wildCubes = activeTiles.filter(t => t.special === 'wild' || t.special === 'wild-magnet');
  const nonWildTiles = activeTiles.filter(t => t.special !== 'wild' && t.special !== 'wild-magnet');
  
  console.log('🔥 checkGameOver state:', {
    totalTiles: STATE.tiles.length,
    activeTiles: activeTiles.length,
    wildCubes: wildCubes.length,
    nonWildTiles: nonWildTiles.length,
    activeTileDetails: activeTiles.map(t => ({ 
      value: t.value, 
      special: t.special, 
      locked: t.locked,
      gridX: t.gridX,
      gridY: t.gridY 
    }))
  });
  
  if (makeBoard.anyMergePossible(STATE.tiles)) {
    console.log('🎯 anyMergePossible returned true, game continues');
    return;
  }
  
  // CRITICAL FIX: Check for wild cube merges before game over (including wild-magnet)
  const active = STATE.tiles.filter(t => t && !t.locked && t.value > 0);
  const activeWildCubes = active.filter(t => t.special === 'wild' || t.special === 'wild-magnet');
  const activeNonWildTiles = active.filter(t => t.special !== 'wild' && t.special !== 'wild-magnet');

  console.log('🎯 Active tiles:', active.length, 'Wild cubes:', activeWildCubes.length, 'Non-wild tiles:', activeNonWildTiles.length);

  // EMERGENCY SAFETY: If we have wild cubes but no non-wild tiles, spawn some!
  if (activeWildCubes.length > 0 && activeNonWildTiles.length === 0) {
    console.log('🚨 EMERGENCY: Wild cubes exist but no non-wild tiles! Spawning emergency tiles...');
    // Spawn 2-3 emergency tiles to prevent wild cubes from getting stuck
    const emergencyCount = Math.min(3, Math.max(2, activeWildCubes.length));
    openEmpties(emergencyCount).then(() => {
      console.log('✅ Emergency tiles spawned, checking again...');
      checkGameOver(); // Check again after spawning
    }).catch(error => {
      console.error('❌ Emergency spawn failed:', error);
      // If emergency spawn fails, proceed with normal game over
    });
    return;
  }
  
  const hasWildMerge = () => {
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        // Wild cube can merge with any non-wild tile
        const aIsWild = (a.special === 'wild' || a.special === 'wild-magnet');
        const bIsWild = (b.special === 'wild' || b.special === 'wild-magnet');
        if ((aIsWild && !bIsWild) || (bIsWild && !aIsWild)) {
          console.log('🎯 Wild merge found:', aIsWild ? a.special : a.value, 'with', bIsWild ? b.special : b.value);
          return true;
        }
      }
    }
    return false;
  };
  
  if (hasWildMerge()) {
    console.log('🎯 Wild cube merge possible, game continues');
    return;
  }
  
  console.log('🚨 No merges possible, game over!');
  
  // Haptic feedback for game over
  console.log('🔍 HAPTIC CHECK (game over):', { 
    hasTriggerHaptic: typeof (window as any).triggerHaptic === 'function'
  });
  
  // Use same bridge as Continue/New Game buttons
  if (typeof (window as any).triggerHaptic === 'function') {
    console.log('📳 CALLING triggerHaptic (game over)');
    (window as any).triggerHaptic();
  } else {
    console.warn('⚠️ triggerHaptic function not available (game over)!');
  }

  if (active.length === 2){
    const add = (active[0].value|0) + (active[1].value|0);
    if (add > 0){ STATE.score += add; updateHUD(); }
  }

  if (STATE.score > STATE.bestScore){
    STATE.bestScore = STATE.score;
    try { localStorage.setItem('cc_best_score_v1', STATE.bestScore); } catch {}
    updateHUD();
  }

  // Update stats before showing stars modal
  if (typeof window.updateHighScore === 'function') {
    window.updateHighScore(STATE.score);
  }
  
  // Do not estimate cubes cracked by score; only count real merge-6 events in merge()
  
  if (typeof window.checkCollectiblesMilestones === 'function') {
    // Check for collectibles based on score milestones
    window.checkCollectiblesMilestones(STATE.score);
  }

  STATE.busyEnding = true;

  const levelNumber = Math.max(1, STATE.level | 0);
  const scoreValue = Math.max(0, STATE.score | 0);

  let action = 'retry';

  try {
    try {
      const result = await showBoardFailModal({
        score: scoreValue,
        boardNumber: levelNumber
      });
      action = result?.action || 'retry';
    } catch (error) {
      console.error('❌ showBoardFailModal failed, falling back to stars modal:', error);
      try {
        await showStarsModal({
          app: STATE.app,
          stage: STATE.stage,
          board: STATE.board,
          score: scoreValue,
          thresholds:{ one:Infinity, two:Infinity, three:Infinity },
          buttonLabel:'Retry'
        });
      } catch (fallbackError) {
        console.error('❌ Fallback stars modal failed:', fallbackError);
      }
      action = 'retry';
    }

    if (action === 'menu') {
      try {
        // Navigation will be shown by markHomepageVisible() after slide animation
        
        await window.exitToMenu?.();
        window.goToSlide?.(0, { animate: true });
      } catch (error) {
        console.warn('⚠️ exitToMenu failed, reloading as fallback:', error);
        try { window.location.reload(); } catch {}
      }
      return;
    }

    let usedCCRelaunch = false;

    if (window.CC?.restart) {
      try {
        window.CC.restart();
        usedCCRelaunch = true;
      } catch (error) {
        console.warn('⚠️ window.CC.restart failed, falling back to manual restart:', error);
      }
    }

    if (!usedCCRelaunch) {
      STATE.score = 0;
      STATE.moves = 0;
      STATE.wildMeter = 0;

      try {
        if (typeof HUD.resetWildMeter === 'function') {
          HUD.resetWildMeter(true);
        } else if (typeof HUD.updateProgressBar === 'function') {
          HUD.updateProgressBar(0, false);
        }
      } catch (error) {
        console.warn('⚠️ Failed to reset wild meter during retry:', error);
      }

      updateHUD();

      rebuildBoard();                  // ✅ no more fake dynamic imports
    } else {
      // ensure HUD reflects reset when restart handled elsewhere
      try { updateHUD(); } catch {}
    }

    setTimeout(() => {
      try { checkGameOver(); } catch (error) {
        console.warn('⚠️ checkGameOver retry call failed:', error);
      }
    }, 1000);
  } finally {
    STATE.busyEnding = false;
  }
}
