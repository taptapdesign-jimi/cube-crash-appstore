// CUBE CRASH - MAIN ENTRY POINT
// Clean, modular architecture

import { bootstrapReady } from './ui/bootstrap-ui.js';
import './ui/collectibles-bridge.js';
// boot and layout imported in ui-manager.ts when needed
import { gsap } from 'gsap';
import { assetPreloader } from './modules/asset-preloader.js';
import './ios-image-helper.js';
import './3d-effects.js';

// Type definitions
interface GameModules {
  gameState: typeof gameState;
  uiManager: typeof uiManager;
  animationManager: typeof animationManager;
  sliderManager: typeof sliderManager;
  iosOptimizer: typeof iosOptimizer;
}

// Import core modules
import gameState from './modules/game-state.js';
import uiManager from './modules/ui-manager.js';
import animationManager from './modules/animation-manager.js';
import sliderManager from './modules/slider-manager.js';
import iosOptimizer from './modules/ios-optimizer.js';

// Import new services
import { initializeServices, cleanupServices } from './core/service-registry.js';
import { getGameState, getUIManager, getBoardService, getEventBus } from './core/service-registry.js';
import { container } from './core/dependency-injection.js';

// Import refactored modules
import { 
  glassCrackAtTile, 
  woodShardsAtTile, 
  innerFlashAtTile 
} from './modules/fx-visual-effects.js';
import { 
  landBounce, 
  screenShake, 
  magicSparklesAtTile 
} from './modules/fx-animations.js';
import { 
  showMultiplierTile, 
  smokeBubblesAtTile, 
  wildImpactEffect, 
  startWildIdle, 
  stopWildIdle 
} from './modules/fx-special-effects.js';

// Import new core modules
import { 
  initDrag, 
  updateDrag, 
  onDragStart, 
  onDragMove, 
  onDragEnd 
} from './modules/drag-core.js';
import { 
  merge, 
  clearWildState, 
  anyMergePossibleOnBoard 
} from './modules/merge-core.js';
import { 
  createUnifiedHudContainer, 
  animateUnifiedHudDrop, 
  getUnifiedHudInfo, 
  initHUD 
} from './modules/hud-core.js';
import { 
  collectiblesManager 
} from './modules/collectibles-logic.js';

// Import utilities
import errorHandler from './utils/error-handler.js';
import memoryManager from './utils/memory-manager.js';
import { logger } from './core/logger.js';
import { ErrorBoundary } from './utils/error-boundary.js';
import { PerformanceMonitor } from './utils/performance-monitor.js';
import { AccessibilityManager } from './utils/accessibility.js';
import { AppStoreCompliance } from './utils/app-store-compliance.js';
import { appManager } from './ui/app-manager.js';
import { initNavigationControl } from './modules/navigation-control.js';
import { showEndRunModalFromGame } from './modules/end-run-modal.js';
import { animateSliderExit, animateSliderEnter } from './utils/animations.js';

// Type definitions
interface GameState {
  homepageReady: boolean;
  isGameActive: boolean;
  isPaused: boolean;
}

// Window interface is now defined in src/types/window.d.ts

  // Game starting

// Initialize core systems
async function initializeApp(): Promise<void> {
  try {
    // Wait for bootstrap to complete (DOM elements must exist first)
    await bootstrapReady;
    
    // Initializing core systems
    
    // Initialize error handling
    errorHandler.handleError = errorHandler.handleError.bind(errorHandler);
    memoryManager.init();
    
    // Initialize App Store compliance
    const errorBoundary = ErrorBoundary.getInstance();
    const performanceMonitorNew = PerformanceMonitor.getInstance();
    const accessibilityManager = AccessibilityManager.getInstance();
    const appStoreCompliance = AppStoreCompliance.getInstance();
    
    errorBoundary.init();
    performanceMonitorNew.init();
    accessibilityManager.init();
    appStoreCompliance.init();
    
    // Initialize new services
    initializeServices();
    
    // Initialize animation manager
    animationManager.init();
    
    // Initialize UI manager
    uiManager.init();
    
    // Initialize slider manager
    sliderManager.init();
    
    // Initialize iOS optimizer
    iosOptimizer.init();
    
    // Initialize navigation control
    initNavigationControl();
    
    // Start asset preloading
    await startAssetPreloading();
    
    // Initialize game
    await initializeGame();
    
    logger.info('✅ App initialized successfully');
    
  } catch (error) {
    logger.error('❌ Failed to initialize app:', String(error));
    errorHandler.handleError(error as Error, 'App Initialization');
    throw error;
  }
}

// Setup iOS optimizations
function setupIOSOptimizations(): void {
  if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
    logger.info('📱 iOS device detected, applying optimizations...');
    
    // Add iOS class
    document.body.classList.add('ios-device');
    
    // Optimize touch handling
    document.addEventListener('touchstart', function() {}, { passive: true });
    document.addEventListener('touchmove', function() {}, { passive: true });
  }
}

// Start asset preloading
async function startAssetPreloading(): Promise<void> {
  try {
    logger.info('📦 Starting asset preloading...');
    
    // Show loading screen
    uiManager.showLoadingScreen();
    
    // Setup progress callback
    assetPreloader.setProgressCallback((percentage: number, loadedCount: number, totalCount: number) => {
      uiManager.updateLoadingProgress(percentage);
      logger.info(`📦 Loading progress: ${percentage}% (${loadedCount}/${totalCount})`);
    });
    
    // Start preloading
    await assetPreloader.preloadAll();
    
    // Set to 100% before hiding
    uiManager.updateLoadingProgress(100);
    
    // Small delay to show 100%
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Hide loading screen and show home
    uiManager.hideLoadingScreen();
    await appManager.showScreen('home');
    
    logger.info('✅ Assets preloaded successfully');
    
  } catch (error) {
    logger.error('❌ Asset preloading failed:', String(error));
    throw error;
  }
}

// Initialize game
async function initializeGame(): Promise<void> {
  try {
    logger.info('🎮 Initializing game...');
    
    // DON'T initialize boot/layout here - wait for user to click Play
    // boot() and layout() will be called from ui-manager.ts when starting a game
    
    // Set initial state
    gameState.setState({
      homepageReady: true,
      isGameActive: false,
      isPaused: false
    });
    
    // Show homepage
    uiManager.showHomepage();
    
    logger.info('✅ Game initialized successfully');
    
  } catch (error) {
    logger.error('❌ Game initialization failed:', String(error));
    throw error;
  }
}

// Handle app errors
window.addEventListener('error', (event: ErrorEvent) => {
  errorHandler.handleError(event.error, 'Global Error');
});

window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  errorHandler.handleError(event.reason, 'Unhandled Promise Rejection');
});

// Start the app
initializeApp().catch((error: Error) => {
  logger.error('❌ Critical error during app startup:', String(error));
});

// Export for debugging
(window as any).gameState = gameState;
(window as any).uiManager = uiManager;
(window as any).animationManager = animationManager;
(window as any).sliderManager = sliderManager;
(window as any).iosOptimizer = iosOptimizer;

// Export end run modal function for HUD click
(window as any).showEndRunModalFromGame = showEndRunModalFromGame;

// Export lock/unlock slider functions
(window as any).lockSlider = () => {
  logger.info('🔒 Locking slider');
  gameState.set('sliderLocked', true);
};

(window as any).unlockSlider = () => {
  logger.info('🔓 Unlocking slider');
  gameState.set('sliderLocked', false);
};

// Export startNewGame and continueGame functions for resume bottom sheet
(window as any).startNewGame = () => {
  logger.info('🎮 startNewGame called from window');
  uiManager.startNewGame();
};

(window as any).continueGame = () => {
  logger.info('🎮 continueGame called from window');
  uiManager.startNewGame(); // Same as startNewGame for now
};

// Continue game with saved state
(window as any).continueGameWithSavedState = async () => {
  logger.info('🔄 continueGameWithSavedState called - loading saved game');
  
  try {
    // Step 1: Play exit animation
    console.log('🎬 Step 1: Playing exit animation');
    animateSliderExit();
    
    // Step 2: Wait for exit animation, then start game with saved state
    setTimeout(async () => {
      console.log('🔄 Step 2: Loading saved game');
      
      // Hide homepage
      uiManager.hideHomepage();
      
      // Show app element
      uiManager.showApp();
      
      // Import app-core to access loadGameState
      try {
        const { boot, layout } = await import('./modules/app-core.js');
        
        // Boot the game first
        await boot();
        await layout();
        
        // Load saved game state
        const loadGameState = (window as any).loadGameState;
        if (typeof loadGameState === 'function') {
          const loaded = await loadGameState();
          if (!loaded) {
            logger.warn('⚠️ Failed to load saved game, starting new game');
            // Fallback to new game if load fails
            uiManager.startNewGame();
          }
        } else {
          logger.error('❌ loadGameState function not found');
          uiManager.startNewGame();
        }
      } catch (error) {
        logger.error('❌ Failed to load saved game:', error);
        uiManager.startNewGame();
      }
    }, 500);
    
  } catch (error) {
    logger.error('❌ Failed to continue game:', error);
    uiManager.startNewGame();
  }
};

// New sequence handler: bottom sheet close → exit anim → game start
(window as any).triggerGameStartSequence = () => {
  logger.info('🎬 Starting game start sequence...');
  
  // Step 1: Play exit animation
  console.log('🎬 Step 1: Playing exit animation');
  animateSliderExit();
  
  // Step 2: Wait for exit animation to complete (400ms), then start game
  setTimeout(() => {
    console.log('🎮 Step 2: Starting game after exit animation');
    uiManager.startNewGame();
  }, 500); // 400ms anim + 100ms buffer for smoother transition
};

// Export exitToMenu function for End This Run modal
(window as any).exitToMenu = async () => {
  logger.info('🏠 exitToMenu called from window');
  
  try {
    // CRITICAL: Clear saved game so next play starts fresh (no resume sheet)
    localStorage.removeItem('cc_saved_game');
    localStorage.removeItem('cubeCrash_gameState');
    logger.info('🗑️ Cleared saved game - next play will start fresh');
    
    // Hide app element (game)
    uiManager.hideApp();
    
    // Show homepage with animation
    uiManager.showHomepageWithAnimation();
    
    // Animate slider enter (elastic spring bounce pop in)
    setTimeout(() => {
      animateSliderEnter();
    }, 100);
    
    // Show navigation
    uiManager.showNavigation();
    
    // Reset game state
    gameState.setState({
      homepageReady: true,
      isGameActive: false,
      isPaused: false
    });
    
    logger.info('✅ Exited to menu successfully - next play will start fresh without resume sheet');
    
  } catch (error) {
    logger.error('❌ Failed to exit to menu:', error);
  }
};
