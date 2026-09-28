import { gsap } from 'gsap';

/**
 * Canonical light profile for the hidden Journey reward card.
 *
 * The New Reward screen remains the complete shimmer/glow benchmark. The
 * interim card inside a Journey World reuses only the bounded burn/glow pulse;
 * its masked shimmer is intentionally disabled for the Journey World runtime.
 */
export const JOURNEY_INTERIM_CARD_SHINE_PROFILE = Object.freeze({
  sweepDurationMs: 1700,
  cadenceMs: 3000,
  glowPulseDurationMs: 500,
  bounceDelayMs: 150,
  bounceUpDurationSeconds: 0.14,
  bounceDownDurationSeconds: 0.18,
  bounceScaleMultiplier: 1.055,
});

export const JOURNEY_INTERIM_SHINE_TRIGGER_CLASS = 'cc-journey-interim-shine-trigger';
export const JOURNEY_INTERIM_GLOW_PULSE_CLASS = 'cc-journey-interim-glow-pulse';
export const JOURNEY_INTERIM_BURN_PULSE_CLASS = 'cc-journey-interim-burn-pulse';

type JourneyInterimShineScheduler = {
  scheduleTimeout?: (callback: () => void, delayMs: number) => number;
  scheduleFrame?: (callback: () => void) => number;
};

export type JourneyInterimShinePulseOptions = JourneyInterimShineScheduler & {
  lightElement: HTMLElement | null;
  faceElement: HTMLElement | null;
  burnElement?: HTMLElement | null;
  pulseDurationMs?: number;
  baseScale?: number;
  shouldRun?: () => boolean;
  onPulse?: () => void;
  trackTimeline?: (timeline: gsap.core.Timeline) => gsap.core.Timeline;
};

export type JourneyInterimShineLoopOptions = Omit<
  JourneyInterimShinePulseOptions,
  'scheduleTimeout' | 'scheduleFrame' | 'trackTimeline'
> & {
  initialDelayMs?: number;
  cadenceMs?: number;
};

export type JourneyInterimShineLoopController = {
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  isRunning: () => boolean;
};

export type JourneyInterimShineStartState = {
  enabled: boolean;
  renderDisposed: boolean;
  paintSuspended: boolean;
  view: 'hub' | 'world';
  managerPhase: 'hidden' | 'entering' | 'idle' | 'exiting';
  worldPhase: 'hidden' | 'entering' | 'idle' | 'exiting';
  enterOwnsCard: boolean;
  exitOwnsCard: boolean;
};

/** The card-local shine may begin only after the complete visible Unit enter. */
export function shouldStartJourneyInterimShine(state: JourneyInterimShineStartState): boolean {
  return state.enabled
    && !state.renderDisposed
    && !state.paintSuspended
    && state.view === 'world'
    && state.managerPhase === 'idle'
    && state.worldPhase === 'idle'
    && !state.enterOwnsCard
    && !state.exitOwnsCard;
}

export function applyJourneyInterimShineProfileVariables(element: HTMLElement | null): void {
  if (!element) return;
  element.style.setProperty(
    '--cc-journey-interim-shine-duration',
    `${JOURNEY_INTERIM_CARD_SHINE_PROFILE.sweepDurationMs}ms`,
  );
  element.style.setProperty(
    '--cc-journey-interim-glow-duration',
    `${JOURNEY_INTERIM_CARD_SHINE_PROFILE.glowPulseDurationMs}ms`,
  );
}

export function setJourneyInterimShineMask(lightElement: HTMLElement | null, src: string): void {
  if (!lightElement || !src) return;
  try {
    const mask = `url("${src}")`;
    lightElement.style.webkitMaskImage = mask;
    lightElement.style.maskImage = mask;
  } catch {}
}

export function clearJourneyInterimShineMask(lightElement: HTMLElement | null): void {
  if (!lightElement) return;
  try {
    lightElement.style.webkitMaskImage = 'none';
    lightElement.style.maskImage = 'none';
    lightElement.style.webkitMaskSize = '100% 100%';
    lightElement.style.maskSize = '100% 100%';
  } catch {}
}

export function setJourneyInterimShineMaskScale(
  lightElement: HTMLElement | null,
  scale: number,
): void {
  if (!lightElement) return;
  try {
    const percentage = `${Math.max(0.05, scale) * 100}%`;
    lightElement.style.webkitMaskSize = percentage;
    lightElement.style.maskSize = percentage;
  } catch {}
}

/** Play one canonical pre-click sweep and face pulse. */
export function triggerJourneyInterimShinePulse({
  lightElement,
  faceElement,
  burnElement = null,
  pulseDurationMs = JOURNEY_INTERIM_CARD_SHINE_PROFILE.glowPulseDurationMs,
  baseScale = 1,
  shouldRun = () => true,
  onPulse,
  trackTimeline = (timeline) => timeline,
  scheduleTimeout = (callback, delayMs) => window.setTimeout(callback, delayMs),
  scheduleFrame = (callback) => window.requestAnimationFrame(callback),
}: JourneyInterimShinePulseOptions): void {
  if ((!lightElement && !faceElement && !burnElement) || !shouldRun()) return;
  const boundedPulseDurationMs = Math.max(200, pulseDurationMs);

  try {
    lightElement?.classList.remove(JOURNEY_INTERIM_SHINE_TRIGGER_CLASS);
    faceElement?.classList.remove(JOURNEY_INTERIM_GLOW_PULSE_CLASS);
    burnElement?.classList.remove(JOURNEY_INTERIM_BURN_PULSE_CLASS);
    // Restart the one-shot CSS animations reliably on mobile Safari.
    void lightElement?.offsetHeight;
    void faceElement?.offsetHeight;
    void burnElement?.offsetHeight;
    faceElement?.style.setProperty('--cc-journey-interim-glow-duration', `${boundedPulseDurationMs}ms`);
    burnElement?.style.setProperty('--cc-journey-interim-glow-duration', `${boundedPulseDurationMs}ms`);
    scheduleFrame(() => {
      if (!shouldRun()) return;
      lightElement?.classList.add(JOURNEY_INTERIM_SHINE_TRIGGER_CLASS);
      scheduleTimeout(() => {
        if (!shouldRun()) return;
        faceElement?.classList.add(JOURNEY_INTERIM_GLOW_PULSE_CLASS);
        burnElement?.classList.add(JOURNEY_INTERIM_BURN_PULSE_CLASS);
        try { onPulse?.(); } catch {}
        if (faceElement) {
          try { gsap.killTweensOf(faceElement); } catch {}
          trackTimeline(gsap.timeline())
            .set(faceElement, { transformOrigin: '50% 50%', force3D: true })
            .to(faceElement, {
              scale: baseScale * JOURNEY_INTERIM_CARD_SHINE_PROFILE.bounceScaleMultiplier,
              duration: JOURNEY_INTERIM_CARD_SHINE_PROFILE.bounceUpDurationSeconds,
              ease: 'back.out(2)',
            })
            .to(faceElement, {
              scale: baseScale,
              duration: JOURNEY_INTERIM_CARD_SHINE_PROFILE.bounceDownDurationSeconds,
              ease: 'sine.out',
            });
        }
      }, JOURNEY_INTERIM_CARD_SHINE_PROFILE.bounceDelayMs);
      const cleanupDelayMs = Math.max(
        lightElement ? JOURNEY_INTERIM_CARD_SHINE_PROFILE.sweepDurationMs : 0,
        faceElement
          ? JOURNEY_INTERIM_CARD_SHINE_PROFILE.bounceDelayMs
            + boundedPulseDurationMs
          : 0,
        burnElement
          ? JOURNEY_INTERIM_CARD_SHINE_PROFILE.bounceDelayMs
            + boundedPulseDurationMs
          : 0,
      );
      scheduleTimeout(() => {
        lightElement?.classList.remove(JOURNEY_INTERIM_SHINE_TRIGGER_CLASS);
        faceElement?.classList.remove(JOURNEY_INTERIM_GLOW_PULSE_CLASS);
        burnElement?.classList.remove(JOURNEY_INTERIM_BURN_PULSE_CLASS);
      }, cleanupDelayMs);
    });
  } catch {}
}

/**
 * Own a bounded repeating shine session. All timers/RAFs/tweens are released by
 * pause/stop, and resume never creates a second concurrent loop.
 */
export function createJourneyInterimShineLoop({
  lightElement,
  faceElement,
  burnElement = null,
  pulseDurationMs = JOURNEY_INTERIM_CARD_SHINE_PROFILE.glowPulseDurationMs,
  baseScale = 1,
  shouldRun = () => true,
  onPulse,
  initialDelayMs = 0,
  cadenceMs = JOURNEY_INTERIM_CARD_SHINE_PROFILE.cadenceMs,
}: JourneyInterimShineLoopOptions): JourneyInterimShineLoopController {
  const boundedInitialDelayMs = Math.max(0, initialDelayMs);
  const boundedCadenceMs = Math.max(250, cadenceMs);
  let state: 'stopped' | 'running' | 'paused' = 'stopped';
  let cadenceTimeoutId: number | null = null;
  let nextPulseAt = 0;
  let remainingCadenceMs = boundedInitialDelayMs;
  const timeoutIds = new Set<number>();
  const frameIds = new Set<number>();
  const timelines = new Set<gsap.core.Timeline>();

  const clearPulseWork = (restoreScale: boolean): void => {
    timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIds.clear();
    frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
    frameIds.clear();
    timelines.forEach((timeline) => {
      try { timeline.kill(); } catch {}
    });
    timelines.clear();
    try { gsap.killTweensOf(faceElement); } catch {}
    lightElement?.classList.remove(JOURNEY_INTERIM_SHINE_TRIGGER_CLASS);
    faceElement?.classList.remove(JOURNEY_INTERIM_GLOW_PULSE_CLASS);
    burnElement?.classList.remove(JOURNEY_INTERIM_BURN_PULSE_CLASS);
    if (restoreScale && faceElement) {
      try { gsap.set(faceElement, { scale: baseScale }); } catch {}
    }
  };

  const clearCadenceTimer = (): void => {
    if (cadenceTimeoutId === null) return;
    window.clearTimeout(cadenceTimeoutId);
    cadenceTimeoutId = null;
  };

  const scheduleTimeout = (callback: () => void, delayMs: number): number => {
    const timeoutId = window.setTimeout(() => {
      timeoutIds.delete(timeoutId);
      if (state === 'running') callback();
    }, delayMs);
    timeoutIds.add(timeoutId);
    return timeoutId;
  };

  const scheduleFrame = (callback: () => void): number => {
    const frameId = window.requestAnimationFrame(() => {
      frameIds.delete(frameId);
      if (state === 'running') callback();
    });
    frameIds.add(frameId);
    return frameId;
  };

  const trackTimeline = (timeline: gsap.core.Timeline): gsap.core.Timeline => {
    timelines.add(timeline);
    timeline.eventCallback('onComplete', () => timelines.delete(timeline));
    timeline.eventCallback('onInterrupt', () => timelines.delete(timeline));
    return timeline;
  };

  const play = (): void => {
    if (state !== 'running' || !shouldRun()) return;
    triggerJourneyInterimShinePulse({
      lightElement,
      faceElement,
      burnElement,
      pulseDurationMs,
      baseScale,
      shouldRun: () => state === 'running' && shouldRun(),
      onPulse,
      scheduleTimeout,
      scheduleFrame,
      trackTimeline,
    });
  };

  const scheduleNextPulse = (delayMs: number): void => {
    clearCadenceTimer();
    const boundedDelayMs = Math.max(0, delayMs);
    remainingCadenceMs = boundedDelayMs;
    nextPulseAt = Date.now() + boundedDelayMs;
    cadenceTimeoutId = window.setTimeout(() => {
      cadenceTimeoutId = null;
      if (state !== 'running') return;
      play();
      scheduleNextPulse(boundedCadenceMs);
    }, boundedDelayMs);
  };

  const startLoop = (): void => {
    if (state === 'running') return;
    clearCadenceTimer();
    clearPulseWork(true);
    state = 'running';
    if (boundedInitialDelayMs > 0) scheduleNextPulse(boundedInitialDelayMs);
    else {
      play();
      scheduleNextPulse(boundedCadenceMs);
    }
  };

  return {
    start: startLoop,
    pause: () => {
      if (state !== 'running') return;
      remainingCadenceMs = cadenceTimeoutId === null
        ? boundedCadenceMs
        : Math.max(0, nextPulseAt - Date.now());
      state = 'paused';
      clearCadenceTimer();
      clearPulseWork(true);
    },
    resume: () => {
      if (state !== 'paused') return;
      state = 'running';
      scheduleNextPulse(remainingCadenceMs);
    },
    stop: () => {
      if (state === 'stopped' && cadenceTimeoutId === null && timeoutIds.size === 0 && frameIds.size === 0) return;
      state = 'stopped';
      clearCadenceTimer();
      clearPulseWork(true);
      remainingCadenceMs = boundedInitialDelayMs;
    },
    isRunning: () => state === 'running',
  };
}
