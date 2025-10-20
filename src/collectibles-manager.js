// Collectibles Manager - Handles all collectibles functionality
console.log('🎁 Collectibles Manager script loaded');

class CollectiblesManager {
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
    this.defaultUnlockedIds = new Set();
    this.preloadPromise = null;

    this.loadCollectiblesState();
    this.ensureDefaultUnlocked();
    this.lockInitialCommons();
    this.saveCollectiblesState();
    this.preloadImages();
    this.initEventListeners();
    this.handleDailyVisit();
  }

  loadCollectiblesState() {
    try {
      const saved = localStorage.getItem('collectibles_state');
      if (saved) {
        const state = JSON.parse(saved);
        this.mergeState(state);
        this.ensureDefaultUnlocked();
      }
    } catch (error) {
      console.warn('Failed to load collectibles state:', error);
    }
  }

  saveCollectiblesState() {
    try {
      localStorage.setItem('collectibles_state', JSON.stringify(this.collectiblesData));
    } catch (error) {
      console.warn('Failed to save collectibles state:', error);
    }
  }

  mergeState(savedState) {
    Object.keys(this.collectiblesData).forEach(category => {
      this.collectiblesData[category].forEach(card => {
        const saved = savedState[category]?.find(s => s.id === card.id);
        if (saved) {
          card.unlocked = saved.unlocked;
        }
      });
    });
  }

  initEventListeners() {
    // Back button
    document.getElementById('collectibles-back').addEventListener('click', () => {
      console.log('🎁 Collectibles back button clicked');
      console.log('🎁 window.hideCollectiblesScreen type:', typeof window.hideCollectiblesScreen);
      if (typeof window.hideCollectiblesScreen === 'function') {
        console.log('🎁 Calling window.hideCollectiblesScreen()');
        window.hideCollectiblesScreen();
      } else {
        console.warn('⚠️ window.hideCollectiblesScreen not available, using fallback');
        this.hideCollectibles();
      }
    });

    // Card clicks
    document.addEventListener('click', (e) => {
      if (e.target.closest('.collectible-card')) {
        const card = e.target.closest('.collectible-card');
        const cardId = card.dataset.cardId;
        const category = card.dataset.category;
        
        if (card.classList.contains('unlocked')) {
          this.showCardDetail(cardId, category);
        } else {
          this.showLockedMessage();
        }
      }
    });

    // Modal close
    document.getElementById('detail-close-btn').addEventListener('click', () => {
      this.hideCardDetail();
    });

    // Close modal on background click
    document.getElementById('collectibles-detail-modal').addEventListener('click', (e) => {
      if (e.target.id === 'collectibles-detail-modal') {
        this.hideCardDetail();
      }
    });

    this.initDevButtons();
  }

  async showCollectibles() {
    console.log('🎁 showCollectibles method called');
    const screen = document.getElementById('collectibles-screen');
    if (!screen) {
      console.error('❌ collectibles-screen element not found');
      return;
    }

    try {
      await this.preloadImages();
    } catch (error) {
      console.warn('⚠️ Collectibles assets preload encountered an issue:', error);
    }
    
    screen.classList.remove('hidden');
    console.log('🎁 Removed hidden class');
    
    // Trigger animation
    requestAnimationFrame(() => {
      screen.classList.add('show');
      console.log('🎁 Added show class');
    });
    
    this.renderCards();
    this.updateCounters();
    const scrollable = document.querySelector('#collectibles-screen .collectibles-scrollable');
    if (scrollable) {
      scrollable.scrollTop = 0;
    }
    console.log('🎁 Cards rendered and counters updated');
  }

  hideCollectibles() {
    const screen = document.getElementById('collectibles-screen');
    screen.classList.remove('show');
    
    setTimeout(() => {
      screen.classList.add('hidden');
    }, 400);
  }

  renderCards() {
    this.renderCategory('common');
    this.renderCategory('legendary');
  }

  renderCategory(category) {
    const container = document.getElementById(`${category}-cards`);
    container.innerHTML = '';

    this.collectiblesData[category].forEach((card, index) => {
      const cardElement = this.createCardElement(card, category, index + 1);
      cardElement.classList.add('collectibles-card-slot');
      container.appendChild(cardElement);
    });
  }

  createCardElement(card, category, number) {
    const wrapper = document.createElement('div');
    wrapper.className = `collectible-card-wrapper ${category}`;

    const numberStr = number.toString().padStart(2, '0');
    const label = document.createElement('div');
    label.className = 'collectible-card-label';
    label.textContent = numberStr;

    const cardDiv = document.createElement('div');
    cardDiv.className = `collectible-card ${category}`;
    cardDiv.dataset.cardId = card.id;
    cardDiv.dataset.category = category;
    cardDiv.dataset.cardNumber = number;
    cardDiv.setAttribute('role', 'button');
    cardDiv.setAttribute('tabindex', '0');

    const imagePath = this.getCardImagePath(category, number);
    const placeholderPath = this.getPlaceholderPath(category);

    if (card.unlocked) {
      cardDiv.classList.add('unlocked');
      cardDiv.style.backgroundImage = `url('${imagePath}')`;
      cardDiv.setAttribute('aria-label', `Collectible ${numberStr}: ${card.name} unlocked`);
    } else {
      cardDiv.classList.add('locked');
      cardDiv.style.backgroundImage = `url('${placeholderPath}')`;
      cardDiv.setAttribute('aria-label', `Collectible ${numberStr} locked`);
    }

    cardDiv.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        cardDiv.click();
      }
    });

    wrapper.appendChild(label);
    wrapper.appendChild(cardDiv);
    return wrapper;
  }

  getPlaceholderPath(category) {
    return category === 'legendary'
      ? './assets/colelctibles/legendary back.png'
      : './assets/colelctibles/common back.png';
  }

  getCardImagePath(category, number) {
    if (category === 'legendary') {
      const assetNumber = (number + 20).toString().padStart(2, '0');
      return `./assets/colelctibles/legendary/${assetNumber}.png`;
    }
    const assetNumber = number.toString().padStart(2, '0');
    return `./assets/colelctibles/common/${assetNumber}.png`;
  }

  updateCounters() {
    const commonUnlocked = this.collectiblesData.common.filter(c => c.unlocked).length;
    const legendaryUnlocked = this.collectiblesData.legendary.filter(c => c.unlocked).length;

    document.getElementById('common-counter').textContent = `${commonUnlocked}/20`;
    document.getElementById('legendary-counter').textContent = `${legendaryUnlocked}/5`;
  }

  preloadImages() {
    if (this.preloadPromise) return this.preloadPromise;

    const sources = new Set([
      this.getPlaceholderPath('common'),
      this.getPlaceholderPath('legendary')
    ]);

    this.collectiblesData.common.forEach((card, index) => {
      sources.add(this.getCardImagePath('common', index + 1));
    });
    this.collectiblesData.legendary.forEach((card, index) => {
      sources.add(this.getCardImagePath('legendary', index + 1));
    });

    const loadImage = (src) => new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({ src, status: 'loaded' });
      img.onerror = () => resolve({ src, status: 'error' });
      img.src = src;
    });

    this.preloadPromise = Promise.all([...sources].map(loadImage))
      .then(results => {
        const loaded = results.filter(r => r.status === 'loaded').length;
        console.log(`🎁 Preloaded collectibles assets: ${loaded}/${results.length}`);
        return results;
      })
      .catch(error => {
        console.warn('⚠️ Collectibles preload failed:', error);
        throw error;
      });

    return this.preloadPromise;
  }

  showCardDetail(cardId, category) {
    const cards = this.collectiblesData[category];
    const index = cards.findIndex(c => c.id === cardId);
    if (index === -1) return;

    const card = cards[index];

    const modal = document.getElementById('collectibles-detail-modal');
    const numberStr = (index + 1).toString().padStart(2, '0');
    const imagePath = this.getCardImagePath(category, index + 1);

    document.getElementById('detail-card-number').textContent = numberStr;
    document.getElementById('detail-card-image').style.backgroundImage = `url('${imagePath}')`;
    document.getElementById('detail-card-description').textContent = card.description;

    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });
  }

  hideCardDetail() {
    const modal = document.getElementById('collectibles-detail-modal');
    modal.classList.remove('show');
    
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 300);
  }

  showLockedMessage() {
    // Simple alert for now - can be replaced with a toast notification
    console.log('Card is locked! Complete the challenge to unlock.');
    // You could show a toast notification here instead
  }

  // Event handler for unlocking cards
  unlockCard(eventName) {
    const unlockedCards = [];

    Object.keys(this.collectiblesData).forEach(category => {
      this.collectiblesData[category].forEach((card, index) => {
        if (card.event === eventName && !card.unlocked) {
          card.unlocked = true;
          unlockedCards.push({ category, card, number: index + 1 });
          this.animateCardUnlock(card.id, category);
        }
      });
    });

    if (unlockedCards.length) {
      this.saveCollectiblesState();
      this.updateCounters();
      console.log(`🎉 Unlocked collectible for event: ${eventName}`);
      unlockedCards.forEach(({ category, card, number }) => {
        this.notifyCardUnlocked(category, number, card, { source: 'event', eventName });
      });
    }
  }

  animateCardUnlock(cardId, category) {
    const cardEl = document.querySelector(`.collectible-card[data-card-id="${cardId}"]`);
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
    cardEl.setAttribute('aria-label', `Collectible ${numberStr}: ${cardData?.name || 'Unlocked'}`);

    setTimeout(() => {
      cardEl.classList.remove('just-unlocked');
    }, 650);
  }

  // Get collectibles data for external use
  getCollectiblesData() {
    return this.collectiblesData;
  }

  // Check if a specific card is unlocked
  isCardUnlocked(cardId, category) {
    const card = this.collectiblesData[category]?.find(c => c.id === cardId);
    return card ? card.unlocked : false;
  }

  // Reset all collectibles (for testing)
  resetAllCollectibles() {
    Object.keys(this.collectiblesData).forEach(category => {
      this.collectiblesData[category].forEach(card => {
        card.unlocked = false;
      });
    });
    this.ensureDefaultUnlocked();
    this.saveCollectiblesState();
    this.renderCards();
    this.updateCounters();
  }

  ensureDefaultUnlocked() {
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

  lockInitialCommons() {
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
        console.warn('Failed to lock initial common collectibles:', error);
      }
    }

    try {
      localStorage.setItem('collectibles_initial_lock_done', '1');
    } catch {}
  }

  handleDailyVisit() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const raw = localStorage.getItem('collectibles_daily_visit');
      let data = { date: today, count: 0 };
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

      if (data.count >= 2) {
        if (this.unlockCardByNumber(1, { render: true, silent: true })) {
          console.log('🎁 Daily visit bonus unlocked collectible 01');
        }
      }
    } catch (error) {
      console.warn('Failed to process daily visit unlock:', error);
    }
  }

  unlockCardByNumber(number, { render = true, silent = false } = {}) {
    let card = null;
    let categoryKey = null;
    if (number >= 1 && number <= 20) {
      categoryKey = 'common';
      card = this.collectiblesData.common[number - 1];
    } else if (number >= 21 && number <= 25) {
      categoryKey = 'legendary';
      card = this.collectiblesData.legendary[number - 21];
    }

    if (!card) return false;
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
        console.log(`🎁 Collectible ${number.toString().padStart(2, '0')} unlocked via dev tool.`);
      }
    } else if (render) {
      this.renderCards();
    }
    return true;
  }

  notifyCardUnlocked(category, number, card, meta = {}) {
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
    } catch (error) {
      console.warn('Failed to dispatch collectible unlocked event:', error);
    }
  }

  lockCardByNumber(number, { render = true } = {}) {
    let card = null;
    if (number >= 1 && number <= 20) {
      card = this.collectiblesData.common[number - 1];
    } else if (number >= 21 && number <= 25) {
      card = this.collectiblesData.legendary[number - 21];
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

  initDevButtons() {
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

  promptForCardNumber(message) {
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

// Initialize Collectibles Manager
let collectiblesManager;

function initializeCollectiblesManager() {
  console.log('🎁 Initializing Collectibles Manager...');
  try {
    collectiblesManager = new CollectiblesManager();
    window.collectiblesManager = collectiblesManager;
    console.log('✅ Collectibles Manager initialized');
    console.log('🎁 collectiblesManager object:', collectiblesManager);
  } catch (error) {
    console.error('❌ Error initializing Collectibles Manager:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCollectiblesManager);
} else {
  initializeCollectiblesManager();
}

// Export functions for use in other modules
console.log('🎁 Setting up window.showCollectibles function');
window.showCollectibles = () => {
  console.log('🎁 showCollectibles called');
  console.log('🎁 collectiblesManager exists:', !!collectiblesManager);
  console.log('🎁 collectiblesManager value:', collectiblesManager);
  if (collectiblesManager) {
    console.log('🎁 Calling collectiblesManager.showCollectibles()');
    collectiblesManager.showCollectibles();
  } else {
    console.error('❌ collectiblesManager not initialized');
  }
};
console.log('🎁 window.showCollectibles function set:', typeof window.showCollectibles);

window.hideCollectibles = () => {
  if (collectiblesManager) {
    collectiblesManager.hideCollectibles();
  }
};

window.unlockCollectible = (eventName) => {
  if (collectiblesManager) {
    collectiblesManager.unlockCard(eventName);
  }
};

window.unlockCollectibleByNumber = (number) => {
  if (collectiblesManager) {
    collectiblesManager.unlockCardByNumber(Number(number) || 0);
  }
};

window.hideCollectibleByNumber = (number) => {
  if (collectiblesManager) {
    collectiblesManager.lockCardByNumber(Number(number) || 0);
  }
};

// Export for manual use
export default CollectiblesManager;
