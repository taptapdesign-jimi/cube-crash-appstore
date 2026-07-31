import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const journeyManagerSource = fs.readFileSync(
  path.join(root, 'src/modules/journey-boards-manager.ts'),
  'utf8',
);
const collectiblesSource = fs.readFileSync(
  path.join(root, 'src/collectibles-manager.ts'),
  'utf8',
);
const uiManagerSource = fs.readFileSync(
  path.join(root, 'src/modules/ui-manager.ts'),
  'utf8',
);

describe('Journey Hub transition ownership', () => {
  test('Hub renderer is DOM-only and delegates visible motion to the coordinator', () => {
    const renderSource = journeyManagerSource.split(
      'private renderJourneyV700Hub(container: HTMLElement): void',
    )[1]?.split('private cancelJourneyV700HubEnter(reason: string): void')[0] ?? '';

    expect(renderSource).toContain("this.playJourneyV700HubEnter('world-return')");
    expect(renderSource).not.toContain('gsap.fromTo(');
    expect(renderSource).not.toContain('journeySpatialMotion.activateJourneyHub');
  });

  test('forward navigation never invokes the Homepage recovery reset', () => {
    const showSource = collectiblesSource.split(
      'async showCollectibles(options?: CollectiblesShowOptions): Promise<void>',
    )[1]?.split('async hideCollectibles(')[0] ?? '';

    expect(showSource).not.toContain('sliderManager.forceReady(');
    expect(showSource).toContain('sliderManager.syncHiddenSlideState(1)');
  });

  test('Homepage motion is released before its Journey exit starts', () => {
    const handoffSource = uiManagerSource.split(
      'private showCollectiblesScreenWithAnimation(): void',
    )[1]?.split('async hideCollectiblesScreenWithAnimation')[0] ?? '';
    const releaseIndex = handoffSource.indexOf('journeySpatialMotion.suspendHomepage()');
    const exitIndex = handoffSource.indexOf('animateJourneySliderExit()');

    expect(releaseIndex).toBeGreaterThanOrEqual(0);
    expect(exitIndex).toBeGreaterThan(releaseIndex);
    expect(handoffSource).not.toContain('new Promise<void>(resolve => setTimeout(resolve, 900))');
  });

  test('Journey Homepage exit has one Promise owner and never uses the negative-scale CSS curve', () => {
    const animationsSource = fs.readFileSync(
      path.join(root, 'src/utils/animations.ts'),
      'utf8',
    );
    const journeyExitSource = animationsSource.split(
      'export const animateJourneySliderExit = (): Promise<void>',
    )[1]?.split('export const finalizeJourneySliderExit')[0] ?? '';

    expect(journeyExitSource).toContain("easing: 'cubic-bezier(0.32, 0, 0.67, 0)'");
    expect(journeyExitSource).not.toContain('cubic-bezier(0.68, -0.6, 0.32, 1.6)');
    expect(journeyExitSource).not.toContain("classList.add('animate-exit')");
  });
});
