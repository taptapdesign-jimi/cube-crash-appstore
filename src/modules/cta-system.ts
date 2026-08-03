import { gsap } from 'gsap';
import animationManager from './animation-manager.js';

export type CtaVariant = 'primary' | 'secondary';
export type CtaLayout = 'phone' | 'tablet';

export interface CtaController {
  readonly element: HTMLButtonElement;
  prime(state: 'hidden' | 'idle'): void;
  enter(options?: { delay?: number }): Promise<void>;
  exit(options?: { delay?: number }): Promise<void>;
  setDisabled(disabled: boolean): void;
  dispose(): void;
}

interface RegisterCtaOptions {
  variant: CtaVariant;
  onActivate?: () => void | Promise<void>;
  initialState?: 'hidden' | 'idle';
  activationTiming?: 'after-release' | 'immediate';
  activateOnCapturedRelease?: boolean;
}

export interface CtaMotionProfile {
  enterDuration: number;
  exitDuration: number;
  pressDuration: number;
  releaseDuration: number;
  companionExitStaggerMs: number;
  enterEase: string;
  exitEase: string;
  releaseEase: string;
  pressScale: number;
  pressOffsetY: number;
}

export const CTA_MOTION_DEFAULTS: Readonly<CtaMotionProfile> = Object.freeze({
  enterDuration: 0.34,
  exitDuration: 0.31,
  pressDuration: 0.12,
  releaseDuration: 0.26,
  companionExitStaggerMs: 70,
  enterEase: 'back.out(1.8)',
  exitEase: 'back.in(1.75)',
  releaseEase: 'back.out(2.1)',
  pressScale: 0.84,
  pressOffsetY: 4,
});

export const ctaMotion: CtaMotionProfile = { ...CTA_MOTION_DEFAULTS };

export function configureCtaMotion(overrides: Partial<CtaMotionProfile>): void {
  Object.assign(ctaMotion, overrides);
}

export function resetCtaMotion(): void {
  Object.assign(ctaMotion, CTA_MOTION_DEFAULTS);
}

const controllers = new WeakMap<HTMLButtonElement, CtaController>();

function trackTween(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
  return animationManager.trackExternalTween(gsap.to(target, vars));
}

function ensureVisual(element: HTMLButtonElement): HTMLElement {
  const existing = element.querySelector<HTMLElement>(':scope > .cc-cta__visual');
  if (existing) return existing;

  const visual = document.createElement('span');
  visual.className = 'cc-cta__visual';
  while (element.firstChild) visual.appendChild(element.firstChild);
  element.appendChild(visual);
  return visual;
}

export function registerCta(element: HTMLButtonElement, options: RegisterCtaOptions): CtaController {
  controllers.get(element)?.dispose();

  const visual = ensureVisual(element);
  const abortController = new AbortController();
  let disposed = false;
  let exiting = false;
  let activating = false;
  let pointerId: number | null = null;
  let pendingResolve: (() => void) | null = null;

  element.classList.add('cc-cta');
  element.dataset.ctaVariant = options.variant;
  element.dataset.ctaState = options.initialState ?? 'idle';

  const settlePending = () => {
    pendingResolve?.();
    pendingResolve = null;
  };

  const killMotion = () => {
    gsap.killTweensOf(visual);
    settlePending();
  };

  const animateTo = (vars: gsap.TweenVars): Promise<void> => {
    killMotion();
    return new Promise(resolve => {
      pendingResolve = resolve;
      trackTween(visual, {
        ...vars,
        overwrite: 'auto',
        force3D: true,
        onComplete: () => {
          pendingResolve = null;
          resolve();
        },
        onInterrupt: () => {
          pendingResolve = null;
          resolve();
        },
      });
    });
  };

  const release = (): Promise<void> => {
    pointerId = null;
    if (disposed || exiting || element.disabled) return Promise.resolve();
    element.dataset.ctaState = 'idle';
    return animateTo({ scale: 1, y: 0, duration: ctaMotion.releaseDuration, ease: ctaMotion.releaseEase });
  };

  const activateAfterRelease = async (withKeyboardPress = false): Promise<void> => {
    if (activating || exiting || element.disabled || !options.onActivate) return;
    activating = true;
    try {
      let immediateActivation: void | Promise<void> = undefined;
      if (options.activationTiming === 'immediate') {
        // Permission-gated APIs (notably iOS DeviceOrientation) must be called
        // synchronously from the trusted activation event, before any await.
        immediateActivation = options.onActivate();
        // The activation may synchronously hand ownership to a screen exit.
        // Do not start a synthetic keyboard press over that new exit tween.
        if (disposed || exiting || element.disabled) {
          await immediateActivation;
          return;
        }
      }
      if (withKeyboardPress) {
        element.dataset.ctaState = 'pressed';
        await animateTo({ scale: ctaMotion.pressScale, y: ctaMotion.pressOffsetY, duration: ctaMotion.pressDuration, ease: 'power2.out' });
      }
      await release();
      if (options.activationTiming === 'immediate') {
        await immediateActivation;
      } else if (!disposed && !exiting && !element.disabled) {
        await options.onActivate();
      }
    } finally {
      activating = false;
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (disposed || exiting || element.disabled || event.button !== 0) return;
    event.stopPropagation();
    pointerId = event.pointerId;
    try { element.setPointerCapture(event.pointerId); } catch {}
    element.dataset.ctaState = 'pressed';
    void animateTo({ scale: ctaMotion.pressScale, y: ctaMotion.pressOffsetY, duration: ctaMotion.pressDuration, ease: 'power2.out' });
  };

  const onPointerUp = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    event.stopPropagation();
    const rect = element.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside && !options.activateOnCapturedRelease) {
      void release();
      return;
    }
    void activateAfterRelease();
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    void release();
  };

  const onClick = (event: MouseEvent) => {
    if (event.detail !== 0 || activating || exiting || element.disabled || !options.onActivate) return;
    event.stopPropagation();
    void activateAfterRelease(true);
  };

  element.addEventListener('pointerdown', onPointerDown, { signal: abortController.signal });
  element.addEventListener('pointerup', onPointerUp, { signal: abortController.signal });
  element.addEventListener('pointercancel', onPointerCancel, { signal: abortController.signal });
  // WKWebView may emit lostpointercapture while the finger is still down.
  // Treat only a real pointerup/pointercancel as release, and observe both at
  // window level so the gesture still settles if capture is lost off-element.
  window.addEventListener('pointerup', onPointerUp, { signal: abortController.signal });
  window.addEventListener('pointercancel', onPointerCancel, { signal: abortController.signal });
  element.addEventListener('click', onClick, { signal: abortController.signal });

  if ((options.initialState ?? 'idle') === 'hidden') {
    gsap.set(visual, { scale: 0, y: 18, opacity: 0, transformOrigin: '50% 50%' });
    element.style.visibility = 'hidden';
    element.style.pointerEvents = 'none';
  } else {
    gsap.set(visual, { scale: 1, y: 0, opacity: 1, transformOrigin: '50% 50%' });
  }

  const controller: CtaController = {
    element,
    prime(state) {
      if (disposed) return;
      killMotion();
      exiting = false;
      activating = false;
      pointerId = null;
      element.disabled = false;
      element.dataset.ctaState = state;
      if (state === 'hidden') {
        gsap.set(visual, { scale: 0, y: 18, opacity: 0, transformOrigin: '50% 50%' });
        element.style.visibility = 'hidden';
        element.style.pointerEvents = 'none';
      } else {
        gsap.set(visual, { scale: 1, y: 0, opacity: 1, transformOrigin: '50% 50%' });
        element.style.visibility = 'visible';
        element.style.pointerEvents = 'auto';
      }
    },
    async enter({ delay = 0 } = {}) {
      if (disposed) return;
      exiting = false;
      element.disabled = false;
      element.style.visibility = 'visible';
      element.style.pointerEvents = 'auto';
      element.dataset.ctaState = 'entering';
      await animateTo({ scale: 1, y: 0, opacity: 1, delay, duration: ctaMotion.enterDuration, ease: ctaMotion.enterEase });
      if (!disposed && !exiting) element.dataset.ctaState = 'idle';
    },
    async exit({ delay = 0 } = {}) {
      if (disposed) return;
      exiting = true;
      element.dataset.ctaState = 'exiting';
      element.disabled = true;
      element.blur();
      element.style.pointerEvents = 'none';
      await animateTo({ scale: 0, y: 18, opacity: 0, delay, duration: ctaMotion.exitDuration, ease: ctaMotion.exitEase });
      if (!disposed) {
        element.dataset.ctaState = 'hidden';
        element.style.visibility = 'hidden';
      }
    },
    setDisabled(disabled) {
      if (disposed) return;
      element.disabled = disabled;
      element.setAttribute('aria-disabled', String(disabled));
      if (disabled) void release();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      exiting = true;
      abortController.abort();
      killMotion();
      element.classList.remove('cc-cta');
      delete element.dataset.ctaVariant;
      delete element.dataset.ctaState;
      controllers.delete(element);
    },
  };

  controllers.set(element, controller);
  return controller;
}

export function getRegisteredCta(element: HTMLButtonElement): CtaController | null {
  return controllers.get(element) ?? null;
}

export async function exitCtaPair(
  clicked: HTMLButtonElement,
  companion?: HTMLButtonElement | null,
): Promise<void> {
  await exitCtaGroup(clicked, companion ? [companion] : []);
}

export async function exitCtaGroup(
  clicked: HTMLButtonElement,
  companions: Array<HTMLButtonElement | null | undefined> = [],
): Promise<void> {
  const ordered = [clicked, ...companions]
    .filter((button): button is HTMLButtonElement => button instanceof HTMLButtonElement)
    .filter((button, index, buttons) => buttons.indexOf(button) === index);

  await Promise.all(ordered.map((button, index) => (
    getRegisteredCta(button)?.exit({
      delay: (ctaMotion.companionExitStaggerMs * index) / 1000,
    }) ?? Promise.resolve()
  )));
}
