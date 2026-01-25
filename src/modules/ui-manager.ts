// @ts-nocheck
// UI Manager Module
// Handles all UI interactions and animations

import gameState from './game-state.js';
import { fadeOutHome, fadeInHome, animateSliderExit, animateSliderEnter, animateStatsScreenEnter, animateStatsScreenExit } from '../utils/animations.js';
import { showResumeGameBottomSheet } from './resume-game-bottom-sheet.js';
import { logger } from '../core/logger.js';
import { boot as bootGame, layoutBoard as layoutGame } from './app-core.js';
import memoryManager from '../utils/memory-manager.js';
import sliderManager from './slider-manager.js';
import { gsap } from 'gsap';
// 🔥 OPTIMIZATION: Preload settings animations module statically to avoid 15s delay on Settings click
import { animateSettingsScreenEnter, animateSettingsScreenExit } from '../ui/settings-animations.js';

// 🔥 FIXED: Paper texture opacity should work correctly:
// --paper-alpha: 1 → paper fully visible
// --paper-alpha: 0.5 → paper 50% visible
// We achieve this by setting the paper texture opacity directly, with a solid base color underneath
const PAPER_BG_IMAGE = "url('./assets/paper-bg.png')";
const PAPER_BG_STYLE = "#f3eee8 url('./assets/paper-bg.png') center/100% 100% no-repeat";

function clearSliderBackgrounds(): void {
  const homeContainer = document.getElementById('home');
  const sliderContainer = document.getElementById('slider-container');
  const sliderWrapper = document.getElementById('slider-wrapper');

  if (homeContainer) {
    (homeContainer as HTMLElement).style.setProperty('background', 'transparent', 'important');
    (homeContainer as HTMLElement).style.setProperty('background-image', 'none', 'important');
  }
  if (sliderContainer) {
    (sliderContainer as HTMLElement).style.setProperty('background', 'transparent', 'important');
    (sliderContainer as HTMLElement).style.setProperty('background-image', 'none', 'important');
  }
  if (sliderWrapper) {
    (sliderWrapper as HTMLElement).style.setProperty('background', 'transparent', 'important');
    (sliderWrapper as HTMLElement).style.setProperty('background-image', 'none', 'important');
  }

  const slides = document.querySelectorAll('.slider-slide');
  slides.forEach((slide) => {
    (slide as HTMLElement).style.setProperty('background', 'transparent', 'important');
    (slide as HTMLElement).style.setProperty('background-image', 'none', 'important');
  });
}

export function applyPaperBackground(alpha: string): void {
  document.documentElement?.style.setProperty('--paper-alpha', alpha);
  const body = document.body;
  const html = document.documentElement;
  const globalBg = document.getElementById('global-bg');
  const appElement = document.getElementById('app');

  // Parse alpha to create the proper background layering
  const alphaNum = parseFloat(alpha);
  const baseColor = '#f3eee8';
  
  // Create a semi-transparent overlay to control paper visibility
  // When alpha = 1, no overlay (paper fully visible)
  // When alpha = 0.5, 50% white overlay (paper 50% visible)
  const overlayAlpha = 1 - alphaNum;
  const backgroundLayers = overlayAlpha > 0.01
    ? `linear-gradient(rgba(243,238,232,${overlayAlpha}), rgba(243,238,232,${overlayAlpha})), url('./assets/paper-bg.png')`
    : `url('./assets/paper-bg.png')`;

  if (body) {
    body.style.setProperty('background-color', baseColor, 'important');
    body.style.setProperty('background-image', backgroundLayers, 'important');
    body.style.setProperty('background-size', '100% 100%', 'important');
    body.style.setProperty('background-repeat', 'no-repeat', 'important');
    body.style.setProperty('background-position', 'center', 'important');
  }
  if (html) {
    html.style.setProperty('background-color', baseColor, 'important');
    html.style.setProperty('background-image', backgroundLayers, 'important');
    html.style.setProperty('background-size', '100% 100%', 'important');
    html.style.setProperty('background-repeat', 'no-repeat', 'important');
    html.style.setProperty('background-position', 'center', 'important');
  }
  if (globalBg) {
    (globalBg as HTMLElement).style.setProperty('background-color', baseColor, 'important');
    (globalBg as HTMLElement).style.setProperty('background-image', backgroundLayers, 'important');
    (globalBg as HTMLElement).style.setProperty('background-size', '100% 100%', 'important');
    (globalBg as HTMLElement).style.setProperty('background-repeat', 'no-repeat', 'important');
    (globalBg as HTMLElement).style.setProperty('background-position', 'center', 'important');
  }
  if (appElement) {
    // Keep app container transparent so it never overrides global paper opacity
    appElement.style.setProperty('background', 'transparent', 'important');
    appElement.style.setProperty('background-image', 'none', 'important');
  }

  console.log(`📄 Paper background applied with alpha=${alpha}, overlayAlpha=${overlayAlpha}, visible=${alphaNum * 100}%`);
}

// Extend Window interface for haptic feedback

export interface UIManagerElements {
  loadingScreen: HTMLElement | null;
  loadingFill: HTMLElement | null;
  loadingPercentage: HTMLElement | null;
  home: HTMLElement | null;
  app: HTMLElement | null;
  homeLogo: HTMLElement | null;
  sliderContainer: HTMLElement | null;
  sliderWrapper: HTMLElement | null;
  sliderDots: NodeListOf<Element> | null;
  sliderDivider: Element | null;
  playButton: HTMLButtonElement | null;
  journeyButton: HTMLButtonElement | null;
  collectiblesButton: HTMLButtonElement | null;
  settingsButton: HTMLButtonElement | null;
  statsScreen: HTMLElement | null;
  statsBackButton: HTMLButtonElement | null;
  settingsScreen: HTMLElement | null;
  settingsBackButton: HTMLButtonElement | null;
  independentNav: HTMLElement | null;
}

class UIManager {
  private elements: UIManagerElements;
  private animations: Map<string, any>;
  private isInitialized: boolean;
  private logoFadeInStarted: boolean; // 🔥 PREMIUM: Track if logo fade-in has started

  constructor() {
    this.elements = {} as UIManagerElements;
    this.animations = new Map();
    this.isInitialized = false;
    this.logoFadeInStarted = false;
  }
  
  // Initialize UI elements
  init(): void {
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
        playButton: document.getElementById('btn-home') as HTMLButtonElement,
        journeyButton: (document.getElementById('btn-journey') || document.getElementById('btn-stats')) as HTMLButtonElement,
        collectiblesButton: document.getElementById('btn-collectibles') as HTMLButtonElement,
        settingsButton: document.getElementById('btn-settings') as HTMLButtonElement,
        statsScreen: document.getElementById('stats-screen'),
        statsBackButton: document.getElementById('stats-back-btn') as HTMLButtonElement,
        settingsScreen: document.getElementById('settings-screen'),
        settingsBackButton: document.getElementById('settings-back-btn') as HTMLButtonElement,
        independentNav: document.getElementById('independent-nav')
      };
      
      logger.info('🔍 Cached elements:', {
        home: !!this.elements.home,
        app: !!this.elements.app,
        playButton: !!this.elements.playButton
      });
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Subscribe to state changes
      this.setupStateSubscriptions();
      
      this.isInitialized = true;
      logger.info('✅ UI Manager initialized');
      
    } catch (error) {
      logger.error('❌ Failed to initialize UI Manager:', error);
      throw error;
    }
  }
  
  // Setup event listeners
  // 🔥 Helper method to reattach homepage button listeners (called after cleanup)
  private reattachHomepageButtonListeners(): void {
    // Also refresh element references to ensure we're using the latest DOM elements
    try {
      // Refresh element references
      this.elements.playButton = document.getElementById('btn-home') as HTMLButtonElement;
      this.elements.journeyButton = (document.getElementById('btn-journey') || document.getElementById('btn-stats')) as HTMLButtonElement;
      this.elements.collectiblesButton = document.getElementById('btn-collectibles') as HTMLButtonElement;
      this.elements.settingsButton = document.getElementById('btn-settings') as HTMLButtonElement;
      this.elements.statsBackButton = document.getElementById('stats-back-btn') as HTMLButtonElement;
      
      // Helper to add listener and track it (same as in setupEventListeners)
      const addTrackedListener = (element: HTMLElement, event: string, handler: EventListener) => {
        element.addEventListener(event, handler);
        if (!this.boundEventHandlers.has(element)) {
          this.boundEventHandlers.set(element, []);
        }
        this.boundEventHandlers.get(element)!.push({ event, handler });
      };
      
      // Always reattach - buttons might have been recreated or listeners cleared
      if (this.elements.playButton) {
        // Remove old listeners first if any
        if (this.boundEventHandlers.has(this.elements.playButton)) {
          const oldHandlers = this.boundEventHandlers.get(this.elements.playButton)!;
          oldHandlers.forEach(({ event, handler }) => {
            this.elements.playButton!.removeEventListener(event, handler);
          });
          this.boundEventHandlers.delete(this.elements.playButton);
        }
        const handler = this.handlePlayClick.bind(this);
        addTrackedListener(this.elements.playButton, 'click', handler);
        logger.info('✅ Play button event listener reattached');
      }
      
      if (this.elements.journeyButton) {
        if (this.boundEventHandlers.has(this.elements.journeyButton)) {
          const oldHandlers = this.boundEventHandlers.get(this.elements.journeyButton)!;
          oldHandlers.forEach(({ event, handler }) => {
            this.elements.journeyButton!.removeEventListener(event, handler);
          });
          this.boundEventHandlers.delete(this.elements.journeyButton);
        }
        const handler = this.handleStatsClick.bind(this);
        addTrackedListener(this.elements.journeyButton, 'click', handler);
        logger.info('✅ Journey button event listener reattached');
      }
      
      if (this.elements.collectiblesButton) {
        if (this.boundEventHandlers.has(this.elements.collectiblesButton)) {
          const oldHandlers = this.boundEventHandlers.get(this.elements.collectiblesButton)!;
          oldHandlers.forEach(({ event, handler }) => {
            this.elements.collectiblesButton!.removeEventListener(event, handler);
          });
          this.boundEventHandlers.delete(this.elements.collectiblesButton);
        }
        const handler = this.handleCollectiblesClick.bind(this);
        addTrackedListener(this.elements.collectiblesButton, 'click', handler);
        logger.info('✅ Collectibles button event listener reattached');
      }
      
      if (this.elements.settingsButton) {
        if (this.boundEventHandlers.has(this.elements.settingsButton)) {
          const oldHandlers = this.boundEventHandlers.get(this.elements.settingsButton)!;
          oldHandlers.forEach(({ event, handler }) => {
            this.elements.settingsButton!.removeEventListener(event, handler);
          });
          this.boundEventHandlers.delete(this.elements.settingsButton);
        }
        const handler = this.handleSettingsClick.bind(this);
        addTrackedListener(this.elements.settingsButton, 'click', handler);
        logger.info('✅ Settings button event listener reattached');
      }
      
      // Also reattach stats back button if needed
      if (this.elements.statsBackButton) {
        if (this.boundEventHandlers.has(this.elements.statsBackButton)) {
          const oldHandlers = this.boundEventHandlers.get(this.elements.statsBackButton)!;
          oldHandlers.forEach(({ event, handler }) => {
            this.elements.statsBackButton!.removeEventListener(event, handler);
          });
          this.boundEventHandlers.delete(this.elements.statsBackButton);
        }
        const handler = this.handleStatsBackClick.bind(this);
        addTrackedListener(this.elements.statsBackButton, 'click', handler);
        logger.info('✅ Stats back button event listener reattached');
      }
      
    } catch (error) {
      logger.warn('⚠️ Failed to reattach homepage button event listeners:', error);
    }
  }

  private setupEventListeners(): void {
    // 🔥 MEMORY LEAK FIX: Store bound handlers for cleanup
    // Helper to add listener and track it
    const addTrackedListener = (element: HTMLElement, event: string, handler: EventListener) => {
      element.addEventListener(event, handler);
      if (!this.boundEventHandlers.has(element)) {
        this.boundEventHandlers.set(element, []);
      }
      this.boundEventHandlers.get(element)!.push({ event, handler });
    };
    
    // Play button
    if (this.elements.playButton) {
      const handler = this.handlePlayClick.bind(this);
      addTrackedListener(this.elements.playButton, 'click', handler);
    }
    
    // Journey button (was stats)
    if (this.elements.journeyButton) {
      const handler = this.handleStatsClick.bind(this);
      addTrackedListener(this.elements.journeyButton, 'click', handler);
    }
    
    // Collectibles button
    if (this.elements.collectiblesButton) {
      const handler = this.handleCollectiblesClick.bind(this);
      addTrackedListener(this.elements.collectiblesButton, 'click', handler);
    } else {
      console.warn('⚠️ Collectibles button not found! btn-collectibles element missing');
    }
    
    // Settings button
    if (this.elements.settingsButton) {
      const handler = this.handleSettingsClick.bind(this);
      addTrackedListener(this.elements.settingsButton, 'click', handler);
    }
    
    if (this.elements.statsBackButton) {
      const handler = this.handleStatsBackClick.bind(this);
      addTrackedListener(this.elements.statsBackButton, 'click', handler);
    }
    
    // 🔥 DIFFERENT APPROACH: Use event delegation on settings screen container
    // This ensures back button works even if element is recreated or not found during init
    if (this.elements.settingsScreen) {
      const handler = (e: Event) => {
        const target = e.target as HTMLElement;
        const backBtn = target.closest('#settings-back-btn, .settings-back-button');
        if (backBtn) {
          e.preventDefault();
          e.stopPropagation();
          this.handleSettingsBackClick(e);
        }
      };
      addTrackedListener(this.elements.settingsScreen, 'click', handler);
      logger.info('✅ Settings back button handler attached via event delegation');
    } else {
      // Fallback: try to attach directly if button exists
      if (this.elements.settingsBackButton) {
        const handler = this.handleSettingsBackClick.bind(this);
        addTrackedListener(this.elements.settingsBackButton, 'click', handler);
      }
    }
    
    // Setup settings toggles
    this.setupSettingsToggles();
  }
  
  // 🔥 MEMORY LEAK FIX: Store unsubscribe functions for cleanup
  private unsubscribeFunctions: (() => void)[] = [];
  private boundEventHandlers: Map<HTMLElement, Array<{ event: string; handler: EventListener }>> = new Map();
  
  // Setup state subscriptions
  private setupStateSubscriptions(): void {
    // 🔥 MEMORY LEAK FIX: Store unsubscribe functions
    // Homepage visibility
    const unsubscribeHomepageReady = gameState.subscribe('homepageReady', (isReady: boolean) => {
      if (isReady) {
        this.showHomepage();
      }
    });
    this.unsubscribeFunctions.push(unsubscribeHomepageReady);
    
    // Game active state
    const unsubscribeGameActive = gameState.subscribe('isGameActive', (isActive: boolean) => {
      if (isActive) {
        this.hideHomepage();
      } else {
        this.showHomepage();
      }
    });
    this.unsubscribeFunctions.push(unsubscribeGameActive);
    
    // Slider locked state
    const unsubscribeSliderLocked = gameState.subscribe('sliderLocked', (isLocked: boolean) => {
      this.updateSliderLockState(isLocked);
    });
    this.unsubscribeFunctions.push(unsubscribeSliderLocked);
  }
  
  // Handle play button click
  private async handlePlayClick(event: Event): Promise<void> {
    event.preventDefault();
    logger.info('🎮 Play button clicked');
    
    // Light haptic for Play button (same as other slider CTA buttons)
    if (typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact('light');
    }
    
    // Check for saved game (starts exit animation)
    this.checkForSavedGame();
  }
  
  // Reset all slider buttons to prevent :active state persistence
  private resetAllSliderButtons(): void {
    console.log('🔧 DEBUG: resetAllSliderButtons called');
    // Get both old .slide-button AND new .primary-button elements
    const sliderButtons = document.querySelectorAll('.slider-slide .slide-button, .slider-slide .primary-button');
    console.log('🔧 DEBUG: Found', sliderButtons.length, 'slider buttons');
    
    // 🔥 iPad FIX: Detect iPad to preserve translateY positioning
    const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;
    
    sliderButtons.forEach((button, index) => {
      const btn = button as HTMLElement;
      console.log(`🔧 DEBUG: Resetting button ${index}:`, btn.id, 'classes:', btn.className);
      
      // 🔥 iPad FIX: Preserve translateY on iPad, only reset scale
      if (isIPad) {
        // On iPad, preserve translateY(0px) and only reset scale
        btn.style.transform = 'translateY(0px) scale(1)';
        btn.style.webkitTransform = 'translateY(0px) scale(1)';
      } else {
        // On iPhone, use original behavior
        btn.style.transform = 'scale(1) !important';
      }
      btn.style.transition = 'none !important';
      btn.style.webkitTransition = 'none !important';
      
      // Temporarily disable pointer events for very short time
      btn.style.pointerEvents = 'none';
      btn.classList.add('button-reset');
      
      try { btn.blur(); } catch {}
      
      // Force reflow to apply styles
      void btn.offsetHeight;
      
      setTimeout(() => {
        if (!btn) return;
        btn.classList.remove('button-reset');
        btn.style.pointerEvents = '';
        
        // 🔥 iPad FIX: Preserve translateY on iPad, only reset scale
        if (isIPad) {
          btn.style.transform = 'translateY(0px) scale(1)';
          btn.style.webkitTransform = 'translateY(0px) scale(1)';
        } else {
          btn.style.transform = 'scale(1) !important';
        }
        btn.style.transition = 'none !important';
        btn.style.webkitTransition = 'none !important';
        
        console.log(`🔧 DEBUG: Reset complete for button ${index}:`, btn.id);
      }, 50);
    });
    logger.info('🔧 All slider buttons reset');
  }
  
  // Handle stats button click
  private handleStatsClick(event: Event): void {
    event.preventDefault();
    logger.info('🗺️ Journey button clicked (opens Journey screen)');
    
    // Light haptic for Stats button
    if (typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact('light');
    }
    
    // NO RESET - let :active work normally like Play button
    
    // Play exit animation first, then show collectibles screen (swapped)
    this.showCollectiblesScreenWithAnimation();
  }

  private handleStatsBackClick(event: Event): void {
    event.preventDefault();
    logger.info('📊 Stats back button clicked');
    
    // Play enter animation, then hide stats screen
    this.hideStatsScreenWithAnimation();
  }
  
  // Handle collectibles button click
  private handleCollectiblesClick(event: Event): void {
    event.preventDefault();
    logger.info('🎁 Collectibles button clicked (Collectibles -> Stats)');
    
    // Light haptic for Collectibles button
    if (typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact('light');
    }
    
    // NO RESET - let :active work normally
    
    // Play exit animation first, then show stats screen (swapped)
    this.showStatsScreenWithAnimation();
  }
  
  // Handle settings button click
  private handleSettingsClick(event: Event): void {
    event.preventDefault();
    logger.info('⚙️ Settings button clicked');
    
    // Light haptic for Settings button
    if (typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact('light');
    }
    
    // Show settings screen with animation
    this.showSettingsScreenWithAnimation();
  }
  
  // Check for saved game
  private async checkForSavedGame(): Promise<void> {
    try {
      logger.info('🔍 Checking for saved game...');
      const savedGame = localStorage.getItem('cc_saved_game');
      const completionState = localStorage.getItem('cc_board_completed');
      let hasFreshCompletion = false;
      if (completionState) {
        try {
          const state = JSON.parse(completionState);
          const ageMs = Date.now() - (Number(state.timestamp) || 0);
          hasFreshCompletion = Number.isFinite(ageMs) && ageMs < 60 * 60 * 1000;
          if (!hasFreshCompletion) {
            localStorage.removeItem('cc_board_completed');
          }
        } catch (error) {
          localStorage.removeItem('cc_board_completed');
        }
      }
      logger.info('🔍 Saved game found:', !!savedGame, 'Completion pending:', hasFreshCompletion);
      
      // Show resume sheet if saved game exists OR a fresh clean-board completion exists
      if (savedGame || hasFreshCompletion) {
        logger.info('📱 Showing resume game bottom sheet...');
        // Show resume game modal IMMEDIATELY - no async import delay
        showResumeGameBottomSheet();
      } else {
        logger.info('🎮 No saved game, starting new game with animation...');
        // Start new game with animation via triggerGameStartSequence
        if ((window as any).triggerGameStartSequence) {
          (window as any).triggerGameStartSequence();
        } else {
          // Fallback: direct start if trigger not available
          this.startNewGame();
        }
      }
    } catch (error) {
      logger.error('❌ Failed to check for saved game:', error);
      // Fallback to new game with animation
      if ((window as any).triggerGameStartSequence) {
        (window as any).triggerGameStartSequence();
      } else {
        this.startNewGame();
      }
    }
  }
  
  // Start new game (public method) - ALWAYS starts from Board 1
  async startNewGame(): Promise<void> {
    memoryManager.start();
    // 🔥 USER REQUEST: Mark that we came from homepage (not Journey)
    (window as any).__ccCameFromHomepage = true;
    (window as any).__ccCameFromJourney = false;
    logger.info('🏠 Marked as coming from homepage (startNewGame)');
    try {
      console.log('🎮 ====================================');
      console.log('🎮 START NEW GAME CALLED (Board 1)');
      console.log('🎮 ====================================');
      logger.info('🎮 Starting new game from Board 1...');
      
      // 🔥 JOURNEY PROGRESSION: Reset Journey progression state for New Game
      const { journeyProgressionState } = await import('./journey-progression-state.js');
      journeyProgressionState.reset(); // Clear lastOpened and currentRun
      journeyProgressionState.setLastOpenedBoardId(1); // Set to Board 1
      journeyProgressionState.setCurrentRunState(1, 0); // Start new run for Board 1
      
      // Set game state
      gameState.setState({
        isGameActive: true,
        isPaused: false,
        isGameEnded: false,
        score: 0,
        level: 1,
        combo: 0
      });
      
      console.log('✅ Game state set');
      
      // Clear old saved game state for new game
      console.log('🧹 Clearing old saved game state...');
      localStorage.removeItem('cc_saved_game');
      localStorage.removeItem('cc_board_completed');
      localStorage.removeItem('cubeCrash_gameState');
      console.log('✅ Old saved game cleared');
      
      // Start game
      console.log('🎯 Starting game boot...');
      try {
        // Use static import instead of dynamic import for instant response
        console.log('✅ app-core already available (static import)');
        
        await bootGame();
        console.log('✅ boot() complete');
        
        // layout() is synchronous, no await needed
        layoutGame();
        console.log('✅ layout() complete');
        
        // Start time tracking
        if (typeof (window as any).startTimeTracking === 'function') {
          (window as any).startTimeTracking();
          console.log('⏱️ Time tracking started');
        }
        
        // 🔥 CRITICAL FIX: Ensure canvas is visible before showing app element
        // Canvas should already be in DOM from boot(), but we need to ensure it's visible
        try {
          const appElement = document.getElementById('app');
          if (appElement) {
            const canvas = appElement.querySelector('canvas');
            if (canvas) {
              canvas.style.display = 'block';
              canvas.style.visibility = 'visible';
              canvas.style.opacity = '1';
              console.log('✅ Canvas made visible before showApp()');
            } else {
              console.warn('⚠️ Canvas not found in app element before showApp()');
            }
          }
        } catch (e) {
          console.warn('⚠️ Failed to ensure canvas visibility before showApp():', e);
        }
        
        // Show app element
        console.log('📱 Showing app element...');
        this.showApp();
        console.log('✅ App element shown');
        
        console.log('🎮 ====================================');
        console.log('🎮 GAME STARTED SUCCESSFULLY');
        console.log('🎮 ====================================');
      
      } catch (error) {
        console.error('❌ Game boot failed:', error);
        logger.error('❌ Failed to start game:', error);
        throw error;
      }
      
    } catch (error) {
      console.error('❌ Failed to start new game:', error);
      logger.error('❌ Failed to start new game:', error);
    }
  }
  
  // Start new game with saved state (for Continue button)
  async startNewGameWithSavedState(): Promise<void> {
    try {
      console.log('🔄 ====================================');
      console.log('🔄 START NEW GAME WITH SAVED STATE');
      console.log('🔄 ====================================');
      logger.info('🔄 Starting new game WITH saved state...');
      
      // Check if a clean-board completion was pending (hard-exit case)
      const completedState = localStorage.getItem('cc_board_completed');
      if (completedState) {
        try {
          const state = JSON.parse(completedState);
          const resumeLevel = Number(state.nextLevel) || 2;
          const baseScore = Number(state.score) || 0;
          const bonusScore = Number(state.bonus) || 0;
          const resumeScore = Number(state.finalScore ?? (baseScore + bonusScore)) || 0;
          logger.info('🎮 Pending completion detected - starting next board', resumeLevel, 'with score', resumeScore);
          
          // Clear completion state up front so we don't get stuck
          localStorage.removeItem('cc_board_completed');
          localStorage.removeItem('cc_saved_game');
          localStorage.removeItem('cubeCrash_gameState');
          
          // Set flags for boot/startLevel
          (window as any).__ccStartAtLevel = resumeLevel;
          (window as any).__ccResumeScore = resumeScore;
          
          // Set game state
          gameState.setState({
            isGameActive: true,
            isPaused: false,
            isGameEnded: false,
            score: resumeScore,
            level: resumeLevel,
            combo: 0
          });
          
          await bootGame();
          await layoutGame();
          
          // Flags consumed by startLevel; clear them after boot
          delete (window as any).__ccStartAtLevel;
          delete (window as any).__ccResumeScore;
          
          // Show app element
          this.showApp();
          
          console.log('🔄 ====================================');
          console.log('🔄 NEXT BOARD STARTED (clean-board resume)');
          console.log('🔄 ====================================');
          
          return;
        } catch (error) {
          console.warn('⚠️ Failed to resume from completion state, falling back to normal flow:', error);
          // Clear corrupted flag
          localStorage.removeItem('cc_board_completed');
        }
      }
      
      // Set game state
      gameState.setState({
        isGameActive: true,
        isPaused: false,
        isGameEnded: false,
        score: 0,
        level: 1,
        combo: 0
      });
      console.log('✅ Game state set');
      
      // Start game
      console.log('🎯 Starting game boot...');
      try {
        // Use static import instead of dynamic import for instant response
        console.log('✅ app-core already available (static import)');
        
        await bootGame();
        console.log('✅ boot() complete');
        
        await layoutGame();
        console.log('✅ layout() complete');
        
        // Load saved game state AFTER boot/layout
        const loadGameState = (window as any).loadGameState;
        if (typeof loadGameState === 'function') {
          console.log('🔄 Loading saved game state...');
          const loaded = await loadGameState();
          if (loaded) {
            console.log('✅ Saved game state loaded');
          } else {
            console.warn('⚠️ Failed to load saved game');
          }
        } else {
          console.error('❌ loadGameState function not found');
        }
        
        // Show app element AFTER loading saved state
        console.log('📱 Showing app element...');
        this.showApp();
        console.log('✅ App element shown');
        
        console.log('🔄 ====================================');
        console.log('🔄 GAME WITH SAVED STATE STARTED');
        console.log('🔄 ====================================');
        
      } catch (error) {
        console.error('❌ Game boot failed:', error);
        logger.error('❌ Failed to start game with saved state:', error);
        throw error;
      }
      
    } catch (error) {
      logger.error('❌ Failed to start new game with saved state:', error);
    }
  }
  
  // Show homepage
  showHomepage(): void {
    logger.info('🏠 showHomepage() called');
    
    // 🔥 CRITICAL: ALWAYS set paper background to 60% opacity when showing homepage
    // This ensures paper bg is visible on homepage, even if it was set to 35% in board game
    applyPaperBackground('0.6');
    this.elements.home?.style.setProperty('--paper-alpha', '0.6');
    
    if (this.elements.home) {
      this.elements.home.style.display = 'block';
      this.elements.home.removeAttribute('hidden');
      fadeInHome();
    }
    
    // 🔥 NEW API: Ensure slider is ready for interaction
    // Use imported sliderManager directly (not window reference)
    if (sliderManager && typeof sliderManager.ensureReady === 'function') {
      sliderManager.ensureReady();
      logger.info('✅ Slider ensureReady() called in showHomepage() - slider ready');
    } else {
      // Fallback: Reset pointer events manually
      const sliderContainer = document.getElementById('slider-container');
      if (sliderContainer) {
        sliderContainer.style.pointerEvents = '';
      }
    }
    
    // 🔥 FIX: Explicitly show and enable navigation (independent-nav)
    const independentNav = document.getElementById('independent-nav');
    if (independentNav) {
      independentNav.style.removeProperty('display');
      independentNav.style.removeProperty('visibility');
      independentNav.style.removeProperty('opacity');
      independentNav.style.removeProperty('pointer-events');
      independentNav.style.display = 'block';
      independentNav.style.visibility = 'visible';
      independentNav.style.opacity = '1';
      independentNav.style.pointerEvents = 'auto';
      independentNav.setAttribute('aria-hidden', 'false');
      logger.info('✅ Independent navigation shown and enabled in showHomepage');
    }

    // 🔥 CRITICAL: Ensure #global-bg exists (create if missing)
      let globalBg = document.getElementById('global-bg');
      if (!globalBg) {
        logger.info('🔧 Creating #global-bg element (not found in DOM)');
        globalBg = document.createElement('div');
        globalBg.id = 'global-bg';
        globalBg.style.position = 'fixed';
        globalBg.style.top = 'calc(-1 * env(safe-area-inset-top, 0px))';
        globalBg.style.bottom = 'calc(-1 * env(safe-area-inset-bottom, 0px))';
        globalBg.style.left = '-12vw';
        globalBg.style.right = '-12vw';
        globalBg.style.pointerEvents = 'none';
        globalBg.style.zIndex = '-1';
        if (document.body.firstChild) {
          document.body.insertBefore(globalBg, document.body.firstChild);
        } else {
          document.body.appendChild(globalBg);
        }
      // applyPaperBackground() already set the background, but ensure it's set here too
      (globalBg as HTMLElement).style.setProperty('background-color', '#f3eee8', 'important');
      (globalBg as HTMLElement).style.setProperty('background-image', PAPER_BG_IMAGE, 'important');
      (globalBg as HTMLElement).style.setProperty('background-size', '100% 100%', 'important');
      (globalBg as HTMLElement).style.setProperty('background-repeat', 'no-repeat', 'important');
      (globalBg as HTMLElement).style.setProperty('background-position', 'center', 'important');
      logger.info('✅ #global-bg created and paper background set');
    }
    
    // 🔥 CRITICAL: applyPaperBackground('0.6') already set paper bg to 60% opacity
    // No need to set it again - the function handles everything with !important flags
    
    // 🗺️ JOURNEY BADGE: Update badge when returning to homepage
    // Show NEWLY unlocked boards count (excluding board 1 and already viewed boards) as badge
    // This ensures badge only shows boards that haven't been viewed yet
    import('./journey-boards-manager.js').then(({ journeyBoardsManager }) => {
      try {
        // 🔥 USER BUG FIX: Sync journey boards with current game progress first
        // This ensures board states are up to date before calculating badge count
        journeyBoardsManager.syncWithGameProgress();
        
        const newlyUnlockedCount = journeyBoardsManager.getNewlyUnlockedCount();
        // Keep badge persistent if previously higher (e.g., after navigation rebuild)
        const lastBadge = (window as any).__ccJourneyBadgeCount || 0;
        const effectiveCount = Math.max(lastBadge, newlyUnlockedCount);
        if (typeof (window as any).updateNavBadge === 'function') {
          (window as any).updateNavBadge(effectiveCount, 1); // Pass slideIndex 1 for Journey
          logger.debug(`🗺️ Journey badge updated on homepage: ${effectiveCount} newly unlocked boards (not yet viewed, raw=${newlyUnlockedCount}, last=${lastBadge})`);
        }
      } catch (error) {
        logger.warn('⚠️ Failed to update journey badge on homepage:', error);
      }
    }).catch((error) => {
      logger.warn('⚠️ Failed to import journey boards manager on homepage:', error);
    });
  }
  
  // Hide homepage
  hideHomepage(): void {
    // 🔥 MEMORY LEAK FIX: Cleanup all animations before hiding homepage
    (async () => {
      // 1. Cleanup animation timeouts
      try {
        const { cleanupAnimations } = await import('../utils/animations.js');
        if (cleanupAnimations) {
          cleanupAnimations();
          logger.info('🧹 Homepage animation timeouts cleaned up');
        }
      } catch (error) {
        logger.warn('⚠️ Failed to cleanup homepage animation timeouts:', error);
      }
      
      // 2. Kill GSAP animations on homepage elements
      try {
        const gsap = (window as any).gsap;
        if (gsap && this.elements.home) {
          // Kill animations on all homepage elements
          const homepageElements = this.elements.home.querySelectorAll('*');
          homepageElements.forEach((el: Element) => {
            try {
              gsap.killTweensOf(el);
            } catch {}
          });
          
          // Kill animations on slider elements
          const sliderWrapper = document.getElementById('slider-wrapper');
          const sliderContainer = document.getElementById('slider-container');
          if (sliderWrapper) gsap.killTweensOf(sliderWrapper);
          if (sliderContainer) gsap.killTweensOf(sliderContainer);
          
          // Kill animations on navigation elements
          const navButtons = document.querySelectorAll('.independent-nav-button');
          navButtons.forEach(btn => {
            gsap.killTweensOf(btn);
            const img = btn.querySelector('img');
            if (img) gsap.killTweensOf(img);
          });
          
          logger.info('🧹 Homepage GSAP animations killed');
        }
      } catch (gsapError) {
        logger.warn('⚠️ Failed to cleanup homepage GSAP animations:', gsapError);
      }
      
      // 3. Stop CSS infinite animations (working-shimmer, cta-shimmer)
      if (this.elements.home) {
        const shimmerElements = this.elements.home.querySelectorAll('[class*="::after"], .slide-button, .continue-btn, .new-game-btn, .restart-btn, .exit-btn, .menu-btn-primary');
        shimmerElements.forEach((el: Element) => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.style) {
            // Stop CSS animations by removing animation property
            htmlEl.style.animation = 'none';
            htmlEl.style.animationPlayState = 'paused';
          }
        });
        
        // Also stop shimmer on buttons with ::after pseudo-elements
        const buttons = this.elements.home.querySelectorAll('button, .slide-button, .continue-btn, .new-game-btn, .restart-btn, .exit-btn');
        buttons.forEach((btn: Element) => {
          const htmlBtn = btn as HTMLElement;
          if (htmlBtn.style) {
            htmlBtn.style.animation = 'none';
            htmlBtn.style.animationPlayState = 'paused';
          }
        });
        
        logger.info('🧹 Homepage CSS infinite animations stopped');
      }
      
      // 4. Destroy slider manager (cleanup event listeners and animations)
      try {
        const { default: sliderManager } = await import('./slider-manager.js');
        if (sliderManager && typeof sliderManager.destroy === 'function') {
          sliderManager.destroy();
          logger.info('🧹 Slider manager destroyed');
        }
      } catch (sliderError) {
        logger.warn('⚠️ Failed to destroy slider manager:', sliderError);
      }
      
      // 5. Unsubscribe from gameState subscriptions
      try {
        this.unsubscribeFunctions.forEach(unsubscribe => {
          try {
            unsubscribe();
          } catch (e) {}
        });
        this.unsubscribeFunctions = [];
        logger.info('🧹 GameState subscriptions unsubscribed');
      } catch (error) {
        logger.warn('⚠️ Failed to unsubscribe from gameState:', error);
      }
      
      // 6. Remove event listeners
      try {
        this.boundEventHandlers.forEach((handlers, element) => {
          handlers.forEach(({ event, handler }) => {
            try {
              element.removeEventListener(event, handler);
            } catch (e) {}
          });
        });
        this.boundEventHandlers.clear();
        logger.info('🧹 Event listeners removed');
      } catch (error) {
        logger.warn('⚠️ Failed to remove event listeners:', error);
      }
      
      // 6b. Remove settings toggle handlers
      try {
        this.settingsToggleHandlers.forEach((handlers, element) => {
          handlers.forEach(({ event, handler }) => {
            try {
              element.removeEventListener(event, handler);
            } catch (e) {}
          });
        });
        this.settingsToggleHandlers.clear();
        logger.info('🧹 Settings toggle handlers removed');
      } catch (error) {
        logger.warn('⚠️ Failed to remove settings toggle handlers:', error);
      }
      
      // 7. Cleanup animation manager
      try {
        const { default: animationManager } = await import('./animation-manager.js');
        if (animationManager && typeof animationManager.destroy === 'function') {
          animationManager.destroy();
          logger.info('🧹 Animation manager destroyed');
        }
      } catch (error) {
        logger.warn('⚠️ Failed to destroy animation manager:', error);
      }
    })().catch((error) => {
      logger.warn('⚠️ Failed to execute homepage cleanup:', error);
    });
    
    if (this.elements.home) {
      // NO OPACITY FADE - just hide immediately after scale animation completes
      this.elements.home.style.display = 'none';
      this.elements.home.setAttribute('hidden', 'true');
      logger.info('✅ Homepage hidden (no opacity fade)');
    }
  }
  
  // Show app element
  showApp(): void {
    const appElement = document.getElementById('app');
    if (appElement) {
      // 🔥 CRITICAL: Ensure board game uses 35% paper opacity
      applyPaperBackground('0.35');
      // 🔥 CRITICAL FIX: DO NOT remove canvas elements here - boot() already added the canvas
      // Removing canvas here would remove the canvas that boot() just added!
      // Only remove canvas if app is not booted yet (which shouldn't happen)
      
      appElement.removeAttribute('hidden');
      appElement.style.display = 'block';
      appElement.style.opacity = '1';
      appElement.style.visibility = 'visible';
      appElement.style.position = 'fixed';
      appElement.style.top = '0';
      appElement.style.left = '0';
      appElement.style.width = '100%';
      appElement.style.height = '100%';
      appElement.style.zIndex = '1';
      logger.info('✅ App element shown');
      
      // Ensure canvas is visible when present (may be missing if showApp runs before boot, e.g. Journey continue)
      let canvas = appElement.querySelector('canvas') ?? null;
      if (!canvas) {
        const app = (window as any).CC?.app;
        const c = app?.canvas;
        if (c) {
          if (!c.parentElement) appElement.appendChild(c);
          canvas = c;
        }
      }
      if (canvas) {
        canvas.style.display = 'block';
        canvas.style.visibility = 'visible';
        canvas.style.opacity = '1';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '1';
        canvas.style.pointerEvents = 'auto';
      }
    } else {
      logger.error('❌ App element not found!');
    }
    
    // 🔥 CRITICAL FIX: Ensure board and HUD are visible when showing app
    // This fixes the issue where board is hidden after cleanup and not restored
    try {
      // Access board and hud from window.CC if available
      const gameState = (window as any).CC;
      if (gameState) {
        if (gameState.board) {
          gameState.board.visible = true;
          gameState.board.alpha = 1;
          gameState.board.renderable = true;
          logger.info('✅ Board made visible in showApp()');
        }
        if (gameState.hud) {
          gameState.hud.visible = true;
          gameState.hud.alpha = 1;
          gameState.hud.renderable = true;
          logger.info('✅ HUD made visible in showApp()');
        }
        // Also call showGameUI if available
        if (typeof gameState.showGameUI === 'function') {
          gameState.showGameUI();
          logger.info('✅ showGameUI() called in showApp()');
        }
      }
    } catch (e) {
      logger.warn('⚠️ Failed to ensure board/HUD visibility in showApp():', e);
    }
    
    // Hide navigation when entering game
    this.hideNavigation();
  }
  
  // Hide navigation
  hideNavigation(): void {
    const navElement = document.querySelector('nav');
    if (navElement) {
      navElement.style.display = 'none';
      logger.info('✅ Navigation hidden');
    }
  }
  
  // Show navigation
  showNavigation(): void {
    const navElement = document.getElementById('independent-nav');
    if (navElement) {
      // Remove !important styles that might have been set
      navElement.style.removeProperty('display');
      navElement.style.removeProperty('visibility');
      navElement.style.removeProperty('opacity');
      navElement.style.display = 'block';
      navElement.style.visibility = 'visible';
      navElement.style.opacity = '1';
      navElement.setAttribute('aria-hidden', 'false');
      logger.info('✅ Navigation shown');
    }
  }
  
  // Hide app element
  hideApp(): void {
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.setAttribute('hidden', 'true');
      appElement.style.display = 'none';
      appElement.style.opacity = '0';
      appElement.style.visibility = 'hidden';
      // 🔥 USER BUG FIX: Set z-index to very low to ensure it's behind everything
      appElement.style.zIndex = '-1';
      appElement.style.position = 'fixed';
      appElement.style.top = '0';
      appElement.style.left = '0';
      appElement.style.width = '100%';
      appElement.style.height = '100%';
      logger.info('✅ App element hidden');
    }
    
    // 🔥 CRITICAL FIX: Hide ALL canvas elements explicitly
    // This prevents canvas from showing on top of homepage/slider
    try {
      // Hide canvas in app element
      const canvas = document.querySelector('#app canvas');
      if (canvas && canvas instanceof HTMLElement) {
        canvas.style.display = 'none';
        canvas.style.visibility = 'hidden';
        canvas.style.opacity = '0';
        canvas.style.zIndex = '-1';
        canvas.style.pointerEvents = 'none';
        logger.info('✅ Canvas element hidden and disabled');
      }
      
      // Also hide any canvas elements in body (stray canvases)
      const bodyCanvases = document.body.querySelectorAll('canvas');
      bodyCanvases.forEach(canvas => {
        if (canvas instanceof HTMLElement) {
          canvas.style.display = 'none';
          canvas.style.visibility = 'hidden';
          canvas.style.opacity = '0';
          canvas.style.zIndex = '-1';
          canvas.style.pointerEvents = 'none';
        }
      });
      if (bodyCanvases.length > 0) {
        logger.info(`✅ Hidden ${bodyCanvases.length} stray canvas element(s)`);
      }
    } catch (error) {
      logger.warn('⚠️ Failed to hide canvas element:', error);
    }
    
    // 🔥 CRITICAL FIX: Also hide HUD container and board indicator
    try {
      const hudContainer = document.getElementById('hud-container');
      if (hudContainer) {
        hudContainer.style.display = 'none';
        hudContainer.style.visibility = 'hidden';
        hudContainer.style.opacity = '0';
        hudContainer.style.zIndex = '-1';
        hudContainer.style.pointerEvents = 'none';
        logger.info('✅ HUD container hidden');
      }
      
      const boardIndicator = document.getElementById('hud-board');
      if (boardIndicator) {
        boardIndicator.style.display = 'none';
        boardIndicator.style.visibility = 'hidden';
        boardIndicator.style.opacity = '0';
        boardIndicator.style.zIndex = '-1';
        boardIndicator.style.pointerEvents = 'none';
        logger.info('✅ Board indicator hidden');
      }
    } catch (error) {
      logger.warn('⚠️ Failed to hide HUD elements:', error);
    }
    
    // 🔥 USER BUG FIX: Stop any pending endgame checks when app is hidden
    // This prevents clean board modal from appearing when user navigates away from game
    try {
      // Kill checkLevelEnd timer if it exists
      if ((window as any).checkLevelEndTimer) {
        try {
          (window as any).checkLevelEndTimer?.kill?.();
          (window as any).checkLevelEndTimer = null;
          logger.info('✅ checkLevelEnd timer killed when app is hidden');
        } catch (e) {
          logger.warn('⚠️ Failed to kill checkLevelEnd timer:', e);
        }
      }
    } catch (error) {
      logger.warn('⚠️ Failed to stop checkLevelEnd timer:', error);
    }
    
    // 🔥 USER BUG FIX: Also ensure board and HUD are hidden when app is hidden
    // This prevents board parts from showing over homepage/journey screen
    try {
      if (typeof (window as any).drawBoardBG === 'function') {
        (window as any).drawBoardBG('none');
      }
      
      // Hide PIXI board and HUD if they exist
      // Use window.STATE instead of require to avoid module loading issues
      const STATE = (window as any).STATE || (window as any).CC?.STATE;
      if (STATE?.board) {
        STATE.board.visible = false;
      }
      if (STATE?.hud) {
        STATE.hud.visible = false;
      }
      
      // Also try to hide via app if it exists
      const app = (window as any).app || STATE?.app;
      if (app && app.stage) {
        app.stage.visible = false;
      }
      
      logger.info('✅ Board and HUD hidden when app is hidden');
    } catch (error) {
      logger.warn('⚠️ Failed to hide board/HUD when app is hidden:', error);
    }
  }
  
  // Show homepage with animation
  showHomepageWithAnimation(): void {
    if (this.elements.home) {
      this.elements.home.style.display = 'block';
      this.elements.home.removeAttribute('hidden');
      // NO OPACITY TRANSITION - animateSliderEnter will handle it
      this.elements.home.style.opacity = '1';
      this.elements.home.style.transition = 'none';
      logger.info('✅ Homepage shown, ready for slider enter animation');
    }
    
    // 🔥 CRITICAL: Reset background to gradient when showing homepage with animation
    // This ensures homepage always has gradient background, not solid color
    const body = document.body;
    const globalBg = document.getElementById('global-bg');
    const appElement = document.getElementById('app');
    const targetGradient = PAPER_BG_STYLE;
    const targetGlobalBgGradient = PAPER_BG_STYLE;
    
    if (gsap && body) {
      gsap.killTweensOf(body);
      body.style.transition = 'none';
      gsap.set(body, { background: targetGradient });
    }
    if (gsap && globalBg) {
      gsap.killTweensOf(globalBg);
      (globalBg as HTMLElement).style.transition = 'none';
      gsap.set(globalBg, { background: targetGlobalBgGradient });
    }
    if (gsap && appElement) {
      gsap.killTweensOf(appElement);
      appElement.style.transition = 'none';
      gsap.set(appElement, { background: PAPER_BG_STYLE });
    }
  }
  
  // Show homepage QUIETLY - no animations, just show it (for exit flow)
  showHomepageQuietly(): void {
    applyPaperBackground('0.6');
    this.elements.home?.style.setProperty('--paper-alpha', '0.6');
    if (this.elements.home) {
      this.elements.home.style.display = 'block';
      this.elements.home.removeAttribute('hidden');
      
      // 🔥 CRITICAL FIX: Explicitly ensure slider container is visible
      // This undoes the inline styles set in exitToMenu when returning to Journey screen
      // Without this, slider container may have display:none, visibility:hidden, etc.
      const sliderContainer = document.getElementById('slider-container');
      if (sliderContainer) {
        sliderContainer.style.display = 'block';
        sliderContainer.style.visibility = 'visible';
        sliderContainer.style.opacity = '1';
        sliderContainer.style.zIndex = '';
        sliderContainer.style.pointerEvents = 'auto';
        logger.info('✅ Slider container visibility explicitly restored in showHomepageQuietly');
      }
      
      // 🔥 USER REQUEST FIX: Reset slider enter animation flag BEFORE reinitializing
      // This prevents instant slide changes (no animation) when clicking dots after returning to homepage
      // Without this, __ccIsAnimatingSliderEnter might be true from previous animation, causing instant jumps
      (window as any).__ccIsAnimatingSliderEnter = false;
      logger.info('✅ Reset __ccIsAnimatingSliderEnter flag before slider reinit');
      
      // 🔥 NEW API: Ensure slider is ready for interaction
      // Unlocks slider, ensures pointer events, refreshes element references
      try {
        if (sliderManager && typeof sliderManager.ensureReady === 'function') {
          sliderManager.ensureReady();
          logger.info('✅ Slider ensureReady() called in showHomepageQuietly - slider ready');
        } else if (sliderManager && typeof sliderManager.init === 'function') {
          // Fallback: Full reinitialize if ensureReady not available
          sliderManager.init();
          logger.info('✅ Slider manager reinitialized in showHomepageQuietly (fallback)');
        }
      } catch (error) {
        logger.warn('⚠️ Failed to ensure slider ready:', error);
      }
      
      // 🔥 FIX: Explicitly show and enable navigation (independent-nav)
      // Navigation might have been hidden or pointer-events disabled during game
      const independentNav = document.getElementById('independent-nav');
      if (independentNav) {
        independentNav.style.removeProperty('display');
        independentNav.style.removeProperty('visibility');
        independentNav.style.removeProperty('opacity');
        independentNav.style.removeProperty('pointer-events');
        independentNav.style.display = 'block';
        independentNav.style.visibility = 'visible';
        independentNav.style.opacity = '1';
        independentNav.style.pointerEvents = 'auto';
        independentNav.setAttribute('aria-hidden', 'false');
        logger.info('✅ Independent navigation shown and enabled in showHomepageQuietly');
      }
      
      // 🔥 FIX: Ensure all navigation buttons are clickable
      const navButtons = document.querySelectorAll('.independent-nav-button');
      navButtons.forEach((button) => {
        const btn = button as HTMLElement;
        btn.style.pointerEvents = 'auto';
        btn.style.cursor = 'pointer';
      });
      if (navButtons.length > 0) {
        logger.info(`✅ ${navButtons.length} navigation buttons enabled in showHomepageQuietly`);
      }
      
      // 🔥 CRITICAL FIX: Reattach event listeners to homepage buttons
      // Event listeners were removed in hideHomepage(), so we need to reattach them
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        this.reattachHomepageButtonListeners();
      });
      
      // 🔥 USER BUG FIX: Update Journey badge when showing homepage quietly
      // This ensures badge is always up-to-date when homepage is displayed (e.g., after Journey screen)
      setTimeout(() => {
        import('./journey-boards-manager.js').then(({ journeyBoardsManager }) => {
          try {
            // Sync journey boards with current game progress first
            journeyBoardsManager.syncWithGameProgress();
            
            const newlyUnlockedCount = journeyBoardsManager.getNewlyUnlockedCount();
            // 🔒 Preserve any pending badge count already cached so we don't accidentally wipe it
            // (exit animations or intermediate calls can briefly compute 0 while animations are running)
            const lastBadge = (window as any).__ccJourneyBadgeCount || 0;
            const effectiveCount = Math.max(lastBadge, newlyUnlockedCount);
            if (typeof (window as any).updateNavBadge === 'function') {
              (window as any).updateNavBadge(effectiveCount, 1); // Pass slideIndex 1 for Journey
              logger.info(`🗺️ Journey badge updated in showHomepageQuietly: ${effectiveCount} newly unlocked boards (raw=${newlyUnlockedCount}, last=${lastBadge})`);
            }
          } catch (error) {
            logger.warn('⚠️ Failed to update journey badge in showHomepageQuietly:', error);
          }
        }).catch((error) => {
          logger.warn('⚠️ Failed to import journey boards manager in showHomepageQuietly:', error);
        });
      }, 150); // Slightly longer delay to ensure navigation is fully rendered

      // 🔥 CRITICAL: applyPaperBackground('0.6') already set paper bg to 60% opacity
      // No need to set it again - the function handles everything with !important flags
      // NO TRANSITIONS, NO OPACITY - elements will be animated by animateSliderEnter
      // DO NOT set opacity 0 here - it will break animation visibility
      logger.info('✅ Homepage shown QUIETLY - ready for animateSliderEnter to control animations');
    }
  }
  
  // Show stats screen
  showStatsScreen(): void {
    logger.info('📊 Showing stats screen');
    const statsScreen = this.elements.statsScreen;
    if (!statsScreen) {
      logger.warn('⚠️ Stats screen element not found');
      return;
    }

    this.hideHomepage();
    this.setNavigationVisibility(false);
    statsScreen.style.display = 'block';
    statsScreen.removeAttribute('hidden');
    statsScreen.setAttribute('aria-hidden', 'false');

    const focusTarget = statsScreen.querySelector('.stats-back-button') as HTMLElement | null;
    focusTarget?.focus();
  }

  private hideStatsScreen(): void {
    const statsScreen = this.elements.statsScreen;
    if (!statsScreen) return;

    statsScreen.setAttribute('aria-hidden', 'true');
    statsScreen.style.display = 'none';
    statsScreen.setAttribute('hidden', 'true');
    this.setNavigationVisibility(true);
    this.showHomepage();

    if (this.elements.journeyButton) {
      this.elements.journeyButton.focus();
    }
  }
  
  // Show stats screen with exit animation
  private showStatsScreenWithAnimation(): void {
    logger.info('📊 Showing stats screen - with exit animation');
    
    // 🔥 CRITICAL: Set paper background to 60% opacity IMMEDIATELY
    // This prevents gray color from showing during slider exit animation
    applyPaperBackground('0.6');
    logger.info('✅ [Stats ENTER] Gradient background set with !important flags IMMEDIATELY (at function start)');
    
    // 🔥 FIX: Switch to Stats slide (index 2) BEFORE animation so it animates the correct slide
    // Stats is slide 2, NOT slide 1 (slide 1 is Journey)
    const slides = document.querySelectorAll('.slider-slide');
    const navButtons = document.querySelectorAll('.independent-nav-button');
    slides.forEach((slide, index) => {
      if (index === 2) { // ✅ FIXED: Stats is slide 2, not slide 1
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });
    navButtons.forEach((button, index) => {
      if (index === 2) { // ✅ FIXED: Stats nav button is index 2, not index 1
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // 🎨 PREMIUM FADE: Animate background color from gradient to solid color (SMOOTH FADE)
    // This creates a premium transition effect when entering individual screens
    const targetSolidColor = PAPER_BG_STYLE;
    
    console.log('🎨 [Stats ENTER] Starting premium fade from gradient to solid color - GSAP:', !!gsap, 'Body:', !!body, 'GlobalBg:', !!globalBg, 'App:', !!appElement);
    
    // 🔥 CRITICAL: Start fade animation FIRST, then play exit animation
    // Fade duration: 0.8s for smooth premium transition
    const fadeDuration = 0.8;
    
    if (gsap && body) {
      gsap.killTweensOf(body);
      body.style.transition = 'none';
      // 🔥 CRITICAL: Always use explicit gradient string, never read from computed style
      // getComputedStyle can return light color instead of gradient, causing flash
      gsap.set(body, { background: currentGradient });
      // Animate to solid color with premium fade
      gsap.to(body, {
        background: targetSolidColor,
        duration: fadeDuration,
        ease: 'power2.inOut',
        overwrite: 'auto',
        immediateRender: false
      });
      console.log('✅ [Stats ENTER] Body background fade animation started from gradient to', targetSolidColor);
    }
    if (gsap && globalBg) {
      gsap.killTweensOf(globalBg);
      (globalBg as HTMLElement).style.transition = 'none';
      // 🔥 CRITICAL: Always use explicit gradient string, never read from computed style
      gsap.set(globalBg, { background: currentGlobalBgGradient });
      gsap.to(globalBg, {
        background: targetSolidColor,
        duration: fadeDuration,
        ease: 'power2.inOut',
        overwrite: 'auto',
        immediateRender: false
      });
      console.log('✅ [Stats ENTER] Global-bg background fade animation started from gradient to', targetSolidColor);
    }
    if (gsap && appElement) {
      gsap.killTweensOf(appElement);
      appElement.style.transition = 'none';
      // 🔥 CRITICAL: Always use explicit gradient string, never read from computed style
      gsap.set(appElement, { background: currentGradient });
      gsap.to(appElement, {
        background: targetSolidColor,
        duration: fadeDuration,
        ease: 'power2.inOut',
        overwrite: 'auto',
        immediateRender: false
      });
      console.log('✅ [Stats ENTER] App element background fade animation started from gradient to', targetSolidColor);
    }
    
    // Step 1: Play exit animation for Stats slide (background is already set, no dark flash)
    console.log('🎬 Step 1: Playing exit animation for Stats slide');
    animateSliderExit();
    
    // Step 2: Wait for exit animation AND fade animation to complete, then show stats screen
    // Exit animation: 770ms, Fade animation: 800ms - wait for the longer one
    const waitTime = Math.max(770, fadeDuration * 1000);
    setTimeout(() => {
      console.log('📊 Step 2: Showing stats screen after animations complete');
      
      const statsScreen = this.elements.statsScreen;
      if (!statsScreen) return;
      
      // Show stats screen after both animations complete
      // CRITICAL: Do NOT set background here - it's already set by GSAP animation
      this.hideHomepage();
      this.setNavigationVisibility(false);
      
      // 🔥 CRITICAL: Set opacity to 0 FIRST so screen is invisible while GSAP sets initial state
      statsScreen.style.opacity = '0';
      statsScreen.style.display = 'flex';
      statsScreen.removeAttribute('hidden');
      statsScreen.setAttribute('aria-hidden', 'false');
      
      // CRITICAL: Update stats values when showing stats screen
      try {
        import('../ui/components/stats-screen.js').then(({ updateStatsValues }) => {
          console.log('📊 About to call updateStatsValues() from ui-manager...');
          updateStatsValues();
          console.log('✅ updateStatsValues() called from ui-manager');
        });
      } catch (error) {
        console.error('❌ Failed to update stats values from ui-manager:', error);
      }
      
      // 🎬 CRITICAL: Trigger stats screen enter animation (pop-in) using GSAP
      try {
        import('../ui/stats-animations.js').then(({ animateStatsScreenEnter }) => {
          console.log('🎬 About to call animateStatsScreenEnter() from ui-manager...');
          // Small delay to ensure DOM is ready, then make screen visible and start animation
          setTimeout(() => {
            // Make screen visible so GSAP can animate individual elements
            statsScreen.style.opacity = '1';
            console.log('🎬 Calling animateStatsScreenEnter() after 50ms delay...');
            animateStatsScreenEnter();
          }, 50);
        });
      } catch (error) {
        console.error('❌ Failed to trigger stats enter animation from ui-manager:', error);
      }
      
      // Focus immediately
      setTimeout(() => {
        const focusTarget = statsScreen.querySelector('.stats-back-button') as HTMLElement | null;
        focusTarget?.focus();
      }, 100);
    }, waitTime);
  }
  
  // Hide stats screen with enter animation
  private hideStatsScreenWithAnimation(): void {
    logger.info('📊 Hiding stats screen - with enter animation');
    
    // 🎨 CRITICAL: Animate background color from solid color back to gradient (SMOOTH FADE)
    // This must happen IMMEDIATELY when back button is clicked, BEFORE anything else
    // Start animation immediately (not in requestAnimationFrame) to ensure it starts before any other code runs
    const body = document.body;
    const globalBg = document.getElementById('global-bg');
    const appElement = document.getElementById('app');
    const targetGradient = PAPER_BG_STYLE;
    const targetGlobalBgGradient = PAPER_BG_STYLE;
    
    console.log('🎨 [Stats EXIT] Starting smooth background fade to gradient - GSAP:', !!gsap, 'Body:', !!body, 'GlobalBg:', !!globalBg, 'App:', !!appElement);
    
    // 🔥 CRITICAL: Fade duration for premium transition
    const fadeDuration = 0.8;
    
    if (gsap && body) {
      gsap.killTweensOf(body);
      body.style.transition = 'none';
      // Get current background to ensure smooth transition
      const currentBg = window.getComputedStyle(body).background || window.getComputedStyle(body).backgroundColor || '#f3eee8';
      // CRITICAL: Set initial background explicitly to prevent CSS override
      gsap.set(body, { background: currentBg || '#f3eee8' });
      // Use fromTo to ensure smooth fade from current solid color to gradient
      gsap.to(body, {
        background: targetGradient,
        duration: fadeDuration,
        ease: 'power2.inOut',
        overwrite: 'auto',
        immediateRender: false
      });
      console.log('✅ [Stats EXIT] Body background fade animation started from:', currentBg);
    }
    if (gsap && globalBg) {
      gsap.killTweensOf(globalBg);
      (globalBg as HTMLElement).style.transition = 'none';
      const currentGlobalBg = window.getComputedStyle(globalBg as HTMLElement).background || window.getComputedStyle(globalBg as HTMLElement).backgroundColor || '#f3eee8';
      // CRITICAL: Set initial background explicitly to prevent CSS override
      gsap.set(globalBg, { background: currentGlobalBg || '#f3eee8' });
      gsap.to(globalBg, {
        background: targetGlobalBgGradient,
        duration: fadeDuration,
        ease: 'power2.inOut',
        overwrite: 'auto',
        immediateRender: false
      });
      console.log('✅ [Stats EXIT] Global-bg background fade animation started from:', currentGlobalBg);
    }
    if (gsap && appElement) {
      gsap.killTweensOf(appElement);
      appElement.style.transition = 'none';
      const currentAppBg = window.getComputedStyle(appElement).background || window.getComputedStyle(appElement).backgroundColor || '#f3eee8';
      // CRITICAL: Set initial background explicitly to prevent CSS override
      gsap.set(appElement, { background: currentAppBg || '#f3eee8' });
      gsap.to(appElement, {
        background: targetGlobalBgGradient,
        duration: fadeDuration,
        ease: 'power2.inOut',
        overwrite: 'auto',
        immediateRender: false
      });
      console.log('✅ [Stats EXIT] App element background fade animation started from:', currentAppBg);
    }
    
    // 🎬 CRITICAL: Trigger stats screen exit animation (pop-out) BEFORE hiding
    try {
      import('../ui/stats-animations.js').then(({ animateStatsScreenExit }) => {
        console.log('🎬 About to call animateStatsScreenExit() from ui-manager...');
        animateStatsScreenExit();
      });
    } catch (error) {
      console.error('❌ Failed to trigger stats exit animation from ui-manager:', error);
    }
    
    // Hide stats screen after animation completes
    // BUT: Background fade animation takes fadeDuration, so we need to wait for it to complete
    const fadeDurationMs = fadeDuration * 1000;
    setTimeout(() => {
      const statsScreen = this.elements.statsScreen;
      if (statsScreen) {
        statsScreen.setAttribute('aria-hidden', 'true');
        statsScreen.style.display = 'none';
        statsScreen.setAttribute('hidden', 'true');
        this.setNavigationVisibility(true);
      }
      
      // CRITICAL: Switch to Stats slide (index 1) to show Stats slide after exiting Stats screen
      const slides = document.querySelectorAll('.slider-slide');
      const navButtons = document.querySelectorAll('.independent-nav-button');
      slides.forEach((slide, index) => {
        if (index === 1) {
          slide.classList.add('active');
        } else {
          slide.classList.remove('active');
        }
      });
      navButtons.forEach((button, index) => {
        if (index === 1) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
      
      // Show homepage QUIETLY first (no animations yet)
      // CRITICAL: Do NOT override background animation - it's already completed
      this.showHomepageQuietly();
      
      // Step 2: Play enter animation for Stats slide
      console.log('🎬 Playing enter animation for Stats slide');
      animateSliderEnter();
    }, fadeDurationMs);
    
    // CRITICAL: Ensure background animation is NOT killed when homepage is shown
    // The animation should continue running for its full duration
  }
  
  // Show Journey screen with exit animation
  private showCollectiblesScreenWithAnimation(): void {
    // 🔥 CRITICAL: Set paper background to 60% opacity IMMEDIATELY at the VERY FIRST line
    // This MUST happen before ANY other code, including logger calls
    // This prevents gray color from showing during slider exit animation
    applyPaperBackground('0.6');
    const body = document.body;
    const html = document.documentElement;
    const globalBg = document.getElementById('global-bg');
    const appElement = document.getElementById('app');
    
    // 🎨 PREMIUM FADE: Use paper background with 60% opacity for Journey screen
    // This creates a premium transition effect when entering from HOMEPAGE CTA only
    const paperOverlayAlpha = 0.4; // 1 - 0.6 = 60% paper visible
    const targetSolidColor = `linear-gradient(rgba(243,238,232,${paperOverlayAlpha}), rgba(243,238,232,${paperOverlayAlpha})), url('./assets/paper-bg.png') center/100% 100% no-repeat, #f3eee8`;
    const currentGradient = targetSolidColor; // Use 60% opacity from the start
    const currentGlobalBgGradient = targetSolidColor; // Use 60% opacity from the start
    
    // 🔥 IMPORTANT: Keep slider containers transparent to avoid cropped paper texture
    clearSliderBackgrounds();
    
    // NOW log and continue with rest of function
    logger.info('🗺️ Showing Journey screen - with exit animation');
    logger.info('✅ [Journey ENTER] Gradient background set with !important flags IMMEDIATELY (at function start)');
    
    // 🔥 CRITICAL: Set exit animation flag IMMEDIATELY to prevent badge removal
    // This must be done BEFORE anything else to protect badge from being removed
    (window as any).__ccIsAnimatingSliderExit = () => true;
    logger.info('🔒 Exit animation flag set - badge is now protected');
    
    // 🔥 CRITICAL: Serialize CTA transitions to avoid double-click / overlapping animations
    if ((window as any).__ccUiJourneyTransitioning) {
      logger.warn('⚠️ Journey CTA transition already running - ignoring duplicate trigger');
      return;
    }
    (window as any).__ccUiJourneyTransitioning = true;
    
    // CRITICAL: Switch to Journey slide (index 1) BEFORE animation so its elements animate out
    // (CTA, text, hero). We still open the Journey screen after the animation.
    // 🔥 BUG FIX: Only switch slides if NOT already on Journey slide (prevents unwanted swipe visual)
    const slides = document.querySelectorAll('.slider-slide');
    const navButtons = document.querySelectorAll('.independent-nav-button');
    const currentSlide = document.querySelector('.slider-slide.active');
    const currentSlideIndex = currentSlide ? parseInt(currentSlide.getAttribute('data-slide') || '0') : 0;
    
    if (currentSlideIndex !== 1) {
      console.log('🔄 Switching from slide', currentSlideIndex, 'to Journey slide (1)');
      
      // 🔥 BUG FIX: Sync GSAP wrapper position BEFORE setting active classes
      // This prevents slider from skipping animation when user clicks nav button later
      const sliderWrapper = document.getElementById('slider-wrapper');
      const sliderContainer = document.getElementById('slider-container');
      if (sliderWrapper && sliderContainer && typeof (window as any).gsap !== 'undefined') {
        const slideWidth = sliderContainer.offsetWidth;
        const targetOffset = -1 * slideWidth; // Journey slide is index 1
        console.log(`🔧 Syncing GSAP wrapper to Journey slide (1), offset: ${targetOffset}px`);
        (window as any).gsap.set(sliderWrapper, { x: targetOffset });
      }
      
      slides.forEach((slide, index) => {
        if (index === 1) {
          slide.classList.add('active');
        } else {
          slide.classList.remove('active');
        }
      });
      navButtons.forEach((button, index) => {
        if (index === 1) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
    } else {
      console.log('✅ Already on Journey slide (1) - no slide switch needed');
    }
    
    // 🔥 BUG FIX: Hide slider container immediately to prevent any visual glitches
    // Slider will be properly hidden during exit animation, but this prevents flash/swipe visibility
    const sliderContainer = document.getElementById('slider-container');
    if (sliderContainer) {
      sliderContainer.style.pointerEvents = 'none'; // Prevent any interactions during transition
    }
    
    // 🔥 CRITICAL: Paper background with 60% opacity is already set by applyPaperBackground('0.6')
    // No need to override it - it will stay at 60% throughout the entire transition
    if (appElement) {
      appElement.style.setProperty('background', 'transparent', 'important');
      appElement.style.setProperty('background-image', 'none', 'important');
    }
    
    // 🔥 CRITICAL: Force reflow to ensure DOM is updated before animation
    void document.querySelector('.slider-slide.active')?.offsetHeight;
    
    const fadeDuration = 0.8;
    
    console.log('🎨 [Journey EXIT] Paper background with 60% opacity already set - no fade needed');
    
    // 🔥 CRITICAL: Play exit animation FIRST (gradient stays with !important during exit)
    console.log('🎬 Step 1: Playing exit animation for Journey slide (gradient preserved with !important)');
    
    // Step 1: Play exit animation for Journey slide
    // 🔥 CRITICAL: Small delay to ensure DOM is updated and slide is marked as active
    setTimeout(() => {
      console.log('🎬 Step 1: Playing exit animation for Journey slide');
      const activeSlide = document.querySelector('.slider-slide.active');
      console.log('🔍 Active slide found:', !!activeSlide, 'Slide index:', activeSlide?.getAttribute('data-slide'));
      if (activeSlide) {
        const heroContainer = activeSlide.querySelector('.hero-container');
        const slideButton = activeSlide.querySelector('.slide-button');
        const slideTagline = activeSlide.querySelector('.slide-tagline');
        console.log('🔍 Journey slide elements:', {
          heroContainer: !!heroContainer,
          slideButton: !!slideButton,
          slideTagline: !!slideTagline
        });
      }
      animateSliderExit();
      
      // 🔥 CRITICAL FIX: Start loading Journey boards AFTER exit animation starts
      // This ensures badge animates out BEFORE any badge reset logic runs
      console.log('🗺️ Step 0: Starting Journey boards rendering in background (after exit animation started)...');
      const collectiblesManager = (window as any).collectiblesManager;
      if (collectiblesManager && typeof collectiblesManager.prepareJourneyScreen === 'function') {
        // Use prepareJourneyScreen to render boards without showing screen
        // Don't await - let it run in background
        collectiblesManager.prepareJourneyScreen().catch((error: Error) => {
          logger.warn('⚠️ Failed to prepare Journey screen:', error);
        });
        console.log('✅ Journey boards rendering started in background');
      }
    }, 10);
    
    // Step 2: Wait for exit animation to complete, then show Journey screen
    // Exit animation: 770ms
    setTimeout(() => {
      console.log('🗺️ Step 2: Exit animation complete, showing Journey screen');
      
      // 🔥 CRITICAL: Paper background with 60% opacity is already set by applyPaperBackground('0.6')
      // No need to change it - it stays at 60% throughout
      // Just ensure app element is transparent
      if (appElement) {
        appElement.style.setProperty('background', 'transparent', 'important');
        appElement.style.setProperty('background-image', 'none', 'important');
      }
      console.log('✅ [Journey ENTER] Paper background with 60% opacity already set - no changes needed');
      
      // Show Journey screen IMMEDIATELY - no blank screen, no fade animation
        // Journey screen is already prepared with opacity 0, animation will start immediately
        this.showCollectiblesScreen();
        (window as any).__ccUiJourneyTransitioning = false;
    }, 770);
  }
  
  // Hide Journey screen with enter animation
  async hideCollectiblesScreenWithAnimation(): Promise<void> {
    // 🔥 FIX: Prevent duplicate calls (iOS optimization)
    if ((window as any).__ccIsHidingCollectibles) {
      logger.warn('⚠️ hideCollectiblesScreenWithAnimation already in progress, ignoring duplicate call');
      return;
    }
    (window as any).__ccIsHidingCollectibles = true;
    
    logger.info('🗺️ Hiding Journey screen - with exit animation');
    
    // 🔥 CRITICAL: Stop ALL Journey animations BEFORE exit animation to prevent frame drops and lag
    logger.info('🛑 Stopping all Journey animations before exit...');
    
    // Stop Journey card idle bounce animations
    try {
      const { JOURNEY_CARD_IDLE_BOUNCE } = await import('../modules/journey-card-idle-bounce.js');
      if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
        JOURNEY_CARD_IDLE_BOUNCE.stop();
        logger.info('✅ Journey card idle bounce stopped');
      }
    } catch (error) {
      logger.warn('⚠️ Failed to stop journey card idle bounce:', error);
    }
    
    // Stop glow pulse and interim bounce animations
    try {
      const journeyContainer = document.getElementById('journey-boards-container');
      if (journeyContainer) {
        const collectiblesManager = (window as any).collectiblesManager;
        if (collectiblesManager) {
          const { journeyBoardsManager } = await import('../modules/journey-boards-manager.js');
          if (journeyBoardsManager && typeof journeyBoardsManager.stopGlowPulse === 'function') {
            journeyBoardsManager.stopGlowPulse();
            logger.info('✅ Glow pulse and interim bounce stopped');
          }
        }
      }
    } catch (error) {
      logger.warn('⚠️ Failed to stop glow pulse:', error);
    }
    
    // Kill all GSAP animations on Journey cards
    try {
      const journeyScreen = document.getElementById('journey-screen');
      if (journeyScreen) {
        const cards = journeyScreen.querySelectorAll('.journey-board-card, .journey-board-card-wrapper');
        if (cards.length > 0) {
          const { gsap } = await import('gsap');
          gsap.killTweensOf(cards);
          logger.info(`✅ Killed GSAP animations on ${cards.length} journey cards`);
        }
        
        // 🔥 CRITICAL: Stop ALL CSS animations (shimmer, glow, etc.) on Journey cards
        const interimCards = journeyScreen.querySelectorAll('.journey-board-card.interim');
        const { gsap: gsapForWrappers } = await import('gsap');
        interimCards.forEach((card) => {
          const cardEl = card as HTMLElement;
          // Stop CSS animations by removing animation property
          cardEl.style.animation = 'none';
          cardEl.style.animationPlayState = 'paused';
          // Remove shimmer/glow classes
          cardEl.classList.remove('interim-shimmer-trigger', 'interim-glow-pulse');
          // Kill any GSAP animations on card wrapper
          const cardWrapper = cardEl.closest('.journey-board-card-wrapper') as HTMLElement | null;
          if (cardWrapper) {
            gsapForWrappers.killTweensOf(cardWrapper);
          }
        });
        logger.info(`✅ Stopped CSS animations (shimmer, glow) on ${interimCards.length} interim cards`);
        
        // Stop any CSS animations on collectible cards
        const collectibleCards = journeyScreen.querySelectorAll('.collectible-card-wrapper');
        collectibleCards.forEach((card) => {
          const cardEl = card as HTMLElement;
          cardEl.style.animation = 'none';
          cardEl.style.animationPlayState = 'paused';
        });
        logger.info(`✅ Stopped CSS animations on ${collectibleCards.length} collectible cards`);
      }
    } catch (error) {
      logger.warn('⚠️ Failed to kill GSAP animations:', error);
    }
    
    // 🔥 CRITICAL: Disable scroll and touch events on Journey screen during exit animation
    // This prevents any user interaction from interfering with exit animation
    try {
      const journeyScreen = document.getElementById('journey-screen');
      const scrollable = journeyScreen?.querySelector('.collectibles-scrollable') as HTMLElement;
      if (scrollable) {
        scrollable.style.pointerEvents = 'none';
        scrollable.style.touchAction = 'none';
        scrollable.style.overflow = 'hidden';
        logger.info('✅ Disabled scroll and touch events on Journey screen');
      }
    } catch (error) {
      logger.warn('⚠️ Failed to disable scroll/touch events:', error);
    }
    
    logger.info('✅ All Journey animations stopped - starting exit animation...');
    
    // 🔥 CRITICAL FIX: Start exit animation IMMEDIATELY (no delay)
    // This ensures the screen responds instantly to back button click
    const hideCollectibles = window.hideCollectiblesScreen || window.hideCollectibles;
    let exitAnimationPromise: Promise<void> | null = null;
    
    if (typeof hideCollectibles === 'function') {
      logger.info('🎁 Starting collectibles exit animation IMMEDIATELY...');
      try {
        const result = hideCollectibles() as Promise<void> | void;
        // Ensure we have a Promise
        if (result && typeof result === 'object' && 'then' in result) {
          exitAnimationPromise = result as Promise<void>;
        } else {
          // If it's not a Promise, create a resolved one
          exitAnimationPromise = Promise.resolve();
        }
      } catch (error) {
        logger.error('❌ Error starting exit animation:', error);
        exitAnimationPromise = Promise.resolve();
      }
    }
    
    // 🎨 CRITICAL: Set paper background to 50% opacity IMMEDIATELY when exiting Journey screen
    // This ensures paper bg is visible on homepage with correct opacity, preventing gray flash
    // This runs IMMEDIATELY (not after animation) to prevent gray background during transition
    applyPaperBackground('0.6');
    
    const body = document.body;
    const html = document.documentElement;
    const globalBg = document.getElementById('global-bg');
    const appElement = document.getElementById('app');
    
    console.log('🎨 [Collectibles EXIT] Paper background with 50% opacity set IMMEDIATELY to prevent gray flash');
    
    // 🔥 CRITICAL: Ensure app element is transparent
    if (appElement) {
      appElement.style.setProperty('background', 'transparent', 'important');
      appElement.style.setProperty('background-image', 'none', 'important');
    }

    // 🔥 IMPORTANT: Keep slider containers transparent to avoid cropped paper texture on return
    clearSliderBackgrounds();
    
    // 🔥 USER REQUEST: Ensure all slides are visible (slider position controlled by collectibles-manager.ts)
    // Back button returns to Journey slide (index 1), NOT homepage slide (index 0)
    const slides = document.querySelectorAll('.slider-slide');
    slides.forEach((slide) => {
      // All slides should be visible (slider uses translateX for positioning)
      (slide as HTMLElement).style.display = 'block';
      (slide as HTMLElement).style.visibility = 'visible';
      (slide as HTMLElement).style.opacity = '1';
    });
    console.log('✅ All slides made visible - slider position controlled by collectibles-manager.ts');
    
    // 🔥 CRITICAL FIX: Wait for exit animation to complete (it started immediately above)
    // Exit animation takes ~0.8s (totalDuration from collectibles-animations.ts)
    // Match timing with reverse direction: Math.max(770, fadeDuration * 1000) = 800ms
    if (exitAnimationPromise) {
      logger.info('🎁 Waiting for collectibles exit animation to complete...');
      await exitAnimationPromise;
      logger.info('✅ Collectibles exit animation completed');
    } else {
      // If no promise, wait for estimated duration anyway (800ms to match reverse direction)
      await new Promise(resolve => setTimeout(resolve, 800)); // 800ms exit
      logger.info('✅ Waited for estimated exit animation duration');
    }
    
    // 🔥 CRITICAL: Ensure Journey screen is completely hidden before showing homepage
    const journeyScreen = document.getElementById('journey-screen');
    if (journeyScreen) {
      journeyScreen.classList.remove('show');
      journeyScreen.classList.add('hidden');
      journeyScreen.style.display = 'none';
      journeyScreen.style.visibility = 'hidden';
      journeyScreen.style.opacity = '0';
      logger.info('✅ Journey screen completely hidden');
    }
    
    // 🔥 USER REQUEST: Check if we're returning to Journey slide (slide 1) or homepage slide (slide 0)
    // Journey games should ALWAYS return to slide 1 (Journey slide), NOT slide 0 (homepage PLAY slide)
    const cameFromJourney = (window as any).__ccCameFromJourney === true || 
                            localStorage.getItem('__ccCameFromJourney') === 'true';
    const cameFromHomepage = (window as any).__ccCameFromHomepage === true || 
                             localStorage.getItem('__ccCameFromHomepage') === 'true';
    const journeyExitMode = (window as any).__ccJourneyExitMode;
    
    logger.info('🔍 Checking exit context:', { cameFromJourney, cameFromHomepage, journeyExitMode });
    
    // 🔥 CRITICAL: If __ccJourneyExitMode is 'toHome', collectibles-manager.ts will handle showing slide 2
    // DO NOT call showHomepageQuietly() as it will reset slider to slide 0
    if (journeyExitMode === 'toHome') {
      logger.info('🗺️ Journey exit mode is "toHome" - collectibles-manager.ts will handle slide 2 positioning');
      // Don't call showHomepageQuietly() - collectibles-manager.ts will position slider on slide 2
      return; // Exit early - collectibles-manager.ts will handle everything
    }
    
    if (cameFromJourney) {
      // 🔥 USER REQUEST: Journey games → return to Journey slide (slide 1), NOT homepage slide (slide 0)
      // DO NOT show homepage - Journey screen will be shown directly by exitToMenu
      logger.info('🗺️ Returning to Journey slide (slide 1) - skipping showHomepageQuietly');
      // Don't call showHomepageQuietly() - exitToMenu will handle showing Journey screen
    } else if (cameFromHomepage) {
      // 🔥 USER REQUEST: Homepage PLAY games → return to homepage slide (slide 0)
      logger.info('🏠 Returning to homepage slide (slide 0) - showing homepage');
      // 🔥 CRITICAL: Paper bg with 60% opacity already set by applyPaperBackground('0.6') above
      // No need to set it again - showHomepageQuietly() will ensure it stays at 60%
    this.showHomepageQuietly();
    this.setNavigationVisibility(true);
    } else {
      // Default: show homepage (for backward compatibility)
      logger.info('🏠 No context found - defaulting to homepage slide (slide 0)');
      // 🔥 CRITICAL: Paper bg with 60% opacity already set by applyPaperBackground('0.6') above
      // No need to set it again - showHomepageQuietly() will ensure it stays at 60%
      this.showHomepageQuietly();
      this.setNavigationVisibility(true);
    }
    
    // 🔥 USER BUG FIX: Update Journey badge when returning to homepage from Journey screen
    // This ensures badge is visible immediately after returning, showing newly unlocked boards
    // Wait for navigation to be rendered before updating badge
    setTimeout(() => {
      import('./journey-boards-manager.js').then(({ journeyBoardsManager }) => {
        try {
          // Sync journey boards with current game progress first
          journeyBoardsManager.syncWithGameProgress();
          
          const newlyUnlockedCount = journeyBoardsManager.getNewlyUnlockedCount();
          const lastBadge = (window as any).__ccJourneyBadgeCount || 0;
          const effectiveCount = Math.max(lastBadge, newlyUnlockedCount);
          if (typeof (window as any).updateNavBadge === 'function') {
            (window as any).updateNavBadge(effectiveCount, 1); // Pass slideIndex 1 for Journey
            logger.info(`🗺️ Journey badge updated when returning to homepage: ${effectiveCount} newly unlocked boards (raw=${newlyUnlockedCount}, last=${lastBadge})`);
          }
        } catch (error) {
          logger.warn('⚠️ Failed to update journey badge when returning to homepage:', error);
        }
      }).catch((error) => {
        logger.warn('⚠️ Failed to import journey boards manager when returning to homepage:', error);
      });
    }, 100);
    
    // 🔥 CRITICAL: Force navigation visibility update after journey screen is hidden
    // This ensures MutationObserver in navigation-control.ts detects the change
    requestAnimationFrame(async () => {
      try {
        const { updateNavigationVisibility } = await import('./navigation-control.js');
        if (typeof updateNavigationVisibility === 'function') {
          updateNavigationVisibility();
          logger.info('✅ Navigation visibility updated after journey screen hidden');
        }
      } catch (error) {
        logger.warn('⚠️ Failed to update navigation visibility:', error);
      }
    });
    
    // 🔥 USER REQUEST: Slider position and enter animation controlled by collectibles-manager.ts
    // Back button returns to Journey slide (index 1), NOT homepage slide (index 0)
    // collectibles-manager.ts will handle slider positioning and animateSliderEnter() call
    console.log('✅ Slider position and enter animation delegated to collectibles-manager.ts');
    
    // 🔥 FIX: Reset guard after animation completes (iOS optimization)
    setTimeout(() => {
      (window as any).__ccIsHidingCollectibles = false;
    }, 2000);
  }
  
  // Show Journey screen
  showCollectiblesScreen(): void {
    logger.info('🗺️ Showing Journey screen');
    // 🔥 CRITICAL: Set paper background to 60% opacity for Journey screen
    applyPaperBackground('0.6');
    try {
      const promise =
        window.showCollectiblesScreen?.() ??
        window.showCollectibles?.();
      promise?.catch(error => {
        logger.error('❌ Failed to show collectibles screen:', error);
      });
    } catch (error) {
      logger.error('❌ Failed to trigger collectibles screen:', error);
    }
  }
  
  // Show settings screen
  private showSettingsScreenWithAnimation(): void {
    // 🔥 CRITICAL: Set paper background to 60% opacity IMMEDIATELY at the VERY FIRST line
    // This MUST happen before ANY other code, including logger calls
    // This prevents gray color from showing during slider exit animation
    applyPaperBackground('0.6');
    const body = document.body;
    const html = document.documentElement;
    const globalBg = document.getElementById('global-bg');
    const appElement = document.getElementById('app');
    // Keep Settings background at the same 60% paper opacity as homepage
    const paperOverlayAlpha = 0.4; // 1 - 0.6 = 60% paper visible
    const targetPaperBg = `linear-gradient(rgba(243,238,232,${paperOverlayAlpha}), rgba(243,238,232,${paperOverlayAlpha})), url('./assets/paper-bg.png') center/100% 100% no-repeat, #f3eee8`;
    const currentGradient = targetPaperBg;
    const currentGlobalBgGradient = targetPaperBg;
    
    // 🔥 IMPORTANT: Keep slider containers transparent to avoid cropped/tiled paper background
    clearSliderBackgrounds();
    if (appElement) {
      appElement.style.setProperty('background', 'transparent', 'important');
      appElement.style.setProperty('background-image', 'none', 'important');
    }
    
    // NOW log and continue with rest of function
    logger.info('⚙️ Showing settings screen - with exit animation');
    logger.info('✅ [Settings ENTER] Paper background set to 60% opacity IMMEDIATELY (at function start)');
    
    // CRITICAL: Switch to Settings slide (index 3) BEFORE animation so it animates the correct slide
    const navButtons = document.querySelectorAll('.independent-nav-button');
    const slides = document.querySelectorAll('.slider-slide');
    slides.forEach((slide, index) => {
      if (index === 3) {
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });
    navButtons.forEach((button, index) => {
      if (index === 3) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // 🎨 PREMIUM FADE: Keep paper background at 60% opacity for Settings screen
    const targetSolidColor = targetPaperBg;
    
    console.log('🎨 [Settings ENTER] Starting premium fade from gradient to solid color - GSAP:', !!gsap, 'Body:', !!body, 'GlobalBg:', !!globalBg, 'App:', !!appElement);
    
    // 🔥 CRITICAL: Start fade animation FIRST, then play exit animation
    // Fade duration: 0.8s for smooth premium transition
    const fadeDuration = 0.8;
    
    // 🔥 CRITICAL: Don't use GSAP for background animation - it can override !important flags
    // Keep gradient with !important flags during exit animation
    // Animate to solid color AFTER exit animation completes
    console.log('⚠️ [DEBUG] Keeping gradient with !important during exit animation, will fade to solid AFTER');
    
    // Ensure paper background stays with !important during exit animation
    if (body) {
      body.style.setProperty('background', currentGradient, 'important');
      body.style.setProperty('background-color', '#f3eee8', 'important');
    }
    if (html) {
      html.style.setProperty('background', currentGradient, 'important');
      html.style.setProperty('background-color', '#f3eee8', 'important');
    }
    if (globalBg) {
      (globalBg as HTMLElement).style.setProperty('background', currentGlobalBgGradient, 'important');
      (globalBg as HTMLElement).style.setProperty('background-color', '#f3eee8', 'important');
    }
    if (appElement) {
      appElement.style.setProperty('background', 'transparent', 'important');
      appElement.style.setProperty('background-image', 'none', 'important');
    }
    
    // Step 1: Play exit animation for Settings slide (gradient stays with !important during exit)
    // 🔥 CRITICAL: Re-apply paper background ONE MORE TIME right before exit animation
    // This ensures 50% paper opacity is preserved if something changed it during slider positioning
    if (body) {
      body.style.setProperty('background', currentGradient, 'important');
      body.style.setProperty('background-color', '#f3eee8', 'important');
    }
    if (html) {
      html.style.setProperty('background', currentGradient, 'important');
      html.style.setProperty('background-color', '#f3eee8', 'important');
    }
    if (globalBg) {
      (globalBg as HTMLElement).style.setProperty('background', currentGlobalBgGradient, 'important');
      (globalBg as HTMLElement).style.setProperty('background-color', '#f3eee8', 'important');
    }
    if (appElement) {
      appElement.style.setProperty('background', 'transparent', 'important');
      appElement.style.setProperty('background-image', 'none', 'important');
    }
    
    console.log('🎬 Step 1: Playing exit animation for Settings slide (gradient preserved with !important)');
    animateSliderExit();
    
    // Step 2: Wait for exit animation to complete, then show Settings screen IMMEDIATELY (optimized)
    // Exit animation: 770ms
    // 🔥 OPTIMIZATION: Show Settings screen immediately after exit animation, don't wait for fade
    // Fade animation can happen in parallel - no need to block Settings screen display
    setTimeout(() => {
      console.log('⚙️ Step 2: Exit animation complete, showing Settings screen IMMEDIATELY');
        
        const settingsScreen = this.elements.settingsScreen;
        if (!settingsScreen) return;
        
      // Show settings screen IMMEDIATELY after exit animation (don't wait for fade)
        this.hideHomepage();
        this.setNavigationVisibility(false);
      
      // 🔥 CRITICAL: Refresh back button reference and ensure handler is attached
      const backButton = settingsScreen.querySelector('#settings-back-btn') as HTMLButtonElement | null;
      if (backButton) {
        this.elements.settingsBackButton = backButton;
        // Ensure handler is attached (in case element wasn't available during init)
        if (!this.boundEventHandlers.has(backButton)) {
          const handler = this.handleSettingsBackClick.bind(this);
          backButton.addEventListener('click', handler);
          this.boundEventHandlers.set(backButton, [{ event: 'click', handler }]);
          logger.info('✅ Settings back button handler attached');
        }
      } else {
        logger.warn('⚠️ Settings back button not found in DOM');
      }
      
      // 🔥 CRITICAL: Set opacity to 0 FIRST so screen is invisible while GSAP sets initial state
      settingsScreen.style.opacity = '0';
      settingsScreen.style.display = 'flex';
      settingsScreen.removeAttribute('hidden');
      settingsScreen.setAttribute('aria-hidden', 'false');
      
      // 🔥 CRITICAL: Setup toggle event listeners AFTER settings screen is shown
      // This ensures toggles work even if screen was recreated or elements were not available during init
      this.setupSettingsToggles();
      
      // 🎬 CRITICAL: Trigger settings screen enter animation (pop-in) using GSAP
      // 🔥 OPTIMIZATION: Use static import (already imported at top) to avoid 15s delay
      try {
          // Small delay to ensure DOM is ready, then make screen visible and start animation
          setTimeout(() => {
            // Make screen visible so GSAP can animate individual elements
            settingsScreen.style.opacity = '1';
          console.log('🎬 Calling animateSettingsScreenEnter()...');
          // Use statically imported function - no dynamic import delay!
            animateSettingsScreenEnter();
          }, 50);
      } catch (error) {
        console.error('❌ Failed to trigger settings enter animation:', error);
        // Fallback: just show the screen normally
        settingsScreen.style.opacity = '1';
      }
      
      // Focus immediately
      setTimeout(() => {
        const focusTarget = settingsScreen.querySelector('.settings-back-button') as HTMLElement | null;
        focusTarget?.focus();
      }, 100);
      
    // Step 3: Ensure paper background remains at 60% opacity (no fade needed)
    console.log('⚙️ Step 3: Paper background already at 60% opacity - no fade needed');
    applyPaperBackground('0.6');
    if (appElement) {
      appElement.style.setProperty('background', 'transparent', 'important');
      appElement.style.setProperty('background-image', 'none', 'important');
    }
    }, 770); // Exit animation delay only - Settings screen shows immediately after
  }
  
  // Hide settings screen with enter animation
  private hideSettingsScreenWithAnimation(): void {
    logger.info('⚙️ Hiding settings screen - with enter animation');
    
    // 🎨 CRITICAL: Keep paper background at 60% opacity during Settings exit
    // This must happen IMMEDIATELY when back button is clicked, BEFORE anything else
    applyPaperBackground('0.6');
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.style.setProperty('background', 'transparent', 'important');
      appElement.style.setProperty('background-image', 'none', 'important');
    }
    logger.info('✅ [Settings EXIT] Paper background set to 60% opacity IMMEDIATELY');
    
    // 🔥 CRITICAL: Fade duration for Settings exit animation timing
    const fadeDuration = 0.8;
    
    // 🔥 CRITICAL: Show homepage QUIETLY IMMEDIATELY (before animation completes)
    // This ensures gradient is visible right away, preventing gray color flash
    // Also reset slider to Settings slide (index 3) BEFORE showing homepage
    const slides = document.querySelectorAll('.slider-slide');
    const navButtons = document.querySelectorAll('.independent-nav-button');
    slides.forEach((slide, index) => {
      if (index === 3) {
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });
    navButtons.forEach((button, index) => {
      if (index === 3) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    this.showHomepageQuietly();
    
    // 🎬 CRITICAL: Trigger settings screen exit animation (pop-out) AFTER showing homepage
    // 🔥 OPTIMIZATION: Use static import (already imported at top) to avoid delay
    try {
        console.log('🎬 About to call animateSettingsScreenExit()...');
      // Use statically imported function - no dynamic import delay!
        animateSettingsScreenExit();
    } catch (error) {
      console.error('❌ Failed to trigger settings exit animation:', error);
    }
    
    // Hide settings screen after fade animation completes
    const fadeDurationMs = fadeDuration * 1000;
    setTimeout(() => {
      const settingsScreen = this.elements.settingsScreen;
      if (settingsScreen) {
        settingsScreen.setAttribute('aria-hidden', 'true');
        settingsScreen.style.display = 'none';
        settingsScreen.setAttribute('hidden', 'true');
        this.setNavigationVisibility(true);
      }
      
      // Force reflow to ensure DOM is updated before animation
      void slides[3]?.offsetHeight;
      
      // Step 2: Play enter animation for Settings slide (index 3)
      // Use requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          console.log('🎬 Playing enter animation for Settings slide (index 3)');
          animateSliderEnter();
        });
      });
    }, fadeDurationMs);
  }
  
  // Show settings screen quietly (no animations) - DEPRECATED
  private showSettingsScreenQuietly(): void {
    logger.info('⚙️ Showing settings screen quietly');
    const settingsScreen = this.elements.settingsScreen;
    if (!settingsScreen) {
      logger.warn('⚠️ Settings screen element not found');
      return;
    }

    this.hideHomepage();
    this.setNavigationVisibility(false);
    settingsScreen.style.display = 'flex';
    settingsScreen.removeAttribute('hidden');
    settingsScreen.setAttribute('aria-hidden', 'false');

    const focusTarget = settingsScreen.querySelector('.settings-back-button') as HTMLElement | null;
    focusTarget?.focus();
    
    // 🔥 CRITICAL: Setup toggle event listeners when settings screen is shown
    // This ensures toggles work even if screen was recreated or elements were not available during init
    this.setupSettingsToggles();
  }
  
  // Hide settings screen
  private hideSettingsScreen(): void {
    const settingsScreen = this.elements.settingsScreen;
    if (!settingsScreen) return;

    settingsScreen.setAttribute('aria-hidden', 'true');
    settingsScreen.style.display = 'none';
    settingsScreen.setAttribute('hidden', 'true');
    this.setNavigationVisibility(true);
    this.showHomepage();
  }
  
  // Handle settings back button click
  private handleSettingsBackClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    logger.info('⚙️ Settings back button clicked');
    
    // 🔥 CRITICAL: Refresh button reference in case it changed
    const btn = document.getElementById('settings-back-btn') as HTMLButtonElement | null;
    if (btn) {
      this.elements.settingsBackButton = btn;
    }
    
    // 🔥 USER REQUEST: Sweet bounce tap feedback (visual only)
    try {
      const buttonToAnimate = this.elements.settingsBackButton || btn;
      if (buttonToAnimate) {
        buttonToAnimate.classList.remove('sweet-bounce');
        void buttonToAnimate.offsetHeight; // force reflow to retrigger
        buttonToAnimate.classList.add('sweet-bounce');
        window.setTimeout(() => buttonToAnimate.classList.remove('sweet-bounce'), 260);
      }
    } catch (err) {
      logger.warn('⚠️ Error adding bounce animation to settings back button:', err);
    }
    
    // 🔥 CRITICAL: Call hide function
    logger.info('⚙️ Calling hideSettingsScreenWithAnimation()...');
    this.hideSettingsScreenWithAnimation();
  }
  
  // 🔥 MEMORY LEAK FIX: Store settings toggle handlers
  private settingsToggleHandlers: Map<HTMLElement, { event: string; handler: EventListener }[]> = new Map();
  
  // Setup settings toggles
  private setupSettingsToggles(): void {
    const settingsScreen = this.elements.settingsScreen;
    if (!settingsScreen) {
      console.warn('⚠️ Settings screen not found, cannot setup toggles');
      return;
    }
    
    // 🔥 CRITICAL: Directly attach event listeners to checkbox elements
    // This is more reliable than event delegation for checkboxes
    const gameSoundsToggle = document.getElementById('toggle-game-sounds') as HTMLInputElement;
    const vibrationToggle = document.getElementById('toggle-vibration') as HTMLInputElement;
    
    if (!gameSoundsToggle || !vibrationToggle) {
      console.warn('⚠️ Settings toggle checkboxes not found:', {
        gameSoundsToggle: !!gameSoundsToggle,
        vibrationToggle: !!vibrationToggle
      });
      return;
    }
    
    // Remove old event listeners first (if any)
    const gameSoundsOldHandler = (gameSoundsToggle as any).__ccToggleHandler;
    const vibrationOldHandler = (vibrationToggle as any).__ccToggleHandler;
    
    if (gameSoundsOldHandler) {
      gameSoundsToggle.removeEventListener('change', gameSoundsOldHandler);
    }
    if (vibrationOldHandler) {
      vibrationToggle.removeEventListener('change', vibrationOldHandler);
    }
    
    // 🔥 CRITICAL: Create handler functions that update status text immediately
    const gameSoundsHandler = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const enabled = target.checked;
      console.log('🔊 Game sounds toggle changed:', enabled);
      
      // Update status text IMMEDIATELY (synchronously)
      const statusEl = document.getElementById('status-game-sounds');
      if (statusEl) {
        statusEl.textContent = enabled ? 'ON' : 'OFF';
        void statusEl.offsetHeight; // Force reflow
        console.log('✅ Game sounds status updated to:', enabled ? 'ON' : 'OFF');
      }
      
      // Update global state
      if ((window as any)._settings) {
        (window as any)._settings.gameSoundsEnabled = enabled;
      }
      if (typeof (window as any).saveSettings === 'function') {
        (window as any).saveSettings((window as any)._settings);
      }
    };
    
    const vibrationHandler = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const enabled = target.checked;
      console.log('📳 Vibration toggle changed:', enabled);
      
      // Update status text IMMEDIATELY (synchronously)
      const statusEl = document.getElementById('status-vibration');
      if (statusEl) {
        statusEl.textContent = enabled ? 'ON' : 'OFF';
        void statusEl.offsetHeight; // Force reflow
        console.log('✅ Vibration status updated to:', enabled ? 'ON' : 'OFF');
      }
      
      // Update global state
      if ((window as any)._settings) {
        (window as any)._settings.hapticsEnabled = enabled;
      }
      if (typeof (window as any).saveSettings === 'function') {
        (window as any).saveSettings((window as any)._settings);
      }
      
      // Only trigger haptic feedback when ENABLING vibration
      if (enabled && typeof (window as any).triggerHapticImpact === 'function') {
        (window as any).triggerHapticImpact('light');
        console.log('✅ Haptic feedback triggered (vibration enabled)');
      }
    };
    
    // Store handlers on elements for cleanup
    (gameSoundsToggle as any).__ccToggleHandler = gameSoundsHandler;
    (vibrationToggle as any).__ccToggleHandler = vibrationHandler;
    
    // Attach event listeners directly to checkboxes
    // Use 'change' event (fires after checkbox state changes, most reliable)
    gameSoundsToggle.addEventListener('change', gameSoundsHandler);
    vibrationToggle.addEventListener('change', vibrationHandler);
    
    console.log('✅ Settings toggle event listeners attached directly to checkboxes');
    
    // Verify initial state
    const gameSoundsStatus = document.getElementById('status-game-sounds');
    const vibrationStatus = document.getElementById('status-vibration');
    
    console.log('🔍 Settings toggle elements verified:', {
      gameSoundsToggle: !!gameSoundsToggle,
      vibrationToggle: !!vibrationToggle,
      gameSoundsStatus: !!gameSoundsStatus,
      vibrationStatus: !!vibrationStatus,
      gameSoundsChecked: gameSoundsToggle.checked,
      vibrationChecked: vibrationToggle.checked,
      gameSoundsStatusText: gameSoundsStatus?.textContent,
      vibrationStatusText: vibrationStatus?.textContent
    });
  }
  
  // Handle game sounds toggle
  private handleGameSoundsToggle(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (!target) {
      console.error('❌ Game sounds toggle: target is null');
      return;
    }
    
    // 🔥 CRITICAL: Read checked state directly from the element (not from event)
    // This ensures we get the current state after the change event
    const enabled = target.checked;
    
    console.log('🔊 Game sounds toggled:', enabled, 'Event type:', event.type, 'Target checked:', target.checked, 'Element checked:', target.checked);
    
    // 🔥 CRITICAL: Update status text SYNCHRONOUSLY (not in requestAnimationFrame)
    // This ensures the text is updated immediately when the toggle changes
    const statusEl = document.getElementById('status-game-sounds');
    if (statusEl) {
      const newStatus = enabled ? 'ON' : 'OFF';
      const oldStatus = statusEl.textContent;
      
      // 🔥 CRITICAL: Clear any existing content first, then set new text
      statusEl.textContent = '';
      statusEl.innerText = '';
      statusEl.textContent = newStatus;
      statusEl.innerText = newStatus; // Also set innerText as fallback
      
      // 🔥 CRITICAL: Force a reflow to ensure the change is visible
      void statusEl.offsetHeight;
      
      console.log('✅ Status text updated from', oldStatus, 'to', newStatus, 'Element:', statusEl, 'Current textContent:', statusEl.textContent, 'Current innerText:', statusEl.innerText);
    } else {
      console.warn('⚠️ Status element not found: status-game-sounds');
      // Try to find it by querySelector as fallback
      const fallbackEl = document.querySelector('#status-game-sounds') as HTMLElement;
      if (fallbackEl) {
        const newStatus = enabled ? 'ON' : 'OFF';
        const oldStatus = fallbackEl.textContent;
        fallbackEl.textContent = '';
        fallbackEl.innerText = '';
        fallbackEl.textContent = newStatus;
        fallbackEl.innerText = newStatus;
        void fallbackEl.offsetHeight; // Force reflow
        console.log('✅ Status text updated via querySelector from', oldStatus, 'to', newStatus, 'Element:', fallbackEl);
      } else {
        console.error('❌ Status element not found even with querySelector');
        // Try to find it by class name
        const classEl = document.querySelector('.settings-toggle-status[id="status-game-sounds"]') as HTMLElement;
        if (classEl) {
          const newStatus = enabled ? 'ON' : 'OFF';
          classEl.textContent = '';
          classEl.innerText = '';
          classEl.textContent = newStatus;
          classEl.innerText = newStatus;
          void classEl.offsetHeight; // Force reflow
          console.log('✅ Status text updated via class selector to', newStatus);
        }
      }
    }
    
    // Update global state
    if ((window as any)._settings) {
      (window as any)._settings.gameSoundsEnabled = enabled;
    }
    
    // Save settings to localStorage
    if (typeof (window as any).saveSettings === 'function') {
      (window as any).saveSettings((window as any)._settings);
    }
    
    // TODO: Implement game sounds logic
  }
  
  // Handle vibration toggle
  private handleVibrationToggle(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (!target) {
      console.error('❌ Vibration toggle: target is null');
      return;
    }
    
    // 🔥 CRITICAL: Read checked state directly from the element (not from event)
    // This ensures we get the current state after the change event
    const enabled = target.checked;
    
    console.log('📳 Vibration toggled:', enabled, 'Event type:', event.type, 'Target checked:', target.checked, 'Element checked:', target.checked);
    
    // 🔥 CRITICAL: Update status text SYNCHRONOUSLY (not in requestAnimationFrame)
    // This ensures the text is updated immediately when the toggle changes
    const statusEl = document.getElementById('status-vibration');
    if (statusEl) {
      const newStatus = enabled ? 'ON' : 'OFF';
      const oldStatus = statusEl.textContent;
      
      // 🔥 CRITICAL: Clear any existing content first, then set new text
      statusEl.textContent = '';
      statusEl.innerText = '';
      statusEl.textContent = newStatus;
      statusEl.innerText = newStatus; // Also set innerText as fallback
      
      // 🔥 CRITICAL: Force a reflow to ensure the change is visible
      void statusEl.offsetHeight;
      
      console.log('✅ Status text updated from', oldStatus, 'to', newStatus, 'Element:', statusEl, 'Current textContent:', statusEl.textContent, 'Current innerText:', statusEl.innerText);
    } else {
      console.warn('⚠️ Status element not found: status-vibration');
      // Try to find it by querySelector as fallback
      const fallbackEl = document.querySelector('#status-vibration') as HTMLElement;
      if (fallbackEl) {
        const newStatus = enabled ? 'ON' : 'OFF';
        const oldStatus = fallbackEl.textContent;
        fallbackEl.textContent = '';
        fallbackEl.innerText = '';
        fallbackEl.textContent = newStatus;
        fallbackEl.innerText = newStatus;
        void fallbackEl.offsetHeight; // Force reflow
        console.log('✅ Status text updated via querySelector from', oldStatus, 'to', newStatus, 'Element:', fallbackEl);
      } else {
        console.error('❌ Status element not found even with querySelector');
        // Try to find it by class name
        const classEl = document.querySelector('.settings-toggle-status[id="status-vibration"]') as HTMLElement;
        if (classEl) {
          const newStatus = enabled ? 'ON' : 'OFF';
          classEl.textContent = '';
          classEl.innerText = '';
          classEl.textContent = newStatus;
          classEl.innerText = newStatus;
          void classEl.offsetHeight; // Force reflow
          console.log('✅ Status text updated via class selector to', newStatus);
        }
      }
    }
    
    // Update global state
    if ((window as any)._settings) {
      (window as any)._settings.hapticsEnabled = enabled;
    }
    
    // Save settings to localStorage
    if (typeof (window as any).saveSettings === 'function') {
      (window as any).saveSettings((window as any)._settings);
    }
    
    // 🔥 CRITICAL: Only trigger haptic feedback when ENABLING vibration, not when disabling
    // This prevents haptic feedback when toggling OFF
    if (enabled && typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact('light');
      console.log('✅ Haptic feedback triggered (vibration enabled)');
    } else {
      console.log('⚠️ Haptic feedback NOT triggered (vibration disabled)');
    }
  }
  
  // Update slider lock state
  private updateSliderLockState(isLocked: boolean): void {
    if (this.elements.sliderContainer) {
      this.elements.sliderContainer.style.pointerEvents = isLocked ? 'none' : 'auto';
    }
  }

  private setNavigationVisibility(visible: boolean): void {
    if (!this.elements.independentNav) return;
    if (visible) {
      // 🔥 CRITICAL: Explicitly set all properties to ensure visibility
      this.elements.independentNav.style.display = 'block';
      this.elements.independentNav.style.visibility = 'visible';
      this.elements.independentNav.style.opacity = '1';
      this.elements.independentNav.removeAttribute('hidden');
      this.elements.independentNav.setAttribute('aria-hidden', 'false');
    } else {
      this.elements.independentNav.style.display = 'none';
      this.elements.independentNav.style.visibility = 'hidden';
      this.elements.independentNav.style.opacity = '0';
      this.elements.independentNav.setAttribute('aria-hidden', 'true');
    }
  }
  
  // Update loading progress (deprecated - launch screen handles its own animations)
  updateLoadingProgress(progress: number): void {
    // 🔥 DEPRECATED: Launch screen module handles its own animations
    // This method is kept for backward compatibility but does nothing
    logger.debug(`📦 Loading progress: ${progress}% (handled by launch-screen module)`);
  }
  
  // Show loading screen (deprecated - use launch-screen module instead)
  showLoadingScreen(): void {
    // 🔥 DEPRECATED: Launch screen module handles its own display
    // This method is kept for backward compatibility but does nothing
    logger.debug('⚠️ showLoadingScreen() is deprecated - use launch-screen module instead');
  }
  
  // Hide loading screen (deprecated - use launch-screen module instead)
  hideLoadingScreen(): void {
    // 🔥 DEPRECATED: Launch screen module handles its own hiding
    // This method is kept for backward compatibility but does nothing
    logger.debug('⚠️ hideLoadingScreen() is deprecated - use launch-screen module instead');
  }
  
  // Get element by ID
  getElement(id: string): HTMLElement | null {
    return this.elements[id as keyof UIManagerElements] as HTMLElement || document.getElementById(id);
  }
  
  // Cleanup
  destroy(): void {
    this.animations.clear();
    this.elements = {} as UIManagerElements;
    this.isInitialized = false;
  }
}

// Create singleton instance
const uiManager = new UIManager();

// Export for use in other modules
// 🔥 CRITICAL: Expose hideSettingsScreenWithAnimation to window for direct access
(window as any).hideSettingsScreenWithAnimation = () => {
  uiManager.hideSettingsScreenWithAnimation();
};

// Also expose uiManager instance to window
(window as any).uiManager = uiManager;

export default uiManager;

// Export class for testing
export { UIManager };

// 🔥 CRITICAL: Export hideCollectiblesScreenWithAnimation to window for back button
(window as any).hideCollectiblesScreenWithAnimation = async () => {
  await uiManager.hideCollectiblesScreenWithAnimation();
};
