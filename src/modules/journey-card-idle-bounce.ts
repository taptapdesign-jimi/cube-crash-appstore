/**
 * Journey Card Idle Bounce Animation Module
 * 
 * Random idle animations for unlocked journey cards when screen is idle
 * Similar to tile-idle-bounce.ts but for HTML DOM elements
 */

import { gsap } from 'gsap';
import { domElementPool } from './dom-element-pool.js';

const ENABLE_JOURNEY_CARD_IDLE_BOUNCE = true;

const IDLE_WAIT_TIME = 0;  // No idle wait - start immediately
const MIN_ANIMATION_INTERVAL = 100; // Minimum interval: 0.1s
const MAX_ANIMATION_INTERVAL = 300; // Maximum interval: 0.3s
const MAX_CONCURRENT_ANIMATIONS = 3; // 🔥 iOS OPTIMIZATION: Max 3 concurrent animations to prevent frame drops

// Card dimensions (from journey-boards-manager.ts)
const STANDARD_CARD_WIDTH = 109.82;
const STANDARD_CARD_HEIGHT = 150;
const CARD_ASPECT_RATIO = STANDARD_CARD_WIDTH / STANDARD_CARD_HEIGHT; // ~0.73

interface JourneyCardIdleState {
  cards: HTMLElement[];
  container: HTMLElement | null;
  isActive: boolean;
  lastInteractionTime: number;
  animationTimer: number | null;
  activeAnimations: Set<HTMLElement>;
  smokeContainers: Set<HTMLElement>; // 🔥 MEMORY FIX: Track all smoke containers for cleanup
  isBlockingHorizontal: boolean; // 🔥 iOS FIX: Flag to block horizontal scrolling during animations
  horizontalScrollPreventer: ((e: TouchEvent) => void) | null; // 🔥 iOS FIX: Global preventer function
  viewedCards: Set<HTMLElement>; // 🔥 USER REQUEST: Track cards that have been viewed in detail modal (stop animations forever)
  shimmerTimers: Map<HTMLElement, number>; // Idle shimmer timers per card
}

let state: JourneyCardIdleState = {
  cards: [],
  container: null,
  isActive: false,
  lastInteractionTime: 0,
  animationTimer: null,
  activeAnimations: new Set(),
  smokeContainers: new Set(), // 🔥 MEMORY FIX: Track smoke containers
  isBlockingHorizontal: false, // 🔥 iOS FIX: Block horizontal scrolling during animations
  horizontalScrollPreventer: null, // 🔥 iOS FIX: Global preventer function
  viewedCards: new Set(), // 🔥 USER REQUEST: Track viewed cards
  shimmerTimers: new Map()
};

export function startJourneyCardIdleBounce(container: HTMLElement | null): void {
  if (!ENABLE_JOURNEY_CARD_IDLE_BOUNCE) return;
  if (!container) return;
  
  // 🔥 USER REQUEST: Get all unlocked AND interim cards (cards with 'unlocked' or 'interim' class)
  // Interim cards should also have idle bounce and smoke animations
  const unlockedCards = container.querySelectorAll('.journey-board-card.unlocked') as NodeListOf<HTMLElement>;
  const interimCards = container.querySelectorAll('.journey-board-card.interim') as NodeListOf<HTMLElement>;
  const allCards = Array.from(unlockedCards).concat(Array.from(interimCards));
  
  // 🔥 USER REQUEST: Restore viewed boards from localStorage (persistence across game sessions)
  let viewedBoardIds: Set<string> = new Set();
  try {
    const viewedBoardsJson = localStorage.getItem('journey_viewed_boards');
    if (viewedBoardsJson) {
      viewedBoardIds = new Set(JSON.parse(viewedBoardsJson));
      console.log('✅ Restored viewed boards from localStorage:', Array.from(viewedBoardIds));
    }
  } catch (e) {
    console.warn('⚠️ Error reading viewed boards from localStorage:', e);
  }
  
  // 🔥 USER REQUEST: Mark cards as viewed based on localStorage and data attributes
  // Cards that have been viewed should not animate
  allCards.forEach(card => {
    const boardId = card.getAttribute('data-board-id');
    const hasDataAttribute = card.getAttribute('data-journey-card-viewed') === 'true';
    const isInLocalStorage = boardId && viewedBoardIds.has(boardId);
    
    if (hasDataAttribute || isInLocalStorage) {
      state.viewedCards.add(card);
      // Ensure data attribute is set for consistency
      card.setAttribute('data-journey-card-viewed', 'true');
    }
  });
  
  // 🔥 USER REQUEST: Filter out viewed cards AND interim cards (interim cards have independent animation)
  // Interim cards are now handled separately in journey-boards-manager.ts
  state.cards = allCards.filter(card => {
    if (!card || !card.parentElement) return false;
    const isInterim = card.classList.contains('interim');
    if (isInterim) return false; // 🔥 USER REQUEST: Exclude interim cards (they have independent animation)
    return !state.viewedCards.has(card); // Exclude viewed unlocked cards
  });
  
  state.container = container;
  state.isActive = true;
  state.lastInteractionTime = 0; // No idle tracking needed
  state.activeAnimations = new Set();
  
  // Start immediately - no idle wait
  animateRandomCard();
  
  console.log('✅ Journey card bounce started (continuous):', state.cards.length, 'cards (unlocked + interim, excluding viewed)');
}

export function stopJourneyCardIdleBounce(): void {
  state.isActive = false;
  
  if (state.animationTimer) {
    clearTimeout(state.animationTimer);
    state.animationTimer = null;
  }
  
  // 🔥 MEMORY FIX: Stop all active card animations
  state.activeAnimations.forEach(card => {
    stopCardAnimation(card);
  });
  state.activeAnimations.clear();
  
  // 🔥 iOS FIX: Remove global horizontal scroll preventer
  if (state.horizontalScrollPreventer) {
    const scrollable = document.querySelector('.collectibles-scrollable') as HTMLElement;
    const body = document.body;
    const html = document.documentElement;
    
    if (scrollable) {
      // 🔥 iOS OPTIMIZATION: Remove both handlers (touchstart and touchmove are separate)
      const touchStartHandler = (state as any)._touchStartHandler;
      if (touchStartHandler) {
        scrollable.removeEventListener('touchstart', touchStartHandler, { capture: true } as any);
        delete (state as any)._touchStartHandler;
      }
      scrollable.removeEventListener('touchmove', state.horizontalScrollPreventer, { capture: true } as any);
    }
    
    // 🔥 FIX: Only remove from scrollable (body/html listeners are commented out)
    // body.removeEventListener('touchstart', state.horizontalScrollPreventer, { capture: true } as any);
    // body.removeEventListener('touchmove', state.horizontalScrollPreventer, { capture: true } as any);
    // html.removeEventListener('touchstart', state.horizontalScrollPreventer, { capture: true } as any);
    // html.removeEventListener('touchmove', state.horizontalScrollPreventer, { capture: true } as any);
    
    // Restore original touch-action
    if ((body as any)._originalTouchAction !== undefined) {
      body.style.touchAction = (body as any)._originalTouchAction;
      delete (body as any)._originalTouchAction;
    }
    if ((html as any)._originalTouchAction !== undefined) {
      html.style.touchAction = (html as any)._originalTouchAction;
      delete (html as any)._originalTouchAction;
    }
    
    state.horizontalScrollPreventer = null;
  }
  state.isBlockingHorizontal = false;
  
  // 🔥 MEMORY FIX: Clean up all smoke containers
  state.smokeContainers.forEach(smokeContainer => {
    try {
      // Kill cleanup timer if it exists
      if ((smokeContainer as any)._cleanupTimer) {
        try {
          (smokeContainer as any)._cleanupTimer.kill();
        } catch {}
        (smokeContainer as any)._cleanupTimer = null;
      }
      // Kill any GSAP animations on smoke container
      gsap.killTweensOf(smokeContainer);
      // Kill animations on all children (smoke particles + halo)
      const children = smokeContainer.querySelectorAll('*');
      children.forEach(child => {
        gsap.killTweensOf(child);
        // 🔥 MEMORY FIX: Release smoke particles back to pool if they exist
        if (child.classList && child.classList.length === 0) {
          // Likely a smoke particle - try to release to pool
          try {
            domElementPool.release(child as HTMLElement);
          } catch {}
        }
      });
      // Remove from DOM
      if (smokeContainer && smokeContainer.parentNode) {
        smokeContainer.parentNode.removeChild(smokeContainer);
      }
    } catch (e) {
      console.warn('⚠️ Error cleaning up smoke container:', e);
    }
  });
  state.smokeContainers.clear();

  // Stop shimmer timers and remove shimmer class from all tracked cards
  state.shimmerTimers.forEach((timeoutId, card) => {
    try {
      clearTimeout(timeoutId);
      card.classList.remove('idle-shimmer-trigger');
    } catch {}
  });
  state.shimmerTimers.clear();
  
  console.log('⏹️ Journey card idle bounce stopped');
}

export function resetJourneyCardIdleBounce(): void {
  stopJourneyCardIdleBounce();
  state.cards = [];
  state.container = null;
  state.lastInteractionTime = 0;
  state.viewedCards.clear(); // 🔥 USER REQUEST: Clear viewed cards on reset
  state.shimmerTimers.clear();
  // smokeContainers already cleared in stopJourneyCardIdleBounce
  
  // 🔥 PERFORMANCE: Clear DOM element pool on reset (optional - pool can persist)
  // Uncomment if you want to clear pool on reset:
  // domElementPool.clear();
  
  console.log('🔄 Journey card idle bounce state reset');
}

/**
 * 🔥 USER REQUEST: Mark a card as viewed (details modal was opened)
 * This will stop animations for this card forever
 * @param card - The card element that was viewed
 */
export function markCardAsViewed(card: HTMLElement | null): void {
  if (!card) return;
  
  // Stop any active animation on this card immediately
  stopCardAnimation(card);

  // Stop shimmer timer for this card
  const shimmerTimeout = state.shimmerTimers.get(card);
  if (shimmerTimeout) {
    clearTimeout(shimmerTimeout);
    state.shimmerTimers.delete(card);
  }
  card.classList.remove('idle-shimmer-trigger');
  
  // Mark card as viewed (will be excluded from future animations)
  state.viewedCards.add(card);
  
  // Add data attribute for persistence (optional - can be used for page reload)
  card.setAttribute('data-journey-card-viewed', 'true');
  
  // 🔥 USER REQUEST: Save board ID to localStorage for persistence across game sessions
  const boardId = card.getAttribute('data-board-id');
  if (boardId) {
    try {
      const viewedBoardsJson = localStorage.getItem('journey_viewed_boards');
      const viewedBoards: Set<string> = viewedBoardsJson ? new Set(JSON.parse(viewedBoardsJson)) : new Set();
      viewedBoards.add(boardId);
      localStorage.setItem('journey_viewed_boards', JSON.stringify(Array.from(viewedBoards)));
      console.log('✅ Board ID saved to localStorage:', boardId);
    } catch (e) {
      console.warn('⚠️ Error saving viewed board to localStorage:', e);
    }
  }
  
  console.log('✅ Card marked as viewed - animations stopped forever:', card);
}

export function notifyJourneyInteraction(): void {
  // No need to stop animations on interaction - they continue regardless
  // Just update last interaction time (not used anymore but kept for compatibility)
  state.lastInteractionTime = Date.now();
}

function syncIdleShimmers(): void {
  // Eligible: unlocked, not viewed, not interim, visible, and currently tracked in state.cards
  const eligible = state.cards.filter(card => {
    if (!card || !card.parentElement || card.offsetParent === null) return false;
    if (card.classList.contains('interim')) return false;
    if (state.viewedCards.has(card)) return false;
    return card.classList.contains('journey-board-card');
  });
  const eligibleSet = new Set(eligible);
  
  // Stop timers for cards no longer eligible
  state.shimmerTimers.forEach((_timeoutId, card) => {
    if (!eligibleSet.has(card)) {
      stopIdleShimmerForCard(card);
    }
  });
  
  // Start timers for new eligible cards
  eligible.forEach(card => {
    if (!state.shimmerTimers.has(card)) {
      startIdleShimmerForCard(card);
    }
  });
}

function startIdleShimmerForCard(card: HTMLElement): void {
  // Randomize initial start so cards don't sync
  const initialDelay = 200 + Math.random() * 1200; // 0.2s - 1.4s
  
  const scheduleNext = (delay: number) => {
    const timeoutId = window.setTimeout(() => {
      // If card became ineligible, stop scheduling
      if (!state.isActive || !card.parentElement || card.offsetParent === null || state.viewedCards.has(card) || card.classList.contains('interim')) {
        stopIdleShimmerForCard(card);
        return;
      }
      
      triggerIdleShimmer(card);
      
      // Fixed 2s cadence after first random start
      scheduleNext(2000);
    }, delay);
    
    state.shimmerTimers.set(card, timeoutId);
  };
  
  scheduleNext(initialDelay);
}

function stopIdleShimmerForCard(card: HTMLElement): void {
  const timeoutId = state.shimmerTimers.get(card);
  if (timeoutId) {
    clearTimeout(timeoutId);
    state.shimmerTimers.delete(card);
  }
  try {
    card.classList.remove('idle-shimmer-trigger');
  } catch {}
}

function triggerIdleShimmer(card: HTMLElement): void {
  // Reset class to restart CSS animation
  card.classList.remove('idle-shimmer-trigger');
  void card.offsetHeight; // force reflow
  
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!state.isActive || !card.parentElement || card.offsetParent === null || state.viewedCards.has(card) || card.classList.contains('interim')) {
        return;
      }
      card.classList.add('idle-shimmer-trigger');
    });
  });
}

function animateRandomCard(): void {
  if (!state.isActive || !state.container) return;
  
  // 🔥 USER REQUEST: Refresh card list (in case cards were added/removed)
  // Include both unlocked AND interim cards
  const unlockedCards = state.container.querySelectorAll('.journey-board-card.unlocked') as NodeListOf<HTMLElement>;
  const interimCards = state.container.querySelectorAll('.journey-board-card.interim') as NodeListOf<HTMLElement>;
  const allCards = Array.from(unlockedCards).concat(Array.from(interimCards));
  
  // 🔥 USER REQUEST: Restore viewed boards from localStorage (in case cards were re-rendered)
  let viewedBoardIds: Set<string> = new Set();
  try {
    const viewedBoardsJson = localStorage.getItem('journey_viewed_boards');
    if (viewedBoardsJson) {
      viewedBoardIds = new Set(JSON.parse(viewedBoardsJson));
    }
  } catch (e) {
    console.warn('⚠️ Error reading viewed boards from localStorage:', e);
  }
  
  // 🔥 USER REQUEST: Update viewedCards set with cards that are in localStorage
  allCards.forEach(card => {
    const boardId = card.getAttribute('data-board-id');
    const isInLocalStorage = boardId && viewedBoardIds.has(boardId);
    if (isInLocalStorage && !state.viewedCards.has(card)) {
      state.viewedCards.add(card);
      card.setAttribute('data-journey-card-viewed', 'true');
    }
  });
  
  // 🔥 USER REQUEST: Filter out cards that have been viewed in detail modal
  // 🔥 CRITICAL FIX: Exclude interim cards - they have independent animation in journey-boards-manager.ts
  state.cards = allCards.filter(card => {
    if (!card || !card.parentElement || card.offsetParent === null) return false;
    if (state.activeAnimations.has(card)) return false;
    
    // 🔥 CRITICAL FIX: Exclude interim cards - they have independent animation in journey-boards-manager.ts
    const isInterim = card.classList.contains('interim');
    if (isInterim) return false; // Exclude interim cards (they have independent animation)
    
    // 🔥 USER REQUEST: Exclude unlocked cards that have been viewed in detail modal
    if (state.viewedCards.has(card)) return false; // Exclude viewed cards
    
    return true;
  });

  // 🔥 NEW: Start/stop idle shimmer per card (unlocked only, non-viewed, non-interim)
  syncIdleShimmers();
  
  if (state.cards.length === 0) {
    // Retry after random interval if no cards available
    const retryDelay = MIN_ANIMATION_INTERVAL + Math.random() * (MAX_ANIMATION_INTERVAL - MIN_ANIMATION_INTERVAL);
    state.animationTimer = setTimeout(animateRandomCard, retryDelay);
    return;
  }
  
  // 🔥 iOS OPTIMIZATION: Limit concurrent animations to prevent frame drops
  // If we already have max concurrent animations, wait before starting new one
  if (state.activeAnimations.size >= MAX_CONCURRENT_ANIMATIONS) {
    // Wait a bit longer before retrying (to allow current animations to finish)
    const retryDelay = MIN_ANIMATION_INTERVAL + Math.random() * (MAX_ANIMATION_INTERVAL - MIN_ANIMATION_INTERVAL);
    state.animationTimer = setTimeout(animateRandomCard, retryDelay);
    return;
  }
  
  // Pick random card
  const randomCard = state.cards[Math.floor(Math.random() * state.cards.length)];
  
  if (randomCard) {
    animateCard(randomCard);
  }
  
  // 🔥 FIX: Each card gets a different random interval between 300ms and 2000ms
  // This ensures animations never happen all at once, but are spread out
  const nextDelay = MIN_ANIMATION_INTERVAL + Math.random() * (MAX_ANIMATION_INTERVAL - MIN_ANIMATION_INTERVAL);
  state.animationTimer = setTimeout(animateRandomCard, nextDelay);
}

function animateCard(card: HTMLElement): void {
  if (!card || !card.parentElement) return;
  
  // 🔥 CRITICAL FIX: Don't animate interim cards - they have independent animation in journey-boards-manager.ts
  if (card.classList.contains('interim')) {
    console.log('⚠️ Skipping animateCard for interim card (has independent animation)');
    return;
  }
  
  state.activeAnimations.add(card);
  
  // Get card wrapper (parent element that has transform)
  const cardWrapper = card.closest('.journey-board-card-wrapper') as HTMLElement;
  if (!cardWrapper) return;
  
  // 🔥 FIX: Store original transform COMPLETELY (including translateX if present)
  // This is needed to restore the card to its exact original position after animation
  const originalTransform = cardWrapper.style.transform || '';
  
  // Parse original rotation from transform string
  // Format can be: "rotate(Xdeg)" or "translateX(-50%) rotate(Xdeg)"
  let originalRotation = 0;
  const rotationMatch = originalTransform.match(/rotate\(([^)]+)\)/);
  if (rotationMatch && rotationMatch[1]) {
    const rotationValue = rotationMatch[1].trim().replace('deg', '');
    originalRotation = parseFloat(rotationValue) || 0;
  }
  
  // Fallback: try computed style if inline style doesn't have rotation
  if (originalRotation === 0 && originalTransform === '') {
    const computedStyle = window.getComputedStyle(cardWrapper);
    const computedTransform = computedStyle.transform;
    if (computedTransform && computedTransform !== 'none') {
      const rotationMatchComputed = computedTransform.match(/rotate\(([^)]+)\)/);
      if (rotationMatchComputed && rotationMatchComputed[1]) {
        const rotationValue = rotationMatchComputed[1].trim().replace('deg', '');
        originalRotation = parseFloat(rotationValue) || 0;
      }
    }
  }
  
  // Store original transform for restoration
  (cardWrapper as any)._originalTransform = originalTransform;
  
  // Random tilt angle: 1-5 degrees left or right
  const tiltDirection = Math.random() > 0.5 ? 1 : -1;
  const tiltDegrees = 1 + Math.random() * 4; // 1-5 degrees
  
  // 🔥 iOS FIX: Prevent horizontal scrolling during animation
  // Use global state-based approach to block horizontal scrolling during ALL animations
  const scrollable = document.querySelector('.collectibles-scrollable') as HTMLElement;
  const body = document.body;
  const html = document.documentElement;
  
  // Enable blocking for this animation
  state.isBlockingHorizontal = true;
  
  // Create or reuse global preventer function
  if (!state.horizontalScrollPreventer) {
    // 🔥 iOS OPTIMIZATION: Use state object instead of closure variables for better performance
    const touchState = {
      startX: 0,
      startY: 0,
      startTime: 0
    };
    
    // 🔥 iOS OPTIMIZATION: Separate handlers for better performance
    // touchstart can be passive (faster) - we just track position
    const touchStartHandler = (e: TouchEvent) => {
      if (!state.isBlockingHorizontal) return;
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        touchState.startX = touch.clientX;
        touchState.startY = touch.clientY;
        touchState.startTime = performance.now(); // 🔥 OPTIMIZATION: Use performance.now() instead of Date.now()
      }
    };
    
    // touchmove needs passive: false only when we actually preventDefault
    state.horizontalScrollPreventer = (e: TouchEvent) => {
      if (!state.isBlockingHorizontal) return; // Early exit - no blocking needed
      
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchState.startX);
        const deltaY = Math.abs(touch.clientY - touchState.startY);
        
        // 🔥 iOS OPTIMIZATION: Fast path - if vertical is clearly dominant, don't even check
        // This allows fast vertical scrolling without any overhead
        if (deltaY > deltaX * 1.2) {
          return; // Vertical scroll - allow immediately, no blocking
        }
        
        // 🔥 FIX: Only block if horizontal movement is clearly dominant
        // Horizontal must be 1.5x greater than vertical AND at least 10px
        const isHorizontalDominant = deltaX > deltaY * 1.5;
        const isSignificantHorizontal = deltaX > 10;
        
        // Only block if horizontal is clearly the primary direction
        if (isSignificantHorizontal && isHorizontalDominant) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
      }
    };
    
    // 🔥 iOS OPTIMIZATION: touchstart can be passive (faster) - we don't preventDefault on touchstart
    // Only touchmove needs passive: false when we actually block
    if (scrollable) {
      scrollable.addEventListener('touchstart', touchStartHandler, { passive: true, capture: true });
      scrollable.addEventListener('touchmove', state.horizontalScrollPreventer, { passive: false, capture: true });
      
      // Store touchStartHandler for cleanup
      (state as any)._touchStartHandler = touchStartHandler;
    }
    
    // 🔥 iOS OPTIMIZATION: Use CSS touch-action instead of JS handlers on body/html
    // This is more performant and doesn't require event listeners
    const originalBodyTouchAction = body.style.touchAction || '';
    const originalHtmlTouchAction = html.style.touchAction || '';
    body.style.touchAction = 'pan-y'; // Only vertical panning
    html.style.touchAction = 'pan-y'; // Only vertical panning
    
    // Store original values for cleanup
    (body as any)._originalTouchAction = originalBodyTouchAction;
    (html as any)._originalTouchAction = originalHtmlTouchAction;
  }
  
  // Store timeline reference on card for cleanup
  const tl = gsap.timeline({
    onComplete: () => {
      state.activeAnimations.delete(card);
      (card as any)._idleBounceTl = null;
      
      // 🔥 iOS FIX: Stop blocking horizontal scroll after animation (only if no other animations active)
      if (state.activeAnimations.size === 0) {
        state.isBlockingHorizontal = false;
      }
    }
  });
  (card as any)._idleBounceTl = tl;
  
  // Phase 1: Scale up with rotation - fast 0.1s
  // Use transform-origin: center to scale from center
  const baseScale = 1;
  const scaleUp = 1.05;
  
  // 🔥 iOS FIX: Disable touch actions during animation to prevent horizontal scrolling
  const originalTouchAction = cardWrapper.style.touchAction || '';
  cardWrapper.style.touchAction = 'none'; // Prevent all touch gestures during animation
  cardWrapper.style.webkitTouchCallout = 'none'; // iOS Safari specific
  
  // 🔥 PERFORMANCE: Enable hardware acceleration for card animation
  const originalWillChange = cardWrapper.style.willChange || '';
  cardWrapper.style.willChange = 'transform';
  
  tl.to(cardWrapper, {
    scale: scaleUp,
    rotation: originalRotation + tiltDegrees * tiltDirection,
    duration: 0.1,
    ease: 'power2.out',
    transformOrigin: 'center center',
    onComplete: () => {
      // Remove will-change after animation for better performance
      if (!originalWillChange) {
        cardWrapper.style.willChange = '';
      } else {
        cardWrapper.style.willChange = originalWillChange;
      }
    }
  });
  
  // Phase 2: Return to scale and rotation - fast 0.1s
  tl.to(cardWrapper, {
    scale: baseScale,
    rotation: originalRotation,
    duration: 0.1,
    ease: 'power2.in',
    transformOrigin: 'center center',
    onComplete: () => {
      // 🔥 FIX: Restore original transform completely (including translateX if present)
      // GSAP may have modified the transform, so we need to restore it exactly
      const storedTransform = (cardWrapper as any)._originalTransform;
      if (storedTransform) {
        // Remove GSAP's scale and rotation, restore original
        cardWrapper.style.transform = storedTransform;
      } else {
        // Fallback: just remove scale, keep rotation
        const currentTransform = cardWrapper.style.transform || '';
        const cleanedTransform = currentTransform
          .replace(/scale\([^)]+\)/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleanedTransform) {
          cardWrapper.style.transform = cleanedTransform;
        }
      }
      
      // Restore original touch action after animation
      if (originalTouchAction) {
        cardWrapper.style.touchAction = originalTouchAction;
      } else {
        cardWrapper.style.touchAction = '';
      }
      cardWrapper.style.webkitTouchCallout = '';
      
      // Clean up stored transform
      delete (cardWrapper as any)._originalTransform;
    }
  });
  
  // Activate smoke bubbles at 0.1s (peak of animation)
  // 🔥 CRITICAL FIX: Skip smoke for interim cards (they have independent animation in journey-boards-manager.ts)
  tl.call(() => {
    if (card && card.parentElement) {
      // 🔥 CRITICAL FIX: Don't generate smoke for interim cards - they have their own bounce animation
      if (card.classList.contains('interim')) {
        console.log('⚠️ Skipping smoke for interim card in animateCard (has independent animation)');
        return;
      }
      
      // 🔥 FIX: Generate random alpha value between 0.7 and 1.0 for each animation
      // This adds randomness and variety to smoke effects
      const randomAlpha = 0.7 + Math.random() * 0.3; // Random between 0.7 and 1.0
      
      smokeBubblesAtCard(card, {
        sizeScale: 0.55, // 🔥 USER REQUEST: Increased from 0.18 to 0.55 for better quality (similar to tiles)
        distanceScale: 0.55, // 🔥 USER REQUEST: Increased from 0.18 to 0.55 for better quality (similar to tiles)
        countScale: 0.45, // 🔥 USER REQUEST: Increased from 0.2 to 0.45 for more particles (better quality)
        haloScale: 0.55, // 🔥 USER REQUEST: Increased from 0.18 to 0.55 for better halo
        strength: 1.8 + Math.random() * 0.7, // ~100% jače
        trailAlpha: randomAlpha, // Random alpha for trail/plume (0.8-1.0)
        baseAlpha: randomAlpha // Random alpha for base smoke particles (0.8-1.0)
      });
    }
  }, null, 0.1);
}

function stopCardAnimation(card: HTMLElement): void {
  if (!card) return;
  
  try {
    const cardWrapper = card.closest('.journey-board-card-wrapper') as HTMLElement;
    if (cardWrapper) {
      // Kill all GSAP tweens on card wrapper
      gsap.killTweensOf(cardWrapper);
      
      // 🔥 iOS FIX: Restore touch action when stopping animation
      cardWrapper.style.touchAction = '';
      cardWrapper.style.webkitTouchCallout = '';
    }
    
    // 🔥 iOS FIX: Stop blocking if no other animations active
    if (state.activeAnimations.size === 0) {
      state.isBlockingHorizontal = false;
    }
    
    // Kill any timeline animations stored on card
    if ((card as any)._idleBounceTl) {
      try {
        (card as any)._idleBounceTl.kill();
        (card as any)._idleBounceTl = null;
      } catch {}
    }
  } catch (e) {
    console.warn('⚠️ Error stopping card animation:', e);
  }
  
  // Reset transform
  const cardWrapper = card.closest('.journey-board-card-wrapper') as HTMLElement;
  if (cardWrapper && !((card as any)._skipIdleScaleReset)) {
    // 🔥 FIX: Restore original transform completely
    const storedTransform = (cardWrapper as any)._originalTransform;
    if (storedTransform) {
      cardWrapper.style.transform = storedTransform;
      delete (cardWrapper as any)._originalTransform;
    } else {
      // Fallback: remove scale, keep rotation
      const currentTransform = cardWrapper.style.transform || '';
      const cleanedTransform = currentTransform
        .replace(/scale\([^)]+\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleanedTransform) {
        cardWrapper.style.transform = cleanedTransform;
      }
    }
  }
}

/**
 * Smoke bubbles effect for HTML card elements
 * Adapted from smokeBubblesAtTile but for DOM elements
 * 🔥 USER REQUEST: Exported for independent interim card animation
 */
export function smokeBubblesAtCard(
  card: HTMLElement,
  options: {
    sizeScale?: number;
    distanceScale?: number;
    countScale?: number;
    haloScale?: number;
    strength?: number;
    trailAlpha?: number;
    baseAlpha?: number;
  } = {}
): void {
  if (!card || !card.parentElement) return;
  
  const sizeScale = options.sizeScale ?? 1;
  const distanceScale = options.distanceScale ?? 1;
  const countScale = options.countScale ?? 1;
  const haloScale = options.haloScale ?? 1;
  const strength = options.strength ?? 1;
  const trailAlpha = options.trailAlpha ?? 0.95;
  const baseAlpha = options.baseAlpha ?? 1.0;
  
  // Get card wrapper (has the transform/rotation)
  const cardWrapper = card.closest('.journey-board-card-wrapper') as HTMLElement | null;
  if (!cardWrapper) return;
  
  // Get wrapper dimensions and position (wrapper has the transform)
  const wrapperRect = cardWrapper.getBoundingClientRect();
  const cardWidth = wrapperRect.width || STANDARD_CARD_WIDTH;
  const cardHeight = wrapperRect.height || STANDARD_CARD_HEIGHT;
  // Use average dimension for size calculations (accounting for aspect ratio)
  const cardSize = Math.max(cardWidth, cardHeight);
  const padding = Math.max(cardWidth, cardHeight) * 0.4; // Extra pad so smoke is clearly outside edges
  const containerWidth = cardWidth + padding * 2;
  const containerHeight = cardHeight + padding * 2;
  
  // Get wrapper center position (relative to viewport) - this is the actual center of the rotated card
  const containerLeft = wrapperRect.left + wrapperRect.width / 2;
  const containerTop = wrapperRect.top + wrapperRect.height / 2;
  
  // 🔥 FIX: Smoke goes around entire card - all sides allowed
  // No restrictions based on screen edges - smoke should appear around the whole card
  const allowedSides: number[] = [0, 1, 2, 3]; // All sides: top, right, bottom, left
  
  // Extract rotation from wrapper's transform style (format: "rotate(Xdeg)" or "translateX(-50%) rotate(Xdeg)")
  let cardRotationDeg = 0;
  const wrapperTransform = cardWrapper.style.transform || '';
  const rotationMatch = wrapperTransform.match(/rotate\(([^)]+)\)/);
  if (rotationMatch && rotationMatch[1]) {
    const rotationValue = rotationMatch[1].trim();
    // Remove 'deg' if present
    cardRotationDeg = parseFloat(rotationValue.replace('deg', '')) || 0;
  }
  
  // Fallback: try computed style if inline style doesn't have rotation
  if (cardRotationDeg === 0) {
    const computedTransform = window.getComputedStyle(cardWrapper).transform;
    if (computedTransform && computedTransform !== 'none') {
      const rotationMatchComputed = computedTransform.match(/rotate\(([^)]+)\)/);
      if (rotationMatchComputed && rotationMatchComputed[1]) {
        const rotationValue = rotationMatchComputed[1].trim();
        cardRotationDeg = parseFloat(rotationValue.replace('deg', '')) || 0;
      } else {
        // Try matrix decomposition as fallback
        const values = computedTransform.match(/matrix\\(([^)]+)\\)/);
        if (values && values[1]) {
          const parts = values[1].split(',').map(v => parseFloat(v.trim()));
          if (parts.length >= 4) {
            const [a, b] = parts;
            cardRotationDeg = Math.atan2(b, a) * (180 / Math.PI);
          }
        }
      }
    }
  }
  
  // Create smoke container - iOS Safari optimized
  // Must be in same stacking context as cards (cards container) for z-index to work
  const cardsContainer = document.querySelector('.journey-cards-container') as HTMLElement;
  if (!cardsContainer) {
    console.warn('⚠️ Cards container not found for smoke effect');
    return;
  }
  
  const smokeContainer = document.createElement('div');
  smokeContainer.style.width = `${containerWidth}px`;
  smokeContainer.style.height = `${containerHeight}px`;
  smokeContainer.style.pointerEvents = 'none';
  smokeContainer.style.overflow = 'visible';
  smokeContainer.style.transformOrigin = 'center center';
  
  // 🔥 iOS FIX: Prevent touch events on smoke container (has transform)
  smokeContainer.style.touchAction = 'none'; // Prevent all touch gestures
  smokeContainer.style.webkitTouchCallout = 'none'; // iOS Safari specific
  
  // Use absolute positioning relative to cards container (required for iOS Safari)
  const cardsRect = cardsContainer.getBoundingClientRect();
  
  // 🔥 FIX: Calculate exact center position relative to cards container
  // Use the actual center of the card wrapper (which accounts for rotation)
  // This position is FIXED and should not move - it's the exact center of the card
  const centerX = containerLeft - cardsRect.left;
  const centerY = containerTop - cardsRect.top;
  
  // 🔥 FIX: Set fixed position - container should NOT move
  smokeContainer.style.position = 'absolute';
  smokeContainer.style.left = `${centerX}px`;
  smokeContainer.style.top = `${centerY}px`;
  smokeContainer.style.margin = '0';
  smokeContainer.style.padding = '0';
  
  // 🔥 iOS FIX: Contain layout to prevent overflow from triggering scroll
  smokeContainer.style.contain = 'layout style paint'; // CSS containment to prevent layout shifts
  
  // 🔥 FIX: Center container and rotate to match card rotation
  // Use translate(-50%, -50%) to center the container on the card center point
  // Combine with translateZ(0) for hardware acceleration and rotate for card rotation
  // This ensures smoke is perfectly centered on the card and rotates with it
  const transformValue = `translate(-50%, -50%) translateZ(0) rotate(${cardRotationDeg}deg)`;
  smokeContainer.style.transform = transformValue;
  smokeContainer.style.webkitTransform = transformValue; // iOS Safari prefix
  
  // 🔥 PERFORMANCE: Enable hardware acceleration
  smokeContainer.style.willChange = 'transform';
  smokeContainer.style.backfaceVisibility = 'hidden';
  smokeContainer.style.webkitBackfaceVisibility = 'hidden';
  
  // In same stacking context as cards, z-index: 1 will be below cards (z-index: 10)
  smokeContainer.style.zIndex = '1';
  
  // Append to cards container (same stacking context = z-index works on iOS)
  cardsContainer.appendChild(smokeContainer);
  
  // 🔥 MEMORY FIX: Track smoke container for cleanup
  state.smokeContainers.add(smokeContainer);
  
  // Calculate particle properties
  const baseStrength = Math.max(0.4, strength);
  // 🔥 iOS OPTIMIZATION: Reduced particle count from 44-58 to 30-40 for better performance
  // Original: (44 + random(14)) = 44-58 particles
  // Optimized: (30 + random(10)) = 30-40 particles (30-35% reduction)
  const COUNT = Math.max(6, Math.round((30 + Math.random() * 10) * baseStrength * countScale));
  const BASE_R = Math.max(6, Math.round(cardSize * 0.051 * sizeScale));
  const MAX_R = Math.max(18, Math.round(cardSize * 0.24 * sizeScale));
  const INSET = cardSize * 0.02;
  const OUT_MIN = cardSize * 0.15 * distanceScale;
  const OUT_MAX = cardSize * 0.34 * distanceScale;
  const BURSTS = 5;
  const BURST_GAP = 0.035;
  
  // Spawn on side of card (accounting for aspect ratio)
  // Coordinates are relative to container center (0,0) after rotation
  const spawnOnSide = (side: number) => {
    const halfWidth = cardWidth * 0.5;
    const halfHeight = cardHeight * 0.5;
    const alongWidth = (Math.random() * (cardWidth - INSET * 2)) - (cardWidth / 2 - INSET);
    const alongHeight = (Math.random() * (cardHeight - INSET * 2)) - (cardHeight / 2 - INSET);
    
    if (side === 0) return { sx: alongWidth, sy: -halfHeight + INSET }; // top
    // 🔥 USER REQUEST: Move right side spawn 40% closer to card (applies to all cards)
    if (side === 1) return { sx: halfWidth * 0.6 - INSET, sy: alongHeight }; // right (40% closer)
    // 🔥 USER REQUEST: Move bottom spawn up by 40% (applies to all cards)
    if (side === 2) return { sx: alongWidth, sy: halfHeight * 0.6 - INSET }; // bottom (40% higher)
    return { sx: -halfWidth + INSET, sy: alongHeight }; // left
  };
  
  // 🔥 FIX: Helper to pick a random allowed side
  const pickRandomAllowedSide = (): number => {
    return allowedSides[Math.floor(Math.random() * allowedSides.length)];
  };
  
  // Generate particles in bursts
  for (let b = 0; b < BURSTS; b++) {
    const burstDelay = b * BURST_GAP;
    const perBurst = Math.ceil(COUNT / BURSTS);
    
    for (let i = 0; i < perBurst; i++) {
      // 🔥 FIX: Pick a random allowed side (based on card position near screen edges)
      const side = pickRandomAllowedSide();
      // 🔥 PERFORMANCE: Use object pooling for DOM elements
      const smoke = domElementPool.acquire();
      
      // Random size
      let r0 = BASE_R + Math.random() * (MAX_R - BASE_R);
      if (Math.random() < 0.22) r0 *= (1.35 + Math.random() * 0.9);
      const maxRadius = Math.min(MAX_R * 1.5, cardSize * 0.18);
      r0 = Math.min(r0, maxRadius);
      
      // Random shape: circle or ellipse
      const isEllipse = Math.random() > 0.5;
      const aspectRatio = isEllipse ? (0.6 + Math.random() * 0.8) : 1;
      const rx = r0;
      const ry = r0 * aspectRatio;
      
      // 🔥 USER REQUEST: Use baseAlpha from options (0.8-1.0 range)
      // Each particle gets the baseAlpha value, with slight random variation for natural look
      // Similar to tiles: 70-130% variation for more natural look
      const particleAlpha = baseAlpha * (0.7 + Math.random() * 0.3); // Variation: 70-100% of baseAlpha (0.8-1.0 range)
      
      // 🔥 PERFORMANCE: Use will-change for better rendering performance
      smoke.style.willChange = 'transform, opacity';
      smoke.style.width = `${rx * 2}px`;
      smoke.style.height = `${ry * 2}px`;
      smoke.style.backgroundColor = `rgba(255, 255, 255, ${particleAlpha})`;
      smoke.style.borderRadius = '50%';
      smoke.style.position = 'absolute';
      smoke.style.left = '0';
      smoke.style.top = '0';
      // 🔥 USER REQUEST: Better blend mode for quality (similar to tiles additive blending)
      // 'screen' is closest to additive blending in CSS (brightens background)
      smoke.style.mixBlendMode = 'screen'; // Better quality - similar to additive blending on tiles
      smoke.style.opacity = '0';
      smoke.style.filter = 'none'; // Remove dark halos/lines
      smoke.style.transformOrigin = 'center center';
      // 🔥 PERFORMANCE: Enable hardware acceleration
      smoke.style.transform = 'translateZ(0)'; // Force GPU acceleration
      smoke.style.webkitTransform = 'translateZ(0)'; // iOS Safari
      smoke.style.backfaceVisibility = 'hidden'; // Better rendering
      smoke.style.webkitBackfaceVisibility = 'hidden'; // iOS Safari
      
      // Random rotation for ellipses
      if (isEllipse) {
        const rotation = Math.random() * 360;
        smoke.style.transform = `translateZ(0) rotate(${rotation}deg)`;
        smoke.style.webkitTransform = `translateZ(0) rotate(${rotation}deg)`;
      }
      
      smokeContainer.appendChild(smoke);
      
      // 🔥 FIX: Position on allowed side of card (based on card position near screen edges)
      const { sx, sy } = spawnOnSide(side);
      
      // Calculate movement direction
      const normals = [
        { nx: 0, ny: -1 },
        { nx: 1, ny: 0 },
        { nx: 0, ny: 1 },
        { nx: -1, ny: 0 },
      ];
      const { nx, ny } = normals[side];
      const baseAngle = Math.atan2(ny, nx);
      const spread = 0.9;
      const theta = baseAngle + (Math.random() - 0.5) * spread;
      
      const distance = OUT_MIN + Math.random() * Math.max(0, OUT_MAX - OUT_MIN);
      const dx = sx + Math.cos(theta) * distance;
      const dy = sy + Math.sin(theta) * distance;
      
      const driftX = (Math.random() - 0.5) * (cardSize * 0.06 * distanceScale);
      const driftY = (Math.random() - 0.5) * (cardSize * 0.06 * distanceScale);
      
      // Animation timings
      const tIn = 0.018 + Math.random() * 0.022;
      const tRun = 0.16 + Math.random() * 0.12;
      const tHold = 0.02 + Math.random() * 0.03;
      const tOut = 0.08 + Math.random() * 0.06;
      
      // 🔥 USER REQUEST: Better start scale (similar to tiles for quality)
      // Tiles use: (0.65 + random(0.25)) * max(0.7, sizeScale)
      // We'll use similar range but adjusted for our sizeScale
      const startScale = (0.65 + Math.random() * 0.25) * Math.max(0.7, sizeScale);
      // Position relative to container center (container is already centered and rotated)
      // Container center is at (containerWidth/2, containerHeight/2) in container coordinates
      const containerCenterX = containerWidth / 2;
      const containerCenterY = containerHeight / 2;
      const startX = containerCenterX + sx;
      const startY = containerCenterY + sy;
      const endX = containerCenterX + dx + driftX;
      const endY = containerCenterY + dy + driftY;
      
      gsap.set(smoke, { scale: startScale, x: startX, y: startY });
      
      const stg = burstDelay + Math.random() * 0.018;
      const tl = gsap.timeline({
        defaults: { overwrite: false },
        onComplete: () => {
          try {
            if (smoke && smoke.parentNode) {
              smoke.parentNode.removeChild(smoke);
            }
            // 🔥 PERFORMANCE: Return to pool instead of destroying
            domElementPool.release(smoke);
          } catch {}
        }
      });
      
      tl.to(smoke, { 
        opacity: trailAlpha, 
        duration: tIn, 
        ease: 'power2.out' 
      }, stg)
        .to(smoke, { 
          x: endX, 
          y: endY, 
          duration: tRun, 
          ease: 'sine.out' 
        }, `>${0}`)
        .to(smoke, { 
          opacity: trailAlpha, 
          duration: tHold, 
          ease: 'none' 
        }, `>${0}`)
        .to(smoke, { 
          opacity: 0, 
          duration: tOut, 
          ease: 'power1.in' 
        }, `>${0}`);
    }
  }
  
  // 🔥 USER REQUEST: Better quality halo effect (similar to tiles)
  const halo = document.createElement('div');
  const haloPad = cardSize * (0.22 + 0.05 * baseStrength) * haloScale;
  const haloWidth = cardWidth + haloPad * 2;
  const haloHeight = cardHeight + haloPad * 2;
  halo.style.width = `${haloWidth}px`;
  halo.style.height = `${haloHeight}px`;
  // 🔥 USER REQUEST: Better halo alpha (similar to tiles: 0.10-0.22 range)
  halo.style.backgroundColor = `rgba(255, 255, 255, 0.10)`;
  halo.style.borderRadius = '16px';
  halo.style.position = 'absolute';
  // Center halo in container (container is already centered and rotated)
  halo.style.left = `${(containerWidth - haloWidth) / 2}px`;
  halo.style.top = `${(containerHeight - haloHeight) / 2}px`;
  halo.style.opacity = '0';
  halo.style.pointerEvents = 'none';
  // 🔥 USER REQUEST: Better blend mode for halo (similar to tiles)
  halo.style.mixBlendMode = 'screen'; // Better quality - similar to additive blending
  // 🔥 PERFORMANCE: Enable hardware acceleration
  halo.style.willChange = 'opacity';
  halo.style.transform = 'translateZ(0)';
  halo.style.webkitTransform = 'translateZ(0)';
  halo.style.backfaceVisibility = 'hidden';
  halo.style.webkitBackfaceVisibility = 'hidden';
  smokeContainer.appendChild(halo);
  
  // 🔥 USER REQUEST: Better halo animation (similar to tiles: 0.22 alpha peak)
  gsap.to(halo, { 
    opacity: 0.22, 
    duration: 0.08, 
    ease: 'power2.out' 
  });
  
  gsap.to(halo, { 
    opacity: 0, 
    duration: 0.28, 
    delay: 0.18, 
    ease: 'power2.in',
    onComplete: () => {
      try {
        if (halo && halo.parentNode) {
          halo.parentNode.removeChild(halo);
        }
      } catch {}
    }
  });
  
  // 🔥 MEMORY FIX: Cleanup container after all animations complete
  // Particles take ~0.4-0.5s, halo takes ~0.5s, so cleanup after 2.5s to be safe
  // 🔥 CRITICAL FIX: Check if cleanup timer already exists to prevent duplicates
  if ((smokeContainer as any)._cleanupTimer) {
    console.warn('⚠️ Smoke container already has cleanup timer, killing old one');
    (smokeContainer as any)._cleanupTimer.kill();
    (smokeContainer as any)._cleanupTimer = null;
  }
  
  const cleanupTimer = gsap.delayedCall(2.5, () => {
    try {
      // 🔥 CRITICAL FIX: Check if container was already cleaned up
      if (!smokeContainer || !smokeContainer.parentNode) {
        console.warn('⚠️ Smoke container already removed, skipping cleanup');
        return;
      }
      
      // 🔥 CRITICAL FIX: Mark as cleaned up to prevent duplicate cleanup
      if ((smokeContainer as any)._cleanedUp) {
        console.warn('⚠️ Smoke container already cleaned up, skipping duplicate');
        return;
      }
      (smokeContainer as any)._cleanedUp = true;
      
      // Kill any remaining GSAP animations on container
      gsap.killTweensOf(smokeContainer);
      
      // Kill animations on all children and release smoke particles to pool
      const children = smokeContainer.querySelectorAll('*');
      children.forEach(child => {
        gsap.killTweensOf(child);
        // 🔥 MEMORY FIX: Release smoke particles back to pool
        // Halo elements will be removed by DOM removal below
        if (child.parentNode === smokeContainer) {
          // Only release if it's a direct child (smoke particles)
          // Halo is also a direct child but we'll let DOM removal handle it
          try {
            // Try to release to pool (will fail silently if not a pooled element)
            if ((child as HTMLElement).style && (child as HTMLElement).style.borderRadius === '50%') {
              // Likely a smoke particle (has border-radius: 50%)
              domElementPool.release(child as HTMLElement);
            }
          } catch {}
        }
      });
      
      // Remove from DOM (this removes halo and any remaining elements)
      smokeContainer.parentNode.removeChild(smokeContainer);
      // Remove from tracking set
      state.smokeContainers.delete(smokeContainer);
      console.log('🧹 Smoke container cleaned up');
    } catch (e) {
      console.warn('⚠️ Error cleaning up smoke container:', e);
      // Ensure it's removed from tracking even if cleanup fails
      state.smokeContainers.delete(smokeContainer);
    } finally {
      // Clear cleanup timer reference
      (smokeContainer as any)._cleanupTimer = null;
    }
  });
  
  // 🔥 MEMORY FIX: Store cleanup timer on container so it can be killed if needed
  (smokeContainer as any)._cleanupTimer = cleanupTimer;
}

export function updateJourneyCardList(container: HTMLElement | null): void {
  if (!container) return;
  // 🔥 USER REQUEST: Include both unlocked AND interim cards
  const unlockedCards = container.querySelectorAll('.journey-board-card.unlocked') as NodeListOf<HTMLElement>;
  const interimCards = container.querySelectorAll('.journey-board-card.interim') as NodeListOf<HTMLElement>;
  const allCards = Array.from(unlockedCards).concat(Array.from(interimCards));
  state.cards = allCards.filter(card => card && card.parentElement);
  console.log('🔄 Updated journey card list:', state.cards.length, 'cards (unlocked + interim)');
}

// Exports for easy access
export const JOURNEY_CARD_IDLE_BOUNCE = {
  ENABLE: ENABLE_JOURNEY_CARD_IDLE_BOUNCE,
  start: startJourneyCardIdleBounce,
  stop: stopJourneyCardIdleBounce,
  reset: resetJourneyCardIdleBounce,
  notifyInteraction: notifyJourneyInteraction,
  updateCardList: updateJourneyCardList,
  markCardAsViewed: markCardAsViewed // 🔥 USER REQUEST: Export function to mark cards as viewed
};
