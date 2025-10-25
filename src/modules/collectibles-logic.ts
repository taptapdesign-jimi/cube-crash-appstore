// collectibles-logic.ts
// Business logic for collectibles system

import { logger } from '../core/logger.js';

import { 
  CollectibleCard, 
  CollectiblesData, 
  UnlockOptions, 
  UnlockMeta,
  COLLECTIBLES_DATA,
  getCollectibleById,
  getUnlockedCollectibles,
  getLockedCollectibles
} from './collectibles-data.js';

logger.info('🎁 Collectibles Logic module loaded');

// Type definitions
interface CollectiblesManager {
  data: CollectiblesData;
  unlockedCards: Set<string>;
  lockedCards: Set<string>;
  eventListeners: Map<string, Function[]>;
  
  // Methods
  init(): void;
  loadData(): void;
  saveData(): void;
  unlockCard(cardId: string, options?: UnlockOptions): boolean;
  lockCard(cardId: string): boolean;
  isCardUnlocked(cardId: string): boolean;
  getCardByNumber(number: number): CollectibleCard | null;
  lockCardByNumber(number: number): boolean;
  unlockCardByNumber(number: number, options?: UnlockOptions): boolean;
  triggerEvent(eventName: string, meta?: UnlockMeta): void;
  addEventListener(event: string, callback: Function): void;
  removeEventListener(event: string, callback: Function): void;
  emit(event: string, data?: any): void;
}

// Collectibles Manager Class
export class CollectiblesManager {
  data: CollectiblesData;
  unlockedCards: Set<string>;
  lockedCards: Set<string>;
  eventListeners: Map<string, Function[]>;

  constructor() {
    this.data = { ...COLLECTIBLES_DATA };
    this.unlockedCards = new Set();
    this.lockedCards = new Set();
    this.eventListeners = new Map();
    
    logger.info('🎁 CollectiblesManager initialized');
  }

  /**
   * Initialize the collectibles system
   */
  init(): void {
    logger.info('🎁 Initializing collectibles system');
    this.loadData();
    this.setupEventListeners();
  }

  /**
   * Load collectibles data from localStorage
   */
  loadData(): void {
    try {
      const savedData = localStorage.getItem('cubeCrashCollectibles');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        this.data = { ...this.data, ...parsedData };
        
        // Update unlocked/locked sets
        this.unlockedCards.clear();
        this.lockedCards.clear();
        
        const allCollectibles = [...this.data.common, ...this.data.legendary];
        allCollectibles.forEach(card => {
          if (card.unlocked) {
            this.unlockedCards.add(card.id);
          } else {
            this.lockedCards.add(card.id);
          }
        });
        
        logger.info('✅ Collectibles data loaded from localStorage');
      } else {
        logger.info('ℹ️ No saved collectibles data found, using defaults');
      }
    } catch (error) {
      logger.warn('⚠️ Failed to load collectibles data:', error);
    }
  }

  /**
   * Save collectibles data to localStorage
   */
  saveData(): void {
    try {
      localStorage.setItem('cubeCrashCollectibles', JSON.stringify(this.data));
      logger.info('✅ Collectibles data saved to localStorage');
    } catch (error) {
      logger.warn('⚠️ Failed to save collectibles data:', error);
    }
  }

  /**
   * Unlock a collectible card
   */
  unlockCard(cardId: string, options: UnlockOptions = {}): boolean {
    const card = getCollectibleById(cardId);
    if (!card) {
      logger.warn(`⚠️ Card not found: ${cardId}`);
      return false;
    }

    if (card.unlocked) {
      logger.info(`ℹ️ Card already unlocked: ${cardId}`);
      return true;
    }

    // Unlock the card
    card.unlocked = true;
    this.unlockedCards.add(cardId);
    this.lockedCards.delete(cardId);

    // Save data
    this.saveData();

    // Emit unlock event
    this.emit('cardUnlocked', { card, options });

    if (!options.silent) {
      logger.info(`🎉 Card unlocked: ${card.name} (${card.rarity})`);
    }

    return true;
  }

  /**
   * Lock a collectible card
   */
  lockCard(cardId: string): boolean {
    const card = getCollectibleById(cardId);
    if (!card) {
      logger.warn(`⚠️ Card not found: ${cardId}`);
      return false;
    }

    if (!card.unlocked) {
      logger.info(`ℹ️ Card already locked: ${cardId}`);
      return true;
    }

    // Lock the card
    card.unlocked = false;
    this.unlockedCards.delete(cardId);
    this.lockedCards.add(cardId);

    // Save data
    this.saveData();

    // Emit lock event
    this.emit('cardLocked', { card });

    logger.info(`🔒 Card locked: ${card.name} (${card.rarity})`);

    return true;
  }

  /**
   * Check if a card is unlocked
   */
  isCardUnlocked(cardId: string): boolean {
    return this.unlockedCards.has(cardId);
  }

  /**
   * Get card by number (1-based index)
   */
  getCardByNumber(number: number): CollectibleCard | null {
    const allCollectibles = [...this.data.common, ...this.data.legendary];
    const index = number - 1;
    
    if (index >= 0 && index < allCollectibles.length) {
      return allCollectibles[index];
    }
    
    return null;
  }

  /**
   * Lock card by number
   */
  lockCardByNumber(number: number): boolean {
    const card = this.getCardByNumber(number);
    if (card) {
      return this.lockCard(card.id);
    }
    return false;
  }

  /**
   * Unlock card by number
   */
  unlockCardByNumber(number: number, options: UnlockOptions = {}): boolean {
    const card = this.getCardByNumber(number);
    if (card) {
      return this.unlockCard(card.id, options);
    }
    return false;
  }

  /**
   * Trigger an event that might unlock collectibles
   */
  triggerEvent(eventName: string, meta: UnlockMeta = { source: 'event' }): void {
    logger.info(`🎁 Triggering event: ${eventName}`);
    
    // Find cards that can be unlocked by this event
    const allCollectibles = [...this.data.common, ...this.data.legendary];
    const eventCards = allCollectibles.filter(card => 
      card.event === eventName && !card.unlocked
    );

    // Unlock cards for this event
    eventCards.forEach(card => {
      this.unlockCard(card.id, { silent: true });
    });

    // Emit event
    this.emit('eventTriggered', { eventName, meta, unlockedCount: eventCards.length });
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.warn(`⚠️ Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Setup default event listeners
   */
  private setupEventListeners(): void {
    // Listen for game events
    this.addEventListener('cardUnlocked', (data) => {
      logger.info(`🎉 New collectible unlocked: ${data.card.name}`);
    });

    this.addEventListener('eventTriggered', (data) => {
      if (data.unlockedCount > 0) {
        logger.info(`🎁 Event ${data.eventName} unlocked ${data.unlockedCount} collectibles`);
      }
    });
  }
}

// Create global instance
export const collectiblesManager = new CollectiblesManager();

// Export for manual use
export default CollectiblesManager;
