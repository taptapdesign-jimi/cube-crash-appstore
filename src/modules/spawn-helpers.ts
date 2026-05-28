// @ts-nocheck
// public/src/modules/spawn-helpers.ts
// Spawn/deal animacije – iOS friendly, Promise-based, bez side‑effecta izvan proslijeđenih argumenata.

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { syncTileZIndex } from './board.js';
import { randomRegularTileValue } from './app-core-utils.js';
import type { Tile } from '../types/game-types.js';

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

const trackTween = (target: any, vars: any) => animationManager.trackExternalTween(gsap.to(target, vars));

interface SpawnBounceOptions {
  startScale?: number;
  max?: number;
  compress?: number;
  rebound?: number;
  wiggle?: number;
  fadeIn?: number;
  timeScale?: number;
  /** When true, tile stays at 100% opacity (no fade from 0). Use for locked→active spawn after merge 6. */
  keepFullOpacity?: boolean;
}

interface DealFromRimParams {
  listTiles?: Tile[];
  board?: any;
  boardSize?: { w: number; h: number };
  gsap?: typeof gsap;
}

interface OpenEmptiesParams {
  count?: number;
  tiles?: Tile[];
  drag?: any;
  makeBoard?: any;
  gsap?: typeof gsap;
  drawBoardBG?: () => void;
  TILE?: number;
  fixHoverAnchor?: (t: Tile) => void;
}

export function spawnBounce(
  t: any,
  gsap: typeof gsap,
  opts: SpawnBounceOptions = {},
  done?: () => void
): void {
  const {
    startScale = 0.30,
    max = 1.08,
    compress = 0.96,
    rebound = 1.02,
    wiggle = 0.035,
    fadeIn = 0.10,
    keepFullOpacity: explicitKeepFullOpacity
  } = opts || {};
  // 🔥 CRITICAL: Active tiles (non-locked) MUST always have full opacity. Default to true when tile is not locked.
  const keepFullOpacity = explicitKeepFullOpacity ?? !(t as any).locked;

  const trg = (t as any).rotG || t;
  const cell = (t as any).gridX != null && (t as any).gridY != null ? `(${(t as any).gridX},${(t as any).gridY})` : '';

  if (keepFullOpacity) {
    (t as any)._spawned = true; // Prevent sweepForUnanimatedSpawns from re-running spawnBounce without keepFullOpacity
    try {
      gsap?.killTweensOf?.(t, 'alpha');
      if ((t as any).base != null) gsap?.killTweensOf?.((t as any).base, 'alpha');
      if ((t as any).rotG != null) gsap?.killTweensOf?.((t as any).rotG, 'alpha');
    } catch (_) {}
    t.alpha = 1;
    if ((t as any).rotG != null) (t as any).rotG.alpha = 1;
    if ((t as any).base != null) (t as any).base.alpha = 1;
    if ((t as any).overlay != null) {
      (t as any).overlay.alpha = 1;
      (t as any).overlay.visible = false;
    }
    if ((t as any).num != null) (t as any).num.alpha = 1;
    if ((t as any).pips != null) (t as any).pips.alpha = 1;
  } else {
    t.alpha = 0;
  }
  t.scale.set(startScale);

  const dir = Math.random() < 0.5 ? 1 : -1;
  const finish = () => {
    try {
      if (t?.scale?.set) t.scale.set(1, 1);
      else if (t?.scale) {
        t.scale.x = 1;
        t.scale.y = 1;
      }
    } catch {}
    if (!keepFullOpacity) (t as any)._spawned = true;
    if (keepFullOpacity) {
      t.alpha = 1;
      if ((t as any).rotG != null) (t as any).rotG.alpha = 1;
      if ((t as any).base != null) (t as any).base.alpha = 1;
      if ((t as any).overlay != null) {
        (t as any).overlay.alpha = 1;
        (t as any).overlay.visible = false;
      }
      if ((t as any).num != null) (t as any).num.alpha = 1;
      if ((t as any).pips != null) (t as any).pips.alpha = 1;
    }
    if (typeof done === 'function') done();
  };
  const tl = trackTimeline({
    onComplete: finish,
    onUpdate: keepFullOpacity
      ? () => {
          t.alpha = 1;
          if ((t as any).rotG != null) (t as any).rotG.alpha = 1;
          if ((t as any).base != null) (t as any).base.alpha = 1;
          if ((t as any).overlay != null) {
            (t as any).overlay.alpha = 1;
            (t as any).overlay.visible = false;
          }
          if ((t as any).num != null) (t as any).num.alpha = 1;
          if ((t as any).pips != null) (t as any).pips.alpha = 1;
        }
      : undefined
  });

  if (!keepFullOpacity) {
    tl.to(t, { alpha: 1, duration: fadeIn, ease: 'power1.out' }, 0);
  }
  tl.to(t.scale, { x: max, y: max, duration: 0.12, ease: 'back.out(2.1)' }, 0)
    .to(t.scale, { x: compress, y: compress, duration: 0.08, ease: 'power2.inOut' })
    .to(t.scale, { x: rebound, y: rebound, duration: 0.08, ease: 'power2.out' })
    .to(t.scale, { x: 1.00, y: 1.00, duration: 0.10, ease: 'back.out(2)' });

  trackTimeline()
    .to(trg, { rotation: wiggle * dir, duration: 0.08, ease: 'power2.out' })
    .to(trg, { rotation: -wiggle * 0.6 * dir, duration: 0.10, ease: 'power2.out' })
    .to(trg, { rotation: 0, duration: 0.12, ease: 'power2.out' });
}

export function sweepForUnanimatedSpawns(tiles: Tile[], gsap: typeof gsap): void {
  try {
    tiles.forEach(t => {
      if (!t || (t as any).locked) return;
      if (!(t as any)._spawned) {
        // 🔥 Active tiles (non-locked) must always have full opacity - never fade from 0
        spawnBounce(t, gsap, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035, keepFullOpacity: true });
      }
    });
  } catch {}
}

export function dealFromRim({ listTiles = [], board, boardSize, gsap }: DealFromRimParams = {}): Promise<void> {
  // Fluid elastic deal‑in with messy row/col wave and jitter — returns Promise
  return new Promise(resolve => {
    if (!Array.isArray(listTiles) || listTiles.length === 0) {
      resolve();
      return;
    }
    
    // 🔥 FIX: Add timeout safety - if animations never complete, resolve anyway
    const safetyTimeout = setTimeout(() => {
      console.warn('⚠️ dealFromRim: Safety timeout triggered - forcing resolve');
      resolve();
    }, 5000); // 5 second safety timeout
    const size = boardSize || { w: 0, h: 0 };
    const center = { x: size.w / 2, y: size.h / 2 };
    const ring = Math.max(size.w, size.h) * 0.65;

    const list = [...listTiles];
    for (let i = list.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [list[i], list[j]] = [list[j], list[i]];
    }

    // infer grid size and choose random wave origin
    const maxRow = Math.max(0, ...list.map(t => (t as any)?.gridY | 0));
    const maxCol = Math.max(0, ...list.map(t => (t as any)?.gridX | 0));
    const rows = maxRow + 1, cols = maxCol + 1;
    const originRow = (Math.random() * rows) | 0;
    const originCol = (Math.random() * cols) | 0;
    const waveSpacing = 0.045 + Math.random() * 0.020; // seconds per grid distance

    let done = 0;
    list.forEach((t) => {
      const target = { x: (t as any).x, y: (t as any).y };
      (t as any).visible = true;
      syncTileZIndex(t, board, true);
      const dx = target.x - center.x, dy = target.y - center.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const sx = target.x + ux * ring, sy = target.y + uy * ring;

      const baseDur = 0.63 + Math.random() * 0.22;           // gentle and fluid
      const damping = 0.64 + Math.random() * 0.10;            // different per tile

      const gx = ((t as any).gridX | 0), gy = ((t as any).gridY | 0);
      const dist = Math.hypot(gx - originCol, gy - originRow);
      const waveDelay = dist * waveSpacing;
      const jitter = Math.random() * 0.06;
      const enterDel = 0.02 + Math.random() * 0.05 + waveDelay + jitter;

      (t as any).position.set(sx, sy);
      (t as any).scale.set(0.90 + Math.random() * 0.08);

      const tl = trackTimeline({
        delay: enterDel,
        onComplete: () => {
          syncTileZIndex(t, board);
          (t as any)._spawned = true;
          if (++done === list.length) {
            clearTimeout(safetyTimeout); // 🔥 FIX: Clear safety timeout on success
            resolve();
          }
        }
      });

      tl.to(t, {
        x: target.x,
        y: target.y,
        duration: baseDur,
        ease: `elastic.out(1,${damping})`,
        onUpdate: () => {
          try {
            (t as any).refreshShadow?.();
          } catch {}
        }
      }, 0)
        .to((t as any).scale, {
          x: 1,
          y: 1,
          duration: baseDur,
          ease: `elastic.out(1,${Math.max(0.60, Math.min(0.80, damping + 0.02))})`
        }, 0);
    });
  });
}

export async function openEmpties({
  count = 0,
  tiles = [],
  drag,
  makeBoard,
  gsap,
  drawBoardBG,
  TILE,
  fixHoverAnchor
}: OpenEmptiesParams = {}): Promise<void> {
  if (count <= 0) return;
  const locked = tiles.filter(t => (t as any).locked);
  if (!locked.length) return;

  for (let i = locked.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [locked[i], locked[j]] = [locked[j], locked[i]];
  }
  const picks = locked.slice(0, Math.min(count, locked.length));

  await Promise.all(picks.map(t => new Promise<void>(res => {
    (t as any).locked = false;
    (t as any).eventMode = 'static';
    (t as any).cursor = 'pointer';
    if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(t);
    makeBoard?.setValue(t, randomRegularTileValue(), 0);
    try {
      fixHoverAnchor?.(t);
    } catch {}
    spawnBounce(t, gsap, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035, keepFullOpacity: true }, res);
  })));

  try {
    drawBoardBG?.();
  } catch {}
  sweepForUnanimatedSpawns(tiles, gsap);
}
