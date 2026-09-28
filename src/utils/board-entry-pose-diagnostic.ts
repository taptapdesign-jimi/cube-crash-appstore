import { createScreenLifecycle } from './screen-lifecycle.js';
import { emitNativeConsoleDiagnostic } from './ios-native-diagnostic.js';

type Pose = {
  t: number;
  boardX: number;
  boardY: number;
  boardScaleX: number;
  boardScaleY: number;
  stageX: number;
  stageY: number;
  hudY: number | null;
  canvasTop: number | null;
  canvasHeight: number | null;
  viewportHeight: number;
  tileX: number | null;
  tileY: number | null;
  tileScaleX: number | null;
  tileScaleY: number | null;
};

const rounded = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
};

function changed(previous: Pose | null, next: Pose): boolean {
  if (!previous) return true;
  return (Object.keys(next) as Array<keyof Pose>).some((key) => {
    if (key === 't') return false;
    const before = previous[key];
    const after = next[key];
    if (before == null || after == null) return before !== after;
    return Math.abs(Number(after) - Number(before)) >= 0.25;
  });
}

/** Diagnostic-only bounded sampler; ordinary builds return a zero-cost noop. */
export function startBoardEntryPoseDiagnostic(tiles: any[]): () => void {
  if (typeof window === 'undefined' || (window as any).__ccPerformanceDiagnostics !== true) {
    return () => {};
  }

  const startedAt = performance.now();
  const samples: Pose[] = [];
  let previous: Pose | null = null;
  const lifecycle = createScreenLifecycle('board-entry-pose-diagnostic');
  let tailTimer: ReturnType<typeof setTimeout> | null = null;
  let finalized = false;

  const finish = (reason: string) => {
    if (finalized) return;
    finalized = true;
    lifecycle.cleanup();
    emitNativeConsoleDiagnostic('[CC_BOARD_POSE]', 'summary', {
      reason,
      durationMs: Math.round(performance.now() - startedAt),
      samples,
    });
  };

  const sample = () => {
    if (finalized) return;
    const board = (window as any).CC?.board;
    const stage = (window as any).CC?.stage;
    const app = (window as any).CC?.app;
    const hudRoot = (window as any).HUD_ROOT ?? null;
    const tile = tiles.find((candidate) => candidate && !candidate.destroyed) ?? null;
    const rect = app?.canvas?.getBoundingClientRect?.() ?? null;
    const next: Pose = {
      t: Math.round(performance.now() - startedAt),
      boardX: rounded(board?.x) ?? 0,
      boardY: rounded(board?.y) ?? 0,
      boardScaleX: rounded(board?.scale?.x) ?? 0,
      boardScaleY: rounded(board?.scale?.y) ?? 0,
      stageX: rounded(stage?.x) ?? 0,
      stageY: rounded(stage?.y) ?? 0,
      hudY: rounded(hudRoot?.y),
      canvasTop: rounded(rect?.top),
      canvasHeight: rounded(rect?.height),
      viewportHeight: rounded(window.visualViewport?.height ?? window.innerHeight) ?? 0,
      tileX: rounded(tile?.x),
      tileY: rounded(tile?.y),
      tileScaleX: rounded(tile?.scale?.x),
      tileScaleY: rounded(tile?.scale?.y),
    };
    if (changed(previous, next) && samples.length < 120) samples.push(next);
    previous = next;
    if (performance.now() - startedAt >= 4000) finish('timeout');
    else lifecycle.trackRaf(sample);
  };
  lifecycle.trackRaf(sample);

  return () => {
    if (finalized || tailTimer) return;
    tailTimer = lifecycle.trackTimeout(() => finish('popin-plus-tail'), 900);
  };
}
