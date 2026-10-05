import { gsap } from 'gsap';
import { getJourneyV700MotionProfile } from '../modules/journey-v700-motion.js';
import type { SceneHandle, SceneTransitionContext } from './scene-director.js';

const leases = new WeakMap<HTMLElement, { cancel: () => void }>();

function clearPose(unit: HTMLElement): void {
  unit.style.removeProperty('transform');
  unit.style.removeProperty('opacity');
  unit.style.removeProperty('visibility');
}

// Root visibility belongs to the director. Hidden Home panels are not targets.
function isPresentedUnit(unit: HTMLElement, root: HTMLElement): boolean {
  for (let node: HTMLElement | null = unit; node && node !== root; node = node.parentElement) {
    if (node.hidden) return false;
  }
  return true;
}

/** A fresh finite-motion lease over retained DOM. Unit wrappers have no authored
 * transforms; nested artwork/flip rotors retain their own independent poses. */
export function createScenePresentation(root: HTMLElement, host: HTMLElement): SceneHandle {
  leases.get(root)?.cancel();
  const units = Array.from(root.querySelectorAll<HTMLElement>('[data-jimi-unit]'));
  let timeline: gsap.core.Timeline | undefined;
  let finish: ((error?: unknown) => void) | undefined;
  let motionEpoch = 0;
  let released = false;
  const lease = { cancel: () => settle() };
  const ownsRoot = () => !released && leases.get(root) === lease;
  const settle = (error?: unknown) => {
    motionEpoch++;
    timeline?.kill();
    timeline = undefined;
    const done = finish;
    finish = undefined;
    // Do not use GSAP clearProps: it can hydrate transforms/measure hidden DOM.
    if (ownsRoot()) units.forEach(clearPose);
    done?.(error);
  };
  leases.set(root, lease);

  const move = (enter: boolean, context: SceneTransitionContext): Promise<void> => {
    if (!ownsRoot() || context.signal.aborted || !context.isCurrent()) return Promise.resolve();
    settle();
    const targets = units.filter(unit => isPresentedUnit(unit, root));
    if (!targets.length) return Promise.resolve();
    const profile = getJourneyV700MotionProfile(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const epoch = motionEpoch;
    return new Promise<void>((resolve, reject) => {
      const done = (error?: unknown) => {
        context.signal.removeEventListener('abort', abort);
        finish = undefined;
        if (error === undefined) resolve();
        else reject(error);
      };
      const abort = () => settle();
      finish = done;
      context.signal.addEventListener('abort', abort, { once: true });
      try {
        timeline = gsap.timeline({ onComplete: () => {
          if (epoch !== motionEpoch) return;
          if (!ownsRoot() || context.signal.aborted || !context.isCurrent()) { settle(); return; }
          if (enter) targets.forEach(clearPose);
          // Exit remains collapsed until the director hides it; rollback calls settle.
          done();
        } });
        if (enter) {
          timeline.fromTo(targets,
            { scale: profile.enter.scale, x: 0, y: profile.enter.y, opacity: 0 },
            { scale: 1, x: 0, y: 0, opacity: 1, duration: profile.enter.duration,
              ease: profile.enter.ease, stagger: { amount: profile.cascadeWindow } });
        } else {
          // Explicit identity also resets GSAP's cached pose after direct cleanup.
          timeline.fromTo(targets, { scale: 1, x: 0, y: 0, opacity: 1 },
            { scale: profile.exit.anticipationScale, duration: profile.exit.anticipationDuration, ease: 'power2.in' })
            .to(targets, { scale: 0, duration: profile.exit.duration,
              ease: profile.exit.ease, stagger: { amount: profile.cascadeWindow } });
        }
      } catch (error) { settle(error); }
    });
  };

  root.hidden = true;
  root.inert = true;
  return {
    setVisible(visible) {
      if (!ownsRoot()) return;
      if (visible && root.parentElement !== host) host.append(root);
      root.hidden = !visible;
      root.setAttribute('aria-hidden', String(!visible));
    },
    setInputEnabled(enabled) { if (ownsRoot()) root.inert = !enabled; },
    enter: context => move(true, context),
    exit: context => move(false, context),
    cancelMotion() { if (!released) settle(); },
    dispose() {
      if (released) return;
      settle();
      released = true;
      if (leases.get(root) !== lease) return;
      leases.delete(root);
      root.inert = true;
      root.hidden = true;
      root.remove();
    },
  };
}
