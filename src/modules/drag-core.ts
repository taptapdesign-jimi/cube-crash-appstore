// src/modules/drag.js
// v1.3 STABLE drag (PIXI v8 + GSAP)
// - Hover okvir na target.rotG (ako postoji).
// - Drop SAMO kad je pointer unutar ciljne pločice (world-space getBounds()).
// - NEMA nearest auto-aimanja; u suprotnom ide snapBack.
// - GSAP guardovi ostaju za sigurnost.

import { Graphics, Container, Sprite, Texture } from 'pixi.js';
import { gsap } from 'gsap';
import { magicSparklesAtTile, dragSmokeTrail } from './fx.js';
import { TILE_IDLE_BOUNCE } from './tile-idle-bounce.ts';
import { handleWildMagnetMergedPulledTiles } from './app-merge.ts';


// --- Inercijski tilt parametri (nagib SUPROTNO od smjera + lag) ---------------
const TILT_MAX_RAD = 0.22;   // maksimalna rotacija (~12.6°)
const TILT_SCALE   = 18;     // skala pretvorbe brzine → rotacija
const VEL_SMOOTH   = 0.10;   // sporije prihvaća promjenu brzine (teži osjećaj)
const ROT_SMOOTH   = 0.08;   // sporije naginje prema cilju (teži osjećaj)
const POS_LAG_PX   = 6;      // maksimalni parallax pomak (px)
const TILT_DUR     = 0.5;    // zadržano za release tween na onUp

const MAGNET_OFFSET_RATIO = 14 / 128; // 14px od 128px pločice ≈ 10.9375%
const MAGNET_SCALE_MULT  = 1.03;    // 3% napuhavanje ciljane pločice
const MAGNET_IN_DUR      = 0.12;    // trajanje scale-in easing
const MAGNET_MOVE_DUR    = 0.085;   // koliko brzo se target približava
const MAGNET_RETURN_DUR  = 0.14;    // trajanje povratka u baznu poziciju

// --- GSAP SAFETY WRAPPERS (kao u tvom originalu) ---------------------------
const __dg_orig_to = gsap.to.bind(gsap);
const __dg_orig_fromTo = gsap.fromTo.bind(gsap);
const __dg_orig_set = gsap.set.bind(gsap);

function __dg_alive(target){
  if (!target) return false;
  if (Array.isArray(target)) return target.some(t => t && !t.destroyed);
  return !target.destroyed;
}

gsap.to = (target, vars) => {
  if (!__dg_alive(target)) return { kill(){} };
  if (Array.isArray(target)) target = target.filter(t => t && !t.destroyed);
  try { return __dg_orig_to(target, vars); } catch { return { kill(){} }; }
};
gsap.fromTo = (target, a, b) => {
  if (!__dg_alive(target)) return { kill(){} };
  if (Array.isArray(target)) target = target.filter(t => t && !t.destroyed);
  try { return __dg_orig_fromTo(target, a, b); } catch { return { kill(){} }; }
};
gsap.set = (target, vars) => {
  if (!__dg_alive(target)) return;
  if (Array.isArray(target)) target = target.filter(t => t && !t.destroyed);
  try { return __dg_orig_set(target, vars); } catch {}
};

(function __dg_installTlGuards(){
  if (__dg_installTlGuards._done) return; __dg_installTlGuards._done = true;
  const TL = gsap.core && gsap.core.Timeline && gsap.core.Timeline.prototype;
  if (!TL) return;
  const _to = TL.to, _fromTo = TL.fromTo, _set = TL.set, _call = TL.call;
  const __alive = (t)=>{ if (!t) return false; if (Array.isArray(t)) return t.some(x=>x && !x.destroyed); return !t.destroyed; };
  const __flt   = (t)=> Array.isArray(t) ? t.filter(x=>x && !x.destroyed) : t;
  TL.to      = function(t,v){ if (!__alive(t)) return this; try{ return _to.call(this, __flt(t), v); }catch{ return this; } };
  TL.fromTo  = function(t,a,b){ if (!__alive(t)) return this; try{ return _fromTo.call(this, __flt(t), a, b); }catch{ return this; } };
  TL.set     = function(t,v){ if (!__alive(t)) return this; try{ return _set.call(this, __flt(t), v); }catch{ return this; } };
  TL.call    = function(cb, params, pos){ try{ return _call.call(this, ()=>{ try{ typeof cb==='function' && cb.apply(this, params||[]); }catch{} }, null, pos); }catch{ return this; } };
})();

// Create a linear-gradient Texture using an offscreen canvas
function __dg_makeLinearGradientTexture(w, h, colA = 0xFFE9D9, colB = 0xB2876A, angleRad = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.ceil(w));
  canvas.height = Math.max(2, Math.ceil(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) return Texture.WHITE;

  const hexToRgba = (hex, a = 1) => {
    const r = (hex >> 16) & 255;
    const g = (hex >> 8) & 255;
    const b = hex & 255;
    return `rgba(${r},${g},${b},${a})`;
  };

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const len = Math.hypot(cx, cy);
  const dx = Math.cos(angleRad) * len;
  const dy = Math.sin(angleRad) * len;

  const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  grad.addColorStop(0, hexToRgba(colA, 1));
  grad.addColorStop(1, hexToRgba(colB, 1));

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return Texture.from(canvas);
}

export function initDrag(cfg) {
  const {
    app,
    board,
    getTiles,                      // () => Tile[]
    onMerge,                       // (srcTile, dstTile, helpers) => void
    canDrop = (src, dst) => true,
    tileSize = 128,

    hoverColor = 0x8a6e57,
    hoverWidth = 4,
    hoverAlpha = 0.15,

    threshold = 0.10,
  } = cfg;

  const drag = {
    t: null,
    startGX: 0, startGY: 0,
    startX: 0,  startY: 0,
    offX: 0,    offY: 0,
    moved: false,
    hoverTarget: null,
    hoverFrame: null,
    _lastGlobal: null, // world-space pointer
    threshold,
    // inertial tilt state
    vx: 0, vy: 0, lastTime: 0,
    lagX: 0, lagY: 0,
    magnet: {
      target: null,
      container: null,
      originX: 0,
      originY: 0,
      originScaleX: 1,
      originScaleY: 1,
      moveTween: null,
      scaleTween: null,
    },
    wildMagnetPulledTiles: null as any, // New property to store pulled tiles
    _wildMagnetPullState: null as any, // Track pull state for sequential pulling
    _wildMagnetDragStartTime: null as any, // Track when drag started for sequential pulling
    _lastSparkleTime: null as any,
    _sparkleInterval: null as any,
    _lastSmokeTime: null as any,
  };

  const helpers = { snapBack, clearHover };

  // ⚙️ Z-INDEX SAFETY HELPERS
  function rememberZ(t){ t._zBeforeDrag = (t?._zBeforeDrag ?? t?.zIndex ?? 0); }
  function restoreZ(t){
    if (!t) return;
    t.zIndex = (t._zBeforeDrag ?? 0);
    t._zBeforeDrag = undefined;
    try { board.sortChildren?.(); } catch {}
  }

  function bindToTile(t) {
    t.removeAllListeners?.('pointerdown');
    t.eventMode = 'static';
    t.cursor = 'pointer';
    t.on('pointerdown', (e) => onDown(e, t));
  }

  function onDown(e, t) {
    const p = board.toLocal(e.global);

    console.log('🔍 DRAG START: Tile at', t.gridX, t.gridY, 'value:', t.value, 'locked:', t.locked);
    
    // Notify idle bounce that user is interacting
    try {
      TILE_IDLE_BOUNCE.notifyInteraction();
    } catch (error) {
      console.warn('⚠️ Failed to notify board interaction:', error);
    }
    
    // MARK: User has made a move
    window._userMadeMove = true;
    console.log('✅ User has made a move - game can now be saved');
    
    // Show all ghost placeholders when user starts dragging
    if (window._ghostPlaceholders) {
      console.log('👻 Showing all ghost placeholders on drag start');
      for (let r = 0; r < window._ghostPlaceholders.length; r++) {
        if (window._ghostPlaceholders[r]) {
          for (let c = 0; c < window._ghostPlaceholders[r].length; c++) {
            if (window._ghostPlaceholders[r][c]) {
              window._ghostPlaceholders[r][c].visible = true;
            }
          }
        }
      }
    }
    
    releaseMagnet({ immediate: true });
    drag.t = t;
    drag.startGX = t.gridX;
    drag.startGY = t.gridY;
    drag.startX = t.x;
    drag.startY = t.y;
    drag.offX = p.x - t.x;
    drag.offY = p.y - t.y;
    drag.moved = false;
    drag._lastGlobal = e.global.clone?.() ?? { x: e.global.x, y: e.global.y };
    
    // Track drag start time for wild-magnet sequential pulling
    drag._wildMagnetDragStartTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    // reset inertial state
    drag.vx = 0; drag.vy = 0;
    drag.lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    drag.lagX = 0; drag.lagY = 0;
    if (t.rotG) gsap.killTweensOf(t.rotG);

    // ⬆️ digni na vrh, ali zapamti prijašnji z-index
    rememberZ(t);
    board.addChild(t);
    t.zIndex = 9999;

    // Temporarily set grid cell to null so ghost placeholder becomes visible
    if (cfg.getGrid) {
      const grid = cfg.getGrid();
      if (grid && grid[drag.startGY] && grid[drag.startGY][drag.startGX] === t) {
        grid[drag.startGY][drag.startGX] = null;
        console.log('🎯 DRAG: Temporarily cleared grid at', drag.startGX, drag.startGY);
        
        // Update ghost visibility to show placeholder at drag origin
        if (typeof window.updateGhostVisibility === 'function') {
          window.updateGhostVisibility();
        }
      }
    }

    // Ghost placeholders are now in fixed background layer - always visible

    // 🔧 SHADOW PATCH: prikaži sjenu i pojačaj na dragAlpha, uz očuvanje alpha pri refreshu
    if (t.shadow){
      t.shadow.visible = true;
      const prev = t.shadow.alpha;
      if (t.refreshShadow) { t.refreshShadow(); if (t.shadow) t.shadow.alpha = prev; }
      const to = Math.min(1, t.shadow._dragAlpha ?? 0.30);
      gsap.killTweensOf(t.shadow);
      gsap.to(t.shadow, { alpha: to, duration: 0.08, ease: 'power2.out' });
    }

    gsap.to(t.scale, { x: 1.12, y: 1.12, duration: 0.08 });

    // Start sparkles immediately when wild cube is picked up
    if (t.special === 'wild') {
      try {
        magicSparklesAtTile(board, t, { intensity: 1.0 });
        drag._lastSparkleTime = drag.lastTime;
        
        // Start continuous sparkles interval
        drag._sparkleInterval = setInterval(() => {
          if (drag.t && drag.t.special === 'wild' && !drag.t.destroyed) {
            try {
              magicSparklesAtTile(board, drag.t, { intensity: 1.0 });
            } catch (err) {
              console.warn('Wild interval sparkles error:', err);
            }
          } else {
            // Clear interval if tile is no longer being dragged
            if (drag._sparkleInterval) {
              clearInterval(drag._sparkleInterval);
              drag._sparkleInterval = null;
            }
          }
        }, 100); // Every 100ms for more frequent emission
      } catch (err) {
        console.warn('Wild pickup sparkles error:', err);
      }
    }

    app.stage.on('pointermove', onMove);
    app.stage.on('pointerup', onUp);
    app.stage.on('pointerupoutside', onUp);
  }

  function onMove(e) {
    if (!drag.t) return;
    const t = drag.t;
    if (!t || t.destroyed || !t.position) {
      drag.t = null;
      clearHover();
      return;
    }
    
    // Notify idle bounce that user is still interacting (carrying a tile)
    try {
      TILE_IDLE_BOUNCE.notifyInteraction();
    } catch (error) {
      console.warn('⚠️ Failed to notify board interaction on move:', error);
    }

    // stari global point (za brzinu)
    const prevGP = drag._lastGlobal || { x: e.global.x, y: e.global.y };

    const p = board.toLocal(e.global);
    const nx = p.x - drag.offX;
    const ny = p.y - drag.offY;
    if (Math.hypot(nx - drag.startX, ny - drag.startY) > 4) drag.moved = true;

    // bazna pozicija (prije parallaxa)
    let px = nx, py = ny;

    // --- izračun brzine (px/ms) + low-pass ---
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const dt  = Math.max(1, now - drag.lastTime);
    const instVX = (e.global.x - prevGP.x) / dt;
    const instVY = (e.global.y - prevGP.y) / dt;
    drag.vx = drag.vx + (instVX - drag.vx) * VEL_SMOOTH;
    drag.vy = drag.vy + (instVY - drag.vy) * VEL_SMOOTH;
    drag.lastTime = now;

    // --- target rotacija SUPROTNO od smjera (low-pass težina) ---
    const targetRot = Math.max(-TILT_MAX_RAD, Math.min(TILT_MAX_RAD, (-drag.vx * TILT_SCALE)));
    if (t.rotG) {
      const cur = t.rotG.rotation || 0;
      const next = cur + (targetRot - cur) * ROT_SMOOTH;
      t.rotG.rotation = next;

      // parallax lag: smoothtani drift suprotno od smjera
      const targetLagX = Math.max(-POS_LAG_PX, Math.min(POS_LAG_PX, -drag.vx * 240));
      const targetLagY = Math.max(-POS_LAG_PX, Math.min(POS_LAG_PX, -drag.vy * 240));
      drag.lagX = drag.lagX + (targetLagX - drag.lagX) * 0.12;
      drag.lagY = drag.lagY + (targetLagY - drag.lagY) * 0.12;
      px += drag.lagX; py += drag.lagY;
    }

    if (t.position?.set) {
      t.position.set(px, py);
    }

    // Wild cube sparkles effect - continuous when selected (picked up)
    if (t.special === 'wild') {
      // Store velocity for sparkles direction
      t._lastVelX = drag.vx;
      t._lastVelY = drag.vy;
      
      // Continuous sparkles when wild cube is picked up (whether moving or not)
      if (!drag._lastSparkleTime || (now - drag._lastSparkleTime) > 100) { // Every 100ms for continuous effect
        try {
          magicSparklesAtTile(board, t, { intensity: 1.0 });
          drag._lastSparkleTime = now;
        } catch (err) {
          console.warn('Wild sparkles error:', err);
        }
      }
    } else {
      // Smoke trail for regular cubes (not wild) - continuous when dragging
      if (!drag._lastSmokeTime || (now - drag._lastSmokeTime) > 120) { // Every 120ms for smoke trail
        try {
          dragSmokeTrail(board, t, 96, 0.7);
          drag._lastSmokeTime = now;
        } catch (err) {
          console.warn('Smoke trail error:', err);
        }
      }
    }

    // 🔧 SHADOW PATCH: refresh bez gubitka alpha
    if (t.refreshShadow && t.shadow) {
      const __a = t.shadow.alpha;
      t.refreshShadow();
      if (t.shadow) t.shadow.alpha = __a;
    }

    // ažuriraj _lastGlobal za sljedeći frame
    drag._lastGlobal = e.global.clone?.() ?? { x: e.global.x, y: e.global.y };

    const target = pickDropTarget(t); 
    showHover(target);
    updateMagnet(target);
    
    // WILD-MAGNET: Pull 2 nearest tiles while dragging (sequentially and organically)
    if (t.special === 'wild-magnet' && drag.moved) {
      if (!drag.wildMagnetPulledTiles || drag.wildMagnetPulledTiles.length === 0) {
        // Find and pull 2 nearest tiles
        const allTiles = getTiles();
        const targetX = t.x;
        const targetY = t.y;
        
        // Filter: active tiles (not locked, has value, not the dragged tile, not wild/wild-magnet)
        const candidates = allTiles.filter((candidate: any) => {
          if (!candidate || candidate.destroyed) return false;
          if (candidate === t) return false;
          if (candidate.locked) return false;
          if ((candidate.value | 0) <= 0) return false;
          if (candidate.special === 'wild' || candidate.special === 'wild-magnet') return false;
          return true;
        });
        
        // Calculate distances and sort
        const withDistance = candidates.map((candidate: any) => {
          const dx = candidate.x - targetX;
          const dy = candidate.y - targetY;
          const dist = Math.hypot(dx, dy);
          return { tile: candidate, distance: dist };
        });
        
        withDistance.sort((a, b) => a.distance - b.distance);
        
        // Take 2 nearest tiles (random selection from nearest candidates for organic feel)
        const nearestCount = Math.min(4, withDistance.length);
        const randomSelection = withDistance.slice(0, nearestCount)
          .sort(() => Math.random() - 0.5)
          .slice(0, 2)
          .map(item => item.tile);
        
        if (randomSelection.length > 0) {
          drag.wildMagnetPulledTiles = randomSelection;
          drag._wildMagnetPullState = {
            currentIndex: 0,
            pulling: false,
          };
          
          // Store original positions for snap back if needed
          randomSelection.forEach((pulledTile: any) => {
            if (!pulledTile._wildMagnetOriginalX) {
              pulledTile._wildMagnetOriginalX = pulledTile.x;
              pulledTile._wildMagnetOriginalY = pulledTile.y;
            }
            // Initialize pull start time for sequential pulling
            if (!pulledTile._wildMagnetPullStartTime) {
              pulledTile._wildMagnetPullStartTime = null;
            }
          });
          
          // Start pulling first tile immediately
          if (randomSelection.length > 0 && drag._wildMagnetPullState) {
            drag._wildMagnetPullState.currentIndex = 0;
            drag._wildMagnetPullState.pulling = true;
            randomSelection[0]._wildMagnetPullStartTime = now;
          }
        }
      }
      
      // Sequentially pull tiles towards the dragged wild-magnet
      if (drag.wildMagnetPulledTiles && drag.wildMagnetPulledTiles.length > 0 && drag._wildMagnetPullState) {
        const pullState = drag._wildMagnetPullState;
        const delayBetweenPulls = 200; // 200ms delay between pulling each tile
        
        drag.wildMagnetPulledTiles.forEach((pulledTile: any, index: number) => {
          if (!pulledTile || pulledTile.destroyed) return;
          
          // Check if this tile should start pulling
          const shouldStartPull = index === pullState.currentIndex;
          const timeSinceDragStart = drag._wildMagnetDragStartTime ? (now - drag._wildMagnetDragStartTime) : 0;
          
          // Start pulling next tile after delay
          if (index === pullState.currentIndex + 1 && 
              pulledTile._wildMagnetPullStartTime === null &&
              timeSinceDragStart > delayBetweenPulls * index) {
            pulledTile._wildMagnetPullStartTime = now;
            pullState.currentIndex = index;
          }
          
          // Only animate if this tile has started pulling
          if (pulledTile._wildMagnetPullStartTime !== null || (shouldStartPull && index === 0)) {
            // CRITICAL: Ensure pulled tiles are ALWAYS full opacity when being pulled
            // They should look full opacity under the magnet, not transparent
            // Kill ALL alpha tweens immediately and force alpha = 1
            gsap.killTweensOf(pulledTile, 'alpha');
            if (pulledTile.alpha !== undefined && pulledTile.alpha !== 1) {
              pulledTile.alpha = 1;
            }
            // Also ensure visible is true
            if (pulledTile.visible !== undefined && !pulledTile.visible) {
              pulledTile.visible = true;
            }
            
            // Calculate position towards dragged tile
            const dx = t.x - pulledTile.x;
            const dy = t.y - pulledTile.y;
            const dist = Math.hypot(dx, dy);
            
            // Fluid, organic movement with smooth easing
            if (dist > 15) {
              // Use smooth, fluid animation without lag
              const pullStrength = 0.20; // Slightly faster for more responsive feel
              const targetX = pulledTile.x + dx * pullStrength;
              const targetY = pulledTile.y + dy * pullStrength;
              
              // Kill any existing tweens to prevent jittery behavior
              gsap.killTweensOf(pulledTile);
              
              // CRITICAL: Ensure alpha is 1 before animation
              pulledTile.alpha = 1;
              
              // Smooth, fluid animation with bounce feel but no jitter
              // DO NOT animate alpha - keep it at 1 always
              gsap.to(pulledTile, {
                x: targetX,
                y: targetY,
                duration: 0.08, // Shorter duration for more responsive feel
                ease: 'power2.out', // Smooth easing, no jitter
                overwrite: 'auto', // Prevent overlapping tweens
                onUpdate: () => {
                  // CRITICAL: Force alpha to 1 on every update to prevent any transparency
                  if (pulledTile.alpha !== undefined && pulledTile.alpha !== 1) {
                    pulledTile.alpha = 1;
                  }
                }
              });
              
              // Optional: subtle rotation/bounce effect for organic feel
              if (pulledTile.rotG && !pulledTile._wildMagnetRotating) {
                pulledTile._wildMagnetRotating = true;
                const baseRot = pulledTile.rotG.rotation || 0;
                gsap.to(pulledTile.rotG, {
                  rotation: baseRot + (Math.random() - 0.5) * 0.1,
                  duration: 0.3,
                  ease: 'sine.inOut',
                  yoyo: true,
                  repeat: 1,
                  onComplete: () => {
                    pulledTile._wildMagnetRotating = false;
                  }
                });
              }
            }
          }
        });
      }
    } else if (t.special !== 'wild-magnet') {
      // Clear pulled tiles if not wild-magnet - stop all animations and reset positions
      if (drag.wildMagnetPulledTiles) {
        drag.wildMagnetPulledTiles.forEach((pulledTile: any) => {
          if (pulledTile && !pulledTile.destroyed) {
            // Stop all animations
            gsap.killTweensOf(pulledTile);
            gsap.killTweensOf(pulledTile.rotG);
            gsap.killTweensOf(pulledTile.scale);
            
            // Restore original position if available
            if (pulledTile._wildMagnetOriginalX !== undefined && pulledTile._wildMagnetOriginalY !== undefined) {
              gsap.to(pulledTile, {
                x: pulledTile._wildMagnetOriginalX,
                y: pulledTile._wildMagnetOriginalY,
                duration: 0.2,
                ease: 'power2.out'
              });
              pulledTile._wildMagnetOriginalX = undefined;
              pulledTile._wildMagnetOriginalY = undefined;
            }
          }
        });
        drag.wildMagnetPulledTiles = null;
      }
      if (drag._wildMagnetPullState) {
        drag._wildMagnetPullState = null;
      }
    }
    
    // Ghost placeholders are now fixed and don't need redrawing
  }

  function onUp() {
    app.stage.off('pointermove', onMove);
    app.stage.off('pointerup', onUp);
    app.stage.off('pointerupoutside', onUp);

    const t = drag.t;
    console.log('🔍 DRAG END: Tile at', t?.gridX, t?.gridY, 'value:', t?.value, 'locked:', t?.locked);
    drag.t = null;
    
    // Notify idle bounce that drag has ended - start 2-second idle timer
    try {
      TILE_IDLE_BOUNCE.notifyInteraction();
    } catch (error) {
      console.warn('⚠️ Failed to notify board interaction on drag end:', error);
    }
    
    // Clear sparkle timer and interval when drag ends
    if (drag._lastSparkleTime) {
      drag._lastSparkleTime = null;
    }
    if (drag._sparkleInterval) {
      clearInterval(drag._sparkleInterval);
      drag._sparkleInterval = null;
    }
    
    // Clear smoke trail timer when drag ends
    if (drag._lastSmokeTime) {
      drag._lastSmokeTime = null;
    }
    
    // SMART SAVE: Save after every move
    if (typeof window.saveGameState === 'function') {
      try {
        window.saveGameState();
      } catch (err) {
        console.warn('Failed to save game state after move:', err);
      }
    }
    
    // Ghost placeholders are in fixed background layer - always visible, no cleanup needed

    // vrati tilt u nulu s istim “delay” feelom
    if (t?.rotG) {
      gsap.to(t.rotG, { rotation: 0, duration: TILT_DUR, ease: 'power2.out' });
    }

    // 🔧 SHADOW PATCH: vrati na _baseAlpha i sakrij ako je 0
    if (t && !t.destroyed && t.shadow) {
      const base = t.shadow._baseAlpha ?? 0;
      const prev = t.shadow.alpha;
      if (t.refreshShadow) {
        t.refreshShadow();
        if (t.shadow) t.shadow.alpha = prev;
      }
      if (t.shadow?.alpha != null) {
        gsap.to(t.shadow, {
          alpha: base,
          duration: 0.12,
          ease: 'power2.out',
          onComplete: () => { if (t.shadow) t.shadow.visible = (base > 0); }
        });
      }
    }

    if (!t || t.destroyed) { clearHover(); return; }
    if (!drag.moved) { snapBack(t); clearHover(); return; }

    const target = pickDropTarget(t);
    if (!target || !canDrop(t, target)) {
      snapBack(t);            // z-index se vraća u snapBack onComplete
      clearHover();
      return;
    }

    clearHover({ immediateMagnet: true });
    autoCenter(t, target);

    // ✅ Z-INDEX SAFETY PATCH:
    // prije merge animacije vrati pločicu na originalni sloj,
    // da NIKAD ne ostane "ispred" ostalih nakon brzih interakcija
    restoreZ(t);
    
    // CRITICAL: Pass pulled tiles to merge function so they can merge IN THE MIDDLE of main merge animation
    // Pulled tiles will merge AFTER main merge 6 starts, creating a second merge 6 at the same location
    if (t.special === 'wild-magnet' && drag.wildMagnetPulledTiles && drag.wildMagnetPulledTiles.length > 0) {
      console.log('🧲 WILD-MAGNET dropped with', drag.wildMagnetPulledTiles.length, 'pulled tiles');
      console.log('🧲 Target position:', target?.x, target?.y, 'target value:', target?.value);
      console.log('🧲 Pulled tiles:', drag.wildMagnetPulledTiles.map((pt: any) => ({ x: pt?.x, y: pt?.y, value: pt?.value, destroyed: pt?.destroyed })));
      
      // CRITICAL: Stop ALL animations on pulled tiles immediately
      drag.wildMagnetPulledTiles.forEach((pulledTile: any, idx: number) => {
        if (pulledTile && !pulledTile.destroyed) {
          console.log('🧲 Stopping animations for pulled tile', idx, 'at', pulledTile.x, pulledTile.y);
          // Kill all animations immediately, including alpha tweens
          gsap.killTweensOf(pulledTile);
          gsap.killTweensOf(pulledTile.rotG);
          gsap.killTweensOf(pulledTile.scale);
          gsap.killTweensOf(pulledTile, 'alpha');
          
          // CRITICAL: Force full opacity - pulled tiles must be fully opaque
          pulledTile.alpha = 1;
          pulledTile.visible = true;
          
          // Freeze pulled tile in current position
          pulledTile._wildMagnetAffected = true;
          pulledTile._wildMagnetMergeValue = 6;
        }
      });
      
      // CRITICAL: Pass pulled tiles to merge function via helpers AND src tile
      // Make a copy to avoid reference issues
      const pulledTilesCopy = drag.wildMagnetPulledTiles.filter((pt: any) => pt && !pt.destroyed);
      console.log('🧲 Passing', pulledTilesCopy.length, 'valid pulled tiles to merge function');
      
      (helpers as any).wildMagnetPulledTiles = pulledTilesCopy;
      (t as any)._wildMagnetPulledTiles = pulledTilesCopy;
      
      console.log('🧲 Pulled tiles set in helpers:', !!(helpers as any).wildMagnetPulledTiles);
      console.log('🧲 Pulled tiles set in src:', !!(t as any)._wildMagnetPulledTiles);
    } else {
      console.log('⚠️ WILD-MAGNET: No pulled tiles to merge');
      console.log('⚠️ isWildMagnet:', t.special === 'wild-magnet');
      console.log('⚠️ hasPulledTiles:', !!drag.wildMagnetPulledTiles);
      console.log('⚠️ pulledTilesCount:', drag.wildMagnetPulledTiles?.length || 0);
    }
    
    onMerge?.(t, target, helpers);
    
    // CRITICAL: DON'T clear pulled tiles immediately - they need to be available for merge
    // They will be cleared after merge completes in app-merge.ts
    // Only clear pull state, not the tiles array
    drag._wildMagnetPullState = null;
  }

  // === STABLE HIT-TEST: preklapanje pravokutnika, bez auto-aimanja ===
  function pickDropTarget(src) {
    if (!src || src.destroyed) return null;

    const list = (typeof getTiles === 'function' ? getTiles() : []) || [];
    if (!list || !Array.isArray(list)) return null;
    
    const candidates = list.filter(t =>
      t &&
      !t.destroyed &&
      t !== src &&
      !t.locked &&
      (t.value | 0) > 0
    );

    if (!candidates.length) return null;

    const srcR = getRect(src);
    if (!srcR || srcR.w === 0 || srcR.h === 0) return null;
    
    let best = null;
    let bestRatio = 0;

    for (const t of candidates) {
      if (!t || t.destroyed) continue;
      if (typeof canDrop === 'function' && !canDrop(src, t)) continue;
      const dstR = getRect(t);
      if (!dstR || dstR.w === 0 || dstR.h === 0) continue;
      const r = intersectRatio(srcR, dstR);
      if (r > bestRatio) { bestRatio = r; best = t; }
    }

    const th = Number.isFinite(drag.threshold) ? drag.threshold : 0.05;
    return (best && bestRatio >= th) ? best : null;
  }

  function releaseMagnet(opts = {}) {
    const state = drag.magnet;
    const target = state.target;
    if (!target) return;

    const container = state.container;
    const immediate = !!opts.immediate;

    const homeX = target?._magnetHomeX ?? target?.targetX ?? state.originX ?? target?.x ?? 0;
    const homeY = target?._magnetHomeY ?? target?.targetY ?? state.originY ?? target?.y ?? 0;

    try { state.moveTween?.kill?.(); } catch {}
    try { state.scaleTween?.kill?.(); } catch {}

    if (!target.destroyed) {
      if (immediate) {
        target.x = homeX;
        target.y = homeY;
      } else {
        state.moveTween = gsap.to(target, {
          x: homeX,
          y: homeY,
          duration: MAGNET_RETURN_DUR,
          ease: 'sine.inOut',
          overwrite: 'auto'
        });
      }
    }

    if (container && !container.destroyed && container.scale) {
      const baseScaleX = container._magnetBaseScaleX ?? state.originScaleX ?? container.scale.x ?? 1;
      const baseScaleY = container._magnetBaseScaleY ?? state.originScaleY ?? container.scale.y ?? 1;
      if (immediate) {
        container.scale.set(baseScaleX, baseScaleY);
      } else {
        state.scaleTween = gsap.to(container.scale, {
          x: baseScaleX,
          y: baseScaleY,
          duration: MAGNET_RETURN_DUR,
          ease: 'sine.inOut',
          overwrite: 'auto'
        });
      }
    }

    state.target = null;
    state.container = null;
    state.moveTween = null;
    state.scaleTween = null;
    state.originX = 0;
    state.originY = 0;
    state.originScaleX = 1;
    state.originScaleY = 1;
  }

  function updateMagnet(target) {
    const src = drag.t;
    if (!src || src.destroyed) {
      releaseMagnet({ immediate: true });
      return;
    }

    if (!target || target.destroyed) {
      releaseMagnet();
      return;
    }

    const state = drag.magnet;

    if (state.target !== target) {
      releaseMagnet();

      const container = target.rotG || target;
      state.target = target;
      state.container = container;
      const homeX = Number.isFinite(target.targetX) ? target.targetX : target.x;
      const homeY = Number.isFinite(target.targetY) ? target.targetY : target.y;
      target._magnetHomeX = homeX;
      target._magnetHomeY = homeY;
      state.originX = homeX;
      state.originY = homeY;
      const baseScaleX = container?._magnetBaseScaleX ?? container?.scale?.x ?? 1;
      const baseScaleY = container?._magnetBaseScaleY ?? container?.scale?.y ?? 1;
      container._magnetBaseScaleX = baseScaleX;
      container._magnetBaseScaleY = baseScaleY;
      state.originScaleX = baseScaleX;
      state.originScaleY = baseScaleY;

      if (container && container.scale) {
        try { state.scaleTween?.kill?.(); } catch {}
        state.scaleTween = gsap.to(container.scale, {
          x: baseScaleX * MAGNET_SCALE_MULT,
          y: baseScaleY * MAGNET_SCALE_MULT,
          duration: MAGNET_IN_DUR,
          ease: 'back.out(2)',
          overwrite: 'auto'
        });
      }
    }

    if (state.target !== target) return;

    const originX = state.originX;
    const originY = state.originY;
    const maxOffset = Math.max(0, tileSize * MAGNET_OFFSET_RATIO);
    const dx = src.x - originX;
    const dy = src.y - originY;

    let offsetX = 0;
    let offsetY = 0;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.0001) {
      const ratio = Math.min(maxOffset, dist) / dist;
      offsetX = dx * ratio;
      offsetY = dy * ratio;
    }

    const destX = originX + Math.max(-maxOffset, Math.min(maxOffset, offsetX));
    const destY = originY + Math.max(-maxOffset, Math.min(maxOffset, offsetY));

    try { state.moveTween?.kill?.(); } catch {}
    if (!target.destroyed) {
      state.moveTween = gsap.to(target, {
        x: destX,
        y: destY,
        duration: MAGNET_MOVE_DUR,
        ease: 'sine.out',
        overwrite: 'auto'
      });
    }
  }

  function autoCenter(src, dst) {
    if (!src || src.destroyed || !dst || dst.destroyed) return;

    const destX = dst.x;
    const destY = dst.y;

    gsap.to(src, {
      x: destX,
      y: destY,
      duration: 0.08,
      ease: 'sine.out',
      overwrite: 'auto'
    });

    if (src.scale) {
      gsap.to(src.scale, {
        x: 1,
        y: 1,
        duration: 0.08,
        ease: 'sine.out',
        overwrite: 'auto'
      });
    }
  }

  function getRect(d) {
    if (!d || d.destroyed) return { x: 0, y: 0, w: 0, h: 0 };
    const b = d.getBounds?.(true) || { x: d.x, y: d.y, width: d.width || 128, height: d.height || 128 };
    return { x: b.x || 0, y: b.y || 0, w: b.width || 128, h: b.height || 128 };
  }
  function intersectRatio(a, b) {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.w, b.x + b.w);
    const y2 = Math.min(a.y + a.h, b.y + b.h);
    const w = Math.max(0, x2 - x1);
    const h = Math.max(0, y2 - y1);
    const inter = w * h;
    return inter > 0 ? inter / (b.w * b.h) : 0;
  }

  function showHover(target) {
    if (!target) {
      clearHover();
      return;
    }

    const src = drag.t;
    if (!isHoverValid(src, target)) {
      clearHover();
      return;
    }
    if (drag.hoverTarget === target) return;

    clearHover();

    const container = target.rotG || target;
    const frame = new Container();
    container.addChild(frame);

    const pad = 3;
    const w = tileSize - pad * 2;
    const r = Math.round(tileSize * 0.26); 
    const strokeW = hoverWidth;

    const xTL = -tileSize / 2 + pad;
    const yTL = -tileSize / 2 + pad;

    const ring = new Graphics();
    ring.roundRect(xTL, yTL, w, w, r).stroke({ color: hoverColor, width: strokeW, alpha: hoverAlpha });
    
    // CRITICAL: Set higher zIndex so hover doesn't interfere with ghost placeholders
    frame.zIndex = 1000;

    frame.addChild(ring);

    drag.hoverTarget = target;
    drag.hoverFrame = frame;
  }

  function isHoverValid(src, target) {
    if (!src || !target) return false;
    
    // CRITICAL: Don't show hover on empty slots (ghost placeholders)
    // Only show hover on tiles with actual values
    if ((target.value|0) <= 0) return false;
    
    const srcSpecial = src.special;
    const targetSpecial = target.special;
    if (srcSpecial === 'wild' || targetSpecial === 'wild') return true;

    const srcVal = Number(src.value) || 0;
    const targetVal = Number(target.value) || 0;
    return srcVal + targetVal <= 6;
  }

  function clearHover(opts = {}) {
    releaseMagnet({ immediate: !!opts.immediateMagnet });
    if (drag.hoverFrame) {
      try {
        if (drag.hoverFrame.parent) drag.hoverFrame.parent.removeChild(drag.hoverFrame);
        drag.hoverFrame.destroy({ children: true });
      } catch {}
    }
    drag.hoverFrame = null;
    drag.hoverTarget = null;
  }

  function restoreGridCell(t) {
    // Restore tile to grid when drag ends
    if (cfg.getGrid && t) {
      const grid = cfg.getGrid();
      if (grid && grid[drag.startGY]) {
        grid[drag.startGY][drag.startGX] = t;
        console.log('🎯 DRAG END: Restored tile to grid at', drag.startGX, drag.startGY);
        
        // Update ghost visibility to hide placeholder at tile position
        if (typeof window.updateGhostVisibility === 'function') {
          window.updateGhostVisibility();
        }
      }
    }
  }

  function snapBack(t) {
    console.log('🔍 SNAPBACK: Tile at', t?.gridX, t?.gridY, 'value:', t?.value, 'locked:', t?.locked);
    releaseMagnet({ immediate: true });
    restoreGridCell(t); // Restore to grid before snapping back
    
    // Ghost placeholders are now fixed and always visible
    
    gsap.timeline({
      onComplete: () => { restoreZ(t); }   // ✅ vrati sloj nakon bounce-a
    })
      .to(t, { x: drag.startX + 9, y: drag.startY, rotation: 0.06, duration: 0.06 })
      .to(t, { x: drag.startX - 9, y: drag.startY, rotation: -0.06, duration: 0.08 })
      .to(t, { x: drag.startX, y: drag.startY, rotation: 0, duration: 0.10 })
      .to(t.scale, { x: 1, y: 1, duration: 0.10 }, '<')
      .add(() => {
        // 🔧 SHADOW PATCH: vrati sjenu i sakrij ako je baza 0
        if (t.shadow) {
          const base = t.shadow._baseAlpha ?? 0;
          gsap.to(t.shadow, {
            alpha: base,
            duration: 0.12,
            ease: 'power2.out',
            onComplete: () => { if (t.shadow) t.shadow.visible = (base > 0); }
          });
        }
      });
  }

  return { bindToTile, clearHover, snapBack }; 
}
