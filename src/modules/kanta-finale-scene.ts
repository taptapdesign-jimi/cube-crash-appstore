// Dedicated Kanta merge-6 ejection scene with two authored Area 55 fighters.
// One RAF owns fighter flight, reverse-suction debris, the Kanta pile and cleanup.

import {
  createRoboAirCombatVariation,
  sampleRoboAirCombatSway,
  type RoboAirCombatSwaySample,
  type RoboTravelDirection,
} from './board-transition-robo-variation.js';
import { getSpaceshipMagneticPullProgress } from './spaceship-finale-scene.js';

const use2x = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export const KANTA_FINALE_SCENE_SECONDS = 3.36;
export const KANTA_FINALE_FIGHTER_SOURCE = `./assets/journey assets/robo/ship1${use2x ? '@2x' : ''}.png`;
export const KANTA_FINALE_FIGHTER_COUNT = 2;
export const KANTA_FINALE_RIGHT_FIGHTER_DELAY_SECONDS = 0.2;
export const KANTA_FINALE_EJECTED_CAN_COUNT = 8;
export const KANTA_FINALE_EJECT_START_SECONDS = 0.62;
export const KANTA_FINALE_EJECT_STAGGER_SECONDS = 0.19;
export const KANTA_FINALE_EJECT_TRAVEL_SECONDS = 1.02;
export const KANTA_FINALE_EJECTED_CAN_SOURCE = './assets/shop/kanta/01.png';
export const KANTA_FINALE_LANDED_CAN_SCALE = 2;
export const KANTA_FINALE_DEBRIS_COUNT = 7;
export const KANTA_FINALE_DEBRIS_SOURCES = Array.from(
  { length: KANTA_FINALE_DEBRIS_COUNT },
  (_, index) => `./assets/shop/spaceship/rock${index + 1}${use2x ? '@2x' : ''}.png`,
);

type KantaFinaleCleanup = (() => void) & {
  startExit?: () => void;
  completionDelaySeconds?: number;
};

let preloadPromise: Promise<void> | null = null;

export function preloadKantaFinaleAssets(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  if (typeof Image === 'undefined') return Promise.resolve();
  const sources = [
    KANTA_FINALE_FIGHTER_SOURCE,
    KANTA_FINALE_EJECTED_CAN_SOURCE,
    ...KANTA_FINALE_DEBRIS_SOURCES,
  ];
  preloadPromise = Promise.all(sources.map((src) => new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  }))).then(() => undefined);
  return preloadPromise;
}

export function getKantaEjectionProgress(linearProgress: number): number {
  const progress = Math.max(0, Math.min(1, linearProgress));
  return 1 - getSpaceshipMagneticPullProgress(1 - progress);
}

export function attachKantaFinaleScene(
  overlay: HTMLElement,
  zIndex = 2,
): KantaFinaleCleanup {
  if (!overlay) return (() => {}) as KantaFinaleCleanup;

  const field = document.createElement('div');
  field.className = 'cc-kanta-finale-scene';
  field.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:grid',
    'place-items:center',
    'overflow:hidden',
    'pointer-events:none',
    `z-index:${zIndex}`,
    'contain:layout style paint',
  ].join(';');

  type FighterRuntime = {
    element: HTMLImageElement;
    side: 'left' | 'right';
    delay: number;
    direction: RoboTravelDirection;
    phaseOffset: number;
    previousSway: RoboAirCombatSwaySample;
    x: number;
    y: number;
  };
  const createFighter = (side: 'left' | 'right'): FighterRuntime => {
    const fighter = document.createElement('img');
    fighter.className = `cc-kanta-finale-fighter cc-kanta-finale-fighter--${side}`;
    fighter.dataset.kantaFinaleFighter = side;
    fighter.alt = '';
    fighter.setAttribute('aria-hidden', 'true');
    fighter.draggable = false;
    fighter.src = KANTA_FINALE_FIGHTER_SOURCE;
    fighter.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:50%',
      `width:${side === 'left' ? 90 : 108}px`,
      'height:auto',
      'opacity:0',
      'pointer-events:none',
      'user-select:none',
      '-webkit-user-drag:none',
      'transform-origin:50% 50%',
      'will-change:transform',
      'filter:drop-shadow(0 5px 8px rgba(45, 75, 83, 0.24))',
    ].join(';');
    field.appendChild(fighter);
    return {
      element: fighter,
      side,
      delay: side === 'left' ? 0 : KANTA_FINALE_RIGHT_FIGHTER_DELAY_SECONDS,
      direction: side === 'left' ? 1 : -1,
      phaseOffset: Math.random() * Math.PI * 2 - Math.PI,
      previousSway: { x: 0, y: 0, bank: 0 },
      x: 0,
      y: 0,
    };
  };
  const fighters = [createFighter('left'), createFighter('right')];
  const fighterVariation = createRoboAirCombatVariation();
  const viewportWidth = Math.max(320, window.innerWidth || 390);
  const viewportHeight = Math.max(520, window.innerHeight || 844);

  const paintFighter = (runtime: FighterRuntime, elapsedSeconds: number) => {
    const localElapsed = elapsedSeconds - runtime.delay;
    if (localElapsed < 0) return;
    const flightDuration = Math.max(0.1, KANTA_FINALE_SCENE_SECONDS - runtime.delay);
    const progress = Math.max(0, Math.min(1, localElapsed / flightDuration));
    const smoothProgress = progress * progress * (3 - 2 * progress);
    const direction = runtime.direction;
    const startX = direction * -(viewportWidth * 0.72 + 120);
    const endX = direction * (viewportWidth * 0.72 + 120);
    const crossingX = Math.sin(progress * Math.PI * 2) * viewportWidth * 0.16 * direction;
    const baseY = runtime.side === 'left' ? -viewportHeight * 0.16 : viewportHeight * 0.11;
    const crossingY = Math.sin(progress * Math.PI * 2 + (runtime.side === 'left' ? 0 : Math.PI))
      * viewportHeight * 0.13;
    const sway = sampleRoboAirCombatSway(
      progress,
      runtime.phaseOffset,
      direction,
      fighterVariation.actionSwayX,
      fighterVariation.actionSwayY,
      fighterVariation.actionSwayCycles,
      runtime.previousSway,
    );
    const baseScale = runtime.side === 'left' ? 1.15 : 1.15 * 1.4;
    const depthScale = 1 + Math.sin(progress * Math.PI) * (runtime.side === 'left' ? 0.48 : 0.40);
    const x = startX + (endX - startX) * smoothProgress + crossingX + sway.x;
    const y = baseY + crossingY + sway.y;
    runtime.x = x;
    runtime.y = y;
    const bank = Math.max(-15, Math.min(15,
      Math.sin(localElapsed * 5.2 + runtime.phaseOffset) * 8 + sway.bank,
    ));
    const leftIsInFront = progress >= 0.5;
    runtime.element.style.zIndex = String(
      (runtime.side === 'left') === leftIsInFront ? 3 : 1,
    );
    runtime.element.style.opacity = '1';
    runtime.element.style.transform = [
      'translate(-50%, -50%)',
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`,
      `rotate(${bank.toFixed(2)}deg)`,
      `scale(${(baseScale * depthScale).toFixed(4)})`,
    ].join(' ');
  };

  type EjectedItemRuntime = {
    element: HTMLImageElement;
    fighter: FighterRuntime;
    delay: number;
    destinationX: number;
    destinationY: number;
    startX: number;
    startY: number;
    launched: boolean;
    rotationDirection: number;
    landedRotation: number;
    landedScale: number;
  };
  const pileSlots = [
    { x: -0.13, rise: 0, rotation: -18 },
    { x: 0.13, rise: 0, rotation: 17 },
    { x: -0.09, rise: 24, rotation: 14 },
    { x: 0.09, rise: 25, rotation: -15 },
    { x: -0.055, rise: 50, rotation: -12 },
    { x: 0.055, rise: 51, rotation: 13 },
    { x: -0.025, rise: 77, rotation: 10 },
    { x: 0.025, rise: 88, rotation: -9 },
  ] as const;
  const ejectedCans: EjectedItemRuntime[] = Array.from(
    { length: KANTA_FINALE_EJECTED_CAN_COUNT },
    (_, index) => {
      const can = document.createElement('img');
      const size = 44 + (index % 3) * 6;
      const slot = pileSlots[index];
      can.className = 'cc-kanta-finale-ejected-can';
      can.dataset.kantaFinaleEjectedCan = String(index);
      can.alt = '';
      can.setAttribute('aria-hidden', 'true');
      can.draggable = false;
      can.src = KANTA_FINALE_EJECTED_CAN_SOURCE;
      can.style.cssText = [
        'position:absolute',
        'left:50%',
        'top:50%',
        `width:${size}px`,
        'height:auto',
        'opacity:0',
        'z-index:4',
        'pointer-events:none',
        'user-select:none',
        '-webkit-user-drag:none',
        'transform-origin:50% 100%',
        'will-change:transform,opacity',
      ].join(';');
      field.appendChild(can);
      return {
        element: can,
        fighter: fighters[index % fighters.length],
        delay: KANTA_FINALE_EJECT_START_SECONDS + index * KANTA_FINALE_EJECT_STAGGER_SECONDS,
        destinationX: viewportWidth * slot.x,
        destinationY: viewportHeight * 0.5 - size - 4 - slot.rise,
        startX: 0,
        startY: 0,
        launched: false,
        rotationDirection: index % 2 === 0 ? 1 : -1,
        landedRotation: slot.rotation,
        landedScale: KANTA_FINALE_LANDED_CAN_SCALE,
      };
    },
  );
  const ejectedDebris: EjectedItemRuntime[] = KANTA_FINALE_DEBRIS_SOURCES.map((source, index) => {
    const rock = document.createElement('img');
    const size = 30 + (index % 3) * 7;
    rock.className = 'cc-kanta-finale-ejected-debris';
    rock.dataset.kantaFinaleEjectedDebris = String(index);
    rock.alt = '';
    rock.setAttribute('aria-hidden', 'true');
    rock.draggable = false;
    rock.src = source;
    rock.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:50%',
      `width:${size}px`,
      'height:auto',
      'opacity:0',
      'z-index:3',
      'pointer-events:none',
      'user-select:none',
      '-webkit-user-drag:none',
      'transform-origin:50% 50%',
      'will-change:transform,opacity',
    ].join(';');
    field.appendChild(rock);
    const side = index % 2 === 0 ? -1 : 1;
    return {
      element: rock,
      fighter: fighters[index % fighters.length],
      delay: KANTA_FINALE_EJECT_START_SECONDS + 0.08
        + index * KANTA_FINALE_EJECT_STAGGER_SECONDS,
      destinationX: side * viewportWidth * (0.18 + (index % 3) * 0.075),
      destinationY: viewportHeight * 0.5 - size * 0.5 - 3 - (index % 2) * 10,
      startX: 0,
      startY: 0,
      launched: false,
      rotationDirection: side,
      landedRotation: side * (18 + (index % 3) * 13),
      landedScale: 0.82 + (index % 3) * 0.12,
    };
  });
  const ejectedItems = [...ejectedDebris, ...ejectedCans];

  const cubicBezier = (
    start: number,
    control1: number,
    control2: number,
    end: number,
    progress: number,
  ) => {
    const inverse = 1 - progress;
    return inverse ** 3 * start
      + 3 * inverse ** 2 * progress * control1
      + 3 * inverse * progress ** 2 * control2
      + progress ** 3 * end;
  };

  const paintEjectedItem = (runtime: EjectedItemRuntime, elapsedSeconds: number) => {
    const localElapsed = elapsedSeconds - runtime.delay;
    if (localElapsed < 0) return;
    if (!runtime.launched) {
      runtime.launched = true;
      runtime.startX = runtime.fighter.x;
      runtime.startY = runtime.fighter.y + 18;
      runtime.element.style.opacity = '1';
    }
    const linearProgress = Math.max(0, Math.min(1, localElapsed / KANTA_FINALE_EJECT_TRAVEL_SECONDS));
    // Time-reversing the Spaceship suction curve gives the ejection a strong
    // launch followed by a readable settle at the bottom of the viewport.
    const progress = getKantaEjectionProgress(linearProgress);
    const arcDirection = runtime.destinationX >= runtime.startX ? 1 : -1;
    const control1X = runtime.startX + arcDirection * viewportWidth * 0.12;
    const control2X = runtime.destinationX - arcDirection * viewportWidth * 0.10;
    const control1Y = runtime.startY + viewportHeight * 0.06;
    const control2Y = runtime.destinationY - viewportHeight * 0.24;
    const x = cubicBezier(runtime.startX, control1X, control2X, runtime.destinationX, progress);
    const y = cubicBezier(runtime.startY, control1Y, control2Y, runtime.destinationY, progress);
    const wobbleEnvelope = Math.sin(progress * Math.PI);
    const wobble = Math.sin(linearProgress * Math.PI * 5) * wobbleEnvelope;
    const flightScale = 0.28 + progress * 0.72;
    const landingProgress = Math.max(0, Math.min(1, (linearProgress - 0.82) / 0.18));
    const landingEase = landingProgress * landingProgress * (3 - 2 * landingProgress);
    const scale = flightScale + (runtime.landedScale - 1) * landingEase;
    const airborneRotation = runtime.rotationDirection * (70 * (1 - progress) + wobble * 18);
    const rotation = airborneRotation + (runtime.landedRotation - airborneRotation) * landingEase;
    runtime.element.style.transform = [
      'translate(-50%, -50%)',
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`,
      `rotate(${rotation.toFixed(2)}deg)`,
      `scale(${scale.toFixed(4)})`,
    ].join(' ');
  };
  overlay.appendChild(field);

  void preloadKantaFinaleAssets();

  let disposed = false;
  let animationFrameId = 0;
  const startedAt = performance.now();

  const paint = (now: number) => {
    if (disposed) return;
    const elapsedSeconds = Math.max(0, (now - startedAt) / 1000);
    fighters.forEach((fighter) => paintFighter(fighter, elapsedSeconds));
    ejectedItems.forEach((item) => paintEjectedItem(item, elapsedSeconds));
    if (elapsedSeconds < KANTA_FINALE_SCENE_SECONDS) {
      animationFrameId = window.requestAnimationFrame(paint);
    }
  };
  animationFrameId = window.requestAnimationFrame(paint);

  const cleanup = (() => {
    if (disposed) return;
    disposed = true;
    if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
    field.remove();
  }) as KantaFinaleCleanup;
  // The ejection scene owns its complete landing; shared callers may request
  // exit earlier, but must not truncate the pile before its final settle.
  cleanup.startExit = () => {};
  cleanup.completionDelaySeconds = KANTA_FINALE_SCENE_SECONDS;
  return cleanup;
}
