// src/modules/board.ts
import { Container, Sprite, Assets, Graphics, SCALE_MODES, Texture } from 'pixi.js';
import {
  TILE, COLS, ROWS, GAP,
  PIPS_INNER_FACTOR, PIP_COLOR, PIP_ALPHA, PIP_RADIUS, PIP_SQUARE,
  ASSET_TILE,
  ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4,
} from './constants.js';

const BOARD_BG_COLOR = 0xF3EEE8;
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

// Type definitions
interface Tile extends Container {
  gridX?: number;
  gridY?: number;
  value?: number;
  stackDepth?: number;
  locked?: boolean;
  shadow?: Graphics;
  rotG?: Container;
  overlay?: Sprite;
  stackG?: Container | null;
  pips?: Graphics;
  hover?: Graphics;
  targetX?: number;
  targetY?: number;
  special?: string;
  refreshShadow?: () => void;
  base?: Sprite;
  _zBeforeDrag?: number;
}

interface Board extends Container {
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

// random skin: 40% base, 30% alt2, 20% alt3, 10% alt4
function pickNumbersSkin() {
  const p = Math.random();
  if (p < 0.40) return Assets.get(ASSET_NUMBERS) || Texture.EMPTY;
  if (p < 0.70) return Assets.get(ASSET_NUMBERS2) || Assets.get(ASSET_NUMBERS) || Texture.EMPTY;
  if (p < 0.90) return Assets.get(ASSET_NUMBERS3) || Assets.get(ASSET_NUMBERS) || Texture.EMPTY;
  return Assets.get(ASSET_NUMBERS4) || Assets.get(ASSET_NUMBERS) || Texture.EMPTY;
}

export function drawStack(tile: Tile): void {
  try { tile.stackG?.destroy({ children: true }); } catch {}
  tile.stackG = null;

  // Add 3D effects to tile
  if ((window as any).threeDEffects && (window as any).threeDEffects.is3DEnabled) {
    (window as any).threeDEffects.add3DToTile(tile);
  }

  const depth = Math.max(1, tile.stackDepth || 0);
  if (depth <= 1) return;

  const host = tile.rotG || tile;
  host.sortableChildren = true;

  const g = new Container();
  g.label = 'stackG';
  g.zIndex = -5;
  host.addChildAt(g, 0);
  tile.stackG = g;

  const base = tile.base || host.children.find((c: any) => c.texture) || null;
  const tex = (base as any)?.texture || null;

  const baseAnchorX = (base as any)?.anchor?.x ?? 0.5;
  const baseAnchorY = (base as any)?.anchor?.y ?? 0.5;
  const baseX = (base as any)?.x ?? 0;
  const baseY = (base as any)?.y ?? 0;

  const tW = tex?.orig?.width ?? TILE;
  const tH = tex?.orig?.height ?? TILE;
  const baseScaleX = (base as any)?.scale?.x ?? (((base as any)?.width ?? TILE) / tW);
  const baseScaleY = (base as any)?.scale?.y ?? (((base as any)?.height ?? TILE) / tH);

  const minRotationDeg = 10;
  const maxRotationDeg = 20;
  let previousDirection = 0;

  for (let i = 1; i < depth; i++) {
    const scExtra = 1 - i * 0.05;
    const layer = new Container();

    let spriteOrGraphics;
    if (tex) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(baseAnchorX, baseAnchorY);
      sprite.scale.set(baseScaleX * scExtra, baseScaleY * scExtra);
      sprite.x = 0;
      sprite.y = 0;
      sprite.alpha = 0.9;
      spriteOrGraphics = sprite;
    } else {
      const shape = new Graphics()
        .roundRect(-TILE / 2, -TILE / 2, TILE * scExtra, TILE * scExtra, 22)
        .fill(0xffffff);
      shape.alpha = 0.25;
      spriteOrGraphics = shape;
    }
    layer.addChild(spriteOrGraphics);

    const overlaySize = TILE * scExtra;
    const overlay = new Graphics();
    overlay
      .roundRect(-overlaySize / 2, -overlaySize / 2, overlaySize, overlaySize, 20)
      .fill(0x8B5A2B);
    overlay.alpha = 0.25;
    layer.addChild(overlay);

    const dx = (Math.random() * 2 - 1) * (6 + i * 1.6);
    const dy = (Math.random() * 2 - 1) * (5 + i * 1.3);
    const rotationDirection = previousDirection === 0
      ? (Math.random() > 0.5 ? 1 : -1)
      : -previousDirection;
    const rotationDegrees = minRotationDeg + Math.random() * (maxRotationDeg - minRotationDeg);
    const rot = rotationDirection * (rotationDegrees * Math.PI / 180);

    layer.rotation = rot;
    layer.x = baseX + dx;
    layer.y = baseY + dy;
    layer.zIndex = -10 + i;
    g.addChild(layer);

    previousDirection = rotationDirection;
  }
  try { host.sortChildren(); } catch {}
}

// ✅ PATCH: nikad pipsi na praznom/locked, i overlay nikad ne "probija"
function drawPips(t: Tile): void {
  const g = t.pips;
  if (!g) return;
  g.clear();

  // Overlay NIKAD ne koristimo kao "ghost"; uvijek ga gasimo ovdje.
  if (t.overlay) t.overlay.visible = false;

  // Ako je prazno ili zaključano → ne crtamo pips.
  if ((t.value || 0) <= 0 || t.locked) return;

  const side = TILE * PIPS_INNER_FACTOR;
  const half = side / 2;
  const size = Math.round(TILE * 0.12);
  const r = PIP_SQUARE ? PIP_RADIUS : size / 2;

  const xs = [-half, 0, half];
  const ys = [-half, 0, half];
  const idx = (cx: number, cy: number) => cy * 3 + cx;

  const maps: { [key: number]: number[] } = {
    1: [4],
    2: [idx(0, 0), idx(2, 2)],
    3: [idx(0, 0), 4, idx(2, 2)],
    4: [idx(0, 0), idx(2, 0), idx(0, 2), idx(2, 2)],
    5: [idx(0, 0), idx(2, 0), 4, idx(0, 2), idx(2, 2)],
    6: [idx(0, 0), idx(2, 0), idx(0, 1), idx(2, 1), idx(0, 2), idx(2, 2)],
  };
  const pts = maps[clamp(t.value || 0, 1, 6)];

  g.beginFill(PIP_COLOR, PIP_ALPHA);
  for (const i of pts) {
    const x = xs[i % 3];
    const y = ys[Math.floor(i / 3)];
    if (PIP_SQUARE) g.drawRoundedRect(x - size / 2, y - size / 2, size, size, r);
    else g.drawCircle(x, y, size / 2);
  }
  g.endFill();
}

// ✅ PATCH: nema "ghost alpha"; prazno briše pips i gasi overlay
export function setValue(t: Tile, v: number, addStack = 0): void {
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
let mergeStackValue = 0;
let mergeStackCount = 0;
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

  t.shadow!.visible = false;
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
      const p = i / (layers - 1); // 0..1
      const grow = 1.0 + p * 0.42; // total size growth
      const width = TILE * grow * 1.08; // a bit wider than tall (elliptical feel)
      const height = TILE * grow * 0.90; // compress vertically for a softer base

      // Exponential alpha falloff so outer rings are very subtle
      const alpha = 0.20 * Math.pow(1 - p, 1.6);
      if (alpha <= 0.003) continue;

      // Increase shift with each outer layer for natural parallax
      let shift = baseShift * (0.35 + p * 1.1);
      // extra push from tilt (stronger inner layers)
      shift += (TILE * 0.02) * (1 - p) * tiltAbs;
      const ox = -width / 2 + nx * shift + 1; // +1 tiny pixel nudge for sub-pixel crispness
      const oy = -height / 2 + ny * shift + 4 + biasY;

      sh.beginFill(0xBDA38D, alpha)
        .drawRoundedRect(ox, oy, width, height, TILE * 0.22)
        .endFill();
    }

    // rotate and subtly distort shadow to follow visual tilt
    try {
      sh.rotation = tilt * 0.55; // follow about half the tile's tilt
      const sx = 1 + tiltAbs * 0.08; // slight stretch sideways
      const sy = 1 - tiltAbs * 0.04; // slight flatten
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
  try {
    t.rotG.pivot.set(0, -TILE / 2);
    t.rotG.position.set(0, -TILE / 2);
  } catch {}
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

  board.addChild(t);

  // DON'T hide ghost on creation - wait to see if tile will be unlocked
  // Ghost will be hidden only for tiles that REMAIN locked after board setup
  // This is handled by updateGhostVisibility() called after board setup

  board.sortChildren(); // Sort after adding tile
  tiles.push(t);
  grid[r] = grid[r] || [];
  grid[r][c] = t;

  drawStack(t);
  drawPips(t);

  // When tile is destroyed, update ghost visibility for the entire board
  const __origDestroy = t.destroy.bind(t);
  t.destroy = (opts?: any) => {
    __origDestroy(opts);

    // Update all ghost placeholders after tile is destroyed
    // 🔥 MEMORY LEAK FIX: Track timeout for cleanup
    const timeout = setTimeout(() => {
      if (typeof (window as any).updateGhostVisibility === 'function') {
        (window as any).updateGhostVisibility();
      }
      // 🔥 Remove from global tracker
      if ((window as any)._activeTimeouts) {
        (window as any)._activeTimeouts.delete(timeout);
      }
    }, 50);
    
    // 🔥 MEMORY LEAK FIX: Track timeout globally for cleanup
    if (!(window as any)._activeTimeouts) {
      (window as any)._activeTimeouts = new Set();
    }
    (window as any)._activeTimeouts.add(timeout);
  };

  return t;
}

function tileIsWild(tile: Tile | null | undefined): boolean {
  if (!tile) return false;
  const special = tile.special;
  return special === 'wild' || special === 'wild-magnet';
}

function tileIsActive(tile: Tile | null | undefined): boolean {
  if (!tile || tile.destroyed) return false;
  if (tile.visible === false) return false;
  
  // 🔥 CRITICAL: Locked tiles with value > 0 are still active (e.g. during magnet pull)
  // Only exclude locked tiles with value 0 (ghost placeholders)
  const value = (tile.value | 0);
  if (value > 0) {
    return true; // Active regardless of locked status
  }
  
  // Wild tiles are active even if locked temporarily
  return tileIsWild(tile);
}

export function anyMergePossible(allTiles: (Container | Tile)[]): boolean {
  const open = allTiles.filter((t) => tileIsActive(t as Tile)) as Tile[];
  
  // Check for wild cubes - they can merge with any other tile (including wild-magnet)
  const wildCubes = open.filter((t) => t.special === 'wild' || t.special === 'wild-magnet');
  
  // 🔥 CRITICAL: Separate wild stars from magnets for better logic
  const wildStars = open.filter((t) => t.special === 'wild');
  const magnets = open.filter((t) => t.special === 'wild-magnet');
  
  const mergeableNonWildTiles = open.filter((t) => {
    if (!t || t.special === 'wild' || t.special === 'wild-magnet') return false;
    const value = (t.value | 0);
    // 🔥 CRITICAL FIX: Wild CAN merge with merge 6! Changed from < 6 to <= 6
    // This was causing false "stuck" detection when board had merge 6 + wild star
    return value > 0 && value <= 6; // Wild can merge with 1, 2, 3, 4, 5, AND 6!
  });

  // 🔥 OPTIMIZED: Reduced logging - only log summary
  console.log('🔍 anyMergePossible:', open.length, 'active tiles (', wildStars.length, 'wild,', magnets.length, 'magnets,', mergeableNonWildTiles.length, 'regular)');

  // 🔥 CRITICAL FIX: If we have wild stars and any mergeable non-wild tiles, we can merge
  // Wild stars can merge with regular tiles
  // 🚨 NOTE: Wild + wild merges are BLOCKED in app-core.ts (line 1680)
  if (wildStars.length > 0 && mergeableNonWildTiles.length > 0) {
    console.log('✅ anyMergePossible: Wild + regular = TRUE');
    return true;
  }
  
  // 🚨 CRITICAL: If we have ONLY wild stars (no regular tiles), game is stuck!
  // Wild + wild merges are BLOCKED, so 2+ wilds alone cannot merge
  if (wildStars.length >= 2 && mergeableNonWildTiles.length === 0 && magnets.length === 0) {
    console.log('❌ anyMergePossible: Only wilds (wild+wild blocked) = FALSE');
    return false;
  }
  
  // 🔥 CRITICAL FIX: If we have magnets and ANY other tiles (including wild stars), we can merge
  // Magnets can pull tiles together to create merges
  if (magnets.length > 0 && (mergeableNonWildTiles.length > 0 || wildStars.length > 0)) {
    console.log('✅ anyMergePossible: Magnet + other tiles = TRUE');
    return true;
  }
  
  // 🚨 NOTE: Magnet + magnet merges are BLOCKED in app-core.ts (line 1681)
  // So we DON'T check for magnets.length >= 2 here
  // If only magnets remain, game is stuck (emergency rescue will spawn tiles)

  // 🔥 CRITICAL FIX v38: Check stackDepth for single tiles
  // A single STACK can merge with itself if depth > 1
  // Calculate total tiles including stackDepth
  const totalTiles = open.reduce((sum, t) => {
    const depth = (t as any).stackDepth || 1;
    return sum + depth;
  }, 0);
  
  console.log('🔍 anyMergePossible: Total tiles (with stackDepth):', totalTiles, 'Visible tiles:', open.length);
  
  // If less than 2 TOTAL tiles, no merges possible
  if (totalTiles < 2) {
    console.log('❌ anyMergePossible: < 2 total tiles = FALSE');
    return false;
  }
  
  // 🔥 EDGE CASE: Single visible tile but it's a stack (depth > 1)
  // Stack can merge with itself (unless it's merge 6 with depth 1)
  if (open.length === 1 && totalTiles >= 2) {
    const singleTile = open[0];
    const value = (singleTile.value || 0);
    const stackDepth = (singleTile as any).stackDepth || 1;
    
    console.log('🔍 anyMergePossible: Single visible tile is a stack:', { value, stackDepth, totalTiles });
    
    // Stack can always merge with itself (unless merge 6 with depth 1)
    if (value !== 6 || stackDepth > 1) {
      console.log('✅ anyMergePossible: Single stack can merge with itself = TRUE');
      return true;
    } else {
      console.log('❌ anyMergePossible: Single merge 6 with depth 1 = FALSE');
      return false;
    }
  }
  
  // Check regular tile combinations
  for (let i = 0; i < open.length; i++) {
    for (let j = i + 1; j < open.length; j++) {
      const tile1 = open[i];
      const tile2 = open[j];
      
      // Skip wild cubes in this check (they're already handled above)
      if (tile1.special === 'wild' || tile1.special === 'wild-magnet' || 
          tile2.special === 'wild' || tile2.special === 'wild-magnet') {
        continue;
      }
      
      const s = (tile1.value || 0) + (tile2.value || 0);
      const isValid = s >= 2 && s <= 6;
      
      if (isValid) {
        console.log(`✅ anyMergePossible: ${tile1.value}+${tile2.value}=${s} = TRUE`);
        return true;
      }
    }
  }

  console.log('❌ anyMergePossible: No valid pairs = FALSE');
  return false;
}
