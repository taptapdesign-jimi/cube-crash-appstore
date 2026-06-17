import { createGameplaySnapshot, type GameplaySnapshot, type GameplaySnapshotInput } from './gameplay-snapshot.ts';
import { getFinalMergeSnapshot, type FinalMergeSnapshot, type FinalMergeSnapshotInput } from './final-merge-rules.ts';
import type { EndGameResult } from './endgame-checker.ts';

export type GameplayResolutionDecision =
  | { type: 'wait'; reason: string }
  | { type: 'continue'; reason: string }
  | { type: 'spawn'; reason: string }
  | { type: 'complete'; reason: string; target: 'arcade-stage' | 'journey-board' | 'clean-board' }
  | { type: 'fail'; reason: string };

export type ComparableGameplayDecisionType = 'wait' | 'continue' | 'complete' | 'fail';

export type LevelEndDecision =
  | { type: 'wait'; reason: string; source: 'resolver' }
  | { type: 'clean'; reason: string; source: 'resolver' | 'legacy' }
  | { type: 'stuck'; reason: string; source: 'resolver' | 'legacy' }
  | { type: 'continue'; reason: string; source: 'resolver' | 'legacy' };

export type ResolvedLevelEndDecision = {
  snapshot: GameplaySnapshot;
  resolverDecision: GameplayResolutionDecision;
  levelEndDecision: LevelEndDecision;
};

export type MergeFinalityDecision = {
  finalMerge: FinalMergeSnapshot;
  decision: GameplayResolutionDecision;
  isFinalMerge: boolean;
};

export type GameplayDecisionSummary = {
  mode: GameplaySnapshot['mode'];
  phase: GameplaySnapshot['phase'];
  boardNumber?: number;
  stageNumber?: number;
  decision: GameplayResolutionDecision['type'];
  reason: string;
  target?: 'arcade-stage' | 'journey-board' | 'clean-board';
  activeTiles: number;
  lockedTiles: number;
  wildTiles: number;
  transientTiles: number;
  moves: number;
  effSum: number;
  endGameType: EndGameResult['type'];
  finalMerge: FinalMergeSnapshot;
  flags: GameplaySnapshot['flags'];
};

export function getLegacyComparableDecisionType(result: EndGameResult): ComparableGameplayDecisionType {
  if (result.type === 'clean') return 'complete';
  if (result.type === 'stuck') return 'fail';
  return 'continue';
}

export function getResolverComparableDecisionType(decision: GameplayResolutionDecision): ComparableGameplayDecisionType {
  if (decision.type === 'spawn') return 'continue';
  return decision.type;
}

export function summarizeGameplayDecision(
  snapshot: GameplaySnapshot,
  decision: GameplayResolutionDecision,
): GameplayDecisionSummary {
  return {
    mode: snapshot.mode,
    phase: snapshot.phase,
    boardNumber: snapshot.boardNumber,
    stageNumber: snapshot.stageNumber,
    decision: decision.type,
    reason: decision.reason,
    target: decision.type === 'complete' ? decision.target : undefined,
    activeTiles: snapshot.activeTiles.length,
    lockedTiles: snapshot.lockedTiles.length,
    wildTiles: snapshot.wildTiles.length,
    transientTiles: snapshot.transientTiles.length,
    moves: snapshot.moves,
    effSum: snapshot.effSum,
    endGameType: snapshot.endGameResult.type,
    finalMerge: snapshot.finalMerge,
    flags: snapshot.flags,
  };
}

function completeTargetForMode(mode: GameplaySnapshot['mode']): 'arcade-stage' | 'journey-board' | 'clean-board' {
  if (mode === 'arcade') return 'arcade-stage';
  if (mode === 'journey') return 'journey-board';
  return 'clean-board';
}

function hasRuntimeWait(snapshot: GameplaySnapshot): boolean {
  const flags = snapshot.flags;
  return flags.busyEnding ||
    flags.wildSpawnInProgress ||
    flags.merge6SpawnInProgress ||
    flags.wildMagnetPullInProgress ||
    flags.pendingSpecialAnimation ||
    snapshot.transientTiles.length > 0;
}

function hasWildContinuation(snapshot: GameplaySnapshot): boolean {
  if (snapshot.flags.willPulledTilesMerge) return true;
  if (snapshot.flags.hasTilesToPull) return true;
  if (snapshot.wildTiles.length <= 0) return false;
  if (!snapshot.finalMerge.isFinalMerge) return true;
  if (snapshot.activeTiles.length < 2) return false;
  return snapshot.anyMergePossible;
}

export function resolveFinalMergeDecision({
  mode,
  finalMerge,
  willPulledTilesMerge = false,
}: {
  mode: GameplaySnapshot['mode'];
  finalMerge: FinalMergeSnapshot;
  willPulledTilesMerge?: boolean;
}): GameplayResolutionDecision {
  if (!finalMerge.isFinalMerge || willPulledTilesMerge) {
    return { type: 'continue', reason: willPulledTilesMerge ? 'pulled_tiles_will_merge' : 'not_final_merge' };
  }

  return {
    type: 'complete',
    target: completeTargetForMode(mode),
    reason: finalMerge.isFinalRegularMerge6 ? 'final_regular_merge6' : 'final_wild_merge6',
  };
}

export function resolveMergeFinality({
  mode,
  finalMergeInput,
  willPulledTilesMerge = false,
}: {
  mode: GameplaySnapshot['mode'];
  finalMergeInput: FinalMergeSnapshotInput;
  willPulledTilesMerge?: boolean;
}): MergeFinalityDecision {
  const finalMerge = getFinalMergeSnapshot(finalMergeInput);
  const decision = resolveFinalMergeDecision({
    mode,
    finalMerge,
    willPulledTilesMerge,
  });

  return {
    finalMerge,
    decision,
    isFinalMerge: decision.type === 'complete',
  };
}

export function resolveGameplayState(snapshot: GameplaySnapshot): GameplayResolutionDecision {
  if (hasRuntimeWait(snapshot)) {
    return { type: 'wait', reason: 'runtime_transition_active' };
  }

  const finalMergeDecision = resolveFinalMergeDecision({
    mode: snapshot.mode,
    finalMerge: snapshot.finalMerge,
    willPulledTilesMerge: snapshot.flags.willPulledTilesMerge,
  });
  if (finalMergeDecision.type === 'complete') {
    return finalMergeDecision;
  }

  if (hasWildContinuation(snapshot)) {
    return { type: 'continue', reason: 'wild_continuation_available' };
  }

  if (snapshot.endGameResult.type === 'clean') {
    return {
      type: 'complete',
      target: completeTargetForMode(snapshot.mode),
      reason: snapshot.endGameResult.reason,
    };
  }

  if (snapshot.phase === 'after-merge' && snapshot.effSum === 6) {
    return { type: 'spawn', reason: 'merge6_spawn_required' };
  }

  if (snapshot.endGameResult.type === 'stuck') {
    return { type: 'fail', reason: snapshot.endGameResult.reason };
  }

  return { type: 'continue', reason: snapshot.endGameResult.reason };
}

export function normalizeLevelEndDecision({
  legacyResult,
  resolverDecision,
}: {
  legacyResult: EndGameResult;
  resolverDecision?: GameplayResolutionDecision | null;
}): LevelEndDecision {
  if (resolverDecision?.type === 'wait') {
    return { type: 'wait', reason: resolverDecision.reason, source: 'resolver' };
  }

  if (resolverDecision?.type === 'complete') {
    return { type: 'clean', reason: resolverDecision.reason, source: 'resolver' };
  }

  if (resolverDecision?.type === 'fail') {
    return { type: 'stuck', reason: resolverDecision.reason, source: 'resolver' };
  }

  if (resolverDecision?.type === 'continue' || resolverDecision?.type === 'spawn') {
    return { type: 'continue', reason: resolverDecision.reason, source: 'resolver' };
  }

  if (legacyResult.type === 'clean') {
    return { type: 'clean', reason: legacyResult.reason, source: 'legacy' };
  }

  if (legacyResult.type === 'stuck') {
    return { type: 'stuck', reason: legacyResult.reason, source: 'legacy' };
  }

  return { type: 'continue', reason: legacyResult.reason, source: 'legacy' };
}

export function resolveLevelEndDecision({
  legacyResult,
  snapshotInput,
}: {
  legacyResult: EndGameResult;
  snapshotInput: GameplaySnapshotInput;
}): ResolvedLevelEndDecision {
  const snapshot = createGameplaySnapshot(snapshotInput);
  const resolverDecision = resolveGameplayState(snapshot);
  const levelEndDecision = normalizeLevelEndDecision({
    legacyResult,
    resolverDecision,
  });

  return {
    snapshot,
    resolverDecision,
    levelEndDecision,
  };
}
