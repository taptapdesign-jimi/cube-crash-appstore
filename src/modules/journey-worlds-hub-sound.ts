import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import { MOBILE_RUNTIME_PROFILE } from './mobile-runtime-profile.ts';
import { isThermalAudioSuppressed } from '../utils/thermal-audio-isolation.ts';
import { createJourneyLongLoopLifecycle } from './journey-long-loop-lifecycle.ts';
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
export const JOURNEY_WORLDS_HUB_ACTION_VOLUME = 0.75;
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
let worldFadeAt: number | null = null;
let fading = false;
let playbackGeneration = 0;
const lifecycle = createJourneyLongLoopLifecycle('worlds', () => mediaAudio ? [mediaAudio] : []);

function areSoundsEnabled(): boolean {
  return typeof window !== 'undefined'
    && !isThermalAudioSuppressed()
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

function clearWorldFadeSchedule(preserveDeadline = false): void {
  if (worldFadeDelayTimeoutId !== null) {
    window.clearTimeout(worldFadeDelayTimeoutId);
  }
  worldFadeDelayTimeoutId = null;
  if (!preserveDeadline) worldFadeAt = null;
}

function scheduleWorldFadeOnce(): void {
  if (worldFadeDelayTimeoutId !== null || !active || fading || activeSurface !== 'world') return;
  worldFadeAt ??= Date.now() + JOURNEY_WORLDS_WORLD_FADE_DELAY_MS;
  if (lifecycle.isSuspended()) return;
  worldFadeDelayTimeoutId = window.setTimeout(() => {
    worldFadeDelayTimeoutId = null;
    fadeOutJourneyWorldsSound(JOURNEY_WORLDS_WORLD_FADE_OUT_MS);
  }, Math.max(0, worldFadeAt - Date.now()));
}

function stopAndRewind(): void {
  playbackGeneration++;
  lifecycle.deactivate();
  clearVolumeTimers();
  clearWorldFadeSchedule();
  clearBoardTransitionHandoff();
  active = false;
  fading = false;
  activeSurface = 'hub';
  if (!MOBILE_RUNTIME_PROFILE.isMobileDevice) stopDecodedGameplayVoice(VOICE_ID);
  if (!mediaAudio) return;
  try {
    mediaAudio.pause();
    mediaAudio.currentTime = 0;
    mediaAudio.volume = JOURNEY_WORLDS_HUB_VOLUME;
  } catch {}
}

export function preloadJourneyWorldsHubSound(): boolean {
  if (!areSoundsEnabled()) return false;
  // Hub/world overlap must not crowd short cues out of the mobile PCM cache.
  if (MOBILE_RUNTIME_PROFILE.isMobileDevice) return getMediaAudio() !== null;
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
  fading = false;
  const targetVolume = getSurfaceVolume(surface);
  const safeDurationMs = Math.max(0, durationMs);
  if (lifecycle.isSuspended()) {
    if (mediaAudio) mediaAudio.volume = targetVolume;
    return true;
  }
  if (!MOBILE_RUNTIME_PROFILE.isMobileDevice) setDecodedGameplayVoiceVolume(VOICE_ID, targetVolume, safeDurationMs / 1000);

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
  fading = false;
  activeSurface = surface;
  const volume = getSurfaceVolume(surface);
  const session = {
    canResume: () => active && areSoundsEnabled(),
    onRetire: stopAndRewind,
    onSuspend: () => {
      // A departing-screen tail has no foreground ownership to regain.
      if (fading || boardTransitionHandoffArmed) { stopAndRewind(); return; }
      clearVolumeTimers();
      clearWorldFadeSchedule(true);
    },
    beforeResume: () => {
      // Do not restart the five-second World hold after time spent hidden.
      // If its fade boundary passed offscreen, retire the inaudible tail.
      if (activeSurface === 'world' && worldFadeAt !== null && Date.now() >= worldFadeAt) {
        stopAndRewind();
        return;
      }
      if (mediaAudio) mediaAudio.volume = getSurfaceVolume(activeSurface);
      if (activeSurface === 'world') scheduleWorldFadeOnce();
    },
    onFailure: (error: unknown) => {
      logger.warn('Failed to play Journey Worlds Hub loop:', String(error));
      stopAndRewind();
    },
  };
  const decodedState = MOBILE_RUNTIME_PROFILE.isMobileDevice ? 'unavailable'
    : getDecodedGameplaySoundsState([JOURNEY_WORLDS_HUB_SOUND_SOURCE]);
  if (decodedState !== 'unavailable') {
    lifecycle.activate({
      ...session,
      media: [],
      pauseDecoded: () => { playbackGeneration++; stopDecodedGameplayVoice(VOICE_ID); },
      playDecoded: () => {
        const generation = ++playbackGeneration;
        const failStart = () => { if (generation === playbackGeneration) stopAndRewind(); };
        const result = playDecodedGameplaySound(JOURNEY_WORLDS_HUB_SOUND_SOURCE, {
          voiceId: VOICE_ID,
          volume: getSurfaceVolume(activeSurface),
          loop: true,
          onDeferredUnavailable: failStart,
        });
        if (result === 'unavailable') failStart();
      },
    });
    return active;
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
    lifecycle.activate({ ...session, media: [audio] });
    return active;
  } catch (error) {
    stopAndRewind();
    logger.warn('Failed to start Journey Worlds Hub loop:', error);
    return false;
  }
}

export function playJourneyWorldsHubSound(): boolean {
  clearBoardTransitionHandoff();
  return playJourneyWorldsSound('hub');
}

export function playJourneyWorldsWorldSound(): boolean {
  const started = playJourneyWorldsSound('world');
  // Hub -> World already schedules this lifetime while reducing the live Hub
  // voice. Direct World entry and board -> World return start at the reduced
  // gain, so they must acquire the same bounded 5s hold + 1s fade here. Keep
  // the first deadline when duplicate enter callbacks share one World visit.
  if (started) scheduleWorldFadeOnce();
  return started;
}

export function reduceJourneyWorldsSoundForWorld(
  durationMs = JOURNEY_WORLDS_VOLUME_TRANSITION_MS,
): boolean {
  clearWorldFadeSchedule();
  const transitioned = transitionToSurfaceVolume('world', durationMs);
  if (!transitioned) return false;
  scheduleWorldFadeOnce();
  return true;
}

export function armJourneyWorldsSoundForBoardTransition(): boolean {
  if (!active) return false;
  if (lifecycle.isSuspended()) { stopAndRewind(); return false; }
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
  if (lifecycle.isSuspended()) { stopAndRewind(); return true; }

  clearVolumeTimers();
  clearWorldFadeSchedule();
  fading = true;
  const safeDurationMs = Math.max(0, durationMs);
  if (safeDurationMs === 0) {
    stopAndRewind();
    return true;
  }

  if (!MOBILE_RUNTIME_PROFILE.isMobileDevice) fadeOutDecodedGameplayVoice(VOICE_ID, safeDurationMs / 1000);
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
  lifecycle.resetDiagnostics();
  mediaAudio = null;
}
