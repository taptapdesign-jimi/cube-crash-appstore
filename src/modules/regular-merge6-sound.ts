import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const REGULAR_MERGE6_SOUND_SOURCE =
  './assets/sound/merge 6/merge six obicna.mp3';
export const REGULAR_MERGE6_SOUND_PLAYBACK_RATE = 1.3;
export const REGULAR_MERGE6_SOUND_BASE_VOLUME = 0.5;
export const REGULAR_MERGE6_SOUND_VOLUME = applySoundEffectsMasterGain(
  REGULAR_MERGE6_SOUND_BASE_VOLUME,
);
export const REGULAR_MERGE6_CRASH_SOUND_SOURCE =
  './assets/sound/merge 6/merge6 crash.mp3';
export const REGULAR_MERGE6_CRASH_PLAYBACK_RATE = 1.3;
export const REGULAR_MERGE6_CRASH_BASE_VOLUME = 0.272;
export const REGULAR_MERGE6_CRASH_VOLUME = applySoundEffectsMasterGain(
  REGULAR_MERGE6_CRASH_BASE_VOLUME,
);
export const REGULAR_MERGE6_CRASH_SOURCE_DURATION_MS = 2040;
export const REGULAR_MERGE6_CRASH_KEEP_RATIO = 0.6;
export const REGULAR_MERGE6_CRASH_BASE_AUDIBLE_DURATION_MS = Math.round(
  REGULAR_MERGE6_CRASH_SOURCE_DURATION_MS *
    REGULAR_MERGE6_CRASH_KEEP_RATIO /
    REGULAR_MERGE6_CRASH_PLAYBACK_RATE,
);
export const REGULAR_MERGE6_CRASH_LENGTH_REDUCTION_MS = 50;
export const REGULAR_MERGE6_CRASH_AUDIBLE_DURATION_MS = Math.max(
  0,
  REGULAR_MERGE6_CRASH_BASE_AUDIBLE_DURATION_MS -
    REGULAR_MERGE6_CRASH_LENGTH_REDUCTION_MS,
);
export const REGULAR_MERGE6_CRASH_FADE_OUT_DURATION_MS = 120;
export const REGULAR_MERGE6_BOOM_SOUND_SOURCE =
  './assets/sound/merge 6/merge6 boom.mp3';
export const REGULAR_MERGE6_BOOM_BASE_VOLUME = 0.6;
export const REGULAR_MERGE6_BOOM_VOLUME = applySoundEffectsMasterGain(
  REGULAR_MERGE6_BOOM_BASE_VOLUME,
);
export const REGULAR_MERGE6_STACK_SOUND_SOURCE =
  './assets/sound/merge 6/stack.mp3';
export const REGULAR_MERGE6_STACK_BASE_VOLUME = 0.8;
export const REGULAR_MERGE6_STACK_VOLUME = applySoundEffectsMasterGain(
  REGULAR_MERGE6_STACK_BASE_VOLUME,
);

let primaryAudio: HTMLAudioElement | null = null;
let crashAudio: HTMLAudioElement | null = null;
let boomAudio: HTMLAudioElement | null = null;
let stackAudio: HTMLAudioElement | null = null;
let crashFadeStartTimer: number | null = null;
let crashFadeInterval: number | null = null;
let crashStopTimer: number | null = null;
const REGULAR_MERGE6_SOUND_SOURCES = [
  REGULAR_MERGE6_SOUND_SOURCE,
  REGULAR_MERGE6_CRASH_SOUND_SOURCE,
  REGULAR_MERGE6_BOOM_SOUND_SOURCE,
  REGULAR_MERGE6_STACK_SOUND_SOURCE,
] as const;
const REGULAR_MERGE6_VOICE_IDS = [
  'regular-merge6-primary',
  'regular-merge6-crash',
  'regular-merge6-boom',
  'regular-merge6-stack',
] as const;

export function areRegularMerge6SoundsEnabled(): boolean {
  return typeof window !== 'undefined' &&
    (window as any)._settings?.gameSoundsEnabled === true;
}

function createAudio(source: string): HTMLAudioElement | null {
  if (typeof Audio !== 'function') return null;
  const audio = new Audio(source);
  audio.preload = 'auto';
  try { audio.load(); } catch {}
  return audio;
}

function getPrimaryAudio(): HTMLAudioElement | null {
  primaryAudio ??= createAudio(REGULAR_MERGE6_SOUND_SOURCE);
  return primaryAudio;
}

function getCrashAudio(): HTMLAudioElement | null {
  crashAudio ??= createAudio(REGULAR_MERGE6_CRASH_SOUND_SOURCE);
  return crashAudio;
}

function getBoomAudio(): HTMLAudioElement | null {
  boomAudio ??= createAudio(REGULAR_MERGE6_BOOM_SOUND_SOURCE);
  return boomAudio;
}

function getStackAudio(): HTMLAudioElement | null {
  stackAudio ??= createAudio(REGULAR_MERGE6_STACK_SOUND_SOURCE);
  return stackAudio;
}

export function preloadRegularMerge6Sounds(): boolean {
  if (!areRegularMerge6SoundsEnabled()) return false;
  if (preloadDecodedGameplaySounds(REGULAR_MERGE6_SOUND_SOURCES)) return true;
  return getPrimaryAudio() !== null
    && getCrashAudio() !== null
    && getBoomAudio() !== null
    && getStackAudio() !== null;
}

function clearCrashTimers(): void {
  if (typeof window === 'undefined') return;
  if (crashFadeStartTimer !== null) {
    window.clearTimeout(crashFadeStartTimer);
    crashFadeStartTimer = null;
  }
  if (crashFadeInterval !== null) {
    window.clearInterval(crashFadeInterval);
    crashFadeInterval = null;
  }
  if (crashStopTimer !== null) {
    window.clearTimeout(crashStopTimer);
    crashStopTimer = null;
  }
}

function startCrashFadeOut(audio: HTMLAudioElement): void {
  const fadeStartedAt = Date.now();
  crashFadeInterval = window.setInterval(() => {
    const fadeProgress = Math.min(
      1,
      (Date.now() - fadeStartedAt) / REGULAR_MERGE6_CRASH_FADE_OUT_DURATION_MS,
    );
    audio.volume = REGULAR_MERGE6_CRASH_VOLUME * (1 - fadeProgress);
    if (fadeProgress >= 1 && crashFadeInterval !== null) {
      window.clearInterval(crashFadeInterval);
      crashFadeInterval = null;
    }
  }, 20);
}

function startAudio(
  audio: HTMLAudioElement,
  volume: number,
  playbackRate: number,
  label: string,
): void {
  audio.pause();
  audio.defaultPlaybackRate = playbackRate;
  audio.playbackRate = playbackRate;
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play()?.catch((error) => {
    logger.warn(`Failed to play regular merge-6 ${label}:`, error);
  });
}

export function playRegularMerge6Sound(): boolean {
  if (!areRegularMerge6SoundsEnabled()) return false;

  const decodedState = getDecodedGameplaySoundsState(REGULAR_MERGE6_SOUND_SOURCES);
  if (decodedState !== 'unavailable') {
    clearCrashTimers();
    stopDecodedGameplayVoices(REGULAR_MERGE6_VOICE_IDS);
    const results = [
      playDecodedGameplaySound(REGULAR_MERGE6_SOUND_SOURCE, {
        voiceId: REGULAR_MERGE6_VOICE_IDS[0],
        volume: REGULAR_MERGE6_SOUND_VOLUME,
        playbackRate: REGULAR_MERGE6_SOUND_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(REGULAR_MERGE6_CRASH_SOUND_SOURCE, {
        voiceId: REGULAR_MERGE6_VOICE_IDS[1],
        volume: REGULAR_MERGE6_CRASH_VOLUME,
        playbackRate: REGULAR_MERGE6_CRASH_PLAYBACK_RATE,
        stopAfterSeconds: REGULAR_MERGE6_CRASH_AUDIBLE_DURATION_MS / 1000,
        fadeOutSeconds: REGULAR_MERGE6_CRASH_FADE_OUT_DURATION_MS / 1000,
      }),
      playDecodedGameplaySound(REGULAR_MERGE6_BOOM_SOUND_SOURCE, {
        voiceId: REGULAR_MERGE6_VOICE_IDS[2],
        volume: REGULAR_MERGE6_BOOM_VOLUME,
      }),
      playDecodedGameplaySound(REGULAR_MERGE6_STACK_SOUND_SOURCE, {
        voiceId: REGULAR_MERGE6_VOICE_IDS[3],
        volume: REGULAR_MERGE6_STACK_VOLUME,
      }),
    ];
    return results.every((result) => result !== 'unavailable');
  }

  const primary = getPrimaryAudio();
  const crash = getCrashAudio();
  const boom = getBoomAudio();
  const stack = getStackAudio();
  if (!primary || !crash || !boom || !stack) return false;

  try {
    clearCrashTimers();
    startAudio(
      primary,
      REGULAR_MERGE6_SOUND_VOLUME,
      REGULAR_MERGE6_SOUND_PLAYBACK_RATE,
      'sound',
    );
    startAudio(
      crash,
      REGULAR_MERGE6_CRASH_VOLUME,
      REGULAR_MERGE6_CRASH_PLAYBACK_RATE,
      'crash layer',
    );
    startAudio(boom, REGULAR_MERGE6_BOOM_VOLUME, 1, 'boom layer');
    startAudio(stack, REGULAR_MERGE6_STACK_VOLUME, 1, 'stack layer');
    crashFadeStartTimer = window.setTimeout(() => {
      crashFadeStartTimer = null;
      startCrashFadeOut(crash);
    }, Math.max(
      0,
      REGULAR_MERGE6_CRASH_AUDIBLE_DURATION_MS -
        REGULAR_MERGE6_CRASH_FADE_OUT_DURATION_MS,
    ));
    crashStopTimer = window.setTimeout(() => {
      crashStopTimer = null;
      if (crashFadeInterval !== null) {
        window.clearInterval(crashFadeInterval);
        crashFadeInterval = null;
      }
      try {
        crash.volume = 0;
        crash.pause();
        crash.currentTime = 0;
      } catch {}
    }, REGULAR_MERGE6_CRASH_AUDIBLE_DURATION_MS);
    return true;
  } catch (error) {
    logger.warn('Failed to start regular merge-6 sounds:', error);
    return false;
  }
}

export function stopRegularMerge6Sounds(): void {
  clearCrashTimers();
  stopDecodedGameplayVoices(REGULAR_MERGE6_VOICE_IDS);
  for (const audio of [primaryAudio, crashAudio, boomAudio, stackAudio]) {
    if (!audio) continue;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  }
}

export function resetRegularMerge6SoundCacheForTests(): void {
  stopRegularMerge6Sounds();
  primaryAudio = null;
  crashAudio = null;
  boomAudio = null;
  stackAudio = null;
}
