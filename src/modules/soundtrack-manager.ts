/**
 * Stack to Six soundtrack manager.
 * - Plays soundtrack everywhere except on board game.
 * - Starts with the Stack to Six preloader; fades out when board game starts.
 * - Loop: 8 seconds before end, volume fades out; on loop restart, volume back to 1.
 * - When app goes to background (tab/visibility hidden), soundtrack pauses so it doesn't play "through the player".
 */

import { logger } from '../core/logger.js';

const SOUNDTRACK_URL = './assets/sound/soundtrack/stacktosix-soundtrack.mp3';
const PRE_END_FADE_SEC = 8;
const LOOP_FADE_STEP_MS = 100;
const BOARD_GAME_FADEOUT_MS = 2000;
const RESUME_FADEIN_MS = 2000;

let audio: HTMLAudioElement | null = null;
let loopFadeInterval: ReturnType<typeof setInterval> | null = null;
let pausedForBoardGame = false;
let isStarted = false;
/** True when we paused because page became hidden (so we can resume on visible if not in board game). */
let pausedForVisibility = false;
let activeFadeToken = 0;
let fadeInProgress = false;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(SOUNDTRACK_URL);
    audio.loop = false;
    audio.volume = 1;
    audio.preload = 'auto';
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('canplaythrough', onCanPlayThrough);
    audio.addEventListener('timeupdate', onTimeUpdate);
    setupVisibilityListener();
  }
  return audio;
}

function setupVisibilityListener(): void {
  if (typeof document === 'undefined' || document.hidden === undefined) return;
  const onVisibilityChange = (): void => {
    if (document.hidden) {
      if (!audio) return;
      if (!pausedForBoardGame && !audio.paused) {
        audio.pause();
        pausedForVisibility = true;
        logger.info('🔊 Soundtrack paused (app in background)');
      }
    } else {
      if (pausedForVisibility && !pausedForBoardGame && audio) {
        pausedForVisibility = false;
        audio.volume = 0;
        audio.play().catch((e) => logger.warn('🔊 Soundtrack resume after visibility failed:', e));
        linearFade(0, 1, RESUME_FADEIN_MS, (v) => {
          if (audio) audio.volume = v;
        }, () => logger.info('🔊 Soundtrack resumed (app visible)'));
      } else if (pausedForVisibility) {
        pausedForVisibility = false;
      }
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
}

function clearLoopFade(): void {
  if (loopFadeInterval) {
    clearInterval(loopFadeInterval);
    loopFadeInterval = null;
  }
}

function onCanPlayThrough(): void {
  logger.info('🔊 Soundtrack can play through');
}

let loopFadeOutActive = false;

function onTimeUpdate(): void {
  const a = audio;
  if (!a || pausedForBoardGame || loopFadeOutActive || a.paused) return;
  const d = a.duration;
  if (!Number.isFinite(d) || d <= 0) return;
  const remaining = d - a.currentTime;
  if (remaining <= PRE_END_FADE_SEC && !loopFadeOutActive) {
    loopFadeOutActive = true;
    startLoopFadeOut();
  }
}

function startLoopFadeOut(): void {
  clearLoopFade();
  const a = audio;
  if (!a) return;
  const steps = Math.max(1, (PRE_END_FADE_SEC * 1000) / LOOP_FADE_STEP_MS);
  const stepVolume = a.volume / steps;
  let step = 0;
  loopFadeInterval = setInterval(() => {
    step++;
    if (!audio) return;
    const v = Math.max(0, 1 - (step / steps));
    audio.volume = v;
    if (v <= 0 || step >= steps) {
      clearLoopFade();
    }
  }, LOOP_FADE_STEP_MS);
}

function onEnded(): void {
  if (pausedForBoardGame) return;
  loopFadeOutActive = false;
  clearLoopFade();
  const a = audio;
  if (!a) return;
  a.currentTime = 0;
  a.volume = 1;
  a.play().catch((e) => logger.warn('🔊 Soundtrack loop play failed:', e));
}

function linearFade(
  from: number,
  to: number,
  durationMs: number,
  onStep: (v: number) => void,
  onDone: () => void
): void {
  const token = ++activeFadeToken;
  const start = performance.now();
  const run = (): void => {
    if (token !== activeFadeToken) return;
    const elapsed = performance.now() - start;
    const t = Math.min(1, elapsed / durationMs);
    const v = from + (to - from) * t;
    onStep(v);
    if (t < 1) requestAnimationFrame(run);
    else onDone();
  };
  requestAnimationFrame(run);
}

/** Check if music is enabled in settings. */
function isMusicEnabled(): boolean {
  try {
    const s = (typeof window !== 'undefined' && (window as any)._settings) || {};
    return s.musicEnabled !== false; // default true
  } catch {
    return true;
  }
}

/**
 * Stop soundtrack (kill, cleanup). Call when user turns music OFF in settings.
 */
export function stopSoundtrack(): void {
  activeFadeToken++;
  fadeInProgress = false;
  loopFadeOutActive = false;
  clearLoopFade();
  pausedForBoardGame = true;
  pausedForVisibility = false;
  const a = audio;
  if (a) {
    try {
      a.pause();
      a.currentTime = 0;
      a.volume = 0;
    } catch {}
    logger.info('🔊 Soundtrack stopped (music toggle OFF)');
  }
}

/**
 * Start soundtrack with the Stack to Six preloader.
 * Plays from start and sets up loop with 8s pre-end fade.
 * Skips if music is disabled in settings.
 */
export function startSoundtrack(): void {
  if (!isMusicEnabled()) return;
  const a = getAudio();
  pausedForBoardGame = false;
  loopFadeOutActive = false;
  clearLoopFade();
  a.volume = 1;
  a.currentTime = 0;
  a.play().then(() => {
    isStarted = true;
    logger.info('🔊 Soundtrack started');
  }).catch((e) => {
    logger.warn('🔊 Soundtrack play failed (user gesture may be required):', e);
  });
}

/**
 * Fade out and pause (e.g. when entering board game).
 */
export function fadeOutAndPause(durationMs: number = BOARD_GAME_FADEOUT_MS): void {
  if (fadeInProgress) return;
  fadeInProgress = true;
  activeFadeToken++;
  pausedForBoardGame = true;
  loopFadeOutActive = false;
  clearLoopFade();
  const a = audio;
  if (!a || a.paused) {
    fadeInProgress = false;
    return;
  }
  const from = a.volume;
  linearFade(from, 0, durationMs, (v) => {
    if (audio) audio.volume = v;
  }, () => {
    if (audio) {
      audio.pause();
      logger.info('🔊 Soundtrack faded out and paused (board game)');
    }
    fadeInProgress = false;
  });
}

/**
 * Fade in and resume (e.g. when leaving board game).
 * Skips if music is disabled in settings.
 */
export function fadeInAndResume(durationMs: number = RESUME_FADEIN_MS): void {
  if (fadeInProgress) return;
  fadeInProgress = true;
  activeFadeToken++;
  if (!isMusicEnabled()) {
    fadeInProgress = false;
    return;
  }
  const a = getAudio();
  pausedForBoardGame = false;
  loopFadeOutActive = false;
  clearLoopFade();
  a.volume = 0;
  a.play().catch((e) => logger.warn('🔊 Soundtrack resume play failed:', e));
  linearFade(0, 1, durationMs, (v) => {
    if (audio) audio.volume = v;
  }, () => {
    logger.info('🔊 Soundtrack faded in and resumed');
    fadeInProgress = false;
  });
}

export const soundtrackManager = {
  start: startSoundtrack,
  stop: stopSoundtrack,
  fadeOutAndPause,
  fadeInAndResume,
  get isStarted() { return isStarted; }
};
