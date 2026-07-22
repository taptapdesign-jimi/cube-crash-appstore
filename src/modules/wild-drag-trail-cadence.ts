export type TrailPoint = {
  x: number;
  y: number;
  speedPxPerMs: number;
};

export type WildDragTrailCadenceState = {
  initialized: boolean;
  x: number;
  y: number;
  atMs: number;
  distanceCarry: number;
};

export type WildDragTrailCadenceOptions = {
  spacingPx: number;
  maxBurstsPerFrame: number;
};

export function createWildDragTrailCadenceState(): WildDragTrailCadenceState {
  return {
    initialized: false,
    x: 0,
    y: 0,
    atMs: 0,
    distanceCarry: 0,
  };
}

export function resetWildDragTrailCadence(
  state: WildDragTrailCadenceState,
  x?: number,
  y?: number,
  atMs?: number,
): void {
  const hasOrigin = Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(atMs);
  state.initialized = hasOrigin;
  state.x = hasOrigin ? Number(x) : 0;
  state.y = hasOrigin ? Number(y) : 0;
  state.atMs = hasOrigin ? Number(atMs) : 0;
  state.distanceCarry = 0;
}

export function consumeWildDragTrailPoints(
  state: WildDragTrailCadenceState,
  x: number,
  y: number,
  atMs: number,
  options: WildDragTrailCadenceOptions,
): TrailPoint[] {
  if (![x, y, atMs].every(Number.isFinite)) return [];

  const spacingPx = Math.max(4, Number(options.spacingPx) || 4);
  const maxBurstsPerFrame = Math.max(1, Math.floor(Number(options.maxBurstsPerFrame) || 1));
  if (!state.initialized) {
    resetWildDragTrailCadence(state, x, y, atMs);
    return [];
  }

  const startX = state.x;
  const startY = state.y;
  const dx = x - startX;
  const dy = y - startY;
  const segmentDistance = Math.hypot(dx, dy);
  const dtMs = Math.max(1, atMs - state.atMs);

  state.x = x;
  state.y = y;
  state.atMs = atMs;

  if (segmentDistance < 0.01) return [];

  const totalDistance = state.distanceCarry + segmentDistance;
  const availableBursts = Math.floor(totalDistance / spacingPx);
  if (availableBursts <= 0) {
    state.distanceCarry = totalDistance;
    return [];
  }

  const burstCount = Math.min(availableBursts, maxBurstsPerFrame);
  const firstDistanceOnSegment = Math.max(0, spacingPx - state.distanceCarry);
  const speedPxPerMs = segmentDistance / dtMs;
  const points: TrailPoint[] = [];

  for (let index = 0; index < burstCount; index += 1) {
    const distanceOnSegment = Math.min(segmentDistance, firstDistanceOnSegment + index * spacingPx);
    const ratio = segmentDistance > 0 ? distanceOnSegment / segmentDistance : 1;
    points.push({
      x: startX + dx * ratio,
      y: startY + dy * ratio,
      speedPxPerMs,
    });
  }

  // Drop excess backlog after a very large coalesced pointer jump. Keeping only
  // the modulo preserves even spacing without producing catch-up bursts later.
  state.distanceCarry = totalDistance % spacingPx;
  return points;
}
