// Global Window interface extensions
declare global {
  interface Window {
    // Game state
    gameState: any;
    uiManager: any;
    animationManager: any;
    sliderManager: any;
    iosOptimizer: any;
    
    // Game functions
    startGameNow: () => Promise<void>;
    continueGame: () => Promise<void>;
    pauseGame: () => void;
    resumeGame: () => void;
    restartGame: () => void;
    exitToMenu: () => void;
    
    // Modals
    showResumeGameModal?: () => Promise<void>;
    unlockSlider?: () => void;
    
    // 3D Effects
    threeDEffects?: {
      is3DEnabled: boolean;
      add3DToTile: (tile: any) => void;
      remove3DFromTile: (tile: any) => void;
    };
    
    // iOS Optimizer
    iosImageOptimizer?: {
      optimizeImage: (url: string) => string;
      optimizations: any;
    };
    
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
    CC?: {
      restart?: () => void;
      app?: any;
      stage?: any;
      pauseGame?: () => void;
      resumeGame?: () => void;
    };
    
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
    
    // Analytics
    gtag?: (command: string, action: string, parameters: any) => void;
    
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
