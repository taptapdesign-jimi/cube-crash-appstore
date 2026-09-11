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

const FISH_SOUND_BASE = './assets/sound/Wild and special kockice/fish/';

export const FISH_MERGE6_FISH0_SOUND_SOURCE = `${FISH_SOUND_BASE}fish0.wav`;
export const FISH_MERGE6_FISH1_SOUND_SOURCE = `${FISH_SOUND_BASE}fish1.wav`;
export const FISH_MERGE6_FISH2_SOUND_SOURCE = `${FISH_SOUND_BASE}fish2.wav`;
export const FISH_MERGE6_PLOMP_SOUND_SOURCE = `${FISH_SOUND_BASE}plomp.wav`;
export const FISH_MERGE6_SPEAKS_SOUND_SOURCE = `${FISH_SOUND_BASE}fish speaks.wav`;
export const FISH_MERGE6_SOUND_PLAYBACK_RATE = 1;

// Fish shares the 3.6-second Wild Star finale contract. The second long cue
// enters at the exact visual midpoint rather than from an unrelated timer.
export const FISH_MERGE6_VISUAL_DURATION_MS = 3600;
export const FISH_MERGE6_FISH2_START_RATIO = 0.5;
export const FISH_MERGE6_FISH2_DELAY_MS =
  FISH_MERGE6_VISUAL_DURATION_MS * FISH_MERGE6_FISH2_START_RATIO;

// fish0 peaks at 0dBFS, so its lower gain keeps the immediate layered hit in
// the same range as the naturally quieter fish1 and delayed fish2 sources.
export const FISH_MERGE6_FISH0_BASE_VOLUME = 0.4;
export const FISH_MERGE6_FISH1_BASE_VOLUME = 2 / 3;
export const FISH_MERGE6_FISH2_BASE_VOLUME = 2 / 3;
// plomp peaks at -3.7dBFS. Matching the quieter Fish layers keeps its short
// water impact audible without overpowering the inherited Merge-6 foundation.
export const FISH_MERGE6_PLOMP_BASE_VOLUME = 2 / 3;
// fish speaks reaches 0dBFS with a dense -8.1dBFS RMS body. Match fish0's
// conservative gain so the voice reads above the mix without clipping it.
export const FISH_MERGE6_SPEAKS_BASE_VOLUME = 0.4;
export const FISH_MERGE6_FISH0_VOLUME = applySoundEffectsMasterGain(FISH_MERGE6_FISH0_BASE_VOLUME);
export const FISH_MERGE6_FISH1_VOLUME = applySoundEffectsMasterGain(FISH_MERGE6_FISH1_BASE_VOLUME);
export const FISH_MERGE6_FISH2_VOLUME = applySoundEffectsMasterGain(FISH_MERGE6_FISH2_BASE_VOLUME);
export const FISH_MERGE6_PLOMP_VOLUME = applySoundEffectsMasterGain(FISH_MERGE6_PLOMP_BASE_VOLUME);
export const FISH_MERGE6_SPEAKS_VOLUME = applySoundEffectsMasterGain(FISH_MERGE6_SPEAKS_BASE_VOLUME);

// Fish deliberately inherits the complete ordinary Merge-6 mix without
// recreating or retiming any of its four established layers.
export const FISH_MERGE6_PRIMARY_SOUND_SOURCE = REGULAR_MERGE6_SOUND_SOURCE;
export const FISH_MERGE6_PRIMARY_PLAYBACK_RATE = REGULAR_MERGE6_SOUND_PLAYBACK_RATE;
export const FISH_MERGE6_PRIMARY_BASE_VOLUME = REGULAR_MERGE6_SOUND_BASE_VOLUME;
export const FISH_MERGE6_PRIMARY_VOLUME = REGULAR_MERGE6_SOUND_VOLUME;
export const FISH_MERGE6_CRASH_SOUND_SOURCE = REGULAR_MERGE6_CRASH_SOUND_SOURCE;
export const FISH_MERGE6_CRASH_PLAYBACK_RATE = REGULAR_MERGE6_CRASH_PLAYBACK_RATE;
export const FISH_MERGE6_CRASH_BASE_VOLUME = REGULAR_MERGE6_CRASH_BASE_VOLUME;
export const FISH_MERGE6_CRASH_VOLUME = REGULAR_MERGE6_CRASH_VOLUME;
export const FISH_MERGE6_BOOM_SOUND_SOURCE = REGULAR_MERGE6_BOOM_SOUND_SOURCE;
export const FISH_MERGE6_BOOM_BASE_VOLUME = REGULAR_MERGE6_BOOM_BASE_VOLUME;
export const FISH_MERGE6_BOOM_VOLUME = REGULAR_MERGE6_BOOM_VOLUME;
export const FISH_MERGE6_STACK_SOUND_SOURCE = REGULAR_MERGE6_STACK_SOUND_SOURCE;
export const FISH_MERGE6_STACK_BASE_VOLUME = REGULAR_MERGE6_STACK_BASE_VOLUME;
export const FISH_MERGE6_STACK_VOLUME = REGULAR_MERGE6_STACK_VOLUME;

const FISH_MERGE6_SOUND_SOURCES = [
  FISH_MERGE6_FISH0_SOUND_SOURCE,
  FISH_MERGE6_FISH1_SOUND_SOURCE,
  FISH_MERGE6_FISH2_SOUND_SOURCE,
  FISH_MERGE6_PLOMP_SOUND_SOURCE,
  FISH_MERGE6_SPEAKS_SOUND_SOURCE,
] as const;
const FISH_MERGE6_VOICE_ID = Object.freeze({
  fish0: 'fish-merge6-fish0',
  fish1: 'fish-merge6-fish1',
  fish2: 'fish-merge6-fish2',
  plomp: 'fish-merge6-plomp',
  speaks: 'fish-merge6-speaks',
});
const FISH_MERGE6_VOICE_IDS = Object.values(FISH_MERGE6_VOICE_ID);

const mediaAudioBySource = new Map<string, HTMLAudioElement>();
let fish2StartTimer: number | null = null;

export interface FishMerge6SoundEvent {
  effectiveSum: number;
  srcSpecialDiceVariantId?: string | null;
  dstSpecialDiceVariantId?: string | null;
}

export function isFishMerge6SoundEvent(event: FishMerge6SoundEvent): boolean {
  return event.effectiveSum === 6 && (
    event.srcSpecialDiceVariantId === 'fish'
    || event.dstSpecialDiceVariantId === 'fish'
  );
}

export function areFishMerge6SoundsEnabled(): boolean {
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

function startMediaLayer(
  audio: HTMLAudioElement,
  volume: number,
  label: string,
): void {
  audio.pause();
  audio.defaultPlaybackRate = FISH_MERGE6_SOUND_PLAYBACK_RATE;
  audio.playbackRate = FISH_MERGE6_SOUND_PLAYBACK_RATE;
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play()?.catch((error) => {
    logger.warn(`Failed to play Fish merge-6 ${label} layer:`, error);
  });
}

function clearFish2StartTimer(): void {
  if (fish2StartTimer === null || typeof window === 'undefined') return;
  window.clearTimeout(fish2StartTimer);
  fish2StartTimer = null;
}

export function preloadFishMerge6Sounds(): boolean {
  if (!areFishMerge6SoundsEnabled()) return false;
  const ordinaryMergeReady = preloadRegularMerge6Sounds();
  const fishLayersReady = preloadDecodedGameplaySounds(FISH_MERGE6_SOUND_SOURCES)
    || FISH_MERGE6_SOUND_SOURCES.every((source) => getMediaAudio(source) !== null);
  return ordinaryMergeReady && fishLayersReady;
}

export function playFishMerge6Sound(): boolean {
  if (!areFishMerge6SoundsEnabled()) return false;
  const ordinaryMergeStarted = playRegularMerge6Sound();
  const decodedState = getDecodedGameplaySoundsState(FISH_MERGE6_SOUND_SOURCES);

  if (decodedState !== 'unavailable') {
    stopDecodedGameplayVoices(FISH_MERGE6_VOICE_IDS);
    const results = [
      playDecodedGameplaySound(FISH_MERGE6_FISH0_SOUND_SOURCE, {
        voiceId: FISH_MERGE6_VOICE_ID.fish0,
        volume: FISH_MERGE6_FISH0_VOLUME,
        playbackRate: FISH_MERGE6_SOUND_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(FISH_MERGE6_FISH1_SOUND_SOURCE, {
        voiceId: FISH_MERGE6_VOICE_ID.fish1,
        volume: FISH_MERGE6_FISH1_VOLUME,
        playbackRate: FISH_MERGE6_SOUND_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(FISH_MERGE6_PLOMP_SOUND_SOURCE, {
        voiceId: FISH_MERGE6_VOICE_ID.plomp,
        volume: FISH_MERGE6_PLOMP_VOLUME,
        playbackRate: FISH_MERGE6_SOUND_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(FISH_MERGE6_SPEAKS_SOUND_SOURCE, {
        voiceId: FISH_MERGE6_VOICE_ID.speaks,
        volume: FISH_MERGE6_SPEAKS_VOLUME,
        playbackRate: FISH_MERGE6_SOUND_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(FISH_MERGE6_FISH2_SOUND_SOURCE, {
        voiceId: FISH_MERGE6_VOICE_ID.fish2,
        volume: FISH_MERGE6_FISH2_VOLUME,
        playbackRate: FISH_MERGE6_SOUND_PLAYBACK_RATE,
        startDelaySeconds: FISH_MERGE6_FISH2_DELAY_MS / 1000,
      }),
    ];
    return ordinaryMergeStarted && results.every((result) => result !== 'unavailable');
  }

  const fish0 = getMediaAudio(FISH_MERGE6_FISH0_SOUND_SOURCE);
  const fish1 = getMediaAudio(FISH_MERGE6_FISH1_SOUND_SOURCE);
  const fish2 = getMediaAudio(FISH_MERGE6_FISH2_SOUND_SOURCE);
  const plomp = getMediaAudio(FISH_MERGE6_PLOMP_SOUND_SOURCE);
  const speaks = getMediaAudio(FISH_MERGE6_SPEAKS_SOUND_SOURCE);
  if (!fish0 || !fish1 || !fish2 || !plomp || !speaks) return false;

  try {
    clearFish2StartTimer();
    FISH_MERGE6_SOUND_SOURCES.forEach((source) => {
      const audio = mediaAudioBySource.get(source);
      if (!audio) return;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    });
    startMediaLayer(fish0, FISH_MERGE6_FISH0_VOLUME, 'fish0');
    startMediaLayer(fish1, FISH_MERGE6_FISH1_VOLUME, 'fish1');
    startMediaLayer(plomp, FISH_MERGE6_PLOMP_VOLUME, 'plomp');
    startMediaLayer(speaks, FISH_MERGE6_SPEAKS_VOLUME, 'fish speaks');
    fish2StartTimer = window.setTimeout(() => {
      fish2StartTimer = null;
      if (!areFishMerge6SoundsEnabled()) return;
      startMediaLayer(fish2, FISH_MERGE6_FISH2_VOLUME, 'fish2');
    }, FISH_MERGE6_FISH2_DELAY_MS);
    return ordinaryMergeStarted;
  } catch (error) {
    logger.warn('Failed to start Fish merge-6 sounds:', error);
    return false;
  }
}

export function stopFishMerge6Sounds(): void {
  clearFish2StartTimer();
  stopRegularMerge6Sounds();
  stopDecodedGameplayVoices(FISH_MERGE6_VOICE_IDS);
  mediaAudioBySource.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetFishMerge6SoundCacheForTests(): void {
  stopFishMerge6Sounds();
  resetRegularMerge6SoundCacheForTests();
  mediaAudioBySource.clear();
}
