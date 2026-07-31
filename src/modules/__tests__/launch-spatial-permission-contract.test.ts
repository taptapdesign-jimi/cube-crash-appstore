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

  it('awaits the permission choice before character and logo exit begin', () => {
    const artAwait = launchSource.indexOf('preloadSpatialMotionPermissionArt()');
    const permissionAwait = launchSource.indexOf('await showSpatialMotionPermissionModal');
    const characterExit = launchSource.indexOf('const characterExitPromise');
    const logoExit = launchSource.indexOf('const logoExitPromise');

    expect(artAwait).toBeGreaterThan(-1);
    expect(artAwait).toBeLessThan(permissionAwait);
    expect(permissionAwait).toBeGreaterThan(-1);
    expect(permissionAwait).toBeLessThan(characterExit);
    expect(permissionAwait).toBeLessThan(logoExit);
  });

  it('does not let startup safety timeouts break an intentional permission wait', () => {
    expect(mainSource.match(/launchScreen\.awaitingSpatialPermission/g)?.length).toBeGreaterThanOrEqual(2);
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

  it('suppresses the programmatically focused sheet outline without hiding button focus', () => {
    const cardRule = collectiblesCss.match(/\.journey-spatial-permission-card\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(cardRule).toContain('outline: none');
    expect(collectiblesCss).not.toContain('.journey-spatial-permission-actions button:focus {\n  outline: none');
  });

  it('shares the exact gameplay bottom-sheet paper surface instead of app-paper overlay', () => {
    expect(appCss).toContain('.simple-bottom-sheet,\n.bottom-sheet-paper-surface');
    expect(appCss).toContain('background: var(--bottom-sheet-paper-texture)');
    expect(permissionModalSource).toContain(
      "card.className = 'journey-spatial-permission-card bottom-sheet-paper-surface'",
    );
    expect(permissionModalSource).not.toContain('applyAppPaperSurfaceToElement');
  });

  it('holds the single app motion owner across Settings and Homepage enter transforms', () => {
    expect(uiManagerSource).toContain("journeySpatialMotion.holdActivations('settings-enter')");
    expect(mainSource).toContain('appSpatialMotion.holdActivations(`homepage-enter:${reason}`)');
    expect(mainSource).toContain('appSpatialMotion.releaseActivations(`homepage-enter-complete:${reason}`)');
    expect(mainSource).toContain('sliderManager.refreshHomepageSpatialMotion();');
  });
});
