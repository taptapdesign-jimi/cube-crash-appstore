// collectible-reward-utils.ts
// Utility functions for collectible reward bottom sheet


// Types
interface CollectibleDetail {
  cardName?: string;
  imagePath?: string;
  rarity?: string;
}

interface HideOptions {
  preserveCurrentTransform?: boolean;
  onAfterClose?: () => void;
  duration?: number;
  easing?: string;
}

interface WindowWithCollectibles extends Window {
  unlockSlider?: () => void;
  showCollectiblesScreen?: (options: {
    scrollToCard?: string;
    rarity?: string;
    animateCard?: boolean;
  }) => void;
}

interface PointerEventWithTouches extends PointerEvent {
  touches?: TouchList;
}

interface TouchEventWithTarget extends TouchEvent {
  target: EventTarget | null;
}

interface MouseEventWithTarget extends MouseEvent {
  target: EventTarget | null;
}

interface KeyboardEventWithTarget extends KeyboardEvent {
  target: EventTarget | null;
}

// Global state
let activeOverlay: HTMLElement | null = null;
let activeResolve: ((reason: string) => void) | null = null;
let activeCleanupFns: (() => void)[] = [];
let isClosing: boolean = false;

/**
 * Register cleanup function
 */
export function registerCleanup(fn: () => void): void {
  if (typeof fn === 'function') {
    activeCleanupFns.push(fn);
  }
}

/**
 * Cleanup overlay
 */
export function cleanupOverlay(): void {
  if (activeOverlay && activeOverlay.parentNode) {
    activeOverlay.parentNode.removeChild(activeOverlay);
  }
  activeOverlay = null;
  activeResolve = null;
  activeCleanupFns = [];
  isClosing = false;
}

/**
 * Build markup for collectible detail
 */
export function buildMarkup(detail: CollectibleDetail): string {
  const cardName = detail.cardName || 'Unknown Card';
  const imagePath = detail.imagePath || '/assets/collectibles/common/1.png';
  const rarity = detail.rarity || 'common';
  
  return `
    <div class="collectible-reward-sheet">
      <div class="collectible-reward-content">
        <div class="collectible-reward-header">
          <h2 class="collectible-reward-title">New Collectible Unlocked!</h2>
          <button class="collectible-reward-close" aria-label="Close">×</button>
        </div>
        
        <div class="collectible-reward-body">
          <div class="collectible-reward-card">
            <div class="collectible-reward-image">
              <img src="${imagePath}" alt="${cardName}" class="collectible-card-image" />
              <div class="collectible-reward-rarity rarity-${rarity}">${rarity.toUpperCase()}</div>
            </div>
            
            <div class="collectible-reward-info">
              <h3 class="collectible-card-name">${cardName}</h3>
              <p class="collectible-card-description">
                You've unlocked a new ${rarity} collectible card!
              </p>
            </div>
          </div>
          
          <div class="collectible-reward-actions">
            <button class="collectible-reward-button secondary" data-action="close">
              Continue Playing
            </button>
            <button class="collectible-reward-button primary" data-action="view-collection">
              View Collection
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get default collectible detail
 */
export function getDefaultCollectibleDetail(): CollectibleDetail {
  return {
    cardName: 'Mystery Card',
    imagePath: '/assets/collectibles/common/1.png',
    rarity: 'common'
  };
}

/**
 * Validate collectible detail
 */
export function validateCollectibleDetail(detail: CollectibleDetail): CollectibleDetail {
  return {
    cardName: detail.cardName || 'Unknown Card',
    imagePath: detail.imagePath || '/assets/collectibles/common/1.png',
    rarity: detail.rarity || 'common'
  };
}

/**
 * Get rarity color
 */
export function getRarityColor(rarity: string): string {
  const colors = {
    common: '#8B8B8B',
    uncommon: '#4CAF50',
    rare: '#2196F3',
    epic: '#9C27B0',
    legendary: '#FF9800'
  };
  
  return colors[rarity as keyof typeof colors] || colors.common;
}

/**
 * Get rarity icon
 */
export function getRarityIcon(rarity: string): string {
  const icons = {
    common: '★',
    uncommon: '★★',
    rare: '★★★',
    epic: '★★★★',
    legendary: '★★★★★'
  };
  
  return icons[rarity as keyof typeof icons] || icons.common;
}

/**
 * Check if overlay is active
 */
export function isOverlayActive(): boolean {
  return activeOverlay !== null;
}

/**
 * Get active overlay
 */
export function getActiveOverlay(): HTMLElement | null {
  return activeOverlay;
}

/**
 * Set active overlay
 */
export function setActiveOverlay(overlay: HTMLElement | null): void {
  activeOverlay = overlay;
}

/**
 * Get active resolve function
 */
export function getActiveResolve(): ((reason: string) => void) | null {
  return activeResolve;
}

/**
 * Set active resolve function
 */
export function setActiveResolve(resolve: ((reason: string) => void) | null): void {
  activeResolve = resolve;
}

/**
 * Check if closing
 */
export function isClosing(): boolean {
  return isClosing;
}

/**
 * Set closing state
 */
export function setClosing(closing: boolean): void {
  isClosing = closing;
}

/**
 * Get cleanup functions
 */
export function getCleanupFns(): (() => void)[] {
  return [...activeCleanupFns];
}

/**
 * Clear cleanup functions
 */
export function clearCleanupFns(): void {
  activeCleanupFns = [];
}

/**
 * Execute cleanup functions
 */
export function executeCleanup(): void {
  activeCleanupFns.forEach(fn => {
    try {
      fn();
    } catch (error) {
      console.warn('⚠️ Cleanup function error:', error);
    }
  });
  clearCleanupFns();
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `collectible-reward-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Check if element is in viewport
 */
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Get element position
 */
export function getElementPosition(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY
  };
}

/**
 * Animate element to position
 */
export function animateToPosition(
  element: HTMLElement,
  targetX: number,
  targetY: number,
  duration: number = 300
): Promise<void> {
  return new Promise((resolve) => {
    const startX = element.offsetLeft;
    const startY = element.offsetTop;
    const deltaX = targetX - startX;
    const deltaY = targetY - startY;
    
    const startTime = performance.now();
    
    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      
      element.style.left = `${startX + deltaX * easeProgress}px`;
      element.style.top = `${startY + deltaY * easeProgress}px`;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    }
    
    requestAnimationFrame(animate);
  });
}

// All functions are already exported individually above
