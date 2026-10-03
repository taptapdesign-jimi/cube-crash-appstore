import {
  SettledBoardWatchdog,
  type SettledBoardWatchdogObservation,
} from '../settled-board-watchdog';

class ManualScheduler {
  jobs: Array<{ cancelled: boolean; callback: () => void }> = [];

  schedule(_delayMs: number, callback: () => void): () => void {
    const job = { cancelled: false, callback };
    this.jobs.push(job);
    return () => { job.cancelled = true; };
  }

  flush(): void {
    const jobs = this.jobs.splice(0);
    jobs.forEach((job) => { if (!job.cancelled) job.callback(); });
  }
}

const observation = (
  overrides: Partial<SettledBoardWatchdogObservation> = {},
): SettledBoardWatchdogObservation => ({
  boardRevision: 3,
  fingerprint: 'board-a',
  settled: true,
  logicalMoveAvailable: false,
  visibleInteractiveMoveAvailable: false,
  parityIssues: [],
  ...overrides,
});

function harness(initial = observation()) {
  const scheduler = new ManualScheduler();
  let current = initial;
  const onNoMoves = jest.fn();
  const onInvariant = jest.fn();
  const watchdog = new SettledBoardWatchdog({
    deadlineMs: 700,
    scheduler,
    readCurrent: () => current,
    onNoMoves,
    onInvariant,
  });
  return { scheduler, watchdog, onNoMoves, onInvariant, setCurrent: (next: SettledBoardWatchdogObservation) => { current = next; } };
}

test('commits canonical No Moves once only after the same board remains settled', () => {
  const h = harness();
  h.watchdog.observe(observation());
  expect(h.watchdog.isArmed()).toBe(true);

  h.scheduler.flush();
  h.watchdog.observe(observation());
  h.scheduler.flush();

  expect(h.onNoMoves).toHaveBeenCalledTimes(1);
  expect(h.onInvariant).not.toHaveBeenCalled();
});

test('an invisible logical move becomes a render invariant, never a false No Moves', () => {
  const hiddenSpecial = observation({
    logicalMoveAvailable: true,
    parityIssues: [{ dieId: 'kanta', tile: {}, reason: 'hidden-visual-carrier' }],
  });
  const h = harness(hiddenSpecial);
  h.watchdog.observe(hiddenSpecial);

  h.scheduler.flush();

  expect(h.onInvariant).toHaveBeenCalledWith(expect.objectContaining({
    observation: hiddenSpecial,
  }));
  expect(h.onNoMoves).not.toHaveBeenCalled();
});

test('revision, fingerprint, animation or input activity invalidates the deadline', () => {
  const h = harness();
  h.watchdog.observe(observation());
  h.setCurrent(observation({ boardRevision: 4, fingerprint: 'board-b' }));
  h.scheduler.flush();
  expect(h.onNoMoves).not.toHaveBeenCalled();
  expect(h.watchdog.isArmed()).toBe(true);

  h.setCurrent(observation({ boardRevision: 4, fingerprint: 'board-b', settled: false }));
  h.scheduler.flush();
  expect(h.onNoMoves).not.toHaveBeenCalled();
  expect(h.watchdog.isArmed()).toBe(false);

  h.watchdog.observe(observation({ boardRevision: 5, fingerprint: 'board-c' }));
  h.watchdog.noteActivity();
  h.scheduler.flush();
  expect(h.onNoMoves).not.toHaveBeenCalled();
});

test('a visible interactive move cancels a previously armed deadlock check', () => {
  const h = harness();
  h.watchdog.observe(observation());
  h.setCurrent(observation({ visibleInteractiveMoveAvailable: true }));
  h.scheduler.flush();

  expect(h.onNoMoves).not.toHaveBeenCalled();
  expect(h.onInvariant).not.toHaveBeenCalled();
  expect(h.watchdog.isArmed()).toBe(false);

  h.watchdog.observe(observation({ visibleInteractiveMoveAvailable: true }));
  h.watchdog.observe(observation());
  expect(h.watchdog.isArmed()).toBe(true);
});

test('dispose is idempotent and prevents late commits', () => {
  const h = harness();
  h.watchdog.observe(observation());
  h.watchdog.dispose();
  h.watchdog.dispose();
  h.scheduler.flush();

  expect(h.onNoMoves).not.toHaveBeenCalled();
  expect(h.onInvariant).not.toHaveBeenCalled();
});
