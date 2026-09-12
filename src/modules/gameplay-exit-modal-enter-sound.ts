import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import { playDecodedGameplaySound, preloadDecodedGameplaySounds, stopDecodedGameplayVoices } from './gameplay-audio-buffer-player.ts';

export const GAMEPLAY_EXIT_MODAL_ENTER_SOUND_SOURCE = './assets/sound/UI /modal/modal enter.wav';
export const GAMEPLAY_EXIT_MODAL_ENTER_SOUND_BASE_VOLUME = 1;
export const GAMEPLAY_EXIT_MODAL_ENTER_SOUND_VOLUME = applySoundEffectsMasterGain(1);
const VOICE_ID = 'gameplay-exit-modal-enter';

export function preloadGameplayExitModalEnterSound(): boolean {
  if ((window as any)._settings?.gameSoundsEnabled !== true) return false;
  return preloadDecodedGameplaySounds([GAMEPLAY_EXIT_MODAL_ENTER_SOUND_SOURCE]);
}

export function playGameplayExitModalEnterSound(): boolean {
  if ((window as any)._settings?.gameSoundsEnabled !== true) return false;
  stopGameplayExitModalEnterSound();
  return playDecodedGameplaySound(GAMEPLAY_EXIT_MODAL_ENTER_SOUND_SOURCE, {
    voiceId: VOICE_ID,
    volume: GAMEPLAY_EXIT_MODAL_ENTER_SOUND_VOLUME,
  }) !== 'unavailable';
}

export function stopGameplayExitModalEnterSound(): void {
  stopDecodedGameplayVoices([VOICE_ID]);
}
