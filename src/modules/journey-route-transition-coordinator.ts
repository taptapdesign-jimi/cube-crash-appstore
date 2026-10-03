import { appZoneManager, type AppZone } from './app-zone-manager.js';
import { acquireForegroundResourceCriticalLease } from './foreground-resource-coordinator.js';
import { emitIOSNativeDiagnostic } from '../utils/ios-native-diagnostic.js';

export type JourneyRouteSurface =
  | Readonly<{ view: 'home' }>
  | Readonly<{ view: 'hub' }>
  | Readonly<{ view: 'world'; worldId: number }>;

export type JourneyRouteTransitionResult = Readonly<{
  generation: number;
  status: 'completed' | 'interrupted';
  reason: string;
}>;

export type JourneyRouteTransitionToken = Readonly<{
  generation: number;
  from: JourneyRouteSurface;
  to: JourneyRouteSurface;
  reason: string;
  completion: Promise<JourneyRouteTransitionResult>;
}>;

export interface JourneyRouteOwnedTimeline {
  kill(): void;
}

export interface JourneyRouteTransitionDependencies {
  acquireCriticalLease: () => () => void;
  publishAppZone: (zone: AppZone, reason: string) => void;
  emitDiagnostic?: (event: string, detail: Record<string, unknown>) => void;
}

type ActiveJourneyRouteTransition = {
  token: JourneyRouteTransitionToken;
  timeline: JourneyRouteOwnedTimeline | null;
  cleanups: Set<() => void>;
  releaseCriticalLease: () => void;
  resolveCompletion: (result: JourneyRouteTransitionResult) => void;
  settled: boolean;
};

export type JourneyRouteTransitionSnapshot = Readonly<{
  active: boolean;
  generation: number;
  from: JourneyRouteSurface | null;
  to: JourneyRouteSurface | null;
  reason: string | null;
  timelineClaimed: boolean;
  cleanupCount: number;
}>;

const defaultDependencies: JourneyRouteTransitionDependencies = {
  acquireCriticalLease: () => acquireForegroundResourceCriticalLease('journey-transition'),
  // Publish Journey ownership as soon as a route token exists. Homepage motion
  // may remain visible while its transition runs, so preserve its navigation;
  // the route coordinator, not the app-zone side effect, retires that motion.
  publishAppZone: (zone, reason) => appZoneManager.setZone(zone, reason, {
    preserveHomepageNavigation: true,
  }),
  emitDiagnostic: (event, detail) => emitIOSNativeDiagnostic(`journey-route-${event}`, detail),
};

/**
 * Sole transaction owner for a Journey route handoff.
 *
 * The coordinator intentionally does not know how Hub/World DOM is rendered.
 * It owns the cross-cutting lifetime only: one current token, one GSAP master
 * timeline, one foreground critical lease, app-zone publication and all
 * interruption cleanup. Render/animation owners attach their work to this
 * token and must test `isCurrent()` before every late commit.
 */
export class JourneyRouteTransitionCoordinator {
  private generation = 0;
  private active: ActiveJourneyRouteTransition | null = null;
  private destroyed = false;

  public constructor(
    private readonly dependencies: JourneyRouteTransitionDependencies = defaultDependencies,
  ) {}

  public begin(
    from: JourneyRouteSurface,
    to: JourneyRouteSurface,
    reason: string,
  ): JourneyRouteTransitionToken {
    if (this.destroyed) {
      throw new Error('Journey route transition coordinator is disposed.');
    }
    const replaced = this.active;
    if (replaced && !replaced.settled) {
      // Replacement is one atomic route handoff. Retire the old transaction
      // without briefly publishing its source zone between old cleanup and the
      // new destination publication; that pulse used to invalidate presentation
      // epochs observed by the incoming owner.
      this.settle(replaced, 'interrupted', `replaced:${reason}`, true, false);
    }

    const generation = ++this.generation;
    let resolveCompletion!: (result: JourneyRouteTransitionResult) => void;
    const completion = new Promise<JourneyRouteTransitionResult>((resolve) => {
      resolveCompletion = resolve;
    });
    const token = Object.freeze({
      generation,
      from,
      to,
      reason,
      completion,
    });
    const active: ActiveJourneyRouteTransition = {
      token,
      timeline: null,
      cleanups: new Set(),
      releaseCriticalLease: this.dependencies.acquireCriticalLease(),
      resolveCompletion,
      settled: false,
    };
    this.active = active;

    // Hub and World are presentation states inside the Journey app zone; a
    // Journey back action publishes Home. Publishing at token acquisition
    // prevents renderer/resource policy from observing the outgoing zone while
    // the destination route transaction already owns the foreground.
    const destinationZone: AppZone = to.view === 'home' ? 'home' : 'journey';
    this.dependencies.publishAppZone(destinationZone, `journey-route:${reason}`);
    this.emit('begin', active);
    return token;
  }

  public isCurrent(token: JourneyRouteTransitionToken): boolean {
    return !this.destroyed
      && this.active?.token === token
      && token.generation === this.generation
      && !this.active.settled;
  }

  /** Claim the sole master timeline for this route token. */
  public claimTimeline(
    token: JourneyRouteTransitionToken,
    timeline: JourneyRouteOwnedTimeline,
  ): boolean {
    const active = this.active;
    if (!active || !this.isCurrent(token)) {
      try { timeline.kill(); } catch {}
      return false;
    }
    if (active.timeline && active.timeline !== timeline) {
      throw new Error(`Journey route ${token.generation} already owns a master timeline.`);
    }
    active.timeline = timeline;
    this.emit('timeline-claimed', active);
    return true;
  }

  /** Cleanup is idempotently consumed by complete, interrupt or dispose. */
  public addCleanup(token: JourneyRouteTransitionToken, cleanup: () => void): () => void {
    const active = this.active;
    if (!active || !this.isCurrent(token)) {
      try { cleanup(); } catch {}
      return () => {};
    }
    active.cleanups.add(cleanup);
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      active.cleanups.delete(cleanup);
    };
  }

  public complete(token: JourneyRouteTransitionToken, reason = 'complete'): boolean {
    const active = this.active;
    if (!active || !this.isCurrent(token)) return false;
    this.settle(active, 'completed', reason, false);
    return true;
  }

  public interrupt(token: JourneyRouteTransitionToken, reason = 'interrupted'): boolean {
    const active = this.active;
    if (!active || !this.isCurrent(token)) return false;
    this.settle(active, 'interrupted', reason, true);
    return true;
  }

  public interruptCurrent(reason = 'interrupted'): boolean {
    const active = this.active;
    if (!active || active.settled) return false;
    this.settle(active, 'interrupted', reason, true);
    return true;
  }

  public getSnapshot(): JourneyRouteTransitionSnapshot {
    const active = this.active;
    return Object.freeze({
      active: !!active && !active.settled,
      generation: active?.token.generation ?? this.generation,
      from: active?.token.from ?? null,
      to: active?.token.to ?? null,
      reason: active?.token.reason ?? null,
      timelineClaimed: !!active?.timeline,
      cleanupCount: active?.cleanups.size ?? 0,
    });
  }

  public dispose(reason = 'disposed'): void {
    if (this.destroyed) return;
    this.interruptCurrent(reason);
    this.destroyed = true;
    this.generation += 1;
  }

  private settle(
    active: ActiveJourneyRouteTransition,
    status: JourneyRouteTransitionResult['status'],
    reason: string,
    killTimeline: boolean,
    rollbackZone = true,
  ): void {
    if (active.settled) return;
    active.settled = true;
    if (this.active === active) this.active = null;

    if (killTimeline && active.timeline) {
      try { active.timeline.kill(); } catch {}
    }
    active.timeline = null;
    const cleanups = Array.from(active.cleanups);
    active.cleanups.clear();
    cleanups.forEach((cleanup) => {
      try { cleanup(); } catch {}
    });
    active.releaseCriticalLease();
    if (status === 'interrupted' && rollbackZone) {
      const sourceZone: AppZone = active.token.from.view === 'home' ? 'home' : 'journey';
      this.dependencies.publishAppZone(sourceZone, `journey-route-rollback:${reason}`);
    }
    const result = Object.freeze({
      generation: active.token.generation,
      status,
      reason,
    });
    active.resolveCompletion(result);
    this.emit(status, active, { settleReason: reason });
  }

  private emit(
    event: string,
    active: ActiveJourneyRouteTransition,
    detail: Record<string, unknown> = {},
  ): void {
    this.dependencies.emitDiagnostic?.(event, {
      generation: active.token.generation,
      from: active.token.from,
      to: active.token.to,
      reason: active.token.reason,
      ...detail,
    });
  }
}

export const journeyRouteTransitionCoordinator = new JourneyRouteTransitionCoordinator();
