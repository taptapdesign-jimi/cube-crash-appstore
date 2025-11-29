import { gsap } from 'gsap';

type TweenLike = gsap.core.Tween | gsap.core.Timeline;

const tweenRegistry = new Map<string, Set<TweenLike>>();

export function registerTween(contextId: string, tween: TweenLike | null | undefined): void {
  if (!contextId || !tween) return;
  const set = tweenRegistry.get(contextId) ?? new Set<TweenLike>();
  set.add(tween);
  tweenRegistry.set(contextId, set);
}

export function deregisterTween(contextId: string, tween: TweenLike | null | undefined): void {
  if (!contextId || !tween) return;
  const set = tweenRegistry.get(contextId);
  if (!set) return;
  set.delete(tween);
  if (set.size === 0) tweenRegistry.delete(contextId);
}

export function killTweensByContext(contextId: string): void {
  if (!contextId) return;
  const set = tweenRegistry.get(contextId);
  if (!set) return;
  set.forEach((tween) => {
    try {
      tween.kill();
    } catch {}
  });
  tweenRegistry.delete(contextId);
}

export function killAllRegisteredTweens(): void {
  tweenRegistry.forEach((set, contextId) => {
    set.forEach((tween) => {
      try {
        tween.kill();
      } catch {}
    });
    tweenRegistry.delete(contextId);
  });
}










