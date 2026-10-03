import {
  acquireForegroundResourceCriticalLease,
  deferUntilForegroundResourceIdle,
  getForegroundResourceCoordinatorSnapshot,
  resetForegroundResourceCoordinator,
  subscribeForegroundResourceIdle,
} from '../foreground-resource-coordinator';

describe('foreground resource coordinator', () => {
  beforeEach(() => resetForegroundResourceCoordinator());
  afterEach(() => resetForegroundResourceCoordinator());

  test('nested presentation owners defer and serialize work after the final release', () => {
    jest.useFakeTimers();
    const events: string[] = [];
    const releaseJourney = acquireForegroundResourceCriticalLease('journey-transition');
    const releaseCard = acquireForegroundResourceCriticalLease('journey-card');
    const unsubscribe = subscribeForegroundResourceIdle(() => events.push('idle'));

    deferUntilForegroundResourceIdle('audio:old-route', () => events.push('old'));
    deferUntilForegroundResourceIdle('audio:old-route', () => events.push('new'));
    deferUntilForegroundResourceIdle('gpu:atlas', () => events.push('gpu'));
    expect(getForegroundResourceCoordinatorSnapshot()).toMatchObject({
      criticalDepth: 2,
      deferredTaskCount: 2,
    });

    releaseJourney();
    releaseJourney();
    expect(events).toEqual([]);

    releaseCard();
    expect(events).toEqual(['idle']);
    jest.advanceTimersByTime(20);
    expect(events).toEqual(['idle', 'new']);
    expect(getForegroundResourceCoordinatorSnapshot().deferredTaskCount).toBe(1);
    jest.advanceTimersByTime(20);
    expect(events).toEqual(['idle', 'new', 'gpu']);
    expect(getForegroundResourceCoordinatorSnapshot()).toMatchObject({
      criticalDepth: 0,
      deferredTaskCount: 0,
    });
    unsubscribe();
    jest.useRealTimers();
  });

  test('idle work runs immediately and cancellation retires deferred work', () => {
    jest.useFakeTimers();
    const run = jest.fn();
    deferUntilForegroundResourceIdle('immediate', run);
    expect(run).toHaveBeenCalledTimes(1);

    const release = acquireForegroundResourceCriticalLease('renderer-recovery');
    const cancel = deferUntilForegroundResourceIdle('gpu:atlas', run);
    cancel();
    cancel();
    release();
    jest.advanceTimersByTime(20);
    expect(run).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
