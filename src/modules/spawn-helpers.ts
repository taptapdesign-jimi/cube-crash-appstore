// public/src/modules/spawn-helpers.ts
// Spawn/deal animacije – iOS friendly, Promise-based, bez side‑effecta izvan proslijeđenih argumenata.

import { gsap } from 'gsap';

// Type definitions
interface Tile extends Container {
  rotG?: Container;
  alpha: number;
  scale: { set: (x: number, y: number) => void; x: number; y: number };
  locked: boolean;
  visible: boolean;
  zIndex: number;
  x: number;
  y: number;
  position: { set: (x: number, y: number) => void };
  gridX: number;
  gridY: number;
  eventMode: string;
  cursor: string;
  _spawned?: boolean;
  refreshShadow?: () => void;
}

interface Container {
  sortChildren?: () => void;
}

interface Board extends Container {
  sortChildren?: () => void;
}

interface SpawnBounceOptions {
  startScale?: number;
  max?: number;
  compress?: number;
  rebound?: number;
  wiggle?: number;
  fadeIn?: number;
}

interface DealFromRimOptions {
  listTiles?: Tile[];
  board?: Board;
  boardSize?: { w: number; h: number };
  gsap?: any;
}

interface OpenEmptiesOptions {
  count?: number;
  tiles?: Tile[];
  drag?: {
    bindToTile: (tile: Tile) => void;
  };
  makeBoard?: {
    setValue: (tile: Tile, value: number, depth: number) => void;
  };
  gsap?: any;
  drawBoardBG?: () => void;
  TILE?: any;
  fixHoverAnchor?: (tile: Tile) => void;
}

export function spawnBounce(t: Tile, gsap: any, opts: SpawnBounceOptions = {}, done?: () => void): void {
  const {
    startScale = 0.30,
    max       = 1.08,
    compress  = 0.96,
    rebound   = 1.02,
    wiggle    = 0.035,
    fadeIn    = 0.10
  } = opts || {};

  const trg = t.rotG || t;
  t.alpha = 0;
  t.scale.set(startScale, startScale);

  const dir = Math.random() < 0.5 ? 1 : -1;
  const finish = () => { t._spawned = true; if (typeof done === 'function') done(); };
  const tl = gsap.timeline({ onComplete: finish });

  tl.to(t,       { alpha: 1,            duration: fadeIn,  ease: 'power1.out' }, 0)
    .to(t.scale, { x: max,  y: max,     duration: 0.12,    ease: 'back.out(2.1)' }, 0)
    .to(t.scale, { x: compress, y: compress, duration: 0.08, ease: 'power2.inOut' })
    .to(t.scale, { x: rebound,  y: rebound,  duration: 0.08, ease: 'power2.out' })
    .to(t.scale, { x: 1.00,     y: 1.00,     duration: 0.10, ease: 'back.out(2)' });

  gsap.timeline()
    .to(trg, { rotation:  wiggle*dir,        duration: 0.08, ease: 'power2.out' })
    .to(trg, { rotation: -wiggle*0.6*dir,    duration: 0.10, ease: 'power2.out' })
    .to(trg, { rotation:  0,                 duration: 0.12, ease: 'power2.out' });
}

export function sweepForUnanimatedSpawns(tiles: Tile[], gsap: any): void {
  try{
    tiles.forEach(t=>{
      if (!t || t.locked) return;
      if (!t._spawned){
        spawnBounce(t, gsap, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035 });
      }
    });
  }catch{}
}

export function dealFromRim({ listTiles = [], board, boardSize, gsap }: DealFromRimOptions = {}): Promise<void> {
  // Fluid elastic deal‑in with messy row/col wave and jitter — returns Promise
  return new Promise(resolve=>{
    if (!Array.isArray(listTiles) || listTiles.length === 0) { resolve(); return; }
    const size = boardSize || { w: 0, h: 0 };
    const center={x:size.w/2,y:size.h/2};
    const ring=Math.max(size.w,size.h)*0.65;

    const list=[...listTiles]; for(let i=list.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [list[i],list[j]]=[list[j],list[i]]; }

    // infer grid size and choose random wave origin
    const maxRow = Math.max(0, ...list.map(t => t?.gridY|0));
    const maxCol = Math.max(0, ...list.map(t => t?.gridX|0));
    const rows = maxRow + 1, cols = maxCol + 1;
    const originRow = (Math.random()*rows)|0;
    const originCol = (Math.random()*cols)|0;
    const waveSpacing = 0.045 + Math.random()*0.020; // seconds per grid distance

    let done=0;
    list.forEach((t)=>{
      const target={x:t.x,y:t.y}; t.visible=true; t.zIndex=100; board?.sortChildren?.();
      const dx=target.x-center.x, dy=target.y-center.y; const len=Math.hypot(dx,dy)||1; const ux=dx/len, uy=dy/len; const sx=target.x+ux*ring, sy=target.y+uy*ring;

      const baseDur = 0.63 + Math.random()*0.22;           // gentle and fluid
      const damping = 0.64 + Math.random()*0.10;            // different per tile

      const gx = (t.gridX|0), gy = (t.gridY|0);
      const dist = Math.hypot(gx-originCol, gy-originRow);
      const waveDelay = dist * waveSpacing;
      const jitter = Math.random()*0.06;
      const enterDel = 0.02 + Math.random()*0.05 + waveDelay + jitter;

      t.position.set(sx,sy);
      t.scale.set(0.90 + Math.random()*0.08, 0.90 + Math.random()*0.08);

      const tl=gsap.timeline({ delay:enterDel, onComplete:()=>{
        t.zIndex=10; t._spawned = true; board?.sortChildren?.();
        if(++done===list.length) resolve();
      }});

      tl.to(t,{ x:target.x, y:target.y, duration:baseDur, ease:`elastic.out(1,${damping})`, onUpdate:()=>{ try{ t.refreshShadow?.(); }catch{} } },0)
        .to(t.scale,{ x:1, y:1, duration:baseDur, ease:`elastic.out(1,${Math.max(0.60, Math.min(0.80, damping+0.02))})` },0);
    });
  });
}

export async function openEmpties({ count=0, tiles=[], drag, makeBoard, gsap, drawBoardBG, TILE, fixHoverAnchor }: OpenEmptiesOptions = {}): Promise<void> {
  if (count <= 0) return;
  const locked = tiles.filter(t => t.locked);
  if (!locked.length) return;

  for (let i=locked.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [locked[i],locked[j]]=[locked[j],locked[i]]; }
  const picks = locked.slice(0, Math.min(count, locked.length));

  await Promise.all(picks.map(t => new Promise<void>(res=>{
    t.locked=false; t.eventMode='static'; t.cursor='pointer';
    if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(t);
    makeBoard?.setValue(t, [1,2,3,4,5][(Math.random()*5)|0], 0);
    try { fixHoverAnchor?.(t); } catch {}
    spawnBounce(t, gsap, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035 }, res);
  })));

  try { drawBoardBG?.(); } catch {}
  sweepForUnanimatedSpawns(tiles, gsap);
}
