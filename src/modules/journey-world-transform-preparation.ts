import type { TransitionPerformance } from '../utils/transition-performance.js';

const SLICE_BUDGET_MS = 4;

/** The stage owns scheduling/cancellation. This helper owns only a finite
 * write-only transaction; it retains no DOM, timer or GSAP timeline.
 *
 * The Journey renderer and retained-surface owner already know each target's
 * authored inline transform. Explicit getComputedStyle / GSAP transform
 * hydration after an accepted tap forced WebKit to resolve the whole World one
 * node at a time. Apply the caller's known hidden pose first and yield only
 * when real write work consumes the finite slice budget.
 */
export async function prepareJourneyWorldTransforms(options: {
  targets: HTMLElement[];
  isCurrent: () => boolean;
  waitForTurn: () => Promise<boolean>;
  writePose: (target: HTMLElement) => void;
  chunkDurationsMs: number[];
  performance?: TransitionPerformance;
}): Promise<boolean> {
  const { targets, isCurrent, waitForTurn, writePose, chunkDurationsMs } = options;
  const measure = <T>(name: string, work: () => T): T => options.performance
    ? options.performance.phase(name, work, true) : work();
  let index = 0;
  let startedAt = performance.now();
  while (index < targets.length) {
    if (!isCurrent()) return false;
    measure('prime-write-known-poses', () => {
      do {
        writePose(targets[index++]);
      } while (index < targets.length && isCurrent()
        && performance.now() - startedAt < SLICE_BUDGET_MS);
    });
    chunkDurationsMs.push(performance.now() - startedAt);
    if (!isCurrent()) return false;
    if (index < targets.length) {
      if (!await waitForTurn() || !isCurrent()) return false;
      startedAt = performance.now();
    }
  }
  return isCurrent();
}
