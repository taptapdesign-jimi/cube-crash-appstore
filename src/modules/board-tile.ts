// board-tile.ts
// Tile management for CubeCrash board

import { Container, Sprite, Assets, Graphics, SCALE_MODES, Texture } from 'pixi.js';
import { createTileBackground, createTileNumber, animateTileSpawn, animateTileDestroy, animateTileMerge } from './board-rendering.js';
import { addTileToMergeChain, removeTileFromMergeChain, isTileInMergeChain } from './board-merge-chain.js';
import { logger } from '../core/logger.js';
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

interface CreateTileParams {
  board: Container;
  grid: (Tile | null)[][];
  tiles: Tile[];
  c: number;
  r: number;
  val?: number;
  locked?: boolean;
}

interface Board extends Container {
  addChild: (child: Container) => Container;
  removeChild: (child: Container) => Container;
}

// Global state
let mergeChainUpdateCallback: ((value: number, count: number) => void) | null = null;
let mergeChainActive = false;
let mergeChainValue = 0;
let mergeChainCount = 0;

/**
 * Create tile
 */
export function createTile({ board, grid, tiles, c, r, val = 0, locked = false }: CreateTileParams): Tile {
  logger.info(`🎯 Creating tile at ${c},${r} with value ${val}`);
  
  // Create tile container
  const tile = new Container() as Tile;
  tile.gridX = c;
  tile.gridY = r;
  tile.value = val;
  tile.locked = locked;
  tile.stackDepth = 0;
  
  // Create rotation group
  const rotG = new Container();
  tile.rotG = rotG;
  tile.addChild(rotG);
  
  // Create base sprite
  const base = new Sprite(Texture.from(ASSET_TILE));
  base.width = TILE;
  base.height = TILE;
  tile.base = base;
  rotG.addChild(base);
  
  // Create stack group
  const stackG = new Container();
  tile.stackG = stackG;
  tile.addChild(stackG);
  
  // Set initial value
  if (val > 0) {
    setValue(tile, val);
  }
  
  // Add to board and grid
  board.addChild(tile);
  grid[r][c] = tile;
  tiles.push(tile);
  
  logger.info(`✅ Tile created successfully`);
  return tile;
}

/**
 * Set tile value
 */
export function setValue(t: Tile, v: number, addStack: number = 0): void {
  if (!t) return;
  
  logger.info(`🎯 Setting tile value to ${v}`);
  
  t.value = v;
  t.stackDepth = (t.stackDepth || 0) + addStack;
  
  // Update visual representation
  updateTileVisuals(t);
  
  logger.info(`✅ Tile value set to ${v}`);
}

/**
 * Update tile visuals
 */
function updateTileVisuals(tile: Tile): void {
  if (!tile || !tile.rotG) return;
  
  const value = tile.value || 0;
  const stackDepth = tile.stackDepth || 0;
  
  // Clear existing visuals
  if (tile.pips) {
    tile.pips.destroy();
    tile.pips = undefined;
  }
  
  if (tile.overlay) {
    tile.overlay.destroy();
    tile.overlay = undefined;
  }
  
  // Create pips for value
  if (value > 0) {
    createPips(tile, value);
  }
  
  // Create stack visualization
  if (stackDepth > 0) {
    createStackVisualization(tile, stackDepth);
  }
  
  // Update shadow
  if (tile.refreshShadow) {
    tile.refreshShadow();
  }
}

/**
 * Create pips for tile value
 */
function createPips(tile: Tile, value: number): void {
  if (!tile.rotG) return;
  
  const pips = new Graphics();
  tile.pips = pips;
  tile.rotG.addChild(pips);
  
  // Draw pips based on value
  const pipSize = TILE * PIPS_INNER_FACTOR;
  const pipRadius = pipSize * PIP_RADIUS;
  const pipSpacing = pipSize * 0.3;
  
  pips.fill({ color: PIP_COLOR, alpha: PIP_ALPHA });
  
  switch (value) {
    case 1:
      // Center pip
      pips.drawCircle(0, 0, pipRadius);
      break;
      
    case 2:
      // Two pips diagonal
      pips.drawCircle(-pipSpacing, -pipSpacing, pipRadius);
      pips.drawCircle(pipSpacing, pipSpacing, pipRadius);
      break;
      
    case 3:
      // Three pips diagonal
      pips.drawCircle(-pipSpacing, -pipSpacing, pipRadius);
      pips.drawCircle(0, 0, pipRadius);
      pips.drawCircle(pipSpacing, pipSpacing, pipRadius);
      break;
      
    case 4:
      // Four pips corners
      pips.drawCircle(-pipSpacing, -pipSpacing, pipRadius);
      pips.drawCircle(pipSpacing, -pipSpacing, pipRadius);
      pips.drawCircle(-pipSpacing, pipSpacing, pipRadius);
      pips.drawCircle(pipSpacing, pipSpacing, pipRadius);
      break;
      
    case 5:
      // Five pips (4 corners + center)
      pips.drawCircle(-pipSpacing, -pipSpacing, pipRadius);
      pips.drawCircle(pipSpacing, -pipSpacing, pipRadius);
      pips.drawCircle(0, 0, pipRadius);
      pips.drawCircle(-pipSpacing, pipSpacing, pipRadius);
      pips.drawCircle(pipSpacing, pipSpacing, pipRadius);
      break;
      
    case 6:
      // Six pips (2 rows of 3)
      pips.drawCircle(-pipSpacing, -pipSpacing, pipRadius);
      pips.drawCircle(0, -pipSpacing, pipRadius);
      pips.drawCircle(pipSpacing, -pipSpacing, pipRadius);
      pips.drawCircle(-pipSpacing, pipSpacing, pipRadius);
      pips.drawCircle(0, pipSpacing, pipRadius);
      pips.drawCircle(pipSpacing, pipSpacing, pipRadius);
      break;
  }
  
}

/**
 * Create stack visualization
 */
function createStackVisualization(tile: Tile, stackDepth: number): void {
  if (!tile.stackG) return;
  
  // Clear existing stack
  tile.stackG.removeChildren();
  
  // Create stack layers
  for (let i = 0; i < stackDepth; i++) {
    const stackLayer = new Graphics();
    stackLayer.fill({ color: 0x888888, alpha: 0.3 })
      .rect(-TILE/2 + i*2, -TILE/2 + i*2, TILE - i*4, TILE - i*4);
    stackLayer.zIndex = i;
    tile.stackG.addChild(stackLayer);
  }
}

/**
 * Draw stack
 */
export function drawStack(tile: Tile): void {
  if (!tile || !tile.stackG) return;
  
  const stackDepth = tile.stackDepth || 0;
  
  // Clear existing stack
  tile.stackG.removeChildren();
  
  // Draw stack layers
  for (let i = 0; i < stackDepth; i++) {
    const stackLayer = new Graphics();
    stackLayer.fill({ color: 0x666666, alpha: 0.5 })
      .rect(-TILE/2 + i*2, -TILE/2 + i*2, TILE - i*4, TILE - i*4);
    stackLayer.zIndex = i;
    tile.stackG.addChild(stackLayer);
  }
}

/**
 * Set merge chain update callback
 */
export function setMergeChainUpdateCallback(cb: (value: number, count: number) => void): void {
  mergeChainUpdateCallback = cb;
}

/**
 * Start merge chain
 */
export function startMergeChain(): void {
  mergeChainActive = true;
  mergeChainValue = 0;
  mergeChainCount = 0;
}

/**
 * Update merge chain
 */
export function updateMergeChain(tileValue: number): void {
  if (!mergeChainActive) return;
  
  mergeChainValue += tileValue;
  mergeChainCount++;
  
  if (mergeChainUpdateCallback) {
    mergeChainUpdateCallback(mergeChainValue, mergeChainCount);
  }
}

/**
 * Finalize merge chain
 */
export function finalizeMergeChain(tileValue: number): number {
  if (!mergeChainActive) return tileValue;
  
  const finalValue = mergeChainValue + tileValue;
  mergeChainActive = false;
  
  return finalValue;
}

/**
 * Check if any merge is possible
 */
export function anyMergePossible(allTiles: Container[]): boolean {
  logger.info('🔍 Checking if any merge is possible');
  
  for (let i = 0; i < allTiles.length; i++) {
    const tile1 = allTiles[i] as Tile;
    if (!tile1 || tile1.locked || !tile1.value) continue;
    
    for (let j = i + 1; j < allTiles.length; j++) {
      const tile2 = allTiles[j] as Tile;
      if (!tile2 || tile2.locked || !tile2.value) continue;
      
      const sum = (tile1.value || 0) + (tile2.value || 0);
      if (sum <= 6) {
        logger.info(`✅ Found possible merge: ${tile1.value} + ${tile2.value} = ${sum}`);
        return true;
      }
    }
  }
  
  logger.info('❌ No possible merges found');
  return false;
}

// All functions are already exported individually above
