import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';
import {
  REGULAR_MERGE6_BOOM_BASE_VOLUME,
  REGULAR_MERGE6_BOOM_SOUND_SOURCE,
  REGULAR_MERGE6_BOOM_VOLUME,
  REGULAR_MERGE6_CRASH_BASE_VOLUME,
  REGULAR_MERGE6_CRASH_PLAYBACK_RATE,
  REGULAR_MERGE6_CRASH_SOUND_SOURCE,
  REGULAR_MERGE6_CRASH_VOLUME,
  REGULAR_MERGE6_SOUND_BASE_VOLUME,
  REGULAR_MERGE6_SOUND_PLAYBACK_RATE,
  REGULAR_MERGE6_SOUND_SOURCE,
  REGULAR_MERGE6_SOUND_VOLUME,
  REGULAR_MERGE6_STACK_BASE_VOLUME,
  REGULAR_MERGE6_STACK_SOUND_SOURCE,
  REGULAR_MERGE6_STACK_VOLUME,
} from './regular-merge6-sound.ts';

export const BOTTLE_FINALE_WATER_WAVES_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/bottle/water waves.wav';
export const BOTTLE_FINALE_BOTTLE1_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/bottle/bottle1.wav';
export const BOTTLE_FINALE_BOTTLE2_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/bottle/bottle 2.wav';
export const BOTTLE_FINALE_CLING_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/bottle/cling.wav';
export const BOTTLE_FINALE_CLING2_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/bottle/cling2.wav';
export const BOTTLE_FINALE_BUBLESI_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/bottle/bublesi.wav';

export const BOTTLE_FINALE_PLAYBACK_RATE = 1;
export const BOTTLE_FINALE_WATER_WAVES_BASE_VOLUME = 0.4;
export const BOTTLE_FINALE_WATER_WAVES_VOLUME = applySoundEffectsMasterGain(
  BOTTLE_FINALE_WATER_WAVES_BASE_VOLUME,
);
export const BOTTLE_FINALE_BOTTLE_BASE_VOLUME = 1;
export const BOTTLE_FINALE_BOTTLE_VOLUME = applySoundEffectsMasterGain(
  BOTTLE_FINALE_BOTTLE_BASE_VOLUME,
);
export const BOTTLE_FINALE_CLING_BASE_VOLUME = 0.378;
export const BOTTLE_FINALE_CLING_VOLUME = applySoundEffectsMasterGain(
  BOTTLE_FINALE_CLING_BASE_VOLUME,
);
export const BOTTLE_FINALE_BUBLESI_BASE_VOLUME = 0.64;
export const BOTTLE_FINALE_BUBLESI_VOLUME = applySoundEffectsMasterGain(
  BOTTLE_FINALE_BUBLESI_BASE_VOLUME,
);

// Bottle inherits the complete ordinary Merge-6 mix at the committed merge
// event. The ocean-finale layers below only sweeten that shared foundation.
export const BOTTLE_MERGE6_PRIMARY_SOUND_SOURCE = REGULAR_MERGE6_SOUND_SOURCE;
export const BOTTLE_MERGE6_PRIMARY_PLAYBACK_RATE = REGULAR_MERGE6_SOUND_PLAYBACK_RATE;
export const BOTTLE_MERGE6_PRIMARY_BASE_VOLUME = REGULAR_MERGE6_SOUND_BASE_VOLUME;
export const BOTTLE_MERGE6_PRIMARY_VOLUME = REGULAR_MERGE6_SOUND_VOLUME;
export const BOTTLE_MERGE6_CRASH_SOUND_SOURCE = REGULAR_MERGE6_CRASH_SOUND_SOURCE;
export const BOTTLE_MERGE6_CRASH_PLAYBACK_RATE = REGULAR_MERGE6_CRASH_PLAYBACK_RATE;
export const BOTTLE_MERGE6_CRASH_BASE_VOLUME = REGULAR_MERGE6_CRASH_BASE_VOLUME;
export const BOTTLE_MERGE6_CRASH_VOLUME = REGULAR_MERGE6_CRASH_VOLUME;
export const BOTTLE_MERGE6_BOOM_SOUND_SOURCE = REGULAR_MERGE6_BOOM_SOUND_SOURCE;
export const BOTTLE_MERGE6_BOOM_BASE_VOLUME = REGULAR_MERGE6_BOOM_BASE_VOLUME;
export const BOTTLE_MERGE6_BOOM_VOLUME = REGULAR_MERGE6_BOOM_VOLUME;
export const BOTTLE_MERGE6_STACK_SOUND_SOURCE = REGULAR_MERGE6_STACK_SOUND_SOURCE;
export const BOTTLE_MERGE6_STACK_BASE_VOLUME = REGULAR_MERGE6_STACK_BASE_VOLUME;
export const BOTTLE_MERGE6_STACK_VOLUME = REGULAR_MERGE6_STACK_VOLUME;

export const BOTTLE_FINALE_SOUND_SOURCES = Object.freeze([
  BOTTLE_FINALE_WATER_WAVES_SOUND_SOURCE,
  BOTTLE_FINALE_BOTTLE1_SOUND_SOURCE,
  BOTTLE_FINALE_BOTTLE2_SOUND_SOURCE,
  BOTTLE_FINALE_CLING_SOUND_SOURCE,
  BOTTLE_FINALE_CLING2_SOUND_SOURCE,
  BOTTLE_FINALE_BUBLESI_SOUND_SOURCE,
] as const);

export type BottleFinaleSoundCue =
  | 'water-waves'
  | 'bottle1'
  | 'bottle2'
  | 'cling'
  | 'cling2'
  | 'bublesi';

const CUE_CONFIG = Object.freeze({
  'water-waves': {
    source: BOTTLE_FINALE_WATER_WAVES_SOUND_SOURCE,
    voiceId: 'bottle-finale-water-waves',
    volume: BOTTLE_FINALE_WATER_WAVES_VOLUME,
  },
  bottle1: {
    source: BOTTLE_FINALE_BOTTLE1_SOUND_SOURCE,
    voiceId: 'bottle-finale-bottle1',
    volume: BOTTLE_FINALE_BOTTLE_VOLUME,
  },
  bottle2: {
    source: BOTTLE_FINALE_BOTTLE2_SOUND_SOURCE,
    voiceId: 'bottle-finale-bottle2',
    volume: BOTTLE_FINALE_BOTTLE_VOLUME,
  },
  cling: {
    source: BOTTLE_FINALE_CLING_SOUND_SOURCE,
    voiceId: 'bottle-finale-cling',
    volume: BOTTLE_FINALE_CLING_VOLUME,
  },
  cling2: {
    source: BOTTLE_FINALE_CLING2_SOUND_SOURCE,
    voiceId: 'bottle-finale-cling2',
    volume: BOTTLE_FINALE_CLING_VOLUME,
  },
  bublesi: {
    source: BOTTLE_FINALE_BUBLESI_SOUND_SOURCE,
    voiceId: 'bottle-finale-bublesi',
    volume: BOTTLE_FINALE_BUBLESI_VOLUME,
  },
} as const);

const BOTTLE_FINALE_VOICE_IDS = Object.freeze(
  Object.values(CUE_CONFIG).map(({ voiceId }) => voiceId),
);
const mediaAudioBySource = new Map<string, HTMLAudioElement>();

export function areBottleFinaleSoundsEnabled(): boolean {
  return typeof window !== 'undefined' &&
    (window as any)._settings?.gameSoundsEnabled === true;
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

export function preloadBottleFinaleSounds(): boolean {
  if (!areBottleFinaleSoundsEnabled()) return false;
  return preloadDecodedGameplaySounds(BOTTLE_FINALE_SOUND_SOURCES) ||
    BOTTLE_FINALE_SOUND_SOURCES.every((source) => getMediaAudio(source) !== null);
}

export function playBottleFinaleSound(cue: BottleFinaleSoundCue): boolean {
  if (!areBottleFinaleSoundsEnabled()) return false;
  const config = CUE_CONFIG[cue];
  const decodedState = getDecodedGameplaySoundsState(BOTTLE_FINALE_SOUND_SOURCES);
  if (decodedState !== 'unavailable') {
    return playDecodedGameplaySound(config.source, {
      voiceId: config.voiceId,
      volume: config.volume,
      playbackRate: BOTTLE_FINALE_PLAYBACK_RATE,
    }) !== 'unavailable';
  }

  const audio = getMediaAudio(config.source);
  if (!audio) return false;
  try {
    audio.pause();
    audio.defaultPlaybackRate = BOTTLE_FINALE_PLAYBACK_RATE;
    audio.playbackRate = BOTTLE_FINALE_PLAYBACK_RATE;
    audio.volume = config.volume;
    audio.currentTime = 0;
    audio.play()?.catch((error) => {
      logger.warn(`Failed to play Bottle finale ${cue} sound:`, error);
    });
    return true;
  } catch (error) {
    logger.warn(`Failed to start Bottle finale ${cue} sound:`, error);
    return false;
  }
}

export function stopBottleFinaleSounds(): void {
  stopDecodedGameplayVoices(BOTTLE_FINALE_VOICE_IDS);
  mediaAudioBySource.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetBottleFinaleSoundCacheForTests(): void {
  stopBottleFinaleSounds();
  mediaAudioBySource.clear();
}
