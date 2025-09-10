// OPTIMIZED MAIN.JS FOR NEW SLIDER STRUCTURE

import { boot } from './modules/app.js';
import { gsap } from 'gsap';

let home, appHost, slider;

// Initialize the application
async function init() {
  try {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise(res => document.addEventListener('DOMContentLoaded', res, { once: true }));
    }

    console.log('🚀 Initializing optimized CubeCrash...');

    // Get main elements
    home = document.getElementById('home');
    appHost = document.getElementById('app');
    
    if (!home || !appHost) {
      throw new Error('Required elements not found');
    }

    // Initialize the optimized slider
    slider = new OptimizedSlider();
    
    // Set up global functions for slider callbacks
    window.startGame = startGame;
    window.showStats = showStats;
    
    console.log('✅ Optimized CubeCrash initialized successfully');
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
  }
}

// Start game function
function startGame() {
  console.log('🎮 Starting game...');
  
  // Start exit animation
  if (slider) {
    slider.startExitAnimation(() => {
      console.log('🎭 Exit animation complete, starting game');
      
      // Hide home screen and show game
      home.setAttribute('hidden', 'true');
      appHost.removeAttribute('hidden');
      
      // Start the game
      boot().catch(console.error);
    });
  } else {
    // Fallback if slider not available
    home.setAttribute('hidden', 'true');
    appHost.removeAttribute('hidden');
    boot().catch(console.error);
  }
}

// Show stats function
function showStats() {
  console.log('📊 Showing stats...');
  // This will be implemented when stats screen is ready
  alert('Stats screen coming soon!');
}

// Initialize when script loads
init().catch(console.error);
