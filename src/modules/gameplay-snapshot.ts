import { checkEndGame, getActiveTiles, type EndGameResult } from './endgame-checker.ts';
import {
  getPlayableMagnetPullCandidates,
  getFinalMergeTileSets,
  getFinalMergeSnapshot,
  isWildLikeTile,
  type FinalMergeSnapshot,
} from './final-merge-rules.ts';
import { isTileTransientlySpawning } from './tile-state-utils.ts';
import { isSpecialDiceMagnetLikeTile } from './special-dice-registry.ts';

export type GameplayMode = 'arcade' | 'journey' | 'unknown';

export type GameplayPhase =
  | 'before-merge'
  | 'after-src-removal'
  | 'after-merge'
  | 'post-spawn'
  | 'level-check'
  | 'manual-check';

export type GameplayRuntimeFlags = {
  busyEnding?: boolean;
  wildSpawnInProgress?: boolean;
  merge6SpawnInProgress?: boolean;
  wildMagnetPullInProgress?: boolean;
  pendingSpecialAnimation?: boolean;
  willPulledTilesMerge?: boolean;
  hasTilesToPull?: boolean;
};

export type GameplaySnapshotInput = {
  tiles: any[];
  moves: number;
  makeBoard: {
    anyMergePossible: (tiles: any[]) => boolean;
  };
  mode?: GameplayMode;
  phase?: GameplayPhase;
  boardNumber?: number;
  stageNumber?: number;
  src?: any;
  dst?: any;
  effSum?: number;
  finalMergeBlockersBefore?: any[];
  forceEndgameRefresh?: boolean;
  flags?: GameplayRuntimeFlags;
};

export type GameplaySnapshot = {
  mode: GameplayMode;
  phase: GameplayPhase;
  boardNumber?: number;
  stageNumber?: number;
  tiles: any[];
  activeTiles: any[];
  lockedTiles: any[];
  wildTiles: any[];
  transientTiles: any[];
  moves: number;
  src?: any;
  dst?: any;
  effSum: number;
  anyMergePossible: boolean;
  endGameResult: EndGameResult;
  finalMerge: FinalMergeSnapshot;
  flags: Required<GameplayRuntimeFlags>;
};

function normalizeFlags(flags: GameplayRuntimeFlags = {}): Required<GameplayRuntimeFlags> {
  return {
    busyEnding: flags.busyEnding === true,
    wildSpawnInProgress: flags.wildSpawnInProgress === true,
    merge6SpawnInProgress: flags.merge6SpawnInProgress === true,
    wildMagnetPullInProgress: flags.wildMagnetPullInProgress === true,
    pendingSpecialAnimation: flags.pendingSpecialAnimation === true,
    willPulledTilesMerge: flags.willPulledTilesMerge === true,
    hasTilesToPull: flags.hasTilesToPull === true,
  };
}

export function createGameplaySnapshot(input: GameplaySnapshotInput): GameplaySnapshot {
  const tiles = Array.isArray(input.tiles) ? input.tiles.filter(Boolean) : [];
  const flags = normalizeFlags(input.flags);
  const activeTiles = getActiveTiles(tiles);
  const lockedTiles = tiles.filter((tile: any) => tile && !tile.destroyed && tile.locked === true);
  const wildTiles = tiles.filter((tile: any) => tile && !tile.destroyed && isWildLikeTile(tile));
  const transientTiles = tiles.filter((tile: any) => isTileTransientlySpawning(tile, {
    autoClearStaleFlag: false,
    ignoreWildJuice: true,
  }));
  const finalMergeTileSets = getFinalMergeTileSets({
    tiles,
    src: input.src,
    dst: input.dst,
  });
  const finalMergeBlockers = input.finalMergeBlockersBefore ?? finalMergeTileSets.finalMergeBlockersBefore;
  const isMagnetMerge = isSpecialDiceMagnetLikeTile(input.src) || isSpecialDiceMagnetLikeTile(input.dst);
  const hasConfirmedMagnetPull =
    flags.willPulledTilesMerge ||
    (isMagnetMerge &&
      flags.hasTilesToPull &&
      getPlayableMagnetPullCandidates({
        tiles,
        src: input.src,
        dst: input.dst,
        magnetTile: isSpecialDiceMagnetLikeTile(input.src) ? input.src : input.dst,
      }).length > 0);
  const anyMergePossible = !!input.makeBoard?.anyMergePossible?.(tiles);
  const endGameResult = checkEndGame({
    tiles,
    moves: input.moves,
    makeBoard: input.makeBoard,
    srcTile: input.src,
    dstTile: input.dst,
    justRemovedSrc: input.phase === 'after-src-removal',
  }, input.forceEndgameRefresh ?? true);
  const finalMerge = getFinalMergeSnapshot({
    activeTilesBeforeMerge: finalMergeTileSets.activeTilesBeforeMerge,
    src: input.src,
    dst: input.dst,
    effSum: input.effSum ?? 0,
    finalMergeBlockersBefore: finalMergeBlockers,
    isWildMagnetMerge: isMagnetMerge,
    hasTilesToPull: hasConfirmedMagnetPull,
  });

  return {
    mode: input.mode ?? 'unknown',
    phase: input.phase ?? 'manual-check',
    boardNumber: input.boardNumber,
    stageNumber: input.stageNumber,
    tiles,
    activeTiles,
    lockedTiles,
    wildTiles,
    transientTiles,
    moves: input.moves,
    src: input.src,
    dst: input.dst,
    effSum: input.effSum ?? 0,
    anyMergePossible,
    endGameResult,
    finalMerge,
    flags,
  };
}
