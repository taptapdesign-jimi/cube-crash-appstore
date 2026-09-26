import fs from 'node:fs';
import ts from 'typescript';
import { ForegroundResumeEpoch } from '../foreground-resume-epoch';

const source = fs.readFileSync('src/modules/app-core.ts', 'utf8');
const parsed = ts.createSourceFile('app-core.ts', source, ts.ScriptTarget.Latest, true);
function functions(names: string[]): string {
  return ts.transpileModule(parsed.statements.filter(node => ts.isFunctionDeclaration(node)
    && names.includes(node.name?.text || '')).map(node => node.getText(parsed)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function recoveryHarness() {
  const state = { zone: 'journey', terminal: true, pending: false, latest: 1 };
  const canvas = document.createElement('canvas');
  canvas.style.visibility = 'hidden';
  const app = { canvas, ticker: { started: false, start: jest.fn(), stop: jest.fn() }, renderer: { render: jest.fn() } };
  const deps = {
    app, stage: { visible: false }, board: { visible: false }, hud: { visible: false },
    ForegroundResumeEpoch,
    appZoneManager: { getCurrentZone: () => state.zone },
    isGameplayRendererTerminalSuspended: () => state.terminal,
    isGameplayEntryPending: () => state.pending,
    isGameplayEntryGenerationLatest: (entry: number) => entry === state.latest,
    retireSpecialDiceRendererOwnersForRecovery: jest.fn().mockResolvedValue(undefined),
    ensureCoreRenderTexturesGpuReady: jest.fn().mockResolvedValue([]),
    refreshLiveCoreGameSpriteTextures: jest.fn(),
    restartSpecialDiceRendererOwnersAfterRecovery: jest.fn(),
    layoutBoard: jest.fn().mockResolvedValue(undefined),
    restoreCanvasAfterCoreTextureRecovery: jest.fn(),
    restoreHealthyForegroundSurface: jest.fn(),
    getUnusableRequiredCoreRenderTextureAssets: () => [],
    emitNativeConsoleDiagnostic: jest.fn(), devLog: jest.fn(), devWarn: jest.fn(), devError: jest.fn(),
  };
  const code = `
    let activeGameplayEntryGeneration = 1, gameplayRunGeneration = 1;
    let coreTextureRecoveryPromise = null, coreTextureRecoveryOwnerGeneration = -1;
    let coreTextureRecoveryOwnerEntry = -1, coreTextureRecoveryOwnerRun = -1;
    let coreTextureRecoveryGeneration = 0, coreTextureContextCanvas = null;
    let coreTextureContextLostHandler = null, coreTextureContextRestoredHandler = null;
    let coreTextureVisibilityHandler = null, coreTexturePageShowHandler = null;
    let coreTextureVisibilityBeforeLoss = null, coreTextureCanvasVisibilityBeforeHide = null;
    let coreTextureNeedsFullRecovery = false, _hudInitDone = true;
    const coreTextureForegroundOwner = new ForegroundResumeEpoch();
    ${functions(['isCoreTextureRecoveryAllowed', 'hideGameplayForCoreTextureRecovery',
      'recoverCoreRenderTextures', 'detachCoreTextureContextRecovery', 'installCoreTextureContextRecovery',
      'awaitCoreTextureRecoveryForEntry'])}
    installCoreTextureContextRecovery(app.canvas);
    return {
      recover: recoverCoreRenderTextures, enter: awaitCoreTextureRecoveryForEntry,
      pending: () => coreTextureNeedsFullRecovery,
      nextEntry: () => { activeGameplayEntryGeneration++; gameplayRunGeneration++; },
      nextRun: () => { gameplayRunGeneration++; },
      dispose: detachCoreTextureContextRecovery,
    };`;
  const owner = new Function(...Object.keys(deps), code)(...Object.values(deps));
  return { state, deps, canvas, owner };
}

describe('core texture recovery belongs to the current gameplay surface', () => {
  const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');
  beforeEach(() => Object.defineProperty(document, 'hidden', { configurable: true, value: false }));
  afterEach(() => {
    if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden);
    else delete (document as any).hidden;
  });

  test.each(['terminal', 'journey'])('%s context restoration does no GPU work; next prepared entry awaits the retained repair', async route => {
    const h = recoveryHarness();
    if (route === 'journey') h.state.terminal = false;
    else h.state.zone = 'board-journey';
    try {
      h.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
      h.canvas.dispatchEvent(new Event('webglcontextrestored'));
      await flush();
      expect(h.owner.pending()).toBe(true);
      expect(h.deps.app.renderer.render).not.toHaveBeenCalled();
      expect(h.deps.ensureCoreRenderTexturesGpuReady).not.toHaveBeenCalled();
      expect(h.deps.layoutBoard).not.toHaveBeenCalled();
      const repair = deferred<string[]>();
      h.deps.ensureCoreRenderTexturesGpuReady.mockReturnValueOnce(repair.promise);
      h.state.pending = true; h.state.terminal = false;
      let revealed = false;
      const entering = h.owner.enter(() => true, new AbortController().signal).then((ready: boolean) => { revealed = ready; });
      await flush();
      expect(revealed).toBe(false);
      expect(h.deps.layoutBoard).not.toHaveBeenCalled();
      repair.resolve([]); await entering;
      expect(revealed).toBe(true);
      expect(h.owner.pending()).toBe(false);
      expect(h.deps.layoutBoard).toHaveBeenCalledTimes(1);
      expect(h.deps.app.ticker.start).not.toHaveBeenCalled();
    } finally { h.owner.dispose(); }
  });

  test.each(['entry', 'run'])('a replaced %s cannot rebind, rebuild or reveal after its texture await', async change => {
    const h = recoveryHarness();
    h.state.zone = 'board-journey'; h.state.terminal = false;
    const assets = deferred<string[]>();
    h.deps.ensureCoreRenderTexturesGpuReady.mockReturnValueOnce(assets.promise);
    try {
      const recovery = h.owner.recover('test'); await flush();
      const ownsRecovery = h.deps.ensureCoreRenderTexturesGpuReady.mock.calls[0][1];
      expect(ownsRecovery()).toBe(true);
      if (change === 'entry') { h.owner.nextEntry(); h.state.latest++; }
      else h.owner.nextRun();
      expect(ownsRecovery()).toBe(false);
      h.deps.app.renderer.render.mockClear();
      assets.resolve([]); await recovery;
      expect(h.deps.refreshLiveCoreGameSpriteTextures).not.toHaveBeenCalled();
      expect(h.deps.layoutBoard).not.toHaveBeenCalled();
      expect(h.deps.restartSpecialDiceRendererOwnersAfterRecovery).not.toHaveBeenCalled();
      expect(h.deps.app.renderer.render).not.toHaveBeenCalled();
      expect(h.owner.pending()).toBe(true);
    } finally { h.owner.dispose(); }
  });

  test('an entry waiting for foreground cancels without probing or retaining its visibility listener', async () => {
    const h = recoveryHarness(); const controller = new AbortController();
    const remove = jest.spyOn(document, 'removeEventListener');
    try {
      h.canvas.dispatchEvent(new Event('webglcontextlost'));
      h.state.pending = true; h.state.terminal = false;
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      const entry = h.owner.enter(() => true, controller.signal); await flush();
      controller.abort();
      expect(await entry).toBe(false);
      expect(h.deps.ensureCoreRenderTexturesGpuReady).not.toHaveBeenCalled();
      expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(h.owner.pending()).toBe(true);
    } finally { h.owner.dispose(); remove.mockRestore(); }
  });
});

describe('inner GPU barrier respects the captured owner and renderer', () => {
  function barrier() {
    let current = true;
    const renderer = { id: 'captured' };
    const deps = {
      app: { renderer: { id: 'successor' } },
      ensureCoreGameTexturesLoaded: jest.fn().mockResolvedValue([]),
      probeCoreGameTextureGpuPixels: jest.fn().mockReturnValue({ healthy: false, unavailable: false, failedAssets: ['tile'] }),
      hideGameplayForCoreTextureRecovery: jest.fn(), getRequiredCoreRenderTextureAssets: () => ['tile', 'hud'],
      refreshLiveCoreGameSpriteTextures: jest.fn(), emitNativeConsoleDiagnostic: jest.fn(),
      CoreRenderTextureBarrierError: Error,
    };
    const ensure = new Function(...Object.keys(deps), functions(['ensureCoreRenderTexturesGpuReady'])
      + ';return ensureCoreRenderTexturesGpuReady;')(...Object.values(deps));
    return { deps, run: () => ensure('test', () => current, renderer), retire: () => { current = false; }, renderer };
  }
  test('staleness during initial load cannot hide the successor or probe its renderer', async () => {
    const h = barrier(); const loaded = deferred<string[]>();
    h.deps.ensureCoreGameTexturesLoaded.mockReturnValueOnce(loaded.promise);
    const pending = h.run(); h.retire(); loaded.resolve([]); await pending;
    expect(h.deps.hideGameplayForCoreTextureRecovery).not.toHaveBeenCalled();
    expect(h.deps.probeCoreGameTextureGpuPixels).not.toHaveBeenCalled();
  });
  test('staleness during forced reload cannot rebind or verify the successor', async () => {
    const h = barrier(); const reloaded = deferred<string[]>();
    h.deps.ensureCoreGameTexturesLoaded.mockResolvedValueOnce([]).mockReturnValueOnce(reloaded.promise);
    const pending = h.run(); await flush();
    expect(h.deps.probeCoreGameTextureGpuPixels).toHaveBeenCalledWith('test:before-repair', h.renderer);
    h.retire(); reloaded.resolve(['tile']); await pending;
    expect(h.deps.refreshLiveCoreGameSpriteTextures).not.toHaveBeenCalled();
    expect(h.deps.probeCoreGameTextureGpuPixels).toHaveBeenCalledTimes(1);
  });
  test('both prepared entry commits await pending repair before revealing their surface', () => {
    expect(source).toContain('await awaitCoreTextureRecoveryForEntry(isCurrentLoad, signal)');
    expect(source).toContain('await awaitCoreTextureRecoveryForEntry(\n        () => stage === entryStage');
    expect(source).toContain('await layoutBoard(ownsCurrentLifecycle);');
    expect(source).toContain("ensureCoreRenderTexturesGpuReady('startLevel', isCurrentStartLevel, app?.renderer)");
  });

  test('a superseded asset loop stops after its outstanding reload without starting the next unload', async () => {
    let current = true; const loaded = deferred<any>();
    const deps = {
      getRequiredCoreRenderTextureAssets: () => ['tile', 'hud'], getUnusableRequiredCoreRenderTextureAssets: () => [],
      devWarn: jest.fn(), devError: jest.fn(), Assets: { get: () => ({ valid: true }) },
      isUsableGameTexture: () => true, reloadPixiImageTexture: jest.fn().mockReturnValue(loaded.promise),
      pinPixiImageTexture: jest.fn(), shouldOptimizeAsGameTexture: () => false,
      configureGameTextureSampling: jest.fn(), isCoreGhostTextureAsset: () => false,
      CoreRenderTextureBarrierError: Error,
    };
    const ensure = new Function(...Object.keys(deps), functions(['ensureCoreGameTexturesLoaded'])
      + ';return ensureCoreGameTexturesLoaded;')(...Object.values(deps));
    const result = ensure('test', ['tile', 'hud'], () => current);
    current = false; loaded.resolve({ valid: true }); await result;
    expect(deps.reloadPixiImageTexture).toHaveBeenCalledTimes(1);
    expect(deps.reloadPixiImageTexture).toHaveBeenCalledWith('tile');
    expect(deps.pinPixiImageTexture).not.toHaveBeenCalled();
  });

  test('prepared reveal cannot restore the previous menu canvas hidden state', () => {
    const canvas = document.createElement('canvas'); canvas.style.visibility = 'hidden';
    const deps = { app: { canvas, renderer: { render: jest.fn() } }, stage: {}, board: {}, hud: {},
      isArcadeEntrySurfaceGateActive: () => false };
    const reveal = new Function(...Object.keys(deps), 'let coreTextureCanvasVisibilityBeforeHide = "hidden";'
      + functions(['revealPreparedGameplaySurface'])
      + ';return () => { revealPreparedGameplaySurface(); return coreTextureCanvasVisibilityBeforeHide; };')(...Object.values(deps));
    expect(reveal()).toBeNull();
    expect(canvas.style.visibility).toBe('visible');
    expect(canvas.style.opacity).toBe('1');
  });
});
