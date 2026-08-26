export type WildMeterDrainGeometry = {
  left: number;
  width: number;
};

export function clampWildMeterRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(1, ratio));
}

export function getWildMeterDrainGeometry(
  maxWidth: number,
  drainProgress: number,
): WildMeterDrainGeometry {
  const width = Math.max(0, Number.isFinite(maxWidth) ? maxWidth : 0);
  const progress = clampWildMeterRatio(drainProgress);
  const left = width * progress;
  return { left, width: Math.max(0, width - left) };
}

export function getWildMeterRefillWidth(maxWidth: number, ratio: number): number {
  const width = Math.max(0, Number.isFinite(maxWidth) ? maxWidth : 0);
  return width * clampWildMeterRatio(ratio);
}
