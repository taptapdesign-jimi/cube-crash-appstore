export interface JourneyScrollTapGuard {
  start(clientX: number, clientY: number): void;
  move(clientX: number, clientY: number): void;
  cancel(): void;
  shouldHandleTouchEnd(clientX?: number, clientY?: number): boolean;
  shouldHandleClick(): boolean;
}

/**
 * Separates a deliberate tap from an iOS scroll gesture. WebKit can hand native
 * scrolling off before an element receives a final touchmove, so finger travel
 * alone is not sufficient: the scroll owner's actual position is authoritative.
 */
export function createJourneyScrollTapGuard(
  readScrollTop: () => number,
  moveThresholdPx = 10,
  scrollThresholdPx = 1,
): JourneyScrollTapGuard {
  let startX = 0;
  let startY = 0;
  let startScrollTop = 0;
  let trackingTouch = false;
  let moved = false;
  let suppressSyntheticClick = false;

  const updateMovement = (clientX: number, clientY: number) => {
    const dx = clientX - startX;
    const dy = clientY - startY;
    if ((dx * dx + dy * dy) >= moveThresholdPx * moveThresholdPx) moved = true;
  };

  const scrollMoved = () => Math.abs(readScrollTop() - startScrollTop) > scrollThresholdPx;

  return {
    start(clientX, clientY) {
      startX = clientX;
      startY = clientY;
      startScrollTop = readScrollTop();
      trackingTouch = true;
      moved = false;
      suppressSyntheticClick = false;
    },
    move(clientX, clientY) {
      if (!trackingTouch) return;
      updateMovement(clientX, clientY);
      if (scrollMoved()) moved = true;
    },
    cancel() {
      if (!trackingTouch) return;
      trackingTouch = false;
      moved = true;
      suppressSyntheticClick = true;
    },
    shouldHandleTouchEnd(clientX, clientY) {
      if (!trackingTouch) {
        suppressSyntheticClick = true;
        return false;
      }
      if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
        updateMovement(clientX as number, clientY as number);
      }
      const isScrollGesture = moved || scrollMoved();
      trackingTouch = false;
      suppressSyntheticClick = true;
      return !isScrollGesture;
    },
    shouldHandleClick() {
      if (suppressSyntheticClick) {
        suppressSyntheticClick = false;
        return false;
      }
      return !trackingTouch;
    },
  };
}
