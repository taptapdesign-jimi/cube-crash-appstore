import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

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
const GAMEPLAY_WOOSH_SOURCES = [
  GAMEPLAY_PICKUP_SOUND_SOURCE,
  GAMEPLAY_RETURN_SOUND_SOURCE,
] as const;
const GAMEPLAY_WOOSH_VOICE_IDS = ['gameplay-pickup', 'gameplay-return'] as const;

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
  if (preloadDecodedGameplaySounds(GAMEPLAY_WOOSH_SOURCES)) return true;
  return getPickupAudio() !== null && getReturnAudio() !== null;
}

export function playGameplayPickupSound(): boolean {
  if (!areGameplayPickupSoundsEnabled()) return false;
  const decodedState = getDecodedGameplaySoundsState(GAMEPLAY_WOOSH_SOURCES);
  if (decodedState !== 'unavailable') {
    return playDecodedGameplaySound(GAMEPLAY_PICKUP_SOUND_SOURCE, {
      voiceId: GAMEPLAY_WOOSH_VOICE_IDS[0],
      playbackRate: GAMEPLAY_PICKUP_SOUND_PLAYBACK_RATE,
      volume: GAMEPLAY_PICKUP_SOUND_VOLUME,
      startOffsetSeconds: GAMEPLAY_PICKUP_SOUND_START_OFFSET_SECONDS,
    }) !== 'unavailable';
  }
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
  const decodedState = getDecodedGameplaySoundsState(GAMEPLAY_WOOSH_SOURCES);
  if (decodedState !== 'unavailable') {
    return playDecodedGameplaySound(GAMEPLAY_RETURN_SOUND_SOURCE, {
      voiceId: GAMEPLAY_WOOSH_VOICE_IDS[1],
      playbackRate: GAMEPLAY_RETURN_SOUND_PLAYBACK_RATE,
      volume: GAMEPLAY_RETURN_SOUND_VOLUME,
      startOffsetSeconds: GAMEPLAY_RETURN_SOUND_START_OFFSET_SECONDS,
    }) !== 'unavailable';
  }
  return startAudio(
    getReturnAudio(),
    GAMEPLAY_RETURN_SOUND_PLAYBACK_RATE,
    GAMEPLAY_RETURN_SOUND_VOLUME,
    GAMEPLAY_RETURN_SOUND_START_OFFSET_SECONDS,
    'return',
  );
}

export function stopGameplayPickupSound(): void {
  stopDecodedGameplayVoices(GAMEPLAY_WOOSH_VOICE_IDS);
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
