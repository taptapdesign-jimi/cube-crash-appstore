export const TNT_MERGE_LIGHT_HAPTIC_DELAYS_MS = Object.freeze([450, 850] as const);

/**
 * A TNT-like finale already owns one leading heavy pulse. Only the first and
 * final committed bonus impacts add physical punctuation; middle impacts stay
 * visual/audio so one finale cannot restart the actuator for every cube.
 */
export function shouldPlayTntBonusImpactHaptic(index: number, totalImpacts: number): boolean {
  const safeTotal = Math.max(0, Math.trunc(totalImpacts));
  const safeIndex = Math.trunc(index);
  if (safeTotal <= 0 || safeIndex < 0 || safeIndex >= safeTotal) return false;
  return safeIndex === 0 || safeIndex === safeTotal - 1;
}
