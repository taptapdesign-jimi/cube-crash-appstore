// src/modules/board.ts
import { Container, Sprite, Assets, Graphics, SCALE_MODES, Texture } from 'pixi.js';
import {
  TILE, COLS, ROWS, GAP,
  PIPS_INNER_FACTOR, PIP_COLOR, PIP_ALPHA, PIP_RADIUS, PIP_SQUARE,
  ASSET_TILE,
  ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4,
} from './constants.js';

// Types
interface Tile extends Container {
  gridX?: number;
  gridY?: number;
  value?: number;
  stackDepth?: number;
  locked?: boolean;
  shadow?: Graphics;
  rotG?: Container;
  base?: Sprite;
  overlay?: Sprite;
  stackG?: Container;
  pips?: Graphics;
  hover?: Graphics;
  targetX?: number;
  targetY?: number;
  special?: string;
  refreshShadow?: () => void;
  destroy?: (opts?: any) => void;
}

interface Board extends Container {
  addChild?: (child: Container) => void;
  sortChildren?: () => void;
}

interface Grid {
  [key: number]: (Container | null)[];
}

interface CreateTileParams {
  board: Board;
  grid: Grid;
  tiles: Container[];
  c: number;
  r: number;
  val?: number;
  locked?: boolean;
}

// Window interface is now defined in src/types/window.d.ts

const BOARD_BG_COLOR = 0xF5F5F5;
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

// random skin: 40% base, 30% alt2, 20% alt3, 10% alt4
function pickNumbersSkin(): Texture {
  const p = Math.random();
  if (p < 0.40) return Assets.get(ASSET_NUMBERS);
  if (p < 0.70) return Assets.get(ASSET_NUMBERS2);
  if (p < 0.90) return Assets.get(ASSET_NUMBERS3);
  return Assets.get(ASSET_NUMBERS4);
}

export function drawStack(tile: Tile): void {
  try { tile.stackG?.destroy({ children: true }); } catch {}
  tile.stackG = null;

  // Add 3D effects to tile
  if ((window as WindowWithThreeDEffects).threeDEffects && (window as WindowWithThreeDEffects).threeDEffects!.is3DEnabled) {
    (window as WindowWithThreeDEffects).threeDEffects!.add3DToTile(tile);
  }

  const depth = Math.max(1, tile.stackDepth | 0);
  if (depth <= 1) return;

  const host = tile.rotG || tile;
  host.sortableChildren = true;

  const g = new Container();
  g.label = 'stackG';
  g.zIndex = -5;
  host.addChildAt(g, 0);
  tile.stackG = g;

  const base = tile.base || host.children.find(c => (c as any).texture) || null;
  const tex  = (base as any)?.texture || null;

  const baseAnchorX = (base as any)?.anchor?.x ?? 0.5;
  const baseAnchorY = (base as any)?.anchor?.y ?? 0.5;
  const baseX = (base as any)?.x ?? 0;
  const baseY = (base as any)?.y ?? 0;

  const tW = tex?.orig?.width  ?? TILE;
  const tH = tex?.orig?.height ?? TILE;
  const baseScaleX = (base as any)?.scale?.x ?? (((base as any)?.width  ?? TILE) / tW);
  const baseScaleY = (base as any)?.scale?.y ?? (((base as any)?.height ?? TILE) / tH);

  for (let i = 1; i < depth; i++) {
    const scExtra = 1 - i * 0.05;
    let s: Container;
    if (tex) {
      s = new Sprite(tex);
      s.anchor.set(baseAnchorX, baseAnchorY);
      s.scale.set(baseScaleX * scExtra, baseScaleY * scExtra);
      s.x = baseX;
      s.y = baseY;
    } else {
      s = new Graphics()
        .roundRect(-TILE/2, -TILE/2, TILE * scExtra, TILE * scExtra, 22)
        .fill(0xffffff);
    }
    const dx  = (Math.random() * 2 - 1) * (6 + i * 1.6);
    const dy  = (Math.random() * 2 - 1) * (5 + i * 1.3);
    const rot = (Math.random() * 2 - 1) * (i === depth - 1 ? 0.18 : 0.24);

    s.rotation = rot;
    s.x += dx;
    s.y += dy;
    s.alpha = tex ? 0.97 : 0.12;
    s.zIndex = -10 + i;
    g.addChild(s);
  }
  try { host.sortChildren(); } catch {}
}

// ✅ PATCH: nikad pipsi na praznom/locked, i overlay nikad ne "probija"
function drawPips(t: Tile): void {
  const g = t.pips!;
  g.clear();

  // Overlay NIKAD ne koristimo kao "ghost"; uvijek ga gasimo ovdje.
  if (t.overlay) t.overlay.visible = false;

  // Ako je prazno ili zaključano → ne crtamo pips.
  if ((t.value | 0) <= 0 || t.locked) return;

  const side = TILE * PIPS_INNER_FACTOR;
  const half = side / 2;
  const size = Math.round(TILE * 0.12);
  const r    = PIP_SQUARE ? PIP_RADIUS : size / 2;

  const xs = [-half, 0, half];
  const ys = [-half, 0, half];
  const idx = (cx: number, cy: number): number => cy * 3 + cx;

  const maps: { [key: number]: number[] } = {
    1: [4],
    2: [idx(0, 0), idx(2, 2)],
    3: [idx(0, 0), 4, idx(2, 2)],
    4: [idx(0, 0), idx(2, 0), idx(0, 2), idx(2, 2)],
    5: [idx(0, 0), idx(2, 0), 4, idx(0, 2), idx(2, 2)],
    6: [idx(0, 0), idx(2, 0), idx(0, 1), idx(2, 1), idx(0, 2), idx(2, 2)],
  };
  const pts = maps[clamp(t.value!, 1, 6)];

  g.fill({ color: PIP_COLOR, alpha: PIP_ALPHA });
  for (const i of pts) {
    const x = xs[i % 3];
    const y = ys[(i / 3) | 0];
    if (PIP_SQUARE) g.roundRect(x - size / 2, y - size / 2, size, size, r);
    else g.circle(x, y, size / 2);
  }
}

// ✅ PATCH: nema "ghost alpha"; prazno briše pips i gasi overlay
export function setValue(t: Tile, v: number, addStack: number = 0): void {
  t.value = v;

  // Pločica NIKAD nije poluprozirna - osim ako nije locked
  if (!t.locked) {
    t.alpha = 1;
  }

  if ((v | 0) > 0) {
    // aktivna pločica
    if (t.base) {
      t.base.texture = pickNumbersSkin();
      // Optimize texture for pixel-perfect rendering
      if (t.base.texture && t.base.texture.baseTexture) {
        t.base.texture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
      }
    }
    if (t.overlay) t.overlay.visible = false;
  } else {
    // prazno/locked
    if (t.base) {
      t.base.texture = Assets.get(ASSET_TILE);
      // Optimize texture for pixel-perfect rendering
      if (t.base.texture && t.base.texture.baseTexture) {
        t.base.texture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
      }
    }
    if (t.overlay) t.overlay.visible = false;
    t.pips?.clear?.(); // odmah ukloni pips da ne "procure"
  }
  // Ghost placeholders are now handled by drawBoardBG

  if (addStack) t.stackDepth = Math.min(4, (t.stackDepth || 1) + addStack);
  drawStack(t);
  drawPips(t);
}


// --- Merge score chain bookkeeping (ostavljeno ako ti treba kasnije) ---
let mergeStackValue: number = 0;
let mergeStackCount: number = 0;
let onMergeChainUpdate: ((value: number, count: number) => void) | null = null;

export function setMergeChainUpdateCallback(cb: (value: number, count: number) => void): void { 
  onMergeChainUpdate = cb; 
}

export function startMergeChain(): void {
  mergeStackValue = 0; 
  mergeStackCount = 0;
  if (onMergeChainUpdate) onMergeChainUpdate(mergeStackValue, mergeStackCount);
}

export function updateMergeChain(tileValue: number): void {
  if (tileValue < 6) {
    mergeStackValue += tileValue;
    mergeStackCount += 1;
    if (onMergeChainUpdate) onMergeChainUpdate(mergeStackValue, mergeStackCount);
  }
}

export function finalizeMergeChain(tileValue: number): number {
  let bonus = 0;
  if (tileValue === 6) {
    bonus = mergeStackValue * mergeStackCount;
    mergeStackValue = 0; 
    mergeStackCount = 0;
    if (onMergeChainUpdate) onMergeChainUpdate(mergeStackValue, mergeStackCount);
  }
  return bonus;
}

export function createTile({ board, grid, tiles, c, r, val = 0, locked = false }: CreateTileParams): Tile {
  const t = new Container() as Tile;
  t.gridX = c; 
  t.gridY = r;
  t.value = val;
  t.stackDepth = 1;
  t.locked = locked;

  // meka "sjena"
  const sh = new Graphics();
  t.addChild(sh);
  t.shadow = sh;

  // board center in board-local space (based on grid layout)
  const boardCenterX = ((COLS - 1) * (TILE + GAP) + TILE) * 0.5;
  const boardCenterY = ((ROWS - 1) * (TILE + GAP) + TILE) * 0.5;

  t.shadow.visible = false;
  const drawShadow = (): void => {
    sh.clear();

    // Direction of shadow is away from a "light" at the board center.
    const dx = t.x - boardCenterX;
    const dy = t.y - boardCenterY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;

    // Take into account current visual tilt to avoid "baked" look
    const tilt = (t.rotG?.rotation || 0);
    const tiltAbs = Math.abs(tilt);

    // Strength: tiles further from center cast slightly longer shadows.
    const maxSpan = Math.max(COLS, ROWS) * (TILE + GAP) * 0.5;
    const strength = 0.6 + 0.4 * Math.min(1, len / Math.max(1, maxSpan));

    // Baseline shift (in shadow direction) and a tiny global downward bias for nicer look
    const baseShift = TILE * 0.065 * strength;
    const biasY = TILE * 0.012; // gentle "below" bias

    // Smooth, gaussian-like falloff: more (but thinner) layers → softer edge
    const layers = 10;
    for (let i = 0; i < layers; i++) {
      const p = i / (layers - 1);            // 0..1
      const grow = 1.0 + p * 0.42;           // total size growth
      const width  = TILE * grow * 1.08;     // a bit wider than tall (elliptical feel)
      const height = TILE * grow * 0.90;     // compress vertically for a softer base

      // Exponential alpha falloff so outer rings are very subtle
      const alpha = 0.20 * Math.pow(1 - p, 1.6);
      if (alpha <= 0.003) continue;

      // Increase shift with each outer layer for natural parallax
      let shift = baseShift * (0.35 + p * 1.1);
      // extra push from tilt (stronger inner layers)
      shift += (TILE * 0.02) * (1 - p) * tiltAbs;
      const ox = -width  / 2 + nx * shift + 1;  // +1 tiny pixel nudge for sub-pixel crispness
      const oy = -height / 2 + ny * shift + 4 + biasY;

      sh.fill({ color: 0xBDA38D, alpha })
        .roundRect(ox, oy, width, height, TILE * 0.22);
    }

    // rotate and subtly distort shadow to follow visual tilt
    try {
      sh.rotation = tilt * 0.55;                      // follow about half the tile's tilt
      const sx = 1 + tiltAbs * 0.08;                  // slight stretch sideways
      const sy = 1 - tiltAbs * 0.04;                  // slight flatten
      sh.scale.set(sx, sy);
    } catch {}
  };
  drawShadow(); 
  t.refreshShadow = drawShadow;

  // tilt grupa — pivot na VRHU pločice za "teži" osjećaj nagiba
  t.rotG = new Container();
  t.rotG.sortableChildren = true;
  // postavi pivot na top-center (0, -TILE/2) i poziciju jednaku pivotu
  // kako bi centar pločice ostao u istom mjestu pri rotation=0
  try { t.rotG.pivot.set(0, -TILE/2); t.rotG.position.set(0, -TILE/2); } catch {}
  t.addChild(t.rotG);
  t.rotG.rotation = (Math.random() * 0.12) - 0.06;

  // drvena pločica (base)
  const face = new Sprite(Assets.get(ASSET_TILE));
  face.anchor.set(0.5);
  face.width = TILE; 
  face.height = TILE;
  // Optimize texture for pixel-perfect rendering
  if (face.texture && face.texture.baseTexture) {
    face.texture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
  }
  t.rotG.addChild(face);
  t.base = face;

  // poluprozirni "numbers" overlay – (PATCH) gasimo ga defaultno; ne koristimo kao ghost
  const ov = new Sprite(Assets.get(ASSET_NUMBERS));
  ov.anchor.set(0.5);
  ov.width = TILE; 
  ov.height = TILE;
  ov.alpha = 0.55;
  // Optimize texture for pixel-perfect rendering
  if (ov.texture && ov.texture.baseTexture) {
    ov.texture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
  }
  ov.visible = false;
  t.rotG.addChild(ov);
  t.overlay = ov;

  // stack + pipovi + hover
  t.stackG = new Container();
  t.stackG.zIndex = -1;
  t.rotG.addChildAt(t.stackG, 0);

  t.pips = new Graphics();
  t.rotG.addChild(t.pips);

  t.hover = new Graphics();
  t.addChild(t.hover);

  // pozicija (centar je na x/y) - postavi se u animaciji
  t.targetX = c * (TILE + GAP) + TILE / 2; 
  t.targetY = r * (TILE + GAP) + TILE / 2;
  t.x = t.targetX; // Start at target position for bloom effect
  t.y = t.targetY;
  
  // FORCE VISIBILITY
  t.visible = true;
  t.alpha = 1;

  board.addChild!(t);
  
  // DON'T hide ghost on creation - wait to see if tile will be unlocked
  // Ghost will be hidden only for tiles that REMAIN locked after board setup
  // This is handled by updateGhostVisibility() called after board setup

  board.sortChildren!(); // Sort after adding tile
  tiles.push(t);
  grid[r] ||= [];
  grid[r][c] = t;

  drawStack(t);
  drawPips(t);

  // When tile is destroyed, update ghost visibility for the entire board
  const __origDestroy = t.destroy!.bind(t);
  t.destroy = (opts?: any) => {
    __origDestroy(opts);
    
    // Update all ghost placeholders after tile is destroyed
    setTimeout(() => {
      if (typeof (window as WindowWithThreeDEffects).updateGhostVisibility === 'function') {
        (window as WindowWithThreeDEffects).updateGhostVisibility!();
      }
    }, 50);
  };
  
  return t;
}

export function anyMergePossible(allTiles: Container[]): boolean {
  const open = allTiles.filter(t => !(t as Tile).locked);
  
  // Check for wild cubes - they can merge with any other tile
  const wildCubes = open.filter(t => (t as Tile).special === 'wild');
  const nonWildTiles = open.filter(t => (t as Tile).special !== 'wild');
  
  // If we have wild cubes and any non-wild tiles, we can always merge
  if (wildCubes.length > 0 && nonWildTiles.length > 0) {
    return true;
  }
  
  // Check regular tile combinations
  for (let i = 0; i < open.length; i++) {
    for (let j = i + 1; j < open.length; j++) {
      const s = (open[i] as Tile).value! + (open[j] as Tile).value!;
      if (s >= 2 && s <= 6) return true;
    }
  }
  
  return false;
}