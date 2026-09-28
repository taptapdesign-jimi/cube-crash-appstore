import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const HOMEPAGE_SLIDER_ENTER_SOUND_SOURCE =
  './assets/sound/Board transitions/elements down1.wav';
export const HOMEPAGE_SLIDER_EXIT_SOUND_SOURCE =
  './assets/sound/Board transitions/elemens down2.wav';
const ENTER_VOICE_ID = 'homepage-slider-enter-elements-down1';
const EXIT_VOICE_ID = 'homepage-slider-exit-elements-down2';
const VOICE_IDS = [ENTER_VOICE_ID, EXIT_VOICE_ID];

export function preloadHomepageSliderMotionSounds(): boolean {
  return (window as any)._settings?.gameSoundsEnabled === true
    && preloadDecodedGameplaySounds([
      HOMEPAGE_SLIDER_ENTER_SOUND_SOURCE,
      HOMEPAGE_SLIDER_EXIT_SOUND_SOURCE,
    ]);
}

function play(source: string, voiceId: string, durationSeconds: number): boolean {
  if ((window as any)._settings?.gameSoundsEnabled !== true || document.hidden || durationSeconds <= 0) return false;
  stopDecodedGameplayVoices([voiceId]);
  return playDecodedGameplaySound(source, {
    voiceId,
    volume: applySoundEffectsMasterGain(0.5),
    stopAfterSeconds: durationSeconds,
    fadeOutSeconds: Math.min(0.05, durationSeconds),
  }) !== 'unavailable';
}

export const playHomepageSliderEnterSound = (durationSeconds: number): boolean => (
  play(HOMEPAGE_SLIDER_ENTER_SOUND_SOURCE, ENTER_VOICE_ID, durationSeconds)
);

export const playHomepageSliderExitSound = (durationSeconds: number): boolean => (
  play(HOMEPAGE_SLIDER_EXIT_SOUND_SOURCE, EXIT_VOICE_ID, durationSeconds)
);

export function stopHomepageSliderMotionSounds(): void {
  stopDecodedGameplayVoices(VOICE_IDS);
}
