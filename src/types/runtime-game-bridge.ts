import type { Application, Container } from 'pixi.js';
import type { createReplayRecorder } from '../modules/app-core-replay.ts';

type ReplayRecorder = ReturnType<typeof createReplayRecorder>;

export type RuntimeGameStateSummary = {
  level: number;
  score: number;
  board: number;
  moves: number;
  wildMeter: number;
  tiles: number;
};

export type RuntimeEndgameGuardState = {
  active: boolean;
  count: number;
  until: number;
  sources: string[];
};

export type RuntimeDevLastMergeOptions = {
  coreWildType?: 'wild' | 'wild-juice' | 'wild-magnet' | 'wild-tnt';
  variantId?: string | null;
  label?: string;
};

/**
 * Typed compatibility surface installed by app-core after boot.
 * Every method delegates to an existing owner; this interface stores no state.
 */
export interface RuntimeGameBridge {
  app: Application | null;
  stage: Container | null;
  board: Container | null;

  nextLevel: () => Promise<void>;
  retry: () => Promise<void>;
  restart: (options?: { animateHudDrop?: boolean }) => Promise<void>;
  pauseGame: () => void;
  resumeGame: () => void;
  resume: () => void;
  layoutBoard: () => Promise<void>;
  hideGameUI: () => void;
  showGameUI: () => void;

  state: () => RuntimeGameStateSummary;
  getScore: () => number;
  setScore: (value: number) => void;
  animateScoreTo: (value: number, duration?: number) => void;
  addScoreFromHudStar: (amount?: number) => number;
  updateHUD: () => void;
  getHudMetrics: () => Record<string, unknown>;
  getUnifiedHudInfo: () => { y: number; height: number; parent: unknown; dropped: boolean };
  getCombo: () => number;
  setCombo: (value: number) => void;
  scheduleComboDecay: (milliseconds?: number) => void;
  killComboTimer: () => void;
  addStars: (count: number) => void;
  setStarsCount: (count: number) => void;

  showCleanBoardOverlay: () => Promise<void>;
  devLastMergeTntScene: (options?: RuntimeDevLastMergeOptions) => Promise<void>;
  triggerCleanBoardFlow: (reason: string) => Promise<void>;
  checkLevelEnd: () => void;
  beginEndgameGuard: (source: string, ttlMs?: number) => number;
  endEndgameGuard: (source: string) => void;
  getEndgameGuardState: () => RuntimeEndgameGuardState;
  debugResolveGameplayState: (reason?: string, overrides?: unknown) => unknown;
  isWildMagnetPullInProgress: () => boolean;
  applyWildSkinLocal: (tile: unknown) => void;

  cleanupFxForBoardReset: (reason?: string) => void;
  getCleanupStats: () => {
    timeouts: number;
    animationFrames: number;
    intervals: number;
    listeners: number;
  };
  getJourneyPlayAgainIncidentState: () => Record<string, unknown>;
  resetTransientRunGuards: (reason?: string) => void;
  softResetBoardView: (reason?: string) => void;
  destroyOldBoardForTransition: (reason?: string) => void;
  cleanupTexturesForBoardTransition: (
    reason: string,
    aggressive?: boolean,
    skipCacheClear?: boolean,
  ) => void;

  snapshotState: ReplayRecorder['snapshot'];
  replayStartRecord: ReplayRecorder['startRecord'];
  replayStartVerify: ReplayRecorder['startVerify'];
  replayStop: ReplayRecorder['stop'];
  replayExport: ReplayRecorder['export'];
  replayImport: ReplayRecorder['import'];
  replayStatus: ReplayRecorder['status'];

  /** Internal terminal presentation marker retained for compatibility. */
  _endgameFlowRunning?: boolean;
}
