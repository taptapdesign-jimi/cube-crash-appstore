type ParkingLease = {
  screen: HTMLElement;
  surface: HTMLElement;
  cover: HTMLElement;
  previousInert: boolean;
  previousAriaHidden: string | null;
};

let lease: ParkingLease | null = null;
const PARKED_ATTRIBUTE = 'data-journey-viewport-parked';
const RESIDENT_ATTRIBUTE = 'data-journey-viewport-resident';

function ownsSurface(screen: HTMLElement, surface: HTMLElement): boolean {
  return screen !== surface && screen.isConnected && surface.isConnected
    && screen.ownerDocument === surface.ownerDocument && screen.contains(surface)
    && surface.dataset.journeyV700View === 'world'
    && ['1', '2', '3'].includes(surface.dataset.journeyV700WorldId || '');
}

export function isJourneyViewportParked(screen: HTMLElement): boolean {
  return !!lease && lease.screen === screen && lease.cover.isConnected
    && lease.cover.parentElement === screen.ownerDocument.body
    && screen.getAttribute(PARKED_ATTRIBUTE) === 'true'
    && ownsSurface(screen, lease.surface);
}

/** Hide before dropping the cover. The existing route owner performs its
 * canonical reveal synchronously after this call; parking never reveals. */
export function releaseJourneyViewportParking(screen?: HTMLElement, preserveResidentLayer = false): void {
  if (!lease) {
    if (screen && !preserveResidentLayer) screen.removeAttribute(RESIDENT_ATTRIBUTE);
    return;
  }
  if (screen && lease.screen !== screen) return;
  const current = lease;
  lease = null;
  current.screen.style.setProperty('opacity', '0', 'important');
  current.screen.style.setProperty('visibility', 'hidden', 'important');
  current.screen.removeAttribute(PARKED_ATTRIBUTE);
  if (!preserveResidentLayer) current.screen.removeAttribute(RESIDENT_ATTRIBUTE);
  current.screen.inert = current.previousInert;
  if (current.previousAriaHidden === null) current.screen.removeAttribute('aria-hidden');
  else current.screen.setAttribute('aria-hidden', current.previousAriaHidden);
  current.cover.remove();
}

/** One bounded, opaque cover keeps the retained viewport invisible to
 * the user while its renderer stays mounted. The caller owns the layer above it.
 * The manager continues to own all content inertness and runtime suspension. */
export function parkJourneyViewportForGameplay(screen: HTMLElement, surface: HTMLElement): boolean {
  if (!ownsSurface(screen, surface) || !screen.ownerDocument.body?.contains(screen)) return false;
  if (lease?.screen === screen && lease.surface === surface && isJourneyViewportParked(screen)) return true;

  const cover = screen.ownerDocument.createElement('div');
  cover.className = 'journey-viewport-parking-cover';
  cover.setAttribute('aria-hidden', 'true');
  Object.assign(cover.style, {
    position: 'fixed', inset: '0', zIndex: '2', pointerEvents: 'none',
    background: 'var(--app-gradient, #f3eee8)', backgroundColor: '#f3eee8',
  });
  // Publish the opaque cover before the attribute can make the World paint.
  screen.ownerDocument.body.appendChild(cover);
  if (lease) {
    lease.screen.hidden = true;
    lease.screen.style.setProperty('visibility', 'hidden', 'important');
    releaseJourneyViewportParking();
  }
  lease = {
    screen, surface, cover,
    previousInert: screen.inert === true,
    previousAriaHidden: screen.getAttribute('aria-hidden'),
  };
  screen.inert = true;
  screen.setAttribute('aria-hidden', 'true');
  screen.setAttribute(RESIDENT_ATTRIBUTE, 'true');
  screen.setAttribute(PARKED_ATTRIBUTE, 'true');
  // Hidden primes/terminal commits may leave inline !important declarations.
  // Only after the opaque cover exists may the parked CSS take precedence.
  for (const property of ['display', 'opacity', 'visibility', 'z-index']) {
    if (screen.style.getPropertyPriority(property)) {
      screen.style.setProperty(property, screen.style.getPropertyValue(property));
    }
  }
  return true;
}
