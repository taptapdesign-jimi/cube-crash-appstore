import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync('src/modules/app-core.ts', 'utf8');
const parsed = ts.createSourceFile('app-core.ts', source, ts.ScriptTarget.Latest, true);

function functions(names: string[]): string {
  return ts.transpileModule(parsed.statements.filter(node => ts.isFunctionDeclaration(node)
    && names.includes(node.name?.text || '')).map(node => node.getText(parsed)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('gameplay renderer session integration', () => {
  test('one supervisor owns context, foreground, entry and settled-board recovery', () => {
    expect(source).toContain('const gameplayRendererSupervisor = new GameplayRendererSupervisor({');
    expect(source).toContain('gameplayRendererSupervisor.joinRecovery(reason, trigger, { force })');
    expect(source).toContain("recoverAfterForeground('webglcontextrestored', 'context-restored')");
    expect(source).toContain("recoverAfterForeground('visibility-foreground', 'foreground')");
    expect(source).toContain("recoverCoreRenderTextures('gameplay-entry', 'gameplay-entry')");
    expect(source).toContain("recoverCoreRenderTextures('settled-board-watchdog', 'settled-board', true)");
    expect(source).not.toContain('coreTextureRecoveryPromise');
    expect(source).not.toContain('coreTextureRecoveryOwnerGeneration');
    expect(source).not.toContain('coreTextureForegroundOwner');
  });

  test('real renderer recreation preserves the live Application and stage identity', () => {
    expect(source).toContain('const activeApp = app;');
    expect(source).toContain('const previousRenderer = activeApp.renderer as any;');
    expect(source).toContain('(activeApp as any).renderer = nextRenderer;');
    expect(source).toContain('(replacement as any).stage = null;');
    expect(source).toContain('rendererRecreationPreviousSurface = { renderer: previousRenderer, canvas: previousCanvas };');
  });

  test('reveal requires structural, semantic and painted-frame validation', () => {
    expect(source).toContain('isGameplayRendererRecoveryStructureHealthy');
    expect(source).toContain('getLiveGameplayRendererParity(getVisualAssetRendererGeneration())');
    expect(source).toContain('extract?.pixels?.({ target: board, resolution: 0.25 })');
    expect(source).toContain("issues.push('board-frame-has-no-painted-pixels')");
    expect(source.indexOf('validatePaintedVisibility: async')).toBeLessThan(source.indexOf('reveal: () =>'));
  });

  test('both prepared entry commits await the renderer session before revealing', () => {
    expect(source).toContain('await awaitCoreTextureRecoveryForEntry(isCurrentLoad, signal)');
    expect(source).toContain('await awaitCoreTextureRecoveryForEntry(\n        () => stage === entryStage');
    expect(source).toContain('await layoutBoard(isCurrent);');
    expect(source).toContain("ensureCoreRenderTexturesGpuReady('startLevel', isCurrentStartLevel, app?.renderer)");
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
    const pending = h.run(); await Promise.resolve();
    expect(h.deps.probeCoreGameTextureGpuPixels).toHaveBeenCalledWith('test:before-repair', h.renderer);
    h.retire(); reloaded.resolve(['tile']); await pending;
    expect(h.deps.refreshLiveCoreGameSpriteTextures).not.toHaveBeenCalled();
    expect(h.deps.probeCoreGameTextureGpuPixels).toHaveBeenCalledTimes(1);
  });

  test('a superseded asset loop stops after its outstanding reload', async () => {
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
});
