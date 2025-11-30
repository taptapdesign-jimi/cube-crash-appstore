// src/modules/app-spawn.ts
import { Assets, Texture, Container, Graphics } from 'pixi.js';
import { gsap } from 'gsap';
import { STATE, TILE, ASSET_WILD } from './app-state.js';
import { ASSET_WILD_MAGNET, ASSET_WILD_BEER } from './constants.js';
import * as makeBoard from './board.js';
import { startWildIdle, wildImpactEffect, startWildShimmer, startWildStars, startWildBeerBubbles } from './fx.js';
import { logger } from '../core/logger.js';
import { resetTileToNormalState } from './tile-state-utils.ts';
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
  isWildMagnet?: boolean;
  skipBind?: boolean;
}

interface OpenEmptiesOptions {
  exclude?: number | number[];
}

function bindTileWithFallback(tile: Tile, skipBind: boolean): void {
  const attemptBind = () => {
    const drag = STATE.drag as any;
    if (!drag || typeof drag.bindToTile !== 'function') return false;
    drag.bindToTile(tile);
    return true;
  };

  // If skipBind is false, try to bind immediately
  if (!skipBind) {
    if (!attemptBind()) {
      // If STATE.drag is null, retry with delay
      let attempts = 0;
      const maxAttempts = 30;
      const schedule = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : (cb: FrameRequestCallback | (() => void)) => setTimeout(cb as () => void, 16);

      const retry = () => {
        if (attemptBind() || attempts >= maxAttempts) {
          return;
        }
        attempts += 1;
        schedule(retry);
      };
      retry();
    }
    return;
  }

  // If skipBind is true, only bind if no tile is currently being dragged
  if (!(STATE.drag as any)?.t) {
    attemptBind();
    return;
  }

  // If a tile is being dragged, wait for it to finish
  let attempts = 0;
  const maxAttempts = 60;
  const schedule = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame.bind(window)
    : (cb: FrameRequestCallback | (() => void)) => setTimeout(cb as () => void, 16);

  const retry = () => {
    const drag = STATE.drag as any;
    if (!drag?.t || attempts >= maxAttempts) {
      attemptBind();
      return;
    }
    attempts += 1;
    schedule(retry);
  };

  retry();
}

export function fixHoverAnchor(t: Tile): void { 
  try { 
    if (t && t.hover) { 
      t.hover.x = TILE/2; 
      t.hover.y = TILE/2; 
    } 
  } catch {} 
}

// Electric glow effect for wild-magnet tiles
function addElectricGlow(tile: any): void {
  try {
    // Remove existing glow if present
    if (tile._electricGlow) {
      try {
        tile._electricGlow.parent?.removeChild(tile._electricGlow);
        tile._electricGlow.destroy();
      } catch {}
    }
    if (tile._glowAnimation) {
      tile._glowAnimation.kill();
    }
    
    const glowContainer = new Container();
    glowContainer.zIndex = -1; // Behind tile
    tile._electricGlow = glowContainer;
    
    const host = tile.rotG || tile;
    if (host && host.addChild) {
      host.addChildAt(glowContainer, 0);
    }
    
    // Create 4 glow rings with different phases
    const rings = [];
    const colors = [0xF26034, 0xE97A55, 0xFF8C5A, 0xF26034]; // Red-orange spectrum
    
    for (let i = 0; i < 4; i++) {
      const ring = new Graphics();
      const radius = 50 + i * 4;
      const thickness = 2 + Math.random() * 2;
      
      // Draw circle with segments for jittery effect
      const segments = 32;
      for (let s = 0; s < segments; s++) {
        const angle1 = (s / segments) * Math.PI * 2;
        const angle2 = ((s + 1) / segments) * Math.PI * 2;
        
        const x1 = Math.cos(angle1) * radius;
        const y1 = Math.sin(angle1) * radius;
        const x2 = Math.cos(angle2) * radius;
        const y2 = Math.sin(angle2) * radius;
        
        ring.moveTo(x1, y1);
        ring.lineTo(x2, y2);
      }
      
      ring.stroke({ width: thickness, color: colors[i], alpha: 0.3 });
      ring.alpha = 0.5;
      glowContainer.addChild(ring);
      rings.push(ring);
    }
    
    // Animate rings with jittery pulsing effect
    const tl = gsap.timeline({ repeat: -1 });
    
    rings.forEach((ring, index) => {
      const delay = index * 0.1;
      
      // Jittery pulsing animation
      tl.to(ring.scale, {
        x: 1.12,
        y: 1.12,
        duration: 0.6 + Math.random() * 0.3,
        ease: 'power2.inOut',
        repeat: -1,
        yoyo: true,
        delay: delay,
        modifiers: {
          x: () => ring.scale.x + (Math.random() - 0.5) * 0.02, // Jitter
          y: () => ring.scale.y + (Math.random() - 0.5) * 0.02  // Jitter
        }
      }, 0);
      
      tl.to(ring, {
        alpha: 0.2 + Math.random() * 0.3,
        duration: 0.4 + Math.random() * 0.2,
        ease: 'power2.inOut',
        repeat: -1,
        yoyo: true,
        delay: delay
      }, 0);
      
      // Random rotation for electric effect
      tl.to(ring, {
        rotation: Math.PI * 2,
        duration: 3 + Math.random() * 2,
        ease: 'none',
        repeat: -1
      }, 0);
    });
    
    tile._glowAnimation = tl;
  } catch (error) {
    console.warn('⚠️ Failed to add electric glow:', error);
  }
}

function applyWildSkinLocal(tile: Tile): void {
  try{
    // Use appropriate texture based on special type
    let assetPath = ASSET_WILD;
    if (tile.special === 'wild-magnet') {
      assetPath = ASSET_WILD_MAGNET;
    } else if (tile.special === 'wild-beer') {
      assetPath = ASSET_WILD_BEER;
    }
    const tex = Assets.get(assetPath) || Texture.from(assetPath);
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

export function openAtCell(c: number, r: number, { value = null, isWild = false, isWildMagnet = false, skipBind = false }: OpenAtCellOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    let holder = STATE.grid?.[r]?.[c] || null;
    
    // 🔥 CRITICAL: Check if cell is already occupied by an active tile
    if (holder && !holder.locked) {
      const isWildTile = holder.special === 'wild' || holder.special === 'wild-magnet' || (holder as any).isWild === true || (holder as any).isWildFace === true;
      const isActive = (holder.value|0) > 0;
      
      // If cell has an active tile or wild tile, don't spawn here
      if (isWildTile || isActive) {
        console.warn(`⚠️ Cell (${c}, ${r}) is already occupied by active tile (value: ${holder.value}, special: ${holder.special}), skipping spawn`);
        resolve();
        return;
      }
    }
    
    if (!holder) holder = makeBoard.createTile({ board: STATE.board!, grid: STATE.grid, tiles: STATE.tiles, c, r, val: 0, locked: true });

    holder.locked = false; 
    holder.eventMode = 'static'; 
    holder.cursor = 'pointer';
    bindTileWithFallback(holder, skipBind);

    if (!isWild && !isWildMagnet) {
      resetTileToNormalState(holder);
    }

    // 🔥 CRITICAL: Spawn guard - NEVER spawn a tile with value <= 0!
    let v = (value == null) ? [1,2,3,4,5][(Math.random()*5)|0] : value;
    if (!Number.isFinite(v) || (v|0) <= 0) {
      console.error('🚨 SPAWN GUARD: Invalid spawn value detected!', { value, v, c, r });
      v = [1,2,3,4,5][(Math.random()*5)|0]; // Fallback to random 1-5
    }
    
    makeBoard.setValue(holder, v, 0);
    
    // 🔥 CRITICAL: Double-check after setValue - if value is still <= 0, force it to a valid value
    if ((holder.value|0) <= 0 && !isWild && !isWildMagnet) {
      console.error('🚨 SPAWN GUARD: Tile value is 0 after setValue! Forcing to random value.', { 
        holderValue: holder.value, 
        requestedValue: v,
        c, 
        r 
      });
      const fallbackValue = [1,2,3,4,5][(Math.random()*5)|0];
      makeBoard.setValue(holder, fallbackValue, 0);
      
      // Final check - if STILL 0, something is very wrong
      if ((holder.value|0) <= 0) {
        console.error('🚨🚨🚨 CRITICAL: Tile value is STILL 0 after fallback! This should never happen!');
        // Last resort: set value directly
        holder.value = fallbackValue;
      }
    }

    if (isWild || isWildMagnet){
      holder.special = isWildMagnet ? 'wild-magnet' : 'wild';
      // Always use applyWildSkinLocal to ensure electric glow is added for wild-magnet
      if (typeof window.CC?.applyWildSkinLocal === 'function') { 
        window.CC.applyWildSkinLocal(holder); 
      } else if (typeof makeBoard.applyWildSkin === 'function') { 
        makeBoard.applyWildSkin(holder); 
      }
      // Wild shimmer only (no bounce animation)
      try { 
        startWildShimmer(holder); 
        startWildStars(holder);
      } catch (e) {
        console.error('❌ Error calling startWildShimmer:', e);
      }
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
      // 🔥 CRITICAL FIX: Only animate tiles that are actually newly spawned
      // If a tile is already visible (alpha === 1), it's an existing tile and shouldn't be re-animated
      // Only animate tiles that are invisible (alpha === 0) or don't have _spawned flag set
      // This prevents re-animating existing tiles that were already on the board
      const isAlreadyVisible = (t.alpha ?? 1) >= 0.99; // Tile is already visible
      if (!t._spawned && !isAlreadyVisible){
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
  let locked = STATE.tiles.filter(t => t.locked);
  
  // 🔥 CRITICAL FIX: If we don't have enough locked tiles, create new ones at empty cells
  // This ensures we can always spawn the requested number of tiles, even on end board
  if (locked.length < count) {
    console.log(`⚠️ openEmpties: Only ${locked.length} locked tiles available, but need ${count}. Creating ${count - locked.length} new locked tiles at empty cells...`);
    
    // Find empty cells (where grid[r][c] === null)
    const emptyCells: { c: number; r: number }[] = [];
    const ROWS = STATE.grid?.length || 0;
    const COLS = STATE.grid?.[0]?.length || 0;
    
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!STATE.grid?.[r]?.[c]) {
          emptyCells.push({ c, r });
        }
      }
    }
    
    // Shuffle empty cells and create locked tiles
    for (let i = emptyCells.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [emptyCells[i], emptyCells[j]] = [emptyCells[j], emptyCells[i]];
    }
    
    // Create new locked tiles at empty cells (up to the number we need)
    const needed = count - locked.length;
    for (let i = 0; i < Math.min(needed, emptyCells.length); i++) {
      const { c, r } = emptyCells[i];
      try {
        const newTile = makeBoard.createTile({ board: STATE.board!, grid: STATE.grid, tiles: STATE.tiles, c, r, val: 0, locked: true });
        if (newTile) {
          console.log(`✅ Created new locked tile at (${c}, ${r})`);
        }
      } catch (err) {
        console.warn(`⚠️ Failed to create locked tile at (${c}, ${r}):`, err);
      }
    }
    
    // Re-fetch locked tiles after creating new ones
    locked = STATE.tiles.filter(t => t.locked);
    if (locked.length < count) {
      console.warn(`⚠️ openEmpties: Still only ${locked.length} locked tiles after creating new ones. Will spawn ${locked.length} tiles instead of ${count}.`);
    }
  }
  
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
    
    // 🔥 CRITICAL: Spawn guard - NEVER spawn a tile with value <= 0!
    let spawnValue = getSpawnValue();
    if (!Number.isFinite(spawnValue) || (spawnValue|0) <= 0) {
      console.error('🚨 SPAWN GUARD (openEmpties): Invalid spawn value detected!', { spawnValue, tileId: (t as any)?.uid });
      spawnValue = [1,2,3,4,5][(Math.random()*5)|0]; // Fallback to random 1-5
    }
    
    makeBoard.setValue(t, spawnValue, 0);
    
    // 🔥 CRITICAL: Double-check after setValue - if value is still <= 0, force it to a valid value
    if ((t.value|0) <= 0) {
      console.error('🚨 SPAWN GUARD (openEmpties): Tile value is 0 after setValue! Forcing to random value.', { 
        tileValue: t.value, 
        requestedValue: spawnValue,
        tileId: (t as any)?.uid,
        gridX: t.gridX,
        gridY: t.gridY
      });
      const fallbackValue = [1,2,3,4,5][(Math.random()*5)|0];
      makeBoard.setValue(t, fallbackValue, 0);
      
      // Final check - if STILL 0, something is very wrong
      if ((t.value|0) <= 0) {
        console.error('🚨🚨🚨 CRITICAL (openEmpties): Tile value is STILL 0 after fallback! This should never happen!');
        // Last resort: set value directly
        t.value = fallbackValue;
      }
    }
    
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
