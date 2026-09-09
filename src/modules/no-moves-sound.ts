import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoice,
} from './gameplay-audio-buffer-player.ts';

export const NO_MOVES_SOUND_SOURCE = './assets/sound/grandpa - no moves left.mp3';
export const NO_MOVES_SOUND_BASE_VOLUME = 0.7;
export const NO_MOVES_SOUND_VOLUME = applySoundEffectsMasterGain(NO_MOVES_SOUND_BASE_VOLUME);

const NO_MOVES_SOUND_VOICE_ID = 'no-moves-grandpa';
let ownedAudio: HTMLAudioElement | null = null;

export function areNoMovesSoundsEnabled(): boolean {
  return typeof window !== 'undefined'
    && (window as any)._settings?.gameSoundsEnabled === true;
}

function getAudio(): HTMLAudioElement | null {
  if (ownedAudio) return ownedAudio;
  if (typeof Audio !== 'function') return null;
  ownedAudio = new Audio(NO_MOVES_SOUND_SOURCE);
  ownedAudio.preload = 'auto';
  try { ownedAudio.load(); } catch {}
  return ownedAudio;
}

export function preloadNoMovesSound(): boolean {
  if (!areNoMovesSoundsEnabled()) return false;
  if (preloadDecodedGameplaySounds([NO_MOVES_SOUND_SOURCE])) return true;
  return getAudio() !== null;
}

export function playNoMovesSound(): boolean {
  if (!areNoMovesSoundsEnabled()) return false;

  const decodedState = getDecodedGameplaySoundsState([NO_MOVES_SOUND_SOURCE]);
  if (decodedState === 'ready') {
    return playDecodedGameplaySound(NO_MOVES_SOUND_SOURCE, {
      voiceId: NO_MOVES_SOUND_VOICE_ID,
      volume: NO_MOVES_SOUND_VOLUME,
    }) === 'played';
  }
  if (decodedState === 'pending') return false;

  const audio = getAudio();
  if (!audio) return false;
  try {
    audio.pause();
    audio.defaultPlaybackRate = 1;
    audio.playbackRate = 1;
    audio.volume = NO_MOVES_SOUND_VOLUME;
    audio.currentTime = 0;
    audio.play()?.catch((error) => {
      logger.warn('Failed to play NO MOVES sound:', error);
    });
    return true;
  } catch (error) {
    logger.warn('Failed to start NO MOVES sound:', error);
    return false;
  }
}

export function stopNoMovesSound(): void {
  stopDecodedGameplayVoice(NO_MOVES_SOUND_VOICE_ID);
  if (!ownedAudio) return;
  try {
    ownedAudio.pause();
    ownedAudio.currentTime = 0;
  } catch {}
}

export function resetNoMovesSoundCacheForTests(): void {
  stopNoMovesSound();
  ownedAudio = null;
}
