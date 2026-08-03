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

  test('Hub to World freezes the live iOS elastic owner before starting exit', () => {
    const openWorldSource = journeyManagerSource.split(
      'private openJourneyV700World(worldId: number, source?: HTMLElement): void',
    )[1]?.split('private applyJourneyV700WorldScope')[0] ?? '';
    const freezeIndex = openWorldSource.indexOf(
      'this.freezeJourneyV700HubElasticOffsetForExit(container, `open-world-${worldId}`)',
    );
    const exitIndex = openWorldSource.indexOf('this.playJourneyV700HubExit(');

    expect(freezeIndex).toBeGreaterThanOrEqual(0);
    expect(freezeIndex).toBeLessThan(exitIndex);
    expect(openWorldSource).not.toContain('lockJourneyViewportTransition(`journey-hub-open-world-');

    const freezeSource = journeyManagerSource.split(
      'private freezeJourneyV700HubElasticOffsetForExit(container: HTMLElement, reason: string): void',
    )[1]?.split('private hideHomeAndJourneyScreens')[0] ?? '';
    expect(freezeSource).toContain("removeEventListener('touchend', handlers.end)");
    expect(freezeSource).toContain('handlers.releaseTween?.kill?.()');
    expect(freezeSource).not.toContain("container.style.removeProperty('transform')");
  });

  test('Hub to World pins screen geometry against live iOS momentum until DOM replacement', () => {
    const openWorldSource = journeyManagerSource.split(
      'private openJourneyV700World(worldId: number, source?: HTMLElement): void',
    )[1]?.split('private applyJourneyV700WorldScope')[0] ?? '';
    const pinIndex = openWorldSource.indexOf(
      'this.pinJourneyV700HubViewportForExit(container, `open-world-${worldId}`)',
    );
    const exitIndex = openWorldSource.indexOf('this.playJourneyV700HubExit(');
    expect(pinIndex).toBeGreaterThanOrEqual(0);
    expect(pinIndex).toBeLessThan(exitIndex);
    expect(openWorldSource).toContain('releaseHubViewportPin();\n        this.renderBoards();');
    expect(openWorldSource).toContain('releaseHubViewportPin();\n        this.journeyV700WorldOpenInProgress = false;');

    const pinSource = journeyManagerSource.split(
      'private pinJourneyV700HubViewportForExit(container: HTMLElement, reason: string): () => void',
    )[1]?.split('private hideHomeAndJourneyScreens')[0] ?? '';
    expect(pinSource).toContain('const frozenScrollTop = scrollable.scrollTop');
    expect(pinSource).toContain('hub.style.transform = `translate3d(0, ${-frozenScrollTop}px, 0)`');
    expect(pinSource).toContain('scrollable.scrollTop = 0');
    expect(pinSource).toContain("scrollable.style.overflowY = 'hidden'");
    expect(pinSource).toContain("emitIOSNativeDiagnostic('hub-viewport-pinned-for-exit'");
  });

  test('Hub to Homepage pins native scroll through the complete standard exit handoff', () => {
    const hubExitSource = journeyManagerSource.split(
      "public playJourneyV700HubExit(reason = 'hub-exit', selectedWorldCard: HTMLElement | null = null): Promise<void>",
    )[1]?.split('private getJourneyV700BoardIdForTarget')[0] ?? '';
    const includeNavIndex = hubExitSource.indexOf("const includeNavExit = reason === 'back-to-home'");
    const freezeIndex = hubExitSource.indexOf('this.freezeJourneyV700HubElasticOffsetForExit(container, reason)');
    const pinIndex = hubExitSource.indexOf('this.pinJourneyV700HubViewportForExit(container, reason)');
    const resolveIndex = hubExitSource.indexOf('resolve();');
    const queuedReleaseIndex = hubExitSource.indexOf('queueMicrotask(releaseBackToHomeViewportPin)');

    expect(includeNavIndex).toBeGreaterThanOrEqual(0);
    expect(freezeIndex).toBeGreaterThan(includeNavIndex);
    expect(pinIndex).toBeGreaterThan(freezeIndex);
    expect(resolveIndex).toBeGreaterThan(pinIndex);
    expect(queuedReleaseIndex).toBeGreaterThan(resolveIndex);
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
      '.journey-v700-hub.journey-v700-idle-ready .journey-v700-world-visual',
    );
    expect(collectiblesCssSource).not.toContain(
      '.journey-v700-world-card.journey-v700-idle-ready .journey-v700-world-visual',
    );
    expect(hubEnterSource).toContain("emitJourneyV700HubGeometryDiagnostic('before-handoff'");
    expect(hubEnterSource).toContain("emitJourneyV700HubGeometryDiagnostic('idle-ready'");
    expect(hubEnterSource).toContain("emitJourneyV700HubGeometryDiagnostic('spatial-activated'");
    expect(hubEnterSource).toContain("emitJourneyV700HubGeometryDiagnostic('frame-1'");
    expect(hubEnterSource).toContain("emitJourneyV700HubGeometryDiagnostic('frame-2'");
  });

  test('locked Worlds keep full opacity through enter cleanup without a second fade', () => {
    const hubEnterSource = journeyManagerSource.split(
      "private playJourneyV700HubEnter(source: 'homepage' | 'world-return'): void",
    )[1]?.split('public playJourneyV700HubEnterFromHomepage')[0] ?? '';

    expect(hubEnterSource).toContain('const worldFinalOpacity = new Map<HTMLElement, number>');
    expect(hubEnterSource).toContain("card.classList.contains('is-locked')");
    expect(hubEnterSource).toContain('opacity: worldFinalOpacity.get(worldCard) ?? 1');
    expect(hubEnterSource).toContain("clearProps: 'transform,opacity,visibility,willChange'");
    expect(hubEnterSource).toContain("hub?.classList.remove('journey-v700-banners-presented')");
    expect(hubEnterSource).toContain("hub?.classList.remove('journey-v700-banners-retracting')");
    expect(hubEnterSource).toContain("hub?.classList.add('journey-v700-banners-presented')");
    expect(hubEnterSource).toContain('onStart: startBannerEnter');
    expect(hubEnterSource.indexOf('onStart: startBannerEnter')).toBeLessThan(
      hubEnterSource.indexOf('onComplete: finishVisibleEnterTarget'),
    );
  });

  test('World progress lives on a mirrored banner inside the shared World visual owner', () => {
    const hubRenderSource = journeyManagerSource.split(
      'private renderJourneyV700Hub(container: HTMLElement): void',
    )[1]?.split('private playJourneyV700HubEnter')[0] ?? '';

    expect(hubRenderSource).toContain("visual.className = 'journey-v700-world-visual'");
    expect(hubRenderSource).toContain("worldId === 2 ? 'left' : 'right'");
    expect(hubRenderSource).toContain('board.unlocked && !board.interim');
    expect(hubRenderSource).toContain('const hasInterimCard = worldBoards.some((board) => board.interim)');
    expect(hubRenderSource).toContain("hasInterimCard ? ' has-interim-card' : ''");
    expect(hubRenderSource).not.toContain('button.disabled = locked');
    expect(hubRenderSource).not.toContain('if (locked) return');
    expect(hubRenderSource).toContain('this.openJourneyV700World(worldId, button)');
    expect(hubRenderSource).toContain('bannerCount.textContent = `${unlockedCount}/${worldBoards.length}`');
    expect(hubRenderSource).toContain("bannerFlagFx.className = 'journey-v700-world-banner-flag-fx'");
    expect(hubRenderSource).toContain('visual.appendChild(banner)');
    expect(hubRenderSource).toContain('visual.appendChild(image)');
    expect(hubRenderSource).not.toContain('dreamGhost');
    expect(hubRenderSource).not.toContain("badge.className = 'journey-v700-world-badge'");
    expect(collectiblesCssSource).toContain(
      '.journey-v700-world-banner-left .journey-v700-world-banner-image {\n  transform: scaleX(-1);',
    );
    expect(collectiblesCssSource).not.toContain('.journey-v700-world-badge {');
    expect(collectiblesCssSource).toContain('right: calc(max(-12.8vw, -50px) - 14px);');
    expect(collectiblesCssSource).toContain('left: calc(max(-12.8vw, -50px) - 14px);');
    expect(collectiblesCssSource).toContain(
      '.journey-v700-world-banner-right {\n  right: calc(max(-12.8vw, -50px) - 14px);\n  transform-origin: 0% 18%;',
    );
    expect(collectiblesCssSource).toContain('.journey-v700-world-banner-left {');
    expect(collectiblesCssSource).toContain('--journey-world-banner-reveal-x: 64%;');
    expect(collectiblesCssSource).toContain('left: calc(max(-12.8vw, -50px) - 14px);');
    expect(collectiblesCssSource).toContain('transform-origin: 100% 18%;');
    expect(collectiblesCssSource).not.toContain('transform-origin: 50% 18%;');
    expect(collectiblesCssSource).toContain('top: calc(50% - 14px);');
    expect(collectiblesCssSource).toContain('right: calc(max(-12.8vw, -50px) - 30px);');
    expect(collectiblesCssSource).toContain('top: calc(50% - 20px);');
    expect(collectiblesCssSource).toContain('left: calc(max(-12.8vw, -50px) - 30px);');
    expect(collectiblesCssSource).toContain('top: calc(50% - 26px);');
    expect(collectiblesCssSource).toContain('right: calc(max(-12.8vw, -50px) - 38px);');
    expect(collectiblesCssSource).toContain('.journey-v700-world-card.is-locked {\n  opacity: 1;\n  filter: none;');
    expect(collectiblesCssSource).toContain('.journey-v700-world-cloud.is-locked {\n  opacity: var(--cloud-opacity, 0.82);\n  filter: none;');
    expect(collectiblesCssSource).toContain('top: calc(57% + 5px);\n  right: 3px;');
    expect(collectiblesCssSource).toContain('top: calc(57% + 5px);\n  left: 3px;');
    expect(collectiblesCssSource).not.toContain(
      '.journey-v700-world-card.is-locked .journey-v700-world-banner-count',
    );
    expect(collectiblesCssSource).toContain(
      '.journey-v700-world-card:not(.has-interim-card) .journey-v700-world-banner {\n  display: none;',
    );
    expect(collectiblesCssSource).not.toContain('journey-v700-world-locked-dream-ghost');
    expect(collectiblesCssSource).not.toContain('journey-v700-locked-world-dream-haze');
    expect(collectiblesCssSource).toContain('--journey-world-banner-rotation: -15deg;');
    expect(collectiblesCssSource).toContain('--journey-world-banner-rotation: 8deg;');
    expect(collectiblesCssSource).toContain('--journey-world-banner-rotation: -6deg;');
    expect(collectiblesCssSource).toContain('animation: journey-world-flag-ember 6.8s ease-in-out infinite;');
    expect(collectiblesCssSource).toContain('animation: journey-world-flag-shine 6.8s ease-in-out infinite;');
    expect(collectiblesCssSource).toContain(
      'transition: translate 0.72s cubic-bezier(0.2, 0.88, 0.32, 1.08);',
    );
    expect(collectiblesCssSource).toContain(
      'journey-world-banner-special-idle var(--journey-world-banner-idle-duration) cubic-bezier(0.45, 0.05, 0.55, 0.95) calc(var(--journey-world-banner-reveal-delay) + 0.72s) infinite;',
    );
    expect(collectiblesCssSource).toContain('--journey-world-banner-reveal-x: -64%;');
    expect(collectiblesCssSource).toContain('--journey-world-banner-reveal-x: 64%;');
    expect(collectiblesCssSource).toContain('.journey-v700-hub.journey-v700-banners-retracting .journey-v700-world-banner {');
    expect(collectiblesCssSource).toContain('transition-duration: 0.32s;');
    expect(collectiblesCssSource).toContain('transition-timing-function: cubic-bezier(0.56, -0.22, 0.78, 0.34);');
    expect(journeyManagerSource).toContain("hub?.classList.add('journey-v700-banners-retracting')");
    expect(collectiblesCssSource).toContain('--journey-world-banner-idle-duration: 7.6s;');
    expect(collectiblesCssSource).toContain('--journey-world-banner-idle-duration: 8.35s;');
    expect(collectiblesCssSource).toContain('--journey-world-banner-idle-duration: 7.9s;');
    expect(collectiblesCssSource).toContain('rotate(calc(var(--journey-world-banner-rotation) + 2.5deg))');
    expect(collectiblesCssSource).toContain('rotate(calc(var(--journey-world-banner-rotation) - 2.1deg))');
    expect(collectiblesCssSource).toContain('background: rgba(255, 255, 255, 0.68);');
    expect(collectiblesCssSource).toContain('@media (prefers-reduced-motion: reduce)');
    expect(collectiblesCssSource).not.toContain(
      '.journey-v700-world-banner-flag-fx::before {\n  background: radial-gradient',
    );
  });

  test('completed Journey boards refresh mounted star images without replacing the World DOM', () => {
    const refreshSource = journeyManagerSource.split(
      'private refreshJourneyBoardStarVisuals(boardId: number, reason: string): boolean',
    )[1]?.split('public refreshBackgroundPosition')[0] ?? '';
    const completionSource = journeyManagerSource.split(
      'public unlockBoardOnCompletion(boardNumber: number): void',
    )[1]?.split('public getNewlyUnlockedCount')[0] ?? '';

    expect(refreshSource).toContain('boardStatsService.getBoardStats(boardId).highScore');
    expect(refreshSource).toContain("const roleOrder = ['left', 'center', 'right'] as const");
    expect(refreshSource).toContain("star.classList.toggle('journey-forest-star-filled', filled)");
    expect(refreshSource).not.toContain('this.renderBoards()');
    expect(completionSource).toContain(
      "this.refreshJourneyBoardStarVisuals(boardNumber, 'board-completion')",
    );
  });

  test('keeps the three Hub Worlds in the compact approved vertical composition', () => {
    expect(collectiblesCssSource).toContain(
      '.journey-v700-world-forest {\n  left: -2px;\n  top: calc(env(safe-area-inset-top, 0px) + 118px);',
    );
    expect(collectiblesCssSource).toContain(
      '.journey-v700-world-beach {\n  right: -8px;\n  top: calc(env(safe-area-inset-top, 0px) + 334px);',
    );
    expect(collectiblesCssSource).toContain(
      '.journey-v700-world-robo {\n  left: -6px;\n  top: calc(env(safe-area-inset-top, 0px) + 580px);',
    );
    expect(collectiblesCssSource).toContain('height: calc(892px - var(--journey-v700-hub-bottom-trim)');
    expect(journeyManagerSource).toContain('x: 24, y: 222, width: 214');
    expect(journeyManagerSource).toContain('x: 32, y: 576, width: 214');
    expect(journeyManagerSource).toContain('x: -10, y: 632, width: 198');
  });

  test('Forest Units 1, 2, and 3 own separate balanced cloud groups below Forest main', () => {
    const forestLayoutSource = journeyManagerSource.split(
      'const boardCloudSlotsByBoard: Record<number, BoardCloudSlot[]> = {',
    )[1]?.split('const boardCloudSlots = boardCloudSlotsByBoard[boardId]')[0] ?? '';

    expect(forestLayoutSource).toContain('1: [\n          { ref: 4, x: -34, y: 54, width: 92 }');
    expect(forestLayoutSource).toContain('2: [\n          { ref: 4, x: -46, y: 40, width: 88 }');
    expect(forestLayoutSource).toContain('{ ref: 6, x: -10, y: 126, width: 156 }');
    expect(forestLayoutSource).toContain('3: [\n          { ref: 7, x: -38, y: 112, width: 136 }');
    expect(forestLayoutSource).toContain('{ ref: 6, x: 54, y: 126, width: 166 }');
    expect(journeyManagerSource).toContain(
      'addForestBoardGroup(2, 190, 374, 200, -12, -6, 0, 0, [4, 5, 6]);',
    );
    expect(journeyManagerSource).toContain(
      'addForestBoardGroup(3, 18, 484, 200, -10, -4, 0, 0, [7, 6]);',
    );
    expect(forestLayoutSource).not.toContain('2: [],');
  });
});
