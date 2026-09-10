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
  playRegularMerge6Sound,
  preloadRegularMerge6Sounds,
  resetRegularMerge6SoundCacheForTests,
  stopRegularMerge6Sounds,
} from './regular-merge6-sound.ts';

export const BEACH_BALL_MERGE6_BALL1_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/ball/ball1.wav';
export const BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/ball/ball2.wav';
export const BEACH_BALL_MERGE6_BALL4_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/ball/ball4.wav';
export const BEACH_BALL_MERGE6_BALL5_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/ball/ball5.wav';
export const BEACH_BALL_MERGE6_IMPACT_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/ball/ball impact.mp3';
export const BEACH_BALL_MERGE6_BALL4_DELAY_MS = 0;
export const BEACH_BALL_MERGE6_BALL5_DELAY_MS = 100;
export const BEACH_BALL_MERGE6_LAYER_BASE_VOLUME = 2 / 3;
export const BEACH_BALL_MERGE6_LAYER_VOLUME = applySoundEffectsMasterGain(
  BEACH_BALL_MERGE6_LAYER_BASE_VOLUME,
);
export const BEACH_BALL_MERGE6_IMPACT_BASE_VOLUME = 0.5;
export const BEACH_BALL_MERGE6_IMPACT_VOLUME = applySoundEffectsMasterGain(
  BEACH_BALL_MERGE6_IMPACT_BASE_VOLUME,
);

// Beach Ball deliberately inherits the complete ordinary Merge-6 mix. These
// aliases make that shared foundation explicit and prevent a second base mix.
export const BEACH_BALL_MERGE6_PRIMARY_SOUND_SOURCE = REGULAR_MERGE6_SOUND_SOURCE;
export const BEACH_BALL_MERGE6_PRIMARY_PLAYBACK_RATE = REGULAR_MERGE6_SOUND_PLAYBACK_RATE;
export const BEACH_BALL_MERGE6_PRIMARY_BASE_VOLUME = REGULAR_MERGE6_SOUND_BASE_VOLUME;
export const BEACH_BALL_MERGE6_PRIMARY_VOLUME = REGULAR_MERGE6_SOUND_VOLUME;
export const BEACH_BALL_MERGE6_CRASH_SOUND_SOURCE = REGULAR_MERGE6_CRASH_SOUND_SOURCE;
export const BEACH_BALL_MERGE6_CRASH_PLAYBACK_RATE = REGULAR_MERGE6_CRASH_PLAYBACK_RATE;
export const BEACH_BALL_MERGE6_CRASH_BASE_VOLUME = REGULAR_MERGE6_CRASH_BASE_VOLUME;
export const BEACH_BALL_MERGE6_CRASH_VOLUME = REGULAR_MERGE6_CRASH_VOLUME;
export const BEACH_BALL_MERGE6_BOOM_SOUND_SOURCE = REGULAR_MERGE6_BOOM_SOUND_SOURCE;
export const BEACH_BALL_MERGE6_BOOM_BASE_VOLUME = REGULAR_MERGE6_BOOM_BASE_VOLUME;
export const BEACH_BALL_MERGE6_BOOM_VOLUME = REGULAR_MERGE6_BOOM_VOLUME;
export const BEACH_BALL_MERGE6_STACK_SOUND_SOURCE = REGULAR_MERGE6_STACK_SOUND_SOURCE;
export const BEACH_BALL_MERGE6_STACK_BASE_VOLUME = REGULAR_MERGE6_STACK_BASE_VOLUME;
export const BEACH_BALL_MERGE6_STACK_VOLUME = REGULAR_MERGE6_STACK_VOLUME;

export type BeachBallMerge6Variant = Readonly<{
  primarySource: string;
  secondarySource: string;
  secondaryDelayMs: number;
}>;

export const BEACH_BALL_MERGE6_VARIANTS: readonly BeachBallMerge6Variant[] = Object.freeze([
  Object.freeze({
    primarySource: BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE,
    secondarySource: BEACH_BALL_MERGE6_BALL4_SOUND_SOURCE,
    secondaryDelayMs: BEACH_BALL_MERGE6_BALL4_DELAY_MS,
  }),
  Object.freeze({
    primarySource: BEACH_BALL_MERGE6_BALL1_SOUND_SOURCE,
    secondarySource: BEACH_BALL_MERGE6_BALL5_SOUND_SOURCE,
    secondaryDelayMs: BEACH_BALL_MERGE6_BALL5_DELAY_MS,
  }),
]);

const BEACH_BALL_MERGE6_SOUND_SOURCES = [
  BEACH_BALL_MERGE6_BALL1_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BALL4_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BALL5_SOUND_SOURCE,
  BEACH_BALL_MERGE6_IMPACT_SOUND_SOURCE,
] as const;
const BEACH_BALL_MERGE6_VOICE_IDS = [
  'beach-ball-merge6-primary',
  'beach-ball-merge6-secondary',
  'beach-ball-merge6-impact',
] as const;

const mediaAudioBySource = new Map<string, HTMLAudioElement>();
let secondaryStartTimer: number | null = null;

export interface BeachBallMerge6SoundEvent {
  effectiveSum: number;
  srcSpecialDiceVariantId?: string | null;
  dstSpecialDiceVariantId?: string | null;
}

export function isBeachBallMerge6SoundEvent(event: BeachBallMerge6SoundEvent): boolean {
  return event.effectiveSum === 6 && (
    event.srcSpecialDiceVariantId === 'beach-ball' ||
    event.dstSpecialDiceVariantId === 'beach-ball'
  );
}

export function areBeachBallMerge6SoundsEnabled(): boolean {
  return typeof window !== 'undefined' &&
    (window as any)._settings?.gameSoundsEnabled === true;
}

export function selectBeachBallMerge6Variant(
  randomValue: number = Math.random(),
): BeachBallMerge6Variant {
  return randomValue < 0.5
    ? BEACH_BALL_MERGE6_VARIANTS[0]
    : BEACH_BALL_MERGE6_VARIANTS[1];
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
  audio.defaultPlaybackRate = 1;
  audio.playbackRate = 1;
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play()?.catch((error) => {
    logger.warn(`Failed to play Beach Ball merge-6 ${label} layer:`, error);
  });
}

function clearSecondaryStartTimer(): void {
  if (secondaryStartTimer === null || typeof window === 'undefined') return;
  window.clearTimeout(secondaryStartTimer);
  secondaryStartTimer = null;
}

export function preloadBeachBallMerge6Sounds(): boolean {
  if (!areBeachBallMerge6SoundsEnabled()) return false;
  const ordinaryMergeReady = preloadRegularMerge6Sounds();
  const ballLayersReady = preloadDecodedGameplaySounds(BEACH_BALL_MERGE6_SOUND_SOURCES)
    || BEACH_BALL_MERGE6_SOUND_SOURCES.every((source) => getMediaAudio(source) !== null);
  return ordinaryMergeReady && ballLayersReady;
}

export function playBeachBallMerge6Sound(): boolean {
  if (!areBeachBallMerge6SoundsEnabled()) return false;
  const ordinaryMergeStarted = playRegularMerge6Sound();
  const variant = selectBeachBallMerge6Variant();
  const decodedState = getDecodedGameplaySoundsState(BEACH_BALL_MERGE6_SOUND_SOURCES);

  if (decodedState !== 'unavailable') {
    stopDecodedGameplayVoices(BEACH_BALL_MERGE6_VOICE_IDS);
    const results = [
      playDecodedGameplaySound(BEACH_BALL_MERGE6_IMPACT_SOUND_SOURCE, {
        voiceId: BEACH_BALL_MERGE6_VOICE_IDS[2],
        volume: BEACH_BALL_MERGE6_IMPACT_VOLUME,
      }),
      playDecodedGameplaySound(variant.primarySource, {
        voiceId: BEACH_BALL_MERGE6_VOICE_IDS[0],
        volume: BEACH_BALL_MERGE6_LAYER_VOLUME,
      }),
      playDecodedGameplaySound(variant.secondarySource, {
        voiceId: BEACH_BALL_MERGE6_VOICE_IDS[1],
        volume: BEACH_BALL_MERGE6_LAYER_VOLUME,
        startDelaySeconds: variant.secondaryDelayMs / 1000,
      }),
    ];
    return ordinaryMergeStarted && results.every((result) => result !== 'unavailable');
  }

  const impact = getMediaAudio(BEACH_BALL_MERGE6_IMPACT_SOUND_SOURCE);
  const primary = getMediaAudio(variant.primarySource);
  const secondary = getMediaAudio(variant.secondarySource);
  if (!impact || !primary || !secondary) return false;

  try {
    clearSecondaryStartTimer();
    BEACH_BALL_MERGE6_SOUND_SOURCES.forEach((source) => {
      const audio = mediaAudioBySource.get(source);
      if (!audio) return;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    });
    startMediaLayer(impact, BEACH_BALL_MERGE6_IMPACT_VOLUME, 'impact');
    startMediaLayer(primary, BEACH_BALL_MERGE6_LAYER_VOLUME, 'primary');
    if (variant.secondaryDelayMs === 0) {
      startMediaLayer(secondary, BEACH_BALL_MERGE6_LAYER_VOLUME, 'secondary');
    } else {
      secondaryStartTimer = window.setTimeout(() => {
        secondaryStartTimer = null;
        if (!areBeachBallMerge6SoundsEnabled()) return;
        startMediaLayer(secondary, BEACH_BALL_MERGE6_LAYER_VOLUME, 'secondary');
      }, variant.secondaryDelayMs);
    }
    return ordinaryMergeStarted;
  } catch (error) {
    logger.warn('Failed to start Beach Ball merge-6 sounds:', error);
    return false;
  }
}

export function stopBeachBallMerge6Sounds(): void {
  clearSecondaryStartTimer();
  stopRegularMerge6Sounds();
  stopDecodedGameplayVoices(BEACH_BALL_MERGE6_VOICE_IDS);
  mediaAudioBySource.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetBeachBallMerge6SoundCacheForTests(): void {
  stopBeachBallMerge6Sounds();
  resetRegularMerge6SoundCacheForTests();
  mediaAudioBySource.clear();
}
