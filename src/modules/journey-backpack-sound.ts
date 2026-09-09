import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const JOURNEY_BACKPACK_SOUND_SOURCES = [
  './assets/sound/crate and backpack animaitons/backpack/backpack1.wav',
  './assets/sound/crate and backpack animaitons/backpack/backpack2.wav',
] as const;
export const JOURNEY_BACKPACK_SOUND_DELAYS_MS = [0, 200] as const;
export const JOURNEY_BACKPACK_SOUND_PLAYBACK_RATES = [1.4, 2.1] as const;
export const JOURNEY_BACKPACK_SOUND_BASE_VOLUMES = [0.8, 0.25] as const;
export const JOURNEY_BACKPACK_SOUND_VOLUMES = JOURNEY_BACKPACK_SOUND_BASE_VOLUMES.map(
  applySoundEffectsMasterGain,
);

const JOURNEY_BACKPACK_VOICE_IDS = ['journey-backpack-1', 'journey-backpack-2'] as const;
let ownedAudio: HTMLAudioElement[] | null = null;
const fallbackTimers = new Set<number>();

export function areJourneyBackpackSoundsEnabled(): boolean {
  return typeof window !== 'undefined' &&
    (window as any)._settings?.gameSoundsEnabled === true;
}

function getOwnedAudio(): HTMLAudioElement[] | null {
  if (ownedAudio) return ownedAudio;
  if (typeof Audio !== 'function') return null;
  ownedAudio = JOURNEY_BACKPACK_SOUND_SOURCES.map((source) => {
    const audio = new Audio(source);
    audio.preload = 'auto';
    try { audio.load(); } catch {}
    return audio;
  });
  return ownedAudio;
}

export function preloadJourneyBackpackSounds(): boolean {
  if (!areJourneyBackpackSoundsEnabled()) return false;
  if (preloadDecodedGameplaySounds(JOURNEY_BACKPACK_SOUND_SOURCES)) return true;
  return getOwnedAudio() !== null;
}

function playFallbackLayer(audio: HTMLAudioElement, index: number): void {
  if (!areJourneyBackpackSoundsEnabled()) return;
  try {
    audio.pause();
    audio.defaultPlaybackRate = JOURNEY_BACKPACK_SOUND_PLAYBACK_RATES[index];
    audio.playbackRate = JOURNEY_BACKPACK_SOUND_PLAYBACK_RATES[index];
    audio.volume = JOURNEY_BACKPACK_SOUND_VOLUMES[index];
    audio.currentTime = 0;
    audio.play()?.catch((error) => {
      logger.warn(`Failed to play Journey backpack layer ${index + 1}:`, error);
    });
  } catch (error) {
    logger.warn(`Failed to start Journey backpack layer ${index + 1}:`, error);
  }
}

export function playJourneyBackpackSounds(): boolean {
  if (!areJourneyBackpackSoundsEnabled()) return false;
  stopJourneyBackpackSounds();
  const decodedState = getDecodedGameplaySoundsState(JOURNEY_BACKPACK_SOUND_SOURCES);
  if (decodedState === 'ready') {
    return JOURNEY_BACKPACK_SOUND_SOURCES.every((source, index) => (
      playDecodedGameplaySound(source, {
        voiceId: JOURNEY_BACKPACK_VOICE_IDS[index],
        volume: JOURNEY_BACKPACK_SOUND_VOLUMES[index],
        playbackRate: JOURNEY_BACKPACK_SOUND_PLAYBACK_RATES[index],
        startDelaySeconds: JOURNEY_BACKPACK_SOUND_DELAYS_MS[index] / 1000,
      }) === 'played'
    ));
  }
  if (decodedState === 'pending') return false;
  const audioLayers = getOwnedAudio();
  if (!audioLayers) return false;
  audioLayers.forEach((audio, index) => {
    const delay = JOURNEY_BACKPACK_SOUND_DELAYS_MS[index];
    if (delay === 0) {
      playFallbackLayer(audio, index);
      return;
    }
    const timer = window.setTimeout(() => {
      fallbackTimers.delete(timer);
      playFallbackLayer(audio, index);
    }, delay);
    fallbackTimers.add(timer);
  });
  return true;
}

export function stopJourneyBackpackSounds(): void {
  fallbackTimers.forEach((timer) => window.clearTimeout(timer));
  fallbackTimers.clear();
  stopDecodedGameplayVoices(JOURNEY_BACKPACK_VOICE_IDS);
  ownedAudio?.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetJourneyBackpackSoundsForTests(): void {
  stopJourneyBackpackSounds();
  ownedAudio = null;
}
