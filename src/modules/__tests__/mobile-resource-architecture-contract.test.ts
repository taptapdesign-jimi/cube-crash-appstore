import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');

describe('mobile resource architecture', () => {
  test('uses bounded route startup loading and a mobile-only Pixi critical set', () => {
    const startup = read('src/utils/comprehensive-image-preloader.ts');
    const assets = read('src/modules/asset-preloader.ts');
    const mobileCritical = assets.slice(
      assets.indexOf('const MOBILE_CRITICAL_ASSETS'),
      assets.indexOf('function getCriticalAssetsForRuntime'),
    );

    expect(startup).toContain('loadMobileLaunchRouteAssets');
    expect(startup).toContain('mobileImageLoads');
    expect(startup).toContain('Math.min(2, pending.length)');
    expect(mobileCritical).toContain("'./assets/tile.png'");
    expect(mobileCritical).toContain("'./assets/tile_numbers.png'");
    expect(mobileCritical).not.toContain('crash-cubes-homepage');
    expect(mobileCritical).not.toContain('journey-map-homepage');
    expect(mobileCritical).not.toContain('explosion pack/animation');
    expect(assets).toContain('Mobile post-critical preload is route-owned; global warmup skipped');
  });

  test('production continuous diagnostics are opt-in and the scroll probe is DEV-only', () => {
    const policy = read('src/utils/runtime-diagnostics-policy.ts');
    const collectibles = read('src/collectibles-manager.ts');
    expect(policy).toContain('__ccContinuousRuntimeDiagnostics');
    expect(collectibles).toContain('areContinuousRuntimeDiagnosticsEnabled() && !(scrollable as any).__ccJourneyScrollProbeInstalled');
  });
});
