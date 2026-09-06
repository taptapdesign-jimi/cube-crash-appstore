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
const assetPreloaderSource = fs.readFileSync(path.join(root, 'src/modules/asset-preloader.ts'), 'utf8');
const worldAnimationCoordinatorSource = fs.readFileSync(
  path.join(root, 'src/modules/journey-world-animation-coordinator.ts'),
  'utf8',
);

describe('Journey Hub transition ownership', () => {
  test('preloads both Journey progress-banner resolutions before the first visible Hub enter', () => {
    const criticalAssetsSource = assetPreloaderSource.split('const CRITICAL_ASSETS: string[] = [')[1]
      ?.split('];')[0] ?? '';
    expect(criticalAssetsSource).toContain("'./assets/journey assets/natpis.png'");
    expect(criticalAssetsSource).toContain("'./assets/journey assets/natpis@2x.png'");
  });

  test('Hub renderer is DOM-only and delegates visible motion to the coordinator', () => {
    const renderSource = journeyManagerSource.split(
      'private renderJourneyV700Hub(',
    )[1]?.split('private cancelJourneyV700HubEnter(reason: string): void')[0] ?? '';

    expect(renderSource).toContain("this.playJourneyV700HubEnter('world-return')");
    expect(renderSource).not.toContain('gsap.fromTo(');
    expect(renderSource).not.toContain('journeySpatialMotion.activateJourneyHub');
  });

  test('cold Homepage to Hub entry starts from the manager prepared before reveal', () => {
    const showSource = collectiblesSource.split(
      'async showCollectibles(options?: CollectiblesShowOptions): Promise<void>',
    )[1]?.split('async hideCollectibles(')[0] ?? '';
    const releaseIndex = showSource.indexOf('releaseJourneyScreenHiddenPrime(screen as HTMLElement)');
    const preparedEnterIndex = showSource.indexOf(
      'journeyBoardsManagerPreparedForEnter.playJourneyV700VisibleEnterFromHomepage?.()',
    );
    const fallbackImportIndex = showSource.indexOf("import('./modules/journey-boards-manager.js').then(async");

    expect(releaseIndex).toBeGreaterThanOrEqual(0);
    expect(preparedEnterIndex).toBeGreaterThan(releaseIndex);
    expect(preparedEnterIndex).toBeLessThan(fallbackImportIndex);
    expect(showSource).toContain('homepageHubEnterStartedFromPreparedManager = true');
    expect(showSource).toContain(
      "if (!shouldUseV700WorldReturnEnter && !homepageHubEnterStartedFromPreparedManager)",
    );
    expect(showSource).toContain("emitIOSNativeDiagnostic('hub-enter-started-from-prepared-manager')");
    expect(showSource).toContain("emitIOSNativeDiagnostic('hub-enter-started-from-import-fallback')");
  });

  test('a stale interim flag without a concrete board target cannot suppress the Hub enter', () => {
    const showSource = collectiblesSource.split(
      'async showCollectibles(options?: CollectiblesShowOptions): Promise<void>',
    )[1]?.split('async hideCollectibles(')[0] ?? '';
    const targetGuardIndex = showSource.indexOf('const hasConcreteJourneyReturnTargetEarly =');
    const normalizedFlagIndex = showSource.indexOf('const returningFromInterimBoardEarly =');
    const returnModeIndex = showSource.indexOf('const shouldUseV700WorldReturnEnter =');

    expect(targetGuardIndex).toBeGreaterThanOrEqual(0);
    expect(normalizedFlagIndex).toBeGreaterThan(targetGuardIndex);
    expect(returnModeIndex).toBeGreaterThan(normalizedFlagIndex);
    expect(showSource).toContain('const journeyReturnPolicy = resolveJourneyReturnEntryPolicy({');
    expect(showSource).toContain('hasRenderedBoardTarget: hasRenderedJourneyReturnTargetEarly');
    expect(showSource).not.toContain(
      'isV700WorldReturnEarly || getJourneyReturnBoardId() !== null',
    );
    expect(showSource).toContain(
      'const returningFromInterimBoardEarly = journeyReturnPolicy.returningFromInterimBoard',
    );
    expect(showSource).toContain("emitIOSNativeDiagnostic('stale-journey-return-cleared-for-hub'");
    expect(showSource).toContain("localStorage.removeItem('__ccReturningFromInterimBoard')");
  });

  test('a stale detail return cannot suppress Hub banners or idle', () => {
    const showSource = collectiblesSource.split(
      'async showCollectibles(options?: CollectiblesShowOptions): Promise<void>',
    )[1]?.split('async hideCollectibles(')[0] ?? '';
    const normalizationIndex = showSource.indexOf('const returningFromDetailModalEarly =');
    const viewportDecisionIndex = showSource.indexOf('const isReturningToJourneyWithActiveArea =');
    const returnModeIndex = showSource.indexOf('const shouldUseV700WorldReturnEnter =');

    expect(normalizationIndex).toBeGreaterThanOrEqual(0);
    expect(viewportDecisionIndex).toBeGreaterThan(normalizationIndex);
    expect(returnModeIndex).toBeGreaterThan(viewportDecisionIndex);
    expect(showSource).toContain(
      'const returningFromDetailModalEarly = journeyReturnPolicy.returningFromDetailModal',
    );
    expect(showSource).toContain('delete (window as any).__ccReturningFromDetailModal');
    expect(showSource).toContain('delete (window as any).__ccSuppressJourneyV700AutoWorldEnter');
    expect(showSource).toContain('delete (window as any).__ccJourneyActiveAreaEnterPending');
  });

  test('forward navigation never invokes the Homepage recovery reset', () => {
    const showSource = collectiblesSource.split(
      'async showCollectibles(options?: CollectiblesShowOptions): Promise<void>',
    )[1]?.split('async hideCollectibles(')[0] ?? '';

    expect(showSource).not.toContain('sliderManager.forceReady(');
    expect(showSource).toContain('sliderManager.syncHiddenSlideState(1)');
  });

  test('Homepage enter ownership is cancelled before its Journey exit starts', () => {
    const handoffSource = uiManagerSource.split(
      'private showCollectiblesScreenWithAnimation(launchFirstPlayTutorial = false): void',
    )[1]?.split('async hideCollectiblesScreenWithAnimation')[0] ?? '';
    const releaseIndex = handoffSource.indexOf("homepageEnterTransitionOwner.cancel('homepage-to-journey')");
    const exitIndex = handoffSource.indexOf('animateJourneySliderExit()');

    expect(releaseIndex).toBeGreaterThanOrEqual(0);
    expect(exitIndex).toBeGreaterThan(releaseIndex);
    expect(handoffSource).not.toContain('new Promise<void>(resolve => setTimeout(resolve, 900))');
  });

  test('fast Back to Enter cancels the Homepage owner before Journey starts', () => {
    const journeyHandoffSource = uiManagerSource.split(
      'private showCollectiblesScreenWithAnimation(launchFirstPlayTutorial = false): void',
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

  test('rapid Journey re-entry cannot cancel an active Homepage return owner', () => {
    const journeyHandoffSource = uiManagerSource.split(
      'private showCollectiblesScreenWithAnimation(launchFirstPlayTutorial = false): void',
    )[1]?.split('async hideCollectiblesScreenWithAnimation')[0] ?? '';
    const guardIndex = journeyHandoffSource.indexOf(
      'if ((window as any).__ccIsHidingCollectibles || homepageEnterTransitionOwner.isActive())',
    );
    const cancelIndex = journeyHandoffSource.indexOf(
      "homepageEnterTransitionOwner.cancel('homepage-to-journey')",
    );

    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(cancelIndex).toBeGreaterThan(guardIndex);
    expect(journeyHandoffSource).toContain(
      'this.queueJourneyOpenAfterHomepageEnter(launchFirstPlayTutorial)',
    );
    expect(journeyHandoffSource).toContain(
      "emitIOSNativeDiagnostic('journey-open-queued-homepage-return-active'",
    );
    expect(uiManagerSource).toContain('homepageEnterTransitionOwner.getCurrentSettled()');
    expect(uiManagerSource).not.toContain('Journey CTA ignored until Homepage return settles');
  });

  test('hidden return targets stay exact and game overlays belong to zone cleanup', () => {
    const hiddenSyncSource = sliderManagerSource.split(
      'syncHiddenSlideState(slideIndex: number): void',
    )[1]?.split('ensureReady(): void')[0] ?? '';
    const gameExitRoutingSource = mainSource.split(
      '// Route and Homepage slide are independent:',
    )[1]?.split('// Homepage state is published by playHomepageSliderEnterHandoff')[0] ?? '';

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
      'private applyJourneyV700WorldScope(',
    )[1]?.split('private getJourneyV700WorldTargets')[0] ?? '';

    expect(worldScopeSource).toContain("if (options.prepaint) return");
    expect(worldScopeSource).toContain("source: 'hub-world-open-render-prime'");
    expect(worldScopeSource).not.toContain("source: 'hub-world-open',\n        waitForImages: false");
    expect(openWorldSource).toContain("emitIOSNativeDiagnostic('world-enter-visible-frame-start'");
    expect(openWorldSource).toContain("source: 'hub-world-open',\n            lastBoardId: 0");
    expect(openWorldSource.indexOf('this.trackRAF(() => {')).toBeLessThan(
      openWorldSource.indexOf("emitIOSNativeDiagnostic('world-enter-visible-frame-start'"),
    );
  });

  test('lifts the complete Beach and Area 55 World compositions by sixteen pixels', () => {
    const worldScopeSource = journeyManagerSource.split(
      'private applyJourneyV700WorldScope(',
    )[1]?.split('private getJourneyV700WorldTargets')[0] ?? '';

    expect(journeyManagerSource).toContain('const JOURNEY_V700_BEACH_AREA55_SCOPE_LIFT_PX = 16');
    expect(worldScopeSource).toContain(
      'worldId === 2 || worldId === 3 ? -JOURNEY_V700_BEACH_AREA55_SCOPE_LIFT_PX : 0',
    );
    expect(worldScopeSource).toContain(
      'rawTop - worldOffsetPercent + worldScopeOffsetPercent',
    );
    expect(worldScopeSource).toContain('rawTop - worldOffsetPx + worldScopeOffsetPx');
  });

  test('moves only Area 55 Units 03 and 07 sixteen pixels left as complete Units', () => {
    const renderAssetsSource = journeyManagerSource.split(
      'private renderForestMapAssets(',
    )[1]?.split('private cleanupDetailModalRuntimeState')[0] ?? '';
    const roboUnitSource = renderAssetsSource.split(
      'const addRoboBoardGroup = (',
    )[1]?.split('if (activeWorldId === 1')[0] ?? '';
    const cardSource = journeyManagerSource.split(
      'private createBoardCardFixed(',
    )[1]?.split('private ')[0] ?? '';

    expect(journeyManagerSource).toContain('23: -16');
    expect(journeyManagerSource).toContain('27: -16');
    expect(roboUnitSource).toContain(
      'const unitX = islandX + getJourneyBoardUnitHorizontalOffsetPx(boardId)',
    );
    expect(roboUnitSource).toContain('unitX + slot.x');
    expect(roboUnitSource).toContain('unitX + craterLayout.x');
    expect(roboUnitSource).toContain('unitX + star.x + finalStarsOffsetX');
    expect(cardSource).toContain('leftPx += getJourneyBoardUnitHorizontalOffsetPx(board.id)');
  });

  test('World idle ownership starts only after the Unit cascade', () => {
    const worldEnterSource = journeyManagerSource.split(
      'private playJourneyV700WorldEnter(',
    )[1]?.split('private playJourneyV700WorldExit')[0] ?? '';
    const enterIndex = worldEnterSource.indexOf(
      'await this.journeyWorldAnimation.enter(units, reducedMotion, { targetsPrimed })',
    );
    const idleIndex = worldEnterSource.indexOf("this.journeyV700Phase = 'idle'");

    expect(idleIndex).toBeGreaterThan(enterIndex);
    expect(worldEnterSource).not.toContain('journeySpatialMotion');
    expect(worldEnterSource).toContain(
      "markIOSJourneyTransitionAudit('enter-unit-cascade-complete')",
    );
  });

  test('attributes slow enter and exit frames to the exact Unit without changing motion', () => {
    expect(worldAnimationCoordinatorSource).toContain("markIOSJourneyTransitionAudit(`enter-unit-${unit.id}-start`)");
    expect(worldAnimationCoordinatorSource).toContain("markIOSJourneyTransitionAudit(`exit-unit-${unit.id}-start`)");
    expect(worldAnimationCoordinatorSource).toContain("emitIOSNativeDiagnostic('world-unit-exit-start'");
    expect(journeyManagerSource).toContain("markIOSJourneyTransitionAudit('enter-unit-cascade')");
    expect(journeyManagerSource).toContain("markIOSJourneyTransitionAudit('exit-unit-cascade')");
  });

  test('uses one resumable idle owner and avoids mass 3D promotion during World exit', () => {
    expect(worldAnimationCoordinatorSource).toContain('private idleTicker: (() => void) | null = null;');
    expect(worldAnimationCoordinatorSource).toContain('private idleEntries: JourneyWorldIdleEntry[] = [];');
    expect(worldAnimationCoordinatorSource).toContain('public setIdlePaintSuspended(suspended: boolean): void');
    expect(worldAnimationCoordinatorSource).toContain('entry.startTime += pausedFor');
    expect(worldAnimationCoordinatorSource).toContain("readJourneyRenderedTransformAxis(target, 'y')");
    expect(worldAnimationCoordinatorSource).toContain("readJourneyRenderedTransformAxis(target, 'x')");
    expect(worldAnimationCoordinatorSource).toContain('entry.resumeBlendStartedAt = now');
    expect(worldAnimationCoordinatorSource).toContain('IDLE_RESUME_POSE_BLEND_SECONDS');
    expect(worldAnimationCoordinatorSource).toContain('if (this.idleTicker) return;');
    expect(worldAnimationCoordinatorSource).not.toContain('private idleTickers: Array<() => void> = [];');

    const exitSource = worldAnimationCoordinatorSource.split(
      'public async exit(',
    )[1]?.split('private startIdle(')[0] ?? '';
    expect(exitSource).not.toContain('force3D: true');
    expect(journeyManagerSource).toContain(
      "snapshot.state !== 'idle' && snapshot.state !== 'transition'",
    );
  });

  test('one generic runtime scheduler owns scroll, modal and transition paint for every World', () => {
    const pauseSource = journeyManagerSource.split(
      'private pauseJourneyWorldForCardOverlay(reason: string, card: HTMLElement): void',
    )[1]?.split('private resumeJourneyWorldAfterCardOverlay')[0] ?? '';
    const resumeSource = journeyManagerSource.split(
      'private resumeJourneyWorldAfterCardOverlay(reason: string): void',
    )[1]?.split('private getCurrentJourneyForestAreas')[0] ?? '';
    const enterSource = journeyManagerSource.split(
      'private playJourneyV700WorldEnter(',
    )[1]?.split('private playJourneyV700WorldExit(')[0] ?? '';

    expect(journeyManagerSource).toContain('new JourneyWorldRuntimeScheduler()');
    expect(enterSource).toContain('this.activateJourneyWorldRuntime(container, worldId)');
    expect(enterSource).toContain('this.journeyWorldRuntime.endTransition()');
    expect(pauseSource).toContain('this.journeyWorldRuntime.openModal()');
    expect(pauseSource).toContain('this.stopJourneyAreaIdleForTargets([cardWrapper])');
    expect(pauseSource).not.toContain('this.cleanupJourneyAreaIdleAnimations(false)');
    expect(resumeSource).toContain('this.journeyWorldRuntime.closeModal()');
    expect(resumeSource).not.toContain('this.startJourneyAreaIdleAnimations(');
    expect(journeyManagerSource).toContain('.slice(0, MOBILE_RUNTIME_PROFILE.journeyVisibleUnitBudget)');
    expect(collectiblesCssSource).toContain(
      '#journey-boards-container.journey-world-runtime-transition .journey-board-card',
    );
  });

  test('gameplay return starts the same already-prepared Unit enter for Forest, Beach and Area 55', () => {
    const returnEnterSource = journeyManagerSource.split(
      'public playJourneyV700WorldEnterFromReturn(',
    )[1]?.split('public prepareJourneyV700WorldEnterFromReturn')[0] ?? '';

    expect(returnEnterSource).toContain('this.playJourneyV700WorldEnter(container, worldId, {');
    expect(returnEnterSource).toContain('waitForImages: false');
    expect(returnEnterSource).not.toContain('worldId === 1');
    expect(returnEnterSource).not.toContain('worldId === 2');
    expect(returnEnterSource).not.toContain('worldId === 3');
  });

  test('World enter avoids mass compositor promotion and static World layers stay unpromoted', () => {
    const worldEnterSource = journeyManagerSource.split(
      'private playJourneyV700WorldEnter(',
    )[1]?.split('private playJourneyV700WorldExit')[0] ?? '';
    const primeSource = journeyManagerSource.split(
      'private primeJourneyV700WorldEnter(',
    )[1]?.split('public playJourneyV700WorldEnterFromReturn')[0] ?? '';

    expect(primeSource).toContain('force3D: false');
    expect(worldEnterSource).toContain('force3D: false');
    expect(worldAnimationCoordinatorSource).toContain('force3D: false');
    expect(worldAnimationCoordinatorSource.split('public async enter(')[1]
      ?.split('public async exit(')[0]).not.toContain('force3D: true');
    expect(journeyManagerSource).not.toContain("cloud.style.willChange = 'transform'");
    expect(collectiblesCssSource).toContain('.journey-board-card-wrapper {');
    expect(collectiblesCssSource).toContain('will-change: auto;');
  });

  test('each World main cloud bank has one structural transition owner while clouds keep idle drift', () => {
    const renderAssetsSource = journeyManagerSource.split(
      'private renderForestMapAssets(',
    )[1]?.split('private cleanupDetailModalRuntimeState')[0] ?? '';
    const fixedRenderSource = journeyManagerSource.split(
      'private renderBoardsFixed(',
    )[1]?.split('private updateBoardProgress')[0] ?? '';

    expect(renderAssetsSource).toContain('const createMainCloudUnit = (');
    expect(renderAssetsSource).toContain("createMainCloudUnit('forest-main', 0)");
    expect(renderAssetsSource).toContain("createMainCloudUnit('beach-main', 1454)");
    expect(renderAssetsSource).toContain("createMainCloudUnit('robo-main', 3166)");
    expect(renderAssetsSource).toContain("addMainClouds(1, 'forest', forestMainCloudUnit)");
    expect(renderAssetsSource).toContain("addMainClouds(2, 'beach', beachMainCloudUnit)");
    expect(renderAssetsSource).toContain("addMainClouds(3, 'robo', roboMainCloudUnit)");
    expect(renderAssetsSource).toContain('getJourneyMainCloudRenderSpecs(worldId)');
    expect(fixedRenderSource).toContain("querySelectorAll<HTMLElement>('.journey-main-cloud-unit')");
    expect(fixedRenderSource.indexOf("querySelectorAll<HTMLElement>('.journey-main-cloud-unit')"))
      .toBeLessThan(fixedRenderSource.indexOf("querySelectorAll<HTMLElement>('.journey-forest-cloud-art')"));
    expect(worldAnimationCoordinatorSource).toContain('unit.clouds.map((cloud) => ({');
  });

  test('mounts only the active World assets and cards instead of hiding two complete World DOM trees', () => {
    const renderAssetsSource = journeyManagerSource.split(
      'private renderForestMapAssets(',
    )[1]?.split('private cleanupDetailModalRuntimeState')[0] ?? '';
    const fixedRenderSource = journeyManagerSource.split(
      'private renderBoardsFixed(',
    )[1]?.split('private setupIdleInteractionListeners')[0] ?? '';

    expect(renderAssetsSource).toContain('activeWorldId: number');
    expect(renderAssetsSource).toContain('activeWorldId === 1 ? createMainCloudUnit');
    expect(renderAssetsSource).toContain('activeWorldId === 2 ? createMainCloudUnit');
    expect(renderAssetsSource).toContain('activeWorldId === 3 ? createMainCloudUnit');
    expect(renderAssetsSource).toContain('if (activeWorldId === 1 && forestMainCloudUnit)');
    expect(renderAssetsSource).toContain('if (activeWorldId === 2 && beachMainCloudUnit)');
    expect(renderAssetsSource).toContain('if (activeWorldId === 3 && roboMainCloudUnit)');
    expect(fixedRenderSource).toContain('const activeWorldId = options.worldId || this.journeyV700WorldId || 1');
    expect(fixedRenderSource).toContain('const activeWorldRange = this.getJourneyWorldRange(activeWorldId)');
    expect(fixedRenderSource).toContain('this.renderForestMapAssets(bgContainer, decorContainer, activeWorldId)');
    expect(fixedRenderSource).toContain('board.id < activeWorldRange.start');
    expect(fixedRenderSource).toContain('board.id > activeWorldRange.end');
    expect(fixedRenderSource.indexOf('board.id < activeWorldRange.start'))
      .toBeLessThan(fixedRenderSource.indexOf('this.createBoardCardFixed(board, index)'));
    expect(fixedRenderSource).toContain("emitIOSNativeDiagnostic('world-scoped-dom-rendered'");
    expect(fixedRenderSource).toContain(
      "? cardsContainer.querySelectorAll('.journey-board-card-wrapper').length",
    );
    expect(fixedRenderSource).toContain('cardCount: renderedCardCount');
  });

  test('prepaints the exact active World DOM behind Hub and commits it without rebuilding descendants', () => {
    const openWorldSource = journeyManagerSource.split(
      'private openJourneyV700World(worldId: number, source?: HTMLElement): void',
    )[1]?.split('private async buildJourneyMainCloudComposite')[0] ?? '';
    const buildSource = journeyManagerSource.split(
      'private async buildJourneyMainCloudComposite',
    )[1]?.split('private async prepareJourneyMainCloudComposite')[0] ?? '';
    const prepareSource = journeyManagerSource.split(
      'private async prepareJourneyMainCloudComposite',
    )[1]?.split('private cancelJourneyWorldPrepaint')[0] ?? '';
    const worldPrepaintSource = journeyManagerSource.split(
      'private prepareJourneyWorldPrepaint(',
    )[1]?.split('private commitJourneyWorldPrepaint')[0] ?? '';
    const worldCommitSource = journeyManagerSource.split(
      'private commitJourneyWorldPrepaint(',
    )[1]?.split('private applyJourneyV700WorldScope')[0] ?? '';

    expect(openWorldSource).toContain('await this.prepareJourneyWorldPrepaint(container, worldId)');
    expect(openWorldSource.indexOf('await this.prepareJourneyWorldPrepaint(container, worldId)'))
      .toBeLessThan(openWorldSource.indexOf('this.playJourneyV700HubExit('));
    expect(openWorldSource).toContain('this.commitJourneyWorldPrepaint(container, worldId)');
    expect(openWorldSource).toContain("this.cancelJourneyWorldPrepaint('commit-fallback')");
    const touchStartSource = journeyManagerSource.split('const onWorldCardTouchStart =')[1]
      ?.split('const onWorldCardTouchMove =')[0] ?? '';
    expect(touchStartSource).not.toContain('prepareJourneyWorldPrepaint');
    expect(buildSource).toContain('getJourneyMainCloudRenderSpecs(worldId)');
    expect(buildSource).toContain("document.createElement('canvas')");
    expect(buildSource).toContain('Math.min(2, Math.max(1, window.devicePixelRatio || 1))');
    expect(buildSource).toContain('context.drawImage(');
    expect(buildSource).toContain("canvas.className = 'journey-forest-cloud-art journey-main-cloud-composite'");
    expect(journeyManagerSource).not.toContain('journey-main-cloud-prewarm-stage');
    expect(journeyManagerSource).not.toContain('journeyMainCloudCompositePrewarms');
    expect(prepareSource).toContain('unit.replaceChildren(canvas)');
    expect(prepareSource).toContain("source: canvas.dataset.journeyCompositePrewarmed === 'true' ? 'prewarmed' : 'cache'");
    expect(worldPrepaintSource).toContain("host.style.opacity = '0.001'");
    expect(worldPrepaintSource).toContain("host.style.contain = 'strict'");
    expect(worldPrepaintSource).toContain('if (current?.worldId === worldId && current.host.isConnected)');
    expect(worldPrepaintSource).toContain('this.journeyWorldPrepaintEpoch === epoch');
    expect(worldPrepaintSource).toContain('this.renderBoardsFixed(root, { worldId, deferRuntimeOwners: true })');
    expect(worldPrepaintSource).toContain('await Promise.all(images.map((image) => waitForImageReady(image)))');
    expect(worldPrepaintSource).toContain('for (let frameIndex = 0; frameIndex < 3; frameIndex += 1)');
    expect(worldPrepaintSource).toContain('await this.waitForTrackedFrames(1)');
    expect(worldPrepaintSource).toContain('paintFrameMs');
    expect(worldPrepaintSource).toContain("emitIOSNativeDiagnostic('world-prepaint-painted'");
    expect(worldCommitSource).toContain('const preparedChildren = Array.from(stage.root.children)');
    expect(worldCommitSource).toContain('preparedChildren.forEach((child) => container.appendChild(child))');
    expect(worldCommitSource).toContain('this.beginRenderLifecycle()');
    expect(worldCommitSource).toContain('this.journeyWorldPrepaintStage = null');
    expect(worldCommitSource).not.toContain('this.renderBoards()');
    expect(collectiblesCssSource).toContain('.journey-world-prepaint-root *::before');
    expect(collectiblesCssSource).toContain('animation-play-state: paused !important');
    expect(journeyManagerSource).toContain('this.journeyMainCloudCompositeCache.clear()');
    expect(journeyManagerSource).toContain("this.cancelJourneyWorldPrepaint('manager-cleanup')");
    expect(openWorldSource).toContain("this.cancelJourneyWorldPrepaint('open-aborted-before-hub-exit')");
    expect(openWorldSource).not.toContain('journeySpatialMotion');
  });

  test('prepaints the exact Hub at the live World scroll offset before retiring the outgoing backing', () => {
    const closeSource = journeyManagerSource.split(
      'private closeJourneyV700World(): void',
    )[1]?.split('private markJourneyDevBoardRefresh')[0] ?? '';
    const prepareSource = journeyManagerSource.split(
      'private prepareJourneyHubPrepaint(',
    )[1]?.split('private async commitJourneyHubPrepaint')[0] ?? '';
    const commitSource = journeyManagerSource.split(
      'private async commitJourneyHubPrepaint(',
    )[1]?.split('private cancelJourneyWorldPrepaint')[0] ?? '';

    expect(closeSource).toContain('const hubPrepaintReady = this.prepareJourneyHubPrepaint(container)');
    expect(closeSource).toContain('const preparedHubReady = await hubPrepaintReady');
    expect(closeSource).toContain('await this.commitJourneyHubPrepaint(container)');
    expect(prepareSource).toContain("container.closest('#journey-screen .collectibles-scrollable')");
    expect(prepareSource).toContain("host.style.top = `${prepaintScrollTop}px`");
    expect(prepareSource).toContain("host.style.opacity = '0.001'");
    expect(prepareSource).not.toContain('applyAppPaperSurfaceToElement(host)');
    expect(prepareSource).toContain('only paper owner throughout World -> Hub');
    expect(prepareSource).toContain('this.renderJourneyV700Hub(root, { prepaint: true })');
    expect(prepareSource).toContain('await Promise.all(images.map((image) => waitForImageReady(image)))');
    expect(prepareSource).toContain('await this.waitForTrackedFrames(3)');
    const hideIndex = commitSource.indexOf("child.style.visibility = 'hidden'");
    const barrierIndex = commitSource.indexOf('await this.waitForTrackedFrames(1)');
    const retireIndex = commitSource.indexOf('outgoingChildren.forEach((child) => child.remove())');
    expect(hideIndex).toBeGreaterThanOrEqual(0);
    expect(barrierIndex).toBeGreaterThan(hideIndex);
    expect(retireIndex).toBeGreaterThan(barrierIndex);
    expect(commitSource).toContain("this.playJourneyV700HubEnter('world-return')");
    expect(commitSource).toContain('transparentStageBacking: true');
    expect(closeSource).toContain('const outgoingZeroPresented = await this.waitForTrackedFrames(1)');
    expect(closeSource).toContain('outgoingZeroPresented,');
    expect(worldAnimationCoordinatorSource).toContain('const finalizeUnitExit = () => {');
    expect(worldAnimationCoordinatorSource).toContain("visibility: 'hidden'");
    expect(worldAnimationCoordinatorSource).toContain('onComplete: finalizeUnitExit');
  });

  test('an early World close queues one clean exit instead of overlapping the enter cascade', () => {
    const closeSource = journeyManagerSource.split(
      'private closeJourneyV700World(): void',
    )[1]?.split('private markJourneyDevBoardRefresh')[0] ?? '';
    const worldEnterSource = journeyManagerSource.split(
      'private playJourneyV700WorldEnter(',
    )[1]?.split('private playJourneyV700WorldExit')[0] ?? '';

    expect(closeSource).toContain("if (this.journeyV700Phase === 'entering')");
    expect(closeSource).toContain('this.journeyV700CloseQueuedDuringEnter = true');
    expect(closeSource.indexOf("if (this.journeyV700Phase === 'entering')"))
      .toBeLessThan(closeSource.indexOf('this.playJourneyV700WorldExit(container, complete)'));
    expect(worldEnterSource).toContain('const closeQueuedDuringEnter = this.journeyV700CloseQueuedDuringEnter');
    expect(worldEnterSource).toContain("emitIOSNativeDiagnostic('close-world-queued-enter-flush'");
    expect(worldEnterSource).toContain('this.trackRAF(() => this.closeJourneyV700World())');
  });

  test('DOM replacement retires outgoing owners without normalizing every discarded node', () => {
    const renderBoardsSource = journeyManagerSource.split(
      'public renderBoards(): void',
    )[1]?.split('private setJourneyV700View')[0] ?? '';
    const retireSource = journeyManagerSource.split(
      'private retireJourneyBoardOwnersBeforeDomReplace',
    )[1]?.split('public prepareJourneyBoardCardTransformsForReveal')[0] ?? '';

    expect(renderBoardsSource).toContain('this.retireJourneyBoardOwnersBeforeDomReplace(container)');
    expect(retireSource).toContain('gsap.killTweensOf(descendants)');
    expect(retireSource).not.toContain('gsap.set(');
    expect(retireSource).not.toContain('getComputedStyle(');
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
    expect(openWorldSource).toContain('releaseHubViewportPin();\n        const committedPrepaint =');
    expect(openWorldSource).toContain('releaseHubViewportPin();\n        finishOpeningOwnership();');

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

  test('cold Hub images decode before the first visible World tween', () => {
    const hubEnterSource = journeyManagerSource.split(
      "private playJourneyV700HubEnter(source: 'homepage' | 'world-return'): void",
    )[1]?.split('public playJourneyV700HubEnterFromHomepage')[0] ?? '';
    const imageBarrierIndex = hubEnterSource.indexOf(
      "const hubImages = Array.from(hub?.querySelectorAll<HTMLImageElement>('img') ?? []);",
    );
    const imageReadyIndex = hubEnterSource.indexOf('void hubImagesReady.then(() => {');
    const cloudTweenIndex = hubEnterSource.indexOf('const cloudTween = trackTween(hubCloudLayer');
    const worldTweenIndex = hubEnterSource.indexOf('const worldTween = trackTween(worldCard');

    expect(imageBarrierIndex).toBeGreaterThan(hubEnterSource.indexOf('gsap.set(worldCards'));
    expect(imageReadyIndex).toBeGreaterThan(imageBarrierIndex);
    expect(cloudTweenIndex).toBeGreaterThan(imageReadyIndex);
    expect(worldTweenIndex).toBeGreaterThan(imageReadyIndex);
    expect(hubEnterSource).toContain("this.journeyV700View !== 'hub'");
    expect(hubEnterSource).toContain("hub-visible-enter-stale-before-images-ready");
    expect(hubEnterSource).toContain("hub-visible-enter-images-ready");
  });

  test('expensive Hub geometry diagnostics require explicit detailed tracing', () => {
    const geometryDiagnosticSource = journeyManagerSource.split(
      'private emitJourneyV700HubGeometryDiagnostic(event: string, container: HTMLElement): void',
    )[1]?.split('private resetJourneyV700HubScrollToTop')[0] ?? '';

    expect(journeyManagerSource).toContain('areDetailedRuntimeDiagnosticsEnabled,');
    expect(journeyManagerSource).toContain("from '../utils/runtime-diagnostics-policy.js';");
    expect(geometryDiagnosticSource).toContain('if (!areDetailedRuntimeDiagnosticsEnabled()) return;');
    expect(geometryDiagnosticSource.indexOf('if (!areDetailedRuntimeDiagnosticsEnabled()) return;'))
      .toBeLessThan(geometryDiagnosticSource.indexOf('getBoundingClientRect()'));
  });

  test('visible Journey surfaces become alive without a post-enter idle pause', () => {
    const hubEnterSource = journeyManagerSource.split(
      "private playJourneyV700HubEnter(source: 'homepage' | 'world-return'): void",
    )[1]?.split('public playJourneyV700HubEnterFromHomepage')[0] ?? '';
    const visibleStartSource = hubEnterSource.split('const startBannerEnter = () => {')[1]
      ?.split('let remainingTargets')[0] ?? '';
    const perUnitCompleteIndex = worldAnimationCoordinatorSource.indexOf(
      "tween.eventCallback('onComplete', () => {",
    );
    const perUnitIdleIndex = worldAnimationCoordinatorSource.indexOf(
      'this.startIdle([unit], reducedMotion, index)',
    );

    expect(visibleStartSource).toContain(
      "worldCard.classList.add('journey-v700-idle-ready')",
    );
    expect(visibleStartSource).toContain("hub?.classList.add('journey-v700-idle-ready')");
    expect(perUnitCompleteIndex).toBeGreaterThanOrEqual(0);
    expect(perUnitIdleIndex).toBeGreaterThan(perUnitCompleteIndex);
    expect(worldAnimationCoordinatorSource).toContain(
      "if (this.phase !== 'entering' && this.phase !== 'idle') return",
    );
    expect(worldAnimationCoordinatorSource).toContain(
      'const ramp = Math.min(1, elapsed / 0.18)',
    );
    expect(worldAnimationCoordinatorSource).not.toContain('elapsed / 0.8');
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
      'private renderJourneyV700Hub(',
    )[1]?.split('private playJourneyV700HubEnter')[0] ?? '';

    expect(hubRenderSource).toContain("visual.className = 'journey-v700-world-visual'");
    expect(hubRenderSource).toContain("tiltShell.className = 'journey-v700-world-tilt-shell'");
    expect(hubRenderSource).toContain('tiltShell.appendChild(banner)');
    expect(hubRenderSource).toContain('tiltShell.appendChild(image)');
    expect(hubRenderSource).toContain('visual.appendChild(tiltShell)');
    expect(hubRenderSource).toContain('const worldIds = [1, 3, 2];');
    expect(hubRenderSource).toContain("worldIndex === 1 ? 'left' : 'right'");
    expect(hubRenderSource).toContain(
      'cloudSpec.y < 220 ? 1 : cloudSpec.y < 560 ? 3 : 2',
    );
    expect(hubRenderSource).toContain('board.unlocked && !board.interim');
    expect(hubRenderSource).toContain('const hasInterimCard = worldBoards.some((board) => board.interim)');
    expect(hubRenderSource).toContain("hasInterimCard ? ' has-interim-card' : ''");
    expect(hubRenderSource).toContain("hasInterimCard ? ' has-interim-card' : ''} has-progress-banner`");
    expect(hubRenderSource).not.toContain('button.disabled = locked');
    expect(hubRenderSource).not.toContain('if (locked) return');
    expect(hubRenderSource).toContain('this.openJourneyV700World(worldId, button)');
    expect(hubRenderSource).toContain('bannerCount.textContent = `${unlockedCount}/${worldBoards.length}`');
    expect(hubRenderSource).toContain("bannerFlagFx.className = 'journey-v700-world-banner-flag-fx'");
    expect(hubRenderSource).not.toContain('visual.appendChild(banner)');
    expect(hubRenderSource).not.toContain('visual.appendChild(image)');
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
    expect(collectiblesCssSource).toContain('right: calc(max(-12.8vw, -50px) - 30px);');
    expect(collectiblesCssSource).toContain('top: calc(50% - 26px);');
    expect(collectiblesCssSource).toContain('left: calc(max(-12.8vw, -50px) - 38px);');
    expect(collectiblesCssSource).toContain('.journey-v700-world-card.is-locked {\n  opacity: 1;\n  filter: none;');
    expect(collectiblesCssSource).toContain('.journey-v700-world-cloud.is-locked {\n  opacity: var(--cloud-opacity, 0.82);\n  filter: none;');
    expect(collectiblesCssSource).toContain('top: calc(57% + 5px);\n  right: 3px;');
    expect(collectiblesCssSource).toContain('top: calc(57% + 5px);\n  left: 3px;');
    expect(collectiblesCssSource).not.toContain(
      '.journey-v700-world-card.is-locked .journey-v700-world-banner-count',
    );
    expect(collectiblesCssSource).not.toContain('.journey-v700-world-card:not(.has-progress-banner)');
    expect(collectiblesCssSource).not.toContain('journey-v700-world-locked-dream-ghost');
    expect(collectiblesCssSource).not.toContain('journey-v700-locked-world-dream-haze');
    expect(collectiblesCssSource).toContain('--journey-world-banner-rotation: -15deg;');
    expect(collectiblesCssSource).toContain('--journey-world-banner-rotation: 8deg;');
    expect(collectiblesCssSource).toContain('--journey-world-banner-rotation: -6deg;');
    expect(collectiblesCssSource).toContain('animation: journey-world-flag-ember var(--journey-world-shimmer-duration, 6.8s)');
    expect(collectiblesCssSource).toContain('animation: journey-world-flag-shine var(--journey-world-shimmer-duration, 6.8s)');
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

  test('World signs start face-local auto tilt only after enter and pause it before exit', () => {
    const hubEnterSource = journeyManagerSource.split(
      "private playJourneyV700HubEnter(source: 'homepage' | 'world-return'): void",
    )[1]?.split('public playJourneyV700HubEnterFromHomepage')[0] ?? '';
    const hubExitSource = journeyManagerSource.split(
      "public playJourneyV700HubExit(reason = 'hub-exit'",
    )[1]?.split('private getJourneyV700WorldTargetGroups')[0] ?? '';

    expect(hubEnterSource).toContain("hub?.classList.remove('journey-v700-tilt-ready')");
    expect(hubEnterSource).toContain("hub?.classList.add('journey-v700-tilt-ready')");
    expect(hubEnterSource.indexOf("hub?.classList.add('journey-v700-tilt-ready')"))
      .toBeGreaterThan(hubEnterSource.indexOf("clearProps: 'transform,opacity,visibility,willChange'"));
    expect(hubExitSource).toContain("hub?.classList.remove('journey-v700-tilt-ready')");
    expect(collectiblesCssSource).toContain('@keyframes journey-v700-world-auto-tilt');
    expect(collectiblesCssSource).toContain('var(--journey-world-tilt-duration, 4.8s)');
    expect(journeyManagerSource).toContain("--journey-world-tilt-duration");
    expect(journeyManagerSource).toContain('const tiltPhaseSeconds = -(Math.random() * tiltDurationSeconds)');
    expect(journeyManagerSource).toContain("Math.random() < 0.5 ? 'normal' : 'reverse'");
    expect(journeyManagerSource).toContain("--journey-world-shimmer-duration");
    expect(journeyManagerSource).toContain('const shimmerPhaseSeconds = -(Math.random() * shimmerDurationSeconds)');
    expect(collectiblesCssSource).toContain('var(--journey-world-shimmer-duration, 6.8s)');
    expect(collectiblesCssSource).toContain('var(--journey-world-shimmer-delay, 0s)');
    expect(collectiblesCssSource).toContain('perspective(720px)');
    expect(collectiblesCssSource).toContain('rotateY(7.2deg)');
    expect(collectiblesCssSource).toContain('rotateY(-6.4deg)');
    expect(collectiblesCssSource).toContain('--journey-world-drag-shadow: rgba(185, 149, 114, 0.12)');
    expect(collectiblesCssSource).toContain('filter: drop-shadow(0 4px 4px var(--journey-world-drag-shadow));');
    const tiltKeyframes = collectiblesCssSource.split('@keyframes journey-v700-world-auto-tilt')[1]
      ?.split('@keyframes journey-v700-cloud-idle')[0] ?? '';
    expect(tiltKeyframes).not.toContain('filter:');
    expect(collectiblesCssSource).not.toContain('rgba(174, 104, 56, 0.24)');
    expect(collectiblesCssSource).toContain(
      '.journey-v700-hub.journey-v700-tilt-ready .journey-v700-world-tilt-shell',
    );
    expect(collectiblesCssSource).toContain('animation-play-state: paused;');
    expect(collectiblesCssSource).toContain('.journey-v700-world-tilt-shell {\n    animation: none !important;');
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

  test('keeps Forest, Area 55, then Beach in the compact Hub composition', () => {
    expect(collectiblesCssSource).toContain(
      '.journey-v700-world-forest {\n  left: -2px;\n  top: calc(env(safe-area-inset-top, 0px) + 118px);',
    );
    expect(collectiblesCssSource).toContain(
      '.journey-v700-world-robo {\n  right: -8px;\n  top: calc(env(safe-area-inset-top, 0px) + 334px);',
    );
    expect(collectiblesCssSource).toContain(
      '.journey-v700-world-beach {\n  left: -6px;\n  top: calc(env(safe-area-inset-top, 0px) + 580px);',
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
