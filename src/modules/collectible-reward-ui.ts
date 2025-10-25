// collectible-reward-ui.ts
// UI components for collectible reward bottom sheet

import { buildMarkup, getDefaultCollectibleDetail, validateCollectibleDetail, registerCleanup, generateId } from './collectible-reward-utils.js';

// Types
interface CollectibleDetail {
  cardName?: string;
  imagePath?: string;
  rarity?: string;
}

interface WindowWithCollectibles extends Window {
  unlockSlider?: () => void;
  showCollectiblesScreen?: (options: {
    scrollToCard?: string;
    rarity?: string;
    animateCard?: boolean;
  }) => void;
}

/**
 * Create overlay element
 */
export function createOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'collectible-reward-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  
  return overlay;
}

/**
 * Create bottom sheet element
 */
export function createBottomSheet(detail: CollectibleDetail): HTMLElement {
  const validatedDetail = validateCollectibleDetail(detail);
  const markup = buildMarkup(validatedDetail);
  
  const sheet = document.createElement('div');
  sheet.innerHTML = markup;
  sheet.className = 'collectible-reward-sheet';
  sheet.style.cssText = `
    background: white;
    border-radius: 20px 20px 0 0;
    max-width: 500px;
    width: 100%;
    max-height: 80vh;
    overflow: hidden;
    transform: translateY(100%);
    transition: transform 0.3s ease;
    box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.3);
  `;
  
  return sheet;
}

/**
 * Add styles to document
 */
export function addStyles(): void {
  if (document.getElementById('collectible-reward-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'collectible-reward-styles';
  styles.textContent = `
    .collectible-reward-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    
    .collectible-reward-overlay.show {
      opacity: 1;
    }
    
    .collectible-reward-sheet {
      background: white;
      border-radius: 20px 20px 0 0;
      max-width: 500px;
      width: 100%;
      max-height: 80vh;
      overflow: hidden;
      transform: translateY(100%);
      transition: transform 0.3s ease;
      box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.3);
    }
    
    .collectible-reward-sheet.show {
      transform: translateY(0);
    }
    
    .collectible-reward-content {
      padding: 20px;
    }
    
    .collectible-reward-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .collectible-reward-title {
      margin: 0;
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }
    
    .collectible-reward-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      padding: 5px;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .collectible-reward-close:hover {
      background: #f0f0f0;
    }
    
    .collectible-reward-body {
      text-align: center;
    }
    
    .collectible-reward-card {
      margin-bottom: 30px;
    }
    
    .collectible-reward-image {
      position: relative;
      display: inline-block;
      margin-bottom: 15px;
    }
    
    .collectible-card-image {
      width: 120px;
      height: 120px;
      object-fit: cover;
      border-radius: 10px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }
    
    .collectible-reward-rarity {
      position: absolute;
      top: -5px;
      right: -5px;
      background: #333;
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    
    .rarity-common { background: #8B8B8B; }
    .rarity-uncommon { background: #4CAF50; }
    .rarity-rare { background: #2196F3; }
    .rarity-epic { background: #9C27B0; }
    .rarity-legendary { background: #FF9800; }
    
    .collectible-reward-info {
      margin-bottom: 20px;
    }
    
    .collectible-card-name {
      margin: 0 0 10px 0;
      font-size: 20px;
      font-weight: bold;
      color: #333;
    }
    
    .collectible-card-description {
      margin: 0;
      color: #666;
      font-size: 16px;
      line-height: 1.5;
    }
    
    .collectible-reward-actions {
      display: flex;
      gap: 15px;
      justify-content: center;
    }
    
    .collectible-reward-button {
      padding: 12px 24px;
      border: none;
      border-radius: 25px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      min-width: 120px;
    }
    
    .collectible-reward-button.primary {
      background: #007AFF;
      color: white;
    }
    
    .collectible-reward-button.primary:hover {
      background: #0056CC;
      transform: translateY(-2px);
    }
    
    .collectible-reward-button.secondary {
      background: #f0f0f0;
      color: #333;
    }
    
    .collectible-reward-button.secondary:hover {
      background: #e0e0e0;
      transform: translateY(-2px);
    }
    
    @media (max-width: 480px) {
      .collectible-reward-sheet {
        max-width: 100%;
        border-radius: 0;
      }
      
      .collectible-reward-actions {
        flex-direction: column;
      }
      
      .collectible-reward-button {
        width: 100%;
      }
    }
  `;
  
  document.head.appendChild(styles);
}

/**
 * Attach drag handlers to sheet
 */
export function attachDragHandlers(sheet: HTMLElement): void {
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let startTime = 0;
  
  const handleStart = (e: Event) => {
    const touch = (e as TouchEvent).touches?.[0] || e as MouseEvent;
    startY = touch.clientY;
    currentY = startY;
    isDragging = true;
    startTime = Date.now();
    
    sheet.style.transition = 'none';
    e.preventDefault();
  };
  
  const handleMove = (e: Event) => {
    if (!isDragging) return;
    
    const touch = (e as TouchEvent).touches?.[0] || e as MouseEvent;
    currentY = touch.clientY;
    const deltaY = currentY - startY;
    
    if (deltaY > 0) {
      sheet.style.transform = `translateY(${deltaY}px)`;
    }
    
    e.preventDefault();
  };
  
  const handleEnd = (e: Event) => {
    if (!isDragging) return;
    
    isDragging = false;
    sheet.style.transition = 'transform 0.3s ease';
    
    const deltaY = currentY - startY;
    const duration = Date.now() - startTime;
    const velocity = deltaY / duration;
    
    if (deltaY > 100 || velocity > 0.5) {
      // Close sheet
      sheet.style.transform = 'translateY(100%)';
      setTimeout(() => {
        const closeEvent = new CustomEvent('collectible-reward-close', {
          detail: { reason: 'drag' }
        });
        sheet.dispatchEvent(closeEvent);
      }, 300);
    } else {
      // Return to position
      sheet.style.transform = 'translateY(0)';
    }
    
    e.preventDefault();
  };
  
  // Touch events
  sheet.addEventListener('touchstart', handleStart, { passive: false });
  sheet.addEventListener('touchmove', handleMove, { passive: false });
  sheet.addEventListener('touchend', handleEnd, { passive: false });
  
  // Mouse events
  sheet.addEventListener('mousedown', handleStart);
  sheet.addEventListener('mousemove', handleMove);
  sheet.addEventListener('mouseup', handleEnd);
  
  // Register cleanup
  registerCleanup(() => {
    sheet.removeEventListener('touchstart', handleStart);
    sheet.removeEventListener('touchmove', handleMove);
    sheet.removeEventListener('touchend', handleEnd);
    sheet.removeEventListener('mousedown', handleStart);
    sheet.removeEventListener('mousemove', handleMove);
    sheet.removeEventListener('mouseup', handleEnd);
  });
}

/**
 * Attach button handlers
 */
export function attachButtonHandlers(sheet: HTMLElement): void {
  const closeButton = sheet.querySelector('.collectible-reward-close');
  const continueButton = sheet.querySelector('[data-action="close"]');
  const viewCollectionButton = sheet.querySelector('[data-action="view-collection"]');
  
  const handleClose = (reason: string) => {
    const closeEvent = new CustomEvent('collectible-reward-close', {
      detail: { reason }
    });
    sheet.dispatchEvent(closeEvent);
  };
  
  if (closeButton) {
    closeButton.addEventListener('click', () => handleClose('close-button'));
  }
  
  if (continueButton) {
    continueButton.addEventListener('click', () => handleClose('continue'));
  }
  
  if (viewCollectionButton) {
    viewCollectionButton.addEventListener('click', () => {
      // Open collectibles screen
      const windowWithCollectibles = window as WindowWithCollectibles;
      if (windowWithCollectibles.showCollectiblesScreen) {
        windowWithCollectibles.showCollectiblesScreen({
          scrollToCard: 'new',
          animateCard: true
        });
      }
      handleClose('view-collection');
    });
  }
  
  // Register cleanup
  registerCleanup(() => {
    if (closeButton) closeButton.removeEventListener('click', () => handleClose('close-button'));
    if (continueButton) continueButton.removeEventListener('click', () => handleClose('continue'));
    if (viewCollectionButton) viewCollectionButton.removeEventListener('click', () => {
      const windowWithCollectibles = window as WindowWithCollectibles;
      if (windowWithCollectibles.showCollectiblesScreen) {
        windowWithCollectibles.showCollectiblesScreen({
          scrollToCard: 'new',
          animateCard: true
        });
      }
      handleClose('view-collection');
    });
  });
}

/**
 * Attach keyboard handlers
 */
export function attachKeyboardHandlers(sheet: HTMLElement): void {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const closeEvent = new CustomEvent('collectible-reward-close', {
        detail: { reason: 'escape' }
      });
      sheet.dispatchEvent(closeEvent);
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  
  // Register cleanup
  registerCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });
}

/**
 * Attach outside click handlers
 */
export function attachOutsideClickHandlers(overlay: HTMLElement): void {
  const handleClick = (e: Event) => {
    if (e.target === overlay) {
      const closeEvent = new CustomEvent('collectible-reward-close', {
        detail: { reason: 'outside-click' }
      });
      overlay.dispatchEvent(closeEvent);
    }
  };
  
  overlay.addEventListener('click', handleClick);
  
  // Register cleanup
  registerCleanup(() => {
    overlay.removeEventListener('click', handleClick);
  });
}

// All functions are already exported individually above
