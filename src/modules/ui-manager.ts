// UI Manager Module
// Handles all UI interactions and animations

import gameState from './game-state.js';
import { fadeOutHome, fadeInHome, animateSliderExit, animateSliderEnter, animateStatsScreenEnter, animateStatsScreenExit } from '../utils/animations.js';
import { showResumeGameBottomSheet } from './resume-game-bottom-sheet.js';
import { logger } from '../core/logger.js';
import { boot as bootGame, layout as layoutGame } from './app-core.js';

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
    }
    
    // Settings button
    if (this.elements.settingsButton) {
      this.elements.settingsButton.addEventListener('click', this.handleSettingsClick.bind(this));
    }
    
    if (this.elements.statsBackButton) {
      this.elements.statsBackButton.addEventListener('click', this.handleStatsBackClick.bind(this));
    }
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
  private handlePlayClick(event: Event): void {
    event.preventDefault();
    logger.info('🎮 Play button clicked');
    
    // Check for saved game
    this.checkForSavedGame();
  }
  
  // Reset all slider buttons to prevent :active state persistence
  private resetAllSliderButtons(): void {
    // Get both old .slide-button AND new .primary-button elements
    const sliderButtons = document.querySelectorAll('.slider-slide .slide-button, .slider-slide .primary-button');
    sliderButtons.forEach(button => {
      const btn = button as HTMLElement;
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
      }, 50);
    });
    logger.info('🔧 All slider buttons reset');
  }
  
  // Handle stats button click
  private handleStatsClick(event: Event): void {
    event.preventDefault();
    logger.info('📊 Stats button clicked');
    
    // CRITICAL: Reset ALL slider CTAs to prevent :active state from persisting
    this.resetAllSliderButtons();
    
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
    
    // CRITICAL: Reset ALL slider CTAs to prevent :active state from persisting
    this.resetAllSliderButtons();
    
    // Show collectibles screen
    this.showCollectiblesScreen();
  }
  
  // Handle settings button click
  private handleSettingsClick(event: Event): void {
    event.preventDefault();
    logger.info('⚙️ Settings button clicked');
    
    // CRITICAL: Reset ALL slider CTAs to prevent :active state from persisting
    this.resetAllSliderButtons();
    
    // Show settings screen
    this.showSettingsScreen();
  }
  
  // Check for saved game
  private async checkForSavedGame(): Promise<void> {
    try {
      logger.info('🔍 Checking for saved game...');
      const savedGame = localStorage.getItem('cc_saved_game');
      logger.info('🔍 Saved game found:', !!savedGame, savedGame ? 'YES' : 'NO');
      
      // Show resume sheet ONLY if saved game exists
      if (savedGame) {
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
      console.log('✅ Old saved game cleared');
      
      // Start game
      console.log('🎯 Starting game boot...');
      try {
        // Use static import instead of dynamic import for instant response
        console.log('✅ app-core already available (static import)');
        
        await bootGame();
        console.log('✅ boot() complete');
        
        await layoutGame();
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
    logger.info('📊 Showing stats screen - no exit animation');
    
    const statsScreen = this.elements.statsScreen;
    if (!statsScreen) return;
    
    // Show stats screen immediately - NO exit animation
    this.hideHomepage();
    this.setNavigationVisibility(false);
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
    
    // Focus immediately
    setTimeout(() => {
      const focusTarget = statsScreen.querySelector('.stats-back-button') as HTMLElement | null;
      focusTarget?.focus();
    }, 100);
  }
  
  // Hide stats screen with enter animation
  private hideStatsScreenWithAnimation(): void {
    logger.info('📊 Hiding stats screen - no exit animation');
    
    // Hide stats screen immediately - NO exit animation
    const statsScreen = this.elements.statsScreen;
    if (statsScreen) {
      statsScreen.setAttribute('aria-hidden', 'true');
      statsScreen.style.display = 'none';
      statsScreen.setAttribute('hidden', 'true');
      this.setNavigationVisibility(true);
    }
    
    // NUCLEAR OPTION: Remove and recreate Stats button to reset everything
    const statsCTA = document.getElementById('btn-stats');
    const statsSlide = document.querySelector('.slider-slide[data-slide="1"]');
    if (statsCTA && statsSlide) {
      console.log('🔧 NUCLEAR: Removing Stats button to reset everything...');
      
      // Find the button's parent
      const buttonParent = statsCTA.parentElement;
      if (buttonParent) {
        // Remove the button completely
        statsCTA.remove();
        
        // Create a fresh button
        const newButton = document.createElement('button');
        newButton.id = 'btn-stats';
        newButton.className = 'primary-button';
        newButton.textContent = 'Stats';
        newButton.setAttribute('type', 'button');
        newButton.setAttribute('aria-label', 'View Stats');
        
        // Add click handler
        newButton.addEventListener('click', this.handleStatsClick.bind(this));
        
        // Insert the new button
        buttonParent.appendChild(newButton);
        
        // Re-register in elements cache
        this.elements.statsButton = newButton as HTMLButtonElement;
        
        console.log('✅ Stats button completely recreated');
      }
    }
    
    // CRITICAL: Switch to Play slide (index 0) AFTER reset to prevent Stats CTA animation
    const slides = document.querySelectorAll('.slider-slide');
    const navButtons = document.querySelectorAll('.independent-nav-button');
    slides.forEach((slide, index) => {
      if (index === 0) {
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });
    navButtons.forEach((button, index) => {
      if (index === 0) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Show homepage QUIETLY first (no animations yet)
    this.showHomepageQuietly();
    
    // NO SLIDER ANIMATIONS - show homepage instantly after Stats
    // animateSliderEnter(); // DISABLED - causing CTA scale issues
    
    // Focus immediately
    if (this.elements.statsButton) {
      this.elements.statsButton.focus();
    }
    
    // CRITICAL: Also set up a MutationObserver to reset Stats button when Stats slide becomes active again
    if (statsSlide) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const target = mutation.target as HTMLElement;
            if (target.classList.contains('active')) {
              // Stats slide became active - reset the button
              const statsBtn = target.querySelector('#btn-stats');
              if (statsBtn) {
                const btn = statsBtn as HTMLElement;
                console.log('🔧 Stats slide became active - resetting button...');
                btn.style.transform = '';
                btn.style.transition = '';
                btn.blur();
                btn.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
              }
            }
          }
        });
      });
      observer.observe(statsSlide, { attributes: true, attributeFilter: ['class'] });
      
      // Clean up observer after 5 seconds (enough time for any slide switching)
      setTimeout(() => {
        observer.disconnect();
      }, 5000);
    }
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
  showSettingsScreen(): void {
    logger.info('⚙️ Showing settings screen');
    // Implementation will be added
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
