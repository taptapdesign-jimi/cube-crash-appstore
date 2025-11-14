import { logger } from '../core/logger.js';
import gsap from 'gsap';

/**
 * Animate collectibles screen ENTER with pop-in effects
 * Elements pop in randomly: header first, then card sections and cards in random order
 */
export function animateCollectiblesScreenEnter(): void {
  console.log('🎬🎬🎬 animateCollectiblesScreenEnter CALLED!');
  console.log('🔍 GSAP available?', typeof gsap !== 'undefined');
  
  // Get collectible elements
  const collectiblesScreen = document.getElementById('collectibles-screen');
  const collectiblesHeader = collectiblesScreen?.querySelector('.collectibles-header') as HTMLElement;
  const collectiblesScrollable = collectiblesScreen?.querySelector('.collectibles-scrollable') as HTMLElement;
  
  console.log('🔍 Found elements:', {
    collectiblesScreen: !!collectiblesScreen,
    collectiblesHeader: !!collectiblesHeader,
    collectiblesScrollable: !!collectiblesScrollable
  });
  
  if (!collectiblesScreen) {
    console.error('❌ No collectibles screen found to animate!');
    return;
  }
  
  // 🔥 CRITICAL: Set initial state - both scale from 0
  console.log('🎯 Setting initial state for elements...');
  
  try {
    // Header: scale from 0 (pop-in)
    if (collectiblesHeader) {
      gsap.set(collectiblesHeader, { scale: 0, opacity: 0 });
    }
    
    // Scrollable: scale from 0.1 (90% smaller scale range to avoid overflow)
    if (collectiblesScrollable) {
      gsap.set(collectiblesScrollable, { scale: 0.1, opacity: 0 });
    }
    
    console.log('✅ Initial state set successfully');
  } catch (error) {
    console.error('❌ Failed to set initial state:', error);
    return;
  }
  
  // STEP 1: Header FIRST (0ms delay) - pop-in with scale
  if (collectiblesHeader) {
    gsap.to(collectiblesHeader, { 
      scale: 1, 
      opacity: 1, 
      duration: 0.5, 
      ease: 'back.out(1.7)', 
      delay: 0
    });
    console.log('📊 Step 1: Header pop-in started');
  }
  
  // STEP 2: Scrollable area pop-in (90% smaller scale range: 0.1 → 1.0)
  if (collectiblesScrollable) {
    gsap.to(collectiblesScrollable, {
      scale: 1,
      opacity: 1,
      duration: 0.5,
      ease: 'back.out(1.7)',
      delay: 0.1 // Start shortly after header
    });
    console.log('🎴 Step 2: Cards area pop-in started (90% smaller scale range)');
  }
  
  console.log('✅ Collectibles screen enter animation started');
}

/**
 * Animate collectibles screen EXIT with pop-out effects
 * Elements pop out in reverse order: scrollable area first, then header
 */
export function animateCollectiblesScreenExit(): void {
  console.log('🎬 animateCollectiblesScreenExit CALLED!');
  
  const collectiblesScreen = document.getElementById('collectibles-screen');
  const collectiblesHeader = collectiblesScreen?.querySelector('.collectibles-header') as HTMLElement;
  const collectiblesScrollable = collectiblesScreen?.querySelector('.collectibles-scrollable') as HTMLElement;
  
  if (!collectiblesScreen) {
    console.error('❌ No collectibles screen found to animate!');
    return;
  }
  
  // STEP 1: Scrollable area pop-out (90% smaller scale range: 1.0 → 0.1)
  if (collectiblesScrollable) {
    gsap.to(collectiblesScrollable, {
      scale: 0.1,
      opacity: 0,
      duration: 0.4,
      ease: 'back.in(1.7)',
      delay: 0
    });
    console.log('🎴 Step 1: Cards area pop-out started (90% smaller scale range)');
  }
  
  // STEP 2: Header scales out LAST
  if (collectiblesHeader) {
    gsap.to(collectiblesHeader, {
      scale: 0,
      opacity: 0,
      duration: 0.4,
      ease: 'back.in(1.7)',
      delay: 0.1 // Start shortly after scrollable area
    });
    console.log('📊 Step 2: Header pop-out - LAST');
  }
  
  console.log('✅ Collectibles screen exit animation started');
}

