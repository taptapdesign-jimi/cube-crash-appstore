// @ts-nocheck
// CUBE CRASH - MAIN ENTRY POINT
// Clean, modular architecture

import './utils/console-suppress.js';
import './utils/gsap-safe.js';

import { bootstrapReady } from './ui/bootstrap-ui.js';
import './ui/collectibles-bridge.js';
// boot and layout imported statically for instant access
import { boot as bootGame, layoutBoard as layoutGame, cleanupGame, animateBoardExit } from './modules/app-core.js';
import { gsap } from 'gsap';
import { assetPreloader } from './modules/asset-preloader.js';
import './ios-image-helper.js';
import { startPerfMonitorIfEnabled } from './utils/perf-monitor.js';

// Ensure gsap is available globally for any legacy modules
if (!(window as any).gsap) {
  (window as any).gsap = gsap;
}

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
import { getBoardSaveKey, migrateGlobalSaveToBoard } from './utils/board-save-utils.js';

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
import enhancedMemoryManager from './core/enhanced-memory-manager.js';
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
import { RUN_MODE_ARCADE_HOME, RUN_MODE_JOURNEY, setRunMode } from './modules/run-mode.js';

// Type definitions (ultra-permissive for quick TypeScript fix)
interface GameState {
  [key: string]: any; // Allow any property access
  homepageReady?: boolean;
  isGameActive?: boolean;
  isPaused?: boolean;
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
    logger.warn('⚠️ Failed to prime home CTA for enter animation:', String(error));
  }
}

// Initialize core systems
async function initializeApp(): Promise<void> {
  try {
    // Wait for bootstrap to complete (DOM elements must exist first)
    await bootstrapReady;
    
    // 🔥 USER REQUEST: Migrate old global 'cc_saved_game' to board-specific saves
    // This runs ONCE on app startup to convert existing saves to new format
    // Each board will have its own save: cc_saved_game_board_01, cc_saved_game_board_02, etc.
    try {
      const migrated = migrateGlobalSaveToBoard();
      if (migrated) {
        console.log('✅ Migrated old global save to board-specific save');
      }
    } catch (error) {
      console.warn('⚠️ Failed to migrate global save:', error);
    }
    
    // Initialize pending collectibles flip list
    if (!Array.isArray((window as any).__pendingCollectibleFlips)) {
      (window as any).__pendingCollectibleFlips = [];
    }
    
    // Initializing core systems
    
    // Initialize error handling
    errorHandler.handleError = errorHandler.handleError.bind(errorHandler);
    memoryManager.init();
    
    // 🚀 Initialize Enhanced Memory Manager (automatic leak detection & cleanup)
    // TEMPORARILY DISABLED FOR DEBUGGING DEVICE CRASH
    // enhancedMemoryManager.init();
    // logger.info('✅ Enhanced Memory Manager active - monitoring 920 potential leaks');
    logger.info('⚠️ Enhanced Memory Manager DISABLED for debugging');
    
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
    startPerfMonitorIfEnabled();
    
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
    
    // 🔥 CRITICAL: Launch screen is already initialized and STARTED in launch-screen-init.ts
    // Don't start it again here - just wait for it to complete
    const { launchScreen } = await import('./modules/launch-screen.ts');
    
    // Check if launch screen is already running (started in index.html inline script)
    const launchContainer = document.getElementById('launch-screen');
    if (!launchContainer) {
      // Fallback: initialize and start if not already done (shouldn't happen)
      launchScreen.init();
      logger.info('✅ Launch screen initialized (fallback - not initialized early)');
      
      // Start launch screen sequence immediately
      launchScreen.start(() => {
        logger.info('✅ Launch screen sequence completed');
      }).catch((error) => {
        logger.error('❌ Launch screen start error:', String(error));
      });
    } else {
      logger.info('✅ Launch screen container found - waiting for sequence to complete (started in index.html)');
      // Launch screen is already started in index.html - just wait for it to complete
    }
    
    // 🔥 CRITICAL: Hide native splash immediately
    try {
      const { hideNativeSplash } = await import('./utils/native-splash.js');
      await hideNativeSplash({ fadeOutDuration: 200 });
      logger.info('✅ Native splash hidden');
    } catch (error) {
      logger.warn('⚠️ Failed to hide native splash:', String(error));
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
    
    // 🔥 CRITICAL: Ensure homepage is HIDDEN while launch screen is active
    // Homepage is created in bootstrapUI() but should stay hidden until launch screen is gone
    const homeElementInitial = document.getElementById('home');
    if (homeElementInitial) {
      // Ensure homepage is completely hidden (bootstrapUI sets hidden: true, but double-check)
      homeElementInitial.setAttribute('hidden', 'true');
      homeElementInitial.style.display = 'none';
      homeElementInitial.style.opacity = '0';
      homeElementInitial.style.visibility = 'hidden';
      homeElementInitial.style.zIndex = '-1';
      logger.info('✅ Homepage hidden while launch screen is active');
    }
    
    // 🔥 PRODUCTION READY iOS APP STORE: Preloading is now handled INSIDE launch screen Phase 2
    // Launch screen Phase 2 (stack to six) preloads critical images BLOCKING during its 2.5 second display
    // This ensures homepage slider images are ALWAYS ready when homepage appears
    // No need to start preloading here - launch screen handles it
    logger.info('✅ Image preloading handled by launch screen Phase 2 (no separate preload needed)');
    
    // Also start PIXI.js asset preloading (for game assets, not images)
    assetPreloader.preloadAll().catch((error) => {
      logger.error('❌ Asset preloading failed:', String(error));
    });
    
    // 🔥 CRITICAL: Wait ONLY for launch screen to complete (don't wait for preloading)
    // Homepage appears IMMEDIATELY after launch screen finishes (after stack to six scale down)
    const launchPromise = new Promise<void>((resolve) => {
      // 🔥 CRITICAL: Always wait for launch screen to complete, even if it's not active yet
      // The launch screen is started in index.html, so we need to wait for it to finish
      logger.info('⏳ Waiting for launch screen to complete...');
      logger.debug('Waiting for launch screen to complete', 'main', {
        isActive: launchScreen.active,
        hasContainer: !!document.getElementById('launch-screen')
      });
      
      // Wait for it to complete - we'll check periodically
      let lastLogAt = 0;
      const checkInterval = setInterval(() => {
        const isActive = launchScreen.active;
        const hasContainer = !!document.getElementById('launch-screen');
        const now = Date.now();
        if (now - lastLogAt > 500) {
          logger.debug('Checking launch screen status', 'main', { isActive, hasContainer });
          lastLogAt = now;
        }
        
        // Launch screen is complete when:
        // 1. isActive is false (launch screen has finished)
        // 2. AND container is removed from DOM (launch screen has been cleaned up)
        if (!isActive && !hasContainer) {
          clearInterval(checkInterval);
          logger.info('Launch screen sequence completed (active: false, container removed)', 'main');
          resolve();
        }
      }, 50); // Check every 50ms for faster response
      
      // Safety timeout (fallback if launch screen never completes)
      setTimeout(() => {
        clearInterval(checkInterval);
        logger.debug('Launch screen timeout - forcing resolve', 'main');
        resolve();
      }, 15000);
    });
    
    // Wait ONLY for launch screen (not preloading)
    logger.info('⏳ Waiting for launch screen to complete...');
    await launchPromise;
    
    console.log('✅ Launch screen completed - showing homepage and starting enter animation');
    logger.info('✅ Launch screen completed - showing homepage and starting enter animation');
    console.log('🔍 Launch screen active status:', launchScreen.active);
    logger.info('🔍 Launch screen active status:', launchScreen.active);
    
    // 🔥 CRITICAL: Launch screen container should already be removed by launch-screen.ts
    // Just verify it's gone, and force remove if it's still there (safety check)
    const launchScreenElement = document.getElementById('launch-screen');
    if (launchScreenElement) {
      console.warn('⚠️ Launch screen still in DOM - forcing removal');
      logger.warn('⚠️ Launch screen still in DOM - forcing removal');
      launchScreenElement.remove();
    } else {
      console.log('✅ Launch screen container already removed from DOM');
      logger.info('✅ Launch screen container already removed from DOM');
    }
    
    // 🔥 CRITICAL: Launch screen already handled background transition
    // No need to set background here - launch-screen.ts already set gradient after Phase 2
    
    clearTimeout(forceHideTimeout);
    
    // 🔥 CRITICAL: Ensure homepage is HIDDEN until launch screen completely finishes
    // Homepage is created in bootstrapUI() but should stay hidden until launch screen is gone
    const homeElement = document.getElementById('home');
    if (homeElement) {
      logger.info('🔍 Homepage element found, ensuring it is hidden...');
      // Ensure homepage is completely hidden (bootstrapUI sets hidden: true, but double-check)
      homeElement.setAttribute('hidden', 'true');
      homeElement.style.display = 'none';
      homeElement.style.opacity = '0';
      homeElement.style.visibility = 'hidden';
      homeElement.style.zIndex = '-1';
      logger.info('✅ Homepage hidden - will be shown only after launch screen is completely gone');
    } else {
      logger.error('❌ Homepage element not found!');
    }
    
    // Set gradient background (already set by launch screen, but ensure it's there)
    const body = document.body;
    const html = document.documentElement;
    const hasGradient = body && html && (
      window.getComputedStyle(body).background.includes('gradient') || 
      window.getComputedStyle(html).background.includes('gradient')
    );
    
    if (!hasGradient) {
      // Gradient not set yet, set it now
      const targetGradient = 'linear-gradient(180deg, #f3eee8 0%, #fcecdf 60%, #fcecdf 100%)';
      if (body) body.style.background = targetGradient;
      if (html) html.style.background = targetGradient;
    }
    
    // Make sure the Play CTA is hidden and in its initial state before the enter animation starts
    primeHomeCtaForEnter();

    // 🔥 NOTE: Journey screen boards are already prepared in preloadAll() (blocking)
    // No need to prepare again here - boards are ready before homepage is shown
    
    // 🔥 CRITICAL: Show homepage and play enter animation ONLY AFTER launch screen completely finishes
    // This ensures homepage appears only after stack to six logo scale down is complete
    console.log('🎬 Launch screen completed - now showing homepage and starting enter animation');
    
    // 🔥 CRITICAL: Get homepage element and show it DIRECTLY without calling showScreen('home')
    // This prevents the "blink" effect where showScreen('home') briefly shows homepage before we hide it
    const homeElementAfter = document.getElementById('home');
    if (!homeElementAfter) {
      console.error('❌ Homepage element not found!');
      return;
    }
    
    // 🔥 CRITICAL: Ensure homepage is HIDDEN before showing it
    // This prevents any brief flash where homepage might be visible
    homeElementAfter.setAttribute('hidden', 'true');
    homeElementAfter.style.display = 'none';
    homeElementAfter.style.opacity = '0';
    homeElementAfter.style.visibility = 'hidden';
    homeElementAfter.style.zIndex = '-1';
    
    // 🔥 CRITICAL: Update appManager's currentScreen state without actually calling showScreen
    // This ensures appManager knows homepage is active, but we control visibility directly
    (appManager as any).currentScreen = 'home';
    (appManager as any).loadedScreens.add('home');
    
    // 🔥 CRITICAL: Launch screen container is already removed by launch-screen.ts
    // No need to wait - launch screen is completely gone, so show homepage immediately
    console.log('🎬 Launch screen completely removed - showing homepage and starting enter animation');
    
    // 🔥 CRITICAL: Set opacity to 0 FIRST to prevent any visual flash
    // This ensures homepage is invisible even if CSS rules try to show it
    homeElementAfter.style.opacity = '0';
    homeElementAfter.style.transition = 'none'; // No transition - enter animation will handle it
    
    // 🔥 CRITICAL: Set display and visibility BEFORE removing hidden attribute
    // This prevents CSS rule #home:not([hidden]) from causing a blink
    // CSS rule in index.html sets display: block !important when hidden is removed
    // So we set all styles first, then remove hidden in the same frame
    homeElementAfter.style.display = 'block';
    homeElementAfter.style.visibility = 'visible';
    homeElementAfter.style.zIndex = '1';
    
    // 🔥 CRITICAL: Use requestAnimationFrame to batch the hidden removal with style changes
    // This ensures browser applies all changes in the same frame, preventing blink
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // 🔥 CRITICAL: NOW remove hidden attribute - all styles are already set
    // CSS rule #home:not([hidden]) will match, but opacity is 0 so it won't be visible
    homeElementAfter.removeAttribute('hidden');
    
    // 🔥 CRITICAL: Hide ALL homepage elements BEFORE making homepage visible
    // This prevents blink effect where elements are visible before animation starts
    const homeLogo = document.querySelector('#home-logo');
    const independentNav = document.getElementById('independent-nav');
    const fixedShadowBottom = document.getElementById('home-fixed-shadow-bottom');
    const logoShardsLeft = document.getElementById('logo-shards-gore-ljevo');
    const logoShardsRight = document.getElementById('logo-shards-gore-desno');
    const allSlides = document.querySelectorAll('.slider-slide');
    
    // Hide all animated elements using animate-enter-initial class (scale 0)
    // This matches what reverseBounce expects and prevents flash
    const elementsToHide = [homeLogo, independentNav, fixedShadowBottom, logoShardsLeft, logoShardsRight];
    elementsToHide.forEach(el => {
      if (el) {
        (el as HTMLElement).classList.add('animate-enter-initial');
        (el as HTMLElement).style.display = 'block'; // Must be visible for animation
      }
    });
    
    // Hide only active slide elements (others will be visible but not animated)
    // Only hide elements from the active slide - other slides should remain visible
    let activeSlide = document.querySelector('.slider-slide.active') || document.querySelector('.slider-slide[data-slide="0"]');
    if (activeSlide) {
      const heroContainer = activeSlide.querySelector('.hero-container');
      const slideButton = activeSlide.querySelector('.slide-button');
      const slideText = activeSlide.querySelector('.slide-text');
      const slideTagline = activeSlide.querySelector('.slide-tagline');
      
      [heroContainer, slideButton, slideText, slideTagline].forEach(el => {
        if (el) {
          (el as HTMLElement).classList.add('animate-enter-initial');
          (el as HTMLElement).style.display = 'block'; // Must be visible for animation
        }
      });
    }
    
    // 🔥 CRITICAL: Ensure all slides are visible (slider uses translateX for positioning)
    allSlides.forEach(slide => {
      (slide as HTMLElement).style.removeProperty('display');
      (slide as HTMLElement).style.removeProperty('visibility');
      (slide as HTMLElement).style.removeProperty('opacity');
    });
    
    // Force reflow to apply hidden states
    void document.body.offsetHeight;
    
    // 🔥 CRITICAL: Use another requestAnimationFrame to set opacity to 1
    // This ensures opacity change happens in a separate frame after hidden is removed
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // 🔥 CRITICAL: NOW set opacity to 1 - homepage is ready to be visible
    // But all elements inside are hidden, so homepage will be invisible
    homeElementAfter.style.opacity = '1';
    console.log('✅ Homepage made visible directly - all elements hidden, ready for enter animation');

    // 🔥 CRITICAL: Re-initialize slider mechanics AFTER homepage is visible
    // Slider init earlier may have run while container was display:none (offsetWidth=0)
    try {
      if (sliderManager && typeof sliderManager.forceReady === 'function') {
        sliderManager.forceReady();
        console.log('✅ Slider forceReady() after splash - slider should be interactive');
      } else if (sliderManager && typeof sliderManager.ensureReady === 'function') {
        sliderManager.ensureReady();
        console.log('✅ Slider ensureReady() after splash - slider should be interactive');
      }
    } catch (error) {
      console.warn('⚠️ Failed to reinitialize slider after splash:', error);
    }
    
    // 🔥 CRITICAL: Verify slider elements exist before starting animation
    const sliderWrapper = document.getElementById('slider-wrapper');
    
    console.log('🔍 Checking slider elements:', {
      sliderWrapper: !!sliderWrapper,
      activeSlide: !!activeSlide,
      homeLogo: !!homeLogo,
      independentNav: !!independentNav
    });
    
    if (!sliderWrapper) {
      console.error('❌ Slider wrapper not found!');
      return;
    }
    
    // 🔥 CRITICAL: Ensure first slide is active if no active slide found
    if (!activeSlide) {
      console.warn('⚠️ No active slide found - activating first slide');
      const firstSlide = document.querySelector('.slider-slide[data-slide="0"]');
      if (firstSlide) {
        firstSlide.classList.add('active');
        activeSlide = firstSlide;
        console.log('✅ First slide activated');
      } else {
        console.error('❌ First slide not found!');
        return;
      }
    }
    
    // 🔥 CRITICAL: Start enter animation IMMEDIATELY in the same frame
    // No delay - animation will make elements visible
    console.log('🎬 Starting homepage enter animation...');
    try {
      animateSliderEnter();
      console.log('✅ Homepage enter animation started');
    } catch (error) {
      console.error('❌ Error starting homepage enter animation:', error);
      logger.error('❌ Error starting homepage enter animation:', String(error));
    }
    
    logger.info('✅ Assets preloaded successfully');
    
  } catch (error) {
    logger.error('❌ Asset preloading failed:', String(error));
    // Ensure loader doesn't block UI if preload fails
    try { 
      const { launchScreen } = await import('./modules/launch-screen.ts');
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
// 🍎 iOS CRITICAL FIX: Store reference for proper cleanup (prevents memory leak on iOS!)
const iosHardCloseHandler = async () => {
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
};

// 🍎 Store handler reference for cleanup in exitToMenu()
(window as any)._iosHardCloseHandler = iosHardCloseHandler;
document.addEventListener('visibilitychange', iosHardCloseHandler);

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
  setRunMode(RUN_MODE_JOURNEY);
  
  // 🔥 BUG FIX: Clear stale detail modal flags when starting new game
  // This prevents wrong board from opening when exiting
  delete (window as any).__ccCameFromDetailModal;
  delete (window as any).__ccDetailModalBoardId;
  delete (window as any).__ccDetailModalAlreadyOpened;
  logger.debug('Cleared stale detail modal flags before starting board', 'main', { boardId });
  
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
    // DO NOT play slider exit animation - just hide homepage
    logger.info('🗺️ Skipping slider exit animation - Journey screen exit already completed');
    // Hide homepage immediately (no animation)
    uiManager.hideHomepage();
  }
  
  // 🔥 APP STORE FIX: Event-driven approach for canvas visibility
  if (cameFromJourney) {
    try {
      // Set flags BEFORE booting game
      (window as any).__ccStartAtLevel = boardId;
      (window as any).__ccTriggerHudDrop = true;
      logger.info(`🎯 Starting board ${boardId} from Journey with HUD drop animation`);
      
      // 🔥 CRITICAL FIX: Boot game FIRST, then show app element (canvas must exist before showApp)
      // Boot game and wait for canvas to be created
      await bootGame();
      
      // 🔥 CRITICAL FIX: Show app element AFTER boot (so canvas exists)
      uiManager.showApp();
      logger.info('✅ App element shown after boot');
      
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
      logger.error(`❌ Failed to start new run for board ${boardId}:`, String(error));
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
        logger.error(`❌ Failed to start new run for board ${boardId}:`, String(error));
        delete (window as any).__ccStartAtLevel;
      }
    }, 770);
  }
}

// Continue game with saved state - NOW TIED TO JOURNEY PROGRESSION
(window as any).continueGameWithSavedState = async () => {
  memoryManager.start();
  logger.info('🔄 continueGameWithSavedState called - loading saved game');
  setRunMode(RUN_MODE_JOURNEY);
  
  // 🔥 Caller sets __ccFromInterimBoard / __ccIsInterimBoard (detail modal = false, interim flow = true).
  // Do NOT set __ccIsInterimBoard here — so clean board shows "Continue" only when opened via interim card.
  (window as any).__ccCameFromJourney = true;
  localStorage.setItem('__ccCameFromJourney', 'true');
  
  // Import journey progression state
  const { journeyProgressionState } = await import('./modules/journey-progression-state.js');
  
  try {
    // 🔥 JOURNEY PROGRESSION: Check if there's an active in-progress run
    const currentRunState = journeyProgressionState.getCurrentRunState();
    
    // 🔥 USER REQUEST: Determine which board to load (board-specific save)
    // Priority: __ccStartAtLevel > currentRunState.boardId > default to 1
    const boardToLoad = (window as any).__ccStartAtLevel || currentRunState?.boardId || 1;
    const saveKey = getBoardSaveKey(boardToLoad);
    let savedGame = localStorage.getItem(saveKey);
    // 🔥 FALLBACK: If board-specific key is empty (e.g. old code wrote only to global), try global key and migrate
    if (!savedGame && boardToLoad) {
      const globalFallback = localStorage.getItem('cc_saved_game');
      if (globalFallback) {
        try {
          const parsed = JSON.parse(globalFallback) as { boardNumber?: number; level?: number };
          const globalBoard = Number.isFinite(parsed.boardNumber) ? parsed.boardNumber : (Number.isFinite(parsed.level) ? parsed.level : 0);
          if (globalBoard === boardToLoad) {
            savedGame = globalFallback;
            localStorage.setItem(saveKey, globalFallback);
            logger.info(`🔄 Migrated board ${boardToLoad} save from cc_saved_game to ${saveKey}`);
          }
        } catch (_) { /* ignore */ }
      }
    }
    console.log(`🔄 Attempting to load board ${boardToLoad} from ${saveKey}`);
    logger.info(`🔄 Loading board ${boardToLoad} save state (${saveKey})`);
    
    // Case A: Resume when we have a save (with or without currentRunState, e.g. after hard exit)
    const canResumeFromSave = !!(savedGame && boardToLoad);
    const hasActiveRunState = !!(currentRunState && currentRunState.inProgress && savedGame);
    if (canResumeFromSave) {
        if (hasActiveRunState) {
          logger.info(`🎮 Case A: Resuming active run for board ${currentRunState!.boardId} from ${saveKey}`);
        } else {
          logger.info(`🎮 Case A': Resuming from save only (e.g. after hard exit) for board ${boardToLoad} from ${saveKey}`);
        }
        
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
          // DO NOT play slider exit animation - just hide homepage
          logger.info('🗺️ Skipping slider exit animation - Journey screen exit already completed');
          // Hide homepage immediately (no animation)
          uiManager.hideHomepage();
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
          
          // Show app element AFTER boot (so canvas exists)
          uiManager.showApp();
          console.log('✅ App element shown after game boot');
          
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
              const loaded = await loadGameState(savedBoardNumber);
              if (!loaded) {
                logger.warn('⚠️ Saved state not loaded for board ' + savedBoardNumber + ' - rebuilding board');
                delete (window as any).__ccSkipRebuildBoard;
                // 🔥 CRITICAL FIX: Call rebuildBoard directly - it's now exported to window
                const rebuildBoardFn = (window as any).rebuildBoard;
                if (typeof rebuildBoardFn === 'function') {
                  logger.info(`🎮 Calling rebuildBoard() for board ${savedBoardNumber}...`);
                  rebuildBoardFn();
                  // 🔥 CRITICAL: Wait a bit for rebuildBoard to complete before layoutGame
                  await new Promise(resolve => setTimeout(resolve, 100));
                } else {
                  logger.error('❌ rebuildBoard function not found on window - calling startLevel again without skip flag');
                  // Fallback: call startLevel again without skip flag to trigger rebuildBoard
                  const startLevelFn = (window as any).startLevel;
                  if (typeof startLevelFn === 'function') {
                    startLevelFn(savedBoardNumber);
                  }
                }
              } else {
                logger.info(`✅ Successfully loaded saved game state for board ${savedBoardNumber}`);
              }
            } else {
              logger.error('❌ loadGameState function not found');
              delete (window as any).__ccSkipRebuildBoard;
              const rebuildBoardFn = (window as any).rebuildBoard;
              if (typeof rebuildBoardFn === 'function') {
                logger.info(`🎮 Calling rebuildBoard() for board ${savedBoardNumber} (loadGameState not found)...`);
                rebuildBoardFn();
                // 🔥 CRITICAL: Wait a bit for rebuildBoard to complete before layoutGame
                await new Promise(resolve => setTimeout(resolve, 100));
              } else {
                logger.error('❌ rebuildBoard function not found on window - calling startLevel again without skip flag');
                // Fallback: call startLevel again without skip flag to trigger rebuildBoard
                const startLevelFn = (window as any).startLevel;
                if (typeof startLevelFn === 'function') {
                  startLevelFn(savedBoardNumber);
                }
              }
            }
          } else if (!canLoadState) {
            // No tiles/grid - startLevel() should have already called rebuildBoard()
            logger.info(`🎮 No tiles/grid - rebuildBoard() should have been called by startLevel() for board ${savedBoardNumber}`);
          }
          
          await layoutGame();
          
          // 🔥 CRITICAL FIX: Clear ALL flags after layout to prevent pollution for next board
          // This ensures fresh boards don't inherit flags from previous boards
          delete (window as any).__ccStartAtLevel;
          delete (window as any).__ccSkipRebuildBoard;
          delete (window as any).__ccTriggerHudDrop;
          delete (window as any).__ccPreserveScore;
          console.log(`✅ Cleared all flags after layout for board ${savedBoardNumber}`);
        } catch (error) {
          logger.error('❌ Failed to resume active run:', String(error));
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
                const loaded = await loadGameState(savedBoardNumber);
                if (!loaded) {
                  logger.warn('⚠️ Saved state not loaded for board ' + savedBoardNumber + ' - rebuilding board');
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
            } else if (canLoadState && !(window as any).__ccSkipRebuildBoard) {
              // 🔥 BUG FIX: If canLoadState is true but __ccSkipRebuildBoard is not set,
              // and loadGameState() was called but returned false, we need to rebuild
              const loadGameState = (window as any).loadGameState;
              if (typeof loadGameState === 'function') {
                logger.info(`🎮 Loading saved game state for board ${savedBoardNumber} (no skip flag)...`);
                const loaded = await loadGameState(savedBoardNumber);
                if (!loaded) {
                  logger.warn('⚠️ Saved state not loaded for board ' + savedBoardNumber + ' - rebuilding board');
                  const rebuildBoard = (window as any).rebuildBoard;
                  if (typeof rebuildBoard === 'function') {
                    logger.info(`🎮 Calling rebuildBoard() for board ${savedBoardNumber} (loadGameState returned false)...`);
                    rebuildBoard();
                  }
                }
              }
            }
            
            await layoutGame();
            
            // If no tiles/grid, startLevel() will handle rebuildBoard() automatically
            // 🔥 CRITICAL: Don't delete __ccSkipRebuildBoard here - let startLevel() handle it
            
            delete (window as any).__ccStartAtLevel;
            // __ccSkipRebuildBoard will be deleted by startLevel() after it's used
          } catch (error) {
            logger.error('❌ Failed to resume active run:', String(error));
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
    logger.error('❌ Failed to continue game:', String(error));
    console.warn('⚠️ Starting fresh game from Board 1');
    await startNewRun(1);
  }
};

// 🔥 JOURNEY PROGRESSION: Export startNewRun function globally (for Continue button)
// Simply reference the local startNewRun function to avoid code duplication
(window as any).startNewRun = startNewRun;

// 🔥 JOURNEY PROGRESSION: Export startNewRunFromJourney function (with board enter animation)
(window as any).startNewRunFromJourney = async (boardId: number) => {
  memoryManager.start();
  console.log(`🎮🎮🎮 startNewRunFromJourney CALLED with boardId: ${boardId}`);
  logger.info(`🎮 startNewRunFromJourney called for board ${boardId}`);
  setRunMode(RUN_MODE_JOURNEY);
  
  // 🔥 Keep __ccCameFromDetailModal so clean board can show Play Again + Exit (not Continue)
  delete (window as any).__ccDetailModalBoardId;
  delete (window as any).__ccDetailModalAlreadyOpened;
  
  // 🔥 Caller sets __ccFromInterimBoard / __ccIsInterimBoard (detail modal = false, interim = true).
  // Do NOT set __ccIsInterimBoard here — so clean board shows "Continue" only when opened via interim card.
  (window as any).__ccCameFromJourney = true;
  (window as any).__ccCameFromHomepage = false;
  localStorage.setItem('__ccCameFromJourney', 'true');
  localStorage.removeItem('__ccCameFromHomepage');
  
  // Import journey progression state
  const { journeyProgressionState } = await import('./modules/journey-progression-state.js');
  console.log(`✅ Journey progression state imported`);
  
  // Set lastOpenedBoardId and currentRunState
  journeyProgressionState.setLastOpenedBoardId(boardId);
  journeyProgressionState.setCurrentRunState(boardId, 0);
  console.log(`✅ Journey progression state set for board ${boardId}`);
  
  // 🔥 USER REQUEST: Clear saved game state for THIS specific board only (board-specific save)
  // Don't clear other boards' saves - each board has its own memory
  const saveKey = getBoardSaveKey(boardId);
  localStorage.removeItem(saveKey);
  localStorage.removeItem('cc_board_completed');
  localStorage.removeItem('cubeCrash_gameState');
  console.log(`✅ Cleared saved game state for board ${boardId} (${saveKey})`);
  
  // Hide homepage (no slider exit animation - already done)
  uiManager.hideHomepage();
  console.log(`✅ Homepage hidden`);
  
  try {
    // Ensure no stale locked-open timers from previous board survive into fresh run.
    try {
      const flow = await import('./modules/level-flow.js');
      flow.cleanupLevelFlowTimeouts?.();
    } catch (e) {
      console.warn('⚠️ Failed to cleanup level-flow timeouts before startNewRunFromJourney:', e);
    }

    // 🔥 CRITICAL FIX: Clear ALL flags before starting fresh board
    // This prevents leftover flags from previous boards (e.g., __ccSkipRebuildBoard)
    delete (window as any).__ccSkipRebuildBoard;
    delete (window as any).__ccPreserveScore;
    // 🔥 CRITICAL FIX: Clear skip board exit animation flag - new board should always animate exit
    delete (window as any).__skipBoardExitAnimation;
    console.log(`✅ Cleared leftover flags for fresh board ${boardId} (including __skipBoardExitAnimation)`);
    
    // Set flag so boot() starts at the correct board
    (window as any).__ccStartAtLevel = boardId;
    // Set flag to trigger HUD drop animation (sweetPopIn will check this)
    (window as any).__ccTriggerHudDrop = true;
    console.log(`🎯 Setting __ccStartAtLevel to ${boardId} and __ccTriggerHudDrop for new run from Journey`);
    
    // 🔥 CRITICAL FIX: Boot game FIRST, then show app element (canvas must exist before showApp)
    console.log(`🎮 About to call bootGame() for board ${boardId}...`);
    await bootGame();
    console.log(`✅ bootGame() completed`);
    
    // 🔥 CRITICAL FIX: Show app element AFTER boot (so canvas exists)
    uiManager.showApp();
    console.log(`✅ App element shown after boot`);
    
    console.log(`🎮 About to call layoutGame() for board ${boardId}...`);
    await layoutGame();
    console.log(`✅ layoutGame() completed`);
    
    // Clear flags after boot (incl. __ccBoardJustCompleted so HUD can reuse on next boards)
    delete (window as any).__ccStartAtLevel;
    delete (window as any).__ccTriggerHudDrop;
    delete (window as any).__ccBoardJustCompleted;
    
    console.log(`✅✅✅ New run started successfully for board ${boardId} with enter animation`);
    logger.info(`✅ New run started for board ${boardId} with enter animation`);
  } catch (error) {
      console.error(`❌❌❌ Failed to start new run for board ${boardId}:`, error);
      logger.error(`❌ Failed to start new run for board ${boardId}:`, String(error));
      delete (window as any).__ccStartAtLevel;
    }
};

// New sequence handler: bottom sheet close → exit anim → game start
(window as any).triggerGameStartSequence = async () => {
  logger.info('🎬 Starting game start sequence...');
  setRunMode(RUN_MODE_ARCADE_HOME);
  
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
  
  // 🔥 CRITICAL FIX: Reset gamePaused flag immediately
  // This ensures new game starts with clean state
  try {
    const { container } = await import('./core/dependency-injection.js');
    if (container && typeof container.set === 'function') {
      container.set('gamePaused', false);
    }
  } catch (e) {
    console.warn('⚠️ Failed to reset gamePaused via DI:', e);
  }
  (window as any)._gamePaused = false;
  console.log('🔓 exitToMenu: gamePaused flag reset');
  
  const killAllGsapTweensForExit = (label: string) => {
    console.log(`🧹 exitToMenu: Killing all GSAP tweens (${label})...`);
    try {
      // Kill UI element tweens
      gsap.killTweensOf('[data-wild-loader]');
      gsap.killTweensOf('.wild-loader');
      gsap.killTweensOf('p');
      gsap.killTweensOf('progress');
      gsap.killTweensOf('ratio');
      
      // Kill PIXI object tweens with null checks
      if (STATE && STATE.tiles && STATE.tiles.length > 0) {
        STATE.tiles.forEach(tile => {
          try {
            if (tile && !tile.destroyed) {
              if (tile.scale && !tile.scale.destroyed) {
                gsap.killTweensOf(tile.scale);
              }
              gsap.killTweensOf(tile);
              if (tile.hover && !tile.hover.destroyed) {
                gsap.killTweensOf(tile.hover);
              }
            }
          } catch {}
        });
      }
      if (STATE) {
        try {
          if (STATE.hud && !STATE.hud.destroyed) gsap.killTweensOf(STATE.hud);
          if (STATE.board && !STATE.board.destroyed) gsap.killTweensOf(STATE.board);
          if (STATE.stage && !STATE.stage.destroyed) gsap.killTweensOf(STATE.stage);
          if (STATE.backgroundLayer && !STATE.backgroundLayer.destroyed) gsap.killTweensOf(STATE.backgroundLayer);
        } catch {}
      }
      
      // Kill all timelines referencing destroyed targets
      try {
        const allTweens = gsap.globalTimeline.getChildren();
        allTweens.forEach((tween: any) => {
          try {
            const target = tween.targets?.[0];
            if (target && (target.destroyed || target === null || target === undefined)) {
              tween.kill();
            }
          } catch {}
        });
      } catch {}
      
      gsap.killTweensOf('*'); // Kill ALL tweens on all targets
      gsap.globalTimeline.clear(); // Clear the global timeline
      console.log(`✅ exitToMenu: GSAP tweens cleared (${label})`);
    } catch (gsapError) {
      console.warn('⚠️ exitToMenu: Error killing GSAP tweens:', gsapError);
    }
  };
  
  // 🔥 USER REQUEST: Play NO MOVES! exit animation first (must run BEFORE killing GSAP)
  try {
    const { hideEndgameHintWithAnimation } = await import('./modules/endgame-hint.js');
    await hideEndgameHintWithAnimation();
  } catch {}
  try {
    const { clearNoMovesText } = await import('./modules/splash-text-overlay.js');
    clearNoMovesText();
  } catch {}

  // Remove any idle-smoke frame immediately so it doesn't get "baked" during exit.
  try {
    const { TILE_IDLE_BOUNCE } = await import('./modules/tile-idle-bounce.js');
    TILE_IDLE_BOUNCE?.stop?.();
  } catch {}
  try {
    const { cleanupFxContainersByTag } = await import('./modules/fx.js');
    cleanupFxContainersByTag?.('tile-idle-smoke');
  } catch {}
  
  // 🔥🔥🔥 NUCLEAR CLEANUP: Kill ALL GSAP tweens to prevent _x null errors 🔥🔥🔥
  killAllGsapTweensForExit('pre-exit');
  
  // 🔥 NOTE: FX cleanup happens after exit animations (see Step 3 below)
  
  // Keep PIXI rendering alive until board exit animations finish.
  // The ticker is stopped again right before cleanupGame(), after the animation path.
  try {
    if (STATE && STATE.app && STATE.app.ticker) {
      STATE.app.ticker.start();
      console.log('✅ exitToMenu: PIXI ticker kept running for exit animation');
    }
  } catch (tickerError) {
    console.warn('⚠️ exitToMenu: Error ensuring ticker for exit animation:', tickerError);
  }
  
  // ⚡ SPEED OPTIMIZATION: Preload journey-boards-manager module IMMEDIATELY
  // This eliminates ~50-100ms dynamic import delay when showing detail modal
  const journeyManagerPromise = import('./modules/journey-boards-manager.js');
  console.log('⚡ Preloading journey-boards-manager module (parallel with board exit)...');
  
  // ⚡ SPEED OPTIMIZATION: Check if we should use fast path (Exit from End Run modal)
  const shouldUseFastPath = (window as any).__ccFastExitToDetailModal === true;
  
  // 🔥 CRITICAL: Declare variables BEFORE use in fast path
  let returnToDetailModal = false;
  let detailModalBoardId: number | null = null;
  
  try {
    console.log('🔥 Starting complete game cleanup...');
    
    // CRITICAL: Save game state BEFORE animations and cleanup
    // This ensures game state is saved even if cleanup fails
    // 🎯 CRITICAL FIX: Do NOT save if board was just completed (clean board)
    // Clean board already cleared save state - we don't want to re-save it!
    const skipSaveAfterCleanBoard = (window as any).__ccBoardJustCompleted === true;
    if (skipSaveAfterCleanBoard) {
      console.log('🎯 exitToMenu: Skipping saveGameState - board was just completed (clean board)');
      delete (window as any).__ccBoardJustCompleted; // Clear flag
    }
    
    try {
      if (typeof window.saveGameState === 'function' && !skipSaveAfterCleanBoard) {
        console.log('💾 Saving game state before exit...');
        window.saveGameState();
        console.log('✅ Game state saved before exit');
        
        // 🔥 USER BUG FIX: Double-check that state was saved correctly (board-specific)
        // Determine which board we're exiting from
        const exitingBoardNumber = (window as any).__ccStartAtLevel || (window as any).STATE?.boardNumber || 1;
        const saveKey = getBoardSaveKey(exitingBoardNumber);
        const savedGame = localStorage.getItem(saveKey);
        
        if (savedGame) {
          try {
            const gameState = JSON.parse(savedGame);
            console.log(`✅ Verified saved game state for board ${exitingBoardNumber} (${saveKey}):`, {
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
            // This allows score to persist even if board-specific save is cleared (e.g., after board failure)
            journeyProgressionState.setCurrentRunState(savedBoardNumber, savedScore);
            console.log(`🗺️ Updated currentRunState on exit: board ${savedBoardNumber}, score ${savedScore}, inProgress: true`);
          } catch (e) {
            console.warn(`⚠️ Failed to verify saved game state for board ${exitingBoardNumber}:`, e);
          }
        } else {
          const userMadeMove = (window as any)._userMadeMove === true;
          if (userMadeMove) {
            console.warn(`⚠️ WARNING: Game state was not saved for board ${exitingBoardNumber}!`);
          } else {
            console.log(`💾 No board save for board ${exitingBoardNumber}; user made no moves, so exit intentionally leaves no resume state.`);
          }
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
      
      // 🔥 JOURNEY BOARDS: Update board-specific stats (high score, longest combo, cubes cracked)
      try {
        const boardNumber = STATE.boardNumber || STATE.level || 1;
        const { boardStatsService } = await import('./services/board-stats-service.js');
        
        // 🔥 USER REQUEST: DO NOT update high score on exit!
        // High score is ONLY updated after successful clean board (in endgame-flow.ts)
        // Exit usred igre = ne updateamo high score
        console.log(`📊 Exit from board ${boardNumber} - high score NOT updated (only on clean board success)`);
        
        // 🔥 USER REQUEST: Longest combo is already tracked during gameplay in app-core.ts merge function
        // No need to update it here - it's already tracked in real-time during each merge
        // The boardStatsService.updateBoardLongestCombo() is called in merge function with actual combo value
        
        // 🔥 USER REQUEST: Cubes cracked is already tracked in real-time during gameplay
        // via trackCubesCracked() which calls addBoardCubesCracked() for each cube
        // No need to add it here - it's already accumulated per-board
        const boardStats = boardStatsService.getBoardStats(boardNumber);
        console.log(`📊 Board ${boardNumber} current stats:`, {
          highScore: boardStats.highScore,
          longestCombo: boardStats.longestCombo,
          cubesCracked: boardStats.cubesCracked
        });
      } catch (error) {
        console.warn('⚠️ Failed to read board stats:', error);
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
    // 🎯 NEW: Skip board exit animation if flag is set (clean board scenario - no tiles to animate)
    // 🔥 CRITICAL FIX: Double-check flag value and log it for debugging
    const shouldSkipBoardExit = (window as any).__skipBoardExitAnimation === true;
    const isFastArcadeCleanExit = (window as any).__ccFastArcadeCleanExit === true;
    console.log(`🔍 exitToMenu: shouldSkipBoardExit = ${shouldSkipBoardExit}, flag value = ${(window as any).__skipBoardExitAnimation}`);
    if (shouldSkipBoardExit) {
      console.log('⏭️ Skipping board exit animation (clean board - no tiles)');
      
      // 🔥 CRITICAL FIX: Still play HUD exit animation even when skipping board exit
      // This ensures HUD animates out properly before returning to Journey screen
      if (!isFastArcadeCleanExit) {
        try {
          const { STATE } = await import('./modules/app-state.js');
          if (STATE && STATE.hud && typeof STATE.hud.playHudRise === 'function') {
            console.log('🎯 Playing HUD exit animation (board exit skipped)');
            STATE.hud.playHudRise({});
            // Wait for HUD exit animation to complete (~300ms)
            await new Promise(resolve => setTimeout(resolve, 350));
            console.log('✅ HUD exit animation completed');
          }
        } catch (error) {
          console.warn('⚠️ Failed to play HUD exit animation:', error);
        }
      } else {
        console.log('⚡ Fast arcade clean exit: skipping duplicate HUD exit wait');
      }
      
      // Hide board and HUD immediately (no animation)
      try {
        const boardContainer = document.getElementById('board-container');
        if (boardContainer) {
          boardContainer.style.opacity = '0';
          boardContainer.style.visibility = 'hidden';
          console.log('✅ Board container hidden immediately');
        }
        
        // Hide board indicator immediately
        const { animateBoardIndicatorExit } = await import('./modules/hud-helpers.js');
        if (typeof animateBoardIndicatorExit === 'function') {
          animateBoardIndicatorExit(0); // Duration 0 = instant hide
          console.log('✅ Board indicator hidden immediately');
        }
      } catch (error) {
        console.warn('⚠️ Failed to hide board elements:', error);
      }
      
      // Clear flag after use
      delete (window as any).__skipBoardExitAnimation;
      delete (window as any).__ccFastArcadeCleanExit;
    } else {
      console.log('🎬 Playing board exit animations...');
      // 🔥 CRITICAL FIX: Double-check that flag is NOT set (defensive check)
      if ((window as any).__skipBoardExitAnimation === true) {
        console.warn('⚠️ WARNING: __skipBoardExitAnimation flag is still set! Clearing it and playing exit animation anyway.');
        delete (window as any).__skipBoardExitAnimation;
      }
      
      try {
        // Hide board indicator (board tag) before board exit animation
        const { animateBoardIndicatorExit } = await import('./modules/hud-helpers.js');
        if (typeof animateBoardIndicatorExit === 'function') {
          animateBoardIndicatorExit(0.3);
          console.log('✅ Board indicator exit animation started');
        }
        
        // ⚡ SEAMLESS TRANSITION: If fast path, start detail modal DURING board exit (overlapping animations)
        if (shouldUseFastPath && returnToDetailModal && detailModalBoardId !== null) {
          console.log('⚡ SEAMLESS MODE: Detail modal ALREADY STARTED from exit button, just cleaning up board...');
          
          // Minimal cleanup
          try {
            if (STATE && STATE.tiles && STATE.tiles.length > 0) {
              STATE.tiles.forEach(tile => {
                try {
                  if (tile && !tile.destroyed) {
                    gsap.killTweensOf(tile);
                    if (tile.scale) gsap.killTweensOf(tile.scale);
                  }
                } catch (e) { /* ignore */ }
              });
            }
          } catch (e) { /* ignore */ }
          
          // Start board exit (await to ensure cleanup happens after animation)
          console.log('🎬 Calling animateBoardExit() (fast path)...');
          await animateBoardExit();
          console.log('✅ Board exit animations completed (detail modal already opened from exit button)');
          
          // Clear fast path flag
          delete (window as any).__ccFastExitToDetailModal;
        } else {
          // Normal path: wait for board exit to complete
          console.log('🎬 Starting board exit animation (HUD + tiles)...');
          console.log('🎬 Calling animateBoardExit() (normal path)...');
          await animateBoardExit();
          console.log('✅ Board exit animations completed');
          
          // 🔥 CRITICAL FIX: Wait for animations to fully render before cleanup
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          console.log('✅ Exit animations fully rendered - ready for cleanup');
        }
      } catch (error) {
        console.error('❌ Board exit animation failed:', error);
        console.error('❌ Error stack:', (error as Error).stack);
        // 🔥 CRITICAL FIX: Even if animation fails, wait a bit before cleanup to prevent blank screen
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // 🔥 CRITICAL FIX: Wait for exit animation to fully complete before cleanup
    // Add small delay to ensure animations are fully rendered
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('✅ Exit animation fully completed - starting cleanup');
    
    // Step 2: Kill ALL GSAP tweens immediately after animations complete
    killAllGsapTweensForExit('post-exit');
    
    // Step 3: Clean up all effects (bubbles, explosions, particles, confetti) FIRST
    try {
      const { cleanupAllEffects } = await import('./modules/fx.js');
      if (typeof cleanupAllEffects === 'function') {
        console.log('🧹 Calling cleanupAllEffects() to clean up particles, bubbles, explosions...');
        cleanupAllEffects();
        console.log('✅ cleanupAllEffects() completed - all particles and effects cleared');
      }
    } catch (error) {
      console.warn('⚠️ Failed to run cleanupAllEffects:', error);
    }
    
    // Step 3b: Clean up confetti system (DOM elements, intervals, timeouts)
    try {
      const { cleanupConfetti } = await import('./modules/confetti-system.js');
      if (typeof cleanupConfetti === 'function') {
        console.log('🧹 Calling cleanupConfetti() to clean up confetti DOM elements and intervals...');
        cleanupConfetti();
        console.log('✅ cleanupConfetti() completed - all confetti cleaned up');
      }
    } catch (error) {
      console.warn('⚠️ Failed to run cleanupConfetti:', error);
    }
    
    // Step 3c: Stop PIXI ticker BEFORE cleanupGame to prevent _x null errors
    // 🔥 CRITICAL FIX: Ticker must be stopped BEFORE objects are destroyed to prevent render errors
    try {
      if (STATE && STATE.app && STATE.app.ticker) {
        STATE.app.ticker.stop();
        console.log('✅ PIXI ticker stopped before cleanupGame');
      }
    } catch (tickerError) {
      console.warn('⚠️ Failed to stop PIXI ticker before cleanup:', tickerError);
    }
    
    // Step 4: Clean up game state AFTER killing all tweens AND exit animation completes
    // 🔥 CRITICAL FIX: cleanupGame() destroys PIXI app - must be called AFTER exit animation completes
    try {
      if (typeof cleanupGame === 'function') {
        console.log('🧹 Calling cleanupGame() to clean up all game resources...');
        cleanupGame();
        console.log('✅ cleanupGame() completed - PIXI app destroyed and nullified');
      }
    } catch (error) {
      console.warn('⚠️ Failed to run cleanupGame:', error);
    }
    
    // Step 4b: Clean up navigation control (MutationObserver)
    try {
      const { cleanupNavigationControl } = await import('./modules/navigation-control.js');
      if (typeof cleanupNavigationControl === 'function') {
        cleanupNavigationControl();
        console.log('✅ Navigation control cleaned up');
      }
    } catch (navError) {
      console.warn('⚠️ Failed to cleanup navigation control:', navError);
    }
    
    // Step 5: Clean up Journey Boards Manager (event listeners, animations)
    try {
      const collectiblesManager = (window as any).collectiblesManager;
      if (collectiblesManager && typeof collectiblesManager.cleanup === 'function') {
        console.log('🧹 Calling collectiblesManager.cleanup() to clean up Journey screen...');
        await collectiblesManager.cleanup();
        console.log('✅ collectiblesManager.cleanup() completed - Journey screen cleaned up');
      }
    } catch (error) {
      console.warn('⚠️ Failed to run collectiblesManager.cleanup:', error);
    }
    
    // Step 6: Clean up Homepage/Slider event listeners and animations (CRITICAL!)
    // This is the MAIN MEMORY LEAK - slider/homepage event listeners are never removed when returning from game!
    try {
      console.log('🧹 Cleaning up homepage/slider event listeners and animations...');
      
      // 6a. Destroy slider manager (removes touch/mouse event listeners)
      // 🔥 CRITICAL FIX: We'll reinitialize it later when returning to homepage
      const { default: sliderManager } = await import('./modules/slider-manager.js');
      if (sliderManager && typeof sliderManager.destroy === 'function') {
        sliderManager.destroy();
        console.log('✅ Slider manager destroyed - event listeners removed (will reinit when returning to homepage)');
      }
      
      // 6b. Kill all GSAP animations on homepage elements
      const homeElement = document.getElementById('home');
      if (homeElement && gsap) {
        const homepageElements = homeElement.querySelectorAll('*');
        homepageElements.forEach((el: Element) => {
          try { gsap.killTweensOf(el); } catch {}
        });
        
        const sliderWrapper = document.getElementById('slider-wrapper');
        const sliderContainer = document.getElementById('slider-container');
        if (sliderWrapper) gsap.killTweensOf(sliderWrapper);
        if (sliderContainer) gsap.killTweensOf(sliderContainer);
        console.log('✅ Homepage GSAP animations killed');
      }
      
      // 6c. Remove UI Manager event listeners (buttons, etc.)
      if (uiManager && (uiManager as any).boundEventHandlers) {
        const boundHandlers = (uiManager as any).boundEventHandlers;
        if (boundHandlers && boundHandlers.forEach) {
          boundHandlers.forEach((handlers: any[], element: HTMLElement) => {
            handlers.forEach(({ event, handler }: { event: string, handler: EventListener }) => {
              try {
                element.removeEventListener(event, handler);
              } catch (e) {}
            });
          });
          boundHandlers.clear();
          console.log('✅ UI Manager event listeners removed');
        }
      }
      
      console.log('✅ Homepage/slider cleanup completed');
    } catch (error) {
      console.warn('⚠️ Failed to cleanup homepage/slider:', error);
    }
    
    // Step 7: Remove iOS hard close lifecycle listener (main.ts)
    // 🍎 iOS CRITICAL: This listener accumulates on EVERY page load and causes memory leaks!
    try {
      const iosHardCloseHandler = (window as any)._iosHardCloseHandler;
      if (iosHardCloseHandler) {
        document.removeEventListener('visibilitychange', iosHardCloseHandler);
        (window as any)._iosHardCloseHandler = null;
        console.log('✅ iOS hard close listener removed (main.ts)');
      }
    } catch (error) {
      console.warn('⚠️ Failed to remove iOS hard close listener:', error);
    }
    
    // Stop time tracking
    if (typeof (window as any).stopTimeTracking === 'function') {
      (window as any).stopTimeTracking();
      console.log('⏱️ Time tracking stopped');
    }
    
    // NOTE: Saved game state is now handled in end-run-modal.ts
    // Only clear if user made no moves; otherwise keep state for resume
    
    // 🔥 CRITICAL FIX: DO NOT hide app element here - it will be hidden AFTER Journey screen is shown
    // This ensures exit animation is fully visible before hiding app
    // hideApp() will be called after Journey screen enter animation completes
    
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
      const boardIndicator =
        document.getElementById('hud-board-indicator') ||
        document.getElementById('hud-board');
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
      // returnToDetailModal and detailModalBoardId already declared at top of function
      const isArcadeHomeRun = (window as any).__ccRunMode === RUN_MODE_ARCADE_HOME;
      
      try {
        // HARD OVERRIDE: Homepage arcade run must ALWAYS exit to homepage slide 0.
        // Ignore stale Journey/detail-modal flags from previous sessions.
        if (isArcadeHomeRun) {
          targetSlide = 0;
          returnToDetailModal = false;
          detailModalBoardId = null;
          (window as any).__ccCameFromHomepage = true;
          (window as any).__ccCameFromJourney = false;
          delete (window as any).__ccCameFromDetailModal;
          delete (window as any).__ccDetailModalBoardId;
          localStorage.setItem('__ccCameFromHomepage', 'true');
          localStorage.removeItem('__ccCameFromJourney');
          console.log('🎮 Arcade exit override: forcing homepage slide 0 and clearing detail/journey flags');
        } else {
        // 🔥 USER REQUEST: Check if user came from detail modal FIRST
        const cameFromDetailModal = (window as any).__ccCameFromDetailModal === true;
        const detailModalBoardIdWindow = (window as any).__ccDetailModalBoardId;
        
        // 🔥 BUG FIX: Validate board ID before using (must be 1-16)
        const validBoardId = Number.isFinite(detailModalBoardIdWindow) && 
                             detailModalBoardIdWindow >= 1 && 
                             detailModalBoardIdWindow <= 16
          ? Number(detailModalBoardIdWindow)
          : null;
        
        const resolveExitContext = async () => {
          // 🔥 CRITICAL: Check localStorage FIRST (before clearing) - most reliable for persistence
          const cameFromJourneyStorage = localStorage.getItem('__ccCameFromJourney') === 'true';
          const cameFromHomepageStorage = localStorage.getItem('__ccCameFromHomepage') === 'true';
          const fromInterimBoardStorage = localStorage.getItem('__ccFromInterimBoard') === 'true';
          
          // Also check window flags (for current session)
          const cameFromJourneyWindow = (window as any).__ccCameFromJourney === true;
          const cameFromHomepageWindow = (window as any).__ccCameFromHomepage === true;
          const fromInterimBoardWindow = (window as any).__ccFromInterimBoard === true;
          
          // 🔥 CRITICAL FIX: Check interim board flag - if set, user definitely came from Journey
          const fromInterimBoard = fromInterimBoardWindow || fromInterimBoardStorage;
          
          // Combine both sources
          let cameFromJourney = cameFromJourneyWindow || cameFromJourneyStorage || fromInterimBoard;
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
            fromInterimBoardWindow,
            fromInterimBoardStorage,
            fromInterimBoard,
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
        };

        if (cameFromDetailModal && validBoardId) {
          // 🔥 CRITICAL FIX: Check if board has detail modal (is unlocked)
          // If board is still interim (not unlocked), return to Journey screen instead
          try {
            const { journeyBoardsManager } = await import('./modules/journey-boards-manager.js');
            const board = journeyBoardsManager.getBoardById(validBoardId);
            
            if (board && board.unlocked) {
              // Board has detail modal - return to detail modal
              returnToDetailModal = true;
              detailModalBoardId = validBoardId;
              console.log(`🎯 User came from detail modal for board ${detailModalBoardId} - will return to detail modal (unlocked, has detail modal)`);
              logger.info(`🎯 User came from detail modal for board ${detailModalBoardId} - will return to detail modal (unlocked, has detail modal)`);
            } else {
              // Board is still interim (not unlocked) - return to Journey screen instead
              console.log(`⚠️ Board ${validBoardId} is not unlocked (interim) - cannot return to detail modal, will return to Journey screen`);
              logger.info(`⚠️ Board ${validBoardId} is not unlocked (interim) - cannot return to detail modal, will return to Journey screen`);
              // Clear flags and fall through to Journey screen logic
              delete (window as any).__ccCameFromDetailModal;
              delete (window as any).__ccDetailModalBoardId;
              await resolveExitContext();
            }
          } catch (error) {
            // If check fails, assume board has detail modal (fallback to original behavior)
            console.warn(`⚠️ Failed to check board unlock status for ${validBoardId}, assuming unlocked:`, error);
            returnToDetailModal = true;
            detailModalBoardId = validBoardId;
            console.log(`🎯 User came from detail modal for board ${detailModalBoardId} - will return to detail modal (fallback)`);
            logger.info(`🎯 User came from detail modal for board ${detailModalBoardId} - will return to detail modal (fallback)`);
          }
          
          // Clear flags only if we're returning to detail modal
          if (returnToDetailModal) {
            delete (window as any).__ccCameFromDetailModal;
            delete (window as any).__ccDetailModalBoardId;
          }
        } else if (cameFromDetailModal && !validBoardId) {
          console.error(`❌ CRITICAL: Invalid detailModalBoardId ${detailModalBoardIdWindow} - clearing flags and skipping detail modal!`);
          logger.error(`❌ CRITICAL: Invalid detailModalBoardId ${detailModalBoardIdWindow} - clearing flags and skipping detail modal!`);
          // Clear invalid flags
          delete (window as any).__ccCameFromDetailModal;
          delete (window as any).__ccDetailModalBoardId;
          await resolveExitContext();
        } else {
          await resolveExitContext();
        }
        }
      } catch (error) {
        console.warn('⚠️ Failed to determine target slide:', error);
      }
    
    // 🔥 USER REQUEST: Show navigation and homepage ONLY if returning to homepage (slide 0)
    // If returning to Journey screen (slide 1), hide homepage and navigation IMMEDIATELY
    console.log(`🎯🎯🎯 TARGET SLIDE = ${targetSlide} 🎯🎯🎯`);
    if (targetSlide === 0) {
      console.log('🏠 HOMEPAGE PATH: targetSlide === 0, will call forceReady()');
      
      // 🔥 BUG FIX: Ensure slider is unlocked (critical for swipe drag to work)
      if (gameState && gameState.set) {
        gameState.set('sliderLocked', false);
        console.log('✅ sliderLocked set to false');
      }
      
      // 🔥 NUCLEAR RESET: Use forceReady() to guarantee slider is interactive
      // This resets ALL animation flags, unlocks slider, and reinitializes if needed
      try {
        console.log('🔧 About to call sliderManager.forceReady()...');
        console.log('🔧 sliderManager exists:', !!sliderManager);
        console.log('🔧 forceReady is function:', typeof sliderManager?.forceReady === 'function');
        
        if (sliderManager && typeof sliderManager.forceReady === 'function') {
          console.log('🔧 Force resetting slider for homepage return...');
          sliderManager.forceReady();
          console.log('✅ Slider forceReady() called - navigation should work');
        } else if (sliderManager && typeof sliderManager.init === 'function') {
          // Fallback
          sliderManager.init();
          console.log('✅ Slider init() called (fallback)');
        } else {
          console.error('❌ sliderManager.forceReady NOT AVAILABLE!');
        }
      } catch (sliderError) {
        console.error('❌ Failed to reset slider manager:', sliderError);
      }
      
      // Show navigation and homepage for homepage slider
      console.log('🔧 About to call uiManager.showNavigation() and showHomepageQuietly()...');
      uiManager.showNavigation();
      uiManager.showHomepageQuietly();
      console.log('✅ Navigation and homepage shown - returning to homepage slider');
    } else {
      console.log(`🗺️ JOURNEY PATH: targetSlide = ${targetSlide}, NOT calling forceReady()`);
    
      // 🔥 CRITICAL: Hide homepage and slider container when returning to Journey screen
      const homeElement = document.getElementById('home');
      if (homeElement) {
        homeElement.style.display = 'none';
        homeElement.setAttribute('hidden', 'true');
        homeElement.style.visibility = 'hidden';
        homeElement.style.opacity = '0';
        homeElement.style.zIndex = '-1';
        console.log('✅ Homepage hidden - returning to Journey screen');
      }
      
      const sliderContainer = document.getElementById('slider-container');
      if (sliderContainer) {
        sliderContainer.style.display = 'none';
        sliderContainer.style.visibility = 'hidden';
        sliderContainer.style.opacity = '0';
        sliderContainer.style.zIndex = '-1';
        console.log('✅ Slider container hidden');
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
      
      // 🔥 CRITICAL FIX: Ensure slider is fully ready before using it
      // ensureReady() will reinitialize if needed and ensure all elements are interactive
      if (sliderManager && typeof sliderManager.ensureReady === 'function') {
        try {
          console.log('🔧 Calling sliderManager.ensureReady() for homepage return...');
          sliderManager.ensureReady();
          console.log('✅ SliderManager.ensureReady() completed');
        } catch (error) {
          console.warn('⚠️ Error calling ensureReady:', error);
        }
      }
      
      // 🔥 NEW API: Use setSlideInstant() to atomically update ALL states
      // This replaces manual GSAP positioning + class manipulation
      if (sliderManager && typeof sliderManager.setSlideInstant === 'function') {
        try {
          sliderManager.setSlideInstant(targetSlide);
          console.log(`✅ Slider positioned at slide ${targetSlide} using setSlideInstant (atomic)`);
        } catch (error) {
          console.warn('⚠️ Error calling setSlideInstant, using fallback:', error);
          // Fall through to fallback
        }
      } else {
        // Fallback: Manual positioning (if setSlideInstant not available)
        console.warn('⚠️ SliderManager.setSlideInstant not available, using fallback');
        const sliderWrapper = document.getElementById('slider-wrapper');
        const sliderContainer = document.getElementById('slider-container');
        if (sliderWrapper && sliderContainer && typeof gsap !== 'undefined') {
          const slideWidth = sliderContainer.offsetWidth;
          const targetOffset = -targetSlide * slideWidth;
          gsap.set(sliderWrapper, { x: targetOffset });
        }
        
        slides.forEach((slide, index) => {
          if (index === targetSlide) {
            slide.classList.add('active');
          } else {
            slide.classList.remove('active');
          }
        });
      }
      
      // 🔥 CRITICAL: Ensure ALL slides are visible for slider to work (slider uses translateX)
      slides.forEach((slide, index) => {
        // ALL slides must be visible for slider positioning to work
        (slide as HTMLElement).style.display = 'block';
        (slide as HTMLElement).style.visibility = 'visible';
        (slide as HTMLElement).style.opacity = '1';
        
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
      navButtons.forEach((button) => {
        const slideIndex = parseInt(button.getAttribute('data-slide') || '0', 10);
        if (slideIndex === targetSlide) {
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
      
      // 🔥 NEW API: Use setSlideInstant() to atomically update ALL states
      // This replaces manual GSAP positioning + class manipulation
      // 🔥 CRITICAL FIX: Wrap in try-catch to prevent forEach error
      if (sliderManager && typeof sliderManager.setSlideInstant === 'function') {
        try {
          sliderManager.setSlideInstant(1); // Journey slide is index 1
          console.log(`✅ Slider positioned at Journey slide (1) using setSlideInstant (atomic)`);
        } catch (error) {
          console.warn('⚠️ Error calling setSlideInstant for Journey slide, using fallback:', error);
          // Fall through to fallback
        }
      } else {
        // Fallback: Manual positioning (if setSlideInstant not available)
        console.warn('⚠️ SliderManager.setSlideInstant not available, using fallback');
        const sliderWrapper = document.getElementById('slider-wrapper');
        const sliderContainer = document.getElementById('slider-container');
        if (sliderWrapper && sliderContainer && typeof gsap !== 'undefined') {
          const slideWidth = sliderContainer.offsetWidth;
          const targetOffset = -1 * slideWidth; // Journey slide is index 1
          gsap.set(sliderWrapper, { x: targetOffset });
        }
        
        slides.forEach((slide, index) => {
          if (index === 1) {
            slide.classList.add('active');
          } else {
            slide.classList.remove('active');
          }
        });
      }
      
      // 🔥 CRITICAL: Ensure ALL slides are visible for slider to work (slider uses translateX)
      slides.forEach((slide, index) => {
        // ALL slides must be visible for slider positioning to work
        (slide as HTMLElement).style.display = 'block';
        (slide as HTMLElement).style.visibility = 'visible';
        (slide as HTMLElement).style.opacity = '1';
      });
      console.log('✅ All slides made visible for Journey screen return');
    }
    
    console.log('✅ Game state reset - homepage should be visible now');
    
    // 🔥 APP STORE FIX: Complete separation of Journey and Homepage pathways
    // Step 3: Show appropriate screen WITHOUT mixing pathways
    if (returnToDetailModal && detailModalBoardId !== null) {
      (window as any).__ccSuppressJourneyShowForDirectDetailReturn = true;
      (window as any).__ccDirectDetailModalReturnActive = true;

      // ⚡ SKIP if detail modal already opened from exit button (fast path)
      const modalAlreadyOpened = (window as any).__ccDetailModalAlreadyOpened === true;
      if (modalAlreadyOpened) {
        console.log('⚡ SKIP: Detail modal already opened from exit button, skipping duplicate open');
        delete (window as any).__ccDetailModalAlreadyOpened; // Clear flag
      } else {
        // 🔥 USER REQUEST: Return directly to detail modal (Journey screen hidden, no enter animation)
        console.log(`🎯 Detail modal pathway - opening detail modal INSTANTLY for board ${detailModalBoardId}...`);
        
        // 🔥 USER REQUEST: Prepare Journey screen in background INSTANTLY (no delay)
        // This must be IMMEDIATE to prevent blank screen
        const journeyScreen = document.getElementById('journey-screen');
        if (journeyScreen) {
          journeyScreen.removeAttribute('hidden');
          journeyScreen.style.display = 'flex';
          journeyScreen.style.opacity = '0';
          journeyScreen.style.visibility = 'hidden';
          console.log('✅ Journey screen prepared INSTANTLY in background (hidden)');
        }
        
        // 🔥 USER REQUEST: Open detail modal IMMEDIATELY (no delay)
        // Enter animation should start instantly after board exit
        import('./modules/journey-boards-manager.js').then(async ({ journeyBoardsManager }) => {
          // 🔥 REMOVED: requestAnimationFrame delay - start detail modal enter animation IMMEDIATELY
          // This prevents 1 second blank screen between board exit and detail modal enter
          // Prevent #app from blocking clicks while modal is opening
          const appEl = document.getElementById('app');
          if (appEl) {
            appEl.style.pointerEvents = 'none';
            appEl.style.zIndex = '-1';
          }
          
          if (typeof journeyBoardsManager.openBoardDetailsById === 'function') {
            // openBoardDetailsById will handle enter animation for detail modal
            // Skip Journey exit animation because Journey screen is already hidden
            await journeyBoardsManager.openBoardDetailsById(detailModalBoardId, true);
            console.log(`✅ Detail modal opened IMMEDIATELY for board ${detailModalBoardId} with enter animation`);
            window.setTimeout(() => {
              delete (window as any).__ccSuppressJourneyShowForDirectDetailReturn;
            }, 2000);
          } else {
            console.warn('⚠️ openBoardDetailsById method not found');
            delete (window as any).__ccSuppressJourneyShowForDirectDetailReturn;
          }
        }).catch((error) => {
          console.warn('⚠️ Failed to import journeyBoardsManager:', error);
          delete (window as any).__ccSuppressJourneyShowForDirectDetailReturn;
        });
      }
      
      // Ensure navigation stays hidden (Journey has its own back button)
      const navElement = document.getElementById('independent-nav');
      if (navElement) {
        navElement.style.display = 'none';
        navElement.style.visibility = 'hidden';
        navElement.style.opacity = '0';
        navElement.setAttribute('aria-hidden', 'true');
      }
      
      // 🔥 CRITICAL FIX: Hide app element AFTER detail modal is shown
      // This ensures the #app element doesn't block clicks on the slider/homepage below
      // Without this, #app remains with pointer-events: auto and z-index: 999, blocking all clicks
      await new Promise(resolve => setTimeout(resolve, 200));
      uiManager.hideApp();
      console.log('✅ App element hidden AFTER detail modal shown (prevents click blocking)');
      
      // Resume menu soundtrack when returning to detail modal (Journey context)
      try {
        const { fadeInAndResume } = await import('./modules/soundtrack-manager.js');
        fadeInAndResume();
      } catch (_) { /* ignore */ }
      (window as any).__ccSoundtrackResumedThisExit = true;
      console.log('✅ Detail modal pathway complete - Journey screen hidden, detail modal shown');
    } else if (targetSlide === 1) {
      // 🔥 Journey pathway - NO homepage slider involvement
      console.log('🗺️ Journey pathway - showing Journey screen directly...');
      
      // 🔥 CRITICAL FIX: Ensure homepage and slider are hidden BEFORE showing Journey screen
      const homeElement = document.getElementById('home');
      if (homeElement) {
        homeElement.style.display = 'none';
        homeElement.setAttribute('hidden', 'true');
        homeElement.style.visibility = 'hidden';
        homeElement.style.opacity = '0';
        homeElement.style.zIndex = '-1';
        console.log('✅ Homepage hidden before showing Journey screen');
      }
      
      const sliderContainer = document.getElementById('slider-container');
      if (sliderContainer) {
        sliderContainer.style.display = 'none';
        sliderContainer.style.visibility = 'hidden';
        sliderContainer.style.opacity = '0';
        sliderContainer.style.zIndex = '-1';
        console.log('✅ Slider container hidden before showing Journey screen');
      }
      
      // Show Journey screen immediately (no delays, no RAF hacks)
      const collectiblesManager = (window as any).collectiblesManager;
      if (collectiblesManager && typeof collectiblesManager.showCollectibles === 'function') {
        // This will handle Journey screen enter animation internally
        collectiblesManager.showCollectibles();
        console.log('✅ Journey screen shown with enter animation');
      } else {
        try {
          const { ensureCollectiblesManager, showCollectiblesScreen } = await import('./collectibles-manager.js');
          await ensureCollectiblesManager();
          await showCollectiblesScreen();
          console.log('✅ Journey screen shown with enter animation (fallback import)');
        } catch (error) {
          console.warn('⚠️ CollectiblesManager not found and fallback import failed:', error);
          const journeyScreenFallback = document.getElementById('journey-screen');
          if (journeyScreenFallback) {
            journeyScreenFallback.removeAttribute('hidden');
            journeyScreenFallback.style.display = 'flex';
            journeyScreenFallback.style.visibility = 'visible';
            journeyScreenFallback.style.opacity = '1';
          }
        }
      }

      // Resume menu soundtrack with fade in when Journey is shown (so music plays on Journey)
      try {
        const { fadeInAndResume } = await import('./modules/soundtrack-manager.js');
        fadeInAndResume();
      } catch (_) { /* ignore */ }
      (window as any).__ccSoundtrackResumedThisExit = true;

      // Ensure navigation stays hidden (Journey has its own back button)
      const navElement = document.getElementById('independent-nav');
      if (navElement) {
        navElement.style.display = 'none';
        navElement.style.visibility = 'hidden';
        navElement.style.opacity = '0';
        navElement.setAttribute('aria-hidden', 'true');
      }
      
      // 🔥 CRITICAL FIX: Hide app element AFTER Journey screen is shown
      // This ensures exit animation was fully visible before hiding app
      // Wait a bit to ensure Journey screen enter animation has started
      await new Promise(resolve => setTimeout(resolve, 200));
      uiManager.hideApp();
      console.log('✅ App element hidden AFTER Journey screen shown (exit animation was visible)');
      
      console.log('✅ Journey pathway complete - NO homepage slider or background gradient');
    } else {
      // 🔥 Homepage pathway - normal slider animation
      console.log('🏠 Homepage pathway - playing slider enter animation...');
      animateSliderEnter();
      // Resume menu soundtrack with fade in when homepage is shown
      try {
        const { fadeInAndResume } = await import('./modules/soundtrack-manager.js');
        fadeInAndResume();
      } catch (_) { /* ignore */ }
      (window as any).__ccSoundtrackResumedThisExit = true;
      // 🔥 CRITICAL FIX: Hide app element AFTER homepage is shown
      await new Promise(resolve => setTimeout(resolve, 200));
      uiManager.hideApp();
      console.log('✅ App element hidden AFTER homepage shown (exit animation was visible)');
    }
    console.log('✅ Exit complete - pathways separated');
    logger.info('✅ Exited to menu successfully - next play will start fresh without resume sheet');
  } catch (error) {
    logger.error('❌ Failed to exit to menu:', String(error));
  } finally {
    (window as any).__ccLastGameExitAt = Date.now();
    (window as any).__ccLastGameExitWasArcade = (window as any).__ccRunMode === RUN_MODE_ARCADE_HOME;
    // Resume soundtrack if not already triggered in pathway (e.g. error path)
    try {
      const { soundtrackManager } = await import('./modules/soundtrack-manager.js');
      if (!(window as any).__ccSoundtrackResumedThisExit) {
        soundtrackManager.fadeInAndResume?.();
      }
      delete (window as any).__ccSoundtrackResumedThisExit;
    } catch (_) { /* ignore */ }
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

// Track cubes cracked (global and per-board)
(window as any).trackCubesCracked = async (count: number = 1) => {
  try {
    const verboseGameplayLogs = (window as any).__ccVerboseGameplayLogs === true;
    // Update global stats
    const { statsService } = await import('./services/stats-service.js');
    statsService.incrementCubesCracked(count);
    
    // 🔥 USER REQUEST: Also track cubes cracked per-board (accumulates)
    try {
      const { STATE } = await import('./modules/app-state.js');
      // 🔥 CRITICAL: Get board number from STATE - ensure it's correct
      const boardNumber = STATE?.boardNumber || STATE?.level || 1;
      if (verboseGameplayLogs) {
        console.log(`🧊 trackCubesCracked: boardNumber=${boardNumber}, count=${count}, STATE.boardNumber=${STATE?.boardNumber}, STATE.level=${STATE?.level}`);
      }
      
      const { boardStatsService } = await import('./services/board-stats-service.js');
      const previousTotal = boardStatsService.getBoardStats(boardNumber).cubesCracked;
      const newTotal = boardStatsService.addBoardCubesCracked(boardNumber, count);
      if (verboseGameplayLogs) {
        console.log(`🧊 Board ${boardNumber} cubes cracked: ${previousTotal} + ${count} = ${newTotal} (accumulated)`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to track board-specific cubes cracked:', error);
    }
    
    if (verboseGameplayLogs) {
      console.log('✅ Cubes cracked tracked (global and per-board):', count);
    }
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
