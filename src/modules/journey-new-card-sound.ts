import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import { playDecodedGameplaySound, preloadDecodedGameplaySounds, stopDecodedGameplayVoices } from './gameplay-audio-buffer-player.ts';

export const JOURNEY_NEW_CARD_SOUND_SOURCES = {
  intro: './assets/sound/card reveal/crumble.wav',
  crumble: './assets/sound/card reveal/interim crumble.wav',
  reveal: './assets/sound/card reveal/pufreveal.wav',
  happy: './assets/sound/card reveal/happy sound.wav',
  tap: './assets/sound/card reveal/klik plop.wav',
} as const;
const VOICES = ['journey-new-card-intro', 'journey-new-card-crumble', 'journey-new-card-reveal', 'journey-new-card-happy'] as const;
const TAP_VOICE = 'journey-new-card-tap';
let generation = 0;
const enabled = () => (window as any)._settings?.gameSoundsEnabled === true;

export function preloadJourneyNewCardSounds(): boolean {
  return enabled() && preloadDecodedGameplaySounds(Object.values(JOURNEY_NEW_CARD_SOUND_SOURCES));
}

export function stopJourneyNewCardSounds(): void {
  stopDecodedGameplayVoices([...VOICES, TAP_VOICE]);
}

// Accepted interaction owner supplies deduplication (pointerup/click/queued collect).
export function playJourneyNewCardTapSound(): void {
  if (!enabled()) return;
  playDecodedGameplaySound(JOURNEY_NEW_CARD_SOUND_SOURCES.tap, {
    voiceId: TAP_VOICE, volume: applySoundEffectsMasterGain(1),
  });
}

export function createJourneyNewCardSoundSession() {
  generation++;
  stopJourneyNewCardSounds();
  const owner = generation;
  const started = new Set<keyof typeof JOURNEY_NEW_CARD_SOUND_SOURCES>();
  const play = (cue: keyof typeof JOURNEY_NEW_CARD_SOUND_SOURCES, index: number, gain: number) => {
    if (owner !== generation || started.has(cue)) return;
    started.add(cue);
    if (cue === 'reveal') stopDecodedGameplayVoices(VOICES.slice(0, 2));
    if (!enabled()) return;
    playDecodedGameplaySound(JOURNEY_NEW_CARD_SOUND_SOURCES[cue], {
      voiceId: VOICES[index], volume: applySoundEffectsMasterGain(gain),
    });
  };
  return {
    playHappy: () => play('happy', 3, 0.5),
    playIntro: () => play('intro', 0, 0.7),
    playCrumble: () => play('crumble', 1, 0.7),
    playReveal: () => play('reveal', 2, 1),
    stop: () => {
      if (owner !== generation) return;
      generation++;
      // Keep the accepted collect tap audible during the exit animation.
      stopDecodedGameplayVoices(VOICES);
    },
  };
}
