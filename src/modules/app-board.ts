// app-board.ts
// Board management and tile system for CubeCrash

import { Container, Graphics, Text, Rectangle, Texture, Sprite, SCALE_MODES } from 'pixi.js';
import { Assets } from 'pixi.js';
import { gsap } from 'gsap';

import {
  COLS, ROWS, TILE, GAP, HUD_H,
  ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4, ASSET_WILD
} from './constants.js';
import { STATE } from './app-state.js';
import { getBoardService, getEventBus, EVENTS } from '../core/service-registry.js';
import { logger } from '../core/logger.js';

// Type definitions for app-board.ts
interface Tile extends Container {
  value: number;
  locked: boolean;
  alpha: number;
  special?: string;
  base?: Sprite;
  num?: Text;
  pips?: Graphics;
  rotG?: Container;
  hover?: Graphics;
  _spawned?: boolean;
  eventMode?: 'none' | 'static' | 'passive';
  cursor?: string;
  isWild?: boolean;
  isWildFace?: boolean;
  stackDepth?: number;
  gridX?: number;
  gridY?: number;
  occluder?: Graphics;
  ghostFrame?: Graphics;
  alpha?: number;
  visible?: boolean;
  _wildMergeTarget?: number;
  refreshShadow?: () => void;
}

interface Board extends Container {
  sortableChildren: boolean;
  zIndex: number;
  alpha: number;
  _wildZoomTl?: any;
}

// Global state variables
let app: any = null;
let stage: Container | null = null;
let board: Board | null = null;
let boardBG: Graphics | null = null;
let hud: Container | null = null;
let grid: (Tile | null)[][] = [];
let tiles: Tile[] = [];

// Ghost placeholder system
let ghostPlaceholders: Graphics[][] = [];

/**
 * Initialize background layer with ghost placeholders
 */
export function initializeBackgroundLayer(): void {
  if (!board) {
    logger.warn('⚠️ Cannot initialize background layer - board not initialized');
    return;
  }
  
  logger.info('👻 Initializing ghost placeholders');
  
  // Clear existing ghost placeholders
  ghostPlaceholders = [];
  
  // Create ghost placeholders for each cell
  for (let r = 0; r < ROWS; r++) {
    ghostPlaceholders[r] = [];
    for (let c = 0; c < COLS; c++) {
      const ghost = new Graphics();
      ghost.rect(0, 0, TILE, TILE);
      ghost.fill({ color: 0x000000, alpha: 0.1 });
      ghost.stroke({ color: 0x000000, alpha: 0.2, width: 1 });
      
      const pos = cellXY(c, r);
      ghost.x = pos.x;
      ghost.y = pos.y;
      ghost.alpha = 0;
      ghost.visible = false;
      
      board.addChild(ghost);
      ghostPlaceholders[r][c] = ghost;
    }
  }
  
  logger.info('✅ Ghost placeholders initialized');
}

/**
 * Set ghost visibility
 */
export function setGhostVisibility(c: number, r: number, visible: boolean): void {
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
    const ghost = ghostPlaceholders[r][c];
    if (ghost) {
      ghost.visible = visible;
      ghost.alpha = visible ? 0.3 : 0;
    }
  }
}

/**
 * Update ghost visibility based on grid state
 */
export function updateGhostVisibility(): void {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = grid[r][c];
      const ghost = ghostPlaceholders[r][c];
      
      if (ghost) {
        if (tile) {
          // Hide ghost if tile exists
          ghost.visible = false;
          ghost.alpha = 0;
        } else {
          // Show ghost if cell is empty
          ghost.visible = true;
          ghost.alpha = 0.3;
        }
      }
    }
  }
}

/**
 * Draw board background
 */
export function drawBoardBG(mode = 'active+empty'): void {
  if (!boardBG) {
    logger.warn('⚠️ Cannot draw board background - boardBG not initialized');
    return;
  }
  
  boardBG.clear();
  
  // Draw board background
  boardBG.rect(0, 0, COLS * TILE + (COLS - 1) * GAP, ROWS * TILE + (ROWS - 1) * GAP);
  boardBG.fill({ color: 0xffffff, alpha: 0.9 });
  boardBG.stroke({ color: 0x000000, alpha: 0.1, width: 1 });
  
  // Position background
  if (board) {
    boardBG.x = board.x;
    boardBG.y = board.y;
  }
}

/**
 * Pulse board zoom effect
 */
export function pulseBoardZoom(factor = 0.92, opts: any = {}): any {
  if (!board) return null;
  
  const duration = opts.duration || 0.15;
  const ease = opts.ease || 'power2.out';
  
  return gsap.to(board.scale, {
    x: factor,
    y: factor,
    duration,
    ease,
    yoyo: true,
    repeat: 1,
    onComplete: () => {
      board.scale.set(1);
    }
  });
}

/**
 * Rebuild board - recreate all tiles
 */
export function rebuildBoard(): void {
  if (!board) {
    logger.warn('⚠️ Cannot rebuild board - board not initialized');
    return;
  }
  
  logger.info('🔨 Rebuilding board');
  
  // Clear existing tiles
  tiles.forEach(tile => {
    if (tile.parent) {
      tile.parent.removeChild(tile);
    }
  });
  tiles = [];
  
  // Clear grid
  grid = createEmptyGrid();
  
  // Update ghost visibility
  updateGhostVisibility();
  
  logger.info('✅ Board rebuilt');
}

/**
 * Tint locked tiles
 */
export function tintLocked(t: Tile): void {
  if (t.base) {
    t.base.tint = 0x666666;
  }
}

/**
 * Start level
 */
export function startLevel(n: number): void {
  logger.info(`🎯 Starting level ${n}`);
  
  // Reset game state
  grid = createEmptyGrid();
  tiles = [];
  moves = MOVES_MAX;
  boardNumber = n;
  
  // Update ghost visibility
  updateGhostVisibility();
  
  logger.info(`✅ Level ${n} started`);
}

/**
 * Get cell position
 */
function cellXY(c: number, r: number): { x: number; y: number } {
  return {
    x: c * (TILE + GAP),
    y: r * (TILE + GAP)
  };
}

/**
 * Create empty grid
 */
function createEmptyGrid(): (Tile | null)[][] {
  const newGrid: (Tile | null)[][] = [];
  for (let r = 0; r < ROWS; r++) {
    newGrid[r] = [];
    for (let c = 0; c < COLS; c++) {
      newGrid[r][c] = null;
    }
  }
  return newGrid;
}

/**
 * Sweet pop-in animation for tiles
 */
export function sweetPopIn(tile: Tile, delay = 0): void {
  if (!tile) return;
  
  tile.scale.set(0);
  tile.alpha = 0;
  
  gsap.to(tile.scale, {
    x: 1,
    y: 1,
    duration: 0.3,
    delay,
    ease: 'back.out(1.7)'
  });
  
  gsap.to(tile, {
    alpha: 1,
    duration: 0.2,
    delay
  });
}

// All functions are already exported individually above