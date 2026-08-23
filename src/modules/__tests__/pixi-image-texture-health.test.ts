import fs from 'fs';
import path from 'path';
import {
  isUsablePixiImageTexture,
  pinPixiImageTexture,
  probePixiImageTextureGpuPixels,
} from '../../utils/pixi-image-texture-health';

describe('Pixi image texture health barrier', () => {
  const makeTexture = (resource: any) => ({
    destroyed: false,
    width: 128,
    height: 128,
    source: {
      destroyed: false,
      valid: true,
      width: 128,
      height: 128,
      resource,
      autoGarbageCollect: true,
    },
  });

  test('rejects retained texture metadata when the underlying image resource is gone', () => {
    expect(isUsablePixiImageTexture(makeTexture(null))).toBe(false);
    expect(isUsablePixiImageTexture(makeTexture({ width: 0, height: 0 }))).toBe(false);
  });

  test('accepts a decoded image resource and pins it against renderer GC', () => {
    const texture = makeTexture({ width: 256, height: 256 });
    expect(isUsablePixiImageTexture(texture)).toBe(true);
    pinPixiImageTexture(texture);
    expect(texture.source.autoGarbageCollect).toBe(false);
  });

  test('uses bounded renderer readback to distinguish real GPU pixels from retained metadata', () => {
    const texture = makeTexture({ width: 256, height: 256 });
    Object.assign(texture.source, {
      resolution: 1,
      on: jest.fn(),
      off: jest.fn(),
    });
    (texture as any).frame = { x: 0, y: 0, width: 128, height: 128 };

    const healthyRenderer = {
      extract: {
        pixels: jest.fn(() => ({
          pixels: new Uint8ClampedArray([240, 220, 200, 255]),
          width: 1,
          height: 1,
        })),
      },
    };
    const healthy = probePixiImageTextureGpuPixels(healthyRenderer, texture);
    expect(healthy.status).toBe('healthy');
    expect(healthy.samples).toBe(3);
    expect(healthy.nonTransparentPixels).toBe(3);
    expect(healthyRenderer.extract.pixels).toHaveBeenCalledTimes(3);
    expect((texture.source as any).off).toHaveBeenCalledTimes(3);

    const blankRenderer = {
      extract: {
        pixels: jest.fn(() => ({
          pixels: new Uint8ClampedArray(8 * 8 * 4),
          width: 8,
          height: 8,
        })),
      },
    };
    const blank = probePixiImageTextureGpuPixels(blankRenderer, texture);
    expect(blank.status).toBe('blank');
    expect(blank.samples).toBe(3);
    expect(blank.nonTransparentPixels).toBe(0);
  });

  test('reports unavailable and extraction errors without treating them as healthy pixels', () => {
    const texture = makeTexture({ width: 256, height: 256 });
    Object.assign(texture.source, {
      resolution: 1,
      on: jest.fn(),
      off: jest.fn(),
    });
    (texture as any).frame = { x: 0, y: 0, width: 128, height: 128 };

    expect(probePixiImageTextureGpuPixels({}, texture).status).toBe('unavailable');
    const failed = probePixiImageTextureGpuPixels({
      extract: { pixels: () => { throw new Error('GPU readback failed'); } },
    }, texture);
    expect(failed.status).toBe('error');
    expect(failed.error).toContain('GPU readback failed');
  });

  test('uses Pixi unload before load and never time-skips or fails open', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const healthSource = fs.readFileSync(path.join(repoRoot, 'src/utils/pixi-image-texture-health.ts'), 'utf8');
    const appCoreSource = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    const boardSource = fs.readFileSync(path.join(repoRoot, 'src/modules/board.ts'), 'utf8');
    const layoutSource = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core-startlevel-layout.ts'), 'utf8');
    const errorHandlerSource = fs.readFileSync(path.join(repoRoot, 'src/utils/error-handler.ts'), 'utf8');

    expect(healthSource.indexOf('await Assets.unload(assetPath)'))
      .toBeLessThan(healthSource.indexOf('await Assets.load<Texture>(assetPath)'));
    expect(appCoreSource).not.toContain('RECENT_CORE_TEXTURE_ENSURE_MS');
    expect(appCoreSource).toContain('Core render texture barrier failed; gameplay surface remains hidden');
    expect(appCoreSource).toContain('throw new CoreRenderTextureBarrierError(context, details.failedAssets);');
    expect(appCoreSource).toContain('const layoutCoreRepairWasNeeded = (');
    expect(appCoreSource).toContain('getUnusableRequiredCoreRenderTextureAssets().length > 0 ||');
    expect(appCoreSource).toContain("typeof tile.special === 'string' && tile.special.length > 0");
    expect(appCoreSource).toContain('...activeSpecialAssets');
    expect(appCoreSource).toContain('if (layoutCoreRepairWasNeeded) hideGameplayForCoreTextureRecovery();');
    expect(appCoreSource).toContain("canvas.style.visibility = 'hidden';");
    expect(appCoreSource).toContain('restoreCanvasAfterCoreTextureRecovery();');
    expect(appCoreSource).toContain('// left the canvas hidden. The entry commit is the sole safe reveal owner.');
    expect(appCoreSource).toContain('coreTextureCanvasVisibilityBeforeHide = null;');
    expect(appCoreSource).toContain('error instanceof CoreRenderTextureBarrierError ||');
    expect(appCoreSource).toContain('layoutCoreRepairWasNeeded ||');
    expect(appCoreSource).toContain('coreTextureRecoveryPromise !== null');
    expect(appCoreSource).toContain('stage === layoutStageOwner');
    expect(appCoreSource).toContain("typeof tile?.base?._ccTextureAssetPath === 'string'");
    expect(appCoreSource).toContain('return (tile?.value | 0) > 0 ? ASSET_NUMBERS : ASSET_TILE;');
    expect(boardSource).toContain('(t.base as any)._ccTextureAssetPath = selectedSkin.assetPath;');
    expect(boardSource).toContain('(t.base as any)._ccTextureAssetPath = assetPath;');
    expect(boardSource).toContain('(face as any)._ccTextureAssetPath = ASSET_TILE;');
    expect(layoutSource).toContain("devError('❌ Error in layoutBoard() during startGame:', err);\n    throw err;");
    expect(appCoreSource).toContain("canvas.addEventListener('webglcontextlost'");
    expect(appCoreSource).toContain("canvas.addEventListener('webglcontextrestored'");
    expect(appCoreSource).toContain("document.addEventListener('visibilitychange', coreTextureVisibilityHandler");
    expect(appCoreSource).toContain("window.addEventListener('pageshow', coreTexturePageShowHandler");
    expect(appCoreSource).toContain("recoverAfterForeground('visibility-foreground')");
    expect(appCoreSource).toContain("recoverAfterForeground('pageshow')");
    expect(appCoreSource).toContain('const coreTextureForegroundOwner = new ForegroundResumeEpoch();');
    expect(appCoreSource).toContain('if (document.hidden) return;');
    expect(appCoreSource).toContain('coreTextureNeedsFullRecovery = true;');
    expect(appCoreSource).toContain('const resumeLease = coreTextureForegroundOwner.consume();');
    expect(appCoreSource).toContain('coreTextureForegroundOwner.isCurrent(resumeLease)');
    expect(appCoreSource).toContain('resumeLease.resumeTicker');
    expect(appCoreSource).toContain('Healthy foreground texture validation completed without HUD/layout rebuild');
    expect(appCoreSource).toContain("reason === 'webglcontextrestored'");
    expect(appCoreSource).toContain('unavailableAssets.length > 0');
    expect(appCoreSource).toContain("const CORE_GPU_PROBE_ASSETS = [ASSET_TILE, ASSET_NUMBERS] as const;");
    expect(appCoreSource).toContain("emitNativeConsoleDiagnostic('[CC_TEXTURE_HEALTH]', 'gpu-probe'");
    expect(appCoreSource).toContain('ensureCoreRenderTexturesGpuReady(`foreground-fast:${reason}`)');
    expect(appCoreSource).toContain("ensureCoreRenderTexturesGpuReady('startLevel')");
    expect(appCoreSource).toContain('forceReloadAssets: readonly string[] = []');
    expect(appCoreSource).not.toContain('app.destroy(true, true)');
    expect(appCoreSource).toContain('ownerGeneration === coreTextureRecoveryGeneration');
    expect(appCoreSource).toContain('ownerApp === app');
    expect(appCoreSource).toContain('ownerCanvas === coreTextureContextCanvas');
    expect(appCoreSource).toContain('if (coreGhostTextureNeedsRebuild) {');
    expect(appCoreSource).toContain('makeBoard.refreshStackVisual(tile)');
    expect(boardSource).toContain('export function refreshStackVisual(tile: Tile): void');
    expect(errorHandlerSource).toContain('__ccRecoverCoreRenderTextures');
    expect(errorHandlerSource).not.toContain('app.destroy(true);');
    expect(errorHandlerSource).not.toContain("this.showUserFriendlyError('Graphics error detected. Please refresh the page.');");
  });
});
