// Centralized TypeScript types for CubeCrash game
// Used to replace "as any" assertions throughout the codebase

import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { Timeline } from 'gsap';

/**
 * Tile interface - represents a game tile on the board
 */
export type Tile = Container & {
  [key: string]: any;
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
  isWildJuice?: boolean;
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
};

/**
 * Board interface - represents the game board container
 */
export type Board = Container & {
  [key: string]: any;
  // Board properties
  sortableChildren?: boolean;
  eventMode?: any;
  zIndex?: number;
};

/**
 * Grid interface - represents the 2D grid of tiles
 */
export type Grid = Array<Array<Tile | null>>;

/**
 * HUD interface - represents the HUD container
 */
export type HUD = Container & {
  [key: string]: any;
  // HUD properties
  eventMode?: any;
  zIndex?: number;
};

/**
 * Stage interface - represents the PIXI stage
 */
export type Stage = Container & {
  [key: string]: any;
  // Stage properties
  sortableChildren?: boolean;
  eventMode?: any;
  hitArea?: any;
};

/**
 * Drag interface - represents the drag system
 */
export type Drag = {
  [key: string]: any;
  bindToTile?: (tile: Tile | null) => void;
  start?: (tile: Tile) => void;
  stop?: () => void;
  isDragging?: () => boolean;
  t?: Tile | null;
};

/**
 * MakeBoard interface - represents board creation functions
 */
export interface MakeBoard {
  anyMergePossible?: (tiles: any[]) => boolean;
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
