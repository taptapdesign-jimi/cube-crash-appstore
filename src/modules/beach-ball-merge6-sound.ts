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
  './assets/sound/Wild and special kockice/ball/ball5-60pct.wav';
export const BEACH_BALL_MERGE6_IMPACT_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/ball/ball impact.mp3';
export const BEACH_BALL_MERGE6_BALL4_DELAY_MS = 0;
export const BEACH_BALL_MERGE6_BALL5_DELAY_MS = 100;
export const BEACH_BALL_MERGE6_BALL5_PLAYBACK_RATE = 1.8;
export const BEACH_BALL_MERGE6_BALL5_SOURCE_DURATION_SECONDS = 1.2;
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

export const BEACH_BALL_MERGE6_IMMEDIATE_SOUND_SOURCES = Object.freeze([
  BEACH_BALL_MERGE6_BALL1_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BALL4_SOUND_SOURCE,
] as const);

const BEACH_BALL_MERGE6_SOUND_SOURCES = [
  BEACH_BALL_MERGE6_BALL1_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BALL4_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BALL5_SOUND_SOURCE,
  BEACH_BALL_MERGE6_IMPACT_SOUND_SOURCE,
] as const;
const BEACH_BALL_MERGE6_VOICE_ID = Object.freeze({
  ball1: 'beach-ball-merge6-ball1',
  ball2: 'beach-ball-merge6-ball2',
  ball4: 'beach-ball-merge6-ball4',
  ball5: 'beach-ball-merge6-ball5',
  impact: 'beach-ball-merge6-impact',
});
const BEACH_BALL_MERGE6_VOICE_IDS = Object.values(BEACH_BALL_MERGE6_VOICE_ID);

const mediaAudioBySource = new Map<string, HTMLAudioElement>();
let ball5StartTimer: number | null = null;

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

function startMediaLayer(
  audio: HTMLAudioElement,
  volume: number,
  label: string,
  playbackRate: number = 1,
): void {
  audio.pause();
  audio.defaultPlaybackRate = playbackRate;
  audio.playbackRate = playbackRate;
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play()?.catch((error) => {
    logger.warn(`Failed to play Beach Ball merge-6 ${label} layer:`, error);
  });
}

function clearBall5StartTimer(): void {
  if (ball5StartTimer === null || typeof window === 'undefined') return;
  window.clearTimeout(ball5StartTimer);
  ball5StartTimer = null;
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
  const decodedState = getDecodedGameplaySoundsState(BEACH_BALL_MERGE6_SOUND_SOURCES);

  if (decodedState !== 'unavailable') {
    stopDecodedGameplayVoices(BEACH_BALL_MERGE6_VOICE_IDS);
    const results = [
      playDecodedGameplaySound(BEACH_BALL_MERGE6_IMPACT_SOUND_SOURCE, {
        voiceId: BEACH_BALL_MERGE6_VOICE_ID.impact,
        volume: BEACH_BALL_MERGE6_IMPACT_VOLUME,
      }),
      playDecodedGameplaySound(BEACH_BALL_MERGE6_BALL1_SOUND_SOURCE, {
        voiceId: BEACH_BALL_MERGE6_VOICE_ID.ball1,
        volume: BEACH_BALL_MERGE6_LAYER_VOLUME,
      }),
      playDecodedGameplaySound(BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE, {
        voiceId: BEACH_BALL_MERGE6_VOICE_ID.ball2,
        volume: BEACH_BALL_MERGE6_LAYER_VOLUME,
      }),
      playDecodedGameplaySound(BEACH_BALL_MERGE6_BALL4_SOUND_SOURCE, {
        voiceId: BEACH_BALL_MERGE6_VOICE_ID.ball4,
        volume: BEACH_BALL_MERGE6_LAYER_VOLUME,
      }),
      playDecodedGameplaySound(BEACH_BALL_MERGE6_BALL5_SOUND_SOURCE, {
        voiceId: BEACH_BALL_MERGE6_VOICE_ID.ball5,
        volume: BEACH_BALL_MERGE6_LAYER_VOLUME,
        playbackRate: BEACH_BALL_MERGE6_BALL5_PLAYBACK_RATE,
        startDelaySeconds: BEACH_BALL_MERGE6_BALL5_DELAY_MS / 1000,
      }),
    ];
    return ordinaryMergeStarted && results.every((result) => result !== 'unavailable');
  }

  const impact = getMediaAudio(BEACH_BALL_MERGE6_IMPACT_SOUND_SOURCE);
  const ball1 = getMediaAudio(BEACH_BALL_MERGE6_BALL1_SOUND_SOURCE);
  const ball2 = getMediaAudio(BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE);
  const ball4 = getMediaAudio(BEACH_BALL_MERGE6_BALL4_SOUND_SOURCE);
  const ball5 = getMediaAudio(BEACH_BALL_MERGE6_BALL5_SOUND_SOURCE);
  if (!impact || !ball1 || !ball2 || !ball4 || !ball5) return false;

  try {
    clearBall5StartTimer();
    BEACH_BALL_MERGE6_SOUND_SOURCES.forEach((source) => {
      const audio = mediaAudioBySource.get(source);
      if (!audio) return;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    });
    startMediaLayer(impact, BEACH_BALL_MERGE6_IMPACT_VOLUME, 'impact');
    startMediaLayer(ball1, BEACH_BALL_MERGE6_LAYER_VOLUME, 'ball1');
    startMediaLayer(ball2, BEACH_BALL_MERGE6_LAYER_VOLUME, 'ball2');
    startMediaLayer(ball4, BEACH_BALL_MERGE6_LAYER_VOLUME, 'ball4');
    ball5StartTimer = window.setTimeout(() => {
      ball5StartTimer = null;
      if (!areBeachBallMerge6SoundsEnabled()) return;
      startMediaLayer(
        ball5,
        BEACH_BALL_MERGE6_LAYER_VOLUME,
        'ball5',
        BEACH_BALL_MERGE6_BALL5_PLAYBACK_RATE,
      );
    }, BEACH_BALL_MERGE6_BALL5_DELAY_MS);
    return ordinaryMergeStarted;
  } catch (error) {
    logger.warn('Failed to start Beach Ball merge-6 sounds:', error);
    return false;
  }
}

export function stopBeachBallMerge6Sounds(): void {
  clearBall5StartTimer();
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
