// UI Manager Module
// Handles all UI interactions and animations

import gameState from './game-state.js';
import { fadeOutHome, fadeInHome } from '../utils/animations.js';

class UIManager {
  constructor() {
    this.elements = {};
    this.animations = new Map();
    this.isInitialized = false;
  }
  
  // Initialize UI elements
  init() {
    if (this.isInitialized) return;
    
    try {
      // Cache DOM elements
      this.elements = {
        loadingScreen: document.getElementById('loading-screen'),
        loadingFill: document.getElementById('loading-fill'),
        loadingPercentage: document.getElementById('loading-percentage'),
        home: document.getElementById('home'),
        app: document.getElementById('app'),
        homeLogo: document.getElementById('home-logo'),
        sliderContainer: document.getElementById('slider-container'),
        sliderWrapper: document.getElementById('slider-wrapper'),
        sliderDots: document.querySelectorAll('.slider-dot'),
        sliderDivider: document.querySelector('.slider-nav-divider'),
        playButton: document.getElementById('btn-home'),
        statsButton: document.getElementById('btn-stats'),
        collectiblesButton: document.getElementById('btn-collectibles'),
        settingsButton: document.getElementById('btn-settings')
      };
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Subscribe to state changes
      this.setupStateSubscriptions();
      
      this.isInitialized = true;
      console.log('✅ UI Manager initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize UI Manager:', error);
      throw error;
    }
  }
  
  // Setup event listeners
  setupEventListeners() {
    // Play button
    if (this.elements.playButton) {
      this.elements.playButton.addEventListener('click', this.handlePlayClick.bind(this));
    }
    
    // Stats button
    if (this.elements.statsButton) {
      this.elements.statsButton.addEventListener('click', this.handleStatsClick.bind(this));
    }
    
    // Collectibles button
    if (this.elements.collectiblesButton) {
      this.elements.collectiblesButton.addEventListener('click', this.handleCollectiblesClick.bind(this));
    }
    
    // Settings button
    if (this.elements.settingsButton) {
      this.elements.settingsButton.addEventListener('click', this.handleSettingsClick.bind(this));
    }
  }
  
  // Setup state subscriptions
  setupStateSubscriptions() {
    // Homepage visibility
    gameState.subscribe('homepageReady', (isReady) => {
      if (isReady) {
        this.showHomepage();
      }
    });
    
    // Game active state
    gameState.subscribe('isGameActive', (isActive) => {
      if (isActive) {
        this.hideHomepage();
      } else {
        this.showHomepage();
      }
    });
    
    // Slider locked state
    gameState.subscribe('sliderLocked', (isLocked) => {
      this.updateSliderLockState(isLocked);
    });
  }
  
  // Handle play button click
  handlePlayClick(event) {
    event.preventDefault();
    console.log('🎮 Play button clicked');
    
    // Check for saved game
    this.checkForSavedGame();
  }
  
  // Handle stats button click
  handleStatsClick(event) {
    event.preventDefault();
    console.log('📊 Stats button clicked');
    
    // Show stats screen
    this.showStatsScreen();
  }
  
  // Handle collectibles button click
  handleCollectiblesClick(event) {
    event.preventDefault();
    console.log('🎁 Collectibles button clicked');
    
    // Show collectibles screen
    this.showCollectiblesScreen();
  }
  
  // Handle settings button click
  handleSettingsClick(event) {
    event.preventDefault();
    console.log('⚙️ Settings button clicked');
    
    // Show settings screen
    this.showSettingsScreen();
  }
  
  // Check for saved game
  async checkForSavedGame() {
    try {
      console.log('🔍 Checking for saved game...');
      const savedGame = localStorage.getItem('cc_saved_game');
      console.log('🔍 Saved game found:', !!savedGame, savedGame ? 'YES' : 'NO');
      
      // TEMPORARY: Clear saved game to force new game
      if (savedGame) {
        console.log('🧹 Clearing saved game to force new game...');
        localStorage.removeItem('cc_saved_game');
      }
      
      console.log('🎮 Starting new game...');
      // Always start new game for now
      this.startNewGame();
      
    } catch (error) {
      console.error('❌ Failed to check for saved game:', error);
      // Fallback to new game
      this.startNewGame();
    }
  }
  
  // Start new game
  async startNewGame() {
    try {
      console.log('🎮 Starting new game...');
      
      // Set game state
      gameState.setState({
        isGameActive: true,
        isPaused: false,
        isGameEnded: false,
        score: 0,
        level: 1,
        combo: 0
      });
      
      console.log('✅ Game state set, hiding homepage...');
      
      // Hide homepage
      this.hideHomepage();
      
      console.log('✅ Homepage hidden, importing app.js...');
      
      // Start game
      const { boot } = await import('./app.js');
      
      console.log('✅ App.js imported, calling boot()...');
      
      await boot();
      
      console.log('✅ Boot completed successfully!');
      
    } catch (error) {
      console.error('❌ Failed to start new game:', error);
      console.error('❌ Error details:', error.stack);
    }
  }
  
  // Show homepage
  showHomepage() {
    if (this.elements.home) {
      this.elements.home.style.display = 'block';
      this.elements.home.removeAttribute('hidden');
      fadeInHome();
    }
  }
  
  // Hide homepage
  hideHomepage() {
    if (this.elements.home) {
      fadeOutHome();
    }
  }
  
  // Show homepage with animation
  showHomepageWithAnimation() {
    if (this.elements.home) {
      this.elements.home.style.display = 'block';
      this.elements.home.removeAttribute('hidden');
      this.elements.home.style.opacity = '0';
      this.elements.home.style.transition = 'opacity 0.6s ease';
      setTimeout(() => {
        fadeInHome();
      }, 50);
    }
  }
  
  // Show stats screen
  showStatsScreen() {
    console.log('📊 Showing stats screen');
    // Implementation will be added
  }
  
  // Show collectibles screen
  showCollectiblesScreen() {
    console.log('🎁 Showing collectibles screen');
    // Implementation will be added
  }
  
  // Show settings screen
  showSettingsScreen() {
    console.log('⚙️ Showing settings screen');
    // Implementation will be added
  }
  
  // Update slider lock state
  updateSliderLockState(isLocked) {
    if (this.elements.sliderContainer) {
      this.elements.sliderContainer.style.pointerEvents = isLocked ? 'none' : 'auto';
    }
  }
  
  // Update loading progress
  updateLoadingProgress(progress) {
    if (this.elements.loadingFill) {
      this.elements.loadingFill.style.width = `${progress}%`;
    }
    
    if (this.elements.loadingPercentage) {
      this.elements.loadingPercentage.textContent = `${Math.round(progress)}%`;
    }
  }
  
  // Show loading screen
  showLoadingScreen() {
    if (this.elements.loadingScreen) {
      this.elements.loadingScreen.style.display = 'flex';
      this.elements.loadingScreen.classList.remove('hidden');
    }
  }
  
  // Hide loading screen
  hideLoadingScreen() {
    if (this.elements.loadingScreen) {
      this.elements.loadingScreen.style.display = 'none';
      this.elements.loadingScreen.classList.add('hidden');
    }
  }
  
  // Get element by ID
  getElement(id) {
    return this.elements[id] || document.getElementById(id);
  }
  
  // Cleanup
  destroy() {
    this.animations.clear();
    this.elements = {};
    this.isInitialized = false;
  }
}

// Create singleton instance
const uiManager = new UIManager();

// Export for use in other modules
export default uiManager;

// Export class for testing
export { UIManager };
