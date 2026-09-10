import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoice,
} from './gameplay-audio-buffer-player.ts';

export const WILD_SPECIAL_LANDING_SOUND_SOURCE = './assets/sound/sfx/bag drop.wav';
export const WILD_SPECIAL_LANDING_SOUND_BASE_VOLUME = 0.5;
export const WILD_SPECIAL_LANDING_SOUND_VOLUME = applySoundEffectsMasterGain(
  WILD_SPECIAL_LANDING_SOUND_BASE_VOLUME,
);

const WILD_SPECIAL_LANDING_VOICE_ID = 'wild-special-landing';
let ownedAudio: HTMLAudioElement | null = null;

export function areWildSpecialLandingSoundsEnabled(): boolean {
  return typeof window !== 'undefined' &&
    (window as any)._settings?.gameSoundsEnabled === true;
}

function getAudio(): HTMLAudioElement | null {
  if (ownedAudio) return ownedAudio;
  if (typeof Audio !== 'function') return null;

  ownedAudio = new Audio(WILD_SPECIAL_LANDING_SOUND_SOURCE);
  ownedAudio.preload = 'auto';
  try { ownedAudio.load(); } catch {}
  return ownedAudio;
}

export function preloadWildSpecialLandingSound(): boolean {
  if (!areWildSpecialLandingSoundsEnabled()) return false;
  if (preloadDecodedGameplaySounds([WILD_SPECIAL_LANDING_SOUND_SOURCE])) return true;
  return getAudio() !== null;
}

export function playWildSpecialLandingSound(): boolean {
  if (!areWildSpecialLandingSoundsEnabled()) return false;

  const decodedState = getDecodedGameplaySoundsState([WILD_SPECIAL_LANDING_SOUND_SOURCE]);
  if (decodedState !== 'unavailable') {
    return playDecodedGameplaySound(WILD_SPECIAL_LANDING_SOUND_SOURCE, {
      voiceId: WILD_SPECIAL_LANDING_VOICE_ID,
      volume: WILD_SPECIAL_LANDING_SOUND_VOLUME,
    }) !== 'unavailable';
  }

  const audio = getAudio();
  if (!audio) return false;
  try {
    audio.pause();
    audio.defaultPlaybackRate = 1;
    audio.playbackRate = 1;
    audio.volume = WILD_SPECIAL_LANDING_SOUND_VOLUME;
    audio.currentTime = 0;
    audio.play()?.catch((error) => {
      logger.warn('Failed to play Wild/Special landing sound:', error);
    });
    return true;
  } catch (error) {
    logger.warn('Failed to start Wild/Special landing sound:', error);
    return false;
  }
}

export function stopWildSpecialLandingSound(): void {
  stopDecodedGameplayVoice(WILD_SPECIAL_LANDING_VOICE_ID);
  if (!ownedAudio) return;
  try {
    ownedAudio.pause();
    ownedAudio.currentTime = 0;
  } catch {}
}

export function resetWildSpecialLandingSoundCacheForTests(): void {
  stopWildSpecialLandingSound();
  ownedAudio = null;
}
