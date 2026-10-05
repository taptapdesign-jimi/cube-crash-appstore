import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('Journey route transition production wiring', () => {
  test('Homepage to Hub publishes one route transaction before async preparation', () => {
    const source = read('src/modules/ui-manager.ts');
    const method = source.split('private showCollectiblesScreenWithAnimation(')[1]
      ?.split('private queueJourneyOpenAfterHomepageEnter(')[0] ?? '';

    const beginIndex = method.indexOf('journeyRouteTransitionCoordinator.begin(');
    const prepareIndex = method.indexOf('const journeyPreparePromise');
    expect(beginIndex).toBeGreaterThanOrEqual(0);
    expect(beginIndex).toBeLessThan(prepareIndex);
    expect(method).toContain("journeyRouteTransitionCoordinator.interrupt(journeyRouteToken, 'homepage-to-hub-failed')");
    expect(method).toContain("journeyRouteTransitionCoordinator.complete(journeyRouteToken, 'hub-visible-enter-started')");
  });

  test('Hub and World routes use the same coordinator instead of independent critical leases', () => {
    const source = read('src/modules/journey-boards-manager.ts');
    const open = source.split('private openJourneyV700World(')[1]
      ?.split('private releaseJourneyMainCloudComposites(')[0] ?? '';
    const close = source.split('private closeJourneyV700World(): void {')[1]
      ?.split('private markJourneyDevBoardRefresh(')[0] ?? '';

    expect(open).toContain('journeyRouteTransitionCoordinator.begin(');
    expect(open).toContain('journeyRouteTransitionCoordinator.complete(');
    expect(open).toContain('journeyRouteTransitionCoordinator.interrupt(');
    expect(open).toContain('journeyRouteTransitionCoordinator.holdPresentationLeasesUntil(');
    expect(open).toContain('journeyRouteTransitionCoordinator.claimTimeline(');
    expect(close).toContain('journeyRouteTransitionCoordinator.begin(');
    expect(close).toContain('journeyRouteTransitionCoordinator.complete(');
    expect(close).toContain('journeyRouteTransitionCoordinator.interrupt(');
    expect(close).toContain('journeyRouteTransitionCoordinator.holdPresentationLeasesUntil(');
    expect(close).toContain('journeyRouteTransitionCoordinator.claimTimeline(');
    expect(open).not.toContain("acquireForegroundResourceCriticalLease('journey-transition')");
    expect(close).not.toContain("acquireForegroundResourceCriticalLease('journey-transition')");
  });

  test('accepted Hub taps start exit before preparing only their destination', () => {
    const source = read('src/modules/journey-boards-manager.ts');
    const open = source.split('private openJourneyV700World(')[1]
      ?.split('private releaseJourneyMainCloudComposites(')[0] ?? '';
    const residentPreparation = source.split('private prepareJourneyResidentWorldsUnderCover(')[1]
      ?.split('private prepareJourneyWorldPrepaint(')[0] ?? '';

    expect(open).toContain('const destinationReady = hasRetainedWorld');
    expect(open.indexOf('this.prepareJourneyWorldPrepaint('))
      .toBeGreaterThan(open.indexOf('this.playJourneyV700HubExit('));
    expect(open).not.toContain('renderJourneyWorldIncrementally(');
    expect(open).not.toContain('waitForImageReady(');
    expect(open).not.toContain('getBoundingClientRect(');
    expect(open).not.toContain('waitForJourneyResidentWorld');
    expect(open).not.toContain('playJourneyResidentTapFeedback');
    expect(open).not.toContain('await worldPrepaintReady');
    expect(open.indexOf('this.journeyHubRuntime.prepareForTransition(')).toBeGreaterThanOrEqual(0);
    expect(open.indexOf('this.playJourneyV700HubExit('))
      .toBeGreaterThan(open.indexOf('this.journeyHubRuntime.prepareForTransition('));

    expect(residentPreparation).toBe('');
  });

  test('World return re-primes the detached resident plan before a later Hub tap', () => {
    const source = read('src/modules/journey-boards-manager.ts');
    const toHub = source.split('private commitRetainedJourneyHub(')[1]
      ?.split('private async commitJourneyHubPrepaint(')[0] ?? '';
    const toWorld = source.split('private commitRetainedJourneyWorld(')[1]
      ?.split('private commitJourneyWorldPrepaint(')[0] ?? '';

    expect(toHub).toContain("source: 'world-to-hub-resident-reprime'");
    expect(toHub.indexOf('this.primeJourneyV700WorldEnter(container, closingWorldId,'))
      .toBeLessThan(toHub.indexOf('this.beginRenderLifecycle();'));
    expect(toHub).toContain('this.journeyResidentPreparedEnters.set(closingWorldId,');
    expect(toWorld).toContain('const residentPreparedEnter = this.journeyResidentPreparedEnters.get(worldId);');
    expect(toWorld).toContain('reusedResidentPreparedEnter: !!this.journeyV700PreparedWorldEnter');
  });

  test('full Journey cleanup releases route protection and the persistent core audio set', () => {
    const source = read('src/modules/journey-boards-manager.ts');
    const cleanup = source.split('public cleanup(): void {')[1]
      ?.split('private ', 1)[0] ?? '';

    expect(cleanup).toContain("journeyRouteTransitionCoordinator.interruptCurrent('manager-cleanup')");
    expect(cleanup).toContain('releaseJourneyCoreAudioWorkingSet();');

    const suspend = source.split('public suspendForGameplay(): void {')[1]
      ?.split('public cleanup(): void {')[0] ?? '';
    expect(suspend).toContain('releaseJourneyCoreAudioWorkingSet();');
  });

  test('Journey presentation protection blocks competing resource work without waking hidden Pixi', () => {
    const coordinator = read('src/modules/journey-route-transition-coordinator.ts');

    expect(coordinator.match(/acquireForegroundResourceCriticalLease\('journey-transition'\)/g))
      .toHaveLength(2);
    expect(coordinator).not.toContain('acquirePixiMobileActivityLease');
  });

  test('Hub to World completes only after visible enter starts and interrupts a cancelled enter frame', () => {
    const source = read('src/modules/journey-boards-manager.ts');
    const open = source.split('private openJourneyV700World(')[1]
      ?.split('private releaseJourneyMainCloudComposites(')[0] ?? '';

    expect(open).toContain("journeyRouteTransitionCoordinator.complete(routeTransitionToken, 'world-visible-enter-started')");
    expect(open).toContain("interruptRouteTransition('world-visible-enter-not-started')");
    expect(open).toContain("interruptRouteTransition('world-visible-enter-frame-cancelled')");
    expect(open).toContain('visibleEnterStarted = true;');
    expect(open.indexOf('this.playJourneyV700WorldEnter(container, worldId,'))
      .toBeLessThan(open.indexOf('visibleEnterStarted = true;'));
    expect(open.indexOf('journeyRouteTransitionCoordinator.holdPresentationLeasesUntil('))
      .toBeLessThan(open.indexOf('visibleEnterStarted = true;'));
    expect(open.indexOf('this.playJourneyV700NavEnter();'))
      .toBeLessThan(open.indexOf('visibleEnterStarted = true;'));
  });

  test('cold World construction stays detached until the bounded compositor commit', () => {
    const source = read('src/modules/journey-boards-manager.ts');
    const prepaint = source.split('private prepareJourneyWorldPrepaint(')[1]
      ?.split('private commitRetainedJourneyWorld(')[0] ?? '';

    expect(prepaint).toContain('await this.renderJourneyWorldIncrementally(detachedRoot, worldId, isCurrent)');
    expect(prepaint).toContain('await this.primeJourneyV700WorldEnterIncrementally(');
    expect(prepaint).not.toContain('container.insertBefore');
    expect(prepaint).not.toContain('waitForTrackedFrames');
    expect(prepaint).toContain("host.style.opacity = '1'");
    expect(prepaint).not.toContain('getBoundingClientRect');
  });

  test('cold Hub fallback stays detached until the atomic commit', () => {
    const source = read('src/modules/journey-boards-manager.ts');
    const prepaint = source.split('private prepareJourneyHubPrepaint(')[1]
      ?.split('private refreshJourneyV700HubProgress(')[0] ?? '';
    expect(prepaint.indexOf('this.renderJourneyV700Hub(root, { prepaint: true })'))
      .toBeGreaterThanOrEqual(0);
    expect(prepaint.indexOf('await this.prepareJourneyHubImagesForReveal(root, this.journeyV700WorldId)'))
      .toBeGreaterThanOrEqual(0);
    expect(prepaint).not.toContain('container.insertBefore(host, container.firstChild)');
    expect(prepaint).not.toContain('waitForTrackedFrames');
    expect(prepaint).toContain("host.style.opacity = '1'");
    expect(prepaint).not.toContain('getBoundingClientRect');
  });
});
