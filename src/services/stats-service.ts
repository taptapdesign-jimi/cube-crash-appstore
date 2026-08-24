// Centralized Stats Service
// Manages all game statistics in one place

import { logger } from '../core/logger.js';

interface GameStats {
  highScore: number;
  highestBoard: number;
  cubesCracked: number;
  longestCombo: number;
  helpersUsed: number;
  timePlayed: number; // in seconds
  collectiblesUnlocked: number;
}

const STORAGE_KEY = 'cube_crash_stats_v1';

class StatsService {
  private stats: GameStats = {
    highScore: 0,
    highestBoard: 0,
    cubesCracked: 0,
    longestCombo: 0,
    helpersUsed: 0,
    timePlayed: 0,
    collectiblesUnlocked: 0,
  };

  private listeners: Array<(stats: GameStats) => void> = [];
  private lastHighScoreUpdateScore = 0;
  private lastHighScoreUpdateAt = 0;

  constructor() {
    this.loadStats();
  }

  // Load stats from localStorage
  private loadStats(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      logger.debug('loadStats called', undefined, { stored });
      if (stored) {
        const parsed = JSON.parse(stored);
        logger.debug('Parsed stats from localStorage', undefined, parsed);
        this.stats = { ...this.stats, ...parsed };
      } else {
        const oldStats = this.loadOldStats();
        if (oldStats && Object.keys(oldStats).length > 0) {
          this.stats = { ...this.stats, ...oldStats };
          this.saveStats();
          this.cleanupOldStats();
          logger.debug('Migrated old stats to new format');
        }
      }
    } catch (error) {
      console.error('❌ Failed to load stats:', error);
      // Try to load old stats as fallback
      try {
        const oldStats = this.loadOldStats();
        if (oldStats && Object.keys(oldStats).length > 0) {
          this.stats = { ...this.stats, ...oldStats };
          logger.debug('Fallback: Loaded old stats');
        }
      } catch (fallbackError) {
        console.error('❌ Fallback load also failed:', fallbackError);
      }
    }
  }

  // Load from old localStorage keys (backward compatibility)
  private loadOldStats(): Partial<GameStats> {
    try {
      const highScoreStr = localStorage.getItem('cc_best_score_v1');
      const highestBoardStr = localStorage.getItem('cc_highest_board');
      const timePlayedStr = localStorage.getItem('cc_time_played');
      const cubesCrackedStr = localStorage.getItem('cc_cubes_cracked');
      const helpersUsedStr = localStorage.getItem('cc_helpers_used');
      const longestComboStr = localStorage.getItem('cc_longest_combo');
      const collectiblesStr = localStorage.getItem('cc_collectibles_unlocked');

      const migrated: Partial<GameStats> = {};
      
      if (highScoreStr) migrated.highScore = parseInt(highScoreStr, 10) || 0;
      if (highestBoardStr) migrated.highestBoard = parseInt(highestBoardStr, 10) || 0;
      if (timePlayedStr) migrated.timePlayed = parseInt(timePlayedStr, 10) || 0;
      if (cubesCrackedStr) migrated.cubesCracked = parseInt(cubesCrackedStr, 10) || 0;
      if (helpersUsedStr) migrated.helpersUsed = parseInt(helpersUsedStr, 10) || 0;
      if (longestComboStr) migrated.longestCombo = parseInt(longestComboStr, 10) || 0;
      if (collectiblesStr) migrated.collectiblesUnlocked = parseInt(collectiblesStr, 10) || 0;

      return migrated;
    } catch (error) {
      console.error('❌ Failed to load old stats:', error);
      return {};
    }
  }

  // Clean up old localStorage keys after migration
  private cleanupOldStats(): void {
    try {
      const oldKeys = [
        'cc_best_score_v1',
        'cc_highest_board',
        'cc_time_played',
        'cc_cubes_cracked',
        'cc_helpers_used',
        'cc_longest_combo',
        'cc_collectibles_unlocked'
      ];
      oldKeys.forEach(key => localStorage.removeItem(key));
      logger.debug('Cleaned up old localStorage keys');
    } catch (error) {
      console.error('❌ Failed to cleanup old stats:', error);
    }
  }

  // Save stats to localStorage (with iOS optimizations)
  private saveStats(): void {
    try {
      const statsString = JSON.stringify(this.stats);
      logger.debug('saveStats called', undefined, { highScore: this.stats.highScore });
      try {
        localStorage.setItem(STORAGE_KEY, statsString);
        const verify = localStorage.getItem(STORAGE_KEY);
        if (verify) {
          const verifyParsed = JSON.parse(verify);
          if (verifyParsed.highScore !== this.stats.highScore) {
            console.error('❌ High score mismatch after save', {
              expected: this.stats.highScore,
              actual: verifyParsed.highScore
            });
            localStorage.setItem(STORAGE_KEY, statsString);
          }
        }
      } catch (quotaError) {
        console.warn('⚠️ localStorage quota error:', quotaError);
        try {
          const minimalStats = {
            highScore: this.stats.highScore,
            highestBoard: this.stats.highestBoard,
            timePlayed: this.stats.timePlayed,
            cubesCracked: this.stats.cubesCracked,
            longestCombo: this.stats.longestCombo,
            helpersUsed: this.stats.helpersUsed,
            collectiblesUnlocked: this.stats.collectiblesUnlocked,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalStats));
          logger.debug('Saved minimal stats after quota error');
        } catch (minimalError) {
          console.error('❌ Failed to save even minimal stats:', minimalError);
        }
      }
    } catch (error) {
      console.error('❌ Failed to save stats:', error);
    }
    this.notifyListeners();
  }

  // Notify all listeners of stats changes
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.stats);
      } catch (error) {
        console.error('❌ Listener error:', error);
      }
    });
  }

  // Subscribe to stats updates
  public subscribe(listener: (stats: GameStats) => void): () => void {
    this.listeners.push(listener);
    // Immediately call listener with current stats
    listener(this.stats);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Update high score (only if higher)
  public updateHighScore(score: number): void {
    logger.debug('updateHighScore', undefined, { score, current: this.stats.highScore });
    if (score > this.stats.highScore) {
      logger.debug('New high score', undefined, { from: this.stats.highScore, to: score });
      this.lastHighScoreUpdateScore = score;
      this.lastHighScoreUpdateAt = Date.now();
      this.stats.highScore = score;
      this.saveStats();
      // CRITICAL: Force immediate flush to localStorage to prevent data loss on iOS
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.highScore !== this.stats.highScore) {
            console.warn('⚠️ High score mismatch! Forcing save...');
            this.saveStats();
          }
        }
      } catch (error) {
        console.error('❌ Failed to verify high score save:', error);
      }
    }
  }

  // Did we bump the high score very recently (during this session)?
  public wasHighScoreJustUpdated(expectedScore?: number, windowMs = 120000): boolean {
    if (!this.lastHighScoreUpdateAt) return false;
    if (typeof expectedScore === 'number' && expectedScore !== this.lastHighScoreUpdateScore) {
      return false;
    }
    return (Date.now() - this.lastHighScoreUpdateAt) <= windowMs;
  }

  // Update highest board reached
  public updateHighestBoard(board: number): void {
    logger.debug('updateHighestBoard', undefined, { board, current: this.stats.highestBoard });
    if (board > this.stats.highestBoard) {
      this.stats.highestBoard = board;
      this.saveStats();
    }
  }

  // Reset highest board (for dev button "hide cards")
  public resetHighestBoard(): void {
    this.stats.highestBoard = 0;
    this.saveStats();
  }

  // Increment cubes cracked
  public incrementCubesCracked(count: number = 1): void {
    this.stats.cubesCracked += count;
    this.saveStats();
  }

  // Update longest combo
  public updateLongestCombo(combo: number): void {
    if (combo > this.stats.longestCombo) {
      this.stats.longestCombo = combo;
      this.saveStats();
    }
  }

  // Increment helpers used
  public incrementHelpersUsed(count: number = 1): void {
    this.stats.helpersUsed += count;
    this.saveStats();
  }

  // Add time played (in seconds)
  public addTimePlayed(seconds: number): void {
    this.stats.timePlayed += seconds;
    this.saveStats();
  }

  // Update collectibles unlocked
  public updateCollectiblesUnlocked(count: number): void {
    if (count !== this.stats.collectiblesUnlocked) {
      this.stats.collectiblesUnlocked = count;
      this.saveStats();
    }
  }

  // Get current stats
  public getStats(): GameStats {
    return { ...this.stats };
  }

  // Reset all stats
  public resetStats(): void {
    this.stats = {
      highScore: 0,
      highestBoard: 0,
      cubesCracked: 0,
      longestCombo: 0,
      helpersUsed: 0,
      timePlayed: 0,
      collectiblesUnlocked: 0,
    };
    this.saveStats();
  }

  // 🔥 FIX: Add destroy method to clear all listeners
  public destroy(): void {
    this.listeners = [];
  }
}

// Export singleton instance
export const statsService = new StatsService();
