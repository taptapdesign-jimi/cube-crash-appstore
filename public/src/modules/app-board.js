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

  // Animation is now handled in app.js
  // sweetPopIn is called from there
}

export function isBoardClean(){ return STATE.tiles.every(t => t.locked || t.value <= 0); }

function randVal(){ return [1,1,1,2,2,3,3,4,5][(Math.random()*9)|0]; }

// Fun bouncy animation with smart optimization
export function sweetPopIn(listTiles){
  return new Promise(resolve=>{
    const list = [...listTiles];
    
    // Shuffle for random order
    for (let i = list.length - 1; i > 0; i--){ 
      const j = (Math.random() * (i + 1)) | 0; 
      [list[i], list[j]] = [list[j], list[i]]; 
    }

    let done = 0;
    const BATCH_SIZE = 8; // Process in small batches
    
    // Process tiles in batches to prevent lag
    const processBatch = (startIndex) => {
      const endIndex = Math.min(startIndex + BATCH_SIZE, list.length);
      
      for (let i = startIndex; i < endIndex; i++) {
        const t = list[i];
        const index = i;
        
        // Start invisible and scaled to 0
        t.visible = true;
        t.scale.set(0);
        t.zIndex = 100;
        
        // Set alpha based on locked status
        if (t.locked) {
          if (t.value > 0) {
            t.alpha = 0; // Hide ghost placeholder for rotated tiles
          } else {
            t.alpha = 0.25; // Ghost placeholder - 25% opacity
          }
        } else {
          t.alpha = 0; // Will animate to 1
        }
        
        // Instant stagger for immediate response
        const staggerDelay = (index - startIndex) * 0.01; // Ultra fast stagger
        
        // Super elastic bouncy animation - 1 second longer
        gsap.timeline({
          delay: staggerDelay,
          onComplete: () => {
            t.zIndex = 10; 
            if (++done === list.length) {
              // Delay drawBoardBG to prevent lag
              gsap.delayedCall(0.1, () => {
                try { drawBoardBG(); } catch {}
                resolve();
              });
            }
          }
        })
        .to(t, { 
          alpha: t.locked ? (t.value > 0 ? 0 : 0.25) : 1,
          duration: 0.12, // Longer alpha fade
          ease: 'power2.out'
        }, 0)
        .to(t.scale, { 
          x: 1.25, 
          y: 1.25, 
          duration: 0.25, // Longer scale up
          ease: 'back.out(2.5)'
        }, 0)
        .to(t.scale, { 
          x: 0.95, 
          y: 0.95, 
          duration: 0.15, // Longer scale down
          ease: 'power2.out'
        }, 0.25)
        .to(t.scale, { 
          x: 1.05, 
          y: 1.05, 
          duration: 0.12, // Longer second bounce
          ease: 'back.out(1.8)'
        }, 0.40)
        .to(t.scale, { 
          x: 1, 
          y: 1, 
          duration: 0.10, // Longer final settle
          ease: 'power2.out'
        }, 0.52);
      }
      
      // Schedule next batch immediately for instant animation
      if (endIndex < list.length) {
        gsap.delayedCall(0.005, () => { // Ultra minimal delay
          processBatch(endIndex);
        });
      }
    };
    
    // Start with first batch immediately - no delay
    console.log('🎯 Starting tile animation immediately');
    processBatch(0);
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
