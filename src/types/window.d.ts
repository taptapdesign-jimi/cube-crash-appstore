import type { RuntimeGameBridge } from './runtime-game-bridge.ts';

// Global Window interface extensions
declare global {
  interface Window {
    // Game state
    gameState: any;
    STATE?: any;
    uiManager: any;
    animationManager: any;
    sliderManager: any;
    iosOptimizer: any;
    
    // Game functions
    startGameNow: () => Promise<void>;
    continueGame: () => Promise<void>;
    startNewGame?: () => void;
    pauseGame: () => void;
    resumeGame: () => void;
    restartGame: () => Promise<void>;
    exitToMenu: (options?: {
      target?: 'homepage' | 'auto';
      homepageSlideIndex?: 0 | 1;
      onHomepageEnterPrepared?: () => void;
    }) => void | Promise<void>;
    
    // Modals
    lockSlider?: () => void;
    unlockSlider?: () => void;
    showEndRunModalFromGame?: () => void;

    // Gameplay compatibility hooks with active repository callers
    updateGhostVisibility?: () => void;
    hideGhostPlaceholders?: () => void;
    checkForUnsavedHighScore?: () => void;
    trackCubesCracked?: (count?: number) => void | Promise<void>;
    trackHelpersUsed?: (count?: number) => void | Promise<void>;
    trackHighestBoard?: (board: number) => void | Promise<void>;
    trackLongestCombo?: (combo: number) => void | Promise<void>;
    trackCollectiblesUnlocked?: (count: number) => void | Promise<void>;
    checkCollectiblesMilestones?: (score: number) => void | Promise<void>;
    resetAllStats?: () => void;
    
    // iOS Optimizer
    iosImageOptimizer?: any;
    
    // PIXI.js
    PIXI?: {
      utils?: {
        clearTextureCache: () => void;
      };
    };
    
    // Game Audio
    gameAudio?: { [key: string]: HTMLAudioElement };
    
    // Collectibles
    collectiblesManager?: any;
    showCollectibles?: (options?: {
      scrollToCard?: string;
      rarity?: string;
      animateCard?: boolean;
    }) => Promise<void>;
    hideCollectibles?: () => Promise<void>;
    showCollectiblesScreen?: (options?: {
      scrollToCard?: string;
      rarity?: string;
      animateCard?: boolean;
    }) => Promise<void>;
    hideCollectiblesScreen?: () => Promise<void>;
    unlockCollectible?: (eventName: string) => Promise<void>;
    unlockCollectibleByNumber?: (number: number) => Promise<void>;
    hideCollectibleByNumber?: (number: number) => Promise<void>;
    __pendingCollectibleFlips?: any[];
    showCollectibleRewardBottomSheet?: (options: { cardName: string; imagePath: string }) => void;
    
    // High Score
    updateHighScore?: (score: number) => void;
    
    // Game Control
    CC?: RuntimeGameBridge;

    // app-core compatibility adapters used by save/load and recovery flows
    saveGameState?: () => void;
    loadGameState?: (boardNumber?: number) => Promise<boolean>;
    rebuildBoard?: () => void;
    startLevel?: (boardNumber: number) => Promise<void>;
    drawBoardBG?: (mode?: string) => void;
    animateBoardExit?: () => Promise<void>;
    stopPixiTicker?: () => boolean;
    killAllDelayedCalls?: () => void;
    destroyAllGraphicsObjects?: () => void;
    
    // Memory Management
    gc?: () => void;
    
    // Error Handling
    app?: {
      destroy?: (removeView?: boolean) => void;
    };
    
    // Game State
    _gameHasEnded?: boolean;
    
    // MS Stream (legacy)
    MSStream?: any;
    
    // GSAP
    gsap?: any;
    
    // CubeCrash Internal Flags (__cc*)
    // See docs/WINDOW_CC_FLAGS.md for full documentation
    __ccCameFromDetailModal?: boolean;
    __ccCameFromHomepage?: boolean;
    __ccCameFromJourney?: boolean;
    __ccDetailModalBoardId?: number;
    __ccInterimCardInViewport?: boolean;
    __ccIsAnimatingSliderEnter?: () => boolean;
    __ccIsAnimatingSliderExit?: () => boolean;
    __ccIsHidingCollectibles?: boolean;
    __ccJourneyBadgeCount?: number;
    __ccJourneyExitMode?: string;
    __ccPreserveScore?: boolean;
    __ccResumeScore?: number;
    __ccSkipRebuildBoard?: boolean;
    __ccStartAtLevel?: number;
    __ccTriggerHudDrop?: boolean;
    __ccUiJourneyTransitioning?: boolean;
  }
}

export {};
