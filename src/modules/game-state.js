// Game State Management Module
// Centralized state management for Cube Crash game

class GameState {
  constructor() {
    this.state = {
      // Game status
      isGameActive: false,
      isPaused: false,
      isGameEnded: false,
      
      // UI state
      homepageReady: false,
      sliderLocked: false,
      isDragging: false,
      
      // Game data
      score: 0,
      highScore: 0,
      level: 1,
      combo: 0,
      
      // Navigation
      currentSlide: 0,
      navigationReset: false,
      
      // Collectibles
      pendingCollectibleRewards: [],
      
      // Performance
      lastFrameTime: 0,
      fps: 60
    };
    
    this.listeners = new Map();
  }
  
  // Get state value
  get(key) {
    return this.state[key];
  }
  
  // Set state value and notify listeners
  set(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;
    
    // Notify listeners
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(callback => {
        try {
          callback(value, oldValue);
        } catch (error) {
          console.error(`Error in state listener for ${key}:`, error);
        }
      });
    }
    
    console.log(`🔄 State updated: ${key} = ${value}`);
  }
  
  // Subscribe to state changes
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      if (this.listeners.has(key)) {
        this.listeners.get(key).delete(callback);
      }
    };
  }
  
  // Unsubscribe from state changes
  unsubscribe(key, callback) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).delete(callback);
    }
  }
  
  // Reset state to initial values
  reset() {
    this.state = {
      isGameActive: false,
      isPaused: false,
      isGameEnded: false,
      homepageReady: false,
      sliderLocked: false,
      isDragging: false,
      score: 0,
      highScore: this.state.highScore, // Keep high score
      level: 1,
      combo: 0,
      currentSlide: 0,
      navigationReset: false,
      pendingCollectibleRewards: [],
      lastFrameTime: 0,
      fps: 60
    };
    
    console.log('🔄 Game state reset');
  }
  
  // Get entire state (for debugging)
  getState() {
    return { ...this.state };
  }
  
  // Set multiple state values at once
  setState(newState) {
    Object.keys(newState).forEach(key => {
      this.set(key, newState[key]);
    });
  }
}

// Create singleton instance
const gameState = new GameState();

// Export for use in other modules
export default gameState;

// Export class for testing
export { GameState };
