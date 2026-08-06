// @ts-nocheck

// Homepage navigation lifecycle owner.
// No route, animation, or UI compatibility layer may derive navigation state
// from current DOM styles. They submit lifecycle intent here; this module is
// the only authority for display/visibility/aria/input ownership.

import { logger } from '../core/logger.js';

export type HomepageNavigationPhase =
  | 'inactive'
  | 'primed'
  | 'entering'
  | 'interactive';

const OWNER_ATTRIBUTE = 'data-homepage-owner';
const PHASE_ATTRIBUTE = 'data-homepage-navigation-phase';
const TRACE_PREFIX = '[CC_HOME_NAV]';

let phase: HomepageNavigationPhase = 'inactive';
let generation = 0;
let lastReason = 'module-init';
let observer: MutationObserver | null = null;
let reconcileFrame: number | null = null;
let applying = false;

function setStyle(element: HTMLElement, property: string, value: string): void {
  if (element.style.getPropertyValue(property) !== value) {
    element.style.setProperty(property, value);
  }
}

function setAttribute(element: HTMLElement, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function snapshot(reason: string): Record<string, unknown> {
  const nav = document.getElementById('independent-nav') as HTMLElement | null;
  const firstButton = nav?.querySelector('.independent-nav-button') as HTMLElement | null;
  const firstImage = firstButton?.querySelector('img') as HTMLImageElement | null;
  const navStyle = nav ? window.getComputedStyle(nav) : null;
  const imageStyle = firstImage ? window.getComputedStyle(firstImage) : null;
  return {
    reason,
    phase,
    generation,
    zone: (window as any).__ccAppZone ?? null,
    navExists: Boolean(nav),
    owner: nav?.getAttribute(OWNER_ATTRIBUTE) ?? null,
    hidden: nav?.hasAttribute('hidden') ?? null,
    ariaHidden: nav?.getAttribute('aria-hidden') ?? null,
    display: navStyle?.display ?? null,
    visibility: navStyle?.visibility ?? null,
    opacity: navStyle?.opacity ?? null,
    pointerEvents: navStyle?.pointerEvents ?? null,
    transform: navStyle?.transform ?? null,
    rect: nav ? {
      width: Math.round(nav.getBoundingClientRect().width),
      height: Math.round(nav.getBoundingClientRect().height),
    } : null,
    firstIcon: firstImage ? {
      complete: firstImage.complete,
      naturalWidth: firstImage.naturalWidth,
      display: imageStyle?.display ?? null,
      visibility: imageStyle?.visibility ?? null,
      opacity: imageStyle?.opacity ?? null,
      transform: imageStyle?.transform ?? null,
      rect: {
        width: Math.round(firstImage.getBoundingClientRect().width),
        height: Math.round(firstImage.getBoundingClientRect().height),
      },
    } : null,
  };
}

function trace(reason: string): void {
  console.info(TRACE_PREFIX, snapshot(reason));
}

function applyInactive(nav: HTMLElement): void {
  setAttribute(nav, OWNER_ATTRIBUTE, 'inactive');
  setAttribute(nav, PHASE_ATTRIBUTE, 'inactive');
  setAttribute(nav, 'aria-hidden', 'true');
  if (!nav.hasAttribute('hidden')) nav.setAttribute('hidden', 'true');
  setStyle(nav, 'display', 'none');
  setStyle(nav, 'visibility', 'hidden');
  setStyle(nav, 'opacity', '0');
  setStyle(nav, 'pointer-events', 'none');
  setStyle(nav, 'z-index', '-1');
  nav.getAnimations?.({ subtree: true }).forEach((animation) => {
    try { animation.cancel(); } catch {}
  });
}

function applyOwned(nav: HTMLElement): void {
  const interactive = phase === 'interactive';
  setAttribute(nav, OWNER_ATTRIBUTE, 'active');
  setAttribute(nav, PHASE_ATTRIBUTE, phase);
  setAttribute(nav, 'aria-hidden', 'false');
  if (nav.hasAttribute('hidden')) nav.removeAttribute('hidden');
  setStyle(nav, 'display', 'block');
  setStyle(nav, 'visibility', 'visible');
  setStyle(nav, 'opacity', '1');
  setStyle(nav, 'pointer-events', interactive ? 'auto' : 'none');
  setStyle(nav, 'z-index', '100');

  const content = nav.querySelector('.independent-nav-content') as HTMLElement | null;
  const buttons = nav.querySelector('.independent-nav-buttons') as HTMLElement | null;
  [content, buttons].filter(Boolean).forEach((element) => {
    const child = element as HTMLElement;
    setStyle(child, 'display', 'flex');
    setStyle(child, 'visibility', 'visible');
    setStyle(child, 'opacity', '1');
  });
  if (content) setStyle(content, 'pointer-events', 'none');
  if (buttons) setStyle(buttons, 'pointer-events', interactive ? 'auto' : 'none');

  nav.querySelectorAll<HTMLElement>('.independent-nav-button').forEach((button) => {
    setStyle(button, 'display', 'flex');
    setStyle(button, 'visibility', 'visible');
    setStyle(button, 'opacity', '1');
    setStyle(button, 'pointer-events', interactive ? 'auto' : 'none');
    setStyle(button, 'cursor', interactive ? 'pointer' : 'default');
    button.querySelectorAll<HTMLElement>('.nav-icon-motion, .nav-icon-visual, img').forEach((node) => {
      setStyle(node, 'display', node.tagName === 'IMG' ? 'block' : 'flex');
      setStyle(node, 'visibility', 'visible');
      setStyle(node, 'opacity', '1');
      setStyle(node, 'pointer-events', 'none');
    });
  });
}

function applyAuthoritativeState(reason: string, emitTrace = false): void {
  const nav = document.getElementById('independent-nav') as HTMLElement | null;
  if (!nav || applying) return;
  applying = true;
  try {
    if (phase === 'inactive') applyInactive(nav);
    else applyOwned(nav);
  } finally {
    applying = false;
  }
  if (emitTrace) trace(reason);
}

function isHomepageRoute(): boolean {
  return (window as any).__ccAppZone === 'home';
}

function rejectActivation(reason: string, requestedPhase: HomepageNavigationPhase): number {
  logger.warn('⚠️ Homepage navigation activation rejected outside Homepage', {
    reason,
    requestedPhase,
    zone: (window as any).__ccAppZone ?? null,
  });
  if (phase !== 'inactive') transition('inactive', `${reason}:rejected-outside-home`);
  else applyAuthoritativeState(`${reason}:rejected-outside-home`);
  return generation;
}

function rejectStale(
  reason: string,
  requestedPhase: HomepageNavigationPhase,
  expectedGeneration: number,
): number {
  console.warn(TRACE_PREFIX, 'stale-transition-ignored', {
    reason,
    requestedPhase,
    expectedGeneration,
    generation,
    phase,
  });
  return generation;
}

function transition(next: HomepageNavigationPhase, reason: string): number {
  phase = next;
  lastReason = reason;
  applyAuthoritativeState(reason, true);
  return generation;
}

export function primeHomepageNavigation(
  reason = 'homepage-prime',
  expectedGeneration?: number,
): number {
  if (!isHomepageRoute()) return rejectActivation(reason, 'primed');
  if (expectedGeneration !== undefined && expectedGeneration !== generation) {
    return rejectStale(reason, 'primed', expectedGeneration);
  }
  // Prime is an acquire operation only. Duplicate/stale preparation must not
  // regress entering or interactive navigation back to a non-interactive phase.
  if (phase !== 'inactive') return generation;
  generation += 1;
  return transition('primed', reason);
}

export function markHomepageNavigationEntering(
  reason = 'homepage-enter',
  expectedGeneration?: number,
): number {
  if (!isHomepageRoute()) return rejectActivation(reason, 'entering');
  if (expectedGeneration !== undefined && expectedGeneration !== generation) {
    return rejectStale(reason, 'entering', expectedGeneration);
  }
  if (phase === 'interactive' || phase === 'entering') return generation;
  if (phase === 'inactive') {
    generation += 1;
    transition('primed', `${reason}:implicit-prime`);
  }
  return transition('entering', reason);
}

export function commitHomepageNavigation(
  reason = 'homepage-interactive',
  expectedGeneration?: number,
): number {
  // Route isolation wins even over a stale lease. This keeps the DOM hidden if
  // unsupported code mutates __ccAppZone without going through AppZoneManager.
  if (!isHomepageRoute()) {
    logger.warn('⚠️ Homepage navigation commit rejected outside Homepage', {
      reason,
      zone: (window as any).__ccAppZone ?? null,
    });
    return transition('inactive', `${reason}:rejected-outside-home`);
  }
  if (expectedGeneration !== undefined && expectedGeneration !== generation) {
    console.warn(TRACE_PREFIX, 'stale-commit-ignored', {
      reason,
      expectedGeneration,
      generation,
      phase,
    });
    return generation;
  }
  return transition('interactive', reason);
}

export function hideHomepageNavigation(reason = 'non-home-surface'): number {
  // Every route release invalidates callbacks holding the previous lease,
  // including repeated non-home transitions while the DOM is already hidden.
  generation += 1;
  return transition('inactive', reason);
}

/** Reapply the state machine; never derive lifecycle state from the DOM. */
export function updateNavigationVisibility(): void {
  applyAuthoritativeState(`reconcile:${lastReason}`);
}

export function getHomepageNavigationLifecycleSnapshot(): Record<string, unknown> {
  return snapshot('manual-snapshot');
}

export function initNavigationControl(): void {
  const nav = document.getElementById('independent-nav') as HTMLElement | null;
  if (!nav) {
    logger.warn('⚠️ Navigation element not found');
    return;
  }

  phase = 'inactive';
  generation += 1;
  applyAuthoritativeState('navigation-control:init', true);

  observer?.disconnect();
  observer = new MutationObserver(() => {
    if (applying || reconcileFrame !== null) return;
    reconcileFrame = requestAnimationFrame(() => {
      reconcileFrame = null;
      applyAuthoritativeState('mutation-reconcile');
    });
  });
  observer.observe(nav, {
    attributes: true,
    attributeFilter: ['hidden', 'style', 'aria-hidden', OWNER_ATTRIBUTE, PHASE_ATTRIBUTE],
    subtree: false,
  });

  (window as any).__ccHomepageNavigationSnapshot = getHomepageNavigationLifecycleSnapshot;
  logger.info('✅ Homepage navigation lifecycle initialized');
}

export function cleanupNavigationControl(): void {
  observer?.disconnect();
  observer = null;
  if (reconcileFrame !== null) cancelAnimationFrame(reconcileFrame);
  reconcileFrame = null;
  logger.info('🧹 Homepage navigation lifecycle cleaned up');
}
