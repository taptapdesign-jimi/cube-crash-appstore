// Centralized Stats Service
// Manages all game statistics in one place

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

  constructor() {
    this.loadStats();
  }

  // Load stats from localStorage
  private loadStats(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      console.log('🔍 CRITICAL: loadStats called, stored data:', stored);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('📊 Parsed stats from localStorage:', parsed);
        this.stats = { ...this.stats, ...parsed };
        console.log('📊 Stats loaded from new storage, highScore:', this.stats.highScore);
      } else {
        // MIGRATION: Load old separate keys and migrate to new format
        console.log('🔄 Migrating old stats to new format...');
        const oldStats = this.loadOldStats();
        if (oldStats && Object.keys(oldStats).length > 0) {
          this.stats = { ...this.stats, ...oldStats };
          console.log('📊 Migrated old stats to memory:', this.stats);
          this.saveStats(); // Save in new format
          this.cleanupOldStats(); // Remove old keys ONLY after successful save
          console.log('✅ Migration complete');
        } else {
          console.log('📊 No old stats found, starting fresh');
        }
      }
    } catch (error) {
      console.error('❌ Failed to load stats:', error);
      // Try to load old stats as fallback
      try {
        const oldStats = this.loadOldStats();
        if (oldStats && Object.keys(oldStats).length > 0) {
          this.stats = { ...this.stats, ...oldStats };
          console.log('📊 Fallback: Loaded old stats:', this.stats);
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
      console.log('🧹 Cleaned up old localStorage keys');
    } catch (error) {
      console.error('❌ Failed to cleanup old stats:', error);
    }
  }

  // Save stats to localStorage (with iOS optimizations)
  private saveStats(): void {
    try {
      const statsString = JSON.stringify(this.stats);
      console.log('🔍 CRITICAL: saveStats called with highScore:', this.stats.highScore);
      
      // Try to save first and catch quota errors
      try {
        localStorage.setItem(STORAGE_KEY, statsString);
        console.log('💾 Stats saved:', this.stats);
        
        // CRITICAL VERIFICATION: Read back immediately to verify it was saved
        const verify = localStorage.getItem(STORAGE_KEY);
        if (verify) {
          const verifyParsed = JSON.parse(verify);
          console.log('✅ VERIFICATION: High score in localStorage:', verifyParsed.highScore);
          if (verifyParsed.highScore !== this.stats.highScore) {
            console.error('❌ CRITICAL ERROR: High score mismatch!', {
              expected: this.stats.highScore,
              actual: verifyParsed.highScore
            });
            // Force save again
            localStorage.setItem(STORAGE_KEY, statsString);
            console.log('🔄 Forced re-save due to mismatch');
          }
        }
      } catch (quotaError) {
        // iOS sometimes throws quota errors
        console.warn('⚠️ localStorage quota error:', quotaError);
        
        try {
          // Try to save a minimal version with only critical stats
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
          console.log('💾 Saved minimal stats after quota error');
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
    console.log(`🔍 updateHighScore called with score: ${score}, current high score: ${this.stats.highScore}`);
    if (score > this.stats.highScore) {
      console.log(`🏆 New high score! ${this.stats.highScore} -> ${score}`);
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
    } else {
      console.log(`ℹ️ Score ${score} is not higher than current high score ${this.stats.highScore}`);
    }
  }

  // Update highest board reached
  public updateHighestBoard(board: number): void {
    console.log(`🔍 updateHighestBoard called with board: ${board}, current highest board: ${this.stats.highestBoard}`);
    if (board > this.stats.highestBoard) {
      console.log(`📊 New highest board! ${this.stats.highestBoard} -> ${board}`);
      this.stats.highestBoard = board;
      this.saveStats();
    } else {
      console.log(`ℹ️ Board ${board} is not higher than current highest board ${this.stats.highestBoard}`);
    }
  }

  // Increment cubes cracked
  public incrementCubesCracked(count: number = 1): void {
    this.stats.cubesCracked += count;
    console.log(`🎲 Cubes cracked: ${this.stats.cubesCracked}`);
    this.saveStats();
  }

  // Update longest combo
  public updateLongestCombo(combo: number): void {
    if (combo > this.stats.longestCombo) {
      console.log(`⚡ New longest combo! ${this.stats.longestCombo} -> ${combo}`);
      this.stats.longestCombo = combo;
      this.saveStats();
    }
  }

  // Increment helpers used
  public incrementHelpersUsed(count: number = 1): void {
    this.stats.helpersUsed += count;
    console.log(`⭐ Helpers used: ${this.stats.helpersUsed}`);
    this.saveStats();
  }

  // Add time played (in seconds)
  public addTimePlayed(seconds: number): void {
    this.stats.timePlayed += seconds;
    console.log(`⏱️ Total time played: ${this.formatTime(this.stats.timePlayed)}`);
    this.saveStats();
  }

  // Update collectibles unlocked
  public updateCollectiblesUnlocked(count: number): void {
    if (count > this.stats.collectiblesUnlocked) {
      console.log(`🎁 Collectibles unlocked: ${count}`);
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
    console.log('🔄 All stats reset to 0');
  }

  // Format time as HH:MM:SS
  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

// Export singleton instance
export const statsService = new StatsService();
