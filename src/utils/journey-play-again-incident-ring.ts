const STORAGE_KEY = '__ccJourneyPlayAgainIncidentRingV1';
const MAX_ENTRIES = 48;

export type JourneyPlayAgainIncidentEntry = {
  version: 1;
  cycle: number;
  phase: string;
  atEpochMs: number;
  detail?: Record<string, unknown>;
  state: Record<string, unknown>;
};

let activeCycle = 0;

function safeRead(): JourneyPlayAgainIncidentEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

function safeWrite(entries: JourneyPlayAgainIncidentEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {}
}

function countGrid(grid: unknown): { occupied: number; unique: number; destroyedRefs: number } {
  try {
    const cells = Array.isArray(grid) ? grid.flat().filter(Boolean) : [];
    return {
      occupied: cells.length,
      unique: new Set(cells).size,
      destroyedRefs: cells.filter((cell: any) => cell?.destroyed === true).length,
    };
  } catch {
    return { occupied: 0, unique: 0, destroyedRefs: 0 };
  }
}

function readOptionalStats(owner: any, method: string): unknown {
  try {
    return typeof owner?.[method] === 'function' ? owner[method]() : null;
  } catch {
    return null;
  }
}

function snapshotState(): Record<string, unknown> {
  try {
    const runtime = window as any;
    const state = runtime.STATE || runtime.CC?.STATE || {};
    const cc = runtime.CC || {};
    const tiles = Array.isArray(state.tiles) ? state.tiles : [];
    const app = state.app || cc.app || runtime.app;
    const stage = state.stage || cc.stage || app?.stage;
    const board = state.board || cc.board;
    const gsap = runtime.gsap;
    const gsapChildren = (() => {
      try { return gsap?.globalTimeline?.getChildren?.(true, true, true)?.length ?? null; } catch { return null; }
    })();
    return {
      runMode: runtime.__ccRunMode ?? null,
      boardNumber: state.boardNumber ?? state.level ?? runtime.__ccStartAtLevel ?? null,
      flags: {
        playAgain: runtime.__ccPlayAgainRestartInProgress === true,
        boardTransition: runtime.__ccBoardTransitionActive === true,
        busyEnding: state.busyEnding === true,
        merge6: runtime.__ccMerge6SpawnInProgress === true,
      },
      tiles: {
        total: tiles.length,
        alive: tiles.filter((tile: any) => tile && tile.destroyed !== true).length,
        destroyed: tiles.filter((tile: any) => tile?.destroyed === true).length,
        unique: new Set(tiles).size,
      },
      grid: countGrid(state.grid),
      board: {
        exists: !!board,
        visible: board?.visible ?? null,
        children: board?.children?.length ?? null,
      },
      stage: {
        exists: !!stage,
        visible: stage?.visible ?? null,
        children: stage?.children?.length ?? null,
      },
      pixiTicker: {
        started: app?.ticker?.started ?? null,
        count: app?.ticker?.count ?? null,
      },
      gsap: {
        paused: gsap?.globalTimeline?.paused?.() ?? null,
        children: gsapChildren,
      },
      animationManager: readOptionalStats(runtime.animationManager, 'getStats'),
      cleanup: readOptionalStats(cc, 'getCleanupStats'),
      gameplayOwner: readOptionalStats(cc, 'getJourneyPlayAgainIncidentState'),
      stars: readOptionalStats(cc, 'getStarAnimationStats')
        ?? readOptionalStats(runtime, '__ccGetStarAnimationStats'),
      lastMergePerf: runtime.__ccLastMergePerf ?? null,
      boardLifecycle: runtime.__ccLastBoardLifecycleTrace ?? null,
      overlays: document.querySelectorAll('.clean-board-overlay, #clean-board-overlay').length,
      canvases: document.querySelectorAll('canvas').length,
    };
  } catch {
    return { snapshotError: true };
  }
}

export function beginJourneyPlayAgainIncidentCycle(detail: Record<string, unknown> = {}): number {
  if (!areContinuousRuntimeDiagnosticsEnabled()) return activeCycle;
  try {
    const entries = safeRead();
    const highestCycle = entries.reduce((highest, entry) => Math.max(highest, Number(entry?.cycle) || 0), 0);
    activeCycle = Math.max(activeCycle, highestCycle) + 1;
    recordJourneyPlayAgainIncident('play-again-click', detail, activeCycle);
  } catch {}
  return activeCycle;
}

export function recordJourneyPlayAgainIncident(
  phase: string,
  detail: Record<string, unknown> = {},
  cycle = activeCycle,
): void {
  if (!areContinuousRuntimeDiagnosticsEnabled()) return;
  try {
    const entry: JourneyPlayAgainIncidentEntry = {
      version: 1,
      cycle: Math.max(0, Number(cycle) || 0),
      phase: String(phase || 'unknown'),
      atEpochMs: Date.now(),
      detail,
      state: snapshotState(),
    };
    const entries = safeRead();
    entries.push(entry);
    safeWrite(entries);
    console.info('🧪 JourneyPlayAgainIncident', entry);
  } catch {}
}

export function dumpJourneyPlayAgainIncidentRing(): JourneyPlayAgainIncidentEntry[] {
  if (!areContinuousRuntimeDiagnosticsEnabled()) return [];
  const entries = safeRead();
  try {
    if (entries.length > 0) console.info('🧪 JourneyPlayAgainIncidentRing', entries);
  } catch {}
  return entries;
}

export function resetJourneyPlayAgainIncidentRingForTests(): void {
  activeCycle = 0;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export const JOURNEY_PLAY_AGAIN_INCIDENT_RING_MAX_ENTRIES = MAX_ENTRIES;
import { areContinuousRuntimeDiagnosticsEnabled } from './runtime-diagnostics-policy.js';
