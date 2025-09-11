// src/modules/app-spawn.js
import { Assets, Texture } from '/node_modules/pixi.js/dist/pixi.mjs';
import { gsap } from '/node_modules/gsap/index.js';
import { STATE, TILE, ASSET_WILD } from './app-state.js';
import * as makeBoard from './board.js';
// drawBoardBG function is now in app.js

export function fixHoverAnchor(t){ try { if (t && t.hover) { t.hover.x=TILE/2; t.hover.y=TILE/2; } } catch {} }

function applyWildSkinLocal(tile){
  try{
    const tex = Assets.get(ASSET_WILD) || Texture.from(ASSET_WILD);
    if (!tex || !tile) return;
    const host = tile.rotG || tile;
    let base = tile.base;
    if (!base){
      base = host.children?.find(c => c.texture instanceof Texture) || null;
      if (base) tile.base = base;
    }
    if (base){ base.texture = tex; base.tint=0xFFFFFF; base.alpha=1; }
    if (tile.num)  tile.num.visible = false;
    if (tile.pips) tile.pips.visible = false;
    tile.isWildFace = true;
  }catch{}
}

export function openAtCell(c, r, { value=null, isWild=false } = {}){
  return new Promise((resolve)=>{
    let holder = STATE.grid?.[r]?.[c] || null;
    if (!holder) holder = makeBoard.createTile({ board: STATE.board, grid: STATE.grid, tiles: STATE.tiles, c, r, val:0, locked:true });

    holder.locked=false; holder.eventMode='static'; holder.cursor='pointer';
    if (STATE.drag?.bindToTile) STATE.drag.bindToTile(holder);

    const v = (value == null) ? [1,2,3,4,5][(Math.random()*5)|0] : value;
    makeBoard.setValue(holder, v, 0);

    if (isWild){
      holder.special = 'wild';
      if (typeof makeBoard.applyWildSkin === 'function') { makeBoard.applyWildSkin(holder); }
      else { applyWildSkinLocal(holder); }
    }

    holder.alpha = 0;
    spawnBounce(holder, () => {
      holder.alpha = 1;
      sweepForUnanimatedSpawns();
      resolve();
    }, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035 });
  });
}

export function spawnBounce(t, done, opts = {}){
  const {
    startScale = 0.30,
    max       = 1.08,
    compress  = 0.96,
    rebound   = 1.02,
    wiggle    = 0.035,
    fadeIn    = 0.10
  } = opts;

  const trg = t.rotG || t;
  t.alpha = 0;
  t.scale.set(startScale);
  const dir = Math.random() < 0.5 ? 1 : -1;
  const finish = () => { t._spawned = true; if (typeof done === 'function') done(); };
  const tl = gsap.timeline({ onComplete: finish });
  tl.to(t,       { alpha: 1,            duration: fadeIn,  ease: 'power1.out' }, 0)
    .to(t.scale, { x: max,  y: max,     duration: 0.16,    ease: 'back.out(2.1)' }, 0)
    .to(t.scale, { x: compress, y: compress, duration: 0.10, ease: 'power2.inOut' })
    .to(t.scale, { x: rebound,  y: rebound,  duration: 0.10, ease: 'power2.out' })
    .to(t.scale, { x: 1.00,     y: 1.00,     duration: 0.12, ease: 'back.out(2)' });

  gsap.timeline()
    .to(trg, { rotation:  wiggle*dir,        duration: 0.10, ease: 'power2.out' })
    .to(trg, { rotation: -wiggle*0.6*dir,    duration: 0.12, ease: 'power2.out' })
    .to(trg, { rotation:  0,                 duration: 0.14, ease: 'power2.out' });
}

export function sweepForUnanimatedSpawns(){
  try{
    STATE.tiles.forEach(t=>{
      if (!t || t.locked) return;
      if (!t._spawned){
        spawnBounce(t, ()=>{}, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035 });
      }
    });
  }catch{}
}

export function openEmpties(count){
  if (count <= 0) return Promise.resolve();
  const locked = STATE.tiles.filter(t => t.locked);
  if (!locked.length) return Promise.resolve();

  for (let i = locked.length - 1; i > 0; i--){
    const j = (Math.random() * (i + 1)) | 0;
    [locked[i], locked[j]] = [locked[j], locked[i]];
  }
  const picks = locked.slice(0, Math.min(count, locked.length));

  return Promise.all(picks.map(t => new Promise(res=>{
    t.locked=false; t.eventMode='static'; t.cursor='pointer';
    if (STATE.drag?.bindToTile) STATE.drag.bindToTile(t);
    makeBoard.setValue(t, [1,2,3,4,5][(Math.random()*5)|0], 0);
    spawnBounce(t, () => { try{ fixHoverAnchor(t); }catch{}; res(); }, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035 });
  }))).then(()=>{ try{ drawBoardBG(); }catch{}; });
}
