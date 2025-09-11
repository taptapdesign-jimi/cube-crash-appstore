// src/modules/app-merge.js
import { gsap } from 'gsap';
import { STATE, ENDLESS, REFILL_ON_SIX_BY_DEPTH } from './app-state.js';
import * as makeBoard from './board.js';
import { glassCrackAtTile, woodShardsAtTile, innerFlashAtTile, showMultiplierTile, screenShake } from './fx.js';
// HUD functions are now in hud-helpers.js
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
      onComplete: () => {
        removeTile(src);
        dst.eventMode = 'static';
        landBounce(dst);
        STATE.moves++; updateHUD();
        // no spawn here
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
          
          // WILD EXPLOSION: Much stronger effects for wild merge
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
            
            // MUCH STRONGER wild screen shake - elastic and longer
            const randomForce = 50 + Math.random() * 30; // 50-80 strength (much stronger)
            const randomDuration = 1.2 + Math.random() * 0.8; // 1.2-2.0 duration (much longer)
            const randomDirection = Math.random() * Math.PI * 2; // Random direction
            
            try { 
              screenShake(STATE.app, { 
                strength: randomForce, 
                duration: randomDuration,
                direction: randomDirection,
                steps: 25, // More steps for smoother shake
                ease: 'elastic.out(1, 0.3)' // Elastic ease for wild shake
              }); 
              console.log('💥 WILD SHAKE: Force:', randomForce, 'Duration:', randomDuration, 'Direction:', randomDirection);
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

  const active = STATE.tiles.filter(t => !t.locked && t.value > 0);
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
