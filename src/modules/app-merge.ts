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
import { rebuildBoard, isBoardClean } from './app-board.js';
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

// Simple function to merge pulled tiles: ignores pips and forces merge to 6
function mergePulledTiles(tile1: any, tile2: any, mergeX: number, mergeY: number, helpers: any): void {
  if (!tile1 || !tile2 || tile1.destroyed || tile2.destroyed) return;
  
  // Stop animations
  gsap.killTweensOf(tile1);
  gsap.killTweensOf(tile2);
  
  // Position both tiles at merge location
  tile1.x = mergeX;
  tile1.y = mergeY;
  tile2.x = mergeX;
  tile2.y = mergeY;
  
  // Mark tiles as magnet-affected so they can merge regardless of pips
  tile1._wildMagnetAffected = true;
  tile2._wildMagnetAffected = true;
  
  // Get merge function from helpers
  const mergeFunction = (helpers as any)?.merge;
  if (!mergeFunction || typeof mergeFunction !== 'function') {
    console.error('❌ Cannot get merge function from helpers');
    return;
  }
  
  // Merge tile1 into tile2 (will create merge 6 because both are _wildMagnetAffected)
  mergeFunction(tile1, tile2, helpers);
}

export async function handleWildMagnetMergedPulledTiles(dst: any, pulledTiles: any[], helpers: any): Promise<boolean> {
  console.log('🧲 handleWildMagnetMergedPulledTiles called with', pulledTiles?.length || 0, 'tiles');
  
  // Filter valid tiles
  const validTiles = (pulledTiles || []).filter((t: any) => t && !t.destroyed);
  
  if (validTiles.length < 2) {
    console.warn('⚠️ Not enough pulled tiles to merge (need 2, got', validTiles.length, ')');
    return false;
  }
  
  const tile1 = validTiles[0];
  const tile2 = validTiles[1];
  
  console.log('🧲 Pulled tiles state:', {
    tile1: { value: tile1.value, special: tile1.special, _wildMagnetAffected: tile1._wildMagnetAffected, destroyed: tile1.destroyed, inTiles: STATE.tiles.includes(tile1) },
    tile2: { value: tile2.value, special: tile2.special, _wildMagnetAffected: tile2._wildMagnetAffected, destroyed: tile2.destroyed, inTiles: STATE.tiles.includes(tile2) },
    dst: { value: dst?.value, special: dst?.special, destroyed: dst?.destroyed, locked: dst?.locked }
  });
  
  // 🔥 CRITICAL: Ensure both tiles are in STATE.tiles array before merging
  if (!STATE.tiles.includes(tile1)) {
    console.warn('⚠️ Tile1 not in STATE.tiles, adding it');
    STATE.tiles.push(tile1);
  }
  if (!STATE.tiles.includes(tile2)) {
    console.warn('⚠️ Tile2 not in STATE.tiles, adding it');
    STATE.tiles.push(tile2);
  }
  
  // 🔥 CRITICAL: Ensure both tiles have _wildMagnetAffected flag set
  if (!tile1._wildMagnetAffected) {
    console.warn('⚠️ Tile1 missing _wildMagnetAffected flag, setting it');
    tile1._wildMagnetAffected = true;
  }
  if (!tile2._wildMagnetAffected) {
    console.warn('⚠️ Tile2 missing _wildMagnetAffected flag, setting it');
    tile2._wildMagnetAffected = true;
  }
  
  const mergeX = dst.x;
  const mergeY = dst.y;
  
  console.log('🧲 Calling mergePulledTiles with tiles at', mergeX, mergeY);
  
  // Merge pulled tiles together (ignores pips, creates merge 6)
  mergePulledTiles(tile1, tile2, mergeX, mergeY, helpers);
  
  console.log('✅ mergePulledTiles called, waiting for merge to complete...');
  
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
        
        // CRITICAL FIX: Check for wild cubes properly (including wild-magnet)
        const allTiles = STATE.tiles.filter(t => t && !t.locked);
        const wildCubes = allTiles.filter(t => t.special === 'wild' || t.special === 'wild-magnet');
        const nonWildTiles = allTiles.filter(t => t.special !== 'wild' && t.special !== 'wild-magnet');
        const willClean = wildCubes.length === 0 && nonWildTiles.length <= 1;

        if (!willClean) {
          await landPreBounce(dst);
          showMultiplierTile(STATE.board, dst, mult, 120, 1.0);
          
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

        // CRITICAL: Check if board is clean AFTER spawning new tiles
        // This must happen BEFORE checkGameOver() to prevent level failed screen
        const isClean = isBoardClean();
        console.log('🔥 Checking if board is clean after merge 6 and spawn:', isClean);
        
        if (isClean) {
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
  
  // CRITICAL: Check if board is clean BEFORE checking merges
  // If board is clean, endgame flow should have been triggered already, but double-check here
  const isClean = isBoardClean();
  if (isClean) {
    console.log('🚨🚨🚨 checkGameOver: Board is CLEAN - should have been handled by merge function!');
    console.log('🚨🚨🚨 This should not happen - clean board should trigger endgame flow in merge function');
    // Don't show level failed if board is clean - this is a safety check
    return;
  }
  
  // Get active tiles first
  const active = STATE.tiles.filter(t => t && !t.locked && t.value > 0);
  const activeWildCubes = active.filter(t => t.special === 'wild' || t.special === 'wild-magnet');
  const activeNonWildTiles = active.filter(t => t.special !== 'wild' && t.special !== 'wild-magnet');

  console.log('🎯 checkGameOver: Active tiles:', active.length, 'Wild cubes:', activeWildCubes.length, 'Non-wild tiles:', activeNonWildTiles.length);
  console.log('🎯 checkGameOver: Active tile values:', active.map(t => ({ value: t.value, special: t.special })));
  
  // CRITICAL: Check if any merges are possible FIRST
  const canMerge = makeBoard.anyMergePossible(STATE.tiles);
  console.log('🎯 checkGameOver: anyMergePossible returned:', canMerge);
  
  if (canMerge) {
    console.log('🎯 anyMergePossible returned true, game continues');
    return;
  }
  
  // If no merges possible, check edge cases
  if (active.length === 0) {
    // No active tiles - this should have been caught by isBoardClean check above
    console.log('🚨 No active tiles - should have been clean board, but showing fail screen as fallback');
    // Continue to show fail screen
  } else if (active.length === 1 && activeWildCubes.length === 0) {
    console.log('🚨 Only one non-wild tile remains, no merges possible - game over!');
    // Continue to show fail screen (fall through to game over logic below)
  } else {
    console.log('🚨 Multiple tiles but no valid merges possible - game over!');
    console.log('🚨 Tile combinations:', active.map(t => t.value).join(', '));
    // Continue to show fail screen
  }

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
  
  // CRITICAL: Double-check wild merges (this should already be covered by anyMergePossible, but safety check)
  const hasWildMerge = () => {
    if (active.length < 2) {
      console.log('🎯 hasWildMerge: Not enough tiles (need 2, have', active.length, ')');
      return false; // Need at least 2 tiles for merge
    }
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
    console.log('🎯 hasWildMerge: No wild merges found');
    return false;
  };
  
  // CRITICAL: If anyMergePossible returned false, we should still check wild merges as safety
  // But if hasWildMerge also returns false, then definitely no merges possible
  const canWildMerge = hasWildMerge();
  console.log('🎯 checkGameOver: hasWildMerge returned:', canWildMerge);
  
  if (canWildMerge) {
    console.log('🎯 Wild cube merge possible (safety check), game continues');
    return;
  }
  
  // CRITICAL: If we reach here, no merges are possible - show fail screen
  console.log('🚨 No merges possible, game over!');
  console.log('🚨 Final check - Active tiles:', active.length, 'Values:', active.map(t => t.value).join(', '));
  
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

  // CRITICAL: Set busyEnding BEFORE showing fail modal to prevent duplicate calls
  STATE.busyEnding = true;
  console.log('🚨 Setting STATE.busyEnding = true before showing fail modal');

  const levelNumber = Math.max(1, STATE.level | 0);
  const scoreValue = Math.max(0, STATE.score | 0);

  console.log('🚨 Showing board fail modal with score:', scoreValue, 'board:', levelNumber);

  let action = 'retry';

  try {
    try {
      const result = await showBoardFailModal({
        score: scoreValue,
        boardNumber: levelNumber
      });
      console.log('✅ Board fail modal returned:', result);
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
