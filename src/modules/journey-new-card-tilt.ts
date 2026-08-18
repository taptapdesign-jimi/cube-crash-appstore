export interface JourneyNewCardTiltProfile {
  interimRestRotationDeg: number;
  interimRestRotateXDeg: number;
  interimRestRotateYDeg: number;
  interimExitRotationDeg: number;
  interimExitRotateXDeg: number;
  interimExitRotateYDeg: number;
  unlockedEntryRotationDeg: number;
  unlockedEntryRotateXDeg: number;
  unlockedEntryRotateYDeg: number;
  unlockedRestRotationDeg: number;
  unlockedRestRotateXDeg: number;
  unlockedRestRotateYDeg: number;
  unlockedExitRotationDeg: number;
  unlockedExitRotateXDeg: number;
  unlockedExitRotateYDeg: number;
}

function sampleUnit(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
}

/**
 * Gives the two New Reward card faces one coordinated Journey-modal-style
 * handoff. The large transition tilts never exceed 15deg; the unlocked card
 * settles into the gentler 4.75–6.25deg range used by the detail-card modal.
 */
export function createJourneyNewCardTiltProfile(
  random: () => number = Math.random,
): JourneyNewCardTiltProfile {
  const interimDirection = sampleUnit(random) < 0.5 ? -1 : 1;
  const interimRestMagnitude = 4.75 + sampleUnit(random) * 1.5;
  const interimRestDepthMagnitude = 4 + sampleUnit(random) * 3;
  const interimMagnitude = 9 + sampleUnit(random) * 6;
  const unlockedDirection = interimDirection * -1;
  const unlockedEntryMagnitude = 9 + sampleUnit(random) * 6;
  const unlockedRestMagnitude = 4.75 + sampleUnit(random) * 1.5;
  const unlockedRestDepthMagnitude = 3 + sampleUnit(random) * 3;
  const exitMagnitude = 9 + sampleUnit(random) * 6;

  return {
    interimRestRotationDeg: Number((interimDirection * interimRestMagnitude).toFixed(2)),
    interimRestRotateXDeg: Number((-3 - sampleUnit(random) * 3).toFixed(2)),
    interimRestRotateYDeg: Number((interimDirection * interimRestDepthMagnitude).toFixed(2)),
    interimExitRotationDeg: Number((interimDirection * interimMagnitude).toFixed(2)),
    interimExitRotateXDeg: Number((-9 - sampleUnit(random) * 6).toFixed(2)),
    interimExitRotateYDeg: Number((interimDirection * interimMagnitude).toFixed(2)),
    unlockedEntryRotationDeg: Number((unlockedDirection * unlockedEntryMagnitude).toFixed(2)),
    unlockedEntryRotateXDeg: Number((9 + sampleUnit(random) * 6).toFixed(2)),
    unlockedEntryRotateYDeg: Number((unlockedDirection * unlockedEntryMagnitude).toFixed(2)),
    unlockedRestRotationDeg: Number((unlockedDirection * unlockedRestMagnitude).toFixed(2)),
    unlockedRestRotateXDeg: Number((2 + sampleUnit(random) * 2).toFixed(2)),
    unlockedRestRotateYDeg: Number((unlockedDirection * unlockedRestDepthMagnitude).toFixed(2)),
    unlockedExitRotationDeg: Number((unlockedDirection * exitMagnitude).toFixed(2)),
    unlockedExitRotateXDeg: Number((-9 - sampleUnit(random) * 6).toFixed(2)),
    unlockedExitRotateYDeg: Number((unlockedDirection * exitMagnitude).toFixed(2)),
  };
}
