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

    // Card clicks
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.collectible-card')) {
        const card = target.closest('.collectible-card') as HTMLElement;
        const cardId = card.dataset.cardId;
        const category = card.dataset.category;
        
        if (card.classList.contains('unlocked')) {
          this.showCardDetail(cardId!, category!);
        } else {
          this.showLockedMessage();
        }
      }
    });

    // Modal close
    const closeBtn = document.getElementById('detail-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
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
    const scrollable = document.querySelector('#collectibles-screen .collectibles-scrollable') as HTMLElement;
    if (scrollable) {
      scrollable.scrollTop = 0;
    }
    logger.info('🎁 Cards rendered and counters updated');
    this.triggerPendingFlipAnimations();
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
    badge.textContent = rarityLabel;
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
    const cards = this.collectiblesData[category as keyof CollectiblesData];
    const index = cards.findIndex(c => c.id === cardId);
    if (index === -1) return;

    const card = cards[index];
    if (!card) return;

    const rarityLabel = category === 'legendary' ? 'Legendary' : 'Common';
    const modal = document.getElementById('collectibles-detail-modal');
    const numberStr = (index + 1).toString().padStart(2, '0');
    const imagePath = this.getCardImagePath(category as keyof CollectiblesData, index + 1);

    const cardNumberEl = document.getElementById('detail-card-number');
    const cardImageEl = document.getElementById('detail-card-image') as HTMLElement;
    const cardDescriptionEl = document.getElementById('detail-card-description');

    if (cardNumberEl) cardNumberEl.textContent = `${rarityLabel} • ${numberStr}`;
    if (cardImageEl) cardImageEl.style.backgroundImage = `url('${imagePath}')`;
    if (cardDescriptionEl) cardDescriptionEl.textContent = card.description;

    if (modal) {
      this.detailTrigger = document.activeElement as HTMLElement;
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.remove('hidden');
      requestAnimationFrame(() => {
        modal.classList.add('show');
        this.detailFocusTrap?.destroy();
        this.detailFocusTrap = createFocusTrap({
          container: modal,
          initialFocus: document.getElementById('detail-close-btn') as HTMLElement,
          onEscape: () => this.hideCardDetail(),
        });
      });
    }
  }

  private hideCardDetail(): void {
    const modal = document.getElementById('collectibles-detail-modal');
    if (!modal) return;

    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    this.detailFocusTrap?.destroy();
    this.detailFocusTrap = null;

    const trigger = this.detailTrigger;
    this.detailTrigger = null;

    setTimeout(() => {
      modal.classList.add('hidden');
      if (trigger && typeof trigger.focus === 'function') {
        trigger.focus();
      }
    }, 300);
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
      logger.info('⚙️ Settings clicked - checking for collectible 01 unlock');
      
      // Check if collectible 01 is already unlocked
      const card01 = this.collectiblesData.common[0]; // 01 - DAILY LOG
      if (card01 && !card01.unlocked) {
        if (this.unlockCardByNumber(1, { render: true, silent: false })) {
          logger.info('🎁 Settings click unlocked collectible 01 - DAILY LOG');
          
          // Show reward bottom sheet
          if (typeof window.showCollectibleRewardBottomSheet === 'function') {
            window.showCollectibleRewardBottomSheet({
              cardName: card01.name,
              imagePath: card01.imagePath || this.getCardImagePath('common', 1)
            });
          }
        }
      } else {
        logger.info('🎁 Collectible 01 already unlocked or not found');
      }
    } catch (error) {
      logger.warn('Failed to process settings click unlock:', error);
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
        const num = this.promptForCardNumber('🧪 Unlock collectible (01-25):');
        if (num === null) return;
        if (this.unlockCardByNumber(num)) {
          alert(`Collectible ${num.toString().padStart(2, '0')} unlocked.`);
        } else {
          alert(`Collectible ${num.toString().padStart(2, '0')} not found.`);
        }
      });
    }

    const hideBtn = document.getElementById('collectibles-hide-btn');
    if (hideBtn) {
      hideBtn.addEventListener('click', () => {
        const num = this.promptForCardNumber('🧪 Hide collectible (01-25):');
        if (num === null) return;
        if (this.lockCardByNumber(num)) {
          alert(`Collectible ${num.toString().padStart(2, '0')} hidden.`);
        } else {
          alert(`Collectible ${num.toString().padStart(2, '0')} not found.`);
        }
      });
    }
  }

  private promptForCardNumber(message: string): number | null {
    const input = prompt(message, '01');
    if (!input) return null;
    const trimmed = input.trim();
    if (!/^\d{1,2}$/.test(trimmed)) {
      alert('Please enter a number between 1 and 25.');
      return null;
    }
    const number = parseInt(trimmed, 10);
    if (Number.isNaN(number) || number < 1 || number > 25) {
      alert('Please enter a number between 1 and 25.');
      return null;
    }
    return number;
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
