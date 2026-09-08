import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';

export const GAMEPLAY_PICKUP_SOUND_SOURCE = './assets/sound/merge 6/woosh.mp3';
export const GAMEPLAY_PICKUP_SOUND_PLAYBACK_RATE = 1;
export const GAMEPLAY_PICKUP_SOUND_START_OFFSET_SECONDS = 0.045;
export const GAMEPLAY_PICKUP_SOUND_BASE_VOLUME = 0.432;
export const GAMEPLAY_PICKUP_SOUND_VOLUME = applySoundEffectsMasterGain(
  GAMEPLAY_PICKUP_SOUND_BASE_VOLUME,
);
export const GAMEPLAY_RETURN_SOUND_SOURCE = './assets/sound/merge 6/woosh.mp3';
export const GAMEPLAY_RETURN_SOUND_PLAYBACK_RATE = 1;
export const GAMEPLAY_RETURN_SOUND_START_OFFSET_SECONDS = 0.045;
export const GAMEPLAY_RETURN_SOUND_BASE_VOLUME = 0.85;
export const GAMEPLAY_RETURN_SOUND_VOLUME = applySoundEffectsMasterGain(
  GAMEPLAY_RETURN_SOUND_BASE_VOLUME,
);

let pickupAudio: HTMLAudioElement | null = null;
let returnAudio: HTMLAudioElement | null = null;

export function areGameplayPickupSoundsEnabled(): boolean {
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

function getPickupAudio(): HTMLAudioElement | null {
  pickupAudio ??= createAudio(GAMEPLAY_PICKUP_SOUND_SOURCE);
  return pickupAudio;
}

function getReturnAudio(): HTMLAudioElement | null {
  returnAudio ??= createAudio(GAMEPLAY_RETURN_SOUND_SOURCE);
  return returnAudio;
}

function startAudio(
  audio: HTMLAudioElement | null,
  playbackRate: number,
  volume: number,
  startOffsetSeconds: number,
  label: string,
): boolean {
  if (!audio) return false;

  try {
    audio.pause();
    audio.defaultPlaybackRate = playbackRate;
    audio.playbackRate = playbackRate;
    audio.volume = volume;
    audio.currentTime = startOffsetSeconds;
    audio.play()?.catch((error) => {
      logger.warn(`Failed to play gameplay ${label} sound:`, error);
    });
    return true;
  } catch (error) {
    logger.warn(`Failed to start gameplay ${label} sound:`, error);
    return false;
  }
}

export function preloadGameplayPickupSound(): boolean {
  if (!areGameplayPickupSoundsEnabled()) return false;
  return getPickupAudio() !== null && getReturnAudio() !== null;
}

export function playGameplayPickupSound(): boolean {
  if (!areGameplayPickupSoundsEnabled()) return false;
  return startAudio(
    getPickupAudio(),
    GAMEPLAY_PICKUP_SOUND_PLAYBACK_RATE,
    GAMEPLAY_PICKUP_SOUND_VOLUME,
    GAMEPLAY_PICKUP_SOUND_START_OFFSET_SECONDS,
    'pickup',
  );
}

export function playGameplayReturnSound(): boolean {
  if (!areGameplayPickupSoundsEnabled()) return false;
  return startAudio(
    getReturnAudio(),
    GAMEPLAY_RETURN_SOUND_PLAYBACK_RATE,
    GAMEPLAY_RETURN_SOUND_VOLUME,
    GAMEPLAY_RETURN_SOUND_START_OFFSET_SECONDS,
    'return',
  );
}

export function stopGameplayPickupSound(): void {
  for (const audio of [pickupAudio, returnAudio]) {
    if (!audio) continue;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  }
}

export function resetGameplayPickupSoundCacheForTests(): void {
  stopGameplayPickupSound();
  pickupAudio = null;
  returnAudio = null;
}
