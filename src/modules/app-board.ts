// src/modules/app-board.ts
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { STATE, COLS, ROWS, TILE, GAP } from './app-state.js';
import * as makeBoard from './board.js';
import { createBoardPopInHapticSchedule, createBoardPopInPlan } from './board-popin-scheduler.js';
import { drawBoardBG, layoutBoard as layout } from './app-core.js';
import { randVal } from './app-core-utils.js';
import type { Tile } from '../types/game-types.js';
import { removeTileFully } from './tile-lifecycle-service.ts';
import { markBoardLifecycle, startBoardLifecycleFrameWindow } from '../utils/board-lifecycle-performance.ts';

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

const trackDelayedCall = (...args: Parameters<typeof gsap.delayedCall>) =>
  animationManager.trackExternalTween(gsap.delayedCall(...args));

interface SweetPopOptions {
  onHalf?: () => void;
  stepMin?: number;
  stepMax?: number;
  jitterMax?: number;
  rate?: number;
  durationScale?: number;
  signal?: AbortSignal;
}

function isFirstPlayTutorialDemoBoard(): boolean {
  return typeof window !== 'undefined' && (window as any).__ccFirstPlayTutorialActive === true;
}

function firstPlayTutorialDemoCells(): Array<{ c: number; r: number; value: number }> {
  const centerRow = Math.max(0, Math.min(ROWS - 3, Math.floor(ROWS / 2) - 1));
  const lowerRow = Math.max(2, Math.min(ROWS - 1, centerRow + 2));
  const leftCol = Math.max(0, Math.min(COLS - 3, Math.floor(COLS / 2) - 1));
  const rightCol = Math.max(2, Math.min(COLS - 1, leftCol + 2));
  const oneCol = Math.max(0, COLS - 2);
  const oneRow = Math.min(ROWS - 1, 1);
  const desired = [
    { c: leftCol, r: centerRow, value: 3 },
    { c: rightCol, r: lowerRow, value: 2 },
    { c: oneCol, r: oneRow, value: 1 },
    { c: 0, r: 0, value: 2 },
    { c: 1, r: 0, value: 2 },
    { c: 2, r: 0, value: 2 },
    { c: 0, r: 2, value: 2 },
    { c: 1, r: 2, value: 2 },
    { c: 2, r: 2, value: 1 },
    { c: 3, r: 2, value: 1 },
    { c: 0, r: ROWS - 3, value: 2 },
    { c: 1, r: ROWS - 3, value: 2 },
    { c: 2, r: ROWS - 3, value: 2 },
    { c: COLS - 1, r: Math.min(ROWS - 1, 4), value: 2 },
    { c: 0, r: ROWS - 1, value: 2 },
    { c: 1, r: ROWS - 1, value: 2 },
    { c: 2, r: ROWS - 1, value: 1 },
    { c: 3, r: ROWS - 1, value: 1 },
  ];
  const seen = new Set<string>();
  return desired.filter(({ c, r }) => {
    const key = `${c}:${r}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return c >= 0 && c < COLS && r >= 0 && r < ROWS;
  });
}

// reset container while preserving boardBG and backgroundLayer
export function resetBoardContainer(): void {
  const { board, boardBG } = STATE;

  console.log('🔄 resetBoardContainer: Board children count:', board?.children.length);
  console.log('🔄 resetBoardContainer: Board children labels:', board?.children.map(c => (c as any).label || c.constructor.name));

  // Get backgroundLayer before removing children
  const backgroundLayer = board?.children.find(c => (c as any).label === 'BackgroundLayer');
  console.log('🔄 resetBoardContainer: Found backgroundLayer:', !!backgroundLayer);

  board?.removeChildren();
  console.log('🔄 resetBoardContainer: After removeChildren, count:', board?.children.length);

  // Re-add persistent layers
  if (board && boardBG) board.addChildAt(boardBG, 0);
  if (backgroundLayer) {
    board.addChildAt(backgroundLayer, 0); // Always at index 0 (bottom)
    console.log('✅ resetBoardContainer: Background layer preserved');
  } else {
    console.warn('⚠️ resetBoardContainer: Background layer NOT found - will need reinit');
  }

  boardBG.zIndex = -1000;
  boardBG.eventMode = 'none';

  board.sortableChildren = true;
  board.sortChildren();

  console.log('🔄 resetBoardContainer: Final children count:', board.children.length);
}

export function rebuildBoard(): void {
  resetBoardContainer();

  // destroy previous tiles
  [...STATE.tiles].forEach(t => removeTileFully(t, {
    board: STATE.board,
    grid: STATE.grid,
    tiles: STATE.tiles,
  }));
  STATE.tiles.length = 0;

  // new empty grid
  STATE.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  drawBoardBG('none');

  // create locked holders
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      makeBoard.createTile({ board: STATE.board, grid: STATE.grid, tiles: STATE.tiles, c, r, val: 0, locked: true });
      const t = STATE.grid[r][c];
      try {
        if ((t as any)?.hover) {
          (t as any).hover.x = TILE / 2;
          (t as any).hover.y = TILE / 2;
        }
      } catch {}
    }
  }

  if (isFirstPlayTutorialDemoBoard()) {
    const cells = firstPlayTutorialDemoCells();
    console.log('🔍 Opening first-play tutorial demo board with', cells.length, 'fixed tiles...');
    cells.forEach(({ c, r, value }) => {
      const t = STATE.grid[r][c] as any;
      t.locked = false;
      t.eventMode = 'static';
      t.cursor = 'pointer';
      if ((STATE as any).drag?.bindToTile) (STATE as any).drag.bindToTile(t);
      makeBoard.setValue(t, value, 0);
      t.visible = false;
      t.comboCount = 1;
    });
    try {
      (window as any).__ccFirstPlayTutorialDemoBoardReady = true;
    } catch {}
    layout();
    return;
  }

  // open ~40% as active tiles with values and bind drag
  const total = COLS * ROWS;
  const openN = Math.max(1, Math.round(total * 0.40));
  const ids = [...Array(total).keys()];
  // shuffle
  for (let i = ids.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  console.log('🔍 Opening', openN, 'tiles as active...');
  ids.slice(0, openN).forEach(idx => {
    const r = (idx / COLS) | 0, c = idx % COLS;
    const t = STATE.grid[r][c] as any;
    console.log('🔍 Opening tile at', c, r, 'was locked:', t.locked);
    t.locked = false;
    t.eventMode = 'static';
    t.cursor = 'pointer';
    if ((STATE as any).drag?.bindToTile) (STATE as any).drag.bindToTile(t); // ✅ enable drag/drop
    makeBoard.setValue(t, randVal(), 0);
    t.visible = false;    // will appear via deal-in animation
    t.comboCount = 1;
    console.log('🔍 Tile opened at', c, r, 'now locked:', t.locked, 'value:', t.value, 'ghostFrame visible:', (t as any).ghostFrame?.visible);
  });

  // layout before anim
  layout();

  // Animation is now handled in app.js
  // sweetPopIn is called from there

  // Ghost placeholders are now fixed and always visible
}

// 🔥 REMOVED: isBoardClean() - DEPRECATED function with critical bug
// This function was causing false positives when tiles were locked (e.g. during magnet pull)
// Use checkEndGame() from endgame-checker.ts instead
// Bug: STATE.tiles.every(t => t.locked || t.value <= 0) returned true when all tiles were locked,
// even if they had values > 0, causing premature "clean board" detection

// Fun bouncy animation with smart optimization
export function sweetPopIn(listTiles: Tile[], opts: SweetPopOptions = {}): Promise<void> {
  markBoardLifecycle('popin-start');
  const stopPopInFrameWindow = startBoardLifecycleFrameWindow('popin');
  const sourceTiles = [...listTiles];
  const popInPlan = createBoardPopInPlan(sourceTiles.length);
  const list = popInPlan.map((step) => sourceTiles[step.tileIndex]);
  const shouldPlayGroupedEntryHaptics =
    (window as any).__ccEnterAnimationActive === true &&
    typeof (window as any).triggerHapticImpact === 'function';

  const total = list.length || 1;
  const halfTotal = Math.ceil(total / 2); // 50% of tiles
  let halfFired = false;
  let maxEndTime = 0; // track latest finishing time of any tile

  // 🔥 FIX: Track all timelines and delayed calls for cleanup
  const activeTimelines: gsap.core.Timeline[] = [];
  const activeDelayedCalls: gsap.core.Tween[] = [];
  
  // Return a promise that resolves when all tiles are done
  return new Promise(resolve => {
    let completed = 0;
    let finished = false;
    let safetyTimeout: ReturnType<typeof setTimeout> | null = null;
    const abortPopIn = () => {
      if (finished) return;
      finished = true;
      if (safetyTimeout) {
        clearTimeout(safetyTimeout);
        safetyTimeout = null;
      }
      activeTimelines.forEach(timeline => { try { timeline.kill(); } catch {} });
      activeDelayedCalls.forEach(delayed => { try { delayed.kill(); } catch {} });
      stopPopInFrameWindow();
      markBoardLifecycle('popin-aborted');
      resolve();
    };

    const forceTileFinalState = (t: any) => {
      if (!t || t.destroyed) return;
      try { gsap.killTweensOf(t); } catch {}
      try { gsap.killTweensOf(t.scale); } catch {}
      try { gsap.killTweensOf(t.rotG); } catch {}
      t.visible = true;
      t.renderable = true;
      if (t.scale?.set) t.scale.set(1, 1);
      else if (t.scale) {
        t.scale.x = 1;
        t.scale.y = 1;
      }
      if (t.locked) {
        t.alpha = (t.value > 0) ? 0 : 0.25;
      } else {
        t.alpha = 1;
      }
      if (t.rotG) t.rotG.alpha = 1;
      if (t.base) t.base.alpha = 1;
      if (t.overlay) {
        t.overlay.alpha = 1;
        t.overlay.visible = false;
      }
      if (t.num) t.num.alpha = 1;
      if (t.pips) t.pips.alpha = 1;
      try { makeBoard.syncTileZIndex(t, STATE.board); } catch {}
    };

    const finishPopIn = (forced = false) => {
      if (finished) return;
      finished = true;
      opts.signal?.removeEventListener('abort', abortPopIn);
      if (safetyTimeout) {
        clearTimeout(safetyTimeout);
        safetyTimeout = null;
      }
      activeDelayedCalls.forEach(dc => { try { dc.kill(); } catch {} });
      if (forced) {
        activeTimelines.forEach(tl => { try { tl.kill(); } catch {} });
        list.forEach(forceTileFinalState);
      }
      try { drawBoardBG(); } catch {}
      stopPopInFrameWindow();
      markBoardLifecycle(forced ? 'popin-forced-complete' : 'popin-complete');
      resolve();
    };

    if (list.length === 0) {
      finishPopIn(false);
      return;
    }

    if (opts.signal?.aborted) {
      abortPopIn();
      return;
    }
    opts.signal?.addEventListener('abort', abortPopIn, { once: true });

    if (shouldPlayGroupedEntryHaptics) {
      createBoardPopInHapticSchedule(popInPlan).forEach((delaySeconds) => {
        const hapticCall = trackDelayedCall(delaySeconds, () => {
          try { (window as any).triggerHapticImpact?.('light'); } catch {}
        });
        activeDelayedCalls.push(hapticCall);
      });
    }

    list.forEach((t, i) => {
      const tile = t as any;
      const popStep = popInPlan[i];
      // Start hidden
      tile.visible = true;
      tile.scale.set(0);
      makeBoard.syncTileZIndex(tile, STATE.board, true);

      // alpha by lock state
      if (tile.locked) {
        tile.alpha = (tile.value > 0) ? 0 : 0.25;
      } else {
        tile.alpha = 0;
      }

      const enterDel = popStep.enterDelay;

      const amp = popStep.amplitude;
      const d1 = popStep.growDuration;
      const d2 = popStep.compressDuration;
      const d3 = popStep.settleDuration;

      const tileTimeline = trackTimeline({
        delay: enterDel,
        onComplete: () => {
          makeBoard.syncTileZIndex(tile, STATE.board);
          completed++;
          if (!halfFired && completed >= halfTotal) {
            halfFired = true;
            try { opts.onHalf?.(); } catch {}
          }
          if (completed === total) {
            const finalCall = trackDelayedCall(0.03, () => finishPopIn(false));
            activeDelayedCalls.push(finalCall);
          }
        },
      });
      activeTimelines.push(tileTimeline);

      tileTimeline.to(tile, {
          alpha: tile.locked ? (tile.value > 0 ? 0 : 0.25) : 1,
          duration: Math.max(0.12, d1 * 0.68),
          ease: 'power2.out'
        }, 0)
        .to(tile.scale, {
          x: amp,
          y: amp,
          duration: d1,
          ease: 'back.out(2.0)'
        }, 0)
        .to(tile.scale, {
          x: 0.88,
          y: 0.88,
          duration: d2,
          ease: 'power2.out'
        }, d1)
        .to(tile.scale, {
          x: 1.0,
          y: 1.0,
          duration: d3,
          ease: 'back.out(1.5)'
        }, d1 + d2);

      const endAt = popStep.endTime;
      if (endAt > maxEndTime) maxEndTime = endAt;
    });

    console.log('🎯 Starting legacy-overlap random pop-in', { tiles: list.length, ownerTimelines: activeTimelines.length });

    // Fire onHalf at 50% of overall animation timeframe as well (not only by completion)
    if (typeof opts.onHalf === 'function') {
      const fireAt = Math.max(0.01, maxEndTime * 0.5);
      const halfCall = trackDelayedCall(fireAt, () => {
        if (!halfFired) {
          halfFired = true;
          try {
            opts.onHalf();
          } catch {}
        }
      });
      activeDelayedCalls.push(halfCall);
    }
    
    // 🔥 FIX: Add safety timeout to resolve and cleanup if animations hang
    safetyTimeout = setTimeout(() => {
      console.warn('⚠️ sweetPopIn: Watchdog forced final tile state and resolved');
      finishPopIn(true);
    }, Math.max(1200, (maxEndTime + 0.65) * 1000));
    
    // Store cleanup function for external access
    (resolve as any)._cleanup = () => {
      if (safetyTimeout) clearTimeout(safetyTimeout);
      activeTimelines.forEach(tl => { try { tl.kill(); } catch {} });
      activeDelayedCalls.forEach(dc => { try { dc.kill(); } catch {} });
    };
  });
}

// Board exit animation - random order like sweetPopIn
export function sweetPopOut(listTiles: Tile[], opts: SweetPopOptions = {}): Promise<void> {
  const list = [...listTiles];

  // FULL random order — same as sweetPopIn (no reverse)
  for (let i = list.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [list[i], list[j]] = [list[j], list[i]];
  }

  // Same timing parameters as entry
  const stepMin = opts.stepMin ?? 0.020;
  const stepMax = opts.stepMax ?? 0.030;
  const jitterMax = opts.jitterMax ?? 0.18;
  const rate = opts.rate ?? 0.55;
  const durationScale = opts.durationScale ?? 1;
  const total = list.length || 1;
  const halfTotal = Math.ceil(total / 2);
  let halfFired = false;
  let maxEndTime = 0;

  // Track all GSAP timelines for cleanup
  const activeTimelines: gsap.core.Timeline[] = [];

  return new Promise(resolve => {
    let completed = 0;
    let delayedCallRef: gsap.core.Tween | null = null;
    let safetyTimeout: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (safetyTimeout) {
        clearTimeout(safetyTimeout);
        safetyTimeout = null;
      }
      if (delayedCallRef) {
        try { delayedCallRef.kill(); } catch {}
        delayedCallRef = null;
      }
      resolve();
    };

    list.forEach((t, i) => {
      const tile = t as any;
      // Safety: skip null or destroyed tiles
      if (!tile || !tile.scale || tile.alpha === undefined) {
        console.warn(`⚠️ sweetPopOut: skipping null/destroyed tile at index ${i}`);
        completed++;
        if (completed === total) finish();
        return;
      }

      const step = stepMin + Math.random() * (stepMax - stepMin);
      const burst = (Math.random() < 0.22) ? (-Math.random() * 0.16) : 0;
      const exitDel = Math.max(0, (i * step * rate) + Math.random() * jitterMax + burst);

      // Keep v401 popout behavior for normal tiles.
      // For ghost placeholders / locked tiles only, stop stale position tweens
      // but DO NOT reset x/y to 0 (that causes tiles to jump to corner).
      const isGhostOrLocked = tile.locked === true || (tile.value | 0) <= 0;
      const isBackgroundGhost = typeof tile.label === 'string' && tile.label.startsWith('Ghost_');
      if (isGhostOrLocked) {
        try { (window as any).gsap?.killTweensOf(tile, 'x,y'); } catch {}
      }
      // Background ghost Graphics fallback is drawn at absolute local coords, so
      // plain scale animates toward board origin. Re-anchor only that fallback.
      // Sprite ghosts already use anchor=0.5 and have a correct world position;
      // re-anchoring them from local bounds would set position to 0,0.
      if (isBackgroundGhost && !(tile as any).texture) {
        try {
          const b = tile.getLocalBounds?.();
          if (b && Number.isFinite(b.width) && Number.isFinite(b.height) && b.width > 0 && b.height > 0) {
            const cx = b.x + b.width * 0.5;
            const cy = b.y + b.height * 0.5;
            tile.pivot?.set?.(cx, cy);
            tile.position?.set?.(cx, cy);
          }
        } catch {}
      }

      // Duration variations (same as entry)
      const durMul = 0.55 + Math.random() * 0.20;
      const amp = 1.08 + Math.random() * 0.07;
      const d1b = 0.18 + Math.random() * 0.08;
      const d2b = 0.12 + Math.random() * 0.05;
      const d3b = 0.10 + Math.random() * 0.06;
      const d3 = Math.max(0.08, d3b * durMul * durationScale); // settle (reverse becomes first)
      const d2 = Math.max(0.08, d2b * durMul * durationScale); // compress
      const d1 = Math.max(0.10, d1b * durMul * durationScale); // blow (reverse becomes last)

      const timeline = trackTimeline({
        delay: exitDel,
        onComplete: () => {
          completed++;
          // Halfway callback (50% tiles exited)
          if (!halfFired && completed >= halfTotal) {
            halfFired = true;
            try {
              opts.onHalf?.();
            } catch {}
          }

          if (completed === total) {
            finish();
          }
        }
      });

      // Track timeline for cleanup
      activeTimelines.push(timeline);

      timeline
        // REVERSE sequence: 1.0 → 0.88 → 1.15 → 0.0
        .to(tile.scale, {
          x: 0.88,
          y: 0.88,
          duration: d3,
          ease: 'back.in(1.5)',  // reverse of back.out(1.5)
          onUpdate: function() {
            // Safety: if tile destroyed during animation, kill tween
            if (!tile || !tile.scale || !tile.parent) {
              console.warn('⚠️ sweetPopOut: tile destroyed during animation, killing tween');
              (this as any).kill();
            }
          }
        }, 0)
        .to(tile.scale, {
          x: amp,  // 1.08-1.15
          y: amp,
          duration: d2,
          ease: 'power2.in'  // reverse of power2.out
        }, d3)
        .to(tile, {
          alpha: 0,
          duration: Math.max(0.12, d1 * 0.68),
          ease: 'power2.in'  // reverse of power2.out
        }, d3)
        .to(tile.scale, {
          x: 0.0,
          y: 0.0,
          duration: d1,
          ease: 'back.in(2)'  // reverse of back.out(2)
        }, d3 + d2);

      const endAt = exitDel + d1 + d2 + d3;
      if (endAt > maxEndTime) maxEndTime = endAt;
    });

    console.log('🎯 Starting board exit pop-out — random order like entry');

    // Fire onHalf at 50% of overall animation timeframe
    if (typeof opts.onHalf === 'function') {
      const fireAt = Math.max(0.01, maxEndTime * 0.5);
      delayedCallRef = trackDelayedCall(fireAt, () => {
        if (!halfFired) {
          halfFired = true;
          try {
            opts.onHalf();
          } catch {}
        }
      });
    }
    
    // 🔥 FIX: Add safety timeout to resolve and cleanup if animations hang
    safetyTimeout = setTimeout(() => {
      console.warn('⚠️ sweetPopOut: Safety timeout - killing all timelines and resolving');
      activeTimelines.forEach(tl => { try { tl.kill(); } catch {} });
      if (delayedCallRef) { try { delayedCallRef.kill(); } catch {} }
      finish();
    }, 5000); // 5 second safety
    if (settled && safetyTimeout) {
      clearTimeout(safetyTimeout);
      safetyTimeout = null;
    }
    
    // Store cleanup function for external access
    (resolve as any)._cleanup = () => {
      if (safetyTimeout) clearTimeout(safetyTimeout);
      activeTimelines.forEach(tl => { try { tl.kill(); } catch {} });
      if (delayedCallRef) { try { delayedCallRef.kill(); } catch {} }
    };
  });
}

// Classic ring "deal-in" animation
function dealFromRim(listTiles: Tile[]): Promise<void> {
  return new Promise(resolve => {
    const size = { w: COLS * TILE + (COLS - 1) * GAP, h: ROWS * TILE + (ROWS - 1) * GAP };
    const center = { x: size.w / 2, y: size.h / 2 };
    const ring = Math.max(size.w, size.h) * 0.65;

    const list = [...listTiles];
    for (let i = list.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [list[i], list[j]] = [list[j], list[i]];
    }

    let done = 0;
    list.forEach((t) => {
      const tile = t as any;
      const target = { x: tile.x, y: tile.y };
      tile.visible = true;
      makeBoard.syncTileZIndex(tile, STATE.board, true);

      const dx = target.x - center.x, dy = target.y - center.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const sx = target.x + ux * ring, sy = target.y + uy * ring;

      const enterDur = 0.72 + Math.random() * 0.21; // 50% slower, gentler
      const baseDel = 0.03 + Math.random() * 0.06; // base minimal stagger
      const originRow = (Math.random() * ROWS) | 0;
      const originCol = (Math.random() * COLS) | 0;
      const dist = Math.hypot((tile.gridX | 0) - originCol, (tile.gridY | 0) - originRow);
      const waveSpacing = 0.045 + Math.random() * 0.020; // seconds per grid distance
      const enterDel = baseDel + dist * waveSpacing + Math.random() * 0.05;

      tile.position.set(sx, sy);
      tile.scale.set(0.92 + Math.random() * 0.06);

      trackTimeline({
        delay: enterDel,
        onComplete: () => {
          makeBoard.syncTileZIndex(tile, STATE.board);
          if (++done === list.length) resolve();
        }
      })
        .to(tile, {
          x: target.x,
          y: target.y,
          duration: enterDur,
          ease: 'elastic.out(1,0.70)',
          onUpdate: () => {
            try {
              (tile as any).refreshShadow?.();
            } catch {}
          }
        }, 0)
        .to(tile.scale, {
          x: 1,
          y: 1,
          duration: enterDur,
          ease: 'elastic.out(1,0.70)'
        }, 0);
    });
  });
}
