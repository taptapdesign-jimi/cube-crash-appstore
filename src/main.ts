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
  
  // Guard: Prevent multiple simultaneous calls
  if ((window as any).exitingToMenu) {
    console.log('⚠️ exitToMenu already in progress, ignoring duplicate call');
    return;
  }
  (window as any).exitingToMenu = true;
  
  try {
    console.log('🔥 Starting complete game cleanup...');
    
    // CRITICAL: Save high score BEFORE cleanup
    try {
      // Get current score from STATE
      const { STATE } = await import('./modules/app-state.js');
      let currentScore = 0;
      
      if (STATE && typeof STATE.score === 'number') {
        currentScore = STATE.score;
      }
      
      // Fallback: try to read from HUD
      if (currentScore === 0) {
        const scoreEl = document.querySelector('#score-text');
        if (scoreEl) {
          const text = scoreEl.textContent || '0';
          currentScore = parseInt(text.replace(/,/g, '')) || 0;
        }
      }
      
      console.log('📊 Current score before exit:', currentScore);
      
      // Get saved high score
      const savedHighScoreStr = localStorage.getItem('cc_best_score_v1');
      const savedHighScore = savedHighScoreStr ? parseInt(savedHighScoreStr, 10) || 0 : 0;
      
      console.log('📊 Saved high score:', savedHighScore);
      
      // Update if current score is higher
      if (currentScore > savedHighScore) {
        localStorage.setItem('cc_best_score_v1', currentScore.toString());
        console.log('✅ High score updated to:', currentScore);
      } else {
        console.log('ℹ️ Current score', currentScore, 'is not higher than saved:', savedHighScore);
      }
    } catch (error) {
      console.warn('⚠️ Failed to save high score during exit:', error);
    }
    
    // CRITICAL: Call cleanupGame() to properly clean up ALL game state (including PIXI app)
    try {
      const { cleanupGame } = await import('./modules/app-core.js');
      if (typeof cleanupGame === 'function') {
        console.log('🧹 Calling cleanupGame() to clean up all game resources...');
        cleanupGame();
        console.log('✅ cleanupGame() completed - PIXI app destroyed and nullified');
      } else {
        console.warn('⚠️ cleanupGame is not a function');
      }
    } catch (error) {
      console.warn('⚠️ Failed to import/run cleanupGame:', error);
    }
    
    // Stop time tracking
    if (typeof (window as any).stopTimeTracking === 'function') {
      (window as any).stopTimeTracking();
      console.log('⏱️ Time tracking stopped');
    }
    
    // CRITICAL: Clear saved game so next play starts fresh (no resume sheet)
    localStorage.removeItem('cc_saved_game');
    localStorage.removeItem('cubeCrash_gameState');
    logger.info('🗑️ Cleared saved game - next play will start fresh');
    
    // Hide app element (game)
    uiManager.hideApp();
    
    // Show navigation FIRST
    uiManager.showNavigation();
    
    // Show homepage with proper state
    uiManager.showHomepage();
    
    // Reset game state FIRST
    gameState.setState({
      homepageReady: true,
      isGameActive: false,
      isPaused: false
    });
    
    console.log('✅ Game state reset - homepage should be visible now');
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

// Track highest board reached
(window as any).trackHighestBoard = (currentBoard: number) => {
  console.log('📊 Tracking highest board reached:', currentBoard);
  
  try {
    const savedHighestBoardStr = localStorage.getItem('cc_highest_board');
    const savedHighestBoard = savedHighestBoardStr ? parseInt(savedHighestBoardStr, 10) || 0 : 0;
    
    if (currentBoard > savedHighestBoard) {
      localStorage.setItem('cc_highest_board', currentBoard.toString());
      console.log('✅ Highest board updated to:', currentBoard);
    } else {
      console.log('ℹ️ Current board', currentBoard, 'is not higher than saved:', savedHighestBoard);
    }
  } catch (error) {
    console.error('❌ Failed to track highest board:', error);
  }
};

// Track cubes cracked (when tiles are merged)
(window as any).trackCubesCracked = (count: number = 1) => {
  try {
    const savedCubesStr = localStorage.getItem('cc_cubes_cracked');
    const savedCubes = savedCubesStr ? parseInt(savedCubesStr, 10) || 0 : 0;
    const newCount = savedCubes + count;
    localStorage.setItem('cc_cubes_cracked', newCount.toString());
    console.log('✅ Cubes cracked updated:', newCount);
  } catch (error) {
    console.error('❌ Failed to track cubes cracked:', error);
  }
};

// Track helpers used (wild cubes, powerups, etc.)
(window as any).trackHelpersUsed = (count: number = 1) => {
  try {
    const savedHelpersStr = localStorage.getItem('cc_helpers_used');
    const savedHelpers = savedHelpersStr ? parseInt(savedHelpersStr, 10) || 0 : 0;
    const newCount = savedHelpers + count;
    localStorage.setItem('cc_helpers_used', newCount.toString());
    console.log('✅ Helpers used updated:', newCount);
  } catch (error) {
    console.error('❌ Failed to track helpers used:', error);
  }
};

// Track longest combo
(window as any).trackLongestCombo = (comboLength: number) => {
  try {
    const savedComboStr = localStorage.getItem('cc_longest_combo');
    const savedCombo = savedComboStr ? parseInt(savedComboStr, 10) || 0 : 0;
    
    if (comboLength > savedCombo) {
      localStorage.setItem('cc_longest_combo', comboLength.toString());
      console.log('🔥 New longest combo!', comboLength);
    }
  } catch (error) {
    console.error('❌ Failed to track longest combo:', error);
  }
};

// Track collectibles unlocked
(window as any).trackCollectiblesUnlocked = (unlockedCount: number) => {
  try {
    const savedStr = localStorage.getItem('cc_collectibles_unlocked');
    const saved = savedStr ? parseInt(savedStr, 10) || 0 : 0;
    
    if (unlockedCount > saved) {
      localStorage.setItem('cc_collectibles_unlocked', unlockedCount.toString());
      console.log('🎁 Collectibles unlocked updated:', unlockedCount);
    }
  } catch (error) {
    console.error('❌ Failed to track collectibles unlocked:', error);
  }
};

// Check collectibles milestones based on score
(window as any).checkCollectiblesMilestones = (score: number) => {
  try {
    const milestones = [100, 500, 1000, 2000, 5000, 10000, 20000, 50000];
    let unlocked = 0;
    
    for (const milestone of milestones) {
      if (score >= milestone) {
        unlocked++;
      }
    }
    
    const savedStr = localStorage.getItem('cc_collectibles_unlocked');
    const saved = savedStr ? parseInt(savedStr, 10) || 0 : 0;
    
    if (unlocked > saved) {
      localStorage.setItem('cc_collectibles_unlocked', unlocked.toString());
      console.log('🎁 New collectible unlocked! Total:', unlocked);
    }
  } catch (error) {
    console.error('❌ Failed to check collectibles milestones:', error);
  }
};

// Reset all stats (dev function for testing)
(window as any).resetAllStats = () => {
  try {
    localStorage.setItem('cc_best_score_v1', '0');
    localStorage.setItem('cc_highest_board', '0');
    localStorage.setItem('cc_time_played', '0');
    localStorage.setItem('cc_cubes_cracked', '0');
    localStorage.setItem('cc_helpers_used', '0');
    localStorage.setItem('cc_longest_combo', '0');
    localStorage.setItem('cc_collectibles_unlocked', '0');
    console.log('🔄 All stats reset to 0');
  } catch (error) {
    console.error('❌ Failed to reset stats:', error);
  }
};

// Track total time played
let gameStartTime: number | null = null;
let accumulatedTime: number = 0;

// Initialize time tracking
try {
  const savedTimeStr = localStorage.getItem('cc_time_played');
  accumulatedTime = savedTimeStr ? parseInt(savedTimeStr, 10) || 0 : 0;
  console.log('⏱️ Loaded accumulated time from localStorage:', accumulatedTime, 'seconds');
} catch (error) {
  console.error('❌ Failed to load accumulated time:', error);
}

// Start tracking time when game starts
(window as any).startTimeTracking = () => {
  gameStartTime = Date.now();
  console.log('⏱️ Started tracking time');
};

// Stop tracking time and add to accumulated time
(window as any).stopTimeTracking = () => {
  if (gameStartTime !== null) {
    const elapsedTime = Math.floor((Date.now() - gameStartTime) / 1000); // Convert to seconds
    accumulatedTime += elapsedTime;
    gameStartTime = null;
    
    try {
      localStorage.setItem('cc_time_played', accumulatedTime.toString());
      console.log('⏱️ Time tracked:', elapsedTime, 'seconds, total:', accumulatedTime, 'seconds');
    } catch (error) {
      console.error('❌ Failed to save time played:', error);
    }
  }
};
