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

let heartsModal: HTMLElement | null = null;
let timerInterval: NodeJS.Timeout | null = null;

function createCleanupRegistry(modalEl: HTMLElement): (fn: () => void) => void {
  const list: (() => void)[] = [];
  (modalEl as any)._cleanupFns = list;
  return function register(fn: () => void) {
    if (typeof fn === 'function') list.push(fn);
  };
}

function updateTimer(): void {
  if (!heartsModal) return;
  
  const timerElement = heartsModal.querySelector('.hearts-timer-value');
  if (timerElement) {
    const timeString = heartsSystem.getNextRefillTimeString();
    timerElement.textContent = timeString;
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
  
  // CRITICAL: Start with display: none to prevent flash
  heartsModal.style.display = 'none';
  
  const registerCleanup = createCleanupRegistry(heartsModal);
  
  const currentHearts = heartsSystem.getCurrentHearts();
  const maxHearts = heartsSystem.getMaxHearts();
  const timeString = heartsSystem.getNextRefillTimeString();
  
  // Create hearts HTML
  const heartsHTML = Array.from({ length: maxHearts }, (_, i) => {
    const isFilled = i < currentHearts;
    const heartImage = isFilled 
      ? '../../assets/modals/heart-life.png' 
      : '../../assets/modals/heart-life-empty.png';
    return `<img src="${heartImage}" alt="${isFilled ? 'Filled heart' : 'Empty heart'}" class="heart-icon" />`;
  }).join('');
  
  heartsModal.innerHTML = `
    <div class="modal-handle"></div>
    <div class="hearts-content">
      <div class="hearts-header">
        <h2 class="hearts-title">
          <span class="hearts-title-text">Your </span>
          <span class="hearts-title-accent">hearts</span>
        </h2>
      </div>
      
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
      
      <div class="hearts-cta">
        <button class="get-heart-btn primary-button">Get a heart</button>
      </div>
    </div>
  `;
  
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
  timerInterval = setInterval(() => {
    updateTimer();
    
    // Check if refill happened
    const newHearts = heartsSystem.getCurrentHearts();
    if (newHearts > currentHearts) {
      // Hearts refilled, update display
      showHeartsModal(); // Recreate modal with new hearts count
    }
  }, 1000);
  
  registerCleanup(() => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  });
  
  return heartsModal;
}

/**
 * Show hearts bottom sheet
 */
export function showHeartsModal(): void {
  try {
    const modal = createHeartsModal();
    document.body.appendChild(modal);
    
    // Trigger animation
    requestAnimationFrame(() => {
      if (modal) {
        modal.style.display = 'block';
        requestAnimationFrame(() => {
          if (modal) {
            modal.classList.add('visible');
            logger.info('💚 Hearts bottom sheet shown');
          }
        });
      }
    });
  } catch (error) {
    logger.error('❌ Failed to show hearts bottom sheet:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Hide hearts bottom sheet
 */
export function hideHeartsModal(): void {
  if (!heartsModal) return;
  
  try {
    // Clear timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    
    heartsModal.classList.remove('visible');
    
    setTimeout(() => {
      if (heartsModal) {
        heartsModal.remove();
        heartsModal = null;
        logger.info('💚 Hearts bottom sheet hidden');
      }
    }, 300); // Match transition duration
  } catch (error) {
    logger.error('❌ Failed to hide hearts bottom sheet:', error instanceof Error ? error.message : String(error));
  }
}

