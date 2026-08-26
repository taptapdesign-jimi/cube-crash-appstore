type GridPosition = {
  gridX?: number;
  gridY?: number;
};

/** Select separated targets so consecutive TNT impacts remain visually distinct. */
export function selectSpatiallySeparatedTntTargets<T extends object>(
  candidates: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const remaining = [...candidates];
  const targetCount = Math.max(0, Math.min(Math.floor(count), remaining.length));
  if (targetCount === 0) return [];

  const firstIndex = Math.min(
    remaining.length - 1,
    Math.max(0, Math.floor(random() * remaining.length)),
  );
  const selected = [remaining.splice(firstIndex, 1)[0]];
  const coordinate = (value: number | undefined): number => (
    Number.isFinite(value) ? Number(value) : 0
  );
  const position = (candidate: T): GridPosition => candidate as T & GridPosition;

  while (selected.length < targetCount && remaining.length > 0) {
    let bestIndex = 0;
    let bestMinimumDistance = -1;
    remaining.forEach((candidate, index) => {
      const candidatePosition = position(candidate);
      const candidateX = coordinate(candidatePosition.gridX);
      const candidateY = coordinate(candidatePosition.gridY);
      const minimumDistance = selected.reduce((minimum, target) => {
        const targetPosition = position(target);
        const dx = candidateX - coordinate(targetPosition.gridX);
        const dy = candidateY - coordinate(targetPosition.gridY);
        return Math.min(minimum, dx * dx + dy * dy);
      }, Number.POSITIVE_INFINITY);
      if (minimumDistance > bestMinimumDistance) {
        bestMinimumDistance = minimumDistance;
        bestIndex = index;
      }
    });
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected;
}
