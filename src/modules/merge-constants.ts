// merge-constants.ts
// Constants for merge system


// Animation constants
export const MERGE_ANIMATION_DURATION = 0.45;
export const SCORE_ANIMATION_DURATION = 0.45;
export const COMBO_ANIMATION_DURATION = 0.3;
export const BOARD_SHAKE_DURATION = 0.5;
export const TILE_BOUNCE_DURATION = 0.2;
export const WILD_MERGE_DURATION = 0.6;

// Visual effect constants
export const BOARD_ZOOM_FACTOR = 0.92;
export const BOARD_ZOOM_DURATION = 0.15;
export const BOARD_ZOOM_RETURN_DURATION = 0.25;
export const TILE_WOBBLE_STRENGTH = 0.1;
export const TILE_WOBBLE_DURATION = 0.15;

// Score constants
export const SCORE_MULTIPLIER = 10;
export const COMBO_MULTIPLIER = 1;
export const WILD_BONUS_MULTIPLIER = 2;

// Game over constants
export const GAME_OVER_DELAY = 1000;
export const STARS_MODAL_DELAY = 500;
export const BOARD_FAIL_DELAY = 300;

// Merge validation constants
export const MIN_MERGE_VALUE = 1;
export const MAX_MERGE_VALUE = 1000;
export const WILD_MERGE_THRESHOLD = 5;

// Animation easing
export const EASING = {
  EASE_OUT: 'power2.out',
  EASE_IN: 'power2.in',
  EASE_IN_OUT: 'power2.inOut',
  EASE_BACK: 'back.out(1.7)',
  EASE_ELASTIC: 'elastic.out(1, 0.3)',
  EASE_BOUNCE: 'bounce.out'
};

// Visual effects
export const VISUAL_EFFECTS = {
  GLASS_CRACK_CHANCE: 0.3,
  WOOD_SHARDS_CHANCE: 0.2,
  INNER_FLASH_CHANCE: 0.4,
  SMOKE_BUBBLES_CHANCE: 0.3,
  MAGIC_SPARKLES_CHANCE: 0.5
};

// Performance limits
export const PERFORMANCE = {
  MAX_CONCURRENT_ANIMATIONS: 20,
  MAX_MERGE_QUEUE_SIZE: 10,
  ANIMATION_FRAME_RATE: 60,
  DEBOUNCE_DELAY: 16
};

// Merge types
export const MERGE_TYPES = {
  NORMAL: 'normal',
  WILD: 'wild',
  SPECIAL: 'special',
  CHAIN: 'chain'
};

// Game states
export const GAME_STATES = {
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  MERGING: 'merging',
  ANIMATING: 'animating'
};

// All functions are already exported individually above
