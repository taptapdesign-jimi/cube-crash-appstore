import { gsap } from 'gsap';
import { ANIMATION_DURATIONS, ANIMATION_EASING, ELEMENT_IDS, SLIDER_ANIMATION } from '../constants/animations.js';
import { logger } from '../core/logger.js';
import gameState from '../modules/game-state.js';
import { sliderState } from '../modules/slider-state.js';
import { getRegisteredCta } from '../modules/cta-system.js';
import {
  commitHomepageNavigation,
  markHomepageNavigationEntering,
  primeHomepageNavigation,
} from '../modules/navigation-control.js';

// Safe element getter
export const getElement = (id: string): HTMLElement | null => {
  try {
    return document.getElementById(id);
  } catch (error) {
    logger.error(`Failed to get element with id: ${id}`, error);
    return null;
  }
};

// Fade out home element
export const fadeOutHome = (): void => {
  const home = getElement(ELEMENT_IDS.HOME);
  if (home) {
    home.style.transition = `opacity ${ANIMATION_DURATIONS.NORMAL} ${ANIMATION_EASING.EASE}`;
    home.style.opacity = '0';
    logger.info('🎮 Animating #home element fade out');
  }
};

// Fade in home element
export const fadeInHome = (): void => {
  const home = getElement(ELEMENT_IDS.HOME);
  if (home) {
    home.style.transition = `opacity ${ANIMATION_DURATIONS.NORMAL} ${ANIMATION_EASING.EASE}`;
    home.style.opacity = '1';
    logger.info('🎮 Animating #home element fade in');
  }
};

// Safe pause game - NO-OP for now (game not active yet)
export const safePauseGame = (): void => {
  try {
    // No-op: game is not active when resume sheet shows
    logger.info('🎯 safePauseGame called (no-op)');
  } catch (error) {
    logger.error('❌ Failed to pause game:', error);
  }
};

// Safe resume game - NO-OP for now (game not active yet)
export const safeResumeGame = (): void => {
  try {
    // No-op: game is not active yet
    logger.info('🎯 safeResumeGame called (no-op)');
  } catch (error) {
    logger.error('❌ Failed to resume game:', error);
  }
};

// Safe lock slider
export const safeLockSlider = (): void => {
  try {
    const lockSlider = (window as any).lockSlider as undefined | (() => void);
    if (typeof lockSlider === 'function') {
      lockSlider();
      logger.info('🔒 Slider locked successfully');
    } else {
      logger.warn('⚠️ lockSlider function not available');
    }
  } catch (error) {
    logger.warn('⚠️ Failed to lock slider:', error);
  }
};

// Safe unlock slider
export const safeUnlockSlider = (): void => {
  try {
    const unlockSlider = (window as any).unlockSlider as undefined | (() => void);
    if (typeof unlockSlider === 'function') {
      unlockSlider();
      logger.info('🔓 Slider unlocked successfully');
    } else {
      logger.warn('⚠️ unlockSlider function not available');
    }
  } catch (error) {
    logger.warn('⚠️ Failed to unlock slider:', error);
  }
};

// Animate slider exit when clicking CTA - CARTOONISH BOUNCE-INTO-SCALE-0
// Helper function for EXTRA CARTOONISH bounce scale animation (SCALE ONLY, NO OPACITY)
const cartoonishBounce = (element: HTMLElement, delay: number) => {
  const timeout = setTimeout(() => {
    activeTimeouts.delete(timeout);
    // Remove any existing animation classes
    element.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
    
    // Force reflow
    void element.offsetHeight;
    
    // NOW animate with CSS class
    element.classList.add('animate-exit');
    // NO OPACITY - only scale down
  }, delay);
  activeTimeouts.add(timeout);
};

const HOME_ENTER_DIAG_PREFIX = '🏠🧪 HOME_ENTER_DIAG';

const getHomeEnterElementLabel = (element: HTMLElement): string => {
  if (element.id) return `#${element.id}`;
  const dataSlide = element.getAttribute('data-slide');
  if (dataSlide) return `.slider-slide[data-slide="${dataSlide}"]`;
  const className = String(element.className || '').trim().replace(/\s+/g, '.');
  return className ? `.${className}` : element.tagName.toLowerCase();
};

const logHomeEnterElementState = (phase: string, element: HTMLElement | null | undefined, extra: Record<string, unknown> = {}): void => {
  if (!element) {
    console.log(HOME_ENTER_DIAG_PREFIX, phase, { exists: false, ...extra });
    return;
  }

  const computed = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  console.log(HOME_ENTER_DIAG_PREFIX, phase, {
    label: getHomeEnterElementLabel(element),
    classes: element.className,
    hidden: element.hasAttribute('hidden'),
    ariaHidden: element.getAttribute('aria-hidden'),
    inlineDisplay: element.style.display || null,
    inlineVisibility: element.style.visibility || null,
    inlineOpacity: element.style.opacity || null,
    inlineTransform: element.style.transform || null,
    inlineTransition: element.style.transition || null,
    display: computed.display,
    visibility: computed.visibility,
    opacity: computed.opacity,
    pointerEvents: computed.pointerEvents,
    zIndex: computed.zIndex,
    transform: computed.transform,
    transition: computed.transition,
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    ...extra,
  });
};

const removeHomeEnterClassesWithoutTransition = (
  element: HTMLElement,
  finalTransform: string | null = null,
  keepFinalTransform = false
): void => {
  const computedTransform = window.getComputedStyle(element).transform;
  const stableTransform = finalTransform || (computedTransform && computedTransform !== 'none' ? computedTransform : null);

  element.style.setProperty('transition', 'none', 'important');
  element.style.setProperty('-webkit-transition', 'none', 'important');

  if (stableTransform) {
    element.style.setProperty('transform', stableTransform, 'important');
    element.style.setProperty('-webkit-transform', stableTransform, 'important');
  }

  // Commit the stable visual state before removing animation classes. Otherwise
  // base CTA CSS can start a second transform transition during cleanup.
  void element.offsetHeight;

  element.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
  void element.offsetHeight;

  if (!keepFinalTransform) {
    element.style.removeProperty('transform');
    element.style.removeProperty('-webkit-transform');
    void element.offsetHeight;
  }

  element.style.removeProperty('transition');
  element.style.removeProperty('-webkit-transition');
};

const getHomepageCtaBaseTransform = (): string => {
  if (typeof window !== 'undefined' && window.innerWidth <= 767) {
    return 'translateY(2.25vh)';
  }
  return 'translateY(0px)';
};

const setHomepageCtaEnterTransform = (button: Element, scale: number, withTransition: boolean): void => {
  const element = button as HTMLElement;
  const baseTransform = getHomepageCtaBaseTransform();
  const transform = `${baseTransform} scale(${scale})`;
  element.style.setProperty('transform', transform, 'important');
  element.style.setProperty('-webkit-transform', transform, 'important');
  element.style.setProperty('transform-origin', '50% 50%', 'important');
  element.style.setProperty('-webkit-transform-origin', '50% 50%', 'important');
  element.style.setProperty('will-change', 'transform', 'important');
  if (withTransition) {
    element.style.setProperty('transition', 'transform 0.65s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 'important');
    element.style.setProperty('-webkit-transition', 'transform 0.65s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 'important');
  } else {
    element.style.setProperty('transition', 'none', 'important');
    element.style.setProperty('-webkit-transition', 'none', 'important');
  }
};

export const primeHomepageCtaEnterTransform = (button: Element | null | undefined): void => {
  if (!button) return;
  if (button instanceof HTMLButtonElement) {
    const controller = getRegisteredCta(button);
    if (controller) {
      controller.prime('hidden');
      return;
    }
  }
  setHomepageCtaEnterTransform(button, 0, false);
};

// Helper function for reverse bounce animation (scale 0 to 1) - NO OPACITY, SCALE ONLY
const reverseBounce = (element: HTMLElement, delay: number, durationMs?: number) => {
  // v700-style enter: let CSS own the whole bounce curve. The manual RAF
  // interpolator caused visible mid-cycle stalls when Journey cleanup/reflow
  // ran on the same frames as Homepage enter.
  element.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
  element.classList.add('animate-enter-initial');
  element.style.removeProperty('opacity');
  element.style.removeProperty('visibility');
  element.style.removeProperty('transition');
  element.style.removeProperty('-webkit-transition');
  element.style.removeProperty('transform');
  element.style.removeProperty('-webkit-transform');
  element.style.removeProperty('will-change');

  // Force reflow to apply initial scale(0) state before class transition.
  void element.offsetHeight;

  const timeout = setTimeout(() => {
    activeTimeouts.delete(timeout);
    element.style.removeProperty('opacity');
    element.style.removeProperty('visibility');
    element.style.removeProperty('transition');
    element.style.removeProperty('-webkit-transition');

    if (durationMs !== undefined) {
      const transition = `transform ${durationMs}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
      element.style.setProperty('transition', transition, 'important');
      element.style.setProperty('-webkit-transition', transition, 'important');
    }

    // Add enter before removing initial to avoid a full-scale flash.
    element.classList.add('animate-enter');
    element.classList.remove('animate-enter-initial');
  }, delay);
  activeTimeouts.add(timeout);
};

// Guard to prevent multiple simultaneous animations
// 🔥 REFACTOR: Use local flags that sync with sliderState module
let isAnimatingExit = false;
let isAnimatingEnter = false;
let sliderEnterPromise: Promise<void> | null = null;
let resolveSliderEnter: (() => void) | null = null;
let sliderEnterFallback: ReturnType<typeof setTimeout> | null = null;
let sliderEnterNavigationGeneration: number | null = null;
let journeySliderExitPromise: Promise<void> | null = null;
let journeySliderExitAnimations: Animation[] = [];
let journeySliderExitFallback: ReturnType<typeof setTimeout> | null = null;

// Track active animation timeouts for cleanup
let activeTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();
const HOMEPAGE_ENTER_HAPTIC_OFFSET_MS = 200;
const HOMEPAGE_ENTER_HAPTIC_FIRST_PAIR_GAP_MS = 155;
const HOMEPAGE_ENTER_HAPTIC_THIRD_GAP_MS = 130;
const HOMEPAGE_ENTER_FIRST_VISUAL_DELAY_MS = 45;
const HOMEPAGE_ENTER_CONTENT_DELAY_MS = 95;
// Navigation icons and their owned divider should establish almost alongside
// the hero/logo, rather than reading as a late final phase.
const HOMEPAGE_ENTER_NAV_DELAY_MS = 0;
const HOMEPAGE_ENTER_NAV_DURATION_MS = 430;
const HOMEPAGE_ENTER_FINALIZE_DELAY_MS = 1060;

const settleSliderEnter = (reason: string): void => {
  if (sliderEnterFallback) {
    clearTimeout(sliderEnterFallback);
    activeTimeouts.delete(sliderEnterFallback);
    sliderEnterFallback = null;
  }
  isAnimatingEnter = false;
  sliderState.setAnimatingEnter(false);
  const resolve = resolveSliderEnter;
  resolveSliderEnter = null;
  sliderEnterPromise = null;
  sliderEnterNavigationGeneration = null;
  resolve?.();
  logger.info('✅ Homepage enter owner settled', 'animations', { reason });
};

// Persisted badge key (matches navigation.ts)
const BADGE_STORAGE_KEY = 'journey_badge_count_v109';

/** Prime the complete active Homepage slide while its shell is still hidden. */
export const prepareSliderEnter = (): void => {
  sliderEnterNavigationGeneration = primeHomepageNavigation('animations:prepare-slider-enter');
  cachedElements = {};
  const activeSlide = document.querySelector('.slider-slide.active') ||
    document.querySelector('.slider-slide[data-slide="0"]');
  const slides = Array.from(document.querySelectorAll('.slider-slide')) as HTMLElement[];
  let restoredInactiveTargets = 0;

  slides.forEach((slide) => {
    if (slide === activeSlide) return;
    const inactiveTargets = Array.from(
      slide.querySelectorAll('.hero-container, .slide-button, .slide-text, .slide-tagline')
    ) as HTMLElement[];
    inactiveTargets.forEach((target) => {
      target.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset', 'soft-cartoon-bounce');
      target.style.removeProperty('opacity');
      target.style.removeProperty('visibility');
      target.style.removeProperty('display');
      target.style.removeProperty('transition');
      target.style.removeProperty('-webkit-transition');
      target.style.removeProperty('transform');
      target.style.removeProperty('-webkit-transform');
      target.style.removeProperty('will-change');
      restoredInactiveTargets += 1;
    });
    const inactiveCta = slide.querySelector<HTMLButtonElement>('.slide-button');
    if (inactiveCta) getRegisteredCta(inactiveCta)?.prime('idle');
  });

  const targets = [
    activeSlide?.querySelector('.hero-container'),
    activeSlide?.querySelector('.slide-button'),
    activeSlide?.querySelector('.slide-text'),
    activeSlide?.querySelector('.slide-tagline'),
    document.getElementById('home-logo'),
    document.getElementById('logo-shards-gore-ljevo'),
    document.getElementById('logo-shards-gore-desno'),
    document.getElementById('logo-shards-dole-ljevi'),
    document.getElementById('logo-shards-dole-desni'),
    document.getElementById('independent-nav'),
    document.querySelector('.slider-nav-divider'),
    document.getElementById('home-fixed-shadow-bottom'),
  ].filter((target): target is HTMLElement => target instanceof HTMLElement);

  targets.forEach((target) => {
    target.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
    target.classList.add('animate-enter-initial');
    if (target.id !== 'independent-nav') {
      target.style.removeProperty('opacity');
      target.style.removeProperty('visibility');
    }
    target.style.transition = 'none';
  });
  const activeCta = activeSlide?.querySelector<HTMLButtonElement>('.slide-button');
  if (activeCta) getRegisteredCta(activeCta)?.prime('hidden');

  logger.info('🏠 Homepage enter primed', 'animations', {
    activeSlide: activeSlide?.getAttribute('data-slide') || null,
    activeTargetCount: targets.length,
    restoredInactiveTargets,
  });
};

export const finalizeSliderEnterVisibility = (reason = 'homepage-enter-finalize'): void => {
  const activeSlide = document.querySelector('.slider-slide.active') ||
    document.querySelector('.slider-slide[data-slide="0"]');
  const shellTargets = [
    document.getElementById('home'),
    document.querySelector('#home .content'),
    document.getElementById('home-logo-wrapper'),
    document.getElementById('slider-container'),
    document.querySelector('#slider-container .slider-viewport'),
    document.getElementById('slider-wrapper'),
    activeSlide,
  ].filter((target): target is HTMLElement => target instanceof HTMLElement);

  shellTargets.forEach((target) => {
    target.removeAttribute('hidden');
    target.classList.remove('hidden');
    target.style.removeProperty('display');
    target.style.removeProperty('visibility');
    target.style.removeProperty('opacity');
    target.style.removeProperty('pointer-events');
    target.style.removeProperty('z-index');
  });

  const home = document.getElementById('home');
  if (home) {
    home.style.display = 'block';
    home.style.visibility = 'visible';
    home.style.opacity = '1';
    home.style.pointerEvents = 'auto';
    home.style.zIndex = '1';
  }

  const sliderContainer = document.getElementById('slider-container');
  if (sliderContainer) {
    sliderContainer.style.display = 'block';
    sliderContainer.style.visibility = 'visible';
    sliderContainer.style.opacity = '1';
    sliderContainer.style.pointerEvents = 'auto';
  }

  const targets = [
    activeSlide?.querySelector('.hero-container'),
    activeSlide?.querySelector('.slide-button'),
    activeSlide?.querySelector('.slide-text'),
    activeSlide?.querySelector('.slide-tagline'),
    document.getElementById('home-logo'),
    document.getElementById('logo-shards-gore-ljevo'),
    document.getElementById('logo-shards-gore-desno'),
    document.getElementById('logo-shards-dole-ljevi'),
    document.getElementById('logo-shards-dole-desni'),
    document.getElementById('independent-nav'),
    document.querySelector('.slider-nav-divider'),
    document.getElementById('home-fixed-shadow-bottom'),
  ].filter((target): target is HTMLElement => target instanceof HTMLElement);

  targets.forEach((target) => {
    target.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset', 'soft-cartoon-bounce');
    if (target.id !== 'independent-nav') {
      target.style.removeProperty('opacity');
      target.style.removeProperty('visibility');
      target.style.removeProperty('display');
      target.style.removeProperty('pointer-events');
    }
    target.style.removeProperty('transition');
    target.style.removeProperty('-webkit-transition');
    target.style.removeProperty('will-change');
  });
  const activeCta = activeSlide?.querySelector<HTMLButtonElement>('.slide-button');
  if (activeCta) getRegisteredCta(activeCta)?.prime('idle');

  logger.info('🏠 Homepage enter visibility finalized', 'animations', {
    reason,
    activeSlide: activeSlide?.getAttribute('data-slide') || null,
    shellTargetCount: shellTargets.length,
    targetCount: targets.length,
  });
};

// Journey nav badge module: kept in code/storage for later restore, currently hidden by request.
const JOURNEY_NAV_BADGE_ENABLED = false;

const readPersistedJourneyBadge = (): number => {
  try {
    const raw = localStorage.getItem(BADGE_STORAGE_KEY);
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

const writePersistedJourneyBadge = (count: number): void => {
  try {
    if (count > 0) {
      localStorage.setItem(BADGE_STORAGE_KEY, String(count));
    }
  } catch {
    // Ignore storage errors.
  }
};

const ensureJourneyBadge = (journeyNavButton: HTMLElement | null): number => {
  const cachedCount = (window as any).__ccJourneyBadgeCount || 0;
  const persistedCount = readPersistedJourneyBadge();
  const existingBadge = journeyNavButton?.querySelector('.nav-badge') as HTMLElement | null;
  const domCount = existingBadge
    ? parseInt(existingBadge.querySelector('.nav-badge-text')?.textContent || '0', 10)
    : 0;
  const effectiveCount = Math.max(cachedCount, persistedCount, domCount);

  if (!JOURNEY_NAV_BADGE_ENABLED) {
    if (effectiveCount > 0) {
      (window as any).__ccJourneyBadgeCount = effectiveCount;
      writePersistedJourneyBadge(effectiveCount);
    }
    existingBadge?.remove();
    return effectiveCount;
  }

  if (effectiveCount > 0) {
    (window as any).__ccJourneyBadgeCount = effectiveCount;
    if (journeyNavButton && !existingBadge) {
      const badge = document.createElement('div');
      badge.className = 'nav-badge';
      const badgeText = document.createElement('span');
      badgeText.className = 'nav-badge-text';
      badgeText.textContent = effectiveCount.toString();
      badge.appendChild(badgeText);
      journeyNavButton.appendChild(badge);
    }
    const badgeEl = journeyNavButton?.querySelector('.nav-badge') as HTMLElement | null;
    if (badgeEl) {
      badgeEl.style.display = 'flex';
      badgeEl.style.visibility = 'visible';
      badgeEl.style.opacity = '1';
    }
  }
  return effectiveCount;
};

const scheduleHomepageEnterPatternHaptics = (): void => {
  if (typeof (window as any).triggerHapticImpact !== 'function') return;
  // 1) first pulse, 2) immediately after first, 3) +100ms after second
  const t0 = HOMEPAGE_ENTER_HAPTIC_OFFSET_MS;
  const t1 = t0 + HOMEPAGE_ENTER_HAPTIC_FIRST_PAIR_GAP_MS;
  const t2 = t1 + HOMEPAGE_ENTER_HAPTIC_THIRD_GAP_MS;

  const schedule = (delayMs: number, label: string) => {
    const timeout = setTimeout(() => {
      activeTimeouts.delete(timeout);
      try { (window as any).triggerHapticImpact?.('light'); } catch {}
      logger.info(`📳 Homepage enter haptic: ${label} @ ${delayMs}ms`);
    }, Math.max(0, delayMs));
    activeTimeouts.add(timeout);
  };

  schedule(t0, 'central-image');
  schedule(t1, 'cta');
  schedule(t2, 'logo-end');
};

// Cache DOM elements for performance (prevent repeated querySelector calls on first click)
let cachedElements: {
  homeLogo?: HTMLElement | null;
  independentNav?: HTMLElement | null;
} = {};

// 🔥 NUCLEAR: Reset all animation flags without full cleanup
// This is a fast synchronous function that can be called to unblock animations
export const resetAnimationFlags = (): void => {
  isAnimatingExit = false;
  if (sliderEnterPromise) settleSliderEnter('reset-flags');
  else isAnimatingEnter = false;
  sliderState.reset();
  logger.info('✅ Animation flags reset (isAnimatingExit, isAnimatingEnter, sliderState)');
};

/** Cancel delayed Homepage-enter work before another route owns the screen. */
export const cancelSliderEnterAnimation = (reason = 'route-change'): void => {
  activeTimeouts.forEach((timeout) => clearTimeout(timeout));
  activeTimeouts.clear();
  settleSliderEnter(`cancel:${reason}`);
  sliderEnterNavigationGeneration = null;
  (window as any).__ccIsAnimatingSliderEnter = false;
  logger.info('🛑 Homepage enter animation cancelled', 'animations', { reason });
};

// Cleanup function to cancel all pending animations
export const cleanupAnimations = (): void => {
  logger.info('🧹 Cleaning up all animation timeouts...');
  activeTimeouts.forEach(timeout => {
    clearTimeout(timeout);
  });
  activeTimeouts.clear();
  isAnimatingExit = false;
  if (sliderEnterPromise) settleSliderEnter('cleanup');
  else isAnimatingEnter = false;
  
  // 🔥 FIX: Clear cached DOM elements to prevent stale references
  cachedElements = {};
  
  // 🔥 REFACTOR: Reset animation flags via sliderState module
  sliderState.reset();
  
  logger.info('✅ Animation cleanup complete (timeouts, cache, and flags cleared)');
};

const getPhysicallyVisibleHomepageSlides = (): HTMLElement[] => {
  const viewport = document.getElementById('slider-container')?.getBoundingClientRect();
  const left = viewport?.left ?? 0;
  const right = viewport?.right ?? window.innerWidth;

  return Array.from(document.querySelectorAll<HTMLElement>('.slider-slide')).filter((slide) => {
    const style = window.getComputedStyle(slide);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.01) return false;
    const rect = slide.getBoundingClientRect();
    return rect.width > 1 && rect.right > left + 1 && rect.left < right - 1;
  });
};

const getJourneySliderExitTargets = (): Array<{ element: HTMLElement; delay: number }> => {
  const activeSlide = document.querySelector<HTMLElement>('.slider-slide.active');
  const visibleSlides = getPhysicallyVisibleHomepageSlides();
  const exitSlides = visibleSlides.length > 0 ? visibleSlides : (activeSlide ? [activeSlide] : []);
  const targetGroups: Array<{ elements: Array<HTMLElement | null>; delay: number }> = [
    { elements: exitSlides.map(slide => slide.querySelector<HTMLElement>('.hero-container')), delay: 0 },
    {
      elements: exitSlides.flatMap(slide => [
        slide.querySelector<HTMLElement>('.slide-button'),
        slide.querySelector<HTMLElement>('.slide-text'),
        slide.querySelector<HTMLElement>('.slide-tagline'),
      ]),
      delay: 0.03,
    },
    {
      elements: [
        document.getElementById('home-logo'),
        document.getElementById('logo-shards-gore-ljevo'),
        document.getElementById('logo-shards-gore-desno'),
        document.getElementById('logo-shards-dole-ljevi'),
        document.getElementById('logo-shards-dole-desni'),
      ],
      delay: 0.06,
    },
    {
      elements: [
        document.getElementById('independent-nav'),
        document.getElementById('home-fixed-shadow-bottom'),
      ],
      delay: 0.09,
    },
  ];

  const seen = new Set<HTMLElement>();
  return targetGroups.flatMap(({ elements, delay }) => elements
    .filter((element): element is HTMLElement => !!element && element.isConnected)
    .filter((element) => {
      if (seen.has(element)) return false;
      seen.add(element);
      return true;
    })
    .map((element) => ({ element, delay })));
};

/**
 * Homepage → Journey owns one continuous cartoony back-in exit. Unlike the
 * legacy global `.animate-exit` curve, the endpoint never crosses scale zero,
 * so the initial punch resolves into one shrink instead of a second "bom".
 */
export const animateJourneySliderExit = (): Promise<void> => {
  if (journeySliderExitPromise) return journeySliderExitPromise;

  isAnimatingExit = true;
  sliderState.setAnimatingExit(true);
  gameState.set('sliderLocked', true);
  const targets = getJourneySliderExitTargets();

  journeySliderExitPromise = new Promise<void>((resolve) => {
    let finished = false;
    let remaining = targets.length;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (journeySliderExitFallback) {
        clearTimeout(journeySliderExitFallback);
        journeySliderExitFallback = null;
      }
      resolve();
    };
    const finishTarget = () => {
      remaining -= 1;
      if (remaining <= 0) finish();
    };

    targets.forEach(({ element, delay }) => {
      gsap.killTweensOf(element);
      const ctaController = element instanceof HTMLButtonElement ? getRegisteredCta(element) : null;
      if (!ctaController) {
        // If exit interrupts Homepage enter, freeze the exact painted transform
        // before removing enter classes. The independent `scale` animation can
        // then shrink that frame without snapping to the responsive base pose.
        const paintedTransform = window.getComputedStyle(element).transform;
        element.style.setProperty('transition', 'none', 'important');
        element.style.setProperty('-webkit-transition', 'none', 'important');
        if (paintedTransform && paintedTransform !== 'none') {
          element.style.setProperty('transform', paintedTransform, 'important');
          element.style.setProperty('-webkit-transform', paintedTransform, 'important');
        }
      }
      element.classList.remove(
        'animate-exit', 'animate-enter', 'animate-enter-initial',
        'animate-enter-complete', 'animate-reset', 'soft-cartoon-bounce',
      );
      if (ctaController) {
        void ctaController.exit({ delay }).then(finishTarget);
        return;
      }
      element.style.willChange = 'scale';
      // Animate the independent CSS `scale` longhand so every established
      // responsive translate/transform rule remains untouched.
      const animation = element.animate([
        { scale: '1' },
        { scale: '0' },
      ], {
        duration: 460,
        delay: delay * 1000,
        // CSS approximation of GSAP back.in(1.25), matching the Journey
        // contract: a small outward anticipation followed by one clean exit.
        easing: 'cubic-bezier(0.60, -0.28, 0.735, 0.045)',
        fill: 'forwards',
      });
      animation.onfinish = finishTarget;
      journeySliderExitAnimations.push(animation);
    });

    journeySliderExitFallback = setTimeout(finish, 700);
    if (targets.length === 0) finish();
    logger.info('🎬 Journey Homepage exit started with one monotonic owner');
  });

  return journeySliderExitPromise;
};

/** Call only after Homepage is hidden so normalization cannot flash on screen. */
export const finalizeJourneySliderExit = (): void => {
  journeySliderExitAnimations.splice(0).forEach((animation) => {
    try { animation.cancel(); } catch {}
  });
  if (journeySliderExitFallback) {
    clearTimeout(journeySliderExitFallback);
    journeySliderExitFallback = null;
  }
  getJourneySliderExitTargets().forEach(({ element }) => {
    element.classList.remove('animate-exit', 'soft-cartoon-bounce');
    element.style.removeProperty('scale');
    element.style.removeProperty('transition');
    element.style.removeProperty('-webkit-transition');
    element.style.removeProperty('transform');
    element.style.removeProperty('-webkit-transform');
    element.style.removeProperty('will-change');
  });
  document.querySelectorAll<HTMLElement>('.nav-badge.animate-exit').forEach((badge) => {
    badge.classList.remove('animate-exit');
    badge.style.removeProperty('opacity');
    badge.style.removeProperty('will-change');
  });
  document.getElementById('home')?.removeAttribute('data-journey-exit');
  journeySliderExitPromise = null;
  isAnimatingExit = false;
  sliderState.setAnimatingExit(false);
  gameState.set('sliderLocked', false);
  logger.info('✅ Journey Homepage exit finalized after Homepage hide');
};

/** Legacy CSS implementation used only when Web Animations is unavailable. */
const animateSliderExitLegacy = (): void => {
  // 🔥 FIX: Check guard flag before try block to avoid early return issues
  if (isAnimatingExit) {
    logger.warn('⚠️ Exit animation already in progress, ignoring duplicate call');
    return;
  }
  
  // Set flags immediately
  // 🔥 REFACTOR: Use sliderState module for state management
  isAnimatingExit = true;
  sliderState.setAnimatingExit(true);
  gameState.set('sliderLocked', true);
  
  try {
    logger.info('🎬 Starting CARTOONISH PROCEDURAL exit animation...');
    
    // 🔥 CRITICAL: Ensure badge is visible and ready BEFORE starting animation
    const journeyNavButton = document.querySelector('.independent-nav-button[data-slide="1"]') as HTMLElement;
    if (journeyNavButton) {
      const ensuredCount = ensureJourneyBadge(journeyNavButton);
      if (JOURNEY_NAV_BADGE_ENABLED && ensuredCount > 0) {
        logger.info(`🎯 Badge ensured before exit animation: ${ensuredCount}`);
      } else if (!JOURNEY_NAV_BADGE_ENABLED && ensuredCount > 0) {
        logger.debug(`🗺️ Journey badge count preserved but hidden: ${ensuredCount}`);
      } else {
        logger.debug('🗺️ No journey badge to preserve (count=0)');
      }
    } else {
      logger.warn('⚠️ Journey navigation button not found');
    }
    
    // Start the actual exit animation sequence
    startExitAnimationSequence();
    
    // 🔥 FIX: Use constant for timeout duration
    const timeout = setTimeout(() => {
      activeTimeouts.delete(timeout);
      isAnimatingExit = false;
      sliderState.setAnimatingExit(false);
      gameState.set('sliderLocked', false);
      logger.info('✅ Exit animation guard reset');
    }, SLIDER_ANIMATION.TOTAL_SEQUENCE);
    activeTimeouts.add(timeout);
    
  } catch (error) {
    // 🔥 FIX: Always reset flags on error
    isAnimatingExit = false;
    sliderState.setAnimatingExit(false);
    gameState.set('sliderLocked', false);
    logger.error('❌ Failed to animate slider exit:', error);
  }
};

// Separate function for the actual animation sequence
function startExitAnimationSequence(): void {
  try {
    // Find the currently active slide (slide with .active class)
    const activeSlide = document.querySelector('.slider-slide.active');
    if (!activeSlide) {
      logger.warn('⚠️ No active slide found, animating from first slide');
      startExitAnimationSequenceLegacy();
      return;
    }
    
    const visibleSlides = getPhysicallyVisibleHomepageSlides();
    const exitSlides = visibleSlides.length > 0 ? visibleSlides : [activeSlide as HTMLElement];
    const slideParts = exitSlides.map(slide => ({
      slide,
      heroContainer: slide.querySelector<HTMLElement>('.hero-container'),
      slideButton: slide.querySelector<HTMLButtonElement>('.slide-button'),
      slideText: slide.querySelector<HTMLElement>('.slide-text'),
      slideTagline: slide.querySelector<HTMLElement>('.slide-tagline'),
    }));
    logger.info('🎬 Starting exit animation for physically visible slides', 'animations', {
      slides: exitSlides.map(slide => slide.dataset.slide),
    });
    
    // Use cached elements or query them once and cache
    if (!cachedElements.homeLogo || !cachedElements.homeLogo.isConnected) {
      cachedElements.homeLogo = document.querySelector('#home-logo');
    }
    const homeLogo = cachedElements.homeLogo;
    
    if (!cachedElements.independentNav || !cachedElements.independentNav.isConnected) {
      cachedElements.independentNav = document.getElementById('independent-nav');
    }
    const independentNav = cachedElements.independentNav;
    
    // CARTOONISH PROCEDURAL SEQUENCE: 1. Hero → 2. CTA → 3. Text → 4. Logo → 5. Navigation LAST
    
    // STEP 1: Hero image FIRST (0ms delay)
    slideParts.forEach(({ heroContainer }) => {
      if (heroContainer) cartoonishBounce(heroContainer, 0);
    });
    logger.info('🖼️ Step 1: Visible hero images cartoonish bounce - FIRST');
    
    // STEP 2: CTA button, Slide text, and Tagline TOGETHER (30ms delay - right after Hero)
    // Animate all at exactly the same time using the same timeout
    // Note: slideTagline is already defined above
    const timeout = setTimeout(() => {
      activeTimeouts.delete(timeout);
      
      // 🔥 iPad FIX: Detect iPad to preserve transform positions during exit animation
      const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;
      
      slideParts.forEach(({ slideButton, slideText, slideTagline }) => {
      if (slideButton) {
        const ctaController = getRegisteredCta(slideButton as HTMLButtonElement);
        slideButton.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
        void slideButton.offsetHeight;
        if (ctaController) void ctaController.exit();
        else slideButton.classList.add('animate-exit');
        
        // 🔥 iPad FIX: Set transform position immediately when adding animate-exit class
        if (isIPad && !ctaController) {
          (slideButton as HTMLElement).style.transform = 'translateY(0px) scale(0)';
          (slideButton as HTMLElement).style.webkitTransform = 'translateY(0px) scale(0)';
          (slideButton as HTMLElement).style.transition = 'transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6)';
          (slideButton as HTMLElement).style.webkitTransition = 'transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6)';
        }
        
        logger.info('🔘 Step 2: Visible CTA button cartoonish bounce - SECOND');
      }
    
    if (slideText) {
        slideText.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
        void slideText.offsetHeight;
        slideText.classList.add('animate-exit');
        
        // 🔥 iPad FIX: Set transform position immediately when adding animate-exit class
        if (isIPad) {
          (slideText as HTMLElement).style.transform = 'translateY(64px) scale(0)';
          (slideText as HTMLElement).style.webkitTransform = 'translateY(64px) scale(0)';
          (slideText as HTMLElement).style.transition = 'transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6)';
          (slideText as HTMLElement).style.webkitTransition = 'transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6)';
        }
        
        logger.info('📝 Step 2: Slide text cartoonish bounce - TOGETHER with CTA');
      }
      
      // Animate tagline together with text and CTA
      if (slideTagline) {
        (slideTagline as HTMLElement).classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
        void (slideTagline as HTMLElement).offsetHeight;
        (slideTagline as HTMLElement).classList.add('animate-exit');
        
        // 🔥 iPad FIX: Set transform position immediately when adding animate-exit class
        if (isIPad) {
          (slideTagline as HTMLElement).style.transform = 'translateY(-12px) scale(0)';
          (slideTagline as HTMLElement).style.webkitTransform = 'translateY(-12px) scale(0)';
          (slideTagline as HTMLElement).style.transition = 'transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6)';
          (slideTagline as HTMLElement).style.webkitTransition = 'transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6)';
        }
        
        logger.info('📝 Step 2: Slide tagline cartoonish bounce - TOGETHER with text and CTA');
      }
      });
    }, 30);
    activeTimeouts.add(timeout);
    
    // STEP 4: Home logo and shards FOURTH (90ms delay)
    if (homeLogo) {
      cartoonishBounce(homeLogo as HTMLElement, 90);
      logger.info('🎨 Step 4: Home logo cartoonish bounce - FOURTH');
    } else {
      logger.warn('⚠️ Home logo not found');
    }
    
    // Animate shards together with logo - ALL at the same time as logo (90ms delay)
    const logoAddons = [
      document.getElementById('logo-shards-gore-ljevo'),
      document.getElementById('logo-shards-gore-desno'),
      document.getElementById('logo-shards-dole-ljevi'),
      document.getElementById('logo-shards-dole-desni')
    ];
    
    // 🔥 iPad FIX: Detect iPad to preserve transform positions during exit animation
    const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;
    
    logoAddons.forEach((addon, index) => {
      if (addon) {
        const addonEl = addon as HTMLElement;
        
        // 🔥 iPad FIX: For iPad, use custom timeout to set transform after adding animate-exit class
        if (isIPad) {
          const timeout = setTimeout(() => {
            activeTimeouts.delete(timeout);
            // Remove any existing animation classes
            addonEl.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
            
            // Force reflow
            void addonEl.offsetHeight;
            
            // NOW animate with CSS class
            addonEl.classList.add('animate-exit');
            
            // 🔥 iPad FIX: Use requestAnimationFrame to ensure CSS class is applied before setting inline styles
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // 🔥 iPad FIX: Set transform position with !important via inline style to override CSS
                // Preserve translateY(-24px) and add scale(0) for exit animation
                addonEl.style.setProperty('transform', 'translateY(-24px) scale(0)', 'important');
                addonEl.style.setProperty('-webkit-transform', 'translateY(-24px) scale(0)', 'important');
                addonEl.style.setProperty('transition', 'transform 0.65s cubic-bezier(0.60, -0.28, 0.735, 0.045)', 'important');
                addonEl.style.setProperty('-webkit-transition', 'transform 0.65s cubic-bezier(0.60, -0.28, 0.735, 0.045)', 'important');
                addonEl.style.setProperty('will-change', 'transform', 'important');
              });
            });
          }, 90);
          activeTimeouts.add(timeout);
        } else {
          cartoonishBounce(addonEl, 90); // Same delay as logo - no stagger
        }
        
        logger.info(`✨ Step 4: Logo addon ${index + 1} cartoonish bounce - with logo (same time)`);
      }
    });
    
    
    // STEP 5: Navigation and Shadow LAST (120ms delay - finishes at 420ms, close to 400ms)
    // 🔥 CRITICAL: Find badge FIRST and ensure it's protected before animating navigation
    // Badge is child of navigation button, so it will animate with navigation via CSS
    const journeyNavButton = document.querySelector('.independent-nav-button[data-slide="1"]') as HTMLElement;
    let journeyBadge: HTMLElement | null = null;
    if (journeyNavButton) {
      ensureJourneyBadge(journeyNavButton);
      journeyBadge = journeyNavButton.querySelector('.nav-badge') as HTMLElement;
      if (journeyBadge && journeyBadge.isConnected) {
        // 🔥 CRITICAL: Ensure badge is visible and protected BEFORE navigation animation starts
        journeyBadge.style.display = 'flex';
        journeyBadge.style.visibility = 'visible';
        journeyBadge.style.opacity = '1';
        // Prevent fade-out during exit; keep opacity solid while nav scales
        journeyBadge.style.setProperty('opacity', '1', 'important');
        // Add animate-exit class IMMEDIATELY to protect badge from removal
        journeyBadge.classList.remove('animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
        journeyBadge.classList.add('animate-exit');
        logger.info('🎯 Badge found and protected - ready for exit animation');
      } else {
        logger.debug('🗺️ Journey badge not present in nav (count=0)');
      }
    } else {
      logger.warn('⚠️ Journey navigation button not found');
    }
    
    // Now animate navigation - badge will animate as child via CSS (#independent-nav.animate-exit .nav-badge)
    if (independentNav) {
      cartoonishBounce(independentNav as HTMLElement, 120);
      logger.info('🎯 Step 5: Navigation cartoonish bounce - LAST (badge animates as child)');
    } else {
      logger.warn('⚠️ Navigation not found');
    }
    
    // Remove badge after animation completes (650ms animation + 120ms delay = 770ms total)
    if (journeyBadge) {
      const badgeRemoveTimeout = setTimeout(() => {
        activeTimeouts.delete(badgeRemoveTimeout);
        // Double-check that badge still exists and has animate-exit class
        const stillExists = document.querySelector('.independent-nav-button[data-slide="1"] .nav-badge') as HTMLElement;
        if (stillExists && stillExists.classList.contains('animate-exit')) {
          const storedBadgeCount = (window as any).__ccJourneyBadgeCount;
          const persistedBadgeCount = readPersistedJourneyBadge();
          const domCount = parseInt(stillExists.querySelector('.nav-badge-text')?.textContent || '0', 10);
          const effectiveCount = Math.max(
            Number.isFinite(storedBadgeCount) ? storedBadgeCount : 0,
            domCount,
            persistedBadgeCount
          );
          // Keep the badge if we already know there are unseen boards (or DOM shows a number)
          if (effectiveCount > 0) {
            // Ensure global cache is populated so rebuilds keep the badge
            (window as any).__ccJourneyBadgeCount = effectiveCount;
            logger.info('🎯 Journey badge removal skipped - preserving pending badge count');
            return;
          }
          if (typeof (window as any).updateNavBadge === 'function') {
            (window as any).updateNavBadge(0, 1);
            logger.info('✅ Journey badge removed after exit animation');
          }
        } else {
          logger.warn('⚠️ Journey badge was already removed or animation was interrupted');
        }
      }, 770); // Match exit animation duration
      activeTimeouts.add(badgeRemoveTimeout);
    }
    
    // Shadow animates together with navigation
    const fixedShadowBottom = document.getElementById('home-fixed-shadow-bottom');
    if (fixedShadowBottom) {
      cartoonishBounce(fixedShadowBottom as HTMLElement, 120);
      logger.info('🌑 Step 5: Shadow cartoonish bounce - LAST (with navigation)');
    }
    
    logger.info('✅ Cartoonish bounce-in-to-scale-0 exit animation started');
  } catch (error) {
    logger.error('❌ Failed to start exit animation sequence:', error);
  }
};

// Legacy fallback for when no active slide is found
function startExitAnimationSequenceLegacy(): void {
  // STEP 1: Hero image FIRST (0ms delay)
  const heroContainer = document.querySelector('.hero-container');
  if (heroContainer) {
    cartoonishBounce(heroContainer as HTMLElement, 0);
    logger.info('🖼️ Step 1: Hero image cartoonish bounce - FIRST (legacy)');
  }
  
  // STEP 2: CTA button, Slide text, and Tagline TOGETHER (30ms delay - right after Hero)
  // Animate all at exactly the same time using the same timeout
  const slideButton = document.querySelector('.slide-button') || document.getElementById('btn-home');
  const slideText = document.querySelector('.slide-text');
  const slideTagline = document.querySelector('.slide-tagline');
  
  // 🔥 iPad FIX: Detect iPad to preserve transform positions during exit animation (legacy)
  const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;
  
  const timeout = setTimeout(() => {
    activeTimeouts.delete(timeout);
  if (slideButton) {
      const ctaController = getRegisteredCta(slideButton as HTMLButtonElement);
      slideButton.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
      void slideButton.offsetHeight;
      if (ctaController) void ctaController.exit();
      else slideButton.classList.add('animate-exit');
      
      // 🔥 iPad FIX: Set transform position immediately when adding animate-exit class
      if (isIPad && !ctaController) {
        (slideButton as HTMLElement).style.transform = 'translateY(0px) scale(0)';
        (slideButton as HTMLElement).style.webkitTransform = 'translateY(0px) scale(0)';
        (slideButton as HTMLElement).style.transition = 'transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6)';
        (slideButton as HTMLElement).style.webkitTransition = 'transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6)';
      }
      
    logger.info('🔘 Step 2: CTA button cartoonish bounce - SECOND (legacy)');
  }
  
  if (slideText) {
      slideText.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
      void slideText.offsetHeight;
      slideText.classList.add('animate-exit');
      
      // 🔥 iPad FIX: Set transform position immediately when adding animate-exit class
      if (isIPad) {
        (slideText as HTMLElement).style.transform = 'translateY(64px) scale(0)';
        (slideText as HTMLElement).style.webkitTransform = 'translateY(64px) scale(0)';
        (slideText as HTMLElement).style.transition = 'transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6)';
        (slideText as HTMLElement).style.webkitTransition = 'transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6)';
      }
      
      logger.info('📝 Step 2: Slide text cartoonish bounce - TOGETHER with CTA (legacy)');
    }
    
    // Animate tagline together with text and CTA
    if (slideTagline) {
      (slideTagline as HTMLElement).classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
      void (slideTagline as HTMLElement).offsetHeight;
      (slideTagline as HTMLElement).classList.add('animate-exit');
      
      // 🔥 iPad FIX: Set transform position immediately when adding animate-exit class
      if (isIPad) {
        (slideTagline as HTMLElement).style.transform = 'translateY(-12px) scale(0)';
        (slideTagline as HTMLElement).style.webkitTransform = 'translateY(-12px) scale(0)';
        (slideTagline as HTMLElement).style.transition = 'transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6)';
        (slideTagline as HTMLElement).style.webkitTransition = 'transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6)';
      }
      
      logger.info('📝 Step 2: Slide tagline cartoonish bounce - TOGETHER with text and CTA (legacy)');
  }
  }, 30);
  activeTimeouts.add(timeout);
  
  // STEP 4: Home logo and shards FOURTH (90ms delay)
  const homeLogo = document.querySelector('#home-logo');
  if (homeLogo) {
    cartoonishBounce(homeLogo as HTMLElement, 90);
    logger.info('🎨 Step 4: Home logo cartoonish bounce - FOURTH (legacy)');
  }
  
  // Animate shards together with logo - ALL at the same time as logo (90ms delay)
  const logoAddons = [
    document.getElementById('logo-shards-gore-ljevo'),
    document.getElementById('logo-shards-gore-desno'),
    document.getElementById('logo-shards-dole-ljevi'),
    document.getElementById('logo-shards-dole-desni')
  ];
  
  logoAddons.forEach((addon, index) => {
    if (addon) {
      const addonEl = addon as HTMLElement;
      
      // 🔥 iPad FIX: For iPad, use custom timeout to set transform after adding animate-exit class
      if (isIPad) {
        const timeout = setTimeout(() => {
          activeTimeouts.delete(timeout);
          // Remove any existing animation classes
          addonEl.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
          
          // Force reflow
          void addonEl.offsetHeight;
          
          // NOW animate with CSS class
          addonEl.classList.add('animate-exit');
          
          // 🔥 iPad FIX: Use requestAnimationFrame to ensure CSS class is applied before setting inline styles
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // 🔥 iPad FIX: Set transform position with !important via inline style to override CSS
              // Preserve translateY(-24px) and add scale(0) for exit animation
              addonEl.style.setProperty('transform', 'translateY(-24px) scale(0)', 'important');
              addonEl.style.setProperty('-webkit-transform', 'translateY(-24px) scale(0)', 'important');
              addonEl.style.setProperty('transition', 'transform 0.65s cubic-bezier(0.60, -0.28, 0.735, 0.045)', 'important');
              addonEl.style.setProperty('-webkit-transition', 'transform 0.65s cubic-bezier(0.60, -0.28, 0.735, 0.045)', 'important');
              addonEl.style.setProperty('will-change', 'transform', 'important');
            });
          });
        }, 90);
        activeTimeouts.add(timeout);
      } else {
        cartoonishBounce(addonEl, 90); // Same delay as logo - no stagger
      }
      
      logger.info(`✨ Step 4: Logo addon ${index + 1} cartoonish bounce - with logo (same time, legacy)`);
    }
  });
  
  // STEP 5: Navigation and Shadow LAST (120ms delay)
  const independentNav = document.getElementById('independent-nav');
  if (independentNav) {
    cartoonishBounce(independentNav as HTMLElement, 120);
    logger.info('🎯 Step 5: Navigation cartoonish bounce - LAST (legacy)');
  }
  
  // Shadow animates together with navigation
  const fixedShadowBottom = document.getElementById('home-fixed-shadow-bottom');
  if (fixedShadowBottom) {
    cartoonishBounce(fixedShadowBottom as HTMLElement, 120);
    logger.info('🌑 Step 5: Shadow cartoonish bounce - LAST (legacy, with navigation)');
  }
};

/**
 * Canonical Homepage exit for Arcade, Journey, Settings, and future routes.
 * The returned Promise settles from the real target completions; callers hide
 * Homepage only afterwards and then normalize with finalizeJourneySliderExit().
 */
export const animateSliderExit = (): Promise<void> => {
  if (typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function') {
    return animateJourneySliderExit();
  }

  animateSliderExitLegacy();
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      activeTimeouts.delete(timeout);
      resolve();
    }, SLIDER_ANIMATION.TOTAL_SEQUENCE);
    activeTimeouts.add(timeout);
  });
};

// Animate slider enter when returning to home - CARTOONISH PROCEDURAL ENTER (SCALE ONLY, NO OPACITY)
export const animateSliderEnter = (): Promise<void> => {
  // 🔥 FIX: Sync local flag with sliderState - if sliderState says not animating,
  // reset local flag (forceReady() might have reset sliderState but not local flag)
  if (!sliderState.isAnimatingEnter && isAnimatingEnter) {
    logger.info('🔄 Syncing local isAnimatingEnter flag with sliderState (was stuck true)');
    isAnimatingEnter = false;
  }
  
  // 🔥 FIX: Check guard flag before try block to avoid early return issues
  if (isAnimatingEnter) {
    logger.warn('⚠️ Enter animation already in progress, ignoring duplicate call');
    return sliderEnterPromise ?? Promise.resolve();
  }
  
  // Set flags immediately
  // 🔥 REFACTOR: Use sliderState module for state management
  isAnimatingEnter = true;
  sliderState.setAnimatingEnter(true);
  sliderEnterNavigationGeneration = markHomepageNavigationEntering(
    'animations:slider-enter-start',
    sliderEnterNavigationGeneration ?? undefined,
  );
  sliderEnterPromise = new Promise<void>((resolve) => {
    resolveSliderEnter = resolve;
  });
  
  try {
    logger.info('🎬 Starting CARTOONISH PROCEDURAL enter animation...');
    
    // Start the actual enter animation sequence
    startEnterAnimationSequence();
    
    // Completion is normally signalled by the final cleanup below. This is a
    // deadlock guard only, not the lifecycle authority.
    sliderEnterFallback = setTimeout(() => {
      commitHomepageNavigation(
        'animations:slider-enter-fallback',
        sliderEnterNavigationGeneration ?? undefined,
      );
      settleSliderEnter('fallback');
    }, HOMEPAGE_ENTER_FINALIZE_DELAY_MS + 220);
    activeTimeouts.add(sliderEnterFallback);
    
  } catch (error) {
    // 🔥 FIX: Always reset flags on error
    settleSliderEnter('error');
    logger.error('❌ Failed to animate slider enter:', error);
  }
  return sliderEnterPromise ?? Promise.resolve();
};

// Separate function for the actual enter animation sequence
function startEnterAnimationSequence(): void {
  try {
    scheduleHomepageEnterPatternHaptics();
    // 🔥 CRITICAL: Verify homepage is visible before starting animation
    const homeElement = document.getElementById('home');
    if (!homeElement) {
      logger.error('❌ Homepage element not found - cannot start enter animation');
      return;
    }
    
    const homeComputedStyle = window.getComputedStyle(homeElement);
    const isHomeVisible = homeComputedStyle.display !== 'none' && 
                         homeComputedStyle.visibility !== 'hidden' && 
                         homeComputedStyle.opacity !== '0';
    
    if (!isHomeVisible) {
      logger.warn('⚠️ Homepage is not visible - making it visible before animation');
      homeElement.removeAttribute('hidden');
      homeElement.style.display = 'block';
      homeElement.style.opacity = '1';
      homeElement.style.visibility = 'visible';
    }
    
    // Find the currently active slide (slide with .active class)
    let activeSlide = document.querySelector('.slider-slide.active');
    if (!activeSlide) {
      logger.warn('⚠️ No active slide found, animating from first slide');
      // 🔥 CRITICAL: Try to activate first slide if none is active
      const firstSlide = document.querySelector('.slider-slide[data-slide="0"]');
      if (firstSlide) {
        activeSlide = firstSlide;
        firstSlide.classList.add('active');
        logger.info('✅ Activated first slide (slide 0)');
        // Retry with first slide
        const retryActiveSlide = document.querySelector('.slider-slide.active');
        if (retryActiveSlide) {
          activeSlide = retryActiveSlide;
          logger.info('✅ Found active slide after activation');
          // Continue with normal flow below
        } else {
          startEnterAnimationSequenceLegacy();
          return;
        }
      } else {
        startEnterAnimationSequenceLegacy();
        return;
      }
    }
    
    // Find elements within the active slide ONLY
    const heroContainer = activeSlide.querySelector('.hero-container');
    const slideButton = activeSlide.querySelector('.slide-button');
    const slideText = activeSlide.querySelector('.slide-text');
    
    
    // Use cached elements or query them once and cache
    if (!cachedElements.homeLogo || !cachedElements.homeLogo.isConnected) {
      cachedElements.homeLogo = document.querySelector('#home-logo');
    }
    const homeLogo = cachedElements.homeLogo;
    
    if (!cachedElements.independentNav || !cachedElements.independentNav.isConnected) {
      cachedElements.independentNav = document.getElementById('independent-nav');
    }
    const independentNav = cachedElements.independentNav;
    
    // 🔥 CRITICAL: Elements are already hidden by main.ts before homepage is visible
    // We need to make them visible when animation starts, but keep them hidden until then
    // Animation will animate them in
    
    const fixedShadowBottom = document.getElementById('home-fixed-shadow-bottom');
    const logoAddons = [
      document.getElementById('logo-shards-gore-ljevo'),
      document.getElementById('logo-shards-gore-desno'),
      document.getElementById('logo-shards-dole-ljevi'),
      document.getElementById('logo-shards-dole-desni')
    ];

    console.log(HOME_ENTER_DIAG_PREFIX, 'sequence:start', {
      activeSlide: (activeSlide as HTMLElement).getAttribute('data-slide'),
      isAnimatingEnter,
      sliderStateAnimatingEnter: sliderState.isAnimatingEnter,
      firstVisualDelay: HOMEPAGE_ENTER_FIRST_VISUAL_DELAY_MS,
      contentDelay: HOMEPAGE_ENTER_CONTENT_DELAY_MS,
      navDelay: HOMEPAGE_ENTER_NAV_DELAY_MS,
      finalizeDelay: HOMEPAGE_ENTER_FINALIZE_DELAY_MS,
    });
    logHomeEnterElementState('sequence:home', homeElement as HTMLElement);
    logHomeEnterElementState('sequence:active-slide', activeSlide as HTMLElement);
    logHomeEnterElementState('sequence:hero-before-reverse', heroContainer as HTMLElement | null);
    logHomeEnterElementState('sequence:logo-before-reverse', homeLogo as HTMLElement | null);
    logHomeEnterElementState('sequence:nav-before-reverse', independentNav as HTMLElement | null);
    logHomeEnterElementState('sequence:button-before-reverse', slideButton as HTMLElement | null);
    logHomeEnterElementState('sequence:text-before-reverse', slideText as HTMLElement | null);

    const probeHomeEnterMotion = (label: string, element: HTMLElement | null | undefined, durationMs = 1200): void => {
      if (!element) return;
      const startedAt = performance.now();
      const samples = new Set<number>([0, 80, 160, 240, 320, 420, 540, 680, 820, 1000, 1200]);
      const logSnapshot = (phase: string, extra: Record<string, unknown> = {}) => {
        const computed = window.getComputedStyle(element);
        console.log('🏠🧪 HOME_ENTER_MOTION', {
          label,
          phase,
          t: Math.round(performance.now() - startedAt),
          classes: element.className,
          inlineTransform: element.style.transform || null,
          inlineTransition: element.style.transition || null,
          transform: computed.transform,
          transition: computed.transition,
          opacity: computed.opacity,
          visibility: computed.visibility,
          ...extra,
        });
      };
      const onTransitionStart = (event: TransitionEvent) => {
        if (event.propertyName !== 'transform') return;
        logSnapshot('transitionstart', { propertyName: event.propertyName, elapsedTime: event.elapsedTime });
      };
      const onTransitionEnd = (event: TransitionEvent) => {
        if (event.propertyName !== 'transform') return;
        logSnapshot('transitionend', { propertyName: event.propertyName, elapsedTime: event.elapsedTime });
      };
      element.addEventListener('transitionstart', onTransitionStart);
      element.addEventListener('transitionend', onTransitionEnd);
      logSnapshot('probe-start');
      samples.forEach((delayMs) => {
        const timeout = setTimeout(() => {
          activeTimeouts.delete(timeout);
          logSnapshot(`sample-${delayMs}`);
        }, delayMs);
        activeTimeouts.add(timeout);
      });
      const cleanup = setTimeout(() => {
        activeTimeouts.delete(cleanup);
        element.removeEventListener('transitionstart', onTransitionStart);
        element.removeEventListener('transitionend', onTransitionEnd);
        logSnapshot('probe-complete');
      }, durationMs + 80);
      activeTimeouts.add(cleanup);
    };

    probeHomeEnterMotion('hero', heroContainer as HTMLElement | null);
    probeHomeEnterMotion('logo', homeLogo as HTMLElement | null);
    probeHomeEnterMotion('nav', independentNav as HTMLElement | null);
    probeHomeEnterMotion('button', slideButton as HTMLElement | null);
    
    // 🔥 CRITICAL: Prepare elements for animation - they're already hidden
    // We'll make them visible when animation starts (in reverseBounce timeout)
    const elementsToAnimate: HTMLElement[] = [];
    
    if (independentNav) {
      elementsToAnimate.push(independentNav as HTMLElement);
    }
    if (fixedShadowBottom) {
      elementsToAnimate.push(fixedShadowBottom as HTMLElement);
    }
    if (homeLogo) {
      elementsToAnimate.push(homeLogo as HTMLElement);
    }
    logoAddons.forEach(addon => {
      if (addon) {
        elementsToAnimate.push(addon as HTMLElement);
      }
    });
    
    // Elements are already hidden - animation will make them visible when it starts
    
    // COMIC POP-IN PROCEDURAL SEQUENCE (REVERSE of exit): Nav → Logo → Text → CTA → Hero
    // Last element that exits is first to enter!
    
    // Navigation and its divider establish almost alongside the main visual.
    if (independentNav) {
      reverseBounce(
        independentNav as HTMLElement,
        HOMEPAGE_ENTER_NAV_DELAY_MS,
        HOMEPAGE_ENTER_NAV_DURATION_MS,
      );
      logger.info('🎯 Navigation and divider cartoonish bounce - EARLY');
    } else {
      logger.warn('⚠️ Navigation not found');
    }
    
    // Shadow animates together with navigation
    if (fixedShadowBottom) {
      reverseBounce(
        fixedShadowBottom as HTMLElement,
        HOMEPAGE_ENTER_NAV_DELAY_MS,
        HOMEPAGE_ENTER_NAV_DURATION_MS,
      );
      logger.info('🌑 Shadow cartoonish bounce - EARLY (with navigation)');
    }
    
    // Logo and shards enter with the hero.
    if (homeLogo) {
      reverseBounce(homeLogo as HTMLElement, HOMEPAGE_ENTER_FIRST_VISUAL_DELAY_MS);
      logger.info('🎨 Step 1: Home logo cartoonish bounce - FIRST');
    } else {
      logger.warn('⚠️ Home logo not found');
    }
    
    // Animate shards together with logo - ALL at the same time as logo (30ms delay)
    // 🔥 iPad FIX: Detect iPad to preserve transform positions during enter animation
    const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;
    
    logoAddons.forEach((addon, index) => {
      if (addon) {
        const addonEl = addon as HTMLElement;
        
        // 🔥 CRITICAL: Clear any inline styles that might hide shards
        addonEl.style.removeProperty('opacity');
        addonEl.style.removeProperty('visibility');
        addonEl.style.removeProperty('transition');
        addonEl.style.removeProperty('display');
        
        // 🔥 iPad FIX: For iPad, use custom timeout to set transform after adding animate-enter class
        if (isIPad) {
          // Set initial state (from scale 0) - NO TRANSITION YET
          addonEl.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
          addonEl.classList.add('animate-enter-initial');
          
          // Force reflow to apply initial state
          void addonEl.offsetHeight;
          
          const timeout = setTimeout(() => {
            activeTimeouts.delete(timeout);
            addonEl.classList.remove('animate-enter-initial');
            addonEl.classList.add('animate-enter');
            
            // 🔥 iPad FIX: Use requestAnimationFrame to ensure CSS class is applied before setting inline styles
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // 🔥 iPad FIX: Set transform position with !important via inline style to override CSS
                // Preserve translateY(-24px) and add scale(1) for enter animation
                addonEl.style.setProperty('transform', 'translateY(-24px) scale(1)', 'important');
                addonEl.style.setProperty('-webkit-transform', 'translateY(-24px) scale(1)', 'important');
                addonEl.style.setProperty('transition', 'transform 0.65s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 'important');
                addonEl.style.setProperty('-webkit-transition', 'transform 0.65s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 'important');
                addonEl.style.setProperty('will-change', 'transform', 'important');
              });
            });
          }, HOMEPAGE_ENTER_FIRST_VISUAL_DELAY_MS);
          activeTimeouts.add(timeout);
        } else {
          reverseBounce(addonEl, HOMEPAGE_ENTER_FIRST_VISUAL_DELAY_MS); // Same delay as logo - no stagger
        }
        
        logger.info(`✨ Step 1: Logo addon ${index + 1} cartoonish bounce - with logo (same time)`);
      }
    });
    
    
    // STEP 3: Slide text, CTA button, and Tagline TOGETHER (0ms delay - ZAJEDNO sa slider enter animacijom)
    // 🔥 USER REQUEST: CTA animacija se treba pojaviti ZAJEDNO sa slider enter animacijom
    const slideTagline = activeSlide.querySelector('.slide-tagline');
    
    // 🔥 FIX: Provjeri da li elementi već imaju animate-enter-initial klasu (postavljenu pri kreiranju slide-a)
    // Ako imaju, samo ukloni animate-enter i animate-exit klase, ne dodavaj animate-enter-initial ponovno
    if (slideText) {
      // 🔥 FIX: Provjeri da li element već ima animate-enter-initial klasu
      // Ako ima, samo ukloni animate-enter i animate-exit klase, NE uklanjaj animate-enter-initial
      const hasInitial = slideText.classList.contains('animate-enter-initial');
      if (hasInitial) {
        // Element već ima animate-enter-initial, samo ukloni ostale klase
        slideText.classList.remove('animate-exit', 'animate-enter', 'animate-reset');
      } else {
        // Element nema animate-enter-initial, postavi ga
        slideText.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
        slideText.classList.add('animate-enter-initial');
      }
      void slideText.offsetHeight; // Force reflow
    }
    
    if (slideButton) {
      // Reset CTA animation classes to ensure scale pop-in (not fade)
      slideButton.classList.remove('animate-exit', 'animate-enter', 'animate-reset', 'animate-enter-initial');
      slideButton.classList.add('animate-enter-initial');
      const ctaController = getRegisteredCta(slideButton as HTMLButtonElement);
      if (ctaController) ctaController.prime('hidden');
      else setHomepageCtaEnterTransform(slideButton, 0, false);
      // 🔥 CRITICAL: Keep button hidden until animation starts (from main.ts)
      // Don't remove opacity/visibility here - animation will make it visible
      void slideButton.offsetHeight; // Force reflow
    }
    
    if (slideTagline) {
      // 🔥 FIX: Provjeri da li element već ima animate-enter-initial klasu
      // Ako ima, samo ukloni animate-enter i animate-exit klase, NE uklanjaj animate-enter-initial
      const hasInitial = (slideTagline as HTMLElement).classList.contains('animate-enter-initial');
      if (hasInitial) {
        // Element već ima animate-enter-initial, samo ukloni ostale klase
        (slideTagline as HTMLElement).classList.remove('animate-exit', 'animate-enter', 'animate-reset');
      } else {
        // Element nema animate-enter-initial, postavi ga
        (slideTagline as HTMLElement).classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
        (slideTagline as HTMLElement).classList.add('animate-enter-initial');
      }
      void (slideTagline as HTMLElement).offsetHeight; // Force reflow
    }
    
    // 🔥 FIX: Pokreni animaciju ZAJEDNO sa slider enter animacijom (0ms delay)
    // Koristi setTimeout sa 0ms za immediate execution, bez double requestAnimationFrame
    const enterTimeout = setTimeout(() => {
      activeTimeouts.delete(enterTimeout);
      if (slideText) {
        slideText.classList.remove('animate-enter-initial');
        slideText.classList.add('animate-enter');
        // 🔥 CRITICAL: Make text visible when animation starts
        // Text was hidden by main.ts, now make it visible for animation
        (slideText as HTMLElement).style.removeProperty('opacity');
        (slideText as HTMLElement).style.removeProperty('visibility');
        (slideText as HTMLElement).style.removeProperty('display');
        logger.info('📝 Step 3: Slide text cartoonish bounce - TOGETHER with CTA');
      } else {
        logger.warn('⚠️ Slide text not found in active slide');
      }
      
      if (slideButton) {
        // Make sure CTA truly starts hidden even if another flow touched it
        slideButton.classList.add('animate-enter-initial');
        // Force reflow so CSS transform reset applies before we remove the class
        void slideButton.offsetHeight;
        slideButton.classList.remove('animate-enter-initial');
        slideButton.classList.add('animate-enter');
        const ctaController = getRegisteredCta(slideButton as HTMLButtonElement);
        if (ctaController) void ctaController.enter();
        else setHomepageCtaEnterTransform(slideButton, 1, true);
        // 🔥 CRITICAL: Make button visible when animation starts
        // Button was hidden by main.ts, now make it visible for animation
        slideButton.style.removeProperty('opacity');
        slideButton.style.removeProperty('visibility');
        slideButton.style.removeProperty('display');
        logger.info('🔘 Step 3: CTA button cartoonish bounce - TOGETHER with text');
      } else {
        logger.warn('⚠️ CTA button not found in active slide');
      }
      
      // Animate tagline together with text and CTA
      if (slideTagline) {
        (slideTagline as HTMLElement).classList.remove('animate-enter-initial');
        (slideTagline as HTMLElement).classList.add('animate-enter');
        // 🔥 CRITICAL: Make tagline visible when animation starts
        // Tagline was hidden by main.ts, now make it visible for animation
        (slideTagline as HTMLElement).style.removeProperty('opacity');
        (slideTagline as HTMLElement).style.removeProperty('visibility');
        (slideTagline as HTMLElement).style.removeProperty('display');
        logger.info('📝 Step 3: Slide tagline cartoonish bounce - TOGETHER with text and CTA');
      }
    }, HOMEPAGE_ENTER_CONTENT_DELAY_MS);
    activeTimeouts.add(enterTimeout);
    
    // Hero enters with the logo as the primary visual.
    if (heroContainer) {
      // 🔥 CRITICAL: Make hero visible when animation starts
      // Hero was hidden by main.ts, now make it visible for animation
      (heroContainer as HTMLElement).style.removeProperty('opacity');
      (heroContainer as HTMLElement).style.removeProperty('visibility');
      (heroContainer as HTMLElement).style.removeProperty('display');
      reverseBounce(heroContainer as HTMLElement, HOMEPAGE_ENTER_FIRST_VISUAL_DELAY_MS);
      logger.info('🖼️ Step 1: Hero image cartoonish bounce - FIRST (with logo)');
    } else {
      logger.warn('⚠️ Hero container not found in active slide');
    }
    
    // CRITICAL: After all animations complete, ensure all elements are at final state
    const finalTimeout = setTimeout(() => {
      activeTimeouts.delete(finalTimeout);
      console.log(HOME_ENTER_DIAG_PREFIX, 'sequence:final-cleanup-start', {
        finalizeDelay: HOMEPAGE_ENTER_FINALIZE_DELAY_MS,
      });
      logHomeEnterElementState('sequence:final-cleanup-hero-before', activeSlide?.querySelector('.hero-container') as HTMLElement | null);
      logHomeEnterElementState('sequence:final-cleanup-logo-before', document.querySelector('#home-logo') as HTMLElement | null);
      logHomeEnterElementState('sequence:final-cleanup-nav-before', document.querySelector('#independent-nav') as HTMLElement | null);
      
      // Clean up elements from active slide + shared elements
      if (activeSlide) {
        const slideElements = [
          activeSlide.querySelector('.hero-container'),
          activeSlide.querySelector('.slide-text'),
          activeSlide.querySelector('.slide-button'),
          activeSlide.querySelector('.slide-tagline')
        ];
        
        // 🔥 iPad FIX: Preserve transform positions after removing animation classes
        const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;
        
        slideElements.forEach(element => {
          if (element) {
            const el = element as HTMLElement;
            
            // 🔥 iPad FIX: Determine preserved transform based on element tag/class/id, not just class
            let preservedTransform = '';
            if (isIPad) {
              // Check by class name, tag name, or id
              const isButton = el.classList.contains('slide-button') || el.tagName === 'BUTTON' || el.id?.includes('btn-');
              const isText = el.classList.contains('slide-text') || el.tagName === 'P' || el.classList.contains('slide-tagline');
              const isTagline = el.classList.contains('slide-tagline');
              
              if (isButton) {
                // 🔥 FIX: Don't set scale(1) - let CSS animation handle it
                // Only set translateY for positioning, scale will be handled by CSS classes
                preservedTransform = 'translateY(0px)';
              } else if (isTagline) {
                preservedTransform = 'translateY(-12px)';
              } else if (isText) {
                preservedTransform = 'translateY(64px)';
              }
            }
            
            removeHomeEnterClassesWithoutTransition(el, preservedTransform || null, Boolean(isIPad && preservedTransform));

            // Clear temporary visibility overrides after animation completes
            el.style.visibility = '';
            el.style.opacity = '';
            el.style.display = '';
            el.style.removeProperty('will-change');
            
            // 🔥 iPad FIX: Restore transform position after removing classes - ALWAYS set on iPad
            if (isIPad && preservedTransform) {
              el.style.setProperty('transform', preservedTransform, 'important');
              el.style.setProperty('-webkit-transform', preservedTransform, 'important');
            } else {
              el.style.removeProperty('transform');
              el.style.removeProperty('-webkit-transform');
              el.style.removeProperty('transition');
              el.style.removeProperty('-webkit-transition');
              el.style.removeProperty('transform-origin');
              el.style.removeProperty('-webkit-transform-origin');
            }
          }
        });
      }
      
      // Clean up shared elements
      const sharedElements = [
        document.querySelector('#independent-nav'),
        document.querySelector('#home-logo'),
        document.getElementById('logo-shards-gore-ljevo'),
        document.getElementById('logo-shards-gore-desno'),
        document.getElementById('logo-shards-dole-ljevi'),
        document.getElementById('logo-shards-dole-desni'),
        document.getElementById('home-fixed-shadow-bottom')
      ];
      
      sharedElements.forEach(element => {
        if (element) {
          const el = element as HTMLElement;
          removeHomeEnterClassesWithoutTransition(el);
          if (el.id !== 'independent-nav') {
            el.style.visibility = '';
            el.style.opacity = '';
            el.style.display = '';
          }
          el.style.removeProperty('transform');
          el.style.removeProperty('-webkit-transform');
          el.style.removeProperty('transition');
          el.style.removeProperty('-webkit-transition');
          el.style.removeProperty('transform-origin');
          el.style.removeProperty('-webkit-transform-origin');
          el.style.removeProperty('will-change');
        }
      });
      
      logger.info('✅ All slider elements set to final state (scale(1) only)');
      commitHomepageNavigation(
        'animations:slider-enter-complete',
        sliderEnterNavigationGeneration ?? undefined,
      );
      logHomeEnterElementState('sequence:final-cleanup-hero-after', activeSlide?.querySelector('.hero-container') as HTMLElement | null);
      logHomeEnterElementState('sequence:final-cleanup-logo-after', document.querySelector('#home-logo') as HTMLElement | null);
      logHomeEnterElementState('sequence:final-cleanup-nav-after', document.querySelector('#independent-nav') as HTMLElement | null);
      settleSliderEnter('complete');
    }, HOMEPAGE_ENTER_FINALIZE_DELAY_MS);
    activeTimeouts.add(finalTimeout);
    
    logger.info('✅ Reverse cartoonish bounce enter animation started');
  } catch (error) {
    logger.error('❌ Failed to start enter animation sequence:', error);
  }
};

// Legacy fallback for enter animation when no active slide is found
function startEnterAnimationSequenceLegacy(): void {
  scheduleHomepageEnterPatternHaptics();
  // Fallback keeps the same canonical order: hero/logo → content → navigation.
  
  // Navigation owns its divider and enters early with the primary visual.
  const independentNav = document.getElementById('independent-nav');
  if (independentNav) {
    reverseBounce(
      independentNav as HTMLElement,
      HOMEPAGE_ENTER_NAV_DELAY_MS,
      HOMEPAGE_ENTER_NAV_DURATION_MS,
    );
    logger.info('🎯 Navigation and divider cartoonish bounce - EARLY (legacy)');
  }
  
  // Shadow animates together with navigation
  const fixedShadowBottom = document.getElementById('home-fixed-shadow-bottom');
  if (fixedShadowBottom) {
    reverseBounce(
      fixedShadowBottom as HTMLElement,
      HOMEPAGE_ENTER_NAV_DELAY_MS,
      HOMEPAGE_ENTER_NAV_DURATION_MS,
    );
    logger.info('🌑 Shadow cartoonish bounce - EARLY (legacy, with navigation)');
  }
  
  // STEP 2: Home logo and shards SECOND (30ms delay)
  const homeLogo = document.querySelector('#home-logo');
  if (homeLogo) {
    reverseBounce(homeLogo as HTMLElement, HOMEPAGE_ENTER_FIRST_VISUAL_DELAY_MS);
    logger.info('🎨 Step 1: Home logo cartoonish bounce - FIRST (legacy)');
  }
  
  // Animate shards together with logo
  const logoAddons = [
    document.getElementById('logo-shards-gore-ljevo'),
    document.getElementById('logo-shards-gore-desno'),
    document.getElementById('logo-shards-dole-ljevi'),
    document.getElementById('logo-shards-dole-desni')
  ];
  
  // 🔥 iPad FIX: Detect iPad to preserve transform positions during enter animation
  const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;
  
  logoAddons.forEach((addon, index) => {
    if (addon) {
      const addonEl = addon as HTMLElement;
      
      // 🔥 iPad FIX: For iPad, use custom timeout to set transform after adding animate-enter class
      if (isIPad) {
        // Set initial state (from scale 0) - NO TRANSITION YET
        addonEl.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
        addonEl.classList.add('animate-enter-initial');
        
        // Force reflow to apply initial state
        void addonEl.offsetHeight;
        
        const timeout = setTimeout(() => {
          activeTimeouts.delete(timeout);
          addonEl.classList.remove('animate-enter-initial');
          addonEl.classList.add('animate-enter');
          
          // 🔥 iPad FIX: Use requestAnimationFrame to ensure CSS class is applied before setting inline styles
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // 🔥 iPad FIX: Set transform position with !important via inline style to override CSS
              // Preserve translateY(-24px) and add scale(1) for enter animation
              addonEl.style.setProperty('transform', 'translateY(-24px) scale(1)', 'important');
              addonEl.style.setProperty('-webkit-transform', 'translateY(-24px) scale(1)', 'important');
              addonEl.style.setProperty('transition', 'transform 0.65s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 'important');
              addonEl.style.setProperty('-webkit-transition', 'transform 0.65s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 'important');
              addonEl.style.setProperty('will-change', 'transform', 'important');
            });
          });
        }, HOMEPAGE_ENTER_FIRST_VISUAL_DELAY_MS + (index * 5)); // Slight stagger for visual effect
        activeTimeouts.add(timeout);
      } else {
        reverseBounce(addonEl, HOMEPAGE_ENTER_FIRST_VISUAL_DELAY_MS + (index * 5)); // Slight stagger for visual effect
      }
      
      logger.info(`✨ Step 1: Logo addon ${index + 1} cartoonish bounce - with logo (legacy)`);
    }
  });
  
  // STEP 3: Slide text, CTA button, and Tagline TOGETHER (60ms delay)
  // Animate all at exactly the same time using the same timeout
  const slideText = document.querySelector('.slide-text');
  const slideButton = document.querySelector('.slide-button') || document.getElementById('btn-home');
  const slideTagline = document.querySelector('.slide-tagline');
  
  if (slideText) {
    slideText.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
    slideText.classList.add('animate-enter-initial');
    void slideText.offsetHeight;
  }
  if (slideButton) {
    slideButton.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
    slideButton.classList.add('animate-enter-initial');
    void slideButton.offsetHeight;
  }
  if (slideTagline) {
    (slideTagline as HTMLElement).classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-enter-complete', 'animate-reset');
    (slideTagline as HTMLElement).classList.add('animate-enter-initial');
    void (slideTagline as HTMLElement).offsetHeight;
  }
  
  const enterTimeout = setTimeout(() => {
    activeTimeouts.delete(enterTimeout);
    if (slideText) {
      slideText.classList.remove('animate-enter-initial');
      slideText.classList.add('animate-enter');
      logger.info('📝 Step 3: Slide text cartoonish bounce - TOGETHER with CTA (legacy)');
    }
    
    if (slideButton) {
      slideButton.classList.remove('animate-enter-initial');
      slideButton.classList.add('animate-enter');
      logger.info('🔘 Step 3: CTA button cartoonish bounce - TOGETHER with text (legacy)');
    }
    
    // Animate tagline together with text and CTA
    if (slideTagline) {
      (slideTagline as HTMLElement).classList.remove('animate-enter-initial');
      (slideTagline as HTMLElement).classList.add('animate-enter');
      // 🔥 FIX: Osigurati da je tagline vidljiv nakon animacije
      (slideTagline as HTMLElement).style.display = 'block';
      (slideTagline as HTMLElement).style.visibility = 'visible';
      (slideTagline as HTMLElement).style.opacity = '1';
      logger.info('📝 Step 3: Slide tagline cartoonish bounce - TOGETHER with text and CTA (legacy)');
  }
  }, HOMEPAGE_ENTER_CONTENT_DELAY_MS);
  activeTimeouts.add(enterTimeout);
  
  // Hero image enters first with the logo.
  const heroContainer = document.querySelector('.hero-container');
  if (heroContainer) {
    reverseBounce(heroContainer as HTMLElement, HOMEPAGE_ENTER_FIRST_VISUAL_DELAY_MS);
    logger.info('🖼️ Step 1: Hero image cartoonish bounce - FIRST (legacy, with logo)');
  }

};

// Debounce function
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: Parameters<T>): void {
    const later = () => {
      clearTimeout(timeout!);
      func(...args);
    };
    clearTimeout(timeout!);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  return function(this: any, ...args: Parameters<T>): void {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};
