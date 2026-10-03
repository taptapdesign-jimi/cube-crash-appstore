import { createScreenLifecycle } from '../utils/screen-lifecycle.js';

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

type ScheduleSpeculativeSlice = (run: () => void) => () => void;

const PRIORITY: Record<GameplayAudioLoadPriority, number> = {
  preload: 0,
  state: 1,
  play: 2,
};

/** Bounds encoded fetch + decoded-buffer preparation and lets audible work
 * overtake speculative warmup. After a critical presentation it drains the
 * deferred speculative backlog at one new job per animation/idle slice. */
export class GameplayAudioLoadScheduler {
  private readonly queued = new Map<string, Job>();
  private readonly running = new Set<Job>();
  private sequence = 0;
  private peakActive = 0;
  private speculativeSuspensionDepth = 0;
  private speculativeDrainPaced = false;
  private cancelScheduledSpeculativeSlice: (() => void) | null = null;
  private readonly speculativeSliceLifecycle = createScreenLifecycle('gameplay-audio-load-scheduler');
  private readonly scheduleSpeculativeSlice: ScheduleSpeculativeSlice;

  constructor(
    private readonly maxConcurrent: number,
    private readonly isExternalSpeculativeBlockActive: () => boolean = () => false,
    scheduleSpeculativeSlice?: ScheduleSpeculativeSlice,
  ) {
    this.scheduleSpeculativeSlice = scheduleSpeculativeSlice ?? ((run) => {
      let active = true;
      this.speculativeSliceLifecycle.trackRaf(() => {
        if (active) run();
      });
      return () => {
        active = false;
        this.speculativeSliceLifecycle.cleanup();
      };
    });
  }

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
    this.cancelScheduledSpeculativeSlice?.();
    this.cancelScheduledSpeculativeSlice = null;
    this.finishPacedDrainIfIdle();
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
      if (this.speculativeSuspensionDepth === 0) this.beginPacedSpeculativeDrain();
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
    this.cancelScheduledSpeculativeSlice?.();
    this.cancelScheduledSpeculativeSlice = null;
    // In-flight browser decoders cannot be aborted. Forget their admission
    // slots after a lifecycle generation reset so stale work cannot block the
    // fresh playback context; their own generation guard discards late results.
    this.running.clear();
    this.sequence = 0;
    this.peakActive = 0;
    this.speculativeSuspensionDepth = 0;
    this.speculativeDrainPaced = false;
  }

  /** Re-evaluates queued work after an externally owned critical window ends. */
  resume(): void {
    this.beginPacedSpeculativeDrain();
    this.pump();
  }

  private pump(): void {
    while (this.running.size < this.maxConcurrent && this.queued.size > 0) {
      const eligible = [...this.queued.values()].filter((job) => (
        (this.speculativeSuspensionDepth === 0 && !this.isExternalSpeculativeBlockActive())
        || job.priority === 'play'
      ));
      if (eligible.length === 0) return;
      const next = eligible.sort((left, right) => (
        PRIORITY[right.priority] - PRIORITY[left.priority]
        || left.sequence - right.sequence
      ))[0];
      if (next.priority !== 'play' && this.speculativeDrainPaced) {
        this.scheduleNextSpeculativeSlice();
        return;
      }
      this.start(next);
    }
    this.finishPacedDrainIfIdle();
  }

  private start(job: Job): void {
    this.queued.delete(job.key);
    this.running.add(job);
    this.peakActive = Math.max(this.peakActive, this.running.size);
    void job.task()
      .then(job.resolve, job.reject)
      .finally(() => {
        this.running.delete(job);
        this.finishPacedDrainIfIdle();
        this.pump();
      });
  }

  private beginPacedSpeculativeDrain(): void {
    if (![...this.queued.values()].some((job) => job.priority !== 'play')) return;
    this.speculativeDrainPaced = true;
  }

  private scheduleNextSpeculativeSlice(): void {
    if (this.cancelScheduledSpeculativeSlice || this.running.size >= this.maxConcurrent) return;
    this.cancelScheduledSpeculativeSlice = this.scheduleSpeculativeSlice(() => {
      this.cancelScheduledSpeculativeSlice = null;
      if (!this.speculativeDrainPaced
        || this.speculativeSuspensionDepth > 0
        || this.isExternalSpeculativeBlockActive()
        || this.running.size >= this.maxConcurrent) return;
      const next = [...this.queued.values()]
        .filter((job) => job.priority !== 'play')
        .sort((left, right) => (
          PRIORITY[right.priority] - PRIORITY[left.priority]
          || left.sequence - right.sequence
        ))[0];
      if (next) this.start(next);
      this.finishPacedDrainIfIdle();
      this.pump();
    });
  }

  private finishPacedDrainIfIdle(): void {
    const hasSpeculativeWork = [...this.queued.values(), ...this.running]
      .some((job) => job.priority !== 'play');
    if (hasSpeculativeWork) return;
    this.speculativeDrainPaced = false;
    this.cancelScheduledSpeculativeSlice?.();
    this.cancelScheduledSpeculativeSlice = null;
  }
}
