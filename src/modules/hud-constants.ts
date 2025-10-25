// hud-constants.ts
// Constants for HUD system


// HUD dimensions
export const HUD_HEIGHT = 80;
export const HUD_PADDING = 16;
export const HUD_MARGIN = 8;
export const HUD_BORDER_RADIUS = 12;

// Text styling
export const TEXT_STYLES = {
  SCORE: {
    fontSize: 24,
    fontWeight: 'bold',
    fill: 0xFFFFFF,
    stroke: 0x000000,
    strokeThickness: 2
  },
  BOARD: {
    fontSize: 20,
    fontWeight: 'bold',
    fill: 0xFFFFFF,
    stroke: 0x000000,
    strokeThickness: 2
  },
  COMBO: {
    fontSize: 18,
    fontWeight: 'bold',
    fill: 0xFFD700,
    stroke: 0x000000,
    strokeThickness: 2
  },
  MOVES: {
    fontSize: 16,
    fontWeight: 'normal',
    fill: 0xCCCCCC,
    stroke: 0x000000,
    strokeThickness: 1
  }
};

// Animation constants
export const ANIMATION_DURATION = {
  DROP: 0.8,
  BOUNCE: 0.2,
  FADE: 0.3,
  SCALE: 0.15,
  SLIDE: 0.4
};

// Animation easing
export const EASING = {
  EASE_OUT: 'power2.out',
  EASE_IN: 'power2.in',
  EASE_IN_OUT: 'power2.inOut',
  EASE_BACK: 'back.out(1.7)',
  EASE_ELASTIC: 'elastic.out(1, 0.3)',
  EASE_BOUNCE: 'bounce.out'
};

// Bounce animation options
export const BOUNCE_OPTIONS = {
  DEFAULT: {
    peak: 1.2,
    back: 1.05,
    up: 0.08,
    down: 0.2
  },
  COMBO: {
    peak: 1.3,
    back: 1.1,
    up: 0.1,
    down: 0.25
  },
  SCORE: {
    peak: 1.15,
    back: 1.02,
    up: 0.06,
    down: 0.18
  }
};

// HUD positions
export const HUD_POSITIONS = {
  TOP_LEFT: { x: HUD_PADDING, y: HUD_PADDING },
  TOP_RIGHT: { x: -HUD_PADDING, y: HUD_PADDING },
  BOTTOM_LEFT: { x: HUD_PADDING, y: -HUD_PADDING },
  BOTTOM_RIGHT: { x: -HUD_PADDING, y: -HUD_PADDING },
  CENTER: { x: 0, y: 0 }
};

// HUD colors
export const HUD_COLORS = {
  BACKGROUND: 0x1a1a1a,
  BORDER: 0x333333,
  SCORE: 0xFFFFFF,
  BOARD: 0xFFFFFF,
  COMBO: 0xFFD700,
  MOVES: 0xCCCCCC,
  HIGHLIGHT: 0x00FF00,
  WARNING: 0xFF6B6B,
  SUCCESS: 0x4ECDC4
};

// HUD states
export const HUD_STATES = {
  HIDDEN: 'hidden',
  VISIBLE: 'visible',
  ANIMATING: 'animating',
  UPDATING: 'updating'
};

// HUD events
export const HUD_EVENTS = {
  SHOW: 'hud:show',
  HIDE: 'hud:hide',
  UPDATE: 'hud:update',
  ANIMATE: 'hud:animate',
  BOUNCE: 'hud:bounce'
};

// Performance limits
export const PERFORMANCE = {
  MAX_ANIMATIONS: 10,
  ANIMATION_FRAME_RATE: 60,
  DEBOUNCE_DELAY: 16,
  MAX_TEXT_LENGTH: 20
};

// All functions are already exported individually above
