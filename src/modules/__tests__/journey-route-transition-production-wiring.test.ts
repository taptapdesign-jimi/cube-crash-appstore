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
    expect(close).toContain('journeyRouteTransitionCoordinator.begin(');
    expect(close).toContain('journeyRouteTransitionCoordinator.complete(');
    expect(close).toContain('journeyRouteTransitionCoordinator.interrupt(');
    expect(open).not.toContain("acquireForegroundResourceCriticalLease('journey-transition')");
    expect(close).not.toContain("acquireForegroundResourceCriticalLease('journey-transition')");
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
    expect(open.indexOf('this.playJourneyV700NavEnter();'))
      .toBeLessThan(open.indexOf('visibleEnterStarted = true;'));
  });

  test('cold World construction stays detached until the bounded compositor commit', () => {
    const source = read('src/modules/journey-boards-manager.ts');
    const prepaint = source.split('private prepareJourneyWorldPrepaint(')[1]
      ?.split('private commitRetainedJourneyWorld(')[0] ?? '';

    expect(prepaint.indexOf('await this.renderJourneyWorldIncrementally(detachedRoot, worldId, isCurrent)'))
      .toBeLessThan(prepaint.indexOf('container.insertBefore(host, hub || container.firstChild)'));
    expect(prepaint.indexOf('await this.primeJourneyV700WorldEnterIncrementally('))
      .toBeLessThan(prepaint.indexOf('container.insertBefore(host, hub || container.firstChild)'));
    expect(prepaint).toContain('for (let frameIndex = 0; frameIndex < 1; frameIndex += 1)');
  });

  test('cold Hub construction also stays detached until one bounded compositor commit', () => {
    const source = read('src/modules/journey-boards-manager.ts');
    const prepaint = source.split('private prepareJourneyHubPrepaint(')[1]
      ?.split('private refreshJourneyV700HubProgress(')[0] ?? '';
    const connectIndex = prepaint.indexOf('container.insertBefore(host, container.firstChild)');

    expect(prepaint.indexOf('this.renderJourneyV700Hub(root, { prepaint: true })'))
      .toBeLessThan(connectIndex);
    expect(prepaint.indexOf('await this.prepareJourneyHubImagesForReveal(root, this.journeyV700WorldId)'))
      .toBeLessThan(connectIndex);
    expect(prepaint).toContain('const painted = await this.waitForTrackedFrames(1)');
    expect(prepaint).not.toContain('await this.waitForTrackedFrames(3)');
  });
});
