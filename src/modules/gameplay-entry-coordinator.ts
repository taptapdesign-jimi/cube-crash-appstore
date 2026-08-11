type GameplayEntryCommit = (signal: AbortSignal) => Promise<void> | void;

type PendingEntry = {
  generation: number;
  reason: string;
  commit: GameplayEntryCommit | null;
  promise: Promise<void>;
  resolve: () => void;
  committing: boolean;
  controller: AbortController;
};

let generation = 0;
let activeEntry: PendingEntry | null = null;

function createPendingEntry(reason: string): PendingEntry {
  let resolve = () => {};
  const promise = new Promise<void>((done) => { resolve = done; });
  return {
    generation: ++generation,
    reason,
    commit: null,
    promise,
    resolve,
    committing: false,
    controller: new AbortController(),
  };
}

/** Starts one entry transaction and harmlessly retires any stale predecessor. */
export function beginGameplayEntryPreparation(reason: string): number {
  activeEntry?.controller.abort();
  activeEntry?.resolve();
  activeEntry = createPendingEntry(reason);
  return activeEntry.generation;
}

/** Registers the only visual commit allowed for this prepared gameplay entry. */
export function prepareGameplayEntryCommit(
  entryGeneration: number,
  commit: GameplayEntryCommit,
): Promise<void> {
  const entry = activeEntry;
  if (!entry || entry.generation !== entryGeneration) return Promise.resolve();
  entry.commit = commit;
  return entry.promise;
}

export function isGameplayEntryPending(): boolean {
  return !!activeEntry;
}

export function isGameplayEntryGenerationLatest(entryGeneration: number): boolean {
  return entryGeneration === generation;
}

export function hasPreparedGameplayEntry(): boolean {
  return !!activeEntry?.commit;
}

/**
 * Commits after the host is visible. Repeated callers share the same promise;
 * a stale generation can never reveal a newer board.
 */
export function commitPreparedGameplayEntry(): Promise<void> {
  const entry = activeEntry;
  if (!entry?.commit) return Promise.resolve();
  if (entry.committing) return entry.promise;

  entry.committing = true;
  const commit = entry.commit;
  void Promise.resolve()
    .then(() => commit(entry.controller.signal))
    .catch(() => {
      // The animation owner already finalizes its safe visual state. Keep this
      // lifecycle promise non-throwing so navigation cannot deadlock.
    })
    .finally(() => {
      if (activeEntry?.generation === entry.generation) activeEntry = null;
      entry.resolve();
    });
  return entry.promise;
}

export function cancelGameplayEntryPreparation(): void {
  const entry = activeEntry;
  activeEntry = null;
  generation += 1;
  entry?.controller.abort();
  entry?.resolve();
}
