import fs from 'node:fs';
import path from 'node:path';

describe('launch 3D Motion permission ownership', () => {
  const launchSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/launch-screen.ts'),
    'utf8',
  );
  const mainSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/main.ts'),
    'utf8',
  );
  const journeySource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'),
    'utf8',
  );
  const uiManagerSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/ui-manager.ts'),
    'utf8',
  );
  const collectiblesCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/collectibles-screen.css'),
    'utf8',
  );
  const appCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/style.css'),
    'utf8',
  );
  const permissionModalSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/spatial-motion-permission-modal.ts'),
    'utf8',
  );
  const indexSource = fs.readFileSync(
    path.resolve(process.cwd(), 'index.html'),
    'utf8',
  );

  it('occludes every deeper app surface from the first HTML frame until launch handoff', () => {
    const launchMarkup = indexSource.indexOf('id="launch-screen"');
    const uiRootMarkup = indexSource.indexOf('id="ui-root"');
    const navRootMarkup = indexSource.indexOf('id="nav-root"');

    expect(indexSource).toContain('<body class="cc-launch-boot-active"');
    expect(indexSource).toContain('body.cc-launch-boot-active > #ui-root');
    expect(indexSource).toContain('body.cc-launch-boot-active > #nav-root');
    expect(indexSource).toContain('body.cc-launch-boot-active > #app');
    expect(indexSource).toContain('body.cc-launch-boot-active > canvas');
    expect(indexSource).toContain('visibility: hidden !important');
    expect(launchMarkup).toBeGreaterThan(-1);
    expect(uiRootMarkup).toBeGreaterThan(launchMarkup);
    expect(navRootMarkup).toBeGreaterThan(launchMarkup);
    expect(launchSource.match(/classList\.remove\('cc-launch-boot-active'\)/g)?.length).toBe(2);
  });

  it('presents permission only after studio exit and awaits modal exit before Homepage handoff', () => {
    const artPreload = launchSource.indexOf('preloadSpatialMotionPermissionArt()');
    const permissionAwait = launchSource.indexOf('await showSpatialMotionPermissionModal');
    const characterExit = launchSource.indexOf('const characterExitPromise');
    const logoExit = launchSource.indexOf('const logoExitPromise');
    const studioExitAwait = launchSource.indexOf('const exitCompleted = await this.waitForRun');
    const studioHidden = launchSource.indexOf("studioPresentsContainer.style.display = 'none';");
    const launchHide = launchSource.indexOf('this.hide();', studioHidden);

    expect(artPreload).toBeGreaterThan(-1);
    expect(artPreload).toBeLessThan(characterExit);
    expect(permissionAwait).toBeGreaterThan(-1);
    expect(characterExit).toBeLessThan(studioExitAwait);
    expect(logoExit).toBeLessThan(studioExitAwait);
    expect(studioExitAwait).toBeLessThan(studioHidden);
    expect(studioHidden).toBeLessThan(permissionAwait);
    expect(permissionAwait).toBeLessThan(launchHide);
  });

  it('keeps Tilt exit input-opaque and reacquires PLAY before the first Homepage enter', () => {
    const launchComplete = mainSource.indexOf('await launchPromise;');
    const slideZeroSync = mainSource.indexOf('sliderManager.syncHiddenSlideState(0);', launchComplete);
    const ctaPrime = mainSource.indexOf('primeHomeCtaForEnter();', slideZeroSync);
    const homeReveal = mainSource.indexOf("homeElementAfter.style.display = 'block';", ctaPrime);

    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-overlay.is-exiting {\n  /* Keep the transparent owner visible until the card\'s standard comic',
    );
    expect(collectiblesCss).toContain('to Homepage navigation while the launch handoff is still underneath. */\n  opacity: 1;\n  pointer-events: auto;');
    expect(slideZeroSync).toBeGreaterThan(launchComplete);
    expect(slideZeroSync).toBeLessThan(ctaPrime);
    expect(ctaPrime).toBeLessThan(homeReveal);
  });

  it('turns on and persists 3D Motion inside Try It before requesting permission', () => {
    const enableIndex = launchSource.indexOf('settingsOwner._settings.spatialMotionEnabled = true');
    const requestIndex = launchSource.indexOf('journeySpatialMotion.requestPermissionFromGesture()', enableIndex);
    const persistIndex = launchSource.indexOf('settingsOwner.saveSettings?.(settingsOwner._settings)', requestIndex);
    expect(enableIndex).toBeGreaterThan(-1);
    expect(requestIndex).toBeGreaterThan(enableIndex);
    expect(persistIndex).toBeGreaterThan(requestIndex);
  });

  it('re-arms the persisted preference for the new WKWebView session after launch', () => {
    const bootRemoval = launchSource.indexOf("document.body.classList.remove('cc-launch-boot-active')");
    const sessionRearm = launchSource.indexOf(
      'journeySpatialMotion.armPermissionFromNextGesture()',
      bootRemoval,
    );

    expect(bootRemoval).toBeGreaterThan(-1);
    expect(sessionRearm).toBeGreaterThan(bootRemoval);
  });

  it('never aborts the studio intro from a stale priority-paper diagnostic identifier', () => {
    expect(launchSource).toContain('paperComplete: priorityPaperBgLoadPromise !== null');
    expect(launchSource).not.toContain('priorityPaperLoadPromise');
  });

  it('initializes Homepage state before the sole visible launch handoff', () => {
    const initializeGame = mainSource.indexOf('await initializeGame();');
    const launchHandoff = mainSource.indexOf('await startAssetPreloading();');
    const startupZone = mainSource.indexOf("appZoneManager.markHomeMenu('startup-homepage-enter')");
    const visibleEnter = mainSource.indexOf('animateSliderEnter();', startupZone);

    expect(initializeGame).toBeGreaterThan(-1);
    expect(initializeGame).toBeLessThan(launchHandoff);
    expect(startupZone).toBeGreaterThan(launchHandoff);
    expect(startupZone).toBeLessThan(visibleEnter);
    expect(mainSource).not.toContain('// Show homepage\n    uiManager.showHomepage();');
  });

  it('does not let startup safety timeouts break an intentional permission wait', () => {
    expect(mainSource.match(/launchScreen\.awaitingSpatialPermission/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('has one launch owner and no Journey Hub permission presentation residue', () => {
    expect(journeySource).not.toContain('showJourneySpatialPermissionAfterVisibleHubEnter');
    expect(journeySource).not.toContain('showSpatialMotionPermissionModal');
  });

  it('matches the End Run subtitle typography and independently pulses the stars', () => {
    const copyRule = collectiblesCss.match(/(?:^|\n)\.journey-spatial-permission-copy\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(copyRule).toContain('font-family: "Baloo2", system-ui, -apple-system, sans-serif');
    expect(copyRule).toContain('font-size: 20px');
    expect(copyRule).toContain('font-weight: 500 !important');
    expect(copyRule).toContain('color: #cba89a !important');
    expect(copyRule).toContain('line-height: 1.3');
    expect(collectiblesCss).toContain('@keyframes journey-spatial-modal-star-scale');
    expect(collectiblesCss.match(/journey-spatial-modal-star-scale/g)?.length).toBe(4);
  });

  it('suppresses the programmatically focused composition outline without hiding button focus', () => {
    const cardRule = collectiblesCss.match(/\.journey-spatial-permission-card\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(cardRule).toContain('outline: none');
    expect(collectiblesCss).not.toContain('.journey-spatial-permission-actions button:focus {\n  outline: none');
  });

  it('enters and exits as one centered comic paper modal', () => {
    const overlayRule = collectiblesCss.match(/\.journey-spatial-permission-overlay\s*\{([^}]*)\}/)?.[1] ?? '';
    const cardRule = collectiblesCss.match(/\.journey-spatial-permission-card\s*\{([^}]*)\}/)?.[1] ?? '';
    const paperRule = collectiblesCss.match(/\.journey-spatial-permission-paper\s*\{([^}]*)\}/)?.[1] ?? '';
    const artRule = collectiblesCss.match(/(?:^|\n)\.journey-spatial-permission-art\s*\{([^}]*)\}/)?.[1] ?? '';
    const tiltRule = collectiblesCss.match(/\.journey-spatial-permission-tilt-frames\s*\{([^}]*)\}/)?.[1] ?? '';
    const lowerStarRule = collectiblesCss.match(/\.journey-spatial-permission-star-3\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(appCss).toContain('.bottom-sheet-paper-surface {');
    expect(appCss).toContain('background: var(--bottom-sheet-paper-texture)');
    expect(permissionModalSource).toContain(
      "paperSurface.className = 'journey-spatial-permission-paper bottom-sheet-paper-surface'",
    );
    expect(permissionModalSource).toContain("title.className = 'cc-gameplay-modal-title'");
    expect(permissionModalSource).not.toContain('applyAppPaperSurfaceToElement');
    expect(permissionModalSource).not.toContain('bottom-sheet-shadow-surface');
    expect(permissionModalSource).not.toContain('animateBottomSheetEntrance');
    expect(permissionModalSource).not.toContain('journey-spatial-permission-handle');
    expect(overlayRule).toContain('align-items: center');
    expect(overlayRule).toContain('24px');
    expect(overlayRule).toContain('background: transparent');
    expect(overlayRule).not.toContain('backdrop-filter');
    expect(cardRule).toContain('width: 100%');
    expect(cardRule).toContain('max-width: 390px');
    expect(cardRule).toContain('height: auto');
    expect(cardRule).toContain('max-height: calc(100dvh - 48px');
    expect(cardRule).toContain('border-radius: 40px');
    expect(cardRule).toContain('translate3d(0, 88px, 0) scale(0.72) rotate(-2deg)');
    expect(paperRule).toContain('box-shadow: 0 13px 33.6px 0 rgba(185, 145, 119, 0.8)');
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-card .cc-gameplay-modal-gyro-shell > .gameplay-sheet-close {\n  top: -10px;\n  right: -10px;',
    );
    expect(cardRule).toContain('transform 0.78s cubic-bezier(0.34, 1.56, 0.64, 1)');
    expect(cardRule).toContain('overflow: visible');
    expect(cardRule).not.toContain('-webkit-clip-path: polygon(');
    expect(paperRule).toContain('display: flex');
    expect(paperRule).toContain('flex-direction: column');
    expect(paperRule).toContain('align-items: center');
    expect(paperRule).toContain('justify-content: center');
    expect(paperRule).toContain('justify-content: safe center');
    expect(paperRule).toContain('max-height: inherit');
    expect(paperRule).toContain('background-position: center top');
    expect(paperRule).toContain('border-radius: 40px');
    expect(paperRule).not.toContain('transform:');
    expect(collectiblesCss).not.toContain('.journey-spatial-permission-card::after {');
    expect(collectiblesCss).toContain('.journey-spatial-permission-card::before {');
    expect(collectiblesCss).toContain('0 -36px 72px rgba(233, 210, 200, 0.7)');
    expect(collectiblesCss).toContain('0 -42vh 120px 36vh rgba(233, 210, 200, 0.38)');
    expect(paperRule).not.toContain('clip-path');
    expect(paperRule).toContain('padding:');
    expect(paperRule).toContain('32px 24px 40px');
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-overlay.is-exiting .journey-spatial-permission-card {',
    );
    expect(collectiblesCss).toContain('translate3d(0, 20px, 0) scale(0) rotate(2deg)');
    expect(collectiblesCss).toContain('transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6)');
    expect(collectiblesCss).toContain('opacity 0.01s linear 0.64s');
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-overlay.is-exiting {\n  /* Keep the transparent owner visible until the card\'s standard comic\n     pop-out finishes; an early overlay fade would cut the bounce in half.\n     It must also remain input-opaque so iOS cannot retarget a late release\n     to Homepage navigation while the launch handoff is still underneath. */\n  opacity: 1;\n  pointer-events: auto;',
    );
    expect(permissionModalSource).toContain('const SPATIAL_MODAL_EXIT_DURATION_MS = 650;');
    expect(collectiblesCss).toContain('.journey-spatial-permission-card h2 {\n  margin: 0 auto;');
    expect(artRule).toContain('width: 250px');
    expect(artRule).toContain('height: 247px');
    expect(artRule).toContain('margin: 24px auto 32px');
    expect(collectiblesCss).toContain('.journey-spatial-permission-copy {\n  max-width: 310px;\n  margin: 0 auto 44px;');
    expect(tiltRule).toContain('left: 41.84px');
    expect(tiltRule).toContain('width: 166.32px');
    expect(tiltRule).toContain('height: 209.412px');
    expect(lowerStarRule).toContain('left: 24px');
    expect(lowerStarRule).toContain('top: 195px');
    expect(lowerStarRule).not.toContain('bottom:');
    expect(collectiblesCss).toContain('will-change: opacity, transform, filter');
    expect(collectiblesCss).toContain('opacity: 0.72;');
    expect(collectiblesCss).toContain('opacity: 0.16;');
    expect(collectiblesCss).toContain('filter: blur(0.8px)');
    expect(collectiblesCss).toContain('rotate(3.2deg) scale(1.025)');
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-tilt-frames {\n    left: 41.788px;\n    top: 15.206px;\n    width: 116.424px;\n    height: 146.588px;',
    );
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-star-3 {\n    left: 18px;\n    top: 137px;',
    );
    expect(permissionModalSource).not.toContain('journey-spatial-permission-dismiss');
    expect(permissionModalSource).toContain('mountGameplaySheetClose(gyroShell, onDismiss)');
  });

  it('keeps the 3D flip experiment nested, reversible, and reduced-motion safe', () => {
    expect(permissionModalSource).toContain(
      'export const SPATIAL_MOTION_MODAL_3D_FLIP_TEST_ENABLED = true',
    );
    expect(permissionModalSource).toContain("overlay.classList.add('is-3d-flip-test')");
    expect(permissionModalSource).toContain(
      "flipShell.className = 'journey-spatial-permission-flip-shell'",
    );
    expect(permissionModalSource).toContain('flipShell.appendChild(paperSurface)');
    expect(permissionModalSource).toContain('gyroShell.appendChild(flipShell)');
    expect(permissionModalSource).toContain('dragShell.appendChild(gyroShell)');
    expect(permissionModalSource).toContain('card.appendChild(dragShell)');
    expect(collectiblesCss).toContain('perspective: 920px');
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-flip-shell {\n  position: relative;\n  display: flex;\n  width: 100%;\n  max-height: inherit;\n  border-radius: 40px;\n  overflow: hidden;',
    );
    expect(collectiblesCss).toContain('@keyframes journey-spatial-modal-flip-in');
    expect(collectiblesCss).toContain('@keyframes journey-spatial-modal-flip-out');
    expect(collectiblesCss).toContain('@keyframes journey-spatial-modal-card-bounce-in');
    expect(collectiblesCss).toContain('@keyframes journey-spatial-modal-card-bounce-out');
    expect(collectiblesCss).toContain('scale(1.045) rotate(0.6deg)');
    expect(collectiblesCss).toContain(
      'animation: journey-spatial-modal-flip-out 0.65s cubic-bezier(0.4, 0, 0.2, 1) both;',
    );
    expect(collectiblesCss).toContain(
      'animation: journey-spatial-modal-card-bounce-out 0.65s cubic-bezier(0.4, 0, 0.2, 1) both;',
    );
    expect(collectiblesCss).toContain('scale(1.012) rotate(-0.25deg)');
    expect(collectiblesCss).toContain(
      'translate3d(0, -0.5px, 12px) rotateX(1.25deg) rotateY(-7deg) scale(1.008)',
    );
    expect(collectiblesCss).not.toContain('scale(1.055) rotate(-0.5deg)');
    expect(collectiblesCss).toContain('rotateX(17deg) rotateY(-88deg)');
    expect(collectiblesCss).toContain('rotateX(-15deg) rotateY(112deg)');
    expect(collectiblesCss).toContain('rotateX(-1deg) rotateY(7deg)');
    expect(collectiblesCss).toContain('rotateX(0deg) rotateY(-3deg) scale(1)');
    expect(collectiblesCss).toContain('rotateX(0deg) rotateY(1.2deg) scale(1)');
    expect(collectiblesCss).toContain('rotateX(0deg) rotateY(-0.35deg) scale(1)');
    expect(collectiblesCss).toContain('backface-visibility: hidden');
    expect(collectiblesCss).toContain('margin-bottom: -16px');
    expect(collectiblesCss).toContain('padding-bottom: 56px');
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-overlay.is-3d-flip-test .journey-spatial-permission-card::before {\n  content: none;',
    );
    expect(collectiblesCss).toContain('@keyframes journey-spatial-layer-title-in');
    expect(collectiblesCss).toContain('@keyframes journey-spatial-layer-art-in');
    expect(collectiblesCss).toContain('@keyframes journey-spatial-layer-copy-in');
    expect(collectiblesCss).toContain('@keyframes journey-spatial-layer-actions-in');
    expect(collectiblesCss).toContain('translate3d(0, 42px, 280px)');
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-overlay.is-3d-flip-test {\n  transition: none;',
    );
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-overlay.is-3d-flip-test::before {',
    );
    expect(permissionModalSource).toContain("overlay.classList.add('is-backdrop-visible')");
    expect(permissionModalSource).toContain("overlay.classList.remove('is-backdrop-visible')");
    expect(collectiblesCss).toContain('transition: opacity 0.5s ease-in-out');
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-overlay.is-3d-flip-test.is-backdrop-visible::before',
    );
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-overlay.is-3d-flip-test:not(.is-exiting) .journey-spatial-permission-card {',
    );
    expect(collectiblesCss).toContain(
      '0% { opacity: 1; transform: translate3d(-10px, -26px, 180px)',
    );
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-overlay.is-3d-flip-test .journey-spatial-permission-flip-shell {\n    transform: none !important;',
    );
  });

  it('holds the single app motion owner across Settings and Homepage enter transforms', () => {
    expect(uiManagerSource).toContain("journeySpatialMotion.holdActivations('settings-enter')");
    expect(mainSource).toContain('const motionHoldReason = `homepage-enter:${reason}`');
    expect(mainSource).toContain('appSpatialMotion.holdActivations(motionHoldReason)');
    expect(mainSource).toContain('appSpatialMotion.releaseActivations(`homepage-enter-complete:${reason}`)');
    expect(mainSource).toContain('sliderManager.refreshHomepageSpatialMotion();');
  });
});
