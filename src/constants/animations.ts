// Animation constants
export const ANIMATION_DELAYS = {
  SHORT: 50,
  MEDIUM: 100,
  LONG: 300,
  VERY_LONG: 600
} as const;

export const ANIMATION_DURATIONS = {
  FAST: '0.3s',
  NORMAL: '0.6s',
  SLOW: '1.0s'
} as const;

export const ANIMATION_EASING = {
  EASE: 'ease',
  EASE_IN_OUT: 'ease-in-out',
  CUBIC_BEZIER: 'cubic-bezier(0.68, -0.8, 0.265, 1.8)'
} as const;

// CSS classes
export const CSS_CLASSES = {
  VISIBLE: 'visible',
  HIDDEN: 'hidden',
  ACTIVE: 'active',
  EXIT_ANIMATION: 'exit-animation',
  ANIMATION_COMPLETE: 'animation-complete'
} as const;

// Element IDs
export const ELEMENT_IDS = {
  HOME: 'home',
  APP: 'app',
  LOADING_SCREEN: 'loading-screen',
  SLIDER_CONTAINER: 'slider-container',
  GLOBAL_BG: 'global-bg'
} as const;

// Type definitions
export type ElementId = keyof typeof ELEMENT_IDS;
export type AnimationDelay = keyof typeof ANIMATION_DELAYS;
export type AnimationDuration = keyof typeof ANIMATION_DURATIONS;
export type AnimationEasing = keyof typeof ANIMATION_EASING;
export type CssClass = keyof typeof CSS_CLASSES;