// src/modules/app-merge.js
import { gsap } from 'gsap';
import { STATE, ENDLESS, REFILL_ON_SIX_BY_DEPTH } from './app-state.js';
import * as makeBoard from './board.js';
import { glassCrackAtTile, woodShardsAtTile, innerFlashAtTile, showMultiplierTile, screenShake, wildImpactEffect, smokeBubblesAtTile, stopWildIdle } from './fx.js';
import { COLS, ROWS, TILE, GAP } from './constants.js';
import * as HUD from './hud-helpers.js';
import { openAtCell, openEmpties, spawnBounce } from './app-spawn.js';
import { showStarsModal } from './stars-modal.js';
import { showBoardFailModal } from './board-fail-modal.js';
import { rebuildBoard } from './app-board.js';
import { drawBoardBG } from './app.js';

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
  tile.special = null;
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

export function merge(src, dst, helpers){
  if (STATE.busyEnding) { helpers.snapBack?.(src); return; }
  if (src === dst) { helpers.snapBack(src); return; }

  const sum      = src.value + dst.value;
  const srcDepth = src.stackDepth || 1;
  const dstDepth = dst.stackDepth || 1;

  const srcGX = src.gridX, srcGY = src.gridY;
  const wildActive = (src.special === 'wild' || dst.special === 'wild');
  const wildTargetValue = wildActive ? ((src.special === 'wild') ? (dst.value|0) : (src.value|0)) : null;
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
          smokeBubblesAtTile(STATE.board, dst, 140, 5.0);
          
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
    const combined = Math.min(4, srcDepth + dstDepth);
    const avoidValue = Number.isFinite(wildTargetValue) ? wildTargetValue : null;
    dst._wildMergeTarget = avoidValue;
    makeBoard.setValue(dst, 6, 0);
    if (wildActive) clearWildState(dst);
    dst.stackDepth = combined;
    makeBoard.drawStack(dst);
    dst.zIndex = 10000;
    const mult = combined >= 3 ? 3 : combined;
    // Centralized HUD combo balloon for merge 6
    try { HUD.bumpCombo?.({ kind: 'merge6' }); } catch {}

    gsap.to(src, {
      x: dst.x, y: dst.y, duration: 0.10, ease: 'power2.out',
      onComplete: async () => {
        removeTile(src);
        // CRITICAL FIX: Check for wild cubes properly
        const allTiles = STATE.tiles.filter(t => t && !t.locked);
        const wildCubes = allTiles.filter(t => t.special === 'wild');
        const nonWildTiles = allTiles.filter(t => t.special !== 'wild');
        const willClean = wildCubes.length === 0 && nonWildTiles.length <= 1;
        
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
            smokeBubblesAtTile(STATE.board, dst, 140, 9.0);
            
          } else {
            // Normal merge 6 effects
            const softSmokeStrength = 0.6 + Math.random() * 0.3;
            smokeBubblesAtTile(STATE.board, dst, {
              tileSize: TILE,
              strength: softSmokeStrength,
              behind: true,
              sizeScale: 1.16,
              distanceScale: 0.75,
              countScale: 0.8,
              haloScale: 1.15,
              ttl: 1.0
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

        STATE.moves++; updateHUD();
        animateScore(STATE.score + 6 * mult, 0.45);
        
        // Track cubes cracked for stats (count merge-6 events)
        if (typeof window.trackCubesCracked === 'function') {
          window.trackCubesCracked(1);
        }
        
        // Track wild cube usage as helper (any wild involvement)
        if (typeof window.trackHelpersUsed === 'function' && wildActive) {
          window.trackHelpersUsed(1);
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
          // Track boards cleared in alt merge flow
          try { if (typeof window.trackBoardsCleared === 'function') window.trackBoardsCleared(1); } catch {}
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
  const wildCubes = activeTiles.filter(t => t.special === 'wild');
  const nonWildTiles = activeTiles.filter(t => t.special !== 'wild');
  
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
  
  // CRITICAL FIX: Check for wild cube merges before game over
  const active = STATE.tiles.filter(t => t && !t.locked && t.value > 0);
  const activeWildCubes = active.filter(t => t.special === 'wild');
  const activeNonWildTiles = active.filter(t => t.special !== 'wild');

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
        if ((a.special === 'wild' && b.special !== 'wild') || 
            (b.special === 'wild' && a.special !== 'wild')) {
          console.log('🎯 Wild merge found:', a.special === 'wild' ? 'wild' : a.value, 'with', b.special === 'wild' ? 'wild' : b.value);
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
