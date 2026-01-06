// Per-Board Stats Service
// Tracks high score, longest combo, and times played for each board individually

interface BoardStats {
  highScore: number;
  longestCombo: number;
  cubesCracked: number; // 🔥 USER REQUEST: Per-board cubes cracked (accumulates)
  timesPlayed: number;
  lastPlayed: number; // timestamp
}

interface AllBoardStats {
  [boardId: number]: BoardStats;
}

const STORAGE_KEY = 'cc_board_stats_v1';

class BoardStatsService {
  private stats: AllBoardStats = {};

  constructor() {
    this.loadStats();
  }

  // Load stats from localStorage
  private loadStats(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.stats = JSON.parse(stored);
        console.log('📊 Board stats loaded:', this.stats);
      }
    } catch (error) {
      console.error('❌ Failed to load board stats:', error);
      this.stats = {};
    }
  }

  // Save stats to localStorage
  private saveStats(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
      console.log('💾 Board stats saved');
    } catch (error) {
      console.error('❌ Failed to save board stats:', error);
    }
  }

  // Get stats for specific board (returns default if not found)
  public getBoardStats(boardId: number): BoardStats {
    return this.stats[boardId] || {
      highScore: 0,
      longestCombo: 0,
      cubesCracked: 0, // 🔥 USER REQUEST: Per-board cubes cracked
      timesPlayed: 0,
      lastPlayed: 0
    };
  }

  // Get all board stats
  public getAllBoardStats(): AllBoardStats {
    return { ...this.stats };
  }

  // Update high score for board (only if higher)
  // Returns true if new high score was set
  public updateBoardHighScore(boardId: number, score: number): boolean {
    if (!Number.isFinite(score) || score < 0) {
      console.warn(`⚠️ Invalid score for board ${boardId}:`, score);
      return false;
    }

    const current = this.getBoardStats(boardId);
    if (score > current.highScore) {
      this.stats[boardId] = {
        ...current,
        highScore: score,
        lastPlayed: Date.now()
      };
      this.saveStats();
      console.log(`🏆 New high score for board ${boardId}: ${score} (previous: ${current.highScore})`);
      return true; // New high score!
    }
    return false;
  }

  // Update longest combo for board (only if longer)
  // Returns true if new longest combo was set
  public updateBoardLongestCombo(boardId: number, combo: number): boolean {
    if (!Number.isFinite(combo) || combo < 0) {
      console.warn(`⚠️ Invalid combo for board ${boardId}:`, combo);
      return false;
    }

    const current = this.getBoardStats(boardId);
    if (combo > current.longestCombo) {
      this.stats[boardId] = {
        ...current,
        longestCombo: combo,
        lastPlayed: Date.now()
      };
      this.saveStats();
      console.log(`🎯 New longest combo for board ${boardId}: ${combo} (previous: ${current.longestCombo})`);
      return true; // New longest combo!
    }
    return false;
  }

  // Increment times played for board
  public incrementBoardTimesPlayed(boardId: number): void {
    const current = this.getBoardStats(boardId);
    this.stats[boardId] = {
      ...current,
      timesPlayed: current.timesPlayed + 1,
      lastPlayed: Date.now()
    };
    this.saveStats();
    console.log(`🎮 Board ${boardId} played ${this.stats[boardId].timesPlayed} times`);
  }

  // 🔥 USER REQUEST: Add cubes cracked to board (accumulates - adds to existing total)
  // Returns the new total cubes cracked for this board
  public addBoardCubesCracked(boardId: number, cubes: number): number {
    if (!Number.isFinite(cubes) || cubes < 0) {
      console.warn(`⚠️ Invalid cubes count for board ${boardId}:`, cubes);
      return this.getBoardStats(boardId).cubesCracked;
    }

    const current = this.getBoardStats(boardId);
    const newTotal = current.cubesCracked + cubes;
    this.stats[boardId] = {
      ...current,
      cubesCracked: newTotal,
      lastPlayed: Date.now()
    };
    this.saveStats();
    console.log(`🧊 Board ${boardId} cubes cracked: ${current.cubesCracked} + ${cubes} = ${newTotal}`);
    return newTotal;
  }

  // Reset stats for specific board (for testing/debugging)
  public resetBoardStats(boardId: number): void {
    delete this.stats[boardId];
    this.saveStats();
    console.log(`🧹 Board ${boardId} stats reset`);
  }

  // Reset all stats (for testing/debugging)
  public resetAllStats(): void {
    this.stats = {};
    this.saveStats();
    console.log('🧹 All board stats reset');
  }
}

// Export singleton instance
export const boardStatsService = new BoardStatsService();

// Export class for testing
export { BoardStatsService };
export type { BoardStats, AllBoardStats };

