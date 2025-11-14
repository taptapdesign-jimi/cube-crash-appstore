// App Manager - Handles lazy loading and dynamic component rendering
import { logger } from '../core/logger.js';

export type ScreenType = 'loading' | 'home' | 'game' | 'stats' | 'collectibles' | 'menu' | 'settings';

class AppManager {
  private currentScreen: ScreenType = 'loading';
  private loadedScreens: Set<ScreenType> = new Set(['loading', 'home']);
  private screenElements: Map<ScreenType, HTMLElement> = new Map();

  constructor() {
    this.cacheElements();
  }

  private cacheElements(): void {
    // Cache all screen elements
    const screens: ScreenType[] = ['loading', 'home', 'game', 'stats', 'collectibles', 'menu'];
    
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
      'stats': 'stats-screen',
      'collectibles': 'collectibles-screen',
      'menu': 'menu-screen',
      'settings': 'settings-screen'
    };
    return map[screen];
  }

  async showScreen(screen: ScreenType): Promise<void> {
    if (this.currentScreen === screen) return;

    logger.info(`📺 Showing screen: ${screen}`);

    // Hide current screen
    this.hideScreen(this.currentScreen);

    // Show new screen
    const element = this.screenElements.get(screen);
    if (element) {
      element.hidden = false;
      element.style.display = 'block';
      
      // 🎬 For stats screen, skip fade-in and use GSAP animations instead
      if (screen === 'stats') {
        // Set opacity to 1 immediately (no transition) so GSAP can control individual elements
        element.style.opacity = '1';
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
      
      // Update stats values when showing stats screen
      if (screen === 'stats') {
        // Update immediately - no delay
        try {
          const { updateStatsValues } = await import('./components/stats-screen.js');
          console.log('📊 About to call updateStatsValues()...');
          updateStatsValues();
          console.log('✅ updateStatsValues() called successfully');
          
          // 🎬 Trigger stats screen enter animation (pop-in) using GSAP
          console.log('🎬 About to import stats-animations.js...');
          const { animateStatsScreenEnter } = await import('./stats-animations.js');
          console.log('✅ stats-animations.js imported successfully');
          // Longer delay to ensure DOM is fully ready and elements are visible
          setTimeout(() => {
            console.log('🎬 Calling animateStatsScreenEnter() after 200ms delay...');
            console.log('🔍 Stats screen element:', document.getElementById('stats-screen'));
            console.log('🔍 Stat items:', document.querySelectorAll('.stat-item').length);
            animateStatsScreenEnter();
          }, 200);
        } catch (error) {
          console.error('❌ Failed to update stats values:', error);
          logger.warn('⚠️ Failed to update stats values:', error);
        }
      }
      
      logger.info(`✅ Screen shown: ${screen}`);
    } else {
      logger.warn(`⚠️ Screen element not found: ${screen}`);
    }
  }

  hideScreen(screen: ScreenType): void {
    const element = this.screenElements.get(screen);
    if (element && !element.hidden) {
      // 🎬 For stats screen, use GSAP exit animation instead of fade-out
      if (screen === 'stats') {
        try {
          import('./stats-animations.js').then(({ animateStatsScreenExit }) => {
            animateStatsScreenExit();
          });
        } catch (error) {
          logger.warn('⚠️ Failed to trigger stats exit animation:', error);
        }
        
        // Hide after GSAP animation completes (500ms animation + 100ms buffer)
        setTimeout(() => {
          element.hidden = true;
          element.style.display = 'none';
        }, 600);
      } else {
        // Use fade-out for other screens
        element.style.opacity = '0';
        
        // Hide after transition
        setTimeout(() => {
          element.hidden = true;
          element.style.display = 'none';
        }, 300);
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
