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

  test('HTML preloads only parsed launch art and leaves route assets to their owners', () => {
    const index = read('index.html');
    const imagePreloads = index.match(/<link\s+rel="preload"\s+as="image"[^>]*>/g) ?? [];

    expect(imagePreloads).toHaveLength(2);
    expect(imagePreloads.join('\n')).toContain('./assets/logo addons/taplogo.png');
    expect(imagePreloads.join('\n')).toContain('./assets/logo addons/lik-board.png');
    expect(imagePreloads.join('\n')).not.toMatch(/@2x|@3x/);
    expect(imagePreloads.join('\n')).not.toMatch(/crash-cubes-homepage|\/nav\/|modals\/paper|journey assets|tile\.png/);
  });

  test('keeps the accepted random launch cast and excludes retired characters', () => {
    const launch = read('src/modules/launch-screen.ts');
    const nativeAudit = read('scripts/stack-to-six-native-audit.mjs');

    expect(launch).toContain("'!../../assets/logo addons/lik-klizanje.png'");
    expect(launch).toContain("'!../../assets/logo addons/lik-vrt.png'");
    expect(nativeAudit).toContain("'lik-cekic.png'");
    expect(nativeAudit).toContain("'lik-dron.png'");
    expect(nativeAudit).toContain("'lik-vrecice.png'");
    expect(nativeAudit).not.toContain("'lik-klizanje.png'");
    expect(nativeAudit).not.toContain("'lik-vrt.png'");
  });

  test('centers the studio logo and character as one composition with a 20px gap', () => {
    const index = read('index.html');
    const launch = read('src/modules/launch-screen.ts');
    const styles = read('src/style.css');

    expect(index).toContain('class="launch-studio-composition"');
    expect(launch).toContain("studioComposition.className = 'launch-studio-composition';");
    expect(launch).toContain('studioComposition.append(studioLogoUnit, studioCharacter);');
    expect(styles).toContain('#launch-screen .launch-studio-composition');
    expect(styles).toContain('gap: 20px;');
    expect(styles).not.toContain('transform: translate(-50%, -265px) scale(0.92);');
    expect(styles).not.toContain('transform: translate(-50%, -105px) scale(0.82);');
  });

  test('keeps both flex children mounted until the complete launch exit is removed', () => {
    const launch = read('src/modules/launch-screen.ts');

    expect(launch).not.toContain("studioCharacter.style.display = 'none';");
    expect(launch).not.toContain("studioLogoUnit.style.display = 'none';");
    expect(launch).toContain("studioPresentsContainer.style.display = 'none';");
    expect(launch).toContain('this.remove();');
  });

  test('production continuous diagnostics are opt-in and the scroll probe is DEV-only', () => {
    const policy = read('src/utils/runtime-diagnostics-policy.ts');
    const collectibles = read('src/collectibles-manager.ts');
    const drag = read('src/modules/drag-core.ts');
    expect(policy).toContain('__ccContinuousRuntimeDiagnostics');
    expect(collectibles).toContain('areContinuousRuntimeDiagnosticsEnabled() && !(scrollable as any).__ccJourneyScrollProbeInstalled');
    expect(drag).toContain('if (!areContinuousRuntimeDiagnosticsEnabled()) return;');
    expect(drag).not.toContain("typeof window.saveGameState === 'function'");
  });
});
