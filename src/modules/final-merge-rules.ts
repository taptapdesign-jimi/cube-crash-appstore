export type FinalMergeSnapshotInput = {
  activeTilesBeforeMerge: any[];
  src: any;
  dst: any;
  effSum: number;
  finalMergeBlockersBefore?: any[];
  isWildMagnetMerge?: boolean;
  hasTilesToPull?: boolean;
};

export type FinalMergeSnapshot = {
  activeSnapshotWasOnlyMergePair: boolean;
  activePhysicalTileCount: number;
  mergePhysicalTileCount: number;
  isFinalRegularMerge6: boolean;
  isFinalWildLastTwo: boolean;
  isFinalMerge: boolean;
};

export type JourneyClearedCelebrationInput = {
  isArcade: boolean;
  finalMergeSnapshot?: Pick<FinalMergeSnapshot, 'isFinalRegularMerge6'> | null;
};

export type FinalMergeTileSets = {
  activeTilesBeforeMerge: any[];
  finalMergeBlockersBefore: any[];
  authoritativeGridStatus: 'not-provided' | 'valid' | 'invalid';
  authoritativeGridIssues: FinalMergeGridIssue[];
};

export type FinalMergeGridIssue =
  | 'invalid-grid-shape'
  | 'duplicate-grid-owner'
  | 'coordinate-mismatch'
  | 'destroyed-grid-owner'
  | 'grid-owner-missing-from-tiles'
  | 'merge-source-ownership-invalid'
  | 'merge-destination-ownership-invalid';

type FinalMergeTileSetInput = {
  tiles: any[];
  grid?: readonly (readonly any[])[] | null;
  src: any;
  dst: any;
};

function uniqueTileRefs(tileList: any[]): any[] {
  const out: any[] = [];
  (Array.isArray(tileList) ? tileList : []).forEach((tile: any) => {
    if (!tile || out.includes(tile)) return;
    out.push(tile);
  });
  return out;
}

function stackDepthOf(tile: any): number {
  const depth = Number(tile?.stackDepth ?? 1);
  return Number.isFinite(depth) && depth > 0 ? depth : 1;
}

export function isWildLikeSpecial(special: unknown): boolean {
  return typeof special === 'string' && special.startsWith('wild');
}

export function isWildLikeTile(tile: any): boolean {
  return isWildLikeSpecial(tile?.special) ||
    isWildLikeSpecial(tile?._ccWildSpecial) ||
    isWildLikeSpecial(tile?._ccSpecialDiceArchetype) ||
    isWildLikeSpecial(tile?.specialDiceArchetype) ||
    tile?.isWild === true ||
    tile?.isWildFace === true;
}

function isStalePlayableWildSpawnDrop(tile: any): boolean {
  if (!tile || tile._ccWildSpawnDropping !== true) return false;
  if (!isWildLikeTile(tile)) return false;
  if (tile.destroyed === true || tile.visible === false) return false;
  if (typeof tile.alpha === 'number' && tile.alpha <= 0.01) return false;
  // A visible wild/special die still blocks final-merge completion even while input
  // is temporarily disabled by an animation gate. Otherwise "regular + one juice"
  // can falsely complete the board while another visible juice remains.
  return true;
}

export function isTilePendingGameplayRemoval(tile: any): boolean {
  if (!tile) return true;
  return tile.destroyed === true ||
    (tile._ccWildSpawnDropping === true && !isStalePlayableWildSpawnDrop(tile)) ||
    tile._pendingRemoval === true ||
    tile._beingRemoved === true ||
    tile._cleanupQueued === true;
}

function isVisibleEnoughForGameplay(tile: any): boolean {
  if (!tile) return false;
  if (tile.visible === false) return false;
  if (typeof tile.alpha === 'number' && tile.alpha <= 0.01) return false;
  return true;
}

function isVisibleWildGameplayPresence(tile: any): boolean {
  if (isTilePendingGameplayRemoval(tile)) return false;
  if (!isWildLikeTile(tile)) return false;
  if (tile._wildMagnetAffected === true) return false;
  if (!isVisibleEnoughForGameplay(tile)) return false;
  // Locked empty placeholders are faint. A full-opacity locked special is still
  // a real special die temporarily gated by animation/input and must block endgame.
  if (tile.locked === true && typeof tile.alpha === 'number' && tile.alpha <= 0.35) return false;
  return true;
}

export function tileCountsAsFinalMergeActive(tile: any): boolean {
  if (isTilePendingGameplayRemoval(tile)) return false;
  if (!isVisibleEnoughForGameplay(tile)) return false;
  if (isWildLikeTile(tile)) return isVisibleWildGameplayPresence(tile);
  if (tile.locked) return false;
  return (tile.value | 0) > 0;
}

export function tileBlocksFinalMerge(tile: any, srcTile: any, dstTile: any): boolean {
  if (!tile || tile === srcTile || tile === dstTile) return false;
  if (isTilePendingGameplayRemoval(tile)) return false;
  if (tile._wildMagnetAffected === true) return false;

  if (isWildLikeTile(tile)) return isVisibleWildGameplayPresence(tile);
  if (tile.locked) return false;
  if (!isVisibleEnoughForGameplay(tile)) return false;
  return (tile.value | 0) > 0;
}

export function isPlayableMagnetPullCandidate(tile: any, options: { allowMagnetOwned?: boolean } = {}): boolean {
  if (!tile || tile.destroyed === true || tile._ccWildSpawnDropping === true) return false;
  // Once Magnet owns a candidate it is intentionally locked and detached from
  // the grid. Commit validation must accept that owned state, while retaining
  // the same hard rejection for a tile that became a dropping spawn.
  if (options.allowMagnetOwned && tile._wildMagnetAffected === true) {
    return isWildLikeTile(tile) || (tile.value | 0) > 0;
  }
  if (!tileCountsAsFinalMergeActive(tile)) return false;
  if (tile._wildMagnetAffected === true) return false;
  if (tile._noTilesPulled === true || tile._wildMagnetPulledTilesMerge === true) return false;
  return isWildLikeTile(tile) || (tile.value | 0) > 0;
}

export function getPlayableMagnetPullCandidates({
  tiles,
  src,
  dst,
  magnetTile,
}: {
  tiles: any[];
  src: any;
  dst: any;
  magnetTile?: any;
}): any[] {
  const safeTiles = Array.isArray(tiles) ? tiles.filter(Boolean) : [];
  return safeTiles.filter((tile: any) => {
    if (!tile || tile === src || tile === dst || tile === magnetTile) return false;
    // A visible regular merge-6 destination can briefly remain on stage while
    // its spawn choreography finishes. It is cleanup-owned, not magnet food.
    if (typeof tile._ccMerge6CleanupToken === 'number') return false;
    // Dropping wilds still block false clean-board detection, but Magnet cannot
    // own them until their spawn transaction has settled.
    return isPlayableMagnetPullCandidate(tile);
  });
}

export function getFinalMergeTileSets({
  tiles,
  grid,
  src,
  dst,
}: FinalMergeTileSetInput): FinalMergeTileSets {
  // When the live grid is available it is the canonical board model. `tiles`
  // also owns presentation/lifecycle history, so an interrupted cleanup can
  // temporarily leave an active-looking orphan there after its cell has moved
  // on. Such a visual residue must not turn a true final pair into a spawn.
  const authoritativeGridIssues: FinalMergeGridIssue[] = [];
  const addGridIssue = (issue: FinalMergeGridIssue): void => {
    if (!authoritativeGridIssues.includes(issue)) authoritativeGridIssues.push(issue);
  };
  let gridOwnedTiles: any[] | null = null;
  if (Array.isArray(grid)) {
    gridOwnedTiles = [];
    const firstRowWidth = Array.isArray(grid[0]) ? grid[0].length : -1;
    if (grid.length < 1 || firstRowWidth < 1) addGridIssue('invalid-grid-shape');
    const seenGridOwners = new Set<any>();
    grid.forEach((row, rowIndex) => {
      if (!Array.isArray(row) || row.length !== firstRowWidth) {
        addGridIssue('invalid-grid-shape');
        return;
      }
      row.forEach((tile, columnIndex) => {
        if (!tile) return;
        gridOwnedTiles!.push(tile);
        if (seenGridOwners.has(tile)) addGridIssue('duplicate-grid-owner');
        seenGridOwners.add(tile);
        if (tile.destroyed === true) addGridIssue('destroyed-grid-owner');
        if (Array.isArray(tiles) && !tiles.includes(tile)) addGridIssue('grid-owner-missing-from-tiles');
        const tileRow = Number(tile.gridY);
        const tileColumn = Number(tile.gridX);
        if (
          Number.isInteger(tileRow)
          && Number.isInteger(tileColumn)
          && (tileRow !== rowIndex || tileColumn !== columnIndex)
        ) {
          addGridIssue('coordinate-mismatch');
        }
      });
    });
  }
  if (gridOwnedTiles) {
    // Drag owns one deliberate exception to strict grid residency: pickup clears
    // the source cell before the accepted drop calls merge(). Reconstruct that
    // exact participant only when its registry identity is still live, its own
    // cell is empty, and the destination still owns its canonical cell. Never
    // resurrect an arbitrary presentation-history orphan into board finality.
    const sourceRow = Number(src?.gridY);
    const sourceColumn = Number(src?.gridX);
    const destinationRow = Number(dst?.gridY);
    const destinationColumn = Number(dst?.gridX);
    const sourceCellIsDetached = Number.isInteger(sourceRow)
      && Number.isInteger(sourceColumn)
      && grid?.[sourceRow]?.[sourceColumn] == null;
    const destinationOwnsCell = Number.isInteger(destinationRow)
      && Number.isInteger(destinationColumn)
      && grid?.[destinationRow]?.[destinationColumn] === dst;
    const sourceOwnsCell = Number.isInteger(sourceRow)
      && Number.isInteger(sourceColumn)
      && grid?.[sourceRow]?.[sourceColumn] === src;
    const sourceIsLive = Array.isArray(tiles) && tiles.includes(src) && src?.destroyed !== true;
    const destinationIsLive = Array.isArray(tiles) && tiles.includes(dst) && dst?.destroyed !== true;
    if (!destinationOwnsCell || !destinationIsLive) {
      addGridIssue('merge-destination-ownership-invalid');
    }
    if (!sourceOwnsCell && !(sourceIsLive && sourceCellIsDetached && destinationOwnsCell)) {
      addGridIssue('merge-source-ownership-invalid');
    }
    if (
      !gridOwnedTiles.includes(src)
      && Array.isArray(tiles)
      && sourceIsLive
      && sourceCellIsDetached
      && destinationOwnsCell
    ) {
      gridOwnedTiles.push(src);
    }
  }
  const authoritativeGridStatus = gridOwnedTiles === null
    ? 'not-provided' as const
    : authoritativeGridIssues.length === 0
      ? 'valid' as const
      : 'invalid' as const;
  const safeTiles = uniqueTileRefs(
    authoritativeGridStatus === 'invalid'
      ? []
      : gridOwnedTiles ?? (Array.isArray(tiles) ? tiles.filter(Boolean) : []),
  );
  return {
    activeTilesBeforeMerge: safeTiles.filter(tileCountsAsFinalMergeActive),
    finalMergeBlockersBefore: safeTiles.filter((tile: any) => tileBlocksFinalMerge(tile, src, dst)),
    authoritativeGridStatus,
    authoritativeGridIssues,
  };
}

export function getFinalMergeSnapshot({
  activeTilesBeforeMerge,
  src,
  dst,
  effSum,
  finalMergeBlockersBefore = [],
  isWildMagnetMerge = false,
  hasTilesToPull = false,
}: FinalMergeSnapshotInput): FinalMergeSnapshot {
  const activeUnique = uniqueTileRefs(activeTilesBeforeMerge);
  const activePhysicalTileCount = activeUnique.reduce((sum, tile) => sum + stackDepthOf(tile), 0);
  const mergePhysicalTileCount = stackDepthOf(src) + stackDepthOf(dst);
  const activeSnapshotWasOnlyMergePair =
    (() => {
      return activeUnique.length === 2 &&
        activeUnique.includes(src) &&
        activeUnique.includes(dst);
    })();

  const hasOtherGameplayBlockers = finalMergeBlockersBefore.length > 0;
  const magnetWillPull = isWildMagnetMerge && hasTilesToPull;
  const srcIsWild = isWildLikeTile(src);
  const dstIsWild = isWildLikeTile(dst);
  const srcValue = src ? (src.value | 0) : 0;
  const dstValue = dst ? (dst.value | 0) : 0;
  const isFinalWildLastTwo =
    activeSnapshotWasOnlyMergePair &&
    !hasOtherGameplayBlockers &&
    !magnetWillPull &&
    (srcIsWild !== dstIsWild);

  const isFinalRegularMerge6 =
    activeSnapshotWasOnlyMergePair &&
    !hasOtherGameplayBlockers &&
    !srcIsWild &&
    !dstIsWild &&
    srcValue > 0 &&
    dstValue > 0 &&
    (srcValue + dstValue === 6 || (effSum | 0) === 6);

  return {
    activeSnapshotWasOnlyMergePair,
    activePhysicalTileCount,
    mergePhysicalTileCount,
    isFinalRegularMerge6,
    isFinalWildLastTwo,
    isFinalMerge: isFinalRegularMerge6 || isFinalWildLastTwo,
  };
}

export function shouldPlayJourneyClearedCelebration({
  isArcade,
  finalMergeSnapshot,
}: JourneyClearedCelebrationInput): boolean {
  return !isArcade && finalMergeSnapshot?.isFinalRegularMerge6 === true;
}
