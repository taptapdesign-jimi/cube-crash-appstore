import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const navigationSource = fs.readFileSync(
  path.join(root, 'src/modules/navigation-control.ts'),
  'utf8',
);
const appCoreSource = fs.readFileSync(path.join(root, 'src/modules/app-core.ts'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'src/main.ts'), 'utf8');
const zoneSource = fs.readFileSync(path.join(root, 'src/modules/app-zone-manager.ts'), 'utf8');
const navigationCss = fs.readFileSync(path.join(root, 'src/independent-navigation.css'), 'utf8');

describe('Fail-screen Homepage navigation isolation', () => {
  test('keeps the complete Homepage navigation hidden from the first Fail overlay frame', () => {
    const setZone = zoneSource.split('setZone(zone: AppZone')[1]
      ?.split('prepareArcadeRunOrigin')[0] ?? '';

    expect(setZone).toContain(
      "if (zone !== 'home' && options.preserveHomepageNavigation !== true)",
    );
    expect(setZone).toContain('hideHomepageNavigation(`app-zone:set-zone:${zone}:${reason}`)');
    expect(navigationSource).toContain("setAttribute(nav, OWNER_ATTRIBUTE, 'inactive')");
    expect(navigationCss).toContain("#independent-nav[data-homepage-owner='inactive']");
    expect(navigationCss).toContain('display: none !important;');
    expect(navigationCss).not.toContain('10000000000001');
  });

  test('no-moves handoff does not ask Homepage navigation to update before Fail DOM exists', () => {
    const failFlow = appCoreSource.split('async function showFinalScreen')[1]
      ?.split('let result = null;')[0] ?? '';

    expect(failFlow).not.toContain("import('./navigation-control.js')");
    expect(failFlow).not.toContain('updateNavigationVisibility()');
  });

  test('a manual game exit invalidates terminal work before any asynchronous cleanup', () => {
    const exitFlow = mainSource.split('(window as any).exitToMenu = async () => {')[1]
      ?.split('const STATE = await getAppState();')[0] ?? '';
    const navigationAbort = exitFlow.indexOf("window.dispatchEvent(new Event('cc-navigation'))");
    const terminalReset = exitFlow.indexOf("window.CC?.resetTransientRunGuards?.('exitToMenu-navigation-boundary')");
    const firstImport = exitFlow.indexOf('await Promise.all([');

    expect(navigationAbort).toBeGreaterThanOrEqual(0);
    expect(terminalReset).toBeGreaterThan(navigationAbort);
    expect(firstImport).toBeGreaterThan(terminalReset);

    const terminalFlow = appCoreSource.split('async function showFinalScreen')[1]
      ?.split('async function ensureArcadeSummaryExitShowsHomepage')[0] ?? '';
    expect(terminalFlow).toContain('terminalRunGeneration === gameplayRunGeneration');
    expect(terminalFlow).toContain('(window as any).exitingToMenu !== true');
    expect(terminalFlow.match(/if \(!terminalPresentationIsCurrent\(\)\) return;/g)?.length)
      .toBeGreaterThanOrEqual(4);
  });
});
