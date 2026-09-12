import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const CTA_ACTIVATION_SOUND_SOURCES = [
  './assets/sound/CTA/deeper.wav',
  './assets/sound/CTA/pumb.wav',
  './assets/sound/CTA/cta-splat.wav',
  './assets/sound/CTA/cta squishy.wav',
] as const;

export const CTA_ACTIVATION_SOUND_BASE_VOLUMES = [0.3, 1, 1, 1] as const;
export const CTA_ACTIVATION_SOUND_VOLUMES = CTA_ACTIVATION_SOUND_BASE_VOLUMES.map(
  applySoundEffectsMasterGain,
);

const CTA_ACTIVATION_VOICE_IDS = [
  'cta-activation-deeper',
  'cta-activation-pumb',
  'cta-activation-splat',
  'cta-activation-squishy',
] as const;

let fallbackAudio: HTMLAudioElement[] | null = null;

export function areCtaActivationSoundsEnabled(): boolean {
  return typeof window !== 'undefined' &&
    (window as any)._settings?.gameSoundsEnabled === true;
}

function getFallbackAudio(): HTMLAudioElement[] | null {
  if (fallbackAudio) return fallbackAudio;
  if (typeof Audio !== 'function') return null;
  fallbackAudio = CTA_ACTIVATION_SOUND_SOURCES.map((source) => {
    const audio = new Audio(source);
    audio.preload = 'auto';
    try { audio.load(); } catch {}
    return audio;
  });
  return fallbackAudio;
}

export function preloadCtaActivationSounds(): boolean {
  if (!areCtaActivationSoundsEnabled()) return false;
  if (preloadDecodedGameplaySounds(CTA_ACTIVATION_SOUND_SOURCES)) return true;
  return getFallbackAudio() !== null;
}

export function playCtaActivationSounds(): boolean {
  if (!areCtaActivationSoundsEnabled()) return false;
  stopCtaActivationSounds();

  const decodedState = getDecodedGameplaySoundsState(CTA_ACTIVATION_SOUND_SOURCES);
  if (decodedState !== 'unavailable') {
    return CTA_ACTIVATION_SOUND_SOURCES.every((source, index) => (
      playDecodedGameplaySound(source, {
        voiceId: CTA_ACTIVATION_VOICE_IDS[index],
        volume: CTA_ACTIVATION_SOUND_VOLUMES[index],
      }) !== 'unavailable'
    ));
  }

  const audioLayers = getFallbackAudio();
  if (!audioLayers) return false;
  audioLayers.forEach((audio, index) => {
    try {
      audio.pause();
      audio.volume = CTA_ACTIVATION_SOUND_VOLUMES[index];
      audio.currentTime = 0;
      audio.play()?.catch((error) => {
        logger.warn(`Failed to play CTA activation layer ${index + 1}:`, error);
      });
    } catch (error) {
      logger.warn(`Failed to start CTA activation layer ${index + 1}:`, error);
    }
  });
  return true;
}

export function stopCtaActivationSounds(): void {
  stopDecodedGameplayVoices(CTA_ACTIVATION_VOICE_IDS);
  fallbackAudio?.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetCtaActivationSoundsForTests(): void {
  stopCtaActivationSounds();
  fallbackAudio = null;
}
