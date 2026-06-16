// Arcade Stats Service
// Keeps stats strictly for homepage Arcade one-off runs.

interface ArcadeStats {
  highScore: number;
  cubesCracked: number;
  longestCombo: number;
  highestStageOpened: number;
  lastPlayed: number;
}

const STORAGE_KEY = 'cc_arcade_stats_v1';

class ArcadeStatsService {
  private stats: ArcadeStats = {
    highScore: 0,
    cubesCracked: 0,
    longestCombo: 0,
    highestStageOpened: 1,
    lastPlayed: 0,
  };

  constructor() {
    this.loadStats();
  }

  private loadStats(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        this.stats = {
          highScore: Number.isFinite(parsed.highScore) ? (parsed.highScore | 0) : 0,
          cubesCracked: Number.isFinite(parsed.cubesCracked) ? (parsed.cubesCracked | 0) : 0,
          longestCombo: Number.isFinite(parsed.longestCombo) ? (parsed.longestCombo | 0) : 0,
          highestStageOpened: Number.isFinite(parsed.highestStageOpened) ? Math.max(1, parsed.highestStageOpened | 0) : 1,
          lastPlayed: Number.isFinite(parsed.lastPlayed) ? parsed.lastPlayed : 0,
        };
      }
    } catch (error) {
      console.warn('⚠️ Failed to load arcade stats:', error);
      this.stats = { highScore: 0, cubesCracked: 0, longestCombo: 0, highestStageOpened: 1, lastPlayed: 0 };
    }
  }

  private saveStats(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
    } catch (error) {
      console.error('❌ Failed to save arcade stats:', error);
    }
  }

  public getStats(): ArcadeStats {
    return { ...this.stats };
  }

  public updateHighScore(score: number): boolean {
    if (!Number.isFinite(score) || score < 0) return false;
    const safeScore = score | 0;
    if (safeScore <= this.stats.highScore) return false;
    this.stats.highScore = safeScore;
    this.stats.lastPlayed = Date.now();
    this.saveStats();
    console.log(`🏆 New ARCADE high score: ${safeScore}`);
    return true;
  }

  public addCubesCracked(count: number): number {
    if (!Number.isFinite(count) || count <= 0) return this.stats.cubesCracked;
    const safeCount = count | 0;
    this.stats.cubesCracked += safeCount;
    this.stats.lastPlayed = Date.now();
    this.saveStats();
    return this.stats.cubesCracked;
  }

  public updateLongestCombo(combo: number): boolean {
    if (!Number.isFinite(combo) || combo < 0) return false;
    const safeCombo = combo | 0;
    if (safeCombo <= this.stats.longestCombo) return false;
    this.stats.longestCombo = safeCombo;
    this.stats.lastPlayed = Date.now();
    this.saveStats();
    console.log(`🎯 New ARCADE longest combo: ${safeCombo}`);
    return true;
  }

  public updateHighestStageOpened(stage: number): boolean {
    if (!Number.isFinite(stage) || stage < 1) return false;
    const safeStage = stage | 0;
    if (safeStage <= this.stats.highestStageOpened) return false;
    this.stats.highestStageOpened = safeStage;
    this.stats.lastPlayed = Date.now();
    this.saveStats();
    return true;
  }

  public resetStats(): void {
    this.stats = { highScore: 0, cubesCracked: 0, longestCombo: 0, highestStageOpened: 1, lastPlayed: 0 };
    this.saveStats();
  }
}

export const arcadeStatsService = new ArcadeStatsService();
export type { ArcadeStats };
