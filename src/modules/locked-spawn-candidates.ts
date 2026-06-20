export type SpawnCell = {
  c: number;
  r: number;
};

export function getLockedSpawnCandidates(
  tiles: any[],
  excludeCells: Set<string> = new Set(),
  preferCell?: SpawnCell
): any[] {
  const preferKey =
    preferCell && Number.isFinite(preferCell.c) && Number.isFinite(preferCell.r)
      ? `${preferCell.c},${preferCell.r}`
      : null;

  const candidates = (Array.isArray(tiles) ? tiles : []).filter((tile: any) => {
    if (!tile || tile.destroyed || !tile.locked) return false;
    if (typeof tile.gridX === 'number' && typeof tile.gridY === 'number') {
      const key = `${tile.gridX},${tile.gridY}`;
      if (excludeCells.has(key)) return false;
    }
    return true;
  });

  if (!preferKey) return candidates;

  return candidates.sort((a: any, b: any) => {
    const aAtPrefer =
      typeof a.gridX === 'number' &&
      typeof a.gridY === 'number' &&
      `${a.gridX},${a.gridY}` === preferKey
        ? 0
        : 1;
    const bAtPrefer =
      typeof b.gridX === 'number' &&
      typeof b.gridY === 'number' &&
      `${b.gridX},${b.gridY}` === preferKey
        ? 0
        : 1;
    return aAtPrefer - bAtPrefer;
  });
}
