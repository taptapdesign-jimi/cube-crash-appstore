export type BoardLifecycleMilestone = {
  name: string;
  atMs: number;
  deltaMs: number;
};

export type BoardLifecycleTrace = {
  id: number;
  source: string;
  boardNumber?: number;
  startedAt: number;
  completed: boolean;
  milestones: BoardLifecycleMilestone[];
  frameWindows: BoardLifecycleFrameWindow[];
  totalMs?: number;
};

export type BoardLifecycleFrameWindow = {
  name: string;
  sampleCount: number;
  averageFrameMs: number;
  worstFrameMs: number;
  framesOver28Ms: number;
};

let traceSequence = 0;
let activeTrace: BoardLifecycleTrace | null = null;

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function publish(trace: BoardLifecycleTrace): void {
  if (typeof window === 'undefined') return;
  (window as any).__ccActiveBoardLifecycleTrace = trace.completed ? null : trace;
  (window as any).__ccLastBoardLifecycleTrace = trace;
}

export function beginBoardLifecycleTrace(source: string, boardNumber?: number): BoardLifecycleTrace {
  const startedAt = now();
  activeTrace = {
    id: ++traceSequence,
    source,
    boardNumber,
    startedAt,
    completed: false,
    milestones: [{ name: 'begin', atMs: 0, deltaMs: 0 }],
    frameWindows: [],
  };
  publish(activeTrace);
  return activeTrace;
}

export function ensureBoardLifecycleTrace(source: string, boardNumber?: number): BoardLifecycleTrace {
  return activeTrace && !activeTrace.completed
    ? activeTrace
    : beginBoardLifecycleTrace(source, boardNumber);
}

export function markBoardLifecycle(name: string): void {
  if (!activeTrace || activeTrace.completed) return;
  const atMs = Math.max(0, now() - activeTrace.startedAt);
  const previousAt = activeTrace.milestones[activeTrace.milestones.length - 1]?.atMs ?? 0;
  activeTrace.milestones.push({
    name,
    atMs: Number(atMs.toFixed(1)),
    deltaMs: Number(Math.max(0, atMs - previousAt).toFixed(1)),
  });
  publish(activeTrace);
}

export function completeBoardLifecycleTrace(finalMilestone = 'first-input'): BoardLifecycleTrace | null {
  if (!activeTrace || activeTrace.completed) return activeTrace;
  markBoardLifecycle(finalMilestone);
  activeTrace.completed = true;
  activeTrace.totalMs = activeTrace.milestones[activeTrace.milestones.length - 1]?.atMs ?? 0;
  publish(activeTrace);
  console.info('🧪 BoardLifecycle summary', {
    source: activeTrace.source,
    boardNumber: activeTrace.boardNumber,
    totalMs: activeTrace.totalMs,
    milestones: activeTrace.milestones,
  });
  return activeTrace;
}

export function startBoardLifecycleFrameWindow(name: string): () => void {
  if (!activeTrace || activeTrace.completed || typeof requestAnimationFrame !== 'function') return () => {};
  const traceId = activeTrace.id;
  const samples: number[] = [];
  let lastFrameAt = now();
  let frameId: number | null = null;
  let stopped = false;
  const loop = (frameAt: number) => {
    samples.push(Math.max(0, Math.min(250, frameAt - lastFrameAt)));
    lastFrameAt = frameAt;
    frameId = requestAnimationFrame(loop);
  };
  frameId = requestAnimationFrame(loop);
  return () => {
    if (stopped) return;
    stopped = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    if (!activeTrace || activeTrace.id !== traceId || samples.length === 0) return;
    const averageFrameMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    activeTrace.frameWindows.push({
      name,
      sampleCount: samples.length,
      averageFrameMs: Number(averageFrameMs.toFixed(2)),
      worstFrameMs: Number(Math.max(...samples).toFixed(2)),
      framesOver28Ms: samples.filter((value) => value > 28).length,
    });
    publish(activeTrace);
  };
}

export function getActiveBoardLifecycleTrace(): BoardLifecycleTrace | null {
  return activeTrace;
}

export function resetBoardLifecycleTraceForTests(): void {
  activeTrace = null;
  traceSequence = 0;
}
