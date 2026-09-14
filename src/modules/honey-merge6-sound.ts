import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

const HONEY_SOUND_BASE = './assets/sound/Wild and special kockice/honey/';

export const HONEY_FIRST_MERGE_SOUND_SOURCES = [
  `${HONEY_SOUND_BASE}honeysplat.wav`,
] as const;
export const HONEY_PULL_MERGE_SOUND_SOURCES = [
  `${HONEY_SOUND_BASE}hapr.wav`,
  `${HONEY_SOUND_BASE}supersplat.wav`,
] as const;
export const HONEY_POST_MERGE_SOUND_SOURCES = [
  `${HONEY_SOUND_BASE}BEES3s.wav`,
] as const;
export const HONEY_FIRST_MERGE_SOUND_BASE_VOLUMES = [1] as const;
export const HONEY_PULL_MERGE_SOUND_BASE_VOLUMES = [0.8, 0.8] as const;
export const HONEY_POST_MERGE_SOUND_BASE_VOLUMES = [0.336] as const;
export const HONEY_MERGE6_CUSTOM_BUS_SCALE = 0.6;
export const HONEY_POST_MERGE_SOUND_VOLUMES = HONEY_POST_MERGE_SOUND_BASE_VOLUMES.map(
  applySoundEffectsMasterGain,
);
export const HONEY_PULL_MERGE_SOUND_VOLUMES = HONEY_PULL_MERGE_SOUND_BASE_VOLUMES.map(
  (volume) => applySoundEffectsMasterGain(volume * HONEY_MERGE6_CUSTOM_BUS_SCALE),
);
export const HONEY_FIRST_MERGE_SOUND_VOLUMES = HONEY_FIRST_MERGE_SOUND_BASE_VOLUMES.map(
  (volume) => applySoundEffectsMasterGain(volume * HONEY_MERGE6_CUSTOM_BUS_SCALE),
);

const ALL_SOURCES = [
  ...HONEY_FIRST_MERGE_SOUND_SOURCES,
  ...HONEY_PULL_MERGE_SOUND_SOURCES,
  ...HONEY_POST_MERGE_SOUND_SOURCES,
] as const;
const VOICE_IDS = [
  'honey-first-merge-honeysplat',
  'honey-pull-merge-harp',
  'honey-pull-merge-supersplat',
  'honey-post-merge-bees3s',
] as const;
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

function playLayers(
  sources: readonly string[],
  volumes: readonly number[],
  voiceOffset: number,
): boolean {
  if (!areSoundsEnabled()) return false;
  const decodedState = getDecodedGameplaySoundsState(ALL_SOURCES);
  if (decodedState !== 'unavailable') {
    const results = sources.map((source, index) => playDecodedGameplaySound(source, {
      voiceId: VOICE_IDS[voiceOffset + index],
      volume: volumes[index],
    }));
    return results.every((result) => result !== 'unavailable');
  }

  const results = sources.map((source, index) => {
    const audio = getMediaAudio(source);
    if (!audio) return false;
    try {
      audio.pause();
      audio.volume = volumes[index];
      audio.currentTime = 0;
      audio.play()?.catch((error) => logger.warn('Failed to play Honey Merge-6 layer:', error));
      return true;
    } catch (error) {
      logger.warn('Failed to start Honey Merge-6 layer:', error);
      return false;
    }
  });
  return results.every(Boolean);
}

export function preloadHoneyMerge6Sounds(): boolean {
  if (!areSoundsEnabled()) return false;
  return preloadDecodedGameplaySounds(ALL_SOURCES)
    || ALL_SOURCES.every((source) => getMediaAudio(source) !== null);
}

export function playHoneyPostMergeSounds(): boolean {
  return playLayers(
    HONEY_POST_MERGE_SOUND_SOURCES,
    HONEY_POST_MERGE_SOUND_VOLUMES,
    HONEY_FIRST_MERGE_SOUND_SOURCES.length + HONEY_PULL_MERGE_SOUND_SOURCES.length,
  );
}

export function playHoneyFirstMergeSounds(): boolean {
  return playLayers(
    HONEY_FIRST_MERGE_SOUND_SOURCES,
    HONEY_FIRST_MERGE_SOUND_VOLUMES,
    0,
  );
}

export function playHoneyPullMergeSounds(): boolean {
  return playLayers(
    HONEY_PULL_MERGE_SOUND_SOURCES,
    HONEY_PULL_MERGE_SOUND_VOLUMES,
    HONEY_FIRST_MERGE_SOUND_SOURCES.length,
  );
}

export function stopHoneyMerge6Sounds(): void {
  stopDecodedGameplayVoices(VOICE_IDS);
  mediaAudioBySource.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetHoneyMerge6SoundCacheForTests(): void {
  stopHoneyMerge6Sounds();
  mediaAudioBySource.clear();
}
