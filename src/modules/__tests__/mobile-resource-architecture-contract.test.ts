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
    expect(imagePreloads.join('\n')).toContain('./assets/logo addons/lik-game.png');
    expect(imagePreloads.join('\n')).not.toContain('./assets/logo addons/lik-game.svg');
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
    expect(boardSvg.match(/dur="1\.3798623s"/g)).toHaveLength(1199);
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

  test('uses matched prerendered animations for the complete mobile SVG cast with WebP and authored SVG fallbacks', () => {
    const index = read('index.html');
    const launch = read('src/modules/launch-screen.ts');
    const proxyExpectations = [
      ['lik-game-mobile.webp', 'lik-game-mobile-hevc.mov', 680, 981, 30, 990],
      ['lik-gitara-mobile.webp', 'lik-gitara-mobile-hevc.mov', 680, 959, 30, 990],
      ['lik-pas-SVG-mobile.webp', 'lik-pas-SVG-mobile-hevc.mov', 680, 962, 60, 1980],
      ['lik-cvijet-mobile.webp', 'lik-cvijet-mobile-hevc.mov', 680, 995, 30, 990],
      ['lik-kauc-mobile.webp', 'lik-kauc-mobile-hevc.mov', 680, 883, 19, 638],
      ['lik-board-mobile.webp', 'lik-board-mobile-hevc.mov', 680, 982, 21, 804],
      ['lik-slikanje-mobile.webp', 'lik-slikanje-mobile-hevc.mov', 680, 982, 30, 990],
      ['lik-laptop-mobile.webp', 'lik-laptop-mobile-hevc.mov', 680, 773, 45, 1485],
      ['lik-nogomet-mobile.webp', 'lik-nogomet-mobile-hevc.mov', 680, 1020, 30, 990],
      ['lik-speceraj-mobile.webp', 'lik-speceraj-mobile-hevc.mov', 680, 980, 30, 990],
      ['pas-novine-mobile.webp', 'pas-novine-mobile-hevc.mov', 680, 730, 30, 990],
    ] as const;

    expect(index).toContain('src="./assets/logo addons/lik-game.png"');
    expect(index).not.toContain('src="./assets/logo addons/lik-game.svg"');
    expect(launch).toContain("import { MOBILE_RUNTIME_PROFILE } from './mobile-runtime-profile.js';");
    expect(launch).toContain('const MOBILE_ANIMATION_PROXIES = [');
    expect(launch).toContain('Boolean(selectedStudioCharacterMobileAnimationUrl) &&');
    expect(launch).toContain('MOBILE_RUNTIME_PROFILE.isMobileDevice || forceMobileAnimationProxyInDev');
    expect(launch).toContain("new URLSearchParams(window.location.search).get('ccIntroCharacter')");
    expect(launch).toContain('import.meta.env.VITE_CC_FORCE_INTRO_CHARACTER?.trim() || null');
    expect(launch).toContain("new URLSearchParams(window.location.search).get('ccIntroMobileProxy') === '1'");
    expect(launch).toContain("studioCharacter.dataset.launchMotionSource = 'svg-fallback';");

    for (const [webpFilename, hevcFilename, expectedWidth, expectedHeight, expectedFrames, expectedDuration] of proxyExpectations) {
      expect(launch).toContain(`'../../assets/logo addons/optimized/${webpFilename}'`);
      expect(launch).toContain(`'../../assets/logo addons/optimized/${hevcFilename}'`);
      const proxy = fs.readFileSync(path.resolve(process.cwd(), `assets/logo addons/optimized/${webpFilename}`));
      expect(proxy.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(proxy.subarray(8, 12).toString('ascii')).toBe('WEBP');
      expect(proxy.includes(Buffer.from('ANIM'))).toBe(true);
      expect(proxy.includes(Buffer.from('ANMF'))).toBe(true);
      expect(proxy.subarray(12, 16).toString('ascii')).toBe('VP8X');
      expect(proxy.readUIntLE(24, 3) + 1).toBe(expectedWidth);
      expect(proxy.readUIntLE(27, 3) + 1).toBe(expectedHeight);

      let chunkOffset = 12;
      const frameDurations: number[] = [];
      while (chunkOffset + 8 <= proxy.length) {
        const chunkType = proxy.subarray(chunkOffset, chunkOffset + 4).toString('ascii');
        const chunkSize = proxy.readUInt32LE(chunkOffset + 4);
        const payloadOffset = chunkOffset + 8;
        if (chunkType === 'ANMF') frameDurations.push(proxy.readUIntLE(payloadOffset + 12, 3));
        chunkOffset = payloadOffset + chunkSize + (chunkSize % 2);
      }
      expect(frameDurations).toHaveLength(expectedFrames);
      expect(frameDurations.reduce((sum, duration) => sum + duration, 0)).toBe(expectedDuration);
      expect(Math.max(...frameDurations) - Math.min(...frameDurations)).toBeLessThanOrEqual(1);

      const video = fs.readFileSync(path.resolve(process.cwd(), `assets/logo addons/optimized/${hevcFilename}`));
      expect(video.subarray(4, 8).toString('ascii')).toBe('ftyp');
      expect(video.includes(Buffer.from('hvc1'))).toBe(true);
    }
  });

  test('uses bounded HEVC-alpha video for the complete mobile cast and retains image fallbacks', () => {
    const launch = read('src/modules/launch-screen.ts');
    const startupReadiness = read('src/utils/startup-readiness.ts');
    const encoder = read('scripts/encode-hevc-alpha-frames.swift');
    const generator = read('scripts/build-mobile-intro-proxies.mjs');
    const renderer = read('scripts/render-animated-svg-frames.mjs');

    expect(launch).toContain('Boolean(selectedStudioCharacterMobileVideoUrl) &&');
    expect(launch).toContain('const selectedStudioCharacterUsesMobileVideoProxy =');
    expect(launch).toContain("dataset.launchMotionSource = 'hevc-alpha';");
    expect(launch).toContain("dataset.launchMotionSource = 'animated-webp-fallback';");
    expect(launch).toContain("selectedStudioCharacterUsesMobileVideoProxy ? 'video' : 'img'");
    expect(launch).toContain("studioCharacter.setAttribute('playsinline', '');");
    expect(launch).toContain('studioCharacter.muted = true;');
    expect(launch).toContain('studioCharacter.loop = true;');
    expect(launch).toContain("this.elements.studioCharacter.removeAttribute('src');");
    expect(launch).toContain("timeoutMs: 3500,");
    expect(launch).toContain('backgroundCriticalImagePreloadPromise.catch(() => {});');
    expect(launch).toContain('criticalStartupReadinessPromise');
    expect(launch).not.toContain('timeoutMs: 10000,');
    expect(launch).not.toContain('criticalImagePreloadPromise.catch(() => {})');
    expect(encoder).toContain('AVVideoCodecType.hevcWithAlpha');
    expect(encoder).toContain('kVTCompressionPropertyKey_TargetQualityForAlpha');
    expect(encoder).not.toContain('context.scaleBy(x: 1, y: -1)');
    expect(generator).toContain("await Promise.all([buildWebp(), buildHevc()]);");
    expect(generator).toContain("await run('/usr/bin/xcrun', ['swiftc', '-O', HEVC_ENCODER_SOURCE");
    expect(generator).toContain("['lik-pas-SVG.svg', 'lik-pas-SVG-mobile.webp', 'lik-pas-SVG-mobile-hevc.mov', 4, 1980]");
    expect(generator).toContain("['lik-kauc.svg', 'lik-kauc-mobile.webp', 'lik-kauc-mobile-hevc.mov', 1.2755102, 638]");
    expect(renderer).toContain('const time = index * durationSeconds / frameCount;');
    expect(renderer).not.toContain('const time = index / fps;');
    expect(generator).toContain("['lik-board.svg', 'lik-board-mobile.webp', 'lik-board-mobile-hevc.mov', 1.3798623, 804]");
    expect(generator).toContain("['lik-laptop.svg', 'lik-laptop-mobile.webp', 'lik-laptop-mobile-hevc.mov', 3, 1485]");
    expect(encoder).toContain('arguments.outputDurationMilliseconds');
    expect(startupReadiness).toContain('element instanceof HTMLImageElement');
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
    expect(styles).toContain('left: var(--launch-character-offset-x, 0px);');
    expect(styles).toContain('top: var(--launch-character-offset-y, 0px);');
    expect(styles).not.toContain('transform: translate(-50%, -265px) scale(0.92);');
    expect(styles).not.toContain('transform: translate(-50%, -105px) scale(0.82);');
  });

  test('owns every requested character scale, offset and pivot through one presentation table', () => {
    const launch = read('src/modules/launch-screen.ts');
    const styles = read('src/style.css');

    expect(launch).toContain("['/lik-kauc.svg', { restScale: 1.1475, offsetX: 0, offsetY: 40, transformOrigin: 'center center' }]");
    expect(launch).toContain("['/lik-gitara.svg', { restScale: 1.1, offsetX: 0, offsetY: 16, transformOrigin: 'center center' }]");
    expect(launch).toContain("['/lik slikanje.svg', { restScale: 1.08, offsetX: 20, offsetY: 10, transformOrigin: 'center center' }]");
    expect(launch).toContain("['/lik-cvijet.svg', { restScale: 1.08, offsetX: 0, offsetY: 8, transformOrigin: 'center center' }]");
    expect(launch).toContain("['/lik-board.svg', { restScale: 1.04, offsetX: 0, offsetY: 16, transformOrigin: 'center center' }]");
    expect(launch).toContain("['/lik-game.svg', { restScale: 1.08, offsetX: 0, offsetY: 0, transformOrigin: 'center center' }]");
    expect(launch).toContain("['/lik-laptop.svg', { restScale: 1.452, offsetX: 0, offsetY: 8, transformOrigin: 'center center' }]");
    expect(launch).toContain("['/lik-pas-SVG.svg', { restScale: 1.12, offsetX: 0, offsetY: 0, transformOrigin: 'center top' }]");
    expect(launch).toContain("['/lik-speceraj.svg', { restScale: 1.21, offsetX: 0, offsetY: 20, transformOrigin: 'center center' }]");
    expect(launch).toContain("['/lik-nogomet.svg', { restScale: 1.1, offsetX: 0, offsetY: 0, transformOrigin: 'center center' }]");
    expect(launch).toContain("['/pas novine.svg', { restScale: 1.1, offsetX: 0, offsetY: 16, transformOrigin: 'center center' }]");
    expect(launch).toContain('const selectedStudioCharacterInitialScale = Number((0.82 * selectedStudioCharacterRestScale).toFixed(4));');
    expect(launch).toContain('scale: selectedStudioCharacterRestScale,');
    expect(styles).toContain('transform: scale(var(--launch-character-initial-scale, 0.82));');
    expect(styles).toContain('transform-origin: var(--launch-character-transform-origin, center center);');
    expect(launch).not.toContain('launch-studio-character--ten-percent-larger');
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
