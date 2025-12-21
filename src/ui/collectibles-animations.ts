import { logger } from '../core/logger.js';
import gsap from 'gsap';

/**
 * Animate collectibles screen ENTER with pop-in effects
 * Elements pop in: header first, then scrollable, then first 8 cards from 30% scale (remaining cards instantly visible)
 */
export function animateCollectiblesScreenEnter(): void {
  console.log('🎬🎬🎬 animateCollectiblesScreenEnter CALLED!');
  console.log('🔍 GSAP available?', typeof gsap !== 'undefined');
  
  // Get Journey screen elements
  const journeyScreen = document.getElementById('journey-screen');
  const collectiblesHeader = journeyScreen?.querySelector('.collectibles-header') as HTMLElement;
  const collectiblesScrollable = journeyScreen?.querySelector('.collectibles-scrollable') as HTMLElement;
  
  console.log('🔍 Found elements:', {
    journeyScreen: !!journeyScreen,
    collectiblesHeader: !!collectiblesHeader,
    collectiblesScrollable: !!collectiblesScrollable
  });
  
  if (!journeyScreen) {
    console.error('❌ No Journey screen found to animate!');
    return;
  }
  
  // 🔥 CRITICAL: Set initial state - journey screen, header and scrollable scale from 0
  console.log('🎯 Setting initial state for elements...');

  try {
    // 🔥 CRITICAL: Set initial opacity to 0 inline FIRST (before GSAP takes control)
    // This ensures screen is invisible until GSAP animates it
    (journeyScreen as HTMLElement).style.opacity = '0';
    
    // Journey screen: use autoAlpha (controls both opacity and visibility)
    // Don't use clearProps - we want GSAP to take control of the inline style
    gsap.set(journeyScreen, { 
      autoAlpha: 0,
      force3D: true
    });
    
    // Header: scale from 0 (pop-in)
    if (collectiblesHeader) {
      gsap.set(collectiblesHeader, { 
        scale: 0, 
        autoAlpha: 0,
        force3D: true
      });
    }

    // Scrollable: scale from 0 (full scale range)
    if (collectiblesScrollable) {
      gsap.set(collectiblesScrollable, { 
        scale: 0, 
        autoAlpha: 0,
        force3D: true
      });
    }

    console.log('✅ Initial state set successfully');
  } catch (error) {
    console.error('❌ Failed to set initial state:', error);
    return;
  }
  
  // 🔥 CRITICAL: Fade in journey screen FIRST (before other animations)
  // Use autoAlpha for better control (handles both opacity and visibility)
  // Use force3d for better mobile performance
  gsap.to(journeyScreen, {
    autoAlpha: 1,
    duration: 0.3,
    ease: 'power2.out',
    delay: 0,
    force3D: true // Better performance on mobile
  });
  console.log('🌅 Journey screen fade-in started');

  // STEP 1: Header FIRST (0ms delay) - pop-in with scale
  if (collectiblesHeader) {
    gsap.to(collectiblesHeader, {
      scale: 1,
      autoAlpha: 1,
      duration: 0.5,
      ease: 'back.out(1.7)',
      delay: 0,
      force3D: true // Better performance on mobile
    });
    console.log('📊 Step 1: Header pop-in started');
  }

  // STEP 2: Scrollable area pop-in (full scale range: 0 → 1.0)
  if (collectiblesScrollable) {
    gsap.to(collectiblesScrollable, {
      scale: 1,
      autoAlpha: 1,
      duration: 0.5,
      ease: 'back.out(1.7)',
      delay: 0.1, // Start shortly after header
      force3D: true // Better performance on mobile
    });
    console.log('🎴 Step 2: Cards area pop-in started (full scale range)');
  }
  
  // STEP 3: Animate first 8 cards in grid (scale from 0.3 to 1.0)
  // 🔥 FAST INDIVIDUAL ANIMATION: Only first 8 cards, start from 30% scale, faster timing
  const cardWrappers = journeyScreen?.querySelectorAll('.collectible-card-wrapper') as NodeListOf<HTMLElement>;
  if (cardWrappers && cardWrappers.length > 0) {
    console.log(`🎴 Step 3: Animating first 8 cards from ${cardWrappers.length} total (scale from 0.3 to 1.0)`);

    // Convert NodeList to Array
    const cardsArray = Array.from(cardWrappers);

    // Only animate first 8 cards
    const cardsToAnimate = cardsArray.slice(0, 8);

    // Set initial state for animated cards (scale 0.3, opacity 0)
    gsap.set(cardsToAnimate, { scale: 0.3, autoAlpha: 0, force3D: true });

    // Set initial state for remaining cards (scale 1, opacity 1 - already visible)
    if (cardsArray.length > 8) {
      const remainingCards = cardsArray.slice(8);
      gsap.set(remainingCards, { scale: 1, autoAlpha: 1, force3D: true });
    }

    // Animate first 8 cards with fast stagger
    cardsToAnimate.forEach((card, index) => {
      const baseDelay = 0.15; // Start sooner after scrollable area
      const stagger = 0.03; // Fixed fast stagger between cards
      const delay = baseDelay + (index * stagger);

      gsap.to(card, {
        scale: 1,
        autoAlpha: 1,
        duration: 0.4, // Faster animation
        ease: 'back.out(1.7)',
        delay: delay,
        force3D: true // Better performance on mobile
      });
      console.log(`🎴 Card ${index + 1}/8 pop-in - delay ${(delay * 1000).toFixed(0)}ms`);
    });

    console.log('✅ First 8 cards fast animation started');
  }
  
  console.log('✅ Journey screen enter animation started');
}

/**
 * Animate Journey screen EXIT with pop-out effects
 * Elements pop out in reverse order: all cards first (fast individual), then scrollable, then header
 * Returns Promise that resolves when animation completes
 */
export function animateCollectiblesScreenExit(): Promise<void> {
  return new Promise((resolve) => {
    console.log('🎬 animateCollectiblesScreenExit CALLED!');
    
    const journeyScreen = document.getElementById('journey-screen');
    const collectiblesHeader = journeyScreen?.querySelector('.collectibles-header') as HTMLElement;
    const collectiblesScrollable = journeyScreen?.querySelector('.collectibles-scrollable') as HTMLElement;
    
    if (!journeyScreen) {
      console.error('❌ No Journey screen found to animate!');
      resolve();
      return;
    }
    
    // Calculate total animation duration
    // Cards: max delay = (cards.length - 1) * 0.025 + 0.35 duration (faster exit)
    // Scrollable: delay 0.2 + 0.4 duration = 0.6s
    // Header: delay 0.3 + 0.4 duration = 0.7s
    // Total should be around 0.7s + small buffer
    
    // STEP 1: Animate all cards out first (scale from 1.0 to 0)
    // 🔥 FAST INDIVIDUAL ANIMATION: All cards animate individually with fixed fast stagger
    const cardWrappers = journeyScreen?.querySelectorAll('.collectible-card-wrapper') as NodeListOf<HTMLElement>;
    let maxCardDelay = 0;

    if (cardWrappers && cardWrappers.length > 0) {
      console.log(`🎴 Step 1: Animating ${cardWrappers.length} cards out individually with fast stagger (scale from 1.0 to 0)`);

      // Convert NodeList to Array and shuffle for random order
      const cardsArray = Array.from(cardWrappers);

      // Shuffle cards for random order (like stats animations)
      for (let i = cardsArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardsArray[i], cardsArray[j]] = [cardsArray[j], cardsArray[i]];
      }

      // Animate each card individually with fast stagger
      cardsArray.forEach((card, index) => {
        const baseDelay = 0; // Start immediately
        const stagger = 0.025; // Fixed fast stagger between cards
        const delay = baseDelay + (index * stagger);
        maxCardDelay = Math.max(maxCardDelay, delay + 0.35); // delay + faster duration

        gsap.to(card, {
          scale: 0,
          opacity: 0,
          duration: 0.35, // Faster exit animation
          ease: 'back.in(1.7)',
          delay: delay
        });
        console.log(`🎴 Card ${index + 1}/${cardsArray.length} pop-out - delay ${(delay * 1000).toFixed(0)}ms`);
      });

      console.log('✅ Cards grid individual exit animation started');
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
      console.log('🎴 Step 2: Cards area pop-out started (full scale range)');
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
      console.log('📊 Step 3: Header pop-out - LAST');
    }
    
    // Calculate total animation duration (longest animation)
    const totalDuration = Math.max(maxCardDelay, scrollableEnd, headerEnd) + 0.1; // Add 0.1s buffer
    
    console.log(`✅ Journey screen exit animation started - will complete in ${totalDuration.toFixed(2)}s`);
    
    // Resolve promise after animation completes
    setTimeout(() => {
      console.log('✅ Journey screen exit animation completed');
      resolve();
    }, totalDuration * 1000);
  });
}

