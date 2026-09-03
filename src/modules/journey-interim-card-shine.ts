import { gsap } from 'gsap';

/**
 * Canonical light profile for the hidden Journey reward card.
 *
 * The New Reward screen is the visual benchmark. Both that screen and the
 * interim card inside a Journey world consume this profile so their cadence
 * and pulse cannot drift independently again.
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

type JourneyInterimShineScheduler = {
  scheduleTimeout?: (callback: () => void, delayMs: number) => number;
  scheduleFrame?: (callback: () => void) => number;
};

export type JourneyInterimShinePulseOptions = JourneyInterimShineScheduler & {
  lightElement: HTMLElement | null;
  faceElement: HTMLElement | null;
  baseScale?: number;
  shouldRun?: () => boolean;
  onPulse?: () => void;
  trackTimeline?: (timeline: gsap.core.Timeline) => gsap.core.Timeline;
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
  baseScale = 1,
  shouldRun = () => true,
  onPulse,
  trackTimeline = (timeline) => timeline,
  scheduleTimeout = (callback, delayMs) => window.setTimeout(callback, delayMs),
  scheduleFrame = (callback) => window.requestAnimationFrame(callback),
}: JourneyInterimShinePulseOptions): void {
  if ((!lightElement && !faceElement) || !shouldRun()) return;

  try {
    lightElement?.classList.remove(JOURNEY_INTERIM_SHINE_TRIGGER_CLASS);
    faceElement?.classList.remove(JOURNEY_INTERIM_GLOW_PULSE_CLASS);
    // Restart the one-shot CSS animations reliably on mobile Safari.
    void lightElement?.offsetHeight;
    void faceElement?.offsetHeight;
    scheduleFrame(() => {
      if (!shouldRun()) return;
      lightElement?.classList.add(JOURNEY_INTERIM_SHINE_TRIGGER_CLASS);
      scheduleTimeout(() => {
        if (!shouldRun()) return;
        faceElement?.classList.add(JOURNEY_INTERIM_GLOW_PULSE_CLASS);
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
      scheduleTimeout(() => {
        lightElement?.classList.remove(JOURNEY_INTERIM_SHINE_TRIGGER_CLASS);
        faceElement?.classList.remove(JOURNEY_INTERIM_GLOW_PULSE_CLASS);
      }, JOURNEY_INTERIM_CARD_SHINE_PROFILE.sweepDurationMs);
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
  baseScale = 1,
  shouldRun = () => true,
  onPulse,
}: Omit<JourneyInterimShinePulseOptions, 'scheduleTimeout' | 'scheduleFrame' | 'trackTimeline'>): JourneyInterimShineLoopController {
  let state: 'stopped' | 'running' | 'paused' = 'stopped';
  let cadenceTimeoutId: number | null = null;
  let nextPulseAt = 0;
  let remainingCadenceMs: number = JOURNEY_INTERIM_CARD_SHINE_PROFILE.cadenceMs;
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
      scheduleNextPulse(JOURNEY_INTERIM_CARD_SHINE_PROFILE.cadenceMs);
    }, boundedDelayMs);
  };

  const startLoop = (): void => {
    if (state === 'running') return;
    clearCadenceTimer();
    clearPulseWork(true);
    state = 'running';
    play();
    scheduleNextPulse(JOURNEY_INTERIM_CARD_SHINE_PROFILE.cadenceMs);
  };

  return {
    start: startLoop,
    pause: () => {
      if (state !== 'running') return;
      remainingCadenceMs = cadenceTimeoutId === null
        ? JOURNEY_INTERIM_CARD_SHINE_PROFILE.cadenceMs
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
      remainingCadenceMs = JOURNEY_INTERIM_CARD_SHINE_PROFILE.cadenceMs;
    },
    isRunning: () => state === 'running',
  };
}
