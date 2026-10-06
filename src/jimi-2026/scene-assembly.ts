import { createScreenLifecycle } from '../utils/screen-lifecycle.js';
import { createBeachSceneAssembly, createHubSceneAssembly, type SceneAssembly } from './scene-builders.js';
import type { JimiProgressSnapshot } from './scene-catalog.js';
import type { SceneTransitionContext } from './scene-director.js';

export type MeasureSceneAssemblyChunk = (index: number, work: () => boolean) => boolean;
/** Compatibility for the original Beach-only instrumentation signature. */
export type MeasureBeachAssemblyChunk = MeasureSceneAssemblyChunk;

/** Cold, selected scene only. Returns complete detached DOM; the caller alone
 * publishes it to the retained cache and prepares its images before reveal.
 * One task per complete Unit avoids one long synchronous build. A task yield
 * is not a promise that the browser paints between every two chunks.
 */
function assembleScene(
  name: 'hub' | 'beach',
  createAssembly: () => SceneAssembly,
  context: SceneTransitionContext,
  measureChunk?: MeasureSceneAssemblyChunk,
): Promise<HTMLElement> {
  const cancelled = () => new DOMException(`${name} assembly cancelled`, 'AbortError');
  return new Promise((resolve, reject) => {
    if (context.signal.aborted || !context.isCurrent()) { reject(cancelled()); return; }
    const assembly = createAssembly();
    const life = createScreenLifecycle(`jimi-${name}-assembly`);
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
          // Optional caller-owned instrumentation of the next authored Unit.
          // No internal logging, extra completion task or independent clock.
          const complete = measureChunk ? measureChunk(index, assembly.appendNext) : assembly.appendNext();
          index++;
          if (context.signal.aborted || !context.isCurrent()) { abort(); return; }
          if (complete) finish();
          else schedule();
        } catch (error) { finish(error); }
      }, 0);
    };
    life.trackListener(context.signal, 'abort', abort, { once: true });
    // Even the first Unit is yielded, allowing outgoing motion to begin first.
    schedule();
  });
}

/** Three Hub artwork Units, in canonical Forest / Area55 / Beach order. */
export function buildHubSceneIncrementally(
  progress: JimiProgressSnapshot,
  context: SceneTransitionContext,
  measureChunk?: MeasureSceneAssemblyChunk,
): Promise<HTMLElement> {
  return assembleScene('hub', () => createHubSceneAssembly(progress), context, measureChunk);
}

/** Beach main artwork followed by its ten board Units. */
export function buildBeachSceneIncrementally(
  progress: JimiProgressSnapshot,
  context: SceneTransitionContext,
  measureChunk?: MeasureBeachAssemblyChunk,
): Promise<HTMLElement> {
  return assembleScene('beach', () => createBeachSceneAssembly(progress), context, measureChunk);
}
