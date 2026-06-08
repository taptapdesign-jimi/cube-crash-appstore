/**
 * Hearts System - Manages hearts/lives for Journey boards
 * 
 * Features:
 * - Max 3 hearts
 * - Lose 1 heart when failing to clean a board
 * - Auto-refill every 30 minutes per heart
 * - Internal counter for refill timer
 */

import { logger } from '../core/logger.js';

const HEARTS_STORAGE_KEY = 'cc_journey_hearts';
const HEARTS_REFILL_TIME_KEY = 'cc_journey_hearts_refill_time';
const MAX_HEARTS = 3;
// Hearts are preserved in code but disabled for the current release.
export const HEARTS_FEATURE_ENABLED = false;
export const isHeartsFeatureEnabled = (): boolean => HEARTS_FEATURE_ENABLED;
// NOTE: Temporary prod tweak per request. Revert to 30 * 60 * 1000 when done testing.
const REFILL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes per heart (all modes)

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
    if (!HEARTS_FEATURE_ENABLED) {
      this.currentHearts = MAX_HEARTS;
      this.cleanup();
      this.hideUI();
      logger.info('💚 Hearts system disabled - skipping init');
      return;
    }

    this.loadHeartsState();
    this.checkRefill();
    this.startRefillTimer();
    this.updateUI();
    logger.info(`💚 Hearts system initialized`, undefined, { hearts: this.currentHearts });
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
      logger.warn('⚠️ Failed to load hearts state, using defaults', undefined, {
        error: error instanceof Error ? error.message : String(error)
      });
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
      logger.warn('⚠️ Failed to save hearts state', undefined, {
        error: error instanceof Error ? error.message : String(error)
      });
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
      logger.info('💚 Hearts refilled', undefined, { added: heartsToAdd, total: this.currentHearts });
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
      
      logger.debug('💚 Refill timer set', undefined, { seconds: Math.floor(timeUntilRefill / 1000) });
    }
  }

  /**
   * Get current hearts count
   */
  getCurrentHearts(): number {
    if (!HEARTS_FEATURE_ENABLED) return MAX_HEARTS;
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
    if (!HEARTS_FEATURE_ENABLED) return true;
    return this.currentHearts > 0;
  }

  /**
   * Lose one heart (called when failing to clean a board)
   * @returns true if heart was lost, false if no hearts available
   */
  loseHeart(): boolean {
    if (!HEARTS_FEATURE_ENABLED) {
      logger.debug('💚 Hearts disabled - loseHeart no-op');
      return true;
    }

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
      
      logger.info('💔 Lost 1 heart', undefined, { remaining: this.currentHearts });
      return true;
    }
    
    logger.warn('⚠️ No hearts available to lose');
    return false;
  }

  /**
   * Get time until next refill in milliseconds
   */
  getTimeUntilNextRefill(): number {
    if (!HEARTS_FEATURE_ENABLED) return 0;
    const now = Date.now();
    const timeUntilRefill = this.nextRefillTime - now;
    return Math.max(0, timeUntilRefill);
  }

  /**
   * Get formatted time string for next refill (MM:SS)
   */
  getNextRefillTimeString(): string {
    // IMPORTANT: Use CEIL so we never show 00:00 while there is still <1s remaining.
    // This prevents the bottom sheet from appearing "stuck" at 00:00 before the refill is actually due.
    const timeUntilRefill = this.getTimeUntilNextRefill();
    const totalSeconds = Math.max(0, Math.ceil(timeUntilRefill / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Update UI display
   */
  updateUI(): void {
    if (!HEARTS_FEATURE_ENABLED) {
      this.hideUI();
      return;
    }

    const countElement = document.getElementById('journey-lives-count');
    if (countElement) {
      countElement.textContent = String(this.currentHearts);
      logger.debug('💚 Updated hearts UI', undefined, { hearts: this.currentHearts });
    }
  }

  /**
   * Public method to refresh UI (called when journey screen is shown)
   */
  refreshUI(): void {
    if (!HEARTS_FEATURE_ENABLED) {
      this.cleanup();
      this.hideUI();
      return;
    }

    this.checkRefill();
    this.updateUI();
  }

  private hideUI(): void {
    const container = document.getElementById('journey-lives-container');
    if (container) {
      container.style.display = 'none';
      container.setAttribute('aria-hidden', 'true');
      container.setAttribute('hidden', '');
    }
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
