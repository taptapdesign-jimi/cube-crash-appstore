export type BoardPopInStep = {
  preset: BoardPopInPreset;
  tileIndex: number;
  enterDelay: number;
  amplitude: number;
  growDuration: number;
  compressDuration: number;
  reboundDuration: number;
  settleDuration: number;
  endTime: number;
  startOffsetX: number;
  startOffsetY: number;
  startRotation: number;
};

export type BoardPopInPreset = 'inward' | 'outward' | 'diagonal' | 'burst';

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
  preset?: BoardPopInPreset;
  maxOffset?: number;
};

const POP_IN_PRESETS: readonly BoardPopInPreset[] = ['inward', 'outward', 'diagonal', 'burst'];

function clampUnit(value: number): number {
  return Math.max(0, Math.min(0.999999, Number.isFinite(value) ? value : 0));
}

export function createBoardPopInPlan(
  tileCount: number,
  random: () => number = Math.random,
  options: PopInPlanOptions = {},
): BoardPopInStep[] {
  const count = Math.max(0, Math.floor(Number(tileCount) || 0));
  const order = Array.from({ length: count }, (_, index) => index);
  const preset = options.preset ?? POP_IN_PRESETS[Math.floor(clampUnit(random()) * POP_IN_PRESETS.length)];
  const selectedCorner = Math.floor(clampUnit(random()) * 4);

  const positions = options.positions;
  if (positions?.length === count && positions.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) {
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const cornerX = selectedCorner % 2 === 0 ? minX : maxX;
    const cornerY = selectedCorner < 2 ? minY : maxY;
    const score = (index: number) => {
      const point = positions[index];
      if (preset === 'diagonal') return Math.abs(point.x - cornerX) + Math.abs(point.y - cornerY);
      const distance = Math.hypot(point.x - centerX, point.y - centerY);
      return preset === 'inward' ? -distance : distance;
    };
    order.sort((a, b) => score(a) - score(b) || a - b);
  } else {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(clampUnit(random()) * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }

  // Overlapping individual pops: even a full board starts within 360ms.
  // These are timeline offsets, not a promise about displayed frame cadence.
  const firstDelay = 0.02;
  const lastDelay = Math.max(firstDelay, Math.min(options.maxEntryWave ?? 0.38, 0.38));
  const stagger = count > 1 ? Math.min(0.018, (lastDelay - firstDelay) / (count - 1)) : 0;

  const maxOffset = Math.max(0, options.maxOffset ?? 40);
  const centerX = positions?.length ? (Math.min(...positions.map(p => p.x)) + Math.max(...positions.map(p => p.x))) / 2 : 0;
  const centerY = positions?.length ? (Math.min(...positions.map(p => p.y)) + Math.max(...positions.map(p => p.y))) / 2 : 0;
  const maxRadius = positions?.length
    ? Math.max(1, ...positions.map(p => Math.hypot(p.x - centerX, p.y - centerY)))
    : 1;

  return order.map((tileIndex, index) => {
    const enterDelay = firstDelay + index * stagger;
    // Match the accepted spawnBounce scale rhythm in app-spawn/spawn-helpers.
    const amplitude = 1.08;
    const growDuration = 0.18;
    const compressDuration = 0.12;
    const reboundDuration = 0.12;
    const settleDuration = 0.14;
    const point = positions?.[tileIndex];
    const radialX = point ? (point.x - centerX) / maxRadius : 0;
    const radialY = point ? (point.y - centerY) / maxRadius : 0;
    const direction = preset === 'inward' ? 1 : preset === 'outward' || preset === 'burst' ? -1 : 0;
    const diagonalSignX = selectedCorner % 2 === 0 ? -1 : 1;
    const diagonalSignY = selectedCorner < 2 ? -1 : 1;
    const offsetScale = preset === 'burst' ? 0.72 : preset === 'outward' ? 0.58 : 1;
    const startOffsetX = preset === 'diagonal'
      ? diagonalSignX * maxOffset * 0.52
      : radialX * maxOffset * direction * offsetScale;
    const startOffsetY = preset === 'diagonal'
      ? diagonalSignY * maxOffset * 0.52
      : radialY * maxOffset * direction * offsetScale;
    const rotationLimit = preset === 'burst' ? 8 : 6;
    const startRotation = ((clampUnit(random()) * 2) - 1) * rotationLimit * (Math.PI / 180);
    return {
      preset,
      tileIndex,
      enterDelay,
      amplitude,
      growDuration,
      compressDuration,
      reboundDuration,
      settleDuration,
      endTime: enterDelay + growDuration + compressDuration + reboundDuration + settleDuration,
      startOffsetX,
      startOffsetY,
      startRotation,
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
