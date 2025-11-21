// UI Manager Module
// Handles all UI interactions and animations

import gameState from './game-state.js';
import { fadeOutHome, fadeInHome, animateSliderExit, animateSliderEnter, animateStatsScreenEnter, animateStatsScreenExit } from '../utils/animations.js';
import { showResumeGameBottomSheet } from './resume-game-bottom-sheet.js';
import { logger } from '../core/logger.js';
import { boot as bootGame, layout as layoutGame } from './app-core.js';
import sliderManager from './slider-manager.js';
import { gsap } from 'gsap';

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
  statsButton: HTMLButtonElement | null;
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

  constructor() {
    this.elements = {} as UIManagerElements;
    this.animations = new Map();
    this.isInitialized = false;
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
        statsButton: document.getElementById('btn-stats') as HTMLButtonElement,
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
  private setupEventListeners(): void {
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
    } else {
      console.warn('⚠️ Collectibles button not found! btn-collectibles element missing');
    }
    
    // Settings button
    if (this.elements.settingsButton) {
      this.elements.settingsButton.addEventListener('click', this.handleSettingsClick.bind(this));
    }
    
    if (this.elements.statsBackButton) {
      this.elements.statsBackButton.addEventListener('click', this.handleStatsBackClick.bind(this));
    }
    
    if (this.elements.settingsBackButton) {
      this.elements.settingsBackButton.addEventListener('click', this.handleSettingsBackClick.bind(this));
    }
    
    // Setup settings toggles
    this.setupSettingsToggles();
  }
  
  // Setup state subscriptions
  private setupStateSubscriptions(): void {
    // Homepage visibility
    gameState.subscribe('homepageReady', (isReady: boolean) => {
      if (isReady) {
        this.showHomepage();
      }
    });
    
    // Game active state
    gameState.subscribe('isGameActive', (isActive: boolean) => {
      if (isActive) {
        this.hideHomepage();
      } else {
        this.showHomepage();
      }
    });
    
    // Slider locked state
    gameState.subscribe('sliderLocked', (isLocked: boolean) => {
      this.updateSliderLockState(isLocked);
    });
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
    sliderButtons.forEach((button, index) => {
      const btn = button as HTMLElement;
      console.log(`🔧 DEBUG: Resetting button ${index}:`, btn.id, 'classes:', btn.className);
      
      // Force button to stay at default scale(1) - no animations
      btn.style.transform = 'scale(1) !important';
      btn.style.transition = 'none !important';
      
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
        
        // Ensure button stays at scale(1) - no automatic scaling
        btn.style.transform = 'scale(1) !important';
        btn.style.transition = 'none !important';
        
        console.log(`🔧 DEBUG: Reset complete for button ${index}:`, btn.id);
      }, 50);
    });
    logger.info('🔧 All slider buttons reset');
  }
  
  // Handle stats button click
  private handleStatsClick(event: Event): void {
    event.preventDefault();
    logger.info('📊 Stats button clicked');
    
    // Light haptic for Stats button
    if (typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact('light');
    }
    
    // NO RESET - let :active work normally like Play button
    
    // Play exit animation first, then show stats screen
    this.showStatsScreenWithAnimation();
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
    logger.info('🎁 Collectibles button clicked');
    
    // Light haptic for Collectibles button
    if (typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact('light');
    }
    
    // NO RESET - let :active work normally
    
    // Play exit animation first, then show collectibles screen
    this.showCollectiblesScreenWithAnimation();
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
  
  // Start new game (public method)
  async startNewGame(): Promise<void> {
    try {
      console.log('🎮 ====================================');
      console.log('🎮 START NEW GAME CALLED');
      console.log('🎮 ====================================');
      logger.info('🎮 Starting new game...');
      
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
    if (this.elements.home) {
      this.elements.home.style.display = 'block';
      this.elements.home.removeAttribute('hidden');
      fadeInHome();
    }
  }
  
  // Hide homepage
  hideHomepage(): void {
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
      
      // Also check canvas visibility
      const canvas = appElement.querySelector('canvas');
      if (canvas) {
        canvas.style.display = 'block';
        canvas.style.visibility = 'visible';
        canvas.style.opacity = '1';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        logger.info('✅ Canvas shown and styled');
      } else {
        logger.warn('⚠️ Canvas not found in app element');
      }
    } else {
      logger.error('❌ App element not found!');
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
    const navElement = document.querySelector('nav');
    if (navElement) {
      navElement.style.display = '';
      logger.info('✅ Navigation shown');
    }
  }
  
  // Hide app element
  hideApp(): void {
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.setAttribute('hidden', 'true');
      appElement.style.display = 'none';
      logger.info('✅ App element hidden');
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
  }
  
  // Show homepage QUIETLY - no animations, just show it (for exit flow)
  showHomepageQuietly(): void {
    if (this.elements.home) {
      this.elements.home.style.display = 'block';
      this.elements.home.removeAttribute('hidden');
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

    if (this.elements.statsButton) {
      this.elements.statsButton.focus();
    }
  }
  
  // Show stats screen with exit animation
  private showStatsScreenWithAnimation(): void {
    logger.info('📊 Showing stats screen - with exit animation');
    
    // CRITICAL: Switch to Stats slide (index 1) BEFORE animation so it animates the correct slide
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
    
    // 🎨 CRITICAL: Set background color IMMEDIATELY (no animation) to prevent dark flash
    // This must happen BEFORE exit animation to avoid alpha gap showing dark background
    const body = document.body;
    const globalBg = document.getElementById('global-bg');
    const appElement = document.getElementById('app');
    console.log('🎨 Setting background to solid color IMMEDIATELY - GSAP available:', !!gsap, 'Body:', !!body, 'GlobalBg:', !!globalBg, 'App:', !!appElement);
    if (gsap && body) {
      // Kill any existing animations on body first
      gsap.killTweensOf(body);
      // Remove any CSS transitions that might interfere
      body.style.transition = 'none';
      // Set target background color IMMEDIATELY (no animation) to prevent dark flash
      gsap.set(body, {
        background: '#f3eee8',
        immediateRender: true
      });
      console.log('✅ Body background set immediately to #f3eee8');
    }
    // Set global-bg element if it exists
    if (gsap && globalBg) {
      gsap.killTweensOf(globalBg);
      (globalBg as HTMLElement).style.transition = 'none';
      gsap.set(globalBg, {
        background: '#f3eee8',
        immediateRender: true
      });
      console.log('✅ Global-bg background set immediately to #f3eee8');
    }
    // Set #app element background if it exists (prevents dark flash from app element)
    if (gsap && appElement) {
      gsap.killTweensOf(appElement);
      appElement.style.transition = 'none';
      gsap.set(appElement, {
        background: '#f3eee8',
        immediateRender: true
      });
      console.log('✅ App element background set immediately to #f3eee8');
    }
    
    // Step 1: Play exit animation for Stats slide (background is already set, no dark flash)
    console.log('🎬 Step 1: Playing exit animation for Stats slide');
    animateSliderExit();
    
    // Step 2: Wait for exit animation, then show stats screen
    setTimeout(() => {
      console.log('📊 Step 2: Showing stats screen after exit animation');
      
      const statsScreen = this.elements.statsScreen;
      if (!statsScreen) return;
      
      // Show stats screen after animation
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
    }, 770); // 120ms delay + 650ms animation = 770ms total (was 420ms, increased by 350ms)
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
    const targetGradient = 'linear-gradient(180deg, #f5f5f5 0%, #fcecdf 100%)';
    const targetGlobalBgGradient = 'linear-gradient(180deg, #f5f5f5 0%, #FBE3C5 100%)';
    
    console.log('🎨 [EXIT] Starting smooth background fade to gradient - GSAP:', !!gsap, 'Body:', !!body, 'GlobalBg:', !!globalBg, 'App:', !!appElement);
    
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
        duration: 0.6,
        ease: 'power2.inOut',
        overwrite: 'auto',
        immediateRender: false
      });
      console.log('✅ [EXIT] Body background fade animation started from:', currentBg);
    }
    if (gsap && globalBg) {
      gsap.killTweensOf(globalBg);
      (globalBg as HTMLElement).style.transition = 'none';
      const currentGlobalBg = window.getComputedStyle(globalBg as HTMLElement).background || window.getComputedStyle(globalBg as HTMLElement).backgroundColor || '#f3eee8';
      // CRITICAL: Set initial background explicitly to prevent CSS override
      gsap.set(globalBg, { background: currentGlobalBg || '#f3eee8' });
      gsap.to(globalBg, {
        background: targetGlobalBgGradient,
        duration: 0.6,
        ease: 'power2.inOut',
        overwrite: 'auto',
        immediateRender: false
      });
      console.log('✅ [EXIT] Global-bg background fade animation started from:', currentGlobalBg);
    }
    if (gsap && appElement) {
      gsap.killTweensOf(appElement);
      appElement.style.transition = 'none';
      const currentAppBg = window.getComputedStyle(appElement).background || window.getComputedStyle(appElement).backgroundColor || '#f3eee8';
      // CRITICAL: Set initial background explicitly to prevent CSS override
      gsap.set(appElement, { background: currentAppBg || '#f3eee8' });
      gsap.to(appElement, {
        background: targetGlobalBgGradient,
        duration: 0.6,
        ease: 'power2.inOut',
        overwrite: 'auto',
        immediateRender: false
      });
      console.log('✅ [EXIT] App element background fade animation started from:', currentAppBg);
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
    
    // Hide stats screen after animation completes (600ms)
    // BUT: Background fade animation takes 600ms, so we need to wait for it to complete
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
      // CRITICAL: Do NOT override background animation - it's still running
      this.showHomepageQuietly();
      
      // Step 2: Play enter animation for Stats slide
      console.log('🎬 Playing enter animation for Stats slide');
      animateSliderEnter();
    }, 600);
    
    // CRITICAL: Ensure background animation is NOT killed when homepage is shown
    // The animation should continue running for its full 600ms duration
  }
  
  // Show collectibles screen with exit animation
  private showCollectiblesScreenWithAnimation(): void {
    logger.info('🎁 Showing collectibles screen - with exit animation');
    
    // CRITICAL: Switch to Collectibles slide (index 2) BEFORE animation so it animates the correct slide
    const slides = document.querySelectorAll('.slider-slide');
    const navButtons = document.querySelectorAll('.independent-nav-button');
    slides.forEach((slide, index) => {
      if (index === 2) {
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });
    navButtons.forEach((button, index) => {
      if (index === 2) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // 🎨 CRITICAL: Set background color IMMEDIATELY (no animation) to prevent dark flash
    // This must happen BEFORE exit animation to avoid alpha gap showing dark background
    const body = document.body;
    const globalBg = document.getElementById('global-bg');
    const appElement = document.getElementById('app');
    console.log('🎨 [Collectibles] Setting background to solid color IMMEDIATELY - GSAP available:', !!gsap, 'Body:', !!body, 'GlobalBg:', !!globalBg, 'App:', !!appElement);
    if (gsap && body) {
      gsap.killTweensOf(body);
      body.style.transition = 'none';
      gsap.set(body, {
        background: '#f3eee8',
        immediateRender: true
      });
      console.log('✅ [Collectibles] Body background set immediately to #f3eee8');
    }
    if (gsap && globalBg) {
      gsap.killTweensOf(globalBg);
      (globalBg as HTMLElement).style.transition = 'none';
      gsap.set(globalBg, {
        background: '#f3eee8',
        immediateRender: true
      });
      console.log('✅ [Collectibles] Global-bg background set immediately to #f3eee8');
    }
    if (gsap && appElement) {
      gsap.killTweensOf(appElement);
      appElement.style.transition = 'none';
      gsap.set(appElement, {
        background: '#f3eee8',
        immediateRender: true
      });
      console.log('✅ [Collectibles] App element background set immediately to #f3eee8');
    }
    
    // Step 1: Play exit animation for Collectibles slide (background is already set, no dark flash)
    console.log('🎬 Step 1: Playing exit animation for Collectibles slide');
    animateSliderExit();
    
    // Step 2: Wait for exit animation, then show collectibles screen
    setTimeout(() => {
      console.log('🎁 Step 2: Showing collectibles screen after exit animation');
      
      // Show collectibles screen after animation
      this.showCollectiblesScreen();
    }, 770); // 120ms delay + 650ms animation = 770ms total
  }
  
  // Hide collectibles screen with enter animation
  async hideCollectiblesScreenWithAnimation(): Promise<void> {
    logger.info('🎁 Hiding collectibles screen - with enter animation');
    
    // 🎨 CRITICAL: Animate background color from solid color back to gradient (SMOOTH FADE)
    // This must happen IMMEDIATELY when back button is clicked, BEFORE anything else
    const body = document.body;
    const globalBg = document.getElementById('global-bg');
    const appElement = document.getElementById('app');
    const targetGradient = 'linear-gradient(180deg, #f5f5f5 0%, #fcecdf 100%)';
    const targetGlobalBgGradient = 'linear-gradient(180deg, #f5f5f5 0%, #FBE3C5 100%)';
    
    console.log('🎨 [Collectibles EXIT] Starting smooth background fade to gradient - GSAP:', !!gsap, 'Body:', !!body, 'GlobalBg:', !!globalBg, 'App:', !!appElement);
    
    if (gsap && body) {
      gsap.killTweensOf(body);
      body.style.transition = 'none';
      const currentBg = window.getComputedStyle(body).background || window.getComputedStyle(body).backgroundColor || '#f3eee8';
      gsap.set(body, { background: currentBg || '#f3eee8' });
      gsap.to(body, {
        background: targetGradient,
        duration: 0.6,
        ease: 'power2.inOut',
        overwrite: 'auto',
        immediateRender: false
      });
      console.log('✅ [Collectibles EXIT] Body background fade animation started from:', currentBg);
    }
    if (gsap && globalBg) {
      gsap.killTweensOf(globalBg);
      (globalBg as HTMLElement).style.transition = 'none';
      const currentGlobalBg = window.getComputedStyle(globalBg as HTMLElement).background || window.getComputedStyle(globalBg as HTMLElement).backgroundColor || '#f3eee8';
      gsap.set(globalBg, { background: currentGlobalBg || '#f3eee8' });
      gsap.to(globalBg, {
        background: targetGlobalBgGradient,
        duration: 0.6,
        ease: 'power2.inOut',
        overwrite: 'auto',
        immediateRender: false
      });
      console.log('✅ [Collectibles EXIT] Global-bg background fade animation started from:', currentGlobalBg);
    }
    if (gsap && appElement) {
      gsap.killTweensOf(appElement);
      appElement.style.transition = 'none';
      const currentAppBg = window.getComputedStyle(appElement).background || window.getComputedStyle(appElement).backgroundColor || '#f3eee8';
      gsap.set(appElement, { background: currentAppBg || '#f3eee8' });
      gsap.to(appElement, {
        background: targetGlobalBgGradient,
        duration: 0.6,
        ease: 'power2.inOut',
        overwrite: 'auto',
        immediateRender: false
      });
      console.log('✅ [Collectibles EXIT] App element background fade animation started from:', currentAppBg);
    }
    
    // CRITICAL: Switch to Collectibles slide (index 2) to show Collectibles slide after exiting Collectibles screen
    const slides = document.querySelectorAll('.slider-slide');
    const navButtons = document.querySelectorAll('.independent-nav-button');
    slides.forEach((slide, index) => {
      if (index === 2) {
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });
    navButtons.forEach((button, index) => {
      if (index === 2) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Show homepage QUIETLY first (no animations yet)
    this.showHomepageQuietly();
    
    // 🔥 CRITICAL FIX: Wait for exit animation to complete BEFORE starting enter animation
    const hideCollectibles = window.hideCollectiblesScreen || window.hideCollectibles;
    if (typeof hideCollectibles === 'function') {
      logger.info('🎁 Waiting for collectibles exit animation to complete...');
      await hideCollectibles();
      logger.info('✅ Collectibles exit animation completed, now starting slider enter animation');
      this.setNavigationVisibility(true);
    }
    
    // Step 2: Play enter animation for Collectibles slide AFTER exit animation completes
    console.log('🎬 Playing enter animation for Collectibles slide');
    animateSliderEnter();
  }
  
  // Show collectibles screen
  showCollectiblesScreen(): void {
    logger.info('🎁 Showing collectibles screen');
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
    logger.info('⚙️ Showing settings screen - with exit animation');
    
    // CRITICAL: Switch to Settings slide (index 3) BEFORE animation so it animates the correct slide
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
    
    // 🎨 CRITICAL: Set background color IMMEDIATELY (no animation) to prevent dark flash
    // This must happen BEFORE exit animation to avoid alpha gap showing dark background
    const body = document.body;
    const globalBg = document.getElementById('global-bg');
    const appElement = document.getElementById('app');
    console.log('🎨 [Settings] Setting background to solid color IMMEDIATELY - GSAP available:', !!gsap, 'Body:', !!body, 'GlobalBg:', !!globalBg, 'App:', !!appElement);
    if (gsap && body) {
      gsap.killTweensOf(body);
      body.style.transition = 'none';
      gsap.set(body, {
        background: '#f3eee8',
        immediateRender: true
      });
      console.log('✅ [Settings] Body background set immediately to #f3eee8');
    }
    if (gsap && globalBg) {
      gsap.killTweensOf(globalBg);
      (globalBg as HTMLElement).style.transition = 'none';
      gsap.set(globalBg, {
        background: '#f3eee8',
        immediateRender: true
      });
      console.log('✅ [Settings] Global-bg background set immediately to #f3eee8');
    }
    if (gsap && appElement) {
      gsap.killTweensOf(appElement);
      appElement.style.transition = 'none';
      gsap.set(appElement, {
        background: '#f3eee8',
        immediateRender: true
      });
      console.log('✅ [Settings] App element background set immediately to #f3eee8');
    }
    
    // Step 1: Play exit animation for Settings slide (background is already set, no dark flash)
    console.log('🎬 Step 1: Playing exit animation for Settings slide');
    animateSliderExit();
    
    // Step 2: Wait for exit animation, then show settings screen
    setTimeout(() => {
      console.log('⚙️ Step 2: Showing settings screen after exit animation');
      
      const settingsScreen = this.elements.settingsScreen;
      if (!settingsScreen) return;
      
      // Show settings screen after animation
      this.hideHomepage();
      this.setNavigationVisibility(false);
      
      // 🔥 CRITICAL: Set opacity to 0 FIRST so screen is invisible while GSAP sets initial state
      settingsScreen.style.opacity = '0';
      settingsScreen.style.display = 'flex';
      settingsScreen.removeAttribute('hidden');
      settingsScreen.setAttribute('aria-hidden', 'false');
      
      // 🎬 CRITICAL: Trigger settings screen enter animation (pop-in) using GSAP
      try {
        import('../ui/settings-animations.js').then(({ animateSettingsScreenEnter }) => {
          console.log('🎬 About to call animateSettingsScreenEnter()...');
          // Small delay to ensure DOM is ready, then make screen visible and start animation
          setTimeout(() => {
            // Make screen visible so GSAP can animate individual elements
            settingsScreen.style.opacity = '1';
            console.log('🎬 Calling animateSettingsScreenEnter() after 50ms delay...');
            animateSettingsScreenEnter();
          }, 50);
        });
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
    }, 770);
  }
  
  // Hide settings screen with enter animation
  private hideSettingsScreenWithAnimation(): void {
    logger.info('⚙️ Hiding settings screen - with enter animation');
    
    // 🎨 CRITICAL: Animate background color from solid color back to gradient (SMOOTH FADE)
    // This must happen IMMEDIATELY when back button is clicked, BEFORE anything else
    const body = document.body;
    const globalBg = document.getElementById('global-bg');
    const appElement = document.getElementById('app');
    const targetGradient = 'linear-gradient(180deg, #f5f5f5 0%, #fcecdf 100%)';
    const targetGlobalBgGradient = 'linear-gradient(180deg, #f5f5f5 0%, #FBE3C5 100%)';
    
    console.log('🎨 [Settings EXIT] Starting smooth background fade to gradient - GSAP:', !!gsap, 'Body:', !!body, 'GlobalBg:', !!globalBg, 'App:', !!appElement);
    
    if (gsap && body) {
      gsap.killTweensOf(body);
      body.style.transition = 'none';
      const currentBg = window.getComputedStyle(body).background || window.getComputedStyle(body).backgroundColor || '#f3eee8';
      gsap.set(body, { background: currentBg || '#f3eee8' });
      gsap.to(body, {
        background: targetGradient,
        duration: 0.6,
        ease: 'power2.inOut',
        overwrite: 'auto',
        immediateRender: false
      });
      console.log('✅ [Settings EXIT] Body background fade animation started from:', currentBg);
    }
    if (gsap && globalBg) {
      gsap.killTweensOf(globalBg);
      (globalBg as HTMLElement).style.transition = 'none';
      const currentGlobalBg = window.getComputedStyle(globalBg as HTMLElement).background || window.getComputedStyle(globalBg as HTMLElement).backgroundColor || '#f3eee8';
      gsap.set(globalBg, { background: currentGlobalBg || '#f3eee8' });
      gsap.to(globalBg, {
        background: targetGlobalBgGradient,
        duration: 0.6,
        ease: 'power2.inOut',
        overwrite: 'auto',
        immediateRender: false
      });
      console.log('✅ [Settings EXIT] Global-bg background fade animation started from:', currentGlobalBg);
    }
    if (gsap && appElement) {
      gsap.killTweensOf(appElement);
      appElement.style.transition = 'none';
      const currentAppBg = window.getComputedStyle(appElement).background || window.getComputedStyle(appElement).backgroundColor || '#f3eee8';
      gsap.set(appElement, { background: currentAppBg || '#f3eee8' });
      gsap.to(appElement, {
        background: targetGlobalBgGradient,
        duration: 0.6,
        ease: 'power2.inOut',
        overwrite: 'auto',
        immediateRender: false
      });
      console.log('✅ [Settings EXIT] App element background fade animation started from:', currentAppBg);
    }
    
    // 🎬 CRITICAL: Trigger settings screen exit animation (pop-out) BEFORE hiding
    try {
      import('../ui/settings-animations.js').then(({ animateSettingsScreenExit }) => {
        console.log('🎬 About to call animateSettingsScreenExit()...');
        animateSettingsScreenExit();
      });
    } catch (error) {
      console.error('❌ Failed to trigger settings exit animation:', error);
    }
    
    // Hide settings screen after animation completes (600ms)
    setTimeout(() => {
      const settingsScreen = this.elements.settingsScreen;
      if (settingsScreen) {
        settingsScreen.setAttribute('aria-hidden', 'true');
        settingsScreen.style.display = 'none';
        settingsScreen.setAttribute('hidden', 'true');
        this.setNavigationVisibility(true);
      }
      
      // CRITICAL: Switch to Settings slide (index 3) to show Settings slide after exiting Settings screen
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
      
      // Show homepage QUIETLY first (no animations yet)
      this.showHomepageQuietly();
      
      // Step 2: Play enter animation for Settings slide
      console.log('🎬 Playing enter animation for Settings slide');
      animateSliderEnter();
    }, 600);
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
    logger.info('⚙️ Settings back button clicked');
    
    // Light haptic
    if (typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact('light');
    }
    
    this.hideSettingsScreenWithAnimation();
  }
  
  // Setup settings toggles
  private setupSettingsToggles(): void {
    const gameSoundsToggle = document.getElementById('toggle-game-sounds');
    const vibrationToggle = document.getElementById('toggle-vibration');
    
    if (gameSoundsToggle) {
      gameSoundsToggle.addEventListener('change', this.handleGameSoundsToggle.bind(this));
    }
    
    if (vibrationToggle) {
      vibrationToggle.addEventListener('change', this.handleVibrationToggle.bind(this));
    }
  }
  
  // Handle game sounds toggle
  private handleGameSoundsToggle(event: Event): void {
    const target = event.target as HTMLInputElement;
    const enabled = target.checked;
    
    console.log('🔊 Game sounds toggled:', enabled);
    
    // Update status text
    const statusEl = document.getElementById('status-game-sounds');
    if (statusEl) {
      statusEl.textContent = enabled ? 'ON' : 'OFF';
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
    const enabled = target.checked;
    
    console.log('📳 Vibration toggled:', enabled);
    
    // Update status text
    const statusEl = document.getElementById('status-vibration');
    if (statusEl) {
      statusEl.textContent = enabled ? 'ON' : 'OFF';
    }
    
    // Update global state
    if ((window as any)._settings) {
      (window as any)._settings.hapticsEnabled = enabled;
    }
    
    // Save settings to localStorage
    if (typeof (window as any).saveSettings === 'function') {
      (window as any).saveSettings((window as any)._settings);
    }
    
    // Light haptic to confirm toggle
    if (enabled && typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact('light');
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
    this.elements.independentNav.style.display = visible ? '' : 'none';
    this.elements.independentNav.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }
  
  // Update loading progress
  updateLoadingProgress(progress: number): void {
    if (this.elements.loadingFill) {
      this.elements.loadingFill.style.width = `${progress}%`;
    }
    
    // Only show number, CSS ::after adds the % symbol
    if (this.elements.loadingPercentage) {
      this.elements.loadingPercentage.textContent = `${Math.round(progress)}`;
    }
    
    // Update ARIA attributes for accessibility
    const progressBar = document.querySelector('.loading-bar-container');
    if (progressBar) {
      progressBar.setAttribute('aria-valuenow', Math.round(progress).toString());
    }
  }
  
  // Show loading screen
  showLoadingScreen(): void {
    // 🔥 CRITICAL FIX: Prevent showing loading screen if app is already initialized
    // This prevents crash when opening stats screen after long gameplay
    const isAppInitialized = (window as any).__cube_crash_ui_bootstrapped__ === true;
    if (isAppInitialized) {
      console.warn('⚠️ Attempted to show loading screen after app initialization - ignoring');
      logger.warn('⚠️ Attempted to show loading screen after app initialization - ignoring');
      return;
    }
    
    if (this.elements.loadingScreen) {
      this.elements.loadingScreen.style.display = 'flex';
      this.elements.loadingScreen.classList.remove('hidden');
    }
  }
  
  // Hide loading screen
  hideLoadingScreen(): void {
    if (this.elements.loadingScreen) {
      this.elements.loadingScreen.style.display = 'none';
      this.elements.loadingScreen.classList.add('hidden');
    }
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
export default uiManager;

// Export class for testing
export { UIManager };

// 🔥 CRITICAL: Export hideCollectiblesScreenWithAnimation to window for back button
(window as any).hideCollectiblesScreenWithAnimation = async () => {
  await uiManager.hideCollectiblesScreenWithAnimation();
};
