// @ts-nocheck
// UI Manager Module
// Handles all UI interactions and animations

import gameState from './game-state.js';
import {
  fadeOutHome,
  fadeInHome,
  animateSliderExit,
  animateSliderEnter,
  animateJourneySliderExit,
  cancelSliderEnterAnimation,
  finalizeJourneySliderExit,
} from '../utils/animations.js';
import { logger } from '../core/logger.js';
import { boot as bootGame, layoutBoard as layoutGame } from './app-core.js';
import memoryManager from '../utils/memory-manager.js';
import sliderManager from './slider-manager.js';
import { sliderState } from './slider-state.js';
import { gsap } from 'gsap';
import { markArcadeHomeRunOrigin } from './run-mode.js';
import { activateFirstPlayTutorialWhenReady, beginFirstPlayTutorialRun } from './first-play-tutorial.js';
import { SETTINGS_SLIDE_INDEX } from './shop-module.js';
import { clearArcadeSaveState, getArcadeSavedRound, hasArcadeSavedState } from '../utils/board-save-utils.js';
import { applyAppPaperBackground } from '../utils/app-paper-background.js';
import { journeySpatialMotion } from './journey-spatial-motion.js';
import { homepageEnterTransitionOwner } from './homepage-enter-transition-owner.js';
import {
  beginArcadeEntryCue,
  cancelArcadeEntryCueOwner,
  resetArcadeEntryCueOwner,
  shouldOverlapArcadeEntryCueWithColdBoot,
} from './arcade-entry-cue-owner.js';
import { registerCta, type CtaController } from './cta-system.js';
import {
  commitHomepageNavigation,
  hideHomepageNavigation,
  primeHomepageNavigation,
} from './navigation-control.js';
// 🔥 OPTIMIZATION: Preload settings animations module statically to avoid 15s delay on Settings click
import { animateSettingsScreenEnter, animateSettingsScreenExit, cleanupSettingsAnimations } from '../ui/settings-animations.js';

const SETTINGS_BACK_TAP_BOUNCE_EXIT_DELAY_MS = 0;

function playDomSoftCartoonBounce(target: HTMLElement | null): void {
  if (!target) return;

  try {
    gsap.killTweensOf(target);
    gsap.set(target, {
      scale: 1,
      transformOrigin: '50% 50%',
      willChange: 'transform',
      force3D: true,
    });

    gsap.timeline({
      defaults: { force3D: true },
      onComplete: () => {
        gsap.set(target, {
          scale: 1,
          clearProps: 'scale,willChange,force3D',
        });
      },
    })
      .to(target, {
        scale: 1.18,
        duration: 0.12,
        ease: 'back.out(2.2)',
      })
      .to(target, {
        scale: 0.93,
        duration: 0.09,
        ease: 'power2.out',
      })
      .to(target, {
        scale: 1,
        duration: 0.17,
        ease: 'back.out(1.9)',
      });
  } catch (err) {
    logger.warn('⚠️ Error playing soft cartoon bounce:', err);
  }
}

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

export function applyPaperBackground(): void {
  applyAppPaperBackground();
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
  sliderDivider: Element | null;
  playButton: HTMLButtonElement | null;
  journeyButton: HTMLButtonElement | null;
  collectiblesButton: HTMLButtonElement | null;
  settingsButton: HTMLButtonElement | null;
  settingsScreen: HTMLElement | null;
  settingsBackButton: HTMLButtonElement | null;
  independentNav: HTMLElement | null;
}

class UIManager {
  private elements: UIManagerElements;
  private animations: Map<string, any>;
  private isInitialized: boolean;
  private logoFadeInStarted: boolean; // 🔥 PREMIUM: Track if logo fade-in has started
  private homepageCtaControllers = new Map<HTMLButtonElement, CtaController>();

  constructor() {
    this.elements = {} as UIManagerElements;
    this.animations = new Map();
    this.isInitialized = false;
    this.logoFadeInStarted = false;
  }

  private registerHomepageCtaButtons(): void {
    const registrations: Array<[HTMLButtonElement | null, (event: Event) => unknown]> = [
      [this.elements.playButton, this.handlePlayClick.bind(this)],
      [this.elements.journeyButton, this.handleStatsClick.bind(this)],
      [this.elements.collectiblesButton, this.handleCollectiblesClick.bind(this)],
      [this.elements.settingsButton, this.handleSettingsClick.bind(this)],
    ];

    const liveButtons = new Set<HTMLButtonElement>();
    registrations.forEach(([button, handler]) => {
      if (!button) return;
      liveButtons.add(button);
      button.classList.remove('tap-scale', 'menu-btn-primary');
      button.classList.add('cc-homepage-cta');
      // Startup and Homepage restore paths can both request listener attachment.
      // Preserve the active controller so a late reattach cannot interrupt the
      // first pointer release or the CTA's route-exit animation.
      if (this.homepageCtaControllers.has(button)) return;
      const activeSlide = button.closest('.slider-slide')?.classList.contains('active') === true;
      const initialState = activeSlide && button.classList.contains('animate-enter-initial') ? 'hidden' : 'idle';
      this.homepageCtaControllers.set(button, registerCta(button, {
        variant: 'primary',
        initialState,
        // Homepage navigation must hand off on the actual pointer release.
        // Waiting for the full shared release bounce makes a quick tap feel
        // ignored before the route-owned CTA exit can begin.
        activationTiming: 'immediate',
        activateOnCapturedRelease: true,
        onActivate: () => handler(new Event('cta-activate')),
      }));
    });

    this.homepageCtaControllers.forEach((controller, button) => {
      if (liveButtons.has(button) && button.isConnected) return;
      controller.dispose();
      this.homepageCtaControllers.delete(button);
    });
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
        sliderDivider: document.querySelector('.slider-nav-divider'),
        playButton: document.getElementById('btn-home') as HTMLButtonElement,
        journeyButton: (document.getElementById('btn-journey') || document.getElementById('btn-stats')) as HTMLButtonElement,
        collectiblesButton: document.getElementById('btn-collectibles') as HTMLButtonElement,
        settingsButton: document.getElementById('btn-settings') as HTMLButtonElement,
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

  // Dev test/log buttons removed (no longer needed)
  
  // Setup event listeners
  // 🔥 Helper method to reattach homepage button listeners (called after cleanup)
  // 🔥 Made PUBLIC so it can be called from collectibles-manager when returning to homepage
  public reattachHomepageButtonListeners(): void {
    // Also refresh element references to ensure we're using the latest DOM elements
    try {
      // Refresh element references
      this.elements.playButton = document.getElementById('btn-home') as HTMLButtonElement;
      this.elements.journeyButton = (document.getElementById('btn-journey') || document.getElementById('btn-stats')) as HTMLButtonElement;
      this.elements.collectiblesButton = document.getElementById('btn-collectibles') as HTMLButtonElement;
      this.elements.settingsButton = document.getElementById('btn-settings') as HTMLButtonElement;
      this.elements.statsBackButton = document.getElementById('stats-back-btn') as HTMLButtonElement;

      this.detachSliderHeroCtaListeners();

      // Helper to add listener and track it (same as in setupEventListeners)
      const addTrackedListener = (element: HTMLElement, event: string, handler: EventListener) => {
        element.addEventListener(event, handler);
        if (!this.boundEventHandlers.has(element)) {
          this.boundEventHandlers.set(element, []);
        }
        this.boundEventHandlers.get(element)!.push({ event, handler });
      };
      
      this.registerHomepageCtaButtons();

      this.attachSliderHeroCtaListeners(addTrackedListener);

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
    
    this.registerHomepageCtaButtons();
    
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

    this.attachSliderHeroCtaListeners(addTrackedListener);
  }
  
  // 🔥 MEMORY LEAK FIX: Store unsubscribe functions for cleanup
  private unsubscribeFunctions: (() => void)[] = [];
  private boundEventHandlers: Map<HTMLElement, Array<{ event: string; handler: EventListener }>> = new Map();

  private detachSliderHeroCtaListeners(): void {
    const selectors = [
      '[data-hero-cta="play"]',
      '[data-hero-cta="journey"]',
      '[data-hero-cta="collectibles"]',
      '[data-hero-cta="settings"]',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el || !this.boundEventHandlers.has(el)) continue;
      const oldHandlers = this.boundEventHandlers.get(el)!;
      oldHandlers.forEach(({ event, handler }) => {
        el.removeEventListener(event, handler);
      });
      this.boundEventHandlers.delete(el);
    }
  }

  private attachSliderHeroCtaListeners(
    addTrackedListener: (element: HTMLElement, event: string, handler: EventListener) => void
  ): void {
    const attachPair = (selector: string, clickHandler: EventListener) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el || this.boundEventHandlers.has(el)) return;

      const keyHandler: EventListener = (event: Event) => {
        const keyEvent = event as KeyboardEvent;
        if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') return;
        keyEvent.preventDefault();
        (clickHandler as (ev: Event) => unknown)(keyEvent);
      };

      addTrackedListener(el, 'click', clickHandler);
      addTrackedListener(el, 'keydown', keyHandler);
    };

    attachPair('[data-hero-cta="play"]', this.handlePlayClick.bind(this));
    attachPair('[data-hero-cta="journey"]', this.handleStatsClick.bind(this));
    attachPair('[data-hero-cta="collectibles"]', this.handleCollectiblesClick.bind(this));
    attachPair('[data-hero-cta="settings"]', this.handleSettingsClick.bind(this));
  }
  
  // Setup state subscriptions
  private setupStateSubscriptions(): void {
    // 🔥 MEMORY LEAK FIX: Store unsubscribe functions
    // Homepage visibility
    const unsubscribeHomepageReady = gameState.subscribe('homepageReady', (isReady: boolean) => {
      if (isReady && !homepageEnterTransitionOwner.isActive()) {
        this.showHomepage();
      }
    });
    this.unsubscribeFunctions.push(unsubscribeHomepageReady);
    
    // Game active state
    const unsubscribeGameActive = gameState.subscribe('isGameActive', (isActive: boolean) => {
      if (isActive) {
        this.hideHomepage();
      } else if (!homepageEnterTransitionOwner.isActive()) {
        this.showHomepage();
      }
    });
    this.unsubscribeFunctions.push(unsubscribeGameActive);
    
    // 🔥 REMOVED: Slider locked state subscription - SliderManager handles this exclusively
    // Having dual subscriptions caused desynchronization issues
  }
  
  // Handle play button click
  private async handlePlayClick(event: Event): Promise<void> {
    event.preventDefault();
    logger.info('🎮 Play button clicked');
    
    // Light haptic for Play button (same as other slider CTA buttons)
    if (typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact('light');
    }

    // IMPORTANT: Do not clear board-specific Journey saves here.
    markArcadeHomeRunOrigin();
    try {
      localStorage.removeItem('cc_saved_game');
      localStorage.removeItem('cc_board_completed');
      localStorage.removeItem('cubeCrash_gameState');
      logger.info('🧹 Home Play: cleared transient global save keys (Journey and Arcade saves preserved)');
    } catch (error) {
      logger.warn('⚠️ Home Play: failed to clear saves before one-time run:', error);
    }

    const shouldResumeArcade = hasArcadeSavedState();
    if ((window as any).triggerGameStartSequence) {
      (window as any).triggerGameStartSequence({ resumeArcade: shouldResumeArcade });
    } else {
      if (shouldResumeArcade) {
        this.startNewGameWithSavedState();
      } else {
        this.startNewGame();
      }
    }
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

  // Handle collectibles button click
  private handleCollectiblesClick(event: Event): void {
    event.preventDefault();
    logger.info('🏆 Collectibles button clicked');
    
    // Light haptic for Collectibles button
    if (typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact('light');
    }
    
    // Show collectibles screen with animation
    this.showCollectiblesScreenWithAnimation();
  }
  
  // Handle stats back button click (return to homepage)
  private handleStatsBackClick(event: Event): void {
    event.preventDefault();
    logger.info('⬅️ Stats back button clicked');
    
    // Light haptic for back button
    if (typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact('light');
    }
    
    // Return to homepage
    this.hideCollectiblesScreenWithAnimation();
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
  
  // Start new game (public method) - ALWAYS starts from Board 1
  async startNewGame(): Promise<void> {
    memoryManager.start();
    const shouldStartFirstPlayTutorial = beginFirstPlayTutorialRun('arcade');
    // 🔥 USER REQUEST: Mark that we came from homepage (not Journey)
    markArcadeHomeRunOrigin();
    // Ensure fresh Arcade run always triggers HUD entry/drop initialization.
    (window as any).__ccTriggerHudDrop = true;
    // The first-play tutorial owns its board introduction, so it must not be
    // preceded by the regular Round 01 cue. Every later fresh Arcade run keeps
    // the established current-Round intro.
    if (shouldStartFirstPlayTutorial) {
      delete (window as any).__ccArcadeContinuationCueRound;
    } else {
      (window as any).__ccArcadeContinuationCueRound = 1;
    }
    resetArcadeEntryCueOwner();
    logger.info('🏠 Marked as coming from homepage (startNewGame)');
    try {
      console.log('🎮 ====================================');
      console.log('🎮 START NEW GAME CALLED (Board 1)');
      console.log('🎮 ====================================');
      logger.info('🎮 Starting new game from Board 1...');
      
      // Set game state
      gameState.setState({
        isGameActive: true,
        isPaused: false,
        isGameEnded: false,
        score: 0,
        level: 1,
        combo: 0
      });
      
      // 🔥 CRITICAL FIX: Reset gamePaused flag to ensure dragging works in new game
      try {
        const { container } = await import('../core/dependency-injection.js');
        if (container && typeof container.set === 'function') {
          container.set('gamePaused', false);
        }
      } catch (e) { /* ignore */ }
      (window as any)._gamePaused = false;
      
      console.log('✅ Game state set (gamePaused reset)');
      // Clear old global/transient saved game state for new game. Arcade run state is kept for resume.
      console.log('🧹 Clearing old transient saved game state...');
      localStorage.removeItem('cc_saved_game');
      localStorage.removeItem('cc_board_completed');
      localStorage.removeItem('cubeCrash_gameState');
      clearArcadeSaveState();
      console.log('✅ Old transient saved game cleared');
      
      // Start game
      console.log('🎯 Starting game boot...');
      try {
        // Ensure no stale level-flow spawn timers from previous run can leak into a fresh board.
        try {
          const flow = await import('./level-flow.js');
          flow.cleanupLevelFlowTimeouts?.();
        } catch (e) {
          console.warn('⚠️ Failed to cleanup level-flow timeouts before startNewGame:', e);
        }

        // Use static import instead of dynamic import for instant response
        console.log('✅ app-core already available (static import)');
        
        await bootGame();
        console.log('✅ boot() complete');
        
        // layout() is synchronous, no await needed
        layoutGame();
        console.log('✅ layout() complete');
        
	        // Clear one-shot flags after boot/layout has consumed them.
	        delete (window as any).__ccTriggerHudDrop;
	        delete (window as any).__ccBoardJustCompleted;
	        delete (window as any).__ccArcadePlayAgainStarting;
        
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
        if (shouldStartFirstPlayTutorial) {
          activateFirstPlayTutorialWhenReady();
        }
        
        console.log('🎮 ====================================');
        console.log('🎮 GAME STARTED SUCCESSFULLY');
        console.log('🎮 ====================================');
      
      } catch (error) {
        console.error('❌ Game boot failed:', error);
        logger.error('❌ Failed to start game:', error);
        throw error;
      }
      
    } catch (error) {
      delete (window as any).__ccTriggerHudDrop;
      delete (window as any).__ccArcadeContinuationCueRound;
      cancelArcadeEntryCueOwner();
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
      markArcadeHomeRunOrigin();
      (window as any).__ccTriggerHudDrop = true;
      const continuationRound = getArcadeSavedRound();
      if (continuationRound !== null && continuationRound > 0) {
        (window as any).__ccArcadeContinuationCueRound = continuationRound;
      } else {
        delete (window as any).__ccArcadeContinuationCueRound;
      }
      
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
          
          // 🔥 CRITICAL FIX: Reset gamePaused flag to ensure dragging works
          try {
            const { container } = await import('../core/dependency-injection.js');
            if (container && typeof container.set === 'function') {
              container.set('gamePaused', false);
            }
          } catch (e) { /* ignore */ }
          (window as any)._gamePaused = false;
          
          await bootGame();
          await layoutGame();
          
          // Flags consumed by startLevel; clear them after boot
          delete (window as any).__ccStartAtLevel;
          delete (window as any).__ccResumeScore;
          delete (window as any).__ccTriggerHudDrop;
          
          // Show app element
          this.showApp();
          
          console.log('🔄 ====================================');
          console.log('🔄 NEXT BOARD STARTED (clean-board resume)');
          console.log('🔄 ====================================');
          delete (window as any).__ccArcadeContinuationCueRound;
          
          return;
        } catch (error) {
          console.warn('⚠️ Failed to resume from completion state, falling back to normal flow:', error);
          // Clear corrupted flag
          localStorage.removeItem('cc_board_completed');
        }
      }

      resetArcadeEntryCueOwner();
      
      // Set game state
      gameState.setState({
        isGameActive: true,
        isPaused: false,
        isGameEnded: false,
        score: 0,
        level: 1,
        combo: 0
      });
      
      // 🔥 CRITICAL FIX: Reset gamePaused flag to ensure dragging works
      try {
        const { container } = await import('../core/dependency-injection.js');
        if (container && typeof container.set === 'function') {
          container.set('gamePaused', false);
        }
      } catch (e) { /* ignore */ }
      (window as any)._gamePaused = false;
      
      console.log('✅ Game state set (gamePaused reset)');
      // Continue/load owns board creation. Prevent boot() from constructing and
      // animating a temporary fresh board before saved tiles are restored.
      (window as any).__ccSkipRebuildBoard = true;
      
      // Start game
      console.log('🎯 Starting game boot...');
      try {
        // Use static import instead of dynamic import for instant response
        console.log('✅ app-core already available (static import)');
        
        await bootGame();
        console.log('✅ boot() complete');

        // Desktop browsers can block GSAP while creating a cold WebGL renderer.
        // Native app:// keeps the earlier safe overlap; web starts only after
        // boot so the Round cue remains fluid instead of freezing mid-letter.
        if (
          continuationRound !== null &&
          continuationRound > 0 &&
          !shouldOverlapArcadeEntryCueWithColdBoot()
        ) {
          void beginArcadeEntryCue(continuationRound).catch((error) => {
            logger.warn('⚠️ Web Arcade entry cue failed; board entrance will continue safely:', error);
          });
        }
        
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
        // loadGameState captures this one-shot value in its pop-in owner.
        delete (window as any).__ccArcadeContinuationCueRound;
        delete (window as any).__ccSkipRebuildBoard;
        
        // Show app element AFTER loading saved state
        console.log('📱 Showing app element...');
        this.showApp();
        delete (window as any).__ccTriggerHudDrop;
        console.log('✅ App element shown');

        console.log('🔄 ====================================');
        console.log('🔄 GAME WITH SAVED STATE STARTED');
        console.log('🔄 ====================================');
        
      } catch (error) {
        delete (window as any).__ccSkipRebuildBoard;
        console.error('❌ Game boot failed:', error);
        logger.error('❌ Failed to start game with saved state:', error);
        throw error;
      }
      
    } catch (error) {
      delete (window as any).__ccSkipRebuildBoard;
      delete (window as any).__ccTriggerHudDrop;
      delete (window as any).__ccArcadeContinuationCueRound;
      cancelArcadeEntryCueOwner();
      logger.error('❌ Failed to start new game with saved state:', error);
    }
  }
  
  // Show homepage
  showHomepage(): void {
    logger.info('🏠 showHomepage() called');
    
    // Keep Homepage on the same viewport-relative paper surface as the intro.
    applyPaperBackground();
    
    if (this.elements.home) {
      this.elements.home.style.display = 'block';
      this.elements.home.removeAttribute('hidden');
      fadeInHome();
    }
    sliderManager.refreshHomepageSpatialMotion();
    // Dev test/log buttons removed
    
    // 🔥 NUCLEAR RESET: Use forceReady() to guarantee slider is interactive
    if (sliderManager && typeof sliderManager.forceReady === 'function') {
      sliderManager.forceReady();
      logger.info('✅ Slider forceReady() called in showHomepage() - slider fully reset');
    } else if (sliderManager && typeof sliderManager.ensureReady === 'function') {
      sliderManager.ensureReady();
      logger.info('✅ Slider ensureReady() called in showHomepage() (fallback)');
    }
    
    // 🔥 FIX: DON'T show navigation here - let animateSliderEnter handle it
    // Showing it here causes 1-frame flash before animation starts
    // Navigation will be shown by reverseBounce() in animations.ts with scale(0) -> scale(1) animation
    const independentNav = document.getElementById('independent-nav');
    if (independentNav) {
      // 🔥 CRITICAL: Add animate-enter-initial class to keep at scale(0)
      // This matches what reverseBounce expects and prevents flash
      independentNav.classList.add('animate-enter-initial');
      primeHomepageNavigation('ui-manager:showHomepage-prime');
      logger.info('✅ Navigation prepared for enter animation (animate-enter-initial class)');
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
        globalBg.style.left = '0';
        globalBg.style.right = '0';
        globalBg.style.pointerEvents = 'none';
        globalBg.style.zIndex = '-1';
        if (document.body.firstChild) {
          document.body.insertBefore(globalBg, document.body.firstChild);
        } else {
          document.body.appendChild(globalBg);
        }
      applyPaperBackground();
      logger.info('✅ #global-bg created and paper background set');
    }
    
    // The shared paper helper has already synchronized every global owner.
    
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
    const cleanupZone = (window as any).__ccAppZone;
    const cleanupStillOwned = (): boolean =>
      (window as any).__ccAppZone === cleanupZone && !homepageEnterTransitionOwner.isActive();

    // 🔥 MEMORY LEAK FIX: Cleanup all animations before hiding homepage
    (async () => {
      // 1. Cleanup animation timeouts
      try {
        const { cleanupAnimations } = await import('../utils/animations.js');
        if (!cleanupStillOwned()) return;
        if (cleanupAnimations) {
          cleanupAnimations();
          logger.info('🧹 Homepage animation timeouts cleaned up');
        }
      } catch (error) {
        logger.warn('⚠️ Failed to cleanup homepage animation timeouts:', error);
      }
      
      // 2. Kill GSAP animations on homepage elements
      try {
        if (!cleanupStillOwned()) return;
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
      if (!cleanupStillOwned()) return;
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
        if (!cleanupStillOwned()) return;
        if (sliderManager && typeof sliderManager.destroy === 'function') {
          sliderManager.destroy();
          logger.info('🧹 Slider manager destroyed');
        }
      } catch (sliderError) {
        logger.warn('⚠️ Failed to destroy slider manager:', sliderError);
      }
      
      // 5. Unsubscribe from gameState subscriptions
      try {
        if (!cleanupStillOwned()) return;
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
        if (!cleanupStillOwned()) return;
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
        if (!cleanupStillOwned()) return;
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
        if (!cleanupStillOwned()) return;
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
      applyPaperBackground();
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
      appElement.style.zIndex = '999';
      // 🔥 FIX: Restore pointer-events when showing app
      appElement.style.pointerEvents = 'auto';
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
        if (gameState.stage) {
          gameState.stage.visible = true;
          gameState.stage.alpha = 1;
          gameState.stage.renderable = true;
          logger.info('✅ Stage made visible in showApp()');
        }
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
        // 🔥 CRITICAL FIX: Restart PIXI ticker when showing app (was stopped in hideApp to prevent addressModeU crash)
        const pixiApp = gameState.app || (window as any).STATE?.app || (window as any).app;
        if (pixiApp?.ticker && !pixiApp.ticker.started) {
          pixiApp.ticker.start();
          logger.info('✅ PIXI ticker restarted in showApp()');
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
    hideHomepageNavigation('ui-manager:hideNavigation');
    logger.info('✅ Homepage navigation hidden');
  }
  
  // Show navigation
  showNavigation(): void {
    commitHomepageNavigation('ui-manager:showNavigation');
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
      // 🔥 FIX: Set pointer-events to none to prevent blocking elements underneath
      appElement.style.pointerEvents = 'none';
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
      
      const boardIndicator =
        document.getElementById('hud-board-indicator') ||
        document.getElementById('hud-board');
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

    // 🔥 CRITICAL FIX: Stop PIXI ticker when hiding app to prevent "addressModeU" crash
    // The renderer was still running and trying to bind textures that may have been
    // invalidated during cleanup, causing TypeError in GlTextureSystem.applyStyleParams.
    // Ticker is restarted in showApp() when the game is shown again.
    try {
      if (typeof (window as any).stopPixiTicker === 'function') {
        (window as any).stopPixiTicker();
        logger.info('✅ PIXI ticker stopped when app hidden (prevents addressModeU crash)');
      }
    } catch (tickerError) {
      logger.warn('⚠️ Failed to stop PIXI ticker when hiding app:', tickerError);
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
    sliderManager.refreshHomepageSpatialMotion();
    
    applyPaperBackground();
  }
  
  // Show homepage QUIETLY - no animations, just show it (for exit flow)
  showHomepageQuietly(options: { skipSliderForceReady?: boolean } = {}): void {
    applyPaperBackground();
    if (this.elements.home) {
      this.elements.home.style.display = 'block';
      this.elements.home.removeAttribute('hidden');
      this.elements.home.style.visibility = 'visible';
      this.elements.home.style.opacity = '1';
      this.elements.home.style.pointerEvents = 'auto';
      sliderManager.refreshHomepageSpatialMotion();
      // Dev test/log buttons removed
      
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
      
      // 🔥 NUCLEAR RESET: Use forceReady() to guarantee slider is interactive
      // This resets ALL animation flags, unlocks slider, and reinitializes if needed
      if (!options.skipSliderForceReady) {
        try {
          if (sliderManager && typeof sliderManager.forceReady === 'function') {
            sliderManager.forceReady();
            logger.info('✅ Slider forceReady() called in showHomepageQuietly - slider fully reset');
          } else if (sliderManager && typeof sliderManager.ensureReady === 'function') {
            // Fallback: Use ensureReady if forceReady not available
            sliderManager.ensureReady();
            logger.info('✅ Slider ensureReady() called in showHomepageQuietly (fallback)');
          }
        } catch (error) {
          logger.warn('⚠️ Failed to force slider ready:', error);
        }
      } else {
        logger.info('✅ showHomepageQuietly kept existing slider ready state for prepared enter animation');
      }
      
      // 🔥 FIX: Explicitly show and enable navigation (independent-nav)
      // Navigation might have been hidden or pointer-events disabled during game
      primeHomepageNavigation('ui-manager:showHomepageQuietly-prime');
      
      // 🔥 V140 STYLE: Don't manipulate animation classes here!
      // animateSliderEnter() handles all animation
      
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

      // The shared paper helper has already synchronized every global owner.
      // NO TRANSITIONS, NO OPACITY - elements will be animated by animateSliderEnter
      // DO NOT set opacity 0 here - it will break animation visibility
      logger.info('✅ Homepage shown QUIETLY - ready for animateSliderEnter to control animations');
    }
  }
  
  // Show Journey screen with exit animation
  private showCollectiblesScreenWithAnimation(): void {
    // Stability: cleanup FX before navigation
    try { window.dispatchEvent(new Event('cc-navigation')); } catch {}
    try { (window as any).CC?.cleanupFxForBoardReset?.('nav:collectibles'); } catch {}
    try { (window as any).CC?.softResetBoardView?.('nav:collectibles'); } catch {}

    applyPaperBackground();
    const appElement = document.getElementById('app');
    
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
    gameState.set('sliderLocked', true);
    // Revoke any still-running Homepage return before Journey takes ownership.
    // Otherwise its delayed hero/CTA/nav finalize can reveal Homepage again.
    homepageEnterTransitionOwner.cancel('homepage-to-journey');
    cancelSliderEnterAnimation('homepage-to-journey');
    
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
      navButtons.forEach((button) => {
        const slideIndex = parseInt(button.getAttribute('data-slide') || '0', 10);
        if (slideIndex === 1) {
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
    
    // The shared paper surface is already active.
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
    
    // Freeze the current gyro offset so exit begins without a snap, then give
    // one Promise-based owner all Homepage exit targets.
    const homeElement = document.getElementById('home');
    homeElement?.setAttribute('data-journey-exit', 'true');
    journeySpatialMotion.suspendHomepage();
    sliderManager.freezeHomepageHeroBounceForExit();
    const exitCompletePromise = animateJourneySliderExit();

    const collectiblesManager = (window as any).collectiblesManager;
    const journeyPreparePromise: Promise<void> =
      collectiblesManager && typeof collectiblesManager.prepareJourneyScreen === 'function'
        ? collectiblesManager.prepareJourneyScreen().catch((error: Error) => {
            logger.warn('⚠️ Failed to prepare Journey screen:', error);
          })
        : Promise.resolve();
    // Exit and preparation run concurrently and join at one exact handoff.
    Promise.all([exitCompletePromise, journeyPreparePromise]).then(() => {
      console.log('🗺️ Homepage exit and Journey preparation complete - revealing Journey once');
      // The shared paper surface is already active.
      // No need to change it - it stays at 60% throughout
      // Just ensure app element is transparent
      if (appElement) {
        appElement.style.setProperty('background', 'transparent', 'important');
        appElement.style.setProperty('background-image', 'none', 'important');
      }
      console.log('✅ [Journey ENTER] Paper background with 60% opacity already set - no changes needed');

      try {
        this.showCollectiblesScreen();
      } finally {
        // showCollectibles hides Homepage synchronously before its first await.
        // Only now is it safe to clear scale/transition ownership without flash.
        finalizeJourneySliderExit();
        journeySpatialMotion.deactivateHomepage();
        (window as any).__ccIsAnimatingSliderExit = () => false;
        (window as any).__ccUiJourneyTransitioning = false;
      }
    }).catch((error) => {
      logger.error('❌ Homepage → Journey handoff failed:', error);
      (window as any).__ccUiJourneyTransitioning = false;
      gameState.set('sliderLocked', false);
    });
  }
  
  // Hide Journey screen with enter animation
  async hideCollectiblesScreenWithAnimation(): Promise<void> {
    // Stability: dispatch navigation cleanup
    try { window.dispatchEvent(new Event('cc-navigation')); } catch {}
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
          if (journeyBoardsManager && typeof journeyBoardsManager.stopInterimCardIdleEffects === 'function') {
            journeyBoardsManager.stopInterimCardIdleEffects();
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
          cardEl.classList.remove('interim-idle-effects-active');
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
    
    applyPaperBackground();
    
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

    // 🔥 FAIL-SAFE: Ensure Journey animations are fully cleaned after hide
    try {
      const { journeyBoardsManager } = await import('../modules/journey-boards-manager.js');
      if (journeyBoardsManager && typeof journeyBoardsManager.cleanup === 'function') {
        journeyBoardsManager.cleanup();
        logger.info('✅ Journey boards manager cleanup called after hide');
      }
    } catch (error) {
      logger.warn('⚠️ Failed to call journeyBoardsManager.cleanup after hide:', error);
    }
    
    // 🔥 USER REQUEST: Check if we're returning to Journey slide (slide 1) or homepage slide (slide 0)
    // Journey games should ALWAYS return to slide 1 (Journey slide), NOT slide 0 (homepage PLAY slide)
    const cameFromJourney = (window as any).__ccCameFromJourney === true || 
                            localStorage.getItem('__ccCameFromJourney') === 'true';
    const cameFromHomepage = (window as any).__ccCameFromHomepage === true || 
                             localStorage.getItem('__ccCameFromHomepage') === 'true';
    const journeyExitMode = (window as any).__ccJourneyExitMode;
    
    logger.info('🔍 Checking exit context:', { cameFromJourney, cameFromHomepage, journeyExitMode });
    
    // 🔥 BUG FIX: Clean up the exit mode flag after reading it
    // This prevents stale flags from affecting future navigation
    delete (window as any).__ccJourneyExitMode;
    
    // 🔥 CRITICAL: If journeyExitMode is 'toHome', hideCollectibles already showed navigation
    // But we need to ensure navigation is visible by calling setNavigationVisibility explicitly
    if (journeyExitMode === 'toHome') {
      logger.info('🗺️ Journey exit mode is "toHome" - hideCollectibles handled navigation, verifying visibility');
      // hideCollectibles already positioned slider and showed navigation
      // But ensure navigation is definitely visible (defensive)
      this.setNavigationVisibility(true);
      // 🔥 BUG FIX: Reset guard BEFORE returning to prevent blocking future calls
      (window as any).__ccIsHidingCollectibles = false;
      return; // Exit early - hideCollectibles already handled everything
    }
    
    if (cameFromJourney) {
      // 🔥 USER REQUEST: Journey games → return to Journey slide (slide 1), NOT homepage slide (slide 0)
      // DO NOT show homepage - Journey screen will be shown directly by exitToMenu
      logger.info('🗺️ Returning to Journey slide (slide 1) - skipping showHomepageQuietly');
      // Don't call showHomepageQuietly() - exitToMenu will handle showing Journey screen
    } else if (cameFromHomepage) {
      // 🔥 USER REQUEST: Homepage PLAY games → return to homepage slide (slide 0)
      logger.info('🏠 Returning to homepage slide (slide 0) - showing homepage');
      // The shared paper surface is already active.
      // No need to set it again - showHomepageQuietly() will ensure it stays at 60%
      const { appZoneManager } = await import('./app-zone-manager.js');
      await appZoneManager.showHomepageShell('ui-manager:hideCollectibles:homepage');
    } else {
      // Default: show homepage (for backward compatibility)
      logger.info('🏠 No context found - defaulting to homepage slide (slide 0)');
      // The shared paper surface is already active.
      // No need to set it again - showHomepageQuietly() will ensure it stays at 60%
      const { appZoneManager } = await import('./app-zone-manager.js');
      await appZoneManager.showHomepageShell('ui-manager:hideCollectibles:default-homepage');
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
    applyPaperBackground();
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
    // Settings owns the transition now. Keep gyro translation from composing
    // against the slider exit/Settings enter transforms; Homepage will resume
    // once its return handoff has fully finalized.
    journeySpatialMotion.holdActivations('settings-enter');
    // Stability: cleanup FX before navigation
    try { window.dispatchEvent(new Event('cc-navigation')); } catch {}
    try { (window as any).CC?.cleanupFxForBoardReset?.('nav:settings'); } catch {}
    try { (window as any).CC?.softResetBoardView?.('nav:settings'); } catch {}

    applyPaperBackground();
    const appElement = document.getElementById('app');
    
    // 🔥 IMPORTANT: Keep slider containers transparent to avoid cropped/tiled paper background
    clearSliderBackgrounds();
    if (appElement) {
      appElement.style.setProperty('background', 'transparent', 'important');
      appElement.style.setProperty('background-image', 'none', 'important');
    }
    
    // NOW log and continue with rest of function
    logger.info('⚙️ Showing settings screen - with exit animation');
    logger.info('✅ [Settings ENTER] Paper background set to 60% opacity IMMEDIATELY (at function start)');
    gameState.set('sliderLocked', true);
    
    // CRITICAL: Switch to Settings slide BEFORE animation so it animates the correct slide
    const navButtons = document.querySelectorAll('.independent-nav-button');
    const slides = document.querySelectorAll('.slider-slide');
    slides.forEach((slide) => {
      const slideIndex = parseInt(slide.getAttribute('data-slide') || '0', 10);
      if (slideIndex === SETTINGS_SLIDE_INDEX) {
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });
    navButtons.forEach((button) => {
      const slideIndex = parseInt(button.getAttribute('data-slide') || '0', 10);
      if (slideIndex === SETTINGS_SLIDE_INDEX) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    console.log('🎨 [Settings ENTER] Preserving shared paper surface - GSAP:', !!gsap, 'App:', !!appElement);
    
    // 🔥 CRITICAL: Start fade animation FIRST, then play exit animation
    // Fade duration: 0.8s for smooth premium transition
    const fadeDuration = 0.8;
    
    // 🔥 CRITICAL: Don't use GSAP for background animation - it can override !important flags
    // Keep gradient with !important flags during exit animation
    // Animate to solid color AFTER exit animation completes
    console.log('⚠️ [DEBUG] Keeping gradient with !important during exit animation, will fade to solid AFTER');
    
    applyPaperBackground();
    if (appElement) {
      appElement.style.setProperty('background', 'transparent', 'important');
      appElement.style.setProperty('background-image', 'none', 'important');
    }
    
    // Step 1: Play exit animation for Settings slide (gradient stays with !important during exit)
    // 🔥 CRITICAL: Re-apply paper background ONE MORE TIME right before exit animation
    // This ensures 50% paper opacity is preserved if something changed it during slider positioning
    applyPaperBackground();
    if (appElement) {
      appElement.style.setProperty('background', 'transparent', 'important');
      appElement.style.setProperty('background-image', 'none', 'important');
    }
    
    console.log('🎬 Step 1: Playing exit animation for Settings slide (gradient preserved with !important)');
    const homepageExitPromise = animateSliderExit();
    
    // Step 2: Wait for exit animation to complete, then show Settings screen IMMEDIATELY (optimized)
    // Exit animation: 770ms
    // 🔥 OPTIMIZATION: Show Settings screen immediately after exit animation, don't wait for fade
    // Fade animation can happen in parallel - no need to block Settings screen display
    void homepageExitPromise.then(() => {
      console.log('⚙️ Step 2: Exit animation complete, showing Settings screen IMMEDIATELY');
        
        const settingsScreen = this.elements.settingsScreen;
        if (!settingsScreen) return;
        
      // Show settings screen IMMEDIATELY after exit animation (don't wait for fade)
        this.hideHomepage();
        finalizeJourneySliderExit();
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
      
      // 🔥 SAFETY: Global capture handler to ensure back always works
      if (!this.settingsBackGlobalHandlerInstalled) {
        this.settingsBackGlobalHandlerInstalled = true;
        const globalBackHandler = (e: Event) => {
          const target = e.target as HTMLElement | null;
          if (!target) return;
          const settingsEl = document.getElementById('settings-screen');
          if (!settingsEl || settingsEl.hasAttribute('hidden') || settingsEl.style.display === 'none') return;
          const backBtnEl = target.closest('#settings-back-btn, .settings-back-button');
          if (!backBtnEl) return;
          e.preventDefault();
          e.stopPropagation();
          (e as any).stopImmediatePropagation?.();
          this.handleSettingsBackClick(e);
        };
        document.addEventListener('click', globalBackHandler, true);
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
      
    // Keep the shared intro paper surface after Settings enters.
    applyPaperBackground();
    if (appElement) {
      appElement.style.setProperty('background', 'transparent', 'important');
      appElement.style.setProperty('background-image', 'none', 'important');
    }
    });
  }
  
  // Hide settings screen with enter animation
  private hideSettingsScreenWithAnimation(): void {
    logger.info('⚙️ Hiding settings screen - with enter animation');

    // Stability: cleanup settings screen animations
    try { cleanupSettingsAnimations?.(); } catch {}
    try { window.dispatchEvent(new Event('cc-navigation')); } catch {}
    
    applyPaperBackground();
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
    // Also reset slider to Settings slide BEFORE showing homepage
    const slides = document.querySelectorAll('.slider-slide');
    const navButtons = document.querySelectorAll('.independent-nav-button');
    slides.forEach((slide) => {
      const slideIndex = parseInt(slide.getAttribute('data-slide') || '0', 10);
      if (slideIndex === SETTINGS_SLIDE_INDEX) {
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });
    navButtons.forEach((button) => {
      const slideIndex = parseInt(button.getAttribute('data-slide') || '0', 10);
      if (slideIndex === SETTINGS_SLIDE_INDEX) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    logger.info('✅ Settings exit will use shared homepage enter handoff after settings animation');
    
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
        // Shared homepage handoff owns nav visibility and enter animation.
      }
      
      // Force reflow to ensure DOM is updated before animation
      void document.querySelector(`.slider-slide[data-slide="${SETTINGS_SLIDE_INDEX}"]`)?.offsetHeight;
      
      // Step 2: Play enter animation for Settings slide
      // Use requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          console.log(`🎬 Playing shared homepage enter handoff for Settings slide (index ${SETTINGS_SLIDE_INDEX})`);
          const homepageEnterHandoff = (window as any).__ccPlayHomepageSliderEnterHandoff;
          if (typeof homepageEnterHandoff === 'function') {
            await homepageEnterHandoff('settings-exit-homepage-slide', { targetSlideIndex: SETTINGS_SLIDE_INDEX });
            return;
          }

          console.warn('⚠️ Shared homepage enter handoff missing; using legacy Settings homepage enter path');
          this.showHomepageQuietly();
          animateSliderEnter();
        });
      });
    }, fadeDurationMs);
  }
  
  // Handle settings back button click
  private handleSettingsBackClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    (event as any).stopImmediatePropagation?.();
    logger.info('⚙️ Settings back button clicked');
    
    // 🔥 CRITICAL: Refresh button reference in case it changed
    const btn = document.getElementById('settings-back-btn') as HTMLButtonElement | null;
    if (btn) {
      this.elements.settingsBackButton = btn;
    }
    
    const buttonToAnimate = this.elements.settingsBackButton || btn;
    const visualTarget = (buttonToAnimate?.querySelector('img') as HTMLElement | null) || buttonToAnimate;
    playDomSoftCartoonBounce(visualTarget);

    if (buttonToAnimate?.getAttribute('data-settings-back-exit-pending') === 'true') {
      return;
    }

    buttonToAnimate?.setAttribute('data-settings-back-exit-pending', 'true');
    const runExit = () => {
      try {
        logger.info('⚙️ Calling hideSettingsScreenWithAnimation()...');
        this.hideSettingsScreenWithAnimation();
      } finally {
        buttonToAnimate?.removeAttribute('data-settings-back-exit-pending');
      }
    };

    if (SETTINGS_BACK_TAP_BOUNCE_EXIT_DELAY_MS > 0) {
      window.setTimeout(runExit, SETTINGS_BACK_TAP_BOUNCE_EXIT_DELAY_MS);
    } else {
      runExit();
    }
  }
  
  // 🔥 MEMORY LEAK FIX: Store settings toggle handlers
  private settingsToggleHandlers: Map<HTMLElement, { event: string; handler: EventListener }[]> = new Map();
  private settingsBackGlobalHandlerInstalled = false;
  
  // Setup settings toggles
  private setupSettingsToggles(): void {
    const settingsScreen = this.elements.settingsScreen;
    if (!settingsScreen) {
      console.warn('⚠️ Settings screen not found, cannot setup toggles');
      return;
    }
    
    // 🔥 CRITICAL: Directly attach event listeners to checkbox elements
    const gameSoundsToggle = document.getElementById('toggle-game-sounds') as HTMLInputElement;
    const musicToggle = document.getElementById('toggle-music') as HTMLInputElement;
    const vibrationToggle = document.getElementById('toggle-vibration') as HTMLInputElement;
    const spatialMotionToggle = document.getElementById('toggle-spatial-motion') as HTMLInputElement;
    const footerHapticText =
      (document.getElementById('settings-footer-haptic') as HTMLElement | null) ||
      (settingsScreen.querySelector('.settings-footer-text') as HTMLElement | null);
    
    if (!gameSoundsToggle || !vibrationToggle) {
      console.warn('⚠️ Settings toggle checkboxes not found:', {
        gameSoundsToggle: !!gameSoundsToggle,
        vibrationToggle: !!vibrationToggle
      });
      return;
    }

    const playSettingsToggleBounce = (input: HTMLInputElement | null) => {
      const switchEl = input?.closest('.settings-toggle-switch') as HTMLElement | null;
      const sliderEl = switchEl?.querySelector('.settings-toggle-slider') as HTMLElement | null;
      if (!switchEl || !sliderEl) return;

      switchEl.classList.remove('soft-cartoon-bounce');
      sliderEl.classList.remove('soft-cartoon-bounce');
      void switchEl.offsetHeight;
      switchEl.classList.add('soft-cartoon-bounce');
      sliderEl.classList.add('soft-cartoon-bounce');

      gsap.killTweensOf(switchEl);
      gsap.set(switchEl, { scale: 1, transformOrigin: '50% 50%', willChange: 'transform', force3D: true });
      gsap.timeline({
        defaults: { overwrite: 'auto' },
        onComplete: () => {
          gsap.set(switchEl, { clearProps: 'scale,willChange,force3D' });
          switchEl.classList.remove('soft-cartoon-bounce');
          sliderEl.classList.remove('soft-cartoon-bounce');
        },
      })
        .to(switchEl, { scale: 1.18, duration: 0.12, ease: 'back.out(2.2)', force3D: true })
        .to(switchEl, { scale: 0.93, duration: 0.09, ease: 'power2.out', force3D: true })
        .to(switchEl, { scale: 1, duration: 0.17, ease: 'back.out(1.9)', force3D: true });
    };
    
    // Remove old event listeners first (if any)
    const gameSoundsOldHandler = (gameSoundsToggle as any).__ccToggleHandler;
    const musicOldHandler = musicToggle ? (musicToggle as any).__ccToggleHandler : null;
    const vibrationOldHandler = (vibrationToggle as any).__ccToggleHandler;
    const spatialMotionOldHandler = spatialMotionToggle ? (spatialMotionToggle as any).__ccToggleHandler : null;
    
    if (gameSoundsOldHandler) gameSoundsToggle.removeEventListener('change', gameSoundsOldHandler);
    if (musicToggle && musicOldHandler) musicToggle.removeEventListener('change', musicOldHandler);
    if (vibrationOldHandler) vibrationToggle.removeEventListener('change', vibrationOldHandler);
    if (spatialMotionToggle && spatialMotionOldHandler) {
      spatialMotionToggle.removeEventListener('change', spatialMotionOldHandler);
    }
    
    // 🔥 CRITICAL: Create handler functions that update status text immediately
    const gameSoundsHandler = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const enabled = target.checked;
      console.log('🔊 Game sounds toggle changed:', enabled);
      playSettingsToggleBounce(target);
      if (typeof (window as any).triggerHapticImpact === 'function') {
        (window as any).triggerHapticImpact('light');
      }
      
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
    
    const musicHandler = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const enabled = target.checked;
      console.log('🎵 Music toggle changed:', enabled);
      playSettingsToggleBounce(target);
      if (typeof (window as any).triggerHapticImpact === 'function') {
        (window as any).triggerHapticImpact('light');
      }
      const statusEl = document.getElementById('status-music');
      if (statusEl) {
        statusEl.textContent = enabled ? 'ON' : 'OFF';
        void statusEl.offsetHeight;
      }
      if ((window as any)._settings) {
        (window as any)._settings.musicEnabled = enabled;
      }
      if (typeof (window as any).saveSettings === 'function') {
        (window as any).saveSettings((window as any)._settings);
      }
      import('./soundtrack-manager.js').then(({ stopSoundtrack, fadeInAndResume }) => {
        if (enabled) {
          fadeInAndResume();
        } else {
          stopSoundtrack();
        }
      }).catch(() => {});
    };

    const vibrationHandler = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const enabled = target.checked;
      console.log('📳 Vibration toggle changed:', enabled);
      playSettingsToggleBounce(target);
      
      // Update status text IMMEDIATELY (synchronously)
      const statusEl = document.getElementById('status-vibration');
      if (statusEl) {
        statusEl.textContent = enabled ? 'ON' : 'OFF';
        void statusEl.offsetHeight; // Force reflow
        console.log('✅ Vibration status updated to:', enabled ? 'ON' : 'OFF');
      }
      
      // Update global state + haptic order:
      // - ON: persist enabled first, then trigger haptic
      // - OFF: trigger haptic first, then persist disabled
      if (enabled) {
        if ((window as any)._settings) {
          (window as any)._settings.hapticsEnabled = true;
        }
        if (typeof (window as any).saveSettings === 'function') {
          (window as any).saveSettings((window as any)._settings);
        }
        if (typeof (window as any).triggerHapticImpact === 'function') {
          (window as any).triggerHapticImpact('light');
        }
      } else {
        if (typeof (window as any).triggerHapticImpact === 'function') {
          (window as any).triggerHapticImpact('light');
        }
        if ((window as any)._settings) {
          (window as any)._settings.hapticsEnabled = false;
        }
        if (typeof (window as any).saveSettings === 'function') {
          (window as any).saveSettings((window as any)._settings);
        }
      }
      
      console.log('✅ Haptic feedback triggered (vibration toggle changed, ON/OFF path)');
    };

    const spatialMotionHandler = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const enabled = target.checked;
      const statusEl = document.getElementById('status-spatial-motion');
      const persist = (nextEnabled: boolean) => {
        (window as any)._settings = (window as any)._settings || {};
        (window as any)._settings.spatialMotionEnabled = nextEnabled;
        if (typeof (window as any).saveSettings === 'function') {
          (window as any).saveSettings((window as any)._settings);
        }
      };
      const applyVisualState = (nextEnabled: boolean) => {
        target.checked = nextEnabled;
        if (statusEl) {
          statusEl.textContent = nextEnabled ? 'ON' : 'OFF';
          void statusEl.offsetHeight;
        }
      };

      console.log('🧊 3D Motion toggle changed:', enabled);
      playSettingsToggleBounce(target);
      if (typeof (window as any).triggerHapticImpact === 'function') {
        (window as any).triggerHapticImpact('light');
      }

      applyVisualState(enabled);
      persist(enabled);
      journeySpatialMotion.setEnabled(enabled);

      if (enabled && journeySpatialMotion.requiresPermissionGesture()) {
        // Start synchronously from the checkbox gesture so WebKit accepts the request.
        void journeySpatialMotion.requestPermissionFromGesture().then((granted) => {
          if (granted || !target.checked) return;
          applyVisualState(false);
          persist(false);
          journeySpatialMotion.setEnabled(false);
        });
      }
    };
    
    // Store handlers on elements for cleanup
    (gameSoundsToggle as any).__ccToggleHandler = gameSoundsHandler;
    (vibrationToggle as any).__ccToggleHandler = vibrationHandler;
    
    gameSoundsToggle.addEventListener('change', gameSoundsHandler);
    vibrationToggle.addEventListener('change', vibrationHandler);
    if (musicToggle) {
      (musicToggle as any).__ccToggleHandler = musicHandler;
      musicToggle.addEventListener('change', musicHandler);
    }
    if (spatialMotionToggle) {
      (spatialMotionToggle as any).__ccToggleHandler = spatialMotionHandler;
      spatialMotionToggle.addEventListener('change', spatialMotionHandler);
    }

    // Footer "Made with ❤️..." haptic (attach every Settings open; resilient to cleanup/rebuild)
    if (footerHapticText) {
      const oldTouch = (footerHapticText as any).__ccFooterHapticTouchHandler as EventListener | undefined;
      const oldClick = (footerHapticText as any).__ccFooterHapticClickHandler as EventListener | undefined;
      if (oldTouch) footerHapticText.removeEventListener('touchstart', oldTouch);
      if (oldClick) footerHapticText.removeEventListener('click', oldClick);

      let lastFooterHapticAt = 0;
      const fireFooterHaptic = () => {
        const now = Date.now();
        if (now - lastFooterHapticAt < 120) return;
        lastFooterHapticAt = now;
        try {
        if (
          typeof (window as any).triggerHapticImpact === 'function'
        ) {
            (window as any).triggerHapticImpact('light');
          } else if (navigator.vibrate) {
            navigator.vibrate(30);
          }
          console.log('📳 Settings footer haptic fired via UIManager');
        } catch (err) {
          console.warn('⚠️ Settings footer haptic failed:', err);
        }
      };

      const footerTouchHandler = () => fireFooterHaptic();
      const footerClickHandler = () => fireFooterHaptic();
      (footerHapticText as any).__ccFooterHapticTouchHandler = footerTouchHandler;
      (footerHapticText as any).__ccFooterHapticClickHandler = footerClickHandler;
      footerHapticText.addEventListener('touchstart', footerTouchHandler, { passive: true });
      footerHapticText.addEventListener('click', footerClickHandler);
      console.log('✅ Settings footer haptic handlers attached via UIManager');
    } else {
      console.warn('⚠️ Settings footer text not found for haptic attach');
    }
    
    console.log('✅ Settings toggle event listeners attached directly to checkboxes');
    
    const gameSoundsStatus = document.getElementById('status-game-sounds');
    const musicStatus = document.getElementById('status-music');
    const vibrationStatus = document.getElementById('status-vibration');
    const spatialMotionStatus = document.getElementById('status-spatial-motion');
    
    console.log('🔍 Settings toggle elements verified:', {
      gameSoundsToggle: !!gameSoundsToggle,
      musicToggle: !!musicToggle,
      vibrationToggle: !!vibrationToggle,
      spatialMotionToggle: !!spatialMotionToggle,
      gameSoundsChecked: gameSoundsToggle.checked,
      musicChecked: musicToggle?.checked,
      vibrationChecked: vibrationToggle.checked,
      spatialMotionChecked: spatialMotionToggle?.checked,
      spatialMotionStatus: spatialMotionStatus?.textContent,
    });
  }
  
  // 🔥 REMOVED: updateSliderLockState - SliderManager handles this exclusively
  // Having dual lock state management caused desynchronization issues

  private setNavigationVisibility(visible: boolean): void {
    if (visible) commitHomepageNavigation('ui-manager:setNavigationVisibility');
    else hideHomepageNavigation('ui-manager:setNavigationVisibility');
  }
  
  // Get element by ID
  getElement(id: string): HTMLElement | null {
    return this.elements[id as keyof UIManagerElements] as HTMLElement || document.getElementById(id);
  }
  
  // Cleanup
  destroy(): void {
    this.homepageCtaControllers.forEach(controller => controller.dispose());
    this.homepageCtaControllers.clear();
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
