export interface JourneyCardGeometry {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotationDeg: number;
}

export interface JourneyCardOriginLease {
  readonly boardId: number;
  readonly card: HTMLElement;
  readonly anchor: HTMLElement;
  readonly origin: JourneyCardGeometry;
  readonly aspectRatio: number;
  mountInto(host: HTMLElement): void;
  captureLandingGeometry(): void;
  readLiveGeometry(): JourneyCardGeometry | null;
  restoreNow(): boolean;
  discard(): void;
  readonly isMounted: boolean;
}

export interface JourneyCardSpatialPose {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotationDeg: number;
}

export function computeJourneyCardArcOffset(
  from: JourneyCardGeometry,
  to: JourneyCardGeometry,
  progress: number,
): { x: number; y: number } {
  const t = Math.min(1, Math.max(0, progress));
  const dx = to.centerX - from.centerX;
  const dy = to.centerY - from.centerY;
  const distance = Math.hypot(dx, dy);
  if (distance < 1 || t === 0 || t === 1) return { x: 0, y: 0 };
  const arc = Math.min(34, Math.max(14, distance * 0.075)) * Math.sin(Math.PI * t);
  const direction = dx >= 0 ? 1 : -1;
  return {
    x: (-dy / distance) * arc * direction,
    y: (dx / distance) * arc * direction,
  };
}

export interface JourneyCardSpatialFlightController {
  readonly result: Promise<'complete' | 'cancelled' | 'target-lost'>;
  cancel(): void;
}

function readMatrix(element: HTMLElement): {
  scaleX: number;
  scaleY: number;
  rotationDeg: number;
} {
  try {
    const transform = window.getComputedStyle(element).transform;
    if (!transform || transform === 'none') {
      return { scaleX: 1, scaleY: 1, rotationDeg: 0 };
    }
    const matrix = new DOMMatrixReadOnly(transform);
    return {
      scaleX: Math.hypot(matrix.m11, matrix.m12) || 1,
      scaleY: Math.hypot(matrix.m21, matrix.m22) || 1,
      rotationDeg: Math.atan2(matrix.m12, matrix.m11) * (180 / Math.PI),
    };
  } catch {
    return { scaleX: 1, scaleY: 1, rotationDeg: 0 };
  }
}

function isValidGeometry(geometry: JourneyCardGeometry | null): geometry is JourneyCardGeometry {
  return !!geometry && [
    geometry.centerX,
    geometry.centerY,
    geometry.width,
    geometry.height,
    geometry.rotationDeg,
  ].every(Number.isFinite) && geometry.width >= 1 && geometry.height >= 1;
}

export function captureJourneyCardGeometry(
  element: HTMLElement,
  transformOwner: HTMLElement = element,
  additionalTransformOwners: HTMLElement[] = [],
): JourneyCardGeometry | null {
  if (!element.isConnected) return null;
  const rect = element.getBoundingClientRect();
  const ownerMatrices = [transformOwner, ...additionalTransformOwners]
    .filter((owner, index, owners) => owners.indexOf(owner) === index)
    .map(readMatrix);
  const ownerMatrix = ownerMatrices.reduce((combined, matrix) => ({
    scaleX: combined.scaleX * matrix.scaleX,
    scaleY: combined.scaleY * matrix.scaleY,
    rotationDeg: combined.rotationDeg + matrix.rotationDeg,
  }), { scaleX: 1, scaleY: 1, rotationDeg: 0 });
  const elementMatrix = transformOwner === element
    ? { scaleX: 1, scaleY: 1, rotationDeg: 0 }
    : readMatrix(element);
  const width = Math.max(
    1,
    element.offsetWidth * ownerMatrix.scaleX * elementMatrix.scaleX,
  );
  const height = Math.max(
    1,
    element.offsetHeight * ownerMatrix.scaleY * elementMatrix.scaleY,
  );
  const geometry: JourneyCardGeometry = {
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
    width,
    height,
    rotationDeg: ownerMatrix.rotationDeg + elementMatrix.rotationDeg,
  };
  return isValidGeometry(geometry) ? geometry : null;
}

export function acquireJourneyCardOriginLease(
  boardId: number,
  card: HTMLElement,
): JourneyCardOriginLease | null {
  const anchor = card.closest<HTMLElement>('.journey-board-card-wrapper');
  const parent = card.parentElement;
  if (!anchor || !parent || !card.isConnected) return null;
  const origin = captureJourneyCardGeometry(card, anchor);
  if (!origin) return null;

  const nextSibling = card.nextSibling;
  const anchorOriginRect = anchor.getBoundingClientRect();
  const originalStyle = card.getAttribute('style');
  const originalClassName = Array.from(card.classList)
    .filter((className) => (
      className !== 'journey-card-overlay-portaled-card'
      && className !== 'journey-board-card-return-placeholder'
      && className !== 'journey-board-card-return-landing'
      && className !== 'idle-shimmer-trigger'
    ))
    .join(' ');
  let mounted = false;
  let settled = false;
  let landingGeometry = origin;
  let landingAnchorRect = anchorOriginRect;

  const restoreAttributes = () => {
    card.className = originalClassName;
    if (originalStyle === null) card.removeAttribute('style');
    else card.setAttribute('style', originalStyle);
  };

  const lease: JourneyCardOriginLease = {
    boardId,
    card,
    anchor,
    origin,
    aspectRatio: origin.width / Math.max(1, origin.height),
    get isMounted() {
      return mounted && !settled;
    },
    mountInto(host: HTMLElement) {
      if (settled || mounted) return;
      mounted = true;
      card.classList.remove(
        'journey-board-card-return-placeholder',
        'journey-board-card-return-landing',
      );
      card.classList.add('journey-card-overlay-portaled-card');
      card.style.pointerEvents = 'none';
      card.style.touchAction = 'none';
      host.appendChild(card);
    },
    captureLandingGeometry() {
      if (settled || mounted) return;
      const geometry = captureJourneyCardGeometry(card, anchor);
      if (geometry) {
        landingGeometry = geometry;
        landingAnchorRect = anchor.getBoundingClientRect();
      }
    },
    readLiveGeometry() {
      if (settled || !anchor.isConnected) return null;
      const rect = anchor.getBoundingClientRect();
      if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) return null;
      const relativeScaleX = landingAnchorRect.width > 0 ? rect.width / landingAnchorRect.width : 1;
      const relativeScaleY = landingAnchorRect.height > 0 ? rect.height / landingAnchorRect.height : relativeScaleX;
      const liveScaleX = Number.isFinite(relativeScaleX) ? relativeScaleX : 1;
      const liveScaleY = Number.isFinite(relativeScaleY) ? relativeScaleY : liveScaleX;
      const landingAnchorCenterX = landingAnchorRect.left + landingAnchorRect.width / 2;
      const landingAnchorCenterY = landingAnchorRect.top + landingAnchorRect.height / 2;
      // The live card can carry a translated idle frame inside its wrapper.
      // Preserve that visual card-to-wrapper offset throughout the return so
      // the terminal FLIP pixels already equal the pixels after reparenting.
      // Otherwise restoreNow() exposes a one-frame vertical correction.
      const liveCenterX = rect.left + rect.width / 2
        + (landingGeometry.centerX - landingAnchorCenterX) * liveScaleX;
      const liveCenterY = rect.top + rect.height / 2
        + (landingGeometry.centerY - landingAnchorCenterY) * liveScaleY;
      return {
        centerX: liveCenterX,
        centerY: liveCenterY,
        width: landingGeometry.width * liveScaleX,
        height: landingGeometry.height * liveScaleY,
        rotationDeg: landingGeometry.rotationDeg,
      };
    },
    restoreNow() {
      if (settled) return card.isConnected && card.parentElement === parent;
      settled = true;
      mounted = false;
      try {
        if (nextSibling && nextSibling.parentNode === parent) parent.insertBefore(card, nextSibling);
        else parent.appendChild(card);
        restoreAttributes();
        return true;
      } catch {
        restoreAttributes();
        return false;
      }
    },
    discard() {
      if (settled) return;
      settled = true;
      mounted = false;
      try { card.remove(); } catch {}
    },
  };

  return lease;
}

function smoothstep(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

export function getJourneyCardSpatialProgress(
  rawProgress: number,
  direction: 'enter' | 'return',
): number {
  const progress = Math.min(1, Math.max(0, rawProgress));
  const frames = direction === 'enter'
    ? [[0, 0], [0.08, -0.028], [0.58, 1.105], [0.76, 0.965], [0.9, 1.022], [1, 1]]
    : [[0, 0], [0.08, -0.035], [0.62, 1.055], [0.78, 0.978], [0.9, 1.014], [1, 1]];
  for (let index = 1; index < frames.length; index += 1) {
    const [endAt, endValue] = frames[index];
    if (progress > endAt) continue;
    const [startAt, startValue] = frames[index - 1];
    const local = smoothstep((progress - startAt) / Math.max(0.0001, endAt - startAt));
    return startValue + (endValue - startValue) * local;
  }
  return 1;
}

export function computeJourneyCardSpatialPose(
  base: JourneyCardGeometry,
  from: JourneyCardGeometry,
  to: JourneyCardGeometry,
  progress: number,
): JourneyCardSpatialPose {
  const centerX = from.centerX + (to.centerX - from.centerX) * progress;
  const centerY = from.centerY + (to.centerY - from.centerY) * progress;
  const width = from.width + (to.width - from.width) * progress;
  const height = from.height + (to.height - from.height) * progress;
  const scaleX = width / Math.max(1, base.width);
  const scaleY = height / Math.max(1, base.height);
  return {
    x: centerX - base.centerX,
    y: centerY - base.centerY,
    scaleX,
    scaleY,
    rotationDeg: from.rotationDeg + (to.rotationDeg - from.rotationDeg) * progress - base.rotationDeg,
  };
}

export function computeJourneyCardMotionTransformOrigin(
  base: JourneyCardGeometry,
  motionRect: Pick<DOMRect, 'left' | 'top'>,
): { x: number; y: number } {
  return {
    x: base.centerX - motionRect.left,
    y: base.centerY - motionRect.top,
  };
}

export function startJourneyCardSpatialFlight(options: {
  motionElement: HTMLElement;
  baseGeometry: JourneyCardGeometry;
  from: JourneyCardGeometry;
  readTarget: () => JourneyCardGeometry | null;
  direction: 'enter' | 'return';
  durationMs: number;
  spatialProgress?: (rawProgress: number) => number;
  pathOffset?: (
    from: JourneyCardGeometry,
    target: JourneyCardGeometry,
    spatialProgress: number,
  ) => { x: number; y: number };
  onProgress?: (rawProgress: number) => void;
}): JourneyCardSpatialFlightController {
  let animationFrame = 0;
  let finished = false;
  let resolveResult!: (result: 'complete' | 'cancelled' | 'target-lost') => void;
  const result = new Promise<'complete' | 'cancelled' | 'target-lost'>((resolve) => {
    resolveResult = resolve;
  });
  const startedAt = performance.now();

  const finish = (outcome: 'complete' | 'cancelled' | 'target-lost') => {
    if (finished) return;
    finished = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (outcome !== 'complete') {
      options.motionElement.style.removeProperty('transform');
      options.motionElement.style.removeProperty('will-change');
    }
    resolveResult(outcome);
  };

  const render = (now: number) => {
    if (finished) return;
    const target = options.readTarget();
    if (!isValidGeometry(target)) {
      finish('target-lost');
      return;
    }
    const rawProgress = Math.min(1, Math.max(0, (now - startedAt) / Math.max(1, options.durationMs)));
    const spatialProgress = options.spatialProgress
      ? options.spatialProgress(rawProgress)
      : getJourneyCardSpatialProgress(rawProgress, options.direction);
    const pose = computeJourneyCardSpatialPose(
      options.baseGeometry,
      options.from,
      target,
      spatialProgress,
    );
    const pathOffset = options.pathOffset?.(options.from, target, spatialProgress);
    if (pathOffset) {
      pose.x += pathOffset.x;
      pose.y += pathOffset.y;
    }
    options.motionElement.style.transform = [
      `translate3d(${pose.x}px, ${pose.y}px, 0)`,
      `rotate(${pose.rotationDeg}deg)`,
      `scale(${pose.scaleX}, ${pose.scaleY})`,
    ].join(' ');
    options.onProgress?.(rawProgress);
    if (rawProgress >= 1) {
      finish('complete');
      return;
    }
    animationFrame = requestAnimationFrame(render);
  };

  const motionRect = options.motionElement.getBoundingClientRect();
  const transformOrigin = computeJourneyCardMotionTransformOrigin(
    options.baseGeometry,
    motionRect,
  );
  options.motionElement.style.transformOrigin = `${transformOrigin.x}px ${transformOrigin.y}px`;
  options.motionElement.style.willChange = 'transform';
  render(startedAt);

  return {
    result,
    cancel() {
      finish('cancelled');
    },
  };
}
