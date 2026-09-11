import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';
import {
  playRegularMerge6Sound,
  preloadRegularMerge6Sounds,
  resetRegularMerge6SoundCacheForTests,
  stopRegularMerge6Sounds,
} from './regular-merge6-sound.ts';

const BEE_SOUND_BASE = './assets/sound/Wild and special kockice/bee/';

export const BEE_MERGE6_START_SOUND_SOURCE = `${BEE_SOUND_BASE}bee start.wav`;
export const BEE_MERGE6_BEE_SOUND_SOURCE = `${BEE_SOUND_BASE}BEE.wav`;
export const BEE_MERGE6_HAPPY_SOUND_SOURCE = `${BEE_SOUND_BASE}happy bee.wav`;
export const BEE_MERGE6_BRUSHING_SOUND_SOURCE = `${BEE_SOUND_BASE}brushing.wav`;
export const BEE_MERGE6_BASE_VOLUME = 1;
export const BEE_MERGE6_VOLUME = applySoundEffectsMasterGain(BEE_MERGE6_BASE_VOLUME);
export const BEE_MERGE6_START_BASE_VOLUME = 0.75;
export const BEE_MERGE6_START_VOLUME = applySoundEffectsMasterGain(
  BEE_MERGE6_START_BASE_VOLUME,
);
export const BEE_MERGE6_BEE_BASE_VOLUME = 0.7;
export const BEE_MERGE6_BEE_VOLUME = applySoundEffectsMasterGain(
  BEE_MERGE6_BEE_BASE_VOLUME,
);
export const BEE_MERGE6_BRUSHING_BASE_VOLUME = 0.8;
export const BEE_MERGE6_BRUSHING_VOLUME = applySoundEffectsMasterGain(
  BEE_MERGE6_BRUSHING_BASE_VOLUME,
);
export const BEE_MERGE6_HAPPY_BASE_VOLUME = 0.2;
export const BEE_MERGE6_HAPPY_VOLUME = applySoundEffectsMasterGain(
  BEE_MERGE6_HAPPY_BASE_VOLUME,
);
export const BEE_MERGE6_PLAYBACK_RATE = 1;

export const BEE_MERGE6_IMMEDIATE_SOUND_SOURCES = Object.freeze([
  BEE_MERGE6_START_SOUND_SOURCE,
  BEE_MERGE6_BEE_SOUND_SOURCE,
  BEE_MERGE6_BRUSHING_SOUND_SOURCE,
] as const);
export const BEE_MERGE6_FINALE_SOUND_SOURCES = Object.freeze([
  BEE_MERGE6_HAPPY_SOUND_SOURCE,
] as const);
export const BEE_MERGE6_SOUND_SOURCES = Object.freeze([
  ...BEE_MERGE6_IMMEDIATE_SOUND_SOURCES,
  ...BEE_MERGE6_FINALE_SOUND_SOURCES,
] as const);

const BEE_MERGE6_VOICE_IDS = BEE_MERGE6_SOUND_SOURCES.map(
  (_, index) => `bee-merge6-${index}`,
);
const mediaAudioBySource = new Map<string, HTMLAudioElement>();

export interface BeeMerge6SoundEvent {
  effectiveSum: number;
  srcSpecialDiceVariantId?: string | null;
  dstSpecialDiceVariantId?: string | null;
}

export function isBeeMerge6SoundEvent(event: BeeMerge6SoundEvent): boolean {
  return event.effectiveSum === 6 && (
    event.srcSpecialDiceVariantId === 'bee'
    || event.dstSpecialDiceVariantId === 'bee'
  );
}

export function areBeeMerge6SoundsEnabled(): boolean {
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

function playSources(
  sources: readonly string[],
  volumeForSource: (source: string) => number = () => BEE_MERGE6_VOLUME,
): boolean {
  if (!areBeeMerge6SoundsEnabled()) return false;
  const decodedState = getDecodedGameplaySoundsState(sources);
  if (decodedState !== 'unavailable') {
    const results = sources.map((source) => {
      const index = BEE_MERGE6_SOUND_SOURCES.indexOf(
        source as typeof BEE_MERGE6_SOUND_SOURCES[number],
      );
      stopDecodedGameplayVoices([BEE_MERGE6_VOICE_IDS[index]]);
      return playDecodedGameplaySound(source, {
        voiceId: BEE_MERGE6_VOICE_IDS[index],
        volume: volumeForSource(source),
        playbackRate: BEE_MERGE6_PLAYBACK_RATE,
      }) !== 'unavailable';
    });
    return results.every(Boolean);
  }
  const results = sources.map((source) => {
    const audio = getMediaAudio(source);
    if (!audio) return false;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.defaultPlaybackRate = BEE_MERGE6_PLAYBACK_RATE;
      audio.playbackRate = BEE_MERGE6_PLAYBACK_RATE;
      audio.volume = volumeForSource(source);
      audio.play()?.catch((error) => logger.warn('Failed to play Bee merge-6 layer:', error));
      return true;
    } catch (error) {
      logger.warn('Failed to start Bee merge-6 layer:', error);
      return false;
    }
  });
  return results.every(Boolean);
}

export function preloadBeeMerge6Sounds(): boolean {
  if (!areBeeMerge6SoundsEnabled()) return false;
  const ordinaryMergeReady = preloadRegularMerge6Sounds();
  const beeLayersReady = preloadDecodedGameplaySounds(BEE_MERGE6_SOUND_SOURCES)
    || BEE_MERGE6_SOUND_SOURCES.every((source) => getMediaAudio(source) !== null);
  return ordinaryMergeReady && beeLayersReady;
}

export function playBeeMerge6Sound(): boolean {
  if (!areBeeMerge6SoundsEnabled()) return false;
  stopBeeOwnedVoices();
  const ordinaryMergeStarted = playRegularMerge6Sound();
  const beeLayersStarted = playSources(
    BEE_MERGE6_IMMEDIATE_SOUND_SOURCES,
    (source) => {
      if (source === BEE_MERGE6_START_SOUND_SOURCE) return BEE_MERGE6_START_VOLUME;
      if (source === BEE_MERGE6_BEE_SOUND_SOURCE) return BEE_MERGE6_BEE_VOLUME;
      if (source === BEE_MERGE6_BRUSHING_SOUND_SOURCE) return BEE_MERGE6_BRUSHING_VOLUME;
      return BEE_MERGE6_VOLUME;
    },
  );
  return ordinaryMergeStarted && beeLayersStarted;
}

export function playBeeMerge6FinaleSounds(): boolean {
  return playSources(BEE_MERGE6_FINALE_SOUND_SOURCES, () => BEE_MERGE6_HAPPY_VOLUME);
}

function stopBeeOwnedVoices(): void {
  stopDecodedGameplayVoices(BEE_MERGE6_VOICE_IDS);
  mediaAudioBySource.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function stopBeeMerge6Sounds(): void {
  stopRegularMerge6Sounds();
  stopBeeOwnedVoices();
}

export function resetBeeMerge6SoundCacheForTests(): void {
  stopBeeMerge6Sounds();
  resetRegularMerge6SoundCacheForTests();
  mediaAudioBySource.clear();
}
