// src/modules/app-merge.js
import { gsap } from 'gsap';
import { STATE, ENDLESS, REFILL_ON_SIX_BY_DEPTH } from './app-state.js';
import * as makeBoard from './board.js';
import { glassCrackAtTile, woodShardsAtTile, innerFlashAtTile, showMultiplierTile, screenShake, wildImpactEffect } from './fx.js';
import * as HUD from './hud-helpers.js';
import { openAtCell, openEmpties, spawnBounce } from './app-spawn.js';
import { showStarsModal } from './stars-modal.js';
import { rebuildBoard } from './app-board.js';

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
  const effSum = wildActive ? 6 : sum;

  STATE.grid[src.gridY][src.gridX] = null;
  dst.eventMode = 'none';

  // ---- 2..5: commit, score immediately, NO REFILL; fill wild meter
  if (effSum < 6){
    makeBoard.setValue(dst, effSum, srcDepth);
    STATE.score += effSum; updateHUD();

    // meter + little bounce on score
    const inc = 0.25; // 4 small merges to full
    STATE.wildMeter = Math.min(1, (STATE.wildMeter || 0) + inc);
    updateProgressBar({ ratio: STATE.wildMeter, animate: true });

    gsap.to(src, {
      x: dst.x, y: dst.y, duration: 0.10, ease: 'power2.out',
      onComplete: async () => {
        removeTile(src);
        dst.eventMode = 'static';
        // Use enhanced wild impact effect if wild cube is involved
        if (wildActive) {
          wildImpactEffect(dst);
        } else {
          landBounce(dst);
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
    makeBoard.setValue(dst, 6, 0);
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
        const willClean = STATE.tiles.every(t => (t === dst) || t.locked || t.value <= 0);

        if (!willClean) {
          await landPreBounce(dst);
          glassCrackAtTile(STATE.board, dst, 120 * 0.46);
          innerFlashAtTile(STATE.board, dst, 120);
          woodShardsAtTile(STATE.board, dst, true);
          showMultiplierTile(STATE.board, dst, mult, 120, 1.0);
          
          // WILD EXPLOSION: slightly stronger (≈+20%) but gentle, erratic left-right bias
          if (wildActive) {
            console.log('💥 WILD EXPLOSION: Triggering enhanced effects');
            
            // Enhanced glass crack for wild
            glassCrackAtTile(STATE.board, dst, 120 * 0.8);
            
            // Enhanced inner flash for wild
            innerFlashAtTile(STATE.board, dst, 180);
            
            // Enhanced wood shards for wild
            woodShardsAtTile(STATE.board, dst, true);
            
            // Enhanced multiplier tile for wild
            showMultiplierTile(STATE.board, dst, mult, 140, 1.2);
            
            try {
              const base = Math.min(25, 12 + Math.max(1, mult) * 3);
              screenShake(STATE.app, {
                strength: base * 1.2,
                duration: 0.45,
                steps: 18,
                ease: 'power2.out',
                direction: 0,   // erratic per-step
                yScale: 0.55,   // more left-right, less vertical
                scale: 0.03,    // subtle global zoom
              });
            } catch {}
          
            // Additional smoke bubbles for wild explosion
            smokeBubblesAtTile(STATE.board, dst, 120, 1.5);
            
          } else {
            // Normal merge 6 effects
            try { screenShake(STATE.app, { strength: Math.min(25, 12 + Math.max(1, mult) * 3), duration: 0.4 }); } catch {}
          }
        }

        const gx = dst.gridX, gy = dst.gridY;
        STATE.grid[gy][gx] = null;
        dst.visible = false;
        removeTile(dst);

        const holder = makeBoard.createTile({ board: STATE.board, grid: STATE.grid, tiles: STATE.tiles, c: gx, r: gy, val: 0, locked: true });
        holder.alpha = 0.35; holder.eventMode = 'none';
        drawBoardBG();

        STATE.moves++; updateHUD();
        animateScore(STATE.score + 6 * mult, 0.45);

        // reset meter with quick blink
        STATE.wildMeter = 0; updateProgressBar({ ratio: 0, animate: true });

        const depth = Math.min(4, combined);
        const toOpen = REFILL_ON_SIX_BY_DEPTH[depth-1] || 2; // default 2

        if (!STATE.wildGuaranteedOnce){
          await openAtCell(gx, gy, { isWild:true });
          STATE.wildGuaranteedOnce = true;
          const rest = Math.max(0, toOpen - 1);
          if (rest > 0) await openEmpties(rest);
        } else {
          await openEmpties(toOpen);
        }

        if (STATE.tiles.every(t => t.locked || t.value <= 0)){
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

export function checkGameOver(){
  if (makeBoard.anyMergePossible(STATE.tiles)) return;
  
  // CRITICAL FIX: Check for wild cube merges before game over
  const active = STATE.tiles.filter(t => t && !t.locked && t.value > 0);
  const hasWildMerge = () => {
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        // Wild cube can merge with any non-wild tile
        if ((a.special === 'wild' && b.special !== 'wild') || 
            (b.special === 'wild' && a.special !== 'wild')) {
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

  if (active.length === 2){
    const add = (active[0].value|0) + (active[1].value|0);
    if (add > 0){ STATE.score += add; updateHUD(); }
  }

  if (STATE.score > STATE.bestScore){
    STATE.bestScore = STATE.score;
    try { localStorage.setItem('cc_best_score_v1', STATE.bestScore); } catch {}
    updateHUD();
  }

  showStarsModal({ app: STATE.app, stage: STATE.stage, board: STATE.board, score: STATE.score, thresholds:{one:Infinity,two:Infinity,three:Infinity}, buttonLabel:'Retry' })
    .then(async ()=>{
      STATE.score=0; STATE.moves=0; updateHUD();
      rebuildBoard();                  // ✅ no more fake dynamic imports
      setTimeout(checkGameOver, 1000);
    });
}
