/** @jest-environment jsdom */
import fs from 'node:fs';
import ts from 'typescript';

const journeySourceText = fs.readFileSync('src/modules/journey-boards-manager.ts', 'utf8');
const collectiblesSourceText = fs.readFileSync('src/collectibles-manager.ts', 'utf8');
const journeySource = ts.createSourceFile(
  'journey-boards-manager.ts',
  journeySourceText,
  ts.ScriptTarget.Latest,
  true,
);

function compileMethod(name: string, scope: Record<string, unknown>): (this: any, ...args: any[]) => any {
  let method: ts.MethodDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isMethodDeclaration(node) && node.name.getText(journeySource) === name) method = node;
    ts.forEachChild(node, visit);
  };
  visit(journeySource);
  if (!method?.body) throw new Error(`Missing ${name}`);
  const parameters = method.parameters.map((parameter) => parameter.getText(journeySource)).join(',');
  const output = ts.transpileModule(
    `function run(${parameters}) ${method.body.getText(journeySource)}`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  return new Function('scope', `with(scope){${output};return run;}`)(scope);
}

function createRuntimeFixture() {
  document.body.innerHTML = `
    <div id="journey-screen">
      <div class="collectibles-scrollable">
        <div id="journey-boards-container" style="pointer-events:auto;visibility:visible">
          <div class="journey-cards-container"><div id="preserved-unit"></div></div>
        </div>
      </div>
    </div>`;
  const surface = document.getElementById('journey-boards-container') as HTMLElement;
  const unit = document.getElementById('preserved-unit') as HTMLElement;
  const scrollable = document.querySelector('.collectibles-scrollable') as HTMLElement & {
    _journeyIdleScrollHandler?: EventListener | null;
    _journeyViewportCheckTimer?: number | null;
  };
  const cards = surface.querySelector('.journey-cards-container') as HTMLElement & {
    _journeyIdleTouchHandler?: EventListener | null;
  };
  scrollable._journeyIdleScrollHandler = jest.fn();
  scrollable._journeyViewportCheckTimer = 41;
  cards._journeyIdleTouchHandler = jest.fn();

  const runtime = {
    hub: true,
    world: true,
    bees: true,
    bubbles: true,
    ships: true,
    rafs: 3,
    timeouts: 2,
    worldPrepaint: true,
    hubPrepaint: true,
    worldAnimation: true,
    areaIdle: true,
  };
  const owner = {
    cleanupInProgress: false,
    journeyGameplaySuspension: null,
    renderDisposed: false,
    renderLifecycleGeneration: 7,
    journeyTerminalReturnBuild: { cancelled: false },
    journeyV700PreparedWorldEnter: {},
    activeBoardAreaEnterInProgress: true,
    activeBoardAreaEnterPreparedTargets: [unit],
    journeyV700Phase: 'idle',
    releaseJourneyReturnPaintWarmLease: jest.fn(),
    journeyCardInteractionProfiler: { dispose: jest.fn() },
    cancelJourneyWorldPrepaint: jest.fn(() => { runtime.worldPrepaint = false; }),
    cancelJourneyHubPrepaint: jest.fn(() => { runtime.hubPrepaint = false; }),
    journeyHubRuntime: { deactivate: jest.fn(() => { runtime.hub = false; }) },
    journeyWorldRuntime: { deactivate: jest.fn(() => { runtime.world = false; }) },
    stopForestBeeOrbits: jest.fn(() => { runtime.bees = false; }),
    stopBeachBubbleDrift: jest.fn(() => { runtime.bubbles = false; }),
    stopArea55ShipFlybys: jest.fn(() => { runtime.ships = false; }),
    cancelJourneyV700HubEnter: jest.fn(),
    releaseJourneyV700HubTopGuard: jest.fn(),
    cancelAllRAFs: jest.fn(() => { runtime.rafs = 0; }),
    cancelAllTimeouts: jest.fn(() => { runtime.timeouts = 0; }),
    journeyWorldAnimation: { stop: jest.fn(() => { runtime.worldAnimation = false; }), park: jest.fn() },
    prepareJourneyBoardCardTransformsForReveal: jest.fn(),
    getJourneyV700AnimationUnits: jest.fn(() => [unit]),
    cleanupJourneyAreaIdleAnimations: jest.fn(() => { runtime.areaIdle = false; }),
    cleanupJourneyScreenElasticOverscroll: jest.fn(),
    stopInterimCardIdleEffects: jest.fn(),
    clearTrackedTimeout: jest.fn(),
  };
  const scope = {
    stopJourneyForestAmbientSounds: jest.fn(),
    stopJourneyWorldsHubSound: jest.fn(),
    stopJourneyUnitMotionSounds: jest.fn(),
    stopJourneyHubExitSounds: jest.fn(),
    releaseJourneyCoreAudioWorkingSet: jest.fn(),
    JOURNEY_CARD_IDLE_BOUNCE: { stop: jest.fn() },
    gsap: { killTweensOf: jest.fn(), set: jest.fn() },
    parkJourneyViewportForGameplay: jest.fn(() => false),
    emitIOSNativeDiagnostic: jest.fn(),
  };
  return { surface, unit, scrollable, cards, runtime, owner, scope };
}

afterEach(() => {
  document.body.innerHTML = '';
});

test('Homepage parks the existing Hub through the same suspension owner, but not an unexpected World', () => {
  const fixture = createRuntimeFixture();
  const owner = { suspendForGameplay: jest.fn(), cleanup: jest.fn() };
  const suspend = compileMethod('suspendForHomepage', fixture.scope);
  fixture.surface.dataset.journeyV700View = 'hub';
  suspend.call(owner);
  expect(owner.suspendForGameplay).toHaveBeenCalledTimes(1);
  expect(owner.cleanup).not.toHaveBeenCalled();
  expect(document.getElementById('preserved-unit')).toBe(fixture.unit);
  fixture.surface.dataset.journeyV700View = 'world';
  suspend.call(owner);
  expect(owner.cleanup).toHaveBeenCalledTimes(1);
  expect(owner.suspendForGameplay).toHaveBeenCalledTimes(1);
});

test.each([1, 2, 3])('parks only the matching valid World %s beneath the acquired gameplay cover', (worldId) => {
  const fixture = createRuntimeFixture();
  fixture.surface.dataset.journeyV700View = 'world';
  fixture.surface.dataset.journeyV700WorldId = String(worldId);
  fixture.scope.parkJourneyViewportForGameplay.mockReturnValue(true);
  const suspend = compileMethod('suspendForGameplay', fixture.scope);
  suspend.call(fixture.owner);
  expect(fixture.scope.parkJourneyViewportForGameplay).toHaveBeenCalledWith(document.getElementById('journey-screen'), fixture.surface);
  expect(fixture.owner.getJourneyV700AnimationUnits).toHaveBeenCalledWith(fixture.surface, worldId);
  expect(fixture.owner.journeyWorldAnimation.park).toHaveBeenCalledWith([fixture.unit]);
  expect(fixture.scope.parkJourneyViewportForGameplay.mock.invocationCallOrder[0])
    .toBeLessThan(fixture.owner.prepareJourneyBoardCardTransformsForReveal.mock.invocationCallOrder[0]);
  expect(fixture.owner.renderDisposed).toBe(true);
  expect(fixture.surface.inert).toBe(true);
});

test('Homepage preserves hidden Hub DOM without a paint cover or settling its artwork/chrome', () => {
  const fixture = createRuntimeFixture();
  const screen = document.getElementById('journey-screen')!;
  screen.insertAdjacentHTML('afterbegin', '<header class="collectibles-header" style="opacity:0;transform:scale(0.04)"></header>');
  fixture.surface.dataset.journeyV700View = 'hub';
  fixture.surface.insertAdjacentHTML('beforeend', '<div class="journey-v700-hub"><div class="journey-v700-hub-cloud-layer"></div><button class="journey-v700-world-card" data-world-id="1"></button><button class="journey-v700-world-card" data-world-id="2" data-journey-hub-final-opacity="0.8"></button><button class="journey-v700-world-card" data-world-id="3"></button></div>');
  const cardAndChromeStyles = Array.from(screen.querySelectorAll<HTMLElement>('.collectibles-header, .journey-v700-world-card, .journey-v700-hub-cloud-layer')).map(target => [target, target.style.cssText] as const);
  const suspendGameplay = compileMethod('suspendForGameplay', fixture.scope);
  const owner = Object.assign(fixture.owner, { suspendForGameplay: jest.fn(() => suspendGameplay.call(fixture.owner)), cleanup: jest.fn() });
  compileMethod('suspendForHomepage', fixture.scope).call(owner);
  expect(fixture.scope.parkJourneyViewportForGameplay).not.toHaveBeenCalled();
  expect(fixture.scope.gsap.set).not.toHaveBeenCalled();
  cardAndChromeStyles.forEach(([target, style]) => expect(target.style.cssText).toBe(style));
  expect(fixture.surface.hidden).toBe(true);
  expect(screen.hasAttribute('data-journey-viewport-parked')).toBe(false);
  expect(document.querySelector('.journey-viewport-parking-cover')).toBeNull();
  expect(owner.renderDisposed).toBe(true);
  expect(owner.journeyV700Phase).toBe('hidden');
  expect(fixture.runtime.hub).toBe(false);
  expect(fixture.runtime.rafs).toBe(0);
  expect(fixture.runtime.timeouts).toBe(0);
});

test('Homepage suspension does not settle or expose the retired Hub', () => {
  const fixture = createRuntimeFixture();
  fixture.surface.dataset.journeyV700View = 'hub';
  const owner = { suspendForGameplay: jest.fn(), cleanup: jest.fn() };
  compileMethod('suspendForHomepage', fixture.scope).call(owner);
  expect(owner.suspendForGameplay).toHaveBeenCalledTimes(1);
  expect(fixture.scope.gsap.set).not.toHaveBeenCalled();
});

test('visible Hub resume restores one lifecycle and refreshes progress without rebuilding its nodes', () => {
  const fixture = createRuntimeFixture();
  fixture.surface.dataset.journeyV700View = 'hub';
  const owner = {
    renderDisposed: true,
    beginRenderLifecycle: jest.fn(() => { owner.renderDisposed = false; }),
    refreshJourneyV700HubProgress: jest.fn(),
  };
  const resume = compileMethod('resumeHubForVisibleEnter', {});
  resume.call(owner);
  resume.call(owner);
  expect(owner.beginRenderLifecycle).toHaveBeenCalledTimes(1);
  expect(owner.refreshJourneyV700HubProgress).toHaveBeenCalledWith(fixture.surface);
  expect(document.getElementById('preserved-unit')).toBe(fixture.unit);
  owner.renderDisposed = true;
  fixture.surface.dataset.journeyV700View = 'world';
  resume.call(owner);
  expect(owner.beginRenderLifecycle).toHaveBeenCalledTimes(1);
});

test('gameplay suspension preserves the exact mounted Hub/World node identity', () => {
  const fixture = createRuntimeFixture();
  const suspend = compileMethod('suspendForGameplay', fixture.scope);
  const restore = compileMethod('restoreGameplaySuspendedSurface', fixture.scope);

  suspend.call(fixture.owner);

  expect(document.getElementById('journey-boards-container')).toBe(fixture.surface);
  expect(document.getElementById('preserved-unit')).toBe(fixture.unit);
  expect(fixture.surface.hidden).toBe(true);
  expect((fixture.surface as HTMLElement & { inert: boolean }).inert).toBe(true);
  expect(fixture.surface).toHaveAttribute('aria-hidden', 'true');
  expect(fixture.surface.style.pointerEvents).toBe('none');

  restore.call(fixture.owner);

  expect(document.getElementById('journey-boards-container')).toBe(fixture.surface);
  expect(document.getElementById('preserved-unit')).toBe(fixture.unit);
  expect(fixture.surface.hidden).toBe(false);
  expect((fixture.surface as HTMLElement & { inert: boolean }).inert).toBe(false);
  expect(fixture.surface).not.toHaveAttribute('aria-hidden');
  expect(fixture.surface.style.pointerEvents).toBe('auto');
  expect(fixture.surface.style.visibility).toBe('visible');
});

test('gameplay suspension retires every recurring Journey runtime owner without evicting DOM', () => {
  const fixture = createRuntimeFixture();
  const suspend = compileMethod('suspendForGameplay', fixture.scope);

  suspend.call(fixture.owner);

  expect(fixture.runtime).toEqual({
    hub: false,
    world: false,
    bees: false,
    bubbles: false,
    ships: false,
    rafs: 0,
    timeouts: 0,
    worldPrepaint: false,
    hubPrepaint: false,
    worldAnimation: false,
    areaIdle: false,
  });
  expect(fixture.owner.renderDisposed).toBe(true);
  expect(fixture.owner.renderLifecycleGeneration).toBe(8);
  expect(fixture.owner.journeyTerminalReturnBuild).toBeNull();
  expect(fixture.owner.journeyV700PreparedWorldEnter).toBeNull();
  expect(fixture.scrollable._journeyIdleScrollHandler).toBeNull();
  expect(fixture.scrollable._journeyViewportCheckTimer).toBeNull();
  expect(fixture.cards._journeyIdleTouchHandler).toBeNull();
  expect(fixture.scope.stopJourneyForestAmbientSounds).toHaveBeenCalledTimes(1);
  expect(fixture.scope.stopJourneyWorldsHubSound).toHaveBeenCalledTimes(1);
  expect(fixture.scope.stopJourneyUnitMotionSounds).toHaveBeenCalledTimes(1);
  expect(fixture.scope.stopJourneyHubExitSounds).toHaveBeenCalledTimes(1);
  expect(document.getElementById('preserved-unit')).toBe(fixture.unit);
});

test('repeated gameplay suspension joins the existing owner without repeating teardown', () => {
  const fixture = createRuntimeFixture();
  const suspend = compileMethod('suspendForGameplay', fixture.scope);

  suspend.call(fixture.owner);
  const generationAfterFirstSuspend = fixture.owner.renderLifecycleGeneration;
  fixture.surface.hidden = false;
  fixture.surface.inert = false;
  fixture.surface.style.visibility = 'visible';
  suspend.call(fixture.owner);

  expect(fixture.owner.renderLifecycleGeneration).toBe(generationAfterFirstSuspend);
  expect(fixture.owner.cancelAllRAFs).toHaveBeenCalledTimes(1);
  expect(fixture.owner.cancelAllTimeouts).toHaveBeenCalledTimes(1);
  expect(fixture.scope.gsap.killTweensOf).toHaveBeenCalledTimes(1);
  expect(fixture.surface.hidden).toBe(true);
  expect(fixture.surface.inert).toBe(true);
  expect(fixture.surface.style.visibility).toBe('hidden');
  expect(document.getElementById('preserved-unit')).toBe(fixture.unit);
});

test('completion commits progression but defers global rendering while gameplay owns retained Journey', () => {
  const fixture = createRuntimeFixture();
  const suspend = compileMethod('suspendForGameplay', fixture.scope);
  suspend.call(fixture.owner);
  const board = { id: 4, unlocked: false, interim: true };
  const owner: any = fixture.owner;
  Object.assign(owner, {
    boards: [board],
    refreshJourneyBoardStarVisuals: jest.fn(),
    ensureWorldInterimCards: jest.fn(),
    saveBoardsState: jest.fn(),
    renderBoards: jest.fn(),
    updateCounter: jest.fn(),
  });
  const unlock = compileMethod('unlockBoardOnCompletion', {
    JOURNEY_MAX_BOARDS: 30,
    logger: { info: jest.fn(), warn: jest.fn() },
    emitIOSNativeDiagnostic: jest.fn(),
  });

  unlock.call(owner, 4);

  expect(board).toMatchObject({ unlocked: true, interim: false });
  expect(owner.saveBoardsState).toHaveBeenCalledTimes(1);
  expect(owner.renderBoards).not.toHaveBeenCalled();
  expect(owner.updateCounter).toHaveBeenCalledTimes(1);
  expect(document.getElementById('preserved-unit')).toBe(fixture.unit);
});

test('completion still renders immediately when Journey is visibly owned', () => {
  const board = { id: 4, unlocked: false, interim: true };
  const owner = {
    boards: [board],
    renderDisposed: false,
    journeyGameplaySuspension: null,
    refreshJourneyBoardStarVisuals: jest.fn(),
    ensureWorldInterimCards: jest.fn(),
    saveBoardsState: jest.fn(),
    renderBoards: jest.fn(),
    updateCounter: jest.fn(),
  };
  const unlock = compileMethod('unlockBoardOnCompletion', {
    JOURNEY_MAX_BOARDS: 30,
    logger: { info: jest.fn(), warn: jest.fn() },
    emitIOSNativeDiagnostic: jest.fn(),
  });

  unlock.call(owner, 4);

  expect(owner.renderBoards).toHaveBeenCalledTimes(1);
});

test('suspend through completion and warm return preserves World identity except the changed Unit', async () => {
  const fixture = createRuntimeFixture();
  fixture.surface.dataset.journeyV700View = 'world';
  fixture.surface.dataset.journeyV700WorldId = '1';
  const main = document.createElement('div');
  main.id = 'retained-main';
  main.dataset.journeyAreaId = 'forest-main';
  fixture.surface.prepend(main);
  fixture.cards.replaceChildren(...Array.from({ length: 10 }, (_, index) => {
    const unit = document.createElement('div');
    unit.id = `retained-unit-${index + 1}`;
    unit.dataset.journeyAreaId = `board-${index + 1}`;
    return unit;
  }));
  const unchangedUnit = document.getElementById('retained-unit-3');
  const changedUnit = document.getElementById('retained-unit-4');
  const board = { id: 4, unlocked: false, interim: true };
  const owner: any = fixture.owner;
  Object.assign(owner, {
    boards: [board],
    journeyV700WorldId: 1,
    journeyV700View: 'world',
    refreshJourneyBoardStarVisuals: jest.fn(),
    ensureWorldInterimCards: jest.fn(),
    saveBoardsState: jest.fn(),
    renderBoards: jest.fn(),
    updateCounter: jest.fn(),
    getJourneyWorldRange: () => ({ start: 1, end: 10 }),
    getJourneyV700AnimationUnits: () => Array.from(
      fixture.surface.querySelectorAll<HTMLElement>('[data-journey-area-id]'),
    ).map((target) => ({ id: target.id, targets: [target], clouds: [] })),
    reconcileMountedJourneyWorldCardUnits: jest.fn(() => {
      const current = document.getElementById('retained-unit-4');
      if (!current) return [];
      const replacement = current.cloneNode(false) as HTMLElement;
      replacement.id = 'retained-unit-4-reconciled';
      current.replaceWith(replacement);
      return [4];
    }),
    getLastActiveJourneyBoardAreaId: () => 0,
    restoreJourneyRetainedReturnCardVisuals: jest.fn(() => true),
    primeJourneyV700WorldEnterIncrementally: jest.fn(async (
      _container: HTMLElement,
      worldId: number,
      ownerToken: number,
    ) => {
      const targets = Array.from(fixture.surface.querySelectorAll<HTMLElement>('[data-journey-area-id]'));
      return {
        worldId,
        renderGeneration: owner.renderLifecycleGeneration,
        ownerToken,
        units: targets.map((target) => ({ id: target.id, targets: [target], clouds: [] })),
        targets,
      };
    }),
    renderJourneyWorldIncrementally: jest.fn(),
    updateJourneyV700Nav: jest.fn(),
    installJourneyScreenElasticOverscroll: jest.fn(),
    retireJourneyBoardOwnersBeforeDomReplace: jest.fn(),
    trackRAF: jest.fn(),
  });
  const emitIOSNativeDiagnostic = jest.fn();
  const lifecycleScope = { ...fixture.scope, emitIOSNativeDiagnostic };
  owner.restoreGameplaySuspendedSurface = compileMethod('restoreGameplaySuspendedSurface', lifecycleScope).bind(owner);
  owner.beginRenderLifecycle = compileMethod('beginRenderLifecycle', lifecycleScope).bind(owner);
  owner.resumeForVisibleWorldReturn = compileMethod('resumeForVisibleWorldReturn', lifecycleScope).bind(owner);
  owner.isJourneyTerminalReturnBuildCurrent = compileMethod(
    'isJourneyTerminalReturnBuildCurrent', lifecycleScope,
  ).bind(owner);
  const suspend = compileMethod('suspendForGameplay', lifecycleScope);
  const unlock = compileMethod('unlockBoardOnCompletion', {
    JOURNEY_MAX_BOARDS: 30,
    logger: { info: jest.fn(), warn: jest.fn() },
    emitIOSNativeDiagnostic,
  });
  const prepare = compileMethod('prepareJourneyV700WorldEnterFromReturnIncrementally', {
    emitIOSNativeDiagnostic,
  });

  suspend.call(owner);
  unlock.call(owner, 4);
  await expect(prepare.call(owner, 'completion-return', 41)).resolves.toBe(true);

  expect(owner.renderBoards).not.toHaveBeenCalled();
  expect(owner.renderJourneyWorldIncrementally).not.toHaveBeenCalled();
  expect(document.getElementById('retained-main')).toBe(main);
  expect(document.getElementById('retained-unit-3')).toBe(unchangedUnit);
  expect(document.getElementById('retained-unit-4')).toBeNull();
  expect(document.getElementById('retained-unit-4-reconciled')).not.toBe(changedUnit);
  expect(owner.journeyV700PreparedWorldEnter).toMatchObject({
    ownerToken: 41,
    reusedRetainedSurface: true,
  });
});

test('Journey parks through destination-specific owners without deferred destructive Home cleanup', () => {
  const hideStart = collectiblesSourceText.indexOf('  async hideCollectibles(): Promise<void> {');
  const hideEnd = collectiblesSourceText.indexOf('\n  }\n\n}', hideStart);
  const hideSource = collectiblesSourceText.slice(hideStart, hideEnd);

  expect(hideSource).toContain("const isBackButton = exitMode !== 'toGame'");
  expect(hideSource).toContain('if (isBackButton) journeyBoardsManager.suspendForHomepage();');
  expect(hideSource).toContain('else journeyBoardsManager.suspendForGameplay();');
  expect(hideSource).not.toContain('finishJourneyBackCleanup');

  const gameplayExitSites = journeySourceText.match(/__ccJourneyExitMode = 'toGame'/g) ?? [];
  expect(gameplayExitSites).toHaveLength(4);
  expect(journeySourceText).toContain("this.hideHomeAndJourneyScreens('before game start', { cleanup: false });\n      this.suspendForGameplay();");
  expect(journeySourceText).not.toContain('// Cleanup after collectibles hidden\n      this.cleanup();');
});
