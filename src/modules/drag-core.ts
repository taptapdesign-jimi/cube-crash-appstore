// src/modules/drag.js
// v1.3 STABLE drag (PIXI v8 + GSAP)
// - Hover okvir na target.rotG (ako postoji).
// - Drop SAMO kad je pointer unutar ciljne pločice (world-space getBounds()).
// - NEMA nearest auto-aimanja; u suprotnom ide snapBack.
// - GSAP guardovi ostaju za sigurnost.

import { Graphics, Container, Sprite, Texture } from 'pixi.js';
import { gsap } from 'gsap';
import { magicSparklesAtTile, dragSmokeTrail, isWildBeerExplosionRunning, cleanupWildBeerExplosion } from './fx.js';
import { TILE_IDLE_BOUNCE } from './tile-idle-bounce.ts';


// --- Inercijski tilt parametri (nagib SUPROTNO od smjera + lag) ---------------
const TILT_MAX_RAD = 0.22;   // maksimalna rotacija (~12.6°)
const TILT_SCALE   = 18;     // skala pretvorbe brzine → rotacija
const VEL_SMOOTH   = 0.10;   // sporije prihvaća promjenu brzine (teži osjećaj)
const ROT_SMOOTH   = 0.08;   // sporije naginje prema cilju (teži osjećaj)
const POS_LAG_PX   = 6;      // maksimalni parallax pomak (px)
const TILT_DUR     = 0.5;    // zadržano za release tween na onUp
const BOARD_WOBBLE_ENABLED = true; // 🔥 USER REQUEST: Disabled for wild-beer drag (may use later) - kept constant for future use

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
    _lastSparkleTime: null as any,
    _sparkleInterval: null as any,
    _lastSmokeTime: null as any,
    _boardWobbleActive: false,
    _boardBaseX: board?.x ?? 0,
    _boardBaseY: board?.y ?? 0,
    _boardBaseRot: board?.rotation ?? 0,
    _boardPivotX: board?.pivot?.x ?? 0,
    _boardPivotY: board?.pivot?.y ?? 0,
    _boardCenterX: board ? board.x : 0,
    _boardCenterY: board ? board.y : 0,
    _boardPivotApplied: false,
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
    // If null/undefined passed, clear current drag target and listeners safely
    if (!t) {
      if (drag.t && drag.t.removeAllListeners) {
        try { drag.t.removeAllListeners('pointerdown'); } catch {}
      }
      drag.t = null;
      return;
    }

    t.removeAllListeners?.('pointerdown');
    t.eventMode = 'static';
    t.cursor = 'pointer';
    t.on('pointerdown', (e) => onDown(e, t));
  }

  function onDown(e, t) {
    // 🧲 MAGNETIC REACTION: No need to store original positions
    // updateMagnet function handles gentle pull automatically (same as wild tile)
    // No custom pull effect needed - updateMagnet provides the same gentle effect
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
    // Remember board baseline and enable wobble only for beer wild
    drag._boardBaseX = board?.x ?? 0;
    drag._boardBaseY = board?.y ?? 0;
    drag._boardBaseRot = board?.rotation ?? 0;
    drag._boardCenterX = board ? board.x : 0;
    drag._boardCenterY = board ? board.y : 0;
    drag._boardPivotX = board?.pivot?.x ?? 0;
    drag._boardPivotY = board?.pivot?.y ?? 0;
    // 🔥 USER REQUEST: Board wobble disabled for wild-beer drag (may use later)
    // drag._boardWobbleActive = t.special === 'wild-beer';
    drag._boardWobbleActive = false; // Disabled - commented out for future use
    drag._boardPivotApplied = false;

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

    // 🔥 FPS DROP FIX: Stop wild beer idle bubbles when dragging starts (prevents conflict with drag particles)
    if (t.special === 'wild-beer') {
      try {
        // Import stopWildBeerBubbles dynamically to avoid circular dependency
        import('./fx.js').then(fxModule => {
          if (fxModule && typeof fxModule.stopWildBeerBubbles === 'function') {
            fxModule.stopWildBeerBubbles(t);
            console.log('🧹 Stopped wild beer idle bubbles on drag start');
          }
        }).catch(err => {
          console.warn('⚠️ Failed to stop wild beer bubbles on drag start:', err);
        });
      } catch (err) {
        console.warn('⚠️ Error stopping wild beer bubbles on drag start:', err);
      }
    }

    // Start sparkles immediately when wild cube is picked up
    if (t.special === 'wild' || t.special === 'wild-beer') {
      try {
        // 🔥 CRITICAL: Set z-index to be BELOW dragged tile (tile is at 9999, particles should be at 9998)
        // This ensures particles appear behind the wild tile when dragging
        const tileZ = t?.zIndex ?? 0;
        const particlesZ = tileZ > 9000 ? tileZ - 1 : tileZ - 0.001; // Behind dragged tile
        // 🔥 USER REQUEST: Wild beer uses same intensity as wild star (1.0) for consistent smoke trail
        magicSparklesAtTile(board, t, { intensity: 1.0, zIndex: particlesZ });
        drag._lastSparkleTime = drag.lastTime;
        
        // 🔥 FPS DROP FIX: Optimize drag particles interval based on drag speed (prevent comet trails)
        // Use velocity-based throttling to reduce particles when dragging fast
        drag._sparkleInterval = setInterval(() => {
          if (drag.t && (drag.t.special === 'wild' || drag.t.special === 'wild-beer') && !drag.t.destroyed) {
            try {
              // 🔥 FPS DROP FIX: Calculate drag speed and reduce particles if dragging fast
              const dragSpeed = Math.hypot(drag.vx || 0, drag.vy || 0);
              const speedFactor = dragSpeed > 5 ? 0.6 : 1.0; // Reduce intensity by 40% if dragging fast (>5px/frame)
              
              // 🔥 CRITICAL: Set z-index to be BELOW dragged tile
              const tileZ = drag.t?.zIndex ?? 0;
              const particlesZ = tileZ > 9000 ? tileZ - 1 : tileZ - 0.001; // Behind dragged tile
              // 🔥 FPS DROP FIX: Reduce intensity when dragging fast to prevent comet trails
              magicSparklesAtTile(board, drag.t, { intensity: 1.0 * speedFactor, zIndex: particlesZ });
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
        }, 250); // Same interval as before (250ms for smooth performance)
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
    
    // 🔥 USER REQUEST: Board wobble disabled for wild-beer drag (may use later)
    // Board wobble: subtle parallax for wild-beer drag (disabled during bubbles animation)
    /*
    if (BOARD_WOBBLE_ENABLED) {
      // 🔥 CRITICAL: Disable board wobble when bubbles animation is active to prevent conflicts
      if (drag._boardWobbleActive && board && !isWildBeerExplosionRunning()) {
        const smooth = 0.16;
        const curShiftX = (board.x ?? 0) - drag._boardBaseX;
        const curShiftY = (board.y ?? 0) - drag._boardBaseY;
        const targetShiftX = Math.max(-12.6, Math.min(12.6, -drag.vx * 252)); // +50% stronger
        const targetShiftY = Math.max(-12.6, Math.min(12.6, -drag.vy * 252)); // +50% stronger
        const nextShiftX = curShiftX + (targetShiftX - curShiftX) * smooth;
        const nextShiftY = curShiftY + (targetShiftY - curShiftY) * smooth;
        board.x = drag._boardBaseX + nextShiftX;
        board.y = drag._boardBaseY + nextShiftY;
      }
    }
    */

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
    // 🔥 CRITICAL: wild-beer does NOT get sparkles, only bubbles (handled in else block)
    if (t.special === 'wild') {
      // Store velocity for sparkles direction
      t._lastVelX = drag.vx;
      t._lastVelY = drag.vy;
      
      // Continuous sparkles when wild cube is picked up (whether moving or not)
      if (!drag._lastSparkleTime || (now - drag._lastSparkleTime) > 100) { // Every 100ms for continuous effect
        try {
          // 🔥 CRITICAL: Set z-index to be BELOW dragged tile (tile is at 9999, particles should be at 9998)
          // This ensures particles appear behind the wild tile when dragging
          const tileZ = t?.zIndex ?? 0;
          const particlesZ = tileZ > 9000 ? tileZ - 1 : tileZ - 0.001; // Behind dragged tile
          magicSparklesAtTile(board, t, { intensity: 1.0, zIndex: particlesZ });
          drag._lastSparkleTime = now;
        } catch (err) {
          console.warn('Wild sparkles error:', err);
        }
      }
    } else if (t.special === 'wild-magnet') {
      // Wild-magnet sparkles effect (same as wild)
      t._lastVelX = drag.vx;
      t._lastVelY = drag.vy;
      
      // Continuous sparkles when wild-magnet is picked up
      if (!drag._lastSparkleTime || (now - drag._lastSparkleTime) > 100) {
        try {
          // 🔥 CRITICAL: Set z-index to be BELOW dragged tile (tile is at 9999, particles should be at 9998)
          // This ensures particles appear behind the magnet when dragging
          const tileZ = t?.zIndex ?? 0;
          const particlesZ = tileZ > 9000 ? tileZ - 1 : tileZ - 0.001; // Behind dragged tile
          magicSparklesAtTile(board, t, { intensity: 1.0, zIndex: particlesZ });
          drag._lastSparkleTime = now;
        } catch (err) {
          console.warn('Wild-magnet sparkles error:', err);
        }
      }
      
      // 🧲 MAGNETIC REACTION: Use same gentle pull as wild tile (via updateMagnet)
      // The updateMagnet function is already called below for the target tile
      // This provides the same gentle magnetic pull effect as wild tiles
      // No need for custom strong pull - updateMagnet handles it perfectly
    } else {
      // Trails: beer wild gets bubbles; others get smoke
      if (!drag._lastSmokeTime || (now - drag._lastSmokeTime) > 120) { // Every 120ms
        try {
          // 🔥 CRITICAL: Set z-index to be BELOW dragged tile (tile is at 9999, particles should be at 9998)
          // This ensures particles appear behind the tile when dragging
          const tileZ = t?.zIndex ?? 0;
          const particlesZ = tileZ > 9000 ? tileZ - 1 : tileZ - 0.001; // Behind dragged tile
          
          // 🔥 USER REQUEST: Wild beer uses same particles as wild star (no bubbles, only magicSparklesAtTile)
          // Removed dragBeerBubbleTrail - wild beer now uses only magicSparklesAtTile particles like wild star
          if (t.special !== 'wild-beer' && t.special !== 'wild') {
            // Only non-wild tiles use dragSmokeTrail
            dragSmokeTrail(board, t, 96, 0.7, { zIndex: particlesZ });
          }
          // Wild and wild-beer use only magicSparklesAtTile (no additional bubbles or smoke)
          drag._lastSmokeTime = now;
        } catch (err) {
          console.warn('Trail error:', err);
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
    
    // 🔥 NOTE: Bubbles animation is now triggered in onUp() when wild-beer is dropped on regular tile (merge 6)
    // This ensures bubbles start exactly when merge 6 happens, not when drag starts 
    
    // 🧲 MAGNETIC REACTION: For wild-magnet, apply gentle pull to ALL nearby tiles (like wild tile)
    // This provides the same gentle magnetic pull effect as wild tiles for all tiles in range
    if (t.special === 'wild-magnet') {
      const allTiles = typeof getTiles === 'function' ? getTiles() : [];
      const magnetX = t.x;
      const magnetY = t.y;
      const magnetRange = tileSize * 1.5; // Magnet affects tiles within 1.5 tiles
      const selectionRange = tileSize * 1.2; // Show selection if magnet is within 1.2 tiles
      const hoverRange = tileSize * 1.5; // Show hover effect if magnet is within 1.5 tiles
      
      // Track best hover target (closest valid tile)
      let bestHoverTarget = null;
      let bestHoverDistance = Infinity;
      
      allTiles.forEach((otherTile: any) => {
        if (!otherTile || otherTile.destroyed) return;
        if (otherTile === t) return; // Skip the magnet itself
        if (otherTile.locked) return;
        if ((otherTile.value | 0) <= 0) return;
        if (otherTile.special === 'wild' || otherTile.special === 'wild-magnet' || otherTile.special === 'wild-beer') return; // Skip wild tiles
        if (otherTile._wildMagnetAffected) return; // Skip tiles that are already being pulled by magnet merge
        
        // Calculate distance from magnet to tile
        const dxToMagnet = magnetX - otherTile.x;
        const dyToMagnet = magnetY - otherTile.y;
        const distToMagnet = Math.hypot(dxToMagnet, dyToMagnet);
        
        // Apply gentle magnetic pull to all tiles in range (same as wild tile)
        if (distToMagnet < magnetRange) {
          // 🔥 CRITICAL: Each tile gets its own magnet state (stored on the tile itself)
          // This allows multiple tiles to be affected simultaneously
          if (!otherTile._magnetState) {
            // Initialize magnet state for this tile
            const container = otherTile.rotG || otherTile;
            const homeX = Number.isFinite(otherTile.targetX) ? otherTile.targetX : otherTile.x;
            const homeY = Number.isFinite(otherTile.targetY) ? otherTile.targetY : otherTile.y;
            otherTile._magnetHomeX = homeX;
            otherTile._magnetHomeY = homeY;
            otherTile._magnetState = {
              target: otherTile,
              container: container,
              originX: homeX,
              originY: homeY,
              originScaleX: container?.scale?.x ?? 1,
              originScaleY: container?.scale?.y ?? 1,
              moveTween: null,
              scaleTween: null,
            };
            
            // Store base scale
            if (container && !container._magnetBaseScaleX) {
              container._magnetBaseScaleX = container.scale?.x ?? 1;
              container._magnetBaseScaleY = container.scale?.y ?? 1;
            }
            
            // Scale up effect
            if (container && container.scale) {
              try { otherTile._magnetState.scaleTween?.kill(); } catch {}
              otherTile._magnetState.scaleTween = gsap.to(container.scale, {
                x: otherTile._magnetState.originScaleX * MAGNET_SCALE_MULT,
                y: otherTile._magnetState.originScaleY * MAGNET_SCALE_MULT,
                duration: MAGNET_IN_DUR,
                ease: 'back.out(2)',
                overwrite: 'auto'
              });
            }
          }
          
          // Update position (gentle pull towards magnet)
          const state = otherTile._magnetState;
          const originX = state.originX;
          const originY = state.originY;
          const maxOffset = Math.max(0, tileSize * MAGNET_OFFSET_RATIO);
          const dxToOrigin = magnetX - originX;
          const dyToOrigin = magnetY - originY;
          const distToOrigin = Math.hypot(dxToOrigin, dyToOrigin);
          
          let offsetX = 0;
          let offsetY = 0;
          if (distToOrigin > 0.0001) {
            const ratio = Math.min(maxOffset, distToOrigin) / distToOrigin;
            offsetX = dxToOrigin * ratio;
            offsetY = dyToOrigin * ratio;
          }
          
          const destX = originX + Math.max(-maxOffset, Math.min(maxOffset, offsetX));
          const destY = originY + Math.max(-maxOffset, Math.min(maxOffset, offsetY));
          
          try { state.moveTween?.kill(); } catch {}
          if (!otherTile.destroyed) {
            state.moveTween = gsap.to(otherTile, {
              x: destX,
              y: destY,
              duration: MAGNET_MOVE_DUR,
              ease: 'sine.out',
              overwrite: 'auto'
            });
          }
        } else {
          // Out of range - release magnet effect for this tile
          if (otherTile._magnetState) {
            const state = otherTile._magnetState;
            const homeX = otherTile._magnetHomeX ?? state.originX ?? otherTile.x;
            const homeY = otherTile._magnetHomeY ?? state.originY ?? otherTile.y;
            
            try { state.moveTween?.kill(); } catch {}
            try { state.scaleTween?.kill(); } catch {}
            
            if (!otherTile.destroyed) {
              state.moveTween = gsap.to(otherTile, {
                x: homeX,
                y: homeY,
                duration: MAGNET_RETURN_DUR,
                ease: 'sine.inOut',
                overwrite: 'auto',
                onComplete: () => {
                  // Clean up state when returned
                  otherTile._magnetState = null;
                  otherTile._magnetHomeX = undefined;
                  otherTile._magnetHomeY = undefined;
                }
              });
              
              if (state.container && state.container.scale) {
                state.scaleTween = gsap.to(state.container.scale, {
                  x: state.originScaleX,
                  y: state.originScaleY,
                  duration: MAGNET_RETURN_DUR,
                  ease: 'sine.inOut',
                  overwrite: 'auto'
                });
              }
            }
          }
        }
        
        // Show selection animation if magnet is close (like wild tile selection)
        if (distToMagnet < selectionRange) {
          // Only show selection if not already showing or if magnet just entered range
          if (!otherTile._magnetSelected || (now - (otherTile._magnetSelectedTime || 0)) > 150) {
            try {
              magicSparklesAtTile(board, otherTile, { intensity: 0.6 }); // Lighter intensity for nearby tiles
              otherTile._magnetSelected = true;
              otherTile._magnetSelectedTime = now;
            } catch (err) {
              console.warn('Magnetic selection sparkles error:', err);
            }
          }
        } else {
          // Out of range - clear selection flag
          otherTile._magnetSelected = false;
        }
        
        // 🔥 CRITICAL: Track best hover target for wild-magnet (closest valid tile)
        // Show hover effect (brown border) on the closest valid tile
        if (distToMagnet < hoverRange && isHoverValid(t, otherTile)) {
          if (distToMagnet < bestHoverDistance) {
            bestHoverDistance = distToMagnet;
            bestHoverTarget = otherTile;
          }
        }
      });
      
      // Show hover effect on the best target (closest valid tile)
      // For wild-magnet, we use bestHoverTarget instead of pickDropTarget result
      // because pickDropTarget is too strict (requires direct overlap)
      if (bestHoverTarget && bestHoverTarget !== drag.hoverTarget) {
        showHover(bestHoverTarget);
      } else if (!bestHoverTarget && drag.hoverTarget) {
        // No valid hover target, clear hover
        clearHover();
      }
      
      // Also update magnet effect for the best hover target
      if (bestHoverTarget) {
        updateMagnet(bestHoverTarget);
      }
    } else {
      // For non-wild-magnet tiles, use normal hover logic
      showHover(target);
      updateMagnet(target);
    }
    
    // Ghost placeholders are now fixed and don't need redrawing
  }

  function onUp() {
    app.stage.off('pointermove', onMove);
    app.stage.off('pointerup', onUp);
    app.stage.off('pointerupoutside', onUp);

    const t = drag.t;
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
    // 🔥 USER REQUEST: Board wobble disabled for wild-beer drag (may use later)
    // Stop board wobble and reset when drag ends
    /*
    if (drag._boardWobbleActive && board) {
      drag._boardWobbleActive = false;
      gsap.to(board, {
        rotation: drag._boardBaseRot,
        x: drag._boardBaseX,
        y: drag._boardBaseY,
        duration: 0.18,
        ease: 'power2.out'
      });
    }
    */
    
    // 🧲 MAGNETIC REACTION: Return all tiles with magnet effect to original positions
    if (t?.special === 'wild-magnet') {
      const allTiles = typeof getTiles === 'function' ? getTiles() : [];
      allTiles.forEach((otherTile: any) => {
        if (!otherTile || otherTile.destroyed) return;
        if (!otherTile._magnetState) return; // No magnet effect on this tile
        
        const state = otherTile._magnetState;
        const homeX = otherTile._magnetHomeX ?? state.originX ?? otherTile.x;
        const homeY = otherTile._magnetHomeY ?? state.originY ?? otherTile.y;
        
        try { state.moveTween?.kill(); } catch {}
        try { state.scaleTween?.kill(); } catch {}
        
        if (!otherTile.destroyed) {
          state.moveTween = gsap.to(otherTile, {
            x: homeX,
            y: homeY,
            duration: MAGNET_RETURN_DUR,
            ease: 'sine.inOut',
            overwrite: 'auto',
            onComplete: () => {
              // Clean up state when returned
              otherTile._magnetState = null;
              otherTile._magnetHomeX = undefined;
              otherTile._magnetHomeY = undefined;
            }
          });
          
          if (state.container && state.container.scale) {
            state.scaleTween = gsap.to(state.container.scale, {
              x: state.originScaleX,
              y: state.originScaleY,
              duration: MAGNET_RETURN_DUR,
              ease: 'sine.inOut',
              overwrite: 'auto'
            });
          }
        }
      });
    }
    
    // Also release main magnet target (for the primary target from pickDropTarget)
    releaseMagnet({ immediate: true });
    
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
    
    if (!target) {
      snapBack(t);
      clearHover();
      return;
    }
    
    // CRITICAL: Check if target is valid (not ghost placeholder, not locked, has value > 0)
    // Also check if target is actually in tiles list (not a ghost placeholder)
    const isValidTarget = !target.destroyed && 
                          !target.locked && 
                          (target.value | 0) > 0 &&
                          typeof getTiles === 'function' && 
                          getTiles().includes(target); // Make sure target is in actual tiles list
    
    // CRITICAL: Only call canDrop if target is valid
    // If target is invalid, canMerge is false
    const canMerge = isValidTarget && canDrop(t, target);
    
    if (!canMerge) {
      snapBack(t);
      clearHover();
      
      // 🔥 CRITICAL: Check stuck state after failed merge attempt
      // This catches cases where user tries to merge but can't (e.g., 3+2=5 which is invalid)
      // We need to check if the board is now stuck after this failed attempt
      if (typeof (window as any).CC?.checkLevelEnd === 'function') {
        // Use setTimeout to ensure snapBack animation completes first
        setTimeout(() => {
          (window as any).CC.checkLevelEnd();
        }, 100);
      }
      return;
    }

    clearHover({ immediateMagnet: true });
    autoCenter(t, target);

    // ✅ Z-INDEX SAFETY PATCH:
    // prije merge animacije vrati pločicu na originalni sloj,
    // da NIKAD ne ostane "ispred" ostalih nakon brzih interakcija
    restoreZ(t);
    
    // Wild-beer bubbles explosion is triggered centrally in app-core effSum === 6 flow.
    
    onMerge?.(t, target, helpers);
  }

  // === STABLE HIT-TEST: preklapanje pravokutnika, bez auto-aimanja ===
  // 🔥 PERFORMANCE: Throttle pickDropTarget to prevent lag
  let lastPickDropTime = 0;
  const PICK_DROP_THROTTLE = 16; // ~60fps max (16ms between calls)
  let lastPickDropResult = null;
  let lastPickDropSrc = null;
  
  function pickDropTarget(src) {
    // 🔥 PERFORMANCE: Throttle pickDropTarget calls to prevent lag
    const now = performance.now();
    if (src === lastPickDropSrc && now - lastPickDropTime < PICK_DROP_THROTTLE) {
      return lastPickDropResult; // Return cached result if called too soon
    }
    lastPickDropTime = now;
    lastPickDropSrc = src;
    if (!src || src.destroyed) return null;

    const list = (typeof getTiles === 'function' ? getTiles() : []) || [];
    if (!list || !Array.isArray(list)) return null;
    
    // CRITICAL: Filter out ghost placeholders and invalid tiles
    // Only include actual tiles with value > 0, not locked, and in tiles list
    const candidates = list.filter(t => {
      if (!t || t.destroyed) return false;
      if (t === src) return false;
      if (t.locked) return false;
      if ((t.value | 0) <= 0) return false;
      // CRITICAL: Make sure tile has gridX and gridY (real tiles have grid positions)
      if (typeof t.gridX !== 'number' || typeof t.gridY !== 'number') return false;
      // CRITICAL: Make sure tile is in tiles list (not a ghost placeholder)
      if (!list.includes(t)) return false;
      return true;
    });

    if (!candidates.length) return null;

    const srcR = getRect(src);
    if (!srcR || srcR.w === 0 || srcR.h === 0) return null;
    
    let best = null;
    let bestRatio = 0;

    for (const t of candidates) {
      if (!t || t.destroyed) continue;
      // CRITICAL: Double-check canDrop before considering this tile
      if (typeof canDrop === 'function' && !canDrop(src, t)) continue;
      // CRITICAL: Make sure tile is still valid before checking intersection
      if (t.locked || (t.value | 0) <= 0) continue;
      const dstR = getRect(t);
      if (!dstR || dstR.w === 0 || dstR.h === 0) continue;
      
      // 🔥 CRITICAL NEW LOGIC: For wild-magnet, magnet MUST be DIRECTLY above target tile
      // This prevents merge when pulled tiles are close but magnet is far from target
      if (src.special === 'wild-magnet') {
        const srcCenterX = srcR.x + srcR.w / 2;
        const srcCenterY = srcR.y + srcR.h / 2;
        const dstCenterX = dstR.x + dstR.w / 2;
        const dstCenterY = dstR.y + dstR.h / 2;
        
        // 🔥 CRITICAL: For wild-magnet, check if magnet is above target tile center
        // Use reasonable limits - magnet must be close to tile center (20% tolerance for better usability)
        const dx = Math.abs(srcCenterX - dstCenterX);
        const dy = Math.abs(srcCenterY - dstCenterY);
        const maxOffset = tileSize * 0.20; // 🔥 Max 20% offset - More forgiving for better usability
        
        // 🔥 CRITICAL: For wild-magnet, we ONLY allow merge if magnet is directly above target
        // Ignore overlap completely - only check position
        if (dx > maxOffset || dy > maxOffset) {
          // 🔥 PERFORMANCE: Removed console.log to prevent lag
          // console.log('🔍 pickDropTarget: Wild-magnet NOT directly above tile:', { ... });
          continue; // Skip this tile - magnet is not directly above it
        }
        
        // 🔥 For wild-magnet, if position is OK, calculate overlap and use it
        const r = intersectRatio(srcR, dstR);
        if (r > bestRatio) { bestRatio = r; best = t; }
      } else {
        // For non-wild-magnet, calculate overlap normally
        const r = intersectRatio(srcR, dstR);
        if (r > bestRatio) { bestRatio = r; best = t; }
      }
    }

    // 🔥 CRITICAL: For wild-magnet, use reasonable threshold to balance usability and prevent accidental merges
    // Regular threshold is 0.05, but for wild-magnet we want at least 0.30 overlap (30% of tile)
    // Since we already check position (20% offset), overlap threshold can be more forgiving
    const baseThreshold = Number.isFinite(drag.threshold) ? drag.threshold : 0.05;
    const th = src.special === 'wild-magnet' ? Math.max(baseThreshold, 0.30) : baseThreshold; // 🔥 Reduced to 0.30 for better usability
    
    // 🔥 CRITICAL: For wild-magnet, if no tile passed position check, result is ALWAYS null
    // This ensures that if magnet is not directly above any tile, no merge happens
    const result = (best && bestRatio >= th) ? best : null;
    
    // 🔥 PERFORMANCE: Removed console.log to prevent lag (too many calls per second)
    // console.log('🔍 pickDropTarget threshold check:', { ... });
    
    // 🔥 PERFORMANCE: Removed console.log to prevent lag
    // 🔥 CRITICAL: For wild-magnet, log if no result found
    if (src.special === 'wild-magnet' && !result) {
      // console.log('🔍 pickDropTarget: No valid target found for wild-magnet');
      if (best) {
        // console.log('🔍 pickDropTarget: Best tile found but did not pass threshold:', {
        //   bestValue: best.value,
        //   bestRatio,
        //   threshold: th,
        //   passed: bestRatio >= th
        // });
      } else {
        // 🔥 PERFORMANCE: Removed console.log to prevent lag
        // console.log('🔍 pickDropTarget: No best tile found (position check failed for all tiles)');
      }
    }
    
    // CRITICAL: Final validation before returning
    if (result) {
      // Make sure result is valid tile
      if (result.destroyed || result.locked || (result.value | 0) <= 0) {
        console.warn('⚠️ pickDropTarget: Returning invalid target (destroyed, locked, or value = 0), returning null instead');
        return null;
      }
      // Make sure result is in tiles list
      if (typeof getTiles === 'function' && !getTiles().includes(result)) {
        console.warn('⚠️ pickDropTarget: Target not in tiles list, returning null instead');
        return null;
      }
      // Make sure result has grid positions
      if (typeof result.gridX !== 'number' || typeof result.gridY !== 'number') {
        console.warn('⚠️ pickDropTarget: Target missing grid positions, returning null instead');
        return null;
      }
      
      // 🔥 CRITICAL: For wild-magnet, ensure overlap is significant (not just a tiny edge overlap)
      // If bestRatio is very small (< 0.30), it might be an accidental edge overlap
      // This check matches the threshold above (0.30) for consistency
      if (src.special === 'wild-magnet' && bestRatio < 0.30) {
        console.warn('⚠️ pickDropTarget: Wild-magnet overlap too small (< 0.30), returning null instead');
        console.warn('⚠️ Overlap ratio:', bestRatio, 'threshold:', th, 'best tile:', result?.value);
        return null;
      }
      
      // CRITICAL: Double-check canDrop for the final result
      if (typeof canDrop === 'function' && !canDrop(src, result)) {
        console.warn('⚠️ pickDropTarget: canDrop returned false for final result, returning null instead');
        return null;
      }
    }
    
    // 🔥 PERFORMANCE: Cache result and return
    lastPickDropResult = result;
    
    // 🔥 PERFORMANCE: Removed console.log to prevent lag (too many calls per second)
    // Only log if result exists or if wild-magnet (for debugging)
    // if (result || src.special === 'wild-magnet') {
    //   console.log('🔍 pickDropTarget result:', {
    //     hasResult: !!result,
    //     resultValue: result?.value,
    //     resultGridX: result?.gridX,
    //     resultGridY: result?.gridY,
    //     bestRatio: result ? bestRatio : 0,
    //     threshold: th,
    //     baseThreshold,
    //     isWildMagnet: src.special === 'wild-magnet',
    //     candidatesCount: candidates.length
    //   });
    // }
    
    return result;
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
    // Wild, wild-magnet, and wild-beer can merge with any tile (show hover)
    if (srcSpecial === 'wild' || targetSpecial === 'wild' || 
        srcSpecial === 'wild-magnet' || targetSpecial === 'wild-magnet' ||
        srcSpecial === 'wild-beer' || targetSpecial === 'wild-beer') return true;

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
