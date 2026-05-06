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
const _set = gsap.set.bind(gsap);

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

function safeSet(target: any, vars: any) {
  const t = normalizeTarget(target);
  if (!t) return;
  try {
    return _set(t, vars || {});
  } catch {
    return;
  }
}

function installTimelineGuards() {
  const timelineProto = (gsap as any).core?.Timeline?.prototype;
  if (!timelineProto || timelineProto.__ccSafeTimelineGuardsInstalled) return;
  timelineProto.__ccSafeTimelineGuardsInstalled = true;

  const rawTo = timelineProto.to;
  const rawFrom = timelineProto.from;
  const rawFromTo = timelineProto.fromTo;
  const rawSet = timelineProto.set;

  timelineProto.to = function(target: any, vars: any, position?: any) {
    const t = normalizeTarget(target);
    if (!t) return this;
    try {
      return rawTo.call(this, t, vars || {}, position);
    } catch {
      return this;
    }
  };

  timelineProto.from = function(target: any, vars: any, position?: any) {
    const t = normalizeTarget(target);
    if (!t) return this;
    try {
      return rawFrom.call(this, t, vars || {}, position);
    } catch {
      return this;
    }
  };

  timelineProto.fromTo = function(target: any, fromVars: any, vars: any, position?: any) {
    const t = normalizeTarget(target);
    if (!t) return this;
    try {
      return rawFromTo.call(this, t, fromVars || {}, vars || {}, position);
    } catch {
      return this;
    }
  };

  timelineProto.set = function(target: any, vars: any, position?: any) {
    const t = normalizeTarget(target);
    if (!t) return this;
    try {
      return rawSet.call(this, t, vars || {}, position);
    } catch {
      return this;
    }
  };
}

// Patch GSAP core methods
(gsap as any).to = (target: any, vars: any) => safeTween(_to, target, vars);
(gsap as any).from = (target: any, vars: any) => safeTween(_from, target, vars);
(gsap as any).fromTo = (target: any, fromVars: any, vars: any) => safeTween(_fromTo, target, vars, fromVars);
(gsap as any).set = (target: any, vars: any) => safeSet(target, vars);

installTimelineGuards();
