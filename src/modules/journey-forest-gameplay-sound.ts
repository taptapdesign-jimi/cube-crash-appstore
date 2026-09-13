import { logger } from '../core/logger.js';
import {
  fadeOutDecodedGameplayVoice,
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoice,
} from './gameplay-audio-buffer-player.ts';
import { getJourneyWorldIdForBoard } from './journey-world-definitions.ts';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';

export const JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE =
  './assets/sound/worlds/Forest/gameplay/forest-gameplay-sound.wav';
export const JOURNEY_FOREST_GAMEPLAY_ACTION_VOLUME = 0.696;
export const JOURNEY_FOREST_GAMEPLAY_VOLUME = applySoundEffectsMasterGain(
  JOURNEY_FOREST_GAMEPLAY_ACTION_VOLUME,
);
export const JOURNEY_FOREST_GAMEPLAY_FADE_OUT_MS = 2000;

const VOICE_ID = 'journey-forest-gameplay-loop';
const FADE_STEP_MS = 32;

type ForestGameplayContext = Readonly<{
  boardNumber: number;
  isArcade: boolean;
}>;

let mediaAudio: HTMLAudioElement | null = null;
let fadeIntervalId: number | null = null;
let fadeTimeoutId: number | null = null;
let active = false;
let fading = false;

function areSoundsEnabled(): boolean {
  return typeof window !== 'undefined'
    && (window as any)._settings?.gameSoundsEnabled === true;
}

export function isJourneyForestGameplaySoundEligible(
  context: ForestGameplayContext,
): boolean {
  return !context.isArcade
    && getJourneyWorldIdForBoard(Math.trunc(context.boardNumber)) === 1;
}

function getMediaAudio(): HTMLAudioElement | null {
  if (mediaAudio) return mediaAudio;
  if (typeof Audio !== 'function') return null;

  mediaAudio = new Audio(JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE);
  mediaAudio.preload = 'auto';
  mediaAudio.loop = true;
  mediaAudio.volume = JOURNEY_FOREST_GAMEPLAY_VOLUME;
  try { mediaAudio.load(); } catch {}
  return mediaAudio;
}

function clearFadeTimers(): void {
  if (fadeIntervalId !== null) window.clearInterval(fadeIntervalId);
  if (fadeTimeoutId !== null) window.clearTimeout(fadeTimeoutId);
  fadeIntervalId = null;
  fadeTimeoutId = null;
}

function stopAndRewind(): void {
  clearFadeTimers();
  active = false;
  fading = false;
  stopDecodedGameplayVoice(VOICE_ID);
  if (!mediaAudio) return;
  try {
    mediaAudio.pause();
    mediaAudio.currentTime = 0;
    mediaAudio.volume = JOURNEY_FOREST_GAMEPLAY_VOLUME;
  } catch {}
}

export function preloadJourneyForestGameplaySound(
  context: ForestGameplayContext,
): boolean {
  if (!areSoundsEnabled() || !isJourneyForestGameplaySoundEligible(context)) return false;
  return preloadDecodedGameplaySounds([JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE])
    || getMediaAudio() !== null;
}

export function playJourneyForestGameplaySound(
  context: ForestGameplayContext,
): boolean {
  if (!areSoundsEnabled() || !isJourneyForestGameplaySoundEligible(context)) {
    stopAndRewind();
    return false;
  }
  if (active && !fading) return true;
  if (fading) stopAndRewind();

  clearFadeTimers();
  active = true;
  fading = false;
  const decodedState = getDecodedGameplaySoundsState([JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE]);
  if (decodedState !== 'unavailable') {
    playDecodedGameplaySound(JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE, {
      voiceId: VOICE_ID,
      volume: JOURNEY_FOREST_GAMEPLAY_VOLUME,
      loop: true,
    });
    return true;
  }

  const audio = getMediaAudio();
  if (!audio) {
    active = false;
    return false;
  }
  try {
    audio.pause();
    audio.currentTime = 0;
    audio.loop = true;
    audio.volume = JOURNEY_FOREST_GAMEPLAY_VOLUME;
    audio.play()?.catch((error) => {
      logger.warn('Failed to play Journey Forest gameplay loop:', error);
    });
    return true;
  } catch (error) {
    active = false;
    logger.warn('Failed to start Journey Forest gameplay loop:', error);
    return false;
  }
}

export function fadeOutJourneyForestGameplaySound(
  durationMs = JOURNEY_FOREST_GAMEPLAY_FADE_OUT_MS,
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

  fadeOutDecodedGameplayVoice(VOICE_ID, safeDurationMs / 1000);
  const startedAt = Date.now();
  const startingVolume = mediaAudio?.volume ?? JOURNEY_FOREST_GAMEPLAY_VOLUME;
  const applyFadeStep = () => {
    if (!mediaAudio) return;
    const progress = Math.min(1, Math.max(0, (Date.now() - startedAt) / safeDurationMs));
    mediaAudio.volume = startingVolume * (1 - progress);
    if (progress >= 1) stopAndRewind();
  };

  if (mediaAudio) fadeIntervalId = window.setInterval(applyFadeStep, FADE_STEP_MS);
  fadeTimeoutId = window.setTimeout(stopAndRewind, safeDurationMs);
  return true;
}

export function stopJourneyForestGameplaySound(
  options: { preserveActiveFade?: boolean } = {},
): void {
  if (options.preserveActiveFade && fading) return;
  stopAndRewind();
}

export function resetJourneyForestGameplaySoundForTests(): void {
  stopAndRewind();
  mediaAudio = null;
}
