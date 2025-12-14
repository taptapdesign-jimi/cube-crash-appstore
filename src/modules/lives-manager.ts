/**
 * Lives Manager - Manages lives/hearts system for Journey
 * 
 * Features:
 * - Max 3 hearts per day (resets daily)
 * - Hearts can be purchased to continue journey
 * - Displays heart icon + count in journey header
 * 
 * TODO: Connect to purchase system and daily reset logic
 */

import { logger } from '../core/logger.js';

const LIVES_STORAGE_KEY = 'cc_journey_lives';
const LIVES_LAST_RESET_KEY = 'cc_journey_lives_last_reset';
const MAX_DAILY_LIVES = 3;

interface LivesState {
  currentLives: number;
  lastResetDate: string; // ISO date string
  purchasedLives: number; // Lives purchased (don't reset daily)
}

class LivesManager {
  private currentLives: number = MAX_DAILY_LIVES;
  private purchasedLives: number = 0;
  private lastResetDate: string = '';

  /**
   * Initialize lives manager
   */
  init(): void {
    this.loadLivesState();
    this.checkDailyReset();
    this.updateUI();
    logger.info('💚 Lives manager initialized');
  }

  /**
   * Load lives state from localStorage
   */
  private loadLivesState(): void {
    try {
      const saved = localStorage.getItem(LIVES_STORAGE_KEY);
      const lastReset = localStorage.getItem(LIVES_LAST_RESET_KEY);
      
      if (saved) {
        const state: LivesState = JSON.parse(saved);
        this.currentLives = state.currentLives ?? MAX_DAILY_LIVES;
        this.purchasedLives = state.purchasedLives ?? 0;
        this.lastResetDate = state.lastResetDate || '';
      } else {
        this.currentLives = MAX_DAILY_LIVES;
        this.purchasedLives = 0;
        this.lastResetDate = new Date().toISOString().split('T')[0]; // Today's date
      }

      if (lastReset) {
        this.lastResetDate = lastReset;
      }
    } catch (error) {
      logger.warn('⚠️ Failed to load lives state, using defaults:', error);
      this.currentLives = MAX_DAILY_LIVES;
      this.purchasedLives = 0;
      this.lastResetDate = new Date().toISOString().split('T')[0];
    }
  }

  /**
   * Check if daily reset is needed
   */
  private checkDailyReset(): void {
    const today = new Date().toISOString().split('T')[0];
    
    if (this.lastResetDate !== today) {
      // Reset daily lives (but keep purchased lives)
      this.currentLives = MAX_DAILY_LIVES;
      this.lastResetDate = today;
      this.saveLivesState();
      logger.info('💚 Daily lives reset - restored to', MAX_DAILY_LIVES);
    }
  }

  /**
   * Save lives state to localStorage
   */
  private saveLivesState(): void {
    try {
      const state: LivesState = {
        currentLives: this.currentLives,
        purchasedLives: this.purchasedLives,
        lastResetDate: this.lastResetDate,
      };
      localStorage.setItem(LIVES_STORAGE_KEY, JSON.stringify(state));
      localStorage.setItem(LIVES_LAST_RESET_KEY, this.lastResetDate);
    } catch (error) {
      logger.warn('⚠️ Failed to save lives state:', error);
    }
  }

  /**
   * Get total lives (daily + purchased)
   */
  getTotalLives(): number {
    return this.currentLives + this.purchasedLives;
  }

  /**
   * Get daily lives (resets daily)
   */
  getDailyLives(): number {
    return this.currentLives;
  }

  /**
   * Get purchased lives (persistent)
   */
  getPurchasedLives(): number {
    return this.purchasedLives;
  }

  /**
   * Check if player has lives
   */
  hasLives(): boolean {
    return this.getTotalLives() > 0;
  }

  /**
   * Consume one life
   * @returns true if life was consumed, false if no lives available
   */
  consumeLife(): boolean {
    if (this.purchasedLives > 0) {
      this.purchasedLives--;
      this.saveLivesState();
      this.updateUI();
      logger.info('💚 Consumed purchased life, remaining:', this.getTotalLives());
      return true;
    } else if (this.currentLives > 0) {
      this.currentLives--;
      this.saveLivesState();
      this.updateUI();
      logger.info('💚 Consumed daily life, remaining:', this.getTotalLives());
      return true;
    }
    
    logger.warn('⚠️ No lives available to consume');
    return false;
  }

  /**
   * Add purchased lives (from IAP or rewards)
   * @param count Number of lives to add
   */
  addPurchasedLives(count: number): void {
    if (count > 0) {
      this.purchasedLives += count;
      this.saveLivesState();
      this.updateUI();
      logger.info('💚 Added', count, 'purchased lives, total:', this.getTotalLives());
    }
  }

  /**
   * Update UI display
   */
  updateUI(): void {
    const countElement = document.getElementById('journey-lives-count');
    if (countElement) {
      const totalLives = this.getTotalLives();
      countElement.textContent = String(totalLives);
      logger.debug('💚 Updated lives UI:', totalLives);
    }
  }

  /**
   * Public method to refresh UI (called when journey screen is shown)
   */
  refreshUI(): void {
    this.checkDailyReset();
    this.updateUI();
  }
}

// Export singleton instance
export const livesManager = new LivesManager();
