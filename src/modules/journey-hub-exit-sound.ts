import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import { playDecodedGameplaySound, preloadDecodedGameplaySounds, stopDecodedGameplayVoices } from './gameplay-audio-buffer-player.ts';

export const JOURNEY_HUB_EXIT_SOUND_SOURCES = [
  './assets/sound/Board transitions/elemens down2.wav',
] as const;
const VOICES = ['journey-hub-exit-0'];
let generation = 0;
export function preloadJourneyHubExitSounds(): boolean {
  return (window as any)._settings?.gameSoundsEnabled === true
    && preloadDecodedGameplaySounds(JOURNEY_HUB_EXIT_SOUND_SOURCES);
}
export function stopJourneyHubExitSounds(): void {
  generation++;
  stopDecodedGameplayVoices(VOICES);
}
export function createJourneyHubExitSoundSession() {
  stopJourneyHubExitSounds();
  const owner = generation;
  let started = false;
  return {
    play: () => {
      if (started || owner !== generation) return;
      started = true;
      if ((window as any)._settings?.gameSoundsEnabled !== true || document.hidden) return;
      JOURNEY_HUB_EXIT_SOUND_SOURCES.forEach((source, index) => {
        playDecodedGameplaySound(source, {
          voiceId: VOICES[index], volume: applySoundEffectsMasterGain(0.5),
          stopAfterSeconds: 2, fadeOutSeconds: 0.05,
        });
      });
    },
    stop: () => { if (owner === generation) stopJourneyHubExitSounds(); },
  };
}
