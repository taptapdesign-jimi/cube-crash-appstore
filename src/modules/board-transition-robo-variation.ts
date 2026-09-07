export type RoboTravelDirection = -1 | 1;
export type RoboAirCombatSwaySample = { x: number; y: number; bank: number };
export type RoboFighterFinalePoint = Readonly<{
  progress: number;
  x: number;
  y: number;
  scale: number;
}>;
export type RoboFighterFinaleSample = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
};

export type RoboTransitionVariation = Readonly<{
  frontTravelDirection: RoboTravelDirection;
  walkerTravelDirection: RoboTravelDirection;
}>;

export function createRoboFighterFinaleExitDirections(
  random: () => number = Math.random,
): Readonly<{ left: RoboTravelDirection; right: RoboTravelDirection }> {
  const left: RoboTravelDirection = Number(random()) < 0.5 ? -1 : 1;
  return Object.freeze({ left, right: (left * -1) as RoboTravelDirection });
}

export function resolveRoboFighterOffscreenVisualCenterX(
  exitDirection: RoboTravelDirection,
  viewportWidth: number,
  renderedWidth: number,
  renderedHeight: number,
  edgeMargin = 18,
): number {
  // Half the sprite diagonal safely contains its rotated axis-aligned bounds,
  // so the finale can remain visible and rely on geometry instead of hiding.
  const rotatedBoundsRadius = Math.hypot(
    Math.max(0, renderedWidth),
    Math.max(0, renderedHeight),
  ) * 0.5;
  return exitDirection * (
    Math.max(1, viewportWidth) * 0.5
    + rotatedBoundsRadius
    + Math.max(0, edgeMargin)
  );
}

export function sampleRoboFighterFinalePath(
  points: readonly RoboFighterFinalePoint[],
  progress: number,
  startRotation: number,
  out: RoboFighterFinaleSample = { x: 0, y: 0, rotation: 0, scale: 1 },
): RoboFighterFinaleSample {
  if (points.length < 2) throw new Error('Robo fighter finale requires at least two points');
  const boundedProgress = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const sampleValue = (sampleProgress: number, key: 'x' | 'y' | 'scale'): number => {
    const boundedSample = Number.isFinite(sampleProgress)
      ? Math.max(0, Math.min(1, sampleProgress))
      : boundedProgress;
    let segmentIndex = 0;
    while (
      segmentIndex < points.length - 2
      && boundedSample >= points[segmentIndex + 1].progress
    ) segmentIndex += 1;
    const current = points[segmentIndex];
    const next = points[Math.min(points.length - 1, segmentIndex + 1)];
    const previous = points[Math.max(0, segmentIndex - 1)];
    const after = points[Math.min(points.length - 1, segmentIndex + 2)];
    const segmentDuration = Math.max(0.001, next.progress - current.progress);
    const local = Math.max(0, Math.min(1, (boundedSample - current.progress) / segmentDuration));
    const local2 = local * local;
    const local3 = local2 * local;
    const currentSpan = Math.max(0.001, next.progress - previous.progress);
    const nextSpan = Math.max(0.001, after.progress - current.progress);
    const currentTangent = ((next[key] - previous[key]) / currentSpan) * segmentDuration;
    const nextTangent = ((after[key] - current[key]) / nextSpan) * segmentDuration;
    return (2 * local3 - 3 * local2 + 1) * current[key]
      + (local3 - 2 * local2 + local) * currentTangent
      + (-2 * local3 + 3 * local2) * next[key]
      + (local3 - local2) * nextTangent;
  };
  if (boundedProgress === 0) {
    const first = points[0];
    out.x = first.x;
    out.y = first.y;
    out.scale = first.scale;
    out.rotation = startRotation;
    return out;
  }
  out.x = sampleValue(boundedProgress, 'x');
  out.y = sampleValue(boundedProgress, 'y');
  out.scale = sampleValue(boundedProgress, 'scale');
  const derivativeWindow = 0.003;
  const before = Math.max(0, boundedProgress - derivativeWindow);
  const after = Math.min(1, boundedProgress + derivativeWindow);
  const dx = sampleValue(after, 'x') - sampleValue(before, 'x');
  const dy = sampleValue(after, 'y') - sampleValue(before, 'y');
  const pathBank = Math.max(-14, Math.min(14, Math.atan2(dy, Math.max(0.001, Math.abs(dx))) * 180 / Math.PI));
  const rotationBlend = Math.min(1, boundedProgress / 0.12);
  const smoothRotationBlend = rotationBlend * rotationBlend * (3 - 2 * rotationBlend);
  out.rotation = startRotation + (pathBank - startRotation) * smoothRotationBlend;
  return out;
}

export type RoboAirCombatVariation = Readonly<{
  routeProfile: 'high-wide' | 'low-tight' | 'reverse-sweep';
  routeHorizontalScale: number;
  routeVerticalBias: number;
  routeVerticalScale: number;
  crossingPolarity: RoboTravelDirection;
  postBeamDirection: RoboTravelDirection;
  fighterEntryX: number;
  fighterJitterX: number;
  fighterJitterY: number;
  actionSwayX: number;
  actionSwayY: number;
  actionSwayCycles: number;
  beamOne: Readonly<{ launchXRatio: number; rotationOffset: number; travelMultiplier: number; scaleMultiplier: number; destinationXOffset: number }>;
  beamFour: Readonly<{ launchXRatio: number; rotationOffset: number; travelMultiplier: number; scaleMultiplier: number; destinationXOffset: number }>;
  exitPattern: 0 | 1 | 2;
  exitVerticalScale: number;
  exitDurationSeconds: number;
}>;

function boundedSample(random: () => number): number {
  const value = Number(random());
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

function between(random: () => number, min: number, max: number): number {
  return min + boundedSample(random) * (max - min);
}

export function createRoboAirCombatVariation(random: () => number = Math.random): RoboAirCombatVariation {
  const routeProfileIndex = Math.min(2, Math.floor(boundedSample(random) * 3));
  const routeProfiles = ['high-wide', 'low-tight', 'reverse-sweep'] as const;
  const exitPattern = Math.min(2, Math.floor(boundedSample(random) * 3)) as 0 | 1 | 2;
  return Object.freeze({
    routeProfile: routeProfiles[routeProfileIndex],
    routeHorizontalScale: routeProfileIndex === 0
      ? between(random, 1.15, 1.38)
      : routeProfileIndex === 1
        ? between(random, 0.82, 1.00)
        : between(random, 1.02, 1.28),
    routeVerticalBias: routeProfileIndex === 0
      ? between(random, -58, -28)
      : routeProfileIndex === 1
        ? between(random, 28, 58)
        : between(random, -20, 20),
    routeVerticalScale: routeProfileIndex === 0
      ? between(random, 1.05, 1.28)
      : routeProfileIndex === 1
        ? between(random, 0.72, 0.90)
        : between(random, 0.92, 1.12),
    crossingPolarity: routeProfileIndex === 2 ? -1 : 1,
    postBeamDirection: boundedSample(random) < 0.5 ? -1 : 1,
    fighterEntryX: between(random, 96, 132),
    fighterJitterX: between(random, 16, 30),
    fighterJitterY: between(random, 12, 24),
    actionSwayX: between(random, 24, 42),
    actionSwayY: between(random, 16, 30),
    actionSwayCycles: between(random, 1.10, 1.65),
    beamOne: Object.freeze({
      launchXRatio: between(random, 0.80, 0.94),
      rotationOffset: between(random, -14, 14),
      travelMultiplier: between(random, 1.18, 1.42),
      scaleMultiplier: between(random, 1.35, 1.68),
      destinationXOffset: between(random, -44, 44),
    }),
    beamFour: Object.freeze({
      launchXRatio: between(random, 0.06, 0.20),
      rotationOffset: between(random, -16, 16),
      travelMultiplier: between(random, 1.36, 1.66),
      scaleMultiplier: between(random, 1.44, 1.78),
      destinationXOffset: between(random, -52, 52),
    }),
    exitPattern,
    exitVerticalScale: between(random, 0.62, 1.12),
    exitDurationSeconds: between(random, 0.82, 1.08),
  });
}

export function sampleRoboAirCombatSway(
  progress: number,
  phaseOffset: number,
  direction: RoboTravelDirection,
  amplitudeX: number,
  amplitudeY: number,
  cycles: number,
  out: RoboAirCombatSwaySample = { x: 0, y: 0, bank: 0 },
): RoboAirCombatSwaySample {
  const boundedProgress = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  if (boundedProgress === 0 || boundedProgress === 1) {
    out.x = 0;
    out.y = 0;
    out.bank = 0;
    return out;
  }

  // A broad cinema-style weave sits on top of the authored spline. The envelope
  // preserves exact entry/exit points while two mismatched harmonics stop the
  // ships from reading as a synchronized or mechanically repeating pair.
  const envelope = Math.pow(Math.sin(Math.PI * boundedProgress), 0.72);
  const phase = phaseOffset + boundedProgress * Math.PI * 2 * cycles;
  const xWave = Math.sin(phase) * 0.72 + Math.sin(phase * 2.17 + 0.65) * 0.28;
  const yWave = Math.sin(phase * 1.31 + 1.05) * 0.68 + Math.sin(phase * 2.63 + 0.20) * 0.32;
  const bankWave = Math.sin(phase + Math.PI * 0.5) * 0.74
    + Math.sin(phase * 2.17 + 0.65) * 0.26;
  out.x = direction * amplitudeX * envelope * xWave;
  out.y = amplitudeY * envelope * yWave;
  out.bank = direction * 6 * envelope * bankWave;
  return out;
}

export function createRoboTransitionVariation(
  random: () => number = Math.random,
): RoboTransitionVariation {
  const sample = Number(random());
  const frontTravelDirection: RoboTravelDirection = Number.isFinite(sample) && sample >= 0.5 ? -1 : 1;

  return Object.freeze({
    frontTravelDirection,
    walkerTravelDirection: (frontTravelDirection * -1) as RoboTravelDirection,
  });
}
