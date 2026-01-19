// Tile type definitions (ultra-permissive)

import type { Container } from 'pixi.js';

// Make all tile types compatible with each other and extend Container
export interface Tile extends Container {
  [key: string]: any;
  x?: number;
  y?: number;
  parent?: any;
  destroyed?: boolean;
}

export type WildishTile = Tile;
export type LetterTile = Tile;

// Global tile types
declare global {
  interface Tile extends Container {
    [key: string]: any;
    x?: number;
    y?: number;
    parent?: any;
    destroyed?: boolean;
  }
  type WildishTile = Tile;
  type LetterTile = Tile;
}

