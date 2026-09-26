import { stopAllDecodedGameplayVoices } from './gameplay-audio-buffer-player.js';
import { stopRegisteredSfxOwners } from './gameplay-sound-owner-registry.js';

let settingGeneration = 0;

/** Call after committing every Sounds toggle, including ON, to invalidate an
 * older asynchronous OFF sweep. Settings storage remains with its UI owner. */
export function applyGameSoundsSettingToAudio(enabled: boolean): Promise<void> {
  const generation = ++settingGeneration;
  if (enabled) return Promise.resolve();
  // Retire queued starts synchronously, before lazy media-owner imports settle.
  stopAllDecodedGameplayVoices();
  return stopRegisteredSfxOwners(() => generation === settingGeneration
    && typeof window !== 'undefined'
    && (window as any)._settings?.gameSoundsEnabled === false);
}
