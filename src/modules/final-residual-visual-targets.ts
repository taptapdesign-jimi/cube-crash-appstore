export type FinalResidualTarget = any;

export function collectFinalLockedResidualTargets(tileList: any[]): FinalResidualTarget[] {
  return (Array.isArray(tileList) ? tileList : []).filter((tile: any) => {
    if (!tile || tile.destroyed) return false;
    if (tile.locked) return true;
    return (tile.value | 0) <= 0 && !tile.special && tile.eventMode === 'none';
  });
}

export function collectFinalBoardTileResidualTargets(tileList: any[]): FinalResidualTarget[] {
  const targets: FinalResidualTarget[] = [];

  (Array.isArray(tileList) ? tileList : []).forEach((tile: any) => {
    if (!isFinalResidualDisplayTarget(tile)) return;
    if (!targets.includes(tile)) targets.push(tile);

    const placeholder = tile?._placeholderHolder;
    if (isFinalResidualDisplayTarget(placeholder) && !targets.includes(placeholder)) {
      targets.push(placeholder);
    }
  });

  return targets;
}

export function isFinalBoardTileResidueCandidate(target: any): boolean {
  if (!target || target.destroyed || !target.scale || typeof target.alpha === 'undefined') return false;
  const value = target.value | 0;
  const special = typeof target.special === 'string' ? target.special : '';
  return value === 6 ||
    target._isLastMerge === true ||
    target._wasWildMagnetMerge6 === true ||
    target._magnetMerge6Hidden === true ||
    special === 'wild-tnt';
}

export function collectOrphanFinalBoardTileResidualTargets({
  root,
  knownTiles = [],
  maxDepth = 2,
}: {
  root: any;
  knownTiles?: any[];
  maxDepth?: number;
}): FinalResidualTarget[] {
  const targets: FinalResidualTarget[] = [];
  const known = new Set(Array.isArray(knownTiles) ? knownTiles : []);

  const scan = (container: any, depth: number = 0) => {
    if (!container || depth > maxDepth) return;
    const children = Array.isArray(container.children) ? container.children : [];
    children.forEach((child: any) => {
      if (!child || known.has(child)) return;
      if (isFinalBoardTileResidueCandidate(child) && !targets.includes(child)) {
        targets.push(child);
      }
      if (child?.children?.length) scan(child, depth + 1);
    });
  };

  scan(root, 0);
  return targets;
}

function isFinalResidualDisplayTarget(target: any): boolean {
  if (!target || target.destroyed) return false;
  if (!target.scale || typeof target.alpha === 'undefined') return false;
  return true;
}

function isCurrentlyHiddenTarget(target: any): boolean {
  if (!target) return true;
  if (target.visible === false || target.renderable === false) return true;
  if (typeof target.alpha === 'number' && target.alpha <= 0.01) return true;
  return false;
}

export function collectFinalGhostResidualTargets(rows: any): FinalResidualTarget[] {
  const ghosts: FinalResidualTarget[] = [];
  if (!Array.isArray(rows)) return ghosts;

  rows.forEach((row: any[]) => {
    if (!Array.isArray(row)) return;
    row.forEach((ghost: any) => {
      if (!ghost || ghost.destroyed) return;
      if (isCurrentlyHiddenTarget(ghost)) return;
      if (ghosts.includes(ghost)) return;
      ghosts.push(ghost);
    });
  });

  return ghosts;
}

export function prepareFinalResidualTargets(targets: FinalResidualTarget[]): FinalResidualTarget[] {
  const prepared: FinalResidualTarget[] = [];
  targets.forEach((target: any) => {
    if (!target || target.destroyed || !target.scale || typeof target.alpha === 'undefined') return;
    if (prepared.includes(target)) return;
    if (isCurrentlyHiddenTarget(target)) {
      try {
        target.visible = false;
        target.renderable = false;
        target.alpha = 0;
        target.eventMode = 'none';
      } catch {}
      return;
    }
    if ((target.value | 0) === 6 || target._ccHideFinalMergeResultVisual === true) {
      try {
        target.visible = false;
        target.renderable = false;
        target.alpha = 0;
        target.eventMode = 'none';
        target.stackG?.destroy?.({ children: true });
        target.stackG = null;
      } catch {}
      return;
    }

    try {
      target.visible = true;
      target.renderable = true;
      target.alpha = Math.max(0.22, Number.isFinite(target.alpha) ? target.alpha : 1);
      if (target.eventMode !== undefined) target.eventMode = 'none';
      if (!Number.isFinite(target.scale.x) || target.scale.x <= 0.01) target.scale.x = 1;
      if (!Number.isFinite(target.scale.y) || target.scale.y <= 0.01) target.scale.y = 1;
    } catch {}

    prepared.push(target);
  });

  return prepared;
}

export function cleanupFinalGhostResidualTargets(ghosts: FinalResidualTarget[]): void {
  ghosts.forEach((ghost: any) => {
    try {
      ghost.visible = false;
      ghost.alpha = 1;
      ghost.scale?.set?.(1);
    } catch {}
  });
}
