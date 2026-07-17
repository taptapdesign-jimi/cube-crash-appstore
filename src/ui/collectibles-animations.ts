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
const JOURNEY_VIEWPORT_EXIT_MAX_TARGETS = 64;
const JOURNEY_VIEWPORT_EXIT_MARGIN_PX = 300;
const JOURNEY_HEADER_EXIT_LEAD_SECONDS = 0.12;
const JOURNEY_HEADER_EXIT_COMPLETE_PAD = 0.12;
const JOURNEY_BACK_BUTTON_HEADER_EXIT_COMPLETE_PAD = 0.02;
const JOURNEY_HEADER_EXIT_DURATION = 0.44;
const JOURNEY_BACK_BUTTON_HEADER_EXIT_DURATION = 0.28;
const JOURNEY_VIEWPORT_EXIT_MIN_SCALE = 0.04;
const JOURNEY_SCREEN_EXIT_TAIL_DURATION = 0.3;
const JOURNEY_SCREEN_EXIT_TAIL_DELAY = 0.02;
const JOURNEY_BACK_BUTTON_SCREEN_EXIT_TAIL_DURATION = 0.16;
const JOURNEY_BACK_BUTTON_SCREEN_EXIT_TAIL_DELAY = 0;

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

  const untrackTween = (): void => {
    const index = activeCollectiblesTweens.indexOf(tween);
    if (index >= 0) activeCollectiblesTweens.splice(index, 1);
  };
  const originalOnComplete = tween.eventCallback('onComplete');
  const originalOnInterrupt = tween.eventCallback('onInterrupt');
  tween.eventCallback('onComplete', () => {
    untrackTween();
    if (typeof originalOnComplete === 'function') {
      originalOnComplete.call(tween);
    }
  });
  tween.eventCallback('onInterrupt', () => {
    untrackTween();
    if (typeof originalOnInterrupt === 'function') {
      originalOnInterrupt.call(tween);
    }
  });

  return tween;
};

export function lockJourneyViewportTransition(reason: string = 'journey-transition'): void {
  const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement | null;
  if (!scrollable) return;

  if (activeJourneyViewportLock?.scrollable === scrollable) {
    activeJourneyViewportLock.scrollTop = scrollable.scrollTop;
    try {
      console.info('🧪 JourneyScrollLock refresh', {
        reason,
        scrollTop: scrollable.scrollTop,
        touchAction: scrollable.style.touchAction,
        overflowY: scrollable.style.overflowY,
      });
    } catch {}
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
  try {
    console.info('🧪 JourneyScrollLock locked', {
      reason,
      scrollTop,
      scrollHeight: scrollable.scrollHeight,
      clientHeight: scrollable.clientHeight,
      touchAction: scrollable.style.touchAction,
      overflowY: scrollable.style.overflowY,
      lockFlag: (window as any).__ccJourneyViewportTransitionLocked === true,
    });
  } catch {}
}

export function unlockJourneyViewportTransition(reason: string = 'journey-transition-complete'): void {
  const lock = activeJourneyViewportLock;
  if (!lock) {
    try {
      const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement | null;
      console.info('🧪 JourneyScrollLock unlock-noop', {
        reason,
        hasScrollable: !!scrollable,
        lockFlag: (window as any).__ccJourneyViewportTransitionLocked === true,
        touchAction: scrollable?.style.touchAction || null,
        overflowY: scrollable?.style.overflowY || null,
      });
    } catch {}
    return;
  }

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
    console.info('🧪 JourneyScrollLock unlocked', {
      reason,
      scrollTop: lock.scrollable.scrollTop,
      scrollHeight: lock.scrollable.scrollHeight,
      clientHeight: lock.scrollable.clientHeight,
      touchAction: lock.scrollable.style.touchAction,
      overflowY: lock.scrollable.style.overflowY,
      lockFlag: (window as any).__ccJourneyViewportTransitionLocked === true,
    });
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

function isActiveJourneyBoardAreaEnterPending(): boolean {
  try {
    return (window as any).__ccJourneyActiveAreaEnterPending === true;
  } catch {
    return false;
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

function selectJourneyViewportExitTargets(journeyScreen: HTMLElement, reason: string): HTMLElement[] {
  const isBackToHomeExit = reason === 'journey-back-button' || reason === 'journey-exit';
  return selectJourneyViewportTransitionTargets(journeyScreen, {
    excludeActiveArea: !isBackToHomeExit,
    includeHiddenPrepared: true,
  });
}

function selectJourneyViewportEnterTargets(journeyScreen: HTMLElement): HTMLElement[] {
  return selectJourneyViewportTransitionTargets(journeyScreen, {
    excludeActiveArea: isActiveJourneyBoardAreaEnterPending(),
    includeHiddenPrepared: true,
  });
}

function selectJourneyViewportTransitionTargets(
  journeyScreen: HTMLElement,
  opts: { excludeActiveArea: boolean; includeHiddenPrepared: boolean }
): HTMLElement[] {
  const activeBoardId = getActiveJourneyBoardAreaId();
  const candidates = Array.from(
    journeyScreen.querySelectorAll(JOURNEY_VIEWPORT_EXIT_SELECTOR)
  ) as HTMLElement[];

  const uniqueTargets = Array.from(new Set(candidates))
    .filter((element) => {
      if (!document.body.contains(element)) return false;
      if (opts.excludeActiveArea && isActiveJourneyAreaElement(element, activeBoardId)) return false;
      if (opts.includeHiddenPrepared && element.dataset.ccJourneyEnterPrepared === 'true') {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom >= -JOURNEY_VIEWPORT_EXIT_MARGIN_PX &&
          rect.top <= window.innerHeight + JOURNEY_VIEWPORT_EXIT_MARGIN_PX &&
          rect.right >= -JOURNEY_VIEWPORT_EXIT_MARGIN_PX &&
          rect.left <= window.innerWidth + JOURNEY_VIEWPORT_EXIT_MARGIN_PX;
      }
      return isElementViewportVisible(element, JOURNEY_VIEWPORT_EXIT_MARGIN_PX);
    })
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
      if (target.classList.contains('journey-board-card-wrapper')) {
        const card = target.querySelector('.journey-board-card') as HTMLElement | null;
        if (card) {
          try {
            gsap.killTweensOf(card);
            gsap.set(card, {
              scale: 1,
              opacity: 1,
              visibility: 'visible',
              clearProps: 'transform,opacity,visibility',
              overwrite: true,
            });
          } catch {}
          card.style.transition = '';
          card.style.willChange = '';
        }
      }
    } catch {}
  });
}

function getJourneyViewportAnimationTarget(target: HTMLElement): HTMLElement {
  if (!target.classList.contains('journey-board-card-wrapper')) return target;
  return (target.querySelector('.journey-board-card') as HTMLElement | null) || target;
}

function prepareJourneyViewportAnimationTarget(target: HTMLElement): HTMLElement {
  const animationTarget = getJourneyViewportAnimationTarget(target);
  if (animationTarget !== target) {
    restoreJourneyBoardCardBaseTransform(target);
    try { gsap.killTweensOf(animationTarget); } catch {}
    animationTarget.style.transformOrigin = '50% 50%';
    animationTarget.style.transition = 'none';
    animationTarget.style.willChange = 'transform, opacity';
    target.style.opacity = '1';
    target.style.visibility = 'visible';
  }
  return animationTarget;
}

function finishJourneyViewportEnterTarget(target: HTMLElement): void {
  try {
    delete target.dataset.ccJourneyEnterPrepared;
    target.style.visibility = 'visible';
    target.style.opacity = '1';
    target.style.pointerEvents = '';
    target.style.transition = '';
    target.style.willChange = 'auto';
    if (target.classList.contains('journey-robo-alien-beam-art')) {
      target.style.removeProperty('opacity');
    }

    if (target.classList.contains('journey-board-card-wrapper')) {
      restoreJourneyBoardCardBaseTransform(target);
      const card = target.querySelector('.journey-board-card') as HTMLElement | null;
      if (card) {
        gsap.set(card, {
          scale: 1,
          opacity: 1,
          y: 0,
          visibility: 'visible',
          clearProps: 'transform,opacity,visibility',
          overwrite: true,
        });
        card.style.transition = '';
        card.style.willChange = '';
      }
      return;
    }

    gsap.set(target, {
      scale: 1,
      opacity: 1,
      y: 0,
      visibility: 'visible',
      clearProps: 'scale,y,visibility',
      overwrite: true,
    });
  } catch {}
}

function getJourneyViewportEnterStart(target: HTMLElement): { scale: number; y: number; duration: number; ease: string } {
  const isLargeWorldArt = target.classList.contains('journey-forest-main-art');
  return {
    scale: isLargeWorldArt ? 1 : 0.66,
    y: isLargeWorldArt ? 12 : 0,
    duration: isLargeWorldArt ? 0.42 : 0.48,
    ease: isLargeWorldArt ? 'power2.out' : 'back.out(1.65)',
  };
}

export function prepareJourneyViewportScreenEnter(reason: string = 'journey-enter-prepare'): void {
  const journeyScreen = document.getElementById('journey-screen') as HTMLElement | null;
  const collectiblesHeader = journeyScreen?.querySelector('.collectibles-header') as HTMLElement | null;
  const collectiblesScrollable = journeyScreen?.querySelector('.collectibles-scrollable') as HTMLElement | null;
  if (!journeyScreen) return;

  try {
    gsap.killTweensOf(journeyScreen);
    journeyScreen.hidden = false;
    journeyScreen.removeAttribute('hidden');
    journeyScreen.classList.remove('hidden');
    journeyScreen.classList.add('show');
    journeyScreen.style.display = 'flex';
    journeyScreen.style.zIndex = '999999';
    gsap.set(journeyScreen, {
      opacity: 0,
      visibility: 'hidden',
      immediateRender: true,
    });
    journeyScreen.style.pointerEvents = 'none';
    journeyScreen.style.willChange = 'opacity';
  } catch {}

  if (collectiblesHeader) {
    try {
      gsap.killTweensOf(collectiblesHeader);
      gsap.set(collectiblesHeader, {
        scale: 0.72,
        y: -8,
        opacity: 0,
        visibility: 'hidden',
        transformOrigin: '50% 0%',
        immediateRender: true,
      });
      collectiblesHeader.style.pointerEvents = 'none';
      collectiblesHeader.style.willChange = 'transform, opacity';
    } catch {}
  }

  if (collectiblesScrollable) {
    try {
      gsap.killTweensOf(collectiblesScrollable);
      gsap.set(collectiblesScrollable, {
        scale: 1,
        y: 0,
        opacity: 1,
        visibility: 'visible',
        clearProps: 'transform',
        immediateRender: true,
      });
      collectiblesScrollable.style.pointerEvents = 'none';
    } catch {}
  }

  const viewportTargets = selectJourneyViewportEnterTargets(journeyScreen);
  viewportTargets.forEach((target) => {
    try {
      gsap.killTweensOf(target);
      rememberJourneyBoardCardBaseTransform(target);
      const animationTarget = prepareJourneyViewportAnimationTarget(target);
      const start = getJourneyViewportEnterStart(target);
      target.dataset.ccJourneyEnterPrepared = 'true';
      target.style.pointerEvents = 'none';
      target.style.transition = 'none';
      target.style.visibility = 'visible';
      target.style.willChange = 'transform, opacity';

      if (animationTarget !== target) {
        target.style.opacity = '1';
        target.style.visibility = 'visible';
        gsap.set(animationTarget, {
          scale: start.scale,
          opacity: 0,
          y: start.y,
          visibility: 'visible',
          transformOrigin: '50% 50%',
          immediateRender: true,
        });
      } else {
        gsap.set(target, {
          scale: start.scale,
          opacity: 0,
          y: start.y,
          visibility: 'visible',
          transformOrigin: '50% 50%',
          immediateRender: true,
        });
      }
    } catch {
      finishJourneyViewportEnterTarget(target);
    }
  });

  try {
    (window as any).__ccJourneyViewportEnterPrepared = true;
    (window as any).__ccJourneyViewportEnterPreparedReason = reason;
  } catch {}
}

function animateJourneyViewportScreenEnter(
  journeyScreen: HTMLElement,
  collectiblesHeader: HTMLElement | null,
  collectiblesScrollable: HTMLElement | null
): Promise<void> {
  const completionPromises: Promise<void>[] = [];
  const waitForTween = (
    target: gsap.TweenTarget,
    vars: gsap.TweenVars,
    complete?: () => void
  ): void => {
    completionPromises.push(new Promise((resolve) => {
      const originalOnComplete = vars.onComplete;
      const originalOnInterrupt = vars.onInterrupt;
      trackTween(target, {
        ...vars,
        onComplete: function (...args: any[]) {
          complete?.();
          if (typeof originalOnComplete === 'function') {
            originalOnComplete.apply(this, args);
          }
          resolve();
        },
        onInterrupt: function (...args: any[]) {
          complete?.();
          if (typeof originalOnInterrupt === 'function') {
            originalOnInterrupt.apply(this, args);
          }
          resolve();
        },
      });
    }));
  };

  const wasPrepared = (() => {
    try {
      return (window as any).__ccJourneyViewportEnterPrepared === true;
    } catch {
      return false;
    }
  })();
  if (!wasPrepared) {
    prepareJourneyViewportScreenEnter('journey-enter-late-prepare');
  }

  try {
    (window as any).__ccJourneyViewportEnterAnimating = true;
  } catch {}

  gsap.set(journeyScreen, {
    opacity: 0,
    visibility: 'visible',
    immediateRender: true,
  });
  journeyScreen.style.pointerEvents = 'none';

  if (collectiblesScrollable) {
    gsap.killTweensOf(collectiblesScrollable);
    gsap.set(collectiblesScrollable, {
      scale: 1,
      y: 0,
      opacity: 1,
      visibility: 'visible',
      clearProps: 'transform',
      immediateRender: true,
    });

    const bgContainer = collectiblesScrollable.querySelector('.journey-bg-container') as HTMLElement | null;
    if (bgContainer) {
      gsap.killTweensOf(bgContainer);
      bgContainer.style.opacity = '1';
      bgContainer.style.visibility = 'visible';
      bgContainer.style.removeProperty('transform');
      bgContainer.style.display = 'block';
    }
  }

  const viewportTargets = selectJourneyViewportEnterTargets(journeyScreen);
  viewportTargets.forEach((target, index) => {
    try {
      const animationTarget = prepareJourneyViewportAnimationTarget(target);
      gsap.killTweensOf(animationTarget);
      rememberJourneyBoardCardBaseTransform(target);
      target.style.pointerEvents = 'none';
      target.style.transition = 'none';
      target.style.visibility = 'visible';
      target.style.willChange = 'transform, opacity';

      const start = getJourneyViewportEnterStart(target);
      const delay = Math.min(0.24, index * 0.018);

      if (animationTarget !== target) {
        target.style.opacity = '1';
        target.style.visibility = 'visible';
        gsap.set(animationTarget, {
          scale: start.scale,
          opacity: 0,
          y: start.y,
          visibility: 'visible',
          transformOrigin: '50% 50%',
          immediateRender: true,
        });
      } else {
        gsap.set(target, {
          scale: start.scale,
          opacity: 0,
          y: start.y,
          visibility: 'visible',
          transformOrigin: '50% 50%',
          immediateRender: true,
        });
      }

      waitForTween(animationTarget, {
        scale: 1,
        opacity: 1,
        y: 0,
        duration: start.duration,
        ease: start.ease,
        delay,
        force3D: true,
        overwrite: true,
      }, () => finishJourneyViewportEnterTarget(target));
    } catch {
      finishJourneyViewportEnterTarget(target);
    }
  });

  waitForTween(journeyScreen, {
    opacity: 1,
    duration: 0.24,
    ease: 'power2.out',
    delay: 0,
    immediateRender: false,
    onComplete: () => {
      try { gsap.set(journeyScreen, { clearProps: 'transform' }); } catch {}
    },
  });

  if (collectiblesHeader) {
    gsap.killTweensOf(collectiblesHeader);
    gsap.set(collectiblesHeader, {
      scale: 0.72,
      y: -8,
      opacity: 0,
      visibility: 'visible',
      transformOrigin: '50% 0%',
      immediateRender: true,
    });
    waitForTween(collectiblesHeader, {
      scale: 1,
      y: 0,
      opacity: 1,
      duration: 0.46,
      ease: 'back.out(1.55)',
      delay: 0.06,
      force3D: true,
      immediateRender: false,
      onComplete: () => {
        try { gsap.set(collectiblesHeader, { clearProps: 'transform' }); } catch {}
      },
    });
  }

  return Promise.all(completionPromises).then(() => {
    try {
      journeyScreen.style.pointerEvents = '';
      if (collectiblesHeader) collectiblesHeader.style.pointerEvents = '';
      if (collectiblesScrollable) collectiblesScrollable.style.pointerEvents = '';
      delete (window as any).__ccJourneyActiveAreaEnterPending;
      delete (window as any).__ccJourneyViewportEnterPrepared;
      delete (window as any).__ccJourneyViewportEnterPreparedReason;
      delete (window as any).__ccJourneyViewportEnterAnimating;
    } catch {}
  });
}

/**
 * Cleanup all collectibles animations
 * Call this when screen is destroyed or before starting new animations
 */
export function cleanupCollectiblesAnimations(): void {
  unlockJourneyViewportTransition('collectibles-cleanup');
  try {
    delete (window as any).__ccJourneyActiveAreaEnterPending;
    delete (window as any).__ccJourneyViewportEnterPrepared;
    delete (window as any).__ccJourneyViewportEnterPreparedReason;
    delete (window as any).__ccJourneyViewportEnterAnimating;
  } catch {}
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
export function animateCollectiblesScreenEnter(): Promise<void> {
  // Get Journey screen elements
  const journeyScreen = document.getElementById('journey-screen');
  const collectiblesHeader = journeyScreen?.querySelector('.collectibles-header') as HTMLElement;
  const collectiblesScrollable = journeyScreen?.querySelector('.collectibles-scrollable') as HTMLElement;
  
  if (!journeyScreen) {
    console.error('❌ No Journey screen found to animate!');
    return Promise.resolve();
  }

  if (journeyScreen.querySelector('.journey-cards-container')) {
    return animateJourneyViewportScreenEnter(journeyScreen, collectiblesHeader || null, collectiblesScrollable || null);
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
    return Promise.resolve();
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

  return Promise.resolve();
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
    const collectiblesScrollable = journeyScreen?.querySelector('.collectibles-scrollable') as HTMLElement | null;
    const isBackButtonReturn = reason === 'journey-back-button';
    const headerExitCompletePad = isBackButtonReturn
      ? JOURNEY_BACK_BUTTON_HEADER_EXIT_COMPLETE_PAD
      : JOURNEY_HEADER_EXIT_COMPLETE_PAD;
    const screenExitTailDuration = isBackButtonReturn
      ? JOURNEY_BACK_BUTTON_SCREEN_EXIT_TAIL_DURATION
      : JOURNEY_SCREEN_EXIT_TAIL_DURATION;
    const screenExitTailDelay = isBackButtonReturn
      ? JOURNEY_BACK_BUTTON_SCREEN_EXIT_TAIL_DELAY
      : JOURNEY_SCREEN_EXIT_TAIL_DELAY;
    const headerExitDuration = isBackButtonReturn
      ? JOURNEY_BACK_BUTTON_HEADER_EXIT_DURATION
      : JOURNEY_HEADER_EXIT_DURATION;

    if (!journeyScreen) {
      console.error('❌ No Journey screen found to animate!');
      resolve();
      return;
    }

    lockJourneyViewportTransition(reason);

    const viewportTargets = selectJourneyViewportExitTargets(journeyScreen, reason);
    try {
      delete (window as any).__ccJourneyActiveAreaEnterPending;
      delete (window as any).__ccJourneyViewportEnterPrepared;
      delete (window as any).__ccJourneyViewportEnterPreparedReason;
    } catch {}
    const animatedTargets: HTMLElement[] = [];
    const targetSnapshots = new Map<HTMLElement, JourneyExitTargetSnapshot>();
    const completedViewportTargets = new WeakSet<HTMLElement>();
    let pendingViewportTargets = 0;
    let latestViewportExitEnd = 0;
    let viewportExitComplete = false;
    let headerExitComplete = false;
    let exitResolved = false;
    let headerExitStarted = false;
    let screenTailStarted = false;

    const completeExit = (): void => {
      if (exitResolved) return;
      exitResolved = true;
      try {
        journeyScreen.style.visibility = 'hidden';
        journeyScreen.style.pointerEvents = 'none';
        journeyScreen.style.willChange = 'auto';
        gsap.set(journeyScreen, { opacity: 0, clearProps: 'transform,scale,y' });
        if (collectiblesScrollable) {
          collectiblesScrollable.style.willChange = 'auto';
          gsap.set(collectiblesScrollable, {
            opacity: 1,
            scale: 1,
            y: 0,
            clearProps: 'transform,opacity,visibility',
            overwrite: true,
          });
        }
        restoreJourneyExitTargets(animatedTargets, targetSnapshots);
      } catch {}
      resolve();
    };

    const startScreenTailExit = (): void => {
      if (screenTailStarted) return;
      screenTailStarted = true;

      if (!collectiblesScrollable) {
	        trackTween(journeyScreen, {
	          opacity: 0,
	          duration: screenExitTailDuration,
	          ease: 'power2.in',
	          delay: screenExitTailDelay,
	          overwrite: true,
	          onComplete: completeExit,
	          onInterrupt: completeExit,
	        });
        return;
      }

      try {
        gsap.killTweensOf(collectiblesScrollable);
        collectiblesScrollable.style.visibility = 'visible';
        collectiblesScrollable.style.willChange = 'transform, opacity';
        collectiblesScrollable.style.transformOrigin = '50% 12%';
	        trackTween(collectiblesScrollable, {
	          opacity: 0,
	          scale: 0.985,
	          y: -10,
	          duration: screenExitTailDuration,
	          ease: 'power2.in',
	          delay: screenExitTailDelay,
	          force3D: true,
	          overwrite: true,
	          onComplete: completeExit,
          onInterrupt: completeExit,
        });
      } catch {
        completeExit();
      }
    };

	    const maybeCompleteExit = (): void => {
	      if (!viewportExitComplete || !headerExitComplete) return;
	      trackTween(journeyScreen, {
	        opacity: 1,
	        duration: 0.01,
	        ease: 'none',
	        delay: headerExitCompletePad,
	        overwrite: true,
	        onComplete: startScreenTailExit,
	        onInterrupt: startScreenTailExit,
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
	        const computed = window.getComputedStyle(collectiblesHeader);
	        const alreadyExited =
	          computed.visibility === 'hidden' ||
	          Number(computed.opacity || '1') <= 0.01 ||
	          collectiblesHeader.style.pointerEvents === 'none';
	        if (alreadyExited) {
	          finishHeaderExit();
	          return;
	        }
	      } catch {}

	      try {
	        gsap.killTweensOf(collectiblesHeader);
        collectiblesHeader.style.willChange = 'transform, opacity';
        collectiblesHeader.style.opacity = '1';
        collectiblesHeader.style.transformOrigin = '50% 0%';
        trackTween(collectiblesHeader, {
	          scale: JOURNEY_VIEWPORT_EXIT_MIN_SCALE,
	          opacity: 0,
	          y: -10,
	          duration: headerExitDuration,
	          ease: 'back.in(1.25)',
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
          scale: target.classList.contains('journey-board-card-wrapper') ? 1 : JOURNEY_VIEWPORT_EXIT_MIN_SCALE,
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
        const animationTarget = prepareJourneyViewportAnimationTarget(target);
        target.style.willChange = 'transform, opacity';
        target.style.pointerEvents = 'none';
        target.style.transition = 'none';
        target.style.visibility = 'visible';
        target.style.opacity = '1';
        try {
          gsap.set(animationTarget, {
            scale: 1,
            opacity: 1,
            y: 0,
            visibility: 'visible',
            transformOrigin: '50% 50%',
            force3D: true,
            overwrite: true,
          });
        } catch {}

        const isLargeWorldArt = target.classList.contains('journey-forest-main-art');
        const delay = Math.min(0.18, index * 0.012);
        const duration = isLargeWorldArt ? 0.42 : 0.44;
        latestViewportExitEnd = Math.max(latestViewportExitEnd, delay + duration);
        animatedTargets.push(target);
        pendingViewportTargets += 1;

        trackTween(animationTarget, {
          opacity: 0,
          scale: isLargeWorldArt ? 1 : JOURNEY_VIEWPORT_EXIT_MIN_SCALE,
          y: isLargeWorldArt ? 18 : 0,
          duration,
          ease: isLargeWorldArt ? 'back.in(1.15)' : 'back.in(1.25)',
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
    const headerDelay = isBackButtonReturn ? 0 : Math.max(0, latestViewportExitEnd - JOURNEY_HEADER_EXIT_LEAD_SECONDS);
    startHeaderExit(headerDelay);
  });
}
