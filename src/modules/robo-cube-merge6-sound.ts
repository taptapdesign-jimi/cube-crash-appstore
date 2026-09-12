import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

const ROBO_SOUND_BASE = './assets/sound/Wild and special kockice/robo/';

export const ROBO_CUBE_MERGE6_SOUND_SOURCES = Object.freeze([
  `${ROBO_SOUND_BASE}bibiribi.wav`,
  `${ROBO_SOUND_BASE}robo1.wav`,
  `${ROBO_SOUND_BASE}outro zing.wav`,
] as const);
export const ROBO_CUBE_MERGE6_BASE_VOLUMES = Object.freeze([1, 1, 0.7] as const);
export const ROBO_CUBE_MERGE6_VOLUMES = Object.freeze(
  ROBO_CUBE_MERGE6_BASE_VOLUMES.map(applySoundEffectsMasterGain),
);

const VOICE_IDS = [
  'robo-cube-merge6-bibiribi',
  'robo-cube-merge6-robo1',
  'robo-cube-merge6-outro-zing',
] as const;
const mediaAudioBySource = new Map<string, HTMLAudioElement>();

export interface RoboCubeMerge6SoundEvent {
  effectiveSum: number;
  srcSpecialDiceVariantId?: string | null;
  dstSpecialDiceVariantId?: string | null;
}

export function isRoboCubeMerge6SoundEvent(event: RoboCubeMerge6SoundEvent): boolean {
  return event.effectiveSum === 6 && (
    event.srcSpecialDiceVariantId === 'robo-cube'
    || event.dstSpecialDiceVariantId === 'robo-cube'
  );
}

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

export function preloadRoboCubeMerge6Sounds(): boolean {
  if (!areSoundsEnabled()) return false;
  return preloadDecodedGameplaySounds(ROBO_CUBE_MERGE6_SOUND_SOURCES)
    || ROBO_CUBE_MERGE6_SOUND_SOURCES.every(source => getMediaAudio(source) !== null);
}

export function playRoboCubeMerge6Sounds(): boolean {
  if (!areSoundsEnabled()) return false;
  stopRoboCubeMerge6Sounds();

  const decodedState = getDecodedGameplaySoundsState(ROBO_CUBE_MERGE6_SOUND_SOURCES);
  if (decodedState !== 'unavailable') {
    return ROBO_CUBE_MERGE6_SOUND_SOURCES.every((source, index) => (
      playDecodedGameplaySound(source, {
        voiceId: VOICE_IDS[index],
        volume: ROBO_CUBE_MERGE6_VOLUMES[index],
        playbackRate: 1,
      }) !== 'unavailable'
    ));
  }

  const layers = ROBO_CUBE_MERGE6_SOUND_SOURCES.map(getMediaAudio);
  if (layers.some(layer => !layer)) return false;
  try {
    layers.forEach((audio, index) => {
      if (!audio) return;
      audio.pause();
      audio.defaultPlaybackRate = 1;
      audio.playbackRate = 1;
      audio.volume = ROBO_CUBE_MERGE6_VOLUMES[index];
      audio.currentTime = 0;
      audio.play()?.catch(error => logger.warn(`Failed to play Robo Cube merge-6 layer ${index + 1}:`, error));
    });
    return true;
  } catch (error) {
    logger.warn('Failed to start Robo Cube merge-6 sounds:', error);
    return false;
  }
}

export function stopRoboCubeMerge6Sounds(): void {
  stopDecodedGameplayVoices(VOICE_IDS);
  mediaAudioBySource.forEach(audio => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetRoboCubeMerge6SoundCacheForTests(): void {
  stopRoboCubeMerge6Sounds();
  mediaAudioBySource.clear();
}
