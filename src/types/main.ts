// Type definitions for main.js

// Game state types
export interface GameState {
  score: number;
  bestScore: number;
  moves: number;
  level: number;
  wildProgress: number;
  grid: (any | null)[][];
  tiles: any[];
  gameEnded: boolean;
  timestamp: number;
}

// Slider types
export interface SliderConfig {
  currentSlide: number;
  totalSlides: number;
  isAnimating: boolean;
  isLocked: boolean;
}

// Navigation types
export interface NavigationState {
  isVisible: boolean;
  isAnimating: boolean;
  currentActive: number;
}

// Animation types
export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
}

// Event types
export interface GameEvent {
  type: string;
  data?: any;
  timestamp: number;
}

// Global window interface extensions
declare global {
  interface Window {
    // Game functions
    startGameNow: () => Promise<void>;
    continueGame: () => Promise<void>;
    startNewGame: () => Promise<void>;
    exitToMenu: () => Promise<void>;
    
    // Slider functions
    unlockSlider?: () => void;
    lockSlider?: () => void;
    
    // Game state
    _gameHasEnded?: boolean;
    _sliderLocked?: boolean;
    _navigationReset?: boolean;
    
    // Animation functions
    ensurePlayButtonReset?: () => void;
    updateGhostVisibility?: () => void;
    
    // HUD functions
    showGameUI?: () => void;
    resetHudDropPending?: () => void;
    
    // Collectibles functions
    showCollectiblesScreen?: () => void;
    hideCollectiblesScreen?: () => void;
    showStatsScreen?: () => void;
    hideStatsScreen?: () => void;
    
    // Additional game functions
    saveGameState?: () => void;
    loadGameState?: () => any;
    ensureDotsVisible?: () => void;
    resetPlayButtonState?: () => void;
    showEndRunModalFromGame?: () => void;
    updateGameStats?: () => void;
    getGameStats?: () => any;
    incrementStat?: (stat: string) => void;
    updateHighScore?: (score: number) => void;
    forceUpdateHighScore?: (score: number) => void;
    checkForUnsavedHighScore?: () => void;
  trackCubesCracked?: (count: number) => void;
  trackHelpersUsed?: (count: number) => void;
    trackHighestBoard?: (level: number) => void;
    trackLongestCombo?: (combo: number) => void;
    trackCollectiblesUnlocked?: () => void;
    checkCollectiblesMilestones?: (score: number) => void;
    resetAllStats?: () => void;
    testEndRunModal?: () => void;
    hardResetStats?: () => void;
    createTestSavedGame?: () => void;
    showMenuScreen?: () => void;
    hideMenuScreen?: () => void;
    showStats?: () => void;
    showCollectibles?: () => void;
    testShowCollectibles?: () => void;
    startGame?: () => void;
    
    // Game state objects
    STATE?: any;
    score?: number;
    app?: any;
    
    // Collectibles manager
    collectiblesManager?: any;
  }
}

// Export types (commented out to avoid conflicts)
// export type { GameState, SliderConfig, NavigationState, AnimationConfig, GameEvent };