import {
  computeJourneyCardArcOffset,
  primeJourneyCardSpatialFlight,
  startJourneyCardSpatialFlight,
  type JourneyCardGeometry,
  type JourneyCardOriginLease,
  type JourneyCardSpatialFlightController,
} from './journey-card-portal-transition.js';
import {
  playJourneyCardEntryFlipSounds,
  preloadJourneyCardEntryFlipSounds,
  stopJourneyCardEntryFlipSounds,
} from './journey-card-entry-flip-sound.js';
import { JOURNEY_CARD_FLIP_ENTER_DURATION_MS } from './journey-card-overlay-modal.js';
import {
  amplifyJourneyCardReturnLandingScale,
  createJourneyInterimBounceVariant,
  JOURNEY_INTERIM_IDLE_MOTION,
  type JourneyInterimBounceVariant,
} from './journey-interim-idle-policy.js';

export const JOURNEY_CARD_RETURN_REMINDER_TRAVEL_RATIO = 0.3;
export const JOURNEY_CARD_RETURN_REMINDER_CYCLE_DURATION_MS = JOURNEY_CARD_FLIP_ENTER_DURATION_MS;
export const JOURNEY_CARD_RETURN_REMINDER_OUT_DURATION_MS = JOURNEY_CARD_RETURN_REMINDER_CYCLE_DURATION_MS / 2;
export const JOURNEY_CARD_RETURN_REMINDER_BACK_DURATION_MS = JOURNEY_CARD_RETURN_REMINDER_CYCLE_DURATION_MS / 2;
export const JOURNEY_CARD_RETURN_REMINDER_LAUNCH_IMPACT_DURATION_MS = 180;
const JOURNEY_CARD_RETURN_REMINDER_LANDING_ANTICIPATION_END_SECONDS =
  JOURNEY_INTERIM_IDLE_MOTION.anticipationDurationSeconds;
const JOURNEY_CARD_RETURN_REMINDER_LANDING_PEAK_END_SECONDS =
  JOURNEY_CARD_RETURN_REMINDER_LANDING_ANTICIPATION_END_SECONDS
  + JOURNEY_INTERIM_IDLE_MOTION.riseDurationSeconds;
const JOURNEY_CARD_RETURN_REMINDER_LANDING_LAND_END_SECONDS =
  JOURNEY_CARD_RETURN_REMINDER_LANDING_PEAK_END_SECONDS
  + JOURNEY_INTERIM_IDLE_MOTION.landDurationSeconds;
const JOURNEY_CARD_RETURN_REMINDER_LANDING_REBOUND_END_SECONDS =
  JOURNEY_CARD_RETURN_REMINDER_LANDING_LAND_END_SECONDS
  + JOURNEY_INTERIM_IDLE_MOTION.reboundDurationSeconds;
const JOURNEY_CARD_RETURN_REMINDER_LANDING_TOTAL_SECONDS =
  JOURNEY_CARD_RETURN_REMINDER_LANDING_REBOUND_END_SECONDS
  + JOURNEY_INTERIM_IDLE_MOTION.settleDurationSeconds;
export const JOURNEY_CARD_RETURN_REMINDER_LANDING_IMPACT_DURATION_MS = Math.round(
  JOURNEY_CARD_RETURN_REMINDER_LANDING_TOTAL_SECONDS * 1000,
);
export const JOURNEY_CARD_RETURN_REMINDER_LANDING_ANTICIPATION_PROGRESS =
  JOURNEY_CARD_RETURN_REMINDER_LANDING_ANTICIPATION_END_SECONDS
  / JOURNEY_CARD_RETURN_REMINDER_LANDING_TOTAL_SECONDS;
export const JOURNEY_CARD_RETURN_REMINDER_LANDING_PEAK_PROGRESS =
  JOURNEY_CARD_RETURN_REMINDER_LANDING_PEAK_END_SECONDS
  / JOURNEY_CARD_RETURN_REMINDER_LANDING_TOTAL_SECONDS;
export const JOURNEY_CARD_RETURN_REMINDER_LANDING_SMOKE_PROGRESS =
  JOURNEY_CARD_RETURN_REMINDER_LANDING_LAND_END_SECONDS
  / JOURNEY_CARD_RETURN_REMINDER_LANDING_TOTAL_SECONDS;
export const JOURNEY_CARD_RETURN_REMINDER_LANDING_REBOUND_PROGRESS =
  JOURNEY_CARD_RETURN_REMINDER_LANDING_REBOUND_END_SECONDS
  / JOURNEY_CARD_RETURN_REMINDER_LANDING_TOTAL_SECONDS;
export const JOURNEY_CARD_RETURN_REMINDER_BACK_ASSET = './assets/colelctibles/cardflip.png';
export const JOURNEY_CARD_RETURN_REMINDER_BACK_ASSET_2X = './assets/colelctibles/cardflip@22.png';

export type JourneyCardReturnReminderResult = 'complete' | 'cancelled' | 'target-lost';

export interface JourneyCardReturnReminderController {
  readonly element: HTMLElement;
  readonly result: Promise<JourneyCardReturnReminderResult>;
  dispose(): void;
}

export function getJourneyCardReturnReminderViewportOffset(
  reference: JourneyCardGeometry,
  live: JourneyCardGeometry,
): { x: number; y: number } {
  return {
    x: live.centerX - reference.centerX,
    y: live.centerY - reference.centerY,
  };
}

type JourneyCardSqueezePose = Readonly<{ scaleX: number; scaleY: number }>;
export type JourneyCardReturnReminderImpactPhase = 'launch' | 'landing';
export type JourneyCardReturnReminderImpactPose = Readonly<{
  scaleX: number;
  scaleY: number;
  y: number;
  rotationDeg: number;
}>;

type JourneyCardReturnReminderImpactEase =
  | 'smoothstep'
  | 'power2.in'
  | 'power2.out'
  | 'back.out(2.5)'
  | 'back.out(1.7)';
type JourneyCardReturnReminderImpactFrame = Readonly<{
  at: number;
  ease?: JourneyCardReturnReminderImpactEase;
} & JourneyCardReturnReminderImpactPose>;

const SQUEEZE_POSES = Object.freeze([
  { at: 0, scaleX: 1, scaleY: 1 },
  { at: 0.08, scaleX: 1.035, scaleY: 0.965 },
  { at: 0.22, scaleX: 0.96, scaleY: 1.105 },
  { at: 0.42, scaleX: 1, scaleY: 1 },
  { at: 0.58, scaleX: 1, scaleY: 1 },
  { at: 0.78, scaleX: 0.96, scaleY: 1.105 },
  { at: 0.92, scaleX: 1.075, scaleY: 0.94 },
  { at: 1, scaleX: 1, scaleY: 1 },
] as const);

let preloadPromise: Promise<void> | null = null;
let activeReminder: JourneyCardReturnReminderController | null = null;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
}

function backOut(value: number, overshoot: number): number {
  const progress = clamp01(value) - 1;
  return 1 + (overshoot + 1) * progress ** 3 + overshoot * progress ** 2;
}

function applyImpactEase(
  ease: JourneyCardReturnReminderImpactEase | undefined,
  value: number,
): number {
  const progress = clamp01(value);
  switch (ease) {
    // GSAP's Power2 family is cubic (Power1 is quadratic).
    case 'power2.in': return progress ** 3;
    case 'power2.out': return 1 - (1 - progress) ** 3;
    case 'back.out(2.5)': return backOut(progress, 2.5);
    case 'back.out(1.7)': return backOut(progress, 1.7);
    default: return smoothstep(progress);
  }
}

export function getJourneyCardReturnReminderSqueezePose(progress: number): JourneyCardSqueezePose {
  const boundedProgress = clamp01(progress);
  for (let index = 1; index < SQUEEZE_POSES.length; index += 1) {
    const end = SQUEEZE_POSES[index];
    if (boundedProgress > end.at) continue;
    const start = SQUEEZE_POSES[index - 1];
    const localProgress = smoothstep(
      (boundedProgress - start.at) / Math.max(0.0001, end.at - start.at),
    );
    return {
      scaleX: start.scaleX + (end.scaleX - start.scaleX) * localProgress,
      scaleY: start.scaleY + (end.scaleY - start.scaleY) * localProgress,
    };
  }
  return { scaleX: 1, scaleY: 1 };
}

/**
 * The reminder owns one uninterrupted full turn across its outbound and return
 * travel. At the apex the back face is exact, while angular velocity continues
 * in the same direction instead of reversing or dwelling there.
 */
export function getJourneyCardReturnReminderFlipAngle(progress: number): number {
  const turn = smoothstep(progress);
  return turn === 0 ? 0 : -360 * turn;
}

function interpolateImpactPose(
  frames: ReadonlyArray<JourneyCardReturnReminderImpactFrame>,
  progress: number,
): JourneyCardReturnReminderImpactPose {
  const boundedProgress = clamp01(progress);
  for (let index = 1; index < frames.length; index += 1) {
    const end = frames[index];
    if (boundedProgress > end.at) continue;
    const start = frames[index - 1];
    const localProgress = applyImpactEase(
      end.ease,
      (boundedProgress - start.at) / Math.max(0.0001, end.at - start.at),
    );
    return {
      scaleX: start.scaleX + (end.scaleX - start.scaleX) * localProgress,
      scaleY: start.scaleY + (end.scaleY - start.scaleY) * localProgress,
      y: start.y + (end.y - start.y) * localProgress,
      rotationDeg: start.rotationDeg + (end.rotationDeg - start.rotationDeg) * localProgress,
    };
  }
  return { scaleX: 1, scaleY: 1, y: 0, rotationDeg: 0 };
}

/**
 * Reuses the modal-card landing language on transform-isolated shells. The
 * landing owns the same five poses, timings and easing families as the modal
 * return, then finishes neutral so the spatial shell remains the sole owner of
 * the card's authored tilt.
 */
export function getJourneyCardReturnReminderImpactPose(
  phase: JourneyCardReturnReminderImpactPhase,
  progress: number,
  variant: JourneyInterimBounceVariant,
  tiltDirection: -1 | 1,
): JourneyCardReturnReminderImpactPose {
  const neutral = { scaleX: 1, scaleY: 1, y: 0, rotationDeg: 0 } as const;
  const anticipation = {
    scaleX: JOURNEY_INTERIM_IDLE_MOTION.anticipationScaleX,
    scaleY: JOURNEY_INTERIM_IDLE_MOTION.anticipationScaleY,
    y: 1.5,
    rotationDeg: 0,
  } as const;
  if (phase === 'launch') {
    return interpolateImpactPose([
      { at: 0, ...neutral },
      { at: 0.28, ...anticipation },
      {
        at: 0.68,
        scaleX: variant.peakScaleX,
        scaleY: variant.peakScaleY,
        y: -JOURNEY_INTERIM_IDLE_MOTION.liftPx * 0.72,
        rotationDeg: JOURNEY_INTERIM_IDLE_MOTION.tiltDegrees * tiltDirection * variant.tiltMultiplier,
      },
      { at: 1, ...neutral },
    ], progress);
  }
  return interpolateImpactPose([
    { at: 0, ...neutral },
    {
      at: JOURNEY_CARD_RETURN_REMINDER_LANDING_ANTICIPATION_PROGRESS,
      ease: 'power2.in',
      scaleX: amplifyJourneyCardReturnLandingScale(JOURNEY_INTERIM_IDLE_MOTION.anticipationScaleX),
      scaleY: amplifyJourneyCardReturnLandingScale(JOURNEY_INTERIM_IDLE_MOTION.anticipationScaleY),
      y: 1.5,
      rotationDeg: 0,
    },
    {
      at: JOURNEY_CARD_RETURN_REMINDER_LANDING_PEAK_PROGRESS,
      ease: 'back.out(2.5)',
      scaleX: amplifyJourneyCardReturnLandingScale(variant.peakScaleX),
      scaleY: amplifyJourneyCardReturnLandingScale(variant.peakScaleY),
      y: -JOURNEY_INTERIM_IDLE_MOTION.liftPx,
      rotationDeg: JOURNEY_INTERIM_IDLE_MOTION.tiltDegrees * tiltDirection * variant.tiltMultiplier,
    },
    {
      at: JOURNEY_CARD_RETURN_REMINDER_LANDING_SMOKE_PROGRESS,
      ease: 'power2.in',
      scaleX: amplifyJourneyCardReturnLandingScale(variant.landScaleX),
      scaleY: amplifyJourneyCardReturnLandingScale(variant.landScaleY),
      y: 1,
      rotationDeg: -JOURNEY_INTERIM_IDLE_MOTION.tiltDegrees * tiltDirection * variant.tiltMultiplier * 0.22,
    },
    {
      at: JOURNEY_CARD_RETURN_REMINDER_LANDING_REBOUND_PROGRESS,
      ease: 'power2.out',
      scaleX: amplifyJourneyCardReturnLandingScale(JOURNEY_INTERIM_IDLE_MOTION.reboundScaleX),
      scaleY: amplifyJourneyCardReturnLandingScale(JOURNEY_INTERIM_IDLE_MOTION.reboundScaleY),
      y: -2.5,
      rotationDeg: JOURNEY_INTERIM_IDLE_MOTION.tiltDegrees * tiltDirection * 0.12,
    },
    { at: 1, ease: 'back.out(1.7)', ...neutral },
  ], progress);
}

export function getJourneyCardReturnReminderMotionBase(
  origin: JourneyCardGeometry,
): JourneyCardGeometry {
  return { ...origin, rotationDeg: 0 };
}

export function getJourneyCardReturnReminderApex(
  origin: JourneyCardGeometry,
  aspectRatio: number,
  viewportWidth: number,
  viewportHeight: number,
): JourneyCardGeometry {
  const safeViewportWidth = Math.max(1, viewportWidth);
  const safeViewportHeight = Math.max(1, viewportHeight);
  const safeAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0
    ? aspectRatio
    : origin.width / Math.max(1, origin.height);
  const fullWidth = safeViewportHeight <= 700
    ? Math.max(1, Math.min(safeViewportWidth - 82, 330))
    : Math.max(1, Math.min(safeViewportWidth - 64, 390));
  const fullDestination: JourneyCardGeometry = {
    centerX: safeViewportWidth / 2,
    centerY: safeViewportHeight / 2,
    width: fullWidth,
    height: fullWidth / safeAspectRatio,
    rotationDeg: 0,
  };
  const interpolate = (from: number, to: number): number => (
    from + (to - from) * JOURNEY_CARD_RETURN_REMINDER_TRAVEL_RATIO
  );
  return {
    centerX: interpolate(origin.centerX, fullDestination.centerX),
    centerY: interpolate(origin.centerY, fullDestination.centerY),
    width: interpolate(origin.width, fullDestination.width),
    height: interpolate(origin.height, fullDestination.height),
    rotationDeg: interpolate(origin.rotationDeg, fullDestination.rotationDeg),
  };
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      resolve();
    };
    image.onload = () => {
      if (typeof image.decode === 'function') void image.decode().catch(() => undefined).then(finish);
      else finish();
    };
    image.onerror = finish;
    image.src = src;
    if (image.complete) image.onload?.(new Event('load'));
  });
}

export function preloadJourneyCardReturnReminderAssets(): Promise<void> {
  preloadJourneyCardEntryFlipSounds();
  if (preloadPromise) return preloadPromise;
  if (typeof Image === 'undefined') return Promise.resolve();
  preloadPromise = Promise.allSettled([
    preloadImage(JOURNEY_CARD_RETURN_REMINDER_BACK_ASSET),
    preloadImage(JOURNEY_CARD_RETURN_REMINDER_BACK_ASSET_2X),
  ]).then(() => undefined);
  return preloadPromise;
}

function waitForImageReady(image: HTMLImageElement): Promise<boolean> {
  if (image.complete) {
    if (image.naturalWidth < 1) return Promise.resolve(false);
    if (typeof image.decode !== 'function') return Promise.resolve(true);
    return image.decode().then(() => true).catch(() => image.naturalWidth > 0);
  }
  return new Promise((resolve) => {
    image.addEventListener('load', () => {
      if (typeof image.decode !== 'function') {
        resolve(true);
        return;
      }
      void image.decode().then(() => resolve(true)).catch(() => resolve(image.naturalWidth > 0));
    }, { once: true });
    image.addEventListener('error', () => resolve(false), { once: true });
  });
}

export function presentJourneyCardReturnReminder(options: {
  boardId: number;
  origin: JourneyCardOriginLease;
  onImpactSmoke?: (phase: JourneyCardReturnReminderImpactPhase) => void;
}): JourneyCardReturnReminderController {
  activeReminder?.dispose();

  const stage = document.createElement('div');
  stage.className = 'journey-card-return-reminder is-prepainting';
  stage.dataset.boardId = String(options.boardId);
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML = `
    <div class="journey-card-return-reminder-scroll-anchor">
      <div class="journey-card-return-reminder-motion">
        <div class="journey-card-return-reminder-impact">
          <div class="journey-card-return-reminder-squeeze">
            <div class="journey-card-return-reminder-rotor">
              <div class="journey-card-return-reminder-face journey-card-return-reminder-front">
                <div class="journey-card-return-reminder-front-host"></div>
              </div>
              <div class="journey-card-return-reminder-face journey-card-return-reminder-back">
                <img src="${JOURNEY_CARD_RETURN_REMINDER_BACK_ASSET}" srcset="${JOURNEY_CARD_RETURN_REMINDER_BACK_ASSET_2X} 2x" alt="" draggable="false">
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const scrollAnchor = stage.querySelector<HTMLElement>('.journey-card-return-reminder-scroll-anchor');
  const motion = stage.querySelector<HTMLElement>('.journey-card-return-reminder-motion');
  const impact = stage.querySelector<HTMLElement>('.journey-card-return-reminder-impact');
  const squeeze = stage.querySelector<HTMLElement>('.journey-card-return-reminder-squeeze');
  const rotor = stage.querySelector<HTMLElement>('.journey-card-return-reminder-rotor');
  const frontHost = stage.querySelector<HTMLElement>('.journey-card-return-reminder-front-host');
  const backImage = stage.querySelector<HTMLImageElement>('.journey-card-return-reminder-back img');
  if (!scrollAnchor || !motion || !impact || !squeeze || !rotor || !frontHost || !backImage) {
    stage.remove();
    options.origin.restoreNow();
    throw new Error('Journey card return reminder failed to create its required owners');
  }

  const origin = options.origin.origin;
  const landingTarget = options.origin.readLiveGeometry() ?? origin;
  const scrollReference = landingTarget;
  const motionBase = getJourneyCardReturnReminderMotionBase(origin);
  motion.style.left = `${origin.centerX - origin.width / 2}px`;
  motion.style.top = `${origin.centerY - origin.height / 2}px`;
  motion.style.width = `${origin.width}px`;
  motion.style.height = `${origin.height}px`;
  // The origin lease deliberately reports mounted only after its portal clone
  // is connected. Attach the stage first so this safety check reflects the
  // real document state instead of rejecting every valid reminder.
  document.body.appendChild(stage);
  options.origin.mountInto(frontHost);
  if (!options.origin.isMounted) {
    stage.remove();
    options.origin.restoreNow();
    throw new Error('Journey card return reminder could not mount the live-card portal');
  }

  let resolveResult!: (result: JourneyCardReturnReminderResult) => void;
  const result = new Promise<JourneyCardReturnReminderResult>((resolve) => {
    resolveResult = resolve;
  });
  let settled = false;
  let flight: JourneyCardSpatialFlightController | null = null;
  let paintRaf = 0;
  let resolvePaint: ((painted: boolean) => void) | null = null;
  let impactRaf = 0;
  let resolveImpact: ((completed: boolean) => void) | null = null;
  let scrollFollowRaf = 0;

  const followLiveUnit = () => {
    scrollFollowRaf = 0;
    if (settled) return;
    const liveTarget = options.origin.readLiveGeometry();
    if (!liveTarget) {
      cleanup('target-lost', false);
      return;
    }
    const offset = getJourneyCardReturnReminderViewportOffset(scrollReference, liveTarget);
    scrollAnchor.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
    scrollFollowRaf = requestAnimationFrame(followLiveUnit);
  };

  const setRotorAngle = (angle: number) => {
    rotor.style.transform = `rotateY(${angle}deg)`;
  };
  const setSqueezePose = (progress: number) => {
    const pose = getJourneyCardReturnReminderSqueezePose(progress);
    squeeze.style.transform = `scale(${pose.scaleX}, ${pose.scaleY})`;
  };
  const setImpactPose = (pose: JourneyCardReturnReminderImpactPose) => {
    impact.style.transform = `translate3d(0, ${pose.y}px, 0) rotate(${pose.rotationDeg}deg)`;
    squeeze.style.transform = `scale(${pose.scaleX}, ${pose.scaleY})`;
  };
  const runImpact = (
    phase: JourneyCardReturnReminderImpactPhase,
    variant: JourneyInterimBounceVariant,
    tiltDirection: -1 | 1,
  ): Promise<boolean> => new Promise((resolve) => {
    const durationMs = phase === 'launch'
      ? JOURNEY_CARD_RETURN_REMINDER_LAUNCH_IMPACT_DURATION_MS
      : JOURNEY_CARD_RETURN_REMINDER_LANDING_IMPACT_DURATION_MS;
    const smokeAt = phase === 'launch'
      ? 0.68
      : JOURNEY_CARD_RETURN_REMINDER_LANDING_SMOKE_PROGRESS;
    const startedAt = performance.now();
    let smokeTriggered = false;
    resolveImpact = resolve;
    const render = (now: number) => {
      impactRaf = 0;
      if (settled) {
        resolveImpact = null;
        resolve(false);
        return;
      }
      const progress = clamp01((now - startedAt) / Math.max(1, durationMs));
      setImpactPose(getJourneyCardReturnReminderImpactPose(
        phase,
        progress,
        variant,
        tiltDirection,
      ));
      if (!smokeTriggered && progress >= smokeAt) {
        smokeTriggered = true;
        try { options.onImpactSmoke?.(phase); } catch {}
      }
      if (progress >= 1) {
        resolveImpact = null;
        setImpactPose({ scaleX: 1, scaleY: 1, y: 0, rotationDeg: 0 });
        resolve(true);
        return;
      }
      impactRaf = requestAnimationFrame(render);
    };
    render(startedAt);
  });
  const waitForPaints = (count: number): Promise<boolean> => new Promise((resolve) => {
    let remaining = Math.max(1, count);
    resolvePaint = resolve;
    const paint = () => {
      paintRaf = 0;
      if (settled) {
        resolvePaint = null;
        resolve(false);
        return;
      }
      remaining -= 1;
      if (remaining <= 0) {
        resolvePaint = null;
        resolve(true);
        return;
      }
      paintRaf = requestAnimationFrame(paint);
    };
    paintRaf = requestAnimationFrame(paint);
  });

  const cleanup = (outcome: JourneyCardReturnReminderResult, preserveHandoff: boolean) => {
    if (settled) return;
    settled = true;
    flight?.cancel();
    flight = null;
    if (paintRaf) cancelAnimationFrame(paintRaf);
    paintRaf = 0;
    resolvePaint?.(false);
    resolvePaint = null;
    if (impactRaf) cancelAnimationFrame(impactRaf);
    impactRaf = 0;
    resolveImpact?.(false);
    resolveImpact = null;
    if (scrollFollowRaf) cancelAnimationFrame(scrollFollowRaf);
    scrollFollowRaf = 0;
    stopJourneyCardEntryFlipSounds();
    window.removeEventListener('cc-navigation', handleRouteChange);
    window.removeEventListener('pagehide', handleRouteChange);
    options.origin.restoreNow();
    const retire = () => {
      stage.remove();
      if (activeReminder === controller) activeReminder = null;
      resolveResult(outcome);
    };
    if (!preserveHandoff) {
      retire();
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(retire));
  };

  function handleRouteChange(): void {
    cleanup('cancelled', false);
  }

  const controller: JourneyCardReturnReminderController = {
    element: stage,
    result,
    dispose() {
      cleanup('cancelled', false);
    },
  };
  activeReminder = controller;
  window.addEventListener('cc-navigation', handleRouteChange);
  window.addEventListener('pagehide', handleRouteChange);
  followLiveUnit();

  const run = async () => {
    await preloadJourneyCardReturnReminderAssets();
    if (settled || !(await waitForImageReady(backImage))) {
      if (!settled) cleanup('target-lost', false);
      return;
    }

    const apex = getJourneyCardReturnReminderApex(
      origin,
      options.origin.aspectRatio,
      window.innerWidth,
      window.innerHeight,
    );
    primeJourneyCardSpatialFlight(
      motion,
      motionBase,
      origin,
      apex,
      { left: origin.centerX - origin.width / 2, top: origin.centerY - origin.height / 2 },
    );
    setRotorAngle(0);
    if (!(await waitForPaints(1))) return;
    setRotorAngle(-180);
    if (!(await waitForPaints(1))) return;
    setRotorAngle(0);
    if (!(await waitForPaints(1))) return;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) {
      options.origin.activatePortal();
      stage.classList.remove('is-prepainting');
      stage.classList.add('is-visible');
      cleanup('complete', true);
      return;
    }

    options.origin.activatePortal();
    stage.classList.remove('is-prepainting');
    stage.classList.add('is-visible');
    const impactVariant = createJourneyInterimBounceVariant();
    const tiltDirection: -1 | 1 = origin.rotationDeg === 0
      ? (origin.centerX < window.innerWidth / 2 ? -1 : 1)
      : (origin.rotationDeg < 0 ? -1 : 1);
    if (!(await runImpact('launch', impactVariant, tiltDirection))) return;
    stage.classList.add('is-turning');
    playJourneyCardEntryFlipSounds();
    flight = startJourneyCardSpatialFlight({
      motionElement: motion,
      baseGeometry: motionBase,
      from: origin,
      readTarget: () => apex,
      direction: 'enter',
      durationMs: JOURNEY_CARD_RETURN_REMINDER_OUT_DURATION_MS,
      spatialProgress: smoothstep,
      pathOffset: computeJourneyCardArcOffset,
      onProgress: (progress) => {
        setRotorAngle(getJourneyCardReturnReminderFlipAngle(progress * 0.5));
        setSqueezePose(progress * 0.5);
      },
      transformOriginPrimed: true,
    });
    const outboundResult = await flight.result;
    flight = null;
    if (settled) return;
    if (outboundResult !== 'complete') {
      cleanup(outboundResult, false);
      return;
    }

    setRotorAngle(-180);
    flight = startJourneyCardSpatialFlight({
      motionElement: motion,
      baseGeometry: motionBase,
      from: apex,
      // The outer scroll owner translates the complete flight by the live
      // Unit delta. Keeping this inner target at its captured landing geometry
      // avoids applying that scroll movement twice during the return leg.
      readTarget: () => landingTarget,
      direction: 'return',
      durationMs: JOURNEY_CARD_RETURN_REMINDER_BACK_DURATION_MS,
      spatialProgress: smoothstep,
      pathOffset: (_from, _to, progress) => computeJourneyCardArcOffset(origin, apex, 1 - progress),
      onProgress: (progress) => {
        setRotorAngle(getJourneyCardReturnReminderFlipAngle(0.5 + progress * 0.5));
        setSqueezePose(0.5 + progress * 0.5);
      },
      transformOriginPrimed: true,
    });
    const returnResult = await flight.result;
    flight = null;
    if (settled) return;
    if (returnResult !== 'complete') {
      cleanup(returnResult, false);
      return;
    }

    setRotorAngle(-360);
    setSqueezePose(1);
    stage.classList.remove('is-turning');
    if (!(await runImpact('landing', impactVariant, tiltDirection))) return;
    cleanup('complete', true);
  };
  void run();

  return controller;
}
