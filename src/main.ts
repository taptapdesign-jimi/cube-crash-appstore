// CUBE CRASH - MAIN ENTRY POINT
// Clean, modular architecture

import { bootstrapReady } from './ui/bootstrap-ui.js';
import './ui/collectibles-bridge.js';
// boot and layout imported statically for instant access
import { boot as bootGame, layout as layoutGame, cleanupGame, animateBoardExit } from './modules/app-core.js';
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
    
    // Play enter animation for Slide 1 after homepage is shown
    console.log('🎬 Playing initial enter animation for Slide 1');
    animateSliderEnter();
    
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

// iOS HARD CLOSE: Save high score and time when app goes to background or closes
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) {
    // App is going to background or closing (hard close on iOS)
    console.log('📱 App hidden - saving high score and time before close');
    
    try {
      // Get current score from STATE or HUD
      const { STATE } = await import('./modules/app-state.js');
      let currentScore = 0;
      
      if (STATE && typeof STATE.score === 'number') {
        currentScore = STATE.score;
      }
      
      if (currentScore > 0) {
        const { statsService } = await import('./services/stats-service.js');
        statsService.updateHighScore(currentScore);
        console.log('✅ High score saved before app hidden:', currentScore);
      }
      
      // CRITICAL: Save time played before app hidden
      if (typeof (window as any).stopTimeTracking === 'function') {
        console.log('⏱️ Saving time before app hidden');
        (window as any).stopTimeTracking();
        // Restart time tracking if game is still active
        if (gameState.get('isGameActive')) {
          // Game is still active, restart time tracking
          if (typeof (window as any).startTimeTracking === 'function') {
            (window as any).startTimeTracking();
            console.log('⏱️ Time tracking restarted (game still active)');
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to save data before app hidden:', error);
    }
  }
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
      
      // Use static import for instant response
      try {
        // Boot the game first
        await bootGame();
        await layoutGame();
        
        // Load saved game state
        const loadGameState = (window as any).loadGameState;
        if (typeof loadGameState === 'function') {
          const loaded = await loadGameState();
          if (!loaded) {
            logger.warn('⚠️ Failed to load saved game, starting new game');
            // Fallback - this shouldn't happen, but start boot anyway
            console.warn('⚠️ No saved game found, starting fresh');
          }
        } else {
          logger.error('❌ loadGameState function not found');
          console.warn('⚠️ Starting fresh game');
        }
      } catch (error) {
        logger.error('❌ Failed to load saved game:', error);
        console.warn('⚠️ Starting fresh game');
      }
    }, 770); // 120ms delay + 650ms animation = 770ms total (was 420ms, increased by 350ms)
    
  } catch (error) {
    logger.error('❌ Failed to continue game:', error);
    console.warn('⚠️ Starting fresh game');
  }
};

// New sequence handler: bottom sheet close → exit anim → game start
(window as any).triggerGameStartSequence = () => {
  logger.info('🎬 Starting game start sequence...');
  
  // Step 1: Play exit animation
  console.log('🎬 Step 1: Playing exit animation');
  animateSliderExit();
  
  // Step 2: Wait for exit animation to complete, then hide homepage and start game
  setTimeout(() => {
    console.log('🎮 Step 2: Starting game after exit animation');
    uiManager.hideHomepage(); // Hide homepage AFTER animation
    uiManager.startNewGame();
  }, 770); // 120ms delay + 650ms animation = 770ms total (was 420ms, increased by 350ms)
};

// Export exitToMenu function for End This Run modal
(window as any).exitToMenu = async () => {
  logger.info('🏠 exitToMenu called from window');
  
  // Guard: Prevent multiple simultaneous calls
  if ((window as any).exitingToMenu) {
    console.log('⚠️ exitToMenu already in progress, ignoring duplicate call');
    return;
  }
  (window as any).exitingToMenu = true;
  
  try {
    console.log('🔥 Starting complete game cleanup...');
    
    // CRITICAL: Save high score BEFORE animations
    try {
      const { STATE } = await import('./modules/app-state.js');
      let currentScore = 0;
      
      if (STATE && typeof STATE.score === 'number') {
        currentScore = STATE.score;
      }
      
      if (currentScore === 0) {
        const scoreEl = document.querySelector('#score-text');
        if (scoreEl) {
          const text = scoreEl.textContent || '0';
          currentScore = parseInt(text.replace(/,/g, '')) || 0;
        }
      }
      
      console.log('📊 Current score before exit:', currentScore);
      const { statsService } = await import('./services/stats-service.js');
      statsService.updateHighScore(currentScore);
      console.log('✅ High score updated via statsService:', currentScore);
    } catch (error) {
      console.warn('⚠️ Failed to save high score during exit:', error);
    }
    
    // Step 1: Play board exit animations (tiles + HUD)
    console.log('🎬 Playing board exit animations...');
    try {
      await animateBoardExit();
      console.log('✅ Board exit animations completed');
    } catch (error) {
      console.warn('⚠️ Board exit animation failed:', error);
    }
    
    // Step 2: Clean up game state AFTER animations
    try {
      if (typeof cleanupGame === 'function') {
        console.log('🧹 Calling cleanupGame() to clean up all game resources...');
        cleanupGame();
        console.log('✅ cleanupGame() completed - PIXI app destroyed and nullified');
      }
    } catch (error) {
      console.warn('⚠️ Failed to run cleanupGame:', error);
    }
    
    // Stop time tracking
    if (typeof (window as any).stopTimeTracking === 'function') {
      (window as any).stopTimeTracking();
      console.log('⏱️ Time tracking stopped');
    }
    
    // Clear saved game
    localStorage.removeItem('cc_saved_game');
    localStorage.removeItem('cubeCrash_gameState');
    logger.info('🗑️ Cleared saved game - next play will start fresh');
    
    // Hide app element
    uiManager.hideApp();
    
    // Show navigation
    uiManager.showNavigation();
    
    // Show homepage QUIETLY (ready for entry animation)
    uiManager.showHomepageQuietly();
    
    // Reset game state
    gameState.setState({
      homepageReady: true,
      isGameActive: false,
      isPaused: false
    });
    
    // CRITICAL: Reset slider to slide 0 (first slide) before entry animation
    console.log('🎯 Resetting slider to slide 0...');
    if (sliderManager) {
      sliderManager.setCurrentSlide(0);
      console.log('✅ Slider reset to slide 0');
    } else {
      console.warn('⚠️ SliderManager not found, trying gameState...');
      gameState.setState({ currentSlide: 0 });
    }
    
    console.log('✅ Game state reset - homepage should be visible now');
    
    // Step 3: Play homepage entry animation
    console.log('🎬 Playing homepage entry animation...');
    animateSliderEnter();
    console.log('✅ Exit complete - Play button should work');
    
    logger.info('✅ Exited to menu successfully - next play will start fresh without resume sheet');
    
  } catch (error) {
    logger.error('❌ Failed to exit to menu:', error);
  } finally {
    // Reset flag after cleanup
    (window as any).exitingToMenu = false;
    console.log('🔓 Reset exitingToMenu flag');
  }
};

// ==========================================
// STATS SERVICE INTEGRATION
// All stats tracking uses statsService directly
// ==========================================

// Expose resetStats for stats screen Reset button
(window as any).resetAllStats = () => {
  import('./services/stats-service.js').then(({ statsService }) => {
    statsService.resetStats();
  });
};

// Track total time played using stats service
let gameStartTime: number | null = null;

// Start tracking time when game starts
(window as any).startTimeTracking = () => {
  const now = Date.now();
  console.log('⏱️ Started tracking time at:', now);
  
  // If we already have a start time, save the previous session first
  if (gameStartTime !== null) {
    console.log('⏱️ Previous session was not stopped, stopping it now...');
    // Don't await - just update the start time
    const elapsedTime = Math.floor((now - gameStartTime) / 1000);
    if (elapsedTime > 0) {
      import('./services/stats-service.js').then(({ statsService }) => {
        statsService.addTimePlayed(elapsedTime);
        console.log('⏱️ Previous session tracked:', elapsedTime, 'seconds');
      });
    }
  }
  
  gameStartTime = now;
  console.log('⏱️ Time tracking started');
};

// Stop tracking time and add to accumulated time
(window as any).stopTimeTracking = async () => {
  if (gameStartTime !== null) {
    const now = Date.now();
    const elapsedTime = Math.floor((now - gameStartTime) / 1000); // Convert to seconds
    
    if (elapsedTime > 0) {
      try {
        const { statsService } = await import('./services/stats-service.js');
        statsService.addTimePlayed(elapsedTime);
        console.log('⏱️ Time tracked and saved:', elapsedTime, 'seconds');
      } catch (error) {
        console.error('❌ Failed to save time played:', error);
      }
    } else {
      console.log('⏱️ No time to save (elapsedTime = 0)');
    }
    
    // Don't reset gameStartTime to null - keep tracking
    // Only reset when explicitly starting a new session
  } else {
    console.log('⏱️ No time tracking session active');
  }
};

// NEW: Stats tracking wrapper functions for global access
// These replace old window.trackHighScore, window.trackHelpersUsed, etc.

// Update high score
(window as any).updateHighScore = async (score: number) => {
  try {
    const { statsService } = await import('./services/stats-service.js');
    statsService.updateHighScore(score);
    console.log('✅ High score updated:', score);
  } catch (error) {
    console.error('❌ Failed to update high score:', error);
  }
};

// Track cubes cracked
(window as any).trackCubesCracked = async (count: number = 1) => {
  try {
    const { statsService } = await import('./services/stats-service.js');
    statsService.incrementCubesCracked(count);
    console.log('✅ Cubes cracked tracked:', count);
  } catch (error) {
    console.error('❌ Failed to track cubes cracked:', error);
  }
};

// Track helpers used
(window as any).trackHelpersUsed = async (count: number = 1) => {
  try {
    const { statsService } = await import('./services/stats-service.js');
    statsService.incrementHelpersUsed(count);
    console.log('✅ Helpers used tracked:', count);
  } catch (error) {
    console.error('❌ Failed to track helpers used:', error);
  }
};

// Track highest board
(window as any).trackHighestBoard = async (board: number) => {
  try {
    const { statsService } = await import('./services/stats-service.js');
    statsService.updateHighestBoard(board);
    console.log('✅ Highest board tracked:', board);
  } catch (error) {
    console.error('❌ Failed to track highest board:', error);
  }
};

// Track longest combo
(window as any).trackLongestCombo = async (combo: number) => {
  try {
    const { statsService } = await import('./services/stats-service.js');
    statsService.updateLongestCombo(combo);
    console.log('✅ Longest combo tracked:', combo);
  } catch (error) {
    console.error('❌ Failed to track longest combo:', error);
  }
};

// Track collectibles unlocked
(window as any).trackCollectiblesUnlocked = async (count: number) => {
  try {
    const { statsService } = await import('./services/stats-service.js');
    statsService.updateCollectiblesUnlocked(count);
    console.log('✅ Collectibles unlocked tracked:', count);
  } catch (error) {
    console.error('❌ Failed to track collectibles unlocked:', error);
  }
};

// Helper function to check and update collectibles based on score milestones
(window as any).checkCollectiblesMilestones = async (score: number) => {
  try {
    const milestones = [100, 500, 1000, 2000, 5000, 10000, 20000, 50000];
    let unlocked = 0;
    
    for (const milestone of milestones) {
      if (score >= milestone) {
        unlocked++;
      }
    }
    
    if (unlocked > 0) {
      const { statsService } = await import('./services/stats-service.js');
      statsService.updateCollectiblesUnlocked(unlocked);
      console.log('🎁 Collectibles updated based on score milestones:', unlocked);
    }
  } catch (error) {
    console.error('❌ Failed to update collectibles milestones:', error);
  }
};
