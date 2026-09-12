export interface JourneyV700MotionProfile {
  enter: {
    baseDelay: number;
    duration: number;
    ease: string;
    scale: number;
    y: number;
    groupStagger: number;
  };
  exit: {
    duration: number;
    ease: string;
    scale: number;
    y: number;
    groupStagger: number;
    anticipationScale: number;
    anticipationDuration: number;
  };
  cascadeWindow: number;
}

export const JOURNEY_V700_UNIT_CARD_EXIT_DURATION = 0.4;
export const JOURNEY_V700_UNIT_CARD_EXIT_EASE = 'back.in(1.7)';

/**
 * Canonical "Cartoon Bounce Enter" requested for an accepted Journey World
 * activation: one fast asymmetric inflate that flows directly into the
 * selected World's scale-to-zero exit, with no neutral frame or dwell.
 */
export const JOURNEY_WORLD_CARTOON_BOUNCE_ENTER = Object.freeze({
  transformOrigin: '50% 54%',
  scaleX: 1.18,
  scaleY: 1.15,
  bounceDurationSeconds: 0.15,
  bounceEase: 'power2.in',
  exitDurationSeconds: 0.28,
  exitEase: 'back.in(1.7)',
});

/** Back-to-Homepage Worlds overlap heavily but never start on the same frame. */
export const JOURNEY_V700_HUB_BACK_EXIT_STAGGER_SECONDS = 0.045;
/**
 * Hub World cards used to finish their two-leg exit faster than the accepted
 * individual-World X -> Hub transition. Lengthen only those Hub-owned legs;
 * the shared preset stays unchanged because Homepage derives its own bounce
 * timing from that baseline.
 */
export const JOURNEY_V700_HUB_WORLD_EXIT_DURATION_SCALE = 1.2;
// The large World main artwork was already 1.2x the reusable bounce preset.
// The accepted follow-up slows that isolated timeline by another 30%.
export const JOURNEY_V700_WORLD_MAIN_EXIT_DURATION_SCALE = 1.56;

export function getJourneyV700HubWorldExitDuration(
  durationSeconds: number,
  reducedMotion: boolean,
): number {
  return reducedMotion
    ? durationSeconds
    : durationSeconds * JOURNEY_V700_HUB_WORLD_EXIT_DURATION_SCALE;
}

export function getJourneyV700WorldMainExitDuration(durationSeconds: number): number {
  return durationSeconds * JOURNEY_V700_WORLD_MAIN_EXIT_DURATION_SCALE;
}

export const JOURNEY_V700_HUB_STANDARD_EXIT_BOUNCE_STRENGTH = 0.8;
export const JOURNEY_V700_HUB_STANDARD_EXIT_BOUNCE_SCALE = Object.freeze({
  scaleX: 1 + (
    (JOURNEY_WORLD_CARTOON_BOUNCE_ENTER.scaleX - 1)
    * JOURNEY_V700_HUB_STANDARD_EXIT_BOUNCE_STRENGTH
  ),
  scaleY: 1 + (
    (JOURNEY_WORLD_CARTOON_BOUNCE_ENTER.scaleY - 1)
    * JOURNEY_V700_HUB_STANDARD_EXIT_BOUNCE_STRENGTH
  ),
});

const getBoundedRandomSample = (random: () => number): number => {
  const sample = random();
  return Number.isFinite(sample)
    ? Math.max(0, Math.min(0.999999999, sample))
    : 0;
};

/** Shuffle once per Back activation without mutating the live DOM-order array. */
export function getJourneyV700HubBackExitOrder<T>(
  items: readonly T[],
  random: () => number = Math.random,
): T[] {
  const shuffled = items.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const boundedSample = getBoundedRandomSample(random);
    const swapIndex = Math.floor(boundedSample * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

const DEFAULT_PROFILE: JourneyV700MotionProfile = {
  enter: {
    baseDelay: 0.08,
    duration: 0.56,
    ease: 'back.out(1.8)',
    scale: 0.65,
    y: 30,
    groupStagger: 0.065,
  },
  exit: {
    duration: 0.48,
    ease: 'back.in(1.25)',
    scale: 0.65,
    y: 28,
    groupStagger: 0.065,
    anticipationScale: 1.06,
    anticipationDuration: 0.12,
  },
  cascadeWindow: 0.13,
};

const REDUCED_PROFILE: JourneyV700MotionProfile = {
  enter: {
    baseDelay: 0,
    duration: 0.2,
    ease: 'power1.out',
    scale: 0.96,
    y: 8,
    groupStagger: 0.012,
  },
  exit: {
    duration: 0.16,
    ease: 'power1.in',
    scale: 0.96,
    y: 8,
    groupStagger: 0.012,
    anticipationScale: 1,
    anticipationDuration: 0,
  },
  cascadeWindow: 0.06,
};

export function getJourneyV700MotionProfile(reducedMotion: boolean): JourneyV700MotionProfile {
  return reducedMotion ? REDUCED_PROFILE : DEFAULT_PROFILE;
}

/** Three Journey hub worlds enter top-to-bottom quickly, but with a clearly readable order. */
export function getJourneyV700HubEnterStagger(reducedMotion: boolean): number {
  return reducedMotion ? 0.02 : 0.09;
}

export function shouldIgnoreJourneyV700HubVisibleEnterRequest(state: {
  phase: 'hidden' | 'entering' | 'idle' | 'exiting';
  timelineActive: boolean;
  idleReady: boolean;
}): boolean {
  return (state.phase === 'entering' && state.timelineActive) ||
    (state.phase === 'idle' && state.idleReady);
}

export function shouldRestoreJourneyInterimWrapperForIdle(state: {
  opacity: number;
  scale: number;
  visibility: string;
}): boolean {
  return state.visibility === 'hidden' ||
    !Number.isFinite(state.opacity) ||
    state.opacity <= 0.01 ||
    (Number.isFinite(state.scale) && state.scale <= 0.05);
}

export function isJourneyInterimIdleOwnedByEnter(state: {
  activeEnter: boolean;
  pendingEnter: boolean;
  connectedPreparedTargets: number;
}): boolean {
  return state.activeEnter || state.pendingEnter || state.connectedPreparedTargets > 0;
}

export function getJourneyElasticPull(
  deltaFromEdge: number,
  edge: 'top' | 'bottom',
  damping = 0.34,
  maxPull = 72,
): number {
  const directionalDelta = edge === 'top'
    ? Math.max(0, deltaFromEdge)
    : Math.min(0, deltaFromEdge);
  return Math.max(-maxPull, Math.min(maxPull, directionalDelta * damping));
}

/** Journey Worlds hub always enters at the top; only individual worlds own auto-scroll. */
export function getJourneyHubEntryScrollTop(): 0 {
  return 0;
}

export function shouldCorrectJourneyHubAutomaticScroll(
  view: 'hub' | 'world',
  scrollTop: number,
): boolean {
  return view === 'hub' && Number.isFinite(scrollTop) && Math.abs(scrollTop) > 0.5;
}

export function getJourneyV700UnitStagger(groupCount: number, reducedMotion: boolean): number {
  const motion = getJourneyV700MotionProfile(reducedMotion);
  if (groupCount <= 1) return 0;
  return Math.min(0.03, motion.cascadeWindow / (groupCount - 1));
}

export function getJourneyV700EnterOffset(unitId: string, index: number, reducedMotion: boolean): number {
  if (index === 0 || unitId.includes('main')) return 0;
  if (reducedMotion) return Math.min(0.06, index * 0.006);

  let hash = 2166136261;
  for (let characterIndex = 0; characterIndex < unitId.length; characterIndex += 1) {
    hash ^= unitId.charCodeAt(characterIndex);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = (hash >>> 0) / 4294967295;
  return 0.035 + (normalized * 0.185);
}
