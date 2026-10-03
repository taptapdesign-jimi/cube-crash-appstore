import { createScreenLifecycle } from '../utils/screen-lifecycle.js';

export type ForegroundResourceCriticalOwner =
  | 'journey-card'
  | 'journey-transition'
  | 'gameplay-entry'
  | 'gameplay-exit'
  | 'result-transition'
  | 'renderer-recovery';

export type ForegroundResourceCoordinatorSnapshot = Readonly<{
  criticalDepth: number;
  criticalOwners: readonly ForegroundResourceCriticalOwner[];
  deferredTaskCount: number;
}>;

type DeferredTask = {
  key: string;
  run: () => void;
};

let nextLeaseId = 0;
const criticalLeases = new Map<number, ForegroundResourceCriticalOwner>();
const deferredTasks = new Map<string, DeferredTask>();
const idleSubscribers = new Set<() => void>();
const deferredFlushLifecycle = createScreenLifecycle('foreground-resource-coordinator');
let deferredFlushScheduled = false;

function scheduleNextDeferredTask(): void {
  if (criticalLeases.size > 0 || deferredTasks.size === 0 || deferredFlushScheduled) return;
  const runOne = () => {
    deferredFlushScheduled = false;
    if (criticalLeases.size > 0) return;
    const task = deferredTasks.values().next().value as DeferredTask | undefined;
    if (!task) return;
    if (deferredTasks.get(task.key) === task) deferredTasks.delete(task.key);
    try { task.run(); } catch {}
    scheduleNextDeferredTask();
  };
  if (typeof requestAnimationFrame === 'function' && typeof document !== 'undefined' && !document.hidden) {
    deferredFlushScheduled = true;
    deferredFlushLifecycle.trackRaf(runOne);
  } else {
    deferredFlushScheduled = true;
    deferredFlushLifecycle.trackTimeout(runOne, 16);
  }
}

function notifyForegroundIdle(): void {
  if (criticalLeases.size > 0) return;
  idleSubscribers.forEach((subscriber) => {
    try { subscriber(); } catch {}
  });
  scheduleNextDeferredTask();
}

/**
 * Marks a player-visible presentation window. The release is idempotent so
 * normal completion, interruption and hard cleanup can share it safely.
 */
export function acquireForegroundResourceCriticalLease(
  owner: ForegroundResourceCriticalOwner,
): () => void {
  const leaseId = ++nextLeaseId;
  criticalLeases.set(leaseId, owner);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    criticalLeases.delete(leaseId);
    notifyForegroundIdle();
  };
}

export function isForegroundResourceCritical(): boolean {
  return criticalLeases.size > 0;
}

/**
 * Deduplicates non-critical cache/GPU work by semantic key. If the foreground
 * is idle the task runs immediately; otherwise it runs once after the final
 * critical owner releases. The returned cancellation is idempotent.
 */
export function deferUntilForegroundResourceIdle(key: string, run: () => void): () => void {
  if (!key) throw new Error('Foreground deferred work requires a stable key.');
  if (!isForegroundResourceCritical()) {
    run();
    return () => {};
  }
  const task: DeferredTask = { key, run };
  deferredTasks.set(key, task);
  let cancelled = false;
  return () => {
    if (cancelled) return;
    cancelled = true;
    if (deferredTasks.get(key) === task) deferredTasks.delete(key);
  };
}

export function cancelDeferredForegroundResourceTask(key: string): void {
  deferredTasks.delete(key);
}

/** One process-lifetime subscription is used by shared schedulers to repump. */
export function subscribeForegroundResourceIdle(subscriber: () => void): () => void {
  idleSubscribers.add(subscriber);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    idleSubscribers.delete(subscriber);
  };
}

export function getForegroundResourceCoordinatorSnapshot(): ForegroundResourceCoordinatorSnapshot {
  return Object.freeze({
    criticalDepth: criticalLeases.size,
    criticalOwners: Object.freeze(Array.from(criticalLeases.values())),
    deferredTaskCount: deferredTasks.size,
  });
}

/** Test/app-teardown helper; ordinary routes must release their own leases. */
export function resetForegroundResourceCoordinator(): void {
  deferredFlushLifecycle.cleanup();
  deferredFlushScheduled = false;
  criticalLeases.clear();
  deferredTasks.clear();
  nextLeaseId = 0;
}
