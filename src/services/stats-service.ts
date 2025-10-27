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
      if (stored) {
        this.stats = { ...this.stats, ...JSON.parse(stored) };
        console.log('📊 Stats loaded:', this.stats);
      }
    } catch (error) {
      console.error('❌ Failed to load stats:', error);
    }
  }

  // Save stats to localStorage
  private saveStats(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
      console.log('💾 Stats saved:', this.stats);
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
    if (score > this.stats.highScore) {
      console.log(`🏆 New high score! ${this.stats.highScore} -> ${score}`);
      this.stats.highScore = score;
      this.saveStats();
    }
  }

  // Update highest board reached
  public updateHighestBoard(board: number): void {
    if (board > this.stats.highestBoard) {
      console.log(`📊 New highest board! ${this.stats.highestBoard} -> ${board}`);
      this.stats.highestBoard = board;
      this.saveStats();
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
