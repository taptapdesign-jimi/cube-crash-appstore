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

export const CORE_TNT_MERGE6_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/tnt/tnt3.wav';
export const CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/tnt/wood break.wav';
export const CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/tnt/wood ssplinter.wav';
export const CORE_TNT_MERGE6_SOUND_PLAYBACK_RATE = 1;
export const CORE_TNT_MERGE6_SOUND_BASE_VOLUME = 0.7;
export const CORE_TNT_MERGE6_SOUND_VOLUME = applySoundEffectsMasterGain(
  CORE_TNT_MERGE6_SOUND_BASE_VOLUME,
);
export const CORE_TNT_MERGE6_WOOD_PLAYBACK_RATE = 1;
export const CORE_TNT_MERGE6_WOOD_BASE_VOLUME = 0.9;
export const CORE_TNT_MERGE6_WOOD_VOLUME = applySoundEffectsMasterGain(
  CORE_TNT_MERGE6_WOOD_BASE_VOLUME,
);
export const CORE_TNT_MERGE6_WOOD_BREAK_DELAY_MS = 0;
export const CORE_TNT_MERGE6_WOOD_SPLINTER_DELAY_MS = 100;

// Core TNT deliberately reuses the complete ordinary Merge-6 owner. These
// aliases make that shared foundation explicit without duplicating its mix.
export const CORE_TNT_MERGE6_PRIMARY_SOUND_SOURCE = REGULAR_MERGE6_SOUND_SOURCE;
export const CORE_TNT_MERGE6_PRIMARY_PLAYBACK_RATE = REGULAR_MERGE6_SOUND_PLAYBACK_RATE;
export const CORE_TNT_MERGE6_PRIMARY_BASE_VOLUME = REGULAR_MERGE6_SOUND_BASE_VOLUME;
export const CORE_TNT_MERGE6_PRIMARY_VOLUME = REGULAR_MERGE6_SOUND_VOLUME;
export const CORE_TNT_MERGE6_CRASH_SOUND_SOURCE = REGULAR_MERGE6_CRASH_SOUND_SOURCE;
export const CORE_TNT_MERGE6_CRASH_PLAYBACK_RATE = REGULAR_MERGE6_CRASH_PLAYBACK_RATE;
export const CORE_TNT_MERGE6_CRASH_BASE_VOLUME = REGULAR_MERGE6_CRASH_BASE_VOLUME;
export const CORE_TNT_MERGE6_CRASH_VOLUME = REGULAR_MERGE6_CRASH_VOLUME;
export const CORE_TNT_MERGE6_BOOM_SOUND_SOURCE = REGULAR_MERGE6_BOOM_SOUND_SOURCE;
export const CORE_TNT_MERGE6_BOOM_BASE_VOLUME = REGULAR_MERGE6_BOOM_BASE_VOLUME;
export const CORE_TNT_MERGE6_BOOM_VOLUME = REGULAR_MERGE6_BOOM_VOLUME;
export const CORE_TNT_MERGE6_STACK_SOUND_SOURCE = REGULAR_MERGE6_STACK_SOUND_SOURCE;
export const CORE_TNT_MERGE6_STACK_BASE_VOLUME = REGULAR_MERGE6_STACK_BASE_VOLUME;
export const CORE_TNT_MERGE6_STACK_VOLUME = REGULAR_MERGE6_STACK_VOLUME;

const CORE_TNT_MERGE6_SOUND_SOURCES = Object.freeze([
  CORE_TNT_MERGE6_SOUND_SOURCE,
  CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE,
  CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE,
] as const);
const CORE_TNT_MERGE6_VOICE_ID = Object.freeze({
  tnt3: 'core-tnt-merge6-tnt3',
  woodBreak: 'core-tnt-merge6-wood-break',
  woodSplinter: 'core-tnt-merge6-wood-splinter',
});
const CORE_TNT_MERGE6_VOICE_IDS = Object.values(CORE_TNT_MERGE6_VOICE_ID);
const mediaAudioBySource = new Map<string, HTMLAudioElement>();
let woodSplinterStartTimer: number | null = null;

export interface CoreTntMerge6SoundEvent {
  effectiveSum: number;
  srcSpecial?: string | null;
  dstSpecial?: string | null;
  srcSpecialDiceVariantId?: string | null;
  dstSpecialDiceVariantId?: string | null;
}

/** Excludes every registered visual variant that shares TNT gameplay. */
export function isCoreTntMerge6SoundEvent(event: CoreTntMerge6SoundEvent): boolean {
  if (event.effectiveSum !== 6) return false;
  if (event.srcSpecialDiceVariantId || event.dstSpecialDiceVariantId) return false;
  return (
    (event.srcSpecial === 'wild-tnt' && !event.dstSpecial) ||
    (event.dstSpecial === 'wild-tnt' && !event.srcSpecial)
  );
}

export function areCoreTntMerge6SoundsEnabled(): boolean {
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
): void {
  audio.pause();
  audio.defaultPlaybackRate = 1;
  audio.playbackRate = 1;
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play()?.catch((error) => {
    logger.warn(`Failed to play core TNT merge-6 ${label} layer:`, error);
  });
}

function clearWoodSplinterStartTimer(): void {
  if (woodSplinterStartTimer === null || typeof window === 'undefined') return;
  window.clearTimeout(woodSplinterStartTimer);
  woodSplinterStartTimer = null;
}

export function preloadCoreTntMerge6Sound(): boolean {
  if (!areCoreTntMerge6SoundsEnabled()) return false;
  const ordinaryMergeReady = preloadRegularMerge6Sounds();
  const tntReady = preloadDecodedGameplaySounds(CORE_TNT_MERGE6_SOUND_SOURCES) ||
    CORE_TNT_MERGE6_SOUND_SOURCES.every((source) => getMediaAudio(source) !== null);
  return ordinaryMergeReady && tntReady;
}

export function playCoreTntMerge6Sound(): boolean {
  if (!areCoreTntMerge6SoundsEnabled()) return false;
  const ordinaryMergeStarted = playRegularMerge6Sound();
  const decodedState = getDecodedGameplaySoundsState(CORE_TNT_MERGE6_SOUND_SOURCES);

  if (decodedState !== 'unavailable') {
    stopDecodedGameplayVoices(CORE_TNT_MERGE6_VOICE_IDS);
    const results = [
      playDecodedGameplaySound(CORE_TNT_MERGE6_SOUND_SOURCE, {
        voiceId: CORE_TNT_MERGE6_VOICE_ID.tnt3,
        volume: CORE_TNT_MERGE6_SOUND_VOLUME,
        playbackRate: CORE_TNT_MERGE6_SOUND_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE, {
        voiceId: CORE_TNT_MERGE6_VOICE_ID.woodBreak,
        volume: CORE_TNT_MERGE6_WOOD_VOLUME,
        playbackRate: CORE_TNT_MERGE6_WOOD_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE, {
        voiceId: CORE_TNT_MERGE6_VOICE_ID.woodSplinter,
        volume: CORE_TNT_MERGE6_WOOD_VOLUME,
        playbackRate: CORE_TNT_MERGE6_WOOD_PLAYBACK_RATE,
        startDelaySeconds: CORE_TNT_MERGE6_WOOD_SPLINTER_DELAY_MS / 1000,
      }),
    ];
    return ordinaryMergeStarted && results.every((result) => result !== 'unavailable');
  }

  const tnt3 = getMediaAudio(CORE_TNT_MERGE6_SOUND_SOURCE);
  const woodBreak = getMediaAudio(CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE);
  const woodSplinter = getMediaAudio(CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE);
  if (!tnt3 || !woodBreak || !woodSplinter) return false;
  try {
    clearWoodSplinterStartTimer();
    CORE_TNT_MERGE6_SOUND_SOURCES.forEach((source) => {
      const audio = mediaAudioBySource.get(source);
      if (!audio) return;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    });
    startMediaLayer(tnt3, CORE_TNT_MERGE6_SOUND_VOLUME, 'tnt3');
    startMediaLayer(woodBreak, CORE_TNT_MERGE6_WOOD_VOLUME, 'wood break');
    woodSplinterStartTimer = window.setTimeout(() => {
      woodSplinterStartTimer = null;
      if (!areCoreTntMerge6SoundsEnabled()) return;
      startMediaLayer(woodSplinter, CORE_TNT_MERGE6_WOOD_VOLUME, 'wood splinter');
    }, CORE_TNT_MERGE6_WOOD_SPLINTER_DELAY_MS);
    return ordinaryMergeStarted;
  } catch (error) {
    logger.warn('Failed to start core TNT merge-6 sound:', error);
    return false;
  }
}

export function stopCoreTntMerge6Sound(): void {
  clearWoodSplinterStartTimer();
  stopRegularMerge6Sounds();
  stopDecodedGameplayVoices(CORE_TNT_MERGE6_VOICE_IDS);
  mediaAudioBySource.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetCoreTntMerge6SoundCacheForTests(): void {
  stopCoreTntMerge6Sound();
  resetRegularMerge6SoundCacheForTests();
  mediaAudioBySource.clear();
}
