// board-constants.ts
// Constants for board system


// Board visual constants
export const BOARD_BG_COLOR = 0xF5F5F5;
export const TILE_BG_COLOR = 0xFFFFFF;
export const TILE_BORDER_COLOR = 0xCCCCCC;
export const TILE_BORDER_WIDTH = 2;

// Pip constants
export const PIPS_INNER_FACTOR = 0.6;
export const PIP_COLOR = 0x333333;
export const PIP_ALPHA = 0.8;
export const PIP_RADIUS = 0.15;
export const PIP_SQUARE = 0.1;

// Stack constants
export const STACK_OFFSET = 2;
export const STACK_ALPHA = 0.3;
export const STACK_COLOR = 0x666666;

// Animation constants
export const ANIMATION = {
  TILE_SPAWN_DURATION: 0.3,
  TILE_DESTROY_DURATION: 0.2,
  TILE_MERGE_DURATION: 0.4,
  STACK_ANIMATION_DURATION: 0.2,
  PIP_ANIMATION_DURATION: 0.15
} as const;

// Easing constants
export const EASING = {
  TILE_SPAWN: 'back.out(1.7)',
  TILE_DESTROY: 'power2.in',
  TILE_MERGE: 'power2.out',
  STACK_ANIMATION: 'power2.out',
  PIP_ANIMATION: 'power2.out'
} as const;

// Tile states
export const TILE_STATE = {
  IDLE: 'idle',
  SPAWNING: 'spawning',
  MERGING: 'merging',
  DESTROYING: 'destroying',
  LOCKED: 'locked'
} as const;

// Merge chain constants
export const MERGE_CHAIN = {
  MIN_VALUE: 1,
  MAX_VALUE: 6,
  BONUS_MULTIPLIER: 1.5,
  CHAIN_BONUS_THRESHOLD: 3
} as const;

// Board layout constants
export const LAYOUT = {
  TILE_SPACING: 4,
  BOARD_PADDING: 20,
  SHADOW_OFFSET: 3,
  SHADOW_BLUR: 5,
  SHADOW_ALPHA: 0.3
} as const;

// Visual effects constants
export const EFFECTS = {
  HOVER_SCALE: 1.05,
  HOVER_ALPHA: 0.8,
  SELECTED_SCALE: 1.1,
  SELECTED_ALPHA: 0.9,
  MERGE_SCALE: 1.2,
  MERGE_ALPHA: 1.0
} as const;

// Performance constants
export const PERFORMANCE = {
  MAX_TILES: 100,
  MAX_STACK_DEPTH: 5,
  RENDER_BATCH_SIZE: 10,
  ANIMATION_FRAME_RATE: 60
} as const;
