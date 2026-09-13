import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  fadeOutDecodedGameplayVoice,
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const JOURNEY_FOREST_AMBIENT_SOUND_SOURCES = [
  './assets/sound/worlds/Forest/soft bees ambiance.wav',
  './assets/sound/worlds/Forest/forest nature sounds.wav',
] as const;

export const JOURNEY_FOREST_AMBIENT_ACTION_VOLUME = 0.58;
export const JOURNEY_FOREST_AMBIENT_VOLUME = applySoundEffectsMasterGain(
  JOURNEY_FOREST_AMBIENT_ACTION_VOLUME,
);
export const JOURNEY_FOREST_AMBIENT_FADE_OUT_MS = 1500;

const FADE_STEP_MS = 32;
const VOICE_IDS = [
  'journey-forest-soft-bees-ambient',
  'journey-forest-nature-ambient',
] as const;

let mediaAudios: HTMLAudioElement[] | null = null;
let fadeIntervalId: number | null = null;
let fadeTimeoutId: number | null = null;
let active = false;
let fading = false;

function areSoundsEnabled(): boolean {
  return typeof window !== 'undefined'
    && (window as any)._settings?.gameSoundsEnabled === true;
}

function getMediaAudios(): HTMLAudioElement[] {
  if (mediaAudios) return mediaAudios;
  if (typeof Audio !== 'function') return [];

  mediaAudios = JOURNEY_FOREST_AMBIENT_SOUND_SOURCES.map((source) => {
    const audio = new Audio(source);
    audio.preload = 'auto';
    audio.loop = true;
    audio.volume = JOURNEY_FOREST_AMBIENT_VOLUME;
    try { audio.load(); } catch {}
    return audio;
  });
  return mediaAudios;
}

function clearFadeTimers(): void {
  if (fadeIntervalId !== null) window.clearInterval(fadeIntervalId);
  if (fadeTimeoutId !== null) window.clearTimeout(fadeTimeoutId);
  fadeIntervalId = null;
  fadeTimeoutId = null;
}

function stopAndRewind(): void {
  clearFadeTimers();
  fading = false;
  active = false;
  stopDecodedGameplayVoices(VOICE_IDS);
  mediaAudios?.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = JOURNEY_FOREST_AMBIENT_VOLUME;
    } catch {}
  });
}

export function preloadJourneyForestAmbientSounds(): boolean {
  if (!areSoundsEnabled()) return false;
  return preloadDecodedGameplaySounds(JOURNEY_FOREST_AMBIENT_SOUND_SOURCES)
    || getMediaAudios().length === JOURNEY_FOREST_AMBIENT_SOUND_SOURCES.length;
}

export function playJourneyForestAmbientSounds(): boolean {
  if (!areSoundsEnabled()) {
    stopAndRewind();
    return false;
  }

  if (active && !fading) return true;

  clearFadeTimers();
  fading = false;
  active = true;
  const decodedState = getDecodedGameplaySoundsState(JOURNEY_FOREST_AMBIENT_SOUND_SOURCES);
  if (decodedState !== 'unavailable') {
    JOURNEY_FOREST_AMBIENT_SOUND_SOURCES.forEach((source, index) => {
      playDecodedGameplaySound(source, {
        voiceId: VOICE_IDS[index],
        volume: JOURNEY_FOREST_AMBIENT_VOLUME,
        loop: true,
      });
    });
    return true;
  }

  const audios = getMediaAudios();
  if (audios.length !== JOURNEY_FOREST_AMBIENT_SOUND_SOURCES.length) {
    active = false;
    return false;
  }
  audios.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.loop = true;
      audio.volume = JOURNEY_FOREST_AMBIENT_VOLUME;
      audio.play()?.catch((error) => {
        logger.warn(`Failed to play Journey Forest ambiance ${audio.src}:`, error);
      });
    } catch (error) {
      logger.warn(`Failed to start Journey Forest ambiance ${audio.src}:`, error);
    }
  });
  return true;
}

export function fadeOutJourneyForestAmbientSounds(
  durationMs = JOURNEY_FOREST_AMBIENT_FADE_OUT_MS,
): boolean {
  if (!active) return false;
  if (fading) return true;

  clearFadeTimers();
  fading = true;
  const safeDurationMs = Math.max(0, durationMs);
  if (safeDurationMs === 0) {
    stopAndRewind();
    return true;
  }

  const startedAt = Date.now();
  const startingVolumes = mediaAudios?.map((audio) => audio.volume) ?? [];
  VOICE_IDS.forEach((voiceId) => {
    fadeOutDecodedGameplayVoice(voiceId, safeDurationMs / 1000);
  });
  const applyFadeStep = () => {
    const progress = Math.min(1, Math.max(0, (Date.now() - startedAt) / safeDurationMs));
    mediaAudios?.forEach((audio, index) => {
      audio.volume = startingVolumes[index] * (1 - progress);
    });
    if (progress >= 1) stopAndRewind();
  };

  if (mediaAudios?.length) {
    fadeIntervalId = window.setInterval(applyFadeStep, FADE_STEP_MS);
  }
  fadeTimeoutId = window.setTimeout(stopAndRewind, safeDurationMs);
  return true;
}

export function stopJourneyForestAmbientSounds(
  options: { preserveActiveFade?: boolean } = {},
): void {
  if (options.preserveActiveFade && fading) return;
  stopAndRewind();
}

export function resetJourneyForestAmbientSoundsForTests(): void {
  stopAndRewind();
  mediaAudios = null;
}
