import gsap from 'gsap';
import animationManager from '../modules/animation-manager.js';
import {
  rememberJourneyBoardCardBaseTransform,
  restoreJourneyBoardCardBaseTransform,
} from '../modules/journey-card-base-transform.js';

// 🔥 FIX: Track active GSAP tweens for cleanup
const activeCollectiblesTweens: gsap.core.Tween[] = [];
const JOURNEY_VIEWPORT_EXIT_SELECTOR = [
  '.journey-board-card-wrapper',
  '.journey-forest-main-art',
  '.journey-forest-cloud-art',
  '.journey-forest-island-art',
  '.journey-forest-stump-art',
  '.journey-forest-star-art',
].join(', ');
const JOURNEY_VIEWPORT_EXIT_MAX_TARGETS = 42;
const JOURNEY_HEADER_EXIT_LEAD_SECONDS = 0.5;
const JOURNEY_HEADER_EXIT_COMPLETE_PAD = 0.04;

let activeJourneyViewportLock: {
  scrollable: HTMLElement;
  scrollTop: number;
  previousTouchAction: string;
  previousOverscrollBehavior: string;
  previousOverscrollBehaviorY: string;
  previousWebkitOverflowScrolling: string;
  preventMove: (event: Event) => void;
  keepScroll: () => void;
} | null = null;

const trackTween = (target: any, vars: any) => {
  const tween = animationManager.trackExternalTween(gsap.to(target, vars));
  activeCollectiblesTweens.push(tween);

  const originalOnComplete = tween.eventCallback('onComplete');
  tween.eventCallback('onComplete', () => {
    const index = activeCollectiblesTweens.indexOf(tween);
    if (index >= 0) activeCollectiblesTweens.splice(index, 1);
    if (typeof originalOnComplete === 'function') {
      originalOnComplete.call(tween);
    }
  });

  return tween;
};

export function lockJourneyViewportTransition(reason: string = 'journey-transition'): void {
  const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement | null;
  if (!scrollable) return;

  if (activeJourneyViewportLock?.scrollable === scrollable) {
    activeJourneyViewportLock.scrollTop = scrollable.scrollTop;
    return;
  }

  unlockJourneyViewportTransition('replace-lock');

  const scrollTop = scrollable.scrollTop;
  const preventMove = (event: Event): void => {
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
  };
  const keepScroll = (): void => {
    if (!activeJourneyViewportLock) return;
    const targetScrollTop = activeJourneyViewportLock.scrollTop;
    if (Math.abs(scrollable.scrollTop - targetScrollTop) > 0.5) {
      scrollable.scrollTop = targetScrollTop;
    }
  };

  activeJourneyViewportLock = {
    scrollable,
    scrollTop,
    previousTouchAction: scrollable.style.touchAction,
    previousOverscrollBehavior: scrollable.style.overscrollBehavior,
    previousOverscrollBehaviorY: scrollable.style.overscrollBehaviorY,
    previousWebkitOverflowScrolling: scrollable.style.webkitOverflowScrolling,
    preventMove,
    keepScroll,
  };

  try {
    (window as any).__ccJourneyViewportTransitionLocked = true;
    (window as any).__ccJourneyViewportTransitionLockReason = reason;
    (window as any).__ccJourneyScrollTop = scrollTop;
    localStorage.setItem('__ccJourneyScrollTop', String(scrollTop));
  } catch {}

  scrollable.style.touchAction = 'none';
  scrollable.style.overscrollBehavior = 'none';
  scrollable.style.overscrollBehaviorY = 'none';
  scrollable.style.webkitOverflowScrolling = 'auto';
  scrollable.addEventListener('touchmove', preventMove, { passive: false, capture: true });
  scrollable.addEventListener('wheel', preventMove, { passive: false, capture: true });
  scrollable.addEventListener('scroll', keepScroll, { passive: true });
  keepScroll();
}

export function unlockJourneyViewportTransition(reason: string = 'journey-transition-complete'): void {
  const lock = activeJourneyViewportLock;
  if (!lock) return;

  activeJourneyViewportLock = null;
  lock.scrollable.removeEventListener('touchmove', lock.preventMove, true);
  lock.scrollable.removeEventListener('wheel', lock.preventMove, true);
  lock.scrollable.removeEventListener('scroll', lock.keepScroll);
  lock.scrollable.style.touchAction = lock.previousTouchAction;
  lock.scrollable.style.overscrollBehavior = lock.previousOverscrollBehavior;
  lock.scrollable.style.overscrollBehaviorY = lock.previousOverscrollBehaviorY;
  lock.scrollable.style.webkitOverflowScrolling = lock.previousWebkitOverflowScrolling;

  try {
    delete (window as any).__ccJourneyViewportTransitionLocked;
    (window as any).__ccJourneyViewportTransitionUnlockedReason = reason;
  } catch {}
}

function getActiveJourneyBoardAreaId(): number | null {
  try {
    const raw =
      (window as any).__ccLastActiveJourneyBoardAreaId ??
      localStorage.getItem('__ccLastActiveJourneyBoardAreaId');
    const boardId = Number(raw || 0);
    return Number.isFinite(boardId) && boardId > 0 ? boardId : null;
  } catch {
    return null;
  }
}

function isActiveJourneyAreaElement(element: HTMLElement, boardId: number | null): boolean {
  if (!boardId) return false;
  if (element.classList.contains(`journey-forest-island-${boardId}`)) return true;
  if (element.classList.contains(`journey-forest-stump-${boardId}`)) return true;
  if (element.classList.contains(`journey-forest-star-board-${boardId}`)) return true;
  if (element.classList.contains(`journey-forest-cloud-board-${boardId}`)) return true;
  const card = element.matches('.journey-board-card-wrapper')
    ? element.querySelector('.journey-board-card')
    : element.closest('.journey-board-card-wrapper')?.querySelector('.journey-board-card');
  return (card as HTMLElement | null)?.dataset?.boardId === String(boardId);
}

function isElementViewportVisible(element: HTMLElement, viewportMargin = 32): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0.01) {
    return false;
  }
  return rect.bottom >= -viewportMargin &&
    rect.top <= window.innerHeight + viewportMargin &&
    rect.right >= -viewportMargin &&
    rect.left <= window.innerWidth + viewportMargin;
}

function selectJourneyViewportExitTargets(journeyScreen: HTMLElement): HTMLElement[] {
  const activeBoardId = getActiveJourneyBoardAreaId();
  const candidates = Array.from(
    journeyScreen.querySelectorAll(JOURNEY_VIEWPORT_EXIT_SELECTOR)
  ) as HTMLElement[];

  const uniqueTargets = Array.from(new Set(candidates))
    .filter((element) =>
      document.body.contains(element) &&
      !isActiveJourneyAreaElement(element, activeBoardId) &&
      isElementViewportVisible(element)
    )
    .sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      const viewportCenter = window.innerHeight * 0.5;
      return Math.abs((aRect.top + aRect.height * 0.5) - viewportCenter) -
        Math.abs((bRect.top + bRect.height * 0.5) - viewportCenter);
    });

  return uniqueTargets.slice(0, JOURNEY_VIEWPORT_EXIT_MAX_TARGETS);
}

type JourneyExitTargetSnapshot = {
  opacity: string;
  pointerEvents: string;
  transform: string;
  transition: string;
  visibility: string;
  willChange: string;
};

function restoreJourneyExitTargets(
  targets: HTMLElement[],
  snapshots: Map<HTMLElement, JourneyExitTargetSnapshot>
): void {
  targets.forEach((target) => {
    const snapshot = snapshots.get(target);
    try {
      gsap.set(target, {
        scale: 1,
        y: 0,
        clearProps: 'scale,y',
        overwrite: true,
      });
      target.style.opacity = snapshot?.opacity ?? '';
      if (target.classList.contains('journey-robo-alien-beam-art')) {
        target.style.removeProperty('opacity');
      }
      target.style.visibility = snapshot?.visibility ?? '';
      if (target.classList.contains('journey-board-card-wrapper')) {
        restoreJourneyBoardCardBaseTransform(target);
      } else {
        target.style.transform = snapshot?.transform ?? '';
      }
      target.style.transition = snapshot?.transition ?? '';
      target.style.pointerEvents = snapshot?.pointerEvents ?? '';
      target.style.willChange = snapshot?.willChange ?? '';
    } catch {}
  });
}

/**
 * Cleanup all collectibles animations
 * Call this when screen is destroyed or before starting new animations
 */
export function cleanupCollectiblesAnimations(): void {
  unlockJourneyViewportTransition('collectibles-cleanup');
  // Kill all tracked tweens
  activeCollectiblesTweens.forEach(tween => {
    try { tween.kill(); } catch {}
  });
  activeCollectiblesTweens.length = 0;
  
  // Also kill any tweens on collectibles elements
  const journeyScreen = document.getElementById('journey-screen');
  if (journeyScreen) {
    gsap.killTweensOf(journeyScreen);
    const header = journeyScreen.querySelector('.collectibles-header');
    const scrollable = journeyScreen.querySelector('.collectibles-scrollable');
    const cards = journeyScreen.querySelectorAll(
      '.collectible-card, .collectible-card-wrapper, .journey-board-card, .journey-board-card-wrapper'
    );
    
    if (header) gsap.killTweensOf(header);
    if (scrollable) gsap.killTweensOf(scrollable);
    cards.forEach(card => {
      gsap.killTweensOf(card);
      const el = card as HTMLElement;
      el.style.willChange = 'auto';
      if (el.parentElement) {
        el.parentElement.style.removeProperty('contain');
      }
    });
  }
}

/**
 * Animate collectibles screen ENTER with pop-in effects
 * Elements pop in: header first, then scrollable, then first 8 cards from 30% scale (remaining cards instantly visible)
 */
export function animateCollectiblesScreenEnter(): void {
  // Get Journey screen elements
  const journeyScreen = document.getElementById('journey-screen');
  const collectiblesHeader = journeyScreen?.querySelector('.collectibles-header') as HTMLElement;
  const collectiblesScrollable = journeyScreen?.querySelector('.collectibles-scrollable') as HTMLElement;
  
  if (!journeyScreen) {
    console.error('❌ No Journey screen found to animate!');
    return;
  }
  
  // 🔥 CRITICAL: Set initial state - journey screen, header and scrollable scale from 0

  try {
    // 🔥 CRITICAL MOBILE FIX: Use explicit opacity and visibility instead of autoAlpha
    // autoAlpha can have timing issues on mobile - explicit values are more reliable
    // Set initial state IMMEDIATELY with immediateRender: true
    // Do NOT use force3D on journeyScreen — it leaves a transform on the overlay, which makes
    // descendants' position:fixed behave like sticky-to-overlay and the whole header "rubber-bands"
    // when the webview or inner scroll overscrolls.
    gsap.set(journeyScreen, {
      opacity: 0,
      visibility: 'hidden',
      immediateRender: true // 🔥 CRITICAL: Render immediately on mobile
    });
    
    // Header: scale from 0 (pop-in)
    if (collectiblesHeader) {
      gsap.set(collectiblesHeader, { 
        scale: 0, 
        y: 0,
        opacity: 0,
        visibility: 'hidden',
        transformOrigin: '50% 0%',
        force3D: true,
        immediateRender: true
      });
    }

    // Scrollable: whole Journey content pop-in.
    if (collectiblesScrollable) {
      gsap.set(collectiblesScrollable, { 
        scale: 0.78,
        y: 18,
        opacity: 0,
        visibility: 'hidden',
        transformOrigin: '50% 50%',
        force3D: true,
        immediateRender: true
      });
    }

  } catch (error) {
    console.error('❌ Failed to set initial state:', error);
    return;
  }
  
  // 🔥 CRITICAL MOBILE FIX: Fade in journey screen FIRST with explicit opacity/visibility
  // Use explicit values instead of autoAlpha for better mobile compatibility
  // Set visibility: visible immediately, then animate opacity
  gsap.set(journeyScreen, { visibility: 'visible', immediateRender: true });
  trackTween(journeyScreen, {
    opacity: 1,
    duration: 0.3,
    ease: 'power2.out',
    delay: 0,
    immediateRender: false,
    onComplete: () => {
      try {
        gsap.set(journeyScreen, { clearProps: 'transform' });
      } catch {}
    }
  });

  // STEP 1: Header FIRST (0ms delay) - pop-in with scale
  if (collectiblesHeader) {
    // Set visibility first, then animate
    gsap.set(collectiblesHeader, {
      y: 0,
      visibility: 'visible',
      transformOrigin: '50% 0%',
      immediateRender: true,
    });
    trackTween(collectiblesHeader, {
      scale: 1,
      y: 0,
      opacity: 1,
      duration: 0.5,
      ease: 'back.out(1.7)',
      delay: 0,
      force3D: true,
      immediateRender: false,
      onComplete: () => {
        if (collectiblesHeader) {
          try {
            gsap.set(collectiblesHeader, { clearProps: 'transform' });
          } catch {}
        }
      }
    });
  }

  // STEP 2: Scrollable area pop-in (whole Journey content bounce)
  // 🔥 USER REQUEST: Background image (1-17bg) should be visible immediately without animation
  if (collectiblesScrollable) {
    // Find background container and make it visible immediately (no animation)
    const bgContainer = collectiblesScrollable.querySelector('.journey-bg-container') as HTMLElement;
    if (bgContainer) {
      // Kill any animations on background container
      gsap.killTweensOf(bgContainer);
      // Set background container to be visible immediately (no animation)
      // Use inline styles to ensure it's visible even when parent animates
      bgContainer.style.opacity = '1';
      bgContainer.style.visibility = 'visible';
      bgContainer.style.removeProperty('transform');
      bgContainer.style.display = 'block';
    }
    
    // Set visibility first, then animate scrollable container
    gsap.set(collectiblesScrollable, { visibility: 'visible', immediateRender: true });
    trackTween(collectiblesScrollable, {
      scale: 1,
      y: 0,
      opacity: 1,
      duration: 0.54,
      ease: 'back.out(1.75)',
      delay: 0.1,
      force3D: true,
      immediateRender: false,
      onComplete: () => {
        if (collectiblesScrollable) {
          try {
            gsap.set(collectiblesScrollable, { clearProps: 'transform' });
          } catch {}
        }
      }
    });
  }
  
  // STEP 3: Animate first 8 cards in grid (scale from 0.3 to 1.0)
  // 🔥 OPTIMIZED: Only first 8 cards animated, remaining cards set to visible (no animation)
  const cardWrappers = journeyScreen?.querySelectorAll('.collectible-card-wrapper') as NodeListOf<HTMLElement>;
  if (cardWrappers && cardWrappers.length > 0) {
    const cardsArray = Array.from(cardWrappers);

    // Only animate first 8 cards
    const cardsToAnimate = cardsArray.slice(0, 8);

    // Set initial state for animated cards (scale 0.3, opacity 0)
    gsap.set(cardsToAnimate, { 
      scale: 0.3, 
      opacity: 0,
      visibility: 'hidden',
      force3D: true,
      immediateRender: true
    });

    // Set initial state for remaining cards (scale 1, opacity 1 - already visible)
    if (cardsArray.length > 8) {
      const remainingCards = cardsArray.slice(8);
      gsap.set(remainingCards, { 
        scale: 1, 
        opacity: 1,
        visibility: 'visible',
        force3D: true,
        immediateRender: true
      });
    }

    // Animate first 8 cards with fast stagger
    const baseDelay = 0.15;
    const stagger = 0.03;
    cardsToAnimate.forEach((card, index) => {
      const delay = baseDelay + (index * stagger);
      
      // 🔥 GPU OPTIMIZATION: Add will-change for better performance
      card.style.willChange = 'transform, opacity';
      card.style.transform = 'translateZ(0)'; // Force GPU acceleration
      
      gsap.set(card, { visibility: 'visible', immediateRender: true });
      trackTween(card, {
        scale: 1,
        opacity: 1,
        duration: 0.4,
        ease: 'back.out(1.7)',
        delay: delay,
        force3D: true,
        immediateRender: false,
        onComplete: () => {
          // Remove will-change after animation to free resources
          card.style.willChange = 'auto';
        }
      });
    });
  }
}

/**
 * Journey-specific exit for deep maps.
 * It animates only what is inside the current viewport and never scales the
 * full scrollable map, which is expensive on iOS when the map is thousands of
 * pixels tall.
 */
export function animateJourneyViewportScreenExit(reason: string = 'journey-exit'): Promise<void> {
  return new Promise((resolve) => {
    const journeyScreen = document.getElementById('journey-screen') as HTMLElement | null;
    const collectiblesHeader = journeyScreen?.querySelector('.collectibles-header') as HTMLElement | null;

    if (!journeyScreen) {
      console.error('❌ No Journey screen found to animate!');
      resolve();
      return;
    }

    lockJourneyViewportTransition(reason);

    const viewportTargets = selectJourneyViewportExitTargets(journeyScreen);
    const animatedTargets: HTMLElement[] = [];
    const targetSnapshots = new Map<HTMLElement, JourneyExitTargetSnapshot>();
    const completedViewportTargets = new WeakSet<HTMLElement>();
    let pendingViewportTargets = 0;
    let latestViewportExitEnd = 0;
    let viewportExitComplete = false;
    let headerExitComplete = false;
    let exitResolved = false;
    let headerExitStarted = false;

    const completeExit = (): void => {
      if (exitResolved) return;
      exitResolved = true;
      try {
        journeyScreen.style.visibility = 'hidden';
        journeyScreen.style.pointerEvents = 'none';
        journeyScreen.style.willChange = 'auto';
        gsap.set(journeyScreen, { opacity: 0, clearProps: 'transform,scale,y' });
        restoreJourneyExitTargets(animatedTargets, targetSnapshots);
      } catch {}
      resolve();
    };

    const maybeCompleteExit = (): void => {
      if (!viewportExitComplete || !headerExitComplete) return;
      trackTween(journeyScreen, {
        opacity: 1,
        duration: 0.01,
        ease: 'none',
        delay: JOURNEY_HEADER_EXIT_COMPLETE_PAD,
        overwrite: true,
        onComplete: completeExit,
        onInterrupt: completeExit,
      });
    };

    const finishHeaderExit = (): void => {
      headerExitComplete = true;
      maybeCompleteExit();
    };

    const startHeaderExit = (delay = 0): void => {
      if (headerExitStarted) return;
      headerExitStarted = true;
      if (!collectiblesHeader) {
        finishHeaderExit();
        return;
      }

      try {
        gsap.killTweensOf(collectiblesHeader);
        collectiblesHeader.style.willChange = 'transform, opacity';
        collectiblesHeader.style.opacity = '1';
        collectiblesHeader.style.transformOrigin = '50% 0%';
        trackTween(collectiblesHeader, {
          scale: 0,
          opacity: 1,
          y: -18,
          duration: 0.34,
          ease: 'back.in(1.7)',
          delay,
          force3D: true,
          overwrite: true,
          onComplete: finishHeaderExit,
          onInterrupt: finishHeaderExit,
        });
      } catch {
        finishHeaderExit();
      }
    };

    const finishViewportVisualTarget = (target: HTMLElement): void => {
      try {
        target.style.visibility = 'hidden';
        target.style.pointerEvents = 'none';
        gsap.set(target, {
          opacity: 0,
          overwrite: true,
        });
      } catch {}
    };

    const completeViewportTarget = (target: HTMLElement): void => {
      if (completedViewportTargets.has(target)) return;
      completedViewportTargets.add(target);
      finishViewportVisualTarget(target);
      pendingViewportTargets -= 1;
      if (pendingViewportTargets <= 0) {
        viewportExitComplete = true;
        maybeCompleteExit();
      }
    };

    viewportTargets.forEach((target, index) => {
      try {
        gsap.killTweensOf(target);
        rememberJourneyBoardCardBaseTransform(target);
        targetSnapshots.set(target, {
          opacity: target.style.opacity,
          pointerEvents: target.style.pointerEvents,
          transform: target.style.transform,
          transition: target.style.transition,
          visibility: target.style.visibility,
          willChange: target.style.willChange,
        });
        target.style.willChange = 'transform, opacity';
        target.style.pointerEvents = 'none';
        target.style.transition = 'none';

        const isLargeWorldArt = target.classList.contains('journey-forest-main-art');
        const delay = Math.min(0.18, index * 0.012);
        const duration = isLargeWorldArt ? 0.32 : 0.34;
        latestViewportExitEnd = Math.max(latestViewportExitEnd, delay + duration);
        animatedTargets.push(target);
        pendingViewportTargets += 1;

        trackTween(target, {
          opacity: 1,
          scale: isLargeWorldArt ? 0.96 : 0,
          y: isLargeWorldArt ? -18 : 0,
          duration,
          ease: isLargeWorldArt ? 'back.in(1.05)' : 'back.in(1.7)',
          delay,
          force3D: true,
          overwrite: true,
          onComplete: () => completeViewportTarget(target),
          onInterrupt: () => completeViewportTarget(target),
        });
      } catch {}
    });

    if (pendingViewportTargets <= 0) {
      viewportExitComplete = true;
    }
    const headerDelay = Math.max(0, latestViewportExitEnd - JOURNEY_HEADER_EXIT_LEAD_SECONDS);
    startHeaderExit(headerDelay);
  });
}
