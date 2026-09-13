import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

const BOTTLE_SOUND_BASE = './assets/sound/Wild and special kockice/bottle/';

export const BOTTLE_PULL_MERGE_SOUND_SOURCES = Object.freeze([
  `${BOTTLE_SOUND_BASE}bubsplat1.wav`,
  `${BOTTLE_SOUND_BASE}bubsplat2.wav`,
] as const);
export const BOTTLE_PULL_MERGE_SOUND_BASE_VOLUMES = [0.88, 0.88] as const;
export const BOTTLE_PULL_MERGE_SOUND_VOLUMES = BOTTLE_PULL_MERGE_SOUND_BASE_VOLUMES.map(
  applySoundEffectsMasterGain,
);
export const BOTTLE_PULL_MERGE_PLAYBACK_RATE = 1;

const VOICE_IDS = [
  'bottle-pull-merge-bubsplat1',
  'bottle-pull-merge-bubsplat2',
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

export function preloadBottlePullMergeSounds(): boolean {
  if (!areSoundsEnabled()) return false;
  return preloadDecodedGameplaySounds(BOTTLE_PULL_MERGE_SOUND_SOURCES)
    || BOTTLE_PULL_MERGE_SOUND_SOURCES.every((source) => getMediaAudio(source) !== null);
}

export function playBottlePullMergeSounds(): boolean {
  if (!areSoundsEnabled()) return false;
  stopBottlePullMergeSounds();

  const decodedState = getDecodedGameplaySoundsState(BOTTLE_PULL_MERGE_SOUND_SOURCES);
  if (decodedState !== 'unavailable') {
    const results = BOTTLE_PULL_MERGE_SOUND_SOURCES.map((source, index) => (
      playDecodedGameplaySound(source, {
        voiceId: VOICE_IDS[index],
        volume: BOTTLE_PULL_MERGE_SOUND_VOLUMES[index],
        playbackRate: BOTTLE_PULL_MERGE_PLAYBACK_RATE,
      }) !== 'unavailable'
    ));
    return results.every(Boolean);
  }

  const results = BOTTLE_PULL_MERGE_SOUND_SOURCES.map((source, index) => {
    const audio = getMediaAudio(source);
    if (!audio) return false;
    try {
      audio.pause();
      audio.defaultPlaybackRate = BOTTLE_PULL_MERGE_PLAYBACK_RATE;
      audio.playbackRate = BOTTLE_PULL_MERGE_PLAYBACK_RATE;
      audio.volume = BOTTLE_PULL_MERGE_SOUND_VOLUMES[index];
      audio.currentTime = 0;
      audio.play()?.catch((error) => logger.warn('Failed to play Bottle pull-merge layer:', error));
      return true;
    } catch (error) {
      logger.warn('Failed to start Bottle pull-merge layer:', error);
      return false;
    }
  });
  return results.every(Boolean);
}

export function stopBottlePullMergeSounds(): void {
  stopDecodedGameplayVoices(VOICE_IDS);
  mediaAudioBySource.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetBottlePullMergeSoundCacheForTests(): void {
  stopBottlePullMergeSounds();
  mediaAudioBySource.clear();
}
