type GridPosition = {
  gridX?: number;
  gridY?: number;
};

export type LaserGunShooter = 'left' | 'right';

export type LaserGunCrossfirePlan<T> = {
  target: T;
  shooter: LaserGunShooter;
};

/**
 * Keep the canonical first TNT target, then order the remaining targets for a
 * strict alternating crossfire. A right-side gun prefers the left half and a
 * left-side gun prefers the right half; target scarcity never changes the
 * canonical target count or invents replacements.
 */
export function planLaserGunCrossfireTargets<T>(
  targets: readonly T[],
  getX: (target: T) => number,
  viewportWidth: number,
  random: () => number = Math.random,
): LaserGunCrossfirePlan<T>[] {
  const remaining = [...targets];
  if (!remaining.length) return [];
  const width = Math.max(1, viewportWidth);
  const ratio = (target: T): number => getX(target) / width;
  const randomShooter = (): LaserGunShooter => (random() < 0.5 ? 'left' : 'right');
  const oppositeShooter = (target: T, single: boolean): LaserGunShooter => {
    const xRatio = ratio(target);
    if (single) return randomShooter();
    if (xRatio < 0.5) return 'right';
    if (xRatio > 0.5) return 'left';
    return randomShooter();
  };

  const first = remaining.shift()!;
  let shooter = oppositeShooter(first, targets.length === 1);
  const planned: LaserGunCrossfirePlan<T>[] = [{ target: first, shooter }];
  while (remaining.length) {
    shooter = shooter === 'left' ? 'right' : 'left';
    const preferredIndices = remaining
      .map((target, index) => ({ target, index, x: ratio(target) }))
      .filter(({ x }) => shooter === 'right' ? x < 0.5 : x > 0.5)
      .sort((a, b) => shooter === 'right'
        ? a.x - b.x || a.index - b.index
        : b.x - a.x || a.index - b.index);
    const centerIndex = remaining.findIndex((target) => ratio(target) === 0.5);
    const chosenIndex = preferredIndices[0]?.index ?? (centerIndex >= 0 ? centerIndex : 0);
    planned.push({ target: remaining.splice(chosenIndex, 1)[0], shooter });
  }
  return planned;
}

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
