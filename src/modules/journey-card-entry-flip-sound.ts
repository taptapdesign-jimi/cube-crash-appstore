import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

const JOURNEY_CARD_FLIP_SOUND_BASE = './assets/sound/cjelina flip/';

export const JOURNEY_CARD_ENTRY_FLIP_SOUND_SOURCES = [
  `${JOURNEY_CARD_FLIP_SOUND_BASE}menu flip.wav`,
  `${JOURNEY_CARD_FLIP_SOUND_BASE}flip.wav`,
  `${JOURNEY_CARD_FLIP_SOUND_BASE}flip soft.wav`,
] as const;
export const JOURNEY_CARD_MANUAL_FLIP_SOUND_SOURCE = `${JOURNEY_CARD_FLIP_SOUND_BASE}flip soft.wav`;
export const JOURNEY_CARD_RETURN_SWOOSH_SOUND_SOURCE = `${JOURNEY_CARD_FLIP_SOUND_BASE}swoosh back.wav`;
export const JOURNEY_CARD_ENTRY_FLIP_SOUND_BASE_VOLUMES = [1, 1, 1] as const;
export const JOURNEY_CARD_ENTRY_FLIP_SOUND_VOLUMES = JOURNEY_CARD_ENTRY_FLIP_SOUND_BASE_VOLUMES.map(
  applySoundEffectsMasterGain,
);
export const JOURNEY_CARD_MANUAL_FLIP_SOUND_VOLUME = applySoundEffectsMasterGain(1);
export const JOURNEY_CARD_RETURN_SWOOSH_SOUND_VOLUME = applySoundEffectsMasterGain(1);

const VOICE_IDS = [
  'journey-card-entry-menu-flip',
  'journey-card-entry-flip',
  'journey-card-entry-flip-soft',
] as const;
const MANUAL_FLIP_VOICE_ID = 'journey-card-manual-flip-soft';
const RETURN_SWOOSH_VOICE_ID = 'journey-card-return-swoosh-back';
const mediaAudioBySource = new Map<string, HTMLAudioElement>();

function areSoundsEnabled(): boolean {
  return typeof window !== 'undefined'
    && (window as any)._settings?.gameSoundsEnabled === true;
}

function getMediaAudio(source: string): HTMLAudioElement | null {
  const existing = mediaAudioBySource.get(source);
  if (existing) return existing;
  if (typeof Audio !== 'function') return null;
  const audio = new Audio(source);
  audio.preload = 'auto';
  try { audio.load(); } catch {}
  mediaAudioBySource.set(source, audio);
  return audio;
}

export function preloadJourneyCardEntryFlipSounds(): boolean {
  if (!areSoundsEnabled()) return false;
  const sources = [
    ...JOURNEY_CARD_ENTRY_FLIP_SOUND_SOURCES,
    JOURNEY_CARD_MANUAL_FLIP_SOUND_SOURCE,
    JOURNEY_CARD_RETURN_SWOOSH_SOUND_SOURCE,
  ];
  return preloadDecodedGameplaySounds(sources)
    || sources.every(source => getMediaAudio(source) !== null);
}

export function playJourneyCardReturnSwooshSound(): boolean {
  if (!areSoundsEnabled()) return false;
  stopDecodedGameplayVoices([RETURN_SWOOSH_VOICE_ID]);
  const decodedState = getDecodedGameplaySoundsState([JOURNEY_CARD_RETURN_SWOOSH_SOUND_SOURCE]);
  if (decodedState !== 'unavailable') {
    return playDecodedGameplaySound(JOURNEY_CARD_RETURN_SWOOSH_SOUND_SOURCE, {
      voiceId: RETURN_SWOOSH_VOICE_ID,
      volume: JOURNEY_CARD_RETURN_SWOOSH_SOUND_VOLUME,
    }) !== 'unavailable';
  }
  const audio = getMediaAudio(JOURNEY_CARD_RETURN_SWOOSH_SOUND_SOURCE);
  if (!audio) return false;
  try {
    audio.pause();
    audio.volume = JOURNEY_CARD_RETURN_SWOOSH_SOUND_VOLUME;
    audio.currentTime = 0;
    audio.play()?.catch(error => logger.warn('Failed to play Journey card return swoosh sound:', error));
    return true;
  } catch (error) {
    logger.warn('Failed to start Journey card return swoosh sound:', error);
    return false;
  }
}

export function playJourneyCardManualFlipSound(): boolean {
  if (!areSoundsEnabled()) return false;
  stopDecodedGameplayVoices([MANUAL_FLIP_VOICE_ID]);
  const decodedState = getDecodedGameplaySoundsState([JOURNEY_CARD_MANUAL_FLIP_SOUND_SOURCE]);
  if (decodedState !== 'unavailable') {
    return playDecodedGameplaySound(JOURNEY_CARD_MANUAL_FLIP_SOUND_SOURCE, {
      voiceId: MANUAL_FLIP_VOICE_ID,
      volume: JOURNEY_CARD_MANUAL_FLIP_SOUND_VOLUME,
    }) !== 'unavailable';
  }
  const audio = getMediaAudio(JOURNEY_CARD_MANUAL_FLIP_SOUND_SOURCE);
  if (!audio) return false;
  try {
    audio.pause();
    audio.volume = JOURNEY_CARD_MANUAL_FLIP_SOUND_VOLUME;
    audio.currentTime = 0;
    audio.play()?.catch(error => logger.warn('Failed to play Journey card manual flip sound:', error));
    return true;
  } catch (error) {
    logger.warn('Failed to start Journey card manual flip sound:', error);
    return false;
  }
}

export function playJourneyCardEntryFlipSounds(): boolean {
  if (!areSoundsEnabled()) return false;
  stopJourneyCardEntryFlipSounds();

  const decodedState = getDecodedGameplaySoundsState(JOURNEY_CARD_ENTRY_FLIP_SOUND_SOURCES);
  if (decodedState !== 'unavailable') {
    const results = JOURNEY_CARD_ENTRY_FLIP_SOUND_SOURCES.map((source, index) => (
      playDecodedGameplaySound(source, {
        voiceId: VOICE_IDS[index],
        volume: JOURNEY_CARD_ENTRY_FLIP_SOUND_VOLUMES[index],
      })
    ));
    return results.every(result => result !== 'unavailable');
  }

  const layers = JOURNEY_CARD_ENTRY_FLIP_SOUND_SOURCES.map(getMediaAudio);
  if (layers.some(layer => !layer)) return false;
  try {
    layers.forEach((audio, index) => {
      if (!audio) return;
      audio.pause();
      audio.volume = JOURNEY_CARD_ENTRY_FLIP_SOUND_VOLUMES[index];
      audio.currentTime = 0;
      audio.play()?.catch(error => logger.warn(`Failed to play Journey card entry flip layer ${index + 1}:`, error));
    });
    return true;
  } catch (error) {
    logger.warn('Failed to start Journey card entry flip sounds:', error);
    return false;
  }
}

export function stopJourneyCardEntryFlipSounds(): void {
  stopDecodedGameplayVoices([...VOICE_IDS, MANUAL_FLIP_VOICE_ID, RETURN_SWOOSH_VOICE_ID]);
  mediaAudioBySource.forEach(audio => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetJourneyCardEntryFlipSoundsForTests(): void {
  stopJourneyCardEntryFlipSounds();
  mediaAudioBySource.clear();
}
