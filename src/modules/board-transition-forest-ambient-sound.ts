import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoice,
} from './gameplay-audio-buffer-player.ts';

export const BOARD_TRANSITION_FOREST_AMBIENT_SOUND_SOURCE =
  './assets/sound/Board transitions/Forest/Forest.wav';
export const BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_SOURCE =
  './assets/sound/Board transitions/Forest/bees small.wav';
export const BOARD_TRANSITION_FOREST_AMBIENT_SOUND_VOLUME = applySoundEffectsMasterGain(1);
export const BOARD_TRANSITION_FOREST_BEES_SMALL_ACTION_VOLUME = 0.2;
export const BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_VOLUME = applySoundEffectsMasterGain(
  BOARD_TRANSITION_FOREST_BEES_SMALL_ACTION_VOLUME,
);
export const BOARD_TRANSITION_FOREST_BEES_SMALL_DURATION_SECONDS = 4;
export const BOARD_TRANSITION_FOREST_BEES_SMALL_FADE_OUT_SECONDS = 1;

const BOARD_TRANSITION_FOREST_AMBIENT_VOICE_ID = 'board-transition-forest-ambient';
const BOARD_TRANSITION_FOREST_BEES_SMALL_VOICE_ID = 'board-transition-forest-bees-small';
const MEDIA_FADE_STEP_MS = 32;
let mediaAmbientAudio: HTMLAudioElement | null = null;
let mediaBeesAudio: HTMLAudioElement | null = null;
let mediaBeesFadeStartTimeoutId: number | null = null;
let mediaBeesFadeIntervalId: number | null = null;
let mediaBeesStopTimeoutId: number | null = null;

function areSoundsEnabled(): boolean {
  return typeof window !== 'undefined'
    && (window as any)._settings?.gameSoundsEnabled === true;
}

function createMediaAudio(source: string, volume: number): HTMLAudioElement | null {
  if (typeof Audio !== 'function') return null;
  const audio = new Audio(source);
  audio.preload = 'auto';
  audio.volume = volume;
  try { audio.load(); } catch {}
  return audio;
}

function getMediaAmbientAudio(): HTMLAudioElement | null {
  mediaAmbientAudio ??= createMediaAudio(
    BOARD_TRANSITION_FOREST_AMBIENT_SOUND_SOURCE,
    BOARD_TRANSITION_FOREST_AMBIENT_SOUND_VOLUME,
  );
  return mediaAmbientAudio;
}

function getMediaBeesAudio(): HTMLAudioElement | null {
  mediaBeesAudio ??= createMediaAudio(
    BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_SOURCE,
    BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_VOLUME,
  );
  return mediaBeesAudio;
}

function clearMediaBeesFadeTimers(): void {
  if (mediaBeesFadeStartTimeoutId !== null) window.clearTimeout(mediaBeesFadeStartTimeoutId);
  if (mediaBeesFadeIntervalId !== null) window.clearInterval(mediaBeesFadeIntervalId);
  if (mediaBeesStopTimeoutId !== null) window.clearTimeout(mediaBeesStopTimeoutId);
  mediaBeesFadeStartTimeoutId = null;
  mediaBeesFadeIntervalId = null;
  mediaBeesStopTimeoutId = null;
}

function stopMediaAudio(audio: HTMLAudioElement | null, volume: number): void {
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
  } catch {}
}

function scheduleMediaBeesFadeOut(audio: HTMLAudioElement): void {
  clearMediaBeesFadeTimers();
  const fadeStartMs = (
    BOARD_TRANSITION_FOREST_BEES_SMALL_DURATION_SECONDS
    - BOARD_TRANSITION_FOREST_BEES_SMALL_FADE_OUT_SECONDS
  ) * 1000;
  mediaBeesFadeStartTimeoutId = window.setTimeout(() => {
    mediaBeesFadeStartTimeoutId = null;
    const startedAt = Date.now();
    const fadeDurationMs = BOARD_TRANSITION_FOREST_BEES_SMALL_FADE_OUT_SECONDS * 1000;
    const applyFadeStep = () => {
      const progress = Math.min(1, Math.max(0, (Date.now() - startedAt) / fadeDurationMs));
      audio.volume = BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_VOLUME * (1 - progress);
    };
    mediaBeesFadeIntervalId = window.setInterval(applyFadeStep, MEDIA_FADE_STEP_MS);
    mediaBeesStopTimeoutId = window.setTimeout(() => {
      clearMediaBeesFadeTimers();
      stopMediaAudio(audio, BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_VOLUME);
    }, fadeDurationMs);
  }, fadeStartMs);
}

export function preloadBoardTransitionForestAmbientSound(): boolean {
  if (!areSoundsEnabled()) return false;
  const sources = [
    BOARD_TRANSITION_FOREST_AMBIENT_SOUND_SOURCE,
    BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_SOURCE,
  ];
  return preloadDecodedGameplaySounds(sources)
    || (getMediaAmbientAudio() !== null && getMediaBeesAudio() !== null);
}

export function playBoardTransitionForestAmbientSound(): boolean {
  if (!areSoundsEnabled()) return false;
  stopBoardTransitionForestAmbientSound();

  const decodedState = getDecodedGameplaySoundsState([
    BOARD_TRANSITION_FOREST_AMBIENT_SOUND_SOURCE,
    BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_SOURCE,
  ]);
  if (decodedState !== 'unavailable') {
    const ambientStarted = playDecodedGameplaySound(BOARD_TRANSITION_FOREST_AMBIENT_SOUND_SOURCE, {
      voiceId: BOARD_TRANSITION_FOREST_AMBIENT_VOICE_ID,
      volume: BOARD_TRANSITION_FOREST_AMBIENT_SOUND_VOLUME,
    }) !== 'unavailable';
    const beesStarted = playDecodedGameplaySound(BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_SOURCE, {
      voiceId: BOARD_TRANSITION_FOREST_BEES_SMALL_VOICE_ID,
      volume: BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_VOLUME,
      stopAfterSeconds: BOARD_TRANSITION_FOREST_BEES_SMALL_DURATION_SECONDS,
      fadeOutSeconds: BOARD_TRANSITION_FOREST_BEES_SMALL_FADE_OUT_SECONDS,
    }) !== 'unavailable';
    return ambientStarted && beesStarted;
  }

  const ambientAudio = getMediaAmbientAudio();
  const beesAudio = getMediaBeesAudio();
  if (!ambientAudio || !beesAudio) return false;
  try {
    ambientAudio.pause();
    ambientAudio.volume = BOARD_TRANSITION_FOREST_AMBIENT_SOUND_VOLUME;
    ambientAudio.currentTime = 0;
    ambientAudio.play()?.catch((error) => {
      logger.warn('Failed to play Forest Board Transition ambiance:', error);
    });
    beesAudio.pause();
    beesAudio.volume = BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_VOLUME;
    beesAudio.currentTime = 0;
    beesAudio.play()?.catch((error) => {
      logger.warn('Failed to play Forest Board Transition small bees:', error);
    });
    scheduleMediaBeesFadeOut(beesAudio);
    return true;
  } catch (error) {
    logger.warn('Failed to start Forest Board Transition ambiance:', error);
    return false;
  }
}

export function stopBoardTransitionForestAmbientSound(): void {
  stopDecodedGameplayVoice(BOARD_TRANSITION_FOREST_AMBIENT_VOICE_ID);
  stopDecodedGameplayVoice(BOARD_TRANSITION_FOREST_BEES_SMALL_VOICE_ID);
  clearMediaBeesFadeTimers();
  stopMediaAudio(mediaAmbientAudio, BOARD_TRANSITION_FOREST_AMBIENT_SOUND_VOLUME);
  stopMediaAudio(mediaBeesAudio, BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_VOLUME);
}

export function resetBoardTransitionForestAmbientSoundForTests(): void {
  stopBoardTransitionForestAmbientSound();
  mediaAmbientAudio = null;
  mediaBeesAudio = null;
}
