import {
  beginGameplayEntryPreparation,
  cancelGameplayEntryPreparation,
  commitPreparedGameplayEntry,
  hasPreparedGameplayEntry,
  isGameplayEntryPending,
  isGameplayEntryGenerationLatest,
  prepareGameplayEntryCommit,
} from '../gameplay-entry-coordinator';

afterEach(() => cancelGameplayEntryPreparation());

test('cold and warm readiness use the same single commit owner', async () => {
  const events: string[] = [];
  const generation = beginGameplayEntryPreparation('cold-play');
  const completion = prepareGameplayEntryCommit(generation, async () => {
    events.push('commit');
  });

  expect(isGameplayEntryPending()).toBe(true);
  expect(hasPreparedGameplayEntry()).toBe(true);
  expect(events).toEqual([]);

  const first = commitPreparedGameplayEntry();
  const duplicate = commitPreparedGameplayEntry();
  await Promise.all([completion, first, duplicate]);

  expect(events).toEqual(['commit']);
  expect(isGameplayEntryPending()).toBe(false);
});

test('a newer entry retires stale prepared work without committing it', async () => {
  const events: string[] = [];
  const stale = beginGameplayEntryPreparation('stale');
  const staleDone = prepareGameplayEntryCommit(stale, () => { events.push('stale'); });
  const current = beginGameplayEntryPreparation('current');
  prepareGameplayEntryCommit(current, () => { events.push('current'); });

  await staleDone;
  await commitPreparedGameplayEntry();
  expect(events).toEqual(['current']);
  expect(isGameplayEntryGenerationLatest(stale)).toBe(false);
  expect(isGameplayEntryGenerationLatest(current)).toBe(true);
});

test('replacing an in-flight entry aborts its visual owner', async () => {
  let releaseCommit = () => {};
  let staleSignal: AbortSignal | null = null;
  const stale = beginGameplayEntryPreparation('stale-running');
  prepareGameplayEntryCommit(stale, async (signal) => {
    staleSignal = signal;
    await new Promise<void>((resolve) => { releaseCommit = resolve; });
  });

  void commitPreparedGameplayEntry();
  await Promise.resolve();
  expect(staleSignal?.aborted).toBe(false);

  const current = beginGameplayEntryPreparation('replacement');
  expect(staleSignal?.aborted).toBe(true);
  prepareGameplayEntryCommit(current, () => {});
  releaseCommit();
  await commitPreparedGameplayEntry();
});
