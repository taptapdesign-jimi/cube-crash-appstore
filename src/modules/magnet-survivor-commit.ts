export type MagnetSurvivorCommitFailureReason =
  | 'invalid-survivor'
  | 'mutation-rejected'
  | 'commit-failed';

export type MagnetSurvivorCommitReceipt =
  | Readonly<{
      committed: true;
      tile: any;
      value: number;
      visualTailStarted: boolean;
      isVisualTailSettled: () => boolean;
    }>
  | Readonly<{
      committed: false;
      tile: any;
      reason: MagnetSurvivorCommitFailureReason;
      error?: unknown;
    }>;

export type MagnetSurvivorCommitInput = {
  tile: any;
  value: number;
  grid: any[][] | null | undefined;
  board: any;
  tileSize: number;
  gap: number;
  commitMutation?: () => boolean;
  stopSpecialIdle: (tile: any) => void;
  resetToNormal: (tile: any) => void;
  collapseStack: (tile: any) => void;
  killTweens?: (target: any) => void;
  setValueImmediate: (tile: any, value: number) => void;
  syncZIndex: (tile: any, board: any) => void;
  bindToTile: (tile: any) => void;
  refreshShadow?: (tile: any) => void;
  fixHoverAnchor?: (tile: any) => void;
  startVisualTail?: (
    tile: any,
    onComplete: () => void,
    onInterrupt: () => void,
  ) => void;
  removeOnFailure: (tile: any) => void;
};

function setScale(target: any, x: number, y: number): void {
  if (target?.scale?.set) target.scale.set(x, y);
  else if (target?.scale) {
    target.scale.x = x;
    target.scale.y = y;
  }
}

function normalizeRegularInputHost(tile: any): void {
  const host = tile?.rotG;
  if (!host || host === tile || host.destroyed) return;
  host.eventMode = 'none';
  host.interactive = false;
  host.interactiveChildren = false;
  host.cursor = 'default';
  host.hitArea = null;
}

function normalizeCanonicalVisual(tile: any, tileSize: number, gap: number): void {
  const c = tile.gridX | 0;
  const r = tile.gridY | 0;
  const canonicalX = c * (tileSize + gap) + tileSize / 2;
  const canonicalY = r * (tileSize + gap) + tileSize / 2;

  tile.x = canonicalX;
  tile.y = canonicalY;
  tile.targetX = canonicalX;
  tile.targetY = canonicalY;
  tile.rotation = 0;
  setScale(tile, 1, 1);

  if (tile.rotG) {
    tile.rotG.position?.set?.(
      Number.isFinite(tile.rotG.pivot?.x) ? tile.rotG.pivot.x : 0,
      Number.isFinite(tile.rotG.pivot?.y) ? tile.rotG.pivot.y : -tileSize / 2,
    );
    tile.rotG.rotation = 0;
    setScale(tile.rotG, 1, 1);
  }
  if (tile.base) {
    tile.base.anchor?.set?.(0.5, 0.5);
    tile.base.position?.set?.(0, 0);
    tile.base.rotation = 0;
    setScale(tile.base, 1, 1);
    tile.base.width = tileSize;
    tile.base.height = tileSize;
  }
  if (tile.shadow) {
    tile.shadow.rotation = 0;
    setScale(tile.shadow, 1, 1);
  }
}

function settleVisualTail(tile: any): void {
  if (!tile || tile.destroyed) return;
  tile.visible = true;
  tile.alpha = 1;
  tile.eventMode = 'static';
  tile.interactive = true;
  tile.interactiveChildren = false;
  tile.cursor = 'pointer';
  setScale(tile, 1, 1);
  if (tile.rotG) {
    tile.rotG.rotation = 0;
    tile.rotG.alpha = 1;
  }
  if (tile.base) {
    tile.base.visible = true;
    tile.base.alpha = 1;
  }
}

/**
 * Atomically converts the consumed Magnet-family holder into one canonical
 * regular die. Model, face, hit ownership and pointer binding are committed
 * while hidden; the decorative bounce cannot decide whether the die is usable.
 */
export function commitMagnetSurvivor({
  tile,
  value,
  grid,
  board,
  tileSize,
  gap,
  commitMutation,
  stopSpecialIdle,
  resetToNormal,
  collapseStack,
  killTweens,
  setValueImmediate,
  syncZIndex,
  bindToTile,
  refreshShadow,
  fixHoverAnchor,
  startVisualTail,
  removeOnFailure,
}: MagnetSurvivorCommitInput): MagnetSurvivorCommitReceipt {
  if (!tile || tile.destroyed || !Number.isFinite(tile.gridX) || !Number.isFinite(tile.gridY)) {
    return { committed: false, tile, reason: 'invalid-survivor' };
  }

  let mutationCommitted = false;
  try {
    if (commitMutation && commitMutation() !== true) {
      try { removeOnFailure(tile); } catch {}
      return { committed: false, tile, reason: 'mutation-rejected' };
    }
    mutationCommitted = true;

    // This order is deliberate: an animated Special owner must lose the right
    // to repaint tile.base before registry identity is cleared or regular art is
    // synchronously committed.
    stopSpecialIdle(tile);
    resetToNormal(tile);
    // The container survives, but the consumed gameplay die does not. The
    // immutable merge receipt must observe this replacement as a new die.
    delete tile._ccGameplayDieId;
    collapseStack(tile);

    const c = tile.gridX | 0;
    const r = tile.gridY | 0;
    const currentCellOwner = grid?.[r]?.[c];
    if (currentCellOwner && currentCellOwner !== tile) {
      throw new Error('Magnet survivor cell is owned by another tile');
    }
    if (grid?.[r]) grid[r][c] = tile;

    [tile, tile.scale, tile.rotG, tile.rotG?.scale, tile.base, tile.base?.scale]
      .forEach((target) => {
        if (target) killTweens?.(target);
      });
    normalizeCanonicalVisual(tile, tileSize, gap);
    normalizeRegularInputHost(tile);

    delete tile._magnetMerge6Hidden;
    tile.locked = false;
    tile.visible = false;
    tile.alpha = 0;
    tile.eventMode = 'none';
    tile.interactive = false;
    tile.cursor = 'default';

    // Unlike setValue(), this must paint in the same transaction. A deferred
    // RAF would expose the old Spaceship/Honey/Bottle face after reveal.
    setValueImmediate(tile, value);
    refreshShadow?.(tile);
    syncZIndex(tile, board);
    fixHoverAnchor?.(tile);

    if (typeof bindToTile !== 'function') {
      throw new Error('Magnet survivor has no pointer binding owner');
    }
    bindToTile(tile);
    normalizeRegularInputHost(tile);

    if (tile.overlay) {
      tile.overlay.visible = false;
      tile.overlay.alpha = 1;
    }
    if (tile.pips) {
      tile.pips.visible = true;
      tile.pips.alpha = 1;
    }
    if (tile.num) tile.num.alpha = 1;
    settleVisualTail(tile);

    let visualTailSettled = !startVisualTail;
    const finishVisualTail = () => {
      if (visualTailSettled) return;
      visualTailSettled = true;
      settleVisualTail(tile);
    };
    let visualTailStarted = false;
    if (startVisualTail) {
      try {
        startVisualTail(tile, finishVisualTail, finishVisualTail);
        visualTailStarted = true;
      } catch {
        finishVisualTail();
      }
    }

    return {
      committed: true,
      tile,
      value,
      visualTailStarted,
      isVisualTailSettled: () => visualTailSettled,
    };
  } catch (error) {
    try { removeOnFailure(tile); } catch {}
    return {
      committed: false,
      tile,
      reason: mutationCommitted ? 'commit-failed' : 'mutation-rejected',
      error,
    };
  }
}
