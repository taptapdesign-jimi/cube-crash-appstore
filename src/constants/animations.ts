// Animation constants
import { ACTIVE_SLIDER_TOTAL_SLIDES } from '../modules/shop-module.js';

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

// 🔥 FIX: Slider animation timing constants (previously magic numbers)
export const SLIDER_ANIMATION = {
  // Exit animation sequence delays (ms)
  EXIT_HERO_DELAY: 0,
  EXIT_CTA_DELAY: 30,
  EXIT_LOGO_DELAY: 90,
  EXIT_NAV_DELAY: 120,
  
  // Enter animation sequence delays (ms)
  ENTER_NAV_DELAY: 0,
  ENTER_LOGO_DELAY: 30,
  ENTER_TEXT_DELAY: 0,
  ENTER_HERO_DELAY: 120,
  
  // Animation durations (ms)
  BOUNCE_DURATION: 650,
  TOTAL_SEQUENCE: 770,      // 120ms delay + 650ms animation
  FALLBACK_TIMEOUT: 800,    // Safety fallback (slightly > TOTAL_SEQUENCE)
  
  // Polling intervals (ms)
  ANIMATION_CHECK_INTERVAL: 50,
  
  // CSS transition duration
  TRANSITION_DURATION: '0.65s',
  TRANSITION_EASING: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)'
} as const;

// Slider drag and navigation constants
export const SLIDER_CONFIG = {
  // Slide configuration
  TOTAL_SLIDES: ACTIVE_SLIDER_TOTAL_SLIDES,
  
  // Drag thresholds (px)
  DRAG_THRESHOLD_PX: 100,           // Minimum drag distance to change slide
  SWIPE_VELOCITY_THRESHOLD_PX_PER_MS: 0.35, // Fast flick threshold (px/ms) to change slide even on short drag
  
  // Elastic bounce at edges
  ELASTIC_LIMIT_MULTIPLIER: 0.03,   // 3% of slide width for elastic bounce
  ELASTIC_RESISTANCE: 0.1,          // 10% movement (90% resistance) at edges
  
  // Animation triggers
  POSITION_DIFF_THRESHOLD: 0.5,     // Minimum px difference to trigger animation
  
  // Slide animation
  SLIDE_DURATION_S: 0.4,            // Duration in seconds for slide transition
  SLIDE_EASING: 'power2.out',       // GSAP easing for smooth slide
  
  // Navigation button sizes (px) — desktop / default; iPhone & iPad use getNavButton*Size()
  NAV_BUTTON_INACTIVE_SIZE: 48,
  NAV_BUTTON_ACTIVE_SIZE: 72,
  NAV_BUTTON_ANIM_DURATION_S: 0.1,  // Duration in seconds
  NAV_IMAGE_ACTIVE_Y: -12,          // Y offset when active
  NAV_IMAGE_INACTIVE_Y: 0,          // Y offset when inactive
  NAV_BUTTON_EASING: 'power2.inOut'
} as const;

/** Match independent-navigation.css + GSAP: inactive icon box per viewport */
export function getNavButtonInactiveSize(): number {
  if (typeof window === 'undefined') return SLIDER_CONFIG.NAV_BUTTON_INACTIVE_SIZE;
  if (window.matchMedia('(min-width: 768px) and (max-width: 1024px)').matches) {
    return 64;
  }
  if (window.matchMedia('(max-width: 430px)').matches) {
    return 64;
  }
  return SLIDER_CONFIG.NAV_BUTTON_INACTIVE_SIZE;
}

/** Active icon box — iPad 96px per CSS; phone / desktop 72px */
export function getNavButtonActiveSize(): number {
  if (typeof window === 'undefined') return SLIDER_CONFIG.NAV_BUTTON_ACTIVE_SIZE;
  if (window.matchMedia('(min-width: 768px) and (max-width: 1024px)').matches) {
    return 96;
  }
  return SLIDER_CONFIG.NAV_BUTTON_ACTIVE_SIZE;
}

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
