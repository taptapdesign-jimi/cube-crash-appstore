type TileLike = any;

export type MergeKind = 'regular' | 'wild' | 'wild-magnet';

export type MergePhase = 'queued' | 'animating' | 'resolving' | 'completed' | 'aborted';

export interface MergeContext {
  id: string;
  kind: MergeKind;
  phase: MergePhase;
  src: TileLike;
  dst: TileLike;
  pulledTiles: TileLike[];
  createdAt: number;
  data: Record<string, unknown>;
}

export class MergeOrchestrator {
  private active = new Map<string, MergeContext>();
  private counter = 0;

  queueMerge(partial: {
    kind: MergeKind;
    src: TileLike;
    dst: TileLike;
    pulledTiles?: TileLike[];
    data?: Record<string, unknown>;
  }): MergeContext {
    const id = `merge_${Date.now().toString(36)}_${(this.counter++).toString(36)}`;
    const ctx: MergeContext = {
      id,
      kind: partial.kind,
      phase: 'queued',
      src: partial.src,
      dst: partial.dst,
      pulledTiles: partial.pulledTiles ? [...partial.pulledTiles] : [],
      createdAt: Date.now(),
      data: partial.data ? { ...partial.data } : {},
    };
    this.active.set(id, ctx);
    return ctx;
  }

  updatePhase(id: string, phase: MergePhase, extraData?: Record<string, unknown>): MergeContext | null {
    const ctx = this.active.get(id);
    if (!ctx) return null;
    ctx.phase = phase;
    if (extraData) {
      ctx.data = { ...ctx.data, ...extraData };
    }
    if (phase === 'completed' || phase === 'aborted') {
      this.active.delete(id);
    }
    return ctx;
  }

  getContext(id: string): MergeContext | undefined {
    return this.active.get(id);
  }

  getActiveContexts(): MergeContext[] {
    return Array.from(this.active.values());
  }
}

export const mergeOrchestrator = new MergeOrchestrator();


