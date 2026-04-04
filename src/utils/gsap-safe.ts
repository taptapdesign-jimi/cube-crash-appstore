// @ts-nocheck
// GSAP safety wrapper: avoid errors when target is null/undefined.
// This prevents "Cannot set properties of null" errors during teardown.

import { gsap } from 'gsap';

const dummyTarget: any = { x: 0, y: 0, scaleX: 1, scaleY: 1 };

const normalizeTarget = (target: any) => {
  if (!target) return null;
  if (Array.isArray(target)) {
    const filtered = target.filter(Boolean);
    return filtered.length ? filtered : null;
  }
  return target;
};

const _to = gsap.to.bind(gsap);
const _from = gsap.from.bind(gsap);
const _fromTo = gsap.fromTo.bind(gsap);

function safeTween(factory: Function, target: any, vars: any, fromVars?: any) {
  const t = normalizeTarget(target);
  if (!t) {
    try {
      if (vars && typeof vars.onComplete === 'function') {
        queueMicrotask(() => {
          try { vars.onComplete(); } catch {}
        });
      }
    } catch {}
    // Return a 0-duration tween on a dummy target to keep callers safe.
    return _to(dummyTarget, { duration: 0 });
  }
  if (factory === _fromTo) {
    return _fromTo(t, fromVars || {}, vars || {});
  }
  return factory(t, vars || {});
}

// Patch GSAP core methods
(gsap as any).to = (target: any, vars: any) => safeTween(_to, target, vars);
(gsap as any).from = (target: any, vars: any) => safeTween(_from, target, vars);
(gsap as any).fromTo = (target: any, fromVars: any, vars: any) => safeTween(_fromTo, target, vars, fromVars);
