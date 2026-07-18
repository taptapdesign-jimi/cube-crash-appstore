// @ts-nocheck
// src/modules/drag.js
// v1.3 STABLE drag (PIXI v8 + GSAP)
// - Hover okvir na target.rotG (ako postoji).
// - Drop SAMO kad je pointer unutar ciljne pločice (world-space getBounds()).
// - NEMA nearest auto-aimanja; u suprotnom ide snapBack.
// - GSAP guardovi ostaju za sigurnost.

import { Graphics, Container, Sprite, Texture, Rectangle } from 'pixi.js';
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { magicSparklesAtTile, dragSmokeTrail, isWildJuiceExplosionRunning, cleanupWildJuiceExplosion } from "./fx.ts";
import { TILE_IDLE_BOUNCE } from './tile-idle-bounce.ts';
import { startSpecialDiceIdleMotion, stopSpecialDiceIdleMotion } from './special-dice-idle.ts';
import { canStartTileDrag } from './input-gate.ts';
import { isSpecialDiceDirectWildLikeTile, isSpecialDiceMagnetLikeTile } from './special-dice-registry.ts';
import { isGameplayTileCandidate } from './tile-lifecycle-service.ts';
import { completeBoardLifecycleTrace } from '../utils/board-lifecycle-performance.ts';

// --- GSAP SAFETY WRAPPERS (kao u tvom originalu) ---------------------------
// 🔥 CRITICAL FIX: Save original GSAP functions BEFORE defining trackTween/trackTimeline
// This prevents infinite recursion where trackTween calls gsap.to() which might call trackTween
const __dg_orig_to = gsap.to.bind(gsap);
const __dg_orig_fromTo = gsap.fromTo.bind(gsap);
const __dg_orig_set = gsap.set.bind(gsap);
const __dg_orig_timeline = gsap.timeline.bind(gsap);

// 🔥 CRITICAL FIX: Export original GSAP functions so other modules can use them
// This prevents infinite recursion when trackTween/trackTimeline are called from other modules
export const getOriginalGsapTo = () => __dg_orig_to;
export const getOriginalGsapTimeline = () => __dg_orig_timeline;

// 🔥 CRITICAL FIX: Use original GSAP functions to prevent infinite recursion
// trackTween/trackTimeline must use __dg_orig_to/__dg_orig_timeline, not gsap.to/gsap.timeline
// because gsap.to/gsap.timeline are overridden below and might cause circular calls
const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(__dg_orig_timeline(options));

const trackTween = (target: any, vars: any) => animationManager.trackExternalTween(__dg_orig_to(target, vars));
const isVerboseGameplayLogsEnabled = () => (typeof window !== 'undefined') && (window as any).__ccVerboseGameplayLogs === true;
const WILD_SPECIALS = new Set(['wild', 'wild-magnet', 'wild-juice', 'wild-tnt']);

function schedulePostFailedDropEndgameCheck(reason: string): void {
  const checkLevelEnd = (window as any).CC?.checkLevelEnd;
  if (typeof checkLevelEnd !== 'function') return;
  setTimeout(() => {
    try {
      checkLevelEnd();
    } catch (err) {
      if (isVerboseGameplayLogsEnabled()) {
        console.warn('⚠️ post failed drop endgame check failed', { reason, err });
      }
    }
  }, 100);
}

// --- Inercijski tilt parametri (nagib SUPROTNO od smjera + lag) ---------------
const TILT_MAX_RAD = 0.22;   // maksimalna rotacija mišem (~12.6°)
const TOUCH_TILT_MAX_RAD = 0.16; // touch ostaje živ, ali ne djeluje nestabilno pod prstom
const TILT_SCALE   = 18;     // skala pretvorbe brzine → rotacija
const VEL_SMOOTH   = 0.10;   // sporije prihvaća promjenu brzine (teži osjećaj)
const ROT_SMOOTH   = 0.08;   // sporije naginje prema cilju (teži osjećaj)
const POS_LAG_PX   = 6;      // maksimalni parallax pomak (px)
const TILT_DUR     = 0.5;    // zadržano za release tween na onUp
const BOARD_WOBBLE_ENABLED = true; // 🔥 USER REQUEST: Disabled for wild-juice drag (may use later) - kept constant for future use

const MAGNET_OFFSET_RATIO = 14 / 128; // 14px od 128px pločice ≈ 10.9375%
const MAGNET_SCALE_MULT  = 1.04;    // jasniji premium "lock" bez promjene drop pravila
const MAGNET_IN_DUR      = 0.12;    // trajanje scale-in easing
const MAGNET_MOVE_DUR    = 0.085;   // koliko brzo se target približava
const MAGNET_RETURN_DUR  = 0.14;    // trajanje povratka u baznu poziciju
const DRAG_WATCHDOG_REFRESH_MS = 650;
const DRAG_HOVER_PICK_THROTTLE_MS = 24;

function isIOSRuntime(): boolean {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function setGameplayDragActive(active: boolean): void {
  try {
    (window as any).__ccGameplayDragActive = active;
    document.body?.classList.toggle('gameplay-drag-active', active);
  } catch {}
}

function getTileSpecial(tile: any): string | null {
  if (!tile) return null;
  const special = typeof tile.special === 'string' ? tile.special : '';
  if (WILD_SPECIALS.has(special)) return special;
  const remembered = typeof tile._ccWildSpecial === 'string' ? tile._ccWildSpecial : '';
  if (WILD_SPECIALS.has(remembered)) return remembered;
  if (tile.isWild === true || tile.isWildFace === true) return 'wild';
  return null;
}

function repairWildTileState(tile: any): string | null {
  if (!tile || tile.destroyed) return null;
  const special = getTileSpecial(tile);
  if (!special) return null;
  tile.special = special;
  tile._ccWildSpecial = special;
  tile.isWild = true;
  tile.isWildFace = true;
  tile.value = 6;
  try {
    if (tile.pips) {
      tile.pips.visible = false;
      tile.pips.clear?.();
    }
  } catch {}
  try { if (tile.num) tile.num.visible = false; } catch {}
  try { if (tile.overlay) tile.overlay.visible = false; } catch {}
  try { if (tile.shadow) tile.shadow.visible = false; } catch {}
  try { (window as any).CC?.applyWildSkinLocal?.(tile); } catch {}
  return special;
}

function isAnyWildTile(tile: any): boolean {
  return !!repairWildTileState(tile);
}

function normalizeWildTileForVisualTailDrag(tile: any): void {
  if (!tile || tile.destroyed || !isAnyWildTile(tile)) return;
  if (
    tile._ccWildSpawnDropping === true ||
    tile._ccWildSpawnHandoffLock === true ||
    tile._wildMagnetAffected === true
  ) {
    return;
  }

  try { tile.locked = false; } catch {}
  try { tile.eventMode = 'static'; } catch {}
  try { tile.interactive = true; } catch {}
  try { tile.interactiveChildren = true; } catch {}
  try { tile.cursor = 'pointer'; } catch {}

  const rotG = tile.rotG;
  if (rotG && !rotG.destroyed) {
    try { rotG.eventMode = 'static'; } catch {}
    try { rotG.interactive = true; } catch {}
    try { rotG.interactiveChildren = true; } catch {}
    try { rotG.cursor = 'pointer'; } catch {}
  }
}

function playBlockedSpecialDragFeedback(tile: any, reasons: string[] = []): void {
  if (!tile || tile.destroyed || !isAnyWildTile(tile)) return;
  const now = Date.now();
  const lastAt = Number((tile as any)._ccBlockedDragFeedbackAt || 0);
  if (now - lastAt < 180) return;
  (tile as any)._ccBlockedDragFeedbackAt = now;

  const canAnimate =
    reasons.includes('juice-bubbles') ||
    reasons.includes('sparkle-text') ||
    reasons.includes('magnetic-text');
  if (!canAnimate) return;

  const target = tile.rotG || tile;
  if (!target || target.destroyed) return;
  try {
    (tile as any)._ccBlockedDragFeedbackTween?.kill?.();
  } catch {}
  const baseRotation = Number(target.rotation || 0);
  const baseY = Number(tile.y || 0);
  try {
    (tile as any)._ccBlockedDragFeedbackTween = trackTimeline({
      onComplete: () => {
        try { target.rotation = baseRotation; } catch {}
        try { tile.y = baseY; } catch {}
        try { (tile as any)._ccBlockedDragFeedbackTween = null; } catch {}
      },
      onInterrupt: () => {
        try { target.rotation = baseRotation; } catch {}
        try { tile.y = baseY; } catch {}
      },
    })
      .to(target, {
        rotation: baseRotation - 0.055,
        duration: 0.055,
        ease: 'power2.out',
      }, 0)
      .to(tile, {
        y: baseY - 3,
        duration: 0.07,
        ease: 'power2.out',
      }, 0)
      .to(target, {
        rotation: baseRotation + 0.05,
        duration: 0.075,
        ease: 'sine.inOut',
      })
      .to(tile, {
        y: baseY,
        duration: 0.1,
        ease: 'back.out(2.4)',
      }, '<')
      .to(target, {
        rotation: baseRotation,
        duration: 0.075,
        ease: 'power2.out',
      });
  } catch {
    try { target.rotation = baseRotation; } catch {}
    try { tile.y = baseY; } catch {}
  }
}

function getExistingWildSpecial(tile: any): string | null {
  if (!tile || tile.destroyed) return null;
  const special = typeof tile.special === 'string' ? tile.special : '';
  if (WILD_SPECIALS.has(special)) return special;
  const remembered = typeof tile._ccWildSpecial === 'string' ? tile._ccWildSpecial : '';
  if (WILD_SPECIALS.has(remembered)) return remembered;
  if (tile.isWild === true || tile.isWildFace === true) return 'wild';
  return null;
}

function isDirectWildTile(tile: any): boolean {
  const special = getTileSpecial(tile);
  return isSpecialDiceDirectWildLikeTile(tile, special);
}

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

  const texture = Texture.from(canvas);
  try {
    texture.label = `runtime:drag-gradient:${canvas.width}x${canvas.height}`;
    const src = (texture as { source?: { label?: string }; baseTexture?: { label?: string } }).source ?? texture.baseTexture;
    if (src) src.label = texture.label;
  } catch {}
  try {
    const rt = (window as any).__ccRuntimeTextures || ((window as any).__ccRuntimeTextures = new Set());
    rt.add?.(texture);
  } catch {}
  return texture;
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
    hitPad = 0.22,
    snapRadius = 0.68,
  } = cfg;

  const drag = {
    t: null,
    pointerId: null as number | null,
    pointerType: null as string | null,
    startGX: 0, startGY: 0,
    startX: 0,  startY: 0,
    offX: 0,    offY: 0,
    moved: false,
    hoverTarget: null,
    hoverFrame: null,
    hoverCandidate: null,
    hoverCandidateFrames: 0,
    _lastGlobal: null, // world-space pointer
    threshold,
    hitPad,
    snapRadius,
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
    _watchdogTimeout: null as any,
    _lastWatchdogRefreshAt: 0,
    _lastMagnetFieldUpdateAt: 0,
    _pausedSpecialIdleTiles: new Set<any>(),
    _perfSample: null as any,
    _perfTicker: null as any,
    _pendingMoveEvent: null as any,
    _moveRaf: null as number | null,
  };

  function beginDragPerfSample() {
    const now = performance.now();
    drag._perfSample = {
      startedAt: now,
      moveEvents: 0,
      processedMoves: 0,
      moveTotalMs: 0,
      moveMaxMs: 0,
      moveOver8Ms: 0,
      tickerFrames: 0,
      tickerOver20Ms: 0,
      tickerOver34Ms: 0,
      tickerMaxMs: 0,
    };
    drag._perfTicker = () => {
      const sample = drag._perfSample;
      if (!sample) return;
      const deltaMs = Number(app?.ticker?.deltaMS || 0);
      sample.tickerFrames += 1;
      sample.tickerMaxMs = Math.max(sample.tickerMaxMs, deltaMs);
      if (deltaMs > 20) sample.tickerOver20Ms += 1;
      if (deltaMs > 34) sample.tickerOver34Ms += 1;
    };
    try { app?.ticker?.add(drag._perfTicker); } catch {}
  }

  function finishDragPerfSample(reason: string) {
    const sample = drag._perfSample;
    if (drag._perfTicker) {
      try { app?.ticker?.remove(drag._perfTicker); } catch {}
    }
    drag._perfTicker = null;
    drag._perfSample = null;
    if (!sample) return;
    const durationMs = Math.max(0, performance.now() - sample.startedAt);
    const payload = {
      reason,
      durationMs: Math.round(durationMs),
      pointerType: drag.pointerType,
      rendererResolution: Number(app?.renderer?.resolution || 1),
      moveEvents: sample.moveEvents,
      processedMoves: sample.processedMoves,
      coalescedMoves: Math.max(0, sample.moveEvents - sample.processedMoves),
      moveAverageMs: sample.processedMoves > 0
        ? Number((sample.moveTotalMs / sample.processedMoves).toFixed(2))
        : 0,
      moveMaxMs: Number(sample.moveMaxMs.toFixed(2)),
      moveOver8Ms: sample.moveOver8Ms,
      tickerFrames: sample.tickerFrames,
      tickerOver20Ms: sample.tickerOver20Ms,
      tickerOver34Ms: sample.tickerOver34Ms,
      tickerMaxMs: Number(sample.tickerMaxMs.toFixed(2)),
    };
    try { (window as any).__ccLastDragPerf = payload; } catch {}
    console.info('🧪 DragPerf summary', payload);
  }

  function eventPointerId(e: any): number | null {
    const pid = e?.pointerId;
    return Number.isFinite(pid) ? pid : null;
  }

  function isActivePointerEvent(e: any): boolean {
    // If no owner pointer is set, accept event.
    if (drag.pointerId === null) return true;
    const pid = eventPointerId(e);
    // If event has no pointer id, treat as non-owner and ignore.
    if (pid === null) return false;
    return pid === drag.pointerId;
  }

  const helpers = { snapBack, clearHover };

  function shouldUseTouchDragPerformanceMode(): boolean {
    return drag.pointerType === 'touch' || isIOSRuntime();
  }

  function shouldSuppressDragDecorativeFx(): boolean {
    return shouldUseTouchDragPerformanceMode();
  }

  function clearDragRuntime() {
    if (drag._perfSample || drag._perfTicker) {
      finishDragPerfSample('runtime-clear');
    }
    try {
      app?.stage?.off('pointermove', onMove);
      app?.stage?.off('pointerup', onUp);
      app?.stage?.off('pointerupoutside', onUp);
      app?.stage?.off('pointercancel', onCancel);
    } catch {}
    if (drag._moveRaf !== null) {
      cancelAnimationFrame(drag._moveRaf);
      drag._moveRaf = null;
    }
    drag._pendingMoveEvent = null;
    if (drag._sparkleInterval) {
      clearInterval(drag._sparkleInterval);
      drag._sparkleInterval = null;
    }
    if (drag._watchdogTimeout) {
      clearTimeout(drag._watchdogTimeout);
      drag._watchdogTimeout = null;
    }
    drag._lastSparkleTime = null;
    drag._lastSmokeTime = null;
    drag.pointerId = null;
    drag.pointerType = null;
    drag._lastWatchdogRefreshAt = 0;
    setGameplayDragActive(false);
  }

  function restartDragWatchdog(force = false) {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (!force && drag._lastWatchdogRefreshAt > 0 && now - drag._lastWatchdogRefreshAt < DRAG_WATCHDOG_REFRESH_MS) {
      return;
    }
    drag._lastWatchdogRefreshAt = now;
    if (drag._watchdogTimeout) {
      clearTimeout(drag._watchdogTimeout);
      drag._watchdogTimeout = null;
    }
    drag._watchdogTimeout = setTimeout(() => {
      const t = drag.t;
      if (!t) {
        clearDragRuntime();
        return;
      }
      clearHover({ immediateMagnet: true });
      clearDragRuntime();
      drag.t = null;
      resumeSpecialDiceIdleAfterDrag();
      try {
        if (t && !t.destroyed) {
          snapBack(t, () => {
            try { startSpecialDiceIdleMotion(t); } catch {}
          });
        }
      } catch {
        try { restoreZ(t); } catch {}
      }
    }, 9000);
  }

  function pauseSpecialDiceIdleForDrag(activeTile: any): void {
    drag._pausedSpecialIdleTiles.clear();
    const list = (typeof getTiles === 'function' ? getTiles() : []) || [];
    for (const tile of list) {
      if (!tile || tile.destroyed || tile === activeTile) continue;
      if (!tile._ccSpecialDiceIdleTl) continue;
      drag._pausedSpecialIdleTiles.add(tile);
      try { stopSpecialDiceIdleMotion(tile); } catch {}
    }
  }

  function resumeSpecialDiceIdleAfterDrag() {
    if (!drag._pausedSpecialIdleTiles.size) return;
    const pausedTiles = Array.from(drag._pausedSpecialIdleTiles);
    drag._pausedSpecialIdleTiles.clear();
    setTimeout(() => {
      for (const tile of pausedTiles) {
        if (!tile || tile.destroyed || tile.locked || tile._ccWildSpawnDropping === true) continue;
        try { startSpecialDiceIdleMotion(tile); } catch {}
      }
    }, 350);
  }

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
    if (t.rotG && t.rotG !== t) {
      try { t.rotG.removeAllListeners?.('pointerdown'); } catch {}
    }
    t.eventMode = 'static';
    t.interactive = true;
    t.interactiveChildren = true;
    t.cursor = 'pointer';
    const special = getTileSpecial(t);
    if (special) {
      const hitSize = tileSize * 1.16;
      const half = hitSize / 2;
      const hitArea = new Rectangle(-half, -half, hitSize, hitSize);
      t.hitArea = hitArea;
      if (t.rotG && t.rotG !== t) {
        t.rotG.eventMode = 'static';
        t.rotG.interactive = true;
        t.rotG.interactiveChildren = false;
        t.rotG.cursor = 'pointer';
        t.rotG.hitArea = hitArea;
      }
      try {
        t.children?.forEach?.((child: any) => {
          if (child && child !== t.rotG) {
            child.eventMode = 'none';
            child.interactive = false;
            child.interactiveChildren = false;
          }
        });
      } catch {}
    }
    const start = (e: any) => onDown(e, t);
    t.on('pointerdown', start);
    if (special && t.rotG && t.rotG !== t) {
      t.rotG.on('pointerdown', start);
    }
  }

  function onDown(e, t) {
    // Multi-touch guard: only one active pointer can own drag.
    if (drag.t && !drag.t.destroyed) {
      try { e?.stopPropagation?.(); } catch {}
      try { e?.preventDefault?.(); } catch {}
      return;
    }

    // 🔥 USER REQUEST: Block drag if game is paused (bottom sheet is open)
    try {
      const { container } = require('../core/dependency-injection.js');
      const gamePaused = container.get('gamePaused') as boolean;
      // 🔥 FIX: Also check window fallback in case container.set failed
      const windowPaused = (window as any)._gamePaused === true;
      if (gamePaused && !windowPaused) {
        // If container says paused but window says not paused, trust window (immediate resume)
        console.log('🛡️ DRAG: Container says paused but window._gamePaused is false - allowing drag');
      } else if (gamePaused) {
        console.log('🛡️ DRAG BLOCKED: Game is paused (bottom sheet is open)');
        return;
      }
    } catch (error) {
      // If container doesn't exist, check window fallback
      if ((window as any)._gamePaused === true) {
        console.log('🛡️ DRAG BLOCKED: Game is paused (window fallback)');
        return;
      }
    }
    
    // 🔥 USER REQUEST: Also check if any bottom sheet is open in DOM
    const scoreSheetOpen = document.querySelector('.score-bottom-sheet.visible');
    const endRunModalOpen = document.querySelector('.simple-bottom-sheet.visible:not(.score-bottom-sheet)');
    if (scoreSheetOpen || endRunModalOpen) {
      console.log('🛡️ DRAG BLOCKED: Bottom sheet is open', { scoreSheetOpen: !!scoreSheetOpen, endRunModalOpen: !!endRunModalOpen });
      return;
    }

    repairWildTileState(t);
    normalizeWildTileForVisualTailDrag(t);

    const inputGateDecision = canStartTileDrag({
      tile: t,
      isWildTile: isAnyWildTile(t),
    });
    if (!inputGateDecision.allowed) {
      console.log('🛡️ DRAG BLOCKED: Input gate', inputGateDecision.reasons, {
        value: t?.value,
        special: t?.special,
        gridX: t?.gridX,
        gridY: t?.gridY,
      });
      playBlockedSpecialDragFeedback(t, inputGateDecision.reasons);
      try { e?.stopPropagation?.(); } catch {}
      try { e?.preventDefault?.(); } catch {}
      return;
    }
    completeBoardLifecycleTrace('first-input');
    
    // 🧲 MAGNETIC REACTION: No need to store original positions
    // updateMagnet function handles gentle pull automatically (same as wild tile)
    // No custom pull effect needed - updateMagnet provides the same gentle effect
    const p = board.toLocal(e.global);

    if (isVerboseGameplayLogsEnabled()) {
      console.log('🔍 DRAG START: Tile at', t.gridX, t.gridY, 'value:', t.value, 'locked:', t.locked);
    }
    
    // Notify idle bounce that user is interacting
    try {
      TILE_IDLE_BOUNCE.notifyInteraction();
    } catch (error) {
      console.warn('⚠️ Failed to notify board interaction:', error);
    }

    // 🔥 USER REQUEST: Clear lingering stack smoke immediately when drag starts
    try {
      import('./fx.js').then(fxModule => {
        if (fxModule?.cleanupFxContainersByTag) {
          fxModule.cleanupFxContainersByTag('stack-smoke');
        }
      }).catch(() => {});
    } catch {}

    // Hide NO MOVES! on drag start and re-arm idle hint
    try {
      import('./endgame-hint.js').then(mod => mod?.notifyEndgameHintInteraction?.()).catch(() => {});
    } catch {}
    
    // MARK: User has made a move
    window._userMadeMove = true;
    if (isVerboseGameplayLogsEnabled()) {
      console.log('✅ User has made a move - game can now be saved');
    }
    
    // Show all ghost placeholders when user starts dragging
    if (window._ghostPlaceholders) {
      if (isVerboseGameplayLogsEnabled()) {
        console.log('👻 Showing all ghost placeholders on drag start');
      }
      for (let r = 0; r < window._ghostPlaceholders.length; r++) {
        if (window._ghostPlaceholders[r]) {
          for (let c = 0; c < window._ghostPlaceholders[r].length; c++) {
            if (window._ghostPlaceholders[r][c]) {
              window._ghostPlaceholders[r][c].visible = true;
            }
          }
        }
      }
      try { (window as any).hideGhostsUnderLockedTiles?.('drag-start-show-ghosts'); } catch {}
    }
    
    releaseMagnet({ immediate: true });
    // 🔥 USER REQUEST: Stop TNT idle (particles + shake) when dragging wild-tnt
    if ((t as any)?.special === 'wild-tnt') {
      try {
        import('./fx.js').then(fxModule => {
          if (fxModule?.stopTntIdleParticles) fxModule.stopTntIdleParticles(t);
          if (fxModule?.stopTntIdleShake) fxModule.stopTntIdleShake(t);
        }).catch(() => {});
      } catch {}
    }
    drag.t = t;
    setGameplayDragActive(true);
    pauseSpecialDiceIdleForDrag(t);
    drag.pointerId = eventPointerId(e);
    drag.pointerType = e?.pointerType || null;
    beginDragPerfSample();
    drag.startGX = t.gridX;
    drag.startGY = t.gridY;
    drag.startX = t.x;
    drag.startY = t.y;
    drag.offX = p.x - t.x;
    drag.offY = p.y - t.y;
    drag.moved = false;
    drag._lastGlobal = e.global.clone?.() ?? { x: e.global.x, y: e.global.y };

    // New drag must never inherit a cached null/target from the previous interaction.
    // This is especially important for freshly dropped wild tiles: the first drag after
    // spawn can otherwise snap back before hover/merge gets a fresh target read.
    lastPickDropTime = 0;
    lastPickDropResult = null;
    lastPickDropSrc = null;
    lastPickDropX = null;
    lastPickDropY = null;
    lastPickDropAllowCenterFallback = null;
    drag.hoverCandidate = null;
    drag.hoverCandidateFrames = 0;
    drag._lastMagnetFieldUpdateAt = 0;
    
    // Track drag start time for wild-magnet sequential pulling
    drag._wildMagnetDragStartTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    // reset inertial state
    drag.vx = 0; drag.vy = 0;
    drag.lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    drag.lagX = 0; drag.lagY = 0;
    try { stopSpecialDiceIdleMotion(t); } catch {}
    if (t.rotG) gsap.killTweensOf(t.rotG);
    // Remember board baseline and enable wobble only for juice wild
    drag._boardBaseX = board?.x ?? 0;
    drag._boardBaseY = board?.y ?? 0;
    drag._boardBaseRot = board?.rotation ?? 0;
    drag._boardCenterX = board ? board.x : 0;
    drag._boardCenterY = board ? board.y : 0;
    drag._boardPivotX = board?.pivot?.x ?? 0;
    drag._boardPivotY = board?.pivot?.y ?? 0;
    // 🔥 USER REQUEST: Board wobble disabled for wild-juice drag (may use later)
    // drag._boardWobbleActive = t.special === 'wild-juice';
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
        if (isVerboseGameplayLogsEnabled()) {
          console.log('🎯 DRAG: Temporarily cleared grid at', drag.startGX, drag.startGY);
        }
        
        // Update ghost visibility to show placeholder at drag origin
        if (typeof window.updateGhostVisibility === 'function') {
          window.updateGhostVisibility();
        }
      }
    }

    // Ghost placeholders are now in fixed background layer - always visible

    // 🔧 SHADOW PATCH: Hide shadow while dragging any wild tile (star/juice/tnt/magnet)
    const isWildDrag = isAnyWildTile(t);
    if (t.shadow && isWildDrag) {
      t.shadow.visible = false;
    } else if (t.shadow) {
      t.shadow.visible = true;
      const prev = t.shadow.alpha;
      if (t.refreshShadow) { t.refreshShadow(); if (t.shadow) t.shadow.alpha = prev; }
      const to = Math.min(1, t.shadow._dragAlpha ?? 0.30);
      gsap.killTweensOf(t.shadow);
      trackTween(t.shadow, { alpha: to, duration: 0.08, ease: 'power2.out' });
      // The shadow may deform because it is not game geometry: widening and
      // lowering it sells lift while the cube itself remains perfectly rigid.
      try {
        gsap.killTweensOf(t.shadow.scale);
        trackTween(t.shadow.scale, {
          x: 1.09,
          y: 0.9,
          duration: 0.1,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      } catch {}
    }

    // Pickup reads immediately, then settles into a slightly softer lifted hold.
    // The tile position remains fully attached to the pointer on touch devices.
    try { gsap.killTweensOf(t.scale); } catch {}
    trackTimeline()
      .to(t.scale, {
        x: 1.13,
        y: 1.09,
        duration: 0.055,
        ease: 'power3.out',
      })
      .to(t.scale, {
        x: 1.105,
        y: 1.105,
        duration: 0.075,
        ease: 'back.out(2.2)',
      });

    // 🔥 FPS DROP FIX: Stop wild juice idle bubbles when dragging starts (prevents conflict with drag particles)
    if (t.special === 'wild-juice') {
      try {
        // Import stopWildJuiceBubbles dynamically to avoid circular dependency
        import('./fx.js').then(fxModule => {
          if (fxModule && typeof fxModule.stopWildJuiceBubbles === 'function') {
            fxModule.stopWildJuiceBubbles(t);
            console.log('🧹 Stopped wild juice idle bubbles on drag start');
          }
        }).catch(err => {
          console.warn('⚠️ Failed to stop wild juice bubbles on drag start:', err);
        });
      } catch (err) {
        console.warn('⚠️ Error stopping wild juice bubbles on drag start:', err);
      }
    }

    // 🔥 CRITICAL FIX: Stop magnet idle particles when dragging starts (prevents white particles mixing with red drag particles)
    if (t.special === 'wild-magnet') {
      try {
        // Import stopMagnetIdleParticles dynamically to avoid circular dependency
        import('./fx.js').then(fxModule => {
          if (fxModule && typeof fxModule.stopMagnetIdleParticles === 'function') {
            fxModule.stopMagnetIdleParticles(t);
            console.log('🧹 Stopped magnet idle particles on drag start');
          }
        }).catch(err => {
          console.warn('⚠️ Failed to stop magnet idle particles on drag start:', err);
        });
      } catch (err) {
        console.warn('⚠️ Error stopping magnet idle particles on drag start:', err);
      }
    }

    // Start sparkles immediately when wild cube is picked up
    // 🔥 CRITICAL: All wild tiles (wild star, wild juice, wild magnet) get sparkles with their original colors
    if (isAnyWildTile(t) && !shouldSuppressDragDecorativeFx()) {
      try {
        // 🔥 CRITICAL: Set z-index to be BELOW dragged tile (tile is at 9999, particles should be at 9998)
        // This ensures particles appear behind the wild tile when dragging
        const tileZ = t?.zIndex ?? 0;
        const particlesZ = tileZ > 9000 ? tileZ - 1 : tileZ - 0.001; // Behind dragged tile
        // 🔥 USER REQUEST: All wild tiles use same intensity (1.0) for consistent smoke trail
        magicSparklesAtTile(board, t, { intensity: 1.0, zIndex: particlesZ });
        drag._lastSparkleTime = drag.lastTime;
        
        // 🔥 FPS DROP FIX: Optimize drag particles interval based on drag speed (prevent comet trails)
        // Use velocity-based throttling to reduce particles when dragging fast
        drag._sparkleInterval = setInterval(() => {
          if (drag.t && isAnyWildTile(drag.t) && !drag.t.destroyed) {
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
    app.stage.on('pointercancel', onCancel);
    restartDragWatchdog(true);
  }

  function processMove(e) {
    if (!drag.t) return;
    if (!isActivePointerEvent(e)) return;
    restartDragWatchdog();
    const t = drag.t;
    if (!t || t.destroyed || !t.position) {
      // 🔥 FIX: Clean up listeners and interval if tile was destroyed mid-drag
      drag.t = null;
      drag.pointerId = null;
      drag.pointerType = null;
      clearHover();
      
      clearDragRuntime();
      resumeSpecialDiceIdleAfterDrag();
      
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
    
    // 🔥 USER REQUEST: Board wobble disabled for wild-juice drag (may use later)
    // Board wobble: subtle parallax for wild-juice drag (disabled during bubbles animation)
    /*
    if (BOARD_WOBBLE_ENABLED) {
      // 🔥 CRITICAL: Disable board wobble when bubbles animation is active to prevent conflicts
      if (drag._boardWobbleActive && board && !isWildJuiceExplosionRunning()) {
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
    const touchPerformanceMode = shouldUseTouchDragPerformanceMode();
    const tiltLimit = touchPerformanceMode ? TOUCH_TILT_MAX_RAD : TILT_MAX_RAD;
    const targetRot = Math.max(-tiltLimit, Math.min(tiltLimit, (-drag.vx * TILT_SCALE)));
    if (t.rotG) {
      const cur = t.rotG.rotation || 0;
      const rotationSmooth = touchPerformanceMode ? 0.18 : ROT_SMOOTH;
      const next = cur + (targetRot - cur) * rotationSmooth;
      t.rotG.rotation = next;

      // Desktop keeps the weighted parallax. Touch must stay directly under the finger;
      // positional lag reads as input latency even when the renderer is holding 60 FPS.
      if (touchPerformanceMode) {
        drag.lagX = 0;
        drag.lagY = 0;
      } else {
        const targetLagX = Math.max(-POS_LAG_PX, Math.min(POS_LAG_PX, -drag.vx * 240));
        const targetLagY = Math.max(-POS_LAG_PX, Math.min(POS_LAG_PX, -drag.vy * 240));
        drag.lagX = drag.lagX + (targetLagX - drag.lagX) * 0.12;
        drag.lagY = drag.lagY + (targetLagY - drag.lagY) * 0.12;
        px += drag.lagX;
        py += drag.lagY;
      }
    }

    if (t.position?.set) {
      t.position.set(px, py);
    }

    // Wild cube sparkles effect - continuous when selected (picked up)
    // 🔥 CRITICAL: wild-juice does NOT get sparkles, only bubbles (handled in else block)
    if (t.special === 'wild' && !shouldSuppressDragDecorativeFx()) {
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
      // 🔥 Wild-magnet now uses interval-based sparkles (same as wild and wild-juice)
      // Sparkles are handled by the interval set in onDown function, no need for duplicate here
      t._lastVelX = drag.vx;
      t._lastVelY = drag.vy;
      
      // 🧲 MAGNETIC REACTION: Use same gentle pull as wild tile (via updateMagnet)
      // The updateMagnet function is already called below for the target tile
      // This provides the same gentle magnetic pull effect as wild tiles
      // No need for custom strong pull - updateMagnet handles it perfectly
    } else if (!shouldSuppressDragDecorativeFx() || !isAnyWildTile(t)) {
      // Trails: juice wild gets bubbles; others get smoke
      const smokeIntervalMs = shouldUseTouchDragPerformanceMode() ? 170 : 120;
      if (!drag._lastSmokeTime || (now - drag._lastSmokeTime) > smokeIntervalMs) {
        try {
          // 🔥 CRITICAL: Set z-index to be BELOW dragged tile (tile is at 9999, particles should be at 9998)
          // This ensures particles appear behind the tile when dragging
          const tileZ = t?.zIndex ?? 0;
          const particlesZ = tileZ > 9000 ? tileZ - 1 : tileZ - 0.001; // Behind dragged tile
          
          // 🔥 USER REQUEST: Wild juice uses same particles as wild star (no bubbles, only magicSparklesAtTile)
          // Removed dragJuiceBubbleTrail - wild juice now uses only magicSparklesAtTile particles like wild star
          if (t.special !== 'wild-juice' && t.special !== 'wild-tnt' && t.special !== 'wild') {
            // Keep the tactile smoke identity on touch/iPhone, but emit a much lighter
            // pooled trail there so it does not undo the drag frame-budget work.
            const smokeStrength = shouldUseTouchDragPerformanceMode() ? 0.24 : 0.7;
            dragSmokeTrail(board, t, 96, smokeStrength, { zIndex: particlesZ });
          }
          // Wild and wild-juice use only magicSparklesAtTile (no additional bubbles or smoke)
          drag._lastSmokeTime = now;
        } catch (err) {
          console.warn('Trail error:', err);
        }
      }
    }

    // ažuriraj _lastGlobal za sljedeći frame
    drag._lastGlobal = e.global.clone?.() ?? { x: e.global.x, y: e.global.y };

    const target = stabilizeHoverTarget(pickDropTarget(t, { allowCenterFallback: false }));
    
    // 🔥 NOTE: Bubbles animation is now triggered in onUp() when wild-juice is dropped on regular tile (merge 6)
    // This ensures bubbles start exactly when merge 6 happens, not when drag starts 
    
    // 🧲 MAGNETIC REACTION: For wild-magnet, apply gentle pull to ALL nearby tiles (like wild tile)
    // This provides the same gentle magnetic pull effect as wild tiles for all tiles in range
    if (t.special === 'wild-magnet') {
      if (now - (drag._lastMagnetFieldUpdateAt || 0) < DRAG_HOVER_PICK_THROTTLE_MS) {
        return;
      }
      drag._lastMagnetFieldUpdateAt = now;
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
        if (!isGameplayTileCandidate(otherTile)) return;
        if (otherTile === t) return; // Skip the magnet itself
        if (otherTile._ccWildSpawnDropping === true) return;
        const otherSpecial = getExistingWildSpecial(otherTile);
        const otherIsWild = !!otherSpecial;
        if ((otherTile.value | 0) <= 0 && !otherIsWild) return;
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
              otherTile._magnetState.scaleTween = trackTween(container.scale, {
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
            if (shouldUseTouchDragPerformanceMode()) {
              otherTile.x = otherTile.x + (destX - otherTile.x) * 0.35;
              otherTile.y = otherTile.y + (destY - otherTile.y) * 0.35;
              state.moveTween = null;
            } else {
              state.moveTween = trackTween(otherTile, {
                x: destX,
                y: destY,
                duration: MAGNET_MOVE_DUR,
                ease: 'sine.out',
                overwrite: 'auto'
              });
            }
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
              state.moveTween = trackTween(otherTile, {
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
                state.scaleTween = trackTween(state.container.scale, {
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
        if (distToMagnet < selectionRange && !shouldSuppressDragDecorativeFx()) {
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
        if (!otherIsWild && distToMagnet < hoverRange && isHoverValid(t, otherTile)) {
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
      // 🔥 CRITICAL FIX: Only apply magnet effect if combination is stackable (canDrop returns true)
      if (bestHoverTarget && typeof canDrop === 'function' && canDrop(t, bestHoverTarget)) {
        updateMagnet(bestHoverTarget);
      } else {
        // Release magnet if target is not stackable
        releaseMagnet();
      }
    } else {
      // For non-wild-magnet tiles, use normal hover logic
      showHover(target);
      // 🔥 CRITICAL FIX: Only apply magnet effect if combination is stackable (canDrop returns true)
      // This prevents magnet attraction for non-stackable combinations (e.g., 4+4)
      if (target && typeof canDrop === 'function' && canDrop(t, target)) {
        updateMagnet(target);
      } else {
        // Release magnet if target is not stackable
        releaseMagnet();
      }
    }
    
    // Ghost placeholders are now fixed and don't need redrawing
  }

  function processQueuedMove() {
    drag._moveRaf = null;
    const e = drag._pendingMoveEvent;
    drag._pendingMoveEvent = null;
    if (!e) return;
    const startedAt = performance.now();
    try {
      processMove(e);
    } finally {
      const sample = drag._perfSample;
      if (sample) {
        const elapsed = performance.now() - startedAt;
        sample.processedMoves += 1;
        sample.moveTotalMs += elapsed;
        sample.moveMaxMs = Math.max(sample.moveMaxMs, elapsed);
        if (elapsed > 8) sample.moveOver8Ms += 1;
      }
    }
  }

  function onMove(e) {
    if (!drag.t || !isActivePointerEvent(e)) return;
    const sample = drag._perfSample;
    if (sample) sample.moveEvents += 1;
    drag._pendingMoveEvent = {
      pointerId: eventPointerId(e),
      pointerType: e?.pointerType || drag.pointerType,
      global: {
        x: Number(e?.global?.x || 0),
        y: Number(e?.global?.y || 0),
      },
    };
    if (drag._moveRaf === null) {
      drag._moveRaf = requestAnimationFrame(processQueuedMove);
    }
  }

  function onUp(e) {
    if (!isActivePointerEvent(e)) return;

    if (drag._pendingMoveEvent) {
      if (drag._moveRaf !== null) {
        cancelAnimationFrame(drag._moveRaf);
        drag._moveRaf = null;
      }
      processQueuedMove();
    }

    const t = drag.t;
    drag.t = null;
    finishDragPerfSample('pointerup');
    clearDragRuntime();
    resumeSpecialDiceIdleAfterDrag();
    
    // Notify idle bounce that drag has ended - start 2-second idle timer
    try {
      TILE_IDLE_BOUNCE.notifyInteraction();
    } catch (error) {
      console.warn('⚠️ Failed to notify board interaction on drag end:', error);
    }
    
    // 🔥 USER REQUEST: Board wobble disabled for wild-juice drag (may use later)
    // Stop board wobble and reset when drag ends
    /*
    if (drag._boardWobbleActive && board) {
      drag._boardWobbleActive = false;
      trackTween(board, {
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
          state.moveTween = trackTween(otherTile, {
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
            state.scaleTween = trackTween(state.container.scale, {
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
      trackTween(t.rotG, { rotation: 0, duration: TILT_DUR, ease: 'power2.out' });
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
        trackTween(t.shadow, {
          alpha: base,
          duration: 0.12,
          ease: 'power2.out',
          onComplete: () => { if (t.shadow) t.shadow.visible = (base > 0); }
        });
        try {
          trackTween(t.shadow.scale, {
            x: 1,
            y: 1,
            duration: 0.14,
            ease: 'back.out(1.8)',
            overwrite: 'auto',
          });
        } catch {}
      }
    }

    if (!t || t.destroyed) { clearHover(); return; }
    if (!drag.moved) {
      clearHover();
      const tileRef = t;
      snapBack(t, () => {
        if (!tileRef || tileRef.destroyed) return;
        if (tileRef.special === 'wild-magnet') {
          try {
            import('./fx.js').then(fxModule => {
              if (fxModule?.startMagnetIdleParticles) fxModule.startMagnetIdleParticles(tileRef);
            }).catch(() => {});
          } catch {}
        }
        if (tileRef.special === 'wild-juice') {
          try {
            import('./fx.js').then(fxModule => {
              if (fxModule?.startWildJuiceBubbles) fxModule.startWildJuiceBubbles(tileRef);
            }).catch(() => {});
          } catch {}
        }
        if (tileRef.special === 'wild-tnt') {
          try {
            import('./fx.js').then(fxModule => {
              if (fxModule?.startTntIdleParticles) fxModule.startTntIdleParticles(tileRef);
              if (fxModule?.startTntIdleShake) fxModule.startTntIdleShake(tileRef);
            }).catch(() => {});
          } catch {}
        }
        try { startSpecialDiceIdleMotion(tileRef); } catch {}
      });
      return;
    }

    const target = pickDropTarget(t, { pointerGlobal: e?.global, force: true });
    
    if (!target) {
      clearHover();
      const tileRef = t;
      snapBack(t, () => {
        if (!tileRef || tileRef.destroyed) return;
        if (tileRef.special === 'wild-magnet') {
          try { import('./fx.js').then(fx => { if (fx?.startMagnetIdleParticles) fx.startMagnetIdleParticles(tileRef); }).catch(() => {}); } catch {}
        }
        if (tileRef.special === 'wild-juice') {
          try { import('./fx.js').then(fx => { if (fx?.startWildJuiceBubbles) fx.startWildJuiceBubbles(tileRef); }).catch(() => {}); } catch {}
        }
        if (tileRef.special === 'wild-tnt') {
          try {
            import('./fx.js').then(fxModule => {
              if (fxModule?.startTntIdleParticles) fxModule.startTntIdleParticles(tileRef);
              if (fxModule?.startTntIdleShake) fxModule.startTntIdleShake(tileRef);
            }).catch(() => {});
          } catch {}
        }
        try { startSpecialDiceIdleMotion(tileRef); } catch {}
      });

      // 🔥 CRITICAL: Check stuck state after failed drop (no valid target)
      // This catches cases where NO valid merges exist (e.g., 4/3/4/5) and pickDropTarget returns null
      schedulePostFailedDropEndgameCheck('no_target');
      return;
    }
    
    // CRITICAL: Check if target is valid (not ghost placeholder, not locked, has value > 0)
    // Also check if target is actually in tiles list (not a ghost placeholder)
    const isValidTarget = !target.destroyed &&
                          !(target as any)._ccWildSpawnDropping &&
                          isGameplayTileCandidate(target) &&
                          typeof getTiles === 'function' && 
                          getTiles().includes(target); // Make sure target is in actual tiles list
    
    // CRITICAL: Only call canDrop if target is valid
    // If target is invalid, canMerge is false
    const canMerge = isValidTarget && canDrop(t, target);
    
    if (!canMerge) {
      clearHover();
      const tileRef = t;
      snapBack(t, () => {
        if (!tileRef || tileRef.destroyed) return;
        if (tileRef.special === 'wild-magnet') {
          try { import('./fx.js').then(fx => { if (fx?.startMagnetIdleParticles) fx.startMagnetIdleParticles(tileRef); }).catch(() => {}); } catch {}
        }
        if (tileRef.special === 'wild-juice') {
          try { import('./fx.js').then(fx => { if (fx?.startWildJuiceBubbles) fx.startWildJuiceBubbles(tileRef); }).catch(() => {}); } catch {}
        }
        if (tileRef.special === 'wild-tnt') {
          try {
            import('./fx.js').then(fxModule => {
              if (fxModule?.startTntIdleParticles) fxModule.startTntIdleParticles(tileRef);
              if (fxModule?.startTntIdleShake) fxModule.startTntIdleShake(tileRef);
            }).catch(() => {});
          } catch {}
        }
      });
      
      // 🔥 CRITICAL: Check stuck state after failed merge attempt
      // This catches cases where user tries to merge but can't (e.g., 3+2=5 which is invalid)
      // We need to check if the board is now stuck after this failed attempt
      schedulePostFailedDropEndgameCheck('invalid_merge_target');
      return;
    }

    clearHover({ immediateMagnet: true });
    autoCenter(t, target);

    // ✅ Z-INDEX SAFETY PATCH:
    // prije merge animacije vrati pločicu na originalni sloj,
    // da NIKAD ne ostane "ispred" ostalih nakon brzih interakcija
    restoreZ(t);
    
    // Wild-juice bubbles explosion is triggered centrally in app-core effSum === 6 flow.
    
    onMerge?.(t, target, helpers);
  }

  function onCancel(e) {
    if (!isActivePointerEvent(e)) return;
    const t = drag.t;
    drag.t = null;
    finishDragPerfSample('pointercancel');
    clearHover({ immediateMagnet: true });
    clearDragRuntime();
    resumeSpecialDiceIdleAfterDrag();
    if (!t || t.destroyed) return;
    try {
      snapBack(t, () => {
        try { startSpecialDiceIdleMotion(t); } catch {}
      });
    } catch {
      try { restoreZ(t); } catch {}
    }
  }

  // === STABLE HIT-TEST: preklapanje pravokutnika, bez auto-aimanja ===
  // 🔥 PERFORMANCE: Throttle pickDropTarget to prevent lag
  let lastPickDropTime = 0;
  const PICK_DROP_THROTTLE = DRAG_HOVER_PICK_THROTTLE_MS;
  let lastPickDropResult = null;
  let lastPickDropSrc = null;
  let lastPickDropX = null;
  let lastPickDropY = null;
  let lastPickDropAllowCenterFallback = null;

  function stabilizeHoverTarget(target) {
    if (!target) {
      drag.hoverCandidate = null;
      drag.hoverCandidateFrames = 0;
      return null;
    }
    if (drag.hoverCandidate === target) {
      drag.hoverCandidateFrames += 1;
    } else {
      drag.hoverCandidate = target;
      drag.hoverCandidateFrames = 1;
    }
    return drag.hoverCandidateFrames >= 2 ? target : null;
  }
  
  function pickDropTarget(src, opts = {}) {
    const allowCenterFallback = opts.allowCenterFallback !== false;
    const pointerGlobal = opts.pointerGlobal || null;
    const force = opts.force === true;
    // 🔥 PERFORMANCE: Throttle pickDropTarget calls to prevent lag
    const now = performance.now();
    const srcX = src?.x ?? 0;
    const srcY = src?.y ?? 0;
    if (
      !force &&
      src === lastPickDropSrc &&
      lastPickDropAllowCenterFallback === allowCenterFallback &&
      now - lastPickDropTime < PICK_DROP_THROTTLE
    ) {
      return lastPickDropResult; // Return cached result if called too soon
    }
    lastPickDropTime = now;
    lastPickDropSrc = src;
    lastPickDropX = srcX;
    lastPickDropY = srcY;
    lastPickDropAllowCenterFallback = allowCenterFallback;
    if (!src || src.destroyed) return null;

    const list = (typeof getTiles === 'function' ? getTiles() : []) || [];
    if (!list || !Array.isArray(list)) return null;
    
    // CRITICAL: Filter out ghost placeholders and invalid tiles
    // Only include actual tiles with value > 0, not locked, and in tiles list
    const candidates = list.filter(t => {
      if (!isGameplayTileCandidate(t)) return false;
      if (t === src) return false;
      if ((t as any)._ccWildSpawnDropping === true) return false;
      // CRITICAL: Make sure tile has gridX and gridY (real tiles have grid positions)
      if (typeof t.gridX !== 'number' || typeof t.gridY !== 'number') return false;
      // CRITICAL: Make sure tile is in tiles list (not a ghost placeholder)
      if (!list.includes(t)) return false;
      return true;
    });

    if (!candidates.length) return null;

    const srcR = getRect(src);
    if (!srcR || srcR.w === 0 || srcR.h === 0) return null;

    const isDirectWild = (tile) => isDirectWildTile(tile);
    const isSourceDirectWild = isDirectWild(src);
    const pointerDropAllowed = pointerGlobal && src.special !== 'wild-magnet' && isSourceDirectWild;
    if (pointerDropAllowed) {
      let pointerBest = null;
      let pointerBestDist = Infinity;
      const px = Number(pointerGlobal.x);
      const py = Number(pointerGlobal.y);
      const pad = tileSize * 0.10;
      for (const t of candidates) {
        if (!isGameplayTileCandidate(t)) continue;
        if ((t as any)._ccWildSpawnDropping === true) continue;
        if (typeof canDrop === 'function' && !canDrop(src, t)) continue;
        const r = getGlobalRect(t);
        if (!r || r.w === 0 || r.h === 0) continue;
        const inside =
          px >= r.x - pad &&
          px <= r.x + r.w + pad &&
          py >= r.y - pad &&
          py <= r.y + r.h + pad;
        if (!inside) continue;
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        const dist = Math.hypot(px - cx, py - cy);
        if (dist < pointerBestDist) {
          pointerBestDist = dist;
          pointerBest = t;
        }
      }
      if (pointerBest) {
        lastPickDropResult = pointerBest;
        return pointerBest;
      }
    }
    
    let best = null;
    let bestRatio = 0;

    for (const t of candidates) {
      if (!isGameplayTileCandidate(t)) continue;
      // CRITICAL: Double-check canDrop before considering this tile
      if (typeof canDrop === 'function' && !canDrop(src, t)) continue;
      // CRITICAL: Make sure tile is still valid before checking intersection
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
        // Slightly more forgiving than before so drop behavior matches visual hover better
        const dx = Math.abs(srcCenterX - dstCenterX);
        const dy = Math.abs(srcCenterY - dstCenterY);
        const maxOffset = tileSize * 0.35; // 🔥 Max 35% offset - easier merge without requiring perfect alignment
        
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

    // 🔥 CRITICAL: For wild-magnet, use a moderate overlap threshold.
    // Previous 0.30 made drop feel too strict vs hover feedback.
    // Keep a bit stricter than baseThreshold to avoid accidental edge touches.
    const baseThreshold = Number.isFinite(drag.threshold) ? drag.threshold : 0.05;
    const th = src.special === 'wild-magnet' ? Math.max(baseThreshold, 0.12) : baseThreshold;

    // Wild-magnet uses custom hover/selection logic while dragging. Keep the final
    // drop target aligned with that visual feedback so a highlighted tile cannot
    // snap back solely because PIXI overlap/bounds were too strict on pointerup.
    const isWildMagnetTile = (tile) => tile?.special === 'wild-magnet';
    const magnetCenterFallbackAllowed = isWildMagnetTile(src);
    if (allowCenterFallback && magnetCenterFallbackAllowed && (!best || bestRatio < th)) {
      let closest = null;
      let closestDist = Infinity;
      const maxCenterDist = tileSize * 0.72;
      for (const t of candidates) {
        if (!isGameplayTileCandidate(t)) continue;
        if ((t as any)._ccWildSpawnDropping === true) continue;
        if (!isWildMagnetTile(src) && !isWildMagnetTile(t)) continue;
        if (typeof canDrop === 'function' && !canDrop(src, t)) continue;
        const dist = Math.hypot((src.x ?? 0) - (t.x ?? 0), (src.y ?? 0) - (t.y ?? 0));
        if (dist < closestDist && dist <= maxCenterDist) {
          closestDist = dist;
          closest = t;
        }
      }
      if (closest) {
        best = closest;
        bestRatio = Math.max(bestRatio, th);
      }
    }

    // Wild star/juice/tnt should be deterministic in both directions:
    // wild -> regular and regular -> wild. PIXI bounds can be stale after reparent/drop
    // or during scale tweens, so use board-space centers as a stable fallback whenever
    // overlap is missing or below threshold.
    const wildCenterFallbackAllowed = src.special !== 'wild-magnet' && isSourceDirectWild;
    if (allowCenterFallback && wildCenterFallbackAllowed && (!best || bestRatio < th)) {
      let closest = null;
      let closestDist = Infinity;
      const maxCenterDist = tileSize * 0.55;
      for (const t of candidates) {
        if (!isGameplayTileCandidate(t)) continue;
        if ((t as any)._ccWildSpawnDropping === true) continue;
        if (typeof canDrop === 'function' && !canDrop(src, t)) continue;
        const dist = Math.hypot((src.x ?? 0) - (t.x ?? 0), (src.y ?? 0) - (t.y ?? 0));
        if (dist < closestDist && dist <= maxCenterDist) {
          closestDist = dist;
          closest = t;
        }
      }
      if (closest) {
        best = closest;
        bestRatio = Math.max(bestRatio, th);
      }
    }

    // Regular dice need a small release-only grace area. Fast touch flicks can fire
    // pointerup with the finger over the intended tile while the dragged sprite's
    // last bounds are still just outside the overlap threshold.
    const regularReleaseFallbackAllowed =
      allowCenterFallback &&
      pointerGlobal &&
      src.special !== 'wild-magnet' &&
      !isSourceDirectWild;
    if (regularReleaseFallbackAllowed && (!best || bestRatio < th)) {
      let closest = null;
      let closestDist = Infinity;
      const px = Number(pointerGlobal.x);
      const py = Number(pointerGlobal.y);
      const pad = tileSize * (Number.isFinite(drag.hitPad) ? drag.hitPad : 0.22);
      const maxPointerCenterDist = tileSize * (Number.isFinite(drag.snapRadius) ? drag.snapRadius : 0.68);

      if (Number.isFinite(px) && Number.isFinite(py)) {
        for (const t of candidates) {
          if (!isGameplayTileCandidate(t)) continue;
          if ((t as any)._ccWildSpawnDropping === true) continue;
          if (typeof canDrop === 'function' && !canDrop(src, t)) continue;
          const r = getGlobalRect(t);
          if (!r || r.w === 0 || r.h === 0) continue;

          const insideReleaseArea =
            px >= r.x - pad &&
            px <= r.x + r.w + pad &&
            py >= r.y - pad &&
            py <= r.y + r.h + pad;
          if (!insideReleaseArea) continue;

          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          const dist = Math.hypot(px - cx, py - cy);
          if (dist < closestDist && dist <= maxPointerCenterDist) {
            closestDist = dist;
            closest = t;
          }
        }
      }

      if (closest) {
        best = closest;
        bestRatio = Math.max(bestRatio, th);
      }
    }
    
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
      if (!isGameplayTileCandidate(result)) {
        console.warn('⚠️ pickDropTarget: Returning non-gameplay target, returning null instead');
        return null;
      }
      if ((result as any)._ccWildSpawnDropping === true) {
        console.warn('⚠️ pickDropTarget: Target is incoming wild drop, returning null instead');
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
      
      // 🔥 CRITICAL: For wild-magnet, still reject tiny edge contacts.
      // Keep this aligned with threshold above so behavior is consistent.
      if (src.special === 'wild-magnet' && bestRatio < 0.12) {
        console.warn('⚠️ pickDropTarget: Wild-magnet overlap too small (< 0.12), returning null instead');
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
        state.moveTween = trackTween(target, {
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
        state.scaleTween = trackTween(container.scale, {
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

    // 🔥 CRITICAL FIX: Check if combination is stackable before applying magnet effect
    // This prevents magnet attraction for non-stackable combinations (e.g., 4+4)
    if (typeof canDrop === 'function' && !canDrop(src, target)) {
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
        state.scaleTween = trackTween(container.scale, {
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
      if (shouldUseTouchDragPerformanceMode()) {
        target.x = target.x + (destX - target.x) * 0.35;
        target.y = target.y + (destY - target.y) * 0.35;
        state.moveTween = null;
      } else {
        state.moveTween = trackTween(target, {
          x: destX,
          y: destY,
          duration: MAGNET_MOVE_DUR,
          ease: 'sine.out',
          overwrite: 'auto'
        });
      }
    }
  }

  function autoCenter(src, dst) {
    if (!src || src.destroyed || !dst || dst.destroyed) return;

    const destX = dst.x;
    const destY = dst.y;

    trackTween(src, {
      x: destX,
      y: destY,
      duration: 0.08,
      ease: 'sine.out',
      overwrite: 'auto'
    });

    if (src.scale) {
      trackTween(src.scale, {
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
    const scaleX = Math.abs(d.scale?.x ?? 1);
    const scaleY = Math.abs(d.scale?.y ?? 1);
    const w = Math.max(1, tileSize * scaleX);
    const h = Math.max(1, tileSize * scaleY);
    const x = Number(d.x || 0) - w / 2;
    const y = Number(d.y || 0) - h / 2;
    return { x, y, w, h };
  }

  function getGlobalRect(d) {
    if (!d || d.destroyed) return { x: 0, y: 0, w: 0, h: 0 };
    try {
      const center = d.parent?.toGlobal
        ? d.parent.toGlobal({ x: d.x || 0, y: d.y || 0 })
        : board.toGlobal({ x: d.x || 0, y: d.y || 0 });
      const boardScaleX = Math.abs(board?.worldTransform?.a || board?.scale?.x || 1);
      const boardScaleY = Math.abs(board?.worldTransform?.d || board?.scale?.y || 1);
      const scaleX = Math.abs(d.scale?.x ?? 1);
      const scaleY = Math.abs(d.scale?.y ?? 1);
      const w = Math.max(1, tileSize * scaleX * boardScaleX);
      const h = Math.max(1, tileSize * scaleY * boardScaleY);
      return { x: center.x - w / 2, y: center.y - h / 2, w, h };
    } catch {
      const b = d.getBounds?.(true) || { x: d.x, y: d.y, width: d.width || tileSize, height: d.height || tileSize };
      return { x: b.x || 0, y: b.y || 0, w: b.width || tileSize, h: b.height || tileSize };
    }
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
    frame.alpha = 0;
    frame.scale.set(0.92, 0.92);
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

    // One short confirmation pulse only when the valid target changes. This is
    // intentionally not a looping animation, so hover adds no sustained frame cost.
    (frame as any)._ccHoverInTl = trackTimeline({
      onComplete: () => { (frame as any)._ccHoverInTl = null; },
    })
      .to(frame, {
        alpha: 1,
        duration: 0.07,
        ease: 'power2.out',
      }, 0)
      .to(frame.scale, {
        x: 1,
        y: 1,
        duration: 0.115,
        ease: 'back.out(2.8)',
      }, 0);

    drag.hoverTarget = target;
    drag.hoverFrame = frame;
  }

  function isHoverValid(src, target) {
    if (!src || !target) return false;
    repairWildTileState(src);
    repairWildTileState(target);
    if ((src as any)._ccWildSpawnDropping === true || (target as any)._ccWildSpawnDropping === true) return false;
    
    // CRITICAL: Don't show hover on empty slots (ghost placeholders)
    // Only show hover on tiles with actual values
    if ((target.value|0) <= 0) return false;
    
    const srcSpecial = getTileSpecial(src);
    const targetSpecial = getTileSpecial(target);
    // Wild and special dice can merge with any valid target (show hover).
    if (
      isSpecialDiceDirectWildLikeTile(src, srcSpecial) ||
      isSpecialDiceDirectWildLikeTile(target, targetSpecial) ||
      isSpecialDiceMagnetLikeTile(src, srcSpecial) ||
      isSpecialDiceMagnetLikeTile(target, targetSpecial)
    ) return true;

    const srcVal = Number(src.value) || 0;
    const targetVal = Number(target.value) || 0;
    return srcVal + targetVal <= 6;
  }

  function clearHover(opts = {}) {
    releaseMagnet({ immediate: !!opts.immediateMagnet });
    if (drag.hoverFrame) {
      try {
        (drag.hoverFrame as any)._ccHoverInTl?.kill?.();
        gsap.killTweensOf(drag.hoverFrame);
        gsap.killTweensOf(drag.hoverFrame.scale);
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

  function snapBack(t, onSnapBackComplete) {
    if (isVerboseGameplayLogsEnabled()) {
      console.log('🔍 SNAPBACK: Tile at', t?.gridX, t?.gridY, 'value:', t?.value, 'locked:', t?.locked);
    }
    releaseMagnet({ immediate: true });
    restoreGridCell(t); // Restore to grid before snapping back
    
    // 🔥 NOTE: Do not cleanup explosion state on snapBack; this can race with real merge explosion
    
    // Ghost placeholders are now fixed and always visible
    
    try { gsap.killTweensOf(t); } catch {}
    try { gsap.killTweensOf(t.scale); } catch {}

    // Return along the shortest path. A compact landing squash communicates the
    // occupied grid cell without the old left/right shake feeling punitive.
    const tl = trackTimeline({
      onComplete: () => {
        if (t?.scale) t.scale.set(1, 1);
        if (t) t.rotation = 0;
        restoreZ(t);
        try { onSnapBackComplete?.(t); } catch {}
      }
    });
    tl.to(t, {
      x: drag.startX,
      y: drag.startY,
      rotation: 0,
      duration: 0.18,
      ease: 'back.out(1.65)',
    }, 0)
      .to(t.scale, {
        x: 1.035,
        y: 0.965,
        duration: 0.13,
        ease: 'power2.in',
      }, 0)
      .to(t.scale, {
        x: 1,
        y: 1,
        duration: 0.105,
        ease: 'back.out(2.5)',
      })
      .add(() => {
        // 🔧 SHADOW PATCH: vrati sjenu i sakrij ako je baza 0
        if (t.shadow) {
          const base = t.shadow._baseAlpha ?? 0;
          trackTween(t.shadow, {
            alpha: base,
            duration: 0.12,
            ease: 'power2.out',
            onComplete: () => { if (t.shadow) t.shadow.visible = (base > 0); }
          });
        }
      });
  }

  // 🔥 FIX: Add cleanup function to remove all listeners and clear intervals
  // This should be called when app is destroyed to prevent memory leaks
  function cleanup(options: { resumeIdle?: boolean } = {}) {
    clearDragRuntime();
    if (options.resumeIdle !== false) {
      resumeSpecialDiceIdleAfterDrag();
    } else {
      drag._pausedSpecialIdleTiles.clear();
    }
    try { clearHover({ immediateMagnet: true }); } catch {}
    try { releaseMagnet({ immediate: true }); } catch {}
    
    // Clear drag state
    drag.t = null;
    drag.hover = null;
    
    console.log('✅ Drag system cleaned up');
  }

  return Object.assign(drag, { bindToTile, clearHover, snapBack, cleanup }); 
}
