import gsap from 'gsap';

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
    gsap.set(journeyScreen, { 
      opacity: 0,
      visibility: 'hidden',
      force3D: true,
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

    // Scrollable: scale from 0 (full scale range)
    if (collectiblesScrollable) {
      gsap.set(collectiblesScrollable, { 
        scale: 0, 
        opacity: 0,
        visibility: 'hidden',
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
  gsap.to(journeyScreen, {
    opacity: 1,
    duration: 0.3,
    ease: 'power2.out',
    delay: 0,
    force3D: true,
    immediateRender: false
  });

  // STEP 1: Header FIRST (0ms delay) - pop-in with scale
  if (collectiblesHeader) {
    // Set visibility first, then animate
    gsap.set(collectiblesHeader, { visibility: 'visible', immediateRender: true });
    gsap.to(collectiblesHeader, {
      scale: 1,
      opacity: 1,
      duration: 0.5,
      ease: 'back.out(1.7)',
      delay: 0,
      force3D: true,
      immediateRender: false
    });
  }

  // STEP 2: Scrollable area pop-in (full scale range: 0 → 1.0)
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
      bgContainer.style.transform = 'scale(1)';
      bgContainer.style.display = 'block';
    }
    
    // Set visibility first, then animate scrollable container
    gsap.set(collectiblesScrollable, { visibility: 'visible', immediateRender: true });
    gsap.to(collectiblesScrollable, {
      scale: 1,
      opacity: 1,
      duration: 0.5,
      ease: 'back.out(1.7)',
      delay: 0.1,
      force3D: true,
      immediateRender: false
    });
  }
  
  // STEP 3: Animate first 8 cards in grid (scale from 0.3 to 1.0)
  // 🔥 FAST INDIVIDUAL ANIMATION: Only first 8 cards, start from 30% scale, faster timing
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
      gsap.set(card, { visibility: 'visible', immediateRender: true });
      gsap.to(card, {
        scale: 1,
        opacity: 1,
        duration: 0.4,
        ease: 'back.out(1.7)',
        delay: delay,
        force3D: true,
        immediateRender: false
      });
    });
  }
}

/**
 * Animate Journey screen EXIT with pop-out effects
 * Elements pop out in reverse order: all cards first (fast individual), then scrollable, then header
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
    
    // STEP 1: Animate all cards out first (scale from 1.0 to 0)
    const cardWrappers = journeyScreen?.querySelectorAll('.collectible-card-wrapper') as NodeListOf<HTMLElement>;
    let maxCardDelay = 0;

    if (cardWrappers && cardWrappers.length > 0) {
      const cardsArray = Array.from(cardWrappers);

      // Shuffle cards for random order
      for (let i = cardsArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardsArray[i], cardsArray[j]] = [cardsArray[j], cardsArray[i]];
      }

      // Animate each card individually with fast stagger
      const stagger = 0.025;
      cardsArray.forEach((card, index) => {
        const delay = index * stagger;
        maxCardDelay = Math.max(maxCardDelay, delay + 0.35);

        gsap.to(card, {
          scale: 0,
          opacity: 0,
          duration: 0.35,
          ease: 'back.in(1.7)',
          delay: delay
        });
      });
    }
    
    // STEP 2: Scrollable area pop-out (full scale range: 1.0 → 0)
    const scrollableDelay = 0.2;
    const scrollableDuration = 0.4;
    const scrollableEnd = scrollableDelay + scrollableDuration;

    if (collectiblesScrollable) {
      gsap.to(collectiblesScrollable, {
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
      gsap.to(collectiblesHeader, {
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
