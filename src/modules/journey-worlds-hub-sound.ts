import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  fadeOutDecodedGameplayVoice,
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  setDecodedGameplayVoiceVolume,
  stopDecodedGameplayVoice,
} from './gameplay-audio-buffer-player.ts';

export const JOURNEY_WORLDS_HUB_SOUND_SOURCE =
  './assets/sound/worlds/crumbleworlds.wav';
export const JOURNEY_WORLDS_HUB_ACTION_VOLUME = 0.58;
export const JOURNEY_WORLDS_HUB_VOLUME = applySoundEffectsMasterGain(
  JOURNEY_WORLDS_HUB_ACTION_VOLUME,
);
export const JOURNEY_WORLDS_WORLD_VOLUME_RATIO = 0.3;
export const JOURNEY_WORLDS_WORLD_VOLUME =
  JOURNEY_WORLDS_HUB_VOLUME * JOURNEY_WORLDS_WORLD_VOLUME_RATIO;
export const JOURNEY_WORLDS_VOLUME_TRANSITION_MS = 1000;
export const JOURNEY_WORLDS_WORLD_FADE_DELAY_MS = 5000;
export const JOURNEY_WORLDS_WORLD_FADE_OUT_MS = 1000;
export const JOURNEY_WORLDS_BOARD_TRANSITION_FADE_OUT_MS = 1000;

const VOICE_ID = 'journey-worlds-ambient-loop';
const VOLUME_STEP_MS = 32;
const BOARD_TRANSITION_HANDOFF_TIMEOUT_MS = 12000;
type JourneyWorldsSoundSurface = 'hub' | 'world';

let mediaAudio: HTMLAudioElement | null = null;
let volumeIntervalId: number | null = null;
let volumeTimeoutId: number | null = null;
let worldFadeDelayTimeoutId: number | null = null;
let boardTransitionHandoffTimeoutId: number | null = null;
let active = false;
let activeSurface: JourneyWorldsSoundSurface = 'hub';
let boardTransitionHandoffArmed = false;

function areSoundsEnabled(): boolean {
  return typeof window !== 'undefined'
    && (window as any)._settings?.gameSoundsEnabled === true;
}

function getMediaAudio(): HTMLAudioElement | null {
  if (mediaAudio) return mediaAudio;
  if (typeof Audio !== 'function') return null;

  mediaAudio = new Audio(JOURNEY_WORLDS_HUB_SOUND_SOURCE);
  mediaAudio.preload = 'auto';
  mediaAudio.loop = true;
  mediaAudio.volume = JOURNEY_WORLDS_HUB_VOLUME;
  try { mediaAudio.load(); } catch {}
  return mediaAudio;
}

function getSurfaceVolume(surface: JourneyWorldsSoundSurface): number {
  return surface === 'world' ? JOURNEY_WORLDS_WORLD_VOLUME : JOURNEY_WORLDS_HUB_VOLUME;
}

function clearVolumeTimers(): void {
  if (volumeIntervalId !== null) window.clearInterval(volumeIntervalId);
  if (volumeTimeoutId !== null) window.clearTimeout(volumeTimeoutId);
  volumeIntervalId = null;
  volumeTimeoutId = null;
}

function clearBoardTransitionHandoff(): void {
  if (boardTransitionHandoffTimeoutId !== null) {
    window.clearTimeout(boardTransitionHandoffTimeoutId);
  }
  boardTransitionHandoffTimeoutId = null;
  boardTransitionHandoffArmed = false;
}

function clearWorldFadeSchedule(): void {
  if (worldFadeDelayTimeoutId !== null) {
    window.clearTimeout(worldFadeDelayTimeoutId);
  }
  worldFadeDelayTimeoutId = null;
}

function stopAndRewind(): void {
  clearVolumeTimers();
  clearWorldFadeSchedule();
  clearBoardTransitionHandoff();
  active = false;
  activeSurface = 'hub';
  stopDecodedGameplayVoice(VOICE_ID);
  if (!mediaAudio) return;
  try {
    mediaAudio.pause();
    mediaAudio.currentTime = 0;
    mediaAudio.volume = JOURNEY_WORLDS_HUB_VOLUME;
  } catch {}
}

export function preloadJourneyWorldsHubSound(): boolean {
  if (!areSoundsEnabled()) return false;
  return preloadDecodedGameplaySounds([JOURNEY_WORLDS_HUB_SOUND_SOURCE])
    || getMediaAudio() !== null;
}

function transitionToSurfaceVolume(
  surface: JourneyWorldsSoundSurface,
  durationMs = JOURNEY_WORLDS_VOLUME_TRANSITION_MS,
): boolean {
  if (surface === 'hub') clearWorldFadeSchedule();
  activeSurface = surface;
  if (!active) return false;

  clearVolumeTimers();
  const targetVolume = getSurfaceVolume(surface);
  const safeDurationMs = Math.max(0, durationMs);
  setDecodedGameplayVoiceVolume(VOICE_ID, targetVolume, safeDurationMs / 1000);

  if (!mediaAudio) return true;
  const startedAt = Date.now();
  const startingVolume = mediaAudio.volume;
  const applyVolumeStep = () => {
    if (!mediaAudio) return;
    const progress = safeDurationMs === 0
      ? 1
      : Math.min(1, Math.max(0, (Date.now() - startedAt) / safeDurationMs));
    mediaAudio.volume = startingVolume + ((targetVolume - startingVolume) * progress);
    if (progress >= 1) clearVolumeTimers();
  };

  if (safeDurationMs === 0) {
    applyVolumeStep();
    return true;
  }
  volumeIntervalId = window.setInterval(applyVolumeStep, VOLUME_STEP_MS);
  volumeTimeoutId = window.setTimeout(() => {
    if (mediaAudio) mediaAudio.volume = targetVolume;
    clearVolumeTimers();
  }, safeDurationMs);
  return true;
}

function playJourneyWorldsSound(surface: JourneyWorldsSoundSurface): boolean {
  if (!areSoundsEnabled()) {
    stopAndRewind();
    return false;
  }
  if (active) {
    if (activeSurface === surface) return true;
    return transitionToSurfaceVolume(surface);
  }

  clearVolumeTimers();
  active = true;
  activeSurface = surface;
  const volume = getSurfaceVolume(surface);
  const decodedState = getDecodedGameplaySoundsState([JOURNEY_WORLDS_HUB_SOUND_SOURCE]);
  if (decodedState !== 'unavailable') {
    playDecodedGameplaySound(JOURNEY_WORLDS_HUB_SOUND_SOURCE, {
      voiceId: VOICE_ID,
      volume,
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
    audio.volume = volume;
    audio.play()?.catch((error) => {
      logger.warn('Failed to play Journey Worlds Hub loop:', error);
    });
    return true;
  } catch (error) {
    active = false;
    logger.warn('Failed to start Journey Worlds Hub loop:', error);
    return false;
  }
}

export function playJourneyWorldsHubSound(): boolean {
  return playJourneyWorldsSound('hub');
}

export function playJourneyWorldsWorldSound(): boolean {
  return playJourneyWorldsSound('world');
}

export function reduceJourneyWorldsSoundForWorld(
  durationMs = JOURNEY_WORLDS_VOLUME_TRANSITION_MS,
): boolean {
  clearWorldFadeSchedule();
  const transitioned = transitionToSurfaceVolume('world', durationMs);
  if (!transitioned) return false;
  worldFadeDelayTimeoutId = window.setTimeout(() => {
    worldFadeDelayTimeoutId = null;
    fadeOutJourneyWorldsSound(JOURNEY_WORLDS_WORLD_FADE_OUT_MS);
  }, JOURNEY_WORLDS_WORLD_FADE_DELAY_MS);
  return true;
}

export function armJourneyWorldsSoundForBoardTransition(): boolean {
  if (!active) return false;
  clearBoardTransitionHandoff();
  boardTransitionHandoffArmed = true;
  boardTransitionHandoffTimeoutId = window.setTimeout(
    stopAndRewind,
    BOARD_TRANSITION_HANDOFF_TIMEOUT_MS,
  );
  return true;
}

function fadeOutJourneyWorldsSound(durationMs: number): boolean {
  if (!active) return false;

  clearVolumeTimers();
  clearWorldFadeSchedule();
  const safeDurationMs = Math.max(0, durationMs);
  if (safeDurationMs === 0) {
    stopAndRewind();
    return true;
  }

  fadeOutDecodedGameplayVoice(VOICE_ID, safeDurationMs / 1000);
  const startedAt = Date.now();
  const startingVolume = mediaAudio?.volume ?? JOURNEY_WORLDS_WORLD_VOLUME;
  const applyFadeStep = () => {
    if (!mediaAudio) return;
    const progress = Math.min(1, Math.max(0, (Date.now() - startedAt) / safeDurationMs));
    mediaAudio.volume = startingVolume * (1 - progress);
  };

  if (mediaAudio) volumeIntervalId = window.setInterval(applyFadeStep, VOLUME_STEP_MS);
  volumeTimeoutId = window.setTimeout(stopAndRewind, safeDurationMs);
  return true;
}

export function fadeOutJourneyWorldsSoundForBoardTransition(
  durationMs = JOURNEY_WORLDS_BOARD_TRANSITION_FADE_OUT_MS,
): boolean {
  clearBoardTransitionHandoff();
  return fadeOutJourneyWorldsSound(durationMs);
}

export function stopJourneyWorldsHubSound(
  options: { preserveBoardTransitionHandoff?: boolean } = {},
): void {
  if (options.preserveBoardTransitionHandoff && boardTransitionHandoffArmed) return;
  stopAndRewind();
}

export function resetJourneyWorldsHubSoundForTests(): void {
  stopAndRewind();
  mediaAudio = null;
}
