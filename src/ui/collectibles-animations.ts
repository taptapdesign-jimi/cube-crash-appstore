import gsap from 'gsap';
import animationManager from '../modules/animation-manager.js';

// 🔥 FIX: Track active GSAP tweens for cleanup
const activeCollectiblesTweens: gsap.core.Tween[] = [];

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

/**
 * Cleanup all collectibles animations
 * Call this when screen is destroyed or before starting new animations
 */
export function cleanupCollectiblesAnimations(): void {
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
        opacity: 0,
        visibility: 'hidden',
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
    gsap.set(collectiblesHeader, { visibility: 'visible', immediateRender: true });
    trackTween(collectiblesHeader, {
      scale: 1,
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
 * Animate Journey screen EXIT with pop-out effects
 * 🔥 OPTIMIZED: Viewport-based smart batching - only animates visible cards, off-screen cards hide instantly
 * Elements pop out in reverse order: visible cards first (batched), off-screen cards instantly, then scrollable, then header
 * Returns Promise that resolves when animation completes
 */
export function animateCollectiblesScreenExit(): Promise<void> {
  return new Promise((resolve) => {
    const journeyScreen = document.getElementById('journey-screen');
    const collectiblesHeader = journeyScreen?.querySelector('.collectibles-header') as HTMLElement;
    const collectiblesScrollable = journeyScreen?.querySelector('.collectibles-scrollable') as HTMLElement;
    
    if (!journeyScreen) {
      console.error('❌ No Journey screen found to animate!');
      resolve();
      return;
    }
    
    // STEP 1: Viewport-based smart batching for cards
    const cardWrappers = journeyScreen?.querySelectorAll('.collectible-card-wrapper') as NodeListOf<HTMLElement>;
    let maxCardDelay = 0;

    if (cardWrappers && cardWrappers.length > 0) {
      const cardsArray = Array.from(cardWrappers);
      
      // 🔥 AGGRESSIVE OPTIMIZATION: Separate visible cards from off-screen cards
      // Use strict viewport detection (no margin) to minimize animated cards
      const viewport = {
        top: window.scrollY || window.pageYOffset,
        bottom: (window.scrollY || window.pageYOffset) + window.innerHeight,
        left: 0,
        right: window.innerWidth
      };
      
      const visibleCards: HTMLElement[] = [];
      const offScreenCards: HTMLElement[] = [];
      
      cardsArray.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const cardTop = rect.top + (window.scrollY || window.pageYOffset);
        const cardBottom = cardTop + rect.height;
        
        // 🔥 STRICT VIEWPORT: Only cards actually visible (no margin) - reduces animated cards
        const isVisible = cardBottom >= viewport.top && cardTop <= viewport.bottom;
        
        if (isVisible) {
          visibleCards.push(card);
        } else {
          offScreenCards.push(card);
        }
      });
      
      // 🔥 AGGRESSIVE OPTIMIZATION: Off-screen cards hide instantly (no animation) - prevents lag
      offScreenCards.forEach((card) => {
        gsap.set(card, {
          scale: 0,
          opacity: 0,
          visibility: 'hidden',
          immediateRender: true
        });
      });
      
      // 🔥 AGGRESSIVE OPTIMIZATION: Limit animated cards to maximum 8 for smooth performance
      // If more than 8 visible cards, animate only first 8, hide rest instantly
      const MAX_ANIMATED_CARDS = 8;
      const cardsToAnimate = visibleCards.slice(0, MAX_ANIMATED_CARDS);
      const cardsToHideInstantly = visibleCards.slice(MAX_ANIMATED_CARDS);
      
      // Hide excess visible cards instantly
      cardsToHideInstantly.forEach((card) => {
        gsap.set(card, {
          scale: 0,
          opacity: 0,
          visibility: 'hidden',
          immediateRender: true
        });
      });
      
      // 🔥 OPTIMIZATION: Animate only limited number of cards in small batches
      if (cardsToAnimate.length > 0) {
        // Shuffle cards to animate for random order
        for (let i = cardsToAnimate.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [cardsToAnimate[i], cardsToAnimate[j]] = [cardsToAnimate[j], cardsToAnimate[i]];
        }
        
        // 🔥 AGGRESSIVE BATCHING: Small batches of 3-4 cards for better performance
        const batchSize = cardsToAnimate.length > 6 ? 3 : cardsToAnimate.length;
        const batchStagger = 0.06; // 60ms between batches (slightly longer for smoother)
        const cardStagger = 0.03; // 30ms between cards in batch
        
        // Animate cards in small batches
        cardsToAnimate.forEach((card, index) => {
          const batchIndex = Math.floor(index / batchSize);
          const cardIndexInBatch = index % batchSize;
          const delay = (batchIndex * batchStagger) + (cardIndexInBatch * cardStagger);
          maxCardDelay = Math.max(maxCardDelay, delay + 0.35);
          
          // 🔥 GPU OPTIMIZATION: Add will-change for better performance
          card.style.willChange = 'transform, opacity';
          card.style.transform = 'translateZ(0)'; // Force GPU acceleration
          // 🔥 CSS CONTAINMENT: Add contain property for better performance
          (card.parentElement as HTMLElement)?.style.setProperty('contain', 'layout style paint');
          
          trackTween(card, {
            scale: 0,
            opacity: 0,
            duration: 0.35,
            ease: 'back.in(1.7)',
            delay: delay,
            force3D: true,
            onComplete: () => {
              // Remove will-change after animation to free resources
              card.style.willChange = 'auto';
            }
          });
        });
      }
    }
    
    // STEP 2: Scrollable area pop-out (full scale range: 1.0 → 0)
    const scrollableDelay = 0.2;
    const scrollableDuration = 0.4;
    const scrollableEnd = scrollableDelay + scrollableDuration;

    if (collectiblesScrollable) {
      trackTween(collectiblesScrollable, {
        scale: 0,
        opacity: 0,
        duration: scrollableDuration,
        ease: 'back.in(1.7)',
        delay: scrollableDelay
      });
    }
    
    // STEP 3: Header scales out LAST
    const headerDelay = 0.3;
    const headerDuration = 0.4;
    const headerEnd = headerDelay + headerDuration;
    
    if (collectiblesHeader) {
      trackTween(collectiblesHeader, {
        scale: 0,
        opacity: 0,
        duration: headerDuration,
        ease: 'back.in(1.7)',
        delay: headerDelay
      });
    }
    
    // Calculate total animation duration (longest animation)
    const totalDuration = Math.max(maxCardDelay, scrollableEnd, headerEnd) + 0.1;
    
    // Resolve promise after animation completes
    setTimeout(() => {
      resolve();
    }, totalDuration * 1000);
  });
}
