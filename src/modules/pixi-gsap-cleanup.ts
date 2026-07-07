type GsapLike = {
  killTweensOf?: (target: any) => void;
  globalTimeline?: {
    getChildren?: (...args: any[]) => any[];
    resume?: () => void;
  };
};

function killTarget(gsap: GsapLike, target: any): void {
  if (!target) return;
  try { gsap.killTweensOf?.(target); } catch {}
}

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

export function killPixiGsapSubtree(gsap: GsapLike, root: any): void {
  if (!root) return;

  const visit = (node: any): void => {
    if (!node) return;

    killTarget(gsap, node);
    killTarget(gsap, node.position);
    killTarget(gsap, node.scale);
    killTarget(gsap, node.pivot);
    killTarget(gsap, node.skew);
    killTarget(gsap, node.anchor);
    killTarget(gsap, node.alpha);
    killTarget(gsap, node.rotation);

    const children = Array.isArray(node.children) ? [...node.children] : [];
    children.forEach(visit);
  };

  visit(root);
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
