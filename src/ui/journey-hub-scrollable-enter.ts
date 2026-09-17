import gsap from 'gsap';

// back.out(1.75) is cubic in time. Linear Bezier X control points make these
// Y control points exactly the GSAP polynomial, including its overshoot.
export const HUB_SCROLLABLE_ENTER_EASING = 'cubic-bezier(0.3333333333333333, 1.5833333333333333, 0.6666666666666666, 1)';
export const HUB_SCROLLABLE_ENTER_KEYFRAMES: Keyframe[] = [
  { transform: 'translate3d(0, 18px, 0) scale(0.78)', opacity: 0 },
  { transform: 'translate3d(0, 0px, 0) scale(1)', opacity: 1 },
];
let owner: { element: HTMLElement; animation: Animation } | null = null;
let frozenElement: HTMLElement | null = null;

export function cancelJourneyHubScrollableEnter(options: { preservePose?: boolean } = {}): void {
  const current = owner;
  if (!current) {
    if (!options.preservePose && frozenElement) {
      gsap.set(frozenElement, { clearProps: 'transform', opacity: 1 });
      frozenElement = null;
    }
    return;
  }
  owner = null;
  const painted = options.preservePose ? getComputedStyle(current.element) : null;
  const transform = painted?.transform;
  const opacity = painted?.opacity;
  frozenElement = options.preservePose ? current.element : null;
  current.animation.onfinish = null;
  current.animation.oncancel = null;
  current.animation.cancel();
  if (transform && transform !== 'none') gsap.set(current.element, { transform, opacity: opacity || 1 });
  else gsap.set(current.element, { clearProps: 'transform', opacity: opacity || 1 });
}

/** Returns false for the unchanged GSAP fallback; preparation remains shared. */
export function startJourneyHubScrollableEnter(element: HTMLElement): boolean {
  cancelJourneyHubScrollableEnter();
  if (typeof element.animate !== 'function') return false;
  let animation: Animation;
  try {
    animation = element.animate(HUB_SCROLLABLE_ENTER_KEYFRAMES, {
      duration: 540, delay: 100, easing: HUB_SCROLLABLE_ENTER_EASING, fill: 'both',
    });
  } catch { return false; }
  const current = { element, animation };
  owner = current;
  const finish = () => {
    if (owner !== current) return;
    owner = null;
    animation.onfinish = null;
    animation.oncancel = null;
    // Retire the fill only after the underlying pose is neutral, as in the
    // prior GSAP onComplete. A stale callback may never clear a newer owner.
    gsap.set(element, { clearProps: 'transform', opacity: 1 });
    animation.cancel();
  };
  animation.onfinish = finish;
  animation.oncancel = finish;
  return true;
}
