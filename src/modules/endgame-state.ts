type EndgamePhase =
  | 'idle'
  | 'checking'
  | 'clean-board'
  | 'moves-zero'
  | 'running'
  | 'completed'
  | 'aborted';

type PhaseMetadata = Record<string, unknown> | undefined;

interface EndgameState {
  phase: EndgamePhase;
  metadata: PhaseMetadata;
  updatedAt: number;
}

export interface EndgameSnapshot {
  phase: EndgamePhase;
  metadata: PhaseMetadata;
  updatedAt: number;
}

type EndgameListener = (snapshot: EndgameSnapshot, previous: EndgameSnapshot) => void;

const state: EndgameState = {
  phase: 'idle',
  metadata: undefined,
  updatedAt: Date.now()
};

const listeners = new Set<EndgameListener>();

function cloneState(): EndgameSnapshot {
  return {
    phase: state.phase,
    metadata: state.metadata ? { ...state.metadata } : undefined,
    updatedAt: state.updatedAt
  };
}

function notifyListeners(nextSnapshot: EndgameSnapshot, prevSnapshot: EndgameSnapshot): void {
  listeners.forEach((listener) => {
    try {
      listener(nextSnapshot, prevSnapshot);
    } catch (error) {
      if (import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.warn('⚠️ endgame-state listener error', error);
      }
    }
  });
}

export function getEndgamePhase(): EndgameSnapshot {
  return cloneState();
}

export function onEndgamePhaseChange(listener: EndgameListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setEndgamePhase(phase: EndgamePhase, metadata?: PhaseMetadata): void {
  const previous = cloneState();
  state.phase = phase;
  state.metadata = metadata ? { ...metadata } : undefined;
  state.updatedAt = Date.now();
  const snapshot = cloneState();
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.log('🧭 endgame-state transition →', phase, metadata ?? {});
  }
  notifyListeners(snapshot, previous);
}

export function resetEndgamePhase(): void {
  setEndgamePhase('idle');
}

