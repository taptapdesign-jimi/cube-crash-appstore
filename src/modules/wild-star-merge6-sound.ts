import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoice,
} from './gameplay-audio-buffer-player.ts';
import {
  REGULAR_MERGE6_BOOM_BASE_VOLUME,
  REGULAR_MERGE6_BOOM_SOUND_SOURCE,
  REGULAR_MERGE6_BOOM_VOLUME,
  REGULAR_MERGE6_CRASH_BASE_VOLUME,
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

export const WILD_STAR_MERGE6_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/star/long_magica_happy_ac_%232-1788980185281.wav';
export const WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/star/long_magica_happy_ac_%233-1788980189939.wav';
export const WILD_STAR_MERGE6_SOUND_PLAYBACK_RATE = 1;
// Both random magic beds are mixed to exactly 0.40 after the shared 0.60 SFX master.
export const WILD_STAR_MERGE6_SOUND_BASE_VOLUME = 2 / 3;
export const WILD_STAR_MERGE6_SOUND_VOLUME = applySoundEffectsMasterGain(
  WILD_STAR_MERGE6_SOUND_BASE_VOLUME,
);
export const WILD_STAR_MERGE6_ALTERNATE_SOUND_BASE_VOLUME = 2 / 3;
export const WILD_STAR_MERGE6_ALTERNATE_SOUND_VOLUME = applySoundEffectsMasterGain(
  WILD_STAR_MERGE6_ALTERNATE_SOUND_BASE_VOLUME,
);
export const WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/star/magicle_sparkle_for__%231-1788980027254.wav';
export const WILD_STAR_MERGE6_SPARKLE_VOLUME_SCALE = 0.85;
export const WILD_STAR_MERGE6_SPARKLE_BASE_VOLUME =
  0.6 * WILD_STAR_MERGE6_SPARKLE_VOLUME_SCALE;
export const WILD_STAR_MERGE6_SPARKLE_VOLUME = applySoundEffectsMasterGain(
  WILD_STAR_MERGE6_SPARKLE_BASE_VOLUME,
);
export const WILD_STAR_MERGE6_SPARKLE_DELAY_MS = 200;

// Wild Star deliberately reuses the complete ordinary Merge-6 owner. These
// aliases make the equality explicit for inventory/tests without duplicating
// playback, timing, cutoff, fade, or cleanup logic in this module.
export const WILD_STAR_MERGE6_PRIMARY_SOUND_SOURCE = REGULAR_MERGE6_SOUND_SOURCE;
export const WILD_STAR_MERGE6_PRIMARY_PLAYBACK_RATE = REGULAR_MERGE6_SOUND_PLAYBACK_RATE;
export const WILD_STAR_MERGE6_PRIMARY_BASE_VOLUME = REGULAR_MERGE6_SOUND_BASE_VOLUME;
export const WILD_STAR_MERGE6_PRIMARY_VOLUME = REGULAR_MERGE6_SOUND_VOLUME;
export const WILD_STAR_MERGE6_CRASH_SOUND_SOURCE = REGULAR_MERGE6_CRASH_SOUND_SOURCE;
export const WILD_STAR_MERGE6_CRASH_PLAYBACK_RATE = REGULAR_MERGE6_SOUND_PLAYBACK_RATE;
export const WILD_STAR_MERGE6_CRASH_BASE_VOLUME = REGULAR_MERGE6_CRASH_BASE_VOLUME;
export const WILD_STAR_MERGE6_CRASH_VOLUME = REGULAR_MERGE6_CRASH_VOLUME;
export const WILD_STAR_MERGE6_BOOM_SOUND_SOURCE = REGULAR_MERGE6_BOOM_SOUND_SOURCE;
export const WILD_STAR_MERGE6_BOOM_BASE_VOLUME = REGULAR_MERGE6_BOOM_BASE_VOLUME;
export const WILD_STAR_MERGE6_BOOM_VOLUME = REGULAR_MERGE6_BOOM_VOLUME;
export const WILD_STAR_MERGE6_STACK_SOUND_SOURCE = REGULAR_MERGE6_STACK_SOUND_SOURCE;
export const WILD_STAR_MERGE6_STACK_BASE_VOLUME = REGULAR_MERGE6_STACK_BASE_VOLUME;
export const WILD_STAR_MERGE6_STACK_VOLUME = REGULAR_MERGE6_STACK_VOLUME;

const WILD_STAR_MERGE6_SOUND_SOURCES = [
  WILD_STAR_MERGE6_SOUND_SOURCE,
  WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE,
  WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE,
] as const;
const WILD_STAR_MERGE6_VOICE_IDS = [
  'wild-star-merge6-magic',
  'wild-star-merge6-sparkle',
] as const;
let magicAudio: HTMLAudioElement | null = null;
let alternateMagicAudio: HTMLAudioElement | null = null;
let sparkleAudio: HTMLAudioElement | null = null;
let sparkleStartTimer: number | null = null;

export interface WildStarMerge6SoundEvent {
  effectiveSum: number;
  srcSpecial?: string | null;
  dstSpecial?: string | null;
  srcSpecialDiceVariantId?: string | null;
  dstSpecialDiceVariantId?: string | null;
}

/**
 * The core Wild Star is intentionally distinct from registry-backed dice that
 * share its `wild` gameplay archetype (for example Bee and Kanta).
 */
export function isCoreWildStarMerge6SoundEvent(
  event: WildStarMerge6SoundEvent,
): boolean {
  if (event.effectiveSum !== 6) return false;
  if (event.srcSpecialDiceVariantId || event.dstSpecialDiceVariantId) return false;
  return event.srcSpecial === 'wild' || event.dstSpecial === 'wild';
}

export function areWildStarMerge6SoundsEnabled(): boolean {
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

function getMagicAudio(): HTMLAudioElement | null {
  magicAudio ??= createAudio(WILD_STAR_MERGE6_SOUND_SOURCE);
  return magicAudio;
}

function getAlternateMagicAudio(): HTMLAudioElement | null {
  alternateMagicAudio ??= createAudio(WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE);
  return alternateMagicAudio;
}

export function selectWildStarMerge6MagicSoundSource(
  randomValue: number = Math.random(),
): string {
  return randomValue < 0.5
    ? WILD_STAR_MERGE6_SOUND_SOURCE
    : WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE;
}

function getMagicAudioForSource(source: string): HTMLAudioElement | null {
  return source === WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE
    ? getAlternateMagicAudio()
    : getMagicAudio();
}

function getMagicVolumeForSource(source: string): number {
  return source === WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE
    ? WILD_STAR_MERGE6_ALTERNATE_SOUND_VOLUME
    : WILD_STAR_MERGE6_SOUND_VOLUME;
}

function getSparkleAudio(): HTMLAudioElement | null {
  sparkleAudio ??= createAudio(WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE);
  return sparkleAudio;
}

function clearSparkleStartTimer(): void {
  if (sparkleStartTimer === null || typeof window === 'undefined') return;
  window.clearTimeout(sparkleStartTimer);
  sparkleStartTimer = null;
}

function startMediaLayer(
  audio: HTMLAudioElement,
  volume: number,
  label: string,
): void {
  audio.pause();
  audio.defaultPlaybackRate = WILD_STAR_MERGE6_SOUND_PLAYBACK_RATE;
  audio.playbackRate = WILD_STAR_MERGE6_SOUND_PLAYBACK_RATE;
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play()?.catch((error) => {
    logger.warn(`Failed to play Wild Star merge-6 ${label} layer:`, error);
  });
}

export function preloadWildStarMerge6Sound(): boolean {
  if (!areWildStarMerge6SoundsEnabled()) return false;
  const ordinaryMergeReady = preloadRegularMerge6Sounds();
  const starLayersReady = preloadDecodedGameplaySounds(WILD_STAR_MERGE6_SOUND_SOURCES)
    || (getMagicAudio() !== null
    && getAlternateMagicAudio() !== null
    && getSparkleAudio() !== null);
  return ordinaryMergeReady && starLayersReady;
}

export function playWildStarMerge6Sound(): boolean {
  if (!areWildStarMerge6SoundsEnabled()) return false;
  const ordinaryMergeStarted = playRegularMerge6Sound();

  const decodedState = getDecodedGameplaySoundsState(WILD_STAR_MERGE6_SOUND_SOURCES);
  if (decodedState !== 'unavailable') {
    const magicSource = selectWildStarMerge6MagicSoundSource();
    const results = [
      playDecodedGameplaySound(magicSource, {
        voiceId: WILD_STAR_MERGE6_VOICE_IDS[0],
        volume: getMagicVolumeForSource(magicSource),
        playbackRate: WILD_STAR_MERGE6_SOUND_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE, {
        voiceId: WILD_STAR_MERGE6_VOICE_IDS[1],
        volume: WILD_STAR_MERGE6_SPARKLE_VOLUME,
        playbackRate: WILD_STAR_MERGE6_SOUND_PLAYBACK_RATE,
        startDelaySeconds: WILD_STAR_MERGE6_SPARKLE_DELAY_MS / 1000,
      }),
    ];
    return ordinaryMergeStarted && results.every((result) => result !== 'unavailable');
  }

  const magicSource = selectWildStarMerge6MagicSoundSource();
  const magic = getMagicAudioForSource(magicSource);
  const sparkle = getSparkleAudio();
  if (!magic || !sparkle) return false;
  try {
    clearSparkleStartTimer();
    startMediaLayer(magic, getMagicVolumeForSource(magicSource), 'magic');
    sparkleStartTimer = window.setTimeout(() => {
      sparkleStartTimer = null;
      if (!areWildStarMerge6SoundsEnabled()) return;
      startMediaLayer(sparkle, WILD_STAR_MERGE6_SPARKLE_VOLUME, 'sparkle');
    }, WILD_STAR_MERGE6_SPARKLE_DELAY_MS);
    return ordinaryMergeStarted;
  } catch (error) {
    logger.warn('Failed to start Wild Star merge-6 sound:', error);
    return false;
  }
}

export function stopWildStarMerge6Sound(): void {
  clearSparkleStartTimer();
  stopRegularMerge6Sounds();
  WILD_STAR_MERGE6_VOICE_IDS.forEach(stopDecodedGameplayVoice);
  for (const audio of [
    magicAudio,
    alternateMagicAudio,
    sparkleAudio,
  ]) {
    if (!audio) continue;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  }
}

export function resetWildStarMerge6SoundCacheForTests(): void {
  stopWildStarMerge6Sound();
  resetRegularMerge6SoundCacheForTests();
  magicAudio = null;
  alternateMagicAudio = null;
  sparkleAudio = null;
}
