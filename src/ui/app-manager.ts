// App Manager - Handles lazy loading and dynamic component rendering
import { logger } from '../core/logger.js';
// 🔥 REMOVED: startHeroImageParticles, stopHeroImageParticles - feature no longer needed

export type ScreenType = 'loading' | 'home' | 'game' | 'collectibles' | 'menu' | 'settings';

class AppManager {
  private currentScreen: ScreenType = 'loading';
  private loadedScreens: Set<ScreenType> = new Set(['loading', 'home']);
  private screenElements: Map<ScreenType, HTMLElement> = new Map();
  private hideTimeouts: Map<ScreenType, number> = new Map();

  constructor() {
    this.cacheElements();
  }

  private cacheElements(): void {
    // Cache all screen elements
    const screens: ScreenType[] = ['loading', 'home', 'game', 'collectibles', 'menu'];
    
    screens.forEach(screen => {
      const element = document.getElementById(this.getScreenId(screen));
      if (element) {
        this.screenElements.set(screen, element);
      }
    });
  }

  private getScreenId(screen: ScreenType): string {
    const map: Record<ScreenType, string> = {
      'loading': 'loading-screen',
      'home': 'home',
      'game': 'app',
      'collectibles': 'journey-screen',
      'menu': 'menu-screen',
      'settings': 'settings-screen'
    };
    return map[screen];
  }

  async showScreen(screen: ScreenType): Promise<void> {
    if (this.currentScreen === screen) return;

    logger.info(`📺 Showing screen: ${screen}`);

    // Cancel any pending hide for this screen (in case of rapid switches)
    const pendingHide = this.hideTimeouts.get(screen);
    if (pendingHide) {
      clearTimeout(pendingHide);
      this.hideTimeouts.delete(screen);
    }

    // Hide current screen
    await this.hideScreen(this.currentScreen);

    // Show new screen
    let element = this.screenElements.get(screen);
    
    // If element not found in cache, try to find it directly
    if (!element) {
      const screenId = this.getScreenId(screen);
      const foundElement = document.getElementById(screenId);
      if (foundElement) {
        element = foundElement;
        this.screenElements.set(screen, element);
        logger.info(`✅ Found and cached screen element: ${screen}`);
      }
    }
    
    if (element) {
      element.hidden = false;
      element.style.display = 'block';
      
      if (screen === 'home') {
        // Homepage - set opacity immediately (no fade-in needed)
        element.style.opacity = '1';
        element.style.visibility = 'visible';
        element.style.transition = 'none';
      } else {
        // Add fade-in animation for other screens
        element.style.opacity = '0';
        element.style.transition = 'opacity 0.3s ease';
        
        requestAnimationFrame(() => {
          element.style.opacity = '1';
        });
      }

      this.currentScreen = screen;
      
      // Mark as loaded
      this.loadedScreens.add(screen);
      
      if (screen === 'collectibles') {
        // 🔥 CRITICAL FIX: Add error handling for Journey screen initialization
        try {
          // Initialize Journey screen if needed
          const collectiblesManager = (window as any).collectiblesManager;
          if (collectiblesManager && typeof collectiblesManager.init === 'function') {
            try {
              collectiblesManager.init();
              console.log('✅ Collectibles manager initialized successfully');
            } catch (initError) {
              console.error('❌ Error initializing collectibles manager:', initError);
              logger.warn('⚠️ Error initializing collectibles manager, continuing:', initError);
              // Don't throw - Journey screen should still be shown even if init fails
            }
          }
        } catch (error) {
          console.error('❌ Failed to initialize collectibles screen:', error);
          logger.warn('⚠️ Failed to initialize collectibles screen:', error);
          // 🔥 CRITICAL: Don't throw error - collectibles screen should still be shown even if init fails
          // This prevents error handler from triggering loading screen reload
        }
      } else if (screen === 'settings') {
        // 🔥 CRITICAL FIX: Add error handling for settings screen initialization
        try {
          // Settings screen doesn't require special initialization, but wrap in try-catch anyway
          // This prevents any unexpected errors from crashing the app
          console.log('✅ Settings screen shown');
        } catch (error) {
          console.error('❌ Failed to show settings screen:', error);
          logger.warn('⚠️ Failed to show settings screen:', error);
          // 🔥 CRITICAL: Don't throw error - settings screen should still be shown even if init fails
          // This prevents error handler from triggering loading screen reload
        }
      }
      
      // 🔥 REMOVED: Hero image particles feature no longer needed
      
      logger.info(`✅ Screen shown: ${screen}`);
    } else {
      logger.warn(`⚠️ Screen element not found: ${screen}`);
    }
  }

  async hideScreen(screen: ScreenType): Promise<void> {
    const pendingHide = this.hideTimeouts.get(screen);
    if (pendingHide) {
      clearTimeout(pendingHide);
      this.hideTimeouts.delete(screen);
    }
    // 🔥 MEMORY LEAK FIX: Comprehensive cleanup when home screen is hidden
    if (screen === 'home') {
      // 🔥 REMOVED: Hero image particles feature no longer needed
      
      // Cleanup homepage animations
      try {
        const { cleanupAnimations } = await import('../utils/animations.js');
        if (cleanupAnimations) {
          cleanupAnimations();
          logger.info('🧹 Homepage animation timeouts cleaned up in hideScreen');
        }
      } catch (error) {
        logger.warn('⚠️ Failed to cleanup homepage animations:', error);
      }
      
      // Kill GSAP animations on homepage
      try {
        const gsap = (window as any).gsap;
        if (gsap) {
          const homeElement = document.getElementById('home');
          if (homeElement) {
            const allElements = homeElement.querySelectorAll('*');
            allElements.forEach((el: Element) => {
              try {
                gsap.killTweensOf(el);
              } catch {}
            });
            logger.info('🧹 Homepage GSAP animations killed in hideScreen');
          }
        }
      } catch (error) {
        logger.warn('⚠️ Failed to kill homepage GSAP animations:', error);
      }
      
      // Stop CSS infinite animations
      try {
        const homeElement = document.getElementById('home');
        if (homeElement) {
          const shimmerElements = homeElement.querySelectorAll('button, .slide-button, .continue-btn, .new-game-btn');
          shimmerElements.forEach((el: Element) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.style) {
              htmlEl.style.animation = 'none';
              htmlEl.style.animationPlayState = 'paused';
            }
          });
          logger.info('🧹 Homepage CSS infinite animations stopped in hideScreen');
        }
      } catch (error) {
        logger.warn('⚠️ Failed to stop homepage CSS animations:', error);
      }
    }
    const element = this.screenElements.get(screen);
    if (element && !element.hidden) {
      // 🔥 MEMORY LEAK FIX: Cleanup screen-specific resources before hiding
      
      if (screen === 'collectibles') {
        // 🔥 MEMORY LEAK FIX: Cleanup collectibles event listeners
        try {
          // CollectiblesManager uses singleton pattern, instance is on window.collectiblesManager
          const collectiblesManager = (window as any).collectiblesManager;
          if (collectiblesManager && typeof collectiblesManager.cleanupEventListeners === 'function') {
            collectiblesManager.cleanupEventListeners();
            logger.info('🧹 Collectibles event listeners cleaned up');
          } else {
            logger.warn('⚠️ Collectibles manager instance not found or cleanup method not available');
          }
        } catch (error) {
          logger.warn('⚠️ Failed to cleanup collectibles event listeners:', error);
        }
        
        // 🔥 MEMORY LEAK FIX: Kill all GSAP animations on Journey screen
        try {
          const gsap = (window as any).gsap || require('gsap');
          const journeyScreen = document.getElementById('journey-screen');
          if (journeyScreen && gsap) {
            gsap.killTweensOf(journeyScreen.querySelectorAll('*'));
            logger.info('🧹 Collectibles screen GSAP animations killed');
          }
        } catch (error) {
          logger.warn('⚠️ Failed to cleanup collectibles GSAP animations:', error);
        }
        
        // Use fade-out for Journey screen
        element.style.opacity = '0';
        
        // Hide after transition
        const hideId = window.setTimeout(() => {
          element.hidden = true;
          element.style.display = 'none';
          this.hideTimeouts.delete(screen);
        }, 300);
        this.hideTimeouts.set(screen, hideId);
      } else if (screen === 'settings') {
        // 🔥 MEMORY LEAK FIX: Kill all GSAP animations on settings screen
        try {
          const gsap = (window as any).gsap || require('gsap');
          const settingsScreen = document.getElementById('settings-screen');
          if (settingsScreen && gsap) {
            gsap.killTweensOf(settingsScreen.querySelectorAll('*'));
            logger.info('🧹 Settings screen GSAP animations killed');
          }
        } catch (error) {
          logger.warn('⚠️ Failed to cleanup settings GSAP animations:', error);
        }
        
        // Use fade-out for settings screen
        element.style.opacity = '0';
        
        // Hide after transition
        const hideId = window.setTimeout(() => {
          element.hidden = true;
          element.style.display = 'none';
          this.hideTimeouts.delete(screen);
        }, 300);
        this.hideTimeouts.set(screen, hideId);
      } else {
        // Use fade-out for other screens
        element.style.opacity = '0';
        
        // Hide after transition
        const hideId = window.setTimeout(() => {
          element.hidden = true;
          element.style.display = 'none';
          this.hideTimeouts.delete(screen);
        }, 300);
        this.hideTimeouts.set(screen, hideId);
      }
      
      logger.info(`👋 Screen hidden: ${screen}`);
    }
  }

  getCurrentScreen(): ScreenType {
    return this.currentScreen;
  }

  isScreenLoaded(screen: ScreenType): boolean {
    return this.loadedScreens.has(screen);
  }

  preloadScreen(screen: ScreenType): void {
    if (!this.loadedScreens.has(screen)) {
      // Screen will be loaded on first access
      logger.info(`📥 Preloading screen: ${screen}`);
    }
  }
}

export const appManager = new AppManager();
