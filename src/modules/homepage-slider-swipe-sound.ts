import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import { playDecodedGameplaySound, preloadDecodedGameplaySounds, stopDecodedGameplayVoices } from './gameplay-audio-buffer-player.ts';

export const HOMEPAGE_SLIDER_SWIPE_SOUND_SOURCE = './assets/sound/UI /sliders/super swoosh.mp3';
export const HOMEPAGE_SLIDER_SWIPE_SOUND_BASE_VOLUME = 0.5;
export const HOMEPAGE_SLIDER_SWIPE_SOUND_VOLUME = applySoundEffectsMasterGain(
  HOMEPAGE_SLIDER_SWIPE_SOUND_BASE_VOLUME,
);
const VOICE_ID = 'homepage-slider-super-swoosh';

export function preloadHomepageSliderSwipeSound(): boolean {
  if ((window as any)._settings?.gameSoundsEnabled !== true) return false;
  return preloadDecodedGameplaySounds([HOMEPAGE_SLIDER_SWIPE_SOUND_SOURCE]);
}

export function playHomepageSliderSwipeSound(): boolean {
  if ((window as any)._settings?.gameSoundsEnabled !== true) return false;
  stopHomepageSliderSwipeSound();
  return playDecodedGameplaySound(HOMEPAGE_SLIDER_SWIPE_SOUND_SOURCE, {
    voiceId: VOICE_ID,
    volume: HOMEPAGE_SLIDER_SWIPE_SOUND_VOLUME,
  }) !== 'unavailable';
}

export function stopHomepageSliderSwipeSound(): void {
  stopDecodedGameplayVoices([VOICE_ID]);
}
