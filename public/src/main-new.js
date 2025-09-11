// MAIN NEW - AppShell Entry Point
console.log('🚀 Starting CubeCrash with AppShell...');

import { AppShell } from './app/app-shell.js';

let appShell;

async function init() {
  console.log('🎯 Initializing CubeCrash...');
  
  try {
    // Create AppShell
    appShell = new AppShell();
    
    // Initialize AppShell
    await appShell.init();
    
    console.log('✅ CubeCrash initialized successfully');
    
  } catch (error) {
    console.error('❌ Initialization error:', error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Global access for debugging
window.appShell = appShell;

console.log('✅ Main loaded');
