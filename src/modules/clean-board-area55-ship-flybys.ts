import { CLEAN_BOARD_CONFETTI_MAX_RUNTIME_MS } from './confetti-system.js';

const AREA55_SHIP_ASSET = './assets/journey assets/robo/ship1@2x.png';
const SHIP_CLASS = 'cc-clean-board-area55-ship';
const OFFSCREEN_MARGIN_PX = 112;
const FLIGHT_SAMPLES_PER_SECOND = 30;
const ENTER_END = 0.16;
const EXIT_START = 0.85;
export const CLEAN_BOARD_AREA55_SHIP_MAX_WOBBLE_PX = 60;
const MIN_WOBBLE_PX = 30;

type ShipDepth = 'behind' | 'front';
type ViewportEdge = 'top' | 'right' | 'bottom' | 'left';
type FlightCorridor = 'left' | 'right';

export interface CleanBoardArea55ShipFlightPlan {
  durationMs: number;
  corridor: FlightCorridor;
  startEdge: ViewportEdge;
  endEdge: ViewportEdge;
  keyframes: Keyframe[];
}

export interface CleanBoardArea55ShipFlybyController {
  dispose(): void;
  getSnapshot(): {
    disposed: boolean;
    shipCount: number;
    behindShipCount: number;
    frontShipCount: number;
    runningAnimationCount: number;
    totalAnimationCount: number;
    asset: string;
  };
}

interface FlightPoint { x: number; y: number }
interface LiveShip { element: HTMLImageElement; depth: ShipDepth; animation: Animation | null }

let activeController: CleanBoardArea55ShipFlybyController | null = null;

export function stopCleanBoardArea55ShipFlybys(): void {
  activeController?.dispose();
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5));
}

function sample(random: () => number, min: number, max: number): number {
  return min + clamp01(random()) * (max - min);
}

function sampleEdgePoint(
  edge: ViewportEdge,
  corridor: FlightCorridor,
  width: number,
  height: number,
  random: () => number,
): FlightPoint {
  const corridorX = corridor === 'left'
    ? sample(random, width * 0.06, width * 0.22)
    : sample(random, width * 0.68, width * 0.82);
  if (edge === 'top') return { x: corridorX, y: -OFFSCREEN_MARGIN_PX };
  if (edge === 'right') return { x: width + OFFSCREEN_MARGIN_PX, y: sample(random, 0, height) };
  if (edge === 'bottom') return { x: corridorX, y: height + OFFSCREEN_MARGIN_PX };
  return { x: -OFFSCREEN_MARGIN_PX, y: sample(random, 0, height) };
}

// Zero velocity and acceleration at both ends: entry/exit can join the
// moving hover field without stopping it or introducing a corner.
function smoothBlend(value: number): number {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function toTransform(point: FlightPoint, rotation: number, scale: number): string {
  return `translate3d(${point.x.toFixed(3)}px, ${point.y.toFixed(3)}px, 0) rotate(${rotation.toFixed(3)}deg) scale(${scale.toFixed(3)})`;
}

export function createCleanBoardArea55ShipFlightPlan(options: {
  depth: ShipDepth;
  viewportWidth: number;
  viewportHeight: number;
  random?: () => number;
}): CleanBoardArea55ShipFlightPlan {
  const random = options.random ?? Math.random;
  const width = Math.max(1, options.viewportWidth);
  const height = Math.max(1, options.viewportHeight);
  const corridor: FlightCorridor = options.depth === 'behind' ? 'left' : 'right';
  const edges: readonly ViewportEdge[] = corridor === 'left'
    ? ['top', 'left', 'bottom']
    : ['top', 'right', 'bottom'];
  const startIndex = Math.min(edges.length - 1, Math.floor(clamp01(random()) * edges.length));
  const endOffset = 1 + Math.min(edges.length - 2, Math.floor(clamp01(random()) * (edges.length - 1)));
  const startEdge = edges[startIndex];
  const endEdge = edges[(startIndex + endOffset) % edges.length];
  const start = sampleEdgePoint(startEdge, corridor, width, height, random);
  const end = sampleEdgePoint(endEdge, corridor, width, height, random);
  const amplitude = sample(random, MIN_WOBBLE_PX, CLEAN_BOARD_AREA55_SHIP_MAX_WOBBLE_PX);
  const phaseX = sample(random, 0, Math.PI * 2);
  const phaseY = sample(random, 0, Math.PI * 2);
  const driftX = corridor === 'left' ? sample(random, 0.55, 0.72) : sample(random, 0.82, 0.99);
  const driftY = corridor === 'left' ? sample(random, 0.48, 0.66) : sample(random, 0.72, 0.91);
  const hoverX = corridor === 'left' ? sample(random, 3.0, 3.7) : sample(random, 4.1, 4.9);
  const hoverY = corridor === 'left' ? sample(random, 3.8, 4.5) : sample(random, 4.8, 5.6);
  const direction = random() < 0.5 ? -1 : 1;
  const baseOpacity = options.depth === 'behind' ? 0.7 : 0.9;
  const depthScale = options.depth === 'behind' ? 0.92 : 1.04;
  const tau = Math.PI * 2;
  const samplePosition = (progress: number): FlightPoint => {
    const t = clamp01(progress);
    // Each depth owns a distant screen corridor plus independent frequencies.
    // Randomness varies motion inside that corridor and can never pull the two
    // ships back toward one shared centre line.
    const laneCenterX = corridor === 'left' ? width * 0.16 : width * 0.70;
    const laneCenterY = corridor === 'left' ? height * 0.34 : height * 0.58;
    const hover = {
      x: laneCenterX + width * 0.08 * Math.sin(direction * t * tau * driftX + phaseX)
        + Math.min(amplitude * 0.45, width * 0.027) * Math.sin(t * tau * hoverX + phaseY),
      y: laneCenterY + height * 0.15 * Math.sin(t * tau * driftY + phaseY)
        + Math.min(amplitude * 0.75, height * 0.045) * Math.sin(t * tau * hoverY + phaseX),
    };
    const enter = smoothBlend(t / ENTER_END);
    const leave = smoothBlend((t - EXIT_START) / (1 - EXIT_START));
    return {
      x: (start.x + (hover.x - start.x) * enter) * (1 - leave) + end.x * leave,
      y: (start.y + (hover.y - start.y) * enter) * (1 - leave) + end.y * leave,
    };
  };
  const durationMs = CLEAN_BOARD_CONFETTI_MAX_RUNTIME_MS;
  const steps = Math.ceil(durationMs / 1000 * FLIGHT_SAMPLES_PER_SECOND);

  return {
    durationMs,
    corridor,
    startEdge,
    endEdge,
    // Bake a smooth curve into one compositor animation, not a JS frame loop.
    // Linear interpolation is only between nearby curve samples, never the
    // former distant random waypoints with discontinuous velocity.
    keyframes: Array.from({ length: steps + 1 }, (_, index) => {
      const t = index / steps;
      const point = samplePosition(t);
      const dt = 0.0001;
      const before = samplePosition(t - dt);
      const after = samplePosition(t + dt);
      const velocityX = (after.x - before.x) / (2 * dt * durationMs / 1000);
      const leave = smoothBlend((t - EXIT_START) / (1 - EXIT_START));
      const rotation = 10 * Math.tanh(velocityX / 130)
        + 4 * Math.sin(t * tau * hoverY + phaseX);
      const scale = (1 + 0.025 * Math.sin(t * tau * hoverX + phaseY)) * (1 - 0.14 * leave);
      return {
        offset: t,
        opacity: baseOpacity * smoothBlend(t / ENTER_END) * (1 - leave),
        transform: toTransform(point, rotation, scale * depthScale),
        easing: 'linear',
      } satisfies Keyframe;
    }),
  };
}

function createShip(depth: ShipDepth): HTMLImageElement {
  const ship = document.createElement('img');
  ship.className = `${SHIP_CLASS} ${SHIP_CLASS}--${depth}`;
  ship.dataset.cleanBoardArea55ShipDepth = depth;
  ship.src = AREA55_SHIP_ASSET;
  ship.alt = '';
  ship.decoding = 'async';
  ship.draggable = false;
  ship.setAttribute('aria-hidden', 'true');
  ship.style.cssText = [
    'position:fixed', 'top:0', 'left:0', `width:${depth === 'behind' ? 62 : 74}px`,
    'display:block', 'pointer-events:none', 'user-select:none', '-webkit-user-drag:none',
    'opacity:0', 'will-change:transform,opacity', depth === 'behind' ? 'z-index:0' : 'z-index:2',
  ].join(';');
  return ship;
}

/** Owns one gentle, confetti-length animation for each of the two ships. */
export function startCleanBoardArea55ShipFlybys(options: {
  overlay: HTMLElement;
  content: HTMLElement;
  random?: () => number;
}): CleanBoardArea55ShipFlybyController {
  stopCleanBoardArea55ShipFlybys();
  const { overlay, content } = options;
  const random = options.random ?? Math.random;
  let disposed = false;
  let observer: MutationObserver | null = null;
  let totalAnimationCount = 0;
  const ships: LiveShip[] = [];

  const controller: CleanBoardArea55ShipFlybyController = {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      observer = null;
      ships.forEach((ship) => {
        if (ship.animation) {
          ship.animation.onfinish = null;
          ship.animation.cancel();
          ship.animation = null;
        }
        ship.element.style.willChange = 'auto';
        ship.element.remove();
      });
      ships.length = 0;
      if (activeController === controller) activeController = null;
    },
    getSnapshot: () => ({
      disposed,
      shipCount: ships.filter((ship) => ship.element.parentElement === overlay).length,
      behindShipCount: ships.filter((ship) => ship.element.parentElement === overlay && ship.depth === 'behind').length,
      frontShipCount: ships.filter((ship) => ship.element.parentElement === overlay && ship.depth === 'front').length,
      runningAnimationCount: ships.filter((ship) => ship.animation !== null).length,
      totalAnimationCount,
      asset: AREA55_SHIP_ASSET,
    }),
  };

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) {
    activeController = controller;
    return controller;
  }

  overlay.style.isolation = 'isolate';
  content.style.zIndex = '1';
  const behindShip = createShip('behind');
  const frontShip = createShip('front');
  overlay.insertBefore(behindShip, content);
  overlay.appendChild(frontShip);
  ships.push(
    { element: behindShip, depth: 'behind', animation: null },
    { element: frontShip, depth: 'front', animation: null },
  );

  ships.forEach((ship) => {
    const plan = createCleanBoardArea55ShipFlightPlan({
      depth: ship.depth,
      viewportWidth: window.innerWidth || 390,
      viewportHeight: window.innerHeight || 844,
      random,
    });
    const animation = ship.element.animate(plan.keyframes, {
      duration: plan.durationMs,
      fill: 'both',
      easing: 'linear',
    });
    ship.animation = animation;
    totalAnimationCount += 1;
    animation.onfinish = () => {
      if (ship.animation !== animation) return;
      animation.onfinish = null;
      animation.cancel();
      ship.animation = null;
      ship.element.style.willChange = 'auto';
      ship.element.remove();
      if (ships.every((candidate) => candidate.animation === null)) controller.dispose();
    };
  });

  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => {
      if (!overlay.isConnected) controller.dispose();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  activeController = controller;
  return controller;
}
