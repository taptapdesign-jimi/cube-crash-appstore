// CUBE CRASH - MAIN ENTRY POINT
// Clean, modular architecture

import { bootstrapReady } from './ui/bootstrap-ui.js';
import './ui/collectibles-bridge.js';
// boot and layout imported statically for instant access
import { boot as bootGame, layoutBoard as layoutGame, cleanupGame, animateBoardExit } from './modules/app-core.js';
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
  initDrag
} from './modules/drag-core.js';
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
import { STATE } from './modules/app-state.js';

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
    
    // Initialize pending collectibles flip list
    if (!Array.isArray((window as any).__pendingCollectibleFlips)) {
      (window as any).__pendingCollectibleFlips = [];
    }
    
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

    // Fallback: force-hide loader if something stalls (safety net)
    const forceHideTimeout = setTimeout(() => {
      logger.warn('⚠️ Loader safety timeout reached - forcing hide');
      uiManager.hideLoadingScreen();
    }, 12000);
    
    // Setup progress callback
    assetPreloader.setProgressCallback((percentage: number, loadedCount: number, totalCount: number) => {
      uiManager.updateLoadingProgress(percentage);
      logger.info(`📦 Loading progress: ${percentage}% (${loadedCount}/${totalCount})`);
    });
    
    // Start preloading
    await assetPreloader.preloadAll();
    
    // Set to 100% before hiding
    uiManager.updateLoadingProgress(100);
    
    // Small delay to show 100% + pause before transitioning to home
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Hide loading screen and show home
    uiManager.hideLoadingScreen();
    clearTimeout(forceHideTimeout);
    await appManager.showScreen('home');
    
    // Play enter animation for Slide 1 after homepage is shown
    console.log('🎬 Playing initial enter animation for Slide 1');
    animateSliderEnter();
    
    logger.info('✅ Assets preloaded successfully');
    
  } catch (error) {
    logger.error('❌ Asset preloading failed:', String(error));
    // Ensure loader doesn’t block UI if preload fails
    try { uiManager.hideLoadingScreen(); } catch {}
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

// 🔥 JOURNEY PROGRESSION: Helper function to start a new run for a specific board
async function startNewRun(boardId: number): Promise<void> {
  logger.info(`🎮 startNewRun called for board ${boardId}`);
  
  // Import journey progression state
  const { journeyProgressionState } = await import('./modules/journey-progression-state.js');
  
  // Set lastOpenedBoardId and currentRunState
  journeyProgressionState.setLastOpenedBoardId(boardId);
  journeyProgressionState.setCurrentRunState(boardId, 0);
  
  // Clear any saved game state (starting fresh)
  localStorage.removeItem('cc_saved_game');
  localStorage.removeItem('cc_board_completed');
  localStorage.removeItem('cubeCrash_gameState');
  
  // Play exit animation
  animateSliderExit();
  
  // Wait for exit animation, then start game
  setTimeout(async () => {
    uiManager.hideHomepage();
    uiManager.showApp();
    
    try {
      // Set flag so boot() starts at the correct board
      (window as any).__ccStartAtLevel = boardId;
      console.log(`🎯 Setting __ccStartAtLevel to ${boardId} for new run`);
      
      // Boot the game
      await bootGame();
      await layoutGame();
      
      // Clear flag after boot
      delete (window as any).__ccStartAtLevel;
      
      logger.info(`✅ New run started for board ${boardId}`);
    } catch (error) {
      logger.error(`❌ Failed to start new run for board ${boardId}:`, error);
      delete (window as any).__ccStartAtLevel;
    }
  }, 770);
}

// Continue game with saved state - NOW TIED TO JOURNEY PROGRESSION
(window as any).continueGameWithSavedState = async () => {
  logger.info('🔄 continueGameWithSavedState called - loading saved game');
  
  // Import journey progression state
  const { journeyProgressionState } = await import('./modules/journey-progression-state.js');
  
  try {
    // 🔥 JOURNEY PROGRESSION: Check if there's an active in-progress run
    const currentRunState = journeyProgressionState.getCurrentRunState();
    const savedGame = localStorage.getItem('cc_saved_game');
    
    // Case A: Active in-progress run - resume exactly where they left off
    if (currentRunState && currentRunState.inProgress && savedGame) {
      logger.info(`🎮 Case A: Resuming active run for board ${currentRunState.boardId}`);
      
      // 🔥 USER REQUEST: Check if we came from Journey screen - skip slider exit animation
      const cameFromJourney = (window as any).__ccCameFromJourney === true;
      
      if (!cameFromJourney) {
        // Only play slider exit animation if we came from homepage
        animateSliderExit();
      } else {
        // Journey screen exit animation already played - just hide homepage and show app immediately
        logger.info('🗺️ Skipping slider exit animation - already came from Journey screen');
        uiManager.hideHomepage();
        uiManager.showApp();
      }
      
      // 🔥 USER REQUEST: If came from Journey, start immediately (no delay)
      // Journey exit animation already completed, so we can start game right away
      if (cameFromJourney) {
        // 🔥 CRITICAL: Hide Journey screen and homepage BEFORE starting game
        // This ensures clean transition and that animations are visible
        const journeyScreen = document.getElementById('journey-screen');
        if (journeyScreen) {
          journeyScreen.classList.add('hidden');
          journeyScreen.style.display = 'none';
          journeyScreen.style.visibility = 'hidden';
          journeyScreen.style.opacity = '0';
          console.log('✅ Journey screen hidden before game start');
        }
        
        // Hide homepage
        uiManager.hideHomepage();
        
        // Show app element BEFORE booting game (so animations are visible)
        uiManager.showApp();
        console.log('✅ App element shown before game boot');
        
        // Start immediately - no delay needed
        try {
          const gameState = JSON.parse(savedGame);
          const savedBoardNumber = Number.isFinite(gameState.boardNumber) 
            ? gameState.boardNumber 
            : (Number.isFinite(gameState.level) ? gameState.level : 1);
          
          // Set flags to resume at correct board
          (window as any).__ccStartAtLevel = savedBoardNumber;
          (window as any).__ccSkipRebuildBoard = true;
          // 🔥 USER REQUEST: Trigger HUD drop animation when resuming from Journey
          (window as any).__ccTriggerHudDrop = true;
          
          await bootGame();
          await layoutGame();
          
          // Load saved game state
          const loadGameState = (window as any).loadGameState;
          if (typeof loadGameState === 'function') {
            const loaded = await loadGameState();
            if (!loaded) {
              logger.error('❌ Failed to load saved game state');
              const rebuildBoard = (window as any).rebuildBoard;
              if (typeof rebuildBoard === 'function') {
                rebuildBoard();
              }
            }
          }
          
          delete (window as any).__ccStartAtLevel;
          delete (window as any).__ccSkipRebuildBoard;
          delete (window as any).__ccTriggerHudDrop;
        } catch (error) {
          logger.error('❌ Failed to resume active run:', error);
          delete (window as any).__ccStartAtLevel;
          delete (window as any).__ccTriggerHudDrop;
        }
      } else {
        // Wait for exit animation (770ms), then load saved game
        setTimeout(async () => {
          uiManager.hideHomepage();
          uiManager.showApp();
          
          try {
            const gameState = JSON.parse(savedGame);
            const savedBoardNumber = Number.isFinite(gameState.boardNumber) 
              ? gameState.boardNumber 
              : (Number.isFinite(gameState.level) ? gameState.level : 1);
            
            // Set flags to resume at correct board
            (window as any).__ccStartAtLevel = savedBoardNumber;
            (window as any).__ccSkipRebuildBoard = true;
            
            await bootGame();
            await layoutGame();
            
            // Load saved game state
            const loadGameState = (window as any).loadGameState;
            if (typeof loadGameState === 'function') {
              const loaded = await loadGameState();
              if (!loaded) {
                logger.error('❌ Failed to load saved game state');
                const rebuildBoard = (window as any).rebuildBoard;
                if (typeof rebuildBoard === 'function') {
                  rebuildBoard();
                }
              }
            }
            
            delete (window as any).__ccStartAtLevel;
            delete (window as any).__ccSkipRebuildBoard;
          } catch (error) {
            logger.error('❌ Failed to resume active run:', error);
            delete (window as any).__ccStartAtLevel;
          }
        }, 770);
      }
      
      return; // Exit early
    }
    
    // Case B: No active run, but we know the last board from Journey
    const lastOpenedBoardId = journeyProgressionState.getLastOpenedBoardId();
    if (lastOpenedBoardId !== null) {
      logger.info(`🎮 Case B: Starting fresh run for last opened board ${lastOpenedBoardId}`);
      await startNewRun(lastOpenedBoardId);
      return; // Exit early
    }
    
    // Case C: Safety fallback - start from highest unlocked board
    const highestUnlockedBoardId = journeyProgressionState.getHighestUnlockedBoardId();
    if (highestUnlockedBoardId !== null) {
      logger.info(`🎮 Case C: Starting fresh run for highest unlocked board ${highestUnlockedBoardId}`);
      journeyProgressionState.setLastOpenedBoardId(highestUnlockedBoardId);
      await startNewRun(highestUnlockedBoardId);
      return; // Exit early
    }
    
    // Case D: Very first time ever - hide Continue or start from Board 1
    logger.warn('⚠️ No Journey progression state found - starting from Board 1');
    journeyProgressionState.setLastOpenedBoardId(1);
    await startNewRun(1);
    
  } catch (error) {
    logger.error('❌ Failed to continue game:', error);
    console.warn('⚠️ Starting fresh game from Board 1');
    await startNewRun(1);
  }
};

// 🔥 JOURNEY PROGRESSION: Export startNewRun function globally (for Continue button)
(window as any).startNewRun = async (boardId: number) => {
  logger.info(`🎮 startNewRun called for board ${boardId}`);
  
  // Import journey progression state
  const { journeyProgressionState } = await import('./modules/journey-progression-state.js');
  
  // Set lastOpenedBoardId and currentRunState
  journeyProgressionState.setLastOpenedBoardId(boardId);
  journeyProgressionState.setCurrentRunState(boardId, 0);
  
  // Clear any saved game state (starting fresh)
  localStorage.removeItem('cc_saved_game');
  localStorage.removeItem('cc_board_completed');
  localStorage.removeItem('cubeCrash_gameState');
  
  // 🔥 USER REQUEST: Check if we came from Journey screen - skip slider exit animation
  const cameFromJourney = (window as any).__ccCameFromJourney === true;
  
  if (!cameFromJourney) {
    // Only play slider exit animation if we came from homepage
    animateSliderExit();
  } else {
    // Journey screen exit animation already played - just hide homepage and show app immediately
    logger.info('🗺️ Skipping slider exit animation - already came from Journey screen');
    uiManager.hideHomepage();
    uiManager.showApp();
  }
  
  // 🔥 USER REQUEST: If came from Journey, start immediately (no delay)
  // Journey exit animation already completed, so we can start game right away
  if (cameFromJourney) {
    // 🔥 CRITICAL: Hide Journey screen and homepage BEFORE starting game
    // This ensures clean transition and that animations are visible
    const journeyScreen = document.getElementById('journey-screen');
    if (journeyScreen) {
      journeyScreen.classList.add('hidden');
      journeyScreen.style.display = 'none';
      journeyScreen.style.visibility = 'hidden';
      journeyScreen.style.opacity = '0';
      console.log('✅ Journey screen hidden before game start');
    }
    
    // Hide homepage
    uiManager.hideHomepage();
    
    // Show app element BEFORE booting game (so animations are visible)
    uiManager.showApp();
    console.log('✅ App element shown before game boot');
    
    // Start immediately - no delay needed
    try {
      // Set flag so boot() starts at the correct board
      (window as any).__ccStartAtLevel = boardId;
      // 🔥 USER REQUEST: Trigger HUD drop animation when starting new run from Journey
      (window as any).__ccTriggerHudDrop = true;
      console.log(`🎯 Setting __ccStartAtLevel to ${boardId} and __ccTriggerHudDrop for new run from Journey`);
      
      // Boot the game
      await bootGame();
      await layoutGame();
      
      // Clear flag after boot
      delete (window as any).__ccStartAtLevel;
      delete (window as any).__ccTriggerHudDrop;
      
      logger.info(`✅ New run started for board ${boardId} from Journey`);
    } catch (error) {
      logger.error(`❌ Failed to start new run for board ${boardId}:`, error);
      delete (window as any).__ccStartAtLevel;
      delete (window as any).__ccTriggerHudDrop;
    }
  } else {
    // Wait for exit animation (770ms), then start game
    setTimeout(async () => {
      uiManager.hideHomepage();
      uiManager.showApp();
      
      try {
        // Set flag so boot() starts at the correct board
        (window as any).__ccStartAtLevel = boardId;
        console.log(`🎯 Setting __ccStartAtLevel to ${boardId} for new run`);
        
        // Boot the game
        await bootGame();
        await layoutGame();
        
        // Clear flag after boot
        delete (window as any).__ccStartAtLevel;
        
        logger.info(`✅ New run started for board ${boardId}`);
      } catch (error) {
        logger.error(`❌ Failed to start new run for board ${boardId}:`, error);
        delete (window as any).__ccStartAtLevel;
      }
    }, 770);
  }
};

// 🔥 JOURNEY PROGRESSION: Export startNewRunFromJourney function (with board enter animation)
(window as any).startNewRunFromJourney = async (boardId: number) => {
  logger.info(`🎮 startNewRunFromJourney called for board ${boardId}`);
  
  // Import journey progression state
  const { journeyProgressionState } = await import('./modules/journey-progression-state.js');
  
  // Set lastOpenedBoardId and currentRunState
  journeyProgressionState.setLastOpenedBoardId(boardId);
  journeyProgressionState.setCurrentRunState(boardId, 0);
  
  // Clear any saved game state (starting fresh)
  localStorage.removeItem('cc_saved_game');
  localStorage.removeItem('cc_board_completed');
  localStorage.removeItem('cubeCrash_gameState');
  
  // Hide homepage and show app (no slider exit animation - already done)
  uiManager.hideHomepage();
  uiManager.showApp();
  
  try {
    // Set flag so boot() starts at the correct board
    (window as any).__ccStartAtLevel = boardId;
    // Set flag to trigger HUD drop animation (sweetPopIn will check this)
    (window as any).__ccTriggerHudDrop = true;
    console.log(`🎯 Setting __ccStartAtLevel to ${boardId} and __ccTriggerHudDrop for new run from Journey`);
    
    // Boot the game
    await bootGame();
    await layoutGame();
    
    // Clear flags after boot
    delete (window as any).__ccStartAtLevel;
    delete (window as any).__ccTriggerHudDrop;
    
    logger.info(`✅ New run started for board ${boardId} with enter animation`);
  } catch (error) {
      logger.error(`❌ Failed to start new run for board ${boardId}:`, error);
      delete (window as any).__ccStartAtLevel;
    }
};

// New sequence handler: bottom sheet close → exit anim → game start
(window as any).triggerGameStartSequence = async () => {
  logger.info('🎬 Starting game start sequence...');
  
  // 🔥 USER REQUEST: Mark that we came from homepage (not Journey)
  // This ensures exitToMenu returns to homepage (slide 0) instead of Journey (slide 1)
  (window as any).__ccCameFromHomepage = true;
  (window as any).__ccCameFromJourney = false;
  console.log('🏠 Marked as coming from homepage');
  
  // Step 1: Play exit animation FIRST
  console.log('🎬 Step 1: Playing exit animation');
  animateSliderExit();
  
  // Step 2: Wait for exit animation to complete, then hide homepage and start game
  setTimeout(() => {
    console.log('🎮 Step 2: Starting game after exit animation');
    uiManager.hideHomepage(); // Hide homepage AFTER animation
    uiManager.startNewGame(); // Start game boot (always Board 1 for New Game)
  }, 770); // 120ms delay + 650ms animation = 770ms total
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
    
    // CRITICAL: Save game state BEFORE animations and cleanup
    // This ensures game state is saved even if cleanup fails
    try {
      if (typeof window.saveGameState === 'function') {
        console.log('💾 Saving game state before exit...');
        window.saveGameState();
        console.log('✅ Game state saved before exit');
        
        // 🔥 USER BUG FIX: Double-check that state was saved correctly
        const savedGame = localStorage.getItem('cc_saved_game');
        if (savedGame) {
          try {
            const gameState = JSON.parse(savedGame);
            console.log('✅ Verified saved game state:', {
              boardNumber: gameState.boardNumber,
              level: gameState.level,
              score: gameState.score,
              timestamp: gameState.timestamp
            });
          } catch (e) {
            console.warn('⚠️ Failed to verify saved game state:', e);
          }
        } else {
          console.warn('⚠️ WARNING: Game state was not saved!');
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to save game state during exit:', error);
    }
    
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
      // Hide board indicator (board tag) before board exit animation
      const { animateBoardIndicatorExit } = await import('./modules/hud-helpers.js');
      if (typeof animateBoardIndicatorExit === 'function') {
        animateBoardIndicatorExit(0.3);
        console.log('✅ Board indicator exit animation started');
      }
      
      await animateBoardExit();
      console.log('✅ Board exit animations completed');
    } catch (error) {
      console.warn('⚠️ Board exit animation failed:', error);
    }
    
    // Step 2: Kill ALL GSAP tweens immediately after animations complete
    console.log('🧹 Killing all GSAP tweens after animations...');
    try {
      // Kill UI element tweens
      gsap.killTweensOf('[data-wild-loader]');
      gsap.killTweensOf('.wild-loader');
      gsap.killTweensOf('p');
      gsap.killTweensOf('progress');
      
      // CRITICAL: Kill PIXI object tweens (tiles and HUD) - MUST be done before cleanupGame
      // Kill all tile tweens with null checks to prevent "Cannot read properties of null (reading 'y')" errors
      if (STATE && STATE.tiles && STATE.tiles.length > 0) {
        STATE.tiles.forEach(tile => {
          try {
            // Check if tile exists and is not destroyed before killing tweens
            if (tile && !tile.destroyed) {
              if (tile.scale && !tile.scale.destroyed) {
                gsap.killTweensOf(tile.scale);
              }
              // Kill tweens on tile itself (x, y, alpha, etc.)
              gsap.killTweensOf(tile);
              // Also kill tweens on tile properties that might be animated
              if (tile.hover && !tile.hover.destroyed) {
                gsap.killTweensOf(tile.hover);
              }
            }
          } catch (e) {
            // Ignore errors for already destroyed tiles
          }
        });
      }
      
      // Kill HUD tweens with null checks
      if (STATE) {
        try {
          if (STATE.hud && !STATE.hud.destroyed) {
            gsap.killTweensOf(STATE.hud);
          }
          if (STATE.board && !STATE.board.destroyed) {
            gsap.killTweensOf(STATE.board);
          }
          if (STATE.stage && !STATE.stage.destroyed) {
            gsap.killTweensOf(STATE.stage);
          }
          // Kill tweens on background layer if it exists
          if (STATE.backgroundLayer && !STATE.backgroundLayer.destroyed) {
            gsap.killTweensOf(STATE.backgroundLayer);
          }
        } catch (e) {
          // Ignore errors
        }
      }
      
      // CRITICAL: Kill all GSAP timelines that might reference destroyed objects
      try {
        // Get all active tweens and kill them if their target is destroyed
        const allTweens = gsap.globalTimeline.getChildren();
        allTweens.forEach((tween: any) => {
          try {
            const target = tween.targets?.[0];
            if (target && (target.destroyed || target === null || target === undefined)) {
              tween.kill();
            }
          } catch (e) {
            // Ignore errors
          }
        });
      } catch (e) {
        // Ignore errors
      }
      
      console.log('✅ All GSAP tweens killed');
    } catch (gsapError) {
      console.warn('⚠️ Error killing GSAP tweens:', gsapError);
    }
    
    // Step 3: Clean up game state AFTER killing all tweens
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
    
    // NOTE: Saved game state is now handled in end-run-modal.ts
    // Only clear if user made no moves; otherwise keep state for resume
    
    // 🔥 CRITICAL FIX: Hide app element and canvas BEFORE showing homepage
    // This ensures board element doesn't show on top of homepage/slider
    uiManager.hideApp();
    
    // 🔥 CRITICAL FIX: Remove ALL canvas elements from DOM to prevent them from showing
    // This ensures no leftover canvas elements are visible when returning to homepage
    try {
      const appElement = document.getElementById('app');
      if (appElement) {
        // Remove all canvas elements from app container
        const canvases = appElement.querySelectorAll('canvas');
        canvases.forEach(canvas => {
          try {
            canvas.remove();
            console.log('✅ Removed canvas element from DOM');
          } catch (e) {
            console.warn('⚠️ Failed to remove canvas:', e);
          }
        });
        
        // Also check body for any stray canvas elements
        const bodyCanvases = document.body.querySelectorAll('canvas');
        bodyCanvases.forEach(canvas => {
          // Only remove if it's not part of another system
          if (canvas.parentElement === appElement || canvas.parentElement === document.body) {
            try {
              canvas.remove();
              console.log('✅ Removed stray canvas element from body');
            } catch (e) {
              console.warn('⚠️ Failed to remove stray canvas:', e);
            }
          }
        });
      }
    } catch (error) {
      console.warn('⚠️ Failed to remove canvas elements:', error);
    }
    
    // 🔥 CRITICAL FIX: Double-check that canvas is hidden after cleanupGame
    // Sometimes canvas can reappear after cleanup, so we hide it again
    try {
      const canvas = document.querySelector('#app canvas');
      if (canvas && canvas instanceof HTMLElement) {
        canvas.style.display = 'none';
        canvas.style.visibility = 'hidden';
        canvas.style.opacity = '0';
        canvas.style.zIndex = '-1';
        canvas.style.pointerEvents = 'none';
        console.log('✅ Canvas double-checked and hidden after cleanupGame');
      }
    } catch (error) {
      console.warn('⚠️ Failed to double-check canvas hiding:', error);
    }
    
    // 🔥 CRITICAL FIX: Also hide HUD container if it exists
    try {
      const hudContainer = document.getElementById('hud-container');
      if (hudContainer) {
        hudContainer.style.display = 'none';
        hudContainer.style.visibility = 'hidden';
        hudContainer.style.opacity = '0';
        hudContainer.style.zIndex = '-1';
        hudContainer.style.pointerEvents = 'none';
        console.log('✅ HUD container hidden');
      }
    } catch (error) {
      console.warn('⚠️ Failed to hide HUD container:', error);
    }
    
    // 🔥 CRITICAL FIX: Also hide board indicator if it exists
    try {
      const boardIndicator = document.getElementById('hud-board');
      if (boardIndicator) {
        boardIndicator.style.display = 'none';
        boardIndicator.style.visibility = 'hidden';
        boardIndicator.style.opacity = '0';
        boardIndicator.style.zIndex = '-1';
        boardIndicator.style.pointerEvents = 'none';
        console.log('✅ Board indicator hidden');
      }
    } catch (error) {
      console.warn('⚠️ Failed to hide board indicator:', error);
    }
    
    
    // 🔥 JOURNEY PROGRESSION: Check if user came from Journey screen
    // 🔥 USER REQUEST: Determine target slide based on where user came from
    // 1. If came from homepage Play button → return to homepage (slide 0)
    // 2. If came from Journey Continue button → return to Journey (slide 1)
    let targetSlide = 0; // Default to homepage
    try {
      // 🔥 CRITICAL: Check localStorage FIRST (before clearing) - most reliable for persistence
      const cameFromJourneyStorage = localStorage.getItem('__ccCameFromJourney') === 'true';
      const cameFromHomepageStorage = localStorage.getItem('__ccCameFromHomepage') === 'true';
      
      // Also check window flags (for current session)
      const cameFromJourneyWindow = (window as any).__ccCameFromJourney === true;
      const cameFromHomepageWindow = (window as any).__ccCameFromHomepage === true;
      
      // Combine both sources
      let cameFromJourney = cameFromJourneyWindow || cameFromJourneyStorage;
      const cameFromHomepage = cameFromHomepageWindow || cameFromHomepageStorage;
      
      // 🔥 USER REQUEST: If flag is not set, check lastOpenedBoardId as primary indicator
      // If user has lastOpenedBoardId, they came from Journey screen (especially for interim cards)
      if (!cameFromJourney && !cameFromHomepage) {
        const { journeyProgressionState } = await import('./modules/journey-progression-state.js');
        const lastOpenedBoardId = journeyProgressionState.getLastOpenedBoardId();
        if (lastOpenedBoardId !== null && lastOpenedBoardId >= 1) {
          cameFromJourney = true;
          console.log(`🗺️ No flag found, but lastOpenedBoardId is ${lastOpenedBoardId} - user came from Journey`);
        }
      }
      
      console.log('🔍 Exit context check:', {
        cameFromJourneyWindow,
        cameFromJourneyStorage,
        cameFromJourney,
        cameFromHomepageWindow,
        cameFromHomepageStorage,
        cameFromHomepage
      });
      
      if (cameFromJourney) {
        // User came from Journey screen → return to Journey slide
        targetSlide = 1;
        console.log('🎯 User came from Journey screen - returning to Journey slide');
        
        // 🔥 CRITICAL: Hide detail modal if it's open (but NOT Journey screen - we'll show it)
        const detailModal = document.getElementById('collectibles-detail-modal');
        if (detailModal) {
          detailModal.hidden = true;
          detailModal.style.display = 'none';
          console.log('✅ Detail modal hidden');
        }
      } else if (cameFromHomepage) {
        // User came from homepage → return to homepage
        targetSlide = 0;
        console.log('🏠 User came from homepage - returning to homepage slide');
      } else {
        // No flags set → default to homepage
        targetSlide = 0;
        console.log('🏠 No Journey context found - defaulting to homepage slide');
      }
      
      // Clear flags AFTER determining target slide
      delete (window as any).__ccCameFromHomepage;
      delete (window as any).__ccCameFromJourney;
      // 🔥 FIX: Also clear from localStorage AFTER use
      localStorage.removeItem('__ccCameFromJourney');
      localStorage.removeItem('__ccCameFromHomepage');
    } catch (error) {
      console.warn('⚠️ Failed to determine target slide:', error);
    }
    
    // 🔥 USER REQUEST: Show navigation and homepage ONLY if returning to homepage (slide 0)
    // If returning to Journey screen (slide 1), hide homepage and navigation
    if (targetSlide === 0) {
      // Show navigation and homepage for homepage slider
      uiManager.showNavigation();
      uiManager.showHomepageQuietly();
      console.log('✅ Navigation and homepage shown - returning to homepage slider');
    } else {
      // 🔥 CRITICAL: Hide homepage COMPLETELY when returning to Journey screen
      // This ensures Journey screen is visible, not homepage slider
      uiManager.hideHomepage();
      
      // 🔥 CRITICAL: Also ensure homepage element is completely hidden
      const homeElement = document.getElementById('home');
      if (homeElement) {
        homeElement.style.display = 'none';
        homeElement.setAttribute('hidden', 'true');
        homeElement.style.visibility = 'hidden';
        homeElement.style.opacity = '0';
        homeElement.style.zIndex = '-1';
        console.log('✅ Homepage element completely hidden - Journey screen will be visible');
      }
      
      // 🔥 CRITICAL: Hide navigation when returning to Journey screen
      // Navigation will be hidden by MutationObserver in navigation-control.ts
      // But we set it here to ensure it's hidden immediately
      const navElement = document.getElementById('independent-nav');
      if (navElement) {
        navElement.style.display = 'none';
        navElement.style.visibility = 'hidden';
        navElement.style.opacity = '0';
        navElement.setAttribute('aria-hidden', 'true');
        console.log('✅ Navigation hidden - returning to Journey screen');
      }
    }
    
    // Reset game state
    gameState.setState({
      homepageReady: true,
      isGameActive: false,
      isPaused: false
    });
    
    // CRITICAL: Reset slider to target slide (Journey or homepage) before entry animation
    console.log(`🎯 Resetting slider to slide ${targetSlide}...`);
    if (sliderManager) {
      sliderManager.setCurrentSlide(targetSlide);
      console.log(`✅ Slider reset to slide ${targetSlide}`);
      
      // 🔥 CRITICAL: Force immediate update of slider position (no animation)
      // This ensures Journey slide is visible immediately
      if (targetSlide === 1) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          const sliderWrapper = document.getElementById('slider-wrapper') as HTMLElement;
          if (sliderWrapper) {
            const sliderContainer = document.getElementById('slider-container') as HTMLElement;
            const slideWidth = sliderContainer?.offsetWidth || window.innerWidth;
            const offset = -targetSlide * slideWidth;
            // Use GSAP to set position immediately (no animation)
            if (typeof gsap !== 'undefined') {
              gsap.set(sliderWrapper, { x: offset, immediateRender: true });
            } else {
              sliderWrapper.style.transform = `translateX(${offset}px)`;
            }
            console.log(`✅ Slider wrapper forced to Journey slide position: ${offset}px`);
          }
          
        });
      }
    } else {
      console.warn('⚠️ SliderManager not found, trying gameState...');
      gameState.setState({ currentSlide: targetSlide });
    }
    
    // 🔥 USER REQUEST: Only update slider slides if returning to homepage (slide 0)
    // If returning to Journey (slide 1), don't touch slider - Journey screen is shown directly
    if (targetSlide === 0) {
      // Also update slide classes and nav buttons to match target slide
      const slides = document.querySelectorAll('.slider-slide');
      const navButtons = document.querySelectorAll('.independent-nav-button');
      slides.forEach((slide, index) => {
        if (index === targetSlide) {
          slide.classList.add('active');
          // 🔥 CRITICAL: Ensure target slide is visible
          (slide as HTMLElement).style.display = 'block';
          (slide as HTMLElement).style.visibility = 'visible';
          (slide as HTMLElement).style.opacity = '1';
          console.log(`✅ Slide ${index} set to active and visible`);
        } else {
          slide.classList.remove('active');
          // 🔥 FIX: Hide other slides to prevent conflicts
          if (index !== targetSlide) {
            (slide as HTMLElement).style.display = 'none';
          }
        }
      });
      navButtons.forEach((button, index) => {
        if (index === targetSlide) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
    } else {
      // 🔥 USER REQUEST: When returning to Journey screen, ensure all slides are visible
      // This prevents empty slides when user goes back from Journey screen
      const slides = document.querySelectorAll('.slider-slide');
      slides.forEach((slide, index) => {
        if (index === 1) {
          // Journey slide (index 1) should be active
          slide.classList.add('active');
          (slide as HTMLElement).style.display = 'block';
          (slide as HTMLElement).style.visibility = 'visible';
          (slide as HTMLElement).style.opacity = '1';
        } else {
          // Other slides should be visible but not active
          slide.classList.remove('active');
          (slide as HTMLElement).style.display = 'block';
          (slide as HTMLElement).style.visibility = 'visible';
          (slide as HTMLElement).style.opacity = '1';
        }
      });
      console.log('✅ All slides made visible for Journey screen return');
    }
    
    console.log('✅ Game state reset - homepage should be visible now');
    
    // Step 3: Play entry animation and show appropriate screen
    if (targetSlide === 1) {
      // 🔥 USER REQUEST: Show Journey screen when returning to Journey slide
      // Use requestAnimationFrame to ensure homepage is hidden and DOM is ready
      requestAnimationFrame(() => {
        setTimeout(() => {
          console.log('🗺️ Showing Journey screen...');
          const collectiblesManager = (window as any).collectiblesManager;
          if (collectiblesManager && typeof collectiblesManager.showCollectibles === 'function') {
            collectiblesManager.showCollectibles();
            console.log('✅ Journey screen shown');
            
            // 🔥 CRITICAL: Ensure Journey screen is visible and on top
            const journeyScreen = document.getElementById('journey-screen');
            if (journeyScreen) {
              journeyScreen.classList.remove('hidden');
              journeyScreen.style.display = 'flex';
              journeyScreen.style.visibility = 'visible';
              journeyScreen.style.opacity = '1';
              journeyScreen.style.zIndex = '999999';
              console.log('✅ Journey screen forced to visible with correct z-index');
            }
            
            // 🔥 CRITICAL: Ensure navigation is hidden when Journey screen is shown
            // MutationObserver in navigation-control.ts will handle this, but we set it here too
            const navElement = document.getElementById('independent-nav');
            if (navElement) {
              navElement.style.display = 'none';
              navElement.style.visibility = 'hidden';
              navElement.style.opacity = '0';
              navElement.setAttribute('aria-hidden', 'true');
              console.log('✅ Navigation hidden after Journey screen shown');
            }
          } else {
            console.warn('⚠️ CollectiblesManager not found - cannot show Journey screen');
          }
        }, 100);
      });
      
      // Play slider enter animation for Journey slide
      console.log('🎬 Playing Journey slide entry animation...');
      animateSliderEnter();
    } else {
      // Play homepage entry animation
      console.log('🎬 Playing homepage entry animation...');
      animateSliderEnter();
    }
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

// Export collectibles hide with animation
(window as any).hideCollectiblesScreenWithAnimation = async () => {
  await uiManager.hideCollectiblesScreenWithAnimation();
};
