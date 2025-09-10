// OPTIMIZED MAIN.JS FOR NEW SLIDER STRUCTURE

import { boot } from './modules/app.js';
import { gsap } from 'gsap';
import { OptimizedSlider } from './slider-optimized.js';

console.log('📦 main-new.js loaded');
console.log('📦 OptimizedSlider imported:', typeof OptimizedSlider);

let slider;

// Initialize the application
(async () => {
  try {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      console.log('⏳ Waiting for DOM to be ready...');
      await new Promise(res => document.addEventListener('DOMContentLoaded', res, { once: true }));
    }

    console.log('🚀 Initializing optimized CubeCrash...');
    console.log('📄 DOM ready state:', document.readyState);

    // Get main elements
    const home = document.getElementById('home');
    const appHost = document.getElementById('app');
    
    if (!home || !appHost) {
      throw new Error('Required elements not found');
    }

    // Initialize the optimized slider
    console.log('🎠 Creating OptimizedSlider...');
    slider = new OptimizedSlider();
    
    if (!slider) {
      throw new Error('Failed to create OptimizedSlider');
    }
    
    // Make slider globally available
    window.slider = slider;
    
    console.log('✅ OptimizedSlider created successfully and set as window.slider');
    
    // Set up global functions for slider callbacks
    window.startGame = startGame;
    window.showStats = showStats;
    window.showCollectibles = showCollectibles;
    
    // Add global function to re-initialize slider
    window.reinitializeSlider = () => {
      if (slider && typeof slider.reinitialize === 'function') {
        console.log('🔄 Re-initializing slider via global function...');
        slider.reinitialize();
      } else {
        console.log('⚠️ Slider not available for re-initialization');
      }
    };
    
    console.log('🎮 Global functions set:', {
      startGame: typeof window.startGame,
      showStats: typeof window.showStats,
      showCollectibles: typeof window.showCollectibles
    });
    
    console.log('✅ Optimized CubeCrash initialized successfully');
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
  }
})();

// Start game function
async function startGame() {
  console.log('🎮 startGame() called!');
  console.log('🎮 slider exists:', !!slider);
  
  // Start exit animation
  if (slider) {
    console.log('🎮 Using slider exit animation');
    slider.startExitAnimation(() => {
      console.log('🎭 Exit animation complete, starting game');
      
      // Hide home screen and show game
      const home = document.getElementById('home');
      const appHost = document.getElementById('app');
      
      console.log('🎮 Elements found:', { home: !!home, appHost: !!appHost });
      
      home?.style.setProperty('display', 'none', 'important');
      appHost?.style.setProperty('display', 'block', 'important');
      
      // Start the game IMMEDIATELY - no delay
      console.log('🚀 Starting game boot immediately');
      
      // Call boot and start game immediately
      boot().then(() => {
        console.log('✅ Game boot completed - tiles should be visible');
      }).catch(console.error);
      console.log('✅ Game boot started immediately - no waiting');
    });
  } else {
    console.log('🎮 Slider not available, using fallback');
    // Fallback if slider not available
    const home = document.getElementById('home');
    const appHost = document.getElementById('app');
    
    home?.style.setProperty('display', 'none', 'important');
    appHost?.style.setProperty('display', 'block', 'important');
    boot().catch(console.error);
  }
}

// Show stats function
function showStats() {
  console.log('📊 Showing stats...');
  // This will be implemented when stats screen is ready
  alert('Stats screen coming soon!');
}

// Show collectibles function
function showCollectibles() {
  console.log('🎁 Showing collectibles...');
  // This will be implemented when collectibles screen is ready
  alert('Collectibles screen coming soon!');
}
