// @ts-nocheck
// src/modules/app-merge.js
import { gsap } from 'gsap';
import { Texture } from 'pixi.js';
import animationManager from './animation-manager.js';
import { STATE } from './app-state.js';
import * as makeBoard from './board.js';
import { screenShake, wildImpactEffect, stopWildIdle, stopWildJuiceBubbles, stopWildStars, stopWildShimmer, stopMagnetIdleParticles, wildMagnetMerge6ShardsTemplated, centerInBoard } from "./fx.ts";
import { COLS, ROWS, TILE, GAP } from './constants.js';
import * as HUD from './hud-helpers.ts';
import { openAtCell, spawnBounce } from './app-spawn.ts';
import { drawBoardBG } from './app-core.js';
import { statsService } from '../services/stats-service.js';
import { arcadeStatsService } from '../services/arcade-stats-service.js';
import { randomRegularTileValue, trackAppTimeout, trackAppAnimationFrame } from './app-core-utils.js';
import { fillNullCellsWithLockedPlaceholders } from './app-core-board-build.ts';
import { fixHoverAnchor } from './app-core-helpers.ts';
import { isArcadeHomeRunMode } from './run-mode.js';
import { getTransientSpawnState } from './tile-state-utils.ts';
import { isPlayableMagnetPullCandidate, isWildLikeTile } from './final-merge-rules.ts';
import {
  clearSpecialDiceIdentity,
  getSpecialDiceShardColors,
  isSpecialDiceDirectWildLikeTile,
  isSpecialDiceStarLikeTile,
  releaseSpecialDiceResolution,
} from './special-dice-registry.ts';
import { collapseTileToSingleStackVisual, removeTileFully } from './tile-lifecycle-service.ts';
import { FINAL_MERGE_REASONS } from './final-merge-reasons.ts';
import { emitIOSSpecialTransactionTrace } from '../utils/ios-special-transaction-trace.ts';
import { createMagnetRespawnPlan, isPlayablePostMagnetTile, resolvePostMagnetEndgameAction, resolvePreMagnetRespawnDecision } from './magnet-post-spawn-resolution.ts';
import { stopSpecialDiceIdleMotion } from './special-dice-idle.ts';

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

const trackTween = (target: any, vars: any) => animationManager.trackExternalTween(gsap.to(target, vars));


// Import updateProgressBar function
const updateProgressBar = HUD.updateProgressBar;
const updateHUD = () => {
  try {
    // 🔥 CRITICAL FIX: Get actual combo value from window.CC.getCombo() instead of hardcoded 0
    // This was causing combo to reset to 0 after magnet pull!
    const currentCombo = typeof (window as any).CC?.getCombo === 'function'
      ? (window as any).CC.getCombo()
      : 0;
    
    if (typeof HUD.updateHUD === 'function') { 
      HUD.updateHUD({ score: STATE.score, board: 1, moves: STATE.moves, combo: currentCombo }); 
      console.log('🔥 MAGNET updateHUD: Updated HUD with combo=', currentCombo);
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

function triggerMagnetQuickHapticBurst(count = 4, intervalMs = 50): void {
  try {
    if (typeof (window as any).triggerHapticImpact !== 'function') return;
    const lastTwoStart = Math.max(0, count - 2);
    for (let i = 0; i < count; i++) {
      const isLastTwo = i >= lastTwoStart;
      const delay = i * intervalMs + (isLastTwo ? 50 : 0);
      const strength: 'light' | 'medium' = isLastTwo ? 'medium' : 'light';
      trackAppTimeout(() => {
        try {
          (window as any).triggerHapticImpact?.(strength);
        } catch {}
      }, delay);
    }
  } catch {}
}

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

async function triggerCentralCleanBoardFlow(reason: string): Promise<boolean> {
  const triggerCleanBoardFlow = (window as any).CC?.triggerCleanBoardFlow;
  if (typeof triggerCleanBoardFlow !== 'function') {
    console.error('❌ triggerCleanBoardFlow unavailable - refusing legacy direct endgame fallback', { reason });
    return false;
  }

  await triggerCleanBoardFlow(reason);
  return true;
}

function play(name, vol=null){ /* muted */ }

function tileIsWild(tile: any): boolean {
  return isWildLikeTile(tile);
}

function tileIsActive(tile: any): boolean {
  if (!tile || tile.destroyed) return false;
  if (tile.visible === false) return false;
  if (typeof tile.alpha === 'number' && tile.alpha <= 0.01) return false;
  
  // 🔥 CRITICAL: Locked tiles with value > 0 are still active (e.g. during magnet pull)
  // Only exclude locked tiles with value 0 (ghost placeholders)
  const value = (tile.value | 0);
  if (value > 0) {
    return true; // Active regardless of locked status
  }
  
  // Wild tiles are active even if locked temporarily
  return tileIsWild(tile);
}

function tileIsTransientForMagnetPull(tile: any): boolean {
  return !isPlayableMagnetPullCandidate(tile, { allowMagnetOwned: true });
}

function removeTile(t){
  removeTileFully(t, {
    board: STATE.board,
    grid: STATE.grid,
    tiles: STATE.tiles,
    setTiles: (nextTiles) => { STATE.tiles = nextTiles; },
    stopWildIdle,
    stopWildShimmer,
    stopWildStars,
    stopWildJuiceBubbles,
    stopMagnetIdleParticles,
    log: console.log,
  });
}

export function clearWildState(tile, opts = undefined){
  if (!tile) return;
  // Optional: skip heavy teardown (detachWildStarHalo, shimmer kill) until after merge tween is scheduled — avoids main-thread hitch when dst is wild star
  if (!opts?.skipStopWildIdle) {
    try { stopWildIdle(tile); } catch {}
  }
  // Only clear direct wild state (not magnet-like, which keeps its special property for pull cleanup).
  if (isSpecialDiceDirectWildLikeTile(tile)) {
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

function pulseBoardZoom(factor = 0.92, opts: any = {}) {
  const board = STATE.board;
  if (!board) return;
  
  // 🔥 MEMORY LEAK FIX: Kill existing timeline AND clear all board tweens
  try { 
    if ((board as any)._wildZoomTl) {
      (board as any)._wildZoomTl.kill(); 
      (board as any)._wildZoomTl = null;
    }
    // Also kill any lingering board tweens
    gsap.killTweensOf(board);
    gsap.killTweensOf(board.scale);
  } catch {}

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

  const tl = trackTimeline({ 
    onComplete: () => { 
      (board as any)._wildZoomTl = null; 
      try { userOnComplete?.(); } catch {} 
    },
    // 🔥 MEMORY LEAK FIX: Auto-kill timeline on complete
    onInterrupt: () => { (board as any)._wildZoomTl = null; }
  });

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

  (board as any)._wildZoomTl = tl;
  return tl;
}

function wobble(t){ 
  if (!t || t.destroyed) return;
  const x0=t.x;
  
  // 🔥 MEMORY LEAK FIX: Kill existing wobble animations first
  try {
    gsap.killTweensOf(t);
    if ((t as any)._wobbleTl) {
      (t as any)._wobbleTl.kill();
      (t as any)._wobbleTl = null;
    }
  } catch {}
  
  // Create timeline with auto-cleanup
  const tl = trackTimeline({ 
    onComplete: () => { (t as any)._wobbleTl = null; },
    onInterrupt: () => { (t as any)._wobbleTl = null; }
  });
  
  tl.to(t,{x:x0+9,rotation:0.06,duration:0.06})
    .to(t,{x:x0-9,rotation:-0.06,duration:0.08})
    .to(t,{x:x0,rotation:0,duration:0.08});
  
  (t as any)._wobbleTl = tl;
}
function landBounce(t){
  if (!t || t.destroyed) return;
  const r0 = (t as any).rotG?.rotation || 0;
  
  // 🔥 MEMORY LEAK FIX: Kill ALL existing animations on tile
  try {
    gsap.killTweensOf(t);
    gsap.killTweensOf(t.scale);
    if ((t as any).rotG) gsap.killTweensOf((t as any).rotG);
    if ((t as any)._bounceTl) {
      (t as any)._bounceTl.kill();
      (t as any)._bounceTl = null;
    }
    if ((t as any)._bounceRotTl) {
      (t as any)._bounceRotTl.kill();
      (t as any)._bounceRotTl = null;
    }
  } catch {}
  
  // nježniji, elastičniji povrat
  const tl = trackTimeline({ 
    onComplete: () => { (t as any)._bounceTl = null; },
    onInterrupt: () => { (t as any)._bounceTl = null; }
  });
  tl.to(t.scale, { x:1.10, y:0.94, duration:0.07, ease:'power2.out' })
    .to(t.scale, { x:1.00, y:1.00, duration:0.24, ease:'elastic.out(1,0.8)' });
  (t as any)._bounceTl = tl;
  
  if ((t as any).rotG){
    const rotTl = trackTimeline({ 
      onComplete: () => { (t as any)._bounceRotTl = null; },
      onInterrupt: () => { (t as any)._bounceRotTl = null; }
    });
    rotTl.to((t as any).rotG, { rotation: r0 + 0.05, duration: 0.06, ease:'power2.out' }, 0)
         .to((t as any).rotG, { rotation: r0,        duration: 0.20, ease:'elastic.out(1,0.8)' });
    (t as any)._bounceRotTl = rotTl;
  }
}
function landPreBounce(t){
  return new Promise<void>((resolve)=>{
    if (!t || t.destroyed) {
      resolve();
      return;
    }
    
    const r0 = (t as any).rotG?.rotation || 0;
    
    // 🔥 MEMORY LEAK FIX: Kill ALL existing animations on tile
    try {
      gsap.killTweensOf(t);
      gsap.killTweensOf(t.scale);
      if ((t as any).rotG) gsap.killTweensOf((t as any).rotG);
      if ((t as any)._preBounceTl) {
        (t as any)._preBounceTl.kill();
        (t as any)._preBounceTl = null;
      }
      if ((t as any)._preBounceRotTl) {
        (t as any)._preBounceRotTl.kill();
        (t as any)._preBounceRotTl = null;
      }
    } catch {}
    
    const tl = trackTimeline({ 
      onComplete: () => { 
        (t as any)._preBounceTl = null; 
        resolve(); 
      },
      onInterrupt: () => { 
        (t as any)._preBounceTl = null; 
        resolve(); 
      }
    });
    tl.to(t.scale, { x:1.10, y:0.94, duration:0.05, ease:'power3.out' })
      .to(t.scale, { x:1.00, y:1.00, duration:0.07, ease:'back.out(2)' });
    (t as any)._preBounceTl = tl;
    
    if ((t as any).rotG){
      const rotTl = trackTimeline({ 
        onComplete: () => { (t as any)._preBounceRotTl = null; },
        onInterrupt: () => { (t as any)._preBounceRotTl = null; }
      });
      rotTl.to((t as any).rotG, { rotation: r0 + 0.05, duration: 0.05, ease:'power2.out' }, 0)
           .to((t as any).rotG, { rotation: r0,        duration: 0.07, ease:'back.out(2)' });
      (t as any)._preBounceRotTl = rotTl;
    }
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
  try {
    // Get active tiles only
    // 🔥 CRITICAL: Use tileIsActive to properly count wild tiles and locked tiles with value > 0
    const activeTiles = tiles.filter(tileIsActive);
    
    if (activeTiles.length === 0) {
      return true; // Board is already clean
    }
    
    if (activeTiles.length === 1) {
      // Only one tile left - check if it's merge 6
      return activeTiles[0].value === 6;
    }
    
    // 🔥 PERFORMANCE FIX: Skip simulation if there are too many tiles (prevents lag/crash)
    // With many wild tiles, this can become exponentially slow
    if (activeTiles.length > 15) {
      console.log('🧲 checkIfAllTilesCanMerge: Too many tiles (', activeTiles.length, '), skipping simulation to prevent lag');
      return false; // Conservative: assume not all can merge
    }
    
    // Simulate merges by creating a copy of tile values
    const tileValues = activeTiles.map((t: any) => ({
      value: t.value|0,
      isWild: tileIsWild(t),
      original: t
    }));
    
    // Try to simulate all possible merges
    // This is a simplified check - we try to merge tiles until we can't merge anymore
    let currentTiles = [...tileValues];
    let mergeCount = 0;
    const maxIterations = 50; // 🔥 REDUCED from 100 to 50 to prevent lag
    
    while (currentTiles.length > 1 && mergeCount < maxIterations) {
      let merged = false;
      
      // 🔥 PERFORMANCE FIX: Limit nested loop iterations
      const maxI = Math.min(currentTiles.length, 10); // Max 10 tiles to check
      
      // Try to find a valid merge
      for (let i = 0; i < maxI; i++) {
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
            currentTiles.splice(j, 1);
            currentTiles.splice(i, 1);
            currentTiles.push({ value: newValue, isWild: newIsWild, original: null });
            
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
      mergeCount,
      hitMaxIterations: mergeCount >= maxIterations
    });
    
    return finalResult;
  } catch (error) {
    console.error('❌ checkIfAllTilesCanMerge error:', error);
    return false; // Safe fallback: assume tiles can't all merge
  }
}

async function mergePulledTilesIntoMerge6(dst: any, tiles: any[], helpers: any): Promise<void> {
  console.log('🧲 mergePulledTilesIntoMerge6: Removing', tiles.length, 'pulled tiles and adding 4x multiplier animations to existing merge 6');
  const endgameGuardSource = 'mergePulledTilesIntoMerge6';
  const beginEndgameGuard = (window as any)?.CC?.beginEndgameGuard;
  const endEndgameGuard = (window as any)?.CC?.endEndgameGuard;
  let endgameGuardActive = false;
  let shouldRunPostMagnetEndgameCheck = false;
  let pendingPostGuardEndgameCheckSource: string | null = null;
  const pullShardColors = Array.isArray(helpers?.magnetShardColors) && helpers.magnetShardColors.length
    ? [...helpers.magnetShardColors]
    : getSpecialDiceShardColors(dst);
  const requestPostGuardEndgameCheck = (source: string): boolean => {
    const checker = (window as any)?.CC?.checkLevelEnd;
    if (typeof checker !== 'function') return false;
    if (endgameGuardActive) {
      pendingPostGuardEndgameCheckSource = source;
      console.log(`🎯 Queued central endgame check until magnet guard release (${source})`);
      return true;
    }
    return triggerCentralEndgameCheck(source);
  };
  if (typeof beginEndgameGuard === 'function') {
    try {
      beginEndgameGuard(endgameGuardSource, 2200);
      endgameGuardActive = true;
    } catch (error) {
      console.warn('⚠️ Failed to begin endgame guard in mergePulledTilesIntoMerge6', error);
    }
  }
  
  try {
    // Filter valid tiles
    const validTiles = tiles.filter((t: any) => t && !tileIsTransientForMagnetPull(t));
    const pulledTileCount = validTiles.length;
    const pulledCells: { c: number; r: number }[] = [];
  
  // Wild Magnet Mode B: no tiles were actually attracted. This does not prove
  // only merge 6 remains, because other playable dice can still be on board but
  // absent from this local pulled-tile list. The central resolver owns that
  // decision.
  if (validTiles.length === 0 && dst && !dst.destroyed) {
    console.log('🧲 Wild Magnet Mode B: no pulled tiles - delegating to central endgame resolver');
    requestPostGuardEndgameCheck('magnet_no_pulled_tiles');
    return;
  }
  
  if (!dst || dst.destroyed) {
    console.warn('⚠️ dst destroyed');
    return;
  }
  
  // 🔥 USER REQUEST: Check for wild star tiles BEFORE removing them (to capture _wildStarSystem)
  // This allows us to animate stars to HUD when magnet pulls wild star
  let wildStarTileForAnimation: any = null;
  let savedStarSystemEarly: any = null;
  let savedStarPositionsEarly: any[] = [];
  let savedWildTileScreenPosEarly: { x: number; y: number } | null = null;
  let magnetPullStarPositions: any[] = [];
  let magnetPullStarBasePos: { x: number; y: number } | null = null;
  
  // Check if any pulled tile is a wild star
  for (const tile of validTiles) {
    if (!tile || tile.destroyed) continue;
    if (isSpecialDiceStarLikeTile(tile) && (tile as any)?._wildStarSystem) {
      wildStarTileForAnimation = tile;
      const wildStarSystem = (tile as any)?._wildStarSystem;
      if (wildStarSystem && wildStarSystem.stars && wildStarSystem.stars.length > 0) {
        savedStarSystemEarly = wildStarSystem;
        // 🔥 CRITICAL: Save star textures and their global positions (NOT sprite references - sprites get destroyed!)
        // Use same structure as app-core.ts
        savedStarPositionsEarly = wildStarSystem.stars.map((star: any) => {
          if (!star || !star.sprite) return null;
          try {
            const globalPos = star.sprite.getGlobalPosition();
            // 🔥 CRITICAL: Save texture reference and scale values, NOT sprite reference
            // Sprite gets destroyed when tile is removed/transformed, but texture persists
            const texture = star.sprite.texture;
            const scaleX = star.sprite.scale.x;
            const scaleY = star.sprite.scale.y;
            
            if (!texture) {
              console.warn('⚠️ MAGNET PULL: Star sprite has no texture, skipping');
              return null;
            }
            
            return {
              texture: texture, // Save texture reference (not sprite!)
              globalX: globalPos.x,
              globalY: globalPos.y,
              scale: { x: scaleX, y: scaleY }
            };
          } catch (err) {
            console.warn('⚠️ MAGNET PULL: Failed to save star data early:', err);
            return null;
          }
        }).filter(Boolean);
        
        // Save wild tile screen position
        try {
          const wildTileGlobalPos = wildStarTileForAnimation.getGlobalPosition();
          savedWildTileScreenPosEarly = { x: wildTileGlobalPos.x, y: wildTileGlobalPos.y };
        } catch {
          console.warn('⚠️ MAGNET PULL: Failed to get wild tile global position for early saving');
          savedWildTileScreenPosEarly = { x: wildStarTileForAnimation.x || 0, y: wildStarTileForAnimation.y || 0 };
        }
        
        console.log('⭐ MAGNET PULL: Found wild star tile, saved star system data:', {
          starCount: savedStarPositionsEarly.length,
          wildTilePos: savedWildTileScreenPosEarly
        });
        break; // Only need one wild star
      }
    }
  }

  // 🔥 USER REQUEST: Magnet stars should be awarded when tiles are pulled (not at merge-6 time)
  if (pulledTileCount > 0) {
    try {
      let basePos: { x: number; y: number } | null = null;
      try {
        if (dst && typeof dst.getGlobalPosition === 'function') {
          const gp = dst.getGlobalPosition();
          if (gp && Number.isFinite(gp.x) && Number.isFinite(gp.y)) basePos = { x: gp.x, y: gp.y };
        }
      } catch {}
      if (!basePos) {
        basePos = { x: dst?.x || 0, y: dst?.y || 0 };
      }
      const starTexture = Texture.from('./assets/small-star.png');
      const starCount = Math.max(1, pulledTileCount | 0); // 1 per pulled tile
      magnetPullStarPositions = [];
      for (let i = 0; i < starCount; i++) {
        const offsetX = (Math.random() - 0.5) * TILE * 0.6;
        const offsetY = (Math.random() - 0.5) * TILE * 0.6;
        const scale = 0.45 + Math.random() * 0.25;
        magnetPullStarPositions.push({
          texture: starTexture,
          globalX: basePos.x + offsetX,
          globalY: basePos.y + offsetY,
          scale: { x: scale, y: scale }
        });
      }
      magnetPullStarBasePos = basePos;
      console.log('⭐ MAGNET PULL: Prepared stars for pulled tiles', { basePos, starCount, pulledTileCount });
    } catch (e) {
      console.warn('⚠️ MAGNET PULL: Failed to prepare stars for pulled tiles', e);
    }
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
  
  // 🔥 CRITICAL: Stop all animations INCLUDING wild animations (wild-juice bubbles, wild stars, wild shimmer, wild idle)
  // This prevents animation conflicts when wild-juice tiles are pulled by magnet
  validTiles.forEach((tile: any) => {
    if (!tile || tile.destroyed) return;
    
    // Kill GSAP tweens
    gsap.killTweensOf(tile);
    gsap.killTweensOf(tile.scale);
    if (tile.rotG) {
      gsap.killTweensOf(tile.rotG);
      gsap.killTweensOf(tile.rotG.scale);
    }
    
    // 🔥 CRITICAL: Stop wild animations BEFORE removeTile (prevents conflicts)
    try { 
      if (typeof stopWildJuiceBubbles === 'function') stopWildJuiceBubbles(tile); 
    } catch {}
    try { 
      if (typeof stopWildStars === 'function') stopWildStars(tile); 
    } catch {}
    try { 
      if (typeof stopWildShimmer === 'function') stopWildShimmer(tile); 
    } catch {}
    try { 
      if (typeof stopWildIdle === 'function') stopWildIdle(tile); 
    } catch {}
    try { 
      if (typeof stopMagnetIdleParticles === 'function') stopMagnetIdleParticles(tile); 
    } catch {}
  });
  
  // Remove all pulled tiles from grid and STATE
  console.log('🧲 Removing', validTiles.length, 'pulled tiles from grid and STATE');
  validTiles.forEach((tile: any, index: number) => {
    if (!tile || tile.destroyed) return;
    
    console.log(`🧲 Removing tile ${index + 1}:`, {
      gridX: tile.gridX,
      gridY: tile.gridY,
      value: tile.value,
      special: tile.special,
      destroyed: tile.destroyed,
      currentGridValue: STATE.grid?.[tile.gridY]?.[tile.gridX],
      hasParent: !!tile.parent,
      parentType: tile.parent?.constructor?.name
    });
    
    // Hide tile before removal
    tile.visible = false;
    tile.alpha = 0; // 🔥 CRITICAL: Set alpha to 0 to ensure it's not visible
    
    // Clear _wildMagnetAffected flag BEFORE removeTile (to prevent interference)
    delete tile._wildMagnetAffected;
    delete tile._wildMagnetOriginalX;
    delete tile._wildMagnetOriginalY;
    
    // 🔥 CRITICAL: removeTile handles grid + tiles cleanup, avoid double removal
    removeTile(tile);
    
    console.log(`🧲 Tile ${index + 1} removed and marked destroyed`);
  });

  // 🔥 USER REQUEST: Hide/remove magnet merge-6 tile IMMEDIATELY after pull breaks (no visible delay)
  try {
    const isMagnetMerge6Immediate =
      dst &&
      !dst.destroyed &&
      dst.value === 6 &&
      (dst.special === 'wild-magnet' ||
        (dst as any)._wasWildMagnetMerge6 === true ||
        (dst as any)._isWildMagnetMerge === true ||
        (dst as any)._isWildMagnetLastTwo === true ||
        (dst as any)._wildMagnetPulledTilesMerge === true ||
        (dst as any)._wildMagnetMergeCallback);
    if (isMagnetMerge6Immediate) {
      // Keep merge-6 in STATE.grid while visually hidden so findRandomEmptyCells / spawns never
      // treat this cell as empty (avoids double-spawn and "stuck 6" desync vs logic).
      try {
        const gx = dst.gridX;
        const gy = dst.gridY;
        if (
          gy !== undefined &&
          gx !== undefined &&
          STATE.grid?.[gy]?.[gx] == null
        ) {
          STATE.grid[gy][gx] = dst;
        }
      } catch {}
      try {
        dst.visible = false;
        dst.alpha = 0;
        dst.eventMode = 'none';
        (dst as any)._magnetMerge6Hidden = true;
      } catch {}
      try { (window as any).__ccForceHideGhosts = false; } catch {}
      try { (window as any).setGhostVisibility?.(dst.gridX | 0, dst.gridY | 0, true); } catch {}
      try { (window as any).updateGhostVisibility?.(); } catch {}
      try { gsap?.killTweensOf?.(dst, true); } catch {}
      console.log('🧲 IMMEDIATE: Hid magnet merge-6 tile after pull break');
    }
  } catch (err) {
    console.warn('⚠️ Immediate magnet merge-6 hide failed:', err);
  }
  
  // Set multiplier to 4x
  const mult = 4;

  // 🔥 CRITICAL: Ensure grid coordinates are set before any positioning/logging
  // 🔥 NEVER use pulled tile's grid position - those are SPAWN cells! Shards would appear at wrong place.
  if (dst && (!Number.isFinite(dst.gridX) || !Number.isFinite(dst.gridY))) {
    let found = false;

    // Try to find grid coordinates from STATE.grid (merge 6 tile is at magnet position)
    for (let r = 0; r < ROWS && !found; r++) {
        for (let c = 0; c < COLS && !found; c++) {
          if (STATE.grid?.[r]?.[c] === dst) {
            dst.gridX = c;
            dst.gridY = r;
            console.log('🧲 Found grid coordinates from STATE.grid:', c, r);
            found = true;
          }
        }
    }

    // If not found in grid, calculate from pixel position (dst.x/y are already correct)
    if (!found) {
      const tileSize = TILE + GAP;
      const halfTile = TILE / 2;
      if (Number.isFinite(dst.x) && Number.isFinite(dst.y)) {
        const calculatedGridX = Math.round((dst.x - halfTile) / tileSize);
        const calculatedGridY = Math.round((dst.y - halfTile) / tileSize);
        if (calculatedGridX >= 0 && calculatedGridX < COLS && calculatedGridY >= 0 && calculatedGridY < ROWS) {
          dst.gridX = calculatedGridX;
          dst.gridY = calculatedGridY;
          console.log('🧲 Calculated grid coordinates from pixel position:', calculatedGridX, calculatedGridY, 'from pixel', dst.x, dst.y);
          found = true;
        }
      }
    }

    // If still not found, log error (but continue with fallback)
    if (!found) {
      console.error('❌ Could not find grid coordinates for dst tile!', dst);
      dst.gridX = Math.floor(COLS / 2);
      dst.gridY = Math.floor(ROWS / 2);
      console.warn('⚠️ Using center of board as fallback grid position:', dst.gridX, dst.gridY);
    }
  }

  // 🔥 CRITICAL: Calculate correct position - use grid coordinates if available, otherwise use current position
  let correctX: number;
  let correctY: number;

  if (Number.isFinite(dst.gridX) && Number.isFinite(dst.gridY)) {
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

  // 🔥 CRITICAL: Capture shards position BEFORE overwriting dst - use tile's actual displayed position
  // Same as first merge 6 in app-core.ts - centerInBoard uses x/y or toGlobal/toLocal
  const shardsPos = STATE.board && dst && !dst.destroyed
    ? centerInBoard(STATE.board, dst, TILE)
    : { x: correctX, y: correctY };

  // 🔥 CRITICAL: Set position immediately using correct formula (same as createTile)
  gsap.set(dst, { x: correctX, y: correctY });
  dst.targetX = correctX;
  dst.targetY = correctY;
  
  // 🔥 CRITICAL: Red-brown shards animation when tiles gather (enhanced, visible)
  // Use shardsPos captured BEFORE gsap.set - tile's actual position on screen
  if (dst && !dst.destroyed && STATE.board) {
    const shardX = shardsPos.x;
    const shardY = shardsPos.y;

    if (!Number.isFinite(shardX) || !Number.isFinite(shardY)) {
      console.error('❌ Invalid shards position from centerInBoard:', shardX, shardY, 'dst:', dst);
    } else {
      console.log('🧲 Shards at magnet position (centerInBoard):', shardX, shardY, 'dst.grid:', dst.gridX, dst.gridY, 'dst.x/y:', dst.x, dst.y);

      const mergePosForShards = { x: shardX, y: shardY, gridX: dst.gridX, gridY: dst.gridY, zIndex: dst.zIndex || 9993 };
      wildMagnetMerge6ShardsTemplated(STATE.board, mergePosForShards as any, {
        zIndex: dst.zIndex || 9993,
        isPullAnimation: true, // 🔥 Use pull-specific patterns
        colors: pullShardColors,
      });
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
  
  // Keep the face container aligned with its authored top-centre pivot. Setting
  // this to (0, 0) moves the painted cube down by TILE / 2 while its shadow
  // remains at the grid centre.
  if (dst.rotG) {
    gsap.set(dst.rotG, {
      x: Number.isFinite(dst.rotG.pivot?.x) ? dst.rotG.pivot.x : 0,
      y: Number.isFinite(dst.rotG.pivot?.y) ? dst.rotG.pivot.y : -TILE / 2,
    });
  }
  
  // Set position again after a small delay to ensure it stays (in case animations try to change it)
  trackAppTimeout(() => {
    if (dst && !dst.destroyed) {
      gsap.set(dst, { x: correctX, y: correctY });
      dst.targetX = correctX;
      dst.targetY = correctY;
      if (dst.rotG) {
        gsap.set(dst.rotG, {
          x: Number.isFinite(dst.rotG.pivot?.x) ? dst.rotG.pivot.x : 0,
          y: Number.isFinite(dst.rotG.pivot?.y) ? dst.rotG.pivot.y : -TILE / 2,
        });
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
  
  // 🔥 CRITICAL: Update combo - increase by number of pulled tiles (don't reset!)
  // Combo should continue and increase for each pulled tile that creates fake merge
  // Example: If combo is 5 and magnet pulls 4 tiles, combo becomes 5 + 4 = 9
  // 🔥 CRITICAL FIX: Kill existing combo timer FIRST before updating combo!
  // The main merge flow already started a timer that would reset combo to 0
  // We need to kill that timer so it doesn't reset our new combo value
  try {
    // Kill existing combo timer to prevent it from resetting combo
    if (typeof (window as any).CC?.killComboTimer === 'function') {
      (window as any).CC.killComboTimer();
      console.log('🔥 MAGNET COMBO: Killed existing combo timer before updating combo');
    }
  } catch (e) {
    console.warn('⚠️ Failed to kill combo timer:', e);
  }
  
  const currentCombo = typeof (window as any).CC?.getCombo === 'function'
    ? (window as any).CC.getCombo()
    : (typeof (window as any).CC?.combo === 'number' ? (window as any).CC.combo : 0);
  
  // 🔥 CRITICAL: Combo should be: currentCombo + 1 (for main merge 6) + pulledTileCount (for pulled tiles)
  // The main merge flow skipped combo increment, so we add 1 here for the main merge 6
  const newCombo = currentCombo + 1 + pulledTileCount;
  console.log('🔥 MAGNET COMBO: currentCombo=', currentCombo, '+ 1 (main merge 6) +', pulledTileCount, '(pulled tiles) = newCombo=', newCombo);
  
  // Update combo using window.CC.setCombo
  if (typeof (window as any).CC?.setCombo === 'function') {
    (window as any).CC.setCombo(newCombo);
    console.log('🔥 MAGNET COMBO: Called window.CC.setCombo with newCombo=', newCombo);
    
    // 🔥 CRITICAL: Double-check combo was actually set (read it back)
    const verifyCombo = typeof (window as any).CC?.getCombo === 'function'
      ? (window as any).CC.getCombo()
      : null;
    console.log('🔥 MAGNET COMBO: Verified combo after setCombo=', verifyCombo, '(should be', newCombo, ')');
    
    if (verifyCombo !== newCombo) {
      console.error('❌ MAGNET COMBO: Combo mismatch! Set to', newCombo, 'but read back as', verifyCombo);
      // Force set again
      (window as any).CC.setCombo(newCombo);
      console.log('🔥 MAGNET COMBO: Force-set combo again to', newCombo);
    }
  } else {
    console.error('❌ MAGNET COMBO: window.CC.setCombo is not a function!');
  }
  
  // Schedule combo decay (same as normal merge) - reset combo timer but don't reset combo value
  // This starts a NEW timer for the updated combo value
  if (typeof (window as any).CC?.scheduleComboDecay === 'function') {
    // Wild-magnet merge-6 uses extended combo window before returning to normal 2s on later merges.
    (window as any).CC.scheduleComboDecay(4000);
    console.log('🔥 MAGNET COMBO: Scheduled combo decay for combo=', newCombo);
  } else {
    console.error('❌ MAGNET COMBO: window.CC.scheduleComboDecay is not a function!');
  }
  
  // Also trigger combo bump animation if available
  try {
    if (typeof HUD.bumpCombo === 'function') {
      HUD.bumpCombo({ kind: 'magnet-pull', combo: newCombo });
      console.log('🔥 MAGNET COMBO: Called HUD.bumpCombo with combo=', newCombo);
    }
  } catch (e) {
    console.warn('⚠️ MAGNET COMBO: Failed to call HUD.bumpCombo:', e);
  }
  
  // Update HUD - ensure combo value is passed correctly
  console.log('🔥 MAGNET COMBO: About to call updateHUD() with combo=', newCombo);
  updateHUD();
  
  // 🔥 USER REQUEST: Track longest combo after magnet pull (get actual current combo value)
  // Get actual current combo value after magnet pull to track the correct longest combo
  const currentComboAfterMagnet = typeof (window as any).CC?.getCombo === 'function'
    ? (window as any).CC.getCombo()
    : newCombo;
  
  // Stats: track longest combo (global and per-board) - use ACTUAL current combo value after magnet pull
  statsService.updateLongestCombo(currentComboAfterMagnet);
  if (isArcadeHomeRunMode()) {
    arcadeStatsService.updateLongestCombo(currentComboAfterMagnet);
  }
  
  // 🔥 JOURNEY BOARDS: Track longest combo per board - use ACTUAL current combo value after magnet pull
  try {
    const boardNumber = STATE?.boardNumber || STATE?.level || 1;
    import('../services/board-stats-service.js').then(({ boardStatsService }) => {
      boardStatsService.updateBoardLongestCombo(boardNumber, currentComboAfterMagnet);
    }).catch(() => {
      // Ignore import errors
    });
  } catch {}
  
  // One Magnet transaction owns at most one Star-to-HUD batch. A pulled wild
  // Star and the regular pulled-tile bonus used to schedule two protected
  // animation containers at the same time, doubling the visible merge load and
  // leaving parallel path timelines alive through interrupted restarts.
  const magnetStarPayload = [
    ...(wildStarTileForAnimation && savedStarSystemEarly ? savedStarPositionsEarly : []),
    ...magnetPullStarPositions,
  ].filter((star, index, allStars) => {
    const sprite = star?.sprite;
    return !sprite || allStars.findIndex((candidate) => candidate?.sprite === sprite) === index;
  }).slice(0, 3);
  if (magnetStarPayload.length > 0) {
    console.log('⭐ MAGNET PULL: Animating one consolidated Star batch to HUD', {
      starCount: magnetStarPayload.length,
      includesWildStar: !!wildStarTileForAnimation,
      includesPullBonus: magnetPullStarPositions.length > 0,
    });
    let hudStarPos: { x: number; y: number } | null = null;
    try {
      if (typeof HUD.getStarHudPosition === 'function') {
        hudStarPos = HUD.getStarHudPosition();
      }
    } catch (e) {
      console.warn('⚠️ Failed to get HUD star position for magnet bonus:', e);
    }
    if (!hudStarPos) {
      console.warn('⚠️ HUD star position not available for magnet pull stars, using fallback');
      hudStarPos = { x: 0, y: 0 };
    }
    let merge6Pos: { x: number; y: number };
    if (typeof dst.getGlobalPosition === 'function') {
      merge6Pos = dst.getGlobalPosition();
    } else {
      merge6Pos = { x: dst.x || 0, y: dst.y || 0 };
    }
    trackAppAnimationFrame(() => {
      trackAppTimeout(async () => {
        try {
          const { animateStarsToHudIcon } = await import('./fx.js');
          if (typeof animateStarsToHudIcon === 'function' && STATE.board && STATE.stage) {
            const appForAnimation = STATE.app || (STATE.stage as any)?.app;
            await animateStarsToHudIcon(
              STATE.board,
              STATE.stage,
              magnetStarPayload,
              (wildStarTileForAnimation ? savedWildTileScreenPosEarly : magnetPullStarBasePos) || { x: 0, y: 0 },
              merge6Pos,
              hudStarPos,
              appForAnimation
            );
            console.log('✅ MAGNET PULL: Consolidated Stars animation to HUD completed');
          } else {
            console.warn('⚠️ animateStarsToHudIcon not available or STATE.board/stage missing (magnet pull stars)');
          }
        } catch (error) {
          console.error('❌ MAGNET PULL: Failed to animate stars to HUD:', error);
        }
      }, 200);
    });
  }
  
  // 🔥 CRITICAL: Double-check combo after updateHUD
  const comboAfterHUD = typeof (window as any).CC?.getCombo === 'function'
    ? (window as any).CC.getCombo()
    : null;
  console.log('🔥 MAGNET COMBO: Combo after updateHUD()=', comboAfterHUD, '(should still be', newCombo, ')');
  
  if (comboAfterHUD !== newCombo) {
    console.error('❌ MAGNET COMBO: Combo was reset after updateHUD()! Was', newCombo, 'now is', comboAfterHUD);
    // Force restore combo
    if (typeof (window as any).CC?.setCombo === 'function') {
      (window as any).CC.setCombo(newCombo);
      console.log('🔥 MAGNET COMBO: Force-restored combo to', newCombo);
      updateHUD(); // Update HUD again with correct combo
    }
  }
  
  animateScore(newScore, 0.45);
  
  // Stats - track cubes cracked for magnet pull merge
  statsService.incrementCubesCracked(1);
  statsService.incrementHelpersUsed(1);
  if (isArcadeHomeRunMode()) {
    arcadeStatsService.addCubesCracked(1);
  }
  
  // 🔥 USER REQUEST: Track cubes cracked per-board for magnet pull merge
  try {
    const boardNumber = STATE?.boardNumber || STATE?.level || 1;
    if (typeof window.trackCubesCracked === 'function') {
      window.trackCubesCracked(1);
      console.log(`🧊 Magnet pull merge: Tracked cubes cracked for board ${boardNumber}`);
    }
  } catch (error) {
    console.warn('⚠️ Failed to track board-specific cubes cracked for magnet pull:', error);
  }
  
  console.log('✅ mergePulledTilesIntoMerge6 completed - score updated to', newScore, 'combo updated to', newCombo);

  if (pulledTileCount > 0) {
    // Burst scales with pull size: 1..4 quick taps for 1..4 pulled tiles.
    const burstCount = Math.max(1, Math.min(4, pulledTileCount | 0));
    triggerMagnetQuickHapticBurst(burstCount, 50);
  }

  // 🔥 CRITICAL: Check if magnet merge 6 is left with few tiles (3 or less) - if so, pull remaining tiles and trigger clean board
  // After pulled tiles merge, dst is merge 6, so we check if there are few remaining tiles on the board
  // EDGE CASE: If magnet pulled the last 4 tiles from the board, don't spawn new tiles - trigger clean board flow
  // 🔥 CRITICAL: Use tileIsActive instead of !t.locked to properly count wild tiles and locked tiles with value > 0
  // 🔥 CRITICAL: Count merge 6 tile (dst) as active tile - it should remain on board after magnet pull merge!
  const activeTilesAfterPulledMerge = STATE.tiles.filter(tileIsActive);
  // 🔥 CRITICAL FIX: Include dst (merge 6) in count if it's still active and not destroyed
  // This ensures we count merge 6 tile that should remain on board
  const dstIsActive = dst && !dst.destroyed && (dst.value === 6) && !activeTilesAfterPulledMerge.includes(dst);
  const remainingTilesCount = activeTilesAfterPulledMerge.length + (dstIsActive ? 1 : 0);
  
  console.log('🧲 After pulled tiles merge - active tiles:', remainingTilesCount, 'dst is merge 6:', dst?.value === 6, 'pulledCells to respawn:', pulledCells.length);
  console.log('🧲 Active tiles list:', activeTilesAfterPulledMerge.map(t => ({ value: t.value, special: t.special, locked: t.locked })));
  console.log('🧲 Dst (merge 6) is active:', dstIsActive, 'dst value:', dst?.value, 'dst destroyed:', dst?.destroyed);
  
  // 🔥 EDGE CASE: If only merge 6 remains (magnet pulled the last 4 tiles), don't spawn new tiles - trigger clean board immediately
  // BUT: Only if there are NO pulled cells to respawn! If we have pulled cells, we MUST spawn them first!
  // This covers the case when magnet pulled the last 4 tiles from the board
  // 🔥 CRITICAL FIX: Check if dst is the only remaining tile (including dst in count)
  const onlyDstRemainsAfterPull = remainingTilesCount === 1 && (activeTilesAfterPulledMerge[0] === dst || dstIsActive) && pulledCells.length === 0;
  if (onlyDstRemainsAfterPull) {
    console.log('🧲 Magnet merge appears to have only dst remaining - delegating to central endgame resolver');
    requestPostGuardEndgameCheck('magnet_only_dst_remains');
    return;
  }
  
  // Legacy used to auto-pull "few remaining" tiles and force clean board here.
  // That bypassed the global resolver and could end the board while TNT/wild or
  // regular dice were still playable.
  if (remainingTilesCount >= 2 && remainingTilesCount <= 3 && pulledCells.length === 0) {
    console.log('🧲 Magnet merge left few tiles - delegating to central resolver instead of forcing clean board', {
      remainingTilesCount,
      activeTiles: activeTilesAfterPulledMerge.map((t: any) => ({
        value: t.value,
        special: t.special,
        locked: t.locked,
      })),
    });
    requestPostGuardEndgameCheck('magnet_few_tiles_remaining');
    return;
  }

  // Find random empty cells on the board for spawning new tiles
  const findRandomEmptyCells = (count: number): { c: number; r: number }[] => {
    const empties: { c: number; r: number }[] = [];
    const occupied: { c: number; r: number; reason: string }[] = [];
    
    console.log('🔍 findRandomEmptyCells: Scanning board for', count, 'empty cells');
    console.log('🔍 Grid state:', STATE.grid?.map((row: any[], r: number) => 
      row.map((cell: any, c: number) => ({
        c, r,
        hasCell: !!cell,
        value: cell?.value,
        special: cell?.special,
        locked: cell?.locked,
        destroyed: cell?.destroyed
      }))
    ));
    
    // Find all empty cells on the board
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = STATE.grid?.[r]?.[c];
        
        // 🔥 CRITICAL: Check if cell is truly empty (no active tile)
        // A cell is empty if:
        // 1. It's missing (null) - no tile at all
        // 2. It's locked (ghost placeholder) WITH value 0 or less - can be replaced
        // A cell is NOT empty if:
        // - It has a value > 0 (regardless of locked status) - active tile
        // - It's a wild tile (wild or wild-magnet) - active tile
        
        const isMissing = !t;
        const isLocked = !!(t && t.locked === true);
        const hasValue = !!(t && (t.value|0) > 0);
        const isWildTile = tileIsWild(t);
        
        // 🔥 CRITICAL FIX: NEVER spawn on a tile with value > 0, even if it's locked!
        // Locked tiles with value > 0 are tiles that are being animated (e.g., during magnet pull)
        // Spawning on them would overwrite their value and cause "empty cube" bug
        if (hasValue || isWildTile) {
          occupied.push({ c, r, reason: hasValue ? 'hasValue' : 'isWildTile' });
          continue; // Skip this cell - it's occupied
        }
        
        // Cell is empty if it's missing OR locked with value 0
        if (isMissing || (isLocked && !hasValue)) {
          empties.push({ c, r });
        } else {
          occupied.push({ c, r, reason: 'notEmptyNotLocked' });
        }
      }
    }
    
    console.log('🔍 Found', empties.length, 'empty cells:', empties);
    console.log('🔍 Found', occupied.length, 'occupied cells:', occupied);
    
    // Shuffle and pick random cells
    if (empties.length === 0) {
      console.warn('⚠️ No empty cells found for spawning');
      console.warn('⚠️ Detailed board state:', {
        totalCells: ROWS * COLS,
        emptyCells: empties.length,
        occupiedCells: occupied.length,
        occupiedReasons: occupied.reduce((acc: any, { reason }) => {
          acc[reason] = (acc[reason] || 0) + 1;
          return acc;
        }, {})
      });
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
  
  const isLastMergeFlagSetRaw = (dst as any)?._isLastMerge === true;
  const activeAfterRemoval = STATE.tiles.filter(tileIsActive);
  const preRespawnDecision = resolvePreMagnetRespawnDecision({
    isLastMergeFlagSetRaw,
    activeTilesAfterRemoval: activeAfterRemoval,
    dst,
    pulledCellCount: pulledCells.length,
  });
  const {
    isLastMergeFlagSet,
    onlyDstRemains,
    hasTilesToRespawn,
    shouldDelegateToCentralEndgame,
  } = preRespawnDecision;
  if (preRespawnDecision.shouldClearLastMergeFlag) {
    console.log('🧲 _isLastMerge flag ignored: magnet pulled tiles that must respawn', {
      pulledCells: pulledCells.length,
      pulledCellsList: pulledCells
    });
    try { (dst as any)._isLastMerge = false; } catch {}
  }
  const merge6Coords = dst && Number.isFinite(dst.gridX) && Number.isFinite(dst.gridY)
    ? { c: dst.gridX | 0, r: dst.gridY | 0 }
    : null;

  console.log('🧲 Pre-respawn check:', {
    isLastMergeFlagSet,
    activeAfterRemoval: activeAfterRemoval.length,
    onlyDstRemains,
    hasTilesToRespawn,
    shouldDelegateToCentralEndgame
  });

  // 🔥 CRITICAL FIX: NEVER call endgame check if we have tiles to respawn!
  // This was causing instant fail screen when magnet pulled tiles (e.g., magnet + 2 cubes)
  // because endgame check would see only merge 6 tile BEFORE new tiles spawned
  if (shouldDelegateToCentralEndgame && requestPostGuardEndgameCheck('mergePulledTilesBeforeRespawn')) {
    console.log('🧲 mergePulledTilesIntoMerge6: Central endgame handled before respawn, skipping spawns.');
    return;
  }
  
  // 🔥 SAFETY: If we have tiles to respawn, ALWAYS respawn them regardless of endgame state
  // This prevents the "instant fail" bug when magnet pulls tiles but doesn't spawn new ones
  if (hasTilesToRespawn) {
    console.log('🧲 Has tiles to respawn:', pulledCells.length, '- proceeding with spawn regardless of endgame state');
  }

  // 🔥 CRITICAL: Wild-magnet spawn logic is DIFFERENT from regular merge 6!
  // Wild-magnet merge 6:
  // 1. Magnet merges with a tile → creates merge 6
  // 2. Magnet automatically pulls up to 4 nearest tiles towards it (ANY tiles: magnets, wild stars, ordinary cubes)
  // 3. Pulled tiles merge with merge 6 and disappear
  // 4. NEW tiles spawn = EXACTLY the number of pulled tiles (max 4)
  // 5. NO multiplier, NO bonus tiles, just equal replacement of pulled tiles
  // 
  // Example scenarios:
  // - Wild-magnet + cube, pulls 2 ordinary cubes → spawn 2 new tiles
  // - Wild-magnet + cube, pulls 4 wild-magnets → spawn 4 new tiles
  // - Wild-magnet + cube, pulls 2 magnets + 2 wild stars → spawn 4 new tiles
  // - Wild-magnet + cube, pulls 0 tiles (board is empty) → spawn 0 new tiles
  // 
  // 🔥 MAGNET-ON-MAGNET FIX: Magnet CAN pull other magnets - this is intentional!
  // When magnets pull other magnets, they get removed and replaced with new ordinary tiles
  
  // 🔥 SOURCE OF TRUTH: Wild Magnet - Mode A — Tiles exist to attract
  // Magnet attracts tiles (normal or wild). May spawn exactly as many tiles as attracted.
  // Must not spawn extra tiles beyond attraction count.
  // v915 contract: replace every pulled tile, add one nearby obligatory cube,
  // then convert the surviving merge-6 destination.
  // When magnet pulls tiles, we need to:
  // 1. Spawn tiles to replace pulled tiles (pulledCells.length)
  // 2. Spawn one obligatory nearby cube.
  // 3. Convert the surviving merge-6 destination into a regular cube.
  // 🔥 SOURCE OF TRUTH: If final merge-6 (_isLastMerge flag), NO spawns at all (trigger CLEAN BOARD)
  // 🎯 END GAME FIX: If this is last merge (magnet + 1 tile), NO spawns at all!
  // 🔥 CRITICAL: Check _isLastMerge flag FIRST - if set, skip ALL spawn logic and trigger clean board
  if (isLastMergeFlagSet && !hasTilesToRespawn) {
    console.log('🚨🚨🚨 SOURCE OF TRUTH: Final merge-6 detected (_isLastMerge flag set) - NO spawns, triggering CLEAN BOARD');
    console.log('🎯 This is the final merge (magnet + 1 tile = 2 tiles total) - should trigger clean board, NOT spawn tiles');

    // Keep the merge-6 tile visible. The centralized final handoff owns SWOOP wait,
    // residual tile/ghost pop-out, HUD/bottom exit, and cleanup.
    if (requestPostGuardEndgameCheck('magnet_final_merge6')) {
      console.log('✅ Magnet final merge-6 delegated to central endgame check');
    } else if (await triggerCentralCleanBoardFlow(FINAL_MERGE_REASONS.legacyMagnetFinalMerge6)) {
      console.log('✅ Clean board flow completed for magnet final merge-6 fallback');
    } else {
      console.error('❌ triggerCleanBoardFlow not available - final magnet merge cannot complete centrally');
    }
    return; // 🔥 CRITICAL: Exit early - NO spawns for final merge-6!
  }
  
  const {
    replacementSpawnCount,
    obligatorySpawnCount,
    spawnCount,
  } = createMagnetRespawnPlan(pulledCells.length, hasTilesToRespawn);
  
  console.log('🧲 Wild-magnet spawn calculation:', {
    pulledTilesCount: pulledCells.length,
    pulledTilesDetails: validTiles.map(t => ({ value: t.value, special: t.special })),
    replacementSpawnCount: replacementSpawnCount,
    obligatorySpawnCount: obligatorySpawnCount,
    totalSpawnCount: spawnCount,
    merge6StaysVisible: true, // Merge 6 should remain visible on board
    merge6Position: dst ? { gridX: dst.gridX, gridY: dst.gridY } : null,
    expectedTotalTiles: spawnCount + 1,
    note: 'v915 Magnet continuation: replacements + nearby obligatory cube + converted survivor.'
  });

  // 🔒 SAFETY: Merge 6 tile should STAY on board after magnet pull
  // DO NOT remove it here - it's the intended behavior for magnet pull
  // The merge 6 tile will be removed later when user merges it with spawned tiles
  // Removing it here causes "stuck merge 6" bug where spawned tiles can't merge with anything
  
  // 🔥 CRITICAL FIX: Clear _wildMagnetAffected flag from merge 6 tile BEFORE spawning
  // This prevents spawned tiles from inheriting the flag and being unable to merge
  // BUT: DO NOT delete _wildMagnetPulledTilesMerge and _wildMagnetMergeCallback - they're needed in onComplete callback!
  if (dst && !dst.destroyed) {
    delete (dst as any)._wildMagnetAffected;
    delete (dst as any)._wildMagnetOriginalX;
    delete (dst as any)._wildMagnetOriginalY;
    delete (dst as any)._wildMagnetPulledTilesScoring;
    // 🔥 CRITICAL: Keep _wildMagnetPulledTilesMerge and _wildMagnetMergeCallback until onComplete callback checks them!
    // They will be cleaned up in app-core.ts onComplete callback after merge 6 tile removal check
    console.log('🧲 Cleared some magnet flags from merge 6 tile before spawning (kept _wildMagnetPulledTilesMerge and _wildMagnetMergeCallback)');
  }
  
  let obligatoryCell: { c: number; r: number } | null = null;
  if (obligatorySpawnCount > 0 && dst && !dst.destroyed) {
    const merge6GridX = dst.gridX | 0;
    const merge6GridY = dst.gridY | 0;
    const candidates = merge6GridY + 1 < ROWS
      ? [
          { c: merge6GridX, r: merge6GridY + 1 },
          { c: merge6GridX - 1, r: merge6GridY + 1 },
          { c: merge6GridX + 1, r: merge6GridY + 1 },
          { c: merge6GridX, r: merge6GridY + 2 },
          { c: merge6GridX, r: merge6GridY - 1 },
        ]
      : [
          { c: merge6GridX, r: merge6GridY - 1 },
          { c: merge6GridX - 1, r: merge6GridY },
          { c: merge6GridX + 1, r: merge6GridY },
        ];

    obligatoryCell = candidates.find((cell) => {
      if (cell.r < 0 || cell.r >= ROWS || cell.c < 0 || cell.c >= COLS) return false;
      const existingTile = STATE.grid?.[cell.r]?.[cell.c];
      return !existingTile || (existingTile.locked && (existingTile.value | 0) === 0);
    }) ?? null;

    if (!obligatoryCell) {
      obligatoryCell = findRandomEmptyCells(1)[0] ?? null;
    }
  }
  
  // Find cells for replacement spawns (excluding obligatory cell)
  const excludeCellsSet = new Set<string>();
  if (obligatoryCell) {
    excludeCellsSet.add(`${obligatoryCell.c},${obligatoryCell.r}`);
  }
  // Also exclude pulled cells (they might still be in grid as locked placeholders)
  pulledCells.forEach(cell => {
    excludeCellsSet.add(`${cell.c},${cell.r}`);
  });
  if (dst && Number.isFinite(dst.gridX) && Number.isFinite(dst.gridY)) {
    excludeCellsSet.add(`${dst.gridX | 0},${dst.gridY | 0}`);
  }
  const isAllowedReplacementCell = (cell: { c: number; r: number }): boolean => {
    const key = `${cell.c},${cell.r}`;
    return !excludeCellsSet.has(key);
  };
  
  // Find replacement spawn targets (excluding obligatory cell and pulled cells)
  // 🔥 USER REQUEST: Reserve 6 cells for locked placeholders (like regular merge-6)
  // Request replacementSpawnCount + 6 cells; use only replacementSpawnCount for spawn.
  // The 6 unused cells stay empty → fillNullCellsWithLockedPlaceholders fills them with locked.
  const LOCKED_RESERVE_COUNT = 6;
  let replacementTargets = findRandomEmptyCells(replacementSpawnCount + LOCKED_RESERVE_COUNT);
  // Filter out excluded cells
  replacementTargets = replacementTargets.filter(cell => {
    return isAllowedReplacementCell(cell);
  });
  
  // 🔥 USER FIX: Reserve 6 cells for locked placeholders - NEVER spawn in these
  const reservedForLocked = replacementTargets.slice(replacementSpawnCount, replacementSpawnCount + LOCKED_RESERVE_COUNT);
  const reservedSet = new Set(reservedForLocked.map(c => `${c.c},${c.r}`));
  
  // Combine obligatory cell + replacement targets (use only replacementSpawnCount for spawn)
  let spawnTargets: { c: number; r: number }[] = [];
  if (obligatoryCell) {
    spawnTargets.push(obligatoryCell);
  }
  spawnTargets.push(...replacementTargets.slice(0, replacementSpawnCount));
  const spawnTargetsSet = new Set(spawnTargets.map(c => `${c.c},${c.r}`));

  // 🔥 SAFETY: Ensure we actually reserve 6 cells for locked placeholders
  if (reservedForLocked.length < LOCKED_RESERVE_COUNT) {
    const extras = findRandomEmptyCells(LOCKED_RESERVE_COUNT * 2);
    for (const cell of extras) {
      const key = `${cell.c},${cell.r}`;
      if (reservedForLocked.length >= LOCKED_RESERVE_COUNT) break;
      if (excludeCellsSet.has(key)) continue;
      if (reservedSet.has(key)) continue;
      if (spawnTargetsSet.has(key)) continue;
      reservedForLocked.push(cell);
      reservedSet.add(key);
    }
  }

  // 🔥 USER REQUEST: Always spawn mergeable pairs after magnet pull
  // Guarantee at least one pair that can merge to 6 (1+5, 2+4, 3+3, 2+2+2, 1+1+4, etc.)
  // Apply to ALL replacement spawns (not just endgame), ensure mergeable combinations
  const forcedSpawnValues = new Map<string, number>();
  const replacementSlots = spawnTargets
    .filter(cell => !obligatoryCell || !(cell.c === obligatoryCell.c && cell.r === obligatoryCell.r))
    .slice(0, replacementSpawnCount);
  
  if (replacementSlots.length > 0) {
    // Mergeable pairs that sum to 6: (1,5), (2,4), (3,3)
    // Also smaller pairs: (1,1), (2,2), (1,2), (2,1) - can combine to make 6
    const mergeablePairs: [number, number][] = [[1, 5], [2, 4], [3, 3], [1, 1], [2, 2], [1, 2], [2, 1]];
    
    if (replacementSpawnCount === 1) {
      // Single tile: spawn random 1-3 (can merge with existing tiles or future spawns)
      const values = [1, 2, 3];
      const chosenValue = values[Math.floor(Math.random() * values.length)];
      forcedSpawnValues.set(`${replacementSlots[0].c},${replacementSlots[0].r}`, chosenValue);
      console.log('🎯 Magnet 1-tile spawn: Forcing mergeable value', chosenValue, 'on slot', replacementSlots[0]);
    } else if (replacementSpawnCount === 2) {
      // Two tiles: ALWAYS spawn a mergeable pair (1+5, 2+4, or 3+3)
      const chosenPair = mergeablePairs.slice(0, 3)[Math.floor(Math.random() * 3)]; // Only (1,5), (2,4), (3,3)
      forcedSpawnValues.set(`${replacementSlots[0].c},${replacementSlots[0].r}`, chosenPair[0]);
      forcedSpawnValues.set(`${replacementSlots[1].c},${replacementSlots[1].r}`, chosenPair[1]);
      console.log('🎯 Magnet 2-tile spawn: Forcing merge-6 pair', chosenPair, 'on slots', replacementSlots);
    } else if (replacementSpawnCount === 3) {
      // Three tiles: Spawn one mergeable pair + one random mergeable value
      // Options: (1,5,1), (2,4,2), (3,3,3), (1,1,4), (2,2,2)
      const combinations: number[][] = [
        [1, 5, 1], [2, 4, 2], [3, 3, 3], [1, 1, 4], [2, 2, 2],
        [1, 2, 3], [2, 1, 3], [1, 3, 2] // Can combine to make 6
      ];
      const chosenValues = combinations[Math.floor(Math.random() * combinations.length)];
      
      // Shuffle values before assigning
      const shuffledValues = [...chosenValues];
      for (let i = shuffledValues.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledValues[i], shuffledValues[j]] = [shuffledValues[j], shuffledValues[i]];
      }
      
      replacementSlots.forEach((cell, index) => {
        forcedSpawnValues.set(`${cell.c},${cell.r}`, shuffledValues[index]);
      });
      console.log('🎯 Magnet 3-tile spawn: Forcing mergeable combination', chosenValues, 'shuffled to', shuffledValues, 'on slots', replacementSlots);
    } else if (replacementSpawnCount === 4) {
      // Four tiles: Spawn 2 mergeable pairs (1+5, 2+4, or 3+3)
      const pairCombinations: number[][] = [
        [1, 5, 2, 4], // par (1,5) i par (2,4)
        [1, 5, 3, 3], // par (1,5) i par (3,3)
        [2, 4, 3, 3], // par (2,4) i par (3,3)
        [1, 1, 2, 2], // par (1,1) i par (2,2) - can combine
        [1, 2, 2, 1]  // multiple mergeable combinations
      ];
      
      const chosenValues = pairCombinations[Math.floor(Math.random() * pairCombinations.length)];
      
      // Shuffle values before assigning
      const shuffledValues = [...chosenValues];
      for (let i = shuffledValues.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledValues[i], shuffledValues[j]] = [shuffledValues[j], shuffledValues[i]];
      }
      
      replacementSlots.forEach((cell, index) => {
        forcedSpawnValues.set(`${cell.c},${cell.r}`, shuffledValues[index]);
      });
      console.log('🎯 Magnet 4-tile spawn: Forcing merge-6-friendly pairs', chosenValues, 'shuffled to', shuffledValues, 'on slots', replacementSlots);
    }
  }
  
  console.log('🧲 Final spawn targets:', {
    total: spawnTargets.length,
    requested: spawnCount,
    obligatory: obligatoryCell ? 1 : 0,
    replacement: replacementTargets.length,
    targets: spawnTargets
  });
  
  // 🔥 CRITICAL FIX: If we don't have enough spawn targets, try to find more cells
  // This can happen if board is nearly full - retry with larger search
  if (spawnTargets.length < spawnCount && spawnCount > 0) {
    console.warn('⚠️ Not enough spawn targets found, retrying with larger search...', {
      requested: spawnCount,
      found: spawnTargets.length,
      pulledTilesCount: pulledCells.length
    });
    
    // Retry with larger count (search for more cells than needed)
    const retryTargets = findRandomEmptyCells(spawnCount + 2 + LOCKED_RESERVE_COUNT);
    // Filter out excluded cells AND reserved cells (6 locked placeholders)
    const filteredRetryTargets = retryTargets.filter(cell => {
      const key = `${cell.c},${cell.r}`;
      return isAllowedReplacementCell(cell) && !reservedSet.has(key);
    });
    
    // Add to spawnTargets if we found more
    const additionalNeeded = spawnCount - spawnTargets.length;
    const additionalTargets = filteredRetryTargets
      .filter(cell => !spawnTargets.some(st => st.c === cell.c && st.r === cell.r))
      .slice(0, additionalNeeded);
    spawnTargets.push(...additionalTargets);

    if (spawnTargets.length >= spawnCount) {
      console.log('✅ Found additional spawn targets:', spawnTargets.length, 'total');
    } else {
      console.error('🚨🚨🚨 CRITICAL: Still not enough spawn targets after retry!', {
        requested: spawnCount,
        found: spawnTargets.length,
        pulledTilesCount: pulledCells.length,
        note: 'Will attempt to spawn what we can, but tile count may be incorrect!'
      });
    }
  }

  // 🔥 CRITICAL FIX: Track successful spawns to ensure we spawn EXACTLY spawnCount tiles
  // Prioritize obligatory spawn (must spawn first), then replacement spawns
  let successfulSpawns = 0;
  let successfulObligatorySpawn = false;
  const spawnPromises: Promise<boolean>[] = [];
  
  if (spawnTargets.length > 0) {
    console.log('🧲 Respawning', spawnCount, 'tiles:', {
      obligatory: obligatoryCell ? 1 : 0,
      replacement: replacementSpawnCount,
      targets: spawnTargets
    });
    console.log('🧲 STATE.drag exists?', !!STATE.drag);
    console.log('🧲 STATE.drag.bindToTile exists?', !!(STATE.drag as any)?.bindToTile);
    
    // 🔥 USER REQUEST: Wild-magnet should NOT spawn extra 3 active tiles.
    
    // 🔥 CRITICAL FIX: Wait minimal time for merge-6 shards animation before spawning
    // Shards animation takes ~1.0s (ttl), but with fastFadeOut it's effectively ~0.5-0.6s
    // Wait only 50ms to ensure shards start but spawn happens very fast (standard for all merge-6 spawns)
    console.log('⏳ Waiting for merge-6 shards animation to complete before spawning...');
    await new Promise(resolve => trackAppTimeout(resolve, 50));
    
    // 🔥 CRITICAL FIX: Spawn OBLIGATORY tile FIRST (priority)
    // Then spawn replacement tiles with cascading delays
    // Obligatory tile spawns immediately (0ms delay), replacement tiles cascade (150ms, 300ms, 450ms)
    // 🔥 CRITICAL: Use Promise-based approach to track successful spawns
    for (let index = 0; index < spawnTargets.length && successfulSpawns < spawnCount; index++) {
      const { c, r } = spawnTargets[index];
      const isObligatory = obligatoryCell && c === obligatoryCell.c && r === obligatoryCell.r;
      // Obligatory tile spawns first (0ms), replacement tiles cascade (150ms, 300ms, 450ms...)
      const delay = isObligatory ? 0 : (successfulObligatorySpawn ? (successfulSpawns * 150) : 150);
      const key = `${c},${r}`;
      const forcedValue = forcedSpawnValues.get(key);
      
      // Create promise that resolves when spawn completes
      const spawnPromise = new Promise<boolean>((resolve) => {
      trackAppTimeout(() => {
        try {
          // 🔥 CRITICAL FIX v40.6: Double-check cell is still empty before spawning (race condition protection)
          // Problem: Spawning on locked tiles with value > 0 or wild tiles causes "2 tiles on same position" bug
          // Solution: ALWAYS check if tile has value > 0 or is wild, regardless of locked status
          const existingTile = STATE.grid?.[r]?.[c];
          if (existingTile) {
            const isActive = (existingTile.value|0) > 0;
            const isWildTile = tileIsWild(existingTile);
            
            // 🔥 CRITICAL: NEVER spawn on a tile that has value > 0 or is wild, even if it's locked!
            // Locked tiles with value > 0 are active tiles (e.g., during animations)
            if (isActive || isWildTile) {
              console.warn(`⚠️ Cell (${c}, ${r}) already occupied by active tile before spawn, skipping:`, {
                value: existingTile.value,
                special: existingTile.special,
                locked: existingTile.locked,
                isActive,
                isWildTile
              });
                resolve(false); // Spawn failed
                return;
            }
            
            // 🔥 CRITICAL: If tile is NOT locked, it's an active tile (should not happen, but safety check)
            if (!existingTile.locked) {
              console.warn(`⚠️ Cell (${c}, ${r}) has unlocked tile without value - this should not happen, skipping`);
                resolve(false); // Spawn failed
                return;
            }
          }
          
          // Spawn tile normally (skipBind = false means it will try to bind immediately)
            openAtCell(
              c,
              r,
              forcedValue
                ? { skipBind: false, value: forcedValue, forceFreshPlaceholder: true }
                : { skipBind: false, forceFreshPlaceholder: true }
            ).then(() => {
              // Check if spawn was successful by verifying tile exists and has value > 0
            trackAppTimeout(() => {
              const tile = STATE.grid?.[r]?.[c];
                const spawnSuccess = !!(tile && !tile.locked && (tile.value|0) > 0);
                
                if (spawnSuccess) {
                  successfulSpawns++;
                  if (isObligatory) {
                    successfulObligatorySpawn = true;
                    console.log(`✅ Successfully spawned OBLIGATORY tile below merge 6 at (${c}, ${r})`);
                  }
                // Double-check: Ensure tile is draggable and bound to drag system
                tile.eventMode = 'static';
                tile.cursor = 'pointer';
                
                // Explicitly bind to drag system (in case bindTileWithFallback failed)
                const drag = STATE.drag as any;
                if (drag && typeof drag.bindToTile === 'function') {
                  drag.bindToTile(tile);
                }
                  console.log(`✅ Successfully spawned ${isObligatory ? 'OBLIGATORY' : 'replacement'} tile at (${c}, ${r}), total successful: ${successfulSpawns}/${spawnCount}`);
                } else {
                  console.warn(`⚠️ Spawn verification failed at (${c}, ${r}) - tile not properly created`);
                  if (isObligatory) {
                    console.error(`🚨🚨🚨 CRITICAL: OBLIGATORY tile spawn failed at (${c}, ${r})!`);
              }
                }
                resolve(spawnSuccess);
            }, 50); // Small delay to ensure tile is created
          }).catch((err) => {
            console.warn(`⚠️ Failed to spawn tile at (${c}, ${r}):`, err);
            resolve(false);
          });
        } catch (err) {
          console.warn(`⚠️ Failed to respawn tile at (${c}, ${r}):`, err);
          resolve(false);
        }
      }, delay);
      });
      
      spawnPromises.push(spawnPromise);
    }
    
    // 🔥 CRITICAL: If we still don't have enough successful spawns, try to spawn on additional cells
    // Wait a bit for initial spawns to complete, then check if we need more
    await Promise.all(spawnPromises);
    
    // The destination is converted below into a fresh playable cube, so it no
    // longer needs an extra adjacent spawn to remain usable.
    // Bug: Obligatory spawn at (4,7) can fail or get lost → merge 6 at (4,8) isolated → stuck
    if (obligatorySpawnCount > 0 && dst && !dst.destroyed && Number.isFinite(dst.gridX) && Number.isFinite(dst.gridY)) {
      const m6c = dst.gridX | 0;
      const m6r = dst.gridY | 0;
      const adjacentCells = [
        { c: m6c, r: m6r - 1 }, { c: m6c, r: m6r + 1 },
        { c: m6c - 1, r: m6r }, { c: m6c + 1, r: m6r },
        { c: m6c - 1, r: m6r - 1 }, { c: m6c + 1, r: m6r - 1 },
        { c: m6c - 1, r: m6r + 1 }, { c: m6c + 1, r: m6r + 1 }
      ].filter(cell => cell.r >= 0 && cell.r < ROWS && cell.c >= 0 && cell.c < COLS);
      
      const hasAdjacentTile = adjacentCells.some(cell => {
        const t = STATE.grid?.[cell.r]?.[cell.c];
        return t && !t.destroyed && ((t.value|0) > 0 || tileIsWild(t));
      });
      
      if (!hasAdjacentTile) {
        console.warn('🚨 STUCK MERGE 6 FIX: Merge 6 has no adjacent tiles - forcing spawn at obligatory cell');
        const fallbackCell = obligatoryCell || adjacentCells[0];
        if (fallbackCell) {
          try {
            await openAtCell(fallbackCell.c, fallbackCell.r, {
              skipBind: false,
              value: 1 + Math.floor(Math.random() * 3),
              forceFreshPlaceholder: true,
            });
            const tile = STATE.grid?.[fallbackCell.r]?.[fallbackCell.c];
            if (tile && !tile.destroyed && (tile.value|0) > 0) {
              tile.eventMode = 'static';
              tile.cursor = 'pointer';
              const drag = STATE.drag as any;
              if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(tile);
              successfulSpawns++;
              console.log('✅ STUCK MERGE 6 FIX: Spawned fallback tile at', fallbackCell);
            }
          } catch (e) {
            console.warn('⚠️ STUCK MERGE 6 FIX: Fallback spawn failed:', e);
          }
        }
      }
    }
    
    if (successfulSpawns < spawnCount && spawnCount > 0) {
      console.warn(`⚠️ Only ${successfulSpawns}/${spawnCount} tiles spawned successfully, attempting to spawn remaining tiles...`);
      
      // 🔥 USER REQUEST: When spawning additional tiles, ensure they are mergeable
      // Try to find additional empty cells for remaining spawns
      // 🔥 CRITICAL: Exclude reserved cells (6 locked placeholders) - never spawn in them!
      const remainingCount = spawnCount - successfulSpawns;
      let additionalTargets = findRandomEmptyCells(remainingCount + LOCKED_RESERVE_COUNT);
      additionalTargets = additionalTargets
        .filter(c => isAllowedReplacementCell(c) && !reservedSet.has(`${c.c},${c.r}`))
        .slice(0, remainingCount);
      
      // Generate mergeable values for remaining spawns
      const mergeableValues = [1, 2, 3, 4, 5]; // All can potentially merge
      const additionalForcedValues = new Map<string, number>();
      
      // For remaining spawns, try to create mergeable pairs if possible
      if (remainingCount >= 2) {
        const pairs: [number, number][] = [[1, 5], [2, 4], [3, 3], [1, 1], [2, 2]];
        const chosenPair = pairs[Math.floor(Math.random() * pairs.length)];
        if (additionalTargets.length >= 2) {
          additionalForcedValues.set(`${additionalTargets[0].c},${additionalTargets[0].r}`, chosenPair[0]);
          additionalForcedValues.set(`${additionalTargets[1].c},${additionalTargets[1].r}`, chosenPair[1]);
          console.log('🎯 Additional spawns: Forcing mergeable pair', chosenPair, 'for remaining tiles');
        }
      }
      
      for (let i = 0; i < additionalTargets.length && successfulSpawns < spawnCount; i++) {
        const { c, r } = additionalTargets[i];
        const key = `${c},${r}`;
        const forcedValue = additionalForcedValues.get(key) || mergeableValues[Math.floor(Math.random() * mergeableValues.length)];
        
        try {
          await openAtCell(c, r, { skipBind: false, value: forcedValue, forceFreshPlaceholder: true });
          trackAppTimeout(() => {
            const tile = STATE.grid?.[r]?.[c];
            if (tile && !tile.locked && (tile.value|0) > 0) {
              successfulSpawns++;
              tile.eventMode = 'static';
              tile.cursor = 'pointer';
              const drag = STATE.drag as any;
              if (drag && typeof drag.bindToTile === 'function') {
                drag.bindToTile(tile);
              }
              console.log(`✅ Successfully spawned additional tile (value: ${forcedValue}) at (${c}, ${r}), total successful: ${successfulSpawns}/${spawnCount}`);
            }
          }, 50);
        } catch (err) {
          console.warn(`⚠️ Failed to spawn additional tile at (${c}, ${r}):`, err);
        }
      }
      
      if (successfulSpawns < spawnCount) {
        console.error(`🚨🚨🚨 CRITICAL: Only ${successfulSpawns}/${spawnCount} tiles spawned! This will cause incorrect tile count!`);
      }
    }
    
    // Keep the six reserved placeholder cells synchronized after every Magnet/Honey
    // respawn. This path no longer calls spawnLockedTilesWithPop, so there is no
    // alternate ownership flag to branch on here.
    try {
      const board = STATE.board;
      const grid = STATE.grid;
      const tiles = STATE.tiles;
      const makeBoardForFill = helpers?.makeBoard ?? (await import('./board.js'));
      if (board && grid && tiles && makeBoardForFill) {
        fillNullCellsWithLockedPlaceholders({
          ROWS,
          COLS,
          board,
          grid,
          tiles,
          makeBoard: makeBoardForFill,
          fixHoverAnchor,
        }, { cells: reservedForLocked });
        try { drawBoardBG?.(); } catch {}
      }
    } catch (err) {
      console.warn('⚠️ fillNullCellsWithLockedPlaceholders failed:', err);
    }
  } else if (spawnCount > 0) {
    console.warn('⚠️ No spawn targets found!', {
      spawnCountRequested: spawnCount,
      spawnTargetsFound: spawnTargets.length,
      pulledCellsCount: pulledCells.length,
      hasTilesToRespawn,
      note: 'Wild-magnet merge did not spawn any new tiles - board might be full or spawn logic issue!'
    });
    // Still fill null cells with locked placeholders (holes from removed pulled tiles)
    try {
      const board = STATE.board;
      const grid = STATE.grid;
      const tiles = STATE.tiles;
      const makeBoardForFill = helpers?.makeBoard ?? (await import('./board.js'));
      if (board && grid && tiles && makeBoardForFill) {
        fillNullCellsWithLockedPlaceholders({
          ROWS,
          COLS,
          board,
          grid,
          tiles,
          makeBoard: makeBoardForFill,
          fixHoverAnchor,
        }, { cells: reservedForLocked });
        try { drawBoardBG?.(); } catch {}
      }
    } catch (err) {
      console.warn('⚠️ fillNullCellsWithLockedPlaceholders failed (no spawn targets):', err);
    }
  }

  // Keep board placeholders in sync after magnet respawn/fill paths before any endgame branching.
  try { (window as any).updateGhostVisibility?.(); } catch {}
  try { drawBoardBG?.(); } catch {}
  shouldRunPostMagnetEndgameCheck = true;

  // 🔥 REMOVED: Premature endgame check - this was causing instant fail screen
  // when magnet pulled wild star (e.g., magnet + regular + wild scenario)
  // The check would see only merge 6 tile BEFORE wild merged with it
  // We'll check endgame AFTER all merges complete (line 1020)
  
  // 🔥 CRITICAL FIX: REMOVED premature mergeability check!
  // This check was causing instant fail screen when magnet pulled wild tiles
  // because it ran BEFORE the pulled tiles merged with merge 6 tile
  // Example: magnet + stack (2 tiles) + wild star
  //   1. Magnet merges with stack → merge 6
  //   2. Magnet pulls wild star → wild is LOCKED and animating towards merge 6
  //   3. Respawn 1 new tile (because 1 tile was pulled)
  //   4. OLD CHECK: anyMergePossible sees: merge 6 + new tile + wild (LOCKED)
  //      - Wild is LOCKED so tileIsActive doesn't count it
  //      - Result: only 2 tiles (merge 6 + new tile) → NOT MERGABLE → FAIL SCREEN ❌
  //   5. CORRECT: Let pulled tiles merge with merge 6 FIRST, then check endgame
  //
  // The endgame check will happen automatically in app-core.ts after all animations complete
  // via checkLevelEnd (line 3251) which has proper delays and handles all edge cases
  
  console.log('🧲 Respawn complete — converting magnet merge-6 cell to fresh playable cube (v2.0.636 parity)');
  try {
    if (!(dst as any)?._isLastMerge && dst && !dst.destroyed && (dst.value | 0) === 6) {
      const isMagnetMerge6Still =
        dst.special === 'wild-magnet' ||
        (dst as any)._wasWildMagnetMerge6 === true ||
        (dst as any)._isWildMagnetMerge === true ||
        (dst as any)._isWildMagnetLastTwo === true ||
        (dst as any)._wildMagnetPulledTilesMerge === true ||
        (dst as any)._wildMagnetMergeCallback;

      if (isMagnetMerge6Still) {
        const c = dst.gridX | 0;
        const r = dst.gridY | 0;
        try {
          stopSpecialDiceIdleMotion(dst);
        } catch {}
        try {
          stopMagnetIdleParticles(dst);
        } catch {}
        try {
          if (STATE.grid?.[r]?.[c] !== dst) STATE.grid[r][c] = dst;
        } catch {}
        collapseTileToSingleStackVisual(dst);

        // The survivor reuses the former special container. Normalize every
        // transform owner synchronously before revealing it so Bottle's anchor
        // and Magnet impact tweens cannot displace the regular face from its
        // shadow/grid centre.
        try {
          gsap.killTweensOf(dst);
          gsap.killTweensOf(dst.scale);
          gsap.killTweensOf(dst.rotG);
          gsap.killTweensOf(dst.rotG?.scale);
          gsap.killTweensOf(dst.base);
          gsap.killTweensOf(dst.base?.scale);
        } catch {}
        const canonicalX = c * (TILE + GAP) + TILE / 2;
        const canonicalY = r * (TILE + GAP) + TILE / 2;
        dst.x = canonicalX;
        dst.y = canonicalY;
        dst.targetX = canonicalX;
        dst.targetY = canonicalY;
        dst.rotation = 0;
        dst.scale?.set?.(1, 1);
        if (dst.rotG) {
          dst.rotG.position?.set?.(
            Number.isFinite(dst.rotG.pivot?.x) ? dst.rotG.pivot.x : 0,
            Number.isFinite(dst.rotG.pivot?.y) ? dst.rotG.pivot.y : -TILE / 2,
          );
          dst.rotG.rotation = 0;
          dst.rotG.scale?.set?.(1, 1);
        }
        if (dst.base) {
          dst.base.anchor?.set?.(0.5, 0.5);
          dst.base.position?.set?.(0, 0);
          dst.base.rotation = 0;
          dst.base.scale?.set?.(1, 1);
          dst.base.width = TILE;
          dst.base.height = TILE;
        }
        if (dst.shadow) {
          dst.shadow.rotation = 0;
          dst.shadow.scale?.set?.(1, 1);
        }

        const wildTarget = Number.isFinite((dst as any)._wildMergeTarget)
          ? (dst as any)._wildMergeTarget
          : undefined;
        const freshVal = randomRegularTileValue(wildTarget);

        delete (dst as any)._magnetMerge6Hidden;
        delete (dst as any)._wildMagnetAffected;
        delete (dst as any)._wildMagnetOriginalX;
        delete (dst as any)._wildMagnetOriginalY;
        delete (dst as any)._wildMagnetPulledTilesScoring;
        delete (dst as any)._hasTilesToPull;
        delete (dst as any)._isWildMagnetMerge;
        delete (dst as any)._wildMagnetPulledTilesMerge;
        delete (dst as any)._wildMagnetMergeCallback;
        clearSpecialDiceIdentity(dst);

        try { dst.refreshShadow?.(); } catch {}

        dst.locked = false;
        dst.visible = true;
        dst.alpha = 1;
        dst.eventMode = 'static';
        dst.cursor = 'pointer';
        const boardHelpers = helpers?.makeBoard ?? makeBoard;
        boardHelpers.syncTileZIndex(dst, STATE.board);
        try {
          boardHelpers.setValue(dst, freshVal, 0);
        } catch {
          dst.value = freshVal;
        }
        releaseSpecialDiceResolution(dst);
        if (dst.overlay) {
          dst.overlay.visible = false;
          dst.overlay.alpha = 1;
        }
        if (dst.pips) {
          dst.pips.visible = true;
          dst.pips.alpha = 1;
        }
        if (dst.num) dst.num.alpha = 1;
        if (dst.rotG) dst.rotG.alpha = 1;
        if (dst.base) dst.base.alpha = 1;
        try { fixHoverAnchor?.(dst); } catch {}

        const drag = STATE.drag as any;
        // Match the other Magnet results: the converted survivor enters through
        // the standard tile pop-in instead of appearing at full size instantly.
        // Input is rebound only after the visual owner completes.
        spawnBounce(dst, () => {
          if (!dst || dst.destroyed) return;
          try { drag?.bindToTile?.(dst); } catch {}
        }, {
          max: 1.08,
          compress: 0.96,
          rebound: 1.02,
          startScale: 0.30,
          wiggle: 0.035,
          keepFullOpacity: true,
        });
        console.log('🧲 Converted magnet merge-6 to fresh cube', freshVal, 'at', c, r);
      }
    }
  } catch (err) {
    console.warn('⚠️ Magnet merge-6 → fresh cube conversion failed:', err);
  }
  
  // 🔥 USER FIX: After removing merge 6, fill any null cells with locked placeholders (like wild juice/star)
  // Must run AFTER merge 6 removal so the freed cell gets filled. Ensures 6+ locked tiles visible.
  if (!(dst as any)?._isLastMerge) {
    try {
      const board = STATE.board;
      const grid = STATE.grid;
      const tiles = STATE.tiles;
      const makeBoardForFill = helpers?.makeBoard ?? (await import('./board.js'));
      if (board && grid && tiles && makeBoardForFill) {
        fillNullCellsWithLockedPlaceholders({
          ROWS,
          COLS,
          board,
          grid,
          tiles,
          makeBoard: makeBoardForFill,
          fixHoverAnchor,
        }, { cells: reservedForLocked });
        try { drawBoardBG?.(); } catch {}
      }
    } catch (err) {
      console.warn('⚠️ fillNullCellsWithLockedPlaceholders (post-merge6-removal) failed:', err);
    }
  }

  // This is the transaction boundary: replacement tiles are committed, the
  // consumed Magnet/Honey is now a fresh regular cube, and placeholders are in
  // sync. Everything below is endgame verification or visual settle time and
  // must not continue owning gameplay input.
  try {
    emitIOSSpecialTransactionTrace('magnet-board-commit-ready', {
      successfulSpawns,
      spawnCount,
      dstValue: dst?.value ?? null,
      dstSpecial: dst?.special ?? null,
      dstLocked: dst?.locked === true,
    });
    helpers?.onMagnetBoardCommit?.();
  } catch (error) {
    emitIOSSpecialTransactionTrace('magnet-board-commit-callback-error', {
      message: error instanceof Error ? error.message : String(error),
    });
    console.warn('⚠️ Magnet board-commit release callback failed:', error);
  }
  
  // 🔥 USER BUG FIX: Wait LONGER for spawn animations to complete before checking endgame
  // Problem: User had 5 tiles spawn after magnet, started merging 3+3, got fail screen
  // Root cause: Spawn animations and tile bindings weren't complete when user tried to merge
  // Spawn bounce animation with timeScale 2.0 takes ~0.24s (240ms) per tile
  // With cascading delays (0ms, 150ms, 300ms, 450ms, 600ms for 5 tiles), last tile finishes at ~840ms
  // Plus unlock/bind/eventMode setup takes ~100ms per tile, so last tile is fully ready at ~940ms
  // Plus safety margin: Total safe delay: 1200ms
  // This ensures ALL spawn animations, unlocks, and bindings are complete before endgame check
  console.log('⏳ Waiting 1200ms for spawn animations to complete before endgame check...');
  await new Promise(resolve => trackAppTimeout(resolve, 1200));
  
  // 🔥 CRITICAL: Check if ALL tiles can be merged together (simulate all possible merges)
  // If all tiles can be merged and the final merge is merge 6, trigger clean board flow
  const canAllMerge = await checkIfAllTilesCanMerge(STATE.tiles, helpers);
  if (canAllMerge) {
    console.log('🚨🚨🚨 All tiles can be merged together - will trigger clean board flow after final merge 6');
    // Note: Clean board flow will be triggered automatically when the final merge 6 occurs
    // This is handled in the merge function when board becomes clean
  }
  
  // 🔥 USER BUG FIX: Before calling checkLevelEnd, verify that spawn animations AND tile bindings are complete
  // Track expected spawns based on actual successful spawns when available
  const expectedSpawnedTiles = successfulSpawns > 0 ? successfulSpawns : spawnCount;
  
  const computeSpawnState = () => {
    const spawnState = getTransientSpawnState(STATE.tiles, {
      autoClearStaleFlag: true,
      ignoreWildJuice: true,
    });
    const { lockedActiveTiles, tilesStillSpawning } = spawnState;

    const activeTilesAfterSpawn = STATE.tiles.filter(tileIsActive);
    return {
      lockedActiveTiles,
      tilesStillSpawning,
      activeTilesAfterSpawn,
      actualTileCount: activeTilesAfterSpawn.length
    };
  };
  
  let spawnState = computeSpawnState();
  const minExpectedTileCount = expectedSpawnedTiles;
  
  console.log('🧲 Spawn verification (enhanced):', {
    lockedTilesStillAnimating: spawnState.lockedActiveTiles.length,
    tilesStillSpawning: spawnState.tilesStillSpawning.length,
    minExpectedTileCount: minExpectedTileCount,
    actualTileCount: spawnState.actualTileCount,
    spawnCount: spawnCount,
    expectedSpawnedTiles: expectedSpawnedTiles,
    merge6ConvertedToFreshCube: true,
    activeTiles: spawnState.activeTilesAfterSpawn.map((t: any) => ({ 
      value: t.value, 
      special: t.special,
      eventMode: t.eventMode,
      locked: t.locked
    }))
  });
  
  // Wait if ANY tiles are still locked or spawning
  if (spawnState.lockedActiveTiles.length > 0 || spawnState.tilesStillSpawning.length > 0) {
    console.log('⏳ Delaying endgame check - spawn animations/bindings still in progress:', {
      lockedCount: spawnState.lockedActiveTiles.length,
      stillSpawningCount: spawnState.tilesStillSpawning.length,
      lockedTiles: spawnState.lockedActiveTiles.map((t: any) => ({ value: t.value, special: t.special })),
      spawningTiles: spawnState.tilesStillSpawning.map((t: any) => ({ 
        value: t.value, 
        special: t.special,
        eventMode: t.eventMode,
        isBeingSpawned: t._isBeingSpawned
      }))
    });
    // Wait additional 600ms (increased from 500ms) for spawn animations and bindings to complete
    await new Promise(resolve => trackAppTimeout(resolve, 600));
    spawnState = computeSpawnState();
  }
  
  // 🔥 FIX: Only warn if we have ZERO active tiles after spawn (critical error)
  // Having fewer tiles than spawnCount is not necessarily an error - other tiles may have been merged
  if (spawnState.actualTileCount === 0 && spawnCount > 0) {
    console.error('🚨🚨🚨 CRITICAL: No active tiles after spawn!', {
      minExpected: minExpectedTileCount,
      actual: spawnState.actualTileCount,
      spawnCount: spawnCount,
      note: 'No tiles were spawned - this will cause incorrect endgame check!'
    });
    // Wait additional time and re-check
    await new Promise(resolve => trackAppTimeout(resolve, 500));
    let recheckState = computeSpawnState();
    console.log('🧲 Re-check after additional wait:', {
      minExpected: minExpectedTileCount,
      actual: recheckState.actualTileCount,
      tiles: recheckState.activeTilesAfterSpawn.map((t: any) => ({ value: t.value, special: t.special }))
    });
    
    // 🔥 LAST-RESORT: If still zero tiles, attempt a minimal fallback spawn
    if (recheckState.actualTileCount === 0) {
      const fallbackCount = Math.max(1, Math.min(spawnCount, 2));
      console.warn('⚠️ Fallback spawn attempt after zero tiles detected:', { fallbackCount });
      let fallbackTargets = findRandomEmptyCells(fallbackCount + LOCKED_RESERVE_COUNT);
      fallbackTargets = fallbackTargets.filter(c => !reservedSet.has(`${c.c},${c.r}`)).slice(0, fallbackCount);
      for (const target of fallbackTargets) {
        const fallbackValue = 1 + Math.floor(Math.random() * 3);
        try {
          await openAtCell(target.c, target.r, {
            skipBind: false,
            value: fallbackValue,
            forceFreshPlaceholder: true,
          });
        } catch (err) {
          console.warn('⚠️ Fallback spawn failed:', err);
        }
      }
      await new Promise(resolve => trackAppTimeout(resolve, 100));
      recheckState = computeSpawnState();
      console.log('🧲 Fallback spawn re-check:', {
        actual: recheckState.actualTileCount,
        tiles: recheckState.activeTilesAfterSpawn.map((t: any) => ({ value: t.value, special: t.special }))
      });
    }
  } else if (spawnState.actualTileCount < minExpectedTileCount && spawnCount > 0) {
    // Just a warning, not critical - other tiles may have been removed during merge animations
    console.warn('⚠️ Spawn verification: Fewer tiles than spawned', {
      minExpected: minExpectedTileCount,
      actual: spawnState.actualTileCount,
      spawnCount: spawnCount,
      note: 'Some spawned tiles may have been merged already - this is usually OK'
    });
  }
  
  // 🔥 CRITICAL FIX: Check if bubbles animation is still running (from wild-juice merge)
  // Bubbles animation can run for 4+ seconds and shouldn't block endgame detection
  // BUT: We should ensure spawn animations are complete before checking endgame
  try {
    const { isWildJuiceExplosionRunning } = await import('./fx.js');
    if (typeof isWildJuiceExplosionRunning === 'function' && isWildJuiceExplosionRunning()) {
      console.log('💧 Bubbles animation is running, but spawn animations are complete - proceeding with endgame check');
      // Bubbles animation is visual only and doesn't block endgame detection
    }
  } catch (err) {
    console.warn('⚠️ Failed to check bubbles animation status:', err);
  }
  
  // Magnet cleanup + merge-6 → fresh cube: handled in conversion block after respawn (bind scheduled there).

  // 🔥 CRITICAL FIX: Check if board is clean BEFORE calling checkLevelEnd
  // If new tiles can be merged, don't trigger clean board flow yet - wait for player to merge them
  // 🔥 CRITICAL FIX: Check if _isLastMerge flag is set - if so, this was marked as last merge BEFORE pulled tiles merged
  // If pulled tiles were merged and new tiles spawned, this is NOT last merge anymore!
  // Note: isLastMergeFlagSet is already declared above (line 1311), so we reuse it here
  
  // 🔥 CRITICAL FIX v85: Wait for ALL spawned tiles to be unlocked before checking endgame
  // Spawned tiles unlock asynchronously (via setTimeout in openLockedBounceParallel/openAtCell)
  // We need to wait until ALL tiles are unlocked before checking anyMergePossible
  // Maximum wait: 500ms (spawn animation + unlock delay)
  // This ensures endgame check sees all spawned tiles and correctly determines if game can continue
  let allTilesUnlocked = false;
  let retryCount = 0;
  const maxRetries = 10; // 10 retries * 50ms = 500ms max wait
  while (!allTilesUnlocked && retryCount < maxRetries) {
    const activeTilesCheck = STATE.tiles.filter(isPlayablePostMagnetTile);
    const lockedActiveTilesCheck = activeTilesCheck.filter((t: any) => t.locked && (t.value|0) > 0);
    
    if (lockedActiveTilesCheck.length === 0) {
      allTilesUnlocked = true;
      console.log('✅ All spawned tiles are now unlocked');
    } else {
      retryCount++;
      console.log(`⏳ Waiting for ${lockedActiveTilesCheck.length} tiles to unlock (retry ${retryCount}/${maxRetries})...`);
      await new Promise(resolve => trackAppTimeout(resolve, 50));
    }
  }
  
  if (!allTilesUnlocked) {
    console.warn('⚠️ Some tiles are still locked after max wait time, proceeding with check anyway');
  }
  
  const { makeBoard } = helpers;
  const postMagnetResolution = resolvePostMagnetEndgameAction({
    tiles: STATE.tiles,
    anyMergePossible: makeBoard?.anyMergePossible,
    isLastMergeFlagSet,
    spawnCount,
  });
  const activeTilesFinal = postMagnetResolution.activeTiles;
  const unlockedActiveTiles = postMagnetResolution.unlockedActiveTiles;
  const hasMergeableTiles = activeTilesFinal.length > 1; // More than just merge 6 = can merge
  const isBoardClean = postMagnetResolution.isBoardClean;
  const hasUnlockedTiles = unlockedActiveTiles.length > 1; // More than just merge 6 = can merge
  const hasSpawnedNewTiles = postMagnetResolution.hasSpawnedNewTiles;
  const isActuallyLastMerge = postMagnetResolution.isActuallyLastMerge;
  const hasMergeOrStackPotential = postMagnetResolution.hasMergeOrStackPotential;
  console.log('🧲 anyMergePossible check with ALL active tiles (after unlock wait):', {
    activeTilesCount: activeTilesFinal.length,
    unlockedTilesCount: unlockedActiveTiles.length,
    hasMergeOrStackPotential,
    tiles: activeTilesFinal.map((t: any) => ({ value: t.value, special: t.special, locked: t.locked }))
  });
  
  console.log('🧲 Pre-checkLevelEnd verification:', {
    isLastMergeFlagSet,
    hasSpawnedNewTiles,
    isActuallyLastMerge,
    activeTilesCount: activeTilesFinal.length,
    unlockedActiveTilesCount: unlockedActiveTiles.length,
    hasMergeableTiles,
    hasUnlockedTiles,
    hasMergeOrStackPotential,
    isBoardClean,
    expectedSpawnCount: spawnCount,
    tiles: activeTilesFinal.map((t: any) => ({ value: t.value, special: t.special, locked: t.locked }))
  });
  
  // 🔥 USER REQUEST: Logic for end game check
  // 1. If unlocked tiles have merge/stack potential → game continues (don't call checkLevelEnd)
  // 2. If board is clean AND no merge potential → trigger clean board flow (regardless of isActuallyLastMerge)
  // 3. If no merge/stack potential → call checkLevelEnd (will check stuck and show fail screen)
  if (postMagnetResolution.action === 'continue' && postMagnetResolution.reason === 'merge-or-stack-potential') {
    // Spawned tiles have potential for merge/stack → game continues
    if (postMagnetResolution.shouldClearLastMergeFlag) {
      console.log('🧲 _isLastMerge flag was set, but new tiles with merge potential were spawned - this is NOT last merge anymore, clearing flag');
      // Clear the flag since new tiles with merge potential were spawned
      (dst as any)._isLastMerge = false;
    }
    // Keep board placeholders/hint state in sync even when we skip full checkLevelEnd fail/clean path.
    try { (window as any).updateGhostVisibility?.(); } catch {}
    // 🔥 UX FIX: STACK IT! hint is recomputed inside checkLevelEnd().
    // This branch previously returned early and could leave hint stale/hidden after magnet flows.
    pendingPostGuardEndgameCheckSource = 'mergePulledTiles_mergePotential_refresh';
    console.log('✅ Spawned tiles have merge/stack potential - game continues, NOT calling checkLevelEnd');
    return; // Don't call checkLevelEnd - let player merge/stack tiles
  }
  
  // No merge/stack potential - check if board is clean or if we should show fail screen
  // 🔥 BUG FIX 1: Check isBoardClean independently - if board is clean and no merge potential, trigger clean board flow
  // This handles the case where isBoardClean is true but isActuallyLastMerge is false (due to spawnCount > 0)
  if (postMagnetResolution.reason === 'clean-merge6-only') {
    console.log('🧲 Board is clean (only merge 6, no other tiles) and no merge potential - calling checkLevelEnd to trigger clean board flow');
    requestPostGuardEndgameCheck('mergePulledTiles_clean_merge6_only');
    return; // Exit early after triggering clean board flow
  }
  
  // 🔥 BUG FIX 2: Check if we have no merge potential and either:
  // - We have unlocked tiles (normal stuck case), OR
  // - We have locked tiles but no merge potential (all tiles locked after spawn, stuck state)
  // In both cases, we should call checkLevelEnd to check stuck and show fail screen
  // 🔥 CRITICAL FIX: Also check for single tile that can't merge (e.g., after player merges spawned tiles)
  if (postMagnetResolution.action === 'check-level-end') {
    // No merge/stack potential - check if we have any active tiles (locked or unlocked)
    const hasAnyActiveTiles = activeTilesFinal.length > 0;
    
    if (unlockedActiveTiles.length > 0) {
      // No merge/stack potential but we have unlocked tiles → call checkLevelEnd to check stuck and show fail screen
      console.log('🚨 No merge/stack potential with unlocked tiles - calling checkLevelEnd to check stuck and show fail screen');
      requestPostGuardEndgameCheck('mergePulledTiles_stuck_unlocked_tiles');
      return; // Exit early after triggering fail screen check
    } else if (hasAnyActiveTiles && activeTilesFinal.length >= 1) {
      // 🔥 CRITICAL FIX: Changed from > 1 to >= 1 to catch single tile stuck state
      // No merge/stack potential, all tiles are locked OR only 1 tile remains → stuck state
      // This handles Bug 2: all tiles remain locked after spawn, no merge potential
      // AND Bug: after player merges spawned tiles (1+1=2), only 1 tile remains that can't merge
      console.log('🚨 No merge/stack potential, tiles are locked OR only 1 tile remains - calling checkLevelEnd to check stuck and show fail screen');
      requestPostGuardEndgameCheck('mergePulledTiles_stuck_active_tiles');
      return; // Exit early after triggering fail screen check
    }
  }
  
  // Fallback: If we get here, something unexpected happened
  if (isLastMergeFlagSet && hasSpawnedNewTiles) {
    console.log('🧲 _isLastMerge flag was set, but new tiles were spawned - this is NOT last merge anymore, clearing flag');
    // Clear the flag since new tiles were spawned
    (dst as any)._isLastMerge = false;
  }
    console.log('🧲 Board has mergeable tiles OR new tiles were spawned - NOT calling checkLevelEnd yet, waiting for player to merge');
    console.log('🧲 Details:', {
      isBoardClean,
      hasUnlockedTiles,
      hasMergeOrStackPotential,
      isLastMergeFlagSet,
      hasSpawnedNewTiles,
      isActuallyLastMerge,
      activeTilesCount: activeTilesFinal.length,
      unlockedTilesCount: unlockedActiveTiles.length,
      note: 'checkLevelEnd will be called automatically after merge completes (via post-merge check in app-core.ts)'
    });
  } finally {
    if (endgameGuardActive && typeof endEndgameGuard === 'function') {
      try {
        endEndgameGuard(endgameGuardSource);
        endgameGuardActive = false;
      } catch (error) {
        console.warn('⚠️ Failed to end endgame guard in mergePulledTilesIntoMerge6', error);
      }
    }
    const postGuardCheckSource = pendingPostGuardEndgameCheckSource
      || (shouldRunPostMagnetEndgameCheck ? 'mergePulledTiles_postGuard_settle' : null);
    if (postGuardCheckSource) {
      // checkLevelEnd owns its own settle delay and transient-state retries. Invoke it once,
      // only after this magnet transaction has released its guard; calling it before the
      // release makes the checker defer and can leave NO MOVES waiting for the next drag.
      triggerCentralEndgameCheck(postGuardCheckSource);
    }
  }
}

export async function handleWildMagnetMergedPulledTiles(dst: any, pulledTiles: any[], helpers: any): Promise<boolean> {
  console.log('🧲 handleWildMagnetMergedPulledTiles called with', pulledTiles?.length || 0, 'tiles');
  
  // Filter valid tiles. A wild that is still dropping from the meter/crate is in STATE.tiles
  // for rendering, but it is not a legal magnet target until the drop settles.
  const transientPulledTiles = (pulledTiles || []).filter((t: any) => t && tileIsTransientForMagnetPull(t));
  if (transientPulledTiles.length > 0) {
    console.warn('🧲 Ignoring transient/spawning tiles in magnet pull target list', transientPulledTiles.map((t: any) => ({
      value: t?.value,
      special: t?.special,
      gridX: t?.gridX,
      gridY: t?.gridY,
      dropping: t?._ccWildSpawnDropping === true,
    })));
  }
  const validTiles = (pulledTiles || []).filter((t: any) => t && !tileIsTransientForMagnetPull(t));
  
  // 🔥 CRITICAL FIX: Allow empty array if _isLastMerge flag is set (final merge-6 scenario)
  // This allows clean board flow to be triggered when magnet + 1 tile = final merge-6
  const isLastMergeFlagSet = (dst as any)?._isLastMerge === true;
  
  if (validTiles.length < 1 && !isLastMergeFlagSet) {
    console.warn('⚠️ Not enough pulled tiles (need at least 1, got', validTiles.length, ') and NOT final merge-6');
    return false;
  }
  
  if (isLastMergeFlagSet && validTiles.length === 0) {
    console.log('🚨🚨🚨 Final merge-6 detected in handleWildMagnetMergedPulledTiles - calling mergePulledTilesIntoMerge6 with empty array to trigger clean board');
  }
  
  console.log('🧲 Pulled tiles state:', validTiles.map((t: any, i: number) => ({
    [`tile${i + 1}`]: { value: t.value, special: t.special, destroyed: t.destroyed }
  })));
  
  // Merge all pulled tiles into merge 6 with 4x multiplier and magnet animations
  // If validTiles.length === 0 and _isLastMerge is set, mergePulledTilesIntoMerge6 will trigger clean board
  await mergePulledTilesIntoMerge6(dst, validTiles, helpers);
  
  console.log('✅ mergePulledTilesIntoMerge6 completed');
  
  return true;
}


// 🔥 DEAD CODE REMOVED: merge() function (677 lines) - was never used, app-core.ts has the active merge()
// 🔥 DEAD CODE REMOVED: checkGameOver() function (4 lines) - deprecated, centralized checker is used instead
