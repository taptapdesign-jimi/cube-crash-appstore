export function resolveRegularMerge6SpawnCount(spawnMult: number): number {
  return Math.min(3, Math.max(2, (spawnMult || 0) - 1));
}
