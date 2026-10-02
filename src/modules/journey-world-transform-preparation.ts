import { gsap } from 'gsap';
import type { TransitionPerformance } from '../utils/transition-performance.js';

const SLICE_BUDGET_MS = 4;
const TARGETS_PER_BATCH = 8;

/** The stage owns scheduling/cancellation. This helper owns only a finite
 * read-before-write transaction; it retains no DOM, timer or GSAP timeline.
 * Hydrate CSSPlugin's transform cache before changing ANY pose in a batch.
 * A gsap.set per cold node otherwise alternates computed layout reads with
 * transform/opacity writes across the entire connected World.
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
  for (let index = 0; index < targets.length;) {
    if (!isCurrent() || !await waitForTurn() || !isCurrent()) return false;
    let startedAt = performance.now();
    const first = index;
    const neutralAxes: Array<Array<'translate' | 'rotate' | 'scale'>> = [];
    measure('prime-read-styles', () => {
      do {
        const style = getComputedStyle(targets[index++]);
        // CSSPlugin writes these three longhands even when they are already
        // neutral. Establish only measured neutral axes in a single write
        // batch so its subsequent parser cannot invalidate style per node.
        // Non-neutral authored transforms are left to CSSPlugin unchanged.
        neutralAxes.push((['translate', 'rotate', 'scale'] as const)
          .filter(axis => style[axis] === 'none'));
      } while (index < targets.length && index - first < TARGETS_PER_BATCH
        && isCurrent() && performance.now() - startedAt < SLICE_BUDGET_MS);
    });
    if (!isCurrent()) return false;
    measure('prime-normalize-neutral-axes', () => {
      neutralAxes.forEach((axes, offset) => {
        axes.forEach(axis => { targets[first + offset].style[axis] = 'none'; });
      });
    });
    for (let readIndex = first; readIndex < index; readIndex++) {
      if (!isCurrent()) return false;
      if (performance.now() - startedAt >= SLICE_BUDGET_MS) {
        chunkDurationsMs.push(performance.now() - startedAt);
        if (!await waitForTurn() || !isCurrent()) return false;
        startedAt = performance.now();
      }
      measure('prime-read-transform', () => {
        // Public GSAP API: initializes all transform axes together, preserving
        // authored rotation and percentage translation. No private cache edits.
        gsap.getProperty(targets[readIndex], 'x');
      });
    }
    for (let writeIndex = first; writeIndex < index;) {
      if (!isCurrent()) return false;
      if (performance.now() - startedAt >= SLICE_BUDGET_MS) {
        chunkDurationsMs.push(performance.now() - startedAt);
        if (!await waitForTurn() || !isCurrent()) return false;
        startedAt = performance.now();
      }
      measure('prime-write-poses', () => {
        do {
          writePose(targets[writeIndex++]);
        } while (writeIndex < index && isCurrent()
          && performance.now() - startedAt < SLICE_BUDGET_MS);
      });
    }
    chunkDurationsMs.push(performance.now() - startedAt);
  }
  return isCurrent();
}
