// @ts-nocheck
// Board Transition Screen
// Shows board number before starting next board (interim board flow)

import { gsap } from 'gsap';
import { logger } from '../core/logger.js';
import { applyPaperBackground } from './ui-manager.js';

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
      'transform-style: preserve-3d'
    ].join(';');

    // Create "board" label with 3D shadow effect
    const label = document.createElement('p');
    label.textContent = 'board';
    
    // 🔥 USER REQUEST: Clean shadow for label (subtle, matches digits)
    label.style.cssText = [
      'font-family: "LTCrow", system-ui, -apple-system, sans-serif',
      'font-weight: 700',
      'font-size: 20px',
      'line-height: 1.8',
      'color: #ad8675',
      'text-align: center',
      'margin: 0',
      'opacity: 0',
      'transform: translateY(-20px) perspective(1000px) translateZ(0)',
      'transform-style: preserve-3d',
      '-webkit-font-smoothing: antialiased',
      '-moz-osx-font-smoothing: grayscale'
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
        'font-size: 144px', // 🔥 USER REQUEST: Increased by 20% (120px * 1.2 = 144px)
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

    // Assemble DOM
    container.appendChild(label);
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

    // Step 2: Animate "board" label with bounce (same as digits)
    // 🔥 USER REQUEST: Same bounce animation as digits
    // Set initial state
    gsap.set(label, {
      opacity: 0,
      scale: 0,
      rotation: -15 // Slight rotation for bounce effect
    });

    // Beautiful bounce animation (same as digits)
    // Scale 0 → 1.2 → 0.95 → 1.0 with elastic bounce
    const labelTimeline = gsap.timeline();
    
    // First bounce: scale 0 → 1.2 with 3D effect
    labelTimeline.to(label, {
      opacity: 1,
      scale: 1.2,
      rotation: 0,
      rotationX: 0,
      rotationY: 0,
      z: 10, // Slight 3D depth
      duration: 0.4, // Faster: 0.6s → 0.4s
      ease: 'back.out(2.0)'
    });
    
    // Settle: scale 1.2 → 0.95
    labelTimeline.to(label, {
      scale: 0.95,
      z: 0,
      duration: 0.15, // Faster: 0.2s → 0.15s
      ease: 'power2.out'
    });
    
    // Final settle: scale 0.95 → 1.0
    labelTimeline.to(label, {
      opacity: 1, // 🔥 CRITICAL FIX: Ensure full opacity in final state
      scale: 1.0,
      z: 0,
      duration: 0.2, // Faster: 0.3s → 0.2s
      ease: 'back.out(1.5)'
    });

    // Add label animation to main timeline (starts at 0.1s)
    enterTimeline.add(labelTimeline, 0.1);

    // Step 3: Animate digits with bounce animation (staggered)
    digitElements.forEach((digitEl, index) => {
      const delay = 0.3 + (index * 0.3); // Stagger by 0.3s per digit
      
      // 🔥 USER REQUEST: Generate random rotation between -8 and +8 degrees for each digit
      const randomRotation = -8 + Math.random() * 16; // Random between -8 and +8
      
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
                  startExitAnimation(overlay, container, label, digitElements, () => {
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
              duration: 0.5, // 500ms pause to let user see the complete board number
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
  label: HTMLElement,
  digitElements: HTMLElement[],
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

  // Reverse order: digits first (last to first), then label, then overlay

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

  // Step 2: Animate label out with bounce (same as digits)
  // 🔥 USER REQUEST: Same bounce exit animation as enter
  const labelExitTimeline = gsap.timeline();
  
  // First: scale 1.0 → 1.1 (slight overshoot) with 3D depth
  labelExitTimeline.to(label, {
    scale: 1.1,
    z: 20, // Push forward in 3D
    duration: 0.15,
    ease: 'power2.out'
  });
  
  // Then: scale 1.1 → 0 with 3D rotation and depth
  labelExitTimeline.to(label, {
    opacity: 0,
    scale: 0,
    rotation: 15,
    rotationX: 45, // 3D rotation
    rotationY: 15, // 3D rotation
    z: -50, // Pull back in 3D space
    duration: 0.3, // 🔥 USER REQUEST: Faster (0.5s → 0.3s)
    ease: 'power2.in'
  });
  
  exitTimeline.add(labelExitTimeline, 0.1); // Starts slightly after digits

  // Step 3: Fade out overlay (starts after label)
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
