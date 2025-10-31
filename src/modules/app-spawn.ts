// src/modules/app-spawn.ts
import { Assets, Texture, Container } from 'pixi.js';
import { gsap } from 'gsap';
import { STATE, TILE, ASSET_WILD } from './app-state.js';
import * as makeBoard from './board.js';
import { startWildIdle, wildImpactEffect } from './fx.js';
import { logger } from '../core/logger.js';
// drawBoardBG function is now in app.js

// Types
interface Tile extends Container {
  hover?: Container;
  rotG?: Container;
  base?: Container;
  num?: Container;
  pips?: Container;
  isWildFace?: boolean;
  locked?: boolean;
  eventMode?: string;
  cursor?: string;
  special?: string;
  _spawned?: boolean;
  alpha?: number;
  scale?: { x: number; y: number; set: (x: number, y: number) => void };
  rotation?: number;
}

interface SpawnBounceOptions {
  startScale?: number;
  max?: number;
  compress?: number;
  rebound?: number;
  wiggle?: number;
  fadeIn?: number;
}

interface OpenAtCellOptions {
  value?: number | null;
  isWild?: boolean;
}

interface OpenEmptiesOptions {
  exclude?: number | number[];
}

export function fixHoverAnchor(t: Tile): void { 
  try { 
    if (t && t.hover) { 
      t.hover.x = TILE/2; 
      t.hover.y = TILE/2; 
    } 
  } catch {} 
}

function applyWildSkinLocal(tile: Tile): void {
  try{
    const tex = Assets.get(ASSET_WILD) || Texture.from(ASSET_WILD);
    if (!tex || !tile) return;
    const host = tile.rotG || tile;
    let base = tile.base;
    if (!base){
      base = host.children?.find((c: any) => c.texture instanceof Texture) || null;
      if (base) tile.base = base;
    }
    if (base){ 
      base.texture = tex; 
      (base as any).tint = 0xFFFFFF; 
      (base as any).alpha = 1; 
    }
    if (tile.num)  tile.num.visible = false;
    if (tile.pips) tile.pips.visible = false;
    tile.isWildFace = true;
  }catch{}
}

export function openAtCell(c: number, r: number, { value = null, isWild = false }: OpenAtCellOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    let holder = STATE.grid?.[r]?.[c] || null;
    if (!holder) holder = makeBoard.createTile({ board: STATE.board!, grid: STATE.grid, tiles: STATE.tiles, c, r, val: 0, locked: true });

    holder.locked = false; 
    holder.eventMode = 'static'; 
    holder.cursor = 'pointer';
    if (STATE.drag && (STATE.drag as any).bindToTile) (STATE.drag as any).bindToTile(holder);

    const v = (value == null) ? [1,2,3,4,5][(Math.random()*5)|0] : value;
    makeBoard.setValue(holder, v, 0);

    if (isWild){
      holder.special = 'wild';
      if (typeof makeBoard.applyWildSkin === 'function') { 
        makeBoard.applyWildSkin(holder); 
      } else { 
        applyWildSkinLocal(holder); 
      }
      // Wild idle animation disabled - wild cubes now static
      // try { 
      //   console.log('🔵 CALLING startWildIdle for holder:', holder);
      //   startWildIdle(holder, { interval: 4 }); 
      // } catch (e) {
      //   console.error('❌ Error calling startWildIdle:', e);
      // }
    }

    holder.alpha = 0;
    spawnBounce(holder, () => {
      holder.alpha = 1;
      // Use enhanced wild impact effect for wild cubes
      if (isWild) {
        wildImpactEffect(holder);
        smokeBubblesAtTile(STATE.board!, holder, TILE, 2.5);
      }
      sweepForUnanimatedSpawns();
      resolve();
    }, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035 });
  });
}

export function spawnBounce(t: Tile, done: (() => void) | null, opts: SpawnBounceOptions = {}): void {
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
  t.scale!.set(startScale, startScale);
  const dir = Math.random() < 0.5 ? 1 : -1;
  const finish = () => { 
    t._spawned = true; 
    if (typeof done === 'function') done(); 
  };
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

export function sweepForUnanimatedSpawns(): void {
  try{
    STATE.tiles.forEach(t => {
      if (!t || t.locked) return;
      if (!t._spawned){
        spawnBounce(t, () => {}, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035 });
      }
    });
  }catch{}
}

export function openEmpties(count: number, opts: OpenEmptiesOptions = {}): Promise<void> {
  const exclude = opts?.exclude;
  const getSpawnValue = (): number => {
    let pool = [1,2,3,4,5];
    if (Array.isArray(exclude)) {
      const excludeSet = new Set(exclude.map(v => v|0));
      pool = pool.filter(v => !excludeSet.has(v));
    } else if (Number.isFinite(exclude)) {
      pool = pool.filter(v => v !== (exclude as number|0));
    }
    if (pool.length === 0) pool = [1,2,3,4,5];
    return pool[(Math.random()*pool.length)|0];
  };
  if (count <= 0) return Promise.resolve();
  const locked = STATE.tiles.filter(t => t.locked);
  if (!locked.length) return Promise.resolve();

  for (let i = locked.length - 1; i > 0; i--){
    const j = (Math.random() * (i + 1)) | 0;
    [locked[i], locked[j]] = [locked[j], locked[i]];
  }
  const picks = locked.slice(0, Math.min(count, locked.length));

  return Promise.all(picks.map(t => new Promise<void>(res => {
    t.locked = false; 
    t.eventMode = 'static'; 
    t.cursor = 'pointer';
    if (STATE.drag && (STATE.drag as any).bindToTile) (STATE.drag as any).bindToTile(t);
    makeBoard.setValue(t, getSpawnValue(), 0);
    spawnBounce(t, () => { 
      try{ fixHoverAnchor(t); }catch{}; 
      res(); 
    }, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035 });
  }))).then(async () => { 
    try{ 
      // drawBoardBG function should be imported from app.js
      (window as any).drawBoardBG?.(); 
    }catch{}; 
    
    // Update idle bounce tile list with newly spawned tiles
    try {
      const { TILE_IDLE_BOUNCE } = await import('./tile-idle-bounce.js');
      if (TILE_IDLE_BOUNCE?.ENABLE) {
        TILE_IDLE_BOUNCE.updateTileList(STATE.tiles);
        console.log('🔄 Updated idle bounce tile list after openEmpties');
      }
    } catch (error) {
      console.warn('⚠️ Failed to update idle bounce tile list in openEmpties:', error);
    }
  });
}

// Add smokeBubblesAtTile function (needed by openAtCell)
function smokeBubblesAtTile(board: Container, tile: Tile, tileSize: number, intensity: number): void {
  // This function should be implemented in fx.js
  // For now, we'll add a placeholder
  logger.info('smokeBubblesAtTile called with:', { board, tile, tileSize, intensity });
}

