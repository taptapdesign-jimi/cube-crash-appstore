import { JourneyWorldRuntimeScheduler } from '../journey-world-runtime-scheduler';

describe('Journey World runtime scheduler', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('serializes transition, modal, scroll, settle and idle for any world id', () => {
    const scrollRoot = document.createElement('div');
    const scheduler = new JourneyWorldRuntimeScheduler(180, 48);
    const states: string[] = [];
    scheduler.subscribe(({ state }) => states.push(state));

    scheduler.activate(7, scrollRoot);
    expect(scheduler.getSnapshot()).toMatchObject({
      state: 'idle',
      worldId: 7,
      paintSuspended: false,
      ambientSuspended: false,
    });

    scrollRoot.dispatchEvent(new Event('scroll'));
    expect(scheduler.getSnapshot()).toMatchObject({
      state: 'scrolling',
      paintSuspended: true,
      ambientSuspended: false,
      ambientScrollBoosted: true,
    });
    jest.advanceTimersByTime(180);
    expect(scheduler.getSnapshot()).toMatchObject({
      state: 'settling',
      ambientSuspended: false,
      ambientScrollBoosted: true,
    });
    jest.advanceTimersByTime(48);
    expect(scheduler.getSnapshot().state).toBe('idle');

    scheduler.openModal();
    expect(scheduler.getSnapshot()).toMatchObject({
      state: 'modal',
      paintSuspended: true,
      ambientSuspended: true,
    });
    scheduler.beginTransition();
    expect(scheduler.getSnapshot()).toMatchObject({
      state: 'transition',
      ambientSuspended: true,
    });
    scheduler.endTransition();
    expect(scheduler.getSnapshot().state).toBe('modal');
    scheduler.closeModal();
    expect(scheduler.getSnapshot().state).toBe('idle');
    expect(states).toEqual(expect.arrayContaining(['inactive', 'scrolling', 'settling', 'modal', 'transition']));
  });

  it('owns one scroll listener and cancels stale handoffs across world replacement', () => {
    const firstRoot = document.createElement('div');
    const secondRoot = document.createElement('div');
    const scheduler = new JourneyWorldRuntimeScheduler(180, 48);

    scheduler.activate(1, firstRoot);
    firstRoot.dispatchEvent(new Event('scroll'));
    expect(scheduler.getSnapshot().state).toBe('scrolling');
    scheduler.activate(4, secondRoot);
    expect(scheduler.getSnapshot()).toMatchObject({ state: 'idle', worldId: 4 });

    jest.advanceTimersByTime(500);
    expect(scheduler.getSnapshot()).toMatchObject({ state: 'idle', worldId: 4 });
    firstRoot.dispatchEvent(new Event('scroll'));
    expect(scheduler.getSnapshot().state).toBe('idle');
    secondRoot.dispatchEvent(new Event('scroll'));
    expect(scheduler.getSnapshot().state).toBe('scrolling');

    scheduler.dispose();
    expect(scheduler.getSnapshot()).toMatchObject({ state: 'inactive', worldId: null });
  });

  it('can activate directly into transition without exposing an idle paint frame', () => {
    const scheduler = new JourneyWorldRuntimeScheduler();
    const states: string[] = [];
    scheduler.subscribe(({ state }) => states.push(state));

    scheduler.activate(2, document.createElement('div'), 'transition');
    expect(scheduler.getSnapshot()).toMatchObject({
      state: 'transition',
      worldId: 2,
      paintSuspended: true,
      ambientSuspended: true,
    });
    expect(states).toEqual(['inactive', 'transition']);

    scheduler.endTransition();
    expect(scheduler.getSnapshot().state).toBe('idle');
  });

  it('holds World and ambient paint through a modal dismiss tail', () => {
    const scrollRoot = document.createElement('div');
    const scheduler = new JourneyWorldRuntimeScheduler(180, 48);
    const states: string[] = [];
    scheduler.subscribe(({ state }) => states.push(state));
    scheduler.activate(1, scrollRoot);

    scheduler.openModal();
    scheduler.beginInteractionSettle();
    scheduler.closeModal();
    expect(scheduler.getSnapshot()).toMatchObject({
      state: 'settling',
      paintSuspended: true,
      ambientSuspended: true,
    });

    const beforeReopen = states.length;
    scheduler.openModal();
    scheduler.endInteractionSettle();
    expect(states.slice(beforeReopen)).toEqual(['modal']);
    scheduler.closeModal();
    expect(scheduler.getSnapshot().state).toBe('idle');
  });

  it('can resume only ambient paint before dismiss smoke while World paint stays paused', () => {
    const scheduler = new JourneyWorldRuntimeScheduler(180, 48);
    const snapshots: Array<{ state: string; paintSuspended: boolean; ambientSuspended: boolean }> = [];
    scheduler.subscribe(({ state, paintSuspended, ambientSuspended }) => {
      snapshots.push({ state, paintSuspended, ambientSuspended });
    });
    scheduler.activate(1, document.createElement('div'));
    scheduler.openModal();
    scheduler.beginInteractionSettle();
    scheduler.closeModal();

    scheduler.releaseAmbientDuringInteractionSettle();
    expect(scheduler.getSnapshot()).toMatchObject({
      state: 'settling',
      paintSuspended: true,
      ambientSuspended: false,
    });
    expect(snapshots[snapshots.length - 1]).toEqual({
      state: 'settling',
      paintSuspended: true,
      ambientSuspended: false,
    });

    scheduler.endInteractionSettle();
    expect(scheduler.getSnapshot()).toMatchObject({
      state: 'idle',
      paintSuspended: false,
      ambientSuspended: false,
    });
  });

  it('hands an active dismiss settle directly to native scroll', () => {
    const scrollRoot = document.createElement('div');
    const scheduler = new JourneyWorldRuntimeScheduler(180, 48);
    scheduler.activate(1, scrollRoot);
    scheduler.beginInteractionSettle();
    expect(scheduler.getSnapshot().state).toBe('settling');

    scrollRoot.dispatchEvent(new Event('scroll'));
    expect(scheduler.getSnapshot()).toMatchObject({
      state: 'scrolling',
      ambientSuspended: false,
      ambientScrollBoosted: true,
    });
    jest.advanceTimersByTime(228);
    expect(scheduler.getSnapshot().state).toBe('idle');
  });
});
