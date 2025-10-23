// CUBE CRASH - MAIN ENTRY POINT
// Clean, modular architecture

import { boot, layout as appLayout } from './modules/app.js';
import { gsap } from 'gsap';
import { assetPreloader } from './modules/asset-preloader.js';
import './ios-image-helper.js';
import './3d-effects.js';

// Import core modules
import gameState from './modules/game-state.js';
import uiManager from './modules/ui-manager.js';
import animationManager from './modules/animation-manager.js';
import sliderManager from './modules/slider-manager.js';
import iosOptimizer from './modules/ios-optimizer.js';

// Import utilities
import errorHandler from './utils/error-handler.js';
import performanceMonitor from './utils/performance-monitor.js';
import memoryManager from './modules/memory-manager.js';

console.log('🚀 Starting CubeCrash v42.1...');

// Initialize core systems
async function initializeApp() {
  try {
    console.log('🔧 Initializing core systems...');
    
    // Initialize error handling
    errorHandler.handleError = errorHandler.handleError.bind(errorHandler);
    performanceMonitor.start();
    memoryManager.start();
    
    // Initialize animation manager
    animationManager.init();
    
    // Initialize UI manager
    uiManager.init();
    
    // Initialize slider manager
    sliderManager.init();
    
    // Initialize iOS optimizer
    iosOptimizer.init();
    
    // Start asset preloading
    await startAssetPreloading();
    
    // Initialize game
    await initializeGame();
    
    console.log('✅ App initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    errorHandler.handleError(error, 'App Initialization');
    throw error;
  }
}

// Setup iOS optimizations
function setupIOSOptimizations() {
  if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
    console.log('📱 iOS device detected, applying optimizations...');
    
    // Add iOS class
    document.body.classList.add('ios-device');
    
    // Optimize touch handling
    document.addEventListener('touchstart', function() {}, { passive: true });
    document.addEventListener('touchmove', function() {}, { passive: true });
  }
}

// Start asset preloading
async function startAssetPreloading() {
  try {
    console.log('📦 Starting asset preloading...');
    
    // Show loading screen
    uiManager.showLoadingScreen();
    
    // Start preloading
    await assetPreloader.preload();
    
    // Hide loading screen
    uiManager.hideLoadingScreen();
    
    console.log('✅ Assets preloaded successfully');
    
  } catch (error) {
    console.error('❌ Asset preloading failed:', error);
    throw error;
  }
}

// Initialize game
async function initializeGame() {
  try {
    console.log('🎮 Initializing game...');
    
    // Set initial state
    gameState.setState({
      homepageReady: true,
      isGameActive: false,
      isPaused: false
    });
    
    // Show homepage
    uiManager.showHomepage();
    
    console.log('✅ Game initialized successfully');
    
  } catch (error) {
    console.error('❌ Game initialization failed:', error);
    throw error;
  }
}

// Handle app errors
window.addEventListener('error', (event) => {
  errorHandler.handleError(event.error, 'Global Error');
});

window.addEventListener('unhandledrejection', (event) => {
  errorHandler.handleError(event.reason, 'Unhandled Promise Rejection');
});

// Start the app
initializeApp().catch(error => {
  console.error('❌ Critical error during app startup:', error);
});

// Export for debugging
window.gameState = gameState;
window.uiManager = uiManager;
window.animationManager = animationManager;
window.sliderManager = sliderManager;
window.iosOptimizer = iosOptimizer;
