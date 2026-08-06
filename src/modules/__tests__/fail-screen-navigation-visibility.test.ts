import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const navigationSource = fs.readFileSync(
  path.join(root, 'src/modules/navigation-control.ts'),
  'utf8',
);
const appCoreSource = fs.readFileSync(path.join(root, 'src/modules/app-core.ts'), 'utf8');
const zoneSource = fs.readFileSync(path.join(root, 'src/modules/app-zone-manager.ts'), 'utf8');
const navigationCss = fs.readFileSync(path.join(root, 'src/independent-navigation.css'), 'utf8');

describe('Fail-screen Homepage navigation isolation', () => {
  test('keeps the complete Homepage navigation hidden from the first Fail overlay frame', () => {
    const setZone = zoneSource.split('setZone(zone: AppZone')[1]
      ?.split('prepareArcadeRunOrigin')[0] ?? '';

    expect(setZone).toContain("if (zone !== 'home')");
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
});
