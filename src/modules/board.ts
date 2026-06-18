// src/modules/board.ts
import { Container, Sprite, Assets, Graphics, SCALE_MODES, Texture, Rectangle } from 'pixi.js';
import { logger } from '../core/logger.js';
import {
  TILE, COLS, ROWS, GAP,
  PIPS_INNER_FACTOR, PIP_COLOR, PIP_ALPHA, PIP_RADIUS, PIP_SQUARE,
  ASSET_TILE,
  ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4,
  ASSET_WILD, ASSET_WILD_MAGNET, ASSET_WILD_JUICE, ASSET_WILD_TNT,
} from './constants.js';
import {
  getSpecialDiceTexturePath,
  getSpecialDiceVisualConfig,
  isSpecialDiceDirectWildLikeTile,
  isSpecialDiceMagnetLikeTile,
} from './special-dice-registry.ts';
import { isWildLikeTile } from './final-merge-rules.ts';

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

export const TILE_Z_LOCKED = 5;
export const TILE_Z_ACTIVE = 20;
export const TILE_Z_LOCKED_ANIMATING = 80;
export const TILE_Z_ACTIVE_ANIMATING = 120;

export function getTileBaseZIndex(tile: Partial<Tile> | any): number {
  return tile?.locked ? TILE_Z_LOCKED : TILE_Z_ACTIVE;
}

export function getTileAnimatingZIndex(tile: Partial<Tile> | any): number {
  return tile?.locked ? TILE_Z_LOCKED_ANIMATING : TILE_Z_ACTIVE_ANIMATING;
}

export function syncTileZIndex(tile: Partial<Tile> | any, board?: { sortChildren?: () => void } | null, animating = false): void {
  if (!tile || tile.destroyed) return;
  if ((tile as any)._ccWildSpawnDropping === true) return;
  tile.zIndex = animating ? getTileAnimatingZIndex(tile) : getTileBaseZIndex(tile);
  try { board?.sortChildren?.(); } catch {}
}

// random skin: 40% base, 30% alt2, 20% alt3, 10% alt4
function textureSource(tex: any): any {
  return tex?.source ?? tex?.baseTexture ?? null;
}

function isUsableTexture(tex: any): boolean {
  if (!tex || tex === Texture.EMPTY || tex.destroyed) return false;
  const src = textureSource(tex);
  if (src?.destroyed || src?.valid === false) return false;
  const width = tex.width || src?.width || tex.orig?.width || 0;
  const height = tex.height || src?.height || tex.orig?.height || 0;
  return width > 1 && height > 1;
}

function getBoardTexture(assetPath: string): Texture {
  const cached = Assets.get(assetPath);
  if (isUsableTexture(cached)) return cached;
  const fallback = Texture.from(assetPath);
  return isUsableTexture(fallback) ? fallback : Texture.EMPTY;
}

function pickNumbersSkin() {
  const p = Math.random();
  const base = getBoardTexture(ASSET_NUMBERS);
  if (p < 0.40) return base;
  if (p < 0.70) {
    const tex = getBoardTexture(ASSET_NUMBERS2);
    return tex !== Texture.EMPTY ? tex : base;
  }
  if (p < 0.90) {
    const tex = getBoardTexture(ASSET_NUMBERS3);
    return tex !== Texture.EMPTY ? tex : base;
  }
  const tex = getBoardTexture(ASSET_NUMBERS4);
  return tex !== Texture.EMPTY ? tex : base;
}

export function drawStack(tile: Tile): void {
  // 🔥 OPTIMIZATION: Use requestAnimationFrame to prevent blocking during bubbles animation
  // This prevents frame drops when stack is drawn during active animations
  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    requestAnimationFrame(() => {
      // 🔥 FIX: Check if tile is destroyed before executing
      if (tile && !tile.destroyed) {
        _drawStackInternal(tile);
      }
    });
  } else {
    _drawStackInternal(tile);
  }
}

function _drawStackInternal(tile: Tile): void {
  try { tile.stackG?.destroy({ children: true }); } catch {}
  tile.stackG = null;

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
export function drawPips(t: Tile): void {
  // 🔥 OPTIMIZATION: Use requestAnimationFrame to prevent blocking during animations
  // This prevents frame drops when pips are drawn during bubbles/wild animations
  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    requestAnimationFrame(() => {
      // 🔥 FIX: Check if tile is destroyed before executing
      if (t && !t.destroyed) {
        _drawPipsInternal(t);
      }
    });
  } else {
    _drawPipsInternal(t);
  }
}

function _drawPipsInternal(t: Tile): void {
  // 🔥 CRITICAL FIX: Check if tile is destroyed or pips is null before clearing
  if (!t || t.destroyed) return;
  const g = t.pips;
  if (!g || g.destroyed) return;
  const host = t.rotG || t;
  if ((g as any).parent !== host) {
    try { (g as any).parent?.removeChild?.(g); } catch {}
    try { host.addChild(g); } catch {}
  }
  try { (g as any).position?.set?.(0, 0); } catch {}
  try { (g as any).pivot?.set?.(0, 0); } catch {}
  try { (g as any).scale?.set?.(1, 1); } catch {}
  try { (g as any).rotation = 0; } catch {}
  try { (g as any).visible = true; } catch {}
  try { (g as any).alpha = 1; } catch {}
  // 🔥 CRITICAL FIX: Double-check pips context before clearing (can become null during async operations)
  try {
    if (g.context) {
      g.clear();
    }
  } catch (err) {
    // Graphics object may be destroyed or context may be null - silently skip
    return;
  }

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

  const useV8 = typeof (g as any).fill === 'function';
  if (useV8) {
    for (const i of pts) {
      const x = xs[i % 3];
      const y = ys[Math.floor(i / 3)];
      if (PIP_SQUARE) (g as any).roundRect(x - size / 2, y - size / 2, size, size, r).fill({ color: PIP_COLOR, alpha: PIP_ALPHA });
      else (g as any).circle(x, y, size / 2).fill({ color: PIP_COLOR, alpha: PIP_ALPHA });
    }
  } else {
    g.beginFill(PIP_COLOR, PIP_ALPHA);
    for (const i of pts) {
      const x = xs[i % 3];
      const y = ys[Math.floor(i / 3)];
      if (PIP_SQUARE) g.drawRoundedRect(x - size / 2, y - size / 2, size, size, r);
      else g.drawCircle(x, y, size / 2);
    }
    g.endFill();
  }
}

// ✅ PATCH: nema "ghost alpha"; prazno briše pips i gasi overlay
export function setValue(t: Tile, v: number, addStack = 0): void {
  t.value = v;

  // Pločica NIKAD nije poluprozirna - osim ako nije locked
  if (!t.locked) {
    t.alpha = 1;
  }

  // 🔥 OPTIMIZATION: Use requestAnimationFrame for visual updates to prevent blocking during animations
  // This prevents frame drops when setValue is called during bubbles/wild animations
  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    requestAnimationFrame(() => {
      // 🔥 CRITICAL: Check if tile still exists before setting visuals (it might have been destroyed)
      if (!t || t.destroyed) {
        console.warn('⚠️ setValue skipped: tile is null or destroyed', { tile: t, destroyed: t?.destroyed });
        return;
      }
      _setValueVisuals(t, v, addStack);
    });
  } else {
    // 🔥 CRITICAL: Check if tile still exists before setting visuals
    if (!t || t.destroyed) {
      console.warn('⚠️ setValue skipped: tile is null or destroyed', { tile: t, destroyed: t?.destroyed });
      return;
    }
    _setValueVisuals(t, v, addStack);
  }
}

function _setValueVisuals(t: Tile, v: number, addStack: number): void {
  // 🔥 CRITICAL FIX: Ensure t.value is set to v BEFORE any visual operations
  // This prevents race conditions where drawPips might use stale t.value
  // (especially important when called via requestAnimationFrame)
  if (t && !t.destroyed) {
    t.value = v;
  }
  
  // 🔥 CRITICAL: Check special FIRST before setting any texture
  // This ensures wild-juice, wild-magnet, and wild tiles ALWAYS get correct texture
  if (isWildLikeTile(t)) {
    try {
      t.stackDepth = 1;
      try { t.stackG?.destroy({ children: true }); } catch {}
      t.stackG = null;

      // 🔥 CRITICAL: Ensure base sprite exists
      if (!t.base) {
        const host = t.rotG || t;
        t.base = host.children?.find((c: any) => c.texture instanceof Texture) as Sprite || null;
        if (!t.base && host) {
          // Create base sprite if it doesn't exist
          t.base = new Sprite(Texture.from(ASSET_TILE));
          t.base.anchor.set(0.5);
          t.base.width = TILE;
          t.base.height = TILE;
          host.addChild(t.base);
        }
      }
      
      // 🔥 CRITICAL: Always use correct texture for wild type
      let assetPath = t.special === 'wild-magnet'
        ? ASSET_WILD_MAGNET
        : t.special === 'wild-juice'
          ? ASSET_WILD_JUICE
          : t.special === 'wild-tnt'
            ? ASSET_WILD_TNT
            : ASSET_WILD;
      assetPath = getSpecialDiceTexturePath(t, assetPath);
      
      const tex = getBoardTexture(assetPath);
      if (t.base && tex && tex !== Texture.EMPTY) {
        t.base.texture = tex;
        const wildFaceSize = t.special === 'wild-magnet' ? TILE * 0.96 : TILE;
        const specialVisual = getSpecialDiceVisualConfig(t);
        if (specialVisual?.visualWidth && specialVisual?.visualHeight) {
          t.base.width = specialVisual.visualWidth;
          t.base.height = specialVisual.visualHeight;
        } else if (specialVisual?.visualFit === 'height') {
          const textureHeight = tex?.orig?.height || tex?.height || wildFaceSize;
          const uniformScale = wildFaceSize / Math.max(1, textureHeight);
          t.base.scale.set(uniformScale);
        } else if (specialVisual?.visualWidth) {
          const textureWidth = tex?.orig?.width || tex?.width || wildFaceSize;
          const uniformScale = specialVisual.visualWidth / Math.max(1, textureWidth);
          t.base.scale.set(uniformScale);
        } else {
          t.base.width = wildFaceSize;
          t.base.height = wildFaceSize;
        }
        if (specialVisual?.hitAreaSize === 'tile') {
          const half = TILE / 2;
          const hitArea = new Rectangle(-half, -half, TILE, TILE);
          t.hitArea = hitArea;
          const host = t.rotG || t;
          if (host) host.hitArea = hitArea;
        }
        try {
          (t.base as any).eventMode = 'none';
          (t.base as any).cursor = 'default';
        } catch {}
        (t.base as any).tint = 0xFFFFFF;
        (t.base as any).alpha = 1;
        t.base.visible = true;
        // Optimize texture for pixel-perfect rendering
        const bt = t.base.texture && ((t.base.texture as { source?: { scaleMode?: string } }).source ?? t.base.texture.baseTexture);
        if (bt) bt.scaleMode = 'nearest';
      }
      
      // 🔥 CRITICAL: Hide pips and num for wild tiles
      if (t.num) t.num.visible = false;
      if (t.pips) {
        t.pips.visible = false;
        t.pips.clear?.(); // Clear pips to prevent them from showing
      }
      if (t.shadow) t.shadow.visible = false;
      t.isWild = true;
      t.isWildFace = true;
      (t as any)._ccWildSpecial = t.special;
    } catch (error) {
      console.error('❌ Error setting wild texture:', error);
    }
  } else if ((v | 0) > 0) {
    // aktivna pločica (only if NOT a wild tile)
    if (t.base) {
      t.base.texture = pickNumbersSkin();
      t.base.width = TILE;
      t.base.height = TILE;
      const bt2 = t.base.texture && ((t.base.texture as { source?: { scaleMode?: string } }).source ?? t.base.texture.baseTexture);
      if (bt2) bt2.scaleMode = 'nearest';
    }
    if (t.overlay) t.overlay.visible = false;
  } else {
    // prazno/locked
    if (t.base) {
      t.base.texture = getBoardTexture(ASSET_TILE);
      t.base.width = TILE;
      t.base.height = TILE;
      const bt3 = t.base.texture && ((t.base.texture as { source?: { scaleMode?: string } }).source ?? t.base.texture.baseTexture);
      if (bt3) bt3.scaleMode = 'nearest';
    }
    if (t.overlay) t.overlay.visible = false;
    t.pips?.clear?.(); // odmah ukloni pips da ne "procure"
  }

  // Ghost placeholders are now handled by drawBoardBG

  if (addStack) {
    t.stackDepth = Math.min(4, (t.stackDepth || 1) + addStack);
    try {
      const st = (window as any).STATE;
      if (st) {
        const prev = Number.isFinite(st.maxStackDepth) ? st.maxStackDepth : 1;
        const next = Math.max(prev, t.stackDepth || 1);
        if (next !== prev) st.maxStackDepth = next;
      }
    } catch {}
  }
  drawStack(t);
  
  // 🔥 CRITICAL: Don't draw pips for wild tiles (they should never show pips)
  if (!isWildLikeTile(t)) {
    drawPips(t);
  }
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
  syncTileZIndex(t, null);

  // meka "sjena"
  const sh = new Graphics();
  t.addChild(sh);
  t.shadow = sh;

  // board center in board-local space (based on grid layout)
  const boardCenterX = ((COLS - 1) * (TILE + GAP) + TILE) * 0.5;
  const boardCenterY = ((ROWS - 1) * (TILE + GAP) + TILE) * 0.5;

  t.shadow!.visible = false;
  
  // 🔥 USER REQUEST: Helper function to draw star shape for wild tile shadow
  const drawStar = (g: Graphics, x: number, y: number, outerRadius: number, innerRadius: number, points: number = 5): void => {
    const angleStep = (Math.PI * 2) / points;
    const startAngle = -Math.PI / 2; // Start at top
    
    g.moveTo(
      x + Math.cos(startAngle) * outerRadius,
      y + Math.sin(startAngle) * outerRadius
    );
    
    for (let i = 1; i <= points * 2; i++) {
      const angle = startAngle + (i * angleStep / 2);
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      g.lineTo(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius
      );
    }
    g.closePath();
  };
  
  // 🔥 USER REQUEST: Helper function to draw juice mug shape for wild-juice tile shadow
  const drawJuiceMug = (g: Graphics, x: number, y: number, width: number, height: number): void => {
    const mugWidth = width * 0.85;
    const mugHeight = height * 0.9;
    const handleWidth = width * 0.15;
    const handleHeight = height * 0.4;
    const rimWidth = mugWidth * 1.1; // Rim is slightly wider
    const rimHeight = height * 0.12;
    
    // Main mug body (trapezoid shape - wider at top, narrower at bottom)
    const topWidth = mugWidth;
    const bottomWidth = mugWidth * 0.75;
    const bodyHeight = mugHeight * 0.7;
    
    // Start from top-left of mug body
    g.moveTo(x - topWidth / 2, y - mugHeight / 2);
    // Top rim (wider)
    g.lineTo(x + topWidth / 2, y - mugHeight / 2);
    // Right side (slightly angled inward)
    g.lineTo(x + bottomWidth / 2, y - mugHeight / 2 + bodyHeight);
    // Bottom
    g.lineTo(x - bottomWidth / 2, y - mugHeight / 2 + bodyHeight);
    // Left side
    g.lineTo(x - topWidth / 2, y - mugHeight / 2);
    g.closePath();
    
    // Handle (semicircle on the right side)
    const handleCenterX = x + topWidth / 2 + handleWidth * 0.3;
    const handleCenterY = y - mugHeight / 2 + handleHeight / 2;
    const handleRadius = handleWidth * 0.4;
    
    // Draw handle as a rounded rectangle shape
    g.moveTo(x + topWidth / 2, y - mugHeight / 2 + handleHeight * 0.2);
    g.quadraticCurveTo(
      handleCenterX, y - mugHeight / 2 + handleHeight * 0.1,
      handleCenterX, handleCenterY - handleRadius
    );
    g.arc(handleCenterX, handleCenterY, handleRadius, -Math.PI / 2, Math.PI / 2);
    g.quadraticCurveTo(
      handleCenterX, y - mugHeight / 2 + handleHeight * 0.9,
      x + topWidth / 2, y - mugHeight / 2 + handleHeight * 0.8
    );
    g.closePath();
  };
  
  // 🔥 USER REQUEST: Helper function to draw magnet shape for wild-magnet tile shadow
  const drawMagnet = (g: Graphics, x: number, y: number, width: number, height: number): void => {
    const magnetWidth = width * 0.8;
    const magnetHeight = height * 0.85;
    const barWidth = magnetWidth * 0.25; // Width of each bar
    const gap = magnetWidth * 0.15; // Gap between bars
    
    // Left bar (U shape)
    const leftBarX = x - magnetWidth / 2;
    const leftBarTopY = y - magnetHeight / 2;
    const leftBarBottomY = y + magnetHeight / 2;
    
    // Top horizontal bar
    g.moveTo(leftBarX, leftBarTopY);
    g.lineTo(leftBarX + barWidth, leftBarTopY);
    g.lineTo(leftBarX + barWidth, leftBarTopY + barWidth);
    g.lineTo(leftBarX, leftBarTopY + barWidth);
    g.closePath();
    
    // Left vertical bar
    g.moveTo(leftBarX, leftBarTopY + barWidth);
    g.lineTo(leftBarX + barWidth, leftBarTopY + barWidth);
    g.lineTo(leftBarX + barWidth, leftBarBottomY - barWidth);
    g.lineTo(leftBarX, leftBarBottomY - barWidth);
    g.closePath();
    
    // Bottom horizontal bar (left)
    g.moveTo(leftBarX, leftBarBottomY - barWidth);
    g.lineTo(leftBarX + barWidth, leftBarBottomY - barWidth);
    g.lineTo(leftBarX + barWidth, leftBarBottomY);
    g.lineTo(leftBarX, leftBarBottomY);
    g.closePath();
    
    // Right bar (U shape)
    const rightBarX = x + magnetWidth / 2 - barWidth;
    
    // Top horizontal bar (right)
    g.moveTo(rightBarX, leftBarTopY);
    g.lineTo(rightBarX + barWidth, leftBarTopY);
    g.lineTo(rightBarX + barWidth, leftBarTopY + barWidth);
    g.lineTo(rightBarX, leftBarTopY + barWidth);
    g.closePath();
    
    // Right vertical bar
    g.moveTo(rightBarX, leftBarTopY + barWidth);
    g.lineTo(rightBarX + barWidth, leftBarTopY + barWidth);
    g.lineTo(rightBarX + barWidth, leftBarBottomY - barWidth);
    g.lineTo(rightBarX, leftBarBottomY - barWidth);
    g.closePath();
    
    // Bottom horizontal bar (right)
    g.moveTo(rightBarX, leftBarBottomY - barWidth);
    g.lineTo(rightBarX + barWidth, leftBarBottomY - barWidth);
    g.lineTo(rightBarX + barWidth, leftBarBottomY);
    g.lineTo(rightBarX, leftBarBottomY);
    g.closePath();
  };
  
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

      // 🔥 USER REQUEST: Check tile type for custom shadow shapes
      const isWildStar = t.special === 'wild';
      const isWildJuice = t.special === 'wild-juice';
      const isWildMagnet = t.special === 'wild-magnet';
      const isWildTnt = t.special === 'wild-tnt';

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

        const shV8 = sh as any;
        const useV8Fill = typeof shV8.fill === 'function' && typeof shV8.roundRect === 'function';
        if (useV8Fill) {
          if (isWildStar) {
            const centerX = ox + width / 2;
            const centerY = oy + height / 2;
            const outerRadius = Math.min(width, height) * 0.45;
            const innerRadius = outerRadius * 0.4;
            drawStar(sh, centerX, centerY, outerRadius, innerRadius, 5);
            shV8.fill({ color: 0xBDA38D, alpha });
          } else if (isWildJuice) {
            const centerX = ox + width / 2;
            const centerY = oy + height / 2;
            drawJuiceMug(sh, centerX, centerY, width, height);
            shV8.fill({ color: 0xBDA38D, alpha });
          } else if (isWildMagnet) {
            const centerX = ox + width / 2;
            const centerY = oy + height / 2;
            drawMagnet(sh, centerX, centerY, width, height);
            shV8.fill({ color: 0xBDA38D, alpha });
          } else {
            shV8.roundRect(ox, oy, width, height, TILE * 0.22).fill({ color: 0xBDA38D, alpha });
          }
        } else {
          sh.beginFill(0xBDA38D, alpha);
          if (isWildStar) {
            const centerX = ox + width / 2;
            const centerY = oy + height / 2;
            const outerRadius = Math.min(width, height) * 0.45;
            const innerRadius = outerRadius * 0.4;
            drawStar(sh, centerX, centerY, outerRadius, innerRadius, 5);
          } else if (isWildJuice) {
            const centerX = ox + width / 2;
            const centerY = oy + height / 2;
            drawJuiceMug(sh, centerX, centerY, width, height);
          } else if (isWildMagnet) {
            const centerX = ox + width / 2;
            const centerY = oy + height / 2;
            drawMagnet(sh, centerX, centerY, width, height);
          } else if (isWildTnt) {
            sh.drawRoundedRect(ox, oy, width, height, TILE * 0.22);
          } else {
            sh.drawRoundedRect(ox, oy, width, height, TILE * 0.22);
          }
          sh.endFill();
        }
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
  const face = new Sprite(getBoardTexture(ASSET_TILE));
  face.anchor.set(0.5);
  face.width = TILE;
  face.height = TILE;
  const faceSrc = face.texture && ((face.texture as { source?: { scaleMode?: string } }).source ?? face.texture.baseTexture);
  if (faceSrc) faceSrc.scaleMode = 'nearest';
  t.rotG.addChild(face);
  t.base = face;

  // poluprozirni "numbers" overlay – (PATCH) gasimo ga defaultno; ne koristimo kao ghost
  const ov = new Sprite(getBoardTexture(ASSET_NUMBERS));
  ov.anchor.set(0.5);
  ov.width = TILE;
  ov.height = TILE;
  ov.alpha = 0.55;
  const ovSrc = ov.texture && ((ov.texture as { source?: { scaleMode?: string } }).source ?? ov.texture.baseTexture);
  if (ovSrc) ovSrc.scaleMode = 'nearest';
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
  return isWildLikeTile(tile);
}

function tileIsActive(tile: Tile | null | undefined): boolean {
  if (!tile || tile.destroyed) return false;
  if (tile.visible === false) return false;
  
  // 🔥 CRITICAL: Wild tiles are ALWAYS active for anyMergePossible - even when locked
  // User request: "kad imamo wild da je to definitivno nastava igre a ne fail screen"
  // Locked wild (e.g. during spawn) will unlock; we must NOT show fail while wild exists
  if (tileIsWild(tile)) return true;
  
  // Exclude locked tiles from active tiles (non-wild)
  // Exception: Wild-magnet affected tiles are locked during pull animation but will unlock after merge
  const isWildMagnetAffected = (tile as any)?._wildMagnetAffected === true;
  
  if (tile.locked && !isWildMagnetAffected) {
    return false;
  }
  
  // Only exclude locked tiles with value 0 (ghost placeholders)
  const value = (tile.value | 0);
  if (value > 0) {
    return true; // Active if unlocked (or wild-magnet affected)
  }
  
  return false;
}

export function anyMergePossible(allTiles: (Container | Tile)[]): boolean {
  const open = allTiles.filter((t) => tileIsActive(t as Tile)) as Tile[];
  
  // Check for wild cubes - they can merge with any other tile (including wild-magnet)
  const wildCubes = open.filter(tileIsWild);
  
  // 🔥 CRITICAL: Separate wild stars from magnets for better logic
  const wildStars = open.filter((t) => isSpecialDiceDirectWildLikeTile(t) || (t as any).isWild === true || (t as any).isWildFace === true);
  const magnets = open.filter((t) => isSpecialDiceMagnetLikeTile(t));
  
  const mergeableNonWildTiles = open.filter((t) => {
    if (!t || tileIsWild(t)) return false;
    const value = (t.value | 0);
    // 🔥 CRITICAL FIX: Wild CAN merge with merge 6! Changed from < 6 to <= 6
    // This was causing false "stuck" detection when board had merge 6 + wild star
    return value > 0 && value <= 6; // Wild can merge with 1, 2, 3, 4, 5, AND 6!
  });

  // 🔥 OPTIMIZED: Reduced logging - only log summary
  logger.debug('🔍 anyMergePossible', 'board', { 
    activeTiles: open.length, 
    wild: wildStars.length, 
    magnets: magnets.length, 
    regular: mergeableNonWildTiles.length 
  });

  // 🔥 CRITICAL FIX: If we have wild stars and any mergeable non-wild tiles, we can merge
  // Wild stars can merge with regular tiles
  // 🚨 NOTE: Wild + wild merges are BLOCKED in app-core.ts (line 1680)
  if (wildStars.length > 0 && mergeableNonWildTiles.length > 0) {
    logger.debug('✅ anyMergePossible: Wild + regular = TRUE', 'board');
    return true;
  }
  
  // 🚨 CRITICAL: If we have ONLY wild stars (no regular tiles), game is stuck!
  // Wild + wild merges are BLOCKED, so 2+ wilds alone cannot merge
  if (wildStars.length >= 2 && mergeableNonWildTiles.length === 0 && magnets.length === 0) {
    logger.debug('❌ anyMergePossible: Only wilds (wild+wild blocked) = FALSE', 'board');
    return false;
  }
  
  // 🔥 CRITICAL FIX: If we have magnets and ANY other tiles (including wild stars), we can merge
  // Magnets can pull tiles together to create merges
  if (magnets.length > 0 && (mergeableNonWildTiles.length > 0 || wildStars.length > 0)) {
    logger.debug('✅ anyMergePossible: Magnet + other tiles = TRUE', 'board');
    return true;
  }
  
  // 🚨 NOTE: Magnet + magnet merges are BLOCKED in app-core.ts
  // If only magnets remain, game is stuck

  // 🔥 CRITICAL FIX v38: Check stackDepth for single tiles
  // A single STACK can merge with itself if depth > 1
  // Calculate total tiles including stackDepth
  const totalTiles = open.reduce((sum, t) => {
    const depth = (t as any).stackDepth || 1;
    return sum + depth;
  }, 0);
  
  logger.debug('🔍 anyMergePossible: Total tiles (with stackDepth)', 'board', { totalTiles, visibleTiles: open.length });
  
  // If less than 2 TOTAL tiles, no merges possible
  if (totalTiles < 2) {
    logger.debug('❌ anyMergePossible: < 2 total tiles = FALSE', 'board');
    return false;
  }
  
  // 🔥 RULE: Single visible tile is NEVER a valid move source.
  // Even if stackDepth > 1, we do NOT allow self-merge for hints/endgame.
  if (open.length === 1) {
    logger.debug('❌ anyMergePossible: Single visible tile = FALSE', 'board');
    return false;
  }
  
  // Check regular tile combinations
  // 🔥 CRITICAL: Log all tiles being checked for debugging
  if (open.length > 0) {
    logger.debug('🔍 anyMergePossible: Checking tiles for valid merge pairs', 'board', { 
      tileCount: open.length,
      tiles: open.map(t => ({ value: t.value, special: t.special, locked: t.locked, destroyed: t.destroyed, visible: t.visible }))
    });
  }
  
  for (let i = 0; i < open.length; i++) {
    for (let j = i + 1; j < open.length; j++) {
      const tile1 = open[i];
      const tile2 = open[j];
      
      // 🔥 CRITICAL: Skip null/destroyed tiles
      if (!tile1 || !tile2 || tile1.destroyed || tile2.destroyed) {
        continue;
      }
      
      // Skip wild cubes in this check (they're already handled above)
      if (tileIsWild(tile1) || tileIsWild(tile2)) {
        continue;
      }
      
      const val1 = (tile1.value || 0);
      const val2 = (tile2.value || 0);
      const s = val1 + val2;
      // Keep merge-possibility rules aligned with app-core canDrop():
      // - regular sums in [2..6] are valid
      // - matching regular values only matter here while they are still productive toward 6
      // - merge 6 can merge with any regular 1..5 to continue the run
      const isMerge6Continuation =
        (val1 === 6 && val2 >= 1 && val2 <= 5) ||
        (val2 === 6 && val1 >= 1 && val1 <= 5);
      const isSameValueStack = val1 > 0 && val1 === val2 && val1 <= 3;
      const isValid = isSameValueStack || isMerge6Continuation || (s >= 2 && s <= 6);
      
      if (isValid) {
        logger.debug(`✅ anyMergePossible: ${val1}+${val2}=${s} = TRUE`, 'board');
        return true;
      }
    }
  }

  logger.debug('❌ anyMergePossible: No valid pairs = FALSE', 'board', {
    tiles: open.map(t => ({
      value: t.value,
      special: t.special,
      locked: t.locked,
      destroyed: t.destroyed,
      visible: t.visible,
      gridX: (t as any).gridX,
      gridY: (t as any).gridY
    }))
  });
  return false;
}
