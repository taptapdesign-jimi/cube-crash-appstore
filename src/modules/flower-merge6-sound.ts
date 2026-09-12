import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';
import {
  beginCoreTntBonusImpactSoundSequence,
  preloadCoreTntBonusImpactSounds,
  stopCoreTntBonusImpactSounds,
} from './core-tnt-merge6-sound.ts';
import {
  playRegularMerge6Sound,
  preloadRegularMerge6Sounds,
  resetRegularMerge6SoundCacheForTests,
  stopRegularMerge6Sounds,
} from './regular-merge6-sound.ts';

const FLOWER_SOUND_BASE = './assets/sound/Wild and special kockice/flower/';

export const FLOWER_MERGE6_BUSH0_SOUND_SOURCE = `${FLOWER_SOUND_BASE}bush0.wav`;
export const FLOWER_MERGE6_BUSH2_SOUND_SOURCE = `${FLOWER_SOUND_BASE}bush2.wav`;
export const FLOWER_MERGE6_BUSH3_SOUND_SOURCE = `${FLOWER_SOUND_BASE}bush3.wav`;
export const FLOWER_MERGE6_BOOM_SOUND_SOURCE = `${FLOWER_SOUND_BASE}boom.wav`;
export const FLOWER_MERGE6_LEAVES_SOUND_SOURCE = `${FLOWER_SOUND_BASE}leaves.wav`;
export const FLOWER_MERGE6_SPARK_SOUND_SOURCE = `${FLOWER_SOUND_BASE}spark.wav`;
export const FLOWER_MERGE6_PLAYBACK_RATE = 1;
export const FLOWER_MERGE6_LEAVES_START_RATIO = 0.9;

export const FLOWER_MERGE6_BUSH0_BASE_VOLUME = 0.8;
export const FLOWER_MERGE6_BUSH2_BASE_VOLUME = 1;
export const FLOWER_MERGE6_BUSH3_BASE_VOLUME = 0.35;
export const FLOWER_MERGE6_BOOM_BASE_VOLUME = 1;
export const FLOWER_MERGE6_LEAVES_BASE_VOLUME = 0.8;
export const FLOWER_MERGE6_SPARK_BASE_VOLUME = 0.6;
export const FLOWER_MERGE6_BUSH0_VOLUME = applySoundEffectsMasterGain(
  FLOWER_MERGE6_BUSH0_BASE_VOLUME,
);
export const FLOWER_MERGE6_BUSH2_VOLUME = applySoundEffectsMasterGain(
  FLOWER_MERGE6_BUSH2_BASE_VOLUME,
);
export const FLOWER_MERGE6_BUSH3_VOLUME = applySoundEffectsMasterGain(
  FLOWER_MERGE6_BUSH3_BASE_VOLUME,
);
export const FLOWER_MERGE6_BOOM_VOLUME = applySoundEffectsMasterGain(
  FLOWER_MERGE6_BOOM_BASE_VOLUME,
);
export const FLOWER_MERGE6_LEAVES_VOLUME = applySoundEffectsMasterGain(
  FLOWER_MERGE6_LEAVES_BASE_VOLUME,
);
export const FLOWER_MERGE6_SPARK_VOLUME = applySoundEffectsMasterGain(
  FLOWER_MERGE6_SPARK_BASE_VOLUME,
);

export const FLOWER_MERGE6_IMMEDIATE_SOUND_SOURCES = Object.freeze([
  FLOWER_MERGE6_BUSH0_SOUND_SOURCE,
  FLOWER_MERGE6_BUSH2_SOUND_SOURCE,
  FLOWER_MERGE6_BUSH3_SOUND_SOURCE,
  FLOWER_MERGE6_BOOM_SOUND_SOURCE,
] as const);
export const FLOWER_MERGE6_SOUND_SOURCES = Object.freeze([
  ...FLOWER_MERGE6_IMMEDIATE_SOUND_SOURCES,
  FLOWER_MERGE6_LEAVES_SOUND_SOURCE,
  FLOWER_MERGE6_SPARK_SOUND_SOURCE,
] as const);

const FLOWER_MERGE6_VOICE_ID = Object.freeze({
  bush0: 'flower-merge6-bush0',
  bush2: 'flower-merge6-bush2',
  bush3: 'flower-merge6-bush3',
  boom: 'flower-merge6-boom',
  leaves: 'flower-merge6-leaves',
  spark: 'flower-merge6-spark',
});
const FLOWER_MERGE6_VOICE_IDS = Object.values(FLOWER_MERGE6_VOICE_ID);
const mediaAudioBySource = new Map<string, HTMLAudioElement>();

export interface FlowerMerge6SoundEvent {
  effectiveSum: number;
  srcSpecialDiceVariantId?: string | null;
  dstSpecialDiceVariantId?: string | null;
}

export function isFlowerMerge6SoundEvent(event: FlowerMerge6SoundEvent): boolean {
  return event.effectiveSum === 6 && (
    event.srcSpecialDiceVariantId === 'flower'
    || event.dstSpecialDiceVariantId === 'flower'
  );
}

export function areFlowerMerge6SoundsEnabled(): boolean {
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

function startMediaLayer(audio: HTMLAudioElement, volume: number, label: string): void {
  audio.pause();
  audio.defaultPlaybackRate = FLOWER_MERGE6_PLAYBACK_RATE;
  audio.playbackRate = FLOWER_MERGE6_PLAYBACK_RATE;
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play()?.catch((error) => {
    logger.warn(`Failed to play Flower merge-6 ${label} layer:`, error);
  });
}

function stopFlowerOwnedVoices(): void {
  stopDecodedGameplayVoices(FLOWER_MERGE6_VOICE_IDS);
  mediaAudioBySource.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function preloadFlowerMerge6Sounds(): boolean {
  if (!areFlowerMerge6SoundsEnabled()) return false;
  const ordinaryMergeReady = preloadRegularMerge6Sounds();
  const flowerLayersReady = preloadDecodedGameplaySounds(FLOWER_MERGE6_SOUND_SOURCES)
    || FLOWER_MERGE6_SOUND_SOURCES.every((source) => getMediaAudio(source) !== null);
  const bonusImpactsReady = preloadCoreTntBonusImpactSounds();
  return ordinaryMergeReady && flowerLayersReady && bonusImpactsReady;
}

/** Plays once from the Flower sprite owner's exact configured progress milestone. */
export function playFlowerMerge6LeavesSound(): boolean {
  if (!areFlowerMerge6SoundsEnabled()) return false;
  const decodedState = getDecodedGameplaySoundsState([FLOWER_MERGE6_LEAVES_SOUND_SOURCE]);
  if (decodedState !== 'unavailable') {
    stopDecodedGameplayVoices([FLOWER_MERGE6_VOICE_ID.leaves]);
    return playDecodedGameplaySound(FLOWER_MERGE6_LEAVES_SOUND_SOURCE, {
      voiceId: FLOWER_MERGE6_VOICE_ID.leaves,
      volume: FLOWER_MERGE6_LEAVES_VOLUME,
      playbackRate: FLOWER_MERGE6_PLAYBACK_RATE,
    }) !== 'unavailable';
  }
  const leaves = getMediaAudio(FLOWER_MERGE6_LEAVES_SOUND_SOURCE);
  if (!leaves) return false;
  try {
    startMediaLayer(leaves, FLOWER_MERGE6_LEAVES_VOLUME, 'leaves');
    return true;
  } catch (error) {
    logger.warn('Failed to start Flower merge-6 leaves layer:', error);
    return false;
  }
}

export function playFlowerMerge6Sound(): boolean {
  if (!areFlowerMerge6SoundsEnabled()) return false;
  stopFlowerOwnedVoices();
  beginCoreTntBonusImpactSoundSequence();
  const ordinaryMergeStarted = playRegularMerge6Sound();
  const decodedState = getDecodedGameplaySoundsState(FLOWER_MERGE6_IMMEDIATE_SOUND_SOURCES);

  if (decodedState !== 'unavailable') {
    const results = [
      playDecodedGameplaySound(FLOWER_MERGE6_BUSH0_SOUND_SOURCE, {
        voiceId: FLOWER_MERGE6_VOICE_ID.bush0,
        volume: FLOWER_MERGE6_BUSH0_VOLUME,
        playbackRate: FLOWER_MERGE6_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(FLOWER_MERGE6_BUSH2_SOUND_SOURCE, {
        voiceId: FLOWER_MERGE6_VOICE_ID.bush2,
        volume: FLOWER_MERGE6_BUSH2_VOLUME,
        playbackRate: FLOWER_MERGE6_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(FLOWER_MERGE6_BUSH3_SOUND_SOURCE, {
        voiceId: FLOWER_MERGE6_VOICE_ID.bush3,
        volume: FLOWER_MERGE6_BUSH3_VOLUME,
        playbackRate: FLOWER_MERGE6_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(FLOWER_MERGE6_BOOM_SOUND_SOURCE, {
        voiceId: FLOWER_MERGE6_VOICE_ID.boom,
        volume: FLOWER_MERGE6_BOOM_VOLUME,
        playbackRate: FLOWER_MERGE6_PLAYBACK_RATE,
      }),
    ];
    return ordinaryMergeStarted && results.every((result) => result !== 'unavailable');
  }

  const bush0 = getMediaAudio(FLOWER_MERGE6_BUSH0_SOUND_SOURCE);
  const bush2 = getMediaAudio(FLOWER_MERGE6_BUSH2_SOUND_SOURCE);
  const bush3 = getMediaAudio(FLOWER_MERGE6_BUSH3_SOUND_SOURCE);
  const boom = getMediaAudio(FLOWER_MERGE6_BOOM_SOUND_SOURCE);
  if (!bush0 || !bush2 || !bush3 || !boom) return false;
  try {
    FLOWER_MERGE6_IMMEDIATE_SOUND_SOURCES.forEach((source) => {
      const audio = mediaAudioBySource.get(source);
      if (!audio) return;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    });
    startMediaLayer(bush0, FLOWER_MERGE6_BUSH0_VOLUME, 'bush0');
    startMediaLayer(bush2, FLOWER_MERGE6_BUSH2_VOLUME, 'bush2');
    startMediaLayer(bush3, FLOWER_MERGE6_BUSH3_VOLUME, 'bush3');
    startMediaLayer(boom, FLOWER_MERGE6_BOOM_VOLUME, 'boom');
    return ordinaryMergeStarted;
  } catch (error) {
    logger.warn('Failed to start Flower merge-6 sounds:', error);
    return false;
  }
}

/** Plays at the real end of the Flower sprite sequence, not from a timer. */
export function playFlowerMerge6SparkSound(): boolean {
  if (!areFlowerMerge6SoundsEnabled()) return false;
  const decodedState = getDecodedGameplaySoundsState([FLOWER_MERGE6_SPARK_SOUND_SOURCE]);
  if (decodedState !== 'unavailable') {
    stopDecodedGameplayVoices([FLOWER_MERGE6_VOICE_ID.spark]);
    return playDecodedGameplaySound(FLOWER_MERGE6_SPARK_SOUND_SOURCE, {
      voiceId: FLOWER_MERGE6_VOICE_ID.spark,
      volume: FLOWER_MERGE6_SPARK_VOLUME,
      playbackRate: FLOWER_MERGE6_PLAYBACK_RATE,
    }) !== 'unavailable';
  }
  const spark = getMediaAudio(FLOWER_MERGE6_SPARK_SOUND_SOURCE);
  if (!spark) return false;
  try {
    startMediaLayer(spark, FLOWER_MERGE6_SPARK_VOLUME, 'spark');
    return true;
  } catch (error) {
    logger.warn('Failed to start Flower merge-6 spark layer:', error);
    return false;
  }
}

export function stopFlowerMerge6Sounds(): void {
  stopRegularMerge6Sounds();
  stopCoreTntBonusImpactSounds();
  stopFlowerOwnedVoices();
}

export function resetFlowerMerge6SoundCacheForTests(): void {
  stopFlowerMerge6Sounds();
  resetRegularMerge6SoundCacheForTests();
  mediaAudioBySource.clear();
}
