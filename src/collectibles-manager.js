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
    
    this.loadCollectiblesState();
    this.initEventListeners();
  }

  loadCollectiblesState() {
    try {
      const saved = localStorage.getItem('collectibles_state');
      if (saved) {
        const state = JSON.parse(saved);
        this.mergeState(state);
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
      if (typeof window.hideCollectiblesScreen === 'function') {
        window.hideCollectiblesScreen();
      } else {
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
  }

  showCollectibles() {
    console.log('🎁 showCollectibles method called');
    const screen = document.getElementById('collectibles-screen');
    console.log('🎁 collectibles-screen element:', screen);
    
    if (!screen) {
      console.error('❌ collectibles-screen element not found');
      return;
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
      container.appendChild(cardElement);
    });
  }

  createCardElement(card, category, number) {
    const cardDiv = document.createElement('div');
    cardDiv.className = `collectible-card ${category}`;
    cardDiv.dataset.cardId = card.id;
    cardDiv.dataset.category = category;

    if (card.unlocked) {
      cardDiv.classList.add('unlocked', 'flipped');
    }

    const numberStr = number.toString().padStart(2, '0');
    
    cardDiv.innerHTML = `
      <div class="card-front">
        <div class="card-number">${numberStr}</div>
      </div>
      <div class="card-back">
        <div class="card-image" style="background-image: url('assets/collectibles/${card.id}.png')"></div>
        <h3 class="card-name">${card.name}</h3>
        <span class="card-rarity">${card.rarity}</span>
      </div>
    `;

    return cardDiv;
  }

  updateCounters() {
    const commonUnlocked = this.collectiblesData.common.filter(c => c.unlocked).length;
    const legendaryUnlocked = this.collectiblesData.legendary.filter(c => c.unlocked).length;

    document.getElementById('common-counter').textContent = `${commonUnlocked}/20`;
    document.getElementById('legendary-counter').textContent = `${legendaryUnlocked}/5`;
  }

  showCardDetail(cardId, category) {
    const card = this.collectiblesData[category].find(c => c.id === cardId);
    if (!card) return;

    const modal = document.getElementById('collectibles-detail-modal');
    const numberStr = cardId.replace(category, '').padStart(2, '0');
    
    document.getElementById('detail-card-number').textContent = numberStr;
    document.getElementById('detail-card-image').style.backgroundImage = `url('assets/collectibles/${card.id}.png')`;
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
    let unlocked = false;

    Object.keys(this.collectiblesData).forEach(category => {
      this.collectiblesData[category].forEach(card => {
        if (card.event === eventName && !card.unlocked) {
          card.unlocked = true;
          unlocked = true;
          this.animateCardUnlock(card.id, category);
        }
      });
    });

    if (unlocked) {
      this.saveCollectiblesState();
      this.updateCounters();
      console.log(`🎉 Unlocked collectible for event: ${eventName}`);
    }
  }

  animateCardUnlock(cardId, category) {
    const card = document.querySelector(`[data-card-id="${cardId}"]`);
    if (card) {
      // Add unlock animation
      card.classList.add('unlocked');
      setTimeout(() => {
        card.classList.add('flipped');
      }, 100);
      
      // Add a subtle glow effect
      card.style.boxShadow = '0 0 20px rgba(255, 107, 53, 0.5)';
      setTimeout(() => {
        card.style.boxShadow = '';
      }, 2000);
    }
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
    this.saveCollectiblesState();
    this.renderCards();
    this.updateCounters();
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

// Export for manual use
export default CollectiblesManager;
