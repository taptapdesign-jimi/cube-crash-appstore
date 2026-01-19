// Tile type definitions (ultra-permissive)

// Make all tile types compatible with each other
export type Tile = any;
export type WildishTile = any;
export type LetterTile = any;

// Global tile types
declare global {
  type Tile = any;
  type WildishTile = any;
  type LetterTile = any;
}

