import { createScreenLifecycle } from '../utils/screen-lifecycle.js';
import type { SceneTransitionContext } from './scene-director.js';

const READY_TIMEOUT_MS = 8000;
const readyRoots = new WeakSet<HTMLElement>();
type DecodeBudget = { active: number; queued: Array<() => void>; revision: number };
const budgets = new WeakMap<HTMLElement, DecodeBudget>();

function abortError(): DOMException {
  return new DOMException('Scene image preparation was retired', 'AbortError');
}
function budgetFor(root: HTMLElement): DecodeBudget {
  let budget = budgets.get(root);
  if (!budget) { budget = { active: 0, queued: [], revision: 0 }; budgets.set(root, budget); }
  return budget;
}

/** Required only when a retained scene's image nodes/sources change. */
export function invalidateSceneImageReadiness(root: HTMLElement): void {
  readyRoots.delete(root);
  budgetFor(root).revision += 1;
}

function acquireSlot(budget: DecodeBudget, signal: AbortSignal): Promise<() => void> {
  return new Promise((resolve, reject) => {
    const life = createScreenLifecycle('jimi-image-slot');
    const cancel = () => {
      const index = budget.queued.indexOf(grant);
      if (index >= 0) budget.queued.splice(index, 1);
      life.cleanup(); reject(signal.reason ?? abortError());
    };
    const grant = () => {
      if (signal.aborted) { cancel(); return; }
      budget.active += 1;
      life.cleanup();
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        budget.active -= 1;
        budget.queued.shift()?.();
      });
    };
    if (signal.aborted) { cancel(); return; }
    life.trackListener(signal, 'abort', cancel, { once: true });
    if (budget.active < 2) grant(); else budget.queued.push(grant);
  });
}

function loadWithoutDecode(image: HTMLImageElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const life = createScreenLifecycle('jimi-image-load');
    const finish = (error?: unknown) => { life.cleanup(); if (error) reject(error); else resolve(); };
    const loaded = () => finish(image.naturalWidth > 0 ? undefined : new Error(`Image has no pixels: ${image.src}`));
    if (signal.aborted) { finish(signal.reason ?? abortError()); return; }
    if (image.complete) { loaded(); return; }
    life.trackListener(image, 'load', loaded, { once: true });
    life.trackListener(image, 'error', () => finish(new Error(`Image failed: ${image.src}`)), { once: true });
    life.trackListener(signal, 'abort', () => finish(signal.reason ?? abortError()), { once: true });
  });
}

function rejectOnAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const life = createScreenLifecycle('jimi-image-await');
    const cancel = () => { life.cleanup(); reject(signal.reason ?? abortError()); };
    if (signal.aborted) { cancel(); void work.catch(() => {}); return; }
    life.trackListener(signal, 'abort', cancel, { once: true });
    void work.then(value => { life.cleanup(); resolve(value); }, error => { life.cleanup(); reject(error); });
  });
}

/** Readiness of actual displayed image nodes, not a separate source-loader cache.
 * Includes all Home panels so changing tabs cannot reveal an unprepared hero.
 * An immutable ready root returns without walking its descendants again. */
export async function prepareSceneImages(root: HTMLElement, context: SceneTransitionContext): Promise<void> {
  if (context.signal.aborted || !context.isCurrent()) throw abortError();
  if (readyRoots.has(root)) return;
  const budget = budgetFor(root);
  const revision = budget.revision;
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  const life = createScreenLifecycle('jimi-scene-images');
  const controller = new AbortController();
  const signal = controller.signal;
  const isCurrent = () => !signal.aborted && !context.signal.aborted
    && context.isCurrent() && budget.revision === revision;
  const checkCurrent = () => { if (!isCurrent()) throw signal.reason ?? abortError(); };
  life.trackListener(context.signal, 'abort', () => controller.abort(abortError()), { once: true });
  life.trackTimeout(() => controller.abort(new Error('Scene image preparation timed out after 8000ms')), READY_TIMEOUT_MS);
  let cursor = 0;
  const worker = async () => {
    while (cursor < images.length) {
      checkCurrent();
      const image = images[cursor++];
      const release = await acquireSlot(budget, signal);
      try { checkCurrent(); } catch (error) { release(); throw error; }
      const signature = `${image.src}|${image.srcset}|${image.sizes}`;
      // Browser decode cannot be cancelled. Keep its slot until it actually
      // settles, even if this attempt returns early after navigation/timeout.
      const decode = Promise.resolve().then(() => typeof image.decode === 'function'
        ? image.decode() : loadWithoutDecode(image, signal)).then(() => {
        if (!image.complete || image.naturalWidth <= 0) throw new Error(`Image has no pixels: ${image.src}`);
        if (signature !== `${image.src}|${image.srcset}|${image.sizes}`) throw new Error('Image source changed during preparation');
      }).finally(release);
      await rejectOnAbort(decode, signal);
      checkCurrent();
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(2, images.length) }, worker));
    checkCurrent();
    readyRoots.add(root);
  } finally {
    controller.abort(abortError());
    life.cleanup();
  }
}
