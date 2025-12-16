/**
 * Hearts System - Manages hearts/lives for Journey boards
 * 
 * Features:
 * - Max 3 hearts
 * - Lose 1 heart when failing to clean a board
 * - Auto-refill every 60 minutes
 * - Internal counter for refill timer
 */

import { logger } from '../core/logger.js';

const HEARTS_STORAGE_KEY = 'cc_journey_hearts';
const HEARTS_REFILL_TIME_KEY = 'cc_journey_hearts_refill_time';
const MAX_HEARTS = 3;
const REFILL_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes in milliseconds

interface HeartsState {
  currentHearts: number;
  lastRefillTime: number; // Timestamp of last refill
  nextRefillTime: number; // Timestamp of next refill
}

class HeartsSystem {
  private currentHearts: number = MAX_HEARTS;
  private lastRefillTime: number = Date.now();
  private nextRefillTime: number = Date.now() + REFILL_INTERVAL_MS;
  private refillTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize hearts system
   */
  init(): void {
    this.loadHeartsState();
    this.checkRefill();
    this.startRefillTimer();
    this.updateUI();
    logger.info('💚 Hearts system initialized with', this.currentHearts, 'hearts');
  }

  /**
   * Load hearts state from localStorage
   */
  private loadHeartsState(): void {
    try {
      const saved = localStorage.getItem(HEARTS_STORAGE_KEY);
      const refillTime = localStorage.getItem(HEARTS_REFILL_TIME_KEY);
      
      if (saved) {
        const state: HeartsState = JSON.parse(saved);
        this.currentHearts = Math.min(Math.max(0, state.currentHearts ?? MAX_HEARTS), MAX_HEARTS);
        this.lastRefillTime = state.lastRefillTime ?? Date.now();
        this.nextRefillTime = state.nextRefillTime ?? (this.lastRefillTime + REFILL_INTERVAL_MS);
      } else {
        // First time - start with max hearts
        this.currentHearts = MAX_HEARTS;
        this.lastRefillTime = Date.now();
        this.nextRefillTime = Date.now() + REFILL_INTERVAL_MS;
        this.saveHeartsState();
      }

      if (refillTime) {
        const savedRefillTime = parseInt(refillTime, 10);
        if (!isNaN(savedRefillTime)) {
          this.nextRefillTime = savedRefillTime;
        }
      }
    } catch (error) {
      logger.warn('⚠️ Failed to load hearts state, using defaults:', error);
      this.currentHearts = MAX_HEARTS;
      this.lastRefillTime = Date.now();
      this.nextRefillTime = Date.now() + REFILL_INTERVAL_MS;
    }
  }

  /**
   * Save hearts state to localStorage
   */
  private saveHeartsState(): void {
    try {
      const state: HeartsState = {
        currentHearts: this.currentHearts,
        lastRefillTime: this.lastRefillTime,
        nextRefillTime: this.nextRefillTime,
      };
      localStorage.setItem(HEARTS_STORAGE_KEY, JSON.stringify(state));
      localStorage.setItem(HEARTS_REFILL_TIME_KEY, String(this.nextRefillTime));
    } catch (error) {
      logger.warn('⚠️ Failed to save hearts state:', error);
    }
  }

  /**
   * Check if refill is needed and refill if time has passed
   */
  private checkRefill(): void {
    const now = Date.now();
    const timeSinceLastRefill = now - this.lastRefillTime;
    
    // Calculate how many refills should have happened
    const refillsNeeded = Math.floor(timeSinceLastRefill / REFILL_INTERVAL_MS);
    
    if (refillsNeeded > 0 && this.currentHearts < MAX_HEARTS) {
      // Refill hearts (but don't exceed max)
      const heartsToAdd = Math.min(refillsNeeded, MAX_HEARTS - this.currentHearts);
      this.currentHearts = Math.min(this.currentHearts + heartsToAdd, MAX_HEARTS);
      
      // Update refill time
      this.lastRefillTime = now - (timeSinceLastRefill % REFILL_INTERVAL_MS);
      this.nextRefillTime = this.lastRefillTime + REFILL_INTERVAL_MS;
      
      this.saveHeartsState();
      this.updateUI();
      logger.info('💚 Hearts refilled:', heartsToAdd, 'hearts, total:', this.currentHearts);
    } else if (this.currentHearts < MAX_HEARTS) {
      // Update next refill time even if not refilling yet
      this.nextRefillTime = this.lastRefillTime + REFILL_INTERVAL_MS;
    }
  }

  /**
   * Start timer for next refill
   */
  private startRefillTimer(): void {
    // Clear existing timer
    if (this.refillTimer) {
      clearTimeout(this.refillTimer);
    }

    const now = Date.now();
    const timeUntilRefill = this.nextRefillTime - now;

    if (timeUntilRefill > 0 && this.currentHearts < MAX_HEARTS) {
      this.refillTimer = setTimeout(() => {
        this.checkRefill();
        this.startRefillTimer(); // Restart timer for next refill
      }, timeUntilRefill);
      
      logger.debug('💚 Refill timer set for', Math.floor(timeUntilRefill / 1000), 'seconds');
    }
  }

  /**
   * Get current hearts count
   */
  getCurrentHearts(): number {
    return this.currentHearts;
  }

  /**
   * Get max hearts
   */
  getMaxHearts(): number {
    return MAX_HEARTS;
  }

  /**
   * Check if player has hearts
   */
  hasHearts(): boolean {
    return this.currentHearts > 0;
  }

  /**
   * Lose one heart (called when failing to clean a board)
   * @returns true if heart was lost, false if no hearts available
   */
  loseHeart(): boolean {
    if (this.currentHearts > 0) {
      this.currentHearts--;
      this.saveHeartsState();
      this.updateUI();
      
      // If hearts are now below max, start refill timer
      if (this.currentHearts < MAX_HEARTS) {
        this.lastRefillTime = Date.now();
        this.nextRefillTime = Date.now() + REFILL_INTERVAL_MS;
        this.saveHeartsState();
        this.startRefillTimer();
      }
      
      logger.info('💔 Lost 1 heart, remaining:', this.currentHearts);
      return true;
    }
    
    logger.warn('⚠️ No hearts available to lose');
    return false;
  }

  /**
   * Get time until next refill in milliseconds
   */
  getTimeUntilNextRefill(): number {
    const now = Date.now();
    const timeUntilRefill = this.nextRefillTime - now;
    return Math.max(0, timeUntilRefill);
  }

  /**
   * Get formatted time string for next refill (MM:SS)
   */
  getNextRefillTimeString(): string {
    const timeUntilRefill = this.getTimeUntilNextRefill();
    const minutes = Math.floor(timeUntilRefill / (60 * 1000));
    const seconds = Math.floor((timeUntilRefill % (60 * 1000)) / 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Update UI display
   */
  updateUI(): void {
    const countElement = document.getElementById('journey-lives-count');
    if (countElement) {
      countElement.textContent = String(this.currentHearts);
      logger.debug('💚 Updated hearts UI:', this.currentHearts);
    }
  }

  /**
   * Public method to refresh UI (called when journey screen is shown)
   */
  refreshUI(): void {
    this.checkRefill();
    this.updateUI();
  }

  /**
   * Cleanup - stop timers
   */
  cleanup(): void {
    if (this.refillTimer) {
      clearTimeout(this.refillTimer);
      this.refillTimer = null;
    }
  }
}

// Export singleton instance
export const heartsSystem = new HeartsSystem();

