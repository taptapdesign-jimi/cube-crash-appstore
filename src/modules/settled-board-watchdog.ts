import type { GameplayDieRenderParityIssue } from './gameplay-die-render-parity.ts';

export type SettledBoardWatchdogObservation = Readonly<{
  boardRevision: number;
  fingerprint: string;
  settled: boolean;
  logicalMoveAvailable: boolean;
  visibleInteractiveMoveAvailable: boolean;
  parityIssues: readonly GameplayDieRenderParityIssue[];
}>;

export type SettledBoardWatchdogIncident = Readonly<{
  incidentKey: string;
  observation: SettledBoardWatchdogObservation;
}>;

export interface SettledBoardWatchdogScheduler {
  schedule(delayMs: number, callback: () => void): () => void;
}

export interface SettledBoardWatchdogOptions {
  deadlineMs: number;
  scheduler: SettledBoardWatchdogScheduler;
  readCurrent: () => SettledBoardWatchdogObservation;
  onNoMoves: (incident: SettledBoardWatchdogIncident) => void;
  onInvariant: (incident: SettledBoardWatchdogIncident) => void;
}

/**
 * A one-shot settled-state deadline owner. It never computes gameplay legality;
 * it only proves that the same revision/fingerprint stayed settled until the
 * caller's fixed deadline, then routes either canonical No Moves or a
 * model/render/hit-test invariant. Scheduling is injected so app-core can use
 * its tracked lifecycle scheduler rather than creating another raw timer.
 */
export class SettledBoardWatchdog {
  private cancelDeadline: (() => void) | null = null;
  private armedKey: string | null = null;
  private firedKey: string | null = null;
  private disposed = false;

  constructor(private readonly options: SettledBoardWatchdogOptions) {
    if (!Number.isFinite(options.deadlineMs) || options.deadlineMs <= 0) {
      throw new Error('SettledBoardWatchdog requires a positive deadlineMs');
    }
  }

  observe(observation: SettledBoardWatchdogObservation): void {
    if (this.disposed) return;
    const incidentKey = this.getIncidentKey(observation);
    if (!observation.settled || observation.visibleInteractiveMoveAvailable) {
      this.cancel();
      this.firedKey = null;
      return;
    }
    if (this.firedKey === incidentKey || this.armedKey === incidentKey) return;

    this.cancel();
    this.armedKey = incidentKey;
    this.cancelDeadline = this.options.scheduler.schedule(this.options.deadlineMs, () => {
      this.cancelDeadline = null;
      if (this.disposed || this.armedKey !== incidentKey) return;
      const current = this.options.readCurrent();
      const currentKey = this.getIncidentKey(current);
      if (currentKey !== incidentKey || !current.settled || current.visibleInteractiveMoveAvailable) {
        this.armedKey = null;
        this.observe(current);
        return;
      }

      this.armedKey = null;
      this.firedKey = incidentKey;
      const incident = { incidentKey, observation: current };
      if (current.logicalMoveAvailable || current.parityIssues.length > 0) {
        this.options.onInvariant(incident);
      } else {
        this.options.onNoMoves(incident);
      }
    });
  }

  noteActivity(): void {
    if (this.disposed) return;
    this.cancel();
    this.firedKey = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel();
    this.firedKey = null;
  }

  isArmed(): boolean {
    return this.armedKey !== null;
  }

  private cancel(): void {
    try { this.cancelDeadline?.(); } catch {}
    this.cancelDeadline = null;
    this.armedKey = null;
  }

  private getIncidentKey(observation: SettledBoardWatchdogObservation): string {
    return `${observation.boardRevision}:${observation.fingerprint}`;
  }
}
