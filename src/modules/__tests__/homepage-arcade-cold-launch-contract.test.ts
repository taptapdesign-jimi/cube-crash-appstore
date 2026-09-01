import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('Homepage cold-launch Arcade handoff', () => {
  test('cancels unfinished Homepage enter and serializes the complete Arcade route', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/main.ts'), 'utf8');
    const start = source.indexOf('(window as any).triggerGameStartSequence = async');
    const end = source.indexOf('// Export exitToMenu function', start);
    const owner = source.slice(start, end);

    expect(owner).toContain('__ccUiArcadeTransitioning === true');
    expect(owner).toContain("homepageEnterTransitionOwner.cancel('homepage-to-arcade')");
    expect(owner).toContain("cancelSliderEnterAnimation('homepage-to-arcade')");
    expect(owner.indexOf("cancelSliderEnterAnimation('homepage-to-arcade')"))
      .toBeLessThan(owner.indexOf('animateSliderExit();'));
    expect(owner.indexOf('appZoneManager.markArcadeRunOrigin();'))
      .toBeLessThan(owner.indexOf('await animateSliderExit();'));
    expect(owner.indexOf('appZoneManager.enterArcadeBoardZone(arcadeStartReason);'))
      .toBeGreaterThan(owner.indexOf('await animateSliderExit();'));
    expect(owner).toContain('await appZoneManager.hideHomepageForGame');
    expect(owner).toContain('await uiManager.startNewGameWithSavedState();');
    expect(owner).not.toContain('setTimeout(async () =>');
  });

  test('Arcade return keeps one warm Homepage enter owner and app-lifetime navigation control', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/main.ts'), 'utf8');
    const exitStart = source.indexOf('(window as any).exitToMenu = async (');
    const exitEnd = source.indexOf('// STATS SERVICE INTEGRATION', exitStart);
    const exitOwner = source.slice(exitStart, exitEnd);
    const enterStart = source.indexOf('async function playHomepageSliderEnterHandoff(');
    const enterEnd = source.indexOf('(window as any).__ccPlayHomepageSliderEnterHandoff', enterStart);
    const enterOwner = source.slice(enterStart, enterEnd);

    expect(exitOwner).not.toContain('cleanupNavigationControl');
    expect(exitOwner).not.toContain('earlyHomepageHandoffDone');
    expect(exitOwner).toContain('if (!isFastArcadeCleanExit) {');
    expect(exitOwner).toContain('Fast arcade clean exit: skipped destructive homepage cleanup for seamless handoff');
    expect(exitOwner).not.toContain("appZoneManager.markHomeMenu('exitToMenu:homepage-single-owner')");
    expect(exitOwner).toContain("playHomepageSliderEnterHandoff('exitToMenu:homepage-final', {");
    expect(exitOwner).toContain('skipFirstPaintReady: true');
    expect(enterOwner).toContain('appZoneManager.prepareHomeMenuEnter(`homepage-enter-owner:${reason}`)');
    expect(enterOwner.indexOf('homepageEnterTransitionOwner.begin'))
      .toBeLessThan(enterOwner.indexOf('gameState.setState'));
    expect(enterOwner.indexOf('gameState.setState'))
      .toBeLessThan(enterOwner.indexOf('primeHomepageForEnterLikeStartup'));
    expect(enterOwner).toContain('finally {');
    expect(enterOwner).toContain('forceHomepageSlideTarget(`${reason}:safe-finalize`');
    expect(enterOwner).toContain('finalizeSliderEnterVisibility(`${reason}:safe-finalize`');
  });

  test('menu watchdog never starts a competing Homepage fallback while exitToMenu is active', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/menu-exit-handoff.ts'), 'utf8');
    const requestStart = source.indexOf('export async function requestExitToMenu');
    const requestOwner = source.slice(requestStart);

    expect(requestOwner).not.toContain('Promise.race([');
    expect(requestOwner).toContain('const exitPromise = Promise.resolve((window as any).exitToMenu({');
    expect(requestOwner).toContain('homepageSlideIndex: options.homepageSlideIndex');
    expect(requestOwner).toContain('onHomepageEnterPrepared: options.onHomepageEnterPrepared');
    expect(requestOwner).toContain('await exitPromise;');
    expect(requestOwner).toContain('waiting for the authoritative owner');
    expect(requestOwner).toContain('while ((window as any).exitingToMenu === true)');
  });

  test('fresh Arcade cannot reveal or reuse the previous board during Exit or boot readiness', () => {
    const mainSource = fs.readFileSync(path.join(repoRoot, 'src/main.ts'), 'utf8');
    const uiSource = fs.readFileSync(path.join(repoRoot, 'src/modules/ui-manager.ts'), 'utf8');
    const coreSource = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    const triggerStart = mainSource.indexOf('(window as any).triggerGameStartSequence = async');
    const triggerEnd = mainSource.indexOf('// Export exitToMenu function', triggerStart);
    const triggerOwner = mainSource.slice(triggerStart, triggerEnd);
    expect(triggerOwner).toContain("if ((window as any).exitingToMenu === true)");
    expect(triggerOwner).toContain('while ((window as any).exitingToMenu === true)');
    expect(triggerOwner.indexOf('(window as any).__ccUiArcadeTransitioning = true'))
      .toBeLessThan(triggerOwner.indexOf("if ((window as any).exitingToMenu === true)"));

    const freshStart = uiSource.slice(
      uiSource.indexOf('async startNewGame(): Promise<void>'),
      uiSource.indexOf('// Start new game with saved state'),
    );
    expect(freshStart).not.toContain('layoutGame();');
    expect(freshStart).not.toContain("canvas.style.opacity = '1'");
    const showAppStart = uiSource.indexOf('showApp(): void');
    const showAppEnd = uiSource.indexOf('// Hide navigation', showAppStart);
    const showAppOwner = uiSource.slice(showAppStart, showAppEnd);
    expect(showAppOwner).toContain('enforceArcadeEntrySurfaceGate');
    expect(showAppOwner.indexOf('enforceArcadeEntrySurfaceGate'))
      .toBeLessThan(showAppOwner.indexOf("canvas.style.visibility = 'visible'"));

    const bootStart = coreSource.indexOf('export async function boot()');
    const bootFirstTextureAwait = coreSource.indexOf("await import('./soundtrack-manager.js')", bootStart);
    const bootBeforeAwait = coreSource.slice(bootStart, bootFirstTextureAwait);
    expect(bootBeforeAwait).toContain('const reuseApp = !!(app && !app.destroyed && app.renderer && app.canvas);');
    expect(bootBeforeAwait).toContain('if (reuseApp) {');
    expect(bootBeforeAwait).toContain("app.canvas.style.opacity = '0';");
    expect(bootBeforeAwait).toContain("app.canvas.style.visibility = 'hidden';");
    expect(bootBeforeAwait).toContain('if (stage) stage.visible = false;');
    expect(bootBeforeAwait).toContain('if (board) board.visible = false;');
    expect(bootBeforeAwait).toContain('if (hud) hud.visible = false;');
    const initialRenderOwner = coreSource.indexOf('// 🔥 CRITICAL FIX: Force render to ensure everything is visible', bootStart);
    const initialRender = coreSource.indexOf('app.renderer.render(stage);', initialRenderOwner);
    const reusedCanvasReveal = coreSource.indexOf("app.canvas.style.visibility = 'visible';", initialRender);
    expect(initialRender).toBeGreaterThan(bootFirstTextureAwait);
    expect(reusedCanvasReveal).toBeGreaterThan(initialRender);
    expect(coreSource.slice(initialRender, reusedCanvasReveal))
      .toContain('if (reuseApp && !isArcadeEntrySurfaceGateActive()) {');
    const startLevelStart = coreSource.indexOf('async function startLevel(n)');
    const startLevelEnd = coreSource.indexOf('// --- local Wild skin fallback', startLevelStart);
    const startLevelOwner = coreSource.slice(startLevelStart, startLevelEnd);
    expect(startLevelOwner).toContain('const deferSurfaceRevealForSavedLoad = (window as any).__ccSkipRebuildBoard === true;');
    expect(startLevelOwner).toContain("devLog('⏭️ startLevel: Saved-state load owns the next visible board commit')");
    expect(startLevelOwner).toContain('if (deferSurfaceRevealForSavedLoad) {');
    const rebuildStart = coreSource.indexOf('function rebuildBoard()');
    const rebuildEnd = coreSource.indexOf('// Board exit animation', rebuildStart);
    const rebuildOwner = coreSource.slice(rebuildStart, rebuildEnd);
    expect(rebuildOwner).toContain('engageArcadeEntrySurfaceGate(app?.canvas ?? null)');
    expect(rebuildOwner).toContain('releaseArcadeEntrySurfaceGateAfterPreparedFrame(app, stage)');
    expect(uiSource).toContain('await recoverFreshArcadeEntryAfterFailedLoad();');
    expect(coreSource).toContain('export async function recoverFreshArcadeEntryAfterFailedLoad()');
  });
});
