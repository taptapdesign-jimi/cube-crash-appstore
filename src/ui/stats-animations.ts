// Stats Screen Animations using GSAP
// Pop-in and pop-out animations for stats screen elements

import { gsap } from 'gsap';

/**
 * Cleanup all stats screen animations
 * Call this when screen is destroyed or before starting new animations
 */
export function cleanupStatsAnimations(): void {
  // Kill tweens on all stats elements
  const statItems = document.querySelectorAll('.stat-item');
  const statsHeader = document.querySelector('.stats-header');
  const resetButton = document.getElementById('stats-reset-btn');
  
  statItems.forEach(item => gsap.killTweensOf(item));
  if (statsHeader) gsap.killTweensOf(statsHeader);
  if (resetButton) gsap.killTweensOf(resetButton);
}

/**
 * Animate stats screen ENTER with pop-in effects
 * Elements pop in randomly: header first, then stats items in random order
 */
export function animateStatsScreenEnter(): void {
  console.log('🎬🎬🎬 animateStatsScreenEnter CALLED!');
  console.log('🔍 GSAP available?', typeof gsap !== 'undefined');
  
  // Get all stat items
  const statItems = Array.from(document.querySelectorAll('.stat-item')) as HTMLElement[];
  const statsHeader = document.querySelector('.stats-header') as HTMLElement;
  const resetButton = document.getElementById('stats-reset-btn') as HTMLElement;
  
  console.log('🔍 Found elements:', {
    statItems: statItems.length,
    statsHeader: !!statsHeader,
    resetButton: !!resetButton
  });
  
  if (statItems.length === 0 && !statsHeader && !resetButton) {
    console.error('❌ No elements found to animate!');
    return;
  }
  
  // 🔥 CRITICAL: Set initial state for ALL elements FIRST (scale 0, opacity 0)
  const allElements = [statsHeader, ...statItems, resetButton].filter(Boolean);
  console.log('🎯 Setting initial state for', allElements.length, 'elements...');
  
  try {
    gsap.set(allElements, { scale: 0, opacity: 0 });
    console.log('✅ Initial state set successfully');
  } catch (error) {
    console.error('❌ Failed to set initial state:', error);
    return;
  }
  
  // STEP 1: Header FIRST (0ms delay)
  if (statsHeader) {
    gsap.to(statsHeader, { 
      scale: 1, 
      opacity: 1,
      duration: 0.5,
      ease: 'back.out(1.7)',
      delay: 0
    });
    console.log('📊 Step 1: Stats header pop-in - FIRST');
  }
  
  // STEP 2: Stat items in RANDOM order (staggered)
  if (statItems.length > 0) {
    // Shuffle stat items for random order
    const shuffledItems = [...statItems];
    for (let i = shuffledItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledItems[i], shuffledItems[j]] = [shuffledItems[j], shuffledItems[i]];
    }
    
    // Animate each item with random stagger
    shuffledItems.forEach((item, index) => {
      const baseDelay = 0.05; // Start after header (50ms)
      const staggerMin = 0.03;
      const staggerMax = 0.06;
      const randomStagger = staggerMin + Math.random() * (staggerMax - staggerMin);
      const delay = baseDelay + (index * randomStagger);
      
      gsap.to(item, {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: 'back.out(1.7)',
        delay: delay
      });
      console.log(`📈 Step ${index + 2}: Stat item ${index + 1} pop-in - delay ${(delay * 1000).toFixed(0)}ms`);
    });
  }
  
  // STEP 3: Reset button LAST (after all stats)
  if (resetButton) {
    const lastDelay = 0.05 + (statItems.length * 0.045); // Approximate last item delay
    gsap.to(resetButton, {
      scale: 1,
      opacity: 1,
      duration: 0.5,
      ease: 'back.out(1.7)',
      delay: lastDelay + 0.03
    });
    console.log(`🔄 Step ${statItems.length + 2}: Reset button pop-in - LAST`);
  }
  
  console.log('✅ Stats screen enter animation started');
}

/**
 * Animate stats screen EXIT with pop-out effects
 * Elements pop out in reverse order: stats items first (random), then header last
 */
export function animateStatsScreenExit(): void {
  console.log('🎬 Starting stats screen EXIT animation (pop-out)...');
  
  // Get all stat items
  const statItems = Array.from(document.querySelectorAll('.stat-item')) as HTMLElement[];
  const statsHeader = document.querySelector('.stats-header') as HTMLElement;
  const resetButton = document.getElementById('stats-reset-btn') as HTMLElement;
  
  // STEP 1: Reset button FIRST (if exists)
  if (resetButton) {
    gsap.to(resetButton, {
      scale: 0,
      opacity: 0,
      duration: 0.4,
      ease: 'back.in(1.7)',
      delay: 0
    });
    console.log('🔄 Step 1: Reset button pop-out - FIRST');
  }
  
  // STEP 2: Stat items in RANDOM order (staggered)
  if (statItems.length > 0) {
    // Shuffle stat items for random order
    const shuffledItems = [...statItems];
    for (let i = shuffledItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledItems[i], shuffledItems[j]] = [shuffledItems[j], shuffledItems[i]];
    }
    
    // Animate each item with random stagger
    shuffledItems.forEach((item, index) => {
      const baseDelay = resetButton ? 0.03 : 0; // Start after reset button if it exists
      const staggerMin = 0.03;
      const staggerMax = 0.06;
      const randomStagger = staggerMin + Math.random() * (staggerMax - staggerMin);
      const delay = baseDelay + (index * randomStagger);
      
      gsap.to(item, {
        scale: 0,
        opacity: 0,
        duration: 0.4,
        ease: 'back.in(1.7)',
        delay: delay
      });
      console.log(`📉 Step ${index + (resetButton ? 2 : 1)}: Stat item ${index + 1} pop-out - delay ${(delay * 1000).toFixed(0)}ms`);
    });
  }
  
  // STEP 3: Header LAST (after all stats)
  if (statsHeader) {
    const lastDelay = (resetButton ? 0.03 : 0) + (statItems.length * 0.045); // Approximate last item delay
    gsap.to(statsHeader, {
      scale: 0,
      opacity: 0,
      duration: 0.4,
      ease: 'back.in(1.7)',
      delay: lastDelay + 0.03
    });
    console.log(`📊 Step ${statItems.length + (resetButton ? 2 : 1) + 1}: Stats header pop-out - LAST`);
  }
  
  console.log('✅ Stats screen exit animation started');
}

