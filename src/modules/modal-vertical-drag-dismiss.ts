export interface ModalVerticalDragDismissOptions {
  onDismiss: () => void;
  thresholdPx?: number;
  excludeSelector?: string;
  onDragStart?: () => void;
  onDragMove?: (deltaY: number) => void;
  onGestureMove?: (deltaX: number, deltaY: number) => void;
  onDragEnd?: (committed: boolean) => void;
}

export interface GameplayOverlayModalDragMotionOptions
  extends Omit<ModalVerticalDragDismissOptions, 'onDragStart' | 'onDragMove' | 'onDragEnd'> {
  motionElement: HTMLElement;
  restTiltDeg?: number;
  maxTravelPx?: number;
  maxDragTiltDeg?: number;
  maxTouchTiltDeg?: number;
  snapbackMs?: number;
}

const IOS_MODAL_DRAG_TRAVEL_RATIO = 0.7;
const IOS_MODAL_DRAG_RESISTANCE = 0.72;
const GAMEPLAY_MODAL_TOUCH_TILT_STRENGTH = 1.3;
const GAMEPLAY_MODAL_TOUCH_TILT_MAX_DEG = 3.64;

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
    if (event.pointerId !== activePointerId) return;
    lastX = event.clientX;
    lastY = event.clientY;
    const dx = lastX - startX;
    const dy = lastY - startY;
    options.onGestureMove?.(dx, dy);
    if (rejected) return;
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
 * It composes on the modal's outer bounce shell, leaving nested idle/pose and
 * the canonical enter/exit keyframes on their existing owners.
 */
export function installGameplayOverlayModalDragMotion(
  surface: HTMLElement,
  options: GameplayOverlayModalDragMotionOptions,
): () => void {
  const motionElement = options.motionElement;
  const idleShell = motionElement.querySelector<HTMLElement>('.cc-gameplay-modal-idle-shell');
  const touchTiltShell = motionElement.querySelector<HTMLElement>('.cc-gameplay-modal-touch-tilt-shell');
  const maxTravelPx = Number.isFinite(options.maxTravelPx)
    ? Math.max(120, Number(options.maxTravelPx))
    : null;
  const maxDragTiltDeg = Math.max(0, options.maxDragTiltDeg ?? 2.4);
  const maxTouchTiltDeg = Math.max(0, options.maxTouchTiltDeg ?? GAMEPLAY_MODAL_TOUCH_TILT_MAX_DEG);
  const snapbackMs = Math.max(120, options.snapbackMs ?? 280);
  const restTiltDeg = Number.isFinite(options.restTiltDeg) ? Number(options.restTiltDeg) : 0;
  const originalTransform = motionElement.style.transform;
  const originalWebkitTransform = motionElement.style.webkitTransform;
  const originalTransition = motionElement.style.transition;
  const originalTouchAction = surface.style.touchAction;
  const originalTouchTiltTransform = touchTiltShell?.style.transform ?? '';
  const originalTouchTiltWebkitTransform = touchTiltShell?.style.webkitTransform ?? '';
  const originalTouchTiltTransition = touchTiltShell?.style.transition ?? '';
  const originalTouchTiltWillChange = touchTiltShell?.style.willChange ?? '';
  let dragStartRect: DOMRect | null = null;
  let dragViewportHeight = 0;
  let snapbackTimeout: number | null = null;
  let lastVisualY = 0;
  let lastDragTiltDeg = 0;

  const setTouchTiltPose = (rotateXDeg: number, rotateYDeg: number) => {
    if (!touchTiltShell) return;
    const transform = `perspective(950px) rotateX(${rotateXDeg.toFixed(2)}deg) rotateY(${rotateYDeg.toFixed(2)}deg) translateZ(0)`;
    touchTiltShell.style.transform = transform;
    touchTiltShell.style.webkitTransform = transform;
  };

  const setPose = (y: number, dragTiltDeg: number) => {
    lastVisualY = y;
    lastDragTiltDeg = dragTiltDeg;
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
  setTouchTiltPose(0, 0);
  const disposeGesture = installModalVerticalDragDismiss(surface, {
    ...options,
    onDragStart: () => {
      clearSnapback();
      dragStartRect = motionElement.getBoundingClientRect();
      dragViewportHeight = window.innerHeight;
      motionElement.style.transition = 'none';
      motionElement.style.removeProperty('--cc-modal-drag-release-y');
      motionElement.style.removeProperty('--cc-modal-drag-release-tilt');
      if (idleShell) idleShell.style.animationPlayState = 'paused';
      if (touchTiltShell) {
        touchTiltShell.style.transition = 'none';
        touchTiltShell.style.willChange = 'transform';
      }
    },
    onGestureMove: (deltaX, deltaY) => {
      // A deliberately softer version of the Journey card's physical tilt.
      // Horizontal finger travel turns the paper on Y; vertical travel gives
      // only a small X lean while the outer owner keeps dismissal movement.
      const rotateYDeg = Math.max(
        -maxTouchTiltDeg,
        Math.min(maxTouchTiltDeg, (deltaX / 42) * GAMEPLAY_MODAL_TOUCH_TILT_STRENGTH),
      );
      const maxTouchTiltXDeg = maxTouchTiltDeg * 0.72;
      const rotateXDeg = Math.max(
        -maxTouchTiltXDeg,
        Math.min(maxTouchTiltXDeg, (-deltaY / 90) * GAMEPLAY_MODAL_TOUCH_TILT_STRENGTH),
      );
      setTouchTiltPose(rotateXDeg, rotateYDeg);
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
      if (committed) {
        // Hand the exact finger-release pose to the canonical exit animation.
        // This prevents its first keyframe from snapping the modal to center.
        motionElement.style.setProperty('--cc-modal-drag-release-y', `${lastVisualY.toFixed(2)}px`);
        motionElement.style.setProperty(
          '--cc-modal-drag-release-tilt',
          `${(restTiltDeg + lastDragTiltDeg).toFixed(2)}deg`,
        );
        return;
      }
      motionElement.style.transition = `transform ${snapbackMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
      if (touchTiltShell) {
        touchTiltShell.style.transition = `transform ${snapbackMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
      }
      setPose(0, 0);
      setTouchTiltPose(0, 0);
      snapbackTimeout = window.setTimeout(() => {
        snapbackTimeout = null;
        motionElement.style.transition = originalTransition;
        if (idleShell) idleShell.style.removeProperty('animation-play-state');
        if (touchTiltShell) {
          touchTiltShell.style.transition = originalTouchTiltTransition;
          touchTiltShell.style.willChange = originalTouchTiltWillChange;
        }
      }, snapbackMs);
    },
  });

  return () => {
    clearSnapback();
    disposeGesture();
    motionElement.style.transform = originalTransform;
    motionElement.style.webkitTransform = originalWebkitTransform;
    motionElement.style.transition = originalTransition;
    motionElement.style.removeProperty('--cc-modal-drag-release-y');
    motionElement.style.removeProperty('--cc-modal-drag-release-tilt');
    if (touchTiltShell) {
      touchTiltShell.style.transform = originalTouchTiltTransform;
      touchTiltShell.style.webkitTransform = originalTouchTiltWebkitTransform;
      touchTiltShell.style.transition = originalTouchTiltTransition;
      touchTiltShell.style.willChange = originalTouchTiltWillChange;
    }
    surface.style.touchAction = originalTouchAction;
    if (idleShell) idleShell.style.removeProperty('animation-play-state');
  };
}
