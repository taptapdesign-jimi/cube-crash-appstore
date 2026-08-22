export type JourneyWorldRuntimeState =
  | 'inactive'
  | 'transition'
  | 'modal'
  | 'scrolling'
  | 'settling'
  | 'idle';

export interface JourneyWorldRuntimeSnapshot {
  state: JourneyWorldRuntimeState;
  worldId: number | null;
  generation: number;
  paintSuspended: boolean;
  ambientSuspended: boolean;
}

type JourneyWorldRuntimeSubscriber = (snapshot: JourneyWorldRuntimeSnapshot) => void;

const DEFAULT_SCROLL_SETTLE_MS = 180;
const DEFAULT_IDLE_HANDOFF_MS = 48;

/**
 * One state owner for every current and future Journey World.
 *
 * It deliberately owns no visual implementation. DOM idle, spatial motion,
 * ambient effects and transition styling subscribe to the same bounded state
 * so World transforms never compete with native scroll or modal work. Ambient
 * owners remain fluid during scroll/modal and suspend only at hard lifecycle
 * boundaries such as transitions and teardown.
 */
export class JourneyWorldRuntimeScheduler {
  private state: JourneyWorldRuntimeState = 'inactive';
  private worldId: number | null = null;
  private generation = 0;
  private transitionDepth = 0;
  private modalDepth = 0;
  private scrollActive = false;
  private settling = false;
  private interactionSettling = false;
  private scrollRoot: HTMLElement | null = null;
  private scrollSettleTimer: number | null = null;
  private idleHandoffTimer: number | null = null;
  private readonly subscribers = new Set<JourneyWorldRuntimeSubscriber>();

  public constructor(
    private readonly scrollSettleMs = DEFAULT_SCROLL_SETTLE_MS,
    private readonly idleHandoffMs = DEFAULT_IDLE_HANDOFF_MS,
  ) {}

  private readonly onScroll = (): void => {
    if (this.worldId === null) return;
    this.scrollActive = true;
    this.settling = false;
    this.interactionSettling = false;
    this.clearIdleHandoffTimer();
    this.recomputeState();
    this.clearScrollSettleTimer();
    this.scrollSettleTimer = window.setTimeout(() => {
      this.scrollSettleTimer = null;
      this.scrollActive = false;
      this.settling = true;
      this.recomputeState();
      this.idleHandoffTimer = window.setTimeout(() => {
        this.idleHandoffTimer = null;
        this.settling = false;
        this.recomputeState();
      }, this.idleHandoffMs);
    }, this.scrollSettleMs);
  };

  public activate(
    worldId: number,
    scrollRoot: HTMLElement | null,
    initialState: 'idle' | 'transition' = 'idle',
  ): void {
    this.unbindScrollRoot();
    this.generation += 1;
    this.worldId = Number.isFinite(worldId) && worldId > 0 ? worldId : null;
    this.transitionDepth = initialState === 'transition' ? 1 : 0;
    this.modalDepth = 0;
    this.scrollActive = false;
    this.settling = false;
    this.interactionSettling = false;
    this.scrollRoot = scrollRoot;
    this.scrollRoot?.addEventListener('scroll', this.onScroll, { passive: true });
    this.recomputeState(true);
  }

  public beginTransition(): void {
    if (this.worldId === null) return;
    this.transitionDepth += 1;
    this.recomputeState();
  }

  public endTransition(): void {
    this.transitionDepth = Math.max(0, this.transitionDepth - 1);
    this.recomputeState();
  }

  public openModal(): void {
    if (this.worldId === null) return;
    this.modalDepth += 1;
    this.recomputeState();
  }

  public closeModal(): void {
    this.modalDepth = Math.max(0, this.modalDepth - 1);
    this.recomputeState();
  }

  /** Keep heavy World paint paused through a short local interaction tail.
   * Ambient owners remain full-rate because `settling` does not suspend them. */
  public beginInteractionSettle(): void {
    if (this.worldId === null) return;
    this.interactionSettling = true;
    this.recomputeState();
  }

  public endInteractionSettle(): void {
    if (!this.interactionSettling) return;
    this.interactionSettling = false;
    this.recomputeState();
  }

  public deactivate(): void {
    this.unbindScrollRoot();
    this.generation += 1;
    this.worldId = null;
    this.transitionDepth = 0;
    this.modalDepth = 0;
    this.scrollActive = false;
    this.settling = false;
    this.interactionSettling = false;
    this.recomputeState(true);
  }

  public subscribe(subscriber: JourneyWorldRuntimeSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.getSnapshot());
    return () => this.subscribers.delete(subscriber);
  }

  public getSnapshot(): JourneyWorldRuntimeSnapshot {
    const ambientSuspended = this.state === 'inactive' || this.state === 'transition';
    return {
      state: this.state,
      worldId: this.worldId,
      generation: this.generation,
      paintSuspended: this.state !== 'idle',
      ambientSuspended,
    };
  }

  public dispose(): void {
    this.deactivate();
    this.subscribers.clear();
  }

  private recomputeState(force = false): void {
    const nextState: JourneyWorldRuntimeState = this.worldId === null
      ? 'inactive'
      : this.transitionDepth > 0
        ? 'transition'
        : this.modalDepth > 0
          ? 'modal'
          : this.scrollActive
            ? 'scrolling'
            : this.settling || this.interactionSettling
              ? 'settling'
              : 'idle';
    if (!force && nextState === this.state) return;
    this.state = nextState;
    const snapshot = this.getSnapshot();
    this.subscribers.forEach((subscriber) => subscriber(snapshot));
  }

  private clearScrollSettleTimer(): void {
    if (this.scrollSettleTimer === null) return;
    window.clearTimeout(this.scrollSettleTimer);
    this.scrollSettleTimer = null;
  }

  private clearIdleHandoffTimer(): void {
    if (this.idleHandoffTimer === null) return;
    window.clearTimeout(this.idleHandoffTimer);
    this.idleHandoffTimer = null;
  }

  private unbindScrollRoot(): void {
    this.scrollRoot?.removeEventListener('scroll', this.onScroll);
    this.scrollRoot = null;
    this.clearScrollSettleTimer();
    this.clearIdleHandoffTimer();
  }
}
