export type BoardPopInStep = {
  tileIndex: number;
  enterDelay: number;
  amplitude: number;
  growDuration: number;
  compressDuration: number;
  settleDuration: number;
  endTime: number;
};

type PopInPlanOptions = {
  maxEntryWave?: number;
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

  // Preserve the proven pre-scheduler rhythm exactly: a tiny progressive base,
  // large random overlap, and occasional negative bursts. The delays are
  // intentionally non-monotonic, so many cubes begin almost together instead
  // of reading as an orderly one-by-one sequence.
  const maxEntryWave = options.maxEntryWave ?? Number.POSITIVE_INFINITY;

  return order.map((tileIndex, index) => {
    const step = 0.020 + random() * 0.010;
    const jitter = random() * 0.18;
    const burst = random() < 0.22 ? -(random() * 0.16) : 0;
    const enterDelay = Math.min(maxEntryWave, Math.max(0, index * step * 0.55 + jitter + burst));
    const durationMultiplier = 0.55 + random() * 0.2;
    const amplitude = 1.08 + random() * 0.07;
    const growDuration = Math.max(0.1, (0.18 + random() * 0.08) * durationMultiplier);
    const compressDuration = Math.max(0.08, (0.12 + random() * 0.05) * durationMultiplier);
    const settleDuration = Math.max(0.08, (0.1 + random() * 0.06) * durationMultiplier);
    return {
      tileIndex,
      enterDelay,
      amplitude,
      growDuration,
      compressDuration,
      settleDuration,
      endTime: enterDelay + growDuration + compressDuration + settleDuration,
    };
  });
}
