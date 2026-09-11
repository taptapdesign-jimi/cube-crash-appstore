import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const WILD_SPECIAL_MERGE6_POOF_SOUND_SOURCES = Object.freeze([
  './assets/sound/merge 6/poof1.wav',
  './assets/sound/merge 6/poof2.wav',
] as const);
export const WILD_SPECIAL_MERGE6_POOF_BASE_VOLUME = 1;
export const WILD_SPECIAL_MERGE6_POOF_VOLUME = applySoundEffectsMasterGain(
  WILD_SPECIAL_MERGE6_POOF_BASE_VOLUME,
);
const VOICE_IDS = ['wild-special-merge6-poof1', 'wild-special-merge6-poof2'] as const;
const CORE_WILD_TYPES = new Set(['wild', 'wild-juice', 'wild-magnet', 'wild-tnt']);
const mediaAudioBySource = new Map<string, HTMLAudioElement>();

export interface WildSpecialMerge6PoofEvent {
  effectiveSum: number;
  srcSpecial?: string | null;
  dstSpecial?: string | null;
  srcSpecialDiceVariantId?: string | null;
  dstSpecialDiceVariantId?: string | null;
}

export function isWildSpecialMerge6PoofEvent(event: WildSpecialMerge6PoofEvent): boolean {
  if (event.effectiveSum !== 6) return false;
  return Boolean(
    (event.srcSpecial && CORE_WILD_TYPES.has(event.srcSpecial))
    || (event.dstSpecial && CORE_WILD_TYPES.has(event.dstSpecial))
    || event.srcSpecialDiceVariantId
    || event.dstSpecialDiceVariantId,
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

export function preloadWildSpecialMerge6PoofSounds(): boolean {
  if (!areSoundsEnabled()) return false;
  return preloadDecodedGameplaySounds(WILD_SPECIAL_MERGE6_POOF_SOUND_SOURCES)
    || WILD_SPECIAL_MERGE6_POOF_SOUND_SOURCES.every((source) => getMediaAudio(source) !== null);
}

export function playWildSpecialMerge6PoofSounds(): boolean {
  if (!areSoundsEnabled()) return false;
  stopWildSpecialMerge6PoofSounds();
  const decodedState = getDecodedGameplaySoundsState(WILD_SPECIAL_MERGE6_POOF_SOUND_SOURCES);
  if (decodedState !== 'unavailable') {
    const results = WILD_SPECIAL_MERGE6_POOF_SOUND_SOURCES.map((source, index) => (
      playDecodedGameplaySound(source, {
        voiceId: VOICE_IDS[index],
        volume: WILD_SPECIAL_MERGE6_POOF_VOLUME,
        playbackRate: 1,
      }) !== 'unavailable'
    ));
    return results.every(Boolean);
  }
  const results = WILD_SPECIAL_MERGE6_POOF_SOUND_SOURCES.map((source) => {
    const audio = getMediaAudio(source);
    if (!audio) return false;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.defaultPlaybackRate = 1;
      audio.playbackRate = 1;
      audio.volume = WILD_SPECIAL_MERGE6_POOF_VOLUME;
      audio.play()?.catch((error) => logger.warn('Failed to play shared Wild/Special poof:', error));
      return true;
    } catch (error) {
      logger.warn('Failed to start shared Wild/Special poof:', error);
      return false;
    }
  });
  return results.every(Boolean);
}

export function stopWildSpecialMerge6PoofSounds(): void {
  stopDecodedGameplayVoices(VOICE_IDS);
  mediaAudioBySource.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetWildSpecialMerge6PoofSoundCacheForTests(): void {
  stopWildSpecialMerge6PoofSounds();
  mediaAudioBySource.clear();
}
