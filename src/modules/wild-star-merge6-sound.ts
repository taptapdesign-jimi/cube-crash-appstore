import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoice,
} from './gameplay-audio-buffer-player.ts';

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
export const WILD_STAR_MERGE6_BOOM_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/star/big_tnt_boom_explosi_%231-1788980586466.wav';
// The boom is about 7 dB louder in-file. A one-third action gain resolves to
// the requested 0.20 effective level after the shared 0.60 SFX master.
export const WILD_STAR_MERGE6_BOOM_BASE_VOLUME = 1 / 3;
export const WILD_STAR_MERGE6_BOOM_VOLUME = applySoundEffectsMasterGain(
  WILD_STAR_MERGE6_BOOM_BASE_VOLUME,
);
export const WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/star/magicle_sparkle_for__%231-1788980027254.wav';
export const WILD_STAR_MERGE6_SPARKLE_BASE_VOLUME = 0.6;
export const WILD_STAR_MERGE6_SPARKLE_VOLUME = applySoundEffectsMasterGain(
  WILD_STAR_MERGE6_SPARKLE_BASE_VOLUME,
);
export const WILD_STAR_MERGE6_SPARKLE_DELAY_MS = 200;
export const WILD_STAR_MERGE6_STACK_SOUND_SOURCE = './assets/sound/merge 6/stack.mp3';
export const WILD_STAR_MERGE6_STACK_BASE_VOLUME = 0.08;
export const WILD_STAR_MERGE6_STACK_VOLUME = applySoundEffectsMasterGain(
  WILD_STAR_MERGE6_STACK_BASE_VOLUME,
);
export const WILD_STAR_MERGE6_PRIMARY_SOUND_SOURCE =
  './assets/sound/merge 6/merge six obicna.mp3';
export const WILD_STAR_MERGE6_PRIMARY_BASE_VOLUME = 0.7;
export const WILD_STAR_MERGE6_PRIMARY_VOLUME = applySoundEffectsMasterGain(
  WILD_STAR_MERGE6_PRIMARY_BASE_VOLUME,
);

const WILD_STAR_MERGE6_SOUND_SOURCES = [
  WILD_STAR_MERGE6_SOUND_SOURCE,
  WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE,
  WILD_STAR_MERGE6_BOOM_SOUND_SOURCE,
  WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE,
  WILD_STAR_MERGE6_STACK_SOUND_SOURCE,
  WILD_STAR_MERGE6_PRIMARY_SOUND_SOURCE,
] as const;
const WILD_STAR_MERGE6_VOICE_IDS = [
  'wild-star-merge6-magic',
  'wild-star-merge6-boom',
  'wild-star-merge6-sparkle',
  'wild-star-merge6-stack',
  'wild-star-merge6-primary',
] as const;
let magicAudio: HTMLAudioElement | null = null;
let alternateMagicAudio: HTMLAudioElement | null = null;
let boomAudio: HTMLAudioElement | null = null;
let sparkleAudio: HTMLAudioElement | null = null;
let stackAudio: HTMLAudioElement | null = null;
let primaryAudio: HTMLAudioElement | null = null;
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

function getBoomAudio(): HTMLAudioElement | null {
  boomAudio ??= createAudio(WILD_STAR_MERGE6_BOOM_SOUND_SOURCE);
  return boomAudio;
}

function getSparkleAudio(): HTMLAudioElement | null {
  sparkleAudio ??= createAudio(WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE);
  return sparkleAudio;
}

function getStackAudio(): HTMLAudioElement | null {
  stackAudio ??= createAudio(WILD_STAR_MERGE6_STACK_SOUND_SOURCE);
  return stackAudio;
}

function getPrimaryAudio(): HTMLAudioElement | null {
  primaryAudio ??= createAudio(WILD_STAR_MERGE6_PRIMARY_SOUND_SOURCE);
  return primaryAudio;
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
  if (preloadDecodedGameplaySounds(WILD_STAR_MERGE6_SOUND_SOURCES)) return true;
  return getMagicAudio() !== null
    && getAlternateMagicAudio() !== null
    && getBoomAudio() !== null
    && getSparkleAudio() !== null
    && getStackAudio() !== null
    && getPrimaryAudio() !== null;
}

export function playWildStarMerge6Sound(): boolean {
  if (!areWildStarMerge6SoundsEnabled()) return false;

  const decodedState = getDecodedGameplaySoundsState(WILD_STAR_MERGE6_SOUND_SOURCES);
  if (decodedState === 'ready') {
    const magicSource = selectWildStarMerge6MagicSoundSource();
    const results = [
      playDecodedGameplaySound(magicSource, {
        voiceId: WILD_STAR_MERGE6_VOICE_IDS[0],
        volume: getMagicVolumeForSource(magicSource),
        playbackRate: WILD_STAR_MERGE6_SOUND_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(WILD_STAR_MERGE6_BOOM_SOUND_SOURCE, {
        voiceId: WILD_STAR_MERGE6_VOICE_IDS[1],
        volume: WILD_STAR_MERGE6_BOOM_VOLUME,
        playbackRate: WILD_STAR_MERGE6_SOUND_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE, {
        voiceId: WILD_STAR_MERGE6_VOICE_IDS[2],
        volume: WILD_STAR_MERGE6_SPARKLE_VOLUME,
        playbackRate: WILD_STAR_MERGE6_SOUND_PLAYBACK_RATE,
        startDelaySeconds: WILD_STAR_MERGE6_SPARKLE_DELAY_MS / 1000,
      }),
      playDecodedGameplaySound(WILD_STAR_MERGE6_STACK_SOUND_SOURCE, {
        voiceId: WILD_STAR_MERGE6_VOICE_IDS[3],
        volume: WILD_STAR_MERGE6_STACK_VOLUME,
        playbackRate: WILD_STAR_MERGE6_SOUND_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(WILD_STAR_MERGE6_PRIMARY_SOUND_SOURCE, {
        voiceId: WILD_STAR_MERGE6_VOICE_IDS[4],
        volume: WILD_STAR_MERGE6_PRIMARY_VOLUME,
        playbackRate: WILD_STAR_MERGE6_SOUND_PLAYBACK_RATE,
      }),
    ];
    return results.every((result) => result === 'played');
  }
  // Do not create a media decoder on the merge frame while Web Audio is still
  // decoding. Gameplay entry preloads this cue before the board is interactive.
  if (decodedState === 'pending') return false;

  const magicSource = selectWildStarMerge6MagicSoundSource();
  const magic = getMagicAudioForSource(magicSource);
  const boom = getBoomAudio();
  const sparkle = getSparkleAudio();
  const stack = getStackAudio();
  const primary = getPrimaryAudio();
  if (!magic || !boom || !sparkle || !stack || !primary) return false;
  try {
    clearSparkleStartTimer();
    const immediateLayers = [
      { audio: magic, volume: getMagicVolumeForSource(magicSource), label: 'magic' },
      { audio: boom, volume: WILD_STAR_MERGE6_BOOM_VOLUME, label: 'boom' },
      { audio: stack, volume: WILD_STAR_MERGE6_STACK_VOLUME, label: 'stack' },
      { audio: primary, volume: WILD_STAR_MERGE6_PRIMARY_VOLUME, label: 'primary' },
    ];
    immediateLayers.forEach(({ audio, volume, label }) => {
      startMediaLayer(audio, volume, label);
    });
    sparkleStartTimer = window.setTimeout(() => {
      sparkleStartTimer = null;
      if (!areWildStarMerge6SoundsEnabled()) return;
      startMediaLayer(sparkle, WILD_STAR_MERGE6_SPARKLE_VOLUME, 'sparkle');
    }, WILD_STAR_MERGE6_SPARKLE_DELAY_MS);
    return true;
  } catch (error) {
    logger.warn('Failed to start Wild Star merge-6 sound:', error);
    return false;
  }
}

export function stopWildStarMerge6Sound(): void {
  clearSparkleStartTimer();
  WILD_STAR_MERGE6_VOICE_IDS.forEach(stopDecodedGameplayVoice);
  for (const audio of [
    magicAudio,
    alternateMagicAudio,
    boomAudio,
    sparkleAudio,
    stackAudio,
    primaryAudio,
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
  magicAudio = null;
  alternateMagicAudio = null;
  boomAudio = null;
  sparkleAudio = null;
  stackAudio = null;
  primaryAudio = null;
}
