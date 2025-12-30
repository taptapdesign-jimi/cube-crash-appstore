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
import './modules/score-bottom-sheet.js'; // Score bottom sheet for HUD clicks
import { animateSliderExit, animateSliderEnter } from './utils/animations.js';
import { STATE } from './modules/app-state.js';
import { hideNativeSplash } from './utils/native-splash.js';

// Type definitions
interface GameState {
  homepageReady: boolean;
  isGameActive: boolean;
  isPaused: boolean;
}

// Window interface is now defined in src/types/window.d.ts

  // Game starting

// Ensure the homepage CTA starts hidden and ready for the enter animation (prevents preload flash)
function primeHomeCtaForEnter(): void {
  try {
    const firstSlide = document.querySelector('.slider-slide[data-slide="0"]');
    const slideButton = firstSlide?.querySelector('.slide-button') as HTMLElement | null;
    if (!slideButton) return;

    slideButton.classList.remove('animate-exit', 'animate-enter', 'animate-reset');
    if (!slideButton.classList.contains('animate-enter-initial')) {
      slideButton.classList.add('animate-enter-initial');
    }
    slideButton.style.visibility = 'hidden';
    slideButton.style.removeProperty('transform');
    slideButton.style.removeProperty('transition');
  } catch (error) {
    logger.warn('⚠️ Failed to prime home CTA for enter animation:', error);
  }
}

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
    
    // 🔥 CRITICAL: Initialize launch screen FIRST and IMMEDIATELY
    // This sets #FAFAFA background before any other code can set gradient
    const { launchScreen } = await import('./modules/launch-screen.js');
    launchScreen.init(); // Sets #FAFAFA background synchronously and immediately
    
    // 🔥 CRITICAL: Hide native splash immediately
    try {
      const { hideNativeSplash } = await import('./utils/native-splash.js');
      await hideNativeSplash({ fadeOutDuration: 200 });
      logger.info('✅ Native splash hidden');
    } catch (error) {
      logger.warn('⚠️ Failed to hide native splash:', error);
    }

    // Fallback: force-hide loader if something stalls (safety net)
    const forceHideTimeout = setTimeout(() => {
      logger.warn('⚠️ Loader safety timeout reached - forcing hide');
      launchScreen.hide();
    }, 12000);
    
    // Setup progress callback (for future use if needed)
    assetPreloader.setProgressCallback((percentage: number, loadedCount: number, totalCount: number) => {
      logger.info(`📦 Loading progress: ${percentage}% (${loadedCount}/${totalCount})`);
    });
    
    // 🔥 CRITICAL: Start preloading immediately in background (non-blocking)
    // This runs in parallel with the launch screen animations
    const preloadPromise = assetPreloader.preloadAll().catch((error) => {
      logger.error('❌ Asset preloading failed:', error);
      throw error;
    });
    
    // Start launch screen sequence (runs in parallel with preloading)
    const launchPromise = launchScreen.start(() => {
      logger.info('✅ Launch screen sequence completed');
    });
    
    // Wait for both to complete
    await Promise.all([preloadPromise, launchPromise]);
    
    logger.info('✅ Launch screen and preloading completed');
    
    // Remove launch screen from DOM
    launchScreen.hide();
    launchScreen.remove();
    
    // 🔥 CRITICAL: Launch screen already handled background transition
    // No need to set background here - launch-screen.ts already set gradient after Phase 2
    
    clearTimeout(forceHideTimeout);
    
    // 🔥 CRITICAL: Wait one frame before showing homepage to ensure smooth transition
    // This ensures the gradient background is rendered before homepage appears
    await new Promise(resolve => requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve(undefined)); // Double RAF for smoother transition
    }));
    
    await appManager.showScreen('home');
    
    // Set gradient background for homepage
    uiManager.showHomepage();
    
    // Make sure the Play CTA is hidden and in its initial state before the enter animation starts
    primeHomeCtaForEnter();

    // 🔥 NOTE: Journey screen boards are already prepared in preloadAll() (blocking)
    // No need to prepare again here - boards are ready before homepage is shown
    
    // Play enter animation for Slide 1 after homepage is shown
    console.log('🎬 Playing initial enter animation for Slide 1');
    animateSliderEnter();
    
    logger.info('✅ Assets preloaded successfully');
    
  } catch (error) {
    logger.error('❌ Asset preloading failed:', String(error));
    // Ensure loader doesn't block UI if preload fails
    try { 
      const { launchScreen } = await import('./modules/launch-screen.js');
      launchScreen.hide();
    } catch {}
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
  
  // 🔥 USER REQUEST: Check if we came from Journey screen - skip slider exit animation
  const cameFromJourney = (window as any).__ccCameFromJourney === true;
  
  // 🔥 USER REQUEST: If NOT from Journey, mark as coming from homepage
  // This ensures exitToMenu returns to homepage (slide 0) instead of Journey (slide 1)
  if (!cameFromJourney) {
    (window as any).__ccCameFromHomepage = true;
    (window as any).__ccCameFromJourney = false;
    localStorage.setItem('__ccCameFromHomepage', 'true');
    localStorage.removeItem('__ccCameFromJourney');
    console.log('🏠 Marked as coming from homepage (startNewRun from bottom sheet)');
    // Only play slider exit animation if we came from homepage
    animateSliderExit();
  } else {
    // 🔥 USER REQUEST: Journey screen exit animation already played in continueFromInterimBoard
    // DO NOT play slider exit animation - just hide homepage and show app immediately
    logger.info('🗺️ Skipping slider exit animation - Journey screen exit already completed');
    // Hide homepage immediately (no animation)
    uiManager.hideHomepage();
    // Show app element immediately
    uiManager.showApp();
  }
  
  // 🔥 APP STORE FIX: Event-driven approach for canvas visibility
  if (cameFromJourney) {
    try {
      // Set flags BEFORE booting game
      (window as any).__ccStartAtLevel = boardId;
      (window as any).__ccTriggerHudDrop = true;
      logger.info(`🎯 Starting board ${boardId} from Journey with HUD drop animation`);
      
      // Boot game and wait for canvas to be created
      await bootGame();
      
      // 🔥 APP STORE FIX: Wait for canvas to be added to DOM (event-driven)
      const appElement = document.getElementById('app');
      if (appElement) {
        // Wait for next paint cycle to ensure canvas is rendered
        await new Promise(resolve => requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        }));
        logger.info('✅ Canvas rendered and visible');
      }
      
      // Layout game (this triggers sweetPopIn which triggers HUD drop)
      await layoutGame();
      
      // Clear flags after boot
      delete (window as any).__ccStartAtLevel;
      delete (window as any).__ccTriggerHudDrop;
      
      logger.info(`✅ New run started for board ${boardId} from Journey with visible animations`);
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
        
        // 🔥 USER REQUEST: If NOT from Journey, mark as coming from homepage
        // This ensures exitToMenu returns to homepage (slide 0) instead of Journey (slide 1)
        if (!cameFromJourney) {
          (window as any).__ccCameFromHomepage = true;
          (window as any).__ccCameFromJourney = false;
          localStorage.setItem('__ccCameFromHomepage', 'true');
          localStorage.removeItem('__ccCameFromJourney');
          console.log('🏠 Marked as coming from homepage (Continue from bottom sheet)');
          // Only play slider exit animation if we came from homepage
          animateSliderExit();
        } else {
          // 🔥 USER REQUEST: Journey screen exit animation already played in continueFromInterimBoard
          // DO NOT play slider exit animation - just hide homepage and show app immediately
          logger.info('🗺️ Skipping slider exit animation - Journey screen exit already completed');
          // Hide homepage immediately (no animation)
          uiManager.hideHomepage();
          // Show app element immediately
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
          const savedScore = Number.isFinite(gameState.score) ? gameState.score : 0;
          
          // 🔥 CRITICAL FIX: Update currentRunState to ensure it's marked as in-progress
          // This ensures continueGameWithSavedState() can find the active run
          journeyProgressionState.setCurrentRunState(savedBoardNumber, savedScore);
          logger.info(`🗺️ Updated currentRunState: board ${savedBoardNumber}, score ${savedScore}, inProgress: true`);
          
          // 🔥 USER REQUEST: Check if saved state has tiles before skipping rebuildBoard
          // If no tiles (e.g., after board failure), we need to rebuild board with fresh tiles
          const hasTiles = gameState.tiles && Array.isArray(gameState.tiles) && gameState.tiles.length > 0;
          const hasGrid = gameState.grid && Array.isArray(gameState.grid) && gameState.grid.length > 0;
          const canLoadState = hasTiles || hasGrid;
          
          // Set flags to resume at correct board
          (window as any).__ccStartAtLevel = savedBoardNumber;
          // 🔥 USER REQUEST: Only skip rebuildBoard if we have tiles/grid to load
          // If __ccSkipRebuildBoard was already set by continueFromInterimBoard, respect it
          const skipRebuildWasSet = (window as any).__ccSkipRebuildBoard !== undefined;
          if (canLoadState && skipRebuildWasSet) {
            // Keep the flag set by continueFromInterimBoard
            logger.info(`🎮 Saved state has tiles/grid - will CONTINUE saved board ${savedBoardNumber}`);
          } else if (canLoadState && !skipRebuildWasSet) {
            // Set flag if we have tiles but it wasn't set yet
            (window as any).__ccSkipRebuildBoard = true;
            logger.info(`🎮 Saved state has tiles/grid - will CONTINUE saved board ${savedBoardNumber}`);
          } else {
            // No tiles/grid - clear flag to force rebuildBoard
            delete (window as any).__ccSkipRebuildBoard;
            logger.info(`🎮 Saved state has no tiles/grid - will CREATE FRESH board ${savedBoardNumber} with tile animations`);
          }
          // 🔥 USER REQUEST: Trigger HUD drop animation when resuming from Journey
          (window as any).__ccTriggerHudDrop = true;
          
          await bootGame();
          
          // 🔥 CRITICAL FIX: Keep canvas hidden until HUD is ready to drop
          // This prevents seeing old HUD residue before drop animation starts
          try {
            const gameState = (window as any).CC;
            if (gameState && gameState.app && gameState.app.canvas) {
              gameState.app.canvas.style.opacity = '0';
              gameState.app.canvas.style.transition = 'none';
              console.log('✅ Canvas hidden - will show when HUD drop starts');
            }
          } catch {}
          
          // 🔥 iPhone FIX: wait for canvas/app to paint before starting layout + animations
          // Without this, HUD drop/tile pop can happen before first visible frame.
          try {
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          } catch {}
          
          // 🔥 CRITICAL FIX: Load saved game state BEFORE layoutGame()
          // This ensures tiles are loaded before layout is calculated
          if (canLoadState && (window as any).__ccSkipRebuildBoard) {
            const loadGameState = (window as any).loadGameState;
            if (typeof loadGameState === 'function') {
              logger.info(`🎮 Loading saved game state for board ${savedBoardNumber}...`);
              const loaded = await loadGameState();
              if (!loaded) {
                logger.error('❌ Failed to load saved game state - will rebuild board');
                delete (window as any).__ccSkipRebuildBoard;
                // Force rebuildBoard by calling startLevel again or rebuildBoard directly
                const rebuildBoard = (window as any).rebuildBoard;
                if (typeof rebuildBoard === 'function') {
                  logger.info(`🎮 Calling rebuildBoard() for board ${savedBoardNumber}...`);
                  rebuildBoard();
                }
              } else {
                logger.info(`✅ Successfully loaded saved game state for board ${savedBoardNumber}`);
              }
            } else {
              logger.error('❌ loadGameState function not found');
              delete (window as any).__ccSkipRebuildBoard;
              const rebuildBoard = (window as any).rebuildBoard;
              if (typeof rebuildBoard === 'function') {
                logger.info(`🎮 Calling rebuildBoard() for board ${savedBoardNumber} (loadGameState not found)...`);
                rebuildBoard();
              }
            }
          } else if (!canLoadState) {
            // No tiles/grid - startLevel() should have already called rebuildBoard()
            logger.info(`🎮 No tiles/grid - rebuildBoard() should have been called by startLevel() for board ${savedBoardNumber}`);
          }
          
          await layoutGame();
          
          // If no tiles/grid, startLevel() will handle rebuildBoard() automatically
          // 🔥 CRITICAL: Don't delete __ccSkipRebuildBoard here - let startLevel() handle it
          
          delete (window as any).__ccStartAtLevel;
          // __ccSkipRebuildBoard will be deleted by startLevel() after it's used
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
            
            // 🔥 USER REQUEST: Check if saved state has tiles before skipping rebuildBoard
            const hasTiles = gameState.tiles && Array.isArray(gameState.tiles) && gameState.tiles.length > 0;
            const hasGrid = gameState.grid && Array.isArray(gameState.grid) && gameState.grid.length > 0;
            const canLoadState = hasTiles || hasGrid;
            
            // Set flags to resume at correct board
            (window as any).__ccStartAtLevel = savedBoardNumber;
            // 🔥 USER REQUEST: Only skip rebuildBoard if we have tiles/grid to load
            if (canLoadState) {
              (window as any).__ccSkipRebuildBoard = true;
              logger.info(`🎮 Saved state has tiles/grid - will CONTINUE saved board ${savedBoardNumber}`);
            } else {
              delete (window as any).__ccSkipRebuildBoard;
              logger.info(`🎮 Saved state has no tiles/grid - startLevel() will CREATE FRESH board ${savedBoardNumber} with tile animations`);
            }
            
            await bootGame();
            
            // 🔥 CRITICAL FIX: Load saved game state BEFORE layoutGame()
            // This ensures tiles are loaded before layout is calculated
            if (canLoadState && (window as any).__ccSkipRebuildBoard) {
              const loadGameState = (window as any).loadGameState;
              if (typeof loadGameState === 'function') {
                logger.info(`🎮 Loading saved game state for board ${savedBoardNumber}...`);
                const loaded = await loadGameState();
                if (!loaded) {
                  logger.error('❌ Failed to load saved game state - will rebuild board');
                  delete (window as any).__ccSkipRebuildBoard;
                  const rebuildBoard = (window as any).rebuildBoard;
                  if (typeof rebuildBoard === 'function') {
                    logger.info(`🎮 Calling rebuildBoard() for board ${savedBoardNumber}...`);
                    rebuildBoard();
                  }
                } else {
                  logger.info(`✅ Successfully loaded saved game state for board ${savedBoardNumber}`);
                }
              } else {
                logger.error('❌ loadGameState function not found');
                delete (window as any).__ccSkipRebuildBoard;
                const rebuildBoard = (window as any).rebuildBoard;
                if (typeof rebuildBoard === 'function') {
                  logger.info(`🎮 Calling rebuildBoard() for board ${savedBoardNumber} (loadGameState not found)...`);
                  rebuildBoard();
                }
              }
            } else if (!canLoadState) {
              // No tiles/grid - startLevel() should have already called rebuildBoard()
              logger.info(`🎮 No tiles/grid - rebuildBoard() should have been called by startLevel() for board ${savedBoardNumber}`);
            }
            
            await layoutGame();
            
            // If no tiles/grid, startLevel() will handle rebuildBoard() automatically
            // 🔥 CRITICAL: Don't delete __ccSkipRebuildBoard here - let startLevel() handle it
            
            delete (window as any).__ccStartAtLevel;
            // __ccSkipRebuildBoard will be deleted by startLevel() after it's used
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
// Simply reference the local startNewRun function to avoid code duplication
(window as any).startNewRun = startNewRun;

// 🔥 JOURNEY PROGRESSION: Export startNewRunFromJourney function (with board enter animation)
(window as any).startNewRunFromJourney = async (boardId: number) => {
  console.log(`🎮🎮🎮 startNewRunFromJourney CALLED with boardId: ${boardId}`);
  logger.info(`🎮 startNewRunFromJourney called for board ${boardId}`);
  
  // Import journey progression state
  const { journeyProgressionState } = await import('./modules/journey-progression-state.js');
  console.log(`✅ Journey progression state imported`);
  
  // Set lastOpenedBoardId and currentRunState
  journeyProgressionState.setLastOpenedBoardId(boardId);
  journeyProgressionState.setCurrentRunState(boardId, 0);
  console.log(`✅ Journey progression state set for board ${boardId}`);
  
  // Clear any saved game state (starting fresh)
  localStorage.removeItem('cc_saved_game');
  localStorage.removeItem('cc_board_completed');
  localStorage.removeItem('cubeCrash_gameState');
  console.log(`✅ Cleared saved game state`);
  
  // Hide homepage and show app (no slider exit animation - already done)
  uiManager.hideHomepage();
  uiManager.showApp();
  console.log(`✅ Homepage hidden, app shown`);
  
  try {
    // Set flag so boot() starts at the correct board
    (window as any).__ccStartAtLevel = boardId;
    // Set flag to trigger HUD drop animation (sweetPopIn will check this)
    (window as any).__ccTriggerHudDrop = true;
    console.log(`🎯 Setting __ccStartAtLevel to ${boardId} and __ccTriggerHudDrop for new run from Journey`);
    
    // Boot the game
    console.log(`🎮 About to call bootGame() for board ${boardId}...`);
    await bootGame();
    console.log(`✅ bootGame() completed`);
    
    console.log(`🎮 About to call layoutGame() for board ${boardId}...`);
    await layoutGame();
    console.log(`✅ layoutGame() completed`);
    
    // Clear flags after boot
    delete (window as any).__ccStartAtLevel;
    delete (window as any).__ccTriggerHudDrop;
    
    console.log(`✅✅✅ New run started successfully for board ${boardId} with enter animation`);
    logger.info(`✅ New run started for board ${boardId} with enter animation`);
  } catch (error) {
      console.error(`❌❌❌ Failed to start new run for board ${boardId}:`, error);
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
            
            // 🔥 CRITICAL FIX: Update currentRunState with saved game state
            // This ensures currentRunState.inProgress remains true and score is updated
            const { journeyProgressionState } = await import('./modules/journey-progression-state.js');
            const savedBoardNumber = Number.isFinite(gameState.boardNumber) 
              ? gameState.boardNumber 
              : (Number.isFinite(gameState.level) ? gameState.level : 1);
            const savedScore = Number.isFinite(gameState.score) ? gameState.score : 0;
            
            // 🔥 USER REQUEST: Preserve score in journey progression state when exiting
            // This allows score to persist even if cc_saved_game is cleared (e.g., after board failure)
            journeyProgressionState.setCurrentRunState(savedBoardNumber, savedScore);
            console.log(`🗺️ Updated currentRunState on exit: board ${savedBoardNumber}, score ${savedScore}, inProgress: true`);
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
      
      // 🔥 JOURNEY BOARDS: Update board-specific high score
      try {
        const boardNumber = STATE.boardNumber || STATE.level || 1;
        const { boardStatsService } = await import('./services/board-stats-service.js');
        const isNewHighScore = boardStatsService.updateBoardHighScore(boardNumber, currentScore);
        if (isNewHighScore) {
          console.log(`🏆 New high score for board ${boardNumber}: ${currentScore}`);
        }
      } catch (error) {
        console.warn('⚠️ Failed to update board high score:', error);
      }
    } catch (error) {
      console.warn('⚠️ Failed to save high score during exit:', error);
    }
    
    // 🔥 BUG FIX: Stop all magnet idle particles IMMEDIATELY before exit animations
    // This prevents particles from being visible during exit animation and journey screen enter
    try {
      const { STATE } = await import('./modules/app-state.js');
      const { stopMagnetIdleParticles } = await import('./modules/fx.js');
      if (STATE && STATE.tiles && STATE.tiles.length > 0 && typeof stopMagnetIdleParticles === 'function') {
        STATE.tiles.forEach((tile: any) => {
          try {
            if (tile && !tile.destroyed && tile.special === 'wild-magnet') {
              stopMagnetIdleParticles(tile);
            }
          } catch (err) {
            // Ignore errors for individual tiles
          }
        });
        console.log('✅ Exit: All magnet idle particles stopped before exit animation');
      }
    } catch (error) {
      console.warn('⚠️ Exit: Error stopping magnet idle particles:', error);
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
      // 1. If came from detail modal Play button → return to detail modal for that board
      // 2. If came from homepage Play button → return to homepage (slide 0)
      // 3. If came from Journey Continue button → return to Journey (slide 1)
      let targetSlide = 0; // Default to homepage
      let returnToDetailModal = false;
      let detailModalBoardId: number | null = null;
      
      try {
        // 🔥 USER REQUEST: Check if user came from detail modal FIRST
        const cameFromDetailModal = (window as any).__ccCameFromDetailModal === true;
        const detailModalBoardIdWindow = (window as any).__ccDetailModalBoardId;
        
        if (cameFromDetailModal && detailModalBoardIdWindow) {
          returnToDetailModal = true;
          detailModalBoardId = Number(detailModalBoardIdWindow);
          console.log(`🎯 User came from detail modal for board ${detailModalBoardId} - will return to detail modal`);
          
          // Clear flag
          delete (window as any).__ccCameFromDetailModal;
          delete (window as any).__ccDetailModalBoardId;
        } else {
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
        }
      } catch (error) {
        console.warn('⚠️ Failed to determine target slide:', error);
      }
    
    // 🔥 USER REQUEST: Show navigation and homepage ONLY if returning to homepage (slide 0)
    // If returning to Journey screen (slide 1), hide homepage and navigation IMMEDIATELY
    if (targetSlide === 0) {
      // Show navigation and homepage for homepage slider
      uiManager.showNavigation();
      uiManager.showHomepageQuietly();
      console.log('✅ Navigation and homepage shown - returning to homepage slider');
    } else {
      // 🔥 CRITICAL: Hide homepage and slider container IMMEDIATELY when returning to Journey screen
      // This prevents homepage slider (especially slide 2) from being visible in background
      // Do this BEFORE resetting slider position to avoid visual glitches
      
      // Hide homepage element completely
      const homeElement = document.getElementById('home');
      if (homeElement) {
        homeElement.style.display = 'none';
        homeElement.setAttribute('hidden', 'true');
        homeElement.style.visibility = 'hidden';
        homeElement.style.opacity = '0';
        homeElement.style.zIndex = '-1';
        console.log('✅ Homepage element completely hidden - Journey screen will be visible');
      }
      
      // 🔥 CRITICAL: Hide slider container to prevent slide 2 from showing in background
      const sliderContainer = document.getElementById('slider-container');
      if (sliderContainer) {
        sliderContainer.style.display = 'none';
        sliderContainer.style.visibility = 'hidden';
        sliderContainer.style.opacity = '0';
        sliderContainer.style.zIndex = '-1';
        console.log('✅ Slider container hidden - preventing homepage slides from showing');
      }
      
      // Hide homepage via uiManager
      uiManager.hideHomepage();
      
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
    
    // 🔥 USER REQUEST: Only reset slider if returning to homepage (slide 0)
    // Journey screen (slide 1) is NOT part of homepage slider, so don't reset slider
    // 🔥 CRITICAL: If __ccJourneyExitMode is 'toHome', collectibles-manager.ts will handle slide positioning
    // DO NOT reset slider here as it will interfere with collectibles-manager.ts positioning
    const journeyExitMode = (window as any).__ccJourneyExitMode;
    if (journeyExitMode === 'toHome') {
      console.log('🗺️ Journey exit mode is "toHome" - skipping slider reset (collectibles-manager.ts will handle)');
    } else if (targetSlide === 0 && sliderManager) {
      console.log(`🎯 Resetting slider to slide ${targetSlide} (homepage)...`);
      sliderManager.setCurrentSlide(targetSlide);
      console.log(`✅ Slider reset to slide ${targetSlide}`);
    } else if (targetSlide === 1) {
      // 🔥 CRITICAL: Don't reset slider when returning to Journey screen
      // Journey screen is separate from homepage slider, so slider should remain hidden
      console.log('✅ Skipping slider reset - Journey screen is not part of homepage slider');
    } else {
      console.warn('⚠️ SliderManager not found, trying gameState...');
      if (targetSlide === 0) {
        gameState.setState({ currentSlide: targetSlide });
      }
    }
    
    // 🔥 USER REQUEST: Only update slider slides if returning to homepage (slide 0)
    // If returning to Journey (slide 1), don't touch slider - Journey screen is shown directly
    // 🔥 CRITICAL: If __ccJourneyExitMode is 'toHome', collectibles-manager.ts will handle slide positioning
    // DO NOT update slides here as it will interfere with collectibles-manager.ts positioning
    // Note: journeyExitMode is already declared above, reuse it
    if (journeyExitMode === 'toHome') {
      console.log('🗺️ Journey exit mode is "toHome" - skipping slide update (collectibles-manager.ts will handle)');
    } else if (targetSlide === 0) {
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
          // 🔥 FIX: ALL slides must be visible for slider to work (slider uses translateX)
          // Only the active class determines which slide is shown
          (slide as HTMLElement).style.display = 'block';
          (slide as HTMLElement).style.visibility = 'visible';
          (slide as HTMLElement).style.opacity = '1';
        }
        
        // 🔥 USER REQUEST: Ensure ALL slide content elements are visible (images, text, CTAs)
        // This prevents content from being hidden when returning from Journey screen
        const slideContent = slide.querySelector('.slide-content');
        const heroImage = slide.querySelector('.hero-image');
        const slideText = slide.querySelector('.slide-text');
        const slideTagline = slide.querySelector('.slide-tagline');
        const slideButton = slide.querySelector('.slide-button');
        
        if (slideContent) {
          (slideContent as HTMLElement).style.display = 'flex';
          (slideContent as HTMLElement).style.visibility = 'visible';
          (slideContent as HTMLElement).style.opacity = '1';
        }
        if (heroImage) {
          (heroImage as HTMLElement).style.display = 'block';
          (heroImage as HTMLElement).style.visibility = 'visible';
          (heroImage as HTMLElement).style.opacity = '1';
        }
        if (slideText) {
          (slideText as HTMLElement).style.display = 'block';
          (slideText as HTMLElement).style.visibility = 'visible';
          (slideText as HTMLElement).style.opacity = '1';
          
          // 🔥 iPad FIX: Preserve transform position on iPad after navigation
          const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;
          const isActiveSlide = index === targetSlide;
          
          if (isIPad) {
            // Don't override transform - let CSS handle it
            const currentTransform = (slideText as HTMLElement).style.transform;
            if (!currentTransform || !currentTransform.includes('translateY(64px)')) {
              (slideText as HTMLElement).style.transform = 'translateY(64px)';
              (slideText as HTMLElement).style.webkitTransform = 'translateY(64px)';
            }
            
            // 🔥 FIX: Za neaktivne slide-ove na iPadu, ukloniti animate-enter-initial
            if (!isActiveSlide) {
              (slideText as HTMLElement).classList.remove('animate-enter-initial');
            }
          }
        }
        if (slideTagline) {
          (slideTagline as HTMLElement).style.display = 'block';
          (slideTagline as HTMLElement).style.visibility = 'visible';
          (slideTagline as HTMLElement).style.opacity = '1';
          
          // 🔥 iPad FIX: Preserve transform position on iPad after navigation
          const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;
          if (isIPad) {
            // Don't override transform - let CSS handle it
            const currentTransform = (slideTagline as HTMLElement).style.transform;
            if (!currentTransform || !currentTransform.includes('translateY(-12px)')) {
              (slideTagline as HTMLElement).style.transform = 'translateY(-12px)';
              (slideTagline as HTMLElement).style.webkitTransform = 'translateY(-12px)';
            }
          }
        }
        if (slideButton) {
          // 🔥 FIX: Za iPad, osigurati da je CTA button vidljiv na neaktivnim slide-ovima
          // Animacija će se pokrenuti samo za aktivni slide
          const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;
          const isActiveSlide = index === targetSlide;
          
          if (isIPad && !isActiveSlide) {
            // Za neaktivne slide-ove na iPadu, ukloniti animate-enter-initial i postaviti display
            (slideButton as HTMLElement).classList.remove('animate-enter-initial');
            (slideButton as HTMLElement).style.display = 'flex';
            (slideButton as HTMLElement).style.visibility = 'visible';
            (slideButton as HTMLElement).style.opacity = '1';
            // 🔥 CRITICAL: Postaviti transform: scale(1) jer animate-enter-initial postavlja scale(0)
            (slideButton as HTMLElement).style.transform = 'translateY(0px) scale(1)';
            (slideButton as HTMLElement).style.webkitTransform = 'translateY(0px) scale(1)';
          }
          // Za aktivni slide, animate-enter-initial će biti uklonjen u startEnterAnimationSequence
        }
      });
      navButtons.forEach((button, index) => {
        if (index === targetSlide) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
      console.log('✅ All slides and content elements made visible for homepage return');
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
    
    // 🔥 APP STORE FIX: Complete separation of Journey and Homepage pathways
    // Step 3: Show appropriate screen WITHOUT mixing pathways
    if (returnToDetailModal && detailModalBoardId !== null) {
      // 🔥 USER REQUEST: Return directly to detail modal (Journey screen hidden, no enter animation)
      console.log(`🎯 Detail modal pathway - opening detail modal directly for board ${detailModalBoardId}...`);
      
      // Prepare Journey screen in background (hidden, no animation)
      const collectiblesManager = (window as any).collectiblesManager;
      if (collectiblesManager) {
        // Prepare Journey screen but don't show it yet (no enter animation)
        const journeyScreen = document.getElementById('journey-screen');
        if (journeyScreen) {
          journeyScreen.removeAttribute('hidden');
          journeyScreen.style.display = 'flex';
          journeyScreen.style.opacity = '0';
          journeyScreen.style.visibility = 'hidden';
          console.log('✅ Journey screen prepared in background (hidden)');
        }
      }
      
      // Open detail modal directly with enter animation (no Journey screen exit - already hidden)
      import('./modules/journey-boards-manager.js').then(async ({ journeyBoardsManager }) => {
        // Small delay to ensure DOM is ready
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        if (typeof journeyBoardsManager.openBoardDetailsById === 'function') {
          // openBoardDetailsById will handle enter animation for detail modal
          // Skip Journey exit animation because Journey screen is already hidden
          await journeyBoardsManager.openBoardDetailsById(detailModalBoardId, true);
          console.log(`✅ Detail modal opened directly for board ${detailModalBoardId} with enter animation`);
        } else {
          console.warn('⚠️ openBoardDetailsById method not found');
        }
      }).catch((error) => {
        console.warn('⚠️ Failed to import journeyBoardsManager:', error);
      });
      
      // Ensure navigation stays hidden (Journey has its own back button)
      const navElement = document.getElementById('independent-nav');
      if (navElement) {
        navElement.style.display = 'none';
        navElement.style.visibility = 'hidden';
        navElement.style.opacity = '0';
        navElement.setAttribute('aria-hidden', 'true');
      }
      
      console.log('✅ Detail modal pathway complete - Journey screen hidden, detail modal shown');
    } else if (targetSlide === 1) {
      // 🔥 Journey pathway - NO homepage slider involvement
      console.log('🗺️ Journey pathway - showing Journey screen directly...');
      
      // Show Journey screen immediately (no delays, no RAF hacks)
      const collectiblesManager = (window as any).collectiblesManager;
      if (collectiblesManager && typeof collectiblesManager.showCollectibles === 'function') {
        // This will handle Journey screen enter animation internally
        collectiblesManager.showCollectibles();
        console.log('✅ Journey screen shown with enter animation');
      } else {
        console.warn('⚠️ CollectiblesManager not found');
      }
      
      // Ensure navigation stays hidden (Journey has its own back button)
      const navElement = document.getElementById('independent-nav');
      if (navElement) {
        navElement.style.display = 'none';
        navElement.style.visibility = 'hidden';
        navElement.style.opacity = '0';
        navElement.setAttribute('aria-hidden', 'true');
      }
      
      console.log('✅ Journey pathway complete - NO homepage slider or background gradient');
    } else {
      // 🔥 Homepage pathway - normal slider animation
      console.log('🏠 Homepage pathway - playing slider enter animation...');
      animateSliderEnter();
    }
    console.log('✅ Exit complete - pathways separated');
    
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
