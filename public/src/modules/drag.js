// src/modules/drag.js
// v1.3 STABLE drag (PIXI v8 + GSAP)
// - Hover okvir na target.rotG (ako postoji).
// - Drop SAMO kad je pointer unutar ciljne pločice (world-space getBounds()).
// - NEMA nearest auto-aimanja; u suprotnom ide snapBack.
// - GSAP guardovi ostaju za sigurnost.

import { Graphics, Container, Sprite, Texture } from 'pixi.js';
import { gsap } from 'gsap';

// --- Inercijski tilt parametri (nagib SUPROTNO od smjera + lag) ---------------
const TILT_MAX_RAD = 0.22;   // maksimalna rotacija (~12.6°)
const TILT_SCALE   = 18;     // skala pretvorbe brzine → rotacija
const VEL_SMOOTH   = 0.10;   // sporije prihvaća promjenu brzine (teži osjećaj)
const ROT_SMOOTH   = 0.08;   // sporije naginje prema cilju (teži osjećaj)
const POS_LAG_PX   = 6;      // maksimalni parallax pomak (px)
const TILT_DUR     = 0.5;    // zadržano za release tween na onUp

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

    drag.t = t;
    drag.startGX = t.gridX;
    drag.startGY = t.gridY;
    drag.startX = t.x;
    drag.startY = t.y;
    drag.offX = p.x - t.x;
    drag.offY = p.y - t.y;
    drag.moved = false;
    drag._lastGlobal = e.global.clone?.() ?? { x: e.global.x, y: e.global.y };

    // reset inertial state
    drag.vx = 0; drag.vy = 0;
    drag.lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    drag.lagX = 0; drag.lagY = 0;
    if (t.rotG) gsap.killTweensOf(t.rotG);

    // ⬆️ digni na vrh, ali zapamti prijašnji z-index
    rememberZ(t);
    board.addChild(t);
    t.zIndex = 9999;

    // (ghost placeholder is now provided by boardBG under all cells)

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
  }

  function onUp() {
    app.stage.off('pointermove', onMove);
    app.stage.off('pointerup', onUp);
    app.stage.off('pointerupoutside', onUp);

    const t = drag.t;
    drag.t = null;
    // nothing to clean up for ghost (boardBG provides placeholders)

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

    clearHover();

    // ✅ Z-INDEX SAFETY PATCH:
    // prije merge animacije vrati pločicu na originalni sloj,
    // da NIKAD ne ostane “ispred” ostalih nakon brzih interakcija
    restoreZ(t);

    onMerge?.(t, target, helpers);
  }

  // === STABLE HIT-TEST: preklapanje pravokutnika, bez auto-aimanja ===
  function pickDropTarget(src) {
    if (!src) return null;

    const list = (typeof getTiles === 'function' ? getTiles() : []) || [];
    const candidates = list.filter(t =>
      t &&
      t !== src &&
      !t.locked &&
      (t.value | 0) > 0
    );

    if (!candidates.length) return null;

    const srcR = getRect(src);
    let best = null;
    let bestRatio = 0;

    for (const t of candidates) {
      if (typeof canDrop === 'function' && !canDrop(src, t)) continue;
      const dstR = getRect(t);
      const r = intersectRatio(srcR, dstR);
      if (r > bestRatio) { bestRatio = r; best = t; }
    }

    const th = Number.isFinite(drag.threshold) ? drag.threshold : 0.05;
    return (best && bestRatio >= th) ? best : null;
  }

  function getRect(d) {
    const b = d.getBounds?.(true) || { x: d.x, y: d.y, width: d.width, height: d.height };
    return { x: b.x, y: b.y, w: b.width, h: b.height };
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

    frame.addChild(ring);

    drag.hoverTarget = target;
    drag.hoverFrame = frame;
  }

  function clearHover() {
    if (drag.hoverFrame) {
      try {
        if (drag.hoverFrame.parent) drag.hoverFrame.parent.removeChild(drag.hoverFrame);
        drag.hoverFrame.destroy({ children: true });
      } catch {}
    }
    drag.hoverFrame = null;
    drag.hoverTarget = null;
  }

  function snapBack(t) {
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
