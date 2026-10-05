import { createScreenLifecycle } from '../utils/screen-lifecycle.js';
import { createBeachSceneAssembly } from './scene-builders.js';
import type { JimiProgressSnapshot } from './scene-catalog.js';
import type { SceneTransitionContext } from './scene-director.js';

const cancelled = () => new DOMException('Beach assembly cancelled', 'AbortError');
export type MeasureBeachAssemblyChunk = (index: number, work: () => boolean) => boolean;

/** Cold, selected Beach only. Returns complete detached DOM; the caller alone
 * publishes it to the retained cache and prepares its images before reveal.
 * One task per complete Unit avoids one long synchronous build. A task yield
 * is not a promise that the browser paints between every two chunks.
 */
export function buildBeachSceneIncrementally(
  progress: JimiProgressSnapshot,
  context: SceneTransitionContext,
  measureChunk?: MeasureBeachAssemblyChunk,
): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    if (context.signal.aborted || !context.isCurrent()) { reject(cancelled()); return; }
    const assembly = createBeachSceneAssembly(progress);
    const life = createScreenLifecycle('jimi-beach-assembly');
    let settled = false;
    let index = 0;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      life.cleanup();
      if (error !== undefined) {
        // Never published or mounted: release partial nodes, without rewriting
        // image sources or attempting to cancel browser-owned image requests.
        assembly.root.replaceChildren();
        reject(error);
      } else resolve(assembly.root);
    };
    const abort = () => finish(cancelled());
    const schedule = () => {
      life.trackTimeout(() => {
        if (settled) return;
        try {
          if (context.signal.aborted || !context.isCurrent()) { abort(); return; }
          // Optional caller-owned synchronous instrumentation: index0 is main,
          // indices1–10 are board Units. No internal logging or extra clock.
          const complete = measureChunk ? measureChunk(index, assembly.appendNext) : assembly.appendNext();
          index++;
          if (context.signal.aborted || !context.isCurrent()) { abort(); return; }
          if (complete) finish();
          else schedule();
        } catch (error) { finish(error); }
      }, 0);
    };
    life.trackListener(context.signal, 'abort', abort, { once: true });
    // Even the main Unit is yielded, allowing outgoing motion to begin first.
    schedule();
  });
}
