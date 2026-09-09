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
    expect(imagePreloads.join('\n')).toContain('./assets/logo addons/lik-game.svg');
    expect(imagePreloads.join('\n')).not.toContain('./assets/logo addons/lik-game.png');
    expect(imagePreloads.join('\n')).not.toMatch(/@2x|@3x/);
    expect(imagePreloads.join('\n')).not.toMatch(/crash-cubes-homepage|\/nav\/|modals\/paper|journey assets|tile\.png/);
  });

  test('keeps the accepted random launch cast and excludes retired characters', () => {
    const launch = read('src/modules/launch-screen.ts');
    const nativeAudit = read('scripts/stack-to-six-native-audit.mjs');

    expect(launch).toContain("'../../assets/logo addons/lik-game.svg'");
    expect(launch).toContain("'!../../assets/logo addons/lik-game.png'");
    expect(launch).toContain("'../../assets/logo addons/lik-gitara.svg'");
    expect(launch).toContain("'!../../assets/logo addons/lik-gitara.png'");
    expect(launch).toContain("'../../assets/logo addons/lik-pas-SVG.svg'");
    expect(launch).toContain("'!../../assets/logo addons/lik-pas.png'");
    expect(launch).toContain("'../../assets/logo addons/lik-cvijet.svg'");
    expect(launch).toContain("'!../../assets/logo addons/lik-cvijet.png'");
    expect(launch).toContain("'../../assets/logo addons/lik-kauc.svg'");
    expect(launch).toContain("'!../../assets/logo addons/lik-kauc.png'");
    expect(launch).toContain("'../../assets/logo addons/lik-laptop.svg'");
    expect(launch).toContain("'!../../assets/logo addons/lik-laptop.png'");
    expect(launch).toContain("'../../assets/logo addons/lik-board.svg'");
    expect(launch).toContain("'../../assets/logo addons/lik-nogomet.svg'");
    expect(launch).toContain("'!../../assets/logo addons/lik-nogomet.png'");
    expect(launch).toContain("'../../assets/logo addons/lik-speceraj.svg'");
    expect(launch).toContain("'!../../assets/logo addons/lik-speceraj.png'");
    expect(launch).toContain("'!../../assets/logo addons/lik-lajna.png'");
    expect(launch).toContain("'!../../assets/logo addons/lik-klizanje.png'");
    expect(launch).toContain("'!../../assets/logo addons/lik-vrt.png'");
    expect(launch).toContain("'!../../assets/logo addons/lik-board.png'");
    expect(launch).toContain("'!../../assets/logo addons/lik-dron.png'");
    expect(launch).toContain("'../../assets/logo addons/lik slikanje.svg'");
    expect(launch).toContain("'!../../assets/logo addons/lik slikanje.png'");
    expect(launch).toContain("'../../assets/logo addons/pas novine.svg'");
    expect(nativeAudit).toContain("'lik-laptop.svg'");
    expect(nativeAudit).toContain("'lik-nogomet.svg'");
    expect(nativeAudit).toContain("'lik slikanje.svg'");
    expect(nativeAudit).toContain("'pas novine.svg'");
    expect(nativeAudit).toContain("'lik-cvijet.svg'");
    expect(nativeAudit).toContain("'lik-kauc.svg'");
    expect(nativeAudit).toContain("'lik-board.svg'");
    expect(nativeAudit).toContain("'lik-speceraj.svg'");
    expect(nativeAudit).toContain("'lik-game.svg'");
    expect(nativeAudit).toContain("'lik-gitara.svg'");
    expect(nativeAudit).toContain("'lik-pas-SVG.svg'");
    expect(nativeAudit).toContain("'lik-lajna.png'");
    expect(nativeAudit).not.toContain("'lik-game.png'");
    expect(nativeAudit).not.toContain("'lik-gitara.png'");
    expect(nativeAudit).not.toContain("'lik-cvijet.png'");
    expect(nativeAudit).not.toContain("'lik-kauc.png'");
    expect(nativeAudit).not.toContain("'lik-laptop.png'");
    expect(nativeAudit).not.toContain("'lik-nogomet.png'");
    expect(nativeAudit).not.toContain("'lik-speceraj.png'");
    expect(nativeAudit).not.toContain("'lik slikanje.png'");
    expect(nativeAudit).not.toContain("'lik-board.png'");
    expect(nativeAudit).not.toContain("'lik-pas.png'");
    expect(nativeAudit).not.toContain("'lik-cekic.png'");
    expect(nativeAudit).not.toContain("'lik-dron.png'");
    expect(nativeAudit).not.toContain("'lik-vrecice.png'");
    expect(nativeAudit).not.toContain("'lik-klizanje.png'");
    expect(nativeAudit).not.toContain("'lik-vrt.png'");
  });

  test('lets all animated launch SVGs own their idle motion without a second parent wobble', () => {
    const launch = read('src/modules/launch-screen.ts');
    const gameSvg = read('assets/logo addons/lik-game.svg');
    const guitarSvg = read('assets/logo addons/lik-gitara.svg');
    const flowerSvg = read('assets/logo addons/lik-cvijet.svg');
    const couchSvg = read('assets/logo addons/lik-kauc.svg');
    const boardSvg = read('assets/logo addons/lik-board.svg');
    const painterSvg = read('assets/logo addons/lik slikanje.svg');
    const newspaperDogSvg = read('assets/logo addons/pas novine.svg');
    const footballSvg = read('assets/logo addons/lik-nogomet.svg');
    const grocerySvg = read('assets/logo addons/lik-speceraj.svg');
    const laptopSvg = read('assets/logo addons/lik-laptop.svg');

    expect(launch).toContain("selectedStudioCharacterHasOwnMotion");
    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/lik-game.svg')");
    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/lik-gitara.svg')");
    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/lik-pas-SVG.svg')");
    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/lik-cvijet.svg')");
    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/lik-kauc.svg')");
    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/lik-board.svg')");
    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/lik slikanje.svg')");
    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/lik-laptop.svg')");
    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/lik-nogomet.svg')");
    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/lik-speceraj.svg')");
    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/pas novine.svg')");
    expect(launch).toContain('const characterIdleTween = selectedStudioCharacterHasOwnMotion ? null : trackTween');
    expect(gameSvg).toContain('viewBox="-12 -8 650 938"');
    expect(gameSvg.match(/<animateTransform(?=\s)/g)).toHaveLength(1273);
    expect(gameSvg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
    expect(guitarSvg).toContain('viewBox="-12 -8 654 922"');
    expect(guitarSvg).toContain('Guitar groove — 2 second loop');
    expect(guitarSvg.match(/<animateTransform(?=\s)/g)).toHaveLength(1645);
    expect(guitarSvg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
    expect(flowerSvg).toContain('viewBox="-18 -12 324 474"');
    expect(flowerSvg.match(/<animateTransform(?=\s)/g)).toHaveLength(1643);
    expect(flowerSvg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
    expect(couchSvg).toContain('viewBox="-12 -15 716 930"');
    expect(couchSvg.match(/<animateTransform(?=\s)/g)).toHaveLength(960);
    expect(couchSvg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
    expect(boardSvg).toContain('viewBox="-30 -15 644 930"');
    expect(boardSvg.match(/<animateTransform(?=\s)/g)).toHaveLength(1197);
    expect(boardSvg.match(/<animate(?=\s)/g)).toHaveLength(2);
    expect(boardSvg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
    expect(painterSvg).toContain('viewBox="-30 -15 644 930"');
    expect(painterSvg.match(/<animateTransform(?=\s)/g)).toHaveLength(1498);
    expect(painterSvg.match(/<animate(?=\s)/g)).toHaveLength(1);
    expect(painterSvg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
    expect(newspaperDogSvg).toContain('viewBox="-30 -30 894 960"');
    expect(newspaperDogSvg.match(/<animateTransform(?=\s)/g)).toHaveLength(1892);
    expect(newspaperDogSvg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
    expect(footballSvg).toContain('viewBox="-20 -40 340 510"');
    expect(footballSvg.match(/<animateTransform(?=\s)/g)).toHaveLength(900);
    expect(footballSvg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
    expect(grocerySvg).toContain('viewBox="-20 -20 340 490"');
    expect(grocerySvg.match(/<animateTransform(?=\s)/g)).toHaveLength(1786);
    expect(grocerySvg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
    expect(laptopSvg).toContain('viewBox="-60 -25 440 500"');
    expect(laptopSvg.match(/<animateTransform(?=\s)/g)).toHaveLength(1558);
    expect(laptopSvg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
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
    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/lik slikanje.svg');");
    expect(launch).toContain("'launch-studio-character--slikanje'");
    expect(styles).toContain('#launch-screen .launch-studio-character--slikanje');
    expect(styles).toContain('left: 20px;');
    expect(styles).not.toContain('transform: translate(-50%, -265px) scale(0.92);');
    expect(styles).not.toContain('transform: translate(-50%, -105px) scale(0.82);');
  });

  test('makes only lik-pas-SVG twelve percent larger from a top-center pivot', () => {
    const launch = read('src/modules/launch-screen.ts');
    const styles = read('src/style.css');

    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/lik-pas-SVG.svg');");
    expect(launch).toContain('const selectedStudioCharacterRestScale = selectedStudioCharacterUsesLargeTopPivot\n  ? 1.12');
    expect(launch).toContain("'launch-studio-character--large-dog'");
    expect(launch).toContain('scale: selectedStudioCharacterRestScale,');
    expect(styles).toMatch(/#launch-screen \.launch-studio-character--large-dog \{\s*transform: scale\(0\.9184\);\s*transform-origin: center top;\s*\}/);
  });

  test('makes only pas novine, lik-speceraj and lik-laptop ten percent larger with the shared centered pivot', () => {
    const launch = read('src/modules/launch-screen.ts');
    const styles = read('src/style.css');

    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/pas novine.svg') ||");
    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/lik-speceraj.svg') ||");
    expect(launch).toContain("selectedStudioCharacterPath.endsWith('/lik-laptop.svg');");
    expect(launch).toContain('selectedStudioCharacterUsesTenPercentScale');
    expect(launch).toContain(': selectedStudioCharacterUsesTenPercentScale\n    ? 1.1\n    : 1;');
    expect(launch).toContain("'launch-studio-character--ten-percent-larger'");
    expect(styles).toMatch(/#launch-screen \.launch-studio-character--ten-percent-larger \{\s*transform: scale\(0\.902\);\s*\}/);
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
