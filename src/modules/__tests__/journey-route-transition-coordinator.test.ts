/** @jest-environment jsdom */

import {
  JourneyRouteTransitionCoordinator,
  type JourneyRouteTransitionDependencies,
} from '../journey-route-transition-coordinator';

const createFixture = () => {
  const criticalReleases: jest.Mock[] = [];
  const audioReleases: jest.Mock[] = [];
  const presentationReleases: jest.Mock[] = [];
  const acquireCriticalLease = jest.fn(() => {
    const release = jest.fn();
    criticalReleases.push(release);
    return release;
  });
  const acquirePresentationLease = jest.fn(() => {
    const release = jest.fn();
    presentationReleases.push(release);
    return release;
  });
  const acquireAudioWorkingSet = jest.fn(() => {
    const release = jest.fn();
    audioReleases.push(release);
    return release;
  });
  const publishAppZone = jest.fn();
  const emitDiagnostic = jest.fn();
  const dependencies: JourneyRouteTransitionDependencies = {
    acquireCriticalLease,
    acquireAudioWorkingSet,
    acquirePresentationLease,
    publishAppZone,
    emitDiagnostic,
  };
  return {
    coordinator: new JourneyRouteTransitionCoordinator(dependencies),
    acquireCriticalLease,
    acquireAudioWorkingSet,
    acquirePresentationLease,
    publishAppZone,
    emitDiagnostic,
    criticalReleases,
    audioReleases,
    presentationReleases,
  };
};

describe('JourneyRouteTransitionCoordinator', () => {
  test('explicit external-route cancellation retires all leases without republishing the source zone', async () => {
    const f = createFixture();
    const token = f.coordinator.begin({ view: 'hub' }, { view: 'world', worldId: 2 }, 'native-world');
    const timeline = { kill: jest.fn() };
    f.coordinator.claimTimeline(token, timeline);
    expect(f.coordinator.interrupt(token, 'foreign-route', { rollbackZone: false })).toBe(true);
    expect(f.publishAppZone).toHaveBeenCalledTimes(1);
    expect(timeline.kill).toHaveBeenCalledTimes(1);
    expect(f.criticalReleases[0]).toHaveBeenCalledTimes(1);
    expect(f.audioReleases[0]).toHaveBeenCalledTimes(1);
    expect(f.presentationReleases[0]).toHaveBeenCalledTimes(1);
    await expect(token.completion).resolves.toMatchObject({ status: 'interrupted', reason: 'foreign-route' });
  });
  test('publishes Journey ownership and owns one resource, audio and presentation lease plus timeline', async () => {
    const fixture = createFixture();
    const token = fixture.coordinator.begin(
      { view: 'home' },
      { view: 'hub' },
      'homepage-to-hub',
    );
    const timeline = { kill: jest.fn() };

    expect(fixture.acquireCriticalLease).toHaveBeenCalledTimes(1);
    expect(fixture.publishAppZone).toHaveBeenCalledWith(
      'journey',
      'journey-route:homepage-to-hub',
    );
    expect(fixture.coordinator.claimTimeline(token, timeline)).toBe(true);
    expect(() => fixture.coordinator.claimTimeline(token, { kill: jest.fn() }))
      .toThrow('already owns a master timeline');

    expect(fixture.coordinator.complete(token, 'hub-visible')).toBe(true);
    await expect(token.completion).resolves.toMatchObject({
      status: 'completed',
      reason: 'hub-visible',
    });
    expect(timeline.kill).not.toHaveBeenCalled();
    expect(fixture.criticalReleases[0]).toHaveBeenCalledTimes(1);
    expect(fixture.audioReleases[0]).toHaveBeenCalledTimes(1);
    expect(fixture.presentationReleases[0]).toHaveBeenCalledTimes(1);
    expect(fixture.coordinator.getSnapshot()).toMatchObject({ active: false });
  });

  test('replacement interrupts the old owner before acquiring the next lease', async () => {
    const fixture = createFixture();
    const cleanup = jest.fn();
    const firstTimeline = { kill: jest.fn() };
    const first = fixture.coordinator.begin({ view: 'hub' }, { view: 'world', worldId: 1 }, 'forest');
    fixture.coordinator.claimTimeline(first, firstTimeline);
    fixture.coordinator.addCleanup(first, cleanup);

    const second = fixture.coordinator.begin({ view: 'hub' }, { view: 'world', worldId: 2 }, 'beach');

    await expect(first.completion).resolves.toMatchObject({
      status: 'interrupted',
      reason: 'replaced:beach',
    });
    expect(firstTimeline.kill).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(fixture.criticalReleases[0]).toHaveBeenCalledTimes(1);
    expect(fixture.audioReleases[0]).toHaveBeenCalledTimes(1);
    expect(fixture.presentationReleases[0]).toHaveBeenCalledTimes(1);
    expect(fixture.acquireCriticalLease).toHaveBeenCalledTimes(2);
    expect(fixture.publishAppZone).toHaveBeenCalledTimes(2);
    expect(fixture.publishAppZone).not.toHaveBeenCalledWith(
      'journey',
      'journey-route-rollback:replaced:beach',
    );
    expect(fixture.coordinator.isCurrent(first)).toBe(false);
    expect(fixture.coordinator.isCurrent(second)).toBe(true);
  });

  test('failed Homepage handoff rolls route ownership back to Home', async () => {
    const fixture = createFixture();
    const token = fixture.coordinator.begin({ view: 'home' }, { view: 'hub' }, 'open');

    expect(fixture.coordinator.interrupt(token, 'prepare-failed')).toBe(true);
    await expect(token.completion).resolves.toMatchObject({ status: 'interrupted' });
    expect(fixture.publishAppZone).toHaveBeenLastCalledWith(
      'home',
      'journey-route-rollback:prepare-failed',
    );
  });

  test('stale timeline claims are killed and cannot replace the live owner', () => {
    const fixture = createFixture();
    const stale = fixture.coordinator.begin({ view: 'home' }, { view: 'hub' }, 'first');
    const current = fixture.coordinator.begin({ view: 'home' }, { view: 'hub' }, 'second');
    const staleTimeline = { kill: jest.fn() };
    const currentTimeline = { kill: jest.fn() };

    expect(fixture.coordinator.claimTimeline(stale, staleTimeline)).toBe(false);
    expect(staleTimeline.kill).toHaveBeenCalledTimes(1);
    expect(fixture.coordinator.claimTimeline(current, currentTimeline)).toBe(true);
    expect(fixture.coordinator.getSnapshot()).toMatchObject({
      active: true,
      generation: current.generation,
      timelineClaimed: true,
    });
  });

  test('publishes Home for a Journey back transition', () => {
    const fixture = createFixture();
    fixture.coordinator.begin({ view: 'hub' }, { view: 'home' }, 'hub-to-home');

    expect(fixture.publishAppZone).toHaveBeenLastCalledWith(
      'home',
      'journey-route:hub-to-home',
    );
  });

  test('interrupt and dispose consume cleanup and lease exactly once', async () => {
    const fixture = createFixture();
    const cleanup = jest.fn();
    const timeline = { kill: jest.fn() };
    const token = fixture.coordinator.begin({ view: 'world', worldId: 3 }, { view: 'hub' }, 'close');
    fixture.coordinator.claimTimeline(token, timeline);
    fixture.coordinator.addCleanup(token, cleanup);

    expect(fixture.coordinator.interrupt(token, 'background')).toBe(true);
    expect(fixture.coordinator.interrupt(token, 'duplicate')).toBe(false);
    fixture.coordinator.dispose();

    await expect(token.completion).resolves.toMatchObject({
      status: 'interrupted',
      reason: 'background',
    });
    expect(timeline.kill).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(fixture.criticalReleases[0]).toHaveBeenCalledTimes(1);
    expect(fixture.audioReleases[0]).toHaveBeenCalledTimes(1);
    expect(fixture.presentationReleases[0]).toHaveBeenCalledTimes(1);
    expect(() => fixture.coordinator.begin({ view: 'home' }, { view: 'hub' }, 'late'))
      .toThrow('disposed');
  });

  test('keeps presentation resources and audio through the complete incoming cascade while route completion keeps its visible-start semantics', async () => {
    const fixture = createFixture();
    const token = fixture.coordinator.begin(
      { view: 'hub' },
      { view: 'world', worldId: 1 },
      'forest',
    );
    let finishPresentation!: () => void;
    const presentationCompletion = new Promise<void>((resolve) => {
      finishPresentation = resolve;
    });

    expect(fixture.coordinator.holdPresentationLeasesUntil(token, presentationCompletion)).toBe(true);
    expect(fixture.coordinator.complete(token, 'world-visible-enter-started')).toBe(true);
    await expect(token.completion).resolves.toMatchObject({ status: 'completed' });
    expect(fixture.criticalReleases[0]).toHaveBeenCalledTimes(1);
    expect(fixture.audioReleases[0]).not.toHaveBeenCalled();
    expect(fixture.presentationReleases[0]).not.toHaveBeenCalled();

    finishPresentation();
    await presentationCompletion;
    await Promise.resolve();
    expect(fixture.audioReleases[0]).toHaveBeenCalledTimes(1);
    expect(fixture.presentationReleases[0]).toHaveBeenCalledTimes(1);
  });

  test('interrupt releases handed-off presentation leases immediately and late completion is idempotent', async () => {
    const fixture = createFixture();
    const token = fixture.coordinator.begin(
      { view: 'world', worldId: 3 },
      { view: 'hub' },
      'close',
    );
    let finishPresentation!: () => void;
    const presentationCompletion = new Promise<void>((resolve) => {
      finishPresentation = resolve;
    });

    expect(fixture.coordinator.holdPresentationLeasesUntil(token, presentationCompletion)).toBe(true);
    expect(fixture.coordinator.interrupt(token, 'replaced')).toBe(true);
    expect(fixture.audioReleases[0]).toHaveBeenCalledTimes(1);
    expect(fixture.presentationReleases[0]).toHaveBeenCalledTimes(1);

    finishPresentation();
    await presentationCompletion;
    await Promise.resolve();
    expect(fixture.audioReleases[0]).toHaveBeenCalledTimes(1);
    expect(fixture.presentationReleases[0]).toHaveBeenCalledTimes(1);
  });
});
