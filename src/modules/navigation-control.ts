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

  // Force initial visibility state
  navElement.style.display = 'block';
  navElement.style.visibility = 'visible';

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
export function updateNavigationVisibility(): void {
  const navElement = document.getElementById('independent-nav');
  if (!navElement) return;

  const home = document.getElementById('home');
  const app = document.getElementById('app');
  const loadingScreen = document.getElementById('loading-screen');

  // Hide navigation if loading
  if (loadingScreen && !loadingScreen.hidden && loadingScreen.style.display !== 'none') {
    navElement.style.display = 'none';
    navElement.style.visibility = 'hidden';
    logger.debug('📱 Navigation hidden: Loading screen active');
    return;
  }

  // Hide navigation if game is active
  if (app && !app.hidden && app.style.display !== 'none') {
    navElement.style.display = 'none';
    navElement.style.visibility = 'hidden';
    logger.debug('📱 Navigation hidden: Game active');
    return;
  }

  // 🔥 USER REQUEST: Hide navigation if Journey screen is visible
  // Journey screen has its own back button, doesn't need navigation icons
  const journeyScreen = document.getElementById('journey-screen');
  const journeyScreenVisible = journeyScreen && (
    !journeyScreen.hidden && 
    journeyScreen.style.display !== 'none' && 
    journeyScreen.style.display !== '' &&
    journeyScreen.style.visibility !== 'hidden' &&
    journeyScreen.style.opacity !== '0' &&
    journeyScreen.classList.contains('show')
  );
  
  if (journeyScreenVisible) {
    navElement.style.display = 'none';
    navElement.style.visibility = 'hidden';
    navElement.style.opacity = '0';
    logger.debug('📱 Navigation hidden: Journey screen active');
    return;
  }

  // Show navigation if home is visible
  // Check both display style and hidden attribute
  const homeVisible = home && (
    (!home.hidden && (home.style.display !== 'none' || home.style.display === ''))
  );
  
  if (homeVisible) {
    navElement.style.display = 'block';
    navElement.style.visibility = 'visible';
    logger.debug('📱 Navigation visible: Home active');
    return;
  }

  // Default: hide
  navElement.style.display = 'none';
  navElement.style.visibility = 'hidden';
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
