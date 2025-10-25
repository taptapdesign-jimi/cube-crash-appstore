// Navigation Control Module
// Handles navigation visibility based on UI state

import { logger } from '../core/logger.js';

let observer: MutationObserver | null = null;

/**
 * Initialize navigation control
 */
export function initNavigationControl(): void {
  const navElement = document.getElementById('independent-nav');
  if (!navElement) {
    logger.warn('⚠️ Navigation element not found');
    return;
  }

  // Watch for changes to #home and #app visibility
  const targetNode = document.body;
  const config = {
    attributes: true,
    attributeFilter: ['hidden', 'style'],
    childList: false,
    subtree: true,
  };

  observer = new MutationObserver(() => {
    updateNavigationVisibility();
  });

  observer.observe(targetNode, config);

  // Initial update
  updateNavigationVisibility();

  logger.info('✅ Navigation control initialized');
}

/**
 * Update navigation visibility based on current UI state
 */
function updateNavigationVisibility(): void {
  const navElement = document.getElementById('independent-nav');
  if (!navElement) return;

  const home = document.getElementById('home');
  const app = document.getElementById('app');
  const loadingScreen = document.getElementById('loading-screen');

  // Hide navigation if loading
  if (loadingScreen && !loadingScreen.hidden && loadingScreen.style.display !== 'none') {
    navElement.style.display = 'none';
    logger.debug('📱 Navigation hidden: Loading screen active');
    return;
  }

  // Hide navigation if game is active
  if (app && !app.hidden && app.style.display !== 'none') {
    navElement.style.display = 'none';
    logger.debug('📱 Navigation hidden: Game active');
    return;
  }

  // Show navigation if home is visible
  if (home && !home.hidden && home.style.display !== 'none') {
    navElement.style.display = 'block';
    logger.debug('📱 Navigation visible: Home active');
    return;
  }

  // Default: hide
  navElement.style.display = 'none';
  logger.debug('📱 Navigation hidden: Default');
}

/**
 * Cleanup navigation control
 */
export function cleanupNavigationControl(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  logger.info('🧹 Navigation control cleaned up');
}
