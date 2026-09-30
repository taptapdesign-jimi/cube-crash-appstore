/**
 * Stack to Six global soundtrack owner.
 * - Plays the full theme across intro and menus.
 * - Keeps Journey on a restrained gameplay duck so its authored World
 *   ambiences remain authoritative.
 * - Crossfades Arcade into a loopable Calm bed, then promotes the first
 *   committed Merge-6/Wild event into the matching Active bed on a bar edge.
 * - Respects only the player-facing Music setting and app visibility.
 * - Uses one sample-accurate Web Audio source for the original intro and loop.
 */

import { logger } from '../core/logger.js';
import { isArcadeHomeRunMode } from './run-mode.js';
import {
  createSampleAccurateMainThemeVoice,
  isSampleAccurateMainThemeVoice,
  type MainThemeVoiceLike,
} from './main-theme-web-audio-transport.js';
import { NATIVE_AUDIO_ACTIVE_EVENT } from './soundtrack-context-recovery.js';
import {
  isThermalAudioSuppressed, recordThermalAudioIsolationBlock, subscribeThermalAudioIsolation,
} from '../utils/thermal-audio-isolation.js';
import { arePerformanceDiagnosticsEnabled } from '../utils/runtime-diagnostics-policy.js';
import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.js';

export const SOUNDTRACK_URL =
  './assets/sound/soundtrack/theme-loop-v1/SIx-theme-seamless-loop.wav';
export const SOUNDTRACK_INTRO_URL =
  './assets/sound/soundtrack/theme-loop-v1/SIx-theme-original-intro-bridge.wav';
export const SOUNDTRACK_RUNTIME_URL =
  './assets/sound/soundtrack/theme-loop-v1/SIx-theme-runtime-intro-loop.wav';
export const SOUNDTRACK_LOOP_DURATION_SECONDS = 57.63275;
export const SOUNDTRACK_INTRO_DURATION_MS = 2058.3125;
export const SOUNDTRACK_RUNTIME_DURATION_SECONDS = 59.6910625;
export const SOUNDTRACK_INTRO_CROSSFADE_MS = 320;
export const SOUNDTRACK_INTRO_CROSSFADE_DELAY_MS = 120;
export const SOUNDTRACK_LAUNCH_FADE_IN_MS = 2000;
export const SOUNDTRACK_INTRO_LOOP_PREROLL_SECONDS =
  SOUNDTRACK_LOOP_DURATION_SECONDS - SOUNDTRACK_INTRO_DURATION_MS / 1000;
export const SOUNDTRACK_RESUME_FADE_IN_MS = 420;
export const SOUNDTRACK_VOLUME = 0.578;
export const SOUNDTRACK_TRANSITION_VOLUME_RATIO = 0.20;
export const SOUNDTRACK_TRANSITION_VOLUME = SOUNDTRACK_VOLUME * SOUNDTRACK_TRANSITION_VOLUME_RATIO;
export const SOUNDTRACK_GAMEPLAY_VOLUME_RATIO = 0.33;
export const SOUNDTRACK_GAMEPLAY_VOLUME = SOUNDTRACK_VOLUME * SOUNDTRACK_GAMEPLAY_VOLUME_RATIO;
export const SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS = 320;
export const SOUNDTRACK_GAMEPLAY_SETTLE_MS = 320;
export const SOUNDTRACK_VICTORY_FADE_OUT_MS = 420;
export const SOUNDTRACK_VICTORY_FADE_IN_MS = 1000;
export const ARCADE_SOUNDTRACK_CALM_URL =
  './assets/sound/soundtrack/adaptive-music-v3/gameplay-bed-calm-01.wav';
export const ARCADE_SOUNDTRACK_ACTIVE_URL =
  './assets/sound/soundtrack/adaptive-music-v3/gameplay-bed-active-01.wav';
export const ARCADE_SOUNDTRACK_TEMPO_BPM = 116.6;
export const ARCADE_SOUNDTRACK_BAR_SECONDS = (60 / ARCADE_SOUNDTRACK_TEMPO_BPM) * 4;
export const ARCADE_SOUNDTRACK_CALM_VOLUME = 0.528;
export const ARCADE_SOUNDTRACK_ACTIVE_VOLUME = 0.594;
export const ARCADE_SOUNDTRACK_RESULT_VOLUME = 0.10;
export const ARCADE_SOUNDTRACK_ENTRY_CROSSFADE_MS = 1250;
export const ARCADE_SOUNDTRACK_BAR_CROSSFADE_MS = Math.round(
  ARCADE_SOUNDTRACK_BAR_SECONDS * 1000,
);

type ArcadeSoundtrackLayer = 'calm' | 'active';

let audio: MainThemeVoiceLike | null = null;
let introAudio: HTMLAudioElement | null = null;
let introHandoffTimer: ReturnType<typeof setTimeout> | null = null;
let introSequenceActive = false;
let introHasPlayed = false;
let pendingColdStartFadeInMs = 0;
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
  targetRatio: number;
  transitionSettled: boolean;
  completionRequested: boolean;
  settlingToGameplay: boolean;
} | null = null;
let arcadeAudio: MainThemeVoiceLike | null = null;
const arcadeVoices = new Set<MainThemeVoiceLike>();
let arcadeLayer: ArcadeSoundtrackLayer | null = null;
let arcadeRequestedLayer: ArcadeSoundtrackLayer | null = null;
let arcadeTargetVolume = ARCADE_SOUNDTRACK_CALM_VOLUME;
let arcadeSwitchGeneration = 0;
let arcadeBarSwitchTimer: ReturnType<typeof setTimeout> | null = null;
let victoryHookEnvelopeActive = false;
let victoryHookMuteActive = false;
let victoryHookGeneration = 0;
let victoryHookThemeRestoreVolume = SOUNDTRACK_VOLUME;
let victoryHookArcadeRestoreVolume = ARCADE_SOUNDTRACK_CALM_VOLUME;
let removeContextStateListener: (() => void) | null = null;
let contextStateRecoveryGeneration = 0;
let nativeForegroundOverridesHidden = false;
let nativeActivationEpoch = 0;
let lastBackgroundReceiptAtMs = 0;

function reportForegroundLifecycle(event: string, detail: Record<string, unknown> = {}): void {
  if (!arePerformanceDiagnosticsEnabled()) return;
  emitNativeConsoleDiagnostic('[CC_SOUNDTRACK_FG]', event, {
    hidden: document.hidden,
    nativeOverride: nativeForegroundOverridesHidden,
    pausedForVisibility,
    isStarted,
    gameplayDuckActive,
    victoryHookMuteActive,
    fadeInProgress,
    playRequestToken,
    gameplayFadeGeneration,
    contextState: audio?.contextState ?? null,
    resumePending: audio?.resumePending ?? false,
    paused: audio?.paused ?? null,
    gain: audio?.volume ?? null,
    sourcePresent: audio?.sourcePresent ?? null,
    sourceGeneration: audio?.sourceGeneration ?? null,
    arcadeContextState: arcadeAudio?.contextState ?? null,
    arcadeResumePending: arcadeAudio?.resumePending ?? false,
    arcadePaused: arcadeAudio?.paused ?? null,
    arcadeGain: arcadeAudio?.volume ?? null,
    arcadeSourcePresent: arcadeAudio?.sourcePresent ?? null,
    arcadeSourceGeneration: arcadeAudio?.sourceGeneration ?? null,
    arcadeLayer,
    arcadeRequestedLayer,
    ...detail,
  });
}

function isMusicEnabled(): boolean {
  if (isThermalAudioSuppressed()) {
    recordThermalAudioIsolationBlock('soundtrack-owner');
    return false;
  }
  try {
    const settings = (typeof window !== 'undefined' && (window as any)._settings) || {};
    return settings.musicEnabled !== false;
  } catch {
    return true;
  }
}

function getPlaybackTargetVolume(): number {
  if (victoryHookMuteActive) return 0;
  return gameplayDuckActive ? SOUNDTRACK_GAMEPLAY_VOLUME : SOUNDTRACK_VOLUME;
}

function clearVictoryHookEnvelope(): void {
  victoryHookGeneration++;
  if (victoryHookEnvelopeActive) {
    cancelThemeFade();
    cancelArcadeFades();
  }
  victoryHookEnvelopeActive = false;
  victoryHookMuteActive = false;
}

function clearIntroHandoffTimer(): void {
  if (introHandoffTimer === null) return;
  clearTimeout(introHandoffTimer);
  introHandoffTimer = null;
}

function stopIntroVoice(): void {
  const currentIntroAudio = introAudio;
  if (!currentIntroAudio) return;
  try {
    currentIntroAudio.pause();
    currentIntroAudio.currentTime = 0;
    currentIntroAudio.volume = 0;
  } catch {}
}

function cancelIntroSequence(resetLoopToStart: boolean): boolean {
  const wasActive = introSequenceActive || introHandoffTimer !== null;
  clearIntroHandoffTimer();
  if (wasActive) {
    cancelThemeFade();
    playRequestToken++;
  }
  introSequenceActive = false;
  stopIntroVoice();
  const currentAudio = audio;
  if (wasActive && resetLoopToStart && currentAudio) {
    try { currentAudio.currentTime = 0; } catch {}
    currentAudio.volume = getPlaybackTargetVolume();
  }
  return wasActive;
}

let themeFadeTimer: ReturnType<typeof setTimeout> | null = null;
const arcadeFadeTimers = new Set<ReturnType<typeof setTimeout>>();

function cancelThemeFade(): number {
  if (themeFadeTimer !== null) clearTimeout(themeFadeTimer);
  themeFadeTimer = null;
  audio?.cancelVolumeRamp?.();
  return ++activeFadeToken;
}

function cancelArcadeFades(): number {
  arcadeFadeTimers.forEach(clearTimeout);
  arcadeFadeTimers.clear();
  arcadeVoices.forEach((voice) => voice.cancelVolumeRamp?.());
  return ++arcadeSwitchGeneration;
}

function linearFade(
  from: number,
  to: number,
  durationMs: number,
  onStep: (volume: number) => void,
  onDone: () => void,
): void {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    cancelThemeFade();
    onStep(to);
    onDone();
    return;
  }
  const token = cancelThemeFade();
  if (audio?.rampVolume) {
    audio.rampVolume(to, durationMs);
    themeFadeTimer = setTimeout(() => {
      themeFadeTimer = null;
      if (token !== activeFadeToken) return;
      onStep(to);
      onDone();
    }, durationMs);
    return;
  }
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

function getIntroAudio(): HTMLAudioElement {
  if (!introAudio) {
    introAudio = new Audio(SOUNDTRACK_INTRO_URL);
    introAudio.loop = false;
    introAudio.volume = 0;
    introAudio.preload = 'auto';
  }
  return introAudio;
}

function playOriginalIntroIntoLoop(
  currentAudio: MainThemeVoiceLike,
  successMessage: string,
): void {
  const coldStartFadeInMs = pendingColdStartFadeInMs;
  const currentIntroAudio = getIntroAudio();
  clearIntroHandoffTimer();
  cancelThemeFade();
  introSequenceActive = true;
  currentAudio.volume = 0;
  currentAudio.currentTime = SOUNDTRACK_INTRO_LOOP_PREROLL_SECONDS;
  currentIntroAudio.currentTime = 0;
  currentIntroAudio.volume = coldStartFadeInMs > 0 ? 0 : SOUNDTRACK_VOLUME;

  const requestToken = ++playRequestToken;
  let readyVoices = 0;
  let requestFailed = false;
  const onReady = (): void => {
    if (requestFailed) return;
    readyVoices += 1;
    if (readyVoices < 2) return;
    if (requestToken !== playRequestToken) return;
    if (
      audio !== currentAudio ||
      introAudio !== currentIntroAudio ||
      !isMusicEnabled()
    ) {
      currentAudio.pause();
      stopIntroVoice();
      return;
    }

    introHasPlayed = true;
    pendingColdStartFadeInMs = 0;
    isStarted = true;
    autoplayRetryInFlight = false;
    disarmAutoplayRetry();
    if (coldStartFadeInMs > 0) {
      fadeInProgress = true;
      linearFade(0, SOUNDTRACK_VOLUME, coldStartFadeInMs, (volume) => {
        if (introSequenceActive && introAudio === currentIntroAudio) {
          currentIntroAudio.volume = volume;
        }
      }, () => {
        if (!introSequenceActive || introAudio !== currentIntroAudio) return;
        currentIntroAudio.volume = SOUNDTRACK_VOLUME;
        fadeInProgress = false;
        logger.info('🔊 Launch theme fade-in completed');
      });
    }
    const fadeStartMs = SOUNDTRACK_INTRO_DURATION_MS +
      SOUNDTRACK_INTRO_CROSSFADE_DELAY_MS;
    introHandoffTimer = setTimeout(() => {
      introHandoffTimer = null;
      if (
        !introSequenceActive ||
        audio !== currentAudio ||
        introAudio !== currentIntroAudio ||
        !isMusicEnabled()
      ) return;
      // The intro bridge is still playing the exact same second-bar material
      // as the loop. Align to the bridge's real media clock (the fixed delay is
      // only a defensive fallback for test/browser clocks that report zero),
      // then use a constant-sum linear splice. Equal-power curves are correct
      // for unrelated tracks, but they create a +3 dB bulge when both sources
      // contain this same correlated phrase.
      const bridgeLoopPosition = currentIntroAudio.currentTime >
        SOUNDTRACK_INTRO_DURATION_MS / 1000
        ? currentIntroAudio.currentTime - SOUNDTRACK_INTRO_DURATION_MS / 1000
        : SOUNDTRACK_INTRO_CROSSFADE_DELAY_MS / 1000;
      currentAudio.currentTime = bridgeLoopPosition;
      const targetVolume = getPlaybackTargetVolume();
      linearFade(0, 1, SOUNDTRACK_INTRO_CROSSFADE_MS, (progress) => {
        if (!introSequenceActive) return;
        currentIntroAudio.volume = targetVolume * (1 - progress);
        currentAudio.volume = targetVolume * progress;
      }, () => {
        if (!introSequenceActive || audio !== currentAudio) return;
        introSequenceActive = false;
        stopIntroVoice();
        currentAudio.volume = targetVolume;
        logger.info('🔊 Original theme intro handed off to seamless loop');
      });
    }, fadeStartMs);
    logger.info(successMessage);
  };
  const onFailure = (error: unknown): void => {
    if (requestFailed || requestToken !== playRequestToken) return;
    requestFailed = true;
    introSequenceActive = false;
    introHasPlayed = false;
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.volume = 0;
    stopIntroVoice();
    autoplayRetryInFlight = false;
    armAutoplayRetry();
    logger.warn(
      '🔊 Soundtrack intro play failed (user gesture may be required):',
      String(error),
    );
  };

  currentAudio.play().then(onReady).catch(onFailure);
  currentIntroAudio.play().then(onReady).catch(onFailure);
}

function playSampleAccurateTheme(
  currentAudio: MainThemeVoiceLike,
  successMessage: string,
): void {
  const coldStartFadeInMs = pendingColdStartFadeInMs;
  currentAudio.volume = coldStartFadeInMs > 0 ? 0 : SOUNDTRACK_VOLUME;
  const requestToken = ++playRequestToken;
  currentAudio.play().then(() => {
    if (requestToken !== playRequestToken) return;
    if (
      audio !== currentAudio ||
      !isMusicEnabled()
    ) {
      currentAudio.pause();
      return;
    }
    introHasPlayed = true;
    pendingColdStartFadeInMs = 0;
    autoplayRetryInFlight = false;
    markPlaybackActive(currentAudio, successMessage);
    if (coldStartFadeInMs > 0) {
      fadeInProgress = true;
      linearFade(0, SOUNDTRACK_VOLUME, coldStartFadeInMs, (volume) => {
        if (audio === currentAudio) currentAudio.volume = volume;
      }, () => {
        if (audio !== currentAudio) return;
        currentAudio.volume = SOUNDTRACK_VOLUME;
        fadeInProgress = false;
        logger.info('🔊 Launch theme fade-in completed');
      });
    }
  }).catch((error) => {
    if (requestToken !== playRequestToken) return;
    autoplayRetryInFlight = false;
    armAutoplayRetry();
    logger.warn('🔊 Sample-accurate soundtrack start failed:', error);
  });
}

function settleGameplaySoundtrackAfterTransition(generation: number): void {
  const currentAudio = audio;
  const activeFade = activeGameplayFade;
  if (
    !currentAudio ||
    currentAudio.paused ||
    !activeFade ||
    activeFade.generation !== generation ||
    generation !== gameplayFadeGeneration ||
    activeFade.settlingToGameplay
  ) return;
  activeFade.settlingToGameplay = true;
  linearFade(
    currentAudio.volume,
    SOUNDTRACK_GAMEPLAY_VOLUME,
    SOUNDTRACK_GAMEPLAY_SETTLE_MS,
    (volume) => {
      if (
        audio === currentAudio &&
        activeGameplayFade?.generation === generation &&
        generation === gameplayFadeGeneration
      ) currentAudio.volume = volume;
    },
    () => {
      if (
        audio !== currentAudio ||
        activeGameplayFade?.generation !== generation ||
        generation !== gameplayFadeGeneration
      ) return;
      currentAudio.volume = SOUNDTRACK_GAMEPLAY_VOLUME;
      activeGameplayFade = null;
      logger.info('🔊 Soundtrack raised to 33% for gameplay');
      enterArcadeCalmSoundtrack();
    },
  );
}

function clearArcadeBarSwitch(): void {
  if (arcadeBarSwitchTimer !== null) {
    clearTimeout(arcadeBarSwitchTimer);
    arcadeBarSwitchTimer = null;
  }
}

function getArcadeLayerUrl(layer: ArcadeSoundtrackLayer): string {
  return layer === 'active'
    ? ARCADE_SOUNDTRACK_ACTIVE_URL
    : ARCADE_SOUNDTRACK_CALM_URL;
}

function getArcadeLayerVolume(layer: ArcadeSoundtrackLayer): number {
  return layer === 'active'
    ? ARCADE_SOUNDTRACK_ACTIVE_VOLUME
    : ARCADE_SOUNDTRACK_CALM_VOLUME;
}

function fadeArcadeVoice(
  voice: MainThemeVoiceLike,
  to: number,
  durationMs: number,
  generation: number,
  onDone?: () => void,
): void {
  const from = voice.volume;
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    if (generation !== arcadeSwitchGeneration) return;
    voice.volume = to;
    onDone?.();
    return;
  }
  if (voice.rampVolume) {
    if (generation !== arcadeSwitchGeneration) return;
    voice.rampVolume(to, durationMs);
    const timer = setTimeout(() => {
      arcadeFadeTimers.delete(timer);
      if (generation !== arcadeSwitchGeneration) return;
      voice.volume = to;
      onDone?.();
    }, durationMs);
    arcadeFadeTimers.add(timer);
    return;
  }
  const startedAt = performance.now();
  const run = (): void => {
    if (generation !== arcadeSwitchGeneration) return;
    const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
    voice.volume = from + (to - from) * progress;
    if (progress < 1) requestAnimationFrame(run);
    else onDone?.();
  };
  requestAnimationFrame(run);
}

function discardArcadeVoice(voice: MainThemeVoiceLike): void {
  try {
    voice.pause();
    voice.currentTime = 0;
    voice.volume = 0;
  } catch {}
  try { voice.dispose?.(); } catch {}
  arcadeVoices.delete(voice);
}

function discardNonCurrentArcadeVoices(): void {
  arcadeVoices.forEach((voice) => {
    if (voice !== arcadeAudio) discardArcadeVoice(voice);
  });
}

function fadeOutArcadeSoundtrack(durationMs: number): void {
  clearArcadeBarSwitch();
  const outgoingVoices = Array.from(arcadeVoices);
  const generation = cancelArcadeFades();
  arcadeAudio = null;
  arcadeLayer = null;
  arcadeRequestedLayer = null;
  arcadeTargetVolume = ARCADE_SOUNDTRACK_CALM_VOLUME;
  outgoingVoices.forEach((outgoing) => {
    fadeArcadeVoice(outgoing, 0, durationMs, generation, () => {
      discardArcadeVoice(outgoing);
    });
  });
}

function fadeThemeOutForArcade(durationMs: number): void {
  const currentAudio = audio;
  if (!currentAudio || currentAudio.paused) return;
  linearFade(currentAudio.volume, 0, durationMs, (volume) => {
    if (audio === currentAudio) currentAudio.volume = volume;
  }, () => {
    if (audio !== currentAudio || !gameplayDuckActive || !isArcadeHomeRunMode()) return;
    currentAudio.volume = 0;
    currentAudio.pause();
  });
}

function switchArcadeLayer(
  layer: ArcadeSoundtrackLayer,
  durationMs: number,
  targetVolume: number = getArcadeLayerVolume(layer),
  allowHiddenNativeActive = false,
): void {
  if (!isMusicEnabled() || !gameplayDuckActive || !isArcadeHomeRunMode()) return;
  clearArcadeBarSwitch();
  // A superseded crossfade must not keep its outgoing loop alive after the
  // shared generation changes. Only the currently owned layer may survive.
  discardNonCurrentArcadeVoices();
  arcadeRequestedLayer = layer;
  arcadeTargetVolume = targetVolume;
  if (document.hidden && !allowHiddenNativeActive) {
    // Preserve the route's latest layer without fetching or starting a hidden
    // voice. A cold entry may not have installed the visibility owner yet.
    pausedForVisibility = true;
    setupVisibilityListener();
    return;
  }
  const outgoing = arcadeAudio;
  if (outgoing && arcadeLayer === layer) {
    const generation = cancelArcadeFades();
    // A retained layer can still own a paused media element or interrupted
    // AudioContext. Retrying only its gain would permanently lose the gesture.
    outgoing.play().then(() => {
      if (generation !== arcadeSwitchGeneration || arcadeAudio !== outgoing) return;
      if ((document.hidden && !allowHiddenNativeActive) || !isMusicEnabled()) { outgoing.pause(); return; }
      autoplayRetryInFlight = false;
      disarmAutoplayRetry();
      fadeArcadeVoice(outgoing, targetVolume, durationMs, generation);
    }).catch((error) => {
      if (generation !== arcadeSwitchGeneration || arcadeAudio !== outgoing) return;
      autoplayRetryInFlight = false;
      armAutoplayRetry();
      logger.warn('🔊 Retained Arcade soundtrack resume failed:', error);
    });
    return;
  }

  const incoming = getAudio().createMediaVoice?.(getArcadeLayerUrl(layer)) ??
    new Audio(getArcadeLayerUrl(layer));
  arcadeVoices.add(incoming);
  incoming.loop = true;
  incoming.preload = 'auto';
  incoming.volume = 0;
  if (outgoing && Number.isFinite(outgoing.currentTime)) {
    try { incoming.currentTime = outgoing.currentTime; } catch {}
  }
  const generation = cancelArcadeFades();
  incoming.play().then(() => {
    if (
      generation !== arcadeSwitchGeneration ||
      (document.hidden && !allowHiddenNativeActive) ||
      !isMusicEnabled() ||
      !gameplayDuckActive ||
      !isArcadeHomeRunMode()
    ) {
      discardArcadeVoice(incoming);
      return;
    }
    if (outgoing && Number.isFinite(outgoing.currentTime)) {
      try {
        incoming.currentTime = typeof incoming.duration === 'number' && Number.isFinite(incoming.duration) && incoming.duration > 0
          ? outgoing.currentTime % incoming.duration
          : outgoing.currentTime;
      } catch {}
    }
    arcadeAudio = incoming;
    arcadeLayer = layer;
    arcadeRequestedLayer = layer;
    isStarted = true;
    disarmAutoplayRetry();
    fadeArcadeVoice(incoming, targetVolume, durationMs, generation);
    if (outgoing) {
      fadeArcadeVoice(outgoing, 0, durationMs, generation, () => {
        discardArcadeVoice(outgoing);
      });
    } else {
      fadeThemeOutForArcade(durationMs);
    }
    logger.info(`🔊 Arcade soundtrack switched to ${layer}`);
  }).catch((error) => {
    discardArcadeVoice(incoming);
    if (generation !== arcadeSwitchGeneration) return;
    armAutoplayRetry();
    logger.warn(`🔊 Arcade ${layer} soundtrack play failed:`, error);
  });
}

function enterArcadeCalmSoundtrack(): void {
  if (!isArcadeHomeRunMode()) return;
  switchArcadeLayer(
    'calm',
    ARCADE_SOUNDTRACK_ENTRY_CROSSFADE_MS,
    ARCADE_SOUNDTRACK_CALM_VOLUME,
  );
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

function markPlaybackActive(currentAudio: MainThemeVoiceLike, message: string): void {
  if (audio !== currentAudio) return;
  isStarted = true;
  disarmAutoplayRetry();
  logger.info(message);
}

function onAutoplayRetry(event: Event): void {
  if (document.hidden) return;
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
  if (gameplayDuckActive && isArcadeHomeRunMode() && arcadeRequestedLayer) {
    autoplayRetryInFlight = false;
    switchArcadeLayer(
      arcadeRequestedLayer,
      ARCADE_SOUNDTRACK_ENTRY_CROSSFADE_MS,
      arcadeTargetVolume,
    );
    return;
  }
  const currentAudio = getAudio();
  if (gameplayDuckActive) activeGameplayFade = null;
  if (!introHasPlayed) {
    if (isSampleAccurateMainThemeVoice(currentAudio)) {
      playSampleAccurateTheme(
        currentAudio,
        '🔊 Original Stack to Six intro started after user gesture',
      );
      return;
    }
    playOriginalIntroIntoLoop(
      currentAudio,
      '🔊 Original Stack to Six intro started after user gesture',
    );
    return;
  }
  currentAudio.volume = getPlaybackTargetVolume();
  const requestToken = ++playRequestToken;
  currentAudio.play().then(() => {
    if (requestToken !== playRequestToken) return;
    if (audio !== currentAudio || !isMusicEnabled()) {
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
  currentAudio: MainThemeVoiceLike,
  durationMs: number,
  successMessage: string,
  targetVolume: number = getPlaybackTargetVolume(),
): void {
  cancelThemeFade();
  fadeInProgress = true;
  currentAudio.volume = 0;
  const requestToken = ++playRequestToken;
  reportForegroundLifecycle('fade-start', { requestToken, durationMs, targetVolume });
  currentAudio.play().then(() => {
    if (requestToken !== playRequestToken) {
      reportForegroundLifecycle('fade-stale-resolve', { requestToken });
      return;
    }
    if (audio !== currentAudio || !isMusicEnabled()) {
      currentAudio.pause();
      fadeInProgress = false;
      reportForegroundLifecycle('fade-retired-after-play', { requestToken });
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
      reportForegroundLifecycle('fade-complete', { requestToken, targetVolume });
      logger.info(successMessage);
    });
  }).catch((error) => {
    if (requestToken !== playRequestToken) return;
    fadeInProgress = false;
    armAutoplayRetry();
    reportForegroundLifecycle('fade-rejected', { requestToken, error: String(error) });
    logger.warn('🔊 Soundtrack play failed (user gesture may be required):', error);
  });
}

function onVisibilityChange(event?: Event): void {
  if (isThermalAudioSuppressed()) return;
  const currentAudio = audio;
  const eventType = event?.type ?? 'unknown';
  const nativeAudioIsActive = eventType === NATIVE_AUDIO_ACTIVE_EVENT;
  const isBackgroundReceipt = eventType === 'pagehide' ||
    (eventType === 'visibilitychange' && document.hidden);
  const nativeDetail = nativeAudioIsActive && event instanceof CustomEvent
    ? event.detail as Record<string, unknown> | undefined
    : undefined;
  reportForegroundLifecycle('receipt', { eventType, nativeDetail });

  // pageshow means a document is being presented; it is never evidence of a
  // new hide. WKWebView may still report document.hidden=true after the
  // authoritative native app-active receipt, so only pagehide or an actual
  // hidden visibilitychange may retire playback.
  if (isBackgroundReceipt) {
    lastBackgroundReceiptAtMs = Date.now();
    nativeForegroundOverridesHidden = false;
    if (!currentAudio && arcadeVoices.size === 0) {
      reportForegroundLifecycle('background-empty', { eventType });
      return;
    }
    // A committed promotion must survive backgrounding as intent, never as a
    // timer that can fetch/decode/play after all current voices were paused.
    if (arcadeBarSwitchTimer !== null) {
      arcadeRequestedLayer = 'active';
      arcadeTargetVolume = ARCADE_SOUNDTRACK_ACTIVE_VOLUME;
    }
    clearArcadeBarSwitch();
    cancelIntroSequence(true);
    cancelThemeFade();
    cancelArcadeFades();
    playRequestToken++;
    fadeInProgress = false;
    autoplayRetryInFlight = false;
    if (gameplayDuckActive) {
      activeGameplayFade = null;
      if (currentAudio) currentAudio.volume = SOUNDTRACK_GAMEPLAY_VOLUME;
    }
    currentAudio?.pause();
    arcadeVoices.forEach((voice) => {
      if (voice !== arcadeAudio) discardArcadeVoice(voice);
      else {
        voice.volume = arcadeTargetVolume;
        voice.pause();
      }
    });
    pausedForVisibility = isMusicEnabled();
    reportForegroundLifecycle('background-retired', { eventType });
    logger.info('🔊 Soundtrack paused (app in background)');
    return;
  }

  if (eventType === 'pageshow' && document.hidden) {
    reportForegroundLifecycle('pageshow-stale-hidden-ignored');
    return;
  }
  const contextRunningReceipt = eventType === 'soundtrack-context-running';
  const nativeRequestAtMs = Number(
    nativeDetail?.activationRequestedAtMs ?? nativeDetail?.activationCompletedAtMs,
  );
  const nativeReceiptPredatesBackground = nativeAudioIsActive &&
    Number.isFinite(nativeRequestAtMs) &&
    nativeRequestAtMs > 0 &&
    nativeRequestAtMs <= lastBackgroundReceiptAtMs;
  if (nativeReceiptPredatesBackground) {
    reportForegroundLifecycle('native-receipt-retired-after-background', {
      nativeRequestAtMs,
      lastBackgroundReceiptAtMs,
    });
    return;
  }
  if (
    document.hidden &&
    !nativeAudioIsActive &&
    !(contextRunningReceipt && nativeForegroundOverridesHidden)
  ) {
    reportForegroundLifecycle('foreground-blocked-hidden', { eventType });
    return;
  }
  if (nativeAudioIsActive && document.hidden) nativeForegroundOverridesHidden = true;
  else if (!document.hidden) nativeForegroundOverridesHidden = false;

  const nativeEpochCandidate = Number(
    nativeDetail?.activationSequence ?? nativeDetail?.activationEpoch,
  );
  const activationEpoch = nativeAudioIsActive
    ? (Number.isFinite(nativeEpochCandidate) && nativeEpochCandidate > 0
      ? Math.max(nativeActivationEpoch, nativeEpochCandidate)
      : nativeActivationEpoch + 1)
    : nativeActivationEpoch;
  if (nativeAudioIsActive) nativeActivationEpoch = activationEpoch;

  // visibility/pageshow can run before the authoritative native audio-session
  // activation completes. If they already created a logically live source, the
  // native receipt rebinds that one voice at the same position exactly once for
  // this activation epoch; otherwise the regular paused-voice path below owns it.
  const nativeThemeReacquireOwnsReceipt = !!(
    nativeAudioIsActive && currentAudio && !currentAudio.paused &&
    currentAudio.reacquireAfterNativeActivation
  );
  const nativeArcadeReacquireOwnsReceipt = !!(
    nativeAudioIsActive && arcadeAudio && !arcadeAudio.paused &&
    arcadeAudio.reacquireAfterNativeActivation
  );
  if (nativeThemeReacquireOwnsReceipt && currentAudio) {
    void currentAudio.reacquireAfterNativeActivation?.(activationEpoch).then((reacquired) => {
      reportForegroundLifecycle('native-theme-reacquire-result', {
        activationEpoch,
        reacquired,
      });
    }).catch((error) => {
      armAutoplayRetry();
      reportForegroundLifecycle('native-theme-reacquire-failed', {
        activationEpoch,
        error: String(error),
      });
    });
  }
  if (nativeArcadeReacquireOwnsReceipt && arcadeAudio) {
    void arcadeAudio.reacquireAfterNativeActivation?.(activationEpoch).then((reacquired) => {
      reportForegroundLifecycle('native-arcade-reacquire-result', {
        activationEpoch,
        reacquired,
      });
    }).catch((error) => {
      armAutoplayRetry();
      reportForegroundLifecycle('native-arcade-reacquire-failed', {
        activationEpoch,
        error: String(error),
      });
    });
  }

  if (gameplayDuckActive && isArcadeHomeRunMode()) {
    // The native bridge confirms app activation when WKWebView leaves hidden
    // stale. Only that event may bypass the hidden start gate; timers may not.
    if (document.hidden && !nativeAudioIsActive) return;
    if (arcadeRequestedLayer && (!arcadeAudio || arcadeRequestedLayer !== arcadeLayer)) {
      pausedForVisibility = false;
      reportForegroundLifecycle('arcade-layer-reacquire', { eventType });
      switchArcadeLayer(arcadeRequestedLayer, SOUNDTRACK_RESUME_FADE_IN_MS, arcadeTargetVolume, nativeAudioIsActive);
      return;
    }
  }

  // WKWebView may restore a page without a matching hidden event. A live
  // sample-accurate source can remain attached to an interrupted context.
  if (currentAudio && !currentAudio.paused && !nativeThemeReacquireOwnsReceipt) {
    const recovery = currentAudio.resumeIfInterrupted?.();
    void recovery?.catch((error) => {
      armAutoplayRetry();
      logger.warn('🔊 Main theme AudioContext foreground resume failed:', error);
    });
  }
  if (arcadeAudio && !arcadeAudio.paused && !nativeArcadeReacquireOwnsReceipt) {
    void arcadeAudio.resumeIfInterrupted?.().catch(() => armAutoplayRetry());
  }
  const arcadeOwnsMusic = gameplayDuckActive && isArcadeHomeRunMode() && arcadeAudio;
  const shouldResume = pausedForVisibility || (
    isStarted && !victoryHookMuteActive &&
    (arcadeOwnsMusic ? arcadeAudio?.paused : currentAudio?.paused)
  );
  if (!shouldResume) {
    reportForegroundLifecycle('foreground-logical-live', { eventType });
    return;
  }
  pausedForVisibility = false;
  if (!isMusicEnabled()) {
    reportForegroundLifecycle('foreground-music-disabled', { eventType });
    return;
  }
  if (gameplayDuckActive && isArcadeHomeRunMode() && arcadeAudio) {
    const currentArcadeAudio = arcadeAudio;
    currentArcadeAudio.volume = 0;
    const generation = cancelArcadeFades();
    currentArcadeAudio.play().then(() => {
      if (
        generation !== arcadeSwitchGeneration ||
        arcadeAudio !== currentArcadeAudio ||
        !isMusicEnabled()
      ) {
        currentArcadeAudio.pause();
        return;
      }
      fadeArcadeVoice(
        currentArcadeAudio,
        arcadeTargetVolume,
        SOUNDTRACK_RESUME_FADE_IN_MS,
        generation,
      );
      logger.info('🔊 Arcade soundtrack resumed (app visible)');
    }).catch((error) => {
      if (generation !== arcadeSwitchGeneration) return;
      armAutoplayRetry();
      logger.warn('🔊 Arcade soundtrack resume failed:', error);
    });
    return;
  }
  if (!currentAudio) {
    // A menu handoff can be deferred before its first audio allocation.
    // This visibility/native-active receipt now owns that retained intent.
    startSoundtrack();
    reportForegroundLifecycle('foreground-cold-start', { eventType });
    return;
  }
  reportForegroundLifecycle('foreground-theme-reacquire', { eventType });
  playWithFadeIn(
    currentAudio,
    SOUNDTRACK_RESUME_FADE_IN_MS,
    '🔊 Soundtrack resumed (app visible)',
  );
}

function onSoundtrackContextStateChange(): void {
  const currentAudio = audio;
  const currentArcadeAudio = arcadeAudio;
  reportForegroundLifecycle('context-state-change', {
    contextState: currentAudio?.contextState ?? null,
  });
  if (!currentAudio) return;
  if (currentAudio.contextState !== 'running') {
    if (
      !isMusicEnabled() ||
      (document.hidden && !nativeForegroundOverridesHidden)
    ) return;
    const routeVoice = gameplayDuckActive && isArcadeHomeRunMode() && currentArcadeAudio
      ? currentArcadeAudio
      : currentAudio;
    const generation = ++contextStateRecoveryGeneration;
    reportForegroundLifecycle('context-interrupted-recovery-start', { generation });
    void routeVoice.resumeIfInterrupted?.().then(() => {
      if (
        generation !== contextStateRecoveryGeneration ||
        !isMusicEnabled() ||
        (document.hidden && !nativeForegroundOverridesHidden)
      ) return;
      if (routeVoice.contextState === 'running') {
        onVisibilityChange(new Event('soundtrack-context-running'));
      }
    }).catch((error) => {
      if (generation !== contextStateRecoveryGeneration) return;
      armAutoplayRetry();
      reportForegroundLifecycle('context-interrupted-recovery-failed', {
        generation,
        error: String(error),
      });
    });
    return;
  }
  const generation = ++contextStateRecoveryGeneration;
  // WebKit can move an interrupted context to running after resume() already
  // timed out. Let the current manager state settle first, then reacquire only
  // the still-owned route voice. Without this receipt a second app lifecycle
  // cycle was the next event capable of restarting the paused source.
  void Promise.resolve().then(() => {
    if (
      generation !== contextStateRecoveryGeneration ||
      audio !== currentAudio ||
      currentAudio.contextState !== 'running' ||
      !isMusicEnabled() ||
      (document.hidden && !nativeForegroundOverridesHidden)
    ) {
      reportForegroundLifecycle('context-running-receipt-retired', { generation });
      return;
    }
    reportForegroundLifecycle('context-running-reacquire', { generation });
    // A Web Audio state receipt is not proof that AVAudioSession completed a
    // new activation. Keep it separate so it cannot consume a native epoch or
    // force a redundant source rebind.
    onVisibilityChange(new Event('soundtrack-context-running'));
  });
}

function setupVisibilityListener(): void {
  if (
    visibilityListenerInstalled ||
    typeof document === 'undefined' ||
    document.hidden === undefined
  ) return;
  visibilityListenerInstalled = true;
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onVisibilityChange);
  window.addEventListener('pageshow', onVisibilityChange);
  window.addEventListener(NATIVE_AUDIO_ACTIVE_EVENT, onVisibilityChange);
}

function getAudio(): MainThemeVoiceLike {
  if (!audio) {
    audio = createSampleAccurateMainThemeVoice({
      source: SOUNDTRACK_RUNTIME_URL,
      loopStartSeconds: SOUNDTRACK_INTRO_DURATION_MS / 1000,
      loopEndSeconds: SOUNDTRACK_RUNTIME_DURATION_SECONDS,
      initialVolume: SOUNDTRACK_VOLUME,
    }) ?? new Audio(SOUNDTRACK_URL);
    audio.loop = true;
    audio.volume = SOUNDTRACK_VOLUME;
    audio.preload = 'auto';
    removeContextStateListener = audio.subscribeContextStateChange?.(
      onSoundtrackContextStateChange,
    ) ?? null;
    setupVisibilityListener();
  }
  return audio;
}

/** Begin decoding the one-source intro/loop master before the launch cue is due. */
export function preloadSoundtrack(): void {
  if (!isMusicEnabled()) return;
  getAudio();
}

/** Start the first launch intro at zero gain and reveal it behind logo SFX. */
export function startLaunchSoundtrack(): void {
  if (!isMusicEnabled()) return;
  if (!introHasPlayed) pendingColdStartFadeInMs = SOUNDTRACK_LAUNCH_FADE_IN_MS;
  startSoundtrack();
}

/** Start the global theme. Repeated calls do not restart an active track. */
export function startSoundtrack(): void {
  if (!isMusicEnabled()) return;
  clearVictoryHookEnvelope();
  fadeOutArcadeSoundtrack(0);
  gameplayDuckActive = false;
  activeGameplayFade = null;
  gameplayFadeGeneration++;
  const currentAudio = getAudio();
  if (!currentAudio.paused) return;
  if (!introHasPlayed) {
    if (isSampleAccurateMainThemeVoice(currentAudio)) {
      playSampleAccurateTheme(
        currentAudio,
        '🔊 Original Stack to Six intro started on sample-accurate loop transport',
      );
      return;
    }
    playOriginalIntroIntoLoop(currentAudio, '🔊 Original Stack to Six intro started');
    return;
  }
  currentAudio.volume = SOUNDTRACK_VOLUME;
  const requestToken = ++playRequestToken;
  currentAudio.play().then(() => {
    if (requestToken !== playRequestToken) return;
    if (audio !== currentAudio || !isMusicEnabled()) {
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
  clearVictoryHookEnvelope();
  cancelIntroSequence(false);
  cancelThemeFade();
  playRequestToken++;
  fadeInProgress = false;
  pendingColdStartFadeInMs = 0;
  pausedForVisibility = false;
  disarmAutoplayRetry();
  autoplayRetryInFlight = false;
  gameplayDuckActive = false;
  activeGameplayFade = null;
  gameplayFadeGeneration++;
  fadeOutArcadeSoundtrack(0);
  const currentAudio = audio;
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = introHasPlayed && isSampleAccurateMainThemeVoice(currentAudio)
        ? SOUNDTRACK_INTRO_DURATION_MS / 1000
        : 0;
      currentAudio.volume = 0;
    } catch {}
  }
  isStarted = false;
  logger.info('🔊 Soundtrack stopped (Music OFF)');
}

// The diagnostic controls use the existing retirement owner. Clearing a
// diagnostic suppression never acquires a route or starts playback itself.
subscribeThermalAudioIsolation((suppressed) => {
  if (!suppressed) return;
  const retiring = [audio, introAudio, ...arcadeVoices];
  stopSoundtrack();
  retiring.forEach((voice) => {
    if (!voice) return;
    try { (voice as MainThemeVoiceLike).dispose?.(); } catch {}
    // Fallback media may be detached from document; retire these exact handles.
    const media = voice as HTMLAudioElement;
    if (typeof media.removeAttribute === 'function' && typeof media.load === 'function') {
      try { media.removeAttribute('src'); media.load(); } catch {}
    }
  });
  audio = null;
  introAudio = null;
});

/** Resume after Music ON, visibility recovery, or an interrupted playback. */
export function fadeInAndResume(
  durationMs: number = SOUNDTRACK_RESUME_FADE_IN_MS,
): void {
  if (!isMusicEnabled()) return;
  pendingColdStartFadeInMs = 0;
  clearVictoryHookEnvelope();
  cancelIntroSequence(true);
  if (fadeInProgress && !gameplayDuckActive) return;
  fadeOutArcadeSoundtrack(durationMs);
  gameplayDuckActive = false;
  activeGameplayFade = null;
  gameplayFadeGeneration++;
  cancelThemeFade();
  fadeInProgress = false;
  if (document.hidden) {
    // An asynchronous route handoff may finish after visibility already
    // paused every voice. Keep its menu intent without reopening audio.
    pausedForVisibility = true;
    setupVisibilityListener();
    return;
  }
  const currentAudio = getAudio();
  if (!currentAudio.paused) {
    fadeInProgress = true;
    const fromVolume = currentAudio.volume;
    linearFade(fromVolume, SOUNDTRACK_VOLUME, durationMs, (volume) => {
      if (audio === currentAudio) currentAudio.volume = volume;
    }, () => {
      if (audio !== currentAudio) return;
      currentAudio.volume = SOUNDTRACK_VOLUME;
      fadeInProgress = false;
      logger.info('🔊 Soundtrack faded in and resumed');
    });
    return;
  }
  playWithFadeIn(currentAudio, durationMs, '🔊 Soundtrack faded in and resumed');
}

/**
 * Begin one route-owned fade without guessing its complete visual duration.
 * The caller advances this generation through its real animation phases.
 */
export function beginGameplayTransitionFade(): number {
  clearVictoryHookEnvelope();
  cancelIntroSequence(true);
  // A sample-accurate theme start may still be awaiting decode/context resume.
  // Cancel the transport request itself, not only its manager receipt: a late
  // decode must not start the menu gain underneath the route transition.
  if (audio?.paused && isSampleAccurateMainThemeVoice(audio)) audio.pause();
  playRequestToken++;
  const generation = ++gameplayFadeGeneration;
  gameplayDuckActive = true;
  fadeInProgress = false;
  disarmAutoplayRetry();
  cancelThemeFade();
  activeGameplayFade = {
    generation,
    targetRatio: 1,
    transitionSettled: false,
    completionRequested: false,
    settlingToGameplay: false,
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
  if (activeFade.settlingToGameplay) return;
  const boundedRatio = Math.max(0, Math.min(1, remainingRatio));
  activeFade.targetRatio = boundedRatio;
  const targetVolume = boundedRatio <= SOUNDTRACK_TRANSITION_VOLUME_RATIO
    ? SOUNDTRACK_TRANSITION_VOLUME
    : SOUNDTRACK_VOLUME * boundedRatio;
  const effectiveDurationMs = durationMs + (
    boundedRatio <= SOUNDTRACK_TRANSITION_VOLUME_RATIO
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
      if (boundedRatio <= SOUNDTRACK_TRANSITION_VOLUME_RATIO) {
        const finalFade = activeGameplayFade;
        if (!finalFade || finalFade.generation !== generation) return;
        finalFade.transitionSettled = true;
        logger.info('🔊 Soundtrack held at 20% through Board Transition');
        if (finalFade.completionRequested) {
          settleGameplaySoundtrackAfterTransition(generation);
        }
      }
    }
  });
}

/** Finish the matching route transition, then raise the theme to 33% for gameplay. */
export function completeGameplayTransitionFade(generation: number): void {
  const activeFade = activeGameplayFade;
  if (
    !activeFade ||
    activeFade.generation !== generation ||
    generation !== gameplayFadeGeneration
  ) return;
  activeFade.completionRequested = true;
  const currentAudio = audio;
  if (!currentAudio || currentAudio.paused) {
    cancelThemeFade();
    activeGameplayFade = null;
    if (currentAudio) currentAudio.volume = SOUNDTRACK_GAMEPLAY_VOLUME;
    if (
      currentAudio && isSampleAccurateMainThemeVoice(currentAudio) &&
      !isArcadeHomeRunMode() && isMusicEnabled() && !document.hidden &&
      !pausedForVisibility && !victoryHookMuteActive
    ) {
      playWithFadeIn(currentAudio, SOUNDTRACK_GAMEPLAY_SETTLE_MS,
        '🔊 Cold Journey soundtrack started at gameplay level', SOUNDTRACK_GAMEPLAY_VOLUME);
    }
    enterArcadeCalmSoundtrack();
    return;
  }
  if (activeFade.settlingToGameplay) return;
  if (activeFade.transitionSettled) {
    settleGameplaySoundtrackAfterTransition(generation);
    return;
  }
  // The normal final phase is still settling at the unchanged transition
  // level. Let its soft tail finish before the post-transition gameplay lift.
  if (activeFade.targetRatio <= SOUNDTRACK_TRANSITION_VOLUME_RATIO) return;
  continueGameplayTransitionFade(generation, SOUNDTRACK_TRANSITION_VOLUME_RATIO, 0);
}

/** Hold the established 20% transition mix, then lift gameplay to 33%. */
export function fadeOutSoundtrackForGameplay(durationMs: number): number {
  const generation = beginGameplayTransitionFade();
  continueGameplayTransitionFade(generation, SOUNDTRACK_TRANSITION_VOLUME_RATIO, durationMs);
  return generation;
}

/** Reset a new Arcade round to the restrained gameplay bed. */
export function enterArcadeGameplaySoundtrack(): void {
  if (!isMusicEnabled() || !isArcadeHomeRunMode()) return;
  clearVictoryHookEnvelope();
  playRequestToken++;
  gameplayDuckActive = true;
  activeGameplayFade = null;
  gameplayFadeGeneration++;
  enterArcadeCalmSoundtrack();
}

/** Play Again owns an audible gameplay bed even if its visual Round cue stalls. */
export function acquireGameplaySoundtrackAfterPlayAgain(): void {
  if (!isMusicEnabled()) return;
  clearVictoryHookEnvelope();
  cancelIntroSequence(true);
  playRequestToken++;
  gameplayDuckActive = true;
  activeGameplayFade = null;
  gameplayFadeGeneration++;
  fadeInProgress = false;

  if (isArcadeHomeRunMode()) {
    switchArcadeLayer('calm', 0, ARCADE_SOUNDTRACK_CALM_VOLUME);
    return;
  }

  fadeOutArcadeSoundtrack(0);
  if (document.hidden && !nativeForegroundOverridesHidden) {
    pausedForVisibility = true;
    setupVisibilityListener();
    return;
  }
  const currentAudio = getAudio();
  currentAudio.volume = SOUNDTRACK_GAMEPLAY_VOLUME;
  if (currentAudio.paused || currentAudio.contextState !== 'running') {
    playWithFadeIn(
      currentAudio,
      0,
      '🔊 Journey soundtrack reacquired by Play Again',
      SOUNDTRACK_GAMEPLAY_VOLUME,
    );
  }
}

/**
 * Promote only the first committed Arcade Merge-6/Wild moment. Both loops are
 * authored to the same tempo and length, so phase-matching currentTime and
 * waiting for the next bar gives us a musical, non-destructive transition.
 */
export function promoteArcadeSoundtrackAfterMerge6(): void {
  if (
    !isMusicEnabled() ||
    !gameplayDuckActive ||
    !isArcadeHomeRunMode() ||
    !arcadeAudio ||
    arcadeLayer !== 'calm' ||
    arcadeBarSwitchTimer !== null
  ) return;
  const barPosition = arcadeAudio.currentTime % ARCADE_SOUNDTRACK_BAR_SECONDS;
  const delaySeconds = barPosition <= 0.03
    ? 0
    : ARCADE_SOUNDTRACK_BAR_SECONDS - barPosition;
  arcadeBarSwitchTimer = setTimeout(() => {
    arcadeBarSwitchTimer = null;
    if (arcadeLayer !== 'calm') return;
    switchArcadeLayer(
      'active',
      ARCADE_SOUNDTRACK_BAR_CROSSFADE_MS,
      ARCADE_SOUNDTRACK_ACTIVE_VOLUME,
    );
  }, Math.round(delaySeconds * 1000));
}

/** Leave Clean/Fail sax, stars and money cues in front without cutting music. */
export function setSoundtrackResultMix(): void {
  clearArcadeBarSwitch();
  if (!arcadeAudio || !isMusicEnabled() || !isArcadeHomeRunMode()) return;
  discardNonCurrentArcadeVoices();
  arcadeTargetVolume = ARCADE_SOUNDTRACK_RESULT_VOLUME;
  const generation = cancelArcadeFades();
  fadeArcadeVoice(
    arcadeAudio,
    ARCADE_SOUNDTRACK_RESULT_VOLUME,
    SOUNDTRACK_RESUME_FADE_IN_MS,
    generation,
  );
}

/**
 * Keep the soundtrack timeline running silently under a result audio owner.
 * The returned receipt restores music only when the real result voice ends;
 * route changes cancel this hold and take ownership immediately.
 */
export type SoundtrackResultReleaseTarget = 'stable' | 'gameplay';

export function fadeSoundtrackForResultHook(): (
  target?: SoundtrackResultReleaseTarget,
) => void {
  clearVictoryHookEnvelope();
  // Result ownership must invalidate a theme transport that is still waiting
  // for decode/AudioContext resume, otherwise it can start at full gain later.
  playRequestToken++;
  if (audio?.paused && isSampleAccurateMainThemeVoice(audio)) audio.pause();
  cancelIntroSequence(true);
  const fadeInDurationMs = SOUNDTRACK_VICTORY_FADE_IN_MS;
  const fadeOutDurationMs = SOUNDTRACK_VICTORY_FADE_OUT_MS;
  // A result is no longer gameplay. Restore directly to the next stable owner
  // level so there is no gameplay-level step followed by a second level jump.
  victoryHookThemeRestoreVolume = SOUNDTRACK_VOLUME;
  victoryHookArcadeRestoreVolume = ARCADE_SOUNDTRACK_CALM_VOLUME;
  victoryHookEnvelopeActive = true;
  victoryHookMuteActive = true;
  const generation = ++victoryHookGeneration;
  cancelThemeFade();

  const currentAudio = audio;
  if (currentAudio && !currentAudio.paused) {
    linearFade(currentAudio.volume, 0, fadeOutDurationMs, (volume) => {
      if (audio === currentAudio && victoryHookMuteActive) currentAudio.volume = volume;
    }, () => {
      if (audio === currentAudio && victoryHookMuteActive) currentAudio.volume = 0;
    });
  }

  clearArcadeBarSwitch();
  const currentArcadeAudio = arcadeAudio;
  const fadeOutGeneration = cancelArcadeFades();
  arcadeTargetVolume = 0;
  arcadeVoices.forEach((voice) => {
    if (voice === currentArcadeAudio) {
      fadeArcadeVoice(voice, 0, fadeOutDurationMs, fadeOutGeneration);
    }
    else discardArcadeVoice(voice);
  });

  let released = false;
  let releasedTarget: SoundtrackResultReleaseTarget | null = null;
  const restoreThemeToTarget = (
    target: SoundtrackResultReleaseTarget,
    message: string,
  ): void => {
    gameplayDuckActive = target === 'gameplay';
    activeGameplayFade = null;
    gameplayFadeGeneration++;
    const themeRestoreVolume = target === 'gameplay'
      ? SOUNDTRACK_GAMEPLAY_VOLUME
      : victoryHookThemeRestoreVolume;

    if (!currentAudio || audio !== currentAudio) {
      victoryHookEnvelopeActive = false;
      return;
    }
    if (document.hidden || pausedForVisibility) {
      currentAudio.volume = themeRestoreVolume;
      victoryHookEnvelopeActive = false;
      return;
    }
    if (currentAudio.paused) {
      victoryHookEnvelopeActive = false;
      playWithFadeIn(currentAudio, fadeInDurationMs, message, themeRestoreVolume);
      return;
    }
    linearFade(currentAudio.volume, themeRestoreVolume, fadeInDurationMs, (volume) => {
      if (audio === currentAudio) currentAudio.volume = volume;
    }, () => {
      if (audio !== currentAudio) return;
      currentAudio.volume = themeRestoreVolume;
      victoryHookEnvelopeActive = false;
      logger.info(message);
    });
  };
  const releaseAfterResultAudio = (
    target: SoundtrackResultReleaseTarget = 'stable',
  ): void => {
    if (generation !== victoryHookGeneration) return;
    if (released) {
      if (
        target !== 'gameplay' ||
        releasedTarget === 'gameplay' ||
        (currentArcadeAudio && arcadeAudio === currentArcadeAudio && isArcadeHomeRunMode()) ||
        !isMusicEnabled()
      ) return;
      releasedTarget = 'gameplay';
      restoreThemeToTarget(
        'gameplay',
        '🔊 Soundtrack retargeted to gameplay after result CTA',
      );
      return;
    }
    if (
      !victoryHookEnvelopeActive ||
      !victoryHookMuteActive
    ) return;
    released = true;
    releasedTarget = target;
    victoryHookMuteActive = false;
    if (!isMusicEnabled()) {
      victoryHookEnvelopeActive = false;
      return;
    }

    if (
      currentArcadeAudio &&
      arcadeAudio === currentArcadeAudio &&
      gameplayDuckActive &&
      isArcadeHomeRunMode()
    ) {
      arcadeTargetVolume = victoryHookArcadeRestoreVolume;
      const restoreGeneration = cancelArcadeFades();
      if (document.hidden || pausedForVisibility || currentArcadeAudio.paused) {
        currentArcadeAudio.volume = 0;
        victoryHookEnvelopeActive = false;
        return;
      }
      fadeArcadeVoice(
        currentArcadeAudio,
        victoryHookArcadeRestoreVolume,
        fadeInDurationMs,
        restoreGeneration,
        () => {
          if (arcadeAudio !== currentArcadeAudio) return;
          victoryHookEnvelopeActive = false;
          logger.info('🔊 Arcade soundtrack restored after result audio completed');
        },
      );
      return;
    }

    restoreThemeToTarget(
      target,
      '🔊 Soundtrack restored after result audio completed',
    );
  };

  logger.info(
    `🔊 Result soundtrack owner started: ${fadeOutDurationMs}ms out, ` +
    'waiting for actual result-audio completion',
  );
  return releaseAfterResultAudio;
}

export function resetSoundtrackForTests(): void {
  clearVictoryHookEnvelope();
  cancelIntroSequence(false);
  cancelThemeFade();
  playRequestToken++;
  disarmAutoplayRetry();
  autoplayRetryInFlight = false;
  if (visibilityListenerInstalled && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onVisibilityChange);
    window.removeEventListener('pageshow', onVisibilityChange);
    window.removeEventListener(NATIVE_AUDIO_ACTIVE_EVENT, onVisibilityChange);
  }
  visibilityListenerInstalled = false;
  removeContextStateListener?.();
  removeContextStateListener = null;
  contextStateRecoveryGeneration++;
  nativeForegroundOverridesHidden = false;
  nativeActivationEpoch = 0;
  lastBackgroundReceiptAtMs = 0;
  if (audio) {
    try { audio.pause(); } catch {}
    audio.dispose?.();
  }
  stopIntroVoice();
  clearArcadeBarSwitch();
  cancelArcadeFades();
  arcadeVoices.forEach(discardArcadeVoice);
  arcadeVoices.clear();
  arcadeAudio = null;
  arcadeLayer = null;
  arcadeRequestedLayer = null;
  arcadeTargetVolume = ARCADE_SOUNDTRACK_CALM_VOLUME;
  victoryHookThemeRestoreVolume = SOUNDTRACK_VOLUME;
  victoryHookArcadeRestoreVolume = ARCADE_SOUNDTRACK_CALM_VOLUME;
  audio = null;
  introAudio = null;
  introHasPlayed = false;
  pendingColdStartFadeInMs = 0;
  pausedForVisibility = false;
  gameplayDuckActive = false;
  activeGameplayFade = null;
  gameplayFadeGeneration = 0;
  fadeInProgress = false;
  isStarted = false;
}

export const soundtrackManager = {
  start: startSoundtrack,
  startLaunch: startLaunchSoundtrack,
  stop: stopSoundtrack,
  fadeInAndResume,
  fadeOutForGameplay: fadeOutSoundtrackForGameplay,
  enterArcadeGameplay: enterArcadeGameplaySoundtrack,
  acquireGameplayAfterPlayAgain: acquireGameplaySoundtrackAfterPlayAgain,
  promoteAfterMerge6: promoteArcadeSoundtrackAfterMerge6,
  setResultMix: setSoundtrackResultMix,
  fadeForResultHook: fadeSoundtrackForResultHook,
  get isStarted() { return isStarted; },
};

/** Read-only diagnostics for the shared theme and decoded Arcade loop voices. */
export function getSoundtrackRuntimeStats(): {
  decodedBytes: number; activeVoices: number; retainedArcadeVoices: number;
  contextState: string | null; resumePending: boolean;
  sourcePresent: boolean | null; sourceGeneration: number | null; gain: number | null;
} {
  const voiceIsActive = (voice: MainThemeVoiceLike | null): boolean => !!voice &&
    !voice.paused &&
    (voice.contextState === undefined || voice.contextState === 'running') &&
    voice.sourcePresent !== false;
  return {
    decodedBytes: (audio?.decodedBytes ?? 0) + Array.from(arcadeVoices)
      .reduce((total, voice) => total + (voice.decodedBytes ?? 0), 0),
    activeVoices: Number(voiceIsActive(audio)) + Number(!!introAudio && !introAudio.paused) +
      Array.from(arcadeVoices).filter(voiceIsActive).length,
    retainedArcadeVoices: arcadeVoices.size,
    contextState: audio?.contextState ?? null,
    resumePending: audio?.resumePending ?? false,
    sourcePresent: audio?.sourcePresent ?? null,
    sourceGeneration: audio?.sourceGeneration ?? null,
    gain: audio?.volume ?? null,
  };
}
