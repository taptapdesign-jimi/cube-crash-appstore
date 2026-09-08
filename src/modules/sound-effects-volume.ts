export const SOUND_EFFECTS_MASTER_GAIN = 0.6;

export function applySoundEffectsMasterGain(ownerGain: number): number {
  if (!Number.isFinite(ownerGain)) return 0;
  return Math.max(0, Math.min(1, ownerGain)) * SOUND_EFFECTS_MASTER_GAIN;
}
