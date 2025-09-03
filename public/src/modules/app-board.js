// src/modules/app-board.js
import { gsap } from 'gsap';
import { STATE, COLS, ROWS, TILE, GAP } from './app-state.js';
import * as makeBoard from './board.js';
import { drawBoardBG, layout } from './app-layout.js';

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

  // “deal-in” (ring) intro animation for all tiles
  dealFromRim(STATE.tiles).then(() => {
    STATE.tiles.filter(t => t.locked).forEach(t=>{
      gsap.to(t, { alpha: 0.35, duration: 0.28, ease: 'power1.out' });
    });
    drawBoardBG();
  });
}

export function isBoardClean(){ return STATE.tiles.every(t => t.locked || t.value <= 0); }

function randVal(){ return [1,1,1,2,2,3,3,4,5][(Math.random()*9)|0]; }

// Classic ring “deal-in” animation
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

      const enterDur = 1.0 + Math.random() * 0.40;
      const enterDel = 0.10 + Math.random() * 0.30;

      t.position.set(sx, sy);
      t.scale.set(0.92 + Math.random() * 0.06);

      gsap.timeline({
        delay: enterDel,
        onComplete: () => {
          t.zIndex = 10; STATE.board.sortChildren?.();
          if (!t.locked && (t.value|0) > 0){
            const host = t.rotG || t;
            const amp = 0.045 + Math.random() * 0.015;
            const r0 = t.rotG?.rotation || 0;
            gsap.timeline()
              .to(host, { rotation: r0 + amp,      duration: 0.12, ease:'power2.out' })
              .to(host, { rotation: r0 - amp*0.7,  duration: 0.14, ease:'power2.out' })
              .to(host, { rotation: r0 + amp*0.35, duration: 0.14, ease:'power2.out' })
              .to(host, { rotation: r0,            duration: 0.16, ease:'power2.out' });
            gsap.timeline()
              .to(t.scale, { x:1.03, y:1.03, duration:0.12, ease:'power2.out' })
              .to(t.scale, { x:0.995, y:0.995, duration:0.14, ease:'power2.inOut' })
              .to(t.scale, { x:1.00, y:1.00, duration:0.16, ease:'power2.out' });
          } else {
            gsap.to(t.scale, { x:1, y:1, duration:0.14, ease:'power1.out' });
          }
          if (++done === list.length) resolve();
        }
      })
      .to(t,       { x: target.x, y: target.y, duration: enterDur, ease: 'elastic.out(1,0.65)' }, 0)
      .to(t.scale, { x: 1,        y: 1,        duration: enterDur, ease: 'elastic.out(1,0.75)' }, 0);
    });
  });
}
