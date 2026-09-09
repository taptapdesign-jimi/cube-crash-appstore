/**
 * Stack to Six global soundtrack owner.
 * - Plays one theme continuously across intro, menus and gameplay.
 * - Ducks to 20% across the Arcade Round cue or Journey board transition.
 * - Respects only the player-facing Music setting and app visibility.
 * - Uses a very short fade-out/fade-in at the file boundary for a softer loop.
 */

import { logger } from '../core/logger.js';

export const SOUNDTRACK_URL =
  './assets/sound/soundtrack/stack to six theme.wav';
export const SOUNDTRACK_LOOP_FADE_OUT_MS = 180;
export const SOUNDTRACK_LOOP_FADE_IN_MS = 180;
export const SOUNDTRACK_RESUME_FADE_IN_MS = 420;
export const SOUNDTRACK_VOLUME = 0.68;
export const SOUNDTRACK_GAMEPLAY_VOLUME_RATIO = 0.20;
export const SOUNDTRACK_GAMEPLAY_VOLUME = SOUNDTRACK_VOLUME * SOUNDTRACK_GAMEPLAY_VOLUME_RATIO;
export const SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS = 320;

let audio: HTMLAudioElement | null = null;
let loopFadeStartTimer: ReturnType<typeof setTimeout> | null = null;
let loopFadeOutActive = false;
let pausedForVisibility = false;
let activeFadeToken = 0;
let fadeInProgress = false;
let isStarted = false;
let visibilityListenerInstalled = false;
let autoplayRetryArmed = false;
let autoplayRetryInFlight = false;
let playRequestToken = 0;
let gameplayDuckActive = false;
let gameplayFadeGeneration = 0;
let activeGameplayFade: {
  generation: number;
  alreadyDucked: boolean;
  targetRatio: number;
} | null = null;

function isMusicEnabled(): boolean {
  try {
    const settings = (typeof window !== 'undefined' && (window as any)._settings) || {};
    return settings.musicEnabled !== false;
  } catch {
    return true;
  }
}

function clearLoopFadeSchedule(): void {
  if (loopFadeStartTimer !== null) {
    clearTimeout(loopFadeStartTimer);
    loopFadeStartTimer = null;
  }
}

function getPlaybackTargetVolume(): number {
  return gameplayDuckActive ? SOUNDTRACK_GAMEPLAY_VOLUME : SOUNDTRACK_VOLUME;
}

function linearFade(
  from: number,
  to: number,
  durationMs: number,
  onStep: (volume: number) => void,
  onDone: () => void,
): void {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    activeFadeToken++;
    onStep(to);
    onDone();
    return;
  }
  const token = ++activeFadeToken;
  const start = performance.now();
  const run = (): void => {
    if (token !== activeFadeToken) return;
    const progress = Math.min(1, (performance.now() - start) / durationMs);
    onStep(from + (to - from) * progress);
    if (progress < 1) requestAnimationFrame(run);
    else onDone();
  };
  requestAnimationFrame(run);
}

function scheduleLoopFadeOut(): void {
  clearLoopFadeSchedule();
  const currentAudio = audio;
  if (!currentAudio || currentAudio.paused || loopFadeOutActive || activeGameplayFade) return;
  if (!Number.isFinite(currentAudio.duration) || currentAudio.duration <= 0) return;

  const remainingMs = Math.max(
    0,
    (currentAudio.duration - currentAudio.currentTime) * 1000,
  );
  loopFadeStartTimer = setTimeout(() => {
    loopFadeStartTimer = null;
    startLoopFadeOut();
  }, Math.max(0, remainingMs - SOUNDTRACK_LOOP_FADE_OUT_MS));
}

function startLoopFadeOut(): void {
  const currentAudio = audio;
  if (!currentAudio || currentAudio.paused || loopFadeOutActive || activeGameplayFade) return;
  loopFadeOutActive = true;
  linearFade(
    currentAudio.volume,
    0,
    SOUNDTRACK_LOOP_FADE_OUT_MS,
    (volume) => {
      if (audio === currentAudio) currentAudio.volume = volume;
    },
    () => {
      if (audio === currentAudio) currentAudio.volume = 0;
    },
  );
}

function onTimeUpdate(): void {
  const currentAudio = audio;
  if (!currentAudio || currentAudio.paused || loopFadeOutActive || activeGameplayFade) return;
  if (!Number.isFinite(currentAudio.duration) || currentAudio.duration <= 0) return;
  const remainingMs = (currentAudio.duration - currentAudio.currentTime) * 1000;
  if (remainingMs <= SOUNDTRACK_LOOP_FADE_OUT_MS) startLoopFadeOut();
  else if (loopFadeStartTimer === null) scheduleLoopFadeOut();
}

function armAutoplayRetry(): void {
  if (
    autoplayRetryArmed ||
    typeof document === 'undefined' ||
    !isMusicEnabled()
  ) return;
  autoplayRetryArmed = true;
  document.addEventListener('pointerdown', onAutoplayRetry, true);
  document.addEventListener('pointerup', onAutoplayRetry, true);
  document.addEventListener('touchend', onAutoplayRetry, true);
  document.addEventListener('keydown', onAutoplayRetry, true);
}

function disarmAutoplayRetry(): void {
  if (!autoplayRetryArmed || typeof document === 'undefined') return;
  autoplayRetryArmed = false;
  document.removeEventListener('pointerdown', onAutoplayRetry, true);
  document.removeEventListener('pointerup', onAutoplayRetry, true);
  document.removeEventListener('touchend', onAutoplayRetry, true);
  document.removeEventListener('keydown', onAutoplayRetry, true);
}

function markPlaybackActive(currentAudio: HTMLAudioElement, message: string): void {
  if (audio !== currentAudio) return;
  isStarted = true;
  disarmAutoplayRetry();
  scheduleLoopFadeOut();
  logger.info(message);
}

function onAutoplayRetry(event: Event): void {
  // Browser user activation is granted on pointerdown for a mouse, but on
  // pointerup for touch/pen. Trying on touch pointerdown can reject and remove
  // the listener before the same gesture reaches its eligible pointerup.
  if (event.type === 'pointerdown') {
    const pointerType = (event as PointerEvent).pointerType;
    if (pointerType && pointerType !== 'mouse') return;
  }
  if (event.type === 'pointerup' && (event as PointerEvent).pointerType === 'mouse') return;
  if (autoplayRetryInFlight) return;
  if (!isMusicEnabled()) {
    disarmAutoplayRetry();
    return;
  }
  autoplayRetryInFlight = true;
  disarmAutoplayRetry();
  const currentAudio = getAudio();
  if (gameplayDuckActive) activeGameplayFade = null;
  currentAudio.volume = getPlaybackTargetVolume();
  const requestToken = ++playRequestToken;
  currentAudio.play().then(() => {
    if (requestToken !== playRequestToken || audio !== currentAudio || !isMusicEnabled()) {
      currentAudio.pause();
      return;
    }
    autoplayRetryInFlight = false;
    markPlaybackActive(currentAudio, '🔊 Soundtrack started after user gesture');
  }).catch((error) => {
    if (requestToken !== playRequestToken) return;
    autoplayRetryInFlight = false;
    armAutoplayRetry();
    logger.warn('🔊 Soundtrack user-gesture retry failed:', error);
  });
}

function playWithFadeIn(
  currentAudio: HTMLAudioElement,
  durationMs: number,
  successMessage: string,
  targetVolume: number = getPlaybackTargetVolume(),
): void {
  activeFadeToken++;
  fadeInProgress = true;
  currentAudio.volume = 0;
  const requestToken = ++playRequestToken;
  currentAudio.play().then(() => {
    if (requestToken !== playRequestToken || audio !== currentAudio || !isMusicEnabled()) {
      currentAudio.pause();
      if (requestToken === playRequestToken) fadeInProgress = false;
      return;
    }
    isStarted = true;
    disarmAutoplayRetry();
    linearFade(0, targetVolume, durationMs, (volume) => {
      if (audio === currentAudio) currentAudio.volume = volume;
    }, () => {
      if (audio !== currentAudio) return;
      currentAudio.volume = targetVolume;
      fadeInProgress = false;
      scheduleLoopFadeOut();
      logger.info(successMessage);
    });
  }).catch((error) => {
    if (requestToken !== playRequestToken) return;
    fadeInProgress = false;
    armAutoplayRetry();
    logger.warn('🔊 Soundtrack play failed (user gesture may be required):', error);
  });
}

function onEnded(): void {
  clearLoopFadeSchedule();
  loopFadeOutActive = false;
  const currentAudio = audio;
  if (!currentAudio || pausedForVisibility || !isMusicEnabled()) return;
  if (gameplayDuckActive) activeGameplayFade = null;
  currentAudio.currentTime = 0;
  playWithFadeIn(
    currentAudio,
    SOUNDTRACK_LOOP_FADE_IN_MS,
    '🔊 Soundtrack loop restarted',
  );
}

function onAudioReady(): void {
  scheduleLoopFadeOut();
}

function onVisibilityChange(): void {
  const currentAudio = audio;
  if (document.hidden) {
    if (!currentAudio) return;
    activeFadeToken++;
    playRequestToken++;
    fadeInProgress = false;
    loopFadeOutActive = false;
    clearLoopFadeSchedule();
    if (gameplayDuckActive) {
      activeGameplayFade = null;
      currentAudio.volume = SOUNDTRACK_GAMEPLAY_VOLUME;
    }
    currentAudio.pause();
    pausedForVisibility = isMusicEnabled();
    logger.info('🔊 Soundtrack paused (app in background)');
    return;
  }

  if (!pausedForVisibility) return;
  pausedForVisibility = false;
  if (!currentAudio || !isMusicEnabled()) return;
  playWithFadeIn(
    currentAudio,
    SOUNDTRACK_RESUME_FADE_IN_MS,
    '🔊 Soundtrack resumed (app visible)',
  );
}

function setupVisibilityListener(): void {
  if (
    visibilityListenerInstalled ||
    typeof document === 'undefined' ||
    document.hidden === undefined
  ) return;
  visibilityListenerInstalled = true;
  document.addEventListener('visibilitychange', onVisibilityChange);
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(SOUNDTRACK_URL);
    audio.loop = false;
    audio.volume = SOUNDTRACK_VOLUME;
    audio.preload = 'auto';
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onAudioReady);
    audio.addEventListener('durationchange', onAudioReady);
    audio.addEventListener('canplaythrough', onAudioReady);
    audio.addEventListener('timeupdate', onTimeUpdate);
    setupVisibilityListener();
  }
  return audio;
}

/** Start the global theme. Repeated calls do not restart an active track. */
export function startSoundtrack(): void {
  if (!isMusicEnabled()) return;
  gameplayDuckActive = false;
  activeGameplayFade = null;
  gameplayFadeGeneration++;
  const currentAudio = getAudio();
  if (!currentAudio.paused) {
    scheduleLoopFadeOut();
    return;
  }
  loopFadeOutActive = false;
  clearLoopFadeSchedule();
  currentAudio.volume = SOUNDTRACK_VOLUME;
  const requestToken = ++playRequestToken;
  currentAudio.play().then(() => {
    if (requestToken !== playRequestToken || audio !== currentAudio || !isMusicEnabled()) {
      currentAudio.pause();
      return;
    }
    markPlaybackActive(currentAudio, '🔊 Stack to Six theme started');
  }).catch((error) => {
    if (requestToken !== playRequestToken) return;
    armAutoplayRetry();
    logger.warn('🔊 Soundtrack play failed (user gesture may be required):', error);
  });
}

/** Stop and rewind only when the player turns Music OFF. */
export function stopSoundtrack(): void {
  activeFadeToken++;
  playRequestToken++;
  fadeInProgress = false;
  loopFadeOutActive = false;
  pausedForVisibility = false;
  clearLoopFadeSchedule();
  disarmAutoplayRetry();
  autoplayRetryInFlight = false;
  gameplayDuckActive = false;
  activeGameplayFade = null;
  gameplayFadeGeneration++;
  const currentAudio = audio;
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.volume = 0;
    } catch {}
  }
  isStarted = false;
  logger.info('🔊 Soundtrack stopped (Music OFF)');
}

/** Resume after Music ON, visibility recovery, or an interrupted playback. */
export function fadeInAndResume(
  durationMs: number = SOUNDTRACK_RESUME_FADE_IN_MS,
): void {
  if (!isMusicEnabled()) return;
  if (fadeInProgress && !gameplayDuckActive) return;
  gameplayDuckActive = false;
  activeGameplayFade = null;
  gameplayFadeGeneration++;
  activeFadeToken++;
  fadeInProgress = false;
  const currentAudio = getAudio();
  if (!currentAudio.paused) {
    loopFadeOutActive = false;
    clearLoopFadeSchedule();
    fadeInProgress = true;
    const fromVolume = currentAudio.volume;
    linearFade(fromVolume, SOUNDTRACK_VOLUME, durationMs, (volume) => {
      if (audio === currentAudio) currentAudio.volume = volume;
    }, () => {
      if (audio !== currentAudio) return;
      currentAudio.volume = SOUNDTRACK_VOLUME;
      fadeInProgress = false;
      scheduleLoopFadeOut();
      logger.info('🔊 Soundtrack faded in and resumed');
    });
    return;
  }
  loopFadeOutActive = false;
  clearLoopFadeSchedule();
  playWithFadeIn(currentAudio, durationMs, '🔊 Soundtrack faded in and resumed');
}

/**
 * Begin one route-owned fade without guessing its complete visual duration.
 * The caller advances this generation through its real animation phases.
 */
export function beginGameplayTransitionFade(): number {
  const generation = ++gameplayFadeGeneration;
  const alreadyDucked = gameplayDuckActive;
  gameplayDuckActive = true;
  fadeInProgress = false;
  loopFadeOutActive = false;
  clearLoopFadeSchedule();
  disarmAutoplayRetry();
  activeFadeToken++;
  activeGameplayFade = {
    generation,
    alreadyDucked,
    targetRatio: 1,
  };
  return generation;
}

/** Fade from the current level to a fraction of the level captured at begin. */
export function continueGameplayTransitionFade(
  generation: number,
  remainingRatio: number,
  durationMs: number,
): void {
  const currentAudio = audio;
  const activeFade = activeGameplayFade;
  if (
    !currentAudio ||
    currentAudio.paused ||
    !activeFade ||
    activeFade.generation !== generation ||
    generation !== gameplayFadeGeneration
  ) return;
  const boundedRatio = Math.max(0, Math.min(1, remainingRatio));
  activeFade.targetRatio = boundedRatio;
  if (activeFade.alreadyDucked) {
    activeFadeToken++;
    currentAudio.volume = SOUNDTRACK_GAMEPLAY_VOLUME;
    activeGameplayFade = null;
    scheduleLoopFadeOut();
    return;
  }
  const targetVolume = boundedRatio <= SOUNDTRACK_GAMEPLAY_VOLUME_RATIO
    ? SOUNDTRACK_GAMEPLAY_VOLUME
    : SOUNDTRACK_VOLUME * boundedRatio;
  const effectiveDurationMs = durationMs + (
    boundedRatio <= SOUNDTRACK_GAMEPLAY_VOLUME_RATIO
      ? SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS
      : 0
  );
  linearFade(currentAudio.volume, targetVolume, effectiveDurationMs, (volume) => {
    if (
      audio === currentAudio &&
      activeGameplayFade?.generation === generation &&
      generation === gameplayFadeGeneration
    ) currentAudio.volume = volume;
  }, () => {
    if (
      audio === currentAudio &&
      activeGameplayFade?.generation === generation &&
      generation === gameplayFadeGeneration
    ) {
      currentAudio.volume = targetVolume;
      if (boundedRatio <= SOUNDTRACK_GAMEPLAY_VOLUME_RATIO) {
        activeGameplayFade = null;
        scheduleLoopFadeOut();
        logger.info('🔊 Soundtrack ducked to 20% for gameplay');
      }
    }
  });
}

/** Finish the matching route transition while keeping the theme playing at 20%. */
export function completeGameplayTransitionFade(generation: number): void {
  const activeFade = activeGameplayFade;
  if (
    !activeFade ||
    activeFade.generation !== generation ||
    generation !== gameplayFadeGeneration
  ) return;
  const currentAudio = audio;
  if (!currentAudio || currentAudio.paused) {
    activeFadeToken++;
    activeGameplayFade = null;
    if (currentAudio) currentAudio.volume = SOUNDTRACK_GAMEPLAY_VOLUME;
    return;
  }
  // The normal final phase already targets gameplay volume with the extra
  // tail. Do not snap or cancel it when the visual transition completes.
  if (activeFade.targetRatio <= SOUNDTRACK_GAMEPLAY_VOLUME_RATIO) return;
  continueGameplayTransitionFade(generation, SOUNDTRACK_GAMEPLAY_VOLUME_RATIO, 0);
}

/** Fade across a complete known-duration cue, then settle at 20% after a short tail. */
export function fadeOutSoundtrackForGameplay(durationMs: number): number {
  const generation = beginGameplayTransitionFade();
  continueGameplayTransitionFade(generation, SOUNDTRACK_GAMEPLAY_VOLUME_RATIO, durationMs);
  return generation;
}

export function resetSoundtrackForTests(): void {
  activeFadeToken++;
  playRequestToken++;
  clearLoopFadeSchedule();
  disarmAutoplayRetry();
  autoplayRetryInFlight = false;
  if (visibilityListenerInstalled && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }
  visibilityListenerInstalled = false;
  if (audio) {
    audio.removeEventListener('ended', onEnded);
    audio.removeEventListener('loadedmetadata', onAudioReady);
    audio.removeEventListener('durationchange', onAudioReady);
    audio.removeEventListener('canplaythrough', onAudioReady);
    audio.removeEventListener('timeupdate', onTimeUpdate);
    try { audio.pause(); } catch {}
  }
  audio = null;
  loopFadeOutActive = false;
  pausedForVisibility = false;
  gameplayDuckActive = false;
  activeGameplayFade = null;
  gameplayFadeGeneration = 0;
  fadeInProgress = false;
  isStarted = false;
}

export const soundtrackManager = {
  start: startSoundtrack,
  stop: stopSoundtrack,
  fadeInAndResume,
  fadeOutForGameplay: fadeOutSoundtrackForGameplay,
  get isStarted() { return isStarted; },
};
