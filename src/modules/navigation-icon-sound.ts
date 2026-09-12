import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const NAVIGATION_ICON_SOUND_SOURCES = [
  './assets/sound/CTA/poping.wav',
  './assets/sound/CTA/wood click.wav',
] as const;

export const NAVIGATION_ICON_SOUND_BASE_VOLUMES = [0.5, 0.7] as const;
export const NAVIGATION_ICON_SOUND_VOLUMES = NAVIGATION_ICON_SOUND_BASE_VOLUMES.map(
  applySoundEffectsMasterGain,
);

const NAVIGATION_ICON_VOICE_IDS = [
  'navigation-icon-poping',
  'navigation-icon-wood-click',
] as const;

let fallbackAudio: HTMLAudioElement[] | null = null;

function enabled(): boolean {
  return typeof window !== 'undefined' &&
    (window as any)._settings?.gameSoundsEnabled === true;
}

function getFallbackAudio(): HTMLAudioElement[] | null {
  if (fallbackAudio) return fallbackAudio;
  if (typeof Audio !== 'function') return null;
  fallbackAudio = NAVIGATION_ICON_SOUND_SOURCES.map((source) => {
    const audio = new Audio(source);
    audio.preload = 'auto';
    try { audio.load(); } catch {}
    return audio;
  });
  return fallbackAudio;
}

export function preloadNavigationIconSounds(): boolean {
  if (!enabled()) return false;
  if (preloadDecodedGameplaySounds(NAVIGATION_ICON_SOUND_SOURCES)) return true;
  return getFallbackAudio() !== null;
}

export function playNavigationIconSounds(): boolean {
  if (!enabled()) return false;
  stopNavigationIconSounds();

  const decodedState = getDecodedGameplaySoundsState(NAVIGATION_ICON_SOUND_SOURCES);
  if (decodedState !== 'unavailable') {
    return NAVIGATION_ICON_SOUND_SOURCES.every((source, index) => (
      playDecodedGameplaySound(source, {
        voiceId: NAVIGATION_ICON_VOICE_IDS[index],
        volume: NAVIGATION_ICON_SOUND_VOLUMES[index],
      }) !== 'unavailable'
    ));
  }

  const audioLayers = getFallbackAudio();
  if (!audioLayers) return false;
  audioLayers.forEach((audio, index) => {
    try {
      audio.pause();
      audio.volume = NAVIGATION_ICON_SOUND_VOLUMES[index];
      audio.currentTime = 0;
      audio.play()?.catch((error) => {
        logger.warn(`Failed to play navigation icon layer ${index + 1}:`, error);
      });
    } catch (error) {
      logger.warn(`Failed to start navigation icon layer ${index + 1}:`, error);
    }
  });
  return true;
}

export function stopNavigationIconSounds(): void {
  stopDecodedGameplayVoices(NAVIGATION_ICON_VOICE_IDS);
  fallbackAudio?.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetNavigationIconSoundsForTests(): void {
  stopNavigationIconSounds();
  fallbackAudio = null;
}
