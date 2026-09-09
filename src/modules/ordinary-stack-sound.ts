import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const ORDINARY_STACK_SOUND_SOURCE = './assets/sound/merge 6/wood.wav';
export const ORDINARY_STACK_SOUND_PLAYBACK_RATE = 1.5;
export const ORDINARY_STACK_SOUND_BASE_VOLUME = 0.384;
export const ORDINARY_STACK_SOUND_VOLUME = applySoundEffectsMasterGain(
  ORDINARY_STACK_SOUND_BASE_VOLUME,
);
export const ORDINARY_STACK_SECONDARY_SOUND_SOURCE = './assets/sound/merge 6/stack.mp3';
export const ORDINARY_STACK_SECONDARY_PLAYBACK_RATE = 1;
export const ORDINARY_STACK_SECONDARY_BASE_VOLUME = 0.8;
export const ORDINARY_STACK_SECONDARY_VOLUME = applySoundEffectsMasterGain(
  ORDINARY_STACK_SECONDARY_BASE_VOLUME,
);

const ORDINARY_STACK_SOUND_SOURCES = [
  ORDINARY_STACK_SOUND_SOURCE,
  ORDINARY_STACK_SECONDARY_SOUND_SOURCE,
] as const;
const ORDINARY_STACK_VOICE_IDS = ['ordinary-stack-wood', 'ordinary-stack-original'] as const;

let ownedAudio: HTMLAudioElement[] | null = null;

export function areOrdinaryStackSoundsEnabled(): boolean {
  return typeof window !== 'undefined' &&
    (window as any)._settings?.gameSoundsEnabled === true;
}

function getAudio(): HTMLAudioElement[] | null {
  if (ownedAudio) return ownedAudio;
  if (typeof Audio !== 'function') return null;

  ownedAudio = ORDINARY_STACK_SOUND_SOURCES.map((source) => {
    const audio = new Audio(source);
    audio.preload = 'auto';
    try { audio.load(); } catch {}
    return audio;
  });
  return ownedAudio;
}

export function preloadOrdinaryStackSound(): boolean {
  if (!areOrdinaryStackSoundsEnabled()) return false;
  if (preloadDecodedGameplaySounds(ORDINARY_STACK_SOUND_SOURCES)) return true;
  return getAudio() !== null;
}

export function playOrdinaryStackSound(): boolean {
  if (!areOrdinaryStackSoundsEnabled()) return false;
  const decodedState = getDecodedGameplaySoundsState(ORDINARY_STACK_SOUND_SOURCES);
  if (decodedState === 'ready') {
    const wood = playDecodedGameplaySound(ORDINARY_STACK_SOUND_SOURCE, {
      voiceId: ORDINARY_STACK_VOICE_IDS[0],
      volume: ORDINARY_STACK_SOUND_VOLUME,
      playbackRate: ORDINARY_STACK_SOUND_PLAYBACK_RATE,
    });
    const original = playDecodedGameplaySound(ORDINARY_STACK_SECONDARY_SOUND_SOURCE, {
      voiceId: ORDINARY_STACK_VOICE_IDS[1],
      volume: ORDINARY_STACK_SECONDARY_VOLUME,
      playbackRate: ORDINARY_STACK_SECONDARY_PLAYBACK_RATE,
    });
    return wood === 'played' && original === 'played';
  }
  if (decodedState === 'pending') return false;
  const audioLayers = getAudio();
  if (!audioLayers) return false;

  try {
    const layers = [
      { audio: audioLayers[0], rate: ORDINARY_STACK_SOUND_PLAYBACK_RATE, volume: ORDINARY_STACK_SOUND_VOLUME, label: 'wood' },
      { audio: audioLayers[1], rate: ORDINARY_STACK_SECONDARY_PLAYBACK_RATE, volume: ORDINARY_STACK_SECONDARY_VOLUME, label: 'original' },
    ];
    layers.forEach(({ audio, rate, volume, label }) => {
      audio.pause();
      audio.defaultPlaybackRate = rate;
      audio.playbackRate = rate;
      audio.volume = volume;
      audio.currentTime = 0;
      audio.play()?.catch((error) => {
        logger.warn(`Failed to play ordinary stack ${label} layer:`, error);
      });
    });
    return true;
  } catch (error) {
    logger.warn('Failed to start ordinary stack sound:', error);
    return false;
  }
}

export function stopOrdinaryStackSound(): void {
  stopDecodedGameplayVoices(ORDINARY_STACK_VOICE_IDS);
  if (!ownedAudio) return;
  ownedAudio.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetOrdinaryStackSoundCacheForTests(): void {
  stopOrdinaryStackSound();
  ownedAudio = null;
}
