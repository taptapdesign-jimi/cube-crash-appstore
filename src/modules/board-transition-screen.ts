// @ts-nocheck
// Board Transition Screen
// Shows board number before starting next board (interim board flow)

import { gsap } from 'gsap';
import { logger } from '../core/logger.js';
import { applyPaperBackground } from './ui-manager.js';
import { domElementPool } from './dom-element-pool.js';

interface BoardTransitionOptions {
  boardNumber: number;
  onComplete: () => void;
}

let isTransitionActive = false;
let currentOverlay: HTMLElement | null = null;
let activeTweens: gsap.core.Tween[] = [];
let enterTimeline: gsap.core.Timeline | null = null;
let exitTimeline: gsap.core.Timeline | null = null;
let pauseTimeline: gsap.core.Timeline | null = null;
let activeCloudImages: HTMLImageElement[] = []; // 🔥 IMAGE POOLING: Track cloud image elements for cleanup
let cloudTimelines: gsap.core.Timeline[] = []; // 🔥 MEMORY LEAK FIX: Track all cloud timelines (bounce, enter, exit)
let cloudDelayedCalls: gsap.core.Tween[] = []; // 🔥 MEMORY LEAK FIX: Track all delayedCall instances for cleanup
let activeForestImages: HTMLImageElement[] = []; // 🔥 IMAGE POOLING: Track forest image for cleanup
// 🔥 USER REQUEST: Smoke removal - no more smoke container tracking

/**
 * Show board transition screen with animated board number
 * @param options - Board number and completion callback
 */
export async function showBoardTransitionScreen(options: BoardTransitionOptions): Promise<void> {
  const { boardNumber, onComplete } = options;

  // 🔥 CRITICAL FIX: Validate boardNumber
  if (!Number.isFinite(boardNumber) || boardNumber < 1) {
    logger.error(`❌ board-transition-screen: Invalid boardNumber ${boardNumber}, using fallback 1`);
    // Don't return - use fallback instead
    const validBoardNumber = 1;
    return showBoardTransitionScreen({ boardNumber: validBoardNumber, onComplete });
  }

  logger.info(`🎯 board-transition-screen: Showing transition for board ${boardNumber}`);

  // Prevent duplicate calls
  if (isTransitionActive) {
    logger.warn('⚠️ board-transition-screen: Already active, skipping duplicate call');
    return;
  }

  isTransitionActive = true;
  logger.info('✅ board-transition-screen: isTransitionActive set to true, starting transition');

  // Cleanup any existing overlay
  cleanup();
  
  // 🔥 USER REQUEST: Reset paper background when transition screen closes
  // This will be called in cleanup() after transition completes

  return new Promise((resolve, reject) => {
    // 🔥 iOS APP STORE: Wrap in try-catch for error handling
    try {
      // 🔥 USER REQUEST: Apply paper background with same opacity as board game (35%)
      // This replaces the gray overlay with paper texture
      applyPaperBackground('0.35');
    } catch (error) {
      logger.error('❌ board-transition-screen: Failed to apply paper background:', error);
      // Continue anyway - non-critical
    }
    
    try {
    
    // Create overlay (transparent - paper bg shows through)
    const overlay = document.createElement('div');
    overlay.id = 'cc-board-transition-overlay';
    overlay.style.cssText = [
      'position: fixed',
      'inset: 0',
      'background: transparent', // 🔥 USER REQUEST: Transparent so paper bg shows through
      'z-index: 99999',
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'padding: 0', // 🔥 CRITICAL FIX: Remove padding that could affect centering
      'opacity: 0',
      'pointer-events: none',
      'visibility: visible' // 🔥 CRITICAL FIX: Ensure overlay is visible even when opacity is 0
    ].join(';');

    // Create container with 3D perspective
    const container = document.createElement('div');
    container.style.cssText = [
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'width: 100%',
      'gap: 0',
      // 🔥 USER REQUEST: 3D perspective for container
      'perspective: 1000px',
      'transform-style: preserve-3d',
      'position: relative',
      'z-index: 2' // 🔥 CRITICAL FIX: Ensure container (numbers) is above clouds (z-index: -1)
    ].join(';');

    // Create board number container
    const numberContainer = document.createElement('div');
    numberContainer.style.cssText = [
      'display: flex',
      'flex-direction: row',
      'align-items: center',
      'justify-content: center',
      'gap: 0px', // 🔥 USER REQUEST: No gap - digits should be very close together
      'margin-top: -8px', // 🔥 USER REQUEST: Reduced by 16px (from 8px to -8px) to bring closer to "board" text
      // 🔥 CRITICAL FIX: Remove all margins - will be positioned absolutely
      'margin-left: 0',
      'margin-right: 0',
      'margin-bottom: 0',
      'padding: 0',
      'width: fit-content', // Fit content exactly - no extra width
      'min-width: 0', // Prevent flex from adding extra width
      'max-width: 100%', // Prevent overflow
      'box-sizing: border-box', // Include padding/border in width calculation
      'position: relative'
    ].join(';');

    // Format board number as string (01, 02, etc.)
    const boardNumberStr = boardNumber.toString().padStart(2, '0');
    const digits = boardNumberStr.split('');
    
    logger.info(`🎯 board-transition-screen: Formatting board number ${boardNumber} as "${boardNumberStr}" with ${digits.length} digits`);

    // 🔥 CRITICAL FIX: Validate digits array is not empty
    if (digits.length === 0) {
      logger.error(`❌ board-transition-screen: No digits to display for board number ${boardNumber}`);
      cleanup();
      isTransitionActive = false;
      resolve();
      onComplete();
      return;
    }

    // Create digit elements with 3D extrusion effect
    const digitElements: HTMLElement[] = [];
    digits.forEach((digit, index) => {
      // 🔥 CRITICAL FIX: Create wrapper for digit
      const digitWrapper = document.createElement('div');
      digitWrapper.className = 'journey-board-card-wrapper';
      digitWrapper.style.cssText = [
        'display: inline-flex !important', // Override CSS class
        'align-items: center',
        'justify-content: center',
        'width: auto', // 🔥 CRITICAL FIX: Let content determine width - no min-width in layout
        'height: auto', // 🔥 CRITICAL FIX: Let content determine height
        'position: relative !important', // 🔥 CRITICAL FIX: Override absolute from CSS class
        // 🔥 CRITICAL FIX: Remove all spacing that could affect centering
        'margin: 0 !important',
        'padding: 0 !important',
        'border: 0 !important',
        'outline: 0 !important',
        'vertical-align: top', // Align to top to prevent baseline spacing
        'z-index: 10'
      ].join(';');
      
      const digitEl = document.createElement('span');
      digitEl.textContent = digit;
      digitEl.className = 'cc-board-transition-digit'; // For cleanup identification
      
      // 🔥 USER REQUEST: Add drop shadow from Figma spec
      // Figma drop shadow: X: 5px, Y: 12px, Blur: 16.1px, Spread: 0, Color: #D26D40 @ 25% opacity
      const dropShadow = 'drop-shadow(5px 12px 16.1px rgba(210, 109, 64, 0.25))';
      
      digitEl.style.cssText = [
        'font-family: "LTCrow", system-ui, -apple-system, sans-serif',
        'font-weight: 800',
        'font-size: 166px', // 🔥 USER REQUEST: Increased by 15% (144px * 1.15 = 165.6px ≈ 166px)
        'line-height: 1',
        'color: #e77449',
        'text-align: center',
        'opacity: 0',
        'transform: scale(0) perspective(1000px) translateZ(0)',
        'display: inline-block',
        'visibility: visible', // 🔥 CRITICAL FIX: Ensure element is visible
        'pointer-events: none',
        // 🔥 CRITICAL FIX: Remove all spacing that could affect centering
        'margin: 0',
        'padding: 0',
        'border: 0',
        'outline: 0',
        'vertical-align: top', // Align to top to prevent baseline spacing
        // 🔥 USER REQUEST: Add drop shadow from Figma
        `filter: ${dropShadow}`,
        'transform-style: preserve-3d',
        'backface-visibility: hidden',
        '-webkit-font-smoothing: antialiased',
        '-moz-osx-font-smoothing: grayscale',
        'text-rendering: optimizeLegibility',
        'font-variant-numeric: tabular-nums', // Stabilize digit widths for better centering
        'font-feature-settings: "tnum" 1',
        // 🔥 CRITICAL FIX: Set transform origin to center to prevent position shifts
        'transform-origin: center center',
        'position: relative',
        'z-index: 10'
      ].join(';');
      
      digitWrapper.appendChild(digitEl);
      numberContainer.appendChild(digitWrapper);
      digitElements.push(digitEl);
      logger.info(`✅ board-transition-screen: Created digit element ${index} with text "${digit}" and 3D extrusion`);
    });
    
    // 🔥 CRITICAL FIX: Validate digit elements were created
    if (digitElements.length === 0) {
      logger.error(`❌ board-transition-screen: Failed to create digit elements for board number ${boardNumber}`);
      cleanup();
      isTransitionActive = false;
      resolve();
      onComplete();
      return;
    }

    // 🔥 USER REQUEST: Create clouds background with cartoony bounce animation
    const cloudContainer = document.createElement('div');
    cloudContainer.style.cssText = [
      'position: absolute',
      'inset: 0',
      'pointer-events: none',
      'z-index: -1', // 🔥 CRITICAL FIX: Negative z-index to ensure clouds are behind text and numbers (z-index: 10)
      'overflow: hidden'
    ].join(';');
    
    // Cloud image paths
    // 🔥 USER REQUEST: Assets now in assets/board transition/ folder
    const cloudImages = [
      './assets/board transition/oblak+srednji.png', // 🔥 USER REQUEST: Updated from Layer 2.png
      './assets/board transition/oblak mali desno.png',
      './assets/board transition/oblak mali ljevo.png',
      './assets/board transition/oblak veliki ljevo dole.png'
    ];
    
    // Total screen duration: ~2.3s (enter + pause + exit) - 🔥 USER REQUEST: Reduced by 800ms (from 3.1s)
    const totalScreenDuration = 2.3;
    const moveAndScaleDuration = totalScreenDuration / 2; // Half time for move and scale
    const exitDuration = totalScreenDuration / 2; // Half time for exit
    
    // 🔥 USER REQUEST: 30% more clouds (16 * 1.3 = 20.8 ≈ 21) + 10 more for top/bottom = 31 total
    const totalClouds = 31;
    
    // 🔥 USER REQUEST: Distribution: 30% top, 30% middle, 30% bottom, 10% random fill
    const topCloudsCount = Math.floor(totalClouds * 0.3); // 30% top (≈9 clouds)
    const middleCloudsCount = Math.floor(totalClouds * 0.3); // 30% middle (≈9 clouds)
    const bottomCloudsCount = Math.floor(totalClouds * 0.3); // 30% bottom (≈9 clouds)
    const randomFillCount = totalClouds - topCloudsCount - middleCloudsCount - bottomCloudsCount; // 10% random (≈4 clouds)
    
    for (let i = 0; i < totalClouds; i++) {
      // 🔥 IMAGE POOLING: Use domElementPool instead of creating new img elements
      const cloudImg = domElementPool.acquire('img') as HTMLImageElement;
      const cloudImageIndex = i % cloudImages.length;
      cloudImg.src = cloudImages[cloudImageIndex];
      
      // 🔥 IMAGE POOLING: Track cloud image element for cleanup
      activeCloudImages.push(cloudImg);
      
      // 🔥 USER REQUEST: 50% of clouds 40% smaller
      // 🔥 USER REQUEST: Max size is 65% of original
      const isSmaller = i < Math.floor(totalClouds / 2); // First half are smaller
      
      let baseSize;
      if (isSmaller) {
        baseSize = (0.15 + Math.random() * 0.5) * 0.6; // 40% smaller (0.09 to 0.39x)
      } else {
        baseSize = 0.15 + Math.random() * 0.5; // Normal size (0.15 to 0.65x) - max 65% of original
      }
      const randomSize = baseSize;
      
      // 🔥 USER REQUEST: Distribution: 30% top, 30% middle, 30% bottom, 10% random
      let baseTop;
      if (i < topCloudsCount) {
        // 30% top clouds
        baseTop = Math.random() * 25; // Top 0-25% of screen
      } else if (i < topCloudsCount + middleCloudsCount) {
        // 30% middle clouds
        baseTop = 35 + Math.random() * 30; // Middle 35-65% of screen
      } else if (i < topCloudsCount + middleCloudsCount + bottomCloudsCount) {
        // 30% bottom clouds
        baseTop = 75 + Math.random() * 25; // Bottom 75-100% of screen
      } else {
        // 10% random fill clouds
        baseTop = Math.random() * 100; // Random anywhere on screen
      }
      
      // 🔥 USER REQUEST: Even more vertical spacing between clouds
      const spacingOffset = (Math.random() - 0.5) * 50; // -25% to +25% offset (50% total range)
      const spawnTop = baseTop + spacingOffset;
      
      // 🔥 USER REQUEST: Random horizontal spawn position - some left, some right, some center
      const randomLeft = Math.random() * 100; // 0-100% random horizontal position
      
      cloudImg.style.cssText = [
        'position: absolute',
        'pointer-events: none',
        'opacity: 0',
        'will-change: transform, opacity',
        `top: ${spawnTop}%`, // 🔥 USER REQUEST: Random vertical position
        `left: ${randomLeft}%`, // 🔥 USER REQUEST: Random horizontal position (not all in center)
        'transform-origin: center center',
        'transform-style: preserve-3d' // 🔥 CRITICAL FIX: Enable 3D transforms for bounce out exit animation
      ].join(';');
      
      // Calculate initial x position (centered on spawn position)
      const initialXPercent = -50; // Center on spawn position (left: X% + transform -50% = center of element)
      
      // 🔥 USER REQUEST: 50% go right, 50% go left (split evenly)
      const goesLeft = i >= Math.floor(totalClouds / 2); // Second half go left, first half go right
      
      // 🔥 USER REQUEST: Random distances and timeframes for natural sky look
      const randomDistance = 60 + Math.random() * 40; // 60-100% distance (random)
      // Calculate end position relative to spawn position
      // If spawn is at randomLeft%, we move from center (-50%) to end position
      const endXPercent = goesLeft 
        ? initialXPercent - randomDistance // Move left from spawn position
        : initialXPercent + randomDistance; // Move right from spawn position
      
      // 🔥 USER REQUEST: Random timeframe for each cloud
      // 🔥 USER REQUEST: 50% slower movement (duration * 2)
      const randomMoveDuration = (moveAndScaleDuration - 0.3) * (0.7 + Math.random() * 0.6) * 2; // 50% slower (duration doubled)
      
      cloudContainer.appendChild(cloudImg);
      
      // Random rotation for fluffy effect
      const randomRotation = (Math.random() - 0.5) * 20; // -10 to +10 degrees
      
      // Set initial state (spawn at center of viewport with spacing offset)
      gsap.set(cloudImg, {
        x: `${initialXPercent}%`,
        y: '-50%',
        scale: 0,
        opacity: 0,
        rotation: randomRotation
      });
      
      // 🔥 USER REQUEST: Continuous idle bounce animation (always active, starts immediately)
      const bounceAmount = 8 + Math.random() * 12; // 8-20px bounce
      const bounceSpeed = 0.4 + Math.random() * 0.3; // 0.4-0.7s per bounce
      const bounceRotation = 2 + Math.random() * 3; // Random rotation amount
      const bounceTimeline = gsap.timeline({ repeat: -1 }); // Infinite repeat
      
      // 🔥 MEMORY LEAK FIX: Track bounce timeline for cleanup
      cloudTimelines.push(bounceTimeline);
      
      bounceTimeline.to(cloudImg, {
        y: `+=${bounceAmount}px`,
        rotation: `+=${bounceRotation}`,
        duration: bounceSpeed / 2,
        ease: 'sine.out'
      }).to(cloudImg, {
        y: `-=${bounceAmount}px`,
        rotation: `-=${bounceRotation}`,
        duration: bounceSpeed / 2,
        ease: 'sine.in'
      });
      
      // 🔥 USER REQUEST: Enter animation with stagger
      let enterDelay: number;
      if (i >= topCloudsCount && i < topCloudsCount + middleCloudsCount) {
        const middleIndex = i - topCloudsCount;
        enterDelay = 0.1 + (middleIndex * 0.05);
      } else if (i < topCloudsCount) {
        const topIndex = i;
        enterDelay = 0.1 + (middleCloudsCount * 0.05) + (topIndex * 0.05);
      } else if (i < topCloudsCount + middleCloudsCount + bottomCloudsCount) {
        const bottomIndex = i - (topCloudsCount + middleCloudsCount);
        enterDelay = 0.1 + (middleCloudsCount * 0.05) + (bottomIndex * 0.05);
      } else {
        const randomIndex = i - (topCloudsCount + middleCloudsCount + bottomCloudsCount);
        enterDelay = 0.1 + (middleCloudsCount * 0.05) + (randomIndex * 0.05);
      }
      
      // Create cloud animation timeline with stagger delay
      const cloudTimeline = gsap.timeline({ delay: enterDelay });
      
      // 🔥 MEMORY LEAK FIX: Track cloud timeline for cleanup
      cloudTimelines.push(cloudTimeline);
      
      // 🔥 USER REQUEST: Enter animation - opacity and scale with bounce
      cloudTimeline.to(cloudImg, {
        opacity: 1,
        scale: randomSize * 1.2,
        duration: 0.4,
        ease: 'back.out(2.0)'
      });
      
      // Settle: scale back to final size
      cloudTimeline.to(cloudImg, {
        scale: randomSize,
        duration: 0.15,
        ease: 'power2.out'
      }, '>0');
      
      // 🔥 USER REQUEST: Immediately start moving - some left, some right
      cloudTimeline.to(cloudImg, {
        x: `${endXPercent}%`,
        duration: randomMoveDuration,
        ease: 'sine.inOut'
      }, '>0');
      
      // 🔥 USER REQUEST: Exit animation - clouds keep moving during exit!
      const exitStartPercent = 0.6 + Math.random() * 0.25;
      const exitStartTime = enterDelay + 0.55 + (randomMoveDuration * exitStartPercent);
      
      const delayedCall = gsap.delayedCall(exitStartTime, () => {
        if (!activeCloudImages.includes(cloudImg)) {
          return;
        }
        
        // 🔥 USER REQUEST: Only kill bounce, NOT cloudTimeline - so x movement continues!
        bounceTimeline.kill();
        
        const currentScale = gsap.getProperty(cloudImg, 'scale') as number;
        const bounceOutScale = currentScale * 1.2;
        
        gsap.set(cloudImg, { transformOrigin: 'center center' });
        
        const cloudExitTimeline = gsap.timeline();
        cloudTimelines.push(cloudExitTimeline);
        
        // Bounce out while still moving horizontally
        cloudExitTimeline.to(cloudImg, {
          scale: bounceOutScale,
          z: 30,
          duration: 0.15,
          ease: 'power2.out'
        });
        
        cloudExitTimeline.to(cloudImg, {
          opacity: 0,
          scale: 0,
          z: -100,
          duration: 0.3,
          ease: 'power2.in'
        });
      });
      
      cloudDelayedCalls.push(delayedCall);
    }
    
    overlay.appendChild(cloudContainer);

    // 🔥 USER REQUEST: Forest at bottom (-150px below viewport), in front of clouds, behind digits
    const forestContainer = document.createElement('div');
    forestContainer.className = 'cc-board-transition-forest';
    forestContainer.style.cssText = [
      'position: absolute',
      'left: 0',
      'right: 0',
      'bottom: -190px',
      'width: 100%',
      'height: 42vh',
      'pointer-events: none',
      'z-index: 0',
      'overflow: hidden',
      'transform-origin: center bottom',
      'transform-style: preserve-3d',
      'will-change: transform, opacity'
    ].join(';');
    const forestImg = domElementPool.acquire('img') as HTMLImageElement;
    forestImg.src = './assets/journey assets/forest.png';
    forestImg.alt = 'Forest';
    forestImg.style.cssText = [
      'position: absolute',
      'left: 0',
      'bottom: 0',
      'width: 100%',
      'height: 100%',
      'object-fit: cover',
      'object-position: bottom center',
      'display: block',
      'pointer-events: none'
    ].join(';');
    activeForestImages.push(forestImg);
    forestContainer.appendChild(forestImg);
    overlay.appendChild(forestContainer);

    // Assemble DOM
    container.appendChild(numberContainer);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    currentOverlay = overlay;
    
    logger.info(`🎯 board-transition-screen: Overlay added to DOM`);
    
    logger.info(`🎯 board-transition-screen: Created ${digitElements.length} digit elements`);
    
    // Kill any existing tweens and timelines
    activeTweens.forEach(tween => {
      try { tween.kill(); } catch {}
    });
    activeTweens = [];

    if (enterTimeline) {
      try { enterTimeline.kill(); } catch {}
      enterTimeline = null;
    }
    
    if (exitTimeline) {
      try { exitTimeline.kill(); } catch {}
      exitTimeline = null;
    }
    
    if (pauseTimeline) {
      try { pauseTimeline.kill(); } catch {}
      pauseTimeline = null;
    }

    // ENTER ANIMATION - exit will start after last digit completes
    enterTimeline = gsap.timeline({
      onStart: () => {
        logger.info('✅ board-transition-screen: Enter timeline started');
      },
      onComplete: () => {
        logger.info('✅ board-transition-screen: Enter timeline completed');
      }
    });

    // Step 1: Fade in overlay (0.2s - faster)
    enterTimeline.to(overlay, {
      opacity: 1,
      duration: 0.2,
      ease: 'power2.out'
    }, 0);

    // 🔥 USER REQUEST: Screen shake at start of enter animation (0.3s earlier than before)
    enterTimeline.call(() => {
      try {
        // Screen shake effect at start of enter animation
        // 🔥 CRITICAL FIX: Only kill x, y transforms, not opacity (preserve overlay fade-in)
        gsap.killTweensOf(overlay, 'x,y');
        const shakeStrength = 15;
        const shakeDuration = 0.5;
        const shakeSteps = 20;
        
        const shakeTimeline = gsap.timeline({
          onStart: () => {
            // Only set x, y to 0, don't touch opacity
            gsap.set(overlay, { x: 0, y: 0 });
          }
        });
        
        // 🔥 MEMORY LEAK FIX: Track shake timeline for cleanup
        activeTweens.push(shakeTimeline);
        
        for (let i = 0; i < shakeSteps; i++) {
          const progress = i / shakeSteps;
          const intensity = shakeStrength * (1 - progress);
          const shakeX = (Math.random() - 0.5) * intensity * 2;
          const shakeY = (Math.random() - 0.5) * intensity * 2;
          
          shakeTimeline.to(overlay, {
            x: shakeX,
            y: shakeY,
            duration: shakeDuration / shakeSteps,
            ease: 'none'
          });
        }
        
        shakeTimeline.to(overlay, {
          x: 0,
          y: 0,
          duration: 0.1,
          ease: 'power2.out'
        });
        
        logger.info('💥 Board transition screen shake triggered at start of enter animation (0.3s earlier)');
      } catch (shakeError) {
        logger.warn('⚠️ Error triggering screen shake:', shakeError);
      }
    }, null, 0);

    // 🔥 USER REQUEST: Haptic feedback only
    // Trigger haptic feedback when first digit animation starts (0.65s = delay 0.3 + 0.35s)
    enterTimeline.call(() => {
      // Sequence of haptic impacts for longer, more satisfying feedback
      try {
        if (typeof (window as any).triggerHapticImpact === 'function') {
          // First strong impact
          (window as any).triggerHapticImpact('heavy');
          
          // Second impact after short delay (creates "boooop" effect)
          setTimeout(() => {
            try {
              (window as any).triggerHapticImpact('medium');
            } catch (e) {
              logger.warn('⚠️ Error triggering second haptic:', e);
            }
          }, 50); // 50ms delay for "boooop" effect
          
          // Third lighter impact for tail (optional - creates smoother ending)
          setTimeout(() => {
            try {
              (window as any).triggerHapticImpact('light');
            } catch (e) {
              logger.warn('⚠️ Error triggering third haptic:', e);
            }
          }, 120); // 120ms total for smooth "boooop" effect
          
          logger.info('📳 Board transition haptic sequence triggered (boooop effect)');
        } else if (navigator.vibrate) {
          // Fallback: Use vibration API with pattern for longer haptic
          // Pattern: [vibrate, pause, vibrate, pause, vibrate] = "boooop"
          navigator.vibrate([70, 30, 50, 20, 30]);
          logger.info('📳 Board transition haptic fallback (vibration pattern)');
        }
      } catch (error) {
        logger.warn('⚠️ Error triggering haptic:', error);
      }
    }, null, 0.65); // 🔥 USER REQUEST: Trigger at 0.65s (exactly when first digit animation starts - delay 0.3 + 0.35s)

    // 🔥 USER REQUEST: Forest enter animation, transform-origin center bottom
    gsap.set(forestContainer, {
      opacity: 0,
      scale: 0,
      rotation: -15,
      transformOrigin: 'center bottom'
    });
    const forestEnterTimeline = gsap.timeline();
    forestEnterTimeline.to(forestContainer, {
      opacity: 1,
      scale: 1.01, // 🔥 USER REQUEST: Minimal bounce overshoot
      rotation: 0,
      z: 10,
      duration: 0.4,
      ease: 'back.out(2.0)'
    });
    forestEnterTimeline.to(forestContainer, {
      scale: 0.95,
      z: 0,
      duration: 0.15,
      ease: 'power2.out'
    });
    forestEnterTimeline.to(forestContainer, {
      opacity: 1,
      scale: 1.0,
      z: 0,
      duration: 0.2,
      ease: 'back.out(1.5)'
    });
    enterTimeline.add(forestEnterTimeline, 0.1);

    // Step 3: Animate digits with bounce animation (staggered)
    digitElements.forEach((digitEl, index) => {
      const delay = 0.3 + (index * 0.3); // Stagger by 0.3s per digit
      
      // 🔥 USER REQUEST: Generate random rotation with opposite poles for adjacent digits
      // First digit: random between -8 and +8, second digit: opposite sign (always -+ or +-)
      const baseRotation = -8 + Math.random() * 16; // Random between -8 and +8
      // If index is even (0, 2, 4...), use baseRotation; if odd (1, 3, 5...), use opposite sign
      const randomRotation = index % 2 === 0 
        ? baseRotation 
        : -baseRotation; // Opposite sign for adjacent digits (always -+ or +-)
      
      // Set initial state (hidden)
      // 🔥 CRITICAL FIX: Ensure no transform properties that could affect horizontal position
      // 🔥 PERFORMANCE FIX: Add will-change and GPU acceleration BEFORE animation starts
      // This prevents layout reflow when properties change during animation
      digitEl.style.willChange = 'transform, opacity';
      digitEl.style.transform = 'translateZ(0)'; // Force GPU acceleration
      digitEl.style.backfaceVisibility = 'hidden'; // Better rendering performance
      digitEl.style.webkitBackfaceVisibility = 'hidden'; // iOS Safari
      // 🔥 PERFORMANCE FIX: Use contain to prevent layout interference
      digitEl.style.contain = 'layout style paint';
      
      gsap.set(digitEl, {
        opacity: 0,
        scale: 0,
        x: 0, // Explicitly set x to 0 to prevent horizontal offset
        y: 0, // Explicitly set y to 0
        rotation: randomRotation, // 🔥 USER REQUEST: Random rotation between -4 and +4 degrees
        rotationX: 0, // Ensure no rotation that could affect layout
        rotationY: 0,
        z: 0,
        force3D: true // Force 3D acceleration for better performance
      });

      // 🔥 USER REQUEST: Smoke effect when digit reaches final position (after enter animation completes)

      // Beautiful bounce animation for each digit
        const digitTimeline = gsap.timeline();
      
      // First bounce: scale 0 → 1.2 with 3D rotation for depth
        digitTimeline.to(digitEl, {
          opacity: 1,
          scale: 1.2,
        rotation: randomRotation, // 🔥 USER REQUEST: Keep random rotation throughout animation
        rotationX: -5, // Slight 3D rotation for depth
        rotationY: 0,
        z: 20, // 3D depth
        x: 0, // 🔥 CRITICAL FIX: Explicitly ensure no horizontal movement
        y: 0, // 🔥 CRITICAL FIX: Explicitly ensure no vertical movement
        transformOrigin: 'center center', // 🔥 CRITICAL FIX: Ensure transform origin is center
          duration: 0.4,
          ease: 'back.out(2.0)'
        });
      
      // Settle: scale 1.2 → 0.95 with 3D return
      digitTimeline.to(digitEl, {
        scale: 0.95,
        rotation: randomRotation, // 🔥 USER REQUEST: Keep random rotation throughout animation
        rotationX: 0,
        rotationY: 0,
        z: 0,
        x: 0, // 🔥 CRITICAL FIX: Explicitly ensure no horizontal movement
        y: 0, // 🔥 CRITICAL FIX: Explicitly ensure no vertical movement
        transformOrigin: 'center center', // 🔥 CRITICAL FIX: Ensure transform origin is center
        duration: 0.15,
        ease: 'power2.out'
        // 🔥 USER REQUEST: Smoke effect removed - user wants no smoke
      });
      
      // Final settle: scale 0.95 → 1.0 with perfect 3D position
      digitTimeline.to(digitEl, {
        opacity: 1, // 🔥 CRITICAL FIX: Ensure full opacity in final state
        scale: 1.0,
        rotation: randomRotation, // 🔥 USER REQUEST: Keep random rotation throughout animation
        rotationX: 0,
        rotationY: 0,
        z: 0,
        x: 0, // 🔥 CRITICAL FIX: Explicitly ensure no horizontal offset
        y: 0, // 🔥 CRITICAL FIX: Explicitly ensure no vertical offset
        transformOrigin: 'center center', // 🔥 CRITICAL FIX: Ensure transform origin is center
        duration: 0.2,
        ease: 'back.out(1.5)',
        onComplete: () => {
          // 🔥 APP STORE: Cleanup will-change after animation completes
          digitEl.style.willChange = 'auto';
          
          // 🔥 USER REQUEST: Smoke effect removed - no smoke to show
          // showPreCreatedSmoke removed
          
          // 🔥 CRITICAL FIX: Start exit animation when LAST digit completes
          if (index === digitElements.length - 1) {
            logger.info('✅ board-transition-screen: All enter animations complete, starting exit');
            
            // Add a small pause before starting exit using GSAP timeline
            // 🔥 CRITICAL FIX: Store pauseTimeline for cleanup
            if (pauseTimeline) {
              try { pauseTimeline.kill(); } catch {}
            }
            
            pauseTimeline = gsap.timeline({
              onComplete: () => {
                pauseTimeline = null;
                try {
                  startExitAnimation(overlay, container, digitElements, forestContainer, () => {
                    cleanup();
                    isTransitionActive = false;
                    // 🔥 USER REQUEST: Reset paper background when transition screen closes
                    // Note: This will be reset by the next screen (board game or journey)
                    resolve();
                    try {
                      onComplete();
                    } catch (onCompleteError) {
                      logger.error('❌ board-transition-screen: onComplete callback failed:', onCompleteError);
                    }
                  });
                } catch (exitError) {
                  logger.error('❌ board-transition-screen: Failed to start exit animation:', exitError);
                  // Fallback: cleanup and resolve anyway
                  cleanup();
                  isTransitionActive = false;
                  resolve();
                  try {
                    onComplete();
                  } catch (onCompleteError) {
                    logger.error('❌ board-transition-screen: onComplete callback failed:', onCompleteError);
                  }
                }
              }
            });
            
            pauseTimeline.to({}, {
              duration: 0.7, // 🔥 USER REQUEST: 0.7s pause (reduced by 800ms from 1.5s) to shorten screen duration
      ease: 'none'
            });
          }
        }
      });
      
      enterTimeline.add(digitTimeline, delay);
    });
    
    // 🔥 CRITICAL FIX: Ensure timeline starts playing
    // GSAP timelines start automatically, but let's ensure it's playing
    if (enterTimeline && enterTimeline.paused()) {
      enterTimeline.play();
    }
    
    logger.info(`✅ board-transition-screen: Enter timeline created and started for board ${boardNumber}`);
    
    } catch (error) {
      logger.error('❌ board-transition-screen: Error in showBoardTransitionScreen:', error);
      // Cleanup and resolve on error
      cleanup();
      isTransitionActive = false;
      resolve();
      try {
        onComplete();
      } catch (onCompleteError) {
        logger.error('❌ board-transition-screen: onComplete callback failed in error handler:', onCompleteError);
      }
    }
  });
}

/**
 * Start exit animation (reverse of enter)
 */
function startExitAnimation(
  overlay: HTMLElement,
  container: HTMLElement,
  digitElements: HTMLElement[],
  forestContainer: HTMLElement | null,
  onComplete: () => void
): void {
  // 🔥 CRITICAL FIX: Kill any existing exit timeline before creating new one
  if (exitTimeline) {
    try { exitTimeline.kill(); } catch {}
  }
  
  exitTimeline = gsap.timeline({
    onComplete: () => {
      logger.info('✅ board-transition-screen: Exit animation complete');
      exitTimeline = null;
      onComplete();
    }
  });

  // Reverse order: digits first (last to first), then forest, then overlay

  // Step 1: Animate digits out with bounce (left-to-right, sequential)
    digitElements.forEach((digitEl, index) => {
      const delay = index * 0.4; // Stagger by 400ms per digit
      
    const digitExitTimeline = gsap.timeline();
    
    // First: scale 1.0 → 1.1 (slight overshoot) with 3D depth
      digitExitTimeline.to(digitEl, {
        scale: 1.1,
      z: 30, // Push forward in 3D
        duration: 0.15,
        ease: 'power2.out'
      });
    
    // Then: scale 1.1 → 0 with 3D rotation and depth fade
      digitExitTimeline.to(digitEl, {
        opacity: 0,
        scale: 0,
        rotation: index % 2 === 0 ? 15 : -15,
      rotationX: index % 2 === 0 ? 45 : -45, // 3D rotation
      rotationY: index % 2 === 0 ? 30 : -30, // 3D rotation
      z: -100, // Pull back in 3D space
        duration: 0.3,
        ease: 'power2.in'
      });
    
      exitTimeline.add(digitExitTimeline, delay);
    });

  // Step 2: Forest exit animation
  if (forestContainer) {
    const forestExitTimeline = gsap.timeline();
    forestExitTimeline.to(forestContainer, {
      scale: 1.01,
      z: 20,
      duration: 0.15,
      ease: 'power2.out'
    });
    forestExitTimeline.to(forestContainer, {
      opacity: 0,
      scale: 0,
      rotation: 15,
      rotationX: 45,
      rotationY: 15,
      z: -50,
      duration: 0.3,
      ease: 'power2.in'
    });
    exitTimeline.add(forestExitTimeline, 0.1);
  }

  // Step 3: Fade out overlay
  exitTimeline.to(overlay, {
    opacity: 0,
    duration: 0.3, // 🔥 USER REQUEST: Faster (0.4s → 0.3s)
    ease: 'power2.in'
  }, 0.25);

  // Store tweens for cleanup
  exitTimeline.getChildren().forEach(tween => {
    activeTweens.push(tween);
  });
}

/**
 * Cleanup function - iOS App Store ready
 * Ensures all animations, timelines, and DOM elements are properly cleaned up
 */
function cleanup(): void {
  // 🔥 CRITICAL: Kill all active tweens
  activeTweens.forEach(tween => {
    try { 
      if (tween && typeof tween.kill === 'function') {
        tween.kill(); 
      }
    } catch (error) {
      logger.warn('⚠️ Error killing tween in cleanup:', error);
    }
  });
  activeTweens = [];

  // 🔥 CRITICAL: Kill all timelines
  if (enterTimeline) {
    try { 
      if (enterTimeline && typeof enterTimeline.kill === 'function') {
        enterTimeline.kill(); 
      }
    } catch (error) {
      logger.warn('⚠️ Error killing enterTimeline in cleanup:', error);
    }
    enterTimeline = null;
  }
  
  if (exitTimeline) {
    try { 
      if (exitTimeline && typeof exitTimeline.kill === 'function') {
        exitTimeline.kill(); 
      }
    } catch (error) {
      logger.warn('⚠️ Error killing exitTimeline in cleanup:', error);
    }
    exitTimeline = null;
  }
  
  if (pauseTimeline) {
    try { 
      if (pauseTimeline && typeof pauseTimeline.kill === 'function') {
        pauseTimeline.kill(); 
      }
    } catch (error) {
      logger.warn('⚠️ Error killing pauseTimeline in cleanup:', error);
    }
    pauseTimeline = null;
  }
  
  // 🔥 MEMORY LEAK FIX: Kill all delayedCall instances first (prevents callbacks from executing)
  cloudDelayedCalls.forEach(delayedCall => {
    try {
      if (delayedCall && typeof delayedCall.kill === 'function') {
        delayedCall.kill();
      }
    } catch (error) {
      logger.warn('⚠️ Error killing cloud delayedCall in cleanup:', error);
    }
  });
  cloudDelayedCalls = [];
  
  // 🔥 MEMORY LEAK FIX: Kill all cloud timelines (bounce, enter, exit)
  cloudTimelines.forEach(timeline => {
    try {
      if (timeline && typeof timeline.kill === 'function') {
        timeline.kill();
      }
    } catch (error) {
      logger.warn('⚠️ Error killing cloud timeline in cleanup:', error);
    }
  });
  cloudTimelines = [];
  
  // 🔥 IMAGE POOLING: Release all cloud images back to pool
  activeCloudImages.forEach(cloudImg => {
    try {
      gsap.killTweensOf(cloudImg);
      domElementPool.release(cloudImg);
    } catch (error) {
      logger.warn('⚠️ Error releasing cloud image to pool:', error);
    }
  });
  activeCloudImages = [];

  // 🔥 IMAGE POOLING: Release forest image back to pool
  activeForestImages.forEach(forestImg => {
    try {
      gsap.killTweensOf(forestImg);
      domElementPool.release(forestImg);
    } catch (error) {
      logger.warn('⚠️ Error releasing forest image to pool:', error);
    }
  });
  activeForestImages = [];

  // 🔥 APP STORE: Kill animations on forest container
  try {
    const forestContainers = document.querySelectorAll('.cc-board-transition-forest');
    forestContainers.forEach(container => {
      try {
        gsap.killTweensOf(container);
      } catch {}
    });
  } catch (error) {
    logger.warn('⚠️ Error cleaning up forest container:', error);
  }

  // 🔥 APP STORE: Clear any digit element references
  try {
    const digitElements = document.querySelectorAll('.cc-board-transition-digit');
    digitElements.forEach(digit => {
      try {
        // Kill any remaining animations
        gsap.killTweensOf(digit);
      } catch {}
    });
  } catch (error) {
    logger.warn('⚠️ Error cleaning up digit elements:', error);
  }

  // 🔥 CRITICAL: Remove overlay from DOM and cleanup all child elements
  if (currentOverlay) {
    try {
      // Kill all animations on overlay and children first
      gsap.killTweensOf(currentOverlay);
      const overlayChildren = currentOverlay.querySelectorAll('*');
      overlayChildren.forEach(child => {
        try {
          gsap.killTweensOf(child);
        } catch {}
      });
      
      // Remove from DOM
      if (currentOverlay.parentNode) {
        currentOverlay.parentNode.removeChild(currentOverlay);
      } else {
        currentOverlay.remove();
      }
    } catch (error) {
      logger.warn('⚠️ Error removing overlay:', error);
    }
    currentOverlay = null;
  }

  // 🔥 CRITICAL: Also try to remove by ID (safety fallback)
  try {
    const existing = document.getElementById('cc-board-transition-overlay');
    if (existing) {
      // Kill animations before removing
      gsap.killTweensOf(existing);
      const existingChildren = existing.querySelectorAll('*');
      existingChildren.forEach(child => {
        try {
          gsap.killTweensOf(child);
        } catch {}
      });
      
      if (existing.parentNode) {
        existing.parentNode.removeChild(existing);
      } else {
        existing.remove();
      }
    }
  } catch (error) {
    logger.warn('⚠️ Error removing overlay by ID:', error);
  }
  
  // 🔥 APP STORE: Force garbage collection hints (iOS Safari)
  // Clear all references to help GC
  try {
    // Clear any remaining references
    if (typeof (window as any).gc === 'function') {
      // Only if explicit GC is available (dev mode)
      (window as any).gc();
    }
  } catch {}
  
  logger.info('✅ board-transition-screen: Cleanup complete - all resources released');
}

/**
 * Force cleanup (exported for emergency cleanup)
 * iOS App Store ready - ensures complete cleanup in case of errors
 */
export function cleanupBoardTransitionScreen(): void {
  try {
    // 🔥 APP STORE: Force cleanup - ensure everything is released
    cleanup();
    isTransitionActive = false;
    
    // 🔥 APP STORE: Additional cleanup to ensure no memory leaks
    // 🔥 USER REQUEST: Smoke removal - no more smoke cleanup needed
    // Cleanup removed
    
    logger.info('✅ board-transition-screen: Force cleanup completed - all resources released');
  } catch (error) {
    logger.error('❌ board-transition-screen: Force cleanup failed:', error);
    // Fallback: at least reset the flags
    isTransitionActive = false;
    currentOverlay = null;
    // 🔥 USER REQUEST: Smoke removal - no more smoke containers/animations
  }
}

// 🔥 USER REQUEST: Smoke effects removed - no more smoke functions needed
