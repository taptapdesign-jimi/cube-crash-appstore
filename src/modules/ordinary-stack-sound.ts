import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';

export const ORDINARY_STACK_SOUND_SOURCE = './assets/sound/merge 6/stack.mp3';
export const ORDINARY_STACK_SOUND_BASE_VOLUME = 1;
export const ORDINARY_STACK_SOUND_VOLUME = applySoundEffectsMasterGain(
  ORDINARY_STACK_SOUND_BASE_VOLUME,
);

let ownedAudio: HTMLAudioElement | null = null;

export function areOrdinaryStackSoundsEnabled(): boolean {
  return typeof window !== 'undefined' &&
    (window as any)._settings?.gameSoundsEnabled === true;
}

function getAudio(): HTMLAudioElement | null {
  if (ownedAudio) return ownedAudio;
  if (typeof Audio !== 'function') return null;

  ownedAudio = new Audio(ORDINARY_STACK_SOUND_SOURCE);
  ownedAudio.preload = 'auto';
  try { ownedAudio.load(); } catch {}
  return ownedAudio;
}

export function preloadOrdinaryStackSound(): boolean {
  if (!areOrdinaryStackSoundsEnabled()) return false;
  return getAudio() !== null;
}

export function playOrdinaryStackSound(): boolean {
  if (!areOrdinaryStackSoundsEnabled()) return false;
  const audio = getAudio();
  if (!audio) return false;

  try {
    audio.pause();
    audio.defaultPlaybackRate = 1;
    audio.playbackRate = 1;
    audio.volume = ORDINARY_STACK_SOUND_VOLUME;
    audio.currentTime = 0;
    audio.play()?.catch((error) => {
      logger.warn('Failed to play ordinary stack sound:', error);
    });
    return true;
  } catch (error) {
    logger.warn('Failed to start ordinary stack sound:', error);
    return false;
  }
}

export function stopOrdinaryStackSound(): void {
  if (!ownedAudio) return;
  try {
    ownedAudio.pause();
    ownedAudio.currentTime = 0;
  } catch {}
}

export function resetOrdinaryStackSoundCacheForTests(): void {
  stopOrdinaryStackSound();
  ownedAudio = null;
}
