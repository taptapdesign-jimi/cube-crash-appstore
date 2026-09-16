import { CLEAN_BOARD_CONFETTI_MAX_RUNTIME_MS } from './confetti-system.js';

const AREA55_SHIP_ASSET = './assets/journey assets/robo/ship1@2x.png';
const SHIP_CLASS = 'cc-clean-board-area55-ship';
const OFFSCREEN_MARGIN_PX = 112;
const KEYFRAME_OFFSETS = [0, 0.16, 0.29, 0.42, 0.55, 0.68, 0.79, 0.85, 0.92, 1] as const;
const WAYPOINT_HOVER_OFFSETS = [0.008, 0.018, 0.03] as const;
const WAYPOINT_HOVER_MOTION = [
  { x: 2, y: -2, rotation: 1.6 },
  { x: -2, y: 1.5, rotation: -1.4 },
  { x: 0, y: 0, rotation: 0 },
] as const;

type ShipDepth = 'behind' | 'front';
type ViewportEdge = 'top' | 'right' | 'bottom' | 'left';

export interface CleanBoardArea55ShipFlightPlan {
  durationMs: number;
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

function sampleEdgePoint(edge: ViewportEdge, width: number, height: number, random: () => number): FlightPoint {
  if (edge === 'top') return { x: sample(random, 0, width), y: -OFFSCREEN_MARGIN_PX };
  if (edge === 'right') return { x: width + OFFSCREEN_MARGIN_PX, y: sample(random, 0, height) };
  if (edge === 'bottom') return { x: sample(random, 0, width), y: height + OFFSCREEN_MARGIN_PX };
  return { x: -OFFSCREEN_MARGIN_PX, y: sample(random, 0, height) };
}

function sampleInteriorPoint(width: number, height: number, random: () => number): FlightPoint {
  return {
    x: sample(random, width * 0.08, width * 0.92),
    y: sample(random, height * 0.07, height * 0.93),
  };
}

function getRotationDegrees(from: FlightPoint, to: FlightPoint, wobble: number): number {
  const pathBank = Math.atan2(to.y - from.y, Math.max(1, Math.abs(to.x - from.x))) * 16;
  return Math.max(-22, Math.min(22, pathBank + wobble));
}

function toTransform(point: FlightPoint, rotation: number, scale: number): string {
  return `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0) rotate(${rotation.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
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
  const edges: readonly ViewportEdge[] = ['top', 'right', 'bottom', 'left'];
  const startIndex = Math.min(edges.length - 1, Math.floor(clamp01(random()) * edges.length));
  const endOffset = 1 + Math.min(edges.length - 2, Math.floor(clamp01(random()) * (edges.length - 1)));
  const startEdge = edges[startIndex];
  const endEdge = edges[(startIndex + endOffset) % edges.length];
  const points: FlightPoint[] = [
    sampleEdgePoint(startEdge, width, height, random),
    ...Array.from({ length: KEYFRAME_OFFSETS.length - 2 }, () => sampleInteriorPoint(width, height, random)),
    sampleEdgePoint(endEdge, width, height, random),
  ];
  const baseOpacity = options.depth === 'behind' ? 0.7 : 0.9;
  const depthScale = options.depth === 'behind' ? 0.92 : 1.04;

  return {
    durationMs: CLEAN_BOARD_CONFETTI_MAX_RUNTIME_MS,
    startEdge,
    endEdge,
    keyframes: points.flatMap((point, index) => {
      const previousPoint = points[Math.max(0, index - 1)];
      const nextPoint = points[Math.min(points.length - 1, index + 1)];
      const exiting = index >= points.length - 3;
      const wobble = index === 0 || index === points.length - 1
        ? 0
        : exiting ? (index % 2 === 0 ? 16 : -16) : sample(random, -11, 11);
      const scale = exiting
        ? [1.08, 0.98, 0.86][index - (points.length - 3)]
        : sample(random, 0.9, 1.12);
      const rotation = getRotationDegrees(previousPoint, nextPoint, wobble);
      const waypoint: Keyframe = {
        offset: KEYFRAME_OFFSETS[index],
        opacity: index === 0 || index === points.length - 1 ? 0 : baseOpacity,
        transform: toTransform(point, rotation, scale * depthScale),
        easing: index === 0 || exiting
          ? 'cubic-bezier(.22,.61,.36,1)'
          : 'cubic-bezier(.45,.05,.25,1)',
      };
      if (index === 0 || exiting) return [waypoint];

      // Settle at each interior waypoint, then trace a tiny hover before the next flight leg.
      // These frames stay inside the original 9.8-second flight and share its single animation owner.
      waypoint.easing = 'ease-in-out';
      const hoverFrames = WAYPOINT_HOVER_OFFSETS.map((offset, hoverIndex) => {
        const motion = WAYPOINT_HOVER_MOTION[hoverIndex];
        return {
          offset: KEYFRAME_OFFSETS[index] + offset,
          opacity: baseOpacity,
          transform: toTransform(
            { x: point.x + motion.x, y: point.y + motion.y },
            rotation + motion.rotation,
            scale * depthScale,
          ),
          easing: hoverIndex === WAYPOINT_HOVER_OFFSETS.length - 1
            ? 'cubic-bezier(.45,.05,.25,1)'
            : 'ease-in-out',
        } satisfies Keyframe;
      });
      return [waypoint, ...hoverFrames];
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
