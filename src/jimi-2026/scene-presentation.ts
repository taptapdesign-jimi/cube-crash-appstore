import { gsap } from 'gsap';
import { getJourneyV700MotionProfile } from '../modules/journey-v700-motion.js';
import type { SceneHandle, SceneTransitionContext } from './scene-director.js';

const leases = new WeakMap<HTMLElement, { cancel: () => void }>();
type NumericPose = { scale: number; x: number; y: number; opacity: number };

export interface ScenePresentationOptions {
  /** Sample a fresh viewport policy once per motion, never per animation tick.
   * Omitted policy animates every presented Unit. Nonadmitted Units remain
   * mounted at their authored static pose; a presented header is always admitted. */
  getAdmittedUnitIds?: (motion: 'enter' | 'exit') => ReadonlySet<string>;
}

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
export function createScenePresentation(root: HTMLElement, host: HTMLElement, options: ScenePresentationOptions = {}): SceneHandle {
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
    const admittedIds = options.getAdmittedUnitIds?.(enter ? 'enter' : 'exit');
    const targets = units.filter(unit => isPresentedUnit(unit, root)
      && (!admittedIds || unit.dataset.jimiUnit === 'header' || admittedIds.has(unit.dataset.jimiUnit ?? '')));
    if (!targets.length) return Promise.resolve();
    const profile = getJourneyV700MotionProfile(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const epoch = motionEpoch;
    // GSAP receives only these plain numeric objects, never a DOM target. The
    // presentation lease alone writes styles, so CSSPlugin cannot hydrate Unit
    // transforms or read layout while constructing the transition.
    const poses: NumericPose[] = targets.map(() => ({
      scale: enter ? profile.enter.scale : 1,
      x: 0,
      y: enter ? profile.enter.y : 0,
      opacity: enter ? 0 : 1,
    }));
    const lastTransforms: Array<string | undefined> = targets.map(() => undefined);
    const lastOpacities: Array<string | undefined> = targets.map(() => undefined);
    const writePoses = () => {
      for (let index = 0; index < targets.length; index++) {
        const pose = poses[index];
        const transform = `translate3d(${pose.x}px, ${pose.y}px, 0px) scale(${pose.scale})`;
        const opacity = String(Math.max(0, Math.min(1, pose.opacity)));
        if (lastTransforms[index] !== transform) {
          targets[index].style.transform = transform;
          lastTransforms[index] = transform;
        }
        if (lastOpacities[index] !== opacity) {
          targets[index].style.opacity = opacity;
          lastOpacities[index] = opacity;
        }
      }
    };
    return new Promise<void>((resolve, reject) => {
      let completed = false;
      const done = (error?: unknown) => {
        completed = true;
        context.signal.removeEventListener('abort', abort);
        finish = undefined;
        if (error === undefined) resolve();
        else reject(error);
      };
      const abort = () => settle();
      finish = done;
      context.signal.addEventListener('abort', abort, { once: true });
      try {
        // Prime delayed Units in the same task as reveal, before the first tick.
        writePoses();
        const update = () => {
          if (completed || epoch !== motionEpoch) return;
          if (!ownsRoot() || context.signal.aborted || !context.isCurrent()) { settle(); return; }
          try { writePoses(); } catch (error) { settle(error); }
        };
        timeline = gsap.timeline({
          onUpdate: update,
          onComplete: () => {
            if (completed || epoch !== motionEpoch) return;
            if (!ownsRoot() || context.signal.aborted || !context.isCurrent()) { settle(); return; }
            try {
              writePoses();
              if (enter) targets.forEach(clearPose);
              // Exit stays collapsed until director hide; rollback calls settle.
              done();
            } catch (error) { settle(error); }
          },
        });
        if (enter) {
          timeline.fromTo(poses,
            { scale: profile.enter.scale, x: 0, y: profile.enter.y, opacity: 0 },
            { scale: 1, x: 0, y: 0, opacity: 1, duration: profile.enter.duration,
              ease: profile.enter.ease, stagger: { amount: profile.cascadeWindow } });
        } else {
          timeline.fromTo(poses, { scale: 1, x: 0, y: 0, opacity: 1 },
            { scale: profile.exit.anticipationScale, duration: profile.exit.anticipationDuration, ease: 'power2.in' })
            .to(poses, { scale: 0, duration: profile.exit.duration,
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
