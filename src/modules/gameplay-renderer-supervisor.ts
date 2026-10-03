export type GameplayRendererSupervisorState =
  | 'idle'
  | 'quiescing'
  | 'rehydrating'
  | 'validating'
  | 'recreating'
  | 'healthy'
  | 'visible-failed'
  | 'disposed';

export type GameplayRendererValidation = Readonly<{
  healthy: boolean;
  issues: readonly unknown[];
}>;

export type GameplayRendererRecoveryTrigger =
  | 'context-restored'
  | 'gameplay-entry'
  | 'foreground'
  | 'settled-board'
  | 'retry'
  | 'manual';

export type GameplayRendererSupervisorResult = Readonly<{
  state: 'healthy' | 'visible-failed' | 'superseded';
  reason: string;
  trigger: GameplayRendererRecoveryTrigger;
  rendererGeneration: number;
  recreationAttempts: number;
  issues: readonly unknown[];
  error?: unknown;
}>;

export type GameplayRendererFallbackRequest = Readonly<{
  reason: string;
  trigger: GameplayRendererRecoveryTrigger;
  rendererGeneration: number;
  error: unknown;
  issues: readonly unknown[];
  retry: () => Promise<GameplayRendererSupervisorResult>;
}>;

export type GameplayRendererSupervisorDiagnostic = Readonly<{
  event:
    | 'renderer-invalidated'
    | 'request-started'
    | 'request-joined'
    | 'phase-started'
    | 'validation-failed'
    | 'renderer-recreated'
    | 'recovery-healthy'
    | 'recovery-visible-failed'
    | 'request-superseded'
    | 'disposed';
  state: GameplayRendererSupervisorState;
  reason: string;
  trigger: GameplayRendererRecoveryTrigger;
  rendererGeneration: number;
  requestEpoch: number;
  phase?: string;
  recreationAttempts?: number;
  issues?: readonly unknown[];
  error?: unknown;
}>;

export type GameplayRendererSupervisorDependencies = {
  deadlineMs: number;
  maxRecreationAttempts?: number;
  runBounded: <T>(label: string, deadlineMs: number, work: () => Promise<T>) => Promise<T>;
  setInputLocked: (locked: boolean) => void;
  quiesce: (reason: string) => void;
  rehydrate: (rendererGeneration: number, isCurrent: () => boolean) => Promise<void>;
  /** Structural/display-list validation. It must not stand in for painted output. */
  validate: (rendererGeneration: number, isCurrent: () => boolean) => Promise<GameplayRendererValidation>;
  /**
   * Validates the frame which would actually be revealed. The host should
   * render to an isolated target/canvas and verify non-blank pixels, effective
   * visibility and current-generation die/HUD/input parity.
   */
  validatePaintedVisibility: (
    rendererGeneration: number,
    isCurrent: () => boolean,
  ) => Promise<GameplayRendererValidation>;
  recreate: (
    rendererGeneration: number,
    reason: string,
    isCurrent: () => boolean,
  ) => Promise<{ rendererGeneration: number }>;
  reveal: (rendererGeneration: number) => void;
  presentFallback: (request: GameplayRendererFallbackRequest) => void;
  clearFallback: () => void;
  onStateChange?: (state: GameplayRendererSupervisorState, rendererGeneration: number) => void;
  onDiagnostic?: (diagnostic: GameplayRendererSupervisorDiagnostic) => void;
};

class RendererValidationError extends Error {
  constructor(readonly issues: readonly unknown[]) {
    super('Gameplay renderer validation failed');
    this.name = 'RendererValidationError';
  }
}

/**
 * Serial, generation-owned recovery/recreation supervisor.
 *
 * It owns no renderer implementation and no timer. The host supplies bounded
 * lifecycle operations and the immutable-snapshot rebuild. One request may
 * recreate at most maxRecreationAttempts times; failure remains input-locked
 * and ends in the explicit visible fallback.
 */
export class GameplayRendererSupervisor {
  private state: GameplayRendererSupervisorState = 'idle';
  private requestEpoch = 0;
  private rendererGeneration = 0;
  private activeRequestGeneration: number | null = null;
  private activePromise: Promise<GameplayRendererSupervisorResult> | null = null;
  private recoveryRequired = false;
  private quiescedGeneration: number | null = null;
  private lastHealthyResult: GameplayRendererSupervisorResult | null = null;
  private inputLocked = false;

  constructor(private readonly deps: GameplayRendererSupervisorDependencies) {
    if (!Number.isFinite(deps.deadlineMs) || deps.deadlineMs <= 0) {
      throw new Error('GameplayRendererSupervisor requires a positive deadlineMs');
    }
  }

  getState(): GameplayRendererSupervisorState {
    return this.state;
  }

  getRendererGeneration(): number {
    return this.rendererGeneration;
  }

  isRecoveryRequired(): boolean {
    return this.recoveryRequired;
  }

  /**
   * Sole GPU-generation invalidation boundary. Context-loss listeners call this
   * synchronously, then route entry/foreground/context-restored callers all join
   * the same generation through joinRecovery().
   */
  invalidateRendererGeneration(reason: string): number {
    if (this.state === 'disposed') return this.rendererGeneration;
    this.requestEpoch += 1;
    this.rendererGeneration += 1;
    this.recoveryRequired = true;
    this.lastHealthyResult = null;
    this.setInputLocked(true);
    this.quiesceOnce(reason, this.rendererGeneration);
    this.emitDiagnostic({
      event: 'renderer-invalidated',
      reason,
      trigger: 'manual',
      rendererGeneration: this.rendererGeneration,
    });
    return this.rendererGeneration;
  }

  /**
   * Joins the current renderer generation. Once that generation is healthy,
   * ordinary duplicate entry/foreground joins return the same receipt without
   * re-running GPU work. Pass force only for a newly observed same-generation
   * invariant which genuinely requires another bounded validation cycle.
   */
  joinRecovery(
    reason: string,
    trigger: GameplayRendererRecoveryTrigger,
    options: Readonly<{ force?: boolean }> = {},
  ): Promise<GameplayRendererSupervisorResult> {
    if (!options.force && !this.recoveryRequired) {
      const healthyReceipt = this.lastHealthyResult
        && this.lastHealthyResult.rendererGeneration === this.rendererGeneration
        ? this.lastHealthyResult
        : {
            state: 'healthy' as const,
            reason,
            trigger,
            rendererGeneration: this.rendererGeneration,
            recreationAttempts: 0,
            issues: [],
          };
      this.lastHealthyResult = healthyReceipt;
      this.emitDiagnostic({
        event: 'request-joined',
        reason,
        trigger,
        rendererGeneration: this.rendererGeneration,
      });
      return Promise.resolve(healthyReceipt);
    }
    return this.requestRecovery(reason, this.rendererGeneration, trigger);
  }

  requestRecovery(
    reason: string,
    rendererGeneration: number,
    trigger: GameplayRendererRecoveryTrigger = 'manual',
  ): Promise<GameplayRendererSupervisorResult> {
    if (this.state === 'disposed') {
      return Promise.resolve({
        state: 'superseded',
        reason,
        trigger,
        rendererGeneration,
        recreationAttempts: 0,
        issues: [],
      });
    }
    if (rendererGeneration < this.rendererGeneration) {
      return Promise.resolve(this.superseded(reason, trigger, this.rendererGeneration, 0));
    }
    if (this.activePromise && this.activeRequestGeneration === rendererGeneration) {
      this.emitDiagnostic({
        event: 'request-joined',
        reason,
        trigger,
        rendererGeneration,
      });
      return this.activePromise;
    }

    const previous = this.activePromise;
    const epoch = ++this.requestEpoch;
    this.rendererGeneration = Math.max(this.rendererGeneration, rendererGeneration);
    this.activeRequestGeneration = rendererGeneration;
    this.recoveryRequired = true;
    this.lastHealthyResult = null;
    this.setInputLocked(true);
    this.quiesceOnce(reason, rendererGeneration);
    this.emitDiagnostic({ event: 'request-started', reason, trigger, rendererGeneration });

    let operation!: Promise<GameplayRendererSupervisorResult>;
    operation = (async (): Promise<GameplayRendererSupervisorResult> => {
      if (previous) {
        try { await previous; } catch {}
      }
      const isCurrent = () => this.state !== 'disposed' && this.requestEpoch === epoch;
      if (!isCurrent()) return this.superseded(reason, trigger, rendererGeneration, 0);

      let generation = rendererGeneration;
      let recreationAttempts = 0;
      let lastIssues: readonly unknown[] = [];
      let lastError: unknown = null;
      const maxRecreationAttempts = Math.max(0, this.deps.maxRecreationAttempts ?? 1);

      const rehydrateAndValidate = async (phase: string): Promise<void> => {
        this.setState('rehydrating', generation);
        this.emitDiagnostic({
          event: 'phase-started', reason, trigger, rendererGeneration: generation, phase: `${phase}:rehydrate`,
          recreationAttempts,
        });
        await this.deps.runBounded(
          `${phase}:rehydrate`,
          this.deps.deadlineMs,
          () => this.deps.rehydrate(generation, isCurrent),
        );
        if (!isCurrent()) return;
        this.setState('validating', generation);
        this.emitDiagnostic({
          event: 'phase-started', reason, trigger, rendererGeneration: generation, phase: `${phase}:validate-structure`,
          recreationAttempts,
        });
        const structuralValidation = await this.deps.runBounded(
          `${phase}:validate-structure`,
          this.deps.deadlineMs,
          () => this.deps.validate(generation, isCurrent),
        );
        if (!isCurrent()) return;
        if (!structuralValidation.healthy) {
          lastIssues = structuralValidation.issues;
          this.emitDiagnostic({
            event: 'validation-failed', reason, trigger, rendererGeneration: generation,
            phase: `${phase}:validate-structure`, recreationAttempts, issues: lastIssues,
          });
          throw new RendererValidationError(lastIssues);
        }
        this.emitDiagnostic({
          event: 'phase-started', reason, trigger, rendererGeneration: generation,
          phase: `${phase}:validate-painted-visibility`, recreationAttempts,
        });
        const paintedValidation = await this.deps.runBounded(
          `${phase}:validate-painted-visibility`,
          this.deps.deadlineMs,
          () => this.deps.validatePaintedVisibility(generation, isCurrent),
        );
        if (!isCurrent()) return;
        lastIssues = paintedValidation.issues;
        if (!paintedValidation.healthy) {
          this.emitDiagnostic({
            event: 'validation-failed', reason, trigger, rendererGeneration: generation,
            phase: `${phase}:validate-painted-visibility`, recreationAttempts, issues: lastIssues,
          });
          throw new RendererValidationError(lastIssues);
        }
      };

      try {
        try {
          await rehydrateAndValidate('recovery');
        } catch (error) {
          lastError = error;
          if (error instanceof RendererValidationError) lastIssues = error.issues;
          while (isCurrent() && recreationAttempts < maxRecreationAttempts) {
            recreationAttempts += 1;
            this.setState('recreating', generation);
            const recreated = await this.deps.runBounded(
              `recreate:${recreationAttempts}`,
              this.deps.deadlineMs,
              () => this.deps.recreate(generation, reason, isCurrent),
            );
            if (!isCurrent()) return this.superseded(reason, trigger, generation, recreationAttempts);
            if (!Number.isInteger(recreated.rendererGeneration)
              || recreated.rendererGeneration <= generation) {
              throw new Error('Renderer recreation must advance the renderer generation');
            }
            generation = recreated.rendererGeneration;
            this.rendererGeneration = generation;
            this.activeRequestGeneration = generation;
            this.quiescedGeneration = generation;
            this.emitDiagnostic({
              event: 'renderer-recreated', reason, trigger, rendererGeneration: generation,
              recreationAttempts,
            });
            try {
              await rehydrateAndValidate(`recreated:${recreationAttempts}`);
              lastError = null;
              break;
            } catch (recreatedError) {
              lastError = recreatedError;
              if (recreatedError instanceof RendererValidationError) {
                lastIssues = recreatedError.issues;
              }
            }
          }
          if (lastError) throw lastError;
        }

        if (!isCurrent()) return this.superseded(reason, trigger, generation, recreationAttempts);
        this.deps.reveal(generation);
        if (!isCurrent()) return this.superseded(reason, trigger, generation, recreationAttempts);
        this.deps.clearFallback();
        this.setInputLocked(false);
        this.setState('healthy', generation);
        this.recoveryRequired = false;
        this.quiescedGeneration = null;
        const result: GameplayRendererSupervisorResult = {
          state: 'healthy',
          reason,
          trigger,
          rendererGeneration: generation,
          recreationAttempts,
          issues: [],
        };
        this.lastHealthyResult = result;
        this.emitDiagnostic({
          event: 'recovery-healthy', reason, trigger, rendererGeneration: generation,
          recreationAttempts,
        });
        return result;
      } catch (error) {
        if (!isCurrent()) return this.superseded(reason, trigger, generation, recreationAttempts);
        this.deps.quiesce(`failed:${reason}`);
        this.setState('visible-failed', generation);
        this.recoveryRequired = true;
        const retry = () => this.requestRecovery(`retry:${reason}`, this.rendererGeneration, 'retry');
        this.deps.presentFallback({
          reason,
          trigger,
          rendererGeneration: generation,
          error,
          issues: lastIssues,
          retry,
        });
        const result: GameplayRendererSupervisorResult = {
          state: 'visible-failed',
          reason,
          trigger,
          rendererGeneration: generation,
          recreationAttempts,
          issues: lastIssues,
          error,
        };
        this.emitDiagnostic({
          event: 'recovery-visible-failed', reason, trigger, rendererGeneration: generation,
          recreationAttempts, issues: lastIssues, error,
        });
        return result;
      }
    })().finally(() => {
      if (this.activePromise === operation) {
        this.activePromise = null;
        this.activeRequestGeneration = null;
      }
    });
    this.activePromise = operation;
    return operation;
  }

  dispose(): void {
    if (this.state === 'disposed') return;
    this.requestEpoch += 1;
    this.activePromise = null;
    this.activeRequestGeneration = null;
    this.deps.clearFallback();
    this.setInputLocked(false);
    this.setState('disposed', this.rendererGeneration);
    this.recoveryRequired = false;
    this.quiescedGeneration = null;
    this.lastHealthyResult = null;
    this.emitDiagnostic({
      event: 'disposed', reason: 'dispose', trigger: 'manual',
      rendererGeneration: this.rendererGeneration,
    });
  }

  /**
   * Retires an app/route lifecycle without destroying the reusable supervisor.
   * Late async phases become stale and cannot reveal into the next gameplay
   * entry; a future context generation can use this same sole owner again.
   */
  retireLifecycle(reason: string): void {
    if (this.state === 'disposed') return;
    const retiredGeneration = this.rendererGeneration;
    const recreationAttempts = this.lastHealthyResult?.recreationAttempts ?? 0;
    this.requestEpoch += 1;
    this.activePromise = null;
    this.activeRequestGeneration = null;
    this.deps.clearFallback();
    this.setInputLocked(false);
    this.setState('idle', retiredGeneration);
    this.recoveryRequired = false;
    this.quiescedGeneration = null;
    this.lastHealthyResult = null;
    this.emitDiagnostic({
      event: 'request-superseded',
      reason,
      trigger: 'manual',
      rendererGeneration: retiredGeneration,
      recreationAttempts,
    });
  }

  private setState(state: GameplayRendererSupervisorState, generation: number): void {
    this.state = state;
    this.deps.onStateChange?.(state, generation);
  }

  private quiesceOnce(reason: string, rendererGeneration: number): void {
    if (this.quiescedGeneration === rendererGeneration) return;
    this.quiescedGeneration = rendererGeneration;
    this.setState('quiescing', rendererGeneration);
    this.deps.quiesce(reason);
  }

  private setInputLocked(locked: boolean): void {
    if (this.inputLocked === locked) return;
    this.inputLocked = locked;
    this.deps.setInputLocked(locked);
  }

  private emitDiagnostic(
    diagnostic: Omit<GameplayRendererSupervisorDiagnostic, 'state' | 'requestEpoch'>,
  ): void {
    try {
      this.deps.onDiagnostic?.({
        ...diagnostic,
        state: this.state,
        requestEpoch: this.requestEpoch,
      });
    } catch {}
  }

  private superseded(
    reason: string,
    trigger: GameplayRendererRecoveryTrigger,
    rendererGeneration: number,
    recreationAttempts: number,
  ): GameplayRendererSupervisorResult {
    const result: GameplayRendererSupervisorResult = {
      state: 'superseded',
      reason,
      trigger,
      rendererGeneration,
      recreationAttempts,
      issues: [],
    };
    this.emitDiagnostic({
      event: 'request-superseded', reason, trigger, rendererGeneration,
      recreationAttempts,
    });
    return result;
  }
}
