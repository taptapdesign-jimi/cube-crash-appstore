// @ts-nocheck
import { gsap } from 'gsap';
import { Graphics } from 'pixi.js';
import { COLS, GAP, ROWS, STATE, TILE } from './app-state.js';
import { setValue as setBoardValue } from './board.js';
import { startWildStars } from './fx.ts';
import { cleanupSmokeBubbles } from './hud-helpers.ts';
import { isSpecialDiceStarLikeTile } from './special-dice-registry.ts';

const FORCE_NEXT_KEY = 'cc_first_play_tutorial_force_next';
const DONE_KEY = 'cc_first_play_tutorial_done';
const ACTIVE_ATTR = 'data-first-play-tutorial';
const POINTER_SRC = './assets/hand-pointer.png';

type TutorialRunSource = 'arcade' | 'journey';
type TutorialStep = 1 | 2 | 3 | 4;

let active = false;
let runSource: TutorialRunSource | null = null;
let currentStep: TutorialStep = 1;
let pollTimer: number | null = null;
let targetTiles: any[] = [];
let targetCellThree: { c: number; r: number } | null = null;
let targetCellTwo: { c: number; r: number } | null = null;
let introTimers: number[] = [];
let secondStepTile: any | null = null;
let pointerAnimationKey = '';
let stepThreePointerTimeline: gsap.core.Timeline | null = null;
let stepFourPointerTimeline: gsap.core.Timeline | null = null;
let stepFourPointerLoopTimer: number | null = null;
let firstStepUserInteracted = false;
let secondStepUserInteracted = false;
let stepTransitioning = false;
let secondStepCompleting = false;
let fourthStepCompleting = false;
let stepFourPrepared = false;
let stepFourWildTile: any | null = null;
let stepFourTargetTile: any | null = null;
let hudDimTimer: number | null = null;
let boardDimTimer: number | null = null;
const hudOriginalAlpha = new WeakMap<object, number>();
const hudDomOriginalOpacity = new WeakMap<HTMLElement, string>();
const hudOriginalEventMode = new WeakMap<object, any>();
const hudOriginalInteractive = new WeakMap<object, any>();
const hudOriginalCursor = new WeakMap<object, any>();
let hudDimStarted = false;
let stepThreeGhostSuppressionActive = false;
let stepThreeBackgroundLayer: any | null = null;
let stepThreeBackgroundLayerOriginalVisible: boolean | null = null;
let scheduledTimeouts: number[] = [];
let scheduledAnimationFrames: number[] = [];

const stepCopy: Record<TutorialStep, { title: string; subtitle: string }> = {
  1: {
    title: 'Drag to stack',
    subtitle: 'Drag a dice onto another dice.',
  },
  2: {
    title: 'Merge dice',
    subtitle: 'Drag to stack this dice to make 6.',
  },
  3: {
    title: 'Clear the board',
    subtitle: 'Stack and merge dice until\nthe board is clear.',
  },
  4: {
    title: 'Special dice',
    subtitle: 'They can merge with any regular\ndice to get the value 6',
  },
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function scheduleTimeout(callback: () => void, delay: number): number {
  const timer = window.setTimeout(() => {
    scheduledTimeouts = scheduledTimeouts.filter((id) => id !== timer);
    callback();
  }, delay);
  scheduledTimeouts.push(timer);
  return timer;
}

function scheduleAnimationFrame(callback: FrameRequestCallback): number {
  const frame = window.requestAnimationFrame((time) => {
    scheduledAnimationFrames = scheduledAnimationFrames.filter((id) => id !== frame);
    callback(time);
  });
  scheduledAnimationFrames.push(frame);
  return frame;
}

function clearScheduledWork(): void {
  scheduledTimeouts.forEach((timer) => window.clearTimeout(timer));
  scheduledTimeouts = [];
  scheduledAnimationFrames.forEach((frame) => window.cancelAnimationFrame(frame));
  scheduledAnimationFrames = [];
}

function setWildMeterSmokeFrozen(frozen: boolean): void {
  try {
    if (frozen) {
      (window as any).__ccFirstPlayTutorialFreezeWildMeterSmoke = true;
      cleanupSmokeBubbles();
    } else {
      delete (window as any).__ccFirstPlayTutorialFreezeWildMeterSmoke;
      cleanupSmokeBubbles();
      scheduleTimeout(() => {
        try { cleanupSmokeBubbles(); } catch {}
      }, 180);
    }
  } catch {}
}

function stopTutorialBoardAssist(): void {
  try {
    delete (window as any).__ccFirstPlayTutorialSlowWildMeter;
  } catch {}
}

function isTutorialHudLockActive(): boolean {
  if (!isBrowser()) return false;
  return active || (window as any).__ccFirstPlayTutorialSlowWildMeter === true;
}

function setLowTutorialBoardValue(tile: any, index: number): void {
  if (!tile || tile.destroyed || tile.special || isWildStarTile(tile) || (tile.value | 0) <= 0) return;
  const previousLocked = tile.locked === true;
  const previousAlpha = Number.isFinite(tile.alpha) ? tile.alpha : 1;
  const nextValue = index % 11 === 10 ? 3 : (index % 2) + 1;
  setTileValue(tile, nextValue);
  forceTutorialTileValueVisual(tile, nextValue);
  tile.locked = previousLocked;
  tile.alpha = previousLocked ? getNormalTileAlpha(tile) : previousAlpha;
  if (previousLocked) {
    tile.eventMode = 'none';
    tile.cursor = 'default';
  }
}

function initializeLowTutorialBoardValues(reservedTiles: any[]): void {
  const reserved = new Set(reservedTiles.filter(Boolean));
  (STATE.tiles || [])
    .filter((tile: any) => tile && !tile.destroyed && !reserved.has(tile))
    .sort((a: any, b: any) => {
      const ar = Number.isFinite(a.gridY) ? a.gridY : 0;
      const br = Number.isFinite(b.gridY) ? b.gridY : 0;
      if (ar !== br) return ar - br;
      const ac = Number.isFinite(a.gridX) ? a.gridX : 0;
      const bc = Number.isFinite(b.gridX) ? b.gridX : 0;
      return ac - bc;
    })
    .forEach(setLowTutorialBoardValue);
}

function startTutorialBoardAssist(): void {
  try {
    (window as any).__ccFirstPlayTutorialSlowWildMeter = true;
  } catch {}
}

export function isFirstPlayTutorialForced(): boolean {
  if (!isBrowser()) return false;
  return localStorage.getItem(FORCE_NEXT_KEY) === 'true' || localStorage.getItem(DONE_KEY) !== 'true';
}

export function armFirstPlayTutorial(): void {
  if (!isBrowser()) return;
  localStorage.setItem(FORCE_NEXT_KEY, 'true');
  localStorage.removeItem(DONE_KEY);
  (window as any).__ccFirstPlayTutorialArmed = true;
}

export function resetFirstPlayTutorialRequest(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(FORCE_NEXT_KEY);
  localStorage.setItem(DONE_KEY, 'true');
  delete (window as any).__ccFirstPlayTutorialArmed;
}

export function setFirstPlayTutorialDevEnabled(enabled: boolean): void {
  if (enabled) {
    armFirstPlayTutorial();
  } else {
    resetFirstPlayTutorialRequest();
  }
}

export function beginFirstPlayTutorialRun(source: TutorialRunSource): boolean {
  if (!isBrowser() || active) return false;
  if (!isFirstPlayTutorialForced()) return false;

  stopPolling();
  stopStepThreeBoardDim();
  stopHudDim(true);
  stopTutorialBoardAssist();
  clearIntroTimers();
  clearScheduledWork();
  removeOverlay();

  localStorage.removeItem(FORCE_NEXT_KEY);
  delete (window as any).__ccFirstPlayTutorialArmed;
  delete (window as any).__ccFirstPlayTutorialDemoBoardReady;
  localStorage.removeItem(DONE_KEY);
  active = true;
  runSource = source;
  currentStep = 1;
  firstStepUserInteracted = false;
  secondStepUserInteracted = false;
  stepTransitioning = false;
  secondStepCompleting = false;
  fourthStepCompleting = false;
  stepFourPrepared = false;
  stepFourWildTile = null;
  stepFourTargetTile = null;
  (window as any).__ccFirstPlayTutorialActive = true;
  (window as any).__ccFirstPlayTutorialCanDrop = isTutorialDropAllowed;
  (window as any).__ccFirstPlayTutorialDisplaceWildSpawnOccupant = displaceFourthStepWildSpawnOccupant;
  setWildMeterSmokeFrozen(true);
  hudDimStarted = false;
  return true;
}

export function isFirstPlayTutorialActive(): boolean {
  return active;
}

function ensureStyles(): void {
  if (document.getElementById('first-play-tutorial-styles')) return;
  const style = document.createElement('style');
  style.id = 'first-play-tutorial-styles';
  style.textContent = `
    .first-play-tutorial-overlay {
      position: fixed;
      inset: 0;
      z-index: 1200000;
      pointer-events: none;
      font-family: "Baloo2", system-ui, -apple-system, sans-serif;
    }
    .first-play-tutorial-dim {
      position: absolute;
      inset: 0;
      background: rgba(255, 247, 239, 0.08);
    }
    .first-play-tutorial-pointer {
      position: absolute;
      width: min(34vw, 190px);
      height: auto;
      z-index: 3;
      pointer-events: none;
      filter: drop-shadow(0 14px 18px rgba(161, 96, 69, 0.22));
      transform-origin: 72% 22%;
    }
    .first-play-tutorial-pointer-image {
      display: block;
      width: 100%;
      height: auto;
      transform-origin: 50% 50%;
      pointer-events: none;
    }
    .first-play-tutorial-sheet {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      min-height: 178px;
      padding: 58px 28px calc(62px + env(safe-area-inset-bottom, 0px));
      border-radius: 36px 36px 0 0;
      background: rgba(255, 253, 249, 0.96) url('./assets/paper-bg.png') center/cover no-repeat;
      box-shadow: 0 -18px 45px rgba(173, 118, 92, 0.14);
      z-index: 4;
      pointer-events: auto;
      text-align: center;
    }
    .first-play-tutorial-grabber {
      width: 48px;
      height: 7px;
      border-radius: 999px;
      background: rgba(189, 156, 139, 0.25);
      margin: 0 auto 26px;
    }
    .first-play-tutorial-title {
      margin: 0;
      color: #AD8775;
      font-size: 40px;
      font-weight: 900;
      line-height: 1.2;
      letter-spacing: 0;
    }
    .first-play-tutorial-title strong {
      color: #E97A55;
      font-weight: inherit;
    }
    .first-play-tutorial-subtitle {
      margin: 8px auto 0;
      max-width: 280px;
      color: #B48572;
      font-size: 20px;
      font-weight: 500;
      line-height: 1.4;
      letter-spacing: 0;
      white-space: pre-line;
    }
    .first-play-tutorial-cta {
      display: none;
      width: 100%;
      max-width: 310px;
      height: 64px;
      min-height: 64px;
      margin: 34px auto 0;
      border: 0;
      border-radius: 40px;
      color: #FFFBF2;
      background: #E97A55;
      box-shadow: 0 8px 0 0 #C24921;
      font-family: "Baloo2", system-ui, -apple-system, sans-serif;
      font-size: 28px;
      font-weight: bold;
      text-shadow: 0 2px 0 #C24921;
      letter-spacing: 0;
      line-height: normal;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
    .first-play-tutorial-cta.is-visible {
      display: flex;
    }
    .first-play-tutorial-cta:hover {
      transform: scale(1);
      box-shadow: 0 8px 0 0 #C24921;
      background: #E97A55;
      color: #FFFBF2;
    }
    .first-play-tutorial-cta:active,
    .first-play-tutorial-cta:focus,
    .first-play-tutorial-cta:focus-visible {
      transform: scale(0.80);
      transition: transform 0.35s ease;
      outline: none;
    }
    @media screen and (min-width: 768px) and (max-width: 1400px) {
      .first-play-tutorial-cta {
        max-width: 249px;
      }
    }
    @media screen and (max-width: 428px) {
      .first-play-tutorial-title {
        font-size: 32px;
      }
      .first-play-tutorial-subtitle {
        font-size: 18px;
      }
      .first-play-tutorial-cta {
        max-width: 249px;
        font-size: 28px;
        padding: 0 56px;
      }
    }
    .first-play-tutorial-dev-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 1300000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(55, 38, 31, 0.35);
      font-family: "Baloo2", system-ui, -apple-system, sans-serif;
    }
    .first-play-tutorial-dev-modal {
      width: min(100%, 420px);
      border-radius: 28px;
      padding: 28px;
      background: #fffaf4 url('./assets/paper-bg.png') center/cover no-repeat;
      box-shadow: 0 20px 60px rgba(90, 70, 57, 0.22);
      text-align: center;
    }
    .first-play-tutorial-dev-modal h2 {
      margin: 0 0 12px;
      color: #E8744A;
      font-size: 34px;
      line-height: 1;
    }
    .first-play-tutorial-dev-modal p {
      margin: 0 0 22px;
      color: #AD8775;
      font-size: 20px;
      line-height: 1.25;
      font-weight: 700;
    }
    .first-play-tutorial-dev-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .first-play-tutorial-dev-actions button {
      border: 0;
      border-radius: 18px;
      min-height: 54px;
      color: white;
      background: #E8744A;
      box-shadow: 0 7px 0 #C95E39;
      font: inherit;
      font-size: 20px;
      font-weight: 900;
    }
    .first-play-tutorial-dev-actions button[data-action="reset"] {
      background: #735C4C;
      box-shadow: 0 7px 0 #5A4639;
    }
  `;
  document.head.appendChild(style);
}

function getActiveTiles(): any[] {
  return (STATE.tiles || [])
    .filter((tile: any) => tile && !tile.destroyed && !tile.locked && (tile.value | 0) > 0)
    .sort((a: any, b: any) => {
      const ay = Number.isFinite(a.gridY) ? a.gridY : 0;
      const by = Number.isFinite(b.gridY) ? b.gridY : 0;
      if (ay !== by) return by - ay;
      const ax = Number.isFinite(a.gridX) ? a.gridX : 0;
      const bx = Number.isFinite(b.gridX) ? b.gridX : 0;
      return ax - bx;
    });
}

function findWildTile(): any | null {
  return getActiveTiles().find((tile: any) => (
    isWildStarTile(tile)
  )) || null;
}

function isWildStarTile(tile: any): boolean {
  return !!tile && !tile.destroyed && isSpecialDiceStarLikeTile(tile);
}

function setTileValue(tile: any, value: number): void {
  if (!tile) return;
  try {
    tile.special = null;
    tile.isWild = false;
    tile.isWildFace = false;
    tile._spawned = true;
    const makeBoard = (window as any).CC?.makeBoard;
    if (makeBoard?.setValue) {
      makeBoard.setValue(tile, value, 0);
    } else {
      tile.value = value;
    }
    tile.locked = false;
    tile.visible = true;
    tile.alpha = 1;
    tile.eventMode = 'static';
  } catch {
    tile.value = value;
  }
}

function forceTutorialTileValueVisual(tile: any, value: number): void {
  if (!tile || tile.destroyed) return;
  tile.value = value;
  tile.locked = false;
  tile.special = null;
  tile.isWild = false;
  tile.isWildFace = false;
  tile.visible = true;
  tile.alpha = 1;
  if (tile.base) {
    tile.base.visible = true;
    tile.base.alpha = 1;
  }
  if (tile.pips) {
    tile.pips.visible = true;
    tile.pips.alpha = 1;
  }
  if (tile.num) {
    tile.num.visible = false;
  }
  try {
    const makeBoard = (window as any).CC?.makeBoard;
    makeBoard?.drawStack?.(tile);
    makeBoard?.drawPips?.(tile);
  } catch {}
  drawTutorialPips(tile, value);
}

function drawTutorialPips(tile: any, value: number): void {
  if (!tile || tile.destroyed) return;
  const host = tile.rotG || tile;
  let pips = tile.pips;
  if (!pips || pips.destroyed) {
    pips = new Graphics();
    tile.pips = pips;
    host.addChild(pips);
  } else if (pips.parent !== host) {
    try { pips.parent?.removeChild?.(pips); } catch {}
    host.addChild(pips);
  }
  try { pips.clear(); } catch {}
  try { pips.position?.set?.(0, 0); } catch {}
  try { pips.pivot?.set?.(0, 0); } catch {}
  try { pips.scale?.set?.(1, 1); } catch {}
  try { pips.rotation = 0; } catch {}
  pips.visible = true;
  pips.alpha = 1;
  pips.zIndex = 50;
  try { host.sortableChildren = true; } catch {}

  const side = TILE * 0.42;
  const half = side / 2;
  const size = Math.max(9, Math.round(TILE * 0.12));
  const radius = Math.round(size * 0.34);
  const xs = [-half, 0, half];
  const ys = [-half, 0, half];
  const idx = (cx: number, cy: number) => cy * 3 + cx;
  const maps: Record<number, number[]> = {
    1: [4],
    2: [idx(0, 0), idx(2, 2)],
    3: [idx(0, 0), 4, idx(2, 2)],
    4: [idx(0, 0), idx(2, 0), idx(0, 2), idx(2, 2)],
    5: [idx(0, 0), idx(2, 0), 4, idx(0, 2), idx(2, 2)],
    6: [idx(0, 0), idx(2, 0), idx(0, 1), idx(2, 1), idx(0, 2), idx(2, 2)],
  };
  const points = maps[Math.max(1, Math.min(6, value | 0))] || maps[1];
  for (const point of points) {
    const x = xs[point % 3];
    const y = ys[Math.floor(point / 3)];
    if (typeof pips.roundRect === 'function' && typeof pips.fill === 'function') {
      pips.roundRect(x - size / 2, y - size / 2, size, size, radius).fill({ color: 0x8f6a55, alpha: 0.96 });
    } else {
      pips.beginFill?.(0x8f6a55, 0.96);
      pips.drawRoundedRect?.(x - size / 2, y - size / 2, size, size, radius);
      pips.endFill?.();
    }
  }
  try { host.sortChildren?.(); } catch {}
}

function clearGridReference(tile: any): void {
  const grid = STATE.grid || [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r]?.length || 0); c++) {
      if (grid[r][c] === tile) {
        grid[r][c] = null;
      }
    }
  }
}

function placeTile(tile: any, c: number, r: number): void {
  if (!tile || !STATE.grid) return;
  const existing = STATE.grid?.[r]?.[c];
  if (existing && existing !== tile) {
    clearGridReference(existing);
  }
  clearGridReference(tile);
  STATE.grid[r] = STATE.grid[r] || [];
  STATE.grid[r][c] = tile;
  tile.gridX = c;
  tile.gridY = r;
  const x = c * (TILE + GAP) + TILE / 2;
  const y = r * (TILE + GAP) + TILE / 2;
  tile.targetX = x;
  tile.targetY = y;
  tile.x = x;
  tile.y = y;
  try {
    tile.position?.set?.(x, y);
    tile.refreshShadow?.();
  } catch {}
}

function normalizeTutorialTileVisual(tile: any): void {
  if (!tile || tile.destroyed) return;
  try { gsap.killTweensOf(tile); } catch {}
  try { gsap.killTweensOf(tile.scale); } catch {}
  try { gsap.killTweensOf(tile.rotG); } catch {}
  try { gsap.killTweensOf(tile.rotG?.scale); } catch {}
  try {
    tile.stackDepth = 1;
    tile.scale?.set?.(1, 1);
    tile.rotG?.scale?.set?.(1, 1);
    tile.pivot?.set?.(0, 0);
    const makeBoard = (window as any).CC?.makeBoard;
    makeBoard?.drawStack?.(tile);
    makeBoard?.drawPips?.(tile);
  } catch {}
}

function setTutorialTileFocus(tile: any, focused: boolean): void {
  if (!tile || tile.destroyed) return;
  normalizeTutorialTileVisual(tile);
  tile.visible = true;
  tile.eventMode = focused ? 'static' : 'none';
  tile.cursor = focused ? 'pointer' : 'default';
  if (focused) {
    drawTutorialPips(tile, tile.value || 1);
    bindTutorialTile(tile);
  } else {
    unbindTutorialTile(tile);
  }
  gsap.to(tile, {
    alpha: focused ? 1 : 0.2,
    duration: focused ? 0.22 : 0.42 + Math.random() * 0.22,
    delay: focused ? 0 : Math.random() * 0.28,
    ease: 'sine.inOut',
    overwrite: true,
  });
}

function setTileInteractivity(tile: any, enabled: boolean): void {
  if (!tile || tile.destroyed) return;
  tile.eventMode = enabled ? 'static' : 'none';
  tile.cursor = enabled ? 'pointer' : 'default';
  if (enabled) {
    bindTutorialTile(tile);
  } else {
    unbindTutorialTile(tile);
  }
}

function markTutorialPointerDown(): void {
  if (active && currentStep === 1) {
    firstStepUserInteracted = true;
  } else if (active && currentStep === 2) {
    secondStepUserInteracted = true;
  }
}

function dismissTutorialFromDrag(): void {
  if (active && currentStep === 3) {
    dismissThirdStepAndWaitForWild();
  }
}

function bindTutorialTile(tile: any): void {
  if (!tile || tile.destroyed) return;
  try { (STATE as any).drag?.bindToTile?.(tile); } catch {}
  try { tile.off?.('pointerdown', markTutorialPointerDown); } catch {}
  try { tile.on?.('pointerdown', markTutorialPointerDown); } catch {}
}

function unbindTutorialTile(tile: any): void {
  if (!tile || tile.destroyed) return;
  try { tile.off?.('pointerdown', markTutorialPointerDown); } catch {}
  try { tile.off?.('pointerdown', dismissTutorialFromDrag); } catch {}
  try { tile.removeAllListeners?.('pointerdown'); } catch {}
}

function chooseTileForCell(tiles: any[], c: number, r: number, reserved: any[] = []): any | null {
  const existing = STATE.grid?.[r]?.[c];
  if (existing && !existing.destroyed && !reserved.includes(existing)) return existing;
  return tiles.find((tile: any) => tile && !tile.destroyed && !reserved.includes(tile)) || null;
}

function prepareTutorialBoard(): void {
  const tiles = (STATE.tiles || [])
    .filter((tile: any) => tile && !tile.destroyed && tile.scale)
    .sort((a: any, b: any) => {
      const ay = Number.isFinite(a.gridY) ? a.gridY : 0;
      const by = Number.isFinite(b.gridY) ? b.gridY : 0;
      if (ay !== by) return ay - by;
      const ax = Number.isFinite(a.gridX) ? a.gridX : 0;
      const bx = Number.isFinite(b.gridX) ? b.gridX : 0;
      return ax - bx;
    });
  if (tiles.length < 2) return;

  const centerRow = Math.max(0, Math.min(ROWS - 3, Math.floor(ROWS / 2) - 1));
  const lowerRow = Math.max(2, Math.min(ROWS - 1, centerRow + 2));
  const leftCol = Math.max(0, Math.min(COLS - 3, Math.floor(COLS / 2) - 1));
  const rightCol = Math.max(2, Math.min(COLS - 1, leftCol + 2));
  const oneCol = Math.max(0, COLS - 2);
  const oneRow = Math.min(ROWS - 1, 1);
  const tileThree = chooseTileForCell(tiles, leftCol, centerRow) || tiles[0];
  const tileTwo = chooseTileForCell(tiles, rightCol, lowerRow, [tileThree]) || tiles.find((tile: any) => tile !== tileThree) || tiles[1];
  const tileOne = chooseTileForCell(tiles, oneCol, oneRow, [tileThree, tileTwo]);
  if (!tileThree || !tileTwo) return;
  targetTiles = [tileThree, tileTwo];
  targetCellThree = { c: leftCol, r: centerRow };
  targetCellTwo = { c: rightCol, r: lowerRow };
  secondStepTile = tileOne;
  firstStepUserInteracted = false;

  tiles.forEach((tile: any) => {
    tile.__firstPlayTutorialTarget = tile === tileThree || tile === tileTwo || tile === tileOne;
    normalizeTutorialTileVisual(tile);
  });
  if ((window as any).__ccFirstPlayTutorialDemoBoardReady !== true) {
    initializeLowTutorialBoardValues([tileThree, tileTwo, tileOne]);
  }

  placeTile(tileThree, leftCol, centerRow);
  placeTile(tileTwo, rightCol, lowerRow);
  if (tileOne) placeTile(tileOne, oneCol, oneRow);
  setTileValue(tileThree, 3);
  setTileValue(tileTwo, 2);
  if (tileOne) setTileValue(tileOne, 1);
  forceTutorialTileValueVisual(tileThree, 3);
  forceTutorialTileValueVisual(tileTwo, 2);
  if (tileOne) forceTutorialTileValueVisual(tileOne, 1);

  try {
    (window as any).CC?.layoutBoard?.();
  } catch {}

  // layoutBoard positions the board container, not individual tiles. Re-apply exact tile coordinates after it.
  placeTile(tileThree, leftCol, centerRow);
  placeTile(tileTwo, rightCol, lowerRow);
  if (tileOne) placeTile(tileOne, oneCol, oneRow);
  setTileValue(tileThree, 3);
  setTileValue(tileTwo, 2);
  if (tileOne) setTileValue(tileOne, 1);
  normalizeTutorialTileVisual(tileThree);
  normalizeTutorialTileVisual(tileTwo);
  if (tileOne) normalizeTutorialTileVisual(tileOne);
  forceTutorialTileValueVisual(tileThree, 3);
  forceTutorialTileValueVisual(tileTwo, 2);
  if (tileOne) forceTutorialTileValueVisual(tileOne, 1);

  scheduleAnimationFrame(() => {
    placeTile(tileThree, leftCol, centerRow);
    placeTile(tileTwo, rightCol, lowerRow);
    if (tileOne) placeTile(tileOne, oneCol, oneRow);
    forceTutorialTileValueVisual(tileThree, 3);
    forceTutorialTileValueVisual(tileTwo, 2);
    if (tileOne) forceTutorialTileValueVisual(tileOne, 1);
    setTutorialTileFocus(tileThree, true);
    setTutorialTileFocus(tileTwo, true);
    if (tileOne) setTutorialTileFocus(tileOne, false);
    scheduleAnimationFrame(() => {
      placeTile(tileThree, leftCol, centerRow);
      placeTile(tileTwo, rightCol, lowerRow);
      if (tileOne) placeTile(tileOne, oneCol, oneRow);
      forceTutorialTileValueVisual(tileThree, 3);
      forceTutorialTileValueVisual(tileTwo, 2);
      if (tileOne) forceTutorialTileValueVisual(tileOne, 1);
      setTutorialTileFocus(tileThree, true);
      setTutorialTileFocus(tileTwo, true);
      if (tileOne) setTutorialTileFocus(tileOne, false);
      updateFocus(false);
    });
  });

  (STATE.tiles || []).forEach((tile: any) => {
    const focused = tile === tileTwo || tile === tileThree;
    setTutorialTileFocus(tile, focused);
  });
  if (tileOne) {
    forceTutorialTileValueVisual(tileOne, 1);
    setTutorialTileFocus(tileOne, false);
  }
  startFirstStepMonitor();
}

function tileRect(tile: any): DOMRect | null {
  const app = STATE.app;
  const canvas = app?.canvas || document.querySelector('#app canvas');
  if (!tile || !canvas) return null;
  const canvasRect = canvas.getBoundingClientRect();
  let point = tile.getGlobalPosition ? tile.getGlobalPosition() : { x: tile.x || 0, y: tile.y || 0 };
  try {
    const bounds = tile.getBounds?.();
    if (bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && bounds.width > 0 && bounds.height > 0) {
      point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    }
  } catch {}
  const screenW = app?.screen?.width || canvasRect.width || 1;
  const screenH = app?.screen?.height || canvasRect.height || 1;
  const x = canvasRect.left + (point.x / screenW) * canvasRect.width;
  const y = canvasRect.top + (point.y / screenH) * canvasRect.height;
  const w = Math.max(52, ((tile.width || 72) / screenW) * canvasRect.width);
  const h = Math.max(52, ((tile.height || 72) / screenH) * canvasRect.height);
  return new DOMRect(x - w / 2, y - h / 2, w, h);
}

function combinedRect(rects: Array<DOMRect | null>): DOMRect | null {
  const valid = rects.filter(Boolean) as DOMRect[];
  if (!valid.length) return null;
  const left = Math.min(...valid.map((rect) => rect.left));
  const top = Math.min(...valid.map((rect) => rect.top));
  const right = Math.max(...valid.map((rect) => rect.right));
  const bottom = Math.max(...valid.map((rect) => rect.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

function titleHtml(step: TutorialStep): string {
  if (step === 2) return '<strong>Merge</strong> dice';
  if (step === 3) return '<strong>Clear</strong> the board';
  if (step === 4) return '<strong>Special</strong> dice';
  return '<strong>Drag</strong> to stack';
}

function updateSheet(step: TutorialStep): void {
  const overlay = document.querySelector('.first-play-tutorial-overlay') as HTMLElement | null;
  if (!overlay) return;
  const title = overlay.querySelector('.first-play-tutorial-title') as HTMLElement | null;
  const subtitle = overlay.querySelector('.first-play-tutorial-subtitle') as HTMLElement | null;
  const cta = overlay.querySelector('.first-play-tutorial-cta') as HTMLElement | null;
  if (title) title.innerHTML = titleHtml(step);
  if (subtitle) subtitle.textContent = stepCopy[step].subtitle;
  if (cta) cta.classList.toggle('is-visible', step === 3);
}

function getSheetElement(): HTMLElement | null {
  return document.querySelector('.first-play-tutorial-sheet') as HTMLElement | null;
}

function transitionSheetToStep(step: TutorialStep, onEntered?: () => void): void {
  const sheet = getSheetElement();
  if (!sheet) {
    updateSheet(step);
    onEntered?.();
    return;
  }

  stepTransitioning = true;
  gsap.killTweensOf(sheet);
  gsap.to(sheet, {
    y: '100%',
    duration: 0.28,
    ease: 'power2.in',
    overwrite: true,
    onComplete: () => {
      updateSheet(step);
      gsap.set(sheet, { y: '100%' });
      gsap.to(sheet, {
        y: 0,
        duration: 0.42,
        ease: 'back.out(1.25)',
        overwrite: true,
        onComplete: () => {
          stepTransitioning = false;
          onEntered?.();
        },
      });
    },
  });
}

function exitCurrentSheet(onExited?: () => void): void {
  const sheet = getSheetElement();
  if (!sheet) {
    onExited?.();
    return;
  }
  stepTransitioning = true;
  gsap.killTweensOf(sheet);
  gsap.to(sheet, {
    y: '100%',
    duration: 0.28,
    ease: 'power2.in',
    overwrite: true,
    onComplete: () => {
      stepTransitioning = false;
      onExited?.();
    },
  });
}

function updateFocus(forceRestart = false): void {
  const overlay = document.querySelector('.first-play-tutorial-overlay') as HTMLElement | null;
  if (!overlay) return;
  const pointer = overlay.querySelector('.first-play-tutorial-pointer') as HTMLElement | null;
  const [tileThree, tileTwo] = targetTiles;
  if (!pointer) return;

  const pointerStart = targetCellThree ? cellRect(targetCellThree.c, targetCellThree.r) : tileRect(tileThree);
  const pointerEnd = targetCellTwo ? cellRect(targetCellTwo.c, targetCellTwo.r) : tileRect(tileTwo);
  if (!pointerStart || !pointerEnd) return;

  const startX = pointerStart.left + pointerStart.width * 0.5 + 16;
  const startY = pointerStart.top + pointerStart.height * 0.5;
  const endX = pointerEnd.left + pointerEnd.width * 0.5 + 16;
  const endY = pointerEnd.top + pointerEnd.height * 0.5;
  const pointerRect = pointer.getBoundingClientRect();
  const pointerWidth = pointerRect.width || 180;
  const pointerHeight = pointerRect.height || 180;
  const fingertipX = pointerWidth * 0.16;
  const fingertipY = pointerHeight * 0.12;
  pointer.style.left = `${startX - fingertipX}px`;
  pointer.style.top = `${startY - fingertipY}px`;

  const animationKey = [
    currentStep,
    Math.round(startX),
    Math.round(startY),
    Math.round(endX),
    Math.round(endY),
  ].join(':');
  if (!forceRestart && pointerAnimationKey === animationKey) return;
  pointerAnimationKey = animationKey;
  gsap.killTweensOf(pointer);
  gsap.set(pointer, { x: 0, y: 0, scale: 1, rotate: -8 });
  gsap.to(pointer, {
    x: endX - startX,
    y: endY - startY,
    scale: 0.94,
    rotate: -1,
    duration: 1.18,
    ease: 'power1.inOut',
    repeat: -1,
    yoyo: true,
    repeatDelay: 0.12,
  });
}

function stopStepThreePointerHint(): void {
  try { stepThreePointerTimeline?.kill(); } catch {}
  stepThreePointerTimeline = null;
}

function stopStepFourPointerHint(): void {
  try { stepFourPointerTimeline?.kill(); } catch {}
  stepFourPointerTimeline = null;
  if (stepFourPointerLoopTimer !== null) {
    window.clearTimeout(stepFourPointerLoopTimer);
    scheduledTimeouts = scheduledTimeouts.filter((id) => id !== stepFourPointerLoopTimer);
    stepFourPointerLoopTimer = null;
  }
}

function pointerFingertipOffset(pointer: HTMLElement): { x: number; y: number } {
  const pointerRect = pointer.getBoundingClientRect();
  const pointerWidth = pointerRect.width || 180;
  const pointerHeight = pointerRect.height || 180;
  return {
    x: pointerWidth * 0.16,
    y: pointerHeight * 0.12,
  };
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function buildStepThreePointerMoves(): Array<{ from: DOMRect; to: DOMRect }> {
  const maxHintRow = Math.min(ROWS - 1, 4);
  const candidates = getActiveTiles()
    .filter((tile: any) => (
      tile &&
      !tile.destroyed &&
      !tile.locked &&
      !tile.special &&
      Number.isFinite(tile.gridY) &&
      (tile.gridY | 0) <= maxHintRow &&
      (tile.value | 0) > 0
    ))
    .map((tile: any) => ({ tile, rect: tileRect(tile) }))
    .filter((entry: any) => !!entry.rect);

  const movesByDirection: Record<string, Array<{ from: DOMRect; to: DOMRect }>> = {
    right: [],
    left: [],
    down: [],
    up: [],
  };

  for (const from of candidates) {
    for (const to of candidates) {
      if (from.tile === to.tile) continue;
      const dx = (to.tile.gridX | 0) - (from.tile.gridX | 0);
      const dy = (to.tile.gridY | 0) - (from.tile.gridY | 0);
      if (dx === 0 && dy === 0) continue;
      const direction = Math.abs(dx) >= Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down' : 'up');
      movesByDirection[direction].push({ from: from.rect as DOMRect, to: to.rect as DOMRect });
    }
  }

  const moves: Array<{ from: DOMRect; to: DOMRect }> = [];
  shuffleInPlace(['right', 'down', 'left', 'up']).forEach((direction) => {
    const options = shuffleInPlace(movesByDirection[direction] || []);
    if (options[0]) moves.push(options[0]);
  });

  if (moves.length >= 2) return shuffleInPlace(moves).slice(0, 4);

  const fallbackCells: Array<{ c: number; r: number }> = [
    { c: Math.max(0, Math.floor(COLS / 2) - 1), r: 1 },
    { c: Math.min(COLS - 1, Math.floor(COLS / 2) + 1), r: 1 },
    { c: Math.min(COLS - 1, Math.floor(COLS / 2) + 1), r: 3 },
    { c: Math.max(0, Math.floor(COLS / 2) - 1), r: 3 },
    { c: Math.max(0, Math.floor(COLS / 2)), r: 4 },
  ];
  const rects = fallbackCells
    .map((cell) => cellRect(cell.c, Math.min(maxHintRow, cell.r)))
    .filter(Boolean) as DOMRect[];
  return rects.length >= 2
    ? shuffleInPlace([
        { from: rects[0], to: rects[1] },
        { from: rects[1], to: rects[2] || rects[0] },
        { from: rects[3] || rects[0], to: rects[2] || rects[1] },
      ])
    : [];
}

function startStepThreePointerHint(): void {
  if (!active || currentStep !== 3) return;
  const pointer = getPointerShell();
  const image = getPointerImage();
  if (!pointer || !image) return;
  const moves = buildStepThreePointerMoves();
  if (!moves.length) return;

  stopStepThreePointerHint();
  pointerAnimationKey = `step3:${Date.now()}:${Math.random()}`;
  pointer.style.display = 'block';
  const fingertip = pointerFingertipOffset(pointer);
  gsap.killTweensOf(pointer);
  gsap.killTweensOf(image);
  gsap.set(image, { opacity: 1, scale: 1, rotate: 0 });

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.16 });
  moves.forEach((move, index) => {
    const startX = move.from.left + move.from.width * 0.5 + 16;
    const startY = move.from.top + move.from.height * 0.5;
    const endX = move.to.left + move.to.width * 0.5 + 16;
    const endY = move.to.top + move.to.height * 0.5;
    const dx = endX - startX;
    const dy = endY - startY;
    const base = index * 1.08;
    tl.set(pointer, {
      left: startX - fingertip.x,
      top: startY - fingertip.y,
      x: 0,
      y: 0,
      opacity: 0,
      scale: 0.9,
      rotate: -8,
    }, base)
      .to(pointer, { opacity: 1, scale: 1, duration: 0.16, ease: 'back.out(1.8)' }, base)
      .to(pointer, {
        x: dx,
        y: dy,
        scale: 0.94,
        rotate: dx >= 0 ? -1 : -12,
        duration: 0.58,
        ease: 'power1.inOut',
      }, base + 0.16)
      .to(pointer, { opacity: 0, scale: 0.86, duration: 0.16, ease: 'sine.in' }, base + 0.84);
  });
  stepThreePointerTimeline = tl;
}

function getFourthStepMaxTargetRow(): number {
  return Math.min(ROWS - 1, 5);
}

function getFourthStepCandidateTiles(wildTile = stepFourWildTile): any[] {
  const maxSafeRow = getFourthStepMaxTargetRow();
  return getActiveTiles().filter((tile: any) => (
    tile &&
    tile !== wildTile &&
    !tile.destroyed &&
    !tile.locked &&
    !tile.special &&
    (tile.value | 0) > 0 &&
    Number.isFinite(tile.gridY) &&
    (tile.gridY | 0) <= maxSafeRow
  ));
}

function isFourthStepAllowedTarget(tile: any): boolean {
  return !!tile &&
    !tile.destroyed &&
    !tile.locked &&
    !tile.special &&
    (tile.value | 0) > 0 &&
    Number.isFinite(tile.gridY) &&
    (tile.gridY | 0) <= getFourthStepMaxTargetRow();
}

function startStepFourPointerHint(): void {
  if (!active || currentStep !== 4 || !stepFourPrepared) return;
  const wildTile = stepFourWildTile || targetTiles[0];
  if (!wildTile || wildTile.destroyed) return;
  const pointer = getPointerShell();
  const image = getPointerImage();
  if (!pointer || !image) return;

  stopStepFourPointerHint();
  pointer.style.display = 'block';
  const fingertip = pointerFingertipOffset(pointer);
  gsap.killTweensOf(pointer);
  gsap.killTweensOf(image);
  gsap.set(image, { opacity: 1, scale: 1, rotate: 0 });

  const playOne = () => {
    if (!active || currentStep !== 4 || !stepFourPrepared) return;
    const sourceRect = tileRect(wildTile);
    const candidates = shuffleInPlace(getFourthStepCandidateTiles(wildTile).slice());
    const targetRect = candidates[0] ? tileRect(candidates[0]) : null;
    if (!sourceRect || !targetRect) {
      stepFourPointerLoopTimer = scheduleTimeout(playOne, 420);
      return;
    }

    const startX = sourceRect.left + sourceRect.width * 0.5 + 16;
    const startY = sourceRect.top + sourceRect.height * 0.5;
    const endX = targetRect.left + targetRect.width * 0.5 + 16;
    const endY = targetRect.top + targetRect.height * 0.5;
    const dx = endX - startX;
    const dy = endY - startY;

    try { stepFourPointerTimeline?.kill(); } catch {}
    stepFourPointerTimeline = gsap.timeline({
      onComplete: () => {
        stepFourPointerLoopTimer = scheduleTimeout(playOne, 180);
      },
    });
    stepFourPointerTimeline
      .set(pointer, {
        left: startX - fingertip.x,
        top: startY - fingertip.y,
        x: 0,
        y: 0,
        opacity: 0,
        scale: 0.9,
        rotate: -8,
      })
      .to(pointer, { opacity: 1, scale: 1, duration: 0.16, ease: 'back.out(1.8)' }, 0)
      .to(pointer, {
        x: dx,
        y: dy,
        scale: 0.94,
        rotate: dx >= 0 ? -1 : -12,
        duration: 0.62,
        ease: 'power1.inOut',
      }, 0.16)
      .to(pointer, { opacity: 0, scale: 0.86, duration: 0.16, ease: 'sine.in' }, 0.86);
  };

  playOne();
}

function getPointerShell(): HTMLElement | null {
  return document.querySelector('.first-play-tutorial-pointer') as HTMLElement | null;
}

function getPointerImage(): HTMLElement | null {
  return document.querySelector('.first-play-tutorial-pointer-image') as HTMLElement | null;
}

function popInPointer(): void {
  const pointer = getPointerShell();
  const image = getPointerImage();
  if (!pointer || !image) return;
  stopStepThreePointerHint();
  stopStepFourPointerHint();
  pointer.style.display = 'block';
  updateFocus(true);
  gsap.killTweensOf(image);
  gsap.set(image, { opacity: 0, scale: 0, rotate: -8 });
  gsap.timeline({ defaults: { overwrite: 'auto' } })
    .to(image, { opacity: 1, duration: 0.08, ease: 'sine.out' }, 0)
    .to(image, { scale: 1.14, rotate: 2, duration: 0.22, ease: 'back.out(2.2)' }, 0)
    .to(image, { scale: 0.94, rotate: -2, duration: 0.11, ease: 'power2.out' })
    .to(image, { scale: 1, rotate: 0, duration: 0.16, ease: 'back.out(1.7)' });
}

function popOutPointer(onComplete?: () => void): void {
  const image = getPointerImage();
  const pointer = getPointerShell();
  stopStepThreePointerHint();
  stopStepFourPointerHint();
  if (!image) {
    onComplete?.();
    return;
  }
  gsap.killTweensOf(image);
  if (pointer) gsap.killTweensOf(pointer);
  gsap.to(image, {
    opacity: 0,
    scale: 0,
    rotate: -8,
    duration: 0.2,
    ease: 'back.in(1.7)',
    overwrite: true,
    onComplete: () => {
      if (pointer) pointer.style.display = 'none';
      onComplete?.();
    },
  });
}

function cellRect(c: number, r: number): DOMRect | null {
  const app = STATE.app;
  const board = STATE.board;
  const canvas = app?.canvas || document.querySelector('#app canvas');
  if (!app || !board || !canvas) return null;
  const x = c * (TILE + GAP) + TILE / 2;
  const y = r * (TILE + GAP) + TILE / 2;
  let point = { x, y };
  try { point = board.toGlobal?.({ x, y }) || point; } catch {}
  const canvasRect = canvas.getBoundingClientRect();
  const screenW = app?.screen?.width || canvasRect.width || 1;
  const screenH = app?.screen?.height || canvasRect.height || 1;
  const cx = canvasRect.left + (point.x / screenW) * canvasRect.width;
  const cy = canvasRect.top + (point.y / screenH) * canvasRect.height;
  const size = Math.max(52, (TILE / screenW) * canvasRect.width);
  return new DOMRect(cx - size / 2, cy - size / 2, size, size);
}

function renderOverlay(): void {
  removeOverlay();
  pointerAnimationKey = '';
  ensureStyles();

  const overlay = document.createElement('div');
  overlay.className = 'first-play-tutorial-overlay';
  overlay.setAttribute(ACTIVE_ATTR, 'true');
  overlay.innerHTML = `
    <div class="first-play-tutorial-dim"></div>
    <div class="first-play-tutorial-pointer">
      <img class="first-play-tutorial-pointer-image" src="${POINTER_SRC}" alt="" aria-hidden="true">
    </div>
    <section class="first-play-tutorial-sheet" aria-live="polite">
      <h2 class="first-play-tutorial-title">${titleHtml(currentStep)}</h2>
      <p class="first-play-tutorial-subtitle">${stepCopy[currentStep].subtitle}</p>
      <button class="first-play-tutorial-cta" type="button">Got it!</button>
    </section>
  `;
  document.body.appendChild(overlay);

  const pointer = overlay.querySelector('.first-play-tutorial-pointer') as HTMLElement | null;
  const pointerImage = overlay.querySelector('.first-play-tutorial-pointer-image') as HTMLElement | null;
  const sheet = overlay.querySelector('.first-play-tutorial-sheet') as HTMLElement | null;
  if (pointer) {
    pointer.style.display = 'none';
    gsap.set(pointer, { opacity: 1 });
  }
  if (pointerImage) gsap.set(pointerImage, { opacity: 0, scale: 0 });
  if (sheet) gsap.set(sheet, { y: '100%' });
  const cta = overlay.querySelector('.first-play-tutorial-cta') as HTMLElement | null;
  cta?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (currentStep === 3) {
      dismissThirdStepAndWaitForWild();
    }
  });

  clearIntroTimers();
  introTimers.push(scheduleTimeout(() => {
    popInPointer();
    scheduleAnimationFrame(() => updateFocus(false));
  }, 1200));
  introTimers.push(scheduleTimeout(() => {
    if (sheet) {
      gsap.to(sheet, { y: 0, duration: 0.42, ease: 'back.out(1.25)' });
    }
  }, 800));
}

function clearIntroTimers(): void {
  introTimers.forEach((timer) => window.clearTimeout(timer));
  introTimers = [];
}

function startFirstStepMonitor(): void {
  stopPolling();
  pollTimer = window.setInterval(() => {
    if (!active || currentStep !== 1) return;
    if (!firstStepUserInteracted) return;
    const mergedTile = findMergedFiveTile();
    if (!mergedTile) return;
    stopPolling();
    popOutPointer(() => {
      exitCurrentSheet(() => {
        scheduleTimeout(() => activateSecondStep(mergedTile), 90);
      });
    });
  }, 120);
}

function findMergedFiveTile(): any | null {
  const [tileThree, tileTwo] = targetTiles;
  return [tileThree, tileTwo].find((tile) => tile && !tile.destroyed && (tile.value | 0) === 5) || null;
}

function isTutorialDropAllowed(src: any, dst: any): boolean {
  if (!active) return true;
  if (!src || !dst || src.destroyed || dst.destroyed) return false;
  const [first, second] = targetTiles;
  if (currentStep === 1) {
    const isTutorialPair =
      (src === first && dst === second) ||
      (src === second && dst === first);
    if (!isTutorialPair) return false;
    const values = [src.value | 0, dst.value | 0].sort((a, b) => a - b);
    return values[0] === 2 && values[1] === 3;
  }
  if (currentStep === 2) {
    const isTutorialPair =
      (src === first && dst === second) ||
      (src === second && dst === first);
    if (!isTutorialPair) return false;
    const values = [src.value | 0, dst.value | 0].sort((a, b) => a - b);
    return values[0] === 1 && values[1] === 5;
  }
  if (currentStep === 4) {
    const srcWild = isWildStarTile(src);
    const dstWild = isWildStarTile(dst);
    if (srcWild === dstWild) return false;
    const other = srcWild ? dst : dstWild ? src : null;
    return isFourthStepAllowedTarget(other);
  }
  return true;
}

function animateSecondStepOneTileIn(tile: any): void {
  if (!tile || tile.destroyed) return;
  gsap.killTweensOf(tile);
  if (tile.scale) gsap.killTweensOf(tile.scale);
  tile.visible = true;
  tile.alpha = 0;
  try {
    tile.scale?.set?.(0.72);
  } catch {
    if (tile.scale) {
      tile.scale.x = 0.72;
      tile.scale.y = 0.72;
    }
  }
  const refresh = () => {
    try { tile.refreshShadow?.(); } catch {}
  };
  const tl = gsap.timeline({ overwrite: true, onUpdate: refresh, onComplete: refresh });
  tl.to(tile, { alpha: 1, duration: 0.16, ease: 'sine.out' }, 0)
    .to(tile.scale, { x: 1.14, y: 1.14, duration: 0.22, ease: 'back.out(2.5)' }, 0)
    .to(tile.scale, { x: 1, y: 1, duration: 0.18, ease: 'sine.out' }, 0.22);
}

function activateSecondStep(mergedTile: any): void {
  if (!active || !mergedTile || mergedTile.destroyed) return;
  currentStep = 2;
  secondStepUserInteracted = false;
  secondStepCompleting = false;
  const oneCol = Math.max(0, COLS - 2);
  const oneRow = Math.min(ROWS - 1, 1);
  const oneTile = (secondStepTile && !secondStepTile.destroyed && secondStepTile !== mergedTile)
    ? secondStepTile
    : pickSecondStepTile(mergedTile, oneCol, oneRow);
  if (!oneTile) return;
  secondStepTile = oneTile;

  setTileValue(mergedTile, 5);
  forceTutorialTileValueVisual(mergedTile, 5);
  setTileValue(oneTile, 1);
  placeTile(oneTile, oneCol, oneRow);
  forceTutorialTileValueVisual(oneTile, 1);

  targetTiles = [mergedTile, oneTile];
  targetCellThree = { c: mergedTile.gridX | 0, r: mergedTile.gridY | 0 };
  targetCellTwo = { c: oneCol, r: oneRow };

  (STATE.tiles || []).forEach((tile: any) => {
    const focused = tile === mergedTile || tile === oneTile;
    if (focused) {
      normalizeTutorialTileVisual(tile);
      drawTutorialPips(tile, tile === oneTile ? 1 : 5);
      if (tile === oneTile) {
        animateSecondStepOneTileIn(tile);
      } else {
        gsap.to(tile, { alpha: 1, duration: 0.22, ease: 'sine.inOut', overwrite: true });
      }
    } else {
      gsap.to(tile, {
        alpha: 0.2,
        duration: 0.32 + Math.random() * 0.2,
        delay: Math.random() * 0.16,
        ease: 'sine.inOut',
        overwrite: true,
      });
    }
    setTileInteractivity(tile, focused);
  });

  startSecondStepMonitor();
  scheduleTimeout(() => {
    if (!active || currentStep !== 2) return;
    updateFocus(true);
    popInPointer();
  }, 400);
  transitionSheetToStep(currentStep, () => {
    if (!active || currentStep !== 2) return;
    scheduleAnimationFrame(() => {
      forceTutorialTileValueVisual(mergedTile, 5);
      forceTutorialTileValueVisual(oneTile, 1);
      updateFocus(false);
    });
  });
}

function pickSecondStepTile(mergedTile: any, c: number, r: number): any | null {
  const existing = STATE.grid?.[r]?.[c];
  if (existing && existing !== mergedTile && !existing.destroyed) return existing;
  return (STATE.tiles || []).find((tile: any) => tile && !tile.destroyed && tile !== mergedTile && !targetTiles.includes(tile)) || null;
}

function startSecondStepMonitor(): void {
  stopPolling();
  pollTimer = window.setInterval(() => {
    if (!active || currentStep !== 2) return;
    const done = isSecondStepComplete();
    if (!done) return;
    completeSecondStep();
  }, 40);
}

function isSecondStepComplete(): boolean {
  const [fiveTile, oneTile] = targetTiles;
  const hasSix = (STATE.tiles || []).some((tile: any) => (
    tile &&
    !tile.destroyed &&
    !tile.locked &&
    (tile.value | 0) === 6
  ));
  if (hasSix) return true;
  if (!secondStepUserInteracted) return false;

  const fiveStillFive = fiveTile && !fiveTile.destroyed && (fiveTile.value | 0) === 5;
  const oneStillOne = oneTile && !oneTile.destroyed && (oneTile.value | 0) === 1;
  return !(fiveStillFive && oneStillOne);
}

function completeSecondStep(): void {
  if (!active || currentStep !== 2 || secondStepCompleting) return;
  secondStepCompleting = true;
  stopPolling();
  popOutPointer(() => {
    exitCurrentSheet(() => {
      scheduleTimeout(() => activateThirdStep(), 90);
    });
  });
}

function activateThirdStep(): void {
  if (!active || currentStep === 3) return;
  currentStep = 3;
  secondStepCompleting = false;
  targetTiles = [];
  targetCellThree = null;
  targetCellTwo = null;
  pointerAnimationKey = '';
  restoreBoardAndHudOpacity(false, false);
  stopHudDim(true, true);
  restoreAllTileInteractivityForFreePlay();
  transitionSheetToStep(currentStep, () => {
    if (!active || currentStep !== 3) return;
    scheduleTimeout(() => {
      if (!active || currentStep !== 3) return;
      startStepThreePointerHint();
    }, 260);
  });
}

function restoreAllTileInteractivityForFreePlay(): void {
  (STATE.tiles || []).forEach((tile: any) => {
    if (!tile || tile.destroyed || tile.locked || (tile.value | 0) <= 0) return;
    try { tile.off?.('pointerdown', dismissTutorialFromDrag); } catch {}
    try { (STATE as any).drag?.bindToTile?.(tile); } catch {}
    try { tile.on?.('pointerdown', dismissTutorialFromDrag); } catch {}
  });
}

function restoreNormalGameplayDrag(final = false): void {
  if (final) {
    try {
      delete (window as any).__ccFirstPlayTutorialCanDrop;
      delete (window as any).__ccFirstPlayTutorialActive;
      delete (window as any).__ccFirstPlayTutorialWildSpawnCell;
      delete (window as any).__ccFirstPlayTutorialForceWildStar;
      delete (window as any).__ccFirstPlayTutorialDisplaceWildSpawnOccupant;
      delete (window as any).__ccFirstPlayTutorialDemoBoardReady;
    } catch {}
  }

  (STATE.tiles || []).forEach((tile: any) => {
    if (!tile || tile.destroyed) return;
    try { tile.off?.('pointerdown', markTutorialPointerDown); } catch {}
    try { tile.off?.('pointerdown', dismissTutorialFromDrag); } catch {}
    if (final) {
      try { delete tile.__firstPlayTutorialTarget; } catch {}
    }

    if (tile.locked || (tile.value | 0) <= 0) {
      tile.eventMode = 'none';
      tile.cursor = 'default';
      return;
    }

    tile.visible = true;
    tile.alpha = 1;
    tile.eventMode = 'static';
    tile.cursor = 'pointer';
    try { (STATE as any).drag?.bindToTile?.(tile); } catch {}
  });
}

function getBackgroundLayer(): any | null {
  try {
    return STATE.board?.children?.find?.((child: any) => child && child.label === 'BackgroundLayer') ?? null;
  } catch {
    return null;
  }
}

function suppressStepThreeGhosts(): void {
  if (!isBrowser()) return;
  try { (window as any).__ccForceHideGhosts = true; } catch {}
  try { (window as any).hideGhostPlaceholders?.(); } catch {}

  try {
    const ghosts = (window as any)._ghostPlaceholders;
    if (Array.isArray(ghosts)) {
      ghosts.forEach((row: any[]) => {
        if (!Array.isArray(row)) return;
        row.forEach((ghost: any) => {
          if (!ghost || ghost.destroyed) return;
          ghost.visible = false;
          ghost.alpha = 0;
        });
      });
    }
  } catch {}

  const backgroundLayer = getBackgroundLayer();
  if (backgroundLayer && !backgroundLayer.destroyed) {
    if (!stepThreeGhostSuppressionActive || stepThreeBackgroundLayer !== backgroundLayer) {
      stepThreeBackgroundLayer = backgroundLayer;
      stepThreeBackgroundLayerOriginalVisible = backgroundLayer.visible !== false;
    }
    backgroundLayer.visible = false;
  }
  stepThreeGhostSuppressionActive = true;
}

function restoreStepThreeGhosts(): void {
  if (!isBrowser()) return;
  try { (window as any).__ccForceHideGhosts = false; } catch {}

  const backgroundLayer = stepThreeBackgroundLayer || getBackgroundLayer();
  if (backgroundLayer && !backgroundLayer.destroyed) {
    backgroundLayer.visible = stepThreeBackgroundLayerOriginalVisible ?? true;
  }

  try {
    const ghosts = (window as any)._ghostPlaceholders;
    if (Array.isArray(ghosts)) {
      ghosts.forEach((row: any[]) => {
        if (!Array.isArray(row)) return;
        row.forEach((ghost: any) => {
          if (!ghost || ghost.destroyed) return;
          ghost.alpha = 1;
        });
      });
    }
  } catch {}
  try { (window as any).updateGhostVisibility?.(); } catch {}

  stepThreeGhostSuppressionActive = false;
  stepThreeBackgroundLayer = null;
  stepThreeBackgroundLayerOriginalVisible = null;
}

function stopStepThreeBoardDim(): void {
  if (boardDimTimer !== null) {
    window.clearInterval(boardDimTimer);
    boardDimTimer = null;
  }
}

function getNormalTileAlpha(tile: any): number {
  if (!tile?.locked) return 1;
  return 0.2;
}

function restoreBoardAndHudOpacity(immediate = false, restoreHud = true): void {
  stopStepThreeBoardDim();
  restoreStepThreeGhosts();
  const orderedTiles = (STATE.tiles || [])
    .filter((tile: any) => tile && !tile.destroyed)
    .map((tile: any) => ({ tile, order: Math.random() }))
    .sort((a: any, b: any) => a.order - b.order);

  orderedTiles.forEach(({ tile }: any) => {
    if (!tile || tile.destroyed) return;
    tile.visible = true;
    if (immediate) {
      gsap.killTweensOf(tile);
      if (tile.scale) gsap.killTweensOf(tile.scale);
      tile.alpha = getNormalTileAlpha(tile);
      if (tile.scale && !tile.locked && (tile.value | 0) > 0) {
        try { tile.scale.set?.(1); } catch {
          tile.scale.x = 1;
          tile.scale.y = 1;
        }
      }
      return;
    }
    const targetAlpha = getNormalTileAlpha(tile);
    const isActiveTile = !tile.locked && (tile.value | 0) > 0;
    const delay = isActiveTile
      ? Math.random() * 0.78
      : Math.random() * 0.42;
    gsap.killTweensOf(tile);
    gsap.to(tile, {
      alpha: targetAlpha,
      duration: isActiveTile ? 0.2 : 0.34,
      delay,
      ease: 'sine.out',
      overwrite: true,
    });
    if (isActiveTile && tile.scale) {
      gsap.killTweensOf(tile.scale);
      try { tile.scale.set?.(0.88); } catch {
        tile.scale.x = 0.88;
        tile.scale.y = 0.88;
      }
      gsap.timeline({
        delay,
        onUpdate: () => {
          try { tile.refreshShadow?.(); } catch {}
        },
        onComplete: () => {
          try { tile.refreshShadow?.(); } catch {}
        },
      })
        .to(tile.scale, { x: 1.12, y: 1.12, duration: 0.18, ease: 'back.out(2.6)' }, 0)
        .to(tile.scale, { x: 0.97, y: 0.97, duration: 0.1, ease: 'sine.inOut' }, 0.18)
        .to(tile.scale, { x: 1, y: 1, duration: 0.16, ease: 'back.out(2)' }, 0.28);
    }
  });
  if (restoreHud) stopHudDim(true);
}

function setOverlayDimVisible(visible: boolean): void {
  const dim = document.querySelector('.first-play-tutorial-dim') as HTMLElement | null;
  if (!dim) return;
  gsap.to(dim, {
    opacity: visible ? 1 : 0,
    duration: 0.2,
    ease: 'sine.inOut',
    overwrite: true,
  });
}

function dismissThirdStepAndWaitForWild(): void {
  if (!active || currentStep !== 3) return;
  stopStepThreePointerHint();
  popOutPointer();
  setWildMeterSmokeFrozen(false);
  restoreBoardAndHudOpacity(true, true);
  restoreNormalGameplayDrag(false);
  reserveFourthStepWildSpawnCell();
  stopPolling();
  setOverlayDimVisible(false);
  const overlay = document.querySelector('.first-play-tutorial-overlay') as HTMLElement | null;
  const sheet = overlay?.querySelector('.first-play-tutorial-sheet') as HTMLElement | null;
  const waitForWild = () => startFourthStepWildMonitor();
  if (sheet) {
    gsap.to(sheet, {
      y: '100%',
      duration: 0.34,
      ease: 'power2.in',
      overwrite: true,
      onComplete: waitForWild,
    });
  } else {
    waitForWild();
  }
}

function startFourthStepWildMonitor(): void {
  if (!active || currentStep !== 3) return;
  stopPolling();
  pollTimer = window.setInterval(() => {
    if (!active || currentStep !== 3) return;
    const wild = findWildTileForFourthStepStart();
    if (!wild) return;
    stopPolling();
    activateFourthStep(wild);
  }, 120);
}

function getFourthStepPreferredWildCell(): { c: number; r: number } {
  return {
    c: Math.max(0, Math.min(COLS - 1, Math.floor(COLS / 2))),
    r: Math.min(ROWS - 1, 1),
  };
}

function isFourthStepWildCellAvailable(c: number, r: number, wildTile: any = null): boolean {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
  const occupant = STATE.grid?.[r]?.[c];
  if (!occupant || occupant === wildTile || occupant.destroyed) return true;
  return occupant.locked === true || ((occupant.value | 0) <= 0 && !occupant.special);
}

function findFourthStepWildCell(wildTile: any = null): { c: number; r: number } {
  if (
    wildTile &&
    !wildTile.destroyed &&
    Number.isFinite(wildTile.gridX) &&
    Number.isFinite(wildTile.gridY)
  ) {
    const currentCell = { c: wildTile.gridX | 0, r: wildTile.gridY | 0 };
    if (currentCell.r <= Math.min(1, ROWS - 1) && isFourthStepWildCellAvailable(currentCell.c, currentCell.r, wildTile)) {
      return currentCell;
    }
  }

  const preferred = getFourthStepPreferredWildCell();
  if (isFourthStepWildCellAvailable(preferred.c, preferred.r, wildTile)) return preferred;

  const maxRow = Math.min(1, ROWS - 1);
  const orderedCells: Array<{ c: number; r: number; distance: number }> = [];
  for (let r = 0; r <= maxRow; r++) {
    for (let c = 0; c < COLS; c++) {
      orderedCells.push({
        c,
        r,
        distance: Math.abs(c - preferred.c) + Math.abs(r - preferred.r),
      });
    }
  }
  orderedCells.sort((a, b) => a.distance - b.distance || a.r - b.r || a.c - b.c);
  const topEmptyCell = orderedCells.find(({ c, r }) => isFourthStepWildCellAvailable(c, r, wildTile));
  if (topEmptyCell) return { c: topEmptyCell.c, r: topEmptyCell.r };

  return findEmptyishCell(preferred);
}

function reserveFourthStepWildSpawnCell(): void {
  const preferredWildCell = findFourthStepWildCell();
  try {
    (window as any).__ccFirstPlayTutorialWildSpawnCell = preferredWildCell;
    (window as any).__ccFirstPlayTutorialForceWildStar = true;
  } catch {}
}

function displaceFourthStepWildSpawnOccupant(cell = getFourthStepPreferredWildCell()): boolean {
  if (!active || currentStep !== 3) return false;
  const occupant = STATE.grid?.[cell.r]?.[cell.c];
  if (!occupant || occupant.destroyed || isWildStarTile(occupant)) return true;
  return false;
}

function findWildTileForFourthStepStart(): any | null {
  const wild = findWildTile();
  if (!wild || wild.destroyed) return null;
  // Preferred trigger: backpack/crate finished opening and the wild has begun falling to the board.
  if ((wild as any)._ccWildSpawnDropping === true) return wild;
  return null;
}

function findEmptyishCell(preferred: { c: number; r: number }, exclude: Array<{ c: number; r: number }> = []): { c: number; r: number } {
  const excluded = new Set(exclude.map(({ c, r }) => `${c},${r}`));
  const isEmptyish = (c: number, r: number) => {
    if (excluded.has(`${c},${r}`)) return false;
    const t = STATE.grid?.[r]?.[c];
    return !t || t.destroyed || t.locked || (t.value | 0) <= 0;
  };
  if (isEmptyish(preferred.c, preferred.r)) return preferred;
  for (let radius = 1; radius <= Math.max(COLS, ROWS); radius++) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (Math.abs(c - preferred.c) + Math.abs(r - preferred.r) !== radius) continue;
        if (isEmptyish(c, r)) return { c, r };
      }
    }
  }
  return preferred;
}

function makeTileWildStar(tile: any): void {
  if (!tile || tile.destroyed) return;
  tile.special = 'wild';
  tile.isWild = true;
  tile.isWildFace = true;
  tile.locked = false;
  tile.value = 6;
  tile.visible = true;
  tile.alpha = 1;
  tile.eventMode = 'static';
  tile.cursor = 'pointer';
  try { setBoardValue(tile, 6, 0); } catch {}
  scheduleAnimationFrame(() => {
    if (!tile || tile.destroyed) return;
    try { setBoardValue(tile, 6, 0); } catch {}
    try { startWildStars(tile, { introBounce: true }); } catch {}
  });
}

function pickFourthStepTargetTile(wildTile: any): any | null {
  const preferredWildCell = getFourthStepPreferredWildCell();
  const activeRegularTiles = getFourthStepCandidateTiles(wildTile).filter((tile: any) => (
    !((tile.gridX | 0) === preferredWildCell.c && (tile.gridY | 0) === preferredWildCell.r)
  )).sort((a: any, b: any) => {
    const av = a.value | 0;
    const bv = b.value | 0;
    if (av === 2 && bv !== 2) return -1;
    if (bv === 2 && av !== 2) return 1;
    const ar = a.gridY | 0;
    const br = b.gridY | 0;
    if (ar !== br) return ar - br;
    return (a.gridX | 0) - (b.gridX | 0);
  });
  const activeRegular = activeRegularTiles[0];
  if (activeRegular) return activeRegular;
  return (STATE.tiles || []).find((tile: any) => (
    tile &&
    tile !== wildTile &&
    !tile.destroyed &&
    !tile.special &&
    Number.isFinite(tile.gridY) &&
    (tile.gridY | 0) <= getFourthStepMaxTargetRow()
  )) || null;
}

function activateFourthStep(wildTile: any): void {
  if (!active || currentStep !== 3 || !wildTile || wildTile.destroyed) return;
  stopStepThreePointerHint();
  currentStep = 4;
  fourthStepCompleting = false;
  stepFourPrepared = false;
  stepFourWildTile = wildTile;
  stepFourTargetTile = null;
  targetTiles = [];
  targetCellThree = null;
  targetCellTwo = null;
  pointerAnimationKey = '';

  setOverlayDimVisible(true);
  scheduleTimeout(() => {
    if (!active || currentStep !== 4) return;
    transitionSheetToStep(currentStep, () => {
      waitForWildDropToFinishThenPrepare(wildTile);
    });
  }, 900);
}

function waitForWildDropToFinishThenPrepare(wildTile: any): void {
  if (!active || currentStep !== 4 || !wildTile || wildTile.destroyed) return;
  const startedAt = Date.now();
  const tick = () => {
    if (!active || currentStep !== 4 || !wildTile || wildTile.destroyed || stepFourPrepared) return;
    if ((wildTile as any)._ccWildSpawnDropping === true && Date.now() - startedAt < 5000) {
      scheduleTimeout(tick, 80);
      return;
    }
    prepareFourthStepBoard(wildTile);
  };
  tick();
}

function prepareFourthStepBoard(wildTile: any): void {
  if (!active || currentStep !== 4 || !wildTile || wildTile.destroyed || stepFourPrepared) return;
  const preferredWildCell = findFourthStepWildCell(wildTile);
  const targetTile = pickFourthStepTargetTile(wildTile);
  if (!targetTile) return;
  stepFourPrepared = true;
  stepFourTargetTile = targetTile;

  placeTile(wildTile, preferredWildCell.c, preferredWildCell.r);
  makeTileWildStar(wildTile);
  setTileValue(targetTile, Math.max(1, Math.min(5, targetTile.value | 0 || 4)));
  forceTutorialTileValueVisual(targetTile, targetTile.value | 0 || 4);

  targetTiles = [wildTile, targetTile];
  targetCellThree = { c: preferredWildCell.c, r: preferredWildCell.r };
  targetCellTwo = { c: targetTile.gridX | 0, r: targetTile.gridY | 0 };
  pointerAnimationKey = '';

  (STATE.tiles || []).forEach((tile: any) => {
    const focused = tile === wildTile || isFourthStepAllowedTarget(tile);
    if (focused) {
      tile.visible = true;
      tile.alpha = 1;
      setTileInteractivity(tile, true);
    } else if (tile && !tile.destroyed) {
      gsap.to(tile, { alpha: getNormalTileAlpha(tile) * 0.35, duration: 0.28, ease: 'sine.inOut', overwrite: true });
      setTileInteractivity(tile, false);
    }
  });
  if (!active || currentStep !== 4) return;
  startStepFourPointerHint();
  startFourthStepMonitor();
}

function startFourthStepMonitor(): void {
  stopPolling();
  pollTimer = window.setInterval(() => {
    if (!active || currentStep !== 4) return;
    if (!isFourthStepComplete()) return;
    completeFourthStep();
  }, 60);
}

function isFourthStepComplete(): boolean {
  if (!stepFourPrepared) return false;
  const wild = stepFourWildTile || targetTiles[0];
  if (!wild) return false;
  if (wild.destroyed || !isWildStarTile(wild)) return true;
  if ((STATE.tiles || []).some((tile: any) => (
    tile &&
    !tile.destroyed &&
    !tile.locked &&
    !tile.special &&
    (tile.value | 0) === 6 &&
    Number.isFinite(tile.gridY) &&
    (tile.gridY | 0) <= getFourthStepMaxTargetRow()
  ))) return true;
  return false;
}

function completeFourthStep(): void {
  if (!active || currentStep !== 4 || fourthStepCompleting) return;
  fourthStepCompleting = true;
  setWildMeterSmokeFrozen(true);
  stopPolling();
  stopStepFourPointerHint();
  popOutPointer(() => {
    exitCurrentSheet(() => {
      restoreBoardAndHudOpacity(true);
      restoreNormalGameplayDrag(true);
      startTutorialBoardAssist();
      completeFirstPlayTutorial();
    });
  });
}

function removeOverlay(): void {
  const existing = document.querySelector('.first-play-tutorial-overlay') as HTMLElement | null;
  if (!existing) return;
  stopStepThreePointerHint();
  stopStepFourPointerHint();
  clearIntroTimers();
  clearScheduledWork();
  gsap.killTweensOf(existing);
  gsap.killTweensOf(existing.querySelector('.first-play-tutorial-dim'));
  gsap.killTweensOf(existing.querySelector('.first-play-tutorial-sheet'));
  gsap.killTweensOf(existing.querySelector('.first-play-tutorial-pointer'));
  gsap.killTweensOf(existing.querySelector('.first-play-tutorial-pointer-image'));
  gsap.killTweensOf(existing.querySelector('.first-play-tutorial-cta'));
  existing.remove();
}

function stopPolling(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function getHudRoot(): any | null {
  return (window as any).HUD_ROOT || (window as any).HUD?.HUD_ROOT || null;
}

function isCloseHudNode(node: any, hudRoot: any): boolean {
  if (!node || !hudRoot) return false;
  return (
    node === hudRoot._xButton ||
    node === hudRoot._visibleCloseButton ||
    node._isXButton === true
  );
}

function isHelpHudNode(node: any, hudRoot: any): boolean {
  if (!node || !hudRoot) return false;
  return node === hudRoot._helpButton || node._isHelpButton === true;
}

function isWildPreloadHudNode(node: any): boolean {
  return !!node && (
    node.label === 'wildLoader' ||
    node.name === 'wildLoader' ||
    node._isWildLoader === true
  );
}

function setHudNodeInteractivity(node: any, enabled: boolean): void {
  if (!node || node.destroyed) return;
  if (!hudOriginalEventMode.has(node)) hudOriginalEventMode.set(node, node.eventMode);
  if (!hudOriginalInteractive.has(node)) hudOriginalInteractive.set(node, node.interactive);
  if (!hudOriginalCursor.has(node)) hudOriginalCursor.set(node, node.cursor);

  if (enabled) {
    node.eventMode = hudOriginalEventMode.get(node) ?? 'static';
    node.interactive = hudOriginalInteractive.get(node) ?? true;
    node.cursor = hudOriginalCursor.get(node) ?? 'pointer';
    return;
  }

  node.eventMode = 'none';
  node.interactive = false;
  node.cursor = 'default';
}

function setHudSubtreeInteractivity(node: any, enabled: boolean): void {
  if (!node || node.destroyed) return;
  setHudNodeInteractivity(node, enabled);
  const children = Array.isArray(node.children) ? node.children : [];
  children.forEach((child: any) => setHudSubtreeInteractivity(child, enabled));
}

function restoreHudSubtreeInteractivity(node: any): void {
  if (!node || node.destroyed) return;
  if (hudOriginalEventMode.has(node)) node.eventMode = hudOriginalEventMode.get(node);
  if (hudOriginalInteractive.has(node)) node.interactive = hudOriginalInteractive.get(node);
  if (hudOriginalCursor.has(node)) node.cursor = hudOriginalCursor.get(node);
  const children = Array.isArray(node.children) ? node.children : [];
  children.forEach((child: any) => restoreHudSubtreeInteractivity(child));
}

function forEachHudDimTarget(callback: (node: any, isClose: boolean, isHelp: boolean, isWildPreload: boolean) => void): void {
  const hudRoot = getHudRoot();
  if (!hudRoot || hudRoot.destroyed) return;
  const children = Array.isArray(hudRoot.children) ? hudRoot.children : [];
  children.forEach((child: any) => callback(child, isCloseHudNode(child, hudRoot), isHelpHudNode(child, hudRoot), isWildPreloadHudNode(child)));
}

function applyHudDim(immediate = true): void {
  const hudRoot = getHudRoot();
  if (hudRoot && !hudRoot.destroyed) {
    if (!hudOriginalAlpha.has(hudRoot)) {
      const currentAlpha = Number.isFinite(hudRoot.alpha) ? hudRoot.alpha : 1;
      hudOriginalAlpha.set(hudRoot, currentAlpha);
    }
    hudRoot.visible = true;
    gsap.killTweensOf(hudRoot);
    hudRoot.alpha = Number.isFinite(hudOriginalAlpha.get(hudRoot)) ? hudOriginalAlpha.get(hudRoot) : 1;
  }

  forEachHudDimTarget((node, _isClose, _isHelp, isWildPreload) => {
    if (!node || node.destroyed) return;
    if (!hudOriginalAlpha.has(node)) {
      const currentAlpha = Number.isFinite(node.alpha) ? node.alpha : 1;
      hudOriginalAlpha.set(node, currentAlpha);
    }
    gsap.killTweensOf(node);
    setHudSubtreeInteractivity(node, false);
    const targetAlpha = isWildPreload ? (hudOriginalAlpha.get(node) ?? 1) : 0.2;
    if (immediate) {
      node.alpha = targetAlpha;
    } else {
      gsap.to(node, {
        alpha: targetAlpha,
        duration: 0.42,
        ease: 'sine.inOut',
        overwrite: true,
      });
    }
  });

  const domHud = document.querySelector('[data-unified-hud]') as HTMLElement | null;
  if (domHud) {
    if (!hudDomOriginalOpacity.has(domHud)) {
      hudDomOriginalOpacity.set(domHud, domHud.style.opacity || '');
    }
    if (immediate) {
      domHud.style.opacity = '0.2';
    } else {
      gsap.killTweensOf(domHud);
      gsap.to(domHud, { opacity: 0.2, duration: 0.42, ease: 'sine.inOut', overwrite: true });
    }
  }
}

function startHudDim(): void {
  stopHudDim(false);
  hudDimStarted = true;
  applyHudDim(false);
  hudDimTimer = window.setInterval(() => {
    if (!active) return;
    applyHudDim(true);
  }, 120);
}

function stopHudDim(restore = true, animateRestore = false): void {
  if (hudDimTimer !== null) {
    window.clearInterval(hudDimTimer);
    hudDimTimer = null;
  }
  if (!restore) return;

  try { cleanupSmokeBubbles(); } catch {}

  const hudRoot = getHudRoot();
  if (hudRoot && !hudRoot.destroyed) {
    gsap.killTweensOf(hudRoot);
    const original = hudOriginalAlpha.get(hudRoot);
    hudRoot.alpha = Number.isFinite(original) ? original : 1;
    hudRoot.visible = true;
  }

  forEachHudDimTarget((node, isClose, isHelp, isWildPreload) => {
    if (!node || node.destroyed) return;
    gsap.killTweensOf(node);
    if (node.scale) gsap.killTweensOf(node.scale);
    if (isTutorialHudLockActive() && (isClose || isHelp)) {
      node.alpha = 0.2;
      setHudSubtreeInteractivity(node, false);
      return;
    }
    const original = hudOriginalAlpha.get(node);
    const targetAlpha = Number.isFinite(original) ? original : 1;
    restoreHudSubtreeInteractivity(node);
    if (!animateRestore) {
      node.alpha = targetAlpha;
      return;
    }

    node.alpha = Math.min(Number.isFinite(node.alpha) ? node.alpha : 0.2, 0.35);
    gsap.to(node, {
      alpha: targetAlpha,
      duration: 0.22,
      delay: isWildPreload ? 0 : Math.random() * 0.1,
      ease: 'sine.out',
      overwrite: true,
    });
    if (!isWildPreload && node.scale) {
      const targetScaleX = Number.isFinite(node.scale.x) ? node.scale.x : 1;
      const targetScaleY = Number.isFinite(node.scale.y) ? node.scale.y : 1;
      if (typeof node.scale.set === 'function') {
        node.scale.set(targetScaleX * 0.9, targetScaleY * 0.9);
      } else {
        node.scale.x = targetScaleX * 0.9;
        node.scale.y = targetScaleY * 0.9;
      }
      gsap.timeline({ delay: Math.random() * 0.1 })
        .to(node.scale, { x: targetScaleX * 1.12, y: targetScaleY * 1.12, duration: 0.18, ease: 'back.out(2.5)' }, 0)
        .to(node.scale, { x: targetScaleX, y: targetScaleY, duration: 0.18, ease: 'sine.out' }, 0.18);
    }
  });

  const domHud = document.querySelector('[data-unified-hud]') as HTMLElement | null;
  if (domHud) {
    gsap.killTweensOf(domHud);
    if (animateRestore) {
      gsap.to(domHud, {
        opacity: hudDomOriginalOpacity.get(domHud) || 1,
        duration: 0.22,
        ease: 'sine.out',
        overwrite: true,
        onComplete: () => { domHud.style.opacity = hudDomOriginalOpacity.get(domHud) ?? ''; },
      });
    } else {
      domHud.style.opacity = hudDomOriginalOpacity.get(domHud) ?? '';
    }
  }
  hudDimStarted = false;
}

export function activateFirstPlayTutorialWhenReady(): void {
  if (!isBrowser() || !active) return;
  const start = Date.now();
  const tick = () => {
    const canvas = document.querySelector('#app canvas');
    if (!canvas || !STATE?.tiles?.length) {
      if (Date.now() - start < 5000) scheduleAnimationFrame(tick);
      return;
    }
    scheduleTimeout(() => {
      prepareTutorialBoard();
      renderOverlay();
      if (!hudDimStarted) startHudDim();
    }, 1250);
  };
  scheduleAnimationFrame(() => scheduleAnimationFrame(tick));
}

export function completeFirstPlayTutorial(): void {
  if (!isBrowser()) return;
  active = false;
  runSource = null;
  targetTiles = [];
  targetCellThree = null;
  targetCellTwo = null;
  secondStepTile = null;
  pointerAnimationKey = '';
  firstStepUserInteracted = false;
  secondStepUserInteracted = false;
  stepTransitioning = false;
  secondStepCompleting = false;
  fourthStepCompleting = false;
  stepFourPrepared = false;
  stepFourWildTile = null;
  stepFourTargetTile = null;
  hudDimStarted = false;
  stopPolling();
  stopStepThreeBoardDim();
  clearScheduledWork();
  restoreStepThreeGhosts();
  restoreBoardAndHudOpacity(true);
  stopHudDim(true);
  setWildMeterSmokeFrozen(false);
  restoreNormalGameplayDrag(true);
  removeOverlay();
}

export function markFirstPlayTutorialDone(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(FORCE_NEXT_KEY);
  localStorage.setItem(DONE_KEY, 'true');
  delete (window as any).__ccFirstPlayTutorialArmed;
}

export function openFirstPlayTutorialDevModal(): void {
  if (!isBrowser()) return;
  ensureStyles();
  document.querySelector('.first-play-tutorial-dev-modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'first-play-tutorial-dev-modal-overlay';
  overlay.innerHTML = `
    <div class="first-play-tutorial-dev-modal" role="dialog" aria-modal="true" aria-labelledby="first-play-dev-title">
      <h2 id="first-play-dev-title">First Time Run</h2>
      <p>Yes arms the next Arcade or Journey Play tap to start the tutorial run. Reset removes that forced run.</p>
      <div class="first-play-tutorial-dev-actions">
        <button type="button" data-action="yes">Yes</button>
        <button type="button" data-action="reset">Reset</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('[data-action="yes"]')?.addEventListener('click', () => {
    armFirstPlayTutorial();
    close();
  });
  overlay.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
    resetFirstPlayTutorialRequest();
    close();
  });
}

if (isBrowser()) {
  (window as any).__ccFirstPlayTutorialCanDrop = isTutorialDropAllowed;
  (window as any).firstPlayTutorial = {
    arm: armFirstPlayTutorial,
    reset: resetFirstPlayTutorialRequest,
    setEnabled: setFirstPlayTutorialDevEnabled,
    complete: completeFirstPlayTutorial,
    markDone: markFirstPlayTutorialDone,
    openDevModal: openFirstPlayTutorialDevModal,
    isForced: isFirstPlayTutorialForced,
    isActive: isFirstPlayTutorialActive,
  };
}
