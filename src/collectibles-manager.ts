import { logger } from './core/logger.js';
import { createFocusTrap, FocusTrap } from './utils/focus-trap.js';
import { Draggable } from 'gsap/Draggable';
import { gsap } from 'gsap';
// Register Draggable plugin
gsap.registerPlugin(Draggable);
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
  private eventListenersInitialized: boolean = false;
  private cardDraggable: Draggable | null = null;
  private cardPeekListeners: { element: HTMLElement; onStart: (e: Event) => void } | null = null;

  constructor() {
    this.collectiblesData = {
      common: [
        { id: 'common01', name: 'First Merge', description: 'Complete your first merge', rarity: 'Common', event: 'first_merge', unlocked: false },
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
        { id: 'legendary05', name: 'Ultimate Master', description: 'Complete 500 merges', rarity: 'Legendary', event: 'merge_500', unlocked: false }
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
    
    // Back button
    const backBtn = document.getElementById('collectibles-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        logger.info('🎁 Collectibles back button clicked');
        
        // Try to use animated version first, fallback to non-animated
        if (typeof (window as any).hideCollectiblesScreenWithAnimation === 'function') {
          logger.info('🎁 Calling window.hideCollectiblesScreenWithAnimation()');
          (window as any).hideCollectiblesScreenWithAnimation();
        } else if (typeof window.hideCollectiblesScreen === 'function') {
          logger.info('🎁 Calling window.hideCollectiblesScreen()');
          window.hideCollectiblesScreen();
        } else {
          logger.warn('⚠️ window.hideCollectiblesScreen not available, using fallback');
          this.hideCollectibles();
        }
      });
    }

    // Title click - scroll to top
    const titleEl = document.getElementById('collectibles-title');
    if (titleEl) {
      titleEl.style.cursor = 'pointer';
      titleEl.style.pointerEvents = 'auto'; // Override CSS pointer-events: none
      titleEl.addEventListener('click', () => {
        console.log('🎁 Title clicked, scrolling to top');
        const scrollable = document.querySelector('.collectibles-scrollable');
        if (scrollable) {
          scrollable.scrollTo({ top: 0, behavior: 'smooth' });
          console.log('✅ Scroll to top triggered');
        } else {
          console.warn('⚠️ Scrollable not found');
        }
      });
    }

    // Card clicks
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.collectible-card')) {
        const card = target.closest('.collectible-card') as HTMLElement;
        const cardId = card.dataset.cardId;
        const category = card.dataset.category;
        
        if (card.classList.contains('unlocked')) {
          // Light haptic for unlocked card tap
          if (typeof (window as any).triggerHapticImpact === 'function') {
            (window as any).triggerHapticImpact('light');
          }
          this.showCardDetail(cardId!, category!);
        } else {
          this.showLockedMessage();
        }
      }
    });

    // Modal close
    const closeBtn = document.getElementById('detail-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        console.log('🎁 Close button clicked!', e);
        this.hideCardDetail();
      });
    }

    // Close modal on background click
    const modal = document.getElementById('collectibles-detail-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hideCardDetail();
        }
      });
    }

    this.initDevButtons();
    
    this.eventListenersInitialized = true;
    console.log('✅ Event listeners initialized successfully');
  }

  async showCollectibles(options?: CollectiblesShowOptions): Promise<void> {
    logger.info('🎁 showCollectibles method called');
    const screen = document.getElementById('collectibles-screen');
    if (!screen) {
      logger.error('❌ collectibles-screen element not found');
      return;
    }

    // Preload already happens in constructor, skip await to show screen immediately
    // Images will load progressively in the background
    
    screen.classList.remove('hidden');
    logger.info('🎁 Removed hidden class');
    
    // Trigger animation
    requestAnimationFrame(() => {
      screen.classList.add('show');
      logger.info('🎁 Added show class');
    });
    
    this.renderCards();
    this.updateCounters();
    logger.info('🎁 Cards rendered and counters updated');
    this.triggerPendingFlipAnimations();
    
    // Only scroll to top if no specific card is requested
    if (!options?.scrollToCard) {
      const scrollable = document.querySelector('#collectibles-screen .collectibles-scrollable') as HTMLElement;
      if (scrollable) {
        console.log('🎁 Scrolling collectibles screen to top on open');
        scrollable.scrollTo({ top: 0, behavior: 'auto' }); // Use 'auto' for instant, or 'smooth' for animated
      }
    }
    
    this.focusTargetCollectible(options);
  }

  hideCollectibles(): void {
    const screen = document.getElementById('collectibles-screen');
    if (screen) {
      screen.classList.remove('show');
      
      setTimeout(() => {
        screen.classList.add('hidden');
      }, 400);
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

    try { localStorage.removeItem(storageKey); } catch {}
    window.__pendingCollectibleFlips = [];

    const startDelay = 2000;
    setTimeout(() => {
      pending.forEach((item, index) => {
        const cardEl = document.querySelector(`.collectible-card[data-card-id="${item.cardId}"]`) as HTMLElement;
        if (!cardEl) return;

        const frontImage = cardEl.dataset.frontImage || item.frontImage;
        const category = (item.category || cardEl.dataset.category || 'common') as keyof CollectiblesData;
        const backImage = cardEl.dataset.backImage || item.backImage || this.getPlaceholderPath(category);

        const playAnimation = () => {
          const originalBg = cardEl.style.backgroundImage;
          if (backImage) {
            cardEl.style.backgroundImage = `url('${backImage}')`;
          }

          cardEl.classList.add('flip-reveal-prep');
          requestAnimationFrame(() => {
            cardEl.classList.add('flip-reveal-play');
            setTimeout(() => {
              if (frontImage) {
                cardEl.style.backgroundImage = `url('${frontImage}')`;
              } else if (originalBg) {
                cardEl.style.backgroundImage = originalBg;
              }
            }, 180);
          });

          setTimeout(() => {
            cardEl.classList.remove('flip-reveal-prep', 'flip-reveal-play');
            if (frontImage) {
              cardEl.style.backgroundImage = `url('${frontImage}')`;
            } else if (originalBg) {
              cardEl.style.backgroundImage = originalBg;
            }
          }, 1100);
        };

        setTimeout(playAnimation, index * 220);
      });
    }, startDelay);
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

    if (card.unlocked) {
      cardDiv.classList.add('unlocked');
      cardDiv.style.backgroundImage = `url('${imagePath}')`;
      cardDiv.setAttribute(
        'aria-label',
        `Collectible ${numberStr} (${rarityLabel}): ${card.name} unlocked`
      );
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
    if (legendaryCounter) legendaryCounter.textContent = `${legendaryUnlocked}/5`;
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

  private showCardDetail(cardId: string, category: string): void {
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
    
    const numberStr = (index + 1).toString().padStart(2, '0');
    const imagePath = this.getCardImagePath(category as keyof CollectiblesData, index + 1);
    console.log('🎁 Image path:', imagePath);

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
      console.log('✅ Card image set:', imagePath);
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
    
    if (cardDescriptionEl) {
      cardDescriptionEl.textContent = card.description;
      console.log('✅ Card description set:', card.description);
    } else {
      console.warn('⚠️ Card description element not found');
    }

    if (modal) {
      console.log('✅ Modal exists, showing...');
      this.detailTrigger = document.activeElement as HTMLElement;
      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
      
      // Enter animation: scale and fade in
      modal.style.opacity = '0';
      modal.style.transform = 'scale(0.8) translateY(20px)';
      modal.style.transition = 'opacity 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
      
      // Trigger animation
      requestAnimationFrame(() => {
        modal.style.opacity = '1';
        modal.style.transform = 'scale(1) translateY(0)';
        
        // After enter animation, set up drag
        setTimeout(() => {
          this.setupCardDrag(cardImageEl);
        }, 500);
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

  private setupCardDrag(cardElement: HTMLElement): void {
    if (!cardElement) {
      console.warn('⚠️ Card element not found for drag setup');
      return;
    }

    // Kill any existing draggable
    if (this.cardDraggable) {
      this.cardDraggable.kill();
      this.cardDraggable = null;
    }

    console.log('🎁 Setting up card elastic peek effect');

    // Get card dimensions for 2% bounds (50% reduction)
    const cardRect = cardElement.getBoundingClientRect();
    const maxOffsetX = cardRect.width * 0.02; // 2% of width (was 4%)
    const maxOffsetY = cardRect.height * 0.02; // 2% of height (was 4%)
    
    console.log('🎁 Card bounds:', { maxOffsetX, maxOffsetY, width: cardRect.width, height: cardRect.height });

    // Variables to track touch/drag state
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let rafId: number | null = null;

    // Mouse/Touch down
    const onStart = (e: MouseEvent | TouchEvent) => {
      // Don't prevent default on buttons/clicks inside the card
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.tagName === 'BUTTON') {
        return;
      }
      
      e.preventDefault();
      isDragging = true;
      
      // Get initial position
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      startX = clientX;
      startY = clientY;
      
      console.log('🎁 Peek started');
      cardElement.style.zIndex = '999999';
      
      // Add global listeners for move and end
      document.addEventListener('mousemove', onMove as any);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove as any);
      document.addEventListener('touchend', onEnd);
    };

    // Mouse/Touch move
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      // Calculate offset
      const offsetX = clientX - startX;
      const offsetY = clientY - startY;
      
      // Apply resistance beyond 4% - elastic band effect (iOS style)
      let resistedX = offsetX;
      let resistedY = offsetY;
      
      if (Math.abs(offsetX) > maxOffsetX) {
        // Exponential resistance - stronger as you go further (reduced by 60%)
        const over = Math.abs(offsetX) - maxOffsetX;
        resistedX = Math.sign(offsetX) * (maxOffsetX + over * 0.06);
      }
      if (Math.abs(offsetY) > maxOffsetY) {
        const over = Math.abs(offsetY) - maxOffsetY;
        resistedY = Math.sign(offsetY) * (maxOffsetY + over * 0.06);
      }
      
      currentX = resistedX;
      currentY = resistedY;
      
      // Apply transform with requestAnimationFrame for smoothness
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        cardElement.style.transform = `translate(${resistedX}px, ${resistedY}px)`;
        rafId = null;
      });
    };

    // Mouse/Touch up
    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      
      // Cancel any pending RAF
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      
      console.log('🎁 Peek ended, springing back');
      
      // Simple spring back for both drag and tap with scale bounce
      gsap.to(cardElement, {
        x: 0,
        y: 0,
        scale: 1.05,
        duration: 0.15,
        ease: 'power2.out',
        onComplete: () => {
          gsap.to(cardElement, {
            scale: 1,
            duration: 0.20,
            ease: 'power2.in',
            onComplete: () => {
              cardElement.style.zIndex = '';
              cardElement.style.transform = '';
              console.log('✅ Bounce complete');
            }
          });
        }
      });
      
      // Remove event listeners
      document.removeEventListener('mousemove', onMove as any);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove as any);
      document.removeEventListener('touchend', onEnd);
    };

    // Add event listeners
    cardElement.addEventListener('mousedown', onStart);
    cardElement.addEventListener('touchstart', onStart);
    
    // Store for cleanup
    this.cardPeekListeners = { element: cardElement, onStart };
  }

  private hideCardDetail(): void {
    console.log('🎁 hideCardDetail called');
    
    // Kill draggable
    if (this.cardDraggable) {
      this.cardDraggable.kill();
      this.cardDraggable = null;
    }
    
    // Clean up peek listeners
    if (this.cardPeekListeners) {
      this.cardPeekListeners.element.removeEventListener('mousedown', this.cardPeekListeners.onStart as any);
      this.cardPeekListeners.element.removeEventListener('touchstart', this.cardPeekListeners.onStart as any);
      this.cardPeekListeners = null;
    }
    
    const modal = document.getElementById('collectibles-detail-modal');
    if (!modal) {
      console.warn('⚠️ Modal not found in hideCardDetail');
      return;
    }

    console.log('✅ Modal found, starting exit animation');
    
    // Clear any existing inline styles first
    modal.style.removeProperty('transition');
    modal.style.removeProperty('opacity');
    modal.style.removeProperty('transform');
    
    // Force layout recalculation
    void modal.offsetWidth;
    
    // Exit animation: scale down and fade out
    modal.style.transition = 'opacity 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    modal.style.opacity = '0';
    modal.style.transform = 'scale(0.8) translateY(20px)';
    
    // Wait for animation to complete, then hide modal
    setTimeout(() => {
      modal.setAttribute('hidden', 'true');
      modal.setAttribute('aria-hidden', 'true');
      modal.style.transition = '';
      modal.style.opacity = '';
      modal.style.transform = '';
      
      this.detailFocusTrap?.destroy();
      this.detailFocusTrap = null;

      const trigger = this.detailTrigger;
      this.detailTrigger = null;

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
    } else if (number >= 21 && number <= 25) {
      categoryKey = 'legendary';
      card = this.collectiblesData.legendary[number - 21] || null;
    }

    if (!card || !categoryKey) return false;
    
    if (!card.unlocked) {
      card.unlocked = true;
      this.saveCollectiblesState();
      if (render) {
        this.renderCards();
        this.updateCounters();
      } else {
        this.updateCounters();
      }
      this.notifyCardUnlocked(categoryKey, number, card, { source: 'number' });
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
    } else if (number >= 21 && number <= 25) {
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
    }

    if (number === 1) {
      try { localStorage.removeItem('collectibles_daily_visit'); } catch {}
    }
    return true;
  }

  private initDevButtons(): void {
    const unlockBtn = document.getElementById('collectibles-unlock-btn');
    if (unlockBtn) {
      unlockBtn.addEventListener('click', () => {
        this.showCardPickerModal('show');
      });
    }

    const hideBtn = document.getElementById('collectibles-hide-btn');
    if (hideBtn) {
      hideBtn.addEventListener('click', () => {
        this.showCardPickerModal('hide');
      });
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
    title.textContent = action === 'show' ? 'Show Card' : 'Hide Card';
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

    // Create 25 buttons (01-25)
    for (let i = 1; i <= 25; i++) {
      const btn = document.createElement('button');
      btn.textContent = i.toString().padStart(2, '0');
      btn.style.cssText = `
        background: #f5f5f5;
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        padding: 16px;
        font-size: 16px;
        font-weight: 600;
        color: #333;
        cursor: pointer;
        transition: all 0.2s ease;
      `;

      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#e8734a';
        btn.style.borderColor = '#e8734a';
        btn.style.color = 'white';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#f5f5f5';
        btn.style.borderColor = '#e0e0e0';
        btn.style.color = '#333';
      });

      btn.addEventListener('click', () => {
        this.handleCardAction(action, i);
        document.body.removeChild(overlay);
      });

      grid.appendChild(btn);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cancel';
    closeBtn.style.cssText = `
      width: 100%;
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
    modal.appendChild(closeBtn);
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
  manager.hideCollectibles();
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
