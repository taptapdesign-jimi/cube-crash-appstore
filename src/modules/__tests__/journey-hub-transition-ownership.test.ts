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
const mainSource = fs.readFileSync(path.join(root, 'src/main.ts'), 'utf8');
const sliderManagerSource = fs.readFileSync(path.join(root, 'src/modules/slider-manager.ts'), 'utf8');
const appZoneSource = fs.readFileSync(path.join(root, 'src/modules/app-zone-manager.ts'), 'utf8');
const collectiblesCssSource = fs.readFileSync(path.join(root, 'src/collectibles-screen.css'), 'utf8');

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

  test('fast Back to Enter cancels the Homepage owner before Journey starts', () => {
    const journeyHandoffSource = uiManagerSource.split(
      'private showCollectiblesScreenWithAnimation(): void',
    )[1]?.split('async hideCollectiblesScreenWithAnimation')[0] ?? '';
    const homepageEnterSource = mainSource.split(
      'async function playHomepageSliderEnterHandoff(',
    )[1]?.split('(window as any).__ccPlayHomepageSliderEnterHandoff')[0] ?? '';

    expect(journeyHandoffSource).toContain("homepageEnterTransitionOwner.cancel('homepage-to-journey')");
    expect(homepageEnterSource).toContain('const lease = homepageEnterTransitionOwner.begin(reason, targetSlideIndex)');
    expect(homepageEnterSource).toContain('await lease.settled');
    expect(homepageEnterSource).not.toContain('.forceReady(');
    expect(homepageEnterSource).toContain('sliderManager.syncHiddenSlideState(targetSlideIndex)');
    expect(homepageEnterSource).toContain('sliderManager.ensureReady()');
    expect(homepageEnterSource.match(/prepareSliderEnter\(\)/g)).toHaveLength(1);
  });

  test('hidden return targets stay exact and game overlays belong to zone cleanup', () => {
    const hiddenSyncSource = sliderManagerSource.split(
      'syncHiddenSlideState(slideIndex: number): void',
    )[1]?.split('ensureReady(): void')[0] ?? '';
    const gameExitRoutingSource = mainSource.split(
      '// 🔥 USER REQUEST: Show navigation and homepage ONLY if returning to homepage',
    )[1]?.split('// Reset game state')[0] ?? '';

    expect(hiddenSyncSource).not.toContain('resolveHiddenSlideTarget');
    expect(gameExitRoutingSource).not.toContain("showHomepageShell('exitToMenu:homepage')");
    expect(gameExitRoutingSource).toContain("cleanupTransientVisuals('exitToMenu:homepage-single-owner')");
    expect(appZoneSource).toContain('forceClearEndgameHint?.()');
  });

  test('Journey Homepage exit has one Promise owner and never uses the negative-scale CSS curve', () => {
    const animationsSource = fs.readFileSync(
      path.join(root, 'src/utils/animations.ts'),
      'utf8',
    );
    const journeyExitSource = animationsSource.split(
      'export const animateJourneySliderExit = (): Promise<void>',
    )[1]?.split('export const finalizeJourneySliderExit')[0] ?? '';

    expect(journeyExitSource).toContain("easing: 'cubic-bezier(0.60, -0.28, 0.735, 0.045)'");
    expect(journeyExitSource).not.toContain('cubic-bezier(0.68, -0.6, 0.32, 1.6)');
    expect(journeyExitSource).not.toContain("classList.add('animate-exit')");
  });

  test('Hub to World primes during render and starts visible motion on a fresh frame', () => {
    const openWorldSource = journeyManagerSource.split(
      'private openJourneyV700World(worldId: number, source?: HTMLElement): void',
    )[1]?.split('private applyJourneyV700WorldScope')[0] ?? '';
    const worldScopeSource = journeyManagerSource.split(
      'private applyJourneyV700WorldScope(container: HTMLElement, worldId: number): void',
    )[1]?.split('private getJourneyV700WorldTargets')[0] ?? '';

    expect(worldScopeSource).toContain("source: 'hub-world-open-render-prime'");
    expect(worldScopeSource).not.toContain("source: 'hub-world-open',\n        waitForImages: false");
    expect(openWorldSource).toContain("emitIOSNativeDiagnostic('world-enter-visible-frame-start'");
    expect(openWorldSource).toContain("source: 'hub-world-open',\n            lastBoardId: 0");
    expect(openWorldSource.indexOf('this.trackRAF(() => {')).toBeLessThan(
      openWorldSource.indexOf("emitIOSNativeDiagnostic('world-enter-visible-frame-start'"),
    );
  });

  test('Hub root atomically owns the enter-to-idle handoff for every World', () => {
    const hubEnterSource = journeyManagerSource.split(
      "private playJourneyV700HubEnter(source: 'homepage' | 'world-return'): void",
    )[1]?.split('public playJourneyV700HubEnterFromHomepage')[0] ?? '';
    const seamlessPrimeIndex = hubEnterSource.indexOf(
      "hub?.classList.add('journey-v700-idle-seamless-start')",
    );
    const childReadyIndex = hubEnterSource.indexOf(
      "worldCard.classList.add('journey-v700-idle-ready')",
    );
    const rootReadyIndex = hubEnterSource.indexOf(
      "hub?.classList.add('journey-v700-idle-ready')",
    );
    const enterPrimeIndex = hubEnterSource.indexOf(
      "hub?.classList.add('journey-v700-idle-seamless-start')",
    );
    const gsapEnterSetIndex = hubEnterSource.indexOf('gsap.set(worldCards, {');

    expect(seamlessPrimeIndex).toBeGreaterThanOrEqual(0);
    expect(enterPrimeIndex).toBeLessThan(gsapEnterSetIndex);
    expect(childReadyIndex).toBeGreaterThan(seamlessPrimeIndex);
    expect(rootReadyIndex).toBeGreaterThan(childReadyIndex);
    expect(collectiblesCssSource).toContain(
      '.journey-v700-hub.journey-v700-idle-ready .journey-v700-world-image',
    );
    expect(collectiblesCssSource).not.toContain(
      '.journey-v700-world-card.journey-v700-idle-ready .journey-v700-world-image',
    );
    expect(hubEnterSource).toContain("emitJourneyV700HubGeometryDiagnostic('before-handoff'");
    expect(hubEnterSource).toContain("emitJourneyV700HubGeometryDiagnostic('idle-ready'");
    expect(hubEnterSource).toContain("emitJourneyV700HubGeometryDiagnostic('spatial-activated'");
    expect(hubEnterSource).toContain("emitJourneyV700HubGeometryDiagnostic('frame-1'");
    expect(hubEnterSource).toContain("emitJourneyV700HubGeometryDiagnostic('frame-2'");
  });
});
