import type { FinalMergeFinaleFx } from './final-merge-reasons.ts';

export type FinalMergeRuntimeFx = FinalMergeFinaleFx | null;

type RuntimeTile = {
  destroyed?: boolean;
  _ccFinalMergeAllowedByResolver?: boolean;
  _ccFinalMergeRuntimePending?: boolean;
  _ccFinalMergeRuntimeStartedAt?: number;
  _ccFinalMergeRuntimeFx?: FinalMergeRuntimeFx;
};

export type FinalMergeRuntimeSnapshot = {
  finaleFx: FinalMergeRuntimeFx;
  startedAt: number;
};

// Long enough for the merge impact/finale handoff, but bounded so a crashed
// animation can still be recovered by the existing end-game safety flow.
export const FINAL_MERGE_RUNTIME_PROTECTION_MS = 5000;
export const FINAL_MERGE_RUNTIME_FALLBACK_MS = 8000;

export function markFinalMergeRuntime(
  tile: RuntimeTile | null | undefined,
  finaleFx: FinalMergeRuntimeFx,
  now: number = Date.now(),
): void {
  if (!tile) return;
  tile._ccFinalMergeRuntimePending = true;
  tile._ccFinalMergeRuntimeStartedAt = now;
  tile._ccFinalMergeRuntimeFx = finaleFx;
}

export function getFinalMergeRuntimeSnapshot(
  tile: RuntimeTile | null | undefined,
  now: number = Date.now(),
  maxAgeMs: number = FINAL_MERGE_RUNTIME_FALLBACK_MS,
): FinalMergeRuntimeSnapshot | null {
  if (!tile || tile.destroyed || tile._ccFinalMergeRuntimePending !== true) return null;
  if (tile._ccFinalMergeAllowedByResolver !== true) return null;

  const startedAt = Number(tile._ccFinalMergeRuntimeStartedAt);
  if (!Number.isFinite(startedAt) || startedAt <= 0) return null;
  const ageMs = Math.max(0, now - startedAt);
  if (ageMs > maxAgeMs) return null;

  const finaleFx = tile._ccFinalMergeRuntimeFx;
  if (finaleFx !== null && finaleFx !== 'tnt' && finaleFx !== 'juice' && finaleFx !== 'magnet' && finaleFx !== 'star') {
    return null;
  }
  return { finaleFx, startedAt };
}

export function findRecentFinalMergeRuntime(
  tiles: Array<RuntimeTile | null | undefined>,
  now: number = Date.now(),
  maxAgeMs: number = FINAL_MERGE_RUNTIME_FALLBACK_MS,
): FinalMergeRuntimeSnapshot | null {
  let latest: FinalMergeRuntimeSnapshot | null = null;
  for (const tile of tiles) {
    const snapshot = getFinalMergeRuntimeSnapshot(tile, now, maxAgeMs);
    if (snapshot && (!latest || snapshot.startedAt > latest.startedAt)) latest = snapshot;
  }
  return latest;
}

export function isFinalMergeRuntimeTileProtected(
  tile: RuntimeTile | null | undefined,
  now: number = Date.now(),
): boolean {
  return getFinalMergeRuntimeSnapshot(tile, now, FINAL_MERGE_RUNTIME_PROTECTION_MS) !== null;
}
