// drag-utils.ts
// Utility functions for drag and drop system

import { Graphics, Container, Sprite, Texture, Application } from 'pixi.js';
import { gsap } from 'gsap';
import { 
  TILT_MAX_RAD, 
  TILT_SCALE, 
  VEL_SMOOTH, 
  ROT_SMOOTH, 
  POS_LAG_PX,
  MAGNET_OFFSET_RATIO,
  MAGNET_SCALE_MULT,
  VISUAL_EFFECTS
} from './drag-constants.js';

// Type definitions
interface Tile extends Container {
  gridX: number;
  gridY: number;
  value: number;
  locked: boolean;
  special?: string;
  rotG?: Container;
  shadow?: Graphics;
  refreshShadow?: () => void;
  targetX?: number;
  targetY?: number;
  _zBeforeDrag?: number;
  _magnetHomeX?: number;
  _magnetHomeY?: number;
  _lastVelX?: number;
  _lastVelY?: number;
}

interface Board extends Container {
  toLocal: (global: { x: number; y: number }) => { x: number; y: number };
  addChild: (child: Container) => Container;
  sortChildren?: () => void;
}

// GSAP safety guards
const __dg_orig_to = gsap.to.bind(gsap);
const __dg_orig_fromTo = gsap.fromTo.bind(gsap);
const __dg_orig_set = gsap.set.bind(gsap);

/**
 * Check if target is alive (not destroyed)
 */
export function __dg_alive(target: any): boolean {
  if (!target) return false;
  if (target.destroyed) return false;
  if (target.parent === null && target !== target.stage) return false;
  return true;
}

/**
 * Safe GSAP to function
 */
export function __dg_safe_to(target: any, vars: any, ...args: any[]): any {
  if (!__dg_alive(target)) return { kill: () => {}, progress: () => 0 };
  return __dg_orig_to(target, vars, ...args);
}

/**
 * Safe GSAP fromTo function
 */
export function __dg_safe_fromTo(target: any, fromVars: any, toVars: any, ...args: any[]): any {
  if (!__dg_alive(target)) return { kill: () => {}, progress: () => 0 };
  return __dg_orig_fromTo(target, fromVars, toVars, ...args);
}

/**
 * Safe GSAP set function
 */
export function __dg_safe_set(target: any, vars: any): any {
  if (!__dg_alive(target)) return;
  return __dg_orig_set(target, vars);
}

/**
 * Create linear gradient texture
 */
export function __dg_makeLinearGradientTexture(
  w: number, 
  h: number, 
  colA: number = 0xFFE9D9, 
  colB: number = 0xB2876A, 
  angleRad: number = 0
): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return Texture.EMPTY;
  
  const gradient = ctx.createLinearGradient(
    Math.cos(angleRad) * w,
    Math.sin(angleRad) * h,
    Math.cos(angleRad + Math.PI) * w,
    Math.sin(angleRad + Math.PI) * h
  );
  
  gradient.addColorStop(0, `#${colA.toString(16).padStart(6, '0')}`);
  gradient.addColorStop(1, `#${colB.toString(16).padStart(6, '0')}`);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  
  return Texture.from(canvas);
}

/**
 * Calculate tile tilt based on velocity
 */
export function calculateTileTilt(velocityX: number, velocityY: number): number {
  const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
  const tilt = Math.min(speed * TILT_SCALE, TILT_MAX_RAD);
  return tilt;
}

/**
 * Apply smooth rotation to tile
 */
export function applySmoothRotation(tile: Tile, targetRotation: number): void {
  if (!tile.rotG) return;
  
  const currentRotation = tile.rotG.rotation;
  const smoothedRotation = currentRotation + (targetRotation - currentRotation) * ROT_SMOOTH;
  
  __dg_safe_set(tile.rotG, { rotation: smoothedRotation });
}

/**
 * Calculate parallax offset
 */
export function calculateParallaxOffset(velocityX: number, velocityY: number): { x: number; y: number } {
  const offsetX = Math.max(-POS_LAG_PX, Math.min(POS_LAG_PX, velocityX * 0.1));
  const offsetY = Math.max(-POS_LAG_PX, Math.min(POS_LAG_PX, velocityY * 0.1));
  
  return { x: offsetX, y: offsetY };
}

/**
 * Create hover effect on target tile
 */
export function createHoverEffect(tile: Tile, config: any): Graphics | null {
  if (!tile.rotG) return null;
  
  const hover = new Graphics();
  hover.stroke({ 
    width: config.hoverWidth || 4, 
    color: config.hoverColor || 0xFFE9D9, 
    alpha: config.hoverAlpha || 0.8 
  }).rect(-2, -2, tile.rotG.width + 4, tile.rotG.height + 4);
  
  tile.rotG.addChild(hover);
  return hover;
}

/**
 * Remove hover effect from target tile
 */
export function removeHoverEffect(tile: Tile): void {
  if (!tile.rotG) return;
  
  const hover = tile.rotG.getChildByName('hover');
  if (hover) {
    tile.rotG.removeChild(hover);
  }
}

/**
 * Create shadow for dragged tile
 */
export function createTileShadow(tile: Tile): Graphics {
  const shadow = new Graphics();
  shadow.fill({ color: 0x000000, alpha: VISUAL_EFFECTS.SHADOW_ALPHA })
    .rect(
      VISUAL_EFFECTS.SHADOW_OFFSET,
      VISUAL_EFFECTS.SHADOW_OFFSET,
      tile.width,
      tile.height
    );
  shadow.filters = [new PIXI.filters.BlurFilter(VISUAL_EFFECTS.SHADOW_BLUR)];
  
  tile.addChildAt(shadow, 0);
  return shadow;
}

/**
 * Update shadow position
 */
export function updateShadowPosition(tile: Tile, shadow: Graphics): void {
  if (!shadow) return;
  
  shadow.x = VISUAL_EFFECTS.SHADOW_OFFSET;
  shadow.y = VISUAL_EFFECTS.SHADOW_OFFSET;
}

/**
 * Calculate magnet position
 */
export function calculateMagnetPosition(tile: Tile, targetTile: Tile): { x: number; y: number } {
  const offsetX = targetTile.width * MAGNET_OFFSET_RATIO;
  const offsetY = targetTile.height * MAGNET_OFFSET_RATIO;
  
  return {
    x: targetTile.x + offsetX,
    y: targetTile.y + offsetY
  };
}

/**
 * Apply magnet scale effect
 */
export function applyMagnetScale(targetTile: Tile, scale: number = MAGNET_SCALE_MULT): void {
  if (!targetTile.rotG) return;
  
  __dg_safe_set(targetTile.rotG, { 
    scaleX: scale, 
    scaleY: scale 
  });
}

/**
 * Reset magnet scale effect
 */
export function resetMagnetScale(targetTile: Tile): void {
  if (!targetTile.rotG) return;
  
  __dg_safe_set(targetTile.rotG, { 
    scaleX: 1, 
    scaleY: 1 
  });
}

/**
 * Check if tile can be dropped on target
 */
export function canDropTile(sourceTile: Tile, targetTile: Tile, canDrop?: (src: Tile, dst: Tile) => boolean): boolean {
  if (sourceTile === targetTile) return false;
  if (targetTile.locked) return false;
  if (canDrop) return canDrop(sourceTile, targetTile);
  return true;
}

/**
 * Get tile bounds in world space
 */
export function getTileWorldBounds(tile: Tile): PIXI.Rectangle {
  return tile.getBounds();
}

/**
 * Check if point is within tile bounds
 */
export function isPointInTile(point: { x: number; y: number }, tile: Tile): boolean {
  const bounds = getTileWorldBounds(tile);
  return point.x >= bounds.x && 
         point.x <= bounds.x + bounds.width &&
         point.y >= bounds.y && 
         point.y <= bounds.y + bounds.height;
}

/**
 * Find tile at position
 */
export function findTileAtPosition(
  x: number, 
  y: number, 
  tiles: Tile[], 
  board: Board
): Tile | null {
  const localPos = board.toLocal({ x, y });
  
  for (const tile of tiles) {
    if (isPointInTile(localPos, tile)) {
      return tile;
    }
  }
  
  return null;
}

/**
 * Calculate velocity from movement
 */
export function calculateVelocity(
  currentPos: { x: number; y: number },
  lastPos: { x: number; y: number },
  deltaTime: number
): { x: number; y: number } {
  if (deltaTime === 0) return { x: 0, y: 0 };
  
  return {
    x: (currentPos.x - lastPos.x) / deltaTime,
    y: (currentPos.y - lastPos.y) / deltaTime
  };
}

/**
 * Smooth velocity using exponential smoothing
 */
export function smoothVelocity(
  currentVel: { x: number; y: number },
  lastVel: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: lastVel.x + (currentVel.x - lastVel.x) * VEL_SMOOTH,
    y: lastVel.y + (currentVel.y - lastVel.y) * VEL_SMOOTH
  };
}

// All functions are already exported individually above