// UI Manager Module
// Handles all UI interactions and animations

import gameState from './game-state.js';
import { fadeOutHome, fadeInHome, animateSliderExit } from '../utils/animations.js';
import { logger } from '../core/logger.js';

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
  
  // Handle stats button click
  private handleStatsClick(event: Event): void {
    event.preventDefault();
    logger.info('📊 Stats button clicked');
    
    // Show stats screen
    this.showStatsScreen();
  }

  private handleStatsBackClick(event: Event): void {
    event.preventDefault();
    logger.info('📊 Stats back button clicked');
    this.hideStatsScreen();
  }
  
  // Handle collectibles button click
  private handleCollectiblesClick(event: Event): void {
    event.preventDefault();
    logger.info('🎁 Collectibles button clicked');
    
    // Show collectibles screen
    this.showCollectiblesScreen();
  }
  
  // Handle settings button click
  private handleSettingsClick(event: Event): void {
    event.preventDefault();
    logger.info('⚙️ Settings button clicked');
    
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
        // Import resume sheet utilities
        const { showResumeGameBottomSheet } = await import('./resume-game-bottom-sheet.js');
        const { setModalOptions } = await import('./resume-sheet-utils.js');
        
        // Set modal options with callbacks
        setModalOptions({
          resume: () => {
            logger.info('▶️ Continue - resuming game...');
            console.log('▶️ Continue button clicked - starting game...');
            setTimeout(() => this.startNewGame(), 100);
          },
          pause: () => {
            logger.info('🔄 New Game - starting fresh...');
            console.log('🔄 New Game button clicked - starting game...');
            setTimeout(() => this.startNewGame(), 100);
          }
        });
        
        // Show resume game modal
        showResumeGameBottomSheet();
      } else {
        logger.info('🎮 No saved game, starting new game...');
        // Start new game
        this.startNewGame();
      }
    } catch (error) {
      logger.error('❌ Failed to check for saved game:', error);
      // Fallback to new game
      this.startNewGame();
    }
  }
  
  // Start new game (public method)
  async startNewGame(): Promise<void> {
    try {
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
      
      logger.info('✅ Game state set, starting game...');
      
      // CRITICAL: Always play exit animation first, even when coming from resume sheet
      logger.info('🎬 Playing exit animation before starting game...');
      animateSliderExit();
      
      // Wait for exit animation to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      logger.info('✅ Exit animation complete, hiding homepage...');
      
      // Hide homepage after exit anim
      this.hideHomepage();
      
      // Show app element (CRITICAL!)
      this.showApp();
      
      logger.info('✅ App element shown, importing app.js...');
      
      // Start game
      try {
        logger.info('✅ Importing app-core...');
        const { boot, layout } = await import('./app-core.js');
        
        logger.info('✅ App.js imported, calling boot()...');
        
        await boot();
        
        logger.info('✅ Boot completed, calling layout()...');
        
        await layout();
        
        logger.info('✅ Layout completed successfully!');
      
      // CRITICAL: Verify canvas exists and is visible
      setTimeout(() => {
        const appEl = document.getElementById('app');
        const canvas = appEl?.querySelector('canvas');
        console.log('🔍 POST-BOOT CHECK:');
        console.log('  → App element:', appEl);
        console.log('  → Canvas:', canvas);
        console.log('  → Canvas in DOM:', canvas ? document.body.contains(canvas) : 'NO CANVAS');
        console.log('  → Canvas parent:', canvas?.parentElement);
        console.log('  → Canvas dimensions:', canvas ? `${canvas.width}x${canvas.height}` : 'NO CANVAS');
        console.log('  → Canvas display:', canvas ? getComputedStyle(canvas).display : 'NO CANVAS');
        console.log('  → Canvas visibility:', canvas ? getComputedStyle(canvas).visibility : 'NO CANVAS');
        console.log('  → Canvas opacity:', canvas ? getComputedStyle(canvas).opacity : 'NO CANVAS');
        console.log('  → App display:', appEl ? getComputedStyle(appEl).display : 'NO APP');
        console.log('  → App visibility:', appEl ? getComputedStyle(appEl).visibility : 'NO APP');
        console.log('  → App opacity:', appEl ? getComputedStyle(appEl).opacity : 'NO APP');
        console.log('  → App z-index:', appEl ? getComputedStyle(appEl).zIndex : 'NO APP');
      }, 500);
      
      } catch (error) {
        logger.error('❌ Failed to start game:', error);
        logger.error('❌ Error details:', (error as Error).stack);
        throw error;
      }
      
    } catch (error) {
      logger.error('❌ Failed to start new game:', error);
      logger.error('❌ Error details:', (error as Error).stack);
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
      fadeOutHome();
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
        console.log('✅ Canvas dimensions:', canvas.width, 'x', canvas.height);
        console.log('✅ Canvas computed style:', window.getComputedStyle(canvas));
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
      this.elements.home.style.opacity = '0';
      this.elements.home.style.transition = 'opacity 0.6s ease';
      setTimeout(() => {
        fadeInHome();
      }, 50);
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
