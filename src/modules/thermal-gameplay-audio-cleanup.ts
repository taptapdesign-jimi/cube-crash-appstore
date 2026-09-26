import { isThermalAudioSuppressed } from '../utils/thermal-audio-isolation.js';
import { stopRegisteredSfxOwners } from './gameplay-sound-owner-registry.js';

export function stopThermalGameplayAudioFallbacks(isCurrent: () => boolean): Promise<void> {
  return stopRegisteredSfxOwners(() => isThermalAudioSuppressed() && isCurrent());
}
