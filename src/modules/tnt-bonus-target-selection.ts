type GridPosition = {
  gridX?: number;
  gridY?: number;
};

export type LaserGunShooter = 'left' | 'right';

export type LaserGunCrossfirePlan<T> = {
  target: T;
  shooter: LaserGunShooter;
};

export const LASERGUN_LEFT_MUZZLE_X_RATIO = 0.21;
export const LASERGUN_RIGHT_MUZZLE_X_RATIO = 0.79;
export const LASERGUN_MUZZLE_EDGE_INSET_MIN_PX = 72;
export const LASERGUN_MUZZLE_EDGE_INSET_MAX_PX = 84;
export const LASERGUN_PLANNER_NEAR_TIE_RATIO = 0.01;
export const LASERGUN_MAX_GUNS_PER_SIDE = 4;

type LaserGunPlannerCandidate<T> = {
  plan: LaserGunCrossfirePlan<T>[];
  minimumDistance: number;
  totalDistance: number;
};

export function getLaserGunPlannerMuzzleX(
  shooter: LaserGunShooter,
  viewportWidth: number,
): number {
  const width = Math.max(320, viewportWidth);
  const inset = Math.max(
    LASERGUN_MUZZLE_EDGE_INSET_MIN_PX,
    Math.min(LASERGUN_MUZZLE_EDGE_INSET_MAX_PX, width * LASERGUN_LEFT_MUZZLE_X_RATIO),
  );
  return shooter === 'left' ? inset : width - inset;
}

function getLaserGunHorizontalDistance(
  targetX: number,
  shooter: LaserGunShooter,
  viewportWidth: number,
): number {
  return Math.abs(targetX - getLaserGunPlannerMuzzleX(shooter, viewportWidth));
}

function permutations<T>(values: readonly T[]): T[][] {
  if (values.length <= 1) return [[...values]];
  return values.flatMap((value, index) => permutations([
    ...values.slice(0, index),
    ...values.slice(index + 1),
  ]).map((tail) => [value, ...tail]));
}

function getLaserGunSidePatterns(count: number): LaserGunShooter[][] {
  if (count <= 0) return [[]];
  return getLaserGunSidePatterns(count - 1).flatMap((prefix) => [
    [...prefix, 'left'],
    [...prefix, 'right'],
  ]);
}

function isStrictAlternation(plan: readonly LaserGunCrossfirePlan<unknown>[]): boolean {
  return plan.length > 2 && plan.slice(1).every(({ shooter }, index) => (
    shooter !== plan[index].shooter
  ));
}

/**
 * Keep the canonical first TNT target, then jointly choose the side pattern
 * and order of the remaining exact targets. Side capacity is deliberately not
 * balanced: a one-edge target cluster may use four guns from the opposite edge
 * rather than producing two unreadably short beams. Among equal geometry,
 * strict LRLR/RLRL alternation is rejected for a livelier switchback rhythm.
 * Geometry wins before variety: maximize the shortest horizontal muzzle run,
 * then the total run, and use randomness only among true/near ties.
 *
 * The planner never changes, duplicates, or invents gameplay targets.
 */
export function planLaserGunCrossfireTargets<T>(
  targets: readonly T[],
  getX: (target: T) => number,
  viewportWidth: number,
  random: () => number = Math.random,
): LaserGunCrossfirePlan<T>[] {
  if (!targets.length) return [];
  const width = Math.max(1, viewportWidth);
  const targetX = (target: T): number => {
    const x = getX(target);
    return Number.isFinite(x) ? x : width * 0.5;
  };

  if (targets.length === 1) {
    const target = targets[0];
    const leftDistance = getLaserGunHorizontalDistance(targetX(target), 'left', width);
    const rightDistance = getLaserGunHorizontalDistance(targetX(target), 'right', width);
    const tieEpsilon = Math.max(0.5, width * LASERGUN_PLANNER_NEAR_TIE_RATIO);
    const shooter = Math.abs(leftDistance - rightDistance) <= tieEpsilon
      ? (random() < 0.5 ? 'left' : 'right')
      : leftDistance > rightDistance ? 'left' : 'right';
    return [{ target, shooter }];
  }

  const first = targets[0];
  const orderedTails = permutations(targets.slice(1));
  const sidePatterns = getLaserGunSidePatterns(targets.length);
  const candidates: LaserGunPlannerCandidate<T>[] = [];

  sidePatterns.forEach((pattern) => {
    orderedTails.forEach((tail) => {
      const orderedTargets = [first, ...tail];
      const distances = orderedTargets.map((target, index) => (
        getLaserGunHorizontalDistance(targetX(target), pattern[index], width)
      ));
      candidates.push({
        plan: orderedTargets.map((target, index) => ({ target, shooter: pattern[index] })),
        minimumDistance: Math.min(...distances),
        totalDistance: distances.reduce((total, distance) => total + distance, 0),
      });
    });
  });

  const ranked = candidates.sort((a, b) => (
    b.minimumDistance - a.minimumDistance || b.totalDistance - a.totalDistance
  ));
  const best = ranked[0];
  if (!best) return [];

  const minimumTieEpsilon = Math.max(0.5, width * LASERGUN_PLANNER_NEAR_TIE_RATIO);
  const totalTieEpsilon = minimumTieEpsilon * targets.length;
  const nearBest = ranked.filter((candidate) => (
    best.minimumDistance - candidate.minimumDistance <= minimumTieEpsilon
    && best.totalDistance - candidate.totalDistance <= totalTieEpsilon
  ));
  const switchbacks = nearBest.filter((candidate) => !isStrictAlternation(candidate.plan));
  const selectable = switchbacks.length ? switchbacks : nearBest;
  if (selectable.length === 1) return selectable[0].plan;
  const randomIndex = Math.min(
    selectable.length - 1,
    Math.max(0, Math.floor(random() * selectable.length)),
  );
  return selectable[randomIndex].plan;
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
