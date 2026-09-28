export type BoardPopInStep = {
  tileIndex: number;
  enterDelay: number;
  amplitude: number;
  growDuration: number;
  compressDuration: number;
  reboundDuration: number;
  settleDuration: number;
  endTime: number;
};

/** Up to six compact group beats contained inside the actual random entry wave. */
export function createBoardPopInHapticSchedule(
  plan: ReadonlyArray<BoardPopInStep>,
  requestedPulseCount = 6,
): number[] {
  if (!plan.length) return [];
  const delays = plan.map((step) => step.enterDelay).sort((a, b) => a - b);
  const firstEntryBeat = delays[0];
  const lastEntryBeat = delays[delays.length - 1];
  const minimumGapSeconds = 0.05;
  const availablePulseSlots = Math.floor(
    Math.max(0, lastEntryBeat - firstEntryBeat) / minimumGapSeconds,
  ) + 1;
  const pulseCount = Math.min(
    Math.max(1, Math.floor(requestedPulseCount)),
    plan.length,
    availablePulseSlots,
  );
  if (pulseCount === 1) return [delays[0]];

  const schedule: number[] = [];
  for (let pulseIndex = 0; pulseIndex < pulseCount; pulseIndex++) {
    const quantileIndex = Math.round((pulseIndex * (delays.length - 1)) / (pulseCount - 1));
    const actualEntryBeat = delays[quantileIndex];
    const previousBeat = schedule[schedule.length - 1];
    schedule.push(previousBeat == null
      ? actualEntryBeat
      : Math.min(lastEntryBeat, Math.max(actualEntryBeat, previousBeat + minimumGapSeconds)));
  }
  return schedule;
}

type PopInPlanOptions = {
  maxEntryWave?: number;
  positions?: ReadonlyArray<{ x: number; y: number }>;
};

export function createBoardPopInPlan(
  tileCount: number,
  random: () => number = Math.random,
  options: PopInPlanOptions = {},
): BoardPopInStep[] {
  const count = Math.max(0, Math.floor(Number(tileCount) || 0));
  const order = Array.from({ length: count }, (_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  // Spatial order is computed once, never per frame. Prefer a location far
  // from BOTH preceding entries so a short overlap cannot form a local clump.
  const positions = options.positions;
  if (positions?.length === count && positions.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) {
    const width = Math.max(1, Math.max(...positions.map(p => p.x)) - Math.min(...positions.map(p => p.x)));
    const height = Math.max(1, Math.max(...positions.map(p => p.y)) - Math.min(...positions.map(p => p.y)));
    for (let i = 1; i < order.length; i++) {
      let best = i;
      let bestDistance = -1;
      for (let j = i; j < order.length; j++) {
        const candidate = positions[order[j]];
        let distance = Infinity;
        for (let k = Math.max(0, i - 2); k < i; k++) {
          const previous = positions[order[k]];
          distance = Math.min(distance,
            ((candidate.x - previous.x) / width) ** 2 + ((candidate.y - previous.y) / height) ** 2);
        }
        if (distance > bestDistance) { bestDistance = distance; best = j; }
      }
      [order[i], order[best]] = [order[best], order[i]];
    }
  }

  // Overlapping individual pops: even a full board starts within 360ms.
  // These are timeline offsets, not a promise about displayed frame cadence.
  const firstDelay = 0.02;
  const lastDelay = Math.max(firstDelay, Math.min(options.maxEntryWave ?? 0.38, 0.38));
  const stagger = count > 1 ? Math.min(0.018, (lastDelay - firstDelay) / (count - 1)) : 0;

  return order.map((tileIndex, index) => {
    const enterDelay = firstDelay + index * stagger;
    // Match the accepted spawnBounce scale rhythm in app-spawn/spawn-helpers.
    const amplitude = 1.08;
    const growDuration = 0.18;
    const compressDuration = 0.12;
    const reboundDuration = 0.12;
    const settleDuration = 0.14;
    return {
      tileIndex,
      enterDelay,
      amplitude,
      growDuration,
      compressDuration,
      reboundDuration,
      settleDuration,
      endTime: enterDelay + growDuration + compressDuration + reboundDuration + settleDuration,
    };
  });
}

/** Small expanded-grid start pose; the board/container itself never moves. */
export function createBoardPopInMeshOffsets(
  positions: ReadonlyArray<{ x: number; y: number }>,
  maxDistance: number,
): Array<{ x: number; y: number }> {
  if (!positions.length) return [];
  const centerX = (Math.min(...positions.map(p => p.x)) + Math.max(...positions.map(p => p.x))) / 2;
  const centerY = (Math.min(...positions.map(p => p.y)) + Math.max(...positions.map(p => p.y))) / 2;
  return positions.map(position => {
    const dx = (position.x - centerX) * 0.12;
    const dy = (position.y - centerY) * 0.12;
    const distance = Math.hypot(dx, dy);
    const factor = distance > 0 ? Math.min(1, Math.max(0, maxDistance) / distance) : 0;
    return { x: dx * factor, y: dy * factor };
  });
}
