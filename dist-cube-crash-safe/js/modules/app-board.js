// src/modules/app-board.js
import { gsap } from 'gsap';
import { STATE, COLS, ROWS, TILE, GAP } from './app-state.js';
import * as makeBoard from './board.js';
// drawBoardBG and layout functions are now in app.js

// reset container while preserving boardBG
export function resetBoardContainer(){
  const { board, boardBG } = STATE;
  board.removeChildren();
  board.addChildAt(boardBG, 0);
  boardBG.zIndex = -1000;
  boardBG.eventMode = 'none';
  board.sortableChildren = true;
  board.sortChildren();
}

export function rebuildBoard(){
  resetBoardContainer();

  // destroy previous tiles
  STATE.tiles.forEach(t => t.destroy?.({ children:true, texture:false, textureSource:false }));
  STATE.tiles.length = 0;

  // new empty grid
  STATE.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  drawBoardBG('none');

  // create locked holders
  for (let r = 0; r < ROWS; r++){
    for (let c = 0; c < COLS; c++){
      makeBoard.createTile({ board: STATE.board, grid: STATE.grid, tiles: STATE.tiles, c, r, val: 0, locked: true });
      const t = STATE.grid[r][c];
      try { if (t?.hover){ t.hover.x = TILE/2; t.hover.y = TILE/2; } } catch {}
    }
  }

  // open ~40% as active tiles with values and bind drag
  const total = COLS * ROWS;
  const openN = Math.max(1, Math.round(total * 0.40));
  const ids = [...Array(total).keys()];
  // shuffle
  for (let i = ids.length - 1; i > 0; i--){ const j = (Math.random() * (i + 1)) | 0; [ids[i], ids[j]] = [ids[j], ids[i]]; }

  ids.slice(0, openN).forEach(idx => {
    const r = (idx / COLS) | 0, c = idx % COLS;
    const t = STATE.grid[r][c];
    t.locked = false;
    t.eventMode = 'static';
    t.cursor = 'pointer';
    if (STATE.drag?.bindToTile) STATE.drag.bindToTile(t); // ✅ enable drag/drop
    makeBoard.setValue(t, randVal(), 0);
    t.visible = false;    // will appear via deal-in animation
    t.comboCount = 1;
  });

  // layout before anim
  layout();

  // Animation is now handled in app.js
  // sweetPopIn is called from there
}

export function isBoardClean(){ return STATE.tiles.every(t => t.locked || t.value <= 0); }

function randVal(){ return [1,1,1,2,2,3,3,4,5][(Math.random()*9)|0]; }

// Fun bouncy animation with smart optimization
export function sweetPopIn(listTiles, opts = {}){
  const list = [...listTiles];

  // FULL random order — no spatial pattern
  for (let i = list.length - 1; i > 0; i--){ 
    const j = (Math.random() * (i + 1)) | 0; 
    [list[i], list[j]] = [list[j], list[i]]; 
  }

  // Tunables: jednako brzi kao "druga polovica" — sve brzo + divlji jitter
  const stepMin = 0.020, stepMax = 0.030;         // 20–30ms per index (brže)
  const jitterMax = 0.18;                         // do 180ms dodatnog jittera (wilder)
  const total = list.length || 1;
  const halfTotal = Math.ceil(total / 2); // 50% of tiles
  let halfFired = false;
  let maxEndTime = 0; // track latest finishing time of any tile

  // Return a promise that resolves when all tiles are done
  return new Promise(resolve => {
    let completed = 0;

    list.forEach((t, i) => {
      // Start hidden
      t.visible = true;
      t.scale.set(0);
      t.zIndex = 100;
      
      // alpha by lock state
      if (t.locked) {
        t.alpha = (t.value > 0) ? 0 : 0.25;
      } else {
        t.alpha = 0;
      }

      const p = i / Math.max(1, total - 1); // progress 0..1 po random listi
      const step = stepMin + Math.random() * (stepMax - stepMin);
      // Stalno BRZO: koristimo fast rate iz “druge polovice” za sve
      const rate = 0.55; // isto kao kasni dio prijašnje verzije
      // Povremeni “burst” – dio kockica krene ranije
      const burst = (Math.random() < 0.22) ? (-Math.random() * 0.16) : 0; // do -160ms
      const enterDel = Math.max(0, (i * step * rate) + Math.random() * jitterMax + burst);

      // Trajanja uvijek brza, s blagom varijacijom
      const durMul = 0.55 + Math.random() * 0.20; // 0.55–0.75
      const amp = 1.08 + Math.random() * 0.07;     // 1.08–1.15
      const d1b = 0.18 + Math.random() * 0.08;
      const d2b = 0.12 + Math.random() * 0.05;
      const d3b = 0.10 + Math.random() * 0.06;
      const d1  = Math.max(0.10, d1b * durMul); // blow
      const d2  = Math.max(0.08, d2b * durMul); // compress
      const d3  = Math.max(0.08, d3b * durMul); // settle

      gsap.timeline({
        delay: enterDel,
        onComplete: () => {
          t.zIndex = 10;
          completed++;
          // Halfway callback
          if (!halfFired && completed >= halfTotal){ halfFired = true; try { opts.onHalf?.(); } catch {} }
          
          if (completed === total){
            gsap.delayedCall(0.03, () => { try { drawBoardBG(); } catch {}; resolve(); });
          }
        }
      })
      .to(t, { 
        alpha: t.locked ? (t.value > 0 ? 0 : 0.25) : 1,
        duration: Math.max(0.12, d1 * 0.68),
        ease: 'power2.out'
      }, 0)
      .to(t.scale, { 
        x: amp,
        y: amp, 
        duration: d1,
        ease: 'back.out(2.0)'
      }, 0)
      .to(t.scale, { 
        x: 0.88,
        y: 0.88, 
        duration: d2,
        ease: 'power2.out'
      }, d1)
      .to(t.scale, { 
        x: 1.0,
        y: 1.0, 
        duration: d3,
        ease: 'back.out(1.5)'
      }, d1 + d2);

      // Accumulate latest finishing time for time-based halfway trigger
      const endAt = enterDel + d1 + d2 + d3;
      if (endAt > maxEndTime) maxEndTime = endAt;
    });

    console.log('🎯 Starting pure random stagger pop-in — all fast like late-half', { stepMin, stepMax, jitterMax });

    // Fire onHalf at 50% of overall animation timeframe as well (not only by completion)
    if (typeof opts.onHalf === 'function'){
      const fireAt = Math.max(0.01, maxEndTime * 0.5);
      gsap.delayedCall(fireAt, () => { if (!halfFired){ halfFired = true; try { opts.onHalf(); } catch {} } });
    }
  });
}

// Classic ring "deal-in" animation
function dealFromRim(listTiles){
  return new Promise(resolve=>{
    const size = { w: COLS*TILE + (COLS-1)*GAP, h: ROWS*TILE + (ROWS-1)*GAP };
    const center = { x: size.w/2, y: size.h/2 };
    const ring = Math.max(size.w, size.h) * 0.65;

    const list = [...listTiles];
    for (let i = list.length - 1; i > 0; i--){ const j = (Math.random() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }

    let done = 0;
    list.forEach((t)=>{
      const target = { x: t.x, y: t.y };
      t.visible = true;
      t.zIndex = 100;
      STATE.board.sortChildren?.();

      const dx = target.x - center.x, dy = target.y - center.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const sx = target.x + ux * ring, sy = target.y + uy * ring;

      const enterDur = 0.72 + Math.random() * 0.21; // 50% slower, gentler
      const baseDel  = 0.03 + Math.random() * 0.06; // base minimal stagger
      const originRow = (Math.random() * ROWS) | 0;
      const originCol = (Math.random() * COLS) | 0;
      const dist = Math.hypot((t.gridX|0) - originCol, (t.gridY|0) - originRow);
      const waveSpacing = 0.045 + Math.random()*0.020; // seconds per grid distance
      const enterDel = baseDel + dist * waveSpacing + Math.random()*0.05;

      t.position.set(sx, sy);
      t.scale.set(0.92 + Math.random() * 0.06);

      gsap.timeline({
        delay: enterDel,
        onComplete: () => {
          t.zIndex = 10; STATE.board.sortChildren?.();
          if (++done === list.length) resolve();
        }
      })
      .to(t,       { x: target.x, y: target.y, duration: enterDur, ease: 'elastic.out(1,0.70)', onUpdate:()=>{ try{ t.refreshShadow?.(); }catch{} } }, 0)
      .to(t.scale, { x: 1,        y: 1,        duration: enterDur, ease: 'elastic.out(1,0.70)' }, 0);
    });
  });
}
