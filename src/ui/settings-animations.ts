import { logger } from '../core/logger.js';
import gsap from 'gsap';

/**
 * Animate settings screen ENTER with pop-in effects
 * Header first, then toggle containers and dividers sequentially (like stats)
 */
export function animateSettingsScreenEnter(): void {
  console.log('🎬🎬🎬 animateSettingsScreenEnter CALLED!');
  console.log('🔍 GSAP available?', typeof gsap !== 'undefined');
  
  // Get settings elements
  const settingsScreen = document.getElementById('settings-screen');
  const settingsHeader = settingsScreen?.querySelector('.settings-header') as HTMLElement;
  const toggleContainers = Array.from(settingsScreen?.querySelectorAll('.settings-toggle-container') || []) as HTMLElement[];
  const dividers = Array.from(settingsScreen?.querySelectorAll('.settings-divider') || []) as HTMLElement[];
  
  console.log('🔍 Found elements:', {
    settingsScreen: !!settingsScreen,
    settingsHeader: !!settingsHeader,
    toggleContainers: toggleContainers.length,
    dividers: dividers.length
  });
  
  if (!settingsScreen) {
    console.error('❌ No settings screen found to animate!');
    return;
  }
  
  // 🔥 CRITICAL: Set initial state for ALL elements (scale 0, opacity 0)
  const allElements = [settingsHeader, ...toggleContainers, ...dividers].filter(Boolean);
  console.log('🎯 Setting initial state for', allElements.length, 'elements...');
  
  try {
    gsap.set(allElements, { scale: 0, opacity: 0 });
    console.log('✅ Initial state set successfully');
  } catch (error) {
    console.error('❌ Failed to set initial state:', error);
    return;
  }
  
  // STEP 1: Header FIRST (0ms delay)
  if (settingsHeader) {
    gsap.to(settingsHeader, { 
      scale: 1, 
      opacity: 1, 
      duration: 0.5, 
      ease: 'back.out(1.7)', 
      delay: 0
    });
    console.log('📊 Step 1: Settings header pop-in - FIRST');
  }
  
  // STEP 2: Toggle containers and dividers sequentially (interleaved)
  // Order: toggle1, divider1, toggle2
  let animationIndex = 0;
  
  for (let i = 0; i < toggleContainers.length; i++) {
    const toggle = toggleContainers[i];
    const baseDelay = 0.05; // Start after header (50ms)
    const stagger = 0.08; // Sequential delay between items
    const delay = baseDelay + (animationIndex * stagger);
    
    gsap.to(toggle, {
      scale: 1,
      opacity: 1,
      duration: 0.5,
      ease: 'back.out(1.7)',
      delay: delay
    });
    console.log(`⚙️ Step ${animationIndex + 2}: Toggle ${i + 1} pop-in - delay ${(delay * 1000).toFixed(0)}ms`);
    animationIndex++;
    
    // Animate divider after toggle (if exists)
    if (dividers[i]) {
      const dividerDelay = baseDelay + (animationIndex * stagger);
      gsap.to(dividers[i], {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: 'back.out(1.7)',
        delay: dividerDelay
      });
      console.log(`➖ Step ${animationIndex + 2}: Divider ${i + 1} pop-in - delay ${(dividerDelay * 1000).toFixed(0)}ms`);
      animationIndex++;
    }
  }
  
  console.log('✅ Settings screen enter animation started');
}

/**
 * Animate settings screen EXIT with pop-out effects
 * Toggle containers and dividers first (reverse order), then header
 */
export function animateSettingsScreenExit(): void {
  console.log('🎬 animateSettingsScreenExit CALLED!');
  
  const settingsScreen = document.getElementById('settings-screen');
  const settingsHeader = settingsScreen?.querySelector('.settings-header') as HTMLElement;
  const toggleContainers = Array.from(settingsScreen?.querySelectorAll('.settings-toggle-container') || []) as HTMLElement[];
  const dividers = Array.from(settingsScreen?.querySelectorAll('.settings-divider') || []) as HTMLElement[];
  
  if (!settingsScreen) {
    console.error('❌ No settings screen found to animate!');
    return;
  }
  
  // STEP 1: Toggle containers and dividers FIRST (reverse order - bottom to top)
  // Build interleaved array: [toggle1, divider1, toggle2]
  const interleavedElements: HTMLElement[] = [];
  for (let i = 0; i < toggleContainers.length; i++) {
    interleavedElements.push(toggleContainers[i]);
    if (dividers[i]) {
      interleavedElements.push(dividers[i]);
    }
  }
  
  // Reverse for bottom-to-top exit
  interleavedElements.reverse().forEach((element, index) => {
    const baseDelay = 0;
    const stagger = 0.05; // Faster stagger for exit
    const delay = baseDelay + (index * stagger);
    
    gsap.to(element, {
      scale: 0,
      opacity: 0,
      duration: 0.4,
      ease: 'back.in(1.7)',
      delay: delay
    });
    
    const elementType = element.classList.contains('settings-divider') ? 'Divider' : 'Toggle';
    console.log(`⚙️ Step ${index + 1}: ${elementType} pop-out - delay ${(delay * 1000).toFixed(0)}ms`);
  });
  
  // STEP 2: Header LAST
  if (settingsHeader) {
    const lastDelay = interleavedElements.length > 0 ? (interleavedElements.length * 0.05) : 0;
    
    gsap.to(settingsHeader, {
      scale: 0,
      opacity: 0,
      duration: 0.4,
      ease: 'back.in(1.7)',
      delay: lastDelay + 0.05
    });
    console.log('📊 Header pop-out - LAST');
  }
  
  console.log('✅ Settings screen exit animation started');
}

