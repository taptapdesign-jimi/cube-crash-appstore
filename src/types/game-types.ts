// @ts-nocheck

// Centralized TypeScript types for CubeCrash game
// Used to replace "as any" assertions throughout the codebase

import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { Timeline } from 'gsap';

/**
 * Tile interface - represents a game tile on the board
 */
export interface Tile extends Container {
  // Grid position
  gridX?: number;
  gridY?: number;
  
  // Tile properties
  value?: number;
  stackDepth?: number;
  locked?: boolean;
  special?: string;
  
  // Wild properties
  isWild?: boolean;
  isWildFace?: boolean;
  isWildBeer?: boolean;
  isWildMagnet?: boolean;
  isWildStar?: boolean;
  _wildMergeTarget?: number;
  _wildIdleTl?: Timeline;
  _wildShimmer?: Container;
  _wildShimmerSprite?: Sprite;
  _wildMask?: Graphics;
  _wildStarSystem?: any;
  
  // Visual elements
  shadow?: Graphics;
  rotG?: Container;
  base?: Sprite;
  overlay?: Sprite;
  stackG?: Container | null;
  pips?: Graphics;
  hover?: Graphics;
  bg?: Graphics;
  border?: Graphics;
  num?: Text;
  stack?: Graphics;
  
  // Animation properties
  targetX?: number;
  targetY?: number;
  _zBeforeDrag?: number;
  
  // Merge properties
  _noTilesPulled?: boolean;
  _wasWildMagnetMerge6?: boolean;
  
  // Methods
  refreshShadow?: () => void;
  getBounds?: () => { x: number; y: number; width: number; height: number };
  toGlobal?: (point: { x: number; y: number }) => { x: number; y: number };
  destroy?: (opts?: { children?: boolean; texture?: boolean; baseTexture?: boolean }) => void;
}

/**
 * Board interface - represents the game board container
 */
export interface Board extends Container {
  // Board properties
  sortableChildren?: boolean;
  eventMode?: string;
  zIndex?: number;
}

/**
 * Grid interface - represents the 2D grid of tiles
 */
export interface Grid {
  [row: number]: (Tile | null)[];
}

/**
 * HUD interface - represents the HUD container
 */
export interface HUD extends Container {
  // HUD properties
  eventMode?: string;
  zIndex?: number;
}

/**
 * Stage interface - represents the PIXI stage
 */
export interface Stage extends Container {
  // Stage properties
  sortableChildren?: boolean;
  eventMode?: string;
  hitArea?: { x: number; y: number; width: number; height: number };
}

/**
 * Drag interface - represents the drag system
 */
export interface Drag {
  bindToTile?: (tile: Tile) => void;
  start?: (tile: Tile) => void;
  stop?: () => void;
  isDragging?: () => boolean;
}

/**
 * MakeBoard interface - represents board creation functions
 */
export interface MakeBoard {
  anyMergePossible?: (tiles: Tile[]) => boolean;
  setValue?: (tile: Tile, value: number, stackDepth: number) => void;
  createTile?: (params: CreateTileParams) => Tile;
}

/**
 * CreateTileParams interface - parameters for creating a tile
 */
export interface CreateTileParams {
  board: Board;
  grid: Grid;
  tiles: Tile[];
  x: number;
  y: number;
  value: number;
  stackDepth?: number;
  locked?: boolean;
  special?: string;
}


