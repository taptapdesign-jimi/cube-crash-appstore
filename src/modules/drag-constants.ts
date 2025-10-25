// drag-constants.ts
// Constants for drag and drop system


// Animation constants
export const TILT_MAX_RAD = 0.22;   // maksimalna rotacija (~12.6°)
export const TILT_SCALE = 18;     // skala pretvorbe brzine → rotacija
export const VEL_SMOOTH = 0.10;   // sporije prihvaća promjenu brzine (teži osjećaj)
export const ROT_SMOOTH = 0.08;   // sporije naginje prema cilju (teži osjećaj)
export const POS_LAG_PX = 6;      // maksimalni parallax pomak (px)
export const TILT_DUR = 0.5;    // zadržano za release tween na onUp

// Magnet constants
export const MAGNET_OFFSET_RATIO = 14 / 128; // 14px od 128px pločice ≈ 10.9375%
export const MAGNET_SCALE_MULT = 1.03;    // 3% napuhavanje ciljane pločice
export const MAGNET_IN_DUR = 0.12;    // trajanje scale-in easing
export const MAGNET_MOVE_DUR = 0.085;   // koliko brzo se target približava
export const MAGNET_RETURN_DUR = 0.14;    // trajanje povratka u baznu poziciju

// Default configuration
export const DEFAULT_DRAG_CONFIG = {
  tileSize: 128,
  hoverColor: 0xFFE9D9,
  hoverWidth: 4,
  hoverAlpha: 0.8,
  threshold: 0.5
};

// Event types
export const DRAG_EVENTS = {
  START: 'drag:start',
  MOVE: 'drag:move',
  END: 'drag:end',
  HOVER: 'drag:hover',
  UNHOVER: 'drag:unhover',
  MERGE: 'drag:merge',
  SNAP_BACK: 'drag:snapback'
};

// Animation easing
export const EASING = {
  EASE_OUT: 'power2.out',
  EASE_IN: 'power2.in',
  EASE_IN_OUT: 'power2.inOut',
  EASE_BACK: 'back.out(1.7)',
  EASE_ELASTIC: 'elastic.out(1, 0.3)'
};

// Visual effects
export const VISUAL_EFFECTS = {
  SHADOW_OFFSET: 8,
  SHADOW_BLUR: 16,
  SHADOW_ALPHA: 0.3,
  HOVER_GLOW: 0xFFFFFF,
  HOVER_GLOW_ALPHA: 0.5
};

// Performance limits
export const PERFORMANCE = {
  MAX_TILES: 100,
  MAX_ANIMATIONS: 50,
  FRAME_RATE: 60,
  DEBOUNCE_DELAY: 16 // ~60fps
};

// All functions are already exported individually above