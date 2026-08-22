export type DragTrailPerformanceProfile = {
  regularSpacingPx: number;
  regularMaxBurstsPerFrame: number;
  regularParticles: { fast: number; slow: number };
  wildSpacingPx: number;
  wildMaxBurstsPerFrame: number;
  wildParticles: { fast: number; slow: number };
};

const DESKTOP_PROFILE: DragTrailPerformanceProfile = {
  regularSpacingPx: 16,
  regularMaxBurstsPerFrame: 3,
  regularParticles: { fast: 9, slow: 7 },
  wildSpacingPx: 14,
  wildMaxBurstsPerFrame: 3,
  wildParticles: { fast: 4, slow: 3 },
};

const TOUCH_PROFILE: DragTrailPerformanceProfile = {
  regularSpacingPx: 28,
  regularMaxBurstsPerFrame: 1,
  regularParticles: { fast: 4, slow: 3 },
  wildSpacingPx: 26,
  wildMaxBurstsPerFrame: 1,
  wildParticles: { fast: 2, slow: 1 },
};

const TOUCH_REDUCED_FX_PROFILE: DragTrailPerformanceProfile = {
  regularSpacingPx: 34,
  regularMaxBurstsPerFrame: 1,
  regularParticles: { fast: 3, slow: 2 },
  wildSpacingPx: 32,
  wildMaxBurstsPerFrame: 1,
  wildParticles: { fast: 1, slow: 1 },
};

export function getDragTrailPerformanceProfile(
  touchMode: boolean,
  reducedFx = false,
): DragTrailPerformanceProfile {
  if (!touchMode) return DESKTOP_PROFILE;
  return reducedFx ? TOUCH_REDUCED_FX_PROFILE : TOUCH_PROFILE;
}
