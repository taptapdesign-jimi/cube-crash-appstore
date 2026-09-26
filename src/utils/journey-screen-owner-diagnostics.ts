/** Diagnostic-only metadata reads at the soak resource cadence, never per frame.
 * No geometry/computed-style reads, owner imports, observers, or animation writes.
 * getAnimations() can still ask WebKit to update animation/style state; report
 * collection time rather than claiming this snapshot has zero measurement cost.
 */
const ROOT_SELECTOR = '#journey-screen, #journey-boards-container, #journey-card-overlay-modal, .journey-card-return-reminder';
const MAX_ROOT_DETAILS = 8;
const MAX_CANVAS_DETAILS = 8;
const MAX_LABEL_LENGTH = 320;

interface GsapDiagnosticAnimation {
  repeat?(): number;
  paused?(): boolean;
  isActive?(): boolean;
  targets?(): unknown[];
  getChildren?(nested: boolean, tweens: boolean, timelines: boolean): GsapDiagnosticAnimation[];
}

const label = (value: string | null | undefined): string | null => value == null
  ? null : value.slice(0, MAX_LABEL_LENGTH);

export function getJourneyScreenOwnerDiagnostics() {
  const startedAt = performance.now();
  let readErrors = 0;
  const roots = Array.from(document.querySelectorAll<HTMLElement>(ROOT_SELECTOR));
  const container = document.getElementById('journey-boards-container');
  const belongsToJourney = (target: unknown): boolean => target instanceof Element
    && roots.some(root => root === target || root.contains(target));
  // Nested screen/container scopes must not double-count the same animation.
  const animationRoots = roots.filter(root => !roots.some(other => other !== root && other.contains(root)));
  const animations = new Set<Animation>();
  let availableAnimationRoots = 0;
  for (const root of animationRoots) {
    if (typeof root.getAnimations !== 'function') continue;
    try {
      for (const animation of root.getAnimations({ subtree: true })) animations.add(animation);
      availableAnimationRoots++;
    } catch { readErrors++; }
  }
  let runningInfiniteCss = 0;
  let runningInfiniteOther = 0;
  for (const animation of animations) {
    try {
      if (animation.playState !== 'running' || animation.playbackRate === 0
        || animation.effect?.getTiming().iterations !== Infinity) continue;
      if ('animationName' in animation) runningInfiniteCss++;
      else runningInfiniteOther++;
    } catch { readErrors++; }
  }

  let gsapAvailable = false;
  let gsapExamined = 0;
  let runningInfiniteTweens = 0;
  let runningInfiniteTimelines = 0;
  try {
    const gsap = (window as Window & {
      gsap?: { globalTimeline?: GsapDiagnosticAnimation };
    }).gsap;
    if (gsap?.globalTimeline?.getChildren) {
      gsapAvailable = true;
      const children = gsap.globalTimeline.getChildren(true, true, true);
      gsapExamined = children.length;
      for (const animation of children) {
        try {
          if (animation.repeat?.() !== -1 || animation.paused?.() || !animation.isActive?.()) continue;
          if (animation.targets) {
            if (animation.targets().some(belongsToJourney)) runningInfiniteTweens++;
          } else if (animation.getChildren?.(true, true, false)
            .some(child => child.targets?.().some(belongsToJourney))) {
            // A repeating timeline can contain only finite tweens. Keep its
            // owner separate; counting repeat:-1 tweens alone misses it.
            runningInfiniteTimelines++;
          }
        } catch { readErrors++; }
      }
    }
  } catch { readErrors++; }

  const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>(
    'canvas[data-journey-ambient-canvas-depth]',
  ));
  return {
    rootCount: roots.length,
    roots: roots.slice(0, MAX_ROOT_DETAILS).map(root => ({
      owner: root.id || 'journey-card-return-reminder',
      classes: label(root.className),
      hidden: root.hidden,
      ariaHidden: root.getAttribute('aria-hidden'),
      inlineDisplay: root.style.display,
      inlineVisibility: root.style.visibility,
      inlineOpacity: root.style.opacity,
    })),
    runtime: {
      view: label(container?.dataset.journeyV700View),
      worldId: label(container?.dataset.journeyV700WorldId),
      state: label(container?.dataset.journeyWorldRuntimeState),
      idleAdmittedElements: document.querySelectorAll('.journey-world-idle-active').length,
    },
    ambient: {
      // Presence/backing pixels are residency, not proof that a ticker paints.
      canvases: canvases.length,
      bitmapPixels: canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0),
      details: canvases.slice(0, MAX_CANVAS_DETAILS).map(canvas => ({
        classes: label(canvas.className),
        depth: label(canvas.dataset.journeyAmbientCanvasDepth),
        width: canvas.width,
        height: canvas.height,
        inlineWillChange: canvas.style.willChange,
      })),
    },
    webAnimations: {
      scopeRoots: animationRoots.length,
      availableRoots: availableAnimationRoots,
      examined: animations.size,
      runningInfiniteCss,
      runningInfiniteOther,
    },
    gsap: { available: gsapAvailable, examined: gsapExamined, runningInfiniteTweens, runningInfiniteTimelines },
    readErrors,
    collectionMs: Math.round(Math.max(0, performance.now() - startedAt) * 100) / 100,
  };
}
