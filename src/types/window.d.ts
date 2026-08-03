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
    unlockSlider?: () => void;
    
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
    CC?: {
      restart?: () => void;
      app?: any;
      stage?: any;
      pauseGame?: () => void;
      resumeGame?: () => void;
      nextLevel?: () => void;
      retry?: () => void;
      state?: () => { level: number; score: number; board: number; moves: number; wildMeter: number; tiles: number };
      getScore?: () => number;
      setScore?: (v: number) => void;
      animateScoreTo?: (v: number, d?: number) => void;
      updateHUD?: () => void;
      getHudMetrics?: () => Record<string, unknown>;
      getUnifiedHudInfo?: () => { y: number; height: number; parent: any; dropped: boolean };
      hideGameUI?: () => void;
      showGameUI?: () => void;
      testCleanBoard?: () => Promise<void>;
      testCleanAndPrize?: () => Promise<void>;
      showCleanBoardOverlay?: () => void;
      triggerCleanBoardFlow?: (reason: string) => Promise<void>;
      checkLevelEnd?: () => void;
      applyWildSkinLocal?: (tile: any) => void;
      getCombo?: () => number;
      setCombo?: (v: number) => void;
      scheduleComboDecay?: () => void;
      killComboTimer?: () => void;
      addStars?: (count: number) => void;
      setStarsCount?: (count: number) => void;
      cleanupFxForBoardReset?: (reason?: string) => void;
      softResetBoardView?: (reason?: string) => void;
      destroyOldBoardForTransition?: (reason?: string) => void;
      cleanupTexturesForBoardTransition?: (reason: string, aggressive?: boolean, skipCacheClear?: boolean) => void;
      snapshotState?: () => {
        grid: any[][];
        score: number;
        level: number;
        boardNumber: number;
        moves: number;
        wildMeter: number;
        starsCount: number;
      };
      replayStartRecord?: () => void;
      replayStartVerify?: (steps: Array<any>) => void;
      replayStop?: () => void;
      replayExport?: () => string;
      replayImport?: (json: string) => boolean;
      replayStatus?: () => { mode: string; steps: number; stepIndex: number; lastError: string | null };
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
