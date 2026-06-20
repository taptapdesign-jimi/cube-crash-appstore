export type FinalResidualTarget = any;

export function collectFinalLockedResidualTargets(tileList: any[]): FinalResidualTarget[] {
  return (Array.isArray(tileList) ? tileList : []).filter((tile: any) => {
    if (!tile || tile.destroyed) return false;
    if (tile.locked) return true;
    return (tile.value | 0) <= 0 && !tile.special && tile.eventMode === 'none';
  });
}

export function collectFinalBoardTileResidualTargets(tileList: any[]): FinalResidualTarget[] {
  return (Array.isArray(tileList) ? tileList : []).filter((tile: any) => {
    if (!tile || tile.destroyed) return false;
    if (!tile.scale || typeof tile.alpha === 'undefined') return false;
    return true;
  });
}

export function collectFinalGhostResidualTargets(rows: any): FinalResidualTarget[] {
  const ghosts: FinalResidualTarget[] = [];
  if (!Array.isArray(rows)) return ghosts;

  rows.forEach((row: any[]) => {
    if (!Array.isArray(row)) return;
    row.forEach((ghost: any) => {
      if (!ghost || ghost.destroyed) return;
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
