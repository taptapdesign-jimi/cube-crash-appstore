import { logger } from '../core/logger.js';
// Game State Management Module
// Centralized state management for Cube Crash game

interface CollectibleReward {
  id: string;
  type: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  value: number;
  timestamp: number;
}

export interface GameStateData {
  // Game status
  isGameActive: boolean;
  isPaused: boolean;
  isGameEnded: boolean;
  
  // UI state
  homepageReady: boolean;
  sliderLocked: boolean;
  isDragging: boolean;
  
  // Game data
  score: number;
  highScore: number;
  level: number;
  combo: number;
  
  // Navigation
  currentSlide: number;
  navigationReset: boolean;
  
  // Collectibles
  pendingCollectibleRewards: CollectibleReward[];
  
  // Performance
  lastFrameTime: number;
  fps: number;
}

export type StateKey = keyof GameStateData;
export type StateListener<T = any> = (newValue: T, oldValue: T) => void;

class GameState {
  private state: GameStateData;
  private listeners: Map<StateKey, Set<StateListener>>;

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
  get<K extends StateKey>(key: K): GameStateData[K] {
    return this.state[key];
  }
  
  // Set state value and notify listeners
  set<K extends StateKey>(key: K, value: GameStateData[K]): void {
    const oldValue = this.state[key];
    this.state[key] = value;
    
    // Notify listeners
    if (this.listeners.has(key)) {
      this.listeners.get(key)!.forEach(callback => {
        try {
          callback(value, oldValue);
        } catch (error) {
          logger.error(`Error in state listener for ${key}:`, error);
        }
      });
    }
    
    logger.info(`🔄 State updated: ${key} = ${value}`);
  }
  
  // Subscribe to state changes
  subscribe<K extends StateKey>(key: K, callback: StateListener<GameStateData[K]>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      if (this.listeners.has(key)) {
        this.listeners.get(key)!.delete(callback);
      }
    };
  }
  
  // Unsubscribe from state changes
  unsubscribe<K extends StateKey>(key: K, callback: StateListener<GameStateData[K]>): void {
    if (this.listeners.has(key)) {
      this.listeners.get(key)!.delete(callback);
    }
  }
  
  // Reset state to initial values
  reset(): void {
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
    
    logger.info('🔄 Game state reset');
  }
  
  // Get entire state (for debugging)
  getState(): GameStateData {
    return { ...this.state };
  }
  
  // Set multiple state values at once
  setState(newState: Partial<GameStateData>): void {
    Object.keys(newState).forEach(key => {
      const typedKey = key as StateKey;
      this.set(typedKey, newState[typedKey]!);
    });
  }
}

// Create singleton instance
const gameState = new GameState();

// Export for use in other modules
export default gameState;

// Export class for testing
export { GameState };

