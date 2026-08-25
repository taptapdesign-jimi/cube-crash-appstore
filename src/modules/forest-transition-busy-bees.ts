const TAU = Math.PI * 2;
export const FOREST_BUSY_BEE_DURATION_SCALE = 1 / 0.70;
export const FOREST_BUSY_BEE_RISE_SEPARATION_MULTIPLIER = 8;

export type ForestBusyBeePineDepth = 'behind-front-pines' | 'behind-rear-pines';
export type ForestBusyBeeOrigin = 'bottom';

export interface ForestBusyBeePlan {
  leftPercent: number;
  restViewportRatio: number;
  startOffsetX: number;
  startOffsetY: number;
  controlOneX: number;
  controlOneY: number;
  controlTwoX: number;
  controlTwoY: number;
  endOffsetX: number;
  endOffsetY: number;
  bounceDuration: number;
  crossDuration: number;
  wobblePhase: number;
  wobbleCycles: number;
  wobbleX: number;
  wobbleY: number;
  pineDepth: ForestBusyBeePineDepth;
  frontFenceHold: boolean;
  origin: ForestBusyBeeOrigin;
  initialScaleRatio: number;
  riseScaleRatio: number;
  loopsPine: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cubic(start: number, controlOne: number, controlTwo: number, end: number, progress: number): number {
  const inverse = 1 - progress;
  return inverse * inverse * inverse * start
    + 3 * inverse * inverse * progress * controlOne
    + 3 * inverse * progress * progress * controlTwo
    + progress * progress * progress * end;
}

/** Creates separated plans once; no randomness or allocation occurs per frame. */
export function createForestBusyBeePlans(
  count: number,
  containerWidth: number,
  viewportHeight = 844,
  random: () => number = Math.random,
): ForestBusyBeePlan[] {
  const widthScale = clamp(containerWidth / 390, 0.72, 1.4);

  return Array.from({ length: count }, (_, index) => {
    const columnCount = Math.min(7, Math.max(1, count));
    const column = index % columnCount;
    const row = Math.floor(index / columnCount);
    const columnProgress = columnCount <= 1 ? 0.5 : column / (columnCount - 1);
    const leftPercent = 3 + columnProgress * 79 + (row % 2 === 0 ? -1.2 : 1.2);
    const restViewportRatio = 0.24 + (row % 2) * 0.34 + random() * 0.07;
    const origin: ForestBusyBeeOrigin = 'bottom';
    const scaleProgress = count <= 1 ? 0.5 : index / (count - 1);
    const initialScaleRatio = clamp(0.58 + scaleProgress * 0.26 + (random() * 0.008 - 0.004), 0.56, 0.86);
    const riseScaleRatio = clamp(0.40 + random() * 0.48, 0.40, 0.88);
    const renderedHalfSize = 70 * initialScaleRatio * 0.5;
    const baseCenterX = (leftPercent / 100) * containerWidth + 35;
    const baseCenterY = restViewportRatio * viewportHeight;
    // Spread the complete flock across one launch row while preserving the
    // separate two-row rest layout. Every rendered bee begins fully below the
    // physical viewport; the sampler owns that exact pose from its first frame.
    const launchProgress = count <= 1 ? 0.5 : index / (count - 1);
    const launchCenterX = renderedHalfSize + launchProgress * Math.max(0, containerWidth - renderedHalfSize * 2);
    const startOffsetX = launchCenterX - baseCenterX;
    const startOffsetY = viewportHeight + 5 + renderedHalfSize - baseCenterY;
    const sweepDirection = random() < 0.5 ? -1 : 1;
    const endOffsetX = (random() * 2 - 1) * containerWidth * 0.10;
    const endOffsetY = (random() * 2 - 1) * viewportHeight * 0.055;
    const controlOneX = startOffsetX + (endOffsetX - startOffsetX) * 0.30
      + sweepDirection * (42 + random() * 54) * widthScale;
    const riseLane = index % 4;
    const riseLaneSeparationY = riseLane * 18 * FOREST_BUSY_BEE_RISE_SEPARATION_MULTIPLIER;
    const controlOneY = startOffsetY + (endOffsetY - startOffsetY) * 0.28
      - (34 + random() * 64) - riseLaneSeparationY;
    const controlTwoX = startOffsetX + (endOffsetX - startOffsetX) * 0.68
      - sweepDirection * (46 + random() * 68) * widthScale;
    const controlTwoY = startOffsetY + (endOffsetY - startOffsetY) * 0.70 + (random() * 70 - 35);
    return {
      leftPercent,
      restViewportRatio,
      startOffsetX,
      startOffsetY,
      controlOneX,
      controlOneY,
      controlTwoX,
      controlTwoY,
      endOffsetX,
      endOffsetY,
      bounceDuration: 0.44 + random() * 0.12,
      crossDuration: (1.02 + random() * 0.18) * FOREST_BUSY_BEE_DURATION_SCALE,
      wobblePhase: random() * TAU,
      wobbleCycles: 2.4 + random() * 1.8,
      wobbleX: (24 + random() * 34) * widthScale,
      wobbleY: 12 + random() * 20,
      pineDepth: index % 2 === 0 ? 'behind-front-pines' : 'behind-rear-pines',
      frontFenceHold: index % 5 === 0,
      origin,
      initialScaleRatio,
      riseScaleRatio,
      loopsPine: index % 3 !== 0,
    };
  });
}

/** Samples one continuous over-fence flight; wobble is zero at both endpoints. */
export function sampleForestBusyBeeCross(
  plan: ForestBusyBeePlan,
  progress: number,
  output: Float32Array,
): Float32Array {
  const boundedProgress = clamp(progress, 0, 1);
  const wobbleEnvelope = Math.sin(Math.PI * boundedProgress);
  const wobbleAngle = plan.wobblePhase + (boundedProgress * TAU * plan.wobbleCycles);
  output[0] = cubic(plan.startOffsetX, plan.controlOneX, plan.controlTwoX, plan.endOffsetX, boundedProgress)
    + Math.sin(wobbleAngle) * plan.wobbleX * wobbleEnvelope;
  output[1] = cubic(plan.startOffsetY, plan.controlOneY, plan.controlTwoY, plan.endOffsetY, boundedProgress)
    + Math.cos(wobbleAngle * 1.17) * plan.wobbleY * wobbleEnvelope;
  return output;
}

/** Keeps the visible birth bounce inside the same t0 owner as the flight. */
export function sampleForestBusyBeeScale(plan: ForestBusyBeePlan, progress: number): number {
  const boundedProgress = clamp(progress, 0, 1);
  const elapsedSeconds = boundedProgress * plan.crossDuration;
  const bounceProgress = clamp(elapsedSeconds / plan.bounceDuration, 0, 1);
  const smoothProgress = boundedProgress * boundedProgress * (3 - 2 * boundedProgress);
  const scaleDown = plan.initialScaleRatio
    + (plan.riseScaleRatio - plan.initialScaleRatio) * smoothProgress;
  const birthBounce = Math.sin(Math.PI * bounceProgress) * (1 - smoothProgress) * 0.08;
  return scaleDown + birthBounce;
}
