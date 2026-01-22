// @ts-nocheck
// Board Transition Screen
// Shows board number before starting next board (interim board flow)

import { logger } from '../core/logger.js';

interface BoardTransitionOptions {
  boardNumber: number;
  onComplete: () => void;
}

let isTransitionActive = false;
let currentOverlay: HTMLElement | null = null;
let activeTweens: gsap.core.Tween[] = [];

/**
 * Show board transition screen with animated board number
 * @param options - Board number and completion callback
 */
export async function showBoardTransitionScreen(options: BoardTransitionOptions): Promise<void> {
  const { boardNumber, onComplete } = options;

  // Prevent duplicate calls
  if (isTransitionActive) {
    logger.warn('⚠️ board-transition-screen: Already active, skipping duplicate call');
    return;
  }

  isTransitionActive = true;

  // Cleanup any existing overlay
  cleanup();

  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'cc-board-transition-overlay';
    overlay.style.cssText = [
      'position: fixed',
      'inset: 0',
      'background: #f5f5f5',
      'z-index: 99999',
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'padding: 40px',
      'opacity: 0',
      'pointer-events: none'
    ].join(';');

    // Create container
    const container = document.createElement('div');
    container.style.cssText = [
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'width: 100%',
      'gap: 0'
    ].join(';');

    // Create "board" label
    const label = document.createElement('p');
    label.textContent = 'board';
    label.style.cssText = [
      'font-family: "LTCrow", system-ui, -apple-system, sans-serif',
      'font-weight: 700',
      'font-size: 20px',
      'line-height: 1.8',
      'color: #ad8675',
      'text-align: center',
      'margin: 0',
      'opacity: 0',
      'transform: translateY(-20px)'
    ].join(';');

    // Create board number container
    const numberContainer = document.createElement('div');
    numberContainer.style.cssText = [
      'display: flex',
      'flex-direction: row',
      'align-items: center',
      'justify-content: center',
      'gap: 0',
      'margin-top: 0'
    ].join(';');

    // Format board number as string (01, 02, etc.)
    const boardNumberStr = boardNumber.toString().padStart(2, '0');
    const digits = boardNumberStr.split('');

    // Create digit elements
    const digitElements: HTMLElement[] = [];
    digits.forEach((digit, index) => {
      const digitEl = document.createElement('span');
      digitEl.textContent = digit;
      digitEl.style.cssText = [
        'font-family: "LTCrow", system-ui, -apple-system, sans-serif',
        'font-weight: 800',
        'font-size: 120px',
        'line-height: 1',
        'color: #e77449',
        'text-align: center',
        'opacity: 0',
        'transform: scale(0)',
        'display: inline-block'
      ].join(';');
      numberContainer.appendChild(digitEl);
      digitElements.push(digitEl);
    });

    // Assemble DOM
    container.appendChild(label);
    container.appendChild(numberContainer);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    currentOverlay = overlay;

    // Kill any existing tweens
    activeTweens.forEach(tween => {
      try { tween.kill(); } catch {}
    });
    activeTweens = [];

    // ENTER ANIMATION (3 seconds total)
    const enterTimeline = gsap.timeline({
      onComplete: () => {
        logger.info('✅ board-transition-screen: Enter animation complete (3s)');
        
        // Immediately start exit animation
        startExitAnimation(overlay, label, digitElements, () => {
          cleanup();
          isTransitionActive = false;
          resolve();
          onComplete();
        });
      }
    });

    // Step 1: Fade in overlay (0.3s)
    enterTimeline.to(overlay, {
      opacity: 1,
      duration: 0.3,
      ease: 'power2.out'
    }, 0);

    // Step 2: Animate "board" label (0.6s, starts at 0.2s)
    // Set initial state
    gsap.set(label, {
      opacity: 0,
      y: -30,
      scale: 0.8
    });

    enterTimeline.to(label, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.6,
      ease: 'back.out(1.8)'
    }, 0.2);

    // Step 3: Animate digits sequentially with beautiful bounce
    // First digit starts at 0.5s
    // Second digit starts at 1.0s (0.5s after first)
    // Each digit has a longer bounce animation to fill the 3 seconds
    digitElements.forEach((digitEl, index) => {
      const delay = 0.5 + (index * 0.5);
      
      // Set initial state
      gsap.set(digitEl, {
        scale: 0,
        opacity: 0,
        rotation: index % 2 === 0 ? -15 : 15 // Slight rotation for bounce effect
      });

      // Beautiful bounce animation (similar to clean board modal stars)
      // Scale 0 → 1.2 → 0.95 → 1.0 with elastic bounce
      const digitTimeline = gsap.timeline();
      
      // First bounce: scale 0 → 1.2
      digitTimeline.to(digitEl, {
        opacity: 1,
        scale: 1.2,
        rotation: 0,
        duration: 0.6,
        ease: 'back.out(2.0)'
      });
      
      // Settle: scale 1.2 → 0.95
      digitTimeline.to(digitEl, {
        scale: 0.95,
        duration: 0.2,
        ease: 'power2.out'
      });
      
      // Final settle: scale 0.95 → 1.0
      digitTimeline.to(digitEl, {
        scale: 1.0,
        duration: 0.3,
        ease: 'back.out(1.5)'
      });

      // Add to main timeline with delay
      enterTimeline.add(digitTimeline, delay);
    });

    // Total enter animation: ~2.3s (last digit finishes around 2.3s)
    // Wait until 3s total before starting exit
    enterTimeline.to({}, {
      duration: 0.7, // Wait from 2.3s to 3.0s
      ease: 'none'
    }, 2.3);
  });
}

/**
 * Start exit animation (reverse of enter)
 */
function startExitAnimation(
  overlay: HTMLElement,
  label: HTMLElement,
  digitElements: HTMLElement[],
  onComplete: () => void
): void {
  const exitTimeline = gsap.timeline({
    onComplete: () => {
      logger.info('✅ board-transition-screen: Exit animation complete');
      onComplete();
    }
  });

  // Reverse order: digits first (last to first), then label, then overlay

  // Step 1: Animate digits out (reverse order) with scale down
  digitElements.reverse().forEach((digitEl, index) => {
    const delay = index * 0.08; // Stagger: 0s, 0.08s, etc.
    
    exitTimeline.to(digitEl, {
      opacity: 0,
      scale: 0,
      rotation: index % 2 === 0 ? 15 : -15, // Reverse rotation
      duration: 0.5,
      ease: 'power2.in'
    }, delay);
  });

  // Step 2: Animate label out (starts after digits start)
  exitTimeline.to(label, {
    opacity: 0,
    y: -30,
    scale: 0.8,
    duration: 0.5,
    ease: 'power2.in'
  }, 0.15);

  // Step 3: Fade out overlay (starts after label)
  exitTimeline.to(overlay, {
    opacity: 0,
    duration: 0.4,
    ease: 'power2.in'
  }, 0.3);

  // Store tweens for cleanup
  exitTimeline.getChildren().forEach(tween => {
    activeTweens.push(tween);
  });
}

/**
 * Cleanup function
 */
function cleanup(): void {
  // Kill all active tweens
  activeTweens.forEach(tween => {
    try { tween.kill(); } catch {}
  });
  activeTweens = [];

  // Remove overlay
  if (currentOverlay) {
    try {
      currentOverlay.remove();
    } catch {}
    currentOverlay = null;
  }

  // Also try to remove by ID (safety)
  try {
    const existing = document.getElementById('cc-board-transition-overlay');
    if (existing) {
      existing.remove();
    }
  } catch {}
}

/**
 * Force cleanup (exported for emergency cleanup)
 */
export function cleanupBoardTransitionScreen(): void {
  cleanup();
  isTransitionActive = false;
}

