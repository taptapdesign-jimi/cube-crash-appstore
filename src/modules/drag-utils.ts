// @ts-nocheck
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
  
  const texture = Texture.from(canvas);
  try {
    texture.label = `runtime:drag-utils-gradient:${w}x${h}`;
    if (texture.baseTexture) texture.baseTexture.label = texture.label;
  } catch {}
  try {
    const rt = (window as any).__ccRuntimeTextures || ((window as any).__ccRuntimeTextures = new Set());
    rt.add?.(texture);
  } catch {}
  return texture;
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
  
  // 🔥 USER REQUEST: Helper function to draw star shape for wild star tile shadow
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
  
  // 🔥 USER REQUEST: Helper function to draw beer mug shape for wild-beer tile shadow
  const drawBeerMug = (g: Graphics, x: number, y: number, width: number, height: number): void => {
    const mugWidth = width * 0.85;
    const mugHeight = height * 0.9;
    const handleWidth = width * 0.15;
    const handleHeight = height * 0.4;
    const bottomWidth = mugWidth * 0.75;
    const bodyHeight = mugHeight * 0.7;
    
    // Main mug body (trapezoid)
    g.moveTo(x - mugWidth / 2, y - mugHeight / 2);
    g.lineTo(x + mugWidth / 2, y - mugHeight / 2);
    g.lineTo(x + bottomWidth / 2, y - mugHeight / 2 + bodyHeight);
    g.lineTo(x - bottomWidth / 2, y - mugHeight / 2 + bodyHeight);
    g.closePath();
    
    // Handle (semicircle on right)
    const handleCenterX = x + mugWidth / 2 + handleWidth * 0.3;
    const handleCenterY = y - mugHeight / 2 + handleHeight / 2;
    const handleRadius = handleWidth * 0.4;
    
    g.moveTo(x + mugWidth / 2, y - mugHeight / 2 + handleHeight * 0.2);
    g.quadraticCurveTo(handleCenterX, y - mugHeight / 2 + handleHeight * 0.1, handleCenterX, handleCenterY - handleRadius);
    g.arc(handleCenterX, handleCenterY, handleRadius, -Math.PI / 2, Math.PI / 2);
    g.quadraticCurveTo(handleCenterX, y - mugHeight / 2 + handleHeight * 0.9, x + mugWidth / 2, y - mugHeight / 2 + handleHeight * 0.8);
    g.closePath();
  };
  
  // 🔥 USER REQUEST: Helper function to draw magnet shape for wild-magnet tile shadow
  const drawMagnet = (g: Graphics, x: number, y: number, width: number, height: number): void => {
    const magnetWidth = width * 0.8;
    const magnetHeight = height * 0.85;
    const barWidth = magnetWidth * 0.25;
    
    // Left bar (U shape)
    const leftBarX = x - magnetWidth / 2;
    const topY = y - magnetHeight / 2;
    const bottomY = y + magnetHeight / 2;
    
    // Top horizontal bar (left)
    g.moveTo(leftBarX, topY);
    g.lineTo(leftBarX + barWidth, topY);
    g.lineTo(leftBarX + barWidth, topY + barWidth);
    g.lineTo(leftBarX, topY + barWidth);
    g.closePath();
    
    // Left vertical bar
    g.moveTo(leftBarX, topY + barWidth);
    g.lineTo(leftBarX + barWidth, topY + barWidth);
    g.lineTo(leftBarX + barWidth, bottomY - barWidth);
    g.lineTo(leftBarX, bottomY - barWidth);
    g.closePath();
    
    // Bottom horizontal bar (left)
    g.moveTo(leftBarX, bottomY - barWidth);
    g.lineTo(leftBarX + barWidth, bottomY - barWidth);
    g.lineTo(leftBarX + barWidth, bottomY);
    g.lineTo(leftBarX, bottomY);
    g.closePath();
    
    // Right bar (U shape)
    const rightBarX = x + magnetWidth / 2 - barWidth;
    
    // Top horizontal bar (right)
    g.moveTo(rightBarX, topY);
    g.lineTo(rightBarX + barWidth, topY);
    g.lineTo(rightBarX + barWidth, topY + barWidth);
    g.lineTo(rightBarX, topY + barWidth);
    g.closePath();
    
    // Right vertical bar
    g.moveTo(rightBarX, topY + barWidth);
    g.lineTo(rightBarX + barWidth, topY + barWidth);
    g.lineTo(rightBarX + barWidth, bottomY - barWidth);
    g.lineTo(rightBarX, bottomY - barWidth);
    g.closePath();
    
    // Bottom horizontal bar (right)
    g.moveTo(rightBarX, bottomY - barWidth);
    g.lineTo(rightBarX + barWidth, bottomY - barWidth);
    g.lineTo(rightBarX + barWidth, bottomY);
    g.lineTo(rightBarX, bottomY);
    g.closePath();
  };
  
  // 🔥 USER REQUEST: Check tile type for custom shadow shapes
  const isWildStar = tile.special === 'wild';
  const isWildBeer = tile.special === 'wild-beer';
  const isWildMagnet = tile.special === 'wild-magnet';
  const isWildTnt = tile.special === 'wild-tnt';
  
  shadow.fill({ color: 0x000000, alpha: VISUAL_EFFECTS.SHADOW_ALPHA });
  
  if (isWildStar) {
    // 🔥 USER REQUEST: Draw star-shaped shadow for wild star tile
    const centerX = VISUAL_EFFECTS.SHADOW_OFFSET + tile.width / 2;
    const centerY = VISUAL_EFFECTS.SHADOW_OFFSET + tile.height / 2;
    const outerRadius = Math.min(tile.width, tile.height) * 0.45;
    const innerRadius = outerRadius * 0.4;
    drawStar(shadow, centerX, centerY, outerRadius, innerRadius, 5);
  } else if (isWildBeer) {
    // 🔥 USER REQUEST: Draw beer mug-shaped shadow for wild-beer tile
    const centerX = VISUAL_EFFECTS.SHADOW_OFFSET + tile.width / 2;
    const centerY = VISUAL_EFFECTS.SHADOW_OFFSET + tile.height / 2;
    drawBeerMug(shadow, centerX, centerY, tile.width, tile.height);
  } else if (isWildMagnet) {
    // 🔥 USER REQUEST: Draw magnet-shaped shadow for wild-magnet tile
    const centerX = VISUAL_EFFECTS.SHADOW_OFFSET + tile.width / 2;
    const centerY = VISUAL_EFFECTS.SHADOW_OFFSET + tile.height / 2;
    drawMagnet(shadow, centerX, centerY, tile.width, tile.height);
  } else if (isWildTnt) {
    // 🔥 Explosion Pack: TNT crate-shaped shadow (rounded rect)
    const w = tile.width * 0.9;
    const h = tile.height * 0.9;
    const x = VISUAL_EFFECTS.SHADOW_OFFSET + (tile.width - w) / 2;
    const y = VISUAL_EFFECTS.SHADOW_OFFSET + (tile.height - h) / 2;
    shadow.roundRect(x, y, w, h, Math.min(w, h) * 0.18);
  } else {
    // Regular rectangle shadow for regular tiles
    shadow.rect(
      VISUAL_EFFECTS.SHADOW_OFFSET,
      VISUAL_EFFECTS.SHADOW_OFFSET,
      tile.width,
      tile.height
    );
  }
  
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
