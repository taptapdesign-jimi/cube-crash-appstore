// src/modules/app-board.ts
import { gsap } from 'gsap';
import { STATE, COLS, ROWS, TILE, GAP } from './app-state.js';
import * as makeBoard from './board.js';
import { drawBoardBG, layoutBoard as layout } from './app-core.js';
import { randVal } from './app-core-utils.js';
import type { Tile } from '../types/game-types.js';

interface SweetPopOptions {
  onHalf?: () => void;
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
  STATE.tiles.forEach(t => (t as any).destroy?.({ children: true, texture: false, textureSource: false }));
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
  const list = [...listTiles];

  // FULL random order — no spatial pattern
  for (let i = list.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [list[i], list[j]] = [list[j], list[i]];
  }

  // Tunables: jednako brzi kao "druga polovica" — sve brzo + divlji jitter
  const stepMin = 0.020, stepMax = 0.030;         // 20–30ms per index (brže)
  const jitterMax = 0.18;                         // do 180ms dodatnog jittera (wilder)
  const total = list.length || 1;
  const halfTotal = Math.ceil(total / 2); // 50% of tiles
  let halfFired = false;
  let maxEndTime = 0; // track latest finishing time of any tile

  // Return a promise that resolves when all tiles are done
  return new Promise(resolve => {
    let completed = 0;

    list.forEach((t, i) => {
      const tile = t as any;
      // Start hidden
      tile.visible = true;
      tile.scale.set(0);
      tile.zIndex = 100;

      // alpha by lock state
      if (tile.locked) {
        tile.alpha = (tile.value > 0) ? 0 : 0.25;
      } else {
        tile.alpha = 0;
      }

      const p = i / Math.max(1, total - 1); // progress 0..1 po random listi
      const step = stepMin + Math.random() * (stepMax - stepMin);
      // Stalno BRZO: koristimo fast rate iz "druge polovice" za sve
      const rate = 0.55; // isto kao kasni dio prijašnje verzije
      // Povremeni "burst" – dio kockica krene ranije
      const burst = (Math.random() < 0.22) ? (-Math.random() * 0.16) : 0; // do -160ms
      const enterDel = Math.max(0, (i * step * rate) + Math.random() * jitterMax + burst);

      // Trajanja uvijek brza, s blagom varijacijom
      const durMul = 0.55 + Math.random() * 0.20; // 0.55–0.75
      const amp = 1.08 + Math.random() * 0.07;     // 1.08–1.15
      const d1b = 0.18 + Math.random() * 0.08;
      const d2b = 0.12 + Math.random() * 0.05;
      const d3b = 0.10 + Math.random() * 0.06;
      const d1 = Math.max(0.10, d1b * durMul); // blow
      const d2 = Math.max(0.08, d2b * durMul); // compress
      const d3 = Math.max(0.08, d3b * durMul); // settle

      gsap.timeline({
        delay: enterDel,
        onComplete: () => {
          tile.zIndex = 10;
          completed++;
          // Halfway callback
          if (!halfFired && completed >= halfTotal) {
            halfFired = true;
            try {
              opts.onHalf?.();
            } catch {}
          }

          if (completed === total) {
            gsap.delayedCall(0.03, () => {
              try {
                drawBoardBG();
              } catch {}
              resolve();
            });
          }
        }
      })
        .to(tile, {
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

      // Accumulate latest finishing time for time-based halfway trigger
      const endAt = enterDel + d1 + d2 + d3;
      if (endAt > maxEndTime) maxEndTime = endAt;
    });

    console.log('🎯 Starting pure random stagger pop-in — all fast like late-half', { stepMin, stepMax, jitterMax });

    // Fire onHalf at 50% of overall animation timeframe as well (not only by completion)
    if (typeof opts.onHalf === 'function') {
      const fireAt = Math.max(0.01, maxEndTime * 0.5);
      gsap.delayedCall(fireAt, () => {
        if (!halfFired) {
          halfFired = true;
          try {
            opts.onHalf();
          } catch {}
        }
      });
    }
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
  const stepMin = 0.020, stepMax = 0.030;
  const jitterMax = 0.18;
  const total = list.length || 1;
  const halfTotal = Math.ceil(total / 2);
  let halfFired = false;
  let maxEndTime = 0;

  // Track all GSAP timelines for cleanup
  const activeTimelines: gsap.core.Timeline[] = [];

  return new Promise(resolve => {
    let completed = 0;

    list.forEach((t, i) => {
      const tile = t as any;
      // Safety: skip null or destroyed tiles
      if (!tile || !tile.scale || tile.alpha === undefined) {
        console.warn(`⚠️ sweetPopOut: skipping null/destroyed tile at index ${i}`);
        completed++;
        if (completed === total) resolve();
        return;
      }

      const step = stepMin + Math.random() * (stepMax - stepMin);
      const rate = 0.55;
      const burst = (Math.random() < 0.22) ? (-Math.random() * 0.16) : 0;
      const exitDel = Math.max(0, (i * step * rate) + Math.random() * jitterMax + burst);

      // Duration variations (same as entry)
      const durMul = 0.55 + Math.random() * 0.20;
      const amp = 1.08 + Math.random() * 0.07;
      const d1b = 0.18 + Math.random() * 0.08;
      const d2b = 0.12 + Math.random() * 0.05;
      const d3b = 0.10 + Math.random() * 0.06;
      const d3 = Math.max(0.08, d3b * durMul); // settle (reverse becomes first)
      const d2 = Math.max(0.08, d2b * durMul); // compress
      const d1 = Math.max(0.10, d1b * durMul); // blow (reverse becomes last)

      const timeline = gsap.timeline({
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
            resolve();
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
      gsap.delayedCall(fireAt, () => {
        if (!halfFired) {
          halfFired = true;
          try {
            opts.onHalf();
          } catch {}
        }
      });
    }
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
      tile.zIndex = 100;
      STATE.board.sortChildren?.();

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

      gsap.timeline({
        delay: enterDel,
        onComplete: () => {
          tile.zIndex = 10;
          STATE.board.sortChildren?.();
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

