import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';
import {
  playSpecialMerge6FoundationSound,
  preloadRegularMerge6Sounds,
  stopRegularMerge6Sounds,
} from './regular-merge6-sound.ts';

const MAGNET_PULL_FORCE_SOUND_BASE = './assets/sound/magnet pul lforce/';

export const MAGNET_PULL_FORCE_SOUND_SOURCES = [
  `${MAGNET_PULL_FORCE_SOUND_BASE}boiing.wav`,
] as const;
export const MAGNET_PULL_FORCE_SOUND_BASE_VOLUMES = [1] as const;
export const MAGNET_PULL_FORCE_SOUND_VOLUMES = MAGNET_PULL_FORCE_SOUND_BASE_VOLUMES.map(
  applySoundEffectsMasterGain,
);
export const HONEY_PULL_FORCE_BOIING_BASE_VOLUME = 0.6;
export const HONEY_PULL_FORCE_BOIING_VOLUME = applySoundEffectsMasterGain(
  HONEY_PULL_FORCE_BOIING_BASE_VOLUME,
);
export const BOTTLE_PULL_FORCE_BOIING_BASE_VOLUME = 0.4;
export const BOTTLE_PULL_FORCE_BOIING_VOLUME = applySoundEffectsMasterGain(
  BOTTLE_PULL_FORCE_BOIING_BASE_VOLUME,
);

const MAGNET_PULL_FORCE_VOICE_IDS = [
  'magnet-pull-force-boiing',
] as const;
const MAGNET_ARCHETYPE_VARIANT_IDS = new Set(['bottle', 'honey', 'spaceship']);
let fallbackAudio: HTMLAudioElement[] | null = null;

function areSoundsEnabled(): boolean {
  return typeof window !== 'undefined'
    && (window as any)._settings?.gameSoundsEnabled === true;
}

function getFallbackAudio(): HTMLAudioElement[] | null {
  if (fallbackAudio) return fallbackAudio;
  if (typeof Audio !== 'function') return null;
  fallbackAudio = MAGNET_PULL_FORCE_SOUND_SOURCES.map((source) => {
    const audio = new Audio(source);
    audio.preload = 'auto';
    try { audio.load(); } catch {}
    return audio;
  });
  return fallbackAudio;
}

export function preloadMagnetPullForceSounds(): boolean {
  if (!areSoundsEnabled()) return false;
  const foundationReady = preloadRegularMerge6Sounds();
  const accentsReady = preloadDecodedGameplaySounds(MAGNET_PULL_FORCE_SOUND_SOURCES)
    || getFallbackAudio() !== null;
  return foundationReady || accentsReady;
}

export interface MagnetArchetypeMerge6SoundEvent {
  effectiveSum: number;
  srcSpecial?: string | null;
  dstSpecial?: string | null;
  srcSpecialDiceVariantId?: string | null;
  dstSpecialDiceVariantId?: string | null;
}

export function isMagnetArchetypeMerge6SoundEvent(
  event: MagnetArchetypeMerge6SoundEvent,
): boolean {
  if (event.effectiveSum !== 6) return false;
  return event.srcSpecial === 'wild-magnet'
    || event.dstSpecial === 'wild-magnet'
    || MAGNET_ARCHETYPE_VARIANT_IDS.has(event.srcSpecialDiceVariantId ?? '')
    || MAGNET_ARCHETYPE_VARIANT_IDS.has(event.dstSpecialDiceVariantId ?? '');
}

function playAccent(index: 0, volume = MAGNET_PULL_FORCE_SOUND_VOLUMES[index]): boolean {
  const source = MAGNET_PULL_FORCE_SOUND_SOURCES[index];
  const decodedState = getDecodedGameplaySoundsState(MAGNET_PULL_FORCE_SOUND_SOURCES);
  if (decodedState !== 'unavailable') {
    return playDecodedGameplaySound(source, {
      voiceId: MAGNET_PULL_FORCE_VOICE_IDS[index],
      volume,
    }) !== 'unavailable';
  }

  const audio = getFallbackAudio()?.[index];
  if (!audio) return false;
  try {
    audio.pause();
    audio.volume = volume;
    audio.currentTime = 0;
    audio.play()?.catch((error) => logger.warn(`Failed to play Magnet accent ${index + 1}:`, error));
    return true;
  } catch (error) {
    logger.warn(`Failed to start Magnet accent ${index + 1}:`, error);
    return false;
  }
}

export function playMagnetArchetypeMerge6Sound(): boolean {
  if (!areSoundsEnabled()) return false;
  stopMagnetPullForceSounds();
  const foundationStarted = playSpecialMerge6FoundationSound();
  return foundationStarted;
}

export function resolveMagnetPullForceBoiingVolume(variantId?: string | null): number {
  if (variantId === 'honey') return HONEY_PULL_FORCE_BOIING_VOLUME;
  if (variantId === 'bottle') return BOTTLE_PULL_FORCE_BOIING_VOLUME;
  return MAGNET_PULL_FORCE_SOUND_VOLUMES[0];
}

export function playMagnetPullForceSounds(variantId?: string | null): boolean {
  if (!areSoundsEnabled()) return false;
  stopMagnetPullForceSounds();
  const foundationStarted = playSpecialMerge6FoundationSound();
  const boiingStarted = playAccent(
    0,
    resolveMagnetPullForceBoiingVolume(variantId),
  );
  return foundationStarted || boiingStarted;
}

export function stopMagnetPullForceSounds(): void {
  stopRegularMerge6Sounds();
  stopDecodedGameplayVoices(MAGNET_PULL_FORCE_VOICE_IDS);
  fallbackAudio?.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetMagnetPullForceSoundsForTests(): void {
  stopMagnetPullForceSounds();
  fallbackAudio = null;
}
