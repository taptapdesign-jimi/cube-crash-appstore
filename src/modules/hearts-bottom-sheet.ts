/**
 * Hearts Bottom Sheet - Shows hearts status and refill timer
 * 
 * Features:
 * - Displays current hearts (filled/empty)
 * - Shows countdown timer for next refill
 * - CTA button to get more hearts (placeholder for future implementation)
 */

import { logger } from '../core/logger.js';
import { heartsSystem } from './hearts-system.js';
import { gsap } from 'gsap';

let heartsModal: HTMLElement | null = null;
let timerInterval: NodeJS.Timeout | null = null;
let heartsOverlay: HTMLElement | null = null;
/** Grace period (ms) after open – ignore overlay tap to avoid same-tap close (opens then immediately closes). */
const HEARTS_OVERLAY_CLOSE_GRACE_MS = 350;
let _heartsOpenedAt = 0;

// 🔥 MEMORY LEAK FIX: Track all timeouts, intervals, and animations for cleanup
const _heartsTimeouts = new Set<ReturnType<typeof setTimeout>>();
const _heartsIntervals = new Set<ReturnType<typeof setInterval>>();
const _heartsGSAPTweens: gsap.core.Tween[] = [];

function trackHeartsTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
  const timeout = setTimeout(() => {
    callback();
    _heartsTimeouts.delete(timeout);
  }, delay);
  _heartsTimeouts.add(timeout);
  return timeout;
}

function trackHeartsInterval(callback: () => void, delay: number): ReturnType<typeof setInterval> {
  const interval = setInterval(callback, delay);
  _heartsIntervals.add(interval);
  return interval;
}

function clearAllHeartsTimeouts(): void {
  console.log(`🧹 hearts-bottom-sheet: Clearing ${_heartsTimeouts.size} timeouts`);
  _heartsTimeouts.forEach(timeout => clearTimeout(timeout));
  _heartsTimeouts.clear();
}

function clearAllHeartsIntervals(): void {
  console.log(`🧹 hearts-bottom-sheet: Clearing ${_heartsIntervals.size} intervals`);
  _heartsIntervals.forEach(interval => clearInterval(interval));
  _heartsIntervals.clear();
}

function clearAllHeartsGSAPTweens(): void {
  console.log(`🧹 hearts-bottom-sheet: Killing ${_heartsGSAPTweens.length} GSAP tweens`);
  _heartsGSAPTweens.forEach(tween => {
    try {
      tween.kill();
    } catch (e) {}
  });
  _heartsGSAPTweens.length = 0;
}

function cleanupAllHeartsResources(): void {
  clearAllHeartsTimeouts();
  clearAllHeartsIntervals();
  clearAllHeartsGSAPTweens();
  console.log('✅ hearts-bottom-sheet: All resources cleaned up!');
}

function createCleanupRegistry(modalEl: HTMLElement): (fn: () => void) => void {
  const list: (() => void)[] = [];
  (modalEl as any)._cleanupFns = list;
  return function register(fn: () => void) {
    if (typeof fn === 'function') list.push(fn);
  };
}

function addDragFunctionality(modalEl: HTMLElement, registerCleanup: (fn: () => void) => void): void {
  logger.debug('💚 Adding drag functionality to hearts bottom sheet');

  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  
  // Clear any existing handlers first
  modalEl.ontouchstart = null;
  modalEl.ontouchmove = null;
  modalEl.ontouchend = null;
  modalEl.onmousedown = null;

  // Touch events on entire modal
  modalEl.ontouchstart = (e: TouchEvent) => {
    // Don't start drag if clicking on buttons
    if (e.target && (e.target as HTMLElement).closest('.get-heart-btn')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    startY = e.touches[0].clientY;
    currentY = startY;
    isDragging = true;
    
    // Clear any existing transform
    (modalEl.style as any).transform = '';
    (modalEl.style as any).transition = 'none';
  };

  modalEl.ontouchmove = (e: TouchEvent) => {
    if (!isDragging) return;
    
    // Don't move if on button
    if (e.target && (e.target as HTMLElement).closest('.get-heart-btn')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const touchY = e.touches[0].clientY;
    currentY = touchY;
    const deltaY = touchY - startY;
    
    // Only allow dragging down
    if (deltaY > 0) {
      (modalEl.style as any).transform = `translateY(${deltaY}px)`;
    } else {
      (modalEl.style as any).transform = 'translateY(0)';
    }
  };

  modalEl.ontouchend = (e: TouchEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    isDragging = false;
    
    const deltaY = currentY - startY;
    const threshold = 100;
    
    if (deltaY > threshold) {
      // Close modal
      logger.info('💚 Swipe down detected - closing hearts bottom sheet');
      hideHeartsModal();
    } else {
      // Snap back
      (modalEl.style as any).transition = 'transform 0.3s ease-out';
      (modalEl.style as any).transform = 'translateY(0)';
    }
  };

  registerCleanup(() => {
    modalEl.ontouchstart = null;
    modalEl.ontouchmove = null;
    modalEl.ontouchend = null;
    modalEl.onmousedown = null;
  });
}

function addBackdropClickListener(modalEl: HTMLElement, registerCleanup: (fn: () => void) => void): void {
  const handleDocumentClick = (e: MouseEvent) => {
    // Check if click is outside modal AND not on a button
    if (modalEl && !modalEl.contains(e.target as Node)) {
      hideHeartsModal();
    }
  };
  
  const handleDocumentTouchEnd = (e: TouchEvent) => {
    // Check if touch is outside modal AND not on a button
    if (modalEl && !modalEl.contains(e.target as Node)) {
      hideHeartsModal();
    }
  };
  
  // Attach with small delay to avoid capturing the click that opened the modal
  trackHeartsTimeout(() => {
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('touchend', handleDocumentTouchEnd);
  }, 100);
  
  registerCleanup(() => {
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('touchend', handleDocumentTouchEnd);
  });
}

let previousHeartsCount = 0; // Track previous hearts count for animation

function animateHeartRefill(heartIndex: number): void {
  if (!heartsModal) return;
  
  const heartIcons = heartsModal.querySelectorAll('.heart-icon');
  if (heartIndex < heartIcons.length) {
    const heartIcon = heartIcons[heartIndex] as HTMLImageElement;
    
    // Change from empty to filled
    heartIcon.src = '../../assets/modals/heart-life.png';
    heartIcon.alt = 'Filled heart';
    
    // Bouncy animation
    const fromTween = gsap.fromTo(heartIcon, 
      { scale: 0.3, opacity: 0 },
      { 
        scale: 1.2, 
        opacity: 1,
        duration: 0.3,
        ease: 'back.out(1.7)',
        onComplete: () => {
          const toTween = gsap.to(heartIcon, {
            scale: 1,
            duration: 0.2,
            ease: 'power2.out'
          });
          _heartsGSAPTweens.push(toTween);
        }
      }
    );
    _heartsGSAPTweens.push(fromTween);
    
    logger.info(`💚 Animated heart refill for heart ${heartIndex + 1}`);
  }
}

function updateTimer(): void {
  if (!heartsModal) return;
  
  const currentHearts = heartsSystem.getCurrentHearts();
  const maxHearts = heartsSystem.getMaxHearts();

  const timerElement = heartsModal.querySelector('.hearts-timer-value');
  if (timerElement) {
    // 🔥 USER REQUEST: Stop counter at 00:00 when all hearts are full
    if (currentHearts >= maxHearts) {
      timerElement.textContent = '00:00';
    } else {
      const timeString = heartsSystem.getNextRefillTimeString();
      timerElement.textContent = timeString;
    }
  }
  
  // 🔥 USER REQUEST: Animate heart refill when hearts increase
  if (currentHearts > previousHeartsCount) {
    // Find which heart was refilled (first empty heart that became filled)
    for (let i = previousHeartsCount; i < currentHearts; i++) {
      animateHeartRefill(i);
    }
    previousHeartsCount = currentHearts;
  } else if (currentHearts < previousHeartsCount) {
    // Hearts decreased while sheet is open (rare, but keep state consistent)
    previousHeartsCount = currentHearts;
  }
  
  // 🔥 USER REQUEST: Hide/show CTA button based on hearts count
  const heartsCTA = heartsModal.querySelector('.hearts-cta');
  if (heartsCTA) {
    if (currentHearts >= maxHearts) {
      // All hearts full - hide CTA
      (heartsCTA as HTMLElement).style.display = 'none';
    } else {
      // Not all hearts full - show CTA
      (heartsCTA as HTMLElement).style.display = 'flex';
    }
  }

  // If all hearts are full, stop ticking (keeps UI stable at 00:00)
  if (currentHearts >= maxHearts && timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function createHeartsModal(): HTMLElement {
  if (heartsModal) {
    // CRITICAL: Remove all event listeners before removing
    const oldModal = heartsModal;
    try {
      const cleanups = Array.isArray((oldModal as any)._cleanupFns) ? [...(oldModal as any)._cleanupFns] : [];
      cleanups.forEach(fn => {
        try { fn(); } catch (e) {}
      });
    } catch (e) {}
    
    // Clear timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    
    heartsModal.remove();
    heartsModal = null;
  }

  heartsModal = document.createElement('div');
  heartsModal.className = 'hearts-bottom-sheet';
  
  // 🔥 CRITICAL: Set z-index higher than fail modal (10000000000000) to appear on top
  heartsModal.style.zIndex = '10000000000001';
  
  // CRITICAL: Start with display: none to prevent flash
  heartsModal.style.display = 'none';
  
  const registerCleanup = createCleanupRegistry(heartsModal);
  
  const currentHearts = heartsSystem.getCurrentHearts();
  const maxHearts = heartsSystem.getMaxHearts();
  const timeString = heartsSystem.getNextRefillTimeString();
  
  // Initialize previous hearts count for animation tracking
  previousHeartsCount = currentHearts;
  
  // Create hearts HTML
  const heartsHTML = Array.from({ length: maxHearts }, (_, i) => {
    const isFilled = i < currentHearts;
    const heartImage = isFilled 
      ? '../../assets/modals/heart-life.png' 
      : '../../assets/modals/heart-life-empty.png';
    return `<img src="${heartImage}" alt="${isFilled ? 'Filled heart' : 'Empty heart'}" class="heart-icon" />`;
  }).join('');
  
  // 🔥 USER REQUEST: Hide CTA button when all 3 hearts are full
  const showCTA = currentHearts < maxHearts; // Only show when 0, 1, or 2 hearts
  const ctaHTML = showCTA 
    ? `<div class="hearts-cta">
        <button class="get-heart-btn primary-button">Get a heart</button>
      </div>`
    : ''; // No CTA when all hearts are full
  
  heartsModal.innerHTML = `
    <div class="modal-handle"></div>
    <div class="hearts-content">
      <h2 class="hearts-title">
        <span class="hearts-title-text">Your </span>
        <span class="hearts-title-accent">hearts</span>
      </h2>
      
      <div class="hearts-display">
        ${heartsHTML}
      </div>
      
      <p class="hearts-timer">
        <span class="hearts-timer-text">Next heart in </span>
        <span class="hearts-timer-value">${timeString}</span>
      </p>
      
      <p class="hearts-description">
        Hearts let you play boards<br>
        Fail a board and lose a heart
      </p>
      
      ${ctaHTML}
    </div>
  `;
  
  // Add drag functionality (swipe down to close)
  addDragFunctionality(heartsModal, registerCleanup);
  
  // Add backdrop click listener (click outside to close)
  addBackdropClickListener(heartsModal, registerCleanup);
  
  // Add click handler for CTA button
  const getHeartBtn = heartsModal.querySelector('.get-heart-btn');
  if (getHeartBtn) {
    (getHeartBtn as HTMLButtonElement).addEventListener('click', () => {
      logger.info('🔘 Get a heart button pressed');
      
      // Haptic feedback
      if (typeof (window as any).triggerHapticSelection === 'function') {
        (window as any).triggerHapticSelection();
      }
      
      // TODO: Open full screen page with options:
      // - Watch movie
      // - Spend stars to buy
      // - Purchase $0.99 USD
      // For now, just log
      logger.info('💚 Get heart flow - to be implemented');
    });
    registerCleanup(() => {
      (getHeartBtn as HTMLButtonElement).removeEventListener('click', () => {});
    });
  }
  
  // Start timer update interval (update every second)
  timerInterval = trackHeartsInterval(() => {
    // Refresh hearts system to check for refills
    heartsSystem.refreshUI();
    
    // Update timer (will also animate heart refills if needed)
    updateTimer();
  }, 1000);
  
  registerCleanup(() => {
    if (timerInterval) {
      clearInterval(timerInterval);
      _heartsIntervals.delete(timerInterval);
      timerInterval = null;
    }
  });
  
  return heartsModal;
}

/**
 * Animate hearts bottom sheet entrance (same as resume game modal)
 */
function animateHeartsEntrance(modal: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    logger.debug('💚 Starting hearts entrance animation');
    
    // Step 1: Set initial state
    modal.style.display = 'block';
    modal.style.transform = 'translateY(100%)';
    modal.style.transition = 'transform 0.4s ease-in-out';
    
    // Step 2: Force reflow
    void modal.offsetHeight;
    
    // Step 3: Trigger animation immediately
    modal.style.transform = 'translateY(0)';
    
    // Step 4: Wait for completion
    trackHeartsTimeout(() => {
      modal.classList.add('visible');
      logger.info('💚 Hearts bottom sheet shown');
      resolve();
    }, 400);
  });
}

function closeHeartsOnOverlayTap(): void {
  if (Date.now() - _heartsOpenedAt < HEARTS_OVERLAY_CLOSE_GRACE_MS) return;
  hideHeartsModal();
}

/**
 * Show hearts bottom sheet
 */
export function showHeartsModal(): void {
  try {
    _heartsOpenedAt = Date.now();

    // Add overlay to block background interactions
    if (!heartsOverlay) {
      heartsOverlay = document.createElement('div');
      heartsOverlay.id = 'hearts-overlay';
      heartsOverlay.style.cssText = `
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        z-index: 10000000000001;
        background: transparent;
        pointer-events: auto;
        touch-action: none;
      `;
      // Close on overlay click/tap; use wrapper to ignore same-tap that opened modal
      heartsOverlay.addEventListener('click', closeHeartsOnOverlayTap, { passive: true });
      heartsOverlay.addEventListener('touchend', closeHeartsOnOverlayTap, { passive: true });
      document.body.appendChild(heartsOverlay);
    }

    const modal = createHeartsModal();
    document.body.appendChild(modal);
    
    // Trigger animation (same timing as resume game modal)
    requestAnimationFrame(() => {
      animateHeartsEntrance(modal).catch((error) => {
        logger.error('❌ Animation failed:', error instanceof Error ? error.message : String(error));
        modal.classList.add('visible');
      });
    });
  } catch (error) {
    logger.error('❌ Failed to show hearts bottom sheet:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Hide hearts bottom sheet
 */
export function hideHeartsModal(): void {
  const modalEl = heartsModal;
  if (!modalEl || (modalEl as any)._closing) return;

  (modalEl as any)._closing = true;
  
  try {
    // Clear timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    
    // Animate out
    modalEl.style.transition = 'transform 0.3s ease-in-out';
    modalEl.style.transform = 'translateY(100%)';
    
    // Cleanup
    try {
      const cleanups = Array.isArray((modalEl as any)._cleanupFns) ? [...(modalEl as any)._cleanupFns] : [];
      (modalEl as any)._cleanupFns = [];
      cleanups.forEach(fn => {
        try { fn(); } catch (error) {
          logger.warn('⚠️ Cleanup failed:', error instanceof Error ? error.message : String(error));
        }
      });
    } catch (e) {
      // Ignore cleanup errors
    }
    
    // 🔥 MEMORY LEAK FIX: Cleanup all resources
    cleanupAllHeartsResources();
    
    trackHeartsTimeout(() => {
      modalEl.classList.remove('visible');
      
      // Force hide
      modalEl.style.display = 'none';
      modalEl.style.visibility = 'hidden';
      modalEl.style.zIndex = '-999999999';
      modalEl.style.transform = 'translateY(100vh)';
      modalEl.style.transition = 'none';
      
      try { modalEl.remove(); } catch (error) {
        logger.warn('⚠️ Failed to remove modal:', error instanceof Error ? error.message : String(error));
      }
      if (heartsModal === modalEl) {
        heartsModal = null;
      }

      // Remove overlay
      if (heartsOverlay) {
        try {
          heartsOverlay.removeEventListener('click', closeHeartsOnOverlayTap);
          heartsOverlay.removeEventListener('touchend', closeHeartsOnOverlayTap);
          heartsOverlay.remove();
        } catch (e) {}
        heartsOverlay = null;
      }
      logger.info('💚 Hearts bottom sheet hidden');
    }, 300);
  } catch (error) {
    logger.error('❌ Failed to hide hearts bottom sheet:', error instanceof Error ? error.message : String(error));
  }
}
