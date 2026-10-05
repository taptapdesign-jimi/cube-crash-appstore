type GsapLike = {
  killTweensOf?: (target: any) => void;
  globalTimeline?: {
    getChildren?: (...args: any[]) => any[];
    resume?: () => void;
  };
};

function isInvalidPixiTarget(target: any): boolean {
  if (!target || typeof target !== 'object') return false;
  if (target.destroyed === true) return true;
  // Pixi v8 nulls internal transform points on destroy. GSAP then crashes when
  // it lazily initializes a tween and reads Container.x/y getters.
  if ('_position' in target && target._position == null) return true;
  if ('_scale' in target && target._scale == null) return true;
  if ('_pivot' in target && target._pivot == null) return true;
  return false;
}

/** Retire an exact owner set with one GSAP timeline traversal, not one per point. */
export function killPixiGsapSubtrees(
  gsap: GsapLike,
  roots: readonly any[],
  extraTargets: readonly any[] = [],
): void {
  const targets = new Set<object>();
  const visited = new Set<object>();
  const add = (target: any): void => {
    if (target && (typeof target === 'object' || typeof target === 'function')) targets.add(target);
  };
  const pending = [...roots];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== 'object' || visited.has(node)) continue;
    visited.add(node);
    add(node);
    for (const key of ['position', 'scale', 'pivot', 'skew', 'anchor', 'alpha', 'rotation']) {
      // A destroyed Pixi getter must not prevent retirement of the other owners.
      try { add(node[key]); } catch {}
    }
    try {
      if (Array.isArray(node.children)) pending.push(...node.children);
    } catch {}
  }
  extraTargets.forEach(add);
  if (targets.size) {
    try { gsap.killTweensOf?.([...targets]); } catch {}
  }
}

/** Existing single-surface owners retain their exact cleanup boundary. */
export function killPixiGsapSubtree(gsap: GsapLike, root: any): void {
  killPixiGsapSubtrees(gsap, [root]);
}

export function killInvalidPixiGsapTweens(gsap: GsapLike): void {
  try {
    const children = gsap.globalTimeline?.getChildren?.(true, true, true) || [];
    children.forEach((tween: any) => {
      try {
        if (!tween || typeof tween.kill !== 'function') return;
        const targets =
          typeof tween.targets === 'function'
            ? tween.targets()
            : Array.isArray(tween.targets)
              ? tween.targets
              : [];
        if (targets.some(isInvalidPixiTarget)) tween.kill();
      } catch {
        try { tween?.kill?.(); } catch {}
      }
    });
  } catch {}
}

const GAME_DOM_TWEEN_SELECTORS = [
  '[data-wild-loader]',
  '.wild-loader',
  '#cc-board-transition-overlay',
  '#cc-tnt-animation-overlay',
  '.cc-no-moves-overlay',
];

export function killGameDomGsapTweens(gsap: GsapLike): void {
  GAME_DOM_TWEEN_SELECTORS.forEach((selector) => {
    try { gsap.killTweensOf?.(selector); } catch {}
  });
}
