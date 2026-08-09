export interface ModalVerticalDragDismissOptions {
  onDismiss: () => void;
  thresholdPx?: number;
  excludeSelector?: string;
  onDragStart?: () => void;
  onDragMove?: (deltaY: number) => void;
  onDragEnd?: (committed: boolean) => void;
}

export interface GameplayOverlayModalDragMotionOptions
  extends Omit<ModalVerticalDragDismissOptions, 'onDragStart' | 'onDragMove' | 'onDragEnd'> {
  motionElement: HTMLElement;
  restTiltDeg?: number;
  maxTravelPx?: number;
  maxDragTiltDeg?: number;
  snapbackMs?: number;
}

const IOS_MODAL_DRAG_TRAVEL_RATIO = 0.7;
const IOS_MODAL_DRAG_RESISTANCE = 0.72;

export function getIosResistedModalVerticalDelta(
  deltaY: number,
  rect: Pick<DOMRect, 'top' | 'bottom' | 'height'>,
  viewportHeight: number,
): number {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0 || rect.height <= 0) return deltaY;
  const direction = deltaY < 0 ? -1 : 1;
  const availableDistance = direction < 0
    ? Math.max(0, rect.top)
    : Math.max(0, viewportHeight - rect.bottom);
  const travelLimit = availableDistance * IOS_MODAL_DRAG_TRAVEL_RATIO;
  if (travelLimit <= 0 || deltaY === 0) return 0;
  const resistedDistance = Math.abs(deltaY) * IOS_MODAL_DRAG_RESISTANCE;
  return direction * travelLimit * resistedDistance / (travelLimit + resistedDistance);
}

/**
 * Adds an axis-locked, bidirectional vertical dismiss gesture without taking
 * ownership of the modal's transform. Modal enter/exit animations remain the
 * sole visual owners; this helper only commits the existing close lifecycle.
 */
export function installModalVerticalDragDismiss(
  surface: HTMLElement,
  options: ModalVerticalDragDismissOptions,
): () => void {
  const thresholdPx = Math.max(24, options.thresholdPx ?? 96);
  const excludeSelector = options.excludeSelector
    ?? 'button, a, input, textarea, select, [role="button"], [data-modal-drag-ignore]';
  let activePointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let rejected = false;

  const reset = () => {
    activePointerId = null;
    rejected = false;
  };
  const onPointerDown = (event: PointerEvent) => {
    if (activePointerId !== null || event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(excludeSelector)) return;
    activePointerId = event.pointerId;
    startX = lastX = event.clientX;
    startY = lastY = event.clientY;
    rejected = false;
    options.onDragStart?.();
    try { surface.setPointerCapture(event.pointerId); } catch {}
  };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId || rejected) return;
    lastX = event.clientX;
    lastY = event.clientY;
    const dx = lastX - startX;
    const dy = lastY - startY;
    if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.15) rejected = true;
    if (!rejected) options.onDragMove?.(dy);
  };
  const finish = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    lastX = event.clientX;
    lastY = event.clientY;
    const dx = lastX - startX;
    const dy = lastY - startY;
    const shouldDismiss = !rejected
      && Math.abs(dy) >= thresholdPx
      && Math.abs(dy) > Math.abs(dx) * 1.15;
    reset();
    options.onDragEnd?.(shouldDismiss);
    if (shouldDismiss) options.onDismiss();
  };
  const cancel = (event: PointerEvent) => {
    if (event.pointerId === activePointerId) {
      reset();
      options.onDragEnd?.(false);
    }
  };

  surface.addEventListener('pointerdown', onPointerDown);
  surface.addEventListener('pointermove', onPointerMove);
  surface.addEventListener('pointerup', finish);
  surface.addEventListener('pointercancel', cancel);

  return () => {
    surface.removeEventListener('pointerdown', onPointerDown);
    surface.removeEventListener('pointermove', onPointerMove);
    surface.removeEventListener('pointerup', finish);
    surface.removeEventListener('pointercancel', cancel);
    reset();
  };
}

/**
 * Shared physical drag owner for centered gameplay modals with a backdrop.
 * It composes on the modal's outer bounce shell, leaving nested idle/gyro and
 * the canonical enter/exit keyframes on their existing owners.
 */
export function installGameplayOverlayModalDragMotion(
  surface: HTMLElement,
  options: GameplayOverlayModalDragMotionOptions,
): () => void {
  const motionElement = options.motionElement;
  const idleShell = motionElement.querySelector<HTMLElement>('.cc-gameplay-modal-idle-shell');
  const maxTravelPx = Number.isFinite(options.maxTravelPx)
    ? Math.max(120, Number(options.maxTravelPx))
    : null;
  const maxDragTiltDeg = Math.max(0, options.maxDragTiltDeg ?? 2.4);
  const snapbackMs = Math.max(120, options.snapbackMs ?? 280);
  const restTiltDeg = Number.isFinite(options.restTiltDeg) ? Number(options.restTiltDeg) : 0;
  const originalTransform = motionElement.style.transform;
  const originalWebkitTransform = motionElement.style.webkitTransform;
  const originalTransition = motionElement.style.transition;
  const originalTouchAction = surface.style.touchAction;
  let dragStartRect: DOMRect | null = null;
  let dragViewportHeight = 0;
  let snapbackTimeout: number | null = null;

  const setPose = (y: number, dragTiltDeg: number) => {
    const transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(1) rotate(${(restTiltDeg + dragTiltDeg).toFixed(2)}deg)`;
    motionElement.style.transform = transform;
    motionElement.style.webkitTransform = transform;
  };
  const clearSnapback = () => {
    if (snapbackTimeout !== null) {
      window.clearTimeout(snapbackTimeout);
      snapbackTimeout = null;
    }
  };

  surface.style.touchAction = 'none';
  setPose(0, 0);
  const disposeGesture = installModalVerticalDragDismiss(surface, {
    ...options,
    onDragStart: () => {
      clearSnapback();
      dragStartRect = motionElement.getBoundingClientRect();
      dragViewportHeight = window.innerHeight;
      motionElement.style.transition = 'none';
      if (idleShell) idleShell.style.animationPlayState = 'paused';
    },
    onDragMove: (deltaY) => {
      const viewportBoundedY = dragStartRect
        ? getIosResistedModalVerticalDelta(deltaY, dragStartRect, dragViewportHeight)
        : deltaY;
      const boundedY = maxTravelPx === null
        ? viewportBoundedY
        : Math.max(-maxTravelPx, Math.min(maxTravelPx, viewportBoundedY));
      const dragTilt = Math.max(
        -maxDragTiltDeg,
        Math.min(maxDragTiltDeg, boundedY / 54),
      );
      setPose(boundedY, dragTilt);
    },
    onDragEnd: (committed) => {
      if (committed) return;
      motionElement.style.transition = `transform ${snapbackMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
      setPose(0, 0);
      snapbackTimeout = window.setTimeout(() => {
        snapbackTimeout = null;
        motionElement.style.transition = originalTransition;
        if (idleShell) idleShell.style.removeProperty('animation-play-state');
      }, snapbackMs);
    },
  });

  return () => {
    clearSnapback();
    disposeGesture();
    motionElement.style.transform = originalTransform;
    motionElement.style.webkitTransform = originalWebkitTransform;
    motionElement.style.transition = originalTransition;
    surface.style.touchAction = originalTouchAction;
    if (idleShell) idleShell.style.removeProperty('animation-play-state');
  };
}
