import { logger } from './core/logger.js';
import { createFocusTrap, FocusTrap } from './utils/focus-trap.js';
// Collectibles Manager - Handles all collectibles functionality
logger.info('🎁 Collectibles Manager module loaded');

// Type definitions
interface CollectibleCard {
  id: string;
  name: string;
  description: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  event: string;
  unlocked: boolean;
  imagePath?: string;
}

interface CollectiblesData {
  common: CollectibleCard[];
  legendary: CollectibleCard[];
}

interface UnlockOptions {
  render?: boolean;
  silent?: boolean;
}

interface UnlockMeta {
  source: 'event' | 'number';
  eventName?: string;
}

interface PendingFlipItem {
  cardId: string;
  category: string;
  number: number;
  frontImage: string;
  backImage: string;
}

interface DailyVisitData {
  date: string;
  count: number;
}

interface PreloadResult {
  src: string;
  status: 'loaded' | 'error';
}

export interface CollectiblesShowOptions {
  scrollToCard?: string;
  rarity?: string;
  animateCard?: boolean;
}

// Global window extensions - Window interface is now defined in src/types/window.d.ts

class CollectiblesManager {
  private collectiblesData: CollectiblesData;
  private defaultUnlockedIds: Set<string>;
  private preloadPromise: Promise<PreloadResult[]> | null;
  private detailFocusTrap: FocusTrap | null = null;
  private detailTrigger: HTMLElement | null = null;
  private currentDetailCardId: string | null = null;
  private currentDetailCategory: string | null = null;
  private eventListenersInitialized: boolean = false;
  
  // 🔥 MEMORY LEAK FIX: Store event handler references for cleanup
  private boundHandlers: {
    backButtonClick?: (e: Event) => void;
    cardClick?: (e: Event) => void;
    titleClick?: () => void;
    closeBtnClick?: (e: Event) => void;
    modalClick?: (e: Event) => void;
  } = {};

  constructor() {
    this.collectiblesData = {
      common: [
        { id: 'common01', name: 'First Merge 6', description: 'Complete your first merge 6', rarity: 'Common', event: 'first_merge_6', unlocked: false },
        { id: 'common02', name: 'Quick Start', description: 'Start your first game', rarity: 'Common', event: 'game_start', unlocked: false },
        { id: 'common03', name: 'Score Hunter', description: 'Reach 100 points', rarity: 'Common', event: 'score_100', unlocked: false },
        { id: 'common04', name: 'Merge Master', description: 'Complete 10 merges', rarity: 'Common', event: 'merge_10', unlocked: false },
        { id: 'common05', name: 'Peaceful', description: 'Clean a board in less than 2 minutes', rarity: 'Rare', event: 'quick_clean', unlocked: false },
        { id: 'common06', name: 'Wild User', description: 'Use a wild cube', rarity: 'Common', event: 'use_wild', unlocked: false },
        { id: 'common07', name: 'Combo King', description: 'Get a 3x combo', rarity: 'Common', event: 'combo_3', unlocked: false },
        { id: 'common08', name: 'Board Cleaner', description: 'Clean 5 boards', rarity: 'Common', event: 'clean_5', unlocked: false },
        { id: 'common09', name: 'Speed Demon', description: 'Complete a level in 30 seconds', rarity: 'Rare', event: 'speed_level', unlocked: false },
        { id: 'common10', name: 'Point Collector', description: 'Reach 500 points', rarity: 'Common', event: 'score_500', unlocked: false },
        { id: 'common11', name: 'Wild Master', description: 'Use 5 wild cubes', rarity: 'Common', event: 'wild_5', unlocked: false },
        { id: 'common12', name: 'Combo Master', description: 'Get a 5x combo', rarity: 'Rare', event: 'combo_5', unlocked: false },
        { id: 'common13', name: 'Board Master', description: 'Clean 10 boards', rarity: 'Common', event: 'clean_10', unlocked: false },
        { id: 'common14', name: 'Score Master', description: 'Reach 1000 points', rarity: 'Common', event: 'score_1000', unlocked: false },
        { id: 'common15', name: 'Merge Legend', description: 'Complete 50 merges', rarity: 'Rare', event: 'merge_50', unlocked: false },
        { id: 'common16', name: 'Wild Legend', description: 'Use 10 wild cubes', rarity: 'Rare', event: 'wild_10', unlocked: false },
        { id: 'common17', name: 'Combo Legend', description: 'Get a 10x combo', rarity: 'Rare', event: 'combo_10', unlocked: false },
        { id: 'common18', name: 'Board Legend', description: 'Clean 20 boards', rarity: 'Rare', event: 'clean_20', unlocked: false },
        { id: 'common19', name: 'Score Legend', description: 'Reach 2000 points', rarity: 'Rare', event: 'score_2000', unlocked: false },
        { id: 'common20', name: 'Ultimate Player', description: 'Complete 100 merges', rarity: 'Epic', event: 'merge_100', unlocked: false }
      ],
      legendary: [
        { id: 'legendary01', name: 'Phoenix Rising', description: 'Achieve a score of 5000 in a single game', rarity: 'Legendary', event: 'score_5000', unlocked: false },
        { id: 'legendary02', name: 'Wild Storm', description: 'Use 25 wild cubes in a single game', rarity: 'Legendary', event: 'wild_25', unlocked: false },
        { id: 'legendary03', name: 'Combo Storm', description: 'Get a 20x combo', rarity: 'Legendary', event: 'combo_20', unlocked: false },
        { id: 'legendary04', name: 'Board Storm', description: 'Clean 50 boards', rarity: 'Legendary', event: 'clean_50', unlocked: false },
        { id: 'legendary05', name: 'Ultimate Master', description: 'Complete 500 merges', rarity: 'Legendary', event: 'merge_500', unlocked: false },
        { id: 'legendary06', name: 'Legendary Cube', description: 'Find me if you can', rarity: 'Legendary', event: 'legendary_all', unlocked: false }
      ]
    };
    this.defaultUnlockedIds = new Set<string>();
    this.preloadPromise = null;

    this.loadCollectiblesState();
    this.ensureDefaultUnlocked();
    this.lockInitialCommons();
    this.saveCollectiblesState();
    this.preloadImages();
    this.initEventListeners();
    this.handleDailyVisit();
    
    // 🔥 CRITICAL: Update stats service with current unlocked count after loading state
    const totalUnlocked = this.collectiblesData.common.filter(c => c.unlocked).length + 
                          this.collectiblesData.legendary.filter(c => c.unlocked).length;
    if (typeof (window as any).trackCollectiblesUnlocked === 'function') {
      (window as any).trackCollectiblesUnlocked(totalUnlocked);
    }
  }

  private loadCollectiblesState(): void {
    try {
      const saved = localStorage.getItem('collectibles_state');
      if (saved) {
        const state = JSON.parse(saved);
        this.mergeState(state);
        this.ensureDefaultUnlocked();
      }
    } catch (error) {
      logger.warn('Failed to load collectibles state:', error);
    }
  }

  private saveCollectiblesState(): void {
    try {
      localStorage.setItem('collectibles_state', JSON.stringify(this.collectiblesData));
    } catch (error) {
      logger.warn('Failed to save collectibles state:', error);
    }
  }

  private mergeState(savedState: CollectiblesData): void {
    Object.keys(this.collectiblesData).forEach(category => {
      this.collectiblesData[category as keyof CollectiblesData].forEach(card => {
        const saved = savedState[category as keyof CollectiblesData]?.find(s => s.id === card.id);
        if (saved) {
          card.unlocked = saved.unlocked;
        }
      });
    });
  }

  private initEventListeners(): void {
    // Prevent duplicate initialization
    if (this.eventListenersInitialized) {
      console.log('🔄 Event listeners already initialized, skipping...');
      return;
    }
    
    console.log('🔌 Initializing event listeners...');
    
    // 🔥 MEMORY LEAK FIX: Store bound handlers for cleanup
    // Back button - use event delegation to handle clicks even if button doesn't exist yet
    this.boundHandlers.backButtonClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const backBtn = target.closest('#collectibles-back');
      if (backBtn) {
        // 🔥 FIX: Prevent duplicate calls (iOS optimization)
        if ((window as any).__ccIsHidingCollectibles) {
          logger.warn('⚠️ hideCollectiblesScreenWithAnimation already in progress, ignoring duplicate click');
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        
        logger.info('🎁 Collectibles back button clicked');
        e.preventDefault();
        e.stopPropagation();
        
        // Try to use animated version first, fallback to non-animated
        if (typeof (window as any).hideCollectiblesScreenWithAnimation === 'function') {
          logger.info('🎁 Calling window.hideCollectiblesScreenWithAnimation()');
          (window as any).hideCollectiblesScreenWithAnimation().catch((err: any) => {
            logger.error('❌ Error in hideCollectiblesScreenWithAnimation:', err);
            (window as any).__ccIsHidingCollectibles = false; // Reset on error
          });
        } else if (typeof window.hideCollectiblesScreen === 'function') {
          logger.info('🎁 Calling window.hideCollectiblesScreen()');
          window.hideCollectiblesScreen().catch((err: any) => {
            logger.error('❌ Error in hideCollectiblesScreen:', err);
          });
        } else {
          logger.warn('⚠️ window.hideCollectiblesScreen not available, using fallback');
          this.hideCollectibles().catch((err: any) => {
            logger.error('❌ Error in hideCollectibles:', err);
          });
        }
      }
    };
    document.addEventListener('click', this.boundHandlers.backButtonClick);

    // Title click - scroll to top
    const titleEl = document.getElementById('collectibles-title');
    if (titleEl) {
      titleEl.style.cursor = 'pointer';
      titleEl.style.pointerEvents = 'auto'; // Override CSS pointer-events: none
      this.boundHandlers.titleClick = () => {
        console.log('🎁 Title clicked, scrolling to top');
        const scrollable = document.querySelector('.collectibles-scrollable');
        if (scrollable) {
          scrollable.scrollTo({ top: 0, behavior: 'smooth' });
          console.log('✅ Scroll to top triggered');
        } else {
          console.warn('⚠️ Scrollable not found');
        }
      };
      titleEl.addEventListener('click', this.boundHandlers.titleClick);
    }

    // Card clicks
    this.boundHandlers.cardClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('.collectible-card')) {
        const card = target.closest('.collectible-card') as HTMLElement;
        const cardId = card.dataset.cardId;
        const category = card.dataset.category;
        
        // Allow all cards (locked or unlocked) to open detail page
        if (cardId && category) {
          // Light haptic for card tap
          if (typeof (window as any).triggerHapticImpact === 'function') {
            (window as any).triggerHapticImpact('light');
          }
          this.showCardDetail(cardId, category);
        }
      }
    };
    document.addEventListener('click', this.boundHandlers.cardClick);

    // Modal close
    const closeBtn = document.getElementById('detail-close-btn');
    if (closeBtn) {
      this.boundHandlers.closeBtnClick = (e: Event) => {
        console.log('🎁 Close button clicked!', e);
        this.hideCardDetail();
      };
      closeBtn.addEventListener('click', this.boundHandlers.closeBtnClick);
    }

    // Close modal on background click
    const modal = document.getElementById('collectibles-detail-modal');
    if (modal) {
      this.boundHandlers.modalClick = (e: Event) => {
        if (e.target === modal) {
          this.hideCardDetail();
        }
      };
      modal.addEventListener('click', this.boundHandlers.modalClick);
    }

    this.initDevButtons();
    
    this.eventListenersInitialized = true;
    console.log('✅ Event listeners initialized successfully');
  }
  
  // 🔥 MEMORY LEAK FIX: Cleanup all event listeners (public for app-manager)
  public cleanupEventListeners(): void {
    if (!this.eventListenersInitialized) return;
    
    console.log('🧹 Cleaning up collectibles event listeners...');
    
    // Remove global document event listeners
    if (this.boundHandlers.backButtonClick) {
      document.removeEventListener('click', this.boundHandlers.backButtonClick);
    }
    if (this.boundHandlers.cardClick) {
      document.removeEventListener('click', this.boundHandlers.cardClick);
    }
    
    // Remove element-specific event listeners
    const titleEl = document.getElementById('collectibles-title');
    if (titleEl && this.boundHandlers.titleClick) {
      titleEl.removeEventListener('click', this.boundHandlers.titleClick);
    }
    
    const closeBtn = document.getElementById('detail-close-btn');
    if (closeBtn && this.boundHandlers.closeBtnClick) {
      closeBtn.removeEventListener('click', this.boundHandlers.closeBtnClick);
    }
    
    const modal = document.getElementById('collectibles-detail-modal');
    if (modal && this.boundHandlers.modalClick) {
      modal.removeEventListener('click', this.boundHandlers.modalClick);
    }
    
    // Clear bound handlers
    this.boundHandlers = {};
    this.eventListenersInitialized = false;
    
    console.log('✅ Collectibles event listeners cleaned up');
  }

  // 🔥 NEW: Prepare Journey screen by rendering boards in background (without showing screen)
  // This allows boards to render while slider exit animation plays
  async prepareJourneyScreen(): Promise<void> {
    logger.info('🗺️ prepareJourneyScreen - rendering boards in background');
    const screen = document.getElementById('journey-screen');
    if (!screen) {
      logger.error('❌ journey-screen element not found');
      return;
    }
    
    // 🔥 PRODUCTION READY: Don't wait for preloading - render boards immediately
    // Images will load from Cache API or browser cache as needed (non-blocking)
    // This ensures Journey screen appears instantly, images load in background
    logger.info('🗺️ Rendering Journey boards immediately (images will load from cache as needed)');
    
    // Render boards in background
    const journeyContainer = document.getElementById('journey-boards-container');
    if (journeyContainer) {
      const { journeyBoardsManager } = await import('./modules/journey-boards-manager.js');
      journeyBoardsManager.renderBoards();
      journeyBoardsManager.updateCounter();
      logger.info('🗺️ Journey boards rendered in background');
      
      // Mark as viewed (badge will be reset by exit animation, not here)
      journeyBoardsManager.markAsViewed();
      // 🔥 CRITICAL: Don't reset badge here - exit animation will handle it
      // Badge will be animated out together with navigation in exit animation
      logger.info('🗺️ Journey boards marked as viewed (badge will be reset by exit animation)');
    }
  }

  async showCollectibles(options?: CollectiblesShowOptions): Promise<void> {
    logger.info('🎁 showCollectibles method called');
    const screen = document.getElementById('journey-screen');
    if (!screen) {
      logger.error('❌ collectibles-screen element not found');
      return;
    }

    // 🔥 USER REQUEST: COMPLETELY hide homepage and slider container BEFORE showing Journey screen
    // This ensures homepage slideri are NEAKTIVNI and NEVIDLJIVI when Journey is active
    const homeElement = document.getElementById('home');
    if (homeElement) {
      homeElement.style.display = 'none';
      homeElement.setAttribute('hidden', 'true');
      homeElement.style.visibility = 'hidden';
      homeElement.style.opacity = '0';
      homeElement.style.zIndex = '-1';
      logger.info('✅ Homepage completely hidden before showing Journey screen');
    }
    
    // 🔥 CRITICAL: Hide slider container to prevent any homepage slides from showing
    const sliderContainer = document.getElementById('slider-container');
    if (sliderContainer) {
      sliderContainer.style.display = 'none';
      sliderContainer.style.visibility = 'hidden';
      sliderContainer.style.opacity = '0';
      sliderContainer.style.zIndex = '-1';
      logger.info('✅ Slider container hidden - homepage slideri are now inactive');
    }
    
    // Hide navigation (Journey has its own back button)
    const navElement = document.getElementById('independent-nav');
    if (navElement) {
      navElement.style.display = 'none';
      navElement.style.visibility = 'hidden';
      navElement.style.opacity = '0';
      logger.info('✅ Navigation hidden - Journey has own back button');
    }

    // Preload already happens in constructor, skip await to show screen immediately
    // Images will load progressively in the background
    
    // 🔥 CRITICAL FIX: Ensure back button event listener is attached (button might not exist when initEventListeners was called)
    const backBtn = document.getElementById('collectibles-back');
    if (backBtn && !backBtn.hasAttribute('data-listener-attached')) {
      console.log('🔌 Attaching back button listener in showCollectibles');
      backBtn.addEventListener('click', () => {
        // Sweet bounce tap feedback (match hearts tap style)
        try {
          backBtn.classList.remove('sweet-bounce');
          void (backBtn as HTMLElement).offsetHeight; // force reflow to retrigger
          backBtn.classList.add('sweet-bounce');
          window.setTimeout(() => backBtn.classList.remove('sweet-bounce'), 260);
        } catch {}

        logger.info('🎁 Collectibles back button clicked');
        // Explicitly mark this hide as "toHome" so hideCollectibles doesn't get confused by __ccCameFromJourney flags
        (window as any).__ccJourneyExitMode = 'toHome';
        
        // Try to use animated version first, fallback to non-animated
        if (typeof (window as any).hideCollectiblesScreenWithAnimation === 'function') {
          logger.info('🎁 Calling window.hideCollectiblesScreenWithAnimation()');
          (window as any).hideCollectiblesScreenWithAnimation().catch((err: any) => {
            logger.error('❌ Error in hideCollectiblesScreenWithAnimation:', err);
          });
        } else if (typeof window.hideCollectiblesScreen === 'function') {
          logger.info('🎁 Calling window.hideCollectiblesScreen()');
          window.hideCollectiblesScreen().catch((err: any) => {
            logger.error('❌ Error in hideCollectiblesScreen:', err);
          });
        } else {
          logger.warn('⚠️ window.hideCollectiblesScreen not available, using fallback');
          this.hideCollectibles().catch((err: any) => {
            logger.error('❌ Error in hideCollectibles:', err);
          });
        }
      });
      backBtn.setAttribute('data-listener-attached', 'true');
    }
    
    // 🔥 CRITICAL: Remove all inline styles that might hide the screen
    // This ensures journey screen is visible when shown again after being hidden
    (screen as HTMLElement).style.removeProperty('display');
    (screen as HTMLElement).style.removeProperty('visibility');
    (screen as HTMLElement).style.removeProperty('z-index');
    screen.removeAttribute('hidden');
    screen.classList.remove('hidden');
    
    // 🔥 CRITICAL MOBILE FIX: Set opacity 0 and visibility hidden IMMEDIATELY to prevent flash
    // This must be done BEFORE display:flex to prevent any visible frame
    // Use inline styles that GSAP will override - this ensures screen is invisible until animation starts
    (screen as HTMLElement).style.opacity = '0';
    (screen as HTMLElement).style.visibility = 'hidden';
    // 🔥 CRITICAL: Also set will-change for better mobile performance
    (screen as HTMLElement).style.willChange = 'opacity, transform';
    
    logger.info('🎁 Removed hidden class and inline styles from Journey screen - set opacity 0 to prevent flash');
    
    // 🔥 OPTIMIZATION: Check if boards are already rendered (by prepareJourneyScreen)
    // If not, render them now (non-blocking - don't await)
    const journeyContainer = document.getElementById('journey-boards-container');
    if (journeyContainer) {
      const hasBoards = journeyContainer.querySelector('.journey-board-card');
      if (!hasBoards) {
        // Boards not yet rendered - render now (non-blocking)
        logger.info('🗺️ Boards not yet rendered - rendering now (non-blocking)');
        import('./modules/journey-boards-manager.js').then(({ journeyBoardsManager }) => {
          journeyBoardsManager.renderBoards();
          journeyBoardsManager.updateCounter();
          logger.info('🗺️ Journey boards rendered');
          
          // Mark as viewed (badge will be reset by exit animation, not here)
          journeyBoardsManager.markAsViewed();
          // 🔥 CRITICAL: Don't reset badge here - exit animation will handle it
          // Badge will be animated out together with navigation in exit animation
          logger.info('🗺️ Journey boards marked as viewed (badge will be reset by exit animation)');
        }).catch((error) => {
          logger.error('❌ Failed to render journey boards:', error);
        });
      } else {
        logger.info('🗺️ Boards already rendered - skipping render');
      }
      
      // 🔥 CRITICAL FIX: Ensure scroll is enabled when journey screen is shown
      // This fixes broken scroll when returning from game
      setTimeout(() => {
        const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement;
        if (scrollable) {
          // Force enable scrolling
          scrollable.style.touchAction = 'pan-y';
          scrollable.style.pointerEvents = '';
          if (scrollable.style.overflow === 'hidden') {
            scrollable.style.overflow = 'auto';
          }
          if (scrollable.style.overflowY === 'hidden') {
            scrollable.style.overflowY = 'auto';
          }
          logger.info('✅ Journey screen scroll enabled');
        }
      }, 100);
    } else {
      // This is Collectibles screen - render collectibles
      this.renderCards();
      this.updateCounters();
      logger.info('🎁 Cards rendered and counters updated');
    }
    this.triggerPendingFlipAnimations();
    
    // 🔥 USER REQUEST: Scroll to interim card is handled AFTER enter animation completes
    // (moved to after animateCollectiblesScreenEnter call to prevent scroll during animation)
    
    // Only focus target collectible if it's not journey screen (collectibles screen only)
    if (!journeyContainer) {
      this.focusTargetCollectible(options);
    }
    
    // 🔥 CRITICAL: Initialize dev buttons after screen is shown (buttons might not exist when constructor runs)
    // Use setTimeout to ensure buttons are in DOM after screen is rendered
    setTimeout(() => {
      this.initDevButtons();
    }, 100);
    
    // 💚 Initialize hearts system and attach click handler
    setTimeout(async () => {
      try {
        const { heartsSystem } = await import('./modules/hearts-system.js');
        heartsSystem.init();
        heartsSystem.refreshUI();
        
        // Attach click handler to hearts container
        const heartsContainer = document.getElementById('journey-lives-container');
        if (heartsContainer && !heartsContainer.hasAttribute('data-hearts-listener-attached')) {
          heartsContainer.style.cursor = 'pointer';
          heartsContainer.addEventListener('click', async () => {
            // Sweet fast tap bounce (visual feedback)
            try {
              heartsContainer.classList.remove('tap-bounce');
              // Force reflow so the animation can retrigger on rapid taps
              void (heartsContainer as HTMLElement).offsetHeight;
              heartsContainer.classList.add('tap-bounce');
              window.setTimeout(() => heartsContainer.classList.remove('tap-bounce'), 260);
            } catch {}

            logger.info('💚 Hearts container clicked - showing hearts bottom sheet');
            const { showHeartsModal } = await import('./modules/hearts-bottom-sheet.js');
            showHeartsModal();
          });
          heartsContainer.setAttribute('data-hearts-listener-attached', 'true');
          logger.info('💚 Hearts click handler attached');
        }
      } catch (error) {
        logger.warn('⚠️ Failed to initialize hearts system:', error);
      }
    }, 150);
    
    // 🎬 CRITICAL: Trigger Journey screen enter animation (pop-in) using GSAP
    // Screen is now visible with opacity 0, ready for animation
    // 🔥 CRITICAL: Set display FIRST, then animate immediately (no delays)
    (screen as HTMLElement).style.display = 'flex';
    (screen as HTMLElement).style.zIndex = '999999';
    screen.classList.add('show');
    screen.removeAttribute('hidden');
    // Opacity and visibility are already set to 0/hidden above - GSAP will animate them
    
    try {
      // 🔥 CRITICAL MOBILE FIX: Use requestAnimationFrame to ensure DOM is ready on mobile
      // Then import and start animation immediately
      requestAnimationFrame(() => {
        import('./ui/collectibles-animations.js').then(({ animateCollectiblesScreenEnter }) => {
          console.log('🎬 Starting Journey enter animation IMMEDIATELY...');
          // 🔥 CRITICAL: Start animation immediately - screen is already prepared with opacity 0
          // Use RAF to ensure browser is ready to render animation on mobile
          requestAnimationFrame(() => {
            animateCollectiblesScreenEnter();
          });
        }).catch((error) => {
          console.error('❌ Failed to load collectibles animations:', error);
          // Fallback: just show screen normally
          (screen as HTMLElement).style.opacity = '1';
          (screen as HTMLElement).style.visibility = 'visible';
          (screen as HTMLElement).style.willChange = 'auto';
        });
      });
      
      // 🔥 NEW: Initialize lives manager and update UI (non-blocking)
      import('./modules/lives-manager.js').then(({ livesManager }) => {
        livesManager.refreshUI();
      }).catch((error) => {
        logger.warn('⚠️ Failed to initialize lives manager:', error);
      });
      
          // 🔥 CRITICAL: Delay scroll to interim card AND start idle bounce animations AFTER enter animation completes
          // Enter animation takes ~0.7s (header 0.5s + delay 0.1s + cards 0.4s)
          // Wait a bit longer to ensure all animations are visible
          if (journeyContainer) {
            setTimeout(async () => {
              try {
                // 🔥 USER REQUEST: Skip auto-scroll if returning from detail modal or interim board
                // Auto-scroll should ONLY happen when entering Journey from homepage slider
                const returningFromDetailModal = (window as any).__ccReturningFromDetailModal;
                const returningFromInterimBoard = (window as any).__ccReturningFromInterimBoard;
                if (returningFromDetailModal || returningFromInterimBoard) {
                  console.log('🗺️ Skipping auto-scroll (returning from detail modal or interim board)');
                  // 🔥 USER REQUEST: Restore previous scroll position when returning from interim board
                  if (returningFromInterimBoard) {
                    try {
                      const scrollable = journeyContainer.querySelector('.collectibles-scrollable') as HTMLElement | null;
                      const savedScrollTop = (window as any).__ccJourneyScrollTop;
                      if (scrollable && typeof savedScrollTop === 'number') {
                        requestAnimationFrame(() => {
                          scrollable.scrollTop = savedScrollTop;
                        });
                      }
                    } catch {}
                  }
                  // Clear flags after checking
                  delete (window as any).__ccReturningFromDetailModal;
                  delete (window as any).__ccReturningFromInterimBoard;
                } else {
                  // Only auto-scroll when entering from homepage slider
                  const { journeyBoardsManager } = await import('./modules/journey-boards-manager.js');
                  if (journeyBoardsManager && typeof journeyBoardsManager.restoreOrScrollToInterimCard === 'function') {
                    console.log('🗺️ Starting scroll to interim card after enter animation...');
                    journeyBoardsManager.restoreOrScrollToInterimCard();
                  }
                }
                
                // 🔥 CRITICAL: Start idle bounce animations AFTER enter animation completes
                // This prevents jerky/laggy behavior on mobile when cards try to animate during enter animation
                const { JOURNEY_CARD_IDLE_BOUNCE } = await import('./modules/journey-card-idle-bounce.js');
                const cardsContainer = document.querySelector('.journey-cards-container') as HTMLElement;
                if (JOURNEY_CARD_IDLE_BOUNCE && JOURNEY_CARD_IDLE_BOUNCE.ENABLE && cardsContainer) {
                  console.log('🎬 Starting journey card idle bounce AFTER enter animation...');
                  JOURNEY_CARD_IDLE_BOUNCE.start(cardsContainer);
                  logger.info('✅ Journey card idle bounce started after enter animation');
                }
              } catch (error) {
                console.warn('⚠️ Failed to scroll to interim card or start idle bounce:', error);
              }
            }, 900); // Wait for enter animation to complete (~700ms) + buffer
          }
      
      // 🔥 PREMIUM FIX: Position is set synchronously in renderBoards() via CSS custom properties
      // No need to refresh after animation - this would cause visible movement
    } catch (error) {
      console.error('❌ Failed to trigger collectibles enter animation:', error);
      // Fallback: just show the screen normally
      // 🔥 CRITICAL: Explicitly set all styles to ensure journey screen is visible
      (screen as HTMLElement).style.display = 'flex';
      (screen as HTMLElement).style.visibility = 'visible';
      (screen as HTMLElement).style.opacity = '1';
      (screen as HTMLElement).style.zIndex = '999999';
      screen.classList.add('show');
      screen.removeAttribute('hidden');
      
      // 🔥 PREMIUM FIX: Position is already set synchronously in renderBoards()
      // No need to refresh - CSS custom properties handle positioning without visible movement
    }
  }

  async hideCollectibles(): Promise<void> {
    const screen = document.getElementById('journey-screen');
    if (screen) {
      // Determine hide mode explicitly (prevents stale __ccCameFromJourney from breaking back button)
      const exitMode = (window as any).__ccJourneyExitMode;
      const isBackButton = exitMode !== 'toGame'; // default to back-to-home
      delete (window as any).__ccJourneyExitMode;
      
      if (isBackButton) {
        // 🎬 BACK BUTTON pathway: Journey → Homepage Slide 2 (Journey slide)
        // 🔥 CRITICAL: Stop ALL Journey animations BEFORE exit animation to prevent frame drops and lag
        console.log('🛑 Stopping all Journey animations before exit...');
        
        // Step 0: Stop Journey card idle bounce animations
        try {
          const { JOURNEY_CARD_IDLE_BOUNCE } = await import('./modules/journey-card-idle-bounce.js');
          if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
            JOURNEY_CARD_IDLE_BOUNCE.stop();
            console.log('✅ Journey card idle bounce stopped');
          }
        } catch (error) {
          console.warn('⚠️ Failed to stop journey card idle bounce:', error);
        }
        
        // Step 0b: Stop glow pulse and interim bounce animations
        try {
          const journeyContainer = document.getElementById('journey-boards-container');
          if (journeyContainer) {
            const { journeyBoardsManager } = await import('./modules/journey-boards-manager.js');
            if (journeyBoardsManager && typeof journeyBoardsManager.stopGlowPulse === 'function') {
              journeyBoardsManager.stopGlowPulse();
              console.log('✅ Glow pulse and interim bounce stopped');
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to stop glow pulse:', error);
        }
        
        // Step 0c: Kill all GSAP animations on Journey cards to prevent interference
        try {
          const journeyScreen = document.getElementById('journey-screen');
          if (journeyScreen) {
            const cards = journeyScreen.querySelectorAll('.journey-board-card, .journey-board-card-wrapper');
            if (cards.length > 0) {
              const { gsap } = await import('gsap');
              gsap.killTweensOf(cards);
              console.log(`✅ Killed GSAP animations on ${cards.length} journey cards`);
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to kill GSAP animations:', error);
        }
        
        console.log('✅ All Journey animations stopped - starting exit animation...');
        
        // Step 1: Play Journey screen exit animation (now without interference)
        try {
          const { animateCollectiblesScreenExit } = await import('./ui/collectibles-animations.js');
          console.log('🎬 Step 1: Journey exit animation starting...');
          await animateCollectiblesScreenExit();
          console.log('✅ Step 1: Journey exit animation completed');
        } catch (error) {
          console.error('❌ Failed to trigger Journey exit animation:', error);
        }
      } else {
        // 🎮 INTERIM CARD pathway: Journey → Game
        // Skip exit animation - already played in continueFromInterimBoard
        console.log('🎮 Interim card pathway: Skipping exit animation (already played)');
      }
      
      // 🔥 FIX: Clean up journey board elements before hiding screen
      const journeyContainer = document.getElementById('journey-boards-container');
      if (journeyContainer) {
        const { journeyBoardsManager } = await import('./modules/journey-boards-manager.js');
        journeyBoardsManager.cleanup();
      }
      
      screen.classList.remove('show');
      screen.classList.add('hidden');
      
      // 🔥 USER REQUEST: Only show homepage if this is back button pathway
      if (!isBackButton) {
        // Interim card pathway - don't show homepage
        console.log('🎮 Interim card pathway: Not showing homepage');
        return; // Exit early
      }
      
      // 🔥 BACK BUTTON PATHWAY: Journey exit → Homepage slide 2 enter
      console.log('🏠 Step 2: Showing homepage slide 2 after Journey exit animation');
      
      // 🔥 CRITICAL: Set paper background to 50% opacity IMMEDIATELY when returning to homepage
      // This prevents gray background during transition and ensures correct opacity
      try {
        const { applyPaperBackground } = await import('./modules/ui-manager.js');
        if (typeof applyPaperBackground === 'function') {
          applyPaperBackground('0.6');
          console.log('✅ Paper background set to 60% opacity on Journey exit');
        }
      } catch (error) {
        console.warn('⚠️ Failed to set paper background on Journey exit:', error);
      }
      
      // Step 2a: Show homepage element
      const homeElement = document.getElementById('home');
      if (homeElement) {
        homeElement.removeAttribute('hidden');
        homeElement.style.removeProperty('display');
        homeElement.style.removeProperty('visibility');
        homeElement.style.removeProperty('opacity');
        homeElement.style.removeProperty('z-index');
        logger.info('✅ Homepage element shown');
      }
      
      // Step 2b: Show slider container
      const sliderContainerEl = document.getElementById('slider-container');
      if (sliderContainerEl) {
        sliderContainerEl.style.removeProperty('display');
        sliderContainerEl.style.removeProperty('visibility');
        sliderContainerEl.style.removeProperty('opacity');
        sliderContainerEl.style.removeProperty('z-index');
        logger.info('✅ Slider container shown');
      }
      
      // Step 2c: Ensure ALL slides are visible (slider uses translateX)
      const allSlides = document.querySelectorAll('.slider-slide');
      allSlides.forEach((slide, index) => {
        (slide as HTMLElement).style.display = 'block';
        (slide as HTMLElement).style.visibility = 'visible';
        (slide as HTMLElement).style.opacity = '1';
        
        // Ensure ALL content within each slide is visible
        const slideContent = slide.querySelector('.slide-content');
        const heroImage = slide.querySelector('.hero-image');
        const slideText = slide.querySelector('.slide-text');
        const slideTagline = slide.querySelector('.slide-tagline');
        const slideButton = slide.querySelector('.slide-button');
        
        if (slideContent) (slideContent as HTMLElement).style.display = 'flex';
        if (heroImage) (heroImage as HTMLElement).style.display = 'block';
        
        // 🔥 iPad FIX: Preserve transform positions on iPad after navigation
        const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;
        
        if (slideText) {
          (slideText as HTMLElement).style.display = 'block';
          (slideText as HTMLElement).style.visibility = 'visible';
          (slideText as HTMLElement).style.opacity = '1';
          const isActiveSlide = slide.classList.contains('active');
          
          if (isIPad) {
            const currentTransform = (slideText as HTMLElement).style.transform;
            if (!currentTransform || !currentTransform.includes('translateY(64px)')) {
              (slideText as HTMLElement).style.transform = 'translateY(64px)';
              (slideText as HTMLElement).style.webkitTransform = 'translateY(64px)';
            }
            
            // 🔥 FIX: Za neaktivne slide-ove na iPadu, ukloniti animate-enter-initial
            if (!isActiveSlide) {
              (slideText as HTMLElement).classList.remove('animate-enter-initial');
            }
          }
        }
        if (slideTagline) {
          (slideTagline as HTMLElement).style.display = 'block';
          (slideTagline as HTMLElement).style.visibility = 'visible';
          (slideTagline as HTMLElement).style.opacity = '1';
          if (isIPad) {
            const currentTransform = (slideTagline as HTMLElement).style.transform;
            if (!currentTransform || !currentTransform.includes('translateY(-12px)')) {
              (slideTagline as HTMLElement).style.transform = 'translateY(-12px)';
              (slideTagline as HTMLElement).style.webkitTransform = 'translateY(-12px)';
            }
          }
        }
        if (slideButton) {
          // 🔥 FIX: Za iPad, osigurati da je CTA button vidljiv na neaktivnim slide-ovima
          // Animacija će se pokrenuti samo za aktivni slide
          const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;
          const isActiveSlide = slide.classList.contains('active');
          
          if (isIPad && !isActiveSlide) {
            // Za neaktivne slide-ove na iPadu, ukloniti animate-enter-initial i postaviti display
            (slideButton as HTMLElement).classList.remove('animate-enter-initial');
            (slideButton as HTMLElement).style.display = 'flex';
            (slideButton as HTMLElement).style.visibility = 'visible';
            (slideButton as HTMLElement).style.opacity = '1';
            // 🔥 CRITICAL: Postaviti transform: scale(1) jer animate-enter-initial postavlja scale(0)
            (slideButton as HTMLElement).style.transform = 'translateY(0px) scale(1)';
            (slideButton as HTMLElement).style.webkitTransform = 'translateY(0px) scale(1)';
          }
          // Za aktivni slide, animate-enter-initial će biti uklonjen u startEnterAnimationSequence
        }
      });
      logger.info('✅ All slides and content made visible');
      
      // Step 2d: Position slider on Journey slide (index 1) BEFORE enter animation
      const sliderWrapper = document.getElementById('slider-wrapper') as HTMLElement;
      if (sliderWrapper && sliderContainerEl) {
        const slideWidth = sliderContainerEl.offsetWidth || window.innerWidth;
        const targetOffset = -1 * slideWidth; // Slide 2 (index 1)
        
        // Set position immediately using GSAP
        if (typeof gsap !== 'undefined') {
          gsap.set(sliderWrapper, { x: targetOffset, immediateRender: true });
        } else {
          sliderWrapper.style.transform = `translateX(${targetOffset}px)`;
        }
        console.log(`✅ Slider positioned at slide 2 (index 1), offset: ${targetOffset}px`);
      }
      
      // Step 2e: Set slide 2 as active
      allSlides.forEach((slide, index) => {
        if (index === 1) {
          slide.classList.add('active');
        } else {
          slide.classList.remove('active');
        }
      });
      
      // Step 2f: Set nav button 2 as active
      const navButtons = document.querySelectorAll('.independent-nav-button');
      navButtons.forEach((button, index) => {
        if (index === 1) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
      console.log('✅ Slide 2 and nav button 2 marked as active');
      
      // Step 2g: Update sliderManager state
      const sliderManager = (window as any).sliderManager;
      if (sliderManager) {
        sliderManager.currentSlide = 1;
        console.log('✅ SliderManager state updated to slide 2 (index 1)');
      }
      
      // Step 2h: Show navigation
      const navElement = document.getElementById('independent-nav');
      if (navElement) {
        navElement.style.removeProperty('display');
        navElement.style.removeProperty('visibility');
        navElement.style.removeProperty('opacity');
        logger.info('✅ Navigation shown');
      }
      
      // Step 2i: Force DOM reflow to ensure .active class is applied
      const activeSlideCheck = document.querySelector('.slider-slide.active');
      if (activeSlideCheck) {
        void (activeSlideCheck as HTMLElement).offsetHeight; // Force reflow
        const slideIndex = Array.from(allSlides).indexOf(activeSlideCheck);
        console.log(`✅ Active slide verified: index ${slideIndex} (should be 1 for Journey slide)`);
        if (slideIndex !== 1) {
          console.warn(`⚠️ WARNING: Active slide is ${slideIndex}, expected 1! Fixing...`);
          // Fix: Set slide 2 as active again
          allSlides.forEach((slide, idx) => {
            if (idx === 1) slide.classList.add('active');
            else slide.classList.remove('active');
          });
        }
      }
      
      // Step 3: Trigger homepage slide 2 ENTER animation
      // 🔥 USER REQUEST: Journey exit → Slide 2 enter animacija
      // Use requestAnimationFrame to ensure DOM is fully updated before animation
      await new Promise(resolve => requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          // Final verification before animation
          const finalActiveSlide = document.querySelector('.slider-slide.active');
          const finalSlideIndex = finalActiveSlide ? Array.from(allSlides).indexOf(finalActiveSlide) : -1;
          if (finalSlideIndex === 1) {
            console.log('🎬 Step 3: Triggering slide 2 enter animation...');
            const { animateSliderEnter } = await import('./utils/animations.js');
            animateSliderEnter();
            logger.info('✅ Homepage slide 2 enter animation triggered - Final destination: Slide 2');
          } else {
            console.error(`❌ CRITICAL: Active slide is ${finalSlideIndex}, not 1! Cannot animate slide 2.`);
          }
          resolve(undefined);
        });
      }));
    }
  }

  private renderCards(): void {
    this.renderCategory('common');
    this.renderCategory('legendary');
  }

  private triggerPendingFlipAnimations(): void {
    const storageKey = 'pending_collectible_flips_v1';
    let pending: PendingFlipItem[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          pending = parsed;
        }
      }
    } catch (error) {
      logger.warn('Failed to read pending flip list:', error);
    }

    if (!pending.length && Array.isArray(window.__pendingCollectibleFlips)) {
      pending = window.__pendingCollectibleFlips;
    }

    if (!pending.length) {
      return;
    }

    // Clear pending flips after viewing (cards are already shown as unlocked)
    try { localStorage.removeItem(storageKey); } catch {}
    window.__pendingCollectibleFlips = [];

    // 🔥 USER REQUEST: Badge ONLY on Journey icon (stats-nav.png), not on Collectibles
    // No badge update needed here - badge only shows on Journey icon

    // Add bounce animation to newly unlocked cards
    // Cards are already rendered as unlocked, just add bounce animation
          requestAnimationFrame(() => {
      pending.forEach((item) => {
        const cardEl = document.querySelector(`.collectible-card[data-card-id="${item.cardId}"].newly-unlocked`) as HTMLElement;
        if (!cardEl) return;

        // Add bounce animation class
        cardEl.classList.add('bounce-idle');
        
        // Random bounce parameters for each card to make them unique
        // Bounce height: random between 10px and 14px
        const randomHeight = Math.random() * 4 + 10; // 10-14px
        // Bounce duration: random between 1.0s and 1.4s
        const randomDuration = Math.random() * 0.4 + 1.0; // 1.0-1.4s
        // Bounce delay: random between 0s and 0.3s (small delay to stagger animations)
        const randomDelay = Math.random() * 0.3; // 0-0.3s
        
        // Apply random bounce parameters
        cardEl.style.setProperty('--card-bounce-height', `${randomHeight}px`);
        cardEl.style.setProperty('--card-bounce-duration', `${randomDuration}s`);
        cardEl.style.setProperty('--card-bounce-delay', `${randomDelay}s`);
        
        console.log('✅ Added bounce animation to card:', item.cardId, 'height:', randomHeight.toFixed(1), 'px, duration:', randomDuration.toFixed(2), 's, delay:', randomDelay.toFixed(2), 's');
      });
    });
  }

  private renderCategory(category: keyof CollectiblesData): void {
    const container = document.getElementById(`${category}-cards`);
    if (!container) return;
    
    container.innerHTML = '';

    this.collectiblesData[category].forEach((card, index) => {
      const cardElement = this.createCardElement(card, category, index + 1);
      cardElement.classList.add('collectibles-card-slot');
      container.appendChild(cardElement);
    });
  }

  private createCardElement(card: CollectibleCard, category: keyof CollectiblesData, number: number): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `collectible-card-wrapper ${category}`;

    const numberStr = number.toString().padStart(2, '0');
    const label = document.createElement('div');
    label.className = 'collectible-card-label';
    label.textContent = numberStr;

    const rarityLabel = category === 'legendary' ? 'Legendary' : 'Common';

    const cardDiv = document.createElement('div');
    cardDiv.className = `collectible-card ${category}`;
    cardDiv.dataset.cardId = card.id;
    cardDiv.dataset.category = category;
    cardDiv.dataset.cardNumber = number.toString();
    cardDiv.dataset.rarity = category;
    cardDiv.setAttribute('data-collectible-id', card.id);
    cardDiv.setAttribute('role', 'button');
    cardDiv.setAttribute('tabindex', '0');

    const imagePath = this.getCardImagePath(category, number);
    const placeholderPath = this.getPlaceholderPath(category);

    cardDiv.dataset.frontImage = imagePath;
    cardDiv.dataset.backImage = placeholderPath;
    
    // Check if this is a new card (pending flip)
    const pendingFlips = Array.isArray((window as any).__pendingCollectibleFlips) ? (window as any).__pendingCollectibleFlips : [];
    const isNewCard = pendingFlips.some((item: any) => item && item.cardId === card.id);
    
    // Debug logging
    if (card.unlocked && isNewCard) {
      console.log('🎁 Rendering new card as locked:', card.id, 'pendingFlips length:', pendingFlips.length);
    }

    if (card.unlocked) {
      // Always show unlocked cards as unlocked (no flip animation)
      cardDiv.classList.add('unlocked');
      cardDiv.style.backgroundImage = `url('${imagePath}')`;
      cardDiv.setAttribute(
        'aria-label',
        `Collectible ${numberStr} (${rarityLabel}): ${card.name} unlocked`
      );
      
      // Mark new cards for bounce animation
      if (isNewCard) {
        cardDiv.classList.add('newly-unlocked');
        cardDiv.setAttribute('data-newly-unlocked', 'true');
      }
    } else {
      cardDiv.classList.add('locked');
      cardDiv.style.backgroundImage = `url('${placeholderPath}')`;
      cardDiv.setAttribute(
        'aria-label',
        `Collectible ${numberStr} (${rarityLabel}) locked`
      );
    }

    const badge = document.createElement('span');
    badge.className = 'collectible-rarity-badge';
    badge.innerHTML = `<span class="badge-number">${numberStr}</span> ${rarityLabel}`;
    badge.setAttribute('aria-hidden', 'true');
    cardDiv.appendChild(badge);
    
    // Add star indicator for new cards
    if (isNewCard) {
      const star = document.createElement('div');
      star.className = 'collectible-new-star';
      star.setAttribute('aria-hidden', 'true');
      cardDiv.appendChild(star);
    }

    cardDiv.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        cardDiv.click();
      }
    });

    wrapper.appendChild(label);
    wrapper.appendChild(cardDiv);
    return wrapper;
  }

  private getPlaceholderPath(category: keyof CollectiblesData): string {
    return category === 'legendary'
      ? './assets/colelctibles/legendary back.png'
      : './assets/colelctibles/common back.png';
  }

  private getCardImagePath(category: keyof CollectiblesData, number: number): string {
    if (category === 'legendary') {
      const assetNumber = (number + 20).toString().padStart(2, '0');
      return `./assets/colelctibles/legendary/${assetNumber}.png`;
    }
    const assetNumber = number.toString().padStart(2, '0');
    return `./assets/colelctibles/common/${assetNumber}.png`;
  }

  private updateCounters(): void {
    const commonUnlocked = this.collectiblesData.common.filter(c => c.unlocked).length;
    const legendaryUnlocked = this.collectiblesData.legendary.filter(c => c.unlocked).length;

    const commonCounter = document.getElementById('common-counter');
    const legendaryCounter = document.getElementById('legendary-counter');
    
    if (commonCounter) commonCounter.textContent = `${commonUnlocked}/20`;
    if (legendaryCounter) legendaryCounter.textContent = `${legendaryUnlocked}/6`;
  }

  private preloadImages(): Promise<PreloadResult[]> {
    if (this.preloadPromise) return this.preloadPromise;

    const sources = new Set<string>([
      this.getPlaceholderPath('common'),
      this.getPlaceholderPath('legendary')
    ]);

    this.collectiblesData.common.forEach((card, index) => {
      sources.add(this.getCardImagePath('common', index + 1));
    });
    this.collectiblesData.legendary.forEach((card, index) => {
      sources.add(this.getCardImagePath('legendary', index + 1));
    });

    const loadImage = (src: string): Promise<PreloadResult> => new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({ src, status: 'loaded' });
      img.onerror = () => resolve({ src, status: 'error' });
      img.src = src;
    });

    this.preloadPromise = Promise.all([...sources].map(loadImage))
      .then(results => {
        const loaded = results.filter(r => r.status === 'loaded').length;
        logger.info(`🎁 Preloaded collectibles assets: ${loaded}/${results.length}`);
        return results;
      })
      .catch(error => {
        logger.warn('⚠️ Collectibles preload failed:', error);
        throw error;
      });

    return this.preloadPromise;
  }

  public showCardDetail(cardId: string, category: string): void {
    console.log('🎁 showCardDetail called:', { cardId, category });
    
    const cards = this.collectiblesData[category as keyof CollectiblesData];
    console.log('🎁 Cards found:', cards);
    
    const index = cards.findIndex(c => c.id === cardId);
    console.log('🎁 Card index:', index);
    
    if (index === -1) {
      console.warn('⚠️ Card not found:', cardId);
      return;
    }

    const card = cards[index];
    if (!card) {
      console.warn('⚠️ Card is null at index:', index);
      return;
    }

    console.log('🎁 Card found:', card);

    const modal = document.getElementById('collectibles-detail-modal');
    console.log('🎁 Modal found:', !!modal);
    
    // Hide Play Board button for regular collectibles (only show for Journey boards)
    // Also clear/hide title for regular collectibles (title is only for Journey boards)
    if (modal) {
      const playBoardBtn = modal.querySelector('#detail-play-board-btn');
      const continueBoardBtn = modal.querySelector('#detail-continue-board-btn');
      if (playBoardBtn) {
        (playBoardBtn as HTMLElement).style.setProperty('display', 'none', 'important');
      }
      if (continueBoardBtn) {
        (continueBoardBtn as HTMLElement).style.setProperty('display', 'none', 'important');
      }
      // Remove Journey board ID attribute if present
      modal.removeAttribute('data-journey-board-id');
      
      // Clear title for regular collectibles (title is only shown for Journey boards)
      const titleEl = modal.querySelector('#detail-title');
      if (titleEl) {
        titleEl.textContent = '';
      }
    }
    
    const numberStr = (index + 1).toString().padStart(2, '0');
    const frontImagePath = this.getCardImagePath(category as keyof CollectiblesData, index + 1);
    const backImagePath = this.getPlaceholderPath(category as keyof CollectiblesData);
    
    // Use back image if card is locked, front image if unlocked
    const imagePath = card.unlocked ? frontImagePath : backImagePath;
    console.log('🎁 Image path:', imagePath, 'unlocked:', card.unlocked);

    const cardNumberEl = document.getElementById('detail-card-number');
    const cardImageEl = document.getElementById('detail-card-image') as HTMLElement;
    const cardDescriptionEl = document.getElementById('detail-card-description');
    const cardRarityBadge = document.getElementById('detail-rarity-badge');
    
    console.log('🎁 Elements found:', {
      cardNumber: !!cardNumberEl,
      cardImage: !!cardImageEl,
      cardDescription: !!cardDescriptionEl,
      cardRarityBadge: !!cardRarityBadge
    });

    if (cardNumberEl) {
      cardNumberEl.textContent = numberStr;
      console.log('✅ Card number set:', numberStr);
    } else {
      console.warn('⚠️ Card number element not found');
    }
    
    if (cardImageEl) {
      cardImageEl.style.backgroundImage = `url('${imagePath}')`;
      
      // Add locked class to image element if card is locked
      if (card.unlocked) {
        cardImageEl.classList.remove('locked');
      } else {
        cardImageEl.classList.add('locked');
      }
      
      console.log('✅ Card image set:', imagePath, 'locked:', !card.unlocked);
    } else {
      console.warn('⚠️ Card image element not found');
    }
    
    if (cardRarityBadge) {
      const rarityLabel = category === 'legendary' ? 'LEGENDARY' : 'COMMON';
      cardRarityBadge.textContent = rarityLabel;
      if (category === 'legendary') {
        cardRarityBadge.classList.add('legendary');
      } else {
        cardRarityBadge.classList.remove('legendary');
      }
      console.log('✅ Rarity badge set:', rarityLabel);
    } else {
      console.warn('⚠️ Rarity badge element not found');
    }
    
    // Update container class for divider styling
    const badgeContainer = document.querySelector('.detail-rarity-badge-container');
    if (badgeContainer) {
      if (category === 'legendary') {
        badgeContainer.classList.add('has-legendary');
      } else {
        badgeContainer.classList.remove('has-legendary');
      }
    }
    
    if (cardDescriptionEl) {
      cardDescriptionEl.textContent = card.description;
      console.log('✅ Card description set:', card.description);
    } else {
      console.warn('⚠️ Card description element not found');
    }
    
    // 🔥 JOURNEY BOARDS: Display board stats (High Score, Longest Combo, Cubes Cracked) for common boards
    if (category === 'common') {
      const boardId = number; // Card number = Board number
      
      // Import and get board stats + global stats
      Promise.all([
        import('./services/board-stats-service.js'),
        import('./services/stats-service.js')
      ]).then(([{ boardStatsService }, { statsService }]) => {
        const boardStats = boardStatsService.getBoardStats(boardId);
        const globalStats = statsService.getStats();
        
        // Update stats values in new swipeable format
        const highScoreEl = document.getElementById('detail-stat-highscore-value');
        const comboEl = document.getElementById('detail-stat-combo-value');
        const cubesEl = document.getElementById('detail-stat-cubes-value');
        
        if (highScoreEl) {
          highScoreEl.textContent = boardStats.highScore.toLocaleString();
        }
        if (comboEl) {
          comboEl.textContent = boardStats.longestCombo.toString();
        }
        if (cubesEl) {
          cubesEl.textContent = globalStats.cubesCracked.toLocaleString();
        }
        
        console.log(`✅ Board stats displayed for board ${boardId}:`, {
          highScore: boardStats.highScore,
          longestCombo: boardStats.longestCombo,
          cubesCracked: globalStats.cubesCracked
        });
      }).catch((error) => {
        console.warn('⚠️ Failed to load board stats:', error);
      });
      
      // 🔥 NEW: Initialize swipeable container - start at stats section (index 0)
      const swipeableContainer = modal?.querySelector('.detail-swipeable-container');
      if (swipeableContainer) {
        // Reset to first section (stats) - using pixels for peek effect
        (swipeableContainer as HTMLElement).style.transform = 'translateX(0px)';
        // Import journey boards manager to use swipe initialization
        import('./modules/journey-boards-manager.js').then(({ journeyBoardsManager }) => {
          if (typeof (journeyBoardsManager as any).initDetailModalSwipe === 'function') {
            (journeyBoardsManager as any).initDetailModalSwipe(swipeableContainer as HTMLElement);
            console.log('✅ Swipeable container initialized for regular collectibles - starting at stats section (card visible on right)');
          }
        }).catch((error) => {
          console.warn('⚠️ Failed to initialize swipeable container:', error);
        });
      }
    } else {
      // Remove stats container for legendary cards
      const statsContainer = document.getElementById('board-stats-container');
      if (statsContainer) {
        statsContainer.remove();
      }
    }

    if (modal) {
      console.log('✅ Modal exists, showing...');
      this.detailTrigger = document.activeElement as HTMLElement;
      this.currentDetailCardId = cardId; // Store current card ID
      this.currentDetailCategory = category; // Store current category
      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
      
      // 🔥 USER REQUEST: Hide reset stats button for regular collectibles (only show for journey boards)
      const resetStatsBtn = modal.querySelector('#detail-reset-stats-btn') as HTMLElement;
      if (resetStatsBtn) {
        resetStatsBtn.style.display = 'none';
        resetStatsBtn.style.visibility = 'hidden';
      }
      
      // CRITICAL: Ensure close button is always clickable
      const closeBtn = document.getElementById('detail-close-btn');
      if (closeBtn) {
        // Remove any existing event listeners by cloning the button
        const newCloseBtn = closeBtn.cloneNode(true) as HTMLElement;
        closeBtn.parentNode?.replaceChild(newCloseBtn, closeBtn);
        
        // Set pointer events explicitly to ensure it's always clickable
        newCloseBtn.style.pointerEvents = 'auto';
        newCloseBtn.style.zIndex = '2000000';
        newCloseBtn.style.position = 'relative';
        newCloseBtn.style.cursor = 'pointer';
        
        // Add click listener directly to ensure it always works
        const handleCloseClick = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🎁 Close button clicked (direct listener)!');
          this.hideCardDetail();
        };
        
        // Multiple ways to attach listener for maximum compatibility
        newCloseBtn.addEventListener('click', handleCloseClick, { capture: true });
        newCloseBtn.addEventListener('click', handleCloseClick, { capture: false });
        newCloseBtn.onclick = handleCloseClick;
        
        // Also handle touch events for mobile
        newCloseBtn.addEventListener('touchend', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🎁 Close button touched (touchend)!');
          this.hideCardDetail();
        }, { capture: true, passive: false });
        
        console.log('✅ Close button made clickable with multiple listeners');
      } else {
        console.warn('⚠️ Close button not found when showing modal');
      }
      
      // 🔥 JOURNEY BOARDS: Create floating Play button for common boards
      if (category === 'common') {
        const boardId = number;
        
        // Remove existing play button if any
        const existingPlayBtn = document.getElementById('board-detail-play-button');
        if (existingPlayBtn) {
          existingPlayBtn.remove();
        }
        
        // Create new floating play button - EXACT same style as homepage slider CTA with shimmer
        const playButton = document.createElement('button');
        playButton.id = 'board-detail-play-button';
        playButton.className = 'slide-button tap-scale menu-btn-primary';
        playButton.textContent = 'Play';
        playButton.setAttribute('type', 'button');
        playButton.setAttribute('aria-label', 'Play Board');
        
        // Prevent dragging/moving the button
        playButton.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        playButton.addEventListener('touchstart', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        
        // Add click handler
        playButton.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          console.log(`🎮🎮🎮 PLAY BUTTON CLICKED! Board ID: ${boardId}`);
          
          // Play haptic feedback
          try {
            if ((window as any).playHaptic) {
              (window as any).playHaptic('light');
            }
          } catch {}
          
          // 🔥 USER REQUEST: Check hearts BEFORE starting game (same as interim board)
          // If no hearts, show hearts bottom sheet instead of starting game
          try {
            const { heartsSystem } = await import('./modules/hearts-system.js');
            if (!heartsSystem.hasHearts()) {
              console.log('💔 No hearts available - showing hearts bottom sheet instead of starting game');
              const { showHeartsModal } = await import('./modules/hearts-bottom-sheet.js');
              showHeartsModal();
              return; // Don't start game - show hearts modal instead
            }
          } catch (error) {
            console.warn('⚠️ Failed to check hearts, continuing anyway:', error);
            // Continue if hearts check fails (fallback behavior)
          }
          
          // Close detail modal with exit animation
          await this.hideCardDetail();
          
          // Close Journey screen with exit animation
          const { animateCollectiblesScreenExit } = await import('./ui/collectibles-animations.js');
          await animateCollectiblesScreenExit();
          
          // Hide Journey screen
          await this.hideCollectibles();
          
          // Mark that we came from detail modal (for return on exit)
          (window as any).__ccCameFromDetailModal = true;
          (window as any).__ccDetailModalBoardId = boardId;
          console.log(`🎯 Marked as coming from detail modal for board ${boardId}`);
          
          // Start board from Journey
          console.log(`🎮 About to call startNewRunFromJourney with board ID: ${boardId}`);
          if (typeof (window as any).startNewRunFromJourney === 'function') {
            console.log(`✅ startNewRunFromJourney function exists, calling with board ${boardId}`);
            await (window as any).startNewRunFromJourney(boardId);
            console.log(`✅ startNewRunFromJourney call completed for board ${boardId}`);
          } else {
            console.error('❌ startNewRunFromJourney function NOT FOUND!');
          }
        });
        
        // Append to modal
        modal.appendChild(playButton);
        console.log(`✅ Floating Play button created for board ${boardId}`);
      } else {
        // Remove play button for legendary cards
        const existingPlayBtn = document.getElementById('board-detail-play-button');
        if (existingPlayBtn) {
          existingPlayBtn.remove();
        }
      }
      
      // Hide old buttons (not used anymore)
      const playBoardBtn = modal.querySelector('#detail-play-board-btn');
      const continueBoardBtn = modal.querySelector('#detail-continue-board-btn');
      if (playBoardBtn) {
        (playBoardBtn as HTMLElement).style.setProperty('display', 'none', 'important');
      }
      if (continueBoardBtn) {
        (continueBoardBtn as HTMLElement).style.setProperty('display', 'none', 'important');
      }
      
      // CRITICAL: Ensure background click also works to close modal
      const handleBackgroundClick = (e: MouseEvent | TouchEvent) => {
        const target = e.target as HTMLElement;
        // Only close if clicking directly on modal background (not on content)
        if (target === modal || target.id === 'collectibles-detail-modal') {
          e.preventDefault();
          e.stopPropagation();
          console.log('🎁 Modal background clicked, closing modal');
          this.hideCardDetail();
        }
      };
      
      // Add background click listener with multiple options
      modal.addEventListener('click', handleBackgroundClick, { capture: true });
      modal.addEventListener('click', handleBackgroundClick, { capture: false });
      modal.addEventListener('touchend', handleBackgroundClick, { capture: true, passive: false });
      
      console.log('✅ Background click listener attached to modal');
      
      // Enter animation: pop in (same style as slider)
      // Wait for modal to be visible before animating
      requestAnimationFrame(() => {
        // Find modal elements
        const detailImage = modal.querySelector('#detail-card-image');
        const detailDescription = modal.querySelector('#detail-card-description');
        const detailRarityBadge = modal.querySelector('#detail-rarity-badge');
        const detailCloseBtn = modal.querySelector('#detail-close-btn');
        
        console.log('🎬 Starting enter animation for detail modal elements:', {
          detailImage: !!detailImage,
          detailDescription: !!detailDescription,
          detailRarityBadge: !!detailRarityBadge,
          detailCloseBtn: !!detailCloseBtn
        });
        
        // Set initial state (scale 0) for all elements
        [detailImage, detailDescription, detailRarityBadge, detailCloseBtn].forEach(el => {
          if (el) {
            (el as HTMLElement).classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
            (el as HTMLElement).classList.add('animate-enter-initial');
            void (el as HTMLElement).offsetHeight; // Force reflow
          }
        });
        
        // Animate in with staggered delays (same as slider)
        if (detailImage) {
          setTimeout(() => {
            (detailImage as HTMLElement).classList.remove('animate-enter-initial');
            (detailImage as HTMLElement).classList.add('animate-enter');
            console.log('✅ Detail image enter animation started');
          }, 0);
        }
        if (detailDescription) {
          setTimeout(() => {
            (detailDescription as HTMLElement).classList.remove('animate-enter-initial');
            (detailDescription as HTMLElement).classList.add('animate-enter');
            console.log('✅ Detail description enter animation started');
          }, 30);
        }
        if (detailRarityBadge) {
          setTimeout(() => {
            (detailRarityBadge as HTMLElement).classList.remove('animate-enter-initial');
            (detailRarityBadge as HTMLElement).classList.add('animate-enter');
            console.log('✅ Detail rarity badge enter animation started');
          }, 60);
        }
        if (detailCloseBtn) {
          setTimeout(() => {
            (detailCloseBtn as HTMLElement).classList.remove('animate-enter-initial');
            (detailCloseBtn as HTMLElement).classList.add('animate-enter');
            console.log('✅ Detail close button enter animation started');
          }, 90);
        }
      });
      
        this.detailFocusTrap?.destroy();
        this.detailFocusTrap = createFocusTrap({
          container: modal,
          initialFocus: document.getElementById('detail-close-btn') as HTMLElement,
          onEscape: () => this.hideCardDetail(),
        });
      console.log('✅ Modal shown');
    } else {
      console.error('❌ Modal not found in DOM!');
    }
  }


  public showFirstCard(): void {
    // Show first unlocked card or first card in common category
    const cards = this.collectiblesData.common;
    if (cards && cards.length > 0) {
      const firstCard = cards[0];
      this.showCardDetail(firstCard.id, 'common');
    } else {
      console.warn('⚠️ No cards found to show');
    }
  }

  public hideCardDetail(): void {
    console.log('🎁 hideCardDetail called');
    
    const modal = document.getElementById('collectibles-detail-modal');
    if (!modal) {
      console.warn('⚠️ Modal not found in hideCardDetail');
      return;
    }

    // 🔥 CRITICAL: Check if this is a journey boards detail modal (has data-journey-board-id)
    // If so, don't use collectibles exit animation - journey boards manager handles it
    const journeyBoardId = modal.getAttribute('data-journey-board-id');
    if (journeyBoardId) {
      console.log(`🎁 Journey boards detail modal detected (board ${journeyBoardId}) - skipping collectibles exit animation`);
      // Journey boards manager will handle exit animation via its own event listener
      return;
    }

    this.currentDetailCategory = null;

    console.log('✅ Modal found, starting exit animation');
    
    // 🔥 MEMORY LEAK FIX: Stop CSS infinite animations before exit animation
    const detailImage = modal.querySelector('#detail-card-image') as HTMLElement;
    if (detailImage) {
      // Stop detailImageIdle animation (3s ease-in-out infinite)
      detailImage.style.animation = 'none';
      detailImage.style.animationPlayState = 'paused';
      // Stop shimmer animation on ::after pseudo-element by removing the class or stopping parent animation
      // Note: We can't directly access ::after, but stopping parent animation prevents it from running
      console.log('🧹 Detail image CSS animations stopped');
    }
    
    // 🔥 MEMORY LEAK FIX: Kill GSAP animations on modal elements
    try {
      const gsap = (window as any).gsap;
      if (gsap) {
        const modalElements = modal.querySelectorAll('*');
        modalElements.forEach((el: Element) => {
          try {
            gsap.killTweensOf(el);
          } catch {}
        });
        console.log('🧹 Detail modal GSAP animations killed');
      }
    } catch (error) {
      console.warn('⚠️ Failed to kill GSAP animations on detail modal:', error);
    }
    
    // Exit animation: pop out (same style as slider)
    // Find modal elements
    const detailDescription = modal.querySelector('#detail-card-description');
    const detailRarityBadge = modal.querySelector('#detail-rarity-badge');
    const detailCloseBtn = modal.querySelector('#detail-close-btn');
    
    // Animate out with staggered delays (reverse order of enter)
    if (detailCloseBtn) {
      (detailCloseBtn as HTMLElement).classList.remove('animate-enter', 'animate-enter-initial', 'animate-reset');
      (detailCloseBtn as HTMLElement).classList.add('animate-exit');
    }
    if (detailRarityBadge) {
      setTimeout(() => {
        (detailRarityBadge as HTMLElement).classList.remove('animate-enter', 'animate-enter-initial', 'animate-reset');
        (detailRarityBadge as HTMLElement).classList.add('animate-exit');
      }, 30);
    }
    if (detailDescription) {
      setTimeout(() => {
        (detailDescription as HTMLElement).classList.remove('animate-enter', 'animate-enter-initial', 'animate-reset');
        (detailDescription as HTMLElement).classList.add('animate-exit');
      }, 60);
    }
    if (detailImage) {
      setTimeout(() => {
        (detailImage as HTMLElement).classList.remove('animate-enter', 'animate-enter-initial', 'animate-reset');
        (detailImage as HTMLElement).classList.add('animate-exit');
      }, 90);
    }
    
    // Wait for animation to complete (650ms for exit animation), then hide modal
    setTimeout(() => {
      // Remove animation classes
      const detailImage = modal.querySelector('#detail-card-image');
      const detailDescription = modal.querySelector('#detail-card-description');
      const detailRarityBadge = modal.querySelector('#detail-rarity-badge');
      const detailCloseBtn = modal.querySelector('#detail-close-btn');
      
      [detailImage, detailDescription, detailRarityBadge, detailCloseBtn].forEach(el => {
        if (el) {
          (el as HTMLElement).classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
        }
      });
      
      // 🔥 MEMORY LEAK FIX: Ensure CSS animations are stopped
      const detailImageEl = modal.querySelector('#detail-card-image') as HTMLElement;
      if (detailImageEl) {
        detailImageEl.style.animation = 'none';
        detailImageEl.style.animationPlayState = 'paused';
      }
      
      modal.setAttribute('hidden', 'true');
      modal.setAttribute('aria-hidden', 'true');
      
      this.detailFocusTrap?.destroy();
      this.detailFocusTrap = null;

      const trigger = this.detailTrigger;
      this.detailTrigger = null;
      
      // 🔥 USER REQUEST: Always show Journey screen with enter animation after detail modal exit
      console.log('🎯 Showing Journey screen with enter animation after detail modal exit');
      
      // Show Journey screen with enter animation
      const collectiblesManager = (window as any).collectiblesManager;
      if (collectiblesManager && typeof collectiblesManager.showCollectibles === 'function') {
        // Small delay to ensure detail modal exit animation completes
        setTimeout(() => {
          collectiblesManager.showCollectibles();
          console.log('✅ Journey screen shown with enter animation after detail modal closed');
        }, 100); // Small delay after exit animation
      }

      // Remove bounce animation from the card that was viewed
      if (this.currentDetailCardId) {
        const viewedCard = document.querySelector(`.collectible-card[data-card-id="${this.currentDetailCardId}"]`) as HTMLElement;
        if (viewedCard) {
          viewedCard.classList.remove('bounce-idle', 'newly-unlocked');
          viewedCard.removeAttribute('data-newly-unlocked');
          viewedCard.style.removeProperty('--card-bounce-height');
          viewedCard.style.removeProperty('--card-bounce-duration');
          viewedCard.style.removeProperty('--card-bounce-delay');
          console.log('✅ Removed bounce animation from viewed card:', this.currentDetailCardId);
        }
        this.currentDetailCardId = null;
      }

      if (trigger && typeof trigger.focus === 'function') {
        trigger.focus();
      }
      
      console.log('✅ Modal hidden');
    }, 500); // 500ms animation duration
  }

  private showLockedMessage(): void {
    // Simple alert for now - can be replaced with a toast notification
    logger.info('Card is locked! Complete the challenge to unlock.');
    // You could show a toast notification here instead
  }

  private focusTargetCollectible(options?: CollectiblesShowOptions): void {
    if (!options?.scrollToCard) return;

    let target: HTMLElement | null = null;

    if (options.scrollToCard === 'new') {
      target = document.querySelector('.collectible-card.just-unlocked') as HTMLElement | null;
    }

    if (!target) {
      target =
        (document.querySelector(`.collectible-card[data-card-id="${options.scrollToCard}"]`) as HTMLElement | null) ||
        (document.querySelector(`.collectible-card[data-card-number="${options.scrollToCard}"]`) as HTMLElement | null);
    }

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (options.animateCard) {
        target.classList.add('card-glow');
        setTimeout(() => target.classList.remove('card-glow'), 2000);
      }
    }
  }

  // Event handler for unlocking cards
  unlockCard(eventName: string): void {
    const unlockedCards: Array<{ category: keyof CollectiblesData; card: CollectibleCard; number: number }> = [];

    Object.keys(this.collectiblesData).forEach(category => {
      this.collectiblesData[category as keyof CollectiblesData].forEach((card, index) => {
        if (card.event === eventName && !card.unlocked) {
          card.unlocked = true;
          unlockedCards.push({ category: category as keyof CollectiblesData, card, number: index + 1 });
          this.animateCardUnlock(card.id, category as keyof CollectiblesData);
        }
      });
    });

    if (unlockedCards.length) {
      this.saveCollectiblesState();
      this.updateCounters();
      logger.info(`🎉 Unlocked collectible for event: ${eventName}`);
      unlockedCards.forEach(({ category, card, number }) => {
        this.notifyCardUnlocked(category, number, card, { source: 'event', eventName });
      });
      
      // 🔥 CRITICAL: Update stats service with current unlocked count
      const totalUnlocked = this.collectiblesData.common.filter(c => c.unlocked).length + 
                            this.collectiblesData.legendary.filter(c => c.unlocked).length;
      if (typeof (window as any).trackCollectiblesUnlocked === 'function') {
        (window as any).trackCollectiblesUnlocked(totalUnlocked);
      }
    }
  }

  private animateCardUnlock(cardId: string, category: keyof CollectiblesData): void {
    const cardEl = document.querySelector(`.collectible-card[data-card-id="${cardId}"]`) as HTMLElement;
    const cards = this.collectiblesData[category] || [];
    const index = cards.findIndex(c => c.id === cardId);
    if (!cardEl || index === -1) return;

    const number = index + 1;
    const cardData = cards[index];
    const imagePath = this.getCardImagePath(category, number);

    cardEl.classList.remove('locked');
    cardEl.classList.add('unlocked', 'just-unlocked');
    cardEl.style.backgroundImage = `url('${imagePath}')`;
    const numberStr = number.toString().padStart(2, '0');
    const rarityLabel =
      category === 'legendary' ? 'Legendary' : 'Common';
    cardEl.setAttribute(
      'aria-label',
      `Collectible ${numberStr} (${rarityLabel}): ${cardData?.name || 'Unlocked'}`
    );

    setTimeout(() => {
      cardEl.classList.remove('just-unlocked');
    }, 650);
  }

  // Get collectibles data for external use
  getCollectiblesData(): CollectiblesData {
    return this.collectiblesData;
  }

  // Check if a specific card is unlocked
  isCardUnlocked(cardId: string, category: keyof CollectiblesData): boolean {
    const card = this.collectiblesData[category]?.find(c => c.id === cardId);
    return card ? card.unlocked : false;
  }

  // Reset all collectibles (for testing)
  resetAllCollectibles(): void {
    Object.keys(this.collectiblesData).forEach(category => {
      this.collectiblesData[category as keyof CollectiblesData].forEach(card => {
        card.unlocked = false;
      });
    });
    this.ensureDefaultUnlocked();
    this.saveCollectiblesState();
    this.renderCards();
    this.updateCounters();
  }

  private ensureDefaultUnlocked(): void {
    let changed = false;
    this.defaultUnlockedIds.forEach(id => {
      const card = this.collectiblesData.common.find(c => c.id === id);
      if (card && !card.unlocked) {
        card.unlocked = true;
        changed = true;
      }
    });
    if (changed) {
      this.saveCollectiblesState();
    }
  }

  private lockInitialCommons(): void {
    try {
      const flag = localStorage.getItem('collectibles_initial_lock_done');
      if (flag === '1') {
        return;
      }
    } catch {}

    let changed = false;
    this.collectiblesData.common.slice(0, 5).forEach(card => {
      if (card.unlocked) {
        card.unlocked = false;
        changed = true;
      }
    });
    if (changed) {
      try {
        localStorage.setItem('collectibles_state', JSON.stringify(this.collectiblesData));
      } catch (error) {
        logger.warn('Failed to lock initial common collectibles:', error);
      }
    }

    try {
      localStorage.setItem('collectibles_initial_lock_done', '1');
    } catch {}
  }

  handleSettingsClick(): void {
    try {
      logger.info('⚙️ Settings clicked - showing collectibles screen');
      // Just show collectibles screen - no unlock, no bottom sheet
      if (typeof window.showCollectiblesScreen === 'function') {
        window.showCollectiblesScreen();
      }
    } catch (error) {
      logger.warn('Failed to show collectibles screen from settings:', error);
    }
  }

  private handleDailyVisit(): void {
    // Keep this method for future use but disable the unlock logic
    try {
      const today = new Date().toISOString().slice(0, 10);
      const raw = localStorage.getItem('collectibles_daily_visit');
      let data: DailyVisitData = { date: today, count: 0 };
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            data = {
              date: typeof parsed.date === 'string' ? parsed.date : today,
              count: Number.isFinite(parsed.count) ? parsed.count : 0
            };
          }
        } catch {}
      }

      if (data.date === today) {
        data.count += 1;
      } else {
        data = { date: today, count: 1 };
      }

      localStorage.setItem('collectibles_daily_visit', JSON.stringify(data));

      // Disabled: Daily visit unlock logic
      // if (data.count >= 2) {
      //   if (this.unlockCardByNumber(1, { render: true, silent: true })) {
      //     logger.info('🎁 Daily visit bonus unlocked collectible 01');
      //   }
      // }
      
      logger.info('📊 Daily visit count:', data.count, 'for date:', data.date);
    } catch (error) {
      logger.warn('Failed to process daily visit tracking:', error);
    }
  }

  unlockCardByNumber(number: number, options: UnlockOptions = {}): boolean {
    const { render = true, silent = false } = options;
    let card: CollectibleCard | null = null;
    let categoryKey: keyof CollectiblesData | null = null;
    
    if (number >= 1 && number <= 20) {
      categoryKey = 'common';
      card = this.collectiblesData.common[number - 1] || null;
    } else if (number >= 21 && number <= 26) {
      categoryKey = 'legendary';
      card = this.collectiblesData.legendary[number - 21] || null;
    }

    if (!card || !categoryKey) return false;
    
    if (!card.unlocked) {
      card.unlocked = true;
      this.saveCollectiblesState();
      // Notify BEFORE rendering so card is in pendingFlips when renderCards() runs
      this.notifyCardUnlocked(categoryKey, number, card, { source: 'number' });
      if (render) {
        this.renderCards();
        this.updateCounters();
      } else {
        this.updateCounters();
      }
      if (!silent) {
        logger.info(`🎁 Collectible ${number.toString().padStart(2, '0')} unlocked via dev tool.`);
      }
    } else if (render) {
      this.renderCards();
    }
    return true;
  }

  private notifyCardUnlocked(category: keyof CollectiblesData, number: number, card: CollectibleCard, meta: UnlockMeta = { source: 'event' }): void {
    if (!category || !card) return;
    try {
      const detail = {
        cardId: card.id,
        cardName: card.name,
        cardDescription: card.description,
        category,
        number,
        rarity: card.rarity,
        imagePath: this.getCardImagePath(category, number),
        unlockedAt: Date.now(),
        ...meta
      };
      window.dispatchEvent(new CustomEvent('collectible:unlocked', { detail }));
      this.queuePendingFlip(detail);
    } catch (error) {
      logger.warn('Failed to dispatch collectible unlocked event:', error);
    }
  }

  private queuePendingFlip(detail: any): void {
    if (!detail?.cardId) return;
    const storageKey = 'pending_collectible_flips_v1';
    try {
      let list: PendingFlipItem[] = [];
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed;
        }
      }
      const exists = list.some(item => item && item.cardId === detail.cardId);
      if (!exists) {
        list.push({
          cardId: detail.cardId,
          category: detail.category,
          number: detail.number,
          frontImage: detail.imagePath,
          backImage: this.getPlaceholderPath(detail.category || 'common')
        });
        if (list.length > 20) {
          list = list.slice(list.length - 20);
        }
        localStorage.setItem(storageKey, JSON.stringify(list));
        window.__pendingCollectibleFlips = list;
        
        // 🔥 USER REQUEST: Badge ONLY on Journey icon (stats-nav.png), not on Collectibles
        // No badge update needed here - badge only shows on Journey icon
      }
    } catch (error) {
      logger.warn('Failed to queue collectible flip animation:', error);
    }
  }

  lockCardByNumber(number: number, options: { render?: boolean } = {}): boolean {
    const { render = true } = options;
    let card: CollectibleCard | null = null;
    if (number >= 1 && number <= 20) {
      card = this.collectiblesData.common[number - 1] || null;
    } else if (number >= 21 && number <= 26) {
      card = this.collectiblesData.legendary[number - 21] || null;
    }

    if (!card) return false;
    
    if (card.unlocked) {
      card.unlocked = false;
      this.saveCollectiblesState();
      if (render) {
        this.renderCards();
        this.updateCounters();
      }
      
      // Remove from pending flips and update badge
      if (Array.isArray((window as any).__pendingCollectibleFlips)) {
        (window as any).__pendingCollectibleFlips = (window as any).__pendingCollectibleFlips.filter(
          (item: any) => item && item.cardId !== card.id
        );
        
        // 🔥 USER REQUEST: Badge ONLY on Journey icon (stats-nav.png), not on Collectibles
        // No badge update needed here - badge only shows on Journey icon
      }
    }

    if (number === 1) {
      try { localStorage.removeItem('collectibles_daily_visit'); } catch {}
    }
    return true;
  }

  private initDevButtons(): void {
    const unlockBtn = document.getElementById('collectibles-unlock-btn');
    if (unlockBtn) {
      // Remove existing listener if any to prevent duplicates
      const newUnlockBtn = unlockBtn.cloneNode(true);
      unlockBtn.parentNode?.replaceChild(newUnlockBtn, unlockBtn);
      (newUnlockBtn as HTMLElement).addEventListener('click', () => {
        console.log('🎁 Show Card button clicked');
        this.showCardPickerModal('show');
      });
      console.log('✅ Show Card button listener attached');
    } else {
      console.warn('⚠️ collectibles-unlock-btn not found');
    }

    const hideBtn = document.getElementById('collectibles-hide-btn');
    if (hideBtn) {
      // Remove existing listener if any to prevent duplicates
      const newHideBtn = hideBtn.cloneNode(true);
      hideBtn.parentNode?.replaceChild(newHideBtn, hideBtn);
      (newHideBtn as HTMLElement).addEventListener('click', () => {
        console.log('🎁 Hide Card button clicked');
        this.showCardPickerModal('hide');
      });
      console.log('✅ Hide Card button listener attached');
    } else {
      console.warn('⚠️ collectibles-hide-btn not found');
    }
  }

  private showCardPickerModal(action: 'show' | 'hide'): void {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'card-picker-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100001;
      backdrop-filter: blur(4px);
    `;

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'card-picker-modal';
    modal.style.cssText = `
      background: white;
      border-radius: 24px;
      padding: 24px;
      max-width: 90vw;
      width: 400px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = action === 'show' ? 'Show Cards' : 'Hide Cards';
    title.style.cssText = `
      font-size: 24px;
      font-weight: 800;
      color: #ad8775;
      margin: 0 0 20px 0;
      text-align: center;
    `;

    // Grid container
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 20px;
    `;

    // Store selected cards
    const selectedCards: Set<number> = new Set();

    // Create 26 buttons (01-26)
    for (let i = 1; i <= 26; i++) {
      const btn = document.createElement('button');
      btn.textContent = i.toString().padStart(2, '0');
      btn.style.cssText = `
        background: #f3eee8;
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        padding: 16px;
        font-size: 16px;
        font-weight: 600;
        color: #333;
        cursor: pointer;
        transition: all 0.2s ease;
      `;

      btn.addEventListener('click', () => {
        if (selectedCards.has(i)) {
          // Deselect
          selectedCards.delete(i);
          btn.style.background = '#f3eee8';
          btn.style.borderColor = '#e0e0e0';
          btn.style.color = '#333';
        } else {
          // Select
          selectedCards.add(i);
          btn.style.background = '#e8734a';
          btn.style.borderColor = '#e8734a';
          btn.style.color = 'white';
        }
      });

      grid.appendChild(btn);
    }

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 12px;
    `;

    // OK button
    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.cssText = `
      flex: 1;
      background: #e8734a;
      border: none;
      border-radius: 12px;
      padding: 12px;
      font-size: 16px;
      font-weight: 600;
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    okBtn.addEventListener('mouseenter', () => {
      okBtn.style.background = '#d1653a';
    });

    okBtn.addEventListener('mouseleave', () => {
      okBtn.style.background = '#e8734a';
    });

    okBtn.addEventListener('click', () => {
      // Apply action to all selected cards
      selectedCards.forEach(cardNum => {
        this.handleCardAction(action, cardNum);
      });
      document.body.removeChild(overlay);
    });

    // Cancel button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cancel';
    closeBtn.style.cssText = `
      flex: 1;
      background: #e0e0e0;
      border: none;
      border-radius: 12px;
      padding: 12px;
      font-size: 16px;
      font-weight: 600;
      color: #666;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#ccc';
    });

    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = '#e0e0e0';
    });

    closeBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    // Assemble modal
    modal.appendChild(title);
    modal.appendChild(grid);
    buttonContainer.appendChild(okBtn);
    buttonContainer.appendChild(closeBtn);
    modal.appendChild(buttonContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });
  }

  private handleCardAction(action: 'show' | 'hide', num: number): void {
    if (action === 'show') {
      if (this.unlockCardByNumber(num)) {
        logger.info(`Collectible ${num.toString().padStart(2, '0')} unlocked.`);
      } else {
        logger.warn(`Collectible ${num.toString().padStart(2, '0')} not found.`);
    }
    } else {
      if (this.lockCardByNumber(num)) {
        logger.info(`Collectible ${num.toString().padStart(2, '0')} hidden.`);
      } else {
        logger.warn(`Collectible ${num.toString().padStart(2, '0')} not found.`);
      }
    }
  }
}

let collectiblesManagerInstance: CollectiblesManager | null = null;

export async function ensureCollectiblesManager(): Promise<CollectiblesManager> {
  if (!collectiblesManagerInstance) {
    logger.info('🎁 Creating Collectibles Manager instance');
    collectiblesManagerInstance = new CollectiblesManager();
    window.collectiblesManager = collectiblesManagerInstance;
  }
  return collectiblesManagerInstance;
}

export async function showCollectiblesScreen(options?: CollectiblesShowOptions): Promise<void> {
  const manager = await ensureCollectiblesManager();
  await manager.showCollectibles(options);
}

export async function hideCollectiblesScreen(): Promise<void> {
  const manager = await ensureCollectiblesManager();
  await manager.hideCollectibles();
}

export async function unlockCollectible(eventName: string): Promise<void> {
  const manager = await ensureCollectiblesManager();
  manager.unlockCard(eventName);
}

export async function unlockCollectibleByNumber(number: number): Promise<void> {
  const manager = await ensureCollectiblesManager();
  manager.unlockCardByNumber(Number(number) || 0);
}

export async function hideCollectibleByNumber(number: number): Promise<void> {
  const manager = await ensureCollectiblesManager();
  manager.lockCardByNumber(Number(number) || 0);
}

export default CollectiblesManager;
