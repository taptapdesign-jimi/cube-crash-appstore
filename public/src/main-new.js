// OPTIMIZED MAIN.JS FOR NEW SLIDER STRUCTURE

import { boot } from './modules/app.js';
import { gsap } from 'gsap';

let slider;

// Initialize the application
(async () => {
  try {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise(res => document.addEventListener('DOMContentLoaded', res, { once: true }));
    }

    console.log('🚀 Initializing optimized CubeCrash...');

    // Get main elements
    const home = document.getElementById('home');
    const appHost = document.getElementById('app');
    
    if (!home || !appHost) {
      throw new Error('Required elements not found');
    }

    // Initialize the optimized slider
    slider = new OptimizedSlider();
    
    // Set up global functions for slider callbacks
    window.startGame = startGame;
    window.showStats = showStats;
    window.showCollectibles = showCollectibles;
    
    console.log('✅ Optimized CubeCrash initialized successfully');
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
  }
})();

// Start game function
async function startGame() {
  console.log('🎮 Starting game...');
  
  // Start exit animation
  if (slider) {
    slider.startExitAnimation(() => {
      console.log('🎭 Exit animation complete, starting game');
      
      // Hide home screen and show game
      const home = document.getElementById('home');
      const appHost = document.getElementById('app');
      
      home?.setAttribute('hidden', 'true');
      appHost?.removeAttribute('hidden');
      
      // Start the game
      boot().catch(console.error);
    });
  } else {
    // Fallback if slider not available
    const home = document.getElementById('home');
    const appHost = document.getElementById('app');
    
    home?.setAttribute('hidden', 'true');
    appHost?.removeAttribute('hidden');
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
