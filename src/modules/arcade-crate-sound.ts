import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const ARCADE_CRATE_SOUND_SOURCES = [
  './assets/sound/crate and backpack animaitons/crate/crate 1.wav',
  './assets/sound/crate and backpack animaitons/crate/crate2.wav',
  './assets/sound/crate and backpack animaitons/crate/crate 3.wav',
  './assets/sound/crate and backpack animaitons/crate/crate 4.wav',
] as const;
export const ARCADE_CRATE_SOUND_DELAYS_MS = [0, 300, 600, 800] as const;
export const ARCADE_CRATE_SOUND_PLAYBACK_RATE = 1.4;
export const ARCADE_CRATE_SOUND_BASE_VOLUMES = [0.4256, 0.3192, 0.2128, 0.3724] as const;
export const ARCADE_CRATE_SOUND_VOLUMES = ARCADE_CRATE_SOUND_BASE_VOLUMES.map(
  applySoundEffectsMasterGain,
);

const ARCADE_CRATE_VOICE_IDS = ARCADE_CRATE_SOUND_SOURCES.map(
  (_, index) => `arcade-crate-${index + 1}`,
);
let ownedAudio: HTMLAudioElement[] | null = null;
const fallbackTimers = new Set<number>();

export function areArcadeCrateSoundsEnabled(): boolean {
  return typeof window !== 'undefined' &&
    (window as any)._settings?.gameSoundsEnabled === true;
}

function getOwnedAudio(): HTMLAudioElement[] | null {
  if (ownedAudio) return ownedAudio;
  if (typeof Audio !== 'function') return null;
  ownedAudio = ARCADE_CRATE_SOUND_SOURCES.map((source) => {
    const audio = new Audio(source);
    audio.preload = 'auto';
    try { audio.load(); } catch {}
    return audio;
  });
  return ownedAudio;
}

export function preloadArcadeCrateSounds(): boolean {
  if (!areArcadeCrateSoundsEnabled()) return false;
  if (preloadDecodedGameplaySounds(ARCADE_CRATE_SOUND_SOURCES)) return true;
  return getOwnedAudio() !== null;
}

function playFallbackLayer(audio: HTMLAudioElement, index: number): void {
  if (!areArcadeCrateSoundsEnabled()) return;
  try {
    audio.pause();
    audio.defaultPlaybackRate = ARCADE_CRATE_SOUND_PLAYBACK_RATE;
    audio.playbackRate = ARCADE_CRATE_SOUND_PLAYBACK_RATE;
    audio.volume = ARCADE_CRATE_SOUND_VOLUMES[index];
    audio.currentTime = 0;
    audio.play()?.catch((error) => {
      logger.warn(`Failed to play Arcade crate layer ${index + 1}:`, error);
    });
  } catch (error) {
    logger.warn(`Failed to start Arcade crate layer ${index + 1}:`, error);
  }
}

export function playArcadeCrateSounds(): boolean {
  if (!areArcadeCrateSoundsEnabled()) return false;
  stopArcadeCrateSounds();

  const decodedState = getDecodedGameplaySoundsState(ARCADE_CRATE_SOUND_SOURCES);
  if (decodedState !== 'unavailable') {
    return ARCADE_CRATE_SOUND_SOURCES.every((source, index) => (
      playDecodedGameplaySound(source, {
        voiceId: ARCADE_CRATE_VOICE_IDS[index],
        volume: ARCADE_CRATE_SOUND_VOLUMES[index],
        playbackRate: ARCADE_CRATE_SOUND_PLAYBACK_RATE,
        startDelaySeconds: ARCADE_CRATE_SOUND_DELAYS_MS[index] / 1000,
      }) !== 'unavailable'
    ));
  }

  const audioLayers = getOwnedAudio();
  if (!audioLayers) return false;
  audioLayers.forEach((audio, index) => {
    const delay = ARCADE_CRATE_SOUND_DELAYS_MS[index];
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

export function stopArcadeCrateSounds(): void {
  fallbackTimers.forEach((timer) => window.clearTimeout(timer));
  fallbackTimers.clear();
  stopDecodedGameplayVoices(ARCADE_CRATE_VOICE_IDS);
  ownedAudio?.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetArcadeCrateSoundsForTests(): void {
  stopArcadeCrateSounds();
  ownedAudio = null;
}
