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

export const JOURNEY_FOREST_AMBIENT_ACTION_VOLUME = 0.85;
export const JOURNEY_FOREST_AMBIENT_BOOST = 1.2;
export const JOURNEY_FOREST_AMBIENT_VOLUME = Math.min(
  1,
  applySoundEffectsMasterGain(JOURNEY_FOREST_AMBIENT_ACTION_VOLUME)
    * JOURNEY_FOREST_AMBIENT_BOOST,
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
let playbackGeneration = 0;
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
  playbackGeneration++;
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
  if (fading) stopAndRewind();

  clearFadeTimers();
  const generation = ++playbackGeneration;
  const failStart = () => {
    if (generation === playbackGeneration) stopAndRewind();
  };
  fading = false;
  active = true;
  const decodedState = getDecodedGameplaySoundsState(JOURNEY_FOREST_AMBIENT_SOUND_SOURCES);
  if (decodedState !== 'unavailable') {
    JOURNEY_FOREST_AMBIENT_SOUND_SOURCES.forEach((source, index) => {
      if (generation !== playbackGeneration) return;
      const result = playDecodedGameplaySound(source, {
        voiceId: VOICE_IDS[index],
        volume: JOURNEY_FOREST_AMBIENT_VOLUME,
        loop: true,
        onDeferredUnavailable: failStart,
      });
      if (result === 'unavailable') failStart();
    });
    return active;
  }

  const audios = getMediaAudios();
  if (audios.length !== JOURNEY_FOREST_AMBIENT_SOUND_SOURCES.length) {
    active = false;
    return false;
  }
  audios.forEach((audio) => {
    if (generation !== playbackGeneration) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.loop = true;
      audio.volume = JOURNEY_FOREST_AMBIENT_VOLUME;
      audio.play()?.catch((error) => {
        logger.warn(`Failed to play Journey Forest ambiance ${audio.src}:`, error);
        failStart();
      });
    } catch (error) {
      logger.warn(`Failed to start Journey Forest ambiance ${audio.src}:`, error);
      failStart();
    }
  });
  return active;
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
