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
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private isDirty = false;
  private lastSavedSnapshot = '';
  private readonly saveDebounceMs = 750;

  constructor() {
    this.loadStats();
    this.lastSavedSnapshot = this.serializeStats(this.stats);
    this.installFlushHandlers();
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

  private serializeStats(stats: AllBoardStats): string {
    try {
      return JSON.stringify(stats);
    } catch {
      return '';
    }
  }

  private installFlushHandlers(): void {
    // Ensure buffered stats are persisted when app/tab is backgrounded or closed.
    const flush = () => this.flushStatsNow('lifecycle');
    try {
      if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', flush);
        window.addEventListener('beforeunload', flush);
      }
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') flush();
        });
      }
    } catch (error) {
      console.warn('⚠️ Failed to install board stats flush handlers:', error);
    }
  }

  private clearSaveTimer(): void {
    if (this.saveTimer === null) return;
    try {
      globalThis.clearTimeout(this.saveTimer);
    } catch {}
    this.saveTimer = null;
  }

  private scheduleSave(reason: string): void {
    this.isDirty = true;
    if (this.saveTimer !== null) return;
    this.saveTimer = globalThis.setTimeout(() => {
      this.saveTimer = null;
      this.flushStatsNow(`debounced:${reason}`);
    }, this.saveDebounceMs);
  }

  // Save stats to localStorage immediately (used by debounced flush and lifecycle events)
  public flushStatsNow(reason = 'manual'): void {
    this.clearSaveTimer();
    if (!this.isDirty) return;

    const snapshot = this.serializeStats(this.stats);
    if (!snapshot || snapshot === this.lastSavedSnapshot) {
      this.isDirty = false;
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, snapshot);
      this.lastSavedSnapshot = snapshot;
      this.isDirty = false;
      console.log(`💾 Board stats saved (${reason})`);
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
      this.scheduleSave('high-score');
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
      this.scheduleSave('longest-combo');
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
    this.scheduleSave('times-played');
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
    this.scheduleSave('cubes-cracked');
    console.log(`🧊 Board ${boardId} cubes cracked: ${current.cubesCracked} + ${cubes} = ${newTotal}`);
    return newTotal;
  }

  // Reset stats for specific board (for testing/debugging)
  public resetBoardStats(boardId: number): void {
    delete this.stats[boardId];
    this.scheduleSave('reset-board');
    this.flushStatsNow('reset-board');
    console.log(`🧹 Board ${boardId} stats reset`);
  }

  // Reset all stats (for testing/debugging)
  public resetAllStats(): void {
    this.stats = {};
    this.scheduleSave('reset-all');
    this.flushStatsNow('reset-all');
    console.log('🧹 All board stats reset');
  }
}

// Export singleton instance
export const boardStatsService = new BoardStatsService();

// Export class for testing
export { BoardStatsService };
export type { BoardStats, AllBoardStats };
