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

  it('finishes the studio and Homepage enter before presenting permission over the frozen Homepage', () => {
    const startupFlow = mainSource.indexOf('async function startAssetPreloading');
    const artPreload = mainSource.indexOf('preloadSpatialMotionPermissionArt()', startupFlow);
    const homepageEnter = mainSource.indexOf('animateSliderEnter();', startupFlow);
    const enterWait = mainSource.indexOf('SLIDER_ANIMATION.TOTAL_SEQUENCE', homepageEnter);
    const permissionAwait = mainSource.indexOf('await showSpatialMotionPermissionModal', enterWait);
    const unlock = mainSource.indexOf("restoreHomepageNavigationTree('startup-spatial-permission-complete')", permissionAwait);
    const characterExit = launchSource.indexOf('const characterExitPromise');
    const logoExit = launchSource.indexOf('const logoExitPromise');
    const studioExitAwait = launchSource.indexOf('const exitCompleted = await this.waitForRun');
    const studioHidden = launchSource.indexOf("studioPresentsContainer.style.display = 'none';");
    const launchHide = launchSource.indexOf('this.hide();', studioHidden);

    expect(artPreload).toBeGreaterThan(-1);
    expect(artPreload).toBeLessThan(homepageEnter);
    expect(permissionAwait).toBeGreaterThan(-1);
    expect(characterExit).toBeLessThan(studioExitAwait);
    expect(logoExit).toBeLessThan(studioExitAwait);
    expect(studioExitAwait).toBeLessThan(studioHidden);
    expect(studioHidden).toBeLessThan(launchHide);
    expect(homepageEnter).toBeLessThan(enterWait);
    expect(enterWait).toBeLessThan(permissionAwait);
    expect(permissionAwait).toBeLessThan(unlock);
    expect(launchSource).not.toContain('showSpatialMotionPermissionModal');
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

  it('keeps Homepage input, CSS idle, and spatial motion frozen through the modal exit', () => {
    expect(mainSource).toContain("gameState.set('sliderLocked', true)");
    expect(mainSource).toContain('lockHomepageEnterInteraction();');
    expect(mainSource).toContain("appSpatialMotion.holdActivations(startupPermissionHoldReason)");
    expect(mainSource).toContain("document.body.classList.add('cc-spatial-permission-home-frozen')");
    expect(mainSource).toContain("document.body.classList.remove('cc-spatial-permission-home-frozen')");
    expect(mainSource).toContain("gameState.set('sliderLocked', false)");
    expect(collectiblesCss).toContain('body.cc-spatial-permission-home-frozen #home * {');
    expect(collectiblesCss).toContain('animation-play-state: paused !important');
  });

  it('has one launch owner and no Journey Hub permission presentation residue', () => {
    expect(journeySource).not.toContain('showJourneySpatialPermissionAfterVisibleHubEnter');
    expect(journeySource).not.toContain('showSpatialMotionPermissionModal');
  });

  it('matches the End Run subtitle typography and independently pulses the stars', () => {
    const copyRule = collectiblesCss.match(/\.journey-spatial-permission-copy\s*\{([^}]*)\}/)?.[1] ?? '';
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

  it('enters and exits as a bottom-anchored comic paper sheet', () => {
    const overlayRule = collectiblesCss.match(/\.journey-spatial-permission-overlay\s*\{([^}]*)\}/)?.[1] ?? '';
    const cardRule = collectiblesCss.match(/\.journey-spatial-permission-card\s*\{([^}]*)\}/)?.[1] ?? '';
    const paperRule = collectiblesCss.match(/\.journey-spatial-permission-paper\s*\{([^}]*)\}/)?.[1] ?? '';
    const paperPaintRule = collectiblesCss.match(/\.journey-spatial-permission-card::after\s*\{([^}]*)\}/)?.[1] ?? '';
    const artRule = collectiblesCss.match(/\.journey-spatial-permission-art\s*\{([^}]*)\}/)?.[1] ?? '';
    const tiltRule = collectiblesCss.match(/\.journey-spatial-permission-tilt-frames\s*\{([^}]*)\}/)?.[1] ?? '';
    const lowerStarRule = collectiblesCss.match(/\.journey-spatial-permission-star-3\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(appCss).toContain('.bottom-sheet-paper-surface {');
    expect(appCss).toContain('background: var(--bottom-sheet-paper-texture)');
    expect(permissionModalSource).toContain(
      "paperSurface.className = 'journey-spatial-permission-paper bottom-sheet-paper-surface'",
    );
    expect(permissionModalSource).not.toContain('applyAppPaperSurfaceToElement');
    expect(permissionModalSource).not.toContain('bottom-sheet-shadow-surface');
    expect(permissionModalSource).not.toContain('animateBottomSheetEntrance');
    expect(permissionModalSource).toContain("dragHandle.className = 'journey-spatial-permission-handle'");
    expect(permissionModalSource).toContain("content.className = 'journey-spatial-permission-content'");
    expect(permissionModalSource).toContain('event.clientY - dragStartY');
    expect(permissionModalSource).toContain('dragDistance >= 44');
    expect(permissionModalSource).toContain('if (shouldDismiss) {');
    expect(permissionModalSource).toContain('onDismiss();');
    expect(permissionModalSource).toContain("target?.closest('button, a, input, select, textarea, [role=\"button\"]')");
    expect(permissionModalSource).toContain("card.addEventListener('pointerdown', onHandlePointerDown)");
    expect(permissionModalSource).not.toContain("dragHandle.addEventListener('pointerdown'");
    expect(permissionModalSource).toContain('const hadDragTransform = card.style.getPropertyValue');
    expect(collectiblesCss).toContain('.journey-spatial-permission-handle::before {');
    expect(collectiblesCss).toContain('height: 44px');
    expect(overlayRule).toContain('align-items: flex-end');
    expect(overlayRule).toContain('background: transparent');
    expect(overlayRule).not.toContain('backdrop-filter');
    expect(cardRule).toContain('width: 100%');
    expect(cardRule).toContain('max-width: 390px');
    expect(cardRule).toContain('height: auto');
    expect(cardRule).toContain('max-height: calc(100dvh - 24px');
    expect(cardRule).toContain('border-radius: 40px 40px 0 0');
    expect(cardRule).toContain('translate3d(0, 110%, 0) scale(0.98)');
    expect(cardRule).toContain('transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)');
    expect(cardRule).toContain('overflow: visible');
    expect(cardRule).not.toContain('-webkit-clip-path: polygon(');
    expect(paperRule).toContain('display: flex');
    expect(paperRule).toContain('flex-direction: column');
    expect(paperRule).toContain('align-items: center');
    expect(paperRule).toContain('justify-content: center');
    expect(paperRule).toContain('justify-content: safe center');
    expect(paperRule).toContain('max-height: inherit');
    expect(paperRule).toContain('background: none');
    expect(paperRule).toContain('border-radius: 40px 40px 0 0');
    expect(paperPaintRule).toContain('inset: 0');
    expect(paperPaintRule).toContain('background-position: center -32px');
    expect(paperPaintRule).toContain('background-color: #fbf0e9');
    expect(paperPaintRule).toContain('background-size: calc(100% + 48px) calc(100% + 96px)');
    expect(cardRule).toContain('0 24px 72px rgba(108, 70, 57, 0.36)');
    expect(paperRule).not.toContain('transform:');
    expect(collectiblesCss).toContain('.journey-spatial-permission-card::after {');
    expect(collectiblesCss).toContain('.journey-spatial-permission-card::before {');
    expect(collectiblesCss).toContain('0 -36px 72px rgba(233, 210, 200, 0.7)');
    expect(collectiblesCss).toContain('0 -42vh 120px 36vh rgba(233, 210, 200, 0.38)');
    expect(paperRule).not.toContain('clip-path');
    expect(paperRule).toContain('padding:');
    expect(paperRule).toContain('32px 24px max(36px, calc(20px + env(safe-area-inset-bottom, 0px)))');
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-overlay.is-exiting .journey-spatial-permission-card {',
    );
    expect(collectiblesCss).toContain('translate3d(0, 110%, 0) scale(0.98)');
    expect(collectiblesCss).toContain('transform 0.65s cubic-bezier(0.64, 0, 0.78, 0)');
    expect(collectiblesCss).toContain('@keyframes journey-spatial-sheet-bottom-landing');
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-overlay.is-visible .journey-spatial-permission-content {',
    );
    expect(collectiblesCss).not.toContain(
      '.journey-spatial-permission-overlay.is-visible .journey-spatial-permission-paper {',
    );
    expect(collectiblesCss).toContain('72% { transform: scale3d(1.012, 1.018, 1); }');
    expect(collectiblesCss).toContain('opacity 0.01s linear 0.64s');
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-overlay.is-exiting {\n  /* Keep the transparent owner visible until the card\'s standard comic\n     pop-out finishes; an early overlay fade would cut the bounce in half. */\n  opacity: 1;',
    );
    expect(permissionModalSource).toContain('const SPATIAL_MODAL_EXIT_DURATION_MS = 650;');
    expect(collectiblesCss).toContain('.journey-spatial-permission-card h2 {\n  margin: 0 auto;');
    expect(artRule).toContain('width: 250px');
    expect(artRule).toContain('height: 247px');
    expect(artRule).toContain('margin: 24px auto 32px');
    expect(collectiblesCss).toContain('.journey-spatial-permission-copy {\n  max-width: 310px;\n  margin: 0 auto 44px;');
    expect(tiltRule).toContain('left: 32.6px');
    expect(tiltRule).toContain('width: 184.8px');
    expect(tiltRule).toContain('height: 232.68px');
    expect(lowerStarRule).toContain('left: 24px');
    expect(lowerStarRule).toContain('top: 195px');
    expect(lowerStarRule).not.toContain('bottom:');
    expect(collectiblesCss).toContain('will-change: opacity, transform, filter');
    expect(collectiblesCss).toContain('opacity: 0.72;');
    expect(collectiblesCss).toContain('opacity: 0.16;');
    expect(collectiblesCss).toContain('filter: blur(0.8px)');
    expect(collectiblesCss).toContain('rotate(3.2deg) scale(1.025)');
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-tilt-frames {\n    left: 35.32px;\n    top: 0;\n    width: 129.36px;\n    height: 162.876px;',
    );
    expect(collectiblesCss).toContain(
      '.journey-spatial-permission-star-3 {\n    left: 18px;\n    top: 137px;',
    );
    expect(permissionModalSource).toContain(
      "dismissButton.className = 'journey-spatial-permission-dismiss exit-btn bottom-sheet-cta'",
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
