export type GameplayAudioLoadPriority = 'preload' | 'state' | 'play';

type Job = {
  key: string;
  priority: GameplayAudioLoadPriority;
  sequence: number;
  task: () => Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
  promise: Promise<void>;
};

const PRIORITY: Record<GameplayAudioLoadPriority, number> = {
  preload: 0,
  state: 1,
  play: 2,
};

/** Bounds encoded fetch + decoded-buffer preparation and lets audible work
 * overtake speculative warmup. It intentionally owns no timer or listener. */
export class GameplayAudioLoadScheduler {
  private readonly queued = new Map<string, Job>();
  private readonly running = new Set<Job>();
  private sequence = 0;
  private peakActive = 0;
  private speculativeSuspensionDepth = 0;

  constructor(private readonly maxConcurrent: number) {}

  enqueue(key: string, priority: GameplayAudioLoadPriority, task: () => Promise<void>): Promise<void> {
    const existing = this.queued.get(key);
    if (existing) {
      this.promote(key, priority);
      return existing.promise;
    }
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    this.queued.set(key, {
      key,
      priority,
      sequence: ++this.sequence,
      task,
      resolve,
      reject,
      promise,
    });
    this.pump();
    return promise;
  }

  promote(key: string, priority: GameplayAudioLoadPriority): void {
    const job = this.queued.get(key);
    if (!job || PRIORITY[priority] <= PRIORITY[job.priority]) return;
    job.priority = priority;
    this.pump();
  }

  cancelQueued(): void {
    for (const job of this.queued.values()) job.resolve();
    this.queued.clear();
  }

  /**
   * Keeps optional preload/state decoding out of a live visual transition.
   * Audible `play` work remains eligible and may still overtake queued work.
   * The returned release is idempotent so lifecycle cleanup can call it from
   * both normal and interrupted paths.
   */
  suspendSpeculative(): () => void {
    this.speculativeSuspensionDepth += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.speculativeSuspensionDepth = Math.max(0, this.speculativeSuspensionDepth - 1);
      this.pump();
    };
  }

  snapshot(): { active: number; queued: number; maxConcurrent: number; peakActive: number; speculativeSuspended: boolean } {
    return {
      active: this.running.size,
      queued: this.queued.size,
      maxConcurrent: this.maxConcurrent,
      peakActive: this.peakActive,
      speculativeSuspended: this.speculativeSuspensionDepth > 0,
    };
  }

  reset(): void {
    this.cancelQueued();
    // In-flight browser decoders cannot be aborted. Forget their admission
    // slots after a lifecycle generation reset so stale work cannot block the
    // fresh playback context; their own generation guard discards late results.
    this.running.clear();
    this.sequence = 0;
    this.peakActive = 0;
    this.speculativeSuspensionDepth = 0;
  }

  private pump(): void {
    while (this.running.size < this.maxConcurrent && this.queued.size > 0) {
      const eligible = [...this.queued.values()].filter((job) => (
        this.speculativeSuspensionDepth === 0 || job.priority === 'play'
      ));
      if (eligible.length === 0) return;
      const next = eligible.sort((left, right) => (
        PRIORITY[right.priority] - PRIORITY[left.priority]
        || left.sequence - right.sequence
      ))[0];
      this.queued.delete(next.key);
      this.running.add(next);
      this.peakActive = Math.max(this.peakActive, this.running.size);
      void next.task()
        .then(next.resolve, next.reject)
        .finally(() => {
          this.running.delete(next);
          this.pump();
        });
    }
  }
}
