// @ts-nocheck
// src/modules/app-merge.js
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { STATE, ENDLESS, REFILL_ON_SIX_BY_DEPTH } from './app-state.js';
import * as makeBoard from './board.js';
import { glassCrackAtTile, woodShardsAtTile, spawnMerge6Shards, innerFlashAtTile, showMultiplierTile, screenShake, wildImpactEffect, smokeBubblesAtTile, stopWildIdle, stopWildBeerBubbles, stopWildStars, stopWildShimmer, stopMagnetIdleParticles, wildMagnetMerge6ShardsTemplated } from "./fx.ts";
import { COLS, ROWS, TILE, GAP } from './constants.js';
import * as HUD from './hud-helpers.ts';
import { openAtCell, openEmpties, spawnBounce } from './app-spawn.ts';
import { showBoardFailModal } from './board-fail-modal.js';
import { rebuildBoard } from './app-board.ts';
import { drawBoardBG } from './app-core.js';
import { statsService } from '../services/stats-service.js';

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
  return special === 'wild' || special === 'wild-magnet' || special === 'wild-beer' || tile.isWild === true || tile.isWildFace === true;
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
  try { if ((t as any).hover?.clear) (t as any).hover.clear(); } catch {}
  t.eventMode='none'; t.removeAllListeners?.();
  
  // 🔥 MEMORY LEAK FIX: Kill ALL animations and timelines on tile
  try{ 
    gsap.killTweensOf(t); 
    gsap.killTweensOf(t.scale); 
    gsap.killTweensOf((t as any).rotG);
    
    // Kill all stored timelines
    if ((t as any)._wobbleTl) { (t as any)._wobbleTl.kill(); (t as any)._wobbleTl = null; }
    if ((t as any)._bounceTl) { (t as any)._bounceTl.kill(); (t as any)._bounceTl = null; }
    if ((t as any)._bounceRotTl) { (t as any)._bounceRotTl.kill(); (t as any)._bounceRotTl = null; }
    if ((t as any)._preBounceTl) { (t as any)._preBounceTl.kill(); (t as any)._preBounceTl = null; }
    if ((t as any)._preBounceRotTl) { (t as any)._preBounceRotTl.kill(); (t as any)._preBounceRotTl = null; }
    if ((t as any)._mergeTween) { (t as any)._mergeTween.kill(); (t as any)._mergeTween = null; }
    if ((t as any)._wildMergeTween) { (t as any)._wildMergeTween.kill(); (t as any)._wildMergeTween = null; }
    if ((t as any)._pulseTween) { (t as any)._pulseTween.kill(); (t as any)._pulseTween = null; }
    if ((t as any)._wildPulseTween) { (t as any)._wildPulseTween.kill(); (t as any)._wildPulseTween = null; }
    if ((t as any)._spawnTween) { (t as any)._spawnTween.kill(); (t as any)._spawnTween = null; }
    if ((t as any)._destroyTween) { (t as any)._destroyTween.kill(); (t as any)._destroyTween = null; }
  }catch{}
  
  // 🔥 CRITICAL FIX: Clear grid position BEFORE removing from board
  // This ensures grid is clean and openAtCell can spawn new tiles properly
  if (t.gridX !== undefined && t.gridY !== undefined && STATE.grid && STATE.grid[t.gridY]) {
    if (STATE.grid[t.gridY][t.gridX] === t) {
      STATE.grid[t.gridY][t.gridX] = null;
      console.log(`🧹 removeTile: Cleared grid[${t.gridY}][${t.gridX}]`);
    }
  }
  
  if (STATE.board) STATE.board.removeChild(t);
  STATE.tiles = STATE.tiles.filter(x=>x!==t);
  t.destroy?.({children:true, texture:false, textureSource:false});
}

export function clearWildState(tile){
  if (!tile) return;
  try { stopWildIdle(tile); } catch {}
  // Only clear wild state if it's a regular wild (not wild-magnet, which keeps its special property)
  if (tile.special === 'wild' || tile.special === 'wild-beer') {
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
    trackTween(tile, {
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
      isWild: t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer',
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
            currentTiles = currentTiles.filter((_, idx) => idx !== i && idx !== j);
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
  
  // Filter valid tiles
  const validTiles = tiles.filter((t: any) => t && !t.destroyed);
  const pulledTileCount = validTiles.length;
  const pulledCells: { c: number; r: number }[] = [];
  
  // 🔥 SOURCE OF TRUTH: Wild Magnet - Mode B — No tiles to attract
  // Magnet must not invent attraction. If the merge is final Merge-6 → trigger CLEAN BOARD
  // Otherwise board continues only if allowed by other rules (preload etc.)
  // 🔥 CRITICAL FIX: If NO tiles were pulled (validTiles.length === 0), merge 6 tile is the ONLY tile left
  // This happens when magnet merges with a tile but there are NO other tiles on board to pull
  // In this case, merge 6 tile should be removed and clean board flow should be triggered
  if (validTiles.length === 0 && dst && !dst.destroyed) {
    console.log('🚨🚨🚨 SOURCE OF TRUTH: Wild Magnet Mode B — No tiles to attract');
    console.log('🎯 Source of Truth: If the merge is final Merge-6 → trigger CLEAN BOARD');
    console.log('🚨🚨🚨 EDGE CASE: Magnet merge but NO tiles to pull - Only merge 6 remains, triggering clean board flow');
    
    // Remove merge 6 tile
    removeTile(dst);
    
    // 🔥 FIX: Use triggerCleanBoardFlow (same entry as other clean board paths) so modal shows consistently
    // This ensures all wild magnet/beer/star endgame scenarios use the same flow with proper guards
    const triggerCleanBoardFlow = (window as any).CC?.triggerCleanBoardFlow;
    if (typeof triggerCleanBoardFlow === 'function') {
      await triggerCleanBoardFlow('clean_board_from_wild_magnet_no_pulled_tiles');
      console.log('✅ Clean board flow completed for magnet merge with no pulled tiles');
    } else {
      console.error('❌ triggerCleanBoardFlow not available - falling back to direct runEndgameFlow');
      // Fallback to old method if triggerCleanBoardFlow is not available
      const { runEndgameFlow } = await import('./endgame-flow.js');
      const app = STATE.app;
      const stage = STATE.stage;
      const board = STATE.board;
      const boardBG = STATE.boardBG;
      const level = STATE.level || 1;
      const startLevel = helpers?.startLevel || (window as any).startLevel || (window as any).CC?.startLevel;
      const boardNumber = STATE.boardNumber || 1;
      
      if (app && stage && board && startLevel) {
        await runEndgameFlow({
          app,
          stage,
          board,
          boardBG,
          level,
          startLevel,
          boardNumber,
          skipStarsWait: true
        });
      }
    }
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
  
  // Check if any pulled tile is a wild star
  for (const tile of validTiles) {
    if (!tile || tile.destroyed) continue;
    if (tile.special === 'wild' && (tile as any)?._wildStarSystem) {
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
  
  // 🔥 CRITICAL: Store pulled cells BEFORE removing tiles (for excluding from later spawns)
  validTiles.forEach((tile: any) => {
    if (!tile || tile.destroyed) return;
    if (Number.isFinite(tile.gridX) && Number.isFinite(tile.gridY)) {
      pulledCells.push({ c: tile.gridX | 0, r: tile.gridY | 0 });
    }
  });
  
  // 🔥 CRITICAL: Store pulled cells in dst tile so they can be excluded from normal spawn
  (dst as any)._wildMagnetPulledCells = pulledCells;
  
  // 🔥 CRITICAL: Stop all animations INCLUDING wild animations (wild-beer bubbles, wild stars, wild shimmer, wild idle)
  // This prevents animation conflicts when wild-beer tiles are pulled by magnet
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
      if (typeof stopWildBeerBubbles === 'function') stopWildBeerBubbles(tile); 
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
    
    // 🔥 CRITICAL FIX: Remove from board FIRST before removing from grid/STATE
    // This ensures tile is properly removed from visual hierarchy
    if (tile.parent && STATE.board) {
      try {
        if (tile.parent === STATE.board || STATE.board.children.includes(tile)) {
          STATE.board.removeChild(tile);
          console.log(`🧲 Removed tile ${index + 1} from board`);
        } else if (tile.parent.removeChild) {
          tile.parent.removeChild(tile);
          console.log(`🧲 Removed tile ${index + 1} from parent:`, tile.parent.constructor?.name);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to remove tile ${index + 1} from board:`, error);
      }
    }
    
    // Clear from grid
    if (tile.gridX !== undefined && tile.gridY !== undefined && STATE.grid && STATE.grid[tile.gridY]) {
      STATE.grid[tile.gridY][tile.gridX] = null;
      console.log(`🧲 Cleared grid[${tile.gridY}][${tile.gridX}] = null`);
    }
    
    // Remove from STATE.tiles
    const tileIndex = STATE.tiles.indexOf(tile);
    if (tileIndex >= 0) {
      STATE.tiles.splice(tileIndex, 1);
      console.log(`🧲 Removed tile from STATE.tiles at index ${tileIndex}`);
    }
    
    // 🔥 NOTE: app-core.ts uses `const tiles = STATE.tiles;` which is a reference, not a copy
    // This means removing from STATE.tiles automatically removes from app-core tiles array
    // No need to manually remove from app-core tiles array - STATE.tiles is the source of truth
    // End game checks use STATE.tiles via context.tiles, so cleanup is already handled
    
    // Hide tile before removal
    tile.visible = false;
    tile.alpha = 0; // 🔥 CRITICAL: Set alpha to 0 to ensure it's not visible
    
    // Clear _wildMagnetAffected flag BEFORE removeTile (to prevent interference)
    delete tile._wildMagnetAffected;
    delete tile._wildMagnetOriginalX;
    delete tile._wildMagnetOriginalY;
    
    // 🔥 CRITICAL: removeTile already calls destroy, so we don't need to call it again
    // removeTile handles: stopWildIdle, hover.clear, removeAllListeners, killTweens, removeChild, destroy
    removeTile(tile);
    
    console.log(`🧲 Tile ${index + 1} removed and marked destroyed`);
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
  // 🔥 PERFORMANCE FIX: Cache grid search to prevent repeated loops
  if (typeof dst.gridX !== 'number' || typeof dst.gridY !== 'number' || !Number.isFinite(dst.gridX) || !Number.isFinite(dst.gridY)) {
    // Try to find grid coordinates from STATE.grid (optimized search)
    let found = false;
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
    
    // 🔥 FIX: If not found in grid, calculate from pixel position
    if (!found) {
      // Formula: position = gridCoord * (TILE + GAP) + TILE / 2
      // Reverse: gridCoord = (position - TILE / 2) / (TILE + GAP)
      const tileSize = TILE + GAP; // 128 + 20 = 148
      const halfTile = TILE / 2;   // 64
      
      if (typeof dst.x === 'number' && typeof dst.y === 'number' && Number.isFinite(dst.x) && Number.isFinite(dst.y)) {
        const calculatedGridX = Math.round((dst.x - halfTile) / tileSize);
        const calculatedGridY = Math.round((dst.y - halfTile) / tileSize);
        
        // Validate calculated coordinates are within bounds
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
      // 🔥 FIX: Use center of board as ultimate fallback
      dst.gridX = Math.floor(COLS / 2);
      dst.gridY = Math.floor(ROWS / 2);
      console.warn('⚠️ Using center of board as fallback grid position:', dst.gridX, dst.gridY);
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
      
      console.log('🧲 Creating shards at calculated position:', shardX, shardY, 'grid:', dst.gridX, dst.gridY);
      
      // 🔥 CRITICAL FIX: Use dst tile directly (same as regular merge-6) instead of tileForShards object
      // This ensures centerInBoard works correctly and shards appear at the right position
      // Ensure dst position is set correctly before triggering shards
      if (dst.x !== shardX || dst.y !== shardY) {
        gsap.set(dst, { x: shardX, y: shardY });
        dst.targetX = shardX;
        dst.targetY = shardY;
      }
      
      // 🔥 CRITICAL: Use template-based pooling for magnet pull shards (optimized, pull-specific patterns)
      // This uses object pooling with pull-specific patterns for better variety and no overlap
      const mergePos = { x: shardX, y: shardY, gridX: dst.gridX, gridY: dst.gridY, zIndex: dst.zIndex || 9993 };
      wildMagnetMerge6ShardsTemplated(STATE.board, mergePos as any, { 
        zIndex: dst.zIndex || 9993,
        isPullAnimation: true  // 🔥 Use pull-specific patterns
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
    (window as any).CC.scheduleComboDecay();
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
  
  // 🔥 JOURNEY BOARDS: Track longest combo per board - use ACTUAL current combo value after magnet pull
  try {
    const boardNumber = STATE?.boardNumber || STATE?.level || 1;
    import('../services/board-stats-service.js').then(({ boardStatsService }) => {
      boardStatsService.updateBoardLongestCombo(boardNumber, currentComboAfterMagnet);
    }).catch(() => {
      // Ignore import errors
    });
  } catch {}
  
  // 🔥 USER REQUEST: Animate stars to HUD if magnet pulled wild star
  if (wildStarTileForAnimation && savedStarSystemEarly && savedStarPositionsEarly.length > 0) {
    console.log('⭐ MAGNET PULL: Animating stars to HUD from pulled wild star');
    
    // Get HUD star position
    let hudStarPos: { x: number; y: number } | null = null;
    try {
      if (typeof HUD.getStarHudPosition === 'function') {
        hudStarPos = HUD.getStarHudPosition();
      }
    } catch (e) {
      console.warn('⚠️ Failed to get HUD star position:', e);
    }
    
    if (!hudStarPos) {
      console.warn('⚠️ HUD star position not available, using fallback');
      hudStarPos = { x: 0, y: 0 };
    }
    
    // Get merge 6 position (dst tile position)
    let merge6Pos: { x: number; y: number };
    if (typeof dst.getGlobalPosition === 'function') {
      merge6Pos = dst.getGlobalPosition();
    } else {
      merge6Pos = { x: dst.x || 0, y: dst.y || 0 };
    }
    
    // Animate stars to HUD (same as normal wild star merge 6)
    requestAnimationFrame(() => {
      setTimeout(async () => {
        try {
          const { animateStarsToHudIcon } = await import('./fx.js');
          if (typeof animateStarsToHudIcon === 'function' && STATE.board && STATE.stage) {
            console.log('⭐ MAGNET PULL: Calling animateStarsToHudIcon with saved star data');
            // 🔥 CRITICAL FIX: Pass app to animateStarsToHudIcon so it can access renderer
            const appForAnimation = STATE.app || (STATE.stage as any)?.app;
            await animateStarsToHudIcon(
              STATE.board,
              STATE.stage,
              savedStarPositionsEarly,
              savedWildTileScreenPosEarly || { x: 0, y: 0 },
              merge6Pos,
              hudStarPos,
              appForAnimation
            );
            console.log('✅ MAGNET PULL: Stars animation to HUD completed');
          } else {
            console.warn('⚠️ animateStarsToHudIcon not available or STATE.board/stage missing');
          }
        } catch (error) {
          console.error('❌ MAGNET PULL: Failed to animate stars to HUD:', error);
        }
      }, 200); // Small delay to ensure tiles are removed
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
    // Only merge 6 remains - this means magnet pulled the last tiles from the board
    console.log('🚨🚨🚨 EDGE CASE: Only merge 6 remains after magnet pulled last 4 tiles - Triggering clean board flow immediately (no spawn)');
    
    // Remove merge 6
    if (dst && !dst.destroyed) {
      removeTile(dst);
    }
    
    // 🔥 FIX: Use triggerCleanBoardFlow (same entry as other clean board paths) so modal shows consistently
    const triggerCleanBoardFlow = (window as any).CC?.triggerCleanBoardFlow;
    if (typeof triggerCleanBoardFlow === 'function') {
      await triggerCleanBoardFlow('clean_board_from_wild_magnet_only_dst_remains');
    } else {
      console.error('❌ triggerCleanBoardFlow not available - falling back to direct runEndgameFlow');
      // Fallback to old method if triggerCleanBoardFlow is not available
      const { runEndgameFlow } = await import('./endgame-flow.js');
      const app = STATE.app;
      const stage = STATE.stage;
      const board = STATE.board;
      const boardBG = STATE.boardBG;
      const level = STATE.level || 1;
      const startLevel = helpers?.startLevel || (window as any).startLevel || (window as any).CC?.startLevel;
      const boardNumber = STATE.boardNumber || 1;
      
      if (app && stage && board && startLevel) {
        STATE.busyEnding = true;
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
            showGrid: () => { try { if (board) board.visible = true; } catch {} },
            skipStarsWait: true
          });
        } finally {
          STATE.busyEnding = false;
        }
      }
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
          trackTween(tile, {
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
      
      // 🔥 FIX: Use triggerCleanBoardFlow (same entry as other clean board paths) so modal shows consistently
      const triggerCleanBoardFlow = (window as any).CC?.triggerCleanBoardFlow;
      if (typeof triggerCleanBoardFlow === 'function') {
        await triggerCleanBoardFlow('clean_board_from_wild_magnet_few_tiles_remaining');
      } else {
        console.error('❌ triggerCleanBoardFlow not available - falling back to direct runEndgameFlow');
        // Fallback to old method if triggerCleanBoardFlow is not available
        const { runEndgameFlow } = await import('./endgame-flow.js');
        const app = STATE.app;
        const stage = STATE.stage;
        const board = STATE.board;
        const boardBG = STATE.boardBG;
        const level = STATE.level || 1;
        const startLevel = helpers?.startLevel || (window as any).startLevel || (window as any).CC?.startLevel;
        const boardNumber = STATE.boardNumber || 1;
        
        if (app && stage && board && startLevel) {
          STATE.busyEnding = true;
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
              showGrid: () => { try { if (board) board.visible = true; } catch {} },
              skipStarsWait: true
            });
          } finally {
            STATE.busyEnding = false;
          }
        }
      }
      return; // Don't spawn new tiles
  }

  // 🛡️ FAILSAFE: Ensure merge-6 tile does not linger after magnet pull sequence
  try {
    if (dst && !dst.destroyed && STATE.tiles.includes(dst)) {
      if (Number.isFinite(dst.gridX) && Number.isFinite(dst.gridY) && STATE.grid?.[dst.gridY]) {
        if (STATE.grid[dst.gridY][dst.gridX] === dst) {
          STATE.grid[dst.gridY][dst.gridX] = null;
        }
      }
      removeTile(dst);
      console.warn('🧲 FAILSAFE: Removed merge-6 tile after magnet pull merge to prevent stuck value 6');
    }
  } catch (err) {
    console.warn('⚠️ FAILSAFE: Unable to remove merge-6 tile after magnet pull merge:', err);
  }
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
        const isWildTile = !!(t && (t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer' || (t as any).isWild === true || (t as any).isWildFace === true));
        
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
  
  const isLastMergeFlagSet = (dst as any)?._isLastMerge === true;
  const activeAfterRemoval = STATE.tiles.filter(tileIsActive);
  const onlyDstRemains = activeAfterRemoval.length === 1 && activeAfterRemoval[0] === dst;
  const hasTilesToRespawn = pulledCells.length > 0;
  const merge6Coords = dst && Number.isFinite(dst.gridX) && Number.isFinite(dst.gridY)
    ? { c: dst.gridX | 0, r: dst.gridY | 0 }
    : null;

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

  // 🔥 CRITICAL FIX: NEVER call endgame check if we have tiles to respawn!
  // This was causing instant fail screen when magnet pulled tiles (e.g., magnet + 2 cubes)
  // because endgame check would see only merge 6 tile BEFORE new tiles spawned
  if (shouldSkipRespawnAndEndGame && !hasTilesToRespawn && triggerCentralEndgameCheck('mergePulledTilesBeforeRespawn')) {
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
  // 🔥 CRITICAL FIX: Spawn count = pulled tiles count (for replacement) + 1 (OBLIGATORY tile below merge 6)
  // When magnet pulls tiles, we need to:
  // 1. Spawn tiles to replace pulled tiles (pulledCells.length)
  // 2. Spawn ONE OBLIGATORY tile below merge 6 (to anchor it and provide merge target)
  // 3. Merge 6 tile should remain on board at magnet position (it's already there, don't spawn it)
  // 🔥 SOURCE OF TRUTH: If final merge-6 (_isLastMerge flag), NO spawns at all (trigger CLEAN BOARD)
  // 🎯 END GAME FIX: If this is last merge (magnet + 1 tile), NO spawns at all!
  // 🔥 CRITICAL: Check _isLastMerge flag FIRST - if set, skip ALL spawn logic and trigger clean board
  if (isLastMergeFlagSet) {
    console.log('🚨🚨🚨 SOURCE OF TRUTH: Final merge-6 detected (_isLastMerge flag set) - NO spawns, triggering CLEAN BOARD');
    console.log('🎯 This is the final merge (magnet + 1 tile = 2 tiles total) - should trigger clean board, NOT spawn tiles');
    
    // Remove merge 6 tile
    if (dst && !dst.destroyed) {
      removeTile(dst);
    }
    
    // 🔥 FIX: Use triggerCleanBoardFlow (same entry as other clean board paths) so modal shows consistently
    const triggerCleanBoardFlow = (window as any).CC?.triggerCleanBoardFlow;
    if (typeof triggerCleanBoardFlow === 'function') {
      await triggerCleanBoardFlow('clean_board_from_wild_magnet_final_merge6');
      console.log('✅ Clean board flow completed for magnet final merge-6');
    } else {
      console.error('❌ triggerCleanBoardFlow not available - falling back to direct runEndgameFlow');
      // Fallback to old method if triggerCleanBoardFlow is not available
      const { runEndgameFlow } = await import('./endgame-flow.js');
      const app = STATE.app;
      const stage = STATE.stage;
      const board = STATE.board;
      const boardBG = STATE.boardBG;
      const level = STATE.level || 1;
      const startLevel = helpers?.startLevel || (window as any).startLevel || (window as any).CC?.startLevel;
      const boardNumber = STATE.boardNumber || 1;
      
      if (app && stage && board && startLevel) {
        await runEndgameFlow({
          app,
          stage,
          board,
          boardBG,
          level,
          startLevel,
          boardNumber,
          skipStarsWait: true
        });
        console.log('✅ Clean board flow completed for magnet final merge-6');
      }
    }
    return; // 🔥 CRITICAL: Exit early - NO spawns for final merge-6!
  }
  
  const replacementSpawnCount = hasTilesToRespawn ? pulledCells.length : 0; // Spawn = number of pulled tiles (max 4)
  const obligatorySpawnCount = 1; // Always spawn 1 obligatory tile below merge 6 (unless final merge-6, which is handled above)
  const spawnCount = replacementSpawnCount + obligatorySpawnCount;
  
  console.log('🧲 Wild-magnet spawn calculation:', {
    pulledTilesCount: pulledCells.length,
    pulledTilesDetails: validTiles.map(t => ({ value: t.value, special: t.special })),
    replacementSpawnCount: replacementSpawnCount,
    obligatorySpawnCount: obligatorySpawnCount,
    totalSpawnCount: spawnCount,
    merge6StaysVisible: true, // Merge 6 should remain visible on board
    merge6Position: dst ? { gridX: dst.gridX, gridY: dst.gridY } : null,
    expectedTotalTiles: spawnCount + 1, // Spawned tiles + merge 6
    note: 'Spawn = pulled tiles count + 1 obligatory tile below merge 6. Merge 6 stays on board.'
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
  
  // 🔥 CRITICAL FIX: Find position for OBLIGATORY tile below merge 6
  // This tile should be positioned below merge 6 (or near center if merge 6 is at edge)
  let obligatoryCell: { c: number; r: number } | null = null;
  if (dst && !dst.destroyed) {
    const merge6GridX = dst.gridX | 0;
    const merge6GridY = dst.gridY | 0;
    
    // Try to find cell below merge 6 (r+1)
    const belowCell = { c: merge6GridX, r: merge6GridY + 1 };
    if (belowCell.r < ROWS) {
      const existingTile = STATE.grid?.[belowCell.r]?.[belowCell.c];
      const isEmpty = !existingTile || (existingTile.locked && (existingTile.value|0) === 0);
      if (isEmpty) {
        obligatoryCell = belowCell;
        console.log('✅ Found cell below merge 6 for obligatory spawn:', obligatoryCell);
      } else {
        console.warn('⚠️ Cell below merge 6 is occupied, finding alternative...');
        // Try nearby cells (below-left, below-right, or same column but different row)
        const alternatives = [
          { c: merge6GridX - 1, r: merge6GridY + 1 }, // Below-left
          { c: merge6GridX + 1, r: merge6GridY + 1 }, // Below-right
          { c: merge6GridX, r: merge6GridY + 2 },     // Two rows below
          { c: merge6GridX, r: merge6GridY - 1 },     // Above (if below is blocked)
        ];
        
        for (const alt of alternatives) {
          if (alt.r >= 0 && alt.r < ROWS && alt.c >= 0 && alt.c < COLS) {
            const altTile = STATE.grid?.[alt.r]?.[alt.c];
            const altIsEmpty = !altTile || (altTile.locked && (altTile.value|0) === 0);
            if (altIsEmpty) {
              obligatoryCell = alt;
              console.log('✅ Found alternative cell for obligatory spawn:', obligatoryCell);
              break;
            }
          }
        }
      }
    } else {
      // Merge 6 is at bottom row, try above or sides
      const alternatives = [
        { c: merge6GridX, r: merge6GridY - 1 }, // Above
        { c: merge6GridX - 1, r: merge6GridY }, // Left
        { c: merge6GridX + 1, r: merge6GridY }, // Right
      ];
      
      for (const alt of alternatives) {
        if (alt.r >= 0 && alt.r < ROWS && alt.c >= 0 && alt.c < COLS) {
          const altTile = STATE.grid?.[alt.r]?.[alt.c];
          const altIsEmpty = !altTile || (altTile.locked && (altTile.value|0) === 0);
          if (altIsEmpty) {
            obligatoryCell = alt;
            console.log('✅ Found alternative cell (merge 6 at bottom) for obligatory spawn:', obligatoryCell);
            break;
          }
        }
      }
    }
    
    // If still no cell found, use findRandomEmptyCells to find one near merge 6
    if (!obligatoryCell) {
      console.warn('⚠️ Could not find cell near merge 6, using random empty cell...');
      const nearCells = findRandomEmptyCells(1);
      if (nearCells.length > 0) {
        obligatoryCell = nearCells[0];
        console.log('✅ Using random cell for obligatory spawn:', obligatoryCell);
      }
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
  
  // Find replacement spawn targets (excluding obligatory cell and pulled cells)
  let replacementTargets = findRandomEmptyCells(replacementSpawnCount);
  // Filter out excluded cells
  replacementTargets = replacementTargets.filter(cell => {
    const key = `${cell.c},${cell.r}`;
    return !excludeCellsSet.has(key);
  });
  
  // Combine obligatory cell + replacement targets
  let spawnTargets: { c: number; r: number }[] = [];
  if (obligatoryCell) {
    spawnTargets.push(obligatoryCell);
  }
  spawnTargets.push(...replacementTargets.slice(0, replacementSpawnCount));

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
    const retryTargets = findRandomEmptyCells(spawnCount + 2);
    // Filter out excluded cells
    const filteredRetryTargets = retryTargets.filter(cell => {
      const key = `${cell.c},${cell.r}`;
      return !excludeCellsSet.has(key);
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
    
    // 🔥 CRITICAL FIX: Wait minimal time for merge-6 shards animation before spawning
    // Shards animation takes ~1.0s (ttl), but with fastFadeOut it's effectively ~0.5-0.6s
    // Wait only 50ms to ensure shards start but spawn happens very fast (standard for all merge-6 spawns)
    console.log('⏳ Waiting for merge-6 shards animation to complete before spawning...');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // 🔥 CRITICAL FIX: Spawn OBLIGATORY tile FIRST (priority)
    // Then spawn replacement tiles with cascading delays
    // Obligatory tile spawns immediately (0ms delay), replacement tiles cascade (30ms, 60ms, 90ms)
    // 🔥 CRITICAL: Use Promise-based approach to track successful spawns
    for (let index = 0; index < spawnTargets.length && successfulSpawns < spawnCount; index++) {
      const { c, r } = spawnTargets[index];
      const isObligatory = obligatoryCell && c === obligatoryCell.c && r === obligatoryCell.r;
      // Obligatory tile spawns first (0ms), replacement tiles cascade (30ms, 60ms, 90ms...)
      const delay = isObligatory ? 0 : (successfulObligatorySpawn ? (successfulSpawns * 30) : 30);
      const key = `${c},${r}`;
      const forcedValue = forcedSpawnValues.get(key);
      
      // Create promise that resolves when spawn completes
      const spawnPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => {
        try {
          // 🔥 CRITICAL FIX v40.6: Double-check cell is still empty before spawning (race condition protection)
          // Problem: Spawning on locked tiles with value > 0 or wild tiles causes "2 tiles on same position" bug
          // Solution: ALWAYS check if tile has value > 0 or is wild, regardless of locked status
          const existingTile = STATE.grid?.[r]?.[c];
          if (existingTile) {
            const isActive = (existingTile.value|0) > 0;
            const isWildTile = existingTile.special === 'wild' || existingTile.special === 'wild-magnet' || existingTile.special === 'wild-beer' || (existingTile as any).isWild === true || (existingTile as any).isWildFace === true;
            
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
            openAtCell(c, r, forcedValue ? { skipBind: false, value: forcedValue } : { skipBind: false }).then(() => {
              // Check if spawn was successful by verifying tile exists and has value > 0
            setTimeout(() => {
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
    
    if (successfulSpawns < spawnCount && spawnCount > 0) {
      console.warn(`⚠️ Only ${successfulSpawns}/${spawnCount} tiles spawned successfully, attempting to spawn remaining tiles...`);
      
      // 🔥 USER REQUEST: When spawning additional tiles, ensure they are mergeable
      // Try to find additional empty cells for remaining spawns
      const remainingCount = spawnCount - successfulSpawns;
      const additionalTargets = findRandomEmptyCells(remainingCount);
      
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
          await openAtCell(c, r, { skipBind: false, value: forcedValue });
          setTimeout(() => {
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
  } else if (spawnCount > 0) {
    console.warn('⚠️ No spawn targets found!', {
      spawnCountRequested: spawnCount,
      spawnTargetsFound: spawnTargets.length,
      pulledCellsCount: pulledCells.length,
      hasTilesToRespawn,
      note: 'Wild-magnet merge did not spawn any new tiles - board might be full or spawn logic issue!'
    });
  }

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
  
  console.log('🧲 Respawn complete - letting pulled tiles merge with merge 6 before endgame check');
  
  // 🔥 USER BUG FIX: Wait LONGER for spawn animations to complete before checking endgame
  // Problem: User had 5 tiles spawn after magnet, started merging 3+3, got fail screen
  // Root cause: Spawn animations and tile bindings weren't complete when user tried to merge
  // Spawn bounce animation with timeScale 2.0 takes ~0.24s (240ms) per tile
  // With cascading delays (0ms, 30ms, 60ms, 90ms, 120ms for 5 tiles), last tile finishes at ~450ms
  // Plus unlock/bind/eventMode setup takes ~100ms per tile, so last tile is fully ready at ~550ms
  // Plus safety margin for user to see tiles: Total safe delay: 1200ms (increased from 800ms)
  // This ensures ALL spawn animations, unlocks, and bindings are complete before endgame check
  console.log('⏳ Waiting 1200ms for spawn animations to complete before endgame check (increased from 800ms for better safety)...');
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  // 🔥 CRITICAL: Check if ALL tiles can be merged together (simulate all possible merges)
  // If all tiles can be merged and the final merge is merge 6, trigger clean board flow
  const canAllMerge = await checkIfAllTilesCanMerge(STATE.tiles, helpers);
  if (canAllMerge) {
    console.log('🚨🚨🚨 All tiles can be merged together - will trigger clean board flow after final merge 6');
    // Note: Clean board flow will be triggered automatically when the final merge 6 occurs
    // This is handled in the merge function when board becomes clean
  }
  
  // 🔥 USER BUG FIX: Before calling checkLevelEnd, verify that spawn animations AND tile bindings are complete
  // Check if there are any locked tiles that are still animating (spawn in progress)
  // Also check if tiles have eventMode='static' (are interactive)
  const lockedActiveTiles = STATE.tiles.filter((t: any) => {
    if (!t || t.destroyed) return false;
    if (!t.locked) return false; // Only check locked tiles
    return (t.value|0) > 0 || t.special === 'wild' || t.special === 'wild-magnet';
  });
  
  // 🔥 USER BUG FIX: Also check for tiles that are still being spawned or not yet interactive
  const tilesStillSpawning = STATE.tiles.filter((t: any) => {
    if (!t || t.destroyed) return false;
    if (t.locked) return true; // Locked tiles are still spawning
    // Check if tile is still being spawned (animation in progress)
    if (t._isBeingSpawned === true) return true;
    // Check if tile doesn't have eventMode='static' yet (not interactive) - critical for user merges
    if (t.eventMode !== 'static' && (t.value|0) > 0) {
      const isWildTile = t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer';
      // Only consider it as "still spawning" if it's a regular tile without eventMode
      if (!isWildTile) return true;
    }
    return false;
  });
  
  // Count active tiles to verify spawn completed
  const activeTilesAfterSpawn = STATE.tiles.filter(tileIsActive);
  const actualTileCount = activeTilesAfterSpawn.length;
  // 🔥 FIX: Don't use expectedTileCount = spawnCount + 1, as there may be other active tiles on board
  // Instead, just verify that actualTileCount >= spawnCount (at minimum, we should have spawned tiles)
  const minExpectedTileCount = spawnCount; // At minimum, we should have spawnCount new tiles
  
  console.log('🧲 Spawn verification (enhanced):', {
    lockedTilesStillAnimating: lockedActiveTiles.length,
    tilesStillSpawning: tilesStillSpawning.length,
    minExpectedTileCount: minExpectedTileCount,
    actualTileCount: actualTileCount,
    spawnCount: spawnCount,
    merge6ShouldBeVisible: true,
    activeTiles: activeTilesAfterSpawn.map((t: any) => ({ 
      value: t.value, 
      special: t.special,
      eventMode: t.eventMode,
      locked: t.locked
    }))
  });
  
  // Wait if ANY tiles are still locked or spawning
  if (lockedActiveTiles.length > 0 || tilesStillSpawning.length > 0) {
    console.log('⏳ Delaying endgame check - spawn animations/bindings still in progress:', {
      lockedCount: lockedActiveTiles.length,
      stillSpawningCount: tilesStillSpawning.length,
      lockedTiles: lockedActiveTiles.map((t: any) => ({ value: t.value, special: t.special })),
      spawningTiles: tilesStillSpawning.map((t: any) => ({ 
        value: t.value, 
        special: t.special,
        eventMode: t.eventMode,
        isBeingSpawned: t._isBeingSpawned
      }))
    });
    // Wait additional 600ms (increased from 500ms) for spawn animations and bindings to complete
    await new Promise(resolve => setTimeout(resolve, 600));
  }
  
  // 🔥 FIX: Only warn if we have ZERO active tiles after spawn (critical error)
  // Having fewer tiles than spawnCount is not necessarily an error - other tiles may have been merged
  if (actualTileCount === 0 && spawnCount > 0) {
    console.error('🚨🚨🚨 CRITICAL: No active tiles after spawn!', {
      minExpected: minExpectedTileCount,
      actual: actualTileCount,
      spawnCount: spawnCount,
      note: 'No tiles were spawned - this will cause incorrect endgame check!'
    });
    // Wait additional time and re-check
    await new Promise(resolve => setTimeout(resolve, 500));
    const recheckActiveTiles = STATE.tiles.filter(tileIsActive);
    console.log('🧲 Re-check after additional wait:', {
      minExpected: minExpectedTileCount,
      actual: recheckActiveTiles.length,
      tiles: recheckActiveTiles.map((t: any) => ({ value: t.value, special: t.special }))
    });
  } else if (actualTileCount < minExpectedTileCount && spawnCount > 0) {
    // Just a warning, not critical - other tiles may have been removed during merge animations
    console.warn('⚠️ Spawn verification: Fewer tiles than spawned', {
      minExpected: minExpectedTileCount,
      actual: actualTileCount,
      spawnCount: spawnCount,
      note: 'Some spawned tiles may have been merged already - this is usually OK'
    });
  }
  
  // 🔥 CRITICAL FIX: Check if bubbles animation is still running (from wild-beer merge)
  // Bubbles animation can run for 4+ seconds and shouldn't block endgame detection
  // BUT: We should ensure spawn animations are complete before checking endgame
  try {
    const { isWildBeerExplosionRunning } = await import('./fx.js');
    if (typeof isWildBeerExplosionRunning === 'function' && isWildBeerExplosionRunning()) {
      console.log('💧 Bubbles animation is running, but spawn animations are complete - proceeding with endgame check');
      // Bubbles animation is visual only and doesn't block endgame detection
    }
  } catch (err) {
    console.warn('⚠️ Failed to check bubbles animation status:', err);
  }
  
  // 🔥 CRITICAL FIX: Clear all magnet flags from merge 6 tile AFTER spawning
  // This ensures the merge 6 tile can be merged normally with other tiles in the next merge
  // BUT: DO NOT delete _wildMagnetPulledTilesMerge and _wildMagnetMergeCallback - they're needed in onComplete callback!
  // They will be cleaned up in app-core.ts onComplete callback after merge 6 tile removal check
  if (dst && !dst.destroyed) {
    delete (dst as any)._wildMagnetAffected;
    delete (dst as any)._wildMagnetOriginalX;
    delete (dst as any)._wildMagnetOriginalY;
    delete (dst as any)._wildMagnetPulledTilesScoring;
    delete (dst as any)._hasTilesToPull;
    delete (dst as any)._isWildMagnetMerge;
    // 🔥 CRITICAL: Keep _wildMagnetPulledTilesMerge and _wildMagnetMergeCallback until onComplete callback checks them!
    console.log('🧲 Cleared some magnet flags from merge 6 tile after spawning (kept _wildMagnetPulledTilesMerge and _wildMagnetMergeCallback for onComplete check)');
  }
  
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
    const activeTilesCheck = STATE.tiles.filter(tileIsActive);
    const lockedActiveTilesCheck = activeTilesCheck.filter((t: any) => t.locked && (t.value|0) > 0);
    
    if (lockedActiveTilesCheck.length === 0) {
      allTilesUnlocked = true;
      console.log('✅ All spawned tiles are now unlocked');
    } else {
      retryCount++;
      console.log(`⏳ Waiting for ${lockedActiveTilesCheck.length} tiles to unlock (retry ${retryCount}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  if (!allTilesUnlocked) {
    console.warn('⚠️ Some tiles are still locked after max wait time, proceeding with check anyway');
  }
  
  const activeTilesFinal = STATE.tiles.filter(tileIsActive);
  const hasMergeableTiles = activeTilesFinal.length > 1; // More than just merge 6 = can merge
  
  // Check if board is clean (only merge 6 remains, no other active tiles)
  // 🔥 CRITICAL: Must have EXACTLY 1 active tile and it must be merge 6
  const isBoardClean = activeTilesFinal.length === 1 && activeTilesFinal[0]?.value === 6;
  
  // 🔥 ADDITIONAL CHECK: Verify that all spawned tiles are actually unlocked and active
  // After waiting, all tiles should be unlocked, but double-check anyway
  const unlockedActiveTiles = activeTilesFinal.filter((t: any) => !t.locked);
  const hasUnlockedTiles = unlockedActiveTiles.length > 1; // More than just merge 6 = can merge
  
  // 🔥 CRITICAL FIX: If we spawned new tiles, this is NOT last merge (even if _isLastMerge flag was set)
  // The flag was set BEFORE pulled tiles merged, but now we have new tiles, so it's not last merge anymore
  const hasSpawnedNewTiles = spawnCount > 0 && activeTilesFinal.length > 1;
  const isActuallyLastMerge = isLastMergeFlagSet && !hasSpawnedNewTiles;
  
  // 🔥 USER REQUEST v85: Check if unlocked tiles have potential for merge/stack
  // If anyMergePossible returns true → game continues (don't call checkLevelEnd)
  // If anyMergePossible returns false → call checkLevelEnd (will check stuck and show fail screen)
  // 🔥 CRITICAL: Use ALL active tiles (not just unlocked) for anyMergePossible check
  // This ensures we check ALL spawned tiles, even if some are still locked (shouldn't happen after wait)
  // This fixes the bug where clean board was triggered immediately after magnet pull spawns new tiles
  const { makeBoard } = helpers;
  let hasMergeOrStackPotential = false;
  if (activeTilesFinal.length > 0 && makeBoard?.anyMergePossible) {
    // 🔥 CRITICAL: Check with ALL active tiles (including merge 6) to see if there's merge potential
    // This ensures we see ALL spawned tiles, not just unlocked ones
    hasMergeOrStackPotential = makeBoard.anyMergePossible(activeTilesFinal);
    console.log('🧲 anyMergePossible check with ALL active tiles (after unlock wait):', {
      activeTilesCount: activeTilesFinal.length,
      unlockedTilesCount: unlockedActiveTiles.length,
      hasMergeOrStackPotential,
      tiles: activeTilesFinal.map((t: any) => ({ value: t.value, special: t.special, locked: t.locked }))
    });
  }
  
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
  if (hasMergeOrStackPotential) {
    // Spawned tiles have potential for merge/stack → game continues
    if (isLastMergeFlagSet && hasSpawnedNewTiles) {
      console.log('🧲 _isLastMerge flag was set, but new tiles with merge potential were spawned - this is NOT last merge anymore, clearing flag');
      // Clear the flag since new tiles with merge potential were spawned
      (dst as any)._isLastMerge = false;
    }
    console.log('✅ Spawned tiles have merge/stack potential - game continues, NOT calling checkLevelEnd');
    return; // Don't call checkLevelEnd - let player merge/stack tiles
  }
  
  // No merge/stack potential - check if board is clean or if we should show fail screen
  // 🔥 BUG FIX 1: Check isBoardClean independently - if board is clean and no merge potential, trigger clean board flow
  // This handles the case where isBoardClean is true but isActuallyLastMerge is false (due to spawnCount > 0)
  if (isBoardClean && !hasUnlockedTiles) {
    console.log('🧲 Board is clean (only merge 6, no other tiles) and no merge potential - calling checkLevelEnd to trigger clean board flow');
    if (typeof (window as any).CC?.checkLevelEnd === 'function') {
      (window as any).CC.checkLevelEnd();
    }
    return; // Exit early after triggering clean board flow
  }
  
  // 🔥 BUG FIX 2: Check if we have no merge potential and either:
  // - We have unlocked tiles (normal stuck case), OR
  // - We have locked tiles but no merge potential (all tiles locked after spawn, stuck state)
  // In both cases, we should call checkLevelEnd to check stuck and show fail screen
  // 🔥 CRITICAL FIX: Also check for single tile that can't merge (e.g., after player merges spawned tiles)
  if (!hasMergeOrStackPotential) {
    // No merge/stack potential - check if we have any active tiles (locked or unlocked)
    const hasAnyActiveTiles = activeTilesFinal.length > 0;
    
    if (unlockedActiveTiles.length > 0) {
      // No merge/stack potential but we have unlocked tiles → call checkLevelEnd to check stuck and show fail screen
      console.log('🚨 No merge/stack potential with unlocked tiles - calling checkLevelEnd to check stuck and show fail screen');
      if (typeof (window as any).CC?.checkLevelEnd === 'function') {
        (window as any).CC.checkLevelEnd();
      }
      return; // Exit early after triggering fail screen check
    } else if (hasAnyActiveTiles && activeTilesFinal.length >= 1) {
      // 🔥 CRITICAL FIX: Changed from > 1 to >= 1 to catch single tile stuck state
      // No merge/stack potential, all tiles are locked OR only 1 tile remains → stuck state
      // This handles Bug 2: all tiles remain locked after spawn, no merge potential
      // AND Bug: after player merges spawned tiles (1+1=2), only 1 tile remains that can't merge
      console.log('🚨 No merge/stack potential, tiles are locked OR only 1 tile remains - calling checkLevelEnd to check stuck and show fail screen');
      if (typeof (window as any).CC?.checkLevelEnd === 'function') {
        (window as any).CC.checkLevelEnd();
      }
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
}

export async function handleWildMagnetMergedPulledTiles(dst: any, pulledTiles: any[], helpers: any): Promise<boolean> {
  console.log('🧲 handleWildMagnetMergedPulledTiles called with', pulledTiles?.length || 0, 'tiles');
  
  // Filter valid tiles
  const validTiles = (pulledTiles || []).filter((t: any) => t && !t.destroyed);
  
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
