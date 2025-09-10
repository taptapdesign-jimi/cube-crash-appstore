// SIMPLE MAIN.JS - NO SLIDER CONFLICTS
import { boot } from './modules/app.js';
import { OptimizedSlider } from './slider-optimized.js';

console.log('🚀 Initializing CubeCrash with clean slider...');

let slider;

(async () => {
  try {
    if (document.readyState === 'loading') {
      await new Promise(res => document.addEventListener('DOMContentLoaded', res, { once: true }));
    }

    const home = document.getElementById('home');
    const appHost = document.getElementById('app') || (()=>{ 
      const d = document.createElement('div'); 
      d.id = 'app'; 
      d.hidden = true;
      document.body.appendChild(d); 
      return d; 
    })();

    // Initialize the clean slider
    slider = new OptimizedSlider();
    window.slider = slider;
    
    console.log('✅ Clean slider initialized');

    // Global functions for game control
    window.startGame = async () => {
      console.log('🎮 Starting game...');
      
      // Hide homepage
      if (home) {
        home.style.setProperty('display', 'none', 'important');
      }
      
      // Show game
      if (appHost) {
        appHost.style.setProperty('display', 'block', 'important');
        appHost.removeAttribute('hidden');
      }
      
      // Boot the game
      await boot();
    };

    window.showStats = () => {
      console.log('📊 Stats clicked');
      // TODO: Implement stats
    };

    window.showCollectibles = () => {
      console.log('🎁 Collectibles clicked');
      // TODO: Implement collectibles
    };

    console.log('✅ All global functions set up');

  } catch (error) {
    console.error('❌ Error initializing:', error);
  }
})();