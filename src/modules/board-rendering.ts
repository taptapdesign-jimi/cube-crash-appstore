// board-rendering.ts
// Rendering functions for board system

import { Container, Graphics, Text, Texture, Sprite } from 'pixi.js';
import { gsap } from 'gsap';
import { TILE, GAP } from './constants.js';
import { BOARD_BG_COLOR, TILE_BG_COLOR, TILE_BORDER_COLOR, TILE_BORDER_WIDTH, PIPS_INNER_FACTOR, PIP_COLOR, PIP_ALPHA, PIP_RADIUS, PIP_SQUARE, STACK_OFFSET, STACK_ALPHA, STACK_COLOR, ANIMATION, EASING } from './board-constants.js';
import { logger } from '../core/logger.js';

// Type definitions
interface Tile extends Container {
  value: number;
  locked: boolean;
  special?: string;
  isWild?: boolean;
  isWildFace?: boolean;
  gridX?: number;
  gridY?: number;
  _wildMergeTarget?: number;
  _wildIdleTl?: gsap.core.Timeline;
  _wildShimmer?: Container;
  _wildShimmerSprite?: Sprite;
  _wildMask?: Graphics;
  refreshShadow?: () => void;
  getBounds?: () => { x: number; y: number; width: number; height: number };
  toGlobal?: (point: { x: number; y: number }) => { x: number; y: number };
  num?: Text;
  stack?: Graphics;
  pips?: Graphics;
  bg?: Graphics;
  border?: Graphics;
}

interface CreateTileParams {
  board: Container;
  grid: (Tile | null)[][];
  tiles: Tile[];
  c: number;
  r: number;
  val?: number;
  locked?: boolean;
}

// Utility functions
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/**
 * Pick numbers skin texture
 */
export function pickNumbersSkin(): Texture {
  // This would normally load different textures based on game state
  // For now, return a default texture
  return Texture.EMPTY;
}

/**
 * Draw stack on tile
 */
export function drawStack(tile: Tile): void {
  if (!tile || tile.locked) return;
  
  const value = tile.value || 0;
  if (value <= 1) return;
  
  // Remove existing stack
  if (tile.stack && tile.stack.parent) {
    tile.stack.parent.removeChild(tile.stack);
  }
  
  // Create new stack
  const stack = new Graphics();
  stack.stroke({ width: 1, color: STACK_COLOR, alpha: STACK_ALPHA });
  
  // Draw stack based on value
  const stackHeight = Math.min(value - 1, 5) * STACK_OFFSET;
  const stackWidth = TILE * 0.8;
  const stackX = (TILE - stackWidth) / 2;
  const stackY = TILE - stackHeight - 10;
  
  // Draw stack rectangles
  for (let i = 0; i < Math.min(value - 1, 5); i++) {
    const y = stackY + (i * STACK_OFFSET);
    stack.drawRect(stackX, y, stackWidth, 2);
  }
  
  // Add to tile
  tile.addChild(stack);
  tile.stack = stack;
  
  logger.info(`📚 Drew stack for tile value ${value}`);
}

/**
 * Draw pips on tile
 */
export function drawPips(t: Tile): void {
  if (!t || t.locked) return;
  
  const value = t.value || 0;
  if (value <= 1) return;
  
  // Remove existing pips
  if (t.pips && t.pips.parent) {
    t.pips.parent.removeChild(t.pips);
  }
  
  // Create new pips
  const pips = new Graphics();
  pips.fill({ color: PIP_COLOR, alpha: PIP_ALPHA });
  
  const centerX = TILE / 2;
  const centerY = TILE / 2;
  const radius = TILE * PIP_RADIUS;
  const innerRadius = radius * PIPS_INNER_FACTOR;
  
  // Draw pips based on value
  switch (value) {
    case 2:
      drawPip(pips, centerX - innerRadius, centerY - innerRadius, radius);
      drawPip(pips, centerX + innerRadius, centerY + innerRadius, radius);
      break;
    case 3:
      drawPip(pips, centerX - innerRadius, centerY - innerRadius, radius);
      drawPip(pips, centerX, centerY, radius);
      drawPip(pips, centerX + innerRadius, centerY + innerRadius, radius);
      break;
    case 4:
      drawPip(pips, centerX - innerRadius, centerY - innerRadius, radius);
      drawPip(pips, centerX + innerRadius, centerY - innerRadius, radius);
      drawPip(pips, centerX - innerRadius, centerY + innerRadius, radius);
      drawPip(pips, centerX + innerRadius, centerY + innerRadius, radius);
      break;
    case 5:
      drawPip(pips, centerX - innerRadius, centerY - innerRadius, radius);
      drawPip(pips, centerX + innerRadius, centerY - innerRadius, radius);
      drawPip(pips, centerX, centerY, radius);
      drawPip(pips, centerX - innerRadius, centerY + innerRadius, radius);
      drawPip(pips, centerX + innerRadius, centerY + innerRadius, radius);
      break;
    case 6:
      drawPip(pips, centerX - innerRadius, centerY - innerRadius, radius);
      drawPip(pips, centerX, centerY - innerRadius, radius);
      drawPip(pips, centerX + innerRadius, centerY - innerRadius, radius);
      drawPip(pips, centerX - innerRadius, centerY + innerRadius, radius);
      drawPip(pips, centerX, centerY + innerRadius, radius);
      drawPip(pips, centerX + innerRadius, centerY + innerRadius, radius);
      break;
  }
  
  // Add to tile
  t.addChild(pips);
  t.pips = pips;
  
  logger.info(`🎲 Drew pips for tile value ${value}`);
}

/**
 * Draw a single pip
 */
function drawPip(graphics: Graphics, x: number, y: number, radius: number): void {
  const size = radius * PIP_SQUARE;
  graphics.drawRect(x - size/2, y - size/2, size, size);
}

/**
 * Set tile value and update visuals
 */
export function setValue(t: Tile, v: number, addStack: number = 0): void {
  if (!t) return;
  
  const oldValue = t.value || 0;
  t.value = v;
  
  // Update number text
  if (t.num) {
    t.num.text = v.toString();
  }
  
  // Update pips
  drawPips(t);
  
  // Update stack
  if (addStack > 0) {
    drawStack(t);
  }
  
  // Animate value change
  if (v > oldValue) {
    animateValueIncrease(t, oldValue, v);
  }
  
  logger.info(`🔢 Set tile value to ${v} (was ${oldValue})`);
}

/**
 * Animate value increase
 */
function animateValueIncrease(tile: Tile, oldValue: number, newValue: number): void {
  if (!tile) return;
  
  // Scale animation
  gsap.fromTo(tile, 
    { scaleX: 1, scaleY: 1 },
    { 
      scaleX: 1.2,
      scaleY: 1.2,
      duration: ANIMATION.PIP_ANIMATION_DURATION / 2,
      ease: EASING.PIP_ANIMATION,
      yoyo: true,
      repeat: 1
    }
  );
  
  // Color flash animation
  if (tile.bg) {
    gsap.fromTo(tile.bg, 
      { tint: 0xFFFFFF },
      { 
        tint: 0xFFFF00,
        duration: ANIMATION.PIP_ANIMATION_DURATION / 2,
        ease: EASING.PIP_ANIMATION,
        yoyo: true,
        repeat: 1
      }
    );
  }
}

/**
 * Create tile background
 */
export function createTileBackground(tile: Tile): void {
  if (!tile) return;
  
  // Remove existing background
  if (tile.bg && tile.bg.parent) {
    tile.bg.parent.removeChild(tile.bg);
  }
  
  // Create new background
  const bg = new Graphics();
  bg.fill({ color: TILE_BG_COLOR })
    .rect(0, 0, TILE, TILE);
  
  // Add border
  const border = new Graphics();
  border.stroke({ width: TILE_BORDER_WIDTH, color: TILE_BORDER_COLOR })
    .rect(0, 0, TILE, TILE);
  
  // Add to tile
  tile.addChild(bg);
  tile.addChild(border);
  tile.bg = bg;
  tile.border = border;
  
  logger.info('🎨 Created tile background');
}

/**
 * Create tile number text
 */
export function createTileNumber(tile: Tile, value: number): void {
  if (!tile) return;
  
  // Remove existing number
  if (tile.num && tile.num.parent) {
    tile.num.parent.removeChild(tile.num);
  }
  
  // Create new number
  const num = new Text({
    text: value.toString(),
    style: {
      fontFamily: 'Arial',
      fontSize: TILE * 0.4,
      fill: 0x333333,
      align: 'center'
    }
  });
  
  // Center the text
  num.x = (TILE - num.width) / 2;
  num.y = (TILE - num.height) / 2;
  
  // Add to tile
  tile.addChild(num);
  tile.num = num;
  
  logger.info(`🔢 Created tile number: ${value}`);
}

/**
 * Animate tile spawn
 */
export function animateTileSpawn(tile: Tile): void {
  if (!tile) return;
  
  // Start from small and invisible
  tile.scaleX = 0;
  tile.scaleY = 0;
  tile.alpha = 0;
  
  // Animate to full size
  gsap.to(tile, {
    scaleX: 1,
    scaleY: 1,
    alpha: 1,
    duration: ANIMATION.TILE_SPAWN_DURATION,
    ease: EASING.TILE_SPAWN
  });
  
  logger.info('✨ Animated tile spawn');
}

/**
 * Animate tile destroy
 */
export function animateTileDestroy(tile: Tile): void {
  if (!tile) return;
  
  gsap.to(tile, {
    scaleX: 0,
    scaleY: 0,
    alpha: 0,
    duration: ANIMATION.TILE_DESTROY_DURATION,
    ease: EASING.TILE_DESTROY,
    onComplete: () => {
      if (tile.parent) {
        tile.parent.removeChild(tile);
      }
    }
  });
  
  logger.info('💥 Animated tile destroy');
}

/**
 * Animate tile merge
 */
export function animateTileMerge(tile: Tile): void {
  if (!tile) return;
  
  gsap.fromTo(tile, 
    { scaleX: 1, scaleY: 1 },
    { 
      scaleX: 1.2,
      scaleY: 1.2,
      duration: ANIMATION.TILE_MERGE_DURATION / 2,
      ease: EASING.TILE_MERGE,
      yoyo: true,
      repeat: 1
    }
  );
  
  logger.info('🔄 Animated tile merge');
}

// All functions are already exported individually above
